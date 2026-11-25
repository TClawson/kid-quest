// Browser test: the arctic fox, a buddy bought in the shop for 300 coins.
// Locked with its price in the buddy picker (and in the parent's kid editor),
// too dear with too few coins, bought once, then kept: switching away and back
// costs nothing. Its special, the ice crystal crown, shows only for it.
// Run: npm run test:smoke. With SHOTS_DIR set, it also saves preview screenshots.
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, fallbackHash } from '../../js/logic.js';
import { TEST_DAY, useTestDay } from '../helpers/clock.mjs';
import { openKid, closePops } from '../helpers/open-kid.mjs';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
const kidOf = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
try {
  for (const [label, viewport] of [['tablet', { width: 900, height: 1200 }], ['phone', { width: 390, height: 844 }]]) {
    for (const coins of [120, 1400]) {
      const page = await browser.newPage({ viewport });
      await useTestDay(page);
      const errors = [];
      page.on('pageerror', (e) => errors.push(e.message));
      page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
      const saved = emptyState();
      saved.settings.pinHash = fallbackHash('kidquest:1234');
      saved.settings.questView = 'list';
      saved.kids.push({
        id: 'kid_ava', name: 'Ava', color: '#4dabf7', tasks: defaultTasks(), startDate: TEST_DAY, seenUnlocks: [],
        owned: ['bg-fjord'], buddyOwned: { fox: ['hat-cap'] }, spent: -coins, buddy: { species: 'fox', outfit: { background: 'bg-fjord', hat: 'hat-cap' } },
      });
      saved.log[TEST_DAY] = { kid_ava: { tasks: {}, excused: true } }; // the store opens once the day's chores are done
      await page.goto(site.url);
      await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
      await page.reload();
      await openKid(page, '[data-action="open-kid"]');
      await page.waitForTimeout(500);
      await closePops(page);
      await page.click('[data-action="wardrobe"]');
      await page.click('[data-action="wardrobe-switch"]');
      const arctic = '[data-action="wardrobe-species"][data-val="arcticfox"]';
      assert.match(await page.textContent(arctic), /🪙 300/, 'the price shows on the locked buddy');
      assert.equal(await page.$('[data-action="wardrobe-species"][data-val="cat"] .species-price'), null, 'free buddies have no price');
      if (shots && coins > 300) await page.screenshot({ path: `${shots}/arcticfox-picker-${label}.png` });
      await page.click(arctic);

      if (coins < 300) {
        assert.equal(await page.$('[data-action="buy-species"]'), null, 'no buy button without the coins');
        assert.match(await page.textContent('.toast'), /180 more coins to go for the arctic fox/);
        assert.equal((await kidOf(page)).buddy.species, 'fox');
        assert.deepEqual(errors, []);
        await page.close();
        continue;
      }

      assert.match(await page.textContent('#modal'), /Get the arctic fox\?/);
      assert.match(await page.textContent('#modal'), /You'll have 1100 coins left/);
      if (shots) { await page.waitForTimeout(400); await page.screenshot({ path: `${shots}/arcticfox-buy-${label}.png` }); }
      await page.click('[data-action="buy-species"]');
      let s = await kidOf(page);
      assert.equal(s.buddy.species, 'arcticfox');
      assert.equal(s.spent, -1100);
      assert.deepEqual(s.owned, ['bg-fjord', 'buddy:arcticfox']);
      assert.equal(s.buddy.outfit.hat, undefined, 'the fox keeps its cap; the arctic fox needs its own');
      assert.equal(s.buddy.outfit.background, 'bg-fjord', 'places are shared');
      await page.waitForTimeout(1800);

      // its own special, first in the Hats tab, and no raccoon hat
      await page.click('[data-action="wardrobe-slot"][data-slot="hat"]');
      assert.equal(await page.getAttribute('.items .item >> nth=0', 'data-id'), 'hat-icecrown');
      assert.match(await page.textContent('[data-id="hat-icecrown"]'), /Arctic fox only/);
      assert.equal(await page.$('[data-id="hat-coonskin"]'), null);
      await page.click('[data-id="hat-icecrown"]');
      await page.click('[data-action="buy-confirm"]');
      await page.waitForTimeout(1800);
      if (shots) await page.screenshot({ path: `${shots}/arcticfox-crown-${label}.png` });

      // switch back to the fox and back again: no second charge
      await page.click('[data-action="wardrobe-switch"]');
      assert.equal(await page.$(`${arctic} .species-price`), null, 'owned: no price any more');
      await page.click('[data-action="wardrobe-species"][data-val="fox"]');
      assert.equal((await kidOf(page)).buddy.outfit.hat, 'hat-cap', 'the fox puts its cap back on');
      await page.click('[data-action="wardrobe-switch"]');
      await page.click(arctic);
      assert.equal(await page.$('[data-action="buy-species"]'), null);
      s = await kidOf(page);
      assert.equal(s.buddy.species, 'arcticfox');
      assert.equal(s.buddy.outfit.hat, 'hat-icecrown');
      assert.equal(s.spent, -100);
      if (shots) { await page.click('[data-action="wardrobe-back"]'); await page.waitForTimeout(1200); await page.screenshot({ path: `${shots}/arcticfox-home-${label}.png` }); }
      assert.deepEqual(errors, []);
      await page.close();
    }
  }
  console.log('arctic fox test passed');
} finally {
  await browser.close();
  site.close();
}
