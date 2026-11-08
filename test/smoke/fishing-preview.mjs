// Pictures of every map's fishing lake, at tablet size, a few seconds in,
// with a fish on the kid's line, plus a sheet of every map's fish and baits.
// Run: OUT=dir node test/smoke/fishing-preview.mjs [lakes|sheet]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.env.OUT || 'fishing-preview';
const what = process.argv[2] || 'lakes';
mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(site.url);
  await page.evaluate(() => document.fonts.ready);
  if (what === 'lakes') {
    const maps = await page.evaluate(async () => Object.keys((await import('./js/fishing.js')).SPOTS));
    for (const map of maps) {
      const url = await page.evaluate(async (map) => {
        const { Fishing } = await import('./js/fishing.js');
        const vw = 1280; const vh = 800;
        const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
        const W = Math.floor(vw / S); const H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
        const g = new Fishing({ W, H, map, seed: 11, day: '2026-11-08', kid: { name: 'Ava', buddy: { species: 'fox', outfit: { hat: 'hat-cap-blue' } }, gear: { rod: 2 } }, visitor: { name: 'Bear', buddy: { species: 'bear', outfit: {} }, gear: { rod: 2 } } });
        const Z = g.Z || 1;
        const field = document.createElement('canvas'); field.width = W * Z; field.height = H * Z;
        const hud = document.createElement('canvas'); hud.width = W * S; hud.height = H * S;
        g.tap(g.button.x, g.button.y);
        for (let i = 0; i < 30 * 9; i += 1) {
          const L = g.lines.kid;
          if (L.state === 'aim' && g.meter(L) > 0.6 && g.meter(L) < 0.7) g.tap(g.button.x, g.button.y);
          g.step(1 / 30);
        }
        // put a fish on the line for the picture
        const L = g.lines.kid;
        if (L.state === 'water') { const f = g.fish.find((x) => x.state === 'swim' && x.move !== 'school') || g.fish[0]; if (f) g.hook(L, f); }
        for (let i = 0; i < 20; i += 1) g.step(1 / 30);
        g.draw(field.getContext('2d'));
        g.drawHud(hud.getContext('2d'), S);
        const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(field, 0, 0, W * S, H * S); x.drawImage(hud, 0, 0);
        return c.toDataURL('image/png');
      }, map);
      const { writeFileSync } = await import('node:fs');
      writeFileSync(`${out}/${map.replace('bg-', '')}.png`, Buffer.from(url.split(',')[1], 'base64'));
      console.log('wrote', map);
    }
  }
  if (what === 'sheet') {
    const url = await page.evaluate(async () => {
      const { SPOTS, SPECIES, fishPic, baitPic, lookFor, baitNames } = await import('./js/fishing.js');
      const roles = ['bluegill', 'smallmouth', 'largemouth', 'pike', 'catfish', 'special'];
      const Z = 2; const cellW = 230; const rowH = 150; const maps = Object.keys(SPOTS);
      const c = document.createElement('canvas'); c.width = cellW * 6 + 40; c.height = rowH * maps.length + 20;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#1b1430'; x.fillRect(0, 0, c.width, c.height);
      maps.forEach((m, r) => {
        const sp = SPOTS[m]; const y0 = 10 + r * rowH;
        const g = x.createLinearGradient(0, y0, 0, y0 + rowH - 8);
        g.addColorStop(0, sp.water[0]); g.addColorStop(1, sp.water[2]);
        x.fillStyle = g; x.fillRect(10, y0, c.width - 20, rowH - 8);
        x.font = 'bold 18px sans-serif'; x.fillStyle = '#fff'; x.textAlign = 'left'; x.fillText(sp.name, 20, y0 + 22);
        const names = baitNames(m);
        x.font = '13px sans-serif'; let bx = 200;
        for (const b of ['worm', 'jig', 'spoon']) { x.drawImage(baitPic(m, b, Z), bx, y0 + 6, 24, 24); x.fillText(names[b], bx + 28, y0 + 22); bx += 150; }
        roles.forEach((k, i) => {
          const { look, name } = lookFor(m, k);
          const base = k === 'special' ? SPECIES[sp.special.as] : SPECIES[k];
          const len = (base.len[0] + base.len[1]) / 2;
          const pic = fishPic(look, len, Z); const s = 2;
          x.drawImage(pic, 20 + i * cellW + cellW / 2 - (pic.width * s) / 2, y0 + 82 - (pic.height * s) / 2, pic.width * s, pic.height * s);
          x.textAlign = 'center'; x.font = 'bold 14px sans-serif'; x.fillStyle = k === 'special' ? '#ffe066' : '#fff';
          x.fillText(name, 20 + i * cellW + cellW / 2, y0 + rowH - 18); x.textAlign = 'left';
        });
      });
      return c.toDataURL('image/png');
    });
    const { writeFileSync } = await import('node:fs');
    writeFileSync(`${out}/fish-sheet.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote sheet');
  }
} finally {
  await browser.close(); site.close();
}
