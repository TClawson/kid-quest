// The music house's recording studio (js/studio.js) in the real app: it is locked until
// today's chores are done; parts from the kid's songs go on tracks (and a waltz is turned
// down in a four-beat mix, a full track says so); a clip can be picked, nudged, copied,
// thrown away, dragged to another place and trimmed by its edges; Play loops the mix with a
// moving playhead, a redraw doesn't stop it, Stop does; the loop length and speed change;
// a recording (Chrome's fake microphone beeps) lands on the chosen track and beat and is
// still there after a reload; mixes are saved, opened and deleted (a deleted mix never takes
// the desk's recording with it); the timing check answers in plain words; a shorter loop
// never throws music away; Undo steps back; a thrown-away recording is swept from the tablet
// once it is old enough; no sideways scrolling on a tablet or a phone; a parent's test desk
// from Settings (no piano or chores needed, behind the PIN) leaves every kid as they were.
// Saves screenshots.
// Run: node test/smoke/studio.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { sourceOf, newMix, addPart, addTake, shelfSongs, takeToNotes } from '../../js/studiorules.js';
import { MUSIC_TIERS } from '../../js/musicrules.js';
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

/** Ava on her first day: no piano yet, and today's chores not done. */
function firstDay() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: day, seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  return s;
}

/** A new tablet with Ava's family on it (`s`), in her music house. */
async function start(viewport, done, s = family(done)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['microphone']);
  // count the sounds started and stopped
  await ctx.addInitScript(() => {
    // window.kqMic: '' Chrome's fake microphone, 'silent' one that hears nothing, 'loop' one
    // that hears exactly what the tablet plays
    window.kqMic = '';
    const AC = window.AudioContext;
    window.AudioContext = function (...a) { const ac = new AC(...a); window.kqAC = ac; return ac; };
    window.AudioContext.prototype = AC.prototype;
    const connect = AudioNode.prototype.connect;
    AudioNode.prototype.connect = function (dest, ...rest) {
      const out = connect.call(this, dest, ...rest);
      if (window.kqMic === 'loop' && dest === this.context.destination && window.kqLoop) connect.call(this, window.kqLoop);
      return out;
    };
    const md = navigator.mediaDevices;
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = (c) => {
      if (!window.kqMic || !window.kqAC) return gum(c);
      window.kqLoop = window.kqAC.createMediaStreamDestination();
      return Promise.resolve(window.kqLoop.stream);
    };
    window.kqStarts = 0;
    window.kqStops = 0;
    // the notes handed to the studio's renders (a render given up hands over no more)
    window.kqNotes = 0;
    const osc = OfflineAudioContext.prototype.createOscillator;
    OfflineAudioContext.prototype.createOscillator = function (...a) { window.kqNotes += 1; return osc.apply(this, a); };
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
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [s, { kid_ava: { day, inside: false, place: 'music' } }]);
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
/** Everything the studio keeps on the tablet: { mixes: { key: row as JSON }, takes: [{ id, kid, at }] }. */
const studioRows = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('kidquest-studio', 1);
  req.onsuccess = () => {
    const out = { mixes: {}, takes: [] };
    const tx = req.result.transaction(['mixes', 'takes'], 'readonly');
    tx.objectStore('mixes').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { out.mixes[c.key] = JSON.stringify(c.value); c.continue(); } };
    tx.objectStore('takes').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { out.takes.push({ id: c.key, kid: c.value.kid, at: c.value.at }); c.continue(); } };
    tx.oncomplete = () => { req.result.close(); resolve(out); };
  };
}));
/** Put mixes ([key, row]) and takes ([{ id, kid, at }]) on the tablet, as studio-store.js keeps them. */
const seedStudio = (page, mixes, takes) => page.evaluate(([mixes, takes]) => new Promise((resolve) => {
  const req = indexedDB.open('kidquest-studio', 1);
  req.onupgradeneeded = () => { req.result.createObjectStore('mixes'); req.result.createObjectStore('takes').createIndex('kid', 'kid'); };
  req.onsuccess = () => {
    const tx = req.result.transaction(['mixes', 'takes'], 'readwrite');
    for (const [k, row] of mixes) tx.objectStore('mixes').put(row, k);
    for (const t of takes) tx.objectStore('takes').put({ ...t, rate: 48000, lead: 0, pcm: new Int16Array(48000).fill(1000) }, t.id);
    tx.oncomplete = () => { req.result.close(); resolve(); };
  };
}), [mixes, takes]);
/** From the start screen into the parent's Settings, with the PIN. */
async function toSettings(page) {
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.waitForSelector('.tabs');
  await page.click('[data-action="tab"][data-tab="settings"]');
  await page.waitForSelector('[data-action="studio-test"]');
}
/** The buttons matching `sel` that are under 44 px tall or wide: [text, width, height]. */
const tooSmall = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => { const r = el.getBoundingClientRect(); return [el.textContent.trim(), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), sel);
/** Whether two elements' boxes overlap. */
const overlap = (a, b) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
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
  // the playhead shows once the first frame after the start has drawn (later on a slow runner)
  for (let i = 0; i < 40 && (await head()) < 0; i++) await wait(page, 50);
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
  // Chrome's fake microphone beeps on its own, sometimes in step with the clicks and sometimes
  // not, so the check gets a microphone that is sure: silent, then one that hears the tablet
  await page.evaluate(() => { window.kqMic = 'silent'; localStorage.removeItem('kidquest.studio.delay'); });
  await page.click('[data-action="st-check"]');
  await wait(page, 7000);
  assert.equal(await page.locator('.st-note span').textContent(), 'I couldn\'t hear the clicks. Turn the volume up, unplug headphones and try again.', 'nothing heard');
  assert.equal(await page.evaluate(() => localStorage.getItem('kidquest.studio.delay')), null, 'and no delay kept');
  await page.evaluate(() => { window.kqMic = 'loop'; });
  await page.click('[data-action="st-check"]');
  await wait(page, 7000);
  assert.equal(await page.locator('.st-note span').textContent(), 'All set! Your recordings will line up.', 'its own clicks heard');
  const kept = await page.evaluate(() => Number(localStorage.getItem('kidquest.studio.delay')));
  assert.ok(kept >= 0 && kept < 0.1, `a short delay is kept (${kept})`);
  await page.evaluate(() => { window.kqMic = ''; });
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
  // Redo brings back what Undo took back, step by step
  const redoBtn = page.locator('[data-action="st-redo"]');
  await redoBtn.click();
  assert.equal(await page.locator('#studio .st-clip').count(), 1, 'Redo: the tune is back');
  assert.equal(await toastText(page), 'Put it back.');
  await redoBtn.click();
  assert.equal(await page.locator('#studio .st-clip').count(), 2, 'Redo again: the bass too');
  // a new change: there is nothing more to redo
  await clips(page, 1).first().click();
  await page.click('[data-action="st-delete"]');
  assert.equal(await page.locator('#studio .st-clip').count(), 1);
  assert.ok(await redoBtn.evaluate((b) => b.classList.contains('off')), 'a new change ends Redo');
  await tapLane(page, 0, 0, beats);
  await page.screenshot({ path: `${out}/9-undo-tablet.png` });

  // record on track 2, keep it, then throw it away. Record keeps one width whatever it says,
  // so Undo never slides under the finger that pressed Stop
  const recBtn = page.locator('[data-action="st-rec"]');
  const sizes = [];
  const measure = async () => sizes.push([await recBtn.textContent(), Math.round((await recBtn.boundingBox()).width), Math.round((await undoBtn.boundingBox()).x)]);
  await tapLane(page, 1, 0, beats);
  await measure();
  await recBtn.click();
  await wait(page, 300);
  await measure();
  await wait(page, (60 / sourceOf('bg-meadow').bpm) * 4 * 1000 + 2500);
  await measure();
  await recBtn.click();
  await measure();
  // the take is kept: a second tap on Undo straight away does nothing
  for (let i = 0; i < 60 && !(await clips(page, 1).count()); i += 1) await wait(page, 50);
  // (the label says Saving… a moment longer, until the take is kept on the tablet)
  for (let i = 0; i < 60 && await recBtn.textContent() !== '● Record'; i += 1) await wait(page, 50);
  await measure();
  assert.deepEqual(sizes.map((x) => x[0]), ['● Record', 'Get ready… 4', '■ Stop recording', 'Saving…', '● Record'].slice(0, sizes.length).map((t, i) => (i === 1 ? sizes[1][0] : t)));
  assert.equal(new Set(sizes.map((x) => x[1])).size, 1, `Record keeps its width: ${JSON.stringify(sizes)}`);
  assert.equal(new Set(sizes.map((x) => x[2])).size, 1, 'and Undo stays where it was');
  await undoBtn.click();
  assert.equal(await clips(page, 1).count(), 1, 'a tap on Undo right after the take is kept is ignored');
  await wait(page, 700);
  await undoBtn.click();
  assert.equal(await clips(page, 1).count(), 0, 'later, Undo takes the take away');
  assert.equal(await toastText(page), 'Took your take away. Tap Redo to bring it back.');
  await redoBtn.click();
  assert.equal(await toastText(page), 'Your take is back.');
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

