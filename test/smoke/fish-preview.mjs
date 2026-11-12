// Previews of the fish tank and the fish book in the buddy's house (js/house.js, js/fishbook.js):
// the room with a named fish in the tank (tablet and phone), the fish book, the tank's fish
// picker, an empty tank, and the "New fish!" / "New record!" notes on the fishing game's catch card.
// Run: node test/smoke/fish-preview.mjs <outDir> [--video]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { FISH_SPECIES } from '../../js/fishbook.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'previews').replace(/\/$/, '');
const video = process.argv.includes('--video');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11';

// Ava has fished a fair bit at Forest Lake and the reef, and once at the castle
const CAUGHT = { 'meadow-bluegill': 8, 'meadow-smallmouth': 15, 'meadow-largemouth': 19, 'meadow-pike': 31, 'meadow-trout': 21, 'ocean-bluegill': 6, 'ocean-largemouth': 17, 'ocean-sword': 38, 'ocean-catfish': 22, 'castle-pike': 26, 'sunset-bluegill': 7 };
function records() {
  const r = {};
  let i = 0;
  for (const [id, size] of Object.entries(CAUGHT)) {
    const sp = FISH_SPECIES.find((s) => s.id === id);
    r[id] = { size, points: 20 + size, map: sp.map, date: addDays(day, -(i += 2)) };
  }
  return r;
}

