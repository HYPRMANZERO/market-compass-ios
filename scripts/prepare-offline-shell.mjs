#!/usr/bin/env node
/**
 * Generate a deploy-specific offline cache manifest after Vite compiles.
 * No financial data is ever bundled. Includes only public static assets.
 */
import { readdir, readFile, writeFile, stat } from 'node:fs/promises';
import { join, relative, resolve, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { protectDeployedPwaDist } from './protect-gateway-dist.mjs';
const root = resolve(process.env.MC_PWA_OUT_DIR || resolve(process.cwd(), 'artifacts/market-compass/dist/public'));
// Even a service-worker-only rebuild can alter the live private PWA.
protectDeployedPwaDist(root);
const sw = join(root, 'sw.js');
async function walk(dir) {
  const files = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, item.name);
    if (item.isDirectory()) files.push(...await walk(path));
    else if (item.isFile()) files.push(path);
  }
  return files;
}
const allow = path => {
  const rel = relative(root, path).split(sep).join('/');
  return rel === 'index.html' || rel === 'manifest.webmanifest' || rel === 'favicon.svg' ||
    rel.startsWith('icons/') || rel.startsWith('assets/');
};
const all = await walk(root);
const publicFiles = all.filter(allow);
if (!publicFiles.some(f => f.endsWith('index.html'))) throw Error('Build is missing index.html.');
const assets = publicFiles.filter(f => /assets\/.+\.(?:js|css)$/.test(relative(root, f).replaceAll(sep, '/')));
if (!assets.some(f => f.endsWith('.js')) || !assets.some(f => f.endsWith('.css'))) throw Error('Build is missing the compiled JavaScript or CSS.');
const sorted = publicFiles.map(p => './' + relative(root, p).split(sep).join('/')).sort();
const id = createHash('sha256').update(sorted.join('\n')).digest('hex').slice(0, 16);
let source = await readFile(sw, 'utf8');
if (!source.includes('__PRECACHE_JSON__') || !source.includes('__BUILD_ID__')) throw Error('Service worker placeholders missing.');
source = source.replace('__PRECACHE_JSON__', JSON.stringify(sorted)).replaceAll('__BUILD_ID__', id);
await writeFile(sw, source);
const total = await Promise.all(publicFiles.map(async p => (await stat(p)).size));
console.log(`Offline app shell ready: ${sorted.length} files, ${total.reduce((a,b)=>a+b,0)} bytes; version ${id}`);
