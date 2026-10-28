'use strict';
// The parts of Statistics worth coming back for (Mac and web):
//  - a top card in ink, three parts: the streak, this week as bars, and today — the daily goal
//    (Settings → Focus → Daily goal) as a line, and the new words
//  - all-time totals that only ever grow: time, words read, articles finished, words saved
//  - "Records": the best day by time and by words, the longest streak, the best week
// Numbers roll in with stats-more.js's odometer. Needs stats.js, stats-more.js, app.js (state).
(() => {
  Object.assign(I18N.uz, {
    'hx.best': (n) => `rekord — ${n} kun`,
    'hx.today': 'Bugun',
    'hx.daysOn': 'faol kun',
    'hx.words': (n) => `${n} ta yangi so'z`,
    'hx.left': (m) => `${m} qoldi`,
    'hx.past': (m) => `maqsaddan ${m} ortiq`,
    'hx.week': 'Hafta',
    'hx.totals': 'Jami natijalar',
    'hx.read': "O'qilgan so'zlar",
    'hx.books': (n) => (n < 1 ? `bir kitobning ${Math.round(n * 100)}%` : `≈ ${n.toFixed(1)} ta kitob`),
    'hx.newWk': (n) => `bu hafta +${n}`,
    'hx.records': 'Rekordlar',
    'hx.rDay': "Eng ko'p o'qilgan kun",
    'hx.rWords': "Eng ko'p so'z bir kunda",
    'hx.rStreak': 'Eng uzun seriya',
    'hx.rWeek': "Eng zo'r hafta",
    'hx.rArt': 'Bir kunda tugatilgan maqolalar',
  });
  Object.assign(I18N.en, {
    'hx.best': (n) => `record — ${n} days`,
    'hx.today': 'Today',
    'hx.daysOn': 'active days',
    'hx.words': (n) => `${n} new words`,
    'hx.left': (m) => `${m} to go`,
    'hx.past': (m) => `${m} past the goal`,
    'hx.week': 'Week',
    'hx.totals': 'All-time',
    'hx.read': 'Words read',
    'hx.books': (n) => (n < 1 ? `${Math.round(n * 100)}% of a book` : `≈ ${n.toFixed(1)} books`),
    'hx.newWk': (n) => `+${n} this week`,
    'hx.records': 'Records',
    'hx.rDay': 'Most time in a day',
    'hx.rWords': 'Most words in a day',
    'hx.rStreak': 'Longest streak',
    'hx.rWeek': 'Best week',
    'hx.rArt': 'Articles finished in a day',
  });
  Object.assign(I18N.ru, {
    'hx.best': (n) => `рекорд — ${n} дн.`,
    'hx.today': 'Сегодня',
    'hx.daysOn': 'активных дней',
    'hx.words': (n) => `${n} новых слов`,
    'hx.left': (m) => `осталось ${m}`,
    'hx.past': (m) => `на ${m} больше цели`,
    'hx.week': 'Неделя',
    'hx.totals': 'За всё время',
    'hx.read': 'Прочитано слов',
    'hx.books': (n) => (n < 1 ? `${Math.round(n * 100)}% книги` : `≈ ${n.toFixed(1)} книг`),
    'hx.newWk': (n) => `+${n} за неделю`,
    'hx.records': 'Рекорды',
    'hx.rDay': 'Больше всего времени за день',
    'hx.rWords': 'Больше всего слов за день',
    'hx.rStreak': 'Самая длинная серия',
    'hx.rWeek': 'Лучшая неделя',
    'hx.rArt': 'Статей дочитано за день',
  });

  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => numFmt().format(Math.round(n));
  const fmtDay = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => dateFmt(o).format(d);
  const dur = (sec) => {
    const m = Math.round(sec / 60);
    return m < 60 ? t('st.min', m) : t('st.hm', Math.floor(m / 60), m % 60);
  };
  const wdOf = (d) => (d.getDay() + 6) % 7;
  const dateOf = (k) => new Date(k + 'T00:00');

  function data() {
    const st = state.notes.stats || {};
    const days = st.days || {};
    const today = new Date();
    const s = Stats.summary();
    const active = (k) => !!days[k] && (days[k].sec >= 60 || days[k].words >= 20);

    const monday = addDays(today, -wdOf(today));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return { d, on: active(key(d)), future: d > today, today: key(d) === key(today) };
    });

    const goal = (state.notes.settings && state.notes.settings.goalMin) || 15;
    const vocab = Object.values(state.notes.articles || {}).flatMap((a) => (a && a.vocab) || []);
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const entries = Object.entries(days);
    const top = (f) => entries.reduce((b, e) => (f(e[1]) > (b ? f(b[1]) : 0) ? e : b), null);
    // weeks, Monday to Sunday
    const weeks = {};
    for (const [k, v] of entries) {
      const d = dateOf(k);
      const m = key(addDays(d, -wdOf(d)));
      weeks[m] = (weeks[m] || 0) + (v.sec || 0);
    }

    return {
      s, week, goal, today: s.today,
      newToday: vocab.filter((v) => (v.at || 0) >= startToday).length,
      newWeek: vocab.filter((v) => (v.at || 0) >= monday.getTime()).length,
      books: s.totalWords / 80000, // an average novel
      bestDay: top((v) => v.sec || 0),
      bestWords: top((v) => v.words || 0),
      bestDone: top((v) => v.done || 0),
      bestWeek: Object.entries(weeks).reduce((b, e) => (e[1] > (b ? b[1] : 0) ? e : b), null),
    };
  }

  // the top card, ink only, in three parts: the streak; this week as seven bars (hover one: that
  // day and its minutes); today — a line that fills to the daily goal (hover: how much is left, or
  // how far past it) and the new words
  function hero(d) {
    const days = (state.notes.stats && state.notes.stats.days) || {};
    const wd = t('sx.wd');
    const sec = (x) => (days[key(x)] || {}).sec || 0;
    const tip = (x) => `${wd[wdOf(x)]}, ${fmtDay(x, { day: 'numeric', month: 'short' })} · ${sec(x) ? dur(sec(x)) : '—'}`;
    const min = Math.round(d.today.sec / 60);
    const left = d.goal - min;
    const max = Math.max(60, ...d.week.map((x) => sec(x.d)));
    const on = d.week.filter((x) => x.on).length;
    const part = (k, v, sub, extra) => `<div class="hx-p"><div class="st-k">${escH(k)}</div><div class="st-v">${escH(v)}</div>${extra}<div class="st-s" data-s="${escH(sub)}">${escH(sub)}</div></div>`;
    return `<section class="hx-hero">
      ${part(t('st.streak'), t('st.days', d.s.streak), t('hx.best', d.s.best), '')}
      ${part(t('hx.week'), `${on} / 7`, t('hx.daysOn'),
        `<div class="hx-bars">${d.week.map((x, i) => `<i class="${x.on ? 'on' : ''}${x.today ? ' now' : ''}${x.future ? ' future' : ''}" style="--h:${(sec(x.d) / max).toFixed(3)};--i:${i}" data-tip="${escH(tip(x.d))}"><b></b><span>${escH(wd[i])}</span></i>`).join('')}</div>`)}
      ${part(t('hx.today'), `${min} / ${t('st.min', d.goal)}`, t('hx.words', num(d.newToday)),
        `<div class="hx-line" style="--k:${Math.min(1, min / d.goal).toFixed(3)}" data-tip="${escH(left > 0 ? t('hx.left', t('st.min', left)) : t('hx.past', t('st.min', -left)))}"><b></b></div>`)}
    </section>`;
  }

  // hovering a bar or the line puts it into that part's small line
  function wire(card) {
    let felt = null;
    card.addEventListener('pointerover', (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el || el === felt) return;
      if (felt) felt.classList.remove('hot');
      felt = el;
      const sub = el.closest('.hx-p').querySelector('.st-s');
      sub.textContent = el.dataset.tip;
      sub.classList.add('hx-tip');
      el.classList.add('hot');
      if (typeof Haptic !== 'undefined') Haptic.align();
    });
    card.addEventListener('pointerout', (e) => {
      const el = e.target.closest('[data-tip]');
      if (!el || (e.relatedTarget && el.contains(e.relatedTarget))) return;
      felt = null;
      el.classList.remove('hot');
      const sub = el.closest('.hx-p').querySelector('.st-s');
      sub.textContent = sub.dataset.s;
      sub.classList.remove('hx-tip');
    });
  }

  const tile = (k, v, sub, i) => `<div class="st-tile" style="animation-delay:${i * 40}ms"><div class="st-k">${escH(k)}</div><div class="st-v">${escH(v)}</div><div class="st-s">${escH(sub)}</div></div>`;

  function totals(d) {
    return `<div class="st-tiles hx-totals" aria-label="${escH(t('hx.totals'))}">
        ${tile(t('st.total'), dur(d.s.totalSec), '', 0)}
        ${tile(t('hx.read'), num(d.s.totalWords), d.s.totalWords ? t('hx.books', d.books) : '', 1)}
        ${tile(t('st.finished'), num(d.s.finished), '', 2)}
        ${tile(t('st.vocab'), num(d.s.vocab), d.newWeek ? t('hx.newWk', d.newWeek) : '', 3)}
      </div>`;
  }

  function records(d) {
    const row = (icon, label, val, when, i) => `<div class="hx-rec" style="animation-delay:${i * 50}ms"><span class="hx-ri">${icon}</span><span class="hx-rl">${escH(label)}<small>${escH(when)}</small></span><b class="st-v">${escH(val)}</b></div>`;
    const I = {
      clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
      text: '<svg viewBox="0 0 16 16"><path d="M3 4h10M3 7h10M3 10h7M3 13h5"/></svg>',
      fire: '<svg viewBox="0 0 16 16"><path d="M3 13V9M6.3 13V7M9.7 13V5M13 13V3"/></svg>',
      week: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>',
      check: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="m5.5 8.2 1.8 1.8 3.3-3.6"/></svg>',
    };
    const wk = d.bestWeek && dateOf(d.bestWeek[0]);
    return `<div class="hx-more"><h2 class="sx-h">${escH(t('hx.records'))}</h2>
      <section class="st-card hx-recs">
        ${row(I.clock, t('hx.rDay'), d.bestDay ? dur(d.bestDay[1].sec) : '—', d.bestDay ? fmtDay(dateOf(d.bestDay[0])) : '', 0)}
        ${row(I.text, t('hx.rWords'), d.bestWords ? num(d.bestWords[1].words) : '—', d.bestWords ? fmtDay(dateOf(d.bestWords[0])) : '', 1)}
        ${row(I.fire, t('hx.rStreak'), t('st.days', d.s.best), '', 2)}
        ${row(I.week, t('hx.rWeek'), d.bestWeek ? dur(d.bestWeek[1]) : '—', wk ? `${fmtDay(wk, { day: 'numeric', month: 'short' })} – ${fmtDay(addDays(wk, 6), { day: 'numeric', month: 'short' })}` : '', 3)}
        ${row(I.check, t('hx.rArt'), d.bestDone && d.bestDone[1].done ? num(d.bestDone[1].done) : '—', d.bestDone && d.bestDone[1].done ? fmtDay(dateOf(d.bestDone[0])) : '', 4)}
      </section></div>`;
  }

  function render(host) {
    if (!host) return;
    const d = data();
    const h = host.querySelector('.st-h');
    if (h && !host.querySelector('.hx-hero')) {
      h.insertAdjacentHTML('afterend', hero(d));
      wire(host.querySelector('.hx-hero'));
      host.querySelector('.hx-hero').insertAdjacentHTML('afterend', totals(d));
    }
    // the records come after the reading charts, before Listening
    const listen = host.querySelector('.sx .sx-h');
    if (listen && !host.querySelector('.hx-more')) listen.insertAdjacentHTML('beforebegin', records(d));
    for (const sel of ['.hx-hero', '.hx-totals', '.hx-more']) Stats.odometer(host.querySelector(sel) || host, '.st-v');
  }

  const base = Stats.render;
  Stats.render = (target) => {
    base(target);
    render(target || document.getElementById('stats-body'));
  };
})();
