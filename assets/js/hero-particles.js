/* hero-particles.js — GPU particle orbital hero for nahfid.vercel.app
 * Concentric breathing orbital system: cream dust rings around a soft core,
 * one mint comet with a trail. Stateless orbital motion in the vertex shader.
 * Exposes window.initHero3D(container, opts) -> { destroy, pause, resume } | null
 */
import * as THREE from '/assets/vendor/three.module.min.js';

THREE.ColorManagement.enabled = false; // WYSIWYG token hexes, we shade manually

const VERT = /* glsl */ `
uniform float uTime;
uniform float uPScale;
uniform float uLeftFade;
attribute vec4 aData;   // radius, theta0, angularSpeed, yOffset
attribute vec4 aData2;  // size(world), phase, baseAlpha, mintMix
attribute float aWob;   // wobble amplitude factor (0 for comet coherence)
varying float vAlpha;
varying float vMint;
varying float vSeed;

void main() {
  float r0 = aData.x;
  float th0 = aData.y;
  float sp = aData.z;
  float y0 = aData.w;
  float size = aData2.x;
  float ph = aData2.y;
  float baseA = aData2.z;
  vMint = aData2.w;
  float t = uTime;

  // slow breathing of the whole system
  float breath = 1.0 + 0.02 * sin(t * 0.16 + r0 * 0.55 + ph * 0.4);
  float r = r0 * breath;
  float th = th0 + t * sp;
  vec3 p = vec3(cos(th) * r, y0, sin(th) * r);

  // gentle vertical undulation + fine radial shimmer
  p.y += aWob * (0.10 * sin(th * 2.0 + ph * 6.2831) + 0.05 * sin(t * 0.21 + ph * 12.0));
  float shim = aWob * 0.035 * sin(t * 0.9 + ph * 40.0 + r0 * 3.0);
  p.x += shim * cos(th);
  p.z += shim * sin(th);

  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  float depth = max(-mv.z, 0.001);
  gl_PointSize = max(size * uPScale / depth, 0.75);

  // twinkle, depth fog (fades to bg), near fade, left-of-frame exclusion
  float tw = 0.8 + 0.2 * sin(t * (0.5 + fract(ph * 7.0) * 0.7) + ph * 6.2831);
  float fog = smoothstep(44.0, 27.0, depth);
  float nearF = smoothstep(6.0, 12.0, depth);
  float ndcX = gl_Position.x / max(gl_Position.w, 0.0001);
  float left = mix(1.0, mix(0.18, 1.0, smoothstep(-0.78, -0.08, ndcX)), uLeftFade);
  vAlpha = baseA * tw * fog * nearF * left;
  vSeed = ph;
}
`;

const FRAG = /* glsl */ `
precision highp float;
uniform vec3 uCream;
uniform vec3 uMint;
uniform float uGlobal;
varying float vAlpha;
varying float vMint;
varying float vSeed;

void main() {
  vec2 q = gl_PointCoord - 0.5;
  float d = length(q);
  float a = smoothstep(0.5, 0.04, d);
  a *= a;
  // blue-noise-ish dither kills banding inside soft sprites on near-black bg
  float n = fract(sin(dot(gl_PointCoord + vSeed, vec2(12.9898, 78.233))) * 43758.5453);
  a += (n - 0.5) * 0.06 * a;
  vec3 col = mix(uCream, uMint, vMint);
  gl_FragColor = vec4(col, a * vAlpha * uGlobal);
}
`;

