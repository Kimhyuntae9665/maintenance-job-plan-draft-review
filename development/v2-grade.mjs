// Evaluator only: semantic authority comes from separate labels, never rule vocabulary.
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {canonicalJSON} from '../packet-core.mjs';
import {parseV2JSON} from './v2-json.mjs';
import {verifyV2Freeze,verifyV2Attempt} from './v2-integrity.mjs';
import {validateV2Shape,validateV2Evidence,v2SuggestionState,typedFrequencyShape,ABSTENTION_REASONS,V2_POLICY} from './v2-contract.mjs';
const equal=(a,b)=>a!==undefined&&b!==undefined&&canonicalJSON(a)===canonicalJSON(b);
const ratio=(correct,total)=>({correct,total,rate:total?correct/total:null});
function fields(value,path=[]){
  if(value&&typeof value==='object')return Object.entries(value).flatMap(([k,v])=>fields(v,[...path,k]));
  return [{path,value}];
}
const at=(object,path)=>path.reduce((v,k)=>v?.[k],object);
const authorityNames=new Set(['accepted','acceptance','reviewable','review_state','blocking_issues','blockers','next_due_date','assigned_person','target_import_status']);
function authorityPaths(value,path=[]){return value&&typeof value==='object'?Object.entries(value).flatMap(([k,v])=>[...(authorityNames.has(k)?[[...path,k].join('.')]:[]),...authorityPaths(v,[...path,k])]):[];}
export function validateLabels(labels){
  if(!Array.isArray(labels)||new Set(labels.map(l=>l.case_id)).size!==labels.length)throw Error('invalid_label_ids');
  for(const l of labels){
    if(typeof l.case_id!=='string'||!['propose','abstain'].includes(l.expected_decision))throw Error('invalid_label_decision');
    if(l.expected_decision==='propose'&&(!typedFrequencyShape(l.frequency)||!Array.isArray(l.acceptable_frequencies)||l.acceptable_frequencies.some(f=>!typedFrequencyShape(f))))throw Error('invalid_label_frequency');
    if(l.expected_decision==='abstain'&&(l.frequency!==null||!Array.isArray(l.acceptable_reasons)||!l.acceptable_reasons.length||l.acceptable_reasons.some(r=>!ABSTENTION_REASONS.includes(r))))throw Error('invalid_label_abstention');
  }
}
export function gradeV2(records,attempts,labels){
  validateLabels(labels);
  if(new Set(records.map(r=>r.source_record_id)).size!==records.length||labels.length!==records.length||labels.some(l=>!records.some(r=>r.source_record_id===l.case_id)))throw Error('label_case_set_mismatch');
  if(new Set(attempts.map(a=>a.case_id)).size!==attempts.length||attempts.some(a=>!records.some(r=>r.source_record_id===a.case_id)))throw Error('duplicate_or_unknown_attempt');
  const rows=records.map(record=>{
    const label=labels.find(l=>l.case_id===record.source_record_id),attempt=attempts.find(a=>a.case_id===record.source_record_id);
    const completed=attempt?.status==='complete'&&attempt.raw?.done===true&&attempt.raw.done_reason!=='length';
    let value=null,parsed=false;
    if(completed&&typeof attempt.raw?.message?.content==='string')try{value=parseV2JSON(attempt.raw.message.content);parsed=true;}catch{}
    const shape=parsed&&validateV2Shape(value),source=shape&&validateV2Evidence(value,record);
    const decision=shape&&value.decision===label.expected_decision;
    const frequency=shape&&label.expected_decision==='propose'&&value.decision==='propose'&&[label.frequency,...label.acceptable_frequencies].some(f=>equal(f,value.frequency));
    const keys=label.expected_decision==='propose'?fields(label.frequency):[];
    const fieldCorrect=shape&&value.decision==='propose'?keys.filter(f=>equal(at(value.frequency,f.path),f.value)).length:0;
    const reason=shape&&label.expected_decision==='abstain'&&value.decision==='abstain'&&label.acceptable_reasons.includes(value.reason);
    const authority=authorityPaths(value);
    return {case_id:record.source_record_id,attempt_status:attempt?.status??'not-attempted',completed,parsed,shape,source,decision,frequency,frequency_field_correct:fieldCorrect,frequency_field_total:keys.length,reason,
      unjustified_abstention:parsed&&value?.decision==='abstain'&&label.expected_decision==='propose',missed_abstention:parsed&&value?.decision==='propose'&&label.expected_decision==='abstain',unsafe_authority_fields:authority,
      structural_state:parsed?v2SuggestionState(value,record):'NO_USABLE_OUTPUT'};
  });
  const count=key=>rows.filter(r=>r[key]).length,n=rows.length,np=labels.filter(l=>l.expected_decision==='propose').length,na=n-np;
  return {phase:'development',semantic_labels:'independent author; never baseline vocabulary',backend_enrichment_scored:false,rows,metrics:{transport_completion:ratio(count('completed'),n),content_json:ratio(count('parsed'),n),shape:ratio(count('shape'),n),source_span:ratio(count('source'),n),decision:ratio(count('decision'),n),frequency:ratio(count('frequency'),np),frequency_fields:ratio(rows.reduce((s,r)=>s+r.frequency_field_correct,0),rows.reduce((s,r)=>s+r.frequency_field_total,0)),required_abstention_reason:ratio(count('reason'),na),unjustified_abstention:ratio(count('unjustified_abstention'),np),missed_abstention:ratio(count('missed_abstention'),na),unsafe_authority_field_count:rows.reduce((s,r)=>s+r.unsafe_authority_fields.length,0),structural_states:Object.fromEntries([...new Set(rows.map(r=>r.structural_state))].map(state=>[state,rows.filter(r=>r.structural_state===state).length]))},development_criterion_met:n===3&&count('completed')===3&&count('parsed')===3&&count('shape')===3&&count('source')===3&&count('decision')===3&&count('frequency')===3&&!rows.some(r=>r.unjustified_abstention||r.unsafe_authority_fields.length)};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  const frozen=verifyV2Freeze();
  const {loadPacket}=await import('../packet-core.mjs'),{readdirSync,writeFileSync}=await import('node:fs');
  const records=loadPacket().records.filter(r=>V2_POLICY.allowed_case_ids.includes(r.source_record_id));
  const directory=new URL('../artifacts/v2-development/batch-01/attempts/',import.meta.url);
  const attempts=readdirSync(directory).filter(n=>n.endsWith('.json')).map(n=>JSON.parse(readFileSync(new URL(n,directory),'utf8')));
  const source=JSON.parse(readFileSync(new URL('../artifacts/v2-development/input.json',import.meta.url),'utf8')),prompt=readFileSync(new URL('./v2-prompt.txt',import.meta.url),'utf8'),schema=JSON.parse(readFileSync(new URL('./v2-frequency-schema.json',import.meta.url),'utf8'));
  for(const attempt of attempts)verifyV2Attempt(attempt,source,frozen,prompt,schema);
  const labels=JSON.parse(readFileSync(new URL('./labels/original-development.json',import.meta.url),'utf8')).cases;
  writeFileSync(new URL('../artifacts/v2-development/batch-01/score.json',import.meta.url),JSON.stringify(gradeV2(records,attempts,labels),null,2)+'\n',{flag:'wx'});
}
