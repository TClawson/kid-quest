// Paints the quest map: a 16-bit top-down scene behind the stops. Each Places background has
// its own map theme (Forest Village for the meadow, a beach for the sunset, and so on).
// The stops, labels and buddy stay as HTML on top; this only draws the land on a <canvas>.
// Moving things (fish, dragons, saucers...) are in maplife.js.
// One art pixel is SCALE screen pixels, so the scene stays chunky at any screen size.

import { startMapLife } from './maplife.js';

const SCALE = 4;
const OUT = '#2a1838';

// ---------- sprites (letter grids; K is the outline, . is see-through) ----------

const TREE = ['..KKKK..', '.KGGGgK.', 'KGgGGGGK', 'KGGGGgGK', 'KgGGGGdK', '.KdGGdK.', '..KKKK..', '...TT...', '...TT...'];
const TREE_PAL = { G: '#3c9a3c', g: '#6ccf5f', d: '#256b2b', T: '#7a4a26' };
const BUSH = ['.KKK.', 'KgGGK', 'KGGdK', '.KKK.'];
const ROCK = ['.KKK.', 'KLLLK', 'KLdLK', '.KKK.'];
const ROCK_PAL = { L: '#adb5bd', d: '#868e96' };
const PALM = [
  '.KK.....KK.',
  'KggK.K.KggK',
  '.KgGKgKGgK.',
  '..KGGGGGK..',
  '.KgKKTKKgK.',
  'KgK..T..KgK',
  '.K...T...K.',
  '.....T.....',
  '....TT.....',
  '....TT.....',
];
const PALM_PAL = { G: '#2f9e44', g: '#8ce99a', T: '#a0612f' };
const KELP = ['..K....', '.KgK...', '.KGK.K.', '..KGKgK', '..KGGK.', '.KgGK..', '.KGK...', '..KGK..', '..KGK..', '.KGGK..'];
const KELP_PAL = { G: '#2b8a3e', g: '#69db7c' };
const CORAL = ['.K.K.K.', 'KcKcKcK', 'KcKcKcK', '.KcccK.', '..KcK..', '.KcccK.'];
const BOULDER = ['..KKKK..', '.KLLLLK.', 'KLlLLLdK', 'KLLLLdLK', 'KLLdLLdK', '.KdLLdK.', '..KKKK..'];
const CRATER = ['.ddddd.', 'dDDDDDl', 'dDDDDDl', '.lllll.'];
const CRYSTAL = ['..K..', '.KcK.', '.KcK.', 'KcCcK', 'KcCcK', '.KKK.'];
const SPIRE = ['...K....', '..KcK.K.', '..KcKKcK', '.KcCcKcK', '.KcCcKCK', 'KcCcCcCK', 'KcCcCcCK', '.KKKKKK.'];
const CANDY = ['..K..', '.KcK.', 'KcWcK', '.KcK.', '..W..', '..W..'];

const HOUSE = [
  '...KKKK...',
  '..KRRRRK..',
  '.KRrRRRRK.',
  'KRRRRRRRRK',
  'KKKKKKKKKK',
  '.KWWWWWWK.',
  '.KWBWWDWK.',
  '.KWWWWDWK.',
  '.KKKKKKKK.',
];
const HUT = [
  '....KK....',
  '...KRRK...',
  '..KRrRRK..',
  '.KRRRRrRK.',
  'KRrRRRRRRK',
  'KKKKKKKKKK',
  '.KWWWWWWK.',
  '.KWWWWDWK.',
  '.KKKKKKKK.',
];
const DOME = [
  '...KKKK...',
  '..KRrRRK..',
  '.KRrRRRRK.',
  'KRRRRRRRRK',
  'KRRRRRRRRK',
  'KKKKKKKKKK',
  '.KWBWWDWK.',
  '.KWWWWDWK.',
  '.KKKKKKKK.',
];
const MUSHROOM = [
  '...KKKK...',
  '..KRwRRK..',
  '.KRRRRwRK.',
  'KRwRRRRRRK',
  'KKKKKKKKKK',
  '..KWWWWK..',
  '..KWBWDK..',
  '..KWWWDK..',
  '..KKKKKK..',
];

// ---------- themes ----------

const temple = (pal) => (px, cx, cy) => drawTemple(px, cx, cy, pal);

/**
 * One theme per Places background. Colors are art-pixel colors; sprites are drawn with pal.
 * walls: sprites down both sides (or a function), scenery: clumps in the open, houses at the start,
 * river: the band the bridge crosses before after school, goal: what stands around the treasure,
 * pond: what floats on the village fishing ponds (see POND_EXTRAS), pondColors: pond colors if not the river's.
 */
