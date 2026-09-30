"""Three actual-browser capture corrections. No inference or semantic changes."""
import asyncio,json,os,subprocess,urllib.request,hashlib
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parent
async def main():
 out=ROOT/'artifacts/ui-refit';server=subprocess.Popen(['node','ui/reference-layout/server.mjs'],cwd=ROOT,env=dict(os.environ,P09_REFIT_PORT='5199'),stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
 try:
  for _ in range(40):
   try:urllib.request.urlopen('http://127.0.0.1:5199',timeout=1).close();break
   except Exception:await asyncio.sleep(.1)
  async with async_playwright()as p:
   b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',args=['--no-sandbox','--disable-gpu']);page=await b.new_page(viewport={'width':1440,'height':1900});await page.goto('http://127.0.0.1:5199');await expect(page.locator('#counts')).to_contain_text('15 admitted captures')
   await page.locator('[data-open=PM001]').click();await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#receipt')).to_contain_text('current accepted');await page.evaluate('scrollTo(0,0)')
   receipt=await page.locator('#receipt').bounding_box();assert receipt['y']>=0 and receipt['y']+receipt['height']<=1900
   await page.screenshot(path=str(out/'03-accepted-normalization.png'))
   await page.locator('[data-open=PM003]').click();await expect(page.locator('#model-validation')).to_contain_text('UNSUPPORTED_NORMALIZED_FIELDS')
   await page.set_viewport_size({'width':1440,'height':1100});await page.locator('#stored-panel').evaluate("el=>el.scrollIntoView({block:'start'})")
   validation=await page.locator('#model-validation').evaluate('el=>{let b=el.getBoundingClientRect(),p=el.parentElement.getBoundingClientRect();return {left:b.left,right:b.right,top:b.top,bottom:b.bottom,parent_left:p.left,parent_right:p.right,scroll_width:el.parentElement.scrollWidth,client_width:el.parentElement.clientWidth}}');assert validation['left']>=validation['parent_left']and validation['right']<=validation['parent_right']+1 and validation['top']>=0 and validation['bottom']<=1100
   await page.screenshot(path=str(out/'06-stored-rejection-fields.png'))
   await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#receipt')).to_contain_text('current accepted')
   await page.locator('#changed-column').evaluate("el=>el.closest('details').open=true");await page.locator('#changed-value').fill('매월');await page.locator('#source-change').click();await expect(page.locator('#source-heading')).to_contain_text('revision A-demo-2');await expect(page.locator('#model-status')).to_contain_text('Historical stored output; original source revision A');await expect(page.locator('#history')).to_contain_text('Historical normalization receipt');assert await page.locator('#inspect-model').is_disabled()
   await page.evaluate('scrollTo(0,0)');await page.screenshot(path=str(out/'07-current-and-historical-revision.png'),full_page=True)
   historical={'current_source':await page.locator('#source-heading').inner_text(),'current_acceptance':await page.locator('#receipt').inner_text(),'model_status':await page.locator('#model-status').inner_text(),'receipt_history':await page.locator('#history').inner_text(),'document_height':await page.evaluate('document.documentElement.scrollHeight')}
   mobile=await b.new_page(viewport={'width':390,'height':844});await mobile.goto('http://127.0.0.1:5199');await expect(mobile.locator('#model-validation')).to_contain_text('ARCHIVED_STALE');assert await mobile.evaluate('document.documentElement.scrollWidth')==390;assert await mobile.locator('#model-validation').evaluate('el=>el.offsetWidth<=el.parentElement.clientWidth+1');await mobile.close()
   proof={'kind':'Targeted actual Chrome capture framing corrections','additional_model_calls':0,'executed_in_CI':False,'accepted_receipt_fully_inside_capture':receipt,'validation_table_fully_inside_capture':validation,'historical_full_page':historical,'mobile_390_no_horizontal_clip':True,'capture_script_sha256':hashlib.sha256(Path(__file__).read_bytes()).hexdigest(),'changed_images':['03-accepted-normalization.png','06-stored-rejection-fields.png','07-current-and-historical-revision.png']}
   manifest=json.loads((out/'asset-provenance.json').read_text());unchanged=[]
   for asset in manifest['assets']:
    path=ROOT/asset['path'];sha=hashlib.sha256(path.read_bytes()).hexdigest()
    if path.name in proof['changed_images']:asset.update(bytes=path.stat().st_size,sha256=sha)
    else:assert asset['sha256']==sha and asset['bytes']==path.stat().st_size;unchanged.append(asset['path'])
   proof['unchanged_media_verified']=unchanged;manifest['targeted_capture_proof']='artifacts/ui-refit/capture-framing-checks.json';(out/'asset-provenance.json').write_text(json.dumps(manifest,indent=2)+'\n');(out/'capture-framing-checks.json').write_text(json.dumps(proof,indent=2)+'\n');print(json.dumps(proof))
   await b.close()
 finally:server.terminate();server.wait(timeout=5)
asyncio.run(main())
