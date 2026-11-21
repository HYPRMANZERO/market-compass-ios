import test from 'node:test';
import assert from 'node:assert/strict';
import {bankStatementDate,statementMoney,parseBankStatementRow,parseBankStatementText}
  from '../artifacts/market-compass/src/lib/bankStatementParser.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {applyReviewedDocumentToLedger}
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
