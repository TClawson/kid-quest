// The garden behind the buddy's house (js/garden.js) in the real app: it draws with plants at
// several stages (one droopy, two ripe, a grown fruit tree) and the decorations; an empty bed
// asks for a seed packet and then a chore and plants it; a ripe flower can be kept (a vase
// shows in the house) or sold (coins come back); the Water button sends the buddy round the
// thirsty plants with the can, each gets a bounce and its drop goes away, and tapping
// elsewhere stops it; with no tree seeds the picker offers the shop, whose Garden tab lists
// the packets and decorations and buys one; the back door goes into the house (the vase and
// the fruit bowl are on the table), the village has a garden sign that leads back; a map with
// a dome (ocean) draws it over the garden. Saves screenshots.
// Run: node test/smoke/garden.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';

const out = (process.argv[2] || '/mnt/project-files/kid-quest-previews/garden/app/').replace(/\/?$/, '/');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/** Ava with plants at several stages, a grown tree, two kept harvests and some garden things. */
function family({ theme = 'bg-meadow', allDone = false } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const tasks = defaultTasks();
  const [teeth, bed, floor] = tasks;
  const plot = (n, seed, task, ago) => ({ id: `p${n}`, seed, task: task.id, planted: addDays(day, -ago) });
  s.kids.push({
    id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(day, -80), seenUnlocks: [], seenMoves: [],
    owned: ['garden-birdbath', 'garden-beehouse', 'garden-bench'], spent: 0,
    gardenDecor: { water: 'garden-birdbath', bees: 'garden-beehouse', seat: 'garden-bench' },
    buddy: { species: 'fox', outfit: { background: theme } },
    garden: {
      beds: [plot(1, 'seed-sunflower', bed, 10), plot(2, 'seed-tulip', teeth, 4), plot(3, 'seed-carrot', floor, 9), plot(4, 'seed-tomato', teeth, 12), null, plot(5, 'seed-daisy', bed, 9)],
      trees: [plot(6, 'seed-apple', teeth, 70), null],
      kept: [{ seed: 'seed-tulip', kind: 'flower', at: addDays(day, -2), until: addDays(day, 4) }, { seed: 'seed-carrot', kind: 'veg', at: addDays(day, -3), until: addDays(day, 10) }],
      seeds: { 'seed-tulip': 2, 'seed-sunflower': 1 }, n: 6,
    },
  });
  const done = (ids) => ({ kid_ava: { tasks: Object.fromEntries(ids.map((id) => [id, { status: 'done', by: 'self' }])) } });
  for (let i = 1; i <= 75; i += 1) {
    const ids = [teeth.id, bed.id];
    if (i >= 2 && i <= 8) ids.push(floor.id); // the carrots' chore: done, then missed yesterday
    s.log[addDays(day, -i)] = done(ids);
  }
  s.log[day] = done(allDone ? tasks.map((t) => t.id) : [teeth.id]);
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function start(viewport, s, place = 'garden') {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate(([st, pl, d]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.house', JSON.stringify({ kid_ava: { day: d, inside: pl === 'house', place: pl } }));
  }, [s, place, day]);
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.clock.runFor(1500);
  return { ctx, page };
}
const kidOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
const run = (page, ms) => page.clock.runFor(ms);
async function until(page, fn, arg, max = 12000) {
  for (let t = 0; t < max; t += 100) { if (await page.evaluate(fn, arg)) return true; await run(page, 100); }
  return false;
}
const click = (page, sel) => page.evaluate((q) => document.querySelector(q).click(), sel);

for (const [label, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 412, height: 915 }]]) {
  const { ctx, page } = await start(viewport, family());
  const shot = async (name, sel = '.garden-view, .house-view, .village-view') => {
    await run(page, 300);
    await page.waitForTimeout(300); // let a talk box finish popping up (CSS runs on the real clock)
    const box = await page.locator(sel).first().boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: `${out}${name}-${label}.png`, clip: { ...box, y: box.y + y }, fullPage: true });
  };

  // ---- it draws ----
  await page.locator('.garden').scrollIntoViewIfNeeded();
  await run(page, 1500);
  assert.equal(await page.locator('.g-plant').count(), 6, 'five plants and the tree');
  assert.equal(await page.locator('.g-plant.droopy').count(), 1, 'one droopy plant');
  assert.equal(await page.locator('.g-thirst').count(), 3, 'three thirsty plants');
  assert.ok(await page.locator('.g-critter').count() >= 1, 'critters');
  assert.ok(await page.locator('.h-piece[data-piece="water"]').count(), 'the birdbath stands in the garden');
  await shot('1-garden');

  // ---- a droopy plant gets a kind nudge ----
  await click(page, '.g-spot[data-where="beds"][data-i="2"]');
  assert.ok(await until(page, () => !document.querySelector('.v-dialog').hidden), 'the buddy talks to the droopy plant');
  assert.match(await page.locator('.v-text').innerText(), /missed you yesterday/);
  await shot('2-droopy');
  await click(page, '.v-dialog [data-g="bye"]');

  // ---- plant a seed in the empty bed ----
  await click(page, '.g-spot[data-where="beds"][data-i="4"]');
  assert.ok(await until(page, () => document.querySelector('.g-pick[data-g="seed"]')), 'seed picker');
  await shot('3-seed-picker');
  await click(page, '.g-pick[data-g="seed"][data-id="seed-tulip"]');
  assert.ok(await page.locator('.g-pick[data-g="task"]').count() >= 3, 'chore picker lists the chores');
  await shot('4-chore-picker');
  await click(page, '.g-pick[data-g="task"]');
  await run(page, 600);
  let kid = await kidOf(page);
  assert.equal(kid.garden.beds[4].seed, 'seed-tulip');
  assert.equal(kid.garden.seeds['seed-tulip'], 1);
  assert.match(await page.locator('.v-text').innerText(), /Planted/);
  await click(page, '.v-dialog [data-g="bye"]');

  // ---- keep one ripe flower, sell the other ----
  await click(page, '.g-spot[data-where="beds"][data-i="0"]');
  assert.ok(await until(page, () => document.querySelector('.v-dialog [data-g="keep"]')), 'keep or sell');
  assert.match(await page.locator('.v-dialog [data-g="sell"]').innerText(), /Sell for \d+ coins?/);
  await shot('5-keep-sell');
  await click(page, '.v-dialog [data-g="keep"]');
  await run(page, 600);
  kid = await kidOf(page);
  assert.equal(kid.garden.beds[0], null);
  assert.ok(kid.garden.kept.some((k) => k.seed === 'seed-sunflower'));
  assert.match(await page.locator('.v-text').innerText(), /brighten your table/);
  await click(page, '.v-dialog [data-g="bye"]');
  await click(page, '.g-spot[data-where="beds"][data-i="5"]');
  assert.ok(await until(page, () => document.querySelector('.v-dialog [data-g="sell"]')));
  await click(page, '.v-dialog [data-g="sell"]');
  await run(page, 600);
  const kid2 = await kidOf(page);
  assert.ok(kid2.spent < 0, 'selling gave coins back');
  assert.equal(kid2.garden.beds[5], null);
  await click(page, '.v-dialog [data-g="bye"]');

  // ---- the watering sweep ----
  await click(page, '.g-water');
  assert.ok(await until(page, () => document.querySelector('.g-droplet')), 'the buddy pours');
  await shot('6-watering');
  await until(page, () => document.querySelector('.g-plant.bounce'));
  // tapping elsewhere stops it: what is left stays thirsty
  const box = await page.locator('.garden-view').boundingBox();
  await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
  await run(page, 1500);
  const left = await page.locator('.g-thirst').count();
  assert.ok(left < 4, 'at least one plant was watered');
  assert.equal(await page.locator('.g-can:not([hidden])').count(), 0, 'the can is put away');
  if (left) {
    await click(page, '.g-water');
    assert.ok(await until(page, () => !document.querySelector('.g-thirst'), null, 30000), 'the rest get watered');
  }
  const watered = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.watered')).kid_ava.ids.length);
  assert.equal(watered, 4, 'all four plants are watered today');
  await run(page, 3200);

  // ---- no tree seeds: the shop is offered ----
  await click(page, '.g-spot[data-where="trees"][data-i="1"]');
  assert.ok(await until(page, () => document.querySelector('.v-dialog [data-g="shop"]')), 'offers the shop');

  // ---- into the house: the vase and the fruit bowl ----
  await click(page, '.v-dialog [data-g="bye"]');
  await click(page, '.g-door');
  assert.ok(await until(page, () => document.querySelector('.house'), null, 15000), 'the back door goes into the house');
  await run(page, 1500);
  assert.ok(await page.locator('.h-piece[data-piece^="vase"]').count() >= 1, 'a vase on the table');
  assert.ok(await page.locator('.h-piece[data-piece="bowl"]').count() === 1, 'the fruit bowl');
  assert.ok(await page.locator('.h-piece[data-piece^="basket"]').count() >= 1, 'a basket of vegetables');
  await shot('8-house-harvest');
  await click(page, '.h-gbtn');
  assert.ok(await until(page, () => document.querySelector('.garden'), null, 15000), 'the Garden button goes to the garden');
  await ctx.close();

  // ---- the shop: its Garden tab ----
  const shopCtx = await start(viewport, family({ allDone: true }));
  const sp = shopCtx.page;
  const sshot = async (name) => { await sp.screenshot({ path: `${out}${name}-${label}.png`, fullPage: false }); };
  await click(sp, '.g-spot[data-where="trees"][data-i="1"]');
  assert.ok(await until(sp, () => document.querySelector('.v-dialog [data-g="shop"]')));
  await click(sp, '.v-dialog [data-g="shop"]');
  assert.ok(await until(sp, () => document.querySelector('.garden-seed')), 'the shop opens on the Garden tab');
  await run(sp, 500);
  assert.equal(await sp.locator('.garden-seed').count(), 9);
  await sp.evaluate(() => document.querySelector('.garden-h').scrollIntoView());
  await sshot('7-shop-garden');
  await click(sp, '.garden-seed[data-id="seed-daisy"]');
  await click(sp, '[data-action="garden-buy-confirm"]');
  await run(sp, 500);
  const bought = await kidOf(sp);
  assert.equal(bought.garden.seeds['seed-daisy'], 1);
  assert.equal(bought.spent, 5);
  // a decoration: buy it and it stands in the garden straight away
  await click(sp, '.item[data-id="garden-pond"]');
  await click(sp, '[data-action="garden-buy-confirm"]');
  await run(sp, 500);
  assert.equal((await kidOf(sp)).gardenDecor.water, 'garden-pond');
  await shopCtx.ctx.close();

  // ---- the village sign leads to the garden ----
  const v = await start(viewport, family(), 'out');
  const vp = v.page;
  await vp.locator('.village').scrollIntoViewIfNeeded();
  await run(vp, 1000);
  assert.match(await vp.locator('.v-garden').innerText(), /Garden/);
  assert.match(await vp.locator('.v-garden').innerText(), /💧3/);
  const vbox = await vp.locator('.village-view').boundingBox();
  const vy = await vp.evaluate(() => window.scrollY);
  await vp.screenshot({ path: `${out}9-village-${label}.png`, clip: { ...vbox, y: vbox.y + vy }, fullPage: true });
  await click(vp, '.v-garden');
  assert.ok(await until(vp, () => document.querySelector('.garden'), null, 20000), 'the sign walks to the garden');
  // stepping in with thirsty plants: the buddy gets the can out by itself
  assert.ok(await until(vp, () => document.querySelector('.g-droplet'), null, 20000), 'the buddy waters on its own');
  await click(vp, '.g-gate');
  assert.ok(await until(vp, () => document.querySelector('.village'), null, 15000), 'the gate goes out to the village');
  await v.ctx.close();

  // ---- a map with a dome puts it over the garden ----
  if (label === 'tablet') {
    const o = await start(viewport, family({ theme: 'bg-ocean' }));
    assert.ok(await o.page.locator('.g-shield').count() === 1, 'the ocean dome');
    await o.page.locator('.garden').scrollIntoViewIfNeeded();
    await run(o.page, 800);
    const ob = await o.page.locator('.garden-view').boundingBox();
    const oy = await o.page.evaluate(() => window.scrollY);
    await o.page.screenshot({ path: `${out}10-garden-ocean-${label}.png`, clip: { ...ob, y: ob.y + oy }, fullPage: true });
    await o.ctx.close();
  }
}

await browser.close();
site.close();
assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`);
console.log('garden ok');
