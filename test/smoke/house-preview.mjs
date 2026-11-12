// Previews of the buddy's house (js/house.js): inside on a tablet and a phone, the chores
// (unmade bed, toothbrush out, messy floor), the trophy shelf, the family leaderboard, the
// Home shop, walking in from the village, and the parent's "House chore" field.
// Run: node test/smoke/house-preview.mjs <outDir> [--video]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid, openParents } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'previews').replace(/\/$/, '');
const video = process.argv.includes('--video');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11'; // a Wednesday
const TROPHIES = ['acorn', 'crab', 'tooth', 'rocket', 'alien', 'egg', 'helmet', 'tiki', 'horn', 'saucer', 'fish', 'ball', 'puck', 'football', 'piano'];

/**
 * The family on one tablet. o: { done: Ava's chores done today, floorAgo: days since the floor
 * was last picked up, trophies: how many, furniture: Ava's house is furnished, inside }
 */
function family(o = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const mk = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -40), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species, outfit: { background: 'bg-meadow' } }, ...extra });
  const furn = ['home-bed-quilt', 'home-table-round-blue-checks', 'home-couch-green-stripes', 'home-chair-cozy', 'home-hammock', 'home-lamp', 'home-rug-round-purple-stars', 'home-art-sunset'];
  const week = '2026-11-08';
  s.kids.push(
    mk('kid_ava', 'Ava', '#ff6b6b', 'fox', {
      owned: ['sport-soccer-good', 'sport-hockey-regular', 'sport-rod-super', 'sport-football-regular', 'sport-shoes-good', ...(o.furniture === false ? [] : furn)],
      home: o.furniture === false ? {} : { bed: furn[0], table: furn[1], couch: furn[2], chair: furn[3], corner: furn[4], lamp: furn[5], rug: furn[6], art: furn[7] },
      buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } },
      playBest: { soccer: 42, tag: 31.5, hockey: 4, football: 18, fishing: 120 },
      gameBests: { week, best: { soccer: 17, tag: 22.4, fishing: 85 } },
    }),
    mk('kid_ben', 'Ben', '#4dabf7', 'bear', { playBest: { soccer: 57, tag: 18.2, hockey: 6, fishing: 95 }, gameBests: { week, best: { soccer: 23, hockey: 3 } } }),
    mk('kid_cy', 'Cy', '#69db7c', 'cat', { playBest: { soccer: 12, tag: 40.1, football: 24 }, gameBests: { week, best: { tag: 26.0, football: 24 } } }),
    mk('kid_dee', 'Dee', '#da77f2', 'dino', { playBest: { soccer: 8, fishing: 140 }, gameBests: { week: '2026-11-01', best: { fishing: 140 } } }),
  );
  const ava = s.kids[0];
  const role = (r) => ava.tasks.find((t) => t.house === r);
  const done = (key, tasks, by = 'parent') => { s.log[key] ||= {}; s.log[key].kid_ava ||= { tasks: {} }; for (const t of tasks) s.log[key].kid_ava.tasks[t.id] = { status: 'done', by }; };
  // past days: every chore done, except the floor in the last floorAgo days
  for (let i = 1; i <= 30; i += 1) {
    const key = addDays(day, -i);
    done(key, ava.tasks.filter((t) => t.period !== 'exercise' && (t.house !== 'floor' || i >= (o.floorAgo ?? 1))));
  }
  // trophies from past chests
  for (let i = 0; i < (o.trophies ?? 5); i += 1) s.log[addDays(day, -2 - i)].kid_ava.chest = { kind: 'trophy', trophy: TROPHIES[i] };
  if (o.done === 'all') done(day, ava.tasks.filter((t) => t.period !== 'exercise'));
  else if (o.done === 'house') done(day, [role('bed'), role('teeth'), role('floor')], 'self');
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const shots = [];

