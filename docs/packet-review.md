# P09 independent implementation review

This is an AI engineering review of the implementation, not maintenance-specialist adjudication, packet conformance scoring, or a model evaluation. The review and recheck used synthetic source records on local Node v24.19.0. No oracle was read during this implementation-review lane, no inference was requested, and no application files were edited by the reviewer. No permission denial occurred.

## Findings and recheck

1. **Historical acceptance resurrection — fixed and independently reproduced as fixed.** Previously, admit local revision B with monthly frequency, accept it, admit C with weekly frequency, then re-admit B/monthly. The deterministic source and proposal hashes returned to their old values, so the historical receipt became current and export succeeded without a fresh review. The proposal now binds a monotonically increasing `source_admission_generation`. The same B/C/B sequence leaves the old receipt historical and changes the proposal hash. Export returns 400 until a fresh explicit acceptance. A fresh acceptance permits exactly the selected synthetic capture.

2. **Export evidence and review timestamp — fixed and checked.** Earlier receipts lacked `reviewed_at`, and neither the receipt nor exported row included exact cell evidence. Both now contain evidence; the receipt contains an ISO timestamp and admission generation. The recheck validated every exported evidence entry against the source record and recomputed `normalized_content_sha256` from the normalized fields plus exported evidence. The hash matched. The export remains unscheduled and `not_submitted`.

3. **Return state — fixed, with a follow-up display inconsistency.** Previously returning a row only incremented proposal revision and displayed `unreviewed`. Returning now sets both row and proposal state to `returned` and makes historical receipts stale. However, explicitly accepting this returned, otherwise eligible proposal produces a row state of `accepted` and a current receipt while `proposal.review_state` remains `returned`. The current UI derives its main status from the latter, so the opened view can still say “RETURNED FOR CLARIFICATION.” Reported to root before any change. Give the current acceptance priority in the display, or update the state/hash/receipt consistently before recording acceptance.

4. **Null proposal and stale evidence UI — fixes present by source inspection.** Proposal-dependent controls are now disabled when no row is open. Opening a different proposal clears and collapses the old exact-cell detail. This addresses the earlier null-binding action hazard and old citation display under a newly opened row.

5. **Keyboard focus — general guards present; actual browser check delegated to root.** Actions now capture an originating element ID in addition to explicit grid selectors. Refresh also attempts restoration. Both check that focus generation is unchanged and focus is on the body before restoring, to avoid stealing focus after user navigation. This executor had no available Python/Playwright command, so no browser-level focus result is claimed here. Root is performing actual Chrome checks separately.

6. **Correction semantics — bounded by design.** The server accepts correction JSON only when it equals the source-supported deterministic normalized fields; arbitrary changes are rejected. This can restore an edited/model draft to those fields, but it is not a general correction engine. Suggested label: **“Restore or validate source-supported values.”** Suggested explanation: “Only values supported by these original cells and the declared grammar can be saved. Other changes require source clarification.”

## Synthetic reproduction

The following CPU-only harness exercises the original B/C/B sequence and its fixed behavior. It supplies its own record and does not load the fixture packet or evaluator. Run from P09 with Node using `--input-type=module` and this script on standard input. No files or network calls are needed.

