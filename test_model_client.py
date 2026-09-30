"""CPU mocks only: no model, real runtime lock or network calls."""
import unittest,tempfile,os,socket,json
from pathlib import Path
from unittest.mock import patch
import model_client as client
class TransportTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();directory=Path(self.tmp.name);os.chmod(directory,0o700)
        self.original=(client.LOCK,client.BLOCKED);client.LOCK=directory/'inference.lock';client.BLOCKED=directory/'inference.lock.blocked'
    def tearDown(self):client.LOCK,client.BLOCKED=self.original;self.tmp.cleanup()
    def test_payload_is_bounded_and_source_text_is_not_code(self):
        case={'case_id':'synthetic','source_fingerprint':'abc','cells':[{'quote':'=INERT()'}]};p=client.payload_for(case)
        self.assertEqual(p['options'],{'num_ctx':4096,'num_predict':640,'temperature':0,'seed':42});self.assertFalse(p['stream']);self.assertFalse(p['think']);self.assertFalse(p['truncate']);self.assertFalse(p['shift']);self.assertEqual(json.loads(p['messages'][1]['content']),case)
    def test_timeout_persists_barrier_and_next_call_never_requests(self):
        record={}
        with patch.object(client.urllib.request,'urlopen',side_effect=socket.timeout):
            with self.assertRaisesRegex(RuntimeError,'model_timeout_shared_runtime_blocked'):client.call({},record)
        self.assertTrue(record['httpRequestAttempted']);self.assertTrue(client.BLOCKED.exists())
        with patch.object(client.urllib.request,'urlopen') as request:
            with self.assertRaisesRegex(RuntimeError,'inference_blocked_after_timeout'):client.call({})
            request.assert_not_called()
    def test_busy_shared_lock_never_requests(self):
        import fcntl
        with client.LOCK.open('w') as held:
            os.chmod(client.LOCK,0o600);fcntl.flock(held,fcntl.LOCK_EX|fcntl.LOCK_NB)
            with patch.object(client.urllib.request,'urlopen') as request:
                with self.assertRaisesRegex(RuntimeError,'inference_busy'):client.call({})
                request.assert_not_called()
    def test_unsafe_permissions_never_request(self):
        client.LOCK.touch();os.chmod(client.LOCK,0o666)
        with patch.object(client.urllib.request,'urlopen') as request:
            with self.assertRaisesRegex(RuntimeError,'unsafe_inference_lock_file'):client.call({})
            request.assert_not_called()
if __name__=='__main__':unittest.main()
