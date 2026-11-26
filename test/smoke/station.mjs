// The buddy station (js/station.js, js/nfc.js, js/stationrules.js), behind the parent PIN.
// 1. Desktop Chromium has no Web NFC: Parents › Settings › Buddy station says so and offers nothing.
// 2. With a stand-in NDEFReader (Chrome on Android's API, faked here) and NFC already allowed:
//    Check a token reads tokens (an unlinked token says so); Link then a tap links a token
//    to a kid's chore (one field of that kid sent); a linked token says what it is; the song
//    length changes; timer chores take no token. The station opens dark with the buddies resting
//    and the screen kept awake. First tap: the chore starts (startedAt only, one chore's record
//    sent), the buddy fills the screen with a song bar. A resting token read every second does
//    nothing. A second tap under 20 s waves. A second kid starts a chore that a parent checks:
//    both work at once. The song ends: humming. Second taps check both off (done, and waiting
//    for a parent, by 'token'), with a dance. Done, not-today and unlinked tokens wave or puzzle.
//    Leaving takes the PIN (Cancel keeps the station). The parents' Today view says "Done with a
//    token" and how long it took, and "Started" for a chore in play. The day changing drops a
//    chore in play.
// Screenshots go to SHOTS_DIR (or previews/station).
// Run: node test/smoke/station.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, fallbackHash, addDays } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';

const out = (process.env.SHOTS_DIR || 'previews/station').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const PHONE = { width: 412, height: 860 };
const ALL = [0, 1, 2, 3, 4, 5, 6];
const task = (id, name, icon, extra = {}) => ({ id, name, icon, period: 'morning', days: ALL, verify: 'self', minutes: 0, ...extra });

const s = emptyState();
s.settings.pinHash = fallbackHash('kidquest:1234');
s.settings.sound = true;
s.settings.allowance = { start: addDays(TEST_DAY, 30), startFixed: true };
const kidBase = { startDate: '2024-01-01', seenUnlocks: [], seenMoves: [], owned: [], spent: 0 };
s.kids.push({
  ...kidBase, id: 'kid_ava', name: 'Ava', color: '#ff6b6b', buddy: { species: 'fox', outfit: { background: 'bg-meadow' } },
  tasks: [task('t_bed', 'Make bed', '🛏️'), task('t_teeth', 'Brush teeth', '🪥'), task('t_sun', 'Sunday chore', '🧽', { days: [] }), task('t_piano', 'Piano practice', '🎹', { verify: 'parent', minutes: 30 })],
});
s.kids.push({
  ...kidBase, id: 'kid_ben', name: 'Ben', color: '#4dabf7', buddy: { species: 'panda', outfit: { background: 'bg-space' } },
  tasks: [task('t_toys', 'Toys away', '🧸', { verify: 'parent' }), task('t_bed2', 'Make bed', '🛏️')],
});

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const errors = [];

async function open(ctx) {
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await useTestDay(page, { time: '07:30' });
  await page.goto(site.url);
  await page.evaluate((st) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); Storage.prototype.setItem = () => {}; }, s);
  await page.reload();
  await page.waitForSelector('[data-action="parent"]');
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="settings"]');
  return page;
}

// the app's own state, from its modules (the same instances the page runs)
const rec = (page, kid, taskId) => page.evaluate(async ([k, t]) => {
  const { state } = await import('./js/ctx.js');
  const { dateKey } = await import('./js/logic.js');
  return state.log[dateKey()]?.[k]?.tasks?.[t] ?? null;
}, [kid, taskId]);
const tokens = (page, kid) => page.evaluate(async (k) => (await import('./js/ctx.js')).state.kids.find((x) => x.id === k).tokens || {}, kid);
// what the family would be sent by the next save: snapshot before, plan after
const snap = (page) => page.evaluate(async () => {
  const { state } = await import('./js/ctx.js');
  const { splitState } = await import('./js/store.js');
  window.kqBefore = splitState(state);
});
// (the app's redraw also refreshes each kid's derived day summary, kid.daily, after any chore
// changes, as it does for every check-off; that is left out here, so the plan is the tap's own)
const plan = (page) => page.evaluate(async () => {
  const { state } = await import('./js/ctx.js');
  const { splitState, diffDocs, planWrites } = await import('./js/store.js');
  const after = splitState(state);
  const writes = JSON.parse(JSON.stringify(planWrites(diffDocs(window.kqBefore, after), window.kqBefore, after)));
  return writes
    .map((w) => (w.fields ? { ...w, fields: w.fields.filter(([f]) => !(w.path.startsWith('kids/') && ['daily', 'today'].includes(f[0]))) } : w))
    .filter((w) => !w.fields || w.fields.length);
});
const station = (page) => page.evaluate(async () => (await import('./js/station.js')).stationState());

