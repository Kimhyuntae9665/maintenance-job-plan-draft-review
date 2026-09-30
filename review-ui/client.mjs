import {reviewView} from './view-state.mjs';
import {frequencySummary} from '../ui-evidence.mjs';
const $=id=>document.getElementById(id);let generation=0;
// Mounted controls and no response-driven focus: a later explicit choice always wins.
$('inspect-source').onclick=()=>$('locator').focus();
for(const button of document.querySelectorAll('[data-id]'))button.addEventListener('click',async()=>{
  const current=++generation,id=button.dataset.id;
  for(const b of document.querySelectorAll('[data-id]'))b.setAttribute('aria-pressed',String(b===button));
  $('status').textContent='Loading '+id+'…';$('panel').hidden=true;
  try{
    const response=await fetch('/api/case?id='+encodeURIComponent(id)),data=await response.json();
    if(current!==generation)return;if(!response.ok)throw Error(data.error??'Request failed');
    const view=reviewView(data,id);
    $('case-title').textContent=id+' · '+data.version;
    $('quote').textContent=data.case.evidence.quote;
    $('locator').textContent=JSON.stringify({fingerprint:data.case.source_fingerprint,locator:data.case.source_locator,evidence:data.case.evidence},null,2);
    $('state').textContent=view.state;$('meaning').textContent=view.message;$('raw').textContent=view.raw;
    $('frequency-summary').textContent=view.reviewable?frequencySummary(view.frequency):'No current typed suggestion is available for semantic inspection.';
    $('backend').textContent=JSON.stringify(data.backend,null,2);$('panel').hidden=false;
    $('status').textContent=id+' · '+data.attempt_status+' · '+(view.reviewable?'semantic inspection required; no acceptance':'no reviewable suggestion');
  }catch(error){if(current===generation)$('status').textContent='Load failed: '+error.message;}
});
