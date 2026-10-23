'use strict';
// The browser stand-in for the desktop app's `api` bridge (src/preload.js), so the app in
// src/renderer runs unchanged on the web. Everything lives in this browser's IndexedDB
// ("articles365": the article texts, and the notes under the key "notes"). The articles shipped
// with the site come from data.json; PDFs added here are read in the browser (extract.js, built
// from src/extract.mjs) and kept beside them. Listening's YouTube feeds come through /api/listen.
// Things only a desktop can do (reminders, the widget, trackpad taps, updates) are left out:
// the app hides what it isn't given.
(() => {
  // the Settings ▸ Shortcuts demo is the app in an iframe: preview-api.js stands in there
  if (window !== window.top && location.search.includes('preview')) return;
  document.documentElement.classList.add('web');

  /* ---------------- storage ---------------- */

  let dbp = null;
  const db = () =>
    (dbp ||= new Promise((ok, fail) => {
      const r = indexedDB.open('articles365', 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains('articles')) d.createObjectStore('articles', { keyPath: 'id' });
        if (!d.objectStoreNames.contains('notes')) d.createObjectStore('notes', { keyPath: 'key' });
      };
      r.onsuccess = () => ok(r.result);
      r.onerror = () => fail(r.error);
    }));
  const req = (r) => new Promise((ok, fail) => ((r.onsuccess = () => ok(r.result)), (r.onerror = () => fail(r.error))));
  const get = async (store, key) => req((await db()).transaction(store).objectStore(store).get(key));
  const put = async (store, obj) => req((await db()).transaction(store, 'readwrite').objectStore(store).put(obj));
  const val = async (key, fallback) => {
    const r = await get('notes', key).catch(() => null);
    return r && r.value !== undefined ? r.value : fallback;
  };

  /* ---------------- the library ---------------- */

  let notes = null; // the object the app holds: articles re-read in a new edition move their marks on it
  // the shipped articles' titles and lengths come inside the page (the build puts them there), so
  // the library shows at once; their texts (data.json) are only fetched when one is missing or was
  // rebuilt (its rev changed), and then highlights, words and notes move onto the new text
  const LIB = window.__INKWELL_LIB || null;
  let all = null;
  let synced = null;
  const metaOf = (a) => ({ id: a.id, title: a.title, file: a.file, excerpt: a.excerpt, words: a.words, pages: a.pages, addedAt: a.addedAt, rev: a.rev || 1 });

  const sync = () =>
    (synced ||= (async () => {
      const revs = await val('revs', null);
      if (LIB && revs && LIB.every((m) => revs[m.id] === m.rev)) return LIB;
      let data = [];
      try {
        const r = await fetch('data.json');
        if (r.ok) data = await r.json();
      } catch {}
      let moved = false;
      const now = {};
      await Promise.all(data.map(async (a) => {
        const rev = a.rev || 1;
        now[a.id] = rev;
        if (revs && revs[a.id] === rev) return;
        const had = await get('articles', a.id).catch(() => null);
        if (had && (had.rev || 1) === rev) return;
        const rec = notes && notes.articles && notes.articles[a.id];
        if (had && rec && typeof migrateRecord === 'function') (migrateRecord(rec, had.blocks, a.blocks), (moved = true));
        await put('articles', { id: a.id, rev, blocks: a.blocks, title: a.title, numPages: a.pages, words: a.words });
      }));
      if (moved) await put('notes', { key: 'notes', value: notes });
      if (data.length) await put('notes', { key: 'revs', value: now });
      else synced = null; // offline on a first visit: try again next time
      return LIB || data.map(metaOf);
    })());
  const shipped = async () => LIB || (all ||= await sync());
  const added = () => val('lib', []);

  /* ---------------- adding PDFs ---------------- */

  const progress = [];
  const emitProgress = (p) => progress.forEach((fn) => fn(p));
  let extractor = null;
  let chain = Promise.resolve();

  const sha1 = async (buf) => [...new Uint8Array(await crypto.subtle.digest('SHA-1', buf))].map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
  const cleanName = (n) => n.replace(/\.[^.]+$/, '').replace(/_+/g, ' ').replace(/\s+/g, ' ').trim();

  async function doImport(files) {
    files = [...files].filter((f) => /\.pdf$/i.test(f.name) || f.type === 'application/pdf');
    if (!files.length) return { added: 0, failed: 0 };
    if (!extractor) extractor = await import('./extract.js');
    const lib = await added();
    const known = new Set([...(await shipped()), ...lib].map((a) => a.id));
    let n = 0;
    let failed = 0;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      try {
        const buf = await f.arrayBuffer();
        const id = await sha1(buf);
        if (known.has(id)) continue;
        emitProgress({ done: i, total: files.length, name: f.name });
        // no OCR in a browser: a scanned PDF without a text layer has nothing to read
        const r = await extractor.extractPdf(buf.slice(0), { ocr: false });
        if (!r.blocks.length) throw new Error('no text');
        await put('articles', { id, rev: 1, blocks: r.blocks, title: r.title, numPages: r.numPages, words: r.words, pdf: new Blob([buf], { type: 'application/pdf' }) });
        const first = r.blocks.find((b) => b.type === 'p' && b.text.length > 80) || r.blocks.find((b) => b.type === 'p');
        lib.push({ id, title: r.title || cleanName(f.name), file: f.name, size: f.size, excerpt: first ? first.text.slice(0, 220) : '', words: r.words, pages: r.numPages, addedAt: Date.now() });
        await put('notes', { key: 'lib', value: lib });
        known.add(id);
        n++;
        emitProgress({ done: i + 1, total: files.length, name: f.name, added: true });
      } catch (e) {
        failed++;
        console.error('import failed', f.name, e);
      }
    }
    emitProgress({ done: files.length, total: files.length });
    return { added: n, failed, total: known.size };
  }
  const importFiles = (files) => {
    const run = chain.then(() => doImport(files));
    chain = run.catch(() => {});
    return run;
  };

  // "+ Add PDF": the browser's own file picker
  const pick = () =>
    new Promise((ok) => {
      const input = Object.assign(document.createElement('input'), { type: 'file', accept: 'application/pdf,.pdf', multiple: true });
      input.addEventListener('change', () => ok(input.files.length ? importFiles(input.files) : null), { once: true });
      input.addEventListener('cancel', () => ok(null), { once: true });
      input.click();
    });

  /* ---------------- reading aloud (Web Speech, where the browser has it) ---------------- */

  const readers = [];
  const emit = (m) => readers.forEach((fn) => fn(m));
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SR) document.documentElement.classList.add('speech');
  let rec = null;
  let want = false;
  let seg = 0;
  let quick = []; // sessions that ended almost at once: too many in a row means it can't work

  function session(locale) {
    const r = new SR();
    r.lang = locale;
    r.continuous = true;
    r.interimResults = true;
    r.maxAlternatives = 1;
    const mine = ++seg;
    const began = Date.now();
    r.onresult = (e) => {
      let text = '';
      for (let i = 0; i < e.results.length; i++) text += e.results[i][0].transcript + ' ';
      emit({ t: 'text', seg: mine, text: text.trim() });
    };
    r.onerror = (e) => {
      if (e.error === 'no-speech' || e.error === 'aborted') return;
      want = false;
      const code = { 'not-allowed': 'mic', 'service-not-allowed': 'mic', 'audio-capture': 'mic' }[e.error] || e.error;
      emit({ t: 'error', code, msg: e.error });
    };
    // browsers end a session after a pause or a minute: the next one starts straight away
    r.onend = () => {
      if (rec !== r) return;
      if (!want) return (rec = null), emit({ t: 'end' });
      const now = Date.now();
      quick = now - began < 1200 ? quick.concat(now).filter((x) => now - x < 8000) : [];
      if (quick.length >= 5) return (want = false), (rec = null), emit({ t: 'error', code: 'recognizer', msg: 'stopped' });
      rec = session(locale);
    };
    r.start();
    return r;
  }

  /* ---------------- the bridge ---------------- */

  const none = async () => null;
  const isMac = /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent);

  window.api = {
    async loadNotes() {
      notes = await val('notes', null) || { articles: {}, settings: {} };
      return notes;
    },
    saveNotes: (data) => put('notes', { key: 'notes', value: data }),
    async list() {
      if (LIB) sync(); // texts come in behind the list
      const [a, b] = await Promise.all([shipped(), added()]);
      return a.concat(b);
    },
    async article(id) {
      if (LIB && LIB.some((m) => m.id === id)) await sync();
      const r = await get('articles', String(id)).catch(() => null);
      return r ? { title: r.title, blocks: r.blocks, numPages: r.numPages || 0, words: r.words } : null;
    },
    async openPdf(id) {
      const r = await get('articles', String(id)).catch(() => null);
      if (r && r.pdf) window.open(URL.createObjectURL(r.pdf), '_blank');
    },
    pick,
    importFiles,
    onImportProgress: (fn) => void progress.push(fn),
    scanInbox: async () => ({ added: 0, failed: 0 }),
    inboxPath: async () => '',
    openInbox: none,
    copy: async (text) => {
      try {
        await navigator.clipboard.writeText(String(text));
      } catch {
        const ta = Object.assign(document.createElement('textarea'), { value: String(text) });
        document.body.append(ta);
        ta.select();
        document.execCommand('copy');
        ta.remove();
      }
    },
    readClipboard: async () => {
      try {
        return await navigator.clipboard.readText();
      } catch {
        return '';
      }
    },
    readStart: async ({ locale } = {}) => {
      if (!SR) return { ok: false, code: 'platform' };
      want = true;
      quick = [];
      try {
        rec = session(locale || 'en-US');
      } catch {
        want = false;
        return { ok: false, code: 'platform' };
      }
      return { ok: true };
    },
    readStop: async () => {
      want = false;
      const r = rec;
      rec = null;
      try {
        r && r.abort();
      } catch {}
    },
    onRead: (fn) => void readers.push(fn),
    remindTarget: none,
    onRemindOpen() {},
    onLibraryChanged() {},
    addons: async () => [],
    listenFeed: async (kind, id) => {
      try {
        const r = await fetch(`/api/listen?kind=${encodeURIComponent(kind)}&id=${encodeURIComponent(id)}`);
        return await r.json();
      } catch (e) {
        return { ok: false, err: e.message };
      }
    },
    listenResolve: async (url) => {
      try {
        const r = await fetch(`/api/listen?resolve=${encodeURIComponent(url)}`);
        return r.ok ? await r.json() : null;
      } catch {
        return null;
      }
    },
    async fullscreen(on) {
      const el = document.documentElement;
      if (!el.requestFullscreen || !!document.fullscreenElement === !!on) return false;
      try {
        await (on ? el.requestFullscreen() : document.exitFullscreen());
        return true;
      } catch {
        return false;
      }
    },
    // ⌘ on a Mac (and iPad), Ctrl elsewhere, as the shortcut labels go
    platform: isMac ? 'darwin' : 'web',
  };

  // offline: the site and its articles stay on the device after the first visit
  if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
