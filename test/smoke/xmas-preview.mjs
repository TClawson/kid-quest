// Previews of the December tree in the buddy's house (the real house screen, js/house.js): the
// tree with a few ornaments, about half, and full with its star and the siblings' presents under
// it; the lights' three frames; a present shaken; the tree by the couch in a house with a
// turntable; the ornament book (and a star tapped onto the tree); the shop's Holiday tab (and no
// holiday outfits for sale in November or January); and the event's art sheets (xmas-house-sheet.html).
// Run: node test/smoke/xmas-preview.mjs <outDir> [name,name,...]
// (needs `ln -s /opt/node-tools/node_modules node_modules` when node_modules is missing)
import { chromium } from 'playwright';
import fs from 'node:fs';
import { serve } from '../helpers/serve.mjs';
import { emptyState, defaultTasks, addDays, fallbackHash } from '../../js/logic.js';
import { openKid } from '../helpers/open-kid.mjs';
import { ORNAMENTS } from '../../js/xmas.js';
import { xtreeAt } from '../../js/houseart.js';
import { TURNTABLE_ID } from '../../js/furniture.js';

const out = (process.argv[2] || 'previews/xmas').replace(/\/$/, '');
const only = process.argv[3] ? process.argv[3].split(',') : null;
fs.mkdirSync(out, { recursive: true });
const day = '2026-12-14';
const want = (k) => !only || only.includes(k);

// the order a kid finds ornaments in: a few maps first (the maps the kid plays most), then the rest
const ORDER = (() => {
  const byMap = (m) => ORNAMENTS.filter((o) => o.map === m).map((o) => o.id);
  const first = ['bg-meadow', 'bg-fjord', 'bg-ocean', 'bg-rainbow', 'bg-space', 'bg-castle', 'bg-sunset', 'bg-volcano', 'bg-rainforest', 'bg-galaxy'];
  const lists = first.map(byMap);
  const outl = [];
  for (let r = 0; r < 4; r += 1) for (const l of lists) if (l[r]) outl.push(l[r]);
  return outl;
})();

/**
 * The family on one tablet in December. o: { found: how many ornaments Ava has, star: her star
 * topper, gifts: presents under her tree (from her siblings), outfit: her fox's outfit }
 */
function family(o = {}) {
  const s = emptyState();
  s.settings.pinHash = fallbackHash('kidquest:1234');
  s.settings.sound = false;
  s.settings.questView = 'village';
  const mk = (id, name, color, species, extra = {}) => ({ id, name, color, tasks: defaultTasks(), startDate: addDays(day, -60), seenUnlocks: [], seenMoves: [], owned: [], spent: 0, buddy: { species, outfit: { background: 'bg-meadow' } }, ...extra });
  const furn = ['home-bed-quilt', 'home-table-round-blue-checks', 'home-couch-green-stripes', 'home-chair-cozy', 'home-hammock', 'home-lamp', 'home-rug-round-purple-stars', 'home-art-sunset'];
  s.kids.push(
    mk('kid_ava', 'Ava', '#ff6b6b', 'fox', {
      owned: ['sport-soccer-good', 'sport-rod-super', ...furn, ...(o.turntable ? [TURNTABLE_ID] : [])],
      home: { bed: furn[0], table: furn[1], couch: furn[2], chair: furn[3], corner: furn[4], lamp: furn[5], rug: furn[6], art: furn[7], ...(o.turntable ? { music: TURNTABLE_ID } : {}) },
      buddy: { species: 'fox', outfit: { background: 'bg-meadow', ...(o.outfit || { hat: 'hat-cap' }) } },
      // a map's star is won by finding its 4 ornaments; a star in found is the one picked at door 25
      xmas: { found: o.list || ORDER.slice(0, o.found ?? 6), star: o.star || null, tinsel: o.tinsel || 0 },
    }),
    mk('kid_ben', 'Ben', '#4dabf7', 'bear'),
    mk('kid_cy', 'Cy', '#69db7c', 'cat'),
    mk('kid_dee', 'Dee', '#da77f2', 'dino'),
  );
  // presents from her siblings (xmasgifts.js): kept on her, kid.xmasGifts
  s.kids[0].xmasGifts = Object.fromEntries((o.gifts || []).map((g) => {
    const giver = s.kids.find((k) => k.id === g.from);
    const id = `2026-${g.from}-kid_ava`;
    return [id, { id, from: g.from, fromName: giver.name, fromBuddy: giver.buddy.species, year: '2026', kind: 'seed', item: 'seed-tulip', n: 3, cost: 20, shape: g.shape, paper: g.paper, at: '2026-12-01' }];
  }));
  const ava = s.kids[0];
  const done = (key, tasks) => { s.log[key] ||= {}; s.log[key].kid_ava ||= { tasks: {} }; for (const t of tasks) s.log[key].kid_ava.tasks[t.id] = { status: 'done', by: 'parent' }; };
  for (let i = 0; i <= 30; i += 1) done(addDays(o.date || day, -i), ava.tasks.filter((t) => t.period !== 'exercise'));
  return s;
}

