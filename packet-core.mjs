import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

export const RULE_VERSION = 'P09-BOUNDED-KO-1';
export const CANONICALIZATION_VERSION = 'P09-CANONICAL-JSON-1';
export const LIMITS = Object.freeze({ file_bytes: 1048576, rows: 10000, columns: 64, cell_bytes: 65536, files: 16 });
const DEFAULT_DIRECTORY = resolve(dirname(fileURLToPath(import.meta.url)), 'fixtures/original/maintenance-migration-fixtures-v1');
const decoder = new TextDecoder('utf-8', { fatal: true });
const DEFAULT_IDENTITY = ['source_system', 'logical_document_id', 'source_revision', 'sheet_name', 'row_key'];
const DEFAULT_COMPARISON = ['section_id', 'organization', 'site', 'asset_namespace', 'asset_id', 'task_text', 'frequency_text', 'responsible_role', 'last_recorded_date'];

export const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
export function canonicalJSON(value) {
  if (value === null || typeof value !== 'object') {
    const encoded = JSON.stringify(value);
    if (encoded === undefined) throw new TypeError('Canonical JSON requires JSON values');
    return encoded;
  }
  if (Array.isArray(value)) return `[${value.map(canonicalJSON).join(',')}]`;
  return `{${Object.keys(value).filter(key => value[key] !== undefined).sort()
    .map(key => `${JSON.stringify(key)}:${canonicalJSON(value[key])}`).join(',')}}`;
}
export const hashCanonical = value => sha256(canonicalJSON(value));
function immutable(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) immutable(child);
    Object.freeze(value);
  }
  return value;
}
const nonempty = value => typeof value === 'string' && value.trim().length > 0;

/** Strict byte-oriented TSV parsing; delimiters/quotes are recognized, never executed. */
export function parseTSVBytes(input, metadata, manifest = {}) {
  const bytes = Buffer.from(input); // private copy cannot be changed by the caller
  if (bytes.length > LIMITS.file_bytes) throw new Error('TSV exceeds file byte limit');
  decoder.decode(bytes); // fatal UTF-8 validation, no replacement characters
  if (metadata.encoding !== 'UTF-8' || metadata.delimiter !== 'TAB' || metadata.line_endings !== 'CRLF'
    || metadata.quote_character !== '"' || metadata.double_quote_escape !== true || metadata.contains_header !== true) {
    throw new Error('Unsupported TSV dialect');
  }
  const columns = metadata.columns;
  if (!Array.isArray(columns) || columns.length === 0 || columns.length > LIMITS.columns
    || new Set(columns).size !== columns.length || columns.some(column => !nonempty(column))) throw new Error('Invalid TSV columns');
  const fileHash = sha256(bytes);
  if (metadata.sha256 && metadata.sha256 !== fileHash) throw new Error(`Source SHA256 mismatch: ${metadata.file}`);
  const parsedRows = [];
  let pos = 0;
  let physicalLine = 1;
  while (pos < bytes.length) {
    const fields = [];
    const rowStart = pos;
    let rowFinished = false;
    while (!rowFinished) {
      const start = pos;
      const chunks = [];
      let quoted = false;
      if (bytes[pos] === 0x22) {
        quoted = true;
        pos++;
        let segmentStart = pos;
        let closed = false;
        while (pos < bytes.length) {
          if (bytes[pos] === 0x0d || bytes[pos] === 0x0a) throw new Error('Multiline TSV fields are outside the declared contract');
          if (bytes[pos] === 0x22) {
            chunks.push(bytes.subarray(segmentStart, pos));
            if (bytes[pos + 1] === 0x22) {
              chunks.push(Buffer.from([0x22]));
              pos += 2;
              segmentStart = pos;
            } else {
              pos++;
              closed = true;
              break;
            }
          } else pos++;
        }
        if (!closed) throw new Error('Unclosed quoted TSV field');
        if (pos < bytes.length && ![0x09, 0x0d, 0x0a].includes(bytes[pos])) throw new Error('Unexpected text after quoted TSV field');
      } else {
        while (pos < bytes.length && ![0x09, 0x0d, 0x0a].includes(bytes[pos])) {
          if (bytes[pos] === 0x22) throw new Error('Quote in unquoted TSV field');
          pos++;
        }
        chunks.push(bytes.subarray(start, pos));
      }
      const end = pos;
      if (end - start > LIMITS.cell_bytes) throw new Error('TSV cell exceeds byte limit');
      fields.push({ value: decoder.decode(Buffer.concat(chunks)), quoted,
        raw_tsv_lexeme: decoder.decode(bytes.subarray(start, end)),
        lexical_span: { byte_start_0_based: start, byte_end_exclusive: end } });
      if (fields.length > LIMITS.columns) throw new Error('TSV exceeds column limit');
      if (bytes[pos] === 0x09) pos++;
      else if (pos === bytes.length) rowFinished = true;
      else if (bytes[pos] === 0x0d && bytes[pos + 1] === 0x0a) { pos += 2; rowFinished = true; }
      else throw new Error('TSV requires CRLF record endings');
    }
    parsedRows.push({ fields, physicalLine, rowStart, rowEnd: pos });
    if (parsedRows.length > LIMITS.rows + 1) throw new Error('TSV exceeds row limit');
    physicalLine++;
  }
  if (!parsedRows.length || canonicalJSON(parsedRows[0].fields.map(field => field.value)) !== canonicalJSON(columns)) throw new Error('TSV header differs from manifest columns');
  const rows = parsedRows.slice(1);
  if (Number.isInteger(metadata.data_row_count) && rows.length !== metadata.data_row_count) throw new Error('TSV data row count differs from manifest');
  const identityColumns = manifest.record_identity ?? DEFAULT_IDENTITY;
  const comparisonColumns = manifest.content_comparison_columns ?? DEFAULT_COMPARISON;
  if (comparisonColumns.includes('source_record_id')) throw new Error('Capture-local source_record_id cannot participate in payload equality');
  const records = rows.map((row, index) => {
    if (row.fields.length !== columns.length) throw new Error(`TSV field count mismatch at physical line ${row.physicalLine}`);
    const values = Object.fromEntries(columns.map((column, ci) => [column, row.fields[ci].value]));
    const sourceRef = {
      source_record_id: values.source_record_id,
      file: metadata.file, file_sha256: fileHash, source_system: metadata.source_system,
      logical_document_id: metadata.logical_document_id, source_revision: metadata.source_revision,
      sheet_name: metadata.sheet_name, row_key: values.row_key,
      tsv_line_1_based: row.physicalLine, data_row_1_based: index + 1,
    };
    const cells = row.fields.map((field, ci) => ({ ...sourceRef,
      cell_column: columns[ci], cell_column_1_based: ci + 1,
      raw_cell_text: field.value, quote: field.value, raw_tsv_lexeme: field.raw_tsv_lexeme,
      quoted: field.quoted, lexical_span: field.lexical_span }));
    const identity = Object.fromEntries(identityColumns.map(column => [column,
      Object.hasOwn(values, column) ? values[column] : metadata[column] ?? null]));
    const payload = Object.fromEntries(comparisonColumns.map(column => [column, values[column] ?? null]));
    const record = {
      source_record_id: values.source_record_id, values, cells, source_ref: sourceRef,
      logical_record_identity: identity, record_identity_columns: [...identityColumns],
      content_comparison_columns: [...comparisonColumns], capture_time: metadata.capture_time,
      payload_sha256: hashCanonical(payload),
    };
    record.source_fingerprint = hashCanonical({ source_ref: sourceRef, identity, cells });
    return immutable(record);
  });
  const file = { file: metadata.file, sha256: fileHash, raw_byte_length: bytes.length,
    metadata: structuredClone(metadata), records, header: columns.slice() };
  Object.defineProperty(file, 'raw_bytes', { enumerable: false, get: () => Buffer.from(bytes) });
  return immutable(file);
}

