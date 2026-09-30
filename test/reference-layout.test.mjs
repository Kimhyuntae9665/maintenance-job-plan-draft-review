import test from 'node:test';
import assert from 'node:assert/strict';
import {createReferenceDesk} from '../ui/reference-layout/server.mjs';
test('reference presentation delegates original source-bound decision APIs',async()=>{
 const server=createReferenceDesk();await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 try{const origin=`http://127.0.0.1:${server.address().port}`;
  const html=await(await fetch(origin)).text();assert.match(html,/정비 계획 초안 검토/);assert.match(html,/id="source-grid"/);assert.match(html,/id="field-diff"/);
  const state=await(await fetch(origin+'/api/state')).json();assert.equal(state.counts.captures,15);assert.equal(state.receipts.length,0);
  const denied=await fetch(origin+'/api/review',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_version:state.version,source_record_id:state.opened,inspected:true})});assert.equal(denied.status,409);
  const after=await(await fetch(origin+'/api/state')).json();assert.equal(after.receipts.length,0);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
