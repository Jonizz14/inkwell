'use strict';
// Music while reading: a YouTube playlist (or a single video) in a small floating player that
// stays on every screen, focus mode included. Folded it is a pill (cover, title, play); open it
// is a card with the video and the controls; the ≡ button raises the saved links from below
// the window beside it.
// Smoothness: it is one card that never changes size; the pill is the same card clipped down
// to its bottom-left corner, and opening just lets the clip grow back out, one continuous
// shape. The YouTube frame (a separate process) is never hidden, resized, scaled or blurred,
// so Chrome never has to wait for it mid-animation; a cover over it fades away instead.
// The cover, blurred far out behind the card, gives it a soft glow in the music's own colours.
// Talks to the embed with YouTube's postMessage protocol, so no API script has to be loaded.
// Needs app.js (state, save, toast, $, $$, esc, reduceMotion) and i18n.js.
const Player = (() => {
  Object.assign(I18N.uz, {
    'mp.lib': 'Playlistlar',
    'mp.btn': 'Musiqa (M)',
    'mp.add': "Qo'shish",
    'mp.ph': 'YouTube havolasi: playlist yoki video',
    'mp.bad': "Bu YouTube havolasiga o'xshamaydi",
    'mp.saved': 'Saqlanganlar',
    'mp.empty': "Hali hech narsa yo'q: YouTube'dan playlist havolasini nusxalab, shu yerga qo'ying",
    'mp.try': 'Sinab ko‘ring',
    'mp.playlist': 'Playlist',
    'mp.video': 'Video',
    'mp.loading': 'Yuklanmoqda…',
    'mp.paused': "To'xtatilgan",
    'mp.of': (i, n) => `${i} / ${n}`,
    'mp.shuffle': 'Aralash',
    'mp.close': "O'chirish",
    'mp.collapse': 'Kichraytirish',
    'mp.expand': 'Kattalashtirish',
    'mp.del': "O'chirish",
    'mp.tap': 'Boshlash uchun videoni bosing',
    'mp.err': (c) => (c === 101 || c === 150 || c === 153 ? "Bu video boshqa saytlarda ijro etilmaydi — keyingisiga o'tildi" : "Video ochilmadi — keyingisiga o'tildi"),
  });
  Object.assign(I18N.en, {
    'mp.lib': 'Playlists',
    'mp.btn': 'Music (M)',
    'mp.add': 'Add',
    'mp.ph': 'YouTube link: playlist or video',
    'mp.bad': "That doesn't look like a YouTube link",
    'mp.saved': 'Saved',
    'mp.empty': 'Nothing yet: copy a playlist link on YouTube and paste it here',
    'mp.try': 'Try',
    'mp.playlist': 'Playlist',
    'mp.video': 'Video',
    'mp.loading': 'Loading…',
    'mp.paused': 'Paused',
    'mp.of': (i, n) => `${i} of ${n}`,
    'mp.shuffle': 'Shuffle',
    'mp.close': 'Turn off',
    'mp.collapse': 'Collapse',
    'mp.expand': 'Expand',
    'mp.del': 'Remove',
    'mp.tap': 'Tap the video to start',
    'mp.err': (c) => (c === 101 || c === 150 || c === 153 ? "This video can't play outside YouTube — skipped" : "The video didn't open — skipped"),
  });
  Object.assign(I18N.ru, {
    'mp.lib': 'Плейлисты',
    'mp.btn': 'Музыка (M)',
    'mp.add': 'Добавить',
    'mp.ph': 'Ссылка YouTube: плейлист или видео',
    'mp.bad': 'Это не похоже на ссылку YouTube',
    'mp.saved': 'Сохранённые',
    'mp.empty': 'Пока пусто: скопируйте ссылку на плейлист в YouTube и вставьте сюда',
    'mp.try': 'Попробуйте',
    'mp.playlist': 'Плейлист',
    'mp.video': 'Видео',
    'mp.loading': 'Загрузка…',
    'mp.paused': 'Пауза',
    'mp.of': (i, n) => `${i} из ${n}`,
    'mp.shuffle': 'Вперемешку',
    'mp.close': 'Выключить',
    'mp.collapse': 'Свернуть',
    'mp.expand': 'Развернуть',
    'mp.del': 'Удалить',
    'mp.tap': 'Нажмите на видео, чтобы начать',
    'mp.err': (c) => (c === 101 || c === 150 || c === 153 ? 'Это видео нельзя смотреть вне YouTube — пропущено' : 'Видео не открылось — пропущено'),
  });

  const PRESETS = [{ list: 'PLOzDu-MXXLliO9fBNZOQTBDddoA3FzZUo', title: 'lofi hip hop — 200 tracks' }];
  const HOST = 'https://www.youtube-nocookie.com';

  const cfg = () => {
    const s = state.notes.settings;
    s.music ||= { items: [], cur: null, vol: 70, shuffle: false, shown: false };
    return s.music;
  };
  const curItem = () => cfg().items.find((x) => x.id === cfg().cur) || null;

  // any YouTube address (watch, youtu.be, shorts, live, embed, music.youtube) or a bare id
  function parse(raw) {
    const s = (raw || '').trim();
    if (!s) return null;
    let v = null;
    let list = null;
    if (/^[\w-]{11}$/.test(s)) v = s;
    else if (/^(PL|OL|RD|UU|FL|LL)[\w-]{10,}$/.test(s)) list = s;
    else {
      let u;
      try { u = new URL(/^https?:/i.test(s) ? s : 'https://' + s); } catch { return null; }
      if (!/(^|\.)(youtube\.com|youtube-nocookie\.com|youtu\.be)$/i.test(u.hostname)) return null;
      list = u.searchParams.get('list');
      v = u.searchParams.get('v');
      const m = u.pathname.match(/^\/(?:shorts|live|embed|v)\/([\w-]{11})/) || (/youtu\.be$/i.test(u.hostname) && u.pathname.match(/^\/([\w-]{11})/));
      if (!v && m) v = m[1];
      if (list === 'WL' || list === 'LL') list = null; // private lists can't be embedded
    }
    if (!v && !list) return null;
    return { v, list };
  }

  function embedUrl(it, autoplay) {
    const q = new URLSearchParams({ enablejsapi: '1', playsinline: '1', rel: '0', autoplay: autoplay ? '1' : '0', iv_load_policy: '3' });
    if (location.protocol.startsWith('http')) q.set('origin', location.origin);
    if (typeof PREVIEW !== 'undefined' && PREVIEW) q.set('mute', '1'); // the Settings preview plays without sound
    if (it.list) q.set('list', it.list);
    else q.set('loop', '1'), q.set('playlist', it.v); // a single video repeats
    return `${HOST}/embed/${it.v || 'videoseries'}?${q}`;
  }

  /* ---------------- DOM ---------------- */

  const ic = {
    play: '<svg class="i-play" viewBox="0 0 16 16"><path d="M5 3.2v9.6L13 8z"/></svg><svg class="i-pause" viewBox="0 0 16 16"><path d="M5.5 3.5v9M10.5 3.5v9"/></svg><i class="mp-spin"></i>',
    prev: '<svg viewBox="0 0 16 16"><path d="M4 3.5v9M12.5 3.8v8.4L6.2 8z"/></svg>',
    next: '<svg viewBox="0 0 16 16"><path d="M12 3.5v9M3.5 3.8v8.4L9.8 8z"/></svg>',
    shuffle: '<svg viewBox="0 0 16 16"><path d="M2 4.5h2.2c1.4 0 2.2.6 3 1.8l1.6 3.4c.8 1.2 1.6 1.8 3 1.8H14M2 11.5h2.2c1 0 1.6-.3 2.2-.9M11.8 2.8 14 4.5l-2.2 1.7M11.8 9.8l2.2 1.7-2.2 1.7M9.6 5.4c.6-.6 1.2-.9 2.2-.9H14"/></svg>',
    lib: '<svg viewBox="0 0 16 16"><path d="M2.5 4h11M2.5 8h11M2.5 12h7"/></svg>',
    down: '<svg viewBox="0 0 16 16"><path d="M4 6.5l4 4 4-4"/></svg>',
    x: '<svg viewBox="0 0 16 16"><path d="M4.5 4.5l7 7M11.5 4.5l-7 7"/></svg>',
  };
  const root = document.createElement('div');
  root.className = 'mp';
  root.id = 'mp';
  root.innerHTML = `
    <div class="mp-shell">
      <div class="mp-glow"></div>
      <div class="mp-lib">
        <div class="mp-lib-head"><b></b><button class="mp-libx" data-mp="lib">${ic.x}</button></div>
        <form class="mp-add"><input class="mp-url" type="text" spellcheck="false" autocomplete="off" /></form>
        <div class="mp-list"></div>
      </div>
      <div class="mp-card" role="region" aria-label="Music">
        <div class="mp-tint"></div>
        <div class="mp-screen">
          <div class="mp-frame"></div>
          <div class="mp-poster"><span>♪</span></div>
          <button class="mp-fold" data-mp="fold">${ic.down}</button>
        </div>
        <div class="mp-meta"><b class="mp-title"></b><small class="mp-sub"></small></div>
        <div class="mp-bar"><i></i></div>
        <div class="mp-ctl">
          <button class="mp-b sm mp-shuffle" data-mp="shuffle">${ic.shuffle}</button>
          <button class="mp-b mp-prev" data-mp="prev">${ic.prev}</button>
          <button class="mp-b mp-play big" data-mp="play">${ic.play}</button>
          <button class="mp-b mp-next" data-mp="next">${ic.next}</button>
          <button class="mp-b sm mp-libb" data-mp="lib">${ic.lib}</button>
        </div>
        <div class="mp-pbox">
          <button class="mp-open" data-mp="expand"><span class="mp-art"></span><span class="mp-ptext"><b class="mp-title"></b><small class="mp-sub"></small></span></button>
          <button class="mp-b mp-play" data-mp="play">${ic.play}</button>
        </div>
      </div>
    </div>`;
  document.body.appendChild(root);
  const card = $('.mp-card', root);
  const frameBox = $('.mp-frame', root);
  const poster = $('.mp-poster', root);
  const url = $('.mp-url', root);
  let iframe = null;
  let loaded = null; // id of the item in the iframe

  // player state as reported by the embed
  let ready = false;
  let ps = -1; // -1 unstarted, 0 ended, 1 playing, 2 paused, 3 buffering, 5 cued
  let info = { title: '', i: 0, n: 0, t: 0, d: 0 };
  let wantPlay = false;
  let tapT = 0;

  const send = (func, ...args) => iframe && iframe.contentWindow && iframe.contentWindow.postMessage(JSON.stringify({ event: 'command', func, args, id: 'mp', channel: 'widget' }), '*');

  function load(it, autoplay) {
    ready = false;
    ps = autoplay ? 3 : -1;
    info = { title: it.title || '', i: 0, n: it.count || 0, t: 0, d: 0, vid: it.v || it.thumb || '' };
    if (!iframe) {
      iframe = document.createElement('iframe');
      iframe.allow = 'autoplay; encrypted-media; picture-in-picture';
      iframe.referrerPolicy = 'strict-origin-when-cross-origin';
      iframe.title = 'YouTube';
      frameBox.appendChild(iframe);
      iframe.addEventListener('load', handshake);
    }
    iframe.src = embedUrl(it, autoplay);
    loaded = it.id;
    paint();
  }

  // the embed only reports back after it has been told someone is listening
  let hsT = 0;
  function handshake() {
    clearInterval(hsT);
    let n = 0;
    const ping = () => {
      if (ready || !iframe || ++n > 40) return clearInterval(hsT);
      iframe.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'mp', channel: 'widget' }), '*');
    };
    ping();
    hsT = setInterval(ping, 250);
  }

  window.addEventListener('message', (e) => {
    if (!iframe || e.source !== iframe.contentWindow) return;
    let m;
    try { m = typeof e.data === 'string' ? JSON.parse(e.data) : e.data; } catch { return; }
    if (!m || !m.event) return;
    if (!ready && (m.event === 'onReady' || m.event === 'initialDelivery' || m.event === 'infoDelivery')) {
      ready = true;
      send('addEventListener', 'onStateChange');
      send('addEventListener', 'onError');
      volNow = duckTarget();
      send('setVolume', Math.round(volNow));
      send('setLoop', true);
      if (cfg().shuffle) send('setShuffle', true);
      if (wantPlay) send('playVideo');
    }
    if (m.event === 'onStateChange') setState(m.info);
    if (m.event === 'onError') {
      toast(t('mp.err', m.info));
      if (curItem() && curItem().list) send('nextVideo');
      else wantPlay = false, setState(-1);
    }
    if (m.event === 'infoDelivery' || m.event === 'initialDelivery') {
      const x = m.info || {};
      if (x.playerState != null) setState(x.playerState);
      if (x.videoData && x.videoData.title) info.title = x.videoData.title;
      if (x.videoData && x.videoData.video_id) info.vid = x.videoData.video_id;
      if (Array.isArray(x.playlist)) info.n = x.playlist.length;
      if (x.playlistIndex != null && x.playlistIndex >= 0) info.i = x.playlistIndex + 1;
      if (x.currentTime != null) info.t = x.currentTime;
      if (x.duration != null) info.d = x.duration;
      const it = curItem();
      if (it && info.title && !it.title) (it.title = info.title), save(), renderList();
      if (it && info.n && it.count !== info.n) (it.count = info.n), save();
      if (it && info.vid && !it.v && !it.thumb) (it.thumb = info.vid), save(), renderList();
      paint();
    }
  });

  function setState(s) {
    if (s === ps) return;
    ps = s;
    if (s === 1) wantPlay = true, clearTimeout(tapT), root.classList.remove('tap');
    paint();
  }

  /* ---------------- painting ---------------- */

  const fmt = (s) => {
    s = Math.max(0, Math.floor(s || 0));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const ss = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`;
  };

  let art = null;
  function paint() {
    const it = curItem();
    root.classList.toggle('playing', ps === 1);
    document.body.classList.toggle('mp-playing', ps === 1);
    root.classList.toggle('busy', wantPlay && (ps === 3 || ps === -1) && !!iframe);
    root.classList.toggle('loaded', !!iframe && ready && ps !== -1);
    const title = info.title || (it && it.title) || (it ? (it.list ? t('mp.playlist') : t('mp.video')) : t('mp.lib'));
    const parts = [];
    if (info.d && info.d < 36000) parts.push(`${fmt(info.t)} / ${fmt(info.d)}`);
    else if (ps === 1 && !info.d) parts.push('LIVE');
    if (it && it.list && info.n) parts.push(t('mp.of', info.i || 1, info.n));
    if (!parts.length) parts.push(!it ? '' : !iframe ? (it.list ? t('mp.playlist') : t('mp.video')) : ps === 2 ? t('mp.paused') : t('mp.loading'));
    const sub = parts.join(' · ');
    $$('.mp-title', root).forEach((el) => el.textContent !== title && (el.textContent = title));
    $$('.mp-sub', root).forEach((el) => el.textContent !== sub && (el.textContent = sub));
    $('.mp-bar i', root).style.transform = `scaleX(${info.d ? Math.min(1, info.t / info.d) : 0})`;
    // one cover feeds the pill, the poster and the glow; it crossfades when the track changes
    const vid = info.vid || (it && (it.v || it.thumb));
    const th = vid ? `url("https://i.ytimg.com/vi/${vid}/mqdefault.jpg")` : '';
    if (th !== art) {
      art = th;
      const apply = () => {
        if (art !== th) return;
        root.style.setProperty('--art', th || 'none');
        root.classList.toggle('no-art', !th);
        // the new colours fade in instead of snapping
        const fading = [poster, ...$$('.mp-tint, .mp-art', root)];
        // taken off for one frame and put back, so the fade starts again without a forced layout
        fading.forEach((el) => el.classList.remove('swap'));
        requestAnimationFrame(() => requestAnimationFrame(() => fading.forEach((el) => el.classList.add('swap'))));
      };
      // decoded first, so no frame of an animation waits on the image
      if (!th) apply();
      else {
        const img = new Image();
        img.src = th.slice(5, -2);
        img.decode().then(apply, apply);
      }
    }
    const many = !!(it && it.list);
    root.classList.toggle('single', !many);
    $('.mp-shuffle', root).classList.toggle('on', !!cfg().shuffle);
  }

  function renderList() {
    const c = cfg();
    const rows = c.items.map((it, i) => `
      <div class="mp-item${it.id === c.cur ? ' on' : ''}" data-id="${it.id}" style="--i:${Math.min(i, 8)}">
        <span class="mp-ith"${it.v || it.thumb ? ` style="background-image:url('https://i.ytimg.com/vi/${it.v || it.thumb}/default.jpg')"` : ''}></span>
        <span class="mp-itt"><b>${esc(it.title || (it.list ? t('mp.playlist') : t('mp.video')))}</b><small>${it.list ? t('mp.playlist') + (it.count ? ' · ' + it.count : '') : t('mp.video')}</small></span>
        <button class="mp-x" data-mp="del" title="${esc(t('mp.del'))}">×</button>
      </div>`).join('');
    const tries = PRESETS.filter((p) => !c.items.some((x) => x.list === p.list))
      .map((p) => `<button class="mp-try" style="--i:${Math.min(c.items.length, 8)}" data-v="${p.list}">＋ ${esc(p.title)}</button>`).join('');
    $('.mp-list', root).innerHTML = (rows || `<p class="mp-empty">${esc(t('mp.empty'))}</p>`) + tries
      + (c.items.length ? `<button class="mp-off" data-mp="off">${esc(t('mp.close'))}</button>` : '');
  }

  function labels() {
    url.placeholder = t('mp.ph');
    $('.mp-lib-head b', root).textContent = t('mp.lib');
    $('.mp-shuffle', root).title = t('mp.shuffle');
    $('.mp-libb', root).title = t('mp.lib');
    $$('.mp-fold', root).forEach((b) => (b.title = t('mp.collapse')));
    $('.mp-open', root).title = t('mp.expand');
    $$('.mp-btn').forEach((b) => (b.title = t('mp.btn')));
    // the list is drawn when it is opened (setLib); drawing it at every start was wasted work
    if (root.classList.contains('lib')) renderList();
    paint();
  }

  /* ---------------- open / fold ---------------- */

  /* Matched geometry: the cover, title, time and play button are the same things in both
     sizes, so they don't fade out and back in; each flies from where it is to where it will
     be (a transform from the old box to the new one), while the card's clip grows around
     them. The cover can't fly as the video itself (the YouTube frame mustn't be scaled), so
     a copy of it (.mp-fly) does the flight, and the video shows up under it on landing. */
  const MATCH = [['.mp-pbox .mp-title', '.mp-meta .mp-title'], ['.mp-pbox .mp-sub', '.mp-meta .mp-sub'], ['.mp-pbox .mp-play', '.mp-ctl .mp-play']];
  const SPRING = 'cubic-bezier(0.32, 0.72, 0, 1)';
  const DUR = 560;
  const fly = document.createElement('div');
  fly.className = 'mp-fly';
  card.appendChild(fly);
  let anims = [];
  let settleT = 0;

  function morph(big) {
    anims.forEach((a) => a.cancel());
    anims = [];
    const art = $('.mp-pbox .mp-art', root);
    const screen = $('.mp-screen', root);
    const c0 = card.getBoundingClientRect();
    const from = MATCH.map((p) => $(p[big ? 0 : 1], root).getBoundingClientRect());
    const a0 = (big ? art : screen).getBoundingClientRect();
    root.classList.toggle('big', big);
    const c1 = card.getBoundingClientRect();
    const opts = { duration: DUR, easing: SPRING };
    MATCH.forEach((p, i) => {
      const el = $(p[big ? 1 : 0], root);
      const f = from[i];
      const r = el.getBoundingClientRect();
      if (!r.height) return;
      const k = f.height / r.height;
      anims.push(el.animate([{ transformOrigin: '0 0', transform: `translate(${f.left - r.left}px, ${f.top - r.top}px) scale(${k})` }, { transformOrigin: '0 0', transform: 'none' }], opts));
    });
    // the cover: a 16:9 box whose visible square shrinks/grows with it, so the picture is
    // never stretched; the corners stay round all the way
    const sr = screen.getBoundingClientRect();
    const ar = big ? a0 : art.getBoundingClientRect();
    Object.assign(fly.style, { left: sr.left - c1.left + 'px', top: sr.top - c1.top + 'px', width: sr.width + 'px', height: sr.height + 'px' });
    const k = ar.height / sr.height;
    const ix = (sr.width - sr.height) / 2;
    const small = { transform: `translate(${ar.left - sr.left - ix * k}px, ${ar.top - sr.top}px) scale(${k})`, clipPath: `inset(0px ${ix}px round ${13 / k}px)` };
    const full = { transform: 'none', clipPath: 'inset(0px 0px round 17px)' };
    root.classList.add('morph');
    const fa = fly.animate((big ? [small, full] : [full, small]).map((f) => ({ ...f, transformOrigin: '0 0' })), { ...opts, fill: 'both' });
    anims.push(fa);
    fa.finished.then(() => {
      root.classList.remove('morph');
      if (big) root.classList.add('settled');
      fa.cancel();
    }, () => {});
  }

  // the video joins in only after the card has landed, and leaves before anything moves
  function setBig(big, lib = false) {
    clearTimeout(settleT);
    const was = root.classList.contains('big');
    if (was !== big) {
      clampPos(big, true);
      root.classList.remove('settled');
      if (root.classList.contains('show') && !reduceMotion.matches) morph(big);
      else root.classList.toggle('big', big), root.classList.toggle('settled', big);
    }
    setLib(big && (lib || !curItem()));
  }
  let libT = 0;
  function setLib(on) {
    clearTimeout(libT);
    root.classList.remove('lib-in');
    root.classList.toggle('lib', on);
    // once out, the panel drops its filter so its list scrolls crisp
    if (on) libT = setTimeout(() => root.classList.add('lib-in'), 600);
    $('.mp-libb', root).classList.toggle('on', on);
    if (on) renderList(), setTimeout(() => root.classList.contains('lib') && !curItem() && url.focus({ preventScroll: true }), 300);
  }
  function show(big) {
    clearTimeout(hideT);
    cfg().shown = true;
    save();
    document.body.classList.add('mp-on');
    if (!root.classList.contains('show')) {
      // coming back from hidden it appears at its size right away (only the blur moves),
      // never as the pill growing into the card
      root.classList.add('snap');
      root.classList.toggle('big', big);
      root.classList.toggle('settled', big);
      void card.offsetWidth;
      veil();
      clampPos(big, false);
      setTimeout(() => root.classList.remove('snap'), FADE);
    }
    root.classList.add('show');
    setBig(big);
  }

  /* ---------------- actions ---------------- */

  function play() {
    const it = curItem();
    if (!it) return show(true);
    wantPlay = true;
    if (!iframe || loaded !== it.id) load(it, true);
    else send('playVideo');
    paint();
    // a phone may refuse to start sound from outside the video: let the video itself be tapped
    clearTimeout(tapT);
    if (matchMedia('(pointer: coarse)').matches) tapT = setTimeout(() => ps !== 1 && (root.classList.add('tap'), setBig(true), toast(t('mp.tap'))), 2500);
  }
  function pause() {
    wantPlay = false;
    send('pauseVideo');
  }
  const toggle = () => (ps === 1 || (wantPlay && ps === 3) ? pause() : play());

  function pick(id, autoplay = true) {
    cfg().cur = id;
    save();
    renderList();
    const it = curItem();
    if (!it) return;
    wantPlay = autoplay;
    load(it, autoplay);
  }

  function add(raw) {
    const p = parse(raw);
    if (!p) return toast(t('mp.bad')), card.classList.remove('shake'), void card.offsetWidth, card.classList.add('shake');
    const c = cfg();
    let it = c.items.find((x) => (p.list ? x.list === p.list : !x.list && x.v === p.v));
    if (!it) {
      it = { id: Math.random().toString(36).slice(2, 10), v: p.v, list: p.list, title: '', count: 0 };
      c.items.unshift(it);
    }
    url.value = '';
    url.blur();
    pick(it.id, true);
    // back to the video once it's chosen
    setTimeout(() => setLib(false), 260);
  }

  // in a playlist: its next / previous track; a single video: back to its start, or on to
  // the neighbouring saved link
  function step(dir) {
    const it = curItem();
    wantPlay = true;
    if (it && it.list) return send(dir > 0 ? 'nextVideo' : 'previousVideo');
    if (dir < 0 && info.t > 3) return send('seekTo', 0, true), (info.t = 0), paint();
    const items = cfg().items;
    if (items.length < 2) return send('seekTo', 0, true);
    const i = items.findIndex((x) => x.id === cfg().cur);
    pick(items[(i + dir + items.length) % items.length].id, true);
  }

  function off() {
    pause();
    wantPlay = false;
    clearTimeout(tapT);
    clearTimeout(settleT);
    if (iframe) iframe.remove(), (iframe = null), (loaded = null);
    ready = false;
    ps = -1;
    root.classList.remove('show', 'big', 'lib', 'settled', 'loaded', 'playing', 'busy', 'tap');
    document.body.classList.remove('mp-on', 'mp-playing');
    cfg().shown = false;
    save();
  }

  /* Putting the player away: it fades out through a blur right where it is, whatever its
     size. Music that's playing keeps playing (the note in the header dances); anything else
     is switched off once it's out of sight. */
  let hideT = 0;
  let veilT = 0;
  const FADE = 460; // .mp-shell's transition
  const veil = () => {
    clearTimeout(veilT);
    root.classList.add('veil');
    veilT = setTimeout(() => root.classList.remove('veil'), FADE);
  };
  function hide() {
    clearTimeout(hideT);
    veil();
    root.classList.remove('show');
    document.body.classList.remove('mp-on');
    cfg().shown = false;
    save();
    hideT = setTimeout(() => (ps === 1 || wantPlay ? setLib(false) : off()), FADE);
  }

  // the header button: open the player, or put it away
  function launcher() {
    if (!root.classList.contains('show')) return show(true);
    hide();
  }

  root.addEventListener('click', (e) => {
    const b = e.target.closest('[data-mp]');
    const item = e.target.closest('.mp-item');
    const tryB = e.target.closest('.mp-try');
    if (tryB) return add(tryB.dataset.v);
    if (b) {
      const a = b.dataset.mp;
      if (a === 'play') toggle();
      else if (a === 'next') step(1);
      else if (a === 'prev') step(-1);
      else if (a === 'expand') setBig(true);
      else if (a === 'fold') setBig(false);
      else if (a === 'lib') setLib(!root.classList.contains('lib'));
      else if (a === 'shuffle') {
        cfg().shuffle = !cfg().shuffle;
        save();
        send('setShuffle', cfg().shuffle);
        paint();
      } else if (a === 'off') off();
      else if (a === 'del' && item) {
        const c = cfg();
        item.classList.add('leaving');
        setTimeout(() => {
          c.items = c.items.filter((x) => x.id !== item.dataset.id);
          if (c.cur === item.dataset.id) {
            c.cur = c.items[0] ? c.items[0].id : null;
            if (iframe) iframe.remove(), (iframe = null), (loaded = null);
            wantPlay = false;
            ps = -1;
            info = { title: '', i: 0, n: 0, t: 0, d: 0 };
          }
          save();
          renderList();
          paint();
        }, reduceMotion.matches ? 0 : 220);
      }
      return;
    }
    if (item) {
      if (item.dataset.id !== cfg().cur || !iframe) pick(item.dataset.id, true);
      setTimeout(() => setLib(false), 200);
    }
  });
  // click on the line to jump in the track
  $('.mp-bar', root).addEventListener('click', (e) => {
    if (!info.d) return;
    const r = e.currentTarget.getBoundingClientRect();
    info.t = info.d * Math.max(0, Math.min(1, (e.clientX - r.left) / r.width));
    send('seekTo', info.t, true);
    paint();
  });
  $('.mp-add', root).addEventListener('submit', (e) => {
    e.preventDefault();
    add(url.value);
  });
  url.addEventListener('paste', () => setTimeout(() => parse(url.value) && add(url.value), 0));
  card.addEventListener('animationend', () => card.classList.remove('shake'));
  // stray keys typed in the link field mustn't drive the reader or the cards
  root.addEventListener('keydown', (e) => e.stopPropagation());

  // while music plays the note in the header turns into dancing bars, like iOS's now-playing
  $$('.mp-btn').forEach((b) => {
    b.insertAdjacentHTML('beforeend', '<span class="mp-eq" aria-hidden="true"><i></i><i></i><i></i><i></i></span>');
    b.addEventListener('click', (e) => (e.stopPropagation(), launcher()));
  });

  window.addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey || e.key.toLowerCase() !== 'm') return;
    if (e.target.closest && e.target.closest('input, textarea, [contenteditable="true"]')) return;
    if ($('.modal.show, .fs-veil.show')) return;
    e.preventDefault();
    if (!root.classList.contains('show')) show(!curItem());
    if (curItem()) toggle();
  });

  // Esc folds the big player before anything else reacts to it
  window.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape' || !root.classList.contains('big') || !curItem()) return;
    e.stopImmediatePropagation();
    if (root.classList.contains('lib')) setLib(false);
    else setBig(false);
  }, true);

  // a click elsewhere folds the big player back down (it keeps playing)
  document.addEventListener('pointerdown', (e) => {
    if (root.classList.contains('big') && !root.contains(e.target) && !e.target.closest('.mp-btn') && curItem()) setBig(false);
  });

  // the pill is the card clipped to its corner; the clip needs the card's height
  const PILL_W = 264;
  const PILL_H = 54;
  const fit = () => {
    const h = card.offsetHeight;
    root.style.setProperty('--mp-h', h + 'px');
    // the glow's box is the card plus 14px around (18px below); folded it hugs the pill
    const w = card.offsetWidth;
    root.style.setProperty('--mp-gsx', ((PILL_W + 20) / (w + 28)).toFixed(4));
    root.style.setProperty('--mp-gsy', ((PILL_H + 28) / (h + 32)).toFixed(4));
  };
  // the title arrives later and the fonts may load late: follow every change of size. The
  // observer also reports the first size, after the page's own first layout, so nothing here
  // makes the browser lay the page out early while it is still loading.
  new ResizeObserver(fit).observe(card);

  /* While reading in focus the music steps back to half, and to a quarter while the
     microphone listens for read-along, so it neither pulls the eye's attention nor gets heard
     as the reader's voice. A real muffle (a low-pass filter) would need the audio itself, which
     a YouTube embed never hands over, so it is the volume, eased over a second and a half. */
  let volNow = null;
  let rampT = 0;
  let duckWas = null;
  const duckTarget = () => {
    const b = document.body.classList;
    const duck = (state.notes.settings.duck ?? 50) / 100; // settings → volume in focus
    return cfg().vol * (b.contains('ra-on') ? Math.min(duck, 0.25) : b.contains('focus') ? duck : 1);
  };
  function ramp() {
    const to = duckTarget();
    if (to === duckWas) return;
    duckWas = to;
    clearInterval(rampT);
    if (!iframe || !ready) return (volNow = to);
    const from = volNow == null ? cfg().vol : volNow;
    const t0 = performance.now();
    const dur = reduceMotion.matches ? 0 : 1500;
    rampT = setInterval(() => {
      const k = dur ? Math.min(1, (performance.now() - t0) / dur) : 1;
      volNow = from + (to - from) * k * k * (3 - 2 * k);
      send('setVolume', Math.round(volNow));
      if (k >= 1) clearInterval(rampT);
    }, 60);
  }
  new MutationObserver(ramp).observe(document.body, { attributes: true, attributeFilter: ['class'] });

  /* ---------------- moving it ----------------
     The player can be dragged anywhere by its body (not its buttons). The place is kept as an
     offset from its home corner and saved; whatever it does, the visible part (the pill or
     the open card) stays inside the window, and a correction glides rather than jumps. */
  let px = 0;
  let py = 0;
  const place = (x, y, glide) => {
    px = Math.round(x);
    py = Math.round(y);
    root.style.transition = glide && !reduceMotion.matches ? 'translate 560ms cubic-bezier(0.32, 0.72, 0, 1)' : 'none';
    root.style.translate = `${px}px ${py}px`;
  };
  // the box that shows for a size: the whole card open, its corner pill folded
  const boxFor = (big) => {
    const c = card.getBoundingClientRect();
    return big ? c : { left: c.left, right: c.left + PILL_W, top: c.bottom - PILL_H, bottom: c.bottom };
  };
  function clampPos(big = root.classList.contains('big'), glide = true) {
    const b = boxFor(big);
    const m = 8;
    const dx = b.left < m ? m - b.left : b.right > innerWidth - m ? innerWidth - m - b.right : 0;
    const dy = b.top < m ? m - b.top : b.bottom > innerHeight - m ? innerHeight - m - b.bottom : 0;
    if (dx || dy) place(px + dx, py + dy, glide);
  }
  {
    const p = cfg().pos;
    if (p) place(p.x, p.y, false);
  }
  let drag = null;
  let dragged = false;
  card.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 || e.target.closest('button:not(.mp-open), input, .mp-bar, .mp-frame')) return;
    drag = { x: e.clientX, y: e.clientY, px, py, b: boxFor(root.classList.contains('big')), on: false };
    dragged = false;
  });
  window.addEventListener('pointermove', (e) => {
    if (!drag) return;
    let dx = e.clientX - drag.x;
    let dy = e.clientY - drag.y;
    if (!drag.on) {
      if (Math.hypot(dx, dy) < 5) return;
      drag.on = dragged = true;
      root.classList.add('dragging');
      card.setPointerCapture?.(e.pointerId);
    }
    const m = 8;
    dx = Math.max(m - drag.b.left, Math.min(innerWidth - m - drag.b.right, dx));
    dy = Math.max(m - drag.b.top, Math.min(innerHeight - m - drag.b.bottom, dy));
    place(drag.px + dx, drag.py + dy, false);
  });
  const drop = () => {
    if (!drag) return;
    if (drag.on) {
      root.classList.remove('dragging');
      cfg().pos = { x: px, y: py };
      save();
    }
    drag = null;
  };
  window.addEventListener('pointerup', drop);
  window.addEventListener('pointercancel', drop);
  // the click that ends a drag doesn't press anything (the pill would open)
  root.addEventListener('click', (e) => {
    if (!dragged) return;
    dragged = false;
    e.stopPropagation();
    e.preventDefault();
  }, true);
  window.addEventListener('resize', () => clampPos(undefined, false));

  // boot: the player comes back folded and silent, ready to press play (not in the Settings
  // demo: there only the shortcut being shown is on screen, and M brings the player up itself)
  if (cfg().shown && curItem() && !(typeof PREVIEW !== 'undefined' && PREVIEW)) show(false);
  labels();

  // from settings
  function setVolume(v) {
    cfg().vol = v;
    save();
    duckWas = null;
    ramp();
  }
  function resetPos() {
    delete cfg().pos;
    save();
    place(0, 0, true);
    setTimeout(() => clampPos(undefined, true), 600);
  }

  return { show, hide, play, pause, toggle, off, render: labels, parse, setVolume, resetPos };
})();
