// Turns a magazine-style PDF into clean, readable blocks: { type: 'h' | 'p', text }.
//
// 1. pdf.js text items are grouped geometrically into line fragments
//    (same baseline, no big horizontal gap), so two columns never merge.
// 2. Each page is cut into horizontal bands at full-width lines; inside a band
//    narrow lines are assigned to columns and read left column first.
// 3. Running headers/footers, page numbers and tiny margin text are removed.
// 4. Lines are joined into paragraphs using vertical gaps, first-line indents,
//    font size changes and ALL-CAPS headings; hyphenated breaks are rejoined.
//
// Scanned pages (no text layer) are read with Apple's Vision OCR on macOS
// (tools/vision-ocr.swift, built into src/bin/vision-ocr). Vision returns whole
// lines that never span a column gutter; they are put in reading order with a
// recursive XY-cut. Elsewhere tesseract.js is the fallback.
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import fsp from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const median = (arr) => {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)];
};

const norm = (s) => s.replace(/\d+/g, '#').replace(/[^\p{L}#]+/gu, ' ').trim().toLowerCase();
const endsSentence = (s) => /[.!?"”’)\]…]$/.test(s);
const letters = (s) => s.replace(/[^\p{L}]/gu, '');
const isCaps = (s) => {
  const l = letters(s);
  return l.length >= 4 && l === l.toUpperCase() && l !== l.toLowerCase();
};

const WATERMARK = /(@?articles\s?365|t\.me\/|telegram)/i;

function textItemsToFrags(items) {
  const frags = [];
  for (const it of items) {
    if (typeof it.str !== 'string' || !it.str.trim()) continue;
    // rotated text (photo credits up the margin) is not part of the article
    if (Math.abs(it.transform[1]) > Math.abs(it.transform[0]) * 0.05) continue;
    const size = Math.hypot(it.transform[2], it.transform[3]) || it.height || 10;
    frags.push({ x: it.transform[4], y: it.transform[5], w: it.width, size, str: it.str, font: it.fontName });
  }
  return frags;
}

// Builds a line's text, inserting spaces from geometry. Letter-spaced
// headings ("B Y  A R R I C C A") get their real word gaps back.
function lineText(items) {
  const gaps = [];
  for (let i = 1; i < items.length; i++) gaps.push(items[i].x - (items[i - 1].x + items[i - 1].w));
  const singles = items.filter((f) => f.str.trim().length === 1).length;
  const size = median(items.map((f) => f.size));
  const spaced = items.length >= 5 && singles / items.length > 0.6 && median(gaps) > size * 0.15;
  const thr = spaced ? Math.max(size * 0.18, median(gaps.filter((g) => g > 0)) * 1.6) : size * 0.18;
  let text = '';
  items.forEach((f, i) => {
    let str = spaced ? f.str.trim() : f.str;
    if (i > 0 && !/\s$/.test(text) && !/^\s/.test(str) && (f.word || gaps[i - 1] > thr)) text += ' ';
    text += str;
  });
  return text.replace(/\s+/g, ' ').trim();
}

// A drop cap ("L" spanning three lines) belongs in front of the first line beside it.
function attachDropCaps(frags) {
  const med = median(frags.map((f) => f.size));
  for (const d of frags.filter((f) => /^[A-Z]$/.test(f.str.trim()) && f.size > med * 1.8)) {
    const near = frags.filter(
      (f) => f !== d && f.x > d.x && f.x - (d.x + d.w) < med * 3 && f.y >= d.y - med * 0.5 && f.y <= d.y + d.size * 1.1 && /^\p{Ll}/u.test(f.str.trim()),
    );
    if (!near.length) continue;
    const top = near.reduce((a, b) => (b.y > a.y + 1 || (Math.abs(b.y - a.y) <= 1 && b.x < a.x) ? b : a));
    top.str = d.str.trim() + top.str.trimStart();
    d.str = '';
  }
  return frags.filter((f) => f.str);
}

function pageLines(frags, pageNo, view, opts = {}) {
  frags = attachDropCaps(frags);
  // rows by baseline
  frags.sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const f of frags) {
    const row = rows.find((r) => Math.abs(r.y - f.y) < Math.min(r.size, f.size) * 0.45);
    if (row) row.items.push(f);
    else rows.push({ y: f.y, size: f.size, items: [f] });
  }
  const lines = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    let cur = null;
    for (const f of r.items) {
      const gap = cur ? f.x - cur.xEnd : 0;
      if (!cur || gap > Math.min(cur.size, f.size) * (opts.ocr ? 1.2 : 0.8)) {
        if (cur) lines.push(cur);
        cur = { page: pageNo, x: f.x, xEnd: f.x + f.w, y: r.y, items: [], ocr: !!opts.ocr, size: f.size };
      }
      cur.items.push(f);
      cur.xEnd = Math.max(cur.xEnd, f.x + f.w);
      cur.size = f.size;
    }
    if (cur) lines.push(cur);
  }
  for (const l of lines) {
    l.text = lineText(l.items);
    // character-weighted size so a big drop cap doesn't dominate
    let best = 0;
    const tally = new Map();
    for (const f of l.items) {
      const k = Math.round(f.size * 2) / 2;
      tally.set(k, (tally.get(k) || 0) + f.str.length);
    }
    for (const [k, n] of tally) if (n > best) ((best = n), (l.size = k));
    const fonts = new Map();
    for (const f of l.items) if (f.font) fonts.set(f.font, (fonts.get(f.font) || 0) + f.str.length);
    l.font = [...fonts].sort((a, b) => b[1] - a[1])[0]?.[0];
    delete l.items;
  }
  const H = view[3] - view[1];
  return lines.filter((l) => l.text && !WATERMARK.test(l.text) && !((l.y < H * 0.055 || l.y > H * 0.955) && l.text.length < 90));
}

// Reading order: find column starts (x positions where many lines begin), cut
// the page into bands at lines that span several columns, then read each band
// column by column, top to bottom.
function orderPage(lines) {
  lines.sort((a, b) => b.y - a.y || a.x - b.x);
  if (lines.length < 6) return lines;
  const tol = median(lines.map((l) => l.size)) * 1.5;
  const xs = lines.map((l) => l.x).sort((a, b) => a - b);
  const clusters = [];
  for (const x of xs) {
    const c = clusters[clusters.length - 1];
    if (c && x - c.last <= tol) ((c.last = x), c.n++);
    else clusters.push({ first: x, last: x, n: 1 });
  }
  const need = Math.max(3, lines.length * 0.08);
  const starts = clusters.filter((c) => c.n >= need).map((c) => c.first);
  if (starts.length < 2) return lines;

  const colOf = (l) => {
    let c = 0;
    starts.forEach((s, i) => {
      if (l.x >= s - tol) c = i;
    });
    return c;
  };
  for (const l of lines) {
    l.col = colOf(l);
    const next = starts[l.col + 1];
    l.wide = next != null && l.xEnd > next + tol;
  }

  const out = [];
  let band = [];
  const flushBand = () => {
    band.sort((a, b) => a.col - b.col || b.y - a.y || a.x - b.x);
    band.forEach((l, i) => {
      l.colStart = i > 0 && l.col !== band[i - 1].col;
      out.push(l);
    });
    band = [];
  };
  for (const l of lines) {
    if (l.wide) {
      flushBand();
      out.push(l);
    } else band.push(l);
  }
  flushBand();
  return out;
}

function dropRunningHeads(pages) {
  const counts = new Map();
  for (const ls of pages) {
    const seen = new Set();
    for (const l of ls) {
      if (l.text.length > 70) continue;
      const k = norm(l.text);
      if (!k || seen.has(k)) continue;
      seen.add(k);
      counts.set(k, (counts.get(k) || 0) + 1);
    }
  }
  const limit = Math.max(2, Math.ceil(pages.length * 0.3));
  return pages.map((ls) =>
    ls.filter((l) => {
      if (/^[\s#\d|/•·.-]*$/.test(l.text) || /^(page\s*)?\d{1,4}(\s*(of|\/)\s*\d{1,4})?$/i.test(l.text)) return false;
      return !(pages.length > 2 && l.text.length <= 70 && (counts.get(norm(l.text)) || 0) >= limit);
    }),
  );
}

function joinText(a, b) {
  if (!a) return b;
  if (/\p{L}[-‐]$/u.test(a) && /^\p{Ll}/u.test(b)) return a.slice(0, -1) + b;
  if (/[—–/]$/.test(a)) return a + b;
  return a + ' ' + b;
}

function linesToBlocks(lines) {
  if (!lines.length) return { blocks: [] };
  const weighted = [];
  for (const l of lines) for (let i = 0; i < Math.ceil(l.text.length / 20); i++) weighted.push(l.size);
  const body = median(weighted);
  const bodyLines = lines.filter((l) => Math.abs(l.size - body) < body * 0.08);
  const gaps = [];
  for (let i = 1; i < bodyLines.length; i++) {
    const a = bodyLines[i - 1];
    const b = bodyLines[i];
    if (a.page === b.page && a.y > b.y && a.y - b.y < body * 3) gaps.push(a.y - b.y);
  }
  const lineGap = median(gaps) || body * 1.25;
  // font ids are per page in many PDFs, so find the body font page by page
  const pageFont = new Map();
  for (const l of bodyLines) {
    if (!l.font) continue;
    const m = pageFont.get(l.page) || new Map();
    m.set(l.font, (m.get(l.font) || 0) + l.text.length);
    pageFont.set(l.page, m);
  }
  const bodyFontOf = (pg) => {
    const m = pageFont.get(pg);
    return m && [...m].sort((a, b) => b[1] - a[1])[0][0];
  };
  // A short line in another font (bold), between finished sentences, is a subheading.
  const isSub = (i) => {
    const l = lines[i];
    const prev = lines[i - 1];
    const next = lines[i + 1];
    const bodyFont = bodyFontOf(l.page);
    return (
      !!bodyFont && !!l.font && l.font !== bodyFont && (!next || next.font === bodyFont) && Math.abs(l.size - body) < body * 0.25 &&
      l.text.length < 60 && letters(l.text).length >= 3 && !endsSentence(l.text) && !/[,;:-]$/.test(l.text) &&
      (!prev || endsSentence(prev.text) || prev.font === l.font) && (!next || /^[\p{Lu}“"‘']/u.test(next.text))
    );
  };

  const blocks = [];
  let cur = null;
  const flush = () => {
    if (cur && cur.text.trim()) blocks.push(cur);
    cur = null;
  };

  for (let i = 0; i < lines.length; i++) {
    const l = lines[i];
    const prev = lines[i - 1];
    const big = l.size > body * (l.ocr ? 1.4 : 1.18);
    const caps = isCaps(l.text) && l.text.length < 70;
    const type = big || caps || isSub(i) ? 'h' : 'p';
    let brk = !cur || cur.type !== type;
    if (!brk && prev) {
      const samePage = prev.page === l.page;
      const flowing = !samePage || l.colStart || prev.y < l.y;
      if (!flowing) {
        const expected = type === 'h' ? Math.max(lineGap, l.size * 1.3) : lineGap;
        if (prev.y - l.y > expected * 1.45) brk = true;
      }
      // lines lifted out of the columns (pull quotes) never share a block with column text
      if (!!l.aside !== !!prev.aside) brk = true;
      // a switch to another typeface (bold caption under a photo) starts a new block
      if (!l.ocr && !prev.ocr && l.font && prev.font && l.font !== prev.font && l.text.length > 3) brk = true;
      if (Math.abs(l.size - prev.size) > (l.ocr ? Math.max(body * 0.3, Math.min(l.size, prev.size) * 0.3) : body * 0.12)) brk = true;
      // first-line indent (relative to the previous line in the same column)
      if (!brk && type === 'p' && !flowing && l.x - prev.x > body * 0.6 && endsSentence(prev.text)) brk = true;
      // column / page change: new paragraph only if the sentence ended and the line is indented or a gap exists
      if (!brk && type === 'p' && flowing && endsSentence(prev.text) && /^[\p{Lu}“"‘']/u.test(l.text)) {
        const colLines = lines.filter((o) => o.page === l.page && Math.abs(o.x - l.x) < body * 3 && o !== l);
        const minX = colLines.length ? Math.min(...colLines.map((o) => o.x)) : l.x;
        if (l.x - minX > body * 0.6) brk = true;
      }
    }
    if (brk) {
      flush();
      cur = { type, text: '', size: l.size, page: l.page, sizes: [], font: l.font, aside: !!l.aside };
    }
    cur.text = joinText(cur.text, l.text);
    cur.sizes.push(l.size);
  }
  flush();

  // A "heading" with many words is a lead paragraph set in a bigger font.
  for (const b of blocks) if (b.type === 'h' && b.text.split(/\s+/).length > 28) b.type = 'p';

  // Glue a paragraph to the next when it clearly stops mid-sentence. Up to
  // three short headings in between (pull quotes, bylines placed mid-column)
  // are moved after the joined paragraph.
  const merged = [];
  for (const b of blocks) {
    let k = merged.length - 1;
    // headings and captions (short text set smaller than the body) can sit in the
    // middle of a sentence that runs on in the next column; look past them
    const aside = (x) =>
      x.type === 'h' || x.aside || (x.text.length < 300 && endsSentence(x.text) && /^[\p{Lu}"“‘']/u.test(x.text)) || (x.text.length < 400 && (median(x.sizes) < body * 0.88 || (!!x.font && !!bodyFontOf(x.page) && x.font !== bodyFontOf(x.page))));
    while (k >= 0 && merged.length - 1 - k < 3 && aside(merged[k])) k--;
    const last = merged[k];
    if (last && last.type === 'p' && b.type === 'p' && !endsSentence(last.text) && !/[:;]$/.test(last.text) && /^\p{Ll}/u.test(b.text)) {
      last.text = joinText(last.text, b.text);
      // anything between stays where it was, now after the paragraph
    } else merged.push({ ...b });
  }
  return { blocks: merged, body };
}

// Text from fonts without a Unicode map comes out as symbol soup; drop it.
function looksGarbled(text) {
  const sym = (text.match(/[\[\]\\^`{}|<>=~_]/g) || []).length;
  const words = text.split(/\s+/);
  const avg = text.replace(/\s+/g, '').length / words.length;
  const vowels = (text.match(/[aeiouyAEIOUY]/g) || []).length / (letters(text).length || 1);
  return sym / text.length > 0.04 || avg > 14 || vowels < 0.22;
}

/* ---------- Apple Vision OCR (macOS) ---------- */

const VISION_BIN = process.env.VISION_OCR || fileURLToPath(new URL('./bin/vision-ocr', import.meta.url));
export const hasVision = () => process.platform === 'darwin' && existsSync(VISION_BIN);

// Runs the Vision tool over the whole PDF once; returns Map(page -> raw lines).
async function visionOcr(data, opts) {
  let file = opts.path;
  let tmp = null;
  if (!file) {
    tmp = path.join(os.tmpdir(), `a365-${process.pid}-${Date.now()}.pdf`);
    await fsp.writeFile(tmp, Buffer.from(data));
    file = tmp;
  }
  try {
    // Vision very occasionally stalls; give each run a deadline and try again
    const run = () =>
      new Promise((ok, fail) =>
        execFile(VISION_BIN, opts.forceOcr ? [file, '--all'] : [file], { maxBuffer: 256 * 1024 * 1024, timeout: (opts.visionTimeout || 25) * 1000 * Math.max(1, opts.pages || 4) }, (err, stdout) =>
          err ? fail(err) : ok(stdout),
        ),
      );
    let out;
    for (let attempt = 1; ; attempt++) {
      try {
        out = await run();
        break;
      } catch (e) {
        if (attempt >= 3) throw e;
      }
    }
    const pages = new Map();
    for (const row of out.split('\n')) if (row.trim()) {
      const p = JSON.parse(row);
      pages.set(p.page, p.lines);
    }
    return pages;
  } finally {
    if (tmp) fsp.rm(tmp, { force: true });
  }
}

// Vision occasionally reads straight across a narrow gutter, so one "line"
// holds two columns. Word boxes show it: split wherever the space between two
// words is far wider than a word space.
function splitAtGutters(r) {
  const parts = r.text.split(/ +/).filter(Boolean);
  const wb = r.words || [];
  if (parts.length < 2 || wb.length !== parts.length || wb.some((b) => b.length !== 2)) return [r];
  const out = [];
  let start = 0;
  for (let i = 1; i <= parts.length; i++) {
    if (i < parts.length && wb[i][0] - wb[i - 1][1] < r.h * 0.75) continue;
    out.push({ ...r, x: wb[start][0], w: wb[i - 1][1] - wb[start][0], text: parts.slice(start, i).join(' '), words: wb.slice(start, i) });
    start = i;
  }
  return out;
}

// Vision lines -> the line objects the rest of the pipeline uses.
// lines.caps collects drop-cap candidates: a tall scrap of 1-3 characters
// sitting just left of a line that starts mid-word ("o, Mr Albert").
function visionPageLines(raw, pageNo, view) {
  const H = view[3] - view[1];
  const lines = [];
  const scraps = [];
  for (const r of (raw || []).flatMap(splitAtGutters)) {
    const text = r.text.replace(/\s+/g, ' ').trim();
    if (text && text.length <= 3 && !/^\d+$/.test(text)) scraps.push(r);
    if (!text || r.conf < 0.3) continue;
    // a box taller than wide with several letters is vertical text: a photo credit
    if (r.h > r.w * 1.5 && text.length > 2) continue;
    // Box heights swing ±30% with ascenders/descenders, average glyph width
    // doesn't, so a line's font size is the smaller of the two estimates.
    const size = Math.min(r.h, (r.w / text.length) * 2);
    lines.push((r.line = { page: pageNo, x: r.x, xEnd: r.x + r.w, y: r.y, h: r.h, size, text, ocr: true }));
  }
  const body = median(lines.map((l) => l.size)) || 10;
  const out = lines.filter(
    (l) => !WATERMARK.test(l.text) && !((l.y < H * 0.04 || l.y + l.h > H * 0.965) && l.text.length < 90) && !/^[\s\d|•·.-]{1,4}$/.test(l.text),
  );
  out.caps = [];
  for (const c of scraps) {
    const next = out
      .filter((l) => l.text.length > 8 && /^[\p{Ll}'’]|^\p{L}{1,2}[,.' ]/u.test(l.text) && l.x > c.x + c.w * 0.5 && l.x - (c.x + c.w) < body * 6 && l.y >= c.y - body && l.y <= c.y + c.h + body * 3)
      .sort((a, b) => b.y - a.y)[0];
    if (!next) continue;
    out.caps.push({ line: next, x0: Math.max(0, c.x - body), x1: next.x - 1, top: next.y + next.h + body * 0.5, bottom: next.y - body * 7 });
    // the scrap was Vision's guess at the big letter; it isn't text
    const i = out.indexOf(c.line);
    if (i >= 0) out.splice(i, 1);
  }
  return out;
}

// Reads one drop-cap letter: renders that corner of the page and asks
// tesseract for a single capital. Returns '' when unsure.
async function readDropCap(doc, page, cap, opts) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = 4;
  const vp = page.getViewport({ scale });
  const W = Math.ceil((cap.x1 - cap.x0) * scale);
  const Hh = Math.ceil((cap.top - cap.bottom) * scale);
  if (W < 8 || Hh < 8) return '';
  const { canvas, context } = doc.canvasFactory.create(W, Hh);
  context.fillStyle = '#fff';
  context.fillRect(0, 0, W, Hh);
  // shift the page so the crop's top-left lands at the canvas origin
  const tx = -cap.x0 * scale;
  const ty = -(vp1.height - cap.top) * scale;
  await page.render({ canvasContext: context, viewport: vp, canvas, transform: [1, 0, 0, 1, tx, ty] }).promise;
  const png = canvas.toBuffer('image/png');
  doc.canvasFactory.destroy({ canvas, context });
  const worker = await getOcr(opts);
  await worker.setParameters({ tessedit_pageseg_mode: '10', tessedit_char_whitelist: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ' });
  try {
    const { data } = await worker.recognize(png);
    const ch = data.text.trim();
    return /^[A-Z]$/.test(ch) && data.confidence > 40 ? ch : '';
  } finally {
    await worker.setParameters({ tessedit_pageseg_mode: '3', tessedit_char_whitelist: '' });
  }
}

// Letter-bigram (Dice) similarity of two strings, ignoring case, spaces and punctuation.
function similar(a, b) {
  const grams = (t) => {
    const n = t.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
    const m = new Map();
    for (let i = 1; i < n.length; i++) m.set(n.slice(i - 1, i + 1), (m.get(n.slice(i - 1, i + 1)) || 0) + 1);
    return [m, Math.max(0, n.length - 1)];
  };
  const [ga, na] = grams(a);
  const [gb, nb] = grams(b);
  if (!na || !nb) return 0;
  let common = 0;
  for (const [k, c] of ga) common += Math.min(c, gb.get(k) || 0);
  return (2 * common) / (na + nb);
}

// Text layers often drop the space between words ("isnormally"). When the
// letters of both versions agree, copy Vision's word breaks into the text-layer
// text (which keeps its exact punctuation and quotes).
function mergeSpaces(t, v) {
  const alnum = (c) => /[\p{L}\p{N}]/u.test(c);
  const key = (x) => [...x].filter(alnum).join('').toLowerCase();
  if (key(t) !== key(v)) return t;
  let out = '';
  let j = 0;
  for (const ch of t) {
    if (!alnum(ch)) {
      out += ch;
      continue;
    }
    let gap = false;
    while (j < v.length && !alnum(v[j])) gap = gap || v[j] === ' ', j++;
    if (gap && out && alnum(out[out.length - 1])) out += ' ';
    out += ch;
    j++;
  }
  return out;
}

// Pages with a text layer: Vision decides the lines and their order, the text
// layer supplies the exact words, font and size wherever it agrees with what
// Vision read (fonts without a Unicode map give gibberish, so Vision's text
// stays there). Returns the share of text-layer characters that found a line.
function fillFromTextLayer(lines, frags, view) {
  const owner = new Map(lines.map((l) => [l, []]));
  let total = 0;
  let placed = 0;
  for (const f of frags) {
    const n = f.str.trim().length;
    total += n;
    const cx = f.x - view[0] + f.w / 2;
    const cy = f.y - view[1] + f.size * 0.3;
    let best = null;
    let dist = Infinity;
    for (const l of lines) {
      if (cx < l.x - 2 || cx > l.xEnd + 2 || cy < l.y - l.h * 0.25 || cy > l.y + l.h * 1.15) continue;
      const d = Math.abs(cy - (l.y + l.h / 2));
      if (d < dist) ((dist = d), (best = l));
    }
    if (best) (owner.get(best).push({ ...f, x: f.x - view[0] }), (placed += n));
  }
  for (const [l, fs] of owner) {
    if (!fs.length) continue;
    fs.sort((a, b) => a.x - b.x);
    const t = lineText(fs);
    if (similar(t, l.text) < 0.55) continue;
    // letter-spaced display type ("T H I N K") comes out of the text layer with a
    // space per letter; Vision reads the words, so its text wins there
    const spaced = (x) => {
      const w = x.split(/\s+/);
      return w.filter((y) => /^\p{L}$/u.test(y)).length / w.length;
    };
    if (!(spaced(t) > 0.35 && spaced(l.text) < 0.2)) l.text = mergeSpaces(t, l.text);
    l.size = median(fs.map((f) => f.size));
    const fonts = new Map();
    for (const f of fs) if (f.font) fonts.set(f.font, (fonts.get(f.font) || 0) + f.str.length);
    l.font = [...fonts].sort((a, b) => b[1] - a[1])[0]?.[0];
    l.ocr = false;
  }
  return total ? placed / total : 1;
}

// Recursive XY-cut: split the page at the widest blank band. Big horizontal
// gaps (sections) first, then vertical gutters (columns), then any horizontal
// gap; each piece is read top to bottom, left to right.
function xyCut(lines) {
  if (lines.length < 2) return lines;
  const hs = median(lines.map((l) => l.h)) || 10;
  const gapsOf = (iv) => {
    iv.sort((a, b) => a[0] - b[0]);
    const out = [];
    let end = iv[0][1];
    for (const [s, e] of iv.slice(1)) {
      if (s > end) out.push([end, s]);
      end = Math.max(end, e);
    }
    return out;
  };
  const widest = (g, min) => g.filter(([a, b]) => b - a >= min).sort((p, q) => q[1] - q[0] - (p[1] - p[0]))[0];
  const leaves = [];
  const rec = (ls) => {
    if (ls.length > 1) {
      const hg = gapsOf(ls.map((l) => [l.y, l.y + l.h]));
      const vg = gapsOf(ls.map((l) => [l.x, l.xEnd]));
      let c = widest(hg, hs * 2.2);
      if (c) return (rec(ls.filter((l) => l.y >= c[1])), rec(ls.filter((l) => l.y < c[1])));
      // lines never overlap a gutter, so even a narrow vertical gap is a column break
      const gut = Math.max(2.5, hs * 0.25);
      c = widest(vg, gut);
      if (c) return (rec(ls.filter((l) => l.xEnd <= c[0])), rec(ls.filter((l) => l.xEnd > c[0])));
      // A pull quote or caption laid across two columns hides the gutter. Find
      // x-bands crossed by only a few lines with plenty of text on both sides,
      // read the columns without those lines, then put them after this part.
      const x0 = Math.floor(Math.min(...ls.map((l) => l.x)));
      const x1 = Math.ceil(Math.max(...ls.map((l) => l.xEnd)));
      const limit = Math.max(3, Math.floor(ls.length * 0.08));
      const cover = new Array(x1 - x0 + 1).fill(0);
      for (const l of ls) for (let x = Math.ceil(l.x); x <= Math.floor(l.xEnd); x++) cover[x - x0]++;
      const bands = [];
      for (let i = 0; i < cover.length; ) {
        if (cover[i] > limit) {
          i++;
          continue;
        }
        let j = i;
        while (j + 1 < cover.length && cover[j + 1] <= limit) j++;
        const a = x0 + i;
        const b = x0 + j;
        const leftN = ls.filter((l) => l.xEnd <= a + 1).length;
        const rightN = ls.filter((l) => l.x >= b - 1).length;
        if (b - a >= gut && leftN >= 3 && rightN >= 3) bands.push([a, b, Math.max(...cover.slice(i, j + 1))]);
        i = j + 1;
      }
      bands.sort((p, q) => p[2] - q[2] || q[1] - q[0] - (p[1] - p[0]));
      for (const [a, b] of bands) {
        const across = ls.filter((l) => l.x < a && l.xEnd > b);
        if (!across.length) continue;
        rec(ls.filter((l) => !across.includes(l)));
        for (const l of across) l.aside = true;
        leaves.push(across.sort((p, q) => q.y - p.y || p.x - q.x));
        return;
      }
      c = widest(hg, hs * 0.6);
      if (c) return (rec(ls.filter((l) => l.y >= c[1])), rec(ls.filter((l) => l.y < c[1])));
    }
    leaves.push(ls.sort((a, b) => b.y - a.y || a.x - b.x));
  };
  rec(lines);
  const out = [];
  for (const leaf of leaves)
    leaf.forEach((l, i) => {
      // a new piece that starts higher up than where the last one ended is a column jump
      l.colStart = i === 0 && out.length > 0 && l.y > out[out.length - 1].y;
      out.push(l);
    });
  return out;
}

let ocrWorker = null;
async function getOcr(opts) {
  if (!ocrWorker) {
    const { createWorker } = await import('tesseract.js');
    const { createRequire } = await import('node:module');
    const require = createRequire(import.meta.url);
    const langPath = require('node:path').join(require.resolve('@tesseract.js-data/eng/package.json'), '..', '4.0.0_best_int');
    ocrWorker = await createWorker('eng', 1, { langPath, gzip: true, cachePath: opts.cachePath, cacheMethod: opts.cachePath ? 'write' : 'none' });
    await ocrWorker.setParameters({ tessedit_pageseg_mode: '3' });
  }
  return ocrWorker;
}

export async function stopOcr() {
  if (ocrWorker) await ocrWorker.terminate().catch(() => {});
  ocrWorker = null;
}

// Renders a scanned page and turns OCR words into the same fragments the
// text layer produces (PDF units, y measured from the bottom).
async function ocrPage(doc, page, opts) {
  const vp1 = page.getViewport({ scale: 1 });
  const scale = Math.min(4, 2200 / vp1.width);
  const vp = page.getViewport({ scale });
  const { canvas, context } = doc.canvasFactory.create(Math.ceil(vp.width), Math.ceil(vp.height));
  context.fillStyle = '#fff';
  context.fillRect(0, 0, canvas.width, canvas.height);
  await page.render({ canvasContext: context, viewport: vp, canvas }).promise;
  const png = canvas.toBuffer('image/png');
  doc.canvasFactory.destroy({ canvas, context });
  const worker = await getOcr(opts);
  const { data } = await worker.recognize(png, {}, { blocks: true });
  const H = vp1.height;
  const frags = [];
  for (const b of data.blocks || [])
    for (const p of b.paragraphs)
      for (const l of p.lines) {
        if (l.confidence < 55) continue;
        const base = l.baseline && l.baseline.y0 ? (l.baseline.y0 + l.baseline.y1) / 2 : l.bbox.y1;
        const tops = l.words.map((w) => w.bbox.y0);
        const size = Math.max(4, (base - median(tops)) / scale) * 1.35;
        for (const w of l.words) {
          if (w.confidence < 50 || !w.text.trim()) continue;
          const h = w.bbox.y1 - w.bbox.y0;
          const isCap = /^[A-Z]$/.test(w.text.trim()) && h > (base - median(tops)) * 2.2;
          frags.push({
            x: w.bbox.x0 / scale,
            y: H - (isCap ? w.bbox.y1 : base) / scale,
            w: (w.bbox.x1 - w.bbox.x0) / scale,
            size: isCap ? (h / scale) * 1.35 : size,
            str: w.text,
            word: true,
          });
        }
      }
  return frags;
}

export async function extractPdf(data, opts = {}) {
  const doc = await getDocument({
    data: new Uint8Array(data),
    isEvalSupported: false,
    disableFontFace: true,
    verbosity: 0,
  }).promise;
  const pages = [];
  const xy = []; // pages whose lines came from Vision get XY-cut ordering
  let ocrPages = 0;
  // With Vision every page is read by it once (it is fast); scanned pages use
  // its text, text-layer pages use it for layout only.
  const useVision = opts.vision !== false && opts.ocr !== false && hasVision();
  const vision = useVision ? await visionOcr(data, { ...opts, forceOcr: true, pages: doc.numPages }).catch(() => null) : null;
  for (let n = 1; n <= doc.numPages; n++) {
    const page = await doc.getPage(n);
    const tc = await page.getTextContent();
    let frags = textItemsToFrags(tc.items);
    const chars = frags.reduce((c, f) => c + f.str.trim().length, 0);
    const scanned = chars < 40 || opts.forceOcr;
    if (vision) {
      if (scanned) (opts.onPage?.(n, doc.numPages), ocrPages++);
      const ls = visionPageLines(vision.get(n), n, page.view);
      const covered = scanned ? 1 : fillFromTextLayer(ls, frags, page.view);
      if (covered < 0.8) {
        // Vision missed too much of this page's real text: fall back to the text layer alone
        pages.push(pageLines(frags, n, page.view, { ocr: false }));
        xy.push(false);
      } else {
        for (const cap of ls.caps) {
          // a text layer usually has the big letter itself; otherwise read it off the image
          const big = frags.find((f) => /^[A-Z]$/.test(f.str.trim()) && f.x - page.view[0] >= cap.x0 - 2 && f.x - page.view[0] <= cap.x1 && f.y - page.view[1] <= cap.top && f.y - page.view[1] >= cap.bottom);
          const ch = big ? big.str.trim() : await readDropCap(doc, page, cap, opts).catch(() => '');
          if (ch && !cap.line.text.startsWith(ch)) cap.line.text = ch + cap.line.text;
        }
        pages.push(ls);
        xy.push(true);
      }
    } else if (scanned && opts.ocr !== false) {
      opts.onPage?.(n, doc.numPages);
      ocrPages++;
      frags = await ocrPage(doc, page, opts);
      pages.push(pageLines(frags, n, page.view, { ocr: true }));
      xy.push(false);
    } else {
      pages.push(pageLines(frags, n, page.view, { ocr: false }));
      xy.push(false);
    }
    page.cleanup();
  }
  let info = {};
  try {
    info = (await doc.getMetadata()).info || {};
  } catch {}
  const numPages = doc.numPages;
  await doc.destroy();

  const lines = dropRunningHeads(pages).flatMap((ls, i) => (xy[i] ? xyCut(ls) : orderPage(ls)));
  const { blocks: raw, body } = linesToBlocks(lines);
  const blocks = raw.filter((b) => !looksGarbled(b.text));
  for (const b of blocks) b.text = tidy(b.text);

  // Title: the biggest heading on the first pages.
  let title = '';
  const heads = blocks.filter((b) => b.type === 'h' && b.page <= 2 && b.size >= (body || 0) * 1.4 && letters(b.text).length > 3 && b.text.length < 160 && !/^(by|words|writing|photo|illustrat)/i.test(b.text) && !/^(in focus|cover story|feature)$/i.test(b.text));
  if (heads.length) {
    // big display titles are often split over several lines/blocks ("MONEYSAVING / DO'S / AND")
    const top = heads.reduce((a, b) => (b.size > a.size ? b : a));
    let i = blocks.indexOf(top);
    let j = i;
    const fits = (b) => b && b.type === 'h' && b.page === top.page && b.size >= top.size * 0.55 && b.text.length < 80;
    while (fits(blocks[i - 1])) i--;
    while (fits(blocks[j + 1])) j++;
    title = blocks.slice(i, j + 1).map((b) => b.text).join(' ');
  }
  if (!title && info.Title && !/^(untitled|microsoft|adobe)/i.test(info.Title)) title = String(info.Title).trim();
  const out = blocks.map(({ type, text }) => ({ type, text }));
  const words = out.reduce((n, b) => n + b.text.split(/\s+/).length, 0);
  return { title, blocks: out, numPages, words, ocrPages, vision: !!vision };
}

function tidy(t) {
  return t
    .replace(/([a-z]{2,}[,;:])(?=[A-Za-z])/g, '$1 ')
    .replace(/([a-z]{3,}\.)(?=[A-Z][a-z])/g, '$1 ')
    .replace(/\s+([,.;:!?])(?=\s|$)/g, '$1')
    .replace(/\s{2,}/g, ' ')
    .trim();
}
