// Browser test for trick jumps on the bike (js/bike.js):
// - 95 seconds on every map, with each bike, ridden by a simple bot: it pops at the lips, flips,
//   spins and grabs; it lands tricks, the riders never sink into the ground, nothing turns NaN,
//   every card the kid lands is reported for the trick book, and the run ends
// - in the app: a visitor with a bike invites you to trick jumps, the first tap starts the clock,
//   new cards go in kid.trickBook, the best score is kept, and the trick book opens from Status
// Run: node test/smoke/bike.mjs   (SHOTS=dir for screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, tapInVillage, visitorsHere } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
const shots = process.env.SHOTS;

try {
  {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const results = await page.evaluate(async () => {
      const { Bike } = await import('./js/bike.js');
      const { HILLS } = await import('./js/slopes.js');
      const out = [];
      for (const map of Object.keys(HILLS)) {
        for (const tier of [1, 2, 3]) {
          const told = [];
          const g = new Bike({ W: 213, H: 120, map, tier, seed: 5 + tier, day: '2026-11-21', season: tier === 3 ? 'winter' : 'summer', onTrick: (c) => { told.push(c); return 'first'; }, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { bike: tier } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { bike: 2 } } });
          g.down('s', 1); g.up('s');
          let n = 0; let sunk = 0; let bad = 0; let plan = 0;
          for (let i = 0; i < 100 * 60 && g.phase !== 'over'; i += 1) {
            const k = g.kid;
            if (k.state === 'ground') {
              const kk = g.nextKicker(k.x); const tt = kk ? (kk.lip - k.x) / k.vx : 9;
              if (tt > 0.15 && !g.fingers.has('L')) g.down('L', 1);
              else if (tt < 0.05 && g.fingers.has('L')) g.up('L');
            } else if (k.state === 'air') {
              const a = k.air;
              if (a.t > 0.1 && !a.bot) { a.bot = true; n += 1; plan = n % 3; if (plan === 2) { g.down('R', g.W - 1); g.up('R'); } }
              if (plan === 1 && a.t > 0.1) { if (a.flip < 330 && !g.fingers.has('L')) g.down('L', 1); if (a.flip >= 330 && g.fingers.has('L')) g.up('L'); }
              if (plan === 0 && a.t > 0.1 && a.t < 0.6) { if (!g.fingers.has('L')) { g.down('L', 1); g.down('R', g.W - 1); } } else if (plan === 0 && g.fingers.has('R')) { g.up('R'); g.up('L'); }
            }
            g.step(1 / 60);
            for (const p of [g.kid, g.vis]) {
              if (p.state === 'ground' && p.y > g.ground(p.x) + 2) sunk += 1;
              if (!Number.isFinite(p.x + p.y + p.v + p.angle)) bad += 1;
            }
          }
          out.push({ map, tier, phase: g.phase, landed: g.landed, crashes: g.crashes, score: g.score, vis: g.points.vis, sunk, bad, told: told.length, got: g.got.length, cards: [...new Set(told.map((c) => c.id))] });
        }
      }
      return out;
    });
    const all = new Set();
    for (const r of results) {
      const where = `${r.map} bike ${r.tier}`;
      assert.equal(r.phase, 'over', `${where}: the run ends`);
      assert.ok(r.landed >= 8, `${where}: lands tricks (${r.landed})`);
      assert.ok(r.crashes <= r.landed / 3, `${where}: the bot rarely crashes (${r.crashes} of ${r.landed})`);
      assert.equal(r.sunk, 0, `${where}: nobody sinks into the ground`);
      assert.equal(r.bad, 0, `${where}: no NaN`);
      assert.ok(r.score > 0 && r.vis > 0, `${where}: both score`);
      assert.ok(r.told >= r.got, `${where}: every new card is reported`);
      for (const c of r.cards) all.add(c);
    }
    for (const id of ['backflip', 'spin', 'nohander', 'moonwalk', 'rainbowloop', 'geyser']) assert.ok(all.has(id), `somebody lands ${id}`);
    assert.deepEqual(errors, []);
    await page.close();
  }

  for (const [name, device] of [['tablet', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true }], ['phone', devices['Pixel 7']]]) {
    const ctx = await browser.newContext(device);
    const page = await ctx.newPage();
    await useTestDay(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = 'sha256:test';
    s.settings.sound = false;
    const tasks = defaultTasks();
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: { background: 'bg-rainbow' } } });
    s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-bike-good'], buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page);
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /trick jumps/i, 'the rider invites you to trick jumps');
    await tapInVillage(page, '.v-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Trick jumps\nWith Ben's bike", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="tricks"]');
    await page.waitForSelector('.playground[data-phase]');
    assert.match(await page.locator('.play-top').innerText(), /Trick jumps with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the hill fits the screen');
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    await page.mouse.click(box.x + box.width * 0.2, box.y + box.height * 0.6);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the clock');
    // hold the left thumb to pedal for a while, then let go
    await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.6);
    await page.mouse.down(); await page.waitForTimeout(1500); await page.mouse.up();
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/bike-${name}.png` });
    // a new card goes in the trick book once; the same height again is not a record
    const res = await page.evaluate(() => {
      const g = document.querySelector('.playground').game;
      g.earn(g.kid, ['backflip'], { h: 3.5, d: 12, grade: 'perfect' });
      g.earn(g.kid, ['backflip'], { h: 3.5, d: 12, grade: 'good' });
      return g.got.filter((x) => x.id === 'backflip').map((x) => (x.first ? 'first' : x.record ? 'record' : null));
    });
    assert.deepEqual(res, ['first']);
    const book = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0].trickBook);
    assert.ok(book.backflip, 'the backflip is in the trick book');
    assert.equal(book.backflip.n, 2);
    assert.equal(book.backflip.h, 3.5);
    assert.equal(book.backflip.map, 'bg-rainbow');
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.points.kid = 777; g.left = 0.05; for (const p of [g.kid]) { if (p.state !== 'ground') { p.state = 'ground'; p.air = null; } } });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over');
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/bike-over-${name}.png` });
    await page.click('.play-close');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(saved.kids[0].playLog.n, 1, 'the game counts toward the day');
    assert.equal(saved.kids[0].playBest?.tricks, 777, 'points are kept as the best');
    // the trick book, from the status pop-up
    await page.waitForTimeout(400);
    await page.click('.k-plate[data-action="status"]');
    await page.click('.p-foot [data-action="status-tricks"]');
    await page.waitForSelector('.trickbook');
    await page.waitForTimeout(600);
    assert.match(await page.locator('.trickbook').innerText(), /\d+ of \d+ trick cards/);
    if (shots) await page.screenshot({ path: `${shots}/bike-book-${name}.png` });
    await page.click('.tb-card[data-trick="backflip"]');
    await page.waitForSelector('.tb-page');
    assert.match(await page.locator('.tb-page').innerText(), /Highest: 3\.5 m, as high as a giraffe|Highest: 3\.5 m, as high as a basketball hoop/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('bike test passed');
} finally {
  await browser.close();
  site.close();
}
