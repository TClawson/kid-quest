// Paints the quest map: a 16-bit top-down scene behind the stops. Each Places background has
// its own map theme (Forest Village for the meadow, a beach for the sunset, and so on).
// The stops, labels and buddy stay as HTML on top; this only draws the land on a <canvas>.
// Moving things (fish, dragons, saucers...) are in maplife.js.
// One art pixel is SCALE screen pixels, so the scene stays chunky at any screen size.

import { startMapLife, waterfallAt } from './maplife.js';

const SCALE = 4;
// Each map pixel is drawn as Z x Z fine pixels (2 screen pixels each), so sprites get
// thin outlines, light top edges and texture while the layout stays in map pixels.
const Z = 2;
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

// the rainforest: big trees with vines, ferns, flowers, and huts on stilts
const JUNGLE_TREE = [
  '...KKKKKK...',
  '.KKGGgGGGKK.',
  'KGGgGGGGgGGK',
  'KGgGGdGGGgdK',
  'KGGGGGGgGGGK',
  'KdGGdGGGGdGK',
  '.KKdKKKdKKK.',
  '.v..KTTK..v.',
  '.v..KTTK..v.',
  '....KTTK..v.',
  '...KTTTTK...',
];
const JUNGLE_PAL = { G: '#2b8a3e', g: '#51cf66', d: '#1b5e20', T: '#6e4b2a', v: '#5c940d' };
const FERN = ['K..K..K', 'KgKgKgK', '.KgGgK.', 'KgGGGgK', '.KKKKK.'];
const FLOWER = ['.K.K.', 'KrKrK', 'KrrrK', '.KGK.', 'KGGGK'];
const STILTS = [
  '....KK....',
  '...KRRK...',
  '..KRrRRK..',
  '.KRRRRrRK.',
  'KRrRRRRRRK',
  'KKKKKKKKKK',
  '.KWWWWWWK.',
  '.KWBWWDWK.',
  '.KKKKKKKK.',
  '..K....K..',
  '..K....K..',
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
    sparkle: { colors: ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'], every: 180, flowers: true },
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

  'bg-rainforest': {
    name: 'Rainforest',
    life: 'jungle',
    ground: ['#237032', '#1b5e20', '#2f9e44'],
    walls: [[JUNGLE_TREE, JUNGLE_PAL], [JUNGLE_TREE, { ...JUNGLE_PAL, G: '#237032', g: '#40c057' }]],
    scenery: [[FERN, { G: '#2f9e44', g: '#8ce99a' }], [FLOWER, { r: '#ff6b6b', G: '#2f9e44' }], [JUNGLE_TREE, JUNGLE_PAL], [FLOWER, { r: '#f783ac', G: '#2f9e44' }]],
    rocks: [ROCK, { L: '#5c7a5c', d: '#3d5a3d' }],
    road: { layers: [[9, '#5c3a1e'], [7, '#8b5a2b']], walked: '#b07443', pebble: '#5c3a1e' },
    river: { bank: '#6e4b2a', water: '#1c9c8c', deep: '#127a6e', shine: '#96f2d7' },
    pond: 'lily',
    bridge: { plank: '#a0612f', dark: '#6e4b2a', rail: '#5c940d' },
    house: STILTS,
    housePals: [{ R: '#5c940d', r: '#94d82d' }, { R: '#2b8a3e', r: '#69db7c' }],
    houseBase: { W: '#d9a066', B: '#1c9c8c', D: '#5c3a1e' },
    fence: null,
    goal: temple({ hi: '#94d82d', roof: '#868e96', lo: '#495057', crest: '#ffd43b', col: '#adb5bd', colLo: '#5c940d', step1: '#868e96', step2: '#6c757d' }),
    falls: true, // a waterfall into the river (there is always a river)
    sparkle: { colors: ['#ff6b6b', '#ffd43b', '#f783ac', '#ffffff', '#ff922b'], every: 150 },
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
  // ctx is scaled by Z: px() works in map pixels, fine() in fine pixels
  const px = (x, y, c, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  const fine = (fx, fy, c, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(fx) / Z, Math.round(fy) / Z, ww / Z, hh / Z);
  };
  // A sprite in fine pixels: outlines one fine pixel thin on the inside of the shape,
  // fills with a light top edge, a shaded bottom edge and a little texture.
  // cell: fine pixels per sprite cell (Z, or 3 for houses a size and a half)
  const sprite = (x0, y0, rows, pal, cell = Z) => {
    const X0 = Math.round(x0) * Z; const Y0 = Math.round(y0) * Z;
    if (rows === TREE) return fineTree(fine, X0, Y0, pal, 1);
    if (rows === BUSH) return fineTree(fine, X0, Y0, pal, 0);
    if (rows === HOUSE) return fineHouse(fine, X0, Y0, pal);
    const C = cell;
    const at = (x, y) => (y < 0 || y >= rows.length || x < 0 || x >= rows[y].length ? '.' : rows[y][x]);
    const fill = (x, y) => { const ch = at(x, y); return ch !== '.' && ch !== 'K' && Boolean(pal[ch]); };
    const X = Math.round(x0) * Z; const Y = Math.round(y0) * Z;
    for (let y = 0; y < rows.length; y += 1) {
      for (let x = 0; x < rows[y].length; x += 1) {
        const ch = rows[y][x];
        if (ch === '.') continue;
        for (let b = 0; b < C; b += 1) {
          for (let a = 0; a < C; a += 1) {
            const fx = X + x * C + a; const fy = Y + y * C + b;
            if (ch === 'K') {
              const nx = a < C / 2 ? x - 1 : x + 1; const ny = b < C / 2 ? y - 1 : y + 1;
              const inner = fill(nx, y) || fill(x, ny) || fill(nx, ny);
              const outerSide = !fill(a < C / 2 ? x + 1 : x - 1, y) && !fill(x, b < C / 2 ? y + 1 : y - 1);
              if (inner || !outerSide) fine(fx, fy, OUT);
              continue;
            }
            const base = pal[ch]; if (!base) continue;
            let c = base;
            if (b === 0 && !fill(x, y - 1)) c = shade(base, 0.22);
            else if (b === C - 1 && !fill(x, y + 1)) c = shade(base, -0.18);
            else if (a === C - 1 && !fill(x + 1, y)) c = shade(base, -0.08);
            else { const hsh = hashXY(fx, fy); if (hsh < 0.1) c = shade(base, -0.1); else if (hsh > 0.94) c = shade(base, 0.12); }
            fine(fx, fy, c);
          }
        }
      }
    }
  };
  return { px, fine, sprite, w, h };
}

/**
 * A leafy tree (big = 1, 16 x 18 fine pixels, the size of TREE) or a bush (big = 0, the
 * size of BUSH): round clumps of leaves lit from the top left, a trunk, and a soft shadow.
 */
function fineTree(fine, X, Y, pal, big) {
  const G = pal.G; const g = pal.g || shade(G, 0.25); const d = pal.d || shade(G, -0.25); const T = pal.T || '#7a4a26';
  const clumps = big
    ? [[8, 3.6, 3.8], [4.4, 6.8, 4], [11.6, 6.8, 4], [8, 8.6, 4.4], [6, 4.6, 3], [10, 4.6, 3]]
    : [[3.2, 4, 2.8], [6.8, 4, 2.8], [5, 2.8, 2.6]];
  const W = big ? 16 : 10; const H = big ? 14 : 8;
  const inside = (x, y) => clumps.findIndex(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  if (big) {
    // shadow on the ground, then the trunk
    for (let x = 3; x < 13; x += 1) fine(X + x, Y + 17, 'rgba(27,20,48,0.18)');
    fine(X + 6, Y + 12, '#2a1838', 4, 6); fine(X + 7, Y + 12, T, 2, 5); fine(X + 8, Y + 12, shade(T, -0.25), 1, 5); fine(X + 5, Y + 16, T, 1, 1); fine(X + 10, Y + 16, shade(T, -0.25), 1, 1);
  } else for (let x = 2; x < 9; x += 1) fine(X + x, Y + 7, 'rgba(27,20,48,0.18)');
  for (let y = -1; y <= H; y += 1) {
    for (let x = -1; x <= W; x += 1) {
      const k = inside(x, y);
      if (k < 0) {
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) >= 0)) fine(X + x, Y + y, '#2a1838');
        continue;
      }
      const [cx, cy, r] = clumps[k];
      // light from the top left of each clump, shade at the bottom right
      const l = ((cx - (x + 0.5)) + (cy - (y + 0.5))) / r;
      const th = ((x * 3 + y * 7) % 4) / 4 - 0.4;
      let c = l > 0.55 + th * 0.3 ? g : l < -0.5 + th * 0.3 ? d : G;
      if (c === G && hashXY(X + x, Y + y) < 0.12) c = d; // leaves
      if (c === g && hashXY(X + x, Y + y) > 0.9) c = '#ffffff';
      fine(X + x, Y + y, c);
    }
  }
}

