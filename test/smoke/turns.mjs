// Browser test: a parent makes a chore every other week and has two kids take turns.
// Run: node test/smoke/turns.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash, weekParity, tasksForDay, addDays } from '../../js/logic.js';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const saved = emptyState();
  saved.settings.pinHash = fallbackHash('kidquest:1234');
  saved.settings.questView = 'list';
  const today = dateKey();
  const ava = defaultTasks();
  ava.push({ id: 'task_bath', name: 'Clean the bathroom', icon: '🛁', period: 'afternoon', days: [6], verify: 'parent', minutes: 0 });
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: ava, startDate: today });
  saved.kids.push({ id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: defaultTasks(), startDate: today });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();

  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_ava"]');
  const row = '.task-edit[data-task="task_bath"]';
  assert.equal(await page.locator(`${row} [data-action="task-turns"]`).count(), 0, 'no turn buttons on an every-week task');
  await page.selectOption(`${row} select[data-action-change="task-repeat"]`, 'this');
  await page.click(`${row} [data-action="task-turns"][data-kid="kid_ben"]`);
  await page.waitForTimeout(200);
  assert.match(await page.locator(row).innerText(), /Takes turns with\s+Ben/);
  if (shots) await page.locator(row).screenshot({ path: `${shots}/turns-ava.png` });

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  const a = after.kids[0].tasks.find((t) => t.id === 'task_bath');
  const b = after.kids[1].tasks.find((t) => t.name === 'Clean the bathroom');
  assert.equal(a.everyOtherWeek, weekParity(today));
  assert.equal(b.everyOtherWeek, 1 - weekParity(today));
  assert.deepEqual(b.days, [6]);
  const sat = addDays(today, (6 - new Date().getDay() + 7) % 7);
  const has = (i, key) => tasksForDay(after, after.kids[i], key, key).some((t) => t.name === 'Clean the bathroom');
  assert.ok(has(0, sat) && !has(1, sat), 'Ava this Saturday');
  assert.ok(!has(0, addDays(sat, 7)) && has(1, addDays(sat, 7)), 'Ben next Saturday');

  await page.click('[data-action="edit-kid-done"]');
  await page.click('[data-action="edit-kid"][data-id="kid_ben"]');
  const benRow = `.task-edit[data-task="${b.id}"]`;
  assert.equal(await page.locator(`${benRow} select[data-action-change="task-repeat"]`).inputValue(), 'next');
  assert.match(await page.locator(benRow).innerText(), /Takes turns with\s+Ava/);
  if (shots) {
    await page.locator(benRow).screenshot({ path: `${shots}/turns-ben.png` });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.locator(benRow).scrollIntoViewIfNeeded();
    await page.screenshot({ path: `${shots}/turns-phone.png` });
  }
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('turns test passed');
} finally {
  await browser.close();
  site.close();
}
