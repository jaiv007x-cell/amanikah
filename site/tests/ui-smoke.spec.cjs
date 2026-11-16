const { test, expect } = require('@playwright/test');
const base = 'http://127.0.0.1:8765';
test('homepage hierarchy, video user control and CTA', async ({ page }) => {
  test.setTimeout(50000);
  await page.goto(base + '/');
  await expect(page.locator('main h1')).toContainText('Your values');
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
