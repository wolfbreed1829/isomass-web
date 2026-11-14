// Versioned scoring rules. Scores are personal browser records, not server attestations.
export const RULE_VERSION = 1;
export const SCORE_RULES = Object.freeze({
  equal: {title:'Make four equal pieces', minimumMoves:3, steps:3},
  focus: {title:'Change the selected family', minimumMoves:0, steps:2},
  restore: {title:'Break and restore a connection', minimumMoves:2, steps:3}
});
export const SCORE_KEY = 'isomass:scores:v1';
export const CHALLENGE_URL = 'https://wolfbreed1829.github.io/isomass-web/challenge.html';
export const cleanName = value => typeof value === 'string' ? [...value.replace(/[\u0000-\u001f\u007f]/g,'').trim()].slice(0,24).join('') : '';

export function cleanAttempt(value) {
  if(!value || value.version!==RULE_VERSION || typeof value.id!=='string' || !/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))return null;
  if(!Number.isSafeInteger(value.moves)||value.moves<0||value.moves>100000)return null;
  if(!Number.isSafeInteger(value.startedAt)||value.startedAt<=0)return null;
  const finishedAt=Number.isSafeInteger(value.finishedAt)&&value.finishedAt>=value.startedAt?value.finishedAt:null;
  const actions=cleanActions(value.actions);
  return {id:value.id,version:RULE_VERSION,moves:value.moves,startedAt:value.startedAt,finishedAt,actions};
}

export function cleanActions(value) {
  if(!Array.isArray(value)||value.length>1000)return null;
  const actions=[];
  for(const item of value){
    if(!item||!['split','merge','reset','undo','redo','select','pin'].includes(item.type))return null;
    if(item.type==='select'){
      if(!Number.isInteger(item.target)||item.target<1||item.target>127)return null;
      actions.push({type:'select',target:item.target});
    }else actions.push({type:item.type});
  }
  return actions;
}

export function scoreFor(challengeId,moves) {
  const rule=Object.hasOwn(SCORE_RULES,challengeId)?SCORE_RULES[challengeId]:null;
  if(!rule||!Number.isSafeInteger(moves)||moves<rule.minimumMoves||moves>100000)return null;
  const extraMoves=moves-rule.minimumMoves,bonus=Math.max(0,30-5*extraMoves);
  return {score:70+bonus,bonus,extraMoves};
}

export function resultFor(run) {
  const rule=Object.hasOwn(SCORE_RULES,run?.id)?SCORE_RULES[run.id]:null,attempt=cleanAttempt(run?.attempt);
  if(!rule||run.step!==rule.steps||!attempt?.finishedAt)return null;
  const points=scoreFor(run.id,attempt.moves);if(!points)return null;
  return {id:attempt.id,challengeId:run.id,version:RULE_VERSION,moves:attempt.moves,
    elapsedMs:attempt.finishedAt-attempt.startedAt,completedAt:attempt.finishedAt,actions:attempt.actions,...points};
}

export function cleanResult(value) {
  if(!value||value.version!==RULE_VERSION||typeof value.id!=='string'||!/^[a-zA-Z0-9_-]{1,80}$/.test(value.id))return null;
  const points=scoreFor(value.challengeId,value.moves);
  if(!points||!Number.isSafeInteger(value.elapsedMs)||value.elapsedMs<0||!Number.isSafeInteger(value.completedAt)||value.completedAt<=0||value.elapsedMs>value.completedAt||!Number.isFinite(new Date(value.completedAt).getTime()))return null;
  return {id:value.id,challengeId:value.challengeId,version:RULE_VERSION,moves:value.moves,elapsedMs:value.elapsedMs,completedAt:value.completedAt,actions:cleanActions(value.actions),...points};
}

export function bestResults(results) {
  const best={};
  for(const item of results){const old=best[item.challengeId];if(!old||item.score>old.score||(item.score===old.score&&item.completedAt>old.completedAt))best[item.challengeId]=item;}
  return best;
}

export function cleanBook(value) {
  const seen=new Set(),results=[];
  for(const raw of Array.isArray(value?.results)?value.results.slice(0,1000):[]){const r=cleanResult(raw);if(r&&!seen.has(r.id)){seen.add(r.id);results.push(r);}}
  return compactBook({version:RULE_VERSION,name:cleanName(value?.name),results});
}

function compactBook(book) {
  const sorted=book.results.slice().sort((a,b)=>b.completedAt-a.completedAt),bestIds=new Set(Object.values(bestResults(sorted)).map(r=>r.id));
  return {...book,results:sorted.filter((r,i)=>i<50||bestIds.has(r.id))};
}

export function addResult(book,result) {
  const valid=cleanResult(result);if(!valid||book.results.some(r=>r.id===valid.id))return book;
  return compactBook({...book,results:[valid,...book.results]});
}

export function formatDuration(ms) {
  const seconds=Math.floor(ms/1000),minutes=Math.floor(seconds/60),hours=Math.floor(minutes/60);
  if(hours>=24)return `${Math.floor(hours/24)}d ${hours%24}h`;
  if(hours)return `${hours}h ${minutes%60}m`;
  return minutes?`${minutes}m ${seconds%60}s`:`${seconds}s`;
}

export function scoreSummary(book) {
  const best=bestResults(book.results),count=Object.keys(best).length,total=Object.values(best).reduce((sum,r)=>sum+r.score,0);
  return {best,count,total};
}

export function shareText(book) {
  const {best,count,total}=scoreSummary(book),name=cleanName(book.name);
  return [`${name?name+' · ':''}ISOMASS CHALLENGE`,
    `My personal best: ${total}/300 points (${count}/3 challenges scored).`,
    ...Object.entries(SCORE_RULES).map(([id,rule])=>best[id]?`${rule.title}: ${best[id].score}/100 · ${best[id].moves} structural moves · ${formatDuration(best[id].elapsedMs)}`:`${rule.title}: not yet scored`),
    'Can you change the form and keep the whole? Play here:',CHALLENGE_URL,
    'Personal scores recorded on my device. Time does not affect points.'].join('\n');
}

export function scoreCSV(book) {
  const cell=value=>{let text=String(value);if(/^[=+@\-\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';};
  const rows=[['Nickname','Challenge','Points','Maximum','Structural moves','Extra moves','Elapsed seconds (including breaks)','Completed UTC','Rule version'],
    ...book.results.map(r=>[book.name,SCORE_RULES[r.challengeId].title,r.score,100,r.moves,r.extraMoves,Math.floor(r.elapsedMs/1000),new Date(r.completedAt).toISOString(),r.version])];
  return '\uFEFF'+rows.map(row=>row.map(cell).join(',')).join('\r\n');
}
