import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import {
  loadPacket, parseTSVBytes, propose, normalizeFrequency, conflictRecords,
  canonicalJSON, hashCanonical, sha256, validateCellEvidence,
  RULE_VERSION, CANONICALIZATION_VERSION, LIMITS,
} from '../packet-core.mjs';

// Source-only engineering checks: no evaluation directory, oracle or result reads.
const directory = resolve(dirname(fileURLToPath(import.meta.url)), '../fixtures/original/maintenance-migration-fixtures-v1');
const packet = loadPacket(directory);
const month = '\ub9e4\uc6d4';
const week = '\ub9e4\uc8fc';
const hours500 = '\uc6b4\uc804 500\uc2dc\uac04\ub9c8\ub2e4';
const hours1000 = '\uc6b4\uc804 1000\uc2dc\uac04\ub9c8\ub2e4';
const combined = '\ub9e4\uc6d4 \ub610\ub294 \uc6b4\uc804 500\uc2dc\uac04 \uc911 \uba3c\uc800 \ub3c4\ub798\ud55c \ub54c';
const unspecifiedCombined = '\ub9e4\uc6d4, \uc6b4\uc804 500\uc2dc\uac04';
const asNeeded = '\ud544\uc694 \uc2dc';
const columns = packet.manifest.exports[0].columns;
const base = {
  source_record_id: 'SYNTH-1', row_key: 'ROW-SYNTH', section_id: 'SECTION-SYNTH',
  organization: 'ORG-SYNTH', site: 'SITE-SYNTH', asset_namespace: 'ASSET-SYNTH',
  asset_id: '00017', task_text: 'Review document register.', frequency_text: month,
  responsible_role: 'Planner role', last_recorded_date: '',
};
const encodeCell = value => /[\t\r\n"]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
function synthBytes(rows, ending = '\r\n') {
  return Buffer.from([columns.join('\t'), ...rows.map(row => columns.map(column => encodeCell(row[column] ?? '')).join('\t'))].join(ending) + ending);
}
function synth(rows = [base], overrides = {}, manifest = packet.manifest) {
  const metadata = { ...packet.manifest.exports[0], file: 'synthetic.tsv', data_row_count: rows.length,
    sha256: undefined, ...overrides };
  return parseTSVBytes(synthBytes(rows), metadata, manifest);
}
function one(overrides = {}, metadata = {}) { return synth([{ ...base, ...overrides }], metadata).records[0]; }

test('source TSVs are independently hash-verified and record IDs remain literal strings', () => {
  assert.equal(packet.files.length, 2);
  assert.equal(packet.records.length, 15);
  for (const file of packet.files) {
    const original = readFileSync(resolve(directory, file.file));
    assert.equal(file.sha256, createHash('sha256').update(original).digest('hex'));
    assert.equal(file.sha256, packet.manifest.exports.find(item => item.file === file.file).sha256);
    assert.deepEqual(file.raw_bytes, original);
  }
  const ids = packet.records.map(record => record.values.asset_id);
  assert.ok(ids.includes('00017'));
  assert.ok(ids.includes('17'));
  assert.ok(packet.records.every(record => typeof record.source_record_id === 'string'));
});

test('parser handles tabs and doubled quotes inside quoted UTF-8 cells with exact byte spans', () => {
  const text = '\uc810\uac80\t"register"';
  const bytes = synthBytes([{ ...base, task_text: text }]);
  const file = parseTSVBytes(bytes, { ...packet.manifest.exports[0], file: 'synthetic.tsv', sha256: undefined, data_row_count: 1 }, packet.manifest);
  const record = file.records[0];
  const cell = record.cells.find(item => item.cell_column === 'task_text');
  assert.equal(cell.raw_cell_text, text);
  assert.equal(cell.quote, text);
  assert.equal(cell.quoted, true);
  assert.equal(cell.raw_tsv_lexeme, `"\uc810\uac80\t""register"""`);
  assert.equal(bytes.subarray(cell.lexical_span.byte_start_0_based, cell.lexical_span.byte_end_exclusive).toString('utf8'), cell.raw_tsv_lexeme);
  assert.notEqual(cell.raw_tsv_lexeme, cell.quote);
  assert.equal(cell.tsv_line_1_based, 2);
  assert.equal(cell.data_row_1_based, 1);
  assert.equal(cell.cell_column_1_based, columns.indexOf('task_text') + 1);
  assert.equal(cell.file_sha256, file.sha256);
});

test('parser rejects undeclared dialect, malformed quoting, multiline fields and lone record newlines', () => {
  const metadata = { ...packet.manifest.exports[0], file: 'synthetic.tsv', sha256: undefined, data_row_count: 1 };
  assert.throws(() => parseTSVBytes(synthBytes([base]), { ...metadata, delimiter: 'COMMA' }), /dialect/);
  assert.throws(() => parseTSVBytes(synthBytes([base], '\n'), metadata), /CRLF/);
  assert.throws(() => parseTSVBytes(synthBytes([{ ...base, task_text: 'first\r\nsecond' }]), metadata), /Multiline/);
  const header = columns.join('\t') + '\r\n';
  assert.throws(() => parseTSVBytes(Buffer.from(header + '"unclosed'), { ...metadata, data_row_count: undefined }), /Unclosed/);
  assert.throws(() => parseTSVBytes(Buffer.from(header + '"closed"tail\r\n'), { ...metadata, data_row_count: undefined }), /Unexpected text/);
  assert.throws(() => parseTSVBytes(Buffer.from(header + 'bad"quote\r\n'), { ...metadata, data_row_count: undefined }), /Quote in unquoted/);
});

test('parser fails closed for source hash, header/count/width, invalid UTF-8 and declared bounds', () => {
  const metadata = { ...packet.manifest.exports[0], file: 'synthetic.tsv', sha256: undefined, data_row_count: 1 };
  const bytes = synthBytes([base]);
  assert.throws(() => parseTSVBytes(bytes, { ...metadata, sha256: '0'.repeat(64) }), /SHA256 mismatch/);
  assert.throws(() => parseTSVBytes(bytes, { ...metadata, columns: [...columns].reverse() }), /header differs/);
  assert.throws(() => parseTSVBytes(bytes, { ...metadata, data_row_count: 2 }), /row count/);
  assert.throws(() => parseTSVBytes(Buffer.from(columns.join('\t') + '\r\nonly-one-field\r\n'), metadata), /field count/);
  assert.throws(() => parseTSVBytes(Buffer.from([0xff]), metadata), /encoded data|encoding/i);
  assert.throws(() => parseTSVBytes(Buffer.alloc(LIMITS.file_bytes + 1), metadata), /file byte limit/);
  assert.throws(() => parseTSVBytes(synthBytes([{ ...base, task_text: 'a'.repeat(LIMITS.cell_bytes + 1) }]), metadata), /cell exceeds/);
  assert.throws(() => parseTSVBytes(bytes, { ...metadata, columns: Array.from({ length: LIMITS.columns + 1 }, (_, index) => `column-${index}`) }), /Invalid TSV columns/);
});

test('immutable parser output and copy-on-read raw bytes resist caller/source mutation', () => {
  const bytes = synthBytes([base]);
  const file = parseTSVBytes(bytes, { ...packet.manifest.exports[0], file: 'synthetic.tsv', sha256: undefined, data_row_count: 1 }, packet.manifest);
  const before = file.raw_bytes;
  bytes.fill(0);
  file.raw_bytes.fill(0);
  assert.deepEqual(file.raw_bytes, before);
  assert.ok(Object.isFrozen(file));
  assert.ok(Object.isFrozen(file.records[0].cells[0].lexical_span));
  assert.throws(() => { file.records[0].values.asset_id = '17'; }, TypeError);
});

test('logical identity excludes capture-local IDs and capture time cannot resolve conflicts', () => {
  const first = one({ source_record_id: 'CAPTURE-A' }, { capture_time: '2026-01-01' });
  const same = one({ source_record_id: 'CAPTURE-B' }, { capture_time: '2026-12-31' });
  assert.deepEqual(conflictRecords(first, [first, same]), []);
  assert.equal(first.payload_sha256, same.payload_sha256);
  assert.notEqual(first.source_fingerprint, same.source_fingerprint);
  const changed = one({ source_record_id: 'CAPTURE-C', frequency_text: hours1000 }, { capture_time: '2027-12-31' });
  for (const record of [first, changed]) {
    const proposal = propose(record, [first, changed]);
    assert.ok(proposal.blocking_issues.includes('same_identity_content_conflict'));
    assert.equal(proposal.reviewable, false);
    assert.deepEqual(proposal.conflict_capture_ids, ['CAPTURE-A', 'CAPTURE-C']);
  }
  const revisionB = one({ source_record_id: 'CAPTURE-D', frequency_text: hours1000 }, { source_revision: 'B' });
  assert.deepEqual(conflictRecords(first, [first, revisionB]), []);
  assert.equal(propose(first, [first, revisionB]).review_state, 'unreviewed');
});

test('comparison follows manifest columns, including section/site/string identities, without scope inheritance', () => {
  const first = one();
  for (const changed of [{ asset_id: '17' }, { site: 'OTHER-SITE' }, { section_id: 'OTHER-SECTION' }, { task_text: 'Changed.' }]) {
    const second = one({ ...changed, source_record_id: 'SYNTH-2' });
    assert.equal(conflictRecords(first, [first, second]).length, 2);
  }
  const absent = one({ asset_id: '' });
  const proposal = propose(absent, [first, absent]);
  assert.equal(proposal.normalized_fields.asset_id, null);
  assert.ok(proposal.blocking_issues.includes('missing_asset_id'));
  assert.throws(() => synth([base], {}, { ...packet.manifest, content_comparison_columns: ['source_record_id'] }), /Capture-local/);
});

test('complete trimmed grammar distinguishes calendar rules, intervals, meters and explicit relation', () => {
  assert.deepEqual(normalizeFrequency(`${month} 1\uc77c`), { kind: 'calendar_rule', rule: 'day_of_month', day: 1 });
  assert.deepEqual(normalizeFrequency(`  ${month}\t`), { kind: 'calendar_interval', value: 1, unit: 'month' });
  assert.deepEqual(normalizeFrequency('3\uac1c\uc6d4\ub9c8\ub2e4'), { kind: 'calendar_interval', value: 3, unit: 'month' });
  assert.deepEqual(normalizeFrequency(week), { kind: 'calendar_interval', value: 1, unit: 'week' });
  assert.deepEqual(normalizeFrequency(hours500), { kind: 'meter_interval', value: 500, unit: 'hour', basis: 'operating_runtime' });
  assert.deepEqual(normalizeFrequency(hours1000), { kind: 'meter_interval', value: 1000, unit: 'hour', basis: 'operating_runtime' });
  const combinedResult = normalizeFrequency(combined);
  assert.equal(combinedResult.kind, 'combined');
  assert.equal(combinedResult.relation, 'whichever_first');
  assert.deepEqual(combinedResult.triggers, [normalizeFrequency(month), normalizeFrequency(hours500)]);
  for (const raw of ['', `${month} extra`, `prefix ${month}`, 'monthly', '30 days', `${hours500} later`]) assert.equal(normalizeFrequency(raw), null);
  assert.throws(() => normalizeFrequency(500), TypeError);
});

test('missing fields, unsupported expressions and unspecified event/relation are hard blockers', () => {
  for (const [column, blocker] of [['organization', 'missing_organization'], ['site', 'missing_site'], ['asset_namespace', 'missing_asset_namespace'], ['asset_id', 'missing_asset_id'], ['task_text', 'missing_task_text'], ['frequency_text', 'missing_frequency'], ['responsible_role', 'missing_responsible_role']]) {
    const proposal = propose(one({ [column]: ' ' }));
    assert.ok(proposal.blocking_issues.includes(blocker), column);
    assert.equal(proposal.reviewable, false);
  }
  assert.ok(propose(one({}, { logical_document_id: '' })).blocking_issues.includes('missing_logical_document_id'));
  assert.ok(propose(one({ frequency_text: 'unknown schedule' })).blocking_issues.includes('unsupported_frequency'));
  const event = propose(one({ frequency_text: asNeeded }));
  assert.deepEqual(event.normalized_fields.frequency, { kind: 'event_trigger', event: null });
  assert.ok(event.blocking_issues.includes('unspecified_event_condition'));
  const mixed = propose(one({ frequency_text: unspecifiedCombined }));
  assert.equal(mixed.normalized_fields.frequency.relation, null);
  assert.ok(mixed.blocking_issues.includes('unspecified_trigger_relation'));
});

test('meter and month-end scheduling unknowns do not erase supported normalization eligibility', () => {
  const meterProposal = propose(one({ frequency_text: hours500 }));
  assert.equal(meterProposal.reviewable, true);
  assert.ok(meterProposal.scheduling_unknowns.includes('meter_baseline_unknown'));
  assert.ok(meterProposal.scheduling_unknowns.includes('meter_due_point_unknown'));
  const monthProposal = propose(one({ frequency_text: '3\uac1c\uc6d4\ub9c8\ub2e4', last_recorded_date: '2026-01-31' }));
  assert.equal(monthProposal.reviewable, true);
  assert.equal(monthProposal.normalized_fields.last_recorded_date, '2026-01-31');
  assert.equal(monthProposal.normalized_fields.frequency.value, 3);
  assert.ok(monthProposal.scheduling_unknowns.includes('month_end_convention_not_declared'));
  for (const proposal of [meterProposal, monthProposal]) {
    assert.equal(proposal.normalized_fields.next_due_date, null);
    assert.ok(proposal.scheduling_unknowns.includes('schedule_anchor_not_declared'));
  }
});

test('formula-like tasks remain exact inert text and block review eligibility', () => {
  for (const task_text of ['=HYPERLINK("https://example.invalid/demo","document")', '+command', '-command', '@command', '  =SUM(1,2)']) {
    const record = one({ task_text });
    const proposal = propose(record);
    assert.equal(proposal.normalized_fields.task_text, task_text);
    assert.ok(proposal.blocking_issues.includes('formula_like_task'));
    assert.equal(proposal.reviewable, false);
    assert.ok(proposal.evidence.some(cell => cell.cell_column === 'task_text' && cell.quote === task_text));
  }
});

test('every proposal preserves exact literal source fields, source evidence and unsubmitted/null status', () => {
  for (const record of packet.records) {
    const proposal = propose(record, packet.records);
    for (const column of ['organization', 'site', 'asset_namespace', 'task_text']) assert.equal(proposal.normalized_fields[column], record.values[column]);
    for (const column of ['asset_id', 'responsible_role', 'last_recorded_date']) assert.equal(proposal.normalized_fields[column], record.values[column].trim() ? record.values[column] : null);
    assert.equal(proposal.normalized_fields.assigned_person, null);
    assert.equal(proposal.normalized_fields.next_due_date, null);
    assert.equal(proposal.normalized_fields.target_import_status, 'not_submitted');
    assert.equal(proposal.review_state, 'unreviewed');
    assert.equal(proposal.normalizer_rule_version, RULE_VERSION);
    assert.equal(proposal.canonicalization_version, CANONICALIZATION_VERSION);
    assert.ok(proposal.evidence.every(cell => validateCellEvidence(cell, record)));
  }
});

test('cell evidence validation rejects changed quote, scope, source hash, locator or lexical span', () => {
  const record = one();
  const original = record.cells.find(cell => cell.cell_column === 'asset_id');
  assert.equal(validateCellEvidence(structuredClone(original), record), true);
  for (const patch of [{ quote: '17' }, { raw_cell_text: '17' }, { file_sha256: '0'.repeat(64) }, { tsv_line_1_based: 3 }, { site: 'OTHER-SITE' }, { lexical_span: { byte_start_0_based: 0, byte_end_exclusive: 1 } }]) {
    assert.equal(validateCellEvidence({ ...original, ...patch }, record), false);
  }
  assert.equal(validateCellEvidence(null, record), false);
});

test('versioned canonicalization and proposal hashes bind full fields/evidence/source', () => {
  assert.equal(canonicalJSON({ z: 2, a: { y: 1, x: '00017' } }), '{"a":{"x":"00017","y":1},"z":2}');
  assert.equal(hashCanonical({ b: 2, a: 1 }), hashCanonical({ a: 1, b: 2 }));
  assert.notEqual(hashCanonical('00017'), hashCanonical('17'));
  assert.equal(sha256(Buffer.from('abc')), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.throws(() => canonicalJSON(undefined), TypeError);
  const proposal = propose(one());
  const { proposal_sha256, ...unsigned } = proposal;
  assert.equal(proposal_sha256, hashCanonical(unsigned));
  assert.equal(proposal.normalized_content_sha256, hashCanonical({ normalized_fields: proposal.normalized_fields, evidence: proposal.evidence }));
  assert.notEqual(propose(one({ task_text: 'Changed source task.' })).proposal_sha256, proposal_sha256);
  assert.notEqual(propose(one({ source_record_id: 'SYNTH-2' })).proposal_sha256, proposal_sha256);
  assert.notEqual(propose(one({ asset_id: '17' })).normalized_content_sha256, proposal.normalized_content_sha256);
});

test('executed engineering eligibility is reported separately from acceptance or oracle accuracy', context => {
  const proposals = packet.records.map(record => propose(record, packet.records));
  const reviewable = proposals.filter(proposal => proposal.reviewable).length;
  const blocked = proposals.filter(proposal => !proposal.reviewable).length;
  assert.equal(reviewable + blocked, packet.records.length);
  assert.equal(proposals.filter(proposal => proposal.review_state === 'accepted').length, 0);
  context.diagnostic(`Executed deterministic engineering check: ${reviewable}/${proposals.length} reviewable, ${blocked}/${proposals.length} blocked; no oracle comparison or model accuracy claim.`);
});
