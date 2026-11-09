// Draws every map's village with where things stand marked on it, for laying villages out.
// Run: node test/smoke/village-maps.mjs <outDir> [theme]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || 'previews';
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(`${site.url}/test/helpers/blank.html`).catch(() => page.goto(site.url));
const shots = await page.evaluate(async (only) => {
  const { villageLayout, VILLAGE_THEMES } = await import('/js/villagemaps.js');
  const { paintVillage } = await import('/js/villageprops.js');
  const { secretSvg, secretSize } = await import('/js/treasure-art.js');
  const { drawVillager } = await import('/js/villageart.js');
  const res = {};
  for (const theme of VILLAGE_THEMES) {
    if (only && theme !== only) continue;
    const L = villageLayout(theme);
    const areas = [{ ...L.green.left, kind: 'pond', side: 'left' }, { ...L.green.right, kind: 'soccer', side: 'right' }];
    const land = paintVillage(document.createElement('canvas'), L, { homeRoof: '#e03131', areas });
    const k = 2;
    const c = document.createElement('canvas');
    c.width = L.W * k; c.height = L.H * k;
    const x = c.getContext('2d');
    x.imageSmoothingEnabled = false;
    x.drawImage(land, 0, 0, L.W * k, L.H * k);
    // the landmark, at the size the village shows it
    const size = secretSize(theme);
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(secretSvg(theme, 1, { smooth: 2 }))}`;
    await img.decode();
    x.drawImage(img, L.landmark.x * k, L.landmark.y * k, size.w * 2 * k, size.h * 2 * k);
    const folk = drawVillager(document.createElement('canvas'), 'bunny');
    const keeper = drawVillager(document.createElement('canvas'), 'badger');
    const put = (spr, sx, sy) => x.drawImage(spr, (sx - 8) * k, (sy - spr.height) * k, spr.width * k, spr.height * k);
    const dot = (px, py, col, label) => { x.fillStyle = col; x.beginPath(); x.arc(px * k, py * k, 4, 0, 7); x.fill(); if (label) { x.font = 'bold 14px sans-serif'; x.fillStyle = '#000'; x.fillText(label, px * k + 5, py * k - 4); x.fillStyle = '#fff'; x.fillText(label, px * k + 4, py * k - 5); } };
    L.slots.morning.slice(0, 6).forEach((s, i) => { put(folk, s.x, s.y); dot(s.x, s.y, '#e03131', `M${i + 1}${s.likes ? '*' : ''}`); });
    L.slots.afternoon.slice(0, 6).forEach((s, i) => { put(folk, s.x, s.y); dot(s.x, s.y, '#1c7ed6', `A${i + 1}${s.likes ? '*' : ''}`); });
    put(keeper, L.shop.x, L.shop.y); dot(L.shop.x, L.shop.y, '#2f9e44', 'shop');
    dot(L.chest.x, L.chest.y, '#fcc419', 'chest');
    dot(L.start.x, L.start.y, '#ffffff', 'start');
    dot(L.landmark.stand.x, L.landmark.stand.y, '#f783ac', 'look');
    L.green.idle.forEach((s, i) => dot(s.x, s.y, '#be4bdb', `v${i + 1}`));
    for (const [lx, ly, t] of [L.labels.morning, L.labels.afternoon]) { x.font = 'bold 16px sans-serif'; x.fillStyle = 'rgba(0,0,0,0.6)'; const w = x.measureText(t).width; x.fillRect(lx * k - w / 2 - 4, ly * k - 4, w + 8, 22); x.fillStyle = '#fff'; x.fillText(t, lx * k - w / 2, ly * k + 13); }
    res[theme] = c.toDataURL('image/png');
  }
  return res;
}, only);
for (const [theme, url] of Object.entries(shots)) fs.writeFileSync(`${out}/${theme}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('drew', Object.keys(shots).join(' '));
await browser.close(); site.close();
