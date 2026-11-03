// Browser test for the piano listening test page, with a sound file as the
// microphone: real grand-piano notes (Salamander piano samples), made-up talking,
// and a quiet room. It tries the built-in listener, Google's recognizer, and both.
// Run: node test/smoke/listen.mjs   (SHOTS=dir also saves screenshots;
// YAMNET_FILE=path uses a saved copy of Google's model instead of downloading it)
import assert from 'node:assert/strict';
import { writeFile, readFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { pianoNotes, talking, concat, addNoise, room, wav, RATE } from '../helpers/sound.mjs';
import { MEDIAPIPE, YAMNET } from '../../js/hear.js';
import { emptyState, defaultTasks, dateKey, fallbackHash } from '../../js/logic.js';

const shots = process.env.SHOTS;
const site = await serve('.');
const dir = await mkdtemp(join(tmpdir(), 'kq-listen-'));
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523];
const PIANO_DIR = 'node_modules/@audio-samples/piano-mp3-velocity8/audio/';
const MEDIAPIPE_DIR = 'node_modules/@mediapipe/tasks-audio/';

const browserArgs = (file) => ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${file}`, '--autoplay-policy=no-user-gesture-required'];

/** A melody of real piano notes, mixed in a browser (it decodes the mp3 files). */
async function realPiano(names, gap) {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(site.url);
    const samples = await page.evaluate(async ({ urls, gap, rate }) => {
      const len = Math.ceil((urls.length * gap + 1.5) * rate);
      const ctx = new OfflineAudioContext(1, len, rate);
      await Promise.all(urls.map(async (u, i) => {
        const buf = await ctx.decodeAudioData(await (await fetch(u)).arrayBuffer());
        const src = ctx.createBufferSource();
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(1.5, 0);
        gain.gain.setValueAtTime(1.5, 0.2 + i * gap + 1.3);
        gain.gain.linearRampToValueAtTime(0, 0.2 + i * gap + 1.5);
        src.buffer = buf;
        src.connect(gain).connect(ctx.destination);
        src.start(0.2 + i * gap);
      }));
      return Array.from((await ctx.startRendering()).getChannelData(0));
    }, { urls: names.map((n) => `${PIANO_DIR}${encodeURIComponent(n)}v8.mp3`), gap, rate: RATE });
    return room(Float32Array.from(samples));
  } finally {
    await browser.close();
  }
}

async function withMic(samples, { mode = 'builtin', viewport = { width: 1280, height: 800 }, clock = false }, check) {
  const file = join(dir, `mic-${Math.random().toString(36).slice(2)}.wav`);
  await writeFile(file, wav(addNoise(samples)));
  const browser = await chromium.launch({ args: browserArgs(file) });
  try {
    const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
    // Google's recognizer: its code from the npm package, its model from a saved copy if given
    await ctx.route(`${MEDIAPIPE}/**`, (route) => route.fulfill({ path: MEDIAPIPE_DIR + route.request().url().slice(MEDIAPIPE.length + 1) }));
    if (process.env.YAMNET_FILE) await ctx.route(YAMNET, async (route) => route.fulfill({ body: await readFile(process.env.YAMNET_FILE) }));
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const saved = emptyState();
    saved.settings.pinHash = fallbackHash('kidquest:1234');
    saved.settings.questView = 'list';
    saved.settings.sound = false;
    saved.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: dateKey(), buddy: { species: 'panda', outfit: {} } });
    saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: dateKey(), buddy: { species: 'fox', outfit: {} } });
    if (clock) await page.clock.install();
    await page.goto(site.url);
    await page.evaluate(([s, m]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.listenMode', m); }, [saved, mode]);
    await page.reload();
    await page.click('[data-action="parent"]');
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.click('[data-action="tab"][data-tab="settings"]');
    await page.click('[data-action="listen-open"]');
    assert.equal(await page.getAttribute(`[data-action="listen-mode"][data-mode="${mode}"]`, 'aria-pressed'), 'true');
    await page.click('[data-action="listen-start"]');
    await page.waitForSelector('[data-action="listen-stop"]', { timeout: 60000 });
    if (await page.locator('.listen-error').count()) assert.fail(await page.textContent('.listen-error'));
    await check(page);
    // MediaPipe writes its own start-up notes (INFO, W1103...) to the error console
    assert.deepEqual(errors.filter((e) => !/^(INFO:|[IWE]\d{4} )|Graph successfully/.test(e)), []);
  } finally {
    await browser.close();
  }
}

const num = (page, id) => page.textContent(`#${id}`).then(Number);
const waitNum = (page, id, atLeast, timeout = 20000) => page.waitForFunction(([i, n]) => Number(document.getElementById(i).textContent) >= n, [id, atLeast], { timeout });

try {
  const melody = await realPiano(['C4', 'D#4', 'F#4', 'A4', 'C5', 'A4', 'F#4', 'D#4', 'C4', 'A3', 'C4', 'F#4'], 0.45);
  const talk = room(concat(talking(4, { f0: 150 }), talking(4, { f0: 260 })));

  // built-in: real piano notes are piano, the buddy hears them
  await withMic(melody, {}, async (page) => {
    await waitNum(page, 'ls-piano', 8);
    assert.match(await page.textContent('#ls-mic'), /voice filters off/);
    assert.ok(await num(page, 'ls-since') < 3);
    // the end of the file (one fading echo per loop) may count as another sound
    const [p, o] = [await num(page, 'ls-piano'), await num(page, 'ls-other')];
    assert.ok(o * 4 <= p, `piano ${p}, other sounds ${o}`);
    assert.equal(await page.locator('#ls-google').count(), 0, 'no Google row in built-in mode');
    if (shots) await page.screenshot({ path: `${shots}/listen-builtin-piano.png` });
  });

  // built-in: talking in a room with an echo is not piano
  await withMic(talk, { viewport: { width: 390, height: 844 } }, async (page) => {
    await waitNum(page, 'ls-other', 6, 30000);
    assert.equal(await num(page, 'ls-piano'), 0);
    assert.match(await page.textContent('#ls-last'), /Not piano/);
    assert.doesNotMatch(await page.textContent('#ls-state'), /Hearing piano/);
  });

  // Google: real piano is piano, and the page shows what Google hears
  await withMic(melody, { mode: 'google' }, async (page) => {
    await waitNum(page, 'ls-piano', 8, 40000);
    assert.match(await page.textContent('#ls-google'), /Music|Piano/);
    assert.match(await page.textContent('#ls-state'), /Hearing piano/);
    if (shots) await page.screenshot({ path: `${shots}/listen-google-piano.png` });
    // switching to "both agree" restarts listening and still hears the piano
    await page.click('[data-action="listen-mode"][data-mode="both"]');
    await page.waitForSelector('[data-action="listen-stop"]', { timeout: 60000 });
    await waitNum(page, 'ls-piano', 5, 40000);
  });

  // Google: talking is not piano, and Google says it hears speech
  await withMic(talk, { mode: 'google', viewport: { width: 390, height: 844 } }, async (page) => {
    await waitNum(page, 'ls-other', 6, 40000);
    assert.equal(await num(page, 'ls-piano'), 0);
    assert.match(await page.textContent('#ls-google'), /Speech/);
    if (shots) await page.screenshot({ path: `${shots}/listen-google-talking-phone.png`, fullPage: true });
  });

  // quiet room: bored after 30 seconds, asleep after 60
  await withMic(new Float32Array(RATE * 2), { viewport: { width: 800, height: 1000 }, clock: true }, async (page) => {
    assert.match(await page.textContent('#ls-state'), /Listening/);
    await page.clock.fastForward(31_000);
    await page.clock.runFor(500);
    assert.match(await page.textContent('#ls-state'), /Bored/);
    assert.match(await page.textContent('#ls-say'), /bored/);
    await page.clock.fastForward(30_000);
    await page.clock.runFor(500);
    assert.match(await page.textContent('#ls-state'), /Asleep/);
    assert.ok(await page.locator('#ls-sprite .zzz').count(), 'buddy sleeps');
    if (shots) await page.screenshot({ path: `${shots}/listen-asleep.png` });
    // leaving the app stops the microphone
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    assert.ok(await page.isVisible('[data-action="listen-start"]'));
  });

  // the synthetic scale still works too (no real samples needed)
  await withMic(pianoNotes([...SCALE, ...SCALE.slice().reverse()].map((hz, i) => ({ at: 0.2 + i * 0.4, hz })), { length: 7 }), {}, async (page) => {
    await waitNum(page, 'ls-piano', 6);
  });
  console.log('listen smoke: ok');
} finally {
  site.close();
}
