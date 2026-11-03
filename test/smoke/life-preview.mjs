// Records short videos of the moving things on each map theme.
// Run: node test/smoke/life-preview.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
// theme, seconds to record, where to look ('top' or 'bottom' of the map)
const SHOTS = [['bg-sunset', 14, 'top'], ['bg-ocean', 14, 'top'], ['bg-space', 18, 'top'], ['bg-volcano', 13, 'bottom'], ['bg-castle', 22, 'mid'], ['bg-rainbow', 12, 'top'], ['bg-galaxy', 12, 'top']];
const only = process.argv[3];
const site = await serve('.');
const browser = await chromium.launch();
const size = { width: 800, height: 900 };
try {
  for (const [theme, secs, where] of SHOTS) {
    if (only && !theme.includes(only)) continue;
    const ctx = await browser.newContext({ viewport: size, recordVideo: { dir: `${out}/raw`, size } });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    const saved = emptyState();
    saved.settings.pinHash = 'sha256:test';
    saved.settings.sound = false;
    const tasks = defaultTasks();
    const mk = (id, name, color, species) => ({ id, name, color, tasks, startDate: dateKey(), buddy: { species, outfit: { background: theme } } });
    saved.kids.push(mk('kid_ava', 'Ava', '#ff6b6b', 'fox'));
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();
    await page.click('[data-action="open-kid"]');
    const box = await page.locator('.quest-map').boundingBox();
    const y = where === 'top' ? box.y - 10 : where === 'bottom' ? box.y + box.height - size.height + 10 : box.y + box.height / 2 - size.height / 2;
    await page.evaluate((yy) => window.scrollTo(0, yy), y);
    // repaint so the map starts its clock (and picks spots) where we are looking
    await page.evaluate(() => window.dispatchEvent(new Event('resize')));
    const t0 = Date.now();
    await page.waitForTimeout(400);
    const start = (Date.now() - t0) / 1000;
    if (theme === 'bg-sunset') {
      // tap the sand near a crab, twice, so the crabs come running
      for (const [dx, dy] of [[45, 20], [-40, 30]]) {
        await page.waitForTimeout(2500);
        const p = await page.evaluate(([ox, oy]) => {
          const s = document.querySelector('.quest-map');
          const r = s.getBoundingClientRect();
          const w = s.mapLife.where();
          return { x: r.left + (w.x + ox) * 4, y: r.top + (w.y + oy) * 4 };
        }, [dx, dy]);
        await page.mouse.click(p.x, p.y);
        await page.waitForTimeout(3000);
      }
    }
    if (theme === 'bg-rainbow') {
      await page.waitForTimeout(4000);
      const p = await page.evaluate(() => {
        const s = document.querySelector('.quest-map');
        const r = s.getBoundingClientRect();
        const w = s.mapLife.where();
        return { x: r.left + w.x * 4, y: r.top + w.y * 4 };
      });
      await page.mouse.click(p.x, p.y);
    }
    await page.waitForTimeout(secs * 1000);
    const vbox = await page.locator('.quest-map').boundingBox();
    await ctx.close();
    const video = await page.video().path();
    const cy = Math.max(0, Math.round(vbox.y));
    const ch = Math.min(size.height, Math.round(vbox.y + vbox.height)) - cy;
    fs.writeFileSync(`${out}/raw/${theme}.json`, JSON.stringify({ video, crop: [Math.round(vbox.width), ch, Math.round(vbox.x), cy], skip: start }));
    if (errors.length) console.log(theme, errors);
    console.log(theme, 'recorded');
  }
} finally {
  await browser.close();
  site.close();
}
