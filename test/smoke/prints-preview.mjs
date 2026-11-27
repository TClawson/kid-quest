// Previews of prints and the photo wall (js/prints.js, js/printsview.js):
// 1. real rides with a bot: each perfect photo as the ride saw it, beside its print redrawn
//    from the tiny negative (and the negative's size in bytes), day and night rides
// 2. the photo wall over the bed in the buddy's house, the photo wall page, and printing from
//    the critter album
// Run: node test/smoke/prints-preview.mjs <outDir>
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';

const out = (process.argv[2] || 'previews').replace(/\/$/, '');
fs.mkdirSync(out, { recursive: true });
const day = '2026-11-11';
const site = await serve('.');
const browser = await chromium.launch();

// ---------- 1. rides: the photo, and its print ----------
const page = await browser.newPage({ deviceScaleFactor: 1 });
page.on('pageerror', (e) => console.log('ERR', e.message));
await page.goto(site.url);
const rides = await page.evaluate(async () => {
  const { PhotoTrain, GAME_SECONDS } = await import('./js/phototrain.js');
  const { botStep } = await import('./test/helpers/photobot.js');
  const { develop } = await import('./js/prints.js');
  const res = [];
  const plan = [['bg-meadow', false, 5], ['bg-fjord', false, 9], ['bg-sunset', false, 3], ['bg-ocean', true, 4], ['bg-castle', true, 6], ['bg-rainforest', false, 8]];
  for (const [map, night, seed] of plan) {
    const W = 213; const H = 133;
    const g = new PhotoTrain({ W, H, map, day: '2026-07-14', seed, night, clues: 0, onPhoto: () => 'new', kid: { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 3 } }, visitor: { name: 'B', buddy: { species: 'bear', outfit: {} } } });
    const c = document.createElement('canvas'); c.width = W * g.Z; c.height = H * g.Z; const ctx = c.getContext('2d');
    g.tap(W / 2, H / 2);
    for (let i = 0; i < (GAME_SECONDS + 20) * 30 && g.phase !== 'over'; i += 1) {
      botStep(g);
      g.step(1 / 30);
      if (g.capture) g.draw(ctx);
    }
    const perfect = g.roll.filter((s) => s.quality === 'perfect' && s.neg && s.pic).slice(0, 3);
    for (const s of perfect) {
      const print = { critter: s.critter, neg: s.neg, map: s.map, season: s.season, weather: s.weather, day: s.day };
      const p = develop(print);
      res.push({ map, night, name: s.name, pair: s.pair, bytes: JSON.stringify(s.neg).length, shot: s.pic.toDataURL(), print: p.toDataURL(), neg: s.neg, critter: s.critter, season: s.season, weather: s.weather });
    }
  }
  // an old perfect photo with no negative: staged
  for (const id of ['fjord-orca', 'meadow-owl', 'volcano-racer', 'galaxy-okapi']) {
    const p = develop({ critter: id, map: id.startsWith('fjord') ? 'bg-fjord' : id.startsWith('meadow') ? 'bg-meadow' : id.startsWith('volcano') ? 'bg-volcano' : 'bg-galaxy', season: 'winter', weather: 'snow', day: '2026-01-10' });
    res.push({ map: 'staged', name: `${id} (old photo, staged)`, shot: '', print: p.toDataURL(), bytes: 0 });
  }
  return res;
});
console.log(`${rides.length} photos; negative sizes: ${rides.filter((r) => r.bytes).map((r) => r.bytes).join(', ')} bytes`);
await page.setContent(`<body style="margin:0;background:#2a2438;color:#fff;font:14px sans-serif;width:900px">
  ${rides.map((r) => `<div style="display:flex;gap:16px;align-items:center;padding:8px 12px;border-bottom:1px solid #444">
    <div style="width:220px">${r.name}${r.night ? ' 🌙' : ''}${r.pair ? ' · PAIR' : ''}<br><small>${r.map}${r.bytes ? ` · negative ${r.bytes} bytes` : ''}</small></div>
    ${r.shot ? `<div><small>in the ride</small><br><img src="${r.shot}" style="width:288px;image-rendering:pixelated"></div>` : '<div style="width:288px"></div>'}
    <div><small>the print, redrawn</small><br><img src="${r.print}" style="width:288px;image-rendering:pixelated"></div></div>`).join('')}</body>`);
await page.screenshot({ path: `${out}/1-photo-vs-print.png`, fullPage: true });

// ---------- 1b. a night ride beside a day ride, with the map's night animal posing ----------
const night = await page.evaluate(async () => {
  const { PhotoTrain, LAYER } = await import('./js/phototrain.js');
  const { CRITTERS } = await import('./js/critters.js');
  const kid = { name: 'A', buddy: { species: 'fox', outfit: {} }, gear: { camera: 2 } };
  const out = [];
  for (const [map, night] of [['bg-meadow', false], ['bg-meadow', true], ['bg-fjord', true], ['bg-rainforest', true]]) {
    const g = new PhotoTrain({ W: 213, H: 133, map, day: '2026-07-14', seed: 4, night, kid, visitor: kid });
    g.phase = 'play'; for (let i = 0; i < 150; i += 1) g.step(1 / 15);
    g.critters = [];
    const c = CRITTERS.find((x) => x.map === map && (night ? x.night : x.rarity === 'common'));
    const k = g.spawn(c, c.how.includes('step') ? 'step' : c.how.includes('rise') ? 'rise' : c.how[0]);
    const shift = g.dist * LAYER.mid + 213 * 0.55 - k.x; k.x += shift; if (k.cover) k.cover.x += shift; for (const p of g.props) if (p.perch) p.x += shift;
    k.state = 'pose'; k.st = -9;
    const cv = document.createElement('canvas'); cv.width = 213 * g.Z; cv.height = 133 * g.Z; g.draw(cv.getContext('2d'));
    out.push({ label: `${map}${night ? ' at night: ' : ' by day: '}${c.name}`, url: cv.toDataURL() });
  }
  return out;
});
await page.setContent(`<body style="margin:0;background:#2a2438;color:#fff;font:16px sans-serif;width:880px;display:grid;grid-template-columns:1fr 1fr;gap:8px;padding:8px">${night.map((n) => `<div>${n.label}<br><img src="${n.url}" style="width:426px;image-rendering:pixelated"></div>`).join('')}</body>`);
await page.screenshot({ path: `${out}/5-night-rides.png`, fullPage: true });

