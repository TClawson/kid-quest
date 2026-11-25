// Previews of December in the village and the night (js/xmaslights.js, js/nightfx.js,
// js/adventart.js, js/santaart.js), in the real app: the kid's village on a December day, by day
// and at night, at 3 screen pixels per village pixel, with the twinkle frames.
// Run: node test/smoke/xmas-village-preview.mjs <outDir> [bg-meadow ...] [--modes day,night] [--frames] [--santa t1,t2] [--film]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
//
// Writes <outDir>/<mode>-<map>.png (night-meadow.png...), with --frames <mode>-<map>-f0..2.png,
// with --santa <outDir>/santa-<mode>-<map>-<t>.png (the flyover at those seconds), with --film
// <outDir>/film-<mode>-<map>-000.png... (the whole flyover, 8 frames a second, the lights twinkling).
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { VILLAGE_THEMES } from '../../js/villagemaps.js';
import { openKid } from '../helpers/open-kid.mjs';

const args = process.argv.slice(2);
const opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d);
const out = (args.find((a, i) => !a.startsWith('-') && !a.startsWith('bg-') && !['--modes', '--santa', '--day'].includes(args[i - 1])) || 'previews').replace(/\/$/, '');
const maps = args.filter((a) => a.startsWith('bg-'));
const modes = opt('--modes', 'day,night').split(',');
const frames = args.includes('--frames');
const film = args.includes('--film');
const santa = opt('--santa', '') ? opt('--santa', '').split(',').map(Number) : film ? [] : null;
const day = opt('--day', '2026-12-11');
fs.mkdirSync(`${out}/`, { recursive: true });

function family(theme) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], spent: 0, buddy: { species: 'fox', outfit: { background: theme, hat: 'hat-cap' } } });
  // this map's treasure map is finished: its landmark stands in the village
  for (let i = 1; i <= 4; i += 1) s.log[addDays(day, -i * 3)] = { kid_ava: { tasks: {}, chest: { kind: 'piece', map: theme } } };
  const ava = s.kids[0];
  const today = ava.tasks.filter((t) => t.period !== 'exercise').slice(0, 2);
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(today.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
for (const theme of VILLAGE_THEMES) {
  if (maps.length && !maps.includes(theme)) continue;
  const short = theme.replace('bg-', '');
  for (const mode of modes) {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 2300 }, deviceScaleFactor: 1 });
    await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.village-view{height:2200px!important}.screen{max-width:none!important}.k-hud{display:none!important}'; document.head.append(st); }));
    const page = await ctx.newPage();
    page.on('pageerror', (e) => console.log('ERR', theme, e.message));
    page.on('console', (m) => { if (m.type() === 'error') console.log('console:', theme, m.text()); });
    await page.clock.install({ time: new Date(`${day}T${mode === 'night' ? '18:30' : '11:30'}:00`) });
    await page.goto(site.url);
    await page.evaluate(([s, mode, santaOn]) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(s));
      localStorage.setItem('kidquest.xmas', 'on');
      localStorage.setItem('kidquest.night', mode);
      localStorage.setItem('kidquest.santa', santaOn ? 'test' : 'off');
    }, [family(theme), mode, Boolean(santa)]);
    await page.reload();
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await page.clock.runFor(1500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
    await page.locator('.village').scrollIntoViewIfNeeded();
    await page.clock.runFor(1000);
    // the whole village at 3 screen pixels a village pixel: the world's own box
    const box = await page.locator('.village-world').boundingBox(); const y = await page.evaluate(() => window.scrollY);
    const shot = (file) => page.screenshot({ path: `${out}/${file}.png`, clip: { x: Math.round(box.x), y: Math.round(box.y + y), width: Math.round(box.width), height: Math.round(box.height) }, fullPage: true });
    // a frozen snowfall: the weather keeps falling, so stop it where it is
    await page.evaluate(() => document.querySelector('.village').kqTwinkle?.(0));
    await shot(`${mode}-${short}`);
    if (frames) for (const f of [0, 1, 2]) { await page.evaluate((f) => document.querySelector('.village').kqTwinkle?.(f), f); await shot(`${mode}-${short}-f${f}`); }
    if (santa) for (const t of santa) { await page.evaluate((t) => document.querySelector('.village').kqSanta?.(t), t); await page.waitForTimeout(300); await shot(`santa-${mode}-${short}-${String(t).replace('.', '_')}`); }
    if (film) for (let k = 0; k <= 88; k += 1) {
      const t = k / 8 - 0.5;
      await page.evaluate((t) => { const v = document.querySelector('.village'); v.kqTwinkle?.(Math.floor((t + 0.5) / 0.42) % 3); v.kqSanta?.(Math.max(0, t)); }, t);
      await page.waitForTimeout(280); // the signs the sleigh crosses fade out (a CSS transition)
      await shot(`film-${mode}-${short}-${String(k).padStart(3, '0')}`);
    }
    await ctx.close();
  }
  console.log(theme, 'done');
}
await browser.close(); site.close();
