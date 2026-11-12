// Settings › Save a test recording (js/testrec.js) in the real app, with Chrome's fake
// microphone: the card sits right after the piano listening test, behind the PIN; a recording
// shows its seconds and a loudness bar, and Stop saves a download named after the label that
// is a plain mono 16-bit WAV at the sound clock's sample rate, about as long as the recording
// and not silent; "Save it again" downloads the same bytes; a recording stops by itself at the
// limit (made short here); leaving Settings, putting the app away or a refused microphone
// stops it with the microphone let go; nothing is played, and nothing is kept in the game.
// Saves screenshots (recording.png, saved.png).
// Run: node test/smoke/testrec.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, dateKey } from '../../js/logic.js';

const out = (process.argv[2] || 'previews/testrec').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const TABLET = { width: 1280, height: 800 };

const s = emptyState();
s.settings.pinHash = fallbackHash('kidquest:1234');
s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: dateKey(), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });

const site = await serve('.');
const browser = await chromium.launch({ args: ['--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', '--autoplay-policy=no-user-gesture-required'] });
const errors = [];
const ctx = await browser.newContext({ viewport: TABLET, deviceScaleFactor: 2, acceptDownloads: true });
await ctx.grantPermissions(['microphone']);
await ctx.addInitScript(() => {
  // every sound clock, every microphone opened, every sound played
  window.kqACs = [];
  const AC = window.AudioContext;
  window.AudioContext = function (...a) { const ac = new AC(...a); window.kqACs.push(ac); return ac; };
  window.AudioContext.prototype = AC.prototype;
  window.kqStreams = [];
  window.kqRefuse = false;
  const md = navigator.mediaDevices;
  const gum = md.getUserMedia.bind(md);
  md.getUserMedia = async (c) => {
    window.kqAsked = c;
    if (window.kqRefuse) throw new DOMException('no', 'NotAllowedError');
    const st = await gum(c);
    window.kqStreams.push(st);
    return st;
  };
  window.kqPlayed = 0;
  for (const P of [AudioBufferSourceNode.prototype, OscillatorNode.prototype]) {
    const start = P.start;
    P.start = function (...a) { window.kqPlayed += 1; return start.apply(this, a); };
  }
});
const page = await ctx.newPage();
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
await page.goto(site.url);
await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
await page.reload();

const card = page.locator('.card.rec-test');
const button = card.locator('[data-rec="go"]');
const micsOpen = () => page.evaluate(() => window.kqStreams.flatMap((st) => st.getTracks()).filter((t) => t.readyState !== 'ended').length);
const lastRate = () => page.evaluate(() => window.kqACs[window.kqACs.length - 1].sampleRate);
/** What the game keeps: localStorage and the IndexedDB databases (the studio's among them; not the sign-in code's, which Settings loads). */
const kept = () => page.evaluate(async () => JSON.stringify([Object.entries(localStorage).sort(), (await indexedDB.databases()).map((d) => d.name).filter((n) => !n.startsWith('firebase')).sort()]));
/** The WAV's header and sound: { riff, wave, format, channels, rate, byteRate, align, bits, samples (Int16Array) }. */
function readWav(buf) {
  const v = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);
  const text = (at) => buf.subarray(at, at + 4).toString('latin1');
  assert.equal(v.getUint32(4, true), buf.length - 8, 'RIFF size');
  assert.equal(v.getUint32(40, true), buf.length - 44, 'data size');
  return {
    riff: text(0), wave: text(8), fmt: text(12), data: text(36), format: v.getUint16(20, true), channels: v.getUint16(22, true),
    rate: v.getUint32(24, true), byteRate: v.getUint32(28, true), align: v.getUint16(32, true), bits: v.getUint16(34, true),
    samples: new Int16Array(buf.buffer.slice(buf.byteOffset + 44, buf.byteOffset + buf.length)),
  };
}
async function bytesOf(dl) { return fs.readFileSync(await dl.path()); }

