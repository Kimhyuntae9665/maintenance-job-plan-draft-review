# Maintenance job-plan draft review

<img src="docs/architecture.png" alt="Immutable source cells feed bounded rule proposals, human normalization review and an explicitly selected JSON draft." width="390">

[Editable SVG](docs/architecture.svg) · [Original glyph provenance](docs/asset-provenance.md)

A native source-cell grid and field comparison for fictional maintenance-register normalization. Original strings, quoted TSV lexemes, cell byte spans and source hashes sit beside typed calendar, meter and event interpretations. The result is a reviewed JSON draft: every row remains **unscheduled** and **not_submitted**. No Maximo credentials, import, work order or maintenance authorization exists here.

![Actual CPU packet source-cell inventory](artifacts/media/packet-desktop.png)

[Actual CPU-rendered review video](artifacts/media/packet-review.mp4) · [390px source grid](artifacts/media/packet-mobile-390.png) · [Actual stale-review flow](artifacts/media/packet-stale-review.png) · [CPU browser checks](artifacts/packet-browser-checks.json) · [Independent engineering review](docs/packet-review.md)

The original packet was consumer-locally materialized from Library, checked against its 19,602-byte archive SHA256, and frozen unchanged before prompting. Its 15 captures represent 14 logical rows, with three development and twelve evaluation captures. Packet-author consistency checks are not application accuracy. [Integrity receipt](artifacts/packet-integrity.json) · [Original source contract](fixtures/original/maintenance-migration-fixtures-v1/SOURCE-CONTRACT.md) · [Isolated evaluator contract](evaluate-packet.mjs).

**Actual frozen comparison: 12 Qwen calls completed, zero development/retry/demo inference. All 12 model proposals failed rule validation.** Context 4096, output 640, timeout 60 seconds, concurrency 1, temperature 0 and seed 42 were fixed before scoring. Gold stayed outside runtime/model inputs; raw outputs were scored before gating and preserved without repairs or fallback replacement.

| Evaluation measure (12 captures / 11 logical rows) | Explicit rules | Raw Qwen |
|---|---:|---:|
| Exact literal fields | 84/84 | 84/84 |
| Exact typed frequencies | 12/12 | 0/12 |
| Expected blockers detected | 8/8 | 0/8 |
| Blocker false positives / misses | 0 / 0 | 0 / 8 |
| Unsupported normalized top-level values | 0 | 12 |
| Unsafe reviewability declarations | 0 | 8 |
| Automatic / unsafe acceptance | 0 / 0 | 0 / 0 |

All model transports completed with `done:true` / `stop`, and all twelve contents parsed as JSON. Exact citation/source binding passed in every output; that did not make their semantics correct. Frequencies were nonempty malformed objects, including string/raw-valued intervals, omitted relations and wrong trigger structures. The frozen output schema did not require nested typed-frequency properties, a material limitation of this method. These results do not establish Qwen's general capability under another configuration. No prompt, grammar, schema or oracle was tuned after seeing the outputs.

[Baseline results](artifacts/packet-baseline-evaluation.json) · [Raw model results](artifacts/packet-model-evaluation.json) · [All preserved attempts](artifacts/model-attempts) · [Frozen method and limits](docs/experiment.md) · [Completion / safe runtime release](artifacts/runtime-completion.json). The separate development baseline scored 21/21 literal fields and 3/3 frequencies; no development model calls ran. The prototype supports this packet's narrow grammar, not general maintenance extraction, scheduling readiness or measured business savings.

88 Node engineering tests and four Linux CPU transport mocks pass, including nine isolated v2 development-contract checks. Actual Chrome checks cover keyboard/focus, delayed/failing requests, stale two-client decisions, repeated receipts, exact export scope after filtering, stored-model rejection and 390px readability. [Stored-output replay checks](artifacts/stored-model-browser-checks.json) and [video provenance](artifacts/packet-video-provenance.json) distinguish CPU media and automated fictional inspections from inference and human domain adjudication.

[Proposed v2 development-only repair](docs/v2-development-plan.md) adds required typed frequency fields, explicit abstention and separate shape/evidence/grammar checks. It is not activated in this runtime and has zero model calls. V1 remains unchanged; its twelve exposed cases cannot become fresh held-out evidence. Any future evaluation needs a genuinely separate frozen test packet.

## Run

Node 20 or later, no npm dependencies:

```sh
npm test
python3 -m unittest test_model_client.py  # Linux CPU mocks; no network/model
npm start
```

Open `http://127.0.0.1:5089`. The default desk loads only the two allowlisted TSV source exports and public source manifest/contract. `packet-server.mjs` is the current runtime. `source.mjs`, `normalize.mjs` and `server.mjs` preserve the earlier TSV/JSON scaffold as separate engineering regressions; they are not the packet baseline. [Historical scaffold stage](docs/scaffold-stage.md).

State and fictional reviewer scope are in memory. The synthetic planner has ORG-DEMO / PLANT-A and PLANT-B scope; this is a demonstration policy, not enterprise authentication. Refreshing the process discards local decisions. Binding hashes detect changed content, not identity fraud, and are not digital signatures.