```js
import assert from 'node:assert/strict';
import {parseTSVBytes, sha256, hashCanonical, validateCellEvidence} from './packet-core.mjs';
import {createPacketDesk} from './packet-server.mjs';

const columns = ['source_record_id','row_key','section_id','organization','site',
  'asset_namespace','asset_id','task_text','frequency_text','responsible_role','last_recorded_date'];
const monthly = '\uB9E4\uC6D4', weekly = '\uB9E4\uC8FC';
const bytes = Buffer.from(columns.join('\t') + '\r\n' +
  ['SYN-1','ROW-S','SEC','ORG-DEMO','PLANT-A','N','00017',
   'Inspect fictional text',monthly,'Reviewer',''].join('\t') + '\r\n');
const metadata = {file:'synthetic.tsv',encoding:'UTF-8',delimiter:'TAB',
  line_endings:'CRLF',quote_character:'"',double_quote_escape:true,contains_header:true,
  columns,sha256:sha256(bytes),data_row_count:1,source_system:'SYNTHETIC',
  logical_document_id:'SYN',source_revision:'A',sheet_name:'ROWS'};
const file = parseTSVBytes(bytes, metadata);
const desk = createPacketDesk({files:[file],records:file.records,manifest:{}});
async function call(path, body) {
  let status, data;
  await desk.handler({url:path,method:'POST',async *[Symbol.asyncIterator]() {
    yield Buffer.from(JSON.stringify(body));
  }}, {writeHead(value) { status=value; }, end(value) { data=JSON.parse(value); }});
  return {status,data};
}
const bind = s => ({expected_version:s.version,
  source_record_id:s.proposal.source_record_id,
  source_fingerprint:s.proposal.source_fingerprint,
  proposal_sha256:s.proposal.proposal_sha256,
  normalized_content_sha256:s.proposal.normalized_content_sha256});
const change = async (s,revision,value) => (await call('/api/source-change',
  {...bind(s),revision,column:'frequency_text',value})).data;

let s = await change(desk.snapshot(),'B',monthly);
s = (await call('/api/review',{...bind(s),inspected:true})).data;
const first = s.receipts[0];
s = await change(s,'C',weekly);
assert.equal(s.receipts[0].current,false);
s = await change(s,'B',monthly);
assert.equal(s.receipts[0].current,false);
assert.notEqual(s.proposal.proposal_sha256,first.proposal_sha256);
s = (await call('/api/select',{expected_version:s.version,source_record_ids:['SYN-1']})).data;
const exportRequest = s => ({expected_version:s.version,source_record_ids:s.selected,
  scope_sha256:s.export_preview.scope_sha256});
assert.equal((await call('/api/export',exportRequest(s))).status,400);
s = (await call('/api/review',{...bind(s),inspected:true})).data;
const exported = await call('/api/export',exportRequest(s));
assert.equal(exported.status,200);
s = exported.data;
assert.deepEqual(s.download.source_record_ids,['SYN-1']);
const row = s.download.normalization_rows[0];
assert.ok(row.review_receipt.reviewed_at);
assert.equal(row.evidence.length,columns.length);
assert.ok(row.evidence.every(e => validateCellEvidence(e,s.record)));
assert.equal(row.review_receipt.normalized_content_sha256,
  hashCanonical({normalized_fields:s.proposal.normalized_fields,evidence:row.evidence}));
s = (await call('/api/return',{...bind(s),reason:'Clarify synthetic source'})).data;
assert.equal(s.rows[0].review_state,'returned');
assert.equal(s.proposal.review_state,'returned');
assert.ok(s.receipts.every(r => !r.current));
s = (await call('/api/review',{...bind(s),inspected:true})).data;
console.log({row_state:s.rows[0].review_state,
  proposal_state:s.proposal.review_state,current_receipt:s.receipts.at(-1).current});
```

At recheck, all assertions passed. The final diagnostic was `{row_state:'accepted', proposal_state:'returned', current_receipt:true}`, which exposed finding 3's remaining display inconsistency.

### Accepted-status display follow-up

Root subsequently changed the opened proposal status to give a current matching receipt priority over `proposal.review_state`. Source inspection confirms it now displays `ACCEPTED NORMALIZATION` for that receipt, addressing finding 3's contradictory display. This follow-up is a code inspection, not a local browser check.

## Model-input and client boundary inspection

The public input builder loads source records and the split-only ID manifest. Its per-case payload contains source identity, source cell IDs/quotes/spans, and related same-logical-identity captures. It contains no expected labels, evaluator output, or precomputed normalized answer. The import of `propose` is used by the validation gate, not by `modelCase` to fill prompt answers.

