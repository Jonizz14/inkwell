'use strict';
// The plan: every day one podcast watched to the end and one article read to the end.
// A page of its own (#plan, the "Plan" button in the library bar): today's two cards on top, then
// the coming days to plan ahead, then the last four weeks. A card opens its episode or article,
// and Back comes back here. Done means the app's own "done": an episode listened to the end
// (listen.js marks it past 92 %) and an article read past 95 % (statusOf). Today's moments of
// done are written down, so a day stays done whatever happens to the article later.
// notes.plan.days[YYYY-MM-DD] = { a: article id, e: { v, title, by, date, show }, ad, ed }
// Needs app.js (state, $, $$, esc, t, save, toast, showView, settled, statusOf, titleOf,
// openArticle, libImg) and listen.js.
const Plan = (() => {
  Object.assign(I18N.uz, {
    'pl.today': 'Bugun',
    'pl.btn': 'Reja',
    'pl.title': 'Reja',
    'pl.head': 'Bugungi reja',
    'pl.sub': (n) => (n === 2 ? 'Ikkalasi ham bajarildi' : `2 tadan ${n} tasi bajarildi`),
    'pl.pod': 'Podcast',
    'pl.art': 'Maqola',
    'pl.podGoal': "Bitta podcastni oxirigacha ko'rish",
    'pl.artGoal': "Bitta maqolani oxirigacha o'qish",
    'pl.pickPod': 'Podcast tanlash',
    'pl.pickArt': 'Maqola tanlash',
    'pl.watch': "Ko'rish",
    'pl.read': "O'qish",
    'pl.resume': 'Davom ettirish',
    'pl.watched': "Ko'rildi",
    'pl.readDone': "O'qildi",
    'pl.change': 'Almashtirish',
    'pl.remove': 'Olib tashlash',
    'pl.left': (m) => `${m} daq qoldi`,
    'pl.mins': (m) => `${m} daq`,
    'pl.week': 'Keyingi kunlar',
    'pl.auto': "Avto to'ldirish",
    'pl.autoDone': (n) => `${n} ta bo'sh joy to'ldirildi`,
    'pl.autoNone': "To'ldirish uchun yangi narsa topilmadi",
    'pl.history': 'Oxirgi 4 hafta',
    'pl.streak': (n) => `${n} kun ketma-ket`,
    'pl.full': (n) => `${n} kun to'liq bajarilgan`,
    'pl.allDone': 'Bugungi reja bajarildi',
    'pl.addPod': '+ Podcast',
    'pl.addArt': '+ Maqola',
    'pl.search': 'Qidirish…',
    'pl.plannedFor': (d) => `${d} uchun rejada`,
    'pl.noArts': "O'qilmagan maqola qolmadi",
    'pl.noEps': "Bu shouda ko'rilmagan epizod yo'q",
    'pl.close': 'Yopish',
    'pl.tomorrow': 'Ertaga',
    'pl.legendFull': 'Ikkalasi',
    'pl.legendHalf': 'Bittasi',
  });
  Object.assign(I18N.en, {
    'pl.today': 'Today',
    'pl.btn': 'Plan',
    'pl.title': 'Plan',
    'pl.head': "Today's plan",
    'pl.sub': (n) => (n === 2 ? 'Both done' : `${n} of 2 done`),
    'pl.pod': 'Podcast',
    'pl.art': 'Article',
    'pl.podGoal': 'Watch one podcast to the end',
    'pl.artGoal': 'Read one article to the end',
    'pl.pickPod': 'Choose a podcast',
    'pl.pickArt': 'Choose an article',
    'pl.watch': 'Watch',
    'pl.read': 'Read',
    'pl.resume': 'Continue',
    'pl.watched': 'Watched',
    'pl.readDone': 'Read',
    'pl.change': 'Change',
    'pl.remove': 'Remove',
    'pl.left': (m) => `${m} min left`,
    'pl.mins': (m) => `${m} min`,
    'pl.week': 'Coming days',
    'pl.auto': 'Fill automatically',
    'pl.autoDone': (n) => `Filled ${n} empty ${n === 1 ? 'slot' : 'slots'}`,
    'pl.autoNone': 'Nothing new to fill in with',
    'pl.history': 'Last 4 weeks',
    'pl.streak': (n) => `${n}-day streak`,
    'pl.full': (n) => `${n} full ${n === 1 ? 'day' : 'days'}`,
    'pl.allDone': "Today's plan is done",
    'pl.addPod': '+ Podcast',
    'pl.addArt': '+ Article',
    'pl.search': 'Search…',
    'pl.plannedFor': (d) => `Planned for ${d}`,
    'pl.noArts': 'No unread articles left',
    'pl.noEps': 'No unwatched episodes in this show',
    'pl.close': 'Close',
    'pl.tomorrow': 'Tomorrow',
    'pl.legendFull': 'Both',
    'pl.legendHalf': 'One',
  });
  Object.assign(I18N.ru, {
    'pl.today': 'Сегодня',
    'pl.btn': 'План',
    'pl.title': 'План',
    'pl.head': 'План на сегодня',
    'pl.sub': (n) => (n === 2 ? 'Оба выполнены' : `Выполнено ${n} из 2`),
    'pl.pod': 'Подкаст',
    'pl.art': 'Статья',
    'pl.podGoal': 'Досмотреть один подкаст до конца',
    'pl.artGoal': 'Дочитать одну статью до конца',
    'pl.pickPod': 'Выбрать подкаст',
    'pl.pickArt': 'Выбрать статью',
    'pl.watch': 'Смотреть',
    'pl.read': 'Читать',
    'pl.resume': 'Продолжить',
    'pl.watched': 'Просмотрено',
    'pl.readDone': 'Прочитано',
    'pl.change': 'Заменить',
    'pl.remove': 'Убрать',
    'pl.left': (m) => `осталось ${m} мин`,
    'pl.mins': (m) => `${m} мин`,
    'pl.week': 'Следующие дни',
    'pl.auto': 'Заполнить автоматически',
    'pl.autoDone': (n) => `Заполнено пустых мест: ${n}`,
    'pl.autoNone': 'Нечем заполнить: всё новое уже в плане',
    'pl.history': 'Последние 4 недели',
    'pl.streak': (n) => `${n} дн. подряд`,
    'pl.full': (n) => `Полных дней: ${n}`,
    'pl.allDone': 'План на сегодня выполнен',
    'pl.addPod': '+ Подкаст',
    'pl.addArt': '+ Статья',
    'pl.search': 'Поиск…',
    'pl.plannedFor': (d) => `В плане на ${d}`,
    'pl.noArts': 'Непрочитанных статей не осталось',
    'pl.noEps': 'В этом шоу нет непросмотренных выпусков',
    'pl.close': 'Закрыть',
    'pl.tomorrow': 'Завтра',
    'pl.legendFull': 'Оба',
    'pl.legendHalf': 'Один',
  });

  const AHEAD = 6; // days planned after today
  const page = $('#plan');
  const body = $('#plan-body');

  /* ---------------- the days ---------------- */

  const key = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
  const dayAt = (n) => {
    const d = new Date();
    d.setHours(12, 0, 0, 0);
    d.setDate(d.getDate() + n);
    return d;
  };
  const today = () => key(dayAt(0));
  const P = () => {
    const n = state.notes;
    n.plan ||= {};
    n.plan.days ||= {};
    return n.plan;
  };
  const day = (k) => P().days[k] || {};
  const dayRec = (k) => (P().days[k] ||= {});
  // a day with nothing left in it goes from the notes
  const tidyDay = (k) => {
    const d = P().days[k];
    if (d && !d.a && !d.e) delete P().days[k];
  };

  const meta = (id) => state.list.find((m) => m.id === id);
  const artDone = (id) => !!id && statusOf(id) === 'done';
  const epDone = (v) => !!v && !!Listen.ep(v).done;
  const artP = (id) => Math.min(1, ((state.notes.articles[id] || {}).progress) || 0);
  const epP = (v) => {
    const e = Listen.ep(v);
    return e.done ? 1 : e.d ? Math.min(1, (e.t || 0) / e.d) : 0;
  };

  // what is done today is written down the moment it's seen done (a past day stays as it was)
  let wasFull = null;
  function stamp() {
    const k = today();
    const d = P().days[k];
    if (!d) return (wasFull = false);
    let changed = false;
    if (d.a && !d.ad && artDone(d.a)) (d.ad = Date.now()), (changed = true);
    if (d.e && !d.ed && epDone(d.e.v)) (d.ed = Date.now()), (changed = true);
    if (changed) save();
    const full = !!(d.ad && d.ed);
    if (full && wasFull === false) {
      toast(t('pl.allDone'), 2600);
      if (typeof Haptic !== 'undefined') Haptic.level();
    }
    wasFull = full;
  }
  const doneCount = (d) => (d.ad ? 1 : 0) + (d.ed ? 1 : 0);

  // days in a row with both done, up to today (today still open doesn't break it)
  function streak() {
    let n = 0;
    for (let i = 0; i > -400; i--) {
      const d = day(key(dayAt(i)));
      if (doneCount(d) === 2) n++;
      else if (i < 0) break;
    }
    return n;
  }

  // everything planned on a day other than the given one (and not done yet)
  function plannedElsewhere(except) {
    const arts = new Map();
    const eps = new Map();
    for (const [k, d] of Object.entries(P().days)) {
      if (k === except || k < today()) continue;
      if (d.a && !artDone(d.a)) arts.set(d.a, k);
      if (d.e && !epDone(d.e.v)) eps.set(d.e.v, k);
    }
    return { arts, eps };
  }

  const fmt = (k, o) => dateFmt(o).format(new Date(k + 'T12:00:00'));
  const dayName = (k) => (k === today() ? t('pl.today') : k === key(dayAt(1)) ? t('pl.tomorrow') : fmt(k, { weekday: 'long' }));
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

  /* ---------------- the page ---------------- */

  const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 8.5 6.6 11.4 12.5 4.8"/></svg>';
  const PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L13 8z"/></svg>';
  const BOOK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5c2-.6 3.8-.4 5.5.8 1.7-1.2 3.5-1.4 5.5-.8v9c-2-.6-3.8-.4-5.5.8-1.7-1.2-3.5-1.4-5.5-.8z"/><path d="M8 4.3v9"/></svg>';
  const shown = { a: 0, e: 0 }; // the bars' last drawn lengths: they grow from there

  function podCard(d) {
    const e = d.e;
    if (!e) return `<button class="pl-card pl-empty" data-pick="e" data-day="${today()}"><span class="pl-k">${esc(t('pl.pod'))}</span><span class="pl-goal">${esc(t('pl.podGoal'))}</span><span class="pl-add">${esc(t('pl.pickPod'))}</span></button>`;
    const x = Listen.ep(e.v);
    const p = epP(e.v);
    const done = !!d.ed || epDone(e.v);
    const left = x.d && !done ? t('pl.left', Math.max(1, Math.round((x.d - (x.t || 0)) / 60))) : x.d ? t('pl.mins', Math.max(1, Math.round(x.d / 60))) : '';
    const act = done ? t('pl.watched') : (x.t || 0) > 5 ? t('pl.resume') : t('pl.watch');
    return `<div class="pl-card pl-pod${done ? ' done' : ''}" data-k="e">
      <button class="pl-open" data-open="e"><span class="pl-thumb"><img src="https://i.ytimg.com/vi/${esc(e.v)}/hqdefault.jpg" alt="" decoding="async" /><i class="pl-glyph">${done ? CHECK : PLAY}</i></span></button>
      <div class="pl-info">
        <span class="pl-k">${esc(t('pl.pod'))}${e.by ? ` · ${esc(e.by)}` : ''}</span>
        <h3 class="pl-t">${esc(e.title)}</h3>
        <div class="pl-bar"><i data-to="${p}" data-k="e"></i></div>
        <div class="pl-foot"><span class="pl-left">${esc(left)}</span><span class="pl-sp"></span>
          <button class="pl-link" data-pick="e" data-day="${today()}">${esc(t('pl.change'))}</button>
          <button class="btn ${done ? 'ghost pl-ok' : 'solid'} pl-go" data-open="e">${done ? CHECK : ''}${esc(act)}</button></div>
      </div>
    </div>`;
  }

  function artCard(d) {
    const m = d.a && meta(d.a);
    if (!m) return `<button class="pl-card pl-empty" data-pick="a" data-day="${today()}"><span class="pl-k">${esc(t('pl.art'))}</span><span class="pl-goal">${esc(t('pl.artGoal'))}</span><span class="pl-add">${esc(t('pl.pickArt'))}</span></button>`;
    const p = artP(m.id);
    const done = !!d.ad || artDone(m.id);
    const mins = Math.max(1, Math.round(m.words / 220));
    const left = done ? t('pl.mins', mins) : t('pl.left', Math.max(1, Math.round(mins * (1 - p))));
    const act = done ? t('pl.readDone') : p > 0.02 ? t('pl.resume') : t('pl.read');
    const img = libImg(m);
    return `<div class="pl-card pl-art${done ? ' done' : ''}" data-k="a">
      <button class="pl-open" data-open="a"><span class="pl-thumb pl-page">${img ? `<img src="${esc(img)}" alt="" decoding="async" />` : `<b>${esc(titleOf(m).slice(0, 1))}</b>`}<i class="pl-glyph">${done ? CHECK : BOOK}</i></span></button>
      <div class="pl-info">
        <span class="pl-k">${esc(t('pl.art'))}${m.by ? ` · ${esc(m.by)}` : ''}</span>
        <h3 class="pl-t">${esc(titleOf(m))}</h3>
        <div class="pl-bar"><i data-to="${p}" data-k="a"></i></div>
        <div class="pl-foot"><span class="pl-left">${esc(left)}</span><span class="pl-sp"></span>
          <button class="pl-link" data-pick="a" data-day="${today()}">${esc(t('pl.change'))}</button>
          <button class="btn ${done ? 'ghost pl-ok' : 'solid'} pl-go" data-open="a">${done ? CHECK : ''}${esc(act)}</button></div>
      </div>
    </div>`;
  }

  // a coming day: its name and date, then its podcast and its article (each one a button)
  function weekRow(k, i) {
    const d = day(k);
    const m = d.a && meta(d.a);
    const slot = (kind, title, sub, done) =>
      title
        ? `<button class="pl-slot on${done ? ' done' : ''}" data-pick="${kind}" data-day="${k}"><span class="pl-sk">${esc(t(kind === 'e' ? 'pl.pod' : 'pl.art'))}</span><span class="pl-st">${done ? `<i class="pl-tick">${CHECK}</i>` : ''}${esc(title)}</span>${sub ? `<span class="pl-ss">${esc(sub)}</span>` : ''}</button>`
        : `<button class="pl-slot" data-pick="${kind}" data-day="${k}"><span class="pl-sadd">${esc(t(kind === 'e' ? 'pl.addPod' : 'pl.addArt'))}</span></button>`;
    return `<li class="pl-day" style="--i:${i}">
      <div class="pl-dn"><b>${esc(cap(dayName(k)))}</b><span>${esc(fmt(k, { day: 'numeric', month: 'short' }))}</span></div>
      ${slot('e', d.e && d.e.title, d.e && d.e.by, d.e && epDone(d.e.v))}
      ${slot('a', m && titleOf(m), m && t('pl.mins', Math.max(1, Math.round(m.words / 220))), m && artDone(m.id))}
    </li>`;
  }

  // the last four weeks, Monday first: a full dot for both, a half one for one of the two
  function history() {
    const mon = -((dayAt(0).getDay() + 6) % 7); // this week's Monday, in days from today
    const cells = [];
    let full = 0;
    for (let i = mon - 21; i <= mon + 6; i++) {
      const k = key(dayAt(i));
      const n = i > 0 ? 0 : doneCount(day(k));
      if (n === 2) full++;
      cells.push(`<i class="pl-dot n${n}${i === 0 ? ' now' : ''}${i > 0 ? ' future' : ''}" style="--i:${i - mon + 21}" title="${esc(fmt(k, { weekday: 'short', day: 'numeric', month: 'short' }))}"></i>`);
    }
    const heads = Array.from({ length: 7 }, (_, j) => `<span>${esc(fmt(key(dayAt(mon + j)), { weekday: 'narrow' }))}</span>`).join('');
    return `<section class="pl-hist">
      <div class="pl-hh"><h2>${esc(t('pl.history'))}</h2><span class="pl-sp"></span><span class="pl-stat">${esc(t('pl.streak', streak()))}</span><span class="pl-stat">${esc(t('pl.full', full))}</span></div>
      <div class="pl-grid">${heads}${cells.join('')}</div>
      <div class="pl-legend"><span><i class="pl-dot n2"></i>${esc(t('pl.legendFull'))}</span><span><i class="pl-dot n1"></i>${esc(t('pl.legendHalf'))}</span></div>
    </section>`;
  }

  function render(enter) {
    stamp();
    const d = day(today());
    const n = doneCount(d);
    const ks = Array.from({ length: AHEAD }, (_, i) => key(dayAt(i + 1)));
    body.classList.toggle('enter', !!enter);
    body.innerHTML = `
      <header class="pl-head">
        <span class="pl-date">${esc(cap(fmt(today(), { weekday: 'long', day: 'numeric', month: 'long' })))}</span>
        <h1>${esc(t('pl.head'))}</h1>
        <div class="pl-prog"><span class="pl-pips"><i class="${d.ed ? 'on' : ''}"></i><i class="${d.ad ? 'on' : ''}"></i></span>${esc(t('pl.sub', n))}</div>
      </header>
      <div class="pl-today">${podCard(d)}${artCard(d)}</div>
      <section class="pl-week">
        <div class="pl-hh"><h2>${esc(t('pl.week'))}</h2><span class="pl-sp"></span><button class="btn ghost pl-auto" data-a="auto">${esc(t('pl.auto'))}</button></div>
        <ol class="pl-days">${ks.map(weekRow).join('')}</ol>
      </section>
      ${history()}`;
    // the bars grow from where they were last drawn to where they are now
    const bars = $$('.pl-bar i', body);
    bars.forEach((b) => (b.style.transform = `scaleX(${enter ? 0 : shown[b.dataset.k] || 0})`));
    requestAnimationFrame(() =>
      requestAnimationFrame(() =>
        bars.forEach((b) => {
          b.style.transform = `scaleX(${b.dataset.to})`;
          shown[b.dataset.k] = +b.dataset.to;
        })
      )
    );
    badge();
  }

  async function open() {
    closeMenu();
    closeDrawer();
    page.classList.remove('deep');
    render(true);
    await settled();
    showView('plan');
  }

  // back from an episode or an article opened here (app.js backToLibrary)
  const BACKS = ['#btn-back', '#watch-back'];
  const backLabel = (on) => BACKS.forEach((b) => ($(b).innerHTML = on ? `←&nbsp; ${esc(t('pl.title'))}` : t('reader.back')));
  function back() {
    backLabel(false);
    render(false);
    page.classList.remove('deep');
    showView('plan');
  }

  // a card opens its episode or article; Back brings you here
  async function go(kind) {
    const d = day(today());
    state.backTo = 'plan';
    page.classList.add('deep');
    backLabel(true);
    if (kind === 'a' && d.a) await openArticle(d.a);
    if (kind === 'e' && d.e) await Listen.open(d.e, d.e.show);
    if (state.view === 'plan') (state.backTo = null), page.classList.remove('deep'), backLabel(false); // it didn't open
  }

  /* ---------------- filling the days ---------------- */

  // the next articles to read: started ones first, then the library's order
  function nextArticles(taken) {
    const left = state.list.filter((m) => !artDone(m.id) && !taken.has(m.id) && !m.op);
    const started = left.filter((m) => artP(m.id) > 0.02).sort((x, y) => artP(y.id) - artP(x.id));
    return started.concat(left.filter((m) => artP(m.id) <= 0.02));
  }
  // the next episodes of a show: started ones first, then the newest
  function nextEpisodes(items, taken) {
    const left = items.filter((it) => !epDone(it.v) && !taken.has(it.v));
    return left.filter((it) => (Listen.ep(it.v).t || 0) > 5).concat(left.filter((it) => (Listen.ep(it.v).t || 0) <= 5));
  }
  const epRec = (it, show) => ({ v: it.v, title: it.title, by: it.by, date: it.date, show });

  async function autofill() {
    const btn = $('.pl-auto', body);
    if (btn) btn.classList.add('busy');
    const ks = Array.from({ length: AHEAD + 1 }, (_, i) => key(dayAt(i)));
    const taken = plannedElsewhere(null);
    // filled from your own shelf (saved web pages stay a choice of yours: their text can expire)
    const arts = nextArticles(new Set(taken.arts.keys())).filter((m) => (m.kind || '365') === '365');
    // episodes from the show last planned (or the one open on the shelf)
    const last = Object.keys(P().days).sort().reverse().map((k) => P().days[k].e).find(Boolean);
    const feed = await Listen.episodes((last && last.show) || Listen.showNow()).catch(() => ({ items: [] }));
    const eps = nextEpisodes(feed.items, new Set(taken.eps.keys()));
    let n = 0;
    for (const k of ks) {
      const d = day(k);
      if (!d.a && arts.length) (dayRec(k).a = arts.shift().id), n++;
      if (!d.e && eps.length) (dayRec(k).e = epRec(eps.shift(), feed.key)), n++;
    }
    if (n) save();
    toast(n ? t('pl.autoDone', n) : t('pl.autoNone'));
    render(false);
    $$('.pl-slot.on, .pl-today .pl-card', body).forEach((el) => el.classList.add('fresh'));
  }

  /* ---------------- the chooser: a sheet over the page ---------------- */

  const sheet = document.createElement('div');
  sheet.className = 'pl-sheet';
  sheet.innerHTML = `<div class="pl-scrim"></div><div class="pl-box" role="dialog"><div class="pl-bh"><h2></h2><span class="pl-sp"></span><button class="pl-link pl-rm"></button><button class="btn ghost icon pl-x">×</button></div><div class="pl-tools"></div><ol class="pl-list"></ol></div>`;
  page.appendChild(sheet);
  const list = $('.pl-list', sheet);
  let pick = null; // { kind, day, show, q }

  function choose(kind, k) {
    const d = day(k);
    clearTimeout(dropT);
    pick = { kind, day: k, show: (d.e && d.e.show) || Listen.showNow(), q: '' };
    $('h2', sheet).textContent = t(kind === 'e' ? 'pl.pickPod' : 'pl.pickArt') + ' · ' + cap(dayName(k));
    $('.pl-rm', sheet).textContent = t('pl.remove');
    $('.pl-rm', sheet).hidden = !(kind === 'e' ? d.e : d.a);
    $('.pl-x', sheet).title = t('pl.close');
    tools();
    fill();
    sheet.classList.add('show');
    const s = $('.pl-q', sheet);
    if (s) setTimeout(() => s.focus({ preventScroll: true }), 60);
  }
  // once faded, the rows go: hidden, they were still laid out with every redraw of the page
  let dropT = 0;
  function closeSheet() {
    if (!pick) return;
    sheet.classList.remove('show');
    pick = null;
    clearTimeout(dropT);
    dropT = setTimeout(() => !pick && ((list.innerHTML = ''), (list._items = null)), 320);
  }

  function tools() {
    const box = $('.pl-tools', sheet);
    if (pick.kind === 'a') {
      box.innerHTML = `<input class="pl-q" type="search" placeholder="${esc(t('pl.search'))}" autocomplete="off" spellcheck="false" />`;
      return;
    }
    box.innerHTML = `<div class="pl-shows">${Listen.showList().map((s) => `<button data-show="${esc(s.key)}" class="${s.key === pick.show ? 'on' : ''}">${esc(s.name)}</button>`).join('')}</div>`;
    const on = $('.pl-shows .on', box);
    if (on) requestAnimationFrame(() => on.scrollIntoView({ inline: 'center', block: 'nearest' }));
  }

  const elsewhere = (map, id) => {
    const k = map.get(id);
    return k && k !== pick.day ? t('pl.plannedFor', cap(dayName(k))) : '';
  };

  const RISE = 10; // rows that come in through a blur; the rest are simply there
  async function fill(quiet) {
    const p = pick;
    const taken = plannedElsewhere(p.day);
    if (p.kind === 'a') {
      const q = p.q.trim().toLowerCase();
      const all = state.list.filter((m) => !m.op && (!artDone(m.id) || m.id === day(p.day).a));
      const rows = (q ? all.filter((m) => (titleOf(m) + ' ' + (m.excerpt || '')).toLowerCase().includes(q)) : nextArticles(new Set()).concat(all.filter((m) => artDone(m.id)))).slice(0, 60);
      list.innerHTML = rows.length
        ? rows
            .map((m, i) => {
              const pr = artP(m.id);
              const note = elsewhere(taken.arts, m.id);
              return `<li><button class="pl-row${i >= RISE || quiet ? ' still' : ''}${m.id === day(p.day).a ? ' cur' : ''}${note ? ' taken' : ''}" data-id="${esc(m.id)}" style="--i:${Math.min(i, 12)}"><span class="pl-rn">${ring(pr)}</span><span class="pl-rt"><b>${esc(titleOf(m))}</b><span>${esc(note || [t('pl.mins', Math.max(1, Math.round(m.words / 220))), pr > 0.02 ? Math.round(pr * 100) + '%' : ''].filter(Boolean).join(' · '))}</span></span></button></li>`;
            })
            .join('')
        : `<li class="pl-msg">${esc(t('pl.noArts'))}</li>`;
      return;
    }
    list.innerHTML = `<li class="pl-msg">${esc(t('ls.loading'))}</li>`;
    const feed = await Listen.episodes(p.show).catch(() => ({ items: [], err: true }));
    if (pick !== p || p.show !== feed.key) return; // closed, or another show was picked meanwhile
    if (feed.err) return (list.innerHTML = `<li class="pl-msg">${esc(t('ls.fail'))}</li>`);
    const cur = day(p.day).e;
    const rows = nextEpisodes(feed.items, new Set()).concat(feed.items.filter((it) => epDone(it.v)));
    list.innerHTML = rows.length
      ? rows
          .map((it, i) => {
            const note = elsewhere(taken.eps, it.v);
            const x = Listen.ep(it.v);
            const dur = x.d ? t('pl.mins', Math.max(1, Math.round(x.d / 60))) : '';
            return `<li><button class="pl-row pl-erow${i >= RISE ? ' still' : ''}${cur && cur.v === it.v ? ' cur' : ''}${note ? ' taken' : ''}${epDone(it.v) ? ' done' : ''}" data-v="${esc(it.v)}" style="--i:${Math.min(i, 12)}"><img class="pl-rimg" src="https://i.ytimg.com/vi/${esc(it.v)}/mqdefault.jpg" alt="" loading="lazy" decoding="async" /><span class="pl-rt"><b>${esc(it.title)}</b><span>${esc(note || [fmtDate(it.date), dur, epDone(it.v) ? t('ls.done') : ''].filter(Boolean).join(' · '))}</span></span></button></li>`;
          })
          .join('')
      : `<li class="pl-msg">${esc(t('pl.noEps'))}</li>`;
    list._items = feed.items;
  }
  const fmtDate = (d) => {
    const x = new Date(d);
    return isNaN(x) ? '' : dateFmt({ day: 'numeric', month: 'short' }).format(x);
  };

  function put(value) {
    const k = pick.day;
    const d = dayRec(k);
    const kind = pick.kind;
    if (kind === 'a') {
      if (d.a !== value) delete d.ad;
      value ? (d.a = value) : delete d.a;
    } else {
      if (!value || !d.e || d.e.v !== value.v) delete d.ed;
      value ? (d.e = value) : delete d.e;
    }
    // the same thing planned for another day moves here
    if (value)
      for (const [o, x] of Object.entries(P().days)) {
        if (o === k || o < today()) continue;
        if (kind === 'a' && x.a === value && !artDone(value)) delete x.a, tidyDay(o);
        if (kind === 'e' && x.e && x.e.v === value.v && !epDone(value.v)) delete x.e, tidyDay(o);
      }
    tidyDay(k);
    save();
    if (kind === 'a') shown.a = 0;
    else shown.e = 0;
    closeSheet();
    render(false);
    const el = k === today() ? $(`.pl-today [data-k="${kind}"], .pl-today .pl-empty[data-pick="${kind}"]`, body) : $(`.pl-slot[data-day="${k}"][data-pick="${kind}"]`, body);
    if (el) el.classList.add('fresh');
  }

  sheet.addEventListener('click', (e) => {
    if (e.target.closest('.pl-scrim, .pl-x')) return closeSheet();
    if (!pick) return;
    if (e.target.closest('.pl-rm')) return put(null);
    const s = e.target.closest('[data-show]');
    if (s) {
      pick.show = s.dataset.show;
      $$('.pl-shows button', sheet).forEach((b) => b.classList.toggle('on', b === s));
      s.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      return fill();
    }
    const r = e.target.closest('.pl-row');
    if (!r) return;
    if (r.dataset.id) return put(r.dataset.id);
    const it = (list._items || []).find((x) => x.v === r.dataset.v);
    if (it) put(epRec(it, pick.show));
  });
  let typeF = 0;
  sheet.addEventListener('input', (e) => {
    if (!pick || !e.target.matches('.pl-q')) return;
    pick.q = e.target.value;
    cancelAnimationFrame(typeF);
    typeF = requestAnimationFrame(() => pick && fill(true));
  });
  document.addEventListener('keydown', (e) => {
    if (pick && e.key === 'Escape') (e.stopImmediatePropagation(), e.preventDefault(), closeSheet());
  }, true);

  body.addEventListener('click', (e) => {
    const o = e.target.closest('[data-open]');
    if (o) return go(o.dataset.open);
    const p = e.target.closest('[data-pick]');
    if (p) return choose(p.dataset.pick, p.dataset.day);
    if (e.target.closest('[data-a="auto"]')) autofill();
  });
  $('#plan-back').addEventListener('click', () => (closeSheet(), backToLibrary()));

  /* ---------------- the library's button: "Plan 1/2" ---------------- */

  const btn = document.createElement('button');
  btn.className = 'btn ghost';
  btn.id = 'btn-plan';
  btn.innerHTML = `<span class="pl-bl"></span> <span class="count" id="plan-count"></span>`;
  $('#btn-cards').before(btn);
  btn.addEventListener('click', open);
  function badge() {
    $('.pl-bl', btn).textContent = t('pl.btn');
    btn.title = t('pl.head');
    const d = day(today());
    const n = doneCount(d);
    const c = $('#plan-count');
    c.textContent = n === 2 ? '✓' : `${n}/2`;
    c.classList.toggle('full', n === 2);
  }
  // the counts are looked at again whenever the library comes back (an article was just finished)
  let libOn = true;
  new MutationObserver(() => {
    const on = $('#library').classList.contains('is-active');
    if (on && !libOn) stamp(), badge();
    libOn = on;
  }).observe($('#library'), { attributes: true, attributeFilter: ['class'] });

  return { open, back, render, badge, stamp, isOpen: () => state.view === 'plan' };
})();
