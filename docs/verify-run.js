import {compute,edit} from './model.js';
import {challenges,advanceChallenge} from './learning.js';
import {cleanActions,scoreFor} from './scoring.js';

// Replays only allowed actions from the fixed challenge start. No client score,
// completion flag, move count, or elapsed time is trusted by the leaderboard.
export function replayRun(challengeId,rawActions) {
  const lesson=challenges.find(c=>c.id===challengeId),actions=cleanActions(rawActions);
  if(!lesson||!actions)throw new Error('A recorded run is required.');
  let scene=compute(lesson.source,lesson.focus),run={id:challengeId,step:0},cursor=0,moves=0;
  let history=[{source:scene.source,focus:scene.focus}];
  for(const action of actions){
    if(run.step===lesson.steps.length)throw new Error('The run contains actions after completion.');
    const previous=scene;
    if(action.type==='select'){
      if(!scene.regions.some(r=>r.id===action.target))throw new Error('The selected region does not exist.');
      scene=compute(scene.source,action.target);history[cursor]={source:scene.source,focus:scene.focus};
    }else if(action.type==='pin'){
      if(challengeId!=='focus'||run.step!==1||run.referenceReady)throw new Error('That comparison step is not available.');
      run={...run,referenceReady:true};
    }else if(action.type==='undo'||action.type==='redo'){
      const next=cursor+(action.type==='undo'?-1:1);
      if(next<0||next>=history.length)throw new Error('The history action is unavailable.');
      cursor=next;scene=compute(history[cursor].source,history[cursor].focus);
    }else{
      let source,focus;
      if(action.type==='split'){source=edit(scene.source,'split',scene.focus);focus=scene.focus*2;}
      if(action.type==='merge'){focus=Math.max(1,Math.floor(scene.focus/2));source=edit(scene.source,'merge',focus);}
      if(action.type==='reset'){source='L';focus=1;}
      if(source===scene.source&&focus===scene.focus)throw new Error('The action does not change the form.');
      scene=compute(source,focus);history=history.slice(0,cursor+1);history.push({source:scene.source,focus:scene.focus});cursor++;
    }
    if(scene.source!==previous.source)moves++;
    run=advanceChallenge(run,scene);
  }
  return {scene,run,history,cursor,moves,actions,complete:run.step===lesson.steps.length};
}

export function verifyRun(challengeId,rawActions) {
  const {complete,moves,actions}=replayRun(challengeId,rawActions);
  if(!complete)throw new Error('This run has not completed every challenge step.');
  const points=scoreFor(challengeId,moves);if(!points)throw new Error('Invalid move count.');
  return {challengeId,moves,...points,actions};
}
