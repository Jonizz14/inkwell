// Generates build/icon.png (1024×1024), the Inkwell mark: a serif "i" with a round dot,
// white on a near-black rounded square. Black and white like the app. The serif comes from the
// system (Iowan Old Style on a Mac); the PNG is committed, so other machines needn't have it.
// `node scripts/make-icon.mjs [out.png]`
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const S = 1024;
const m = 100; // macOS icon grid: an 824 px tile
const r = 186;
const cx = S / 2;
const c = createCanvas(S, S);
const g = c.getContext('2d');

const bg = g.createLinearGradient(0, m, 0, S - m);
bg.addColorStop(0, '#1d1d1d');
bg.addColorStop(1, '#0a0a0a');
g.fillStyle = bg;
g.beginPath();
g.roundRect(m, m, S - 2 * m, S - 2 * m, r);
g.fill();
g.strokeStyle = 'rgba(255,255,255,0.07)';
g.lineWidth = 3;
g.beginPath();
g.roundRect(m + 1.5, m + 1.5, S - 2 * m - 3, S - 2 * m - 3, r - 1.5);
g.stroke();

// the dotless i, in the reading serif
g.fillStyle = '#fff';
g.font = '600 600px "Iowan Old Style", "Charter", Georgia, serif';
g.textAlign = 'center';
g.textBaseline = 'alphabetic';
g.fillText('ı', cx, 790);

// its dot: round, set where the serif's own dot would be
g.beginPath();
g.arc(cx - 2, 350, 58, 0, Math.PI * 2);
g.fill();

const out = process.argv[2] ? process.argv[2] : new URL('../build/icon.png', import.meta.url);
writeFileSync(out, c.toBuffer('image/png'));
