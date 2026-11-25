// Browser test: the December village for real (advent.js, advent-ui.js).
//   - On a December day the kid walks out of the buddy's house and Santa flies over, once: his
//     present lands by the door, is the kid's in the synced state, and stays there through a
//     reload (no second flight) until it is opened. Opening it gives the prize and the day's
//     letter, which is kept in the mailbox by the door (Santa's letters book).
//   - The advent house opens on the wall of doors: today's door and a missed one open once the
//     chores are approved, a third waits for tomorrow, a later day's door waits for its day, and
//     a kid whose chores wait for a parent sees "Waiting for a grown-up".
//   - The little one (Little games): Santa's present is a picture (no letter), and her doors give
//     her stickers.
//   - Nothing of December shows on 20 November or 2 January, but the night does (after sunset).
// Run: node test/smoke/xmas-village.mjs  (SHOTS=dir also saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays, tasksForDay } from '../../js/logic.js';
import { seenSaturday } from '../helpers/seed.mjs';
import { closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS;
const DAY = '2026-12-11';
const site = await serve('.');
const browser = await chromium.launch();

/** A family on a day: Ava (chores done and approved), Ben (chores waiting for a parent), Mia (Little games, approved). */
function family(day, { inside = true } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  const kid = (id, name, extra = {}) => ({ id, name, color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -30), seenUnlocks: [], seenMoves: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } }, ...extra });
  s.kids.push(kid('kid_ava', 'Ava'), kid('kid_ben', 'Ben'), kid('kid_mia', 'Mia', { littleGames: true, little: { since: addDays(day, -30), spent: 0, stickers: {}, puzzles: 0, visits: 0 } }));
  s.log[day] = {};
  for (const k of s.kids) {
    const st = k.id === 'kid_ben' ? 'pending' : 'done';
    s.log[day][k.id] = { tasks: Object.fromEntries(tasksForDay(s, k, day, day).filter((t) => t.period !== 'exercise').map((t) => [t.id, { status: st, by: 'parent' }])) };
  }
  seenSaturday(s, day);
  // every kid has been in the app before, so the day starts in the buddy's house (inside false:
  // the first time ever, which starts outside)
  const house = inside ? Object.fromEntries(s.kids.map((k) => [k.id, { day, inside: true, place: 'house' }])) : {};
  return { s, house };
}

