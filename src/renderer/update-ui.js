// Updates, as the reader sees them. A newer version is announced by a banner in the top-right
// corner ("Yangilash"); its text opens "What's new", a page with the changes and the files
// that come down. Updating fills a hairline and rolls the count; then "Yangilandi" with
// "Qayta ochish". After the restart the banner greets the new version once.
// Started with --update-demo, it plays the whole thing with a sample update.
const UpdateUI = (() => {
  const TX = {
    uz: {
      wait: 'Iltimos, ilovani yopmang', hide: 'Yashirish', come: (v) => `Yangilanish · v${v}`, more: "Nima yangi — batafsil ›", go: 'Yangilash', load: 'Yangilanmoqda…', of: 'fayl',
      done: 'Yangilandi', doneSub: 'Yangi versiya tayyor', re: 'Qayta ochish', hi: (v) => `Yangilandi · v${v}`,
      page: 'Nima yangi', meta: (n, kb) => `${n} ta fayl · ${kb} KB yuklanadi`, metaDone: 'O‘rnatildi', files: 'Changed files',
      sec: { add: 'New', better: 'Improved', fix: 'Fixed' },
    },
    en: {
      wait: "Please don't close the app", hide: 'Hide', come: (v) => `Update · v${v}`, more: "What's new ›", go: 'Update', load: 'Updating…', of: 'files',
      done: 'Updated', doneSub: 'The new version is ready', re: 'Reopen', hi: (v) => `Updated · v${v}`,
      page: "What's new", meta: (n, kb) => `${n} files · ${kb} KB to download`, metaDone: 'Installed', files: 'Changed files',
      sec: { add: 'New', better: 'Improved', fix: 'Fixed' },
    },
    ru: {
      wait: 'Пожалуйста, не закрывайте приложение', hide: 'Скрыть', come: (v) => `Обновление · v${v}`, more: 'Что нового ›', go: 'Обновить', load: 'Обновляется…', of: 'файлов',
      done: 'Обновлено', doneSub: 'Новая версия готова', re: 'Перезапустить', hi: (v) => `Обновлено · v${v}`,
      page: 'Что нового', meta: (n, kb) => `${n} файла · ${kb} КБ к загрузке`, metaDone: 'Установлено', files: 'Changed files',
      sec: { add: 'New', better: 'Improved', fix: 'Fixed' },
    },
  };
  const tx = () => TX[document.documentElement.lang] || TX.uz;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const SAMPLE = {
    version: '1.1.16',
    date: '22.10.2026',
    // release notes are written in English, whatever the app's language
    changes: {
      add: [
        ['Listening', 'A shelf beside Articles for YouTube shows, each episode on its own page with a place to write.'],
        ['Updates itself', 'New versions are announced here, and only the files that changed are downloaded.'],
      ],
      better: [
        ['Smoother focus mode', 'Moving between paragraphs is now even, with no jumps.'],
        ['Faster statistics', 'Pages you cannot see no longer keep working in the background.'],
      ],
      fix: [['Reminders', 'Fixed a reminder that kept opening by itself every hour.']],
    },
    files: [['renderer/app.js', 148], ['renderer/styles.css', 62], ['renderer/focus.js', 31], ['renderer/listen.js', 6]],
  };
  let el, page, info, stage = 'come', from = 'library', timers = [];
  const later = (ms, fn) => timers.push(setTimeout(fn, ms));
  const q = (s) => el.querySelector(s);
  const tap = () => typeof Haptic !== 'undefined' && Haptic.align && Haptic.align();
  const kb = () => info.files.reduce((a, f) => a + f[1], 0);

  function build() {
    if (el) el.remove();
    timers.forEach(clearTimeout);
    timers = [];
    const t = tx();
    el = document.createElement('div');
    el.className = 'up-card';
    el.setAttribute('role', 'status');
    el.innerHTML = `
      <button class="up-x" type="button" aria-label="${esc(t.hide)}" title="${esc(t.hide)}"><svg viewBox="0 0 12 12"><path d="M3 3l6 6M9 3 3 9"/></svg></button>
      <div class="up-icon" aria-hidden="true">
        <img src="icon.png" alt="" />
        <span class="up-badge">
          <svg class="up-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M12 5v13M6 12.5 12 18.5l6-6"/></svg>
          <svg class="up-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5 10 17.5 19 7.5"/></svg>
        </span>
      </div>
      <div class="up-txt">
        <div data-s="come"><b>${esc(t.come(info.version))}</b><small class="up-more">${esc(t.more)}</small></div>
        <div data-s="load" class="off"><b>${esc(t.load)}</b><small><span class="up-n"></span> / ${info.files.length} ${esc(t.of)} · <span class="up-kb"></span> KB</small><div class="up-track"><div class="up-fill"></div></div></div>
        <div data-s="done" class="off"><b>${esc(t.done)}</b><small>${esc(t.doneSub)}</small></div>
      </div>
      <div class="up-btns">
        <button class="up-btn" data-b="go" type="button">${esc(t.go)}</button>
        <button class="up-btn off" data-b="re" type="button">${esc(t.re)}</button>
      </div>`;
    document.body.appendChild(el);
    odo(q('.up-n'), 0, 1);
    odo(q('.up-kb'), 0, 3);
    q('[data-b="go"]').onclick = (e) => takeover(e.currentTarget);
    q('[data-b="re"]').onclick = restart;
    // hidden, it stays in the notification centre; a download carries on and comes back when done
    q('.up-x').onclick = () => hide();
    q('.up-txt').onclick = () => stage !== 'load' && openPage();
  }

  // one column of digits per place, rolled with a transform (like the statistics' odometer)
  function odo(box, n, width) {
    const s = String(n).padStart(width, ' ');
    if (box.children.length !== s.length) box.innerHTML = [...s].map(() => '<span>' + [...'0123456789'].map((d) => `<i>${d}</i>`).join('') + '</span>').join('');
    box.classList.add('up-odo');
    [...s].forEach((c, i) => {
      const col = box.children[i];
      col.style.display = c === ' ' ? 'none' : '';
      col.style.transform = `translateY(${-(c === ' ' ? 0 : +c) * 1.35}em)`;
    });
  }
  function text(s) {
    stage = s;
    el.querySelectorAll('.up-txt > div').forEach((d) => d.classList.toggle('off', d.dataset.s !== s));
    pageState();
    if (api.updateBusy) api.updateBusy(s === 'load');
  }

  // the same news is kept in the notification centre (inbox.js), one card per version
  function keep(icon, title) {
    if (typeof Inbox !== 'undefined') Inbox.add({ id: 'update-' + info.version, kind: 'update', icon, v: info.version, title, sub: tx().more });
  }

  function show(i) {
    info = i;
    stage = 'come';
    build();
    keep('update', tx().come(info.version));
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('show')));
    tap();
  }
  const hide = () => el && el.classList.remove('show');

  function download() {
    q('[data-b="go"]').classList.add('off');
    el.classList.add('loading');
    text('load');
    row(0, 'busy');
    // a real update: main.js (update.js) downloads it and reports how far it got
    if (info.real) return void api.updateRun();
    // the sample (--update-demo): the same steps on a timer
    const total = kb();
    let at = 600, got = 0;
    info.files.forEach(([, k], i) => {
      at += 700 + k * 9;
      later(at, () => {
        got += k;
        progress(got / total, i);
      });
    });
    later(at + 700, done);
  }

  // f: how much is in (0–1); i: the file that has just come in, if one has
  function progress(f, i) {
    const n = i == null ? 0 : i + 1;
    odo(q('.up-n'), n, 1);
    odo(q('.up-kb'), Math.round(kb() * f), 3);
    q('.up-fill').style.transform = `scaleX(${f})`;
    pageProgress(f);
    coverTick(i == null ? -1 : i, f);
    if (i != null) (row(i, 'ok'), row(i + 1, 'busy'), tap());
  }
  if (api.onUpdateProgress) api.onUpdateProgress((p) => el && stage === 'load' && progress(p.f, p.f >= 1 ? info.files.length - 1 : null));
  if (api.onUpdateStaged) api.onUpdateStaged(() => el && stage === 'load' && done());
  // the download broke off: the banner offers it again
  if (api.onUpdateFailed) api.onUpdateFailed(() => {
    if (!el || stage !== 'load') return;
    if (cover) (coverT.forEach(clearInterval), cover.remove(), (cover = null));
    if (api.updateBusy) api.updateBusy(false);
    show(info);
  });

  function done() {
    if (cover) return coverDone();
    // the banner comes back unless the page is already showing it all
    if (!(page && page.classList.contains('is-active'))) el.classList.add('show');
    el.classList.remove('loading');
    el.classList.add('done');
    text('done');
    q('[data-b="re"]').classList.remove('off');
    keep('done', tx().done + ' · v' + info.version);
    tap();
  }

  function restart() {
    hide();
    later(500, () => api.updateRestart(info.version));
  }

  /* ---- "What's new" page ---- */
  function ensurePage() {
    if (page) return;
    page = document.createElement('section');
    page.id = 'whatsnew';
    page.className = 'view';
    page.innerHTML = `
      <header class="bar">
        <button class="btn ghost back" id="wn-back"></button>
        <div class="bar-title show" id="wn-title"></div>
        <div></div>
      </header>
      <main class="scroller"><div class="wn" id="wn-body"></div></main>`;
    document.querySelector('#stats').after(page);
    page.querySelector('#wn-back').onclick = () => showView(from);
  }
  const CHECK = '<svg viewBox="0 0 24 24"><path d="M5 12.5 10 17.5 19 7.5"/></svg>';
  function renderPage() {
    if (!page) return;
    const t = tx();
    page.querySelector('#wn-back').innerHTML = window.t('reader.back'); // i18n.js
    page.querySelector('#wn-title').textContent = t.page;
    let k = 3;
    const kk = () => `style="--k:${k++}"`;
    const secs = Object.entries(info.changes || {}).filter(([, list]) => list.length).map(([key, list]) => `
      <section class="wn-sec" ${kk()}><h3>${esc(t.sec[key] || key)}</h3>
        ${list.map(([b, p]) => `<div class="wn-item"><b>${esc(b)}</b><p>${esc(p)}</p></div>`).join('')}
      </section>`).join('');
    page.querySelector('#wn-body').innerHTML = `
      <h1 class="wn-ver" style="--k:0">v${esc(info.version)}</h1>
      <p class="wn-meta" id="wn-meta" style="--k:1"></p>
      <div class="wn-stage" id="wn-stage" style="--k:2"></div>
      ${secs}
      ${info.files.length ? `<section class="wn-sec" ${kk()}><h3>${esc(t.files)}</h3><div class="wn-files">${info.files.map(([n, s], i) => `<div data-i="${i}"><span class="wn-st"><i></i>${CHECK}</span><span class="wn-fn">${esc(n)}</span><span>${s} KB</span></div>`).join('')}</div></section>` : ''}
      ${typeof Changelog !== 'undefined' ? `<button class="wn-all wn-sec" type="button" ${kk()}>${esc(window.t('up.all'))}</button>` : ''}`;
    const all = page.querySelector('.wn-all');
    if (all) all.onclick = () => Changelog.open();
    pageState();
  }

  // the part under the version that follows the update: the button, the progress, the result
  function pageState() {
    if (!page || !page.querySelector('#wn-stage')) return;
    const t = tx();
    const installed = stage === 'done' || stage === 'hi';
    page.querySelector('#wn-meta').textContent = `${info.date ? info.date + ' · ' : ''}${installed ? t.metaDone : t.meta(info.files.length, kb())}`;
    const box = page.querySelector('#wn-stage');
    if (stage === 'come') box.innerHTML = `<button class="wn-act" type="button">${esc(t.go)}</button>`;
    else if (stage === 'load') box.innerHTML = `
      <div class="wn-prog">
        <div class="wn-top"><div class="wn-pct"><span class="wn-odo"></span><small>%</small></div>
          <div class="wn-msg"><b>${esc(t.load)}</b><span>${esc(t.wait)}</span></div></div>
        <div class="wn-bar"><i></i></div>
      </div>`;
    else if (stage === 'done') box.innerHTML = `
      <div class="wn-ok"><span class="wn-tick">${CHECK}</span>
        <div class="wn-msg"><b>${esc(t.done)}</b><span>${esc(t.doneSub)}</span></div>
        <button class="wn-act" type="button">${esc(t.re)}</button></div>`;
    else box.innerHTML = '';
    box.dataset.s = stage;
    const odoEl = box.querySelector('.wn-odo');
    if (odoEl) odo(odoEl, 0, 3);
    const act = box.querySelector('.wn-act');
    if (act) act.onclick = () => {
      if (stage === 'done') return restart();
      takeover(act);
    };
  }
  function pageProgress(f) {
    if (!page) return;
    const o = page.querySelector('.wn-odo');
    if (o) odo(o, Math.round(f * 100), 3);
    const b = page.querySelector('.wn-bar i');
    if (b) b.style.transform = `scaleX(${f})`;
  }
  function row(i, s) {
    const r = page && page.querySelector(`.wn-files [data-i="${i}"]`);
    if (r) (r.classList.remove('busy', 'ok'), r.classList.add(s));
  }

  function openPage(v) {
    // from the notification centre, for a version this run has not announced
    if (v && (!info || info.version !== v)) (info = notesOf(v)), (stage = 'hi');
    ensurePage();
    renderPage();
    const cur = document.querySelector('.view.is-active');
    if (cur && cur.id !== 'whatsnew') from = cur.id;
    showView('whatsnew');
  }

  // the app was asked to close while updating: it stays, and the message says why
  if (api.onUpdateHold) api.onUpdateHold(() => {
    const m = page && page.classList.contains('is-active') && page.querySelector('.wn-prog .wn-msg');
    if (m) (m.classList.remove('nudge'), void m.offsetWidth, m.classList.add('nudge'));
    else if (el) (el.classList.add('show'), el.animate([{ transform: 'translateX(-6px)' }, { transform: 'translateX(5px)' }, { transform: 'none' }], { duration: 420 }));
    tap();
  });

  // first start of the new version: the banner says so once, then slides away
  // what an installed version brought (kept in notes.whatsNew by the first start of it);
  // the sample's notes for the demo
  const notesOf = (v) => {
    const wn = state.notes.whatsNew;
    return wn && wn.v === v && wn.changes ? { version: v, date: wn.date, changes: wn.changes, files: [] } : { ...SAMPLE, version: v };
  };

  function welcome(v) {
    show(notesOf(v));
    el.classList.add('done');
    text('hi');
    const d = q('[data-s="come"]');
    d.classList.remove('off');
    d.querySelector('b').textContent = tx().hi(v);
    keep('done', tx().hi(v));
    q('.up-btns').remove();
    q('.up-txt').style.gridColumn = '2 / 4';
    const seen = () => {
      if (state.notes.whatsNew) (state.notes.whatsNew.seen = true), save();
    };
    q('.up-x').onclick = () => (seen(), hide());
    q('.up-txt').onclick = () => (seen(), hide(), openPage());
  }

  /* ---- the update itself: the whole window goes black from the button that was pressed,
     and Inkwell talks to itself while it works (a turning star and a new word every moment) ---- */
  const WORDS = ['Inking', 'Sharpening quills', 'Typesetting', 'Kerning', 'Blotting', 'Binding pages', 'Proofreading', 'Dog-earing', 'Polishing serifs', 'Footnoting', 'Leafing through', 'Drying the ink', 'Dusting the shelves', 'Annotating', 'Pondering', 'Brewing', 'Turning pages', 'Margin-scribbling'];
  const STAR = ['·', '✢', '✳', '✶', '✻', '✽', '✻', '✶', '✳', '✢'];
  let cover, coverT = [];
  const cv = (s) => cover.querySelector(s);

  function takeover(btn) {
    if (!el) build();
    hide();
    const r = btn ? btn.getBoundingClientRect() : { left: innerWidth / 2, top: innerHeight / 2, width: 0, height: 0 };
    cover = document.createElement('div');
    cover.className = 'uo';
    cover.style.setProperty('--x', r.left + r.width / 2 + 'px');
    cover.style.setProperty('--y', r.top + r.height / 2 + 'px');
    cover.innerHTML = `
      <div class="uo-in">
        <div class="uo-row"><span class="uo-star">✻</span><span class="uo-words"><span class="uo-w">${WORDS[0]}…</span></span><span class="uo-sec">(0s)</span></div>
        <div class="uo-sub"><span class="uo-pct"></span>% · <span class="uo-file">${esc(info.files[0] ? info.files[0][0] : '')}</span></div>
        <div class="uo-bar"><i></i></div>
        <p class="uo-note">Please don't close Inkwell</p>
      </div>
      <div class="uo-ver">Inkwell v${esc(info.version)}</div>`;
    document.body.appendChild(cover);
    odo(cv('.uo-pct'), 0, 3);
    requestAnimationFrame(() => requestAnimationFrame(() => cover.classList.add('on')));
    tap();
    // the star turns, the seconds count, the word changes now and then
    let s = 0, w = 0;
    const t0 = Date.now();
    // slowly, like Claude's: each shape stays a moment and the next one breathes in
    coverT.push(setInterval(() => star(STAR[++s % STAR.length]), 260));
    coverT.push(setInterval(() => (cv('.uo-sec').textContent = `(${Math.round((Date.now() - t0) / 1000)}s)`), 1000));
    coverT.push(setInterval(() => word(WORDS[(w = (w + 1 + Math.floor(Math.random() * 3)) % WORDS.length)] + '…'), 1700));
    later(700, download);
  }
  function star(ch) {
    const el = cv('.uo-star');
    el.textContent = ch;
    el.animate([{ opacity: 0.55, transform: 'scale(0.86)' }, { opacity: 1, transform: 'none' }], { duration: 240, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }
  // the old word melts up through a blur, the new one rises into its place
  function word(text) {
    const box = cv('.uo-words');
    const old = box.querySelector('.uo-w:not(.out)');
    const n = document.createElement('span');
    n.className = 'uo-w in';
    n.textContent = text;
    box.appendChild(n);
    if (old) (old.classList.add('out'), setTimeout(() => old.remove(), 600));
    requestAnimationFrame(() => requestAnimationFrame(() => n.classList.remove('in')));
  }
  function coverTick(i, f) {
    if (!cover) return;
    odo(cv('.uo-pct'), Math.round(f * 100), 3);
    cv('.uo-bar i').style.transform = `scaleX(${f})`;
    const next = info.files[i + 1];
    if (next) cv('.uo-file').textContent = next[0];
  }
  function coverDone() {
    coverT.forEach(clearInterval);
    stage = 'done';
    if (api.updateBusy) api.updateBusy(false);
    keep('done', tx().done + ' · v' + info.version);
    cover.classList.add('done');
    cv('.uo-star').textContent = '✻';
    word('Done. Reopening…');
    cv('.uo-file').textContent = 'all files in place';
    tap();
    later(1800, () => api.updateRestart(info.version));
  }

  return { demo: () => show(SAMPLE), announce: (i) => show({ ...i, real: true }), welcome, openPage };
})();

