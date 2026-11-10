// Previews of the garden art (js/gardenart.js), from test/smoke/garden-sheet.html: the yard
// with every fence and path, every plant at every stage (normal and droopy), the trees with
// fruit, decorations, watering cans, critters, shop thumbs, the house's harvest pieces, the
// protective domes, a full garden at 3x and the garden beside the house inside.
// Run: node test/smoke/garden-art-preview.mjs [outDir] [mode ...]
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { serve } from '../helpers/serve.mjs';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const out = (args[0] && args[0].includes('/') ? args.shift() : '/mnt/project-files/kid-quest-previews/garden/art/').replace(/\/?$/, '/');
fs.mkdirSync(out, { recursive: true });

const SHOTS = [
  ['yards', 'yards.png', 'mode=yards'],
  ['plants', 'plants.png', 'mode=plants&scale=4'],
  ['trees', 'trees.png', 'mode=trees'],
  ['decor', 'decor.png', 'mode=decor&scale=5'],
  ['thumbs', 'thumbs.png', 'mode=thumbs'],
  ['house', 'house-pieces.png', 'mode=house&scale=3'],
  ['full', 'full-garden.png', 'mode=full&scale=3'],
  ['full', 'full-garden-buddy.png', 'mode=full&scale=3&buddy=1'],
  ['compare', 'house-and-garden.png', 'mode=compare&scale=2'],
  ['shields', 'shields.png', 'mode=shields'],
  ['full', 'full-bubble-ocean.png', 'mode=full&scale=3&shield=bubble&theme=ocean'],
  ['full', 'full-bubble-space.png', 'mode=full&scale=3&shield=bubble&theme=space'],
  ['full', 'full-bubble-galaxy.png', 'mode=full&scale=3&shield=bubble&theme=galaxy'],
  ['full', 'full-heat-volcano.png', 'mode=full&scale=3&shield=heat&theme=volcano'],
];

const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
for (const [mode, file, query] of SHOTS) {
  if (args.length && !args.includes(mode)) continue;
  await page.goto(`${site.url}test/smoke/garden-sheet.html?${query}`);
  await page.waitForSelector('body[data-ready]', { timeout: 20000 });
  const box = await page.evaluate(() => { const r = document.getElementById('out').getBoundingClientRect(); return { w: Math.ceil(r.right + 8), h: Math.ceil(r.bottom + 8) }; });
  await page.setViewportSize({ width: Math.max(400, box.w), height: Math.max(300, box.h) });
  await page.screenshot({ path: `${out}${file}`, fullPage: true });
  console.log(`${out}${file}`);
}
await browser.close();
site.close();