export const MAP_THEMES = {
  'bg-meadow': {
    name: 'Forest Village',
    ground: ['#5cbd52', '#4aa842', '#7bd66b'],
    walls: [[TREE, TREE_PAL]],
    scenery: [[BUSH, TREE_PAL], [BUSH, TREE_PAL], [TREE, TREE_PAL]],
    rocks: [ROCK, ROCK_PAL],
    road: { layers: [[9, '#a4743f'], [7, '#d9a86c']], walked: '#ecc78f', pebble: '#a4743f' },
    river: { bank: '#3c9a3c', water: '#2b8adf', deep: '#1f6fc0', shine: '#9fd0ff' },
    pond: 'lily',
    bridge: { plank: '#a0522d', dark: '#7a4a26', rail: '#c98a4b' },
    house: HOUSE,
    housePals: [{ R: '#e03131', r: '#ff6b6b' }, { R: '#4c6ef5', r: '#748ffc' }, { R: '#2f9e44', r: '#69db7c' }, { R: '#f08c00', r: '#ffc078' }],
    houseBase: { W: '#fff3d6', B: '#4dabf7', D: '#8b4513' },
    fence: '#8b5a2b',
    goal: temple({ hi: '#ced4da', roof: '#e9ecef', lo: '#adb5bd', crest: '#fcc419', col: '#f1f3f5', colLo: '#ced4da', step1: '#dee2e6', step2: '#ced4da' }),
    sparkle: { colors: ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'], every: 180 },
  },

  'bg-sunset': {
    name: 'Sunset Beach',
    ground: ['#f3c98b', '#e5b574', '#fde3b6'],
    walls: [[PALM, PALM_PAL]],
    scenery: [[ROCK, { L: '#ced4da', d: '#adb5bd' }], [PALM, PALM_PAL], [CORAL, { c: '#ff8787' }]],
    rocks: [CRYSTAL, { c: '#ffc9c9', C: '#ff8787' }],
    road: { layers: [[9, '#7a4a26'], [7, '#c98a4b']], walked: '#e8b77a', stripes: '#a0612f' },
    river: { bank: '#d9a35f', water: '#3bc9db', deep: '#1098ad', shine: '#e3fafc' },
    pond: 'rocks',
    bridge: { plank: '#8b5a2b', dark: '#6e3d1a', rail: '#c98a4b' },
    house: HUT,
    housePals: [{ R: '#d4a24c', r: '#f0c674' }, { R: '#c08a3e', r: '#e9b96e' }],
    houseBase: { W: '#ffd8a8', B: '#3bc9db', D: '#8b4513' },
    fence: null,
    goal: (px, cx, cy) => drawFort(px, cx, cy, { stone: '#e9c46a', hi: '#f6e0a3', lo: '#c9a24a', flag: '#ff6b6b' }, false),
    sparkle: { colors: ['#ffffff', '#ffa8a8', '#ff922b', '#fff3bf'], every: 160 },
    tint: { top: '#ff922b', alpha: 0.22 },
    life: 'crab',
  },

  'bg-ocean': {
    name: 'Under the Sea',
    life: 'fish',
    ground: ['#2f86c9', '#2878b6', '#4fa3e3'],
    walls: [[KELP, KELP_PAL], [CORAL, { c: '#ff8787' }]],
    scenery: [[CORAL, { c: '#ff8787' }], [CORAL, { c: '#f783ac' }], [KELP, KELP_PAL]],
    rocks: [ROCK, { L: '#748ffc', d: '#5c7cfa' }],
    road: { layers: [[9, '#c9a35d'], [7, '#f0d9a0']], walked: '#fff4d1', pebble: '#c9a35d' },
    river: { bank: '#1c5d99', water: '#163e73', deep: '#0f2d57', shine: '#4dabf7' },
    pond: 'bubbles',
    bridge: { plank: '#8d6e63', dark: '#5d4037', rail: '#bcaaa4' },
    house: DOME,
    housePals: [{ R: '#f783ac', r: '#fcc2d7' }, { R: '#ffa94d', r: '#ffd8a8' }, { R: '#da77f2', r: '#eebefa' }, { R: '#ffd43b', r: '#fff3bf' }],
    houseBase: { W: '#fff0f6', B: '#74c0fc', D: '#5d4037' },
    fence: null,
    goal: temple({ hi: '#c3fae8', roof: '#63e6be', lo: '#20c997', crest: '#ff8787', col: '#e6fcf5', colLo: '#96f2d7', step1: '#c3fae8', step2: '#96f2d7' }),
    sparkle: { colors: ['#d0ebff', '#ffffff', '#ffd43b', '#ff8787'], every: 140, bubbles: true },
  },

  'bg-space': {
    name: 'Moon Base',
    life: 'space',
    ground: ['#7d82a8', '#6a6f96', '#9a9fc4'],
    walls: [[BOULDER, { L: '#5c5f8a', l: '#7d82a8', d: '#45476b' }]],
    scenery: [[CRATER, { d: '#5c6088', D: '#6a6f96', l: '#a5aacf' }], [CRATER, { d: '#5c6088', D: '#6a6f96', l: '#a5aacf' }], [CRYSTAL, { c: '#99e9f2', C: '#3bc9db' }]],
    rocks: [ROCK, { L: '#5c5f8a', d: '#45476b' }],
    road: { layers: [[9, '#495057'], [7, '#adb5bd']], walked: '#e9ecef', stripes: '#868e96' },
    river: { bank: '#45476b', water: '#0b1026', deep: '#1b1f4b', shine: '#ffffff' },
    pond: 'goo',
    pondColors: { bank: '#45476b', water: '#37b24d', deep: '#2b8a3e', shine: '#b2f2bb' },
    bridge: { plank: '#868e96', dark: '#495057', rail: '#ffd43b' },
    house: DOME,
    housePals: [{ R: '#74c0fc', r: '#d0ebff' }, { R: '#63e6be', r: '#c3fae8' }],
    houseBase: { W: '#ced4da', B: '#ff6b6b', D: '#495057' },
    fence: null,
    goal: (px, cx, cy) => drawLaunchpad(px, cx, cy),
    sparkle: { colors: ['#5c6088', '#a5aacf', '#ff6b6b', '#ffd43b'], every: 220 },
  },

  'bg-castle': {
    name: 'Royal Castle',
    life: 'castle',
    ground: ['#5cbd52', '#4aa842', '#7bd66b'],
    walls: (p) => drawCastleWalls(p),
    scenery: [[BUSH, TREE_PAL], [TREE, TREE_PAL], [BUSH, TREE_PAL]],
    rocks: [ROCK, ROCK_PAL],
    road: { layers: [[9, '#495057'], [7, '#ced4da']], walked: '#f1f3f5', stripes: '#adb5bd' },
    river: { bank: '#868e96', water: '#3b5bdb', deep: '#364fc7', shine: '#bac8ff' },
    pond: 'lily',
    bridge: { plank: '#8b5a2b', dark: '#5c3a1e', rail: '#495057' },
    house: HOUSE,
    housePals: [{ R: '#7048e8', r: '#9775fa' }, { R: '#e64980', r: '#f783ac' }, { R: '#1c7ed6', r: '#4dabf7' }, { R: '#7048e8', r: '#b197fc' }],
    houseBase: { W: '#fff3d6', B: '#4dabf7', D: '#8b4513' },
    fence: '#8b5a2b',
    goal: (px, cx, cy) => drawFort(px, cx, cy, { stone: '#adb5bd', hi: '#dee2e6', lo: '#868e96', flag: '#f783ac', cone: '#7048e8', coneHi: '#9775fa' }, true),
    sparkle: { colors: ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'], every: 200 },
  },

  'bg-volcano': {
    name: 'Volcano Island',
    life: 'volcano',
    ground: ['#5b4b45', '#4b3d38', '#75645c'],
    walls: [[TREE, { G: '#2b8a3e', g: '#51cf66', d: '#1b5e20', T: '#5c3a1e' }], [BOULDER, { L: '#3d3330', l: '#5b4b45', d: '#2b211d' }]],
    scenery: [[BOULDER, { L: '#3d3330', l: '#5b4b45', d: '#2b211d' }], [BUSH, { G: '#2b8a3e', g: '#51cf66', d: '#1b5e20' }], [PALM, PALM_PAL]],
    rocks: [ROCK, { L: '#2b211d', d: '#1a1210' }],
    road: { layers: [[9, '#2b211d'], [7, '#8a7466']], walked: '#b8a395', pebble: '#2b211d' },
    river: { bank: '#2b211d', water: '#ff6b1a', deep: '#e03131', shine: '#ffe066' },
    pond: 'lava',
    bridge: { plank: '#495057', dark: '#343a40', rail: '#868e96' },
    house: HUT,
    housePals: [{ R: '#2f9e44', r: '#69db7c' }, { R: '#5c940d', r: '#94d82d' }],
    houseBase: { W: '#d9a86c', B: '#ff922b', D: '#5c3a1e' },
    fence: null,
    goal: (px, cx, cy) => drawVolcano(px, cx, cy),
    sparkle: { colors: ['#ff922b', '#ffd43b', '#fa5252'], every: 200 },
  },

  'bg-rainbow': {
    name: 'Rainbow Land',
    life: 'unicorn',
    ground: ['#c3fae8', '#a6f0d8', '#e6fcf5'],
    walls: [
      [TREE, { G: '#faa2c1', g: '#fcc2d7', d: '#f06595', T: '#fff0f6' }],
      [TREE, { G: '#b197fc', g: '#d0bfff', d: '#845ef7', T: '#fff0f6' }],
      [TREE, { G: '#74c0fc', g: '#a5d8ff', d: '#4dabf7', T: '#fff0f6' }],
    ],
    scenery: [[CANDY, { c: '#ff6b6b', W: '#ffffff' }], [CANDY, { c: '#845ef7', W: '#ffffff' }], [TREE, { G: '#ffd43b', g: '#ffec99', d: '#fab005', T: '#fff0f6' }]],
    rocks: [BUSH, { G: '#ffffff', g: '#ffffff', d: '#dee2e6' }],
    road: { layers: [[11, '#ff6b6b'], [9, '#ffa94d'], [7, '#ffd43b'], [5, '#69db7c'], [3, '#4dabf7']], walked: '#ffffff', walkedSize: 3 },
    river: { bank: '#ffffff', water: '#f783ac', deep: '#e64980', shine: '#fff0f6' },
    pond: 'sparkle',
    bridge: { plank: '#ffffff', dark: '#ff8787', rail: '#ff6b6b' },
    house: MUSHROOM,
    housePals: [{ R: '#ff6b6b', w: '#ffffff' }, { R: '#845ef7', w: '#ffffff' }, { R: '#4dabf7', w: '#ffffff' }, { R: '#f783ac', w: '#ffffff' }],
    houseBase: { W: '#fff9db', B: '#74c0fc', D: '#f783ac' },
    fence: null,
    goal: (px, cx, cy) => drawRainbow(px, cx, cy),
    sparkle: { colors: ['#ff6b6b', '#ffd43b', '#4dabf7', '#b197fc', '#ffffff'], every: 140, plus: 0.25 },
  },

  'bg-galaxy': {
    name: 'Golden Galaxy',
    life: 'saucer',
    ground: ['#2a1a5e', '#21134d', '#3a2878'],
    walls: [[SPIRE, { c: '#ffe066', C: '#f59f00' }], [SPIRE, { c: '#d0bfff', C: '#9775fa' }]],
    scenery: [[CRYSTAL, { c: '#ffe066', C: '#f59f00' }], [CRYSTAL, { c: '#d0bfff', C: '#9775fa' }], [SPIRE, { c: '#ffe066', C: '#f59f00' }]],
    rocks: [ROCK, { L: '#5f3dc4', d: '#4527a0' }],
    road: { layers: [[9, '#e67700'], [7, '#fcc419']], walked: '#fff3bf', stripes: '#fab005' },
    river: { bank: '#5f3dc4', water: '#7950f2', deep: '#5f3dc4', shine: '#ffffff' },
    pond: 'stars',
    bridge: { plank: '#fab005', dark: '#e67700', rail: '#fff3bf' },
    house: DOME,
    housePals: [{ R: '#ffd43b', r: '#fff3bf' }, { R: '#b197fc', r: '#e5dbff' }, { R: '#ffa94d', r: '#ffe8cc' }, { R: '#63e6be', r: '#c3fae8' }],
    houseBase: { W: '#e5dbff', B: '#ffd43b', D: '#5f3dc4' },
    fence: null,
    goal: temple({ hi: '#fff3bf', roof: '#ffd43b', lo: '#f59f00', crest: '#ffffff', col: '#fff9db', colLo: '#ffe066', step1: '#ffec99', step2: '#fcc419', star: '#fff3bf' }),
    sparkle: { colors: ['#ffd43b', '#fff3bf', '#ffffff', '#b197fc'], every: 120, plus: 0.2 },
  },
};

/** The theme for a Places background id (the meadow's Forest Village when unknown). */
export const mapTheme = (bg) => MAP_THEMES[bg] || MAP_THEMES['bg-meadow'];

// ---------- painting ----------

/** Small seeded random so a kid's map looks the same every time. */
function seeded(text) {
  let s = 7;
  for (const ch of String(text)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  if (s <= 0) s = 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function painter(ctx, w, h) {
  const px = (x, y, c, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  const sprite = (x0, y0, rows, pal) => rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x += 1) {
      const ch = r[x];
      if (ch === '.') continue;
      const c = ch === 'K' ? OUT : pal[ch];
      if (c) px(x0 + x, y0 + y, c);
    }
  });
  return { px, sprite, w, h };
}

/** The road follows the same curves as the stops: a cubic between each pair of points. */
function roadSamples(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i += 1) {
    const q = pts[i - 1];
    const p = pts[i];
    const my = (q.y + p.y) / 2;
    const n = Math.max(8, Math.ceil(Math.abs(p.y - q.y) + Math.abs(p.x - q.x)));
    for (let s = 0; s <= n; s += 1) {
      const t = s / n;
      const u = 1 - t;
      const x = u * u * u * q.x + 3 * u * u * t * q.x + 3 * u * t * t * p.x + t * t * t * p.x;
      const y = u * u * u * q.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * p.y;
      out.push({ x, y, seg: i });
    }
  }
  return out;
}

const timers = new WeakMap();

/**
 * Paint every quest map inside root. Each .quest-map carries its stops as data:
 * data-pts: [[xPercent, yPx, kind], ...], data-here: index of the buddy's stop,
 * data-river: y in px of the river (or empty), data-seed: text for the random layout,
 * data-theme: the kid's Places background id, which picks the map theme.
 */
export function paintQuestMaps(root = document) {
  root.querySelectorAll('.quest-map[data-pts]').forEach(paintOne);
}

function paintOne(section) {
  const canvas = section.querySelector('canvas.map-land');
  if (!canvas) return;
  const W = section.clientWidth;
  const H = section.clientHeight;
  if (!W || !H) return;
  const aw = Math.ceil(W / SCALE);
  const ah = Math.ceil(H / SCALE);
  canvas.width = aw;
  canvas.height = ah;
  canvas.style.width = `${aw * SCALE}px`;
  canvas.style.height = `${ah * SCALE}px`;
  const ctx = canvas.getContext('2d');
  const { px, sprite } = painter(ctx, aw, ah);
  const rnd = seeded(section.dataset.seed || 'map');
  const th = mapTheme(section.dataset.theme);

  const stops = JSON.parse(section.dataset.pts).map(([x, y, kind]) => ({ x: (x / 100) * aw, y: y / SCALE, kind }));
  const here = Number(section.dataset.here) || 0;
  const riverY = section.dataset.river ? Number(section.dataset.river) / SCALE : null;
  const road = roadSamples([{ x: aw / 2, y: 0 }, ...stops]);
  const nearRoad = (x, y, d) => road.some((r) => Math.abs(r.x - x) < d && Math.abs(r.y - y) < d);
  const wall = Math.min(20, Math.floor(aw * 0.12));

  // ground with darker and lighter tufts
  const [ground, groundDark, groundLight] = th.ground;
  px(0, 0, ground, aw, ah);
  const tufts = Math.floor((aw * ah) / 60);
  for (let i = 0; i < tufts; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    px(x, y, groundDark, 2, 1);
    px(x + 1, y - 1, groundLight);
  }

  // walls down both sides: trees, palms, kelp, boulders... or the castle's stone walls
  if (typeof th.walls === 'function') {
    th.walls({ px, sprite, aw, ah, wall });
  } else {
    for (let y = -6, row = 0; y < ah; y += 7, row += 1) {
      const jig = row % 2 ? 2 : 0;
      const pick = (k) => th.walls[(row + k) % th.walls.length];
      const [a, ap] = pick(0);
      const [b, bp] = pick(1);
      sprite(-4 + jig, y, a, ap);
      sprite(wall - 9 - jig, y + 3, b, bp);
      sprite(aw - 4 - jig, y, b, bp);
      sprite(aw - wall + 1 + jig, y + 3, a, ap);
    }
  }

  // a fishing pond or a little playing field each side of the road, only where visitors use one
  const spots = pondSpots(aw, wall);
  const ponds = (section.dataset.areas || '').split(',').filter(Boolean).map((a) => {
    const [side, kind] = a.split(':');
    return { ...spots[side === 'right' ? 1 : 0], kind };
  });
  const inPond = (x, y, pad) => ponds.some((p) => x > p.x - pad && x < p.x + p.w + pad && y > p.y - pad && y < p.y + p.h + pad);

  // a few clumps of scenery in the open, away from the road
  const open = (x, y, r) => x > wall + 2 && x < aw - wall - 8 && !nearRoad(x + 4, y + 4, r) && !inPond(x + 4, y + 4, 8);
  // more scenery on wide screens, where there is lots of open ground
  const clumps = Math.floor((ah * Math.max(1, aw - 2 * wall)) / 900);
  for (let i = 0; i < clumps; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(20 + rnd() * (ah - 40));
    if (!open(x, y, 14)) continue;
    const [rows, pal] = th.scenery[i % th.scenery.length];
    sprite(x, y, rows, pal);
    if (i % 3 === 2 && open(x + 7, y + 4, 14)) sprite(x + 7, y + 4, rows, pal);
  }
  for (let i = 0; i < Math.floor(ah / 30); i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    if (open(x, y, 10)) sprite(x, y, th.rocks[0], th.rocks[1]);
  }

  // the river cuts through everything except the road (the bridge takes the road across)
  let band = null;
  if (riverY !== null) band = drawRiver(px, aw, riverY, road, th.river);

  // the road: outer layers first; the part already walked is lighter
  const hereY = stops[here]?.y ?? 0;
  const inBand = (r, pad = 0) => band && r.y > band.top - pad && r.y < band.bottom + pad;
  for (const [size, color] of th.road.layers) {
    for (const r of road) {
      if (inBand(r)) continue;
      px(r.x - (size >> 1), r.y - (size >> 1), color, size, size);
    }
  }
  const ws = th.road.walkedSize || 5;
  for (const r of road) {
    if (r.y > hereY || inBand(r)) continue;
    px(r.x - (ws >> 1), r.y - (ws >> 1), th.road.walked, ws, ws);
  }
  // pebbles along a dirt road, or planks and tiles across a built one
  for (let i = 0; i < road.length; i += th.road.stripes ? 4 : 7) {
    const r = road[i];
    if (inBand(r, 2)) continue;
    if (th.road.stripes && r.y > hereY) px(r.x - 3, r.y, th.road.stripes, 7, 1);
    else if (th.road.pebble && rnd() < 0.5) px(r.x + (rnd() < 0.5 ? -2 : 2), r.y, th.road.pebble);
  }
  if (band) drawBridge(px, band, th.bridge);
  ponds.forEach((p) => (p.kind === 'pond' ? drawPond(px, p, th) : drawField(px, p)));

  // the village at the start: houses on both sides of the road, more on wide screens
  const homes = aw > 140 ? [0.2, 0.33, 0.67, 0.8] : [0.24, 0.76];
  homes.forEach((f, i) => {
    const x = Math.round(aw * f - 5);
    const y = 2 + (i % 2) * 5;
    sprite(x, y, th.house, { ...th.houseBase, ...th.housePals[i % th.housePals.length] });
    if (th.fence) for (let fx = x - 1; fx < x + 11; fx += 2) px(fx, y + 10, th.fence, 1, 2);
  });

  // the big place at the treasure
  const chest = stops[stops.length - 1];
  if (chest) th.goal(px, chest.x, chest.y);

  // flowers, shells, stars or bubbles last so they sit on top of the ground
  const sp = th.sparkle;
  const count = Math.floor((aw * ah) / sp.every);
  for (let i = 0; i < count; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    if (x < wall || x > aw - wall || nearRoad(x, y, 6)) continue;
    if (band && y > band.top - 2 && y < band.bottom + 2) continue;
    if (inPond(x, y, 1)) continue;
    const c = sp.colors[i % sp.colors.length];
    if (sp.bubbles && i % 5 === 0) {
      px(x, y - 1, c); px(x - 1, y, c); px(x + 1, y, c); px(x, y + 1, c);
    } else if (sp.plus && rnd() < sp.plus) {
      px(x - 1, y, c, 3, 1); px(x, y - 1, c, 1, 3);
    } else {
      px(x, y, c);
    }
  }

  // a warm evening glow over the beach
  if (th.tint) {
    const g = ctx.createLinearGradient(0, 0, 0, Math.min(ah, 120));
    g.addColorStop(0, th.tint.top);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = th.tint.alpha;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, aw, ah);
    ctx.globalAlpha = 1;
  }

  animateRiver(canvas, ctx, band, th.river.shine);

  // somewhere for the knight to keep watch: just past the bridge, on the side away from the road
  const postY = riverY !== null ? riverY + 14 : ah / 2;
  const roadX = road.reduce((best, r) => (Math.abs(r.y - postY) < Math.abs(best.y - postY) ? r : best), road[0]).x;
  const side = roadX > aw / 2 ? -1 : 1;
  startMapLife({
    section, aw, ah, scale: SCALE, life: th.life, wall,
    goal: chest || { x: aw / 2, y: ah - 30 },
    knightPost: { x: side < 0 ? wall + 2 : aw - wall - 28, y: postY, side },
    openSpot: ({ top, bottom }) => {
      for (let tries = 0; tries < 30; tries += 1) {
        const x = wall + 4 + Math.random() * (aw - 2 * wall - 32);
        const y = top + Math.random() * Math.max(1, bottom - top - 24);
        if (y > 18 && open(x + 8, y + 8, 20) && !(band && y + 24 > band.top - 2 && y < band.bottom + 2)) return { x, y };
      }
      return null;
    },
  });
}

