// The beach village's crabs: tapping a crab doesn't move the buddy; walking up to one makes it
// chase the buddy, who runs a short way off. Run: node test/smoke/village-crabs.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { villageLayout } from '../../js/villagemaps.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-10';
const s = emptyState();
s.settings.pinHash = fallbackHash('kidquest:1234');
s.settings.sound = false;
s.settings.questView = 'village';
s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-sunset', hat: 'hat-cap' } } });

const site = await serve('.');
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 2 });
page.on('pageerror', (e) => { console.log('ERR', e.message); process.exitCode = 1; });
await page.clock.install({ time: new Date(`${day}T07:30:00`) });
await page.goto(site.url);
await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
await page.reload();
await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
await page.clock.runFor(1000);
while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
await page.locator('.village').scrollIntoViewIfNeeded();
await page.clock.runFor(500);
const buddyAt = () => page.evaluate(() => { const b = document.querySelector('.v-buddy').getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height }; });
// a village point on screen
const screenOf = (vx, vy) => page.evaluate(([x, y]) => { const r = document.querySelector('.village-world').getBoundingClientRect(); const k = r.width / 448; return { x: r.x + x * k, y: r.y + y * k }; }, [vx, vy]);
// the crab nearest the buddy, in village pixels
const crab = await page.evaluate(() => { const a = document.querySelector('.village').mapLife; return a.where(); });
// 1) tap right on a crab: it snaps, the buddy stays put
const before = await buddyAt();
const onCrab = await screenOf(crab.x, crab.y);
await page.mouse.click(onCrab.x, onCrab.y);
await page.clock.runFor(1500);
const after = await buddyAt();
assert.ok(Math.hypot(after.x - before.x, after.y - before.y) < 2, 'tapping a crab leaves the buddy where it is');
// 2) walk right up to it: it chases the buddy off a short way
await page.clock.runFor(4000); // let it go home
const home = await page.evaluate(() => document.querySelector('.village').mapLife.where());
const L = villageLayout('bg-sunset');
const spot = [[0, 16], [16, 10], [-16, 10], [0, -16], [18, 0], [-18, 0]].map(([dx, dy]) => ({ x: home.x + dx, y: home.y + dy })).find((p) => !L.blocked(p.x, p.y, 6));
// walk over (the camera follows the buddy, so the crab may start off screen)
const vb = await page.locator('.village-view').boundingBox();
let near = await screenOf(spot.x, spot.y);
for (let i = 0; i < 4 && (near.x < vb.x + 20 || near.x > vb.x + vb.width - 20 || near.y < vb.y + 20 || near.y > vb.y + vb.height - 200); i += 1) {
  await page.mouse.click(Math.max(vb.x + 60, Math.min(vb.x + vb.width - 60, near.x)), Math.max(vb.y + 60, Math.min(vb.y + vb.height - 260, near.y)));
  await page.clock.runFor(3000);
  near = await screenOf(spot.x, spot.y);
}
await page.mouse.click(near.x, near.y);
let scared = false;
for (let i = 0; i < 40 && !scared; i += 1) { await page.clock.runFor(150); scared = await page.locator('.v-buddy.scared').count() > 0; }
assert.ok(scared, 'the buddy runs from the crab');
const box = await page.locator('.village-view').boundingBox();
for (let i = 1; i <= 4; i += 1) { await page.clock.runFor(320); await page.screenshot({ path: `${out}/crab-chase-${i}.png`, clip: box }); }
await page.clock.runFor(2500);
assert.equal(await page.locator('.v-buddy.scared').count(), 0, 'and calms down after a short run');
console.log('crab test passed');
await browser.close(); site.close();
