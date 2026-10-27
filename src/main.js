const { app, session, BrowserWindow, ipcMain, dialog, clipboard, shell, nativeTheme, systemPreferences, nativeImage } = require('electron');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const remind = require('./notify');
const update = require('./update');
const listen = require('./listen');
const guardian = require('./guardian');

// started by the reminder agent: no window, no Dock icon unless the notification is clicked
const REMIND_RUN = process.argv.includes('--remind');
// Windows shows notifications under the installed shortcut's id (electron-builder sets it to appId)
if (process.platform === 'win32') app.setAppUserModelId('uz.javohir.articles365');
// The data folder (notes, articles, caches) carries the app's name. It was "365 Articles Reader":
// on the first start it is renamed, not copied, and a link with the old name is left behind, so
// an older build opened later still finds everything. When both folders hold data, or the rename
// fails (a file held open on Windows), nothing is touched and the old folder stays in use.
app.setPath('userData', (() => {
  const now = path.join(app.getPath('appData'), 'Inkwell');
  const before = path.join(app.getPath('appData'), '365 Articles Reader');
  try {
    const old = fs.lstatSync(before, { throwIfNoEntry: false });
    if (!old || !old.isDirectory()) return now;
    if (fs.existsSync(now)) {
      if (fs.readdirSync(now).length) return before;
      fs.rmdirSync(now);
    }
    fs.renameSync(before, now);
    try {
      fs.symlinkSync(now, before, 'junction');
    } catch {}
    return now;
  } catch (e) {
    console.error('data folder', e.message);
    return fs.existsSync(before) ? before : now;
  }
})());
app.setName('Inkwell');
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

const DATA = () => app.getPath('userData');
const LIB = () => path.join(DATA(), 'library');
const INDEX = () => path.join(DATA(), 'index.json');
const NOTES = () => path.join(DATA(), 'notes.json');
// Folder scanned on every start: PDFs dropped here are imported.
const INBOX = () => {
  const now = path.join(app.getPath('documents'), 'Inkwell');
  // the folder the app used before it was renamed is still read, when it is the one there
  const before = path.join(app.getPath('documents'), '365 Articles');
  return !fs.existsSync(now) && fs.existsSync(before) ? before : now;
};

let win;
let extractor;

async function readJson(file, fallback) {
  try {
    return JSON.parse(await fsp.readFile(file, 'utf8'));
  } catch {
    return fallback;
  }
}

// Write to a temp file then rename, so a crash never leaves half a file.
const writeQueue = new Map();
function writeJson(file, value) {
  const prev = writeQueue.get(file) || Promise.resolve();
  const next = prev.then(async () => {
    const tmp = file + '.tmp';
    await fsp.writeFile(tmp, JSON.stringify(value));
    await fsp.rename(tmp, file);
  });
  writeQueue.set(file, next.catch(() => {}));
  return next;
}

