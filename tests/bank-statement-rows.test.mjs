import test from 'node:test';
import assert from 'node:assert/strict';
import {bankStatementDate,statementMoney,parseBankStatementRow,parseBankStatementText}
  from '../artifacts/market-compass/src/lib/bankStatementParser.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {cycleAnalysis} from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
import {applyReviewedDocumentToLedger,suggestDocumentClassification}
  from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const now=new Date('2026-11-21T12:00:00Z');
const fixture=[
 'ABSA Bank Statement',
 'Account number 123456789012345',
 'Transaction Date Description Debit Credit Balance',
 '27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 2,622.72',
 '27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 3,143.53',
 '30 Mar 26 FEE: PAYSHAP PAYMENT -7.00 4,416.39',
 '04 Apr 26 FEE: PAYSHAP PAYMENT -7.00 94.93',
 'Transaction details Available Balance: -R2.20'
].join('\n');
test('South African abbreviated statement dates are retained precisely',()=>{
 assert.deepEqual(bankStatementDate('27 Mar 26'),{date:'2026-03-27',matched:'27 Mar 26'});
 assert.equal(bankStatementDate('04 Apr 26 FEE')?.date,'2026-04-04');
 assert.equal(bankStatementDate('29 Feb 24')?.date,'2024-02-29');
 assert.equal(bankStatementDate('31 Feb 26'),null);
 assert.equal(bankStatementDate('26/03/2026')?.date,'2026-03-26');
 assert.equal(bankStatementDate('2026-04-04')?.date,'2026-04-04');
 assert.equal(bankStatementDate('27-Sept-26')?.date,'2026-09-27');
 assert.equal(bankStatementDate('27-09-26')?.date,'2026-09-27');
 assert.equal(bankStatementDate('27-Mar-26')?.date,'2026-03-27');
 assert.equal(bankStatementDate('29-Feb-25'),null);
});
test('hyphenated statement and CSV dates retain explicit bank values',()=>{
 const row=parseBankStatementRow('27-Sept-26 Monthly service charge -7.50 202.50');
 assert.ok(row);
 assert.equal(row.date,'2026-09-27');
 assert.equal(row.amount,-7.50);
 assert.equal(row.runningBalance,202.50);
 const doc=extractLocalFinanceDocument('synthetic.csv',
   'Date,Description,Amount\n27-Sept-26,Service charge,-7.50\n27-09-26,Payroll,+120.00',
   'Synthetic bank CSV',{now,id:'badc0ffe-1111-4444-8aaa-000000000001'});
 assert.deepEqual(doc.lines.map(line=>[line.date,line.amount,line.direction]),[
   ['2026-09-27',-7.50,'outgoing'],['2026-09-27',120,'incoming']
 ]);
});

