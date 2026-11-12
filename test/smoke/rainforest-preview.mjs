// Previews of the rainforest map: screenshots at tablet and phone size, and close-ups of each
// moving thing (sloth, toucan and monkey, rain, waterfall). Run: node test/smoke/rainforest-preview.mjs <outDir> [still|video]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, openOldMap } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const mode = process.argv[3] || 'still';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();

async function open(viewport, video) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: video ? 1 : 2, ...(video ? { recordVideo: { dir: `${out}/raw`, size: viewport } } : {}) });
  const page = await ctx.newPage();
  page.t0 = Date.now();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(e.message));
  await page.goto(site.url);
  const saved = emptyState();
  saved.settings.pinHash = 'sha256:test';
  saved.settings.sound = false;
  saved.settings.questView = 'map'; // chose the old map once: the village opens, and the map is in the Menu
  const tasks = defaultTasks();
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: dateKey(), buddy: { species: 'fox', outfit: { background: 'bg-rainforest' } } });
  saved.log = { [dateKey()]: { kid_ava: { tasks: { [tasks[0].id]: { status: 'done' }, [tasks[1].id]: { status: 'done' } } } } };
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
  await page.reload();
  await openKid(page, '[data-action="open-kid"]');
  await openOldMap(page); // the old map, from the Menu
  await page.waitForTimeout(300);
  return { ctx, page };
}

const life = (page, fn, arg) => page.evaluate(([f, a]) => {
  const L = document.querySelector('.quest-map').mapLife;
  // eslint-disable-next-line no-new-func
  return new Function('L', 'a', f)(L, a);
}, [fn, arg]);

