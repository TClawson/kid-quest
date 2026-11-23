// Browser test: the printed chart made from a kid's plan. A parent opens it from Kids, sees one
// token page per routine in the kid's order (with their start cue and the chore they're
// growing), switches to the week grid, adds the sticker sheet, and prints to a PDF.
// Run: node test/smoke/charts.mjs  (SHOTS=dir also saves screenshots and the PDF)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays } from '../../js/logic.js';
import { applySet } from '../../js/choresets.js';
import { planDraft, moveChore, signPlan } from '../../js/planrules.js';
import { chartSignature } from '../../js/charts.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openParents } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const site = await serve('.');
const browser = await chromium.launch();
let n = 0;
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await useTestDay(page);
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  const kid = { id: 'kid_ava', name: 'Ava', color: '#4dabf7', tasks: defaultTasks(), startDate: addDays(TEST_DAY, -2), buddy: { species: 'panda', outfit: { background: 'bg-meadow' } } };
  applySet(kid, 'little', (p) => `${p}_${(n += 1)}`);
  // a little kid's afternoon: just the room jobs and piano
  kid.tasks = kid.tasks.filter((t) => !['Chore of the week', 'Chore of the week: deep clean', 'Vacuum your room', 'Dust your room', 'Laundry'].includes(t.name));
  const d = planDraft(kid, TEST_DAY);
  const bed = kid.tasks.find((t) => t.name === 'Make bed');
  const dressed = kid.tasks.find((t) => t.name === 'Get dressed');
  moveChore(kid, d, dressed.id, 'morning', bed.id); // dressed first, then bed
  d.cues = { morning: 'When I wake up', afternoon: 'After snack', evening: 'After my bath' };
  d.grow = kid.tasks.find((t) => t.name === 'Books away').id;
  signPlan(kid, d, TEST_DAY);
  s.kids.push(kid);
  // a big kid with every chore and their exercise: the week grid, all on one page
  const eli = { id: 'kid_eli', name: 'Eli', color: '#f08c00', tasks: defaultTasks(), startDate: addDays(TEST_DAY, -2), buddy: { species: 'puppy' } };
  applySet(eli, 'big', (p) => `${p}_${(n += 1)}`);
  eli.tasks.push({ id: 'task_run', name: 'Bike ride', icon: '🚲', period: 'exercise', days: [1, 3, 5, 6], verify: 'parent', minutes: 0 });
  eli.tasks.push({ id: 'task_swim', name: 'Swim', icon: '🏊', period: 'exercise', days: [2, 4], verify: 'parent', minutes: 0 });
  signPlan(eli, planDraft(eli, TEST_DAY), TEST_DAY);
  s.kids.push(eli);

  await page.goto(site.url);
  await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
  await page.reload();
  await openParents(page);
  for (const k of '1234') await page.click(`[data-pin="${k}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  assert.match(await page.locator('[data-action="charts"][data-kid="kid_ava"]').innerText(), /New chart/, 'a signed plan that was never printed asks for a chart');
  await page.click('[data-action="charts"][data-kid="kid_ava"]');
  await page.waitForSelector('.chart-view .cp-page');

  const pages = await page.$$eval('.cp-tokens', (els) => els.map((e) => ({ title: e.querySelector('h1').textContent, sub: e.querySelector('.cp-sub').textContent, chores: [...e.querySelectorAll('.cp-col:not(.cp-fin) .cp-label')].map((x) => x.textContent.trim()) })));
  assert.deepEqual(pages.map((p) => p.title), ['Good morning, Ava!', 'After school, Ava!', 'Goodnight routine, Ava!']);
  assert.deepEqual(pages[0].chores, ['Brush teeth', 'Get dressed', 'Make bed'], 'the kid\'s order');
  assert.match(pages[0].sub, /^When I wake up, I'll brush teeth, get dressed, then make bed\./);
  assert.ok(pages[1].chores.includes('Books away'));
  assert.equal(await page.locator('.cp-tokens .cp-grow').count(), 1, 'the grow chore is marked');
  // every picture loaded and nothing spills off a page
  const broken = await page.$$eval('.cp-page img', (els) => els.filter((i) => !i.complete || !i.naturalWidth).length);
  assert.equal(broken, 0);
  const spill = await page.$$eval('.cp-page', (els) => els.filter((p) => p.scrollHeight > p.clientHeight + 1).length);
  assert.equal(spill, 0, 'a page overflows');
  if (shots) {
    await page.emulateMedia({ media: 'print' });
    for (let i = 0; i < pages.length; i += 1) await page.locator('.cp-tokens').nth(i).screenshot({ path: `${shots}/token-page-${i + 1}.png` });
    await page.emulateMedia({ media: null });
    await page.screenshot({ path: `${shots}/chart-view.png` });
  }

  await page.check('[data-chartstickers]');
  assert.equal(await page.locator('.cp-sticker').count(), 3 + 3 + 3 + 1, 'one sticker per token, plus the buddy');
  if (shots) { await page.emulateMedia({ media: 'print' }); await page.locator('.cp-stickers').screenshot({ path: `${shots}/stickers.png` }); await page.emulateMedia({ media: null }); }

  await page.click('[data-action="chart-style"][data-style="grid"]');
  const grid = await page.locator('.cp-grid').innerText();
  assert.match(grid, /Ava's week/);
  assert.match(grid, /After snack/);
  if (shots) { await page.emulateMedia({ media: 'print' }); await page.locator('.cp-grid').screenshot({ path: `${shots}/week-grid.png` }); await page.emulateMedia({ media: null }); }

  // printing: only the pages, one per sheet
  await page.click('[data-action="chart-style"][data-style="tokens"]');
  await page.emulateMedia({ media: 'print' });
  const pdf = await page.pdf({ preferCSSPageSize: true, printBackground: true, ...(shots ? { path: `${shots}/chart.pdf` } : {}) });
  const count = (pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length;
  assert.equal(count, 4, `3 token pages and the stickers, got ${count}`);
  await page.emulateMedia({ media: null });

  // after printing, the parent's list no longer asks for a new chart
  await page.evaluate(() => window.dispatchEvent(new Event('afterprint')));
  await page.click('[data-action="chart-close"]');
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(saved.chartPrinted, chartSignature(kid));
  await page.waitForTimeout(100);
  assert.doesNotMatch(await page.locator('[data-action="charts"][data-kid="kid_ava"]').first().innerText(), /New chart/);
  // the big kid's chart starts as the week grid, with their exercise, on one page
  await page.click('[data-action="charts"][data-kid="kid_eli"]');
  await page.waitForSelector('.chart-view .cp-grid');
  const eliGrid = await page.locator('.cp-grid').innerText();
  assert.match(eliGrid, /Exercise/);
  assert.match(eliGrid, /Clear bedroom floor/);
  assert.equal(await page.$$eval('.cp-page', (els) => els.filter((p) => p.scrollHeight > p.clientHeight + 1).length), 0, 'the big kid\'s grid overflows');
  const last = await page.$eval('.cp-grid', (g) => g.querySelector('.cp-table').getBoundingClientRect().bottom <= g.querySelector('.cp-foot').getBoundingClientRect().top);
  assert.ok(last, 'the grid ends above the footer');
  if (shots) { await page.emulateMedia({ media: 'print' }); await page.locator('.cp-grid').screenshot({ path: `${shots}/week-grid-big.png` }); await page.emulateMedia({ media: null }); }
  await page.click('[data-action="chart-close"]');
  assert.deepEqual(errors, []);
  console.log('charts: ok');
} finally {
  await browser.close();
  site.close();
}
