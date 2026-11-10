// Browser test: no screen is wider than a phone. Visits every screen at phone and
// tablet widths and fails if anything pokes out past the right edge.
// Run: node test/smoke/layout.mjs  (SHOTS=dir also saves a screenshot of each screen)
import assert from 'node:assert/strict';
import { mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash } from '../../js/logic.js';
import { seenSaturday } from '../helpers/seed.mjs';

const shots = process.env.SHOTS;
if (shots) mkdirSync(shots, { recursive: true });
const SIZES = [
  { name: 'phone-360', width: 360, height: 780 },
  { name: 'phone-412', width: 412, height: 915 },
  { name: 'tablet', width: 800, height: 1280 },
];

const today = dateKey();
function seed() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  const ava = defaultTasks();
  ava.push({ id: 'task_bath', name: 'Clean the bathroom with a really long chore name', icon: '🛁', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 });
  s.kids.push({ id: 'kid_ava', name: 'Annabelle', color: '#ff6b6b', tasks: ava, startDate: today, owned: [], spent: -2400, buddy: { species: 'fox', outfit: {} } });
  s.kids.push({ id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: defaultTasks(), startDate: today, owned: [], spent: -2400, buddy: { species: 'panda', outfit: {} } });
  s.log[today] = { kid_ava: { tasks: { task_bath: { status: 'pending', at: Date.now() } } } };
  s.log[today].kid_ben = { tasks: {}, excused: true }; // the buddy store opens once the day's chores are done
  return s;
}

// Everything whose right edge is past the screen, skipping things inside a sideways
// scroller (those are meant to scroll) and things the page clips anyway.
function overflowing() {
  const w = document.documentElement.clientWidth;
  const out = [];
  const clipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ox = getComputedStyle(p).overflowX;
      if (ox !== 'visible') {
        const r = p.getBoundingClientRect();
        if (r.right <= w + 1) return true;
      }
    }
    return false;
  };
  for (const el of document.querySelectorAll('body *')) {
    const r = el.getBoundingClientRect();
    if (!r.width || r.right <= w + 1) continue;
    if (getComputedStyle(el).position === 'fixed' && r.left >= w) continue;
    if (clipped(el)) continue;
    const name = el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).join('.') : '');
    out.push(`${name} (${Math.round(r.right - w)}px past)`);
  }
  return { scroll: document.documentElement.scrollWidth - w, out: out.slice(0, 12) };
}

const site = await serve('.');
const browser = await chromium.launch();
const problems = [];
try {
  for (const size of SIZES) {
    const ctx = await browser.newContext({ viewport: { width: size.width, height: size.height }, deviceScaleFactor: 2, hasTouch: size.width < 600, isMobile: size.width < 600 });
    const page = await ctx.newPage();
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), seenSaturday(seed()));
    await page.reload();
    // Android's "text size" setting makes every font bigger; FONT_SCALE=1.3 tries that
    if (process.env.FONT_SCALE) await page.addStyleTag({ content: `html { font-size: ${process.env.FONT_SCALE * 100}%; }` });
    await page.waitForSelector('[data-action="open-kid"]');

    const check = async (label) => {
      await page.waitForTimeout(250);
      const r = await page.evaluate(overflowing);
      if (r.scroll > 0 || r.out.length) problems.push(`${size.name} ${label}: page ${r.scroll}px too wide; ${r.out.join(', ')}`);
      if (shots) await page.screenshot({ path: `${shots}/${size.name}-${label}.png`, fullPage: true });
    };
    const go = async (sel) => { await page.click(sel); };

    await check('home');
    await go('[data-action="open-kid"][data-id="kid_ava"]');
    await page.waitForSelector('.quest-map');
    await check('kid-map');
    await go('[data-action="quest-mode"][data-mode="village"]');
    await page.waitForSelector('.village .villager');
    await check('kid-village');
    // the piano's villager: walk over, then start the timer from what they say
    // (weekdays only: the default piano task has no Saturday or Sunday). The piano's villager
    // can be off screen, where a real click can't reach it, so the tap is sent to it directly.
    const piano = await page.$('.villager[aria-label*="Piano"]');
    if (piano) {
      await piano.dispatchEvent('click');
      await page.waitForSelector('.v-dialog:not([hidden]) [data-v="do"]', { timeout: 15000 });
      await check('kid-village-talk');
      await page.click('.v-dialog [data-v="do"]');
      await page.waitForSelector('.timer');
      await check('timer');
      await go('[data-action="timer-back"]');
    }
    await go('[data-action="quest-mode"][data-mode="map"]');
    await go('[data-action="home"]');
    // Annabelle still has chores, so her buddy store is locked; Ben's day is excused, so his is open
    await go('[data-action="open-kid"][data-id="kid_ben"]');
    await go('[data-action="wardrobe"]');
    for (const slot of ['background', 'hat', 'face', 'neck', 'music', 'sport']) {
      await go(`[data-action="wardrobe-slot"][data-slot="${slot}"]`);
      await check(`wardrobe-${slot}`);
      if (slot === 'hat') {
        await go('.item.shop:has(.price.can)');
        await page.waitForSelector('#modal:not([hidden])');
        await check('buy-modal');
        await go('#modal [data-action="modal-close"]');
      }
    }
    await go('[data-action="wardrobe-back"]');
    await go('[data-action="home"]');
    await go('[data-action="parent"]');
    await check('pin-pad');
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    await page.waitForSelector('.parent');
    for (const tab of ['approvals', 'kids', 'history', 'settings']) {
      if (!(await page.$(`[data-action="tab"][data-tab="${tab}"]`))) continue;
      await go(`[data-action="tab"][data-tab="${tab}"]`);
      await check(`parent-${tab}`);
    }
    await go('[data-action="tab"][data-tab="kids"]');
    await go('[data-action="bonus"][data-kid="kid_ava"]');
    await page.waitForSelector('#modal:not([hidden])');
    await check('bonus-modal');
    await go('#modal [data-action="modal-close"]');
    await go('[data-action="edit-kid"][data-id="kid_ava"]');
    await check('parent-edit-kid');
    assert.deepEqual(errors, [], `no page errors at ${size.name}`);
    await ctx.close();
  }
} finally {
  await browser.close();
  site.close();
}
if (problems.length) console.log(problems.join('\n'));
assert.equal(problems.length, 0, 'nothing overflows the screen');
console.log('layout test passed');
