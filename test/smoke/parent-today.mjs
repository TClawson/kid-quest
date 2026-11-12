// Browser test: the parents' Today tab. One card per kid with the day at a glance,
// chores waiting for a parent with Approve and Send back, a card that opens to tick
// chores for a kid, Undo on every tick and approval, Approve all (saying when it
// includes earlier days), the bottom navigation, Past days' Undo, the one-line
// chores in Edit kid, the folded test tools, and no PIN on a parent's own phone.
// Run: npm run test:smoke   (SHOTS_DIR=... saves screenshots)
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { toPicker, openParents, openMenu } from '../helpers/open-kid.mjs';
import { serve } from '../helpers/serve.mjs';
import { parentFamily } from '../helpers/parent-family.mjs';
import { dateKey, addDays, totalCoins, totalXp } from '../../js/logic.js';

const shots = process.env.SHOTS_DIR;
const site = await serve('.');
const browser = await chromium.launch();
const t = dateKey();
const y = addDays(t, -1);

async function open(viewport, setup, { family = false } = {}) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // no Firebase in this test: a family device just can't reach it
  if (family) await page.route('**/js/vendor/firebase.js', (r) => r.abort());
  await page.goto(site.url);
  await page.evaluate(setup, parentFamily());
  await page.reload();
  return { page, errors };
}

const stored = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
const rec = async (page, kid, key, task) => (await stored(page)).log[key]?.[kid]?.tasks?.[task];
const card = (page, kid) => page.locator(`.kc[data-kid="${kid}"]`);
const undo = async (page) => { await page.click('.toast .toast-btn'); await page.waitForTimeout(100); };

