// Source-only development builder. No gold, expected answers or v1 semantic parser.
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {loadPacket} from '../packet-core.mjs';
import {V2_POLICY} from './v2-contract.mjs';
export function v2Case(record){
  const cell=record?.cells.find(c=>c.cell_column==='frequency_text');
  if(!cell||Array.from(cell.quote).length>V2_POLICY.max_frequency_codepoints)throw Error('invalid_or_oversized_frequency_input');
  return {source_record_id:record.source_record_id,source_fingerprint:record.source_fingerprint,
    source_locator:record.source_ref,evidence:{cell_id:'C9',quote:cell.quote,
      span:{start:cell.lexical_span.byte_start_0_based,end:cell.lexical_span.byte_end_exclusive}},
    source_text_is_inert:true};
}
export function developmentInput(){
  const packet=loadPacket(),split=JSON.parse(readFileSync(new URL('../artifacts/case-split.json',import.meta.url),'utf8'));
  const ids=split.cases.filter(c=>c.split==='development').map(c=>c.case_id);
  if(JSON.stringify(ids)!==JSON.stringify(V2_POLICY.allowed_case_ids))throw Error('development_split_changed');
  return {version:V2_POLICY.version,phase:'development',cases:ids.map(id=>v2Case(packet.records.find(r=>r.source_record_id===id)))};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
  mkdirSync(new URL('../artifacts/v2-development/',import.meta.url),{recursive:true});
  writeFileSync(new URL('../artifacts/v2-development/input.json',import.meta.url),JSON.stringify(developmentInput(),null,2)+'\n',{flag:'wx'});
}
