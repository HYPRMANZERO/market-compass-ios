import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const read=path=>readFile(new URL(path,root),'utf8');

test('Spend uses progressive Documents, Activity and Plan navigation, not all sections at once',async()=>{
 const ui=await read('App.tsx');
 assert.match(ui,/type SpendSection='documents'\|'activity'\|'plan'/);
 assert.match(ui,/aria-label="Spend sections"/);
 assert.match(ui,/aria-pressed=\{section===id\}/);
 assert.match(ui,/section==='documents'&&/);
 assert.match(ui,/section==='activity'&&/);
 assert.match(ui,/section==='plan'&&/);
 assert.match(ui,/LocalFinanceFiles/);
 assert.match(ui,/MonthlyExpenses/);
 assert.match(ui,/FinancialReadinessChecklist/);
 assert.match(ui,/Desktop navigation/);
 assert.match(ui,/Mobile app tabs/);
});

test('import form de-clutters password and limits; no password saved in state',async()=>{
 const s=await read('components/LocalFinanceFiles.tsx');
 assert.match(s,/Supported files, privacy & limits/);
 assert.match(s,/Password-protected PDF\? Open one-time password/);
 assert.match(s,/passwordInput\.current\.value=''/);
 assert.match(s,/<ReviewedDocumentLedger/);
 assert.doesNotMatch(s,/setPassword\(/);
});

test('reviewer isolates long lists in scrollable rows and uses confirmation',async()=>{
 const s=await read('components/ReviewedDocumentLedger.tsx');
 assert.match(s,/max-h-\[58vh\]/);
 assert.match(s,/window\.confirm/);
 assert.match(s,/aria-pressed|aria-label/);
 assert.doesNotMatch(s,/fetch\(|sendBeacon/);
});

test('financial coverage stays accessible with an at-a-glance progress bar',async()=>{
 const s=await read('components/FinancialReadinessChecklist.tsx');
 assert.match(s,/role="progressbar"/);
 assert.match(s,/Review all seven evidence checks/);
 assert.match(s,/aria-valuenow/);
 assert.match(s,/local 30 \/ 60 \/ 90-day planning guideline/);
});
