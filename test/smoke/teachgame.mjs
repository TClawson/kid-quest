// "Teach me your piano" on the Note-o-Matic's screen (js/teachgame.js) in the real app, with
// Chrome's fake microphone playing a sound file this test writes: the middle group's keys (C4
// to B4) one a second, as a made-up piano (test/helpers/strings.mjs), then two seconds of
// quiet before it loops. A round may join the loop anywhere, so the robot may first hear other
// keys and say so, and lines up when the loop comes round to C4.
//
// The robot's Ready stage has a card saying how many keys it knows. The map shows all 88 keys
// and six groups; a round takes the 12 keys and goes back to the map ("12 of 12"); the card
// then says 12 of 64, and a reload keeps them. Skip and Stop work, a quiet robot dozes off,
// leaving the screen and putting the app away let the microphone go, and Start over forgets
// the keys after asking. A phone fits it all. Saves screenshots.
// Run: node test/smoke/teachgame.mjs [outDir]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { serve } from '../helpers/serve.mjs';
import { keysInARow } from '../helpers/strings.mjs';
import { emptyState, defaultTasks, fallbackHash, addDays, dateKey } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kq-teach-'));
const out = (process.argv[2] || path.join(tmp, 'shots')).replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = dateKey();
const TABLET = { width: 1280, height: 800 };
const PHONE = { width: 360, height: 740 };
const KID = 'kid_ava';
const MIDDLE = [60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71];

// ---------- the sound the fake microphone plays (it loops) ----------

function writeWav(file) {
  const rate = 48000;
  const { sound, seconds } = keysInARow(MIDDLE, rate, { gap: 1, len: 0.7, lead: 0.4 });
  const len = Math.round((seconds + 2) * rate); // two seconds of quiet before it starts again
  const s = new Float32Array(len);
  let peak = 0;
  for (const v of sound) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < sound.length; i += 1) s[i] = (0.6 * sound[i]) / peak;
  const buf = Buffer.alloc(44 + 2 * len);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + 2 * len, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(2 * len, 40);
  for (let i = 0; i < len; i += 1) buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s[i])) * 32767), 44 + 2 * i);
  fs.writeFileSync(file, buf);
}
const wav = path.join(tmp, 'keys.wav');
writeWav(wav);

// ---------- the family ----------

/** Ava with three weeks of every chore and today's (so the robot is awake). */
function family() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.questView = 'village';
  s.settings.music = false;
  const ava = { id: KID, name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -21), seenUnlocks: ['music-keyboard', 'music-upright', 'music-rock'], seenMoves: [], owned: [], spent: 0, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } } };
  s.kids.push(ava);
  for (let i = 0; i <= 21; i += 1) s.log[addDays(day, -i)] = { [KID]: { tasks: Object.fromEntries(ava.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  return s;
}

const site = await serve('.');
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required', '--use-fake-device-for-media-stream', '--use-fake-ui-for-media-stream', `--use-file-for-fake-audio-capture=${wav}`] });
const errors = [];

async function start(viewport, st) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  await ctx.grantPermissions(['microphone']);
  await ctx.addInitScript(() => {
    window.kqStarts = 0;
    const P = AudioBufferSourceNode.prototype;
    const s = P.start;
    P.start = function (...a) { window.kqStarts += 1; return s.apply(this, a); };
    window.kqStreams = [];
    const md = navigator.mediaDevices;
    const gum = md.getUserMedia.bind(md);
    md.getUserMedia = async (c) => { const x = await gum(c); window.kqStreams.push(x); return x; };
  });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_|net::/.test(m.text())) errors.push(m.text()); });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { [KID]: { day, inside: false, place: 'music' } }]);
  await page.reload();
  return { ctx, page };
}
/** Into Ava's music house. */
async function intoHouse(page) {
  await openKid(page, `[data-action="open-kid"][data-id="${KID}"]`);
  await page.waitForSelector('.music-house');
  // what pops up on the way in (news for the day, the music house's hello): closed
  await page.waitForTimeout(1500);
  for (let i = 0; i < 8; i += 1) {
    if (await page.locator('#modal:not([hidden])').count()) {
      const close = page.locator('#modal [data-action="modal-close"]');
      if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
      await page.waitForTimeout(400);
      continue;
    }
    if (await page.locator('.music-house .v-dialog:not([hidden]) [data-m="bye"]').count()) {
      await page.evaluate(() => document.querySelector('.music-house .v-dialog:not([hidden]) [data-m="bye"]').click());
      await page.waitForTimeout(300);
      continue;
    }
    break;
  }
}
const tap = (page, sel) => page.evaluate((q) => document.querySelector(q).click(), sel);
/** Into the robot's screen, with its module at hand, once it has read the piano. */
async function intoLab(page) {
  await tap(page, '.m-station[data-spot="lab"]');
  await page.waitForSelector('.lab-screen', { timeout: 20000 });
  await page.waitForSelector('#lab .lab-bubble');
  await page.evaluate(async () => {
    window.kqLab = await import('./js/notolab.js');
    window.kqTeach = await import('./js/teachgame.js');
  });
  await waitLab(page, () => window.kqLab.labState().teach.loaded);
}
const lab = (page) => page.evaluate(() => window.kqLab.labState());
const teach = async (page) => (await lab(page)).teach;
const waitLab = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms, polling: 50 });
const shot = async (page, name, sel = null) => {
  if (sel) await page.locator(sel).first().evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.screenshot({ path: `${out}/${name}.png` });
};
const noSideScroll = (page) => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
const tooSmall = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll(sel)].map((el) => { const r = el.getBoundingClientRect(); return [el.textContent.trim().slice(0, 30), Math.round(r.width), Math.round(r.height)]; }).filter(([, w, h]) => w < 44 || h < 44), sel);
const micsOpen = (page) => page.evaluate(() => window.kqStreams.flatMap((st) => st.getTracks()).filter((t) => t.readyState !== 'ended').length);
const card = (page) => page.locator('#lab .lab-teach p').textContent();
const kept = (page) => page.evaluate(async (kid) => {
  const p = await (await import('./js/studio-store.js')).loadPiano(kid);
  return p ? Object.keys(p.keys).map(Number) : [];
}, KID);

