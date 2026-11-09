// The sheet music stand's songbook (js/songbook.js) in the real app: the little keyboard opens
// the easiest songs (a secret show's tune only once its treasure map is finished, its name
// hidden till then); every open song is engraved bar for bar (abcjs) with no warnings, in
// every hand setting; Listen plays it with the bar being played lit up, and a redraw while it
// plays leaves the page and its scroll alone; phones get 2 bars a line. Saves screenshots too. Run: node test/smoke/songbook.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { SONGBOOK, songById, songbookFor } from '../../js/sheetmusic.js';
import { SHOW_SONGS } from '../../js/songs.js';

const out = (process.argv[2] || 'previews/songbook').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/**
 * Ava with weeks of every chore (piano too) done before today (3 weeks earns the little
 * keyboard), and the treasure maps (background ids) she has finished.
 */
function family(weeks, found = []) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  const days = weeks * 7;
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  // four map pieces from the daily chest finish a treasure map
  found.flatMap((map) => [map, map, map, map]).forEach((map, i) => { s.log[addDays(day, -1 - i)].kid_ava.chest = { kind: 'piece', map }; });
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function openSongbook(viewport, weeks, found) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [family(weeks, found), { kid_ava: { day, inside: false, place: 'music' } }]);
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
  await page.evaluate(() => document.querySelector('.music-house .v-dialog [data-m="bye"]')?.click());
  await page.evaluate(() => document.querySelector('.m-station[data-spot="sheets"]').click());
  await page.clock.runFor(6000);
  await page.waitForSelector('.songbook');
  return { ctx, page };
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

// 1. tablet, the little keyboard and the Golden galaxy's treasure: the easiest map songs and
// that show's tune are open; every one engraves cleanly
{
  const { ctx, page } = await openSongbook({ width: 1280, height: 800 }, 3, ['bg-galaxy']);
  const open = await page.$$eval('.song-card:not(.locked)', (els) => els.map((e) => e.dataset.id));
  const want = songbookFor(1, new Set(['bg-galaxy'])).filter((p) => p.open).map((p) => p.id);
  assert.deepEqual(open, want, 'the easiest map songs, and the found show');
  assert.equal(open.length, 4);
  assert.ok(open.includes('show:bg-galaxy') && open.includes('bg-meadow'));
  assert.equal(await page.locator('.song-card.locked').count(), 14);
  assert.match(await page.locator('.song-tier.locked .song-card.locked').first().textContent(), /Opens with the upright piano/);
  // the other shows' tunes are secret: no names, and what opens them
  const list = await page.locator('.songbook').textContent();
  assert.equal((list.match(/Secret song/g) || []).length, 8);
  for (const [map, song] of Object.entries(SHOW_SONGS)) if (map !== 'bg-galaxy') assert.ok(!list.includes(song.name), `${song.name} stays secret`);
  assert.match(list, /Finish the \w[\w ]* treasure map/);
  await page.screenshot({ path: `${out}/1-songbook-tablet.png`, fullPage: true });
  for (const id of open) {
    await page.click(`[data-action="song-open"][data-id="${id}"]`);
    for (const hands of ['melody', 'roots', 'chords']) {
      await page.click(`[data-action="song-hands"][data-val="${hands}"]`);
      await page.waitForSelector('#sheet.engraved svg');
      const bars = songById(id).lead.length;
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars - 1}`).count() > 0, true, `${id} ${hands}: every bar is there`);
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars}`).count(), 0, `${id}: no extra bars`);
      assert.equal(await page.locator('#sheet .abcjs-staff').count() > 0, true);
      assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${id} ${hands}: abcjs had no warnings`);
    }
    await page.click('[data-action="song-back"]');
  }
  // a secret piece can't be opened by a stale id either
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.songId = 'show:bg-ocean'; c.render(); });
  assert.equal(await page.locator('#sheet').count(), 0, 'a secret song shows the list');
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.songId = null; c.render(); });
  // one piece up close: both hands, note names, and Listen lights up the bar being played
  const close = 'bg-space';
  await page.click(`[data-action="song-open"][data-id="${close}"]`);
  await page.click('[data-action="song-hands"][data-val="chords"]');
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.ok(await page.locator('#sheet .abcjs-lyric').count() > 10, 'note names under the notes');
  assert.ok(await page.locator('#sheet .abcjs-chord').count() >= songById(close).lead.length, 'a chord name on every bar');
  await page.screenshot({ path: `${out}/2-piece-tablet.png`, fullPage: true });
  await page.click('[data-action="song-play"]');
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Stop/);
  const first = await litBar(page, 0);
  assert.equal(first, 0, 'the first bar lights up');
  const later = await litBar(page, 1);
  assert.ok(later >= 1, `and then the next (${later})`);
  await page.screenshot({ path: `${out}/3-listening.png`, fullPage: true });
  await page.click('[data-action="song-play"]');
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Listen/);
  assert.equal(await page.locator('#sheet .now').count(), 0, 'stopped: nothing lit');
  // the settings stay on this device
  const prefs = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.songbook')));
  assert.deepEqual(prefs, { hands: 'chords', names: true, slow: false });
  await page.click('[data-action="song-back"]');
  await page.click('[data-action="songbook-back"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.music-house').count(), 1, 'back in the music house');
  await ctx.close();
}

// 2. phone, the rock star piano and every treasure map: every song open, two bars a line; a
// redraw while a piece plays (family sync does that) leaves the music and the scroll alone
{
  const { ctx, page } = await openSongbook({ width: 412, height: 915 }, 7, Object.keys(SHOW_SONGS));
  assert.equal(await page.locator('.song-card:not(.locked)').count(), 18);
  await page.screenshot({ path: `${out}/4-songbook-phone.png`, fullPage: true });
  const id = 'bg-meadow';
  await page.click(`[data-action="song-open"][data-id="${id}"]`);
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.getAttribute('#sheet', 'data-per'), '2');
  assert.equal(await page.locator('#sheet .abcjs-l7').count() > 0, true, '16 bars on 8 lines');
  const wide = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  assert.ok(wide, 'no sideways scrolling');
  await page.screenshot({ path: `${out}/5-piece-phone.png`, fullPage: true });

  await page.click('[data-action="song-play"]');
  assert.ok(await litBar(page, 0) >= 0);
  await page.evaluate(() => { window.scrollTo(0, 700); document.querySelector('#sheet svg').dataset.mark = 'kept'; });
  await page.clock.runFor(100);
  const y = await page.evaluate(() => window.scrollY);
  assert.ok(y > 500, `scrolled down (${y})`);
  await page.evaluate(async () => (await import('./js/ctx.js')).render());
  assert.equal(await page.locator('#sheet svg[data-mark="kept"]').count(), 1, 'the same drawing: nothing redrawn');
  assert.equal(await page.evaluate(() => window.scrollY), y, 'still scrolled down');
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Stop/);
  // Stop stays on screen while the music scrolls by
  const stop = await page.locator('[data-action="song-play"]').boundingBox();
  assert.ok(stop.y >= 0 && stop.y + stop.height <= 915, `Stop in reach (${stop.y})`);
  // turning on note names redraws the music, but keeps the place
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved .abcjs-lyric');
  const y2 = await page.evaluate(() => window.scrollY);
  assert.ok(Math.abs(y2 - y) < 200, `the place is kept (${y} → ${y2})`);
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Stop/, 'and it keeps playing');
  await page.screenshot({ path: `${out}/6-listening-phone.png` });
  await page.click('[data-action="song-play"]');
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`songbook ok: ${out}`);