// 1. behind the PIN, right after the piano listening test
assert.equal(await card.count(), 0, 'not on the start screen');
await page.click('[data-action="parent"]');
for (const d of '1234') await page.click(`#modal [data-pin="${d}"]`);
await page.waitForSelector('.pnav');
await page.click('[data-action="tab"][data-tab="settings"]');
if (await page.locator('[data-action="test-tools"][aria-expanded="false"]').count()) await page.click('[data-action="test-tools"]'); // open Settings › Test tools
await page.waitForSelector('.card.rec-test [data-rec="go"]');
assert.equal(await page.locator('.card:has([data-action="listen-open"]) + .card.rec-test').count(), 1, 'right after the listening test');
assert.equal(await card.locator('h2').textContent(), '🎙️ Save a test recording');
assert.equal(await card.locator('p.muted').textContent(), 'Record up to 2 minutes of piano through the tablet\'s microphone and save it as a sound file. Nothing is kept in the game.');
assert.match(await card.locator('label').textContent(), /What is this\? \(it goes in the file name\)/);
assert.equal((await button.textContent()).trim(), '● Record');
const keptBefore = await kept();

// 2. record about 1.5 seconds, then Stop: the download
await card.locator('[data-rec-label]').fill('C major scale');
const played = await page.evaluate(() => window.kqPlayed);
const acsBefore = await page.evaluate(() => window.kqACs.length);
const began = Date.now();
await button.click();
await page.waitForFunction(() => /^\d:\d\d of 2:00$/.test(document.querySelector('.rec-test .rec-time')?.textContent || ''));
assert.equal((await button.textContent()).trim(), '■ Stop');
assert.deepEqual(await page.evaluate(() => window.kqAsked), { audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } }, 'the studio\'s microphone, voice filters off');
// the fake microphone beeps now and then: the bar shows the loudest sound since it was last drawn
let bar = 0;
let warned = false;
while (Date.now() - began < 1500) {
  bar = Math.max(bar, await card.locator('.rec-meter span').evaluate((el) => parseFloat(el.style.width) || 0));
  warned ||= await card.locator('.rec-warn').isVisible();
  await page.waitForTimeout(50);
}
assert.match(await card.locator('.rec-time').textContent(), /^0:01 of 2:00$/, 'the seconds so far');
assert.ok(bar > 20, `the loudness bar moves (${bar}%)`);
// its beeps reach full scale
assert.ok(warned, 'the too-loud warning shows');
assert.equal(await card.locator('.rec-warn').textContent(), 'Too loud: move the tablet back a little.');
assert.equal(await micsOpen(), 1, 'the microphone is open');
await card.scrollIntoViewIfNeeded();
await card.evaluate((el) => el.scrollIntoView({ block: 'center' }));
await page.screenshot({ path: `${out}/recording.png` });
const rate = await lastRate();
const micRate = await page.evaluate(() => window.kqStreams[0].getAudioTracks()[0].getSettings().sampleRate);
const took = (Date.now() - began) / 1000;
let [dl] = await Promise.all([page.waitForEvent('download'), button.click()]);
const name = dl.suggestedFilename();
assert.match(name, /^kidquest-c-major-scale-\d{8}-\d{6}\.wav$/, name);
const first = await bytesOf(dl);
const wav = readWav(first);
assert.deepEqual([wav.riff, wav.wave, wav.fmt, wav.data], ['RIFF', 'WAVE', 'fmt ', 'data']);
assert.deepEqual([wav.format, wav.channels, wav.bits, wav.align], [1, 1, 16, 2], 'plain mono 16-bit PCM');
assert.equal(wav.rate, rate, 'at the sound clock\'s sample rate');
if (micRate) assert.equal(wav.rate, micRate, 'which is the microphone\'s own');
assert.equal(wav.byteRate, rate * 2);
const secs = wav.samples.length / rate;
assert.ok(secs > 1.2 && Math.abs(secs - took) < 0.4, `about as long as the recording (${secs.toFixed(2)} s of ${took.toFixed(2)} s)`);
const peak = wav.samples.reduce((m, x) => Math.max(m, Math.abs(x)), 0);
assert.ok(peak > 1000, `not silent (loudest sample ${peak})`);
assert.equal(await micsOpen(), 0, 'the microphone is let go');
await page.waitForFunction((n) => window.kqACs.slice(n).every((ac) => ac.state === 'closed'), acsBefore, { timeout: 3000 }); // the sound clock is closed
assert.equal(await page.evaluate(() => window.kqPlayed), played, 'no clicks or music played while recording');
assert.equal((await button.textContent()).trim(), '● Record');
assert.equal(await card.locator('.rec-saved').textContent(), `Saved ${name}. Look in this tablet's Downloads.`);
await page.screenshot({ path: `${out}/saved.png` });
console.log(`recorded ${name}: ${wav.samples.length} samples at ${rate} Hz (${secs.toFixed(2)} s), loudest ${peak}; the microphone says ${micRate} Hz`);

