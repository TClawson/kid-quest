// Browser test: once the quest is done, tapping a visiting buddy opens a game.
// A visitor with a soccer ball plays keepy-uppy, one without plays tag, and a
// new best score is kept on the kid.
// Run: node test/smoke/play.mjs
import assert from 'node:assert/strict';
import { chromium, devices } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';

const site = await serve('.');
const browser = await chromium.launch();
const shots = process.env.SHOTS;

// which family buddies visit is random per day: point the first visitor at the one we want
async function visit(page, id) {
  await page.evaluate((v) => { if (!document.querySelector(`.map-visitor[data-id="${v}"]`)) document.querySelector('.map-visitor').dataset.id = v; }, id);
  await page.click(`.map-visitor[data-id="${id}"]`);
}

async function open(device, done, played = 0) {
  const ctx = await browser.newContext(device);
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.url);
  const s = emptyState();
  s.settings.pinHash = 'sha256:test';
  s.settings.sound = false;
  const tasks = defaultTasks();
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: dateKey(), owned: ['sport-shoes-regular'], buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } } });
  if (played) s.kids[0].playLog = { day: dateKey(), n: played };
  if (done) s.log[dateKey()] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
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
  await page.click('[data-action="open-kid"]');
  await page.waitForTimeout(500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
  await page.waitForSelector('.map-visitor');
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
    assert.match(await page.locator('.map-visitor[data-id="kid_ava"] .visitor-bubble').innerText(), /Finish your quest and let's play! \d+ to go/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // out of games for today: the visitors say so, and no game opens
  {
    const { page, ctx, errors } = await open(devices['Galaxy Tab S4'], true, 8);
    await visit(page, 'kid_max');
    await page.waitForTimeout(300);
    assert.equal(await page.locator('.playground').count(), 0, 'no game after 8 today');
    assert.match(await page.locator('.map-visitor[data-id="kid_max"] .visitor-bubble').innerText(), /That's all our games today/);
    assert.deepEqual(errors, []);
    await ctx.close();
  }

  for (const [name, device] of [['tablet', { viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2, hasTouch: true }], ['phone', devices['Pixel 7']]]) {
    const { page, ctx, errors } = await open(device, true);

    // soccer with Ava's cat
    await visit(page, 'kid_ava');
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
      await page.mouse.click(box.x + box.width * (i % 2 ? 0.34 : 0.66), box.y + box.height * 0.55);
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
    await visit(page, 'kid_lu');
    await page.waitForSelector('.playground');
    assert.match(await page.locator('.play-top').innerText(), /Hockey with Lu/);
    assert.match(await page.locator('.play-left').innerText(), /6 games left today/);
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
    assert.equal(after.kids[0].playLog.n, 3, 'each game started counts toward the day');

    assert.deepEqual(errors, []);
    await ctx.close();
  }
  console.log('play test passed');
} finally {
  await browser.close();
  site.close();
}
