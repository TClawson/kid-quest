// Draws the Alaskan Fjord village in each season, for looking at the art.
// Run: node test/smoke/fjord-preview.mjs <outDir> [marks] [seasons, comma separated] [scale]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || 'previews';
const marks = process.argv[3] === 'marks';
const seasons = (process.argv[4] || 'summer,autumn,winter,spring').split(',');
const k = Number(process.argv[5] || 2);
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => console.log('LOG', m.text()));
await page.goto(`${site.url}/test/helpers/blank.html`).catch(() => page.goto(site.url));
const shots = await page.evaluate(async ({ marks, seasons, k }) => {
  const { villageLayout } = await import('/js/villagemaps.js');
  const { paintVillage } = await import('/js/villageprops.js');
  const { drawVillager } = await import('/js/villageart.js');
  const res = {};
  const L = villageLayout('bg-fjord');
  for (const season of seasons) {
    const areas = [{ ...L.green.left, kind: 'pond', side: 'left' }, { ...L.green.right, kind: season === 'winter' ? 'hockey' : 'soccer', side: 'right' }];
    const t0 = performance.now();
    const land = paintVillage(document.createElement('canvas'), L, { homeRoof: '#e03131', areas, season, progress: season === 'autumn' ? 0.8 : 0.5 });
    console.log(season, 'painted in', Math.round(performance.now() - t0), 'ms');
    const c = document.createElement('canvas');
    c.width = L.W * k; c.height = L.H * k;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(land, 0, 0, L.W * k, L.H * k);
    if (marks) {
      const folk = drawVillager(document.createElement('canvas'), 'bunny');
      const keeper = drawVillager(document.createElement('canvas'), 'badger');
      const put = (spr, sx, sy) => x.drawImage(spr, (sx - 8) * k, (sy - spr.height) * k, spr.width * k, spr.height * k);
      const dot = (px, py, col, label) => { x.fillStyle = col; x.beginPath(); x.arc(px * k, py * k, 4, 0, 7); x.fill(); if (label) { x.font = 'bold 13px sans-serif'; x.fillStyle = '#000'; x.fillText(label, px * k + 5, py * k - 4); x.fillStyle = '#fff'; x.fillText(label, px * k + 4, py * k - 5); } };
      L.slots.morning.forEach((s, i) => { put(folk, s.x, s.y); dot(s.x, s.y, '#e03131', `M${i + 1}${s.likes ? '*' : ''}`); });
      L.slots.afternoon.forEach((s, i) => { put(folk, s.x, s.y); dot(s.x, s.y, '#1c7ed6', `A${i + 1}${s.likes ? '*' : ''}`); });
      put(keeper, L.shop.x, L.shop.y); dot(L.shop.x, L.shop.y, '#2f9e44', 'shop');
      put(folk, L.coach.x, L.coach.y); dot(L.coach.x, L.coach.y, '#f76707', 'coach');
      dot(L.chest.x, L.chest.y, '#fcc419', 'chest');
      dot(L.start.x, L.start.y, '#ffffff', 'start');
      dot(L.landmark.stand.x, L.landmark.stand.y, '#f783ac', 'look');
      L.green.idle.forEach((s, i) => dot(s.x, s.y, '#be4bdb', `v${i + 1}`));
      x.strokeStyle = 'rgba(255,0,0,0.5)';
      L.obstacles.forEach(([ox, oy, ow, oh]) => x.strokeRect(ox * k, oy * k, ow * k, oh * k));
      x.strokeStyle = 'rgba(255,255,0,0.8)';
      L.crossings.forEach((b) => x.strokeRect(b.x * k, b.y * k, b.w * k, b.h * k));
      x.strokeStyle = 'rgba(255,0,255,0.8)';
      x.strokeRect(L.landmark.x * k, L.landmark.y * k, L.landmark.w * k, L.landmark.h * k);
    }
    res[season] = c.toDataURL('image/png');
  }
  return res;
}, { marks, seasons, k });
for (const [name, url] of Object.entries(shots)) fs.writeFileSync(`${out}/fjord-${name}${marks ? '-marks' : ''}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('drew', Object.keys(shots).join(' '));
await browser.close(); site.close();
