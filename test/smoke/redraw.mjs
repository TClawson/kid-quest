// Browser test: family sync redraws the screen often. Redraws must not replay the
// visiting buddies' arrival, restart the fish, or scroll side rows back to the start.
// Run: node test/smoke/redraw.mjs
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const ctx = await browser.newContext({ ...devices['Pixel 7'] });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.url);
  const s = emptyState();
  s.settings.pinHash = 'sha256:test';
  s.settings.sound = false;
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: dateKey(), buddy: { species: 'fox', outfit: { background: 'bg-ocean' } } });
  s.log[dateKey()] = { kid_sam: { tasks: {}, excused: true } }; // the store opens once the day's chores are done
  // a kid's tablet in a family, with two other kids' buddies cached for visiting
  await page.evaluate((st) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
    localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
      { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', buddy: { species: 'cat', outfit: {} } },
      { id: 'kid_max', name: 'Max', color: '#51cf66', buddy: { species: 'bear', outfit: {} } },
    ]));
  }, s);
  await page.reload();
  await page.click('[data-action="open-kid"]');
  await page.waitForSelector('.map-visitor');
  await page.waitForTimeout(300);

  // redraw every 0.7 s, half of them with something on screen changing
  await page.evaluate(() => {
    window.__arrivals = 0;
    new MutationObserver((ms) => {
      for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.querySelector?.('.map-visitors.arrive')) window.__arrivals += 1;
    }).observe(document.getElementById('app'), { childList: true });
    window.__fish = 0;
    setInterval(() => {
      const c = document.querySelector('canvas.map-life');
      if (!c) return; // the test moves on to the wardrobe while this still runs
      const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
      for (let i = 3; i < d.length; i += 4) if (d[i]) { window.__fish += 1; break; }
    }, 200);
    let n = 0;
    window.__redraws = setInterval(() => {
      n += 1;
      if (n % 2) window.kidQuest.state.kids[0].name = `Sam${n}`;
      document.querySelector('[data-action="quest-mode"][data-mode="map"]').click();
    }, 700);
  });
  await page.waitForTimeout(6000);
  const seen = await page.evaluate(() => { clearInterval(window.__redraws); return { arrivals: window.__arrivals, fish: window.__fish }; });
  assert.equal(seen.arrivals, 0, 'visitors do not walk in again on a redraw');
  assert.ok(seen.fish > 5, `fish keep swimming through redraws (seen in ${seen.fish} checks)`);

  // side scrollers keep their scroll place when the screen is redrawn. The slot tabs now
  // wrap onto two lines on a phone, so make them a side scroller here to test it.
  await page.click('[data-action="wardrobe"]');
  await page.addStyleTag({ content: '.tabs { flex-wrap: nowrap !important; overflow-x: auto !important; display: flex !important; }' });
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
