// The Note-o-Matic robot's own screen (js/notolab.js) in the real app, with Chrome's fake
// microphone playing a sound file this test writes (C4 E4 G4 C5 G4 E4 C4 E4, two a second,
// as decaying overtones with a little hiss). The robot station in the music house is closed
// until today's chores are done, and opens after. A recording shows its seconds and a
// loudness bar and stops by itself at the limit (made short here); the robot listens in a
// Worker with a progress bar and offers three readings. Listen plays one at a time and stops;
// a new voice and Higher change what plays; "Hear my recording" plays the sound itself; Bars
// of 3 reads it again. Keep puts it on the robot's shelf, which a reload keeps, and on the
// studio's shelf, from where it goes into a mix as a notes clip that plays. Throw away needs
// two taps. A full shelf keeps the screen on the readings. Putting the app away stops a
// recording and keeps nothing. Settings has a test desk right after the studio's. A phone
// fits it all, with buttons at least 44 px. Saves screenshots.
// Run: node test/smoke/notolab.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays, dateKey } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/note-o-matic/lab').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = dateKey();
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const KID = 'kid_ava';
const TEST_DESK = 'parent-test';

// ---------- the sound the fake microphone plays (it loops) ----------

function writeWav(file) {
  const rate = 48000;
  const len = 5 * rate;
  const s = new Float32Array(len);
  const tune = [60, 64, 67, 72, 67, 64, 60, 64];
  let seed = 11;
  const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
  tune.forEach((midi, k) => {
    const f = 440 * 2 ** ((midi - 69) / 12);
    const from = Math.round((0.4 + 0.5 * k) * rate);
    for (let i = 0; i < 0.7 * rate && from + i < len; i += 1) {
      const t = i / rate;
      const env = Math.min(1, t / 0.004) * Math.exp(-t / 0.24) * (t < 0.45 ? 1 : Math.exp(-(t - 0.45) / 0.05));
      let v = 0;
      for (let h = 1; h <= 6; h += 1) v += Math.sin(2 * Math.PI * f * h * t) * (0.6 / h ** 1.2) * Math.exp(-t * h * 0.8);
      s[from + i] += 0.3 * env * v;
    }
  });
  for (let i = 0; i < len; i += 1) s[i] += 0.003 * noise();
  const buf = Buffer.alloc(44 + 2 * len);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + 2 * len, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(2 * len, 40);
  for (let i = 0; i < len; i += 1) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s[i])) * 32767), 44 + 2 * i);
  fs.writeFileSync(file, buf);
}
const tmp = path.resolve('test/.tmp/notolab');
fs.mkdirSync(tmp, { recursive: true });
const wav = path.join(tmp, 'piano.wav');
writeWav(wav);

// ---------- the family ----------

/** Ava with three weeks of every chore (so the music house is open); `done`: today's too. */
function family({ done = false } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  s.settings.music = false;
  const ava = { id: KID, name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -21), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 1; i <= 21; i += 1) s.log[addDays(day, -i)] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  if (done) s.log[day] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] });
const errors = [];

