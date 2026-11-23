import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const file=name=>readFile(new URL(name,root),'utf8');

test('primary PWA is Ionic, not an embedded sample preview',async()=>{
  const [app,entry]=await Promise.all([file('App.tsx'),file('main.tsx')]);
  assert.match(entry,/setupIonicReact\(\{mode:'ios'\}\)/);
  assert.match(entry,/ionic-shell\.css/);
  assert.match(app,/<IonApp className="mc-ionic-app">/);
  assert.match(app,/<IonHeader className="mc-mobile-header/);
  assert.match(app,/<IonToolbar className="mc-ionic-toolbar">/);
  assert.match(app,/<IonFooter className="mc-ionic-footer/);
  assert.match(app,/menuOpen && createPortal\(/);
  assert.match(app,/<IonSegment className="mc-spend-tabs"/);
  assert.match(app,/<IonSegmentButton key=\{id\}/);
  assert.doesNotMatch(app,/iframe title="Interactive Market Compass Ionic React preview/);
});

test('safe area has one opaque status-bar backing and no fixed blur layer',async()=>{
  const css=await file('ionic-shell.css');
  assert.match(css,/\.mc-mobile-header \{[\s\S]*?position: sticky !important;/);
  assert.match(css,/\.mc-mobile-header::before,\s*\.mc-mobile-header::after \{ display: none !important; \}/);
  assert.match(css,/--ion-safe-area-top: 0px;/);
  assert.match(css,/@media\(display-mode:standalone\) and \(max-width:1023px\)/);
  assert.match(css,/padding-top: calc\(max\(env\(safe-area-inset-top,0px\),20px\) \+ 12px\) !important;/);
  assert.match(css,/\.mc-vault-entry \{[\s\S]*?padding-top: calc\(32px \+ env\(safe-area-inset-top,0px\)\) !important;/);
  assert.match(css,/-webkit-backdrop-filter: none !important;/);
  assert.match(css,/\.mc-mobile-content \{ padding-bottom: calc\(88px \+ env\(safe-area-inset-bottom,0px\)\) !important;/);
});

test('Ionic document flow restores vertical touch scrolling to the login and all Wouter routes',async()=>{
  const css=await file('ionic-shell.css');
  assert.match(css,/html\.plt-pwa \{[\s\S]*?overflow-y: auto !important;/);
  assert.match(css,/body \{[\s\S]*?position: relative !important;[\s\S]*?max-height: none !important;[\s\S]*?overflow-y: visible !important;[\s\S]*?touch-action: auto !important;/);
  assert.match(css,/ion-app\.mc-ionic-app \{[\s\S]*?overflow: visible !important;[\s\S]*?contain: none !important;/);
});

test('menu is a compact body portal with safe scrolling, not a blank Ionic breakpoint sheet',async()=>{
  const [app,css]=await Promise.all([file('App.tsx'),file('ionic-shell.css')]);
  assert.match(app,/menuOpen && createPortal\(/);
  assert.match(app,/mc-quick-menu-panel/);
  assert.match(app,/document\.body\)\}/);
  assert.match(app,/setMenuOpen\(false\)/);
  assert.match(css,/\.mc-quick-menu-panel\{max-height:min\(77dvh/);
  assert.match(css,/html\.mc-menu-open,body\.mc-menu-open\{overflow-y:hidden !important;/);
  assert.doesNotMatch(app,/<IonModal isOpen=\{menuOpen\}/);
});

test('account list and category details use Ionic components but keep their finance sources',async()=>{
  const [home,spend,activity]=await Promise.all([
    file('components/MobileOverview.tsx'),
    file('components/SpendingPortfolio.tsx'),
    file('components/IonicSpendPreview.tsx')
  ]);
  assert.match(home,/<IonCard className="mc-wallet-hero"/);
  assert.match(home,/<IonList className="mc-account-list">/);
  assert.match(home,/<IonModal isOpen=\{accountActionsOpen\}/);
  assert.match(spend,/<IonAccordionGroup multiple=\{true\}/);
  assert.match(spend,/spendingCycleSummaries\(/);
  assert.match(activity,/const valid=entries\.filter/);
  assert.match(activity,/<IonCard className="mc-ionic-finance-card/);
  assert.match(activity,/<IonSegment scrollable value=\{filter\}/);
  assert.doesNotMatch(activity,/localStorage|indexedDB|fetch\(|sendBeacon\(/);
});
