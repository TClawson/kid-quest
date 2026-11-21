// Browser test for the sled's treasure hill (js/sledding.js):
// - in the app: a visitor with a sled invites you sledding, the first tap starts the run,
//   finds go in the kid's finds book (kid.findRecords), the best score is kept, a run with no
//   super rare counts toward the next one (kid.sledDry), and the book in the house shows the
//   finds book with its own pages of facts
// Run: node test/smoke/sledding.mjs   (SHOTS=dir for screenshots)
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
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: [], buddy: { species: 'fox', outfit: { background: 'bg-volcano' } } });
    s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
    await page.evaluate((st) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
      localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
        { id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-sled-good'], buddy: { species: 'bear', outfit: {} } },
      ]));
    }, s);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForTimeout(500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
    await page.waitForSelector('.village .v-visitor');
    await visitorsHere(page);
    await page.waitForTimeout(900);
    assert.match(await page.locator('.village .v-visitor .visitor-bubble').innerText(), /sledding/i, 'the sledder invites you sledding');
    await tapInVillage(page, '.v-visitor');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Treasure hill\nWith Ben's sled", 'Tag\nNo gear needed']);
    await page.click('.game-pick [data-kind="sledding"]');
    await page.waitForSelector('.playground[data-phase]');
    assert.match(await page.locator('.play-top').innerText(), /Treasure hill with Ben/);
    const box = await page.locator('.play-field').boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the hill fits the screen');
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'ready');
    if (shots) await page.screenshot({ path: `${shots}/sled-ready-${name}.png` });
    // no finds on the hill, so the only one in the book is the one this test hands over
    await page.evaluate(() => { document.querySelector('.playground').game.finds.length = 0; });
    await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play', 'the first tap starts the run');
    // hold the button down for a jump, then let go
    await page.mouse.down(); await page.waitForTimeout(250); await page.mouse.up();
    await page.waitForTimeout(1800);
    if (shots) await page.screenshot({ path: `${shots}/sled-play-${name}.png` });
    // grab a geode-like find: it goes in the finds book once (the same again isn't new)
    const got = await page.evaluate(() => {
      const g = document.querySelector('.playground').game;
      const R = g.rider;
      g.take(R, { x: R.x, h: 0, key: 'volcano-obsidian', surf: null });
      const first = g.haul.at(-1).record;
      g.take(R, { x: R.x, h: 0, key: 'volcano-obsidian', surf: null });
      return { first, map: g.hill.id, records: g.records };
    });
    assert.equal(got.first, 'new');
    assert.equal(got.map, 'bg-volcano', "the kid's own map's hill");
    let saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0]);
    assert.deepEqual(Object.keys(saved.findRecords), ['volcano-obsidian']);
    assert.equal(saved.findRecords['volcano-obsidian'].n, 2);
    // skip to the bottom of the hill
    await page.evaluate(() => { const g = document.querySelector('.playground').game; g.points.kid = 77; g.rider.x = g.bigRamp.x + 400; g.rider.on = 'g'; g.big = null; });
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over');
    await page.waitForTimeout(400);
    if (shots) await page.screenshot({ path: `${shots}/sled-over-${name}.png` });
    await page.click('.play-close');
    saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')).kids[0]);
    assert.equal(saved.playLog.n, 1, 'the run counts toward the day');
    assert.ok(saved.playBest?.sledding >= 77, 'points are kept as the best');
    assert.equal(saved.sledDry?.['bg-volcano'], 1, 'a run with no super rare');
    // the book in the house: the finds tab, and a find's page
    await page.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'status-fish'; b.id = 'open-book'; document.body.append(b); });
    await page.evaluate(() => document.getElementById('open-book').click());
    await page.click('#modal [data-book="finds"]');
    await page.waitForSelector('#modal .findsbook');
    assert.match(await page.locator('#modal .findsbook').innerText(), /1 of 60 finds/);
    await page.click('#modal [data-action="find-page"]');
    await page.waitForSelector('#modal .findpage');
    assert.match(await page.locator('#modal .findpage').innerText(), /Obsidian[\s\S]*natural black glass/);
    if (shots) await page.screenshot({ path: `${shots}/sled-find-page-${name}.png` });
    await page.click('#modal [data-action="finds-book-back"]');
    await page.click('#modal [data-book="fish"]');
    await page.waitForSelector('#modal .fishbook:not(.findsbook)');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('sledding test passed');
} finally {
  await browser.close();
  site.close();
}
