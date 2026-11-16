// Previews of tag's power-ups, map tricks and visitor personalities: a still of
// every map, the start screen's tips, and short films of a few games.
// Run: SHOTS=/some/folder node test/smoke/tag-preview.mjs
import { chromium } from 'playwright';
import { mkdirSync, renameSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from '../helpers/serve.mjs';

const out = process.env.SHOTS || 'tag-previews';
mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();

const PAGE = `<!doctype html><html><head><meta charset="utf-8">
<style>@font-face { font-family: 'Jersey 10'; src: url('fonts/jersey-10-latin-400-normal.woff2') format('woff2'); }
body { margin: 0; background: #1b1430; color: #fff; font: 20px 'Jersey 10', monospace; }
.stage { position: relative; display: inline-block; } .stage canvas { position: absolute; left: 0; top: 0; image-rendering: pixelated; }
.grid { display: grid; grid-template-columns: repeat(2, auto); gap: 14px; padding: 14px; } .cell b { display: block; margin: 0 0 4px; font-size: 26px; color: #ffd43b; }
</style></head><body><div id="root"></div>
<script type="module">
import { Play } from './js/play.js';
import { MAP_TRICKS } from './js/tagfun.js';
const BUDDY = { fox: { species: 'fox', outfit: { hat: 'hat-cap' } }, bear: { species: 'bear', outfit: {} }, cat: { species: 'cat', outfit: {} }, puppy: { species: 'puppy', outfit: {} } };
// a pretend kid: runs for power-ups and away from the visitor, chases it when IT
function bot(g) {
  const k = g.kid, v = g.vis, b = g.bounds, pw = g.fun.power;
  if (g.it === 'kid') g.runTo(v.x + v.vx * 0.2, v.y - 8);
  else if (pw && Math.hypot(pw.x - k.x, pw.y - k.y) < 60) g.runTo(pw.x, pw.y - 8);
  else g.runTo(v.x > (b.x0 + b.x1) / 2 ? b.x0 + 12 : b.x1 - 12, (v.y > (b.y0 + b.y1) / 2 ? b.y0 + 6 : b.y1 - 6) - 8);
}
function make(parent, { map, visitor = 'bear', name = 'Max', S = 4, W = 213, H = 133, seed = 3 }) {
  const stage = document.createElement('div'); stage.className = 'stage';
  stage.style.width = W * S + 'px'; stage.style.height = H * S + 'px';
  const f = document.createElement('canvas'); f.width = W; f.height = H; f.style.width = W * S + 'px'; f.style.height = H * S + 'px';
  const h = document.createElement('canvas'); h.width = W * S; h.height = H * S;
  stage.append(f, h); parent.append(stage);
  const g = new Play({ W, H, kind: 'tag', seed, map, kid: { buddy: BUDDY.fox, name: 'Sam', gear: { shoes: 1 } }, visitor: { buddy: BUDDY[visitor], name, gear: {} } });
  const draw = () => { g.draw(f.getContext('2d')); g.drawHud(h.getContext('2d'), S); };
  return { g, draw };
}
// play some seconds at once, as a pretend kid
function run(g, secs, until) {
  for (let i = 0; i < secs * 60; i += 1) {
    if (i % 12 === 0) bot(g);
    g.step(1 / 60);
    if (g.phase !== 'play') { g.t += 1.3; g.tap(g.vis.x - g.camX, g.vis.y - 10); g.tap(g.vis.x - g.camX, g.vis.y - 10); }
    if (until && i > 60 && until(g)) return;
  }
}
window.still = (opts, secs, want) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  const { g, draw } = make(root, opts);
  if (secs) { g.tap(g.vis.x, g.vis.y - 10); run(g, secs, want && ((gg) => want.every((w) => gg.fun.power?.kind === w || gg.fun.feats.some((f) => f.kind === w) || (w === 'blow' && gg.fun.feats.some((f) => f.kind === 'vent' && f.phase != null && (((gg.t + f.phase) % 5.5) > 4.75))) || (w === 'wave' && gg.fun.wet({ y: gg.bounds.y1 - 12 })) || (w === 'hidden' && gg.t < gg.vis.hidden) || (w === 'iced' && gg.t < gg.vis.iced)))); }
  else g.t = 0.6;
  draw();
};
window.grid = (list) => {
  const root = document.getElementById('root'); root.innerHTML = '<div class="grid"></div>';
  const grid = root.firstChild;
  for (const o of list) {
    const cell = document.createElement('div'); cell.className = 'cell';
    cell.innerHTML = '<b>' + MAP_TRICKS[o.map].name + '</b>'; grid.append(cell);
    const { g, draw } = make(cell, { ...o, S: 3 });
    g.tap(g.vis.x, g.vis.y - 10); run(g, o.secs || 6); draw();
  }
};
window.film = (opts) => {
  const root = document.getElementById('root'); root.innerHTML = '';
  const { g, draw } = make(root, opts);
  let n = 0; let last = performance.now();
  const frame = (now) => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (n === 40) g.tap(g.vis.x - g.camX, g.vis.y - 10);
    if (n > 40 && n % 12 === 0) bot(g);
    if (g.phase === 'over' && g.t - g.overAt > 2) { g.tap(0, 0); g.tap(g.vis.x - g.camX, g.vis.y - 10); }
    g.step(dt); draw(); n += 1;
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
};
window.ready = true;
</script></body></html>`;

async function page(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 852, height: 532 }, deviceScaleFactor: 1, ...opts });
  const p = await ctx.newPage();
  await p.route('**/tag-preview.html', (r) => r.fulfill({ contentType: 'text/html', body: PAGE }));
  await p.goto(`${site.url}tag-preview.html`);
  await p.waitForFunction(() => window.ready);
  await p.evaluate(() => document.fonts.load("20px 'Jersey 10'"));
  return { ctx, p };
}

