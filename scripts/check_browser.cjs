// Optional real-browser checks: install playwright in the README's temporary QA directory.
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require(path.join(require('node:os').tmpdir(), 'dv01-chart-qa/node_modules/playwright'));
async function run() {
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto('http://localhost:8000');
      await page.locator('#q5-chart .sex-segment').first().waitFor();
      assert.equal(await page.locator('svg').count(), 5);
      assert.equal(await page.locator('#q2-chart .series').count(), 3);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `Page overflow at ${width}px`);
      await page.selectOption('#distribution-year', '2011');
      assert.match(await page.locator('#q4-insight').innerText(), /2011/);
      await page.selectOption('#q2-measure', 'percentage_share');
      await page.getByRole('button', { name: 'Reset comparison' }).click();
      assert.equal(await page.locator('#q2-measure').inputValue(), 'hospitalisations');
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(require('node:os').tmpdir(), `dv01-story-${width}.png`), fullPage: true });
    }
    assert.deepEqual(errors, []);
    console.log('PASS: Edge desktop/390px/320px; five charts; no page overflow; shared year and reset; no runtime errors. Screenshots: temporary directory/dv01-story-{width}.png');
  } finally { await browser.close(); }
}
run().catch(error => { console.error(error); process.exitCode = 1; });
