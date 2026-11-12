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
import { openKid } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR;
const TODAY = '2026-11-12';
const site = await serve('.');
const browser = await chromium.launch();

function family({ yesterdayOpen = true } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'map'; // the old map (a new device starts in the village)
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
    assert.ok(await page.isVisible('.map-node.chest.chest-silver'), 'a 10-day streak earns a silver chest');
    assert.equal(await page.isVisible('.late-chest'), false, "yesterday's chest was opened");
    await page.click(`[data-action="task"][data-id="${last}"]`);
    await page.waitForTimeout(800);
    if (await page.isVisible('[data-action="modal-close"]')) await page.click('[data-action="modal-close"]');
    await page.waitForTimeout(400);
    while (await page.isVisible('#modal:not([hidden]) [data-action="modal-close"]')) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.locator('.map-node.chest.ready').scrollIntoViewIfNeeded();
    if (shots) await page.locator('.quest-map').screenshot({ path: `${shots}/chest-ready.png`, clip: undefined }).catch(() => {});
    await page.click('.map-node.chest.ready');
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/chest-opening.png` });
    await page.waitForTimeout(1300);
    if (shots) await page.screenshot({ path: `${shots}/chest-prize.png` });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
    const chest = saved.log[TODAY].kid_ava.chest;
    assert.ok(chest && chest.tier === 'silver', 'the prize is saved on the day');
    await page.click('#modal [data-action="modal-close"]');
    assert.ok(await page.isVisible('.map-node.chest.opened'), 'the chest shows open');
    await page.click('[data-action="trophies"]');
    await page.waitForTimeout(500);
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
    assert.ok(await page.isVisible('.late-chest'), "yesterday's chest waits");
    if (shots) await page.screenshot({ path: `${shots}/late-chest-phone.png` });
    await page.click('.late-chest');
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/chest-prize-phone.png` });
    await page.click('#modal [data-action="modal-close"]');
    assert.equal(await page.isVisible('.late-chest'), false);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
    assert.ok(saved.log[addDays(TODAY, -1)].kid_ava.chest, "yesterday's prize saved on yesterday");
    await page.click('[data-action="trophies"]');
    await page.waitForTimeout(500);
    if (shots) await page.screenshot({ path: `${shots}/trophies-phone.png` });
    assert.deepEqual(errors, [], 'no errors in the page');
    await ctx.close();
  }
  console.log('treasure test passed');
} finally {
  await browser.close();
  site.close();
}
