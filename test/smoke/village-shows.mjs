// The village's walk-in and show effects:
// - visitors walk in to their spots the first time they show on a day (they move, then stand on
//   their spots), and a second open the same day has no walk-in
// - a landmark's show shakes the village (not the HUD) while the show says so (map-quake)
// - during the show the visitors and the kid's buddy hop, a visitor facing left still faces left
// Run: node test/smoke/village-shows.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { closePops, tapInVillage } from '../helpers/open-kid.mjs';
import { dateKey, addDays } from '../../js/logic.js';

const DAY = dateKey();

/** The made-up family, with Ayden on the volcano island and its treasure map finished (four pieces). */
function family() {
  const s = parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime());
  const ayden = s.kids[0];
  ayden.buddy.outfit.background = 'bg-volcano';
  ayden.owned = [...new Set([...(ayden.owned || []), 'bg-volcano'])];
  for (let i = 2; i <= 5; i += 1) {
    const key = addDays(DAY, -i);
    s.log[key] ||= {};
    s.log[key].kid_ayden ||= { tasks: {} };
    s.log[key].kid_ayden.chest = { tier: 'silver', kind: 'piece', map: 'bg-volcano' };
  }
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function openAyden(page) {
  await page.waitForSelector('[data-action="open-kid"], .screen.kid');
  if (await page.locator('[data-action="open-kid"][data-id="kid_ayden"]').count()) await page.click('[data-action="open-kid"][data-id="kid_ayden"]');
  await page.waitForSelector('.village .v-visitor');
}
/** Every visitor: where it is now, where its spot is, and its classes. */
const visitorsNow = (page) => page.evaluate(() => {
  const sec = document.querySelector('.village');
  const spots = JSON.parse(sec.dataset.v).spots;
  return {
    arrive: sec.dataset.arrive,
    list: [...sec.querySelectorAll('.v-visitor')].map((el) => ({ id: el.dataset.id, x: parseFloat(el.style.left), y: parseFloat(el.style.top), spot: spots[el.dataset.id], cls: el.className, scale: el.querySelector('.v-vbuddy').style.scale })),
  };
});

try {
  for (const viewport of [{ width: 1280, height: 800 }, { width: 412, height: 915 }]) {
    const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.clock.install({ time: new Date(`${DAY}T16:30:00`) });
    await page.goto(site.url);
    await page.evaluate((s) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.removeItem('kidquest.visitorsIn'); }, family());
    await page.reload();

    // ---- the first open today: the visitors walk in ----
    await openAyden(page);
    // they wait behind the start-of-day pop-ups, and set off once those are closed
    await page.clock.runFor(1500);
    if (await page.locator('#modal:not([hidden])').count()) {
      const held = await visitorsNow(page);
      await page.clock.runFor(1000);
      const still = await visitorsNow(page);
      assert.equal(still.arrive, 'walking', 'the walk-in waits while a pop-up is open');
      assert.deepEqual(still.list.map((v) => [v.x, v.y]), held.list.map((v) => [v.x, v.y]), 'nobody moves behind the pop-up');
    }
    for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) { await closePops(page); await page.clock.runFor(100); }
    const first = await visitorsNow(page);
    assert.ok(first.list.length >= 1, 'Ayden has visitors today');
    assert.equal(first.arrive, 'walking', 'the visitors walk in the first time today');
    const off = (v) => Math.hypot(v.x - v.spot.x, v.y - v.spot.y);
    assert.ok(first.list.some((v) => off(v) > 10), `a visitor starts away from its spot (${first.list.map(off).map((d) => d.toFixed(0))})`);
    assert.ok(first.list.every((v) => /\barriving\b/.test(v.cls) || off(v) < 0.6), 'walking visitors are marked as arriving (no bubble yet)');
    await page.clock.runFor(600);
    const mid = await visitorsNow(page);
    assert.ok(mid.list.some((v, i) => Math.hypot(v.x - first.list[i].x, v.y - first.list[i].y) > 2), 'the visitors move as they walk in');
    for (let i = 0; i < 40 && (await visitorsNow(page)).arrive !== 'done'; i += 1) await page.clock.runFor(250);
    const end = await visitorsNow(page);
    assert.equal(end.arrive, 'done', 'the walk-in ends');
    for (const v of end.list) {
      assert.ok(off(v) < 0.6, `${v.id} ends on its spot (${v.x},${v.y} vs ${v.spot.x},${v.spot.y})`);
      assert.ok(!/\b(arriving|walking)\b/.test(v.cls), `${v.id} is no longer walking`);
      assert.equal(v.scale, v.spot.face < 0 ? '-1 1' : '', `${v.id} faces the way it stands all day`);
    }

    // ---- a landmark's show: the village shakes (not the HUD), visitors and the buddy hop ----
    await closePops(page);
    await tapInVillage(page, '.v-landmark', { clock: true });
    let shook = false; let hopped = false; let hudStill = true; let faced = true;
    for (let i = 0; i < 12; i += 1) {
      const st = await page.evaluate(() => {
        const sec = document.querySelector('.village');
        const cs = (sel) => { const el = sec.querySelector(sel); return el ? getComputedStyle(el) : null; };
        return {
          on: sec.classList.contains('show-on'),
          quake: Boolean(sec.querySelector('.v-show.map-quake')),
          world: cs('.village-world')?.animationName,
          show: cs('.v-show')?.animationName,
          hud: [cs(':scope > .k-hud')?.animationName, cs(':scope > .k-hud')?.translate],
          visitor: cs('.v-visitor .v-vbuddy')?.animationName,
          buddy: cs('.v-buddy .v-flip')?.animationName,
          left: [...sec.querySelectorAll('.v-visitor')].map((el) => el.querySelector('.v-vbuddy').style.scale),
        };
      });
      if (st.quake) {
        shook = true;
        assert.equal(st.world, 'v-quake', 'the village world shakes during the quake');
        assert.equal(st.show, 'v-quake', "the show's canvas shakes with it");
      }
      if (st.hud[0] !== 'none' || (st.hud[1] && st.hud[1] !== 'none')) hudStill = false;
      if (st.on) {
        hopped = true;
        assert.equal(st.visitor, 'v-show-hop', 'visitors hop during the show');
        assert.equal(st.buddy, 'v-show-hop', "the kid's buddy hops during the show");
        if (st.left.join() !== end.list.map((v) => v.scale).join()) faced = false;
      }
      await page.clock.runFor(150);
    }
    assert.ok(shook, 'the volcano show shakes the village');
    assert.ok(hopped, 'the show is on (show-on) while it plays');
    assert.ok(hudStill, 'the HUD does not shake');
    assert.ok(faced, 'visitors keep facing the same way while they hop');
    await page.clock.runFor(15000);
    assert.equal(await page.locator('.village.show-on, .v-show.map-quake').count(), 0, 'the show ends, and with it the shaking and hopping');

    // ---- a second open the same day: no walk-in ----
    await page.reload();
    await openAyden(page);
    const again = await visitorsNow(page);
    assert.equal(again.arrive, 'no', 'no walk-in on the second open the same day');
    for (const v of again.list) assert.ok(off(v) < 0.6 && !/\barriving\b/.test(v.cls), `${v.id} is on its spot right away`);
    await ctx.close();
    console.log(`ok ${viewport.width}x${viewport.height}: walk-in (${first.list.length} visitors), shake, hop, no second walk-in`);
  }
  assert.deepEqual(errors, [], 'no page errors');
  console.log('village shows: all good');
} finally {
  await browser.close();
  site.close();
}
