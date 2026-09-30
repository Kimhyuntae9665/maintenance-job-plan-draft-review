# Independent review of the proposed v2 development contract

> **Historical / superseded review.** This page records an earlier development proposal, including its old grammar-bound meaning checker. It does not describe the activated contract. See the [current frozen v2 protocol](../development/v2-protocol.md), [actual development results and limitations](v2-development-results.md), and [current CPU inspection UI](ui-maintenance.md). The historical findings below remain unchanged as an audit record.

**Status: proposed, not activated. CPU development checks only. Runtime compatibility of the union/tuple schema is untested. No new model results.**

Reviewed `development/v2-contract.mjs`, `test/v2-development.test.mjs`, and `docs/v2-development-plan.md`. This review did not read the oracle, score original evaluation cases, contact a model API, obtain a GPU lease, or change v1 implementation or artifacts. The reviewer owns this report only.

## Outcome

No consequential blocker found for retaining this as an isolated development proposal. It is not ready to claim runtime compatibility, extraction improvement, or domain correctness. Future activation still requires the explicitly authorized development experiment described in the plan and a separate frozen test set before any new evaluation claim.

`node --test test/v2-development.test.mjs` passed **9/9 synthetic tests** locally on Node v24.19.0. Additional unsaved CPU checks exercised all four abstention reasons, rejected mismatched reasons, and rejected extra acceptance, next-due-date, and submitted-import fields. No packet records were loaded by those checks. Root-level runtime/client/evaluator source inspection found no import of the v2 contract.

## Shape and schema agreement

The draft-07 schema and bounded JavaScript checker agree on the inspected JSON contract:

- Required capture ID, source fingerprint, exact C9 evidence quotation, and a distinct `propose` or `abstain` decision.
- Positive safe-integer month/week intervals and operating-hour meter intervals, bounded above by `Number.MAX_SAFE_INTEGER`; bounded integer day-of-month rules; fixed meter unit and basis.
- A two-element, calendar-then-meter tuple with explicit `whichever_first`; reversed or string-valued triggers fail.
- An abstention branch with null frequency and a bounded reason; unsupported extra fields fail at the outer object, evidence object, and frequency objects.

This is code inspection plus synthetic testing of the bounded checker, not certification by a general JSON Schema validator. The schema's `oneOf` branches and draft-07 tuple form (`items` array plus `additionalItems:false`) still need compatibility testing against the actual structured-output runtime. Such a test would be a recorded development attempt, not a reason to reinterpret or replace v1 results.

## Meaning, evidence, and abstention

The added `validateV2Meaning` first validates shape and exact capture/fingerprint/quotation, then compares the proposed frequency to the explicit public grammar in `packet-core.mjs`. This closes the earlier gap where exact evidence alone could accompany a structurally valid but wrong frequency. A calendar value of 30 with a monthly source is shape-valid and meaning-invalid in the synthetic regression.

Abstention reasons are derived independently from source meaning: missing text, unsupported text, unspecified event, or unspecified combined-trigger relation. A correct reason passes and a mismatched reason fails. A supported operating-hour interval cannot be labeled unsupported merely because meter baseline, current reading, due point, or other scheduling inputs are unknown. Those are separate scheduling concerns, not failed frequency extraction.

The schema deliberately describes more structurally possible values than the current narrow grammar recognizes. Passing shape is therefore insufficient; callers must apply the meaning checker before treating a candidate as source-supported. The checker establishes agreement with this declared grammar only, not independent maintenance expertise or schedule readiness.

## Authority and method boundaries

The proposal has no acceptance, reviewability, assignee, scheduling, or target-import authority. Extra authority fields are rejected. Source identity conflicts, permissions, missing non-frequency fields, review eligibility, reviewer decisions, receipts, and export scope remain backend responsibilities. A valid frequency for a conflicted source row must never bypass those controls.

This is a smaller frequency-or-abstention task than v1's literal-field, frequency, blocker, and reviewability prediction task. A future score cannot be presented as an apples-to-apples blocker-prediction improvement. Report shape, evidence, semantic agreement, abstention correctness, and completeness separately, preserving raw failures before backend gates.

The twelve v1 evaluation captures are already exposed. The plan correctly disallows relabeling a rerun of them as a fresh held-out evaluation. Any future claim needs a genuinely separate test packet and a new frozen source/contract/oracle/configuration, with any development tuning disclosed. The original development captures may support a separately authorized bounded development run; none occurred during this review.

## Safe-integer finding resolved

The earlier nonblocking observation about unbounded integer magnitudes is resolved. Independent source inspection confirms the shared interval schema now sets `maximum:Number.MAX_SAFE_INTEGER`, and the bounded checker uses `Number.isSafeInteger`. The synthetic invalid-shape regression includes `Number.MAX_SAFE_INTEGER+1`. All **9/9 synthetic tests passed again** after this change. The schema and checker now agree on the safe-integer upper bound for calendar and meter interval counts; no runtime activation or model compatibility claim follows from this CPU check.

No new model capability, business benefit, runtime union support, scheduling validity, or target-system readiness is established by these CPU checks.
