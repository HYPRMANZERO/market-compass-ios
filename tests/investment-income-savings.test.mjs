import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {scanSavedCategories,applySavedCategoryChanges,allowedSavedCategory}
  from '../artifacts/market-compass/src/lib/savedCategoryReview.ts';
import {suggestKnownSpendCategory,cycleAnalysis,EXPENSE_CATEGORIES}
  from '../artifacts/market-compass/src/lib/monthlyExpenses.ts';
import {supportedInvestingPlatformRegion}
  from '../artifacts/market-compass/src/lib/investmentNarration.ts';
import {extractLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {preparedDocumentReview} from '../artifacts/market-compass/src/lib/reviewSuggestions.ts';
import {allowedDocumentCategories,applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';

const row=(id,description,kind='expense',category='other',currency='ZAR')=>({
 id,description,kind,category,amount:150,date:'2026-11-26',
 recordedAt:'2026-11-26T08:00:00Z',paidVia:'Bank statement',
 currency,note:'Synthetic evidence: unchanged'
});
const scan=(description,kind='expense',region='ZA')=>
 scanSavedCategories([row('a',description,kind)],region).proposals[0];

test('dividends and interest are separate income categories when credited',()=>{
 for(const [desc,cat] of [
   ['DIVIDEND RECEIVED XYZ LTD','dividends'],
   ['ETF DISTRIBUTION CREDITED','dividends'],
   ['CASH DIVIDEND PAYMENT','dividends'],
   ['INTEREST RECEIVED SAVINGS ACCOUNT','interest'],
   ['SAVINGS INTEREST EARNED','interest'],
   ['INTEREST CR BANK ACCOUNT','interest'],
   ['BOND COUPON RECEIVED','interest']
 ]){
   const p=scan(desc,'income','ZA');
   assert.equal(p?.kind,'income',desc);
   assert.equal(p?.category,cat,desc);
   assert.equal(suggestKnownSpendCategory('income',desc,'ZA'),cat,desc);
 }
 assert.equal(allowedSavedCategory('income','interest'),true);
 assert.equal(allowedSavedCategory('income','dividends'),true);
 assert.equal(allowedSavedCategory('expense','dividends'),false);
 assert.equal(allowedSavedCategory('expense','interest'),false);
 assert.equal(allowedSavedCategory('income','savings'),false);
});

test('declared/accrued/reinvested amounts and expense-direction conflicts are not treated as cash received',()=>{
 for(const desc of [
   'DIVIDEND DECLARED', 'DIVIDEND PENDING PAYMENT',
   'DIVIDEND REINVESTMENT DRIP','DRIP DIVIDEND REINVESTED',
   'INTEREST ACCRUED','INTEREST PENDING CREDIT',
   'ETF DISTRIBUTION ANNOUNCED',
   'FIXED DEPOSIT MATURITY PROCEEDS',
   'DIVIDEND RECEIVED REVERSAL'
 ])assert.equal(scan(desc,'income'),undefined,desc);
 for(const desc of ['DIVIDEND RECEIVED','INTEREST EARNED'])
   assert.equal(scan(desc,'expense'),undefined,desc);
 assert.equal(scan('INTEREST CHARGED PERSONAL LOAN','expense')?.category,'fees');
 assert.equal(scan('DIVIDEND WITHHOLDING TAX','expense')?.category,'taxes');
 assert.equal(scan('DIVIDEND WITHHOLDING TAX','income'),undefined);
 assert.equal(scan('BROKERAGE FEE','expense')?.category,'fees');
 assert.equal(scan('JSE SETTLEMENT FEE','expense')?.category,'fees');
});

test('Savings is distinct from investment funding and interest income',()=>{
 for(const desc of [
   'TRANSFER TO SAVINGS ACCOUNT',
   'MONTHLY SAVINGS CONTRIBUTION',
   'SAVINGS POCKET DEPOSIT',
   'DEPOSIT INTO MY SAVINGS',
   'AUTOMATIC TRANSFER TO SAVINGS'
 ]){
   const p=scan(desc,'expense');
   assert.equal(p?.kind,'transfer',desc);
   assert.equal(p?.category,'savings',desc);
 }
 assert.equal(scan('WITHDRAWAL FROM MY SAVINGS ACCOUNT','income')?.category,'savings');
 assert.equal(scan('INTEREST EARNED IN MY SAVINGS ACCOUNT','income')?.category,'interest');
});

test('brokerage funding and listed securities purchases are investment transfers, not dividends',()=>{
 const examples=[
   ['EASYEQUITIES EFT DEPOSIT','ZA'],
   ['EASY EQUITIES PAYMENT TO','ZA'],
   ['SATRIXNOW ETF PURCHASE','ZA'],
   ['SYGNIA INVESTMENT CONTRIBUTION','ZA'],
   ['SHYFT SHARES EFT DEPOSIT','ZA'],
   ['JSE SHARES BUY','ZA'],
   ['UNIT TRUST CONTRIBUTION','ZA'],
   ['ETF PURCHASE','ZA'],
   ['Fidelity Investments Brokerage Deposit','US'],
   ['Hargreaves Lansdown investment deposit','GB'],
   ['Wealthsimple Trade deposit','CA'],
   ['Commsec share trading funding','AU'],
   ['Zerodha payment to','IN'],
   ['Interactive Brokers EFT Deposit','US']
 ];
 for(const [desc,region] of examples){
   const p=scan(desc,'expense',region);
   assert.equal(p?.kind,'transfer',desc);
   assert.equal(p?.category,'investments',desc);
   assert.match(p.reason,/(?:ownership|destination|Brokerage)/,desc);
 }
 assert.equal(scan('Transfer from investment account','income')?.category,'investments');
});

test('platform names alone, currency wallets, dividends and exchanges do not imply fund transfers',()=>{
 const cases=[
   ['EASYEQUITIES','ZA'],
   ['JSE','ZA'],
   ['JSE LISTED','ZA'],
   ['SATRIXNOW','ZA'],
   ['SHYFT TOP UP','ZA'],
   ['SHYFT FOREX WALLET FUNDING','ZA'],
   ['Fidelity Life Insurance','US'],
   ['Robinhood subscription fee','US'],
   ['EASY EQUITIES EFT DEPOSIT','US'],
   ['Hargreaves Lansdown Investment Deposit','ZA'],
   ['Standard Bank fees','ZA'],
   ['SWIFT PAYMENT','US'],
   ['SEPA TRANSFER','DE'],
   ['PIX PAYMENT','BR']
 ];
 for(const [desc,region] of cases){
   const p=scan(desc,'expense',region);
   if(desc==='Robinhood subscription fee'||desc==='Standard Bank fees'||desc==='Fidelity Life Insurance'){
      assert.notEqual(p?.category,'investments',desc);
   }else{
      assert.equal(p?.category,undefined,desc);
   }
 }
 assert.equal(supportedInvestingPlatformRegion('ZA').hasRegionalPlatformTerms,true);
});

test('approvals retain exact evidence, and dashboard separates income from transfers',()=>{
 const entries=[
  row('div','DIVIDEND RECEIVED XYZ','income'),
  row('int','INTEREST EARNED SAVINGS ACCOUNT','income'),
  row('save','TRANSFER TO MY SAVINGS ACCOUNT'),
  row('broker','EASY EQUITIES EFT DEPOSIT'),
  row('fee','BROKERAGE FEE'),
  row('declared','DIVIDEND DECLARED','income'),
  row('already','CASH DIVIDEND PAYMENT','income','side-income')
 ];
 const old=JSON.stringify(entries);
 const offers=scanSavedCategories(entries,'ZA').proposals;
 assert.equal(offers.length,5);
 assert.equal(JSON.stringify(entries),old);
 const approved=applySavedCategoryChanges(entries,offers,'ZA');
 assert.deepEqual(approved.map(x=>x.category),[
   'dividends','interest','savings','investments','fees','other','side-income'
 ]);
 for(let i=0;i<entries.length;i++){
   for(const field of ['id','date','recordedAt','amount','currency','description','paidVia','note'])
     assert.equal(approved[i][field],entries[i][field],field);
 }
 const before=cycleAnalysis(entries,'2026-11-26','ZAR');
 const after=cycleAnalysis(approved,'2026-11-26','ZAR');
 assert.equal(before.count,after.count);
 assert.equal(after.income,before.income);
 assert.equal(after.income,600);
 assert.equal(after.transfers,300);
 assert.equal(after.outflow,150);
 assert.ok(after.byIncomeCategory.some(x=>x.category==='dividends'&&x.amount===150));
 assert.ok(after.byIncomeCategory.some(x=>x.category==='interest'&&x.amount===150));
 assert.ok(after.byTransferCategory.some(x=>x.category==='savings'&&x.amount===150));
 assert.ok(after.byTransferCategory.some(x=>x.category==='investments'&&x.amount===150));
 assert.equal(after.byCategory.find(x=>x.category==='investments'),undefined);
 assert.equal(scanSavedCategories(approved,'ZA').proposals.length,0);
});

test('document review can prepare credited dividends/interest and explicit savings or investing debits without auto-posting',()=>{
 const source=[
   'Date,Description,Debit,Credit',
   '27 Nov 26,ETF DISTRIBUTION CREDITED,,125.25',
   '27 Nov 26,SAVINGS INTEREST EARNED,,12.35',
   '27 Nov 26,EASYEQUITIES EFT DEPOSIT,600.00,',
   '27 Nov 26,TRANSFER TO SAVINGS ACCOUNT,400.00,',
   '27 Nov 26,DIVIDEND DECLARED,,99.00'
 ].join('\n');
 const doc=extractLocalFinanceDocument('review.csv',source,'Synthetic brokerage statement',
   {id:'a27c11cd-127f-4d17-9270-116bd264ac24',now:new Date('2026-11-28T12:00:00.000Z')});
 assert.equal(doc.lines.length,5);
 const prepared=doc.lines.map((_,i)=>preparedDocumentReview(doc,i,'ZA'));
 assert.deepEqual(prepared.map(x=>x&&[x.kind,x.category]),[
   ['income','dividends'],['income','interest'],['transfer','investments'],
   ['transfer','savings'],null
 ]);
 assert.ok(allowedDocumentCategories('income').includes('dividends'));
 assert.ok(allowedDocumentCategories('income').includes('interest'));
 assert.ok(allowedDocumentCategories('transfer').includes('investments'));
 assert.equal(doc.lines[0].date,'2026-11-27');
 const originals=JSON.stringify(doc.lines);
 const approvals=prepared.map((x,i)=>x?{lineIndex:i,...x}:null).filter(Boolean);
 assert.equal(approvals.length,4);
 const posted=applyReviewedDocumentToLedger(doc,[],approvals,'ZAR',new Date('2026-11-28T12:00:00.000Z'));
 assert.equal(posted.length,4);
 assert.deepEqual(posted.map(x=>x.category),['dividends','interest','investments','savings']);
 assert.equal(JSON.stringify(doc.lines),originals);
});
test('document period or a dividend declaration never substitutes for completed cash-credit evidence',()=>{
 const source='Date,Description,Debit,Credit\n27 Nov 26,DIVIDEND DECLARED,,155.00\n27 Nov 26,INTEREST ACCRUED,,14.00';
 const doc=extractLocalFinanceDocument('review.csv',source,'Synthetic statement',
   {id:'d6d04d7f-2f67-427c-bfad-0bb25021820f',now:new Date('2026-11-28T12:00:00.000Z')});
 assert.equal(preparedDocumentReview(doc,0),null);
 assert.equal(preparedDocumentReview(doc,1),null);
});

test('both edition finance screens expose saved categories and income/transfer breakdowns',()=>{
 const ui=readFileSync(new URL('../artifacts/market-compass/src/components/MonthlyExpenses.tsx',import.meta.url),'utf8');
 const cat=readFileSync(new URL('../artifacts/market-compass/src/lib/monthlyExpenses.ts',import.meta.url),'utf8');
 for(const label of ['Dividends received','Interest earned','Savings / deposits','Investments / brokerage funding'])
   assert.ok(cat.includes(label),label);
 for(const marker of ['analysis.byIncomeCategory','analysis.byTransferCategory','Income sources','Savings and investment movements'])
   assert.ok(ui.includes(marker),marker);
 assert.ok(EXPENSE_CATEGORIES.some(x=>x.value==='dividends'));
 assert.ok(EXPENSE_CATEGORIES.some(x=>x.value==='interest'));
});
