// Real seasons on the maps (js/seasonlife.js, js/seasonfx.js): the village in every season,
// with the weather overlay, via the parent's try-out (localStorage kidquest.season), and the
// try-out buttons in Settings. Takes pictures.
// Run: node test/smoke/seasons.mjs <outDir>
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { VILLAGE_START } from '../../js/familygarden.js';
import { openKid, openParents } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, what) => { if (!ok) { failed += 1; console.log('FAIL', what); } else console.log('ok  ', what); };

const today = addDays(VILLAGE_START, 120);
function family(theme) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const names = [['kid_ava', 'Ava', '#ff6b6b', 'fox'], ['kid_ben', 'Ben', '#4dabf7', 'bunny']];
  for (const [id, name, color, species] of names) {
    const daily = {};
    for (let key = VILLAGE_START; key < today; key = addDays(key, 1)) daily[key] = [5, 5];
    s.kids.push({ id, name, color, tasks: defaultTasks(), startDate: addDays(VILLAGE_START, -30), seenUnlocks: [], seenMoves: [], spent: 0, daily, buddy: { species, outfit: { background: theme } } });
  }
  return s;
}

const CASES = [
  ...['spring', 'summer', 'autumn', 'winter'].map((season) => ({ theme: 'bg-meadow', season })),
  ...['bg-ocean', 'bg-volcano', 'bg-galaxy'].map((theme) => ({ theme, season: 'winter' })),
];
const SIZES = { tablet: { width: 1280, height: 800 }, phone: { width: 412, height: 915 } };

const site = await serve('.');
const browser = await chromium.launch();

