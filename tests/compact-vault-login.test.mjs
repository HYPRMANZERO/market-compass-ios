import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
const from=app.indexOf('function VaultScreen({ vault }');
const to=app.indexOf('const navItems = [',from);
assert.ok(from>=0&&to>from,'Vault screen must be identifiable separately');
const screen=app.slice(from,to);

test('compact phone-sized login preserves important recovery guidance',()=>{
  for(const token of [
    'mc-vault-entry','max-w-[390px]','rounded-[22px]','text-[19px]',
    'pt-[calc(16px+env(safe-area-inset-top))]',
    'pb-[calc(18px+env(safe-area-inset-bottom))]',
    'Vault & privacy information','Current session:',
    'Do not clear website data or overwrite either vault'
  ])assert.ok(screen.includes(token),'Missing login design/safety: '+token);
  assert.ok(!screen.includes('max-w-[430px]'));
  assert.ok(!screen.includes('h-13'));
  assert.ok(!screen.includes('text-[27px]'));
  assert.ok(screen.includes('<details className="mt-3 rounded-xl'));
  assert.ok(!screen.includes('<details open='),'Session guidance should be expandable by default');
});
test('touch controls remain accessible without iPhone focus zoom',()=>{
  assert.ok(screen.includes('id="vault-password" type="password"'));
  assert.ok(screen.includes('h-12 w-full rounded-xl'));
  assert.ok(screen.includes('px-3.5 text-[16px]'));
  assert.ok(screen.includes('min-h-12 w-full'));
  assert.ok(screen.includes('disabled={busy || !entered}'));
});
test('local encrypted vault actions remain available after layout compacting',()=>{
  for(const token of [
    'vault.unlock(entered)','vault.create(entered)',
    'vault.importBackup(file, entered)','Import encrypted vault backup',
    'Restore from encrypted backup','vault.hasLegacy',
    'role="alert"','window.matchMedia'
  ])assert.ok(screen.includes(token),'Missing existing vault behavior: '+token);
});
