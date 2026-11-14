// Browser test: bought hats belong to one buddy. Switching buddies means buying them again,
// places stay shared, and hats a kid owned before this change stay with their buddy.
// Run: npm run test:smoke
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, closePops } from '../helpers/open-kid.mjs';

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
  saved.settings.questView = 'list';
  // Saved before this change: the cap and the ocean are both in `owned`. -200 spent = 200 coins to spend.
  saved.kids.push({
    id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: TEST_DAY, seenUnlocks: [],
    owned: ['hat-cap', 'bg-ocean'], spent: -200,
    buddy: { species: 'fox', outfit: { background: 'bg-ocean', hat: 'hat-cap' } },
  });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await page.waitForTimeout(500);
  await closePops(page); // a start-of-day pop-up (on a Saturday: the free games) would cover the buttons
  // chores left: the buddy store stays shut
  if (!(await page.textContent('[data-action="wardrobe"]')).includes('🔒')) throw new Error('store button should show the lock');
  await page.click('[data-action="wardrobe"]');
  await page.waitForTimeout(300);
  if (await page.$('.screen.wardrobe')) throw new Error('store opened with chores left');
  // an excused day opens it (done-and-approved days are covered by the unit test)
  await page.evaluate((key) => {
    const st = JSON.parse(localStorage.getItem('kidquest.v1'));
    st.log[key] = { [st.kids[0].id]: { tasks: {}, excused: true } };
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
  }, TEST_DAY);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await page.click('[data-action="wardrobe"]');
  await page.click('[data-action="wardrobe-slot"][data-slot="hat"]');
  const cap = '[data-action="wardrobe-item"][data-id="hat-cap"]';
  assert.match(await page.textContent(cap), /Wearing/, 'the fox keeps the cap it had');

  // Switch to the bear: the cap comes off and has a price again; the ocean stays.
  await page.click('[data-action="wardrobe-switch"]'); // the buddy picker opens on purpose
  await page.click('[data-action="wardrobe-species"][data-val="bear"]');
  assert.match(await page.textContent(cap), /🪙 40/);
  let s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.deepEqual(s.buddy.outfit, { background: 'bg-ocean' });
  assert.deepEqual(s.owned, ['bg-ocean']);
  assert.deepEqual(s.buddyOwned, { fox: ['hat-cap'] });
  if (shots) await page.screenshot({ path: `${shots}/per-buddy-bear-shop.png` });

  // Buy a cap for the bear.
  await page.click(cap);
  assert.match(await page.textContent('#modal'), /Buy Ball cap for your bear\?/);
  if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/per-buddy-buy.png` }); }
  await page.click('[data-action="buy-confirm"]');
  assert.match(await page.textContent(cap), /Wearing/);
  s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.deepEqual(s.buddyOwned, { fox: ['hat-cap'], bear: ['hat-cap'] });
  assert.equal(s.spent, -160);

  // Back to the fox: it puts its own cap back on.
  await page.click('[data-action="wardrobe-switch"]'); // the buddy picker opens on purpose
  await page.click('[data-action="wardrobe-species"][data-val="fox"]');
  s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.deepEqual(s.buddy.outfit, { background: 'bg-ocean', hat: 'hat-cap' });
  assert.deepEqual(errors, []);
  console.log('per-buddy items test passed');
} finally {
  await browser.close();
  site.close();
}
