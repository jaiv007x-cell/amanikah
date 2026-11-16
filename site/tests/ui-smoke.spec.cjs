const { test, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:8765';
test('homepage hierarchy, video user control and CTA', async ({ page }) => {
  test.setTimeout(50000);
  await page.goto(base + '/');
  await expect(page.locator('main h1')).toContainText('A simple, respectful start');
  await expect(page.locator('a[href="/account/register.html"]').first()).toBeVisible();
  const video = page.locator('#storyHeroVideo');
  await expect(video).toBeVisible();
  await expect.poll(() => video.evaluate(v => !v.paused), { timeout: 12000 }).toBe(true);
  console.log('FILM STEP autoplay running');
  await page.locator('#storyHeroPause').click({timeout:5000});
  await expect.poll(() => video.evaluate(v => v.paused)).toBe(true);
  console.log('FILM STEP manual pause remains respected');
  console.log('FILM STEP modal open');
  await page.locator('[data-open-film]').last().click({timeout:5000});
  await expect(page.locator('#storyClose')).toBeVisible();
  expect(await page.locator('#storySceneVideo').evaluate(v => v.paused)).toBe(true);
  console.log('FILM STEP modal close');
  await page.locator('#storyClose').click({timeout:5000});
  expect(await video.evaluate(v => v.paused)).toBe(true);
});
for (const width of [320,375,390,768,1024,1440]) {
  test('homepage has no horizontal overflow at ' + width, async ({page}) => {
    await page.setViewportSize({width, height:850});
    await page.goto(base + '/');
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(2);
    await page.screenshot({path:'test-results/home-' + width + '.png', fullPage: false});
  });
}
test('free family guide renders three language choices without an account', async ({page}) => {
  await page.goto(base + '/family-guide/');
  await page.locator('#topic').selectOption('family');
  await page.locator('#language').selectOption('en');
  await page.locator('#generate').click();
  await expect(page.locator('#output')).toContainText('family');
  await page.locator('#language').selectOption('ur');
  await page.locator('#generate').click();
  await expect(page.locator('#output')).not.toBeEmpty();
  await expect(page.locator('#output')).toHaveAttribute('dir','rtl');
});
test('family studio refuses to expose tools when logged out', async ({page}) => {
  await page.goto(base + '/account/family.html');
  await expect(page.locator('#studio')).toBeHidden();
  await expect(page.locator('#waliForm')).toHaveCount(1);
  await expect(page.locator('#scopeWali')).toHaveCount(1);
  await expect(page.locator('#globalStatus')).toContainText('sign in');
});
test('public quiz and pledge routes load', async ({page}) => {
  await page.goto(base + '/simple-nikah/');
  await expect(page.locator('main')).toBeVisible();
  await page.goto(base + '/nikah-readiness/');
  await expect(page.locator('main')).toBeVisible();
});

test('short homepage keeps the main journey, NRI target and simple free tools', async ({page}) => {
  await page.goto(base + '/');
  await expect(page.locator('#nri')).toHaveCount(1);
  await expect(page.locator('#approach .home-step')).toHaveCount(3);
  await expect(page.locator('#experiences .home-tool')).toHaveCount(2);
  await expect(page.locator('#trust')).toHaveCount(1);
  await expect(page.locator('#questions details')).toHaveCount(3);
  await expect(page.locator('main section')).toHaveCount(6);
  await expect(page.locator('a[href="/account/register.html"]').first()).toBeVisible();
  await expect(page.locator('#experiences')).toContainText('No payment needed');
  expect(await page.evaluate(() => [...document.querySelectorAll('a[href^="/#"]')]
     .every(a => document.querySelector(a.getAttribute('href').slice(1))))).toBe(true);
  const words = await page.locator('main').evaluate(el => el.textContent.trim().split(/\s+/).length);
  expect(words).toBeLessThan(650);
});
test('live marketing pages offer real accounts without stale demo copy', async ({page}) => {
  for(const p of ['/simple-nikah/','/nikah-readiness/','/account/register.html','/account/login.html']) {
    await page.goto(base+p);
    await expect(page.locator('body')).not.toContainText('Registration is still device-local until accounts exist');
    await expect(page.locator('body')).not.toContainText('Demo registration at /register');
    await expect(page.locator('link[href*="clarity-2026.css"]')).toHaveCount(1);
  }
});
test('pricing page exposes real free choice and clearly marks example paid prices',async({page})=>{
  await page.goto(base + '/pricing/');
  await expect(page.locator('h1')).toContainText('Start for free');
  await expect(page.locator('#free-membership')).toBeVisible();
  await expect(page.locator('main')).toContainText('indicative test prices');
  await expect(page.locator('main')).toContainText('Paid services are not being sold yet');
});
test('42-second film autoplays silently at natural speed and remains controllable',async({page})=>{
  await page.goto(base + '/');
  const v=page.locator('#storyHeroVideo');
  await expect.poll(() => v.evaluate(n=>n.readyState >= 1), {timeout:12000}).toBe(true);
  const settings=await v.evaluate(n=>({
    autoplay:n.autoplay,muted:n.muted,loop:n.loop,rate:n.playbackRate,duration:n.duration,
    src:n.currentSrc
  }));
  expect(settings.autoplay).toBe(true);
  expect(settings.muted).toBe(true);
  expect(settings.loop).toBe(true);
  expect(settings.rate).toBe(1);
  expect(settings.duration).toBeGreaterThan(41);
  expect(settings.duration).toBeLessThan(43);
  expect(settings.src).toContain('amanikah-story-42s.mp4');
  await expect.poll(()=>v.evaluate(n=>!n.paused),{timeout:12000}).toBe(true);
  await expect(page.locator('#storyHeroPause')).toContainText('Pause film');
  await page.locator('#storyHeroPause').click();
  await expect.poll(()=>v.evaluate(n=>n.paused)).toBe(true);
  await page.reload();
  await expect.poll(()=>v.evaluate(n=>n.paused)).toBe(true);
  await expect(page.locator('#storyHeroPause')).toContainText('Play film');
  await expect(page.locator('a[href="/nikah-readiness/"]').first()).toBeVisible();
});
test('reduced-motion visitors see poster until they choose to play',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(base+'/');
  const v=page.locator('#storyHeroVideo');
  expect(await v.evaluate(n=>n.autoplay)).toBe(false);
  expect(await v.evaluate(n=>n.paused)).toBe(true);
  await page.locator('#storyHeroPause').click();
  await expect.poll(()=>v.evaluate(n=>!n.paused),{timeout:12000}).toBe(true);
});
test('autoplay pauses out of view and resumes only when appropriate',async({page})=>{
  await page.goto(base+'/');
  const v=page.locator('#storyHeroVideo');
  await expect.poll(()=>v.evaluate(n=>!n.paused),{timeout:12000}).toBe(true);
  await page.locator('#questions').scrollIntoViewIfNeeded();
  await expect.poll(()=>v.evaluate(n=>n.paused),{timeout:7000}).toBe(true);
  await v.scrollIntoViewIfNeeded();
  await expect.poll(()=>v.evaluate(n=>!n.paused),{timeout:12000}).toBe(true);
});