/** Start a group's round from the map and wait until the microphone is open. */
async function startRound(page, group) {
  await page.click(`#lab [data-lab="teach-group"][data-group="${group}"]`);
  await waitLab(page, () => window.kqLab.labState().teach.round?.mic, null, 15000);
  assert.equal(await micsOpen(page), 1, 'the microphone is open');
}

/** Play the middle group through to the end: back on the map with all 12. */
async function teachMiddle(page, name = '') {
  await startRound(page, 'middle');
  const t = await teach(page);
  assert.equal(t.round.wanted, 60);
  assert.equal(await page.locator('.lab-bubble').textContent(), 'Start on middle C. Play the glowing key. One key at a time, and let it ring.');
  assert.equal(await page.locator('#lab .lab-keys .tk.tk-w:not(.ctx)').count(), 7, 'seven white keys in the group');
  assert.equal(await page.locator('#lab .lab-keys .tk.tk-b:not(.ctx)').count(), 5, 'and five black ones');
  assert.ok(await page.locator('#lab .lab-keys .tk.ctx').count() >= 2, 'keys each side, dimmed');
  assert.equal(await page.locator('#lab .tk.want').count(), 1, 'one key glows');
  assert.equal(await page.locator('#lab .tk.want .tk-label').textContent(), 'C');
  // a few keys in: the screen as the kid sees it then (the key elements are never drawn again)
  await waitLab(page, () => (window.kqLab.labState().teach.round?.got.length || 0) >= 4, null, 45000).catch(async () => {
    throw new Error(`no keys taken: ${JSON.stringify(await teach(page))}`);
  });
  const first = await page.evaluate(() => { window.kqKey = document.querySelector('#lab .tk[data-key="60"]'); return true; });
  assert.ok(first);
  const mid = await teach(page);
  assert.deepEqual(mid.round.got, MIDDLE.slice(0, mid.round.got.length), 'taken in order');
  assert.equal(await page.locator('#lab .tk.taken').count(), mid.round.got.length, 'the keys taken are filled');
  assert.match(await page.locator('#lab .lab-teach-count').textContent(), /^\d+ of 12$/);
  if (name) await shot(page, `${name}-round`);
  await waitLab(page, () => !window.kqLab.labState().teach.round, null, 45000).catch(async () => {
    throw new Error(`the round never ended: ${JSON.stringify(await teach(page))}`);
  });
  assert.equal(await page.evaluate(() => document.contains(window.kqKey)), false, 'the map is drawn after the round');
  assert.equal(await micsOpen(page), 0, 'the microphone is let go');
  await waitLab(page, () => window.kqLab.labState().teach.known === 12 && !window.kqLab.labState().teach.keeping);
  const st = await lab(page);
  assert.equal(st.stage, 'teach', 'back on the map');
  assert.equal(st.robot, 'That\'s all 12. The robot knows 12 of 64 keys now.');
  assert.deepEqual(await kept(page), MIDDLE, 'kept on the tablet');
  assert.equal(await page.locator('#lab .lab-tile[data-group="middle"] small').textContent(), '12 of 12 ✓');
  assert.equal(await page.locator('#lab .lab-tile.next').getAttribute('data-group'), 'low', 'the low keys are next');
  assert.equal(await page.locator('#lab .pk-w.known, #lab .pk-b.known').count(), 12, 'the map shows them');
  assert.equal(await page.evaluate(() => window.kqStarts), 0, 'the tablet made no sound');
}

