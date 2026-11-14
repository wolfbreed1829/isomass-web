import test from 'node:test';
import assert from 'node:assert/strict';
import {createHandler,normalizeName} from '../backend/handler.js';
import {createSupabaseStore} from '../backend/supabase-store.js';
import {memoryStore} from './memory-store.mjs';
import {equal,focus,restore} from './fixtures.mjs';
function setup(){
  let time=Date.now();const store=memoryStore({now:()=>time}),handler=createHandler(store,{now:()=>time});
  const call=async(path,body,token,origin='https://wolfbreed1829.github.io')=>{
    const response=await handler(new Request('https://test/api/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,...(token?{Authorization:'Bearer '+token}:{}),'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}));
    return {status:response.status,headers:response.headers,data:await response.json()};
  };
  return {store,call,advance:ms=>time+=ms};
}
test('names are normalized and restricted',()=>{assert.deepEqual(normalizeName('  Pattern   Seeker '),{name:'Pattern Seeker',nameKey:'pattern seeker'});for(const value of ['a','<script>','a\nb',null])assert.throws(()=>normalizeName(value));});
test('account protection, replayed scoring, best totals, ties, and cross-session reads',async()=>{
  const {call,store}=setup();
  const a=await call('signup',{name:'Pattern Seeker',password:'safe local test phrase'});assert.equal(a.status,201);const token=a.data.token;
  assert.equal((await call('signup',{name:'pattern seeker',password:'different phrase'})).status,409);
  assert.equal((await call('login',{name:'Pattern Seeker',password:'wrong phrase'})).status,401);
  const login=await call('login',{name:'PATTERN SEEKER',password:'safe local test phrase'});assert.equal(login.status,200);
  assert.ok(!JSON.stringify([...store.players.values()]).includes('safe local test phrase'));assert.ok(!JSON.stringify([...store.sessions.values()]).includes(token));
  assert.equal((await call('submit',{id:crypto.randomUUID(),challengeId:'equal',actions:equal})).status,401);
  assert.equal((await call('submit',{id:crypto.randomUUID(),challengeId:'equal',actions:[],score:300},token)).status,400);
  for(const [challengeId,actions] of [['equal',equal],['focus',focus],['restore',restore]]){
    const body={id:crypto.randomUUID(),challengeId,actions,score:999,moves:0};const submitted=await call('submit',body,token);assert.equal(submitted.status,200);assert.equal(submitted.data.score,100);
    assert.equal((await call('submit',body,token)).status,200);
  }
  assert.equal(store.attempts.size,3);assert.equal((await call('me',undefined,login.data.token)).data.standing.total,300);
  const b=await call('signup',{name:'Another Player',password:'another test phrase'});
  for(const [challengeId,actions] of [['equal',equal],['focus',focus],['restore',restore]])await call('submit',{id:crypto.randomUUID(),challengeId,actions},b.data.token);
  const board=await call('leaderboard');assert.equal(board.data.totalPlayers,2);assert.deepEqual(board.data.rows.map(r=>r.rank),[1,1]);assert.ok(!JSON.stringify(board.data).includes('password'));
  const first=[...store.attempts.values()][0];assert.equal((await call('submit',{id:first.id,challengeId:'equal',actions:equal},b.data.token)).status,409);
  assert.equal((await call('logout',{},token)).status,200);assert.equal((await call('me',undefined,token)).status,401);
  assert.equal((await call('me',undefined,login.data.token)).status,200);
});
test('expiry, malformed payloads, CORS, request size, and account rate limits',async()=>{
  const {call,advance}=setup();const a=await call('signup',{name:'Time Traveler',password:'test passphrase'});
  advance(91*86400000);assert.equal((await call('me',undefined,a.data.token)).status,401);
  assert.equal((await call('signup',null)).status,400);assert.equal((await call('signup',{name:'valid',password:'tiny'})).status,400);
  assert.equal((await call('health',undefined,undefined,'https://untrusted.test')).status,403);
  assert.equal((await call('signup',{name:'valid',password:'x'.repeat(70000)})).status,413);
  let response;for(let i=0;i<31;i++)response=await call('login',{name:'Unknown Person',password:'test passphrase'});assert.equal(response.status,429);
});
test('Supabase REST adapter selects only public leaderboard fields and uses bounded requests',async()=>{
  let seen;const store=createSupabaseStore('https://db.test','server-only-placeholder',{fetcher:async(url,options)=>{seen={url:new URL(url),options};return new Response('[]',{headers:{'content-range':'0-24/30'}});}});
  const r=await store.leaderboard(25,'A_B');assert.equal(r.totalPlayers,30);assert.equal(seen.url.searchParams.get('limit'),'25');assert.ok(!seen.url.searchParams.get('select').includes('password'));assert.equal(seen.url.searchParams.get('name_key'),'ilike.*a\\_b*');assert.equal(seen.options.headers.Prefer,'count=exact');
});
