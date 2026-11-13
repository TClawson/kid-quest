// Browser test: the weekly allowance splits coins across a kid's tasks by size,
// and a parent can give a bonus up to the weekly limit.
// Run: npm run test:smoke   (SHOTS_DIR=... saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { seenSaturday } from '../helpers/seed.mjs';
import { openKid, openParents, doChore, closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const saved = emptyState();
  saved.settings.pinHash = fallbackHash('kidquest:1234');
  const ava = defaultTasks();
  const ben = [...defaultTasks(), { id: 'task_dish', name: 'Dishes', icon: '🍽️', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 }];
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: ava, startDate: TEST_DAY, owned: [], spent: 0 });
  saved.kids.push({ id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: ben, startDate: TEST_DAY, owned: [], spent: 0 });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), seenSaturday(saved));
  await page.reload();
  const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));

  // The first start turns the allowance on from tomorrow, so chores already
  // ticked today keep their typed amounts.
  let s = await stored();
  assert.equal(s.settings.allowance.on, true);
  assert.equal(s.settings.allowance.coins, 300);
  assert.equal(s.settings.allowance.since, addDays(TEST_DAY, 1));
  assert.equal(s.settings.allowance.startFixed, true);

  // From here on, test a family whose allowance already runs today.
  s.settings.allowance.since = TEST_DAY;
  await page.evaluate((x) => localStorage.setItem('kidquest.v1', JSON.stringify(x)), seenSaturday(s));
  await page.reload();

  // Ava brushes her teeth: a small task's share of 300.
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  const teeth = ava.find((t) => t.name === 'Brush teeth');
  await doChore(page, teeth.id);
  await page.waitForSelector('.float-xp');
  const float = await page.textContent('.float-xp');
  const m = float.match(/\+(\d+) 🪙/);
  assert.ok(m && Number(m[1]) > 0 && Number(m[1]) < 10, float);
  const teethCoins = Number(m[1]);
  await page.waitForTimeout(300);
  // the week's coins are in Status (Me, and This week)
  await page.click('.k-hud .k-plate');
  assert.match(await page.textContent('#modal .week-coins'), new RegExp(`🪙 ${teethCoins} of 300 this week`));

  // Parent gives Ava a bonus (Menu, Parents).
  await openParents(page);
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  assert.match(await page.textContent('.list'), /of 300 this week/);
  await page.click('[data-action="bonus"][data-kid="kid_ava"]');
  await page.click('[data-action="bonus-amount"][data-n="20"]');
  await page.click('[data-action="bonus-reason"][data-r="Extra chore"]');
  await page.waitForTimeout(700);
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/bonus-modal.png` });
  await page.click('[data-action="bonus-give"]');
  await page.waitForTimeout(200);
  assert.match(await page.textContent('.bonus-log'), /Ava: \+20 Extra chore/);
  if (shots) await page.screenshot({ path: `${shots}/kids-tab-bonus-log.png` });
  s = await stored();
  const bonus = Object.values(s.log[TEST_DAY].kid_ava.bonus);
  assert.equal(bonus.length, 1);
  assert.equal(bonus[0].coins, 20);

  // Only 30 more bonus coins this week: the 50 limit.
  await page.click('[data-action="bonus"][data-kid="kid_ava"]');
  const amounts = await page.$$eval('[data-action="bonus-amount"]', (els) => els.map((e) => Number(e.dataset.n)));
  assert.equal(Math.max(...amounts), 30);
  await page.click('[data-action="modal-close"]');

  // The task editor shows sizes instead of typed amounts.
  await page.click('[data-action="edit-kid"][data-id="kid_ava"]');
  const bed = ava.find((t) => t.name === 'Make bed');
  const row = `.task-edit[data-task="${bed.id}"]`;
  await page.click(`${row} .task-line`);
  assert.equal(await page.$(`${row} [data-field="coins"]`), null);
  assert.equal(await page.inputValue(`${row} [data-field="size"]`), '1');
  const before = await page.textContent(`${row} .reward-edit small`);
  await page.selectOption(`${row} [data-field="size"]`, '3');
  await page.waitForTimeout(100);
  await page.waitForTimeout(2600); // let the toast go
  await page.locator(row).scrollIntoViewIfNeeded();
  const after = await page.textContent(`${row} .reward-edit small`);
  assert.notEqual(before, after);
  s = await stored();
  assert.equal(s.kids[0].tasks.find((t) => t.id === bed.id).size, 3);
  if (shots) await page.screenshot({ path: `${shots}/task-editor-sizes.png`, fullPage: false });
  // a per-kid amount
  await page.fill('[data-kidallow="coins"]', '250');
  await page.press('[data-kidallow="coins"]', 'Tab');
  s = await stored();
  assert.equal(s.kids[0].allowance.coins, 250);

  // Settings card.
  await page.click('[data-action="tab"][data-tab="settings"]');
  if (shots) await page.locator('.card', { hasText: 'Weekly allowance' }).screenshot({ path: `${shots}/settings-allowance.png` });
  await page.fill('[data-allow="bonus"]', '40');
  await page.press('[data-allow="bonus"]', 'Tab');
  s = await stored();
  assert.equal(s.settings.allowance.bonus, 40);

  // The kid sees the bonus and the week's total.
  await page.click('[data-action="parent-exit"]');
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.waitForTimeout(200);
  await closePops(page);
  await page.click('.k-hud .k-pill');
  await page.click('#modal [data-action="status-tab"][data-tab="week"]');
  const week = await page.textContent('#modal .week-coins');
  assert.match(week, /of 250 this week/);
  assert.match(week, /\+20 Extra chore/);
  // today's share follows today's setup (Ava's 250 and the bigger bed), plus the bonus
  const earned = Number(week.match(/🪙 (\d+) of 250/)[1]);
  assert.ok(earned > 0 && earned <= teethCoins);
  assert.equal((await page.textContent('.k-hud .k-coin')).trim(), `🪙 ${earned + 20}`);
  if (shots) {
    await page.locator('#modal .status-pop').screenshot({ path: `${shots}/kid-this-week.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await openParents(page);
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.click('[data-action="tab"][data-tab="kids"]');
    await page.screenshot({ path: `${shots}/kids-tab-phone.png` });
    await page.click('[data-action="bonus"][data-kid="kid_ben"]');
    await page.click('[data-action="bonus-reason"][data-r="Kind to a sibling"]');
    await page.waitForTimeout(700);
    await page.screenshot({ path: `${shots}/bonus-modal-phone.png` });
  }
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('allowance test passed');
} finally {
  await browser.close();
  site.close();
}
