// December in the buddy's house, on the real app (one family tablet, no cloud):
//  - the daily chest holds an ornament on top of its prize (a seeded day where it does)
//  - the ornament book from the tree: an ornament's page, tinsel's Pick one (a locked map's)
//  - wrapping a present for a sibling (coins spent, one each, it lands under their tree)
//  - a parent wraps one in the 3-year-old's name; her tree has big picture baubles
//  - Christmas morning: the present shakes, opens (4-frame unwrap) and gives the ornament
//  - 2 January: the tree is packed away, the ornaments stay, an unopened present still opens
// Run: node test/smoke/xmas-house.mjs [outDir for screenshots]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { openKid, openParents } from '../helpers/open-kid.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { chestOrnament } from '../../js/xmas.js';
import { rng } from '../../js/treasure.js';

const out = process.argv[2] || null;
if (out) fs.mkdirSync(out, { recursive: true });

// a December day whose chest has an ornament for Ava (the roll is seeded by kid and day)
const CHEST_DAY = (() => {
  for (let d = 3; d <= 20; d += 1) {
    const day = `2026-12-${String(d).padStart(2, '0')}`;
    if (chestOrnament({ id: 'kid_ava' }, 'bg-meadow', day, rng(`kid_ava|${day}|xmas-chest`))) return day;
  }
  throw new Error('no chest day');
})();

