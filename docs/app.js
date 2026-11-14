import { compute, edit } from './model.js';
const $ = id => document.getElementById(id), STORAGE = 'isomass:browser:v1', COLLECTION = 'isomass:forms:v1';
let scene, snapshots = [], cursor = 0, saveAvailable = true;
const c = { bg:'#10171c', ink:'#e3e2d6', muted:'#8fa0a2', line:'#2b3a40', gold:'#e2b873', teal:'#68b1ae' };
const polar = (r,a) => [400+r*Math.cos(a),325+r*Math.sin(a)];
const point = p => p.map(v=>v.toFixed(3)).join(',');
const text = (x,y,v,size=12,color=c.muted,anchor='middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" fill="${color}" font-size="${size}" font-family="Segoe UI,Arial,sans-serif">${v}</text>`;
const line = (x,y,x2,y2,color=c.line) => `<path d="M${x},${y}L${x2},${y2}" stroke="${color}" fill="none"/>`;
function arc(r,start,width) {
  const a=start/64*Math.PI*2-Math.PI/2+.012,sweep=width/64*Math.PI*2-.024;
  return `M${point(polar(r,a))}A${r},${r} 0 ${sweep>Math.PI?1:0} 1 ${point(polar(r,a+sweep))}`;
}
function draw() {
  const ringHadFocus = !!document.activeElement?.closest?.('[data-region]');
  const s=scene,p=[];
  p.push(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 820" role="group" aria-labelledby="plot-title plot-desc"><title id="plot-title">Isomass: ${s.regions.length} regions, total capacity ${s.mass}</title><desc id="plot-desc">Select an arc to focus it. Arrow up and down select other regions. Enter or Space selects a focused arc. Use Divide to split the selected region.</desc><rect width="800" height="820" fill="${c.bg}"/>`);
  for(let i=0;i<64;i++){const a=i*2*Math.PI/64-Math.PI/2;p.push(line(...polar(299,a),...polar(i%8===0?309:303,a),i%8===0?'#64777d':c.line));}
  for(const r of [76,134,192,291])p.push(`<circle cx="400" cy="325" r="${r}" fill="none" stroke="${c.line}"/>`);
  p.push(line(89,325,711,325,'#1d2a30'),line(400,14,400,636,'#1d2a30'));
  for(let layer=0;layer<13;layer++) {
    let d='';for(let i=0;i<=256;i++){const j=i%256,r=68+layer*8+s.samples[j]/8192*(21+layer*2);d+=(i?'L':'M')+point(polar(r,j*2*Math.PI/256-Math.PI/2));}
    p.push(`<path d="${d}Z" fill="none" stroke="${layer===12?c.gold:`rgb(${55+layer*5},${87+layer*5},${88+layer*3})`}" stroke-width="${layer===12?1.8:.8}"/>`);
  }
  p.push(`<circle cx="400" cy="325" r="52" fill="${c.bg}"/>`,text(400,339,s.mass,50,c.ink),text(400,361,'CONSERVED',9,c.gold));
  for(const r of s.regions){const focused=r.id===s.focus,active=s.active.includes(r.id),radius=250+r.depth*4,d=arc(radius,r.start,r.width),a=(r.start+r.width/2)*2*Math.PI/64-Math.PI/2,n=polar(radius,a),label=polar(285,a);
    p.push(`<g class="region" role="button" tabindex="${focused?0:-1}" data-region="${r.id}" aria-label="Region ${s.regions.indexOf(r)+1} of ${s.regions.length}, capacity ${r.width}, depth ${r.depth}" aria-pressed="${focused}"><title>Region ${s.regions.indexOf(r)+1}: ${r.width} of 64. Select to edit.</title><path d="${d}" fill="none" stroke="transparent" stroke-width="52"/><path class="region-band" d="${d}" fill="none" stroke="${focused?c.gold:active?c.teal:'#60777c'}" stroke-width="${focused?12:active?9:5}"/><circle cx="${n[0]}" cy="${n[1]}" r="${focused?4.5:2.5}" fill="${c.bg}"/></g>`);
    if(s.regions.length<=32)p.push(text(label[0],label[1]+4,r.width,11,focused?c.gold:c.muted));
    if(s.mirror.includes(r.id)&&!focused){const m=polar(radius-18,a);p.push(`<circle cx="${m[0]}" cy="${m[1]}" r="3" fill="${c.gold}"/>`);}
  }
  const x=40,y=686,w=720,h=91;p.push(text(x,662,'INTERFERENCE / 256 SAMPLES',9,c.muted,'start'));
  for(let i=0;i<=8;i++)p.push(line(x+w*i/8,y,x+w*i/8,y+h));p.push(line(x,y,x+w,y),line(x,y+h,x+w,y+h));
  const d=s.samples.map((v,i)=>(i?'L':'M')+(x+w*i/255).toFixed(3)+','+(y+h-v*h/8192).toFixed(3)).join('');
  p.push(`<path d="${d}" stroke="${c.teal}" stroke-width="1.5" fill="none"/>`,text(x,797,'0',9,c.muted,'start'),text(x+w,797,'256',9,c.muted,'end'),'</svg>');
  $('drawing').innerHTML=p.join('');
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
}
const announce=message=>{$('status').textContent=message;};
const snapshot=()=>({source:scene.source,focus:scene.focus});
function currentLink(){const u=new URL(location.href);u.search='';u.hash=new URLSearchParams({s:scene.source,f:String(scene.focus)}).toString();return u.href;}
function refresh(message){draw();try{localStorage.setItem(STORAGE,JSON.stringify({version:1,...snapshot()}));saveAvailable=true;}catch{saveAvailable=false;}history.replaceState(null,'',currentLink());announce(message+(saveAvailable?' · Saved in this browser.':' · Storage unavailable; share a link to keep this form.'));}
function commit(source,focus,message){const next=compute(source,focus);if(next.source!==scene.source){snapshots=snapshots.slice(0,cursor+1);snapshots.push({source:next.source,focus:next.focus});if(snapshots.length>512)snapshots.shift();cursor=snapshots.length-1;}else snapshots[cursor]={source:next.source,focus:next.focus};scene=next;refresh(message);}
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
$('share').addEventListener('click',()=>{$('share-url').value=currentLink();$('copy-status').textContent='';$('share-dialog').showModal();});
$('share-url').addEventListener('click',()=>$('share-url').select());
$('copy-link').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(currentLink());$('copy-status').textContent='Copied. Anyone with the link can explore this form.';}catch{$('share-url').focus();$('share-url').select();$('copy-status').textContent='Select and copy the link above.';}});
async function exportImage(){
  $('export').disabled=true;
  try{const svg=$('drawing').querySelector('svg').cloneNode(true);svg.setAttribute('width','1600');svg.setAttribute('height','1640');const source=new XMLSerializer().serializeToString(svg),url=URL.createObjectURL(new Blob([source],{type:'image/svg+xml;charset=utf-8'}));
    try{const img=new Image();img.src=url;await img.decode();const canvas=document.createElement('canvas');canvas.width=1600;canvas.height=1640;canvas.getContext('2d').drawImage(img,0,0);const png=await new Promise(r=>canvas.toBlob(r,'image/png'));if(!png)throw new Error('No image');const download=URL.createObjectURL(png),a=document.createElement('a');a.href=download;a.download=`isomass-${scene.regions.length}-regions.png`;a.click();setTimeout(()=>URL.revokeObjectURL(download),10000);announce('Image exported.');}finally{URL.revokeObjectURL(url);}
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
window.addEventListener('hashchange',()=>{try{const p=new URLSearchParams(location.hash.slice(1));if(!p.has('s'))return;scene=compute(p.get('s'),Number(p.get('f')||1));snapshots=[snapshot()];cursor=0;refresh('Shared form opened');}catch{announce('That link contains an invalid partition. Your current form is unchanged.');}});
let opening='The whole is yours. Divide a region to begin';
try{const p=new URLSearchParams(location.hash.slice(1));if(p.has('s')){scene=compute(p.get('s'),Number(p.get('f')||1));opening='Shared form opened';}else{const saved=JSON.parse(localStorage.getItem(STORAGE)||'null');scene=saved?.version===1?compute(saved.source,saved.focus):compute('L');if(saved)opening='Your last form is restored';}}
catch{scene=compute('L');opening='The saved or shared form was invalid. Starting with a whole';}
snapshots=[snapshot()];refresh(opening);
if(matchMedia('(pointer: coarse)').matches)document.querySelector('.touch-hint').textContent='Tap any arc, then use Divide. The region picker also reaches the smallest pieces.';
