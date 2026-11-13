// Browser smoke test: the app loads saved data, opens a kid and ticks a task.
// Run: npm run test:smoke
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, doChore } from '../helpers/open-kid.mjs';

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
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: TEST_DAY });
  await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();

  await openKid(page, '[data-action="open-kid"]');
  // the kid's screen is the village: Today, Go on the chore, and the buddy walks to whoever gives
  // it (here the bathroom, in the house); its talk box has the I did it! button
  const teeth = tasks.find((t) => t.name === 'Brush teeth');
  await doChore(page, teeth.id);
  await page.waitForTimeout(300);

  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.equal(after.log[TEST_DAY].kid_ava.tasks[teeth.id].status, 'done', 'task saved as done');
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('smoke test passed');
} finally {
  await browser.close();
  site.close();
}
