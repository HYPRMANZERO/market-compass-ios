import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyDocument,maskDocumentPII,makeAccountProfile,safeAccountProfile}
  from '../artifacts/market-compass/src/lib/documentIntelligence.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const now=new Date('2026-11-21T12:00:00Z');
const opts={now,id:'a0d36ad4-55a3-4e5e-ae4c-9123ec209447'};
const absa=[
  'ABSA Vehicle Finance',
  'Account number 123456789012345',
  'ID Number 9001015009087',
  'Original Amount Financed R198 920,40',
  'Current Instalment Amount R3 543,36',
  'Current Settlement Value as at 10 Sep 2026 R192 062,31',
  'Interest Rate 12.25%'
].join('\n');
test('ABSA and other documents classified by financial meaning and institution',()=>{
  assert.equal(classifyDocument(absa).category,'vehicle-finance');
  assert.equal(classifyDocument(absa).institution,'ABSA');
  assert.equal(classifyDocument('FNB Bank Statement\nOpening balance R500\nClosing balance R600').category,'bank-statement');
  assert.equal(classifyDocument('Net Pay R7000\nPAYE R900').category,'payslip');
  assert.equal(classifyDocument('Tax invoice\nInvoice number 12345').category,'invoice');
  assert.equal(classifyDocument('Random unknown document').category,'unclassified');
});
test('identifiers never survive redaction and account name is never raw filename',()=>{
  const masked=maskDocumentPII('Account number 123456789012345 ID Number 9001015009087 email owner@example.com');
  assert.doesNotMatch(masked,/123456789012345|9001015009087|owner@example.com/);
  const p=classifyDocument(absa,'owner_9001015009087.pdf');
  assert.equal(p.name,'ABSA Vehicle finance');
  assert.doesNotMatch(p.name,/\d/);
});
test('finance agreement facts are historical evidence, not debits or live account balances',()=>{
  const doc=extractLocalFinanceDocument('old-absa.pdf',absa,'Old vehicle finance',opts);
  assert.equal(doc.documentKind,'absa-vehicle-finance');
  assert.equal(doc.accountProfile?.category,'vehicle-finance');
  assert.deepEqual(validateLocalFinanceDocument(doc),doc);
  assert.equal(doc.accountProfile?.facts.some(f=>f.field==='original-principal'&&f.amount===198920.40),true);
  assert.equal(doc.accountProfile?.facts.some(f=>f.field==='instalment'&&f.amount===3543.36),true);
  assert.equal(doc.accountProfile?.facts.some(f=>f.field==='settlement-quotation'&&f.asOf==='2026-09-10'),true);
  assert.equal(doc.accountProfile?.facts.some(f=>f.field==='annual-rate'&&f.ratePercent===12.25),true);
  assert.doesNotMatch(JSON.stringify(doc),/123456789012345|9001015009087/);
  assert.equal(safeAccountProfile(doc.accountProfile)?.name,'ABSA Vehicle finance');
  const idx=doc.lines.findIndex(l=>l.semanticField==='instalment');
  assert.throws(()=>applyReviewedDocumentToLedger(doc,[],
    [{lineIndex:idx,date:'2026-06-26',kind:'debt-payment',category:'car'}],'ZAR'),
    /not proof|not an explicit/i);
});
test('bank statements can show an account name and dated balance without automatic debt updates',()=>{
  const doc=extractLocalFinanceDocument('synthetic.pdf',
    'Nedbank Bank Statement\n2026-10-31 Closing balance R12 500,30\n2026-10-03 Payment received R450,00',
    'Synthetic October statement',opts);
  assert.equal(doc.accountProfile?.name,'Nedbank Bank account');
  assert.equal(doc.accountProfile?.facts.some(f=>f.field==='statement-balance'&&f.amount===12500.3),true);
  assert.equal(doc.bankVerified,false);
});
test('browser PDF extraction reports progress and has no fixed page-count cutoff',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/lib/localPdfText.ts',import.meta.url),'utf8');
  assert.match(src,/onProgress\?/);
  assert.match(src,/signal\?\.aborted/);
  assert.doesNotMatch(src,/pdf\.numPages\s*>\s*MAX_LOCAL_PDF_PAGES/);
  assert.match(src,/pageNumber <= pdf\.numPages/);
});
test('review UI requires consent to populate separate Debt Plan fields',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/components/AccountEvidenceReview.tsx',import.meta.url),'utf8');
  assert.match(src,/No historical amount is copied automatically/);
  assert.match(src,/against an appropriate recent source/);
  assert.match(src,/onCreate\(\{name:clean,balance,apr,minimumPayment\}\)/);
  assert.doesNotMatch(src,/fetch\(|localStorage|sendBeacon/);
});
