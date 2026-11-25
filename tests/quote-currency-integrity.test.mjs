import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {canDisplayQuoteInCurrency} from '../artifacts/market-compass/src/lib/quoteCurrencyDisplay.ts';

const source=readFileSync(new URL('../artifacts/market-compass/src/components/LiveCryptoQuotes.tsx',import.meta.url),'utf8');
test('quote currency provenance prevents ZAR and USD relabeling',()=>{
  assert.equal(canDisplayQuoteInCurrency({currency:'ZAR'},'ZAR'),true);
  assert.equal(canDisplayQuoteInCurrency({currency:'USD'},'USD'),true);
  assert.equal(canDisplayQuoteInCurrency({currency:'ZAR'},'USD'),false);
  assert.equal(canDisplayQuoteInCurrency({currency:'USD'},'ZAR'),false);
  assert.equal(canDisplayQuoteInCurrency({currency:'EUR'},'ZAR'),false);
  assert.equal(canDisplayQuoteInCurrency(null,'ZAR'),false);
});
test('all displayed price, market-cap and 24h volume fields use guarded snapshot',()=>{
  assert.match(source,/const displayedSnapshot=canDisplayQuoteInCurrency\(snapshot,selected\)\?snapshot:null/);
  assert.match(source,/const quoteCurrencyMismatch=snapshot!==null&&!canDisplayQuoteInCurrency\(snapshot,selected\)/);
  assert.match(source,/\{displayedSnapshot\?</);
  assert.match(source,/displayedSnapshot\.quotes\.map/);
  assert.match(source,/displayedSnapshot\.providerAsOf/);
  assert.match(source,/displayedSnapshot\.retrievedAt/);
  assert.match(source,/displayedSnapshot\.sourceUrl/);
  assert.match(source,/Saved quote currency \{snapshot\?\.currency\} differs from selected \{selected\}/);
  assert.match(source,/No quote prices are shown/);
  assert.match(source,/No currency conversion was performed/);
});
test('quote refresh, Data Saver and provider timestamp safeguards are preserved',()=>{
  assert.match(source,/aria-label="Refresh live cryptocurrency quotes"/);
  assert.match(source,/if\(dataSaver\)\{pending\.current\?\.abort\(\)/);
  assert.match(source,/Data Saver: previously retrieved, not refreshed/);
  assert.doesNotMatch(source,/convertCurrency\(|placeOrder\(|bankBalance=/);
});
