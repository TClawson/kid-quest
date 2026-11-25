// A villager's words after a chore stay up until the kid closes them: the village is drawn again
// a moment after a chore (the cheer ends, the family's copy comes back), and the talk box comes
// back up each time instead of vanishing before the kid can read it.
// Run: node test/smoke/village-talk.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { at } from '../helpers/clock.mjs';
import { emptyState, addDays, fallbackHash } from '../../js/logic.js';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const day = '2026-11-09'; // a Monday
const ALL = [0, 1, 2, 3, 4, 5, 6];
function family() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  const task = (id, name, icon) => ({ id, name, icon, period: 'morning', days: ALL, verify: 'self', minutes: 0 });
  s.kids.push({
    id: 'kid_ava', name: 'Ava', color: '#ff6b6b', startDate: addDays(day, -20), seenUnlocks: [], seenMoves: [], owned: [], spent: 0,
    tasks: [task('task_dog', 'Feed the dog', '🐶'), task('task_cat', 'Feed the cat', '🐱')],
    buddy: { species: 'fox', outfit: { background: 'bg-meadow' } },
  });
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ viewport: { width: 800, height: 1280 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { throw e; });
  await page.clock.install({ time: at(day, '07:30') });
  await page.goto(site.url);
  await page.evaluate((s) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); Storage.prototype.setItem = () => {}; }, family());
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 5; i += 1) { await closePops(page); await page.clock.runFor(400); }
  await page.evaluate(() => document.querySelector('.v-dialog:not([hidden]) [data-v="bye"]')?.click());

  const box = () => page.evaluate(() => {
    const d = document.querySelector('.screen.kid .v-dialog');
    return d && !d.hidden ? d.querySelector('.v-text')?.textContent || '' : null;
  });

  // walk to the villager with the dog quest and say it's done
  await page.evaluate(() => document.querySelector('.screen.kid .village').goTask('task_dog'));
  for (let i = 0; i < 80 && !(await page.locator('.v-dialog:not([hidden]) [data-v="do"]').count()); i += 1) await page.clock.runFor(250);
  await page.evaluate(() => document.querySelector('.v-dialog:not([hidden]) [data-v="do"]').click());
  await page.clock.runFor(1500);
  const thanks = await box();
  assert.ok(thanks, 'the villager says thanks after the chore');
  await page.evaluate(() => { document.querySelector('.screen.kid .v-dialog').dataset.probe = '1'; });

  // well past the cheer's end (which draws the village again) and a family update or two
  await page.clock.runFor(4000);
  await page.evaluate(() => { const w = window; w.dispatchEvent(new Event('resize')); });
  await page.clock.runFor(8000);
  assert.equal(await box(), thanks, 'the thank-you is still up, word for word, until the kid closes it');
  assert.equal(await page.locator('.v-dialog[data-probe]').count(), 0, 'the village really was drawn again meanwhile');

  // drawing again while it's up (here: the app coming back to the front) keeps it up too
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.clock.runFor(500);
  assert.equal(await box(), thanks, 'a redraw keeps the talk box');

  // the kid closes it; the next redraw doesn't bring it back
  await page.evaluate(() => document.querySelector('.v-dialog:not([hidden]) [data-v="bye"]').click());
  assert.equal(await box(), null, 'Bye! closes it');
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
  await page.clock.runFor(500);
  assert.equal(await box(), null, 'and it stays closed after a redraw');
  console.log('ok: a villager\'s thank-you stays up through redraws until the kid closes it');
  await ctx.close();
} finally {
  await browser.close();
  site.close?.();
}