// stills: each map, at a moment that shows off its trick
const SHOWS = {
  'bg-meadow': ['mud'], 'bg-sunset': ['wave'], 'bg-ocean': ['current'], 'bg-space': ['crater'], 'bg-castle': ['door'],
  'bg-volcano': ['blow'], 'bg-rainforest': ['pad'], 'bg-fjord': ['ice'], 'bg-rainbow': ['rainbow'], 'bg-galaxy': ['well'],
};
{
  const { ctx, p } = await page();
  for (const [map, want] of Object.entries(SHOWS)) {
    await p.evaluate(([map, want]) => window.still({ map, visitor: 'bear', seed: 11 }, 30, [...want]), [map, want]);
    await p.screenshot({ path: join(out, `map-${map.replace('bg-', '')}.png`) });
  }
  // the start screen: who you're playing and the map's twist
  for (const [visitor, name, map] of [['fox', 'Ava', 'bg-fjord'], ['puppy', 'Max', 'bg-volcano'], ['cat', 'Lu', 'bg-castle']]) {
    await p.evaluate((o) => window.still(o, 0), { map, visitor, name });
    await p.screenshot({ path: join(out, `start-${visitor}.png`) });
  }
  // power-ups: a hidden visitor, a frozen visitor
  await p.evaluate(() => window.still({ map: 'bg-meadow', visitor: 'fox', name: 'Ava', seed: 21 }, 120, ['hidden']));
  await p.screenshot({ path: join(out, 'power-hidden.png') });
  await p.evaluate(() => window.still({ map: 'bg-rainforest', visitor: 'cat', name: 'Lu', seed: 4 }, 120, ['iced']));
  await p.screenshot({ path: join(out, 'power-frozen.png') });
  await ctx.close();
}
{
  const { ctx, p } = await page({ viewport: { width: 1310, height: 2100 } });
  await p.evaluate((list) => window.grid(list), Object.keys(SHOWS).map((map, i) => ({ map, seed: 5 + i, visitor: ['fox', 'puppy', 'cat'][i % 3], name: ['Ava', 'Max', 'Lu'][i % 3], secs: 9 + i })));
  await p.screenshot({ path: join(out, 'all-maps.png'), fullPage: true });
  await ctx.close();
}
// films: a few games, played by the pretend kid
for (const [map, visitor, name] of [['bg-volcano', 'puppy', 'Max'], ['bg-fjord', 'cat', 'Lu'], ['bg-castle', 'fox', 'Ava'], ['bg-rainforest', 'bear', 'Max']]) {
  const dir = join(out, 'tmp-video');
  const { ctx, p } = await page({ recordVideo: { dir, size: { width: 852, height: 532 } } });
  await p.evaluate((o) => window.film(o), { map, visitor, name, seed: 9 });
  await p.waitForTimeout(24000);
  await ctx.close();
  const f = readdirSync(dir).find((x) => x.endsWith('.webm'));
  renameSync(join(dir, f), join(out, `film-${map.replace('bg-', '')}.webm`));
}
await browser.close();
site.close();
console.log('previews in', out);
