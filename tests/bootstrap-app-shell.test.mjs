import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source=(name)=>readFile(
  new URL('../artifacts/market-compass/src/'+name,import.meta.url),'utf8'
);

test('offline Bootstrap 5 grid is bundled locally, without Bootstrap JS or a CDN',async()=>{
  const main=await source('main.tsx');
  const grid=await source('vendor/bootstrap/bootstrap-grid.min.css');
  const licence=await source('vendor/bootstrap/LICENSE');
  assert.match(main,/import '\.\/vendor\/bootstrap\/bootstrap-grid\.min\.css'/);
  assert.doesNotMatch(main,/bootstrap\/dist\/js|bootstrap\.bundle|https:\/\/cdn\./);
  assert.match(grid,/\.row\s*\{/);
  assert.match(grid,/\.col-4\s*\{/);
  assert.match(grid,/\.col-6\s*\{/);
  assert.match(licence,/MIT License/);
});
test('mobile banking layout keeps all six routes and a safe-area-aware tab bar',async()=>{
  const app=await source('App.tsx');
  const css=await source('index.css');
  assert.match(app,/aria-label="Mobile app tabs"/);
  for(const route of ['/markets','/debt','/expenses','/drafts','/assistant']){
    assert.ok(app.includes("href: '"+route+"'"),'Route missing: '+route);
  }
  assert.match(app,/mc-tab-link/);
  assert.match(css,/\.mc-mobile-tabbar\s*\{\s*padding-bottom:\s*max\(10px,\s*env\(safe-area-inset-bottom\)\)/);
  assert.match(css,/\.mc-mobile-tabbar \.mc-tab-link\[aria-current="page"\]::before/);
});
test('mobile overview uses Bootstrap columns for meaningful, consented account displays',async()=>{
  const ui=await source('components/MobileOverview.tsx');
  const app=await source('App.tsx');
  for(const expected of [
    /className="row g-2 mc-bs-quick-actions"/,
    /className="col-4"/,
    /className="row g-3 mc-bs-summary"/,
    /className="col-6"/,
    /className="mc-account-list"/,
    /className="mc-account-row"/,
    /className="mc-wallet-hero"/,
    /aria-label="Quick actions"/,
    /href="\/assistant"/
  ])assert.match(ui,expected);
  assert.match(ui,/Manual entry · Not bank connected/);
  assert.match(ui,/maskDocumentPII\(account\.name\.trim\(\)\)/);
  assert.match(ui,/Not a live or bank-verified balance/);
  assert.match(ui,/Not entered/);
  assert.match(app,/documentsCount=\{docs\.length\} approvedEntryCount=\{entries\.length\}/);
  assert.match(app,/accounts=\{data\.accounts\}/);
  assert.match(app,/id="mc-home-upload"/);
  assert.ok(app.indexOf('<MobileOverview')<app.indexOf('id="mc-home-upload"'),
    'Mobile finance overview should display before optional document importer on Home');
});
test('CSS confines Bootstrap skin to app classes and avoids overriding legacy forms',async()=>{
  const css=await source('index.css');
  assert.match(css,/\.mc-app-overview \.row/);
  assert.match(css,/\.mc-wallet-hero/);
  assert.match(css,/\.mc-stat-card/);
  assert.match(css,/\.mc-account-details/);
  assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
  assert.doesNotMatch(css,/\.btn-primary\s*\{/);
});
