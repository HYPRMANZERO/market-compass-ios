import test from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {encryptWorkspace,decryptWorkspace,validateRecord} from '../artifacts/market-compass/src/lib/localVault.ts';

// No IndexedDB use. This suite validates encrypted File-export format in
// isolation with invented data, without touching any owner or test browser vault.
if(!globalThis.crypto)globalThis.crypto=webcrypto;

const password='synthetic-only-long-passphrase-for-regression';
const example=()=>({
  drafts:[],queue:[],accounts:[
    {id:'synthetic-1',displayName:'Example account',maskedNumber:'**** 4321',
      currency:'ZAR',balance:1234.56}
  ],
  expenses:Array.from({length:24},(_,i)=>({
    id:'example-'+i,date:'2026-11-01',kind:'expense',category:'unsorted',
    amount:i+1,currency:'ZAR',description:'SYNTHETIC_PURCHASE_NOT_REAL'
  })),
  debtPlans:[{label:'Sample debt',amount:500,kind:'debt'}]
});

test('synthetic encrypted vault export restores full finance data without plaintext leakage',async()=>{
  const value=example();
  const encrypted=await encryptWorkspace(value,password);
  validateRecord(encrypted);
  assert.equal(encrypted.version,2);
  assert.equal(encrypted.kdf,'PBKDF2-SHA256');
  assert.equal(encrypted.cipher,'AES-256-GCM');
  assert.equal(encrypted.iterations,310000);
  assert.equal(encrypted.compression,'gzip');
  assert.equal(encrypted.originalBytes>encrypted.packedBytes,true);
  const fileContents=JSON.stringify(encrypted);
  for(const secret of ['SYNTHETIC_PURCHASE_NOT_REAL','Example account','Sample debt','1234.56']){
    assert.equal(fileContents.includes(secret),false,`plaintext leaked in backup: ${secret}`);
  }
  const parsed=JSON.parse(fileContents);
  assert.deepEqual(await decryptWorkspace(parsed,password),value);
});

test('wrong-password and modified ciphertext backups fail closed without changing any storage',async()=>{
  const original=await encryptWorkspace(example(),password);
  await assert.rejects(decryptWorkspace(original,'different-wrong-passphrase'),/Incorrect password or damaged encrypted vault/);
  const damaged=structuredClone(original);
  const bytes=Buffer.from(damaged.ciphertext,'base64');
  bytes[0]^=0x40;
  damaged.ciphertext=bytes.toString('base64');
  await assert.rejects(decryptWorkspace(damaged,password),/Incorrect password or damaged encrypted vault/);
  assert.deepEqual(await decryptWorkspace(original,password),example());
});

test('backup metadata rejects unsupported versions, compromised KDF, and unsafe compression sizes',async()=>{
  const valid=await encryptWorkspace(example(),password);
  for(const mutate of [
    record=>{record.version=99;},
    record=>{record.kdf='PBKDF2-SHA1';},
    record=>{record.iterations=1;},
    record=>{record.originalBytes=-1;},
    record=>{record.packedBytes=1.5;},
  ]){
    const invalid=structuredClone(valid);
    mutate(invalid);
    assert.throws(()=>validateRecord(invalid),/Unsupported|Invalid/);
  }
  const wrongLength=structuredClone(valid);
  wrongLength.salt=Buffer.from([1,2,3]).toString('base64');
  await assert.rejects(decryptWorkspace(wrongLength,password),/Invalid vault metadata/);
});
