'use strict';
// Deep focus sessions (Mac only): a timed stretch of reading in focus mode with the rest of
// the world kept out. S, the timer button in the header/focus controls, or the Focus widget
// opens the sheet: pick 10/25/45/60 minutes and breathe in for three seconds while focus
// mode settles under a blur. While it runs a small timer sits in the corner; leaving the
// window pauses it (the distraction guard) and coming back shows how long you were gone.
// At the end: a summary, then a short break that keeps the text blurred until it's over.
//
// Everything that appears does so where it stands, as a fade through a blur; the card that
// holds every step is one shape whose clip grows or shrinks to the step's height, so it
// never disappears to come back as another card. Only opacity, filter, transform and
// clip-path move.
//
// Focused time is kept in notes.stats.focus.days["YYYY-MM-DD"] = { sec, sessions, away }, every
// session that focused for a minute or more in notes.stats.focus.log (stats-more.js draws it)
// and the running session in notes.stats.focus.run = { start, ends, title } for the widget.
// Needs app.js (state, $, $$, save, rec, openArticle, settled), stats.js and focus.js.
const Session = (() => {
  Object.assign(I18N.uz, {
    'fs.btn': 'Chuqur fokus sessiyasi (S)',
    'fs.title': 'Chuqur fokus',
    'fs.sub': "Bildirishnomalarni o'chiring, telefonni chetga qo'ying. Faqat siz va matn.",
    'fs.min': 'daq.',
    'fs.hint': 'Raqam yozing · ↑ ↓ · g\'ildirak',
    'fs.full': "To'liq ekran",
    'fs.guard': "Chalg'ishdan himoya",
    'fs.guard.d': "Boshqa oynaga o'tsangiz, taymer to'xtaydi",
    'fs.start': 'Boshlash',
    'fs.today': (m, n) => `Bugun: ${m} daq. fokusda · ${n} sessiya`,
    'fs.breathe': 'Nafas oling… va sekin chiqaring',
    'fs.paused': 'Pauza',
    'fs.pausedD': 'Tayyor bo\'lsangiz, davom etamiz',
    'fs.awayNow': 'Fokus pauzada',
    'fs.awayNowD': 'Qaytishingizni kutyapmiz — matn shu yerda',
    'fs.back': 'Qaytganingiz bilan!',
    'fs.backD': (tm, n) => `${tm} chalg'idingiz · bugun ${n}-marta`,
    'fs.left': (tm) => `Qoldi: ${tm}`,
    'fs.resume': 'Davom etish',
    'fs.end': 'Tugatish',
    'fs.done': 'Sessiya tugadi',
    'fs.doneEarly': 'Sessiya erta tugadi',
    'fs.doneD': "Zo'r ish. Endi miyangiz qisqa tanaffusni xohlaydi.",
    'fs.doneEarlyD': 'Har bir daqiqa hisob. Keyingisi uzunroq bo\'ladi.',
    'fs.sMin': 'daqiqa',
    'fs.sPara': 'abzas',
    'fs.sAway': "chalg'ish",
    'fs.sWords': "yangi so'z",
    'fs.break': (n) => `Tanaffus · ${n} daq.`,
    'fs.again': (n) => `Yana ${n} daq.`,
    'fs.close': 'Yopish',
    'fs.breakT': 'Tanaffus',
    'fs.tip0': "Ko'zingizni yuming va chuqur nafas oling",
    'fs.tip1': "Derazadan uzoqqa qarang — ko'zlar dam oladi",
    'fs.tip2': "Turing, bir oz cho'ziling, suv iching",
    'fs.skip': 'Fokusga qaytish',
    'fs.breakDone': 'Tanaffus tugadi',
    'fs.breakDoneD': 'Yangi kuch bilan — yana bir sessiya?',
    'fs.pause': 'Pauza',
    'fs.stop': 'Tugatish',
    'set.goal': 'Kunlik maqsad',
    'set.goal.d': "Widgetdagi halqa shuncha daqiqada to'ladi",
    'set.fguard': "Chalg'ishdan himoya",
    'set.fguard.d': "Sessiyada boshqa oynaga o'tsangiz, taymer pauza bo'ladi",
    'set.ffull': "Sessiya to'liq ekranda",
    'set.haptic': 'Vibratsiya',
    'set.haptic.d': "Trackpadda yengil tebranish: fokusda abzatslar, slayderlar, grafiklar, kartochkalarni surish",
    'set.on': 'Yoniq',
    'set.off': "O'chiq",
    'set.k.session': 'Chuqur fokus sessiyasi',
  });
  Object.assign(I18N.en, {
    'fs.btn': 'Deep focus session (S)',
    'fs.title': 'Deep focus',
    'fs.sub': 'Silence notifications, put the phone away. Just you and the text.',
    'fs.min': 'min',
    'fs.hint': 'Type a number · ↑ ↓ · scroll',
    'fs.full': 'Full screen',
    'fs.guard': 'Distraction guard',
    'fs.guard.d': 'Leaving the window pauses the timer',
    'fs.start': 'Start',
    'fs.today': (m, n) => `Today: ${m} min focused · ${n} ${n === 1 ? 'session' : 'sessions'}`,
    'fs.breathe': 'Breathe in… and slowly out',
    'fs.paused': 'Paused',
    'fs.pausedD': "Carry on whenever you're ready",
    'fs.awayNow': 'Focus is paused',
    'fs.awayNowD': "We'll wait for you — the text is right here",
    'fs.back': 'Welcome back!',
    'fs.backD': (tm, n) => `You were away ${tm} · ${n} today`,
    'fs.left': (tm) => `${tm} left`,
    'fs.resume': 'Resume',
    'fs.end': 'End',
    'fs.done': 'Session complete',
    'fs.doneEarly': 'Session ended early',
    'fs.doneD': 'Great work. Your brain would like a short break now.',
    'fs.doneEarlyD': 'Every minute counts. The next one will be longer.',
    'fs.sMin': 'minutes',
    'fs.sPara': 'paragraphs',
    'fs.sAway': 'distractions',
    'fs.sWords': 'new words',
    'fs.break': (n) => `Break · ${n} min`,
    'fs.again': (n) => `${n} min more`,
    'fs.close': 'Close',
    'fs.breakT': 'Break',
    'fs.tip0': 'Close your eyes and take a deep breath',
    'fs.tip1': 'Look far out of the window — your eyes rest',
    'fs.tip2': 'Stand up, stretch a little, drink some water',
    'fs.skip': 'Back to focus',
    'fs.breakDone': 'Break is over',
    'fs.breakDoneD': 'Fresh again — one more session?',
    'fs.pause': 'Pause',
    'fs.stop': 'End',
    'set.goal': 'Daily goal',
    'set.goal.d': 'The ring in the widget fills at this many minutes',
    'set.fguard': 'Distraction guard',
    'set.fguard.d': 'Leaving the window during a session pauses the timer',
    'set.ffull': 'Sessions in full screen',
    'set.haptic': 'Haptics',
    'set.haptic.d': 'Soft trackpad taps: paragraphs in focus, sliders, charts, swiping cards',
    'set.on': 'On',
    'set.off': 'Off',
    'set.k.session': 'Deep focus session',
  });
  Object.assign(I18N.ru, {
    'fs.btn': 'Сессия глубокого фокуса (S)',
    'fs.title': 'Глубокий фокус',
    'fs.sub': 'Выключите уведомления, отложите телефон. Только вы и текст.',
    'fs.min': 'мин',
    'fs.hint': 'Введите число · ↑ ↓ · колесо',
    'fs.full': 'Полный экран',
    'fs.guard': 'Защита от отвлечений',
    'fs.guard.d': 'Уход в другое окно ставит таймер на паузу',
    'fs.start': 'Начать',
    'fs.today': (m, n) => `Сегодня: ${m} мин в фокусе · сессий: ${n}`,
    'fs.breathe': 'Вдох… и медленный выдох',
    'fs.paused': 'Пауза',
    'fs.pausedD': 'Продолжим, когда будете готовы',
    'fs.awayNow': 'Фокус на паузе',
    'fs.awayNowD': 'Ждём вас — текст никуда не делся',
    'fs.back': 'С возвращением!',
    'fs.backD': (tm, n) => `Вы отвлеклись на ${tm} · сегодня уже ${n}`,
    'fs.left': (tm) => `Осталось: ${tm}`,
    'fs.resume': 'Продолжить',
    'fs.end': 'Завершить',
    'fs.done': 'Сессия завершена',
    'fs.doneEarly': 'Сессия завершена досрочно',
    'fs.doneD': 'Отличная работа. Мозгу пора немного отдохнуть.',
    'fs.doneEarlyD': 'Каждая минута на счету. Следующая будет длиннее.',
    'fs.sMin': 'минут',
    'fs.sPara': 'абзацев',
    'fs.sAway': 'отвлечений',
    'fs.sWords': 'новых слов',
    'fs.break': (n) => `Перерыв · ${n} мин`,
    'fs.again': (n) => `Ещё ${n} мин`,
    'fs.close': 'Закрыть',
    'fs.breakT': 'Перерыв',
    'fs.tip0': 'Закройте глаза и глубоко вдохните',
    'fs.tip1': 'Посмотрите вдаль, в окно — глаза отдохнут',
    'fs.tip2': 'Встаньте, потянитесь, выпейте воды',
    'fs.skip': 'Вернуться к фокусу',
    'fs.breakDone': 'Перерыв закончился',
    'fs.breakDoneD': 'С новыми силами — ещё одна сессия?',
    'fs.pause': 'Пауза',
    'fs.stop': 'Завершить',
    'set.goal': 'Цель на день',
    'set.goal.d': 'Кольцо в виджете заполнится за столько минут',
    'set.fguard': 'Защита от отвлечений',
    'set.fguard.d': 'Уход в другое окно во время сессии ставит таймер на паузу',
    'set.ffull': 'Сессии на полном экране',
    'set.haptic': 'Вибрация',
    'set.haptic.d': 'Лёгкие отклики трекпада: абзацы в фокусе, слайдеры, графики, свайп карточек',
    'set.on': 'Вкл',
    'set.off': 'Выкл',
    'set.k.session': 'Сессия глубокого фокуса',
  });

  const body = document.body;
  const veil = $('#fs-veil');
  const card = $('#fs-card');
  const chip = $('#fs-chip');
  const LENS = [10, 25, 45, 60];
  const MAXMIN = 180;
  const GRACE = 1200; // away for less than this: nothing happens
  const FORGIVE = 3000; // back within this: it isn't counted
  const ring = 2 * Math.PI * 7;

  let phase = 'idle'; // setup | count | run | pause | done | break | rest (break over)
  let lenMin = 25;
  let len = 0; // ms
  let endsAt = 0; // while running
  let left = 0; // while paused
  let focused = 0; // ms focused in this session
  let acc = 0; // ms not yet written to the day's seconds
  let lastT = 0;
  let saveAt = 0;
  let pauseWhy = ''; // 'away' | 'user'
  let awayAt = 0;
  let awayGone = 0; // ms the last time away
  let awayT = 0;
  let awayN = 0; // this session
  let paraFrom = 0;
  let paraMax = 0;
  let vocabFrom = 0;
  let startedAt = 0;
  let breakEnds = 0;
  let breakLen = 0;
  let wentFull = false;
  let timer = 0;
  let countT = [];
  let rested = false; // the sheet opens after a break

  const S = () => state.notes.settings;
  const guardOn = () => S().fGuard !== 'off';
  const fullOn = () => S().fFull === 'on';
  const pad = (n) => String(n).padStart(2, '0');
  const dkey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const clock = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000));
    return `${Math.floor(s / 60)}:${pad(s % 60)}`;
  };
  const vocabTotal = () => Object.values(state.notes.articles || {}).reduce((n, a) => n + ((a && a.vocab) || []).length, 0);
  const isOpen = () => veil.classList.contains('show');
  const active = () => phase === 'run' || phase === 'pause';

  function fstore() {
    const st = (state.notes.stats ||= {});
    const f = (st.focus ||= {});
    f.days ||= {};
    return f;
  }
  const fday = () => (fstore().days[dkey()] ||= { sec: 0, sessions: 0, away: 0 });

  // the widget's countdown follows the session at once, not 20 s later
  function syncWidget() {
    const f = fstore();
    if (phase === 'run') f.run = { start: endsAt - len, ends: endsAt, title: state.current ? titleOf(state.current.meta) : null };
    else delete f.run;
    save();
    if (api.widgetNow) api.widgetNow(JSON.parse(JSON.stringify(state.notes))).catch(() => {});
  }

  /* ---------------- the card ---------------- */
  // every step is a pane in one grid cell; the card's clip follows the visible pane's height
  const svg = {
    timer: '<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="9" r="5.5"/><path d="M8 6v3l2 1.4M6.5 1.5h3"/></svg>',
    pause: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg>',
    stop: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="3.5" y="3.5" width="9" height="9" rx="2"/></svg>',
    away: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6.5 9.5-6.5 9.5 6.5 9.5 6.5-3.5 6.5-9.5 6.5S2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    check: '<svg class="fs-check" viewBox="0 0 52 52" aria-hidden="true"><circle cx="26" cy="26" r="23"/><path d="M15.5 27l7 7 14-15"/></svg>',
    leaf: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19c0-8 5.5-13.5 14-14-.5 8.5-6 14-14 14zM5 19l7-7"/></svg>',
  };

  function panes() {
    const d = fday();
    const today = t('fs.today', Math.round(d.sec / 60), d.sessions);
    const i = LENS.indexOf(lenMin);
    card.innerHTML = `
      <section class="fs-pane" data-p="setup">
        <h2 data-r="setupH">${esc(t('fs.title'))}</h2>
        <p data-r="setupP">${esc(t('fs.sub'))}</p>
        <div class="fs-dial">
          <button class="fs-step" data-step="-1" tabindex="-1" aria-label="−5"><svg viewBox="0 0 16 16"><path d="M3.5 8h9"/></svg></button>
          <div class="fs-clock" data-r="clock" tabindex="0"><span class="roll" data-r="setMin"></span><i class="fs-caret"></i><span class="fs-colon">:</span><span class="fs-sec">00</span></div>
          <button class="fs-step" data-step="1" tabindex="-1" aria-label="+5"><svg viewBox="0 0 16 16"><path d="M3.5 8h9M8 3.5v9"/></svg></button>
        </div>
        <div class="fs-hint">${esc(t('fs.hint'))}</div>
        <div class="fs-lens${i < 0 ? ' free' : ''}" style="--i:${Math.max(0, i)}"><i></i>${LENS.map((m, k) => `<button data-len="${m}" tabindex="-1" class="${k === i ? 'on' : ''}">${m} <small>${esc(t('fs.min'))}</small></button>`).join('')}</div>
        <div class="fs-opts">
          <button class="fs-opt" data-opt="fFull" aria-pressed="${fullOn()}"><span>${esc(t('fs.full'))}</span><i></i></button>
          <button class="fs-opt" data-opt="fGuard" aria-pressed="${guardOn()}" title="${esc(t('fs.guard.d'))}"><span>${esc(t('fs.guard'))}</span><i></i></button>
        </div>
        <button class="fs-go" data-act="start">${esc(t('fs.start'))} <kbd>↵</kbd></button>
        <div class="fs-foot">${esc(today)}</div>
      </section>
      <section class="fs-pane" data-p="count">
        <div class="fs-digits"><span data-n="3">3</span><span data-n="2">2</span><span data-n="1">1</span></div>
        <p>${esc(t('fs.breathe'))}</p>
        <div class="fs-track"><i data-r="countBar"></i></div>
      </section>
      <section class="fs-pane" data-p="pause">
        <div class="fs-icon fs-calm" data-r="pauseIc">${svg.away}</div>
        <h2 data-r="pauseH"></h2>
        <p data-r="pauseP"></p>
        <div class="fs-big" data-r="pauseLeft"></div>
        <div class="fs-row">
          <button class="fs-ghost" data-act="end">${esc(t('fs.end'))}</button>
          <button class="fs-go" data-act="resume">${esc(t('fs.resume'))} <kbd>↵</kbd></button>
        </div>
      </section>
      <section class="fs-pane" data-p="done">
        ${svg.check}
        <h2 data-r="doneH"></h2>
        <p data-r="doneP"></p>
        <div class="fs-stats">
          <div><b data-c="min">0</b><small>${esc(t('fs.sMin'))}</small></div>
          <div><b data-c="para">0</b><small>${esc(t('fs.sPara'))}</small></div>
          <div><b data-c="away">0</b><small>${esc(t('fs.sAway'))}</small></div>
          <div><b data-c="words">0</b><small>${esc(t('fs.sWords'))}</small></div>
        </div>
        <button class="fs-go" data-act="break" data-r="breakBtn"></button>
        <div class="fs-row">
          <button class="fs-ghost" data-act="close">${esc(t('fs.close'))}</button>
          <button class="fs-ghost" data-act="again" data-r="againBtn"></button>
        </div>
      </section>
      <section class="fs-pane" data-p="break">
        <div class="fs-icon fs-leaf">${svg.leaf}</div>
        <h2>${esc(t('fs.breakT'))}</h2>
        <div class="fs-big roll" data-r="breakLeft"></div>
        <p class="fs-tip" data-r="tip"></p>
        <div class="fs-track fs-leafbar"><i data-r="breakBar"></i></div>
        <button class="fs-ghost" data-act="skip">${esc(t('fs.skip'))}</button>
      </section>`;
  }
  const R = (k) => $(`[data-r="${k}"]`, card);

  // one shape: the clip moves from the old step's height to the new one, the old step fades
  // out through a blur while the new one comes in the same way, a moment later
  function showPane(name) {
    const on = $(`.fs-pane[data-p="${name}"]`, card);
    $$('.fs-pane', card).forEach((p) => p.classList.toggle('on', p === on));
    card.style.setProperty('--h', on.offsetHeight + 'px');
    veil.dataset.p = name;
  }

  function openVeil(name) {
    if (!isOpen()) {
      // the clip starts at the pane's own size: nothing grows on the way in
      card.classList.add('snap');
      showPane(name);
      void card.offsetHeight;
      card.classList.remove('snap');
      veil.classList.add('show');
    } else showPane(name);
    body.classList.add('fs-veiled');
  }
  function closeVeil() {
    veil.classList.remove('show');
    body.classList.remove('fs-veiled');
    delete veil.dataset.p;
  }

  /* ---------------- steps ---------------- */

  async function open() {
    if (active() || phase === 'count') return;
    if (state.view !== 'reader' || !state.current) return;
    lenMin = +S().fLen >= 1 && +S().fLen <= MAXMIN ? +S().fLen : 25;
    phase = 'setup';
    panes();
    roll(R('setMin'), String(lenMin));
    if (rested) {
      // coming back from a break: the same sheet, worded as an invitation
      R('setupH').textContent = t('fs.breakDone');
      R('setupP').textContent = t('fs.breakDoneD');
      rested = false;
    }
    openVeil('setup');
    setTimeout(() => $('.fs-go', card) && $('.fs-go', card).focus({ preventScroll: true }), 60);
  }

  // the minutes can be anything from 1 to 180: typed, stepped, scrolled or one of the presets
  function pickLen(m) {
    m = Math.max(1, Math.min(MAXMIN, Math.round(m) || 1));
    const dir = m > lenMin ? 1 : -1;
    lenMin = m;
    roll(R('setMin'), String(m), dir);
    const lens = $('.fs-lens', card);
    if (!lens) return;
    const i = LENS.indexOf(m);
    // a custom length: the pill fades where it is instead of going anywhere
    lens.classList.toggle('free', i < 0);
    if (i >= 0) lens.style.setProperty('--i', i);
    $$('button', lens).forEach((b) => b.classList.toggle('on', +b.dataset.len === m));
  }
  const stepLen = (d) => pickLen(d > 0 ? Math.floor(lenMin / 5) * 5 + 5 : Math.max(1, Math.ceil(lenMin / 5) * 5 - 5));
  let typed = '';
  let typedAt = 0;
  function typeDigit(dg) {
    const now = Date.now();
    typed = now - typedAt < 1400 && typed.length < 3 ? typed + dg : dg;
    typedAt = now;
    if (+typed === 0) return;
    pickLen(+typed);
    R('clock').classList.add('typing');
    clearTimeout(typeDigit.t);
    typeDigit.t = setTimeout(() => R('clock') && R('clock').classList.remove('typing'), 1400);
  }

  // Apple-clock digits: a digit that changes leaves into a blur one way while the new one
  // comes out of a blur from the other side (up when the number grows, down when it shrinks);
  // digits that stay the same don't move. The slots are tabular, so nothing reflows.
  function roll(el, text, dir = 1) {
    if (!el || el.dataset.v === text) return false;
    const old = el.dataset.v;
    el.dataset.v = text;
    el.setAttribute('aria-label', text);
    const slots = [...el.children];
    if (old == null || old.length !== text.length || reduceMotion.matches) {
      // a different number of digits: the new ones all come out of the blur together
      const enter = old != null && !reduceMotion.matches ? (dir > 0 ? 'from-down' : 'from-up') : '';
      el.innerHTML = [...text].map((c) => `<span class="rd${/\d/.test(c) ? '' : ' rc'}"><i class="${enter}">${c}</i></span>`).join('');
      if (enter) {
        void el.offsetWidth;
        for (const i of el.querySelectorAll('i')) i.className = '';
      }
      return old != null;
    }
    [...text].forEach((c, k) => {
      if (old[k] === c) return;
      const slot = slots[k];
      const cur = slot.lastElementChild;
      cur.className = dir > 0 ? 'up' : 'down';
      setTimeout(() => cur.remove(), 460);
      const n = document.createElement('i');
      n.textContent = c;
      n.className = dir > 0 ? 'from-down' : 'from-up';
      slot.appendChild(n);
      void n.offsetWidth;
      n.className = '';
    });
    return false;
  }

  async function start() {
    if (!state.current) return close();
    S().fLen = lenMin;
    save();
    len = lenMin * 60000;
    phase = 'count';
    veil.classList.remove('glow');
    panes();
    openVeil('count');
    // the countdown and the move into focus mode share these three seconds, under the blur
    const bar = R('countBar');
    requestAnimationFrame(() => bar && bar.classList.add('go'));
    if (fullOn() && api.fullscreen) wentFull = (await api.fullscreen(true)) || wentFull;
    if (phase !== 'count') return;
    if (!Focus.isOn()) Focus.enter();
    const digit = (n) => $$('.fs-digits span', card).forEach((s) => {
      const k = +s.dataset.n;
      s.classList.toggle('on', k === n);
      s.classList.toggle('gone', k > n);
    });
    countT.forEach(clearTimeout);
    digit(3);
    countT = [setTimeout(() => digit(2), 1000), setTimeout(() => digit(1), 2000), setTimeout(run, 3000)];
  }

  function run() {
    if (phase !== 'count') return;
    phase = 'run';
    endsAt = Date.now() + len;
    startedAt = Date.now();
    focused = 0;
    acc = 0;
    awayN = 0;
    lastT = Date.now();
    saveAt = lastT;
    paraFrom = paraMax = Focus.at();
    vocabFrom = vocabTotal();
    closeVeil();
    body.classList.add('fs-run');
    paintChip();
    chip.style.setProperty('--cw', $('.fs-main', chip).offsetWidth + 16 + 'px');
    chip.classList.add('show');
    loop();
    syncWidget();
    idle();
  }

  function pause(why, at = Date.now()) {
    if (phase !== 'run') return;
    account(at);
    left = Math.max(0, endsAt - at);
    phase = 'pause';
    pauseWhy = why;
    body.classList.remove('fs-idle');
    panes();
    paintPause();
    openVeil('pause');
    chip.classList.add('paused');
    syncWidget();
  }

  function paintPause() {
    const away = pauseWhy === 'away';
    const back = away && !awayAt; // came back and it counted
    R('pauseH').textContent = away ? (back ? t('fs.back') : t('fs.awayNow')) : t('fs.paused');
    R('pauseP').textContent = away
      ? (back ? t('fs.backD', clock(awayGone), fday().away) : t('fs.awayNowD'))
      : t('fs.pausedD');
    R('pauseLeft').textContent = t('fs.left', clock(left));
    R('pauseIc').classList.toggle('fs-warm', away);
  }

  function resume() {
    if (phase !== 'pause') return;
    phase = 'run';
    endsAt = Date.now() + left;
    lastT = Date.now();
    pauseWhy = '';
    closeVeil();
    chip.classList.remove('paused');
    paintChip();
    syncWidget();
    idle();
  }

  // the clock keeps the day's focused seconds as it goes
  function account(now = Date.now()) {
    if (phase !== 'run') return;
    const dt = Math.max(0, Math.min(now - lastT, 5000));
    lastT = now;
    focused += dt;
    acc += dt;
    if (acc >= 1000) {
      fday().sec += Math.floor(acc / 1000);
      acc %= 1000;
    }
    if (now - saveAt > 10000) (saveAt = now), save();
  }

  function loop() {
    clearInterval(timer);
    timer = setInterval(() => {
      const now = Date.now();
      if (phase === 'run') {
        account(now);
        paintChip();
        if (endsAt - now <= 0) finish(true);
      } else if (phase === 'pause' && pauseWhy === 'away' && awayAt) {
        // still away: how long it's been, live
        R('pauseLeft').textContent = clock(now - awayAt);
      } else if (phase === 'break') {
        const l = breakEnds - now;
        roll(R('breakLeft'), clock(l), -1);
        if (l <= 0) restOver();
      } else if (phase === 'idle' || phase === 'setup' || phase === 'rest') clearInterval(timer);
    }, 250);
  }

  function paintChip() {
    const l = phase === 'run' ? endsAt - Date.now() : left;
    // a new number of digits (10:00 → 9:59): the collapsed chip takes the new width
    if (roll($('.fs-time', chip), clock(l), -1)) chip.style.setProperty('--cw', $('.fs-main', chip).offsetWidth + 16 + 'px');
    $('.fs-arc', chip).style.strokeDashoffset = (ring * Math.max(0, Math.min(1, l / len))).toFixed(2);
  }

  function finish(complete) {
    if (!active()) return;
    account();
    if (acc >= 500) fday().sec += 1;
    acc = 0;
    clearTimeout(awayT);
    awayAt = 0;
    phase = 'done';
    chip.classList.remove('show', 'paused');
    body.classList.remove('fs-run', 'fs-idle');
    if (complete) fday().sessions++;
    // one line per session: when, planned and focused minutes, finished or not, how often the
    // window was left, how many paragraphs it covered and in which article
    if (focused >= 60000) {
      const log = (fstore().log ||= []);
      log.push({ t: startedAt, plan: lenMin, sec: Math.round(focused / 1000), done: complete, away: awayN, para: Math.max(0, paraMax - paraFrom + 1), id: state.current ? state.current.id : null });
      if (log.length > 1000) log.splice(0, log.length - 1000);
    }
    syncWidget();
    if (complete) chime();
    panes();
    R('doneH').textContent = complete ? t('fs.done') : t('fs.doneEarly');
    R('doneP').textContent = complete ? t('fs.doneD') : t('fs.doneEarlyD');
    breakLen = lenMin >= 45 ? 10 : lenMin >= 25 ? 5 : 3;
    R('breakBtn').textContent = t('fs.break', breakLen);
    R('againBtn').textContent = t('fs.again', lenMin);
    veil.classList.toggle('glow', complete);
    openVeil('done');
    // the numbers count up once the card is in
    const to = { min: Math.round(focused / 60000), para: Math.max(0, paraMax - paraFrom + 1), away: awayN, words: Math.max(0, vocabTotal() - vocabFrom) };
    const t0 = performance.now() + 420;
    const step = (now) => {
      const p = Math.max(0, Math.min(1, (now - t0) / 900));
      const e = 1 - (1 - p) ** 3;
      for (const [k, v] of Object.entries(to)) {
        const b = $(`[data-c="${k}"]`, card);
        if (b) b.textContent = Math.round(v * e);
      }
      if (p < 1 && phase === 'done') requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  function startBreak() {
    phase = 'break';
    veil.classList.remove('glow');
    breakEnds = Date.now() + breakLen * 60000;
    const tip = R('tip');
    tip.textContent = t('fs.tip' + Math.floor(Math.random() * 3));
    roll(R('breakLeft'), clock(breakLen * 60000));
    showPane('break');
    const bar = R('breakBar');
    bar.style.transitionDuration = breakLen * 60 + 's';
    requestAnimationFrame(() => requestAnimationFrame(() => bar.classList.add('go')));
    loop();
  }

  function restOver() {
    chime(true);
    phase = 'idle';
    rested = true;
    open();
  }

  async function close() {
    countT.forEach(clearTimeout);
    if (active()) return finish(false);
    phase = 'idle';
    clearInterval(timer);
    veil.classList.remove('glow');
    closeVeil();
    chip.classList.remove('show', 'paused');
    body.classList.remove('fs-run', 'fs-idle');
    if (wentFull && api.fullscreen) {
      wentFull = false;
      setTimeout(() => api.fullscreen(false), 460); // after the blur has lifted
    }
  }

  /* ---------------- the distraction guard ---------------- */
  // the window lost focus (a YouTube frame inside the page keeps document.hasFocus())
  window.addEventListener('blur', () => setTimeout(() => {
    if (phase !== 'run' || !guardOn() || document.hasFocus()) return;
    awayAt = Date.now();
    clearTimeout(awayT);
    awayT = setTimeout(() => phase === 'run' && awayAt && pause('away', awayAt), GRACE);
  }, 0));
  window.addEventListener('focus', () => {
    if (!awayAt) return;
    clearTimeout(awayT);
    awayGone = Date.now() - awayAt;
    awayAt = 0;
    if (phase !== 'pause' || pauseWhy !== 'away') return;
    if (awayGone < FORGIVE) return resume();
    awayN++;
    fday().away++;
    save();
    paintPause();
  });

  // in a session the pointer goes away while you read, and comes back as soon as it moves
  let idleT = 0;
  function idle() {
    body.classList.remove('fs-idle');
    clearTimeout(idleT);
    if (phase === 'run') idleT = setTimeout(() => phase === 'run' && body.classList.add('fs-idle'), 2500);
  }
  window.addEventListener('mousemove', () => phase === 'run' && idle(), { passive: true });

  // leaving focus mode (Esc, T, the library) ends the session
  new MutationObserver(() => {
    if (active() && !body.classList.contains('focus')) finish(false);
  }).observe(body, { attributes: true, attributeFilter: ['class'] });

  Focus.onMove((i) => {
    if (active()) paraMax = Math.max(paraMax, i);
  });

  /* ---------------- a soft two-note chime ---------------- */
  let ac = null;
  function chime(low) {
    try {
      ac ||= new AudioContext();
      const now = ac.currentTime;
      (low ? [523.25, 392] : [659.25, 987.77]).forEach((f, k) => {
        const o = ac.createOscillator();
        const g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = f;
        const t0 = now + k * 0.18;
        g.gain.setValueAtTime(0, t0);
        g.gain.linearRampToValueAtTime(0.07, t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + 1.4);
        o.connect(g).connect(ac.destination);
        o.start(t0);
        o.stop(t0 + 1.5);
      });
    } catch {}
  }

  /* ---------------- input ---------------- */

  card.addEventListener('click', (e) => {
    const st = e.target.closest('[data-step]');
    if (st) return stepLen(+st.dataset.step);
    if (e.target.closest('.fs-clock')) return R('clock').focus({ preventScroll: true });
    const l = e.target.closest('[data-len]');
    if (l) return pickLen(+l.dataset.len);
    const o = e.target.closest('[data-opt]');
    if (o) {
      const k = o.dataset.opt;
      const on = o.getAttribute('aria-pressed') !== 'true';
      o.setAttribute('aria-pressed', on);
      if (k === 'fFull') on ? (S().fFull = 'on') : delete S().fFull;
      else on ? delete S().fGuard : (S().fGuard = 'off');
      return save();
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'start' || act === 'again') start();
    else if (act === 'resume') resume();
    else if (act === 'end') finish(false);
    else if (act === 'break') startBreak();
    else if (act === 'skip') (phase = 'idle'), open();
    else if (act === 'close') close();
  });
  // scrolling over the time turns it like a dial, a minute per notch
  let wheelAcc = 0;
  card.addEventListener('wheel', (e) => {
    if (phase !== 'setup' || !e.target.closest('.fs-dial')) return;
    e.preventDefault();
    wheelAcc += e.deltaY;
    while (Math.abs(wheelAcc) >= 24) {
      pickLen(lenMin + (wheelAcc < 0 ? 1 : -1));
      wheelAcc -= Math.sign(wheelAcc) * 24;
    }
  }, { passive: false });
  // a click on the blur around the card: the sheet closes, a pause carries on
  veil.addEventListener('mousedown', (e) => {
    if (e.target !== veil) return;
    if (phase === 'setup') close();
    else if (phase === 'pause' && !awayAt) resume();
  });
  $('#fs-pause').addEventListener('click', () => pause('user'));
  $('#fs-stop').addEventListener('click', () => finish(false));
  for (const b of $$('.fs-open')) b.addEventListener('click', open);

  window.addEventListener('keydown', (e) => {
    const typing = e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]');
    if (typing || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!isOpen()) {
      if (e.key.toLowerCase() === 's' && state.view === 'reader' && state.current && !state.pop && !$('.modal.show')) {
        e.preventDefault();
        e.stopImmediatePropagation();
        open();
      }
      return;
    }
    // the card has the keyboard while it's up
    e.stopImmediatePropagation();
    const k = e.key;
    if (k === 'Tab') return;
    e.preventDefault();
    if (k === 'Escape') {
      if (phase === 'setup' || phase === 'done' || phase === 'count') close();
      else if (phase === 'pause') resume();
      else if (phase === 'break') (phase = 'idle'), open();
    } else if (k === 'Enter' || k === ' ') {
      const btn = document.activeElement && card.contains(document.activeElement) && document.activeElement.matches('button') ? document.activeElement : null;
      if (btn && k === ' ') return btn.click();
      if (phase === 'setup') start();
      else if (phase === 'pause') resume();
      else if (phase === 'done') startBreak();
    } else if (phase === 'setup' && (k === 'ArrowUp' || k === 'ArrowDown')) {
      pickLen(lenMin + (k === 'ArrowUp' ? 1 : -1));
    } else if (phase === 'setup' && (k === 'ArrowLeft' || k === 'ArrowRight')) {
      stepLen(k === 'ArrowRight' ? 1 : -1);
    } else if (phase === 'setup' && /^\d$/.test(k)) typeDigit(k);
    else if (phase === 'setup' && k === 'Backspace') {
      typed = typed.slice(0, -1);
      typedAt = Date.now();
      if (typed) pickLen(+typed);
    }
  }, true);

  // the Focus widget: open the article being read (or the next one) and the sheet
  async function fromWidget() {
    if (state.view === 'reader' && state.current) return open();
    const arts = state.notes.articles || {};
    const reading = state.list
      .filter((m) => arts[m.id] && arts[m.id].progress > 0.03 && arts[m.id].progress < 0.95)
      .sort((a, b) => (arts[b.id].opened || 0) - (arts[a.id].opened || 0))[0];
    const next = reading || state.list.find((m) => m.kind !== 'guardian' && (!arts[m.id] || !arts[m.id].progress)) || state.list[0];
    if (!next) return;
    await openArticle(next.id);
    setTimeout(open, 520); // once the reader has slid in
  }

  window.addEventListener('beforeunload', () => {
    if (active()) {
      account();
      delete fstore().run;
    }
  });

  // boot: a session left running by a reload or a quit mustn't keep counting down in the widget
  const clear = () => state.notes.stats && state.notes.stats.focus && state.notes.stats.focus.run && (delete state.notes.stats.focus.run, syncWidget());
  return { open, close, fromWidget, clear, isActive: active, phase: () => phase };
})();