/**
 * Where the village ponds go, in map pixels. Visiting buddies stand above them
 * (see .map-visitor in style.css) and cast their lines in: keep the two in step.
 */
export const POND_TOP = 38;
export const POND_HEIGHT = 13;
export function pondSpots(aw, wall) {
  const gap = 8; // room for the road
  const w = Math.floor(aw / 2) - gap - wall - 3;
  return [
    { x: wall + 3, y: POND_TOP, w, h: POND_HEIGHT },
    { x: Math.ceil(aw / 2) + gap, y: POND_TOP, w, h: POND_HEIGHT },
  ];
}

/** A round pond in the map's river colors: water, lava, goo or stardust, with a bit of theme on top. */
function drawPond(px, { x, y, w, h }, th) {
  const c = th.pondColors || th.river;
  const cx = x + w / 2;
  const cy = y + h / 2;
  const inside = (xx, yy, grow = 0) => ((xx + 0.5 - cx) / (w / 2 + grow)) ** 2 + ((yy + 0.5 - cy) / (h / 2 + grow)) ** 2 <= 1;
  for (let yy = y - 2; yy < y + h + 2; yy += 1) {
    for (let xx = x - 2; xx < x + w + 2; xx += 1) {
      if (inside(xx, yy)) {
        const deep = inside(xx, yy, -2.5);
        px(xx, yy, deep ? c.deep : c.water);
      } else if (inside(xx, yy, 1.5)) {
        px(xx, yy, c.bank);
      }
    }
  }
  // shine on the water
  for (let i = 3; i < w - 3; i += 7) {
    const sy = Math.round(cy - 2 + (i % 3));
    for (let k = 0; k < 3; k += 1) if (inside(x + i + k, sy, -1)) px(x + i + k, sy, c.shine);
  }
  const extra = POND_EXTRAS[th.pond] || POND_EXTRAS.lily;
  extra(px, { x, y, w, h, cx, cy });
}

