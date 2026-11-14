import { compute, edit } from './model.js';
import {challenges, advanceChallenge, compareScenes, cleanForm, cleanWorkspace, cleanRun} from './learning.js';
const $ = id => document.getElementById(id), STORAGE = 'isomass:browser:v1', COLLECTION = 'isomass:forms:v1';
let scene, snapshots = [], cursor = 0, saveAvailable = true;
let comparison = null, referenceName = 'Pinned form', run = null;
const PROGRESS = 'isomass:challenges:v1';
let completed = new Set();
try {const saved=JSON.parse(localStorage.getItem(PROGRESS)||'[]');if(Array.isArray(saved))completed=new Set(saved.filter(id=>challenges.some(c=>c.id===id)));} catch {}
import {renderPlot} from "./plot.js";
function draw() {
  const ringHadFocus = !!document.activeElement?.closest?.('[data-region]');
  const s=scene;
  $('drawing').innerHTML=renderPlot(s,{id:'live'});

  const selected=s.regions.find(r=>r.id===s.focus);
  for(const [id,v] of Object.entries({regions:s.regions.length,coupled:s.active.length,'focus-id':s.regions.indexOf(selected)+1,width:selected.width,depth:selected.depth}))$(id).textContent=v;
  $('region-select').replaceChildren(...s.regions.map((r,i)=>new Option(`Region ${i+1} · ${r.width}/64`,String(r.id),false,r.id===s.focus)));
  $('previous').disabled=$('next').disabled=s.regions.length===1;
  $('undo').disabled=cursor===0;$('redo').disabled=cursor===snapshots.length-1;$('reset').disabled=s.source==='L';$('split').disabled=selected.depth===6;$('merge').disabled=s.focus===1;
  $('split').title=selected.depth===6?'This region is already at minimum capacity.':'Divide into two equal regions (Space)';
  const parentWidth=selected.width*2,parentStart=Math.floor(selected.start/parentWidth)*parentWidth;
  const family=s.regions.filter(r=>r.start>=parentStart&&r.start<parentStart+parentWidth);
  $('edit-preview').textContent=(selected.depth===6?'Minimum size reached.':`Divide ${selected.width} into ${selected.width/2} + ${selected.width/2}.`)+(s.focus===1?'':` Rejoin combines ${family.length} regions into ${parentWidth}.`);
  $('selection-summary').textContent=s.regions.length===1?'The whole is selected. Divide it to begin, or open a starting form.':s.active.length===s.regions.length?`All ${s.active.length} regions are connected. Divide one to introduce a different scale.`:`${s.active.length} ${s.active.length===1?'region receives':'connected regions receive'} twice the weight in the field. Select another size to emphasize a different family.`;
  $('field-explanation').textContent=s.regions.length===1?'Start with Divide. The two halves still add up to 64, but their waves create a new pattern.':s.active.length===s.regions.length?'Every piece has the same size and belongs to one connected family. Try dividing just one piece, then selecting a larger neighbor.':`You now have ${new Set(s.regions.map(r=>r.width)).size} different region sizes. Try selecting another size: the total stays 64 while a different family shapes the field.`;
  if(ringHadFocus)$('drawing').querySelector(`[data-region="${s.focus}"]`)?.focus({preventScroll:true});
  drawComparison();
  drawChallenge();
}
const announce=message=>{$('status').textContent=message;};
const snapshot=()=>({source:scene.source,focus:scene.focus});
const workspaceSnapshot=()=>({...snapshot(),comparison:comparison?{...comparison}:null});
function currentLink(){const u=new URL(location.href);u.search='';const p=new URLSearchParams({s:scene.source,f:String(scene.focus)});if(comparison){p.set('a',comparison.source);p.set('af',String(comparison.focus));}u.hash=p.toString();return u.href;}
function refresh(message){
  if(run){const previous=run;run=advanceChallenge(run,scene);if(previous.step!==run.step){
    const lesson=challenges.find(c=>c.id===run.id);
    if(run.step===lesson.steps.length){completed.add(run.id);try{localStorage.setItem(PROGRESS,JSON.stringify([...completed]));}catch{}message=`Challenge complete: ${lesson.title}`;}
  }}
  draw();$('starter-note').textContent='Examples are editable. Undo brings your previous form back.';
  try{localStorage.setItem(STORAGE,JSON.stringify({version:1,...workspaceSnapshot(),challenge:run}));saveAvailable=true;}catch{saveAvailable=false;}
  history.replaceState(null,'',currentLink());announce(message+(saveAvailable?' · Saved in this browser.':' · Storage unavailable; share a link to keep this form.'));
}
function commit(source,focus,message){const next=compute(source,focus);if(next.source!==scene.source||next.focus!==scene.focus){snapshots=snapshots.slice(0,cursor+1);snapshots.push({source:next.source,focus:next.focus});if(snapshots.length>512)snapshots.shift();cursor=snapshots.length-1;}scene=next;refresh(message);}
function select(id){scene=compute(scene.source,id);snapshots[cursor]=snapshot();refresh(`Region ${scene.regions.findIndex(r=>r.id===scene.focus)+1} of ${scene.regions.length} selected · ${scene.active.length} connected ${scene.active.length===1?'region':'regions'}`);}
function act(action){try{
  if(action==='split')commit(edit(scene.source,'split',scene.focus),scene.focus*2,'Divided. Capacity remains 64');
  if(action==='merge'){const parent=Math.max(1,Math.floor(scene.focus/2));commit(edit(scene.source,'merge',parent),parent,'Family rejoined. Capacity remains 64');}
  if(action==='reset')commit('L',1,'Returned to the whole. Undo restores your form');
  if(action==='undo'&&cursor>0){scene=compute(snapshots[--cursor].source,snapshots[cursor].focus);refresh('Previous form restored');}
  if(action==='redo'&&cursor<snapshots.length-1){scene=compute(snapshots[++cursor].source,snapshots[cursor].focus);refresh('Next form restored');}
}catch(error){announce(error.message);}}
for(const name of ['split','merge','reset','undo','redo'])$(name).addEventListener('click',()=>act(name));
$('drawing').addEventListener('click',e=>{const r=e.target.closest('[data-region]');if(r)select(Number(r.dataset.region));});
function stepRegion(direction){const index=scene.regions.findIndex(r=>r.id===scene.focus);select(scene.regions[(index+direction+scene.regions.length)%scene.regions.length].id);}
$('previous').addEventListener('click',()=>stepRegion(-1));
$('next').addEventListener('click',()=>stepRegion(1));
$('region-select').addEventListener('change',e=>select(Number(e.target.value)));
document.querySelector('.skip-link').addEventListener('click',e=>{e.preventDefault();$('workspace').focus();$('workspace').scrollIntoView({block:'start'});});
const presets={balanced:{source:'BBLLBLL',focus:4,name:'Balanced',note:'Four equal pieces form one connected family. Divide one to break the symmetry.'},cascade:{source:'BBBBLLLLL',focus:16,name:'Cascade',note:'A chain of smaller pieces. Select a larger neighbor to change the field.'},contrast:{source:'BBLLBBLLBLL',focus:4,name:'Contrast',note:'Two scales, two families. Switch between the larger and smaller regions.'}};
for(const button of document.querySelectorAll('[data-preset]'))button.addEventListener('click',()=>{const p=presets[button.dataset.preset];commit(p.source,p.focus,`${p.name} opened. Undo restores your previous form`);$('starter-note').textContent=p.note;});

