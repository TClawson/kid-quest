// PREVIEW (garden plot): the kid's garden plot beside the house on every map's village, cut out of
// the village's land at 4x, plus the tablet village view. Based on garden.mjs's family.
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
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || '/mnt/project-files/kid-quest-previews/garden-plot/').replace(/\/?$/, '/');
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
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
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
const maps = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainforest', 'bg-rainbow', 'bg-galaxy', 'bg-fjord'];
for (const m of maps) {
  const v = await start({ width: 1280, height: 800 }, family({ theme: m }), 'out');
  await run(v.page, 2500);
  if (m === 'bg-meadow' || m === 'bg-ocean') await v.page.screenshot({ path: `${out}village-${m}.png` });
  const url = await v.page.evaluate(async (map) => {
    const { villageLayout } = await import('/js/villagemaps.js');
    const P = villageLayout(map).plot;
    const c = document.querySelector('.village-land');
    const x = Math.max(0, Math.min(c.width - 170, P.x + P.w / 2 - 85)); const y = Math.max(0, Math.min(c.height - 110, P.y - 34));
    const o = document.createElement('canvas'); o.width = 680; o.height = 440; const g = o.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(c, x, y, 170, 110, 0, 0, 680, 440);
    return o.toDataURL();
  }, m);
  fs.writeFileSync(`${out}plot-${m}.png`, Buffer.from(url.split(',')[1], 'base64'));
  await v.ctx.close();
}
assert.deepEqual(errors, []);
await browser.close();
site.close?.();
console.log('garden plot previews saved to', out);