// Little fields for visitors playing together: grass with white lines and goals,
// an ice rink with boards and nets, or a football field with end zones.
const FIELDS = {
  soccer: { ground: ['#40c057', '#51cf66'], line: '#ffffff', edge: '#2b8a3e', goal: '#ffffff' },
  hockey: { ground: ['#e7f5ff', '#d0ebff'], line: '#e03131', edge: '#495057', goal: '#e03131', blue: '#4dabf7' },
  football: { ground: ['#2f9e44', '#37b24d'], line: '#ffffff', edge: '#1b6e2e', ends: ['#e03131', '#1c7ed6'] },
};
function drawField(px, { x, y, w, h, kind }) {
  const f = FIELDS[kind] || FIELDS.soccer;
  // the edge: boards round a rink, a darker border round grass
  px(x - 1, y - 1, f.edge, w + 2, h + 2);
  for (let i = 0; i < w; i += 1) px(x + i, y, f.ground[Math.floor(i / 3) % 2], 1, h);
  const mid = x + Math.floor(w / 2);
  if (kind === 'soccer') {
    px(x, y, f.line, w, 1); px(x, y + h - 1, f.line, w, 1); px(x, y, f.line, 1, h); px(x + w - 1, y, f.line, 1, h);
    px(mid, y, f.line, 1, h);
    px(mid - 2, y + 4, f.line, 5, 1); px(mid - 2, y + h - 5, f.line, 5, 1); px(mid - 3, y + 5, f.line, 1, h - 10); px(mid + 3, y + 5, f.line, 1, h - 10);
    for (const gx of [x - 2, x + w]) { px(gx, y + 4, f.goal, 2, 1); px(gx, y + h - 5, f.goal, 2, 1); px(gx + (gx < x ? 0 : 1), y + 4, f.goal, 1, h - 8); }
  } else if (kind === 'hockey') {
    px(x - 1, y - 1, '#ffffff', w + 2, 1); // top of the boards
    px(mid, y, f.line, 1, h);
    px(x + Math.floor(w / 3), y, f.blue, 1, h); px(x + Math.ceil((2 * w) / 3), y, f.blue, 1, h);
    px(mid - 1, y + Math.floor(h / 2) - 1, f.line, 3, 3); px(mid, y + Math.floor(h / 2), '#ffffff');
    for (const gx of [x + 2, x + w - 4]) { px(gx, y + 4, f.goal, 2, h - 8); px(gx + (gx < mid ? 0 : 1), y + 5, '#ffffff', 1, h - 10); }
  } else {
    px(x, y, f.ends[0], 4, h); px(x + w - 4, y, f.ends[1], 4, h);
    for (let i = 4; i < w - 4; i += 4) px(x + i, y, f.line, 1, h);
    px(x + 1, y - 3, '#ffd43b', 1, 3); px(x + w - 2, y - 3, '#ffd43b', 1, 3);
  }
}

