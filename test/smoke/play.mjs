// Browser test: once the quest is done, tapping a visiting buddy in the village opens a game.
// A visitor with a soccer ball plays keepy-uppy, one without plays tag, and a
// new best score is kept on the kid.
// Run: node test/smoke/play.mjs
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash, freeGamesOn } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { seenSaturday } from '../helpers/seed.mjs';
import { openKid, openParents, tapInVillage, visitorsHere } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
const shots = process.env.SHOTS;

// Tap a visitor in the village: the buddy walks over, then the game (or its menu) opens.
// Which family buddies visit is random per day: when the one we want isn't here, the first
// visitor stands in (it answers to their name by the time the buddy gets there).
// With more than one game to play, a menu asks which: pick `kind`.
async function visit(page, id, kind) {
  const here = await page.locator(`.village .v-visitor[data-id="${id}"]`).count();
  await tapInVillage(page, here ? `.v-visitor[data-id="${id}"]` : '.v-visitor', { then: here ? null : `el.dataset.id = ${JSON.stringify(id)};` });
  if (kind) {
    await page.waitForSelector('.game-pick');
    await page.click(`.game-pick [data-kind="${kind}"]`);
  }
}

async function open(device, done, played = 0, held = null, tweak = null) {
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
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: TEST_DAY, owned: ['sport-shoes-regular'], buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } } });
  // Saturday's free games would change every count below, so use them up first
  // and yesterday's (on a Sunday they would carry over), so the counts are the same any day
  s.kids[0].playLog = { day: TEST_DAY, n: played + freeGamesOn(TEST_DAY), prev: { day: addDays(TEST_DAY, -1), n: 99, cap: 4 } };
  if (held) { s.kids[0].owned.push(held); s.kids[0].buddy.outfit.sport = held; }
  if (tweak) tweak(s, tasks);
  seenSaturday(s);
  if (done) s.log[TEST_DAY] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
  await page.evaluate((st) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
    localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
    localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([
      { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', owned: ['sport-soccer-good'], buddy: { species: 'cat', outfit: { sport: 'sport-soccer-good' } } },
      { id: 'kid_max', name: 'Max', color: '#51cf66', owned: [], buddy: { species: 'bear', outfit: {} } },
      { id: 'kid_lu', name: 'Lu', color: '#fcc419', owned: ['sport-hockey-good'], buddy: { species: 'panda', outfit: {} } },
    ]));
  }, s);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await visitorsHere(page); // visitors walk in first (the first time today); their bubbles show once they arrive
  await page.waitForTimeout(500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
  await page.waitForSelector('.village .v-visitor');
  await page.waitForTimeout(900);
  return { page, ctx, errors };
}

