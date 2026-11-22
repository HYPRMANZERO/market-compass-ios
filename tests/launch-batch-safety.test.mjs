import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {maskDocumentPII} from '../artifacts/market-compass/src/lib/documentIntelligence.ts';
import {summarizeDocumentHistory} from '../artifacts/market-compass/src/lib/documentHistory.ts';
import {extractLocalFinanceDocument,addLocalFinanceDocument,sameReviewedFinanceEvidence} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';

const component=(name)=>readFile(
  new URL('../artifacts/market-compass/src/components/'+name,import.meta.url),'utf8');
test('batch import keeps a current preview and encrypted retry from being replaced',async()=>{
  const src=await component('LocalFinanceFiles.tsx');
  assert.match(src,/if\(reading\|\|preview\|\|needsPassword\|\|waitingFiles\.current\.length>0\|\|!files\.length\)return/);
  assert.match(src,/disabled=\{safe\.length>=MAX_FINANCE_FILES\|\|reading\|\|!!preview\|\|needsPassword\|\|remaining>0\}/);
  assert.match(src,/batchTotal>0&&<section aria-label="Batch document review status"/);
  assert.match(src,/Cancel selected batch/);
  assert.match(src,/setBatchWarning\(files\.length>capacity/);
});
test('closing importer cancels ongoing processing and abandons unreviewed files',async()=>{
  const src=await component('LocalFinanceFiles.tsx');
  assert.match(src,/readController\.current\?\.abort\(\)/);
  assert.match(src,/waitingFiles\.current=\[\]/);
  assert.match(src,/lockedFile\.current=null/);
  assert.match(src,/if\(passwordInput\.current\)passwordInput\.current\.value=''/);
  assert.match(src,/if\(retryPasswordInput\.current\)retryPasswordInput\.current\.value=''/);
  assert.doesNotMatch(src,/localStorage\.setItem\(|navigator\.sendBeacon\(/);
});
test('custom financial document labels are masked before entering encrypted vault',async()=>{
  const src=await component('LocalFinanceFiles.tsx');
  assert.match(src,/const privateLabel=maskDocumentPII\(label\.trim\(\)/);
  assert.match(src,/const account=classifyDocument\(data,file\.name\)/);
  assert.match(src,/extractLocalFinanceDocument\(file\.name,data,privateLabel\)/);
  const masked=maskDocumentPII('Credit card account 123456789012345');
  assert.doesNotMatch(masked,/123456789012345/);
});
test('Home summarises imported evidence without treating it as posted or live',async()=>{
  const src=await component('HomeFinancialEvidence.tsx');
  assert.match(src,/summarizeDocumentHistory\(safeDocs\)/);
  assert.match(src,/aria-label="Historical document evidence"/);
  assert.match(src,/Unverified historical excerpts, not current balances or posted Spend entries/);
  assert.match(src,/Source amounts have not been currency converted/);
  assert.match(src,/documentMoney=\(amount:number\)=>money\(amount,'ZAR'\)/);
  assert.doesNotMatch(src,/onApply\(|applyReviewedDocumentToLedger\(|fetch\(/);
});
test('receipt and salary source evidence stays separate from the transaction ledger',()=>{
  const now=new Date('2026-11-22T15:00:00Z');
  const docs=[
    extractLocalFinanceDocument('pay.pdf','Payslip\nPay date: 21 Nov 2026\nNet Pay R8,000.00',
      'Safe pay',{now,id:'a12934c7-7aa1-4c0d-9c5e-dfda920aef01'}),
    extractLocalFinanceDocument('receipt.pdf','Purchase receipt\n21 Nov 2026 Total paid R250.00',
      'Safe receipt',{now,id:'a12934c7-7aa1-4c0d-9c5e-dfda920aef02'})
  ];
  const history=summarizeDocumentHistory(docs);
  assert.equal(history.months[0].netPay,8000);
  assert.equal(history.months[0].receiptSpend,250);
  assert.equal(history.months[0].statementDebits,0);
  assert.equal(history.documentsReviewed,2);
  assert.equal(docs[0].bankVerified,false);
});

test('reimporting identical complete summaries cannot duplicate earnings evidence',()=>{
  const now=new Date('2026-11-22T15:00:00Z');
  const original=extractLocalFinanceDocument('salary.pdf',
    'Payslip\nPay date: 21 Nov 2026\nNet pay R8,000.00',
    'November payroll',{now,id:'fba07601-1824-466e-b24b-111111111111'});
  const second={...original,id:'fba07601-1824-466e-b24b-222222222222',
    importedAt:'2026-11-23T10:00:00.000Z',label:'Different owner description'};
  assert.equal(sameReviewedFinanceEvidence(original,second),true);
  assert.throws(()=>addLocalFinanceDocument([original],second),/already saved/i);
  assert.equal(addLocalFinanceDocument([],original).length,1);
  // An intentionally partial excerpt must not suppress a later complete file.
  const partial={...original,truncated:true,id:'fba07601-1824-466e-b24b-333333333333'};
  assert.equal(sameReviewedFinanceEvidence(original,partial),false);
});
test('Home reports income and expenses missing independently',async()=>{
  const src=await component('HomeFinancialEvidence.tsx');
  assert.match(src,/hasRecordedIncome=activeEntries\.some\(entry=>entry\.kind==='income'\)/);
  assert.match(src,/hasRecordedOutflow=activeEntries\.some/);
  assert.match(src,/hasRecordedIncome\?money\(stats\.income,currency\):'Not recorded'/);
  assert.match(src,/hasRecordedOutflow\?money\(stats\.expenses\+stats\.debtPayments,currency\):'Not recorded'/);
});
