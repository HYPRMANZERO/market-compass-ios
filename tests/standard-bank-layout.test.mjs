import test from 'node:test';
import assert from 'node:assert/strict';
import {layoutStandardBankPdfLines}
  from '../artifacts/market-compass/src/lib/standardBankPdfLayout.ts';
import {parseBankStatementText}
  from '../artifacts/market-compass/src/lib/bankStatementParser.ts';
import {extractLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';

const part=(str,x,y,width)=>({str,width,transform:[1,0,0,1,x,y]});
const items=[
 part('Date',48,730,25),part('Description',160,730,90),
 part('Payments',460,730,70),part('Deposits',570,730,67),
 part('Balance',687,730,65),
 part('STATEMENT OPENING BALANCE',160,709,162),
 part('2,829.72',704,709,68),
 part('27 Mar 26',48,682,70),part('TRANSFER',160,682,72),
 part('-200.00',505,682,43),part('2,629.72',704,682,68),
 part('PAYSHAP PAYMENT TO',160,673,155),
 part('27 Mar 26',48,646,70),part('FEE: PAYSHAP PAYMENT',160,646,175),
 part('-7.00',523,646,27),part('2,622.72',704,646,68),
 part('27 Mar 26',48,619,70),part('TRAVELLING',160,619,93),
 part('1,000.00',590,619,63),part('2,550.73',704,619,68),
 part('B PAYMENT FROM',160,610,109)
];
test('Standard Bank table columns reconstructed from x/y rather than flattened generic text',()=>{
 const lines=layoutStandardBankPdfLines(items);
 assert.ok(lines);
 assert.equal(lines.length,4);
 assert.equal(lines[0],'STDBANK||STATEMENT OPENING BALANCE|||2,829.72');
 assert.match(lines[1],/^STDBANK\|27 Mar 26\|TRANSFER PAYSHAP PAYMENT TO\|-200\.00\|\|2,629\.72$/);
 assert.match(lines[2],/FEE: PAYSHAP PAYMENT\|-7\.00\|\|2,622\.72$/);
 assert.match(lines[3],/\|TRAVELLING B PAYMENT FROM\|\|1,000\.00\|2,550\.73$/);
 const parsed=parseBankStatementText(lines.join('\n'));
 assert.equal(parsed.lines.length,4);
 assert.equal(parsed.lines[0].semanticRole,'balance-reference');
 assert.deepEqual(parsed.lines.slice(1).map(e=>[e.date,e.amount,e.direction,e.runningBalance]),[
   ['2026-03-27',-200,'outgoing',2629.72],
   ['2026-03-27',-7,'outgoing',2622.72],
   ['2026-03-27',1000,'incoming',2550.73]
 ]);
});
test('Standard Bank deposit is not guessed as an outgoing transfer',()=>{
 const lines=layoutStandardBankPdfLines(items);
 assert.ok(lines);
 const text=['Standard Bank','3 month statement','From: 26 Mar 26',
   'Transaction details','Available Balance: -R2.20',...lines].join('\n');
 const document=extractLocalFinanceDocument('fake.pdf',text,'Synthetic statement',{
   now:new Date('2026-11-21T12:00:00Z'),
   id:'a5c64db2-80b1-4f4a-85e2-a64b49ac7e77'
 });
 assert.equal(document.accountProfile.name,'Standard Bank account');
 assert.equal(document.accountProfile.category,'bank-statement');
 assert.equal(document.lines.length,5);
 assert.equal(document.lines[4].direction,'incoming');
 assert.equal(document.lines[4].amount,1000);
 assert.equal(document.lines[0].semanticRole,'balance-reference');
 assert.equal(document.lines[1].semanticRole,'balance-reference');
 assert.equal(document.accountProfile.facts.some(f=>f.field==='running-balance'&&f.amount===2550.73),true);
});
test('unknown/headerless layouts do not fabricate payment/deposit columns',()=>{
 assert.equal(layoutStandardBankPdfLines([part('27 Mar 26',40,100,65),part('Paid',150,100,30),
   part('100.00',500,100,52)]),null);
});
test('ambiguous monetary column is rejected instead of becoming a fake transaction',()=>{
 const altered=items.map(v=>v);
 // Replace the deposit with a value too far from any expected numeric column.
 altered[18]=part('1,000.00',580,619,1);
 const lines=layoutStandardBankPdfLines(altered);
 assert.ok(lines);
 assert.equal(lines.some(x=>x.includes('TRAVELLING')),false);
});

test('Standard Bank keeps split posting dates and wide right-aligned payments',()=>{
  const items=[
    part('Date',30,700,22),part('Description',105,700,60),
    part('Payments',350,700,43),part('Deposits',440,700,40),
    part('Balance',530,700,34),
    part('STATEMENT OPENING BALANCE',105,680,170),
    part('22,500.00',510,680,54),
    part('27',30,660,11),part('Mar',47,660,19),part('26',74,660,11),
    part('CARD PURCHASE 26 MAR',105,660,140),
    part('-12,345.67',331,660,62),part('10,154.33',510,660,54),
    part('CARD PAYMENT',105,650,80),
    part('28 Mar 26',30,630,52),part('TRANSFER RECEIVED',105,630,112),
    part('750.00',446,630,34),part('10,904.33',510,630,54)
  ];
  const extracted=layoutStandardBankPdfLines(items);
  assert.ok(extracted);
  const {lines}=parseBankStatementText(extracted.join('\n'));
  assert.deepEqual(lines.map(({date,amount,runningBalance,semanticRole})=>
    [date,amount,runningBalance,semanticRole]),[
    [null,22500,undefined,'balance-reference'],
    ['2026-03-27',-12345.67,10154.33,'transaction'],
    ['2026-03-28',750,10904.33,'transaction']
  ]);
  assert.equal(lines[1].label,'CARD PURCHASE 26 MAR CARD PAYMENT');
});
