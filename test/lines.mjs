import { readFileSync } from 'node:fs';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const doc = await getDocument({ data: new Uint8Array(readFileSync(process.argv[2])), verbosity: 0 }).promise;
const pn = +process.argv[3] || 2;
const page = await doc.getPage(pn);
console.log(page.view);
const tc = await page.getTextContent();
for (const it of tc.items.slice(0, +process.argv[4] || 60)) console.log(it.transform.map(n=>n.toFixed(1)).join(','), it.width.toFixed(1), it.fontName, it.hasEOL?'EOL':'', JSON.stringify(it.str));
