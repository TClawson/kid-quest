// Browser test for the photo train (js/phototrain.js) and the critter album (js/albumview.js):
// - a whole ride on every map in every season, at tablet and phone size, with a bot that
//   finds an animal's sign, holds a finger on it so the camera pans there, and presses SNAP
//   when it poses: the ride ends, perfect photos happen, every kept photo is told to the
//   album, and nothing throws while drawing
// - the train view until a finger touches; the camera pans no faster than PAN_CAP; the
//   viewfinder stays up GRACE seconds after the finger lifts; touching takes no photo, the
//   shutter does; the Super camera's zoom lens turns
// - in the app: a visitor with a camera invites you on the photo train, a photo goes in the
//   kid's critter album (kid.critterAlbum), the best score is kept, and the album opens from
//   the Status pop-up with the animal's own page
// Run: node test/smoke/phototrain.mjs   (SHOTS=dir for screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
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
    const { rides: results, early } = await page.evaluate(async () => {
      const { PhotoTrain, TRAIN_MAPS, PAN_CAP, GRACE, GAME_SECONDS } = await import('./js/phototrain.js');
      const { botStep } = await import('./test/helpers/photobot.js');
      const out = [];
      for (const map of TRAIN_MAPS) {
        for (const season of ['spring', 'summer', 'autumn', 'winter']) {
          for (const [W, H] of [[213, 120], [130, 150]]) {
            const told = [];
            const g = new PhotoTrain({ W, H, map, season, day: '2026-11-21', seed: 11, clues: 3, onPhoto: (s) => { told.push(s); return 'new'; }, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 3 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
            const c = document.createElement('canvas'); c.width = W * g.Z; c.height = H * g.Z;
            const h = document.createElement('canvas'); h.width = W * 4; h.height = H * 4;
            const ctx = c.getContext('2d'); const hctx = h.getContext('2d');
            g.tap(W / 2, H / 2); // the first tap starts the ride
            for (let i = 0; i < (GAME_SECONDS + 20) * 30 && g.phase !== 'over'; i += 1) {
              botStep(g);
              g.step(1 / 30);
              if (i % 6 === 0) { g.draw(ctx); g.drawHud(hctx, 4); }
            }
            g.draw(ctx); // a photo's picture is filled in on the next draw
            const kept = g.roll.filter((s) => s.critter && s.quality !== 'blurry');
            out.push({ map, season, W, H, phase: g.phase, shots: g.roll.length, perfect: kept.filter((s) => s.quality === 'perfect').length, told: told.length, kept: kept.length, pics: g.roll.filter((s) => s.pic).length, critters: g.critters.length });
          }
        }
      }
      // aiming takes no photo; the shutter does, and the viewfinder stays up after the finger lifts
      const g = new PhotoTrain({ W: 213, H: 120, map: 'bg-meadow', day: '2026-11-21', seed: 3, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 1 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
      g.tap(100, 60);
      for (let i = 0; i < 10; i += 1) g.step(1 / 30);
      const rest = { x: g.eye.x, y: g.eye.y, vf: g.vf };
      g.press(); const none = g.roll.length; // the camera is down: SNAP only brings it up
      for (let i = 0; i < 3 * 30; i += 1) g.step(1 / 30);
      // a finger by the right edge: the camera comes up and pans, no faster than the cap
      g.tap(176, 30);
      const x0 = g.eye.x;
      for (let i = 0; i < 15; i += 1) g.step(1 / 30);
      const moved = g.eye.x - x0;
      g.up(); for (let i = 0; i < 30; i += 1) g.step(1 / 30);
      const aimed = { roll: g.roll.length, view: g.looking, film: g.film, full: g.cam.film };
      const b = g.shutter;
      const early = { none, rest, moved, cap: PAN_CAP * 0.5, ...aimed, onButton: g.onButton(b.x, b.y) };
      g.press();
      early.after = g.roll.length; early.filmAfter = g.film;
      for (let i = 0; i < (GRACE + 1) * 30; i += 1) g.step(1 / 30);
      early.down = { vf: g.vf, back: Math.abs(g.eye.x - rest.x) < 1 && Math.abs(g.eye.y - rest.y) < 1 };
      // the Super camera's zoom lens: 1x, 1.6x, 2.5x
      const s3 = new PhotoTrain({ W: 213, H: 120, map: 'bg-meadow', day: '2026-11-21', seed: 3, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 3 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
      s3.tap(100, 60); const zb = s3.zoomButton; const lenses = [s3.lensZoom];
      s3.tap(zb.x, zb.y); lenses.push(s3.lensZoom); s3.tap(zb.x, zb.y); lenses.push(s3.lensZoom); s3.tap(zb.x, zb.y); lenses.push(s3.lensZoom);
      early.lenses = lenses;
      early.noZoom = g.zoomButton;
      // snacks and the bell: a sleeper (zzz) wakes for a snack and eats facing the camera; the bell rests
      const L = new PhotoTrain({ W: 213, H: 120, map: 'bg-meadow', day: '2026-11-21', seed: 5, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 1 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
      L.tap(100, 60); L.nextAt = 1e9; for (let i = 0; i < 30; i += 1) L.step(1 / 30);
      const { critterById } = await import('./js/critters.js');
      const sl = L.spawn(critterById('meadow-deer'), 'step'); sl.asleep = true;
      const shift = L.dist * 0.35 + L.ox + L.VW * 0.9 - sl.x; sl.x += shift; if (sl.cover) sl.cover.x += shift;
      for (let i = 0; i < 60; i += 1) L.step(1 / 30);
      const lure = { asleep: sl.state === 'sign', snacks: L.snacks };
      L.tap(...L.toView(...L.where(sl))); for (let i = 0; i < 20; i += 1) L.step(1 / 30);
      L.toss(); for (let i = 0; i < 30; i += 1) L.step(1 / 30);
      Object.assign(lure, { left: L.snacks, eating: sl.state === 'pose' && sl.special === 'eat' });
      L.ring(); const rang = L.bellAt; for (let i = 0; i < 30; i += 1) L.step(1 / 30); L.ring();
      lure.rests = L.bellAt === rang;
      early.lure = lure;
      return { rides: out, early };
    });
    assert.equal(early.rest.vf, 0, 'the ride starts on the train view');
    assert.equal(early.none, 0, 'SNAP with the camera down takes nothing');
    assert.ok(early.moved > 5 && early.moved <= early.cap + 0.5, `the camera pans, no faster than the cap: ${early.moved}`);
    assert.equal(early.roll, 0, 'touching and lifting the finger takes no photo');
    assert.ok(early.view, 'the viewfinder stays up after the finger lifts');
    assert.deepEqual(early.down, { vf: 0, back: true }, 'then the camera goes down, back to the train view');
    assert.deepEqual(early.lenses, [1, 1.6, 2.5, 1]);
    assert.equal(early.noZoom, null, 'the Regular camera has no zoom');
    assert.deepEqual(early.lure, { asleep: true, snacks: 3, left: 2, eating: true, rests: true }, 'a snack wakes a sleeper, which eats facing the camera; the bell rests between rings');
    assert.ok(early.onButton, 'the shutter is a button');
    assert.equal(early.after, 1, 'the shutter takes one');
    assert.equal(early.filmAfter, early.full - 1);
    for (const r of results) {
      const where = `${r.map} ${r.season} ${r.W}x${r.H}`;
      assert.equal(r.phase, 'over', `${where}: the ride ends`);
      assert.ok(r.shots > 0, `${where}: the bot took photos`);
      assert.equal(r.told, r.kept, `${where}: every kept photo goes to the album`);
      assert.equal(r.pics, r.shots, `${where}: every photo has its picture`);
    }
    assert.ok(results.filter((r) => r.perfect > 0).length > results.length / 2, `perfect photos happen: ${JSON.stringify(results.map((r) => r.perfect))}`);
    assert.deepEqual(errors, []);
    await page.close();
  }

  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true });
    const page = await ctx.newPage();
    await useTestDay(page);
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = 'sha256:test';
    s.settings.sound = false;
    const tasks = defaultTasks();
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
    s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-camera-good'], buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page);
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /photo train/i, 'the visitor invites you on the photo train');
    await tapInVillage(page, '.v-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Photo train\nWith Ben's camera", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="train"]');
    await page.waitForSelector('.playground[data-phase]');
    assert.match(await page.locator('.play-top').innerText(), /Photo train with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the ride');
    // a perfect photo of the fox goes in the album, and its picture stays on this device
    const rec = await page.evaluate(async () => {
      const g = document.querySelector('.playground').game;
      const shot = { critter: 'meadow-fox', quality: 'perfect', slots: ['portrait'], map: 'bg-meadow', season: 'autumn', weather: 'rain' };
      const first = g.onPhoto(shot);
      const again = g.onPhoto({ ...shot });
      const pic = document.createElement('canvas'); pic.width = 80; pic.height = 60; pic.getContext('2d').fillRect(0, 0, 80, 60);
      shot.pic = pic;
      await new Promise((r) => setTimeout(r, 400));
      return { first, again };
    });
    assert.equal(rec.first, 'new');
    assert.equal(rec.again, null);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0]);
    assert.equal(saved.critterAlbum['meadow-fox'].q, 'perfect');
    assert.ok(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('kidquest.photos') || '{}')).includes('kid_sam|meadow-fox')), 'the photo is kept on this device');
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.points = 33; g.left = 0.05; });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over');
    await page.waitForTimeout(300);
    if (shots) await page.screenshot({ path: `${shots}/phototrain-over.png` });
    await page.click('.play-close');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0]);
    assert.equal(after.playLog.n, 1, 'the ride counts toward the day');
    assert.equal(after.playBest?.train, 33, 'points are kept as the best');
    // the album, from the Status pop-up
    await page.locator('[data-action="status"]').first().click();
    await page.click('[data-action="status-album"]');
    await page.waitForSelector('.critter-album');
    assert.match(await page.locator('.critter-album .fb-count').innerText(), /1 of \d+ animals/);
    if (shots) await page.screenshot({ path: `${shots}/critter-album.png` });
    await page.click('.critter-album [data-critter="meadow-fox"]');
    await page.waitForSelector('.critter-page');
    assert.match(await page.locator('.critter-page h2').innerText(), /Red fox/);
    assert.match(await page.locator('.critter-page').innerText(), /Perfect/);
    await page.click('.critter-page [data-action="album-back"]');
    await page.waitForSelector('.critter-album');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('photo train test passed');
} finally {
  await browser.close();
  site.close();
}
