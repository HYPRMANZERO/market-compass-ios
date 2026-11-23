import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const root=new URL('../artifacts/market-compass/',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');
test('original PWA includes isolated, interactive Ionic React preview with no live vault access',async()=>{
  const [app,html,preview,style,vite]=await Promise.all([
    read('src/App.tsx'),read('ionic-preview.html'),read('src/IonicPreviewApp.tsx'),
    read('src/ionic-preview.css'),read('vite.config.ts')
  ]);
  assert.match(app,/Ionic UI Preview/);
  assert.match(app,/src=\{import\.meta\.env\.BASE_URL\+'ionic-preview\.html'\}/);
  assert.match(app,/setIonicPreviewOpen/);
  assert.match(html,/ionic-preview-main\.tsx/);
  assert.match(vite,/ionicPreview: path\.resolve/);
  assert.match(preview,/IonActionSheet|IonModal/);
  assert.match(preview,/IonSegmentButton/);
  assert.match(preview,/SAMPLE DATA ONLY/);
  assert.doesNotMatch(preview,/localStorage|indexedDB|fetch\(|sendBeacon|XMLHttpRequest|@\/lib\/localVault/);
  assert.match(style,/--ion-color-primary/);
});
test('Capacitor native shell uses isolated output and has no embedded remote gateway',async()=>{
  const [config,script,packageJson]=await Promise.all([
    read('capacitor.config.ts'),read('scripts/build-native.mjs'),read('package.json')
  ]);
  assert.match(config,/webDir:'dist\/native'/);
  assert.match(config,/appId:'com\.hyprmanzero\.marketcompass'/);
  assert.doesNotMatch(config,/server:\s*\{[^}]*url\s*:/);
  assert.match(script,/BASE_PATH:'\/'/);
  assert.match(script,/MC_PWA_OUT_DIR/);
  const p=JSON.parse(packageJson);
  assert.ok(p.dependencies['@ionic/react']);
  assert.ok(p.dependencies['@capacitor/core']);
  assert.ok(p.devDependencies['@ionic/cli']);
  assert.ok(p.devDependencies['@capacitor/cli']);
  assert.ok(p.scripts['native:build']);
});
