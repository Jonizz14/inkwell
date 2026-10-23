// Builds the web version into web/dist from the same files the desktop app runs: src/renderer as
// it is, with web/api.js standing in for the preload bridge, the PDF reader (src/extract.mjs)
// bundled for the browser, and Listening's feed proxy as a Vercel function.
// The site's own articles come from web/content/data.json (kept out of the repository; made by
// `npm run web:content` from the desktop library). Deploy: `npm run web:deploy`.
import { build } from 'esbuild';
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const R = path.join(ROOT, 'src', 'renderer');
const W = path.join(ROOT, 'web');
const OUT = path.join(W, 'dist');

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(path.join(OUT, 'api'), { recursive: true });

// the window's files, without the add-ons kept beside the desktop app
for (const f of fs.readdirSync(R)) if (/\.(js|css|png)$/.test(f)) fs.copyFileSync(path.join(R, f), path.join(OUT, f));
for (const f of ['api.js', 'web.css', 'manifest.json']) fs.copyFileSync(path.join(W, f), path.join(OUT, f));
// highlights follow an article whose text was rebuilt (api.js): src/migrate.mjs as a plain script
fs.writeFileSync(path.join(OUT, 'migrate.js'), fs.readFileSync(path.join(ROOT, 'src', 'migrate.mjs'), 'utf8').replace(/^export /gm, ''));

// icons for the home screen, from the app's own
const icon = path.join(ROOT, 'build', 'icon.png');
for (const s of [192, 512]) execFileSync('sips', ['-z', String(s), String(s), icon, '--out', path.join(OUT, `icon-${s}.png`)], { stdio: 'ignore' });

// the PDF reader and pdf.js's worker
const stub = path.join(W, 'node-stubs.mjs');
await build({
  entryPoints: [path.join(W, 'extract-entry.mjs')],
  outfile: path.join(OUT, 'extract.js'),
  bundle: true,
  format: 'esm',
  platform: 'browser',
  minify: true,
  external: ['tesseract.js'],
  alias: Object.fromEntries(['node:child_process', 'node:fs', 'node:fs/promises', 'node:os', 'node:path', 'node:url', 'node:module'].map((m) => [m, stub])),
  define: { 'process.env.VISION_OCR': 'undefined', 'process.platform': '"web"', 'process.pid': '0' },
  logLevel: 'warning',
});
fs.copyFileSync(path.join(ROOT, 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.mjs'), path.join(OUT, 'pdf.worker.min.mjs'));

// Listening's YouTube feeds
fs.copyFileSync(path.join(W, 'api', 'listen.js'), path.join(OUT, 'api', 'listen.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'listen.js'), path.join(OUT, 'api', '_listen.js'));

// the articles
const data = path.join(W, 'content', 'data.json');
if (fs.existsSync(data)) fs.copyFileSync(data, path.join(OUT, 'data.json'));
else console.warn('web/content/data.json is missing: the site starts with an empty library (npm run web:content)');

// index.html: the bridge before everything, a page policy for the web, the home-screen icon
let html = fs.readFileSync(path.join(R, 'index.html'), 'utf8');
const csp = "default-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self'; img-src 'self' data: blob: https:; connect-src 'self'; worker-src 'self' blob:; frame-src 'self' blob: https://www.youtube-nocookie.com https://www.youtube.com";
html = html
  .replace(/<meta http-equiv="Content-Security-Policy" content="[^"]*" \/>/, `<meta http-equiv="Content-Security-Policy" content="${csp}" />\n  <meta name="viewport" content="width=device-width, initial-scale=1" />\n  <meta name="theme-color" content="#0d0d0d" />\n  <link rel="manifest" href="manifest.json" />\n  <link rel="icon" href="icon-192.png" />\n  <link rel="apple-touch-icon" href="icon-192.png" />`)
  .replace('</head>', '  <link rel="stylesheet" href="web.css" />\n</head>')
  .replace('<script src="preview-api.js"></script>', '<script src="api.js"></script>\n  <script src="migrate.js"></script>\n  <script src="preview-api.js"></script>');
if (!html.includes('src="api.js"')) throw new Error('index.html changed: api.js was not placed');
fs.writeFileSync(path.join(OUT, 'index.html'), html);

// the offline copy: every file, under a name that changes with them
const files = fs.readdirSync(OUT).filter((f) => fs.statSync(path.join(OUT, f)).isFile());
const hash = createHash('sha1');
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const sw = fs.readFileSync(path.join(W, 'sw.js'), 'utf8')
  .replace('__VERSION__', 'inkwell-' + hash.digest('hex').slice(0, 10))
  .replace('__ASSETS__', JSON.stringify(['/', ...files.map((f) => '/' + f)]));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);

// the Vercel project this deploys to (kept out of the repository)
const link = path.join(W, '.vercel');
if (fs.existsSync(link)) fs.cpSync(link, path.join(OUT, '.vercel'), { recursive: true });

console.log(`web/dist: ${files.length + 1} files`);
