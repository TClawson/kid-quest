// Previews of visitors, play patches, fishing and the treasure landmark in the village.
// Run: node test/smoke/village-visitors.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, newId, fallbackHash } from '../../js/logic.js';
import { pickVisitors, planVisits } from '../../js/visits.js';
import { bestGear } from '../../js/items.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const gear = { kid_ava: ['sport-soccer-good'], kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-regular'], kid_dee: ['sport-rod-regular'] };
const ids = Object.keys(gear);
// a weekday when all three others visit Ava, with a pond and a soccer patch
let day = '2026-11-09';
for (;; day = addDays(day, 1)) {
  if ([0, 6].includes(new Date(`${day}T12:00`).getDay())) continue;
  const vis = pickVisitors('kid_ava', ids.map((id) => ({ id, buddy: {} })), day);
  if (vis.length < 3) continue;
  const plan = planVisits('kid_ava', vis.map((v) => ({ id: v.id, gear: bestGear(gear[v.id]) })), day);
  if (['pond', 'soccer'].every((k) => plan.areas.some((a) => a.kind === k))) break;
}

function family(done) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const mk = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], owned: gear[id], spent: 0, buddy: { species, outfit: { background: 'bg-meadow' } }, ...extra });
  s.kids.push(mk('kid_ava', 'Ava', '#ff6b6b', 'fox', { buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } } }), mk('kid_ben', 'Ben', '#4dabf7', 'bear'), mk('kid_cy', 'Cy', '#69db7c', 'cat'), mk('kid_dee', 'Dee', '#da77f2', 'dino'));
  // four map pieces already found: the Forest Village treasure map is finished
  for (let i = 1; i <= 4; i += 1) s.log[addDays(day, -i * 3)] = { kid_ava: { tasks: {}, chest: { kind: 'piece', map: 'bg-meadow' } } };
  const ava = s.kids[0];
  const today = ava.tasks.filter((t) => t.period !== 'exercise').slice(0, done);
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(today.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }], ['overview', { width: 1400, height: 1900 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === 'overview' ? 1 : 2 });
  // the overview shows the whole village at once
  if (label === 'overview') await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.village-view{height:1700px!important}.screen{max-width:none!important}'; document.head.append(st); }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.clock.install({ time: new Date(`${day}T17:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(1));
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  const shot = async (name) => { const box = await page.locator('.village-view').boundingBox(); const y = await page.evaluate(() => window.scrollY); await page.screenshot({ path: `${out}/${name}-${label}.png`, clip: { ...box, y: box.y + y }, fullPage: true }); };
  // walk down to the green
  await page.evaluate(() => document.querySelector('.v-visitor').click());
  await page.clock.runFor(4000);
  await shot('1-green-chores-left');
  // all chores done: visitors want to play
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(99));
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.evaluate(() => document.querySelector('.v-visitor.fishing').click());
  await page.clock.runFor(4000);
  // the game menu opened; close it to look at the green
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await shot('2-green-play');
  for (let i = 0; i < 12 && !(await page.locator('.v-visitor.reeling').count()); i += 1) await page.clock.runFor(3000);
  await page.clock.runFor(1200);
  await shot('3-fish-catch');
  // the landmark and its show
  await page.evaluate(() => document.querySelector('.v-landmark').click());
  await page.clock.runFor(5000);
  await shot('4-landmark');
  await page.evaluate(() => document.querySelector('.v-landmark').click());
  await page.clock.runFor(3000);
  await shot('5-landmark-show');
  await page.clock.runFor(8000);
  // a visitor's game
  await page.evaluate(() => document.querySelector('.v-visitor:not(.fishing)').click());
  await page.clock.runFor(5000);
  console.log(label, 'menu open:', await page.locator('#modal:not([hidden])').count());
  await page.screenshot({ path: `${out}/6-tap-visitor-${label}.png` });
  await ctx.close();
}
await browser.close(); site.close();
