'use strict';

// The app inside the Settings ▸ Shortcuts card (index.html?preview, in an iframe). The iframe gets
// no preload, so window.api is stood in for here: reads go to the real app over postMessage,
// writes go nowhere — whatever happens in the preview never touches the library or the notes.
// Read-aloud gets a pretend voice that reads the focused paragraph out word by word.
const PREVIEW = window !== window.top && location.search.includes('preview');
if (PREVIEW && !window.api) {
  document.documentElement.classList.add('preview');
  document.head.insertAdjacentHTML('beforeend', '<style>html.preview * { -webkit-app-region: no-drag !important; }</style>');
  let n = 0;
  const wait = new Map();
  window.addEventListener('message', (e) => {
    const m = e.data;
    if (!m || m.pv !== 'res' || !wait.has(m.id)) return;
    wait.get(m.id)(m.value);
    wait.delete(m.id);
  });
  const ask = (method, ...args) => new Promise((ok) => {
    const id = ++n;
    wait.set(id, ok);
    window.parent.postMessage({ pv: 'req', id, method, args }, '*');
  });
  const none = async () => null;
  let onRead = () => {};
  let voice = 0;
  // what the Settings page reaches in here (the app's globals are script-scoped, not on window)
  window.pv = {
    up: () => typeof state !== 'undefined' && Array.isArray(state.list),
    get state() { return state; },
    pct: () => Math.round(((state.notes.settings.fontSize || FONT_BASE) / FONT_BASE) * 100),
    open: (id) => openArticle(id),
    setPct: (n) => setFontPct(n),
    toast: (m) => toast(m),
    dropNote: () => Focus.isOn() && deleteNote(+Focus.paras()[Focus.at()].dataset.p),
  };
  window.api = {
    list: () => ask('list'),
    article: (id) => ask('article', id),
    loadNotes: () => ask('loadNotes'),
    libDir: () => ask('libDir'),
    inboxPath: () => ask('inboxPath'),
    saveNotes: none, copy: none, openPdf: none, pick: none, importFiles: async () => [], scanInbox: none, openInbox: none,
    readClipboard: async () => '', remindTarget: none, remindSync: none, remindTest: none, remindSettings: none,
    widgetNow: none, fullscreen: none,
    onImportProgress() {}, onRemindOpen() {}, onLibraryChanged() {},
    listenFeed: async () => ({ ok: true, items: [] }), listenResolve: none, addons: async () => [], appVersion: async () => '', updateCheck: async () => ({ state: 'dev' }),
    onRead: (fn) => void (onRead = fn),
    readStart: async () => {
      clearInterval(voice);
      let k = 0;
      setTimeout(() => {
        const p = Focus.paras()[Focus.at()];
        const words = (p ? p.textContent : '').split(/\s+/).filter(Boolean);
        voice = setInterval(() => {
          k++;
          onRead({ t: 'level', v: 0.3 + Math.random() * 0.5 });
          onRead({ t: 'text', seg: 0, text: words.slice(0, k).join(' ') });
          if (k >= words.length) clearInterval(voice);
        }, 230);
      }, 300);
      return { ok: true };
    },
    readStop: async () => clearInterval(voice),
    platform: new URLSearchParams(location.search).get('os') || 'darwin',
  };
}