async function open(viewport, st, { inside = true, time = '07:30', record = false } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, ...(record ? { recordVideo: { dir: `${out}/.video`, size: viewport } } : {}) });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.clock.install({ time: new Date(`${day}T${time}:00`) });
  await page.goto(site.url);
  // inside: the buddy has been here before (a new day starts inside); outside: left outside today
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { kid_ava: inside ? { day: addDaysIso(day, -1), inside: false } : { day, inside: false } }]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.locator(inside ? '.house' : '.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(1200);
  return { ctx, page };
}
function addDaysIso(key, n) { return addDays(key, n); }
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
async function shotView(page, name, sel = '.house .village-view') {
  const box = await page.locator(sel).boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, clip: { ...box, y: box.y + y }, fullPage: true });
  shots.push(path);
  return path;
}
const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
// a strip of pictures side by side, with labels, as one PNG
async function strip(name, files, labels, width = 1600) {
  const page = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: 1 });
  const imgs = files.map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
  await page.setContent(`<body style="margin:0;background:#2a1e2a;font:bold 26px sans-serif;color:#fff8e7"><div style="display:flex;gap:16px;padding:16px;align-items:flex-start">${imgs.map((src, i) => `<figure style="margin:0;flex:1;text-align:center"><img src="${src}" style="width:100%;display:block;image-rendering:pixelated"><figcaption style="margin-top:8px">${labels[i]}</figcaption></figure>`).join('')}</div></body>`);
  await page.waitForTimeout(200);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
  await page.close();
}

const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 412, height: 915 };

// 1. tablet: tidy, furnished, the chores done
{
  const { ctx, page } = await open(TABLET, family({ done: 'house', trophies: 9 }));
  await shotView(page, '1-tablet-tidy');
  // walk to the shelf: its sign shows
  await tap(page, '.h-spot[data-spot="shelf"]');
  await page.clock.runFor(1200);
  await closeModals(page);
  await page.clock.runFor(300);
  await ctx.close();
}

// 2. chores undone: mess level 1 (floor done yesterday) and level 3 (5 days ago), side by side
{
  const files = [];
  for (const [lv, ago] of [[1, 1], [3, 5]]) {
    const { ctx, page } = await open(TABLET, family({ floorAgo: ago, furniture: lv === 3 ? false : undefined, trophies: 2 }));
    files.push(await shotView(page, `2-tablet-mess-${lv}`));
    if (lv === 1) {
      // the bed's bubble: walk over, it asks to make the bed
      await tap(page, '.h-chore[data-chore="bed"]');
      await page.clock.runFor(2000);
      await shotView(page, '2b-tablet-bed-quest');
      await tap(page, '.v-dialog [data-h="do"]');
      await page.clock.runFor(1500);
      await closeModals(page);
      await page.clock.runFor(800);
      await shotView(page, '2c-tablet-bed-made');
      // the toothbrush
      await tap(page, '.h-chore[data-chore="teeth"]');
      await page.clock.runFor(3500);
      await shotView(page, '2d-tablet-teeth-quest');
    }
    await ctx.close();
  }
  await strip('2-mess-1-and-3', files, ['Chores not done: floor level 1 (today)', 'Floor level 3 (not picked up for 5 days), basic furniture']);
}

// 3. phone
{
  const { ctx, page } = await open(PHONE, family({ floorAgo: 2, trophies: 15 }));
  await shotView(page, '3-phone-inside');
  await tap(page, '.h-spot[data-spot="sink"]');
  await page.clock.runFor(3500);
  await shotView(page, '3b-phone-bathroom');
  await ctx.close();
}

// 4. the trophy shelf's four looks
{
  const page = await browser.newPage({ viewport: { width: 1000, height: 400 }, deviceScaleFactor: 2 });
  await page.goto(`${site.url}test/smoke/house-sheet.html?mode=shelf&scale=3`);
  await page.waitForSelector('body[data-ready]');
  await page.screenshot({ path: `${out}/4-shelf-states.png`, fullPage: true });
  shots.push(`${out}/4-shelf-states.png`);
  await page.close();
}