function family(o = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const tasks = defaultTasks();
  const furn = ['home-bed-quilt', 'home-table-round-blue-checks', 'home-couch-green-stripes', 'home-chair-cozy', 'home-hammock', 'home-lamp', 'home-rug-round-purple-stars', 'home-art-sunset'];
  s.kids.push({
    id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(day, -40), seenUnlocks: [], seenMoves: [], spent: 0,
    owned: ['sport-soccer-good', 'sport-rod-super', 'sport-shoes-good', ...furn],
    home: { bed: furn[0], table: furn[1], couch: furn[2], chair: furn[3], corner: furn[4], lamp: furn[5], rug: furn[6], art: furn[7] },
    buddy: { species: 'fox', outfit: { background: o.map || 'bg-meadow', hat: 'hat-cap' } },
    ...(o.records === false ? {} : { fishRecords: records() }),
    ...(o.tank ? { tank: o.tank } : {}),
  });
  // every chore done today, so the room is tidy and the store is open
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done', by: 'parent' }])), excused: false } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const shots = [];
const errors = [];

async function open(viewport, st, { record = false, cloud = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...(record ? { recordVideo: { dir: `${out}/.video`, size: viewport } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { errors.push(e.message); console.log('ERR', e.message); });
  await page.clock.install({ time: new Date(`${day}T16:30:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house, cl]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    localStorage.setItem('kidquest.house', JSON.stringify(house));
    if (cl) {
      // a kid's tablet in a family, with a visitor who has a fishing rod
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_ava' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(s));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([{ id: 'kid_ben', name: 'Ben', color: '#4dabf7', owned: ['sport-rod-good'], buddy: { species: 'bear', outfit: {} } }]));
    }
  }, [st, { kid_ava: { day, inside: !cloud } }, cloud]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await page.clock.runFor(1500);
  await closeModals(page);
  if (!cloud) { await page.locator('.house').scrollIntoViewIfNeeded(); await page.clock.runFor(1200); }
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
async function shotView(page, name, sel = '.house .village-view') {
  const box = await page.locator(sel).boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, clip: { ...box, y: box.y + y }, fullPage: true });
  shots.push(path);
  return path;
}
// a close look at the tank: its box in the room, with a margin
async function shotTank(page, name) {
  const box = await page.locator('.h-spot[data-spot="tank"]').boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  const m = 40;
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, clip: { x: box.x - m, y: box.y + y - m * 2.5, width: box.width * 1.45 + m * 2, height: box.height + m * 3.5 }, fullPage: true });
  shots.push(path);
}
// the open modal, with the window made as tall as all of it
async function shotModal(page, name) {
  const view = page.viewportSize();
  const el = page.locator('#modal .modal-card');
  const h = await el.evaluate((n) => n.scrollHeight);
  await page.setViewportSize({ width: view.width, height: Math.max(view.height, h + 80) });
  const style = await page.addStyleTag({ content: '#modal .modal-card { max-height: none !important; overflow: visible !important; } .tp-grid { max-height: none !important; }' });
  await page.clock.runFor(150);
  const path = `${out}/${name}.png`;
  await el.screenshot({ path });
  shots.push(path);
  await style.evaluate((n) => n.remove());
  await page.setViewportSize(view);
}
const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);

const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 412, height: 915 };
const TANK = { species: 'meadow-trout', nickname: 'Sir Goldie' };

// 1. tablet: the room with Sir Goldie in the tank; the buddy walks over to look
{
  const { ctx, page } = await open(TABLET, family({ tank: TANK }));
  assert.equal(await page.locator('.h-plaque').innerText(), 'Sir Goldie');
  assert.equal(await page.locator('.h-fish canvas').count(), 1, 'the fish is in the tank');
  await page.mouse.click(...await page.locator('.house .village-view').boundingBox().then((b) => [b.x + b.width * 0.55, b.y + b.height * 0.62]));
  await page.clock.runFor(2500);
  await shotView(page, '1-tablet-room-tank');
  await shotTank(page, '1b-tank-close-up');
  // the fish swims: it's somewhere else a moment later
  const a = await page.locator('.h-fish').evaluate((n) => n.style.transform);
  await page.clock.runFor(1700);
  assert.notEqual(await page.locator('.h-fish').evaluate((n) => n.style.transform), a, 'the fish swims');
  // 3. the fish book: the buddy walks to it and it opens
  await tap(page, '.h-spot[data-spot="book"]');
  await page.clock.runFor(2500);
  await page.waitForSelector('#modal .fishbook');
  await shotModal(page, '3-fish-book');
  await closeModals(page);
  // 4. the tank picker: pick another fish and type a name
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(2500);
  await page.waitForSelector('#modal .tankpick');
  await page.click('#modal .tp-fish[data-species="ocean-sword"]');
  await page.fill('#tank-name', '  Cap <Pointy>  ');
  await shotModal(page, '4-tank-picker');
  await page.click('#modal [data-action="tank-save"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.h-plaque').innerText(), 'Cap <Pointy>', 'the name is shown as text');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0].tank);
  assert.deepEqual(saved, { species: 'ocean-sword', nickname: 'Cap <Pointy>' });
  await page.clock.runFor(4000); // the toast goes
  await shotTank(page, '4b-tank-swordfish');
  await ctx.close();
}

// 2. phone: walk to the tank
{
  const { ctx, page } = await open(PHONE, family({ tank: TANK }));
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(3000);
  await closeModals(page);
  await page.clock.runFor(1200);
  await shotView(page, '2-phone-room-tank');
  await ctx.close();
}

// 5. empty tanks: fish caught but none picked yet, and no fish at all (its picker says so)
{
  const { ctx, page } = await open(TABLET, family());
  assert.equal(await page.locator('.h-plaque').innerText(), 'Pick a fish!');
  await shotTank(page, '5-empty-tank');
  await ctx.close();
}
{
  const { ctx, page } = await open(TABLET, family({ records: false }));
  assert.equal(await page.locator('.h-plaque').innerText(), 'Empty tank');
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(2500);
  await shotView(page, '5b-empty-tank-room');
  await page.waitForSelector('#modal .tankpick');
  await shotModal(page, '5c-empty-tank-picker');
  await ctx.close();
}

// 6. fishing: the catch card says when a fish is new for the book, or bigger than the record
{
  const { ctx, page } = await open(TABLET, family({ records: false }), { cloud: true });
  await page.waitForSelector('.map-visitor, .v-visitor', { timeout: 10000 });
  await page.clock.runFor(1000);
  await page.locator('.map-visitor, .v-visitor').first().click();
  await page.clock.runFor(800);
  await page.click('.game-pick [data-kind="fishing"]');
  await page.waitForSelector('.playground');
  const land = (kind, size) => page.evaluate(([k, sz]) => {
    const g = document.querySelector('.playground').game;
    g.phase = 'play';
    const f = g.makeFish(k, g.W * 0.6, g.H * 0.7, 'lurk');
    f.post = [f.x, f.y];
    f.inches = sz;
    g.land(g.lines.kid, f);
    return g.catches.at(-1).record || null;
  }, [kind, size]);
  assert.equal(await land('special', 18), 'first');
  await page.clock.runFor(900);
  await page.screenshot({ path: `${out}/6-catch-new-fish.png` }); shots.push(`${out}/6-catch-new-fish.png`);
  assert.equal(await land('special', 15), null, 'a smaller one is no record');
  assert.equal(await land('special', 23), 'record');
  await page.clock.runFor(900);
  await page.screenshot({ path: `${out}/6b-catch-new-record.png` }); shots.push(`${out}/6b-catch-new-record.png`);
  await page.evaluate(() => { const g = document.querySelector('.playground').game; g.showCatch = null; g.left = 0.05; });
  await page.clock.runFor(1500);
  await page.screenshot({ path: `${out}/6c-time-up.png` }); shots.push(`${out}/6c-time-up.png`);
  await ctx.close();
}

// 7. a few seconds of the fish swimming (optional)
if (video) {
  const { ctx, page } = await open(TABLET, family({ tank: TANK }), { record: true });
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(2500);
  await closeModals(page);
  for (let i = 0; i < 60; i += 1) { await page.clock.runFor(100); await page.waitForTimeout(100); }
  const v = page.video();
  await ctx.close();
  const webm = await v.path();
  const mp4 = `${out}/7-tank-swim.mp4`;
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4]); shots.push(mp4); } catch (e) { console.log('no ffmpeg:', e.message); }
  fs.rmSync(`${out}/.video`, { recursive: true, force: true });
}

await browser.close();
site.close();
assert.deepEqual(errors, []);
for (const s of shots) console.log(s);
