'use strict';
// More statistics, under the shared 30-day chart (stats.js):
//  - half a year of reading as a calendar heat map
//  - listening: 30 days of minutes, the total and the episodes finished in the card's head
//  - vocabulary: words saved over the last 60 days, and how far the cards have got
// Everything is one series per chart in the app's ink, so no chart needs a legend; every bar,
// cell and point answers on hover. Same look as stats.js (.st-* classes in stats.css).
// Needs stats.js, i18n.js and app.js (state).
(() => {
  Object.assign(I18N.uz, {
    'sx.listen': 'Tinglash',
    'sx.lTotal': 'Jami tinglangan',
    'sx.lEps': 'Epizodlar',
    'sx.lChart': "Tinglash daqiqalari — so'nggi 30 kun",
    'sx.lNone': "Hali hech narsa tinglanmagan. Kutubxonada Listening'ni oching — birinchisi shu yerda paydo bo'ladi.",
    'sx.lTip': (m) => `${m} daq. tinglangan`,
    'sx.heat': "Yarim yil o'qish",
    'sx.less': 'Kam',
    'sx.more': "Ko'p",
    'sx.vocab': "Lug'at",
    'sx.growth': "Lug'atdagi so'zlar — so'nggi 60 kun",
    'sx.growthTip': (d, n, k) => `${d} · ${n} ta so'z${k ? ` (+${k})` : ''}`,
    'sx.cards': "Kartochkalar holati",
    'sx.cNew': 'Yangi',
    'sx.cLearning': "O'rganilmoqda",
    'sx.cLearned': "O'rganildi",
    'sx.cDue': (n) => `bugun takrorlashga: ${n}`,
    'sx.wd': ['Du', 'Se', 'Ch', 'Pa', 'Ju', 'Sh', 'Ya'],
  });
  Object.assign(I18N.en, {
    'sx.listen': 'Listening',
    'sx.lTotal': 'Listened in all',
    'sx.lEps': 'Episodes',
    'sx.lChart': 'Minutes listened — last 30 days',
    'sx.lNone': 'Nothing listened to yet. Open Listening in the library and the first one shows here.',
    'sx.lTip': (m) => `${m} min listened`,
    'sx.heat': 'Half a year of reading',
    'sx.less': 'Less',
    'sx.more': 'More',
    'sx.vocab': 'Vocabulary',
    'sx.growth': 'Words in your vocabulary — last 60 days',
    'sx.growthTip': (d, n, k) => `${d} · ${n} words${k ? ` (+${k})` : ''}`,
    'sx.cards': 'Where the cards are',
    'sx.cNew': 'New',
    'sx.cLearning': 'Learning',
    'sx.cLearned': 'Learned',
    'sx.cDue': (n) => `due today: ${n}`,
    'sx.wd': ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'],
  });
  Object.assign(I18N.ru, {
    'sx.listen': 'Аудирование',
    'sx.lTotal': 'Всего прослушано',
    'sx.lEps': 'Выпуски',
    'sx.lChart': 'Минуты аудирования — последние 30 дней',
    'sx.lNone': 'Пока ничего не прослушано. Откройте Listening в библиотеке — первое появится здесь.',
    'sx.lTip': (m) => `прослушано ${m} мин`,
    'sx.heat': 'Полгода чтения',
    'sx.less': 'Меньше',
    'sx.more': 'Больше',
    'sx.vocab': 'Словарь',
    'sx.growth': 'Слов в словаре — последние 60 дней',
    'sx.growthTip': (d, n, k) => `${d} · ${n} слов${k ? ` (+${k})` : ''}`,
    'sx.cards': 'Состояние карточек',
    'sx.cNew': 'Новые',
    'sx.cLearning': 'Учатся',
    'sx.cLearned': 'Выучены',
    'sx.cDue': (n) => `на повтор сегодня: ${n}`,
    'sx.wd': ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'],
  });

  const LEARNED = 21; // same line as cards.js: a word reviewed 21+ days apart is learned
  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => numFmt().format(Math.round(n));
  const fmtDay = (d, opts = { weekday: 'short', day: 'numeric', month: 'short' }) => dateFmt(opts).format(d);
  const dur = (sec) => {
    const m = Math.round(sec / 60);
    return m < 60 ? t('st.min', m) : t('st.hm', Math.floor(m / 60), m % 60);
  };
  const wdOf = (d) => (d.getDay() + 6) % 7; // Monday = 0
  function niceMax(v) {
    if (!(v > 0)) return 1;
    const p = 10 ** Math.floor(Math.log10(v));
    for (const m of [1, 2, 2.5, 5, 10]) if (m * p >= v) return m * p;
    return 10 * p;
  }

  /* ---------------- data ---------------- */

  function data() {
    const st = state.notes.stats || {};
    const days = st.days || {};
    const today = new Date();

    // 26 weeks, Monday-first columns, ending with this week
    const start = addDays(today, -(wdOf(today) + 25 * 7));
    const heat = [];
    for (let i = 0; i < 26 * 7; i++) {
      const d = addDays(start, i);
      heat.push({ date: d, min: ((days[key(d)] && days[key(d)].sec) || 0) / 60, future: d > today });
    }

    const vocab = Object.values(state.notes.articles || {}).flatMap((a) => (a && a.vocab) || []);
    const growth = [];
    const from = addDays(today, -59);
    const at = vocab.map((v) => v.at || 0).sort((a, b) => a - b);
    let k = 0;
    while (k < at.length && at[k] < from.getTime()) k++;
    let count = k;
    for (let i = 0; i < 60; i++) {
      const end = addDays(from, i + 1).getTime();
      let added = 0;
      while (k < at.length && at[k] < end) k++, added++;
      count += added;
      growth.push({ date: addDays(from, i), n: count, added });
    }
    const withTr = vocab.filter((v) => v.tr && String(v.tr).trim());
    const now = Date.now();
    const srs = {
      fresh: withTr.filter((v) => !v.srs).length,
      learning: withTr.filter((v) => v.srs && v.srs.ivl < LEARNED).length,
      learned: withTr.filter((v) => v.srs && v.srs.ivl >= LEARNED).length,
      due: withTr.filter((v) => v.srs && v.srs.due <= now).length,
    };

    // listening (listen.js): seconds per day and the episodes finished
    const ls = state.notes.listen || {};
    const ldays = ls.days || {};
    const listen30 = [];
    for (let i = 29; i >= 0; i--) listen30.push({ date: addDays(today, -i), sec: ldays[key(addDays(today, -i))] || 0 });
    const eps = Object.values(ls.eps || {});
    const listen = {
      total: Object.values(ldays).reduce((s, x) => s + x, 0),
      done: eps.filter((e) => e.done).length,
      any: eps.length > 0,
    };

    return { listen30, listen, heat, growth, srs };
  }

  /* ---------------- charts ---------------- */

  // vertical bars in the stats.js style: rounded tops anchored to the baseline, a recessive
  // grid at 0 / half / max, the last bar (today) full ink while hovering dims the rest
  function bars(values, { W, H = 170, label, every = 1, axis = (v) => num(v), today = -1 }) {
    const L = 36, R = 6, T = 12, B = 24;
    const pw = W - L - R;
    const ph = H - T - B;
    const max = niceMax(Math.max(...values));
    const y = (v) => T + ph - (v / max) * ph;
    const base = T + ph;
    const slot = pw / values.length;
    const bw = Math.max(3, Math.min(18, slot - 3));
    let g = '';
    // small counts (0–2) would print the half line as a repeated whole number: keep 0 and max
    for (const f of max <= 2 ? [0, 1] : [0, 0.5, 1]) {
      const yy = y(max * f);
      g += `<line class="st-grid" x1="${L}" x2="${W - R}" y1="${yy}" y2="${yy}"/><text class="st-axis" x="${L - 8}" y="${yy + 4}" text-anchor="end">${escH(axis(max * f))}</text>`;
    }
    let b = '';
    let hits = '';
    let xl = '';
    values.forEach((v, i) => {
      const x = L + i * slot + (slot - bw) / 2;
      const h = (v / max) * ph;
      if (h < 1) b += `<rect class="st-zero" data-i="${i}" x="${x}" y="${base - 2}" width="${bw}" height="2" rx="1"/>`;
      else {
        const r = Math.min(4, bw / 2, h);
        const top = base - h;
        b += `<path class="st-bar${i === today ? ' today' : ''}" data-i="${i}" d="M${x},${base}V${top + r}Q${x},${top} ${x + r},${top}H${x + bw - r}Q${x + bw},${top} ${x + bw},${top + r}V${base}Z"/>`;
      }
      hits += `<rect class="st-hit" data-i="${i}" x="${L + i * slot}" y="${T}" width="${slot}" height="${ph + B}"/>`;
      if (label && i % every === 0) xl += `<text class="st-axis" x="${x + bw / 2}" y="${H - 6}" text-anchor="middle">${escH(label(i))}</text>`;
    });
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}${b}${xl}${hits}</svg>`;
  }

  // the calendar: weeks as columns, Monday on top; one hue, lighter → darker in four steps
  function heatSvg(cells, W) {
    const L = 26, T = 18, gap = 3;
    const cols = cells.length / 7;
    // the squares grow to fill the card's width
    const sz = Math.max(8, Math.min(26, Math.floor((W - L - (cols - 1) * gap) / cols)));
    const H = T + 7 * sz + 6 * gap + 4;
    const vals = cells.filter((c) => c.min > 0).map((c) => c.min).sort((a, b) => a - b);
    const q = (p) => vals[Math.min(vals.length - 1, Math.floor(p * vals.length))] || 0;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (m) => (m <= 0 ? 0 : m <= cuts[0] ? 1 : m <= cuts[1] ? 2 : m <= cuts[2] ? 3 : 4);
    let s = '';
    let ml = '';
    let lastMonth = -1;
    heatSvg.lastCol = -9; // month names stay at least three columns apart
    cells.forEach((c, i) => {
      const col = Math.floor(i / 7);
      const row = i % 7;
      const x = L + col * (sz + gap);
      const yy = T + row * (sz + gap);
      if (row === 0 && c.date.getMonth() !== lastMonth) {
        lastMonth = c.date.getMonth();
        if (col < cols - 1 && (col === 0 || ml.length === 0 || col - (heatSvg.lastCol ?? -9) >= 3)) (heatSvg.lastCol = col), ml += `<text class="st-axis" x="${x}" y="${T - 6}">${escH(fmtDay(c.date, { month: 'short' }))}</text>`;
      }
      if (c.future) return;
      s += `<rect class="sx-cell l${level(c.min)}" data-i="${i}" x="${x}" y="${yy}" width="${sz}" height="${sz}" rx="3"/>`;
    });
    const wd = t('sx.wd');
    const yl = [0, 2, 4].map((r) => `<text class="st-axis" x="0" y="${T + r * (sz + gap) + sz - 2}">${escH(wd[r])}</text>`).join('');
    return { svg: `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${ml}${yl}${s}</svg>`, w: L + cols * (sz + gap) };
  }

  // a 2px line with a faint area under it; hovering shows a crosshair, a dot and the value
  function areaSvg(pts, W, H = 160) {
    const L = 36, R = 8, T = 14, B = 24;
    const pw = W - L - R;
    const ph = H - T - B;
    const lo = Math.min(...pts.map((p) => p.n));
    const max = niceMax(Math.max(...pts.map((p) => p.n), 5));
    const min = lo > max * 0.6 ? Math.floor(lo * 0.8) : 0;
    const x = (i) => L + (i / (pts.length - 1)) * pw;
    const y = (v) => T + ph - ((v - min) / (max - min || 1)) * ph;
    const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.n).toFixed(1)}`).join('');
    let g = '';
    for (const f of [0, 0.5, 1]) {
      const v = min + (max - min) * f;
      g += `<line class="st-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="st-axis" x="${L - 8}" y="${y(v) + 4}" text-anchor="end">${escH(num(v))}</text>`;
    }
    let xl = '';
    pts.forEach((p, i) => {
      if ((pts.length - 1 - i) % 14 === 0) xl += `<text class="st-axis" x="${x(i)}" y="${H - 6}" text-anchor="middle">${escH(fmtDay(p.date, { day: 'numeric', month: 'short' }))}</text>`;
    });
    const base = T + ph;
    return `<svg viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">${g}
      <path class="sx-area" d="${line}L${x(pts.length - 1)},${base}L${x(0)},${base}Z"/>
      <path class="sx-line" d="${line}"/>
      <line class="sx-cross" x1="0" x2="0" y1="${T}" y2="${base}"/>
      <circle class="sx-dot" r="4.5" cx="0" cy="0"/>
      ${xl}
      <rect class="st-hit sx-zone" x="${L}" y="${T}" width="${pw}" height="${ph + B}" data-l="${L}" data-pw="${pw}" data-n="${pts.length}"/>
      ${pts.map((p, i) => `<g data-i="${i}" data-x="${x(i).toFixed(1)}" data-y="${y(p.n).toFixed(1)}"></g>`).join('')}
    </svg>`;
  }

  // one hover tooltip per chart box: bars and cells by their data-i, the area by the pointer's x
  function hover(box, tipOf) {
    const tip = box.querySelector('.st-tip');
    const svg = box.querySelector('svg');
    let felt = -1; // a tick on the trackpad per day/bar the pointer passes
    const feel = (i) => i !== felt && ((felt = i), Haptic.align());
    const off = () => {
      felt = -1;
      tip.classList.remove('show');
      box.classList.remove('hovering', 'crossing');
      box.querySelectorAll('.hot').forEach((x) => x.classList.remove('hot'));
    };
    const place = (cx, cy) => {
      const cb = box.getBoundingClientRect();
      tip.style.left = Math.max(80, Math.min(cb.width - 80, cx - cb.left)) + 'px';
      tip.style.top = cy - cb.top + 'px';
      tip.classList.add('show');
    };
    const show = (e) => {
      const zone = e.target.closest && e.target.closest('.sx-zone');
      if (zone) {
        const r = svg.getBoundingClientRect();
        const k = r.width / svg.viewBox.baseVal.width;
        const n = +zone.dataset.n;
        const i = Math.max(0, Math.min(n - 1, Math.round((((e.clientX - r.left) / k - +zone.dataset.l) / +zone.dataset.pw) * (n - 1))));
        const g = svg.querySelector(`g[data-i="${i}"]`);
        feel(i);
        const cx = +g.dataset.x;
        const cy = +g.dataset.y;
        svg.querySelector('.sx-cross').setAttribute('x1', cx);
        svg.querySelector('.sx-cross').setAttribute('x2', cx);
        svg.querySelector('.sx-dot').setAttribute('cx', cx);
        svg.querySelector('.sx-dot').setAttribute('cy', cy);
        box.classList.add('crossing');
        tip.innerHTML = tipOf(i);
        return place(r.left + cx * k, r.top + cy * k);
      }
      const hit = e.target.closest && e.target.closest('[data-i]');
      box.querySelectorAll('.hot').forEach((x) => x.classList.remove('hot'));
      if (!hit || hit.tagName === 'g') return off();
      const i = +hit.dataset.i;
      const mark = box.querySelector(`.st-bar[data-i="${i}"], .st-zero[data-i="${i}"], .sx-cell[data-i="${i}"]`);
      if (!mark) return off();
      feel(i);
      mark.classList.add('hot');
      box.classList.add('hovering');
      tip.innerHTML = tipOf(i);
      const bb = mark.getBoundingClientRect();
      place(bb.left + bb.width / 2, bb.top);
    };
    svg.addEventListener('pointermove', show);
    svg.addEventListener('pointerdown', show);
    svg.addEventListener('pointerleave', off);
  }

  /* ---------------- the page ---------------- */

  const card = (title, id, delay, extra = '', sum = '') => `<section class="st-card sx-card" style="animation-delay:${delay}ms"><div class="st-card-head"><h3>${escH(title)}</h3>${extra}</div>${sum}<div class="st-chart" id="${id}"></div></section>`;

  let root = null;
  function render(el) {
    const host = el || document.getElementById('stats-body');
    if (!host) return;
    root = host.querySelector('.sx') || host.appendChild(Object.assign(document.createElement('div'), { className: 'sx' }));
    const d = data();
    const lsum = d.listen.any ? `<p class="st-sum">${escH(t('sx.lTotal'))}: ${escH(dur(d.listen.total))} · ${escH(t('sx.lEps'))}: ${num(d.listen.done)}</p>` : '';
    root.innerHTML = `
      ${card(t('sx.heat'), 'sx-heat', 160, `<div class="sx-legend"><span>${escH(t('sx.less'))}</span>${[0, 1, 2, 3, 4].map((l) => `<i class="sx-cell l${l}"></i>`).join('')}<span>${escH(t('sx.more'))}</span></div>`)}
      <h2 class="sx-h">${escH(t('sx.listen'))}</h2>
      ${d.listen.any ? '' : `<p class="st-empty sx-empty">${escH(t('sx.lNone'))}</p>`}
      ${card(t('sx.lChart'), 'sx-listen', 200, '', lsum)}
      <h2 class="sx-h">${escH(t('sx.vocab'))}</h2>
      ${card(t('sx.growth'), 'sx-growth', 240)}
      <section class="st-card sx-card" style="animation-delay:280ms"><div class="st-card-head"><h3>${escH(t('sx.cards'))}</h3><span class="sx-due">${escH(t('sx.cDue', d.srs.due))}</span></div><div id="sx-srs"></div></section>`;
    draw(d);
  }

  function draw(d) {
    if (!root || !root.isConnected) return;
    // every width is read before any chart is written: one layout instead of one per chart
    const widths = {};
    for (const id of ['sx-listen', 'sx-heat', 'sx-growth']) {
      const el = root.querySelector('#' + id);
      widths[id] = Math.max(260, (el && el.clientWidth) || 600);
    }
    const W = (id) => widths[id];
    const put = (id, svg, tipOf) => {
      const box = root.querySelector('#' + id);
      box.innerHTML = svg + '<div class="st-tip"></div>';
      hover(box, tipOf);
    };
    const minAxis = (v) => Math.round(v);
    put('sx-listen', bars(d.listen30.map((x) => x.sec / 60), { W: W('sx-listen'), today: 29, axis: minAxis, label: (i) => ((29 - i) % 7 === 0 ? fmtDay(d.listen30[i].date, { day: 'numeric', month: 'short' }) : '') }), (i) => {
      const x = d.listen30[i];
      return `<b>${escH(i === 29 ? t('st.today') : fmtDay(x.date))}</b><br>${escH(t('sx.lTip', Math.round(x.sec / 60)))}`;
    });
    const hm = heatSvg(d.heat, W('sx-heat'));
    put('sx-heat', hm.svg, (i) => `<b>${escH(fmtDay(d.heat[i].date, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }))}</b><br>${escH(dur(d.heat[i].min * 60))}`);
    put('sx-growth', areaSvg(d.growth, W('sx-growth')), (i) => {
      const g = d.growth[i];
      return escH(t('sx.growthTip', fmtDay(g.date, { day: 'numeric', month: 'short' }), g.n, g.added));
    });
    // the cards as one bar split in three, each part labelled with its count underneath
    const s = d.srs;
    const tot = s.fresh + s.learning + s.learned;
    const parts = [['fresh', t('sx.cNew'), s.fresh], ['learning', t('sx.cLearning'), s.learning], ['learned', t('sx.cLearned'), s.learned]];
    root.querySelector('#sx-srs').innerHTML = tot
      ? `<div class="sx-split">${parts.filter((p) => p[2]).map(([k, , n]) => `<i class="sx-${k}" style="flex:${n}"></i>`).join('')}</div>
         <div class="sx-split-l">${parts.map(([k, l, n]) => `<span><i class="sx-${k}"></i>${escH(l)} <b>${num(n)}</b> <small>${Math.round((n / tot) * 100)}%</small></span>`).join('')}</div>`
      : `<p class="st-empty">${escH(t('st.empty'))}</p>`;
  }

  /* ---------------- numbers that roll in ----------------
     Every digit of a tile's value is a column 0–9 (and 0 again) that spins down to its digit,
     blurred while it moves, like the Apple clock. Each column gets one Web Animation on transform
     and filter with its distance in pixels, worked out once at the start (keyframes built from
     CSS variables and percentages came out wrong on the compositor), so the compositor does the
     rest and no script runs per frame. Digits start from the right, a little apart; a value
     scrolled out of sight starts when it comes in. */
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  // one block of text, a digit per line (a span per digit made ~11 elements for every digit)
  const COL = '<span class="od-s">0\n1\n2\n3\n4\n5\n6\n7\n8\n9\n0</span>';
  let io = null;
  // values waiting to come into view; the observer holds on to each one (and with it the whole
  // page it sat in), so the ones a redraw threw away unseen are let go on the next call
  const waiting = new Set();
  function odometer(host, sel = '.st-v, .sx-split-l b') {
    if (reduce.matches) return;
    io ||= new IntersectionObserver((es) => es.forEach((e) => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      waiting.delete(e.target);
      roll(e.target);
    }), { threshold: 0.2 });
    for (const el of waiting) if (!el.isConnected) io.unobserve(el), waiting.delete(el);
    host.querySelectorAll(sel).forEach((el, n) => {
      const text = el.textContent;
      if (!/\d/.test(text) || el.querySelector('.od')) return;
      const chars = [...text];
      let k = chars.filter((c) => /\d/.test(c)).length;
      el.setAttribute('aria-label', text);
      el.innerHTML = chars.map((c) => {
        if (!/\d/.test(c)) return `<span class="od-c" aria-hidden="true">${escH(c)}</span>`;
        k--;
        // a 0 spins all the way round to the 0 at the bottom, so every digit moves
        return `<span class="od" aria-hidden="true" data-to="${+c || 10}" data-k="${k}" data-n="${Math.min(n, 8)}"><span class="od-z">${c}</span>${COL}</span>`;
      }).join('');
      io.observe(el);
      waiting.add(el);
    });
  }

  const EASE = 'cubic-bezier(0.16, 0.9, 0.24, 1)';
  function roll(el) {
    // all the reads first, then all the writes: one layout for the whole value
    const cols = [...el.querySelectorAll('.od')].map((od) => ({ s: od.querySelector('.od-s'), h: od.getBoundingClientRect().height, to: +od.dataset.to, k: +od.dataset.k, n: +od.dataset.n }));
    for (const c of cols) {
      const end = `translateY(${(-c.to * c.h).toFixed(2)}px)`;
      const a = c.s.animate(
        [
          { transform: 'translateY(0)', filter: 'blur(0)' },
          { filter: 'blur(2.4px)', offset: 0.3 },
          { filter: 'blur(0.4px)', offset: 0.8 },
          { transform: end, filter: 'blur(0)' },
        ],
        { duration: 1100, delay: c.n * 50 + c.k * 70 + 80, easing: EASE, fill: 'both' },
      );
      // settled: the end position becomes plain style and the animation is let go
      a.finished.then(() => ((c.s.style.transform = end), a.cancel()), () => {});
    }
  }

  // under the shared statistics, every time they're drawn
  Stats.odometer = odometer; // recap.js and stats-hero.js roll their numbers the same way
  const base = Stats.render;
  Stats.render = (target) => {
    base(target);
    render(target);
    odometer(target || document.getElementById('stats-body'));
  };
  let rT = 0;
  addEventListener('resize', () => {
    clearTimeout(rT);
    rT = setTimeout(() => root && root.isConnected && root.closest('.is-active') && draw(data()), 120);
  });
})();
