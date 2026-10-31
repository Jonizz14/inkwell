'use strict';
// Updates without reinstalling. Every push to main is built by CI and published as a GitHub
// release (v1.1.N, .github/workflows/build.yml). The installed app looks at the latest release
// on start and every few hours and tells the window (renderer/update-ui.js: a banner, a "What's
// new" page from the release notes). Only when the reader presses Update is the new build
// downloaded, with its progress sent along; once it is in place the app reopens as the new
// version, which greets once with what it brought (update-done.json).
// Most releases change only the app's own code (src/): those come as a small file,
// Inkwell-<v>-<mac|win>-app-<deps>.zip (about a megabyte instead of 150), taken when <deps> is
// what this app is built on (package.json "inkwellDeps", scripts/deps-hash.mjs). When Electron,
// the node modules or the native helpers changed, the whole app comes instead:
//   macOS:   Inkwell-<v>-mac.zip (the app with its helpers), unpacked with ditto and swapped in
//            by a small script that waits for this process to end. electron-updater (Squirrel)
//            needs a Developer ID signature, which this app does not have.
//   Windows: the NSIS installer, run silently (/S) once the app has quit.
// The download survives a slow or broken connection: it shows every byte as it comes, starts
// again where it stopped when the line goes quiet, and gives up only after several tries.
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
const PLAT = process.platform === 'darwin' ? 'mac' : 'win';
// what this build is made of besides src/ (CI writes it; a build from source has none)
const DEPS = (() => {
  try {
    return require('../package.json').inkwellDeps || '';
  } catch {
    return '';
  }
})();
// the app's own folder inside the bundle (asar is off): src/ and package.json live here
const APPDIR = () => path.join(process.resourcesPath, 'app');

let found = null; // { version, date, changes, files, asset } of a newer release
let staged = null; // { version, mac: path to the new Inkwell.app } | { version, exe }
let busy = false; // the window is showing an update being written: it doesn't close
let downloading = false;
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

// manual: asked for from the menu, which shows the answer itself (no announcement then)
async function check(manual) {
  if (staged) return { state: 'ready' };
  if (busy) return { state: 'busy' };
  if (!supported()) return { state: 'dev' };
  try {
    const r = await net.fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { 'User-Agent': 'Inkwell', Accept: 'application/vnd.github+json' },
    });
    if (!r.ok) return { state: 'error' };
    const rel = await r.json();
    const version = String(rel.tag_name || '').replace(/^v/, '');
    if (!newer(version, app.getVersion())) return { state: 'latest' };
    const want = process.platform === 'darwin' ? /-mac\.zip$/ : /^Inkwell-Setup-.*\.exe$/;
    const small = DEPS && (rel.assets || []).find((a) => a.name === `Inkwell-${version}-${PLAT}-app-${DEPS}.zip`);
    const asset = small || (rel.assets || []).find((a) => want.test(a.name));
    if (!asset) return { state: 'latest' }; // an older release without the update file
    asset.small = !!small;
    const date = rel.published_at ? new Date(rel.published_at).toLocaleDateString('en-GB').replace(/\//g, '.') : '';
    found = { version, date, changes: notesOf(rel.body), files: [[asset.name, Math.round(asset.size / 1024)]], asset };
    const info = { version, date, changes: found.changes, files: found.files };
    if (!manual) send('update:available', info);
    return { state: 'found', info };
  } catch (e) {
    console.error('update check', e.message);
    return { state: 'error' };
  }
}

// One file, fetched so that a slow line still gets there: the progress goes out every quarter
// second from the first byte; when nothing arrives for a while the request is dropped and asked
// again from the byte it stopped at (a Range request); only several failures in a row end it.
const QUIET = 30e3; // no answer, or no new bytes, for this long: try again
const TRIES = 8;
async function fetchTo(url, file, size, onBytes) {
  let got = 0;
  let fails = 0;
  await fsp.rm(file, { force: true });
  while (got < size) {
    const ctl = new AbortController();
    let quiet = setTimeout(() => ctl.abort(), QUIET + 30e3); // the first answer may take a while
    const wake = () => (clearTimeout(quiet), (quiet = setTimeout(() => ctl.abort(), QUIET)));
    try {
      const r = await net.fetch(url, { headers: { 'User-Agent': 'Inkwell', ...(got ? { Range: `bytes=${got}-` } : {}) }, signal: ctl.signal });
      if (!r.ok) throw new Error(`download ${r.status}`);
      // asked for the rest but got the whole file: start over
      if (got && r.status !== 206) got = 0;
      wake();
      const out = fs.createWriteStream(file, { flags: got ? 'a' : 'w' });
      try {
        for await (const chunk of r.body) {
          wake();
          got += chunk.length;
          if (!out.write(chunk)) await new Promise((ok) => out.once('drain', ok));
          onBytes(got);
          fails = 0;
        }
      } finally {
        await new Promise((ok) => out.end(ok));
      }
      got = (await fsp.stat(file)).size;
      if (got < size) throw new Error('cut short');
    } catch (e) {
      got = await fsp.stat(file).then((st) => st.size, () => 0);
      if (++fails >= TRIES) throw new Error(`download failed: ${e.message}`);
      console.error('update download, trying again', e.message);
      await new Promise((ok) => setTimeout(ok, Math.min(8000, 1000 * fails)));
    } finally {
      clearTimeout(quiet);
    }
  }
  if ((await fsp.stat(file)).size !== size) throw new Error('download incomplete');
}

