// Screenshots and videos of the sports feature for previews: bonus exercise,
// the sports shop and moves, and fishing visitors at every map's pond.
// Run: node test/smoke/sports-preview.mjs <outDir> [part]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, addDays, newId, fallbackHash } from '../../js/logic.js';
import { pickVisitors, planVisits } from '../../js/visits.js';
import { bestGear } from '../../js/items.js';
import { openKid, openOldMap } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const part = process.argv[3] || 'all';
fs.mkdirSync(out, { recursive: true });
const THEMES = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainbow', 'bg-galaxy'];

// A day when all three other kids visit Ava, so the pond is busy.
const ids = ['kid_ava', 'kid_ben', 'kid_cy', 'kid_dee'];
let day = '2026-11-03';
while (pickVisitors('kid_ava', ids.map((id) => ({ id, buddy: {} })), day).length < 3) day = addDays(day, 1);

function family(theme, gear = null) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'map'; // chose the old map once: the village opens, and the map is in the Menu
  const start = addDays(day, -50);
  const mk = (id, name, color, species, extra) => {
    const tasks = defaultTasks();
    tasks.push({ id: newId('task'), name: 'Run or bike', icon: '🏃', period: 'exercise', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 });
    tasks.push({ id: newId('task'), name: 'Soccer practice', icon: '⚽', period: 'exercise', days: [2, 4], verify: 'parent', minutes: 0 });
    return { id, name, color, tasks, startDate: start, seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species, outfit: { background: theme } }, ...extra };
  };
  s.kids.push(
    mk('kid_ava', 'Ava', '#ff6b6b', 'fox', { owned: ['sport-soccer-super', 'sport-hockey-good', 'sport-shoes-regular', 'sport-football-regular', 'sport-rod-good'], buddy: { species: 'fox', outfit: { background: theme, sport: 'sport-soccer-super', hat: 'hat-cap' } }, owned2: true }),
    mk('kid_ben', 'Ben', '#4dabf7', 'bear', { owned: ['sport-rod-super'] }),
    mk('kid_cy', 'Cy', '#69db7c', 'cat', { owned: ['sport-rod-regular', 'sport-football-good'] }),
    mk('kid_dee', 'Dee', '#da77f2', 'dino', { owned: ['sport-hockey-super'] }),
  );
  s.kids.forEach((k) => { delete k.owned2; });
  // other gear for the game previews: { kidId: [item ids] }, and a fifth kid if named
  if (gear) {
    if (gear.kid_eve) s.kids.push(mk('kid_eve', 'Eve', '#ffa94d', 'puppy', {}));
    for (const k of s.kids) if (gear[k.id]) k.owned = gear[k.id];
  }
  // six full weeks of exercise (Mon-Fri), and 3 days so far this week; Ava also did morning tasks today
  for (let i = 1; i <= 46; i += 1) {
    const key = addDays(day, -i);
    const dow = new Date(`${key}T12:00`).getDay();
    if (dow === 0 || dow === 6) continue;
    s.log[key] = {};
    for (const k of s.kids) s.log[key][k.id] = { tasks: { [k.tasks[9].id]: { status: 'done', by: 'parent' } }, excused: false };
  }
  const ava = s.kids[0];
  s.log[day] = { kid_ava: { tasks: { [ava.tasks[0].id]: { status: 'done' }, [ava.tasks[1].id]: { status: 'done' }, [ava.tasks[9].id]: { status: 'done', by: 'parent' } } } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const ONLY = process.argv[3];
const SETUPS = [
  ['meadow-soccer-pond', 'bg-meadow', { kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-regular'], kid_dee: ['sport-rod-regular'] }, ['soccer', 'pond']],
  ['meadow-hockey-football', 'bg-meadow', { kid_ben: ['sport-hockey-super'], kid_cy: ['sport-hockey-regular'], kid_dee: ['sport-football-good'], kid_eve: ['sport-football-super'] }, ['hockey', 'football']],
  ['volcano-hockey-football', 'bg-volcano', { kid_ben: ['sport-hockey-super'], kid_cy: ['sport-hockey-regular'], kid_dee: ['sport-football-good'], kid_eve: ['sport-football-super'] }, ['hockey', 'football']],
  ['castle-soccer-pond', 'bg-castle', { kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-super'], kid_dee: ['sport-rod-good'] }, ['soccer', 'pond']],
  ...['sunset', 'ocean', 'space', 'rainbow', 'galaxy', 'rainforest'].map((t) => [`${t}-soccer-pond`, `bg-${t}`, { kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-super'], kid_dee: ['sport-rod-good'] }, ['soccer', 'pond']]),
  ['meadow-football', 'bg-meadow', { kid_ben: ['sport-football-super'], kid_cy: ['sport-football-regular'], kid_dee: ['sport-rod-good'] }, [], 'left:hockey,right:football'],
].filter((s) => !ONLY || s[0].startsWith(ONLY));
const keep = day;
for (const [name, theme, gear, want, force] of SETUPS) {
  const all = ['kid_ava', 'kid_ben', 'kid_cy', 'kid_dee', ...(gear.kid_eve ? ['kid_eve'] : [])];
  for (day = keep; ; day = addDays(day, 1)) {
    const vis = pickVisitors('kid_ava', all.map((id) => ({ id, buddy: {} })), day);
    if (vis.length < all.length - 1) continue;
    const plan = planVisits('kid_ava', vis.map((v) => ({ id: v.id, gear: bestGear(gear[v.id] || []) })), day);
    if (want.every((k) => plan.areas.some((a) => a.kind === k))) break;
  }
  for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('ERR', e.message));
    await page.clock.install({ time: new Date(`${day}T16:00:00`) });
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(theme, gear));
    await page.reload();
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await openOldMap(page); // the old map, from the Menu
    await page.clock.runFor(1500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
    await page.clock.runFor(4000);
    // show the land for areas the plan did not pick (players stay where they were)
    if (force) await page.evaluate(async (a) => { const s = document.querySelector('.quest-map'); s.dataset.areas = a; (await import('./js/maparts.js')).paintQuestMaps(); }, force);
    console.log(name, label, await page.locator(".quest-map").getAttribute("data-areas"));
    const box = await page.locator('.quest-map').boundingBox();
    await page.screenshot({ path: `${out}/${name}-${label}.png`, clip: { x: box.x, y: box.y, width: box.width, height: Math.min(box.height, 620) }, fullPage: true });
    await ctx.close();
  }
}
await browser.close(); site.close();
