// CPU display policy only. Frozen model protocol and scoring are unchanged.
import {validateV2Shape} from '../development/v2-contract.mjs';
import {parseV2JSON} from '../development/v2-json.mjs';

export function reviewView(data,requestedId){
  if(data?.case?.source_record_id!==requestedId)throw Error('Response belongs to a different source capture');
  const raw=data.raw_model_content;
  const archived=typeof raw==='string'&&raw.length>0;
  const result=(state,message)=>({state,message,raw:archived?raw:'No archived model content for this attempt.',reviewable:false});
  if(data.attempt_status==='not-attempted')return result('NOT_ATTEMPTED','No model attempt is recorded.');
  if(data.attempt_status==='failed-attempt')return result('FAILED_ATTEMPT_NOT_REVIEWABLE','The attempt failed. Any archived content is diagnostic evidence only.');
  if(data.attempt_status!=='complete')return result('INCOMPLETE_OUTPUT_NOT_REVIEWABLE','The attempt did not complete. Archived content is not a reviewable suggestion.');
  let value;
  try{value=parseV2JSON(raw);}catch{return result('INVALID_JSON_NOT_REVIEWABLE','Completed transport has unusable JSON content. No semantic inspection candidate is available.');}
  if(!validateV2Shape(value))return result('INVALID_STRUCTURE_NOT_REVIEWABLE','The raw output fails the frozen typed schema. Backend enrichment does not repair it.');
  const c=data.case,e=c.evidence,b=data.backend;
  if(value.source_record_id!==c.source_record_id||value.source_fingerprint!==c.source_fingerprint||value.evidence.cell_id!==e.cell_id||value.evidence.quote!==e.quote||value.evidence.span.start!==e.span.start||value.evidence.span.end!==e.span.end||(value.frequency?.kind==='event_trigger'&&value.frequency.event!==e.quote)||b?.source_record_id!==c.source_record_id||b?.source_fingerprint!==c.source_fingerprint)return result('STALE_OR_MISMATCHED_SOURCE_NOT_REVIEWABLE','Archived output or backend evidence does not bind to this displayed source. Obtain a current suggestion and inspect it again.');
  const abstain=value.decision==='abstain';
  return {...result(abstain?'ABSTENTION_REQUIRES_SEMANTIC_REVIEW':'STRUCTURALLY_VALID_REQUIRES_SEMANTIC_REVIEW',abstain?'The source-bound abstention still requires a person to judge its reason.':'The typed suggestion binds to this source; a person must judge its meaning. Structural validity is not semantic correctness.'),reviewable:true,frequency:value.frequency};
}
