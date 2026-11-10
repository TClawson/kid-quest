// The music house's recording studio (js/studio.js) in the real app: it is locked until
// today's chores are done; parts from the kid's songs go on tracks (and a waltz is turned
// down in a four-beat mix, a full track says so); a clip can be picked, nudged, copied,
// thrown away, dragged to another place and trimmed by its edges; Play loops the mix with a
// moving playhead, a redraw doesn't stop it, Stop does; the loop length and speed change;
// a recording (Chrome's fake microphone beeps) lands on the chosen track and beat and is
// still there after a reload; mixes are saved, opened and deleted (a deleted mix never takes
// the desk's recording with it); the timing check answers in plain words; a shorter loop
// never throws music away; Undo steps back; a thrown-away recording is swept from the tablet
// once it is old enough; no sideways scrolling on a tablet or a phone. Saves screenshots.
// Run: node test/smoke/studio.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { sourceOf } from '../../js/studiorules.js';
import { CLICK } from '../../js/studio-audio.js';

const out = (process.argv[2] || 'previews/studio').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday

/** Ava with 3 weeks of chores done (the little keyboard), and today's too when `done`. */
function family(done) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  const days = 21;
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -days), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  const all = () => ({ kid_ava: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } });
  for (let i = 1; i <= days; i += 1) s.log[addDays(day, -i)] = all();
  if (done) s.log[day] = all();
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 412, height: 915 };

/** Let time pass on the page's clock and on the sound's real one together. */
async function wait(page, ms) {
  for (let t = 0; t < ms; t += 50) {
    await page.clock.runFor(50);
    await page.waitForTimeout(50);
  }
}

/** A new tablet with Ava's family on it, in her music house. */
async function start(viewport, done) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['microphone']);
  // count the sounds started and stopped
  await ctx.addInitScript(() => {
    window.kqStarts = 0;
    window.kqStops = 0;
    const P = AudioBufferSourceNode.prototype;
    const s = P.start;
    const t = P.stop;
    P.start = function (...a) { window.kqStarts += 1; return s.apply(this, a); };
    P.stop = function (...a) { window.kqStops += 1; return t.apply(this, a); };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [family(done), { kid_ava: { day, inside: false, place: 'music' } }]);
  return { ctx, page };
}

/** Into the music house and up to the studio desk. */
async function walkIn(page) {
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
  await page.evaluate(() => document.querySelector('.music-house .v-dialog [data-m="bye"]')?.click());
  await page.evaluate(() => document.querySelector('.m-station[data-spot="studio"]').click());
  await page.clock.runFor(6000);
}

const toastText = (page) => page.evaluate(() => document.querySelector('.toast')?.textContent || '');
const lane = (page, t) => page.locator(`#studio .st-lane[data-track="${t}"]`);
const clips = (page, t) => lane(page, t).locator('.st-clip');
/** A clip's place as percents: { left, width }. */
const place = (loc) => loc.evaluate((el) => ({ left: parseFloat(el.style.left), width: parseFloat(el.style.width) }));
/** Tap a track at a beat (of `beats`). */
async function tapLane(page, t, beat, beats) {
  await page.locator('#studio .st-desk').scrollIntoViewIfNeeded();
  const box = await lane(page, t).boundingBox();
  await page.mouse.click(box.x + ((beat + 0.5) / beats) * box.width, box.y + box.height / 2);
}
/** Drag with real pointer events from one point to another, in steps. */
async function dragTo(page, from, to) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i += 1) await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  await page.mouse.up();
}
const centre = (b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 });
/** The takes kept on the tablet: [{ id, kid, at }]. */
const takeRows = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('kidquest-studio', 1);
  req.onsuccess = () => {
    const out = [];
    const tx = req.result.transaction('takes', 'readonly');
    tx.objectStore('takes').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { out.push({ id: c.key, kid: c.value.kid, at: c.value.at }); c.continue(); } };
    tx.oncomplete = () => { req.result.close(); resolve(out); };
  };
}));
/** Make every kept take older than five minutes (so it may be swept). */
const ageTakes = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('kidquest-studio', 1);
  req.onsuccess = () => {
    const tx = req.result.transaction('takes', 'readwrite');
    tx.objectStore('takes').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { c.update({ ...c.value, at: c.value.at - 6 * 60 * 1000 }); c.continue(); } };
    tx.oncomplete = () => { req.result.close(); resolve(); };
  };
}));
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 0.2, `${msg}: ${a} vs ${b}`);

