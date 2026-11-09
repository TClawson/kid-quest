// Browser test for fishing (js/fishing.js):
// - 90 seconds on every map at tablet and phone size: fish only ever swim in
//   from off the right edge, never flicker (turn around twice within 0.7 s),
//   never sit inside the lake bed, and the session ends
// - a hooked fish has the line at its mouth
// - in the app: a visitor with a fishing rod goes fishing with you, the first
//   tap starts the clock, points are kept as the kid's best, and the biggest of
//   each kind of fish goes in the kid's fish book (kid.fishRecords)
// Run: node test/smoke/fishing.mjs   (SHOTS=dir for screenshots)
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';

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
      const { Fishing, SPOTS } = await import('./js/fishing.js');
      const out = [];
      for (const map of Object.keys(SPOTS)) {
        for (const [W, H] of [[213, 120], [130, 150]]) {
          const told = [];
          const g = new Fishing({ W, H, map, seed: 7, day: '2026-11-05', onCatch: (c) => { told.push(c); return null; }, kid: { name: 'A', buddy: { species: 'fox', outfit: {} } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { rod: 2 } } });
          const seen = new Map(); let quick = 0; let popIn = 0; let buried = 0; let mouth = 0; let hooked = 0;
          for (let i = 0; i < 95 * 30 && g.phase !== 'over'; i += 1) {
            const L = g.lines.kid;
            if (L.state === 'idle' || (L.state === 'aim' && g.r() < 0.05)) g.tap(g.button.x, g.button.y);
            else if (L.state === 'water' && i % 45 === 0) { g.press(); g.release(); }
            else if (L.state === 'fight') { if (L.tension < 0.4 && !L.held) g.press(); else if (L.tension > 0.8) g.release(); }
            g.step(1 / 30);
            for (const f of g.fish) {
              const v = seen.get(f);
              if (!v) { if (f.x - f.pw / 2 < W) popIn += 1; seen.set(f, { face: f.face, at: g.t }); continue; }
              if (f.face !== v.face && f.state !== 'hooked') { if (g.t - v.at < 0.69) quick += 1; v.face = f.face; v.at = g.t; }
              if (f.state !== 'hooked' && f.y > g.bedAt(f.x) + 1) buried += 1;
            }
            for (const Ln of Object.values(g.lines)) {
              if (Ln.state !== 'fight') continue;
              hooked += 1;
              const f = Ln.fish; const nose = f.x - f.pw / 2 + 1; // pictures face left: the nose is the left end
              if (f.face !== -1 || Math.abs(nose - Ln.x) > 2) mouth += 1;
            }
          }
          const mine = g.catches.filter((c) => c.who === 'kid');
          const toldOk = told.length === mine.length && told.every((c, i) => c.map === map && c.kind === mine[i].kind && c.size === mine[i].inches && c.points === mine[i].points);
          out.push({ map, W, H, fish: seen.size, quick, popIn, buried, hooked, mouth, phase: g.phase, points: g.points, toldOk });
        }
      }
      return out;
    });
    for (const r of results) {
      const where = `${r.map} ${r.W}x${r.H}`;
      assert.ok(r.fish > 10, `${where}: fish come by (${r.fish})`);
      assert.equal(r.popIn, 0, `${where}: new fish swim in from off screen`);
      assert.equal(r.quick, 0, `${where}: no fish flickers back and forth`);
      assert.equal(r.buried, 0, `${where}: no fish inside the lake bed`);
      assert.equal(r.mouth, 0, `${where}: the line goes to a hooked fish's mouth`);
      assert.equal(r.phase, 'over', `${where}: the session ends after 90 s`);
      assert.ok(r.toldOk, `${where}: every fish the kid lands is reported for the fish book`);
    }
    if (!results.some((r) => r.hooked > 0)) console.log(JSON.stringify(results));
    assert.ok(results.some((r) => r.hooked > 0), 'fish get hooked');
    assert.ok(results.some((r) => r.points.kid + r.points.vis > 0), 'catches score points');
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
    const tasks = defaultTasks();
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: dateKey(), owned: [], buddy: { species: 'fox', outfit: { background: 'bg-volcano' } } });
    s.log[dateKey()] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-rod-good'], buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await page.click('[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.map-visitor');
    await page.waitForTimeout(900);
    assert.match(await page.locator('.map-visitor .visitor-bubble').innerText(), /fishing/i, 'the fisher invites you fishing');
    await page.click('.map-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Fishing\nWith Ben's rod", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="fishing"]');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Fishing with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the lake fits the screen');
    const [fw, fh] = await field.evaluate((c) => [c.width, c.height]);
    const at = (x, y) => [box.x + (x * box.width) / fw, box.y + (y * box.height) / fh];
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    // CAST, wait for the needle, cast, then reel a little and twitch
    await page.mouse.click(...at(fw - 15, fh - 15));
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the clock');
    await page.waitForTimeout(600);
    await page.mouse.click(...at(fw - 15, fh - 15));
    await page.waitForTimeout(2200);
    if (shots) await page.screenshot({ path: `${shots}/fishing-${name}.png` });
    await page.mouse.move(...at(fw * 0.6, fh * 0.6)); await page.mouse.down(); await page.waitForTimeout(800); await page.mouse.up();
    await page.mouse.click(...at(fw * 0.6, fh * 0.6));
    // land a pike: it goes in the fish book, once (the same size again isn't a new record)
    const rec = await page.evaluate(() => {
      const g = document.querySelector('.playground').game;
      const f = g.makeFish('pike', g.W * 0.6, g.H * 0.7, 'lurk');
      f.post = [f.x, f.y];
      g.land(g.lines.kid, f);
      const first = g.catches.at(-1).record;
      g.land(g.lines.kid, { ...f, gone: false });
      return { first, again: g.catches.at(-1).record || null, inches: f.inches, records: g.records };
    });
    assert.equal(rec.first, 'first');
    assert.equal(rec.again, null);
    assert.equal(rec.records, 1);
    const book = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0].fishRecords);
    assert.deepEqual(Object.keys(book), ['volcano-pike']);
    assert.equal(book['volcano-pike'].size, rec.inches);
    assert.equal(book['volcano-pike'].map, 'bg-volcano');
    // end the session early and check the best score is kept
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.lines.kid.state = 'idle'; g.points.kid = 42; g.left = 0.05; });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over');
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: `${shots}/fishing-over-${name}.png` });
    await page.click('.play-close');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(saved.kids[0].playLog.n, 1, 'the game counts toward the day');
    assert.equal(saved.kids[0].playBest?.fishing, 42, 'points are kept as the best');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('fishing test passed');
} finally {
  await browser.close();
  site.close();
}
