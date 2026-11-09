// Screenshots of the walkable village for previews.
// Run: node test/smoke/village-screens.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-09'; // a Monday

function family(done = 2, plan = false) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const tasks = defaultTasks();
  s.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(day, -20), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } });
  if (plan) {
    const [teeth, bed, floor, piano, chore] = tasks;
    s.kids[0].plan = { order: [chore, bed, teeth, floor, piano].map((t) => t.id), cues: { [bed.id]: 'When I wake up', [teeth.id]: 'After breakfast', [piano.id]: 'After snack' }, week: '2026-11-09' };
  }
  s.log[day] = { kid_ava: { tasks: Object.fromEntries(tasks.slice(0, done).map((t) => [t.id, { status: 'done', by: 'self' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
for (const [label, viewport] of [['tablet', { width: 800, height: 1280 }], ['phone', { width: 412, height: 915 }]]) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.clock.install({ time: new Date(`${day}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(1));
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(1500);
  const shot = async (name) => { const box = await page.locator('.village-view').boundingBox(); const y = await page.evaluate(() => window.scrollY); await page.screenshot({ path: `${out}/${name}-${label}.png`, clip: { ...box, y: box.y + y }, fullPage: true }); };
  await shot('1-start');
  // walk to a villager with a quest (not the piano timer) and talk; bed, teeth and floor are done in the house
  await page.evaluate(() => [...document.querySelectorAll('.villager[data-vid]')].find((e) => !/Piano/.test(e.getAttribute('aria-label'))).click());
  await page.clock.runFor(4000);
  await shot('2-talk');
  await page.click('.v-dialog [data-v="do"]');
  await page.clock.runFor(1500);
  // a parent-checked chore asks for a parent first: later
  if (await page.locator('#modal [data-action="modal-close"]').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(1500); }
  await shot('3-thanks');
  if (await page.locator('.v-dialog:not([hidden]) [data-v="bye"]').count()) await page.click('.v-dialog [data-v="bye"]');
  // walk south across the bridge
  const box = await page.locator('.village-view').boundingBox();
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 40);
  await page.clock.runFor(3000);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height - 40);
  await page.clock.runFor(3000);
  await shot('4-south');
  // with the kid's own plan: steps numbered, an off-plan villager points back to the plan
  await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), family(3, true));
  await page.reload();
  await page.click('[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(1500);
  await shot('5-plan-start');
  await page.evaluate(() => [...document.querySelectorAll('.villager:not(.keeper)')].pop().click());
  await page.clock.runFor(4000);
  await shot('6-plan-off-order');
  await page.click('.v-dialog [data-v="go"]');
  await page.clock.runFor(4000);
  await shot('7-plan-step');
  await page.click('.v-dialog [data-v="do"]');
  await page.clock.runFor(1500);
  if (await page.locator('#modal [data-action="modal-close"]').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(1500); }
  await shot('8-plan-thanks');
  if (label === 'tablet') {
    // the whole village at once
    await page.evaluate(() => { const v = document.querySelector('.village-view'); v.style.height = '1440px'; v.style.width = '1344px'; });
    await page.setViewportSize({ width: 1400, height: 1600 });
    await page.clock.runFor(3000);
    await shot('0-whole-village');
  }
  await ctx.close();
}
await browser.close(); site.close();
