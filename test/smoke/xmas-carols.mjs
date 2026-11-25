// The December carols in the real app (js/carols.js, songbook.js, timer-ui.js): on a December
// day the songbook has a "Christmas carols" section first, all seven free (no price); opening
// one keeps it (kid.owned, saved); each engraves at Easy, Medium and Hard with the carol's
// title, subtitle, composer and "Tailleur Claude & Son (arr.)" on the sheet and no abcjs
// warnings, with a Print link to its PDF; Listen lights the bars and the buddy and the day's
// visitors dance to it. In January only the kept carol is there; in November none. The piano
// timer that listens shows the day's visitors beside the buddy in December only. Saves
// screenshots. Run: node test/smoke/xmas-carols.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { CAROLBOOK, songById, songItemId } from '../../js/sheetmusic.js';
import { CAROLS } from '../../js/carols.js';
import { pickVisitors } from '../../js/visits.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'test/.tmp/xmas-carols').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });

/**
 * Ava (three weeks of chores done: the little keyboard) and her two brothers, who visit; songs:
 * the carols she has kept already. Her piano chore listens.
 */
function family(day, songs = []) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  const days = 21;
  const kid = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species, outfit: { background: 'bg-meadow' } }, ...extra });
  const ava = kid('kid_ava', 'Ava', '#ff6b6b', 'fox', { owned: songs.map(songItemId) });
  ava.tasks.find((t) => /piano/i.test(t.name)).listen = true;
  s.kids.push(ava, kid('kid_ben', 'Ben', '#4dabf7', 'bear'), kid('kid_cal', 'Cal', '#51cf66', 'cat'));
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}
const visitorsOn = (day, s) => pickVisitors('kid_ava', s.kids.map((k) => ({ id: k.id, buddy: k.buddy })), day);

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function openPage(viewport, day, songs) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  const s = family(day, songs);
  await page.evaluate(([st, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [s, { kid_ava: { day, inside: false, place: 'music' } }]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  return { ctx, page, s };
}

/** Close the start-of-day pop-ups (in December: Santa's letter, the advent door...). */
async function closeModals(page) {
  for (let i = 0; i < 8 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click({ force: true }); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
  if (await page.locator('#modal:not([hidden])').count()) {
    await page.evaluate(async () => { (await import('./js/ctx.js')).closeModal(); });
  }
}

/** From the kid's page: straight to the songbook (the music house's sheet music stand). */
async function toSongbook(page) {
  await closeModals(page);
  await page.evaluate(async () => {
    const c = await import('./js/ctx.js');
    c.ui.kidId = 'kid_ava';
    c.ui.view = 'songbook';
    c.ui.songId = null;
    c.render();
  });
  await page.waitForSelector('.songbook');
}

/** Wait (real time: the sound's clock) until the piece being played lights up bar n or later. */
async function litBar(page, n, ms = 8000) {
  for (let waited = 0; waited < ms; waited += 50) {
    await page.clock.runFor(50);
    await page.waitForTimeout(50);
    const lit = await page.evaluate(() => {
      const el = document.querySelector('#sheet .now');
      const m = el && [...el.classList].find((c) => /^abcjs-mm\d+$/.test(c));
      return m ? Number(m.slice(8)) : -1;
    });
    if (lit >= n) return lit;
  }
  return -1;
}

const IDS = CAROLBOOK.map((p) => p.id);
const sheetText = (page) => page.$$eval('#sheet svg text', (els) => els.map((e) => e.textContent).join(' | '));

// 1. December, tablet: seven free carols first; each engraves at every level with its header
{
  const day = '2026-12-05';
  const { ctx, page, s } = await openPage({ width: 1280, height: 800 }, day, []);
  await toSongbook(page);
  const tiers = await page.locator('.song-tier h3').allTextContents();
  assert.equal(tiers[0], '🎄 Christmas carols', 'the carols come first in December');
  assert.match(await page.locator('.song-tier').first().textContent(), /Free in December/);
  const carols = await page.$$eval('section.song-tier:first-of-type [data-action="song-open"]', (els) => els.map((e) => e.dataset.id));
  assert.deepEqual(carols, IDS, 'all seven, open, easiest first');
  assert.equal(await page.locator('section.song-tier:first-of-type .song-price').count(), 0, 'no price: free');
  await page.screenshot({ path: `${out}/1-december-songbook.png`, fullPage: true });
  const coins = await page.locator('.songbook .chip.coin').textContent();
  for (const id of IDS) {
    await page.click(`[data-action="song-open"][data-id="${id}"]`);
    await page.waitForSelector(`#sheet.engraved[data-id="${id}"] svg`);
    const c = CAROLS[id];
    for (const level of ['easy', 'medium', 'hard']) {
      if (level !== 'easy') await page.click(`[data-action="song-level"][data-val="${level}"]`);
      await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
      const bars = songById(id).lead.length;
      assert.ok(await page.locator(`#sheet .abcjs-mm${bars - 1}`).count() > 0, `${id} ${level}: every bar`);
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars}`).count(), 0, `${id} ${level}: no extra bar`);
      assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${id} ${level}: no abcjs warnings`);
      const text = await sheetText(page);
      for (const want of [c.title, c.subtitle, c.composer, 'Tailleur Claude & Son (arr.)'].filter(Boolean)) assert.ok(text.includes(want), `${id} ${level}: "${want}" on the sheet`);
      assert.match(await page.locator('.song-print').getAttribute('href'), new RegExp(`^sheets/[a-z-]+-${level}-[0-9a-f]{6}\\.pdf$`));
    }
    await page.click('[data-action="song-level"][data-val="easy"]');
    await page.click('[data-action="song-back"]');
  }
  assert.equal(await page.locator('.songbook .chip.coin').textContent(), coins, 'no coins spent');
  // opened in December: all kept, with the kid (saved)
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids.find((k) => k.id === 'kid_ava'));
  assert.deepEqual(IDS.map(songItemId).filter((x) => saved.owned.includes(x)), IDS.map(songItemId), 'every carol opened is kept');
  assert.equal(saved.spent, 0);

  // Carol of the Bells up close: the PDF is served, Listen lights the bars and everyone dances
  const visitors = visitorsOn(day, s);
  assert.ok(visitors.length >= 1);
  await page.click('[data-action="song-open"][data-id="xmas-bells"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.locator('.carol-dance .carol-dancer').count(), 1 + visitors.length, 'the buddy and today\'s visitors');
  assert.match(await page.locator('.kid-title small').textContent(), /A minor · speed 144 · A Christmas carol/);
  const pdf = await page.request.get(new URL(await page.locator('.song-print').getAttribute('href'), page.url()).href);
  assert.ok(pdf.ok() && (await pdf.body()).subarray(0, 5).toString() === '%PDF-', 'the PDF is served');
  await page.screenshot({ path: `${out}/2-carol-tablet.png` });
  await page.click('[data-action="song-play"]');
  assert.ok(await litBar(page, 1) >= 1, 'Listen lights the bars');
  const dancing = await page.$$eval('.carol-dance .carol-dancer', (els) => els.map((e) => e.classList.contains('dance-l') || e.classList.contains('dance-r')));
  assert.deepEqual(dancing, dancing.map(() => true), 'everyone dances');
  await page.screenshot({ path: `${out}/3-carol-dancing.png` });
  // medium plays the piano version at the printed speed, and they dance to that too
  await page.click('[data-action="song-level"][data-val="medium"]');
  assert.equal(await page.locator('.carol-dancer.dance-l, .carol-dancer.dance-r').count(), 0, 'stopped: they stand still');
  await page.waitForSelector('#sheet.engraved[data-level="medium"] svg');
  await page.click('[data-action="song-play"]');
  assert.ok(await litBar(page, 1) >= 1);
  assert.ok(await page.locator('.carol-dancer.dance-l, .carol-dancer.dance-r').count() > 0);
  await page.click('[data-action="song-play"]');
  await page.click('[data-action="song-level"][data-val="easy"]');
  await page.click('[data-action="song-back"]');

  // the piano timer that listens: the day's visitors stand beside the buddy
  await page.evaluate(async () => {
    const c = await import('./js/ctx.js');
    const kid = c.kidById('kid_ava');
    c.ui.view = 'timer';
    c.ui.taskId = kid.tasks.find((t) => t.listen).id;
    c.render();
  });
  await page.waitForSelector('.screen.timer');
  assert.equal(await page.locator('.timer .timer-visitors .carol-dancer').count(), visitors.length, 'the visitors are at the piano');
  assert.equal(await page.locator('.timer .timer-buddy').count(), 1);
  await page.screenshot({ path: `${out}/4-timer-visitors.png` });
  await ctx.close();
}

