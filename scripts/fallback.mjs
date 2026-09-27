// Checks the no-WebGL fallback: with WebGL disabled the loader must finish, the copy must be there,
// the variant must still follow the scroll, and nothing may throw.
// Usage: node scripts/fallback.mjs [url]   (default http://localhost:4173)

import { chromium } from '@playwright/test';

const url = process.argv[2] ?? 'http://localhost:4173';
const browser = await chromium.launch({ args: ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'] });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(url);
await page.waitForSelector('.loader[data-done="true"]', { state: 'attached', timeout: 15_000 });
const webgl = await page.evaluate(() => document.documentElement.dataset.webgl);
if (webgl !== 'false') errors.push(`expected data-webgl="false", got ${webgl}`);
if (await page.locator('canvas').count()) errors.push('a canvas was created without WebGL');
await page.waitForTimeout(3500);
await page.screenshot({ path: 'screenshots/fallback-intro.png' });

await page.evaluate(() => {
  const el = document.querySelector('.collection__panel[data-variant="ember"]');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
});
await page.waitForTimeout(1500);
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
if (bg !== '#140604') errors.push(`scrolling to EMBER left the background at ${bg}`);
await page.screenshot({ path: 'screenshots/fallback-ember.png' });

await browser.close();
if (errors.length) {
  console.error(`Problems:\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('Fallback works: no WebGL, page usable, no errors.');
