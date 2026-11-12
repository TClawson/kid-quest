// Renders each map theme (screenshots) and each map song (WAV) for previews.
// Run: node test/smoke/themes-preview.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, openOldMap } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const THEMES = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainbow', 'bg-galaxy'];
const site = await serve('.');
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    for (const theme of THEMES) {
      const saved = emptyState();
      saved.settings.pinHash = 'sha256:test';
      saved.settings.sound = false;
      saved.settings.questView = 'map'; // chose the old map once: the village opens, and the map is in the Menu
      const tasks = defaultTasks();
      const mk = (id, name, color, species) => ({ id, name, color, tasks, startDate: dateKey(), buddy: { species, outfit: { background: theme } } });
      saved.kids.push(mk('kid_ava', 'Ava', '#ff6b6b', 'fox'), mk('kid_ben', 'Ben', '#4dabf7', 'bear'), mk('kid_cy', 'Cy', '#69db7c', 'panda'));
      // two tasks done so the walked road shows
      const t = dateKey();
      saved.log = { [t]: { kid_ava: { tasks: { [tasks[0].id]: { status: 'done' }, [tasks[1].id]: { status: 'done' } } } } };
      await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
      await page.reload();
      await openKid(page, '[data-action="open-kid"]');
      await openOldMap(page); // the old map, from the Menu
      await page.waitForTimeout(400);
      const map = page.locator('.quest-map');
      await map.screenshot({ path: `${out}/map-${theme.slice(3)}-${label}.png` });
    }
    if (errors.length) console.log(label, errors);
    if (label === 'tablet') {
      for (const theme of THEMES) {
        const b64 = await page.evaluate(async (id) => {
          const { renderSong } = await import('./js/music.js');
          const buf = await renderSong(id, 2);
          const d = buf.getChannelData(0);
          const n = d.length;
          const ab = new ArrayBuffer(44 + n * 2);
          const v = new DataView(ab);
          const w = (o, s) => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
          w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
          v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
          v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
          v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
          let peak = 0;
          for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(d[i]));
          for (let i = 0; i < n; i += 1) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
          let s = '';
          const bytes = new Uint8Array(ab);
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
          return [btoa(s), peak];
        }, theme);
        fs.writeFileSync(`${out}/song-${theme.slice(3)}.wav`, Buffer.from(b64[0], 'base64'));
        console.log(theme, 'peak', b64[1].toFixed(2));
      }
    }
    await page.close();
  }
} finally {
  await browser.close();
  site.close();
}
