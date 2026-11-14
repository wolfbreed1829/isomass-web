// Server only. Never import this module or a service key into the browser.
export function createSupabaseStore(url,key,{fetcher=fetch}={}) {
  if(!url||!key)throw new Error('Missing server database configuration.');
  const root=url.replace(/\/$/,'')+'/rest/v1/';
  async function request(path,{query={},method='GET',body,count=false,representation=false}={}){
    const headers={apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json'};
    const preferences=[count?'count=exact':'',representation?'return=representation':''].filter(Boolean);
    if(preferences.length)headers.Prefer=preferences.join(',');
    const response=await fetcher(root+path+'?'+new URLSearchParams(query),{method,headers,body:body===undefined?undefined:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
    const text=await response.text();let data;try{data=text?JSON.parse(text):null;}catch{throw new Error('Invalid database response.');}
    if(!response.ok){const error=new Error('Database request failed.');error.code=data?.code;throw error;}
    return {data,count:Number(response.headers.get('content-range')?.split('/')[1]||0)};
  }
  const one=async(path,query)=>(await request(path,{query:{...query,limit:1}})).data?.[0]||null;
  const rpc=async(name,body)=>(await request(name,{method:'POST',body})).data;
  const publicColumns='rank,name,total,equal,focus,restore,completed';
  return {
    takeRate:(key,limit,seconds)=>rpc('rpc/isomass_take_rate_limit',{p_key:key,p_limit:limit,p_seconds:seconds}),
    async createPlayer(player){return (await request('isomass_players',{method:'POST',body:player,representation:true})).data[0];},
    playerByName:name=>one('isomass_players',{select:'*',name_key:'eq.'+name}),
    async addSession(session){await request('isomass_sessions',{method:'POST',body:session});},
    async findSession(hash,now){const row=await one('isomass_sessions',{select:'player_id,isomass_players(name)',token_hash:'eq.'+hash,expires_at:'gt.'+now});return row?{player_id:row.player_id,name:row.isomass_players.name}:null;},
    async removeSession(hash){await request('isomass_sessions',{method:'DELETE',query:{token_hash:'eq.'+hash}});},
    submit:run=>rpc('rpc/isomass_submit_score',{p_id:run.id,p_player_id:run.playerId,p_challenge:run.challengeId,p_moves:run.moves,p_trace_hash:run.traceHash}),
    async leaderboard(offset,search){
      const query={select:publicColumns,order:'total.desc,name_key.asc,player_id.asc',offset,limit:25};
      if(search)query.name_key='ilike.*'+search.toLowerCase().replace(/[\\%_*]/g,c=>'\\'+c)+'*';
      const result=await request('isomass_rankings',{query,count:true});return {rows:result.data,totalPlayers:result.count};
    },
    standing:id=>one('isomass_rankings',{select:publicColumns,player_id:'eq.'+id})
  };
}
