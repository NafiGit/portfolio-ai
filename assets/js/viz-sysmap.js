/* viz-sysmap.js — force-directed system map of projects ↔ technologies.
   Exposes window.initSysMap(container, opts) -> { destroy, pause, resume } | null
   Requires: d3 v7 global. No other dependencies. */
(function () {
  'use strict';

  var BG = '#08080A';
  var FG = '#F7F6F3';
  var MUTED = '#8E8E97';
  var MINT = '#7EE7B0';
  var CREAM = '#E8DFC9';

  /* ---- verified data (projects -> technologies) ---- */
  var PROJECTS = [
    { id: 'p-moderation', name: 'Content Moderation Pipeline', lines: ['Content Moderation', 'Pipeline'],
      cx: 0.14, cy: 0.30, tech: ['BERT', 'LLM-as-a-Judge', 'Python'] },
    { id: 'p-filing', name: 'Autonomous Filing Agent', lines: ['Autonomous', 'Filing Agent'],
      cx: 0.45, cy: 0.24, tech: ['Browser Use', 'Claude Agent SDK', 'Langgraph', 'Claude'] },
    { id: 'p-minecraft', name: 'Minecraft Multi-Agent Harness', lines: ['Minecraft', 'Multi-Agent Harness'],
      cx: 0.83, cy: 0.30, tech: ['custom harness', 'pathfinding', 'Claude'] },
    { id: 'p-icml', name: 'ICML Paper Pipeline', lines: ['ICML Paper', 'Pipeline'],
      cx: 0.14, cy: 0.76, tech: ['TF-IDF', 'KMeans', 'LLM extraction'] },
    { id: 'p-crm', name: 'CRM Messaging Agent', lines: ['CRM Messaging', 'Agent'],
      cx: 0.48, cy: 0.79, tech: ['Langgraph', 'whatsapp-web.js', 'Node'] },
    { id: 'p-voice', name: 'Voice AI', lines: ['Voice AI'],
      cx: 0.85, cy: 0.76, tech: ['diarization', 'real-time transcription'] }
  ];

  function techId(name) {
    return 't-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  }

  function splitLabel(name) {
    if (name.length <= 14) return [name];
    var mid = name.length / 2, best = -1, bestDist = 1e9;
    for (var i = 1; i < name.length - 1; i++) {
      var c = name.charAt(i);
      if (c === ' ' || c === '-') {
        var d = Math.abs(i - mid);
        if (d < bestDist) { bestDist = d; best = i; }
      }
    }
    if (best < 0) return [name];
    var a = name.slice(0, name.charAt(best) === '-' ? best + 1 : best);
    var b = name.slice(best + 1);
    return [a, b];
  }

  function buildGraph() {
    var nodes = [], links = [], byId = {};
    PROJECTS.forEach(function (p) {
      var n = { id: p.id, kind: 'project', name: p.name, lines: p.lines,
                cx: p.cx, cy: p.cy, tech: p.tech.slice(), degree: p.tech.length };
      byId[n.id] = n; nodes.push(n);
    });
    PROJECTS.forEach(function (p) {
      p.tech.forEach(function (t, i) {
        var tid = techId(t), tn = byId[tid];
        if (!tn) {
          tn = byId[tid] = { id: tid, kind: 'tech', name: t, lines: splitLabel(t),
                            projects: [], seed: i };
          nodes.push(tn);
        }
        tn.projects.push(p.name);
        links.push({ source: p.id, target: tid, key: p.id + '|' + tid });
      });
    });
    nodes.forEach(function (n) {
      if (n.kind === 'tech') {
        n.degree = n.projects.length;
        var sx = 0, sy = 0, c = 0;
        PROJECTS.forEach(function (p) {
          if (p.tech.indexOf(n.name) >= 0) { sx += p.cx; sy += p.cy; c++; }
        });
        n.cx = sx / c; n.cy = sy / c;
      }
    });
    // adjacency: id -> Set of ids (self + neighbors); link keys per id
    var adj = {}, linkKeys = {};
    nodes.forEach(function (n) { adj[n.id] = {}; adj[n.id][n.id] = 1; linkKeys[n.id] = {}; });
    links.forEach(function (l) {
      adj[l.source][l.target] = 1; adj[l.target][l.source] = 1;
      linkKeys[l.source][l.key] = 1; linkKeys[l.target][l.key] = 1;
    });
    return { nodes: nodes, links: links, adj: adj, linkKeys: linkKeys };
  }

  /* ---- styles (injected once) ---- */
  var STYLE_ID = 'viz-sysmap-style';
  var CSS = '' +
'.sysmap-root{position:relative;width:100%;background:transparent;}' +
'.sysmap-root svg{display:block;width:100%;height:100%;touch-action:pan-y;overflow:visible;}' +
'.sysmap-root .sm-link{stroke:rgba(247,246,243,0.11);stroke-width:1;fill:none;' +
  'transition:opacity .16s ease,stroke .16s ease,stroke-width .16s ease;}' +
'.sysmap-root.is-focused .sm-link{opacity:.22;}' +
'.sysmap-root.is-focused .sm-link.is-on{opacity:1;stroke:rgba(126,231,176,.62);stroke-width:1.4;}' +
'.sysmap-root .sm-node{transition:opacity .16s ease;outline:none;}' +
'.sysmap-root:not(.is-focused) .sm-node,.sysmap-root:not(.is-focused) .sm-link{transition-duration:.3s;}' +
'.sysmap-root.is-focused .sm-node{opacity:.2;}' +
'.sysmap-root.is-focused .sm-node.is-on{opacity:1;}' +
'.sysmap-root .sm-node{cursor:pointer;}' +
'.sysmap-root .sm-core{transition:fill .16s ease,stroke .16s ease;}' +
'.sysmap-root .sm-node--project .sm-core{fill:' + CREAM + ';stroke:rgba(126,231,176,0);stroke-width:1.6;}' +
'.sysmap-root .sm-node--project .sm-ring{fill:none;stroke:rgba(232,223,201,.28);stroke-width:1;transition:stroke .16s ease;}' +
'.sysmap-root .sm-node--project.is-on .sm-core{stroke:rgba(126,231,176,.95);}' +
'.sysmap-root .sm-node--project.is-on .sm-ring{stroke:rgba(126,231,176,.35);}' +
'.sysmap-root .sm-node--tech .sm-core{fill:#5C5C64;}' +
'.sysmap-root .sm-node--tech.is-on .sm-core{fill:' + MINT + ';}' +
'.sysmap-root .sm-label{text-anchor:middle;paint-order:stroke;stroke:' + BG + ';' +
  'stroke-width:4px;stroke-linejoin:round;pointer-events:none;transition:fill .16s ease;}' +
'.sysmap-root .sm-label--project{fill:' + FG + ';font-weight:600;letter-spacing:.005em;}' +
'.sysmap-root .sm-label--tech{fill:' + MUTED + ';text-transform:uppercase;letter-spacing:.09em;}' +
'.sysmap-root .sm-node--tech.is-on .sm-label--tech{fill:' + FG + ';}' +
'.sysmap-root .sm-hit{fill:transparent;stroke:none;}' +
'.sysmap-root .sm-node:focus-visible .sm-core{stroke:' + MINT + ';stroke-width:2;}' +
'.sysmap-root .sysmap-detail{position:absolute;left:2px;bottom:0;max-width:88%;' +
  'font-family:"Geist Mono",ui-monospace,monospace;font-size:11px;line-height:1.5;' +
  'letter-spacing:.04em;opacity:0;transform:translateY(3px);' +
  'transition:opacity .2s ease,transform .2s ease;pointer-events:none;}' +
'.sysmap-root .sysmap-detail.is-visible{opacity:1;transform:none;}' +
'.sysmap-root .sysmap-detail .d-name{color:' + CREAM + ';text-transform:uppercase;}' +
'.sysmap-root .sysmap-detail .d-rest{color:' + MUTED + ';}' +
'.sysmap-root .sysmap-legend{position:absolute;right:2px;top:0;display:flex;gap:16px;align-items:center;' +
  'font-family:"Geist Mono",ui-monospace,monospace;font-size:10px;letter-spacing:.12em;' +
  'text-transform:uppercase;color:' + MUTED + ';pointer-events:none;}' +
'.sysmap-root .sysmap-legend i{display:inline-block;border-radius:50%;margin-right:7px;vertical-align:1px;}' +
'.sysmap-root .sysmap-legend .lg-p i{width:8px;height:8px;background:' + CREAM + ';}' +
'.sysmap-root .sysmap-legend .lg-t i{width:5px;height:5px;background:#5C5C64;}' +
'.sysmap-root .sm-node.pre,.sysmap-root .sm-link.pre{opacity:0;}' +
'@media (max-width:640px){.sysmap-root .sysmap-legend{display:none;}}';

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var s = document.createElement('style');
    s.id = STYLE_ID;
    s.textContent = CSS;
    document.head.appendChild(s);
  }

  /* ---- init ---- */
  function initSysMap(container, opts) {
    if (!container || typeof window.d3 === 'undefined') return null;
    var d3 = window.d3;
    opts = opts || {};
    ensureStyle();

    var height = opts.height || 520;
    var reduced = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    var coarse = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    var isStatic = reduced || coarse;

    container.classList.add('sysmap-root');
    container.style.height = height + 'px';

    var graph = buildGraph();
    var nodes = graph.nodes, links = graph.links, adj = graph.adj, linkKeys = graph.linkKeys;

    var width = Math.max(320, container.clientWidth || 960);
    var small = width < 640;
    var SF = small ? 0.82 : 1;                      // scale factor for type + radii
    var projFont = 13 * SF, techFont = small ? 10 : 10 * SF;  // tech labels never shrink below 10px
    var projChar = 7.7 * SF, techChar = 7.0 * (small ? 1 : SF); // rough advance widths incl. tracking

    var rProject = d3.scaleSqrt().domain([1, 4]).range([8.5 * SF, 13 * SF]);
    function nodeR(n) {
      if (n.kind === 'project') return rProject(n.degree);
      return (n.degree > 1 ? 6 : 4.2) * SF;
    }
    nodes.forEach(function (n) {
      n.r = nodeR(n);
      var charW = n.kind === 'project' ? projChar : techChar;
      var maxLine = 0;
      n.lines.forEach(function (l) { maxLine = Math.max(maxLine, l.length * charW); });
      n.labelHalfW = maxLine / 2;
      n.labelBelow = (n.kind === 'project' ? 16 : 12.5) * SF + (n.lines.length) * (n.kind === 'project' ? 14 : 12) * SF;
      n.collideR = Math.max(n.r + 16 * SF, n.labelHalfW + 8);
      // deterministic seed position near its cluster centroid
      var a = (n.kind === 'tech' ? (n.seed || 0) * 2.4 + 0.7 : 0);
      n.x = n.cx * width + (n.kind === 'tech' ? Math.cos(a) * 46 : 0);
      n.y = n.cy * height + (n.kind === 'tech' ? Math.sin(a) * 46 : 0);
      n.phase = (n.x * 13 + n.y * 7) % 6.283;       // deterministic drift phase
      n.speed = 0.28 + ((n.phase * 5) % 1) * 0.3;
    });

    /* svg scaffold */
    var svg = d3.select(container).append('svg')
      .attr('role', 'group')
      .attr('aria-label', 'System map: six shipped projects connected to the technologies powering them. Shared nodes like Langgraph and Claude bridge the clusters.');

    var linkSel = svg.append('g').selectAll('line')
      .data(links).enter().append('line')
      .attr('class', 'sm-link pre')
      .attr('data-key', function (l) { return l.key; });

    var nodeSel = svg.append('g').selectAll('g')
      .data(nodes).enter().append('g')
      .attr('class', function (n) { return 'sm-node pre sm-node--' + n.kind; })
      .attr('data-id', function (n) { return n.id; })
      .attr('tabindex', 0)
      .attr('role', 'button')
      .attr('aria-label', function (n) {
        return n.kind === 'project'
          ? n.name + ', project built with ' + n.tech.join(', ')
          : n.name + ', used in ' + n.projects.join(' and ');
      });

    nodeSel.append('circle')
      .attr('class', 'sm-hit')
      .attr('r', function (n) { return Math.max(n.r + 10, coarse ? 24 : 16); });

    nodeSel.filter(function (n) { return n.kind === 'project'; })
      .append('circle')
      .attr('class', 'sm-ring')
      .attr('r', function (n) { return n.r + 5; });

    nodeSel.append('circle')
      .attr('class', 'sm-core')
      .attr('r', function (n) { return n.r; });

    nodeSel.append('text')
      .attr('class', function (n) { return 'sm-label sm-label--' + n.kind; })
      .style('font-family', function (n) {
        return n.kind === 'project'
          ? '"Geist",system-ui,sans-serif'
          : '"Geist Mono",ui-monospace,monospace';
      })
      .style('font-size', function (n) { return (n.kind === 'project' ? projFont : techFont) + 'px'; })
      .each(function (n) {
        var t = d3.select(this);
        var lh = (n.kind === 'project' ? 14 : 12) * SF;
        var y0 = n.r + (n.kind === 'project' ? 16 : 12.5) * SF;
        n.lines.forEach(function (line, i) {
          t.append('tspan').attr('x', 0).attr('y', y0 + i * lh + lh * 0.55).text(line);
        });
      });

    /* legend + detail line */
    var legend = document.createElement('div');
    legend.className = 'sysmap-legend';
    legend.setAttribute('aria-hidden', 'true');
    legend.innerHTML = '<span class="lg-p"><i></i>project</span><span class="lg-t"><i></i>technology</span>';
    container.appendChild(legend);

    var detail = document.createElement('div');
    detail.className = 'sysmap-detail';
    detail.setAttribute('aria-live', 'polite');
    container.appendChild(detail);

    /* ---- simulation ---- */
    var pad = 8;
    function boundsForce() {
      nodes.forEach(function (n) {
        var lw = Math.max(n.labelHalfW, n.r) + pad;
        var minX = lw, maxX = width - lw;
        var minY = n.r + pad + 4, maxY = height - n.labelBelow - pad - (small ? 50 : 26);
        if (n.x < minX) { n.x = minX; n.vx = Math.abs(n.vx) * 0.3; }
        if (n.x > maxX) { n.x = maxX; n.vx = -Math.abs(n.vx) * 0.3; }
        if (n.y < minY) { n.y = minY; n.vy = Math.abs(n.vy) * 0.3; }
        if (n.y > maxY) { n.y = maxY; n.vy = -Math.abs(n.vy) * 0.3; }
      });
    }

    var sim = d3.forceSimulation(nodes)
      .force('link', d3.forceLink(links).id(function (n) { return n.id; })
        .distance(function (l) { return 58 * SF + l.target.labelHalfW * 0.35; })
        .strength(0.55))
      .force('charge', d3.forceManyBody().strength(-170 * SF))
      .force('x', d3.forceX(function (n) { return n.cx * width; })
        .strength(function (n) { return n.kind === 'project' ? 0.14 : 0.05; }))
      .force('y', d3.forceY(function (n) { return n.cy * height; })
        .strength(function (n) { return n.kind === 'project' ? 0.16 : 0.05; }))
      .force('collide', d3.forceCollide(function (n) { return n.collideR; }).strength(1).iterations(3))
      .force('bounds', boundsForce)
      .stop();

    function settle() {
      sim.alphaDecay(0.0228).velocityDecay(0.4).alpha(1);
      for (var i = 0; i < 320 && sim.alpha() > 0.004; i++) sim.tick();
      sim.alphaDecay(0).velocityDecay(0.55).alpha(0.05);
    }
    settle();

    function redraw() {
      linkSel
        .attr('x1', function (l) { return l.source.x; })
        .attr('y1', function (l) { return l.source.y; })
        .attr('x2', function (l) { return l.target.x; })
        .attr('y2', function (l) { return l.target.y; });
      nodeSel.attr('transform', function (n) {
        return 'translate(' + n.x + ',' + n.y + ')';
      });
    }
    redraw();

    /* ---- focus chain ---- */
    var focusedId = null;
    function setFocus(id) {
      if (id === focusedId) return;
      focusedId = id;
      if (!id) {
        container.classList.remove('is-focused');
        nodeSel.classed('is-on', false);
        linkSel.classed('is-on', false);
        detail.classList.remove('is-visible');
        return;
      }
      container.classList.add('is-focused');
      var near = adj[id] || {}, keys = linkKeys[id] || {};
      nodeSel.classed('is-on', function (n) { return !!near[n.id]; });
      linkSel.classed('is-on', function (l) { return !!keys[l.key]; });
      var n = nodes.find(function (x) { return x.id === id; });
      if (n) {
        var rest = n.kind === 'project' ? n.tech.join(' · ') : n.projects.join(' · ');
        detail.innerHTML = '<span class="d-name"></span><span class="d-rest"></span>';
        detail.firstChild.textContent = n.name;
        detail.lastChild.textContent = ' — ' + rest;
        detail.classList.add('is-visible');
      }
    }

    /* ---- interaction ---- */
    var destroyed = false;
    function onEnter(e, n) { if (!coarse) setFocus(n.id); }
    function onLeave() { if (!coarse) setFocus(null); }
    function onTap(e, n) {
      if (!coarse) return;
      e.stopPropagation();
      setFocus(focusedId === n.id ? null : n.id);
    }
    function onBgTap() { if (coarse) setFocus(null); }
    function onKey(e) { if (e.key === 'Escape') setFocus(null); }
    function onFocusIn(e, n) { if (!coarse) setFocus(n.id); }
    function onFocusOut() { if (!coarse) setFocus(null); }

    nodeSel
      .on('pointerenter', onEnter)
      .on('pointerleave', onLeave)
      .on('click', onTap)
      .on('focus', onFocusIn)
      .on('blur', onFocusOut);
    svg.on('click', onBgTap);
    container.addEventListener('keydown', onKey);

    /* drag (desktop, motion allowed) */
    if (!isStatic) {
      nodeSel.call(d3.drag()
        .on('start', function (e, n) { sim.alpha(0.35); n.fx = n.x; n.fy = n.y; })
        .on('drag', function (e, n) { sim.alpha(0.35); n.fx = e.x; n.fy = e.y; })
        .on('end', function (e, n) { n.fx = null; n.fy = null; sim.alpha(0.08); }));
    }

    /* ---- idle drift loop ---- */
    var rafId = 0, running = false, userPaused = false, inView = true;
    var t0 = (typeof performance !== 'undefined' ? performance.now() : 0);

    function frame(now) {
      rafId = 0;
      if (!running) return;
      var t = (now - t0) / 1000;
      for (var i = 0; i < nodes.length; i++) {
        var n = nodes[i];
        if (n.fx != null) continue;
        n.vx += Math.sin(t * n.speed + n.phase) * 0.012;
        n.vy += Math.cos(t * n.speed * 0.85 + n.phase * 1.7) * 0.012;
      }
      sim.alpha(Math.max(0.05, sim.alpha() * 0.96));
      sim.tick();
      redraw();
      rafId = requestAnimationFrame(frame);
    }

    function updateRunning() {
      var should = !destroyed && !isStatic && !userPaused && inView && !document.hidden;
      if (should && !running) {
        running = true;
        if (!rafId) rafId = requestAnimationFrame(frame);
      } else if (!should && running) {
        running = false;
        if (rafId) { cancelAnimationFrame(rafId); rafId = 0; }
      }
    }

    function onVisibility() { updateRunning(); }
    document.addEventListener('visibilitychange', onVisibility);

    var io = null;
    if ('IntersectionObserver' in window) {
      var revealed = false;
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          inView = en.isIntersecting;
          if (en.isIntersecting && !revealed) { revealed = true; reveal(); }
          updateRunning();
        });
      }, { threshold: 0.12 });
      io.observe(container);
    } else {
      inView = true; reveal();
    }

    /* entrance: staggered fade, once */
    var revealTimer = 0;
    function reveal() {
      if (reduced) {
        nodeSel.classed('pre', false);
        linkSel.classed('pre', false);
        updateRunning();
        return;
      }
      nodeSel.each(function (n, i) {
        this.style.transition = 'opacity .55s ease ' + (i * 26) + 'ms';
      });
      linkSel.each(function (l, i) {
        this.style.transition = 'opacity .6s ease ' + (240 + i * 12) + 'ms';
      });
      // force a style flush so the transition runs
      void container.offsetWidth;
      nodeSel.classed('pre', false);
      linkSel.classed('pre', false);
      revealTimer = window.setTimeout(function () {
        nodeSel.each(function () { this.style.transition = ''; });
        linkSel.each(function () { this.style.transition = ''; });
      }, 240 + links.length * 12 + 700);
      updateRunning();
    }

    /* ---- resize ---- */
    var ro = null, resizeTimer = 0, lastW = width;
    function applySize() {
      var w = Math.max(320, container.clientWidth || width);
      if (Math.abs(w - lastW) < 8) return;
      lastW = w; width = w;
      sim.force('x', d3.forceX(function (n) { return n.cx * width; })
        .strength(function (n) { return n.kind === 'project' ? 0.14 : 0.05; }));
      settle();
      redraw();
    }
    if ('ResizeObserver' in window) {
      ro = new ResizeObserver(function () {
        window.clearTimeout(resizeTimer);
        resizeTimer = window.setTimeout(applySize, 140);
      });
      ro.observe(container);
    }

    updateRunning();

    /* ---- public api ---- */
    return {
      pause: function () { userPaused = true; updateRunning(); },
      resume: function () { userPaused = false; updateRunning(); },
      destroy: function () {
        destroyed = true;
        running = false;
        if (rafId) cancelAnimationFrame(rafId);
        window.clearTimeout(revealTimer);
        window.clearTimeout(resizeTimer);
        if (io) io.disconnect();
        if (ro) ro.disconnect();
        document.removeEventListener('visibilitychange', onVisibility);
        container.removeEventListener('keydown', onKey);
        sim.stop();
        svg.remove();
        if (legend.parentNode) legend.parentNode.removeChild(legend);
        if (detail.parentNode) detail.parentNode.removeChild(detail);
        container.classList.remove('sysmap-root', 'is-focused');
      }
    };
  }

  window.initSysMap = initSysMap;
})();
