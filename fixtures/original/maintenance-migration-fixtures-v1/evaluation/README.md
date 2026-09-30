# Fixture evaluation oracle

frozen-gold-v1.json contains 15 original author-written typed expectations: three development records and twelve evaluation records. The source represents fourteen logical rows because one row has two conflicting captures. Preserve those denominators. Gold was created before model experiments according to the packet's authoring metadata; it is not independent maintenance-specialist ground truth.

Keep this directory out of model prompts, indexes and runtime search. The source/implementation contract documents the tested grammar and failure classes, so the split is fixture-level conformance testing rather than a blind generalization benchmark. Do not tune prompts on evaluation output and later describe the same rerun as held out.

Report literal-field exact matches, typed-frequency exact matches, issue recall/false positives, unsupported normalized values and unsafe acceptance separately. Then report review-state/receipt/export tests separately from extraction. IDs and provenance are exact strings; issue arrays can be compared as sets after verifying no duplicate issue IDs. Combined trigger order is calendar then meter in this oracle; any implementation accepting an equivalent order must document that comparison before evaluation. Preserve failed attempts and both record/logical-row denominators.

The expected reviewability counts are seven reviewable and eight needing clarification. No record is automatically accepted. All records keep next_due_date and assigned_person null, and target_import_status not_submitted. These counts are expected labels, not observed application or model scores.

validation-report.json covers only file hashes, parser/locator integrity, literal-field agreement, designed frequency labels and internal consistency. It does not establish model correctness, independent adjudication or business effectiveness.
