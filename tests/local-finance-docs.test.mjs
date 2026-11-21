import test from 'node:test';
import assert from 'node:assert/strict';
import {
  extractLocalFinanceDocument,validateLocalFinanceDocument,
  addLocalFinanceDocument,removeLocalFinanceDocument,MAX_FINANCE_FILES
} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {answerFromOfflineFinanceDocs} from '../artifacts/market-compass/src/lib/offlineFinanceDocs.ts';
import {interpretCompassCommand} from '../artifacts/market-compass/src/lib/compassCommands.ts';

// Fully fabricated fixtures. Do not add an owner's financial data to CI.
const digits=value=>String(value).replace(/[\s\u00a0\u202f]/g,'');
const now=new Date('2026-11-21T12:00:00Z');
let serial=0;
const extract=(name,text,label='Synthetic financial export')=>
  extractLocalFinanceDocument(name,text,label,{now,
    id:'e5bb6756-3da9-4296-8ec7-'+String(++serial).padStart(12,'0')});
const csv='Date,Description,Amount\n2026-09-12,"Synthetic travel, test",-481.75\n2026-09-12,Salary,7125.10\n';

test('local CSV parser handles quoted commas and preserves owner-labelled provenance',()=>{
 const d=extract('synthetic.csv',csv);
 assert.equal(d.source,'owner-selected-iphone-file');
 assert.equal(d.bankVerified,false);
 assert.equal(d.complete,false);
 assert.equal(d.lines[0].label,'Synthetic travel, test');
 assert.equal(d.lines[0].amount,-481.75);
 assert.equal(d.lines[0].date,'2026-09-12');
 assert.equal(d.lines[1].amount,7125.10);
 assert.deepEqual(validateLocalFinanceDocument(d),d);
 assert.equal(JSON.stringify(d).includes('ciphertext'),false);
});
test('semicolon CSV parses decimal commas and separates synthetic debits/credits',()=>{
 const d=extract('example.csv',
   'Date;Description;Debit;Credit\n12/09/2026;Synthetic charge;345,60;\n12/09/2026;Synthetic income;;7125,10');
 assert.equal(d.lines.length,2);
 assert.equal(d.lines[0].amount,345.6);
 assert.equal(d.lines[0].direction,'outgoing');
 assert.equal(d.lines[1].amount,7125.10);
 assert.equal(d.lines[1].direction,'incoming');
});
test('plain text and JSON parse locally with identifier masking and no unwanted fields',()=>{
 const txt=extract('example.txt',
   'Example pay R7,125.10\nAccount 123456789012 R311.00\nemail demo@example.com payment R411.50','Synthetic payslip');
 assert.equal(txt.lines.length,3);
 assert.equal(txt.lines[0].amount,7125.10);
 assert.doesNotMatch(JSON.stringify(txt),/123456789012|demo@example\.com/);
 const json=extract('example.json',JSON.stringify({transactions:[
  {date:'2026-09-12',description:'Synthetic subscription',amount:99.99,secret:'DO_NOT_KEEP'},
  {date:'12/09/2026',description:'Synthetic utilities',amount:401}
 ]}),'Synthetic receipt lines');
 assert.equal(json.lines.length,2);
 assert.equal(json.lines[1].date,'2026-09-12');
 assert.doesNotMatch(JSON.stringify(json),/DO_NOT_KEEP/);
});
test('unsupported and malformed inputs never become saved financial records',()=>{
 for(const [name,body] of [
  ['statement.pdf','%PDF-1.7'],['photo.png','image bytes'],['table.xlsx','zip'],
  ['empty.csv','Date,Description,Amount'],
  ['other.csv','Field,Total\nName,300'],['broken.json','{']
 ]) assert.throws(()=>extract(name,body),Error,name);
 assert.throws(()=>extract('synthetic.csv','Date,Description,Amount\n2026-09-12,Test,200','x'));
 const expanded=extract('synthetic.csv',
   'Date,Description,Amount\n'+Array.from({length:1500},()=> '2026-09-12,Test,200').join('\n'));
 assert.equal(expanded.truncated,true);
});
test('only bounded reviewed excerpts are added/removed, and invalid entries fail closed',()=>{
 const d=extract('synthetic.csv',csv);
 assert.equal(addLocalFinanceDocument([],d).length,1);
 assert.throws(()=>addLocalFinanceDocument([d],d),/duplicate/i);
 assert.throws(()=>addLocalFinanceDocument([{...d,bankVerified:true}],d),/invalid/i);
 assert.throws(()=>removeLocalFinanceDocument([{...d,bankVerified:true}],d.id),/Unrecognised/);
 const items=Array.from({length:MAX_FINANCE_FILES},(_,i)=>({...d,
   id:'b51e0c41-1011-4b39-94c8-'+String(i+1).padStart(12,'0')}));
 assert.throws(()=>addLocalFinanceDocument(items,d),/12-document/);
 assert.deepEqual(removeLocalFinanceDocument([d],d.id),[]);
});
test('offline assistant cites approved synthetic excerpts but never invents live funds',()=>{
 const d=extract('sample-salary.csv',
   'Date,Description,Amount\n2026-09-12,Salary,7125.10\n2026-09-12,Synthetic subscription,-99.99',
   'Synthetic September payslip');
 const question='What does my Synthetic September payslip say about salary?';
 const answer=answerFromOfflineFinanceDocs(question,[d]);
 assert.ok(answer);
 assert.match(answer,/Synthetic September payslip/);
 assert.match(digits(answer),/7125[,.]10/);
 assert.match(answer,/not a complete statement|Not a complete statement/i);
 assert.doesNotMatch(answer,/bank verified/i);
 const ctx={currency:'ZAR',monthlyExtra:'',accounts:[],draftCount:0,
   localFinanceDocuments:[d]};
 assert.equal(interpretCompassCommand(question,ctx).type,'answer');
 assert.match(interpretCompassCommand('Which files are imported?',ctx).reply,
   /Synthetic September payslip/);
 assert.equal(answerFromOfflineFinanceDocs('Buy Bitcoin',[d]),null);
 assert.equal(answerFromOfflineFinanceDocs('What is my balance?',[]),null);
 assert.match(interpretCompassCommand('Transfer money now',ctx).reply,/cannot transfer money/i);
});
