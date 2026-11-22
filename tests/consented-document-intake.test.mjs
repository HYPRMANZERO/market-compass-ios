import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {listConsentedFinanceFiles} from '../artifacts/market-compass/src/lib/consentedFolderScan.ts';
import {extractLocalFinanceDocument,validateLocalFinanceDocument}
  from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {classifyDocument} from '../artifacts/market-compass/src/lib/documentIntelligence.ts';
import {summarizeDocumentHistory} from '../artifacts/market-compass/src/lib/documentHistory.ts';

const sample={now:new Date('2026-11-22T16:00:00Z'),
  id:'39cf1479-2445-4db4-b1db-ce1ea309e922'};
test('explicitly dated payslip populates historical earning facts without claiming a bank balance',()=>{
  const source=['Payslip','Pay date: 21 Nov 2026',
    'Gross Pay: 12,500.00','PAYE: 2,000.00','Net Pay: 10,500.00'].join('\n');
  const doc=extractLocalFinanceDocument('pay.pdf',source,'Selected employment record',sample);
  assert.equal(doc.accountProfile?.category,'payslip');
  const net=doc.lines.find(x=>/Net Pay/.test(x.label));
  assert.equal(net?.date,'2026-11-21');
  assert.equal(net?.amount,10500);
  assert.equal(doc.accountProfile?.facts.find(f=>f.field==='net-pay')?.asOf,'2026-11-21');
  assert.equal(doc.accountProfile?.facts.find(f=>f.field==='gross-pay')?.amount,12500);
  assert.equal(doc.accountProfile?.facts.find(f=>f.field==='tax-withheld')?.amount,2000);
  assert.equal(doc.bankVerified,false);
  assert.deepEqual(validateLocalFinanceDocument(doc),doc);
});
test('a purchase receipt is recognised without inventing a posted expense',()=>{
  const text='Purchase receipt\n21 Nov 2026 Total paid 250.50\nVAT 32.61';
  const doc=extractLocalFinanceDocument('receipt.pdf',text,'Owner selected receipt',sample);
  assert.equal(classifyDocument(text).category,'receipt');
  assert.equal(doc.accountProfile?.category,'receipt');
  assert.equal(doc.lines[0].date,'2026-11-21');
  assert.equal(doc.lines[0].direction,'unclassified');
  assert.equal(doc.accountProfile?.facts.find(f=>f.field==='receipt-total')?.amount,250.5);
  assert.equal(doc.complete,false);
});
test('consented directory scanner inventories only financial metadata',async()=>{
  const touched=[];
  const doc=(name,size,modified)=>({kind:'file',name,
    async getFile(){touched.push(name);return {name,size,lastModified:modified};}});
  const nested={kind:'directory',name:'bank',async *values(){
    yield doc('statement.pdf',900,1000);
    yield doc('holiday.jpg',10000,1000);
  }};
  const root={kind:'directory',name:'chosen',async *values(){
    yield doc('payslip.pdf',150,2000);
    yield nested;
    yield doc('readme.md',50,100);
  }};
  const got=await listConsentedFinanceFiles(root);
  assert.equal(got.truncated,false);
  assert.equal(got.items.length,2);
  assert.deepEqual(touched,['payslip.pdf','statement.pdf']);
  assert.ok(got.items.every(item=>!('text' in item)&&!('rawBytes' in item)));
  assert.equal(got.items[1].fingerprint,'bank/statement.pdf|900|1000');
});
test('UI requires explicit selection and review, and manual quote refresh lacks a 90s lockout',async()=>{
  const component=await readFile(
    new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
  const quotes=await readFile(
    new URL('../artifacts/market-compass/src/components/LiveCryptoQuotes.tsx',import.meta.url),'utf8');
  assert.match(component,/type="file" multiple/);
  assert.match(component,/Encrypted PDF detected/);
  assert.match(component,/Unlock &amp; review this PDF/);
  assert.match(component,/showDirectoryPicker/);
  assert.match(component,/onAdd\(preview\)/);
  assert.doesNotMatch(component,/localStorage\.setItem|fetch\(/);
  assert.doesNotMatch(quotes,/lastRequest|90_000|Market refresh is limited to one request/);
  assert.match(quotes,/if\(pending\.current\)return/);
});

test('historical dashboard preview keeps payslips, receipts and bank debits separate',()=>{
  const pay=extractLocalFinanceDocument('salary.pdf',
    'Payslip\nPay date: 21 Nov 2026\nNet pay R10 500.00',
    'November payroll',{...sample,id:'00000000-1111-4111-8111-111111111111'});
  const receipt=extractLocalFinanceDocument('receipt.pdf',
    'Receipt\n21 Nov 2026 Total paid 250.50',
    'Purchase evidence',{...sample,id:'00000000-2222-4222-8222-222222222222'});
  const statement=extractLocalFinanceDocument('statement.csv',
    'Date;Description;Debit;Credit\n21/11/2026;Groceries;200,00;\n21/11/2026;Wages;;10500,00',
    'November bank export',{...sample,id:'00000000-3333-4333-8333-333333333333'});
  assert.equal(statement.accountProfile?.category,'bank-statement');
  const history=summarizeDocumentHistory([pay,receipt,statement]);
  assert.equal(history.months.length,1);
  assert.equal(history.months[0].month,'2026-11');
  assert.equal(history.months[0].netPay,10500);
  assert.equal(history.months[0].receiptSpend,250.5);
  assert.equal(history.months[0].statementDebits,200);
  assert.equal(history.months[0].debitRows,1);
  assert.equal(history.documentsReviewed,3);
  assert.equal(history.undatedEvidence,0);
});
test('undated pay evidence is not allocated to an invented pay month',()=>{
  const pay=extractLocalFinanceDocument('salary.pdf','Payslip\nNet Pay R7,200.00',
    'Undated salary',{...sample,id:'00000000-4444-4444-8444-444444444444'});
  const history=summarizeDocumentHistory([pay]);
  assert.equal(history.months.length,0);
  assert.equal(history.undatedEvidence,1);
});
