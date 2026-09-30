// Evaluator only. Never import this module from runtime or model-input builders.
import {readFileSync, writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve, relative} from 'node:path';
import {fileURLToPath} from 'node:url';

const ROOT=fileURLToPath(new URL('.',import.meta.url));
const PACKET='fixtures/original/maintenance-migration-fixtures-v1/';
export const LITERAL_FIELDS=Object.freeze(['organization','site','asset_namespace','asset_id','task_text','responsible_role','last_recorded_date']);
export const ISSUE_ALIASES=Object.freeze({
  unspecified_event_condition:'event_condition_unspecified',
  missing_asset_id:'asset_id_missing',
  unspecified_trigger_relation:'trigger_relation_unspecified',
  formula_like_task:'formula_like_task_cell',
  missing_frequency:'frequency_missing',
  missing_responsible_role:'responsible_role_missing',
});
export const POLICY=Object.freeze({
  version:'P09-EVALUATOR-1',literal_comparison:'Exact strings/null; no coercion or whitespace trimming',
  frequency_comparison:'Exact typed JSON; object key order ignored, array order retained (calendar then meter); no trigger aliases',
  blocker_comparison:'Sets after global ISSUE_ALIASES; duplicate original or aliased IDs invalidate issue schema',
  issue_aliases:ISSUE_ALIASES,
  unsupported_value_unit:'One non-null mismatched normalized top-level field, including extra fields; missing/null errors counted separately as mismatches',
  unsafe_acceptance:'Observed accepted state when oracle blockers, normalized mismatches, issue-schema errors, or unbound evidence exist; any acceptance is additionally unexpected without an explicit review workflow',
  scheduling_unknowns:'Descriptive only, illustrative and non-exhaustive; not an exact-match target or scheduling readiness certification',
  denominator:'All frozen cases retained including absent/invalid output; records and logical identities reported separately, by split and overall',
  workflow_tests:'Review receipts, authorization and export exactness require separate engineering tests; not inferred from extraction scores',
});
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const canonical=v=>v===undefined?'[undefined]':v===null||typeof v!=='object'?JSON.stringify(v):Array.isArray(v)?'['+v.map(canonical).join(',')+']':'{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+canonical(v[k])).join(',')+'}';
const same=(a,b)=>canonical(a)===canonical(b);
const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
function issueSet(values){
  const schema=Array.isArray(values)&&values.every(v=>typeof v==='string');
  const originals=schema?values:[];
  const mapped=originals.map(v=>ISSUE_ALIASES[v]??v);
  return {values:new Set(mapped),valid:schema&&new Set(originals).size===originals.length&&new Set(mapped).size===mapped.length};
}