Synthetic checks confirmed that a source-supported proposal passes the gate, while a forged source fingerprint, altered frequency quotation, `review_state:'accepted'`, and an invented assigned person are rejected. The gate compares normalized fields against backend source rules and checks exact citations and blocker sets. These are CPU boundary checks, not model correctness results. Raw model output must be evaluated before this gate or any fallback; a gated/replaced proposal must never be counted as the raw prediction.

The declared client configuration is qwen3:4b, 12 evaluation calls, zero development/retry/demo calls, context 4096, output 640, temperature 0, seed 42, concurrency 1, timeout 60 seconds, and `think`, `stream`, `truncate`, and `shift` false. This is inspected configuration, not evidence that calls occurred or that provider settings were honored.

The client requires an explicit lease authorization flag and an experiment-frozen manifest. It verifies hashes of the core, input builder, client, frozen model input, and split manifest before requests, checks the evaluation ID list, refuses an existing nonempty attempt archive, and creates attempt files exclusively. Request and raw response are archived. Exceptions stop further attempts; there is no retry branch. Model content is never executed.

Transport uses loopback only, an exclusive nonblocking shared lock, ownership/permission/symlink checks, and a timeout marker. If marker persistence fails, the process retains the lease instead of releasing it. These protections were inspected, not exercised against a runtime in this review. No GPU/model endpoint was contacted. Freeze/config readiness and explicit GPU handover remain coordinator responsibilities.

Scheduling unknowns are an illustrative non-exhaustive list; checking their JSON type is not a scheduling-readiness certification. Runtime ownership of source conflicts, permissions, acceptance, receipts, and export scope remains separate from optional model proposals.

## Authorized frozen CPU baseline

After root explicitly declared the application and experiment frozen, the isolated evaluator ran once using:

```text
node evaluate-packet.mjs --baseline --freeze artifacts/experiment-freeze.json
```

It verified the manifest's file hashes and wrote `artifacts/packet-baseline-evaluation.json` exclusively (`wx`). Gold was read only by this isolated evaluator. No output-driven application, prompt, evaluator, or gold changes were made. No model calls occurred.

| Measure | Development | Evaluation | Overall |
|---|---:|---:|---:|
| Capture records / logical rows | 3 / 3 | 12 / 11 | 15 / 14 |
| Literal fields exact | 21 / 21 | 84 / 84 | 105 / 105 |
| Typed frequencies exact | 3 / 3 | 12 / 12 | 15 / 15 |
| Blocking issues detected / expected | 0 / 0 | 8 / 8 | 8 / 8 |
| Blocker false positives / false negatives | 0 / 0 | 0 / 0 | 0 / 0 |
| Evidence-bound records | 3 / 3 | 12 / 12 | 15 / 15 |
| Unsupported normalized values | 0 | 0 | 0 |
| Unsafe reviewability / unsafe acceptance | 0 / 0 | 0 / 0 | 0 / 0 |

All outputs were present; reviewability and fixed draft invariants matched on all records. No automatic acceptance or failed case was observed. Development blocker recall is undefined because its expected-blocker denominator is zero. Workflow/export tests remain separate from these extraction metrics.

Freeze manifest SHA-256: `b73b8e2293c4b73e83cb83577e039e037671199cb13c594d4eb54c420dd6a4ca`.
Original gold SHA-256: `9b8011f677a742ce668091f1fb333263238a04d697c2559421b84f8411569cec`.

These are observed conformance results against the packet author's frozen expectations and documented grammar. They do not establish independent maintenance-domain correctness, scheduling readiness, target import validity, unseen-family generalization, or model benefit.

## Preserved model-batch artifact review

After the coordinator transferred the completed batch, this reviewer inspected the twelve preserved attempt files, `packet-model-evaluation.json`, the isolated model evaluator source, completion evidence, and stored-output browser-check record. No evaluator or inference command was rerun. The first saved report was left unchanged.

