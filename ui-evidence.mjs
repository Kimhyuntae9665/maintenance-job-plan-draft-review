// Display evidence only. This module grants no review/export authority.
const canonical=v=>v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
export function frequencySummary(f){
  if(!f)return 'No typed frequency proposal.';
  if(f.kind==='calendar_interval')return 'Every '+f.value+' calendar '+f.unit+(f.value===1?'':'s')+'. No due date is calculated.';
  if(f.kind==='calendar_rule')return 'Calendar rule: day '+f.day+' of each month. No due date is calculated.';
  if(f.kind==='meter_interval')return 'Every '+f.value+' operating-runtime hours. Meter baseline and due point remain unresolved.';
  if(f.kind==='combined')return (f.relation==='whichever_first'?'Explicit whichever-first: ':'Trigger relation is unspecified; clarification required: ')+f.triggers.map(frequencySummary).join(' / ');
  if(f.kind==='event_trigger')return f.event?'Event trigger: '+f.event+'. A role label grants no execution authority.':'Event condition is unspecified; clarification required.';
  return 'No supported typed frequency; inspect the raw value and validation evidence.';
}
export function validationEvidence(stored,proposal){
  const errors=stored?.validation?.errors;
  if(!Array.isArray(errors))return [{category:'Availability',field:'stored output',code:stored?.status??'UNKNOWN',explanation:'No completed validation evidence is available for this displayed source.'}];
  const rows=[];
  for(const code of errors){
    const entry=(category,field,explanation,expected=null,actual=null)=>rows.push({category,field,code,explanation,expected,actual});
    if(code==='UNSUPPORTED_NORMALIZED_FIELDS'){
      const before=rows.length;
      const actual=stored.candidate?.normalized_fields,expected=proposal?.normalized_fields;
      if(actual&&typeof actual==='object'&&!Array.isArray(actual)&&expected){for(const field of new Set([...Object.keys(expected),...Object.keys(actual)]))if(canonical(actual[field])!==canonical(expected[field]))entry('Declared grammar / literal mapping',field,'Differs from the source-supported explicit-rule proposal. This bounded check is not general semantic grading.',expected[field]??null,actual[field]??null);}
      else entry('Structure','normalized_fields','A normalized field object is required.',expected??null,actual??null);
      if(rows.length===before)entry('Declared grammar / literal mapping','normalized_fields','Backend rejected these normalized fields; no acceptance follows from this display.');
    }else if(code==='INVALID_CITATION_SCHEMA')entry('Structure','citations','Citation object must contain exactly the declared fields.');
    else if(code.startsWith('INVALID_CITATION_'))entry('Exact source binding',code.slice(17),'Citation does not identify the required source cell.');
    else if(code==='STALE_SOURCE'||code==='INVALID_FREQUENCY_QUOTE')entry('Exact source binding',code==='STALE_SOURCE'?'source identity/hash':'frequency_quote','Source identity, hash or exact quoted evidence does not match.');
    else if(code==='UNSUPPORTED_BLOCKERS')entry('Authoritative backend decision','blocking_issues','Model blockers differ from deterministic source/normalization blockers.',proposal?.blocking_issues??null,stored.candidate?.blocking_issues??null);
    else if(code==='INVALID_REVIEW_BOUNDARY')entry('Authority boundary','reviewable / review_state','Model reviewability cannot authorize acceptance; stored output must stay unreviewed.');
    else entry('Structure',code==='INVALID_UNKNOWNS'?'scheduling_unknowns':'schema','The declared response structure is invalid.');
  }
  return rows.length?rows:[{category:'Completed bounded validation',field:'all declared checks',code:'VALIDATED_UNREVIEWED',explanation:'No validation errors; explicit human inspection remains required. No acceptance or scheduling is implied.'}];
}
export function exportDisplay(e){return {label:e.source_reviews_current?'Export prepared/acknowledged · source/review bindings still current':'Historical export prepared/acknowledged · source/review bindings stale',selection:e.matches_current_selection?'Matches current export selection':'Different from current export selection',receipt:{acknowledgement_id:e.acknowledgement_id,exported_at:e.exported_at,snapshot_version:e.snapshot_version,row_count:e.row_count,source_record_ids:e.source_record_ids,filter_site:e.filter_site,scope_rows:e.scope_rows,draft_sha256:e.draft_sha256,scope_sha256:e.scope_sha256,target_import_receipt:null}};}