test('homepage uses short, welcoming language without false live claims', async ({page}) => {
  await page.goto(base + '/');
  await expect(page.locator('h1')).toContainText('Nikah');
  await expect(page.locator('#approach')).toContainText('There is no rush');
  await expect(page.locator('#trust')).toContainText('Your choice matters');
  await expect(page.locator('#questions')).toContainText('Not yet');
  await expect(page.locator('.home-free a[href="/simple-nikah/"]')).toBeVisible();
  await expect(page.locator('.home-free a[href="/nikah-readiness/"]')).toBeVisible();
  await expect(page.locator('link[href*="short-home-2026.css"]')).toHaveCount(1);
});


test('film photo is not covered by captions, headlines or disclosure', async ({page}) => {
  await page.goto(base + '/');
  const frame = page.locator('.story-hero-media');
  await expect(frame.locator('.story-hero-inner .story-start-simple')).toBeVisible();
  await expect(frame.locator('.film-caption,.story-synthetic,.story-hero-title,.cinema-overline')).toHaveCount(0);
  await expect(frame.locator('.story-start-simple')).toContainText('Watch our story');
  await expect(page.locator('#storyFilmDisclosure')).toBeVisible();
  await expect(page.locator('#storyFilmDisclosure')).toContainText('AI actors');
  const overlap = await page.evaluate(() => {
    const frame = document.querySelector('.story-hero-media').getBoundingClientRect();
    const disclosure = document.querySelector('#storyFilmDisclosure').getBoundingClientRect();
    return disclosure.top >= frame.bottom - 1;
  });
  expect(overlap).toBe(true);
  await page.locator('[data-open-film]').last().click();
  await expect(page.locator('.story-film-pane .story-film-label,.story-film-pane .story-film-subtitle')).toHaveCount(0);
  await expect(page.locator('.story-mini')).toContainText('AI actors');
});
test('Get updates button has readable text/background contrast', async ({page}) => {
  await page.goto(base + '/');
  const btn = page.locator('.end-cta .button-updates');
  await expect(btn).toBeVisible();
  const contrast = await btn.evaluate(el => {
    const style = getComputedStyle(el);
    const channels = color => (color.match(/[\d.]+/g) || []).slice(0,3).map(Number);
    const brightness = color => channels(color).map(x => {
      const v=x/255;
      return v<=0.04045 ? v/12.92 : ((v+0.055)/1.055)**2.4;
    }).reduce((sum,x,i)=>sum+x*[0.2126,0.7152,0.0722][i],0);
    const f=brightness(style.color),b=brightness(style.backgroundColor);
    return (Math.max(f,b)+0.05)/(Math.min(f,b)+0.05);
  });
  expect(contrast).toBeGreaterThanOrEqual(4.5);
  await btn.click();
  await expect(page).toHaveURL(/\/signup\.html$/);
});
test('new scalable Amanikah emblem is visible throughout key pages', async ({page}) => {
  for (const url of ['/','/signup.html','/account/register.html','/account/login.html','/simple-nikah/','/nikah-readiness/','/family-guide/','/account/family.html']) {
    await page.goto(base+url);
    const mark = page.locator('header img[src*="/icon.svg"],header .brand-emblem');
    await expect(mark.first()).toBeVisible();
    const valid = await mark.first().evaluate(img=>img.complete && img.naturalWidth > 0 && img.naturalHeight > 0);
    expect(valid).toBe(true);
  }
});


