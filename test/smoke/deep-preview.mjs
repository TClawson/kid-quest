// Pictures of the steerable fishing boat and the deep water's giants (Taylor, 2026-11-27):
//   sheet   every lake's giant, side by side
//   scenes  the boat by the shore, rowing out, over the deep water with the giant below, a giant
//           on the line, and the catch card, at tablet size
//   video   rowing from the shore out over the drop-off (frames, then ffmpeg makes an mp4)
//   book    the fish book with two giants caught, a real giant's page and a pretend giant's page
// Run: OUT=dir node test/smoke/deep-preview.mjs [sheet|scenes|video|book] [map]
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.env.OUT || 'deep-preview';
const what = process.argv[2] || 'scenes';
const only = process.argv[3] || null;
mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const save = (name, url) => { if (process.env.PHONE) name = name.replace('.png', '-phone.png'); writeFileSync(`${out}/${name}`, Buffer.from(url.split(',')[1], 'base64')); console.log('wrote', name); };

// in the page: a game on a tablet-sized screen, and a picture of it as it is
const SETUP = `
  window.makeGame = async (map, seed, size = window.SIZE || [1280, 800]) => {
    const { Fishing } = await import('./js/fishing.js');
    const [vw, vh] = size;
    const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
    const W = Math.floor(vw / S); const H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
    const g = new Fishing({ W, H, map, seed, day: '2026-11-27', kid: { name: 'Edison', buddy: { species: 'fox', outfit: { hat: 'hat-cap-blue' } }, gear: { rod: 2, boat: 1 } }, visitor: { name: 'Esther', buddy: { species: 'panda', outfit: {} }, gear: { rod: 2 } } });
    g.S = S;
    return g;
  };
  window.snap = (g) => {
    const S = g.S; const W = g.vW; const H = g.vH; const Z = g.Z;
    const field = document.createElement('canvas'); field.width = g.fieldW * Z; field.height = g.fieldH * Z;
    const hud = document.createElement('canvas'); hud.width = W * S; hud.height = H * S;
    g.draw(field.getContext('2d'));
    g.drawHud(hud.getContext('2d'), S);
    const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
    const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
    x.drawImage(field, 0, 0, W * S, H * S); x.drawImage(hud, 0, 0);
    return c.toDataURL('image/png');
  };
  window.run = (g, secs, each) => { for (let i = 0; i < Math.round(secs * 30); i += 1) { each?.(g, i); g.step(1 / 30); } };
  // the giant, right now, somewhere below the view
  window.bringGiant = (g) => { g.phase = 'play'; g.deepAt = 0; g.step(1 / 30); const f = g.fish.find((x) => x.deep); f.x = Math.max(f.minX, Math.min(f.maxX, g.camX + g.fieldW * 0.72)); f.y = f.homeY; f.born = g.t; return f; };
`;

