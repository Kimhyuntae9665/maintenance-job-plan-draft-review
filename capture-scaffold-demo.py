import asyncio,json,os
from pathlib import Path
from playwright.async_api import async_playwright,expect
ROOT=Path(__file__).resolve().parent
async def main():
    os.environ['PLAYWRIGHT_BROWSERS_PATH']=str(ROOT/'private/browser-runtime')
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-gpu'])
        ctx=await b.new_context(viewport={'width':1440,'height':1080},record_video_dir=str(ROOT/'private/scaffold-video'),record_video_size={'width':1440,'height':1080});page=await ctx.new_page();await page.goto('http://127.0.0.1:5089');await expect(page.locator('#source-status')).to_contain_text('demo-r1');await page.wait_for_timeout(2200)
        await page.locator('#source-grid button').filter(has_text='00017').first.click();await expect(page.locator('#cell-detail')).to_contain_text('exact raw span');await page.wait_for_timeout(1800);await page.locator('#original-source').locator('..').evaluate('(el)=>el.open=false')
        await page.locator('#source-grid').scroll_into_view_if_needed();await page.wait_for_timeout(1000);await page.locator('.review-workspace').scroll_into_view_if_needed();await page.wait_for_timeout(2100);await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#receipt')).to_contain_text('REVIEWED_DRAFT');await page.wait_for_timeout(1800)
        values=await page.locator('#row-select option').evaluate_all('(els)=>els.map(el=>({value:el.value,label:el.textContent}))');third=next(x['value'] for x in values if 'demo-3' in x['label']);await page.locator('#row-select').select_option(third);await expect(page.locator('#trigger')).to_contain_text('event_trigger');await page.locator('.review-workspace').scroll_into_view_if_needed();await page.wait_for_timeout(2300);await page.locator('#inspected').check();await page.locator('#review').click();await expect(page.locator('#receipt')).to_contain_text('REVIEWED_WITH_UNRESOLVED_FIELDS');await page.wait_for_timeout(2200)
        await ctx.close();videos=sorted((ROOT/'private/scaffold-video').glob('*.webm'),key=lambda x:x.stat().st_mtime);(ROOT/'artifacts/media/scaffold-review.webm').write_bytes(videos[-1].read_bytes());await b.close()
    (ROOT/'artifacts/scaffold-video-provenance.json').write_text(json.dumps({'kind':'Actual CPU browser-automated scaffold demonstration; not fixture evaluation','model_calls':0,'evaluation_results':None,'fictional_examples':4,'semantic_acceptance':'automated synthetic inspection; not independent domain adjudication','cases_shown':['demo-1','demo-3'],'unresolved_event_retained':True,'target_system_import':False,'maintenance_authorization':False},indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
