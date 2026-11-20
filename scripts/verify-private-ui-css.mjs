// Read-only production stylesheet audit for the existing Market Compass PWA.
// Checks actual generated utility selectors, not just HTTP 200 or presence of a CSS file.
import { readFile, stat } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('../artifacts/market-compass/dist/public/', import.meta.url)));
const html = await readFile(join(root, 'index.html'), 'utf8');
const assetPaths = Array.from(html.matchAll(/(?:href|src)=["'](\/market-compass-ios\/assets\/[^"']+\.(?:css|js))["']/g), m => m[1]);
const cssPaths = assetPaths.filter(p => p.endsWith('.css'));
const jsPaths = assetPaths.filter(p => p.endsWith('.js'));
if (cssPaths.length === 0 || jsPaths.length === 0) {
  throw Error('Production index.html must reference built CSS and JS under /market-compass-ios/assets/.');
}
const required = ['flex', 'flex-col', 'grid', 'items-center', 'w-full', 'px-4', 'rounded-xl', 'text-white'];
let css = '';
for (const path of assetPaths) {
  const local = join(root, path.slice('/market-compass-ios/'.length));
  const file = await stat(local);
  if (!file.isFile() || file.size === 0) throw Error('Compiled asset missing or empty: ' + path);
  if (path.endsWith('.css')) css += '\n' + await readFile(local, 'utf8');
}
const absent = required.filter(name => !css.includes('.' + name + '{'));
if (absent.length) {
  throw Error('Tailwind utility generation failed (' + absent.join(', ') +
    '). Verify src/index.css Tailwind source() settings and rebuild the existing PWA.');
}
console.log('PASS: same Market Compass PWA with generated Tailwind layout utilities (' +
  required.length + ' checked; ' + css.length + ' CSS bytes).');
