// Screenshots of the December art on its own (test/smoke/xmas-sheet.html), for previews.
// Run: node test/smoke/xmas-sheet.mjs <mode> <out.png> [scale]
//   modes: inside (the advent wall), houses (every advent house, day and night), team (the sleigh's
//   flying frames), prizes (the opened present and Santa's letter), letter, bits (trees, lanterns, wreaths)
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import { join } from 'node:path';
import { serve } from '../helpers/serve.mjs';

const [mode = 'inside', out = `xmas-${mode}.png`, scale = '3'] = process.argv.slice(2);
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 3000, height: 1000 } });
page.on('pageerror', (e) => console.log('ERR', e.message));
// optional: KQ_HOUSE=<a checkout with js/xmasart.js> shows the real ornaments in the advent doors (mode inside)
if (process.env.KQ_HOUSE) await page.route('**/house/js/**', (r) => r.fulfill({ path: join(process.env.KQ_HOUSE, 'js', new URL(r.request().url()).pathname.replace(/^\/house\/js\//, '')), contentType: 'text/javascript' }));
await page.goto(`${site.url}test/smoke/xmas-sheet.html?mode=${mode}&scale=${scale}`);
await page.waitForSelector('body[data-ready="1"]', { timeout: 120000 });
await page.locator('#out').screenshot({ path: out });
await browser.close(); site.close();
