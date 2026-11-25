import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {mobileFooterCorrection} from '../artifacts/market-compass/src/lib/mobileViewportRecovery.ts';

test('moves the tab bar down into the uncovered visual viewport after keyboard close',()=>{
  assert.equal(mobileFooterCorrection(844,782,0),62);
  assert.equal(mobileFooterCorrection(844,844,62),62,'does not accumulate shifts across measurements');
  assert.equal(mobileFooterCorrection(844,844,0),0,'normal layout stays fixed');
  assert.equal(mobileFooterCorrection(844,905,0),-61,'can correct WebKit overshoot');
});
test('never follows large keyboard geometry jumps or invalid readings',()=>{
  assert.equal(mobileFooterCorrection(490,844,0),0);
  assert.equal(mobileFooterCorrection(844,NaN,0),0);
  assert.equal(mobileFooterCorrection(Infinity,800,0),0);
  assert.equal(mobileFooterCorrection(844,846,0),0);
});
test('correction resets when the viewport and fixed footer agree again',()=>{
  assert.equal(mobileFooterCorrection(844,900,56),0);
});
test('global recovery follows visible viewport events and leaves persistent financial UI data alone',()=>{
  const helper=readFileSync(new URL('../artifacts/market-compass/src/lib/mobileViewportRecovery.ts',import.meta.url),'utf8');
  const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/useEffect\(\(\)=>installMobileViewportRecovery\(\),\[\]\)/);
  assert.match(app,/leavingAssistant.*path!==.\/assistant/);
  assert.match(app,/setTimeout\(reset,delay\)/);
  assert.match(app,/textarea\.mc-composer-input.*active\.blur/);
  assert.match(helper,/visual\?\.addEventListener\('resize',schedule\)/);
  assert.match(helper,/visual\?\.addEventListener\('scroll',schedule\)/);
  assert.match(helper,/window\.addEventListener\('pageshow',settle\)/);
  assert.match(helper,/document\.addEventListener\('visibilitychange',onVisibility\)/);
  assert.match(helper,/nav\.style\.removeProperty\('translate'\)/);
  assert.doesNotMatch(helper,/localStorage|indexedDB|fetch\(|setInterval\(/);
});
