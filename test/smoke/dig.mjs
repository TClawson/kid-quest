// Browser test for the dino dig (js/dig.js, js/digbook-ui.js):
// - 90 seconds on every map with each shovel: a bot that walks to finds and digs them gets finds,
//   nothing throws, and the round ends
// - in the app: a visitor with a shovel invites you on a dino dig, the first tap starts the clock,
//   each find goes in the kid's dig book (kid.digBones / kid.digTreasures), the map's dry count
//   is kept, and the best score is kept
// - in the house: the skeleton stand and the pedestal, their pickers (kid.digShow), the dig book
// Run: node test/smoke/dig.mjs   (SHOTS=dir for screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, tapInVillage, visitorsHere } from '../helpers/open-kid.mjs';
import { DINOS, boneKey } from '../../js/digfinds.js';

const site = await serve('.');
const browser = await chromium.launch();
const shots = process.env.SHOTS;

function family(kid = {}) {
  const s = emptyState();
  s.settings.pinHash = 'sha256:test';
  s.settings.sound = false;
  s.settings.questView = 'map';
  const tasks = defaultTasks();
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: { background: 'bg-volcano' } }, ...kid });
  s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
  return s;
}
async function load(page, s, house = false) {
  await page.evaluate(([st, inside, day]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
    localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
      { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-shovel-good'], buddy: { species: 'bear', outfit: {} } },
    ]));
    if (inside) localStorage.setItem('kidquest.house', JSON.stringify({ kid_sam: { day, inside: true } }));
  }, [s, house, TEST_DAY]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await page.waitForTimeout(500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
}
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0]);

