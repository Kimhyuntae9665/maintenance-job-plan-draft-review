// Versioned development only. No v1 frequency switch or evaluator/gold imports.
export const V2_VERSION='P09-V2-DEV-2';
const object=properties=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
const positiveInteger={type:'integer',minimum:1,maximum:Number.MAX_SAFE_INTEGER},offset={type:'integer',minimum:0,maximum:Number.MAX_SAFE_INTEGER};
const calendar=object({kind:{const:'calendar_interval'},value:positiveInteger,unit:{enum:['day','week','month','year']}});
const rule=object({kind:{const:'calendar_rule'},rule:{const:'day_of_month'},day:{type:'integer',minimum:1,maximum:31}});
const meter=object({kind:{const:'meter_interval'},value:positiveInteger,unit:{const:'hour'},basis:{const:'operating_runtime'}});
const event=object({kind:{const:'event_trigger'},event:{type:'string',minLength:1,maxLength:512}});
const combined=object({kind:{const:'combined'},relation:{const:'whichever_first'},triggers:{type:'array',items:[{oneOf:[calendar,rule]},meter],minItems:2,maxItems:2,additionalItems:false}});
const identity={source_record_id:{type:'string',minLength:1},source_fingerprint:{type:'string',pattern:'^[a-f0-9]{64}$'},evidence:object({cell_id:{const:'C9'},quote:{type:'string',maxLength:512},span:object({start:offset,end:offset})})};
export const ABSTENTION_REASONS=['missing_frequency','unsupported_semantics','unspecified_event','unspecified_relation','unspecified_meter_basis','unsupported_precision'];
const ref=name=>({$ref:'#/definitions/'+name});
const combination=object({kind:{const:'combined'},relation:{const:'whichever_first'},triggers:{type:'array',items:[{oneOf:[ref('calendar'),ref('rule')]},ref('meter')],minItems:2,maxItems:2,additionalItems:false}});
export const V2_SCHEMA={$schema:'http://json-schema.org/draft-07/schema#',title:V2_VERSION+' typed frequency proposal or abstention',definitions:{calendar,rule,meter,event,combined:combination,evidence:identity.evidence},oneOf:[object({...identity,evidence:ref('evidence'),decision:{const:'propose'},frequency:{oneOf:['calendar','rule','meter','combined','event'].map(ref)}}),object({...identity,evidence:ref('evidence'),decision:{const:'abstain'},frequency:{type:'null'},reason:{enum:ABSTENTION_REASONS}})]};
export const V2_POLICY=Object.freeze({version:V2_VERSION,phase:'development',model:'qwen3:4b',model_digest:'359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7',ollama_version:'0.17.7',allowed_case_ids:['PM001','PM002','PM010'],initial_batches:1,max_http_calls:3,retries:0,demo_inference:0,context:4096,output:640,timeout_seconds:60,concurrency:1,temperature:0,seed:42,think:false,stream:false,truncate:false,shift:false,max_frequency_codepoints:512,semantic_authority:'independent labels for grading; explicit human review for live suggestions',v1_evaluation_reuse:false});
export const hasExactKeys=(x,names)=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.keys(x).length===names.length&&names.every(k=>Object.hasOwn(x,k));
const positive=x=>Number.isSafeInteger(x)&&x>0,offsetValid=x=>Number.isSafeInteger(x)&&x>=0;
const length=x=>typeof x==='string'?Array.from(x).length:Infinity;
function calendarShape(f){return hasExactKeys(f,['kind','value','unit'])&&f.kind==='calendar_interval'&&positive(f.value)&&['day','week','month','year'].includes(f.unit)||hasExactKeys(f,['kind','rule','day'])&&f.kind==='calendar_rule'&&f.rule==='day_of_month'&&Number.isInteger(f.day)&&f.day>=1&&f.day<=31;}
function meterShape(f){return hasExactKeys(f,['kind','value','unit','basis'])&&f.kind==='meter_interval'&&positive(f.value)&&f.unit==='hour'&&f.basis==='operating_runtime';}
export function typedFrequencyShape(f){return calendarShape(f)||meterShape(f)||hasExactKeys(f,['kind','relation','triggers'])&&f.kind==='combined'&&f.relation==='whichever_first'&&Array.isArray(f.triggers)&&f.triggers.length===2&&calendarShape(f.triggers[0])&&meterShape(f.triggers[1])||hasExactKeys(f,['kind','event'])&&f.kind==='event_trigger'&&typeof f.event==='string'&&length(f.event)>0&&length(f.event)<=512;}
/** Specific shape checker; it does not judge whether the source means this frequency. */
export function validateV2Shape(value){
  if(!value||!['propose','abstain'].includes(value.decision))return false;
  if(!hasExactKeys(value,value.decision==='propose'?['source_record_id','source_fingerprint','evidence','decision','frequency']:['source_record_id','source_fingerprint','evidence','decision','frequency','reason']))return false;
  if(typeof value.source_record_id!=='string'||!value.source_record_id||typeof value.source_fingerprint!=='string'||!/^[a-f0-9]{64}$/.test(value.source_fingerprint)||!hasExactKeys(value.evidence,['cell_id','quote','span'])||value.evidence.cell_id!=='C9'||typeof value.evidence.quote!=='string'||length(value.evidence.quote)>512||!hasExactKeys(value.evidence.span,['start','end'])||!offsetValid(value.evidence.span.start)||!offsetValid(value.evidence.span.end)||value.evidence.span.end<value.evidence.span.start)return false;
  return value.decision==='propose'?typedFrequencyShape(value.frequency):value.frequency===null&&ABSTENTION_REASONS.includes(value.reason);
}
/** Exact immutable C9 quotation + lexical byte span only; never semantic approval. */
export function validateV2Evidence(value,record){
  const c=record.cells.find(c=>c.cell_column==='frequency_text');
  return Boolean(validateV2Shape(value)&&c&&value.source_record_id===record.source_record_id&&value.source_fingerprint===record.source_fingerprint&&value.evidence.quote===c.quote&&value.evidence.span.start===c.lexical_span.byte_start_0_based&&value.evidence.span.end===c.lexical_span.byte_end_exclusive&&(value.frequency?.kind!=='event_trigger'||value.frequency.event===c.quote));
}
export function v2SuggestionState(value,record){return !validateV2Shape(value)?'INVALID_STRUCTURE':!validateV2Evidence(value,record)?'INVALID_SOURCE_BINDING':value.decision==='abstain'?'ABSTENTION_REQUIRES_SEMANTIC_REVIEW':'STRUCTURALLY_VALID_REQUIRES_SEMANTIC_REVIEW';}