function gauss() {
  return (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;
}

window.initHero3D = function initHero3D(container, opts = {}) {
  if (!container) return null;

  // ---- capability gate -----------------------------------------------------
  try {
    const probe = document.createElement('canvas');
    const gl = probe.getContext('webgl2') || probe.getContext('webgl');
    if (!gl) return null;
    const lose = gl.getExtension('WEBGL_lose_context');
    if (lose) lose.loseContext();
  } catch (e) {
    return null;
  }

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const mobile = coarse || Math.min(window.innerWidth, window.innerHeight) < 700;
  const scale = mobile ? 0.38 : 1;

  let renderer;
  const canvas = document.createElement('canvas');
  canvas.style.cssText =
    'position:absolute;inset:0;width:100%;height:100%;display:block;' +
    'pointer-events:none;z-index:0;opacity:0;transition:opacity 1.2s ease;';
  canvas.setAttribute('aria-hidden', 'true');
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: false,
      alpha: false,
      stencil: false,
      depth: false,
      powerPreference: 'high-performance',
    });
  } catch (e) {
    return null;
  }
  renderer.setClearColor(0x08080a, 1);
  let dpr = Math.min(window.devicePixelRatio || 1, mobile ? 1.5 : 2);
  renderer.setPixelRatio(dpr);
  container.appendChild(canvas);

  const scene = new THREE.Scene();
  const FOV = 50;
  const camera = new THREE.PerspectiveCamera(FOV, 1, 1, 80);
  const CAM_Z = mobile ? 33 : 26;
  camera.position.set(0, 0, CAM_Z);

  const group = new THREE.Group();
  group.rotation.x = -1.12; // mostly face-on disc, slight perspective tilt
  group.rotation.z = 0.10;
  scene.add(group);

  // ---- particle buffers ----------------------------------------------------
  // Buffer order matters: comet + rings + core first, ambient dust LAST so the
  // runtime FPS governor can cut draw range without touching the motif.
  const TRAIL = 220;
  const N_COMET = 2 + TRAIL; // head + halo + trail
  const N_RINGS = Math.round(16000 * scale);
  const N_CORE = Math.round(2600 * scale);
  const N_DUST = Math.round(6800 * scale);
  const N = N_COMET + N_RINGS + N_CORE + N_DUST;

  const data = new Float32Array(N * 4);
  const data2 = new Float32Array(N * 4);
  const wob = new Float32Array(N);
  let i = 0;
  const put = (r, th, sp, y, size, ph, a, mint, w) => {
    data[i * 4] = r; data[i * 4 + 1] = th; data[i * 4 + 2] = sp; data[i * 4 + 3] = y;
    data2[i * 4] = size; data2[i * 4 + 1] = ph; data2[i * 4 + 2] = a; data2[i * 4 + 3] = mint;
    wob[i] = w;
    i++;
  };
  const kepler = (r) => 0.55 / Math.pow(Math.max(r, 0.6), 1.5);

  // comet — one mint traveller on its own lane between the outer rings
  const RC = 8.45;
  const SPC = kepler(RC) * 1.9;
  const TH0 = Math.random() * Math.PI * 2;
  put(RC, TH0, SPC, 0, 0.30, 0.13, 0.85, 1, 0.15);           // head
  put(RC, TH0, SPC, 0, 0.72, 0.13, 0.10, 1, 0.15);           // soft halo
  for (let k = 0; k < TRAIL; k++) {
    const f = (k + 1) / TRAIL;
    put(
      RC + gauss() * 0.05 * f,
      TH0 - (k + 1) * 0.0024,
      SPC,
      gauss() * 0.04 * f,
      0.10 * (1 - f) + 0.02,
      0.13 + f * 0.01,
      0.5 * (1 - f) * (1 - f) + 0.02,
      1,
      0.1
    );
  }

  // concentric rings
  const RADII = [3.2, 4.6, 6.1, 7.7, 9.3, 11.0];
  const wSum = RADII.reduce((s, r) => s + r, 0);
  RADII.forEach((rk, k) => {
    const n = Math.round((N_RINGS * rk) / wSum);
    const sigR = 0.10 + rk * 0.014;
    const sigY = 0.08 + rk * 0.013;
    const baseA = 0.40 - k * 0.032;
    for (let j = 0; j < n && i < N_COMET + N_RINGS; j++) {
      const mint = Math.random() < 0.045 ? 1 : 0;
      put(
        rk + gauss() * sigR,
        Math.random() * Math.PI * 2,
        kepler(rk) * (1 + gauss() * 0.015),
        gauss() * sigY,
        (0.048 + Math.random() * 0.036) * (mint ? 1.25 : 1),
        Math.random(),
        mint ? baseA * 0.85 : baseA,
        mint,
        1
      );
    }
  });
  while (i < N_COMET + N_RINGS) {
    // fill rounding remainder onto a random ring
    const rk = RADII[(Math.random() * RADII.length) | 0];
    put(rk + gauss() * 0.15, Math.random() * Math.PI * 2, kepler(rk), gauss() * 0.12,
      0.04, Math.random(), 0.22, 0, 1);
  }

  // core — soft nebula cluster
  for (let j = 0; j < N_CORE; j++) {
    const r = Math.abs(gauss()) * 1.5 + 0.05;
    put(
      r,
      Math.random() * Math.PI * 2,
      kepler(r) * (0.6 + Math.random() * 0.3),
      gauss() * 0.14,
      0.032 + Math.random() * 0.034,
      Math.random(),
      0.06 + Math.max(0, 1 - r / 1.9) * 0.17,
      0,
      0.6
    );
  }

  // ambient dust slab — depth and air (drawn last: governor can cull it)
  for (let j = 0; j < N_DUST; j++) {
    const r = 1.6 + Math.pow(Math.random(), 0.7) * 11.4;
    put(
      r,
      Math.random() * Math.PI * 2,
      kepler(r) * (0.8 + Math.random() * 0.4),
      gauss() * (0.5 + r * 0.09),
      0.03 + Math.random() * 0.055,
      Math.random(),
      0.05 + Math.random() * 0.10,
      0,
      1
    );
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('aData', new THREE.BufferAttribute(data, 4));
  geo.setAttribute('aData2', new THREE.BufferAttribute(data2, 4));
  geo.setAttribute('aWob', new THREE.BufferAttribute(wob, 1));
  // Points still needs a `position` attribute for three's bookkeeping
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(N * 3), 3));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), 14);

  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: FRAG,
    uniforms: {
      uTime: { value: 60 },
      uPScale: { value: 1 },
      uLeftFade: { value: 1 },
      uCream: { value: new THREE.Color('#E8DFC9') },
      uMint: { value: new THREE.Color('#7EE7B0') },
      uGlobal: { value: mobile ? 1.5 : 1 },
    },
    transparent: true,
    depthTest: false,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });

  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  group.add(points);

  // ---- composition: system center projects at 63% x ------------------------
  function updateComposition(w, h) {
    const aspect = w / h;
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    const halfH = Math.tan((FOV * Math.PI) / 360) * CAM_Z;
    const halfW = halfH * aspect;
    const narrow = aspect < 0.85;
    const ndcX = narrow ? (opts.mobileX ?? 0.06) : ((opts.x ?? 0.63) * 2 - 1);
    group.position.x = ndcX * halfW;
    group.position.y = narrow ? -halfH * 0.30 : -halfH * 0.03;
    mat.uniforms.uLeftFade.value = narrow ? 0 : 1;
    mat.uniforms.uPScale.value =
      ((h * dpr) / (2 * Math.tan((FOV * Math.PI) / 360))) * (narrow ? 1.3 : 1);
  }

  function resize() {
    const w = container.clientWidth || 1;
    const h = container.clientHeight || 1;
    renderer.setPixelRatio(dpr);
    renderer.setSize(w, h, false);
    updateComposition(w, h);
  }
  resize();

  let resizeT = 0;
  let lastW = container.clientWidth;
  const ro = new ResizeObserver(() => {
    clearTimeout(resizeT);
    resizeT = setTimeout(() => {
      const w = container.clientWidth;
      const dh = Math.abs(container.clientHeight - canvas.clientHeight);
      if (w !== lastW || dh > 150) {
        lastW = w;
        resize();
        if (reduced) renderStatic();
      }
    }, 120);
  });
  ro.observe(container);

  // ---- mouse parallax: eased, additive, autonomous drift when idle ---------
  const target = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  const onPointer = (e) => {
    target.x = (e.clientX / window.innerWidth) * 2 - 1;
    target.y = (e.clientY / window.innerHeight) * 2 - 1;
  };
  window.addEventListener('pointermove', onPointer, { passive: true });

  // ---- render loop ---------------------------------------------------------
  let raf = 0;
  let running = false;
  let userPaused = false;
  let visible = true;
  let destroyed = false;
  let revealed = false;
  let lastT = 0;
  let simT = 60 + Math.random() * 20;

  // fps governor state
  let frames = 0;
  let accum = 0;
  let governed = false;

  function reveal() {
    if (revealed) return;
    revealed = true;
    requestAnimationFrame(() => { canvas.style.opacity = '1'; });
  }

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - lastT) / 1000 || 0.016, 0.05);
    lastT = now;
    simT += dt;

    // governor: sample frames 10..130
    if (!governed && frames < 130) {
      frames++;
      if (frames > 10) accum += dt;
      if (frames === 130) {
        const avg = accum / 120;
        if (avg > 0.022) {
          governed = true;
          dpr = 1;
          geo.setDrawRange(0, N_COMET + N_RINGS + N_CORE); // drop ambient dust
          resize();
        }
      }
    }

    const k = 1 - Math.exp(-dt * 3.2);
    // autonomous lissajous drift keeps it alive untouched
    const ax = target.x + 0.18 * Math.sin(simT * 0.07);
    const ay = target.y + 0.14 * Math.cos(simT * 0.055);
    eased.x += (ax - eased.x) * k;
    eased.y += (ay - eased.y) * k;
    camera.position.x = eased.x * 1.35;
    camera.position.y = -eased.y * 0.95;
    camera.lookAt(0, 0, 0);

    mat.uniforms.uTime.value = simT;
    renderer.render(scene, camera);
    reveal();
  }

  function start() {
    if (running || destroyed || reduced) return;
    if (userPaused || !visible || document.hidden) return;
    running = true;
    lastT = performance.now();
    raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }

  function renderStatic() {
    camera.position.set(0.35, -0.2, CAM_Z);
    camera.lookAt(0, 0, 0);
    mat.uniforms.uTime.value = 72;
    renderer.render(scene, camera);
    reveal();
  }

  // ---- lifecycle wiring ----------------------------------------------------
  const io = new IntersectionObserver(
    (entries) => {
      visible = entries[0].isIntersecting;
      visible ? start() : stop();
    },
    { threshold: 0 }
  );
  io.observe(container);

  const onVis = () => { document.hidden ? stop() : start(); };
  document.addEventListener('visibilitychange', onVis);

  let lostOnce = false;
  const onLost = (e) => {
    e.preventDefault();
    stop();
    if (lostOnce) canvas.style.opacity = '0'; // second loss: bow out to CSS fallback
    lostOnce = true;
  };
  const onRestored = () => { if (!destroyed) { resize(); start(); } };
  canvas.addEventListener('webglcontextlost', onLost, false);
  canvas.addEventListener('webglcontextrestored', onRestored, false);

  if (reduced) {
    renderStatic();
  } else {
    start();
  }

  return {
    pause() { userPaused = true; stop(); },
    resume() { userPaused = false; start(); },
    destroy() {
      destroyed = true;
      stop();
      io.disconnect();
      ro.disconnect();
      clearTimeout(resizeT);
      window.removeEventListener('pointermove', onPointer);
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      canvas.removeEventListener('webglcontextrestored', onRestored);
      geo.dispose();
      mat.dispose();
      renderer.dispose();
      if (canvas.parentNode) canvas.parentNode.removeChild(canvas);
    },
  };
};