/** Only explicitly listed TSV sources and public manifest/contract are loaded. */
export function loadPacket(directory = DEFAULT_DIRECTORY) {
  const manifest = JSON.parse(readFileSync(resolve(directory, 'source-manifest.json'), 'utf8'));
  const contract = JSON.parse(readFileSync(resolve(directory, 'public-output-contract.json'), 'utf8'));
  if (!Array.isArray(manifest.exports) || manifest.exports.length > LIMITS.files) throw new Error('Packet export count exceeds limit');
  const allowed = new Set(manifest.runtime_input_allowlist ?? []);
  const files = manifest.exports.map(metadata => {
    if (typeof metadata.file !== 'string' || !/^[A-Za-z0-9._-]+\.tsv$/.test(metadata.file)
      || !allowed.has(metadata.file)) throw new Error('Export outside runtime source allowlist');
    return parseTSVBytes(readFileSync(resolve(directory, metadata.file)), metadata, manifest);
  });
  const records = files.flatMap(file => file.records);
  const captureIds = records.map(record => record.source_record_id);
  if (captureIds.some(id => !nonempty(id)) || new Set(captureIds).size !== captureIds.length) throw new Error('Capture record IDs must be nonblank and unique');
  return immutable({ manifest, contract, files, records });
}

const month = () => ({ kind: 'calendar_interval', value: 1, unit: 'month' });
const meter = value => ({ kind: 'meter_interval', value, unit: 'hour', basis: 'operating_runtime' });
/** Complete trimmed Korean expressions only, not substring or row-ID matching. */
export function normalizeFrequency(raw) {
  if (typeof raw !== 'string') throw new TypeError('Frequency source must be a literal string');
  switch (raw.trim()) {
    case '매월 1일': return { kind: 'calendar_rule', rule: 'day_of_month', day: 1 };
    case '매월': return month();
    case '3개월마다': return { kind: 'calendar_interval', value: 3, unit: 'month' };
    case '매주': return { kind: 'calendar_interval', value: 1, unit: 'week' };
    case '운전 500시간마다': return meter(500);
    case '운전 1000시간마다': return meter(1000);
    case '매월 또는 운전 500시간 중 먼저 도래한 때': return { kind: 'combined', relation: 'whichever_first', triggers: [month(), meter(500)] };
    case '매월, 운전 500시간': return { kind: 'combined', relation: null, triggers: [month(), meter(500)] };
    case '필요 시': return { kind: 'event_trigger', event: null };
    default: return null;
  }
}

