# Source and normalization contract

This packet supports a maintenance-data coordinator reviewing fictional spreadsheet rows. The authorized output is a source-bound normalization draft. It is not a work order, a maintenance action, a schedule or a CMMS import receipt.

## Input and source evidence

The two UTF-8 TSV files contain 15 capture records for 14 logical rows. Parse with the manifest's tab delimiter, double-quote escaping and CRLF record convention. Store immutable input bytes and their SHA-256. Retain decoded cell text, column name/index and 1-based physical line/data-row locators. No field in these fixtures spans physical lines. A decoded cell quote can differ from its escaped byte representation; cite the decoded cell and preserve the original bytes.

Organization, site, asset namespace and asset ID remain literal strings. A blank cell is missing, not permission to inherit a value from a preceding section. No merged-cell ranges are supplied. Neither numeric coercion nor a matching role name establishes identity. Source dates are literal source data, not declared completion timestamps or schedule anchors.

Logical row identity is source system, logical document ID, source revision, sheet name and row key. The capture-local source_record_id is a locator. It is deliberately excluded from payload equality. Compare the manifest's content_comparison_columns: different payloads under one identity/revision block all captures. Later capture time does not resolve the conflict. Cross-revision supersession requires a separately declared rule.

## Typed normalization

Keep calendar rules, calendar intervals, meter intervals and event triggers separate. Calendar months are not fixed day counts; operating hours are not elapsed time. A combined trigger may carry whichever_first only when stated. An absent relation or event condition stays null with a clarification issue. Unsupported expressions stay unknown. Preserve raw task and role text; a role is not a person assignment or evidence of authority.

Frequency extraction may be supported while scheduling is unresolved. For example, a three-month interval and a source date do not establish month-end treatment or a valid schedule anchor. scheduling_unknowns is an illustrative non-exhaustive set of known missing inputs, never a complete readiness checklist. Every proposal and export keeps next_due_date=null, assigned_person=null and target_import_status=not_submitted.

## Readiness and review

reviewable means the limited normalization proposal has no declared hard blockers and can be reviewed. It does not mean accepted. accepted requires an explicit reviewer decision bound to the exact source, proposal, evidence, rule version and scope. A correction is a derived record; source cells remain immutable. A conflict, missing required field, unresolved trigger relation/event condition or unsupported formula-like task cannot be approved through a generic bypass.

A receipt binds the source file hash and exact normalized content hash, not merely a row ID. Changing source, proposal, evidence, normalization version or applicable scope makes the current receipt stale. Keep historical receipts. A JSON export contains only selected, currently accepted rows and all their scheduling unknowns. Export creation creates no target acknowledgment.

## Inert source content

Do not evaluate formulas, run macros or follow cell URLs. The formula-like task cell is source data and blocks acceptance. A later spreadsheet export would require its own formula-injection escaping policy while preserving separate raw evidence. This packet tests TSV parsing only; it does not test an XLSX parser, hidden rows/sheets, merged cells, cached values, Excel date serials, display formats or external links.

## Model and evaluator separation

Runtime may receive admitted source cells, their source metadata and the public output contract. Keep evaluation/frozen-gold-v1.json and evaluation results out of prompts, retrieval indexes, caches and runtime tools. Backend code owns source identity, conflicts, access checks, blocking status, receipts and target status. A model can propose supported fields; it cannot authorize review or manufacture readiness. The deterministic source grammar must remain usable when generation fails or is disabled.