// 6. phone: the transport bar with Undo and Redo, and a picked clip with its handles
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
  // Record and Play keep their widths on a phone too
  const w = async (sel) => Math.round((await page.locator(sel).boundingBox()).width);
  const before = [await w('[data-action="st-rec"]'), await w('[data-action="st-play"]')];
  await page.evaluate(() => { document.querySelector('.st-rec-label').textContent = '■ Stop recording'; document.querySelector('.st-play .st-steady > span').textContent = '■ Stop'; });
  assert.deepEqual([await w('[data-action="st-rec"]'), await w('[data-action="st-play"]')], before, 'the same width whatever they say');
  await ctx.close();
}

// 7. when the tablet lets the studio down: the kid is told, and nothing is lost
{
  // (a) the draft can't be written (a full tablet)
  const { ctx, page } = await start(TABLET, true);
  await ctx.addInitScript(() => {
    const put = IDBObjectStore.prototype.put;
    IDBObjectStore.prototype.put = function (...a) {
      const r = put.apply(this, a);
      if (this.name === 'mixes' && String(a[1]).endsWith('|draft')) this.transaction.abort();
      return r;
    };
  });
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await wait(page, 800);
  assert.equal(await toastText(page), 'I couldn\'t save your mix. This tablet may be full.', 'the kid is told the mix isn\'t kept');
  await tapLane(page, 1, 0, 32);
  await page.click('[data-action="st-rec"]');
  await wait(page, (60 / sourceOf('bg-meadow').bpm) * 4 * 1000 + 2000);
  await page.click('[data-action="st-rec"]');
  await wait(page, 1500);
  assert.equal(await page.locator('.st-note span').textContent(), 'Your take is on your desk, but I couldn\'t keep it on this tablet. This tablet may be full.', 'no "Nice playing!" when it isn\'t kept');
  await ctx.close();
}
{
  // (b) the kid's mixes can't be read: no empty desk saved over the real one
  const { ctx, page } = await start(TABLET, true);
  await ctx.addInitScript(() => {
    const get = IDBObjectStore.prototype.get;
    IDBObjectStore.prototype.get = function (...a) {
      const r = get.apply(this, a);
      const left = Number(localStorage.getItem('kqFailReads') || 0);
      if (this.name === 'mixes' && left > 0 && String(a[0]).endsWith('|draft')) { localStorage.setItem('kqFailReads', String(left - 1)); this.transaction.abort(); }
      return r;
    };
  });
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await wait(page, 800);
  const draftClips = () => page.evaluate(() => new Promise((resolve) => {
    const req = indexedDB.open('kidquest-studio', 1);
    req.onsuccess = () => { const g = req.result.transaction('mixes', 'readonly').objectStore('mixes').get('kid_ava|draft'); g.onsuccess = () => { req.result.close(); resolve(g.result?.mix.tracks.flat().length ?? -1); }; };
  }));
  assert.equal(await draftClips(), 1);
  // one failed read: read again, and the desk opens as it was
  await page.evaluate(() => localStorage.setItem('kqFailReads', '1'));
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  assert.equal(await page.locator('#studio .st-clip').count(), 1, 'a second read opens the desk');
  // two: a plain message and Try again, and the draft is left alone
  await page.evaluate(() => localStorage.setItem('kqFailReads', '2'));
  await walkIn(page);
  await page.waitForSelector('#studio .st-broken');
  assert.equal(await page.locator('#studio .st-broken span').textContent(), 'I couldn\'t open your mixes just now.');
  assert.equal(await page.locator('#studio .st-bar').count(), 0, 'no empty desk to change');
  await page.click('[data-action="studio-back"]');
  await wait(page, 800);
  assert.equal(await draftClips(), 1, 'the draft is not saved over');
  await page.evaluate(async () => (await import('./js/studio.js')).openStudio());
  await page.click('[data-action="st-retry"]');
  await page.waitForSelector('#studio .st-bar');
  assert.equal(await page.locator('#studio .st-clip').count(), 1, 'Try again opens the desk');
  await ctx.close();
}
{
  // (c) a take kept after the kid left: on the next visit there is nothing to undo
  const { ctx, page } = await start(TABLET, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await tapLane(page, 1, 0, 32);
  await page.click('[data-action="st-rec"]');
  await wait(page, (60 / sourceOf('bg-meadow').bpm) * 4 * 1000 + 1500);
  await page.click('[data-action="studio-back"]');
  await wait(page, 1500);
  await page.evaluate(async () => (await import('./js/studio.js')).openStudio());
  await page.waitForSelector('#studio .st-bar');
  assert.equal(await clips(page, 1).count(), 1, 'the take was kept');
  assert.ok(await page.locator('[data-action="st-undo"]').evaluate((b) => b.classList.contains('off')), 'Undo doesn\'t reach into the last visit');
  await ctx.close();
}

// 8. a parent's test desk from Settings: Ava has no piano and today's chores aren't done
{
  const { ctx, page } = await start(TABLET, false, firstDay());
  // Ava already has a draft and a saved mix, a take they use and an old one no mix uses
  const avaMix = addTake(addPart(newMix(), 0, 'bg-meadow', 'lead').mix, 1, 'take-ava-1', 4, 0).mix;
  const old = Date.now() - 60 * 60 * 1000;
  await seedStudio(page, [['kid_ava|draft', { kid: 'kid_ava', slot: 'draft', mix: avaMix, at: old }], ['kid_ava|0', { kid: 'kid_ava', slot: 0, mix: { ...avaMix, name: 'Mix 1' }, at: old }]],
    [{ id: 'take-ava-1', kid: 'kid_ava', at: old }, { id: 'take-ava-old', kid: 'kid_ava', at: old }]);
  await page.reload();
  const before = await studioRows(page);
  const avaRows = (rows) => ({ mixes: Object.entries(rows.mixes).filter(([k]) => k.startsWith('kid_ava|')), takes: rows.takes.filter((t) => t.kid === 'kid_ava') });
  const testTakes = (rows) => rows.takes.filter((t) => t.kid === 'parent-test');
  /** The kids and the log, as saved on the tablet and as the app holds them. */
  const kidsNow = () => page.evaluate(async () => {
    const c = await import('./js/ctx.js');
    const saved = JSON.parse(localStorage.getItem('kidquest.v1'));
    return JSON.stringify([saved.kids, saved.log, c.state.kids, c.state.log]);
  });

  // the test desk can't be reached without the PIN: the same tap from a kid's screen does nothing
  await page.evaluate(() => { const b = document.createElement('button'); b.id = 'sneak'; b.dataset.action = 'studio-test'; document.body.append(b); });
  await page.click('#sneak');
  await page.clock.runFor(500);
  assert.equal(await page.locator('.studio-screen').count(), 0, 'no test desk without the PIN');

  await toSettings(page);
  const card = page.locator('.card.studio-test');
  assert.equal(await card.locator('h2').textContent(), '🎚️ Try the recording studio');
  assert.equal(await card.locator('p').textContent(), 'Open the recording studio right away to see how it works. This is a test desk: the kids\' mixes and stickers are not touched.');
  assert.equal(await page.locator('.card.game-test + .card.studio-test').count(), 1, 'right after Try the games');
  await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/settings-card.png` });
  const kidsBefore = await kidsNow();

  // the test desk: every song, a neutral colour, its own title
  await card.locator('[data-action="studio-test"]').click();
  await page.waitForSelector('#studio .st-bar');
  assert.equal(await page.locator('.studio-screen .kid-title small').textContent(), 'Test desk');
  assert.equal(await page.locator('.studio-screen').evaluate((el) => el.style.getPropertyValue('--kid')), '#868e96', 'a neutral colour');
  assert.equal(await page.locator('#studio').getAttribute('data-kid'), 'parent-test');
  const all = shelfSongs(MUSIC_TIERS.length);
  assert.equal(await page.locator('.st-song').count(), all.length, `every song (${all.length})`);
  assert.ok(all.some((p) => p.kind === 'show') && await page.locator('.st-song[data-song^="show:"]').count(), 'the shows\' songs too');
  assert.equal(await page.locator('#studio .st-clip').count(), 0, 'not Ava\'s draft');

  // a part, a take, a mix saved in a slot
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="lead"]');
  await tapLane(page, 1, 0, 32);
  await page.click('[data-action="st-rec"]');
  await wait(page, (60 / sourceOf('bg-meadow').bpm) * 4 * 1000 + 2500);
  await page.click('[data-action="st-rec"]');
  for (let i = 0; i < 60 && !(await clips(page, 1).count()); i += 1) await wait(page, 50);
  const note = await page.locator('.st-note').count() ? await page.locator('.st-note').textContent() : '';
  assert.equal(note, '', `no complaint (${note})`);
  assert.equal(await clips(page, 1).count(), 1, 'a take on track 2');
  assert.equal(await page.locator('.st-sticker[data-sticker="take"]').count(), 1, 'stickers show on the desk');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/test-desk.png` });
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  assert.equal(await page.locator('.st-slot.empty').count(), 3, 'three empty slots, not Ava\'s');
  await page.click('[data-action="st-slot-save"][data-slot="0"]');
  await wait(page, 300);
  assert.match(await page.locator('.st-slots li').first().textContent(), /Mix 1/);

  // Back goes to Settings, and nothing of Ava's changed
  await page.click('[data-action="studio-back"]');
  await wait(page, 1000);
  assert.equal(await page.locator('.tabs [data-tab="settings"].on').count(), 1, 'back on Settings');
  assert.equal(await page.locator('.studio-screen').count(), 0);
  assert.deepEqual(await page.evaluate(async () => (await import('./js/studio.js')).studioSound()), { playing: false, recording: false, sounds: 0 }, 'the studio is quiet');
  assert.equal(await kidsNow(), kidsBefore, 'no kid, coins, XP or log changed');
  const after = await studioRows(page);
  assert.deepEqual(avaRows(after), avaRows(before), 'Ava\'s mixes and takes are as they were (her old take not swept either)');
  assert.ok(after.mixes['parent-test|draft'] && after.mixes['parent-test|0'], 'the test desk keeps its own draft and mix');
  assert.equal(testTakes(after).length, 1, 'and its own take');

  // the test desk's mix is there on reopening
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-lane');
  await wait(page, 500);
  assert.equal(await page.locator('#studio .st-clip').count(), 2, 'the tune and the take are back');
  assert.equal(await clips(page, 1).first().locator('.st-wave').count(), 1, 'with the take\'s sound');
  // (the panel stays as it was left, as it does for a kid in the same visit)
  if (!(await page.locator('.st-mixes').count())) await page.click('[data-action="st-panel"][data-panel="mixes"]');
  assert.match(await page.locator('.st-slots li').first().textContent(), /Mix 1/, 'and the saved mix');

  // a reload in the test desk lands on the start screen
  await wait(page, 800);
  await page.reload();
  await page.clock.runFor(1000);
  assert.equal(await page.locator('.studio-screen').count(), 0, 'not in the test desk after a reload');
  assert.equal(await page.locator('[data-action="open-kid"][data-id="kid_ava"]').count(), 1, 'the usual start screen');

  // a take the test desk threw away is swept, as for a kid (and Ava's old take still isn't)
  await toSettings(page);
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-bar');
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  await page.click('[data-action="st-slot-del"][data-slot="0"]');
  await page.click('#modal [data-action="modal-yes"]');
  await wait(page, 300);
  await page.click('[data-action="st-new"]');
  await wait(page, 300);
  if (await page.locator('#modal:not([hidden])').count()) await page.click('#modal [data-action="modal-yes"]');
  await wait(page, 300);
  assert.equal(await page.locator('#studio .st-clip').count(), 0, 'a clean test desk');
  await ageTakes(page);
  await page.click('[data-action="studio-back"]');
  await wait(page, 1000);
  const swept = await studioRows(page);
  assert.equal(testTakes(swept).length, 0, 'the test desk\'s take is swept');
  assert.deepEqual(avaRows(swept).takes.map((t) => t.id).sort(), ['take-ava-1', 'take-ava-old'], 'Ava\'s takes are left alone');
  assert.equal(await kidsNow(), kidsBefore, 'and still no kid changed');
  // the kids' studio is still shut for Ava (no piano, chores not done)
  await page.evaluate(async () => { const c = await import('./js/ctx.js'); c.ui.kidId = 'kid_ava'; c.ui.view = 'studio'; c.render(); });
  assert.equal(await page.locator('.studio-screen').count(), 0, 'Ava still needs a piano and her chores');
  await ctx.close();
}

