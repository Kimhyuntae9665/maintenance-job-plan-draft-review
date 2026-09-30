import {readFileSync} from 'node:fs';
import {sha256} from '../packet-core.mjs';
import {V2_POLICY} from './v2-contract.mjs';
export const V2_FROZEN_FILES=['model_client.py','packet-core.mjs','artifacts/case-split.json','artifacts/v2-development/input.json','artifacts/v2-development/policy.json',
  ...['v2-contract.mjs','v2-frequency-schema.json','v2-prompt.txt','v2-protocol.md','v2-grade.mjs','v2-json.mjs','v2-backend.mjs','v2-input.mjs','v2-runner.py','v2-transport.py','v2-freeze.mjs','v2-integrity.mjs','v2-desk.mjs','v2-desk-client.mjs','v2-desk.html','v2-desk.css','labels/original-development.json'].map(n=>'development/'+n),
  'test/v2-development.test.mjs','test_v2_runner.py',
  ...['source-manifest.json','public-output-contract.json','source-export-01.tsv','source-export-02.tsv'].map(n=>'fixtures/original/maintenance-migration-fixtures-v1/'+n)];
export function verifyV2Freeze(root=new URL('../',import.meta.url)){
  const bytes=readFileSync(new URL('artifacts/v2-development/freeze.json',root)),freeze=JSON.parse(bytes);
  if(freeze.version!==V2_POLICY.version||freeze.phase!=='development'||freeze.experiment_frozen!==true||freeze.model_calls_at_freeze!==0||!/^[a-f0-9]{40}$/.test(freeze.declared_commit??'')||JSON.stringify(freeze.allowed_case_ids)!==JSON.stringify(V2_POLICY.allowed_case_ids))throw Error('invalid_freeze_identity');
  if(!freeze.file_digests||JSON.stringify(Object.keys(freeze.file_digests).sort())!==JSON.stringify([...V2_FROZEN_FILES].sort()))throw Error('incomplete_freeze_file_set');
  for(const name of V2_FROZEN_FILES)if(sha256(readFileSync(new URL(name,root)))!==freeze.file_digests[name])throw Error('frozen_source_changed:'+name);
  return {freeze,digest:sha256(bytes)};
}
export function verifyV2Attempt(attempt,source,{freeze,digest},prompt,schema){
  if(!source.cases.some(c=>c.source_record_id===attempt.case_id)||attempt.version!==V2_POLICY.version||attempt.phase!=='development'||attempt.declared_commit!==freeze.declared_commit||attempt.freeze_digest!==digest||attempt.retry_calls!==0||attempt.demo_calls!==0)throw Error('attempt_provenance_mismatch');
  const c=source.cases.find(c=>c.source_record_id===attempt.case_id),request=attempt.request;
  const expected={model:V2_POLICY.model,messages:[{role:'system',content:prompt+'\n\nExact response JSON Schema:\n'+JSON.stringify(schema)},{role:'user',content:JSON.stringify(c)}],format:schema,stream:false,think:false,truncate:false,shift:false,keep_alive:'30s',options:{num_ctx:4096,num_predict:640,temperature:0,seed:42}};
  if(JSON.stringify(request)!==JSON.stringify(expected))throw Error('attempt_request_mismatch');
}