async function walkPdfs(dir, out = []) {
  let entries = [];
  try {
    entries = await fsp.readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkPdfs(p, out);
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

function cleanName(file) {
  return path
    .basename(file, path.extname(file))
    .replace(/[_]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Imports run one at a time; a second request waits for the first.
let importChain = Promise.resolve();
function importFiles(files) {
  const run = importChain.then(() => doImport(files));
  importChain = run.catch(() => {});
  return run;
}

async function doImport(files) {
  if (!extractor) extractor = await import('./extract.mjs');
  await fsp.mkdir(LIB(), { recursive: true });
  const index = await readJson(INDEX(), []);
  const known = new Set(index.map((a) => a.id));
  const knownFiles = new Map(index.map((a) => [a.src, a.size]));
  const send = (p) => win && !win.isDestroyed() && win.webContents.send('import:progress', p);
  let added = 0;
  let failed = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const name = path.basename(file);
    try {
      const st = await fsp.stat(file);
      if (knownFiles.get(file) === st.size) continue; // already imported, skip hashing
      const buf = await fsp.readFile(file);
      // Same PDF => same id, so re-importing never duplicates or loses notes.
      const id = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
      if (known.has(id)) continue;
      send({ done: i, total: files.length, name });
      const result = await extractor.extractPdf(buf, {
        path: file,
        cachePath: path.join(DATA(), 'ocr-cache'),
        onPage: (n, total) => send({ done: i, total: files.length, name, ocr: `${n}/${total}` }),
      });
      await fsp.writeFile(path.join(LIB(), id + '.pdf'), buf);
      await writeJson(path.join(LIB(), id + '.json'), result);
      const first = result.blocks.find((b) => b.type === 'p' && b.text.length > 80) || result.blocks.find((b) => b.type === 'p');
      index.push({
        id,
        title: result.title || cleanName(file),
        file: name,
        src: file,
        size: st.size,
        excerpt: first ? first.text.slice(0, 220) : '',
        words: result.words,
        pages: result.numPages,
        ocrPages: result.ocrPages,
        addedAt: Date.now(),
      });
      known.add(id);
      added++;
      await writeJson(INDEX(), index);
      send({ done: i + 1, total: files.length, name, added: true });
    } catch (err) {
      failed++;
      console.error('import failed', file, err);
    }
  }
  await extractor.stopOcr();
  if (files.length) send({ done: files.length, total: files.length });
  return { added, failed, total: index.length };
}

// A page loaded from file:// sends no Referer, and YouTube refuses to play an embed without
// one (error 153); the music player's requests get the app's own name instead.
function allowYouTubeEmbeds() {
  const urls = ['https://www.youtube-nocookie.com/*', 'https://www.youtube.com/*'];
  session.defaultSession.webRequest.onBeforeSendHeaders({ urls }, (d, done) => {
    if (!d.requestHeaders.Referer) d.requestHeaders.Referer = 'https://365articles.app/';
    done({ requestHeaders: d.requestHeaders });
  });
}

// Once a day, on start, notes.json (highlights, words, notes, listening, statistics) is copied to
// backups/notes-YYYY-MM-DD.json beside it; the last 7 days are kept. Nothing written is ever
// only in one file.
function backupNotes() {
  try {
    if (!fs.existsSync(NOTES())) return;
    const dir = path.join(DATA(), 'backups');
    fs.mkdirSync(dir, { recursive: true });
    const d = new Date();
    const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const to = path.join(dir, `notes-${day}.json`);
    if (!fs.existsSync(to)) fs.copyFileSync(NOTES(), to);
    const old = fs.readdirSync(dir).filter((f) => /^notes-\d{4}-\d\d-\d\d\.json$/.test(f)).sort().slice(0, -7);
    for (const f of old) fs.rmSync(path.join(dir, f), { force: true });
  } catch (e) {
    console.error('backup', e.message);
  }
}

// the window opens in the theme the app was left in (the launch card is drawn in it too)
function savedDark() {
  try {
    const th = JSON.parse(fs.readFileSync(NOTES(), 'utf8')).settings.theme;
    if (th === 'dark' || th === 'light') return th === 'dark';
  } catch {}
  return nativeTheme.shouldUseDarkColors;
}

function createWindow() {
  allowYouTubeEmbeds();
  win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 760,
    minHeight: 520,
    backgroundColor: savedDark() ? '#0d0d0d' : '#ffffff',
    title: 'Inkwell',
    titleBarStyle: process.platform === 'darwin' ? 'hiddenInset' : 'default',
    trafficLightPosition: { x: 18, y: 18 },
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  win.loadFile(path.join(__dirname, 'renderer', 'index.html'));
  win.once('ready-to-show', () => win.show());
  // not while an update is being written (update.js); the window says why
  win.on('close', (e) => update.hold(e));
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

// a notification was clicked: bring the app up at the place it talked about
let pendingOpen = null;
function openFrom(target) {
  if (app.dock) app.dock.show();
  if (win && !win.isDestroyed()) {
    if (win.isMinimized()) win.restore();
    win.show();
    win.focus();
    if (target) win.webContents.send('remind:open', target);
  } else {
    pendingOpen = target;
    createWindow();
  }
  app.focus({ steal: true });
}
// a tap on a widget: articles365://article/<id>, ://cards, ://focus or ://open
function fromUrl(url) {
  const m = /^articles365:\/\/([a-z]+)\/?([\w-]*)/i.exec(String(url || ''));
  if (!m) return null;
  if (m[1] === 'article' && m[2]) return { view: 'article', id: m[2] };
  if (m[1] === 'cards' || m[1] === 'focus') return { view: m[1] };
  return null;
}
app.on('will-finish-launching', () => {
  app.on('open-url', (e, url) => {
    e.preventDefault();
    const t = fromUrl(url);
    if (app.isReady()) openFrom(t);
    else pendingOpen = t;
  });
});
app.on('second-instance', (_e, argv) => {
  if (argv.includes('--remind')) remind.fire(openFrom).catch((e) => console.error('remind', e));
  else openFrom(null);
});
ipcMain.handle('remind:target', async () => {
  const t = pendingOpen || (await remind.takeOpen());
  pendingOpen = null;
  return t;
});
ipcMain.handle('remind:settings', () => shell.openExternal(process.platform === 'win32' ? 'ms-settings:notifications' : 'x-apple.systempreferences:com.apple.Notifications-Settings.extension'));
ipcMain.handle('remind:sync', async (_e, notes) => ({ times: await remind.schedule(notes), usual: remind.usualHour(notes || {}) }));
ipcMain.handle('remind:test', () => remind.test(openFrom));

// The library rows show a picture 112 px wide, but a saved article's picture is ~1500 px: decoding
// and scaling dozens of those while the list scrolls or switches shelves stalled the frames. Each
// gets a small copy beside it (<id>.t.jpg, 336 px: three times the row), made once, in the
// background; a row uses it as soon as it exists (m.thumb), the article page keeps the big one.
const thumbing = new Set();
function thumbs(list) {
  const todo = list.filter((m) => m.img && !/^https?:/.test(m.img) && !thumbing.has(m.img));
  (async () => {
    for (const m of todo) {
      const src = path.join(LIB(), m.img);
      const dst = src.replace(/\.[a-z]+$/i, '') + '.t.jpg';
      if (fs.existsSync(dst)) continue;
      thumbing.add(m.img);
      try {
        const im = nativeImage.createFromPath(src);
        if (!im.isEmpty()) await fsp.writeFile(dst, im.resize({ width: Math.min(336, im.getSize().width), quality: 'best' }).toJPEG(82));
      } catch {}
      await new Promise((ok) => setTimeout(ok, 15)); // a little at a time: the window stays smooth
    }
  })();
  for (const m of list) {
    if (!m.img || /^https?:/.test(m.img)) continue;
    const t = m.img.replace(/\.[a-z]+$/i, '') + '.t.jpg';
    if (fs.existsSync(path.join(LIB(), t))) m.thumb = t;
  }
  return list;
}
ipcMain.handle('library:list', async () => thumbs(await readJson(INDEX(), [])));

// Settings → Storage: how much of the disk Inkwell takes, by part. Sizes are what the files hold
// (as Finder counts them); links are not followed. Kept for a minute, since walking the app takes a moment.
async function sizeOf(p) {
  let st;
  try {
    st = await fsp.lstat(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.size;
  let names = [];
  try {
    names = await fsp.readdir(p);
  } catch {}
  let sum = 0;
  for (let i = 0; i < names.length; i += 64) sum += (await Promise.all(names.slice(i, i + 64).map((n) => sizeOf(path.join(p, n))))).reduce((a, b) => a + b, 0);
  return sum;
}
const NOTES_FILES = ['notes.json', 'index.json', 'remind.json', 'backups'];
let usage = null;
// Settings → Storage, one action per part. 'cache': Chromium's page and code caches only (notes,
// articles, settings and the pages' own localStorage stay). 'update': a downloaded update's
// folder, only while nothing is being downloaded or waiting to be installed from it.
ipcMain.handle('storage:clear', async (_e, part = 'cache') => {
  if (part === 'update') {
    if (update.pending() || update.working()) return false;
    await fsp.rm(path.join(DATA(), 'update'), { recursive: true, force: true });
  } else {
    const s = session.defaultSession;
    await s.clearCache();
    await s.clearCodeCaches({});
    await s.clearStorageData({ storages: ['shadercache', 'cachestorage'] });
  }
  usage = null;
  return true;
});
// …and 'library' shows the articles' folder, anything else the data folder, in Finder/Explorer
ipcMain.handle('storage:show', (_e, part) => shell.openPath(part === 'library' ? LIB() : DATA()));
ipcMain.handle('storage:usage', async () => {
  if (usage && Date.now() - usage.at < 60000) return usage.v;
  // the app itself: the .app bundle on a Mac, the install folder elsewhere
  const bundle = process.platform === 'darwin' ? path.resolve(process.execPath, '../../..') : path.dirname(process.execPath);
  const names = await fsp.readdir(DATA()).catch(() => []);
  const [app_, library, notes, updateBytes, all] = await Promise.all([
    app.isPackaged ? sizeOf(bundle) : 0,
    sizeOf(LIB()),
    Promise.all(NOTES_FILES.map((n) => sizeOf(path.join(DATA(), n)))).then((l) => l.reduce((a, b) => a + b, 0)),
    sizeOf(path.join(DATA(), 'update')),
    Promise.all(names.map((n) => sizeOf(path.join(DATA(), n)))).then((l) => l.reduce((a, b) => a + b, 0)),
  ]);
  let disk = null;
  try {
    const f = await fsp.statfs(DATA());
    disk = { total: f.blocks * f.bsize, free: f.bavail * f.bsize };
  } catch {}
  // everything else in the data folder is Chromium's caches and the page's own storage
  const v = { parts: { app: app_, library, notes, cache: Math.max(0, all - library - notes - updateBytes), update: updateBytes }, disk, pending: update.pending() || null };
  usage = { at: Date.now(), v };
  return v;
});
ipcMain.handle('library:article', async (_e, id) => {
  const file = path.join(LIB(), String(id).replace(/\W/g, '') + '.json');
  const index = await readJson(INDEX(), []);
  const m = index.find((a) => a.id === id);
  if (!m || !m.op) return readJson(file, null);
  // a Guardian article: its text is a day old at most, else it comes again (guardian.js)
  const have = await readJson(file, null);
  if (have && !guardian.stale(have.fetchedAt)) return have;
  return refetchGuardian(m, index).catch((e) => ({ err: e.message }));
});

/* ---------------- The Guardian (guardian.js, renderer/guardian.js) ---------------- */

const guardianKey = async () => ((await readJson(NOTES(), {})).settings || {}).guardianKey || '';
// the text as a fingerprint, to know if it changed between two fetches (the text itself is not kept)
const textPrint = (blocks) => crypto.createHash('sha1').update(blocks.map((b) => b.type + b.text).join('\n')).digest('hex').slice(0, 16);
let guardianChain = Promise.resolve();
const oneAtATime = (fn) => {
  const run = guardianChain.then(fn);
  guardianChain = run.catch(() => {});
  return run;
};

async function refetchGuardian(m, index) {
  const a = await guardian.article(await guardianKey(), m.url);
  const data = { title: a.title, blocks: a.blocks, numPages: 0, words: a.words, fetchedAt: a.fetchedAt };
  await writeJson(path.join(LIB(), m.id + '.json'), data);
  const print = textPrint(a.blocks);
  // the article was edited since: the reader moves highlights and notes onto the new text
  const moved = m.print && m.print !== print ? m.count || 0 : null;
  await oneAtATime(async () => {
    const now = await readJson(INDEX(), index);
    const e = now.find((x) => x.id === m.id);
    if (e) Object.assign(e, { print, count: a.blocks.length, fetchedAt: a.fetchedAt, words: a.words, img: a.img || e.img || null });
    await writeJson(INDEX(), now);
  });
  return moved === null ? data : { ...data, moved };
}

// texts older than a day are deleted (on start, and every hour while the app runs)
async function dropOldGuardian() {
  const index = await readJson(INDEX(), []);
  for (const m of index.filter((a) => a.op && guardian.stale(a.fetchedAt))) await fsp.rm(path.join(LIB(), m.id + '.json'), { force: true });
}

ipcMain.handle('guardian:test', (_e, k) => guardian.test(k));
ipcMain.handle('guardian:feed', async (_e, section) => {
  try {
    const [items, index] = await Promise.all([guardian.feed(await guardianKey(), section), readJson(INDEX(), [])]);
    const have = new Map(index.filter((a) => a.url).map((a) => [a.url, a.id]));
    return { ok: true, items: items.map((it) => ({ ...it, id: have.get(it.url) || null })) };
  } catch (e) {
    return { ok: false, err: e.message };
  }
});
ipcMain.handle('guardian:add', (_e, url) =>
  oneAtATime(async () => {
    url = String(url).split(/[?#]/)[0];
    const id = crypto.createHash('sha1').update(url).digest('hex').slice(0, 16);
    const index = await readJson(INDEX(), []);
    const had = index.find((a) => a.id === id);
    if (had) return { ok: true, id, meta: had };
    const a = await guardian.article(await guardianKey(), url);
    await fsp.mkdir(LIB(), { recursive: true });
    await writeJson(path.join(LIB(), id + '.json'), { title: a.title, blocks: a.blocks, numPages: 0, words: a.words, fetchedAt: a.fetchedAt });
    const meta = { id, kind: 'guardian', op: true, title: a.title, file: 'The Guardian', url: a.url, by: a.by, date: a.date, section: a.section, excerpt: a.excerpt, words: a.words, pages: 0, img: a.img, caption: a.caption, print: textPrint(a.blocks), count: a.blocks.length, fetchedAt: a.fetchedAt, addedAt: Date.now() };
    index.push(meta);
    await writeJson(INDEX(), index);
    return { ok: true, id, meta };
  }).catch((e) => ({ ok: false, err: e.message })),
);
ipcMain.handle('library:openPdf', async (_e, id) => {
  // an article saved from the web has no PDF: its own page opens instead
  const m = (await readJson(INDEX(), [])).find((a) => a.id === id);
  if (m && m.url) return shell.openExternal(m.url);
  return shell.openPath(path.join(LIB(), String(id).replace(/\W/g, '') + '.pdf'));
});

ipcMain.handle('library:dir', () => LIB());
// Listening (listen.js): a show's newest episodes, and a pasted YouTube link made into a show
ipcMain.handle('listen:feed', (_e, kind, id) => listen.feed(kind, id).then((items) => ({ ok: true, items }), (e) => ({ ok: false, err: e.message })));
ipcMain.handle('listen:resolve', (_e, url) => listen.resolve(url).catch(() => null));

// Add-ons kept beside the app and out of the repository: src/private/<name>-main.js for this
// process, src/renderer/private/<name>.js (and .css) for the window, which loads the ones listed.
const inPrivate = (dir, end) => {
  try {
    return fs.readdirSync(path.join(__dirname, ...dir)).filter((f) => f.endsWith(end)).map((f) => f.slice(0, -end.length));
  } catch {
    return [];
  }
};
ipcMain.handle('addons:list', () => inPrivate(['renderer', 'private'], '.js'));
for (const n of inPrivate(['private'], '-main.js')) {
  try {
    require(path.join(__dirname, 'private', n + '-main.js'))({ app, ipcMain, shell, crypto, fsp, path, readJson, writeJson, INDEX, NOTES, LIB, win: () => win });
  } catch (e) {
    console.error('add-on', n, e.message);
  }
}
ipcMain.handle('library:pick', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'PDF maqolalarni tanlang',
    defaultPath: app.getPath('documents'),
    // Windows (and Linux) can't pick files and folders in one dialog: asked for both, they show a
    // folder picker only, so PDFs couldn't be chosen at all. There it picks files (from any
    // folder); a whole folder can still be dragged onto the window.
    properties: process.platform === 'darwin' ? ['openFile', 'openDirectory', 'multiSelections'] : ['openFile', 'multiSelections'],
    filters: [{ name: 'PDF', extensions: ['pdf'] }],
  });
  if (r.canceled) return null;
  const files = [];
  for (const p of r.filePaths) {
    const st = await fsp.stat(p);
    if (st.isDirectory()) await walkPdfs(p, files);
    else files.push(p);
  }
  return importFiles(files);
});
ipcMain.handle('library:importPaths', async (_e, paths) => {
  const files = [];
  for (const p of paths || []) {
    try {
      const st = await fsp.stat(p);
      if (st.isDirectory()) await walkPdfs(p, files);
      else if (/\.pdf$/i.test(p)) files.push(p);
    } catch {}
  }
  return importFiles(files);
});
ipcMain.handle('library:scanInbox', async () => {
  await fsp.mkdir(INBOX(), { recursive: true });
  return importFiles(await walkPdfs(INBOX()));
});
ipcMain.handle('library:inboxPath', () => INBOX());
ipcMain.handle('library:openInbox', async () => {
  await fsp.mkdir(INBOX(), { recursive: true });
  return shell.openPath(INBOX());
});
ipcMain.handle('notes:load', () => readJson(NOTES(), { articles: {}, settings: {} }));
// the widget follows the notes a couple of seconds behind (the reading clock saves every 5 s;
// notify.js decides what is worth a redraw)
let widgetT = 0;
let widgetNotes = null;
ipcMain.handle('notes:save', (_e, data) => {
  widgetNotes = data;
  // a widget that can't be written must never take the app down (a throw or a non-promise included)
  if (!widgetT) widgetT = setTimeout(() => ((widgetT = 0), Promise.resolve().then(() => remind.widget(widgetNotes)).catch(() => {})), 2000);
  return writeJson(NOTES(), data);
});
// a focus session started or ended: the widget's countdown can't wait for the 20 s above
ipcMain.handle('widget:now', (_e, data) => {
  clearTimeout(widgetT);
  widgetT = 0;
  return remind.widget(data || widgetNotes).catch(() => {});
});
ipcMain.handle('win:fullscreen', (_e, on) => {
  if (!win || win.isDestroyed() || win.isFullScreen() === !!on) return false;
  return new Promise((done) => {
    const t = setTimeout(() => done(true), 1500);
    win.once(on ? 'enter-full-screen' : 'leave-full-screen', () => (clearTimeout(t), setTimeout(() => done(true), 120)));
    win.setFullScreen(!!on);
  });
});
// trackpad taps (tools/haptic.swift as a Node addon); felt only while a finger is on the trackpad
let haptic;
ipcMain.on('haptic', (_e, k) => {
  if (haptic === undefined) {
    try {
      haptic = process.platform === 'darwin' ? require(path.join(__dirname, 'bin', 'haptic.node')) : null;
    } catch (e) {
      console.error('haptic', e.message);
      haptic = null;
    }
  }
  if (haptic) haptic.tap(k | 0);
});
ipcMain.handle('clipboard:write', (_e, text) => clipboard.writeText(String(text)));
// The vocabulary as a PDF (renderer/vocab-pdf.js makes the page): printed in a hidden window,
// saved to Downloads under a name that doesn't overwrite an earlier one, and opened.
ipcMain.handle('vocab:pdf', async (_e, { html, name } = {}) => {
  const w = new BrowserWindow({ show: false, width: 900, height: 1200, webPreferences: { javascript: false, offscreen: true } });
  try {
    await w.loadURL('data:text/html;charset=utf-8;base64,' + Buffer.from(String(html)).toString('base64'));
    const foot = '<div style="width:100%;font:8px -apple-system,Helvetica,sans-serif;color:#9a9a96;padding:0 18mm;display:flex;justify-content:space-between"><span>Inkwell</span><span><span class="pageNumber"></span> / <span class="totalPages"></span></span></div>';
    const pdf = await w.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.7, bottom: 0.7, left: 0, right: 0 }, displayHeaderFooter: true, headerTemplate: '<span></span>', footerTemplate: foot });
    const base = String(name || 'Inkwell Vocabulary').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 120);
    const dir = app.getPath('downloads');
    let file = path.join(dir, base + '.pdf');
    for (let i = 2; fs.existsSync(file); i++) file = path.join(dir, `${base} (${i}).pdf`);
    await fs.promises.writeFile(file, pdf);
    shell.openPath(file);
    return { ok: true, file };
  } catch (e) {
    return { ok: false, err: e.message };
  } finally {
    w.destroy();
  }
});
ipcMain.handle('clipboard:read', () => clipboard.readText());

// Read-along: bin/read-along (tools/read-along.swift) listens to the microphone and streams
// what it hears as JSON lines; they go straight to the renderer, which follows the text.
let listener = null;
function stopListening() {
  const p = listener;
  listener = null;
  if (!p) return;
  try {
    p.stdin.end('stop\n');
  } catch {}
  setTimeout(() => p.exitCode === null && p.kill(), 1500);
}
ipcMain.handle('read:start', async (_e, { locale, words } = {}) => {
  stopListening();
  if (process.platform !== 'darwin') return { ok: false, code: 'platform' };
  if (systemPreferences.getMediaAccessStatus('microphone') !== 'granted' && !(await systemPreferences.askForMediaAccess('microphone'))) {
    return { ok: false, code: 'mic' };
  }
  const ctx = Array.isArray(words) ? JSON.stringify(words.slice(0, 100).map(String)) : '[]';
  const p = spawn(path.join(__dirname, 'bin', 'read-along'), [...(process.env.READ_ALONG_FILE ? ['--file', process.env.READ_ALONG_FILE] : []), String(locale || 'en-US')], {
    stdio: ['pipe', 'pipe', 'ignore'],
    env: { ...process.env, READ_ALONG_CTX: ctx }, // ready before the first segment starts
  });
  listener = p;
  const send = (m) => listener === p && win && !win.isDestroyed() && win.webContents.send('read:event', m);
  readline.createInterface({ input: p.stdout }).on('line', (line) => {
    try {
      send(JSON.parse(line));
    } catch {}
  });
  p.on('error', (err) => send({ t: 'error', code: 'spawn', msg: err.message }));
  p.on('exit', (code) => {
    send({ t: 'end', code });
    if (listener === p) listener = null;
  });
  return { ok: true };
});
ipcMain.handle('read:stop', () => stopListening());
app.on('before-quit', stopListening);

app.whenReady().then(async () => {
  dropOldGuardian().catch((e) => console.error('guardian', e.message));
  if (!primary) return;
  backupNotes();
  setInterval(() => dropOldGuardian().catch(() => {}), 3600 * 1000);
  app.on('activate', async () => {
    if (app.dock) app.dock.show();
    if (BrowserWindow.getAllWindows().length === 0) return createWindow(); // asks for the target itself
    // brought up by a click on a reminder banner (or the Dock): go where the banner pointed
    const t = await remind.takeOpen();
    if (t && win && !win.isDestroyed()) win.webContents.send('remind:open', t);
  });
  if (!REMIND_RUN) {
    createWindow();
    remind.schedule().catch((e) => console.error('remind schedule', e));
    remind.widget().catch((e) => console.error('widget', e));
    // a newer release is announced in the window; it comes down when the reader asks (update.js)
    update.start(() => win);
    return;
  }
  if (app.dock) app.dock.hide();
  await remind.widget().catch((e) => console.error('widget', e));
  const r = await remind.fire(openFrom).catch((e) => (console.error('remind', e), null));
  // the helper's banner opens the app by itself; Electron's own one needs us around for the click
  const wait = r && r.ok && !remind.hasHelper() ? 45 * 60000 : 0;
  setTimeout(() => !BrowserWindow.getAllWindows().length && app.quit(), wait);
});

app.on('window-all-closed', () => {
  // on a Mac the app stays up without a window, unless a downloaded update is waiting to go in
  if (process.platform !== 'darwin' || update.pending()) app.quit();
});

// Make sure pending note writes reach the disk before quitting.
app.on('before-quit', async (e) => {
  const pending = [...writeQueue.values()];
  if (!pending.length) return;
  e.preventDefault();
  writeQueue.clear();
  await Promise.allSettled(pending);
  app.quit();
});

