import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {
  extractLocalFinanceDocument,validateLocalFinanceDocument,addLocalFinanceDocument,
} from '../artifacts/market-compass/src/lib/localFinanceDocs.ts';
import {MAX_LOCAL_PDF_BYTES,MAX_LOCAL_PDF_PAGES,MAX_LOCAL_PDF_TEXT_CHARS}
  from '../artifacts/market-compass/src/lib/localPdfText.ts';

const at=new Date('2026-11-21T12:00:00Z');
const pdfExcerpt='21/11/2026 Net pay R7,200.00\n21/11/2026 Insurance R450.50\n';
test('synthetic selectable PDF text produces bounded owner-reviewed records only',()=>{
  const d=extractLocalFinanceDocument('synthetic.pdf',pdfExcerpt,'Synthetic November payslip',{
    now:at,id:'5be6e725-2367-496e-b697-49ef04085df1'
  });
  assert.equal(d.format,'pdf');
  assert.equal(d.complete,false);
  assert.equal(d.bankVerified,false);
  assert.equal(d.source,'owner-selected-iphone-file');
  assert.equal(d.lines.length,2);
  assert.equal(d.lines[0].amount,7200);
  assert.equal(d.lines[1].amount,450.5);
  assert.equal(d.lines[0].date,'2026-11-21');
  assert.deepEqual(validateLocalFinanceDocument(d),d);
});
test('password, raw bytes, identifiers and file paths never become vault excerpts',()=>{
  const d=extractLocalFinanceDocument('secret.pdf',
    'Account 123456789012 R110.00\nemail synthetic@example.com R70.00',
    'Synthetic statement',{now:at,id:'aa29e706-4467-4942-b805-21d48506eabc'});
  const untrusted={...d,password:'SYNTHETIC_TEST_PASSWORD_DO_NOT_KEEP',sourcePath:'/private/statement.pdf'};
  const stored=addLocalFinanceDocument([],untrusted);
  const saved=JSON.stringify(stored);
  assert.equal(stored.length,1);
  assert.doesNotMatch(saved,/SYNTHETIC_TEST_PASSWORD_DO_NOT_KEEP|private\/statement\.pdf|123456789012|synthetic@example.com/i);
  assert.ok(stored[0].lines.every(line=>line.label.length<=130));
});
test('PDF data must first be extracted with PDF.js; no fake parsing of raw PDF bytes',()=>{
  assert.throws(()=>extractLocalFinanceDocument('locked.pdf','%PDF-1.7','Synthetic PDF'),/recognisable amounts/i);
  assert.throws(()=>extractLocalFinanceDocument('image.png','R100.00','Synthetic image'),/Supported/i);
  assert.ok(MAX_LOCAL_PDF_BYTES>=32_000_000);
  assert.equal(MAX_LOCAL_PDF_PAGES,Infinity);
  assert.ok(MAX_LOCAL_PDF_TEXT_CHARS>=1_000_000);
});
test('UI uses a transient input, not state or settings, for the PDF password',async()=>{
  const ui=await readFile(new URL('../artifacts/market-compass/src/components/LocalFinanceFiles.tsx',import.meta.url),'utf8');
  const parser=await readFile(new URL('../artifacts/market-compass/src/lib/localPdfText.ts',import.meta.url),'utf8');
  assert.match(ui,/passwordInput=useRef/);
  assert.match(ui,/passwordInput\.current\.value=''/);
  assert.match(ui,/extractLocalPdfText\(file,temporaryPassword,\{/);
  assert.doesNotMatch(ui,/setPassword|password:\s*settings|localStorage\.setItem|fetch\(/i);
  assert.match(parser,/task\.destroy\(\)/);
  assert.doesNotMatch(parser,/localStorage|indexedDB|fetch\(/);
});
