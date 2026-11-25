import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const src=readFileSync(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
for(const name of ['MonthlyExpenses','SpendingPortfolio']){
  test(name+' is loaded on demand with a visible status fallback',()=>{
    assert.ok(src.includes("const "+name+"=lazy(()=>import('@/components/"+name+"'));"));
    assert.ok(!src.includes("import "+name+" from "));
    assert.ok(src.includes('<'+name));
  });
}
test('bank, Spend and Markets still have their complete original routes',()=>{
  for(const route of ['/assistant','/expenses','/banks','/markets']){
    assert.ok(src.includes('<Route path="'+route+'">'));
  }
  for(const label of ['Loading spending history','Loading spending categories']){
    assert.ok(src.includes(label));
  }
  assert.match(src,/const VoiceAssistant=lazy/);
});

test('Personal markets retains its on-demand Solana tracking card',()=>{
  assert.ok(src.includes("const SolanaTrackingBar=lazy(()=>import('@/components/SolanaTrackingBar'));"));
  assert.ok(src.includes('Loading Solana tracker'));
});

test('Home keeps its shared bank carousel eagerly available',()=>{
  assert.ok(src.includes("import BankCarousel from '@/components/BankCarousel';"));
  assert.ok(!src.includes("const BankCarousel=lazy"));
  assert.ok(src.includes('<BankCarousel '));
});
