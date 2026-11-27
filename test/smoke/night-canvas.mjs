// Browser test: the village at night never puts a CSS filter on a <canvas>.
// On the family's Android tablet (2026-11-27) filter: url(#svg) on a canvas drew nothing at all:
// villagers vanished leaving their fishbowls, the rainforest's vine and the garden's trees went.
// The canvases take the night's colors in their own pixels instead (nightfx.js nightPixels):
//   - at night no canvas in the village has a filter, on every map
//   - a villager's sprite is painted in night colors (darker and bluer than by day), lit ones warm
//   - the map's critters (the rainforest's vine, sloth...) are still drawn on the life canvas
// Run: node test/smoke/night-canvas.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays } from '../../js/logic.js';
import { closePops } from '../helpers/open-kid.mjs';

const DAY = '2026-11-27';
const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function village(map, night) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(DAY, -30), seenUnlocks: [], seenMoves: [], spent: 0, owned: [map], buddy: { species: 'fox', outfit: { background: map } } });
  // on vacation in Germany: morning there, the middle of the night in Denver
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, timezoneId: 'Europe/Berlin' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${map}: ${e.message}`));
  await page.clock.install({ time: new Date(`${DAY}T08:15:00Z`) });
  await page.goto(`${site.url}manifest.webmanifest`);
  await page.evaluate(([st, n]) => { localStorage.clear(); localStorage.setItem('kidquest.v1', JSON.stringify(st)); if (n) localStorage.setItem('kidquest.night', n); }, [s, night ? null : 'day']);
  await page.goto(site.url);
  await page.waitForSelector('section.village');
  await page.clock.runFor(1200);
  await closePops(page);
  await page.clock.runFor(400);
  return { page, ctx };
}

const look = (page) => page.evaluate(() => {
  const sec = document.querySelector('section.village');
  const filtered = [...sec.querySelectorAll('canvas')].filter((c) => getComputedStyle(c).filter !== 'none').map((c) => c.className);
  // the average color of each villager's sprite (its solid pixels)
  const folk = [...sec.querySelectorAll('.villager .v-sprite')].map((c) => {
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let r = 0; let g = 0; let b = 0; let n = 0;
    for (let i = 0; i < d.length; i += 4) if (d[i + 3] > 200) { r += d[i]; g += d[i + 1]; b += d[i + 2]; n += 1; }
    return { n, r: r / n, g: g / n, b: b / n, lit: c.closest('.villager').classList.contains('v-lit') };
  });
  const life = sec.querySelector('.v-life');
  let drawn = 0;
  if (life) { const d = life.getContext('2d').getImageData(0, 0, life.width, life.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) drawn += 1; }
  return { night: sec.classList.contains('night'), filtered, folk, drawn };
});

try {
  for (const map of ['bg-meadow', 'bg-ocean', 'bg-space', 'bg-rainforest', 'bg-fjord', 'bg-castle']) {
    const day = await village(map, false);
    const byDay = await look(day.page);
    await day.ctx.close();
    const nt = await village(map, true);
    const at = await look(nt.page);
    assert.equal(byDay.night, false, `${map}: a parent's "day" try-out shows the day`);
    assert.equal(at.night, true, `${map}: it is night in Denver`);
    assert.deepEqual(at.filtered, [], `${map}: no canvas has a CSS filter at night`);
    assert.ok(at.folk.length > 0, `${map}: villagers stand in the village`);
    for (const [i, f] of at.folk.entries()) {
      const d = byDay.folk[i];
      assert.equal(f.n, d.n, `${map}: villager ${i} is drawn whole at night`);
      if (!f.lit) assert.ok(f.r < d.r && f.g < d.g && f.b - f.r > d.b - d.r - 1, `${map}: villager ${i} is moonlit (darker, bluer)`);
      else assert.ok(f.r + f.g + f.b < d.r + d.g + d.b + 30, `${map}: villager ${i} is warm in the light`);
    }
    if (byDay.drawn) assert.ok(at.drawn > byDay.drawn * 0.5, `${map}: the map's critters are drawn at night (${at.drawn} vs ${byDay.drawn} by day)`);
    await nt.ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('night canvas test passed');
} finally {
  await browser.close();
  site.close();
}
