// Browser test: a parent switches a kid to the Little chore set (the room split into clothes,
// toys and books, get dressed, night teeth, pajamas), and turns on "stars only".
// Run: node test/smoke/choresets.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openParents } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 800, height: 1400 } });
  await useTestDay(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks: defaultTasks(), startDate: addDays(TEST_DAY, -3) });
  await page.goto(site.url);
  await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
  await page.reload();
  await openParents(page);
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_sam"]');

  await page.click('[data-action="kid-set"][data-set="little"]');
  const ask = await page.locator('.modal-card').innerText();
  assert.match(ask, /Adds: Get dressed, Clothes away, Toys away, Books away, Brush teeth \(night\), Pajamas on/);
  assert.match(ask, /Takes off: Clear bedroom floor/);
  if (shots) await page.locator('.modal-card').screenshot({ path: `${shots}/1-switch-to-little.png` });
  await page.click('[data-action="modal-yes"]');
  await page.waitForTimeout(200);
  await page.check('input[data-kidflag="starsOnly"]');
  await page.waitForTimeout(200);

  const kid = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(kid.choreSet, 'little');
  assert.equal(kid.starsOnly, true);
  const names = kid.tasks.map((t) => t.name);
  for (const n of ['Get dressed', 'Clothes away', 'Toys away', 'Books away', 'Pajamas on', 'Piano practice']) assert.ok(names.includes(n), n);
  assert.ok(!names.includes('Clear bedroom floor'));
  const night = kid.tasks.find((t) => t.house === 'teeth-night');
  assert.equal(night.evening, true);
  const text = await page.locator('#app').innerText();
  assert.match(text, /Evening chores/);
  if (shots) await page.screenshot({ path: `${shots}/2-little-set-editor.png`, fullPage: true });
  assert.deepEqual(errors, []);
  console.log('chore sets: ok');
} finally {
  await browser.close();
  site.close();
}
