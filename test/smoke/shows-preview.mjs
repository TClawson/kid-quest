// Preview of the secret shows (js/mapshow.js): for each map, a kid with that map's treasure
// map finished taps the landmark in the village. Saves screenshots (and videos with VIDEO=1) to SHOTS_DIR.
// Run: SHOTS_DIR=/tmp/shows node test/smoke/shows-preview.mjs [bg-meadow ...]
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, tasksForDay, fallbackHash } from '../../js/logic.js';
import { SECRETS } from '../../js/treasure-art.js';
import { SHOWS } from '../../js/mapshow.js';
import { openKid, tapInVillage } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR || '/tmp/shows';
const TODAY = '2026-11-12';
const themes = process.argv.slice(2).length ? process.argv.slice(2) : Object.keys(SECRETS);
const phone = process.env.PHONE === '1';
const site = await serve('.');
const browser = await chromium.launch();

function family(theme) {
  const s = emptyState();
  s.settings.allowance = { on: false, coins: 300, xp: 300, bonus: 50, since: '2026-11-01' };
  s.settings.music = false;
  s.settings.pinHash = fallbackHash('kidquest:1234');
  const kid = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks().map((t) => ({ ...t, verify: 'self' })), startDate: addDays(TODAY, -4), owned: Object.keys(SECRETS), spent: 0, buddy: { species: 'fox', outfit: { background: theme } } };
  s.kids.push(kid);
  for (let i = 4; i >= 1; i -= 1) {
    const key = addDays(TODAY, -i);
    const tasks = {};
    for (const t of tasksForDay(s, kid, key, TODAY)) tasks[t.id] = { status: 'done' };
    (s.log[key] ||= {})[kid.id] = { tasks, chest: { tier: 'silver', kind: 'piece', map: theme } };
  }
  return s;
}

try {
  for (const theme of themes) {
    const size = phone ? { width: 412, height: 860 } : { width: 900, height: 1100 };
    const ctx = await browser.newContext({ viewport: size, ...(process.env.VIDEO ? { recordVideo: { dir: shots, size } } : {}) });
    const page = await ctx.newPage();
    const born = Date.now();
    await page.clock.install({ time: new Date(`${TODAY}T17:00:00`) });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(site.url);
    await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), family(theme));
    await page.reload();
    await openKid(page, '[data-action="open-kid"]');
    await page.waitForSelector('.village .v-landmark');
    await page.waitForTimeout(900);
    while (await page.isVisible('#modal:not([hidden]) [data-action="modal-close"]')) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(400); }
    await page.screenshot({ path: `${shots}/${theme}-0.png` });
    // tap the landmark: the buddy walks over, it says something and its show plays over the view
    await tapInVillage(page, '.v-landmark');
    const clickAt = (Date.now() - born) / 1000;
    for (const [i, ms] of [[1, 1200], [2, 1600], [3, 1600], [4, 1600]]) {
      await page.waitForTimeout(ms);
      await page.screenshot({ path: `${shots}/${theme}-${i}.png` });
    }
    await page.waitForTimeout(2600);
    assert.equal(await page.locator('canvas.map-show').count(), 0, 'the show ends');
    assert.deepEqual(errors, [], `no errors (${theme})`);
    let wav = null;
    if (process.env.VIDEO) {
      // the show's music and sounds, rendered offline, laid over the video
      const b64 = await page.evaluate(async ([id, sfx]) => {
        const { renderShow } = await import('./js/music.js');
        const buf = await renderShow(id, sfx);
        const d = buf.getChannelData(0);
        const n = d.length;
        const ab = new ArrayBuffer(44 + n * 2);
        const v = new DataView(ab);
        const w = (o, str) => [...str].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
        w(0, 'RIFF'); v.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
        v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
        v.setUint32(24, buf.sampleRate, true); v.setUint32(28, buf.sampleRate * 2, true);
        v.setUint16(32, 2, true); v.setUint16(34, 16, true); w(36, 'data'); v.setUint32(40, n * 2, true);
        for (let i = 0; i < n; i += 1) v.setInt16(44 + i * 2, Math.max(-1, Math.min(1, d[i])) * 32767, true);
        let str = '';
        const bytes = new Uint8Array(ab);
        for (let i = 0; i < bytes.length; i += 0x8000) str += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
        return btoa(str);
      }, [theme, SHOWS[theme].sfx]);
      wav = `${shots}/${theme}.wav`;
      fs.writeFileSync(wav, Buffer.from(b64, 'base64'));
    }
    const video = page.video();
    await ctx.close();
    if (video) {
      const webm = await video.path();
      const start = Math.max(0, clickAt - 1);
      execFileSync('ffmpeg', ['-loglevel', 'error', '-y', '-ss', String(start), '-i', webm, '-itsoffset', String(clickAt - start), '-i', wav,
        '-map', '0:v', '-map', '1:a', '-t', '11', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '26', '-c:a', 'aac', `${shots}/show-${theme.slice(3)}${phone ? '-phone' : ''}.mp4`]);
      fs.rmSync(webm);
      fs.rmSync(wav);
    }
    console.log(theme, 'ok');
  }
} finally {
  await browser.close();
  site.close();
}
