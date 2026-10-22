'use strict';
// Updates without reinstalling. Every push to main is built by CI and published as a GitHub
// release (v1.1.N, .github/workflows/build.yml). The installed app looks at the latest release
// on start and every few hours and tells the window (renderer/update-ui.js: a banner, a "What's
// new" page from the release notes). Only when the reader presses Update is the new build
// downloaded, with its progress sent along; once it is in place the app reopens as the new
// version, which greets once with what it brought (update-done.json).
//   macOS:   Inkwell-<v>-mac.zip (the app with its helpers), unpacked with ditto and swapped in
//            by a small script that waits for this process to end. electron-updater (Squirrel)
//            needs a Developer ID signature, which this app does not have.
//   Windows: the NSIS installer, run silently (/S) once the app has quit.
// --update-demo plays the same with a sample update, and nothing is downloaded.
const { app, ipcMain, net } = require('electron');
const { spawn, execFile } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const REPO = 'Jonizz14/inkwell';
const EVERY = 4 * 3600e3;
const DIR = () => path.join(app.getPath('userData'), 'update');
const DONE = () => path.join(app.getPath('userData'), 'update-done.json');
// the .app bundle around Contents/MacOS/Inkwell
const BUNDLE = () => path.resolve(process.execPath, '..', '..', '..');
const DEMO = process.argv.includes('--update-demo');

let found = null; // { version, date, changes, files, asset } of a newer release
let staged = null; // { version, mac: path to the new Inkwell.app } | { version, exe }
let busy = false; // the window is showing an update being written: it doesn't close
let send = () => {};

const parts = (v) => String(v).replace(/^v/, '').split(/[.-]/).slice(0, 3).map((n) => parseInt(n, 10) || 0);
function newer(a, b) {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
}
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, (err) => (err ? rej(err) : res())));

function supported() {
  if (!app.isPackaged) return false;
  if (process.platform === 'win32') return true;
  if (process.platform !== 'darwin') return false;
  // the swap renames the bundle inside its folder (normally /Applications)
  try {
    fs.accessSync(path.dirname(BUNDLE()), fs.constants.W_OK);
    return BUNDLE().endsWith('.app');
  } catch {
    return false;
  }
}

// The release notes are the commit message (CI puts it first): its first line and paragraphs,
// and any "- " lines, become the items of "What's new"; the download lines under it are left out.
function notesOf(body) {
  const text = String(body || '').split(/\n\*\*macOS:\*\*/)[0].replace(/\r/g, '');
  const items = [];
  for (const para of text.split(/\n\s*\n/)) {
    const lines = para.split('\n').map((l) => l.trim()).filter((l) => l && !/^Co-Authored-By:/i.test(l));
    if (!lines.length) continue;
    const bullets = lines.filter((l) => /^[-*] /.test(l));
    if (bullets.length) for (const b of bullets) items.push([b.replace(/^[-*] /, ''), '']);
    else items.push(items.length ? ['', lines.join(' ')] : [lines[0], lines.slice(1).join(' ')]);
  }
  // a paragraph without a title of its own describes the item before it
  const out = [];
  for (const [t, d] of items) {
    if (!t && out.length) out[out.length - 1][1] = [out[out.length - 1][1], d].filter(Boolean).join(' ');
    else out.push([t, d]);
  }
  return { add: out };
}