const POND_EXTRAS = {
  // lily pads with a pink flower
  lily: (px, { x, y, w }) => {
    px(x + 4, y + 3, '#40c057', 3, 2); px(x + 5, y + 3, '#ff8fa3');
    px(x + w - 7, y + 8, '#40c057', 3, 2);
  },
  // lava bubbles popping
  lava: (px, { x, y, w }) => {
    for (const [dx, dy] of [[4, 4], [w - 8, 7], [Math.floor(w / 2), 9]]) { px(x + dx, y + dy, '#ffe066', 2, 1); px(x + dx, y + dy - 1, '#ff922b', 2, 1); }
  },
  // glowing bubbles in alien goo, or stars in a pool of stardust
  sparkle: (px, { x, y, w }, color = '#ffffff') => {
    for (const [dx, dy] of [[4, 3], [w - 6, 5], [Math.floor(w / 2) - 2, 9]]) { px(x + dx, y + dy, color); px(x + dx - 1, y + dy + 1, color); px(x + dx + 1, y + dy + 1, color); }
  },
  goo: (px, p) => POND_EXTRAS.sparkle(px, p, '#d3f9d8'),
  stars: (px, p) => POND_EXTRAS.sparkle(px, p, '#ffd43b'),
  // rocks around a tide pool
  rocks: (px, { x, y, w, h }) => {
    for (const [dx, dy] of [[-2, 2], [w, h - 4], [w - 4, -2]]) px(x + dx, y + dy, '#868e96', 3, 2);
  },
  // bubbles rising from a deep sea trench
  bubbles: (px, { x, y, w }) => {
    for (const [dx, dy] of [[5, 2], [w - 7, 4], [Math.floor(w / 2), 7]]) { px(x + dx, y + dy, '#d0ebff'); px(x + dx + 1, y + dy - 2, '#d0ebff'); }
  },
};