async function start(viewport, st) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript(() => {
    window.kqStarts = 0;
    const P = AudioBufferSourceNode.prototype;
    const s = P.start;
    P.start = function (...a) { window.kqStarts += 1; return s.apply(this, a); };
    window.kqStreams = [];
    const md = navigator.mediaDevices;
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const x = await gum(c); window.kqStreams.push(x); return x; };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await setFamily(page, st);
  return { ctx, page };
}
async function setFamily(page, st) {
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { [KID]: { day, inside: false, place: 'music' } }]);
  await page.reload();
}
/** Into Ava's music house. */
async function intoHouse(page) {
  await page.click(`[data-action="open-kid"][data-id="${KID}"]`);
  await page.waitForSelector('.music-house');
  // what pops up on the way in (news for the day, the music house's hello): closed
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
/** Walk to a station and wait until it answers: a line said, or a screen. */
async function station(page, id, sel) {
  await tap(page, `.m-station[data-spot="${id}"]`);
  await page.waitForSelector(sel, { timeout: 20000 });
}
async function labModule(page) {
  await page.waitForSelector('#lab .lab-bubble');
  await page.evaluate(async () => { window.kqLab = await import('./js/notolab.js'); window.kqLab.LAB.most = 5; });
}
const lab = (page) => page.evaluate(() => window.kqLab.labState());
const waitLab = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const shot = async (page, name, sel = null) => {
  if (sel) await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/${name}.png` });
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const tooSmall = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => { const r = el.getBoundingClientRect(); return [el.textContent.trim().slice(0, 30), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), sel);
const micsOpen = (page) => page.evaluate(() => window.kqStreams.flatMap((st) => st.getTracks()).filter((t) => t.readyState !== 'ended').length);

/**
 * Record and wait for the readings. `stop`: 'limit' (it stops by itself at LAB.most, 5 s
 * here), 'finger' (a finger lands on Stop at 3 s and lets go a moment later) or 'keys' (Stop
 * pressed with no finger, as with a keyboard). The kid's Stop keeps the recording up to 0.1 s
 * before the finger landed (or the press), so the tap on Stop is not in it.
 */
async function recordToPick(page, name = '', stop = 'limit') {
  await page.evaluate((most) => { window.kqLab.LAB.most = most; }, stop === 'limit' ? 5 : 30);
  await page.click('#lab [data-lab="rec"]');
  await waitLab(page, () => window.kqLab.labState().recording && /0:0[1-9]/.test(document.querySelector('.lab-time')?.textContent || ''), null, 15000);
  const st = await lab(page);
  assert.equal(st.stage, 'rec');
  assert.match(st.robot, /I'm listening… Press Stop when you're done\./);
  assert.match(await page.locator('.lab-time').textContent(), stop === 'limit' ? /of 0:05/ : /of 0:30/);
  assert.equal(await page.locator('.lab-meter').count(), 1, 'a loudness bar');
  await waitLab(page, () => parseFloat(document.querySelector('.lab-meter span')?.style.width) > 0, null, 5000).catch(async () => {
    throw new Error(`the loudness bar never moved (${await page.evaluate(() => document.querySelector('.lab-meter span')?.style.width)}, ${await page.locator('.lab-time').textContent()})`);
  });
  if (name) await shot(page, `${name}-recording`);
  let want = stop === 'limit' ? 5 : 0;
  if (stop !== 'limit') {
    await waitLab(page, () => window.kqLab.labState().seconds >= 3, null, 15000);
    if (stop === 'finger') {
      // (a click here would be a finger landing again: the press is made without one)
      const down = await page.evaluate(() => {
        const s = window.kqLab.labState().seconds;
        document.querySelector('#lab [data-lab="stop"]').dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
        return s;
      });
      await page.waitForTimeout(300);
      const up = await page.evaluate(() => { const s = window.kqLab.labState().seconds; document.querySelector('#lab [data-lab="stop"]').click(); return s; });
      assert.ok(up - down > 0.2, 'the finger stayed down a moment');
      want = down - 0.1;
    } else {
      want = await page.evaluate(() => { const s = window.kqLab.labState().seconds; document.querySelector('#lab [data-lab="stop"]').click(); return s; }) - 0.1;
    }
  }
  await waitLab(page, () => window.kqLab.labState().stage !== 'rec', null, 15000);
  const kept = (await lab(page)).kept;
  assert.ok(Math.abs(kept - want) < 0.005, `${stop}: the recording kept is ${kept.toFixed(3)} s, not ${want.toFixed(3)} s`);
  assert.equal(await micsOpen(page), 0, 'the microphone is let go');
  await waitLab(page, () => window.kqLab.labState().stage !== 'listen', null, 60000);
  const after = await lab(page);
  assert.equal(after.stage, 'pick', `the robot heard the tune (it says: ${after.robot})`);
}

// 1. the robot station waits for today's chores, then opens; a recording turns into readings
{
  const { ctx, page } = await start(TABLET, family());
  await intoHouse(page);
  await tap(page, '.m-station[data-spot="lab"]');
  await page.waitForFunction(() => /Note-o-Matic wakes/.test(document.querySelector('.music-house .v-dialog:not([hidden]) .v-text')?.textContent || ''), null, { timeout: 20000 });
  const said = await page.locator('.music-house .v-dialog .v-text').textContent();
  assert.match(said, /The Note-o-Matic wakes up once today's chores are done: \d+ to go/, said);
  assert.equal(await page.locator('.lab-screen').count(), 0, 'no robot screen yet');
  await shot(page, '1-closed', '.music-house .village-view');

  await setFamily(page, family({ done: true }));
  await intoHouse(page);
  await station(page, 'lab', '.lab-screen');
  await labModule(page);
  let st = await lab(page);
  assert.equal(st.stage, 'ready');
  assert.equal(await page.locator('.lab-bubble').textContent(), 'Beep boop! Play me something on the piano and I\'ll turn it into notes.');
  await waitLab(page, () => window.kqLab.labState().shelf);
  assert.equal(await page.locator('.lab-slot').count(), 6, 'six slots on the shelf');
  assert.equal(await page.locator('.lab-slot.empty').count(), 6, 'all empty');
  await shot(page, '2-ready');

  // put away during a recording: it stops, and nothing is kept
  await page.click('#lab [data-lab="rec"]');
  await waitLab(page, () => window.kqLab.labState().recording && /0:0[1-9]/.test(document.querySelector('.lab-time')?.textContent || ''), null, 15000);
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  st = await lab(page);
  assert.equal(st.stage, 'ready', 'back to the start');
  assert.equal(st.recording, false);
  assert.match(await page.locator('.lab-note').textContent(), /put away\. Nothing was kept\./);
  assert.equal(await micsOpen(page), 0, 'the microphone is let go');

  // a real recording, to the readings
  await recordToPick(page, '3');
  st = await lab(page);
  assert.match(st.robot, /Here is what I heard! Listen to each one and pick your favorite\./);
  assert.ok(st.readings.includes('heard') && st.readings.includes('tidy'), `readings: ${st.readings}`);
  assert.equal(st.pick, 'tidy', 'Tidied is picked at first');
  const names = await page.locator('.lab-card .lab-pick b').allTextContents();
  assert.deepEqual(names, ['As I heard it', 'Tidied', 'Band version'].slice(0, st.readings.length), 'in order');
  assert.equal(st.readings.length, 3, 'a band version for this tune');
  assert.deepEqual(st.how, { heard: { voice: 'steel', shift: 0 }, tidy: { voice: 'steel', shift: 0 }, band: { voice: 'beep', shift: 0 } });
  await shot(page, '4-pick');

  // Listen plays and stops; one sound at a time
  await page.click('.lab-card[data-reading="heard"] [data-lab="hear"]');
  await waitLab(page, () => window.kqLab.labState().playing?.key === 'heard');
  assert.equal((await lab(page)).pick, 'heard', 'listening to one picks it');
  await page.click('.lab-card[data-reading="heard"] [data-lab="hear"]');
  await waitLab(page, () => !window.kqLab.labState().playing && window.kqLab.labState().hearing === '');
  await page.click('.lab-card[data-reading="tidy"] [data-lab="pick"]');
  await page.click('.lab-card[data-reading="tidy"] [data-lab="hear"]');
  await waitLab(page, () => window.kqLab.labState().playing?.key === 'tidy');
  const before = (await lab(page)).playing.sig;
  // a new voice changes the sound at once
  await page.selectOption('.lab-card[data-reading="tidy"] select', 'flute');
  await waitLab(page, (b) => window.kqLab.labState().playing?.key === 'tidy' && window.kqLab.labState().playing.sig !== b, before);
  assert.equal((await lab(page)).playing.sig, 'flute|0');
  // and so does Higher
  await page.click('.lab-card[data-reading="tidy"] [data-lab="shift"][data-d="12"]');
  await waitLab(page, () => window.kqLab.labState().playing?.sig === 'flute|12');
  await shot(page, '5-listening', '.lab-card[data-reading="tidy"]');
  // Higher stops at the top
  for (let i = 0; i < 4; i += 1) await page.click('.lab-card[data-reading="tidy"] [data-lab="shift"][data-d="12"]');
  assert.equal((await lab(page)).how.tidy.shift, 24, 'two octaves up at most');
  await page.click('.lab-card[data-reading="tidy"] [data-lab="shift"][data-d="-12"]');
  assert.equal((await lab(page)).how.tidy.shift, 12);
  await page.waitForTimeout(200);
  // my recording, itself; it takes over from the tune
  const starts = await page.evaluate(() => window.kqStarts);
  await page.click('[data-lab="hear"][data-what="raw"]');
  await waitLab(page, () => window.kqLab.labState().playing?.key === 'raw');
  assert.ok(await page.evaluate(() => window.kqStarts) > starts);
  assert.equal(await page.locator('.lab-hear.on').count(), 1, 'one sound at a time');
  await page.click('[data-lab="hear"][data-what="raw"]');
  await waitLab(page, () => !window.kqLab.labState().playing);

  // Bars of 3 reads it again
  const meter = (await lab(page)).meter;
  const other = meter === 3 ? 4 : 3;
  await page.click(`.lab-card[data-reading="band"] [data-lab="meter"][data-meter="${other}"]`);
  await waitLab(page, (m) => window.kqLab.labState().meter === m, other);
  assert.equal(await page.locator(`.lab-card[data-reading="band"] [data-meter="${other}"].on`).count(), 1);
  if (other === 4) { await page.click('.lab-card[data-reading="band"] [data-lab="meter"][data-meter="3"]'); await waitLab(page, () => window.kqLab.labState().meter === 3); }
  assert.equal((await lab(page)).how.tidy.voice, 'flute', 'the voice picked stays');
  await page.click('.lab-card[data-reading="band"] [data-lab="hear"]');
  await waitLab(page, () => window.kqLab.labState().playing?.key === 'band');
  await shot(page, '6-bars-of-3', '.lab-card[data-reading="band"]');

  // keep the tidied one
  await page.click('.lab-card[data-reading="tidy"] [data-lab="pick"]');
  await page.click('[data-lab="keep"]');
  await waitLab(page, () => window.kqLab.labState().stage === 'ready');
  st = await lab(page);
  assert.equal(st.robot, 'Saved! You\'ll find it on the shelf in the recording studio too.');
  assert.match(st.shelf[0], /^Tune 1: Tidied, \d+ seconds?$/);
  assert.equal(st.playing, null, 'the sound stopped');
  await shot(page, '7-saved');

  // a reload keeps it
  await page.reload();
  await intoHouse(page);
  await station(page, 'lab', '.lab-screen');
  await labModule(page);
  await waitLab(page, () => window.kqLab.labState().shelf?.[0]);
  assert.match((await lab(page)).shelf[0], /^Tune 1: Tidied/);
  assert.equal(await page.locator('.lab-slot:not(.empty)').count(), 1);
  // it plays from the shelf
  await page.click('.lab-slot[data-slot="0"] [data-lab="hear"]');
  await waitLab(page, () => window.kqLab.labState().playing?.key === 'slot|0');
  assert.equal((await lab(page)).playing.sig, 'flute|12');

  // and it is on the studio's shelf: into a mix as a notes clip that plays
  await page.click('[data-action="lab-back"]');
  await page.waitForSelector('.music-house');
  assert.equal(await micsOpen(page), 0);
  await station(page, 'studio', '#studio .st-bar');
  await page.waitForSelector('#studio .st-tunes [data-action="st-tune-add"]');
  assert.match(await page.locator('#studio .st-tunes').textContent(), /Tune 1.*Tidied/s);
  await page.click('#studio .st-tunes [data-action="st-tune-hear"]');
  await page.click('#studio .st-tunes [data-action="st-tune-add"]');
  await page.waitForSelector('#studio .st-clip');
  const desk = await page.evaluate(async () => {
    const { findClip } = await import('./js/studiorules.js');
    const m = await import('./js/studio-store.js');
    for (let i = 0; i < 40; i += 1) {
      const { draft } = await m.loadMixes('kid_ava');
      const c = draft?.tracks.flat().find((x) => x.kind === 'notes');
      if (c) return { c, bpm: draft.bpm, found: Boolean(findClip(draft, c.id)) };
      await new Promise((r) => { setTimeout(r, 100); });
    }
    return null;
  });
  assert.ok(desk, 'the draft has the notes clip');
  assert.deepEqual({ role: desk.c.role, own: desk.c.own, shift: desk.c.shift }, { role: 'tune', own: 'flute', shift: 12 });
  await shot(page, '8-studio-shelf', '#studio .st-tunes');
  await page.evaluate(async () => { window.kqStudio = await import('./js/studio.js'); });
  await page.click('[data-action="st-play"]');
  await page.waitForFunction(() => window.kqStudio.studioSound().playing && window.kqStudio.studioSound().sounds > 0, null, { timeout: 20000 });
  await page.click('[data-action="st-play"]');
  await page.click('[data-action="studio-back"]');
  await page.waitForSelector('.music-house');

  // Throw away needs two taps
  await station(page, 'lab', '.lab-screen');
  await labModule(page);
  await waitLab(page, () => window.kqLab.labState().shelf?.[0]);
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw"]');
  assert.equal(await page.locator('.lab-slot[data-slot="0"] .lab-ask').textContent(), 'Throw away?');
  assert.ok((await lab(page)).shelf[0], 'not yet');
  await shot(page, '9-throw-away', '.lab-shelf');
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw-no"]');
  assert.ok((await lab(page)).shelf[0], 'No keeps it');
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw"]');
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw-yes"]');
  await waitLab(page, () => !window.kqLab.labState().shelf[0]);
  assert.deepEqual(await page.evaluate(async () => (await (await import('./js/studio-store.js')).loadTunes('kid_ava')).filter(Boolean).length), 0, 'gone from the tablet');

  // six tunes fill the shelf: a seventh can't be kept, and the readings stay
  await page.evaluate(async () => {
    const { saveTune } = await import('./js/studio-store.js');
    const { cleanTune } = await import('./js/tunerules.js');
    for (let i = 0; i < 6; i += 1) {
      await saveTune('kid_ava', i, cleanTune({ id: `t${i}`, made: 1, reading: 'tidy', bpm: 100, meter: 4, key: 'C', voice: 'steel', shift: 0, parts: [{ role: 'tune', beats: 4, notes: [{ at: 0, len: 2, midi: 60 + i }] }] }));
    }
  });
  await page.click('[data-action="lab-back"]');
  await page.waitForSelector('.music-house');
  await station(page, 'lab', '.lab-screen');
  await labModule(page);
  await waitLab(page, () => window.kqLab.labState().shelf?.every(Boolean));
  await recordToPick(page, '', 'finger');
  await page.click('[data-lab="keep"]');
  await waitLab(page, () => /shelf is full/.test(window.kqLab.labState().robot));
  st = await lab(page);
  assert.equal(st.robot, 'Your tune shelf is full. Throw one away to keep a new one.');
  assert.equal(st.stage, 'pick', 'nothing is lost');
  await shot(page, '10-shelf-full');
  await page.click('[data-lab="over"]');
  assert.equal((await lab(page)).stage, 'ready');
  await ctx.close();
}

// 2. Settings: a test desk right after the studio's, behind the PIN, with its own shelf
{
  const { ctx, page } = await start(TABLET, family());
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.waitForSelector('.tabs');
  await page.click('[data-action="tab"][data-tab="settings"]');
  const order = await page.evaluate(() => [...document.querySelectorAll('.card h2')].map((h) => h.textContent.trim()));
  const at = order.indexOf('🤖 Try the Note-o-Matic');
  assert.ok(at > 0, 'the card is there');
  assert.equal(order[at - 1], '🎚️ Try the recording studio');
  assert.equal(order[at - 2], '🎮 Try the games', `before it: ${order.slice(at - 3, at + 2)}`);
  await page.click('[data-action="lab-test"]');
  await labModule(page);
  assert.match(await page.locator('.lab-screen .kid-title').textContent(), /Test desk/);
  await waitLab(page, () => window.kqLab.labState().shelf);
  await recordToPick(page);
  await page.click('[data-lab="keep"]');
  await waitLab(page, () => window.kqLab.labState().stage === 'ready');
  const kept = await page.evaluate(async (ids) => {
    const { loadTunes } = await import('./js/studio-store.js');
    return Promise.all(ids.map(async (id) => (await loadTunes(id)).filter(Boolean).length));
  }, [TEST_DESK, KID]);
  assert.deepEqual(kept, [1, 0], 'the test desk keeps its own tune; Ava has none');
  await page.click('[data-action="lab-back"]');
  await page.waitForSelector('.tabs [data-tab="settings"].on');
  // the test studio's shelf has it
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-tunes [data-action="st-tune-add"]');
  await page.click('[data-action="studio-back"]');
  await page.waitForSelector('.tabs [data-tab="settings"].on');
  await ctx.close();
}

// 3. a phone: everything fits, and every button is big enough
{
  const { ctx, page } = await start(PHONE, family({ done: true }));
  await page.evaluate(async () => {
    const { saveTune } = await import('./js/studio-store.js');
    const { cleanTune } = await import('./js/tunerules.js');
    await saveTune('kid_ava', 0, cleanTune({ id: 't0', made: 1, reading: 'band', bpm: 100, meter: 4, key: 'C', voice: 'beep', shift: 0, parts: [{ role: 'tune', beats: 8, notes: [{ at: 0, len: 2, midi: 60 }] }, { role: 'band', beats: 8, notes: [{ at: 0, len: 8, midi: 48 }] }] }));
  });
  await intoHouse(page);
  await station(page, 'lab', '.lab-screen');
  await labModule(page);
  await waitLab(page, () => window.kqLab.labState().shelf?.[0]);
  assert.ok(await noSideScroll(page), 'no sideways scrolling');
  assert.deepEqual(await tooSmall(page, '#lab button, .lab-screen header button'), [], 'buttons at least 44 px');
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw"]');
  assert.deepEqual(await tooSmall(page, '#lab button'), [], 'Yes and No too');
  await shot(page, '11-phone-ready');
  await page.click('.lab-slot[data-slot="0"] [data-lab="throw-no"]');
  await recordToPick(page, '12-phone', 'keys');
  assert.ok(await noSideScroll(page), 'the readings fit');
  assert.deepEqual(await tooSmall(page, '#lab button, #lab select'), [], 'buttons at least 44 px');
  await shot(page, '13-phone-pick');
  await shot(page, '14-phone-band', '.lab-card[data-reading="band"]');
  await ctx.close();
}

await browser.close();
site.close();
assert.deepEqual(errors, [], 'no errors on the page');
console.log(`Note-o-Matic screen ok: ${out}`);
