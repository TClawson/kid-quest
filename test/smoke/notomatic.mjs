// The Note-o-Matic in the real app (js/studio.js, js/listener-worker.js): on the parent's test
// desk, a take of piano notes (C4 E4 G4 C5, one a beat, made here as decaying overtones with a
// little noise) is turned into notes. The tablet listens in a Worker with a progress bar, then
// offers three readings; each one's Listen button plays it and stops it, over the mix too. The
// tidied reading becomes a notes clip with those four notes in order, which takes a voice and
// goes higher; Undo brings the take back with its sound, and a sweep of the tablet's takes
// keeps it while Undo can. The same take opens again without listening again. The band
// version puts a band on another track, which plays under the tune in the mix. A reload keeps the notes clips. A silent take says
// so kindly; Stop during the listening stops it. A browser without module Workers listens on
// the page itself. Then a phone. Saves screenshots.
// Run: node test/smoke/notomatic.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/note-o-matic').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream'] });
const errors = [];
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const DESK = 'parent-test';

/** A family with one kid, and the parent's PIN. */
function family() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: '2026-01-05', seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  return s;
}

/** A new tablet with the family on it, counting the sounds started. `noWorker`: a browser without module Workers. */
async function start(viewport, { noWorker = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript((noWorker) => {
    if (noWorker) window.Worker = function Worker() { throw new Error('no module workers here'); };
    window.kqStarts = 0;
    const P = AudioBufferSourceNode.prototype;
    const s = P.start;
    window.kqPeaks = []; // each sound started: [seconds long, its loudest sample]
    P.start = function (...a) {
      window.kqStarts += 1;
      if (this.buffer) { const d = this.buffer.getChannelData(0); let m = 0; for (let i = 0; i < d.length; i += 1) m = Math.max(m, Math.abs(d[i])); window.kqPeaks.push([this.buffer.duration, m]); }
      return s.apply(this, a);
    };
  }, noWorker);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family());
  await page.reload();
  return { ctx, page };
}

/**
 * Put takes on the test desk's draft, made in the page: [{ track, at, beats, notes: [midi, at (beats)] | 'silent' (a quiet room, no piano) }].
 * Each note is 6 decaying overtones with a fast attack, about 0.4 s long, at 48 kHz, with a
 * little noise. Returns the take ids.
 */
function seedDesk(page, takes, bpm = 120) {
  return page.evaluate(async ({ takes, bpm, desk }) => {
    const { saveTake, saveMix } = await import('./js/studio-store.js');
    const { newMix, addTake, trimClip } = await import('./js/studiorules.js');
    const rate = 48000;
    const lead = 0.06;
    const beat = 60 / bpm;
    let seed = 7;
    const noise = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647 - 0.5; };
    let mix = { ...newMix(), bpm };
    const ids = [];
    for (const t of takes) {
      const out = new Float32Array(Math.ceil((lead + t.beats * beat) * rate));
      for (const [midi, at] of t.notes === 'silent' ? [] : t.notes) {
        const f = 440 * 2 ** ((midi - 69) / 12);
        const from = Math.round((lead + at * beat) * rate);
        for (let i = 0; i < 0.7 * rate && from + i < out.length; i += 1) {
          const s = i / rate;
          const env = Math.min(1, s / 0.004) * Math.exp(-s / 0.24) * (s < 0.4 ? 1 : Math.exp(-(s - 0.4) / 0.05));
          let v = 0;
          for (let h = 1; h <= 6; h += 1) v += Math.sin(2 * Math.PI * f * h * s) * (0.6 / h ** 1.2) * Math.exp(-s * h * 0.8);
          out[from + i] += 0.25 * env * v;
        }
      }
      // every take has a little hiss; the silent one is a quiet room (a low rumble, which is what real rooms sound like)
      let low = 0;
      for (let i = 0; i < out.length; i += 1) {
        const w = noise();
        low = 0.98 * low + w;
        out[i] += t.notes === 'silent' ? 0.002 * low + 0.0002 * w : 0.003 * w;
      }
      const id = await saveTake(desk, out, rate, lead);
      ids.push(id);
      const added = addTake(mix, t.track, id, t.beats, t.at, { lead });
      mix = added.mix;
      if (t.trim) mix = trimClip(mix, added.id, t.trim).mix; // { start } trims its front
    }
    await saveMix(desk, 'draft', mix);
    return ids;
  }, { takes, bpm, desk: DESK });
}

