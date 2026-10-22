'use strict';
// Day and week recaps (Mac only), opened from the two cards at the top of Statistics.
// A recap is a run of full-window slides, one fact each: time, words, articles, new words,
// focus, listening, the streak, then a verdict. Nothing slides across: a slide melts away through
// a blur where it stands and the next one's parts come in through a blur one after another,
// numbers roll like the stats tiles (stats-more.js odometer), bars rise, dots pop, and every part
// that lands is a tap on the trackpad (haptic.js). The bar on top runs each slide's time;
// click / → / space = next, ← = back, holding the pointer down pauses, Esc closes.
// Needs stats.js, stats-more.js, i18n.js, app.js (state) and haptic.js.
const Recap = (() => {
  const UZ = {
    'rc.day': 'Bugun',
    'rc.week': 'Bu hafta',
    'rc.open': "Ko'rish",
    'rc.dayT': 'Kuningiz',
    'rc.weekT': 'Haftangiz',
    'rc.daySub': 'bir qarashda',
    'rc.weekSub': 'yetti kun, bir qarashda',
    'rc.time': "O'qish vaqti",
    'rc.min': 'daqiqa',
    'rc.words': "O'qilgan so'zlar",
    'rc.pages': (p) => `≈ ${p} sahifa kitob`,
    'rc.avg': (m) => `30 kunlik o'rtachangiz — ${m} daq`,
    'rc.vsY': 'kechagidan',
    'rc.vsW': "o'tgan haftadan",
    'rc.newY': 'kecha 0 edi',
    'rc.newW': "o'tgan hafta 0 edi",
    'rc.arts': 'Ochilgan maqolalar',
    'rc.done': (n) => `${n} tasi oxirigacha o'qildi`,
    'rc.vocab': "Yangi so'zlar",
    'rc.vocabSub': (n) => (n ? `${n} tasi kartochkada o'rganildi` : "lug'atingizga qo'shildi"),
    'rc.focus': 'Chuqur fokus',
    'rc.sessions': (n) => `${n} ta sessiya`,
    'rc.listen': 'Tinglash',
    'rc.listenSub': (n) => (n ? `${n} so'z yozdingiz` : 'ingliz tilida, quloq bilan'),
    'rc.streak': 'Ketma-ket kunlar',
    'rc.best': (n) => `eng uzuni — ${n} kun`,
    'rc.days': 'kun',
    'rc.active': 'Faol kunlar',
    'rc.of7': (n) => `yetti kundan ${n} kun`,
    'rc.chart': 'Kunlar kesimida',
    'rc.bestDay': (d, m) => `Eng zo'r kun — ${d}, ${m} daq`,
    'rc.v.upD': "Kechagidan ko'proq o'qidingiz",
    'rc.v.upW': "O'tgan haftadan ko'proq",
    'rc.v.avg': "O'rtachangizdan yuqori",
    'rc.v.steady': 'Barqaror davom etyapsiz',
    'rc.v.low': 'Ertaga yana davom etamiz',
    'rc.v.lowW': 'Keyingi hafta — yangi imkoniyat',
    'rc.v.none': "Bugun hali o'qilmadi",
    'rc.toWeek': "Haftani ko'rish",
    'rc.toDay': "Kunni ko'rish",
    'rc.again': 'Qaytadan',
    'rc.close': 'Yopish',
    'rc.hint': '← →  ·  Esc',
  };
  const EN = {
    'rc.day': 'Today',
    'rc.week': 'This week',
    'rc.open': 'View',
    'rc.dayT': 'Your day',
    'rc.weekT': 'Your week',
    'rc.daySub': 'at a glance',
    'rc.weekSub': 'seven days at a glance',
    'rc.time': 'Time reading',
    'rc.min': 'minutes',
    'rc.words': 'Words read',
    'rc.pages': (p) => `≈ ${p} book pages`,
    'rc.avg': (m) => `your 30-day average — ${m} min`,
    'rc.vsY': 'than yesterday',
    'rc.vsW': 'than last week',
    'rc.newY': 'yesterday was 0',
    'rc.newW': 'last week was 0',
    'rc.arts': 'Articles opened',
    'rc.done': (n) => `${n} read to the end`,
    'rc.vocab': 'New words',
    'rc.vocabSub': (n) => (n ? `${n} learned on the cards` : 'added to your vocabulary'),
    'rc.focus': 'Deep focus',
    'rc.sessions': (n) => `${n} ${n === 1 ? 'session' : 'sessions'}`,
    'rc.listen': 'Listening',
    'rc.listenSub': (n) => (n ? `${n} words written` : 'English, by ear'),
    'rc.streak': 'Day streak',
    'rc.best': (n) => `longest — ${n} days`,
    'rc.days': 'days',
    'rc.active': 'Active days',
    'rc.of7': (n) => `${n} of seven days`,
    'rc.chart': 'Day by day',
    'rc.bestDay': (d, m) => `Best day — ${d}, ${m} min`,
    'rc.v.upD': 'You read more than yesterday',
    'rc.v.upW': 'More than last week',
    'rc.v.avg': 'Above your average',
    'rc.v.steady': "You're keeping it steady",
    'rc.v.low': 'Tomorrow we keep going',
    'rc.v.lowW': 'Next week is a fresh start',
    'rc.v.none': 'No reading yet today',
    'rc.toWeek': 'See the week',
    'rc.toDay': 'See the day',
    'rc.again': 'Again',
    'rc.close': 'Close',
    'rc.hint': '← →  ·  Esc',
  };
  const RU = {
    'rc.day': 'Сегодня',
    'rc.week': 'Эта неделя',
    'rc.open': 'Смотреть',
    'rc.dayT': 'Ваш день',
    'rc.weekT': 'Ваша неделя',
    'rc.daySub': 'одним взглядом',
    'rc.weekSub': 'семь дней одним взглядом',
    'rc.time': 'Время чтения',
    'rc.min': 'минут',
    'rc.words': 'Прочитано слов',
    'rc.pages': (p) => `≈ ${p} стр. книги`,
    'rc.avg': (m) => `среднее за 30 дней — ${m} мин`,
    'rc.vsY': 'чем вчера',
    'rc.vsW': 'чем на прошлой неделе',
    'rc.newY': 'вчера было 0',
    'rc.newW': 'на прошлой неделе было 0',
    'rc.arts': 'Открытые статьи',
    'rc.done': (n) => `до конца: ${n}`,
    'rc.vocab': 'Новые слова',
    'rc.vocabSub': (n) => (n ? `выучено на карточках: ${n}` : 'добавлены в словарь'),
    'rc.focus': 'Глубокий фокус',
    'rc.sessions': (n) => `сессий: ${n}`,
    'rc.listen': 'Аудирование',
    'rc.listenSub': (n) => (n ? `написано слов: ${n}` : 'английский на слух'),
    'rc.streak': 'Дней подряд',
    'rc.best': (n) => `рекорд — ${n} дн.`,
    'rc.days': 'дн.',
    'rc.active': 'Активные дни',
    'rc.of7': (n) => `${n} из семи дней`,
    'rc.chart': 'По дням',
    'rc.bestDay': (d, m) => `Лучший день — ${d}, ${m} мин`,
    'rc.v.upD': 'Вы прочитали больше, чем вчера',
    'rc.v.upW': 'Больше, чем на прошлой неделе',
    'rc.v.avg': 'Выше вашего среднего',
    'rc.v.steady': 'Вы держите ритм',
    'rc.v.low': 'Завтра продолжим',
    'rc.v.lowW': 'Следующая неделя — новый старт',
    'rc.v.none': 'Сегодня ещё не читали',
    'rc.toWeek': 'Неделя',
    'rc.toDay': 'День',
    'rc.again': 'Ещё раз',
    'rc.close': 'Закрыть',
    'rc.hint': '← →  ·  Esc',
  };
  Object.assign(I18N.uz, UZ);
  Object.assign(I18N.en, EN);
  Object.assign(I18N.ru, RU);

  const pad = (n) => String(n).padStart(2, '0');
  const key = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const escH = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const num = (n) => new Intl.NumberFormat(lang).format(Math.round(n));
  const fmtDay = (d, o) => new Intl.DateTimeFormat(lang, o).format(d);
  const wdOf = (d) => (d.getDay() + 6) % 7; // Monday = 0
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');

  /* ---------------- the numbers ---------------- */

  function data(kind) {
    const st = state.notes.stats || {};
    const days = st.days || {};
    const fdays = (st.focus && st.focus.days) || {};
    const ldays = (state.notes.listen && state.notes.listen.days) || {};
    const today = new Date();
    const n = kind === 'week' ? wdOf(today) + 1 : 1; // the week so far, from Monday
    const span = (back) => Array.from({ length: n }, (_, i) => addDays(today, -back - (n - 1 - i)));
    const now = span(0);
    const then = span(kind === 'week' ? 7 : 1); // the same stretch a week (or a day) before
    const sum = (list, f) => list.reduce((s, d) => s + (f(key(d)) || 0), 0);
    const sec = (k) => days[k] && days[k].sec;
    const from = now[0].getTime();
    const arts = state.notes.articles || {};
    const opened = state.list
      .filter((m) => arts[m.id] && arts[m.id].opened >= from)
      .sort((a, b) => arts[b.id].opened - arts[a.id].opened)
      .map((m) => ({ title: m.title || m.id, p: Math.min(1, arts[m.id].progress || 0) }));
    const vocab = Object.values(arts).flatMap((a) => (a && a.vocab) || []).filter((v) => (v.at || 0) >= from);
    const s = Stats.summary();
    const active = (d) => !!days[key(d)] && (days[key(d)].sec >= 60 || days[key(d)].words >= 20);
    const monday = addDays(today, -wdOf(today));
    const week = Array.from({ length: 7 }, (_, i) => {
      const d = addDays(monday, i);
      return { d, min: (sec(key(d)) || 0) / 60, on: active(d), future: d > today };
    });
    return {
      kind,
      sec: sum(now, sec),
      was: sum(then, sec),
      words: sum(now, (k) => days[k] && days[k].words),
      done: sum(now, (k) => days[k] && days[k].done),
      fsec: sum(now, (k) => fdays[k] && fdays[k].sec),
      fsessions: sum(now, (k) => fdays[k] && fdays[k].sessions),
      lsec: sum(now, (k) => ldays[k]),
      opened,
      vocab,
      learned: vocab.filter((v) => v.srs && v.srs.ivl >= 21).length,
      avg: s.avgSec,
      streak: s.streak,
      best: s.best,
      week,
      first: now[0],
    };
  }

  /* ---------------- the slides ---------------- */

  // parts come in one after another: --d is each one's delay
  let order = 0;
  const part = (html, cls = '') => `<div class="rc-in ${cls}" style="--d:${order++ * 110 + 120}ms">${html}</div>`;
  const label = (txt) => part(`<span class="rc-k">${escH(txt)}</span>`);
  const big = (n, unit = '') => part(`<div class="rc-big"><span class="rc-n">${escH(num(n))}</span>${unit ? `<span class="rc-u">${escH(unit)}</span>` : ''}</div>`);
  const sub = (txt) => (txt ? part(`<p class="rc-sub">${escH(txt)}</p>`) : '');
  const ARROW = '<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M6 10V2M2.5 5.5 6 2l3.5 3.5"/></svg>';
  function chip(a, b, kind) {
    if (!a && !b) return '';
    if (!b) return part(`<span class="rc-chip up">${ARROW}<em>${escH(t(kind === 'week' ? 'rc.newW' : 'rc.newY'))}</em></span>`);
    const p = Math.round(((a - b) / b) * 100);
    const dir = p > 0 ? 'up' : p < 0 ? 'down' : 'flat';
    return part(`<span class="rc-chip ${dir}">${dir === 'flat' ? '' : ARROW}<b>${Math.abs(p)}%</b><em>${escH(t(kind === 'week' ? 'rc.vsW' : 'rc.vsY'))}</em></span>`);
  }
  // a title whose letters come in one by one (like the launch card), a tap each
  const letters = (txt) => part(`<h2 class="rc-title">${[...txt].map((c, i) => `<span class="rc-l" style="--j:${i}">${c === ' ' ? '&nbsp;' : escH(c)}</span>`).join('')}</h2>`);

  function slides(d) {
    const W = d.kind === 'week';
    const list = [];
    const add = (build, ms = 5200, feel) => {
      order = 0;
      list.push({ html: build(), ms, feel });
    };
    const min = Math.round(d.sec / 60);

    add(() => letters(t(W ? 'rc.weekT' : 'rc.dayT')) + sub(t(W ? 'rc.weekSub' : 'rc.daySub')), 3400, 'letters');

    add(() => label(t('rc.time')) + big(min, t('rc.min')) + chip(d.sec, d.was, d.kind) + sub(W ? '' : t('rc.avg', Math.round(d.avg / 60))));

    if (W) {
      const top = d.week.reduce((b, x) => (x.min > b.min ? x : b), d.week[0]);
      const max = Math.max(1, ...d.week.map((x) => x.min));
      const wd = t('sx.wd');
      add(() =>
        label(t('rc.chart'))
        + part(`<div class="rc-bars">${d.week.map((x, i) => `<div class="rc-col${x === top && x.min ? ' top' : ''}${x.future ? ' future' : ''}"><i style="--h:${Math.max(0.02, x.min / max)};--k:${i}"></i><span>${escH(wd[i])}</span></div>`).join('')}</div>`, 'rc-wide')
        + sub(top.min >= 1 ? t('rc.bestDay', fmtDay(top.d, { weekday: 'long' }), Math.round(top.min)) : ''), 5600, 'bars');
    }

    if (d.words >= 1) add(() => label(t('rc.words')) + big(d.words) + sub(t('rc.pages', Math.max(1, Math.round(d.words / 250)))));

    if (d.opened.length) {
      const shown = d.opened.slice(0, 6);
      add(() =>
        label(t('rc.arts'))
        + shown.map((a) => part(`<div class="rc-art"><span>${escH(a.title)}</span><i style="--p:${a.p}"></i></div>`, 'rc-wide')).join('')
        + sub(d.done ? t('rc.done', d.done) : ''), 3800 + shown.length * 300, 'parts');
    }

    if (d.vocab.length) {
      const words = [...new Set(d.vocab.map((v) => String(v.word || '').trim()).filter(Boolean))].slice(0, 14);
      add(() =>
        label(t('rc.vocab')) + big(d.vocab.length)
        + part(`<div class="rc-words">${words.map((w, i) => `<span style="--k:${i}">${escH(w)}</span>`).join('')}</div>`, 'rc-wide')
        + sub(t('rc.vocabSub', d.learned)), 4400 + words.length * 120, 'words');
    }

    if (d.fsec >= 60) add(() => label(t('rc.focus')) + big(Math.round(d.fsec / 60), t('rc.min')) + sub(t('rc.sessions', d.fsessions)));
    if (d.lsec >= 30) add(() => label(t('rc.listen')) + big(Math.max(1, Math.round(d.lsec / 60)), t('rc.min')) + sub(t('rc.listenSub', 0)));

    const dots = () => part(`<div class="rc-dots">${d.week.map((x, i) => `<i class="${x.on ? 'on' : ''}${x.future ? ' future' : ''}" style="--k:${i}"></i>`).join('')}</div><div class="rc-dl">${t('sx.wd').map((w) => `<span>${escH(w)}</span>`).join('')}</div>`);
    if (W) add(() => label(t('rc.active')) + big(d.week.filter((x) => x.on).length, t('rc.days')) + dots() + sub(t('rc.of7', d.week.filter((x) => x.on).length)), 5200, 'dots');
    else if (d.streak) add(() => label(t('rc.streak')) + big(d.streak, t('rc.days')) + dots() + sub(t('rc.best', d.best)), 5200, 'dots');

    // the verdict, and everything once more in small
    const up = d.was ? d.sec > d.was * 1.05 : d.sec > 0;
    const verdict = !d.sec ? (W ? 'rc.v.lowW' : 'rc.v.none')
      : up ? (W ? 'rc.v.upW' : 'rc.v.upD')
      : !W && d.sec > d.avg ? 'rc.v.avg'
      : d.was && d.sec >= d.was * 0.8 ? 'rc.v.steady'
      : W ? 'rc.v.lowW' : 'rc.v.low';
    const cell = (k, v) => `<div><b>${escH(v)}</b><span>${escH(k)}</span></div>`;
    add(() =>
      letters(t(verdict))
      + part(`<div class="rc-grid">${[
        cell(t('rc.time'), `${min} ${t('rc.min')}`),
        cell(t('rc.words'), num(d.words)),
        cell(t('rc.vocab'), num(d.vocab.length)),
        cell(W ? t('rc.active') : t('rc.streak'), `${W ? d.week.filter((x) => x.on).length : d.streak} ${t('rc.days')}`),
      ].join('')}</div>`, 'rc-wide')
      + part(`<div class="rc-acts"><button class="btn outline" data-rc="${W ? 'day' : 'week'}">${escH(t(W ? 'rc.toDay' : 'rc.toWeek'))}</button><button class="btn ghost" data-rc="again">${escH(t('rc.again'))}</button><button class="btn solid" data-rc="close">${escH(t('rc.close'))}</button></div>`), 0, 'letters');
    return list;
  }

  /* ---------------- the player ---------------- */

  let root = null;
  let list = [];
  let cur = -1;
  let run = null; // the progress animation of the slide on show
  let kind = 'day';
  let timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const clear = () => (timers.forEach(clearTimeout), (timers = []));

  function mount() {
    root = document.createElement('div');
    root.id = 'recap';
    root.innerHTML = `<div class="rc-top"><div class="rc-prog"></div><div class="rc-head"><span class="rc-kicker"></span><button class="rc-x" data-rc="close" aria-label="${escH(t('rc.close'))}">×</button></div></div><div class="rc-stage"></div><div class="rc-hint">${escH(t('rc.hint'))}</div>`;
    document.body.appendChild(root);
    root.addEventListener('click', (e) => {
      const b = e.target.closest('[data-rc]');
      if (b) {
        e.stopPropagation();
        const a = b.dataset.rc;
        if (a === 'close') return close();
        if (a === 'again') return go(0);
        return open(a);
      }
      if (e.target.closest('button, a')) return;
      if (e.clientX < innerWidth * 0.3) go(cur - 1);
      else go(cur + 1);
    });
    // holding down pauses, like a story
    root.addEventListener('pointerdown', (e) => {
      if (e.target.closest('button')) return;
      if (run && run.playState === 'running') run.pause(), root.classList.add('held');
    });
    addEventListener('pointerup', () => {
      if (!root.classList.contains('held')) return;
      root.classList.remove('held');
      if (run && run.playState === 'paused') run.play();
    });
  }

  function open(k) {
    if (!root) mount();
    clear();
    kind = k === 'week' ? 'week' : 'day';
    list = slides(data(kind));
    const d0 = data(kind).first;
    root.querySelector('.rc-kicker').textContent = kind === 'week'
      ? `${t('rc.week')} · ${fmtDay(d0, { day: 'numeric', month: 'short' })} – ${fmtDay(new Date(), { day: 'numeric', month: 'short' })}`
      : `${t('rc.day')} · ${fmtDay(new Date(), { weekday: 'long', day: 'numeric', month: 'long' })}`;
    root.querySelector('.rc-prog').innerHTML = list.map(() => '<i><b></b></i>').join('');
    root.querySelector('.rc-stage').innerHTML = '';
    cur = -1;
    if (!root.classList.contains('show')) {
      root.classList.remove('out');
      void root.offsetWidth;
      root.classList.add('show');
    }
    document.body.classList.add('recap-on');
    go(0);
  }

  function close() {
    if (!root || !root.classList.contains('show')) return;
    clear();
    if (run) run.cancel(), (run = null);
    root.classList.add('out');
    root.classList.remove('show');
    document.body.classList.remove('recap-on');
    later(520, () => {
      root.classList.remove('out');
      root.querySelector('.rc-stage').innerHTML = '';
    });
  }

  function go(i) {
    if (i < 0) i = 0;
    if (i >= list.length) return close();
    if (i === cur) return;
    clear();
    cur = i;
    const stage = root.querySelector('.rc-stage');
    // the slide on show melts away where it stands
    stage.querySelectorAll('.rc-slide:not(.gone)').forEach((s) => {
      s.classList.add('gone');
      setTimeout(() => s.remove(), 420);
    });
    const s = list[i];
    const el = document.createElement('div');
    el.className = 'rc-slide';
    el.innerHTML = s.html;
    stage.appendChild(el);
    Haptic.level();
    if (!reduce.matches) {
      // a tap as each part lands, and as each digit of a number settles
      el.querySelectorAll('.rc-in').forEach((p) => later(parseFloat(p.style.getPropertyValue('--d')) + 200, Haptic.align));
      Stats.odometer(el, '.rc-n, .rc-chip b');
      el.querySelectorAll('.od').forEach((od) => later(+od.dataset.n * 50 + +od.dataset.k * 70 + 80 + 720 + 120, Haptic.align));
      const each = (sel, step, at = 0) => el.querySelectorAll(sel).forEach((x, k) => later(at + k * step, Haptic.align));
      if (s.feel === 'letters') each('.rc-l', 45, 160);
      if (s.feel === 'bars') each('.rc-col i', 90, 420);
      if (s.feel === 'words') each('.rc-words span', 70, 540);
      if (s.feel === 'dots') el.querySelectorAll('.rc-dots i').forEach((x, k) => x.classList.contains('on') && later(560 + k * 90, Haptic.level));
    }
    // the bar on top: the ones before are full, this one runs, the rest wait
    const bars = [...root.querySelectorAll('.rc-prog b')];
    bars.forEach((b, j) => {
      b.getAnimations().forEach((a) => a.cancel());
      b.style.transform = j < i ? 'scaleX(1)' : 'scaleX(0)';
    });
    if (run) run.cancel();
    run = null;
    if (s.ms) {
      run = bars[i].animate([{ transform: 'scaleX(0)' }, { transform: 'scaleX(1)' }], { duration: s.ms, easing: 'linear', fill: 'forwards' });
      run.finished.then(() => cur === i && go(i + 1), () => {});
    } else bars[i].style.transform = 'scaleX(1)';
  }

  addEventListener('keydown', (e) => {
    if (!root || !root.classList.contains('show')) return;
    const k = e.key;
    if (k === 'Escape') return e.preventDefault(), e.stopImmediatePropagation(), close();
    if (k === 'ArrowRight' || k === ' ' || k === 'Enter') return e.preventDefault(), e.stopImmediatePropagation(), go(cur + 1 >= list.length ? cur : cur + 1);
    if (k === 'ArrowLeft') return e.preventDefault(), e.stopImmediatePropagation(), go(cur - 1);
    e.stopImmediatePropagation(); // nothing else reacts under the recap
  }, true);

  /* ---------------- the way in: two cards at the top of Statistics ---------------- */

  function entry(host) {
    const h = host.querySelector('.st-h');
    if (!h || host.querySelector('.rc-entry')) return;
    const d = data('day');
    const w = data('week');
    const pct = (a, b) => (b ? Math.round(((a - b) / b) * 100) : null);
    const card = (k, title, x) => {
      const p = pct(x.sec, x.was);
      const trend = p == null ? '' : `<span class="rc-trend ${p > 0 ? 'up' : p < 0 ? 'down' : ''}">${p > 0 ? ARROW : p < 0 ? ARROW : ''}${Math.abs(p)}%</span>`;
      return `<button class="rc-card" data-open="${k}"><span class="rc-ck">${escH(title)}</span><span class="rc-cv">${escH(t('st.min', Math.round(x.sec / 60)))}${trend}</span><span class="rc-co">${escH(t('rc.open'))} →</span></button>`;
    };
    h.insertAdjacentHTML('afterend', `<div class="rc-entry">${card('day', t('rc.day'), d)}${card('week', t('rc.week'), w)}</div>`);
    host.querySelector('.rc-entry').addEventListener('click', (e) => {
      const b = e.target.closest('[data-open]');
      if (b) open(b.dataset.open);
    });
  }
  const base = Stats.render;
  Stats.render = (target) => {
    base(target);
    entry(target || document.getElementById('stats-body'));
  };

  return { open, close };
})();
