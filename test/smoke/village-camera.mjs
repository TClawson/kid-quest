// The village's view follows the walking buddy smoothly: while a walk goes on, the view moves
// one way along each axis, and doesn't keep turning back and forth (it shook like an earthquake
// when the step aside from the HUD buttons was worked out on every frame of a walk).
// Run: node test/smoke/village-camera.mjs
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { at } from '../helpers/clock.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const day = '2026-11-09'; // a Monday
function family() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -20), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  return s;
}

// how many times a run of numbers turns back
const turns = (arr) => {
  let dir = 0; let n = 0;
  for (let i = 1; i < arr.length; i += 1) { const d = Math.sign(arr[i] - arr[i - 1]); if (d && dir && d !== dir) n += 1; if (d) dir = d; }
  return n;
};

const site = await serve('.');
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
    const ctx = await browser.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { throw e; });
    await page.clock.install({ time: at(day, '07:30') });
    await page.goto(site.url);
    await page.evaluate((s) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); Storage.prototype.setItem = () => {}; }, family());
    await page.reload();
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await page.clock.runFor(1500);
    for (let i = 0; i < 5; i += 1) { await closePops(page); await page.clock.runFor(400); }
    const box = await page.locator('.village-view').boundingBox();
    let seed = 7; const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const bad = [];
    for (let w = 0; w <= 20; w += 1) {
      await page.evaluate(() => document.querySelector('.v-dialog:not([hidden]) [data-v="bye"]')?.click());
      await closePops(page);
      await page.mouse.click(box.x + 40 + rnd() * (box.width - 80), box.y + 90 + rnd() * (box.height - 180));
      const xs = []; const ys = [];
      for (let f = 0; f < 150; f += 1) {
        await page.clock.runFor(16);
        const m = await page.evaluate(() => /translate\((-?\d+)px, (-?\d+)px\)/.exec(document.querySelector('.village-world').style.transform));
        xs.push(+m[1]); ys.push(+m[2]);
      }
      // a path may honestly turn back once or twice (round a pond); a shaking view turns many times
      if (turns(xs) > 3 || turns(ys) > 3) bad.push(`walk ${w}: x turned ${turns(xs)}, y turned ${turns(ys)}: ${ys.join(',')}`);
    }
    assert.deepEqual(bad, [], `${label}: the view shook while the buddy walked`);
    console.log(`ok ${label}: the view follows the walking buddy smoothly`);
    await ctx.close();
  }
} finally {
  await browser.close();
  site.close?.();
}
