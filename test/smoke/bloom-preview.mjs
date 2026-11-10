// Previews of the village's own trees, flowers and critters (js/bloomart.js, js/bloomspots.js):
// a sheet of every map's art, then each village as a family's effort grows it: "week 2" (a few
// young trees and flowers), "month 4" (about a dozen trees half to fully grown, lots of flowers),
// "year" (every tree grown, meadows of bloom, critters out) and "wilted" (after a bad week).
// Run: node test/smoke/bloom-preview.mjs <outDir> [theme] [--only sheet|village] [--marks]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { VILLAGE_THEMES } from '../../js/villagemaps.js';

const args = process.argv.slice(2);
const out = (args.find((a) => !a.startsWith('--') && !a.startsWith('bg-')) || 'previews').replace(/\/$/, '');
const only = args.find((a) => a.startsWith('bg-'));
const part = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const marks = args.includes('--marks');
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('landmark')) console.log('console:', m.text()); });

async function shot(url, file) {
  await page.goto(`${site.url}test/smoke/bloom-sheet.html?${url}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 60000 });
  await page.locator('#out').screenshot({ path: `${out}/${file}.png` });
}

for (const theme of VILLAGE_THEMES) {
  if (only && theme !== only) continue;
  if (part !== 'village') await shot(`map=${theme}&mode=sheet&scale=3`, `${theme}-sheet`);
  if (part !== 'sheet') {
    for (const at of ['week2', 'month4', 'year', 'wilted']) await shot(`map=${theme}&mode=village&at=${at}&scale=2${marks ? '&marks=1' : ''}`, `${theme}-${at}`);
  }
  console.log(theme, 'done');
}
await browser.close(); site.close();