function drawComparison(){
  const enabled=!!comparison;
  $('workspace').classList.toggle('comparing',enabled);
  for(const id of ['reference-pane','live-heading','comparison-tools','comparison-results'])$(id).hidden=!enabled;
  $('compare').setAttribute('aria-pressed',String(enabled));$('compare').textContent=enabled?'Exit comparison':'Compare forms';
  $('export').textContent=enabled?'Export comparison ↓':'Export image ↓';
  $('save').textContent=enabled?'Save current form B ＋':'Save this form ＋';
  if(!enabled)return;
  const a=compute(comparison.source,comparison.focus),b=scene,result=compareScenes(a,b);
  $('reference-drawing').innerHTML=renderPlot(a,{id:'reference',interactive:false});
  const options=[new Option(referenceName,'current',true,true),...Object.entries(presets).map(([id,p])=>new Option(p.name,`preset:${id}`)),...savedForms.map(f=>new Option(`Saved: ${f.name}`,`saved:${f.id}`))];
  $('reference-source').replaceChildren(...options);
  $('current-source').replaceChildren(new Option('Current form','current',true,true),...Object.entries(presets).map(([id,p])=>new Option(p.name,`preset:${id}`)),...savedForms.map(f=>new Option(`Saved: ${f.name}`,`saved:${f.id}`)));
  for(const id of ['pin-current','swap-comparison','reference-source','current-source'])$(id).disabled=!!run;
  $('comparison-tools').querySelector('p').textContent=run?'The challenge pins A for you. Edit B with the controls. Both views use the same scale.':'A stays fixed. Use the controls to edit B. Both views use the same scale.';
  $('comparison-summary').textContent=`${result.changedSamples} of 256 wave samples changed · both totals remain 64.`;
  $('comparison-explanation').textContent=result.explanation;
  const sizes=s=>[...new Set(s.regions.map(r=>r.width))].sort((x,y)=>x-y).join(', ');
  const width=s=>s.regions.find(r=>r.id===s.focus).width;
  const rows=[['Regions',a.regions.length,b.regions.length],['Region sizes',sizes(a),sizes(b)],['Selected capacity',width(a),width(b)],['Connected regions',a.active.length,b.active.length],['Total capacity',a.mass,b.mass]];
  $('comparison-measures').innerHTML=rows.map(([label,x,y])=>`<tr><th scope="row">${label}</th><td>${x}</td><td>${y}</td></tr>`).join('');
}
function guideReference(){const lesson=challenges.find(c=>c.id===run.id);return {source:lesson.source,focus:run.id==='focus'&&run.step>0&&run.referenceReady?run.anchor:lesson.focus};}
$('compare').addEventListener('click',()=>{comparison=comparison?null:run?guideReference():cleanForm(scene);referenceName=run?'Challenge reference':'Pinned form';refresh(comparison?'Reference A pinned. Edit B to compare':'Returned to a single form');});
$('pin-current').addEventListener('click',()=>{comparison=cleanForm(scene);referenceName='Pinned form';refresh('Current form pinned as reference A');});
$('swap-comparison').addEventListener('click',()=>{const previous=comparison;comparison=cleanForm(scene);referenceName='Previous current form';commit(previous.source,previous.focus,'A and B swapped. Undo affects B');});
$('reference-source').addEventListener('change',e=>{const [kind,id]=e.target.value.split(':');const form=kind==='preset'?presets[id]:savedForms.find(f=>f.id===id);if(!form)return;comparison=cleanForm(form);referenceName=form.name;refresh('Reference A updated. Current form B is unchanged');});
$('current-source').addEventListener('change',e=>{const [kind,id]=e.target.value.split(':');const form=kind==='preset'?presets[id]:savedForms.find(f=>f.id===id);if(form)commit(form.source,form.focus,'Current form B updated. Reference A stays fixed');});

