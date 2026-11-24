import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const root=new URL('../artifacts/market-compass/src/',import.meta.url);
const read=p=>readFileSync(new URL(p,root),'utf8');

test('Standard Bank UI is Finance-only and requires current same-origin encrypted desktop session',()=>{
 const component=read('components/StandardBankConnection.tsx');
 const app=read('App.tsx');
 const hub=read('components/AccountsPlatformHub.tsx');
 assert.match(component,/currentAssistantEdition\(\)==='finance'/);
 assert.match(component,/if\(!finance\)return null/);
 assert.match(component,/settings\.enabled&&settings\.token/);
 assert.match(component,/new URL\(settings\.url,window\.location\.href\)\.origin===window\.location\.origin/);
 assert.match(hub,/showStandardBankConnect=\{currentAssistantEdition\(\)==='finance'\}/);
 assert.match(app,/<AccountsPlatformHub debtAccounts=\{data\.accounts\} currency=\{data\.currency\} desktopAi=\{data\.desktopAi\}/);
});
test('Connect action is disabled until verified partner setup and restricts OAuth redirect to bank hostname',()=>{
 const component=read('components/StandardBankConnection.tsx');
 assert.match(component,/disabled=\{busy\|\|!status\?\.ready\}/);
 assert.match(component,/allowedReturnUrl\(result\.authorizationUrl\)/);
 assert.match(component,/bankHost\(url\.hostname\)/);
 assert.match(component,/url\.protocol==='https:'/);
 assert.match(component,/Bank has not approved|Partner onboarding pending/);
 assert.match(component,/credentials:'same-origin'/);
 assert.match(component,/Authorization:'Bearer '\+settings\.token/);
 assert.doesNotMatch(component,/type=['"]password['"]|<input.*name=['"](?:password|pin|otp)/i);
});
test('Account picker is read-only, connection can be locally cleared, and no bank credentials persist in vault',()=>{
 const component=read('components/StandardBankConnection.tsx');
 assert.match(component,/api\/banks\/standard-bank\//);
 assert.match(component,/invoke\('select','POST',\{accountId\}\)/);
 assert.match(component,/View account/);
 assert.match(component,/invoke\('disconnect','POST'\)/);
 assert.match(component,/revoke third-party consent in Standard Bank Internet Banking/i);
 assert.match(component,/No banking passwords, payments or withdrawals/);
 assert.doesNotMatch(component,/localStorage|sessionStorage|indexedDB|MC_SB_CLIENT_SECRET/);
 const carousel=read('components/BankCarousel.tsx');
 assert.match(carousel,/showStandardBankConnect&&chosen\.id==='standard-bank'/);
});