const site = await serve('.');
const browser = await chromium.launch();
const shots = [];
const VIEW = { width: 1000, height: 640 };

async function open(st, { time = '10:30', viewport = VIEW, date = day } = {}) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('ERR', e.message));
  page.on('console', (m) => { if (m.type() === 'error') console.log('console', m.text()); });
  await page.clock.install({ time: new Date(`${date}T${time}:00`) });
  await page.goto(site.url);
  await page.evaluate(([s, house]) => { localStorage.setItem('kidquest.v1', JSON.stringify(s)); localStorage.setItem('kidquest.house', JSON.stringify(house)); }, [st, { kid_ava: { day: addDays(date, -1), inside: false } }]);
  await page.reload();
  await openKid(page, '[data-action="open-kid"][data-id="kid_ava"]');
  await page.clock.runFor(1500);
  await closeModals(page);
  await page.locator('.house').scrollIntoViewIfNeeded();
  await page.clock.runFor(1200);
  return { ctx, page };
}
async function closeModals(page) {
  for (let i = 0; i < 6 && await page.locator('#modal:not([hidden])').count(); i += 1) {
    const close = page.locator('#modal [data-action="modal-close"]');
    if (await close.count()) await close.first().click(); else await page.keyboard.press('Escape');
    await page.clock.runFor(400);
  }
}
const tap = (page, sel) => page.evaluate((s) => document.querySelector(s).click(), sel);
// one lights frame held still (the others hidden), so a screenshot shows that frame
const holdLights = (page, f) => page.evaluate((n) => {
  document.querySelectorAll('.h-lights canvas').forEach((c, i) => { c.style.animation = 'none'; c.style.opacity = i === n ? '1' : '0'; });
}, f);
async function shotView(page, name, clip = null) {
  const el = page.locator('.house .village-view');
  const box = await el.boundingBox();
  const path = `${out}/${name}.png`;
  if (clip) {
    // a box in room pixels, through the camera: the world's transform says where the room is
    const r = await page.evaluate(([x, y, w, h]) => {
      const room = document.querySelector('.house .house-room').getBoundingClientRect();
      const k = room.width / 320;
      return { x: room.left + x * k, y: room.top + y * k, width: w * k, height: h * k };
    }, clip);
    // a close-up shows the room only: the screen's bars and buttons over it are hidden for it
    await page.evaluate(() => document.body.classList.add('xmas-close'));
    await page.addStyleTag({ content: 'body.xmas-close .house > :not(.village-view), body.xmas-close .h-sign, body.xmas-close .h-gbtn, body.xmas-close .house-hud, body.xmas-close .v-hud { visibility: hidden !important; }' });
    await page.screenshot({ path, clip: r });
    await page.evaluate(() => document.body.classList.remove('xmas-close'));
  } else await page.screenshot({ path, clip: box });
  shots.push(path);
  return path;
}
// close-ups of the tree (with the presents under it), in room pixels: the tree stands under the
// window, or in front of the couch in a house with a turntable (houseart.js xtreeAt)
const treeClip = (L, pad = 14) => { const t = xtreeAt({ music: L.turntable }); return [Math.max(0, t.x - pad), Math.max(0, t.y - 6), 40 + pad * 2 + 26, 90]; }; // and its tag, on the right
// walk the buddy to the tree and wait there, its tag showing
async function toTree(page, book = false) {
  await tap(page, '.h-spot[data-spot="xtree"]');
  await page.clock.runFor(4000);
  if (!book) await closeModals(page);
  await page.clock.runFor(300);
}