try {
  // ---------- 1. desktop Chromium: no Web NFC ----------
  {
    const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
    const page = await open(ctx);
    await page.waitForSelector('[data-station-card="unsupported"]');
    assert.match(await page.locator('.station-card').innerText(), /can't read chore tokens/);
    assert.equal(await page.locator('.station-card button').count(), 0, 'nothing to press without NFC');
    await ctx.close();
  }

  // ---------- 2. a stand-in NDEFReader ----------
  const ctx = await browser.newContext({ viewport: PHONE, deviceScaleFactor: 2 });
  await ctx.addInitScript(() => {
    window.kq = { readers: [], scans: 0, aborted: 0, locks: 0, released: 0 };
    class FakeReader extends EventTarget {
      constructor() { super(); window.kq.readers.push(this); this.onreading = null; }
      async scan({ signal } = {}) {
        window.kq.scans += 1;
        this.signal = signal;
        signal?.addEventListener('abort', () => { window.kq.aborted += 1; });
      }
    }
    window.NDEFReader = FakeReader;
    window.kqTap = (serial) => {
      const r = window.kq.readers.find((x) => x.signal && !x.signal.aborted);
      if (!r) throw new Error('not reading');
      const ev = new Event('reading');
      ev.serialNumber = serial;
      ev.message = { records: [] };
      r.onreading?.(ev);
    };
    const query = navigator.permissions.query.bind(navigator.permissions);
    navigator.permissions.query = async (d) => (d.name === 'nfc' ? Object.assign(new EventTarget(), { state: 'granted', onchange: null }) : query(d));
    const sentinel = () => {
      const t = new EventTarget();
      t.release = async () => { window.kq.released += 1; t.dispatchEvent(new Event('release')); };
      return t;
    };
    Object.defineProperty(navigator, 'wakeLock', { value: { request: async () => { window.kq.locks += 1; return sentinel(); } } });
  });
  const page = await open(ctx);
  const tap = async (serial) => { await page.evaluate((x) => window.kqTap(x), serial); await page.waitForTimeout(50); };
  const wait = (ms) => page.clock.fastForward(ms);
  const A = '04:aa:01', B = '04:bb:02', C = '04:cc:03', D = '04:dd:04', X = '04:ff:99';

  // the card reads once the parent taps Check a token; an unlinked token says so
  await page.waitForSelector('[data-station-card="ready"]');
  assert.equal(await page.evaluate(() => window.kq.scans), 0, 'opening Settings reads nothing');
  await page.click('[data-action="station-read"]');
  await page.waitForSelector('[data-station-card="ready"] [data-station-reading]');
  assert.equal(await page.locator('.bs-link[data-task="t_piano"]').count(), 0, 'a timer chore takes no token');
  assert.equal(await page.locator('[data-action="station-start"][disabled]').count(), 1, 'Start waits for a linked token');
  await tap(X);
  assert.match(await page.locator('[data-station-last]').innerText(), /isn't linked/);

  // link Ava's bed: one field of Ava is sent
  await snap(page);
  await page.click('[data-action="station-link"][data-kid="kid_ava"][data-task="t_bed"]');
  await page.waitForSelector('[data-station-hold]');
  assert.match(await page.locator('[data-station-hold]').innerText(), /Ava's 🛏️ Make bed/);
  await tap(A);
  await page.waitForSelector('[data-station-last]:has-text("Linked")');
  assert.deepEqual(await tokens(page, 'kid_ava'), { [A]: { task: 't_bed', song: 60 } });
  assert.deepEqual(await plan(page), [{ path: 'kids/kid_ava', op: 'update', fields: [[['tokens', A], { task: 't_bed', song: 60 }]] }]);
  // teeth, then Ben's toys (a chore a parent checks) and Ben's bed; a token on the wrong chore moves
  await page.click('[data-action="station-link"][data-kid="kid_ava"][data-task="t_teeth"]');
  await tap(C);
  await page.click('[data-action="station-link"][data-kid="kid_ben"][data-task="t_toys"]');
  await tap(C);
  assert.match(await page.locator('[data-station-last]').innerText(), /moved from Ava's/);
  assert.deepEqual(Object.keys(await tokens(page, 'kid_ava')), [A]);
  await page.click('[data-action="station-link"][data-kid="kid_ben"][data-task="t_toys"]');
  await page.waitForTimeout(5100); // let the five-second rule pass for C (the clock runs on)
  await page.click('[data-action="station-link-cancel"]');
  await page.click('[data-action="station-link"][data-kid="kid_ava"][data-task="t_teeth"]');
  await tap(D);
  await page.click('[data-action="station-link"][data-kid="kid_ben"][data-task="t_toys"]');
  await tap(B);
  // Ben's toys: C and B both linked now; unlink both, link B alone
  await page.click('[data-action="station-unlink"][data-kid="kid_ben"][data-task="t_toys"]');
  assert.deepEqual(await tokens(page, 'kid_ben'), {});
  await page.click('[data-action="station-link"][data-kid="kid_ben"][data-task="t_toys"]');
  await tap(B);
  // Ava's sunday chore isn't on today's list: link the spare X to it
  await page.click('[data-action="station-link"][data-kid="kid_ava"][data-task="t_sun"]');
  await tap(X);
  // a linked token says what it is; the song length changes
  await page.waitForTimeout(5100);
  await tap(A);
  assert.match(await page.locator('[data-station-last]').innerText(), /Ava's 🛏️ Make bed \(1 min song\)/);
  await page.selectOption('[data-station-song][data-task="t_toys"]', '60');
  assert.equal((await tokens(page, 'kid_ben'))[B].song, 60);
  await page.screenshot({ path: `${out}/1-link-tokens.png`, fullPage: true });

  // ---------- the station ----------
  await page.click('[data-action="station-start"]');
  await page.waitForSelector('.screen.station.rest');
  assert.equal(await page.locator('[data-station-rest]').count(), 2, 'both buddies resting');
  await page.waitForFunction(() => window.kq.locks >= 1);
  let st = await station(page);
  assert.equal(st.reading, true);
  assert.equal(st.wake, true);
  assert.equal(await page.locator('.screen.station [data-action]:not([data-action="station-exit"])').count(), 0, 'nothing on the station opens another screen');
  await page.screenshot({ path: `${out}/2-at-rest.png` });

  // first tap: Ava's bed starts; only startedAt, only that chore's record
  await snap(page);
  await tap(A);
  await page.waitForSelector('[data-station-working="kid_ava"]');
  const bed = await rec(page, 'kid_ava', 't_bed');
  assert.deepEqual(Object.keys(bed), ['startedAt']);
  const p1 = await plan(page);
  assert.equal(p1.length, 1);
  assert.match(p1[0].path, /^days\/\d{4}-\d\d-\d\d_kid_ava$/);
  assert.equal(JSON.stringify(p1[0]).includes('t_teeth'), false);
  assert.deepEqual(p1[0].op === 'merge' ? Object.keys(p1[0].data.entry.tasks) : p1[0].fields.map(([f]) => f.join('.')), p1[0].op === 'merge' ? ['t_bed'] : ['entry.tasks.t_bed']);
  assert.match(await page.locator('[data-station-working="kid_ava"]').innerText(), /Make bed/);
  await page.screenshot({ path: `${out}/3-one-working.png` });

  // a token resting on the phone, read every second for a minute: nothing more
  for (let i = 0; i < 6; i += 1) { await wait(1000); await tap(A); }
  st = await station(page);
  assert.equal(st.playing.length, 1);
  assert.equal(st.party, null);
  assert.equal(st.msg, '', 'a resting token is not even a wave');
  assert.deepEqual(Object.keys(await rec(page, 'kid_ava', 't_bed')), ['startedAt']);

  // lifted, then a second tap too soon (under 20 s): a wave
  await wait(6000);
  await tap(A);
  assert.match((await station(page)).msg, /Keep going/);
  assert.equal((await rec(page, 'kid_ava', 't_bed')).status, undefined);

  // Ben starts toys (a chore a parent checks): two kids at once, Ava's song plays first
  await wait(6000);
  await tap(B);
  await page.waitForSelector('[data-station-working="kid_ben"]');
  assert.equal(await page.locator('.bs-big').count(), 2);
  assert.equal(await page.locator('.bs-big.lead').getAttribute('data-station-working'), 'kid_ava');
  // Ava taps teeth while her bed is in play: a wave and which token is in play
  await tap(D);
  assert.match((await station(page)).msg, /Ava, finish 🛏️ Make bed first/);
  await page.screenshot({ path: `${out}/4-two-working.png` });

  // Ava's 1-minute song ends: she hums and waits
  await wait(45_000);
  await page.waitForSelector('[data-station-working="kid_ava"].humming');
  assert.equal(await page.locator('.bs-big.lead').getAttribute('data-station-working'), 'kid_ben', 'Ben\'s song now');
  await page.screenshot({ path: `${out}/5-humming.png` });

  // second tap: Ava's bed done with a token, a dance
  await snap(page);
  await tap(A);
  const done = await rec(page, 'kid_ava', 't_bed');
  assert.equal(done.status, 'done');
  assert.equal(done.by, 'token');
  assert.ok(done.took >= 60_000 && done.took < 90_000, `took ${done.took}`);
  const p2 = await plan(page);
  assert.equal(p2.length, 1);
  assert.deepEqual(p2[0].fields.map(([f]) => f.join('.')), ['entry.tasks.t_bed']);
  st = await station(page);
  assert.equal(st.party.kidId, 'kid_ava');
  assert.equal(st.party.flourish, false, 'the song had ended: no extra flourish');
  await page.waitForSelector('[data-station-party="kid_ava"]');
  assert.match(await page.locator('[data-station-party]').innerText(), /done!/);
  await page.screenshot({ path: `${out}/6-celebrate.png` });
  await wait(5500);
  await page.waitForSelector('[data-station-party]', { state: 'detached' });

  // Ben's second tap, while his song still plays: waiting for a parent, with a flourish
  await tap(B);
  const toys = await rec(page, 'kid_ben', 't_toys');
  assert.equal(toys.status, 'pending');
  assert.equal(toys.by, 'token');
  assert.equal((await station(page)).party.flourish, true);
  assert.match(await page.locator('[data-station-party]').innerText(), /a parent will check it/);
  await wait(5500);

  // done, not today and unlinked tokens: waves and a puzzled look, nothing saved
  await wait(6000);
  await tap(A);
  assert.match((await station(page)).msg, /already done/);
  await tap(X);
  assert.match((await station(page)).msg, /isn't on today's list/);
  await tap('04:00:00');
  assert.match((await station(page)).msg, /isn't linked yet/);
  assert.equal(await rec(page, 'kid_ava', 't_sun'), null);

  // Ava starts teeth: in play when a parent looks
  await tap(D);
  await page.waitForSelector('[data-station-working="kid_ava"]');

  // leaving takes the PIN; Cancel keeps the station
  await page.click('[data-action="station-exit"]');
  await page.click('#modal [data-pin="cancel"]');
  assert.equal((await station(page)).open, true);
  await page.click('[data-action="station-exit"]');
  for (const d of '9999') await page.click(`#modal [data-pin="${d}"]`);
  assert.equal((await station(page)).open, true, 'a wrong PIN keeps the station');
  await page.click('#modal [data-pin="cancel"]');
  await page.click('[data-action="station-exit"]');
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.waitForSelector('.screen.parent');
  st = await station(page);
  assert.equal(st.open, false);
  assert.equal(st.wake, false);
  await page.waitForFunction(() => window.kq.released >= 1);

  // the parents' Today view
  await page.click('[data-action="tab"][data-tab="today"]');
  const ben = page.locator('.kc[data-kid="kid_ben"]');
  assert.match(await ben.locator('.pr.wait').innerText(), /Done with a token · took \d+ s/);
  await page.click('.kc[data-kid="kid_ava"] [data-action="today-kid"]');
  const ava = page.locator('.kc[data-kid="kid_ava"]');
  assert.match(await ava.innerText(), /Started at .* with a token/);
  await page.click('.kc[data-kid="kid_ava"] [data-action="today-show-done"]');
  assert.match(await ava.locator('.pr.done').innerText(), /Done with a token · took 1 min/);
  // approving keeps how long it took
  await ben.locator('[data-action="approve"]').click();
  await page.click('.kc[data-kid="kid_ben"] [data-action="today-kid"]');
  await page.click('.kc[data-kid="kid_ben"] [data-action="today-show-done"]');
  assert.match(await ben.locator('.pr.done').innerText(), /Done with a token · took \d+ s · approved/);
  await page.screenshot({ path: `${out}/7-parents-today.png`, fullPage: true });

  // back to the station: Ava's teeth is still in play (from its record); the next day drops it
  await page.click('[data-action="tab"][data-tab="settings"]');
  await page.click('[data-action="station-start"]');
  await page.waitForSelector('[data-station-working="kid_ava"]');
  await wait(17 * 3600_000);
  await page.waitForSelector('.screen.station.rest');
  assert.equal((await station(page)).playing.length, 0, 'a new day drops the chore in play');
  await ctx.close();
} finally {
  await browser.close();
  await site.close();
}
assert.deepEqual(errors, []);
console.log('buddy station ok');