// downloads the release found, telling the window how far it got
async function download() {
  if (!found || staged || downloading) return;
  downloading = true;
  const { asset, version } = found;
  try {
    await fsp.rm(DIR(), { recursive: true, force: true });
    await fsp.mkdir(DIR(), { recursive: true });
    const file = path.join(DIR(), asset.name);
    let last = 0;
    send('update:progress', { f: 0 });
    await fetchTo(asset.browser_download_url, file, asset.size, (got) => {
      const now = Date.now();
      if (now - last < 250) return;
      last = now;
      send('update:progress', { f: Math.min(0.99, got / asset.size) });
    });
    if (asset.small) staged = await stageSmall(file, version);
    else if (process.platform === 'darwin') {
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
  } finally {
    downloading = false;
  }
}

// The small update: the new src/ and package.json, unpacked beside the app. On macOS they go into
// a copy of this app, signed again, and that copy is swapped in like a whole download; on Windows
// a script puts them into the installed app's folder once it has quit.
async function stageSmall(file, version) {
  const dir = path.join(DIR(), 'app');
  if (process.platform === 'darwin') {
    await run('/usr/bin/ditto', ['-x', '-k', file, dir]);
    await fsp.access(path.join(dir, 'src', 'main.js'));
    const mac = path.join(DIR(), 'new', 'Inkwell.app');
    await fsp.mkdir(path.dirname(mac), { recursive: true });
    await run('/usr/bin/ditto', [BUNDLE(), mac]);
    const res = path.join(mac, 'Contents', 'Resources', 'app');
    await fsp.rm(path.join(res, 'src'), { recursive: true, force: true });
    await run('/usr/bin/ditto', [path.join(dir, 'src'), path.join(res, 'src')]);
    await fsp.copyFile(path.join(dir, 'package.json'), path.join(res, 'package.json'));
    await run('/usr/bin/xattr', ['-cr', mac]).catch(() => {});
    // the files inside changed: the app is signed again (the reminder's banners need the seal)
    await run('/usr/bin/codesign', ['--force', '--sign', '-', '--identifier', 'uz.javohir.articles365', mac]);
    await fsp.rm(file, { force: true });
    await fsp.rm(dir, { recursive: true, force: true });
    return { version, mac };
  }
  await run('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', `Expand-Archive -LiteralPath '${file.replace(/'/g, "''")}' -DestinationPath '${dir.replace(/'/g, "''")}' -Force`]);
  await fsp.access(path.join(dir, 'src', 'main.js'));
  await fsp.rm(file, { force: true });
  return { version, src: dir };
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

// Windows, the small update: once the app is gone, its src/ and package.json are replaced (the old
// src/ is kept aside until the new one is in, and put back if that fails), then it opens again
const SWAP_WIN = `param($procId, $new, $app, $exe, $open)
  while (Get-Process -Id $procId -ErrorAction SilentlyContinue) { Start-Sleep -Milliseconds 200 }
  $old = Join-Path $app 'src.old'
  Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
  try {
    Rename-Item -LiteralPath (Join-Path $app 'src') -NewName 'src.old' -ErrorAction Stop
    Copy-Item -LiteralPath (Join-Path $new 'src') -Destination (Join-Path $app 'src') -Recurse -Force -ErrorAction Stop
    Copy-Item -LiteralPath (Join-Path $new 'package.json') -Destination (Join-Path $app 'package.json') -Force -ErrorAction Stop
    Remove-Item -LiteralPath $old -Recurse -Force -ErrorAction SilentlyContinue
  } catch {
    if (Test-Path -LiteralPath $old) {
      Remove-Item -LiteralPath (Join-Path $app 'src') -Recurse -Force -ErrorAction SilentlyContinue
      Rename-Item -LiteralPath $old -NewName 'src'
    }
  }
  if ($open -eq '1') { Start-Process -FilePath $exe }
`;

let applying = false;
function apply(reopen) {
  if (!staged || applying) return;
  applying = true;
  // the new version greets with what it brought
  fs.writeFileSync(DONE(), JSON.stringify({ v: staged.version, date: found && found.date, changes: found && found.changes }));
  const opts = { detached: true, stdio: 'ignore' };
  if (staged.mac) spawn('/bin/sh', ['-c', SWAP, 'swap', String(process.pid), staged.mac, BUNDLE(), reopen ? '1' : '0'], opts).unref();
  else if (staged.src) {
    const ps1 = path.join(DIR(), 'swap.ps1');
    fs.writeFileSync(ps1, SWAP_WIN);
    spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-WindowStyle', 'Hidden', '-File', ps1, String(process.pid), staged.src, APPDIR(), process.execPath, reopen ? '1' : '0'], { ...opts, windowsHide: true }).unref();
  }
  else spawn(staged.exe, ['/S', ...(reopen ? ['--force-run'] : [])], opts).unref();
}

// while an update is being written the window and the app don't close; the window says why
function hold(e) {
  if (!busy) return false;
  e.preventDefault();
  send('update:hold');
  return true;
}

// tell(channel, data): optional, also gets every message (the notch shows the download)
function start(win, tell = () => {}) {
  send = (ch, data) => {
    const w = win();
    if (w && !w.isDestroyed()) w.webContents.send(ch, data);
    tell(ch, data);
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
  ipcMain.handle('update:check', async () => ({ ...(await check(true)), current: app.getVersion() }));
  ipcMain.handle('app:version', () => app.getVersion());
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

module.exports = { start, hold, pending: () => staged && staged.version, working: () => downloading || busy, newer, notesOf, _test: { fetchTo, stageSmall } };
