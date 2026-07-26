/* viz-timeline.js — arc publications + career timeline
   window.initTimeline(container, opts) -> { reveal, destroy, pause, resume }
   Requires: d3 v7 global. Fonts: Geist / Geist Mono / Instrument Serif (host page @font-face). */
(function () {
  'use strict';

  var COL = {
    bg: '#08080A',
    fg: '#F7F6F3',
    muted: '#8E8E97',
    mint: '#7EE7B0',
    cream: '#E8DFC9'
  };

  var T0 = 2024.0, T1 = 2026.75;

  var PUBS = [
    { id: 'icaaic', t: 2024.30, year: '2024', venue: 'ICAAIC', kind: 'ieee',
      title: 'AWS Cryptojacking', sub: 'IEEE conference paper', lab: 50 },
    { id: 'icssas', t: 2024.65, year: '2024', venue: 'ICSSAS', kind: 'ieee',
      title: 'Cloud Security', sub: 'IEEE conference paper', lab: 70 },
    { id: 'tdsc', t: 2026.08, year: '2026', venue: 'IEEE TDSC', kind: 'tdsc',
      title: 'Package Hallucinations', sub: 'IEEE Trans. Dependable & Secure Computing', lab: 88 },
    { id: 'kspret', t: 2026.28, year: '2026', venue: 'arXiv', kind: 'arxiv',
      title: 'KS-PRET-5M', sub: 'arXiv preprint · corpus release', lab: 40 },
    { id: 'diac', t: 2026.44, year: '2026', venue: 'arXiv', kind: 'arxiv',
      title: 'Koshur Diacritizer', sub: 'arXiv preprint', lab: 112 },
    { id: 'pixel', t: 2026.60, year: '2026', venue: 'arXiv', kind: 'arxiv',
      title: 'Koshur Pixel', sub: 'arXiv preprint', lab: 62 }
  ];

  var ROLES = [
    { id: 'cm', t0: 2024.29, t1: 2024.71, label: 'CREDITMITRA · INTERN' },
    { id: 'nb1', t0: 2024.94, t1: 2025.99, label: 'NBYULA · INTERN' },
    { id: 'nb2', t0: 2026.02, t1: 2026.72, label: 'NBYULA · SDE 1', now: true }
  ];

  var YEARS = [2024, 2025, 2026];

  var STYLE_ID = 'vtl-style';
  var CSS = [
    '.vtl{position:relative;width:100%;height:420px;background:transparent;',
    '  font-family:"Geist",-apple-system,system-ui,sans-serif;color:' + COL.fg + ';}',
    '.vtl svg{display:block;width:100%;height:100%;touch-action:pan-y;overflow:visible;}',
    '.vtl-stat{position:absolute;top:14px;left:6px;pointer-events:none;user-select:none;}',
    '.vtl-stat-num{font-weight:600;font-size:46px;line-height:1;letter-spacing:-0.02em;',
    '  font-variant-numeric:tabular-nums;color:' + COL.fg + ';}',
    '.vtl-stat-lab{margin-top:8px;font-family:"Geist Mono",ui-monospace,monospace;font-size:10.5px;',
    '  letter-spacing:0.14em;text-transform:uppercase;color:' + COL.muted + ';}',
    '.vtl-stat-sub{margin-top:4px;font-family:"Geist Mono",ui-monospace,monospace;font-size:10.5px;',
    '  letter-spacing:0.14em;text-transform:uppercase;color:' + COL.cream + ';opacity:0.85;}',
    '.vtl-panel{position:absolute;top:16px;right:6px;text-align:right;min-height:64px;min-width:220px;',
    '  pointer-events:none;user-select:none;}',
    '.vtl-legend{display:flex;gap:18px;justify-content:flex-end;align-items:center;',
    '  font-family:"Geist Mono",ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;',
    '  text-transform:uppercase;color:' + COL.muted + ';transition:opacity 160ms ease;}',
    '.vtl-legend i{display:inline-block;width:8px;height:8px;border-radius:50%;margin-right:7px;',
    '  vertical-align:0;}',
    '.vtl-legend .l-ieee i{background:' + COL.cream + ';}',
    '.vtl-legend .l-tdsc i{background:' + COL.mint + ';}',
    '.vtl-legend .l-arxiv i{background:transparent;box-shadow:inset 0 0 0 1.4px ' + COL.muted + ';}',
    '.vtl-detail{position:absolute;inset:0 0 auto auto;opacity:0;transform:translateY(4px);',
    '  transition:opacity 160ms ease,transform 160ms ease;text-align:right;}',
    '.vtl.is-detail .vtl-legend{opacity:0;}',
    '.vtl.is-detail .vtl-detail{opacity:1;transform:none;}',
    '.vtl-detail-meta{font-family:"Geist Mono",ui-monospace,monospace;font-size:10px;',
    '  letter-spacing:0.14em;text-transform:uppercase;color:' + COL.muted + ';}',
    '.vtl-detail-meta.is-mint{color:' + COL.mint + ';}',
    '.vtl-detail-title{margin-top:6px;font-family:"Instrument Serif",Georgia,serif;font-style:italic;',
    '  font-size:21px;line-height:1.15;color:' + COL.fg + ';}',
    '.vtl-detail-sub{margin-top:5px;font-size:11px;color:' + COL.muted + ';letter-spacing:0.02em;}',
    '.vtl circle.vtl-node{cursor:pointer;outline:none;}',
    '.vtl circle.vtl-node:focus-visible{stroke:' + COL.fg + ';stroke-width:1.5px;}',
    /* ---- mobile vertical list ---- */
    '.vtl.vtl-mobile{height:auto;min-height:0;}',
    '.vtl-m{position:relative;padding:8px 4px 8px 0;}',
    '.vtl-m-head{margin-bottom:22px;}',
    '.vtl-m-list{list-style:none;margin:0;padding:0;position:relative;}',
    '.vtl-m-list::before{content:"";position:absolute;left:5px;top:6px;bottom:6px;width:1px;',
    '  background:rgba(247,246,243,0.14);}',
    '.vtl-m-item{position:relative;padding:0 0 18px 26px;opacity:1;}',
    '.vtl-m-item .dot{position:absolute;left:0;top:4px;width:11px;height:11px;border-radius:50%;',
    '  background:' + COL.cream + ';box-shadow:0 0 0 3px ' + COL.bg + ';}',
    '.vtl-m-item.k-arxiv .dot{background:transparent;box-shadow:inset 0 0 0 1.4px ' + COL.muted +
    ',0 0 0 3px ' + COL.bg + ';}',
    '.vtl-m-item.k-tdsc .dot{background:' + COL.mint + ';box-shadow:0 0 0 3px ' + COL.bg +
    ',0 0 12px rgba(126,231,176,0.35);}',
    '.vtl-m-item.k-role .dot{width:7px;height:7px;left:2px;top:6px;background:rgba(142,142,151,0.55);}',
    '.vtl-m-meta{font-family:"Geist Mono",ui-monospace,monospace;font-size:10px;letter-spacing:0.12em;',
    '  text-transform:uppercase;color:' + COL.muted + ';}',
    '.vtl-m-item.k-tdsc .vtl-m-meta{color:' + COL.mint + ';}',
    '.vtl-m-title{margin-top:3px;font-family:"Instrument Serif",Georgia,serif;font-style:italic;',
    '  font-size:19px;line-height:1.2;color:' + COL.fg + ';}',
    '.vtl-m-item.k-role .vtl-m-title{display:none;}',
    '.vtl-m-item.k-role{padding-bottom:14px;}',
    '@media (prefers-reduced-motion: no-preference){',
    '  .vtl-m.pre .vtl-m-item{opacity:0;transform:translateY(10px);}',
    '  .vtl-m .vtl-m-item{transition:opacity 520ms ease,transform 520ms cubic-bezier(0.22,1,0.36,1);}',
    '}'
  ].join('\n');

  function ensureStyle() {
    if (!document.getElementById(STYLE_ID)) {
      var s = document.createElement('style');
      s.id = STYLE_ID;
      s.textContent = CSS;
      document.head.appendChild(s);
    }
  }

  function initTimeline(container, opts) {
    if (!container || typeof window.d3 === 'undefined') return null;
    opts = opts || {};
    var d3 = window.d3;
    ensureStyle();

    var reduced = window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var wrap = document.createElement('div');
    wrap.className = 'vtl';
    container.appendChild(wrap);

    var revealed = false;
    var paused = false;
    var destroyed = false;
    var mode = null;              // 'arc' | 'mobile'
    var svg = null, sel = {};     // d3 selections for arc mode
    var geo = null;               // current geometry
    var statNum = null;
    var io = null, ro = null, roTimer = null;
    var pulseTimers = [];

    /* ---------------- geometry ---------------- */
    function layout(w, h) {
      var mx = Math.max(46, w * 0.045);
      var chord = w - mx * 2;
      var sag = Math.min(92, Math.max(54, chord * 0.085));
      var R = (chord * chord / 4 + sag * sag) / (2 * sag);
      var A = Math.asin(Math.min(1, chord / (2 * R)));
      var apexY = Math.round(h * 0.42);
      var cx = w / 2, cy = apexY + R;
      function ang(t) { return -A + ((t - T0) / (T1 - T0)) * 2 * A; }
      function pos(t, off) {
        var a = ang(t), r = R + (off || 0);
        return { x: cx + r * Math.sin(a), y: cy - r * Math.cos(a), a: a };
      }
      function arcPath(ta, tb, off) {
        var p0 = pos(ta, off), p1 = pos(tb, off), r = R + (off || 0);
        return 'M' + p0.x.toFixed(2) + ' ' + p0.y.toFixed(2) +
          'A' + r.toFixed(2) + ' ' + r.toFixed(2) + ' 0 0 1 ' +
          p1.x.toFixed(2) + ' ' + p1.y.toFixed(2);
      }
      return { w: w, h: h, R: R, A: A, cx: cx, cy: cy, pos: pos, arcPath: arcPath };
    }

    /* ---------------- shared bits ---------------- */
    function statHTML() {
      return '<div class="vtl-stat-num"><span class="vtl-num">' +
        (reduced ? '06' : '00') + '</span></div>' +
        '<div class="vtl-stat-lab">Publications · 2024 — 2026</div>' +
        '<div class="vtl-stat-sub">4 of 6 in 2026</div>';
    }

    /* ---------------- arc (desktop) ---------------- */
    function renderArc(w) {
      mode = 'arc';
      wrap.classList.remove('vtl-mobile');
      wrap.innerHTML = '';
      var h = 420;
      geo = layout(w, h);
      var g = geo;

      var root = d3.select(wrap);

      var stat = root.append('div').attr('class', 'vtl-stat').html(statHTML());
      statNum = stat.select('.vtl-num');

      var panel = root.append('div').attr('class', 'vtl-panel');
      panel.append('div').attr('class', 'vtl-legend').html(
        '<span class="l-ieee"><i></i>IEEE</span>' +
        '<span class="l-tdsc"><i></i>IEEE TDSC · ’26</span>' +
        '<span class="l-arxiv"><i></i>arXiv</span>');
      var detail = panel.append('div').attr('class', 'vtl-detail');
      detail.append('div').attr('class', 'vtl-detail-meta');
      detail.append('div').attr('class', 'vtl-detail-title');
      detail.append('div').attr('class', 'vtl-detail-sub');

      svg = root.append('svg')
        .attr('viewBox', '0 0 ' + w + ' ' + h)
        .attr('role', 'group')
        .attr('aria-label',
          'Timeline, 2024 to 2026: six publications, four of them in 2026, ' +
          'alongside roles at CreditMitra and Nbyula.');

      var defs = svg.append('defs');
      var grad = defs.append('radialGradient').attr('id', 'vtl-mintglow');
      grad.append('stop').attr('offset', '0%').attr('stop-color', COL.mint).attr('stop-opacity', 0.22);
      grad.append('stop').attr('offset', '100%').attr('stop-color', COL.mint).attr('stop-opacity', 0);

      /* role spans (under the spine) */
      var gRoles = svg.append('g');
      ROLES.forEach(function (r) {
        var grp = gRoles.append('g').attr('class', 'vtl-role');
        var p = grp.append('path')
          .attr('d', g.arcPath(r.t0, r.t1, -34))
          .attr('fill', 'none')
          .attr('stroke', r.now ? 'rgba(232,223,201,0.42)' : 'rgba(142,142,151,0.30)')
          .attr('stroke-width', 2.5)
          .attr('stroke-linecap', 'round');
        r._path = p;
        var mid = g.pos((r.t0 + r.t1) / 2, -60);
        grp.append('text')
          .attr('x', mid.x).attr('y', mid.y + 4)
          .attr('text-anchor', 'middle')
          .attr('font-family', '"Geist Mono",ui-monospace,monospace')
          .attr('font-size', 9.5)
          .attr('letter-spacing', '0.12em')
          .attr('fill', r.now ? 'rgba(232,223,201,0.75)' : COL.muted)
          .attr('paint-order', 'stroke')
          .attr('stroke', COL.bg).attr('stroke-width', 4).attr('stroke-linejoin', 'round')
          .text(r.label + (r.now ? ' → NOW' : ''));
        r._grp = grp;
      });

      /* spine */
      var spine = svg.append('path')
        .attr('d', g.arcPath(T0, T1, 0))
        .attr('fill', 'none')
        .attr('stroke', 'rgba(247,246,243,0.20)')
        .attr('stroke-width', 1.5);

      /* hover highlight overlay */
      var hi = svg.append('path')
        .attr('fill', 'none')
        .attr('stroke', 'rgba(232,223,201,0.55)')
        .attr('stroke-width', 1.5)
        .attr('stroke-linecap', 'round')
        .style('opacity', 0);

      /* year ticks */
      var gTicks = svg.append('g');
      YEARS.forEach(function (y) {
        var a = g.pos(y, -5), b = g.pos(y, -14), lp = g.pos(y, -18);
        gTicks.append('line')
          .attr('x1', a.x).attr('y1', a.y).attr('x2', b.x).attr('y2', b.y)
          .attr('stroke', 'rgba(247,246,243,0.30)').attr('stroke-width', 1);
        gTicks.append('text')
          .attr('x', lp.x + (y === 2024 ? 14 : 0) - (y === 2026 ? 4 : 0))
          .attr('y', lp.y + 14)
          .attr('text-anchor', 'middle')
          .attr('font-family', '"Geist Mono",ui-monospace,monospace')
          .attr('font-size', 11)
          .attr('letter-spacing', '0.1em')
          .attr('fill', COL.muted)
          .attr('paint-order', 'stroke')
          .attr('stroke', COL.bg).attr('stroke-width', 4).attr('stroke-linejoin', 'round')
          .text(String(y));
      });

      /* publication nodes + callouts + labels */
      var gPubs = svg.append('g');
      PUBS.forEach(function (p, i) {
        var np = g.pos(p.t, 0);
        var tip = g.pos(p.t, p.lab);
        var start = g.pos(p.t, 9);
        var grp = gPubs.append('g').attr('class', 'vtl-pub').style('cursor', 'pointer');

        p._line = grp.append('line')
          .attr('x1', start.x).attr('y1', start.y)
          .attr('x2', tip.x).attr('y2', tip.y)
          .attr('stroke', 'rgba(247,246,243,0.20)')
          .attr('stroke-width', 1);

        var venueFill = p.kind === 'tdsc' ? COL.mint :
          (p.kind === 'ieee' ? 'rgba(232,223,201,0.85)' : COL.muted);
        p._venue = grp.append('text')
          .attr('x', tip.x).attr('y', tip.y - 24)
          .attr('text-anchor', 'middle')
          .attr('font-family', '"Geist Mono",ui-monospace,monospace')
          .attr('font-size', 9.5)
          .attr('font-weight', 500)
          .attr('letter-spacing', '0.14em')
          .attr('fill', venueFill)
          .attr('paint-order', 'stroke')
          .attr('stroke', COL.bg).attr('stroke-width', 4).attr('stroke-linejoin', 'round')
          .text((p.venue + ' · ' + p.year).toUpperCase());

        p._title = grp.append('text')
          .attr('x', tip.x).attr('y', tip.y - 8)
          .attr('text-anchor', 'middle')
          .attr('font-family', '"Instrument Serif",Georgia,serif')
          .attr('font-style', 'italic')
          .attr('font-size', 16)
          .attr('fill', COL.fg)
          .attr('paint-order', 'stroke')
          .attr('stroke', COL.bg).attr('stroke-width', 4).attr('stroke-linejoin', 'round')
          .text(p.title);

        if (p.kind === 'tdsc') {
          p._glow = grp.append('circle')
            .attr('cx', np.x).attr('cy', np.y).attr('r', 26)
            .attr('fill', 'url(#vtl-mintglow)');
          p._pulse = grp.append('circle')
            .attr('cx', np.x).attr('cy', np.y).attr('r', 7)
            .attr('fill', 'none')
            .attr('stroke', COL.mint)
            .style('opacity', 0);
        }

        var r0 = p.kind === 'tdsc' ? 6.5 : (p.kind === 'ieee' ? 5 : 4.5);
        p._r0 = r0;
        p._node = grp.append('circle')
          .attr('class', 'vtl-node')
          .attr('data-id', p.id)
          .attr('cx', np.x).attr('cy', np.y).attr('r', r0)
          .attr('fill', p.kind === 'tdsc' ? COL.mint :
            (p.kind === 'ieee' ? COL.cream : COL.bg))
          .attr('stroke', p.kind === 'arxiv' ? COL.muted : 'none')
          .attr('stroke-width', p.kind === 'arxiv' ? 1.5 : 0)
          .attr('tabindex', 0)
          .attr('role', 'button')
          .attr('aria-label', p.title + ' — ' + p.venue + ' ' + p.year);

        /* generous invisible hit area */
        grp.append('circle')
          .attr('cx', np.x).attr('cy', np.y).attr('r', 20)
          .attr('fill', 'transparent')
          .style('pointer-events', 'all')
          .on('pointerenter', function () { focusPub(p); })
          .on('pointerleave', function () { blurPub(); });
        p._node
          .on('focus', function () { focusPub(p); })
          .on('blur', function () { blurPub(); });

        p._grp = grp;
        p._np = np;
      });

      clampLabels(w);
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(function () {
          if (!destroyed && mode === 'arc') clampLabels(w);
        });
      }

      sel = { spine: spine, hi: hi, gTicks: gTicks, gPubs: gPubs, gRoles: gRoles,
              stat: stat, panel: panel, detail: detail };

      function focusPub(p) {
        if (!revealed) return;
        wrap.classList.add('is-detail');
        detail.select('.vtl-detail-meta')
          .attr('class', 'vtl-detail-meta' + (p.kind === 'tdsc' ? ' is-mint' : ''))
          .text((p.venue + ' · ' + p.year).toUpperCase());
        detail.select('.vtl-detail-title').text(p.title);
        detail.select('.vtl-detail-sub').text(p.sub);
        PUBS.forEach(function (q) {
          q._grp.transition('dim').duration(140)
            .style('opacity', q === p ? 1 : 0.28);
        });
        p._grp.raise();
        p._node.transition('r').duration(160).attr('r', p._r0 * 1.3);
        var d = geo.arcPath(T0, p.t, 0);
        hi.attr('d', d);
        var L = hi.node().getTotalLength();
        hi.attr('stroke-dasharray', L + ' ' + L)
          .attr('stroke-dashoffset', L)
          .style('opacity', 1)
          .transition('draw').duration(260).ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
      }
      function blurPub() {
        wrap.classList.remove('is-detail');
        PUBS.forEach(function (q) {
          q._grp.transition('dim').duration(240).style('opacity', 1);
          q._node.transition('r').duration(200).attr('r', q._r0);
        });
        hi.transition('draw').duration(180).style('opacity', 0);
      }

      if (revealed || reduced) {
        /* final frame */
        if (reduced) revealed = true;
        if (revealed) statNum.text('06');
      } else {
        hideForReveal();
      }
    }

    function clampLabels(w) {
      PUBS.forEach(function (p) {
        [p._venue, p._title].forEach(function (t) {
          if (!t) return;
          t.attr('dx', 0);
          var bb = t.node().getBBox();
          var over = (bb.x + bb.width) - (w - 8);
          var under = 8 - bb.x;
          if (over > 0) t.attr('dx', -over);
          else if (under > 0) t.attr('dx', under);
        });
      });
    }

    function hideForReveal() {
      var L = sel.spine.node().getTotalLength();
      sel.spine.attr('stroke-dasharray', L + ' ' + L).attr('stroke-dashoffset', L);
      ROLES.forEach(function (r) {
        var l = r._path.node().getTotalLength();
        r._path.attr('stroke-dasharray', l + ' ' + l).attr('stroke-dashoffset', l);
        r._grp.select('text').style('opacity', 0);
      });
      sel.gTicks.style('opacity', 0);
      PUBS.forEach(function (p) {
        p._node.attr('r', 0);
        p._line.style('opacity', 0);
        p._venue.style('opacity', 0);
        p._title.style('opacity', 0).attr('transform', 'translate(0,6)');
        if (p._glow) p._glow.style('opacity', 0);
      });
      sel.panel.select('.vtl-legend').style('opacity', 0);
      sel.stat.style('opacity', 0);
    }

    function playReveal() {
      var d3 = window.d3;
      sel.stat.transition().duration(500).style('opacity', 1);
      /* count-up 00 -> 06 */
      var ease = d3.easeCubicOut;
      var timer = d3.timer(function (el) {
        var k = Math.min(1, el / 900);
        var v = Math.round(ease(k) * 6);
        statNum.text((v < 10 ? '0' : '') + v);
        if (k >= 1) timer.stop();
      });

      sel.spine.transition().duration(1100).ease(d3.easeCubicInOut)
        .attr('stroke-dashoffset', 0);

      ROLES.forEach(function (r, i) {
        r._path.transition().delay(350 + i * 140).duration(700).ease(d3.easeCubicOut)
          .attr('stroke-dashoffset', 0);
        r._grp.select('text').transition().delay(600 + i * 140).duration(500)
          .style('opacity', 1);
      });

      sel.gTicks.transition().delay(500).duration(600).style('opacity', 1);

      PUBS.forEach(function (p, i) {
        var d0 = 420 + i * 110;
        p._node.transition().delay(d0).duration(450).ease(d3.easeBackOut.overshoot(2.2))
          .attr('r', p._r0);
        p._line.transition().delay(d0 + 90).duration(400).style('opacity', 1);
        p._venue.transition().delay(d0 + 160).duration(450).style('opacity', 1);
        p._title.transition().delay(d0 + 160).duration(500).ease(d3.easeCubicOut)
          .style('opacity', 1).attr('transform', 'translate(0,0)');
        if (p._glow) p._glow.transition().delay(d0).duration(700).style('opacity', 1);
      });

      sel.panel.select('.vtl-legend').transition().delay(900).duration(500)
        .style('opacity', 1)
        .on('end', function () { d3.select(this).style('opacity', null); });

      /* one gentle double-pulse on the TDSC node, then stop (no loops) */
      var tdsc = PUBS.filter(function (p) { return p.kind === 'tdsc'; })[0];
      if (tdsc && tdsc._pulse) {
        [1650, 2500].forEach(function (when) {
          pulseTimers.push(setTimeout(function () {
            if (destroyed || paused) return;
            tdsc._pulse
              .attr('r', 7).style('opacity', 0.6)
              .transition().duration(900).ease(d3.easeCubicOut)
              .attr('r', 22).style('opacity', 0);
          }, when));
        });
      }
    }

    /* ---------------- mobile vertical list ---------------- */
    function renderMobile() {
      mode = 'mobile';
      wrap.classList.add('vtl-mobile');
      wrap.innerHTML = '';
      var events = [
        { k: 'ieee', meta: 'ICAAIC · 2024', title: 'AWS Cryptojacking' },
        { k: 'role', meta: 'CREDITMITRA · INTERN · APR–SEP 2024' },
        { k: 'ieee', meta: 'ICSSAS · 2024', title: 'Cloud Security' },
        { k: 'role', meta: 'NBYULA · INTERN · DEC 2024' },
        { k: 'role', meta: 'NBYULA · SDE 1 · JAN 2026 → NOW' },
        { k: 'tdsc', meta: 'IEEE TDSC · 2026', title: 'Package Hallucinations' },
        { k: 'arxiv', meta: 'ARXIV · 2026', title: 'KS-PRET-5M' },
        { k: 'arxiv', meta: 'ARXIV · 2026', title: 'Koshur Diacritizer' },
        { k: 'arxiv', meta: 'ARXIV · 2026', title: 'Koshur Pixel' }
      ];
      var html = '<div class="vtl-m' + ((revealed || reduced) ? '' : ' pre') + '">' +
        '<div class="vtl-m-head vtl-stat" style="position:static;">' + statHTML() + '</div>' +
        '<ol class="vtl-m-list">' +
        events.map(function (e) {
          return '<li class="vtl-m-item k-' + e.k + '"><span class="dot"></span>' +
            '<div class="vtl-m-meta">' + e.meta + '</div>' +
            (e.title ? '<div class="vtl-m-title">' + e.title + '</div>' : '') +
            '</li>';
        }).join('') + '</ol></div>';
      wrap.innerHTML = html;
      statNum = d3.select(wrap).select('.vtl-num');
      if (revealed || reduced) { revealed = true; statNum.text('06'); }
    }

    function playRevealMobile() {
      var m = wrap.querySelector('.vtl-m');
      if (!m) return;
      var items = m.querySelectorAll('.vtl-m-item');
      items.forEach(function (li, i) {
        li.style.transitionDelay = (i * 70) + 'ms';
      });
      /* force a frame so the .pre state paints first */
      requestAnimationFrame(function () {
        requestAnimationFrame(function () { m.classList.remove('pre'); });
      });
      var ease = d3.easeCubicOut;
      var timer = d3.timer(function (el) {
        var k = Math.min(1, el / 900);
        var v = Math.round(ease(k) * 6);
        statNum.text((v < 10 ? '0' : '') + v);
        if (k >= 1) timer.stop();
      });
    }

    /* ---------------- render dispatch ---------------- */
    function render() {
      if (destroyed) return;
      var w = wrap.clientWidth || container.clientWidth || 1200;
      if (w < 640) renderMobile();
      else renderArc(w);
    }

    /* ---------------- public API ---------------- */
    function reveal() {
      if (revealed || destroyed) return;
      revealed = true;
      if (reduced) {
        if (mode === 'arc') { render(); }
        if (statNum) statNum.text('06');
        return;
      }
      if (mode === 'arc') playReveal();
      else playRevealMobile();
    }

    function pause() { paused = true; }
    function resume() { paused = false; }

    function destroy() {
      destroyed = true;
      pulseTimers.forEach(clearTimeout);
      if (io) io.disconnect();
      if (ro) ro.disconnect();
      if (roTimer) clearTimeout(roTimer);
      d3.select(wrap).selectAll('*').interrupt();
      if (wrap.parentNode) wrap.parentNode.removeChild(wrap);
    }

    /* ---------------- boot ---------------- */
    render();

    if (reduced) {
      revealed = true;
      if (statNum) statNum.text('06');
    } else if (opts.autoReveal !== false && 'IntersectionObserver' in window) {
      io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (e.isIntersecting && e.intersectionRatio > 0.3 && !paused) {
            reveal();
            io.disconnect();
            io = null;
          }
        });
      }, { threshold: [0, 0.35] });
      io.observe(wrap);
    }

    if ('ResizeObserver' in window) {
      var lastW = wrap.clientWidth;
      ro = new ResizeObserver(function () {
        var w = wrap.clientWidth;
        if (Math.abs(w - lastW) < 4) return;   /* ignore height-only / jitter */
        lastW = w;
        if (roTimer) clearTimeout(roTimer);
        roTimer = setTimeout(function () {
          if (destroyed) return;
          var wasRevealed = revealed;
          render();
          if (wasRevealed && statNum) statNum.text('06');
          if (wasRevealed && mode === 'arc') {
            /* re-rendered in final state already (revealed => no hide) */
          }
        }, 140);
      });
      ro.observe(wrap);
    }

    return { reveal: reveal, destroy: destroy, pause: pause, resume: resume };
  }

  window.initTimeline = initTimeline;
})();
