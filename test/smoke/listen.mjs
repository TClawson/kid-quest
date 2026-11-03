// Browser test for the piano listening test page, with a made-up sound as the
// microphone: piano notes, then talking. Run: node test/smoke/listen.mjs
// (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { writeFile, mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { pianoNotes, talking, concat, addNoise, wav, RATE } from '../helpers/sound.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash } from '../../js/logic.js';

const shots = process.env.SHOTS;
const site = await serve('.');
const dir = await mkdtemp(join(tmpdir(), 'kq-listen-'));
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523];

async function withMic(samples, viewport, check, { clock = false } = {}) {
  const file = join(dir, `mic-${Math.random().toString(36).slice(2)}.wav`);
  await writeFile(file, wav(addNoise(samples)));
  const browser = await chromium.launch({ args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-audio-capture=${file}`, '--autoplay-policy=no-user-gesture-required'] });
  try {
    const ctx = await browser.newContext({ viewport, permissions: ['microphone'] });
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
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();
    await page.click('[data-action="parent"]');
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.click('[data-action="tab"][data-tab="settings"]');
    await page.click('[data-action="listen-open"]');
    await page.click('[data-action="listen-start"]');
    await page.waitForSelector('[data-action="listen-stop"]');
    await check(page);
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
}

const num = (page, id) => page.textContent(`#${id}`).then(Number);

try {
  // piano: notes keep coming (the file loops), the buddy hears them
  const piano = pianoNotes([...SCALE, ...SCALE.slice().reverse()].map((hz, i) => ({ at: 0.2 + i * 0.4, hz })), { length: 7 });
  await withMic(piano, { width: 1280, height: 800 }, async (page) => {
    await page.waitForFunction(() => Number(document.getElementById('ls-piano').textContent) >= 6, null, { timeout: 15000 });
    assert.match(await page.textContent('#ls-last'), /Piano/);
    assert.match(await page.textContent('#ls-mic'), /voice filters off/);
    assert.ok(await num(page, 'ls-since') < 3);
    assert.ok(await num(page, 'ls-other') <= 2, `other sounds: ${await num(page, 'ls-other')}`);
    if (shots) await page.screenshot({ path: `${shots}/listen-piano-tablet.png` });
    await page.click('[data-action="listen-stop"]');
    assert.match(await page.textContent('#ls-state'), /Not listening/);
  });

  // talking: lots of sounds, no piano notes
  await withMic(concat(talking(4, { f0: 150 }), talking(4, { f0: 260 })), { width: 390, height: 844 }, async (page) => {
    await page.waitForFunction(() => Number(document.getElementById('ls-other').textContent) >= 10, null, { timeout: 15000 });
    assert.equal(await num(page, 'ls-piano'), 0);
    assert.match(await page.textContent('#ls-last'), /Not piano/);
    assert.match(await page.textContent('#ls-state'), /Listening/);
    if (shots) await page.screenshot({ path: `${shots}/listen-talking-phone.png`, fullPage: true });
    // switching buddies keeps listening
    await page.click('[data-action="listen-kid"][data-id="kid_ava"]');
    assert.ok(await page.isVisible('[data-action="listen-stop"]'));
  });
  // quiet room: bored after 30 seconds, asleep after 60
  await withMic(new Float32Array(RATE * 2), { width: 800, height: 1000 }, async (page) => {
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
  }, { clock: true });
  console.log('listen smoke: ok');
} finally {
  site.close();
}