const errors = [];
async function open(day, time, { state, house, night = null, parent = false } = {}) {
  // the family's clock is Denver's (the night follows Denver's sunset): every day here is in winter time
  const ctx = await browser.newContext({ viewport: { width: 900, height: 1200 }, deviceScaleFactor: 1, timezoneId: 'America/Denver' });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.clock.install({ time: new Date(`${day}T${time}:00-07:00`) });
  // a parent's phone: signed in to the family as a parent (the cloud itself stays offline here)
  if (parent) await page.route('**/js/vendor/firebase.js', (r) => r.abort());
  // seed on another page of the site first, so the app never runs on top of old data
  await page.goto(`${site.url}manifest.webmanifest`);
  await page.evaluate(([s, h, n, par]) => {
    localStorage.clear();
    localStorage.setItem('kidquest.v1', JSON.stringify(s));
    localStorage.setItem('kidquest.house', JSON.stringify(h));
    if (n) localStorage.setItem('kidquest.night', n);
    if (par) {
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'parent', kidId: null, email: 'parent@example.com' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(s));
    }
  }, [state, house, night, parent]);
  await page.goto(site.url);
  return { page, ctx };
}
const openKid = async (page, id) => {
  await page.click(`[data-action="open-kid"][data-id="${id}"]`);
  await page.clock.runFor(800);
  await closePops(page);
};
const kidState = (page, id) => page.evaluate(async (kidId) => {
  const { state } = await import('./js/ctx.js');
  return JSON.parse(JSON.stringify(state.kids.find((k) => k.id === kidId)));
}, id);
const coins = (page, id) => page.evaluate(async (kidId) => {
  const { state } = await import('./js/ctx.js');
  const { totalCoins, totalGems } = await import('./js/logic.js');
  const k = state.kids.find((x) => x.id === kidId);
  return { coins: totalCoins(state, k, '2026-12-11'), gems: totalGems(state, k, '2026-12-11') };
}, id);
const goOutside = async (page) => {
  await page.waitForSelector('.h-spot[data-spot="door"]');
  await page.click('.h-spot[data-spot="door"]');
  for (let i = 0; i < 40 && !(await page.locator('.village').count()); i += 1) await page.clock.runFor(250);
  await page.waitForSelector('.village');
};
/** Taps door n on the open advent wall. */
const tapDoor = async (page, n) => {
  const at = await page.evaluate((num) => {
    const c = document.querySelector('#modal .xm-wall'); const d = c.kqDoors.find((q) => q.n === num); const r = c.getBoundingClientRect();
    return { x: r.left + ((d.x + d.w / 2) * r.width) / c.width, y: r.top + ((d.y + d.h / 2) * r.height) / c.height };
  }, n);
  await page.mouse.click(at.x, at.y);
  await page.clock.runFor(300);
};
const shot = async (page, name) => { if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/${name}.png` }); } };

try {
  // ---------- Santa, for Ava ----------
  const { s, house } = family(DAY);
  let { page, ctx } = await open(DAY, '12:00', { state: s, house });
  await openKid(page, 'kid_ava');
  assert.equal(await page.locator('.village').count(), 0, 'the day starts in the buddy\'s house');
  const before = await coins(page, 'kid_ava');
  await goOutside(page);
  await page.waitForSelector('.village[data-santa="flying"]');
  await page.clock.runFor(4500);
  await shot(page, '1-santa-flying');
  await page.clock.runFor(8000);
  assert.equal(await page.locator('.village').getAttribute('data-santa'), 'done');
  assert.equal(await page.locator('.village .v-present').count(), 1, 'the present lands by the door');
  let ava = await kidState(page, 'kid_ava');
  const rec = ava.xmas?.santa?.[DAY];
  assert.ok(rec && ['gems', 'coins', 'plays'].includes(rec.prize), 'the present is in the synced kid state');
  assert.ok(!rec.opened);
  await shot(page, '2-present-by-door');
  assert.equal(await page.locator('.village .v-mailbox').count(), 0, 'no mailbox before the first letter');

  // a reload (or another device): no second flight, the present still waits by the door
  await page.reload();
  await openKid(page, 'kid_ava');
  await page.waitForSelector('.village');
  await page.clock.runFor(2000);
  assert.notEqual(await page.locator('.village').getAttribute('data-santa'), 'flying', 'Santa flies once a day');
  assert.equal(await page.locator('.village .v-present').count(), 1, 'the unopened present stays by the door');
  ava = await kidState(page, 'kid_ava');
  assert.equal(Object.keys(ava.xmas.santa).length, 1);

  // open it: the prize and the 11 December letter (Czech Republic)
  await page.locator('.village .v-present').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-pop[data-present]');
  assert.match(await page.textContent('#modal .xm-pop'), /A present from Santa!/);
  assert.match(await page.textContent('#modal .v-letter-text'), /carp/);
  await page.clock.runFor(600);
  await shot(page, '3-present-open');
  ava = await kidState(page, 'kid_ava');
  assert.equal(ava.xmas.santa[DAY].opened, DAY);
  const after = await coins(page, 'kid_ava');
  const prize = ava.xmas.santa[DAY].prize;
  if (prize === 'coins') assert.equal(after.coins - before.coins, 10);
  if (prize === 'gems') assert.equal(after.gems - before.gems, 3);
  if (prize === 'plays') {
    const extra = await page.evaluate(async () => { const { xmasGames } = await import('./js/advent.js'); const { state } = await import('./js/ctx.js'); return xmasGames(state.kids[0], '2026-12-11'); });
    assert.equal(extra, 2);
  }
  await page.click('#modal [data-action="modal-close"]');
  await page.clock.runFor(500);
  assert.equal(await page.locator('.village .v-present').count(), 0);
  // the letter is kept: the mailbox by the door opens the letters book
  await page.waitForSelector('.village .v-mailbox');
  assert.equal(await page.locator('.village .v-mailbox.painted').count(), 1, 'on the meadow, the painted mailbox by the door is Santa\'s');
  await page.locator('.village .v-mailbox').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-letters');
  assert.match(await page.textContent('#modal .xm-letters'), /11 December · Czech Republic/);
  await shot(page, '4-letters-book');
  await page.click('#modal [data-action="modal-close"]');

  // ---------- the advent house ----------
  await page.locator('.village .v-advent').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-advent');
  assert.match(await page.textContent('#modal .xm-line'), /Tap a door/);
  await shot(page, '5-advent-wall');
  await tapDoor(page, 18);
  assert.match(await page.textContent('#modal .xm-line'), /Door 18 opens on 18 December/);
  await tapDoor(page, 11);
  await page.waitForSelector('#modal .xm-door-prize');
  assert.match(await page.textContent('#modal .xm-door-prize'), /Door 11:/);
  await shot(page, '6-door-open');
  await tapDoor(page, 3); // a missed day's door
  assert.match(await page.textContent('#modal .xm-door-prize'), /Door 3:/);
  await tapDoor(page, 5); // a third door today
  assert.match(await page.textContent('#modal .xm-line'), /2 doors today/);
  await tapDoor(page, 11); // an open door says what it gave
  assert.match(await page.textContent('#modal .xm-line'), /Door 11:/);
  ava = await kidState(page, 'kid_ava');
  assert.deepEqual(Object.keys(ava.xmas.doors).sort(), ['2026-11', '2026-3']);
  assert.equal(ava.xmas.doors['2026-11'].on, DAY);
  // the same prizes on any device: the roll is seeded by kid and door
  const again = await page.evaluate(async () => {
    const { rollDoor } = await import('./js/advent.js');
    return rollDoor({ kidId: 'kid_ava', year: '2026', n: 3, found: [], owned: [] }).kind;
  });
  assert.equal(typeof again, 'string');
  await page.click('#modal [data-action="modal-close"]');
  await ctx.close();

  // ---------- Ben: chores waiting for a parent ----------
  ({ page, ctx } = await open(DAY, '12:00', { state: s, house }));
  await openKid(page, 'kid_ben');
  await goOutside(page);
  await page.locator('.village .v-advent').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-advent');
  assert.match(await page.textContent('#modal .xm-line'), /Waiting for a grown-up/);
  await tapDoor(page, 11);
  assert.match(await page.textContent('#modal .xm-line'), /Waiting for a grown-up/);
  const ben = await kidState(page, 'kid_ben');
  assert.ok(!ben.xmas?.doors, 'no door opens before a parent approves');
  await shot(page, '7-waiting');
  await ctx.close();

  // ---------- Mia, Little games ----------
  ({ page, ctx } = await open(DAY, '12:00', { state: s, house }));
  await openKid(page, 'kid_mia');
  await goOutside(page);
  await page.waitForSelector('.village[data-santa="flying"]');
  await page.clock.runFor(12500);
  await page.locator('.village .v-present').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-little[data-present]');
  assert.equal(await page.locator('#modal .v-letter').count(), 0, 'no letter for the little one');
  await page.clock.runFor(500);
  await shot(page, '8-little-present');
  let mia = await kidState(page, 'kid_mia');
  assert.ok(['sticker', 'shower'].includes(mia.xmas.santa[DAY].prize));
  if (mia.xmas.santa[DAY].prize === 'sticker') assert.ok(Object.keys(mia.little.stickers).length === 1);
  await page.click('#modal [data-action="modal-close"]');
  await page.clock.runFor(400);
  assert.equal(await page.locator('.village .v-mailbox').count(), 0, 'no letters book for the little one');
  await page.locator('.village .v-advent').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-advent.xm-little');
  const stickers = Object.keys(mia.little.stickers || {}).length;
  await tapDoor(page, 11);
  await page.waitForSelector('#modal .xm-sticker');
  mia = await kidState(page, 'kid_mia');
  assert.equal(mia.xmas.doors['2026-11'].kind, 'sticker');
  assert.equal(Object.keys(mia.little.stickers).length, stickers + 1, 'her door gives a sticker for her book');
  await page.clock.runFor(500);
  await shot(page, '9-little-wall');
  await ctx.close();

  // ---------- a parent's phone looking at Ava's village: no flight, no prize, no doors ----------
  ({ page, ctx } = await open(DAY, '12:00', { state: s, house, parent: true }));
  await page.waitForSelector('[data-action="open-kid"][data-id="kid_ava"]');
  await openKid(page, 'kid_ava');
  await goOutside(page);
  await page.clock.runFor(3000);
  assert.notEqual(await page.locator('.village').getAttribute('data-santa'), 'flying', 'Santa doesn\'t fly on a parent\'s phone');
  await page.clock.runFor(10000);
  assert.ok(!(await kidState(page, 'kid_ava')).xmas?.santa, 'no prize rolled on a parent\'s phone');
  await page.locator('.village .v-advent').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-advent');
  await tapDoor(page, 11);
  assert.match(await page.textContent('#modal .xm-line'), /Ava opens the doors on Ava's own device/);
  assert.ok(!(await kidState(page, 'kid_ava')).xmas?.doors);
  await ctx.close();

  // ---------- Christmas Day: door 25 needs no chores, and the kid picks a star ----------
  const xmasDay = '2026-12-25';
  const c = family(xmasDay);
  // Ben's earlier doors show what they gave (an ornament from another map, a golden door, a scarf color...)
  c.s.kids[1].xmas = { found: ['orn-puffin', 'orn-owl'], doors: {
    '2026-1': { kind: 'coins', coins: 35, on: '2026-12-01' }, '2026-2': { kind: 'ornament', id: 'orn-puffin', on: '2026-12-02' },
    '2026-3': { kind: 'gem', gems: 3, on: '2026-12-03' }, '2026-4': { kind: 'game', games: 1, on: '2026-12-04' },
    '2026-5': { kind: 'golden', id: 'orn-owl', on: '2026-12-05' }, '2026-6': { kind: 'outfit', item: 'neck-knitscarf-blue', color: 'blue', on: '2026-12-06' },
    '2026-7': { kind: 'golden', item: 'hat-santa', on: '2026-12-07' },
  } };
  ({ page, ctx } = await open(xmasDay, '12:00', { state: c.s, house: c.house }));
  await openKid(page, 'kid_ben');
  await goOutside(page);
  await page.clock.runFor(12500);
  await page.locator('.village .v-advent').evaluate((el) => el.click());
  await page.waitForSelector('#modal .xm-advent');
  assert.match(await page.textContent('#modal .xm-line'), /Waiting for a grown-up. Door 25 needs no chores!/);
  // door 7's golden door gave a Santa hat: it is drawn in its niche (not the stand-in bauble)
  await tapDoor(page, 7);
  assert.match(await page.textContent('#modal .xm-line'), /Door 7: A golden door: Santa hat!/);
  await shot(page, '10-christmas-wall');
  const benCoins = (await coins(page, 'kid_ben')).coins;
  await tapDoor(page, 25);
  await page.waitForSelector('#modal .xm-stars');
  await shot(page, '11-pick-a-star');
  await page.click('#modal .xm-stars [data-star="star-castle"]');
  await page.waitForSelector('#modal .xm-door-prize');
  assert.match(await page.textContent('#modal .xm-door-prize'), /Crown star and 100 coins/);
  await shot(page, '12-star-door');
  const benAfter = await kidState(page, 'kid_ben');
  assert.ok(benAfter.xmas.found.includes('star-castle'));
  assert.equal(benAfter.xmas.star, 'star-castle');
  assert.equal(benAfter.xmas.doors['2026-25'].kind, 'star');
  assert.equal((await page.evaluate(async () => { const { state } = await import('./js/ctx.js'); const { totalCoins } = await import('./js/logic.js'); return totalCoins(state, state.kids[1], '2026-12-25'); })) - benCoins, 100);
  await ctx.close();

  // ---------- outside December: no decorations, no Santa; the night still comes ----------
  for (const day of ['2026-11-20', '2027-01-02']) {
    for (const [time, night] of [['12:00', false], ['18:30', true]]) {
      const fam = family(day, { inside: false });
      ({ page, ctx } = await open(day, time, { state: fam.s, house: fam.house }));
      await openKid(page, 'kid_ava');
      await page.waitForSelector('.village');
      await page.clock.runFor(2000);
      for (const sel of ['.v-advent', '.v-xtree', '.v-xlantern', '.v-santa', '.v-present', '.v-mailbox']) assert.equal(await page.locator(`.village ${sel}`).count(), 0, `${day} ${time}: no ${sel}`);
      assert.equal(await page.locator('.village.night').count(), night ? 1 : 0, `${day} ${time}: night ${night}`);
      const k = await kidState(page, 'kid_ava');
      assert.ok(!k.xmas?.santa, `${day}: no present`);
      if (night) await shot(page, `13-night-${day}`);
      await ctx.close();
    }
  }
  // the night comes to every map, all year
  const { VILLAGE_THEMES, villageLayout } = await import('../../js/villagemaps.js');
  for (const theme of VILLAGE_THEMES) {
    const fam = family('2027-01-02', { inside: false });
    fam.s.kids[0].buddy.outfit.background = theme;
    ({ page, ctx } = await open('2027-01-02', '18:30', { state: fam.s, house: fam.house }));
    await openKid(page, 'kid_ava');
    await page.waitForSelector('.village');
    assert.equal(await page.locator(`.village.theme-${theme}.night`).count(), 1, `${theme}: night`);
    assert.equal(await page.locator('.village .v-advent').count(), 0, `${theme}: no advent house in January`);
    await ctx.close();
  }
  // the present lands clear of the garden sign on every map (rainbow, space and volcano: left of the door)
  const { presentSpot } = await import('../../js/santaart.js');
  for (const theme of VILLAGE_THEMES) {
    const fam = family(DAY, { inside: false });
    fam.s.kids[0].buddy.outfit.background = theme;
    fam.s.kids[0].xmas = { santa: { [DAY]: { prize: 'coins' }, '2026-12-10': { prize: 'gems', opened: '2026-12-10' } } };
    ({ page, ctx } = await open(DAY, '12:00', { state: fam.s, house: fam.house }));
    await openKid(page, 'kid_ava');
    await page.waitForSelector('.village .v-present');
    const g = await page.evaluate(() => { const el = document.querySelector('.village .v-garden'); return el && { x: parseFloat(el.style.left), y: parseFloat(el.style.top), w: el.offsetWidth, h: el.offsetHeight }; });
    const at = presentSpot(villageLayout(theme));
    if (g) assert.ok(at.x + 8 < g.x || at.x - 8 > g.x + g.w || at.y < g.y || at.y - 16 > g.y + g.h, `${theme}: the present covers the garden sign`);
    const mb = await page.evaluate(() => { const el = document.querySelector('.village .v-mailbox'); return { x: parseFloat(el.style.left), w: el.offsetWidth }; });
    assert.ok(mb.x + mb.w < at.x - 6 || mb.x > at.x + 6, `${theme}: the mailbox and the present apart`);
    if (shots) { await page.locator('.village .v-present').scrollIntoViewIfNeeded(); const b = await page.locator('.village .v-present').boundingBox(); await page.screenshot({ path: `${shots}/14-present-${theme}.png`, clip: { x: Math.max(0, b.x - 120), y: Math.max(0, b.y - 100), width: 280, height: 190 } }); }
    await ctx.close();
  }
  // and on a December evening, the night and the decorations together
  ({ page, ctx } = await open(DAY, '18:30', { state: s, house: family(DAY, { inside: false }).house }));
  await openKid(page, 'kid_ava');
  await page.waitForSelector('.village.night .v-advent');
  await ctx.close();

  // (the parent's phone can't reach the made-up family's cloud here)
  assert.deepEqual(errors.filter((e) => !/firebase|Failed to fetch|ERR_FAILED|dynamically imported/i.test(e)), []);
  console.log('xmas-village: ok');
} finally {
  await browser.close();
  site.close();
}
