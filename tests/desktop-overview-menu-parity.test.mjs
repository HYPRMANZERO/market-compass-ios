import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const src = new URL('../artifacts/market-compass/src/',import.meta.url);
const get = file => readFile(new URL(file,src),'utf8');

test('one local financial-space hero serves mobile and desktop with saved debt, not copied values',async()=>{
  const [app,home,hero]=await Promise.all([get('App.tsx'),get('components/MobileOverview.tsx'),get('components/FinancialSpaceHero.tsx')]);
  assert.match(home,/<FinancialSpaceHero[\s\S]*?totalDebt=\{totalDebt\}/);
  assert.match(home,/onViewAccounts=\{\(\)=>setAccountActionsOpen\(true\)\}/);
  assert.match(app,/data-testid="desktop-financial-overview"/);
  assert.match(app,/<FinancialSpaceHero currency=\{data.currency\} totalDebt=\{debtTotal\}/);
  assert.match(app,/onViewAccounts=\{\(\)=>navigate\('\/debt'\)\}/);
  assert.match(hero,/data-testid="financial-space-debt-total"/);
  assert.match(hero,/No bank connection|Not a live or bank-verified balance/);
  assert.doesNotMatch(hero,/330,017\.78|330017\.78/);
});
test('desktop menu controls share the authenticated working portal, no broken new route',async()=>{
  const app=await get('App.tsx');
  assert.match(app,/data-testid="desktop-nav-menu"/);
  assert.match(app,/data-testid="desktop-header-menu"/);
  assert.match(app,/aria-expanded=\{menuOpen\} onClick=\{\(\)=>setMenuOpen\(true\)\}/);
  assert.match(app,/menuOpen && createPortal\(/);
  assert.match(app,/aria-label="Market Compass quick menu"/);
  assert.doesNotMatch(app,/<Route path="\/menu"/);
  assert.match(app,/data-testid="mobile-nav-menu"/);
});