function drawRiver(px, aw, riverY, road, c) {
  const wave = (x) => Math.round(riverY + Math.sin(x / 13) * 2);
  const half = 5;
  for (let x = 0; x < aw; x += 1) {
    const y = wave(x);
    px(x, y - half - 1, c.bank);
    px(x, y - half, c.water, 1, half * 2);
    px(x, y + half - 1, c.deep);
    px(x, y + half, c.bank);
  }
  // where the road crosses, so the bridge covers it
  const inBand = road.filter((r) => r.y > riverY - half - 1 && r.y < riverY + half + 1);
  const xs = inBand.length ? inBand.map((r) => r.x) : [aw / 2];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const top = riverY - half - 4;
  const bottom = riverY + half + 4;
  return {
    wave, half, top, bottom, aw,
    bx0: Math.round(minX - 6),
    bx1: Math.round(maxX + 6),
  };
}

function drawBridge(px, band, c) {
  const { bx0, bx1, top, bottom } = band;
  const w = bx1 - bx0;
  const h = bottom - top;
  px(bx0, top, OUT, w, h);
  px(bx0 + 1, top, c.plank, w - 2, h);
  for (let y = top; y < bottom; y += 2) px(bx0 + 1, y, c.dark, w - 2, 1);
  // rails
  px(bx0 + 1, top, c.rail, 1, h);
  px(bx1 - 2, top, c.rail, 1, h);
  for (let y = top; y < bottom; y += 3) { px(bx0, y, OUT, 2, 1); px(bx1 - 2, y, OUT, 2, 1); }
}

