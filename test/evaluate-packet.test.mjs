import test from 'node:test';
import assert from 'node:assert/strict';
import {scoreCase,evaluateObservations,verifyFreeze,LITERAL_FIELDS} from '../evaluate-packet.mjs';

// Synthetic evaluator mechanics only. No packet/gold loading or baseline execution.
const fixture=()=>({case_id:'synthetic-A',split:'evaluation',expected:{organization:'O',site:'S',asset_namespace:'N',asset_id:'00017',task_text:'Task',responsible_role:'Role',last_recorded_date:null,frequency:{kind:'calendar_interval',value:1,unit:'month'},next_due_date:null,assigned_person:null,target_import_status:'not_submitted',blocking_issues:[],scheduling_unknowns:[],reviewability:'reviewable'}});
function observation(c=fixture()){
  const {blocking_issues,scheduling_unknowns,reviewability,...fields}=c.expected;
  return {case_id:c.case_id,logical_record_identity:{row_key:'SYN-A'},evidence_valid:true,proposal:{normalized_fields:structuredClone(fields),blocking_issues:[...blocking_issues],scheduling_unknowns:[...scheduling_unknowns],reviewable:reviewability==='reviewable',review_state:'unreviewed'}};
}
test('Evaluator exact synthetic observation has separate perfect field/frequency/issue results',()=>{
  const c=fixture(),r=scoreCase(c,observation(c));assert.equal(r.literal_exact_count,LITERAL_FIELDS.length);assert.equal(r.typed_frequency_exact,true);assert.equal(r.blocking_issues.exact,true);assert.equal(r.unsupported_normalized_value_count,0);assert.equal(r.accepted,false);
});
test('Leading zero, string type and boundary whitespace remain exact',()=>{
  for(const value of ['17',17,'00017 ']){const o=observation();o.proposal.normalized_fields.asset_id=value;const r=scoreCase(fixture(),o);assert.equal(r.literal_record_exact,false);assert.equal(r.unsupported_normalized_value_count,1);}
});
test('Frequency object keys ignore order while combined trigger order stays exact',()=>{
  const c=fixture(),o=observation(c);o.proposal.normalized_fields.frequency={unit:'month',value:1,kind:'calendar_interval'};assert.equal(scoreCase(c,o).typed_frequency_exact,true);
  c.expected.frequency={kind:'combined',relation:'whichever_first',triggers:[{kind:'calendar_interval',value:1,unit:'month'},{kind:'meter_interval',value:50,unit:'hour',basis:'operating_runtime'}]};const combined=observation(c);combined.proposal.normalized_fields.frequency.triggers.reverse();assert.equal(scoreCase(c,combined).typed_frequency_exact,false);
});
test('Global issue aliases compare as sets; duplicate aliases are invalid',()=>{
  const c=fixture();c.expected.blocking_issues=['asset_id_missing'];c.expected.reviewability='needs_clarification';const o=observation(c);o.proposal.blocking_issues=['missing_asset_id'];assert.equal(scoreCase(c,o).blocking_issues.exact,true);o.proposal.blocking_issues.push('asset_id_missing');assert.equal(scoreCase(c,o).blocking_issues.schema_valid,false);
});
test('Blocker misses and false positives are independent counts',()=>{
  const c=fixture();c.expected.blocking_issues=['asset_id_missing','event_condition_unspecified'];const o=observation(c);o.proposal.blocking_issues=['missing_asset_id','invented'];const r=scoreCase(c,o);assert.equal(r.blocking_issues.true_positive_count,1);assert.equal(r.blocking_issues.false_negative_count,1);assert.equal(r.blocking_issues.false_positive_count,1);
});
test('Missing output retains denominators and is not repaired by a fallback',()=>{
  const c=fixture(),r=evaluateObservations({cases:[c]},[],{[c.case_id]:{row_key:'A'}});assert.equal(r.summary.record_denominator,1);assert.equal(r.summary.literal_field_denominator,7);assert.equal(r.summary.outputs_present,0);assert.equal(r.summary.typed_frequency_exact,0);
});
test('Unsupported non-null invention differs from omission; extra fields count',()=>{
  const o=observation();o.proposal.normalized_fields.next_due_date='2030-01-01';o.proposal.normalized_fields.new_field='invented';delete o.proposal.normalized_fields.asset_id;const r=scoreCase(fixture(),o);assert.equal(r.unsupported_normalized_value_count,2);assert.ok(r.normalized_mismatch_fields.includes('asset_id'));
});
test('Unsafe readiness and acceptance are reported separately',()=>{
  const c=fixture();c.expected.blocking_issues=['asset_id_missing'];c.expected.reviewability='needs_clarification';const o=observation(c);o.proposal.reviewable=true;assert.equal(scoreCase(c,o).unsafe_reviewability,true);assert.equal(scoreCase(c,o).unsafe_acceptance,false);o.proposal.review_state='accepted';const r=scoreCase(c,o);assert.equal(r.unsafe_acceptance,true);assert.equal(r.unexpected_automatic_acceptance,true);
});
test('Accepted unverified evidence is unsafe even with correct field values',()=>{
  const o=observation();o.evidence_valid=false;o.proposal.review_state='accepted';assert.ok(scoreCase(fixture(),o).unsafe_acceptance_reasons.includes('evidence_not_verified'));
});
test('Scheduling unknowns are descriptive and do not become a readiness score',()=>{
  const o=observation();o.proposal.scheduling_unknowns=['extra_illustrative_unknown'];const r=scoreCase(fixture(),o);assert.equal(r.literal_record_exact,true);assert.equal(r.reviewability_exact,true);assert.equal(r.scheduling_readiness_assessed,false);
});
test('Capture and logical denominators remain separate by split',()=>{
  const a=fixture(),b={...fixture(),case_id:'synthetic-B'},d={...fixture(),case_id:'synthetic-D',split:'development'};const result=evaluateObservations({cases:[a,b,d]},[observation(a),observation(b),observation(d)],{[a.case_id]:{row_key:'same'},[b.case_id]:{row_key:'same'},[d.case_id]:{row_key:'different'}});assert.equal(result.summary.record_denominator,3);assert.equal(result.summary.logical_row_denominator,2);assert.equal(result.by_split.evaluation.record_denominator,2);assert.equal(result.by_split.evaluation.logical_row_denominator,1);assert.equal(result.by_split.development.record_denominator,1);
});
test('Duplicate and unexpected observations fail rather than altering denominators',()=>{
  const c=fixture();assert.throws(()=>evaluateObservations({cases:[c]},[observation(),observation()]),/Duplicate/);assert.throws(()=>evaluateObservations({cases:[c]},[{case_id:'other'}]),/Unexpected/);
});
test('Freeze gate rejects missing authorization before any file reads',()=>{
  assert.throws(()=>verifyFreeze({}),/Explicit frozen/);assert.throws(()=>verifyFreeze({experiment_frozen:true,sourceFileDigests:{}}),/Freeze missing file/);
});
