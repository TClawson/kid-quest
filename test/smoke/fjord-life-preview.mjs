// Draws the Alaskan Fjord's animals on the painted bay, and its fish, for looking at the art.
// Run: node test/smoke/fjord-life-preview.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => console.log('LOG', m.text()));
await page.goto(`${site.url}/test/helpers/blank.html`).catch(() => page.goto(site.url));
const shots = await page.evaluate(async () => {
  const { villageLayout } = await import('/js/villagemaps.js');
  const { paintVillage } = await import('/js/villageprops.js');
  const F = await import('/js/fjordlife.js');
  const { fishPic } = await import('/js/fishart.js');
  const P = F.FJORD_PAL;
  const L = villageLayout('bg-fjord');
  const areas = [{ ...L.green.left, kind: 'pond', side: 'left' }, { ...L.green.right, kind: 'soccer', side: 'right' }];
  const land = paintVillage(document.createElement('canvas'), L, { homeRoof: '#e03131', areas, season: 'summer', progress: 0.5 });
  const x = land.getContext('2d');
  // rows drawn with their bottom row at y; in the water the lowest `sink` rows stay under and foam marks the line
  const put = (rows, pal, px, py, o = {}) => {
    const sink = o.sink || 0;
    const h = rows.length - sink; const w = rows[0].length;
    for (let j = 0; j < h; j += 1) {
      for (let i = 0; i < w; i += 1) {
        const ch = rows[j][o.flip ? w - 1 - i : i];
        if (ch === '.' || ch === undefined) continue;
        x.fillStyle = pal[ch] || P.K;
        x.fillRect(px + i, py - h + j, 1, 1);
      }
    }
    if (o.foam) {
      const last = rows[h - 1];
      for (let i = -2; i < w + 2; i += 1) {
        const ch = last[o.flip ? w - 1 - i : i];
        const solid = ch && ch !== '.';
        const r = Math.sin((px + i) * 12.9898 + py * 78.233) * 43758.5453; const n = r - Math.floor(r);
        if (solid ? n < 0.6 : n < 0.25) { x.fillStyle = n < 0.3 ? '#ffffff' : '#cfeaf2'; x.fillRect(px + i, py, 1, 1); }
        if (solid && n > 0.5) { x.fillStyle = 'rgba(20,50,70,0.35)'; x.fillRect(px + i, py + 1, 1, 1); }
      }
    }
  };
  const wet = { sink: 1, foam: true };
  // the orca pod, crossing the open bay
  put(F.ORCA_BULL, P.orca, 190, 300, wet);
  put(F.ORCA_BLOW, P.spray, 216, 285);
  put(F.ORCA_COW, P.orca, 148, 312, wet);
  put(F.ORCA_CALF, P.orca, 172, 322, wet);
  put(F.ORCA_FIN, P.orca, 238, 316, wet);
  // the humpback and the puffin it launches
  put(F.WHALE_BACK, P.whale, 150, 392, wet);
  put(F.WHALE_BLOW[2], P.spray, 196, 384);
  put(F.PUFFIN_UP[0], P.puffin, 197, 366);
  put(F.PUFFIN, P.puffin, 236, 380, wet);
  put(F.WHALE_FLUKE, P.whale, 124, 424, wet);
  // sea otters by the islet
  put(F.OTTER[0], P.otter, 286, 388, wet);
  put(F.OTTER[1], P.otter, 300, 402, wet);
  put(F.OTTER_FUMBLE, P.otter, 292, 420, wet);
  put(F.OTTER_OH, P.otter, 252, 436, wet);
  put(F.OTTER_DIVE, P.otter, 300, 440, wet);
  put(F.OYSTER, P.otter, 318, 426);
  // the moose in the shallows, the grizzly at the creek mouth
  put(F.MOOSE, P.moose, 196, 234, { sink: 5, foam: true });
  put(F.MOOSE_EATS, P.moose, 142, 240, { sink: 5, foam: true });
  put(F.GRIZZLY, P.bear, 258, 236, { sink: 3, foam: true });
  put(F.GRIZZLY_CATCH, P.bear, 330, 250, { sink: 3, foam: true });
  put(F.SALMON_LEAP, P.bear, 302, 226);

  const res = {};
  const crop = (cx, cy, cw, ch, k) => {
    const c = document.createElement('canvas'); c.width = cw * k; c.height = ch * k;
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    g.drawImage(land, cx, cy, cw, ch, 0, 0, cw * k, ch * k);
    return c.toDataURL('image/png');
  };
  res['life-all'] = crop(0, 150, 448, 330, 2);
  res['life-orcas'] = crop(130, 268, 150, 62, 5);
  res['life-whale'] = crop(118, 348, 150, 80, 5);
  res['life-otters'] = crop(240, 372, 110, 74, 5);
  res['life-shore'] = crop(130, 196, 250, 62, 4);

  // the fish: nose on the left, at the biggest size of each kind
  const look = (back, side, belly, fin, more = {}) => ({ back, side, belly, fin, ...more });
  const fish = [
    ['Herring', 13, look('#2a5a8a', '#c8d4dc', '#f8f9fa', '#868e96', { depth: 0.3, mark: 'scales' })],
    ['Dolly Varden', 22, look('#4a6a52', '#8aa894', '#f6c9b4', '#e8590c', { depth: 0.3, mark: 'spots', spot: '#ff8fa3' })],
    ['Sockeye salmon', 30, look('#a61e2a', '#e03131', '#c92a2a', '#5c8a3a', { depth: 0.34, mouth: 'big' })],
    ['Lingcod', 46, look('#4a4030', '#8a7a50', '#e0d4a8', '#5c5030', { depth: 0.2, mark: 'blotch', bar: '#3a3020', snout: true, fangs: true, mouth: 'big' })],
    ['Halibut', 40, look('#4a4a3a', '#7a7458', '#f0ead8', '#5c5540', { depth: 0.36, flat: true, mark: 'spots', spot: '#a8a080', tail: 'fan' })],
    ['King salmon (rare)', 34, look('#3a4a5a', '#c8ced8', '#f8f9fa', '#5c6670', { depth: 0.34, mark: 'spots', spot: '#2a3040', mouth: 'big' })],
  ];
  const Z = 2; const k = 3;
  const c = document.createElement('canvas'); c.width = 900; c.height = 460;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  const grd = g.createLinearGradient(0, 0, 0, c.height); grd.addColorStop(0, '#2c8ea0'); grd.addColorStop(1, '#0f4a5c');
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height);
  g.font = 'bold 20px sans-serif';
  fish.forEach(([name, len, lk], i) => {
    const pic = fishPic(lk, len, Z);
    const col = i % 2; const row = Math.floor(i / 2);
    const bx = 30 + col * 440; const by = 20 + row * 150;
    g.drawImage(pic, bx, by + (100 - pic.height * k / Z) / 2, pic.width * k / Z * 1.5, pic.height * k / Z * 1.5);
    g.fillStyle = '#062630'; g.fillText(name, bx + 1, by + 139);
    g.fillStyle = '#ffffff'; g.fillText(name, bx, by + 138);
  });
  res['fish'] = c.toDataURL('image/png');
  return res;
});
for (const [name, url] of Object.entries(shots)) fs.writeFileSync(`${out}/fjord-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('drew', Object.keys(shots).join(' '));
await browser.close(); site.close();
