// The sheet music stand's songbook (js/songbook.js) in the real app: the little keyboard opens
// every map song (a secret show's tune only with the upright piano or once its treasure map
// is finished, its name hidden till then); an open song is bought with 20 coins before its music
// shows (once for every level, it stays bought after a reload, too few coins says how many more);
// every bought song is engraved bar for bar (abcjs) with no warnings, in every hand setting; Listen plays it with the bar being played lit up, and a redraw while it
// plays leaves the page and its scroll alone; phones get 2 bars a line. The upright piano opens
// the concert pieces (concert.js): bought the same way, engraved as one score part by part with
// no warnings at every level written, and Listen lights their bars too. Saves screenshots too. Run: node test/smoke/songbook.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { SONGBOOK, songById, songbookFor, songItemId } from '../../js/sheetmusic.js';
import { SHOW_SONGS } from '../../js/songs.js';
import { hasLevel } from '../../js/arrange.js';
import { CONCERT, longLevels, longLevel, longBars, longSections, longFacts } from '../../js/concert.js';

const out = (process.argv[2] || 'previews/songbook').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/**
 * Ava with weeks of every chore (piano too) done before today (3 weeks earns the little
 * keyboard, and 1320 coins), the treasure maps (background ids) she has finished, the songs
 * she has already bought (piece ids) and the coins she has already spent.
 */
function family(weeks, found = [], { songs = [], spent = 0 } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  const days = weeks * 7;
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: songs.map(songItemId), spent, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  // four map pieces from the daily chest finish a treasure map
  found.flatMap((map) => [map, map, map, map]).forEach((map, i) => { s.log[addDays(day, -1 - i)].kid_ava.chest = { kind: 'piece', map }; });
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function openSongbook(viewport, weeks, found, opts) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [family(weeks, found, opts), { kid_ava: { day, inside: false, place: 'music' } }]);
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

const ALL = SONGBOOK.map((p) => p.id);
const coinChip = async (page) => Number((await page.locator('.songbook .chip.coin').textContent()).replace(/\D/g, ''));

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