function drawChallenge(){
  $('challenge-count').textContent=completed.size?`(${completed.size}/3)` : '';
  $('challenge-panel').hidden=!run;$('workspace').classList.toggle('guide-active',!!run);
  if(!run)return;
  const lesson=challenges.find(c=>c.id===run.id),finished=run.step===lesson.steps.length;
  $('challenge-progress').textContent=finished?`${lesson.theme} / Completed ✓`:`${lesson.theme} / Step ${run.step+1} of ${lesson.steps.length}`;
  $('challenge-title').textContent=finished?lesson.title:lesson.steps[run.step].title;
  $('challenge-hint').textContent=finished?lesson.takeaway:lesson.steps[run.step].hint;
  const waitingToPin=run.id==='focus'&&run.step===1&&!run.referenceReady;
  $('challenge-pin').hidden=!waitingToPin;
  if(waitingToPin){$('challenge-title').textContent='Notice the changed wave';$('challenge-hint').textContent='Only your selection changed, but a different family now shapes the wave. Keep this selection in A before comparing another member of the same family.';}
  $('challenge-steps').replaceChildren(...lesson.steps.map((step,i)=>{const li=document.createElement('li');li.textContent=step.title;li.dataset.step=String(i+1);if(i<run.step)li.className='done';if(i===run.step)li.setAttribute('aria-current','step');return li;}));
  $('challenge-next').hidden=!finished;$('challenge-next').textContent=challenges.indexOf(lesson)===challenges.length-1?'More challenges':'Next challenge →';
}
function openChallenges(){
  $('challenge-list').replaceChildren(...challenges.map((lesson,i)=>{
    const card=document.createElement('section'),label=document.createElement('p'),title=document.createElement('h3'),intro=document.createElement('p'),button=document.createElement('button');
    card.className='challenge-card';label.className='eyebrow';label.textContent=`0${i+1} / ${lesson.theme}${completed.has(lesson.id)?' · Completed ✓':''}`;
    title.textContent=lesson.title;intro.textContent=lesson.intro;button.textContent=completed.has(lesson.id)?'Try again':'Start challenge';button.dataset.challenge=lesson.id;
    button.addEventListener('click',()=>beginChallenge(lesson.id));card.append(label,title,intro,button);return card;
  }));$('challenges-dialog').showModal();
}
function beginChallenge(id){
  const lesson=challenges.find(c=>c.id===id);const returnState=run?.returnState||workspaceSnapshot();
  run={id,step:0,returnState};comparison={source:lesson.source,focus:lesson.focus};referenceName='Challenge starting form';
  commit(lesson.source,lesson.focus,`Started: ${lesson.title}`);$('challenges-dialog').close();$('challenge-title').focus({preventScroll:true});$('challenge-panel').scrollIntoView({block:'start'});
}
$('challenges').addEventListener('click',openChallenges);
$('challenge-restart').addEventListener('click',()=>beginChallenge(run.id));
$('challenge-pin').addEventListener('click',()=>{comparison={source:challenges.find(c=>c.id==='focus').source,focus:run.anchor};referenceName='First small selection';run={...run,referenceReady:true};refresh('First small selection pinned as A. Choose another 8-unit region');});
$('challenge-next').addEventListener('click',()=>{const index=challenges.findIndex(c=>c.id===run.id);if(index<challenges.length-1)beginChallenge(challenges[index+1].id);else openChallenges();});
$('challenge-leave').addEventListener('click',()=>{const original=run.returnState;run=null;comparison=original.comparison;referenceName='Pinned form';commit(original.source,original.focus,'Returned to your original form');$('challenges').focus({preventScroll:true});});
document.addEventListener('keydown',e=>{
  if(document.querySelector('dialog[open]')||e.target.matches('input,textarea,select')||e.target.isContentEditable)return;
  if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='z'){e.preventDefault();act(e.shiftKey?'redo':'undo');return;}
  if(e.ctrlKey||e.metaKey||e.altKey||e.target.matches('button,a,summary'))return;
  const r=e.target.closest?.('[data-region]');
  if(r&&(e.key==='Enter'||e.key===' ')){e.preventDefault();select(Number(r.dataset.region));$('drawing').querySelector(`[data-region="${scene.focus}"]`)?.focus({preventScroll:true});return;}
  if(e.key==='ArrowUp'||e.key==='ArrowDown'){e.preventDefault();stepRegion(e.key==='ArrowUp'?-1:1);return;}
  const action={' ':'split',Backspace:'merge',ArrowLeft:'undo',ArrowRight:'redo'}[e.key];
  if(action){e.preventDefault();if(r&&action==='split')select(Number(r.dataset.region));act(action);}
  if(e.key==='?'||e.key==='F1'){e.preventDefault();$('about-dialog').showModal();}
});
$('about').addEventListener('click',()=>$('about-dialog').showModal());
for(const button of document.querySelectorAll('[data-close]'))button.addEventListener('click',()=>button.closest('dialog').close());
for(const dialog of document.querySelectorAll('dialog'))dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)dialog.close();}});
$('share').addEventListener('click',()=>{$('share-url').value=currentLink();$('copy-status').textContent='';$('share-title').textContent=comparison?'Both forms, in a link.':'Your form, in a link.';$('share-description').textContent=comparison?'This link preserves reference A and current form B, including both selections. Visitors can edit B independently. Challenge progress stays in your browser.':'Anyone opening this link starts with your current pieces and selected region. Their edits stay in their own browser.';$('share-dialog').showModal();});
$('share-url').addEventListener('click',()=>$('share-url').select());
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentLink());$('copy-status').textContent='Copied. Anyone with the link can explore this form.';}catch{$('share-url').focus();$('share-url').select();$('copy-status').textContent='Select and copy the link above.';}});
async function exportImage(){
  $('export').disabled=true;
  try{const isPair=!!comparison,height=isPair?900:1640;let source;
    if(isPair){const panel=(s,id,x)=>renderPlot(s,{id,interactive:false}).replace('<svg ',`<svg x="${x}" y="60" width="800" height="820" `);source=`<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900"><rect width="1600" height="900" fill="#10171c"/><g fill="#e3e2d6" font-family="Arial,sans-serif" font-size="24"><text x="40" y="40">A · Reference</text><text x="840" y="40">B · Current</text></g>${panel(compute(comparison.source,comparison.focus),'export-a',0)}${panel(scene,'export-b',800)}</svg>`;}
    else{const svg=$('drawing').querySelector('svg').cloneNode(true);svg.setAttribute('width','1600');svg.setAttribute('height','1640');source=new XMLSerializer().serializeToString(svg);}
    const url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
    try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=height;canvas.getContext('2d').drawImage(img,0,0);const png=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!png)throw new Error('No image');const download=URL.createObjectURL(png),a=document.createElement('a');a.href=download;a.download=isPair?'isomass-comparison.png':`isomass-${scene.regions.length}-regions.png`;a.click();setTimeout(()=>URL.revokeObjectURL(download),10000);announce(isPair?'Comparison image exported.':'Image exported.');}finally{URL.revokeObjectURL(url);}
  }catch{announce('Image export was unavailable. Use Share this form to keep the structure.');}finally{$('export').disabled=false;}
}
$('export').addEventListener('click',exportImage);
// Collection names are user input: insert them with textContent, never markup.
let savedForms=[];
try {
  const raw=JSON.parse(localStorage.getItem(COLLECTION)||'[]');
  if(Array.isArray(raw))savedForms=raw.slice(0,24).flatMap(item=>{
    try{if(typeof item.name!=='string'||typeof item.id!=='string')return [];const valid=compute(item.source,item.focus);return [{id:item.id,name:item.name.slice(0,48),source:valid.source,focus:valid.focus}];}catch{return [];}
  });
}catch{}
function updateCollectionCount(){$('collection').textContent=savedForms.length?`Saved forms (${savedForms.length})`:'Saved forms';}
function writeCollection(next){
  try{localStorage.setItem(COLLECTION,JSON.stringify(next));savedForms=next;updateCollectionCount();return true;}
  catch{$('collection-status').textContent='Browser storage is unavailable or full. Share a link to keep this form.';return false;}
}
function renderCollection(){
  const list=$('saved-list');list.replaceChildren();
  if(!savedForms.length){const empty=document.createElement('p');empty.className='empty-collection';empty.textContent='No saved forms yet. Name your current form above to keep it.';list.append(empty);return;}
  for(const item of savedForms){
    const row=document.createElement('div'),info=document.createElement('div'),name=document.createElement('strong'),meta=document.createElement('p'),open=document.createElement('button'),remove=document.createElement('button');
    row.className='saved-item';name.textContent=item.name;meta.textContent=`${compute(item.source,item.focus).regions.length} regions · total 64`;
    open.textContent='Open';open.setAttribute('aria-label',`Open ${item.name}`);
    open.addEventListener('click',()=>{commit(item.source,item.focus,`Opened “${item.name}”. Undo restores your previous form`);$('collection-dialog').close();});
    remove.textContent='×';remove.className='remove';remove.setAttribute('aria-label',`Remove ${item.name}`);
    remove.addEventListener('click',()=>{
      const previous=savedForms.slice();
      if(!writeCollection(savedForms.filter(f=>f.id!==item.id)))return;
      renderCollection();$('collection-status').textContent=`Removed “${item.name}”. `;
      const restore=document.createElement('button');restore.textContent='Undo removal';restore.className='text-button';
      restore.addEventListener('click',()=>{if(writeCollection(previous)){renderCollection();$('collection-status').textContent='Form restored.';}});
      $('collection-status').append(restore);restore.focus();
    });
    info.append(name,meta);row.append(info,open,remove);list.append(row);
  }
}
function openCollection(focusName=false){
  renderCollection();$('collection-status').textContent='';$('form-name').value='';$('collection-dialog').showModal();
  if(focusName)$('form-name').focus();
}
$('collection').addEventListener('click',()=>openCollection());
$('save').addEventListener('click',()=>openCollection(true));
$('save-form').addEventListener('submit',e=>{
  e.preventDefault();const name=$('form-name').value.trim();
  if(!name){$('collection-status').textContent='Give this form a name first.';$('form-name').focus();return;}
  if(savedForms.length>=24){$('collection-status').textContent='Your collection holds 24 forms. Remove a form to make room, or share a link.';return;}
  const item={id:crypto.randomUUID(),name,...snapshot()};
  if(writeCollection([item,...savedForms])){renderCollection();$('form-name').value='';$('collection-status').textContent=`Saved “${name}” on this device.`;}
});
updateCollectionCount();
function readShared(p){return cleanWorkspace({source:p.get('s'),focus:Number(p.get('f')||1),comparison:p.has('a')?{source:p.get('a'),focus:Number(p.get('af')||1)}:null});}
window.addEventListener('hashchange',()=>{try{const p=new URLSearchParams(location.hash.slice(1));if(!p.has('s'))return;const shared=readShared(p);scene=compute(shared.source,shared.focus);comparison=shared.comparison;referenceName='Shared reference';run=null;snapshots=[snapshot()];cursor=0;refresh('Shared form opened');}catch{announce('That link contains an invalid partition. Your current form is unchanged.');}});
let opening='The whole is yours. Divide a region to begin';
let restoredSession=null;
try{restoredSession=JSON.parse(localStorage.getItem(STORAGE)||'null');}catch{}
try{const p=new URLSearchParams(location.hash.slice(1)),saved=restoredSession;
  if(p.has('s')){const shared=readShared(p);scene=compute(shared.source,shared.focus);comparison=shared.comparison;referenceName='Shared reference';
    // Resume a guide only when this is the exact last workspace in this browser.
    if(saved?.version===1&&saved.source===shared.source&&saved.focus===shared.focus&&JSON.stringify(saved.comparison||null)===JSON.stringify(shared.comparison))run=cleanRun(saved.challenge);
    opening=run?'Your challenge is resumed':'Shared form opened';
  }else if(saved?.version===1){const restored=cleanWorkspace(saved);scene=compute(restored.source,restored.focus);comparison=restored.comparison;run=cleanRun(saved.challenge);opening=run?'Your challenge is resumed':'Your last form is restored';}
  else scene=compute('L');
}catch{scene=compute('L');comparison=null;run=null;opening='The saved or shared form was invalid. Starting with a whole';}
snapshots=[snapshot()];refresh(opening);
if(matchMedia('(pointer: coarse)').matches)document.querySelector('.touch-hint').textContent='Tap any arc, then use Divide. The region picker also reaches the smallest pieces.';
