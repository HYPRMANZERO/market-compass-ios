import test from 'node:test';
import assert from 'node:assert/strict';
import {encryptWorkspace,decryptWorkspace,validateRecord} from '../artifacts/market-compass/src/lib/localVault.ts';

const synthetic={
  edition:'personal',
  currency:'ZAR',
  expenseEntries:[
    {id:'wage-2026',date:'2026-11-26',recordedAt:'2026-11-26T05:15:00Z',kind:'income',category:'salary',description:'Synthetic salary',paidVia:'Manual',amount:10800,currency:'ZAR'},
    {id:'car-2026',date:'2026-11-26',recordedAt:'2026-11-26T05:20:00Z',kind:'debt-payment',category:'car',description:'Synthetic car instalment',paidVia:'Manual',amount:3569,currency:'ZAR'}
  ],
  accounts:[{id:'synthetic-vehicle',name:'Synthetic vehicle loan',balance:'50000',apr:'15',minimumPayment:'3569'}],
  offlineAgentQuestions:[{id:'draft-1',question:'Review recorded cash flow',createdAt:'2026-11-26T05:25:00Z'}],
  localFinanceDocuments:[{id:'synthetic-source',label:'Synthetic Statement',importedAt:'2026-11-26T05:00:00Z',lines:[]}],
  personalTasks:[{id:'task-1',text:'Export encrypted backup'}]
};
const secret='test-only-long-password-do-not-reuse';
test('encrypted backup restores exact approved financial entries and edition data',async()=>{
  const before=JSON.stringify(synthetic);
  const encrypted=await encryptWorkspace(synthetic,secret);
  validateRecord(encrypted);
  assert.equal(encrypted.cipher,'AES-256-GCM');
  assert.equal(encrypted.kdf,'PBKDF2-SHA256');
  assert.equal(encrypted.version,2);
  assert.equal(typeof encrypted.ciphertext,'string');
  assert.ok(encrypted.ciphertext.length>20);
  assert.doesNotMatch(JSON.stringify(encrypted),/Synthetic vehicle loan|wage-2026|3569|Review recorded cash flow/);
  const restored=await decryptWorkspace(encrypted,secret);
  assert.deepEqual(restored,synthetic);
  assert.equal(JSON.stringify(synthetic),before);
});
test('backup rejects wrong password and tampering without returning partial records',async()=>{
  const encrypted=await encryptWorkspace(synthetic,secret);
  await assert.rejects(decryptWorkspace(encrypted,'incorrect-password'),/Incorrect password|damaged encrypted vault/);
  const changed={...encrypted,ciphertext:(encrypted.ciphertext[0]==='A'?'B':'A')+encrypted.ciphertext.slice(1)};
  await assert.rejects(decryptWorkspace(changed,secret),/Incorrect password|damaged encrypted vault/);
});
test('backup rejects unsupported metadata',async()=>{
  const encrypted=await encryptWorkspace(synthetic,secret);
  assert.throws(()=>validateRecord({...encrypted,iterations:1}),/Unsupported or damaged/);
  assert.throws(()=>validateRecord({...encrypted,cipher:'none'}),/Unsupported or damaged/);
});
