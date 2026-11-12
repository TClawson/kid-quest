// Screenshots of the kid's Today button, Today's quests and the coach, for a look by eye
// (not part of the test suite).
// Run: node test/smoke/kid-today-preview.mjs outDir
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { dateKey } from '../../js/logic.js';

const out = process.argv[2]?.replace(/\/$/, '');
if (!out) throw new Error('usage: node test/smoke/kid-today-preview.mjs outDir');
fs.mkdirSync(out, { recursive: true });
const DAY = dateKey();
const NOW = new Date(`${DAY}T16:30:00`).getTime();
const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport, { kid = 'kid_ayden', theme = null } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: NOW });
  await page.goto(site.url);
  const s = parentFamily(DAY, NOW);
  if (theme) for (const k of s.kids) { k.buddy.outfit.background = theme; k.owned.push(theme); }
  await page.evaluate(([st, day]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(st));
    localStorage.setItem('kidquest.house', JSON.stringify(Object.fromEntries(st.kids.map((k) => [k.id, { day, inside: false }]))));
  }, [s, DAY]);
  await page.reload();
  await page.click(`[data-action="open-kid"][data-id="${kid}"]`);
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.locator('.village').evaluate((el) => el.scrollIntoView({ block: 'end' }));
  await page.clock.runFor(1500);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const view = (page, name) => page.locator('.village .village-view').screenshot({ path: `${out}/${name}.png` });
async function talkTo(page, id) {
  await page.click('.village .v-hud [data-action="today"]');
  await page.click(`.t-q[data-id="${id}"] [data-action="today-go"]`);
  for (let i = 0; i < 40 && !(await page.locator('.village .v-dialog:not([hidden])').count()); i += 1) await page.clock.runFor(500);
  await page.clock.runFor(3000); // the words type out
}

try {
  for (const [name, viewport] of [['landscape', { width: 1280, height: 800 }], ['portrait', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
    const { ctx, page } = await open(viewport);
    await page.screenshot({ path: `${out}/village-${name}.png` });
    await page.click('.village .v-hud [data-action="today"]');
    await page.clock.runFor(600);
    await page.screenshot({ path: `${out}/today-list-${name}.png` });
    await closeModals(page);
    if (name === 'landscape') {
      await talkTo(page, 'a_soccer');
      await page.screenshot({ path: `${out}/coach-talk-${name}.png` });
    }
    await ctx.close();
  }
  // the coach on some maps (the ocean and the moon in a fishbowl helmet)
  for (const theme of ['bg-meadow', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainbow']) {
    const { ctx, page } = await open({ width: 1280, height: 800 }, { theme });
    await talkTo(page, 'a_soccer');
    await page.click('.village .v-dialog [data-v="bye"]');
    await page.clock.runFor(800);
    await view(page, `coach-${theme.slice(3)}`);
    await ctx.close();
  }
  // the shop's Switch buddy button (Esther's day is done, so her shop is open)
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, { kid: 'kid_esther' });
    await page.click('[data-action="wardrobe"]');
    await page.clock.runFor(600);
    await page.screenshot({ path: `${out}/shop-switch-buddy.png` });
    await page.click('[data-action="wardrobe-switch"]');
    await page.clock.runFor(400);
    await page.screenshot({ path: `${out}/shop-switch-buddy-open.png` });
    await ctx.close();
  }
  // a close look: the coach between two villagers, at the same scale (8x), and in his helmet
  {
    const page = await browser.newPage({ viewport: { width: 760, height: 330 } });
    await page.goto(site.url);
    await page.evaluate(async () => {
      const { drawVillager, bowlCanvas, villagerGrid, headRows } = await import('/js/villageart.js');
      document.body.innerHTML = '';
      document.body.style.cssText = 'margin:0;background:#5cbd52;display:flex;gap:28px;padding:24px;align-items:flex-end';
      for (const [kind, happy, bowl] of [['bunny'], ['coach'], ['beaver'], ['coach', true], ['coach', false, 'bg-space']]) {
        const c = drawVillager(document.createElement('canvas'), kind, happy);
        const wrap = document.createElement('div');
        wrap.style.cssText = 'position:relative';
        c.style.cssText = `width:${c.width * 8}px;height:${c.height * 8}px;image-rendering:pixelated;display:block`;
        wrap.append(c);
        if (bowl) {
          const b = bowlCanvas(20, headRows(kind) + 4, bowl);
          b.style.cssText = `position:absolute;left:-16px;bottom:${(villagerGrid(kind).length - headRows(kind) - 2) * 8}px;width:${b.width * 8}px;height:${b.height * 8}px;image-rendering:pixelated`;
          wrap.append(b);
        }
        document.body.append(wrap);
      }
    });
    await page.screenshot({ path: `${out}/coach-sheet.png` });
    await page.close();
  }
  if (errors.length) console.log('page errors:', errors);
  console.log(`kid today previews: ${out}`);
} finally {
  await browser.close();
  site.close();
}