try {
  if (mode === 'still') {
    for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
      const { ctx, page } = await open(viewport);
      await page.locator('.quest-map').screenshot({ path: `${out}/map-${label}.png` });
      if (page.errors.length) console.log(label, page.errors);
      await ctx.close();
    }
  }
  if (mode === 'frames') {
    // stills of each moving thing, for checking the art
    const { ctx, page } = await open({ width: 800, height: 1280 });
    const shot = async (name, at) => {
      const r = await page.evaluate(([w]) => {
        const s = document.querySelector('.quest-map').getBoundingClientRect();
        return { x: s.left + w.x * 4 - 160, y: s.top + w.y * 4 - 120 + window.scrollY };
      }, [at]);
      await page.screenshot({ path: `${out}/${name}.png`, fullPage: true, clip: { x: Math.max(0, r.x), y: Math.max(0, r.y), width: 320, height: 240 } });
    };
    const where = (expr) => life(page, `return ${expr};`);
    await life(page, 'L.s.nextToucan = 0; L.s.nextRain = 1e9; L.s.nextSloth = 0;');
    await page.waitForTimeout(400);
    const sl = await where('({ x: 72, y: L.s.sloth.v + 6 })');
    await life(page, 'L.s.sloth.x = 60; L.s.sloth.wave = 50;');
    await page.waitForTimeout(200);
    await shot('f-sloth', sl);
    for (let i = 0; i < 6; i += 1) {
      await page.waitForTimeout(500);
      await shot(`f-toucan-${i}`, await where('({ x: L.monkey.home.x + 10, y: L.monkey.home.y - 10 })'));
    }
    const tc = await where('L.s.toucan && ({ x: L.s.toucan.x + 9, y: L.s.toucan.y + 4 })');
    if (tc) {
      await page.evaluate(([w]) => {
        const s = document.querySelector('.quest-map');
        const r = s.getBoundingClientRect();
        s.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + w.x * 4, clientY: r.top + w.y * 4 }));
      }, [tc]);
      for (let i = 0; i < 6; i += 1) { await page.waitForTimeout(450); await shot(`f-drop-${i}`, await where('({ x: L.monkey.home.x + 10, y: L.monkey.home.y - 10 })')); }
    }
    await life(page, 'L.s.nextRain = 0; L.s.toucan = null;');
    for (let i = 0; i < 4; i += 1) {
      await page.waitForTimeout(i ? 480 : 2500);
      await page.screenshot({ path: `${out}/f-rain-${i}.png` });
    }
    await shot('f-rain', await where('({ x: L.monkey.home.x, y: L.monkey.home.y })'));
    await life(page, 'L.s.capyOdds = 1; L.s.nextThing = 0;');
    const fall = await where('({ x: (L.fall.x0 + L.fall.x1) / 2 + L.fall.dir * 30, y: L.fall.base - 10 })');
    for (let i = 0; i < 5; i += 1) { await page.waitForTimeout(700); await shot(`f-capy-${i}`, fall); }
    if (page.errors.length) console.log(page.errors);
    await ctx.close();
  }
  if (mode === 'lake') {
    // the fishing lake, the peacock bass up close, and the Places picture
    for (const [label, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 915, height: 412 }]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      await page.goto(site.url);
      const s = emptyState();
      s.settings.pinHash = 'sha256:test';
      s.settings.sound = false;
      s.settings.questView = 'map'; // chose the old map once: the village opens, and the map is in the Menu
      const tasks = defaultTasks();
      s.kids.push({ id: 'kid_sam', name: 'Sam', color: '#4dabf7', tasks, startDate: dateKey(), owned: [], buddy: { species: 'fox', outfit: { background: 'bg-rainforest' } } });
      s.log[dateKey()] = { kid_sam: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done' }])), excused: false } };
      await page.evaluate((st) => {
        localStorage.setItem('kidquest.v1', JSON.stringify(st));
        localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_sam' }));
        localStorage.setItem('kidquest.cloud.cache', JSON.stringify(st));
        localStorage.setItem('kidquest.cloud.buddies', JSON.stringify([{ id: 'kid_ben', name: 'Ben', color: '#fcc419', owned: ['sport-rod-good'], buddy: { species: 'bear', outfit: {} } }]));
      }, s);
      await page.reload();
      await openKid(page, '[data-action="open-kid"]');
      await openOldMap(page); // the old map, from the Menu
      await page.waitForTimeout(500);
      while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
      await page.waitForSelector('.map-visitor');
      await page.waitForTimeout(900);
      await page.click('.map-visitor');
      await page.click('.game-pick [data-kind="fishing"]');
      await page.waitForSelector('.playground');
      await page.waitForTimeout(6000);
      await page.screenshot({ path: `${out}/lake-${label}.png` });
      if (label === 'tablet') {
        const png = await page.evaluate(async () => {
          const { fishPic, SPOTS, SPECIES } = await import('./js/fishing.js');
          const big = document.createElement('canvas'); big.width = 900; big.height = 260;
          const x = big.getContext('2d'); x.imageSmoothingEnabled = false;
          x.fillStyle = '#127a6e'; x.fillRect(0, 0, 900, 260);
          const pb = fishPic(SPOTS['bg-rainforest'].special.look, 30);
          const lm = fishPic(SPECIES.largemouth, 30);
          x.drawImage(pb, 20, 20, pb.width * 13, pb.height * 13);
          x.drawImage(lm, 480, 40, lm.width * 13, lm.height * 13);
          x.fillStyle = '#fff'; x.font = 'bold 22px sans-serif'; x.fillText('Peacock bass (rare)', 120, 245); x.fillText('Largemouth, for comparison', 520, 245);
          return big.toDataURL();
        });
        fs.writeFileSync(`${out}/peacock-bass.png`, Buffer.from(png.split(',')[1], 'base64'));
      }
      await page.close();
    }
  }
  if (mode === 'video') {
    // short clips of each moving thing, at the size of the tablet
    const tap = (page, expr) => page.evaluate((e) => {
      const sec = document.querySelector('.quest-map');
      const w = new Function('L', `return ${e};`)(sec.mapLife);
      const r = sec.getBoundingClientRect();
      sec.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: r.left + w.x * 4, clientY: r.top + w.y * 4 }));
    }, expr);
    const clips = [
      ['toucan-tap', 'L.s.nextSloth = 1e9; L.s.nextRain = 1e9; L.s.nextThing = 1e9;', 'L.monkey.home.y', async (page) => {
        await life(page, 'L.s.nextToucan = 0;');
        await page.waitForFunction(() => document.querySelector('.quest-map').mapLife.s.toucan?.phase === 'away');
        await page.waitForTimeout(1400);
        await tap(page, '({ x: L.s.toucan.x + 9, y: L.s.toucan.y + 4 })');
        await page.waitForTimeout(6500);
      }],
      ['toucan-gets-away', 'L.s.nextSloth = 1e9; L.s.nextRain = 1e9; L.s.nextThing = 1e9;', 'L.monkey.home.y', async (page) => {
        await life(page, 'L.s.nextToucan = 0;');
        await page.waitForTimeout(14000);
      }],
      ['sloth', 'L.s.nextToucan = 1e9; L.s.nextRain = 1e9; L.s.nextThing = 1e9; L.s.nextSloth = 1e9; L.s.sloth = null;', 'L.vines[0]', async (page) => {
        await life(page, 'L.s.nextSloth = 0;');
        await page.waitForTimeout(300);
        await life(page, 'L.s.sloth.x = L.s.sloth.dir > 0 ? 30 : 120;');
        await page.waitForTimeout(5000);
        await tap(page, '({ x: L.s.sloth.x + 10, y: L.s.sloth.v + 6 })');
        await page.waitForTimeout(9000);
      }],
      ['rain', 'L.s.nextToucan = 1e9; L.s.nextThing = 1e9; L.s.nextSloth = 1e9;', 'L.monkey.home.y', async (page) => {
        await page.waitForTimeout(1500);
        await life(page, 'L.s.nextRain = 0;');
        await page.waitForTimeout(14000);
      }],
      ['waterfall', 'L.s.nextToucan = 1e9; L.s.nextRain = 1e9; L.s.nextSloth = 1e9; L.s.nextThing = 1e9;', 'L.fall.base - 10', async (page) => {
        await life(page, 'L.s.capyOdds = 0; L.s.nextThing = 0;');
        await page.waitForTimeout(3500);
        await life(page, 'L.s.capyOdds = 1; L.s.nextThing = 0;');
        await page.waitForTimeout(12000);
      }],
    ];
    const size = { width: 800, height: 700 };
    const only = process.argv[4];
    for (const [name, setup, yExpr, run] of clips) {
      if (only && name !== only) continue;
      const { ctx, page } = await open(size, true);
      await life(page, setup);
      const y = await life(page, `return ${yExpr};`);
      const box = await page.locator('.quest-map').boundingBox();
      await page.evaluate((yy) => window.scrollTo(0, yy), box.y + y * 4 - size.height / 2);
      await page.waitForTimeout(300);
      const skip = (Date.now() - page.t0) / 1000;
      await run(page);
      if (page.errors.length) console.log(name, page.errors);
      const video = page.video();
      await ctx.close();
      fs.renameSync(await video.path(), `${out}/raw-${name}.webm`);
      fs.writeFileSync(`${out}/raw-${name}.json`, JSON.stringify({ skip }));
      console.log(name, 'recorded');
    }
  }
  if (mode === 'song') {
    const page = await browser.newPage();
    await page.goto(site.url);
    const b64 = await page.evaluate(async () => {
      const { renderSong } = await import('./js/music.js');
      const buf = await renderSong('bg-rainforest', 2);
      const d = buf.getChannelData(0);
      const n = d.length;
      const ab = new ArrayBuffer(44 + n * 2);
      const v = new DataView(ab);
      const w = (o, t) => [...t].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
      w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
      v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
      v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
      v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
      for (let i = 0; i < n; i += 1) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
      let t = '';
      const bytes = new Uint8Array(ab);
      for (let i = 0; i < bytes.length; i += 0x8000) t += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
      return btoa(t);
    });
    fs.writeFileSync(`${out}/song-rainforest.wav`, Buffer.from(b64, 'base64'));
    // the Places picture behind the buddy
    await page.setContent('<body style="margin:0;background:#fff"></body>');
    await page.goto(site.url);
    const svg = await page.evaluate(async () => {
      const { buddySvg } = await import('./js/avatar.js');
      return buddySvg({ species: 'fox', outfit: { background: 'bg-rainforest' } });
    });
    await page.setContent(`<div style="width:240px;height:240px">${svg}</div>`);
    await page.locator('div').first().screenshot({ path: `${out}/places-picture.png` });
    await page.close();
  }
} finally {
  await browser.close();
  site.close();
}
