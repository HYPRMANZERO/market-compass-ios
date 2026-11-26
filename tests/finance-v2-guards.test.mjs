import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';

const root = new URL('../artifacts/market-compass/src/', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const skin = read('finance-v2.css');
const main = read('main.tsx');

// The v2 skin is overwritten by whole-block edits more than once already. These
// assertions are the tripwire: if a block disappears, the suite fails instead of
// a styling fix silently regressing in production.
test('finance v2 skin is loaded after the base stylesheets', () => {
  const index = main.indexOf("import './index.css';");
  const ionic = main.indexOf("import './ionic-shell.css';");
  const v2 = main.indexOf("import './finance-v2.css';");
  assert.ok(index > 0 && ionic > index && v2 > ionic, 'finance-v2.css must be imported last');
});

test('native disclosure triangles stay hidden and plain rows keep their chevron', () => {
  assert.match(skin, /summary \{\s*list-style: none;/);
  assert.match(skin, /summary::-webkit-details-marker \{\s*display: none;/);
  assert.match(skin, /summary::marker \{\s*content: '';/);
  assert.match(skin, /details > summary:not\(:has\(svg\)\)::after/);
});

test('spend segment captions keep AA contrast on the track', () => {
  assert.match(skin, /\.mc-spend-tabs \.mc-spend-tab-meta \{\s*opacity: 1;/);
  assert.match(skin, /color: var\(--fin-ink-faint\);/);
});

test('disabled primaries use a neutral state, not washed brand colour', () => {
  assert.match(skin, /button\[class~='bg-primary'\]:disabled/);
  assert.match(skin, /opacity: 1 !important;/);
});

test('button geometry rescue for Ionic unlayered rule is intact', () => {
  assert.match(skin, /button\.rounded-xl \{/);
  assert.match(skin, /button\.border \{/);
  assert.match(skin, /button\[class\*='border-primary\/'\]/);
});

test('assistant bar and status band keep the app-bar parity contract', () => {
  assert.match(skin, /section\[aria-label='Compass model connection'\] \{\s*background: #0b1620 !important;/);
  const shell = read('ionic-shell.css');
  assert.match(shell, /#0b1620 calc\(env\(safe-area-inset-top,0px\) \+ 10px\)/);
});

test('every empty surface shares the fin-empty pattern', () => {
  for (const rule of [/\.fin-empty \{/, /\.fin-empty-icon \{/, /\.fin-empty-actions \{/, /\.fin-prompt \{/]) {
    assert.match(skin, rule);
  }
  const assistant = read('components/VoiceAssistant.tsx');
  assert.match(assistant, /className="fin-empty" aria-label="Example questions"/);
  const spend = read('components/MonthlyExpenses.tsx');
  assert.match(spend, /No entries in this cycle yet/);
  const app = read('App.tsx');
  assert.match(app, /No debt accounts yet/);
  assert.ok(existsSync(new URL('finance-v2.css', root)));
});
