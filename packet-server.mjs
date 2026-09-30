import http from 'node:http';
import {readFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {loadPacket, propose, hashCanonical, canonicalJSON, parseTSVBytes, sha256} from './packet-core.mjs';
import {validateModelProposal} from './model-input.mjs';
const ROOT=fileURLToPath(new URL('.',import.meta.url));
const REVIEWER={reviewer_id:'fictional-planner',organization:'ORG-DEMO',sites:['PLANT-A','PLANT-B']};
const message='Fresh source and proposal inspection is required; no acceptance was carried forward.';
export function createPacketDesk(packet=loadPacket(),attemptLoader=null){
  let version=0,records=[...packet.records],opened=records[0]?.source_record_id??null,selected=[],site='ALL';
  const revisions=new Map(),decisions=new Map(),admissions=new Map(records.map(r=>[r.source_record_id,0])),receipts=[],returns=[],exports=[],archives=[];
  const authorized=r=>r.values.organization===REVIEWER.organization&&REVIEWER.sites.includes(r.values.site);
  const visible=()=>records.filter(r=>authorized(r)&&(site==='ALL'||r.values.site===site));
  const reconcileVisible=()=>{const ids=new Set(visible().map(r=>r.source_record_id));selected=selected.filter(id=>ids.has(id));if(!ids.has(opened))opened=visible()[0]?.source_record_id??null;};
  const get=id=>records.find(r=>r.source_record_id===id&&authorized(r));
  const proposal=r=>{
    if(!r)return null;
    const p=propose(r,records);p.source_admission_generation=admissions.get(r.source_record_id)??0;
    const key=r.source_record_id+':'+p.source_admission_generation;p.proposal_revision=revisions.get(key)??1;p.review_state=decisions.get(key)??'unreviewed';
    delete p.proposal_sha256;p.proposal_sha256=hashCanonical(p);return p;
  };
  const currentReceipt=p=>receipts.find(r=>r.proposal_sha256===p?.proposal_sha256&&r.reviewer_scope_sha256===hashCanonical(REVIEWER));
  const modelView=r=>{
    if(!r)return {status:'NO_CURRENT_ROW',candidate:null};
    const path=join(ROOT,'artifacts/model-attempts',r.source_record_id+'.json');
    let attempt;try{attempt=attemptLoader?attemptLoader(r.source_record_id):(/^[A-Za-z0-9_-]+$/.test(r.source_record_id)&&existsSync(path)?JSON.parse(readFileSync(path,'utf8')):null);}catch{return {status:'INVALID_STORED_ATTEMPT',candidate:null};}
    if(!attempt)return {status:'NOT_RUN',candidate:null,meaning:'No inference runs from this desk'};
    let input;try{input=JSON.parse(attempt.request.messages.find(m=>m.role==='user').content);}catch{return {status:'INVALID_STORED_INPUT',candidate:null};}
    if(!input||typeof input!=='object'||Array.isArray(input)||input.case_id!==r.source_record_id||attempt.case_id!==r.source_record_id)return {status:'INVALID_STORED_INPUT',candidate:null,meaning:'Stored input and attempt must bind to this exact capture; no evidence is exposed'};
    if(input.source_fingerprint!==r.source_fingerprint)return {status:'ARCHIVED_STALE',candidate:null,raw:attempt.raw?.message?.content??'',original_source_ref:input.source_ref,original_source_fingerprint:input.source_fingerprint,meaning:'Historical stored output; original source revision '+(input.source_ref?.source_revision??'unknown')+'; no current evidence links or acceptance authority'};
    const raw=attempt.raw?.message?.content??'';let candidate;
    if(attempt.status!=='complete')return {status:attempt.status,candidate:null,raw,meaning:'Preserved failure; explicit rules remain usable'};
    try{candidate=JSON.parse(raw);}catch{return {status:'INVALID_JSON',candidate:null,raw};}
    const validation=validateModelProposal(candidate,r,records);
    return {status:validation.valid?'VALIDATED_UNREVIEWED':'REJECTED_BY_RULES',candidate,raw,validation,source_fingerprint:r.source_fingerprint,original_source_ref:input.source_ref,original_source_fingerprint:input.source_fingerprint,meaning:'Stored model proposal from source revision '+(input.source_ref?.source_revision??'unknown')+'. No human acceptance or scheduling implied.'};
  };
  const scopePreview=()=>{
    const rows=selected.map(id=>{const r=get(id),p=proposal(r);return {source_record_id:id,logical_record_identity:r?.logical_record_identity??null,source_fingerprint:r?.source_fingerprint??null,proposal_sha256:p?.proposal_sha256??null,review_receipt_id:currentReceipt(p)?.receipt_id??null};});
    const errors=rows.filter(row=>!visible().some(r=>r.source_record_id===row.source_record_id)||!row.review_receipt_id).map(row=>({source_record_id:row.source_record_id,issue:'Requires visible, authorized, current accepted normalization'}));
    const base={kind:'EXPLICIT_SELECTED_NORMALIZATION_ROWS',row_count:rows.length,rows,filter_site:site,errors,reviewer_scope_sha256:hashCanonical(REVIEWER)};
    return {...base,scope_sha256:hashCanonical(base)};
  };
  const snapshot=()=>{
    const r=get(opened),p=proposal(r);
    return {version,opened,selected,filter_site:site,reviewer:REVIEWER,admitted_source_revisions:[...new Set(records.filter(authorized).map(r=>r.source_ref.source_revision))],
      rows:visible().map(r=>({source_record_id:r.source_record_id,...r.values,source_ref:r.source_ref,source_fingerprint:r.source_fingerprint,reviewable:proposal(r).reviewable,review_state:currentReceipt(proposal(r))?'accepted':proposal(r).review_state})),
      record:r??null,proposal:p,stored_model:modelView(r),export_preview:scopePreview(),
      receipts:receipts.map(r=>({...r,current:!!records.find(s=>s.source_fingerprint===r.source_fingerprint&&proposal(s).proposal_sha256===r.proposal_sha256)&&r.reviewer_scope_sha256===hashCanonical(REVIEWER)})),returns,
      exports:exports.map(e=>({...e,source_reviews_current:e.scope_rows.every(row=>{const r=get(row.source_record_id),p=proposal(r);return !!r&&r.source_fingerprint===row.source_fingerprint&&p.proposal_sha256===row.proposal_sha256&&currentReceipt(p)?.receipt_id===row.review_receipt_id;}),matches_current_selection:e.scope_sha256===scopePreview().scope_sha256})),
      counts:{captures:records.filter(authorized).length,logical_rows:new Set(records.filter(authorized).map(r=>canonicalJSON(r.logical_record_identity))).size,visible:visible().length},
      experiment:{status:'CPU_RULE_BASELINE',model_calls:0,meaning:'Runtime never loads evaluation gold. Stored model comparison is separate.'}};
  };
  const send=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
  const stale=(res,error)=>send(res,409,{error,message,state:snapshot()});
  const bind=(body,p)=>p&&body.source_record_id===p.source_record_id&&body.source_fingerprint===p.source_fingerprint&&body.proposal_sha256===p.proposal_sha256&&body.normalized_content_sha256===p.normalized_content_sha256;
  const handler=async(req,res)=>{try{
    const url=new URL(req.url,'http://localhost');
    if(req.method==='GET'&&url.pathname==='/api/state')return send(res,200,snapshot());
    if(req.method==='POST'&&url.pathname.startsWith('/api/')){
      const chunks=[];let n=0;for await(const c of req){n+=c.length;if(n>1200000)throw Error('Request exceeds bounded size');chunks.push(c);}
      const b=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks))||'{}');
      if(b.expected_version!==version)return stale(res,'STALE_CLIENT_STATE');
      if(url.pathname==='/api/open'){if(!visible().some(r=>r.source_record_id===b.source_record_id))throw Error('Row not visible or admitted');opened=b.source_record_id;version++;return send(res,200,snapshot());}
      if(url.pathname==='/api/filter'){if(!['ALL',...REVIEWER.sites].includes(b.site))throw Error('Unknown site filter');site=b.site;reconcileVisible();version++;return send(res,200,snapshot());}
      if(url.pathname==='/api/select'){
        if(!Array.isArray(b.source_record_ids)||new Set(b.source_record_ids).size!==b.source_record_ids.length||b.source_record_ids.some(id=>!visible().some(r=>r.source_record_id===id)))throw Error('Selection must name unique visible authorized rows');
        selected=[...b.source_record_ids];version++;return send(res,200,snapshot());
      }
      if(['/api/review','/api/return','/api/correct','/api/regenerate'].includes(url.pathname)){
        const r=get(b.source_record_id),p=proposal(r);if(!bind(b,p))return stale(res,'STALE_PROPOSAL');
        if(url.pathname==='/api/review'){
          if(b.inspected!==true)throw Error('Explicit inspection required');
          if(!p.reviewable)throw Error('Normalization blocked: '+p.blocking_issues.join(', '));
          if(!currentReceipt(p)){
            const receipt={receipt_id:'review-'+(receipts.length+1),reviewed_at:new Date().toISOString(),source_record_id:r.source_record_id,source_ref:r.source_ref,source_fingerprint:r.source_fingerprint,source_admission_generation:p.source_admission_generation,proposal_sha256:p.proposal_sha256,normalized_content_sha256:p.normalized_content_sha256,proposal_revision:p.proposal_revision,normalizer_rule_version:p.normalizer_rule_version,evidence:p.evidence,reviewer:REVIEWER,reviewer_scope_sha256:hashCanonical(REVIEWER),normalized_fields:p.normalized_fields,scheduling_unknowns:p.scheduling_unknowns,meaning:'Accepted normalization only; unscheduled and not_submitted'};
            receipts.push({...receipt,receipt_sha256:hashCanonical(receipt)});version++;
          }
        }else{
          if(url.pathname!=='/api/regenerate'&&(!b.reason||typeof b.reason!=='string'||b.reason.trim().length<3))throw Error('A review reason is required');
          if(url.pathname==='/api/correct'&&canonicalJSON(b.normalized_fields)!==canonicalJSON(p.normalized_fields))throw Error('Correction is not supported by exact source cells and bounded grammar; clarify source instead');
          returns.push({kind:url.pathname.slice(5),source_record_id:r.source_record_id,previous_proposal_sha256:p.proposal_sha256,reason:b.reason??'Explicit regeneration',accepted:false});
          const key=r.source_record_id+':'+p.source_admission_generation;revisions.set(key,p.proposal_revision+1);decisions.set(key,url.pathname==='/api/return'?'returned':'unreviewed');version++;
        }return send(res,200,snapshot());
      }
      if(url.pathname==='/api/source-change'){
        const r=get(b.source_record_id),p=proposal(r);if(!bind(b,p))return stale(res,'STALE_PROPOSAL');
        if(typeof b.revision!=='string'||!b.revision.trim()||b.revision===r.source_ref.source_revision)throw Error('Simulation requires a distinct explicit source revision');
        if(!['frequency_text','site'].includes(b.column)||typeof b.value!=='string')throw Error('Only literal frequency/site changes are supported by this local simulation');
        const values={...r.values,[b.column]:b.value};const sourceFile=packet.files.find(f=>f.file===r.source_ref.file)??packet.files[0];const columns=sourceFile.metadata.columns;
        const cell=s=>/[\t"\r\n]/.test(s)?'"'+s.replaceAll('"','""')+'"':s;
        const bytes=Buffer.from(columns.join('\t')+'\r\n'+columns.map(c=>cell(values[c])).join('\t')+'\r\n');
        const metadata={...sourceFile.metadata,file:'local-revision.tsv',source_revision:b.revision,sha256:sha256(bytes),data_row_count:1};
        const changed=parseTSVBytes(bytes,metadata,packet.manifest).records[0];
        archives.push(r);admissions.set(r.source_record_id,(admissions.get(r.source_record_id)??0)+1);records=records.map(old=>old.source_record_id===r.source_record_id?changed:old);reconcileVisible();version++;
        return send(res,200,snapshot());
      }
      if(url.pathname==='/api/export'){
        const preview=scopePreview();if(b.scope_sha256!==preview.scope_sha256||canonicalJSON(b.source_record_ids)!==canonicalJSON(selected))return stale(res,'STALE_EXPORT_SCOPE');
        if(!preview.row_count||preview.errors.length)throw Error('Every explicitly selected row needs a current accepted normalization; no rows are silently omitted');
        const draft={kind:'REVIEWED_NORMALIZATION_JSON_DRAFT',row_count:preview.row_count,source_record_ids:[...selected],scope_sha256:preview.scope_sha256,normalization_rows:selected.map(id=>{const p=proposal(get(id));return {source_ref:p.source_ref,source_fingerprint:p.source_fingerprint,proposal_sha256:p.proposal_sha256,evidence:p.evidence,review_receipt:currentReceipt(p),...p.normalized_fields,scheduling_unknowns:p.scheduling_unknowns};}),unscheduled:true,target_import_status:'not_submitted',target_import_receipt:null,semantics:'Explicit selected draft rows only. No CMMS create, update, delete or full-snapshot semantics.'};
        const acknowledgement={acknowledgement_id:'export-'+(exports.length+1),exported_at:new Date().toISOString(),snapshot_version:version,draft_sha256:hashCanonical(draft),scope_sha256:preview.scope_sha256,row_count:preview.row_count,source_record_ids:[...selected],filter_site:site,scope_rows:preview.rows.map(row=>({...row,source_ref:get(row.source_record_id).source_ref})),target_import_receipt:null};exports.push(acknowledgement);version++;
        return send(res,200,{...snapshot(),download:draft,export_acknowledgement:acknowledgement});
      }
      throw Error('Unknown action');
    }
    const files={'/':'index.html','/app.mjs':'app.mjs','/ui-evidence.mjs':'ui-evidence.mjs','/style.css':'style.css'};
    if(req.method!=='GET'||!files[url.pathname])return send(res,404,{error:'NOT_FOUND'});
    const f=files[url.pathname];res.writeHead(200,{'Content-Type':f.endsWith('.html')?'text/html; charset=utf-8':f.endsWith('.css')?'text/css; charset=utf-8':'text/javascript; charset=utf-8','Content-Security-Policy':"default-src 'self'; connect-src 'self'; script-src 'self'; style-src 'self'; object-src 'none'; base-uri 'none'",'Cache-Control':'no-store'});res.end(readFileSync(join(ROOT,f)));
  }catch(e){send(res,400,{error:'INVALID_INPUT_OR_REVIEW',message:e.message});}};
  return {handler,snapshot};
}
if(process.argv[1]===fileURLToPath(import.meta.url))http.createServer(createPacketDesk().handler).listen(5089,'127.0.0.1',()=>console.log('Fictional packet draft desk; no live model or target integration'));
