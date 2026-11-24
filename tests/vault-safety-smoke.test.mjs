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

test('new encryption uses fresh 16-byte salt and 12-byte IV on every save',async()=>{
  const pass='synthetic-only-password';
  const a=await encryptWorkspace({value:1},pass),b=await encryptWorkspace({value:1},pass);
  assert.notEqual(a.salt,b.salt);assert.notEqual(a.iv,b.iv);
  assert.equal(Buffer.from(a.salt,'base64').length,16);
  assert.equal(Buffer.from(a.iv,'base64').length,12);
});
test('encrypted vault record enforces AES-256-GCM, PBKDF2 and safe iterations',async()=>{
  const r=await encryptWorkspace({rows:[]},'synthetic-only');
  assert.equal(r.kdf,'PBKDF2-SHA256');assert.equal(r.cipher,'AES-256-GCM');
  assert.equal(r.iterations,310000);assert.equal(r.version,2);
});
test('corrupted ciphertext fails GCM authentication without returning data',async()=>{
  const r=await encryptWorkspace({entries:[{amount:123,tag:'synthetic'}]},'synthetic-only');
  const raw=Buffer.from(r.ciphertext,'base64');raw[raw.length-1]^=1;
  await assert.rejects(decryptWorkspace({...r,ciphertext:raw.toString('base64')},'synthetic-only'),/Incorrect password or damaged/);
});
test('unexpected version and cipher are rejected before attempting restoration',async()=>{
  const r=await encryptWorkspace({rows:[]},'synthetic-only');
  for(const update of [{version:3},{cipher:'AES-CBC'},{iterations:1},{kdf:'scrypt'},{compression:'brotli'}])
    assert.throws(()=>validateRecord({...r,...update}),/Unsupported or damaged/);
});
test('damaged IV and salt cannot decrypt or overwrite existing vault',async()=>{
  const r=await encryptWorkspace({rows:[]},'synthetic-only');
  await assert.rejects(decryptWorkspace({...r,iv:Buffer.from([1]).toString('base64')},'synthetic-only'),/Invalid vault metadata/);
  await assert.rejects(decryptWorkspace({...r,salt:Buffer.from([1]).toString('base64')},'synthetic-only'),/Invalid vault metadata/);
});
test('compression metadata cannot be forged to restore inconsistent data',async()=>{
  const r=await encryptWorkspace({rows:['compressible text '.repeat(200)]},'synthetic-only');
  assert.equal(r.compression,'gzip');
  assert.ok(r.packedBytes<r.originalBytes);
  await assert.rejects(decryptWorkspace({...r,originalBytes:r.originalBytes+4},'synthetic-only'),/Incorrect password or damaged/);
});
test('import only writes encrypted vault after explicit replacement consent and successful decryption',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  const a=src.indexOf('  const importBackup = async');
  const b=src.indexOf('  return { data, setData, password',a);
  assert.ok(a>=0&&b>a);
  const chunk=src.slice(a,b);
  assert.match(chunk,/await readVault\(\).*window.confirm/);
  assert.ok(chunk.indexOf('decryptWorkspace') < chunk.indexOf('await writeVault(incoming)'));
  assert.match(chunk,/file.size > 30 \* 1024 \* 1024/);
});
test('iOS share completion is not incorrectly claimed as a saved Files backup',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(src,/Share sheet completed\. Verify the backup exists in the Files app\./);
});
test('daily backup retention remains separate from the live workspace and capped at seven',async()=>{
  const src=await readFile(new URL('../artifacts/market-compass/src/lib/localVault.ts',import.meta.url),'utf8');
  const section=src.slice(src.indexOf('export async function storeDailySnapshot'));
  assert.match(section,/DAILY_PREFIX \+ date/);
  assert.match(section,/keys.length - 7/);
  assert.doesNotMatch(section,/store.put\(record, RECORD_KEY\)/);
});
