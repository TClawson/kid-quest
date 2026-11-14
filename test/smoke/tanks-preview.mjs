// Previews of the bigger fish tanks from the shop (js/tankart.js, js/house.js): the room with
// each tank and its fish (the little tank, the big tank with 2, the grand aquarium with 3, the
// wall aquarium with 5), close-ups, the tank's fish picker with its places, and the shop.
// Run: node test/smoke/tanks-preview.mjs <outDir> [--video]
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
    spent: -2000,
    buddy: { species: 'fox', outfit: { background: o.map || 'bg-meadow', hat: 'hat-cap' } },
    ...(o.records === false ? {} : { fishRecords: records() }),
    ...(o.tank ? { tank: o.tank } : {}),
    ...(o.tankItem ? { owned: ['sport-soccer-good', 'sport-rod-super', 'sport-shoes-good', ...furn, 'home-tank-big', 'home-tank-grand', 'home-tank-wall'], home: { bed: furn[0], table: furn[1], couch: furn[2], chair: furn[3], corner: furn[4], lamp: furn[5], rug: furn[6], art: furn[7], tank: o.tankItem } } : {}),
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
const FISH = [
  { species: 'meadow-trout', nickname: 'Sir Goldie' },
  { species: 'ocean-sword', nickname: 'Pointy' },
  { species: 'meadow-bluegill', nickname: 'Bubbles' },
  { species: 'castle-pike', nickname: 'Knight' },
  { species: 'sunset-bluegill', nickname: 'Sunny' },
];
const tankOf = (n) => ({ ...FISH[0], ...(n > 1 ? { more: FISH.slice(1, n) } : {}) });
const TANKS = [['home-tank-basic', 1, '1-little'], ['home-tank-big', 2, '2-big'], ['home-tank-grand', 3, '3-grand'], ['home-tank-wall', 5, '4-wall']];

// 1. each tank in the room, with its fish; the buddy stands back by the table
for (const [item, n, name] of TANKS) {
  const { ctx, page } = await open(TABLET, family({ tank: tankOf(n), tankItem: item }));
  assert.equal(await page.locator('.h-fish canvas').count(), n, `${item}: ${n} fish swim`);
  await page.mouse.click(...await page.locator('.house .village-view').boundingBox().then((b) => [b.x + b.width * 0.42, b.y + b.height * 0.5]));
  await page.clock.runFor(2500);
  await shotView(page, `${name}-room`);
  await shotTank(page, `${name}-close`);
  if (n > 1) {
    // the fish all swim, and the plaque takes turns with their names
    const a = await page.locator('.h-fish').evaluateAll((els) => els.map((e) => e.style.transform));
    const p1 = await page.locator('.h-plaque').innerText();
    await page.clock.runFor(3600);
    const b = await page.locator('.h-fish').evaluateAll((els) => els.map((e) => e.style.transform));
    assert.ok(a.every((t, i) => t !== b[i]), 'every fish swims');
    assert.notEqual(await page.locator('.h-plaque').innerText(), p1, 'the plaque says the next name');
  }
  await ctx.close();
}

// 2. the wall aquarium's fish picker: 5 places, 3 filled; fill the fourth
{
  const { ctx, page } = await open(TABLET, family({ tank: tankOf(3), tankItem: 'home-tank-wall' }));
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(3000);
  await page.waitForSelector('#modal .tankpick');
  assert.equal(await page.locator('#modal .tp-slot').count(), 5);
  assert.equal(await page.locator('#modal .tp-slot.on').getAttribute('data-slot'), '3', 'starts on the first empty place');
  assert.equal(await page.locator('#modal .tp-fish.taken').count(), 3, 'fish already in the tank are taken');
  await page.click('#modal .tp-fish[data-species="castle-pike"]');
  await page.fill('#tank-name', 'Knight');
  await shotModal(page, '5-picker-wall');
  await page.click('#modal [data-action="tank-save"]');
  await page.clock.runFor(800);
  assert.equal(await page.locator('#modal .tp-slot.on').getAttribute('data-slot'), '4', 'on to the next empty place');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0].tank);
  assert.deepEqual(saved.more.map((f) => f.nickname), ['Pointy', 'Bubbles', 'Knight']);
  await closeModals(page);
  await page.clock.runFor(4000);
  assert.equal(await page.locator('.h-fish canvas').count(), 4);
  await ctx.close();
}

// 3. phone: the wall aquarium
{
  const { ctx, page } = await open(PHONE, family({ tank: tankOf(5), tankItem: 'home-tank-wall' }));
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(3000);
  await closeModals(page);
  await page.clock.runFor(1200);
  await shotView(page, '6-phone-wall');
  await ctx.close();
}

// 4. the shop: the tanks in the Home tab
{
  const { ctx, page } = await open(TABLET, family({ tank: tankOf(1) }));
  await page.click('[data-action="wardrobe"]');
  await page.clock.runFor(500);
  await page.click('[data-action="wardrobe-slot"][data-slot="home"]');
  await page.clock.runFor(800);
  const first = page.locator('.item:has(.spot-tag:text("Fish tank"))').first();
  await first.scrollIntoViewIfNeeded();
  const box = await page.locator('.items').boundingBox();
  const fb = await first.boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: `${out}/7-shop.png`, clip: { x: box.x, y: fb.y + y - 20, width: box.width, height: 560 }, fullPage: true });
  shots.push(`${out}/7-shop.png`);
  await ctx.close();
}

// 5. the wall aquarium for a few seconds (optional)
if (video) {
  const { ctx, page } = await open(TABLET, family({ tank: tankOf(5), tankItem: 'home-tank-wall' }), { record: true });
  await tap(page, '.h-spot[data-spot="tank"]');
  await page.clock.runFor(2500);
  await closeModals(page);
  for (let i = 0; i < 80; i += 1) { await page.clock.runFor(100); await page.waitForTimeout(100); }
  const v = page.video();
  await ctx.close();
  const webm = await v.path();
  const mp4 = `${out}/8-wall-aquarium.mp4`;
  try { execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', webm, '-movflags', 'faststart', '-pix_fmt', 'yuv420p', '-vf', 'scale=trunc(iw/2)*2:trunc(ih/2)*2', mp4]); shots.push(mp4); } catch (e) { console.log('no ffmpeg:', e.message); }
  fs.rmSync(`${out}/.video`, { recursive: true, force: true });
}

await browser.close();
site.close();
assert.deepEqual(errors, []);
for (const s of shots) console.log(s);