/** Score the supplied raw observation; never substitute or repair it with baseline output. */
export function scoreCase(testCase, observation){
  const expected=testCase.expected,proposal=observation?.proposal;
  const present=object(proposal),fields=object(proposal?.normalized_fields)?proposal.normalized_fields:{};
  const expectedFields=Object.fromEntries([...LITERAL_FIELDS,'frequency','next_due_date','assigned_person','target_import_status'].map(k=>[k,expected[k]]));
  const literal=LITERAL_FIELDS.map(field=>({field,exact:same(fields[field],expected[field])}));
  const mismatches=Object.keys(expectedFields).filter(k=>!same(fields[k],expectedFields[k]));
  const extra=Object.keys(fields).filter(k=>!Object.hasOwn(expectedFields,k));
  const unsupported=[...mismatches,...extra].filter(k=>fields[k]!==null&&fields[k]!==undefined);
  const wanted=issueSet(expected.blocking_issues),actual=issueSet(proposal?.blocking_issues);
  if(!wanted.valid)throw new Error('Invalid frozen issue set');
  const hits=[...wanted.values].filter(v=>actual.values.has(v));
  const misses=[...wanted.values].filter(v=>!actual.values.has(v));
  const falsePositives=[...actual.values].filter(v=>!wanted.values.has(v));
  const accepted=proposal?.review_state==='accepted';
  const expectedReviewable=expected.reviewability==='reviewable';
  const unsafeReasons=[];
  if(wanted.values.size)unsafeReasons.push('oracle_hard_blockers');
  if(mismatches.length||extra.length)unsafeReasons.push('normalized_content_mismatch');
  if(!actual.valid)unsafeReasons.push('invalid_issue_schema');
  if(observation?.evidence_valid!==true)unsafeReasons.push('evidence_not_verified');
  return {case_id:testCase.case_id,split:testCase.split,logical_record_identity:observation?.logical_record_identity??null,
    output_present:present,attempt_status:observation?.attempt_status??(present?'available':'missing'),
    literal_fields:literal,literal_exact_count:literal.filter(x=>x.exact).length,literal_field_denominator:LITERAL_FIELDS.length,
    literal_record_exact:literal.every(x=>x.exact),typed_frequency_exact:same(fields.frequency,expected.frequency),
    blocking_issues:{schema_valid:actual.valid,expected_count:wanted.values.size,true_positive_count:hits.length,false_negative_count:misses.length,false_positive_count:falsePositives.length,missed:misses,false_positive:falsePositives,exact:actual.valid&&!misses.length&&!falsePositives.length},
    normalized_mismatch_fields:mismatches,extra_normalized_fields:extra,unsupported_normalized_fields:unsupported,unsupported_normalized_value_count:unsupported.length,
    reviewability_exact:typeof proposal?.reviewable==='boolean'&&proposal.reviewable===expectedReviewable,
    unsafe_reviewability:proposal?.reviewable===true&&!expectedReviewable,
    accepted,unexpected_automatic_acceptance:accepted,unsafe_acceptance:accepted&&unsafeReasons.length>0,
    unsafe_acceptance_reasons:accepted?unsafeReasons:[],
    invariants_exact:['next_due_date','assigned_person','target_import_status'].every(k=>same(fields[k],expected[k])),
    evidence_valid:observation?.evidence_valid===true,
    scheduling_unknowns:Array.isArray(proposal?.scheduling_unknowns)?proposal.scheduling_unknowns:null,
    scheduling_readiness_assessed:false};
}
function summarize(cases){
  const sum=f=>cases.reduce((n,c)=>n+f(c),0),count=f=>cases.filter(f).length;
  const issues={expected:sum(c=>c.blocking_issues.expected_count),true_positive:sum(c=>c.blocking_issues.true_positive_count),false_negative:sum(c=>c.blocking_issues.false_negative_count),false_positive:sum(c=>c.blocking_issues.false_positive_count)};
  return {record_denominator:cases.length,logical_row_denominator:new Set(cases.map(c=>canonical(c.logical_record_identity??{missing_case_id:c.case_id}))).size,
    outputs_present:count(c=>c.output_present),literal_field_denominator:sum(c=>c.literal_field_denominator),literal_field_exact:sum(c=>c.literal_exact_count),literal_record_exact:count(c=>c.literal_record_exact),typed_frequency_exact:count(c=>c.typed_frequency_exact),
    blocking_issues:{...issues,recall:issues.expected?issues.true_positive/issues.expected:null,exact_records:count(c=>c.blocking_issues.exact),invalid_schema_records:count(c=>!c.blocking_issues.schema_valid)},
    unsupported_normalized_value_count:sum(c=>c.unsupported_normalized_value_count),normalized_mismatch_field_count:sum(c=>c.normalized_mismatch_fields.length+c.extra_normalized_fields.length),
    reviewability_exact:count(c=>c.reviewability_exact),unsafe_reviewability:count(c=>c.unsafe_reviewability),unsafe_acceptance:count(c=>c.unsafe_acceptance),unexpected_automatic_acceptance:count(c=>c.unexpected_automatic_acceptance),invariants_exact:count(c=>c.invariants_exact),evidence_bound_records:count(c=>c.evidence_valid)};
}
export function evaluateObservations(gold,observations,identities={}){
  if(!Array.isArray(observations))throw new Error('Observations must be an array');
  const ids=observations.map(o=>o.case_id);
  if(new Set(ids).size!==ids.length)throw new Error('Duplicate observation IDs');
  const goldIds=gold.cases.map(c=>c.case_id);
  if(new Set(goldIds).size!==goldIds.length)throw new Error('Duplicate frozen case IDs');
  if(ids.some(id=>!goldIds.includes(id)))throw new Error('Unexpected observation IDs');
  const cases=gold.cases.map(c=>scoreCase(c,{...observations.find(o=>o.case_id===c.case_id),logical_record_identity:identities[c.case_id]??observations.find(o=>o.case_id===c.case_id)?.logical_record_identity}));
  return {policy:POLICY,scope:'Fixture-level conformance to author-written oracle; no independent maintenance-SME adjudication or generalization claim',summary:summarize(cases),by_split:Object.fromEntries([...new Set(cases.map(c=>c.split))].map(split=>[split,summarize(cases.filter(c=>c.split===split))])),cases};
}