try {
  const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(site.url);
  await page.evaluate(() => document.fonts.ready);
  await page.addScriptTag({ content: SETUP });
  // PHONE=1: a phone held upright instead of the tablet (scene names end -phone)
  const phone = Boolean(process.env.PHONE);
  if (phone) await page.evaluate(() => { window.SIZE = [412, 915]; });

  if (what === 'sheet') {
    save('giants-sheet.png', await page.evaluate(async () => {
      const { SPOTS, fishPic, lookFor, baseFor } = await import('./js/fishing.js');
      const { realFish, weightFor, fmtWeight } = await import('./js/fishfacts.js');
      const maps = Object.keys(SPOTS); const cols = 2; const cellW = 620; const cellH = 250;
      const c = document.createElement('canvas'); c.width = cols * cellW + 20; c.height = Math.ceil(maps.length / cols) * cellH + 70;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#1b1430'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#ffd43b'; x.font = 'bold 26px sans-serif'; x.fillText('The deep water giants: one for every lake, only from the boat', 20, 40);
      maps.forEach((m, n) => {
        const sp = SPOTS[m]; const x0 = 10 + (n % cols) * cellW; const y0 = 60 + Math.floor(n / cols) * cellH;
        const gr = x.createLinearGradient(0, y0, 0, y0 + cellH - 10);
        gr.addColorStop(0, sp.water[1]); gr.addColorStop(1, '#0b1026');
        x.fillStyle = gr; x.fillRect(x0, y0, cellW - 10, cellH - 10);
        const { look, name } = lookFor(m, 'deep'); const base = baseFor(m, 'deep');
        const pic = fishPic(look, ((base.len[0] + base.len[1]) / 2) * (look.lenK || 1), 2); const s = Math.min(2.6, (cellW - 60) / pic.width, (cellH - 90) / pic.height);
        x.drawImage(pic, x0 + (cellW - 10) / 2 - (pic.width * s) / 2, y0 + 30 + (cellH - 100) / 2 - (pic.height * s) / 2, pic.width * s, pic.height * s);
        const id = `${m.replace('bg-', '')}-${sp.deep.id}`; const real = realFish(id);
        x.fillStyle = '#fff'; x.font = 'bold 20px sans-serif'; x.fillText(`${name}  ·  ${sp.name}`, x0 + 12, y0 + 26);
        x.font = '15px sans-serif'; x.fillStyle = '#d0ebff';
        x.fillText(`${real.pretend ? `Pretend, real cousin: ${real.name}` : `Real fish: ${real.name}`}  ·  typical ${fmtWeight(real.w[2])}, trophy ${fmtWeight(real.w[3])}+`, x0 + 12, y0 + cellH - 22);
      });
      return c.toDataURL('image/png');
    }));
  }

  if (what === 'scenes') {
    const maps = only ? [only] : ['bg-meadow', 'bg-ocean', 'bg-fjord', 'bg-rainbow'];
    for (const map of maps) {
      const key = map.replace('bg-', '');
      // 1: where the boat starts, before the first cast (the row buttons and the lake map)
      save(`${key}-1-start.png`, await page.evaluate(async (map) => { const g = await makeGame(map, 5); run(g, 1.2); return snap(g); }, map));
      // 2: rowing out, oars going, a wake behind
      save(`${key}-2-rowing.png`, await page.evaluate(async (map) => {
        const g = await makeGame(map, 5); run(g, 0.5); g.tap(g.rowButtons()[1].x, g.rowButtons()[1].y); run(g, 3.3); return snap(g);
      }, map));
      // 3: over the deep water, past the buoy, the giant cruising below
      save(`${key}-3-deep.png`, await page.evaluate(async (map) => {
        const g = await makeGame(map, 5); run(g, 0.3); g.camX = g.camMax * 0.8; g.kid.x = g.homeX - 13; g.kid.tx = g.kid.x; g.vis.x = g.homeX - 32; g.vis.tx = g.vis.x;
        run(g, 0.2); bringGiant(g); run(g, 2.5); return snap(g);
      }, map));
      // 4: the giant on the line
      save(`${key}-4-fight.png`, await page.evaluate(async (map) => {
        const g = await makeGame(map, 5); g.camX = g.camMax; g.kid.x = g.homeX - 13; g.kid.tx = g.kid.x; g.vis.x = g.homeX - 32; g.vis.tx = g.vis.x;
        run(g, 0.2); const f = bringGiant(g); const L = g.lines.kid; L.state = 'water'; L.x = f.x - f.pw / 2 + 2; L.y = f.y; L.bait = 'worm'; g.hook(L, f);
        g.press(); run(g, 1.6); return snap(g);
      }, map));
      // 5: landed: the catch card
      save(`${key}-5-caught.png`, await page.evaluate(async (map) => {
        const g = await makeGame(map, 5); g.onCatch = () => 'first'; g.camX = g.camMax; g.kid.x = g.homeX - 13; g.kid.tx = g.kid.x; g.vis.x = g.homeX - 32; g.vis.tx = g.vis.x;
        run(g, 0.2); const f = bringGiant(g); f.size = 1.05; const L = g.lines.kid; L.state = 'fight'; L.fish = f; f.state = 'hooked'; L.x = g.homeX + 5; L.y = g.surface + 2; g.land(L, f); run(g, 0.6); return snap(g);
      }, map));
    }
  }

  if (what === 'video') {
    const map = only || 'bg-meadow';
    const dir = `${out}/frames`; rmSync(dir, { recursive: true, force: true }); mkdirSync(dir, { recursive: true });
    const frames = await page.evaluate(async (map) => {
      const g = await makeGame(map, 9); const urls = [];
      const rb = g.rowButtons();
      const shot = (n) => { for (let i = 0; i < n; i += 1) { g.step(1 / 15); urls.push(snap(g)); } };
      shot(10); // a moment at the start
      g.tap(rb[0].x, rb[0].y); shot(30); g.release(); shot(10); // in toward the shore
      g.tap(rb[1].x, rb[1].y); shot(150); g.release(); shot(12); // all the way out over the deep water
      g.phase = 'play'; g.deepAt = 0; shot(45); // the giant swims in below
      return urls;
    }, map);
    frames.forEach((u, i) => writeFileSync(`${dir}/f${String(i).padStart(4, '0')}.png`, Buffer.from(u.split(',')[1], 'base64')));
    execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-framerate', '15', '-i', `${dir}/f%04d.png`, '-vf', 'scale=960:-2:flags=neighbor', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', `${out}/rowing-${map.replace('bg-', '')}.mp4`]);
    rmSync(dir, { recursive: true, force: true });
    console.log('wrote', `rowing-${map.replace('bg-', '')}.mp4`);
  }
  if (what === 'book') {
    const day = '2026-11-27';
    const s = emptyState();
    s.settings.pinHash = fallbackHash('kidquest:1234'); s.settings.sound = false; s.settings.questView = 'village';
    const tasks = defaultTasks();
    const rec = (map, size, lb, ago) => ({ size, lb, points: 200, map, date: addDays(day, -ago) });
    s.kids.push({
      id: 'kid_ed', name: 'Edison', color: '#4dabf7', tasks, startDate: addDays(day, -40), seenUnlocks: [], seenMoves: [], spent: 0,
      owned: ['sport-rod-good', 'sport-boat', 'home-bed-quilt'], home: { bed: 'home-bed-quilt' },
      buddy: { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } },
      fishRecords: { 'meadow-bluegill': rec('bg-meadow', 8, 0.5, 9), 'meadow-pike': rec('bg-meadow', 31, 6.2, 7), 'meadow-sturgeon': rec('bg-meadow', 62, 118, 1), 'galaxy-constellation': rec('bg-galaxy', 380, 21400, 3), 'galaxy-comet': rec('bg-galaxy', 30, 9, 4) },
    });
    s.log[day] = { kid_ed: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done', by: 'parent' }])), excused: false } };
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage();
    p.on('pageerror', (e) => console.log('ERR', e.message));
    await p.clock.install({ time: new Date(`${day}T16:30:00`) });
    await p.goto(site.url);
    await p.evaluate(([st, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [s, { kid_ed: { day, inside: true } }]);
    await p.reload();
    await openKid(p, '[data-action="open-kid"]');
    await p.clock.runFor(1500);
    for (let i = 0; i < 6 && await p.locator('#modal:not([hidden])').count(); i += 1) { await p.locator('#modal [data-action="modal-close"]').first().evaluate((b) => b.click()); await p.clock.runFor(400); }
    await p.locator('.house').scrollIntoViewIfNeeded(); await p.clock.runFor(1200);
    const shotModal = async (name) => {
      const el = p.locator('#modal .modal-card'); const h = await el.evaluate((n) => n.scrollHeight);
      await p.setViewportSize({ width: 1280, height: Math.max(800, h + 80) });
      await p.addStyleTag({ content: '#modal .modal-card { max-height: none !important; overflow: visible !important; }' });
      await p.clock.runFor(150); await el.screenshot({ path: `${out}/${name}` }); console.log('wrote', name);
      await p.setViewportSize({ width: 1280, height: 800 });
    };
    await p.evaluate(() => document.querySelector('.h-spot[data-spot="book"]').click());
    await p.clock.runFor(2500); await p.waitForSelector('#modal .fishbook');
    await shotModal('book-1-fish-book.png');
    await p.evaluate(() => document.querySelector('#modal [data-species="meadow-sturgeon"]').click()); await p.waitForSelector('#modal .fishpage');
    await shotModal('book-2-sturgeon-page.png');
    await p.evaluate(() => document.querySelector('#modal [data-action="fish-book-back"]').click()); await p.clock.runFor(2500);
    await p.evaluate(() => document.querySelector('#modal [data-species="galaxy-constellation"]').click()); await p.waitForSelector('#modal .fishpage');
    await shotModal('book-3-constellation-page.png');
    await ctx.close();
  }
} finally {
  await browser.close();
  site.close();
}
