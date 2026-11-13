// The fjord's lighthouse on the painted bay: asleep and awake, summer and winter.
// Run: node test/smoke/fjord-lighthouse-preview.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${site.url}/test/helpers/blank.html`).catch(() => page.goto(site.url));
const url = await page.evaluate(async () => {
  const { villageLayout } = await import('/js/villagemaps.js');
  const { paintVillage } = await import('/js/villageprops.js');
  const { LIGHTHOUSE, startLighthouse } = await import('/js/lighthouseart.js');
  const L = villageLayout('bg-fjord');
  const lm = L.landmark;
  const k = 3; const pad = 30;
  const cw = LIGHTHOUSE.w + pad * 2; const ch = LIGHTHOUSE.h + 40;
  const shots = [['summer', -1e9, 1000], ['summer', 0, 1200], ['summer', 0, 1600], ['summer', 0, 2050], ['winter', -1e9, 1000], ['winter', 0, 1900]];
  const c = document.createElement('canvas'); c.width = shots.length * (cw * k + 4); c.height = ch * k;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  shots.forEach(([season, wake, now], i) => {
    const land = paintVillage(document.createElement('canvas'), L, { homeRoof: '#e03131', areas: [], season, progress: 0.5 });
    const art = document.createElement('canvas'); art.width = LIGHTHOUSE.w; art.height = LIGHTHOUSE.h;
    const host = { dataset: { wake: String(wake) } };
    startLighthouse(art, host, { season })(now);
    const x = i * (cw * k + 4);
    g.drawImage(land, lm.x - pad, lm.y - 20, cw, ch, x, 0, cw * k, ch * k);
    g.drawImage(art, 0, 0, LIGHTHOUSE.w, LIGHTHOUSE.h, x + pad * k, 20 * k, LIGHTHOUSE.w * k, LIGHTHOUSE.h * k);
  });
  return c.toDataURL('image/png');
});
fs.writeFileSync(`${out}/fjord-lighthouse.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('drew the lighthouse');
await browser.close(); site.close();
