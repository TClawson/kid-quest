// Browser test: a parent switches on a family vacation and taps days on the calendar; on a
// vacation day the kid's shop is open before any chore, visitors play right away, and games
// have no limit (they aren't counted).
// Run: node test/smoke/vacation.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash, freeGamesOn, storeOpen } from '../../js/logic.js';
import { TEST_DAY as TODAY, useTestDay } from '../helpers/clock.mjs';
import { pickVisitors } from '../../js/visits.js';
import { seenSaturday } from '../helpers/seed.mjs';
import { openKid, openParents, tapInVillage, visitorsHere } from '../helpers/open-kid.mjs';

const BUDDIES = [
  { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', owned: ['sport-soccer-good'], buddy: { species: 'cat', outfit: { sport: 'sport-soccer-good' } } },
  { id: 'kid_max', name: 'Max', color: '#51cf66', owned: [], buddy: { species: 'bear', outfit: {} } },
];
let TEST_DAY = TODAY;
while (!pickVisitors('kid_sam', BUDDIES, TEST_DAY).some((b) => b.id === 'kid_max')) TEST_DAY = addDays(TEST_DAY, 1);

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();

function makeState(vacation) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: addDays(TEST_DAY, -3), owned: [], buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  // the day's games used up already: only a vacation day lets them play
  s.kids[0].playLog = { day: TEST_DAY, n: 12 + freeGamesOn(TEST_DAY), prev: { day: addDays(TEST_DAY, -1), n: 99, cap: 4 } };
  if (vacation) s.settings.vacation = vacation;
  seenSaturday(s, TEST_DAY);
  return s;
}

try {
  // the parent's calendar
  {
    const ctx = await browser.newContext({ viewport: { width: 800, height: 1100 } });
    const page = await ctx.newPage();
    await useTestDay(page, { day: TEST_DAY });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    await page.evaluate((st) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); }, makeState(null));
    await page.reload();
    await openParents(page);
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.click('[data-action="tab"][data-tab="settings"]');
    await page.check('[data-action-change="vacation-switch"]');
    await page.waitForSelector('.vac-grid');
    const tomorrow = addDays(TEST_DAY, 1);
    // tomorrow may be next month: the calendar shows this month first
    if (!(await page.locator(`.vac-day[data-key="${tomorrow}"]`).count())) await page.click('[data-action="vacation-month"][data-step="1"]');
    await page.click(`.vac-day[data-key="${tomorrow}"]`);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).settings.vacation);
    assert.deepEqual(saved, { on: true, days: { [TEST_DAY]: true, [tomorrow]: true } });
    // a day already past can't be tapped
    const past = addDays(TEST_DAY, -1);
    if (await page.locator(`.vac-day[data-key="${past}"]`).count()) assert.ok(await page.locator(`.vac-day[data-key="${past}"]`).isDisabled());
    if (shots) await page.locator('.card.vacation').screenshot({ path: `${shots}/vacation-calendar.png` });
    // Today shows it on every kid's card
    await page.click('[data-action="tab"][data-tab="today"]');
    await page.waitForTimeout(200);
    assert.match(await page.locator('.kc[data-kid="kid_sam"]').innerText(), /Vacation day/);
    // switching off keeps nothing from today on
    await page.click('[data-action="tab"][data-tab="settings"]');
    await page.uncheck('[data-action-change="vacation-switch"]');
    const off = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).settings.vacation);
    assert.deepEqual(off, { on: false, days: {} });
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // a kid on a vacation day: nothing done, games used up, and still they play
  {
    const st = makeState({ on: true, days: { [TEST_DAY]: true } });
    assert.ok(storeOpen(st, st.kids[0], TEST_DAY).open);
    const ctx = await browser.newContext(devices['Galaxy Tab S4']);
    const page = await ctx.newPage();
    await useTestDay(page, { day: TEST_DAY });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    await page.evaluate(([s, buddies]) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(s));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(s));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify(buddies));
    }, [st, BUDDIES]);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await visitorsHere(page);
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor[data-id="kid_max"]');
    await page.waitForTimeout(900);
    assert.match(await page.locator('.v-visitor[data-id="kid_max"] .visitor-bubble').innerText(), /Tap me!/);
    assert.match(await page.locator('.today-btn').innerText(), /vacation!/);
    if (shots) await page.screenshot({ path: `${shots}/vacation-village.png` });
    for (let i = 0; i < 2; i += 1) {
      await tapInVillage(page, '.v-visitor[data-id="kid_max"]');
      await page.waitForSelector('.playground');
      const box = await page.locator('.play-field').boundingBox();
      await page.mouse.click(box.x + box.width * 0.66, box.y + box.height * 0.5);
      await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'play');
      assert.equal((await page.locator('.play-left').innerText()).trim(), '', 'no count on a vacation day');
      await page.click('.play-close');
      await page.waitForTimeout(400);
    }
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(saved.kids[0].playLog.n, 12 + freeGamesOn(TEST_DAY), 'vacation games are not counted');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('vacation smoke test passed');
} finally {
  await browser.close();
  site.close();
}