test('operator console renders untrusted lead and funnel text without execution', async ({page}) => {
  const attack = '<img src=x onerror="window.__amanikahInjected=1">';
  await page.route('**/api/amanikah/ops/**', async route => {
    const pathname = new URL(route.request().url()).pathname;
    const key = pathname.split('/').pop();
    const responses = {
      dashboard: {ok:true,mode:'waitlist',matchmakingLive:false,mailConfigured:false,operatorEmailConfigured:false,payments:'sandbox',
        leads:{new:1,contacted:0,qualified:0,converted:0,closed:0},
        ticketsOpen:0,safetyOpen:0,members:0,casesOpen:0,verificationsOpen:0,fulfillmentQueued:0,
        notificationsQueued:0,notificationsFailed:0,demoMembers:0},
      leads:{ok:true,leads:[{id:'safe-id',reference:'AK-TEST',name:attack,email:'test@example.test',
        city:attack,source:'test',status:'new',created_at:'2026-11-17'}]},
      tickets:{ok:true,tickets:[]},cases:{ok:true,cases:[]},verifications:{ok:true,requests:[]},
      fulfillment:{ok:true,items:[]},notifications:{ok:true,notifications:[]},
      funnel:{ok:true,totals:{},membersProduction:0,note:attack,paymentsMode:'sandbox',
        leadsBySourceStatus:[],leadsByDay:[]}
    };
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(responses[key]||{ok:false})});
  });
  await page.goto(base+'/ops/');
  await page.locator('#opsToken').fill('ci-test-token');
  await page.locator('#loadBtn').click();
  await expect(page.locator('#leads')).toContainText(attack);
  await expect(page.locator('#funnel')).toContainText(attack);
  await expect(page.locator('#opsStatus')).toContainText('Loaded.');
  expect(await page.locator('#leads img, #funnel img').count()).toBe(0);
  expect(await page.evaluate(() => Boolean(window.__amanikahInjected))).toBe(false);
  expect(await page.evaluate(() => sessionStorage.getItem('amanikah.ops.token'))).toBeNull();
});
