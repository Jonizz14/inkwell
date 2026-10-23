// Prints what the built app is made of besides src/: Electron, the node modules, the native
// helpers outside src (the reminder and the widgets on macOS), the icon and the packaging
// settings. CI stores it in the app's package.json ("inkwellDeps") and in the name of the small
// update file; an installed app whose value matches can update by swapping src/ alone
// (src/update.js) instead of downloading the whole app again.
import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const h = createHash('sha256');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
h.update(JSON.stringify({ deps: pkg.dependencies, dev: pkg.devDependencies, build: pkg.build, main: pkg.main }));
const files = ['package-lock.json', 'build/icon.png', 'scripts/build-remind.sh', 'scripts/build-widget.sh'];
for (const f of fs.readdirSync(path.join(ROOT, 'tools')).sort()) files.push('tools/' + f);
for (const f of files) {
  const p = path.join(ROOT, f);
  if (fs.existsSync(p) && fs.statSync(p).isFile()) h.update(f).update(fs.readFileSync(p));
}
process.stdout.write(h.digest('hex').slice(0, 12));
