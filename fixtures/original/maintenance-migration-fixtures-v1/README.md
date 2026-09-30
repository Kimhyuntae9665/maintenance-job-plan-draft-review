# Maintenance spreadsheet normalization fixtures v1

A small original, fictional dataset for a portfolio workbench. The business user is a maintenance-data coordinator reviewing spreadsheet exports before a possible later CMMS migration. All task text concerns records and document references. These rows are not equipment-operation or physical-maintenance instructions.

## Source reference

IBM's named Quant Service case describes an MVP that converts preventive-maintenance Excel attachments into structured Maximo job-plan data with human validation and correction. Its reported savings have no disclosed controlled-study denominator and are not benchmarks for this dataset or a local model. The page is undated; captured September 30, 2026.

https://www.ibm.com/fr-fr/case-studies/quant-service

This fixture is independently authored. It does not contain Quant spreadsheets, IBM product data, customer identities or copied vendor images/text.

## Files

- source-export-01.tsv: fourteen fictional records
- source-export-02.tsv: one later capture with conflicting content for the same logical row and declared revision
- source-manifest.json: source identity, parsing, scope and hash receipts
- public-output-contract.json: proposed output fields and normalization boundaries; not a Maximo schema
- evaluation/frozen-gold-v1.json: fifteen author-written expected records, three development and twelve evaluation; keep outside model input and indexes
- SOURCE-CONTRACT.md: source boundaries, literal identity, readiness and review-receipt rules
- PROVENANCE.json: authorship, source roles and retrieval limitations
- evaluation/README.md: oracle isolation and scoring interpretation
- evaluation/validation-report.json: packet integrity checks only, not model/application results
- IMPLEMENTATION.md: workflow, deterministic rules and acceptance gates
- LICENSE.txt: original fixtures/labels license
- bundle-manifest.json: file sizes and SHA-256 hashes, generated after validation

There are fifteen source records and fourteen logical row keys. The two ROW-09 captures conflict; capture time does not establish a newer source revision. Seven records are reviewable under the deliberately limited normalization contract. Eight records have a blocking clarification or conflict. These are expected fixture counts, not executed model or application results.

The input is UTF-8 TSV with a header, CRLF records and standard double-quote escaping. TSV is a spreadsheet exchange format; it does not test an XLSX reader, formulas/cached values, merged cells, hidden sheets or number formats. Use a real TSV parser rather than splitting lines/cells naively. Preserve IDs such as 00017 as strings.

## Evaluation limits

Gold was written before model experiments. It is original controlled data, not independent maintenance-expert adjudication, a public Quant benchmark or evidence of real business time saved. No model was run to create or tune the expected labels. Report deterministic checks, model extraction and review/export state tests separately. Keep development and evaluation denominators separate. Do not read the gold into model prompts, retrieval or runtime search.

The result is a reviewed normalization draft with source evidence and unresolved scheduling fields. It does not schedule work, certify a maintenance strategy, validate a Maximo object structure, submit an import or establish equipment safety. No host scan, real CMMS connection or external write is included.

## Rights

Original synthetic rows, expected labels and this packet's original documentation: CC0-1.0, https://creativecommons.org/publicdomain/zero/1.0/

Linked IBM case study/product documentation retains its own rights and is cited only. IBM, Maximo and Quant names identify the reference; no affiliation or endorsement is claimed.

## Safe use

Read the TSV as inert text through the declared parser. Do not open the raw fixtures in spreadsheet software that could execute a formula-like cell. PM012 deliberately contains inert formula-like text for this boundary test. No URL in a cell is an instruction to browse. Model input is restricted to source cells, admitted source metadata and the public contract; the evaluation directory is excluded.

The included evaluator oracle is a transparent fixture-level conformance oracle. The expressions and failure classes are documented, so its evaluation split is not a blind test of unseen task families. None of the packet verifies XLSX extraction, target-system import, real maintenance correctness, local-model accuracy or time saved.
