// The house chores (bed, teeth, floor) are done in the buddy's house, not handed out by
// villagers: the village leaves them out and shows a quest bubble over the kid's house.
// Run: node test/smoke/house-quests.mjs [outDir]   (outDir: also save screenshots)
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2]?.replace(/\/$/, '');
if (out) fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

function family({ done = [] } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const tasks = defaultTasks();
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(day, -10), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  for (let i = 1; i <= 9; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(tasks.filter((t) => done.includes(t.house)).map((t) => [t.id, { status: 'done', by: 'self' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport, st) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: out ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${day}T07:30:00`) });
  await page.goto(site.url);
  // the buddy was left outside today
  await page.evaluate((s) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify({ kid_ava: { day: '2026-11-11', inside: false } })); }, st);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(1200);
  return { ctx, page };
}
const villagerQuests = (page) => page.$$eval('.villager[data-vid]', (els) => els.map((e) => e.getAttribute('aria-label')).join(' | '));

try {
  // nothing done: no villager asks for the bed, teeth or floor; the house has a ×3 bubble
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, family());
    const asks = await villagerQuests(page);
    for (const name of ['Brush teeth', 'Make bed', 'Clear bedroom floor']) assert.ok(!asks.includes(name), `no villager gives ${name}: ${asks}`);
    assert.ok(asks.length > 0, 'other chores still come from villagers');
    assert.equal(await page.locator('.v-home.has-quests .v-home-bubble').count(), 1, 'house shows its chores');
    assert.equal((await page.locator('.v-home-bubble .v-badge').textContent()).trim(), '×3');
    if (out) {
      // the camera starts by the house
      const box = await page.locator('.village .village-view').boundingBox();
      await page.screenshot({ path: `${out}/1-village-house-chores.png`, clip: box });
    }
    // tapping the house walks in, where the chores are
    await page.evaluate(() => document.querySelector('.v-home').click());
    await page.clock.runFor(6000);
    assert.equal(await page.locator('.house').count(), 1, 'walked into the house');
    assert.equal(await page.locator('.h-chore').count(), 3, 'bed, teeth and floor are in the house');
    await ctx.close();
  }
  // two done: the bubble counts the one left; all done: no bubble
  {
    const { ctx, page } = await open({ width: 412, height: 915 }, family({ done: ['bed', 'teeth'] }));
    assert.equal(await page.locator('.v-home-bubble').count(), 1);
    assert.equal(await page.locator('.v-home-bubble .v-badge').count(), 0, 'one left: no ×N');
    if (out) {
      const box = await page.locator('.village .village-view').boundingBox();
      await page.screenshot({ path: `${out}/2-phone-one-left.png`, clip: box });
    }
    await ctx.close();
  }
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, family({ done: ['bed', 'teeth', 'floor'] }));
    assert.equal(await page.locator('.v-home-bubble').count(), 0, 'all done: no bubble');
    assert.equal(await page.locator('.v-home.has-quests').count(), 0);
    await ctx.close();
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log('house quests test passed');
} finally {
  await browser.close();
  site.close();
}
