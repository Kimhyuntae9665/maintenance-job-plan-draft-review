import {hash,canonical,REQUIRED} from './source.mjs';
const integer=text=>Number.isSafeInteger(Number(text))&&Number(text)>0?Number(text):null;
export function normalizeFrequency(original){
  if(typeof original!=='string')throw new Error('Frequency must be a string');
  const text=original.trim().toLowerCase();const unresolved=[];let trigger=null,rule='UNSUPPORTED_OR_MISSING';
  const result=()=>({trigger,normalization_rule:rule,original,unresolved});
  if(!text){unresolved.push('frequency');return result();}
  if(text==='monthly'||text==='매월'){trigger={kind:'calendar_interval',count:1,unit:'month',anchor:null};rule='EXPLICIT_MONTHLY_CALENDAR';return result();}
  if(text==='필요 시'||text==='as needed'){trigger={kind:'event_trigger',event:null};rule='UNSPECIFIED_EVENT';unresolved.push('trigger.event');return result();}
  const combination=/^(.+?)\s+or\s+(.+?),?\s+whichever(?:\s+comes)?\s+first$/.exec(text);
  if(combination){const a=normalizeFrequency(combination[1]),b=normalizeFrequency(combination[2]);
    if(a.trigger&&b.trigger&&!a.unresolved.length&&!b.unresolved.length){trigger={kind:'whichever_first',explicit:true,triggers:[a.trigger,b.trigger]};rule='EXPLICIT_WHICHEVER_FIRST';return result();}
    unresolved.push('trigger.components');return result();
  }
  const calendar=/^(?:every\s+)?(\d+)\s+(months?|days?|weeks?)(?:\s+from\s+(.+))?$/.exec(text);
  if(calendar&&integer(calendar[1])){const unit=calendar[2].replace(/s$/,'');trigger={kind:'calendar_interval',count:integer(calendar[1]),unit,anchor:calendar[3]??null};rule='EXPLICIT_CALENDAR_INTERVAL';
    if(calendar[3]){trigger.month_end_convention=null;unresolved.push('trigger.anchor_interpretation');if(unit==='month')unresolved.push('trigger.month_end_convention');}return result();}
  const meter=/^(?:every\s+)?(\d+)\s+operating\s+hours?$/.exec(text);
  if(meter&&integer(meter[1])){trigger={kind:'meter_interval',count:integer(meter[1]),unit:'operating_hour',meter:'operating_hours'};rule='EXPLICIT_OPERATING_HOUR_METER';return result();}
  const calendarRule=/^(?:the\s+)?first\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+of\s+(?:each|every)\s+month$/.exec(text);
  if(calendarRule){trigger={kind:'calendar_rule',period:'month',ordinal:1,weekday:calendarRule[1]};rule='EXPLICIT_ORDINAL_WEEKDAY';return result();}
  unresolved.push('trigger.interpretation');return result();
}
export function propose(source,row,conflicts=[]){
  if(row.section_break)throw new Error('Section break is not a planning row');
  const fields=Object.fromEntries(REQUIRED.map(name=>[name,{value:row.cells[name]?.value??null,source_cells:row.cells[name]?[row.cells[name]]:[],normalization_rule:row.cells[name]?'EXACT_STRING_COPY':'MISSING_CELL'}]));
  const unresolved=REQUIRED.filter(name=>typeof fields[name].value!=='string'||!fields[name].value.trim());
  const frequency=normalizeFrequency(fields.frequency.value??'');
  unresolved.push(...frequency.unresolved);
  const conflict=conflicts.filter(c=>c.rows.some(r=>r.source_id===source.source_id&&r.file_hash===source.file_hash&&r.row_locator===row.locator));
  const basis={source_id:source.source_id,file_hash:source.file_hash,namespace:source.namespace,source_revision:source.source_revision,row_locator:row.locator,fields,trigger:frequency.trigger,normalization_rule:frequency.normalization_rule,unresolved:[...new Set(unresolved)],conflicts:conflict,method:'explicit-rule-baseline-v0',status:conflict.length?'CONFLICT':unresolved.length?'NEEDS_CLARIFICATION':'PROPOSED_DRAFT'};
  return {...basis,proposal_fingerprint:hash(basis)};
}
export function checkProposal(current,displayed){return !!displayed&&canonical(current)===canonical(displayed);}
export function reviewDraft(proposal){
  if(proposal.conflicts.length)throw new Error('Conflicting source rows need resolution before draft review');
  const draft={draft_only:true,not_target_import:true,not_maintenance_authorization:true,namespace:proposal.namespace,asset:{equipment_id:proposal.fields.equipment_id.value,organization:proposal.fields.organization.value,site:proposal.fields.site.value},task_text:proposal.fields.task_text.value,responsible_role:proposal.fields.responsible_role.value,role_is_not_person_or_authorization:true,trigger:proposal.trigger,unresolved:proposal.unresolved,status:proposal.unresolved.length?'REVIEWED_WITH_UNRESOLVED_FIELDS':'REVIEWED_DRAFT',source:{source_id:proposal.source_id,file_hash:proposal.file_hash,source_revision:proposal.source_revision,row_locator:proposal.row_locator},proposal_fingerprint:proposal.proposal_fingerprint};
  return {...draft,draft_fingerprint:hash(draft)};
}
