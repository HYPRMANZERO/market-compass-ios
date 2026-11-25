import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {financialSourceStatus} from '../artifacts/market-compass/src/lib/financialSourceStatus.ts';
const entry=(id,date)=>({id,date,description:'Synthetic entry',kind:'expense',category:'other',currency:'ZAR',amount:50,recordedAt:'2026-11-24T14:00:00Z',paidVia:'Manual review'});
const document=(id,importedAt,rows,timeContext)=>({
 id,label:'Synthetic finance document',format:'csv',source:'owner-selected-iphone-file',bankVerified:false,complete:false,
 importedAt,lines:rows.map(date=>({date,label:'Synthetic payment',amount:15})),truncated:false,
 ...(timeContext?{timeContext}:{})
});

test('source freshness keeps imported time, source coverage and approval date independent',()=>{
 const entries=[entry('e1','2026-11-20'),entry('e2','2026-10-30')];
 const docs=[document('d1','2026-11-24T18:00:00.000Z',['2026-08-20','2026-09-10'])];
 const result=financialSourceStatus(entries,docs,'2026-11-25');
 assert.equal(result.latestApprovedDay,'2026-11-20');
 assert.equal(result.latestReportedDay,'2026-09-10');
 assert.equal(result.latestImportedDay,'2026-11-24');
 assert.equal(result.daysSinceReport,76);
 assert.equal(result.bankConnected,false);
 assert.equal(result.approvedCount,2);
 assert.equal(result.documentCount,1);
});
test('explicit as-of evidence counts as reporting date without inventing dated transactions',()=>{
 const docs=[document('d1','2026-11-20T12:00:00Z',[],{from:null,to:null,asOf:'2026-09-30',basis:'explicit-as-of'})];
 const result=financialSourceStatus([],docs,'2026-11-25');
 assert.equal(result.latestReportedDay,'2026-09-30');
 assert.equal(result.latestApprovedDay,null);
});
test('no local data is not mistaken for connected bank or zero spending',()=>{
 const state=financialSourceStatus([],[],'2026-11-25');
 assert.equal(state.latestApprovedDay,null);
 assert.equal(state.latestImportedDay,null);
 assert.equal(state.latestReportedDay,null);
 assert.equal(state.bankConnected,false);
});
test('future dated or invalid rows are not advertised as latest verified records',()=>{
 const docs=[document('d1','2026-12-01T12:00:00Z',['2026-12-03']),document('d2','2026-11-22T11:00:00Z',['2026-10-30'])];
 const state=financialSourceStatus([entry('bad','2026-02-30'),entry('future','2026-12-05')],docs,'2026-11-25');
 assert.equal(state.latestApprovedDay,null);
 assert.equal(state.latestReportedDay,'2026-10-30');
 assert.equal(state.latestImportedDay,'2026-11-22');
 assert.equal(state.futureApprovedCount,1);
 assert.equal(state.futureDocumentCount,1);
});
test('both Home and Spend present the same read-only component with no mutation or network',()=>{
 const app=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
 const panel=readFileSync(new URL('../artifacts/market-compass/src/components/FinancialSourceStatusPanel.tsx',import.meta.url),'utf8');
 const helper=readFileSync(new URL('../artifacts/market-compass/src/lib/financialSourceStatus.ts',import.meta.url),'utf8');
 assert.equal((app.match(/<FinancialSourceStatusPanel entries=\{/g)||[]).length,2);
 assert.match(panel,/Latest approved entry/);
 assert.match(panel,/Last file imported/);
 assert.match(panel,/Document reports through/);
 assert.match(panel,/Not connected/);
 assert.doesNotMatch(panel+helper, /fetch\(|\.setItem\(|\.push\(|writeVault\(|setData\(/);
});
