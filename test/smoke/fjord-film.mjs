// Films the Alaskan Fjord in the real app on a tablet: the bay's visitors, the moose and the bear,
// and the lighthouse's northern lights show. Needs ffmpeg to cut the clips.
// Run: node test/smoke/fjord-film.mjs <outDir> [bay|shore|show ...]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const want = process.argv.slice(3);
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const size = { width: 1280, height: 800 };
const wait = (page, s) => page.waitForTimeout(s * 1000);

async function film(name, act) {
  if (want.length && !want.includes(name)) return;
  const raw = path.join(out, `_raw-${name}`);
  fs.rmSync(raw, { recursive: true, force: true });
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1, hasTouch: true, recordVideo: { dir: raw, size } });
  const began = Date.now();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log(name, 'ERR', e.message));
  await page.goto(site.url);
  const saved = emptyState();
  saved.settings.pinHash = 'sha256:test';
  saved.settings.sound = false;
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#1c7ed6', tasks: defaultTasks(), startDate: dateKey(), owned: ['bg-fjord'], buddy: { species: 'fox', outfit: { background: 'bg-fjord' } } });
  for (let i = 1; i <= 4; i += 1) { const d = new Date(Date.now() - i * 86400000); saved.log[dateKey(d)] = { kid_ava: { tasks: {}, chest: { kind: 'piece', map: 'bg-fjord', opened: true } } }; }
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();
  await openKid(page);
  await page.waitForSelector('.village');
  await wait(page, 0.6);
  await closePops(page);
  // nothing turns up on its own while the film runs
  await page.evaluate(() => { const s = document.querySelector('.village').mapLife.state; s.nextSea = Infinity; s.nextOtters = Infinity; s.nextLand = Infinity; s.pod = null; s.whale = null; s.otters = null; s.land = null; });
  const cut = { from: 0, to: 0 };
  const tools = {
    mark: () => { cut.from = (Date.now() - began) / 1000; },
    life: (what) => page.evaluate((w) => document.querySelector('.village').mapLife.show(w), what),
    // where a spot on the map is on the screen just now (the lighthouse is the ruler)
    at: (x, y) => page.evaluate(([mx, my]) => { const r = document.querySelector('.v-landmark').getBoundingClientRect(); const k = r.width / 112; return { x: r.left + (mx - 206) * k, y: r.top + (my - 275) * k }; }, [x, y]),
    // walks the buddy to a spot on the map, wherever the camera is
    walk: async (x, y) => { const p = await tools.at(x, y); await page.evaluate(([cx, cy]) => document.querySelector('.village-view').dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: cx, clientY: cy })), [p.x, p.y]); },
  };
  await act(page, tools);
  cut.to = (Date.now() - began) / 1000;
  await ctx.close();
  const webm = path.join(raw, fs.readdirSync(raw).find((f) => f.endsWith('.webm')));
  const mp4 = path.join(out, `fjord-${name}.mp4`);
  execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-ss', cut.from.toFixed(2), '-t', (cut.to - cut.from).toFixed(2), '-i', webm, '-an', '-c:v', 'libx264', '-preset', 'slow', '-crf', '24', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', mp4]);
  fs.rmSync(raw, { recursive: true, force: true });
  console.log(name, `${(cut.to - cut.from).toFixed(1)} s`, `${Math.round(fs.statSync(mp4).size / 1024)} KB`);
}

// the bay from the wharf: otters (one tapped), the pod swimming through, the whale under a puffin
await film('bay', async (page, t) => {
  await t.walk(294, 464);
  await wait(page, 14);
  t.mark();
  await t.life('otters');
  await t.life('pod');
  await wait(page, 5);
  const otter = await page.evaluate(() => { const o = document.querySelector('.village').mapLife.state.otters.members[0]; return [o.x + 6, o.y - 3]; });
  const p = await t.at(otter[0], otter[1]);
  console.log('otter at', otter.join(','));
  await page.mouse.click(p.x, p.y);
  await wait(page, 18);
  // a puffin sits where the whale is about to come up
  await page.evaluate(() => {
    const life = document.querySelector('.village').mapLife; const s = life.state;
    const puffin = s.puffins[0]; puffin.x = puffin.tx = 186; puffin.y = puffin.ty = 336;
    const dice = Math.random; Math.random = () => 0.3;
    life.show('whale');
    setTimeout(() => { Math.random = dice; }, 500);
  });
  await wait(page, 13);
});

// the north shore from home: the moose, then the bear
await film('shore', async (page, t) => {
  await t.walk(250, 150);
  await wait(page, 4);
  t.mark();
  await t.life('moose');
  await wait(page, 25);
  await page.evaluate(() => { document.querySelector('.village').mapLife.state.land = null; });
  await t.life('bear');
  await wait(page, 19);
});

// the lighthouse wakes, and its show
await film('show', async (page, t) => {
  await t.walk(300, 520);
  await wait(page, 13);
  t.mark();
  await wait(page, 1);
  await page.evaluate(() => document.querySelector('.v-landmark').click());
  await page.waitForSelector('.village.show-on', { timeout: 40000 }).catch(() => console.log('the show did not start'));
  await wait(page, 11.5);
});

await browser.close(); site.close();
