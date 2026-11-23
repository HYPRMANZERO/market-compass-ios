import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('Ionic finance activity is the default and original portfolio remains available',async()=>{
 const root=new URL('../artifacts/market-compass/src/',import.meta.url);
 const app=await readFile(new URL('App.tsx',root),'utf8');
 const finance=await readFile(new URL('components/IonicSpendPreview.tsx',root),'utf8');
 const css=await readFile(new URL('ionic-shell.css',root),'utf8');
 assert.match(app,/IonicSpendPreview=lazy\(/);
 assert.match(app,/<IonicSpendPreview entries=\{ledger\}/);
 assert.match(app,/<SpendingPortfolio entries=\{ledger\}/);
 assert.doesNotMatch(app,/setIonicPreviewOpen|Compare Ionic components|Try Ionic design/);
 assert.match(finance,/IonCard/);
 assert.match(finance,/IonSegment/);
 assert.match(finance,/IonItem/);
 assert.match(finance,/entries:ExpenseEntry\[\]/);
 assert.match(css,/mc-finance-total/);
 assert.match(css,/safe-area-inset-top/);
 assert.doesNotMatch(finance,/localStorage|indexedDB|fetch\(|sendBeacon\(|Capacitor\.getPlatform/);
});
