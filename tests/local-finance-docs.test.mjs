import test from 'node:test';
const displayDigits=value=>value.replace(/[\s\u00a0\u202f]/g,'');
import assert from 'node:assert/strict';
import {
  extractLocalFinanceDocument,validateLocalFinanceDocument,
  addLocalFinanceDocument,removeLocalFinanceDocument,MAX_FINANCE_FILES
} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {answerFromOfflineFinanceDocs} from '../artifacts/market-compass/src/lib/offlineFinanceDocs.ts';
import {interpretCompassCommand} from '../artifacts/market-compass/src/lib/compassCommands.ts';
const now=new Date('2026-11-21T12:00:00Z');
let serial=0;
const extract=(name,text,label='October bank export')=>
  extractLocalFinanceDocument(name,text,label,{now,id:'e5bb6756-3da9-4296-8ec7-'+String(++serial).padStart(12,'0')});
const csv='Date,Description,Amount\n2026-10-26,"Fuel, October",-600.00\n2026-10-26,Salary,10400.00\n';
test('local CSV parser handles quoted commas and preserves source provenance',()=>{
 const d=extract('bank.csv',csv);
 assert.equal(d.source,'owner-selected-iphone-file');
 assert.equal(d.bankVerified,false);assert.equal(d.complete,false);
 assert.equal(d.lines[0].label,'Fuel, October');
 assert.equal(d.lines[0].amount,-600);
 assert.equal(d.lines[0].date,'2026-10-26');
 assert.equal(d.lines[1].amount,10400);
 assert.deepEqual(validateLocalFinanceDocument(d),d);
 assert.equal(JSON.stringify(d).includes('ciphertext'),false);
});
test('semicolon CSV parses decimal comma and separates labelled debit and credit',()=>{
 const d=extract('pay.csv','Date;Description;Debit;Credit\n26/10/2026;Car payment;600,20;\n26/10/2026;Salary;;10400,00');
 assert.equal(d.lines.length,2);
 assert.equal(d.lines[0].amount,600.2);
 assert.equal(d.lines[0].direction,'outgoing');
 assert.equal(d.lines[1].amount,10400);
 assert.equal(d.lines[1].direction,'incoming');
});
test('plain text and JSON work locally, masking common identifiers and discarding extra keys',()=>{
 const txt=extract('payslip.txt','Salary R10,400.00\nAccount 123456789012 R520.00\nemail lee@example.com payment R600.20','Payslip');
 assert.equal(txt.lines.length,3);
 assert.equal(txt.lines[0].amount,10400);
 assert.doesNotMatch(JSON.stringify(txt),/123456789012|lee@example\.com/);
 const json=extract('transactions.json',JSON.stringify({transactions:[
  {date:'2026-10-26',description:'Train ticket',amount:220,secret:'DO_NOT_KEEP'},
  {date:'26/10/2026',description:'Insurance',amount:727}
 ]}),'Transport records');
 assert.equal(json.lines.length,2);
 assert.equal(json.lines[1].date,'2026-10-26');
 assert.doesNotMatch(JSON.stringify(json),/DO_NOT_KEEP/);
});
test('unsupported files, malformed or empty exports fail closed and are never silently stored',()=>{
 for(const [name,body] of [
  ['statement.pdf','%PDF-1.7'],['photo.png','image bytes'],['table.xlsx','zip'],
  ['empty.csv','Date,Description,Amount'],
  ['other.csv','Field,Total\nName,300'],['broken.json','{']
 ]) assert.throws(()=>extract(name,body),Error,name);
 assert.throws(()=>extract('bank.csv','Date,Description,Amount\n2026-10-26,Test,200','x'));
 assert.throws(()=>extract('bank.csv','Date,Description,Amount\n2026-10-26,Test,200'.repeat(9000)),/256 KB|CSV has too many rows/);
});
test('only reviewed bounded excerpts can be added or removed, never wipe invalid records',()=>{
 const d=extract('bank.csv',csv);
 assert.equal(addLocalFinanceDocument([],d).length,1);
 assert.throws(()=>addLocalFinanceDocument([d],d),/duplicate/i);
 assert.throws(()=>addLocalFinanceDocument([{...d,bankVerified:true}],d),/invalid/i);
 assert.throws(()=>removeLocalFinanceDocument([{...d,bankVerified:true}],d.id),/Unrecognised/);
 const items=Array.from({length:MAX_FINANCE_FILES},(_,i)=>({...d,id:'b51e0c41-1011-4b39-94c8-'+String(i+1).padStart(12,'0')}));
 assert.throws(()=>addLocalFinanceDocument(items,d),/12-document/);
 assert.deepEqual(removeLocalFinanceDocument([d],d.id),[]);
});
test('offline assistant retrieves only approved document excerpts with source labels, not invented live funds',()=>{
 const d=extract('salary.csv','Date,Description,Amount\n2026-10-26,Salary,10400.00\n2026-10-26,Gym,-873.00','October payslip');
 const q='What does my October payslip say about salary?';
 const answer=answerFromOfflineFinanceDocs(q,[d]);
 assert.ok(answer);
 assert.match(answer,/October payslip/);
 assert.match(displayDigits(answer),/10400/);
 assert.match(answer,/not a complete statement|Not a complete statement/i);
 assert.doesNotMatch(answer,/bank verified/i);
 const ctx={currency:'ZAR',monthlyExtra:'',accounts:[],draftCount:0,localFinanceDocuments:[d]};
 assert.equal(interpretCompassCommand(q,ctx).type,'answer');
 assert.match(interpretCompassCommand('Which files are imported?',ctx).reply,/October payslip/);
 assert.equal(answerFromOfflineFinanceDocs('Buy Bitcoin',[d]),null);
 assert.equal(answerFromOfflineFinanceDocs('What is my balance?',[]),null);
 assert.match(interpretCompassCommand('Transfer money now',ctx).reply,/cannot transfer money/i);
});
