import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'..'),dest=resolve(root,'supabase/functions/isomass-leaderboard/lib');
await mkdir(dest,{recursive:true});
for(const name of ['model','learning','scoring','verify-run'])await writeFile(resolve(dest,name+'.js'),await readFile(resolve(root,'docs',name+'.js')));
await writeFile(resolve(dest,'handler.js'),(await readFile(resolve(root,'backend/handler.js'),'utf8')).replace('../docs/verify-run.js','./verify-run.js'));
await writeFile(resolve(dest,'supabase-store.js'),await readFile(resolve(root,'backend/supabase-store.js')));
console.log('Prepared Edge Function with current scoring and replay rules.');
