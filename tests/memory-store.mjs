import {scoreFor} from '../docs/scoring.js';
// Test fixture only. No persistence, never used by the production function.
export function memoryStore({now=()=>Date.now()}={}){
  const players=new Map(),sessions=new Map(),attempts=new Map(),bests=new Map(),rates=new Map();
  const conflict=()=>{const e=Error('Conflict');e.code='23505';throw e;};
  function rows(){
    const list=[...players.values()].flatMap(p=>{const scores=Object.fromEntries([...bests.values()].filter(b=>b.playerId===p.id).map(b=>[b.challengeId,b.score]));return Object.keys(scores).length?[{player_id:p.id,name:p.name,total:Object.values(scores).reduce((a,b)=>a+b,0),completed:Object.keys(scores).length,equal:scores.equal??null,focus:scores.focus??null,restore:scores.restore??null}]:[];}).sort((a,b)=>b.total-a.total||a.name.toLowerCase().localeCompare(b.name.toLowerCase()));
    let previous=null,rank=0;return list.map((r,i)=>{if(r.total!==previous){rank=i+1;previous=r.total;}return {...r,rank};});
  }
  return {
    players,sessions,attempts,
    async takeRate(key,limit,seconds){const bucket=key+':'+Math.floor(now()/1000/seconds),hits=(rates.get(bucket)||0)+1;rates.set(bucket,hits);return hits<=limit;},
    async createPlayer(p){if([...players.values()].some(x=>x.name_key===p.name_key))conflict();players.set(p.id,p);return p;},
    async playerByName(name){return [...players.values()].find(p=>p.name_key===name)||null;},
    async addSession(s){sessions.set(s.token_hash,s);},
    async findSession(hash,date){const s=sessions.get(hash);return s&&s.expires_at>date?{...s,name:players.get(s.player_id).name}:null;},
    async removeSession(hash){sessions.delete(hash);},
    async submit(run){
      const existing=attempts.get(run.id);if(existing&&(existing.playerId!==run.playerId||existing.traceHash!==run.traceHash||existing.challengeId!==run.challengeId))conflict();
      const row={...run,...scoreFor(run.challengeId,run.moves)};attempts.set(run.id,row);
      const key=run.playerId+':'+run.challengeId,old=bests.get(key);if(!old||row.score>old.score||(row.score===old.score&&row.moves<old.moves))bests.set(key,row);
      return {id:run.id,score:row.score,moves:row.moves};
    },
    async leaderboard(offset,search){const found=rows().filter(r=>r.name.toLowerCase().includes(search.toLowerCase()));return {rows:found.slice(offset,offset+25).map(({player_id,...r})=>r),totalPlayers:found.length};},
    async standing(id){return rows().find(r=>r.player_id===id)||null;}
  };
}
