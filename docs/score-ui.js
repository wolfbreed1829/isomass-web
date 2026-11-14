import {SCORE_RULES,scoreSummary,shareText,scoreCSV,formatDuration,CHALLENGE_URL} from './scoring.js';
import {leaderboard} from './leaderboard-client.js';

const $=id=>document.getElementById(id);
function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
function cell(tag,value){const e=document.createElement(tag);e.textContent=String(value);return e;}

export function createScoreUI({getBook,setName,onReplay,storageAvailable}){
  let offset=0,totalRows=0,lastResultId=null;
  const status=message=>{$('score-status').textContent=message;};
  function render(){
    const book=getBook(),{best,count,total}=scoreSummary(book),identity=leaderboard.identity();
    $('best-total').textContent=total;$('best-count').textContent=`${count} of 3 challenges scored`;
    $('score-storage').textContent=storageAvailable()?'Results save automatically in this browser. Download a copy before clearing browser data.':'Browser storage is unavailable. Copy or download your results to keep them.';
    $('score-name').textContent=identity?identity.name:'Choose a leaderboard name to publish your scores.';
    $('leaderboard-auth').hidden=!!identity;$('leaderboard-signout').hidden=!identity;
    $('leaderboard-availability').hidden=leaderboard.ready();
    for(const control of $('leaderboard-auth').querySelectorAll('input,button'))control.disabled=!leaderboard.ready();
    $('auth-note').textContent=identity?'Your name and submitted scores are public. Your passphrase stays private.':'Use a name you are happy to display publicly. A private passphrase protects it. No email is collected, so keep your passphrase.';
    const last=book.results.find(r=>r.id===lastResultId);$('latest-score').hidden=!last;
    if(last)$('latest-score').textContent=`${SCORE_RULES[last.challengeId].title}: ${last.score}/100 · ${last.moves} structural moves · ${formatDuration(last.elapsedMs)} elapsed.`;
    $('score-bests').replaceChildren(...Object.entries(SCORE_RULES).map(([id,rule])=>{
      const row=document.createElement('section'),title=cell('h3',rule.title),points=cell('strong',best[id]?`${best[id].score}/100`:'Not scored'),detail=cell('p',best[id]?`${best[id].moves} structural moves · ${formatDuration(best[id].elapsedMs)} elapsed`:`Perfect route: ${rule.minimumMoves} structural moves`),button=cell('button',best[id]?'Play again':'Play challenge');
      row.className='score-best';button.addEventListener('click',()=>{$('scores-dialog').close();onReplay(id);});row.append(title,points,detail,button);return row;
    }));
    $('score-history').replaceChildren(...book.results.map(r=>{const tr=document.createElement('tr');tr.append(cell('td',new Date(r.completedAt).toLocaleString()),cell('td',SCORE_RULES[r.challengeId].title),cell('td',`${r.score}/100`),cell('td',r.moves),cell('td',formatDuration(r.elapsedMs)));return tr;}));
    $('score-history-empty').hidden=book.results.length>0;
    for(const id of ['copy-scores','download-score-card','download-score-log','submit-scores'])$(id).disabled=!count;
    $('submit-scores').disabled=!count||!leaderboard.ready();
    $('submit-scores').textContent=!leaderboard.ready()?'Public submissions opening soon':identity?'Submit my best scores':'Choose a name to submit';
    $('score-text').value=shareText(book);
  }
  async function refreshBoard(){
    $('board-status').textContent='Loading public scores…';$('board-refresh').disabled=true;
    try{
      const data=await leaderboard.board({offset,search:$('board-search').value});totalRows=data.totalPlayers;
      $('board-rows').replaceChildren(...data.rows.map(row=>{const tr=document.createElement('tr');tr.append(cell('td',row.rank),cell('th',row.name),cell('td',`${row.total}/300`),cell('td',row.equal??'—'),cell('td',row.focus??'—'),cell('td',row.restore??'—'));return tr;}));
      $('board-status').textContent=data.rows.length?`Showing ${offset+1}–${offset+data.rows.length} of ${totalRows} players. Equal totals share a rank.`:'No submitted scores found. Complete a challenge and be the first to submit.';
      $('board-previous').disabled=offset===0;$('board-next').disabled=offset+25>=totalRows;
      if(leaderboard.identity()){const me=await leaderboard.me();$('my-standing').textContent=me.standing?`${me.name}: rank ${me.standing.rank} · ${me.standing.total}/300 submitted points.`:`${me.name}: no public scores yet. Submit a completed run to join the board.`;}else $('my-standing').textContent='';
    }catch(error){$('board-status').textContent=error.message;$('board-rows').replaceChildren();$('board-previous').disabled=$('board-next').disabled=true;render();}
    finally{$('board-refresh').disabled=false;}
  }
  $('leaderboard-auth').addEventListener('submit',async e=>{
    e.preventDefault();const mode=e.submitter?.value||'signup';const buttons=[...$('leaderboard-auth').querySelectorAll('button')];buttons.forEach(b=>b.disabled=true);status(mode==='signup'?'Creating your leaderboard name…':'Signing in…');
    try{const account=await leaderboard.signIn(mode,$('leaderboard-name').value,$('leaderboard-password').value);setName(account.name);$('leaderboard-password').value='';render();status(`Signed in as ${account.name}. Choose “Submit my best scores” when you are ready.`);await refreshBoard();}
    catch(error){status(error.message);}finally{buttons.forEach(b=>b.disabled=false);}
  });
  $('leaderboard-signout').addEventListener('click',async()=>{try{await leaderboard.signOut();}catch{}render();$('my-standing').textContent='';status('Signed out on this device.');});
  $('submit-scores').addEventListener('click',async()=>{
    if(!leaderboard.identity()){$('leaderboard-name').focus();status('Create a leaderboard name or sign in to submit your results.');return;}
    $('submit-scores').disabled=true;let submitted=0;
    try{const results=Object.values(scoreSummary(getBook()).best);for(const result of results){if(!result.actions)continue;status(`Checking and submitting result ${submitted+1}…`);await leaderboard.submit(result);submitted++;}status(submitted?`${submitted} verified result${submitted===1?'':'s'} submitted as ${leaderboard.identity().name}.`:'Replay a challenge to record a run that can be checked by the leaderboard.');await refreshBoard();}
    catch(error){status(`${submitted?`${submitted} results submitted. `:''}${error.message}`);}finally{render();}
  });
  $('board-refresh').addEventListener('click',()=>{offset=0;refreshBoard();});
  $('board-search-form').addEventListener('submit',e=>{e.preventDefault();offset=0;refreshBoard();});
  $('board-previous').addEventListener('click',()=>{offset=Math.max(0,offset-25);refreshBoard();});
  $('board-next').addEventListener('click',()=>{offset+=25;refreshBoard();});
  $('copy-scores').addEventListener('click',async()=>{render();try{await navigator.clipboard.writeText(shareText(getBook()));status('Copied. Paste this into your Facebook post or comment.');}catch{$('score-text').focus();$('score-text').select();status('Select and copy the results text below.');}});
  $('download-score-log').addEventListener('click',()=>{download(new Blob([scoreCSV(getBook())],{type:'text/csv;charset=utf-8'}),'isomass-score-log.csv');status('Score log downloaded.');});
  $('download-score-card').addEventListener('click',async()=>{
    const button=$('download-score-card');button.disabled=true;
    try{const canvas=drawCard(getBook());const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png'));if(!blob)throw Error();download(blob,'isomass-score-card.png');status('Score card downloaded. Add it to your Facebook post or comment.');}catch{status('The image could not be downloaded. Copy the results text instead.');}finally{button.disabled=false;}
  });
  for(const button of document.querySelectorAll('[data-score-jump]'))button.addEventListener('click',()=>$(button.dataset.scoreJump).scrollIntoView({block:'start'}));
  $('scores-dialog').addEventListener('close',()=>{$('leaderboard-password').value='';});
  return {update:render,open(resultId=null){lastResultId=resultId;status('');render();$('scores-dialog').showModal();$('scores-dialog').scrollTop=0;refreshBoard();}};
}

export function drawCard(book){
  const {best,count,total}=scoreSummary(book),canvas=document.createElement('canvas');canvas.width=1200;canvas.height=1200;const ctx=canvas.getContext('2d');
  ctx.fillStyle='#10171c';ctx.fillRect(0,0,1200,1200);
  const text=(value,x,y,size,color='#eeeade')=>{ctx.font=`${size}px Segoe UI,Arial,sans-serif`;ctx.fillStyle=color;ctx.fillText(value,x,y);};
  text('ISOMASS CHALLENGE',70,100,42,'#e2b873');text(book.name||'My score card',70,165,30,'#a1b1b4');
  text(String(total),65,330,150);text('/ 300',345,325,55,'#a1b1b4');text(`${count} of 3 challenges scored · personal bests`,70,383,27,'#78c4bc');
  ctx.strokeStyle='#e2b873';ctx.lineWidth=8;ctx.beginPath();ctx.arc(1010,265,92,0,Math.PI*2);ctx.stroke();ctx.textAlign='center';text('64',1010,280,46);text('CONSERVED',1010,320,17,'#e2b873');ctx.textAlign='left';
  let y=450;for(const [id,rule] of Object.entries(SCORE_RULES)){
    ctx.fillStyle='#19262c';ctx.fillRect(65,y,1070,140);text(rule.title,90,y+48,29);
    text(best[id]?`${best[id].moves} moves · ${formatDuration(best[id].elapsedMs)} elapsed`:'Play this challenge to record a score',90,y+96,23,'#a1b1b4');
    const score=best[id]?`${best[id].score}/100`:'—';ctx.textAlign='right';text(score,1105,y+80,48,'#e2b873');ctx.textAlign='left';y+=160;
  }
  text('Change the form. Keep the whole.',70,1000,32);text('Play: wolfbreed1829.github.io/isomass-web/challenge.html',70,1050,25,'#78c4bc');
  text('Personal records from this device · time does not affect points',70,1120,21,'#a1b1b4');
  return canvas;
}
