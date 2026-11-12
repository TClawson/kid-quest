// Browser test: a parent sets a task's coins and XP, and the kid earns those amounts.
// Run: npm run test:smoke
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash } from '../../js/logic.js';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 900, height: 1200 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const saved = emptyState();
  saved.settings.pinHash = fallbackHash('kidquest:1234');
  saved.settings.questView = 'list';
  saved.settings.allowance = { on: false, coins: 300, xp: 300, bonus: 50, since: dateKey() }; // typed amounts per task
  const tasks = defaultTasks();
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: dateKey(), owned: [], spent: 0 });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();

  // Parent opens the task editor and sets Brush teeth to 3 coins and 25 XP.
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_ava"]');
  const teeth = tasks.find((t) => t.name === 'Brush teeth');
  const row = `.task-edit[data-task="${teeth.id}"]`;
  // each chore is one line until it is opened
  assert.equal(await page.locator(`${row} [data-field="coins"]`).count(), 0, 'closed chore shows no fields');
  assert.match(await page.locator(`${row} .task-line`).innerText(), /Brush teeth[\s\S]*10 🪙/);
  await page.click(`${row} .task-line`);
  assert.equal(await page.getAttribute(`${row} [data-field="coins"]`, 'placeholder'), '10');
  await page.fill(`${row} [data-field="coins"]`, '3');
  await page.press(`${row} [data-field="coins"]`, 'Tab');
  await page.fill(`${row} [data-field="xp"]`, '25');
  await page.press(`${row} [data-field="xp"]`, 'Tab');
  if (shots) await page.locator(row).screenshot({ path: `${shots}/reward-editor.png` });
  if (shots) await page.screenshot({ path: `${shots}/reward-editor-page.png` });

  let s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  let saved_teeth = s.kids[0].tasks.find((t) => t.id === teeth.id);
  assert.equal(saved_teeth.coins, 3);
  assert.equal(saved_teeth.xp, 25);

  // Clearing a box goes back to the default.
  await page.fill(`${row} [data-field="xp"]`, '');
  await page.press(`${row} [data-field="xp"]`, 'Tab');
  s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  saved_teeth = s.kids[0].tasks.find((t) => t.id === teeth.id);
  assert.equal('xp' in saved_teeth, false);
  await page.fill(`${row} [data-field="xp"]`, '25');
  await page.press(`${row} [data-field="xp"]`, 'Tab');

  // The kid ticks it and gets 3 coins.
  await page.click('[data-action="parent-exit"]');
  await page.click('[data-action="open-kid"]');
  await page.click(`[data-action="task"][data-id="${teeth.id}"]`);
  await page.waitForSelector('.float-xp');
  assert.equal(await page.textContent('.float-xp'), '+25 XP · +3 🪙');
  await page.waitForTimeout(300);
  assert.equal((await page.textContent('.chip.coin')).trim(), '🪙 3');
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('rewards test passed');
} finally {
  await browser.close();
  site.close();
}
