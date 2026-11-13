// Runs the Alaskan Fjord's animals on the painted bay and saves film strips of each visit, for
// looking at the art and the timing. Run: node test/smoke/fjord-life-preview.mjs <outDir> [season]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.argv[2] || 'previews';
const season = process.argv[3] || 'summer';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('pageerror', (e) => console.log('ERR', e.message));
page.on('console', (m) => console.log('LOG', m.text()));
await page.goto(`${site.url}/test/helpers/blank.html`).catch(() => page.goto(site.url));
const shots = await page.evaluate(async ({ season }) => {
  const { villageLayout } = await import('/js/villagemaps.js');
  const { paintVillage } = await import('/js/villageprops.js');
  const { fjordLife } = await import('/js/fjordlife.js');
  const L = villageLayout('bg-fjord');
  const areas = [{ ...L.green.left, kind: 'pond', side: 'left' }, { ...L.green.right, kind: season === 'winter' ? 'hockey' : 'soccer', side: 'right' }];
  const land = paintVillage(document.createElement('canvas'), L, { homeRoof: '#e03131', areas, season, progress: 0.5 });
  // the same dice every run
  let seed = 7;
  Math.random = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  const res = {};
  const film = (name, view, crop, frames, k, setup, during) => {
    const actor = fjordLife({ layout: L, aw: L.W, ah: L.H, season });
    actor.state.nextSea = Infinity; actor.state.nextOtters = Infinity; actor.state.nextLand = Infinity;
    actor.state.view = view;
    setup(actor);
    const [cx, cy, cw, ch] = crop;
    const cols = Math.min(frames.length, 4); const rows = Math.ceil(frames.length / cols);
    const c = document.createElement('canvas'); c.width = cols * (cw * k + 4); c.height = rows * (ch * k + 4);
    const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
    const life = document.createElement('canvas'); life.width = L.W; life.height = L.H;
    const lx = life.getContext('2d');
    const last = frames[frames.length - 1];
    for (let f = 1; f <= last; f += 1) {
      during?.(actor, f);
      actor.step(f * 80, view);
      const i = frames.indexOf(f);
      if (i < 0) continue;
      lx.clearRect(0, 0, L.W, L.H);
      actor.draw(lx, f);
      const x = (i % cols) * (cw * k + 4); const y = Math.floor(i / cols) * (ch * k + 4);
      g.drawImage(land, cx, cy, cw, ch, x, y, cw * k, ch * k);
      g.drawImage(life, cx, cy, cw, ch, x, y, cw * k, ch * k);
    }
    res[name] = c.toDataURL('image/png');
  };
  const bay = { top: 200, bottom: 470 };
  // the pod: the whole trip, seen from far enough to follow it
  film('pod', { top: 0, bottom: 700 }, [110, 215, 300, 500], [60, 150, 240, 330, 420, 520, 620, 720], 1, (a) => a.show('pod'));
  film('pod-close', bay, [130, 225, 220, 110], [250, 256, 262, 268, 274, 280, 286, 292], 2, (a) => a.show('pod'));
  // the whale under the puffin
  const dice = Math.random;
  film('whale', bay, [150, 262, 150, 90], [16, 24, 30, 33, 36, 40, 46, 56, 70, 84, 98, 106], 2, (a) => { const p = a.state.puffins[0]; p.x = p.tx = 232; p.y = p.ty = 330; a.state.puffins[1].y = a.state.puffins[1].ty = 430; a.show('whale'); }, (a, f) => { Math.random = f < 8 ? () => 0.3 : dice; });
  // the otters, one tapped
  film('otters', bay, [270, 365, 80, 50], [30, 34, 38, 50, 52, 54, 57, 60, 64, 72, 78, 82, 86, 100, 126, 130, 134, 140], 4, (a) => a.show('otters'), (a, f) => { if (f === 50) a.poke(300, 384); });
  // the moose and the bear
  film('moose', { top: 100, bottom: 370 }, [150, 190, 250, 70], [20, 60, 120, 200, 250, 270, 300, 330], 2, (a) => a.show('moose'));
  film('bear', { top: 100, bottom: 370 }, [250, 195, 150, 60], [20, 60, 110, 125, 150, 170, 200, 230], 3, (a) => a.show('bear'));
  // the waterfall
  film('falls', { top: 250, bottom: 520 }, [360, 290, 80, 160], [1, 2, 3, 4], 3, () => {});
  // the routes and the open water, to check the layout hints
  const c = document.createElement('canvas'); c.width = L.W * 2; c.height = L.H * 2;
  const g = c.getContext('2d'); g.imageSmoothingEnabled = false;
  g.drawImage(land, 0, 0, L.W * 2, L.H * 2);
  const probe = fjordLife({ layout: L, aw: L.W, ah: L.H, season });
  g.strokeStyle = '#ff0'; g.lineWidth = 2; g.beginPath();
  L.life.pod.forEach(([x, y], i) => (i ? g.lineTo(x * 2, y * 2) : g.moveTo(x * 2, y * 2))); g.stroke();
  g.fillStyle = '#f0f'; L.life.whale.forEach(([x, y]) => g.fillRect(x * 2 - 68, y * 2 - 2, 136, 4));
  g.fillStyle = '#0ff'; L.life.otters.flat().forEach(([x, y]) => g.fillRect(x * 2, y * 2 - 2, 52, 4));
  res.routes = c.toDataURL('image/png');
  return res;
}, { season });
for (const [name, url] of Object.entries(shots)) fs.writeFileSync(`${out}/fjord-life-${name}.png`, Buffer.from(url.split(',')[1], 'base64'));
console.log('drew', Object.keys(shots).join(' '));
await browser.close(); site.close();
