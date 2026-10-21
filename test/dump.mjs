import { readFileSync } from 'node:fs';
import { extractPdf, stopOcr } from '../src/extract.mjs';
const r = await extractPdf(readFileSync(process.argv[2]));
console.log('TITLE:', r.title, '| pages', r.numPages, '| words', r.words, '| blocks', r.blocks.length);
for (const b of r.blocks) console.log(`[${b.type}] ${b.text}`);
await stopOcr();
