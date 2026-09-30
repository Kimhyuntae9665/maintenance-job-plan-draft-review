// Isolated post-run evaluator. Never imported by desk/input builder.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadPacket,sha256} from './packet-core.mjs';
import {verifyFreeze,evaluateObservations} from './evaluate-packet.mjs';
import {validateModelProposal} from './model-input.mjs';
const root=fileURLToPath(new URL('.',import.meta.url)),read=n=>readFileSync(new URL(n,import.meta.url));
const freezeBytes=read('artifacts/experiment-freeze.json'),freeze=JSON.parse(freezeBytes);verifyFreeze(freeze,root);
const goldBytes=read('fixtures/original/maintenance-migration-fixtures-v1/evaluation/frozen-gold-v1.json'),gold=JSON.parse(goldBytes),split=JSON.parse(read('artifacts/case-split.json')),packet=loadPacket();
const observations=[],gates=[],attempts=[],identities={};
for(const c of split.cases){
  const r=packet.records.find(r=>r.source_record_id===c.case_id);identities[c.case_id]=r.logical_record_identity;if(c.split!=='evaluation')continue;
  const path='artifacts/model-attempts/'+c.case_id+'.json';if(!existsSync(new URL(path,import.meta.url))){observations.push({case_id:c.case_id,proposal:null,attempt_status:'not_attempted'});gates.push({case_id:c.case_id,valid:false,errors:['NOT_ATTEMPTED']});continue;}
  const bytes=read(path),a=JSON.parse(bytes);attempts.push({case_id:c.case_id,status:a.status,httpRequestAttempted:a.httpRequestAttempted,sha256:sha256(bytes),elapsedMs:a.elapsedMs,done_reason:a.raw?.done_reason,eval_count:a.raw?.eval_count,prompt_eval_count:a.raw?.prompt_eval_count});
  let value=null,parse='not_complete';if(a.status==='complete'){try{value=JSON.parse(a.raw.message.content);parse='valid_json';}catch{parse='invalid_json';}}
  const mapping={organization:'C4',site:'C5',asset_namespace:'C6',asset_id:'C7',task_text:'C8',frequency:'C9',responsible_role:'C10',last_recorded_date:'C11'};
  const evidenceValid=Boolean(value&&value.source_record_id===r.source_record_id&&value.source_fingerprint===r.source_fingerprint&&value.frequency_quote===r.values.frequency_text&&Object.entries(mapping).every(([k,v])=>value.citations?.[k]===v));
  observations.push({case_id:c.case_id,proposal:value,evidence_valid:evidenceValid,attempt_status:a.status,content_parse:parse});
  gates.push({case_id:c.case_id,...(value?validateModelProposal(value,r,packet.records):{valid:false,errors:[parse.toUpperCase()]})});
}
const result={kind:'Raw frozen model evaluation before rule gate; no baseline replacement',experiment_freeze_sha256:sha256(freezeBytes),gold_sha256:sha256(goldBytes),http_calls:attempts.filter(a=>a.httpRequestAttempted).length,development_calls:0,retries:0,demo_calls:0,attempts,gate_summary:{passed:gates.filter(g=>g.valid).length,total:12},gates,...evaluateObservations(gold,observations,identities),observations};
writeFileSync(new URL('artifacts/packet-model-evaluation.json',import.meta.url),JSON.stringify(result,null,2)+'\n',{flag:'wx'});console.log(JSON.stringify({http_calls:result.http_calls,evaluation:result.by_split.evaluation,gate:result.gate_summary,attempts},null,2));
