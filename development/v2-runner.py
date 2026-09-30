"""Write-once v2 DEVELOPMENT runner. Requires separate explicit sole-GPU handover."""
import argparse,hashlib,importlib.util,json,os,sys,time,urllib.request
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT))
import model_client as transport # unchanged v1 transport only, never its main/prompt/schema
_adapter_spec=importlib.util.spec_from_file_location('v2_transport',ROOT/'development/v2-transport.py');adapter=importlib.util.module_from_spec(_adapter_spec);_adapter_spec.loader.exec_module(adapter)
FROZEN_FILES=['model_client.py','packet-core.mjs','artifacts/case-split.json','artifacts/v2-development/input.json','artifacts/v2-development/policy.json',
 *['development/'+n for n in ['v2-contract.mjs','v2-frequency-schema.json','v2-prompt.txt','v2-protocol.md','v2-grade.mjs','v2-json.mjs','v2-backend.mjs','v2-input.mjs','v2-runner.py','v2-transport.py','v2-freeze.mjs','v2-integrity.mjs','v2-desk.mjs','v2-desk-client.mjs','v2-desk.html','v2-desk.css','labels/original-development.json']],
 'test/v2-development.test.mjs','test_v2_runner.py',*['fixtures/original/maintenance-migration-fixtures-v1/'+n for n in ['source-manifest.json','public-output-contract.json','source-export-01.tsv','source-export-02.tsv']]]

def sha(data):return hashlib.sha256(data).hexdigest()
def unique_object(pairs):
    out={}
    for key,value in pairs:
        if key in out:raise ValueError('duplicate_json_member')
        out[key]=value
    return out
def load(path):return json.loads(path.read_text(encoding='utf-8'),object_pairs_hook=unique_object)
def payload_for(case,policy,prompt,schema):
    return {'model':policy['model'],'messages':[{'role':'system','content':prompt+'\n\nExact response JSON Schema:\n'+json.dumps(schema,ensure_ascii=False,separators=(',',':'))},{'role':'user','content':json.dumps(case,ensure_ascii=False,separators=(',',':'))}],
      'format':schema,'stream':policy['stream'],'think':policy['think'],'truncate':policy['truncate'],'shift':policy['shift'],'keep_alive':'30s',
      'options':{'num_ctx':policy['context'],'num_predict':policy['output'],'temperature':policy['temperature'],'seed':policy['seed']}}
def check_frozen():
    freeze=load(ROOT/'artifacts/v2-development/freeze.json')
    if freeze.get('experiment_frozen') is not True or freeze.get('version')!='P09-V2-DEV-2' or freeze.get('phase')!='development' or freeze.get('model_calls_at_freeze')!=0 or freeze.get('allowed_case_ids')!=['PM001','PM002','PM010'] or len(freeze.get('declared_commit',''))!=40:raise RuntimeError('invalid_freeze_identity')
    if set(freeze.get('file_digests',{}))!=set(FROZEN_FILES):raise RuntimeError('incomplete_freeze_file_set')
    for name,digest in freeze['file_digests'].items():
        if sha((ROOT/name).read_bytes())!=digest:raise RuntimeError('frozen_source_changed:'+name)
    policy=load(ROOT/'artifacts/v2-development/policy.json')
    source=load(ROOT/'artifacts/v2-development/input.json')
    if policy['version']!='P09-V2-DEV-2' or policy['allowed_case_ids']!=['PM001','PM002','PM010'] or [c['source_record_id'] for c in source['cases']]!=policy['allowed_case_ids']:raise RuntimeError('development_case_set_changed')
    if policy['max_http_calls']!=3 or policy['initial_batches']!=1 or policy['concurrency']!=1 or policy['retries']!=0 or policy['demo_inference']!=0:raise RuntimeError('budget_changed')
    return freeze,policy,source
def verify_runtime(policy):
    # Read-only metadata HTTP calls are not inference. Preserve both responses.
    out={}
    for name in ['version','tags']:
        with urllib.request.urlopen('http://127.0.0.1:11434/api/'+name,timeout=5)as response:out[name]=json.loads(response.read(),object_pairs_hook=unique_object)
    out['verified']=out['version'].get('version')==policy['ollama_version'] and any(m.get('name')==policy['model'] and m.get('digest')==policy['model_digest']for m in out['tags'].get('models',[]))
    if not out['verified']:raise RuntimeError('runtime_identity_mismatch:'+json.dumps(out,separators=(',',':')))
    return out
def run_batch(call=adapter.call,runtime_check=verify_runtime):
    freeze,policy,source=check_frozen()
    dest=ROOT/'artifacts/v2-development/batch-01'
    dest.mkdir() # existing even empty is a stop: no second batch/overwrite
    attempts=dest/'attempts';attempts.mkdir()
    try:preflight={'status':'verified','runtime':runtime_check(policy)}
    except Exception as error:preflight={'status':'failed-before-inference','error':str(error)}
    with (dest/'runtime-preflight.json').open('x',encoding='utf-8')as f:json.dump(preflight,f,indent=2);f.flush();os.fsync(f.fileno())
    if preflight['status']!='verified':return
    prompt=(ROOT/'development/v2-prompt.txt').read_text(encoding='utf-8');schema=load(ROOT/'development/v2-frequency-schema.json')
    for case in source['cases']:
        request=payload_for(case,policy,prompt,schema)
        record={'version':policy['version'],'phase':'development','case_id':case['source_record_id'],'declared_commit':freeze['declared_commit'],'freeze_digest':sha((ROOT/'artifacts/v2-development/freeze.json').read_bytes()),'request':request,'httpRequestAttempted':False,'retry_calls':0,'demo_calls':0}
        path=attempts/(case['source_record_id']+'.json');stop=False;started=time.monotonic()
        # Persist intent BEFORE transport. Interrupted intent consumes its one case call.
        def persist():
            temp=path.with_suffix('.pending')
            with temp.open('w',encoding='utf-8') as f:json.dump(record,f,ensure_ascii=False,indent=2);f.flush();os.fsync(f.fileno())
            os.replace(temp,path)
            directory=os.open(attempts,os.O_RDONLY|os.O_DIRECTORY)
            try:os.fsync(directory)
            finally:os.close(directory)
        record['status']='intent-persisted-completion-unverified';persist()
        try:
            record.update(call(request,record));raw=record['raw']
            record['status']='complete' if isinstance(raw,dict) and raw.get('done') is True and raw.get('done_reason')!='length' else 'incomplete-output'
        except Exception as error:
            record.update(status='failed-attempt',error=str(error),elapsedMs=round((time.monotonic()-started)*1000,2));stop=True
        persist();print(case['source_record_id'],record['status'],flush=True)
        if stop:break
    with (dest/'runner-finished.json').open('x',encoding='utf-8') as f:json.dump({'runner_exited_loop':True,'transport_completion_must_be_checked_separately':True,'attempt_count':len(list(attempts.glob('*.json')))},f);f.flush();os.fsync(f.fileno())
def main():
    parser=argparse.ArgumentParser();parser.add_argument('--gpu-lease-authorized',action='store_true');args=parser.parse_args()
    if not args.gpu_lease_authorized:raise RuntimeError('explicit_gpu_handover_required')
    try:run_batch()
    finally:
        while transport.HELD:time.sleep(30) # preserve lease when timeout barrier persistence failed
if __name__=='__main__':main()