// ⋯ menu → "Check for updates": asks GitHub now and answers in a toast, or with the banner when
// there is something new; the version installed stands beside it
Object.assign(I18N.uz, {
  'up.check': 'Yangilanishlar', 'up.checking': 'Tekshirilmoqda…', 'up.latest': (v) => `Sizda eng yangi versiya · v${v}`,
  'up.error': "Tekshirib bo'lmadi — internetni tekshiring", 'up.dev': "Bu nusxa o'zi yangilanmaydi (o'zingiz yig'gan nusxa)",
  'up.ready': 'Yangilanish tayyor — ilovani qayta oching', 'up.busy': 'Yangilanmoqda…',
});
Object.assign(I18N.en, {
  'up.check': 'Updates', 'up.checking': 'Checking…', 'up.latest': (v) => `You have the latest version · v${v}`,
  'up.error': "Couldn't check — look at the connection", 'up.dev': "This copy doesn't update itself (a build of your own)",
  'up.ready': 'The update is ready — reopen the app', 'up.busy': 'Updating…',
});
Object.assign(I18N.ru, {
  'up.check': 'Обновления', 'up.checking': 'Проверяю…', 'up.latest': (v) => `У вас последняя версия · v${v}`,
  'up.error': 'Не удалось проверить — проверьте интернет', 'up.dev': 'Эта копия не обновляется сама (собрана вами)',
  'up.ready': 'Обновление готово — перезапустите приложение', 'up.busy': 'Обновляется…',
});
// The ⋯ menu's one Updates row (with the version beside it) opens the update history; the
// history's own button asks GitHub (checkUpdates), so the menu stays short
let checkUpdates = null;
if (typeof api !== 'undefined' && api.updateCheck && document.querySelector('#btn-update')) {
  const btn = document.querySelector('#btn-update');
  if (api.appVersion) api.appVersion().then((v) => (document.querySelector('#app-ver').textContent = v ? 'v' + v : ''));
  let asking = false;
  btn.addEventListener('click', () => {
    closeMenu();
    if (typeof Changelog !== 'undefined') Changelog.open();
    else checkUpdates();
  });
  checkUpdates = async () => {
    if (asking) return;
    asking = true;
    toast(t('up.checking'), 4000);
    const r = await api.updateCheck().catch(() => ({ state: 'error' }));
    asking = false;
    if (r.state === 'found') return (toast(''), document.querySelector('#toast').classList.remove('show'), UpdateUI.announce(r.info));
    toast(r.state === 'latest' ? t('up.latest', r.current) : t('up.' + r.state), 3200);
  };
}

// main.js (update.js) found a newer release on GitHub
if (typeof api !== 'undefined' && api.onUpdateAvailable) api.onUpdateAvailable((i) => setTimeout(() => UpdateUI.announce(i), 2600));

// after the launch card: a sample run (--update-demo), or the greeting of a new version
(async () => {
  if (typeof api === 'undefined' || !api.updateDone) return;
  const [d, demo] = await Promise.all([api.updateDone(), api.updateDemo()]);
  setTimeout(() => {
    // a new version greets once; closed (or opened) it doesn't come back
    if (d && d.v) (state.notes.whatsNew = { v: d.v, date: d.date, changes: d.changes, seen: false }), save();
    const wn = state.notes.whatsNew;
    if (wn && !wn.seen) UpdateUI.welcome(wn.v);
    else if (demo) UpdateUI.demo();
  }, 2600);
})();
