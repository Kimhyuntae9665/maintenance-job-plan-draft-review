const $=id=>document.getElementById(id);let generation=0;
// Selection buttons stay mounted: Tab/Enter focus survives all comparison renders.
for(const button of document.querySelectorAll('[data-id]'))button.addEventListener('click',async()=>{
  const current=++generation;
  for(const b of document.querySelectorAll('[data-id]'))b.setAttribute('aria-pressed',String(b===button));
  $('status').textContent='Loading '+button.dataset.id+'…';$('panel').hidden=true;
  try{
    const response=await fetch('/api/case?id='+encodeURIComponent(button.dataset.id)),data=await response.json();
    if(current!==generation)return;if(!response.ok)throw Error(data.error??'Request failed');
    $('case-title').textContent=data.case.source_record_id+' · '+data.version;
    $('quote').textContent=data.case.evidence.quote;
    $('locator').textContent=JSON.stringify({fingerprint:data.case.source_fingerprint,locator:data.case.source_locator,evidence:data.case.evidence},null,2);
    $('state').textContent=data.parse_error??data.backend.suggestion_state;
    $('raw').textContent=data.raw_model_content??'No stored output. Not attempted.';
    $('backend').textContent=JSON.stringify(data.backend,null,2);$('panel').hidden=false;
    $('status').textContent=data.case.source_record_id+' loaded · '+data.attempt_status+' · semantic review required';
  }catch(error){if(current===generation)$('status').textContent='Load failed: '+error.message;}
});
