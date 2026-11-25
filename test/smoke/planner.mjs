// Browser test: Plan my week. A kid drags a chore into another routine (by its handle and by
// press-and-hold), moves one with the Move button, can't move pinned teeth, picks the days of a
// chore a parent left to them, picks a chore to grow and a free seed, and signs.
// Run: node test/smoke/planner.mjs  (SHOTS=dir also saves screenshots, tablet and phone)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays } from '../../js/logic.js';
import { applySet } from '../../js/choresets.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, openMenu, closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
let n = 0;
const state = () => {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  const kid = { id: 'kid_ava', name: 'Ava', color: '#4dabf7', tasks: defaultTasks(), startDate: addDays(TEST_DAY, -2) };
  applySet(kid, 'little', (p) => `${p}_${(n += 1)}`);
  kid.tasks.find((t) => t.name === 'Vacuum your room').kidDays = 1;
  kid.grown = [kid.tasks.find((t) => t.name === 'Make bed').id]; // bed had its grow week already
  kid.tasks.push({ id: 'task_run', name: 'Bike ride', icon: '🚲', period: 'exercise', days: [1, 3, 5], verify: 'parent', minutes: 0, kidDays: 4 });
  s.kids.push(kid);
  return s;
};
/** Holds the mouse down on `from` (waiting `hold` ms), then drags to `to`, letting the planner scroll on the way. */
async function dragTo(page, from, to, { hold = 0, dx = 40, end = false } = {}) {
  await page.locator(from).scrollIntoViewIfNeeded();
  const a = await page.locator(from).boundingBox();
  await page.mouse.move(a.x + Math.min(10, a.width / 2), a.y + a.height / 2);
  await page.mouse.down();
  if (hold) await page.waitForTimeout(hold);
  await page.mouse.move(a.x + 14, a.y + a.height / 2 + 6, { steps: 3 });
  for (let i = 0; i < 80; i += 1) {
    const card = await page.locator('.modal-card').boundingBox();
    const b = await page.locator(to).boundingBox();
    const y = end ? b.y + b.height - 6 : b.y + b.height / 2;
    if (y > card.y + 60 && y < card.y + card.height - 60) {
      // move there, then once more in case the planner scrolled under the finger on the way
      await page.mouse.move(b.x + dx, y, { steps: 8 });
      await page.waitForTimeout(120);
      const b2 = await page.locator(to).boundingBox();
      await page.mouse.move(b2.x + dx, end ? b2.y + b2.height - 6 : b2.y + b2.height / 2, { steps: 2 });
      break;
    }
    await page.mouse.move(card.x + 60, y < card.y + 60 ? card.y + 20 : card.y + card.height - 20, { steps: 2 });
    await page.waitForTimeout(80);
  }
  assert.ok(await page.locator('.pl-ghost').count(), 'a ghost follows the finger');
  await page.mouse.up();
  await page.waitForTimeout(100);
}
const id = (s, name, house) => s.kids[0].tasks.find((t) => t.name === name && (!house || t.house === house)).id;

