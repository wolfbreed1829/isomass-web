import test from 'node:test';
import assert from 'node:assert/strict';
import {compute,edit} from '../docs/model.js';
import {challenges,advanceChallenge,compareScenes,cleanWorkspace,cleanRun} from '../docs/learning.js';
import {renderPlot} from '../docs/plot.js';

test('all challenge starting states are valid and do not complete their first step',()=>{
  for(const c of challenges){const run={id:c.id,step:0};assert.equal(advanceChallenge(run,compute(c.source,c.focus)),run);}
});
test('equal pieces challenge requires all three meaningful edits',()=>{
  let run={id:'equal',step:0},s=compute('L');
  assert.equal(advanceChallenge(run,compute('BBLLBLL',4)),run);
  for(const target of [1,2,3]){s=compute(edit(s.source,'split',target),target*2);run=advanceChallenge(run,s);}
  assert.equal(run.step,3);assert.equal(s.mass,64);assert.equal(advanceChallenge(run,s),run);
});
test('focus challenge distinguishes a new family from another member of that family',()=>{
  const source=challenges.find(c=>c.id==='focus').source;
  let run={id:'focus',step:0};assert.equal(advanceChallenge(run,compute(source,5)),run);
  run=advanceChallenge(run,compute(source,12));assert.equal(run.step,1);assert.equal(run.anchor,12);
  assert.equal(advanceChallenge(run,compute(source,12)),run);
  assert.equal(advanceChallenge(run,compute(edit(source,'split',12),13)),run);
  assert.equal(advanceChallenge(run,compute(source,13)),run);
  run={...run,referenceReady:true};
  run=advanceChallenge(run,compute(source,13));assert.equal(run.step,2);
});
test('restore challenge requires selecting a larger family before rejoining',()=>{
  let run={id:'restore',step:0};const source=edit('BBLLBLL','split',4);
  run=advanceChallenge(run,compute(source,8));assert.equal(run.step,1);
  assert.equal(advanceChallenge(run,compute('BBLLBLL',4)),run);
  run=advanceChallenge(run,compute(source,5));assert.equal(run.step,2);
  run=advanceChallenge(run,compute(edit(source,'merge',4),4));assert.equal(run.step,3);
});
test('comparison distinguishes unchanged family, focus change, and structural change',()=>{
  const source='BBLLBBLLBLL',a=compute(source,4),same=compute(source,5),different=compute(source,12);
  assert.equal(compareScenes(a,same).changedSamples,0);
  assert.equal(compareScenes(a,different).sameStructure,true);assert.ok(compareScenes(a,different).changedSamples>0);
  const changed=compute(edit(source,'split',4),8);assert.equal(compareScenes(a,changed).sameStructure,false);
  assert.ok(compareScenes(a,changed).changedSamples>0);assert.equal(a.source,source);
});
test('workspace restoration validates both forms and challenge checkpoints',()=>{
  const workspace={source:'BLL',focus:2,comparison:{source:'L',focus:1}};
  assert.deepEqual(cleanWorkspace(workspace),workspace);
  assert.throws(()=>cleanWorkspace({...workspace,comparison:{source:'BL'}}));
  assert.equal(cleanRun({id:'focus',step:1,anchor:4,returnState:workspace}),null);
  assert.equal(cleanRun({id:'equal',step:99,returnState:workspace}),null);
  assert.deepEqual(cleanRun({id:'equal',step:1,returnState:workspace}).returnState,workspace);
});
test('paired plots have distinct accessible names and reference cannot receive edits',()=>{
  const s=compute('BLL',2),a=renderPlot(s,{id:'a',interactive:false}),b=renderPlot(s,{id:'b'});
  assert.match(a,/id="a-title"/);assert.match(a,/id="a-desc"/);assert.doesNotMatch(a,/role="button"|tabindex=|data-region=/);
  assert.match(b,/id="b-title"/);assert.match(b,/role="button"/);
});
