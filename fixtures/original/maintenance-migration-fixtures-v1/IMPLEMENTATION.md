# Small implementation contract

Prepared September 30, 2026. Proposed portfolio behavior, not a reconstruction of a private Quant system.

## Outcome and screen

A coordinator imports the two TSV exports, sees a batch grid of raw cells and proposed typed fields, corrects or returns ambiguous rows with reasons, and exports only the currently reviewed normalization rows. Show one selected source row and its exact cells beside the editable proposal; keep batch selection distinct from the opened row.

Useful columns: source row, site/asset identity, raw frequency, normalized trigger, role, blockers, scheduling unknowns, review state. A row with a missing meter baseline can have a supported extracted interval while its next due date remains unknown. A same-identity conflict, blank required field, unsupported formula-like task or unspecified trigger relation blocks acceptance.

Backend acceptance and exports must independently validate the actual current proposal and source fingerprint. Case-specific expected labels live only in evaluation/frozen-gold-v1.json. Do not expose that file, the evaluation directory or case-specific evaluation results to model input or runtime retrieval.

## Minimal pipeline

1. Parse TSV with explicit dialect and size limits. Store original bytes/hash and cell values; do not execute cell formulas or follow embedded links. Exact cell citations compare the decoded TSV value under that declared parser and retain file/line/column locators. A decoded quotation containing a double quote need not be a literal raw-byte substring of the quoted/escaped TSV record; display that distinction clearly.
2. Join source-manifest identity to each row. Group by source system, logical document ID, source revision, sheet and row key. Different cell content for the same identity creates a conflict for every affected capture.
3. Preserve literal organization, site, namespace, asset ID, task, role and source date. Required empty values remain missing. The asset namespace/site are part of identity; 00017 and 17 are not numerically interchangeable.
4. Apply the bounded frequency grammar below. The deterministic result is the baseline. An optional local model proposes source-bound fields and is checked by the same validators; schema validity alone is not semantic correctness.
5. A reviewer accepts the exact normalized proposal or returns it with a reason. A reviewer correction is a separate derived record with provenance; it never rewrites source cells. Unresolved hard blockers cannot disappear through a generic approve button.
6. Export a JSON normalization draft containing exact accepted fields, source/cell references, hashes, rule/proposal versions, reviewer receipt and visible scheduling unknowns. It must state target_import_status=not_submitted and next_due_date=null.

## Deterministic grammar

Match complete trimmed expressions while retaining the raw string:

| Source expression | Supported normalization |
|---|---|
| 매월 1일 | calendar_rule, day_of_month=1 |
| 매월 | calendar_interval, value=1, unit=month |
| 3개월마다 | calendar_interval, value=3, unit=month |
| 매주 | calendar_interval, value=1, unit=week |
| 운전 500시간마다 | meter_interval, value=500, unit=hour, basis=operating_runtime |
| 운전 1000시간마다 | meter_interval, value=1000, unit=hour, basis=operating_runtime |
| 매월 또는 운전 500시간 중 먼저 도래한 때 | combined two triggers with explicit whichever_first |
| 매월, 운전 500시간 | two stated triggers, relation=null; clarification required |
| 필요 시 | event_trigger, event=null; clarification required |
| empty or unsupported | unknown; do not invent a schedule |

Do not calculate a next due date. last_recorded_date is a supplied date string, not a confirmed work-completion timestamp or declared schedule anchor. Unknown fields listed in the fixture are deliberate examples, not an exhaustive target-system readiness checklist.

## Acceptance gates

- All fifteen literal-field expectations match the source cells; no source ID, leading zero, site, role or date is invented.
- All fifteen frequency expectations and blocking issue sets match the separate frozen oracle; count misses and false positives independently.
- Monthly never becomes thirty days; operating hours never become elapsed wall-clock hours.
- PM003 preserves whichever-first; PM011 does not acquire a relation from a target default.
- PM004 keeps its three-month interval and January 31 source date without inventing April 30/May 1.
- PM008 does not inherit an asset across the section boundary. No merged-cell mapping is supplied.
- PM009A and PM009B both remain blocked; later capture time does not overwrite the earlier source revision.
- PM012 stays inert, with no URL request, formula evaluation, macro execution or active spreadsheet export.
- A role is never converted into a named assignee or authorization.
- A source/proposal/scope change invalidates the current acceptance. Receipt binding includes content hash, not only row ID. Old receipts remain historical.
- Partial export includes only selected, authorized, accepted, current rows. It retains each row's unknowns. Export creation is not an import acknowledgment.
- Model timeout, empty output, invalid quote or unsupported normalization leaves the deterministic review grid usable and cannot create a false ready state.

Use separate synthetic role tests if demonstrating site permissions. Demo roles are not production authentication. No state in this slice approves equipment use or maintenance execution.

## Enterprise integration boundary

IBM says master PM records are templates and do not themselves generate work orders; time/meter scheduling has additional conditions. Job-plan/task/labor scope may depend on organization and site. This normalized JSON therefore does not assert target import validity. A real adapter would need customer release/schema, object-structure, identity, authorization, idempotency and target acknowledgment contracts.

- https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=pm-master-preventive-maintenance-records
- https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=alerts-preventive-maintenance-next-due-dates
- https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=pms-defining-frequency-meter-based-master
- https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=overview-job-plans-work-orders
- https://www.ibm.com/docs/en/masv-and-l/maximo-manage/cd?topic=levels-applications-their-data-storage

Product docs were checked September 30, 2026. Continuous-delivery documentation is not proof of a customer's installed version. No target schema, connection or import has been tested.