try {
  // 1. every map, every shovel: a bot plays a whole round
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const results = await page.evaluate(async () => {
      const { Dig } = await import('./js/dig.js');
      const { SITES } = await import('./js/digfinds.js');
      const out = [];
      for (const map of Object.keys(SITES)) {
        for (const tier of [1, 3]) {
          const told = [];
          const g = new Dig({ W: 213, H: 120, map, seed: 11, day: '2026-12-11', onFind: (f) => { told.push(f); return 'new'; }, onRound: () => {}, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { shovel: tier } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { shovel: 1 } } });
          g.press();
          for (let i = 0; i < 110 * 20 && g.phase !== 'over'; i += 1) {
            if (i % 10 === 0) {
              const c = g.digCell(g.kid); const h = c && g.holes.get(c.idx);
              if (!g.heave && (!h || !h.done) && Math.hypot(g.kid.x - g.kid.tx, g.kid.y - g.kid.ty) < 2) g.press();
              else if (h?.done || !c) {
                const it = g.items.find((x) => !x.taken && !g.holes.get(x.cell)?.done && g.groundAt(g.cells[x.cell].x, g.cells[x.cell].y));
                if (it) { const cc = g.cells[it.cell]; g.kid.goTo(cc.x, cc.y); }
              }
            }
            g.step(1 / 20);
          }
          out.push({ map, tier, phase: g.phase, finds: told.length });
        }
      }
      return out;
    });
    for (const r of results) {
      assert.equal(r.phase, 'over', `${r.map} tier ${r.tier}: the round ends`);
      assert.ok(r.finds >= 2, `${r.map} tier ${r.tier}: a digger finds things (${r.finds})`);
    }
    assert.deepEqual(errors, []);
    await page.close();
  }

  // 2. in the app: a visitor with a shovel, a round, finds in the book
  for (const [name, device] of [['tablet', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true }], ['phone', devices['Pixel 7']]]) {
    const ctx = await browser.newContext(device);
    const page = await ctx.newPage();
    await useTestDay(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    await load(page, family());
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page);
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /dino dig/i, 'the digger invites you on a dino dig');
    await tapInVillage(page, '.v-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Dino dig\nWith Ben's shovel", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="dig"]');
    await page.waitForSelector('.playground[data-phase]');
    assert.match(await page.locator('.play-top').innerText(), /Dino dig with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the dig site fits the screen');
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    // tap the DIG button: the clock starts and the buddy digs
    const btn = await page.evaluate(() => { const g = document.querySelector('.playground').game; return [g.button.x, g.button.y, g.vW, g.vH]; });
    await page.mouse.click(box.x + (btn[0] / btn[2]) * box.width, box.y + (btn[1] / btn[3]) * box.height);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the clock');
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/dig-${name}.png` });
    // dig up a find: stand on one and dig until it comes up
    const got = await page.evaluate(async () => {
      const g = document.querySelector('.playground').game;
      const it = g.items.find((x) => !x.taken && !x.under && g.groundAt(g.cells[x.cell].x, g.cells[x.cell].y));
      const c = g.cells[it.cell];
      g.kid.x = c.x - 8; g.kid.y = c.y; g.kid.goTo(g.kid.x, c.y); g.kid.face = 1; // it digs just in front of its feet
      for (let k = 0; k < 60 && !it.taken; k += 1) { g.press(); await new Promise((r) => setTimeout(r, 300)); }
      return { key: it.key, taken: Boolean(it.taken) };
    });
    assert.ok(got.taken, `the find came up (${got.key})`);
    await page.waitForTimeout(300);
    const kid = await saved(page);
    const book = { ...(kid.digBones || {}), ...(kid.digTreasures || {}) };
    assert.ok(book[got.key], 'the find is in the dig book');
    // end the round early: the best is kept, and the map's dry count moves on
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.score = 77; g.left = 0.05; });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over');
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: `${shots}/dig-over-${name}.png` });
    await page.click('.play-close');
    const after = await saved(page);
    assert.equal(after.playLog.n, 1, 'the game counts toward the day');
    assert.equal(after.playBest?.dig, 77, 'the best score is kept');
    assert.ok(after.digDry && 'bg-volcano' in after.digDry, 'the map\'s rounds without its skull are counted');
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // 3. the house: the stand and the pedestal, their pickers, and the dig book
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const page = await ctx.newPage();
    await useTestDay(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const bones = {};
    for (const id of ['trex', 'psitta']) for (const b of DINOS.find((d) => d.id === id).bones) bones[boneKey(id, b.part)] = { n: 1, q: 2, date: TEST_DAY };
    bones[boneKey('stego', 'skull')] = { n: 1, q: 1, date: TEST_DAY };
    await load(page, family({ owned: ['sport-shovel-regular'], digBones: bones, digTreasures: { 'volcano-diamond': { n: 2, q: 3, date: TEST_DAY } } }), true);
    await page.waitForSelector('.house .h-piece[data-piece="stand"]');
    assert.equal(await page.locator('.house .h-piece[data-piece="pedestal"]').count(), 1, 'the pedestal is in the room');
    if (shots) await page.locator('.house .village-view').screenshot({ path: `${shots}/dig-house.png` });
    await page.evaluate(() => document.querySelector('.h-spot[data-spot="stand"]').click());
    await page.waitForSelector('#modal .digpick', { timeout: 8000 });
    assert.equal(await page.locator('#modal .digpick .tp-fish').count(), 2, 'both finished skeletons can go on the stand');
    await page.click('#modal .digpick [data-action="dig-show"][data-id="psitta"]');
    assert.equal((await saved(page)).digShow.skeleton, 'psitta', 'the picked skeleton is on show');
    await page.click('#modal .digpick [data-action="dig-book"]');
    await page.waitForSelector('#modal .digbook');
    assert.equal(await page.locator('#modal .digbook .dig-dino').count(), DINOS.length, 'every skeleton has a page');
    assert.equal(await page.locator('#modal .digbook .dig-dino.done').count(), 2);
    if (shots) await page.locator('#modal .modal-card').screenshot({ path: `${shots}/dig-book.png` });
    await page.click('#modal [data-action="dig-dino"][data-id="stego"]');
    await page.waitForSelector('#modal .digpage');
    assert.equal(await page.locator('#modal .dig-bone:not(.none)').count(), 1, 'one stego bone found');
    if (shots) await page.locator('#modal .modal-card').screenshot({ path: `${shots}/dig-page.png` });
    await page.click('#modal [data-action="dig-book-back"]');
    await page.click('#modal [data-action="dig-tab"][data-tab="treasures"]');
    await page.click('#modal [data-action="dig-treasure"]');
    await page.waitForSelector('#modal .digpage .fp-head');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('dino dig test passed');
} finally {
  await browser.close();
  site.close();
}
