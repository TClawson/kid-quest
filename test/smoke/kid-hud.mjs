// The kid's screen is the village, full screen, with a HUD and pop-ups:
// - the village fills the screen at 1280x800, 800x1280 and 412x915, and the page doesn't scroll
// - the buddy plate and the coins pill open Status, the Menu button the Menu, Today the list;
//   the family pill tells how the family is doing; the locked shop says why it's shut
// - every Status tab shows its part (Me, This week, Habits, Trophies), and its links work; Me's
//   buddy is live (it moves untouched) and goes with the pop-up
// - a visitor arriving while a pop-up is open is in the village as soon as the pop-up closes
// - visitors' speech bubbles never sit under the HUD or the arrows (walking round, three sizes)
// - the Menu: music and sounds switch (no Old map any more), Switch kid only with more than one
//   kid, Parents asks for the PIN
// - a tap on the ground lands where it was tapped, and a tap on a villager walks there and talks
//   (the HUD hides meanwhile)
// - the house is drawn at a whole-number scale that fits (4x at 1280x800) and its chores work
// - back from the shop and from the piano timer is the full-screen village again
// Run: node test/smoke/kid-hud.mjs [outDir]   (outDir: also save screenshots)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { emptyState, addDays, fallbackHash } from '../../js/logic.js';
import { TEST_DAY } from '../helpers/clock.mjs';

const out = process.argv[2]?.replace(/\/$/, '');
if (out) fs.mkdirSync(out, { recursive: true });
const DAY = TEST_DAY; // the page's clock is installed at a time of this day (see clock.mjs)
const ALL = [0, 1, 2, 3, 4, 5, 6];
const SIZES = [{ width: 1280, height: 800 }, { width: 800, height: 1280 }, { width: 412, height: 915 }];

// One kid on her own tablet (the bed is her house chore).
function soloFamily() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'map'; // saved when there was an old map to choose: ignored, the village opens
  const tasks = [
    { id: 'e_bed', name: 'Make bed', icon: '🛏️', period: 'morning', days: ALL, verify: 'self', minutes: 0, house: 'bed' },
    { id: 'e_cat', name: 'Feed the cat', icon: '🐱', period: 'morning', days: ALL, verify: 'self', minutes: 0 },
    { id: 'e_read', name: 'Reading', icon: '📖', period: 'afternoon', days: ALL, verify: 'self', minutes: 0 },
  ];
  const start = addDays(DAY, -10);
  s.kids.push({ id: 'kid_esther', name: 'Esther', color: '#da77f2', tasks, startDate: start, seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'cat', outfit: { background: 'bg-meadow' } } });
  for (let i = 1; i <= 9; i += 1) s.log[addDays(DAY, -i)] = { kid_esther: { tasks: Object.fromEntries(tasks.map((t) => [t.id, { status: 'done', by: 'self' }])), chest: { tier: 'wood', kind: 'coins', coins: 5 } } };
  s.celebrations = { kid_esther: { sat: DAY, reward: DAY } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport, st, { place = 'out', time = '16:30' } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: out ? 2 : 1, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${DAY}T${time}:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, place, day]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    localStorage.setItem('kidquest.house', JSON.stringify(Object.fromEntries(s.kids.map((k) => [k.id, { day, inside: place === 'house', place }]))));
  }, [st, place, DAY]);
  await page.reload();
  return { ctx, page };
}
async function openKid(page, id) {
  await page.waitForSelector('[data-action="open-kid"], .screen.kid');
  if (await page.locator(`[data-action="open-kid"][data-id="${id}"]`).count()) await page.click(`[data-action="open-kid"][data-id="${id}"]`);
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.clock.runFor(600);
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png` }); };
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
async function waitFor(page, sel, what, tries = 40) {
  for (let i = 0; i < tries && !(await page.locator(sel).count()); i += 1) await page.clock.runFor(500);
  assert.ok(await page.locator(sel).count(), what);
}
const toastText = async (page) => { await page.clock.runFor(100); return page.locator('.toast').innerText(); };
/** The screen is the view: no page scroll, and the place's view covers the whole window. */
async function fullScreen(page, sel, what) {
  const r = await page.evaluate((sel) => {
    const v = document.querySelector(`${sel} .village-view`).getBoundingClientRect();
    window.scrollTo(0, 400);
    return { v: [v.left, v.top, v.width, v.height], w: [innerWidth, innerHeight], scroll: window.scrollY, tall: document.documentElement.scrollHeight, full: document.documentElement.classList.contains('kid-full') };
  }, sel);
  assert.deepEqual(r.v.map(Math.round), [0, 0, r.w[0], r.w[1]], `${what}: the view fills the screen`);
  assert.equal(r.scroll, 0, `${what}: the page doesn't scroll`);
  assert.ok(r.tall <= r.w[1], `${what}: nothing below the view`);
  assert.ok(r.full, `${what}: full-screen mode`);
}
/**
 * Walks the buddy round the village (taps on the ground, top to bottom) and, at every stop,
 * checks that no visitor's speech bubble that shows is off screen, under an arrow or under a HUD
 * button. Returns how many bubbles showed along the way.
 */
