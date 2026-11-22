import test from 'node:test';
import assert from 'node:assert/strict';
import {extractPayslipEvidence,payrollPeriodDate} from '../artifacts/market-compass/src/lib/payslipIntelligence.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {documentRowBlockReason,applyReviewedDocumentToLedger} from '../artifacts/market-compass/src/lib/reviewedDocumentLedger.ts';
import {buildPayrollHistory} from '../artifacts/market-compass/src/lib/earningsHistory.ts';
import {importFinanceBatch} from '../artifacts/market-compass/src/lib/batchFinanceImport.ts';

const first='PAYSLIP\nPay Date: 25/11/2025\nEmployee ID number: 1234567890123\nBasic Salary R 27 500.00\nGross Pay R 30 000.00\nPAYE R 4 720.00\nUIF R 177.12\nPension R 950.00\nTotal Deductions R 5 847.12\nNet Pay R 24 152.88\nYear to date Gross Pay R 330 000.00';
const second='PAYSLIP\nSalary Month: October 2025\nGross Earnings R 29 000.00\nNet Salary R 23 200.00\nPAYE R 4 200.00\nUIF R 177.12';
const id1='a'.repeat(64),id2='b'.repeat(64);
const parse=(text,id,day)=>extractLocalFinanceDocument('sample-payslip.pdf',text,'Employment review',{id,now:new Date(day+'T12:00:00Z')});
test('SA payslip extraction identifies gross/net PAYE and UIF without treating deductions as spending',()=>{
 const parsed=extractPayslipEvidence(first);
 assert.equal(parsed.date,'2025-11-25');
 assert.equal(parsed.items.find(x=>x.field==='gross-pay')?.amount,30000);
 assert.equal(parsed.items.find(x=>x.field==='net-pay')?.amount,24152.88);
 assert.equal(parsed.items.find(x=>x.field==='paye')?.amount,4720);
 assert.equal(parsed.items.find(x=>x.field==='uif')?.amount,177.12);
 assert.ok(parsed.items.every(x=>x.semanticRole==='balance-reference'&&x.direction==='unclassified'));
 const doc=parse(first,id1,'2025-11-26');
 assert.equal(doc.accountProfile?.category,'payslip');
 assert.equal(doc.accountProfile?.facts.find(x=>x.field==='net-pay')?.amount,24152.88);
 assert.ok(!JSON.stringify(doc).includes('1234567890123'));
 assert.deepEqual(validateLocalFinanceDocument(doc),doc);
 for(const line of doc.lines)assert.match(documentRowBlockReason(doc,line)??'',/payslip records payroll evidence/i);
 assert.throws(()=>applyReviewedDocumentToLedger(doc,[],[{
    lineIndex:doc.lines.findIndex(x=>x.payrollField==='net-pay'),
    date:'2025-11-25',kind:'income',category:'salary'
  }],'ZAR'),/not a confirmed bank deposit/i);
});
test('payslip periods are explicitly dated, never silently guessed; YTD/multi-column values are skipped',()=>{
 assert.equal(payrollPeriodDate(second),'2025-10-31');
 const data=extractPayslipEvidence(second);
 assert.equal(data.items.find(x=>x.field==='net-pay')?.date,'2025-10-31');
 const ambiguous=extractPayslipEvidence('PAYSLIP\nNet Pay 24 152.88 280 000.00\nGross Pay R 30 000.00\nGross Pay YTD R 330 000.00');
 assert.equal(ambiguous.items.some(x=>x.field==='net-pay'),false);
 assert.equal(ambiguous.items.find(x=>x.field==='gross-pay')?.amount,30000);
 assert.equal(payrollPeriodDate('PAYSLIP\nNovember salary'),null);
});
test('history lists reviewed documents only, marks credit matches as possible, never verified',()=>{
 const firstDoc=parse(first,id1,'2025-11-26');
 const secondDoc=parse(second,id2,'2025-11-01');
 const history=buildPayrollHistory([firstDoc,secondDoc],[
  {id:'bank-1',date:'2025-11-25',recordedAt:'2025-11-26T11:00:00.000Z',kind:'income',
   category:'salary',description:'Salary credit',paidVia:'Owner-reviewed document',
   currency:'ZAR',amount:24152.88}
 ]);
 assert.equal(history.length,2);
 assert.deepEqual(history.map(x=>x.period),['2025-11','2025-10']);
 assert.equal(history[0].netPay,24152.88);
 assert.equal(history[0].grossPay,30000);
 assert.equal(history[0].paye,4720);
 assert.equal(history[0].possibleBankMatch,true);
 assert.equal(history[1].possibleBankMatch,false);
 assert.equal(buildPayrollHistory([firstDoc,firstDoc],[])[1].possibleDuplicate,true);
});
test('batch importer processes multiple PDF selections locally with one temporary password, skips identical content',async()=>{
 const docs=[new File(['X'],'pay-one.pdf'),new File(['X'],'pay-one-again.pdf'),
  new File(['Y'],'pay-two.pdf'),new File(['Z'],'locked.pdf')];
 const text={'pay-one.pdf':first,'pay-one-again.pdf':first,'pay-two.pdf':second};
 let invoked=0;
 const result=await importFinanceBatch(docs,{
  existing:[],label:'',password:'synthetic-only-secret',
  pdfReader:async(file,password)=>{invoked++;assert.equal(password,'synthetic-only-secret');
   if(file.name==='locked.pdf')throw Error('The PDF requires a password');
   return text[file.name];}
 });
 assert.equal(invoked,4);
 assert.equal(result.drafts.length,2);
 assert.equal(result.duplicateCount,1);
 assert.equal(result.failedCount,1);
 assert.equal(result.passwordRequiredCount,1);
 assert.notEqual(result.drafts[0].id,result.drafts[1].id);
 assert.ok(result.drafts.every(d=>!JSON.stringify(d).includes('synthetic-only-secret')));
 const again=await importFinanceBatch([docs[0]],{existing:result.drafts,label:'',password:'',
  pdfReader:async()=>first});
 assert.equal(again.drafts.length,0);
 assert.equal(again.duplicateCount,1);
});
