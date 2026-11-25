// Previews of the December fish and critters (design v1 section 3), on a December day:
//   fish-sheet.png     the ten December fish, each on its own lake's water, with its fun fact
//   lake-<map>.png     the fishing game on a map's lake, its December fish swimming in it
//   catch-card.png     the app's fishing game: Ava lands a December fish (the candy-cane card)
//   fish-book.png      the app's fish book with December fish caught (and one still to catch)
//   fish-page.png      a December fish's own page in the fish book
//   critter-sheet.png  the ten December critters, every frame (stand, walk, pose, peek, fly)
//   train-<map>.png    the photo train in winter, the map's December critter posing in view
//   sheet.png          all of the above on one contact sheet
// Run: node test/smoke/december-preview.mjs <outDir>
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { FISH_SPECIES } from '../../js/fishbook.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'december-preview').replace(/\/$/, '');
const DAY = '2026-12-10';
const LAKES = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-fjord', 'bg-rainbow']; // meadow, castle and fjord: snowy in December
// map, the December critter, how it shows itself, and whether the kid has the camera on it
const TRAINS = [['bg-meadow', 'meadow-popcorn', 'step'], ['bg-castle', 'castle-lantern', 'step', true], ['bg-fjord', 'fjord-twinkle', 'step'], ['bg-space', 'space-yeti', 'hop', true], ['bg-galaxy', 'galaxy-reindeer', 'step'], ['bg-rainbow', 'rainbow-ginger', 'step']];
fs.mkdirSync(out, { recursive: true });

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];
const shots = [];
const save = (name, url) => { const p = `${out}/${name}.png`; fs.writeFileSync(p, Buffer.from(url.split(',')[1], 'base64')); shots.push([name, p]); console.log('wrote', p); };

