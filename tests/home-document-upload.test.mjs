import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../artifacts/market-compass/src/'+path,import.meta.url),'utf8');

test('Home keeps earlier mobile overview and displays a first-class document upload entry',async()=>{
  const app=await read('App.tsx');
  const home=app.slice(app.indexOf('function Overview('),app.indexOf('function Metric('));
  assert.match(home,/function Overview\(\{ data, setData, onImportDocuments, onRecoverVault, onAddAccount \}/);
  assert.match(home,/onImportDocuments=\{onImportDocuments\} onRecoverVault=\{onRecoverVault\}/);
  assert.ok(home.indexOf('<MobileOverview')<home.indexOf('id="mc-home-upload"'),
    'The main mobile banking overview should appear before the optional uploader');
  assert.match(home,/Upload financial documents/);
  assert.match(home,/<MobileOverview/);
  assert.match(home,/<HomeFinancialEvidence/);
  assert.match(home,/<HistoricalRecurringInsights/);
  assert.match(app,/<Route path="\/"><Overview data=\{data\} setData=\{setData\}/);
});

test('Home upload uses the SAME saved encrypted documents and approved ledger as Spend, no extra store',async()=>{
  const app=await read('App.tsx');
  const home=app.slice(app.indexOf('function Overview('),app.indexOf('function Metric('));
  const spend=app.slice(app.indexOf('function ExpenseLedger('),app.indexOf('function Assistant('));
  for(const view of [home,spend]){
    assert.match(view,/<LocalFinanceFiles/);
    assert.match(view,/addLocalFinanceDocument/);
    assert.match(view,/removeLocalFinanceDocument/);
    assert.match(view,/onApplyEntries=\{approved=>setData\(old=>\(\{\.\.\.old,expenseEntries:approved\}\)\)\}/);
  }
  assert.match(home,/localFinanceDocuments\?\?\[\]/);
  assert.match(home,/expenseEntries\?\?\[\]/);
  assert.doesNotMatch(home,/localStorage\.setItem|fetch\(|sendBeacon\(/);
});

test('original private importer still supports temporary PDF password and review before saving',async()=>{
  const importer=await read('components/LocalFinanceFiles.tsx');
  assert.match(importer,/Temporary PDF password/);
  assert.match(importer,/Save these reviewed excerpts to encrypted workspace/);
  assert.match(importer,/<ReviewedDocumentLedger/);
});
