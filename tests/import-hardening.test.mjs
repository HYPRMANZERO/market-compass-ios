import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  extractLocalFinanceDocument,addLocalFinanceDocument,sameReviewedFinanceEvidence
} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {
  listConsentedFinanceFiles,FOLDER_SCAN_MAX_CANDIDATES
} from '../artifacts/market-compass/src/lib/consentedFolderScan.ts';
import {summarizeDocumentHistory} from '../artifacts/market-compass/src/lib/documentHistory.ts';

const now=new Date('2026-11-22T18:00:00Z');
const salary='Payslip\nPay date: 21 Nov 2026\nGross Pay: 12,500.00\nPAYE: 2,000.00\nNet Pay: 10,500.00';
const a=extractLocalFinanceDocument('synthetic-nov.pdf',salary,'November pay',{
  now,id:'ae000000-0000-4000-8000-000000000001'
});
const b=extractLocalFinanceDocument('renamed-export.pdf',salary,'My employer',{
  now,id:'ae000000-0000-4000-8000-000000000002'
});

test('renaming an identical payroll export cannot duplicate historical facts',()=>{
  assert.notEqual(a.id,b.id);
  assert.notEqual(a.label,b.label);
  assert.equal(sameReviewedFinanceEvidence(a,b),true);
  assert.throws(()=>addLocalFinanceDocument([a],b),/already saved|duplicate/i);
  const totals=summarizeDocumentHistory([a,b]);
  assert.equal(totals.months.length,1);
  assert.equal(totals.months[0].netPay,10500);
  assert.equal(totals.duplicateSources,1);
  assert.equal(totals.documentsReviewed,2);
});
test('different payment dates are distinct evidence, and unknown dates are not invented',()=>{
  const december=extractLocalFinanceDocument('pay-dec.pdf',
    salary.replace('21 Nov 2026','21 Dec 2026'),'December pay',{
      now,id:'ae000000-0000-4000-8000-000000000003'
    });
  assert.equal(sameReviewedFinanceEvidence(a,december),false);
  assert.equal(addLocalFinanceDocument([a],december).length,2);
  const months=summarizeDocumentHistory([a,december]).months.map(x=>x.month);
  assert.deepEqual(months,['2026-12','2026-11']);
});
test('truncated documents cannot be auto-classified as identical when their unseen tails may differ',()=>{
  const source={...a,truncated:true};
  const repeated={...b,truncated:true};
  assert.equal(sameReviewedFinanceEvidence(source,repeated),false);
  assert.equal(addLocalFinanceDocument([source],repeated).length,2);
});
test('different identified providers are not merged as duplicates solely by identical amounts',()=>{
  const second={...b,accountProfile:{...b.accountProfile,institution:'Another bank',
    name:'Another bank Employment income'}};
  assert.equal(sameReviewedFinanceEvidence(a,second),false);
  assert.equal(addLocalFinanceDocument([a],second).length,2);
});
test('selected-folder discovery stops at bounded file count and never reads file text',async()=>{
  let opened=0;
  const dir={kind:'directory',name:'chosen',async *values(){
    for(let i=0;i<500;i++)yield {kind:'file',name:'financial-'+i+'.pdf',
      async getFile(){opened++;return {name:'financial-'+i+'.pdf',size:100,lastModified:1};}};
  }};
  const result=await listConsentedFinanceFiles(dir);
  assert.equal(result.items.length,FOLDER_SCAN_MAX_CANDIDATES);
  assert.equal(result.truncated,true);
  assert.equal(opened,FOLDER_SCAN_MAX_CANDIDATES);
});
test('a revoked/cancelled folder scan cannot continue collecting new documents',async()=>{
  const abort=new AbortController();
  let examined=0;
  const dir={kind:'directory',name:'chosen',async *values(){
    for(let i=0;i<20;i++)yield {kind:'file',name:'file-'+i+'.pdf',
      async getFile(){
        examined++;
        if(examined===2)abort.abort();
        return {name:'file-'+i+'.pdf',size:150,lastModified:1};
      }};
  }};
  await assert.rejects(()=>listConsentedFinanceFiles(dir,{signal:abort.signal}),/cancelled/);
  assert.equal(examined,2);
});
test('iPhone intake disables reselection or cancellation during a pending vault update',async()=>{
  const ui=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',
    import.meta.url),'utf8');
  assert.match(ui,/addLocalFinanceDocument\(documents,preview\)/);
  assert.match(ui,/pendingSaveId/);
  assert.match(ui,/documents\.some\(document=>document\.id===pendingSaveId\)/);
  assert.match(ui,/!reading&&!pendingSaveId/);
  assert.match(ui,/disabled=\{safe\.length>=MAX_FINANCE_FILES\|\|reading\|\|!!preview\|\|needsPassword\|\|!!pendingSaveId/);
  assert.match(ui,/readController\.current\?\.abort\(\)/);
  assert.doesNotMatch(ui,/localStorage\.setItem|fetch\(/);
});