try {
  // ---------- the sheets and the game screens, drawn straight from the games ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    page.on('pageerror', (e) => { errors.push(e.message); console.log('ERR', e.message); });
    await page.goto(site.url);
    await page.evaluate(() => { localStorage.setItem('kidquest.season', 'winter'); return document.fonts.ready; });
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);

    // the fish sheet
    save('fish-sheet', await page.evaluate(async (font) => {
      const { HOLIDAY_FISH, SPOTS, SPECIES, lookFor, fishPic } = await import('./js/fishing.js');
      const { DECEMBER_FACTS } = await import('./js/fishfacts.js');
      const maps = Object.keys(HOLIDAY_FISH);
      const cw = 640; const ch = 300; const pad = 16; const head = 70;
      const c = document.createElement('canvas'); c.width = cw * 2 + pad * 3; c.height = head + (ch + pad) * 5 + pad;
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#1b1430'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#ffd43b'; x.font = `bold 30px ${font}`; x.fillText('December fish: one in every lake, 1 to 31 December', pad, 46);
      const wrap = (text, x0, y0, w, lh) => { let line = ''; let y = y0; for (const word of text.split(' ')) { const t = line ? `${line} ${word}` : word; if (x.measureText(t).width > w) { x.fillText(line, x0, y); line = word; y += lh; } else line = t; } x.fillText(line, x0, y); };
      maps.forEach((m, i) => {
        const sp = SPOTS[m]; const hol = HOLIDAY_FISH[m];
        const X = pad + (i % 2) * (cw + pad); const Y = head + Math.floor(i / 2) * (ch + pad);
        const g = x.createLinearGradient(0, Y, 0, Y + ch); g.addColorStop(0, sp.water[0]); g.addColorStop(0.6, sp.water[1]); g.addColorStop(1, sp.water[2]);
        x.fillStyle = g; x.fillRect(X, Y, cw, ch);
        x.strokeStyle = '#e03131'; x.lineWidth = 4; x.setLineDash([10, 10]); x.strokeRect(X + 2, Y + 2, cw - 4, ch - 4);
        x.strokeStyle = '#ffffff'; x.lineDashOffset = 10; x.strokeRect(X + 2, Y + 2, cw - 4, ch - 4); x.setLineDash([]); x.lineDashOffset = 0;
        const base = SPECIES[hol.as]; const len = (base.len[0] + base.len[1]) / 2;
        const pic = fishPic(lookFor(m, 'holiday').look, len, 2);
        const s = Math.max(2, Math.min(6, Math.floor(Math.min((cw * 0.7) / pic.width, 152 / pic.height))));
        x.drawImage(pic, Math.round(X + (cw - pic.width * s) / 2), Math.round(Y + 50 + (154 - pic.height * s) / 2), pic.width * s, pic.height * s);
        x.fillStyle = 'rgba(27,20,48,0.72)'; x.fillRect(X + 8, Y + 8, cw - 16, 36); x.fillRect(X + 8, Y + 208, cw - 16, ch - 216);
        x.fillStyle = '#ffffff'; x.font = `bold 22px ${font}`; x.fillText(hol.name, X + 18, Y + 34);
        x.fillStyle = '#ffd43b'; x.font = `16px ${font}`; x.textAlign = 'right'; x.fillText(`${sp.name} · ❄️ December`, X + cw - 18, Y + 32); x.textAlign = 'left';
        x.fillStyle = '#ffffff'; x.font = `15px ${font}`; wrap(DECEMBER_FACTS[`${m.replace('bg-', '')}-${hol.id}`] || '', X + 18, Y + 230, cw - 36, 20);
      });
      return c.toDataURL('image/png');
    }, font));

    // each lake, a few seconds in, with its December fish swimming by
    for (const map of LAKES) {
      save(`lake-${map.replace('bg-', '')}`, await page.evaluate(async ([map, day]) => {
        const { Fishing, lookFor, fishPic, SPECIES, SPOTS } = await import('./js/fishing.js');
        const vw = 1280; const vh = 800;
        const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
        const W = Math.floor(vw / S); const H = Math.min(Math.floor(vh / S), Math.round(W * 1.15));
        const g = new Fishing({ W, H, map, seed: 11, day, kid: { name: 'Ava', buddy: { species: 'fox', outfit: { hat: 'hat-cap-blue' } }, gear: { rod: 2 } }, visitor: { name: 'Bear', buddy: { species: 'bear', outfit: {} }, gear: { rod: 2 } } });
        if (!g.december) throw new Error(`${map}: no December fish on ${day}`);
        const Z = g.Z || 1;
        g.tap(g.button.x, g.button.y);
        for (let i = 0; i < 30 * 7; i += 1) {
          const L = g.lines.kid;
          if (L.state === 'aim' && g.meter(L) > 0.6 && g.meter(L) < 0.7) g.tap(g.button.x, g.button.y);
          g.step(1 / 30);
        }
        // the December fish, a good big one, cruising across the middle of the view
        const base = SPECIES[SPOTS[map].holiday.as];
        const fx = g.camX + W * 0.52; const fy = g.surface + (g.H - g.surface) * 0.34;
        const f = g.makeFish('holiday', fx, fy, 'cruise', fx);
        const look = lookFor(map, 'holiday').look;
        f.len = (base.len[0] + (base.len[1] - base.len[0]) * 0.8) * (look.lenK || 1); f.pic = fishPic(look, f.len, Z); f.pw = f.pic.width / Z; f.ph = f.pic.height / Z;
        f.dir = -1; [f.minX, f.maxX] = g.range(fx); f.life = 99; f.mood = 0; f.checkAt = g.t + 99;
        for (let i = 0; i < 4; i += 1) g.step(1 / 30);
        const field = document.createElement('canvas'); field.width = W * Z; field.height = H * Z;
        const hud = document.createElement('canvas'); hud.width = W * S; hud.height = H * S;
        g.draw(field.getContext('2d')); g.drawHud(hud.getContext('2d'), S);
        const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(field, 0, 0, W * S, H * S); x.drawImage(hud, 0, 0);
        return c.toDataURL('image/png');
      }, [map, DAY]));
    }

    // the critter sheet: every frame of every December critter
    save('critter-sheet', await page.evaluate(async (font) => {
      const { CRITTERS } = await import('./js/critters.js');
      const { critterPic } = await import('./js/critterart.js');
      const MAP_NAMES = { 'bg-meadow': 'Forest Village', 'bg-sunset': 'Sunset Beach', 'bg-ocean': 'Under the Sea', 'bg-space': 'Moon Base', 'bg-castle': 'Castle', 'bg-volcano': 'Volcano Island', 'bg-rainforest': 'Rainforest', 'bg-fjord': 'Alaskan Fjord', 'bg-rainbow': 'Rainbow Land', 'bg-galaxy': 'Golden Galaxy' };
      const list = CRITTERS.filter((c) => c.december);
      const frames = ['stand', 'walk', 'pose', 'peek', 'fly'];
      const S = 3; const lw = 330; const pad = 14;
      const pics = list.map((cr) => frames.map((f) => critterPic(cr.look, f)));
      const cw = Math.max(...pics.flat().map((p) => p.width)) * S + 16;
      const rows = pics.map((r) => Math.max(110, Math.max(...r.map((p) => p.height)) * S + 24));
      const head = 70;
      const c = document.createElement('canvas'); c.width = lw + cw * 5 + pad; c.height = head + rows.reduce((a, b) => a + b + 8, 0);
      const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
      x.fillStyle = '#1b1430'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#ffd43b'; x.font = `bold 30px ${font}`; x.fillText('December critters: one on every photo train map, 1 to 31 December (rare)', pad, 44);
      x.fillStyle = '#c5cee0'; x.font = `15px ${font}`; frames.forEach((f, i) => { x.textAlign = 'center'; x.fillText(f, lw + i * cw + cw / 2, 64); }); x.textAlign = 'left';
      const wrap = (text, x0, y0, w, lh) => { let line = ''; let y = y0; for (const word of text.split(' ')) { const t = line ? `${line} ${word}` : word; if (x.measureText(t).width > w) { x.fillText(line, x0, y); line = word; y += lh; } else line = t; } x.fillText(line, x0, y); };
      let y = head;
      list.forEach((cr, r) => {
        const g = x.createLinearGradient(0, y, 0, y + rows[r]); g.addColorStop(0, '#b9cde3'); g.addColorStop(0.78, '#e3e9f3'); g.addColorStop(0.78, '#d6deec'); g.addColorStop(1, '#c3cde0');
        x.fillStyle = g; x.fillRect(pad, y, c.width - pad * 2, rows[r]);
        x.fillStyle = '#1b1430'; x.font = `bold 20px ${font}`; x.fillText(cr.name, pad + 10, y + 28);
        x.fillStyle = '#5f3dc4'; x.font = `14px ${font}`; x.fillText(`${(MAP_NAMES && MAP_NAMES[cr.map]) || cr.map} · ${cr.rarity} · ❄️ December`, pad + 10, y + 48);
        x.fillStyle = '#343a40'; x.font = `13px ${font}`; wrap(cr.fun || '', pad + 10, y + 68, lw - 30, 17);
        frames.forEach((f, i) => { const p = pics[r][i]; x.drawImage(p, lw + i * cw + (cw - p.width * S) / 2, y + rows[r] - 10 - p.height * S, p.width * S, p.height * S); });
        y += rows[r] + 8;
      });
      return c.toDataURL('image/png');
    }, font));

    // the photo train in winter: the December critter comes out and poses, and the camera is on it
    for (const [map, id, how, aim] of TRAINS) {
      save(`train-${map.replace('bg-', '')}`, await page.evaluate(async ([map, id, how, aim, day]) => {
        const { PhotoTrain, LIFT } = await import('./js/phototrain.js');
        const { critterById } = await import('./js/critters.js');
        const { shownSeason } = await import('./js/seasons.js');
        const vw = 1280; const vh = 800;
        const S = Math.max(2, Math.round(Math.min(vw, vh) / 130));
        const W = Math.floor(vw / S); const H = Math.floor(vh / S);
        const season = shownSeason(day); // winter (kidquest.season)
        const g = new PhotoTrain({ W, H, map, season, day, seed: 5, kid: { name: 'Ava', buddy: { species: 'fox', outfit: { hat: 'hat-cap-blue' } }, gear: { camera: 2 } }, visitor: { name: 'Ben', buddy: { species: 'bear', outfit: {} } } });
        g.plan.tunnelAt = 999; g.plan.trackAt = 999; g.plan.clueAt = 999; g.plan.bridgeAt = 999;
        g.tap(W / 2, H / 2); // the first tap starts the ride
        for (let i = 0; i < 30 * 3; i += 1) g.step(1 / 30);
        g.nextAt = 999; // no more animals for now: the December one is on its way
        const k = g.spawn(critterById(id), how);
        if (how === 'step' || how === 'rise') k.emergeX = W * 0.6;
        let aimed = !aim;
        for (let i = 0; i < 30 * 15 && !(k.state === 'pose' && g.t - k.st > 0.45); i += 1) {
          if (!aimed && k.state === 'pose') {
            const o = g.subjects().find((s) => s.k === k);
            if (o) { g.tap(o.box.x + o.box.w / 2, o.box.y + o.box.h / 2 + LIFT); aimed = true; }
          }
          g.step(1 / 30);
        }
        if (k.state !== 'pose') throw new Error(`${id} did not pose (${k.state})`);
        const field = document.createElement('canvas'); field.width = W * g.Z; field.height = H * g.Z;
        const hud = document.createElement('canvas'); hud.width = W * S; hud.height = H * S;
        g.draw(field.getContext('2d')); g.drawHud(hud.getContext('2d'), S);
        const c = document.createElement('canvas'); c.width = W * S; c.height = H * S;
        const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
        x.drawImage(field, 0, 0, W * S, H * S); x.drawImage(hud, 0, 0);
        return c.toDataURL('image/png');
      }, [map, id, how, aim, DAY]));
    }
    await page.close();
  }

  // ---------- in the app, on a December day ----------
  const CAUGHT = { 'meadow-bluegill': [8, 0.4], 'meadow-largemouth': [19, 4.4], 'meadow-globe': [17, 3.1], 'meadow-pike': [28], 'sunset-bluegill': [7], 'ocean-present': [14], 'ocean-bluegill': [6], 'space-lights': [11], 'castle-jester': [27], 'castle-pike': [24], 'fjord-aurora': [20], 'galaxy-tree': [13] }; // the candy-cane eel still to catch
  const records = () => {
    const r = {}; let i = 0;
    for (const [id, [size, lb]] of Object.entries(CAUGHT)) {
      const sp = FISH_SPECIES.find((s) => s.id === id);
      if (!sp) throw new Error(`no fish ${id}`);
      r[id] = { size, points: 20 + size, map: sp.map, date: addDays(DAY, -(1 + (i++ % 8))), ...(lb ? { lb } : {}) }; // all this December
    }
    return r;
  };
  const family = (o = {}) => {
    const s = emptyState();
    s.settings.pinHash = fallbackHash('kidquest:1234'); s.settings.sound = false; s.settings.questView = 'village';
    const tasks = defaultTasks();
    s.kids.push({
      id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(DAY, -40), seenUnlocks: [], seenMoves: [], spent: 0,
      owned: ['sport-rod-super', 'home-bed-quilt'], home: { bed: 'home-bed-quilt' },
      buddy: { species: 'fox', outfit: { background: o.map || 'bg-meadow', hat: 'hat-cap' } },
      ...(o.records === false ? {} : { fishRecords: records() }),
    });
    s.log[DAY] = { kid_ava: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done', by: 'parent' }])), excused: false } };
    return s;
  };
  const closeModals = async (page) => {
    for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
      const close = page.locator('#modal [data-action="modal-close"]');
      if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
      await page.clock.runFor(400);
    }
  };
  const open = async (st, { cloud = false } = {}) => {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { errors.push(e.message); console.log('ERR', e.message); });
    await page.clock.install({ time: new Date(`${DAY}T16:30:00`) });
    await page.goto(site.url);
    await page.evaluate(([s, house, cl]) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(s));
      localStorage.setItem('kidquest.house', JSON.stringify(house));
      localStorage.setItem('kidquest.season', 'winter');
      if (cl) {
        localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_ava' }));
        localStorage.setItem('kidquest.cloud.cache', JSON.stringify(s));
        localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([{ id: 'kid_ben', name: 'Ben', color: '#4dabf7', owned: ['sport-rod-good'], buddy: { species: 'bear', outfit: {} } }]));
      }
    }, [st, { kid_ava: { day: DAY, inside: !cloud } }, cloud]);
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.clock.runFor(1500);
    await closeModals(page);
    if (!cloud) { await page.locator('.house').scrollIntoViewIfNeeded(); await page.clock.runFor(1200); }
    return { ctx, page };
  };
  const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
  const shotEl = async (page, name, sel, maxH) => {
    const el = page.locator(sel);
    const box = await el.boundingBox();
    const y = await page.evaluate(() => window.scrollY);
    const p = `${out}/${name}.png`;
    await page.screenshot({ path: p, clip: { x: box.x, y: box.y + y, width: box.width, height: Math.min(box.height, maxH || box.height) }, fullPage: true });
    shots.push([name, p]); console.log('wrote', p);
  };

  // the fish book: December fish caught, with their candy-cane frames and the December badge
  {
    const { ctx, page } = await open(family());
    await tap(page, '.h-spot[data-spot="book"]');
    await page.clock.runFor(2500);
    await page.waitForSelector('#modal .fishbook');
    const n = await page.locator('#modal .fb-fish.december').count();
    if (n !== 10) throw new Error(`the fish book shows ${n} December fish, not 10`);
    const view = page.viewportSize();
    const h = await page.locator('#modal .modal-card').evaluate((el) => el.scrollHeight);
    await page.setViewportSize({ width: view.width, height: Math.max(view.height, h + 80) });
    await page.addStyleTag({ content: '#modal .modal-card { max-height: none !important; overflow: visible !important; }' });
    await page.clock.runFor(200);
    // the first three lakes (Forest Lake first, then the beach and the reef): readable at full size
    const top = await page.locator('#modal .fishbook').boundingBox();
    const third = await page.locator('#modal .fb-map').nth(3).boundingBox();
    await shotEl(page, 'fish-book', '#modal .modal-card', Math.round(third.y - top.y + 20));
    await page.setViewportSize(view);
    await tap(page, '#modal [data-species="meadow-globe"]');
    await page.waitForSelector('#modal .fishpage .fp-december');
    await page.clock.runFor(1500);
    await shotEl(page, 'fish-page', '#modal .modal-card');
    await ctx.close();
  }

  // the catch card: Ava lands the snow-globe fish at Forest Lake
  {
    const { ctx, page } = await open(family({ records: false }), { cloud: true });
    await page.waitForSelector('.v-visitor', { timeout: 10000 });
    await page.clock.runFor(1000);
    await page.locator('.v-visitor').first().click();
    await page.clock.runFor(800);
    await page.click('.game-pick [data-kind="fishing"]');
    await page.waitForSelector('.playground');
    const ok = await page.evaluate(() => {
      const g = document.querySelector('.playground').game;
      if (!g.december) return false;
      g.phase = 'play';
      const f = g.makeFish('holiday', g.W * 0.6, g.H * 0.7, 'lurk');
      f.post = [f.x, f.y];
      g.land(g.lines.kid, f);
      return true;
    });
    if (!ok) throw new Error('no December fish in the app on a December day');
    await page.clock.runFor(900);
    const p = `${out}/catch-card.png`;
    await page.screenshot({ path: p }); shots.push(['catch-card', p]); console.log('wrote', p);
    await ctx.close();
  }

  // ---------- the contact sheet ----------
  {
    const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
    await page.goto(site.url);
    const font = await page.evaluate(() => getComputedStyle(document.body).fontFamily);
    const imgs = shots.map(([name, p]) => [name, `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`]);
    const url = await page.evaluate(async ([imgs, font]) => {
      const load = (src) => new Promise((ok) => { const i = new Image(); i.onload = () => ok(i); i.src = src; });
      const pics = await Promise.all(imgs.map(([, src]) => load(src)));
      const cols = 4; const cw = 480; const ch = 330; const pad = 16; const head = 64;
      const c = document.createElement('canvas'); c.width = cols * (cw + pad) + pad; c.height = head + Math.ceil(pics.length / cols) * (ch + pad + 26) + pad;
      const x = c.getContext('2d');
      x.fillStyle = '#1b1430'; x.fillRect(0, 0, c.width, c.height);
      x.fillStyle = '#ffd43b'; x.font = `bold 28px ${font}`; x.fillText('Kid Quest December: holiday fish and critters (previews)', pad, 42);
      pics.forEach((p, i) => {
        const X = pad + (i % cols) * (cw + pad); const Y = head + Math.floor(i / cols) * (ch + pad + 26);
        const z = Math.min(cw / p.width, ch / p.height);
        x.imageSmoothingEnabled = z < 1; x.imageSmoothingQuality = 'high';
        x.fillStyle = '#2b2346'; x.fillRect(X, Y, cw, ch);
        x.drawImage(p, X + (cw - p.width * z) / 2, Y + (ch - p.height * z) / 2, p.width * z, p.height * z);
        x.fillStyle = '#ffffff'; x.font = `16px ${font}`; x.fillText(`${imgs[i][0]}.png`, X, Y + ch + 20);
      });
      return c.toDataURL('image/png');
    }, [imgs, font]);
    fs.writeFileSync(`${out}/sheet.png`, Buffer.from(url.split(',')[1], 'base64'));
    console.log('wrote', `${out}/sheet.png`);
    await page.close();
  }
} finally {
  await browser.close();
  site.close();
}
if (errors.length) { console.log('page errors:', errors); process.exitCode = 1; }
