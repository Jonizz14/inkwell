// Generates build/icon.png (1024×1024), the Inkwell mark: a fountain-pen nib in white on a
// near-black rounded square, with its slit and breather hole cut through, and one drop of ink
// at the tip. Black and white like the app. `node scripts/make-icon.mjs [out.png]`
import { createCanvas, Path2D } from '@napi-rs/canvas';
import { writeFileSync } from 'node:fs';

const S = 1024;
const c = createCanvas(S, S);
const g = c.getContext('2d');

// the tile: macOS icon grid (824 px square, 100 px margin), a faint top-to-bottom fall of light
const m = 100;
const r = 186;
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

const cx = S / 2;
// the nib: a collar on top, rounded shoulders, then straight sides closing to a sharp point
const nib = new Path2D();
nib.moveTo(cx - 112, 322);
nib.bezierCurveTo(cx - 168, 352, cx - 178, 420, cx - 150, 486);
nib.lineTo(cx - 14, 790);
nib.quadraticCurveTo(cx, 812, cx + 14, 790);
nib.lineTo(cx + 150, 486);
nib.bezierCurveTo(cx + 178, 420, cx + 168, 352, cx + 112, 322);
nib.quadraticCurveTo(cx, 304, cx - 112, 322);
nib.closePath();
const collar = new Path2D();
collar.roundRect(cx - 100, 228, 200, 70, 20);

const shade = g.createLinearGradient(cx - 190, 0, cx + 190, 0);
shade.addColorStop(0, '#ffffff');
shade.addColorStop(0.5, '#f4f4f4');
shade.addColorStop(1, '#d9d9d9');
g.fillStyle = shade;
g.fill(nib);
g.fill(collar);

// cut through: the breather hole, the slit down to the point, the gap under the collar
g.globalCompositeOperation = 'destination-out';
g.beginPath();
g.arc(cx, 470, 30, 0, Math.PI * 2);
g.fill();
const slit = new Path2D();
slit.moveTo(cx - 6, 494);
slit.lineTo(cx + 6, 494);
slit.lineTo(cx + 2, 800);
slit.lineTo(cx - 2, 800);
slit.closePath();
g.fill(slit);
const gap = new Path2D();
gap.moveTo(cx - 124, 303);
gap.quadraticCurveTo(cx, 286, cx + 124, 303);
gap.lineTo(cx + 124, 313);
gap.quadraticCurveTo(cx, 296, cx - 124, 313);
gap.closePath();
g.fill(gap);
g.globalCompositeOperation = 'source-over';
// the gap let the tile through: paint it back where the tile is
g.save();
g.globalCompositeOperation = 'destination-over';
g.fillStyle = bg;
g.beginPath();
g.roundRect(m, m, S - 2 * m, S - 2 * m, r);
g.fill();
g.restore();

// one drop of ink, just below the point
const drop = new Path2D();
drop.moveTo(cx, 826);
drop.bezierCurveTo(cx + 5, 842, cx + 19, 856, cx + 19, 872);
drop.arc(cx, 872, 19, 0, Math.PI, false);
drop.bezierCurveTo(cx - 19, 856, cx - 5, 842, cx, 826);
g.fillStyle = '#ffffff';
g.fill(drop);

const out = process.argv[2] ? process.argv[2] : new URL('../build/icon.png', import.meta.url);
writeFileSync(out, c.toBuffer('image/png'));