export function conflictRecords(record, allRecords) {
  const identityKey = canonicalJSON(record.logical_record_identity);
  const group = allRecords.filter(candidate => canonicalJSON(candidate.logical_record_identity) === identityKey);
  const columns = record.content_comparison_columns;
  const content = candidate => canonicalJSON(Object.fromEntries(columns.map(column => [column, candidate.values[column] ?? null])));
  return new Set(group.map(content)).size > 1 ? group : [];
}

/** Derived proposal eligibility is separate from explicit human acceptance. */
export function propose(record, allRecords = [record]) {
  const values = record.values;
  const blockers = [];
  for (const [column, value] of Object.entries(record.logical_record_identity)) {
    if (!nonempty(value)) blockers.push(`missing_${column}`);
  }
  for (const column of ['organization', 'site', 'asset_namespace', 'asset_id', 'task_text', 'frequency_text', 'responsible_role']) {
    if (!nonempty(values[column])) blockers.push(column === 'frequency_text' ? 'missing_frequency' : `missing_${column}`);
  }
  const conflicts = conflictRecords(record, allRecords);
  if (conflicts.length) blockers.push('same_identity_content_conflict');
  if (/^[=+\-@]/.test((values.task_text ?? '').trimStart())) blockers.push('formula_like_task');
  const frequency = normalizeFrequency(values.frequency_text ?? '');
  if (nonempty(values.frequency_text) && frequency === null) blockers.push('unsupported_frequency');
  if (frequency?.kind === 'event_trigger' && frequency.event === null) blockers.push('unspecified_event_condition');
  if (frequency?.kind === 'combined' && frequency.relation === null) blockers.push('unspecified_trigger_relation');
  const schedulingUnknowns = ['schedule_anchor_not_declared', 'next_due_date_not_calculated', 'target_system_requirements_not_assessed'];
  const triggers = frequency?.kind === 'combined' ? frequency.triggers : frequency ? [frequency] : [];
  if (triggers.some(trigger => trigger.kind === 'meter_interval')) schedulingUnknowns.push('meter_baseline_unknown', 'current_meter_reading_unknown', 'meter_due_point_unknown');
  if (triggers.some(trigger => trigger.kind === 'calendar_interval' && trigger.unit === 'month')) schedulingUnknowns.push('month_end_convention_not_declared');
  if (frequency?.kind === 'calendar_rule') schedulingUnknowns.push('calendar_timezone_not_declared');
  if (frequency?.kind === 'event_trigger') schedulingUnknowns.push('event_condition_unspecified');
  const normalizedFields = {
    organization: values.organization ?? '', site: values.site ?? '', asset_namespace: values.asset_namespace ?? '',
    asset_id: nonempty(values.asset_id) ? values.asset_id : null,
    task_text: values.task_text ?? '',
    responsible_role: nonempty(values.responsible_role) ? values.responsible_role : null,
    last_recorded_date: nonempty(values.last_recorded_date) ? values.last_recorded_date : null,
    frequency, next_due_date: null, assigned_person: null, target_import_status: 'not_submitted',
  };
  const evidence = record.cells.map(cell => structuredClone(cell));
  const proposal = {
    source_record_id: record.source_record_id, source_ref: structuredClone(record.source_ref),
    source_file_sha256: record.source_ref.file_sha256,
    source_fingerprint: record.source_fingerprint,
    logical_record_identity: structuredClone(record.logical_record_identity),
    normalizer_rule_version: RULE_VERSION, canonicalization_version: CANONICALIZATION_VERSION,
    proposal_revision: 1, normalized_fields: normalizedFields, evidence,
    blocking_issues: [...new Set(blockers)], scheduling_unknowns: schedulingUnknowns,
    conflict_capture_ids: conflicts.map(candidate => candidate.source_record_id),
    reviewable: blockers.length === 0, review_state: 'unreviewed',
  };
  proposal.normalized_content_sha256 = hashCanonical({ normalized_fields: normalizedFields, evidence });
  proposal.proposal_sha256 = hashCanonical(proposal);
  return proposal;
}

/** Validate exact decoded cell evidence and the associated immutable lexical span. */
export function validateCellEvidence(evidence, record) {
  if (!evidence || typeof evidence !== 'object') return false;
  const actual = record.cells.find(cell => cell.cell_column === evidence.cell_column);
  return Boolean(actual && canonicalJSON(actual) === canonicalJSON(evidence));
}
