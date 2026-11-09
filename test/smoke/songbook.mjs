// The sheet music stand's songbook (js/songbook.js) in the real app: the little keyboard opens
// the 6 easiest songs; every open song is engraved bar for bar (abcjs) with no warnings, in
// every hand setting; Listen plays it with the bar being played lit up; phones get 2 bars a
// line. Saves screenshots too. Run: node test/smoke/songbook.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { SONGBOOK, songById } from '../../js/sheetmusic.js';

const out = (process.argv[2] || 'previews/songbook').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/** Ava with weeks of every chore (piano too) done before today: 3 weeks earns the little keyboard. */
function family(weeks) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  const days = weeks * 7;
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function openSongbook(viewport, weeks) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [family(weeks), { kid_ava: { day, inside: false, place: 'music' } }]);
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

// 1. tablet, the little keyboard: 6 songs open, easiest first; every one engraves cleanly
{
  const { ctx, page } = await openSongbook({ width: 1280, height: 800 }, 3);
  const open = await page.$$eval('.song-card:not(.locked)', (els) => els.map((e) => e.dataset.id));
  assert.deepEqual(open, SONGBOOK.filter((p) => p.tier === 1).map((p) => p.id), 'the easiest six');
  assert.equal(await page.locator('.song-card.locked').count(), 12);
  assert.match(await page.locator('.song-card.locked').first().textContent(), /Opens with the upright piano/);
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
    }
    await page.click('[data-action="song-back"]');
  }
  // one piece up close: both hands, note names, and Listen lights up the bar being played
  await page.click(`[data-action="song-open"][data-id="${open[2]}"]`);
  await page.click('[data-action="song-hands"][data-val="chords"]');
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.ok(await page.locator('#sheet .abcjs-lyric').count() > 10, 'note names under the notes');
  assert.ok(await page.locator('#sheet .abcjs-chord').count() >= songById(open[2]).lead.length, 'a chord name on every bar');
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

// 2. phone, the rock star piano: every song open, two bars a line
{
  const { ctx, page } = await openSongbook({ width: 412, height: 915 }, 7);
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
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`songbook ok: ${out}`);
