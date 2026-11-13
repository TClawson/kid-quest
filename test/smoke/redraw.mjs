// Browser test: family sync redraws the screen often. Redraws must not move or lose the
// visiting buddies, restart the fish, or scroll side rows back to the start.
// Run: node test/smoke/redraw.mjs
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { seenSaturday } from '../helpers/seed.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.url);
  const s = emptyState();
  s.settings.pinHash = 'sha256:test';
  s.settings.sound = false;
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: TEST_DAY, buddy: { species: 'fox', outfit: { background: 'bg-ocean' } } });
  s.log[TEST_DAY] = { kid_sam: { tasks: {}, excused: true } }; // the store opens once the day's chores are done
  // a kid's tablet in a family, with two other kids' buddies cached for visiting
  await page.evaluate((st) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
    localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
      { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', buddy: { species: 'cat', outfit: {} } },
      { id: 'kid_max', name: 'Max', color: '#51cf66', buddy: { species: 'bear', outfit: {} } },
    ]));
  }, seenSaturday(s));
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await closePops(page);
  await page.waitForSelector('.village[data-live] .k-hud');

  // the village: a redraw with nothing changed leaves it alone (the same live section, not
  // started again). The redraws come from the app coming back to the front (visibilitychange),
  // which redraws whatever is on screen, as a family update does.
  await page.evaluate(() => {
    window.__redraw = () => document.dispatchEvent(new Event('visibilitychange'));
    window.__village = document.querySelector('.village');
  });
  for (let i = 0; i < 4; i += 1) { await page.evaluate(() => window.__redraw()); await page.waitForTimeout(200); }
  assert.ok(await page.evaluate(() => window.__village === document.querySelector('.village')), 'the village is not drawn again when nothing changed');
  assert.ok(await page.locator('.village .k-hud').isVisible());

  // the village redrawn every 0.7 s, half of the times with something on screen changing (so the
  // section is drawn again): the visitors stay where they are, and the sea's fish keep swimming
  await page.waitForSelector('.village .v-visitor');
  // the first open today they walk in to their spots (village-shows.mjs): where they stand is after that
  await page.waitForSelector('.village[data-arrive="done"], .village[data-arrive="no"]');
  const spots =() => page.evaluate(() => [...document.querySelectorAll('.village .v-visitor')].map((v) => `${v.dataset.id}@${v.style.left},${v.style.top}`).join(' '));
  const stood = await spots();
  await page.evaluate(() => {
    window.__fish = 0;
    window.__gone = 0;
    window.__drawn = 0;
    setInterval(() => {
      if (!document.querySelector('.village .v-visitor')) window.__gone += 1;
      const c = document.querySelector('.village canvas.v-life');
      if (!c) return; // the test moves on to the wardrobe while this still runs
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]) { window.__fish += 1; break; }
    }, 200);
    let n = 0;
    const first = document.querySelector('.village');
    window.__redraws = setInterval(() => {
      n += 1;
      if (n % 2) window.kidQuest.state.kids[0].name = `Sam${n}`;
      window.__redraw();
      if (document.querySelector('.village') !== first) window.__drawn += 1;
    }, 700);
  });
  await page.waitForTimeout(6000);
  const seen = await page.evaluate(() => { clearInterval(window.__redraws); return { fish: window.__fish, gone: window.__gone, drawn: window.__drawn }; });
  assert.ok(seen.drawn > 0, 'the village was drawn again (the name on the HUD changed)');
  assert.equal(seen.gone, 0, 'the visitors never leave on a redraw');
  assert.equal(await spots(), stood, 'and stand where they stood');
  assert.ok(seen.fish > 5, `fish keep swimming through redraws (seen in ${seen.fish} checks)`);

  // side scrollers keep their scroll place when the screen is redrawn. The slot tabs now
  // wrap onto two lines on a phone, so make them a side scroller here to test it.
  await page.click('.k-hud [data-action="wardrobe"]');
  // the shop's tab rows scroll sideways when they don't fit; make sure the first one doesn't fit here
  await page.addStyleTag({ content: '.tabs { flex-wrap: nowrap !important; overflow-x: auto !important; display: flex !important; } .tabs button { min-width: 160px !important; flex: none !important; }' });
  await page.evaluate(() => { document.querySelector('.tabs').scrollLeft = 150; });
  const before = await page.evaluate(() => document.querySelector('.tabs').scrollLeft);
  assert.ok(before > 0, 'the tabs scroll sideways');
  await page.evaluate(() => { window.kidQuest.state.kids[0].name = 'Sammy'; document.querySelector('.tabs button.on').click(); });
  assert.equal(await page.evaluate(() => document.querySelector('.tabs').scrollLeft), before, 'tabs stay scrolled after a redraw');

  assert.deepEqual(errors, []);
  console.log('redraw test passed');
} finally {
  await browser.close();
  site.close();
}
