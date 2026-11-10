// Family sync, end to end against the Firebase emulators: a parent's phone
// starts a family, a kid's tablet joins with a code and uploads its progress,
// changes flow both ways (also after being offline), and a second parent joins.
// Run: npm run test:e2e
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, dateKey, addDays } from '../../js/logic.js';

const pinHash = (pin) => `sha256:${createHash('sha256').update(`kidquest:${pin}`).digest('hex')}`;
const site = await serve('.');
const browser = await chromium.launch();
const errors = [];
const T0 = Date.now();
const log = (m) => console.log(`[${((Date.now() - T0) / 1000).toFixed(1)}s] ${m}`);

async function device(name, { email, saved } = {}) {
  const ctx = await browser.newContext();
  await ctx.addInitScript(([testEmail]) => {
    localStorage.setItem('kidquest.emulator', '1');
    if (testEmail) window.__kidQuestTestEmail = testEmail;
  }, [email || '']);
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error' && /FirebaseError|Kid Quest/.test(m.text())) errors.push(`${name}: ${m.text().slice(0, 200)}`); });
  page.on('console', (m) => { if (process.env.E2E_DEBUG) log(`${name} console.${m.type()}: ${m.text().slice(0, 300)}`); });
  await page.goto(site.url);
  if (saved) {
    await page.evaluate((s) => localStorage.setItem('kidquest.v1', JSON.stringify(s)), saved);
    await page.reload();
  }
  return { ctx, page };
}

async function typePin(page, pin) {
  for (const d of pin) await page.click(`[data-pin="${d}"]`);
}

async function openSettings(page, pin) {
  if (await page.locator('[data-action="parent-exit"]').count()) await page.click('[data-action="parent-exit"]');
  await page.click('[data-action="parent"]');
  await typePin(page, pin);
  await page.click('[data-action="tab"][data-tab="settings"]');
}

const stateOf = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.kidQuest.state)));

async function until(what, fn, ms = 30000) {
  const end = Date.now() + ms;
  for (;;) {
    try { if (await fn()) return; } catch { /* page reloading */ }
    if (Date.now() > end) throw new Error(`timed out waiting for ${what}`);
    await new Promise((r) => setTimeout(r, 200));
  }
}

async function getCode(page, kind) {
  await page.click(kind === 'kid' ? '[data-action="family-invite-kid"]' : '[data-action="family-invite-parent"]');
  if (kind === 'kid') await page.click('[data-action="family-invite-for"][data-kid=""]');
  const code = (await page.locator('.join-code').textContent({ timeout: 10000 })).trim();
  await page.click('[data-action="modal-close"]');
  return code;
}

async function joinWith(page, code) {
  await page.click('[data-action="family-join"]');
  await page.fill('[data-join-code]', code);
  await Promise.all([page.waitForEvent('load', { timeout: 20000 }), page.click('[data-action="family-join-go"]')]);
}