// 1. before today's chores are done the desk waits, and the studio can't be opened by hand
{
  const { ctx, page } = await start(TABLET, false);
  await walkIn(page);
  assert.match(await page.locator('.music-house .v-dialog .v-text').textContent(), /chores are done/);
  assert.equal(await page.locator('.studio-screen').count(), 0, 'still in the music house');
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.view = 'studio'; c.render(); });
  assert.equal(await page.locator('.studio-screen').count(), 0, 'the studio sends the kid back');
  await ctx.close();
}

// 2. tablet: build a mix, change it, play it, record into it, keep it
{
  const { ctx, page } = await start(TABLET, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  assert.match(await page.locator('.st-mixname').textContent(), /empty/);
  assert.equal(await page.locator('.st-song').count(), 9, 'the nine map songs of the little keyboard');
  assert.match(await page.locator('.st-song[data-song="bg-meadow"] .st-song-info').textContent(), /major|minor/, 'each song shows its key');
  await page.screenshot({ path: `${out}/1-empty-tablet.png`, fullPage: true });

  // parts: the first sets the speed, the key and the length
  const meadow = sourceOf('bg-meadow');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  assert.equal(await clips(page, 0).count(), 1, 'the tune on track 1');
  assert.match(await page.locator('.st-bar').textContent(), new RegExp(`8 bars.*Speed ${meadow.bpm}`, 's'));
  assert.match(await clips(page, 0).first().textContent(), /Tune.*major|Tune.*minor/s, 'a clip shows its part and key');
  assert.ok(await page.locator('.st-song[data-song="bg-meadow"] .st-fit:not(.no)').count(), 'its own song goes with the mix');
  // a waltz can't join a four-beat mix
  await page.click('[data-action="st-add"][data-song="bg-ocean"][data-part="lead"]');
  assert.match(await toastText(page), /3 beats in a bar/, 'the waltz is turned down');
  assert.equal(await page.locator('#studio .st-clip').count(), 1);
  // the next part goes on the first track with room
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="bass"]');
  assert.equal(await clips(page, 1).count(), 1, 'the bass on track 2');
  assert.equal(await page.locator('.st-sticker').count(), 0);

  // pick the tune and make it 4 beats shorter with the buttons
  const beats = 32;
  await clips(page, 0).first().click();
  assert.equal(await page.locator('.st-tools').count(), 1, 'a picked clip gets its buttons');
  for (let i = 0; i < 4; i += 1) await page.click('[data-action="st-nudge"][data-do="shorter"]');
  near((await place(clips(page, 0).first())).width, 87.5, 'the tune is 28 beats');
  // choose the empty spot at beat 31 and add the drums there: 2 beats of room
  await tapLane(page, 0, 30, beats);
  assert.equal(await lane(page, 0).locator('.st-spot:not(.auto)').count(), 1, 'the chosen spot is marked');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="drums"]');
  const drums = clips(page, 0).nth(1);
  near((await place(drums)).left, 93.75, 'the drums start at beat 31');
  near((await place(drums)).width, 6.25, 'and fit the room');
  assert.equal(await page.locator('.st-sticker[data-sticker="band"]').count(), 1, 'a full band sticker');
  // earlier twice, longer twice: track 1 is full
  await tapLane(page, 0, 28, beats);
  await drums.click();
  for (const todo of ['earlier', 'earlier', 'longer', 'longer']) await page.click(`[data-action="st-nudge"][data-do="${todo}"]`);
  near((await place(drums)).left, 87.5, 'the drums start at beat 29');
  near((await place(drums)).width, 12.5, 'four beats long');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="arp"]');
  assert.match(await toastText(page), /That track is full/, 'a full track says so');

  // copy the bass (no room on its track: it goes on track 3), then throw the copy away
  await clips(page, 1).first().click();
  await page.click('[data-action="st-copy"]');
  assert.equal(await clips(page, 2).count(), 1, 'the copy on track 3');
  await page.click('[data-action="st-delete"]');
  assert.equal(await clips(page, 2).count(), 0, 'and gone again');
  assert.equal(await page.locator('.st-tools').count(), 0);

  // drag the drums to track 3, beat 9
  await page.locator('#studio .st-desk').scrollIntoViewIfNeeded();
  const from = centre(await drums.boundingBox());
  const l2 = await lane(page, 2).boundingBox();
  await dragTo(page, from, { x: from.x - ((28 - 8) / beats) * l2.width, y: l2.y + l2.height / 2 });
  assert.equal(await clips(page, 2).count(), 1, 'dragged to track 3');
  near((await place(clips(page, 2).first())).left, 25, 'at beat 9');
  // drag its right edge 4 beats on, then its left edge 2 beats on
  const moved = clips(page, 2).first();
  const right = await moved.locator('.st-edge.right').boundingBox();
  await dragTo(page, centre(right), { x: centre(right).x + (4 / beats) * l2.width, y: centre(right).y });
  near((await place(moved)).width, 25, 'trimmed longer: 8 beats');
  const left = await moved.locator('.st-edge.left').boundingBox();
  await dragTo(page, centre(left), { x: centre(left).x + (2 / beats) * l2.width, y: centre(left).y });
  near((await place(moved)).left, 31.25, 'the front trimmed: starts at beat 11');
  near((await place(moved)).width, 18.75, 'and 6 beats long');
  // a drop on the full bass track is turned down
  const c2 = centre(await moved.boundingBox());
  const l1 = await lane(page, 1).boundingBox();
  await dragTo(page, c2, { x: c2.x, y: l1.y + l1.height / 2 });
  assert.match(await toastText(page), /already there/, 'a refused drop says why');
  assert.equal(await clips(page, 2).count(), 1, 'and the clip stays');
  await page.screenshot({ path: `${out}/2-mix-tablet.png`, fullPage: true });

  // loop length and speed
  await page.click('[data-action="st-bars"][data-d="1"]');
  assert.match(await page.locator('.st-bar').textContent(), /9 bars/);
  await page.click('[data-action="st-bars"][data-d="-1"]');
  assert.match(await page.locator('.st-bar').textContent(), /8 bars/);
  await page.click('[data-action="st-bpm"][data-d="1"]');
  assert.match(await page.locator('.st-bar').textContent(), new RegExp(`Speed ${meadow.bpm + 5}`));
  await page.click('[data-action="st-bpm"][data-d="-1"]');
  assert.match(await page.locator('.st-bar').textContent(), new RegExp(`Speed ${meadow.bpm}`));

  const playing = () => page.evaluate(async () => (await import('./js/studio.js')).studioSound());
  // play: sounds start and the playhead moves; a redraw and even a new shell don't stop it
  await page.click('[data-action="st-play"]');
  await wait(page, 800);
  assert.match(await page.locator('[data-action="st-play"]').textContent(), /Stop/);
  const started = await page.evaluate(() => window.kqStarts);
  assert.ok(started >= 4, `sounds started (${started})`);
  const head = () => page.evaluate(() => { const h = document.querySelector('#studio .st-head'); return h && !h.hidden ? parseFloat(h.style.left) : -1; });
  const h1 = await head();
  await wait(page, 600);
  const h2 = await head();
  assert.ok(h1 >= 0 && h2 > h1, `the playhead moves (${h1} → ${h2})`);
  await page.evaluate(() => { document.querySelector('#studio .st-bar').dataset.mark = 'kept'; });
  await page.evaluate(async () => (await import('./js/ctx.js')).render());
  assert.equal(await page.locator('#studio .st-bar[data-mark="kept"]').count(), 1, 'a redraw leaves the desk alone');
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.state.kids[0].color = '#4dabf7'; c.render(); });
  await wait(page, 600);
  assert.equal(await page.locator('#studio .st-bar[data-mark="kept"]').count(), 0, 'a new shell');
  assert.match(await page.locator('[data-action="st-play"]').textContent(), /Stop/, 'still playing');
  const h3 = await head();
  await wait(page, 400);
  assert.ok((await head()) !== h3, 'the playhead still moves');
  await page.screenshot({ path: `${out}/3-playing-tablet.png` });
  const stopsBefore = await page.evaluate(() => window.kqStops);
  await page.click('[data-action="st-play"]');
  assert.match(await page.locator('[data-action="st-play"]').textContent(), /Play/);
  assert.ok(await page.evaluate(() => window.kqStops) > stopsBefore, 'Stop stops the sounds');
  assert.equal(await head(), -1, 'no playhead when stopped');
  assert.equal((await playing()).sounds, 0, 'every sound stopped');

  // record onto track 4 at beat 5 (headphones off: clicks only)
  await tapLane(page, 3, 4, beats);
  await page.click('[data-action="st-rec"]');
  await wait(page, 300);
  assert.match(await page.locator('.st-rec').textContent(), /Get ready|Stop recording/);
  await wait(page, (60 / meadow.bpm) * 4 * 1000 + 2500);
  assert.equal(await lane(page, 3).locator('.st-recbox').count(), 1, 'the recording shows on its track');
  await page.click('[data-action="st-rec"]');
  await wait(page, 1500);
  const note = await page.locator('.st-note').count() ? await page.locator('.st-note').textContent() : '';
  assert.equal(note, '', `no complaint (${note})`);
  assert.equal(await clips(page, 3).count(), 1, 'a take on track 4');
  const take = clips(page, 3).first();
  assert.match(await take.textContent(), /My take/);
  near((await place(take)).left, 12.5, 'starting at beat 5');
  assert.ok((await place(take)).width >= 6.25, 'a couple of beats long or more');
  assert.equal(await page.locator('.st-sticker[data-sticker="take"]').count(), 1, 'a first take sticker');
  assert.equal(await page.locator('.st-sticker[data-sticker="duet"]').count(), 1, 'and a duet');
  assert.equal(await take.locator('.st-wave').count(), 1, 'with a little picture of the sound');
  // a take keeps the speed (the button says why when tapped)
  await page.click('[data-action="st-bpm"][data-d="1"]', { force: true });
  assert.match(await toastText(page), /speed stays/);
  const takeAt = await place(take);
  await page.screenshot({ path: `${out}/4-take-tablet.png`, fullPage: true });

  // the desk is still there after a reload (the draft)
  await wait(page, 1000);
  await walkIn(page);
  await page.waitForSelector('#studio .st-lane');
  await wait(page, 500);
  assert.equal(await page.locator('#studio .st-clip').count(), 4, 'every clip is back');
  assert.deepEqual(await place(clips(page, 3).first()), takeAt, 'the take in the same place');
  assert.equal(await clips(page, 3).first().locator('.st-wave').count(), 1, 'and its sound too');

  // my mixes: save, a new desk, open, delete
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  assert.equal(await page.locator('.st-slot.empty').count(), 3);
  await page.click('[data-action="st-slot-save"][data-slot="0"]');
  await wait(page, 300);
  assert.match(await page.locator('.st-slots li').first().textContent(), /Mix 1.*8 bars/s);
  await page.screenshot({ path: `${out}/5-mixes-tablet.png`, fullPage: true });
  await page.click('[data-action="st-new"]');
  await wait(page, 300);
  assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'saved: no need to ask');
  assert.equal(await page.locator('#studio .st-clip').count(), 0, 'a clean desk');
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  await page.click('[data-action="st-slot-open"][data-slot="0"]');
  await wait(page, 300);
  assert.equal(await page.locator('#studio .st-clip').count(), 4, 'the saved mix is back on the desk');
  // the take is old now: deleting the saved mix must not sweep the desk's take away
  await ageTakes(page);
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  await page.click('[data-action="st-slot-del"][data-slot="0"]');
  assert.match(await page.locator('#modal').textContent(), /Delete Mix 1/);
  await page.click('#modal [data-action="modal-yes"]');
  await wait(page, 300);
  assert.equal(await page.locator('.st-slot.empty').count(), 3, 'the slot is empty again');
  assert.equal(await page.locator('#studio .st-clip').count(), 4, 'and the desk keeps its mix');
  assert.equal(await page.locator('#studio .st-clip.gone').count(), 0, 'the desk\'s take is not missing');
  assert.equal((await takeRows(page)).length, 1, 'and its sound is still kept on the tablet');

  // the timing check answers in plain words
  await page.click('[data-action="st-panel"][data-panel="help"]');
  await page.click('[data-action="st-check"]');
  await wait(page, 7000);
  // Chrome's fake microphone beeps in step with the check's clicks (every half second), so
  // the check always finds them, and keeps a delay
  assert.equal(await page.locator('.st-note span').textContent(), 'All set! Your recordings will line up.');
  const kept = await page.evaluate(() => Number(localStorage.getItem('kidquest.studio.delay')));
  assert.ok(kept >= 0 && kept <= 0.6, `a delay is kept (${kept})`);
  await page.screenshot({ path: `${out}/6-help-tablet.png`, fullPage: true });
  assert.ok(await noSideScroll(page), 'no sideways scrolling on the tablet');

  // going back stops the music
  await page.click('[data-action="st-play"]');
  await wait(page, 500);
  await page.click('[data-action="studio-back"]');
  await page.clock.runFor(1500);
  assert.equal(await page.locator('.music-house').count(), 1, 'back in the music house');
  const sound = await page.evaluate(async () => (await import('./js/studio.js')).studioSound());
  assert.deepEqual(sound, { playing: false, recording: false, sounds: 0 }, 'the studio is quiet');
  await ctx.close();
}

