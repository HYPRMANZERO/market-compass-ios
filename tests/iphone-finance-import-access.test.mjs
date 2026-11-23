import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const app=await readFile(new URL('App.tsx',root),'utf8');
const owner=await readFile(new URL('components/OwnerBudgetDraftEditor.tsx',root),'utf8');
const statements=await readFile(new URL('components/LocalFinanceFiles.tsx',root),'utf8');
const assistant=await readFile(new URL('components/VoiceAssistant.tsx',root),'utf8');

test('original PWA Home and Spend expose straightforward iPhone file access',async()=>{
  const mobile=await readFile(new URL('components/MobileOverview.tsx',root),'utf8');
  assert.match(mobile,/href="\/expenses" className="mc-quick-action"/);
  assert.match(app,/id="mc-home-upload"/);
  assert.match(app,/<Route path="\/expenses"><ExpenseLedger data=\{data\} setData=\{setData\}/);
  assert.match(app,/<OwnerBudgetDraftEditor/);
  assert.match(app,/<LocalFinanceFiles/);
  assert.match(owner,/return <section id="mc-finance-import"/);
  assert.match(statements,/return <section id="mc-financial-files"/);
  assert.doesNotMatch(owner,/return <details className="mb-5/);
  assert.doesNotMatch(statements,/return <details className="mb-5/);
});
test('owner JSON chooser is visible, does not filter away iPhone Files, and offers a paste fallback',()=>{
  assert.match(owner,/<input type="file"[\s\S]*?onChange=\{event=>/);
  assert.match(owner,/file\.name\.toLowerCase\(\)\.endsWith\('\.json'\)/);
  assert.match(owner,/await readOwnerFileText\(file\)/);
  assert.match(owner,/new FileReader\(\)/);
  assert.match(owner,/Paste owner-budget JSON instead/);
  assert.match(owner,/parseOwnerBudgetDraft\(text\)/);
  assert.match(owner,/onSave\(preview\)/);
  assert.doesNotMatch(owner,/fetch\(|axios|XMLHttpRequest/);
});
test('financial statement picker needs no label before choosing, with explicit review and save',()=>{
  assert.match(statements,/disabled=\{safe\.length>=MAX_FINANCE_FILES\|\|reading\}/);
  assert.doesNotMatch(statements,/disabled=\{[^}]*label\.trim\(\)\.length/);
  assert.match(statements,/const selectedFiles=Array\.from\(event\.currentTarget\.files/);
  assert.match(statements,/importFinanceBatch\(files,\{/);
  assert.match(statements,/void selected\(selectedFiles,oneTimePassword\)/);
  assert.match(statements,/onAdd\(preview\)/);
  assert.match(statements,/not uploaded to HYPRBOX, GitHub or an AI provider/);
  assert.doesNotMatch(statements,/fetch\(|axios|XMLHttpRequest/);
});

test('local finance and owner budget replies remain local even with Agent mode enabled',()=>{
  assert.match(assistant,/result\.source === 'local-finance-documents'/);
  assert.match(assistant,/result\.source === 'local-owner-budget'/);
  const check=assistant.indexOf("result.source === 'local-finance-documents'");
  const send=assistant.indexOf('void askDesktop(question, id);');
  assert.ok(check>0&&send>check,'Local replies must be handled before remote inference');
});
