import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
test('financial-document importer is deferred until opened, never bundled into chat start',()=>{
  assert.match(app,/const LocalFinanceFiles=lazy\(\(\)=>import\('@\/components\/LocalFinanceFiles'\)\)/);
  assert.doesNotMatch(app,/^import LocalFinanceFiles from /m);
  assert.match(app,/homeImporterOpen,setHomeImporterOpen/);
  assert.match(app,/onToggle=\{event=>setHomeImporterOpen\(event.currentTarget.open\)\}/);
  assert.match(app,/\{homeImporterOpen && <Suspense/);
  assert.equal((app.match(/<LocalFinanceFiles\b/g)||[]).length,3);
  assert.equal((app.match(/Opening the local document importer\.\.\./g)||[]).length,3);
});