/** How big a village house is, in map pixels (a size and a half of the HOUSE grid). */
const HOUSE_W = 15;
const HOUSE_H = 14;

/**
 * A cottage (30 x 28 fine pixels): a shingled roof with a chimney, two windows with
 * flower boxes, a door with a step, a timber frame and a shadow on the ground.
 */
function fineHouse(fine, X, Y, pal) {
  const R = pal.R; const r = pal.r || shade(R, 0.3); const W = pal.W || '#fff3d6'; const B = pal.B || '#4dabf7'; const D = pal.D || '#8b4513';
  const K = OUT;
  // shadow on the ground
  fine(X + 2, Y + 28, 'rgba(27,20,48,0.2)', 28, 1); fine(X + 28, Y + 15, 'rgba(27,20,48,0.16)', 2, 13);
  // chimney with a little smoke
  fine(X + 20, Y - 3, K, 6, 9); fine(X + 21, Y - 2, '#adb5bd', 4, 8); fine(X + 21, Y - 2, '#dee2e6', 4, 1); fine(X + 24, Y - 1, '#868e96', 1, 7);
  fine(X + 21, Y - 1, '#868e96', 4, 1);
  // roof: rows of shingles, wider as they go down, lit on the left
  for (let y = 0; y < 13; y += 1) {
    const half = 4 + y * 0.92; const x0 = Math.round(15 - half); const x1 = Math.round(15 + half);
    fine(X + x0 - 1, Y + y, K, x1 - x0 + 2, 1);
    for (let x = x0; x < x1; x += 1) {
      let c = R;
      if (y % 3 === 2) c = shade(R, -0.16); // the shadow under each row of shingles
      else if ((x + Math.floor(y / 3) * 2) % 4 === 0) c = shade(R, -0.1); // gaps between shingles
      if (x - x0 < 2 && y % 3 !== 2) c = r; // lit edge
      if (x1 - x < 2) c = shade(R, -0.22); // shaded edge
      fine(X + x, Y + y, c);
    }
  }
  fine(X + 10, Y - 1, K, 10, 1);
  fine(X + 11, Y, r, 8, 1); fine(X + 12, Y, '#ffffff', 2, 1);
  fine(X, Y + 13, K, 30, 1); fine(X + 1, Y + 12, shade(R, -0.35), 28, 1);
  // walls with a timber frame and a shadow under the eaves
  fine(X + 2, Y + 14, K, 26, 14);
  fine(X + 3, Y + 14, W, 24, 13);
  fine(X + 3, Y + 14, shade(W, -0.2), 24, 2);
  fine(X + 3, Y + 26, shade(W, -0.1), 24, 1);
  for (let x = 4; x < 26; x += 5) for (let y = 17; y < 26; y += 3) fine(X + x + (y % 2), Y + y, shade(W, -0.06), 2, 1); // plaster
  const window = (wx) => {
    fine(X + wx, Y + 16, K, 7, 7); fine(X + wx + 1, Y + 17, B, 5, 5);
    fine(X + wx + 1, Y + 17, shade(B, 0.5), 2, 1); fine(X + wx + 1, Y + 18, shade(B, 0.35), 1, 1);
    fine(X + wx + 3, Y + 17, K, 1, 5); fine(X + wx + 1, Y + 19, K, 5, 1);
    // a flower box under it
    fine(X + wx - 1, Y + 23, K, 9, 2); fine(X + wx, Y + 23, '#a0612f', 7, 1);
    for (let i = 0; i < 7; i += 2) fine(X + wx + i, Y + 22, i % 4 ? '#ffd43b' : '#ff6b6b');
    fine(X + wx + 1, Y + 22, '#2f9e44'); fine(X + wx + 5, Y + 22, '#2f9e44');
  };
  window(4);
  window(19);
  // the door with a knob, a little arched top, and a step
  fine(X + 12, Y + 17, K, 7, 11); fine(X + 13, Y + 17, K, 5, 1);
  fine(X + 13, Y + 18, D, 5, 9); fine(X + 13, Y + 18, shade(D, 0.25), 5, 1);
  fine(X + 15, Y + 19, shade(D, -0.25), 1, 8); fine(X + 17, Y + 22, '#fcc419');
  fine(X + 11, Y + 27, '#adb5bd', 9, 1); fine(X + 11, Y + 28, '#868e96', 9, 1);
}

