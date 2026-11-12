// Browser test for the treasure chest (js/treasure.js):
// - a kid with a 10-day streak gets a silver chest; it wiggles once every task is done
// - tapping it opens it: the prize is saved on the day and the chest shows open
// - a chest from yesterday that was approved late waits, with a button to open it
// - the trophy shelf lists every trophy and the unlocked maps
// Run: npm run test:smoke   (SHOTS_DIR=... saves screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, tasksForDay, fallbackHash } from '../../js/logic.js';
import { TROPHIES } from '../../js/treasure.js';
import { openKid, closePops, doChore } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR;
const TODAY = '2026-11-12';
const site = await serve('.');
const browser = await chromium.launch();

function family({ yesterdayOpen = true } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.allowance = { on: false, coins: 300, xp: 300, bonus: 50, since: '2026-11-01' };
  const kid = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks().map((t) => ({ ...t, verify: 'self' })), startDate: addDays(TODAY, -9), owned: ['bg-ocean'], spent: 0 };
  s.kids.push(kid);
  for (let i = 9; i >= 0; i -= 1) {
    const key = addDays(TODAY, -i);
    const tasks = {};
    for (const t of tasksForDay(s, kid, key, TODAY)) tasks[t.id] = { status: 'done' };
    (s.log[key] ||= {})[kid.id] = { tasks };
  }
  // all done today but the last one
  const today = s.log[TODAY][kid.id].tasks;
  const last = Object.keys(today).pop();
  delete today[last];
  // older chests: a trophy, and two pieces of the meadow map
  s.log[addDays(TODAY, -5)][kid.id].chest = { tier: 'wood', kind: 'trophy', trophy: 'crab' };
  s.log[addDays(TODAY, -4)][kid.id].chest = { tier: 'wood', kind: 'piece', map: 'bg-meadow' };
  s.log[addDays(TODAY, -3)][kid.id].chest = { tier: 'wood', kind: 'piece', map: 'bg-meadow' };
  s.log[addDays(TODAY, -2)][kid.id].chest = { tier: 'silver', kind: 'gems', gems: 5 };
  if (yesterdayOpen) s.log[addDays(TODAY, -1)][kid.id].chest = { tier: 'silver', kind: 'coins', coins: 10 };
  return { s, last };
}

async function open(viewport, saved, name) {
  const ctx = await browser.newContext(viewport.name ? devices[viewport.name] : { viewport });
  const page = await ctx.newPage();
  await page.clock.install({ time: new Date(`${TODAY}T17:00:00`) });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), saved);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  return { page, errors, ctx, name };
}

try {
  // ---- tablet: finish the day and open today's silver chest
  {
    const { s, last } = family();
    const { page, errors, ctx } = await open({ width: 900, height: 1200 }, s);
    // A one-kid tablet opens straight on the kid's page, so a start-of-day pop-up can already be up: close it first.
    await page.clock.runFor(600);
    await closePops(page);
    await page.clock.runFor(400);
    assert.equal(await page.locator('.village .v-chest .chest-svg.chest-silver').count(), 1, 'a 10-day streak earns a silver chest');
    assert.equal(await page.locator('.k-hud .hud-chest').count(), 0, "yesterday's chest was opened");
    await doChore(page, last, { clock: true });
    await page.clock.runFor(800);
    for (let i = 0; i < 6 && await page.locator('#modal:not([hidden]) [data-action="modal-close"]').count(); i += 1) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(300); }
    // the chest in the village is ready: tap it, the buddy walks over and opens it
    if (await page.locator('.village .v-dialog:not([hidden])').count()) await page.click('.village .v-dialog [data-v="bye"]');
    assert.equal(await page.locator('.village .v-chest.ready').count(), 1, 'the chest is ready');
    if (shots) await page.screenshot({ path: `${shots}/chest-ready.png` });
    // (the screen can be redrawn once more as the day's news settles, which stops a walk: tap again then)
    for (let i = 0; i < 60 && !(await page.locator('#modal:not([hidden])').count()); i += 1) {
      if (!(await page.locator('.village .v-buddy.walking').count())) await page.locator('.village .v-chest.ready').dispatchEvent('click');
      await page.clock.runFor(300);
    }
    await page.clock.runFor(400);
    if (shots) await page.screenshot({ path: `${shots}/chest-opening.png` });
    await page.clock.runFor(1300);
    if (shots) await page.screenshot({ path: `${shots}/chest-prize.png` });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
    const chest = saved.log[TODAY].kid_ava.chest;
    assert.ok(chest && chest.tier === 'silver', 'the prize is saved on the day');
    await page.click('#modal [data-action="modal-close"]');
    await page.clock.runFor(400);
    assert.equal(await page.locator('.village .v-chest.opened').count(), 1, 'the chest shows open');
    // the trophies are in Status
    await page.click('.k-hud .k-plate');
    await page.click('#modal [data-action="status-tab"][data-tab="trophies"]');
    await page.clock.runFor(500);
    assert.equal(await page.locator('.trophy-shelf .trophy').count(), TROPHIES.length + 0);
    assert.equal(await page.locator('.treasure-map-row').count(), 3, 'meadow, sunset (3-day streak) and the bought ocean map');
    if (shots) await page.screenshot({ path: `${shots}/trophies-tablet.png` });
    assert.deepEqual(errors, [], 'no errors in the page');
    await ctx.close();
  }
  // ---- phone: yesterday's chest is still waiting
  {
    const { s } = family({ yesterdayOpen: false });
    const { page, errors, ctx } = await open({ name: 'Pixel 7' }, s);
    await page.clock.runFor(600);
    await closePops(page);
    await page.clock.runFor(400);
    assert.ok(await page.isVisible('.k-hud .hud-chest'), "yesterday's chest waits, beside Today");
    if (shots) await page.screenshot({ path: `${shots}/late-chest-phone.png` });
    await page.click('.k-hud .hud-chest');
    await page.clock.runFor(1500);
    if (shots) await page.screenshot({ path: `${shots}/chest-prize-phone.png` });
    await page.click('#modal [data-action="modal-close"]');
    await page.clock.runFor(400);
    assert.equal(await page.locator('.k-hud .hud-chest').count(), 0);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
    assert.ok(saved.log[addDays(TODAY, -1)].kid_ava.chest, "yesterday's prize saved on yesterday");
    await page.click('.k-hud .k-plate');
    await page.click('#modal [data-action="status-tab"][data-tab="trophies"]');
    await page.clock.runFor(500);
    assert.equal(await page.locator('#modal .trophy-shelf .trophy').count(), TROPHIES.length);
    if (shots) await page.screenshot({ path: `${shots}/trophies-phone.png` });
    assert.deepEqual(errors, [], 'no errors in the page');
    await ctx.close();
  }
  console.log('treasure test passed');
} finally {
  await browser.close();
  site.close();
}