const LEVELS = [
  { name: 'room-tree-few', found: 6, caption: 'A few ornaments (6 of 40): the tree stands against the back wall under the window, between the bed and the shelf, so every chore spot stays where it is. Its lights are on; the tag shows when the buddy is near; tap the tree for the ornament book.' },
  { name: 'room-tree-half', found: 20, gifts: [{ from: 'kid_ben', shape: 'tall', paper: 'candy' }], outfit: { hat: 'hat-antlers' }, caption: 'About half (20 of 40): the gold bead garland, and a present from Ben\'s bear under the tree (its tag shows when you tap it). Ava\'s fox wears the reindeer antlers.' },
  {
    name: 'room-tree-full', found: 40, star: 'star-fjord',
    gifts: [{ from: 'kid_ben', shape: 'tall', paper: 'candy' }, { from: 'kid_cy', shape: 'small', paper: 'stars' }, { from: 'kid_dee', shape: 'round', paper: 'plaid' }],
    outfit: { hat: 'hat-santa', neck: 'neck-knitscarf-green', hand: 'hand-mittens' },
    caption: 'Full (40 of 40): the Snowflake star on top, outlined in its own dark blue with a warm glow; about 12 bulbs and one gold bead garland, so the baubles stay readable. Three presents from the siblings (tall candy stripes, small starry night, round cozy plaid). The fox wears the Santa hat, green knit scarf and mittens.',
  },
  {
    name: 'room-tree-turntable', found: 32, star: 'star-meadow', turntable: true,
    gifts: [{ from: 'kid_cy', shape: 'small', paper: 'stars' }],
    outfit: { hat: 'hat-elf', neck: 'neck-knitscarf' },
    caption: 'A house with the turntable (it stands where the tree would): the tree moves in front of the couch instead. 32 of 40 with the Meadow star on top, won by finding all 4 Meadow ornaments. The fox wears the elf hat and the red knit scarf (cream stripes so it shows on a fox).',
  },
];
for (const L of LEVELS) {
  if (!want(L.name)) continue;
  const { ctx, page } = await open(family(L));
  await toTree(page);
  await holdLights(page, 0);
  // the whole house screen, and beside it the tree's corner close up
  const view = await shotView(page, `.${L.name}-view`);
  const close = await shotView(page, `.${L.name}-close`, treeClip(L));
  await pair(L.name, view, close, L.caption);
  if (L.found === 40) {
    // the lights' three frames, close up (the tree and its presents)
    const files = [];
    for (const f of [0, 1, 2]) { await holdLights(page, f); files.push(await shotView(page, `.lights-${f}`, treeClip(L, 8))); }
    await strip('room-tree-lights', files, ['Lights 1', 'Lights 2', 'Lights 3'], 1200);
    // tap a present: it wiggles and rattles, then says who it's from
    await tap(page, '.h-spot.h-gift[data-gift="1"]');
    await page.clock.runFor(1600);
    await shotView(page, 'room-gift-tap');
  }
  await ctx.close();
}