test('negative fee and running balance are separate, not double-counted',()=>{
 const fee=parseBankStatementRow('27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 2,622.72');
 assert.ok(fee);
 assert.deepEqual({date:fee.date,amount:fee.amount,runningBalance:fee.runningBalance,
   direction:fee.direction,semanticRole:fee.semanticRole},
   {date:'2026-03-27',amount:-7,runningBalance:2622.72,
     direction:'outgoing',semanticRole:'transaction'});
 assert.equal(parseBankStatementRow('04 Apr 26 FEE: PAYSHAP PAYMENT -7.00 94.93')?.runningBalance,94.93);
 assert.equal(statementMoney('-R2.20'),-2.2);
 assert.equal(statementMoney('R 3 543,36'),3543.36);
});
test('undated available balance is a balance reference, never an expense',()=>{
 const balance=parseBankStatementRow('Transaction details Available Balance: -R2.20');
 assert.equal(balance?.semanticRole,'balance-reference');
 assert.equal(balance?.semanticField,'statement-balance');
 assert.equal(balance?.amount,-2.2);
 assert.equal(balance?.date,null);
 assert.equal(parseBankStatementRow('FEE: PAYSHAP PAYMENT -7.00 2,622.72'),null);
 assert.equal(parseBankStatementRow('27 Mar 26 FEE: payment -7.00 500.00 600.00'),null);
});
test('bank PDF data appears as historical account evidence with date and signed amount',()=>{
 const doc=extractLocalFinanceDocument('synthetic.pdf',fixture,'Synthetic ABSA March',{
   now,id:'22222222-3333-4444-8555-666666666666'});
 assert.equal(doc.accountProfile?.category,'bank-statement');
 assert.equal(doc.documentKind,'unclassified');
 assert.equal(doc.lines.length,5);
 assert.equal(doc.lines[0].date,'2026-03-27');
 assert.equal(doc.lines[0].amount,-7);
 assert.equal(doc.lines[0].runningBalance,2622.72);
 assert.equal(doc.lines[4].semanticRole,'balance-reference');
 assert.equal(doc.accountProfile?.facts.some(f=>f.field==='running-balance'&&
   f.amount===94.93&&f.asOf==='2026-04-04'),true);
 assert.equal(doc.accountProfile?.facts.some(f=>f.field==='statement-balance'&&
   f.amount===-2.2),true);
 assert.doesNotMatch(JSON.stringify(doc),/123456789012345/);
 assert.deepEqual(validateLocalFinanceDocument(doc),doc);
});
test('bank historical balance cannot be posted; dated fee can only be posted after approval',()=>{
 const doc=extractLocalFinanceDocument('synthetic.pdf',fixture,'Synthetic ABSA March',{
   now,id:'33333333-4444-4555-8666-777777777777'});
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[
   {lineIndex:4,date:'2026-04-04',kind:'expense',category:'fees'}
 ],'ZAR',now),/reference balance|not proof/i);
 const accepted=applyReviewedDocumentToLedger(doc,[],[
   {lineIndex:0,date:'2026-03-27',kind:'expense',category:'fees'}
 ],'ZAR',now);
 assert.equal(accepted.length,1);
 assert.equal(accepted[0].date,'2026-03-27');
 assert.equal(accepted[0].amount,7);
 assert.equal(accepted[0].kind,'expense');
 assert.equal(accepted[0].description.includes('2622.72'),false);
 const legacy={...doc,lines:doc.lines.map(l=>({...l,date:null,semanticRole:'unclassified',runningBalance:undefined}))};
 assert.throws(()=>applyReviewedDocumentToLedger(legacy,[],[
   {lineIndex:0,date:'2026-03-27',kind:'expense',category:'fees'}
 ],'ZAR',now),/Re-import the original PDF/i);
});
test('statement parser bounded evidence has explicit truncation rather than silent loss',()=>{
 const many=Array.from({length:9},(_,i)=>
   '27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 '+(100+i)+'.00').join('\n');
 const parsed=parseBankStatementText(many,3);
 assert.equal(parsed.lines.length,3);
 assert.equal(parsed.truncated,true);
});

test('invoice review keeps signed amounts, locale grouping and source dates',()=>{
  const doc=extractLocalFinanceDocument('invoice.txt',
    'Tax invoice\nPayment due 05 Nov 26\n05 Nov 26 Invoice total R1.234,56\nAdjustment -R 125.00\nSubtotal R10.00 VAT R1.50',
    'Synthetic invoice',{id:'12345678-1234-4234-8234-123456789012',now});
  assert.deepEqual(doc.lines.map(row=>[row.date,row.amount]),[['2026-11-05',1234.56],[null,-125]]);
});

test('approved statement credits and debits update the right salary cycle exactly once',()=>{
  const text=[
    'Standard Bank statement',
    'STDBANK||Opening balance|||100.00',
    'STDBANK|25 Mar 26|Salary||50.00|150.00',
    'STDBANK|26 Mar 26|Salary||500.00|650.00',
    'STDBANK|27 Mar 26|Monthly bank fee|7.00||643.00',
    'STDBANK|28 Mar 26|Internal transfer to own account|100.00||543.00',
    'STDBANK|29 Mar 26|PAYSHAP PAYMENT FROM||10.00|553.00',
  ].join('\n');
  const doc=extractLocalFinanceDocument('synthetic.pdf',text,'Synthetic Standard Bank',{
    now,id:'33333333-4444-4555-8666-777777777777'
  });
  assert.equal(doc.lines.length,6);
  assert.equal(suggestDocumentClassification(doc.lines[5]),null);
  const choices=[1,2,3,4].map(lineIndex=>{
    const line=doc.lines[lineIndex];
    const suggestion=suggestDocumentClassification(line);
    assert.ok(suggestion);
    return {lineIndex,date:line.date,...suggestion};
  });
  const ledger=applyReviewedDocumentToLedger(doc,[],choices,'ZAR',now);
  const march=cycleAnalysis(ledger,'2026-03-26','ZAR');
  assert.deepEqual([march.count,march.income,march.expenses,march.transfers,march.recordedDifference],
    [3,500,7,100,493]);
  assert.equal(cycleAnalysis(ledger,'2026-02-26','ZAR').income,50);
  assert.throws(()=>applyReviewedDocumentToLedger(doc,ledger,choices,'ZAR',now),/already added/i);
  assert.equal(ledger.length,4);
});
