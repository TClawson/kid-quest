// Previews of the rainforest map: the fishing lake with its peacock bass (lake), and the map's song
// and Places picture (song). The village's moving things are in village-life.mjs.
// Run: node test/smoke/rainforest-preview.mjs <outDir> [lake|song]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, tapInVillage } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const mode = process.argv[3] || 'lake';
fs.mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();

try {
  if (mode === 'lake') {
    // the fishing lake, the peacock bass up close, and the Places picture
    for (const [label, viewport] of [['tablet', { width: 1280, height: 800 }], ['phone', { width: 915, height: 412 }]]) {
      const page = await browser.newPage({ viewport, deviceScaleFactor: 2 });
      await page.goto(site.url);
      const s = emptyState();
      s.settings.pinHash = 'sha256:test';
      s.settings.sound = false;
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
      await page.waitForTimeout(500);
      while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(300); }
      await page.waitForSelector('.village .v-visitor');
      await page.waitForTimeout(900);
      await tapInVillage(page, '.v-visitor'); // the village's visitor, by the pond
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
