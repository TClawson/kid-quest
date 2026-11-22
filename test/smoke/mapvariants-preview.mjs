// Pictures of keepy-uppy, hockey and football on every map (the map looks and twists from
// fieldlooks.js and mapplay.js), for checking the art. Run: node test/smoke/mapvariants-preview.mjs [outdir]
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || '/tmp/mapvariants';
const kinds = (process.env.KINDS || 'soccer,hockey,football').split(',');
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 }, deviceScaleFactor: 1 });
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
await page.goto(site.url + 'test/smoke/bloom-sheet.html').catch(() => {});
await page.goto(site.url);
await page.evaluate(() => { document.body.innerHTML = ''; document.body.style.background = '#222'; });
for (const kind of kinds) {
  const png = await page.evaluate(async (kind) => {
    const { Play } = await import('./js/play.js');
    const { Hockey } = await import('./js/hockey.js');
    const { Football } = await import('./js/football.js');
    const maps = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainforest', 'bg-fjord', 'bg-rainbow', 'bg-galaxy'];
    const W = 213; const H = 120; const Z = 3;
    const sheet = document.createElement('canvas'); sheet.width = W * Z * 2 + 10; sheet.height = (H * Z + 10) * 5;
    const sx = sheet.getContext('2d'); sx.imageSmoothingEnabled = false;
    sx.fillStyle = '#222'; sx.fillRect(0, 0, sheet.width, sheet.height);
    const { Fishing } = await import('./js/fishing.js');
    const Game = kind === 'hockey' ? Hockey : kind === 'football' ? Football : kind === 'fishing' ? Fishing : Play;
    maps.forEach((map, i) => {
      const g = new Game({ W, H, kind, map, seed: 5 + i, kid: { name: 'Ava', buddy: { species: 'fox', outfit: {} }, gear: { soccer: 1, hockey: 1, football: 1 } }, visitor: { name: 'Ben', buddy: { species: 'bear', outfit: {} }, gear: { soccer: 1, hockey: 1, football: 1 } } });
      g.tap(W / 2, H / 2);
      if (kind === 'fishing') { g.evAt = 4; for (let k = 0; k < 30 * 12; k += 1) g.step(1 / 30); }
      // a fan sits watching
      if (g.fans) { g.fans.nextAt = 0; }
      for (let k = 0; k < 75; k += 1) { g.step(1 / 30); if (kind === 'football' && g.down?.stage === 'pick' && g.ready()) { const [x, y] = g.down.cones.medium; g.tap(x, y); } }
      if (kind === 'football') { for (let k = 0; k < 40; k += 1) { if (g.down.stage === 'aim') g.tap(1, 1); g.step(1 / 30); } }
      const c = document.createElement('canvas'); c.width = (g.fieldW || W) * (g.Z || 1); c.height = (g.fieldH || H) * (g.Z || 1);
      const x = c.getContext('2d'); g.draw(x);
      const hud = document.createElement('canvas'); hud.width = W * Z; hud.height = H * Z;
      g.phase === 'ready' || g.drawHud(hud.getContext('2d'), Z);
      const ox = (i % 2) * (W * Z + 10); const oy = Math.floor(i / 2) * (H * Z + 10);
      sx.drawImage(c, ox, oy, W * Z, H * Z); sx.drawImage(hud, ox, oy);
    });
    return sheet.toDataURL('image/png');
  }, kind);
  const fs = await import('node:fs');
  fs.mkdirSync(out, { recursive: true });
  fs.writeFileSync(`${out}/${kind}.png`, Buffer.from(png.split(',')[1], 'base64'));
}
if (errors.length) console.log('errors:', errors);
await browser.close(); site.close();
