#!/usr/bin/env node
/**
 * Pre-indexes all PDFs from ~/Documents/Inkwell into the app's userData
 * so the app opens instantly without re-processing.
 * Run: node scripts/preindex.mjs
 */
import fs from 'node:fs';
import fsp from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import os from 'node:os';
import { extractPdf, stopOcr } from '../src/extract.mjs';

const INBOX   = path.join(os.homedir(), 'Documents', 'Inkwell');
const DATA    = [path.join(os.homedir(), 'Library', 'Application Support', 'Inkwell'), path.join(os.homedir(), 'Library', 'Application Support', '365 Articles Reader')].find((d) => fs.existsSync(d)) || path.join(os.homedir(), 'Library', 'Application Support', 'Inkwell');
const LIB     = path.join(DATA, 'library');
const INDEX_F = path.join(DATA, 'index.json');

async function readJson(f, fb) {
  try { return JSON.parse(await fsp.readFile(f, 'utf8')); }
  catch { return fb; }
}

async function writeJson(f, v) {
  const tmp = f + '.tmp';
  await fsp.writeFile(tmp, JSON.stringify(v));
  await fsp.rename(tmp, f);
}

function cleanName(file) {
  return path.basename(file, path.extname(file))
    .replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

async function walkPdfs(dir, out = []) {
  let entries = [];
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return out; }
  for (const e of entries) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) await walkPdfs(p, out);
    else if (/\.pdf$/i.test(e.name)) out.push(p);
  }
  return out;
}

const start = Date.now();
await fsp.mkdir(LIB, { recursive: true });

const files  = await walkPdfs(INBOX);
const index  = await readJson(INDEX_F, []);
const known  = new Set(index.map(a => a.id));
const knownF = new Map(index.map(a => [a.src, a.size]));

console.log(`\n📚 ${files.length} ta PDF topildi — ${index.length} tasi allaqachon indexed\n`);

let added = 0, skipped = 0, failed = 0;

for (let i = 0; i < files.length; i++) {
  const file = files[i];
  const name = path.basename(file);
  const pct  = `[${String(i+1).padStart(3)}/${files.length}]`;

  try {
    const st = await fsp.stat(file);
    if (knownF.get(file) === st.size) {
      process.stdout.write(`\r${pct} ↩  ${name.slice(0, 50)}`);
      skipped++;
      continue;
    }

    const buf = await fsp.readFile(file);
    const id  = crypto.createHash('sha1').update(buf).digest('hex').slice(0, 16);
    if (known.has(id)) {
      skipped++;
      process.stdout.write(`\r${pct} ↩  ${name.slice(0, 50)}`);
      continue;
    }

    process.stdout.write(`\r${pct} ⚙  ${name.slice(0, 50)}                    `);

    const result = await extractPdf(buf, {
      cachePath: path.join(DATA, 'ocr-cache'),
      onPage: (n, total) =>
        process.stdout.write(`\r${pct} 🔍 OCR ${n}/${total}  ${name.slice(0, 40)}          `),
    });

    await fsp.writeFile(path.join(LIB, id + '.pdf'), buf);
    await writeJson(path.join(LIB, id + '.json'), result);

    const first = result.blocks.find(b => b.type === 'p' && b.text.length > 80)
               || result.blocks.find(b => b.type === 'p');
    index.push({
      id,
      title:   result.title || cleanName(file),
      file:    name,
      src:     file,
      size:    st.size,
      excerpt: first ? first.text.slice(0, 220) : '',
      words:   result.words,
      pages:   result.numPages,
      ocrPages: result.ocrPages,
      addedAt: Date.now(),
    });
    known.add(id);
    await writeJson(INDEX_F, index);

    const mins  = ((Date.now() - start) / 1000 / 60).toFixed(1);
    const rate  = ((i + 1) / (Date.now() - start) * 1000 * 60).toFixed(1);
    const left  = ((files.length - i - 1) / rate).toFixed(0);
    console.log(`\r${pct} ✓  ${name.slice(0, 45).padEnd(47)} ${result.numPages}p  ${mins}min ÷ ~${left}min qoldi`);
    added++;

  } catch (err) {
    console.log(`\r${pct} ✗  ${name.slice(0, 50)}: ${err.message}`);
    failed++;
  }
}

await stopOcr();

const elapsed = ((Date.now() - start) / 1000 / 60).toFixed(1);
console.log(`\n✅ Tayyor! ${added} ta yangi | ${skipped} ta skip | ${failed} ta xato — ${elapsed} min`);
console.log(`📂 Library: ${LIB}`);