// "Save it again": the same file; Share… only where the tablet can share files
[dl] = await Promise.all([page.waitForEvent('download'), card.locator('[data-rec="again"]').click()]);
assert.equal(dl.suggestedFilename(), name);
assert.ok((await bytesOf(dl)).equals(first), 'the same bytes');
const shareable = await page.evaluate(() => Boolean(navigator.canShare?.({ files: [new File([new Uint8Array(4)], 'x.wav', { type: 'audio/wav' })] })));
assert.equal(await card.locator('[data-rec="share"]').count(), shareable ? 1 : 0, `Share… shown only when files can be shared (${shareable})`);

// 3. the recording stops by itself at the limit, and replaces the last one
await page.evaluate(async () => { (await import('./js/testrec.js')).REC.most = 1; });
await card.locator('[data-rec-label]').fill('');
[dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), button.click()]);
assert.match(dl.suggestedFilename(), /^kidquest-test-\d{8}-\d{6}\.wav$/, 'an empty label is "test"');
const short = readWav(await bytesOf(dl));
assert.equal(short.samples.length, short.rate, 'exactly the limit long');
assert.equal(await micsOpen(), 0, 'the microphone is let go');
assert.equal((await button.textContent()).trim(), '● Record');
assert.match(await card.locator('.rec-saved').textContent(), /^Saved kidquest-test-/, 'the new file replaced the last one');
await page.evaluate(async () => { (await import('./js/testrec.js')).REC.most = 120; });

// 4. leaving Settings while recording lets the microphone go, and saves nothing
let downloads = 0;
page.on('download', () => { downloads += 1; });
await button.click();
await page.waitForFunction(() => document.querySelector('.rec-test .rec-time'));
await page.waitForTimeout(400);
assert.equal(await micsOpen(), 1);
await page.click('[data-action="tab"][data-tab="kids"]');
await page.waitForTimeout(300);
assert.equal(await micsOpen(), 0, 'leaving Settings lets the microphone go');
assert.deepEqual(await page.evaluate(async () => (await import('./js/testrec.js')).testRecState()), { recording: false, saved: '' });
await page.click('[data-action="tab"][data-tab="settings"]');
await page.waitForSelector('.card.rec-test [data-rec="go"]');
assert.equal((await button.textContent()).trim(), '● Record', 'not a stuck Stop');
assert.equal(await card.locator('.rec-saved').count(), 0, 'the last file is forgotten');

// 5. putting the app away stops it, with a plain message
await button.click();
await page.waitForFunction(() => document.querySelector('.rec-test .rec-time'));
await page.evaluate(() => {
  Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForTimeout(200);
assert.equal(await micsOpen(), 0, 'putting the app away lets the microphone go');
assert.equal(await card.locator('.rec-note').textContent(), 'The recording stopped because the app was put away. Nothing was saved.');
assert.equal((await button.textContent()).trim(), '● Record');
await page.evaluate(() => {
  delete document.visibilityState;
  document.dispatchEvent(new Event('visibilitychange'));
});
await page.waitForSelector('.card.rec-test [data-rec="go"]');

// 6. a refused microphone: a plain message, never a stuck Stop
await page.evaluate(() => { window.kqRefuse = true; });
await button.click();
await page.waitForSelector('.rec-test .rec-note');
assert.match(await card.locator('.rec-note').textContent(), /^The microphone isn't allowed\./);
assert.equal((await button.textContent()).trim(), '● Record');
await page.evaluate(() => { window.kqRefuse = false; });

// 7. nothing was played, nothing kept in the game, no sideways scrolling
assert.equal(downloads, 0, 'no file after a stopped recording');
assert.equal(await page.evaluate(() => window.kqPlayed), played, 'no clicks or music played');
assert.equal(await kept(), keptBefore, 'nothing written to the game\'s storage');
assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'no sideways scrolling');

await ctx.close();
await browser.close();
site.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }
console.log(`testrec ok: ${out}`);
