import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname} from 'node:path';
import {pathsOverlap,protectDeployedPwaDist} from '../scripts/protect-gateway-dist.mjs';

test('build guard recognises exact, ancestor and child output paths',()=>{
  const home=resolve(tmpdir(),'mc-guard-fixtures');
  const live=join(home,'dist','public');
  assert.equal(pathsOverlap(live,live),true);
  assert.equal(pathsOverlap(join(home,'dist'),live),true);
  assert.equal(pathsOverlap(join(live,'assets'),live),true);
  assert.equal(pathsOverlap(join(home,'release-candidates','public'),live),false);
});
test('mock private gateway denies live writes without touching any user vault',async()=>{
  const tmp=await mkdtemp(join(tmpdir(),'mc-safe-build-'));
  try{
    const live=join(tmp,'private-gateway','public');
    const settings=join(tmp,'PrivateAI','gateway-settings.json');
    await mkdir(dirname(settings),{recursive:true});
    await writeFile(settings,JSON.stringify({pwaDist:live,edgeProvider:'ngrok'}));
    assert.throws(()=>protectDeployedPwaDist(live,{settingsPath:settings}),/RELEASE-SAFETY BLOCK/);
    assert.throws(()=>protectDeployedPwaDist(join(live,'assets'),{settingsPath:settings}),/RELEASE-SAFETY BLOCK/);
    assert.throws(()=>protectDeployedPwaDist(dirname(live),{settingsPath:settings}),/RELEASE-SAFETY BLOCK/);
    assert.doesNotThrow(()=>protectDeployedPwaDist(join(tmp,'ReleaseCandidates','public'),{settingsPath:settings}));
    // Windows PowerShell may save this settings file with a UTF-8 BOM.
    await writeFile(settings,'\uFEFF'+JSON.stringify({pwaDist:live}));
    assert.throws(()=>protectDeployedPwaDist(live,{settingsPath:settings}),/RELEASE-SAFETY BLOCK/);
    assert.doesNotThrow(()=>protectDeployedPwaDist(join(tmp,'ReleaseCandidates','public'),{settingsPath:settings}));
    await writeFile(settings,'not-valid-json');
    assert.throws(()=>protectDeployedPwaDist(live,{settingsPath:settings}),/gateway config unreadable/);
    assert.doesNotThrow(()=>protectDeployedPwaDist(join(tmp,'ReleaseCandidates','public'),
      {settingsPath:join(tmp,'missing.json')}));
  }finally{await rm(tmp,{recursive:true,force:true});}
});
test('Vite final resolved output and offline-shell compiler both protect gateway',async()=>{
  const config=await readFile(new URL('../artifacts/market-compass/vite.config.ts',import.meta.url),'utf8');
  const offline=await readFile(new URL('../scripts/prepare-offline-shell.mjs',import.meta.url),'utf8');
  assert.match(config,/configResolved\(config\)\{ protectDeployedPwaDist/);
  assert.match(config,/MC_PWA_OUT_DIR/);
  assert.match(offline,/protectDeployedPwaDist\(root\)/);
  assert.match(offline,/MC_PWA_OUT_DIR/);
});
