// Explicit CPU-only development desk; default v1 server/UI unchanged. No inference route.
import {createServer} from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadPacket} from '../packet-core.mjs';
import {V2_POLICY} from './v2-contract.mjs';
import {v2Case} from './v2-input.mjs';
import {parseV2JSON} from './v2-json.mjs';
import {enrichV2} from './v2-backend.mjs';
export function developmentDeskCase(id){
  if(!V2_POLICY.allowed_case_ids.includes(id))throw Error('development_case_not_allowed');
  const packet=loadPacket(),record=packet.records.find(r=>r.source_record_id===id);
  const path=new URL('../artifacts/v2-development/batch-01/attempts/'+id+'.json',import.meta.url);
  const attempt=existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null;
  let value=null,parse_error=null;
  if(attempt?.status==='complete')try{value=parseV2JSON(attempt.raw.message.content);}catch{parse_error='INVALID_CONTENT_JSON';}
  return {version:V2_POLICY.version,phase:'development',case:v2Case(record),attempt_status:attempt?.status??'not-attempted',raw_model_content:attempt?.raw?.message?.content??null,raw_proposal:value,parse_error,backend:enrichV2(record,packet.records,value),model_calls_from_ui:0};
}
export function createDevelopmentDesk(){return createServer((req,res)=>{
  try{
    if(req.method!=='GET'){res.writeHead(405);res.end('Read-only development desk');return;}
    const url=new URL(req.url,'http://localhost');
    if(url.pathname==='/api/case'){
      const out=developmentDeskCase(url.searchParams.get('id'));res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(out));return;
    }
    const name={'/':'v2-desk.html','/v2-desk-client.mjs':'v2-desk-client.mjs','/v2-desk.css':'v2-desk.css'}[url.pathname];
    if(!name){res.writeHead(404);res.end('Not found');return;}
    res.writeHead(200,{'Content-Type':name.endsWith('.html')?'text/html; charset=utf-8':name.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Cache-Control':'no-store'});res.end(readFileSync(new URL(name,import.meta.url)));
  }catch(error){res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:error.message}));}
});}
if(process.argv[1]===fileURLToPath(import.meta.url))createDevelopmentDesk().listen(Number(process.env.P09_V2_PORT??5109),'127.0.0.1',()=>console.log('P09 v2 CPU development desk ready'));
