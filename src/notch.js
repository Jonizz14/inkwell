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

const available = () => process.platform === 'darwin' && fs.existsSync(BUNDLE);
const open = (...args) => new Promise((res) => execFile('/usr/bin/open', args, (err) => res(!err)));

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
  return { available: true, running, notifications: !!(running && s.notifications) };
}

// -g: in the background, the reader keeps the keyboard
const start = () => (available() ? open('-g', BUNDLE) : Promise.resolve(false));
async function stop() {
  if ((await status()).running) await open('-g', 'islet://quit');
  return true;
}

// what the settings page may ask for
const LINKS = { test: 'islet://test', settings: 'islet://settings', inkwell: 'islet://open/inkwell' };
function link(what) {
  if (what === 'fda') return open(FDA);
  return LINKS[what] ? open(...(what === 'settings' ? [] : ['-g']), LINKS[what]) : Promise.resolve(false);
}

module.exports = { available, status, start, stop, link };