try {
  // ---------- a phone on its own (not in a family): the PIN, then Today ----------
  {
    const { page, errors } = await open({ width: 412, height: 915 }, (s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)));
    await toPicker(page);
    assert.match(await page.textContent('[data-action="parent"]'), /🔒 Parents/);
    await openParents(page);
    assert.equal(await page.locator('#modal .pin').count(), 1, 'the PIN on a device not in a family');
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);

    // Today is the default tab, with the bottom navigation and a badge of what waits
    assert.equal(await page.locator('.pnav [data-tab="today"].on').count(), 1);
    assert.deepEqual(await page.locator('.pnav button span:not(.nb)').allInnerTexts(), ['Today', 'Kids', 'Past days', 'Settings']);
    assert.equal((await page.textContent('.pnav .nb')).trim(), '4');
    assert.equal(await page.locator('[data-tab="approvals"]').count(), 0, 'no Approvals tab');
    assert.equal(await page.locator('.kc').count(), 4);

    // each card: the day in one line and a bar with one segment per chore
    assert.equal(await card(page, 'kid_ayden').locator('.kc-top small').innerText(), '4 done · 2 waiting · 3 to go');
    assert.deepEqual(await card(page, 'kid_ayden').locator('.seg i').evaluateAll((els) => els.map((e) => e.className)), ['done', 'done', 'done', 'done', 'waiting', 'waiting', 'todo', 'todo', 'todo']);
    assert.equal(await card(page, 'kid_remi').locator('.kc-top small').innerText(), '5 done · 2 waiting · 3 to go');
    assert.equal(await card(page, 'kid_remi').locator('.seg i.waiting').count(), 1, "only today's chores are in the bar");
    assert.equal(await card(page, 'kid_esther').locator('.kc-top small').innerText(), 'All 7 done 🌟 · chest opened');
    assert.equal(await card(page, 'kid_edison').locator('.kc-top small').innerText(), '1 done · 3 to go');

    // waiting chores show without opening the card, with the same detail as before
    const ayWait = card(page, 'kid_ayden').locator('.pr.wait');
    assert.equal(await ayWait.count(), 2);
    assert.match(await ayWait.nth(0).innerText(), /Piano practice\s+30 min done · 7 min in other apps/);
    assert.match(await ayWait.nth(1).innerText(), /Chore of the week\s+Asked 20 min ago/);
    assert.match(await card(page, 'kid_remi').locator('.pr.wait').nth(1).innerText(), /Homework\s+From yesterday/);
    assert.equal(await card(page, 'kid_ayden').locator('.box').count(), 0, 'tick boxes only once opened');

    // the reward strip: one line, opening the Given rows
    assert.match(await page.locator('.reward-strip').innerText(), /3 Friday rewards to hand out\s+Ayden, Esther, Edison/);
    assert.equal(await page.locator('.reward-remind').count(), 0);
    await page.click('[data-action="rewards-see"]');
    assert.equal(await page.locator('.reward-remind .list-row').count(), 3);
    await page.click('[data-action="rewards-see"]');

    // Approve all says it includes an earlier day
    assert.equal((await page.innerText('.approve-all')).replace(/\s+/g, ' '), '✓ Approve all 4 · 1 from earlier days');
    if (shots) await page.screenshot({ path: `${shots}/today-phone.png` });

    // approve one: paid like a normal approval; Undo puts the status, coins and XP back exactly
    const s0 = await stored(page);
    const coins0 = totalCoins(s0, s0.kids[0], t);
    const xp0 = totalXp(s0, s0.kids[0], t);
    const piano0 = await rec(page, 'kid_ayden', t, 'a_piano');
    await card(page, 'kid_ayden').locator('[data-action="approve"][data-task="a_piano"]').click();
    let s1 = await stored(page);
    assert.equal(s1.log[t].kid_ayden.tasks.a_piano.status, 'done');
    assert.equal(s1.log[t].kid_ayden.tasks.a_piano.by, 'parent');
    assert.ok(totalCoins(s1, s1.kids[0], t) > coins0 && totalXp(s1, s1.kids[0], t) > xp0, 'pays coins and XP');
    assert.match(await page.innerText('.toast'), /Piano practice approved for Ayden · \+\d+\s🪙 \+\d+\sXP/);
    assert.equal(await card(page, 'kid_ayden').locator('.kc-top small').innerText(), '5 done · 1 waiting · 3 to go');
    assert.equal((await page.textContent('.pnav .nb')).trim(), '3');
    if (shots) await page.screenshot({ path: `${shots}/undo-toast-phone.png` });
    await undo(page);
    s1 = await stored(page);
    assert.deepEqual(s1.log[t].kid_ayden.tasks.a_piano, piano0, 'the record is back as it was');
    assert.equal(totalCoins(s1, s1.kids[0], t), coins0);
    assert.equal(totalXp(s1, s1.kids[0], t), xp0);
    assert.equal(await card(page, 'kid_ayden').locator('.pr.wait').count(), 2);

    // send back, then Undo
    await card(page, 'kid_ayden').locator('[data-action="send-back"][data-task="a_cotw"]').click();
    assert.equal(await rec(page, 'kid_ayden', t, 'a_cotw'), undefined);
    await undo(page);
    assert.equal((await rec(page, 'kid_ayden', t, 'a_cotw')).status, 'pending');

    // open Remington's card: a tick box for every chore not done (bonus exercise too), the done ones on one line
    await page.click('[data-action="today-kid"][data-kid="kid_remi"]');
    const remi = card(page, 'kid_remi');
    assert.deepEqual(await remi.locator('.box').evaluateAll((els) => els.map((e) => e.dataset.task)), ['r_piano', 'r_cotw', 'r_shower', 'r_soccer']);
    assert.match(await remi.locator('.pr:has([data-task="r_piano"])').innerText(), /11 of 30 min on the timer/);
    assert.match(await remi.locator('.more').innerText(), /5 done: 🪥 🛏️ 🧸 🐶 🍴\s+Show/);
    assert.deepEqual(await remi.locator('.kc-actions .btn').allInnerTexts(), ['🎁 Bonus', '😷 Excuse', '✏️ Chores']);
    if (shots) await page.screenshot({ path: `${shots}/today-open-phone.png` });

    // tick for the kid: done by a parent, same pay as an approval; Undo keeps the timer's seconds
    await remi.locator('[data-action="today-tick"][data-task="r_piano"]').click();
    assert.deepEqual(Object.keys(await rec(page, 'kid_remi', t, 'r_piano')).sort(), ['at', 'by', 'seconds', 'status']);
    assert.equal((await rec(page, 'kid_remi', t, 'r_piano')).by, 'parent');
    assert.match(await page.innerText('.toast'), /Piano practice done for Remington/);
    assert.equal(await remi.locator('.kc-top small').innerText(), '6 done · 2 waiting · 2 to go');
    await undo(page);
    assert.deepEqual(await rec(page, 'kid_remi', t, 'r_piano'), { seconds: 660 });
    // bonus exercise pays gems
    await remi.locator('[data-action="today-tick"][data-task="r_soccer"]').click();
    assert.match(await page.innerText('.toast'), /Soccer practice done for Remington · \+10\s💎/);
    await undo(page);
    assert.equal(await rec(page, 'kid_remi', t, 'r_soccer'), undefined);

    // un-tick a done chore from the open list, then Undo brings back all of it
    await remi.locator('[data-action="today-show-done"]').click();
    const bed0 = await rec(page, 'kid_remi', t, 'r_bed');
    await remi.locator('[data-action="today-untick"][data-task="r_bed"]').click();
    assert.equal(await rec(page, 'kid_remi', t, 'r_bed'), undefined);
    assert.match(await page.innerText('.toast'), /Make bed un-ticked for Remington/);
    await undo(page);
    assert.deepEqual(await rec(page, 'kid_remi', t, 'r_bed'), bed0);

    // Excuse today, and Undo
    await remi.locator('[data-action="today-excuse"]').click();
    assert.equal((await stored(page)).log[t].kid_remi.excused, true);
    assert.match(await remi.locator('.kc-top small').innerText(), /Excused today/);
    await undo(page);
    assert.equal('excused' in (await stored(page)).log[t].kid_remi, false);

    // Bonus opens the bonus dialog
    await remi.locator('[data-action="bonus"]').click();
    await page.waitForSelector('#modal:not([hidden]) [data-action="bonus-give"]');
    await page.click('#modal [data-action="modal-close"]');

    // touch targets: every button on Today is at least 44 px both ways
    const small = await page.locator('.screen.parent button:visible, .pnav button, .approve-all').evaluateAll((els) => els
      .map((e) => ({ e, r: e.getBoundingClientRect() }))
      .filter(({ r }) => r.width && (r.width < 44 || r.height < 44))
      .map(({ e, r }) => `${e.dataset.action || e.className} ${Math.round(r.width)}x${Math.round(r.height)}`));
    assert.deepEqual(small, []);

    // Approve all: all four (yesterday's too); Undo puts every one back; then for real
    const before = await stored(page);
    await page.click('[data-action="approve-all"]');
    let s2 = await stored(page);
    for (const [kid, key, id] of [['kid_ayden', t, 'a_piano'], ['kid_ayden', t, 'a_cotw'], ['kid_remi', t, 'r_hw'], ['kid_remi', y, 'r_hw']]) assert.equal(s2.log[key][kid].tasks[id].status, 'done', `${kid} ${key} ${id}`);
    assert.match(await page.innerText('.toast'), /Approved 4 chores/);
    assert.equal(await page.locator('.approve-bar').count(), 0);
    assert.equal(await page.locator('.pnav .nb').count(), 0);
    await undo(page);
    assert.deepEqual((await stored(page)).log, before.log, 'Undo puts back every approval');
    await page.click('[data-action="approve-all"]');
    assert.equal(await page.locator('.pr.wait').count(), 0);

    // Tasks shortcut: that kid's chores
    await remi.locator('[data-action="today-chores"]').click();
    assert.equal(await page.locator('.pnav [data-tab="kids"].on').count(), 1);
    assert.equal(await page.inputValue('[data-kidfield="name"]'), 'Remington');

    // Edit kid: one line per chore, one open at a time, a new chore opens by itself
    assert.equal(await page.locator('.task-edit.open').count(), 0);
    assert.match(await page.locator('.task-edit[data-task="r_piano"] .task-line').innerText(), /Piano practice\s+After school · Every day · 30 min timer\s+~\d+ 🪙/);
    if (shots) await page.screenshot({ path: `${shots}/edit-kid-phone.png` });
    await page.click('.task-edit[data-task="r_piano"] .task-line');
    assert.equal(await page.locator('.task-edit[data-task="r_piano"] [data-field="minutes"]').inputValue(), '30');
    await page.click('.task-edit[data-task="r_bed"] .task-line');
    assert.deepEqual(await page.locator('.task-edit.open').evaluateAll((els) => els.map((e) => e.dataset.task)), ['r_bed']);
    await page.click('[data-action="add-task"][data-period="afternoon"]');
    const added = (await stored(page)).kids[1].tasks.at(-1);
    assert.equal(added.name, 'New chore');
    assert.deepEqual(await page.locator('.task-edit.open').evaluateAll((els) => els.map((e) => e.dataset.task)), [added.id]);
    await page.click(`[data-action="delete-task"][data-task="${added.id}"]`);
    await page.click('#modal [data-action="modal-yes"]');

    // Past days: un-ticking a done chore can be undone
    await page.click('[data-action="tab"][data-tab="history"]');
    const ed0 = await rec(page, 'kid_esther', y, 'e_bed');
    assert.equal(ed0, undefined, 'nothing yesterday');
    await page.fill('[data-action-change="history-date"]', t);
    await page.dispatchEvent('[data-action-change="history-date"]', 'change');
    const bed1 = await rec(page, 'kid_esther', t, 'e_bed');
    await page.click('[data-action="history-toggle"][data-kid="kid_esther"][data-task="e_bed"]');
    assert.equal(await rec(page, 'kid_esther', t, 'e_bed'), undefined);
    assert.match(await page.innerText('.toast'), /Make bed un-ticked for Esther/);
    await undo(page);
    assert.deepEqual(await rec(page, 'kid_esther', t, 'e_bed'), bed1);

    // Settings: the test tools are folded under one row
    await page.click('[data-action="tab"][data-tab="settings"]');
    assert.equal(await page.locator('[data-action="studio-test"], [data-action="listen-open"], .game-test').count(), 0);
    if (shots) await page.screenshot({ path: `${shots}/settings-phone.png`, fullPage: true });
    await page.click('[data-action="test-tools"]');
    assert.equal(await page.locator('[data-action="studio-test"]').count(), 1);
    assert.equal(await page.locator('[data-action="listen-open"]').count(), 1);
    assert.equal(await page.locator('.card.game-test + .card.studio-test').count(), 1);

    // back to the kid picker
    await page.click('[data-action="parent-exit"]');
    assert.equal(await page.locator('.kid-grid').count(), 1);
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---------- 360 px wide and a tablet: nothing pokes out sideways ----------
  for (const viewport of [{ width: 360, height: 780 }, { width: 800, height: 1280 }]) {
    const { page, errors } = await open(viewport, (s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)));
    await openParents(page);
    for (const d of '1234') await page.click(`[data-pin="${d}"]`);
    for (const id of ['kid_ayden', 'kid_remi']) await page.click(`[data-action="today-kid"][data-kid="${id}"]`);
    await page.click('[data-action="today-show-done"][data-kid="kid_remi"]');
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `no sideways scroll at ${viewport.width}`);
    // the navigation and Approve all line up with the page, centered on a tablet
    const nav = await page.locator('.pnav-in').boundingBox();
    const screen = await page.locator('.screen.parent').boundingBox();
    assert.ok(Math.abs(nav.x + nav.width / 2 - (screen.x + screen.width / 2)) < 2, 'nav centered');
    if (shots && viewport.width === 800) await page.screenshot({ path: `${shots}/today-tablet.png` });
    assert.deepEqual(errors, []);
    await page.close();
  }

  // ---------- a parent's phone in the family: no PIN, and the home cards show what waits ----------
  {
    const { page, errors } = await open({ width: 412, height: 915 }, (s) => {
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'parent', kidId: null, email: 'parent@example.com' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(s));
    }, { family: true });
    await toPicker(page);
    assert.match(await page.textContent('[data-action="parent"]'), /👪 Parents/);
    assert.match(await page.locator('.kid-card[data-id="kid_ayden"]').innerText(), /4 of 9 done · 2 waiting/);
    assert.doesNotMatch(await page.locator('.kid-card[data-id="kid_edison"]').innerText(), /waiting/);
    await openParents(page);
    assert.equal(await page.locator('#modal .pin').count(), 0, 'no PIN on a parent phone');
    assert.equal(await page.locator('.pnav [data-tab="today"].on').count(), 1);
    assert.match(await page.innerText('.phead small'), /·/, 'the sync state is in the header');
    assert.deepEqual(errors.filter((e) => !/firebase|Failed to fetch|ERR_FAILED|dynamically imported/i.test(e)), []);
    await page.close();
  }

  // ---------- a kid's tablet in the family keeps the PIN ----------
  {
    const { page } = await open({ width: 800, height: 1280 }, (s) => {
      const kidOnly = { ...s, kids: s.kids.filter((k) => k.id === 'kid_ayden') };
      localStorage.setItem('kidquest.cloud', JSON.stringify({ familyId: 'fam', role: 'kid', kidId: 'kid_ayden' }));
      localStorage.setItem('kidquest.cloud.cache', JSON.stringify(kidOnly));
    }, { family: true });
    // one kid on this tablet: no picker, so Parents is in the village's Menu (no Switch kid there)
    await openMenu(page);
    assert.match(await page.textContent('#modal [data-action="menu-parents"]'), /🔒\s*Parents/);
    assert.equal(await page.locator('#modal [data-action="menu-switch"]').count(), 0);
    await openParents(page);
    assert.equal(await page.locator('#modal .pin').count(), 1, 'the PIN on a kid tablet');
    await page.close();
  }
  console.log('parent today smoke ok');
} finally {
  await browser.close();
  site.close();
}
