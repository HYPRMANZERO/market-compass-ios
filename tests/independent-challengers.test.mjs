import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {scoreIndependentDebtStress} from '../artifacts/market-compass/src/lib/independentDebtStress.ts';
import {reviewDocumentClassification} from '../artifacts/market-compass/src/lib/documentChallenger.ts';

const base={monthlyIncome:12000,monthlyEssentials:6000,liquidFunds:5000,reserveTarget:4000,
 proposedExtra:500,accounts:[{balance:10000,apr:20,minimumPayment:500}]};

test('scikit-learn exported debt challenger preserves independent read-only synthetic labels',()=>{
 const result=scoreIndependentDebtStress(base);
 assert.equal(result.available,true);
 assert.equal(result.trainedOnUserTransactions,false);
 assert.equal(result.calibratedToActualDefaultEvents,false);
 assert.equal(result.mode,'local-independent');
 assert.match(result.interpretation,/SYNTHETIC/);
 assert.ok(result.challengers);
 assert.ok(result.challengers.logisticSyntheticScore>=0 && result.challengers.logisticSyntheticScore<=1);
 assert.ok(result.challengers.treeSyntheticScore>=0 && result.challengers.treeSyntheticScore<=1);
 if(result.abstained) assert.equal(result.stressRiskScore,null);
 else assert.ok(result.stressRiskScore>=0 && result.stressRiskScore<=1);
});
test('financial inputs are never assumed zero when missing or malformed',()=>{
 for(const bad of [
  {...base,accounts:[{balance:10000,minimumPayment:500}]},
  {...base,accounts:[]},
  {...base,monthlyIncome:NaN},
  {...base,monthlyIncome:-1},
  {...base,proposedExtra:Infinity},
  {...base,accounts:[{balance:10000,apr:NaN,minimumPayment:500}]},
 ]) {
  const result=scoreIndependentDebtStress(bad);
  assert.equal(result.available,false);
  assert.equal(result.abstained,true);
  assert.equal(result.stressRiskScore,null);
 }
});
test('extreme out-of-distribution debt scenarios abstain instead of inventing confidence',()=>{
 const result=scoreIndependentDebtStress({...base,monthlyEssentials:1e10});
 assert.equal(result.abstained,true);
 assert.equal(result.stressRiskScore,null);
});
test('synthetic document second opinion can never modify extracted transaction evidence',()=>{
 const doc={label:'Bank statement activity',lines:[
  {label:'opening balance',amount:1200,date:'2026-11-03',direction:'incoming'},
  {label:'transaction history',amount:-100,date:'2026-11-04',direction:'outgoing'},
  {label:'deposits and withdrawals',amount:50,date:'2026-11-07',direction:'incoming'}
 ],accountProfile:{category:'unclassified'}};
 const before=structuredClone(doc);
 const result=reviewDocumentClassification(doc);
 assert.deepEqual(doc,before);
 assert.equal(result.syntheticOnly,true);
 assert.ok(['agrees','disagrees','proposal','insufficient'].includes(result.status));
 if(result.status==='proposal')assert.equal(doc.accountProfile.category,'unclassified');
});
test('unfamiliar/noisy document returns an uncertainty label rather than inventing a category',()=>{
 const result=reviewDocumentClassification({label:'???',lines:[]});
 assert.equal(result.status,'insufficient');
 assert.equal(result.suggested,null);
});
test('PWA preserves original dates, payments, owner approval and never auto-sends documents',async()=>{
 const app=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
 const classifier=await readFile(new URL('../artifacts/market-compass/src/lib/documentChallenger.ts',import.meta.url),'utf8');
 assert.match(app,/reviewDocumentClassification\(preview\)/);
 assert.match(app,/Save reviewed excerpts/);
 assert.match(app,/source reporting period|Source-dated history/);
 assert.match(app,/setPreview/);
 assert.match(classifier,/syntheticOnly:true/);
 assert.doesNotMatch(classifier,/fetch\(|axios|\\.post\(|saveAccount\(|writeFile\(/);
});
