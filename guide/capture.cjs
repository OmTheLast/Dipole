// Use the public data shipped with Dipole; the single visitor role needs no credentials.
const {chromium} = require('playwright');
const fs = require('node:fs');
const path = require('node:path');
const [base, output] = process.argv.slice(2);
const HERO_FLOW = ['visitor/02-atlantic', 'visitor/05-period'];
const routes = [
  // The last field is wait_ms. These routes have observable readiness signals.
  ['01-arctic','browser','?start=1980','#details,.maparea,#mapReading',0],
  ['02-atlantic','browser','?start=1900','#details,.maparea,#mapReading',0],
  ['03-people','browser','?start=1980&country=IND','#population .chapterhead,#countryBarCaption,#exposureRows',0],
  ['04-water','browser','water/','#waterReading,.linkedViews',0],
  ['05-period','browser','?start=1900','#details',0],
  ['06-year','browser','?tour=start','#scrubber,.maparea,#mapReading',0],
  ['07-neighbour','browser','water/','#waterReading,.linkedViews',0],
];

async function run() {
  const browser = await chromium.launch(process.env.CHROME_CHANNEL ? {channel:process.env.CHROME_CHANNEL} : {});
  let successes = 0;
  try {
    const page = await browser.newPage({viewport:{width:1200,height:850},deviceScaleFactor:2,reducedMotion:'reduce'});
    let messages = [];
    page.on('pageerror', e => messages.push('error: ' + e.message));
    page.on('console', m => { if (['warning','error'].includes(m.type())) messages.push(m.type() + ': ' + m.text()); });
    const dir = path.join(output,'screenshots','visitor');
    fs.mkdirSync(dir,{recursive:true});
    for (const [id,backend,target,scene,wait] of routes) {
      messages = [];
      await page.goto(new URL(target, base).href,{waitUntil:'load'});
      if (target.startsWith('water')) {
        await page.waitForFunction(() => !waterData.hidden && mapMessage.hidden);
        if (await page.locator('.guide [data-skip]').isVisible()) await page.locator('.guide [data-skip]').click();
        await page.locator('[data-year="2025"]').click();
        if (id === '07-neighbour') await page.locator('#waterComparison').selectOption('uttar_pradesh');
        await page.waitForFunction(() => waterChart.complete && waterChart.naturalWidth && mapTitle.textContent.startsWith('2025'));
      } else {
        await page.waitForFunction(() => document.body.dataset.explorerReady);
        if (id === '01-arctic') await page.locator('[data-case=arctic]').click();
        if (id === '02-atlantic' || id === '05-period') {
          await page.locator('[data-case=hole]').click();
          if (id === '05-period') await page.locator('[data-start="1980"]').click();
        }
        if (id === '06-year') {
          await page.locator('#year.guideTarget').waitFor();
          await page.locator('[data-skip]').click();
          await page.locator('#year').fill('2015');
        }
      }
      const expected = {
        '01-arctic':['#rate','+0.69'], '02-atlantic':['#change','−0.09'],
        '03-people':['#countryFasterLabel','52.4%'], '04-water':['#waterReading','32.5 cm'],
        '05-period':['#interval','−0.11'], '06-year':['#readingText','2015'],
        '07-neighbour':['#waterReading','−6.3 cm']
      }[id];
      await page.waitForFunction(([selector,reading])=>document.querySelector(selector).textContent.includes(reading), expected);
      await page.evaluate(()=>document.fonts.ready);
      await page.waitForFunction(()=>[...document.images].every(i=>i.complete && i.naturalWidth) &&
        document.getAnimations().every(a=>a.playState!=='running'||a.effect?.getComputedTiming().endTime===Infinity));
      if(wait) await page.waitForTimeout(wait);
      const clip = await page.locator(scene).evaluateAll(nodes=>{
        const boxes=nodes.map(n=>n.getBoundingClientRect());
        const x=Math.floor(Math.min(...boxes.map(b=>b.left))+scrollX), y=Math.floor(Math.min(...boxes.map(b=>b.top))+scrollY);
        return {x,y,width:Math.ceil(Math.max(...boxes.map(b=>b.right))+scrollX)-x,height:Math.ceil(Math.max(...boxes.map(b=>b.bottom))+scrollY)-y};
      });
      if(clip.width<150 || clip.height<45) throw Error('Empty capture: '+id);
      await page.screenshot({path:path.join(dir,id+'.png'),clip,fullPage:true});
      if(messages.length) console.warn(id,messages);
      if(messages.some(m=>m.startsWith('error:'))) throw Error('Browser error on '+id);
      console.log(backend,id,clip.width,clip.height,messages.length+' console messages'); successes++;
    }
    console.log(successes+'/'+routes.length+' captures. Hero flow: '+HERO_FLOW.join(' → '));
  } finally { await browser.close(); }
}
run().catch(e=>{console.error(e);process.exitCode=1});
