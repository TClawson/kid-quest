// Browser test: buddy specials. Each buddy sees only its own special in the shop,
// buys it for 1000 coins, and other buddies never see or wear it.
// Run: npm run test:smoke. With SHOTS_DIR set, it also saves preview screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, fallbackHash } from '../../js/logic.js';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
try {
  for (const [label, viewport] of [['tablet', { width: 900, height: 1200 }], ['phone', { width: 390, height: 844 }]]) {
    const page = await browser.newPage({ viewport });
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

    const saved = emptyState();
    saved.settings.pinHash = fallbackHash('kidquest:1234');
    saved.settings.questView = 'list';
    // -1200 spent = 1200 coins to spend
    saved.kids.push({
      id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: dateKey(), seenUnlocks: [],
      owned: [], spent: -1200, buddy: { species: 'panda', outfit: { background: 'bg-meadow' } },
    });
    saved.log[dateKey()] = { kid_ava: { tasks: {}, excused: true } }; // the store opens once the day's chores are done
    await page.goto(site.url);
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();
    await page.click('[data-action="open-kid"]');
    await page.click('[data-action="wardrobe"]');
    await page.click('[data-action="wardrobe-slot"][data-slot="neck"]');

    const bamboo = '[data-action="wardrobe-item"][data-id="neck-bamboo"]';
    const first = await page.getAttribute('.items .item >> nth=0', 'data-id');
    assert.equal(first, 'neck-bamboo', 'the special is first in its tab');
    assert.match(await page.textContent(bamboo), /Panda only/);
    assert.match(await page.textContent(bamboo), /🪙 1000/);
    for (const other of ['neck-yarn', 'neck-jersey', 'neck-bone']) assert.equal(await page.$(`[data-id="${other}"]`), null, `no ${other} for a panda`);
    if (shots) await page.screenshot({ path: `${shots}/specials-panda-shop-${label}.png` });

    await page.click(bamboo);
    assert.match(await page.textContent('#modal'), /Buy Bamboo stick for your panda\?/);
    if (shots) { await page.waitForTimeout(500); await page.screenshot({ path: `${shots}/specials-buy-${label}.png` }); }
    await page.click('[data-action="buy-confirm"]');
    assert.match(await page.textContent(bamboo), /Wearing/);
    let s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
    assert.deepEqual(s.buddyOwned, { panda: ['neck-bamboo'] });
    assert.equal(s.spent, -200);
    await page.waitForTimeout(1800);

    // Each other buddy sees only its own special, in its own tab.
    const tabs = { fox: ['hat', 'hat-coonskin'], bear: ['hat', 'hat-beehive'], cat: ['neck', 'neck-yarn'], dino: ['neck', 'neck-jersey'], puppy: ['neck', 'neck-bone'], turtle: ['face', 'face-ninja'] };
    for (const [species, [slot, id]] of Object.entries(tabs)) {
      await page.click(`[data-action="wardrobe-species"][data-val="${species}"]`);
      await page.click(`[data-action="wardrobe-slot"][data-slot="${slot}"]`);
      assert.equal(await page.getAttribute('.items .item >> nth=0', 'data-id'), id);
      assert.equal(await page.$('[data-id="neck-bamboo"]'), null, `the ${species} never sees the bamboo`);
      if (shots && label === 'tablet' && species === 'turtle') await page.screenshot({ path: `${shots}/specials-turtle-shop-tablet.png` });
    }
    s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
    assert.equal(s.buddy.outfit.neck, undefined, 'the turtle wears no bamboo');

    // Back to the panda: the bamboo goes back on.
    await page.click('[data-action="wardrobe-species"][data-val="panda"]');
    s = await page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
    assert.equal(s.buddy.outfit.neck, 'neck-bamboo');
    assert.deepEqual(errors, []);
    await page.close();
  }
  console.log('buddy specials test passed');
} finally {
  await browser.close();
  site.close();
}
