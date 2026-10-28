'use strict';
// Reading statistics, shared by the Mac app and the web version.
// Per-day totals live in notes.stats.days["YYYY-MM-DD"] = { sec, words, done }:
//  - sec:   time with an article open while the reader is active (idle > 60s stops the clock)
//  - words: words read, from how far the reading progress moved forward
//  - done:  articles that crossed 95% that day
// Needs t() and lang from i18n.js.
const Stats = (() => {
  let cfg;
  let lastAct = Date.now();
  let metric = 'min';
  const TICK = 5;
  const IDLE_MS = 60000;

  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => numFmt().format(Math.round(n));

  function store() {
    const n = cfg.notes();
    n.stats ||= {};
    n.stats.days ||= {};
    return n.stats;
  }
  function day(k = key(new Date())) {
    return (store().days[k] ||= { sec: 0, words: 0, done: 0 });
  }

  function init(c) {
    cfg = c;
    for (const ev of ['scroll', 'wheel', 'mousemove', 'keydown', 'touchstart', 'pointerdown'])
      addEventListener(ev, () => (lastAct = Date.now()), { passive: true, capture: true });
    setInterval(() => {
      if (!cfg.reading() || document.visibilityState !== 'visible' || Date.now() - lastAct > IDLE_MS) return;
      day().sec += TICK;
      // seconds read per hour of the day: reminders come at the hour you usually read
      const h = (store().hours ||= Array(24).fill(0));
      h[new Date().getHours()] += TICK;
      cfg.save();
    }, TICK * 1000);
  }

  // Reading done before stats existed: credit it to the day each article was last
  // opened, with words from its progress and time estimated at 220 words a minute.
  function seed() {
    const s = store();
    if (s.seeded) return;
    for (const m of cfg.list()) {
      const a = cfg.notes().articles[m.id];
      if (!a || !a.opened || !a.progress) continue;
      const d = day(key(new Date(a.opened)));
      const w = a.progress * m.words;
      d.words += w;
      d.sec += Math.round((w / 220) * 60);
      if (a.progress >= 0.95) d.done++;
    }
    s.seeded = true;
    cfg.save();
  }

  // called when an article's furthest-read point moves from `before` to `after` (0..1)
  function progress(words, before, after) {
    if (!(after > before)) return;
    const d = day();
    d.words += (after - before) * words;
    if (before < 0.95 && after >= 0.95) d.done++;
  }

  function summary() {
    const days = store().days;
    const today = new Date();
    const val = (k) => days[k] || { sec: 0, words: 0, done: 0 };
    const active = (k) => !!days[k] && (days[k].sec >= 60 || days[k].words >= 20);
    const used = Object.keys(days).filter((k) => days[k].sec || days[k].words).sort();
    const [fy, fm, fd] = (used[0] || key(today)).split('-').map(Number);
    const first = new Date(fy, fm - 1, fd);

    const series = [];
    for (let i = 29; i >= 0; i--) {
      const d = addDays(today, -i);
      series.push({ date: d, k: key(d), ...val(key(d)) });
    }
    // the average covers the last 30 days, but never days before reading started
    const win = series.filter((d) => d.date >= first);
    const n = Math.max(1, win.length);
    const avgSec = win.reduce((s, d) => s + d.sec, 0) / n;
    const avgWords = win.reduce((s, d) => s + d.words, 0) / n;

    let streak = 0;
    for (let d = active(key(today)) ? today : addDays(today, -1); active(key(d)); d = addDays(d, -1)) streak++;
    let best = 0;
    let run = 0;
    for (let d = first; d <= today; d = addDays(d, 1)) {
      run = active(key(d)) ? run + 1 : 0;
      best = Math.max(best, run);
    }

    const all = Object.entries(days);
    const bestDay = all.reduce((b, [k, d]) => (d.sec > (b ? b[1].sec : 0) ? [k, d] : b), null);
    const arts = Object.values(cfg.notes().articles);
    return {
      series,
      today: val(key(today)),
      avgSec,
      avgWords,
      n,
      streak,
      best,
      totalSec: all.reduce((s, [, d]) => s + d.sec, 0),
      totalWords: all.reduce((s, [, d]) => s + d.words, 0),
      finished: arts.filter((a) => (a.progress || 0) >= 0.95).length,
      vocab: arts.reduce((s, a) => s + ((a.vocab && a.vocab.length) || 0), 0),
      notes: arts.reduce((s, a) => s + Object.values(a.notes || {}).filter((x) => String(x).trim()).length, 0),
      bestDay,
      any: used.length > 0,
    };
  }

  function dur(sec) {
    const m = Math.round(sec / 60);
    return m < 60 ? t('st.min', m) : t('st.hm', Math.floor(m / 60), m % 60);
  }
  const fmtDay = (d, opts = { day: 'numeric', month: 'short' }) => dateFmt(opts).format(d);

  function niceMax(v) {
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  // 30 thin bars, one per day, with a dashed line at the daily average
  function chartSvg(s, W) {
    const H = 200;
    const L = 40;
    const R = 8;
    const T = 16;
    const B = 26;
    const pw = W - L - R;
    const ph = H - T - B;
    const v = (d) => (metric === 'min' ? d.sec / 60 : d.words);
    const avg = metric === 'min' ? s.avgSec / 60 : s.avgWords;
    const max = niceMax(Math.max(...s.series.map(v), avg, metric === 'min' ? 10 : 500));
    const y = (x) => T + ph - (x / max) * ph;
    const base = T + ph;
    const slot = pw / s.series.length;
    const bw = Math.max(3, Math.min(16, slot - 3));
    const fmtV = (x) => (metric === 'min' ? t('st.min', Math.round(x)) : num(x));
    let g = '';
    for (const f of [0, 0.5, 1]) {
      const yy = y(max * f);
      g += `<line class="st-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/>`;
      g += `<text class="st-axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${escH(metric === 'min' ? Math.round(max * f) : num(max * f))}</text>`;
    }
    let bars = '';
    let hits = '';
    let xl = '';
    s.series.forEach((d, i) => {
      const x = L + i * slot + (slot - bw) / 2;
      const h = (v(d) / max) * ph;
      if (h < 1) bars += `<rect class="st-zero" data-i="${i}" x="${x}" y="${base - 2}" width="${bw}" height="2" rx="1"/>`;
      else {
        const r = Math.min(4, bw / 2, h);
        const top = base - h;
        bars += `<path class="st-bar${i === s.series.length - 1 ? ' today' : ''}" data-i="${i}" d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z"/>`;
      }
      hits += `<rect class="st-hit" data-i="${i}" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph + B}"/>`;
      if ((s.series.length - 1 - i) % 7 === 0)
        xl += `<text class="st-axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${escH(fmtDay(d.date))}</text>`;
    });
    let avgLine = '';
    if (avg > 0) {
      const ya = y(avg);
      avgLine = `<line class="st-avg" x1="${L}" x2="${W - R}" y1="${ya}" y2="${ya}"/>
        <text class="st-avg-l" x="${W - R}" y="${ya - 6}" text-anchor="end">${escH(t('st.avgLine'))} · ${escH(fmtV(avg))}</text>`;
    }
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${escH(t('st.chart'))}">${g}${bars}${avgLine}${xl}${hits}</svg>`;
  }

  let el;
  function render(target) {
    el = target || el;
    if (!el) return;
    const s = summary();
    el.innerHTML = `
      <h1 class="st-h">${escH(t('st.title'))}</h1>
      ${s.any ? '' : `<p class="st-empty">${escH(t('st.empty'))}</p>`}
      <section class="st-card">
        <div class="st-card-head">
          <h3>${escH(t('st.chart'))}</h3>
          <div class="st-seg" id="st-metric">
            <button data-m="min" class="${metric === 'min' ? 'on' : ''}">${escH(t('st.time'))}</button>
            <button data-m="words" class="${metric === 'words' ? 'on' : ''}">${escH(t('st.wordsTab'))}</button>
          </div>
        </div>
        <div class="st-chart" id="st-chart"></div>
      </section>`;
    drawChart(s);
    el.querySelector('#st-metric').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || b.dataset.m === metric) return;
      metric = b.dataset.m;
      el.querySelectorAll('#st-metric button').forEach((x) => x.classList.toggle('on', x === b));
      drawChart(summary());
    });
  }

  function drawChart(s) {
    const box = el.querySelector('#st-chart');
    box.innerHTML = chartSvg(s, Math.max(280, box.clientWidth || 600)) + '<div class="st-tip" id="st-tip"></div>';
    const tip = box.querySelector('#st-tip');
    const svg = box.querySelector('svg');
    let felt = -1; // a tick on the trackpad per bar the pointer passes
    const show = (e) => {
      const hit = e.target.closest && e.target.closest('.st-hit');
      box.querySelectorAll('.hot').forEach((x) => x.classList.remove('hot'));
      if (!hit) return (tip.classList.remove('show'), box.classList.remove('hovering'), (felt = -1));
      const i = +hit.dataset.i;
      if (i !== felt) (felt = i), Haptic.align();
      const d = s.series[i];
      const bar = box.querySelector(`.st-bar[data-i="${i}"], .st-zero[data-i="${i}"]`);
      bar.classList.add('hot');
      box.classList.add('hovering');
      tip.innerHTML = `<b>${escH(i === s.series.length - 1 ? t('st.today') : fmtDay(d.date, { weekday: 'short', day: 'numeric', month: 'short' }))}</b><br>${escH(dur(d.sec))} · ${escH(t('st.words', num(d.words)))}`;
      const bb = bar.getBoundingClientRect();
      const cb = box.getBoundingClientRect();
      const x = Math.max(70, Math.min(cb.width - 70, bb.left - cb.left + bb.width / 2));
      tip.style.left = x + 'px';
      tip.style.top = bb.top - cb.top + 'px';
      tip.classList.add('show');
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', () => {
      felt = -1;
      tip.classList.remove('show');
      box.classList.remove('hovering');
      box.querySelectorAll('.hot').forEach((x) => x.classList.remove('hot'));
    });
  }

  addEventListener('resize', () => el && el.isConnected && el.closest('.is-active, .active') && drawChart(summary()));

  return { init, seed, progress, render, summary };
})();
