// The kid's Today button and Today's quests list in the village:
// - the button counts what's left, with a bar piece per quest (done, waiting, to go)
// - the list groups the day (morning, after school, evening, bonus exercise)
// - Go walks the buddy to the villager who gives the quest and opens the talk box; a house
//   chore walks into the house; the bonus exercise comes from the coach, and pays gems
// - an earlier day's chest waits in a button next to Today
// - Plan my day opens from the list; coming back from the shop puts the village back in view,
//   and the shop's buddy picker opens from its own Switch buddy button
// - a kid tablet with one kid skips the kid picker (Parents is in the Menu)
// Run: node test/smoke/kid-today.mjs [outDir]   (outDir: also save screenshots)
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { emptyState, addDays, fallbackHash, totalGems } from '../../js/logic.js';
import { TEST_DAY } from '../helpers/clock.mjs';

const out = process.argv[2]?.replace(/\/$/, '');
if (out) fs.mkdirSync(out, { recursive: true });
const DAY = TEST_DAY; // the page's clock is installed at a time of this day (see clock.mjs)
const ALL = [0, 1, 2, 3, 4, 5, 6];

// One kid on her own tablet: the bed is a house chore, jumping jacks are her bonus exercise,
// and yesterday's chest (every chore done) was never opened.
function soloFamily() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  const tasks = [
    { id: 'e_bed', name: 'Make bed', icon: '🛏️', period: 'morning', days: ALL, verify: 'self', minutes: 0, house: 'bed' },
    { id: 'e_cat', name: 'Feed the cat', icon: '🐱', period: 'morning', days: ALL, verify: 'self', minutes: 0 },
    { id: 'e_read', name: 'Reading', icon: '📖', period: 'afternoon', days: ALL, verify: 'self', minutes: 0 },
    { id: 'e_jump', name: 'Jumping jacks', icon: '🤸', period: 'exercise', days: ALL, verify: 'self', minutes: 0 },
  ];
  const start = addDays(DAY, -10);
  s.kids.push({ id: 'kid_esther', name: 'Esther', color: '#da77f2', tasks, startDate: start, seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species: 'cat', outfit: { background: 'bg-meadow' } } });
  for (let i = 1; i <= 9; i += 1) {
    const key = addDays(DAY, -i);
    s.log[key] = { kid_esther: { tasks: Object.fromEntries(tasks.filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: 'done', by: 'self' }])) } };
    if (i > 1) s.log[key].kid_esther.chest = { tier: 'wood', kind: 'coins', coins: 5 };
  }
  s.celebrations = { kid_esther: { sat: DAY, reward: DAY } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const errors = [];

async function open(viewport, st, { time = '16:30', outside = true } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: out ? 2 : 1, hasTouch: viewport.width < 600 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  await page.clock.install({ time: new Date(`${DAY}T${time}:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, out]) => {
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    if (out) localStorage.setItem('kidquest.house', JSON.stringify(Object.fromEntries(s.kids.map((k) => [k.id, { day: out, inside: false }]))));
  }, [st, outside ? DAY : null]);
  await page.reload();
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().evaluate((b) => b.click()); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const shot = async (page, name) => { if (out) await page.screenshot({ path: `${out}/${name}.png` }); };
const inView = (page, sel) => page.locator(sel).evaluate((el) => { const r = el.getBoundingClientRect(); return r.bottom > 80 && r.top < innerHeight - 80; });
const saved = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
async function walkUntil(page, sel, what) {
  for (let i = 0; i < 40 && !(await page.locator(sel).count()); i += 1) await page.clock.runFor(500);
  assert.ok(await page.locator(sel).count(), what);
}

try {
  // ---- a family tablet: Ayden has 4 done, 2 waiting for a parent, 3 to go (and soccer)
  {
    const { ctx, page } = await open({ width: 1280, height: 800 }, parentFamily(DAY, new Date(`${DAY}T16:30:00`).getTime()));
    assert.ok(await page.locator('[data-action="open-kid"][data-id="kid_ayden"]').count(), 'four kids: the kid picker');
    await page.click('[data-action="open-kid"][data-id="kid_ayden"]');
    await page.clock.runFor(1500);
    await closeModals(page);
    await page.locator('.village').scrollIntoViewIfNeeded();
    await page.clock.runFor(1000);

    // the Today button
    const btn = page.locator('.village .v-hud [data-action="today"]');
    assert.match(await btn.innerText(), /Today\s*3 to go/);
    assert.equal(await btn.locator('.t-seg i').count(), 9, 'a piece per quest');
    assert.equal(await btn.locator('.t-seg i.d').count(), 4, 'four done');
    assert.equal(await btn.locator('.t-seg i.w').count(), 2, 'two waiting');
    assert.match(await btn.getAttribute('aria-label'), /3 to go, 2 waiting for a parent/);
    assert.equal(await page.locator('.village .exercise').count(), 0, 'no Bonus exercise section under the village');
    await shot(page, 'village');

    // the list
    await btn.click();
    await page.waitForSelector('.today-pop');
    const groups = await page.$$eval('.today-pop .t-grp', (els) => els.map((e) => e.dataset.group));
    assert.deepEqual(groups.sort(), ['afternoon', 'evening', 'exercise', 'morning']);
    assert.match(await page.locator('.t-grp[data-group="morning"] h3').innerText(), /by \d/, 'the morning deadline');
    assert.equal(await page.locator('.t-q.done').count(), 4);
    assert.equal(await page.locator('.t-q.waiting [data-action="today-ask"]').count(), 2, 'Ask now for the waiting ones');
    assert.equal(await page.locator('.t-q.next').count(), 1, 'one quest is next');
    assert.equal(await page.locator('.t-q.next').getAttribute('data-id'), 'a_hw');
    assert.match(await page.locator('.t-grp[data-group="exercise"] .t-q').innerText(), /Coach/, 'the coach gives the exercise');
    assert.match(await page.locator('.t-foot').innerText(), /3 more for today's/);
    assert.match(await page.locator('.t-foot').innerText(), /Shop opens/);
    assert.equal(await page.locator('.today-pop [data-action="today-tick"], .today-pop [data-action="done"]').count(), 0, 'no ticking from the list');
    await shot(page, 'list');

    // Plan my day, from the list
    await page.click('.t-foot [data-action="plan"]');
    await page.clock.runFor(400);
    assert.ok(await page.locator('#modal [data-action="plan-move"]').count(), 'the plan opens');
    await closeModals(page);

    // Go: the list closes, the buddy walks to the villager and the talk box opens on the homework
    await btn.click();
    await page.click('.t-q[data-id="a_hw"] [data-action="today-go"]');
    assert.equal(await page.locator('#modal:not([hidden])').count(), 0, 'the list closed');
    await walkUntil(page, '.village .v-dialog:not([hidden])', 'the talk box opened');
    assert.match(await page.locator('.village .v-dialog').innerText(), /Homework/);
    assert.equal(await page.locator('.village .v-hud').isVisible(), false, 'the Today button hides while talking');
    await shot(page, 'go-villager');
    await page.click('.village .v-dialog [data-v="bye"]');

    // Esther's day is all done, so her shop is open: the shop and back puts the village in view again
    await page.click('.k-hud [data-action="menu"]');
    await page.click('#modal [data-action="menu-switch"]');
    await page.click('[data-action="open-kid"][data-id="kid_esther"]');
    await page.clock.runFor(1500);
    await closeModals(page);
    assert.match(await page.locator('.village .v-hud [data-action="today"]').innerText(), /all done/);
    await page.locator('.village').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, 40));
    await page.click('[data-action="wardrobe"]');
    await page.waitForSelector('[data-action="wardrobe-back"]');
    assert.ok(await page.locator('[data-action="wardrobe-switch"]').count(), 'a Switch buddy button');
    assert.equal(await page.locator('.species-pick').count(), 0, 'the species picker waits behind it');
    await page.click('[data-action="wardrobe-switch"]');
    assert.ok(await page.locator('.species-pick').count(), 'the species picker opens');
    await shot(page, 'shop-switch');
    await page.click('[data-action="wardrobe-back"]');
    await page.waitForSelector('.village .village-view');
    assert.ok(await inView(page, '.village .village-view'), 'back from the shop with the village in view');
    await ctx.close();
  }

  // ---- one kid on her own tablet
  {
    const { ctx, page } = await open({ width: 412, height: 915 }, soloFamily(), { time: '07:30' });
    await page.waitForSelector('.screen.kid');
    assert.equal(await page.locator('[data-action="open-kid"]').count(), 0, 'no kid picker');
    await page.clock.runFor(1500);
    await closeModals(page);
    await page.click('.k-hud [data-action="menu"]');
    assert.ok(await page.locator('#modal [data-action="menu-parents"]').count(), 'Parents is in the Menu');
    assert.equal(await page.locator('#modal [data-action="menu-switch"]').count(), 0, 'and no Switch kid with one kid');
    await closeModals(page);
    await page.locator('.village').scrollIntoViewIfNeeded();
    await page.clock.runFor(800);

    // yesterday's chest waits next to Today
    const chest = page.locator('.village .v-hud .hud-chest');
    assert.ok(await chest.isVisible(), "yesterday's chest button");
    assert.equal(await chest.getAttribute('data-day'), addDays(DAY, -1));
    await shot(page, 'solo-village');
    await chest.click();
    await page.clock.runFor(2000);
    assert.ok((await saved(page)).log[addDays(DAY, -1)].kid_esther.chest, "yesterday's chest is opened");
    await closeModals(page);
    await page.clock.runFor(500);
    assert.equal(await page.locator('.village .v-hud .hud-chest').count(), 0, 'and its button goes');

    // Go on a house chore walks into the house, and the bed talks
    await page.locator('.village').scrollIntoViewIfNeeded();
    await page.click('.v-hud [data-action="today"]');
    await page.click('.t-q[data-id="e_bed"] [data-action="today-go"]');
    await walkUntil(page, '.house .v-dialog:not([hidden])', 'into the house, and the bed talks');
    assert.match(await page.locator('.house .v-dialog').innerText(), /bed/i);
    await shot(page, 'go-house');

    // Go on the exercise, from inside: out of the house to the coach
    const gems = totalGems(await saved(page), (await saved(page)).kids[0], DAY);
    await page.click('.house .v-dialog [data-h="bye"]');
    await page.locator('.house').scrollIntoViewIfNeeded();
    await page.click('.house .v-hud [data-action="today"]');
    assert.match(await page.locator('.t-grp[data-group="exercise"]').innerText(), /Jumping jacks/);
    await page.click('.t-q[data-id="e_jump"] [data-action="today-go"]');
    await walkUntil(page, '.village .v-dialog:not([hidden])', 'out to the coach, who talks');
    const talk = await page.locator('.village .v-dialog').innerText();
    assert.match(talk, /Coach Dash/);
    assert.match(talk, /Jumping jacks/);
    assert.match(talk, /💎/);
    await shot(page, 'coach-talk');
    await page.click('.village .v-dialog [data-v="do"]');
    await page.clock.runFor(1500);
    const after = await saved(page);
    assert.equal(after.log[DAY].kid_esther.tasks.e_jump?.status, 'done', 'the exercise is done');
    assert.ok(totalGems(after, after.kids[0], DAY) > gems, 'and paid gems');
    await ctx.close();
  }
  assert.deepEqual(errors, [], 'no errors in the page');
  console.log('kid today smoke ok');
} finally {
  await browser.close();
  site.close();
}
