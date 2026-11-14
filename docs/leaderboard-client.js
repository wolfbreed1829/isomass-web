import {LEADERBOARD_API} from './leaderboard-config.js';
const AUTH_KEY='isomass:leaderboard-session:v1';
const localQA=['localhost','127.0.0.1'].includes(location.hostname)&&new URLSearchParams(location.search).has('qaApi');
const base=localQA?new URL('./api/',location.href).href:LEADERBOARD_API;
let identity=null;
try{const saved=JSON.parse(localStorage.getItem(AUTH_KEY)||'null');if(saved&&/^[a-f0-9]{64}$/.test(saved.token)&&Date.parse(saved.expiresAt)>Date.now())identity=saved;}catch{}
export const leaderboard={
  ready:()=>!!base,
  identity:()=>identity,
  async request(path,{method='GET',body,auth=false}={}){
    if(!base)throw new Error('The public leaderboard is not connected yet. Your score is saved locally and can be submitted when it opens.');
    const headers={};if(body)headers['Content-Type']='application/json';if(auth&&identity)headers.Authorization=`Bearer ${identity.token}`;
    let response;try{response=await fetch(`${base.replace(/\/$/,'')}/${path}`,{method,headers,body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000),cache:'no-store'});}catch{throw new Error('The leaderboard could not be reached. Your local score is safe; try again shortly.');}
    const data=await response.json();if(!response.ok){if(response.status===401&&auth){identity=null;try{localStorage.removeItem(AUTH_KEY);}catch{}}throw new Error(data.error||'The leaderboard request failed.');}return data;
  },
  async signIn(mode,name,password){const data=await this.request(mode,{method:'POST',body:{name,password}});identity=data;try{localStorage.setItem(AUTH_KEY,JSON.stringify(data));}catch{}return data;},
  async signOut(){try{if(identity)await this.request('logout',{method:'POST',auth:true});}finally{identity=null;try{localStorage.removeItem(AUTH_KEY);}catch{}}},
  board:({offset=0,search=''}={})=>leaderboard.request(`leaderboard?offset=${offset}&search=${encodeURIComponent(search)}`),
  me:()=>leaderboard.request('me',{auth:true}),
  submit:result=>leaderboard.request('submit',{method:'POST',auth:true,body:{id:result.id,challengeId:result.challengeId,actions:result.actions}})
};
