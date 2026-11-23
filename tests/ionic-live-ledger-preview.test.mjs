import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Ionic live-ledger comparison is opt-in and preserves the standard Spend view',async()=>{
 const root=new URL('../artifacts/market-compass/src/',import.meta.url);
 const app=await readFile(new URL('App.tsx',root),'utf8');
 const preview=await readFile(new URL('components/IonicSpendPreview.tsx',root),'utf8');
 assert.match(app,/const \[ionicPreview,setIonicPreview\]=useState\(false\)/);
 assert.match(app,/IonicSpendPreview=lazy\(/);
 assert.match(app,/Original UI/);
 assert.match(app,/<SpendingPortfolio entries=\{ledger\}/);
 assert.match(preview,/IonCard/);
 assert.match(preview,/IonSegment/);
 assert.match(preview,/IonItem/);
 assert.match(preview,/entries:ExpenseEntry\[\]/);
 assert.doesNotMatch(preview,/localStorage|indexedDB|fetch\(|sendBeacon\(|Capacitor\.getPlatform/);
});
