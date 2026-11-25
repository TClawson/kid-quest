// A buddy left alone in the village dozes off, but it never walks in its sleep: a tap on the
// ground that sends it walking wakes it first, and it stays awake for the whole walk.
// Run: node test/smoke/village-sleepwalk.mjs
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
  const buddy = '.v-buddy canvas.live-buddy';
  const state = () => page.evaluate((sel) => {
    const c = document.querySelector(sel);
    return { dozing: c?.dataset.dozing, walking: Boolean(c?.closest('.walking')) };
  }, buddy);

  // left alone for over two minutes, it falls asleep where it stands
  for (let i = 0; i < 26; i += 1) await page.clock.runFor(5000);
  assert.deepEqual(await state(), { dozing: '1', walking: false }, 'the buddy dozes off when left alone');

  // a tap on the ground walks it: it wakes up before it takes a step
  const box = await page.locator('.village-view').boundingBox();
  let walked = false;
  for (const [fx, fy] of [[0.2, 0.3], [0.8, 0.7], [0.3, 0.75], [0.75, 0.3]]) {
    await page.mouse.click(box.x + box.width * fx, box.y + box.height * fy);
    await page.clock.runFor(200);
    const s = await state();
    if (!s.walking) continue;
    walked = true;
    assert.equal(s.dozing, '0', 'the buddy wakes up as soon as it starts to walk');
    for (let f = 0; f < 20; f += 1) {
      await page.clock.runFor(100);
      const w = await state();
      if (w.walking) assert.equal(w.dozing, '0', 'the buddy stays awake while it walks');
    }
    break;
  }
  assert.ok(walked, 'a tap on the ground walked the buddy');
  console.log('ok: a dozing buddy wakes up before it walks, and stays awake on the way');
  await ctx.close();
} finally {
  await browser.close();
  site.close?.();
}