// 1. tablet, the little keyboard and two treasure maps: all nine map songs and those two
// shows' tunes are open; every one engraves cleanly
{
  const found = ['bg-meadow', 'bg-galaxy'];
  const { ctx, page } = await openSongbook({ width: 1280, height: 800 }, 3, found);
  const open = await page.$$eval('.song-card:not(.locked)', (els) => els.map((e) => e.dataset.id));
  const want = songbookFor(1, new Set(found)).filter((p) => p.open).map((p) => p.id);
  assert.deepEqual(open, want, 'the map songs, and the found shows');
  assert.equal(open.length, 11);
  assert.ok(open.includes('show:bg-galaxy') && open.includes('show:bg-meadow') && open.includes('bg-meadow'));
  assert.equal(await page.locator('.song-card.locked').count(), 7 + CONCERT.length, 'the other shows, and the concert pieces');
  assert.equal(await page.locator('.song-tier').count(), 3, 'three sections: map songs, show tunes and concert pieces');
  assert.match(await page.locator('.song-tier').nth(2).textContent(), /🎹 Concert pieces/);
  for (const p of CONCERT) assert.match(await page.locator('.song-tier').nth(2).textContent(), new RegExp(`${p.name}.*Opens with the upright piano`), 'its name shows, and the piano that opens it');
  // nothing bought yet: every open song shows its price, none opens
  assert.equal(await page.locator('.song-card.buy').count(), 11, 'every open song is for sale');
  assert.equal(await page.locator('[data-action="song-open"]').count(), 0, 'nothing to open before buying');
  assert.match(await page.locator('.song-card.buy').first().textContent(), /🪙 20/);
  assert.match(await page.locator('.song-intro').textContent(), /Each song costs 🪙 20/);
  assert.equal(await coinChip(page), 1320);
  assert.match(await page.locator('.song-card.locked').first().textContent(), /Opens with the upright piano, or finish the \w[\w ]* treasure map/);
  // the other shows' tunes are secret: no names, and what opens them
  const list = await page.locator('.songbook').textContent();
  assert.equal((list.match(/Secret song/g) || []).length, 7);
  for (const [map, song] of Object.entries(SHOW_SONGS)) if (!found.includes(map)) assert.ok(!list.includes(song.name), `${song.name} stays secret`);
  await page.screenshot({ path: `${out}/1-songbook-tablet.png`, fullPage: true });
  for (const [n, id] of open.entries()) {
    // buy it (the shop's kind of question first), and it opens straight to its music
    await page.click(`[data-action="song-buy"][data-id="${id}"]`);
    const ask = await page.locator('#modal:not([hidden])').textContent();
    assert.ok(ask.includes(`Buy ${songById(id).name}?`), `${id}: asks first`);
    assert.ok(ask.includes(`It costs 🪙 20. You'll have ${1320 - 20 * n - 20} coins left.`), `${id}: the coins left`);
    assert.match(ask, /easy, medium and hard music, for every buddy/);
    await page.click('#modal [data-action="song-buy-confirm"]');
    await page.waitForSelector(`#sheet[data-id="${id}"]`);
    for (const hands of ['melody', 'roots', 'chords']) {
      await page.click(`[data-action="song-hands"][data-val="${hands}"]`);
      await page.waitForSelector('#sheet.engraved svg');
      const bars = songById(id).lead.length;
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars - 1}`).count() > 0, true, `${id} ${hands}: every bar is there`);
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars}`).count(), 0, `${id}: no extra bars`);
      assert.equal(await page.locator('#sheet .abcjs-staff').count() > 0, true);
      assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${id} ${hands}: abcjs had no warnings`);
    }
    // the medium and hard versions: both hands, every bar, no warnings
    for (const level of ['medium', 'hard'].filter((l) => hasLevel(id, l))) {
      await page.click(`[data-action="song-level"][data-val="${level}"]`);
      await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
      const bars = songById(id).lead.length;
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars - 1}`).count() > 0, true, `${id} ${level}: every bar is there`);
      assert.equal(await page.locator(`#sheet .abcjs-mm${bars}`).count(), 0, `${id} ${level}: no extra bars`);
      assert.equal(await page.locator('.song-hands').count(), 0, 'both hands always: no hands to pick');
      assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${id} ${level}: abcjs had no warnings`);
    }
    if (hasLevel(id, 'medium')) await page.click('[data-action="song-level"][data-val="easy"]');
    await page.click('[data-action="song-back"]');
  }
  assert.equal(await coinChip(page), 1320 - 20 * open.length, '20 coins a song, once');
  assert.equal(await page.locator('.song-card.buy').count(), 0);
  assert.equal(await page.locator('[data-action="song-open"]').count(), open.length, 'every bought song opens');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(saved.spent, 20 * open.length);
  assert.deepEqual(saved.owned.slice().sort(), open.map(songItemId).sort(), 'kept with the kid, not one buddy');
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
  assert.deepEqual(prefs, { hands: 'chords', names: true, slow: false, level: 'easy' });
  // the hard version of a found show's tune plays what's on screen, bar by bar
  await page.click('[data-action="song-back"]');
  await page.click('[data-action="song-open"][data-id="show:bg-galaxy"]');
  await page.click('[data-action="song-level"][data-val="hard"]');
  await page.waitForSelector('#sheet.engraved[data-level="hard"] svg');
  assert.ok(await page.locator('#sheet .abcjs-lyric').count() >= 5, 'note names under the right hand');
  await page.click('[data-action="song-play"]');
  assert.ok(await litBar(page, 1) >= 1, 'the hard version lights up bar by bar');
  await page.click('[data-action="song-level"][data-val="medium"]');
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Listen/, 'another level stops the one playing');
  await page.click('[data-action="song-level"][data-val="easy"]');
  await page.click('[data-action="song-back"]');
  await page.click(`[data-action="song-open"][data-id="${close}"]`);
  await page.click('[data-action="song-back"]');
  await page.click('[data-action="songbook-back"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.music-house').count(), 1, 'back in the music house');
  await ctx.close();
}

// 1b. tablet, the upright piano and no treasure maps, every song bought: all 18 open, no secret songs
{
  const { ctx, page } = await openSongbook({ width: 1280, height: 800 }, 5, [], { songs: ALL });
  assert.equal(await page.locator('.song-card:not(.locked)').count(), 18 + CONCERT.length);
  assert.equal(await page.locator('.song-card.locked').count(), 0);
  const list = await page.locator('.songbook').textContent();
  assert.ok(!list.includes('Secret song'));
  for (const song of Object.values(SHOW_SONGS)) assert.ok(list.includes(song.name), `${song.name} shows its name`);
  // Phoenix Fire has two chords in bar 4: five bars, six chord names, at every level
  await page.click('[data-action="song-open"][data-id="show:bg-volcano"]');
  for (const level of ['easy', 'medium', 'hard']) {
    await page.click(`[data-action="song-level"][data-val="${level}"]`);
    await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
    const names = await page.locator('#sheet .abcjs-chord').allTextContents();
    assert.deepEqual(names.map((n) => n.trim()), ['Am', 'Am', 'G', 'F', 'E', 'Am'], `Phoenix Fire ${level}`);
    assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0');
  }
  await page.screenshot({ path: `${out}/5-two-chords.png`, fullPage: true });
  // the plain lead sheet (shown when the engraver can't load) names both chords too
  const plain = await page.evaluate(async () => { const m = await import('./js/songbook.js'); return [m.leadSheetHtml('show:bg-volcano'), m.leadSheetHtml('show:bg-castle'), m.leadSheetHtml('bg-ocean')]; });
  assert.ok(plain[0].includes('<b>F E</b>') && plain[1].includes('<b>F B♭</b>'), 'the lead sheet names both chords of a shared bar');
  assert.equal(plain[2].split('class="lead-bar').length - 1, 17, 'and has the closing bar');
  await page.click('[data-action="song-level"][data-val="easy"]');
  await page.click('[data-action="song-back"]');
  // Bubble Waltz ends with its closing bar: a 17th bar on D minor
  await page.click('[data-action="song-open"][data-id="bg-ocean"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.locator('#sheet .abcjs-mm16').count() > 0, true, 'the closing bar is on the page');
  assert.equal((await page.locator('#sheet .abcjs-chord').allTextContents()).pop().trim(), 'Dm');
  assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0');
  for (const level of ['medium', 'hard', 'easy']) {
    await page.click(`[data-action="song-level"][data-val="${level}"]`);
    await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
    assert.equal(await page.locator('#sheet .abcjs-mm16').count() > 0, true, `${level}: the closing bar`);
    assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${level}: no warnings`);
  }
  await page.locator('#sheet').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/6-closing-bar.png`, fullPage: true });
  await ctx.close();
}

// 2. phone, the rock star piano and every treasure map: every song open, two bars a line; a
// redraw while a piece plays (family sync does that) leaves the music and the scroll alone
{
  const { ctx, page } = await openSongbook({ width: 412, height: 915 }, 7, Object.keys(SHOW_SONGS), { songs: ALL });
  assert.equal(await page.locator('.song-card:not(.locked)').count(), 18 + CONCERT.length);
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
  // other settings redraw the music, but keep the kid's place in it
  const place = () => page.evaluate(() => {
    const under = document.querySelector('.song-tools').getBoundingClientRect().bottom;
    const tops = [...document.querySelectorAll('#sheet .abcjs-note')].map((e) => [e.getBoundingClientRect().top, e]).filter(([t]) => t >= under).sort((a, b) => a[0] - b[0]);
    return Number([...tops[0][1].classList].find((c) => /^abcjs-mm\d+$/.test(c)).slice(8));
  });
  const before = await place();
  assert.ok(before >= 4, `reading further down (bar ${before + 1})`);
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved .abcjs-lyric');
  assert.ok(Math.abs(await place() - before) <= 2, 'note names: the same place');
  await page.click('[data-action="song-hands"][data-val="melody"]');
  await page.waitForSelector('#sheet.engraved svg');
  // (shorter music may not scroll that far: the bar is on screen, below the buttons)
  const seen = await page.evaluate((n) => {
    const under = document.querySelector('.song-tools').getBoundingClientRect().bottom;
    return [...document.querySelectorAll(`#sheet .abcjs-note.abcjs-mm${n}`)].every((e) => { const r = e.getBoundingClientRect(); return r.top >= under && r.bottom <= window.innerHeight; });
  }, before);
  assert.ok(seen, `melody only: bar ${before + 1} still in view`);
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Stop/, 'and it keeps playing');
  await page.screenshot({ path: `${out}/6-listening-phone.png` });
  await page.click('[data-action="song-play"]');
  // back to the list where it was left
  await page.click('[data-action="song-back"]');
  await page.evaluate(() => window.scrollTo(0, 900));
  await page.click('[data-action="song-open"][data-id="show:bg-castle"]');
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.evaluate(() => window.scrollY), 0, 'a piece opens at the top');
  await page.click('[data-action="song-back"]');
  assert.equal(await page.evaluate(() => window.scrollY), 900, 'and back at the same place in the list');
  await ctx.close();
}

