import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
// pnpm installs this dependency in the application workspace, not root tests.
import * as pdfjs from '../artifacts/market-compass/node_modules/pdfjs-dist/legacy/build/pdf.mjs';

// Entirely fabricated encrypted statement; no owner's financial documents
// or actual passwords should ever be copied into code or CI logs.
const bytes=Buffer.from((await readFile(
  new URL('./fixtures/synthetic-password-payslip.pdf.b64',import.meta.url),'utf8'
)).trim(),'base64');

async function parse(password){
  const task=pdfjs.getDocument({
    data:Uint8Array.from(bytes),password,useSystemFonts:false,
  });
  try {
    const doc=await task.promise;
    const page=await doc.getPage(1);
    const text=await page.getTextContent();
    return text.items.map(x=>'str' in x?x.str:'').join(' ');
  }finally{
    await task.destroy();
  }
}

test('the pinned PDF.js engine decrypts a synthetic password-protected text PDF',async()=>{
  const text=await parse('SYNTHETIC_ONLY');
  assert.match(text,/Net pay R7200\.00/);
  assert.match(text,/Insurance R450\.50/);
});

test('the pinned engine does not read encrypted PDF contents without the password',async()=>{
  await assert.rejects(()=>parse('INCORRECT_SYNTHETIC_PASSWORD'),(err)=>
    err && err.name==='PasswordException');
  await assert.rejects(()=>parse(''),(err)=>
    err && err.name==='PasswordException');
});
