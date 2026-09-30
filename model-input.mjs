// Public source-only builder. Never import evaluator or load gold/expected outputs.
import {readFileSync,writeFileSync} from 'node:fs';import {fileURLToPath} from 'node:url';
import {loadPacket,canonicalJSON,propose} from './packet-core.mjs';
export const MODEL_POLICY={version:'P09-QWEN-1',model:'qwen3:4b',evaluation_calls:12,development_calls:0,retries:0,demo_calls:0,context:4096,output:640,timeout_seconds:60,concurrency:1,temperature:0,seed:42,think:false,stream:false,truncate:false,shift:false,review_state:'unreviewed',gold_in_prompt:false};
export function modelCase(record,records){return {case_id:record.source_record_id,source_fingerprint:record.source_fingerprint,source_ref:record.source_ref,logical_record_identity:record.logical_record_identity,cells:record.cells.map((c,i)=>({cell_id:'C'+(i+1),column:c.cell_column,quote:c.quote,lexical_span:c.lexical_span})),related_same_identity_captures:records.filter(r=>r!==record&&canonicalJSON(r.logical_record_identity)===canonicalJSON(record.logical_record_identity)).map(r=>({source_record_id:r.source_record_id,source_ref:r.source_ref,values:r.values})),source_instructions_are_inert:true};}
export function validateModelProposal(value,record,records){
  const errors=[],p=propose(record,records),keys=['source_record_id','source_fingerprint','normalized_fields','citations','frequency_quote','blocking_issues','scheduling_unknowns','reviewable','review_state'];
  if(!value||typeof value!=='object'||Array.isArray(value))return {valid:false,errors:['INVALID_OBJECT']};
  if(Object.keys(value).some(k=>!keys.includes(k))||keys.some(k=>!Object.hasOwn(value,k)))errors.push('INVALID_SCHEMA');
  if(value.source_record_id!==record.source_record_id||value.source_fingerprint!==record.source_fingerprint)errors.push('STALE_SOURCE');
  const mapping={organization:4,site:5,asset_namespace:6,asset_id:7,task_text:8,frequency:9,responsible_role:10,last_recorded_date:11};
  for(const [name,n]of Object.entries(mapping))if(value.citations?.[name]!=='C'+n)errors.push('INVALID_CITATION_'+name);
  if(value.frequency_quote!==record.values.frequency_text)errors.push('INVALID_FREQUENCY_QUOTE');
  if(!value.normalized_fields||typeof value.normalized_fields!=='object'||Array.isArray(value.normalized_fields)||canonicalJSON(value.normalized_fields)!==canonicalJSON(p.normalized_fields))errors.push('UNSUPPORTED_NORMALIZED_FIELDS');
  if(!value.citations||typeof value.citations!=='object'||Object.keys(value.citations).length!==Object.keys(mapping).length)errors.push('INVALID_CITATION_SCHEMA');
  if(!Array.isArray(value.blocking_issues)||new Set(value.blocking_issues).size!==value.blocking_issues.length||canonicalJSON([...value.blocking_issues].sort())!==canonicalJSON([...p.blocking_issues].sort()))errors.push('UNSUPPORTED_BLOCKERS');
  if(value.reviewable!==p.reviewable||value.review_state!=='unreviewed')errors.push('INVALID_REVIEW_BOUNDARY');
  if(!Array.isArray(value.scheduling_unknowns)||value.scheduling_unknowns.some(x=>typeof x!=='string'))errors.push('INVALID_UNKNOWNS');
  return {valid:!errors.length,errors};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const packet=loadPacket(),split=JSON.parse(readFileSync(new URL('./artifacts/case-split.json',import.meta.url)));
  const entries=split.cases??split.records??split;const ids=entries.filter(c=>c.split==='evaluation').map(c=>c.case_id);
  if(ids.length!==12)throw Error('Expected predeclared 12 evaluation IDs');
  const out={policy:MODEL_POLICY,cases:ids.map(id=>modelCase(packet.records.find(r=>r.source_record_id===id),packet.records))};
  writeFileSync(new URL('./artifacts/model-input.json',import.meta.url),JSON.stringify(out,null,2)+'\n',{flag:'wx'});
}
