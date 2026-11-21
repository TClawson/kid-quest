// Pictures of the sled's treasure hill on every map, at tablet size, with a simple bot riding:
// it jumps what's in the way and lands the Big Jump. Also a sheet of every find.
// Run: OUT=dir node test/smoke/sled-preview.mjs [hills|sheet] [season] [tier]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';
import { serve } from '../helpers/serve.mjs';

const out = process.env.OUT || 'sled-preview';
const what = process.argv[2] || 'hills';
const season = process.argv[3] || 'winter';
const tier = Number(process.argv[4] || 1);
mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const save = (name, url) => { writeFileSync(`${out}/${name}.png`, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name); };
try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error' || m.text().startsWith('LOG')) console.log(m.text()); });
  await page.goto(site.url);
  await page.evaluate(() => document.fonts.ready);
  if (what === 'hills') {
    const maps = await page.evaluate(async () => Object.keys((await import('./js/slopes.js')).HILLS));
    for (const map of maps) {
      const shots = await page.evaluate(async ({ map, season, tier }) => {
        const { Sledding, BIG_AT, RUN_LEN } = await import('./js/sledding.js');
        const vw = 1280; const vh = 800;
        const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
        const W = Math.floor(vw / S); const H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
        const records = {};
        const g = new Sledding({ W, H, map, seed: 7, day: '2026-12-08', season, kid: { name: 'Ava', buddy: { species: 'fox', outfit: { hat: 'hat-cap-blue' } }, gear: { sled: tier } }, visitor: { name: 'Bear', buddy: { species: 'bear', outfit: {} }, gear: { sled: 2 } },
          onFind: (f) => { const had = records[f.key]; records[f.key] = f; return had ? null : 'new'; } });
        const field = document.createElement('canvas'); field.width = g.fieldW; field.height = g.fieldH;
        const hud = document.createElement('canvas'); hud.width = W * S; hud.height = H * S;
        const snap = () => {
          g.draw(field.getContext('2d'));
          g.drawHud(hud.getContext('2d'), S);
          const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
          const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
          x.drawImage(field, 0, 0, W * S, H * S); x.drawImage(hud, 0, 0);
          return c.toDataURL('image/png');
        };
        const out = { ready: snap() };
        g.tap(); g.release();
        // the bot: jump what's ahead, hold over ramps, land the Big Jump on green
        let holdUntil = 0; let tumbles = 0; let lastT = 0;
        const want = [1300, 3600, BIG_AT + 60]; let vmax = 0;
        const at = {};
        for (let i = 0; i < 30 * 120 && g.phase === 'play'; i += 1) {
          const R = g.rider;
          if (R.tumble > 0 && g.t - lastT > 1.5) { tumbles += 1; lastT = g.t; }
          const ahead = g.hazards.find((z) => !z.bounce && !z.hit && z.x > R.x + 4 && z.x < R.x + 10 + R.v * 0.16 && (z.surf || 'g') === R.on);
          const gap = g.gaps.find((p) => p.x0 > R.x && p.x0 < R.x + 4 + R.v * 0.1);
          if (R.on && (ahead || gap)) { g.tap(); holdUntil = g.t + (gap ? 0.3 : 0.12); }
          if (R.on === 'g' && g.onRamp(R.x) && !R.held) { g.tap(); holdUntil = g.t + 0.6; }
          if (g.meter && !g.meter.zone) { const m = (g.t - g.meter.at) / 0.55 % 2; const k = m < 1 ? m : 2 - m; if (Math.abs(k - 0.5) < 0.05) g.tap(); }
          if (R.held && g.t > holdUntil) g.release();
          g.step(1 / 30); vmax = Math.max(vmax, R.v);
          for (const w of want) if (!at[w] && R.x >= w) { at[w] = true; out[`x${w}`] = snap(); }
          if (g.big && !g.big.landed && R.vy > -10 && R.vy < 30 && !out.big) out.big = snap();
        }
        while (g.phase === 'play') g.step(1 / 30);
        for (let i = 0; i < 40; i += 1) g.step(1 / 30);
        out.over = snap();
        console.log(`LOG ${map}: ${g.points.kid} points, ${g.haul.length} finds, ${tumbles} tumbles, ${Math.round(g.t)} s, top speed ${Math.round(vmax)}, vis ${g.points.vis}`);
        return out;
      }, { map, season, tier });
      for (const [k, url] of Object.entries(shots)) save(`${map.replace('bg-', '')}-${k}`, url);
    }
  }
  if (what === 'sheet') {
    const url = await page.evaluate(async () => {
      const { ALL_FINDS, FIND_MAPS } = await import('./js/finds.js');
      const { findCells } = await import('./js/findart.js');
      const z = 8; const cell = 140; const rowH = 130;
      const c = document.createElement('canvas'); c.width = cell * 6 + 20; c.height = rowH * FIND_MAPS.length + 20;
      const x = c.getContext('2d');
      x.fillStyle = '#fff8e7'; x.fillRect(0, 0, c.width, c.height);
      x.font = '16px "Jersey 10", monospace'; x.textAlign = 'center';
      FIND_MAPS.forEach((m, r) => ALL_FINDS.filter((f) => f.map === m).forEach((f, i) => {
        const cells = findCells(f);
        const ox = 10 + i * cell + (cell - 10 * z) / 2; const oy = 10 + r * rowH;
        cells.forEach((row, j) => row.forEach((col, k) => { if (col) { x.fillStyle = col; x.fillRect(ox + k * z, oy + j * z, z, z); } }));
        x.fillStyle = '#1b1430'; x.fillText(f.name, 10 + i * cell + cell / 2, oy + 10 * z + 16);
      }));
      return c.toDataURL('image/png');
    });
    save('finds-sheet', url);
  }
} finally {
  await browser.close();
  site.close();
}
