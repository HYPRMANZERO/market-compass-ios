import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/',import.meta.url);
const read=p=>readFile(new URL(p,root),'utf8');

test('original PWA keeps its own features and a visible account action portal',async()=>{
  const [app,home]=await Promise.all([read('src/App.tsx'),read('src/components/MobileOverview.tsx')]);
  assert.match(app,/menuOpen && createPortal\(/);
  assert.match(home,/accountActionsOpen && createPortal\(/);
  assert.match(app,/mc-add-debt-account/);
  assert.match(app,/Save account/);
  assert.match(app,/saved accounts stay collapsed|Existing accounts stay collapsed/);
  assert.match(app,/<Route path="\/banks">/);
});
test('public assistant has compact controls without the bulky voice card',async()=>{
  const [voice,css]=await Promise.all([read('src/components/VoiceAssistant.tsx'),read('src/ionic-shell.css')]);
  assert.doesNotMatch(voice,/Spoken response voice preferences/);
  assert.match(voice,/Turn on spoken replies/);
  assert.match(voice,/mc-assistant-dock/);
  assert.match(css,/mc-assistant-dock-card/);
});
test('bank logos resolve with fallback only after image load failure',async()=>{
  const [home,bank]=await Promise.all([read('src/components/MobileOverview.tsx'),read('src/components/BankCarousel.tsx')]);
  assert.match(home,/<BankCarousel compact/);
  assert.match(bank,/\{failed\?<Landmark/);
  assert.match(bank,/onError=\{\(\)=>setFailed\(true\)\}/);
  const svg=await read('public/bank-logos/absa.svg');
  assert.match(svg,/<svg/);
  const png=await stat(new URL('public/bank-logos/capitec.png',root));
  assert.ok(png.size>500);
});
test('saved Capfin reclassification needs explicit owner acceptance',async()=>{
  const [app,review]=await Promise.all([read('src/App.tsx'),read('src/components/SavedCategoryReview.tsx')]);
  assert.match(app,/applySavedCategoryChanges/);
  assert.match(app,/<SavedCategoryReview/);
  assert.match(review,/Approve \{currentSuggestions\.length\} selected on this page/);
  assert.match(review,/Scan saved payments/);
  assert.match(review,/Needs your decision/);
  assert.match(review,/categoryReviewPage/);
});