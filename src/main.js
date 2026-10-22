const { app, session, BrowserWindow, ipcMain, dialog, clipboard, shell, nativeTheme, systemPreferences } = require('electron');
const { spawn } = require('node:child_process');
const readline = require('node:readline');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');
const remind = require('./notify');

// started by the reminder agent: no window, no Dock icon unless the notification is clicked
const REMIND_RUN = process.argv.includes('--remind');
// Windows shows notifications under the installed shortcut's id (electron-builder sets it to appId)
if (process.platform === 'win32') app.setAppUserModelId('uz.javohir.articles365');
// the data folder keeps the name the app first shipped under, so nothing moves on an update
app.setPath('userData', path.join(app.getPath('appData'), '365 Articles Reader'));
app.setName('Inkwell');
const primary = app.requestSingleInstanceLock();
if (!primary) app.quit();

const DATA = () => app.getPath('userData');
const LIB = () => path.join(DATA(), 'library');
const INDEX = () => path.join(DATA(), 'index.json');
const NOTES = () => path.join(DATA(), 'notes.json');
// Folder scanned on every start: PDFs dropped here are imported.
const INBOX = () => path.join(app.getPath('documents'), 'Inkwell');

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

ipcMain.handle('library:list', () => readJson(INDEX(), []));
ipcMain.handle('library:article', (_e, id) => readJson(path.join(LIB(), String(id).replace(/\W/g, '') + '.json'), null));
ipcMain.handle('library:openPdf', async (_e, id) => {
  // an article saved from the web has no PDF: its own page opens instead
  const m = (await readJson(INDEX(), [])).find((a) => a.id === id);
  if (m && m.url) return shell.openExternal(m.url);
  return shell.openPath(path.join(LIB(), String(id).replace(/\W/g, '') + '.pdf'));
});

ipcMain.handle('library:dir', () => LIB());
ipcMain.handle('library:pick', async () => {
  const r = await dialog.showOpenDialog(win, {
    title: 'PDF maqolalarni tanlang',
    properties: ['openFile', 'openDirectory', 'multiSelections'],
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
  if (!widgetT) widgetT = setTimeout(() => ((widgetT = 0), remind.widget(widgetNotes).catch(() => {})), 2000);
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
  if (!primary) return;
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
  if (process.platform !== 'darwin') app.quit();
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

