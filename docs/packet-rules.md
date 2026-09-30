# Bounded packet core

The CPU core produces source-bound normalization proposals. It does not make reviewer decisions, calculate maintenance schedules, assign people, submit imports or authorize maintenance. `reviewable` means eligibility for limited normalization review; every new proposal remains `unreviewed`.

The immutable original fictional packet is CC0-1.0. Runtime reads only `source-manifest.json`, `public-output-contract.json`, and TSV exports explicitly listed and allowed by the manifest. The evaluation directory, gold and result artifacts are excluded from this core and its engineering tests. No URLs or formulas are executed.

## API and versions

| Export | Contract |
|---|---|
| `loadPacket(directory?)` | Synchronous load of the public manifest/contract and declared TSVs; returns frozen `{manifest, contract, files, records}`. |
| `parseTSVBytes(bytes, metadata, manifest?)` | Strict UTF-8 byte parser using the declared dialect; returns a frozen file and records. |
| `propose(record, allRecords?)` | Typed baseline, hard blockers, scheduling unknowns, exact evidence and content/proposal hashes. Supply the full admitted record set to detect cross-capture conflicts. |
| `normalizeFrequency(raw)` | Complete trimmed expression match; unsupported/missing expression returns `null`. Raw source strings remain unchanged. |
| `conflictRecords(record, allRecords)` | All captures sharing identity when comparison-column payloads disagree; otherwise an empty array. |
| `validateCellEvidence(cell, record)` | Exact canonical comparison against the parsed cell, including decoded quote, source hash, scope, locators and byte span. |
| `canonicalJSON`, `hashCanonical`, `sha256` | Sorted-object-key JSON serialization, SHA-256 over its UTF-8 bytes, and raw-byte SHA-256. Array order is retained; JSON scalar/string identity is retained. |

`RULE_VERSION = P09-BOUNDED-KO-1`; `CANONICALIZATION_VERSION = P09-CANONICAL-JSON-1`. Runtime rule changes require a new version and fresh review receipts. JSON values are the supported hash input domain.

## Parser and evidence

Declared TSVs use UTF-8, tabs, CRLF record delimiters, a header, standard quoted fields and doubled double quotes. Tabs within quoted cells are decoded correctly. Fields spanning physical lines, malformed quotes, lone LF/CR record endings, invalid UTF-8, duplicate/incorrect columns, wrong widths/counts and source-hash mismatches fail closed. A final record may end at EOF without a final CRLF; no embedded physical newline is permitted. The parser limits each file to 1 MiB, 10,000 data rows, 64 columns and 64 KiB per cell; packet loading admits at most 16 exports.

`file.sha256` hashes immutable original bytes, independently of decoded text. `file.raw_bytes` supplies a copy on each access. Cells retain decoded `raw_cell_text` and `quote`, original `raw_tsv_lexeme`, a zero-based byte start/exclusive end span, file/hash, source revision, sheet/row, physical line, data-row and column name/index. Decoded quotes can differ from the escaped raw TSV lexeme. Parsed objects are deeply frozen.

## Identity and conflicts

Logical identity follows the manifest: source system, logical document ID, source revision, sheet name and row key. Compare only `content_comparison_columns` as exact decoded strings. Capture-local `source_record_id` is a locator and cannot establish payload equality or supersession. Same-identity differing payloads block every capture, including a later capture; a capture timestamp supplies no precedence. Different declared revisions remain separate identities, with no automatic cross-revision supersession.

Organization, site, namespace, asset ID, role, task and date remain literal strings. Leading zero IDs stay distinct from numeric-looking alternatives. Blank required fields remain missing; there is no section, merged-cell or preceding-row inheritance.

## Complete frequency grammar

| Complete trimmed expression | Typed result |
|---|---|
| 매월 1일 | `calendar_rule`, `day_of_month`, day 1 |
| 매월 | `calendar_interval`, 1 month |
| 3개월마다 | `calendar_interval`, 3 months |
| 매주 | `calendar_interval`, 1 week |
| 운전 500시간마다 | `meter_interval`, 500 hours, `operating_runtime` |
| 운전 1000시간마다 | `meter_interval`, 1000 hours, `operating_runtime` |
| 매월 또는 운전 500시간 중 먼저 도래한 때 | Calendar/meter `combined`, `whichever_first` |
| 매월, 운전 500시간 | Calendar/meter `combined`, relation `null`; hard blocker |
| 필요 시 | `event_trigger`, event `null`; hard blocker |
| Blank/other expression | `null`; missing/unsupported frequency blocker |

There is no substring matching, calendar-month-to-day conversion, operating-hour-to-wall-clock conversion, inferred relation or case-ID-specific normalization.

## Eligibility, unknowns and hashes

Hard blockers include missing logical identity, required organization/site/asset namespace/asset/task/frequency/role, same-identity content conflicts, unsupported frequency, unspecified event/relation, and task strings beginning with `=`, `+`, `-` or `@` after leading whitespace. Formula-like strings remain inert exact text.

Scheduling unknowns are separate. A supported meter interval can be reviewable while its baseline/current reading/due point are unknown. A three-month interval with January 31 source date can be reviewable without choosing an anchor or month-end convention. Listed unknowns are illustrative, not an exhaustive scheduling or target readiness checklist. Every proposal keeps `next_due_date=null`, `assigned_person=null`, `target_import_status=not_submitted`.

`source_fingerprint` binds source reference, logical identity and cells. `normalized_content_sha256` binds exact normalized fields plus evidence. `proposal_sha256` binds the complete proposal before its own hash is added, including source, versions, blockers, unknowns and review state. A source or proposal mutation requires a new review; the server owns reviewer/scope/receipt binding and export validation.

## Engineering validation and limits

Run `node --test p09/test/packet-core.test.mjs`. Tests cover source hashes, byte spans/escaping, malformed inputs/bounds, immutability, literal IDs, identity/content conflicts, complete typed grammar, blockers versus scheduling unknowns, evidence tampering and complete hash binding. Source-only execution computes 15 capture proposals: 7 eligible for review and 8 blocked, with zero accepted proposals. This is an executed engineering eligibility count, not evaluator accuracy, human approval or model performance.

The core handles this bounded TSV dialect and documented grammar. It does not validate XLSX, formulas, merged cells, real maintenance correctness, customer target schemas, authentication, import acknowledgment or real business savings. No evaluator/oracle comparison, inference, GPU access or external integration was run in this lane.