/** A little picket fence in fine pixels: posts with pointed tops and two rails. */
function drawFence(fine, X, Y, w, c) {
  fine(X, Y + 2, OUT, w, 4);
  fine(X, Y + 3, c, w, 1);
  for (let x = 0; x < w; x += 4) {
    fine(X + x, Y, OUT, 3, 7); fine(X + x + 1, Y - 1, OUT, 1, 1);
    fine(X + x + 1, Y, shade(c, 0.25), 1, 6);
  }
}

/** Lighten (k > 0) or darken (k < 0) a #rrggbb color. */
function shade(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255]; const t = k > 0 ? [255, 255, 255] : [27, 20, 48]; const a = Math.abs(k);
  return `#${c.map((v, i) => Math.round(v + (t[i] - v) * a).toString(16).padStart(2, '0')).join('')}`;
}
const hashXY = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };

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
  canvas.width = aw * Z;
  canvas.dataset.z = Z;
  canvas.height = ah * Z;
  canvas.style.width = `${aw * SCALE}px`;
  canvas.style.height = `${ah * SCALE}px`;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(Z, 0, 0, Z, 0, 0);
  const { px, fine, sprite } = painter(ctx, aw, ah);
  const rnd = seeded(section.dataset.seed || 'map');
  const th = mapTheme(section.dataset.theme);

  const stops = JSON.parse(section.dataset.pts).map(([x, y, kind]) => ({ x: (x / 100) * aw, y: y / SCALE, kind }));
  const here = Number(section.dataset.here) || 0;
  let riverY = section.dataset.river ? Number(section.dataset.river) / SCALE : null;
  // the rainforest's waterfall needs a river: halfway down the map, between two stops
  if (th.falls && riverY === null && stops.length > 1) {
    const i = Math.max(1, Math.floor(stops.length / 2));
    riverY = Math.round((stops[i - 1].y + stops[i].y) / 2);
  }
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
    // a tuft of grass blades (or ripples, sand, dust) in fine pixels
    const fx = x * Z; const fy = y * Z;
    fine(fx, fy, groundDark, 3, 1); fine(fx + 1, fy - 1, groundDark); fine(fx + 3, fy - 1, groundDark);
    fine(fx + 1, fy - 2, groundLight); fine(fx + 3, fy - 2, groundLight);
  }
  // fine speckle all over, so open ground is not flat
  for (let i = 0; i < tufts * 3; i += 1) fine(Math.floor(rnd() * aw * Z), Math.floor(rnd() * ah * Z), rnd() < 0.5 ? groundDark : groundLight);

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
    const spot = spots[side === 'right' ? 1 : 0];
    return { ...(kind === 'pond' ? { ...spot, kind } : fieldSpot(spot, kind)), side };
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
  // it pours out of the wall on the side away from the bridge
  const falls = th.falls && band ? waterfallAt(band, wall, (band.bx0 + band.bx1) / 2 > aw / 2 ? -1 : 1) : null;
  if (falls) drawWaterfall(px, falls);

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
  // the road's edge in fine pixels, and grit on it
  const [, roadTop] = th.road.layers[th.road.layers.length - 1];
  for (const r of road) {
    if (inBand(r, 1)) continue;
    const g = hashXY(Math.round(r.x * 7), Math.round(r.y * 3));
    if (g < 0.5) fine((r.x - 2) * Z + Math.floor(g * 8), (r.y - 1) * Z + Math.floor(g * 5), shade(r.y > hereY ? roadTop : th.road.walked, -0.12));
    else if (g > 0.85) fine((r.x - 1) * Z + Math.floor(g * 4), r.y * Z, shade(r.y > hereY ? roadTop : th.road.walked, 0.15));
  }
  // pebbles along a dirt road, or planks and tiles across a built one
  for (let i = 0; i < road.length; i += th.road.stripes ? 4 : 7) {
    const r = road[i];
    if (inBand(r, 2)) continue;
    if (th.road.stripes && r.y > hereY) px(r.x - 3, r.y, th.road.stripes, 7, 1);
    else if (th.road.pebble && rnd() < 0.5) px(r.x + (rnd() < 0.5 ? -2 : 2), r.y, th.road.pebble);
  }
  if (band) drawBridge(px, band, th.bridge);
  ponds.forEach((p) => (p.kind === 'pond' ? drawPond(px, p, th, fine) : drawField(px, p, fine)));
  placePlayers(section, ponds.filter((p) => p.kind !== 'pond'));

  // the village at the start: houses on both sides of the road, more on wide screens
  const homes = aw > 140 ? [0.2, 0.33, 0.67, 0.8] : [0.24, 0.76];
  homes.forEach((f, i) => {
    const x = Math.round(aw * f - HOUSE_W / 2);
    const y = 2 + (i % 2) * 5;
    // other themes' houses are letter grids: draw them at a size and a half too
    sprite(x, y, th.house, { ...th.houseBase, ...th.housePals[i % th.housePals.length] }, 3);
    if (th.fence) drawFence(fine, x * Z - 4, (y + HOUSE_H) * Z + 1, HOUSE_W * Z + 8, th.fence);
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
    if (sp.flowers) {
      // a little flower in fine pixels: petals round a center, with a stem
      const fx = x * Z; const fy = y * Z;
      fine(fx, fy + 2, shade(groundDark, -0.1), 1, 2);
      fine(fx - 1, fy, c); fine(fx + 1, fy, c); fine(fx, fy - 1, c); fine(fx, fy + 1, c); fine(fx, fy, i % 2 ? '#fff3bf' : shade(c, -0.25));
      continue;
    }
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
    section, aw, ah, scale: SCALE, life: th.life, wall, falls,
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
export const POND_TOP = 46;
export const POND_HEIGHT = 13;
export function pondSpots(aw, wall) {
  const gap = 8; // room for the road
  const w = Math.floor(aw / 2) - gap - wall - 3;
  return [
    { x: wall + 3, y: POND_TOP, w, h: POND_HEIGHT },
    { x: Math.ceil(aw / 2) + gap, y: POND_TOP, w, h: POND_HEIGHT },
  ];
}

/**
 * A field sits in the middle of its pond spot, in proportions like the real thing:
 * a soccer pitch about 3 by 2, a hockey rink and a football field a little over 2 by 1.
 * On a narrow phone the spot sets the width, and the field gets as tall as it can.
 */
const FIELD_RATIO = { soccer: 1.5, hockey: 2.1, football: 2.2 };
export const FIELD_HEIGHT = 20;
export function fieldSpot(spot, kind) {
  const ratio = FIELD_RATIO[kind] || 1.6;
  const w = Math.min(spot.w, Math.round(FIELD_HEIGHT * ratio));
  const h = Math.min(FIELD_HEIGHT, Math.max(14, Math.round(w / ratio)));
  return { x: Math.round(spot.x + (spot.w - w) / 2), y: spot.y, w, h, kind };
}

/**
 * Put the players and their ball on the field they play on: the outer player at the end
 * near the wall, the inner one at the end near the road, feet a little below the middle.
 */
function placePlayers(section, fields) {
  const S = SCALE;
  for (const f of fields) {
    const game = section.querySelector(`.map-game[data-side="${f.side}"]`);
    if (game) {
      Object.assign(game.style, { left: `${(f.x + 3) * S}px`, width: `${(f.w - 6) * S}px`, top: `${(f.y + f.h * 0.62) * S}px` });
    }
    section.querySelectorAll(`.map-visitor.playing[data-play-side="${f.side}"]`).forEach((el) => {
      const outer = el.dataset.slot === '0';
      const leftEnd = outer === (f.side === 'left');
      el.style.left = `${(leftEnd ? f.x + 7 : f.x + f.w - 7) * S}px`;
      const body = el.querySelector('.visitor-buddy');
      const tall = body ? body.offsetHeight + (parseFloat(getComputedStyle(body).marginTop) || 0) : 48;
      el.style.top = `${(f.y + f.h * 0.72) * S - tall}px`;
    });
  }
}

/** A round pond in the map's river colors: water, lava, goo or stardust, with a bit of theme on top. */
function drawPond(px, { x, y, w, h }, th, fine = () => {}) {
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
  // fine detail: a light lip on the bank, ripples, and a darker band under the near bank
  for (let fx = (x - 2) * Z; fx < (x + w + 2) * Z; fx += 1) {
    for (let fy = (y - 3) * Z; fy < (y + h + 3) * Z; fy += 1) {
      const X = fx / Z; const Y = fy / Z; const ins = (g) => ((X - cx) / (w / 2 + g)) ** 2 + ((Y - cy) / (h / 2 + g)) ** 2 <= 1;
      if (ins(1.5) && !ins(1.5 - 1 / Z) && Y < cy) fine(fx, fy, shade(c.bank, 0.2));
      else if (ins(0) && !ins(-1 / Z)) fine(fx, fy, Y < cy ? shade(c.water, -0.15) : shade(c.water, 0.18));
    }
  }
  for (let i = 0; i < w; i += 5) {
    const fx = (x + i) * Z + (i % 3); const fy = Math.round((cy + 1 + ((i * 7) % 5) - 2) * Z);
    if (((fx / Z - cx) / (w / 2 - 1.5)) ** 2 + ((fy / Z - cy) / (h / 2 - 1.5)) ** 2 <= 1) fine(fx, fy, shade(c.water, 0.25), 3, 1);
  }
  const extra = POND_EXTRAS[th.pond] || POND_EXTRAS.lily;
  extra(px, { x, y, w, h, cx, cy }, undefined, fine);
}

// Little fields for visitors playing together: grass with white lines and goals,
// an ice rink with boards and nets, or a football field with end zones.
const FIELDS = {
  soccer: { ground: ['#40c057', '#51cf66'], line: '#ffffff', edge: '#2b8a3e', goal: '#ffffff' },
  hockey: { ground: ['#e7f5ff', '#d0ebff'], line: '#e03131', edge: '#495057', goal: '#e03131', blue: '#4dabf7' },
  football: { ground: ['#2f9e44', '#37b24d'], line: '#ffffff', edge: '#1b6e2e', ends: ['#e03131', '#1c7ed6'] },
};
function drawField(px, { x, y, w, h, kind }, fine = null) {
  const f = FIELDS[kind] || FIELDS.soccer;
  if (fine) return drawFineField(px, fine, { x, y, w, h, kind }, f);
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

/** The fields in fine pixels: mown stripes or ice, crisp one-fine-pixel lines, nets with mesh. */
function drawFineField(px, fine, { x, y, w, h, kind }, f) {
  const X = x * Z; const Y = y * Z; const FW = w * Z; const FH = h * Z;
  // the edge: boards round a rink, a darker border round grass, with a light top
  // a rink has rounded corners: how far a fine pixel is outside the rounded ice (0 inside)
  const R = kind === 'hockey' ? 9 : 0;
  const out = (i, j) => {
    if (!R) return Math.max(-i, i - FW + 1, -j, j - FH + 1, 0);
    const cx = Math.min(Math.max(i, R), FW - 1 - R); const cy = Math.min(Math.max(j, R), FH - 1 - R);
    return Math.max(0, Math.hypot(i - cx, j - cy) - R);
  };
  for (let i = -3; i < FW + 3; i += 1) {
    for (let j = -3; j < FH + 3; j += 1) {
      const d = out(i, j);
      if (d === 0) continue;
      // the boards: a light top rail on the rink, then the edge, then the outline
      if (d <= 1) fine(X + i, Y + j, kind === 'hockey' && j < FH / 2 ? '#ffffff' : f.edge);
      else if (d <= 2) fine(X + i, Y + j, f.edge);
      else if (d <= 3 && kind === 'hockey') fine(X + i, Y + j, OUT);
    }
  }
  if (kind !== 'hockey') fine(X - 2, Y - 2, OUT, FW + 4, 1), fine(X - 2, Y + FH + 1, OUT, FW + 4, 1), fine(X - 2, Y - 2, OUT, 1, FH + 4), fine(X + FW + 1, Y - 2, OUT, 1, FH + 4);
  for (let i = 0; i < FW; i += 1) {
    for (let j = 0; j < FH; j += 1) {
      if (out(i, j) > 0) continue;
      let c = kind === 'hockey' ? (hashXY(i, j) < 0.05 ? '#ffffff' : (i + 2 * j) % 23 === 0 ? f.ground[1] : f.ground[0]) : f.ground[Math.floor(i / 6) % 2];
      if (kind !== 'hockey' && hashXY(i, j) < 0.07) c = shade(c, -0.1);
      fine(X + i, Y + j, c);
    }
  }
  const mid = X + Math.floor(FW / 2);
  const L = (a, b, ww, hh, c = f.line) => fine(a, b, c, ww, hh);
  if (kind === 'soccer') {
    L(X + 1, Y + 1, FW - 2, 1); L(X + 1, Y + FH - 2, FW - 2, 1); L(X + 1, Y + 1, 1, FH - 2); L(X + FW - 2, Y + 1, 1, FH - 2);
    L(mid, Y + 1, 1, FH - 2);
    // the center circle
    const r = Math.min(FH * 0.28, 7); const cy = Y + FH / 2;
    for (let a = 0; a < 360; a += 6) fine(Math.round(mid + Math.cos((a * Math.PI) / 180) * r), Math.round(cy + Math.sin((a * Math.PI) / 180) * r), f.line);
    fine(mid - 1, Math.round(cy) - 1, f.line, 3, 2);
    // penalty boxes and goals with nets
    for (const side of [0, 1]) {
      const bx = side ? X + FW - 2 - 7 : X + 1; const by = Y + Math.round(FH * 0.25);
      L(bx, by, 8, 1); L(bx, Y + Math.round(FH * 0.75), 8, 1); L(side ? bx : bx + 7, by, 1, Math.round(FH * 0.5) + 1);
      const gx = side ? X + FW : X - 4; const gy = Y + Math.round(FH * 0.32); const gh = Math.round(FH * 0.36);
      fine(gx, gy, OUT, 4, gh + 1);
      for (let j = 1; j < gh; j += 1) for (let i = 0; i < 3; i += 1) fine(gx + i + (side ? 0 : 1), gy + j, (i + j) % 2 ? '#dee2e6' : '#adb5bd');
      fine(gx, gy, f.goal, 4, 1); fine(gx, gy + gh, f.goal, 4, 1);
    }
  } else if (kind === 'hockey') {
    L(mid, Y, 2, FH);
    for (const bx of [X + Math.floor(FW / 3), X + Math.ceil((2 * FW) / 3)]) L(bx, Y, 2, FH, f.blue);
    // red goal lines near each end, curving with the boards
    for (const gl of [X + 6, X + FW - 7]) for (let j = 0; j < FH; j += 1) if (out(gl - X, j) === 0) fine(gl, Y + j, f.line);
    // face-off dots in each end
    for (const fx of [X + Math.round(FW * 0.18), X + Math.round(FW * 0.82)]) for (const fy of [Y + Math.round(FH * 0.27), Y + Math.round(FH * 0.73)]) fine(fx - 1, fy - 1, f.line, 2, 2);
    const cy = Y + FH / 2; const r = Math.min(FH * 0.22, 6);
    for (let a = 0; a < 360; a += 8) fine(Math.round(mid + Math.cos((a * Math.PI) / 180) * r), Math.round(cy + Math.sin((a * Math.PI) / 180) * r), f.blue);
    fine(mid - 1, Math.round(cy) - 1, f.line, 4, 3);
    for (const side of [0, 1]) {
      // goal crease and net
      const gx = side ? X + FW - 10 : X + 6; const gy = Y + Math.round(FH * 0.36); const gh = Math.round(FH * 0.28);
      for (let j = 0; j < gh; j += 1) fine(side ? gx - 3 : gx + 4, gy + j, '#a5d8ff', 3, 1);
      fine(gx, gy, f.goal, 4, 1); fine(gx, gy + gh, f.goal, 4, 1); fine(side ? gx + 3 : gx, gy, f.goal, 1, gh + 1);
      for (let j = 1; j < gh; j += 1) for (let i = 0; i < 3; i += 1) fine(gx + i + (side ? 0 : 1), gy + j, (i + j) % 2 ? '#ffffff' : '#ced4da');
    }
  } else {
    fine(X, Y, f.ends[0], 8, FH); fine(X + FW - 8, Y, f.ends[1], 8, FH);
    for (let i = 8; i < FW - 8; i += 8) L(X + i, Y, 1, FH);
    for (let i = 12; i < FW - 8; i += 8) { L(X + i, Y + 2, 1, 1); L(X + i, Y + FH - 3, 1, 1); }
    L(X + 1, Y + 1, FW - 2, 1); L(X + 1, Y + FH - 2, FW - 2, 1);
    for (const gx of [X + 2, X + FW - 3]) { fine(gx, Y - 7, '#ffd43b', 1, 7); fine(gx - 2, Y - 7, '#ffd43b', 5, 1); fine(gx - 2, Y - 11, '#ffd43b', 1, 4); fine(gx + 2, Y - 11, '#ffd43b', 1, 4); }
  }
}

const POND_EXTRAS = {
  // lily pads with a pink flower
  lily: (px, { x, y, w }, _c, fine) => {
    if (!fine) { px(x + 4, y + 3, '#40c057', 3, 2); px(x + 5, y + 3, '#ff8fa3'); px(x + w - 7, y + 8, '#40c057', 3, 2); return; }
    // round pads with a notch, one with a flower
    for (const [lx, ly, flower] of [[x + 4, y + 3, true], [x + w - 7, y + 8, false], [x + Math.floor(w / 2) + 3, y + 2, false]]) {
      const fx = lx * Z; const fy = ly * Z;
      fine(fx, fy + 1, '#2b8a3e', 6, 3); fine(fx + 1, fy, '#2b8a3e', 4, 5);
      fine(fx + 1, fy + 1, '#51cf66', 4, 2); fine(fx + 2, fy + 1, '#8ce99a', 2, 1); fine(fx + 3, fy + 2, '#2b8a3e', 2, 1);
      if (flower) { fine(fx + 1, fy - 2, '#ffdeeb', 3, 2); fine(fx + 2, fy - 3, '#ff8fa3'); fine(fx + 2, fy - 1, '#ffd43b'); }
    }
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

/**
 * The rainforest waterfall: a mossy cliff in the forest wall with water pouring off it into the
 * river. The water moves, and things come over it, in maplife.js.
 */
function drawWaterfall(px, f) {
  const top = f.lip - 4;
  const bottom = f.base;
  const inner = f.side < 0 ? f.x1 + 6 : f.x0 - 6; // the cliff's edge facing the open ground
  const x0 = f.side < 0 ? 0 : inner;
  const x1 = f.side < 0 ? inner : f.aw;
  for (let y = top; y <= bottom; y += 1) {
    const grow = Math.round((y - top) * 0.12);
    const a = f.side < 0 ? x0 : x0 - grow;
    const b = f.side < 0 ? x1 + grow : x1;
    px(a, y, OUT, b - a, 1);
    px(a + (f.side < 0 ? 0 : 1), y, '#6c757d', b - a - 1, 1);
    for (let x = a; x < b; x += 1) if ((x * 7 + y * 3) % 23 === 0) px(x, y, '#495057', 3, 1);
  }
  // moss on top, hanging down the rock
  px(x0, top - 2, OUT, x1 - x0, 4);
  px(x0 + (f.side < 0 ? 0 : 1), top - 2, '#2f9e44', x1 - x0 - 1, 3);
  for (let x = x0; x < x1; x += 3) { px(x, top + 1, '#2f9e44', 2, 2 + ((x * 3) % 5)); px(x + 1, top - 3, '#51cf66', 1, 1); }
  // the water coming over the edge
  px(f.x0 - 1, f.lip - 1, OUT, f.x1 - f.x0 + 3, f.base - f.lip + 1);
  px(f.x0, f.lip - 1, '#4dabf7', f.x1 - f.x0 + 1, f.base - f.lip + 1);
  px(f.x0, f.lip - 1, '#a5d8ff', f.x1 - f.x0 + 1, 2);
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
  const base = ctx.getImageData(0, band.top * Z, band.aw * Z, h * Z);
  let phase = 0;
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(timers.get(canvas)); return; }
    ctx.putImageData(base, 0, band.top * Z);
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
