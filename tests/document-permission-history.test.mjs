import test from 'node:test';
import assert from 'node:assert/strict';
import {
 scanGrantedFinanceFolder,financeFileSignature,MAX_SCAN_RESULTS
} from '../artifacts/market-compass/src/lib/financialSourcePermissions.ts';
import {buildHistoricalEarnings} from '../artifacts/market-compass/src/lib/historicalEarnings.ts';
import {extractLocalFinanceDocument,addLocalFinanceDocument,sameDocumentEvidence} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';

const input='PAYSLIP\nPay Date: 25/11/2025\nGross Pay R 30 000.00\nNet Pay R 24 152.88\nPAYE R 4 720.00\nUIF R 177.12\nTotal Deductions R 5 847.12';
const mkDoc=(id,text=input)=>extractLocalFinanceDocument('synthetic.pdf',text,'Masked payroll source',{id,now:new Date('2025-11-27T00:00:00Z')});
function folder(files,permission='granted'){
 return {
  kind:'directory',queryPermission:async()=>permission,
  async *values(){for(const f of files)yield f;}
 };
}
function file(name,bytes='synthetic'){
 return {kind:'file',getFile:async()=>new File([bytes],name,{lastModified:1})};
}
test('no browser financial folder is scanned without an explicit read permission',async()=>{
 const blocked=folder([file('payslip.pdf')],'prompt');
 await assert.rejects(scanGrantedFinanceFolder(blocked),/not granted/);
 await assert.rejects(scanGrantedFinanceFolder(folder([],'denied')),/not granted/);
});
test('folder scanner stays inside selected directory, restricts extensions and honors file budgets',async()=>{
 const tree=folder([file('pay1.pdf'),file('statement.csv'),file('photo.png'),
   folder([file('pay2.pdf'),file('secret.exe')])]);
 const found=await scanGrantedFinanceFolder(tree);
 assert.equal(found.files.length,3);
 assert.equal(found.skipped,2);
 assert.deepEqual(found.files.map(f=>f.name),['pay1.pdf','statement.csv','pay2.pdf']);
 assert.equal(found.truncated,false);
 assert.equal(financeFileSignature(found.files[0]),'pay1.pdf|9|1');
 const bounded=await scanGrantedFinanceFolder(folder(Array.from({length:20},(_,i)=>file('p'+i+'.pdf'))),
   {maxResults:2});
 assert.equal(bounded.files.length,2);
 assert.equal(bounded.truncated,true);
 assert.equal(MAX_SCAN_RESULTS>=2,true);
});
test('payslip financial facts are historical evidence; identical files not posted twice',()=>{
 const a=mkDoc('a'.repeat(64)),b=mkDoc('b'.repeat(64));
 assert.equal(a.accountProfile?.category,'payslip');
 assert.equal(a.lines.every(line=>line.semanticRole==='balance-reference'),true);
 assert.equal(sameDocumentEvidence(a,b),true);
 assert.throws(()=>addLocalFinanceDocument([a],b),/repeats a saved summary|duplicate/i);
});
test('earnings history never adds payslip net to approved salary deposits or expenses',()=>{
 const a=mkDoc('a'.repeat(64));
 const summary=buildHistoricalEarnings([a,a],[
  {date:'2025-11-25',kind:'income',category:'salary',amount:24152.88},
  {date:'2025-11-26',kind:'expense',category:'groceries',amount:1600},
  {date:'2025-11-27',kind:'debt-payment',category:'car',amount:3000}
 ]);
 assert.equal(summary.months.length,1);
 assert.equal(summary.months[0].net,24152.88);
 assert.equal(summary.months[0].approvedSalaryIncome,24152.88);
 assert.equal(summary.months[0].approvedExpenses,1600);
 assert.equal(summary.months[0].approvedDebtPayments,3000);
 assert.equal(summary.months[0].payrollDocuments,1);
 assert.equal(summary.months[0].verifiedByBank,false);
});
test('different payslips for one month are flagged, not added into a fictional salary',()=>{
 const a=mkDoc('a'.repeat(64));
 const b=mkDoc('b'.repeat(64),input.replace('24 152.88','24 152.89'));
 const history=buildHistoricalEarnings([a,b],[]);
 assert.equal(history.conflicts,1);
 assert.equal(history.months[0].net,null);
 assert.equal(history.months[0].conflict,true);
});
