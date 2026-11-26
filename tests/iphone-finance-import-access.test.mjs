import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const app=await readFile(new URL('App.tsx',root),'utf8');
const owner=await readFile(new URL('components/OwnerBudgetDraftEditor.tsx',root),'utf8');
const statements=await readFile(new URL('components/LocalFinanceFiles.tsx',root),'utf8');
const assistant=await readFile(new URL('components/VoiceAssistant.tsx',root),'utf8');

test('original PWA Home and Spend expose straightforward iPhone file access',async()=>{
  const overview=await readFile(new URL('components/MobileOverview.tsx',root),'utf8');
  assert.match(overview,/onClick=\{onImportDocuments\} className="mc-quick-action w-full"/);
  assert.match(overview,/onClick=\{\(\)=>setAccountActionsOpen\(true\)\}/);
  assert.match(app,/aria-label="Import and review financial documents"/);
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
  assert.match(statements,/disabled=\{safe\.length>=MAX_FINANCE_FILES\|\|reading\|\|!!preview\|\|needsPassword\|\|!!pendingSaveId/);
  assert.doesNotMatch(statements,/disabled=\{[^}]*label\.trim\(\)\.length/);
  assert.match(statements,/const privateLabel=maskDocumentPII\(label\.trim\(\) \|\|/);
  assert.match(statements,/extractLocalFinanceDocument\(file\.name,data,privateLabel\)/);
  assert.match(statements,/onAdd\(checked,previewDecisions\)/);
  assert.match(statements,/not uploaded to GitHub/);
  assert.doesNotMatch(statements,/fetch\(|axios|XMLHttpRequest/);
});

test('private Ollama is mandatory for explanation; offline does not impersonate AI',()=>{
  assert.match(assistant,/const agentMode = true/);
  assert.match(assistant,/void askDesktop\(question, id\)/);
  assert.match(assistant,/if \(!connected\)/);
  assert.match(assistant,/onQueueReadOnlyQuestion\(question\)/);
  assert.doesNotMatch(assistant,/if \(result\.source === 'local-finance-documents'\)/);
  assert.doesNotMatch(assistant,/if \(result\.source === 'local-owner-budget'\)/);
});
