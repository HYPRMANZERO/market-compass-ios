import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {detectFinanceDocument,extractVehicleFinanceLines,isFinanceReferenceLabel}
  from '../artifacts/market-compass/src/lib/vehicleFinance.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
import {layoutSelectablePdfLines} from '../artifacts/market-compass/src/lib/localPdfText.ts';
const now=new Date('2026-11-21T00:00:00Z');
const id='aa29e706-4467-4942-b805-21d48506eabc';
const fixture=`ABSA Vehicle Finance
Original Amount Financed R 145 800,45
Old Instalment R 3 212.50
New Instalment as at 26/06/2026 R 3 251,75
Current Settlement Value as at 10 Sep 2026 R 131 890,27
Balance from previous statement R 170 121,44
Residual Value R 0.00
Annual Interest Rate 13.25%
Payment received 10/09/2026 R 3 251,75`;

test('ABSA vehicle finance is correctly recognised as a contract, not bank payment history',()=>{
  assert.equal(detectFinanceDocument(fixture),'absa-vehicle-finance');
  const d=extractLocalFinanceDocument('test-vehicle.pdf',fixture,'Synthetic loan contract',{now,id});
  assert.equal(d.documentKind,'absa-vehicle-finance');
  assert.equal(d.bankVerified,false);
  assert.equal(d.lines.length,8);
  assert.deepEqual(validateLocalFinanceDocument(d),d);
  assert.deepEqual(d.lines.map(x=>x.semanticField),[
    'original-principal','previous-instalment','instalment','settlement-quotation',
    'statement-balance','residual-value','annual-rate','completed-payment'
  ]);
  assert.equal(d.lines[2].amount,3251.75);
  assert.equal(d.lines[2].date,'2026-06-26');
  assert.equal(d.lines[2].semanticRole,'contract-term');
  assert.equal(d.lines[3].amount,131890.27);
  assert.equal(d.lines[3].date,'2026-09-10');
  assert.equal(d.lines[3].semanticRole,'balance-reference');
  assert.equal(d.lines[6].amount,null);
  assert.equal(d.lines[6].ratePercent,13.25);
  assert.equal(d.lines[7].date,'2026-09-10');
  assert.equal(d.lines[7].semanticRole,'transaction');
});

test('contractual quotes, rates and historical balances cannot be added to Spend as payments',()=>{
  const d=extractLocalFinanceDocument('loan.pdf',fixture,'Synthetic contract',{now,id});
  const decision=i=>[{lineIndex:i,date:'2026-09-10',kind:'debt-payment',category:'car'}];
  for(const i of [0,1,2,3,4,5,6]){
    assert.throws(()=>applyReviewedDocumentToLedger(d,[],decision(i),'ZAR',now),
      /not proof|not an explicit|nonzero/i);
  }
  const ledger=applyReviewedDocumentToLedger(d,[],decision(7),'ZAR',now);
  assert.equal(ledger.length,1);
  assert.equal(ledger[0].amount,3251.75);
  assert.equal(ledger[0].date,'2026-09-10');
  const legacy=extractLocalFinanceDocument('old.pdf','Old Instalment R3212.50','Legacy',{now,id});
  assert.equal(isFinanceReferenceLabel(legacy.lines[0].label),true);
  assert.throws(()=>applyReviewedDocumentToLedger(legacy,[],[{lineIndex:0,date:'2026-01-01',kind:'debt-payment',category:'car'}],'ZAR',now),/not proof/i);
});

test('PDF rows are reconstructed by vertical and horizontal positions, not parser fragment order',()=>{
  const raw=[
    {str:'R 3 251,75',transform:[1,0,0,1,260,700],hasEOL:false},
    {str:'New Instalment as at 26/06/2026',transform:[1,0,0,1,50,700],hasEOL:false},
    {str:'Original Amount Financed',transform:[1,0,0,1,50,730],hasEOL:false},
    {str:'R 145 800,45',transform:[1,0,0,1,260,730],hasEOL:false}
  ];
  assert.deepEqual(layoutSelectablePdfLines(raw),[
    'Original Amount Financed R 145 800,45',
    'New Instalment as at 26/06/2026 R 3 251,75'
  ]);
  assert.deepEqual(layoutSelectablePdfLines([{str:'A',hasEOL:true},{str:'B',hasEOL:true}]),['A','B']);
});

test('importer shows classification; iPhone login explains isolated Safari versus Home Screen vaults',async()=>{
  const u=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
  const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(u,/Document classification/);
  assert.match(u,/Existing Spend entries include loan terms/);
  assert.match(app,/Current session:/);
  assert.match(app,/separate encrypted vaults/);
  assert.doesNotMatch(u,/sendBeacon\(|fetch\(|localStorage\.setItem/);
});
