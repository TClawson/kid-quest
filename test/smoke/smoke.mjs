// Browser smoke test: the app loads saved data, opens a kid and ticks a task.
// Run: npm run test:smoke
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const saved = emptyState();
  saved.settings.pinHash = 'sha256:test';
  saved.settings.questView = 'list';
  const tasks = defaultTasks();
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: dateKey() });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();

  await openKid(page, '[data-action="open-kid"]');
  const teeth = tasks.find((t) => t.name === 'Brush teeth');
  await page.click(`[data-action="task"][data-id="${teeth.id}"]`);
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.equal(after.log[Object.keys(after.log)[0]].kid_ava.tasks[teeth.id].status, 'done', 'task saved as done');
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('smoke test passed');
} finally {
  await browser.close();
  site.close();
}