/** Requires root's explicit frozen manifest; importing this module never evaluates the packet. */
export function verifyFreeze(manifest,root=ROOT){
  if(manifest?.experiment_frozen!==true||!object(manifest.sourceFileDigests))throw new Error('Explicit frozen experiment manifest required');
  const required=['packet-core.mjs','evaluate-packet.mjs','artifacts/case-split.json',PACKET+'source-manifest.json',PACKET+'public-output-contract.json',PACKET+'evaluation/frozen-gold-v1.json',PACKET+'source-export-01.tsv',PACKET+'source-export-02.tsv'];
  for(const name of required)if(!Object.hasOwn(manifest.sourceFileDigests,name))throw new Error('Freeze missing file: '+name);
  for(const [name,digest]of Object.entries(manifest.sourceFileDigests)){
    const path=resolve(root,name),rel=relative(root,path);if(rel.startsWith('..')||rel.includes(':'))throw new Error('Freeze path outside P09');
    if(sha(readFileSync(path))!==digest)throw new Error('Frozen file changed: '+name);
  }
}
async function main(){
  const args=process.argv.slice(2),at=args.indexOf('--freeze');
  if(!args.includes('--baseline')||at<0||!args[at+1])throw new Error('Usage after root freeze only: node evaluate-packet.mjs --baseline --freeze <manifest.json>');
  const freezeBytes=readFileSync(resolve(ROOT,args[at+1])),freeze=JSON.parse(freezeBytes);verifyFreeze(freeze);
  const goldBytes=readFileSync(resolve(ROOT,PACKET+'evaluation/frozen-gold-v1.json')),gold=JSON.parse(goldBytes);
  const {loadPacket,propose,validateCellEvidence}=await import('./packet-core.mjs');
  const packet=loadPacket(),identities={},observations=[];
  for(const c of gold.cases){
    const record=packet.records.find(r=>r.source_record_id===c.case_id);
    if(!record)throw new Error('Frozen capture missing');
    identities[c.case_id]=record.logical_record_identity;
    const source=record.source_ref;
    if(source.file!==c.source.file||source.tsv_line_1_based!==c.source.tsv_line_1_based||source.data_row_1_based!==c.source.data_row_1_based)throw new Error('Gold/source locator disagreement');
    try{const proposal=propose(record,packet.records);observations.push({case_id:c.case_id,proposal,evidence_valid:Array.isArray(proposal.evidence)&&proposal.evidence.length===record.cells.length&&new Set(proposal.evidence.map(e=>e.cell_column)).size===record.cells.length&&proposal.evidence.every(e=>validateCellEvidence(e,record)),attempt_status:'completed'});}
    catch(error){observations.push({case_id:c.case_id,proposal:null,attempt_status:'failed',error:String(error)});}
  }
  const result={kind:'observed CPU baseline; no model calls',experiment_freeze_sha256:sha(freezeBytes),gold_sha256:sha(goldBytes),...evaluateObservations(gold,observations,identities),observations};
  writeFileSync(resolve(ROOT,'artifacts/packet-baseline-evaluation.json'),JSON.stringify(result,null,2)+'\n',{flag:'wx'});
  console.log('Wrote immutable artifacts/packet-baseline-evaluation.json');
}
if(process.argv[1]===fileURLToPath(import.meta.url))await main();