// 2. December, phone: the list and a carol fit, two bars a line
{
  const { ctx, page } = await openPage({ width: 390, height: 844 }, '2026-12-24', []);
  await toSongbook(page);
  await page.screenshot({ path: `${out}/5-phone-songbook.png` });
  await page.click('[data-action="song-open"][data-id="xmas-silent"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.getAttribute('#sheet', 'data-per'), '2');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  assert.ok(wide, 'no sideways scrolling');
  await page.screenshot({ path: `${out}/6-phone-carol.png` });
  await page.evaluate(async () => {
    const c = await import('./js/ctx.js');
    c.ui.view = 'timer';
    c.ui.taskId = c.kidById('kid_ava').tasks.find((t) => t.listen).id;
    c.render();
  });
  await page.waitForSelector('.screen.timer');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), 'the timer with visitors fits a phone');
  await page.screenshot({ path: `${out}/7-phone-timer.png` });
  await ctx.close();
}

// 3. January: only the carol she kept; November: none (and no visitors at the timer)
{
  const { ctx, page } = await openPage({ width: 1280, height: 800 }, '2027-01-06', ['xmas-tree']);
  await toSongbook(page);
  assert.equal(await page.locator('.song-tier h3').first().textContent(), '🎄 Christmas carols');
  assert.deepEqual(await page.$$eval('section.song-tier:first-of-type .song-card', (els) => els.map((e) => e.dataset.id)), ['xmas-tree'], 'the kept carol only');
  assert.doesNotMatch(await page.locator('.song-tier').first().textContent(), /Free in December/);
  await page.click('[data-action="song-open"][data-id="xmas-tree"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.locator('.carol-dance .carol-dancer').count(), 1, 'the buddy dances; the visitors only in December');
  // a carol not kept can't be opened by a stale id
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.songId = 'xmas-jingle'; c.render(); });
  assert.equal(await page.locator('#sheet').count(), 0, 'not kept: the list');
  await page.screenshot({ path: `${out}/8-january.png`, fullPage: true });
  await ctx.close();
}
{
  const { ctx, page } = await openPage({ width: 1280, height: 800 }, '2026-11-30', []);
  await toSongbook(page);
  assert.ok(!(await page.locator('.song-tier h3').allTextContents()).some((t) => /carol/i.test(t)), 'no carols in November');
  await page.evaluate(async () => {
    const c = await import('./js/ctx.js');
    c.ui.view = 'timer';
    c.ui.taskId = c.kidById('kid_ava').tasks.find((t) => t.listen).id;
    c.render();
  });
  await page.waitForSelector('.screen.timer');
  assert.equal(await page.locator('.timer-visitors').count(), 0, 'no visitors at the timer in November');
  await ctx.close();
}

await browser.close();
await site.close();
assert.deepEqual(errors, [], `page errors:\n${errors.join('\n')}`);
console.log(`xmas-carols smoke: ok (screenshots in ${out})`);
