// Visual check: opens the site, waits for the loader, screenshots every section on desktop and
// mobile, and fails if the console logged errors.
// Usage: node scripts/shoot.mjs [url]   (default http://localhost:4173, i.e. `npm run preview`)

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = 'screenshots';
const sections = ['intro', 'manifesto', 'collection', 'notes', 'deconstruct', 'final'];
const viewports = [
  { name: 'desktop', width: 1440, height: 900, isMobile: false },
  { name: 'mobile', width: 390, height: 844, isMobile: true },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => msg.type() === 'error' && errors.push(`[${vp.name}] ${msg.text()}`));
  page.on('pageerror', (err) => errors.push(`[${vp.name}] ${err.message}`));

  const started = Date.now();
  await page.goto(url);
  await page.waitForSelector('.loader[data-done="true"]', { state: 'attached', timeout: 20_000 });
  console.log(`${vp.name}: loaded in ${Date.now() - started} ms`);
  await page.waitForTimeout(1200);

  for (const id of sections) {
    await page.evaluate((sid) => {
      const el = document.getElementById(sid);
      window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
    }, id);
    await page.waitForTimeout(900);
    if (id === 'notes') {
      await page.locator('.note-button').first().click();
      await page.waitForTimeout(400);
    }
    await page.screenshot({ path: `${outDir}/${vp.name}-${id}.png` });
  }

  // every variant, from the final section's picker
  for (const name of ['AURA', 'EMBER', 'NOIR']) {
    await page.locator('.final__picker .pill', { hasText: name }).click();
    await page.waitForTimeout(1000);
    const pressed = await page.locator('.final__picker .pill', { hasText: name }).getAttribute('aria-pressed');
    if (pressed !== 'true') errors.push(`[${vp.name}] ${name} button did not become selected`);
    await page.screenshot({ path: `${outDir}/${vp.name}-variant-${name.toLowerCase()}.png` });
  }
  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(`Console errors:\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('No console errors.');
