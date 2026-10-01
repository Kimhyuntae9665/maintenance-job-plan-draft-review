import http from 'node:http';import {readFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {join} from 'node:path';
import {importSource,findConflicts,hash,canonical} from './source.mjs';import {propose,reviewDraft} from './normalize.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const demo=()=>importSource({source_id:'scaffold-demo',namespace:'fictional-scaffold',source_revision:'demo-r1',format:'tsv',text:readFileSync(join(ROOT,'scaffold/example.tsv'),'utf8')});
export function createDesk(initialSources=[demo()]){
  let version=0,sources=[...initialSources],selected=null;const receipts=[],exports=[];
  // A user import explicitly admits its declared source revision. Older bytes
  // remain archived. Same source ID/revision with differing hashes keeps both
  // admitted, so same-row conflicts cannot become last-write-wins.
  const activeSources=()=>{const revisions=new Map(sources.map(s=>[canonical([s.namespace,s.source_id]),s.source_revision]));return sources.filter(s=>revisions.get(canonical([s.namespace,s.source_id]))===s.source_revision);};
  const allRows=()=>activeSources().flatMap(s=>s.rows.filter(r=>!r.section_break).map(r=>({source:s,row:r,key:canonical([s.namespace,s.source_id,s.file_hash,s.source_revision,r.locator])})));
  const snapshot=()=>{const rows=allRows();if(!selected||!rows.some(r=>r.key===selected))selected=rows[0]?.key??null;const item=rows.find(r=>r.key===selected);const admitted=activeSources();const conflicts=findConflicts(admitted);const proposal=item?propose(item.source,item.row,conflicts):null;return {version,sources:sources.map(s=>({...s,admitted:admitted.includes(s)})),rows:rows.map(r=>({key:r.key,row_locator:r.row.locator,source_id:r.source.source_id,row_id:r.row.cells.row_id?.value??'',equipment_id:r.row.cells.equipment_id?.value??'',site:r.row.cells.site?.value??''})),selected,proposal,receipts:receipts.map(r=>({...r,current:!!proposal&&r.proposal_fingerprint===proposal.proposal_fingerprint})),exports,experiment:{status:'WAITING_FOR_FIXTURE_AND_ORACLE',model_calls:0,evaluation_results:null}};};
  const json=(res,status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  const handler=async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost');
    if(url.pathname.startsWith('/source-desk/api/'))url.pathname=url.pathname.slice('/source-desk'.length);
    if(req.method==='GET'&&url.pathname==='/api/state')return json(res,200,snapshot());
    if(req.method==='POST'&&url.pathname.startsWith('/api/')){
      const chunks=[];let byteCount=0;for await(const chunk of req){byteCount+=chunk.length;if(byteCount>1200000)throw new Error('Request too large');chunks.push(chunk);}const raw=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks));const body=JSON.parse(raw||'{}');
      if(body.expected_version!==version)return json(res,409,{error:'STALE_CLIENT_STATE',message:'Source or proposal changed. Inspect refreshed cells and confirm again.',state:snapshot()});
      if(url.pathname==='/api/select'){selected=body.key;if(!allRows().some(r=>r.key===selected))throw new Error('Unknown source row');version++;return json(res,200,snapshot());}
      if(url.pathname==='/api/source'){
        const incoming=importSource(body.source);if(sources.some(s=>s.source_id===incoming.source_id&&s.namespace===incoming.namespace&&s.source_revision===incoming.source_revision&&s.file_hash===incoming.file_hash))return json(res,200,snapshot());
        // Append immutable versions; differing same-revision rows remain a conflict.
        sources.push(incoming);const row=incoming.rows.find(r=>!r.section_break);selected=row?canonical([incoming.namespace,incoming.source_id,incoming.file_hash,incoming.source_revision,row.locator]):null;version++;return json(res,200,snapshot());
      }
      if(url.pathname==='/api/review'){
        const p=snapshot().proposal;
        if(!p||body.proposal_fingerprint!==p.proposal_fingerprint||body.file_hash!==p.file_hash||body.source_revision!==p.source_revision||body.row_locator!==p.row_locator)return json(res,409,{error:'STALE_PROPOSAL',message:'Displayed field values or source basis changed; fresh inspection is required.',state:snapshot()});
        if(body.inspected!==true)throw new Error('Explicit inspection required');
        const draft=reviewDraft(p);if(!receipts.some(r=>r.proposal_fingerprint===p.proposal_fingerprint)){
          const record={receipt_id:'review-'+(receipts.length+1),proposal_fingerprint:p.proposal_fingerprint,source_id:p.source_id,file_hash:p.file_hash,namespace:p.namespace,source_revision:p.source_revision,row_locator:p.row_locator,draft,meaning:'Local fictional draft inspection; not operational authorization'};
          receipts.push({...record,receipt_fingerprint:hash(record)});version++;
        }return json(res,200,snapshot());
      }
      if(url.pathname==='/api/export'){
        const p=snapshot().proposal,r=receipts.find(r=>r.proposal_fingerprint===p?.proposal_fingerprint);
        if(!r||body.proposal_fingerprint!==p?.proposal_fingerprint) return json(res,409,{error:'NO_CURRENT_REVIEW',message:'Export requires current source-bound inspection.',state:snapshot()});
        const acknowledgement={acknowledgement_id:'export-'+(exports.length+1),kind:'LOCAL_JSON_DRAFT_EXPORT',draft_fingerprint:r.draft.draft_fingerprint,proposal_fingerprint:r.proposal_fingerprint,target_import_receipt:null};exports.push(acknowledgement);version++;return json(res,200,{...snapshot(),download:r.draft,export_acknowledgement:acknowledgement});
      }throw new Error('Unknown API action');
    }
    const files={'/':'source-desk.html','/source-desk':'source-desk.html','/source-desk/':'source-desk.html','/source-desk/source-app.mjs':'source-app.mjs','/source-desk/source-style.css':'source-style.css','/source-desk/base.css':'style.css'};if(req.method!=='GET'||!files[url.pathname])return json(res,404,{error:'NOT_FOUND'});
    const file=files[url.pathname];res.writeHead(200,{'Content-Type':file.endsWith('.html')?'text/html; charset=utf-8':file.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'",'Cache-Control':'no-store'});res.end(readFileSync(join(ROOT,file)));
  }catch(error){json(res,400,{error:'INVALID_INPUT_OR_REVIEW',message:error.message});}};
  return {handler,snapshot};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const desk=createDesk();http.createServer(desk.handler).listen(5089,'127.0.0.1',()=>console.log('P09 fictional draft desk on loopback port 5089; zero model calls'));}
