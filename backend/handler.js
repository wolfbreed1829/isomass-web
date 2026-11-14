import {verifyRun} from '../docs/verify-run.js';

const encoder=new TextEncoder();
const hex=bytes=>[...new Uint8Array(bytes)].map(v=>v.toString(16).padStart(2,'0')).join('');
const randomHex=n=>hex(crypto.getRandomValues(new Uint8Array(n)));
export const digest=async value=>hex(await crypto.subtle.digest('SHA-256',encoder.encode(value)));
export function normalizeName(value){
  if(typeof value!=='string'||value.length>100)throw new ApiError(400,'Choose a leaderboard name.');
  const name=value.normalize('NFKC').trim().replace(/ +/g,' ');
  if([...name].length<3||[...name].length>24||!/^[\p{L}\p{N} _-]+$/u.test(name))throw new ApiError(400,'Use 3–24 letters, numbers, spaces, underscores or hyphens.');
  return {name,nameKey:name.toLowerCase()};
}
export class ApiError extends Error {constructor(status,message){super(message);this.status=status;}}
async function passwordHash(password,salt){
  const key=await crypto.subtle.importKey('raw',encoder.encode(password),'PBKDF2',false,['deriveBits']);
  return hex(await crypto.subtle.deriveBits({name:'PBKDF2',salt:encoder.encode(salt),iterations:120000,hash:'SHA-256'},key,256));
}
function equalHash(a,b){let mismatch=a.length^b.length;for(let i=0;i<a.length;i++)mismatch|=a.charCodeAt(i)^(b.charCodeAt(i)||0);return mismatch===0;}
async function readBody(request){
  let size=0,text='';const reader=request.body?.getReader();if(!reader)throw new ApiError(400,'A request body is required.');
  const decoder=new TextDecoder();
  while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>65536){await reader.cancel();throw new ApiError(413,'This submission is too large.');}text+=decoder.decode(part.value,{stream:true});}
  try{const value=JSON.parse(text+decoder.decode());if(!value||typeof value!=='object'||Array.isArray(value))throw Error();return value;}catch{throw new ApiError(400,'Invalid request data.');}
}

export function createHandler(store,{origins=['https://wolfbreed1829.github.io'],now=()=>Date.now()}={}){
  return async request=>{
    const origin=request.headers.get('origin');
    const headers={'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','Vary':'Origin'};
    if(origin&&origins.includes(origin))headers['Access-Control-Allow-Origin']=origin;
    const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
    try{
      if(origin&&!origins.includes(origin))throw new ApiError(403,'This website is not allowed to use the leaderboard.');
      if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Access-Control-Max-Age':'86400'}});
      const url=new URL(request.url),route=url.pathname.split('/').filter(Boolean).at(-1);
      const ip=request.headers.get('x-forwarded-for')?.split(',')[0].trim()||'unknown';
      const ipKey=await digest(ip);
      async function limited(scope,key,limit,seconds){if(!await store.takeRate(`${scope}:${key}`,limit,seconds))throw new ApiError(429,'Too many attempts. Please wait a few minutes and try again.');}
      async function authenticate(){
        const token=request.headers.get('authorization')?.match(/^Bearer ([a-f0-9]{64})$/)?.[1];
        if(!token)throw new ApiError(401,'Sign in to submit a score.');
        const session=await store.findSession(await digest(token),new Date(now()).toISOString());
        if(!session)throw new ApiError(401,'Your sign-in expired. Sign in again with your leaderboard name.');
        return session;
      }
      async function sessionFor(player){
        const token=randomHex(32),expiresAt=new Date(now()+90*86400000).toISOString();
        await store.addSession({token_hash:await digest(token),player_id:player.id,expires_at:expiresAt});
        return {name:player.name,playerId:player.id,token,expiresAt};
      }
      if(route==='health'&&request.method==='GET')return response({ok:true,ruleVersion:1});
      if(route==='leaderboard'&&request.method==='GET'){
        const offset=Math.max(0,Math.min(100000,Number(url.searchParams.get('offset'))||0));
        const search=(url.searchParams.get('search')||'').normalize('NFKC').trim().slice(0,24);
        return response(await store.leaderboard(Math.floor(offset),search));
      }
      if(route==='me'&&request.method==='GET'){
        const session=await authenticate();return response({name:session.name,playerId:session.player_id,standing:await store.standing(session.player_id)});
      }
      if(route==='signup'||route==='login'){
        if(request.method!=='POST')throw new ApiError(405,'Use POST for this action.');
        await limited('account',ipKey,30,600);
        const body=await readBody(request),{name,nameKey}=normalizeName(body.name);
        if(typeof body.password!=='string'||body.password.length<8||body.password.length>128)throw new ApiError(400,'Use a private passphrase of 8–128 characters.');
        if(route==='signup'){
          await limited('signup',ipKey,5,3600);await limited('signup-all','global',500,3600);
          const salt=randomHex(16),hash=await passwordHash(body.password,salt);
          const player=await store.createPlayer({id:crypto.randomUUID(),name,name_key:nameKey,password_salt:salt,password_hash:hash});
          return response(await sessionFor(player),201);
        }
        await limited('login-name',await digest(nameKey),12,600);
        const player=await store.playerByName(nameKey);
        const hash=await passwordHash(body.password,player?.password_salt||'00000000000000000000000000000000');
        if(!player||!equalHash(hash,player.password_hash))throw new ApiError(401,'That name and passphrase do not match.');
        return response(await sessionFor(player));
      }
      if(route==='submit'&&request.method==='POST'){
        const session=await authenticate();await limited('submit',session.player_id,60,3600);
        const body=await readBody(request);
        if(typeof body.id!=='string'||!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.id))throw new ApiError(400,'Invalid attempt identifier.');
        let verified;try{verified=verifyRun(body.challengeId,body.actions);}catch(error){throw new ApiError(400,error.message);}
        const traceHash=await digest(JSON.stringify({challengeId:verified.challengeId,actions:verified.actions}));
        const result=await store.submit({id:body.id,playerId:session.player_id,challengeId:verified.challengeId,moves:verified.moves,traceHash});
        return response({accepted:true,score:verified.score,moves:verified.moves,standing:await store.standing(session.player_id),result});
      }
      if(route==='logout'&&request.method==='POST'){
        await authenticate();const token=request.headers.get('authorization').slice(7);await store.removeSession(await digest(token));return response({ok:true});
      }
      throw new ApiError(404,'Unknown leaderboard action.');
    }catch(error){
      if(error.code==='23505')return response({error:'That leaderboard name or attempt is already in use.'},409);
      if(error instanceof ApiError)return response({error:error.message},error.status);
      return response({error:'The leaderboard is temporarily unavailable. Your local score is safe; try submitting again.'},503);
    }
  };
}
