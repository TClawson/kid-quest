// The music house (js/musichouse.js) in the real app: the music hall is locked until the
// first piano; with a piano the buddy walks in, and each better piano gives a new look; the
// piano opens the stopwatch, which fills today's piano chore and keeps counting past it.
// Saves screenshots too. Run: node test/smoke/music.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/music').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/**
 * Ava's family. o: { weeks: weeks of every chore done (piano too) before today, so her best
 * piano streak is about 5 x weeks days; piano: seconds already on today's piano timer }
 */
function family(o = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const days = (o.weeks ?? 3) * 7;
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow', music: o.weeks >= 6 ? 'music-rock' : undefined } } };
  s.kids.push(ava);
  for (let i = 1; i <= days; i += 1) {
    const key = addDays(day, -i);
    s.log[key] = { kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  }
  const piano = ava.tasks.find((t) => t.icon === '🎹');
  if (o.piano) s.log[day] = { kid_ava: { tasks: { [piano.id]: { status: 'inprogress', seconds: o.piano } } } };
  // every chore but the piano done today: the studio still waits
  if (o.choresDone) { s.log[day] ||= { kid_ava: { tasks: {} } }; for (const t of ava.tasks) if (t !== piano) s.log[day].kid_ava.tasks[t.id] = { status: 'done', by: 'parent' }; }
  // and the piano too: the studio opens, and the stopwatch is just for fun
  if (o.allDone) s.log[day].kid_ava.tasks[piano.id] = { status: 'done', by: 'parent', seconds: piano.minutes * 60 };
  return { s, piano };
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport, st, place = 'out', time = '16:00') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T${time}:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { kid_ava: { day, inside: place === 'house', place } }]);
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.clock.runFor(800);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
async function shot(page, name, sel) {
  if (sel) {
    await page.locator(sel).scrollIntoViewIfNeeded();
    const box = await page.locator(sel).boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: `${out}/${name}.png`, clip: { ...box, y: box.y + y }, fullPage: true });
  } else await page.screenshot({ path: `${out}/${name}.png` });
}
const tap = (page, sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));

const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 412, height: 915 };

// 1. no piano yet: the music hall is locked, and the frog says how far off it is
{
  const { ctx, page } = await open(TABLET, family({ weeks: 1 }).s);
  assert.equal(await page.locator('.v-music.locked').count(), 1, 'a locked music hall');
  await tap(page, '.v-music');
  await page.clock.runFor(9000);
  const text = await page.locator('.village .v-dialog .v-text').textContent();
  assert.match(text, /first piano/, `the frog explains: ${text}`);
  assert.match(text, /\d+ more piano days/, 'and how many piano days are left');
  await shot(page, '1-locked', '.village .village-view');
  assert.equal(await page.locator('.music-house').count(), 0, 'still outside');
  await ctx.close();
}

// 2. the little keyboard (tier 1): walk in from the village; the stopwatch fills the piano chore
{
  const { s, piano } = family({ weeks: 3, piano: 30 * 60 - 20 });
  const { ctx, page } = await open(TABLET, s);
  assert.equal(await page.locator('.v-music.open').count(), 1, 'an open music hall');
  await shot(page, '2a-hall-open', '.village .village-view');
  await tap(page, '.v-music');
  await page.clock.runFor(9000);
  assert.equal(await page.locator('.music-house.tier-1').count(), 1, 'inside the Cozy Studio');
  assert.match(await page.locator('.music-house .v-dialog .v-text').textContent(), /Welcome to your music house/);
  await shot(page, '2b-tier1-inside', '.music-house .village-view');
  await tap(page, '.music-house .v-dialog [data-m="bye"]');
  // the studio waits for today's chores
  await tap(page, '.m-station[data-spot="studio"]');
  await page.clock.runFor(4000);
  assert.match(await page.locator('.music-house .v-dialog .v-text').textContent(), /chores are done/);
  await shot(page, '2c-tier1-studio-waits', '.music-house .village-view');
  // the piano: the stopwatch
  await tap(page, '.m-station[data-spot="piano"]');
  await page.clock.runFor(5000);
  assert.equal(await page.locator('.watch').count(), 1, 'the stopwatch page');
  assert.equal((await page.locator('#watch-today').textContent()).trim(), '29:40', 'shows today\'s piano time so far');
  await page.click('[data-action="timer-start"]');
  await page.clock.runFor(30000);
  // 20 s filled the chore (a parent checks it): ask later, the stopwatch keeps going
  assert.match(await page.locator('#modal').textContent(), /parent needs to check/);
  await page.click('[data-action="pin-later"]');
  await page.clock.runFor(15000);
  assert.match(await page.locator('#watch-goal').textContent(), /Goal done ✓ \+0:2\d extra/);
  await shot(page, '2d-stopwatch-past-goal');
  // pause (saves right away), then back to the music house, then out the door to the village
  await page.click('[data-action="timer-pause"]');
  const st = await saved(page);
  const today = st.log[day].kid_ava;
  assert.equal(today.tasks[piano.id].seconds, 30 * 60, 'the chore is full');
  assert.equal(today.tasks[piano.id].status, 'pending', 'waiting for a parent');
  assert.ok(today.pianoExtra >= 24 && today.pianoExtra <= 26, `extra practice counted (${today.pianoExtra})`);
  await page.click('[data-action="watch-back"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.music-house').count(), 1, 'back in the music house');
  await tap(page, '.music-house .h-spot[data-spot="door"]');
  await page.clock.runFor(6000);
  assert.equal(await page.locator('.village').count(), 1, 'out in the village');
  await ctx.close();
}

