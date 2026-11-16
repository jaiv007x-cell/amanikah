const { test, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:8765';
test('homepage hierarchy, video user control and CTA', async ({ page }) => {
  test.setTimeout(50000);
  await page.goto(base + '/');
  await expect(page.locator('main h1')).toContainText('A simple, respectful start');
  await expect(page.locator('a[href="/account/register.html"]').first()).toBeVisible();
  const video = page.locator('#storyHeroVideo');
  await expect(video).toBeVisible();
  expect(await video.evaluate(v => v.paused)).toBe(true);
  console.log('FILM STEP hero play');
  await page.locator('#storyHeroPause').click({timeout:5000});
  await expect.poll(() => video.evaluate(v => !v.paused), { timeout: 6000 }).toBe(true);
  console.log('FILM STEP hero pause');
  await page.locator('#storyHeroPause').click({timeout:5000});
  expect(await video.evaluate(v => v.paused)).toBe(true);
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
  const words = await page.locator('main').evaluate(el => el.textContent.trim().split(/\\s+/).length);
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
test('hero film remains an optional path and never autoplays or forces speed',async({page})=>{
  await page.goto(base + '/');
  const v=page.locator('#storyHeroVideo');
  expect(await v.evaluate(n=>n.autoplay)).toBe(false);
  expect(await v.evaluate(n=>n.muted)).toBe(true);
  await expect(page.locator('#storySpeed')).toHaveCount(0);
  await expect(page.locator('#storyHeroPause')).toBeVisible();
  await expect(page.locator('a[href="/nikah-readiness/"]').first()).toBeVisible();
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
