// The composing desk (js/composedesk.js) in the real app. The desk station in the music house is
// closed until today's chores are done, and opens after. The desk walks through four steps: key
// and timing (4/4, 3/4, 6/8), chords, tune and song. Help levels open with the pianos (one piano:
// only lots of help). Lots of help writes a tune; switching timing keeps it; Keep puts the song on
// the shelf, which a reload keeps, along with the draft on the desk. Settings has a test desk with
// every help level open. A phone fits it all. Saves screenshots of each look's desk and each step.
// Run: node test/smoke/compose.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, openParents } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'previews/composing-desk').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = TEST_DAY;
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const KID = 'kid_ava';

/** Ava with `weeks` weeks of every chore (2: the first piano, 6: the rock star piano); `done`: today's too. */
function family({ done = false, weeks = 3 } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  s.settings.music = false;
  const ava = { id: KID, name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -7 * weeks), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= 7 * weeks; i += 1) s.log[addDays(day, -i)] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  if (done) s.log[day] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function start(viewport, st) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  await useTestDay(page);
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { [KID]: { day, inside: false, place: 'music' } }]);
  await page.reload();
  return { ctx, page };
}
async function intoHouse(page) {
  await openKid(page, `[data-action="open-kid"][data-id="${KID}"]`);
  await page.waitForSelector('.music-house');
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i += 1) {
    if (await page.locator('#modal:not([hidden])').count()) {
      const close = page.locator('#modal [data-action="modal-close"]');
      if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      continue;
    }
    if (await page.locator('.music-house .v-dialog:not([hidden]) [data-m="bye"]').count()) {
      await page.evaluate(() => document.querySelector('.music-house .v-dialog:not([hidden]) [data-m="bye"]').click());
      await page.waitForTimeout(300);
      continue;
    }
    break;
  }
}
const tap = (page, sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
const desk = (page) => page.evaluate(async () => (await import('./js/composedesk.js')).composeState());

// ---------- closed before chores, open after; one piano opens only lots of help ----------
{
  const { ctx, page } = await start(TABLET, family({ weeks: 3 }));
  await intoHouse(page);
  await page.screenshot({ path: `${out}/1-house-tier1.png` });
  await tap(page, '.m-station[data-spot="desk"]');
  await page.waitForSelector('.music-house .v-dialog:not([hidden])', { timeout: 20000 });
  assert.match(await page.locator('.music-house .v-dialog').innerText(), /once today's chores are done/);
  await ctx.close();
}
{
  const { ctx, page } = await start(TABLET, family({ weeks: 3, done: true }));
  await intoHouse(page);
  await tap(page, '.m-station[data-spot="desk"]');
  await page.waitForSelector('#compose .cd-sheet', { timeout: 20000 });
  let s = await desk(page);
  assert.equal(s.most, 0, 'the first piano opens only lots of help');
  assert.equal(s.song.help, 0);
  assert.ok(s.song.tune.some(Number.isInteger), 'lots of help starts with a tune');
  assert.equal(await page.locator('.cd-help .locked').count(), 2);
  await page.screenshot({ path: `${out}/2-step1-key.png`, fullPage: true });
  // minor, then 6/8: the tune moves along
  await tap(page, '[data-c="mode"][data-v="minor"]');
  await tap(page, '[data-c="meter"][data-v="6/8"]');
  s = await desk(page);
  assert.equal(s.song.key.mode, 'minor');
  assert.equal(s.song.meter, '6/8');
  assert.equal(s.song.tune.length, 48);
  await tap(page, '[data-c="step"][data-v="1"]');
  await page.waitForSelector('.cd-paths');
  await tap(page, '[data-c="path"][data-v="1"]');
  await page.screenshot({ path: `${out}/3-step2-chords.png`, fullPage: true });
  await tap(page, '[data-c="step"][data-v="2"]');
  await page.waitForSelector('.cd-roll');
  await tap(page, '[data-c="make"]');
  s = await desk(page);
  assert.ok(s.song.tune.some(Number.isInteger));
  assert.equal(await page.locator('.cd-cell.lean').count(), 0, 'the made tune has no rubs');
  await page.screenshot({ path: `${out}/4-step3-tune.png`, fullPage: true });
  await tap(page, '[data-c="step"][data-v="3"]');
  await page.waitForSelector('.cd-strip');
  await page.fill('#cd-name', 'Sea Song');
  await tap(page, '[data-c="play"][data-v="song"]');
  await page.waitForTimeout(600);
  assert.ok((await desk(page)).playing);
  await tap(page, '[data-c="keep"]');
  await page.waitForSelector('.cd-kept');
  s = await desk(page);
  assert.equal(s.shelf[0], 'Sea Song');
  await page.screenshot({ path: `${out}/5-step4-song.png`, fullPage: true });
  // a reload keeps the shelf and the draft
  await page.reload();
  await intoHouse(page);
  await tap(page, '.m-station[data-spot="desk"]');
  await page.waitForSelector('#compose .cd-sheet', { timeout: 20000 });
  s = await desk(page);
  assert.equal(s.shelf[0], 'Sea Song');
  assert.equal(s.song.meter, '6/8');
  assert.equal(s.slot, 0);
  await ctx.close();
}

// ---------- the other looks, and little help on the rock star piano ----------
for (const [weeks, tier] of [[5, 2], [7, 3]]) {
  const { ctx, page } = await start(TABLET, family({ weeks, done: true }));
  await intoHouse(page);
  await page.screenshot({ path: `${out}/1-house-tier${tier}.png` });
  if (tier === 3) {
    await tap(page, '.m-station[data-spot="desk"]');
    await page.waitForSelector('#compose .cd-sheet', { timeout: 20000 });
    assert.equal((await desk(page)).most, 2);
    await tap(page, '[data-c="help"][data-v="2"]');
    await tap(page, '[data-c="step"][data-v="2"]');
    await page.waitForSelector('.cd-roll');
    await page.screenshot({ path: `${out}/6-little-help-tune.png`, fullPage: true });
  }
  await ctx.close();
}

// ---------- the test desk in Settings, and a phone ----------
{
  const { ctx, page } = await start(TABLET, family({ weeks: 3 }));
  await intoHouse(page);
  await openParents(page);
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.waitForSelector('.pnav');
  await page.click('[data-action="tab"][data-tab="settings"]');
  if (await page.locator('[data-action="test-tools"][aria-expanded="false"]').count()) await page.click('[data-action="test-tools"]');
  await page.waitForSelector('[data-action="compose-test"]', { timeout: 10000 });
  await tap(page, '[data-action="compose-test"]');
  await page.waitForSelector('#compose .cd-sheet', { timeout: 20000 });
  assert.equal((await desk(page)).most, 2);
  await page.setViewportSize(PHONE);
  for (const step of [0, 1, 2, 3]) {
    await tap(page, `[data-c="step"][data-v="${step}"]`);
    await page.waitForTimeout(200);
    const wide = await page.evaluate(() => document.documentElement.scrollWidth);
    assert.ok(wide <= 362, `step ${step + 1} fits a phone (${wide})`);
    await page.screenshot({ path: `${out}/7-phone-step${step + 1}.png`, fullPage: true });
  }
  await ctx.close();
}

await browser.close();
await site.close();
assert.deepEqual(errors, []);
console.log('compose: ok');
