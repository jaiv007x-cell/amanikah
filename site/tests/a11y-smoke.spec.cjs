const {test,expect} = require('@playwright/test');
const AxeBuilder = require('@axe-core/playwright').default;
const base = 'http://127.0.0.1:8765';
for(const route of ['/','/signup.html','/account/register.html','/account/login.html','/simple-nikah/','/nikah-readiness/','/family-guide/','/pricing/']){
  test('accessibility and contrast audit: '+route, async({page})=>{
    await page.goto(base+route);
    await page.waitForLoadState('domcontentloaded');
    const results=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa']).analyze();
    const issues=results.violations.filter(v=>v.impact==='critical'||v.impact==='serious');
    expect(issues.map(v=>({id:v.id,impact:v.impact,locations:v.nodes.map(n=>n.target).slice(0,5)}))).toEqual([]);
  });
}
