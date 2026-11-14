import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
const name='isomass-sql-qa-'+crypto.randomUUID().slice(0,8);
const docker=(args,input)=>execFileSync('docker',args,{encoding:'utf8',input,stdio:['pipe','pipe','pipe']});
try{
  docker(['run','--rm','-d','--name',name,'--network','none','--tmpfs','/var/lib/postgresql/data','-e','POSTGRES_HOST_AUTH_METHOD=trust','postgres:17']);
  let ready=false;for(let i=0;i<30;i++){try{docker(['exec',name,'pg_isready','-U','postgres']);ready=true;break;}catch{await new Promise(r=>setTimeout(r,500));}}
  if(!ready)throw Error('Temporary database did not become ready.');
  const sql='create role anon; create role authenticated; create role service_role;\n'+readFileSync('supabase/migrations/202611140001_isomass_leaderboard.sql','utf8')+'\n'+readFileSync('tests/database.sql','utf8');
  const output=docker(['exec','-i',name,'psql','-U','postgres','-v','ON_ERROR_STOP=1'],sql);
  console.log(output.trim());console.log('Database migration, permissions, scoring, replay deduplication, and ties passed.');
}finally{try{docker(['rm','-f',name]);}catch{}}