// 1. a tablet: the card, the map, a whole round, a reload, Skip, Stop, dozing, leaving, Start over
{
  const { ctx, page } = await start(TABLET, family());
  await intoHouse(page);
  await intoLab(page);
  assert.equal((await lab(page)).stage, 'ready');
  assert.equal(await page.locator('#lab .lab-teach h3').textContent(), 'Teach me your piano');
  assert.equal(await card(page), 'The robot knows 0 of 64 keys');
  assert.match(await page.locator('#lab .lab-teach-go').textContent(), /Teach$/);
  await shot(page, '1-tablet-ready-card', '#lab .lab-teach');

  // the map
  await page.click('#lab [data-lab="teach-map"]');
  assert.equal((await lab(page)).stage, 'teach');
  assert.equal(await page.locator('#lab .lab-teach').count(), 0, 'no card on the map');
  assert.equal(await page.locator('#lab .lab-shelf').count(), 0, 'no shelf on the map');
  assert.equal(await page.locator('#lab .lab-piano rect').count(), 88, 'all 88 keys');
  assert.equal(await page.locator('#lab .lab-piano rect.deep').count(), 24, 'the 24 keys under A2 greyed');
  assert.equal(await page.locator('#lab .lab-map-note').textContent(), 'The lowest keys are too deep for the tablet\'s ears.');
  assert.equal(await page.locator('#lab .lab-map-use').textContent(), 'The robot starts using what it learned at 56 keys.');
  assert.deepEqual(await page.locator('#lab .lab-tile b').allTextContents(), ['The middle', 'Low keys', 'High keys', 'Three deep keys', 'Higher keys', 'The very top']);
  assert.deepEqual(await page.locator('#lab .lab-tile small').allTextContents(), ['0 of 12', '0 of 12', '0 of 12', '0 of 3', '0 of 12', '0 of 13']);
  assert.equal(await page.locator('#lab .lab-tile.next').getAttribute('data-group'), 'middle');
  assert.equal(await page.locator('#lab [data-lab="teach-forget"]').count(), 0, 'nothing to forget yet');
  assert.ok(await noSideScroll(page));
  // Back, and the robot's own back arrow, go to Ready
  await page.click('#lab [data-lab="teach-back"]');
  assert.equal((await lab(page)).stage, 'ready');
  await page.click('#lab [data-lab="teach-map"]');
  await page.click('[data-action="lab-back"]');
  assert.equal((await lab(page)).stage, 'ready', 'the back arrow goes to Ready, not out');
  assert.equal(await page.locator('.lab-screen').count(), 1);
  await page.click('#lab [data-lab="teach-map"]');

  // a whole round
  await teachMiddle(page, '3-tablet');
  await shot(page, '2-tablet-map-one-group');
  await page.click('#lab [data-lab="teach-back"]');
  assert.equal(await card(page), 'The robot knows 12 of 64 keys');
  assert.match(await page.locator('#lab .lab-teach-go').textContent(), /Teach more$/);
  await shot(page, '1b-tablet-ready-card-12', '#lab .lab-teach');

  // a reload keeps them
  await page.reload();
  await intoHouse(page);
  await intoLab(page);
  assert.equal(await card(page), 'The robot knows 12 of 64 keys', 'kept after a reload');

  // Skip and Stop: the low keys (the loop plays none of them)
  await page.click('#lab [data-lab="teach-map"]');
  await startRound(page, 'low');
  assert.equal((await teach(page)).round.wanted, 48);
  await page.click('#lab [data-lab="teach-skip"]');
  await page.click('#lab [data-lab="teach-skip"]');
  let t = await teach(page);
  assert.deepEqual(t.round.skipped, [48, 49]);
  assert.equal(t.round.wanted, 50);
  assert.equal(await page.locator('#lab .tk.want').getAttribute('data-key'), '50', 'the glow moved on');
  assert.equal(await page.locator('#lab .tk.want .tk-label').textContent(), 'D');
  assert.equal(await page.locator('#lab .tk.skipped').count(), 2);
  await page.click('#lab [data-lab="teach-stop"]');
  t = await teach(page);
  assert.equal(t.round, null, 'Stop ends the round');
  assert.equal((await lab(page)).stage, 'teach');
  assert.equal(await micsOpen(page), 0, 'the microphone is let go');
  assert.equal(t.known, 12, 'nothing new kept');
  // skipping the last key ends the round
  await startRound(page, 'deep');
  for (let i = 0; i < 3; i += 1) await page.click('#lab [data-lab="teach-skip"]');
  assert.equal((await teach(page)).round, null, 'the round is over');
  assert.equal(await micsOpen(page), 0);

  // a robot that hears no key for a while dozes off
  await page.evaluate(() => { window.kqTeach.TEACH_GAME.doze = 0; });
  await startRound(page, 'high');
  await waitLab(page, () => !window.kqLab.labState().teach.round, null, 5000);
  assert.equal((await lab(page)).robot, 'I dozed off. Tap a group to go on.');
  assert.equal(await micsOpen(page), 0);
  await page.evaluate(() => { window.kqTeach.TEACH_GAME.doze = 45000; });

  // putting the app away stops the round
  await startRound(page, 'high');
  await page.evaluate(() => {
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    delete document.visibilityState;
  });
  assert.equal((await teach(page)).round, null);
  assert.equal(await micsOpen(page), 0, 'the microphone is let go when the app is put away');
  assert.match(await page.locator('#lab .lab-note').textContent(), /put away/);

  // the back arrow during a round: to Ready, and leaving the screen lets the microphone go
  await startRound(page, 'high');
  await page.click('[data-action="lab-back"]');
  assert.equal((await lab(page)).stage, 'ready');
  assert.equal(await micsOpen(page), 0, 'the back arrow lets the microphone go');
  await page.click('#lab [data-lab="teach-map"]');
  await startRound(page, 'high');
  await page.evaluate(() => { window.kqLab.labActions['lab-back'](); window.kqLab.labActions['lab-back'](); });
  await page.waitForSelector('.music-house');
  assert.equal(await micsOpen(page), 0, 'leaving the screen lets the microphone go');

  // Start over forgets them, after asking
  await intoLab(page);
  await page.click('#lab [data-lab="teach-map"]');
  await page.click('#lab [data-lab="teach-forget"]');
  assert.match(await page.locator('#lab .lab-teach-ask').textContent(), /^Forget all 12 keys\?$/);
  await page.click('#lab [data-lab="teach-forget-no"]');
  assert.equal((await teach(page)).known, 12, 'No keeps them');
  await page.click('#lab [data-lab="teach-forget"]');
  await page.click('#lab [data-lab="teach-forget-yes"]');
  await waitLab(page, () => window.kqLab.labState().teach.known === 0 && !window.kqLab.labState().teach.keeping);
  assert.equal((await lab(page)).robot, 'Okay, I forgot them all.');
  assert.deepEqual(await kept(page), [], 'gone from the tablet');
  assert.equal(await page.locator('#lab [data-lab="teach-forget"]').count(), 0);
  await ctx.close();
}

