import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {classifyImportFailure,importRecoveryAdvice,safeImportFailures}
  from '../artifacts/market-compass/src/lib/documentImportRecovery.ts';

test('PDF password failure produces actionable local-only recovery guidance',()=>{
  assert.equal(classifyImportFailure(Error('PDF requires a password')),'password');
  assert.equal(classifyImportFailure(Error('temporary password was incorrect')),'password');
  assert.match(importRecoveryAdvice('password').nextStep,/one-time local password/);
});
test('scanned and unreadable PDFs have different remedies',()=>{
  assert.equal(classifyImportFailure(Error('PDF contains no selectable text on page 5 of 9')),'scanned');
  assert.equal(classifyImportFailure(Error('The PDF has no selectable text')),'scanned');
  assert.match(importRecoveryAdvice('scanned').nextStep,/offline OCR/);
  assert.equal(classifyImportFailure(Error('Invalid PDF structure')),'unreadable');
});
test('limits, formats, empty files and capacity never pretend to be bank errors',()=>{
  assert.equal(classifyImportFailure(Error('PDF exceeds the 64 MB on-device memory safety limit')),'size');
  assert.equal(classifyImportFailure(Error('Unsupported format')),'format');
  assert.equal(classifyImportFailure(Error('PDF has no pages')),'empty');
  assert.equal(classifyImportFailure(Error('The encrypted document summary capacity is full')),'capacity');
  assert.match(importRecoveryAdvice('capacity').nextStep,/back up/);
});
test('private error message and extra attacker-supplied fields are stripped from reports',()=>{
  const entries=[{index:1,code:'password',filename:'ID123.pdf',password:'secret'},
    {index:2,code:'scanned',message:'account 12345'},
    {index:0,code:'empty'},{index:3,code:'invalid'},
    {index:4,code:'size'}];
  const safe=safeImportFailures(entries);
  assert.deepEqual(safe,[{index:1,code:'password'},{index:2,code:'scanned'},{index:4,code:'size'}]);
  assert.doesNotMatch(JSON.stringify(safe),/ID123|secret|account|12345|filename/i);
});
test('both editions display document-recovery steps without uploading sensitive files',()=>{
  const ui=readFileSync(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
  assert.match(ui,/importRecoveryAdvice/);
  assert.match(ui,/No extracted information has been saved|nothing was automatically recorded/i);
  assert.doesNotMatch(ui,/fetch\(.*file|uploadToCloud/);
});
import {importFinanceBatch} from '../artifacts/market-compass/src/lib/batchFinanceImport.ts';

test('personal batch reports each failed position, never the file name or parser error',async()=>{
 const files=[
   {name:'Private statement.pdf',size:100},
   {name:'Unknown.statement',size:10},
   {name:'Empty.csv',size:0}
 ];
 const result=await importFinanceBatch(files,{
   existing:[],label:'',password:'temporary owner password',
   pdfReader:async()=>{throw Error('This PDF requires a password: account 12345');}
 });
 assert.equal(result.failedCount,3);
 assert.equal(result.passwordRequiredCount,1);
 assert.deepEqual(result.failures,[
   {index:1,code:'password'},{index:2,code:'format'},{index:3,code:'empty'}
 ]);
 assert.doesNotMatch(JSON.stringify(result.failures),/Private|statement|12345|temporary|password:/i);
 assert.equal(result.drafts.length,0);
});