// 3. buying, up close: the little keyboard, one song bought already and 25 coins left (3 weeks
// earn 1320). A bought song, songs for sale and locked show songs side by side, on a tablet and
// a phone; too few coins says how many more; a song not bought can't be opened any other way;
// and what was bought is still bought after a reload.
async function backToSongbook(page) {
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    await page.locator('#modal [data-action="modal-close"]').first().click();
    await page.clock.runFor(400);
  }
  await page.evaluate(() => document.querySelector('.music-house .v-dialog [data-m="bye"]')?.click());
  await page.evaluate(() => document.querySelector('.m-station[data-spot="sheets"]').click());
  await page.clock.runFor(6000);
  await page.waitForSelector('.songbook');
}
const toastText = (page) => page.locator('.toast').last().textContent();
for (const [name, viewport] of [['tablet', { width: 1024, height: 768 }], ['phone', { width: 390, height: 844 }]]) {
  const { ctx, page } = await openSongbook(viewport, 3, [], { songs: ['bg-meadow'], spent: 1320 - 25 });
  assert.equal(await page.locator('[data-action="song-open"]').count(), 1, 'the one bought song opens');
  assert.equal(await page.locator('.song-card.buy').count(), 8, 'the other map songs are for sale');
  assert.equal(await page.locator('.song-card.locked').count(), 9 + CONCERT.length, 'the show songs and the concert pieces stay locked');
  assert.equal(await page.locator('.song-card.buy .song-price.can').count(), 8, '25 coins: they can be bought');
  assert.equal(await coinChip(page), 25);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: no sideways scrolling`);
  // nothing in a card is cut off: everything sits inside its card
  const clipped = await page.$$eval('.song-card', (cards) => cards.filter((c) => {
    const b = c.getBoundingClientRect();
    return [...c.children].some((e) => { const r = e.getBoundingClientRect(); return r.right > b.right + 1 || r.bottom > b.bottom + 1; });
  }).map((c) => c.textContent.trim()));
  assert.deepEqual(clipped, [], `${name}: nothing sticks out of a card`);
  await page.screenshot({ path: `${out}/7-buy-list-${name}.png`, fullPage: true });
  // a song not bought can't be opened by a remembered id, by Listen or by a stray open
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.songId = 'bg-space'; c.render(); });
  assert.equal(await page.locator('#sheet').count(), 0, 'a song not bought shows the list');
  assert.equal(await page.evaluate(async () => (await import('./js/ctx.js')).ui.songId), null);
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.songId = 'bg-space'; c.actions['song-play'](); c.actions['song-open']({ dataset: { id: 'bg-space' } }); });
  assert.equal(await page.locator('#sheet').count(), 0, 'nor by Listen or a stray open');
  if (name === 'phone') { await ctx.close(); continue; }
  // Keep saving: nothing bought
  const id = await page.locator('.song-card.buy').first().getAttribute('data-id');
  await page.click(`[data-action="song-buy"][data-id="${id}"]`);
  await page.click('#modal [data-action="modal-close"]');
  assert.equal(await coinChip(page), 25, 'keep saving: nothing spent');
  // buy it: 5 coins left, and its music opens
  await page.click(`[data-action="song-buy"][data-id="${id}"]`);
  assert.match(await page.locator('#modal').textContent(), /You'll have 5 coins left\./);
  await page.click('#modal [data-action="song-buy-confirm"]');
  await page.waitForSelector(`#sheet[data-id="${id}"]`);
  assert.equal(await toastText(page), `${songById(id).name} is yours!`);
  for (const level of ['medium', 'hard'].filter((l) => hasLevel(id, l))) {
    await page.click(`[data-action="song-level"][data-val="${level}"]`);
    await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
  }
  if (hasLevel(id, 'medium')) await page.click('[data-action="song-level"][data-val="easy"]');
  await page.click('[data-action="song-back"]');
  assert.equal(await coinChip(page), 5);
  // too few coins: how many more, and no question
  const next = await page.locator('.song-card.buy').first().getAttribute('data-id');
  assert.equal(await page.locator('.song-card.buy .song-price.can').count(), 0, '5 coins: nothing looks buyable');
  await page.click(`[data-action="song-buy"][data-id="${next}"]`);
  assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'no question');
  assert.match(await toastText(page), /^15 more coins to go!/);
  assert.equal(await coinChip(page), 5);
  // a stale question, or a song bought already, never charges again
  await page.evaluate(async (i) => { const c = await import('./js/ctx.js'); c.actions['song-buy-confirm']({ dataset: { id: i } }); c.actions['song-buy-confirm']({ dataset: { id: 'bg-meadow' } }); }, next);
  const kidNow = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(kidNow.spent, 1320 - 5, 'only the one purchase was charged');
  assert.deepEqual(kidNow.owned.slice().sort(), [songItemId('bg-meadow'), songItemId(id)].sort());
  // after a reload, both bought songs are still bought
  await page.reload();
  await backToSongbook(page);
  assert.deepEqual((await page.$$eval('[data-action="song-open"]', (els) => els.map((e) => e.dataset.id))).sort(), ['bg-meadow', id].sort(), 'still bought after a reload');
  await page.click(`[data-action="song-open"][data-id="${id}"]`);
  await page.waitForSelector(`#sheet.engraved[data-id="${id}"] svg`);
  await ctx.close();
}

