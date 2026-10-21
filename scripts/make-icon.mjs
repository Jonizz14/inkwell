// Generates build/icon.png (1024x1024): black rounded square with a white pilcrow.
import { createCanvas } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';
const S = 1024;
const c = createCanvas(S, S);
const g = c.getContext('2d');
const r = 220, m = 100;
g.fillStyle = '#111';
g.beginPath();
g.roundRect(m, m, S - 2 * m, S - 2 * m, r);
g.fill();
g.fillStyle = '#fff';
g.font = 'bold 560px serif';
g.textAlign = 'center';
g.textBaseline = 'middle';
g.fillText("¶", S / 2, S / 2 - 10);
g.fillStyle = 'rgba(255,255,255,0.35)';
g.fillRect(S / 2 - 150, 840, 300, 10);
writeFileSync(new URL('../build/icon.png', import.meta.url), c.toBuffer('image/png'));
