'use strict';
// Listening: a shelf of the library, beside "Articles" (shelves.js runs the title switch, the
// chips row and the crossfade for every shelf). Its chips are shows — YouTube
// channels and playlists: BBC Learning English, BBC World Service, TED… plus any link pasted into
// the search field; their newest episodes come from YouTube's public feeds (main.js / listen.js)
// and are drawn as library rows. An episode opens on its own page, like an article: the video,
// ±10 s, speed, subtitles, and under it a page to write on, in the article's own type.
// notes.listen keeps where you stopped, what you finished, what you wrote and today's minutes;
// the reading filters work here as unheard / started / listened. Space plays / pauses and ← →
// jump 10 s on the page (not while writing).
// Needs app.js (state, $, $$, esc, t, lang, save, toast, ring, renderLibrary, libHeader, showView,
// backToLibrary, settled) and shelves.js.
const Listen = (() => {
  Object.assign(I18N.uz, {
    'ls.speed': 'Tezlik',
    'ls.keys': 'Probel — pauza · ← → — 10 soniya',
    'ls.back10': '10 soniya orqaga',
    'ls.fwd10': '10 soniya oldinga',
    'ls.write': 'Yozish',
    'ls.writePh': "Eshitganingizni o'z so'zlaringiz bilan yozing…",
    'ls.words': (n) => `${n} ta so'z`,
    'ls.stats': (n, m) => `${n} ta epizod tinglangan · bugun ${m} daqiqa`,
    'ls.search': "Qidirish yoki YouTube havolasini qo'ying…",
    'ls.paste': "YouTube kanal yoki pleylist havolasini qidiruv maydoniga qo'ying va Enter bosing",
    'ls.adding': 'Qidirilmoqda…',
    'ls.add': '+ Shou',
    'ls.f.new': 'Tinglanmagan', 'ls.f.reading': 'Tinglanmoqda', 'ls.f.done': 'Tinglangan',
    'ls.addFail': 'Bu havoladan kanal yoki pleylist topilmadi',
    'ls.added': (s) => `«${s}» qo'shildi`,
    'ls.remove': "O'chirish",
    'ls.loading': 'Yuklanmoqda…',
    'ls.fail': "Epizodlarni yuklab bo'lmadi. Internetni tekshiring",
    'ls.empty': "Bu yerda hozircha epizod yo'q",
    'ls.done': 'Tinglandi',
    'ls.mark': 'Tinglandi deb belgilash',
    'ls.cc': 'Subtitr',
    'ls.views': (n) => `${n} marta ko'rilgan`,
    'ls.left': (m) => `${m} daq qoldi`,
  });
  Object.assign(I18N.en, {
    'ls.speed': 'Speed',
    'ls.keys': 'Space — pause · ← → — 10 seconds',
    'ls.back10': 'Back 10 seconds',
    'ls.fwd10': 'Forward 10 seconds',
    'ls.write': 'Writing',
    'ls.writePh': 'Write what you heard, in your own words…',
    'ls.words': (n) => `${n} words`,
    'ls.stats': (n, m) => `${n} episodes listened · ${m} min today`,
    'ls.search': 'Search, or paste a YouTube link…',
    'ls.paste': 'Paste a YouTube channel or playlist link into the search field and press Enter',
    'ls.adding': 'Looking it up…',
    'ls.add': '+ Show',
    'ls.f.new': 'Not heard', 'ls.f.reading': 'Listening', 'ls.f.done': 'Listened',
    'ls.addFail': 'No channel or playlist found at that link',
    'ls.added': (s) => `Added “${s}”`,
    'ls.remove': 'Remove',
    'ls.loading': 'Loading…',
    'ls.fail': "Couldn't load the episodes. Check the connection",
    'ls.empty': 'No episodes here yet',
    'ls.done': 'Listened',
    'ls.mark': 'Mark as listened',
    'ls.cc': 'Subtitles',
    'ls.views': (n) => `${n} views`,
    'ls.left': (m) => `${m} min left`,
  });
  Object.assign(I18N.ru, {
    'ls.speed': 'Скорость',
    'ls.keys': 'Пробел — пауза · ← → — 10 секунд',
    'ls.back10': 'Назад на 10 секунд',
    'ls.fwd10': 'Вперёд на 10 секунд',
    'ls.write': 'Письмо',
    'ls.writePh': 'Напишите своими словами, что услышали…',
    'ls.words': (n) => `${n} слов`,
    'ls.stats': (n, m) => `Прослушано выпусков: ${n} · сегодня ${m} мин`,
    'ls.search': 'Поиск или ссылка на YouTube…',
    'ls.paste': 'Вставьте ссылку на канал или плейлист YouTube в поле поиска и нажмите Enter',
    'ls.adding': 'Ищу…',
    'ls.add': '+ Шоу',
    'ls.f.new': 'Не слушал', 'ls.f.reading': 'Слушаю', 'ls.f.done': 'Прослушано',
    'ls.addFail': 'По этой ссылке не нашлось ни канала, ни плейлиста',
    'ls.added': (s) => `Добавлено: «${s}»`,
    'ls.remove': 'Удалить',
    'ls.loading': 'Загрузка…',
    'ls.fail': 'Не удалось загрузить выпуски. Проверьте интернет',
    'ls.empty': 'Здесь пока нет выпусков',
    'ls.done': 'Прослушано',
    'ls.mark': 'Отметить как прослушанное',
    'ls.cc': 'Субтитры',
    'ls.views': (n) => `${n} просмотров`,
    'ls.left': (m) => `осталось ${m} мин`,
  });

  // [key, name, kind, id]
  const SHOWS = [
    ['6min', '6 Minute English', 'playlist', 'PLcetZ6gSk96-FECmH9l7Vlx5VDigvgZpt'],
    ['ews', 'The English We Speak', 'playlist', 'PLcetZ6gSk9692J5Mq2pY4siPVbMCu4v6c'],
    ['ree', 'Real Easy English', 'playlist', 'PLcetZ6gSk96_IQnT7zKUjp7GtQeeGDI1a'],
    ['conv', 'Easy English Conversations', 'playlist', 'PLcetZ6gSk96-XmVQ1xpU3ziEtQvczLpJt'],
    ['6box', '6 Minute English · Box sets', 'playlist', 'PLcetZ6gSk969Tk3cxyIF0_RKRuM60zK9Q'],
    ['ble', 'BBC Learning English', 'channel', 'UCHaHD477h-FeBbVh9Sh7syA'],
    ['ws', 'BBC World Service', 'channel', 'UCQXHTFnQYFTqN0MqmNh9EIA'],
    ['r4', 'BBC Radio 4', 'channel', 'UCnkRLeAmZWkP-j738NZvhRw'],
    ['voa', 'VOA Learning English', 'channel', 'UCKyTokYo0nK2OA-az-sDijA'],
    ['ted', 'TED', 'channel', 'UCAuUUnT6oDeKwE6v1NGQxug'],
    ['teded', 'TED-Ed', 'channel', 'UCsooa4yRKGN_zEE8iknghZA'],
    ['econ', 'The Economist', 'channel', 'UC0p5jTq6Xx_DosDFxVXnWaQ'],
  ];
  const RATES = [0.75, 1, 1.25, 1.5];

  const L = () => {
    const n = state.notes;
    n.listen ||= {};
    n.listen.eps ||= {};
    n.listen.days ||= {};
    n.listen.shows ||= [];
    return n.listen;
  };
  const shows = () => SHOWS.concat(L().shows.map((s) => [s.key, s.name, s.kind, s.id, true]));
  const nameOf = (s) => (typeof s[1] === 'function' ? s[1]() : s[1]);
  const showNow = () => shows().find((s) => s[0] === L().show) || shows()[0];
  const today = () => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 10);

  const page = $('#watch');
  const search = $('#search');
  const cache = new Map(); // show key -> { at, items, err }
  const loading = new Set();
  let cur = null; // the episode on the page: { v, title, by, date, show }

  /* ---------------- the shelf: header, chips, rows ---------------- */

  function header() {
    const done = Object.values(L().eps).filter((e) => e.done).length;
    return t('ls.stats', done, Math.round((L().days[today()] || 0) / 60));
  }
  const chipsHtml = () => shows().map((x, i) => `<button data-s="${esc(x[0])}" style="--k:${i}" class="${x[0] === showNow()[0] ? 'on' : ''}">${esc(nameOf(x))}${x[4] ? `<i class="ls-x" data-x="${esc(x[0])}" title="${esc(t('ls.remove'))}">×</i>` : ''}</button>`).join('');
  function pick(key) {
    L().show = key;
    save();
  }
  function removeShow(key) {
    L().shows = L().shows.filter((s) => s.key !== key);
    if (L().show === key) delete L().show;
    save();
  }

  async function load(s, force) {
    const k = s[0];
    const c = cache.get(k);
    if (loading.has(k) || (!force && c && Date.now() - c.at < 20 * 60000 && !c.err)) return;
    loading.add(k);
    const r = await api.listenFeed(s[2], s[3]).catch((e) => ({ ok: false, err: e.message }));
    loading.delete(k);
    cache.set(k, r && r.ok ? { at: Date.now(), items: tidy(r.items, nameOf(s)) } : { at: Date.now(), items: (c && c.items) || [], err: (r && r.err) || 'fail' });
    if (state.shelf === 'listen' && state.view === 'library' && showNow()[0] === k) Shelves.swapList();
  }

  // titles without emoji, hashtags or the show's own name tacked on the end ("… ⏲️ 6 Minute
  // English", "… | BBC Learning English", "#shorts"); a blurb every episode shares is left out
  const EMOJI = /[\p{Extended_Pictographic}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu;
  function tidy(list, show) {
    const name = show.split(' · ')[0].toLowerCase();
    const seen = {};
    for (const it of list) seen[it.about] = (seen[it.about] || 0) + 1;
    return list.map((it) => {
      let title = it.title.replace(EMOJI, '').replace(/#\w+/g, '').split(' | ')[0].replace(/\s+/g, ' ').trim();
      if (title.toLowerCase().endsWith(name) && title.length > name.length + 8) title = title.slice(0, -name.length).replace(/[\s:–—-]+$/, '');
      const about = seen[it.about] > 2 ? '' : it.about.replace(EMOJI, '').replace(/#\w+/g, '').trim();
      return { ...it, title: title || it.title, about };
    });
  }

  const fmtDay = (d) => {
    const x = new Date(d);
    return isNaN(x) ? '' : new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' }).format(x);
  };
  const fmtNum = (n) => new Intl.NumberFormat(lang, { notation: 'compact' }).format(n);
  const statusOfEp = (v) => {
    const e = L().eps[v] || {};
    return e.done ? 'done' : e.t > 5 ? 'reading' : 'new';
  };

  // the library's own row: the date where the number is, the thumbnail where a picture goes,
  // the ring (or ✓), the time left and how much you wrote on the right
  function rowHtml(it, i) {
    const e = L().eps[it.v] || {};
    const p = e.done ? 1 : e.d ? Math.min(1, e.t / e.d) : 0;
    const left = e.d && !e.done && e.t > 5 ? t('ls.left', Math.max(1, Math.round((e.d - e.t) / 60))) : '';
    return `<li class="item ${statusOfEp(it.v)} has-img ls-row" data-v="${esc(it.v)}" style="animation-delay:${Math.min(i, 14) * 22}ms">
        <div class="item-num">${esc(fmtDay(it.date))}</div>
        <div><h3 class="item-title">${esc(it.title)}</h3><p class="item-ex">${esc(it.about || it.by)}</p></div>
        <img class="item-img" src="https://i.ytimg.com/vi/${esc(it.v)}/mqdefault.jpg" alt="" loading="lazy" decoding="async" />
        <div class="item-meta">${e.done ? '<span class="ls-tick">✓</span>' : ring(p)}${left ? `<span>${esc(left)}</span>` : ''}${e.wn ? `<span>${esc(t('ls.words', e.wn))}</span>` : it.views ? `<span>${esc(t('ls.views', fmtNum(it.views)))}</span>` : ''}</div>
      </li>`;
  }

  // called by Shelves.render() on this shelf: draws the list, always
  function render() {
    const s = showNow();
    $('#empty').hidden = true;
    libHeader(); // its counts line reads header() on this shelf; the vocabulary badge stays right
    const c = cache.get(s[0]);
    if (!c || (loading.has(s[0]) && !c.items.length)) {
      load(s);
      $('#list').innerHTML = `<li class="gd-msg gd-wait">${esc(t('ls.loading'))}</li>` + Array.from({ length: 6 }, (_, i) => `<li class="gd-skel" style="--i:${i}"><i></i><i></i><i></i></li>`).join('');
      return true;
    }
    load(s); // refreshes quietly when it's old
    if (c.err && !c.items.length) {
      $('#list').innerHTML = `<li class="gd-msg">${esc(t('ls.fail'))} <button class="btn ghost ls-retry">${esc(t('gd.retry'))}</button></li>`;
      return true;
    }
    const q = state.query.trim().toLowerCase();
    const items = c.items.filter((it) => (state.filter === 'all' || statusOfEp(it.v) === state.filter) && (!q || (it.title + ' ' + it.about).toLowerCase().includes(q)));
    $('#list').innerHTML = items.length ? items.map(rowHtml).join('') : `<li class="gd-msg">${esc(t('ls.empty'))}</li>`;
    return true;
  }
  const itemsOf = (key) => (cache.get(key) || {}).items || [];
  function refreshRow(v) {
    const li = $(`#list .ls-row[data-v="${CSS.escape(v)}"]`);
    const all = itemsOf(showNow()[0]);
    const i = all.findIndex((x) => x.v === v);
    if (li && i >= 0) {
      li.outerHTML = rowHtml(all[i], i);
      $(`#list .ls-row[data-v="${CSS.escape(v)}"]`).style.animation = 'none';
    }
  }

  /* ---------------- adding a show: a link in the search field, or on the clipboard ---------------- */

  const isYT = (v) => /^(https?:\/\/)?(www\.|m\.|music\.)?(youtube\.com|youtu\.be)\/\S+/i.test(v);
  async function addShow(url) {
    toast(t('ls.adding'));
    const r = await api.listenResolve(url);
    if (!r) return (toast(t('ls.addFail')), false);
    const key = 'u' + r.id;
    if (!L().shows.some((s) => s.key === key)) L().shows.push({ key, name: r.title, kind: r.kind, id: r.id });
    L().show = key;
    save();
    toast(t('ls.added', r.title));
    Shelves.chips();
    Shelves.swapList();
    const b = $(`#chips button[data-s="${CSS.escape(key)}"]`);
    if (b) b.scrollIntoView({ behavior: 'smooth', inline: 'nearest', block: 'nearest' });
    return true;
  }
  async function addFromButton() {
    const clip = String((await api.readClipboard().catch(() => '')) || '').trim();
    if (isYT(clip)) return addShow(clip);
    search.focus();
    toast(t('ls.paste'));
  }
  search.addEventListener('keydown', async (e) => {
    if (state.shelf !== 'listen' || e.key !== 'Enter' || !isYT(search.value.trim())) return;
    e.preventDefault();
    e.stopImmediatePropagation();
    search.classList.add('busy');
    const ok = await addShow(search.value.trim());
    search.classList.remove('busy');
    if (ok) (search.value = ''), (state.query = '');
  }, true);

  /* ---------------- the episode's page ---------------- */

  const body = $('#watch-body');
  // two columns: the video and its controls stay put on the left (sticky) while the writing on
  // the right scrolls; in a narrow window the video stays at the top and the writing goes under
  const SKIP = (dir) => `<svg viewBox="0 0 20 20"><path d="${dir < 0 ? 'M4 9a6 6 0 1 1 1.8 5M4 4v5h5' : 'M16 9a6 6 0 1 0-1.8 5M16 4v5h-5'}"/></svg><span>${dir < 0 ? '−' : '+'}10</span>`;
  body.innerHTML = `
    <div class="wt-left">
      <div class="wt-video"><div class="wt-frame" id="ls-frame"></div></div>
      <div class="wt-bar"><span class="ls-time" id="ls-time">0:00</span><div class="ls-track" id="ls-track"><i></i><b></b></div><span class="ls-time" id="ls-dur">0:00</span></div>
      <div class="wt-ctl">
        <button class="wt-skip" data-a="back" data-tt="ls.back10">${SKIP(-1)}</button>
        <button class="ls-play" data-a="play"><svg class="i-play" viewBox="0 0 16 16"><path d="M5 3.2v9.6L13 8z"/></svg><svg class="i-pause" viewBox="0 0 16 16"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg></button>
        <button class="wt-skip" data-a="fwd" data-tt="ls.fwd10">${SKIP(1)}</button>
        <span class="wt-sp"></span>
        <span class="wt-lab" id="wt-speed"></span>
        <div class="seg ls-rate" id="ls-rate">${RATES.map((r) => `<button data-r="${r}">${r}×</button>`).join('')}</div>
      </div>
      <div class="wt-opts">
        <button class="wt-tog ls-cc" data-a="cc"><span class="wt-cc">CC</span><span id="wt-ccl"></span><i class="wt-sw"></i></button>
        <button class="wt-tog ls-done" data-a="done"><span class="wt-ck">✓</span><span id="wt-dl"></span></button>
        <span class="wt-sp"></span>
        <span class="wt-keys" id="wt-keys"></span>
      </div>
    </div>
    <div class="wt-right">
      <h1 class="wt-title" id="wt-t"></h1>
      <p class="wt-meta" id="wt-m"></p>
      <section class="wt-write">
        <div class="wt-wh"><h2 id="wt-wl"></h2><span id="wt-wn"></span></div>
        <textarea id="wt-note" spellcheck="true"></textarea>
      </section>
    </div>`;
  const note = $('#wt-note');

  async function open(it, showKey) {
    const e = L().eps[it.v] || {};
    const start = e.t && !e.done && (!e.d || e.t < e.d - 15) ? e.t : 0;
    cur = { v: it.v, title: it.title, by: it.by, date: it.date, show: showKey };
    Object.assign(e, { title: it.title, by: it.by, at: Date.now() });
    L().eps[it.v] = e;
    save();
    if (typeof Player !== 'undefined') Player.pause(); // one sound at a time
    $('#watch-title').textContent = it.title;
    $('#wt-t').textContent = it.title;
    $('#wt-m').textContent = [it.by, fmtDay(it.date)].filter(Boolean).join(' · ');
    note.value = e.note || '';
    page.querySelector('.scroller').scrollTop = 0;
    mount(start);
    paint();
    await settled();
    fit();
    showView('watch');
  }

  /* ---------------- the writing ---------------- */
  // it grows with what's written (the page scrolls, the box never does) and is kept as you type
  const countWords = (s) => (s.trim().match(/\S+/g) || []).length;
  function fit() {
    note.style.height = 'auto';
    note.style.height = note.scrollHeight + 'px';
  }
  let noteT = 0;
  note.addEventListener('input', () => {
    fit();
    if (!cur) return;
    const e = L().eps[cur.v];
    e.note = note.value;
    e.wn = countWords(note.value);
    if (!e.note) delete e.note, delete e.wn;
    $('#wt-wn').textContent = e.wn ? t('ls.words', e.wn) : '';
    clearTimeout(noteT);
    noteT = setTimeout(save, 600);
  });
  note.addEventListener('keydown', (e) => e.stopPropagation());

  /* ---------------- the player (the YouTube embed, driven over postMessage) ---------------- */

  let iframe = null;
  let ready = false;
  let ps = -1; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  let pos = 0;
  let dur = 0;
  let lastTick = 0;
  let wantPause = false; // a reload of a paused video: it stays paused
  let saveT = 0;
  const send = (func, ...args) => iframe && iframe.contentWindow && iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args, id: 'ls', channel: 'widget' }), '*');
  const rate = () => L().rate || 1;

  function embed(v, start) {
    const q = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', autoplay: '1', iv_load_policy: '3', modestbranding: '1', start: String(Math.floor(start || 0)) });
    if (L().cc) q.set('cc_load_policy', '1'), q.set('cc_lang_pref', 'en');
    return `https://www.youtube-nocookie.com/embed/${encodeURIComponent(v)}?${q}`;
  }
  function mount(start) {
    ready = false;
    ps = -1; // until the embed says otherwise (autoplay can be refused)
    pos = start || 0;
    dur = (L().eps[cur.v] || {}).d || 0;
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.title = 'YouTube';
      $('#ls-frame').appendChild(iframe);
      iframe.addEventListener('load', handshake);
    }
    iframe.src = embed(cur.v, start);
  }

  let hsT = 0;
  function handshake() {
    clearInterval(hsT);
    let n = 0;
    const ping = () => {
      if (ready || !iframe || ++n > 40) return clearInterval(hsT);
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'ls', channel: 'widget' }), '*');
    };
    ping();
    hsT = setInterval(ping, 250);
  }

  window.addEventListener('message', (e) => {
    if (!iframe || e.source !== iframe.contentWindow) return;
    let m;
    try {
      m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data;
    } catch {
      return;
    }
    if (!m || !m.event) return;
    if (!ready && (m.event === 'onReady' || m.event === 'initialDelivery' || m.event === 'infoDelivery')) {
      ready = true;
      send('addEventListener', 'onStateChange');
      send('setPlaybackRate', rate());
      if (state.view !== 'watch' || wantPause) send('pauseVideo'); // the page was left meanwhile, or it was paused: nothing plays
      wantPause = false;
    }
    if (m.event === 'onStateChange') setState(m.info);
    if (m.event === 'infoDelivery' || m.event === 'initialDelivery') {
      const x = m.info || {};
      if (x.playerState != null) setState(x.playerState);
      if (x.duration) dur = x.duration;
      if (x.currentTime != null) tick(x.currentTime);
    }
  });

  function setState(s) {
    if (s === ps) return;
    ps = s;
    page.classList.toggle('playing', ps === 1 || ps === 3);
    if (ps === 1 && typeof Player !== 'undefined') Player.pause();
    if (ps === 0) finish();
    lastTick = performance.now();
  }

  // the clock: where we are, how long it played today, saved every few seconds
  function tick(sec) {
    const now = performance.now();
    if (ps === 1 && lastTick) {
      const dt = (now - lastTick) / 1000;
      if (dt > 0 && dt < 3) L().days[today()] = (L().days[today()] || 0) + dt;
    }
    lastTick = now;
    pos = sec;
    if (cur) {
      const e = L().eps[cur.v];
      e.t = Math.round(sec);
      if (dur) e.d = Math.round(dur);
      if (dur && sec / dur > 0.92 && !e.done) finish();
    }
    paintTime();
    clearTimeout(saveT);
    saveT = setTimeout(save, 4000);
  }

  function finish() {
    if (!cur) return;
    const e = L().eps[cur.v];
    if (e.done) return;
    e.done = true;
    save();
    paint();
  }

  const clock = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };
  function paintTime() {
    $('#ls-dur').textContent = clock(dur);
    if (dragging) return;
    const k = dur ? Math.min(1, pos / dur) : 0;
    $('#ls-time').textContent = clock(pos);
    $('#ls-track i').style.transform = `scaleX(${k})`;
    $('#ls-track b').style.transform = `translateX(${k * $('#ls-track').clientWidth}px)`;
  }
  function paint() {
    const done = !!(cur && (L().eps[cur.v] || {}).done);
    $('#wt-dl').textContent = t('ls.done');
    $('.ls-done', body).title = t('ls.mark');
    $('.ls-done', body).classList.toggle('on', done);
    $('#wt-ccl').textContent = t('ls.cc');
    $('.ls-cc', body).classList.toggle('on', !!L().cc);
    $('#wt-speed').textContent = t('ls.speed');
    $('#wt-keys').textContent = t('ls.keys');
    $$('[data-tt]', body).forEach((b) => (b.title = t(b.dataset.tt)));
    $$('#ls-rate button').forEach((b) => b.classList.toggle('on', +b.dataset.r === rate()));
    $('#wt-wl').textContent = t('ls.write');
    note.placeholder = t('ls.writePh');
    const wn = cur && (L().eps[cur.v] || {}).wn;
    $('#wt-wn').textContent = wn ? t('ls.words', wn) : '';
    paintTime();
  }

  // the track: press anywhere on it and drag; the thumb follows, the video jumps on release
  const track = $('#ls-track');
  let dragging = false;
  const at = (e) => {
    const b = track.getBoundingClientRect();
    return Math.max(0, Math.min(1, (e.clientX - b.left) / b.width));
  };
  let notch = -1;
  const show = (k) => {
    const n = k <= 0 ? -2 : k >= 1 ? 11 : Math.floor(k * 10);
    if (dragging && notch !== -1 && n !== notch) n === -2 || n === 11 ? Haptic.level() : Haptic.align();
    notch = n;
    $('#ls-track i').style.transform = `scaleX(${k})`;
    $('#ls-track b').style.transform = `translateX(${k * track.clientWidth}px)`;
    $('#ls-time').textContent = clock(k * dur);
  };
  track.addEventListener('pointerdown', (e) => {
    if (!dur) return;
    dragging = true;
    notch = -1;
    track.setPointerCapture(e.pointerId);
    track.classList.add('drag');
    show(at(e));
  });
  track.addEventListener('pointermove', (e) => dragging && show(at(e)));
  track.addEventListener('pointerup', (e) => {
    if (!dragging) return;
    dragging = false;
    track.classList.remove('drag');
    seek(at(e) * dur);
  });

  body.addEventListener('click', (e) => {
    const r = e.target.closest('#ls-rate button');
    if (r) {
      L().rate = +r.dataset.r;
      save();
      send('setPlaybackRate', rate());
      return paint();
    }
    const a = e.target.closest('[data-a]');
    if (!a || !cur) return;
    if (a.dataset.a === 'play') toggle();
    if (a.dataset.a === 'back') seek(pos - 10);
    if (a.dataset.a === 'fwd') seek(pos + 10);
    if (a.dataset.a === 'done') {
      const ep = L().eps[cur.v];
      ep.done = !ep.done;
      save();
      paint();
    }
    if (a.dataset.a === 'cc') {
      L().cc = !L().cc;
      save();
      captions();
      paint();
    }
  });

  // subtitles are an embed option the player only reads when it loads, so switching them reloads
  // the video at the very second it was at (and keeps playing if it was)
  function captions() {
    if (!cur) return;
    const was = ps === 1 || ps === 3;
    mount(pos);
    if (!was) wantPause = true;
  }

  const seek = (s) => {
    pos = Math.max(0, Math.min(dur || 1e9, s));
    send('seekTo', pos, true);
    paintTime();
  };
  const toggle = () => (ps === 1 ? send('pauseVideo') : send('playVideo'));

  window.addEventListener('keydown', (e) => {
    if (state.view !== 'watch' || !cur || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
    if (e.key === ' ') return (e.preventDefault(), toggle());
    if (e.key === 'ArrowLeft') return (e.preventDefault(), seek(pos - 10));
    if (e.key === 'ArrowRight') return (e.preventDefault(), seek(pos + 10));
  });

  // the rows open their episode's page
  $('#list').addEventListener('click', (e) => {
    if (state.shelf !== 'listen') return;
    if (e.target.closest('.ls-retry')) {
      cache.delete(showNow()[0]);
      return renderLibrary(true);
    }
    const row = e.target.closest('.ls-row[data-v]');
    if (!row) return;
    e.stopImmediatePropagation();
    const key = showNow()[0];
    const it = itemsOf(key).find((i) => i.v === row.dataset.v);
    if (it) open(it, key);
  }, true);

  // off the page the episode stops (it never plays unseen); back on the shelf its row is redrawn
  // and once the page has slid away the embed is let go of entirely (YouTube's player costs memory
  // and CPU even paused); the next episode makes a fresh one, starting where this one stopped
  let dropT = 0;
  new MutationObserver(() => {
    clearTimeout(dropT);
    if (page.classList.contains('is-active')) return;
    if (ps === 1 || ps === 3) send('pauseVideo');
    save();
    dropT = setTimeout(() => {
      if (page.classList.contains('is-active') || !iframe) return;
      iframe.remove();
      iframe = null;
      ready = false;
      ps = -1;
    }, 700);
    if (cur && state.shelf === 'listen') refreshRow(cur.v), libHeader();
  }).observe(page, { attributes: true, attributeFilter: ['class'] });
  $('#watch-back').addEventListener('click', backToLibrary);

  return { chipsHtml, pick, removeShow, render, header, addFromButton, leave: () => {} };
})();
