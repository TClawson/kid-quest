// Previews of real fish facts (js/fishfacts.js): the fish book with weights in pounds and a
// small / typical / trophy badge on each catch, a real fish's page, a pretend fish's page (it
// teaches its real cousin), a phone page, and the fishing game's catch card in pounds.
// Run: node test/smoke/fishfacts-preview.mjs <outDir>
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
// [inches, pounds]: no pounds = a record from before pounds (it gets them from its inches)
const CAUGHT = { 'meadow-bluegill': [8], 'meadow-smallmouth': [12, 0.6], 'meadow-largemouth': [19, 9.4], 'meadow-pike': [31], 'meadow-trout': [21], 'ocean-bluegill': [6], 'ocean-largemouth': [17], 'ocean-sword': [38, 520], 'ocean-catfish': [22], 'castle-pike': [26], 'sunset-bluegill': [7], 'fjord-catfish': [30, 142], 'fjord-king': [18, 22.5], 'space-moon': [16, 104], 'space-pike': [30] };
function records() {
  const r = {};
  let i = 0;
  for (const [id, [size, lb]] of Object.entries(CAUGHT)) {
    const sp = FISH_SPECIES.find((s) => s.id === id);
    r[id] = { size, points: 20 + size, map: sp.map, date: addDays(day, -(i += 2)), ...(lb ? { lb } : {}) };
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

async function openBook(page) {
  await tap(page, '.h-spot[data-spot="book"]');
  await page.clock.runFor(2500);
  await page.waitForSelector('#modal .fishbook');
}

// 1. tablet: the fish book, then a real fish's page and back, then a pretend fish's page
{
  const { ctx, page } = await open(TABLET, family());
  await openBook(page);
  assert.equal(await page.locator('#modal .fb-badge').count(), Object.keys(CAUGHT).length, 'every catch has a badge');
  assert.match(await page.locator('#modal [data-species="ocean-sword"] .fb-size').innerText(), /520 lb/);
  await shotModal(page, '1-fish-book');
  await tap(page, '#modal [data-species="meadow-largemouth"]');
  await page.waitForSelector('#modal .fishpage');
  const txt = await page.locator('#modal .fishpage').innerText();
  assert.match(txt, /Your biggest: 9\.4 lb/);
  assert.match(txt, /Trophy/);
  assert.match(txt, /Where it lives/);
  assert.match(txt, /1932/);
  await shotModal(page, '2-largemouth-page');
  await tap(page, '#modal [data-action="fish-book-back"]');
  await page.waitForSelector('#modal .fishbook');
  await tap(page, '#modal [data-species="space-moon"]');
  await page.waitForSelector('#modal .fishpage');
  assert.match(await page.locator('#modal .fp-pretend').innerText(), /Opah/);
  await shotModal(page, '3-pretend-moon-fish');
  await tap(page, '#modal [data-action="fish-book-back"]');
  await tap(page, '#modal [data-species="meadow-bluegill"]');
  await page.waitForSelector('#modal .fishpage');
  await shotModal(page, '4-old-record-bluegill');
  await ctx.close();
}

// 2. phone: the halibut's page
{
  const { ctx, page } = await open(PHONE, family());
  await openBook(page);
  await tap(page, '#modal [data-species="fjord-catfish"]');
  await page.waitForSelector('#modal .fishpage');
  await shotModal(page, '5-phone-halibut');
  await ctx.close();
}

// 3. fishing: the catch card in pounds, with its size class
{
  const { ctx, page } = await open(TABLET, family({ records: false }), { cloud: true });
  await page.waitForSelector('.v-visitor', { timeout: 10000 });
  await page.clock.runFor(1000);
  await page.locator('.v-visitor').first().click();
  await page.clock.runFor(800);
  await page.click('.game-pick [data-kind="fishing"]');
  await page.waitForSelector('.playground');
  const lb = await page.evaluate(() => {
    const g = document.querySelector('.playground').game;
    g.phase = 'play';
    const f = g.makeFish('largemouth', g.W * 0.6, g.H * 0.7, 'lurk');
    f.post = [f.x, f.y];
    g.land(g.lines.kid, f);
    return g.catches.at(-1).lb;
  });
  assert.ok(lb > 0, 'the catch has a weight');
  await page.clock.runFor(900);
  await page.screenshot({ path: `${out}/6-catch-card.png` }); shots.push(`${out}/6-catch-card.png`);
  const book = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache') || localStorage.getItem('kidquest.v1')).kids[0].fishRecords);
  console.log('saved record', JSON.stringify(book));
  await ctx.close();
}

await browser.close();
site.close();
assert.deepEqual(errors, []);
for (const s of shots) console.log(s);
