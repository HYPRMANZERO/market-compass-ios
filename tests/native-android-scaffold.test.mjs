import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
test('generated Android shell is WebView-only and does not request unrestricted private-device access',async()=>{
 const base=new URL('../artifacts/market-compass/android/',import.meta.url);
 const manifest=await readFile(new URL('app/src/main/AndroidManifest.xml',base),'utf8');
 const main=await readFile(new URL('app/src/main/java/com/hyprmanzero/marketcompass/MainActivity.java',base),'utf8');
 assert.match(main,/extends BridgeActivity/);
 assert.match(manifest,/android:allowBackup="false"/);
 assert.match(manifest,/android:usesCleartextTraffic="false"/);
 assert.match(manifest,/android\.permission\.INTERNET/);
 assert.doesNotMatch(manifest,/READ_EXTERNAL_STORAGE|MANAGE_EXTERNAL_STORAGE|READ_SMS|READ_CONTACTS|RECORD_AUDIO/);
});
