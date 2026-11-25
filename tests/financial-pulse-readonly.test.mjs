import test from 'node:test';
import assert from 'node:assert/strict';
import {calculateFinancialPulse} from '../artifacts/market-compass/src/lib/financialPulseForecast.ts';

const entry=(id,date,kind,amount,category='other')=>({
  id,date,kind,category,amount,currency:'ZAR',paidVia:'synthetic',
  description:'Synthetic approved record',recordedAt:date+'T12:00:00Z'
});
const commitment=(id,amount,dueDate,overrides={})=>({
  id,amount,dueDate,approved:true,settled:false,
  currency:'ZAR',sourceId:'approved-bill-'+id,...overrides
});
const bankBalance=(amount,asOf,verified=true)=>({
  amount,asOf,bankVerified:verified,currency:'ZAR',sourceId:'approved-bank-snapshot'
});
const today='2026-11-25';

test('read-only recorded income minus spending is NOT assumed to be spendable money',()=>{
  const approvedEntries=[
    entry('salary','2026-10-26','income',10400,'salary'),
    entry('car','2026-10-29','expense',3552,'car'),
    entry('credit','2026-10-29','debt-payment',600.20,'credit-card'),
    entry('transfer','2026-11-01','transfer',500,'savings')
  ];
  const original=JSON.stringify(approvedEntries);
  const pulse=calculateFinancialPulse({asOf:today,approvedEntries});
  assert.equal(pulse.readOnly,true);
  assert.equal(pulse.recorded.income,10400);
  assert.equal(pulse.recorded.expenses,3552);
  assert.equal(pulse.recorded.debtPayments,600.20);
  assert.equal(pulse.recorded.transfers,500);
  assert.equal(pulse.recorded.difference,6247.8);
  assert.equal(pulse.safeToSpend,null);
  assert.equal(pulse.afterCommitments,null);
  assert.equal(pulse.balance.quality,'missing');
  assert.deepEqual(pulse.sourceIds.recorded,['salary','car','credit','transfer']);
  assert.equal(JSON.stringify(approvedEntries),original);
});
test('verified recent balance plus COMPLETE approved bills and explicit buffer enables safe estimate',()=>{
  const pulse=calculateFinancialPulse({
    asOf:today,approvedEntries:[],balance:bankBalance(4000,'2026-11-24'),
    commitmentsComplete:true,safetyBuffer:500,
    commitments:[commitment('car',1500,'2026-11-25'),
      commitment('next-cycle',700,'2026-11-26')]
  });
  assert.equal(pulse.obligations.unsettled,1500);
  assert.equal(pulse.obligations.count,1);
  assert.equal(pulse.afterCommitments,2500);
  assert.equal(pulse.safeToSpend,2000);
  assert.equal(pulse.balance.quality,'confirmed');
  assert.deepEqual(pulse.sourceIds.commitments,['approved-bill-car']);
});
test('future and prior-cycle entries do not leak into current salary cycle',()=>{
  const pulse=calculateFinancialPulse({asOf:today,approvedEntries:[
    entry('prior','2026-10-25','income',999),
    entry('start','2026-10-26','income',100,'salary'),
    entry('today','2026-11-25','expense',40),
    entry('future','2026-11-26','income',999),
  ]});
  assert.deepEqual(pulse.cycle,{start:'2026-10-26',endExclusive:'2026-11-26',lastDay:'2026-11-25'});
  assert.equal(pulse.recorded.income,100);
  assert.equal(pulse.recorded.expenses,40);
  assert.equal(pulse.recorded.count,2);
});
test('26th salary boundary across New Year and leap February is exact',()=>{
  const feb=calculateFinancialPulse({asOf:'2024-02-29',approvedEntries:[
    entry('jan26','2024-01-26','income',90,'salary'),
    entry('leap','2024-02-29','expense',20),
    entry('mar26','2024-03-26','expense',20)
  ]});
  assert.equal(feb.cycle.start,'2024-02-26');
  assert.equal(feb.cycle.lastDay,'2024-03-25');
  assert.equal(feb.recorded.count,1);
  const year=calculateFinancialPulse({asOf:'2027-01-01',approvedEntries:[]});
  assert.equal(year.cycle.start,'2026-12-26');
  assert.equal(year.cycle.endExclusive,'2027-01-26');
  assert.throws(()=>calculateFinancialPulse({asOf:'2025-02-29',approvedEntries:[]}),/valid calendar date/i);
});
test('stale, unverified or future-dated balances never produce safe-to-spend',()=>{
  const options={asOf:today,approvedEntries:[],commitmentsComplete:true,safetyBuffer:100};
  assert.equal(calculateFinancialPulse({...options,balance:bankBalance(800,'2026-11-21')}).balance.quality,'stale');
  assert.equal(calculateFinancialPulse({...options,balance:bankBalance(800,'2026-11-21')}).safeToSpend,null);
  assert.equal(calculateFinancialPulse({...options,balance:bankBalance(800,'2026-11-25',false)}).balance.quality,'unverified');
  assert.equal(calculateFinancialPulse({...options,balance:bankBalance(800,'2026-11-25',false)}).safeToSpend,null);
  assert.throws(()=>calculateFinancialPulse({...options,balance:bankBalance(800,'2026-11-26')}),/future-dated/);
});
test('incomplete commitments and unspecified buffer never imply funds are available',()=>{
  const base={asOf:today,approvedEntries:[],balance:bankBalance(3000,today)};
  assert.equal(calculateFinancialPulse({...base,commitmentsComplete:false,safetyBuffer:100}).safeToSpend,null);
  assert.equal(calculateFinancialPulse({...base,commitmentsComplete:true}).safeToSpend,null);
  assert.equal(calculateFinancialPulse({...base,commitmentsComplete:true,safetyBuffer:0}).safeToSpend,3000);
});
test('unapproved or duplicate bills fail closed rather than creating fictitious certainty',()=>{
  const base={asOf:today,approvedEntries:[],balance:bankBalance(2000,today),
    commitmentsComplete:true,safetyBuffer:200};
  const a=commitment('gym',350,today);
  const unapproved=calculateFinancialPulse({...base,commitments:[{...a,approved:false}]});
  assert.equal(unapproved.obligations.coverage,'incomplete');
  assert.equal(unapproved.safeToSpend,null);
  const repeated=calculateFinancialPulse({...base,commitments:[a,a]});
  assert.equal(repeated.obligations.unsettled,350);
  assert.equal(repeated.safeToSpend,null);
});
test('unsettled overdue bills are retained, not silently forgotten',()=>{
  const pulse=calculateFinancialPulse({asOf:today,approvedEntries:[],
    balance:bankBalance(500,today),commitmentsComplete:true,safetyBuffer:100,
    commitments:[commitment('overdue',700,'2026-10-24')]}
  );
  assert.equal(pulse.obligations.overdueCount,1);
  assert.equal(pulse.afterCommitments,-200);
  assert.equal(pulse.safeToSpend,0);
  assert.ok(pulse.warnings.some(w=>w.includes('past their due dates')));
});
test('settled commitments are excluded; posted ledger charges are not deducted twice',()=>{
  const pulse=calculateFinancialPulse({asOf:today,
    approvedEntries:[entry('paid','2026-11-01','expense',1200)],
    balance:bankBalance(2000,today),commitmentsComplete:true,safetyBuffer:200,
    commitments:[commitment('already-settled',1200,'2026-11-01',{settled:true})]
  });
  assert.equal(pulse.recorded.expenses,1200);
  assert.equal(pulse.obligations.unsettled,0);
  assert.equal(pulse.safeToSpend,1800);
});
test('invalid or duplicate ledger entries are explicitly flagged and block safe-spend certainty',()=>{
  const v=entry('same',today,'expense',100);
  const pulse=calculateFinancialPulse({asOf:today,approvedEntries:[v,v],
    balance:bankBalance(400,today),commitmentsComplete:true,safetyBuffer:100
  });
  assert.equal(pulse.recorded.expenses,100);
  assert.equal(pulse.recorded.excludedInvalidOrDuplicate,1);
  assert.equal(pulse.safeToSpend,null);
  assert.ok(pulse.warnings.some(w=>w.includes('invalid or repeated')));
});
test('all sums use integer cents and reject invalid money or unsupported currency',()=>{
  const pulse=calculateFinancialPulse({asOf:today,approvedEntries:[
    entry('1',today,'income',0.10),entry('2',today,'income',0.20)
  ]});
  assert.equal(pulse.recorded.income,0.3);
  assert.throws(()=>calculateFinancialPulse({asOf:today,approvedEntries:[],
    balance:bankBalance(-5,today)}),/nonnegative/);
  assert.throws(()=>calculateFinancialPulse({asOf:today,approvedEntries:[],
    commitments:[commitment('bad',Number.NaN,today)]}),/nonnegative/);
  assert.throws(()=>calculateFinancialPulse({asOf:today,approvedEntries:[],
    balance:{...bankBalance(100,today),currency:'USD'}}),/identified ZAR/);
});
