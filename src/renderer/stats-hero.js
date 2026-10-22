'use strict';
// The top of Statistics and two more sections (Mac only):
//  - a hero card: the streak with a living flame (grey and still when the streak is broken),
//    this week's days as small flames, and three rings for today — the daily goal
//    (Settings → Focus → Daily goal), active days this week, new words today
//  - "Facts": reading speed, pages and books, active days, the hour and weekday you read most,
//    this month against the last, translated words, the longest focus session
//  - "Records": the best day by time and by words, the longest streak, the best week
// Numbers roll in with stats-more.js's odometer. Needs stats.js, stats-more.js, app.js (state).
(() => {
  Object.assign(I18N.uz, {
    'hx.streak': 'kun ketma-ket',
    'hx.cold': "Bugun o'qing — olov yana yonadi",
    'hx.keep': "Bugun ham o'qing, olov o'chmasin",
    'hx.lit': 'Bugungi kun hisoblandi',
    'hx.best': (n) => `rekord — ${n} kun`,
    'hx.today': 'Bugun',
    'hx.goal': 'Kunlik maqsad',
    'hx.week': 'Hafta',
    'hx.newW': "Yangi so'z",
    'hx.facts': 'Qiziqarli faktlar',
    'hx.speed': "O'qish tezligi",
    'hx.speedU': (n) => `${n} so'z/daq`,
    'hx.speedS': "lug'at va yozuvlar bilan birga",
    'hx.pages': "Jami sahifalar",
    'hx.books': (n) => (n < 1 ? `bir kitobning ${Math.round(n * 100)}%` : `≈ ${n.toFixed(1)} ta kitob`),
    'hx.active': 'Faol kunlar',
    'hx.activeS': (p, n) => `${n} kundan · ${p}%`,
    'hx.hour': 'Eng faol soat',
    'hx.hourS': (m) => `jami ${m}`,
    'hx.wday': 'Eng yaxshi kun',
    'hx.wdayS': (m) => `o'rtacha ${m}`,
    'hx.month': 'Bu oy',
    'hx.weekS': (p) => (p == null ? "o'tgan hafta 0 edi" : `${p > 0 ? '+' : ''}${p}% o'tgan haftaga nisbatan`),
    'hx.monthS': (p) => (p == null ? "o'tgan oy 0 edi" : `${p > 0 ? '+' : ''}${p}% o'tgan oyga nisbatan`),
    'hx.tr': 'Tarjimali so\'zlar',
    'hx.trS': (p) => `lug'atning ${p}%`,
    'hx.long': 'Eng uzun fokus',
    'hx.longS': (d) => d,
    'hx.records': 'Rekordlar',
    'hx.rDay': "Eng ko'p o'qilgan kun",
    'hx.rWords': "Eng ko'p so'z bir kunda",
    'hx.rStreak': 'Eng uzun seriya',
    'hx.rWeek': 'Eng zo\'r hafta',
    'hx.rArt': 'Bir kunda tugatilgan maqolalar',
    'hx.none': '—',
  });
  Object.assign(I18N.en, {
    'hx.streak': 'day streak',
    'hx.cold': 'Read today and the fire comes back',
    'hx.keep': 'Read today to keep the fire going',
    'hx.lit': 'Today counts',
    'hx.best': (n) => `record — ${n} days`,
    'hx.today': 'Today',
    'hx.goal': 'Daily goal',
    'hx.week': 'Week',
    'hx.newW': 'New words',
    'hx.facts': 'Facts',
    'hx.speed': 'Reading speed',
    'hx.speedU': (n) => `${n} wpm`,
    'hx.speedS': 'with vocabulary and notes included',
    'hx.pages': 'Pages in all',
    'hx.books': (n) => (n < 1 ? `${Math.round(n * 100)}% of a book` : `≈ ${n.toFixed(1)} books`),
    'hx.active': 'Active days',
    'hx.activeS': (p, n) => `of ${n} days · ${p}%`,
    'hx.hour': 'Busiest hour',
    'hx.hourS': (m) => `${m} in all`,
    'hx.wday': 'Best weekday',
    'hx.wdayS': (m) => `${m} on average`,
    'hx.month': 'This month',
    'hx.weekS': (p) => (p == null ? 'last week was 0' : `${p > 0 ? '+' : ''}${p}% vs last week`),
    'hx.monthS': (p) => (p == null ? 'last month was 0' : `${p > 0 ? '+' : ''}${p}% vs last month`),
    'hx.tr': 'Translated words',
    'hx.trS': (p) => `${p}% of your vocabulary`,
    'hx.long': 'Longest focus',
    'hx.longS': (d) => d,
    'hx.records': 'Records',
    'hx.rDay': 'Most time in a day',
    'hx.rWords': 'Most words in a day',
    'hx.rStreak': 'Longest streak',
    'hx.rWeek': 'Best week',
    'hx.rArt': 'Articles finished in a day',
    'hx.none': '—',
  });
  Object.assign(I18N.ru, {
    'hx.streak': 'дней подряд',
    'hx.cold': 'Почитайте сегодня — огонь вернётся',
    'hx.keep': 'Почитайте сегодня, чтобы огонь не погас',
    'hx.lit': 'Сегодняшний день засчитан',
    'hx.best': (n) => `рекорд — ${n} дн.`,
    'hx.today': 'Сегодня',
    'hx.goal': 'Цель дня',
    'hx.week': 'Неделя',
    'hx.newW': 'Новые слова',
    'hx.facts': 'Интересные факты',
    'hx.speed': 'Скорость чтения',
    'hx.speedU': (n) => `${n} сл/мин`,
    'hx.speedS': 'вместе со словарём и заметками',
    'hx.pages': 'Всего страниц',
    'hx.books': (n) => (n < 1 ? `${Math.round(n * 100)}% книги` : `≈ ${n.toFixed(1)} книг`),
    'hx.active': 'Активные дни',
    'hx.activeS': (p, n) => `из ${n} дн. · ${p}%`,
    'hx.hour': 'Самый активный час',
    'hx.hourS': (m) => `всего ${m}`,
    'hx.wday': 'Лучший день недели',
    'hx.wdayS': (m) => `в среднем ${m}`,
    'hx.month': 'Этот месяц',
    'hx.weekS': (p) => (p == null ? 'на прошлой неделе было 0' : `${p > 0 ? '+' : ''}${p}% к прошлой неделе`),
    'hx.monthS': (p) => (p == null ? 'в прошлом месяце было 0' : `${p > 0 ? '+' : ''}${p}% к прошлому месяцу`),
    'hx.tr': 'Слова с переводом',
    'hx.trS': (p) => `${p}% словаря`,
    'hx.long': 'Самый долгий фокус',
    'hx.longS': (d) => d,
    'hx.records': 'Рекорды',
    'hx.rDay': 'Больше всего времени за день',
    'hx.rWords': 'Больше всего слов за день',
    'hx.rStreak': 'Самая длинная серия',
    'hx.rWeek': 'Лучшая неделя',
    'hx.rArt': 'Статей дочитано за день',
    'hx.none': '—',
  });

  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => new Intl.NumberFormat(lang).format(Math.round(n));
  const fmtDay = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) => new Intl.DateTimeFormat(lang, o).format(d);
  const dur = (sec) => {
    const m = Math.round(sec / 60);
    return m < 60 ? t('st.min', m) : t('st.hm', Math.floor(m / 60), m % 60);
  };
  const wdOf = (d) => (d.getDay() + 6) % 7;
  const dateOf = (k) => new Date(k + 'T00:00');

  // a flame: an outer tongue and an inner one, each flickering on its own beat
  // a flame: an outer tongue and an inner one, each breathing on its own beat. Each tongue is
  // its own HTML layer holding its own SVG, so the motion runs on the compositor (a transform on
  // an SVG <g> would repaint every frame on the main thread).
  const FLAME = `<div class="hx-flame" aria-hidden="true">
    <span class="hx-fo"><svg viewBox="0 0 24 30">
      <defs><linearGradient id="hx-fo" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3b00"/><stop offset=".55" stop-color="#ff7a00"/><stop offset="1" stop-color="#ffb300"/></linearGradient></defs>
      <path class="hx-glow" d="M12 1.5c.8 4.6 6.8 7.4 6.8 15.2A6.8 6.8 0 0 1 5.2 16.7c0-3 1.4-5.3 3-6.7-.1 2.4.9 3.9 2.4 4.3-.4-4.9-.2-8.8 1.4-12.8z"/>
      <path d="M12 1.5c.8 4.6 6.8 7.4 6.8 15.2A6.8 6.8 0 0 1 5.2 16.7c0-3 1.4-5.3 3-6.7-.1 2.4.9 3.9 2.4 4.3-.4-4.9-.2-8.8 1.4-12.8z" fill="url(#hx-fo)"/>
    </svg></span>
    <span class="hx-fi"><svg viewBox="0 0 24 30">
      <defs><linearGradient id="hx-fi" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ffd23f"/><stop offset="1" stop-color="#fff4c2"/></linearGradient></defs>
      <path d="M12 13.2c1.9 1.9 3.3 3.6 3.3 5.9a3.3 3.3 0 0 1-6.6 0c0-1.8 1-3 2-4 .1 1.3.6 2 1.3 2.2-.1-1.5-.2-2.7 0-4.1z" fill="url(#hx-fi)"/>
    </svg></span>
  </div>`;
  const mini = (on) => `<svg class="hx-mini${on ? ' on' : ''}" viewBox="0 0 24 30" aria-hidden="true"><path d="M12 1.5c.8 4.6 6.8 7.4 6.8 15.2A6.8 6.8 0 0 1 5.2 16.7c0-3 1.4-5.3 3-6.7-.1 2.4.9 3.9 2.4 4.3-.4-4.9-.2-8.8 1.4-12.8z"/></svg>`;

  function data() {
    const st = state.notes.stats || {};
    const days = st.days || {};
    const today = new Date();
    const s = Stats.summary();
    const active = (k) => !!days[k] && (days[k].sec >= 60 || days[k].words >= 20);
    const used = Object.keys(days).filter((k) => days[k].sec || days[k].words).sort();
    const first = used.length ? dateOf(used[0]) : today;
    const span = Math.max(1, Math.round((today - first) / 864e5) + 1);
    const nActive = Object.keys(days).filter(active).length;

    const monday = addDays(today, -wdOf(today));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return { d, on: active(key(d)), future: d > today, today: key(d) === key(today) };
    });

    const goal = (state.notes.settings && state.notes.settings.goalMin) || 15;
    const vocab = Object.values(state.notes.articles || {}).flatMap((a) => (a && a.vocab) || []);
    const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();

    const hours = st.hours || Array(24).fill(0);
    const topHour = hours.reduce((b, v, i) => (v > hours[b] ? i : b), 0);
    const wdSum = Array(7).fill(0);
    const wdN = Array(7).fill(0);
    for (let d = first; d <= today; d = addDays(d, 1)) {
      wdSum[wdOf(d)] += (days[key(d)] && days[key(d)].sec) || 0;
      wdN[wdOf(d)]++;
    }
    const wdAvg = wdSum.map((v, i) => (wdN[i] ? v / wdN[i] : 0));
    const topWd = wdAvg.reduce((b, v, i) => (v > wdAvg[b] ? i : b), 0);

    const monthSec = (y, m) => Object.entries(days).filter(([k]) => { const d = dateOf(k); return d.getFullYear() === y && d.getMonth() === m; }).reduce((a, [, v]) => a + (v.sec || 0), 0);
    const thisM = monthSec(today.getFullYear(), today.getMonth());
    const lm = new Date(today.getFullYear(), today.getMonth() - 1, 1);
    const lastM = monthSec(lm.getFullYear(), lm.getMonth());

    const entries = Object.entries(days);
    const top = (f) => entries.reduce((b, e) => (f(e[1]) > (b ? f(b[1]) : 0) ? e : b), null);
    const bestDay = top((v) => v.sec || 0);
    const bestWords = top((v) => v.words || 0);
    const bestDone = top((v) => v.done || 0);
    // weeks, Monday to Sunday
    const weeks = {};
    for (const [k, v] of entries) {
      const d = dateOf(k);
      const m = key(addDays(d, -wdOf(d)));
      weeks[m] = (weeks[m] || 0) + (v.sec || 0);
    }
    const bestWeek = Object.entries(weeks).reduce((b, e) => (e[1] > (b ? b[1] : 0) ? e : b), null);
    const log = (st.focus && st.focus.log) || [];
    const longest = log.reduce((b, x) => (x.sec > (b ? b.sec : 0) ? x : b), null);

    // the week so far against the same days of the last one
    const upto = wdOf(today);
    let weekSec = 0;
    let lastSec = 0;
    for (let i = 0; i <= upto; i++) {
      weekSec += (days[key(addDays(monday, i))] || {}).sec || 0;
      lastSec += (days[key(addDays(monday, i - 7))] || {}).sec || 0;
    }

    return {
      s, week, goal, today: s.today,
      weekSec, weekP: lastSec ? Math.round(((weekSec - lastSec) / lastSec) * 100) : null,
      newToday: vocab.filter((v) => (v.at || 0) >= startToday).length,
      litToday: active(key(today)),
      wpm: s.totalSec >= 60 ? Math.round(s.totalWords / (s.totalSec / 60)) : 0,
      pages: Math.round(s.totalWords / 250),
      books: s.totalWords / 80000, // an average novel
      nActive, span,
      topHour, hourSec: hours[topHour] || 0,
      topWd, wdAvg: wdAvg[topWd],
      thisM, monthP: lastM ? Math.round(((thisM - lastM) / lastM) * 100) : null,
      tr: vocab.filter((v) => v.tr && String(v.tr).trim()).length, vocabN: vocab.length,
      longest,
      bestDay, bestWords, bestDone, bestWeek,
    };
  }

  // three rings for today, ink only: an arc on a faint track, drawn in when shown
  function rings(d) {
    const R = [['goal', d.today.sec / 60, d.goal, t('hx.goal'), `${Math.round(d.today.sec / 60)}/${d.goal} ${t('st.min', '').trim()}`],
      ['week', d.week.filter((x) => x.on).length, 7, t('hx.week'), `${d.week.filter((x) => x.on).length}/7`],
      ['vocab', d.newToday, 10, t('hx.newW'), `${d.newToday}/10`]];
    const C = 64;
    const radii = [56, 42, 28];
    const svg = `<svg class="hx-rings" viewBox="0 0 ${C * 2} ${C * 2}" aria-hidden="true">${R.map(([, v, max], i) => {
      const r = radii[i];
      const len = 2 * Math.PI * r;
      const k = Math.min(1, max ? v / max : 0);
      return `<circle class="hx-track" cx="${C}" cy="${C}" r="${r}"/><circle class="hx-arc r${i}" cx="${C}" cy="${C}" r="${r}" style="--len:${len.toFixed(1)};--off:${(len * (1 - k)).toFixed(1)};--i:${i}" transform="rotate(-90 ${C} ${C})"/>`;
    }).join('')}</svg>`;
    const legend = R.map(([, , , l, v], i) => `<div class="hx-lg"><i class="r${i}"></i><span>${escH(l)}</span><b>${escH(v)}</b></div>`).join('');
    return `<div class="hx-today"><div class="hx-k">${escH(t('hx.today'))}</div><div class="hx-rw">${svg}<div class="hx-legend">${legend}</div></div></div>`;
  }

  function hero(d) {
    const n = d.s.streak;
    const wd = t('sx.wd');
    const msg = !n ? t('hx.cold') : d.litToday ? t('hx.lit') : t('hx.keep');
    return `<section class="hx-hero">
      <div class="hx-streak${n ? ' lit' : ''}">
        <div class="hx-fire">${FLAME}</div>
        <div class="hx-sn">
          <div class="st-v hx-big">${num(n)}</div>
          <div class="hx-sl">${escH(t('hx.streak'))}</div>
          <div class="hx-msg">${escH(msg)} · ${escH(t('hx.best', d.s.best))}</div>
          <div class="hx-week">${d.week.map((x, i) => `<div class="hx-day${x.today ? ' now' : ''}${x.future ? ' future' : ''}">${mini(x.on)}<span>${escH(wd[i])}</span></div>`).join('')}</div>
        </div>
      </div>
      ${rings(d)}
    </section>`;
  }

  const tile = (k, v, sub, i) => `<div class="st-tile" style="animation-delay:${i * 40}ms"><div class="st-k">${escH(k)}</div><div class="st-v">${escH(v)}</div><div class="st-s">${escH(sub)}</div></div>`;

  function facts(d) {
    const wd = t('sx.wd');
    return `<h2 class="sx-h">${escH(t('hx.facts'))}</h2>
      <div class="st-tiles">
        ${tile(t('hx.speed'), d.wpm ? t('hx.speedU', d.wpm) : '—', t('hx.speedS'), 0)}
        ${tile(t('hx.pages'), num(d.pages), t('hx.books', d.books), 1)}
        ${tile(t('hx.active'), num(d.nActive), t('hx.activeS', Math.round((d.nActive / d.span) * 100), d.span), 2)}
        ${tile(t('hx.month'), dur(d.thisM), t('hx.monthS', d.monthP), 3)}
      </div>
      <div class="st-tiles st-extra">
        ${tile(t('hx.hour'), d.hourSec ? `${pad(d.topHour)}:00` : '—', d.hourSec ? t('hx.hourS', dur(d.hourSec)) : '', 4)}
        ${tile(t('hx.wday'), d.wdAvg ? wd[d.topWd] : '—', d.wdAvg ? t('hx.wdayS', dur(d.wdAvg)) : '', 5)}
        ${tile(t('hx.tr'), num(d.tr), d.vocabN ? t('hx.trS', Math.round((d.tr / d.vocabN) * 100)) : '', 6)}
        ${tile(t('hx.long'), d.longest ? dur(d.longest.sec) : '—', d.longest ? fmtDay(new Date(d.longest.t)) : '', 7)}
      </div>`;
  }

  function records(d) {
    const row = (icon, label, val, when, i) => `<div class="hx-rec" style="animation-delay:${i * 50}ms"><span class="hx-ri">${icon}</span><span class="hx-rl">${escH(label)}<small>${escH(when)}</small></span><b class="st-v">${escH(val)}</b></div>`;
    const I = {
      clock: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>',
      text: '<svg viewBox="0 0 16 16"><path d="M3 4h10M3 7h10M3 10h7M3 13h5"/></svg>',
      fire: '<svg viewBox="0 0 24 30"><path d="M12 1.5c.8 4.6 6.8 7.4 6.8 15.2A6.8 6.8 0 0 1 5.2 16.7c0-3 1.4-5.3 3-6.7-.1 2.4.9 3.9 2.4 4.3-.4-4.9-.2-8.8 1.4-12.8z"/></svg>',
      week: '<svg viewBox="0 0 16 16"><rect x="2.5" y="3.5" width="11" height="10" rx="2"/><path d="M2.5 6.5h11M5.5 2v3M10.5 2v3"/></svg>',
      check: '<svg viewBox="0 0 16 16"><circle cx="8" cy="8" r="6"/><path d="m5.5 8.2 1.8 1.8 3.3-3.6"/></svg>',
    };
    const wk = d.bestWeek && dateOf(d.bestWeek[0]);
    return `<h2 class="sx-h">${escH(t('hx.records'))}</h2>
      <section class="st-card hx-recs">
        ${row(I.clock, t('hx.rDay'), d.bestDay ? dur(d.bestDay[1].sec) : '—', d.bestDay ? fmtDay(dateOf(d.bestDay[0])) : '', 0)}
        ${row(I.text, t('hx.rWords'), d.bestWords ? num(d.bestWords[1].words) : '—', d.bestWords ? fmtDay(dateOf(d.bestWords[0])) : '', 1)}
        ${row(I.fire, t('hx.rStreak'), t('st.days', d.s.best), '', 2)}
        ${row(I.week, t('hx.rWeek'), d.bestWeek ? dur(d.bestWeek[1]) : '—', wk ? `${fmtDay(wk, { day: 'numeric', month: 'short' })} – ${fmtDay(addDays(wk, 6), { day: 'numeric', month: 'short' })}` : '', 3)}
        ${row(I.check, t('hx.rArt'), d.bestDone && d.bestDone[1].done ? num(d.bestDone[1].done) : '—', d.bestDone && d.bestDone[1].done ? fmtDay(dateOf(d.bestDone[0])) : '', 4)}
      </section>`;
  }

  function render(host) {
    if (!host) return;
    const d = data();
    const h = host.querySelector('.st-h');
    if (h && !host.querySelector('.hx-hero')) {
      h.insertAdjacentHTML('afterend', hero(d));
      // scrolled out of sight, the flame rests (and carries on when it comes back)
      const card = host.querySelector('.hx-streak');
      new IntersectionObserver(([e]) => card.classList.toggle('away', !e.isIntersecting)).observe(card);
    }
    const sx = host.querySelector('.sx');
    if (sx && !host.querySelector('.hx-more')) sx.insertAdjacentHTML('beforebegin', `<div class="hx-more">${facts(d)}${records(d)}</div>`);
    // the streak is in the hero already: the tile row under it shows the week instead
    const tiles = host.querySelectorAll('.st-tiles:not(.st-extra) .st-tile');
    if (tiles[2] && !tiles[2].classList.contains('hx-wk')) {
      tiles[2].outerHTML = tile(t('rc.week'), dur(d.weekSec), t('hx.weekS', d.weekP), 2).replace('class="st-tile"', 'class="st-tile hx-wk"');
      Stats.odometer(host.querySelector('.hx-wk'), '.st-v');
    }
    Stats.odometer(host.querySelector('.hx-hero') || host, '.hx-big');
    Stats.odometer(host.querySelector('.hx-more') || host, '.st-v');
  }

  const base = Stats.render;
  Stats.render = (target) => {
    base(target);
    render(target || document.getElementById('stats-body'));
  };
})();