async function check() {
  if (busy || staged || !supported()) return;
  try {
    const r = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'Inkwell', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return;
    const rel = await r.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    if (!newer(version, app.getVersion())) return;
    const want = process.platform === 'darwin' ? /-mac\.zip$/ : /^Inkwell-Setup-.*\.exe$/;
    const asset = (rel.assets || []).find((a) => want.test(a.name));
    if (!asset) return; // an older release without the update file
    const date = rel.published_at ? new Date(rel.published_at).toLocaleDateString('en-GB').replace(/\//g, '.') : '';
    found = { version, date, changes: notesOf(rel.body), files: [[asset.name, Math.round(asset.size / 1024)]], asset };
    send('update:available', { version, date, changes: found.changes, files: found.files });
  } catch (e) {
    console.error('update check', e.message);
  }
}

// downloads the release found, telling the window how far it got
async function download() {
  if (!found || staged) return;
  const { asset, version } = found;
  try {
    await fsp.rm(DIR(), { recursive: true, force: true });
    await fsp.mkdir(DIR(), { recursive: true });
    const file = path.join(DIR(), asset.name);
    const r = await net.fetch(asset.browser_download_url, { headers: { 'User-Agent': 'Inkwell' } });
    if (!r.ok) throw new Error(`download ${r.status}`);
    const out = fs.createWriteStream(file);
    let got = 0, last = 0;
    for await (const chunk of r.body) {
      got += chunk.length;
      if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok));
      const f = Math.min(0.99, got / asset.size);
      if (f - last >= 0.01) send('update:progress', { f: (last = f) });
    }
    await new Promise((ok, no) => out.end((e) => (e ? no(e) : ok())));
    if ((await fsp.stat(file)).size !== asset.size) throw new Error('download incomplete');
    if (process.platform === 'darwin') {
      const dir = path.join(DIR(), 'new');
      await run('/usr/bin/ditto', ['-x', '-k', file, dir]);
      const mac = path.join(dir, 'Inkwell.app');
      await fsp.access(path.join(mac, 'Contents', 'MacOS', 'Inkwell'));
      await run('/usr/bin/xattr', ['-cr', mac]).catch(() => {});
      await fsp.rm(file, { force: true });
      staged = { version, mac };
    } else {
      staged = { version, exe: file };
    }
    send('update:progress', { f: 1 });
    send('update:staged', version);
  } catch (e) {
    console.error('update', e.message);
    busy = false;
    send('update:failed', e.message);
  }
}

// started detached when the app quits; waits for it to be gone, then puts the new build in place
const SWAP = `pid=$1; new=$2; dest=$3; open=$4
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
# add-ons kept beside the app (src/private, src/renderer/private) come along into the new build,
# which is then signed again (a file added after signing breaks the seal, and banners with it)
kept=0
for d in Contents/Resources/app/src/private Contents/Resources/app/src/renderer/private; do
  if [ -d "$dest/$d" ]; then cp -R "$dest/$d" "$new/$d" && kept=1; fi
done
[ "$kept" = 1 ] && codesign --force --sign - --identifier uz.javohir.articles365 "$new" 2>/dev/null
old="$dest.old"
rm -rf "$old"
mv "$dest" "$old" || exit 1
if ! mv "$new" "$dest"; then mv "$old" "$dest"; exit 1; fi
rm -rf "$old"
pluginkit -a "$dest/Contents/PlugIns/ReaderWidget.appex" 2>/dev/null
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$dest" 2>/dev/null
[ "$open" = 1 ] && open "$dest"
exit 0`;

let applying = false;
function apply(reopen) {
  if (!staged || applying) return;
  applying = true;
  // the new version greets with what it brought
  fs.writeFileSync(DONE(), JSON.stringify({ v: staged.version, date: found && found.date, changes: found && found.changes }));
  const opts = { detached: true, stdio: 'ignore' };
  if (staged.mac) spawn('/bin/sh', ['-c', SWAP, 'swap', String(process.pid), staged.mac, BUNDLE(), reopen ? '1' : '0'], opts).unref();
  else spawn(staged.exe, ['/S', ...(reopen ? ['--force-run'] : [])], opts).unref();
}

// while an update is being written the window and the app don't close; the window says why
function hold(e) {
  if (!busy) return false;
  e.preventDefault();
  send('update:hold');
  return true;
}

function start(win) {
  send = (ch, data) => {
    const w = win();
    if (w && !w.isDestroyed()) w.webContents.send(ch, data);
  };
  ipcMain.handle('update:demo', () => DEMO);
  ipcMain.handle('update:done', async () => {
    let d = null;
    try {
      d = JSON.parse(await fsp.readFile(DONE(), 'utf8'));
    } catch {}
    await fsp.rm(DONE(), { force: true });
    return d;
  });
  ipcMain.on('update:busy', (_e, on) => (busy = !!on));
  ipcMain.handle('update:run', () => ((busy = true), download()));
  // "Reopen": the downloaded build goes in and opens; in the demo the app just restarts
  ipcMain.handle('update:restart', async (_e, v) => {
    busy = false;
    if (staged) {
      apply(true);
      return app.quit();
    }
    await fsp.writeFile(DONE(), JSON.stringify({ v: String(v) }));
    app.relaunch({ args: process.argv.slice(1).filter((a) => a !== '--update-demo') });
    app.quit();
  });
  app.on('before-quit', hold);
  // a build downloaded but not reopened yet goes in when the app quits anyway
  app.on('will-quit', () => apply(false));
  if (!supported()) return;
  setTimeout(check, 8e3);
  setInterval(check, EVERY).unref();
}

module.exports = { start, hold, pending: () => staged && staged.version, newer, notesOf };
