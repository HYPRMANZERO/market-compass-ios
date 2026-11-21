import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeStatementCandidates,normalizeReadOnlyBankRows
} from '../artifacts/market-compass/src/lib/financialSourceNormalizer.ts';

test('PDF and official read-only feed share identical field model but never approve a payment',()=>{
  const pdf='ABSA Bank Statement\n27 Mar 26 FEE: PAYSHAP PAYMENT -7.00 2,622.72';
  const paper=normalizeStatementCandidates(pdf,'bank-statement-pdf','ABSA','ABSA Cheque');
  const feed=normalizeReadOnlyBankRows([{
    date:'2026-03-27',description:'FEE: PAYSHAP PAYMENT',amount:-7,currency:'ZAR',
    runningBalance:2622.72,status:'posted'
  }],'ABSA','ABSA Cheque');
  assert.equal(paper.candidates.length,1);
  assert.equal(feed.candidates.length,1);
  const x=paper.candidates[0],y=feed.candidates[0];
  assert.deepEqual([x.date,x.description,x.amount,x.direction,x.runningBalance],
    [y.date,y.description,y.amount,y.direction,y.runningBalance]);
  assert.equal(x.approval,'pending-owner-review');
  assert.equal(y.approval,'pending-owner-review');
  assert.equal(x.source,'bank-statement-pdf');
  assert.equal(y.source,'bank-api-readonly');
  assert.equal(x.matchHint,y.matchHint);
});

test('balance-only rows and incomplete rows never appear as bank transactions',()=>{
  const result=normalizeStatementCandidates([
    'ABSA Bank Statement',
    '04 Apr 26 Fee -7.00 94.93',
    'Available balance: -R2.20',
    'FEE: PAYSHAP PAYMENT -7.00 2,622.72'
  ].join('\n'),'bank-statement-pdf','ABSA','ABSA Bank');
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].date,'2026-04-04');
  assert.equal(result.candidates[0].amount,-7);
  assert.equal(result.unresolved,1);
});

test('unsigned PDF amounts remain direction-unclassified while signed feed amounts retain sign',()=>{
  const paper=normalizeStatementCandidates(
    '05 Apr 26 TRF UNKNOWN 10.00 200.00',
    'bank-statement-pdf','ABSA','ABSA Bank');
  assert.equal(paper.candidates.length,1);
  assert.equal(paper.candidates[0].direction,'unclassified');
  const api=normalizeReadOnlyBankRows([{
    date:'2026-04-05',description:'TRF UNKNOWN',amount:10,currency:'ZAR',
    status:'posted'
  }],'ABSA','ABSA Bank');
  assert.equal(api.candidates[0].direction,'incoming');
});

test('normalizer rejects invalid bank dates, currencies, NaN and PII account labels',()=>{
  const rows=[
    {date:'2026-02-30',description:'Payment',amount:-1,currency:'ZAR',status:'posted'},
    {date:'2026-03-27',description:'Payment',amount:-1,currency:'USD',status:'posted'},
    {date:'2026-03-27',description:'Payment',amount:Number.NaN,currency:'ZAR',status:'posted'},
    {date:'2026-03-27',description:'Payment',amount:-5,currency:'ZAR',status:'pending'}
  ];
  const result=normalizeReadOnlyBankRows(rows,'ABSA','ABSA Cheque');
  assert.equal(result.rejected,3);
  assert.equal(result.candidates.length,1);
  assert.equal(result.candidates[0].status,'pending-bank');
  assert.equal(result.candidates[0].approval,'pending-owner-review');
  assert.equal(normalizeReadOnlyBankRows(rows,'ABSA','Account 123456789012').candidates.length,0);
});

test('cannot mistake duplicate-looking fees for unique transaction keys',()=>{
  const result=normalizeReadOnlyBankRows([
    {date:'2026-03-27',description:'FEE: PAYMENT',amount:-7,currency:'ZAR',status:'posted',runningBalance:2622.72},
    {date:'2026-03-27',description:'FEE: PAYMENT',amount:-7,currency:'ZAR',status:'posted',runningBalance:3143.53}
  ],'ABSA','ABSA Current');
  assert.equal(result.candidates.length,2);
  assert.equal(result.candidates[0].matchHint,result.candidates[1].matchHint);
  assert.notEqual(result.candidates[0].runningBalance,result.candidates[1].runningBalance);
});
