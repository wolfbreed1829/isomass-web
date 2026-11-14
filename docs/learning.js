import {compute} from './model.js';

const balanced = 'BBLLBLL';
const contrast = 'BBLLBBLLBLL';
const allSize = (s, n, width) => s.regions.length === n && s.regions.every(r => r.width === width);
const selectedWidth = s => s.regions.find(r => r.id === s.focus).width;

export const challenges = [
  {
    id: 'equal', title: 'Make four equal pieces', theme: 'Conservation',
    intro: 'Build four equal regions and see what stays the same.',
    source: 'L', focus: 1,
    steps: [
      {title: 'Divide the whole', hint: 'Press Divide. The 64-unit whole becomes two halves of 32.', accepts: s => allSize(s, 2, 32)},
      {title: 'Divide one half', hint: 'Divide either 32-unit region into two 16-unit pieces.', accepts: s => s.regions.length === 3 && s.regions.map(r=>r.width).sort((a,b)=>a-b).join() === '16,16,32'},
      {title: 'Divide the other half', hint: 'Choose the remaining 32-unit region in the picker, then Divide.', accepts: s => allSize(s, 4, 16)}
    ],
    takeaway: 'Four pieces of 16 still total 64. Their shared size connects them into one family, while their waves make a different pattern from the original whole.'
  },
  {
    id: 'focus', title: 'Change the selected family', theme: 'Selection & coupling',
    intro: 'Change the field without changing a single piece.',
    source: contrast, focus: 4,
    steps: [
      {title: 'Select a smaller region', hint: 'Keep the six pieces unchanged. Choose any 8-unit region using the ring or picker. Its four-member family now gets twice the weight.', accepts: s => s.source === contrast && selectedWidth(s) === 8},
      {title: 'Select another small region', hint: 'A now holds your first 8-unit selection. Choose a different 8-unit region. Notice that the wave stays the same.', accepts: (s, run) => run.referenceReady === true && s.source === contrast && selectedWidth(s) === 8 && s.focus !== run.anchor && Number.isInteger(run.anchor)}
    ],
    takeaway: 'Selecting a different family changes its weight. Selecting another member of the same family leaves every wave sample unchanged.'
  },
  {
    id: 'restore', title: 'Break and restore a connection', theme: 'Structure & reversibility',
    intro: 'Introduce a new scale, then bring the original family back.',
    source: balanced, focus: 4,
    steps: [
      {title: 'Introduce a smaller scale', hint: 'Divide any 16-unit region into two pieces of 8. The small pieces become their own connected family.', accepts: s => s.regions.length === 5 && s.regions.filter(r=>r.width===8).length === 2 && s.regions.filter(r=>r.width===16).length === 3},
      {title: 'Focus on the larger family', hint: 'Choose any 16-unit region. Its connected neighbors now shape the wave more strongly.', accepts: s => s.regions.length === 5 && selectedWidth(s) === 16 && s.regions.filter(r=>r.width===8).length === 2 && s.regions.filter(r=>r.width===16).length === 3},
      {title: 'Rejoin the small pieces', hint: 'Select an 8-unit region, then Rejoin family. Return to four equal pieces of 16.', accepts: s => s.source === balanced && allSize(s, 4, 16)}
    ],
    takeaway: 'Rejoining restores four equal pieces and their connected family. The resulting wave matches the starting form, even if a different region is selected.'
  }
];

export function advanceChallenge(run, scene) {
  const lesson = challenges.find(c => c.id === run.id);
  if (!lesson || run.step >= lesson.steps.length || !lesson.steps[run.step]?.accepts(scene, run)) return run;
  return {...run, step: run.step + 1, ...(run.id === 'focus' && run.step === 0 ? {anchor: scene.focus, referenceReady:false} : {})};
}

export function compareScenes(a, b) {
  const changedSamples = a.samples.reduce((n, value, i) => n + Number(value !== b.samples[i]), 0);
  const sameStructure = a.source === b.source;
  const sameFamily = a.active.join(',') === b.active.join(',');
  const explanation = changedSamples === 0
    ? sameStructure && sameFamily
      ? 'The wave is unchanged: these selections belong to the same connected family.'
      : 'These forms produce the same 256 wave samples.'
    : sameStructure
      ? 'Only the selection changed. A different connected family now receives twice the weight.'
      : 'The structure changed. Different sizes and connections now combine into a different wave.';
  return {changedSamples, sameStructure, sameFamily, explanation};
}

export function cleanForm(value) {
  const state = compute(value.source, value.focus);
  return {source: state.source, focus: state.focus};
}

export function cleanWorkspace(value) {
  return {...cleanForm(value), comparison: value.comparison ? cleanForm(value.comparison) : null};
}

export function cleanRun(value) {
  const lesson = challenges.find(c => c.id === value?.id);
  if (!lesson || !Number.isInteger(value.step) || value.step < 0 || value.step > lesson.steps.length) return null;
  if (value.id === 'focus' && value.step > 0 && ![12,13,14,15].includes(value.anchor)) return null;
  try {return {id:value.id, step:value.step, anchor:value.anchor, referenceReady:value.referenceReady===true, returnState:cleanWorkspace(value.returnState)};} catch {return null;}
}
