// Screenshots and videos of the sports feature for previews: bonus exercise,
// the sports shop and moves, and fishing visitors at every map's pond.
// Run: node test/smoke/sports-preview.mjs <outDir> [part]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, addDays, newId, fallbackHash } from '../../js/logic.js';
import { pickVisitors, planVisits } from '../../js/visits.js';
import { bestGear } from '../../js/items.js';
import { openKid } from '../helpers/open-kid.mjs';

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
  s.settings.questView = 'map'; // the old map (a new device starts in the village)
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
const errors = [];
async function open(viewport, theme, video, gear = null) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: video ? 1 : 2, ...(video ? { recordVideo: { dir: `${out}/raw`, size: viewport } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${day}T16:00:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(theme, gear));
  await page.reload();
  return { ctx, page };
}
const closeModal = async (page) => { while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(400); } };

try {
  if (part === 'all' || part === 'screens') {
    const { ctx, page } = await open({ width: 800, height: 1280 }, 'bg-meadow');
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await page.clock.runFor(1500);
    await page.screenshot({ path: `${out}/new-moves.png` });
    await closeModal(page);
    await page.screenshot({ path: `${out}/kid-screen-tablet.png` });
    await page.click('[data-action="wardrobe"]');
    await page.click('[data-action="wardrobe-slot"][data-slot="sport"]');
    await page.clock.runFor(500);
    await page.screenshot({ path: `${out}/sports-shop-tablet.png`, fullPage: true });
    await ctx.close();
  }
  if (part === 'all' || part === 'ponds') {
    for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
      for (const theme of THEMES) {
        const { ctx, page } = await open(viewport, theme);
        await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
        await page.clock.runFor(1500);
        await closeModal(page);
        await page.clock.runFor(1000);
        const map = page.locator('.quest-map');
        const box = await map.boundingBox();
        await page.screenshot({ path: `${out}/pond-${theme.slice(3)}-${label}.png`, clip: { x: box.x, y: box.y, width: box.width, height: 300 }, fullPage: true });
        await ctx.close();
      }
    }
  }
  if (part === 'all' || part === 'videos') {
    // every move with super gear, three times round
    const size = { width: 840, height: 500 };
    const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: `${out}/raw`, size } });
    const page = await ctx.newPage();
    await page.goto(`${site.url}test/smoke/gear-sheet.html?tier=3&loop=1`);
    await page.waitForTimeout(7900);
    await ctx.close();
    fs.renameSync(await page.video().path(), `${out}/raw/moves-all.webm`);
    // visitors fishing (and showing off when tapped) on a few maps
    for (const theme of ['bg-volcano', 'bg-castle', 'bg-space', 'bg-meadow']) {
      const vp = { width: 800, height: 340 };
      const { ctx: c2, page: p2 } = await open(vp, theme, true);
      await p2.clock.resume();
      await openKid(p2, '[data-action="open-kid"][data-id="kid_ava"]');
      await p2.waitForTimeout(800);
      await closeModal(p2);
      const box = await p2.locator('.quest-map').boundingBox();
      await p2.evaluate((y) => window.scrollTo(0, y + window.scrollY - 4), box.y);
      await p2.waitForTimeout(2500);
      for (const id of ['kid_dee', 'kid_ben', 'kid_cy']) {
        await p2.click(`.map-visitor[data-id="${id}"]`);
        await p2.waitForTimeout(2600);
      }
      await p2.waitForTimeout(9000);
      await c2.close();
      fs.renameSync(await p2.video().path(), `${out}/raw/fishing-${theme.slice(3)}.webm`);
    }
  }
  if (part === 'all' || part === 'games') {
    // find a day when the visitors split up the way we want to show, then film it
    const GAMES = [
      ['soccer-and-fishing', 'bg-meadow', { kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-regular'], kid_dee: ['sport-rod-regular'] }, ['soccer', 'pond']],
      ['hockey-and-football', 'bg-volcano', { kid_ben: ['sport-hockey-super'], kid_cy: ['sport-hockey-regular'], kid_dee: ['sport-football-good'], kid_eve: ['sport-football-super'] }, ['hockey', 'football']],
      ['soccer-and-fishing-castle', 'bg-castle', { kid_ben: ['sport-rod-super', 'sport-soccer-good'], kid_cy: ['sport-soccer-super'], kid_dee: ['sport-rod-good'] }, ['soccer', 'pond']],
    ];
    const keep = day;
    for (const [name, theme, gear, want] of GAMES) {
      const all = ['kid_ava', 'kid_ben', 'kid_cy', 'kid_dee', ...(gear.kid_eve ? ['kid_eve'] : [])];
      for (day = keep; ; day = addDays(day, 1)) {
        const vis = pickVisitors('kid_ava', all.map((id) => ({ id, buddy: {} })), day);
        if (vis.length < all.length - 1) continue;
        const plan = planVisits('kid_ava', vis.map((v) => ({ id: v.id, gear: bestGear(gear[v.id] || []) })), day);
        if (want.every((k) => plan.areas.some((a) => a.kind === k))) break;
      }
      const vp = { width: 800, height: 340 };
      const { ctx, page } = await open(vp, theme, true, gear);
      await page.clock.resume();
      await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
      await page.waitForTimeout(800);
      await closeModal(page);
      const box = await page.locator('.quest-map').boundingBox();
      await page.evaluate((y) => window.scrollTo(0, y + window.scrollY - 4), box.y);
      await page.waitForTimeout(12000);
      await ctx.close();
      fs.renameSync(await page.video().path(), `${out}/raw/games-${name}.webm`);
      // and a still on a phone
      const { ctx: c2, page: p2 } = await open({ width: 412, height: 915 }, theme, false, gear);
      await openKid(p2, '[data-action="open-kid"][data-id="kid_ava"]');
      await p2.clock.runFor(1500);
      await closeModal(p2);
      await p2.clock.runFor(1200);
      const b2 = await p2.locator('.quest-map').boundingBox();
      await p2.screenshot({ path: `${out}/games-${name}-phone.png`, clip: { x: b2.x, y: b2.y, width: b2.width, height: 300 }, fullPage: true });
      await c2.close();
    }
    day = keep;
  }
} finally {
  if (errors.length) console.log('page errors:', errors);
  await browser.close();
  site.close();
}
