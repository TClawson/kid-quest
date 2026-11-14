// Browser test: the wizard set. The Magic tab sells the wand, the shop shows it lit up,
// and on the kid screen the live buddy's wand glows brighter as today's chores get done.
// Run: npm run test:smoke. With SHOTS_DIR set, it also saves preview screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash, tasksForDay } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
const day = TEST_DAY;

function stateWith(done, outfit = { background: 'bg-meadow' }, buddyOwned = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'list';
  s.settings.music = false;
  const kid = {
    id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: day, seenUnlocks: [],
    owned: [], spent: -1500, buddyOwned, buddy: { species: 'bear', outfit },
  };
  s.kids.push(kid);
  const chores = tasksForDay(s, kid, day, day).filter((t) => t.period !== 'exercise');
  if (done === 'excused') s.log[day] = { kid_ava: { tasks: {}, excused: true } };
  else s.log[day] = { kid_ava: { tasks: Object.fromEntries(chores.slice(0, Math.round(chores.length * done)).map((t) => [t.id, { status: 'done', by: 'parent' }])), excused: false } };
  return s;
}

/** How much light is around the wand's tip on the kid screen's live buddy. */
async function tipLight(page) {
  await page.waitForTimeout(400);
  return page.evaluate(() => {
    const c = document.querySelector('.screen.kid canvas.live-buddy');
    const d = c.getContext('2d').getImageData(0, 4, 8, 12).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4) n += d[i] + d[i + 1] + d[i + 2];
    return n;
  });
}

try {
  for (const [label, viewport] of [['tablet', { width: 900, height: 1200 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport, deviceScaleFactor: shots ? 2 : 1 });
    await useTestDay(page); // the page's clock starts at noon on the test's day (see clock.mjs)
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    const load = async (s) => {
      await page.goto(site.url);
      await page.evaluate((st) => localStorage.setItem('kidquest.v1', JSON.stringify(st)), s);
      await page.reload();
      await openKid(page, '[data-action="open-kid"]');
      await page.waitForTimeout(500);
      await closePops(page); // a start-of-day pop-up (on a Saturday: the free games) would cover the buttons
    };

    // Buy the whole set
    await load(stateWith('excused'));
    await page.click('[data-action="wardrobe"]');
    await page.click('[data-action="wardrobe-slot"][data-slot="hand"]');
    const wand = '[data-action="wardrobe-item"][data-id="hand-wand"]';
    assert.match(await page.textContent(wand), /🪙 500/);
    assert.ok(await page.$(`${wand} .wand-full`), 'the shop shows the wand all lit up');
    if (shots) await page.screenshot({ path: `${shots}/1-magic-tab-${label}.png` });
    await page.click(wand);
    assert.match(await page.textContent('#modal'), /Buy Magic wand for your bear\?/);
    assert.match(await page.textContent('#modal'), /glows brighter with every chore/);
    if (shots) { await page.waitForTimeout(2900); await page.screenshot({ path: `${shots}/2-buy-wand-${label}.png` }); }
    await page.click('[data-action="buy-confirm"]');
    assert.match(await page.textContent(wand), /Wearing/);
    for (const [slot, id] of [['hat', 'hat-wizard-star'], ['face', 'face-beard'], ['neck', 'neck-robe']]) {
      await page.click(`[data-action="wardrobe-slot"][data-slot="${slot}"]`);
      await page.click(`[data-action="wardrobe-item"][data-id="${id}"]`);
      await page.click('[data-action="buy-confirm"]');
    }
    let s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
    assert.deepEqual(s.buddyOwned.bear.sort(), ['face-beard', 'hand-wand', 'hat-wizard-star', 'neck-robe']);
    assert.equal(s.buddy.outfit.hand, 'hand-wand');
    assert.equal(s.buddy.wand, undefined, 'the glow is never saved');
    if (shots && label === 'tablet') await page.screenshot({ path: `${shots}/3-full-set-${label}.png` });

    // A new buddy needs its own wand
    await page.click('[data-action="wardrobe-switch"]'); // the buddy picker opens on purpose
    await page.click('[data-action="wardrobe-species"][data-val="fox"]');
    s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
    assert.equal(s.buddy.outfit.hand, undefined);

    // The glow follows today's chores
    const outfit = { background: 'bg-meadow', hand: 'hand-wand', hat: 'hat-wizard-star', neck: 'neck-robe' };
    const owned = { bear: ['hand-wand', 'hat-wizard-star', 'neck-robe'] };
    const light = [];
    for (const [i, done] of [0, 0.5, 1].entries()) {
      await load(stateWith(done, outfit, owned));
      // a finished day opens a celebration first
      await page.waitForTimeout(1500);
      for (let n = 0; n < 4 && await page.isVisible('#modal [data-action="modal-close"]'); n += 1) { await page.click('#modal [data-action="modal-close"]'); await page.waitForTimeout(600); }
      light.push(await tipLight(page));
      if (shots && label === 'tablet') await page.locator('.screen.kid .buddy-tap').first().screenshot({ path: `${shots}/4-glow-${i}-${['none', 'half', 'all'][i]}-done.png` });
    }
    assert.ok(light[0] < light[1] && light[1] < light[2], `brighter with more done: ${light}`);
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('wizard test passed');
} finally {
  await browser.close();
  site.close();
}