try {
  // quest not done: visitors ask the kid to finish first
  {
    const { page, ctx, errors } = await open(devices['Galaxy Tab S4'], false);
    await visit(page, 'kid_ava');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.playground').count(), 0, 'no game before the quest is done');
    assert.match(await page.locator('.v-visitor[data-id="kid_ava"] .visitor-bubble').innerText(), /Finish your quest and let's play! \d+ to go/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // +2 games from last night's chest: those two can be played before today's chores, then the rest wait
  {
    const y = addDays(TEST_DAY, -1);
    const tweak = (s, tasks) => {
      s.kids[0].startDate = y;
      s.kids[0].playLog = { day: y, n: 4 + freeGamesOn(y), cap: 4 }; // a Saturday's free games were played
      s.log[y] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false, chest: { tier: 'wood', kind: 'games', games: 2 } } };
    };
    const { page, ctx, errors } = await open(devices['Galaxy Tab S4'], false, 0, null, tweak);
    assert.match(await page.locator('.v-visitor').first().locator('.visitor-bubble').innerText(), /2 treasure games left from yesterday/);
    if (shots) await page.screenshot({ path: `${shots}/play-early.png` });
    for (const left of [/1 game left today/, /0 games left today/]) {
      await visit(page, 'kid_max');
      await page.waitForSelector('.playground');
      const box = await page.locator('.play-field').boundingBox();
      await page.mouse.click(box.x + box.width * 0.66, box.y + box.height * 0.5);
      await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'play');
      assert.match(await page.locator('.play-left').innerText(), left);
      await page.click('.play-close');
    }
    await page.waitForTimeout(300);
    await visit(page, 'kid_max');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.playground').count(), 0, 'the normal games wait for chores');
    assert.match(await page.locator('.v-visitor[data-id="kid_max"] .visitor-bubble').innerText(), /Finish your quest and let's play!/);
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(saved.kids[0].playLog.n, 2);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // out of games for today: the visitors say so, and no game opens
  {
    const { page, ctx, errors } = await open(devices['Galaxy Tab S4'], true, 4);
    await visit(page, 'kid_max');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.playground').count(), 0, 'no game after 4 today');
    assert.match(await page.locator('.v-visitor[data-id="kid_max"] .visitor-bubble').innerText(), /That's all our games today/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  for (const [name, device] of [['tablet', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, hasTouch: true }], ['phone', devices['Pixel 7']]]) {
    const { page, ctx, errors } = await open(device, true);

    // soccer with Ava's cat (her ball, or tag)
    await visit(page, 'kid_ava');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ["Keepy-uppy\nWith Ava's ball", 'Tag\nNo gear needed']);
    if (shots) await page.screenshot({ path: `${shots}/play-menu-${name}.png` });
    await page.click('.game-pick [data-kind="soccer"]');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Keepy-uppy with Ava/);
    const field = page.locator('.play-field');
    const box = await field.boundingBox();
    assert.ok(box.width <= device.viewport.width + 1 && box.height <= device.viewport.height + 1, 'the field fits the screen');
    // kick off by tapping the visitor (right side), then keep it up on time
    await page.mouse.click(box.x + box.width * 0.66, box.y + box.height * 0.55);
    let kicks = 0;
    for (let i = 0; i < 3; i += 1) {
      await page.waitForFunction(() => { const n = document.querySelector('.playground')?.dataset.next; return n && Number(n) < 40; }, null, { timeout: 4000 });
      // tap the buddy the arrow is over
      const want = await page.locator('.playground').getAttribute('data-want');
      assert.ok(['kid', 'vis'].includes(want), 'the game shows whose turn it is');
      const wx = Number(await page.locator('.playground').getAttribute('data-wantx'));
      await page.mouse.click(box.x + box.width * wx, box.y + box.height * 0.55);
      kicks += 1;
      if (i === 1 && shots) await page.screenshot({ path: `${shots}/play-soccer-${name}.png` });
    }
    // stop tapping: the ball drops and the game ends with a new best
    await page.waitForFunction(() => document.querySelector('.playground')?.dataset.phase === 'over', null, { timeout: 5000 });
    const score = Number(await page.locator('.playground').getAttribute('data-score'));
    assert.ok(score >= 2, `kept it up (${score} of ${kicks})`);
    await page.waitForTimeout(1500);
    if (shots) await page.screenshot({ path: `${shots}/play-soccer-over-${name}.png` });
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache') || localStorage.getItem('kidquest.v1')));
    assert.equal(saved.kids[0].playBest?.soccer, score, 'the best score is kept on the kid');
    await page.click('.play-close');
    assert.equal(await page.locator('.playground').count(), 0, 'Done closes the game');

    // tag with Max's bear (no ball)
    await visit(page, 'kid_max');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Tag with Max/);
    await page.mouse.click(box.x + box.width * 0.66, box.y + box.height * 0.5);
    await page.waitForTimeout(400);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play');
    await page.mouse.click(box.x + box.width * 0.1, box.y + box.height * 0.85);
    await page.waitForTimeout(1600);
    if (shots) await page.screenshot({ path: `${shots}/play-tag-${name}.png` });
    await page.click('.play-close');

    // hockey with Lu's panda (a hockey stick)
    await visit(page, 'kid_lu', 'hockey');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Hockey with Lu/);
    assert.match(await page.locator('.play-left').innerText(), /2 games left today/);
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.5);
    await page.waitForTimeout(1800);
    assert.equal(await page.locator('.playground').getAttribute('data-phase'), 'play');
    // skate toward the puck, hold the button and let go
    await page.mouse.click(box.x + box.width * 0.5, box.y + box.height * 0.6);
    await page.waitForTimeout(800);
    await page.mouse.move(box.x + box.width - 15 * box.width / await field.evaluate((c) => c.width), box.y + box.height - 15 * box.height / await field.evaluate((c) => c.height));
    await page.mouse.down(); await page.waitForTimeout(300); await page.mouse.up();
    if (shots) await page.screenshot({ path: `${shots}/play-hockey-${name}.png` });
    await page.click('.play-close');
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud.cache')));
    assert.equal(after.kids[0].playLog.n, 3 + freeGamesOn(TEST_DAY), 'each game started counts toward the day');

    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // holding a hockey stick: a rink waits on the village green, tapping it plays hockey,
  // and every visitor offers hockey first
  {
    const { page, ctx, errors } = await open({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1, hasTouch: true }, true, 0, 'sport-hockey-regular');
    assert.ok(await page.locator('.village .v-area-hockey.tap[data-pick="hockey"]').count(), 'a rink for the kid');
    if (shots) await page.screenshot({ path: `${shots}/play-host-field.png` });
    await visit(page, 'kid_max');
    await page.waitForSelector('.game-pick');
    assert.deepEqual(await page.locator('.game-pick .btn').allInnerTexts(), ['Hockey\nWith your stick', 'Tag\nNo gear needed']);
    await page.click('#modal [data-action="modal-close"]');
    // the rink takes taps (the buddy walks over to it, then the game starts)
    assert.equal(await page.locator('.village .v-area-hockey.tap').evaluate((el) => getComputedStyle(el).pointerEvents), 'auto', 'the rink is tappable');
    await tapInVillage(page, '.v-area-hockey.tap');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /^Hockey with /);
    await page.click('.play-close');
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  // a parent tries the games from Settings: any gear, no limit, no records
  {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, hasTouch: true });
    const page = await ctx.newPage();
    await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const s = emptyState();
    s.settings.pinHash = fallbackHash('kidquest:1234');
    s.settings.sound = false;
    s.settings.questView = 'map'; // chose the old map once: the village opens all the same
    s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: TEST_DAY, buddy: { species: 'fox', outfit: {} } });
    s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: TEST_DAY, buddy: { species: 'cat', outfit: {} }, playLog: { day: TEST_DAY, n: 99 } });
    await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), seenSaturday(s));
    await page.reload();
    await openParents(page);
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.click('[data-action="tab"][data-tab="settings"]');
if (await page.locator('[data-action="test-tools"][aria-expanded="false"]').count()) await page.click('[data-action="test-tools"]'); // open Settings › Test tools
    await page.selectOption('#gt-kid', 'kid_ava');
    await page.selectOption('#gt-vis', 'kid_sam');
    await page.selectOption('#gt-vis-gear', '3');
    for (const [kind, title] of [['hockey', /^Hockey with Sam/], ['tag', /^Tag with Sam/], ['soccer', /^Keepy-uppy with Sam/], ['fishing', /^Fishing with Sam/]]) {
      await page.click(`[data-action="game-test"][data-kind="${kind}"]`);
      await page.waitForSelector('.playground');
      assert.match(await page.locator('.play-top').innerText(), title);
      assert.equal(await page.locator('.play-left').innerText(), '', 'no daily limit here');
      await page.click('.play-close');
    }
    const after = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
    assert.equal(after.kids[1].playLog.n, 99, 'test games are not counted');
    assert.equal(after.kids[1].playBest, undefined);
    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('play test passed');
} finally {
  await browser.close();
  site.close();
}
