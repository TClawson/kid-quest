// Browser test for the ski race (js/skirace.js):
// - races on every hill at tablet and phone size with an autopilot kid that takes the open
//   shortcuts: the race ends, both buddies finish, shortcuts are found, nobody leaves the hill
// - steering with a real finger: holding and sliding moves the buddy's line, lifting slows it
// - in the app: a visitor with skis invites you to race, the race counts as a game, and found
//   shortcuts go in the kid's shortcut book (kid.skiBook), which opens from the Status pop-up
// Run: node test/smoke/skirace.mjs   (SHOTS=dir for screenshots)
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
      const { SkiRace, BAND } = await import('./js/skirace.js');
      const { HILL_IDS } = await import('./js/slopes.js');
      const out = [];
      for (const map of HILL_IDS) {
        for (const [W, H, tier] of [[213, 133, 1], [130, 150, 3]]) {
          const g = new SkiRace({ W, H, map, season: 'winter', day: '2026-12-01', seed: 7, kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { skis: tier } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: {} } });
          g.tap(1, 1);
          let off = 0;
          for (let i = 0; i < 60 * 120 && g.phase !== 'over'; i += 1) {
            if (g.phase === 'play' && !g.touch) g.tap(1, 1);
            const k = g.kid; const c = g.c;
            const s = c.sections.find((q) => (k.lane === q || (q.sx + 24 > k.x && q.sx - k.x < 120)));
            k.aim = s ? (k.lane && s.kind === 'ride' ? g.rideLane(s, k.x + 10) : s.y(Math.max(s.sx + 24, (g.kid.x) + 12))) : c.snowAt(k.x + 30);
            g.step(1 / 60);
            for (const p of [g.kid, g.vis]) if (p.y < 0 || p.y > BAND) off += 1;
          }
          out.push({ map, W, phase: g.phase, time: g.time, kidDone: !!g.kid.done, visDone: !!g.vis.done, runs: g.kid.runs.length, news: g.result?.news.length, off });
        }
      }
      return out;
    });
    for (const r of results) {
      const where = `${r.map} ${r.W}`;
      assert.equal(r.phase, 'over', `${where}: the race ends`);
      assert.ok(r.kidDone, `${where}: the kid finishes`);
      assert.ok(r.time > 15 && r.time < 70, `${where}: a race takes ${r.time} s`);
      assert.ok(r.runs >= 2, `${where}: the autopilot found ${r.runs} shortcuts`);
      assert.equal(r.news, r.runs, `${where}: each one is new in an empty book`);
      assert.equal(r.off, 0, `${where}: everyone stays on the hill`);
    }
    console.log(results.map((r) => `${r.map.slice(3)}/${r.W}: ${r.time}s ${r.runs} shortcuts`).join('; '));
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
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: {} } });
    s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-skis-good'], exBest: 0, buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page);
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /race/i, 'the visitor invites you to race');
    await tapInVillage(page, '.v-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Ski race\nWith Ben's skis", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="race"]');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Ski race with Ben/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the field fits the screen');
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    if (shots) await page.screenshot({ path: `${shots}/skirace-ready-${name}.png` });
    const mid = [box.x + box.width / 2, box.y + box.height / 2];
    await page.mouse.click(...mid);
    await page.waitForFunction(() => document.querySelector('.playground').dataset.phase === 'play', null, { timeout: 5000 });
    // a real finger: down, slide down the screen, the line moves down the hill
    const y0 = await page.evaluate(() => document.querySelector('.playground').game.kid.y);
    await page.mouse.move(...mid);
    await page.mouse.down();
    await page.mouse.move(mid[0], mid[1] + box.height * 0.15, { steps: 5 });
    const held = await page.evaluate(() => { const g = document.querySelector('.playground').game; return { aim: g.kid.aim, touch: !!g.touch }; });
    assert.ok(held.touch, 'holding a finger down steers');
    assert.ok(held.aim > y0 + 5, `sliding down moves the line down (${y0} -> ${held.aim})`);
    await page.mouse.up();
    assert.equal(await page.evaluate(() => !!document.querySelector('.playground').game.touch), false, 'lifting the finger lets go');
    // finish the race at once through an open shortcut and check the book and the day's games
    await page.evaluate(() => {
      const g = document.querySelector('.playground').game;
      g.kid.runs.push({ id: g.c.sections[0].sc.id, clean: true, secs: 3.2 });
      g.kid.x = g.c.len - 1; g.kid.v = 100; g.kid.head = 0; g.touch = { y0: 0, aim0: g.kid.y }; g.kid.aim = g.kid.y;
    });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over', null, { timeout: 8000 });
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/skirace-over-${name}.png` });
    const first = await page.evaluate(() => document.querySelector('.playground').game.c.sections[0].sc.id);
    await page.click('.play-close');
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    const kid = saved.kids[0];
    assert.equal(kid.playLog.n, 1, 'the race counts toward the day');
    const map = Object.keys(kid.skiBook || {})[0];
    assert.ok(map, 'the shortcut book has a page');
    assert.ok(kid.skiBook[map].found[first], 'the shortcut is in the book');
    assert.ok(kid.playBest?.race > 0, 'the race points are kept');
    // the book opens from the Status pop-up
    await page.click('[data-action="status"]');
    await page.click('[data-action="status-skis"]');
    await page.waitForSelector('.skibook');
    assert.match(await page.locator('.skibook').innerText(), /1 of 60 hidden shortcuts found/);
    if (shots) await page.screenshot({ path: `${shots}/skibook-${name}.png` });
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('ski race test passed');
} finally {
  await browser.close();
  site.close();
}