// 3. phone: a mix, a picked clip, no sideways scrolling
{
  const { ctx, page } = await start(PHONE, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="bass"]');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="drums"]');
  await clips(page, 1).first().click();
  assert.ok(await noSideScroll(page), 'no sideways scrolling on a phone');
  await page.screenshot({ path: `${out}/7-phone.png`, fullPage: true });
  await page.screenshot({ path: `${out}/8-phone-top.png` });
  await ctx.close();
}

// 4. a waltz: Record stays usable after leaving while the microphone was getting ready, and
// the clicks are the same two sounds on whole frames, the high one on each bar's first beat
{
  const { ctx, page } = await start(TABLET, true);
  await ctx.addInitScript(() => {
    // hold the microphone back while kqHold is set, until kqMicGo() is called
    const md = navigator.mediaDevices;
    const get = md.getUserMedia.bind(md);
    window.kqHold = false;
    md.getUserMedia = (c) => (window.kqHold ? new Promise((ok, no) => { window.kqMicGo = () => get(c).then(ok, no); }) : get(c));
    // note every click started: its frame and its sound
    window.kqClicks = [];
    window.kqClickBufs = [];
    const P = AudioBufferSourceNode.prototype;
    const s = P.start;
    P.start = function (...a) {
      const rate = this.context.sampleRate;
      if (this.buffer && this.buffer.length === Math.round(0.06 * rate)) {
        if (!window.kqClickBufs.includes(this.buffer)) window.kqClickBufs.push(this.buffer);
        window.kqClicks.push({ frame: a[0] * rate, buf: window.kqClickBufs.indexOf(this.buffer) });
      }
      return s.apply(this, a);
    };
  });
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-ocean"][data-part="lead"]');
  assert.match(await page.locator('.st-mixname').textContent(), /3 beats in a bar/);
  const recBtn = page.locator('[data-action="st-rec"]');

  // Record, then a part's 🔊 and Back while the microphone is still getting ready
  await page.evaluate(() => { window.kqHold = true; });
  await recBtn.click();
  assert.match(await recBtn.textContent(), /Getting ready/);
  await page.click('[data-action="st-hear"][data-song="bg-ocean"][data-part="lead"]', { force: true });
  assert.equal(await page.locator('.st-hear.on').count(), 0, 'no hearing while the microphone gets ready');
  await page.click('[data-action="studio-back"]');
  await page.clock.runFor(500);
  await page.evaluate(() => window.kqMicGo());
  await page.waitForTimeout(300);
  await page.evaluate(async () => (await import('./js/studio.js')).openStudio());
  await page.clock.runFor(1000);
  await page.waitForSelector('#studio .st-bar');
  assert.equal(await recBtn.isDisabled(), false, 'Record can be pressed again');
  assert.match(await recBtn.textContent(), /Record/);

  // a 🔊 while getting ready doesn't spoil the recording
  await recBtn.click();
  await page.click('[data-action="st-hear"][data-song="bg-ocean"][data-part="lead"]', { force: true });
  await page.evaluate(() => window.kqMicGo());
  await wait(page, 600);
  assert.match(await recBtn.textContent(), /Get ready|Stop recording/, 'the recording goes on');
  const plan = await page.evaluate(async () => (await import('./js/studio.js')).studioRec());
  const H = CLICK.first;
  const L = CLICK.other;
  assert.deepEqual(plan.countIn.map((c) => c.hz), [H, L, L], 'a bar of three to count in');
  assert.deepEqual(plan.clicks.slice(0, 7).map((c) => c.hz), [H, L, L, H, L, L, H], 'the high note on every bar\'s first beat');
  for (const c of [...plan.countIn, ...plan.clicks]) assert.ok(Number.isInteger(c.frame), `whole frames (${c.frame})`);
  const heard = await page.evaluate(() => window.kqClicks);
  assert.equal(heard.length, plan.countIn.length + plan.clicks.length, 'every click was started');
  const notes = [...plan.countIn, ...plan.clicks];
  heard.forEach((c, i) => {
    assert.ok(Math.abs(c.frame - notes[i].frame) < 1e-6, `click ${i} starts on its frame (${c.frame})`);
    assert.equal(c.buf, notes[i].hz === H ? heard[0].buf : heard[1].buf, `click ${i} is the same sound as the others of its note`);
  });
  assert.equal(await page.evaluate(() => window.kqClickBufs.length), 2, 'two click sounds in all');
  await wait(page, 2500);
  await recBtn.click();
  await wait(page, 1500);
  const note = await page.locator('.st-note').count() ? await page.locator('.st-note').textContent() : '';
  assert.equal(note, '', `no complaint (${note})`);
  assert.equal(await clips(page, 1).count(), 1, 'a take on track 2');
  await ctx.close();
}

