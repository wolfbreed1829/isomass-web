import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve} from 'node:path';
const root=resolve('docs'),types={'.html':'text/html','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml'};
const server=http.createServer(async(req,res)=>{try{const p=new URL(req.url,'http://localhost').pathname;const target=resolve(root,'.'+(p==='/'?'/index.html':decodeURIComponent(p)));if(!target.startsWith(root))throw Error();const data=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);}catch{res.writeHead(404);res.end('Not found');}});
server.listen(0,'127.0.0.1',()=>console.log('Local: http://127.0.0.1:'+server.address().port));
