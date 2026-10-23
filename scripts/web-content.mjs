// The articles the web version ships with (web/content/data.json, kept out of the repository):
// the PDF articles of this computer's library, as the desktop app extracted them. Guardian
// articles saved on the desktop are left out. Only reads the library.
//   node scripts/web-content.mjs [path to the app's data folder]
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const home = os.homedir();
const DATA = process.argv[2] || (process.platform === 'darwin'
  ? path.join(home, 'Library', 'Application Support', '365 Articles Reader')
  : process.platform === 'win32' ? path.join(process.env.APPDATA || '', '365 Articles Reader') : path.join(home, '.config', '365 Articles Reader'));

const index = JSON.parse(fs.readFileSync(path.join(DATA, 'index.json'), 'utf8'));
const out = [];
for (const m of index) {
  if (m.kind && m.kind !== 'pdf') continue;
  let a;
  try {
    a = JSON.parse(fs.readFileSync(path.join(DATA, 'library', m.id + '.json'), 'utf8'));
  } catch {
    continue;
  }
  out.push({ id: m.id, title: m.title, file: m.file, excerpt: m.excerpt, words: m.words, pages: m.pages, addedAt: m.addedAt, rev: m.rev || 1, blocks: a.blocks.map(({ type, text }) => ({ type, text })) });
}
fs.mkdirSync(path.join(ROOT, 'web', 'content'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'web', 'content', 'data.json'), JSON.stringify(out));
console.log(`web/content/data.json: ${out.length} articles`);
