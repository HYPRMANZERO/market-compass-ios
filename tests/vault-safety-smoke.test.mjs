import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {persistLatestAfterPending} from '../artifacts/market-compass/src/lib/vaultWriteCoordinator.ts';
import {encryptWorkspace,decryptWorkspace,validateRecord}
  from '../artifacts/market-compass/src/lib/localVault.ts';

test('lock writes latest only after an in-flight older vault write',async()=>{
  let release;
  const old=new Promise(resolve=>{release=resolve;});
  const stored=[];
  const pending=old.then(()=>{stored.push({version:1});});
  const final=persistLatestAfterPending(pending,{version:2},
    async d=>({...d,encrypted:true}),async record=>{stored.push(record);});
  release();
  await final;
  assert.deepEqual(stored.map(x=>x.version),[1,2]);
  assert.equal(stored[1].encrypted,true);
});
test('earlier failed write is recoverable, but final write failure blocks lock',async()=>{
  let saved;
  await persistLatestAfterPending(Promise.reject(Error('old failure')),
    {value:'LATEST'},async x=>x,async x=>{saved=x;});
  assert.equal(saved.value,'LATEST');
  await assert.rejects(()=>persistLatestAfterPending(Promise.resolve(),
    {value:'LATEST'},async x=>x,async()=>{throw Error('quota exceeded');}),/quota exceeded/);
});
test('synthetic vault ciphertext survives roundtrip without exposing plaintext',async()=>{
  const payload={drafts:[],accounts:[],queue:[],note:'synthetic PAYE 200'};
  const record=await encryptWorkspace(payload,'for-tests-only-not-a-real-secret');
  validateRecord(record);
  assert.ok(!JSON.stringify(record).includes('synthetic PAYE 200'));
  assert.deepEqual(await decryptWorkspace(record,'for-tests-only-not-a-real-secret'),payload);
  await assert.rejects(()=>decryptWorkspace(record,'wrong'),/Incorrect password/);
});
test('daily scheduler never overwrites the live workspace or savedAt',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  const from=src.indexOf('// Daily scheduler only runs');
  const to=src.indexOf('  const exportBackup',from);
  assert.ok(from>0&&to>from);
  const scheduler=src.slice(from,to);
  assert.match(scheduler,/storeDailySnapshot\(record, localDate\(\)\)/);
  assert.doesNotMatch(scheduler,/writeVault\(/);
  assert.doesNotMatch(scheduler,/setSavedAt\(|setLastRecord\(/);
  assert.match(src,/persistLatestAfterPending\(/);
  assert.match(src,/lastSavedDataRef\.current=data/);
  assert.match(src,/locking \|\| lockInProgress\.current \|\| unsavedChanges/);
});