try {
  const today = dateKey();
  // ---- Only allowed Google accounts can start a family (set up in the console in real life)
  await fetch('http://127.0.0.1:8180/v1/projects/demo-kid-quest/databases/(default)/documents/allowedParents?documentId=mom@example.com', {
    method: 'POST', headers: { Authorization: 'Bearer owner', 'Content-Type': 'application/json' }, body: '{"fields":{}}',
  }).then((r) => assert.ok(r.ok, `seeding allowedParents: ${r.status}`));

  // ---- Mom's phone: fresh install, choose PIN, start a family
  const mom = await device('mom', { email: 'mom@example.com' });
  await mom.page.click('[data-action="setup-pin"]');
  await typePin(mom.page, '1234');
  await typePin(mom.page, '1234');
  await mom.page.click('[data-action="tab"][data-tab="settings"]');
  await mom.page.click('[data-action="family-create"]');
  await mom.page.waitForSelector('[data-action="modal-yes"]', { timeout: 10000 });
  await Promise.all([mom.page.waitForEvent('load', { timeout: 20000 }), mom.page.click('[data-action="modal-yes"]')]);
  const momCfg = await mom.page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud')));
  assert.equal(momCfg.role, 'parent');
  log('✓ family created');

  // ---- Ava's tablet: has its own progress (two past days, a purchase) and its own PIN
  const saved = emptyState();
  saved.settings.pinHash = pinHash('1111');
  saved.settings.questView = 'list';
  saved.settings.music = false;
  const tasks = defaultTasks();
  const [teeth, bed] = tasks;
  saved.kids.push({ id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks, startDate: addDays(today, -2), owned: ['hat'], spent: 40 });
  saved.log[addDays(today, -1)] = { kid_ava: { tasks: { [teeth.id]: { status: 'done' } } } };
  saved.log[addDays(today, -2)] = { kid_ava: { tasks: { [bed.id]: { status: 'done' } }, excused: true } };
  const ava = await device('ava', { saved });

  await openSettings(mom.page, '1234');
  const kidCode = await getCode(mom.page, 'kid');
  await openSettings(ava.page, '1111');
  await joinWith(ava.page, kidCode);
  const avaCfg = await ava.page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.cloud')));
  assert.deepEqual([avaCfg.role, avaCfg.kidId, avaCfg.familyId], ['kid', 'kid_ava', momCfg.familyId]);
  log('✓ kid tablet joined with a code');

  // Mom's phone gets Ava with all her history; Ava's tablet takes the family PIN
  // and keeps its own device settings.
  await until('Ava on mom’s phone', async () => (await stateOf(mom.page)).kids.some((k) => k.id === 'kid_ava'));
  const momView = await stateOf(mom.page);
  assert.equal(momView.kids.find((k) => k.id === 'kid_ava').spent, 40);
  assert.equal(momView.log[addDays(today, -2)].kid_ava.excused, true);
  await until('family PIN on Ava’s tablet', async () => (await stateOf(ava.page)).settings.pinHash === pinHash('1234'));
  const avaView = await stateOf(ava.page);
  assert.equal(avaView.settings.music, false, 'device setting kept');
  assert.equal(avaView.kids.length, 1, 'kid tablet only holds its kid');
  const legacy = await ava.page.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')));
  assert.equal(legacy.settings.pinHash, pinHash('1111'), 'original local copy untouched');
  log('✓ progress uploaded, PIN shared, old copy kept');

  // ---- Ava ticks a task; mom sees it
  if (await ava.page.locator('[data-action="parent-exit"]').count()) await ava.page.click('[data-action="parent-exit"]');
  await ava.page.click('[data-action="open-kid"]');
  await ava.page.click(`[data-action="task"][data-id="${teeth.id}"]`);
  await until('teeth on mom’s phone', async () => (await stateOf(mom.page)).log[today]?.kid_ava?.tasks[teeth.id]?.status === 'done');
  log('✓ kid change reaches parent');

  // ---- Ava offline ticks another task while mom excuses the same day: both survive
  await ava.ctx.setOffline(true);
  await ava.page.evaluate(() => document.querySelector('[data-action="modal-close"]')?.click());
  await ava.page.click(`[data-action="task"][data-id="${bed.id}"]`);
  await mom.page.evaluate((day) => {
    const s = window.kidQuest.state;
    s.log[day].kid_ava.excused = true;
    window.kidQuest.save();
  }, today);
  await new Promise((r) => setTimeout(r, 1000));
  await ava.ctx.setOffline(false);
  const merged = async (page) => {
    const e = (await stateOf(page)).log[today]?.kid_ava;
    return e?.excused === true && e.tasks[bed.id]?.status === 'done' && e.tasks[teeth.id]?.status === 'done';
  };
  await until('merge on mom’s phone', () => merged(mom.page));
  await until('merge on Ava’s tablet', () => merged(ava.page));
  log('✓ offline change syncs and merges with a parent change');

  // ---- Both devices create the same new day while Ava is offline: neither
  // device's change is lost (a whole-document create used to replace the other)
  const fresh = addDays(today, -5);
  await ava.ctx.setOffline(true);
  await ava.page.evaluate(([day, id]) => {
    const s = window.kidQuest.state;
    s.log[day] = { kid_ava: { tasks: { [id]: { status: 'done' } } } };
    window.kidQuest.save();
  }, [fresh, teeth.id]);
  await mom.page.evaluate((day) => {
    const s = window.kidQuest.state;
    s.log[day] = { kid_ava: { tasks: {}, excused: true } };
    window.kidQuest.save();
  }, fresh);
  await new Promise((r) => setTimeout(r, 1500));
  await ava.ctx.setOffline(false);
  const bothNew = async (page) => {
    const e = (await stateOf(page)).log[fresh]?.kid_ava;
    return e?.excused === true && e.tasks?.[teeth.id]?.status === 'done';
  };
  await until('new day merged on mom’s phone', () => bothNew(mom.page));
  await until('new day merged on Ava’s tablet', () => bothNew(ava.page));
  log('✓ a day created on two devices at once keeps both changes');

  // ---- Ava buys two things in a row while a parent's change waits behind the buy
  // dialog: both purchases stick (the held-back update used to undo the first one)
  await mom.page.evaluate((day) => {
    const s = window.kidQuest.state;
    for (let i = 3; i <= 20; i += 1) {
      const d = new Date(`${day}T12:00:00`); d.setDate(d.getDate() - i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      s.log[key] = { kid_ava: { tasks: Object.fromEntries(s.kids[0].tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
    }
    window.kidQuest.save();
  }, today);
  await until('coins on Ava’s tablet', async () => Object.keys((await stateOf(ava.page)).log).length > 15);
  await ava.page.evaluate(() => document.querySelector('[data-action="modal-close"]')?.click());
  await ava.page.evaluate(() => document.querySelector('[data-action="wardrobe"]').click());
  await ava.page.click('[data-action="wardrobe-slot"][data-slot="home"]');
  await ava.page.click('[data-action="wardrobe-item"][data-id="home-chair-bean-blue-plain"]');
  await ava.page.waitForSelector('[data-action="buy-confirm"]');
  await mom.page.evaluate((day) => { window.kidQuest.state.log[day].kid_ava.note = 'nice work'; window.kidQuest.save(); }, today);
  await new Promise((r) => setTimeout(r, 1500)); // the parent's change arrives while the dialog is open
  await ava.page.click('[data-action="buy-confirm"]');
  await ava.page.evaluate(async () => {
    document.querySelector('[data-action="wardrobe-item"][data-id="home-art-fish"]').click();
    await new Promise((r) => setTimeout(r, 300));
    document.querySelector('[data-action="buy-confirm"]').click();
  });
  const both = async (page) => {
    const s = await stateOf(page);
    const k = s.kids.find((x) => x.id === 'kid_ava');
    return ['home-chair-bean-blue-plain', 'home-art-fish'].every((id) => k.owned.includes(id)) && k.spent === 40 + 90 + 60 && s.log[today].kid_ava.note === 'nice work';
  };
  await until('both purchases on Ava’s tablet', () => both(ava.page));
  await until('both purchases on mom’s phone', () => both(mom.page));
  await ava.page.click('[data-action="wardrobe-back"]');
  log('✓ two purchases in a row both stick');

  // ---- Mom adds Ben on her phone; Ben visits Ava's map wearing his outfit
  await mom.page.evaluate(() => {
    const s = window.kidQuest.state;
    s.kids.push({ id: 'kid_ben', name: 'Ben', color: '#4dabf7', tasks: [], startDate: s.kids[0].startDate, seenUnlocks: [], buddy: { species: 'bear', outfit: {} } });
    window.kidQuest.save();
  });
  await ava.page.click('[data-action="quest-mode"][data-mode="map"]');
  const visitor = ava.page.locator('.map-visitor');
  await until('Ben visiting Ava', async () => (await visitor.count()) === 1 && (await visitor.locator('.visitor-name').textContent()) === 'Ben');
  const plain = await visitor.locator('.visitor-buddy').innerHTML();
  await mom.page.evaluate(() => {
    window.kidQuest.state.kids.find((k) => k.id === 'kid_ben').buddy.outfit.hat = 'hat-party';
    window.kidQuest.save();
  });
  await until('Ben’s new hat on Ava’s map', async () => (await visitor.locator('.visitor-buddy').innerHTML()) !== plain);
  assert.equal((await stateOf(ava.page)).kids.length, 1, 'visitors are not added to the kid tablet’s own kids');
  log('✓ another kid visits, wearing their current outfit');

  // ---- Dad joins from a fresh phone with a parent code
  const parentCode = await (async () => { await openSettings(mom.page, '1234'); return getCode(mom.page, 'parent'); })();
  const dad = await device('dad', { email: 'dad@example.com' });
  await joinWith(dad.page, parentCode);
  await until('family on dad’s phone', async () => {
    const s = await stateOf(dad.page);
    return s.kids.some((k) => k.id === 'kid_ava') && s.settings.pinHash === pinHash('1234');
  });
  await dad.page.waitForSelector('[data-action="open-kid"]', { timeout: 10000 });
  log('✓ second parent joins and sees the family');

  // ---- A bad code is refused
  const stranger = await device('stranger', { email: 'x@example.com' });
  await stranger.page.click('[data-action="family-join"]');
  await stranger.page.fill('[data-join-code]', 'PAAAA-BBBB');
  await stranger.page.click('[data-action="family-join-go"]');
  await stranger.page.waitForSelector('text=Could not join', { timeout: 10000 });
  assert.equal(await stranger.page.evaluate(() => localStorage.getItem('kidquest.cloud')), null);
  log('✓ wrong code refused');

  // ---- A Google account that isn't on the allowed list can't start a family
  await stranger.page.click('[data-action="modal-close"]');
  await stranger.page.click('[data-action="setup-pin"]');
  await typePin(stranger.page, '5555');
  await typePin(stranger.page, '5555');
  await stranger.page.click('[data-action="tab"][data-tab="settings"]');
  await stranger.page.click('[data-action="family-create"]');
  await stranger.page.click('[data-action="modal-yes"]', { timeout: 10000 });
  await stranger.page.waitForSelector('text=can’t start a family', { timeout: 10000 });
  assert.equal(await stranger.page.evaluate(() => localStorage.getItem('kidquest.cloud')), null);
  const refused = errors.findIndex((e) => e.startsWith('stranger:') && /permission/i.test(e));
  if (refused >= 0) errors.splice(refused, 1);
  log('✓ stranger cannot start a family');

  const real = errors.filter((e) => !/offline|network|unavailable/i.test(e));
  assert.deepEqual(real, [], 'no page errors');
  console.log('e2e sync test passed');
} finally {
  await browser.close();
  site.close();
}
