import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';

const src = new URL('../artifacts/market-compass/src/', import.meta.url);
const assets = new URL('../artifacts/market-compass/public/bank-logos/', import.meta.url);
const file = relative => readFile(new URL(relative, src), 'utf8');

test('mobile footer has Home, Markets, AI and Menu only', async () => {
  const app = await file('App.tsx');
  const footer = app.slice(app.indexOf('<IonFooter className="mc-ionic-footer'), app.indexOf('</IonFooter>'));
  assert.match(footer, /grid-cols-4/);
  assert.match(footer, /filter\(item => \['\/', '\/markets', '\/assistant'\]/);
  assert.match(footer, /data-testid="mobile-nav-menu"/);
  assert.match(footer, /onClick=\{\(\)=>setMenuOpen\(true\)\}/);
  assert.doesNotMatch(footer, /href:\s*'\/debt'|href:\s*'\/expenses'|href:\s*'\/drafts'/);
  assert.match(app, /href:'\/debt'/);
  assert.match(app, /href:'\/expenses'/);
  assert.match(app, /href:'\/drafts'/);
});

test('Ionic menu uses real scroll content and shows bank route', async () => {
  const app = await file('App.tsx');
  const modal = app.slice(app.indexOf('<IonModal isOpen={menuOpen}'), app.indexOf('</IonModal>'));
  assert.match(modal, /<IonContent className="mc-menu-content" scrollY=\{true\}>/);
  assert.match(modal, /<\/IonContent>/);
  assert.match(modal, /Link a bank/);
  assert.match(app, /<Route path="\/banks">/);
});

test('bank carousel is horizontally swipeable, actionable and on Home screen', async () => {
  const [component, home] = await Promise.all([file('components/BankCarousel.tsx'), file('components/MobileOverview.tsx')]);
  assert.match(home, /<BankCarousel compact onImportDocuments=\{onImportDocuments\}/);
  assert.match(component, /snap-x snap-mandatory/);
  assert.match(component, /overflow-x-auto/);
  assert.match(component, /onClick=\{\(\) => setSelected\(bank.id\)\}/);
  assert.match(component, /onClick=\{onImportDocuments\}/);
  assert.match(component, /loading="eager"/);
  assert.match(component, /<Landmark size=\{25\} aria-hidden="true"\/>/);
  assert.doesNotMatch(component, /\{bank\.monogram\}/,'avoid displaying transient bank initials while icons load');
  assert.match(component, /Live account linking is not enabled|Secure live account linking is not enabled/);
  assert.match(component, /Bank Zero–Mukuru/);
});

test('bank identity files are present and valid png assets', async () => {
  const ids=['standard-bank','absa','fnb','nedbank','capitec','discovery','gotyme','bank-zero','mukuru','african-bank','investec'];
  for (const id of ids) {
    const jpg = ['standard-bank','absa','bank-zero'].includes(id);
    const url = new URL(id + (jpg ? '.jpg' : '.png'), assets);
    assert.ok((await stat(url)).size > 500, id + ': missing logo');
    const bytes = await readFile(url);
    assert.equal(bytes.subarray(0, jpg ? 3 : 8).toString('hex'), jpg ? 'ffd8ff' : '89504e470d0a1a0a', id + ': invalid image');
  }
});
