#!/usr/bin/env node
/**
 * Re-extracts every article already in the Mac app's library with the current
 * extractor (Vision OCR for scanned pages) and moves highlights, vocabulary
 * and paragraph notes onto the new text.
 *
 *   node scripts/reextract.mjs --out <dir>   write new <id>.json files to <dir> only (dry run)
 *   node scripts/reextract.mjs --apply       replace the library, update index.json and notes.json
 *   ... [--only id1,id2]                     limit to some articles
 *   ... --apply --from <dir>                 apply results of an earlier --out run instead of extracting again
 *
 * Run it with the app closed; --apply keeps a backup next to the data folder.
 */
import fsp from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { extractPdf, stopOcr } from '../src/extract.mjs';
import { migrateRecord } from '../src/migrate.mjs';

const DATA = path.join(os.homedir(), 'Library', 'Application Support', '365 Articles Reader');
const LIB = path.join(DATA, 'library');
const arg = (k) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : null;
};
const apply = process.argv.includes('--apply');
const outDir = apply ? LIB : arg('--out');
if (!outDir) {
  console.error('usage: reextract.mjs --out <dir> | --apply [--only ids]');
  process.exit(1);
}
const only = arg('--only') ? new Set(arg('--only').split(',')) : null;
const from = arg('--from');

const readJson = async (f) => JSON.parse(await fsp.readFile(f, 'utf8'));
const writeJson = async (f, v) => {
  await fsp.writeFile(f + '.tmp', JSON.stringify(v));
  await fsp.rename(f + '.tmp', f);
};

const index = await readJson(path.join(DATA, 'index.json'));
const notes = await readJson(path.join(DATA, 'notes.json'));
if (apply) {
  const bak = path.join(DATA, '..', `365 Articles Reader backup ${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}`);
  await fsp.mkdir(bak, { recursive: true });
  await fsp.copyFile(path.join(DATA, 'index.json'), path.join(bak, 'index.json'));
  await fsp.copyFile(path.join(DATA, 'notes.json'), path.join(bak, 'notes.json'));
  for (const a of index) await fsp.copyFile(path.join(LIB, a.id + '.json'), path.join(bak, a.id + '.json')).catch(() => {});
  console.log('backup:', bak);
}
await fsp.mkdir(outDir, { recursive: true });

let n = 0;
const lost = [];
for (const a of index) {
  if (only && !only.has(a.id)) continue;
  n++;
  const pdf = path.join(LIB, a.id + '.pdf');
  const t0 = Date.now();
  const old = await readJson(path.join(LIB, a.id + '.json')).catch(() => null);
  const res = from ? await readJson(path.join(from, a.id + '.json')) : await extractPdf(await fsp.readFile(pdf), { path: pdf });
  await writeJson(path.join(outDir, a.id + '.json'), res);
  process.stdout.write(`[${String(n).padStart(3)}] ${a.id} ${res.words}w (was ${old ? old.words : '?'}) ${((Date.now() - t0) / 1000).toFixed(1)}s${res.vision ? '' : ' [NO VISION]'}  ${a.title.slice(0, 50)}\n`);
  if (!apply) continue;
  const first = res.blocks.find((b) => b.type === 'p' && b.text.length > 80) || res.blocks.find((b) => b.type === 'p');
  a.excerpt = first ? first.text.slice(0, 220) : '';
  a.words = res.words;
  a.ocrPages = res.ocrPages;
  a.rev = 2; // tells the web version its stored copy is stale
  const r = notes.articles[a.id];
  if (r && old) {
    const report = migrateRecord(r, old.blocks, res.blocks);
    if (report.lost.length) lost.push({ id: a.id, title: a.title, lost: report.lost });
  }
}
if (apply) {
  await writeJson(path.join(DATA, 'index.json'), index);
  await writeJson(path.join(DATA, 'notes.json'), notes);
  console.log(lost.length ? `highlights that could not be placed: ${JSON.stringify(lost, null, 1)}` : 'all highlights moved');
}
await stopOcr();