// 3. the upright piano (tier 2) and the rock star piano (tier 3): new looks, greeted once
for (const [weeks, tier] of [[5, 2], [7, 3]]) {
  const { ctx, page } = await open(TABLET, family({ weeks, choresDone: true }).s, 'music');
  assert.equal(await page.locator(`.music-house.tier-${tier}`).count(), 1, `tier ${tier} look`);
  await page.clock.runFor(1500);
  await shot(page, `3-tier${tier}-hello`, '.music-house .village-view');
  await tap(page, '.music-house .v-dialog [data-m="bye"]');
  // every station can be walked to, and the buddy ends up next to it
  for (const [spot, said] of [['sheets', /Sheet music/], ['studio', /chores are done: 1 to go/], ['lab', /Note-o-Matic/]]) {
    await tap(page, `.m-station[data-spot="${spot}"]`);
    await page.clock.runFor(6000);
    const text = await page.locator('.music-house .v-dialog .v-text').textContent();
    assert.match(text, said, `tier ${tier}: ${spot} says ${text}`);
    const near = await page.evaluate((id) => document.querySelector(`.m-station[data-spot="${id}"]`).classList.contains('near'), spot);
    assert.ok(near, `tier ${tier}: the buddy is next to the ${spot}`);
    if (spot === 'lab') await shot(page, `3-tier${tier}-lab`, '.music-house .village-view');
    await tap(page, '.music-house .v-dialog [data-m="bye"]');
  }
  await tap(page, '.m-station[data-spot="piano"]');
  await page.clock.runFor(6000);
  assert.equal(await page.locator('.watch').count(), 1, `tier ${tier}: the piano opens the stopwatch`);
  await page.click('[data-action="watch-back"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator(`.music-house.tier-${tier}`).count(), 1, 'back inside');
  await ctx.close();
}

// 4. phones: the arena with every chore done (the studio opens), and the stopwatch past the goal
{
  const { s, piano } = family({ weeks: 7, choresDone: true, allDone: true });
  const { ctx, page } = await open(PHONE, s, 'music');
  await page.clock.runFor(1500);
  await shot(page, '4-phone-arena', '.music-house .village-view');
  await tap(page, '.music-house .v-dialog [data-m="bye"]');
  await tap(page, '.m-station[data-spot="studio"]');
  await page.clock.runFor(6000);
  assert.match(await page.locator('.music-house .v-dialog .v-text').textContent(), /recording studio is almost ready/);
  await tap(page, '.music-house .v-dialog [data-m="bye"]');
  await tap(page, '.m-station[data-spot="piano"]');
  await page.clock.runFor(6000);
  assert.equal((await page.locator('#watch-goal').textContent()).trim(), 'Goal done ✓');
  await page.click('[data-action="timer-start"]');
  await page.clock.runFor(65000);
  assert.equal((await page.locator('#watch-today').textContent()).trim(), `${piano.minutes + 1}:05`);
  assert.match(await page.locator('#watch-goal').textContent(), /\+1:05 extra/);
  assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'nothing to approve again');
  await shot(page, '4-phone-stopwatch');
  await page.click('[data-action="timer-pause"]');
  const st = await saved(page);
  assert.equal(st.log[day].kid_ava.tasks[piano.id].status, 'done', 'the done chore is left alone');
  assert.equal(st.log[day].kid_ava.pianoExtra, 65);
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`music house ok: ${out}`);