async function bubblesClear(page, tag) {
  const { W, H } = await page.evaluate(() => { const w = document.querySelector('.village-world'); return { W: w.offsetWidth, H: w.offsetHeight }; });
  let shown = 0;
  for (const fy of [0.2, 0.5, 0.75, 0.95]) {
    for (const fx of [0.2, 0.5, 0.8]) {
      await page.evaluate(([x, y]) => {
        const view = document.querySelector('.village-view'); const r = document.querySelector('.village-world').getBoundingClientRect();
        const S = r.width / document.querySelector('.village-world').offsetWidth;
        view.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + x * S, clientY: r.top + y * S }));
      }, [W * fx, H * fy]);
      for (let k = 0; k < 40 && await page.locator('.village .v-buddy.walking').count(); k += 1) await page.clock.runFor(250);
      await page.clock.runFor(1200);
      const res = await page.evaluate(() => {
        const ov = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
        const bubs = [...document.querySelectorAll('.village .v-visitor .visitor-bubble')].filter((b) => Number(getComputedStyle(b).opacity) > 0.5).map((b) => ({ r: b.getBoundingClientRect(), t: b.textContent }));
        const arrows = [...document.querySelectorAll('.village .v-arrow')].map((a) => a.getBoundingClientRect());
        const hud = [...document.querySelectorAll('.village > .k-hud button, .village > .k-hud .v-hud')].filter((h) => h.getClientRects().length).map((h) => h.getBoundingClientRect());
        const bad = [];
        for (const b of bubs) {
          if (b.r.left < 0 || b.r.right > innerWidth || b.r.top < 0 || b.r.bottom > innerHeight) bad.push(`off screen: ${b.t}`);
          if (arrows.some((a) => ov(a, b.r))) bad.push(`under an arrow: ${b.t}`);
          if (hud.some((a) => ov(a, b.r))) bad.push(`under the HUD: ${b.t}`);
        }
        return { bad, n: bubs.length };
      });
      assert.deepEqual(res.bad, [], `${tag}, walked to ${fx},${fy}: bubbles clear of the HUD and the arrows`);
      shown += res.n;
    }
  }
  return shown;
}
/** The world's scale (screen pixels a game pixel), from its transform. */
const worldScale = (page, sel) => page.locator(`${sel} .village-world`).evaluate((el) => new DOMMatrix(getComputedStyle(el).transform).a);

