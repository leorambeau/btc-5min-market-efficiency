/* Figures, timeline, scroll-spy and the interactive replay widget.
   Numbers come from data/reports_v2/train_v2.log and replay_sessions.py output.
   window.BETS = [[p_mid, won, second_in_window, direction], ...]  (156 executable bets, one per window). */
(function () {
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  let T;  // theme
  function theme() {
    T = { ink: css('--ink'), body: css('--body'), muted: css('--muted'), line: css('--line'), accent: css('--accent'), warn: css('--warn'), neg: '#d14343' };
  }
  const baseLayout = () => ({
    paper_bgcolor: 'rgba(0,0,0,0)', plot_bgcolor: 'rgba(0,0,0,0)',
    font: { family: 'Inter, system-ui, sans-serif', size: 12.5, color: T.body },
    margin: { l: 58, r: 22, t: 14, b: 54 }, showlegend: false
  });
  const cfg = { displayModeBar: false, responsive: true };
  const grid = () => ({ gridcolor: T.line, zerolinecolor: T.line, linecolor: T.line, tickcolor: T.line });
  const axis = o => Object.assign({ gridcolor: T.line, zeroline: false, linecolor: T.line }, o);
  const L = o => Object.assign(baseLayout(), o);
  const draw = (id, data, layout) => { const el = document.getElementById(id); if (el) Plotly.react(el, data, layout, cfg); };

  /* ── timeline (Figure 1) ── */
  const rail = document.getElementById('fig-rail');
  if (rail) {
    const ev = [
      ['mid-Feb 2026', 'Polymarket launches 5-minute Bitcoin Up/Down markets (press reports cite 13 Feb)', true],
      ['1 Mar 2026', 'Start of the 1-second Binance bar history used for training', false],
      ['15–23 Apr 2026', 'Held-out test window: 73.24% accuracy, AUC 0.823', false],
      ['14–17 May 2026', 'Live-simulation sessions: 839 bets across 162 windows', true],
      ['Apr–Sep 2026', 'Monthly profile of pre-resolution volume (exploratory)', false]
    ];
    rail.innerHTML = ev.map(e => '<div class="ev' + (e[2] ? ' key' : '') + '"><span class="d">' + e[0] + '</span><span class="t">' + e[1] + '</span></div>').join('');
  }

  /* ── scroll-spy for the contents rail ── */
  const links = [...document.querySelectorAll('.toc a')];
  const secs = links.map(a => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if ('IntersectionObserver' in window && secs.length) {
    const io = new IntersectionObserver(es => {
      es.forEach(e => { if (e.isIntersecting) { links.forEach(l => l.classList.toggle('on', l.getAttribute('href') === '#' + e.target.id)); } });
    }, { rootMargin: '-20% 0px -70% 0px' });
    secs.forEach(s => io.observe(s));
  }

  /* ── replay maths ── */
  const BETS = window.BETS || [];
  const rng = (function (a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })(42);
  const pnl = (b, spread, feeRate) => { const ask = Math.min(b[0] + spread, 0.99); return (b[1] ? (1 / ask - 1) : -1) - feeRate * (1 - ask); };
  function bootstrap(vals, draws) {
    const n = vals.length, means = [];
    for (let d = 0; d < draws; d++) { let s = 0; for (let i = 0; i < n; i++) s += vals[(rng() * n) | 0]; means.push(s / n); }
    means.sort((a, b) => a - b);
    return [means[Math.floor(draws * 0.025)], means[Math.floor(draws * 0.975)]];
  }
  const fmt = v => (v >= 0 ? '+' : '') + (100 * v).toFixed(1) + '%';

  function renderSim() {
    if (!BETS.length) return;
    const sp = parseFloat(document.getElementById('s-spread').value) / 100;
    const fr = parseFloat(document.getElementById('s-fee').value);
    document.getElementById('v-spread').textContent = (sp * 100).toFixed(1) + '¢';
    document.getElementById('v-fee').textContent = fr.toFixed(3);
    const vals = BETS.map(b => pnl(b, sp, fr));
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const [l, h] = bootstrap(vals, 1000);
    document.getElementById('r-roi').textContent = fmt(mean);
    document.getElementById('r-ci').textContent = '[' + fmt(l) + ', ' + fmt(h) + ']';
    const v = document.getElementById('r-verdict');
    if (l > 0) { v.textContent = 'Above zero'; v.className = 'pos'; }
    else if (h < 0) { v.textContent = 'Below zero'; v.className = 'neg'; }
    else { v.textContent = 'Not distinguishable from 0'; v.className = 'neu'; }
    let cum = 0; const cumulative = vals.map(x => (cum += x));
    draw('chart-sim', [{ x: cumulative.map((_, i) => i + 1), y: cumulative, type: 'scatter', mode: 'lines', line: { color: T.accent, width: 2 },
      fill: 'tozeroy', fillcolor: T.accent + '1a', hovertemplate: 'window %{x}<br>%{y:.2f} units<extra></extra>' }],
      L({ margin: { l: 50, r: 18, t: 8, b: 46 }, xaxis: axis({ title: 'Window (chronological)' }), yaxis: axis({ title: 'Cumulative P&L' }) }));
  }

  function renderAll() {
    theme();
    /* Fig 3 accuracy */
    const pos = ['0–60 s', '60–120 s', '120–180 s', '180–240 s', '240–300 s'];
    const acc = [58.0, 67.3, 73.1, 78.6, 87.8], auc = [0.630, 0.740, 0.808, 0.873, 0.945];
    draw('chart-accuracy', [
      { x: pos, y: acc, type: 'bar', marker: { color: T.accent }, text: acc.map(v => v.toFixed(1) + '%'), textposition: 'outside', cliponaxis: false, hovertemplate: '%{x}<br>accuracy %{y:.1f}%<extra></extra>' },
      { x: pos, y: auc, type: 'scatter', mode: 'lines+markers', yaxis: 'y2', line: { color: T.ink, width: 2 }, marker: { size: 7, color: T.ink }, hovertemplate: '%{x}<br>AUC %{y:.3f}<extra></extra>' }
    ], L({
      margin: { l: 56, r: 56, t: 22, b: 50 }, xaxis: axis({ title: 'Position in the window', showgrid: false }),
      yaxis: axis({ title: 'Accuracy (%)', range: [40, 100] }),
      yaxis2: { title: 'AUC', overlaying: 'y', side: 'right', range: [0.5, 1.0], showgrid: false, linecolor: T.line },
      shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 51, y1: 51, line: { color: T.muted, dash: 'dot', width: 1 } }],
      annotations: [{ xref: 'paper', x: 0.005, y: 51, yanchor: 'bottom', xanchor: 'left', text: '51% baseline', showarrow: false, font: { size: 11, color: T.muted } }]
    }));

    /* Fig 4 fee */
    const ps = [], fee = [];
    for (let p = 0.05; p <= 0.951; p += 0.01) { ps.push(+p.toFixed(2)); fee.push(+(7 * (1 - p)).toFixed(2)); }
    draw('chart-fee', [{ x: ps, y: fee, type: 'scatter', mode: 'lines', line: { color: T.accent, width: 2 }, fill: 'tozeroy', fillcolor: T.accent + '1a', hovertemplate: 'price %{x}<br>fee %{y:.2f}% of stake<extra></extra>' }],
      L({ xaxis: axis({ title: 'Token price p', tickformat: '.1f' }), yaxis: axis({ title: 'Fee (% of stake)', ticksuffix: '%', range: [0, 7.5] }) }));

    /* Fig 5 funnel */
    const steps = ['As logged (Kelly, mid, no fees)', 'a) Unit stake', 'b) One bet per window', 'c) Executable odds', 'd) 1¢ half-spread', 'e) Taker fee'];
    const roi = [32.6, 31.7, 73.5, 30.8, 26.7, 22.6];
    const lo = [null, -0.6, 27.8, 6.7, 3.2, -1.9], hi = [null, 69.0, 126.5, 58.0, 51.5, 46.7];
    draw('chart-funnel', [{
      y: steps.map((s, i) => s + '  <b>+' + roi[i].toFixed(1) + '%</b>'), x: roi, type: 'bar', orientation: 'h',
      marker: { color: roi.map((v, i) => i === 0 ? T.muted : T.accent),
        pattern: { shape: roi.map((v, i) => (i > 0 && lo[i] <= 0) ? '/' : ''), bgcolor: roi.map((v, i) => i === 0 ? T.muted : T.accent), fgcolor: 'rgba(255,255,255,.5)', size: 7, solidity: 0.4 } },
      error_x: { type: 'data', symmetric: false, array: hi.map((h, i) => h === null ? 0 : h - roi[i]), arrayminus: lo.map((l, i) => l === null ? 0 : roi[i] - l), color: T.ink, thickness: 1.4, width: 5 },
      hovertemplate: '%{y}<br>return %{x:.1f}%<extra></extra>'
    }], L({
      margin: { l: 250, r: 22, t: 8, b: 52 }, xaxis: axis({ title: 'Return per $ staked (%), error bars = 95% CI', range: [-10, 135] }),
      yaxis: { autorange: 'reversed', linecolor: T.line },
      shapes: [{ type: 'line', x0: 0, x1: 0, yref: 'paper', y0: 0, y1: 1, line: { color: T.ink, width: 1 } }]
    }));

    /* Fig 6 buckets */
    const bkRoi = [988.1, 51.2, 15.6, 18.2, -16.3];
    const bkName = ['< 0.10 (n=8)', '0.10–0.30 (n=47)', '0.30–0.50 (n=66)', '0.50–0.70 (n=36)', '0.70–0.90 (n=5)'];
    const bkLo = [404.8, -5.3, -13.3, -10.0, -72.4], bkHi = [1613.1, 114.9, 44.7, 43.7, 39.9];
    draw('chart-buckets', [{
      x: bkName.map((s, i) => s + '<br><b>' + (bkRoi[i] > 0 ? '+' : '') + bkRoi[i].toFixed(0) + '%</b>'), y: bkRoi.map((v, i) => i === 0 ? 130 : v), type: 'bar',
      marker: { color: bkRoi.map((v, i) => i === 0 ? T.muted : (v < 0 ? T.neg : T.accent)) },
      error_y: { type: 'data', symmetric: false, array: bkHi.map((h, i) => i === 0 ? 0 : h - bkRoi[i]), arrayminus: bkLo.map((l, i) => i === 0 ? 0 : bkRoi[i] - l), color: T.ink, thickness: 1.3, width: 5 },
      customdata: bkRoi, hovertemplate: '%{customdata:.1f}%<extra></extra>'
    }], L({
      margin: { l: 58, r: 22, t: 14, b: 70 }, xaxis: axis({ title: 'Price of the token bought (mid)', showgrid: false }),
      yaxis: axis({ title: 'Return per $ staked (%)', range: [-110, 170] }),
      shapes: [{ type: 'line', xref: 'paper', x0: 0, x1: 1, y0: 0, y1: 0, line: { color: T.ink, width: 1 } }]
    }));

    /* Fig 7 heatmap */
    const spreads = ['0¢', '1¢', '2¢'], fees = ['0', '0.035', '0.070'];
    const z = [[30.8, 28.8, 26.7], [26.7, 24.6, 22.6], [22.8, 20.8, 18.8]];
    const cz = [[false, false, false], [false, false, true], [false, true, true]];
    draw('chart-heat', [{
      z: z, x: fees, y: spreads, type: 'heatmap', colorscale: [[0, T.accent + '22'], [1, T.accent + 'cc']], showscale: false, xgap: 3, ygap: 3,
      text: z.map((r, i) => r.map((v, j) => '+' + v.toFixed(1) + '%' + (cz[i][j] ? ' ○' : ''))), texttemplate: '%{text}', textfont: { size: 13, color: T.ink },
      hovertemplate: 'spread %{y}, fee rate %{x}<br>return %{z:.1f}%<extra></extra>'
    }], L({ margin: { l: 66, r: 18, t: 8, b: 56 }, xaxis: { title: 'Taker fee rate', type: 'category' }, yaxis: { title: 'Half-spread', type: 'category', autorange: 'reversed' } }));

    /* Fig 8 Brier */
    const sub = ['All bets (162)', 'Executable (156)', '0–60 s (111)', '60–120 s (32)'];
    draw('chart-brier', [
      { x: sub, y: [0.2427, 0.2429, 0.2234, 0.2220], type: 'bar', name: 'Model', marker: { color: T.accent }, text: ['0.2427', '0.2429', '0.2234', '0.2220'], textposition: 'outside', cliponaxis: false },
      { x: sub, y: [0.2585, 0.2471, 0.2422, 0.1930], type: 'bar', name: 'Market', marker: { color: T.muted }, text: ['0.2585', '0.2471', '0.2422', '0.1930'], textposition: 'outside', cliponaxis: false }
    ], L({
      barmode: 'group', showlegend: true, legend: { orientation: 'h', y: 1.14, x: 0 }, margin: { l: 60, r: 18, t: 34, b: 50 },
      xaxis: axis({ showgrid: false }), yaxis: axis({ title: 'Brier score', range: [0.15, 0.275] })
    }));

    renderSim();
  }

  renderAll();
  const s1 = document.getElementById('s-spread'), s2 = document.getElementById('s-fee');
  if (s1 && s2) { s1.addEventListener('input', renderSim); s2.addEventListener('input', renderSim); }
  if (window.matchMedia) window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', renderAll);
})();
