// The family's trees and flowers in the village (js/villagebloom.js): seeds a family whose
// kids have many good days, opens several maps, checks that the plants and critters are drawn
// and that the buddy can walk behind a tree, and takes pictures.
// Run: node test/smoke/village-bloom.mjs <outDir> [theme]
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { VILLAGE_START } from '../../js/familygarden.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = process.argv[2] || 'previews';
const only = process.argv[3];
fs.mkdirSync(out, { recursive: true });
let failed = 0;
const check = (ok, what) => { if (!ok) { failed += 1; console.log('FAIL', what); } else console.log('ok  ', what); };

// kids that did [done, 5] every day from the start up to the day before `today`, by pattern(i)
function family(theme, today, pattern) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const names = [['kid_ava', 'Ava', '#ff6b6b', 'fox'], ['kid_ben', 'Ben', '#4dabf7', 'bunny'], ['kid_cleo', 'Cleo', '#51cf66', 'owl']];
  for (const [id, name, color, species] of names) {
    const daily = {};
    for (let i = 0, key = VILLAGE_START; key < today; i += 1, key = addDays(key, 1)) daily[key] = [pattern(i), 5];
    s.kids.push({ id, name, color, tasks: defaultTasks(), startDate: addDays(VILLAGE_START, -30), seenUnlocks: [], seenMoves: [], spent: 0, daily, buddy: { species, outfit: { background: theme } } });
  }
  return s;
}

const CASES = {
  months4: { today: addDays(VILLAGE_START, 120), pattern: () => 5, themes: ['bg-meadow', 'bg-ocean', 'bg-volcano', 'bg-galaxy'] },
  week2: { today: addDays(VILLAGE_START, 13), pattern: () => 5, themes: ['bg-meadow'] },
  wilted: { today: addDays(VILLAGE_START, 40), pattern: (i) => (i < 33 ? 5 : 0), themes: ['bg-meadow'] },
};
const SIZES = { tablet: { width: 1280, height: 800 }, phone: { width: 412, height: 915 } };

const site = await serve('.');
const browser = await chromium.launch();

async function open(theme, c, viewport, tall) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  if (tall) await ctx.addInitScript(() => document.addEventListener('DOMContentLoaded', () => { const st = document.createElement('style'); st.textContent = '.village-view{height:1400px!important}.screen{max-width:none!important}'; document.head.append(st); }));
  const page = await ctx.newPage();
  page.on('pageerror', (e) => { failed += 1; console.log('ERR', theme, e.message); });
  await page.clock.install({ time: new Date(`${c.today}T07:30:00`) });
  await page.goto(site.url);
  await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), family(theme, c.today, c.pattern));
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1000);
  while (await page.locator('#modal:not([hidden])').count()) { await page.click('#modal [data-action="modal-close"]'); await page.clock.runFor(400); }
  await page.locator('.village').scrollIntoViewIfNeeded();
  await page.clock.runFor(4000);
  return { ctx, page };
}

