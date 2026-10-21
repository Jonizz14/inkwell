'use strict';
// Flashcards: spaced repetition for the vocabulary, so collected words are actually remembered.
//
// Home: today's numbers, which articles to study (all, several, or just one), and options:
// flip cards or type the word, direction (word → translation or back), cram (review everything
// without touching the schedule), voice, new words per day.
// Session: a real card that flips in 3D, sits on a little stack, and is graded with buttons,
// keys (Space · 1 2 3 · ← →) or by swiping it away (right knew, left forgot). Z undoes.
// Summary: how it went, and the forgotten words can be drilled once more.
//
// Scheduling is a small SM-2: forgotten cards come back in the same session; known ones after
// 1 day, then 3, then interval × ease. The state lives on the word itself
// (vocab[].srs = { due, ivl, ease, reps, lapses }), so it travels with the notes.
// Shared by the desktop app and the web version.
// Needs app.js (state, save, $, $$, esc, titleOf, showView, backToLibrary, reduceMotion) and i18n.js.
const Cards = (() => {
  const DAY = 86400000;
  const LEARNED = 21; // days between reviews from which a word counts as learned

  Object.assign(I18N.uz, {
    'cd.btn': 'Kartochkalar',
    'cd.title': 'Kartochkalar',
    'cd.dueN': 'takrorlash',
    'cd.newN': 'yangi',
    'cd.learnedN': "o'zlashtirilgan",
    'cd.start': 'Boshlash',
    'cd.startCram': 'Hammasini takrorlash',
    'cd.nothing': 'Bugunga hammasi bajarildi',
    'cd.modeFlip': 'Kartochka',
    'cd.modeType': "So'zni yozish",
    'cd.dirFwd': "So'z → tarjima",
    'cd.dirRev': "Tarjima → so'z",
    'cd.cram': 'Jadvalsiz takrorlash',
    'cd.cramSub': "Hamma so'zlar, jadval o'zgarmaydi",
    'cd.voice': 'Talaffuz',
    'cd.perDay': "Kuniga yangi so'z",
    'cd.articles': 'Maqolalar',
    'cd.all': 'Hammasi',
    'cd.only': 'Faqat shu maqola',
    'cd.words': (n) => `${n} so'z`,
    'cd.noTrShort': (n) => `${n} ta tarjimasiz`,
    'cd.show': "Javobni ko'rsatish",
    'cd.again': 'Bilmadim',
    'cd.hard': 'Qiyin',
    'cd.good': 'Bildim',
    'cd.tapHint': 'Bosing — tarjima · suring → bildim / ← bilmadim',
    'cd.typeHint': "So'zni yozing va Enter",
    'cd.check': 'Tekshirish',
    'cd.typeRight': "To'g'ri!",
    'cd.typeAlmost': 'Deyarli — bitta harf',
    'cd.typeWrong': "Noto'g'ri",
    'cd.iWasRight': "Men to'g'ri yozgandim",
    'cd.continue': 'Davom etish',
    'cd.left': (n) => `${n} ta qoldi`,
    'cd.new': 'yangi',
    'cd.min': 'hozir',
    'cd.days': (n) => (n < 30 ? `${n} kun` : n < 365 ? `${Math.round(n / 30)} oy` : `${(n / 365).toFixed(1)} yil`),
    'cd.undo': 'Bekor qilish (Z)',
    'cd.speak': 'Talaffuz (S)',
    'cd.quit': 'Tugatish (Esc)',
    'cd.empty': "Hali kartochka yo'q",
    'cd.emptySub': "Maqolada so'zni belgilang → «Lug'atga», keyin lug'atda tarjimasini yozing. Kartochkalar shu yerda paydo bo'ladi.",
    'cd.noTr': (n) => `${n} ta so'zning tarjimasi yo'q — lug'atda yozing`,
    'cd.done': 'Sessiya tugadi!',
    'cd.score': "to'g'ri",
    'cd.sumGood': 'Bildim',
    'cd.sumHard': 'Qiyin',
    'cd.sumAgain': 'Bilmadim',
    'cd.forgot': "Shu so'zlarni yana ko'ring",
    'cd.drill': 'Xatolarni qayta',
    'cd.home': 'Kartochkalarga',
    'cd.next': (s) => `Keyingi takrorlash: ${s}`,
    'cd.tomorrow': 'ertaga',
    'cd.in': (s) => `${s}dan keyin`,
  });
  Object.assign(I18N.en, {
    'cd.btn': 'Flashcards',
    'cd.title': 'Flashcards',
    'cd.dueN': 'to review',
    'cd.newN': 'new',
    'cd.learnedN': 'learned',
    'cd.start': 'Start',
    'cd.startCram': 'Review all',
    'cd.nothing': 'All done for today',
    'cd.modeFlip': 'Flip cards',
    'cd.modeType': 'Type the word',
    'cd.dirFwd': 'Word → translation',
    'cd.dirRev': 'Translation → word',
    'cd.cram': 'Cram',
    'cd.cramSub': 'Every word, schedule untouched',
    'cd.voice': 'Pronunciation',
    'cd.perDay': 'New words a day',
    'cd.articles': 'Articles',
    'cd.all': 'All',
    'cd.only': 'Only this article',
    'cd.words': (n) => `${n} words`,
    'cd.noTrShort': (n) => `${n} untranslated`,
    'cd.show': 'Show answer',
    'cd.again': 'Forgot',
    'cd.hard': 'Hard',
    'cd.good': 'Knew it',
    'cd.tapHint': 'Tap to flip · swipe → knew / ← forgot',
    'cd.typeHint': 'Type the word and press Enter',
    'cd.check': 'Check',
    'cd.typeRight': 'Correct!',
    'cd.typeAlmost': 'Almost — one letter off',
    'cd.typeWrong': 'Not quite',
    'cd.iWasRight': 'I was right',
    'cd.continue': 'Continue',
    'cd.left': (n) => `${n} left`,
    'cd.new': 'new',
    'cd.min': 'now',
    'cd.days': (n) => (n < 30 ? `${n} d` : n < 365 ? `${Math.round(n / 30)} mo` : `${(n / 365).toFixed(1)} y`),
    'cd.undo': 'Undo (Z)',
    'cd.speak': 'Pronounce (S)',
    'cd.quit': 'Finish (Esc)',
    'cd.empty': 'No cards yet',
    'cd.emptySub': 'Select a word in an article → "Vocabulary", then write its translation in the vocabulary. Cards show up here.',
    'cd.noTr': (n) => `${n} words have no translation yet — add them in the vocabulary`,
    'cd.done': 'Session complete!',
    'cd.score': 'correct',
    'cd.sumGood': 'Knew',
    'cd.sumHard': 'Hard',
    'cd.sumAgain': 'Forgot',
    'cd.forgot': 'Have another look at these',
    'cd.drill': 'Drill mistakes',
    'cd.home': 'Back to decks',
    'cd.next': (s) => `Next review: ${s}`,
    'cd.tomorrow': 'tomorrow',
    'cd.in': (s) => `in ${s}`,
  });
  Object.assign(I18N.ru, {
    'cd.btn': 'Карточки',
    'cd.title': 'Карточки',
    'cd.dueN': 'повторить',
    'cd.newN': 'новых',
    'cd.learnedN': 'выучено',
    'cd.start': 'Начать',
    'cd.startCram': 'Повторить всё',
    'cd.nothing': 'На сегодня всё сделано',
    'cd.modeFlip': 'Карточки',
    'cd.modeType': 'Написать слово',
    'cd.dirFwd': 'Слово → перевод',
    'cd.dirRev': 'Перевод → слово',
    'cd.cram': 'Без расписания',
    'cd.cramSub': 'Все слова, расписание не меняется',
    'cd.voice': 'Произношение',
    'cd.perDay': 'Новых слов в день',
    'cd.articles': 'Статьи',
    'cd.all': 'Все',
    'cd.only': 'Только эта статья',
    'cd.words': (n) => `${n} слов`,
    'cd.noTrShort': (n) => `${n} без перевода`,
    'cd.show': 'Показать ответ',
    'cd.again': 'Не знал',
    'cd.hard': 'Трудно',
    'cd.good': 'Знал',
    'cd.tapHint': 'Нажмите — перевод · свайп → знал / ← не знал',
    'cd.typeHint': 'Напишите слово и нажмите Enter',
    'cd.check': 'Проверить',
    'cd.typeRight': 'Верно!',
    'cd.typeAlmost': 'Почти — одна буква',
    'cd.typeWrong': 'Неверно',
    'cd.iWasRight': 'Я был прав',
    'cd.continue': 'Дальше',
    'cd.left': (n) => `осталось ${n}`,
    'cd.new': 'новое',
    'cd.min': 'сейчас',
    'cd.days': (n) => (n < 30 ? `${n} дн` : n < 365 ? `${Math.round(n / 30)} мес` : `${(n / 365).toFixed(1)} г`),
    'cd.undo': 'Отменить (Z)',
    'cd.speak': 'Произнести (S)',
    'cd.quit': 'Закончить (Esc)',
    'cd.empty': 'Карточек пока нет',
    'cd.emptySub': 'Выделите слово в статье → «В словарь», затем впишите перевод в словаре. Карточки появятся здесь.',
    'cd.noTr': (n) => `У ${n} слов нет перевода — допишите в словаре`,
    'cd.done': 'Сеанс завершён!',
    'cd.score': 'верно',
    'cd.sumGood': 'Знал',
    'cd.sumHard': 'Трудно',
    'cd.sumAgain': 'Не знал',
    'cd.forgot': 'Посмотрите эти слова ещё раз',
    'cd.drill': 'Повторить ошибки',
    'cd.home': 'К колодам',
    'cd.next': (s) => `Следующее повторение: ${s}`,
    'cd.tomorrow': 'завтра',
    'cd.in': (s) => `через ${s}`,
  });

  const body = $('#cards-body');
  const calm = () => reduceMotion.matches;
  const later = (ms, fn) => setTimeout(fn, calm() ? 0 : ms);

  /* ---------------- options ---------------- */

  function opts() {
    const s = state.notes.settings;
    s.cardOpts ||= {};
    const o = s.cardOpts;
    o.mode ||= 'flip';
    o.dir ||= 'fwd';
    if (o.voice == null) o.voice = true;
    o.perDay ||= 15;
    if (o.sel === undefined) o.sel = null; // null: every article, also ones added later
    return o;
  }

  /* ---------------- scheduling ---------------- */

  const dayKey = (t = Date.now()) => new Date(t).toLocaleDateString('sv'); // YYYY-MM-DD, local
  const startOfDay = (t = Date.now()) => new Date(new Date(t).toDateString()).getTime();

  // the state after grade g (0 forgot, 1 hard, 2 knew), without changing the card
  function schedule(s, g, now = Date.now()) {
    const n = { ivl: 0, ease: 2.5, reps: 0, lapses: 0, ...(s || {}) };
    if (g === 0) {
      n.lapses++;
      n.reps = 0;
      n.ease = Math.max(1.3, n.ease - 0.2);
      n.ivl = 0;
      n.due = now; // back in this session, and due if the session ends first
      return n;
    }
    if (g === 1) {
      n.ease = Math.max(1.3, n.ease - 0.15);
      n.ivl = n.reps ? Math.max(1, Math.round(n.ivl * 1.2)) : 1;
    } else {
      n.ivl = n.reps === 0 ? 1 : n.reps === 1 ? 3 : Math.max(n.ivl + 1, Math.round(n.ivl * n.ease));
    }
    n.reps++;
    // due from the start of that day, so a card can be done any time of the day it falls on
    n.due = startOfDay(now) + n.ivl * DAY;
    return n;
  }

  /* ---------------- the deck ---------------- */

  const hasTr = (v) => v.tr && v.tr.trim();

  function all(ids) {
    const out = [];
    for (const [id, a] of Object.entries(state.notes.articles)) {
      if (ids && !ids.includes(id)) continue;
      for (const v of (a && a.vocab) || []) if (hasTr(v)) out.push({ v, id });
    }
    return out;
  }

  function newUsedToday() {
    const c = state.notes.settings.cards;
    return c && c.day === dayKey() ? c.fresh : 0;
  }
  const newLeftToday = () => Math.max(0, opts().perDay - newUsedToday());
  function countNew(d) {
    const s = state.notes.settings;
    if (!s.cards || s.cards.day !== dayKey()) s.cards = { day: dayKey(), fresh: 0 };
    s.cards.fresh = Math.max(0, s.cards.fresh + d);
  }

  function plan(ids) {
    const now = Date.now();
    const cards = all(ids);
    const due = cards.filter((c) => c.v.srs && c.v.srs.due <= now).sort((a, b) => a.v.srs.due - b.v.srs.due);
    const freshAll = cards.filter((c) => !c.v.srs).sort((a, b) => a.v.at - b.v.at);
    const fresh = freshAll.slice(0, newLeftToday());
    const learned = cards.filter((c) => c.v.srs && c.v.srs.ivl >= LEARNED).length;
    return { cards, due, fresh, freshAll, learned };
  }

  // the articles that have vocabulary, most recently studied first
  function decks() {
    const out = [];
    const now = Date.now();
    for (const [id, a] of Object.entries(state.notes.articles)) {
      const vs = (a && a.vocab) || [];
      if (!vs.length) continue;
      const meta = state.list.find((m) => m.id === id);
      if (!meta) continue;
      const tr = vs.filter(hasTr);
      out.push({
        id,
        title: titleOf(meta),
        total: tr.length,
        noTr: vs.length - tr.length,
        due: tr.filter((v) => v.srs && v.srs.due <= now).length,
        learned: tr.filter((v) => v.srs && v.srs.ivl >= LEARNED).length,
        learning: tr.filter((v) => v.srs && v.srs.ivl < LEARNED).length,
        last: Math.max(0, ...vs.map((v) => (v.srs && v.srs.last) || v.at || 0)),
      });
    }
    return out.sort((x, y) => y.last - x.last);
  }

  const selIds = () => opts().sel; // null = all

  // the number on the library button: what can be done right now
  function badge() {
    const el = $('#cards-count');
    if (!el) return;
    const { due, fresh } = plan(null);
    const n = due.length + fresh.length;
    el.textContent = n;
    el.hidden = !n;
  }

  /* ---------------- speech ---------------- */

  let voice = null;
  function pickVoice() {
    const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
    const en = vs.filter((v) => /^en[-_]/i.test(v.lang));
    voice = en.find((v) => /Samantha|Google US English|Ava|Allison/i.test(v.name)) || en.find((v) => /en[-_]US/i.test(v.lang)) || en[0] || null;
  }
  if (window.speechSynthesis) {
    pickVoice();
    if (speechSynthesis.addEventListener) speechSynthesis.addEventListener('voiceschanged', pickVoice);
  }
  function speak(word) {
    if (!window.speechSynthesis || !word) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(word);
    u.lang = 'en-US';
    u.rate = 0.92;
    if (voice) u.voice = voice;
    speechSynthesis.speak(u);
  }

  /* ---------------- home ---------------- */

  let view = 'home'; // home | session | summary

  // the home is built before the push and slides in still; only the numbers count up
  function open() {
    S = null;
    renderHome(false);
    settled().then(() => showView('cards'));
  }

  function renderHome(enter) {
    view = 'home';
    const o = opts();
    const ds = decks();
    const ids = selIds();
    const p = plan(ids);
    const totalAll = all(null).length;
    const untranslated = ds.reduce((n, d) => n + d.noTr, 0);
    if (!totalAll) {
      body.innerHTML = `<div class="cd-empty${enter ? ' enter' : ''}"><div class="cd-emoji">🗂</div><h2>${esc(t('cd.empty'))}</h2><p>${esc(t('cd.emptySub'))}</p>${untranslated ? `<p class="cd-warn">${esc(t('cd.noTr', untranslated))}</p>` : ''}</div>`;
      return;
    }
    const n = o.cram ? p.cards.length : p.due.length + p.fresh.length;
    const on = (id) => !ids || ids.includes(id);
    const seg = (key, val, label) => `<button class="${o[key] === val ? 'on' : ''}" data-opt="${key}" data-val="${val}">${esc(t(label))}</button>`;
    body.innerHTML = `
      <div class="cd-home${enter ? ' enter' : ''}">
        <section class="cd-hero" style="--i:0">
          <div class="cd-kpis">
            <div><b class="cd-num" data-to="${p.due.length}">${p.due.length}</b><span>${esc(t('cd.dueN'))}</span></div>
            <div><b class="cd-num" data-to="${p.fresh.length}">${p.fresh.length}</b><span>${esc(t('cd.newN'))}</span></div>
            <div><b class="cd-num" data-to="${p.learned}">${p.learned}</b><span>${esc(t('cd.learnedN'))}</span></div>
          </div>
          <button class="cd-start" data-act="start"${n ? '' : ' disabled'}>
            <span>${esc(n ? t(o.cram ? 'cd.startCram' : 'cd.start') : t('cd.nothing'))}</span>${n ? `<i>${n}</i><kbd>↵</kbd>` : ''}
          </button>
        </section>

        <section class="cd-opts" style="--i:1">
          <div class="cd-seg">${seg('mode', 'flip', 'cd.modeFlip')}${seg('mode', 'type', 'cd.modeType')}</div>
          <div class="cd-seg">${seg('dir', 'fwd', 'cd.dirFwd')}${seg('dir', 'rev', 'cd.dirRev')}</div>
          <label class="cd-switch"><input type="checkbox" data-opt="cram"${o.cram ? ' checked' : ''}/><i></i><span><b>${esc(t('cd.cram'))}</b><small>${esc(t('cd.cramSub'))}</small></span></label>
          <label class="cd-switch"><input type="checkbox" data-opt="voice"${o.voice ? ' checked' : ''}/><i></i><span><b>${esc(t('cd.voice'))}</b></span></label>
          <div class="cd-step"><span>${esc(t('cd.perDay'))}</span><button data-act="per" data-d="-5">−</button><b>${o.perDay}</b><button data-act="per" data-d="5">+</button></div>
        </section>

        <section class="cd-decks" style="--i:2">
          <h3>${esc(t('cd.articles'))}</h3>
          <label class="cd-deck cd-deck-all" style="--j:0">
            <input type="checkbox" data-deck="*"${!ids ? ' checked' : ''}/><i class="cd-check"></i>
            <span class="cd-deck-t"><b>${esc(t('cd.all'))}</b><small>${esc(t('cd.words', totalAll))}</small></span>
          </label>
          ${ds
            .map((d, j) => {
              const w = (x) => (d.total ? (x / d.total) * 100 : 0);
              return `<label class="cd-deck${on(d.id) ? '' : ' off'}" style="--j:${Math.min(j + 1, 14)}">
                <input type="checkbox" data-deck="${esc(d.id)}"${on(d.id) ? ' checked' : ''}/><i class="cd-check"></i>
                <span class="cd-deck-t"><b>${esc(d.title)}</b>
                  <small>${esc(t('cd.words', d.total))}${d.due ? ` · <em>${d.due} ${esc(t('cd.dueN'))}</em>` : ''}${d.noTr ? ` · ${esc(t('cd.noTrShort', d.noTr))}` : ''}</small>
                  <span class="cd-mastery"><i class="l" style="--w:${w(d.learned)}%"></i><i class="m" style="--w:${w(d.learning)}%"></i></span>
                </span>
                <button class="cd-only" data-only="${esc(d.id)}" title="${esc(t('cd.only'))}"${d.total ? '' : ' disabled'}>▶</button>
              </label>`;
            })
            .join('')}
        </section>
      </div>`;
    if (enter) countUpAll();
    badge();
  }

  function countUpAll() {
    if (calm()) return;
    for (const el of $$('.cd-num', body)) {
      const to = +el.dataset.to;
      if (!to) continue;
      const t0 = performance.now();
      const step = (now) => {
        const k = Math.min(1, (now - t0) / 650);
        el.textContent = Math.round(to * (1 - Math.pow(1 - k, 3)));
        if (k < 1) requestAnimationFrame(step);
      };
      el.textContent = '0';
      requestAnimationFrame(step);
    }
  }

  function toggleDeck(id, checked) {
    const o = opts();
    const every = decks().map((d) => d.id);
    if (id === '*') o.sel = checked ? null : [];
    else {
      let sel = o.sel ? o.sel.slice() : every.slice();
      sel = checked ? [...new Set([...sel, id])] : sel.filter((x) => x !== id);
      o.sel = every.every((x) => sel.includes(x)) ? null : sel;
    }
    save();
    refreshHome();
  }

  // options changed: draw again where we are, without the entrance animation
  function refreshHome() {
    const sc = body.closest('.scroller');
    const top = sc ? sc.scrollTop : 0;
    renderHome(false);
    if (sc) sc.scrollTop = top;
  }

  /* ---------------- session ---------------- */

  let S = null; // { queue, done, stats, forgot, history, cram, mode, dir, flipped, busy, typed }

  function start(only) {
    const o = opts();
    const p = plan(only || selIds());
    let queue;
    if (o.cram) queue = shuffle(p.cards.slice());
    else if (only && !p.due.length && !p.fresh.length) {
      // nothing scheduled in this article today: study its new words anyway, past the daily limit
      queue = p.freshAll.slice(0, Math.max(5, o.perDay));
    } else {
      queue = [];
      const d = p.due.slice();
      const f = p.fresh.slice();
      // new words mixed in between due ones, so a long backlog doesn't hide them all
      while (d.length || f.length) {
        queue.push(...d.splice(0, 3));
        if (f.length) queue.push(f.shift());
      }
    }
    if (!queue.length) {
      if (only) {
        // everything here is learned for now: go over it without touching the schedule
        queue = shuffle(p.cards.slice());
        if (queue.length) return begin(queue, true);
      }
      return;
    }
    begin(queue, !!o.cram);
  }

  function begin(queue, cram) {
    const o = opts();
    S = { queue, done: 0, stats: [0, 0, 0], forgot: new Map(), history: [], cram, mode: o.mode, dir: o.dir, flipped: false, busy: false };
    view = 'session';
    body.innerHTML = `
      <div class="cd-session enter">
        <div class="cd-top">
          <button class="cd-icon" data-act="quit" title="${esc(t('cd.quit'))}">✕</button>
          <div class="cd-bar"><i></i></div>
          <span class="cd-count"></span>
          <button class="cd-icon" data-act="undo" title="${esc(t('cd.undo'))}" disabled>↶</button>
        </div>
        <div class="cd-stage"><div class="cd-ghost g2"></div><div class="cd-ghost g1"></div></div>
        <div class="cd-actions"></div>
      </div>`;
    showCard('rise');
  }

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function ctxHtml(v, blank) {
    const ctx = (v.ctx || '').trim();
    const w = v.word.trim();
    if (!ctx) return '';
    const i = ctx.toLowerCase().indexOf(w.toLowerCase());
    if (i < 0) return blank ? '' : esc(ctx);
    const mid = blank ? `<b class="blank">${'&nbsp;'.repeat(Math.min(14, Math.max(6, w.length)))}</b>` : `<b>${esc(ctx.slice(i, i + w.length))}</b>`;
    return `${esc(ctx.slice(0, i))}${mid}${esc(ctx.slice(i + w.length))}`;
  }

  const speakBtn = () =>
    window.speechSynthesis
      ? `<button class="cd-say" data-act="say" title="${esc(t('cd.speak'))}"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 6h2.2L8 3.2v9.6L4.7 10H2.5z"/><path d="M10.6 5.4a3.5 3.5 0 0 1 0 5.2M12.4 3.6a6 6 0 0 1 0 8.8"/></svg></button>`
      : '';

  function cardHtml(c) {
    const v = c.v;
    const meta = state.list.find((m) => m.id === c.id);
    const word = esc(v.word.trim());
    const tr = esc(v.tr.trim());
    const src = meta ? `<div class="cd-src">${esc(titleOf(meta))}</div>` : '';
    const tag = v.srs || S.cram ? '' : `<span class="cd-tag">${esc(t('cd.new'))}</span>`;
    const rev = S.dir === 'rev' || S.mode === 'type';
    const front = rev
      ? `${tag}<div class="cd-big">${tr}</div>${v.ctx ? `<div class="cd-ctx">${ctxHtml(v, true)}</div>` : ''}
         ${S.mode === 'type' ? `<div class="cd-type"><input class="cd-input" type="text" spellcheck="false" autocomplete="off" autocapitalize="off" placeholder="${esc(t('cd.typeHint'))}"/></div>` : `<div class="cd-hint">${esc(t('cd.tapHint'))}</div>`}`
      : `${tag}<div class="cd-word-row"><div class="cd-big serif">${word}</div>${speakBtn()}</div>${v.ctx ? `<div class="cd-ctx">${ctxHtml(v)}</div>` : ''}<div class="cd-hint">${esc(t('cd.tapHint'))}</div>`;
    const back = `<div class="cd-verdict"></div>
      <div class="cd-word-row"><div class="cd-big serif">${word}</div>${speakBtn()}</div>
      <div class="cd-tr">${tr}</div>
      ${v.ctx ? `<div class="cd-ctx">${ctxHtml(v)}</div>` : ''}${src}`;
    return `<div class="cd-card">
      <div class="cd-inner"><div class="cd-face cd-front">${front}</div><div class="cd-face cd-back">${back}</div></div>
      <div class="cd-tint good">${esc(t('cd.good'))}</div><div class="cd-tint bad">${esc(t('cd.again'))}</div>
    </div>`;
  }

  // puts the current card on the stage; how: rise (up from the stack) | back (undo, from the left)
  function showCard(how) {
    const c = S.queue[0];
    if (!c) return summary();
    S.flipped = false;
    S.typed = null;
    const stage = $('.cd-stage', body);
    $$('.cd-card', stage).forEach((x) => x.remove());
    stage.insertAdjacentHTML('beforeend', cardHtml(c));
    const card = $('.cd-card', stage);
    if (how && !calm()) {
      card.classList.add(how);
      card.addEventListener('animationend', () => card.classList.remove(how), { once: true });
    }
    stage.classList.toggle('last', S.queue.length < 2);
    stage.classList.toggle('last2', S.queue.length < 3);
    progress();
    actions();
    bindDrag(card);
    const inp = $('.cd-input', card);
    if (inp) setTimeout(() => inp.focus({ preventScroll: true }), calm() ? 0 : 140);
    else if (opts().voice && S.dir === 'fwd') later(260, () => S && S.queue[0] === c && speak(c.v.word));
  }

  function progress() {
    const left = S.queue.length;
    $('.cd-bar i', body).style.width = `${(S.done / (S.done + left)) * 100}%`;
    $('.cd-count', body).textContent = t('cd.left', left);
    $('[data-act="undo"]', body).disabled = !S.history.length;
  }

  const ivlLabel = (s, g) => (g === 0 ? t('cd.min') : t('cd.days', schedule(s, g).ivl));

  function actions() {
    const box = $('.cd-actions', body);
    const c = S.queue[0];
    if (S.mode === 'type' && !S.flipped) {
      box.innerHTML = `<button class="cd-btn cd-main" data-act="check">${esc(t('cd.check'))} <kbd>↵</kbd></button>`;
    } else if (S.mode === 'type') {
      box.innerHTML =
        S.typed === 0
          ? `<button class="cd-btn" data-g="2"><b>${esc(t('cd.iWasRight'))}</b></button><button class="cd-btn cd-main" data-g="0">${esc(t('cd.continue'))} <kbd>↵</kbd></button>`
          : `<button class="cd-btn cd-main" data-g="${S.typed}">${esc(t('cd.continue'))} <kbd>↵</kbd></button>`;
    } else if (!S.flipped) {
      box.innerHTML = `<button class="cd-btn cd-main" data-act="flip">${esc(t('cd.show'))} <kbd>Space</kbd></button>`;
    } else {
      box.innerHTML = [['again', 0, '1'], ['hard', 1, '2'], ['good', 2, '3']]
        .map(([k, g, key], i) => `<button class="cd-btn cd-${k}" data-g="${g}" style="--k:${i}"><b>${esc(t('cd.' + k))}</b><small>${S.cram ? '' : esc(ivlLabel(c.v.srs, g))} <kbd>${key}</kbd></small></button>`)
        .join('');
    }
    box.classList.remove('swap');
    void box.offsetWidth;
    box.classList.add('swap');
  }

  function flip() {
    if (!S || S.flipped || S.busy) return;
    if (S.mode === 'type') return check();
    S.flipped = true;
    $('.cd-card', body).classList.add('flipped');
    actions();
    if (opts().voice && S.dir === 'rev') later(220, () => S && S.queue[0] && speak(S.queue[0].v.word));
  }

  /* typing: exact is "knew", one letter off is "hard", anything else is "forgot" */
  const normW = (s) =>
    String(s)
      .toLowerCase()
      .normalize('NFKD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/[’`]/g, "'")
      .replace(/[^\p{L}\p{N}' -]/gu, '')
      .replace(/\s+/g, ' ')
      .trim();
  function lev(a, b) {
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const row = [i];
      for (let j = 1; j <= b.length; j++) row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = row;
    }
    return prev[b.length];
  }
  function check() {
    if (!S || S.flipped || S.busy) return;
    const card = $('.cd-card', body);
    const inp = $('.cd-input', card);
    const said = normW(inp.value);
    if (!said) return inp.focus();
    const want = normW(S.queue[0].v.word);
    const d = lev(said, want);
    S.typed = d === 0 ? 2 : d === 1 && want.length >= 4 ? 1 : 0;
    S.flipped = true;
    const verdict = $('.cd-verdict', card);
    verdict.className = `cd-verdict ${['bad', 'near', 'ok'][S.typed]}`;
    verdict.innerHTML = `${esc(t(['cd.typeWrong', 'cd.typeAlmost', 'cd.typeRight'][S.typed]))}${S.typed < 2 ? ` · <s>${esc(inp.value.trim())}</s>` : ''}`;
    inp.blur();
    if (S.typed === 0 && !calm()) {
      card.classList.add('shake');
      setTimeout(() => card.classList.remove('shake'), 420);
    }
    later(S.typed === 0 ? 400 : 100, () => card.classList.add('flipped'));
    actions();
    if (opts().voice) later(320, () => S && S.queue[0] && speak(S.queue[0].v.word));
    // right answers move on by themselves
    const mine = S.queue[0];
    if (S.typed === 2) setTimeout(() => S && S.queue[0] === mine && S.flipped && grade(2), calm() ? 600 : 1150);
  }

  function grade(g, fromDrag) {
    if (!S || !S.flipped || S.busy) return;
    const c = S.queue[0];
    S.busy = true;
    S.history.push({ c, srs: c.v.srs ? { ...c.v.srs } : undefined, queue: S.queue.slice(), done: S.done, stats: S.stats.slice(), forgot: new Map(S.forgot), fresh: !c.v.srs && !S.cram });
    if (!S.cram) {
      if (!c.v.srs) countNew(1);
      c.v.srs = { ...schedule(c.v.srs, g), last: Date.now() };
      save();
    }
    S.stats[g]++;
    if (g === 0) S.forgot.set(c.v, c);
    S.queue.shift();
    S.done++;
    // forgotten: a few cards later, once more
    if (g === 0) S.queue.splice(Math.min(S.queue.length, 3), 0, c);
    fly(g, fromDrag, () => {
      if (!S) return;
      S.busy = false;
      showCard('rise');
    });
  }

  // the card leaves towards its answer: right knew, left forgot, up hard
  function fly(g, from, done) {
    const card = $('.cd-card', body);
    if (!card || calm()) return done();
    const dir = g === 2 ? 1 : g === 0 ? -1 : 0;
    const cur = from || { x: 0, r: 0 };
    card.classList.add('flying');
    card.style.setProperty('--tg', g === 2 ? 1 : 0);
    card.style.setProperty('--tb', g === 0 ? 1 : 0);
    card.style.transition = 'none';
    card.style.transform = `translate(${cur.x}px, 0) rotate(${cur.r}deg)`;
    void card.offsetWidth;
    card.style.transition = 'transform 440ms cubic-bezier(.35,.6,.25,1), opacity 380ms ease 60ms';
    card.style.transform = dir ? `translate(${dir * (innerWidth * 0.6 + 240)}px, -40px) rotate(${dir * 26}deg)` : 'translate(0, -70%) scale(.92)';
    card.style.opacity = '0';
    // the stack moves up a step while the card leaves
    const stage = $('.cd-stage', body);
    stage.classList.add('advance');
    setTimeout(() => {
      stage.classList.remove('advance');
      done();
    }, 300);
  }

  function undo() {
    if (!S || S.busy || !S.history.length) return;
    const h = S.history.pop();
    if (!S.cram) {
      if (h.srs) h.c.v.srs = h.srs;
      else delete h.c.v.srs;
      if (h.fresh) countNew(-1);
      save();
    }
    Object.assign(S, { queue: h.queue, done: h.done, stats: h.stats, forgot: h.forgot });
    showCard('back');
  }

  function quit() {
    if (S && S.done) return summary();
    S = null;
    renderHome(true);
  }

  /* ---------------- dragging / swiping ---------------- */

  function bindDrag(card) {
    let x0 = 0, y0 = 0, dx = 0, drag = false, id = null;
    card.addEventListener('pointerdown', (e) => {
      if (S.busy || e.button > 0 || e.target.closest('button, input')) return;
      id = e.pointerId;
      x0 = e.clientX;
      y0 = e.clientY;
      dx = 0;
      drag = false;
    });
    card.addEventListener('pointermove', (e) => {
      if (e.pointerId !== id || S.mode === 'type') return;
      dx = e.clientX - x0;
      const dy = e.clientY - y0;
      if (!drag) {
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy)) return;
        drag = true;
        card.setPointerCapture(id);
        card.classList.add('dragging');
      }
      card.style.transform = `translate(${dx}px, ${Math.abs(dx) * 0.04}px) rotate(${dx / 18}deg)`;
      card.style.setProperty('--tg', Math.max(0, Math.min(1, dx / 120)));
      card.style.setProperty('--tb', Math.max(0, Math.min(1, -dx / 120)));
    });
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      if (!drag) {
        // a tap flips (a typing card flips by checking)
        if (e.type === 'pointerup' && S.mode !== 'type' && !S.flipped && !e.target.closest('button, input')) flip();
        return;
      }
      card.classList.remove('dragging');
      if (Math.abs(dx) > Math.min(120, card.offsetWidth * 0.28)) {
        if (!S.flipped) {
          // graded without looking: show the answer on the way out
          S.flipped = true;
          card.classList.add('flipped');
        }
        return grade(dx > 0 ? 2 : 0, { x: dx, r: dx / 18 });
      }
      // not far enough: spring back
      card.style.transition = 'transform 380ms cubic-bezier(.3,1.5,.5,1)';
      card.style.transform = '';
      card.style.setProperty('--tg', 0);
      card.style.setProperty('--tb', 0);
      setTimeout(() => (card.style.transition = ''), 400);
    };
    card.addEventListener('pointerup', end);
    card.addEventListener('pointercancel', end);
  }

  /* ---------------- summary ---------------- */

  function nextDueText() {
    const next = all(null)
      .map((c) => c.v.srs && c.v.srs.due)
      .filter((d) => d && d > Date.now())
      .sort((a, b) => a - b)[0];
    if (!next) return '';
    if (next < startOfDay() + 2 * DAY) return t('cd.next', t('cd.tomorrow'));
    return t('cd.next', t('cd.in', t('cd.days', Math.round((next - startOfDay()) / DAY))));
  }

  function summary() {
    view = 'summary';
    const [again, hard, good] = S.stats;
    const total = again + hard + good;
    const pct = total ? Math.round(((good + hard * 0.5) / total) * 100) : 0;
    const forgot = [...S.forgot.values()];
    const C = +(2 * Math.PI * 52).toFixed(2);
    body.innerHTML = `
      <div class="cd-sum enter">
        <div class="cd-ring" style="--i:0">
          <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" class="track"/><circle cx="60" cy="60" r="52" class="val" style="--c:${C};--to:${(C * (1 - pct / 100)).toFixed(2)}"/></svg>
          <div><b class="cd-num" data-to="${pct}">${pct}</b><span>% ${esc(t('cd.score'))}</span></div>
        </div>
        <h2 style="--i:1">${esc(t('cd.done'))}</h2>
        <div class="cd-sum-row" style="--i:2">
          <div class="g"><b class="cd-num" data-to="${good}">${good}</b><span>${esc(t('cd.sumGood'))}</span></div>
          <div class="h"><b class="cd-num" data-to="${hard}">${hard}</b><span>${esc(t('cd.sumHard'))}</span></div>
          <div class="a"><b class="cd-num" data-to="${again}">${again}</b><span>${esc(t('cd.sumAgain'))}</span></div>
        </div>
        ${S.cram ? '' : `<p class="cd-next" style="--i:3">${esc(nextDueText())}</p>`}
        ${forgot.length ? `<div class="cd-forgot" style="--i:4"><h3>${esc(t('cd.forgot'))}</h3><div>${forgot.map((c, i) => `<span style="--k:${Math.min(i, 12)}"><b>${esc(c.v.word.trim())}</b> ${esc(c.v.tr.trim())}</span>`).join('')}</div></div>` : ''}
        <div class="cd-end" style="--i:5">
          ${forgot.length ? `<button class="cd-btn" data-act="drill"><b>${esc(t('cd.drill'))}</b></button>` : ''}
          <button class="cd-btn cd-main" data-act="home">${esc(t('cd.home'))} <kbd>↵</kbd></button>
        </div>
      </div>`;
    countUpAll();
    S.lastForgot = forgot;
    badge();
  }

  /* ---------------- wiring ---------------- */

  $('#btn-cards').addEventListener('click', open);
  $('#cards-back').addEventListener('click', () => (view === 'home' ? backToLibrary() : view === 'summary' ? ((S = null), renderHome(true)) : quit()));

  body.addEventListener('click', (e) => {
    const g = e.target.closest('[data-g]');
    if (g) return grade(+g.dataset.g);
    const only = e.target.closest('[data-only]');
    if (only) return e.preventDefault(), start([only.dataset.only]);
    const opt = e.target.closest('button[data-opt]');
    if (opt) {
      opts()[opt.dataset.opt] = opt.dataset.val;
      save();
      return refreshHome();
    }
    const a = e.target.closest('[data-act]');
    if (!a) return;
    const act = a.dataset.act;
    if (act === 'start') start();
    else if (act === 'flip') flip();
    else if (act === 'check') check();
    else if (act === 'say') speak(S && S.queue[0] && S.queue[0].v.word);
    else if (act === 'undo') undo();
    else if (act === 'quit') quit();
    else if (act === 'home') (S = null), renderHome(true);
    else if (act === 'drill') begin(shuffle(S.lastForgot.slice()), true);
    else if (act === 'per') {
      const o = opts();
      o.perDay = Math.max(5, Math.min(100, o.perDay + +a.dataset.d));
      save();
      refreshHome();
    }
  });
  body.addEventListener('change', (e) => {
    const deck = e.target.closest('[data-deck]');
    if (deck) return toggleDeck(deck.dataset.deck, deck.checked);
    const opt = e.target.closest('input[data-opt]');
    if (opt) {
      opts()[opt.dataset.opt] = opt.checked;
      save();
      refreshHome();
    }
  });
  body.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && e.target.matches('.cd-input')) {
      e.preventDefault();
      e.stopPropagation();
      check();
    }
  });

  window.addEventListener(
    'keydown',
    (e) => {
      if (state.view !== 'cards' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.target.closest && e.target.closest('input[type="text"], textarea')) return;
      const k = e.key;
      const stop = () => (e.preventDefault(), e.stopImmediatePropagation());
      if (view === 'home') {
        if (k === 'Enter') return stop(), start();
        return;
      }
      if (view === 'summary') {
        if (k === 'Enter' || k === 'Escape') return stop(), (S = null), renderHome(true);
        return;
      }
      if (!S) return;
      if (k === 'Escape') return stop(), quit();
      if (k === 'z' || k === 'Z') return stop(), undo();
      if (k === 's' || k === 'S') return stop(), speak(S.queue[0] && S.queue[0].v.word);
      if (S.mode === 'type') {
        if (S.flipped && k === 'Enter') return stop(), grade(S.typed);
        return;
      }
      if (k === ' ' || k === 'Enter') return stop(), S.flipped ? grade(2) : flip();
      if (!S.flipped) {
        if (k === 'ArrowLeft' || k === 'ArrowRight') return stop(), flip();
        return;
      }
      if (k === '1' || k === 'ArrowLeft') return stop(), grade(0);
      if (k === '2' || k === 'ArrowUp') return stop(), grade(1);
      if (k === '3' || k === 'ArrowRight') return stop(), grade(2);
    },
    true,
  );

  applyI18n();
  // the library may have been drawn before this file loaded
  badge();
  return {
    open,
    badge,
    render: () => (view === 'home' ? renderHome(false) : view === 'summary' && S ? summary() : S && showCard()),
    schedule,
  };
})();
