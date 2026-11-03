// Browser test for the piano timer: the buddy cheers, and a timer set to keep
// counting in other apps keeps going while the app is hidden or closed.
// Run: node test/smoke/timer.mjs [screenshot folder]
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks } from '../../js/logic.js';

const shots = process.argv[2];
const site = await serve('.');
const browser = await chromium.launch();
const MIN = 60_000;

function seed() {
  const saved = emptyState();
  saved.settings.pinHash = 'sha256:test';
  saved.settings.questView = 'list';
  saved.settings.sound = false;
  const tasks = defaultTasks();
  const piano = tasks.find((t) => /piano/i.test(t.name));
  piano.background = true;
  saved.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: '2026-10-01', buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } }, owned: ['hat-cap'] });
  return { saved, piano };
}

const setHidden = (page, hidden) => page.evaluate((h) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (h ? 'hidden' : 'visible') });
  document.dispatchEvent(new Event('visibilitychange'));
}, hidden);
const stored = (page, kid, task) => page.evaluate(([k, t]) => {
  const s = JSON.parse(localStorage.getItem('kidquest.v1'));
  return s.log['2026-11-02']?.[k]?.tasks?.[t];
}, [kid, task]);

try {
  for (const [name, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.clock.install({ time: new Date(2026, 10, 2, 16, 0, 0) });
    const { saved, piano } = seed();
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();

    await page.click('[data-action="open-kid"]');
    await page.click(`[data-action="task"][data-id="${piano.id}"]`);
    assert.ok(await page.isVisible('.timer-buddy'), 'buddy on the timer page');
    assert.match(await page.locator('.timer').textContent(), /Note Rush/);
    await page.click('[data-action="timer-start"]');
    const drawn = await page.evaluate(() => {
      const c = document.querySelector('.timer-buddy canvas.live-buddy');
      return c ? c.getContext('2d').getImageData(0, 0, 24, 24).data.some((v, i) => i % 4 === 3 && v) : false;
    });
    assert.ok(drawn, 'the live buddy is drawn on the timer page');
    await page.clock.runFor(2 * MIN);
    await page.click('[data-action="timer-buddy"]');
    await page.waitForTimeout(400);
    const said = await page.textContent('.timer-bubble');
    assert.ok(said.length > 3, 'buddy says a cheer');
    if (shots) await page.screenshot({ path: `${shots}/timer-buddy-${name}.png` });

    // switch to Note Rush for 10 minutes: no ticks run while hidden
    await setHidden(page, true);
    await page.clock.runFor(10 * MIN);
    await setHidden(page, false);
    await page.clock.runFor(1500);
    let rec = await stored(page, 'kid_sam', piano.id);
    assert.ok(rec.seconds >= 12 * 60 && rec.seconds <= 12 * 60 + 3, `kept counting in the background (${rec.seconds})`);
    assert.ok(rec.away >= 10 * 60 - 2 && rec.away <= 10 * 60 + 2, `time away recorded (${rec.away})`);

    // Android closes the app in the background; it opens again 5 minutes later
    await setHidden(page, true);
    await page.clock.runFor(5 * MIN);
    await page.reload();
    await page.clock.runFor(1500);
    assert.ok(await page.isVisible('#timer-left'), 'timer page comes back after the app was closed');
    rec = await stored(page, 'kid_sam', piano.id);
    // the page clock also runs in real time while the test works (main already landed at +9 s), so allow +20
    assert.ok(rec.seconds >= 17 * 60 && rec.seconds <= 17 * 60 + 20, `time while closed counted (${rec.seconds})`);

    // finish: ask a parent later, then the approval shows time in other apps
    await page.clock.runFor(14 * MIN);
    await page.click('[data-action="pin-later"]');
    rec = await stored(page, 'kid_sam', piano.id);
    assert.equal(rec.status, 'pending');
    assert.equal(rec.seconds, 30 * 60);
    assert.equal(await page.evaluate(() => localStorage.getItem('kidquest.practiceRun')), null, 'run cleared');

    // a task without the setting still pauses when the app is left
    await page.evaluate(([k, t]) => {
      const s = JSON.parse(localStorage.getItem('kidquest.v1'));
      s.kids[0].tasks.find((x) => x.id === t).background = false;
      delete s.log['2026-11-02'][k].tasks[t];
      localStorage.setItem('kidquest.v1', JSON.stringify(s));
    }, ['kid_sam', piano.id]);
    await page.reload();
    await page.click('[data-action="open-kid"]');
    await page.click(`[data-action="task"][data-id="${piano.id}"]`);
    await page.click('[data-action="timer-start"]');
    await page.clock.runFor(MIN);
    await setHidden(page, true);
    await page.clock.runFor(10 * MIN);
    await setHidden(page, false);
    await page.clock.runFor(1500);
    rec = await stored(page, 'kid_sam', piano.id);
    assert.ok(rec.seconds <= 62, `paused while away (${rec.seconds})`);
    assert.match(await page.textContent('.ring-inner small'), /Paused/);

    assert.deepEqual(errors, [], 'no errors in the page');
    await page.close();
  }
  console.log('timer test passed');
} finally {
  await browser.close();
  site.close();
}