function family(day, o = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const mk = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species, outfit: { background: 'bg-meadow' } }, ...extra });
  s.kids.push(
    mk('kid_ava', 'Ava', '#ff6b6b', 'fox', { xmas: { found: ['orn-acorn', 'orn-owl', 'orn-moose'], tinsel: 3 }, ...(o.ava || {}) }),
    mk('kid_ben', 'Ben', '#4dabf7', 'bear', o.ben || {}),
    mk('kid_cy', 'Cy', '#69db7c', 'cat'),
    mk('kid_dee', 'Dee', '#da77f2', 'dino', { littleGames: true, starsOnly: true, little: { since: addDays(day, -30), spent: 0, stickers: {}, puzzles: 0, visits: 0 }, ...(o.dee || {}) }),
  );
  // Ava and Ben did every chore (a parent checked), so they have coins and today's chest is ready
  for (const kid of [s.kids[0], s.kids[1]]) {
    for (let i = 0; i <= 30; i += 1) {
      const key = addDays(day, -i);
      s.log[key] ||= {};
      s.log[key][kid.id] = { tasks: Object.fromEntries(kid.tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done', by: 'parent' }])) };
    }
  }
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(st, day, kidId = 'kid_ava', { viewport = { width: 1000, height: 700 }, house = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${day}T10:30:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, inside]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    localStorage.setItem('kidquest.house', JSON.stringify(inside));
  }, [st, Object.fromEntries(st.kids.map((k) => [k.id, { day, inside: house }]))]);
  await page.reload();
  await openKid(page, `[data-action="open-kid"][data-id="${kidId}"]`);
  await page.clock.runFor(1500);
  await closeModals(page);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const act = (page, action, data = {}) => page.evaluate(([a, d]) => {
  const b = document.createElement('button'); b.dataset.action = a; Object.assign(b.dataset, d); b.hidden = true;
  document.body.append(b); b.click(); b.remove();
}, [action, data]);
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
const kidIn = (s, id) => s.kids.find((k) => k.id === id);
const tap = (page, sel) => page.evaluate((x) => document.querySelector(x).click(), sel);
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png` }); };

// ---- 1. the chest's ornament, the book, an ornament page, tinsel, wrapping a present ----
{
  const { ctx, page } = await open(family(CHEST_DAY), CHEST_DAY);
  await act(page, 'today-chest');
  await page.clock.runFor(2500);
  assert.equal(await page.locator('#modal .prize-orn').count(), 1, 'the chest shows its ornament');
  await shot(page, 'chest-ornament');
  let s = await saved(page);
  const orn = s.log[CHEST_DAY].kid_ava.chest.ornament;
  assert.ok(orn?.id, 'the chest keeps its ornament');
  if (orn.kind === 'new') assert.ok(kidIn(s, 'kid_ava').xmas.found.includes(orn.id));
  await closeModals(page);

  // fishing (1 catch in 8) through the app's own module: rolls counted on the kid, a drop pops up
  const fish = await page.evaluate(async () => {
    const m = await import('./js/xmas-ui.js');
    for (let i = 0; i < 80; i += 1) {
      const res = m.playXmas('kid_ava', 'fish', 'bg-ocean');
      if (res) return { i, res, pop: document.querySelectorAll('.orn-pop').length };
    }
    return null;
  });
  assert.ok(fish && fish.pop === 1, 'a fish drop shows its reveal');
  s = await saved(page);
  assert.equal(kidIn(s, 'kid_ava').xmas.rolls.fish, fish.i + 1, 'each catch counted (seeded rolls)');
  assert.ok(fish.res.id.startsWith('orn-') && ['new', 'tinsel'].includes(fish.res.kind));
  await page.clock.runFor(3600);
  const tinsel0 = kidIn(s, 'kid_ava').xmas.tinsel || 0;

  // walk to the tree: the book opens, with a Wrap button for each of the other three
  await tap(page, '.h-spot[data-spot="xtree"]');
  await page.clock.runFor(4000);
  await page.waitForSelector('#modal .ornbook');
  assert.equal(await page.locator('#modal [data-action="xgift-for"]').count(), 3, 'a present for each sibling');
  await shot(page, 'book');
  // an ornament's page
  await page.click('#modal [data-action="ornament-page"][data-orn="orn-owl"]');
  assert.match(await page.locator('#modal .ornpage').innerText(), /Owl lantern[\s\S]*Forest Village[\s\S]*Super rare/);
  await shot(page, 'ornament-page');
  await page.click('#modal [data-action="xmas-book"]');
  // tinsel: Pick one, a locked map's super-rare
  await page.click('#modal [data-action="tinsel-swap"]');
  await page.waitForSelector('#modal .tinsel-pick');
  await shot(page, 'tinsel-pick');
  await page.click('#modal [data-action="tinsel-pick"][data-orn="orn-starwhale"]');
  await page.clock.runFor(300);
  s = await saved(page);
  assert.ok(kidIn(s, 'kid_ava').xmas.found.includes('orn-starwhale'), 'tinsel bought the star whale');
  assert.equal(kidIn(s, 'kid_ava').xmas.tinsel || 0, tinsel0 - 3);
  assert.equal(await page.locator('.orn-pop').count(), 1, 'the small reveal');
  assert.equal(await page.locator('#modal [data-action="ornament-page"][data-orn="orn-starwhale"]').count(), 1, 'in the book now');

  // wrap a present for Ben: a copy of one of her ornaments
  const spent0 = kidIn(s, 'kid_ava').spent || 0;
  await page.click('#modal [data-action="xgift-for"][data-to="kid_ben"]');
  await page.waitForSelector('#modal .xgift');
  const card = page.locator('#modal [data-action="xgift-pick"][data-kind="ornament"]').first();
  const pick = { item: await card.getAttribute('data-item'), cost: Number(await card.getAttribute('data-cost')) };
  assert.ok(kidIn(s, 'kid_ava').xmas.found.includes(pick.item), 'a copy of one of hers');
  await card.click();
  await page.click('#modal [data-action="xgift-paper"][data-paper="stars"]');
  await page.clock.runFor(600);
  await shot(page, 'gift-shop');
  await page.click('#modal [data-action="xgift-wrap"]');
  await page.waitForSelector('#modal .xgift-done');
  await shot(page, 'gift-wrapped');
  s = await saved(page);
  const gift = kidIn(s, 'kid_ben').xmasGifts?.['2026-kid_ava-kid_ben'];
  assert.equal(gift?.item, pick.item, 'under Ben\'s tree');
  assert.equal(gift.paper, 'stars');
  assert.equal(kidIn(s, 'kid_ava').spent, spent0 + pick.cost, 'coins spent');
  assert.equal(kidIn(s, 'kid_ava').xmasSent['2026'].kid_ben, gift.id);
  await page.click('#modal [data-action="xmas-book"]');
  assert.match(await page.locator('#modal .ob-gifts').innerText(), /✓ Ben/);
  assert.equal(await page.locator('#modal [data-action="xgift-for"]').count(), 2);
  await ctx.close();
}

// ---- 2. a parent wraps one in the 3-year-old's name; her tree has big picture baubles ----
{
  const day = '2026-12-12';
  const { ctx, page } = await open(family(day), day, 'kid_dee');
  await page.locator('.house').scrollIntoViewIfNeeded().catch(() => {});
  await page.clock.runFor(800);
  assert.equal(await page.locator('.h-spot[data-spot="xtree"]').count(), 1, 'her tree');
  await shot(page, 'little-tree');
  await ctx.close();

  const p = await browser.newContext({ viewport: { width: 1000, height: 900 }, deviceScaleFactor: 1 });
  const page2 = await p.newPage();
  page2.on('pageerror', (e) => errors.push(e.message));
  await page2.clock.install({ time: new Date(`${day}T10:30:00`) });
  await page2.goto(site.url);
  await page2.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(day));
  await page2.reload();
  await openParents(page2);
  for (const d of '1234') await page2.click(`[data-pin="${d}"]`);
  await page2.clock.runFor(500);
  await act(page2, 'tab', { tab: 'kids' });
  await page2.clock.runFor(300);
  await act(page2, 'edit-kid', { id: 'kid_dee' });
  await page2.clock.runFor(300);
  await page2.waitForSelector('.xmas-parent');
  assert.equal(await page2.locator('.xmas-parent [data-action="xgift-for"]').count(), 3);
  await page2.click('.xmas-parent [data-action="xgift-for"][data-to="kid_cy"]');
  await page2.waitForSelector('#modal .xgift');
  assert.match(await page2.locator('#modal .xgift').innerText(), /free/);
  await page2.locator('#modal [data-action="xgift-pick"]').first().click();
  await shot(page2, 'parent-gift');
  await page2.click('#modal [data-action="xgift-wrap"]');
  await page2.waitForSelector('#modal .xgift-done');
  const s = await saved(page2);
  const g = kidIn(s, 'kid_cy').xmasGifts?.['2026-kid_dee-kid_cy'];
  assert.equal(g?.by, 'parent');
  assert.equal(g.fromName, 'Dee');
  assert.equal(kidIn(s, 'kid_dee').spent || 0, 0, 'free');
  await page2.click('#modal [data-action="modal-close"]');
  await page2.clock.runFor(300);
  assert.match(await page2.locator('.xmas-parent').innerText(), /✓ Cy/);
  await p.close();
}

// ---- 3. Christmas morning: Ben's present shakes, opens and gives the owl ----
const present = { id: '2026-kid_ava-kid_ben', from: 'kid_ava', fromName: 'Ava', fromBuddy: 'fox', year: '2026', kind: 'ornament', item: 'orn-owl', n: 1, cost: 60, shape: 'round', paper: 'stars', at: '2026-12-05' };
const seeds = { id: '2026-kid_cy-kid_ben', from: 'kid_cy', fromName: 'Cy', fromBuddy: 'cat', year: '2026', kind: 'seed', item: 'seed-rose', n: 3, cost: 20, shape: 'tall', paper: 'plaid', at: '2026-12-06' };
{
  const day = '2026-12-25';
  const { ctx, page } = await open(family(day, { ben: { xmasGifts: { [present.id]: present, [seeds.id]: seeds } } }), day, 'kid_ben');
  assert.equal(await page.locator('.h-spot.h-gift').count(), 2, 'two presents under the tree');
  await tap(page, '.h-spot.h-gift[data-gift="0"]');
  await page.clock.runFor(1200);
  await page.waitForSelector('.v-dialog:not([hidden]) [data-h="unwrap"]');
  await shot(page, 'present-tap');
  await page.click('.v-dialog [data-h="unwrap"]');
  await page.clock.runFor(700);
  assert.equal(await page.locator('.h-unwrap').count(), 1, 'the unwrap frames play');
  await page.clock.runFor(1500);
  await page.waitForSelector('#modal .xgift-open');
  assert.match(await page.locator('#modal .xgift-open').innerText(), /Ava's fox[\s\S]*Owl lantern/);
  await shot(page, 'present-open');
  const s = await saved(page);
  assert.ok(kidIn(s, 'kid_ben').xmas.found.includes('orn-owl'));
  assert.equal(kidIn(s, 'kid_ben').xmasGifts[present.id].opened, day);
  await closeModals(page);
  await page.clock.runFor(500);
  assert.equal(await page.locator('.h-spot.h-gift').count(), 1, 'one left');
  await ctx.close();
}

// ---- 4. 2 January: the tree is packed away; the ornaments stay; a present still opens ----
{
  const day = '2027-01-02';
  const st = family(day, { ben: { xmas: { found: ['orn-owl'] }, xmasGifts: { [present.id]: { ...present, opened: '2026-12-25' }, [seeds.id]: seeds } } });
  const { ctx, page } = await open(st, day, 'kid_ben');
  assert.equal(await page.locator('.h-spot[data-spot="xtree"]').count(), 0, 'no tree');
  assert.equal(await page.locator('.h-piece[data-piece="xmas-tree"]').count(), 0);
  assert.equal(await page.locator('.h-spot.h-gift').count(), 1, 'the unopened present');
  await shot(page, 'january');
  await tap(page, '.h-spot.h-gift[data-gift="0"]');
  await page.clock.runFor(1200);
  await page.click('.v-dialog [data-h="unwrap"]');
  await page.clock.runFor(2500);
  await page.waitForSelector('#modal .xgift-open');
  const s = await saved(page);
  assert.equal(kidIn(s, 'kid_ben').garden.seeds['seed-rose'], 3);
  assert.deepEqual(kidIn(s, 'kid_ben').xmas.found, ['orn-owl'], 'ornaments stay saved');
  await ctx.close();
}

await browser.close();
site.close?.();
assert.deepEqual(errors, [], 'no page errors');
console.log(`xmas-house smoke: ok (chest day ${CHEST_DAY})`);