// 2. a phone: everything fits, every button is big enough
{
  const { ctx, page } = await start(PHONE, family());
  await intoHouse(page);
  await intoLab(page);
  assert.ok(await noSideScroll(page), 'no sideways scrolling');
  assert.deepEqual(await tooSmall(page, '#lab button'), [], 'buttons at least 44 px');
  await shot(page, '4-phone-ready-card', '#lab .lab-teach');
  await page.click('#lab [data-lab="teach-map"]');
  assert.ok(await noSideScroll(page), 'the map fits');
  const svg = await page.locator('#lab .lab-piano').boundingBox();
  assert.ok(svg.x >= 0 && svg.x + svg.width <= PHONE.width, `the 88 keys fit (${JSON.stringify(svg)})`);
  assert.deepEqual(await tooSmall(page, '#lab button'), [], 'tiles and buttons at least 44 px');
  await teachMiddle(page, '6-phone');
  assert.ok(await noSideScroll(page));
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, '5-phone-map-one-group');
  await page.click('#lab [data-lab="teach-forget"]');
  assert.deepEqual(await tooSmall(page, '#lab button'), [], 'Yes and No too');
  await page.click('#lab [data-lab="teach-forget-no"]');
  await page.click('#lab [data-lab="teach-back"]');
  await shot(page, '4b-phone-ready-card-12', '#lab .lab-teach');
  await ctx.close();
}

await browser.close();
site.close();
assert.deepEqual(errors, [], 'no errors on the page');
console.log(`Teach me your piano ok: ${out}`);
