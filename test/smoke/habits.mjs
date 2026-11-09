// Browser test: habit levels, the weekly look-back, the kid's plan with cues,
// the welcome-back bonus and the family party on the map.
// Run: npm run test:smoke   (SHOTS_DIR=... saves screenshots and a party video)
import assert from 'node:assert/strict';
import { mkdirSync, readdirSync, renameSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { ITEMS } from '../../js/items.js';
import { emptyState, defaultTasks, dateKey, addDays, fallbackHash, tasksForDay, questTasks, weekStart } from '../../js/logic.js';
import { seenSaturday } from '../helpers/seed.mjs';

const shots = process.env.SHOTS_DIR;
if (shots) mkdirSync(shots, { recursive: true });
const site = await serve('.');
const browser = await chromium.launch();
const today = dateKey();

/** A family of two (avaToday/benToday: tasks done today; -1 means all but one). Ava has 10 weeks of history: teeth every day, her bed more and more often, and yesterday missed. */
function family({ avaToday = 0, benToday = 0 } = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  const start = addDays(today, -70);
  s.settings.allowance = { on: true, coins: 300, xp: 300, bonus: 50, since: start, startFixed: true };
  const seen = ITEMS.map((x) => x.id);
  const ava = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: start, owned: [], spent: 0, seenUnlocks: seen, buddy: { species: 'fox', outfit: { background: 'bg-ocean' } } };
  const ben = { id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: defaultTasks(), startDate: start, owned: [], spent: 0, seenUnlocks: seen, buddy: { species: 'panda', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava, ben);
  const bed = ava.tasks.find((t) => t.name === 'Make bed');
  let i = 0;
  for (let key = start; key < today; key = addDays(key, 1)) {
    i += 1;
    for (const kid of [ava, ben]) {
      s.log[key] ||= {};
      const tasks = {};
      if (!(kid === ava && key === addDays(today, -1))) {
        for (const t of tasksForDay(s, kid, key, today)) {
          // Ava's bed: often skipped at first, every day for the last three weeks
          if (kid === ava && t.id === bed.id && key < addDays(today, -21) && i % 3 === 0) continue;
          tasks[t.id] = { status: 'done', by: 'kid' };
        }
      }
      s.log[key][kid.id] = { tasks, excused: false };
    }
  }
  s.log[today] = {};
  for (const [kid, n] of [[ava, avaToday], [ben, benToday]]) {
    const tasks = {};
    questTasks(tasksForDay(s, kid, today, today)).slice(0, n).forEach((t) => { tasks[t.id] = { status: t.verify === 'parent' ? 'pending' : 'done' }; });
    s.log[today][kid.id] = { tasks, excused: false };
  }
  return s;
}

async function open(page, s) {
  await page.goto(site.url);
  await page.evaluate((x) => localStorage.setItem('kidquest.v1', JSON.stringify(x)), seenSaturday(s));
  await page.reload();
}
const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
const shot = async (page, name, opts = {}) => { if (shots) await page.screenshot({ path: join(shots, name), ...opts }); };
/** The top of the quest map, where visitors stand. */
const mapTop = async (page, name) => {
  if (!shots) return;
  const box = await page.evaluate(() => { const r = document.querySelector('.quest-map').getBoundingClientRect(); return { x: r.left + scrollX, y: r.top + scrollY - 90, width: r.width, height: 560 }; });
  await page.screenshot({ path: join(shots, name), fullPage: true, clip: box });
};

try {
  for (const phone of [false, true]) {
    const ctx = await browser.newContext(phone
      ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }
      : { viewport: { width: 900, height: 1200 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text()); });
    const tag = phone ? 'phone' : 'tablet';

    await open(page, family({ benToday: 3 }));
    await page.click('[data-action="open-kid"][data-id="kid_ava"]');

    // 1. teeth became a mastered habit: a star, once
    await page.waitForSelector('.modal-card .celebrate h1');
    assert.equal(await page.textContent('.modal-card h1'), 'Habit mastered!');
    assert.match(await page.textContent('.modal-card'), /Brush teeth/);
    await page.waitForTimeout(600);
    await shot(page, `mastered-${tag}.png`);
    await page.click('.modal-card [data-action="modal-close"]');

    // 2. then last week, next to four weeks before
    await page.waitForSelector('.modal-card .lookback');
    const look = await page.textContent('.modal-card .lookback');
    // on a Monday, the missed yesterday was the last day of last week
    const bedLastWeek = weekStart(addDays(today, -1)) < weekStart(today) ? 6 : 7;
    assert.match(look, new RegExp(`Make bed\\s*${bedLastWeek} of 7`));
    assert.match(look, /4 weeks ago: [0-6] of 7/);
    await shot(page, `lookback-${tag}.png`);

    // 3. plan the week from there: move piano first and give it a cue
    await page.click('.modal-card [data-action="plan"]');
    await page.waitForSelector('.modal-card .plan');
    const s0 = await stored(page);
    const ava = s0.kids.find((k) => k.id === 'kid_ava');
    const piano = ava.tasks.find((t) => t.name === 'Piano practice');
    const chore = ava.tasks.find((t) => t.name === 'Chore of the week');
    const teeth = ava.tasks.find((t) => t.name === 'Brush teeth');
    await page.selectOption(`select[data-plancue="${piano.id}"]`, 'After snack');
    await page.selectOption(`select[data-plancue="${chore.id}"]`, 'Before screens');
    await page.selectOption(`select[data-plancue="${teeth.id}"]`, 'After breakfast');
    assert.match(await page.textContent('.modal-card .plan'), /After snack, I'll do piano practice\./);
    await page.waitForTimeout(400);
    await shot(page, `plan-${tag}.png`);
    await page.click('.modal-card [data-action="plan-save"]');
    const s1 = await stored(page);
    const plan = s1.kids.find((k) => k.id === 'kid_ava').plan;
    assert.equal(plan.cues[piano.id], 'After snack');
    assert.equal(s1.kids.find((k) => k.id === 'kid_ava').lookbackSeen > '', true);

    // the map shows the cues and the star, and the family's progress
    await page.waitForTimeout(400);
    const labels = await page.$$eval('.map-label', (els) => els.map((e) => e.textContent.replace(/\s+/g, ' ').trim()));
    // piano is a weekday task, so check the cue on brush teeth (every day), and on piano when it's on today's map
    assert.ok(labels.some((l) => l.includes('Brush teeth') && l.includes('After breakfast')), labels.join(' | '));
    if (labels.some((l) => l.includes('Piano practice'))) assert.ok(labels.some((l) => l.includes('Piano practice') && l.includes('After snack')), labels.join(' | '));
    assert.ok(labels.some((l) => l.includes('Brush teeth ⭐')), labels.join(' | '));
    assert.match(await page.textContent('.family-banner'), /Family: 3 of \d+ chores done/);
    await page.waitForTimeout(2600); // the toast goes away
    await page.locator('.family-banner').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -20));
    await shot(page, `map-cues-${tag}.png`);

    // habits section: teeth mastered, bed on its way
    const habits = await page.textContent('.habits');
    assert.match(habits, /Mastered habit/);
    assert.match(habits, /Make bed/);
    assert.match(await page.textContent('.month-line'), /This month: \d+ of \d+ days done/);
    await page.locator('.habits').scrollIntoViewIfNeeded();
    await shot(page, `habits-${tag}.png`);

    // 4. finish the day after missing yesterday: welcome back, with the bonus
    const coinsBefore = Number((await page.textContent('.chip.coin')).replace(/\D/g, ''));
    await page.evaluate(() => window.scrollTo(0, 0));
    const s2 = await stored(page);
    const a2 = s2.kids.find((k) => k.id === 'kid_ava');
    for (const t of tasksForDay(s2, a2, today, today)) s2.log[today].kid_ava.tasks[t.id] = { status: 'done', by: 'parent' };
    await open(page, s2);
    await page.click('[data-action="open-kid"][data-id="kid_ava"]');
    await page.waitForSelector('.modal-card .celebrate h1');
    assert.equal(await page.textContent('.modal-card h1'), 'Welcome back!');
    await page.waitForTimeout(600);
    await shot(page, `welcome-back-${tag}.png`);
    await page.click('.modal-card [data-action="modal-close"]');
    await page.waitForTimeout(300);
    const coinsAfter = Number((await page.textContent('.chip.coin')).replace(/\D/g, ''));
    assert.ok(coinsAfter >= coinsBefore + 15, `${coinsBefore} -> ${coinsAfter}`);

    // 5. the family party: Ben is done and Ava has one left (over 85%), so opening the map starts it
    // (weekends have fewer chores: when one left would drop below 85%, Ava finishes too)
    const probe = family();
    const n = (k) => questTasks(tasksForDay(probe, probe.kids[k], today, today)).length;
    const party = family({ avaToday: (n(0) - 1 + n(1)) / (n(0) + n(1)) >= 0.85 ? -1 : 99, benToday: 99 });
    party.kids[0].seenMastered = party.kids[0].tasks.map((t) => t.id);
    party.kids[0].lookbackSeen = s2.kids[0].lookbackSeen;
    await open(page, party);
    await page.click('[data-action="open-kid"][data-id="kid_ava"]');
    await page.waitForSelector('.quest-map.party');
    assert.match(await page.textContent('.family-banner'), /Family party/);
    await page.locator('.family-banner').scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy(0, -20));
    await page.waitForTimeout(900);
    await shot(page, `party-${tag}.png`);
    await page.waitForTimeout(5000);
    assert.equal(await page.$('.quest-map.party'), null, 'the party ends');

    // 6. milestone cheers: Ben's buddy visits Ava and mentions Ben's 10 weeks in a row
    const cheer = family({ benToday: 1 });
    for (const k of cheer.kids) { k.seenMastered = k.tasks.flatMap((t) => [t.id, `${t.id}#2`]); k.lookbackSeen = weekStart(today); }
    await open(page, cheer);
    await page.click('[data-action="open-kid"][data-id="kid_ava"]');
    await page.waitForSelector('.map-visitor.news .cheer-btn');
    assert.match(await page.textContent('.map-visitor.news .visitor-bubble'), /Just did 10 weeks in a row/);
    await page.waitForTimeout(500);
    await mapTop(page, `cheer-button-${tag}.png`);
    await page.click('.map-visitor.news .cheer-btn', { force: true }); // it pulses, so it is never "stable"
    await page.waitForTimeout(300);
    const s3 = await stored(page);
    const benCheers = s3.kids.find((k) => k.id === 'kid_ben').cheers;
    const [mid] = Object.keys(benCheers);
    assert.match(mid, /^streak-/);
    assert.equal(benCheers[mid].kid_ava.name, 'Ava');
    assert.match(await page.textContent('.map-visitor[data-id="kid_ben"] .visitor-bubble'), /Thanks for the cheer/);
    assert.equal(await page.$('.cheer-btn'), null);
    // Ben opens his map: Ava's buddy came to cheer
    await page.click('[data-action="home"]');
    await page.click('[data-action="open-kid"][data-id="kid_ben"]');
    await page.waitForSelector('.map-visitor.cheering[data-id="kid_ava"]');
    assert.match(await page.textContent('.map-visitor.cheering .visitor-bubble'), /10 weeks in a row! Came to cheer/);
    await page.waitForSelector('.toast:has-text("Ava came to cheer for you")');
    await page.waitForTimeout(700);
    await mapTop(page, `cheer-visit-${tag}.png`);

    assert.deepEqual(errors, []);
    await ctx.close();
  }

  // a short video of the party for the preview
  if (shots) {
    const dir = join(shots, 'video');
    const ctx = await browser.newContext({ viewport: { width: 600, height: 900 }, recordVideo: { dir, size: { width: 600, height: 900 } } });
    const page = await ctx.newPage();
    // (weekends have fewer chores: when one left would drop below 85%, Ava finishes too)
    const probe = family();
    const n = (k) => questTasks(tasksForDay(probe, probe.kids[k], today, today)).length;
    const party = family({ avaToday: (n(0) - 1 + n(1)) / (n(0) + n(1)) >= 0.85 ? -1 : 99, benToday: 99 });
    party.kids[0].seenMastered = party.kids[0].tasks.map((t) => t.id);
    party.kids[0].lookbackSeen = weekStart(today);
    await open(page, party);
    await page.waitForTimeout(800);
    await page.click('[data-action="open-kid"][data-id="kid_ava"]');
    await page.evaluate(() => { const b = document.querySelector('.family-banner'); window.scrollTo(0, b.getBoundingClientRect().top + window.scrollY - 10); });
    await page.waitForTimeout(6500);
    await ctx.close();
    const [file] = readdirSync(dir);
    renameSync(join(dir, file), join(shots, 'party.webm'));
  }
  console.log('habits smoke test passed');
} finally {
  await browser.close();
  site.close();
}
