// Browser test for football (js/football.js):
// - 90 seconds at tablet and phone size with a quick (but not instant) kid: the
//   catcher can always get to where the ball comes down, both buddies, and the
//   session ends with points scored
// - in the app: a visitor with a football invites you to throw it, the first tap
//   starts the clock, and points are kept as the kid's best
// Run: node test/smoke/football.mjs   (SHOTS=dir for screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

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
      const { Football, zoneAt, reachFor } = await import('./js/football.js');
      const out = [];
      for (const [W, H] of [[213, 120], [130, 150]]) {
        for (const seed of [3, 8, 21]) {
          const g = new Football({ W, H, seed, kid: { name: 'A', buddy: { species: 'fox', outfit: {} } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { football: 1 } } });
          const far = { kid: 0, vis: 0 }; const plays = { kid: 0, vis: 0 }; let offField = 0;
          const land = g.land.bind(g);
          g.land = () => { const d = g.down; const who = d.catcher === g.kid ? 'kid' : 'vis'; plays[who] += 1; if (Math.hypot(d.catcher.x - g.ball.tx, d.catcher.y - g.ball.ty) > reachFor(g.tier)) far[who] += 1; land(); };
          const routes = ['short', 'medium', 'deep']; let n = 0; let seenWait = null; let seenAir = null;
          g.tap(1, 1);
          for (let i = 0; i < 100 * 30 && g.phase !== 'over'; i += 1) {
            const d = g.down;
            if (d.stage === 'pick' && g.ready()) { const [x, y] = d.cones[routes[n++ % 3]]; g.tap(x, y); }
            if (d.stage === 'aim' && d.thrower === g.kid && g.t - d.aimAt > 0.3 && zoneAt(g.meter(), g.tier) !== 'red') g.tap(1, 1);
            if (d.catcher === g.kid) {
              // a quick kid: 0.15 s to react to the aim, then 0.15 s to the ball's shadow
              if (d.stage === 'wait') { seenWait ??= g.t; if (g.t - seenWait > 0.15) g.runTo(d.cones[d.route][0], d.cones[d.route][1] - 6); } else seenWait = null;
              if (d.stage === 'air') {
                seenAir ??= g.t;
                if (g.t - seenAir > 0.15) g.drag(g.ball.tx, g.ball.ty - 6);
                if (g.t >= d.catchAt - 0.05 && !d.tried) { const bt = g.button(); g.tap(bt.x, bt.y); }
              } else seenAir = null;
            }
            g.step(1 / 30);
            for (const p of [g.kid, g.vis]) if (p.x < 0 || p.x > W || p.y < g.f.y0 || p.y > H) offField += 1;
          }
          out.push({ W, H, seed, phase: g.phase, score: g.score, plays, far, offField });
        }
      }
      return out;
    });
    for (const r of results) {
      const where = `${r.W}x${r.H} seed ${r.seed}`;
      assert.equal(r.phase, 'over', `${where}: the session ends after 90 s`);
      assert.ok(r.plays.kid >= 5 && r.plays.vis >= 5, `${where}: both buddies catch (${JSON.stringify(r.plays)})`);
      assert.equal(r.far.vis, 0, `${where}: the visitor always gets there`);
      assert.equal(r.far.kid, 0, `${where}: a quick kid always gets there`);
      assert.ok(r.score > 0, `${where}: catches score points`);
      assert.equal(r.offField, 0, `${where}: buddies stay on the field`);
    }
    // the miss messages tell timing from position: force each kid-catch case and read the pops
    const said = await page.evaluate(async () => {
      const { Football } = await import('./js/football.js');
      const run = (tap, atBall) => {
        const g = new Football({ W: 213, H: 120, seed: 5, kid: { name: 'A', buddy: { species: 'fox', outfit: {} } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
        g.down = { ...g.down, catcher: g.kid, thrower: g.vis, stage: 'air', route: 'short', zone: 'green', tap, tried: true, catchAt: 0, nextAt: 0 };
        g.ball = { ...g.ball, tx: 100, ty: 80, x0: 40, y0: 80, T: 1, t0: 0, state: 'air' };
        g.kid.x = atBall ? 100 : 20; g.kid.y = 80;
        g.r = () => 0.9; g.pops = [];
        g.land();
        return g.pops.map((q) => q.text);
      };
      return { early: run('early', true), late: run('late', true), none: run(null, true), fumble: run('yellow', true), wrong: run('green', false), both: run('late', false), great: run('green', true) };
    });
    assert.deepEqual(said.early, ['Too early!']);
    assert.deepEqual(said.late, ['Too late!']);
    assert.deepEqual(said.none, ['Too late!']);
    assert.deepEqual(said.fumble, ['Fumbled!']);
    assert.deepEqual(said.wrong, ['Missed!']);
    assert.deepEqual(said.both.slice().sort(), ['Missed!', 'Too late!']);
    assert.deepEqual(said.great, ['Great catch!', '+5']);
    console.log(results.map((r) => `${r.W}x${r.H}/${r.seed}: ${r.score} pts, plays ${r.plays.kid}+${r.plays.vis}`).join('; '));
    assert.deepEqual(errors, []);
    await page.close();
  }

  for (const [name, device] of [['tablet', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true }], ['phone', devices['Pixel 7']]]) {
    const ctx = await browser.newContext(device);
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = 'sha256:test';
    s.settings.sound = false;
    s.settings.questView = 'map'; // the old map (a new device starts in the village)
    const tasks = defaultTasks();
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: dateKey(), owned: [], buddy: { species: 'fox', outfit: {} } });
    s.log[dateKey()] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-football-good'], exBest: 3, buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.map-visitor');
    await page.waitForTimeout(900);
    assert.match(await page.locator('.map-visitor .visitor-bubble').innerText(), /football/i, 'the visitor invites you to throw the football');
    await page.click('.map-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Football\nWith Ben's football", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="football"]');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Football with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the field fits the screen');
    const [fw, fh] = await field.evaluate((c) => [c.width, c.height]);
    const at = (x, y) => [box.x + (x * box.width) / fw, box.y + (y * box.height) / fh];
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    await page.mouse.click(...at(fw / 2, fh / 2));
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the clock');
    assert.ok(await page.evaluate(() => document.querySelector('.playground').game.vis.moves.has('spiral')), "the visitor's unlocked moves come along");
    // pick the short cone, aim, and watch the throw
    await page.waitForFunction(() => document.querySelector('.playground').game.ready());
    const cone = await page.evaluate(() => document.querySelector('.playground').game.down.cones.short);
    await page.mouse.click(...at(...cone));
    await page.waitForTimeout(500);
    await page.mouse.click(...at(fw / 2, fh / 2));
    assert.equal(await page.evaluate(() => document.querySelector('.playground').game.down.stage), 'wait', 'the tap set the aim');
    await page.waitForFunction(() => document.querySelector('.playground').game.ball.state === 'air');
    if (shots) await page.screenshot({ path: `${shots}/football-${name}.png` });
    // a real finger on the CATCH button (not a direct tap() call) must count as a catch tap
    await page.waitForFunction(() => { const g = document.querySelector('.playground').game; return g.down.stage === 'pick' && g.down.catcher === g.kid && g.ready(); }, null, { timeout: 15000 });
    const cone2 = await page.evaluate(() => document.querySelector('.playground').game.down.cones.short);
    await page.mouse.click(...at(...cone2));
    await page.waitForFunction(() => { const g = document.querySelector('.playground').game; return g.down.catcher === g.kid && g.down.stage === 'air' && !g.down.tried; }, null, { timeout: 15000 });
    const bt = await page.evaluate(() => document.querySelector('.playground').game.button());
    await page.mouse.click(...at(bt.x, bt.y));
    const tapped = await page.evaluate(() => { const d = document.querySelector('.playground').game.down; return [d.tried, d.tap]; });
    assert.equal(tapped[0], true, 'pressing the CATCH button with a finger registers the tap');
    assert.ok(tapped[1], 'the tap has a timing color');
    // end the session early and check the best score is kept
    await page.waitForFunction(() => document.querySelector('.playground').game.down.stage === 'result');
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.score = 35; g.left = 0.05; });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over', null, { timeout: 8000 });
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: `${shots}/football-over-${name}.png` });
    await page.click('.play-close');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(saved.kids[0].playLog.n, 1, 'the game counts toward the day');
    assert.equal(saved.kids[0].playBest?.football, 35, 'points are kept as the best');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('football test passed');
} finally {
  await browser.close();
  site.close();
}
