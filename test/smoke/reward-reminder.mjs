// Browser test: a kid who earned the weekly reward shows up in one strip at the
// top of the parents' Today tab until a parent taps Given, with Undo on the toast.
// Run: npm run test:smoke   (SHOTS_DIR=... saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { toPicker } from '../helpers/open-kid.mjs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, addDays, weekStart, entryFor, tasksForDay, fallbackHash } from '../../js/logic.js';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
try {
  for (const [name, viewport] of [['tablet', { width: 900, height: 1200 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const t = dateKey();
    const lastMonday = addDays(weekStart(t), -7);
    const saved = emptyState();
    saved.settings.pinHash = fallbackHash('kidquest:1234');
    saved.settings.questView = 'list';
    const start = addDays(lastMonday, -7);
    saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: start, owned: [], spent: 0 });
    saved.kids.push({ id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: defaultTasks(), startDate: start, owned: [], spent: 0 });
    saved.settings.allowance = { on: false, coins: 300, xp: 300, bonus: 50, since: start, startFixed: true };
    // Ava did every chore last Monday to Friday; Ben missed Wednesday.
    const [ava, ben] = saved.kids;
    for (let i = 0; i < 5; i += 1) {
      const key = addDays(lastMonday, i);
      for (const kid of i === 2 ? [ava] : [ava, ben]) {
        const entry = entryFor(saved, kid.id, key, true);
        for (const task of tasksForDay(saved, kid, key, t)) entry.tasks[task.id] = { status: 'done', by: 'parent' };
      }
    }
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();
    const stored = () => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));

    // The Parents button counts the reward to hand over.
    await toPicker(page);
    assert.match(await page.textContent('[data-action="parent"]'), /1/);
    await toPicker(page);
    await page.click('[data-action="parent"]');
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    // one strip on Today: how many, and who; See opens the Given rows
    const strip = page.locator('.reward-strip');
    assert.match(await strip.innerText(), /1 Friday reward to hand out\s+Ava/);
    assert.equal(await page.locator('.reward-remind').count(), 0, 'rows stay folded');
    await page.click('[data-action="rewards-see"]');
    const rows = page.locator('.reward-remind .list-row');
    assert.equal(await rows.count(), 1);
    assert.match(await rows.first().textContent(), /Ava earned Pick the Friday movie/);
    if (shots) await page.screenshot({ path: `${shots}/remind-${name}.png` });
    // it no longer sits above the other tabs
    for (const tab of ['kids', 'history', 'settings']) {
      await page.click(`[data-action="tab"][data-tab="${tab}"]`);
      assert.equal(await page.locator('.reward-strip, .reward-remind').count(), 0, tab);
    }
    await page.click('[data-action="tab"][data-tab="today"]');

    await page.click('[data-action="reward-given"][data-kid="kid_ava"]');
    assert.equal(await page.locator('.reward-remind, .reward-strip').count(), 0);
    assert.ok((await stored()).kids[0].rewardsGiven[lastMonday]);
    if (shots) await page.screenshot({ path: `${shots}/given-${name}.png` });
    // Undo brings it back, Given again clears it.
    await page.click('.toast-btn');
    assert.equal(await page.locator('.reward-strip').count(), 1);
    assert.equal(await page.locator('.reward-remind .list-row').count(), 1);
    assert.equal((await stored()).kids[0].rewardsGiven[lastMonday], undefined);
    await page.click('[data-action="reward-given"][data-kid="kid_ava"]');
    await page.click('[data-action="parent-exit"]');
    await toPicker(page);
    assert.doesNotMatch(await page.textContent('[data-action="parent"]'), /\d/);

    // no page-wide horizontal scroll on a phone
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1));
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('reward reminder smoke ok');
} finally {
  await browser.close();
  site.close();
}
