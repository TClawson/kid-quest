// Browser test: the Saturday free games pop up once, like a chest prize, and not on other days.
// Run: node test/smoke/saturday.mjs
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  for (const [day, expectPopup] of [['2026-11-07T09:00:00', true], ['2026-11-06T09:00:00', false]]) {
    const ctx = await browser.newContext(devices['Pixel 7']);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install({ time: new Date(day) });
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = 'sha256:test';
    s.settings.sound = false;
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: '2026-10-01', owned: [], buddy: { species: 'fox', outfit: {} } });
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.clock.runFor(1500);
    const text = await page.locator('#modal:not([hidden])').allInnerTexts();
    if (expectPopup) {
      assert.match(text.join(' '), /Saturday: 2 free games/i, 'Saturday pops up the two free games');
      await page.click('#modal [data-action="modal-close"]');
      await page.clock.runFor(1000);
      await page.click('[data-action="home"]').catch(() => {});
      await openKid(page, '[data-action="open-kid"]');
      await page.clock.runFor(1500);
      assert.doesNotMatch((await page.locator('#modal:not([hidden])').allInnerTexts()).join(' '), /free games/i, 'only once a day');
    } else {
      assert.doesNotMatch(text.join(' '), /free games/i, 'no popup on other days');
    }
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('saturday test passed');
} finally {
  await browser.close();
  site.close();
}