async function run(viewport, tag) {
  const page = await browser.newPage({ viewport });
  await useTestDay(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const s = state();
  await page.goto(site.url);
  await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.waitForTimeout(400);
  await openMenu(page);
  await page.click('#modal .menu-pop [data-action="plan"]');
  await page.waitForSelector('#modal .planner[data-step="routines"]');
  const list = (r) => page.$$eval(`[data-droplist="${r}"] [data-plrow]`, (els) => els.map((e) => e.dataset.plrow));

  // 1. drag Make bed by its handle onto Toys away (after school)
  const bed = id(s, 'Make bed'); const toys = id(s, 'Toys away');
  await dragTo(page, `[data-plrow="${bed}"] [data-drag]`, `[data-plrow="${toys}"]`);
  let after = await list('afternoon');
  assert.ok(after.includes(bed), 'Make bed is after school now');
  assert.equal(after.indexOf(bed) + 1, after.indexOf(toys), 'dropped before Toys away');
  assert.ok(!(await list('morning')).includes(bed));

  // 2. Move button: Books away to the evening
  const books = id(s, 'Books away');
  await page.click(`[data-plrow="${books}"] [data-action="plan-moving"]`);
  await page.click(`[data-plrow="${books}"] [data-action="plan-moveto"][data-routine="evening"]`);
  assert.ok((await list('evening')).includes(books));

  // 3. teeth are pinned: no Move button, and a drag doesn't take them out of the morning
  const teeth = id(s, 'Brush teeth', 'teeth');
  assert.equal(await page.locator(`[data-plrow="${teeth}"] [data-action="plan-moving"]`).count(), 0);
  assert.match(await page.locator(`[data-plrow="${teeth}"]`).innerText(), /📌/);

  // 4. press and hold a row, then drag (Get dressed to the evening list's end)
  const dressed = id(s, 'Get dressed');
  await dragTo(page, `[data-plrow="${dressed}"] .pl-name`, '[data-droplist="evening"]', { hold: 450, dx: 30, end: true });
  assert.equal((await list('evening')).at(-1), dressed, 'held and dragged to the end of the evening');

  await page.selectOption('select[data-planroutine="morning"]', 'When I wake up');
  await page.selectOption('select[data-planroutine="afternoon"]', 'After snack');
  await page.selectOption('select[data-planroutine="evening"]', 'After dinner');
  assert.match(await page.locator('[data-routine="afternoon"] .plan-say').innerText(), /After snack, I'll .*make bed/i);
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/${tag}-1-routines.png` });

  // 5. days: vacuum once, bike four times
  await page.click('[data-action="plan-step"][data-dir="1"]');
  await page.waitForSelector('.planner[data-step="days"]');
  assert.equal(await page.locator('[data-action="plan-step"][data-dir="1"]').isDisabled(), true, 'bike needs 4 days');
  const vac = id(s, 'Vacuum your room');
  await page.click(`[data-action="plan-day"][data-id="${vac}"][data-dow="5"]`); // off Friday
  await page.click(`[data-action="plan-day"][data-id="${vac}"][data-dow="3"]`); // on Wednesday
  await page.click('[data-action="plan-day"][data-id="task_run"][data-dow="6"]');
  assert.equal(await page.locator('[data-action="plan-step"][data-dir="1"]').isDisabled(), false);
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/${tag}-2-days.png` });

  // 6. grow + free seed
  await page.click('[data-action="plan-step"][data-dir="1"]');
  await page.waitForSelector('.planner[data-step="grow"]');
  // chores take turns: bed grew last time, so it waits
  const bedPick = page.locator(`.pl-grown:has-text("Make bed")`);
  assert.equal(await bedPick.count(), 1);
  assert.ok(await bedPick.isDisabled());
  assert.match(await bedPick.innerText(), /Grown already/);
  assert.equal(await page.locator(`[data-action="plan-grow"][data-id="${bed}"]`).count(), 0);
  await page.click(`[data-action="plan-grow"][data-id="${id(s, 'Brush teeth', 'teeth-night')}"]`);
  await page.click('[data-action="plan-seed"][data-id="seed-hibiscus"]');
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/${tag}-3-grow.png` });
  await page.click('[data-action="plan-step"][data-dir="1"]');
  await page.waitForSelector('.planner[data-step="sign"]');
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/${tag}-4-sign.png` });
  await page.click('[data-action="plan-sign"]');
  await page.waitForSelector('#modal .celebrate');
  if (shots) { await page.waitForTimeout(600); await page.locator('.modal-card').screenshot({ path: `${shots}/${tag}-5-signed.png` }); }
  await closePops(page);

  const kid = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(kid.plan.routines[bed], 'afternoon');
  assert.equal(kid.plan.routines[books], 'evening');
  assert.equal(kid.plan.routines[teeth], 'morning');
  assert.deepEqual(kid.plan.days[vac], [3]);
  assert.deepEqual(kid.plan.days.task_run, [1, 3, 5, 6]);
  assert.equal(kid.plan.cues.evening, 'After dinner');
  assert.equal(kid.plan.seed, 'seed-hibiscus');
  assert.ok(kid.garden.beds.some((b) => b && b.seed === 'seed-hibiscus'));
  assert.deepEqual(errors, []);
  await page.close();
}

try {
  await run({ width: 1280, height: 800 }, 'tablet');
  await run({ width: 390, height: 844 }, 'phone');
  console.log('planner: ok');
} finally {
  await browser.close();
  site.close();
}