// 9. the remix kit: backing tracks, a song's cymbals and hook, voices, kits, higher and lower,
// moving into the mix's key; Undo and Redo, a reload, and playing it all
{
  const { ctx, page } = await start(TABLET, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-backing');
  const backing = page.locator('#studio .st-backing');
  const clipOf = (sel) => page.locator(`#studio .st-clip${sel}`);
  const draft = () => page.evaluate(async () => (await import('./js/studio-store.js')).loadMixes('kid_ava', true).then((m) => m.draft));
  // an empty desk shows the backing tracks of both beats, the waltz ones marked and apart,
  // after the four-beat ones under their own heading
  assert.equal(await backing.locator('h3').textContent(), 'Backing tracks');
  assert.equal(await backing.locator('[data-action="st-loop"]').count(), 6, 'six chord loops');
  assert.equal(await backing.locator('[data-action="st-loop"].on').textContent(), 'Sunny, in C major', 'the chosen loop says its key');
  const four = backing.locator('.st-songs[data-meter="4"]');
  const waltzTime = backing.locator('.st-waltz-time');
  assert.deepEqual(await four.locator('.st-group-name b').allTextContents(), ['Beats', 'Cymbals', 'Bass lines', 'Chords', 'Sparkles']);
  assert.ok(await backing.locator('[data-pattern="beat-waltz"] .st-waltz').count(), 'a waltz beat is marked: 3 beats');
  assert.equal(await waltzTime.locator('h4').textContent(), 'Waltz time: 3 beats in a bar');
  assert.equal(await four.locator('.st-waltz').count(), 0, 'no waltz among the four-beat ones');
  const waltzOnes = await waltzTime.locator('[data-action="st-back-add"]').evaluateAll((els) => els.map((e) => e.dataset.pattern));
  assert.deepEqual(waltzOnes.sort(), ['bass-long3', 'bass-waltz', 'beat-sway', 'beat-waltz', 'chords-held3', 'chords-oompah', 'cym-lift3', 'cym-ticks3', 'sparkle-up3'], 'every waltz one, and only those');
  assert.ok(await page.evaluate(() => { const [a, b] = ['.st-songs[data-meter="4"]', '.st-waltz-time'].map((s) => document.querySelector(`#studio .st-backing ${s}`).getBoundingClientRect()); return b.top >= a.bottom; }), 'the waltz ones come after');
  // every button there is big enough for a finger
  assert.deepEqual(await tooSmall(page, '#studio .st-shelf .st-part .btn, #studio .st-loops .btn, #studio .st-vol'), []);
  assert.equal(await backing.locator('[data-action="st-back-hear"]').count(), await backing.locator('[data-action="st-back-add"]').count(), 'every one can be heard first');
  // a song lists its new pieces
  const meadowParts = await page.locator('.st-song[data-song="bg-meadow"] [data-action="st-add"]').allTextContents();
  for (const name of ['Hook', 'Kick and snare', 'Cymbals']) assert.ok(meadowParts.some((t) => t.includes(name)), `Forest Village has ${name}`);
  await backing.screenshot({ path: `${out}/shelf-backing-tablet.png` });

  // hear one first, then a beat, a bass line and chords: the House band sticker
  await page.click('[data-action="st-back-hear"][data-pattern="bass-walk"]');
  await wait(page, 300);
  await page.click('[data-action="st-back-add"][data-pattern="beat-rock"]');
  assert.match(await page.locator('.st-bar').textContent(), /Speed 120/, 'a backing track starts the mix at speed 120');
  assert.equal(await backing.locator('.st-waltz').count(), 0, 'now only four-beat backing tracks');
  await page.click('[data-action="st-back-add"][data-pattern="bass-walk"]');
  await page.click('[data-action="st-back-add"][data-pattern="chords-held"]');
  await wait(page, 200);
  assert.equal(await page.locator('.st-sticker[data-sticker="house"]').count(), 1, 'the House band sticker');
  assert.match(await page.locator('.st-mixname').textContent(), /C major/, 'the chords gave the mix a key');
  // change the loop: the bass line and the chords follow
  await page.click('[data-action="st-loop"][data-loop="spooky"]');
  assert.equal(await backing.locator('[data-action="st-loop"].on').textContent(), 'Spooky, in A minor');
  assert.match(await toastText(page), /Spooky chords/);
  assert.equal(await page.locator('#studio .st-clip.group-chords small').first().textContent(), 'Spooky chords');

  // a song's cymbals and its hook
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="cymbals"]');
  await page.click('[data-action="st-add"][data-song="bg-meadow"][data-part="hook"]');
  const hook = clipOf('.kind-hook');
  assert.equal(await hook.count(), 1);
  near((await place(hook)).width, 25, 'a hook is 2 bars: 8 of 32 beats');
  // its voice: the chooser, Deep bass moves it down, the Remixer sticker, an icon on the clip
  await page.click('[data-action="st-chooser"][data-what="voice"]');
  const chooser = page.locator('#studio .st-chooser');
  assert.equal(await chooser.locator('.st-choice').count(), 11, 'its own sound and ten voices');
  assert.match(await chooser.locator('.st-choice.on').textContent(), /Its own sound/);
  await chooser.locator('[data-voice="deep"]').click();
  await wait(page, 100);
  // (what happened shows under the choices while the chooser is open, not in a toast over them)
  assert.match(await page.locator('#studio .st-said').textContent(), /Now it plays as Deep bass\. It moved 2 octaves lower/);
  assert.match(await page.locator('#studio .st-said').textContent(), /New sticker: Remixer!/);
  assert.doesNotMatch(await toastText(page), /Now it plays|sticker/, 'no toast over the choices');
  assert.equal(await hook.getAttribute('data-voice'), 'deep');
  assert.equal(await hook.getAttribute('data-shift'), '-24');
  assert.equal(await hook.locator('.st-vicon').textContent(), '🐋', 'the voice\'s icon on the clip');
  assert.equal(await page.locator('.st-sticker[data-sticker="remixer"]').count(), 1, 'the Remixer sticker');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.locator('#studio .st-tools').scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${out}/voice-chooser-tablet.png` });
  // an octave higher
  await page.click('[data-action="st-shift"][data-d="12"]');
  assert.equal(await hook.getAttribute('data-shift'), '-12');
  assert.match(await page.locator('.st-what small').textContent(), /Deep bass, 1 octave lower/);
  assert.deepEqual(await tooSmall(page, '#studio .st-tools .btn'), [], 'the remix buttons are big enough');
  // a drum clip's kit; drums have no key
  await clipOf('.kind-cymbals').click();
  assert.equal(await clipOf('.kind-cymbals').locator('.st-key').count(), 0, 'no key on a drums clip');
  assert.equal(await page.locator('.st-what b').textContent(), '🔔 Cymbals from Forest Village');
  assert.equal(await page.locator('[data-action="st-shift"]').count(), 0, 'drums don\'t go higher or lower');
  await page.click('[data-action="st-chooser"][data-what="kit"]');
  assert.equal(await page.locator('#studio .st-chooser .st-choice').count(), 3);
  await page.click('[data-action="st-kit"][data-kit="tiny"]');
  assert.equal(await clipOf('.kind-cymbals').getAttribute('data-kit'), 'tiny');
  assert.equal(await clipOf('.kind-cymbals').locator('.st-vicon').textContent(), '🐭');

  // a part in another key, moved into the mix's
  await page.click('[data-action="st-add"][data-song="bg-sunset"][data-part="lead"]');
  const sunny = clipOf('.kind-lead');
  assert.match(await sunny.locator('.st-key').textContent(), /F major · another key/);
  assert.equal(await page.locator('[data-action="st-fit"]').textContent(), '🎯 Move into C major');
  // (the Remix sticker's news comes a moment after the part lands, later still on a busy
  // machine: it is let through first, so it can't land on top of the toast looked for next)
  await page.waitForFunction(() => /New sticker: Remix/.test(document.querySelector('.toast')?.textContent || ''));
  await page.click('[data-action="st-fit"]');
  assert.match(await toastText(page), /Moved into C major/);
  assert.equal(await sunny.getAttribute('data-shift'), '-5');
  assert.equal(await sunny.locator('.st-key').textContent(), 'C major', 'it fits now');
  assert.equal(await page.locator('[data-action="st-fit"]').count(), 0);

  // Undo and Redo a voice change
  await hook.click();
  await page.click('[data-action="st-chooser"][data-what="voice"]');
  await page.click('[data-action="st-voice"][data-voice="musicbox"]');
  assert.equal(await hook.getAttribute('data-voice'), 'musicbox');
  assert.equal(await hook.getAttribute('data-shift'), '-12', 'a second voice doesn\'t move it again');
  await page.click('[data-action="st-undo"]');
  assert.equal(await hook.getAttribute('data-voice'), 'deep', 'Undo');
  await page.click('[data-action="st-redo"]');
  assert.equal(await hook.getAttribute('data-voice'), 'musicbox', 'Redo');
  assert.ok(await noSideScroll(page), 'no sideways scrolling on the tablet');

  // after a reload it is all still there
  await wait(page, 800);
  const kept = await draft();
  const how = (m) => m.tracks.flat().map((c) => [c.kind, c.part || c.pattern, c.loop || '', c.voice || '', c.kit || '', c.shift || 0].join(' ')).sort();
  await page.reload();
  await walkIn(page);
  await page.waitForSelector('#studio .st-clip');
  assert.equal(await page.locator('#studio .st-clip').count(), 6);
  assert.equal(await clipOf('.kind-hook').getAttribute('data-voice'), 'musicbox');
  assert.equal(await clipOf('.kind-cymbals').getAttribute('data-kit'), 'tiny');
  assert.equal(await clipOf('.kind-lead').getAttribute('data-shift'), '-5');
  assert.equal(await backing.locator('[data-action="st-loop"].on').textContent(), 'Spooky, in A minor', 'the chord picker shows the mix\'s chords');
  assert.deepEqual(how(await draft()), how(kept));
  assert.ok(how(kept).includes('backing chords-held spooky   0'));
  for (const id of ['house', 'remixer']) assert.equal(await page.locator(`.st-sticker[data-sticker="${id}"]`).count(), 1);

  // play it all: the sounds are made first, and the kid sees so (Stop still works)
  const starts = await page.evaluate(() => window.kqStarts);
  await page.click('[data-action="st-play"]');
  assert.match(await page.locator('#studio .st-ready').textContent(), /Getting the music ready/);
  assert.match(await page.locator('[data-action="st-play"]').textContent(), /Stop/);
  assert.equal(await page.locator('[data-action="st-play"]').isEnabled(), true);
  await page.screenshot({ path: `${out}/waiting-tablet.png` });
  // Stop while waiting: nothing plays; Play again
  await page.click('[data-action="st-play"]');
  assert.equal(await page.locator('#studio .st-ready').count(), 0);
  await wait(page, 300);
  assert.equal((await page.evaluate(async () => (await import('./js/studio.js')).studioSound())).playing, false, 'stopped while waiting');
  await page.click('[data-action="st-play"]');
  for (let i = 0; i < 100 && await page.locator('#studio .st-ready').count(); i += 1) await wait(page, 100);
  assert.equal(await page.locator('#studio .st-ready').count(), 0, 'the wait ends');
  await wait(page, 1500);
  assert.match(await page.locator('[data-action="st-play"]').textContent(), /Stop/);
  assert.ok(await page.evaluate(() => window.kqStarts) - starts >= 6, 'every clip sounds');
  assert.equal(await page.locator('.st-note').count(), 0, 'no part broke');
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path: `${out}/remixed-desk-tablet.png` });
  await page.click('[data-action="st-play"]');

  // ten fast taps on voices: the sounds nobody waits for any more are given up, not all made
  await wait(page, 500);
  const lead = clipOf('.kind-lead');
  await lead.click();
  await page.click('[data-action="st-chooser"][data-what="voice"]');
  const settle = async () => { let n = -1; for (let i = 0; i < 60; i += 1) { await wait(page, 200); const m = await page.evaluate(() => window.kqNotes); if (m === n) return m; n = m; } return n; };
  let n0 = await settle();
  await page.click('[data-action="st-voice"][data-voice="organ"]');
  const one = (await settle()) - n0;
  assert.ok(one > 40, `a whole tune's notes: ${one}`);
  n0 = await settle();
  // (all in one go, faster than a sound is made: made in full, the ten would hand over about 1000 notes)
  await page.evaluate((list) => { for (const v of list) document.querySelector(`#studio [data-action="st-voice"][data-voice="${v}"]`).click(); }, ['beep', 'buzz', 'reed', 'steel', 'strings', 'robot', 'musicbox', 'deep', 'organ', 'flute']);
  const ten = (await settle()) - n0;
  // the last one (Flute: a note and its vibrato) is made in full, the others give up after their first second
  assert.ok(ten < 3 * one, `ten taps made ${ten} notes; one sound has ${one}`);
  assert.equal(await lead.getAttribute('data-voice'), 'flute');
  await ctx.close();
}

