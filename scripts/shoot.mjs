// Visual + behavior check. Opens the site, waits for the opening sequence, then on desktop and
// mobile: screenshots every section, checks that scrolling through the collection switches the
// variant on its own, catches the liquid mid-transition, opens and closes the cap, picks a note,
// and fails on console errors or broken behavior.
// Usage: node scripts/shoot.mjs [url]   (default http://localhost:4173, i.e. `npm run preview`)

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';

const url = process.argv[2] ?? 'http://localhost:4173';
const outDir = 'screenshots';
const viewports = [
  // headless rendering is software-only and would step quality down; desktop pins the top tier
  { name: 'desktop', width: 1440, height: 900, isMobile: false, query: '?quality=high' },
  { name: 'mobile', width: 390, height: 844, isMobile: true, query: '' },
];
const backgrounds = { noir: '#0b0810', aura: '#eaf4f5', ember: '#140604' };

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
const errors = [];
const fail = (vp, msg) => errors.push(`[${vp.name}] ${msg}`);

for (const vp of viewports) {
  const page = await browser.newPage({
    viewport: { width: vp.width, height: vp.height },
    isMobile: vp.isMobile,
    hasTouch: vp.isMobile,
    deviceScaleFactor: 1,
  });
  page.on('console', (msg) => msg.type() === 'error' && fail(vp, msg.text()));
  page.on('pageerror', (err) => fail(vp, err.message));

  const shot = (name) => page.screenshot({ path: `${outDir}/${vp.name}-${name}.png` });
  const scrollTo = async (selector, offset = 0) => {
    await page.evaluate(
      ([sel, off]) => {
        const el = document.querySelector(sel);
        window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY + off * window.innerHeight);
      },
      [selector, offset],
    );
  };
  const bg = () => page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());

  const started = Date.now();
  await page.goto(url + vp.query);
  await page.waitForTimeout(900);
  await shot('0-loader');
  await page.waitForSelector('.loader[data-done="true"]', { state: 'attached', timeout: 20_000 });
  console.log(`${vp.name}: loader done after ${Date.now() - started} ms`);
  await page.waitForTimeout(1500);
  await shot('1-intro-opening');
  await page.waitForTimeout(3000);
  await shot('1-intro');

  await scrollTo('#manifesto');
  await page.waitForTimeout(1500);
  await shot('2-manifesto');

  // collection: the variant must follow the scroll, no clicks
  const panels = ['noir', 'aura', 'ember'];
  for (let i = 0; i < panels.length; i++) {
    await scrollTo(`.collection__panel[data-variant="${panels[i]}"]`);
    if (i === 1) {
      await page.waitForTimeout(650);
      await shot('3-collection-liquid-mid-transition');
    }
    await page.waitForTimeout(1800);
    const current = await bg();
    if (current !== backgrounds[panels[i]]) fail(vp, `scrolling to ${panels[i]} left the background at ${current}`);
    await shot(`3-collection-${panels[i]}`);
  }

  await scrollTo('#notes');
  await page.waitForTimeout(1500);
  const notes = page.locator('.note-button');
  await notes.nth(1).click();
  await page.waitForTimeout(1400);
  const panelText = (await page.locator('.note-panel').innerText()).trim();
  if (!panelText) fail(vp, 'note panel is empty after clicking a note');
  await shot('4-notes');

  for (const [offset, name] of [[0.1, 'a'], [0.95, 'b'], [1.7, 'c']]) {
    await scrollTo('#deconstruct', offset);
    await page.waitForTimeout(1500);
    await shot(`5-deconstruct-${name}`);
  }

  await scrollTo('#final');
  await page.waitForTimeout(1500);
  await page.locator('.cap-button').click();
  await page.waitForTimeout(2000);
  if ((await page.locator('.cap-button').getAttribute('aria-pressed')) !== 'true') fail(vp, 'cap button did not open');
  await shot('6-final-cap-open');
  await page.locator('.cap-button').click();
  await page.waitForTimeout(2000);
  await shot('6-final-cap-closed');

  // the final picker still works by click
  await page.locator('.final__picker .pill', { hasText: 'AURA' }).click();
  await page.waitForTimeout(1600);
  if ((await bg()) !== backgrounds.aura) fail(vp, 'final picker did not switch to AURA');
  await shot('6-final-aura');

  await page.close();
}

await browser.close();
if (errors.length) {
  console.error(`Problems:\n${errors.join('\n')}`);
  process.exit(1);
}
console.log('All checks passed, no console errors.');
