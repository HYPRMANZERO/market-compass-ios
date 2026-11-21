import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {evaluateFinancialReadiness}
  from '../artifacts/market-compass/src/lib/financialReadiness.ts';

const now=new Date('2026-11-21T13:00:00Z');
const empty=()=>({
  currency:'ZAR',currencyReviewRequired:false,
  privateBudget:{monthlyIncome:'',monthlyEssentials:'',liquidFunds:'',reserveTarget:''},
  accounts:[],expenseEntries:[],localFinanceDocuments:[],ownerBudgetDraft:null
});
const item=(report,id)=>report.items.find(x=>x.id===id);
test('missing financial inputs are labelled missing, never converted to zero',()=>{
  const report=evaluateFinancialReadiness(empty(),now);
  assert.equal(report.items.length,7);
  assert.equal(report.missingCount,7);
  assert.equal(report.reviewCount,0);
  assert.equal(report.requiredInputsRecorded,false);
  assert.equal(report.bankVerifiedCurrentBalance,false);
  assert.equal(report.uploadedToDesktop,false);
  assert.equal(item(report,'expense_ledger').status,'missing');
  assert.match(item(report,'expense_ledger').detail,/does not mean no spending/i);
  assert.match(item(report,'income').detail,/does not mean zero income/i);
  assert.match(report.warning,/Missing records never mean R0/);
  assert.ok(report.items.every(x=>x.detail&&x.nextStep&&/^\/(debt|expenses)$/.test(x.route)));
});
test('historical owner budget and partial debt records do not override current missing data',()=>{
  const data=empty();
  data.ownerBudgetDraft={recordedAt:'2026-10-15',salary:7500};
  data.accounts=[{name:'Example card',balance:'2000',apr:'',minimumPayment:''}];
  const report=evaluateFinancialReadiness(data,now);
  assert.equal(item(report,'income').status,'missing');
  assert.match(item(report,'income').detail,/dated owner-budget reference/i);
  assert.equal(item(report,'debt_accounts').status,'review');
  assert.equal(item(report,'owner_budget').status,'review');
  assert.equal(report.requiredInputsRecorded,false);
});
test('explicit zero values are entered observations, still not verified',()=>{
  const data=empty();
  data.privateBudget={monthlyIncome:'0',monthlyEssentials:'0',liquidFunds:'0',reserveTarget:'0'};
  data.accounts=[{name:'Example card',balance:'0',apr:'0',minimumPayment:'0'}];
  data.expenseEntries=[{date:'2026-11-20',kind:'expense',amount:0}];
  data.localFinanceDocuments=[{label:'Synthetic statement',importedAt:'2026-11-21T12:00:00Z',
    truncated:false,lines:[{label:'Synthetic salary',amount:2000,date:'2026-11-19',direction:'incoming'}]}];
  data.ownerBudgetDraft={recordedAt:'2026-11-19',salary:0};
  const report=evaluateFinancialReadiness(data,now);
  assert.equal(report.missingCount,0);
  assert.equal(report.reviewCount,0);
  assert.equal(report.requiredInputsRecorded,true);
  assert.equal(item(report,'cash_reserve').status,'recorded');
  assert.equal(item(report,'documents').status,'recorded');
  assert.equal(report.bankVerifiedCurrentBalance,false);
  assert.equal(report.uploadedToDesktop,false);
  assert.match(item(report,'debt_accounts').detail,/not independently verified/i);
  assert.match(report.warning,/not bank-verified/i);
});
test('invalid, partial, old, truncated or unreviewed currency inputs stay in review',()=>{
  const data=empty();
  data.privateBudget={monthlyIncome:'1,000',monthlyEssentials:'?',liquidFunds:'100',reserveTarget:''};
  data.accounts=[{name:'Example lender',balance:'200',apr:'20',minimumPayment:'10'}];
  data.expenseEntries=[{date:'2026-09-01',kind:'expense',amount:100}];
  data.localFinanceDocuments=[{label:'Synthetic older PDF',importedAt:'2026-11-21T12:00:00Z',
    truncated:true,lines:[{label:'Synthetic fee',amount:20,date:'2026-09-01',direction:'outgoing'}]}];
  const report=evaluateFinancialReadiness(data,now);
  assert.equal(item(report,'income').status,'review');
  assert.equal(item(report,'cash_reserve').status,'review');
  assert.equal(item(report,'expense_ledger').status,'review');
  assert.equal(item(report,'documents').status,'review');
  assert.equal(report.requiredInputsRecorded,false);
  const currency=evaluateFinancialReadiness({...data,currency:'USD'},now);
  assert.equal(item(currency,'debt_accounts').status,'review');
  assert.match(item(currency,'debt_accounts').detail,/ZAR/i);
  const currencyReview=evaluateFinancialReadiness({...data,currencyReviewRequired:true},now);
  assert.match(item(currencyReview,'debt_accounts').detail,/Currency changed/i);
});
test('the checklist is on Spend and Debt Plan without network or AI access',async()=>{
  const root=new URL('../artifacts/market-compass/src/',import.meta.url);
  const ui=await readFile(new URL('components/FinancialReadinessChecklist.tsx',root),'utf8');
  const app=await readFile(new URL('App.tsx',root),'utf8');
  const logic=await readFile(new URL('lib/financialReadiness.ts',root),'utf8');
  assert.match(ui,/What's missing for a financial plan\?/);
  assert.match(ui,/evaluateFinancialReadiness\(data\)/);
  assert.match(ui,/No document contents or financial figures are sent anywhere/);
  assert.match(app,/<FinancialReadinessChecklist data=\{data\} \/>/);
  assert.equal(app.match(/<FinancialReadinessChecklist data=\{data\} \/>/g)?.length,2);
  assert.doesNotMatch(ui,/fetch\(|XMLHttpRequest|navigator\.sendBeacon/);
  assert.doesNotMatch(logic,/fetch\(|XMLHttpRequest|localStorage|indexedDB/);
});