## Normalization and review boundaries

The packet parser validates original UTF-8 bytes and CRLF, manifest hashes, declared headers, quoting and doubled quote escapes. Decoded evidence quotations remain distinct from original lexical spans. Multiline fields, XLSX, merged cells, workbook number formats, macros and formulas are outside this slice. The earlier JSON source utility rejects duplicate keys and numeric identity values. Source links/formulas remain inert strings; the application never follows or executes them.

Logical identity combines source system, logical document, revision, sheet and row key. Payload comparison includes section, organization, site, namespace, asset string, task, frequency, role and recorded date. Capture-local IDs and capture time give no precedence. Same-identity/same-revision differing content is a conflict, including both supplied PM009 captures. `00017` and `17`, and their sites, never collapse. Blank cells are not forward-filled.

The published bounded Korean grammar distinguishes calendar intervals, calendar rules, operating-hour meter intervals and explicit whichever-first combinations. Monthly is not 30 days; meter runtime is not elapsed clock time. Comma-separated triggers have no inferred relation; `필요 시` needs an event. Jan 31 plus three months gets no calculated due date or silently selected month-end convention. `last_recorded_date` is preserved literally, not admitted as a completion/scheduling anchor. [Exact rules and completeness limits](docs/packet-rules.md).

Hard missing identity, task, role or frequency, same-version conflict, unspecified event/relation, formula-like task and unsupported frequency block acceptance. A supported 500-operating-hour normalization can be accepted while meter baseline/current reading/due point remain unknown. Scheduling unknowns are illustrative, not a complete maintenance-readiness checklist. Role labels identify no person and grant no authorization.

Human acceptance binds source file/revision/cells, normalized-content hash, exact proposal hash/revision, source admission generation and fictional reviewer scope. Re-admitting identical historical bytes cannot revive a superseded receipt. Return records a reason; correction can only restore or validate source-supported fields. Unsupported edits require source clarification. Old clicks get 409 and fresh inspection; no automatic re-acceptance. [Preserved development findings](artifacts/packet-development-failures.json).

Opening a row is separate from selecting export rows. The export preview names **every selected capture, logical identity and count**, with current receipt/proposal hashes. Filtering removes hidden rows from selection. Any selected unaccepted, stale or unavailable row blocks the entire export; none is silently omitted. Exported rows carry exact cell evidence and review timestamps. They define no CMMS create/update/delete/full-snapshot semantics; missing rows imply no deletion. A download acknowledgment is local evidence, never a target-system import receipt.

Reads and mutations serialize in each client, server snapshot versions reject stale actions, and exact proposal/scope guards bind review/export. Original-source navigation is keyboard focusable. Rebuilt controls restore focus only when no later explicit choice occurred. Native tables scroll at 390px with meaningful text at least 14px; the viewport does not shrink to fit the grid.

## Optional stored model proposal

`model-input.mjs` builds cell IDs, exact source quotes/spans, logical metadata and related conflicting captures. It supplies no baseline answers, implementation case notes, evaluator gold or scores. `model_client.py` uses only the existing local Qwen runtime after explicit coordinator handover. A shared file lock serializes requests; an HTTP timeout creates a persistent barrier and stops the batch until completion is independently verified. No generated code runs.

The UI can inspect stored outputs without inference. Model proposals stay separate from explicit-rule fields and acceptance. Exact-source/citation/schema/rule checks reject unsupported proposals; a stale source removes the stored candidate and current citation contents. Copying a stored proposal into the editor is inspection only; differing/invalid unsaved fields disable acceptance until explicit restore/validation and fresh inspection. Raw model quality is scored before gating, and workflow correctness is tested separately. No claim of maintenance-SME adjudication, production readiness or general extraction accuracy follows from the small synthetic comparison.

## Business precedent and rights

IBM's named [Quant Service case](https://www.ibm.com/fr-fr/case-studies/quant-service) describes an MVP converting spreadsheet attachments into structured job-plan data with human validation/correction. Its reported 65% reduction in manual work and 30% faster implementation have no disclosed controlled denominator. These are vendor claims about that MVP, not measured P09 benefits or evidence of a full rollout.

The requested [master PM documentation](https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=pm-master-preventive-maintenance-records) and [job-plan/work-order documentation](https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=overview-job-plans-work-orders) returned HTTP 403 in this research pass; their current text was not verified here. The supplied implementation contract independently distinguishes master templates, actual orders and job-plan site scopes. P09 ends before all target-system operations.

Original code, glyphs and scaffold examples are MIT. The original fictional packet is CC0 with its unchanged [license](fixtures/original/maintenance-migration-fixtures-v1/LICENSE.txt) and [provenance](fixtures/original/maintenance-migration-fixtures-v1/PROVENANCE.json). It is not Quant Service data or IBM private architecture. Deployment needs real identity/access controls, durable tamper-evident audit, domain review, target schemas and import validation; this local prototype provides none of those production services.
