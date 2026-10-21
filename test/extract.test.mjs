import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { extractPdf } from '../src/extract.mjs';

const r = await extractPdf(readFileSync(new URL('./fixtures/sample.pdf', import.meta.url)));
for (const b of r.blocks) console.log(`[${b.type}] ${b.text.slice(0, 90)}…`);
assert.equal(r.title, 'Every drop counts: cities learn to listen to their pipes');
const ps = r.blocks.filter((b) => b.type === 'p');
assert.equal(ps.length, 24, 'paragraph count');
assert.ok(ps.every((p) => !/ECONOMIST/.test(p.text)), 'running header removed');
assert.ok(ps.every((p) => !/^\d+$/.test(p.text)), 'page numbers removed');
assert.ok(ps[0].text.endsWith('within hours.'));
console.log('ok', r.numPages, 'pages', r.words, 'words');
