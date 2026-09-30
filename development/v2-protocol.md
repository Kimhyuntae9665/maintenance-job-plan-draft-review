# P09-V2-DEV-2 declared development protocol

This replaces the earlier inactive v2 proposal's semantic switch. V1 code, prompts, inputs, gold, outputs and metrics remain unchanged. V2 targets generalization to supported Korean/English paraphrases within a declared semantic target space; exact v1 vocabulary is not ground truth.

## Exact declared files

- Schema: `development/v2-frequency-schema.json` (generated from `V2_SCHEMA` in `development/v2-contract.mjs`).
- Prompt: `development/v2-prompt.txt`, supplied verbatim with the exact schema JSON appended for grounding.
- Runtime/policy: `V2_POLICY` in `development/v2-contract.mjs` and byte-bound `artifacts/v2-development/policy.json`; version `P09-V2-DEV-2`.
- Semantic grader: `development/v2-grade.mjs`, using independently authored labels, not `normalizeFrequency` or v1 proposal eligibility.
- Initial source-only input: `artifacts/v2-development/input.json`.
- Original packet-author development labels: `development/labels/original-development.json`, evaluator-only, excluded from prompts and UI.

The readiness commit and subsequent write-once freeze bind these files, input builder, runner, transport and originals by hash before any call. New challenge authors should use that exact commit, not earlier v2 proposals.

The optional read-only CPU desk is `development/v2-desk.mjs` (`npm run v2:desk`, port 5109). It serves only three admitted development sources and separately preserved outputs. It has no inference, acceptance, correction, export or import route. The default v1 desk is unchanged. `development/v2-runner.py --gpu-lease-authorized` is a distinct command requiring explicit new coordinator handover; its flag is not such a handover. The complete frozen file set is fixed in `development/v2-integrity.mjs` and the runner; incomplete digest sets reject. Scoring checks labels/source hashes and every attempt's freeze/request provenance before writing a score.

## Scope, inputs and runtime

Exactly the original development captures **PM001, PM002, PM010** are allowed for the initial batch. They come from the unchanged original TSV exports. No v1 evaluation capture is eligible. There is at most **one initial batch / three inference HTTP calls**, concurrency 1, no retries or demo inference. Every attempted request and raw response is archived write-once, including format rejection, timeout, incomplete output and invalid JSON. No inference before explicit sole-GPU handover.

Existing `qwen3:4b`, Ollama 0.17.7 and model digest `359d7dd4bcdab3d86b87d73ac27966f4dbb9f5efdfcc75d34a8764a09474fae7`; context 4096, output 640, timeout 60 seconds, temperature 0, seed 42, think false, stream false, truncate false, shift false. Reuse the existing shared-lock/timeout-barrier transport without changing v1. A separate v2 adapter preserves HTTP rejection status/body (up to 1 MiB, truncation explicitly marked) instead of silently substituting a schema. The two read-only runtime identity requests (version/tags, 5-second timeout) are separate from the maximum three inference requests; their durable preflight must verify version and model digest. Coordinator lease, in-flight process, lock and barrier are rechecked before dispatch. A failed runtime preflight consumes the one batch slot and leaves all three cases not-attempted. Format/union incompatibility is a preserved development failure; no silent schema fallback. C9 input is limited to 512 Unicode code points. Invalid/oversized input is an input failure, never an invented model abstention. All original file bytes remain immutable.

The prompt receives capture ID/fingerprint and the exact C9 quote, lexical byte span, immutable file/revision/row locator. It does not receive labels, baseline outputs, row blockers or any v1 evaluation answers. The model proposes frequency or explicit abstention only. Calendar intervals allow day/week/month/year; day-of-month rules, operating-hour meters, explicit whichever-first combinations and explicitly named events are separate types. Event text is the entire verbatim C9 quotation. No next-due computation, fractional intervals, inferred event/relation/basis or scheduling authorization is supported.

## Safety and semantic authority

Structure checks enforce required fields/types/allowlists and exact source/span safety. They never decide whether novel paraphrase semantics are correct. Structurally valid proposals appear as **STRUCTURALLY_VALID_REQUIRES_SEMANTIC_REVIEW**; valid abstentions appear as **ABSTENTION_REQUIRES_SEMANTIC_REVIEW**. Invalid structure/source binding stays distinct. Human semantic acceptance is not automated in this development path.

Backend enrichment is a separate artifact: literal identity/task/role copies, source conflict/access/missing-field checks and unscheduled/not_submitted invariants. No deterministic correction of frequency is attributed to the model. Unusable model outputs stay unusable; backend null fields are not scored as model abstention. No backend rule imports v1's frequency switch to veto paraphrases or establish semantic truth.

The isolated grader consumes independent labels only after outputs are preserved. Original three development labels derive only from the original packet author. Future challenge labels must be independently authored and frozen before prompting. They may list canonical frequencies plus explicit acceptable equivalents. V1's twelve exposed evaluation cases cannot be reused as fresh held-out evidence. A small old-vocabulary rule baseline may be compared on a future challenge, but its unsupported result is a method output, never a ground-truth judgment about that source.

## Declared metrics and failure policy

All requested cases remain denominators, including not-attempted after a batch stop. Raw model results are scored before backend enrichment/gating:

| Metric | Exact definition / denominator |
|---|---|
| Transport completion / content JSON | Completed `done:true` non-length response, and strict JSON parse; each / all N. |
| Shape valid | Required typed schema/checker contract; / all N. |
| Source/span valid | Exact capture/hash/C9 quote/start/end; / all N. |
| Decision exact | Raw propose/abstain equals independent label; / all N. |
| Frequency exact | Canonical typed JSON matches independent canonical frequency or listed full equivalent; / labeled-propose N. No numeric-string repair. |
| Frequency fields exact | Each primitive leaf at its canonical key/index path in the independent frequency, compared literally without coercion; sum / canonical leaf-field denominator. Arrays preserve calendar-then-meter order. Listed equivalent frequencies affect full-frequency metric only. |
| Required abstention / reason | Raw abstain and allowed labeled reason; / labeled-abstain N. Zero denominator reported null, not perfect accuracy. |
| Unjustified abstention | Raw abstain on labeled-propose case; count / labeled-propose N. |
| Missed abstention | Raw propose on labeled-abstain case; count / labeled-abstain N. |
| Unsafe authority fields | Named acceptance/reviewability/blocker/due/person/import fields at any nesting depth; count; never treated as backend authority. Other extra fields also fail shape. |
| Structural suggestion state | No usable output, invalid structure, invalid source binding, valid proposal requiring semantic review, valid abstention requiring semantic review; counts / all N. No semantic-correct UI state. |

JSON uses strict grammar and rejects duplicate members. Invalid JSON/shape or missing/incomplete output receives false/zero for applicable correctness metrics; raw evidence, errors and status remain visible. Missed/unjustified abstention counts inspect parseable raw decisions even if the remaining structure is malformed; those outputs still fail decision correctness. Source binding and semantic metrics remain separate; readiness requires both. No repairs, coercion, baseline substitution, output-driven label changes or automatic acceptance. Raw model and deterministic backend metrics are reported separately. Structural validity is not semantic accuracy, and fixture semantic accuracy is not maintenance authorization.

Initial **development readiness criterion**: three completed/parseable outputs, 3/3 shape and source bindings, 3/3 decisions and independently labeled frequencies, zero unjustified abstentions and zero authority fields. Failure is reported against that criterion; it does not authorize reruns. Meeting it permits discussing the next experiment, not running an evaluation or declaring production readiness. Later challenge thresholds are separately predeclared with the challenge before its calls.