// ---------- the big places at the treasure (drawn around the chest, which sits on top) ----------

function drawTemple(px, cx, cy, p) {
  const x0 = Math.round(cx - 18);
  const y0 = Math.round(cy - 22);
  // roof
  px(x0 + 4, y0, OUT, 28, 1);
  px(x0 + 2, y0 + 1, OUT, 32, 1);
  px(x0 + 3, y0 + 1, p.hi, 30, 1);
  px(x0, y0 + 2, OUT, 36, 4);
  px(x0 + 1, y0 + 2, p.roof, 34, 3);
  px(x0 + 1, y0 + 4, p.lo, 34, 1);
  px(x0 + 16, y0 + 2, p.crest, 4, 2);
  if (p.star) {
    // a big star on top
    px(x0 + 17, y0 - 7, OUT, 2, 7);
    px(x0 + 14, y0 - 5, OUT, 8, 2);
    px(x0 + 17, y0 - 6, p.star, 2, 5);
    px(x0 + 15, y0 - 5, p.star, 6, 1);
  }
  // columns
  for (const cxo of [2, 8, 26, 32]) {
    px(x0 + cxo, y0 + 6, OUT, 4, 26);
    px(x0 + cxo + 1, y0 + 6, p.col, 2, 26);
    px(x0 + cxo + 2, y0 + 6, p.colLo, 1, 26);
  }
  // steps
  px(x0 - 1, y0 + 32, OUT, 38, 3);
  px(x0, y0 + 32, p.step1, 36, 2);
  px(x0 - 3, y0 + 35, OUT, 42, 3);
  px(x0 - 2, y0 + 35, p.step2, 40, 2);
}

/** A castle (with pointed tower roofs) or a sandcastle (without). */
function drawFort(px, cx, cy, p, cones) {
  const x0 = Math.round(cx - 23);
  const x1 = Math.round(cx + 23);
  const top = Math.round(cy - 14);
  const base = Math.round(cy + 15);
  // the wall between the towers, with battlements
  px(x0 + 6, top + 4, OUT, x1 - x0 - 12, base - top - 4);
  px(x0 + 7, top + 5, p.stone, x1 - x0 - 14, base - top - 6);
  for (let y = top + 8; y < base - 1; y += 4) px(x0 + 7, y, p.lo, x1 - x0 - 14, 1);
  for (let x = x0 + 7; x < x1 - 8; x += 4) { px(x, top + 1, OUT, 3, 4); px(x + 1, top + 2, p.hi, 1, 3); }
  // towers
  for (const tx of [x0, x1 - 10]) {
    px(tx, top - 6, OUT, 11, base - top + 6);
    px(tx + 1, top - 5, p.stone, 9, base - top + 4);
    px(tx + 1, top - 5, p.hi, 2, base - top + 4);
    px(tx + 8, top - 5, p.lo, 2, base - top + 4);
    px(tx + 4, top + 2, OUT, 3, 4); // window
    if (cones) {
      for (let k = 0; k < 9; k += 1) {
        const w = 13 - k * 1.4;
        px(tx + 5.5 - w / 2, top - 7 - k, OUT, Math.max(1, w), 1);
        if (w > 3) px(tx + 6.5 - w / 2, top - 7 - k, k < 6 ? p.cone : p.coneHi, Math.max(1, w - 2), 1);
      }
      px(tx + 5, top - 20, OUT, 1, 5);
      px(tx + 6, top - 20, p.flag, 3, 2);
    } else {
      for (let x = tx; x < tx + 11; x += 3) px(x, top - 8, OUT, 2, 2);
      px(tx + 5, top - 14, OUT, 1, 6);
      px(tx + 6, top - 14, p.flag, 3, 2);
    }
  }
  // the ground in front
  px(x0 - 2, base, OUT, x1 - x0 + 4, 3);
  px(x0 - 1, base, p.lo, x1 - x0 + 2, 2);
}

/** A space dome with an antenna, and a rocket waiting on its pad. */
function drawLaunchpad(px, cx, cy) {
  const r = 20;
  const by = Math.round(cy + 10);
  for (let y = -r; y <= 0; y += 1) {
    const w = Math.round(Math.sqrt(r * r - y * y));
    px(cx - w - 1, by + y, OUT, w * 2 + 3, 1);
  }
  for (let y = -r + 1; y <= 0; y += 1) {
    const w = Math.round(Math.sqrt((r - 1) * (r - 1) - y * y));
    px(cx - w, by + y, '#a5d8ff', w * 2 + 1, 1);
    if (y > -r + 3 && y < -6) px(cx - w + 2, by + y, '#e7f5ff', 2, 1);
  }
  for (let k = 1; k < 4; k += 1) px(cx - r + 2, by - k * 5, '#74c0fc', (r - 2) * 2, 1);
  // antenna
  px(cx, by - r - 7, OUT, 1, 7);
  px(cx - 1, by - r - 9, '#ff6b6b', 3, 2);
  // base ring
  px(cx - r - 4, by, OUT, r * 2 + 9, 6);
  px(cx - r - 3, by + 1, '#adb5bd', r * 2 + 7, 2);
  px(cx - r - 3, by + 3, '#868e96', r * 2 + 7, 2);
  for (let x = cx - r - 1; x < cx + r + 3; x += 6) px(x, by + 1, '#ffd43b', 2, 1);
  // rocket beside it
  const rx = Math.round(cx + r + 6);
  const ry = Math.round(cy - 14);
  px(rx, ry + 2, OUT, 7, 22);
  px(rx + 1, ry, OUT, 5, 2);
  px(rx + 2, ry - 2, OUT, 3, 2);
  px(rx + 1, ry + 2, '#f1f3f5', 5, 20);
  px(rx + 2, ry, '#ff6b6b', 3, 2);
  px(rx + 1, ry + 2, '#ff6b6b', 5, 2);
  px(rx + 2, ry + 8, OUT, 3, 3);
  px(rx + 3, ry + 9, '#74c0fc', 1, 1);
  px(rx - 3, ry + 16, OUT, 4, 8);
  px(rx + 6, ry + 16, OUT, 4, 8);
  px(rx - 2, ry + 17, '#ff6b6b', 2, 6);
  px(rx + 7, ry + 17, '#ff6b6b', 2, 6);
}

