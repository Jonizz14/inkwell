'use strict';
// Dynamic Notch (macOS): Islet, a small Swift app from tools/notch built into src/bin/Islet.app,
// lives around the camera at the top of the screen. It shows Inkwell there (streak, today's goal,
// the focus timer, words due, the article in progress) next to music and other apps'
// notifications. The two need no channel of their own: Islet follows the widget.json the widgets
// already read and opens places here through articles365:// links; we start it, stop it and
// poke it through islet:// links. notes.settings.notch = true turns it on.
const { execFile } = require('node:child_process');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

const BUNDLE = path.join(__dirname, 'bin', 'Islet.app');
// written by Islet while it runs (main.swift writeStatus)
const STATUS = path.join(os.homedir(), 'Library', 'Application Support', 'Islet', 'status.json');
const FDA = 'x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles';
// `Islet --send <link>` hands a link straight to the copy that is running (ours or a standalone
// Islet); opening islet:// through macOS could start some other registered copy instead
const BIN = path.join(BUNDLE, 'Contents', 'MacOS', 'Islet');
const send = (link) => new Promise((res) => execFile(BIN, ['--send', link], { timeout: 5000 }, (err) => res(!err)));

const available = () => process.platform === 'darwin' && fs.existsSync(BUNDLE);
const open = (...args) => new Promise((res) => execFile('/usr/bin/open', args, (err) => res(!err)));
const pgrep = () => new Promise((res) => execFile('/usr/bin/pgrep', ['-x', 'Islet'], (err) => res(!err)));

async function status() {
  if (!available()) return { available: false };
  let s = null;
  try {
    s = JSON.parse(await fsp.readFile(STATUS, 'utf8'));
  } catch {}
  let running = false;
  if (s && s.pid) {
    try {
      process.kill(s.pid, 0);
      running = true;
    } catch {}
  }
  // an older Islet may not have written the file: the process itself is the answer then
  if (!running && (await pgrep())) return { available: true, running: true, notifications: false, inkwell: false, hello: 0 };
  // inkwell: it reads our widget.json; hello: when it last showed the greeting (ms)
  return { available: true, running, notifications: !!(running && s.notifications), inkwell: !!(running && s.inkwell), hello: (running && s.hello) || 0 };
}

// -g: in the background, the reader keeps the keyboard; one already running is left as it is
async function start() {
  if (!available()) return false;
  if ((await status()).running) return true;
  return open('-g', BUNDLE);
}
async function stop() {
  if ((await status()).running) await send('islet://quit');
  return true;
}

// what the settings page may ask for
const LINKS = { test: 'islet://test', settings: 'islet://settings', inkwell: 'islet://open/inkwell' };
async function link(what) {
  if (what === 'fda') return open(FDA);
  if (!LINKS[what] || !available()) return false;
  if (!(await status()).running) {
    await start();
    await new Promise((r) => setTimeout(r, 1500));
  }
  return send(LINKS[what]);
}

// What Inkwell is doing in the background — cleaning its cache, downloading an update, adding
// articles — shows in the notch while it runs (Inky at work, a ring filling) and a short note
// when it's done. kind: tidy | clear | update | import; phase: start | progress | done | cancel;
// p: 0–1; n: bytes freed or articles added. Only when the notch is running; progress at most
// twice a second.
let lastProgress = 0;
async function activity(kind, phase, { p, n, text } = {}) {
  if (!available()) return;
  if (phase === 'progress') {
    const now = Date.now();
    if (now - lastProgress < 500) return;
    lastProgress = now;
  }
  if (!(await status()).running) return;
  const q = new URLSearchParams({ kind, phase });
  if (p != null) q.set('p', String(Math.round(p * 100) / 100));
  if (n != null) q.set('n', String(n));
  if (text) q.set('text', String(text).slice(0, 60));
  send('islet://activity?' + q);
}

module.exports = { available, status, start, stop, link, activity };