async function open(c, viewport) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.addInitScript((season) => { try { localStorage.setItem('kidquest.season', season); } catch { /* none */ } }, c.season);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failed += 1; console.log('ERR', c.theme, c.season, e.message); });
  await page.clock.install({ time: new Date(`${today}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(c.theme));
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1000);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(3000);
  return { ctx, page };
}

const alpha = `(cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n += 1; return n; }`;

for (const c of CASES) {
  const label = `${c.theme.replace('bg-', '')}-${c.season}`;
  for (const [sizeName, viewport] of Object.entries(SIZES)) {
    const { ctx, page } = await open(c, viewport);
    const info = await page.evaluate(`(() => {
      const alpha = ${alpha};
      const w = document.querySelector('.village .season-weather');
      return { has: Boolean(w), kind: w?.dataset.kind || '', drawn: w ? alpha(w) : 0, frames: Number(w?.dataset.frames || 0), pe: w ? getComputedStyle(w).pointerEvents : '' };
    })()`);
    await page.clock.runFor(2000);
    const after = await page.evaluate(() => Number(document.querySelector('.village .season-weather')?.dataset.frames || 0));
    console.log(label, sizeName, JSON.stringify(info), 'frames after', after);
    
    if (info.has) {
      check(info.drawn > 0, `${label} ${sizeName}: weather is drawn`);
      check(after > info.frames, `${label} ${sizeName}: weather animates`);
      check(info.pe === 'none', `${label} ${sizeName}: weather lets taps through`);
    }
    if (c.season !== 'summer' && c.theme === 'bg-meadow') check(info.has, `${label} ${sizeName}: this season has weather`);
    await page.screenshot({ path: `${out}/${label}-${sizeName}.png`, fullPage: false });
    await ctx.close();
  }
}

// Settings > Try a season
for (const [sizeName, viewport] of Object.entries(SIZES)) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failed += 1; console.log('ERR settings', e.message); });
  await page.clock.install({ time: new Date(`${today}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family('bg-meadow'));
  await page.reload();
  await openParents(page);
  for (const d of '1234') await page.click(`[data-pin="${d}"]`);
  await page.click('[data-action="tab"][data-tab="settings"]');
if (await page.locator('[data-action="test-tools"][aria-expanded="false"]').count()) await page.click('[data-action="test-tools"]'); // open Settings › Test tools
  const card = page.locator('.season-test');
  await card.scrollIntoViewIfNeeded();
  check(await card.count() === 1, `settings ${sizeName}: Try a season card`);
  await card.locator('[data-season="winter"]').click();
  check(await page.evaluate(() => localStorage.getItem('kidquest.season')) === 'winter', `settings ${sizeName}: Winter is remembered on this device`);
  check(await page.locator('.season-test [data-season="winter"][aria-pressed="true"]').count() === 1, `settings ${sizeName}: Winter shows as picked`);
  await page.locator('.season-test').scrollIntoViewIfNeeded();
  await page.locator('.season-test').screenshot({ path: `${out}/settings-try-a-season-${sizeName}.png` });
  await page.locator('.season-test [data-season="real"]').click();
  check(await page.evaluate(() => localStorage.getItem('kidquest.season')) === null, `settings ${sizeName}: Real goes back to the calendar`);
  await ctx.close();
}

// the backyard garden through the try-out: winter and autumn, and an ocean dome in winter
const GOUT = '/mnt/project-files/kid-quest-previews/seasons/app/';
fs.mkdirSync(GOUT, { recursive: true });
const GCASES = [{ theme: 'bg-meadow', season: 'winter' }, { theme: 'bg-meadow', season: 'autumn' }, { theme: 'bg-ocean', season: 'winter' }];
for (const c of GCASES) {
  const label = `garden-${c.theme === 'bg-meadow' ? '' : 'ocean-'}${c.season}`.replace('--', '-');
  for (const [sizeName, viewport] of Object.entries(SIZES)) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
    await ctx.addInitScript((season) => { try { localStorage.setItem('kidquest.season', season); } catch { /* none */ } }, c.season);
    const page = await ctx.newPage();
    page.on('pageerror', (e) => { failed += 1; console.log('ERR', label, e.message); });
    await page.clock.install({ time: new Date(`${today}T07:30:00`) });
    await page.goto(site.url);
    const st = family(c.theme);
    const [t0, t1, t2] = st.kids[0].tasks = defaultTasks();
    const plot = (n, seed, task, ago) => ({ id: `p${n}`, seed, task: task.id, planted: addDays(today, -ago) });
    st.kids[0].owned = ['garden-birdbath', 'garden-beehouse', 'garden-bench'];
    st.kids[0].gardenDecor = { water: 'garden-birdbath', bees: 'garden-beehouse', seat: 'garden-bench' };
    st.kids[0].garden = { beds: [plot(1, 'seed-sunflower', t1, 10), plot(2, 'seed-tulip', t0, 4), plot(3, 'seed-carrot', t2, 9), plot(4, 'seed-tomato', t0, 12), null, plot(5, 'seed-daisy', t1, 9)], trees: [plot(6, 'seed-apple', t0, 70), null], kept: [], seeds: {}, n: 6 };
    st.log = {};
    for (let i = 1; i <= 75; i += 1) st.log[addDays(today, -i)] = { kid_ava: { tasks: Object.fromEntries([t0, t1].map((t) => [t.id, { status: 'done', by: 'self' }])) } };
    await page.evaluate(([s, d]) => {
      localStorage.setItem('kidquest.v1', JSON.stringify(s));
      localStorage.setItem('kidquest.house', JSON.stringify({ kid_ava: { day: d, inside: false, place: 'garden' } }));
    }, [st, today]);
    await page.reload();
    await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
    await page.clock.runFor(1500);
    while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
    await page.clock.runFor(3000);
    const info = await page.evaluate(`(() => {
      const alpha = ${alpha};
      const w = document.querySelector('.village-world .season-weather');
      return { garden: Boolean(document.querySelector('.garden-yard')), has: Boolean(w), kind: w?.dataset.kind || '', drawn: w ? alpha(w) : 0, frames: Number(w?.dataset.frames || 0), pe: w ? getComputedStyle(w).pointerEvents : '' };
    })()`);
    // sparkles twinkle, so look over a second or so
    for (let k = 0; k < 6 && !info.drawn; k += 1) {
      await page.clock.runFor(200);
      info.drawn = await page.evaluate(`(() => { const w = document.querySelector('.village-world .season-weather'); return w ? (${alpha})(w) : 0; })()`);
    }
    console.log(label, sizeName, JSON.stringify(info));
    check(info.garden, `${label} ${sizeName}: the garden is open`);
    check(info.has && info.drawn > 0, `${label} ${sizeName}: the garden has weather`);
    check(info.pe === 'none', `${label} ${sizeName}: garden weather lets taps through`);
    const critters = await page.locator('.g-critter').count();
    check(critters >= 1, `${label} ${sizeName}: the garden has visitors (${critters})`);
    if (c.theme === 'bg-ocean') check(info.kind === 'sparkle', `${label} ${sizeName}: the dome gets the dome weather`);
    await page.locator('.garden-yard').scrollIntoViewIfNeeded();
    await page.clock.runFor(500);
    await page.locator('.village-view').screenshot({ path: `${GOUT}${label}-${sizeName}.png`, fullPage: false });
    await ctx.close();
  }
}


await browser.close(); site.close();
console.log(failed ? `${failed} problem(s)` : 'seasons: all ok');
process.exit(failed ? 1 : 0);