/** A smoking volcano behind the treasure, with lava running down. */
function drawVolcano(px, cx, cy) {
  const top = Math.round(cy - 26);
  const base = Math.round(cy + 16);
  for (let y = top; y <= base; y += 1) {
    const w = Math.round(7 + (y - top) * 0.75);
    px(cx - w - 1, y, OUT, w * 2 + 3, 1);
    px(cx - w, y, '#7a5240', w * 2 + 1, 1);
    px(cx + Math.round(w * 0.4), y, '#5e3d30', Math.round(w * 0.6) + 1, 1);
    px(cx - w, y, '#94664f', 2, 1);
  }
  // crater and lava
  px(cx - 6, top, '#ff6b1a', 13, 2);
  px(cx - 4, top, '#ffd43b', 9, 1);
  const streaks = [[-3, 14, 1], [2, 22, -1], [5, 10, 1]];
  for (const [sx, len, dir] of streaks) {
    for (let k = 0; k < len; k += 1) px(cx + sx + Math.round((k / 5) * dir), top + 2 + k, k % 4 ? '#ff6b1a' : '#fa5252', 2, 1);
  }
  // smoke
  for (const [dx, dy, s] of [[-2, -5, 4], [2, -9, 5], [-3, -14, 6]]) {
    px(cx + dx - 1, top + dy - 1, OUT, s + 2, s);
    px(cx + dx, top + dy, '#ced4da', s, s - 2);
    px(cx + dx, top + dy, '#f1f3f5', s - 1, 1);
  }
}

/** A rainbow arching over the treasure, with a cloud at each end. */
function drawRainbow(px, cx, cy) {
  const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
  const oy = Math.round(cy + 12);
  const outer = 30;
  for (let y = oy - outer - 1; y <= oy; y += 1) {
    for (let x = cx - outer - 1; x <= cx + outer + 1; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - oy);
      if (d > outer + 1 || d < outer - colors.length * 2 - 1) continue;
      const band = Math.floor((outer - d) / 2);
      px(x, y, band < 0 || band >= colors.length ? OUT : colors[band]);
    }
  }
  for (const sx of [-1, 1]) {
    const x = Math.round(cx + sx * (outer - 6));
    px(x - 9, oy - 3, OUT, 19, 7);
    px(x - 6, oy - 6, OUT, 13, 4);
    px(x - 8, oy - 2, '#ffffff', 17, 4);
    px(x - 5, oy - 5, '#ffffff', 11, 3);
    px(x - 8, oy + 1, '#dee2e6', 17, 1);
  }
}

/** Stone castle walls down both sides, with towers. */
function drawCastleWalls({ px, aw, ah, wall }) {
  const stone = '#adb5bd';
  const hi = '#ced4da';
  const lo = '#868e96';
  const side = (x0, w, inner) => {
    px(x0, 0, stone, w, ah);
    for (let y = 0; y < ah; y += 3) {
      px(x0, y, lo, w, 1);
      for (let x = x0 + ((y / 3) % 2 ? 2 : 0); x < x0 + w; x += 5) px(x, y + 1, lo, 1, 2);
    }
    // battlements along the inner edge
    px(inner, 0, OUT, 1, ah);
    const dir = inner > x0 ? 1 : -1;
    for (let y = 0; y < ah; y += 4) {
      px(inner + (dir > 0 ? 1 : -2), y, OUT, 2, 3);
      px(inner + (dir > 0 ? 1 : -2), y, hi, 1, 2);
    }
    // round towers every so often
    for (let y = 20; y < ah - 6; y += 46) {
      const cx = inner - dir * 4;
      px(cx - 5, y - 5, OUT, 11, 11);
      px(cx - 4, y - 4, hi, 9, 9);
      px(cx - 2, y - 2, '#7048e8', 5, 5);
      px(cx - 1, y - 1, '#9775fa', 2, 2);
    }
  };
  const w = wall - 4;
  side(0, w, w);
  side(aw - w, w, aw - w - 1);
}

function animateRiver(canvas, ctx, band, shine) {
  const old = timers.get(canvas);
  if (old) clearInterval(old);
  if (!band) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const h = band.bottom - band.top + 1;
  const base = ctx.getImageData(0, band.top, band.aw, h);
  let phase = 0;
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(timers.get(canvas)); return; }
    ctx.putImageData(base, 0, band.top);
    ctx.fillStyle = shine;
    for (let x = 0; x < band.aw - 2; x += 1) {
      if ((x + phase) % 11 !== 0) continue;
      if (x + 3 > band.bx0 && x < band.bx1) continue;
      const y = band.wave(x) - 2 + (x % 3);
      ctx.fillRect(x, y, 3, 1);
    }
    phase = (phase + 1) % 11;
  };
  tick();
  if (!reduce) timers.set(canvas, setInterval(tick, 260));
}
