// Smart storage: keeps the data folder from growing without end, on its own, a minute after the
// start and every 6 hours after. Settings → Storage turns it off (notes.settings.smartStorage
// 'off') and shows what the last pass freed. What it does, and nothing else:
//  - a PDF's copy in the library goes when the file it was imported from is still where it was
//    and is the very same PDF (same size, same sha1 the id was made from); "Open PDF" then opens
//    that file. If the original is ever moved or deleted, the copy is simply kept.
//  - Chromium's code cache over 100 MB is cleared (the page cache is capped at 150 MB by the
//    disk-cache-size switch main.js sets before the app is ready)
//  - a downloaded update's folder, when nothing is downloading or waiting to be installed
//  - OCR language data not used for 30 days
//  - with under 2 GB free on the disk, every cache
// Notes, words, statistics, article texts, pictures and backups are never touched.
const { session } = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const fsp = require('node:fs/promises');
const crypto = require('node:crypto');

const MB = 1e6;
const CODE_MAX = 100 * MB;
const LOW_DISK = 2000 * MB;
const OCR_DAYS = 30;
const EVERY = 6 * 3600 * 1000;

async function sizeOf(p) {
  let st;
  try {
    st = await fsp.lstat(p);
  } catch {
    return 0;
  }
  if (!st.isDirectory()) return st.size;
  const names = await fsp.readdir(p).catch(() => []);
  let sum = 0;
  for (const n of names) sum += await sizeOf(path.join(p, n));
  return sum;
}

function sha1of(file) {
  return new Promise((ok, fail) => {
    const h = crypto.createHash('sha1');
    fs.createReadStream(file).on('data', (b) => h.update(b)).on('end', () => ok(h.digest('hex'))).on('error', fail);
  });
}

// the PDF an article opens: its library copy, or the file it was imported from once the copy is gone
function pdfOf(lib, m) {
  const copy = path.join(lib, String(m.id).replace(/\W/g, '') + '.pdf');
  if (fs.existsSync(copy) || !m.src) return copy;
  return m.src;
}

// tell(phase, last): optional, for the notch (notch.js activity)
function create({ DATA, LIB, INDEX, NOTES, readJson, update, tell = () => {} }) {
  let running = null;

  async function on() {
    const n = await readJson(NOTES(), {});
    const v = n.settings && n.settings.smartStorage;
    return v !== 'off' && v !== false;
  }

  async function dedupePdfs() {
    const index = await readJson(INDEX(), []);
    let freed = 0;
    for (const m of index) {
      if (m.url || m.op || !m.src || !m.size) continue;
      const copy = path.join(LIB(), m.id + '.pdf');
      try {
        const [a, b] = await Promise.all([fsp.stat(copy), fsp.stat(m.src)]);
        if (a.size !== b.size || b.size !== m.size) continue;
        // the id is the first 16 hex of the PDF's sha1: both files must still be that PDF
        if (!(await sha1of(m.src)).startsWith(m.id) || !(await sha1of(copy)).startsWith(m.id)) continue;
        await fsp.rm(copy, { force: true });
        freed += a.size;
      } catch {}
      await new Promise((ok) => setTimeout(ok, 20)); // a little at a time: the window stays smooth
    }
    return freed;
  }

  async function trimCaches(all) {
    const s = session.defaultSession;
    let freed = 0;
    const code = path.join(DATA(), 'Code Cache');
    const codeBytes = await sizeOf(code);
    if (all || codeBytes > CODE_MAX) {
      await s.clearCodeCaches({});
      freed += Math.max(0, codeBytes - (await sizeOf(code)));
    }
    if (all) {
      const http = path.join(DATA(), 'Cache');
      const before = await sizeOf(http);
      await s.clearCache();
      freed += Math.max(0, before - (await sizeOf(http)));
    }
    return freed;
  }

  async function dropUpdate() {
    if (update.pending() || update.working()) return 0;
    const dir = path.join(DATA(), 'update');
    const n = await sizeOf(dir);
    if (n) await fsp.rm(dir, { recursive: true, force: true });
    return n;
  }

  async function dropOldOcr() {
    const dir = path.join(DATA(), 'ocr-cache');
    const names = await fsp.readdir(dir).catch(() => []);
    const old = Date.now() - OCR_DAYS * 864e5;
    let freed = 0;
    for (const n of names) {
      const p = path.join(dir, n);
      const st = await fsp.stat(p).catch(() => null);
      if (!st || !st.isFile() || Math.max(st.atimeMs, st.mtimeMs) > old) continue;
      await fsp.rm(p, { force: true });
      freed += st.size;
    }
    return freed;
  }

  async function lowDisk() {
    try {
      const f = await fsp.statfs(DATA());
      return f.bavail * f.bsize < LOW_DISK;
    } catch {
      return false;
    }
  }

  // one pass; the result is kept in tidy.json for Settings → Storage
  async function pass({ force = false } = {}) {
    if (running) return running;
    running = (async () => {
      if (!force && !(await on())) return null;
      tell('start');
      const low = await lowDisk();
      const parts = {};
      for (const [k, fn] of [['pdf', dedupePdfs], ['cache', () => trimCaches(low)], ['update', dropUpdate], ['ocr', dropOldOcr]]) {
        try {
          parts[k] = await fn();
        } catch (e) {
          console.error('tidy', k, e.message);
          parts[k] = 0;
        }
      }
      const last = { at: Date.now(), freed: Object.values(parts).reduce((a, b) => a + b, 0), parts, low };
      await fsp.writeFile(path.join(DATA(), 'tidy.json'), JSON.stringify(last)).catch(() => {});
      tell('done', last);
      return last;
    })().finally(() => (running = null));
    return running;
  }

  const last = () => readJson(path.join(DATA(), 'tidy.json'), null);

  function start() {
    setTimeout(() => pass().catch((e) => console.error('tidy', e.message)), 60 * 1000);
    setInterval(() => pass().catch(() => {}), EVERY);
  }

  return { start, pass, last };
}

module.exports = { create, pdfOf, CACHE_MAX: 150 * MB };
