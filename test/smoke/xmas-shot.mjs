// Quick screenshot of a page in test/smoke: node test/smoke/xmas-shot.mjs <page?query> <out.png> [width]
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
const [, , url, out, w = '1400'] = process.argv;
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: Number(w), height: 400 }, deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
await page.goto(`${site.url}test/smoke/${url}`);
await page.waitForSelector('body[data-ready]', { timeout: 15000 });
await page.screenshot({ path: out, fullPage: true });
await browser.close(); site.close();
