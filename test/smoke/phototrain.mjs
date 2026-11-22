// Browser test for the photo train (js/phototrain.js) and the critter album (js/albumview.js):
// - a 90 second ride on every map in every season, at tablet and phone size, with a bot that
//   holds focus on an animal's sign and lets go when it poses: the ride ends, perfect photos
//   happen, every kept photo is told to the album, and nothing throws while drawing
// - aiming takes no photo, even when the finger lifts; the shutter button takes it
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
      const { PhotoTrain, LIFT, TRAIN_MAPS } = await import('./js/phototrain.js');
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
            let target = null;
            for (let i = 0; i < 100 * 30 && g.phase !== 'over'; i += 1) {
              if (!target) {
                const o = g.subjects().find((s) => s.k && !s.k.far && s.k.state === 'sign' && s.box.x > W * 0.3 && s.box.x < W * 0.9);
                if (o && g.film > 0) { target = o.k; g.tap(o.box.x + o.box.w / 2, o.box.y + o.box.h / 2 + LIFT); }
              } else if (target.state === 'pose' && g.t - target.st > 0.3) { g.press(); target = null; } else if (target.gone || target.state === 'leave') target = null;
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
      g.press(); const none = g.roll.length; // nothing aimed yet
      g.tap(100, 60); g.release(); for (let i = 0; i < 30; i += 1) g.step(1 / 30);
      const aimed = { roll: g.roll.length, view: !!g.view, film: g.film, full: g.cam.film };
      const b = g.shutter;
      const early = { none, ...aimed, onButton: g.onButton(b.x, b.y) };
      g.press();
      early.after = g.roll.length; early.filmAfter = g.film;
      return { rides: out, early };
    });
    assert.equal(early.none, 0, 'the shutter without aiming takes nothing');
    assert.equal(early.roll, 0, 'aiming and lifting the finger takes no photo');
    assert.ok(early.view, 'the viewfinder stays up');
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
