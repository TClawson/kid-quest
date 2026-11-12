// Previews of every map's village in the app: the whole village with visitors, the start on a
// tablet, the shopkeeper, a villager with two quests, and the landmark.
// Run: node test/smoke/village-all.mjs <outDir> [theme]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { pickVisitors, planVisits } from '../../js/visits.js';
import { bestGear } from '../../js/items.js';
import { VILLAGE_THEMES } from '../../js/villagemaps.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const only = process.argv[3];
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

function family(theme, done) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const mk = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], owned: gear[id], spent: 0, buddy: { species, outfit: { background: theme } }, ...extra });
  s.kids.push(mk('kid_ava', 'Ava', '#ff6b6b', 'fox', { buddy: { species: 'fox', outfit: { background: theme, hat: 'hat-cap' } } }), mk('kid_ben', 'Ben', '#4dabf7', 'bear'), mk('kid_cy', 'Cy', '#69db7c', 'cat'), mk('kid_dee', 'Dee', '#da77f2', 'dino'));
  // this map's treasure map is finished: its landmark stands in the village
  for (let i = 1; i <= 4; i += 1) s.log[addDays(day, -i * 3)] = { kid_ava: { tasks: {}, chest: { kind: 'piece', map: theme } } };
  const ava = s.kids[0];
  const today = ava.tasks.filter((t) => t.period !== 'exercise').slice(0, done);
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(today.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
for (const theme of VILLAGE_THEMES) {
  if (only && theme !== only) continue;
  for (const [label, viewport] of [['whole', { width: 1400, height: 2100 }], ['tablet', { width: 800, height: 1280 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: label === 'whole' ? 1 : 2 });
    if (label === 'whole') await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.village-view{height:1980px!important}.screen{max-width:none!important}'; document.head.append(st); }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('ERR', theme, e.message));
    await page.clock.install({ time: new Date(`${day}T17:30:00`) });
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(theme, 1));
    await page.reload();
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await page.clock.runFor(1500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
    await page.locator('.village').scrollIntoViewIfNeeded();
    const shot = async (name) => { const box = await page.locator('.village-view').boundingBox(); const y = await page.evaluate(() => window.scrollY); await page.screenshot({ path: `${out}/${theme}-${name}.png`, clip: { ...box, y: box.y + y }, fullPage: true }); };
    if (label === 'whole') { await page.clock.runFor(1000); await shot('whole'); await ctx.close(); continue; }
    await page.clock.runFor(1000);
    await shot('1-start');
    // the shopkeeper (the shop is still shut: chores are left)
    await page.evaluate(() => document.querySelector('.villager.keeper').click());
    await page.clock.runFor(6000);
    await shot('2-shop');
    // a villager with two quests
    const two = await page.evaluate(() => { const b = [...document.querySelectorAll('.villager .v-badge.more')][0]?.closest('.villager'); if (b) b.click(); return Boolean(b); });
    if (two) { await page.clock.runFor(8000); await shot('3-two-quests'); }
    // the landmark
    await page.evaluate(() => document.querySelector('.v-landmark')?.click());
    await page.clock.runFor(8000);
    await shot('4-landmark');
    await page.evaluate(() => document.querySelector('.v-landmark')?.click());
    await page.clock.runFor(2500);
    await shot('5-show');
    await ctx.close();
  }
  console.log(theme, 'done');
}
await browser.close(); site.close();
