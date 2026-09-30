// Development proposal only. Not imported by runtime, v1 input/client or evaluator.
import {normalizeFrequency,canonicalJSON} from '../packet-core.mjs';
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const integer={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER};
const calendar=object({kind:{const:'calendar_interval'},value:integer,unit:{enum:['month','week']}});
const rule=object({kind:{const:'calendar_rule'},rule:{const:'day_of_month'},day:{type:'integer',minimum:1,maximum:31}});
const meter=object({kind:{const:'meter_interval'},value:integer,unit:{const:'hour'},basis:{const:'operating_runtime'}});
const combined=object({kind:{const:'combined'},relation:{const:'whichever_first'},triggers:{type:'array',items:[{oneOf:[calendar,rule]},meter],minItems:2,maxItems:2,additionalItems:false}});
const identity={source_record_id:{type:'string',minLength:1},source_fingerprint:{type:'string',minLength:1},evidence:object({cell_id:{const:'C9'},quote:{type:'string'}})};
export const ABSTENTION_REASONS=['missing_frequency','unsupported_frequency','unspecified_event','unspecified_relation'];
export const V2_SCHEMA={$schema:'http://json-schema.org/draft-07/schema#',title:'P09 development-only frequency proposal or abstention',oneOf:[object({...identity,decision:{const:'propose'},frequency:{oneOf:[calendar,rule,meter,combined]}}),object({...identity,decision:{const:'abstain'},frequency:{type:'null'},reason:{enum:ABSTENTION_REASONS}})]};
const keys=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===names.length&&names.every(k=>Object.hasOwn(x,k));
const positive=x=>Number.isSafeInteger(x)&&x>0;
function calendarShape(f){return keys(f,['kind','value','unit'])&&f.kind==='calendar_interval'&&positive(f.value)&&['month','week'].includes(f.unit)||keys(f,['kind','rule','day'])&&f.kind==='calendar_rule'&&f.rule==='day_of_month'&&Number.isInteger(f.day)&&f.day>=1&&f.day<=31;}
function meterShape(f){return keys(f,['kind','value','unit','basis'])&&f.kind==='meter_interval'&&positive(f.value)&&f.unit==='hour'&&f.basis==='operating_runtime';}
export function typedFrequencyShape(f){return calendarShape(f)||meterShape(f)||keys(f,['kind','relation','triggers'])&&f.kind==='combined'&&f.relation==='whichever_first'&&Array.isArray(f.triggers)&&f.triggers.length===2&&calendarShape(f.triggers[0])&&meterShape(f.triggers[1]);}
/** Bounded checker for this declared schema, not a general JSON Schema validator. */
export function validateV2Shape(value){
  if(!value||!['propose','abstain'].includes(value.decision))return false;
  if(!keys(value,value.decision==='propose'?['source_record_id','source_fingerprint','evidence','decision','frequency']:['source_record_id','source_fingerprint','evidence','decision','frequency','reason']))return false;
  if(typeof value.source_record_id!=='string'||!value.source_record_id||typeof value.source_fingerprint!=='string'||!value.source_fingerprint||!keys(value.evidence,['cell_id','quote'])||value.evidence.cell_id!=='C9'||typeof value.evidence.quote!=='string')return false;
  return value.decision==='propose'?typedFrequencyShape(value.frequency):value.frequency===null&&ABSTENTION_REASONS.includes(value.reason);
}
export function validateV2Evidence(value,record){return validateV2Shape(value)&&value.source_record_id===record.source_record_id&&value.source_fingerprint===record.source_fingerprint&&value.evidence.quote===record.values.frequency_text;}
/** Exact declared grammar only; this never establishes row eligibility or human acceptance. */
export function validateV2Meaning(value,record){
  if(!validateV2Evidence(value,record))return false;
  const raw=record.values.frequency_text,frequency=normalizeFrequency(raw);
  const reason=!raw.trim()?'missing_frequency':frequency===null?'unsupported_frequency':frequency.kind==='event_trigger'&&frequency.event===null?'unspecified_event':frequency.kind==='combined'&&frequency.relation===null?'unspecified_relation':null;
  return value.decision==='abstain'?value.reason===reason:reason===null&&canonicalJSON(value.frequency)===canonicalJSON(frequency);
}
