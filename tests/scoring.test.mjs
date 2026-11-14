import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreFor,cleanBook,addResult,scoreSummary,scoreCSV,resultFor} from '../docs/scoring.js';
import {verifyRun,replayRun} from '../docs/verify-run.js';
import {equal,focus,restore} from './fixtures.mjs';
const result=(id,challengeId,moves,completedAt=10000)=>({id,challengeId,moves,completedAt,elapsedMs:1000,version:1});
test('perfect routes score 100 with free selection and pinning',()=>{
  for(const [id,actions,moves] of [['equal',equal,3],['focus',focus,0],['restore',restore,2]]){const r=verifyRun(id,actions);assert.equal(r.score,100);assert.equal(r.moves,moves);}
});
test('undo and redo cost moves; incomplete and forged traces fail',()=>{
  const r=verifyRun('equal',[{type:'split'},{type:'undo'},{type:'redo'},...equal.slice(1)]);assert.equal(r.moves,5);assert.equal(r.score,90);
  for(const actions of [[],equal.slice(0,2),[{type:'select',target:127}], [...equal,{type:'split'}],[{type:'pin'}],[{type:'setScore',score:100}],[{type:'undo'}]])assert.throws(()=>verifyRun('equal',actions));
  assert.throws(()=>verifyRun('focus',[{type:'select',target:12},{type:'select',target:13}]));
  assert.throws(()=>verifyRun('restore',[{type:'split'},{type:'merge'}]));
});
test('partial replay reconstructs selections and undo history for reload',()=>{
  const a=replayRun('equal',equal.slice(0,2));assert.equal(a.complete,false);assert.equal(a.cursor,2);assert.equal(a.run.step,2);
  const b=replayRun('equal',[...equal.slice(0,2),{type:'undo'}]);assert.equal(b.scene.source,'BLL');assert.equal(b.moves,3);
});
test('efficiency floor, minimum moves, and completion gating',()=>{
  assert.equal(scoreFor('equal',4).score,95);assert.equal(scoreFor('equal',999).score,70);assert.equal(scoreFor('equal',2),null);assert.equal(scoreFor('__proto__',3),null);assert.equal(scoreFor('toString',3),null);
  assert.equal(resultFor({id:'equal',step:2,attempt:{id:'a',version:1,moves:3,startedAt:100,finishedAt:200,actions:equal}}),null);
  assert.equal(resultFor({id:'equal',step:3,attempt:{id:'a',version:1,moves:3,startedAt:100,finishedAt:200,actions:equal}}).score,100);
});
test('scorebook recomputes points, deduplicates, sums bests, and retains older bests',()=>{
  let b=cleanBook({name:'  Player  ',results:[{...result('best','equal',3),score:999},result('best','equal',9)]});
  b=addResult(b,result('focus','focus',0));b=addResult(b,result('restore','restore',2));assert.equal(scoreSummary(b).total,300);assert.equal(b.name,'Player');
  for(let i=0;i<60;i++)b=addResult(b,result('later'+i,'equal',10,20000+i));
  assert.equal(scoreSummary(b).total,300);assert.ok(b.results.some(r=>r.id==='best'));assert.ok(b.results.length<=53);
  assert.equal(cleanBook({results:[result('bad','other',1),{...result('bad2','equal',3),elapsedMs:-1}]}).results.length,0);
});
test('CSV quotes fields and neutralizes formula names',()=>{
  const b=cleanBook({name:'=SUM(1,2)',results:[result('a','equal',3)]});const csv=scoreCSV(b);assert.ok(csv.includes('"\'=SUM(1,2)"'));assert.ok(csv.includes('"100"'));
});