// 5. the leaderboard (walk to the chart and tap it), this week and all time
{
  const { ctx, page } = await open(TABLET, family({ done: 'all' }));
  await tap(page, '.h-spot[data-spot="chart"]');
  await page.clock.runFor(2000);
  await page.waitForSelector('#modal .leaderboard');
  await page.addStyleTag({ content: '#modal .modal-card { max-height: none !important; overflow: visible !important; } #modal { overflow: auto; }' });
  // the modal is fixed to the window, so make the window as tall as the whole chart first
  const modal = async (name) => {
    const view = page.viewportSize();
    const el = page.locator('#modal .modal-card, #modal > *').first();
    const h = await el.evaluate((n) => n.scrollHeight);
    await page.setViewportSize({ width: view.width, height: Math.max(view.height, h + 80) });
    await page.clock.runFor(100);
    await el.screenshot({ path: `${out}/${name}.png` });
    await page.setViewportSize(view);
    shots.push(`${out}/${name}.png`);
  };
  await modal('5-leaderboard-week');
  await page.click('[data-action="lb-mode"][data-mode="all"]');
  await page.clock.runFor(300);
  await modal('5b-leaderboard-all-time');
  await closeModals(page);
  // 6. the Home shop (the store is open: every chore is done and checked)
  await page.click('[data-action="wardrobe"]');
  await page.clock.runFor(500);
  await page.click('[data-action="wardrobe-slot"][data-slot="home"]');
  await page.clock.runFor(800);
  await page.screenshot({ path: `${out}/6-home-shop.png`, fullPage: true });
  shots.push(`${out}/6-home-shop.png`);
  await ctx.close();
}

// 7. walking in from the village
{
  const { ctx, page } = await open(TABLET, family({ done: 'house', trophies: 4 }), { inside: false, record: video });
  const files = [];
  // start a little way from the house
  await page.clock.runFor(500);
  const box = await page.locator('.village .village-view').boundingBox();
  await page.mouse.click(box.x + box.width / 2 + 160, box.y + box.height / 2 + 80);
  await page.clock.runFor(2500);
  files.push(await shotView(page, '7a-village', '.village .village-view'));
  await tap(page, '.v-home');
  for (let i = 0; i < 40 && !(await page.locator('.village .v-buddy.going-in').count()); i += 1) await page.clock.runFor(60);
  files.push(await shotView(page, '7b-at-the-door', '.village .village-view'));
  await page.clock.runFor(2500);
  await page.locator('.house').scrollIntoViewIfNeeded();
  files.push(await shotView(page, '7c-inside'));
  await strip('7-walking-in', files, ['Tap the house', 'The buddy walks to the door and in', 'Inside']);
  if (video) {
    // a little walk round inside, then back out
    await page.clock.resume();
    for (const sel of ['.h-spot[data-spot="shelf"]', '.h-spot[data-spot="sink"]', '.h-spot[data-spot="bed"]', '.h-spot[data-spot="door"]']) {
      await tap(page, sel);
      await page.waitForTimeout(2600);
      await closeModals(page);
    }
    await page.waitForTimeout(1500);
    const v = await page.video().path();
    await ctx.close();
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', v, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/8-walk-around.mp4`]);
    fs.rmSync(`${out}/.video`, { recursive: true, force: true });
    shots.push(`${out}/8-walk-around.mp4`);
  } else await ctx.close();
}

// 9. the parent's task editor: the House chore field and the ready-made house chores
{
  const st = family({ done: 'house' });
  // Ava has no floor chore linked yet, so its ready-made button shows
  const floor = st.kids[0].tasks.find((t) => t.house === 'floor');
  delete floor.house;
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1500 }, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), st);
  await page.reload();
  await openParents(page);
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="kids"]');
  await page.click('[data-action="edit-kid"][data-id="kid_ava"]');
  await page.waitForTimeout(300);
  const first = page.locator('.task-edit').first();
  await first.scrollIntoViewIfNeeded();
  const top = await first.boundingBox();
  const adds = await page.locator('.house-adds').boundingBox();
  const y = await page.evaluate(() => window.scrollY);
  await page.screenshot({ path: `${out}/9-task-editor.png`, clip: { x: 0, y: top.y + y - 60, width: 900, height: adds.y + adds.height - top.y + 80 }, fullPage: true });
  shots.push(`${out}/9-task-editor.png`);
  await ctx.close();
}

await browser.close(); site.close();
console.log(shots.join('\n'));