// 10. phone: the voice chooser, and the remix kit on the parent's test desk
{
  const { ctx, page } = await start({ width: 390, height: 844 }, false, firstDay());
  await page.reload();
  await toSettings(page);
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-backing');
  assert.ok(await noSideScroll(page), 'the backing tracks fit a phone');
  await page.click('[data-action="st-back-add"][data-pattern="chords-hop"]');
  await page.click('[data-action="st-add"][data-song="show:bg-meadow"][data-part="hook"]');
  await page.click('[data-action="st-chooser"][data-what="voice"]');
  await page.click('[data-action="st-voice"][data-voice="musicbox"]');
  assert.equal(await page.locator('#studio .st-clip.kind-hook').getAttribute('data-voice'), 'musicbox');
  assert.equal(await page.locator('.st-sticker[data-sticker="remixer"]').count(), 1);
  assert.ok(await noSideScroll(page), 'no sideways scrolling with the chooser open');
  // the message is under the choices, and nothing covers them
  const said = page.locator('#studio .st-said');
  assert.match(await said.textContent(), /Now it plays as Music box\..*New sticker: Remixer!/);
  // (the preview's sound is made, then the studio is drawn again: wait for that before measuring)
  for (let i = 0; i < 100 && /Getting the new sound ready/.test(await said.textContent()); i += 1) await wait(page, 100);
  assert.doesNotMatch(await said.textContent(), /Getting the new sound ready/);
  assert.doesNotMatch(await toastText(page), /Now it plays|sticker/, 'no toast over the choices');
  const boxes = await page.evaluate(() => {
    const box = (el) => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return { said: box(document.querySelector('#studio .st-said')), choices: [...document.querySelectorAll('#studio .st-choice')].map(box) };
  });
  assert.equal(boxes.choices.length, 11);
  for (const b of boxes.choices) assert.ok(!overlap(boxes.said, b), 'the message covers no voice');
  await page.locator('#studio .st-remix').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  assert.ok(await said.evaluate((el) => el.getBoundingClientRect().bottom <= window.innerHeight), 'the message is on screen with the choices');
  await page.screenshot({ path: `${out}/voice-chooser-phone.png` });
  // big enough for a finger on a phone: Voice, Higher, Lower, the chords, the 🔊 buttons, the
  // parts, the tracks' loudness, Undo and Redo, the loop's length and the speed
  assert.deepEqual(await tooSmall(page, '#studio .st-tools .btn, #studio .st-loops .btn, #studio .st-shelf .st-part .btn, #studio .st-vol, #studio .st-undos .btn, #studio .st-step .btn'), []);
  await ctx.close();
}