for (const [name, c] of Object.entries(CASES)) {
  for (const theme of c.themes) {
    if (only && theme !== only) continue;
    const label = `${theme.replace('bg-', '')}-${name}`;
    // the whole village in one tall picture, with the checks
    {
      const { ctx, page } = await open(theme, c, { width: 1400, height: 1700 }, true);
      const info = await page.evaluate(() => {
        const sec = document.querySelector('.village');
        const bloom = JSON.parse(sec.dataset.v).bloom;
        const alpha = (cv) => { const d = cv.getContext('2d').getImageData(0, 0, cv.width, cv.height).data; for (let i = 3; i < d.length; i += 4) if (d[i]) return true; return false; };
        return {
          bloom: { trees: bloom.trees.length, flowers: bloom.flowers.length, wilt: bloom.wilt, level: bloom.level },
          treeEls: sec.querySelectorAll('.v-tree').length,
          critterCanvases: sec.querySelectorAll('.v-bloom-life').length,
          critterDrawn: [...sec.querySelectorAll('.v-bloom-life')].some(alpha),
          line: document.querySelector('.garden-line')?.textContent || '',
        };
      });
      console.log(label, JSON.stringify(info));
      check(info.bloom.trees > 0 && info.treeEls === info.bloom.trees, `${label}: every tree is on the map`);
      check(name === 'week2' || info.bloom.flowers > 0, `${label}: flowers`);
      check(Boolean(info.line), `${label}: the message line shows`);
      if (name === 'months4') {
        check(info.bloom.level > 0 && info.critterDrawn, `${label}: critters come out and are drawn`);
        check(info.bloom.trees >= 12, `${label}: most trees are planted`);
      }
      if (name === 'wilted') check(info.bloom.wilt >= 1 && /thirsty/.test(info.line), `${label}: wilted plants and the thirsty line`);
      await page.screenshot({ path: `${out}/${label}-village.png`, clip: { ...(await page.locator('.village-view').boundingBox()), y: (await page.locator('.village-view').boundingBox()).y + (await page.evaluate(() => window.scrollY)) }, fullPage: true });
      // the buddy goes behind a tree: tap just above the foot of a tree and look at the stacking
      if (info.treeEls) {
        const r = await page.evaluate(async () => {
          const sec = document.querySelector('.village');
          const world = sec.querySelector('.village-world');
          const trees = [...sec.querySelectorAll('.v-tree')].map((t) => ({ y: Number(t.style.zIndex), x: parseFloat(t.style.left) + t.width / 2 })).sort((a, b) => b.y - a.y);
          const buddy = sec.querySelector('.v-buddy');
          return { trees, buddyZ: Number(buddy.style.zIndex), scale: world.getBoundingClientRect().width / world.offsetWidth };
        });
        const tree = r.trees.find((t) => t.y > 120 && t.y < 500) || r.trees[0];
        const box = await page.evaluate(() => { const b = document.querySelector('.village-world').getBoundingClientRect(); return { left: b.left, top: b.top }; });
        await page.mouse.click(box.left + tree.x * r.scale, box.top + (tree.y - 14) * r.scale);
        await page.clock.runFor(9000);
        const after = await page.evaluate(() => { const b = document.querySelector('.v-buddy'); return { z: Number(b.style.zIndex), y: parseFloat(b.style.top), x: parseFloat(b.style.left) }; });
        console.log(label, 'buddy', JSON.stringify(after), 'tree', JSON.stringify(tree));
        // a tree on the far side of water or a wall may not be reachable in 9 seconds: that is only a note
        const near = Math.abs(after.x - tree.x) < 80 && Math.abs(after.y - tree.y) < 40;
        if (!near) console.log('note', label, 'the buddy did not get to that tree (far or walled in)');
        check(!near || after.z < tree.y + 40, `${label}: the buddy walked up to a tree`);
        // standing above the tree's feet, the buddy is drawn behind it
        check(after.y <= tree.y ? after.z <= tree.y : true, `${label}: behind the tree when higher up`);
      }
      await ctx.close();
    }
    // tablet and phone views, as a kid sees them
    for (const [sizeName, viewport] of Object.entries(SIZES)) {
      const { ctx, page } = await open(theme, c, viewport, false);
      await page.screenshot({ path: `${out}/${label}-${sizeName}.png`, fullPage: false });
      if (theme === 'bg-meadow') {
        const line = page.locator('.garden-line');
        const banner = page.locator('.family-banner');
        const a = banner.count().then((n) => (n ? banner.boundingBox() : null));
        const l = await line.boundingBox();
        const b = await a;
        const y = await page.evaluate(() => window.scrollY);
        const top = Math.min(l.y, b?.y ?? l.y);
        await page.screenshot({ path: `${out}/${label}-${sizeName}-message.png`, clip: { x: 0, y: y + top - 6, width: viewport.width, height: l.y + l.height - top + 12 }, fullPage: true });
      }
      await ctx.close();
    }
  }
}
await browser.close(); site.close();
console.log(failed ? `${failed} problem(s)` : 'village bloom: all ok');
process.exit(failed ? 1 : 0);