// ---------- 2. the app: photo wall, printing ----------
const keep = rides.filter((r) => r.critter && !/frog/.test(r.critter));
function family() {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const kid = { id: 'kid_ava', name: 'Ava', color: '#ff6b6b', tasks: defaultTasks(), startDate: addDays(day, -40), seenUnlocks: [], seenMoves: [], spent: 0,
    owned: ['sport-camera-super', 'home-photo-frame', 'home-bed-quilt', 'home-couch', 'home-art-sunset'],
    home: { photos: 'home-photo-frame', bed: 'home-bed-quilt', couch: 'home-couch', art: 'home-art-sunset' },
    buddy: { species: 'fox', outfit: { background: 'bg-meadow' } }, gear: {} };
  kid.critterAlbum = {};
  for (const r of keep) kid.critterAlbum[r.critter] = { q: 'perfect', slots: ['portrait'], map: r.neg ? rides.find((x) => x === r).map : r.map, date: addDays(day, -3), season: r.season, weather: r.weather, neg: r.neg };
  kid.critterAlbum['fjord-orca'] = { q: 'perfect', slots: ['portrait'], map: 'bg-fjord', date: '2026-10-02', season: 'autumn', weather: 'mist' };
  const ids = Object.keys(kid.critterAlbum);
  kid.prints = {};
  for (const id of ids.slice(0, 3)) { const r = kid.critterAlbum[id]; kid.prints[id] = { ...(r.neg ? { neg: r.neg } : {}), map: r.map, season: r.season, weather: r.weather, day: r.date }; }
  kid.prints['fjord-orca'] = { map: 'bg-fjord', season: 'autumn', weather: 'mist', day: '2026-10-02' };
  kid.wall = { color: 'gold', slots: [ids[0], 'fjord-orca', ids[1], ids[2]] };
  s.kids.push(kid);
  for (let i = 1; i <= 20; i += 1) { const k = addDays(day, -i); s.log[k] = { kid_ava: { tasks: Object.fromEntries(kid.tasks.map((t) => [t.id, { status: 'done', by: 'parent' }])) } }; }
  return { s, ids };
}
const { s: st, ids } = family();
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 2 });
const app = await ctx.newPage();
app.on('pageerror', (e) => console.log('ERR', e.message));
await app.clock.install({ time: new Date(`${day}T16:30:00`) });
await app.goto(site.url);
await app.evaluate(([s, d]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify({ kid_ava: { day: d, inside: true } })); }, [st, addDays(day, -1)]);
await app.reload();
await openKid(app, '[data-action="open-kid"][data-id="kid_ava"]');
await app.clock.runFor(1500);
for (let i = 0; i < 6 && await app.locator('#modal:not([hidden])').count(); i += 1) { await app.locator('#modal [data-action="modal-close"]').first().click().catch(() => app.keyboard.press('Escape')); await app.clock.runFor(400); }
await app.clock.runFor(1500);
const view = app.locator('.house .village-view');
await view.screenshot({ path: `${out}/2-house-photo-wall.png` });
const box = await app.locator('.house .h-spot[data-spot="photos"]').boundingBox();
await app.screenshot({ path: `${out}/2b-photo-wall-close.png`, clip: { x: box.x - 40, y: box.y - 30, width: box.width + 140, height: box.height + 140 } });
await app.evaluate(() => document.querySelector('.house .h-spot[data-spot="photos"]').click());
await app.clock.runFor(3000);
await app.waitForSelector('#modal .photo-wall');
await app.locator('#modal .modal-card').screenshot({ path: `${out}/3-photo-wall-page.png` });
await app.evaluate(() => document.querySelector('#modal [data-action="photo-slot"][data-slot="1"]').click());
await app.clock.runFor(300);
await app.locator('#modal .modal-card').screenshot({ path: `${out}/3b-photo-wall-pick.png` });
// printing from the album
await app.evaluate(() => document.querySelector('#modal [data-action="modal-close"]').click());
await app.evaluate((id) => { const b = document.createElement('button'); b.dataset.action = 'critter-page'; b.dataset.critter = id; document.body.appendChild(b); b.click(); }, ids[ids.length - 2]);
await app.clock.runFor(300);
await app.locator('#modal .modal-card').screenshot({ path: `${out}/4-album-page-print.png` });
await app.evaluate(() => document.querySelector('#modal [data-action="print-ask"]').click());
await app.clock.runFor(300);
await app.locator('#modal .modal-card').screenshot({ path: `${out}/4b-print-ask.png` });
await browser.close();
site.close();
console.log('done');
