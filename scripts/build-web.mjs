// Builds the web version into web/dist from the same files the desktop app runs: src/renderer as
// it is, with web/api.js standing in for the preload bridge, the PDF reader (src/extract.mjs)
// bundled for the browser, and Listening's feed proxy as a Vercel function.
// The site's own articles come from web/content/data.json (kept out of the repository; made by
// `npm run web:content` from the desktop library). Deploy: `npm run web:deploy`.
import { build, transform } from 'esbuild';
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
// the Guardian shelf's Content API calls
fs.copyFileSync(path.join(W, 'api', 'guardian.js'), path.join(OUT, 'api', 'guardian.js'));
fs.copyFileSync(path.join(ROOT, 'src', 'guardian.js'), path.join(OUT, 'api', '_guardian.js'));

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
  .replace('<script src="preview-api.js"></script>', '<script src="api.js"></script>\n  <script src="preview-api.js"></script>');
if (!html.includes('src="api.js"')) throw new Error('index.html changed: api.js was not placed');

// One file to fetch: every stylesheet and script goes into the page itself, minified (each request
// to the server costs a round trip, about half a second from Tashkent). Scripts keep their order
// and share one scope, as separate classic scripts do; the page policy lets in exactly these
// scripts by their hashes. The shipped articles' titles ride along, so the list shows at once.
const sha = (t) => `'sha256-${createHash('sha256').update(t).digest('base64')}'`;
const css = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)" \/>/g)].map((m) => fs.readFileSync(path.join(OUT, m[1]), 'utf8')).join('\n');
const srcs = [...html.matchAll(/<script src="([^"]+)"><\/script>/g)].map((m) => m[1]);
const read = (f) => fs.readFileSync(path.join(OUT, f), 'utf8');
const lib = fs.existsSync(data) ? JSON.parse(fs.readFileSync(data, 'utf8')).map(({ blocks, ...m }) => ({ ...m, rev: m.rev || 1 })) : null;
const head = srcs[0]; // splash.js: the launch card, drawn before the rest of the page is read
const rest = srcs.slice(1).map((f) => `/* ${f} */\n${read(f)}`).join('\n;\n');
const mini = async (code, loader) => (await transform(code, { loader, minifyWhitespace: true, minifySyntax: loader === 'css', legalComments: 'none' })).code.replace(/<\/(script|style)/gi, '<\\/$1');
const splashJs = await mini(read(head), 'js');
const styles = await mini(css, 'css');
const appJs = await mini(`window.__INKWELL_LIB = ${JSON.stringify(lib)};\n${rest}`, 'js');
html = html
  .replace(/\s*<link rel="stylesheet" href="[^"]+" \/>/g, '')
  .replace('</head>', () => `  <style>${styles}</style>\n</head>`)
  .replace(`<script src="${head}"></script>`, () => `<script>${splashJs}</script>`)
  .replace(/\s*<script src="[^"]+"><\/script>/g, '')
  .replace('</body>', () => `<script>${appJs}</script>\n</body>`)
  .replace("script-src 'self'", () => `script-src 'self' ${sha(splashJs)} ${sha(appJs)}`);
// the reader lives at /read (vercel.json below); / is the presentation page (web/landing)
fs.writeFileSync(path.join(OUT, 'app.html'), html);
fs.cpSync(path.join(W, 'landing'), OUT, { recursive: true });
for (const f of [...srcs, ...fs.readdirSync(OUT).filter((f) => f.endsWith('.css'))]) fs.rmSync(path.join(OUT, f), { force: true });

// the offline copy: the page and what it loads, under a name that changes with them. pdf.js and
// the PDF reader are only cached once someone adds a PDF; the texts once api.js asks for them.
const lazy = new Set(['extract.js', 'pdf.worker.min.mjs', 'data.json']);
const pages = new Set(['index.html', 'app.html']);
const files = fs.readdirSync(OUT).filter((f) => fs.statSync(path.join(OUT, f)).isFile());
const hash = createHash('sha1');
for (const f of files.sort()) hash.update(f).update(fs.readFileSync(path.join(OUT, f)));
const sw = fs.readFileSync(path.join(W, 'sw.js'), 'utf8')
  .replace('__VERSION__', 'inkwell-' + hash.digest('hex').slice(0, 10))
  .replace('__ASSETS__', JSON.stringify(['/', '/read', ...files.filter((f) => !lazy.has(f) && !pages.has(f)).map((f) => '/' + f)]));
fs.writeFileSync(path.join(OUT, 'sw.js'), sw);
// the service worker itself is always asked for fresh, so a new deploy is found on the next visit
fs.writeFileSync(path.join(OUT, 'vercel.json'), JSON.stringify({
  rewrites: [{ source: '/read', destination: '/app.html' }],
  redirects: [{ source: '/app.html', destination: '/read', permanent: false }],
  headers: [{ source: '/sw.js', headers: [{ key: 'Cache-Control', value: 'no-cache' }] }],
}));

// the Vercel project this deploys to (kept out of the repository)
const link = path.join(W, '.vercel');
if (fs.existsSync(link)) fs.cpSync(link, path.join(OUT, '.vercel'), { recursive: true });

console.log(`web/dist: app.html ${Math.round(fs.statSync(path.join(OUT, 'app.html')).size / 1024)} KB, index.html ${Math.round(fs.statSync(path.join(OUT, 'index.html')).size / 1024)} KB, ${files.length} files`);
