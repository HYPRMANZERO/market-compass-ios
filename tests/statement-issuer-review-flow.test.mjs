import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {classifyDocument,safeAccountProfile} from '../artifacts/market-compass/src/lib/documentIntelligence.ts';

test('identifies a cheque-account issuing bank from the statement heading, not payment counterparties',()=>{
  const classified=classifyDocument([
    'FNB Cheque Account Statement',
    'Statement period: 26 May 2026 to 25 June 2026',
    'Transaction date Description Debit Credit Balance',
    '2026-06-20 EFT transfer to ABSA account 145.00',
    '2026-06-21 Nedbank service payment 39.00',
  ].join('\n'),'ABSA-copy.pdf');
  assert.equal(classified.institution,'FNB');
  assert.equal(classified.accountType,'cheque');
  assert.equal(classified.name,'FNB cheque account');
  assert.equal(classified.category,'bank-statement');
});

test('does not misidentify an ABSA payee as the issuing bank when heading is anonymous',()=>{
  const classified=classifyDocument([
    'Bank statement',
    'Opening balance R1000',
    '2026-06-20 Transfer to ABSA credit account R100',
    '2026-06-21 Nedbank payment R55',
    'Closing balance R845',
  ].join('\n'),'statement-from-ABSA.pdf');
  assert.equal(classified.institution,'Unidentified provider');
  assert.equal(classified.name,'Bank account');
});

test('account type is validated as optional, limited metadata',()=>{
  const p=classifyDocument('Standard Bank Savings Account Statement\nClosing balance R 200');
  const safe=safeAccountProfile({...p,facts:[]});
  assert.equal(safe?.institution,'Standard Bank');
  assert.equal(safe?.accountType,'savings');
  assert.equal(safeAccountProfile({...p,facts:[],accountType:'123456789'}),null);
});

test('document review exposes an editable title and a single approved Spend handoff',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  const portfolio=await readFile(new URL('../artifacts/market-compass/src/components/SpendingPortfolio.tsx',import.meta.url),'utf8');
  assert.match(src,/Document title \(editable before approval\)/);
  assert.match(src,/Save corrected document identity/);
  assert.match(src,/Approve document and record/);
  assert.match(src,/ready to update Spend from saved statements/i);
  assert.match(src,/preparedDocumentReview\(preview,i\)/);
  assert.match(app,/expenseEntries:approvals.length\?applyReviewedDocumentToLedger/);
  assert.match(app,/max-h-\[78dvh\]/);
  assert.match(portfolio,/Your spending portfolio/);
  assert.match(portfolio,/Purchases by category/);
  assert.doesNotMatch(portfolio,/fetch\(|localStorage|sendBeacon/);
});
