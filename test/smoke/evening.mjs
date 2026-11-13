// Browser test: an evening chore (a shower after dinner) doesn't keep the buddy store shut,
// but a missed one locks it the next day until every chore is done.
// Run: node test/smoke/evening.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays, tasksForDay } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, openParents, closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const today = TEST_DAY;
  const yday = addDays(today, -1);
  const tasks = defaultTasks();
  tasks.push({ id: 'task_shower', name: 'Shower', icon: '🚿', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0 });
  const make = (missed) => {
    const s = emptyState();
    s.settings.pinHash = fallbackHash('kidquest:1234');
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: structuredClone(tasks), startDate: yday });
    const kid = s.kids[0];
    kid.tasks.find((t) => t.id === 'task_shower').evening = true;
    // yesterday: everything done, the shower too unless it was missed
    s.log[yday] = { kid_sam: { tasks: {}, excused: false } };
    for (const t of tasksForDay(s, kid, yday, yday)) if (t.period !== 'exercise' && !(missed && t.id === 'task_shower')) s.log[yday].kid_sam.tasks[t.id] = { status: 'done' };
    // today: every day chore done, the shower is for tonight
    s.log[today] = { kid_sam: { tasks: {}, excused: false } };
    for (const t of tasksForDay(s, kid, today, today)) if (t.period !== 'exercise' && t.id !== 'task_shower') s.log[today].kid_sam.tasks[t.id] = { status: 'done' };
    return s;
  };
  const load = async (s) => {
    await page.goto(site.url);
    await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
    await page.reload();
  };

  // the switch is in the task editor
  const editing = make(false);
  editing.kids[0].tasks.find((t) => t.id === 'task_shower').evening = false;
  await load(editing);
  await openParents(page);
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_sam"]');
  const row = '.task-edit[data-task="task_shower"]';
  await page.click(`${row} .task-line`);
  await page.check(`${row} input[data-field="evening"]`);
  await page.waitForTimeout(200);
  assert.match(await page.locator(row).innerText(), /don't keep the buddy shop shut/);
  if (shots) await page.locator(row).screenshot({ path: `${shots}/1-task-editor.png` });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.equal(after.kids[0].tasks.find((t) => t.id === 'task_shower').evening, true);

  // shower done last night: the store is open before tonight's shower
  await load(make(false));
  await openKid(page, '[data-action="open-kid"][data-id="kid_sam"]');
  await page.waitForTimeout(300);
  await closePops(page);
  assert.equal(await page.locator('.k-hud .k-shop.locked').count(), 0, 'store open with only the evening chore left');
  assert.equal(await page.locator('.k-hud .k-shop.open').count(), 1);
  if (shots) await page.screenshot({ path: `${shots}/2-open-before-shower.png` });

  // shower missed last night: today the store waits for the shower too
  await load(make(true));
  await openKid(page, '[data-action="open-kid"][data-id="kid_sam"]');
  await page.waitForTimeout(300);
  await closePops(page);
  assert.equal(await page.locator('.k-hud .k-shop.locked').count(), 1, 'the shop is shut');
  // Today's list says the evening chore counts today
  await page.click('.k-hud [data-action="today"]');
  assert.match(await page.locator('.t-grp[data-group="evening"]').innerText(), /counts for the shop today \(one was missed last night\)/);
  if (shots) await page.screenshot({ path: `${shots}/3-locked-after-missed.png` });
  await closePops(page);
  // and the locked Shop says why
  await page.click('.k-hud [data-action="wardrobe"]');
  await page.waitForTimeout(200);
  assert.match(await page.locator('.toast').innerText(), /Shower was missed last night, so today the shop waits for every chore, evening ones too/);
  if (shots) await page.screenshot({ path: `${shots}/4-locked-toast.png` });
  assert.deepEqual(errors, []);
  console.log('evening chores: ok');
} finally {
  await browser.close();
  site.close();
}
