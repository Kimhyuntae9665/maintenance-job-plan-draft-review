// CPU-only write-once freeze. Run after committing declared implementation, never calls model.
import {readFileSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {V2_POLICY,V2_SCHEMA} from './v2-contract.mjs';
import {sha256,loadPacket} from '../packet-core.mjs';
import {developmentInput} from './v2-input.mjs';
import {V2_FROZEN_FILES} from './v2-integrity.mjs';
const root=new URL('../',import.meta.url),read=name=>readFileSync(new URL(name,root));
if(execFileSync('git',['status','--porcelain'],{cwd:root}).toString().trim())throw Error('declared_commit_tree_must_be_clean');
const input=JSON.parse(read('artifacts/v2-development/input.json'));
if(JSON.stringify(input)!==JSON.stringify(developmentInput()))throw Error('input_changed');
if(JSON.stringify(JSON.parse(read('development/v2-frequency-schema.json')))!==JSON.stringify(V2_SCHEMA))throw Error('schema_generator_mismatch');
const policy=JSON.parse(read('artifacts/v2-development/policy.json'));
if(JSON.stringify(policy)!==JSON.stringify(V2_POLICY))throw Error('policy_generator_mismatch');
const declared_commit=execFileSync('git',['rev-parse','HEAD'],{cwd:root}).toString().trim();
loadPacket();const files=V2_FROZEN_FILES;
const file_digests=Object.fromEntries(files.map(name=>[name,sha256(read(name))]));
writeFileSync(new URL('artifacts/v2-development/freeze.json',root),JSON.stringify({experiment_frozen:true,version:V2_POLICY.version,phase:'development',declared_commit,model_calls_at_freeze:0,allowed_case_ids:V2_POLICY.allowed_case_ids,challenge_labels_not_yet_authored:true,file_digests},null,2)+'\n',{flag:'wx'});
