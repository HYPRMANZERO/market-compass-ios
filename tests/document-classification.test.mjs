import test from 'node:test';
import assert from 'node:assert/strict';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {parseBankStatementRow} from '../artifacts/market-compass/src/lib/bankStatementParser.ts';
import {documentRowBlockReason,suggestDocumentClassification} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

test('payment and deposit columns yield editable Spend suggestions',()=>{
  const fee=parseBankStatementRow('STDBANK|27 Mar 26|FEE: PAYSHAP PAYMENT|7.00||2,622.72');
  const salary=parseBankStatementRow('STDBANK|27 Mar 26|Salary||1,000.00|3,622.72');
  assert.equal(fee.direction,'outgoing');
  assert.equal(salary.direction,'incoming');
  assert.deepEqual(suggestDocumentClassification(fee),{kind:'expense',category:'fees'});
  assert.deepEqual(suggestDocumentClassification(salary),{kind:'income',category:'salary'});
  assert.equal(suggestDocumentClassification({...salary,label:'PAYSHAP PAYMENT FROM'}),null);
  assert.equal(suggestDocumentClassification({...fee,direction:'unclassified'}),null);
});

test('available balances stay out of Spend, including legacy saved excerpts',()=>{
  const label='Transaction details Available Balance: -R2.20';
  assert.equal(parseBankStatementRow(label).semanticRole,'balance-reference');
  const old={label,amount:2.2,date:null,direction:'unclassified'};
  assert.match(documentRowBlockReason({format:'pdf'},old),/Reference figure only/);
});

test('explicit CSV columns take precedence over a generic Amount',()=>{
  const csv='Date,Description,Amount,Payments,Deposits\n2026-03-27,Bank fee,7,7,0\n2026-03-28,Salary,1000,0,1000';
  const doc=extractLocalFinanceDocument('example.csv',csv,'Synthetic export');
  assert.deepEqual(doc.lines.map(({amount,direction})=>[amount,direction]),[[-7,'outgoing'],[1000,'incoming']]);
});
