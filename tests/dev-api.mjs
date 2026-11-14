import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {extname,resolve,sep} from 'node:path';
import {createHandler} from '../backend/handler.js';
import {memoryStore} from './memory-store.mjs';
const root=resolve('docs'),types={'.html':'text/html; charset=utf-8','.css':'text/css','.js':'application/javascript','.svg':'image/svg+xml','.png':'image/png'};
let handler;
const server=http.createServer(async(req,res)=>{
  try{
    const base='http://127.0.0.1:'+server.address().port,url=new URL(req.url,base);
    if(url.pathname.startsWith('/api/')){
      const chunks=[];for await(const chunk of req)chunks.push(chunk);
      const response=await handler(new Request(url,{method:req.method,headers:req.headers,body:['GET','HEAD'].includes(req.method)?undefined:Buffer.concat(chunks)}));
      res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));return;
    }
    const target=resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!target.startsWith(root+sep))throw Error();
    const data=await readFile(target);res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-store'});res.end(data);
  }catch{res.writeHead(404);res.end('Not found');}
});
server.listen(0,'127.0.0.1',()=>{const base='http://127.0.0.1:'+server.address().port;handler=createHandler(memoryStore(),{origins:[base]});console.log('Temporary local QA only: '+base+'/?qaApi=1');});
