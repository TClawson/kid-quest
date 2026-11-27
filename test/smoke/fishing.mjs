// Browser test for fishing (js/fishing.js):
// - 90 seconds on every map at tablet and phone size: fish only ever swim in
//   from off the right edge, never flicker (turn around twice within 0.7 s),
//   never sit inside the lake bed, and the session ends
// - a hooked fish has the line at its mouth
// - time's up with a big fish on far out: the kid still gets to reel it in (it takes over 15 s)
// - in the app: a visitor with a fishing rod goes fishing with you, the first
//   tap starts the clock, points are kept as the kid's best, and the biggest of
//   each kind of fish goes in the kid's fish book (kid.fishRecords)
// Run: node test/smoke/fishing.mjs   (SHOTS=dir for screenshots)
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
    // time's up with a big fish hooked at the far side: the game waits while the kid reels it in
    // (a kid-like reeler: holds, lets go when the line is red, 0.35 s late), and ends once it's landed
    const big = await page.evaluate(async () => {
      const { Fishing } = await import('./js/fishing.js');
      const g = new Fishing({ W: 640, H: 400, map: 'bg-meadow', seed: 3, day: '2026-11-27', kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { rod: 1 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { rod: 1 } } });
      g.phase = 'play';
      for (let i = 0; i < 900 && !g.fish.some((x) => x.state === 'swim'); i += 1) g.step(1 / 30);
      const L = g.lines.kid; const f = g.fish.find((x) => x.state === 'swim');
      f.size = 1;
      L.state = 'water'; L.x = g.W - 12; L.y = g.surface + 20; L.held = true; L.downAt = g.t - 1;
      g.hook(L, f);
      g.left = 0.5;
      let t = 0; let want = true; let at = null;
      while (g.phase === 'play' && t < 120) {
        const w = L.tension > 0.85 ? false : L.tension < 0.35 ? true : want;
        if (w !== want) { if (at === null) at = t + 0.35; if (t >= at) { want = w; at = null; L.held = want; L.downAt = g.t - 1; } }
        g.step(1 / 30); t += 1 / 30;
      }
      return { t, phase: g.phase, caught: g.catches.filter((c) => c.who === 'kid').length };
    });
    assert.ok(big.t > 15, `a big fish far out takes more than 15 s to reel in (${big.t.toFixed(1)} s)`);
    assert.equal(big.caught, 1, 'time\'s up does not cut off a big fish being reeled in');
    assert.equal(big.phase, 'over', 'the game ends once it is landed');
    // the boat rows (Taylor, 2026-11-27): out to the deep water and back, only with the line in;
    // the deep water's giant swims only out past the drop-off, only with the boat
    const boat = await page.evaluate(async () => {
      const { Fishing, SPOTS, deepChance } = await import('./js/fishing.js');
      const make = (map, gear, seed = 4) => new Fishing({ W: 213, H: 133, map, seed, day: '2026-11-27', kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { rod: 2 } } });
      const out = { maps: [] };
      const g = make('bg-meadow', { rod: 1, boat: 1 });
      const [left, right] = g.rowButtons();
      const x0 = g.camX; const k0 = g.kid.x;
      g.tap(right.x, right.y); for (let i = 0; i < 60; i += 1) g.step(1 / 30);
      out.rowedOut = g.camX - x0; out.kidMoved = g.kid.x - k0; out.phaseAfterRowing = g.phase;
      g.release(); for (let i = 0; i < 60; i += 1) g.step(1 / 30);
      const glide = g.camX; for (let i = 0; i < 30; i += 1) g.step(1 / 30); out.stopped = g.camX === glide;
      g.tap(right.x, right.y); for (let i = 0; i < 30 * 30; i += 1) g.step(1 / 30); out.farEnd = g.camX === g.camMax; out.overDeep = g.waterUnder;
      g.release(); g.tap(left.x, left.y); for (let i = 0; i < 30 * 30; i += 1) g.step(1 / 30); out.nearEnd = g.camX === g.camMin; g.release();
      out.boatInWater = g.homeX - 44 > g.bankX;
      // with the line out it can't row
      g.tap(g.button.x, g.button.y); g.tap(g.button.x, g.button.y); for (let i = 0; i < 40; i += 1) g.step(1 / 30);
      const was = g.camX; g.tap(right.x, right.y); for (let i = 0; i < 30; i += 1) g.step(1 / 30); g.release();
      out.rowedWithLineOut = g.camX !== was; out.told = g.pops.some((p) => /Reel in first/.test(p.text));
      out.reachInView = g.landAt(1) <= g.camX + g.fieldW;
      out.noBoatButtons = make('bg-meadow', { rod: 3 }).rowButtons().length;
      // the giant: never without the boat (even when its time comes), always past the drop-off with it
      let noBoat = 0;
      for (let seed = 1; seed < 40; seed += 1) { const n = make('bg-meadow', { rod: 3 }, seed); if (n.deepAt !== null) noBoat += 1; n.deepAt = 0; n.phase = 'play'; n.step(1 / 30); if (n.fish.some((f) => f.deep)) noBoat += 1; }
      out.giantsWithoutBoat = noBoat;
      let rolled = 0; for (let seed = 1; seed <= 400; seed += 1) if (make('bg-castle', { rod: 1, boat: 1 }, seed).deepAt !== null) rolled += 1;
      out.giantShare = rolled / 400; out.expected = deepChance(1);
      for (const map of Object.keys(SPOTS)) {
        const b = make(map, { rod: 2, boat: 1 }, 7);
        b.phase = 'play'; b.deepAt = 0; b.camX = b.camMax; b.kid.x = b.homeX - 13; b.kid.tx = b.kid.x;
        b.step(1 / 30);
        const f = b.fish.find((x) => x.deep);
        let shallow = 0; let low = 0; let visHooked = 0; let deepCover = b.weeds.concat(b.logs).filter((o) => o.x > b.deepX).length;
        // the visitor's bait right by it: the giant pays it no mind
        const V = b.lines.vis; V.state = 'water'; V.bait = 'worm';
        for (let i = 0; i < 30 * 40 && f && !f.gone; i += 1) {
          if (V.state === 'water') { V.x = f.x - f.pw / 2; V.y = f.y; } else V.state = 'water';
          b.ai.reelAt = Infinity; b.step(1 / 30);
          if (V.state === 'fight' && V.fish === f) visHooked += 1;
          if (f.state === 'swim' && f.x < b.deepX && f.born > b.t - f.life) shallow += 1;
          if (f.y + f.ph / 2 > b.H) low += 1;
        }
        out.maps.push({ map, giant: f?.name, deep: f?.deep, shallow, low, visHooked, deepCover, sizeOk: f ? f.size >= 0.45 && f.size <= 1.2 : false, lb: f?.lb });
      }
      return out;
    });
    assert.ok(boat.rowedOut > 10, `holding the arrow rows out (${boat.rowedOut.toFixed(1)})`);
    assert.ok(Math.abs(boat.kidMoved - boat.rowedOut) < 0.01, 'the buddies ride along');
    assert.equal(boat.phaseAfterRowing, 'ready', 'rowing before the first cast does not start the clock');
    assert.ok(boat.stopped, 'let go, and the boat glides to a stop');
    assert.ok(boat.farEnd && boat.nearEnd, 'rows all the way out and all the way back in');
    assert.equal(boat.overDeep, 'over', 'all the way out, the boat is over the deep water');
    assert.ok(boat.boatInWater, 'all the way in, the boat is still in the water');
    assert.ok(!boat.rowedWithLineOut && boat.told, 'no rowing with the line out (it says to reel in first)');
    assert.ok(boat.reachInView, 'a cast lands on the screen');
    assert.equal(boat.noBoatButtons, 0, 'no row buttons without a boat');
    assert.equal(boat.giantsWithoutBoat, 0, 'no giant without the boat');
    assert.ok(Math.abs(boat.giantShare - boat.expected) < 0.07, `the giant comes in about ${boat.expected} of boat games (${boat.giantShare})`);
    for (const m of boat.maps) {
      assert.ok(m.giant && m.deep, `${m.map}: the giant swims in`);
      assert.equal(m.shallow, 0, `${m.map}: the giant stays out over the deep water`);
      assert.equal(m.low, 0, `${m.map}: the giant stays on the screen, not below it`);
      assert.equal(m.visHooked, 0, `${m.map}: only the kid can hook the giant`);
      assert.equal(m.deepCover, 0, `${m.map}: no weeds or logs past the drop-off`);
      assert.ok(m.sizeOk && m.lb > 0, `${m.map}: always a big one (${m.lb} lb)`);
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
    await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = 'sha256:test';
    s.settings.sound = false;
    s.settings.questView = 'map'; // chose the old map once: the village opens all the same
    const tasks = defaultTasks();
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: { background: 'bg-volcano' } } });
    s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-rod-good'], buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page); // they walk in first (the first time today)
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /fishing/i, 'the fisher invites you fishing');
    await tapInVillage(page, '.v-visitor'); // the buddy walks over to the visitor
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Fishing\nWith Ben's rod", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="fishing"]');
    await page.waitForSelector('.playground[data-phase]'); // its first frame has drawn (a busy machine can be slow to)
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