/** From the start screen into Settings with the PIN, and on to the test desk. */
async function openDesk(page) {
  await page.click('[data-action="parent"]');
  for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
  await page.waitForSelector('.tabs');
  await page.click('[data-action="tab"][data-tab="settings"]');
  await page.click('[data-action="studio-test"]');
  await page.waitForSelector('#studio .st-bar');
  await page.waitForFunction(() => document.querySelectorAll('#studio .st-clip').length > 0);
  // the studio's module, for the checks below (waitForFunction needs answers at once, not promises)
  await page.evaluate(async () => { window.kqStudio = await import('./js/studio.js'); });
}

/** Wait until `fn` (in Node, may be async) answers true: every 50 ms, for `ms` at most. */
async function until(fn, what, ms = 20000) {
  for (const end = Date.now() + ms; Date.now() < end;) {
    if (await fn()) return;
    await new Promise((r) => { setTimeout(r, 50); });
  }
  throw new Error(`timed out waiting for ${what}`);
}
const playing = (page) => page.waitForFunction(() => window.kqStudio.studioSound().playing, null, { timeout: 20000 });

const clip = (page, t, n = 0) => page.locator(`#studio .st-lane[data-track="${t}"] .st-clip`).nth(n);
const sound = (page) => page.evaluate(() => window.kqStudio.studioSound());
const nom = (page) => page.evaluate(() => window.kqStudio.studioNotes());
/** The desk's draft as kept on the tablet (read back through cleanMix). */
const draft = (page) => page.evaluate(async (desk) => (await (await import('./js/studio-store.js')).loadMixes(desk)).draft, DESK);
const takeRows = (page) => page.evaluate(() => new Promise((resolve) => {
  const req = indexedDB.open('kidquest-studio', 1);
  req.onsuccess = () => {
    const ids = [];
    const tx = req.result.transaction('takes', 'readonly');
    tx.objectStore('takes').openCursor().onsuccess = (e) => { const c = e.target.result; if (c) { ids.push(c.key); c.continue(); } };
    tx.oncomplete = () => { req.result.close(); resolve(ids); };
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
const tooSmall = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => { const r = el.getBoundingClientRect(); return [el.textContent.trim(), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), sel);
/** Wait until the studio's sound matches: a reading being heard (with its sound playing) or nothing heard. */
async function hearing(page, key) {
  await page.waitForFunction((key) => {
    const s = window.kqStudio.studioSound();
    const h = window.kqStudio.studioHearing();
    return key ? h === key && s.sounds > 0 : h === '' && s.sounds === 0;
  }, key, { timeout: 20000, polling: 50 });
}
const shot = async (page, name, loc = null) => {
  if (loc) await loc.evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/${name}.png` });
};

const FOUR = [[60, 0], [64, 1], [67, 2], [72, 3]];
// a longer tune for Stop (the listening takes a while)
const LONG = Array.from({ length: 40 }, (_, i) => [[60, 62, 64, 65, 67, 65, 64, 62][i % 8] + (i % 16 >= 8 ? 12 : 0), i]);

// 1. tablet: listen, three readings, Use it, remix it, Undo, the band version, a reload
{
  const { ctx, page } = await start(TABLET);
  const [four] = await seedDesk(page, [{ track: 0, at: 0, beats: 5, notes: FOUR }, { track: 1, at: 8, beats: 4, notes: 'silent' }, { track: 2, at: 0, beats: 40, notes: LONG }]);
  await openDesk(page);
  assert.equal(await page.locator('#studio .st-clip.kind-take').count(), 3);

  // a take has the button, with the other tools
  await clip(page, 0).click();
  const button = page.locator('#studio .st-tools [data-action="st-nom"]');
  assert.equal(await button.textContent(), '🎹 Turn it into notes');
  assert.equal(await page.locator('#studio .st-tools [data-action="st-copy"]').count(), 1, 'the other tools stay');
  await button.click();
  await page.waitForSelector('#studio .st-nom');
  assert.match(await page.locator('#studio .st-nom').textContent(), /Listening to your take…|As I heard it/);
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  assert.equal(await page.locator('#studio .st-tools').count(), 0, 'the panel takes the tools\' place');

  // three readings, Tidied picked, the key
  assert.deepEqual(await page.locator('#studio .st-reading').evaluateAll((els) => els.map((el) => el.dataset.reading)), ['heard', 'tidy', 'band']);
  assert.deepEqual(await page.locator('#studio .st-reading-pick b').allTextContents(), ['As I heard it', 'Tidied', 'Band version']);
  assert.equal(await page.locator('#studio .st-reading.on').getAttribute('data-reading'), 'tidy');
  assert.equal(await page.locator('#studio .st-reading.off').count(), 0, 'four notes are enough for a band');
  assert.equal(await page.locator('#studio .st-nom-key').textContent(), 'Sounds like it is in C major.');
  assert.equal(await page.locator('#studio .st-nom-use').textContent(), '✓ Use it');
  assert.equal(await page.locator('#studio .st-nom [data-action="st-nom-close"]').textContent(), 'Keep my recording');
  await shot(page, 'readings-tablet', page.locator('#studio .st-nom'));

  // each Listen plays its reading and stops it; another card stops the one playing
  for (const id of ['heard', 'tidy', 'band']) {
    const listen = page.locator(`#studio .st-reading[data-reading="${id}"] [data-action="st-nom-hear"]`);
    assert.equal((await listen.textContent()).trim(), '▶ Listen');
    await listen.click();
    await hearing(page, `nom|${id}`);
    assert.equal((await listen.textContent()).trim(), '■ Stop');
    assert.equal(await page.locator('#studio .st-reading.on').getAttribute('data-reading'), id, 'listening picks it');
    await listen.click();
    await hearing(page, '');
  }
  await page.click('#studio .st-reading[data-reading="heard"] [data-action="st-nom-hear"]');
  await hearing(page, 'nom|heard');
  await page.click('#studio .st-reading[data-reading="tidy"] [data-action="st-nom-hear"]');
  await hearing(page, 'nom|tidy');
  await page.click('#studio .st-reading[data-reading="heard"] .st-reading-pick');
  await hearing(page, '');
  // never over the mix: the mix stops first
  await page.click('[data-action="st-play"]');
  await playing(page);
  await page.click('#studio .st-reading[data-reading="band"] [data-action="st-nom-hear"]');
  await hearing(page, 'nom|band');
  assert.equal((await sound(page)).playing, false, 'the mix stopped');
  // closing the panel stops it too
  await page.click('#studio .st-nom [data-action="st-nom-close"]');
  await hearing(page, '');
  assert.equal(await page.locator('#studio .st-nom').count(), 0);
  assert.equal(await page.locator('#studio .st-clip.kind-take').count(), 3, 'Keep my recording changes nothing');

  // what was heard is remembered: no listening the second time
  await page.click('#studio .st-tools [data-action="st-nom"]');
  assert.equal((await nom(page)).phase, 'pick');
  assert.equal(await page.locator('#studio .st-progress').count(), 0);

  // Tidied: the take becomes notes
  await page.click('#studio .st-reading[data-reading="tidy"] .st-reading-pick');
  await page.click('#studio .st-nom-use');
  assert.equal(await page.locator('#studio .st-nom').count(), 0);
  assert.equal(await page.locator('#studio .st-note span').textContent(), 'Your take became notes. Pick a voice for it, or tap Undo to get your recording back. 🏅 New sticker: Note-o-Matic! You turned your playing into notes.');
  const notes = clip(page, 0);
  assert.match(await notes.getAttribute('class'), /kind-notes role-tune.*sel/);
  assert.match(await notes.textContent(), /🎹 My notes.*C major/s);
  assert.equal(await page.locator('.st-sticker[data-sticker="notes"]').count(), 1, 'the Note-o-Matic sticker');
  assert.match(await page.locator('#studio .st-what').textContent(), /🎹 My notes, in C major/);
  for (const a of ['[data-action="st-chooser"][data-what="voice"]', '[data-action="st-shift"][data-d="12"]', '[data-action="st-shift"][data-d="-12"]']) {
    assert.equal(await page.locator(`#studio .st-tools ${a}`).count(), 1, a);
  }
  assert.equal(await page.locator('.st-step.locked').count(), 1, 'the speed is kept for the other takes still');
  await shot(page, 'notes-clip-tablet', page.locator('#studio .st-desk'));
  await until(async () => (await draft(page))?.tracks[0][0]?.kind === 'notes', 'the draft to be saved');
  const kept = (await draft(page)).tracks[0][0];
  assert.equal(kept.role, 'tune');
  assert.equal(kept.key, 'C');
  const firstAt = (midi) => kept.notes.find((n) => n.midi === midi)?.at;
  const ats = [60, 64, 67, 72].map(firstAt);
  assert.ok(ats.every((a) => a !== undefined), `the four notes: ${JSON.stringify(kept.notes)}`);
  assert.ok(ats.every((a, i) => i === 0 || a > ats[i - 1]), `in order: ${ats}`);
  assert.equal(kept.notes.length, 4, `nothing else: ${JSON.stringify(kept.notes)}`);
  assert.deepEqual(ats, [0, 2, 4, 6], 'one a beat, on the beat');

  // the take is only in Undo's memory now: a sweep of the tablet keeps it
  await ageTakes(page);
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  await page.click('[data-action="st-slot-save"][data-slot="0"]');
  await page.waitForFunction(() => /Saved!/.test(document.querySelector('.toast')?.textContent || ''));
  await page.click('[data-action="st-panel"][data-panel="mixes"]');
  await page.waitForTimeout(500);
  assert.ok((await takeRows(page)).includes(four), 'the take Undo can bring back is kept');

  // a voice, higher, played
  await notes.click();
  if (!await page.locator('#studio .st-tools').count()) await notes.click();
  await page.click('#studio [data-action="st-chooser"][data-what="voice"]');
  await page.click('#studio [data-action="st-voice"][data-voice="flute"]');
  assert.equal(await clip(page, 0).getAttribute('data-voice'), 'flute');
  assert.match(await page.locator('#studio .st-said').textContent(), /Now it plays as Flute/);
  await page.click('#studio [data-action="st-shift"][data-d="12"]');
  const shift = Number(await clip(page, 0).getAttribute('data-shift'));
  assert.ok(shift >= 12, `higher: ${shift}`);
  await page.click('[data-action="st-play"]');
  await playing(page);
  await page.click('[data-action="st-play"]');

  // Undo: back to the take, with its sound
  for (let i = 0; i < 3; i += 1) await page.click('[data-action="st-undo"]');
  const back = clip(page, 0);
  assert.match(await back.getAttribute('class'), /kind-take/);
  assert.doesNotMatch(await back.getAttribute('class'), /gone/);
  assert.equal(await back.locator('.st-wave').count(), 1, 'its picture: the sound is there');
  await page.click('[data-action="st-play"]');
  await playing(page);
  assert.doesNotMatch(await page.locator('#studio').textContent(), /missing/, 'nothing is missing');
  await page.click('[data-action="st-play"]');

  // the band version: the tune where the take was, a band on the track with the most room
  await back.click();
  if (!await page.locator('#studio .st-tools [data-action="st-nom"]').count()) await back.click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  assert.equal((await nom(page)).phase, 'pick', 'remembered after Undo too');
  await page.click('#studio .st-reading[data-reading="band"] .st-reading-pick');
  await page.click('#studio .st-nom-use');
  assert.match(await clip(page, 0).getAttribute('class'), /kind-notes role-tune/);
  assert.equal(await clip(page, 0).getAttribute('data-voice'), 'beep');
  const band = clip(page, 3);
  assert.match(await band.getAttribute('class'), /kind-notes role-band/);
  assert.equal(await band.getAttribute('data-voice'), 'organ');
  assert.match(await band.textContent(), /🎺 My band/);
  assert.equal(await page.locator('.st-sticker[data-sticker="leader"]').count(), 1, 'the Band leader sticker');
  assert.match(await page.locator('#studio .st-note').textContent(), /^Your take became notes\./);
  // the band version's voices are the clips' own sound: no Remixer for them
  const said = await page.locator('#studio .st-note').textContent();
  assert.doesNotMatch(said, /Remixer/, said);
  assert.match(said, /New sticker: Note-o-Matic!/);
  assert.equal(await page.locator('.st-sticker[data-sticker="remixer"]').count(), 0, 'no Remixer by itself');
  assert.equal(await page.locator('#studio .st-clip .st-vicon').count(), 0, 'no voice icon of the kid\'s choosing');
  assert.match(await page.locator('#studio .st-what small').textContent(), /· 🟩 Beep/, 'the tools say what it plays in');
  await page.click('#studio [data-action="st-chooser"][data-what="voice"]');
  const ownChoice = page.locator('#studio [data-action="st-voice"][data-voice=""]');
  assert.equal(await ownChoice.getAttribute('aria-pressed'), 'true', 'its own sound is the pressed choice');
  assert.match(await ownChoice.textContent(), /🟩Its own sound/);
  assert.equal(await page.locator('#studio [data-action="st-voice"][data-voice="beep"]').getAttribute('aria-pressed'), 'false');
  // the kid's own pick earns it; back to its own sound takes it away
  await page.click('#studio [data-action="st-voice"][data-voice="strings"]');
  assert.equal(await clip(page, 0).getAttribute('data-voice'), 'strings');
  assert.equal(await page.locator('.st-sticker[data-sticker="remixer"]').count(), 1);
  assert.equal(await clip(page, 0).locator('.st-vicon').count(), 1);
  await page.click('#studio [data-action="st-voice"][data-voice=""]');
  assert.equal(await clip(page, 0).getAttribute('data-voice'), 'beep');
  assert.match(await page.locator('#studio .st-said').textContent(), /Back to its own sound/);
  assert.equal(await page.locator('.st-sticker[data-sticker="remixer"]').count(), 0);
  await page.click('#studio [data-action="st-chooser"][data-what="voice"]');
  await page.click('[data-action="st-play"]');
  await playing(page);
  await page.click('[data-action="st-play"]');
  await shot(page, 'band-tablet', page.locator('#studio .st-desk'));

  // a silent take: said kindly
  await clip(page, 1).click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-nom-nothing', { timeout: 30000 });
  assert.equal(await page.locator('#studio .st-nom-nothing').textContent(), 'I couldn\'t hear piano notes in that take. Try again with the tablet close to the piano.');
  await shot(page, 'nothing-heard-tablet', page.locator('#studio .st-nom'));
  await page.click('#studio .st-nom [data-action="st-nom-close"]');
  assert.equal(await page.locator('#studio .st-nom').count(), 0);

  // Stop while listening
  await clip(page, 2).click();
  if (!await page.locator('#studio .st-tools [data-action="st-nom"]').count()) await clip(page, 2).click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-progress');
  const busy = await nom(page);
  assert.deepEqual([busy.phase, busy.worker], ['listen', true], 'listening in a Worker');
  await page.waitForFunction(() => Number(document.querySelector('#studio .st-progress')?.getAttribute('aria-valuenow')) > 0, null, { timeout: 30000 });
  await shot(page, 'listening-tablet', page.locator('#studio .st-nom'));
  await page.click('#studio .st-nom [data-action="st-nom-close"]');
  assert.equal(await nom(page), null);
  assert.equal(await page.locator('#studio .st-nom').count(), 0);
  // again, and this time to the end: not remembered, since it never finished
  await page.click('#studio .st-tools [data-action="st-nom"]');
  assert.equal((await nom(page)).phase, 'listen');
  await page.waitForSelector('#studio .st-reading', { timeout: 120000 });
  assert.equal(await page.locator('#studio .st-reading.off').count(), 0);
  await page.click('#studio .st-nom [data-action="st-nom-close"]');

  // a reload keeps the notes clips
  await page.waitForTimeout(800);
  await page.reload();
  await openDesk(page);
  assert.match(await clip(page, 0).getAttribute('class'), /kind-notes role-tune/);
  assert.equal(await clip(page, 0).getAttribute('data-voice'), 'beep');
  assert.match(await clip(page, 3).getAttribute('class'), /kind-notes role-band/);
  assert.equal(await page.locator('.st-sticker[data-sticker="leader"]').count(), 1);
  assert.ok(await noSideScroll(page));
  await ctx.close();
}

// 2. the panel belongs to the take it was opened on, as it was
{
  const { ctx, page } = await start(TABLET);
  // a kid at their own speed (a note every 0.8 s; the mix's beat is 0.5 s): C D E F G A B C,
  // the take trimmed to start at beat 6, so the first note kept is the G
  const OWN = [60, 62, 64, 65, 67, 69, 71, 72].map((midi, i) => [midi, (0.3 + 0.8 * i) / 0.5]);
  await seedDesk(page, [
    { track: 0, at: 0, beats: 5, notes: FOUR }, { track: 1, at: 0, beats: 40, notes: LONG },
    { track: 2, at: 0, beats: 14, notes: OWN, trim: { start: 6 } },
  ]);
  await openDesk(page);
  const panelGone = async (why) => {
    assert.equal(await nom(page), null, `${why}: the panel closed`);
    assert.equal(await page.locator('#studio .st-nom').count(), 0, why);
    assert.doesNotMatch(await page.locator('#studio').textContent(), /couldn't hear piano notes/, `${why}: never "couldn't hear"`);
  };
  const pick = async (loc) => { await loc.click(); if (!await page.locator('#studio .st-tools [data-action="st-nom"]').count()) await loc.click(); };
  const byId = (id) => page.locator(`#studio .st-clip[data-id="${id}"]`);

  // Undo while listening to a copy: the copy is gone, and so is the panel (quietly)
  await pick(byId(2));
  await page.click('#studio .st-tools [data-action="st-copy"]');
  const copy = await page.locator('#studio .st-clip.sel').getAttribute('data-id');
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-progress');
  assert.equal((await nom(page)).worker, true);
  await page.click('[data-action="st-undo"]');
  await panelGone('Undo while listening');
  assert.equal(await byId(copy).count(), 0);
  await page.waitForTimeout(1500); // (a Worker that went on would answer by now)
  await panelGone('a moment later');

  // the readings open on a copy, then Undo: closed, so Use it can't reach another clip
  await pick(byId(1));
  await page.click('#studio .st-tools [data-action="st-copy"]');
  const copy2 = await page.locator('#studio .st-clip.sel').getAttribute('data-id');
  assert.equal(copy2, copy, 'the copy gets the same clip id again');
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  await page.click('[data-action="st-undo"]');
  await panelGone('Undo with the readings open');
  await page.click('[data-action="st-redo"]');
  assert.equal(await page.locator('#studio .st-nom').count(), 0, 'Redo doesn\'t bring the panel back');

  // another clip picked while the panel is open: it closes, and that clip's tools show
  await pick(byId(1));
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  await byId(2).click();
  await panelGone('another clip picked');
  assert.equal(await page.locator('#studio .st-clip.sel').getAttribute('data-id'), '2');
  assert.equal(await page.locator('#studio .st-tools [data-action="st-nom"]').count(), 1, 'its own tools');
  assert.equal(await byId(1).getAttribute('class').then((c) => /kind-take/.test(c)), true, 'the first take is still a take');

  // trimmed while the panel is open (an Undo of a trim): closed, the readings were for the old trim
  await page.click('#studio .st-tools [data-action="st-nudge"][data-do="shorter"]');
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-nom');
  await page.click('[data-action="st-undo"]');
  await panelGone('the take trimmed back');

  // Record closes the panel
  await pick(byId(1));
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  await page.locator('#studio .st-lane[data-track="3"]').click({ position: { x: 10, y: 20 } });
  if (await page.locator('#studio .st-nom').count()) await page.click('[data-action="st-rec"]');
  await panelGone('Record');
  await page.waitForFunction(() => !document.querySelector('[data-action="st-rec"]').disabled, null, { timeout: 20000 });
  if (await page.evaluate(() => window.kqStudio.studioSound().recording)) await page.click('[data-action="st-rec"]');

  // a front-trimmed take at the kid's own speed: the notes are made from what was kept
  await page.waitForFunction(() => !window.kqStudio.studioSound().recording && !document.querySelector('[data-action="st-rec"]').disabled, null, { timeout: 20000 });
  const trimmed = page.locator('#studio .st-lane[data-track="2"] .st-clip');
  await pick(trimmed);
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  assert.match(await page.locator('#studio .st-nom-key').textContent(), /You played at your own speed/);
  await page.click('#studio .st-reading[data-reading="tidy"] .st-reading-pick');
  await page.click('#studio .st-nom-use');
  const made = page.locator('#studio .st-lane[data-track="2"] .st-clip');
  assert.match(await made.getAttribute('class'), /kind-notes/);
  await until(async () => (await draft(page))?.tracks[2][0]?.kind === 'notes', 'the draft to be saved');
  const c = (await draft(page)).tracks[2][0];
  const byTime = [...c.notes].sort((a, b) => a.at - b.at);
  assert.equal(c.from, 0, 'from its own start');
  assert.equal(c.start, 6, 'on the kept beat');
  assert.equal(byTime[0].midi, 67, `starts with the first kept note: ${JSON.stringify(byTime)}`);
  assert.ok(byTime.every((n) => n.midi >= 67), `nothing trimmed off: ${byTime.map((n) => n.midi)}`);
  assert.ok(byTime[0].at <= 2, `a beat in, where it was played: ${byTime[0].at}`);
  await ctx.close();
}

// 2b. a stored notes clip that claims to be 20000 beats long opens and plays as at most a loop
{
  const { ctx, page } = await start(TABLET);
  await page.evaluate(async (desk) => {
    const { saveMix } = await import('./js/studio-store.js');
    const { newMix } = await import('./js/studiorules.js');
    const mix = { ...newMix(), bpm: 120, tracks: [[{ id: 1, kind: 'notes', nid: 'nX', role: 'tune', start: 0, len: 4, from: 0, total: 20000, notes: [{ at: 0, len: 2, midi: 60 }, { at: 2, len: 1e9, midi: 64 }] }], [], [], []], next: 2 };
    await saveMix(desk, 'draft', mix);
  }, DESK);
  await openDesk(page);
  await page.click('[data-action="st-play"]');
  await playing(page);
  await page.click('[data-action="st-play"]');
  assert.equal((await draft(page)).tracks[0][0].total, 84);
  await ctx.close();
}

// 2c. in the mix a band part plays well under its tune (the same notes in the same voice, one clip of each role)
{
  const { ctx, page } = await start(TABLET);
  await page.evaluate(async (desk) => {
    const { saveMix } = await import('./js/studio-store.js');
    const { newMix } = await import('./js/studiorules.js');
    const notes = [{ at: 0, len: 1.8, midi: 60 }, { at: 2, len: 1.8, midi: 64 }, { at: 4, len: 1.8, midi: 67 }, { at: 6, len: 1.8, midi: 72 }];
    // (the tune is 4 beats long and the band 6, so their sounds can be told apart)
    const clip = (id, role, beats) => ({ id, kind: 'notes', nid: `n${id}`, role, start: 0, len: beats, from: 0, total: beats, own: 'organ', notes });
    await saveMix(desk, 'draft', { ...newMix(), bpm: 120, bars: 2, tracks: [[clip(1, 'tune', 4)], [clip(2, 'band', 6)], [], []], next: 3 });
  }, DESK);
  await openDesk(page);
  await page.evaluate(() => { window.kqPeaks.length = 0; });
  await page.click('[data-action="st-play"]');
  await page.waitForFunction(() => window.kqPeaks.length >= 2, null, { timeout: 20000 });
  const peaks = await page.evaluate(() => window.kqPeaks);
  await page.click('[data-action="st-play"]');
  const tune = peaks.find(([d]) => d < 2.6); const band = peaks.find(([d]) => d > 2.6);
  assert.ok(tune && band, `both clips sound: ${JSON.stringify(peaks)}`);
  assert.ok(band[1] > 0.25 * tune[1] && band[1] < 0.6 * tune[1], `the band part sits under the tune: band ${band[1]}, tune ${tune[1]}`);
  await ctx.close();
}

// 3. a browser without module Workers listens on the page itself
{
  const { ctx, page } = await start(TABLET, { noWorker: true });
  await seedDesk(page, [{ track: 0, at: 0, beats: 5, notes: FOUR }]);
  await openDesk(page);
  await clip(page, 0).click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  assert.equal(await page.locator('#studio .st-nom-key').textContent(), 'Sounds like it is in C major.');
  await ctx.close();
}

// 4. phone: the panel fits, its buttons are big enough
{
  const { ctx, page } = await start(PHONE);
  await seedDesk(page, [{ track: 0, at: 0, beats: 5, notes: FOUR }, { track: 2, at: 0, beats: 40, notes: LONG }]);
  await openDesk(page);
  await clip(page, 2).click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForFunction(() => Number(document.querySelector('#studio .st-progress')?.getAttribute('aria-valuenow')) > 0, null, { timeout: 30000 });
  assert.ok(await noSideScroll(page));
  await shot(page, 'listening-phone', page.locator('#studio .st-nom'));
  await page.click('#studio .st-nom [data-action="st-nom-close"]');
  await clip(page, 0).click();
  await page.click('#studio .st-tools [data-action="st-nom"]');
  await page.waitForSelector('#studio .st-reading', { timeout: 60000 });
  assert.ok(await noSideScroll(page), 'the readings fit a phone');
  assert.deepEqual(await tooSmall(page, '#studio .st-nom .btn, #studio .st-reading-pick'), []);
  await shot(page, 'readings-phone', page.locator('#studio .st-nom'));
  await page.click('#studio .st-reading[data-reading="band"] .st-reading-pick');
  await page.click('#studio .st-nom-use');
  assert.match(await clip(page, 0).getAttribute('class'), /kind-notes/);
  assert.ok(await noSideScroll(page));
  await shot(page, 'band-phone', page.locator('#studio .st-desk'));
  await page.locator('#studio .st-tools').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.screenshot({ path: `${out}/notes-tools-phone.png` });
  assert.deepEqual(await tooSmall(page, '#studio .st-tools .btn'), []);
  await ctx.close();
}

await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`notomatic ok: ${out}`);
