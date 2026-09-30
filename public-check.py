import asyncio,json,subprocess
from pathlib import Path
from playwright.async_api import async_playwright
ROOT=Path(__file__).resolve().parent
URL='https://github.com/Kimhyuntae9665/maintenance-job-plan-draft-review'
async def main():
    commit=subprocess.check_output(['git','rev-parse','HEAD'],cwd=ROOT,text=True).strip();published=URL+'/tree/'+commit;checks=[]
    async with async_playwright() as p:
        b=await p.chromium.launch(executable_path='/usr/bin/google-chrome',headless=True,args=['--no-sandbox','--disable-gpu'])
        for width in [360,390,1440]:
            page=await b.new_page(viewport={'width':width,'height':1000});response=await page.goto(published,wait_until='domcontentloaded',timeout=60000);images=[]
            for name,selector in [('diagram','article img[alt^="Original source text"]'),('sourceGrid','article img[alt^="Actual CPU scaffold"]')]:
                img=page.locator(selector);await img.wait_for();await img.scroll_into_view_if_needed();await img.evaluate('(el)=>el.decode()');data=await img.evaluate('(el)=>({loaded:el.complete&&el.naturalWidth>0,naturalWidth:el.naturalWidth,naturalHeight:el.naturalHeight,displayWidth:el.getBoundingClientRect().width})');assert response.status==200 and data['loaded'] and data['displayWidth']<=width;images.append({'kind':name,**data})
            await page.screenshot(path=str(ROOT/f'artifacts/media/published-scaffold-{width}.png'));checks.append({'width':width,'http_status':response.status,'images':images});await page.close()
        await b.close()
    (ROOT/'artifacts/published-scaffold-checks.json').write_text(json.dumps({'repository':URL,'published_commit':commit,'checked_url':published,'kind':'Actual CPU published-image loading; not fixture evaluation','model_calls':0,'checks':checks},indent=2)+'\n')
if __name__=='__main__':asyncio.run(main())
