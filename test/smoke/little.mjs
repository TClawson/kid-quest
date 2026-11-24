// The little games (little.js): the bakery's door in the village and the puzzle box in the house
// show only for a kid with "Little games" on; a finished chore puts a star in the jar; a star opens
// a visit; a round of each game saves a sticker.
// Run: node test/smoke/little.mjs [outDir]   (outDir: also save screenshots)
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2]?.replace(/\/$/, '');
if (out) fs.mkdirSync(out, { recursive: true });
const day = '2026-11-25'; // a Wednesday

function family({ little = true, theme = 'bg-meadow', done = 3 } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const tasks = defaultTasks();
  const kid = { id: 'kid_ivy', name: 'Ivy', color: '#f06595', tasks, startDate: addDays(day, -10), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'cat', outfit: { background: theme } } };
  if (little) { kid.littleGames = true; kid.little = { since: day, spent: 0, stickers: {}, puzzles: 0, visits: 0 }; }
  s.kids.push(kid);
  for (let i = 1; i <= 9; i += 1) s.log[addDays(day, -i)] = { kid_ivy: { tasks: Object.fromEntries(tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  // today: the first few chores are done
  s.log[day] = { kid_ivy: { tasks: Object.fromEntries(tasks.slice(0, done).map((t) => [t.id, { status: 'done', by: 'self' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png` }); };

async function open(st, { inside = false, viewport = { width: 1280, height: 800 } } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: out ? 2 : 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${day}T16:30:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, ins]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify({ kid_ivy: { day: '2026-11-25', inside: ins } })); }, [st, inside]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ivy"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
  await page.clock.runFor(1200);
  return { ctx, page };
}
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);

try {
  // without the switch: no bakery door, no puzzle box
  {
    const { ctx, page } = await open(family({ little: false }));
    assert.equal(await page.locator('.v-bakery').count(), 0, 'no bakery for a kid without Little games');
    await ctx.close();
    const h = await open(family({ little: false }), { inside: true });
    assert.equal(await h.page.locator('.h-spot[data-spot="puzzle"]').count(), 0, 'no puzzle box either');
    await h.ctx.close();
  }

  // the bakery: its door shows the 3 stars; a visit takes one; a round saves a sticker
  {
    const { ctx, page } = await open(family());
    const door = page.locator('.v-bakery');
    assert.equal(await door.count(), 1, 'the bakery door is in the village');
    assert.equal((await door.getAttribute('aria-label')).includes('3 stars'), true, 'with 3 stars from 3 chores');
    await shot(page, '1-village-bakery');
    await door.click({ force: true });
    for (let i = 0; i < 20 && !(await page.locator('.little').count()); i += 1) await page.clock.runFor(300);
    assert.equal(await page.locator('.little').count(), 1, 'walking in opens the little games');
    await page.clock.runFor(2200);
    assert.equal(await page.locator('.lt-counter').count(), 1, 'the bakery starts right away');
    assert.equal((await saved(page)).little.spent, 1, 'one star was used for the visit');
    await shot(page, '2-bakery-customer');
    await page.locator('.lt-tray .lt-btn').nth(1).click();
    await page.locator('.lt-tray .lt-btn').nth(0).click();
    const bb = await page.locator('.lt-cookie canvas').boundingBox();
    await page.mouse.move(bb.x + bb.width * 0.3, bb.y + bb.height * 0.4); await page.mouse.down();
    await page.mouse.move(bb.x + bb.width * 0.7, bb.y + bb.height * 0.6, { steps: 10 }); await page.mouse.up();
    await page.locator('.lt-tray .lt-btn').nth(0).click();
    await shot(page, '3-bakery-decorated');
    await page.locator('.lt-bell').click({ force: true });
    await page.clock.runFor(4600);
    await shot(page, '4-bakery-eating');
    await page.clock.runFor(2500);
    const k = await saved(page);
    assert.equal(Object.keys(k.little.stickers).length, 1, 'the animal is in the sticker book');
    assert.ok(k.little.stickers[Object.keys(k.little.stickers)[0]].hearts === 0);
    await page.clock.runFor(3000);
    assert.equal(await page.locator('.lt-visit img:not(.left)').count(), 1, 'one of three rounds done');
    // hold the house button to leave the visit, then tap it to close
    const home = await page.locator('.lt-home').boundingBox();
    await page.mouse.move(home.x + 10, home.y + 10); await page.mouse.down(); await page.clock.runFor(1000); await page.mouse.up();
    assert.equal(await page.locator('.lt-door').count(), 2, 'back at the hub');
    await page.locator('.lt-bookbtn').click();
    assert.equal(await page.locator('.lt-sticker').count(), 6, 'six stickers on the map\'s page');
    assert.equal(await page.locator('.lt-sticker.got').count(), 1);
    await shot(page, '5-sticker-book');
    await page.locator('.lt-home').click();
    await page.locator('.lt-home').click();
    await page.clock.runFor(500);
    assert.equal(await page.locator('.little').count(), 0, 'closed');
    await ctx.close();
  }

  // the puzzle box in the house: tap a piece, tap a wrong spot (it goes back), then the right one
  {
    const { ctx, page } = await open(family({ theme: 'bg-fjord' }), { inside: true });
    const box = page.locator('.h-spot[data-spot="puzzle"]');
    assert.equal(await box.count(), 1, 'the puzzle box is in the house');
    await shot(page, '6-house-puzzle-box');
    await box.click({ force: true });
    for (let i = 0; i < 20 && !(await page.locator('.little').count()); i += 1) await page.clock.runFor(300);
    await page.clock.runFor(1000);
    await page.waitForSelector('.lt-piece', { timeout: 5000 });
    assert.equal(await page.locator('.lt-piece').count(), 2, 'the first puzzles have two pieces');
    const p0 = page.locator('.lt-piece').nth(0);
    const idx = Number(await p0.getAttribute('data-idx'));
    await p0.click();
    await shot(page, '7-puzzle-picked');
    await page.locator('.lt-slots div').nth(1 - idx).dispatchEvent('pointerdown');
    await page.clock.runFor(1500);
    assert.equal(await page.locator('.lt-piece.done').count(), 0, 'a wrong spot sends the piece back');
    await p0.click();
    await page.locator('.lt-slots div').nth(idx).dispatchEvent('pointerdown');
    await page.clock.runFor(700);
    assert.equal(await page.locator('.lt-piece.done').count(), 1, 'the right spot takes it');
    const p1 = page.locator('.lt-piece:not(.done)');
    await p1.click();
    await page.locator('.lt-slots div').nth(1 - idx).dispatchEvent('pointerdown');
    await page.clock.runFor(1200);
    await shot(page, '8-puzzle-done');
    const k = await saved(page);
    assert.equal(k.little.puzzles, 1, 'a finished puzzle counts');
    assert.equal(Object.keys(k.little.stickers).length, 1);
    await ctx.close();
  }

  // an empty jar: the doors still open the hub, and the buddy shows what to do instead
  {
    const s = family({ done: 0 });
    const { ctx, page } = await open(s);
    await page.locator('.v-bakery').click({ force: true });
    for (let i = 0; i < 20 && !(await page.locator('.little').count()); i += 1) await page.clock.runFor(300);
    await page.clock.runFor(800);
    assert.equal(await page.locator('.lt-counter').count(), 0, 'no visit without a star');
    await page.locator('.lt-door').first().click();
    assert.equal(await page.locator('.lt-say').count(), 1, 'the buddy points to chores and a star');
    await shot(page, '9-empty-jar');
    await ctx.close();
  }

  assert.deepEqual(errors, [], 'no page errors');
  console.log('little games smoke test passed');
} finally {
  await browser.close();
  site.close();
}
