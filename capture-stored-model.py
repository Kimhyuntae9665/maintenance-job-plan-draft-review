import asyncio,json
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parent;URL='http://127.0.0.1:5089'
async def main():
    checks={};out=ROOT/'artifacts/media'
    async with async_playwright() as p:
        browser=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-gpu']);page=await browser.new_page(viewport={'width':1440,'height':1080});await page.goto(URL);await expect(page.locator('#counts')).to_contain_text('15 admitted captures')
        await page.locator('[data-open="PM004"]').click();await expect(page.locator('#model-status')).to_contain_text('REJECTED_BY_RULES');await page.locator('#inspect-model').click();await expect(page.locator('#correction')).to_be_focused();await page.locator('#inspected').check();assert await page.locator('#review').is_disabled();checks['rejected_stored_candidate_cannot_be_accepted']=True
        await page.locator('#reason').fill('Restore exact source-supported interval');await page.locator('#correct').click();await expect(page.locator('#message')).to_contain_text('not supported by exact source cells');checks['unsupported_model_fields_correction_rejected']=True
        await page.locator('#model-status').scroll_into_view_if_needed();await page.screenshot(path=str(out/'packet-stored-model-rejection.png'),full_page=True)
        await page.locator('#restore-rule').click();await expect(page.locator('#trigger')).to_contain_text('month');await page.locator('#correct').click();await expect(page.locator('#binding')).to_contain_text('proposal r2');assert not await page.locator('#inspected').is_checked();assert await page.locator('#review').is_disabled();await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#proposal-status')).to_have_text('ACCEPTED NORMALIZATION');checks['restore_validate_and_fresh_manual_inspection']=True
        await page.locator('#reason').fill('Return for another inspection');await page.locator('#return').click();await expect(page.locator('#proposal-status')).to_have_text('RETURNED FOR CLARIFICATION');await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#proposal-status')).to_have_text('ACCEPTED NORMALIZATION');checks['returned_then_explicitly_accepted_status_consistent']=True
        details=page.locator('details').filter(has=page.locator('#revision'));await details.locator('summary').click();await page.locator('#revision').fill('A-stored-demo-2');await page.locator('#changed-value').fill('매월');await page.locator('#source-change').click();await expect(page.locator('#model-status')).to_contain_text('ARCHIVED_STALE');assert await page.locator('#inspect-model').is_disabled();await expect(page.locator('#model-raw')).not_to_contain_text('source_record_id');checks['source_revision_removes_cached_model_contents']=True
        await page.screenshot(path=str(out/'packet-stored-model-stale.png'),full_page=True);await browser.close()
    (ROOT/'artifacts/stored-model-browser-checks.json').write_text(json.dumps({'kind':'Actual CPU-rendered replay of stored frozen Qwen attempts; no additional inference','additional_model_calls':0,'checks':checks},indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
