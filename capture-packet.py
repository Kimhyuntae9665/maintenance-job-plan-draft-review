import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parent;URL='http://127.0.0.1:5089'
def binding(p):return {k:p[k] for k in ['source_record_id','source_fingerprint','proposal_sha256','normalized_content_sha256']}
async def main():
    out=ROOT/'artifacts/media';out.mkdir(exist_ok=True);checks={};errors=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-gpu'])
        context=await browser.new_context(viewport={'width':1440,'height':1080},accept_downloads=True)
        page=await context.new_page();page.on('pageerror',lambda e:errors.append(str(e)));await page.goto(URL);await expect(page.locator('#counts')).to_contain_text('15 admitted captures');await page.screenshot(path=str(out/'packet-desktop.png'),full_page=True)
        # Actual Tab then Enter opens a row; recreated control remains the destination.
        await page.locator('[data-select="PM002"]').focus();await page.keyboard.press('Tab');assert await page.locator('[data-open="PM002"]').evaluate('(el)=>el===document.activeElement');await page.keyboard.press('Enter');await expect(page.locator('#opened-title')).to_contain_text('PM002');await expect(page.locator('[data-open="PM002"]')).to_be_focused();checks['tab_enter_open_focus_restored']=True
        await page.locator('[data-cell="frequency_text"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#cell-detail')).to_contain_text('lexical_span');await expect(page.locator('#cell-detail')).to_be_focused();checks['exact_cell_keyboard_destination']=True
        await page.locator('#inspected').check();await page.locator('#review').focus();await page.keyboard.press('Enter');await expect(page.locator('#receipt')).to_contain_text('current accepted');await expect(page.locator('#review')).to_be_focused();checks['review_keyboard_focus_restored']=True
        s=await (await context.request.get(URL+'/api/state')).json();old_receipt=s['receipts'][0]['receipt_sha256'];await page.locator('#review').click();s=await (await context.request.get(URL+'/api/state')).json();assert len(s['receipts'])==1 and s['receipts'][0]['receipt_sha256']==old_receipt;checks['repeated_review_idempotent']=True
        await page.locator('[data-select="PM002"]').check();await expect(page.locator('#export-count')).to_have_text('1 selected rows');await expect(page.locator('#export-rows')).to_have_text('Exact capture IDs: PM002');
        async with page.expect_download() as d:await page.locator('#export').click()
        download=await d.value;await download.save_as(ROOT/'private/packet-reviewed-draft.json');draft=json.loads((ROOT/'private/packet-reviewed-draft.json').read_text());assert draft['source_record_ids']==['PM002'] and draft['row_count']==1 and draft['target_import_receipt'] is None and draft['normalization_rows'][0]['evidence'];checks['exact_one_row_draft_with_cell_evidence_not_import']=True
        await page.locator('#site').select_option('PLANT-B');await expect(page.locator('#export-count')).to_have_text('0 selected rows');assert await page.locator('#export').is_disabled();checks['filter_removes_hidden_export_scope']=True
        await page.locator('#site').select_option('ALL');await page.locator('[data-open="PM002"]').click();await expect(page.locator('#opened-title')).to_contain_text('PM002');await page.locator('#inspected').check()
        s=await (await context.request.get(URL+'/api/state')).json();r=await context.request.post(URL+'/api/regenerate',data={'expected_version':s['version'],**binding(s['proposal'])});assert r.status==200
        await page.locator('#review').click();await expect(page.locator('#message')).to_contain_text('STALE_CLIENT_STATE');assert not await page.locator('#inspected').is_checked();await expect(page.locator('#receipt')).to_contain_text('No current acceptance');await page.screenshot(path=str(out/'packet-stale-review.png'),full_page=True);checks['two_client_changed_proposal_rejected_no_reacceptance']=True
        # A later explicit focus choice wins while a controlled response is delayed.
        entered=asyncio.Event();release=asyncio.Event()
        async def delayed(route):
            response=await route.fetch();entered.set();await release.wait();await route.fulfill(response=response)
        await page.route('**/api/open',delayed);await page.locator('[data-open="PM004"]').click();await entered.wait();await page.locator('.grid-scroll').first.focus();release.set();await expect(page.locator('#opened-title')).to_contain_text('PM004');await expect(page.locator('.grid-scroll').first).to_be_focused();await page.unroute('**/api/open',delayed);checks['delayed_response_preserves_later_explicit_focus']=True
        await page.locator('[data-cell="frequency_text"]').click();await expect(page.locator('#cell-detail')).to_contain_text('PM004');await page.locator('[data-open="PM005"]').click();await expect(page.locator('#cell-detail')).not_to_contain_text('PM004');await expect(page.locator('#proposal-status')).to_have_text('BLOCKED');assert await page.locator('#review').is_disabled();await page.screenshot(path=str(out/'packet-blocked-event.png'),full_page=True);checks['changed_row_clears_cached_cell_evidence']=True
        await page.route('**/api/open',lambda route:route.abort());await page.locator('[data-open="PM006"]').focus();await page.keyboard.press('Enter');await expect(page.locator('#message')).to_contain_text('REQUEST_FAILED');await expect(page.locator('[data-open="PM006"]')).to_be_focused();await page.unroute('**/api/open');checks['failed_request_retains_keyboard_destination']=True
        mobile=await browser.new_page(viewport={'width':390,'height':844});await mobile.goto(URL);await expect(mobile.locator('#counts')).to_contain_text('15 admitted captures');assert await mobile.evaluate('document.documentElement.scrollWidth')==390
        minimum=await mobile.evaluate("Math.min(...[...document.querySelectorAll('th,td,button,p,label,summary')].filter(el=>el.getBoundingClientRect().width&&el.textContent.trim()).map(el=>parseFloat(getComputedStyle(el).fontSize)))");assert minimum>=14;assert await mobile.locator('.grid-scroll').first.evaluate('(el)=>el.scrollWidth>el.clientWidth');checks['mobile']={'viewport':390,'document_width':390,'minimum_meaningful_text_px':minimum,'native_scrollable_grid':True};await mobile.screenshot(path=str(out/'packet-mobile-390.png'),full_page=True)
        await mobile.close();await context.close();await browser.close()
    assert not errors
    (ROOT/'artifacts/packet-browser-checks.json').write_text(json.dumps({'kind':'Actual installed Chrome CPU workflow regressions, not extraction evaluation','model_calls':0,'checks':checks,'page_errors':errors},indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
