import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';

test('public PWA repository contains no tracked internal project documentation',()=>{
  const root=resolve(import.meta.dirname,'..');
  const paths=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'})
    .split('\0').filter(Boolean);
  const disallowed=paths.filter(path=>
    path.startsWith('docs/')||
    path==='artifacts/market-compass/docs/IONIC-CAPACITOR-READINESS.md'||
    path==='workers/payment-gateway/README.md');
  assert.deepEqual(disallowed,[],
    'Internal project documentation must be stored in the private Financial Advisor repository.');
  const readme=readFileSync(resolve(root,'README.md'),'utf8');
  assert.match(readme,/Public PWA source repository/);
  assert.doesNotMatch(readme,/HYPRBOX|ngrok-free|OAuth client secret|financial-plan-2026/);
});
