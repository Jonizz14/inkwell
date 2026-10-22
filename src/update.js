'use strict';
// Updates without reinstalling. Every push to main is built by CI and published as a GitHub
// release (v1.1.N, .github/workflows/build.yml). The installed app looks at the latest release
// on start and every few hours, downloads a newer build in the background and puts it in place
// when the app quits; restartNow() does it at once and opens the new version.
//   macOS:   Inkwell-<v>-mac.zip (the app with its helpers), unpacked with ditto and swapped in
//            by a small script that waits for this process to end. electron-updater (Squirrel)
//            needs a Developer ID signature, which this app does not have.
//   Windows: the NSIS installer, run silently (/S) once the app has quit.
const { app, net } = require('electron');
const { spawn, execFile } = require('node:child_process');
const { Readable } = require('node:stream');
const { pipeline } = require('node:stream/promises');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');

const REPO = 'Jonizz14/inkwell';
const EVERY = 4 * 3600e3;
const DIR = () => path.join(app.getPath('userData'), 'update');
// the .app bundle around Contents/MacOS/Inkwell
const BUNDLE = () => path.resolve(process.execPath, '..', '..', '..');

let staged = null; // { version, mac: path to the new Inkwell.app } | { version, exe }
let busy = false;
let onReady = () => {};

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

async function download(url, file, size) {
  const r = await net.fetch(url, { headers: { 'User-Agent': 'Inkwell' } });
  if (!r.ok) throw new Error(`download ${r.status}`);
  await pipeline(Readable.fromWeb(r.body), fs.createWriteStream(file));
  if (size && (await fsp.stat(file)).size !== size) throw new Error('download incomplete');
}

async function check() {
  if (busy || staged || !supported()) return;
  busy = true;
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
    await fsp.rm(DIR(), { recursive: true, force: true });
    await fsp.mkdir(DIR(), { recursive: true });
    const file = path.join(DIR(), asset.name);
    await download(asset.browser_download_url, file, asset.size);
    if (process.platform === 'darwin') {
      const out = path.join(DIR(), 'new');
      await run('/usr/bin/ditto', ['-x', '-k', file, out]);
      const mac = path.join(out, 'Inkwell.app');
      await fsp.access(path.join(mac, 'Contents', 'MacOS', 'Inkwell'));
      await run('/usr/bin/xattr', ['-cr', mac]).catch(() => {});
      await fsp.rm(file, { force: true });
      staged = { version, mac };
    } else {
      staged = { version, exe: file };
    }
    onReady(version);
  } catch (e) {
    console.error('update', e.message);
  } finally {
    busy = false;
  }
}

// started detached when the app quits; waits for it to be gone, then puts the new build in place
const SWAP = `pid=$1; new=$2; dest=$3; open=$4
while kill -0 "$pid" 2>/dev/null; do sleep 0.2; done
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
  const opts = { detached: true, stdio: 'ignore' };
  if (staged.mac) spawn('/bin/sh', ['-c', SWAP, 'swap', String(process.pid), staged.mac, BUNDLE(), reopen ? '1' : '0'], opts).unref();
  else spawn(staged.exe, ['/S', ...(reopen ? ['--force-run'] : [])], opts).unref();
}

function start(ready) {
  if (!supported()) return;
  onReady = ready || onReady;
  app.on('will-quit', () => apply(false));
  setTimeout(check, 15e3);
  setInterval(check, EVERY).unref();
}

function restartNow() {
  if (!staged) return false;
  apply(true);
  app.quit();
  return true;
}

module.exports = { start, restartNow, pending: () => staged && staged.version, newer };
