"""CPU-only fake transport; never touches real inference lock/runtime."""
import importlib.util,json,tempfile,unittest,urllib.error,urllib.request,io
from pathlib import Path
ROOT=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location('v2_runner',ROOT/'development/v2-runner.py');runner=importlib.util.module_from_spec(spec);spec.loader.exec_module(runner)
class V2RunnerTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.saved=runner.ROOT;runner.ROOT=Path(self.tmp.name);r=runner.ROOT
        (r/'development').mkdir();(r/'artifacts/v2-development').mkdir(parents=True)
        for name in runner.FROZEN_FILES:
            (r/name).parent.mkdir(parents=True,exist_ok=True);(r/name).write_text('CPU-only frozen fixture')
        self.policy={'version':'P09-V2-DEV-2','model':'qwen3:4b','allowed_case_ids':['PM001','PM002','PM010'],'max_http_calls':3,'initial_batches':1,'concurrency':1,'retries':0,'demo_inference':0,'stream':False,'think':False,'truncate':False,'shift':False,'context':4096,'output':640,'temperature':0,'seed':42}
        self.write('artifacts/v2-development/policy.json',self.policy);self.write('artifacts/v2-development/input.json',{'cases':[{'source_record_id':id}for id in self.policy['allowed_case_ids']]})
        self.write('development/v2-frequency-schema.json',{'type':'object'});(r/'development/v2-prompt.txt').write_text('Frozen test prompt',encoding='utf-8')
        self.freeze()
    def write(self,name,value):(runner.ROOT/name).write_text(json.dumps(value),encoding='utf-8')
    def freeze(self):
        names=runner.FROZEN_FILES
        self.write('artifacts/v2-development/freeze.json',{'experiment_frozen':True,'version':'P09-V2-DEV-2','phase':'development','model_calls_at_freeze':0,'allowed_case_ids':['PM001','PM002','PM010'],'declared_commit':'a'*40,'file_digests':{n:runner.sha((runner.ROOT/n).read_bytes())for n in names}})
    def tearDown(self):runner.ROOT=self.saved;self.tmp.cleanup()
    def test_exact_three_serial_calls_no_second_batch(self):
        calls=[]
        def fake(payload,record):
            self.assertTrue((runner.ROOT/'artifacts/v2-development/batch-01/attempts'/f"{record['case_id']}.json").exists());calls.append(payload);return {'raw':{'done':True,'done_reason':'stop','message':{'content':'{}'}}}
        runner.run_batch(fake,lambda p:{'verified':True});self.assertEqual(len(calls),3)
        with self.assertRaises(FileExistsError):runner.run_batch(fake,lambda p:{'verified':True})
        self.assertEqual(len(calls),3);self.assertIn('Frozen test prompt',calls[0]['messages'][0]['content'])
    def test_timeout_preserved_stops_remaining_cases(self):
        def fake(payload,record):record['httpRequestAttempted']=True;raise RuntimeError('model_timeout_shared_runtime_blocked')
        runner.run_batch(fake,lambda p:{'verified':True});paths=list((runner.ROOT/'artifacts/v2-development/batch-01/attempts').glob('*.json'));self.assertEqual(len(paths),1)
        out=json.loads(paths[0].read_text());self.assertEqual(out['status'],'failed-attempt');self.assertTrue(out['httpRequestAttempted']);self.assertIn('blocked',out['error'])
    def test_source_change_blocks_before_transport(self):
        (runner.ROOT/'development/v2-prompt.txt').write_text('changed')
        with self.assertRaisesRegex(RuntimeError,'frozen_source_changed'):runner.run_batch(lambda *args:self.fail('transport called'))
    def test_non_length_completion_and_all_incomplete_outputs_preserved(self):
        runner.run_batch(lambda *args:{'raw':{'done':True,'done_reason':'length','message':{'content':'{incomplete'}}},lambda p:{'verified':True})
        paths=list((runner.ROOT/'artifacts/v2-development/batch-01/attempts').glob('*.json'));self.assertEqual(len(paths),3);self.assertTrue(all(json.loads(p.read_text())['status']=='incomplete-output'for p in paths))
    def test_empty_freeze_cannot_dispatch(self):
        freeze=runner.load(runner.ROOT/'artifacts/v2-development/freeze.json');freeze['file_digests']={};self.write('artifacts/v2-development/freeze.json',freeze)
        with self.assertRaisesRegex(RuntimeError,'incomplete_freeze'):runner.run_batch(lambda *args:self.fail('transport called'))
    def test_runtime_failure_preserved_no_inference(self):
        def fail(policy):raise RuntimeError('runtime_identity_mismatch')
        runner.run_batch(lambda *args:self.fail('transport called'),fail)
        out=runner.load(runner.ROOT/'artifacts/v2-development/batch-01/runtime-preflight.json');self.assertEqual(out['status'],'failed-before-inference');self.assertEqual(len(list((runner.ROOT/'artifacts/v2-development/batch-01/attempts').glob('*'))),0)
    def test_adapter_preserves_http_status_body_and_restores_opener(self):
        original=urllib.request.urlopen;saved_call=runner.adapter.transport.call
        def rejected(*args,**kwargs):raise urllib.error.HTTPError('http://localhost',400,'format rejected',{},io.BytesIO(b'{"error":"unsupported schema"}'))
        urllib.request.urlopen=rejected
        def fake(payload,record):return urllib.request.urlopen('http://localhost')
        runner.adapter.transport.call=fake;record={}
        try:
            with self.assertRaises(urllib.error.HTTPError):runner.adapter.call({},record)
            self.assertEqual(record['transport_failure']['status'],400);self.assertIn('unsupported schema',record['transport_failure']['body_text']);self.assertIs(urllib.request.urlopen,rejected)
        finally:urllib.request.urlopen=original;runner.adapter.transport.call=saved_call
if __name__=='__main__':unittest.main()
