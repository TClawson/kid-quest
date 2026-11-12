// Screenshots of the kid's full-screen village with its HUD, the Status and Menu pop-ups, the
// house, garden and music house, the shop's tabs and the old map (from the Menu), at 1280x800,
// 800x1280 and 412x915, for a made-up family (Ayden, Remington, Esther, Edison).
// Run: node test/smoke/kid-hud-preview.mjs <outDir> [only]   (only: a name to shoot just that set)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { dateKey, addDays, weekStart } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/kid-hud').replace(/\/$/, '');
const only = process.argv[3] || '';
fs.mkdirSync(out, { recursive: true });
const DAY = dateKey();
const SIZES = { landscape: { width: 1280, height: 800 }, portrait: { width: 800, height: 1280 }, phone: { width: 412, height: 915 } };

/** The family, with Remington on the sunset beach map and Edison on the castle map (three different villages). */
function family({ remiMap = 'bg-sunset', edisonMap = 'bg-castle', piano = true } = {}) {
  const s = parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime());
  s.kids[1].buddy.outfit.background = remiMap;
  s.kids[3].buddy.outfit.background = edisonMap;
  for (const k of s.kids) k.owned = [...new Set([...(k.owned || []), k.buddy.outfit.background])];
  // a long piano streak for Remington, so the music house is open
  if (piano) {
    for (let i = 1; i <= 30; i += 1) {
      const key = addDays(DAY, -i);
      s.log[key] ||= {};
      s.log[key].kid_remi ||= { tasks: {} };
      s.log[key].kid_remi.tasks ||= {};
      s.log[key].kid_remi.tasks.r_piano = { status: 'done', by: 'parent', seconds: 1800 };
    }
  }
  s.celebrations = Object.fromEntries(s.kids.map((k) => [k.id, { sat: DAY, reward: weekStart(DAY) }]));
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(size, st, { kid = 'kid_remi', place = 'out' } = {}) {
  const viewport = SIZES[size];
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${DAY}T16:30:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, kids, place]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    localStorage.setItem('kidquest.house', JSON.stringify(Object.fromEntries(kids.map((k) => [k, { day: place.day, inside: place.where === 'house', place: place.where }]))));
  }, [st, st.kids.map((k) => k.id), { day: DAY, where: place }]);
  await page.reload();
  await page.click(`[data-action="open-kid"][data-id="${kid}"]`);
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.clock.runFor(1200);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const shot = (page, name) => page.screenshot({ path: `${out}/${name}.png` });
const want = (name) => !only || name.includes(only);

try {
  // the village with the HUD, on three maps, at three sizes
  for (const [kid, map] of [['kid_ayden', 'meadow'], ['kid_remi', 'sunset'], ['kid_edison', 'castle']]) {
    for (const size of Object.keys(SIZES)) {
      const name = `village-${map}-${size}`;
      if (!want(name)) continue;
      const { ctx, page } = await open(size, family(), { kid });
      await shot(page, name);
      await ctx.close();
    }
  }
  // the Status pop-up, every tab (landscape), and Me in portrait and on a phone
  for (const size of Object.keys(SIZES)) {
    if (!want(`status-${size}`)) continue;
    const { ctx, page } = await open(size, family(), { kid: 'kid_remi' });
    await page.click('.k-plate');
    await page.clock.runFor(400);
    await shot(page, `status-me-${size}`);
    if (size === 'landscape') {
      for (const tab of ['week', 'habits', 'trophies']) {
        await page.click(`.p-tabs [data-tab="${tab}"]`);
        await page.clock.runFor(300);
        await shot(page, `status-${tab}-${size}`);
      }
    }
    await ctx.close();
  }
  // the Menu
  for (const size of Object.keys(SIZES)) {
    if (!want(`menu-${size}`)) continue;
    const { ctx, page } = await open(size, family(), { kid: 'kid_ayden' });
    await page.click('.k-menu');
    await page.clock.runFor(400);
    await shot(page, `menu-${size}`);
    // the old map, from the Menu
    if (size !== 'portrait') {
      await page.click('[data-action="old-map"]');
      await page.clock.runFor(800);
      await shot(page, `old-map-${size}`);
    }
    await ctx.close();
  }
  // the house, the garden and the music house, full screen
  for (const place of ['house', 'garden', 'music']) {
    for (const size of Object.keys(SIZES)) {
      if (!want(`${place}-${size}`)) continue;
      const { ctx, page } = await open(size, family(), { kid: 'kid_remi', place });
      await shot(page, `${place}-${size}`);
      await ctx.close();
    }
  }
  // a talk box over the village, and the locked shop explaining itself
  for (const size of Object.keys(SIZES)) {
    if (!want(`talk-${size}`)) continue;
    const { ctx, page } = await open(size, family(), { kid: 'kid_ayden' });
    await page.click('.k-hud [data-action="today"]');
    await page.click('.t-q[data-id="a_hw"] [data-action="today-go"]');
    for (let i = 0; i < 40 && !(await page.locator('.village .v-dialog:not([hidden])').count()); i += 1) await page.clock.runFor(500);
    await page.clock.runFor(1500);
    await shot(page, `talk-${size}`);
    await page.click('.village .v-dialog [data-v="bye"]');
    await page.clock.runFor(800);
    await page.click('.k-shop');
    await page.clock.runFor(300);
    await shot(page, `shop-locked-${size}`);
    await ctx.close();
  }
  // the shop's tabs (Esther's day is done, so her shop is open)
  for (const size of ['landscape', 'phone']) {
    if (!want(`shop-tabs-${size}`)) continue;
    const { ctx, page } = await open(size, family(), { kid: 'kid_esther' });
    await page.click('.k-shop');
    await page.waitForSelector('[data-action="wardrobe-back"]');
    await shot(page, `shop-tabs-${size}`);
    await page.click('.shop-tabs .kinds button:last-child');
    await page.clock.runFor(300);
    await shot(page, `shop-tabs-house-${size}`);
    await ctx.close();
  }
  console.log('kid hud previews in', out, errors.length ? `errors: ${errors.join(' | ')}` : '');
} finally {
  await browser.close();
  site.close();
}
