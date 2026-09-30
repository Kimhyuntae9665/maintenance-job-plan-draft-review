import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parent
async def main():
    out=ROOT/'artifacts/media';out.mkdir(exist_ok=True);checks={};os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(ROOT/'private/browser-runtime')
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-gpu'])
        context=await browser.new_context(viewport={'width':1440,'height':1080},accept_downloads=True)
        page=await context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));await page.goto('http://127.0.0.1:5089');await expect(page.locator('#source-status')).to_contain_text('demo-r1');await page.screenshot(path=str(out/'scaffold-desktop.png'),full_page=True)
        await page.locator('#source-grid button').filter(has_text='00017').first.focus();await page.keyboard.press('Enter');await expect(page.locator('#cell-detail')).to_contain_text('exact raw span');checks['keyboard_exact_cell_navigation']=await page.locator('#original-source').evaluate('(el)=>el===document.activeElement')
        await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#receipt')).to_contain_text('REVIEWED_DRAFT')
        state=await (await context.request.get('http://127.0.0.1:5089/api/state')).json();fingerprint=state['receipts'][0]['receipt_fingerprint'];await page.locator('#review').click();state=await (await context.request.get('http://127.0.0.1:5089/api/state')).json();assert len(state['receipts'])==1 and state['receipts'][0]['receipt_fingerprint']==fingerprint;checks['repeated_immutable_receipt']=True
        async with page.expect_download() as download_info:await page.locator('#export').click()
        download=await download_info.value;await download.save_as(ROOT/'private/scaffold-reviewed-draft.json');draft=json.loads((ROOT/'private/scaffold-reviewed-draft.json').read_text());assert draft['local_export_acknowledgement']['target_import_receipt'] is None;checks['export_is_local_acknowledgement_only']=True
        # Second client admits a changed source while the first still displays
        # the old inspected proposal. The original button must not accept it.
        state=await (await context.request.get('http://127.0.0.1:5089/api/state')).json();old_source=state['sources'][0];changed=old_source['text'].replace('Monthly','500 operating hours',1)
        result=await context.request.post('http://127.0.0.1:5089/api/source',data={'expected_version':state['version'],'source':{'source_id':old_source['source_id'],'namespace':old_source['namespace'],'source_revision':'demo-r2','format':'tsv','text':changed}});assert result.status==200
        await page.locator('#review').click();await expect(page.locator('#message')).to_contain_text('confirm again');assert not await page.locator('#inspected').is_checked();assert await page.locator('#export').is_disabled();await expect(page.locator('#history')).to_contain_text('Historical review');await expect(page.locator('#trigger')).to_contain_text('operating_hour');checks['two_client_stale_requires_fresh_inspection']=True;await page.screenshot(path=str(out/'scaffold-stale-review.png'),full_page=True)
        # A same-revision different row is a retained conflict, not replacement.
        state=await (await context.request.get('http://127.0.0.1:5089/api/state')).json();latest=state['sources'][-1];different=latest['text'].replace('500 operating hours','Monthly',1)
        result=await context.request.post('http://127.0.0.1:5089/api/source',data={'expected_version':state['version'],'source':{'source_id':latest['source_id'],'namespace':latest['namespace'],'source_revision':'demo-r2','format':'tsv','text':different}});assert result.status==200
        await page.locator('#refresh').click();await expect(page.locator('#proposal-status')).to_have_text('CONFLICT');await expect(page.locator('#conflicts')).to_contain_text('conflicting values');assert await page.locator('#review').is_disabled();checks['same_revision_conflict_blocks_review']=True;await page.screenshot(path=str(out/'scaffold-conflict.png'),full_page=True)
        mobile=await browser.new_page(viewport={'width':390,'height':844});await mobile.goto('http://127.0.0.1:5089');await expect(mobile.locator('#source-status')).to_contain_text('demo-r2');assert await mobile.evaluate('document.documentElement.scrollWidth')==390
        checks['mobile_viewport']=390;checks['mobile_document_width']=await mobile.evaluate('document.documentElement.scrollWidth');checks['minimum_meaningful_text_px']=await mobile.evaluate("Math.min(...[...document.querySelectorAll('th,td,button,p,label,summary')].filter(el=>el.getBoundingClientRect().width&&el.textContent.trim()).map(el=>parseFloat(getComputedStyle(el).fontSize)))")
        assert checks['minimum_meaningful_text_px']>=14;checks['source_grid_scrolls_without_viewport_shrink']=await mobile.locator('.grid-scroll').first.evaluate('(el)=>el.scrollWidth>el.clientWidth');assert checks['source_grid_scrolls_without_viewport_shrink'];await mobile.screenshot(path=str(out/'scaffold-mobile-390.png'),full_page=True);await mobile.close();await context.close();await browser.close();assert not errors
    (ROOT/'artifacts/scaffold-browser-checks.json').write_text(json.dumps({'kind':'Actual CPU engineering checks of scaffold examples; not fixture evaluation','browser':'installed Chrome with CPU rendering','model_calls':0,'evaluation_results':None,'checks':checks,'page_errors':errors},indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
