// Records a short video of the live buddies (not part of the test run).
// Run: node test/smoke/live-preview.mjs <out dir>
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey } from '../../js/logic.js';
import { openKid, openOldMap } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
mkdirSync(out, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 432, height: 860 }, recordVideo: { dir: out, size: { width: 432, height: 860 } } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.error('pageerror', e.message));

const saved = emptyState();
saved.settings.pinHash = 'sha256:test';
saved.settings.questView = 'list';
saved.settings.sound = false;
const kid = (id, name, color, buddy) => ({ id, name, color, tasks: defaultTasks(), startDate: dateKey(), buddy, owned: [] });
saved.kids.push(
  kid('kid_ava', 'Ava', '#ff6b6b', { species: 'fox', outfit: { background: 'bg-meadow', hat: 'hat-cap' } }),
  kid('kid_ben', 'Ben', '#4dabf7', { species: 'panda', outfit: { background: 'bg-ocean' } }),
  kid('kid_cal', 'Cal', '#69db7c', { species: 'dino', outfit: { background: 'bg-volcano', neck: 'neck-bowtie' } }),
);
await page.goto(site.url);
await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
await page.reload();
const wait = (ms) => page.waitForTimeout(ms);
const caption = (text) => page.evaluate((t) => {
  let el = document.getElementById('cap');
  if (!el) {
    el = Object.assign(document.createElement('div'), { id: 'cap' });
    el.style.cssText = 'position:fixed;left:8px;right:8px;bottom:10px;z-index:9999;background:#1b1530e6;color:#ffd43b;font:24px "Jersey 10",system-ui;padding:8px 12px;border-radius:8px;text-align:center;pointer-events:none';
    document.body.append(el);
  }
  el.textContent = t;
}, text);

await caption('Every buddy on the home screen is alive');
await wait(3000);
await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
await openOldMap(page); // the old map, from the Menu
await caption('Ava\'s fox: blinks, looks around, wags');
await wait(3000);
const box = await page.locator('.buddy-panel canvas.live-buddy').boundingBox();
const at = (x, y) => [box.x + (box.width * x) / 24, box.y + (box.height * y) / 24];
await caption('Pat the head: happy eyes and hearts');
await page.mouse.click(...at(12, 7));
await wait(2200);
await caption('Poke the tummy: a giggle (or a sports move)');
await page.mouse.click(...at(12, 19));
await wait(2000);
await caption('Drag a finger: the eyes follow it');
await page.mouse.move(...at(1, 3));
await page.mouse.down();
for (const [x, y] of [[23, 3], [23, 22], [1, 22], [1, 3], [12, 0]]) { await page.mouse.move(...at(x, y), { steps: 12 }); await wait(350); }
await page.mouse.up();
await wait(800);
await caption('Lots of quick taps: dizzy and giggly');
for (let i = 0; i < 6; i += 1) { await page.mouse.click(...at(12, 18)); await wait(120); }
await wait(2200);
await caption('Finish a task: a cheer');
await page.click('[data-action="task"] >> nth=0');
await wait(3200);
while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await wait(300); }
await caption('Piano timer: dancing on the kid\'s beat');
const piano = saved.kids[0].tasks.find((t) => /piano/i.test(t.name));
await page.click(`[data-action="task"][data-id="${piano.id}"]`);
await wait(800);
// pretend the beat follower found a beat at 100 a minute
await page.evaluate(() => import('./js/live.js').then((m) => {
  m.feel('kid:kid_ava', { valence: 0.95, arousal: 0.9, dance: 1, sing: 0.6, notes: true });
  window.fakeBeat = setInterval(() => m.live('kid:kid_ava').beat(600), 600);
}));
await wait(7000);
await caption('No piano for a while: bored, then asleep');
await page.evaluate(() => import('./js/live.js').then((m) => { clearInterval(window.fakeBeat); m.live('kid:kid_ava').noBeat(); m.feel('kid:kid_ava', { valence: -0.3, arousal: 0.2, sleep: 0.3 }); }));
await wait(2500);
await page.evaluate(() => import('./js/live.js').then((m) => m.feel('kid:kid_ava', { valence: 0.1, arousal: 0.1, sleep: 1 })));
await wait(3000);
await caption('Playing again wakes it up');
await page.evaluate(() => import('./js/live.js').then((m) => {
  m.live('kid:kid_ava').surprise();
  m.feel('kid:kid_ava', { valence: 0.95, arousal: 0.9, dance: 1, notes: true });
  window.fakeBeat = setInterval(() => m.live('kid:kid_ava').beat(600), 600);
}));
await wait(4000);
await page.screenshot({ path: `${out}/timer-dancing.png` });
await ctx.close();
await browser.close();
site.close();
console.log('video saved in', out);
