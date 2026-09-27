// Films the refill: switches variant from the final section's picker and screenshots the bottle
// at intervals, then tiles the frames into screenshots/refill-sheet.jpg (needs ffmpeg-static).
// Usage: node scripts/refill.mjs [url] [variant]   (default http://localhost:4173, AURA)

import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const url = process.argv[2] ?? 'http://localhost:4173';
const target = process.argv[3] ?? 'AURA';
const outDir = 'screenshots/refill';
const times = process.argv[4] === 'full'
  ? [0, 0.15, 0.3, 0.45, 0.6, 0.8, 1.0, 1.2, 1.5, 1.8, 2.1, 2.4]
  : [0, 0.4, 0.8, 1.1, 1.4, 1.8, 2.2, 2.6, 3.0, 3.4, 3.8, 4.4];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
// a smaller (still wide-layout) window: software rendering cost grows with pixel count
const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

const t0 = Date.now();
const log = (msg) => console.log(`[${((Date.now() - t0) / 1000).toFixed(1)}s] ${msg}`);
await page.goto(`${url}?quality=high&debug`);
log('page opened');
await page.waitForSelector('.loader[data-done="true"]', { state: 'attached', timeout: 60_000 });
log('loader done');
await page.evaluate(() => {
  const el = document.getElementById('final');
  window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY);
});
await page.waitForTimeout(5000);

// the bottle sits in the right half of the final section; a 4th argument "full" keeps the whole
// frame (to see the backdrop's ring)
const full = process.argv[4] === 'full';
const clip = full ? undefined : { x: 440, y: 0, width: 500, height: 720 };
// Software rendering takes seconds per frame, so the refill timeline is frozen and scrubbed to
// each moment instead of filmed in real time.
log('scrolled to final');
// Clicked from inside the page: at 3-4 fps Playwright's real mouse click leaves later evaluate
// calls hanging. Clicking the variant that is already selected would change nothing, so another
// one is picked in that case.
const picked = await page.evaluate((want) => {
  const pills = [...document.querySelectorAll('.final__picker .pill')];
  const current = pills.find((b) => b.getAttribute('aria-pressed') === 'true')?.textContent;
  const choice = want !== current ? pills.find((b) => b.textContent === want) : pills.find((b) => b.textContent !== current);
  choice.click();
  return `${current} -> ${choice.textContent}`;
}, target);
log(`clicked ${picked}`);
// polled from here with a plain boolean: waitForFunction ties itself to the (very slow) frames
for (let i = 0; !(await page.evaluate(() => Boolean(window.__ether?.refill))); i++) {
  if (i > 300) throw new Error('refill timeline never appeared');
  await new Promise((r) => setTimeout(r, 200));
}
// (GSAP methods return the timeline itself; returning that to Node would try to serialize it)
await page.evaluate(() => void window.__ether.refill.pause(0));
log('refill paused');
const twoFrames = () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
for (let i = 0; i < times.length; i++) {
  await page.evaluate((t) => void window.__ether.refill.time(t), times[i]);
  await twoFrames();
  await page.screenshot({ path: `${outDir}/f${String(i).padStart(2, '0')}.png`, clip });
  log(`frame ${i} at ${times[i]}s`);
}
await browser.close();

const ffmpeg = createRequire(import.meta.url)('ffmpeg-static');
execFileSync(ffmpeg, [
  '-y', '-loglevel', 'error', '-i', `${outDir}/f%02d.png`,
  '-vf', `scale=${full ? 480 : 350}:-1,tile=6x2`, '-frames:v', '1', 'screenshots/refill-sheet.jpg',
]);
console.log('wrote screenshots/refill-sheet.jpg');
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}
