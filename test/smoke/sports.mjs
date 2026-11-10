// Browser test: bonus exercise earns gems without blocking the quest, gems buy
// sports gear, and a buddy with an exercise streak does a move when tapped.
// Run: npm run test:smoke
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, addDays, fallbackHash } from '../../js/logic.js';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const t = dateKey();
  const saved = emptyState();
  saved.settings.pinHash = fallbackHash('kidquest:1234');
  saved.settings.questView = 'list';
  const tasks = [...defaultTasks(), { id: 'task_run', name: 'Run', icon: '🏃', period: 'exercise', days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0, gems: 50 }];
  // exercised every day for the last 21 days: at least two full Monday-Sunday weeks whatever
  // day the test runs (14 days only gave two on some weekdays), so jumping jacks are unlocked
  const start = addDays(t, -21);
  for (let i = 1; i <= 21; i += 1) saved.log[addDays(t, -i)] = { kid_ava: { tasks: { task_run: { status: 'done' } }, excused: false } };
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: start, seenUnlocks: [], seenMoves: ['jacks', 'cartwheel'], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow', music: 'music-keyboard' } } });
  saved.log[t] = { kid_ava: { tasks: {}, excused: true } }; // the store opens once the day's chores are done
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();
  await page.click('[data-action="open-kid"]');
  await page.waitForTimeout(500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }

  // the bonus exercise section is there, the gems chip shows 21 x 50
  assert.equal(await page.locator('.exercise .tile').count(), 1);
  assert.match(await page.locator('.chip.gem').innerText(), /1,?050/);
  // the quest list doesn't include the exercise task
  assert.equal(await page.locator('section:not(.exercise) .tile[data-id="task_run"]').count(), 0);

  // tapping the buddy does a move
  await page.click('.buddy-panel .buddy-tap');
  await page.waitForTimeout(200);
  assert.equal(await page.locator('.buddy-panel svg.trick').count(), 1, 'buddy does a move');
  await page.waitForTimeout(2000);
  assert.equal(await page.locator('.buddy-panel svg.trick').count(), 0, 'and goes back to normal');

  // exercise today: +50 gems
  await page.click('.exercise .tile[data-id="task_run"]');
  await page.waitForTimeout(800);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
  assert.match(await page.locator('.chip.gem').innerText(), /1,?100/);

  // buy a soccer ball with gems
  await page.click('[data-action="wardrobe"]');
  await page.click('[data-action="wardrobe-slot"][data-slot="sport"]');
  await page.click('[data-action="wardrobe-item"][data-id="sport-soccer-regular"]');
  await page.click('[data-action="buy-confirm"]');
  await page.waitForTimeout(400);
  const s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  const ava = s.kids[0];
  assert.ok(ava.owned.includes('sport-soccer-regular'));
  assert.equal(ava.gemsSpent, 40);
  assert.equal(ava.spent, 0, 'coins are not touched');
  assert.equal(ava.buddy.outfit.sport, 'sport-soccer-regular');
  assert.equal(ava.buddy.outfit.music, undefined, 'holding gear puts the piano away');
  assert.ok(ava.exBest >= 2, 'the best exercise streak is kept on the kid for visits');
  // the soccer ball's first move is now unlocked and announced
  await page.waitForTimeout(800);
  assert.match(await page.locator('#modal').innerText(), /Keepy-uppy/);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }

  // the fishing boat: 100 gems, stays at the lake (the soccer ball stays in hand)
  await page.click('[data-action="wardrobe-item"][data-id="sport-boat"]');
  assert.match(await page.locator('#modal').innerText(), /deep water/);
  if (process.env.SHOTS) await page.screenshot({ path: `${process.env.SHOTS}/boat-buy.png` });
  await page.click('[data-action="buy-confirm"]');
  await page.waitForTimeout(400);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
  const s2 = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.ok(s2.kids[0].owned.includes('sport-boat'));
  assert.equal(s2.kids[0].gemsSpent, 140);
  assert.equal(s2.kids[0].buddy.outfit.sport, 'sport-soccer-regular', 'the boat is not held');
  assert.match(await page.locator('[data-id="sport-boat"]').innerText(), /At the lake/);
  if (process.env.SHOTS) await page.locator('[data-id="sport-boat"]').scrollIntoViewIfNeeded().then(() => page.screenshot({ path: `${process.env.SHOTS}/boat-shop.png` }));

  assert.deepEqual(errors, []);
  console.log('sports test passed');
} finally {
  await browser.close();
  site.close();
}