// 11. how loud each track is: while it plays, mute and unmute, Undo and Redo, a reload, a phone
{
  const { ctx, page } = await start(TABLET, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-backing');
  const sound = () => page.evaluate(async () => (await import('./js/studio.js')).studioSound());
  const draft = () => page.evaluate(async () => (await import('./js/studio-store.js')).loadMixes('kid_ava', true).then((m) => m.draft));
  await page.click('[data-action="st-back-add"][data-pattern="beat-rock"]');
  await page.click('[data-action="st-back-add"][data-pattern="chords-held"]');
  await page.click('[data-action="st-unselect"]');
  const vol = (t) => page.locator(`#studio .st-vol[data-track="${t}"]`);
  assert.deepEqual(await tooSmall(page, '#studio .st-vol'), [], 'the loudness buttons are big enough');
  assert.equal(await vol(0).textContent(), '1🔉', 'the usual loudness');
  // the mix is stored without levels until one changes
  await wait(page, 800);
  assert.equal('vols' in await draft(), false);
  const bar = () => page.evaluate(() => ['st-play', 'st-rec', 'st-undo'].map((a) => { const r = document.querySelector(`[data-action="${a}"]`).getBoundingClientRect(); return [r.x, r.y + window.scrollY, r.width, r.height].map(Math.round).join(' '); }));
  const before = await bar();
  await page.click('[data-action="st-play"]');
  for (let i = 0; i < 100 && !(await sound()).playing; i += 1) await wait(page, 100);
  await wait(page, 500);
  assert.deepEqual((await sound()).tracks, [1, 1, 1, 1]);
  const stops = await page.evaluate(() => window.kqStops);
  // louder while it plays: heard at once, and the music plays on
  await vol(0).click();
  const panel = page.locator('#studio .st-volpanel');
  assert.match(await panel.textContent(), /Track 1.*Usual loudness/);
  assert.equal(await panel.locator('.st-dots i.on').count(), 3);
  assert.deepEqual(await bar(), before, 'Play, Record and Undo stay where they were');
  await page.click('[data-action="st-vol-step"][data-d="1"]');
  await wait(page, 200);
  let now = await sound();
  assert.equal(now.playing, true, 'still playing');
  // (a balance, never a boost: the loudest track plays as usual, the others 3 dB under it)
  near(now.tracks[0], 1, 'track 1 is the loudest');
  near(now.tracks[1], 10 ** (-3 / 20), 'track 2 is 3 dB under it');
  assert.equal(await page.evaluate(() => window.kqStops), stops, 'nothing was stopped: the music didn\'t start again');
  assert.equal(await panel.locator('.st-dots i.on').count(), 4);
  assert.equal(await vol(0).textContent(), '1🔊');
  await page.screenshot({ path: `${out}/track-volume-tablet.png` });
  // mute and unmute
  await page.click('[data-action="st-vol-mute"]');
  await wait(page, 200);
  now = await sound();
  assert.equal(now.tracks[0], 0, 'muted');
  assert.equal(now.playing, true);
  assert.equal(await page.locator('[data-action="st-vol-mute"]').textContent(), '🔈 Unmute');
  assert.equal(await page.locator('#studio .st-lane[data-track="0"].muted').count(), 1, 'its clips look faded');
  assert.equal(await vol(0).textContent(), '1🔇');
  await page.click('[data-action="st-vol-mute"]');
  await wait(page, 200);
  now = await sound();
  assert.equal(await panel.locator('.st-dots i.on').count(), 4, 'unmuted: back to the level it had');
  near(now.tracks[0], 1, 'the loudest track plays as usual');
  near(now.tracks[1], 10 ** (-3 / 20), 'and the others balance 3 dB under it');
  await page.click('[data-action="st-vol-mute"]');
  await wait(page, 200);
  // Undo and Redo
  await page.click('[data-action="st-undo"]');
  await wait(page, 200);
  assert.equal((await sound()).tracks[0], 1, 'Undo: unmuted again');
  await page.click('[data-action="st-undo"]');
  await wait(page, 200);
  assert.equal((await sound()).tracks[0], 0, 'Undo: muted');
  await page.click('[data-action="st-redo"]');
  await wait(page, 200);
  now = await sound();
  assert.deepEqual([now.tracks[0], now.playing], [1, true]);
  await page.click('[data-action="st-vol-step"][data-d="1"]');
  await wait(page, 200);
  now = await sound();
  near(now.tracks[0], 1, 'level 5: still as usual');
  near(now.tracks[1], 10 ** (-6 / 20), 'the others 6 dB under it');
  for (let i = 0; i < 3; i += 1) await page.click('[data-action="st-vol-step"][data-d="-1"]');
  await wait(page, 200);
  now = await sound();
  near(now.tracks[0], 10 ** (-6 / 20), 'three quieter, level 2: -6 dB');
  assert.equal(now.tracks[1], 1, 'and the others back to usual');
  assert.equal(await page.evaluate(() => window.kqStops), stops, 'the music never started again');
  await page.click('[data-action="st-play"]');
  // a reload keeps the levels; a track muted before it unmutes to the usual level
  await wait(page, 800);
  assert.deepEqual((await draft()).vols, [2, 3, 3, 3]);
  await vol(1).click();
  await page.click('[data-action="st-vol-step"][data-d="1"]');
  await page.click('[data-action="st-vol-mute"]');
  await wait(page, 800);
  assert.deepEqual((await draft()).vols, [2, 0, 3, 3]);
  await page.reload();
  await walkIn(page);
  await page.waitForSelector('#studio .st-vol');
  assert.equal(await vol(0).textContent(), '1🔉');
  assert.equal(await vol(1).textContent(), '2🔇');
  await vol(1).click();
  await page.click('[data-action="st-vol-mute"]');
  assert.equal(await page.locator('#studio .st-volpanel .st-dots i.on').count(), 3, 'nothing remembered: the usual level');
  assert.ok(await noSideScroll(page));
  await ctx.close();
}
{
  const { ctx, page } = await start({ width: 390, height: 844 }, true);
  await walkIn(page);
  await page.waitForSelector('#studio .st-backing');
  await page.click('[data-action="st-back-add"][data-pattern="beat-rock"]');
  await page.click('[data-action="st-unselect"]');
  const bar = () => page.evaluate(() => ['st-play', 'st-rec', 'st-undo'].map((a) => { const r = document.querySelector(`[data-action="${a}"]`).getBoundingClientRect(); return [r.x, r.y + window.scrollY, r.width, r.height].map(Math.round).join(' '); }));
  const before = await bar();
  await page.click('#studio .st-vol[data-track="1"]');
  await page.click('[data-action="st-vol-step"][data-d="-1"]');
  assert.deepEqual(await bar(), before, 'the transport doesn\'t move');
  assert.ok(await noSideScroll(page), 'no sideways scrolling with the panel open');
  assert.deepEqual(await tooSmall(page, '#studio .st-vol, #studio .st-volpanel .btn'), []);
  await page.locator('#studio .st-desk').evaluate((el) => el.scrollIntoView({ block: 'start' }));
  await page.screenshot({ path: `${out}/track-volume-phone.png` });
  await ctx.close();
}

// 12. the kid's notes at half or double speed: the clip's Speed choices, on a tablet and a phone
for (const [viewport, name] of [[TABLET, 'tablet'], [{ width: 390, height: 844 }, 'phone']]) {
  const { ctx, page } = await start(viewport, false, firstDay());
  // the test desk's draft: a tune the Note-o-Matic wrote (C E G C, a note a beat) and its band, 8 beats
  const tuneNotes = [60, 64, 67, 72, 67, 64, 60, 64].map((midi, i) => ({ at: 2 * i, len: 1.9, midi }));
  const take = addTake({ ...newMix(), bpm: 100 }, 0, 'take-x', 8, 0);
  const notes = takeToNotes(take.mix, take.id, [{ role: 'tune', notes: tuneNotes, beats: 8 }, { role: 'band', notes: [{ at: 0, len: 8, midi: 48 }, { at: 8, len: 8, midi: 43 }], beats: 8 }], 'C');
  assert.equal(notes.error, null);
  await page.goto(site.url);
  await seedStudio(page, [['parent-test|draft', { kid: 'parent-test', slot: 'draft', mix: notes.mix, at: 1 }]], []);
  await page.reload();
  await toSettings(page);
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-lane[data-track="0"] .st-clip');
  const tuneClip = clips(page, 0).first();
  const bandTrack = notes.mix.tracks.findIndex((t) => t.some((c) => c.role === 'band'));
  const bandClip = clips(page, bandTrack).first();
  const w = (await place(tuneClip)).width;
  const bw = (await place(bandClip)).width;
  await tuneClip.click();
  await page.waitForSelector('#studio .st-paces');
  const on = () => page.locator('#studio .st-pace[aria-pressed="true"]').textContent();
  assert.equal((await on()).trim(), 'Normal', 'Normal is marked');
  assert.deepEqual((await page.locator('#studio .st-pace').allTextContents()).map((t) => t.trim()), ['🐢 Half speed', 'Normal', '🐇 Double speed']);
  await page.click('[data-action="st-pace"][data-pace="half"]');
  await wait(page, 300);
  assert.equal((await on()).trim(), '🐢 Half speed');
  near((await place(clips(page, 0).first())).width, 2 * w, 'half speed: twice as long');
  near((await place(clips(page, bandTrack).first())).width, 2 * bw, 'and its band with it');
  assert.match(await toastText(page), /half speed/);
  assert.deepEqual(await tooSmall(page, '#studio .st-pace'), []);
  assert.ok(await noSideScroll(page));
  await page.locator('#studio .st-tools').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/pace-${name}.png` });
  await page.click('[data-action="st-pace"][data-pace="double"]');
  await wait(page, 300);
  assert.equal((await on()).trim(), '🐇 Double speed');
  near((await place(clips(page, 0).first())).width, w / 2, 'double speed: half as long');
  await page.click('[data-action="st-pace"][data-pace=""]');
  await wait(page, 300);
  near((await place(clips(page, 0).first())).width, w, 'Normal: as it was');
  // kept as it is, and played at its pace
  await page.click('[data-action="st-pace"][data-pace="half"]');
  await wait(page, 300);
  await page.click('[data-action="st-undo"]');
  await wait(page, 300);
  near((await place(clips(page, 0).first())).width, w, 'Undo brings back its speed');
  await page.click('[data-action="st-redo"]');
  await wait(page, 1500);
  const kept = await page.evaluate(async () => (await (await import('./js/studio-store.js')).loadMixes('parent-test')).draft.tracks[0][0]);
  assert.deepEqual([kept.pace, kept.len, kept.norm], ['half', 16, 8], 'the draft keeps its speed');
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`studio ok: ${out}`);