// 4. the concert pieces, with the upright piano: for sale once it's here, bought like a song,
// then engraved as one score (each part's name, key and speed on a new line) with no warnings
// at every level written, the bar being played lit up; on a tablet and a phone.
for (const [name, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
  const { ctx, page } = await openSongbook(viewport, 5, [], { songs: ALL });
  const { id } = CONCERT[0];
  const top = longLevels(id).at(-1);
  assert.match(await page.locator('.song-intro').textContent(), /the long concert pieces/);
  assert.match(await page.locator('.kid-title small').textContent(), new RegExp(`18 of ${18 + CONCERT.length} songs yours`));
  const card = page.locator(`[data-action="song-buy"][data-id="${id}"]`);
  assert.match(await card.textContent(), /🪙 20/, 'for sale');
  await card.click();
  const ask = await page.locator('#modal:not([hidden])').textContent();
  assert.ok(ask.includes(`Buy ${CONCERT[0].name}?`));
  assert.ok(ask.includes(`It opens the ${longLevels(id).length === 3 ? 'easy, medium and hard' : longLevels(id).join(' and ')} music, for every buddy`), ask);
  await page.click('#modal [data-action="song-buy-confirm"]');
  await page.waitForSelector(`#sheet[data-id="${id}"]`);
  assert.match(await page.locator('.kid-title small').textContent(), /\d+ parts · about \d+ min · From the Under the sea map song/);
  assert.match(await page.locator('.song-story').textContent(), /eight parts/);
  assert.equal(await page.locator('.song-hands').count(), 0, 'every level has both hands: no hands to pick');
  assert.equal(await page.locator('[data-action="song-level"]').count(), longLevels(id).length, 'a tab for each level written, and no more');
  for (const level of longLevels(id)) {
    await page.click(`[data-action="song-level"][data-val="${level}"]`);
    await page.waitForSelector(`#sheet.engraved[data-level="${level}"] svg`);
    const bars = longBars(id, level).length;
    assert.ok(await page.locator(`#sheet .abcjs-mm${bars - 1}`).count() > 0, `${level}: every bar is there`);
    assert.equal(await page.locator(`#sheet .abcjs-mm${bars}`).count(), 0, `${level}: no extra bars`);
    assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', `${level}: abcjs had no warnings`);
    assert.equal(await page.getAttribute('#sheet', 'data-per'), name === 'phone' ? '2' : '4');
    const text = await page.locator('#sheet').textContent();
    for (const s of longSections(id, level)) assert.ok(text.includes(s.name), `${level}: ${s.name} is named`);
    assert.ok(await page.locator('#sheet .abcjs-chord').count() >= bars, `${level}: a chord name on every bar`);
    if (name === 'tablet' && level !== top) await page.screenshot({ path: `${out}/8-concert-${level}-${name}.png`, fullPage: true });
  }
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${name}: no sideways scrolling`);
  // the remembered level is the one shown; one not written yet shows the easiest written
  assert.equal(await page.getAttribute('#sheet', 'data-level'), top);
  await page.clock.runFor(8000); // the "is yours!" toast and the confetti go
  await page.screenshot({ path: `${out}/8-concert-${top}-${name}.png`, fullPage: true });
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved .abcjs-lyric');
  assert.ok(await page.locator('#sheet .abcjs-lyric').count() > 50, 'note names under the right hand');
  assert.equal(await page.getAttribute('#sheet', 'data-warnings'), '0', 'note names: no warnings');
  await page.screenshot({ path: `${out}/8-concert-${top}-${name}-names.png`, fullPage: true });
  await page.click('[data-action="song-names"]');
  await page.waitForSelector('#sheet.engraved svg');
  await page.click('[data-action="song-play"]');
  assert.match(await page.locator('[data-action="song-play"]').textContent(), /Stop/);
  assert.equal(await litBar(page, 0), 0, 'the first bar lights up');
  assert.ok(await litBar(page, 1) >= 1, 'and then the next');
  if (name === 'tablet') await page.screenshot({ path: `${out}/9-concert-listening.png` });
  await page.click('[data-action="song-play"]');
  assert.equal(await page.locator('#sheet .now').count(), 0, 'stopped: nothing lit');
  // a level the piece doesn't have yet falls back to its easiest
  await page.evaluate((p) => localStorage.setItem('kidquest.songbook', JSON.stringify({ ...JSON.parse(localStorage.getItem('kidquest.songbook')), level: p })), 'medium');
  await page.evaluate(async () => (await import('./js/ctx.js')).render());
  await page.click('[data-action="song-back"]');
  assert.match(await page.locator(`[data-action="song-open"][data-id="${id}"]`).textContent(), new RegExp(longFacts(id, longLevel(id, 'medium'))));
  await page.click(`[data-action="song-open"][data-id="${id}"]`);
  await page.waitForSelector('#sheet.engraved svg');
  assert.equal(await page.getAttribute('#sheet', 'data-level'), longLevel(id, 'medium'));
  const kid = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.ok(kid.owned.includes(songItemId(id)), 'kept with the kid');
  // without abcjs: the plain lead sheet, part by part
  const plain = await page.evaluate(async ([i, l]) => (await import('./js/songbook.js')).longLeadSheetHtml(i, l), [id, top]);
  assert.equal(plain.split('class="lead-part"').length - 1, longSections(id, longLevels(id)[0]).length);
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`songbook ok: ${out}`);
