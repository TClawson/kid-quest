// The turntable in the buddy's house (js/turntable.js) in the real app: the shop keeps it locked
// until the music house opens, then sells it for 300 coins, and it stands under the window.
// Walking up to it opens its pop-up with the kid's kept mixes, the mix on the studio desk and
// the Note-o-Matic's tunes. Play once plays a record (the record goes round, notes float up)
// and the village song makes way; House music puts one on repeat, which comes back on by
// itself the next time the buddy is in. Tapping it again goes back to the village song,
// muffled as if from outside, and walking out the door makes it clear again. Saves screenshots.
// Run: node test/smoke/turntable.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays, dateKey } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'previews/turntable').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = dateKey();
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 412, height: 915 };
const KID = 'kid_ava';
const furn = ['home-bed-quilt', 'home-table-round-blue-checks', 'home-couch-green-stripes', 'home-chair-cozy', 'home-hammock', 'home-lamp', 'home-rug-round-purple-stars', 'home-art-sunset'];

/** Ava with `days` days of every chore (21: the music house is open), her house furnished. */
function family({ days = 21, turntable = false, allDone = false } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  s.settings.sound = true;
  s.settings.music = true;
  const owned = [...furn, ...(turntable ? ['home-turntable'] : [])];
  const home = { bed: furn[0], table: furn[1], couch: furn[2], chair: furn[3], corner: furn[4], lamp: furn[5], rug: furn[6], art: furn[7], ...(turntable ? { music: 'home-turntable' } : {}) };
  const ava = { id: KID, name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned, home, spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  s.log[day] = { [KID]: { tasks: Object.fromEntries(ava.tasks.filter((t) => allDone || t.house).map((t) => [t.id, { status: 'done', by: allDone ? 'parent' : 'self' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function start(viewport, st, place = 'house') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { [KID]: { day, inside: place === 'house', place } }]);
  await page.reload();
  await openKid(page, `[data-action="open-kid"][data-id="${KID}"]`);
  await page.waitForTimeout(1200);
  await closeModals(page);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 8 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
}
const tap = (page, sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
const mods = (page) => page.evaluate(async () => {
  window.kqTT = await import('./js/turntable.js');
  window.kqMusic = await import('./js/music.js');
  window.kqCtx = await import('./js/ctx.js');
});
const now = (page) => page.evaluate(() => ({ ...window.kqTT.nowPlaying(), muffled: window.kqMusic.isMuffled(), map: window.kqMusic.isMusicPlaying() }));
async function shop(page) {
  await page.evaluate(() => { const { ui, render } = window.kqCtx; ui.view = 'wardrobe'; ui.slot = 'home'; render(); });
  await page.waitForSelector('.wardrobe [data-id="home-turntable"]', { state: 'attached' });
}
/** Two mixes and a tune kept in the studio, and a mix on the desk. */
const records = (page) => page.evaluate(async (kid) => {
  const R = await import('./js/studiorules.js');
  const S = await import('./js/studio-store.js');
  let m = R.newMix('Rocket jam');
  m = R.addPart(m, 0, 'bg-meadow', 'lead').mix;
  m = R.addBacking(m, 1, 'beat-rock', 'sunny', 0).mix;
  await S.saveMix(kid, 0, m);
  let w = R.newMix('Waltz party');
  w = R.addPart(w, 0, 'bg-meadow', 'bass').mix;
  await S.saveMix(kid, 2, w);
  await S.saveMix(kid, 'draft', R.addPart(R.newMix(), 0, 'bg-meadow', 'arp').mix);
  const notes = [60, 64, 67, 72, 67, 64, 60, 64].map((midi, i) => ({ at: i * 2, len: 2, midi }));
  await S.saveTune(kid, 1, { v: 1, id: 'tune-smoke', made: Date.now(), reading: 'tidy', bpm: 110, meter: 4, key: 'C', beats: 8, parts: [{ role: 'tune', notes, beats: 8 }], voice: 'flute', shift: 0 });
}, KID);
async function shot(page, name, sel = null) {
  const file = `${out}/${name}.png`;
  if (sel) await page.locator(sel).screenshot({ path: file }); else await page.screenshot({ path: file });
}

try {
  // ---- 1. the music house isn't open yet: the turntable is locked in the shop ----
  {
    const { ctx, page } = await start(TABLET, family({ days: 3, allDone: true }), 'out');
    await mods(page);
    await shop(page);
    const tag = await page.locator('[data-id="home-turntable"] small').first().textContent();
    assert.match(tag, /Opens with your music house/);
    await tap(page, '[data-id="home-turntable"]');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'no buying before the music house');
    await page.locator('[data-id="home-turntable"]').scrollIntoViewIfNeeded();
    await shot(page, '1-shop-locked', '[data-id="home-turntable"]');
    await ctx.close();
  }

  // ---- 2. it is: buy it for 300 coins, and it goes under the window ----
  {
    const { ctx, page } = await start(TABLET, family({ allDone: true }), 'out');
    await mods(page);
    await shop(page);
    await page.locator('[data-id="home-turntable"]').scrollIntoViewIfNeeded();
    assert.match(await page.locator('[data-id="home-turntable"] small').first().textContent(), /300/);
    await shot(page, '2-shop-open', '[data-id="home-turntable"]');
    await tap(page, '[data-id="home-turntable"]');
    await page.waitForSelector('#modal [data-action="buy-confirm"]');
    await shot(page, '3-buy', '#modal .modal-card');
    await tap(page, '#modal [data-action="buy-confirm"]');
    await page.waitForTimeout(300);
    const kid = await page.evaluate((id) => JSON.parse(localStorage.getItem('kidquest.v1')).kids.find((k) => k.id === id), KID);
    assert.ok(kid.owned.includes('home-turntable'));
    assert.equal(kid.home.music, 'home-turntable');
    assert.equal(kid.spent, 300);
    await ctx.close();
  }

  // ---- 3. in the house: the village song is muffled; the turntable plays ----
  {
    const { ctx, page } = await start(TABLET, family({ turntable: true }), 'house');
    await mods(page);
    await records(page);
    await page.waitForSelector('.house .h-spot[data-spot="music"]');
    await page.waitForFunction(() => window.kqMusic.isMusicPlaying());
    let n = await now(page);
    assert.ok(n.muffled && n.map, 'the village song plays, muffled, inside');
    await shot(page, '4-house-turntable');
    // walk up to it: its pop-up lists the records
    await tap(page, '.h-spot[data-spot="music"]');
    await page.waitForSelector('#modal .tt-row', { timeout: 15000 });
    const names = await page.locator('#modal .tt-row .tt-name b').allTextContents();
    assert.deepEqual(names, ['Rocket jam', 'Waltz party', 'On the studio desk', 'Tune 2']);
    await shot(page, '5-turntable-popup', '#modal .modal-card');
    // play the tune once: the village song makes way, the record goes round
    await page.locator('#modal .tt-row', { hasText: 'Tune 2' }).locator('[data-tt="once"]').click();
    await page.waitForFunction(() => window.kqTT.nowPlaying().key === 'tune:1' && !window.kqTT.nowPlaying().loading, null, { timeout: 20000 });
    await page.waitForTimeout(200);
    n = await now(page);
    assert.equal(n.mode, 'once');
    assert.equal(n.map, false, 'no village song over the record');
    assert.equal(await page.locator('#modal .tt-row.on [data-tt="stop"]').count(), 1, 'it can be stopped');
    await shot(page, '6-playing-once', '#modal .modal-card');
    // the mix on repeat as the house music
    await page.locator('#modal .tt-row', { hasText: 'Rocket jam' }).locator('[data-tt="loop"]').click();
    await page.waitForFunction(() => window.kqTT.nowPlaying().key === 'mix:0' && !window.kqTT.nowPlaying().loading, null, { timeout: 30000 });
    assert.equal((await now(page)).mode, 'loop');
    assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem('kidquest.turntable'))[id].loop, KID), 'mix:0');
    // turn it down
    await page.locator('#modal [data-tt-vol]').fill('3');
    assert.equal(await page.evaluate((id) => JSON.parse(localStorage.getItem('kidquest.turntable'))[id].vol, KID), 3);
    await shot(page, '7-house-music', '#modal .modal-card');
    await closeModals(page);
    await page.waitForTimeout(400);
    assert.ok(await page.locator('.house.tt-on').count(), 'the record goes round in the room');
    await shot(page, '8-room-playing');
    await ctx.close();
  }

  // ---- 4. the next time in, the house music comes back by itself; then back to the village song ----
  {
    const ctx = await browser.newContext({ viewport: TABLET, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    await page.evaluate(([s, house, deck]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); localStorage.setItem('kidquest.turntable', JSON.stringify(deck)); }, [family({ turntable: true }), { [KID]: { day, inside: true, place: 'house' } }, { [KID]: { loop: 'mix:0', vol: 6 } }]);
    await mods(page);
    await records(page);
    await page.reload();
    await openKid(page, `[data-action="open-kid"][data-id="${KID}"]`);
    await mods(page);
    await page.waitForFunction(() => window.kqTT.nowPlaying().key === 'mix:0' && !window.kqTT.nowPlaying().loading, null, { timeout: 30000 });
    assert.equal((await now(page)).map, false);
    await closeModals(page);
    // back to the village song: muffled
    await tap(page, '.h-spot[data-spot="music"]');
    await page.waitForSelector('#modal .tt-row', { timeout: 15000 });
    await page.locator('#modal .tt-row', { hasText: 'Rocket jam' }).locator('[data-tt="loop"]').click();
    await page.waitForFunction(() => window.kqMusic.isMusicPlaying() && !window.kqTT.nowPlaying().key);
    assert.ok((await now(page)).muffled);
    assert.match(await page.locator('#modal .tt-status').textContent(), /village music/);
    await closeModals(page);
    // out the door: the village song is clear again
    await tap(page, '.h-spot[data-spot="door"]');
    await page.waitForSelector('.village', { timeout: 15000 });
    await page.waitForTimeout(300);
    const n = await now(page);
    assert.ok(!n.muffled && n.map, 'outside, the song is clear');
    await ctx.close();
  }

  // ---- 5. a phone: the pop-up fits ----
  {
    const { ctx, page } = await start(PHONE, family({ turntable: true }), 'house');
    await mods(page);
    await records(page);
    await tap(page, '.h-spot[data-spot="music"]');
    await page.waitForSelector('#modal .tt-row', { timeout: 15000 });
    await page.waitForTimeout(1200); // the pop-up has risen
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(wide <= 412, `no sideways scroll: ${wide}`);
    const small = await page.$$eval('#modal .tt-row .btn', (els) => els.map((e) => e.getBoundingClientRect().height).filter((h) => h < 43.5));
    assert.deepEqual(small, [], 'buttons are at least 44 px tall');
    await shot(page, '9-phone-popup');
    await ctx.close();
  }
  assert.deepEqual(errors, []);
  console.log('turntable smoke: ok');
} finally {
  await browser.close();
  site.close?.();
}
