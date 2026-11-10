// Previews of the seasons on every map (js/seasonfx.js): each village in spring, summer, autumn
// (early and late) and winter, with a frozen frame of its weather; the garden behind the buddy's
// house through the year; and the village's own trees and flowers (bloomart.js) as sprites.
// Run: node test/smoke/season-preview.mjs <outDir> [bg-meadow ...] [--only villages|rows|yard|sprites|cost]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
//
// The garden art (js/gardenart.js, js/gardenrules.js) lives on the garden branch: when this tree
// doesn't have it, the preview server reads it from git (GARDEN_REF, by default the garden branch).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { extname, join, normalize } from 'node:path';
import { VILLAGE_THEMES } from '../../js/villagemaps.js';

const args = process.argv.slice(2);
const out = (args.find((a) => !a.startsWith('--') && !a.startsWith('bg-') && !['villages', 'rows', 'yard', 'sprites', 'cost'].includes(a)) || 'previews').replace(/\/$/, '');
const maps = args.filter((a) => a.startsWith('bg-'));
const part = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const GARDEN_REF = process.env.GARDEN_REF || 'claude/project-thread-9mcgbn';
fs.mkdirSync(`${out}/`, { recursive: true });

const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml', '.css': 'text/css', '.json': 'application/json' };
const server = createServer(async (req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([/\\])+/, '');
  let body = null;
  try { body = await readFile(join('.', path)); } catch {
    if (/^js\/garden(art|rules)\.js$/.test(path)) {
      try { body = execFileSync('git', ['show', `${GARDEN_REF}:${path}`], { maxBuffer: 1 << 26 }); } catch { /* not there either */ }
    }
  }
  if (!body) { res.writeHead(404); res.end('not found'); return; }
  res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
  res.end(body);
});
await new Promise((r) => server.listen(0, '127.0.0.1', r));
const site = `http://127.0.0.1:${server.address().port}/`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('note')) console.log('console:', m.text()); });

async function shot(q, file) {
  await page.goto(`${site}test/smoke/season-sheet.html?${q}`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
  await page.locator('#out').screenshot({ path: `${out}/${file}.png` });
}

const SEASONS = [['spring', 0.5], ['summer', 0.5], ['autumn', 0.2], ['autumn', 0.8], ['winter', 0.5]];
for (const map of VILLAGE_THEMES) {
  if (maps.length && !maps.includes(map)) continue;
  if (!part || part === 'rows') await shot(`mode=row&map=${map}&scale=1`, `${map}-year`);
  if (!part || part === 'villages') {
    for (const [s, p] of SEASONS) await shot(`mode=village&map=${map}&season=${s}&p=${p}&scale=2`, `${map}-${s}${s === 'autumn' ? `-${p}` : ''}`);
  }
  console.log(map, 'done');
}
if (!part || part === 'yard') { await shot('mode=yard&scale=3', 'garden-yard-year'); console.log('yard done'); }
if (!part || part === 'sprites') { await shot('mode=sprites&scale=3', 'bloom-sprites'); console.log('sprites done'); }
if (!part || part === 'cost') {
  await page.goto(`${site}test/smoke/season-sheet.html?mode=cost`);
  await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
  console.log(await page.locator('#out').innerText());
}
await browser.close(); server.close();
