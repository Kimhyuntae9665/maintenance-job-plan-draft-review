# Historical inactive v2 proposal

This earlier design is superseded by [P09-V2-DEV-2](../development/v2-protocol.md), which separates structural/source-span safety from independently labeled semantic grading. The historical grammar gate described below is not used in the current v2 development path.

**Status: CPU proposal/checks only; no v2 model calls or evaluation.** V1's twelve attempts, prompt/schema, input, original gold and reports remain unchanged. The original evaluation cases are now exposed and must never be presented as a fresh held-out set. A genuinely separate future test packet and frozen experiment are needed before any new evaluation claim.

V1 admitted underspecified frequency objects; its actual outputs were nonempty malformed objects, not all empty objects. The proposed repair is explicit required typed properties and a separate bounded abstention state, rather than relying on prompt wording alone. [Ollama's primary structured-output guide](https://docs.ollama.com/capabilities/structured-outputs) documents schema submission and subsequent response validation. It does not establish this proposed union's exact runtime compatibility or semantic accuracy; neither has been model-tested here.

The isolated [v2 contract draft](../development/v2-contract.mjs) declares:

- Positive safe-integer calendar month/week intervals, explicit day-of-month rules, and operating-hour meter intervals with fixed unit/basis.
- Exact two-element typed calendar-then-meter combinations with explicit `whichever_first`.
- Required source capture ID/fingerprint and exact C9 quote; extra fields, invented acceptance or import authority are rejected.
- Explicit `abstain` with null frequency and a bounded missing/unsupported frequency, unspecified event or unspecified relation reason. An unspecified event stays a clarification rather than becoming an invented condition.

The checker is specific to that declared contract, not a general JSON Schema implementation. It remains outside runtime, v1 client/input and evaluator imports. Nine synthetic CPU checks cover accepted shapes, required fields, string-versus-integer values, empty/malformed objects, invalid relation/trigger arrays, abstention, tampered evidence and agreement with the declared source grammar. They are schema/guard checks, not model extraction results or independent domain review.

If separately authorized, use only the original **development** captures for a small development run, with the unchanged source manifest supplying their IDs. Predeclare at most three serialized calls, no automatic retries, and retain raw failures. Include the explicit schema in both format and prompt and check output completeness, schema validity, exact source evidence and agreement with declared grammar separately. Runtime grammar support for the union/tuple must be tested during that development phase; an unsupported format is a recorded development failure, not silently repaired evaluation output. Resource limits and any smaller task formulation must be frozen anew before calls.

The suggested smaller model task proposes frequency or abstention. Literal identity/task/role copying and conflict/missing-field detection remain deterministic. Consequently its future metrics are a different method; do not claim an apples-to-apples blocker-prediction improvement over v1. A supported operating-hour interval can be proposed while meter baseline/due point remains unknown; scheduling unknowns alone do not require frequency abstention.

Semantic validation remains separate from shape. Integer 30 and unit month could be structurally valid yet contradict the exact source; `validateV2Meaning` checks agreement with the unchanged bounded grammar and rejects it. Its supported interpretation never establishes row eligibility or human acceptance. Abstention text is not evidence that a row is safe or complete. Source conflicts, identity, revision, scope, proposal and reviewer decisions remain deterministic guards. No schema or model output schedules a row, assigns a person, authorizes maintenance or produces a target-system receipt.

Any later test set must be disjoint from the twelve v1 evaluation captures, freeze source/contract/gold before prompting, preserve its own provenance and expose development tuning separately. No GPU lease is held for this proposal.