// the house screen with a close-up of the tree beside it, the same height, and a caption
async function pair(name, view, close, caption) {
  const page = await browser.newPage({ viewport: { width: 1840, height: 400 }, deviceScaleFactor: 1 });
  const src = (f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`;
  await page.setContent(`<body style="margin:0;background:#2a1e2a;font:600 24px sans-serif;color:#fff8e7"><div style="display:flex;gap:14px;padding:14px;align-items:flex-start"><img src="${src(view)}" style="height:700px;display:block;image-rendering:pixelated"><img src="${src(close)}" style="height:700px;display:block;image-rendering:pixelated;border:3px solid #ffe27a;border-radius:6px"></div><div style="padding:0 16px 14px">${caption}</div></body>`);
  await page.waitForTimeout(200);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
  await page.close();
  fs.rmSync(view, { force: true }); fs.rmSync(close, { force: true });
}

// the ornament book: walk to the tree, and it opens (a kid part way through December)
if (want('ornament-book')) {
  // the Meadow's 4 found win its star; the Fjord star is the one picked at door 25
  const list = ['orn-acorn', 'orn-toadstool', 'orn-oak', 'orn-owl', 'orn-moose', 'orn-puffin', 'orn-aurora', 'star-fjord',
    'orn-pearl', 'orn-clown', 'orn-lolly', 'orn-sheep', 'orn-unicorn', 'orn-rocket', 'orn-shield', 'orn-crown', 'orn-shell', 'orn-pirate',
    'orn-lava', 'orn-frog', 'orn-sloth', 'orn-planet'];
  const { ctx, page } = await open(family({ list, star: 'star-fjord', tinsel: 3 }), { viewport: { width: 1000, height: 1400 } });
  await toTree(page, true);
  await page.waitForSelector('#modal .ornbook');
  await page.addStyleTag({ content: '#modal .modal-card { max-height: none !important; overflow: visible !important; } #modal { overflow: auto; align-items: flex-start !important; }' });
  await page.clock.runFor(700);
  const el = page.locator('#modal .modal-card');
  const h = await el.evaluate((n) => n.scrollHeight);
  await page.setViewportSize({ width: 1000, height: h + 120 });
  await page.clock.runFor(300);
  await el.screenshot({ path: `${out}/ornament-book.png` });
  shots.push(`${out}/ornament-book.png`);
  // tap the Meadow's star: it goes on top of the tree (and stays there)
  await page.locator('#modal [data-action="tree-star"][data-star="star-meadow"]').click();
  await page.clock.runFor(400);
  const top = await page.evaluate(() => ({
    book: document.querySelector('#modal .ob-star.on-top')?.dataset.star,
    saved: JSON.parse(localStorage.getItem('kidquest.v1')).kids[0].xmas.star,
  }));
  console.log(`tree-star: on top in the book ${top.book}, saved ${top.saved}`);
  await ctx.close();
}

// the shop: in December a Holiday tab sells the holiday outfits; the rest of the year there is no
// Holiday tab and they are not in the other tabs either (unless the buddy owns one already)
const act = (page, action, data = {}) => page.evaluate(([a, d]) => {
  const b = document.createElement('button'); b.dataset.action = a; Object.assign(b.dataset, d); b.hidden = true;
  document.body.append(b); b.click(); b.remove();
}, [action, data]);
if (want('shop-holiday')) {
  const { ctx, page } = await open(family({ found: 6, outfit: { hat: 'hat-santa', neck: 'neck-knitscarf' } }), { viewport: { width: 1000, height: 900 } });
  await act(page, 'wardrobe');
  await page.clock.runFor(600);
  await act(page, 'wardrobe-slot', { slot: 'holiday' });
  await page.clock.runFor(800);
  const n = await page.locator('.wardrobe .items .item').count();
  const tab = await page.locator('.shop-tabs [data-slot="holiday"]').count();
  console.log(`December: Holiday tab ${tab}, ${n} items in it`);
  await page.locator('.screen.wardrobe').screenshot({ path: `${out}/shop-holiday.png` });
  shots.push(`${out}/shop-holiday.png`);
  await ctx.close();
  // 20 November and 2 January: no Holiday tab, no holiday hats for sale; an owned Santa hat still shows
  for (const date of ['2026-11-20', '2027-01-02']) {
    const st = family({ found: 0, date });
    st.kids[0].owned.push('hat-santa');
    const o2 = await open(st, { date, viewport: { width: 1000, height: 900 } });
    await act(o2.page, 'wardrobe');
    await o2.page.clock.runFor(600);
    await act(o2.page, 'wardrobe-slot', { slot: 'hat' });
    await o2.page.clock.runFor(400);
    const r = await o2.page.evaluate(() => ({
      tab: document.querySelectorAll('.shop-tabs [data-slot="holiday"]').length,
      hats: [...document.querySelectorAll('.wardrobe .items .item')].map((b) => b.dataset.id).filter((id) => /santa|elf|antlers|earmuffs|knitscarf|xmas|mittens/.test(id)),
    }));
    await act(o2.page, 'wardrobe-slot', { slot: 'holiday' });
    await o2.page.clock.runFor(400);
    const fallback = await o2.page.evaluate(() => document.querySelector('.shop-tabs .tabs.sub button.on')?.dataset.slot);
    await act(o2.page, 'wardrobe-item', { id: 'hat-elf' });
    await o2.page.clock.runFor(400);
    const buy = await o2.page.locator('#modal:not([hidden]) [data-action="buy-confirm"]').count();
    console.log(`${date}: Holiday tab ${r.tab}, holiday items in Hats: ${r.hats.join(', ') || 'none'}, holiday slot falls back to ${fallback}, elf hat buy dialog ${buy}`);
    await o2.ctx.close();
  }
}

// a strip of pictures side by side, with labels, as one PNG
async function strip(name, files, labels, width = 1600) {
  const page = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: 1 });
  const imgs = files.map((f) => `data:image/png;base64,${fs.readFileSync(f).toString('base64')}`);
  await page.setContent(`<body style="margin:0;background:#2a1e2a;font:bold 26px sans-serif;color:#fff8e7"><div style="display:flex;gap:16px;padding:16px;align-items:flex-start">${imgs.map((src, i) => `<figure style="margin:0;flex:1;text-align:center"><img src="${src}" style="width:100%;display:block;image-rendering:pixelated"><figcaption style="margin-top:8px">${labels[i]}</figcaption></figure>`).join('')}</div></body>`);
  await page.waitForTimeout(200);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
  await page.close();
  for (const f of files) if (f.includes('/.')) fs.rmSync(f, { force: true });
}

// the art sheets
const sheet = async (name, query, width = 1500, scale = 2) => {
  if (!want(name)) return;
  const page = await browser.newPage({ viewport: { width, height: 400 }, deviceScaleFactor: scale });
  page.on('pageerror', (e) => console.log('ERR', e.message));
  await page.goto(`${site.url}test/smoke/xmas-house-sheet.html?${query}`);
  await page.waitForSelector('body[data-ready]', { timeout: 15000 });
  await page.waitForTimeout(300);
  const path = `${out}/${name}.png`;
  await page.screenshot({ path, fullPage: true });
  shots.push(path);
  await page.close();
};
await sheet('ornaments-sheet', 'mode=ornaments&scale=4', 1700);
await sheet('gifts-sheet', 'mode=gifts&scale=5', 1500);
await sheet('outfits-grid', 'mode=outfits&scale=4', 1700);

// the contact sheet: everything above, small, with labels
if (!only || want('sheet')) {
  const items = [
    ['room-tree-few', 'Tree with a few ornaments, under the window'], ['room-tree-half', 'About half, a present under it'], ['room-tree-full', 'Full, with its star and presents'],
    ['room-tree-lights', 'Lights: three frames'], ['room-gift-tap', 'Tap a present: from Cy\'s cat, opens Christmas morning'], ['room-tree-turntable', 'With a turntable: the tree by the couch'],
    ['ornament-book', 'Ornament book: each map\'s star under its 4'], ['shop-holiday', 'Shop: the Holiday tab (December only)'],
    ['ornaments-sheet', '40 ornaments + 10 star toppers'], ['gifts-sheet', 'Presents: shapes, papers, tag, shake, unwrap'], ['outfits-grid', 'Holiday outfits on every buddy'],
  ].filter(([f]) => fs.existsSync(`${out}/${f}.png`));
  const page = await browser.newPage({ viewport: { width: 2100, height: 600 }, deviceScaleFactor: 1 });
  const src = (f) => `data:image/png;base64,${fs.readFileSync(`${out}/${f}.png`).toString('base64')}`;
  await page.setContent(`<body style="margin:0;background:#2a1e2a;color:#fff8e7;font:600 22px sans-serif;padding:18px">
    <div style="font:800 38px sans-serif;color:#ffe27a;margin:0 0 14px">Christmas in the buddy's house · tree, ornaments, presents, outfits</div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;align-items:start">${items.map(([f, t]) => `<figure style="margin:0;background:#3a2838;border-radius:8px;padding:8px"><img src="${src(f)}" style="width:100%;max-height:560px;object-fit:contain;object-position:top;display:block;image-rendering:auto"><figcaption style="margin-top:6px">${t}</figcaption></figure>`).join('')}</div></body>`);
  await page.waitForTimeout(300);
  await page.screenshot({ path: `${out}/sheet.png`, fullPage: true });
  shots.push(`${out}/sheet.png`);
  await page.close();
}

await browser.close();
site.close();
console.log(shots.filter((s) => !s.includes('/.')).join('\n'));
