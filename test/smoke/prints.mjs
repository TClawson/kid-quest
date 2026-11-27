// Browser test for prints and the photo wall (js/prints.js, js/printsview.js) and the secret
// animals (js/critters.js):
// - a perfect photo keeps a small negative (under 1 KB) that redraws as a print the frame's size,
//   with every animal in the frame; an old perfect photo without one is staged
// - printing costs 20 coins, needs the gallery frame up, hangs the print in the first empty place;
//   a full wall asks which to replace; moving a print is free; the frame's color changes
// - the night animals never come on a day ride and do come on night rides; the very rare ones are rare
// - in the app: the photo wall shows over the bed, opens its page, and the album prints
// Run: node test/smoke/prints.mjs
import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const site = await serve('.');
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(site.url);
  const r = await page.evaluate(async () => {
    const { PhotoTrain, FRAME, GAME_SECONDS } = await import('./js/phototrain.js');
    const { botStep } = await import('./test/helpers/photobot.js');
    const P = await import('./js/prints.js');
    const { CRITTERS } = await import('./js/critters.js');
    const kidG = { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 3 } };
    // a ride with the bot until a perfect photo
    const shots = [];
    for (const seed of [5, 9, 12]) {
      const g = new PhotoTrain({ W: 213, H: 133, map: 'bg-meadow', day: '2026-07-14', seed, onPhoto: () => 'new', kid: kidG, visitor: kidG });
      const c = document.createElement('canvas'); c.width = 213 * g.Z; c.height = 133 * g.Z; const ctx = c.getContext('2d');
      g.tap(100, 60);
      for (let i = 0; i < (GAME_SECONDS + 20) * 30 && g.phase !== 'over'; i += 1) {
        botStep(g);
        g.step(1 / 30); if (g.capture) g.draw(ctx);
      }
      shots.push(...g.roll.filter((s) => s.quality === 'perfect'));
    }
    const s = shots[0];
    const print = { critter: s.critter, neg: s.neg, map: s.map, season: s.season, weather: s.weather, day: s.day };
    const dev = P.develop(print);
    const staged = P.develop({ critter: 'fjord-orca', map: 'bg-fjord', season: 'winter', weather: 'snow', day: '2026-01-10' });
    // a two-animal negative redraws both
    const two = { ...s.neg, o: [{ ...s.neg.k, id: 'meadow-robin', x: s.neg.k.x + 6 }] };
    const devTwo = P.develop({ ...print, neg: two });
    const differ = (a, b) => { const x = a.getContext('2d').getImageData(0, 0, a.width, a.height).data; const y = b.getContext('2d').getImageData(0, 0, b.width, b.height).data; let n = 0; for (let i = 0; i < x.length; i += 4) if (x[i] !== y[i] || x[i + 1] !== y[i + 1]) n += 1; return n; };
    // printing and the wall
    const kid = { owned: ['home-photo-frame'], home: {}, spent: 0, critterAlbum: { [s.critter]: { q: 'perfect', map: s.map, neg: s.neg, date: '2026-07-14' }, 'meadow-deer': { q: 'good', map: 'bg-meadow' }, 'fjord-orca': { q: 'perfect', map: 'bg-fjord' } } };
    const noFrame = P.hasFrame(kid);
    kid.home.photos = 'home-photo-frame';
    const okGood = P.canPrint(kid, 'meadow-deer');
    P.printPhoto(kid, s.critter); P.printPhoto(kid, 'fjord-orca');
    const wall1 = P.wallOf(kid).slots.slice();
    P.hangPrint(kid, 3, s.critter);
    const wall2 = P.wallOf(kid).slots.slice();
    P.setFrameColor(kid, 'black');
    // night animals: never by day; on night rides they come
    const count = (night, n) => { let nightA = 0; let secret = 0; for (let i = 0; i < n; i += 1) { const g = new PhotoTrain({ W: 213, H: 133, map: ['bg-meadow', 'bg-fjord', 'bg-castle'][i % 3], day: '2026-07-14', seed: 100 + i, night, kid: kidG, visitor: kidG }); g.phase = 'play'; const seen = new Set(); const sp = g.spawn.bind(g); g.spawn = (c, h) => { seen.add(c); return sp(c, h); }; while (g.phase === 'play') g.step(1 / 15); if ([...seen].some((c) => c.night)) nightA += 1; if ([...seen].some((c) => c.rarity === 'secret' && !c.night)) secret += 1; } return { nightA, secret }; };
    return {
      perfect: shots.length, negBytes: JSON.stringify(s.neg).length, devW: dev.width, devH: dev.height, frameW: Math.round(s.neg.fr[2] * 2 * (s.neg.z || 1)), frameH: Math.round(s.neg.fr[3] * 2 * (s.neg.z || 1)), normalW: FRAME.w * 2,
      stagedW: staged.width, twoDiffers: differ(dev, devTwo), noFrame, okGood, spent: kid.spent, wall1, wall2, color: kid.wall.color,
      day: count(false, 30), night: count(true, 30),
      secrets: CRITTERS.filter((c) => c.rarity === 'secret').map((c) => [c.map, Boolean(c.night)]),
    };
  });
  assert.ok(r.perfect > 0, 'the bot took a perfect photo');
  assert.ok(r.negBytes < 1000, `a negative is small (${r.negBytes} bytes)`);
  assert.deepEqual([r.devW, r.devH], [r.frameW, r.frameH], 'a print is the frame\'s size');
  assert.equal(r.stagedW, r.normalW, 'an old photo is staged');
  assert.ok(r.twoDiffers > 20, 'a second animal in the negative shows in the print');
  assert.equal(r.noFrame, false, 'no frame until it hangs');
  assert.equal(r.okGood, false, 'only perfect photos print');
  assert.equal(r.spent, 40, 'two prints, 20 coins each');
  assert.equal(r.wall1.filter(Boolean).length, 2, 'prints hang in the empty places');
  assert.equal(r.wall2[3], r.wall1[0], 'a print moves to another place');
  assert.equal(r.wall2[0], null, '... and leaves its old one');
  assert.equal(r.color, 'black');
  assert.equal(r.day.nightA, 0, 'no night animals by day');
  assert.ok(r.night.nightA >= 8, `night animals come on night rides (${r.night.nightA} of 30)`);
  assert.ok(r.day.secret <= 6, `very rare animals are rare (${r.day.secret} of 30)`);
  const maps = new Set(r.secrets.map(([m]) => m));
  assert.equal(maps.size, 10, 'secret animals on every map');
  for (const m of maps) assert.deepEqual(r.secrets.filter(([x]) => x === m).map(([, n]) => n).sort(), [false, true], `${m}: one night animal and one very rare`);
  assert.deepEqual(errors, []);
  await page.close();

  // ---------- in the app ----------
  const day = '2026-11-11';
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234'); s.settings.sound = false; s.settings.questView = 'village';
  const kid = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -40), seenUnlocks: [], seenMoves: [], spent: 0,
    owned: ['home-photo-frame'], home: { photos: 'home-photo-frame' }, buddy: { species: 'fox', outfit: { background: 'bg-meadow' } },
    critterAlbum: { 'fjord-orca': { q: 'perfect', slots: ['portrait'], map: 'bg-fjord', date: '2026-10-02', season: 'autumn', weather: 'mist' } } };
  s.kids.push(kid);
  for (let i = 1; i <= 10; i += 1) s.log[addDays(day, -i)] = { kid_ava: { tasks: Object.fromEntries(kid.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } };
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const app = await ctx.newPage();
  app.on('pageerror', (e) => errors.push(e.message));
  await app.clock.install({ time: new Date(`${day}T16:30:00`) });
  await app.goto(site.url);
  await app.evaluate(([st, d]) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); localStorage.setItem('kidquest.house', JSON.stringify({ kid_ava: { day: d, inside: true } })); }, [s, addDays(day, -1)]);
  await app.reload();
  await openKid(app, '[data-action="open-kid"][data-id="kid_ava"]');
  await app.clock.runFor(1500);
  for (let i = 0; i < 6 && await app.locator('#modal:not([hidden])').count(); i += 1) { await app.locator('#modal [data-action="modal-close"]').first().click().catch(() => {}); await app.clock.runFor(400); }
  assert.equal(await app.locator('.house .h-spot[data-spot="photos"]').count(), 1, 'the photo wall is in the house');
  assert.equal(await app.locator('.house .h-print').count(), 0, 'no prints yet');
  // print the orca from its album page
  await app.evaluate(() => { const b = document.createElement('button'); b.dataset.action = 'critter-page'; b.dataset.critter = 'fjord-orca'; document.body.appendChild(b); b.click(); });
  await app.waitForSelector('#modal [data-action="print-ask"]');
  await app.click('#modal [data-action="print-ask"]');
  await app.click('#modal [data-action="print-do"]');
  await app.clock.runFor(800);
  const after = await app.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0]);
  assert.equal(after.spent, 20, 'the print cost 20 coins');
  assert.deepEqual(after.wall.slots, ['fjord-orca', null, null, null]);
  assert.equal(await app.locator('.house .h-print').count(), 1, 'the print hangs on the wall');
  await app.evaluate(() => document.querySelector('.house .h-spot[data-spot="photos"]').click());
  await app.clock.runFor(3000);
  await app.waitForSelector('#modal .photo-wall');
  assert.equal(await app.locator('#modal .pw-slot img').count(), 1);
  // ---------- villager photo requests in the village (photoreq.js) ----------
  const app2 = await ctx.newPage();
  app2.on('pageerror', (e) => errors.push(e.message));
  await app2.clock.install({ time: new Date(`${day}T16:30:00`) });
  await app2.goto(site.url);
  const kinds = await app2.evaluate(async () => (await import('./js/villageart.js')).VILLAGER_KINDS);
  const fox = { critter: 'meadow-fox', map: 'bg-meadow', season: 'autumn', weather: 'sunny', day: '2026-11-10' };
  const kid2 = { ...kid, id: 'kid_bo', name: 'Bo', critterAlbum: { 'meadow-deer': { q: 'good', map: 'bg-meadow' }, 'meadow-fox': { q: 'perfect', map: 'bg-meadow' }, 'meadow-squirrel': { q: 'good', map: 'bg-meadow' } },
    photoReqs: { open: [], done: 1, given: Object.fromEntries(kinds.map((k) => [k, fox])) } };
  const s2 = { ...s, kids: [kid2], log: {} };
  await app2.evaluate(([st, d]) => { localStorage.setItem('kidquest.v1', JSON.stringify(st)); localStorage.setItem('kidquest.house', JSON.stringify({ kid_bo: { day: d, inside: false, place: 'out' } })); }, [s2, day]);
  await app2.reload();
  await openKid(app2, '[data-action="open-kid"][data-id="kid_bo"]');
  await app2.clock.runFor(1500);
  for (let i = 0; i < 6 && await app2.locator('#modal:not([hidden])').count(); i += 1) { await app2.locator('#modal [data-action="modal-close"]').first().click().catch(() => {}); await app2.clock.runFor(400); }
  await app2.waitForSelector('.village .villager[data-vid]');
  assert.equal(await app2.locator('.village .villager .v-ask').count(), 1, 'a villager asks for a photo');
  assert.ok(await app2.locator('.village .villager .v-given img').count() >= 1, 'a photo given to a villager hangs beside them');
  const reqs = await app2.evaluate(() => JSON.parse(localStorage.getItem('kidquest.v1')).kids[0].photoReqs);
  assert.equal(reqs.open.length, 1);
  assert.ok(['meadow-deer', 'meadow-fox', 'meadow-squirrel'].includes(reqs.open[0].c), 'it asks for an animal the kid has found');
  if (process.env.SHOTS) {
    await app2.evaluate(() => { const v = document.querySelector('.village .villager .v-ask').closest('.villager'); v.click(); });
    await app2.clock.runFor(2500);
    await app2.screenshot({ path: `${process.env.SHOTS}/village-requests.png` });
  }
  assert.deepEqual(errors, []);
  console.log('prints: ok');
} finally {
  await browser.close();
  site.close();
}
