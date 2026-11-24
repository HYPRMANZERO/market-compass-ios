import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {addPersonalTask,normalizePersonalTasks,setPersonalTaskDone,removePersonalTask} from '../artifacts/market-compass/src/lib/personalTasks.ts';

test('Personal tasks are validated, capped and stable through migration',()=>{
  assert.deepEqual(normalizePersonalTasks(undefined),[]);
  const task=addPersonalTask([],'Review document','2026-11-25','550e8400-e29b-41d4-a716-446655440000',new Date('2026-11-24T00:00:00Z'));
  assert.equal(task[0].title,'Review document');
  assert.equal(task[0].done,false);
  assert.equal(normalizePersonalTasks([...task,task[0],{bad:true}]).length,1);
  assert.equal(setPersonalTaskDone(task,task[0].id,true)[0].done,true);
  assert.equal(removePersonalTask(task,task[0].id).length,0);
  assert.throws(()=>addPersonalTask([],'Test','2026-02-30','550e8400-e29b-41d4-a716-446655440001'),/Invalid task date/);
});
test('task persistence is via existing encrypted WorkspaceData, not a plaintext localStorage cache',async()=>{
  const app=await readFile(new URL('../artifacts/market-compass/src/App.tsx',import.meta.url),'utf8');
  assert.match(app,/personalTasks:\s*PersonalTask\[\]/);
  assert.match(app,/personalTasks:\s*\[\]/);
  assert.match(app,/normalizePersonalTasks\(restored\.personalTasks\)/);
  assert.match(app,/onChange=\{tasks=>setData\(old=>\(\{\.\.\.old,personalTasks:tasks\}\)\)\}/);
  assert.doesNotMatch(app,/localStorage\.setItem\(['"]personalTasks/);
});
