// How a kid fares against the deep water's giant: a kid-like reeler (holds, lets go 0.3 s after
// the line passes 0.75, holds again once it's slack) on every map, with each rod. Prints how many are
// landed and how long the fight takes. Run: node test/smoke/giant-sim.mjs [pull to try] [kind instead of the giant, size 1] [let go at] [how late]
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  await page.goto(site.url);
  const res = await page.evaluate(async ([pull, kind, hi, late]) => {
    const { Fishing, DEEP_FISH, DEEP_BASE } = await import('./js/fishing.js');
    if (pull) DEEP_BASE.pull = pull; // try another pull
    const out = {};
    for (const tier of [1, 2, 3]) {
      let landed = 0; const times = []; const why = {};
      for (let seed = 1; seed <= 60; seed += 1) {
        const map = Object.keys(DEEP_FISH)[seed % 10];
        const g = new Fishing({ W: 213, H: 133, map, seed, day: '2026-11-27', kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { rod: tier, boat: 1 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} }, gear: { rod: 1 } } });
        g.phase = 'play'; g.camX = g.camMax; g.deepAt = 0; g.step(1 / 30);
        const f = kind === 'deep' ? g.fish.find((x) => x.deep) : g.makeFish(kind, 0, 0, 'cruise');
        if (kind !== 'deep') f.size = f.pick = 1;
        const L = g.lines.kid; L.state = 'water'; L.x = g.homeX + 14 + g.reach * (0.4 + (seed % 5) * 0.12); L.y = g.H * 0.75; f.x = L.x; f.y = L.y; g.hook(L, f);
        const t0 = g.t; let want = true; let at = null; L.held = true; L.downAt = g.t - 1;
        for (let i = 0; i < 30 * 120 && L.state === 'fight'; i += 1) {
          const w = L.tension > hi ? false : L.tension < 0.35 ? true : want;
          if (w !== want) { if (at === null) at = g.t + late; if (g.t >= at) { want = w; at = null; L.held = want; L.downAt = g.t - 1; } }
          g.step(1 / 30);
        }
        if (g.catches.some((c) => c.deep)) { landed += 1; times.push(g.t - t0); } else why[L.slack > 2 ? 'away' : L.state === 'fight' ? 'still on' : 'snap'] = (why[L.slack > 2 ? 'away' : L.state === 'fight' ? 'still on' : 'snap'] || 0) + 1;
      }
      times.sort((a, b) => a - b);
      out[`rod ${tier}`] = { landed: `${landed}/60`, median: times[times.length >> 1]?.toFixed(1), p90: times[Math.floor(times.length * 0.9)]?.toFixed(1), lost: JSON.stringify(why) };
    }
    return out;
  }, [Number(process.argv[2]) || 0, process.argv[3] || 'deep', Number(process.argv[4]) || 0.75, Number(process.argv[5]) || 0.3]);
  console.table(res);
} finally { await browser.close(); site.close(); }
