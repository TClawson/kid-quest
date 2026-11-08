// The map's moving things in every village: the whole village a few times as they go about.
// Run: node test/smoke/village-life.mjs <outDir> [theme]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { VILLAGE_THEMES } from '../../js/villagemaps.js';

const out = process.argv[2] || 'previews';
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-10';
function family(theme) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], spent: 0, buddy: { species: 'fox', outfit: { background: theme } } });
  return s;
}
const site = await serve('.');
const browser = await chromium.launch();
const times = [3000, 5000, 7500, 11000];
for (const theme of VILLAGE_THEMES) {
  if (only && theme !== only) continue;
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 2100 }, deviceScaleFactor: 1 });
  await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.village-view{height:1980px!important}.screen{max-width:none!important}'; document.head.append(st); }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', theme, e.message));
  await page.clock.install({ time: new Date(`${day}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(theme));
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1000);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  let at = 0;
  for (const t of times) {
    await page.clock.runFor(t - at); at = t;
    const box = await page.locator('.village-view').boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    await page.screenshot({ path: `${out}/${theme}-${t}.png`, clip: { ...box, y: box.y + y }, fullPage: true });
  }
  const has = await page.evaluate(() => Boolean(document.querySelector('.village')?.mapLife));
  console.log(theme, has ? 'moving things' : 'no moving things');
  await ctx.close();
}
await browser.close(); site.close();