// 5. tablet: a shorter loop never throws music away, Undo steps back, and a recording that
// was thrown away is swept from the tablet once it is old enough
{
  const { ctx, page } = await start(TABLET, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  const beats = 32;
  const undoBtn = page.locator('[data-action="st-undo"]');
  assert.ok(await undoBtn.evaluate((b) => b.classList.contains('off')), 'nothing to undo yet');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await page.click('[data-action="st-unselect"]');
  assert.match(await page.locator('.st-hint').textContent(), /New music goes on track 2, beat 1\. There is room for 32 beats\./, 'the hint says where new music goes');
  // the bass in the last bar
  await tapLane(page, 1, 28, beats);
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="bass"]');
  near((await place(clips(page, 1).first())).left, 87.5, 'the bass starts at beat 29');
  await page.click('[data-action="st-bars"][data-d="-1"]');
  assert.equal(await toastText(page), 'Move or delete the music in the last bar first.');
  assert.match(await page.locator('.st-bar').textContent(), /8 bars/, 'the loop stays');
  assert.equal(await page.locator('#studio .st-clip').count(), 2, 'and so does the bass');
  // throw the bass away, then Undo brings it back, and Undo again takes it off
  await page.click('[data-action="st-delete"]');
  assert.equal(await page.locator('#studio .st-clip').count(), 1);
  await undoBtn.click();
  assert.equal(await page.locator('#studio .st-clip').count(), 2, 'Undo brings the bass back');
  near((await place(clips(page, 1).first())).left, 87.5, 'in its place');
  await undoBtn.click();
  assert.equal(await page.locator('#studio .st-clip').count(), 1, 'Undo again: before the bass was added');
  await undoBtn.click();
  assert.equal(await page.locator('#studio .st-clip').count(), 0, 'and before the tune');
  assert.ok(await undoBtn.evaluate((b) => b.classList.contains('off')), 'nothing more to undo');
  await undoBtn.click({ force: true });
  assert.equal(await toastText(page), 'There is nothing to undo.');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await tapLane(page, 0, 0, beats);
  await page.screenshot({ path: `${out}/9-undo-tablet.png` });

  // record on track 2, keep it, then throw it away
  await tapLane(page, 1, 0, beats);
  await page.click('[data-action="st-rec"]');
  await wait(page, (60 / sourceOf('bg-meadow').bpm) * 4 * 1000 + 2500);
  await page.click('[data-action="st-rec"]');
  await wait(page, 1500);
  assert.equal(await clips(page, 1).count(), 1, 'a take on track 2');
  assert.equal((await takeRows(page)).length, 1, 'kept on the tablet');
  await page.screenshot({ path: `${out}/10-take-picked-tablet.png` });
  if (!(await page.locator('.st-tools').count())) await clips(page, 1).first().click();
  await page.click('[data-action="st-delete"]');
  await wait(page, 800);
  // a young take is never swept (it may be on its way to a mix); an old one that no mix uses is
  await page.click('[data-action="studio-back"]');
  await wait(page, 800);
  assert.equal((await takeRows(page)).length, 1, 'young: still there');
  await ageTakes(page);
  await page.evaluate(async () => (await import('./js/studio.js')).openStudio());
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="studio-back"]');
  await wait(page, 800);
  assert.deepEqual(await takeRows(page), [], 'the thrown-away take is swept from the tablet');
  await ctx.close();
}

// 6. phone: the transport bar with Undo, and a picked clip with its handles
{
  const { ctx, page } = await start({ width: 390, height: 844 }, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="drums"]'); // picked
  for (let i = 0; i < 28; i += 1) await page.click('[data-action="st-nudge"][data-do="shorter"]');
  await page.click('[data-action="st-nudge"][data-do="later"]');
  assert.ok(await noSideScroll(page), 'no sideways scrolling on a phone');
  const edge = await clips(page, 1).first().locator('.st-edge.right').boundingBox();
  assert.ok(edge.width >= 40, `a handle is wide enough for a finger (${edge.width})`);
  await page.screenshot({ path: `${out}/11-phone-undo.png` });
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/12-phone-bar.png` });
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`studio ok: ${out}`);