try {
  // ---- the family tablet: full screen at three sizes
  for (const viewport of SIZES) {
    const { ctx, page } = await open(viewport, parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime()));
    await openKid(page, 'kid_ayden');
    const tag = `${viewport.width}x${viewport.height}`;
    await fullScreen(page, '.village', `village ${tag}`);
    assert.equal(await worldScale(page, '.village'), viewport.width < 600 ? 2 : 3, `whole-number village pixels at ${tag}`);
    for (const sel of ['.k-plate', '.k-pill', '.k-menu', '.k-fam', '.k-hud [data-action="today"]', '.k-shop']) {
      const b = await page.locator(sel).boundingBox();
      assert.ok(b, `${sel} shows at ${tag}`);
      const min = viewport.width < 600 ? 44 : 60;
      assert.ok(b.width >= min && b.height >= min, `${sel} is at least ${min}px at ${tag} (${Math.round(b.width)}x${Math.round(b.height)})`);
      assert.ok(b.x >= 0 && b.y >= 0 && b.x + b.width <= viewport.width && b.y + b.height <= viewport.height, `${sel} is on screen at ${tag}`);
    }
    // the old page's chrome is gone
    for (const sel of ['.kid-head', '.buddy-panel', '.exercise', '.view-toggle', '.music-toggle', '.family-banner', '.garden-line', '.habits', '.week']) assert.equal(await page.locator(`#app ${sel}`).count(), 0, `no ${sel} around the village`);
    await shot(page, `village-${tag}`);
    assert.ok(await bubblesClear(page, tag) > 0, `visitors talk somewhere along the way at ${tag}`);
    await ctx.close();
  }

  // ---- the HUD's buttons and the pop-ups (landscape tablet, four kids)
  {
    const { ctx, page } = await open(SIZES[0], parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime()));
    await openKid(page, 'kid_ayden');
    assert.match(await page.locator('.k-plate').innerText(), /Ayden\s*Lv \d+/);
    assert.match(await page.locator('.k-pill').innerText(), /🔥 \d+\s*🪙 \d+\s*💎 \d+/, 'streak, coins and gems');

    // the plate and the pill open Status
    for (const sel of ['.k-plate', '.k-pill']) {
      await page.click(sel);
      await page.waitForSelector('.status-pop');
      assert.equal(await page.locator('.p-tabs [data-tab="me"]').getAttribute('aria-selected'), 'true', `${sel}: Status opens on Me`);
      await closeModals(page);
    }
    // every Status tab
    await page.click('.k-plate');
    assert.match(await page.locator('.status-pop .p-sub').innerText(), /Level \d+ · \d+ XP to level \d+/);
    const me = page.locator('.status-pop .p-body');
    assert.equal(await me.locator('.s-tile').count(), 4, 'streak, freezes, coins, gems');
    assert.match(await me.innerText(), /day streak · best \d+/);
    assert.match(await me.innerText(), /streak freeze/);
    assert.match(await me.innerText(), /\d+ of 300 this week/, 'coins this week');
    assert.ok(await me.locator('.week .dot').count() === 7, 'the week boxes');
    assert.match(await me.innerText(), /Friday/, 'the Friday reward line');
    assert.match(await me.innerText(), /exercise/, 'the strong weeks line');
    assert.match(await me.innerText(), /Family: 20 of 29/, 'the family line');
    assert.ok(await me.locator('.garden-line').count(), 'the village plants line');
    assert.ok(await me.locator('.s-say').innerText(), "the buddy's line");
    // the big buddy is the live one (as on the old buddy panel): it moves on its own, blinking and looking about
    assert.equal(await me.locator('.s-big canvas.live-buddy').count(), 1, 'the big buddy is live');
    const frames = new Set();
    for (let i = 0; i < 12; i += 1) { frames.add(await me.locator('.s-big canvas.live-buddy').evaluate((c) => c.toDataURL())); await page.clock.runFor(500); }
    assert.ok(frames.size > 1, `it moves without being tapped (${frames.size} different frames in 6 s)`);
    await shot(page, 'status-me');
    await page.click('.p-tabs [data-tab="week"]');
    const week = page.locator('.status-pop .p-body');
    assert.match(await week.innerText(), /Streak \d+ days?/);
    assert.match(await week.innerText(), /Best \d+ days?/);
    assert.match(await week.innerText(), /This month/);
    assert.match(await week.innerText(), /Bonus exercise/);
    assert.match(await week.innerText(), /streak freeze/);
    assert.ok(await week.locator('.ex-week').count(), 'the exercise week');
    await page.click('.p-tabs [data-tab="habits"]');
    assert.ok(await page.locator('.status-pop .habit-row').count(), 'the habits');
    assert.ok(await page.locator('.status-pop .habits [data-action="plan"]').count(), 'Plan my day in Habits');
    await page.click('.p-tabs [data-tab="trophies"]');
    assert.ok(await page.locator('.status-pop .trophy-shelf .trophy').count(), 'the trophy shelf');
    assert.ok(await page.locator('.status-pop .treasure-maps').count(), 'the treasure maps');
    await shot(page, 'status-trophies');
    // the links at its foot
    await page.click('.p-foot [data-action="status-scores"]');
    await page.waitForSelector('#modal .leaderboard');
    await closeModals(page);
    await page.click('.k-plate');
    await page.click('.p-foot [data-action="status-fish"]');
    await page.waitForSelector('#modal .fishbook');
    await closeModals(page);
    await page.click('.k-plate');
    await page.click('.p-foot [data-action="plan"]');
    await page.waitForSelector('#modal .plan');
    await closeModals(page);
    // Change outfit, with the shop shut: it says why
    await page.click('.k-plate');
    await page.click('[data-action="status-outfit"]');
    assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'Status closes');
    assert.match(await toastText(page), /Finish today's chores|parent/, 'and the shut shop says why');
    await page.clock.runFor(3000);

    // the locked shop button says why
    assert.ok(await page.locator('.k-shop.locked .k-lock').count(), 'a padlock on the shop');
    await page.click('.k-shop');
    assert.equal(await page.locator('.wardrobe').count(), 0, 'no shop yet');
    assert.match(await toastText(page), /🔒 .*(Finish today's chores first \(\d+ to go|approves)/, 'the lock explains itself');
    await shot(page, 'shop-locked');
    await page.clock.runFor(3000);

    // the family pill
    await page.click('.k-fam');
    assert.match(await toastText(page), /Family: 20 of 29 chores done/);
    await page.clock.runFor(3000);

    // Today
    await page.click('.k-hud [data-action="today"]');
    await page.waitForSelector('.today-pop');
    await closeModals(page);

    // the Menu
    await page.click('.k-menu');
    await page.waitForSelector('.menu-pop');
    const items = await page.$$eval('.menu-pop .m-item', (els) => els.map((e) => e.dataset.action));
    assert.deepEqual(items, ['menu-music', 'menu-sound', 'plan', 'menu-switch', 'menu-parents'], 'the Menu, with Switch kid for four kids');
    assert.match(await page.locator('[data-action="menu-parents"]').innerText(), /PIN · \d+ waiting/, 'Parents shows how many wait');
    assert.match(await page.locator('[data-action="menu-sound"]').innerText(), /Off/);
    await shot(page, 'menu');
    await page.click('[data-action="menu-sound"]');
    assert.match(await page.locator('[data-action="menu-sound"]').innerText(), /On/, 'sounds on');
    assert.equal((await saved(page)).settings.sound, true);
    assert.match(await page.locator('[data-action="menu-music"]').innerText(), /On/, 'music on');
    await page.click('[data-action="menu-music"]');
    assert.match(await page.locator('[data-action="menu-music"]').innerText(), /Off/, 'music off');
    assert.equal((await saved(page)).settings.music, false, 'kept on this device');
    await page.click('[data-action="menu-music"]');
    assert.notEqual((await saved(page)).settings.music, false, 'and back on');
    await page.click('[data-action="menu-sound"]');
    assert.equal((await saved(page)).settings.sound, false, 'sounds off again');
    await closeModals(page);

    // Switch kid, then Parents (PIN)
    await page.click('.k-menu');
    await page.click('[data-action="menu-switch"]');
    await page.waitForSelector('[data-action="open-kid"]');
    await page.click('[data-action="open-kid"][data-id="kid_ayden"]');
    await page.clock.runFor(800);
    await closeModals(page);
    await page.click('.k-menu');
    await page.click('[data-action="menu-parents"]');
    await page.waitForSelector('#modal .pin');
    await page.click('#modal [data-pin="cancel"]');
    await page.clock.runFor(400);
    assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'Cancel closes the PIN');

    // tap the ground: the buddy walks to exactly where it was tapped
    const view = await page.locator('.village .village-view').boundingBox();
    const tap = { x: Math.round(view.width * 0.62), y: Math.round(view.height * 0.55) };
    await page.mouse.click(tap.x, tap.y);
    const land = await page.evaluate(() => {
      const t = document.querySelector('.village .v-target');
      const r = t.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, hidden: t.hidden };
    });
    assert.equal(land.hidden, false, 'the tap is marked');
    assert.ok(Math.abs(land.x - tap.x) < 3 && Math.abs(land.y - tap.y) < 3, `the mark is where the tap was (${Math.round(land.x)},${Math.round(land.y)} vs ${tap.x},${tap.y})`);
    // a tap on a villager: the buddy walks over and the talk box opens; the HUD steps aside
    await page.locator('.village .villager[data-vid]').first().evaluate((el) => el.click());
    await waitFor(page, '.village .v-dialog:not([hidden])', 'the villager talks');
    assert.equal(await page.locator('.village .k-hud').isVisible(), false, 'the HUD hides while talking');
    await shot(page, 'talk');
    await page.click('.village .v-dialog [data-v="bye"]');
    await page.clock.runFor(400);
    assert.ok(await page.locator('.village .k-hud').isVisible(), 'and comes back');
    await ctx.close();
  }

  // ---- Remington: the piano timer and back; Esther: the shop and back
  {
    const { ctx, page } = await open(SIZES[0], parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime()));
    await openKid(page, 'kid_remi');
    await page.click('.k-hud [data-action="today"]');
    await page.click('.t-q[data-id="r_piano"] [data-action="today-go"]');
    await waitFor(page, '.village .v-dialog:not([hidden]) [data-v="do"]', 'the piano villager talks');
    await page.click('.village .v-dialog [data-v="do"]');
    await page.waitForSelector('[data-action="timer-back"]');
    await page.click('[data-action="timer-back"]');
    await page.waitForSelector('.village .k-hud');
    await fullScreen(page, '.village', 'back from the piano timer');

    await page.click('.k-menu');
    await page.click('[data-action="menu-switch"]');
    await page.click('[data-action="open-kid"][data-id="kid_esther"]');
    await page.clock.runFor(1500);
    await closeModals(page);
    assert.ok(await page.locator('.k-shop.open').count(), "Esther's shop is open");
    await page.click('.k-shop');
    await page.waitForSelector('[data-action="wardrobe-back"]');
    // the shop's tabs: one row of kinds, a second for the kind with more than one
    assert.equal(await page.locator('.shop-tabs .kinds button').count(), 5);
    assert.equal(await page.locator('.shop-tabs .sub button').count(), 4, 'hats, glasses, extras, magic');
    const rows = await page.$$eval('.shop-tabs .kinds button', (els) => new Set(els.map((e) => Math.round(e.getBoundingClientRect().top))).size);
    assert.equal(rows, 1, 'the kinds fit one row on the tablet');
    await page.click('.shop-tabs .kinds [data-slot="home"]');
    assert.deepEqual(await page.$$eval('.shop-tabs .sub button', (els) => els.map((e) => e.dataset.slot)), ['home', 'garden']);
    await page.click('[data-action="wardrobe-back"]');
    await page.waitForSelector('.village .k-hud');
    await fullScreen(page, '.village', 'back from the shop');
    // Change outfit opens the shop when it's open
    await page.click('.k-plate');
    await page.click('[data-action="status-outfit"]');
    await page.waitForSelector('[data-action="wardrobe-back"]');
    await ctx.close();
  }

  // ---- the house at each size: a whole-number scale that fits, and its chores
  for (const viewport of SIZES) {
    const { ctx, page } = await open(viewport, soloFamily(), { place: 'house', time: '07:30' });
    await openKid(page, 'kid_esther');
    const tag = `${viewport.width}x${viewport.height}`;
    await page.waitForSelector('.house .k-hud');
    await fullScreen(page, '.house', `house ${tag}`);
    const S = await worldScale(page, '.house');
    assert.ok(Number.isInteger(S), `a whole-number scale at ${tag} (${S})`);
    assert.equal(S, { 1280: 4, 800: 3, 412: 2 }[viewport.width], `the house's scale at ${tag}`);
    await shot(page, `house-${tag}`);
    if (viewport.width === 1280) {
      await page.locator('.house .h-chore[data-chore="bed"]').evaluate((el) => el.click());
      await waitFor(page, '.house .v-dialog:not([hidden]) [data-h="do"]', 'the bed talks');
      await page.click('.house .v-dialog [data-h="do"]');
      await page.clock.runFor(1500);
      assert.equal((await saved(page)).log[DAY].kid_esther.tasks.e_bed?.status, 'done', 'the bed is made');
      await closeModals(page);
    }
    await ctx.close();
  }

  // ---- one kid on her own tablet: no Switch kid; a device that once chose the old map opens the village
  {
    const { ctx, page } = await open(SIZES[2], soloFamily(), { time: '07:30' });
    await page.waitForSelector('.screen.kid');
    await page.clock.runFor(1500);
    await closeModals(page);
    await page.waitForSelector('.village .k-hud');
    await fullScreen(page, '.village', 'one-kid phone');
    assert.equal(await page.locator('.k-fam').count(), 0, 'no family pill for one kid');
    await page.click('.k-menu');
    assert.equal(await page.locator('[data-action="menu-switch"]').count(), 0, 'no Switch kid');
    assert.equal(await page.locator('[data-action="old-map"]').count(), 0, 'no Old map');
    await closeModals(page);

    // the live buddy in Status goes when Status closes, so nothing moves behind the village
    await page.click('.k-plate');
    await page.waitForSelector('.status-pop .s-big canvas.live-buddy');
    // a visiting buddy arrives (the family's buddies change) while Status is open: the village
    // waits under the pop-up, and the visitor is there as soon as it closes
    assert.equal(await page.locator('.village .v-visitor').count(), 0, 'no visitors yet');
    await page.evaluate(async () => {
      const { buddiesChanged } = await import('./js/sync-ui.js');
      buddiesChanged([{ id: 'kid_ayden', name: 'Ayden', color: '#4dabf7', owned: [], buddy: { species: 'dino', outfit: {} } }]);
    });
    await page.clock.runFor(300);
    assert.equal(await page.locator('.village .v-visitor').count(), 0, 'not drawn under the pop-up');
    await closeModals(page);
    assert.equal(await page.locator('.village .v-visitor[data-id="kid_ayden"]').count(), 1, 'the visitor is there once Status closes');
    assert.equal(await page.locator('canvas.live-buddy').evaluateAll((cs) => cs.filter((c) => c.closest('#modal')).length), 0, 'no live buddy left in the pop-up');
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('kid hud smoke ok');
} finally {
  await browser.close();
  site.close();
}
