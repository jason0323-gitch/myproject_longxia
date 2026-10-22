// Optional real-browser acceptance, not part of the dependency-free unit suite.
// Install Playwright in this directory, then: node browser-smoke.cjs
const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const { pathToFileURL } = require('node:url');

(async () => {
  fs.mkdirSync(path.join(__dirname, 'artifacts'), { recursive: true });
  const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  try {
    for (const [name, viewport, mobile] of [['desktop', { width: 1440, height: 1000 }, false], ['mobile', { width: 390, height: 844 }, true]]) {
      const context = await browser.newContext({ viewport, isMobile: mobile, hasTouch: mobile });
      const page = await context.newPage();
      const errors = []; page.on('pageerror', e => errors.push(e.message));
      await page.goto(pathToFileURL(path.join(__dirname, 'index.html')).href);
      await page.waitForFunction(() => !!window.dispatchDebug);
      assert.equal(await page.locator('[data-switch]').count(), 4);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, 'horizontal overflow');
      const snapshot = () => page.evaluate(() => window.dispatchDebug.snapshot());
      await page.locator('[data-switch="1"]').click();
      await page.waitForFunction(() => window.dispatchDebug.snapshot().switches[1].moving === 0);
      await page.locator('#depart').click();
      await page.waitForFunction(() => window.dispatchDebug.snapshot().status.includes('红灯'), null, { timeout: 20000 });
      assert.equal((await snapshot()).train.speed, 0);
      await page.locator('[data-switch="1"]').click();
      await page.waitForFunction(() => window.dispatchDebug.snapshot().crossings >= 1, null, { timeout: 20000 });
      assert.ok((await snapshot()).switches[1].locked);
      await page.locator('#pause').click();
      const stoppedAt = (await snapshot()).train.distance;
      await page.waitForTimeout(200);
      assert.equal((await snapshot()).train.distance, stoppedAt);
      await page.screenshot({ path: path.join(__dirname, 'artifacts', `${name}.png`), fullPage: true });
      assert.deepEqual(errors, []);
      await context.close();
      console.log(`${name}: browser smoke passed`);
    }
    // Preserve the original game's start, switch and weapon controls.
    const page = await browser.newPage();
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(__dirname, '..', 'index.html')).href);
    await page.locator('#start').click();
    assert.equal(await page.locator('#overlay').isVisible(), false);
    const state = await page.locator('[data-switch="0"]').first().getAttribute('aria-pressed');
    await page.keyboard.press('4');
    assert.notEqual(await page.locator('[data-switch="0"]').first().getAttribute('aria-pressed'), state);
    await page.locator('.weapon[data-fire="1"]').click();
    await page.waitForFunction(() => Number(document.getElementById('hits').textContent) > 0);
    assert.deepEqual(errors, []);
    console.log('original combat controls: browser smoke passed');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