All twelve archived attempts have `status=complete`, `httpRequestAttempted=true`, and provider `done=true` with `done_reason=stop`. Each archived raw response text parses to the saved raw response object. Each report observation equals the raw parsed model proposal, confirming that the displayed raw-method results are not deterministic fallback replacements. Attempt-file hashes agree with the report; source-commit, freeze digest, input digest, and exact request case contents agree with the frozen input and manifest. Completion evidence records twelve requests, zero development/retry/demo calls, an exited process, a free shared lock, no timeout marker, and safe lease release. Those runtime observations come from the coordinator's saved evidence, not a fresh runtime probe by this reviewer.

The saved report's **evaluation split** contains twelve captures representing eleven logical rows. Its development entries are unattempted because the model policy specifies zero development calls; overall fifteen-record summaries must not be presented as a twelve-call model denominator.

| Raw model measure | Preserved evaluation result |
|---|---:|
| Outputs / capture denominator | 12 / 12 |
| Literal fields exact | 84 / 84 |
| Typed frequencies exact | 0 / 12 |
| Required blockers detected | 0 / 8 |
| Blocker false negatives / false positives | 8 / 0 |
| Unsupported normalized top-level fields | 12, all frequency |
| Unsafe reviewability declarations | 8 |
| Automatic acceptance / unsafe acceptance | 0 / 0 |
| Backend validation gate passes | 0 / 12 |

### Frequency-schema limitation and corrected output description

The frozen structured-output schema declares frequency only as `{"type":["object","null"]}`. It does not require or constrain the nested typed-frequency properties. This underspecification is a material method limitation. **The saved outputs are not twelve empty `{}` objects.** Direct inspection found nonempty, nonconforming objects: numeric counts encoded as strings, source-language strings in count fields, event objects with a `value` property instead of `event`, combined trigger arrays containing strings rather than typed trigger objects, and an unsupported-kind object. All raw blocker arrays are empty and all proposals declare `reviewable=true`, while retaining `review_state=unreviewed`.

The conclusion is that this particular frozen prompt/schema/model configuration failed the typed-frequency and blocker requirements on this narrow packet. The results do not establish generalized Qwen incapability. No schema, prompt, core rule, oracle, or scoring policy was tuned after observing these results, and no retry was run.

Model report SHA-256: `f5a3fec95ef6a49929a1d361925221eaffad24e7f20de2ac726a2da23a56a6ed`.

## Post-evaluation editor guard

The frozen experiment source is commit `3100f6cf6fa635bb12f54579f9271f92fdcb6eda`. Current `app.mjs` and `index.html` intentionally differ from that manifest after a CPU-only editor-safety change. The reviewed core, server, model-input builder, client, frozen model input, split manifest, evaluator, and public source files still match their frozen hashes. Replaying the complete frozen experiment requires its committed source rather than rerunning against the post-evaluation UI files.

The current UI compares parsed editor JSON canonically to the backend proposal's normalized fields before enabling acceptance. Copying stored model fields or manually editing clears the inspection checkbox. Invalid JSON or differing fields disables acceptance even if the checkbox is subsequently checked. Restoring rule-supported fields clears inspection again and records no acceptance; a fresh explicit inspection is required. The review request remains bound to backend source/proposal/content hashes. Copying a rejected model candidate does not replace that backend proposal.

A local DOM-stub CPU check exercised the actual `editorMatches`, controls, copy-model, restore-rule, and input handlers: a differing candidate could not enable acceptance; invalid JSON could not enable acceptance; restore left acceptance disabled until a fresh checkbox decision. It invoked no fetch, inference, or evaluator. This checks handler logic, not browser focus/layout behavior.

The coordinator's saved `stored-model-browser-checks.json` separately reports actual browser replay success for rejected-candidate blocking, unsupported correction rejection, explicit restore/validate/fresh inspection, consistent returned-to-accepted status, and source revision invalidation hiding stale model contents. This reviewer inspected that record but did not independently run Chrome. The earlier local browser-executor limitation still applies.
