// Deterministic source enrichment only. No semantic parser, gold or frequency repair.
import {conflictRecords,hashCanonical} from '../packet-core.mjs';
import {v2SuggestionState} from './v2-contract.mjs';
export function enrichV2(record,records,value){
  const blockers=[],present=x=>typeof x==='string'&&x.trim().length>0;
  for(const [key,v]of Object.entries(record.logical_record_identity))if(!present(v))blockers.push('missing_'+key);
  for(const key of ['organization','site','asset_namespace','asset_id','task_text','frequency_text','responsible_role'])if(!present(record.values[key]))blockers.push('missing_'+key);
  if(/^[=+\-@]/.test(record.values.task_text.trim()))blockers.push('formula_like_task');
  if(conflictRecords(record,records).length)blockers.push('same_identity_content_conflict');
  const literal_fields=Object.fromEntries(['organization','site','asset_namespace','asset_id','task_text','responsible_role','last_recorded_date'].map(k=>[k,present(record.values[k])?record.values[k]:null]));
  return {kind:'backend_enrichment_not_model_output',source_record_id:record.source_record_id,source_fingerprint:record.source_fingerprint,raw_proposal_fingerprint:value?hashCanonical(value):null,literal_fields,authoritative_source_blockers:blockers,
    suggestion_state:value?v2SuggestionState(value,record):'NO_STORED_OUTPUT',semantic_review:'required; no automated semantic approval',human_acceptance:'not_collected_in_development_desk',schedule_status:'unscheduled',next_due_date:null,assigned_person:null,target_import_status:'not_submitted'};
}
