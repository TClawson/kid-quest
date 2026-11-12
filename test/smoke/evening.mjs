// Browser test: an evening chore (a shower after dinner) doesn't keep the buddy store shut,
// but a missed one locks it the next day until every chore is done.
// Run: node test/smoke/evening.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash, addDays, tasksForDay } from '../../js/logic.js';
import { openKid, toPicker } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1100 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const today = dateKey();
  const yday = addDays(today, -1);
  const tasks = defaultTasks();
  tasks.push({ id: 'task_shower', name: 'Shower', icon: '🚿', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0 });
  const make = (missed) => {
    const s = emptyState();
    s.settings.pinHash = fallbackHash('kidquest:1234');
    s.settings.questView = 'list';
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
  await toPicker(page);
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_sam"]');
  const row = '.task-edit[data-task="task_shower"]';
  await page.click(`${row} .task-line`);
  await page.check(`${row} input[data-field="evening"]`);
  await page.waitForTimeout(200);
  assert.match(await page.locator(row).innerText(), /don't keep the buddy store shut/);
  if (shots) await page.locator(row).screenshot({ path: `${shots}/1-task-editor.png` });
  const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.equal(after.kids[0].tasks.find((t) => t.id === 'task_shower').evening, true);

  // shower done last night: the store is open before tonight's shower
  await load(make(false));
  await openKid(page, '[data-action="open-kid"][data-id="kid_sam"]');
  await page.waitForTimeout(300);
  assert.equal(await page.locator('.store-locked').count(), 0, 'store open with only the evening chore left');
  assert.ok(await page.locator('[data-action="wardrobe"]').count());
  if (shots) await page.locator('.buddy-panel').screenshot({ path: `${shots}/2-open-before-shower.png` });

  // shower missed last night: today the store waits for the shower too
  await load(make(true));
  await openKid(page, '[data-action="open-kid"][data-id="kid_sam"]');
  await page.waitForTimeout(300);
  assert.match(await page.locator('.buddy-panel').innerText(), /Shower was missed last night/);
  await page.click('[data-action="wardrobe"]');
  await page.waitForTimeout(200);
  assert.match(await page.locator('body').innerText(), /waits for every chore, evening ones too/);
  if (shots) {
    await page.locator('.buddy-panel').screenshot({ path: `${shots}/3-locked-after-missed.png` });
    await page.screenshot({ path: `${shots}/4-locked-toast.png` });
  }
  assert.deepEqual(errors, []);
  console.log('evening chores: ok');
} finally {
  await browser.close();
  site.close();
}
