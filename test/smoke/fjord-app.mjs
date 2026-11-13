// The Alaskan Fjord in the real app: the village on a tablet and a phone, each visitor forced to
// show up, the old map and the fishing spot. Run: node test/smoke/fjord-app.mjs <outDir> [date]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: true });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/404/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  const saved = emptyState();
  saved.settings.pinHash = 'sha256:test';
  saved.settings.sound = false;
  const tasks = defaultTasks();
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#1c7ed6', tasks, startDate: dateKey(), owned: ['bg-fjord'], buddy: { species: 'fox', outfit: { background: 'bg-fjord' } } });
  // four pieces of the fjord's treasure map, found in old chests: the lighthouse is up
  if (process.argv[3] !== 'bare') for (let i = 1; i <= 4; i += 1) { const d = new Date(Date.now() - i * 86400000); saved.log[dateKey(d)] = { kid_ava: { tasks: {}, chest: { kind: 'piece', map: 'bg-fjord', opened: true } } }; }
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();
  await openKid(page);
  await page.waitForSelector('.village');
  await page.waitForTimeout(600);
  await closePops(page);
  await page.waitForTimeout(300);
  return { ctx, page };
}
const life = (page, what) => page.evaluate((w) => document.querySelector('.village').mapLife.show(w), what);

for (const [label, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 412, height: 915 }]]) {
  const { ctx, page } = await open(viewport);
  await page.screenshot({ path: `${out}/app-${label}.png` });
  if (label === 'tablet') {
    await life(page, 'moose');
    await life(page, 'otters');
    await life(page, 'whale');
    await page.waitForTimeout(9000);
    await page.screenshot({ path: `${out}/app-${label}-visitors.png` });
    console.log(await page.evaluate(() => { const s = document.querySelector('.village').mapLife.state; return JSON.stringify({ view: s.view, whale: s.whale && [s.whale.phase, Math.round(s.whale.x), s.whale.y], otters: s.otters && s.otters.members.map((o) => [o.x, o.y, o.state]), land: s.land && [s.land.kind, Math.round(s.land.x), s.land.state] }); }));
  }
  // the lighthouse: walk to it, and its show
  if (await page.locator('.v-landmark').count()) {
    // tapped through the page, since it can be below the first screen (the village moves its own camera)
    await page.evaluate(() => document.querySelector('.v-landmark').click());
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${out}/app-${label}-walk.png` });
    await page.waitForSelector('.village.show-on', { timeout: 40000 }).catch(() => console.log(label, 'the show did not start'));
    await page.screenshot({ path: `${out}/app-${label}-arrive.png` });
    for (const [name, wait] of [['show1', 1500], ['show2', 1100], ['show3', 1000], ['show4', 1100], ['show5', 1200], ['show6', 1500], ['show7', 1200]]) {
      await page.waitForTimeout(wait);
      await page.screenshot({ path: `${out}/app-${label}-${name}.png` });
    }
  } else console.log(label, 'no landmark');
  await ctx.close();
}
console.log(errors.length ? `ERRORS\n${[...new Set(errors)].join('\n')}` : 'no page errors');
await browser.close(); site.close();
