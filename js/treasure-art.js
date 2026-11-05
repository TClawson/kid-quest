// Pixel art for the treasure: chests, trophies, map pieces and the hidden spot on each map.
// Same 16-bit style as the map: letter grids, one letter per color, wrapped in a dark outline.
// Everything comes out as an SVG string, so it works in the app and in tests.

import { LANDMARKS } from './landmarks.js';

const OUT = '#2a1838';

/** Wrap a grid's shape in an outline ring of K (like sprite() in maplife.js). */
export function outlined(rows) {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.'));
  const at = (x, y) => (y >= 0 && y < g.length && x >= 0 && x < w ? g[y][x] : '.');
  const out = [];
  for (let y = -1; y <= g.length; y += 1) {
    let row = '';
    for (let x = -1; x <= w; x += 1) {
      const c = at(x, y);
      if (c !== '.') row += c;
      else row += [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.') ? 'K' : '.';
    }
    out.push(row);
  }
  return out;
}

const widthOf = (rows) => Math.max(...rows.map((r) => r.length));

/** A little pixel canvas: layers of grids, later ones on top. */
class Pix {
  constructor(w, h) { this.w = w; this.h = h; this.cells = new Map(); }
  /** Paint a grid at (x, y). With outline, x/y is where the fill starts (the ring sits around it). */
  put(x, y, rows, pal, outline = true) {
    const g = outline ? outlined(rows) : rows;
    const ox = outline ? x - 1 : x;
    const oy = outline ? y - 1 : y;
    g.forEach((row, yy) => {
      for (let xx = 0; xx < row.length; xx += 1) {
        const ch = row[xx];
        if (ch === '.') continue;
        const col = ch === 'K' ? OUT : pal[ch];
        if (!col) continue;
        const cx = ox + xx;
        const cy = oy + yy;
        if (cx >= 0 && cy >= 0 && cx < this.w && cy < this.h) this.cells.set(`${cx},${cy}`, col);
      }
    });
    return this;
  }
  rects() {
    let out = '';
    for (let y = 0; y < this.h; y += 1) {
      let x = 0;
      while (x < this.w) {
        const c = this.cells.get(`${x},${y}`);
        if (!c) { x += 1; continue; }
        let n = 1;
        while (x + n < this.w && this.cells.get(`${x + n},${y}`) === c) n += 1;
        out += `<rect x="${x}" y="${y}" width="${n}" height="1" fill="${c}"/>`;
        x += n;
      }
    }
    return out;
  }
}

const svgOf = (w, h, scale, cls, body) => `<svg class="pixel ${cls}" viewBox="0 0 ${w} ${h}" width="${w * scale}" height="${h * scale}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${body}</svg>`;

// ---------- chests ----------

export const CHEST_CLOSED = [
  '..hhhhhhhhhhhhhh..',
  '.hWWWWWWBBWWWWWWh.',
  'BWWWWWWWBBWWWWWWWB',
  'BwwwwwwwBBwwwwwwwB',
  'BBBBBBBLLLLBBBBBBB',
  'BWWWWWWLllLWWWWWWB',
  'BWWWWWWLllLWWWWWWB',
  'BWWWWWWWLLWWWWWWWB',
  'BWWWWWWWWWWWWWWWWB',
  'BwwwwwwwwwwwwwwwwB',
  'BBBBBBBBBBBBBBBBBB',
];
const CHEST_OPEN = [
  '.BddddddddddddddB.',
  '.BddddddddddddddB.',
  '.BddddddddddddddB.',
  '.BBBBBBBBBBBBBBBB.',
  'BgGgGyGgGGgGyGgGgB',
  'BBBBBBBLLLLBBBBBBB',
  'BWWWWWWLllLWWWWWWB',
  'BWWWWWWLllLWWWWWWB',
  'BWWWWWWWLLWWWWWWWB',
  'BwwwwwwwwwwwwwwwwB',
  'BBBBBBBBBBBBBBBBBB',
];
export const CHEST_PALS = {
  wood: { h: '#d39556', W: '#b5733a', w: '#8a5226', B: '#6c757d', L: '#fcc419', l: '#e67700', d: '#5c3a1e' },
  silver: { h: '#f8f9fa', W: '#ced4da', w: '#adb5bd', B: '#4c6ef5', L: '#fcc419', l: '#e67700', d: '#495057' },
  gold: { h: '#fff3bf', W: '#fcc419', w: '#f08c00', B: '#c92a2a', L: '#e64980', l: '#a61e4d', d: '#7a4a10' },
};
const GLOW = { g: '#fcc419', G: '#ffe066', y: '#ffffff' };

/** A chest: tier 'wood' | 'silver' | 'gold', open or shut. */
export function chestSvg(tier = 'wood', open = false, scale = 3) {
  const rows = open ? CHEST_OPEN : CHEST_CLOSED;
  const p = new Pix(20, 13).put(1, 1, rows, { ...CHEST_PALS[tier] || CHEST_PALS.wood, ...GLOW });
  return svgOf(20, 13, scale, `chest-svg chest-${tier}`, p.rects());
}

// ---------- trophies ----------
// Each trophy stands on a little wooden plinth. Most are gold; a few keep their colors.

const GOLD = { G: '#ffe066', g: '#f59f00', D: '#e67700', W: '#fff3bf' };
const FIGURES = {
  acorn: [[
    '.....c.....',
    '...ccccc...',
    '..cCcCcCc..',
    '.cCcCcCcCc.',
    '.ccccccccc.',
    '..GWGGGGG..',
    '..GWGGGGg..',
    '..GGGGGGg..',
    '...GGGGg...',
    '....GGg....',
    '.....g.....',
  ], { ...GOLD, c: '#b5733a', C: '#d39556' }],
  crab: [[
    'rr...........rr',
    'r.r..e...e..r.r',
    'rrr..K...K..rrr',
    '.r...r...r...r',
    '..rrrrrrrrrrr',
    '...rlllllllr',
    '...rrrrrrrrr',
    '..r.r.r.r.r.r',
    '.r..r.....r..r',
  ], { r: '#fcc419', l: '#fff3bf', e: '#ffffff' }],
  tooth: [[
    'c............c',
    '.c..........c.',
    '..WWWWWWWWWW..',
    '..WWWWWWWWWw..',
    '...WWWWWWWw...',
    '...WWWWWWWw...',
    '....WWWWWw....',
    '....WWWWWw....',
    '.....WWWw.....',
    '.....WWWw.....',
    '......Ww......',
  ], { c: '#a0612f', W: '#f8f9fa', w: '#ced4da' }],
  rocket: [[
    '.....rr',
    '....lrrR',
    '...lrrrrR',
    '...wwwwwW',
    '...wwbbwW',
    '...wbBbbW',
    '...wbbbbW',
    '...wwbbwW',
    '...wwwwwW',
    '...rrrrrR',
    '..rwwwwwWr',
    '.rrwwwwwWrr',
    'rrrwwwwwWrrR',
    'rrR.gggg.rrR',
  ], { r: '#e03131', R: '#a51d1d', l: '#ff8787', w: '#f8f9fa', W: '#ced4da', b: '#4dabf7', B: '#d0ebff', g: '#868e96' }],
  alien: [[
    '.y........y',
    '..a......a',
    '...gggggg',
    '..lllggggg',
    '.glKKggKKgg',
    '.glKeggKegg',
    '.ggggggggdg',
    '..gggKKggg',
    '...dggggd',
    '....dddd',
    '..gggggggg',
    '.g.gggggg.g',
    '...gggggg',
    '...gg..gg',
  ], { g: '#69db7c', l: '#b2f2bb', d: '#2f9e44', y: '#ffd43b', a: '#2f9e44', e: '#ffffff' }],
  egg: [[
    '....EEEE....',
    '..EEEEEEEE..',
    '.EElEEEEsEE.',
    '.ElEEsEEEEe.',
    'EElEEEEEEEEe',
    'EEEEEEEEsEEe',
    'EEsEEEEEEEEe',
    'EEEEEEsEEEEe',
    '.EEEEEEEEEe.',
    '.eEEEsEEEee.',
    '..eeeeeeee..',
  ], { E: '#8ce99a', e: '#40c057', l: '#d3f9d8', s: '#2b8a3e' }],
  helmet: [[
    '......pp....',
    '.....ppp....',
    '....pp......',
    '...SSSSSS...',
    '..SWSSSSSs..',
    '.SWSSSSSSss.',
    '.SKKKKKKKKs.',
    '.SSSSSSSSss.',
    '.SSaSaSaSss.',
    '.SSSSSSSSss.',
    '..SSSSSSss..',
  ], { p: '#e03131', S: '#dee2e6', W: '#ffffff', s: '#868e96', a: '#495057' }],
  tiki: [[
    '..g.y.g.r',
    '.rgyryg.g',
    '..MMMMMM',
    '.MMMMMMMM',
    '.MeKMMeKM',
    '.MMMmmMMM',
    '.MMMmmMMM',
    '.MtttttMM',
    '.MKKKKKMM',
    '..mmmmmm',
  ], { M: '#c97d3a', m: '#8a5226', e: '#ffd43b', t: '#ffffff', g: '#40c057', y: '#ffd43b', r: '#e03131' }],
  horn: [[
    '.....y.....',
    '.....yY....',
    '....yyY....',
    '....YyyY...',
    '...yyYYy...',
    '...YYyyY...',
    '..yyyYYyy..',
    '..YYYyyyY..',
    '.yyyyYYYyy.',
    '.YYYYyyyyY.',
    'MMNNPPMMNNP',
  ], { y: '#fff3bf', Y: '#fcc419', M: '#f783ac', N: '#74c0fc', P: '#b197fc' }],
  saucer: [[
    '.....dddd.....',
    '....dAAAAd....',
    '...dAKAAKAd...',
    '...dAAAAAAd...',
    '.SSSSSSSSSSSS.',
    'SLSSLSSLSSLSSL',
    '.ssssssssssss.',
    '...oooooooo...',
  ], { d: '#a5d8ff', A: '#ffd43b', S: '#ffe066', s: '#f59f00', L: '#ffffff', o: '#e67700' }],
  fish: [[
    '........ff',
    '.......ffff',
    '......llwlll',
    'ff...lllwlllll',
    'fff.oooowoooooeK',
    '.ffooooowoooooooo',
    '..fooooowooooooo',
    '.ff.ddddwdddddd',
    'fff..dddwdddd',
    'ff....ddwdd',
    '.......ff',
  ], { o: '#fcc419', l: '#fff3bf', d: '#f08c00', w: '#ffffff', f: '#f59f00', e: '#ffffff' }],
  ball: [[
    '...GGGGG...',
    '.GGGGDGGGG.',
    '.GWGDDDGGG.',
    'GWGGGDGGGGG',
    'GDGGGGGGGDG',
    'DDDGGGGGDDD',
    'GDGGGGGGGDg',
    'GGGGGDGGGgg',
    '.GGGDDDGgg.',
    '.GGGGDGggg.',
    '...ggggg...',
  ], GOLD],
  puck: [[
    '..GGGGGGGG..',
    '.GWWGGGGGGG.',
    'GGGGGGGGGGGG',
    'gDDDDDDDDDDg',
    'gggggggggggg',
    '.gggggggggg.',
    '..gggggggg..',
  ], GOLD],
  football: [[
    '....GGGGG....',
    '..GGWGGGGGG..',
    '.GWGWGWGWGGG.',
    'GGGGWWWWWGGGg',
    '.GGGWGWGWGGg.',
    '..ggGGGGGgg..',
    '....ggggg....',
  ], { ...GOLD, W: '#ffffff' }],
  piano: [[
    'BBBBBBBBBBBBBB',
    'BbbbbbbbbbbbbB',
    'BbbbYbbbbYbbbB',
    'BBBBBBBBBBBBBB',
    'WKWKWWKWKWKWWW',
    'WKWKWWKWKWKWWW',
    'WWWWWWWWWWWWWW',
    'BBBBBBBBBBBBBB',
    'BbBbbbbbbbbBbB',
    'B.B........B.B',
  ], { B: '#343a40', b: '#495057', Y: '#ffd43b', W: '#ffffff' }],
};
const MAP_SCROLL = [
  'qqPPPPPPPPPPPPqq',
  'qPPggPPPPPPPPPPq',
  'qPgggggPPPPPPPPq',
  'qPPgggPPdPPggPPq',
  'qPPPPPPdPdPgggPq',
  'qPPPPPdPPPdPPPPq',
  'qPPPPdPPPPPrPrPq',
  'qPPPPPPPPPPPrPPq',
  'qPPPPPPPPPPrPrPq',
  'qqPPPPPPPPPPPPqq',
];
const PLINTH = ['..PPPPPPPPPPPP..', '.pppppppppppppp.', 'pppppppppppppppp'];
const PLINTH_PAL = { P: '#b5733a', p: '#8a5226' };

function standOn(rows, pal) {
  const fw = widthOf(rows);
  const w = Math.max(fw, 16) + 4;
  const h = rows.length + PLINTH.length + 4;
  const p = new Pix(w, h);
  p.put(Math.floor((w - 16) / 2), h - PLINTH.length - 1, PLINTH, PLINTH_PAL);
  p.put(Math.floor((w - fw) / 2), h - PLINTH.length - 2 - rows.length, rows, pal);
  return p;
}

/** A trophy from TROPHIES, or 'map-<background id>' for a finished treasure map. ground colors the map's land. */
export function trophySvg(id, { scale = 3, ground = '#69db7c', locked = false } = {}) {
  let rows;
  let pal;
  if (id.startsWith('map-')) {
    rows = MAP_SCROLL;
    pal = { q: '#c9a24a', P: '#fff3d6', g: ground, d: '#a0612f', r: '#e03131' };
  } else {
    [rows, pal] = FIGURES[id] || FIGURES.acorn;
  }
  if (locked) pal = Object.fromEntries([...Object.keys(pal), 'K'].map((k) => [k, '#5c4d6b']));
  const p = standOn(rows, pal);
  return svgOf(p.w, p.h, scale, `trophy-svg ${locked ? 'locked' : ''}`, p.rects());
}

/** The treasure map for one map: PIECES_PER_MAP quarters, the found ones filled in. */
export function mapPiecesSvg(found, total = 4, { scale = 3, ground = '#69db7c' } = {}) {
  const pal = { q: '#c9a24a', P: '#fff3d6', g: ground, d: '#a0612f', r: '#e03131' };
  const hidden = { q: '#4a3d57', P: '#3a2f45', g: '#3a2f45', d: '#3a2f45', r: '#3a2f45' };
  const w = widthOf(MAP_SCROLL);
  const h = MAP_SCROLL.length;
  // the quarters: top-left, top-right, bottom-left, bottom-right
  const quarter = (i) => MAP_SCROLL.map((row, y) => [...row].map((ch, x) => {
    const q = (y >= h / 2 ? 2 : 0) + (x >= w / 2 ? 1 : 0);
    return q === i ? ch : '.';
  }).join(''));
  const p = new Pix(w + 2, h + 2);
  for (let i = 0; i < total; i += 1) p.put(1, 1, quarter(i), i < found ? pal : hidden, false);
  p.put(1, 1, outlined(MAP_SCROLL).map((r) => r.replace(/[^K]/g, '.')).slice(1, -1).map((r) => r.slice(1, -1)), {}, false);
  const ring = new Pix(w + 2, h + 2).put(1, 1, MAP_SCROLL.map((r) => r.replace(/[^.]/g, 'x')), { x: 'none' });
  for (const [k, c] of ring.cells) if (c === OUT && !p.cells.has(k)) p.cells.set(k, OUT);
  return svgOf(w + 2, h + 2, scale, 'map-pieces-svg', p.rects());
}

// ---------- hidden spots, one per map ----------
// Each has a resting look and two frames it flips between when tapped.

const brick = (w, h, a, b) => Array.from({ length: h }, (_, y) => Array.from({ length: w }, (_, x) => ((y % 3 === 2) || ((x + (Math.floor(y / 3) % 2) * 3) % 6 === 0) ? b : a)).join(''));

export const SHIP = [
  '...........M............',
  '...........MFF..........',
  '...........MFFF.........',
  '...........MFFFF........',
  '...........MFF..........',
  '...........M............',
  '..HH.......M............',
  '..HHHHHHHHHHHHHHHHH.....',
  '...HhHHHHHHHHHHHHhHH....',
  '...HHhHHwHHHHwHHHHHH....',
  '....HHHHHHHHHHHHHHH.....',
  '.....hHHHhHHHHHHHh......',
];
const SAND = ['ssssssssssssssssssssssssss', '.ssSsssssssSssssssSsssss.'];

const OWL_TREE = [
  '......LLLLLLLL......',
  '....LLLLLLLLLLLL....',
  '..LLLLlLLLLLLlLLLL..',
  '.LLlLLLLLLlLLLLLLLL.',
  'LLLLLLLLLLLLLLLlLLLL',
  'LLLlLLLLLLLLLLLLLLLL',
  '.LLLLLLLlLLLLLLLlLL.',
  '..LLLLLLLLLLLLLLLL..',
  '....TTTTTTTTTTTT....',
  '....TTTTTTTTTTTt....',
  '....TTHHHHHHHHTt....',
  '....THHHHHHHHHHt....',
  '....THHHHHHHHHHt....',
  '....THHHHHHHHHHt....',
  '....THHHHHHHHHHt....',
  '....TTHHHHHHHHTt....',
  '....TTTTTTTTTTTt....',
  '....TTTtTTTTTTTt....',
  '...TTTTTTTTTTTTtt...',
  '..TTt.TTTTTTt.TTt...',
];
const OWL = (eyes) => ['.o....o.', ...eyes, 'OOOnnOOO', 'OwOOOOwO', '.OOOOOO.'];
const MOUND = [
  '.........RRRRRR.........',
  '......RRRRRRRRRRRR......',
  '....RRRRrRRRRRRRRRRR....',
  '...RRRRRRRRRRRRRrRRRR...',
  '..RRRrRRRDDDDDDRRRRRRR..',
  '..RRRRRRDDDDDDDDRRRRRR..',
  '.RRRRRRDDDDDDDDDDRRrRRR.',
  '.RRrRRRDDDDDDDDDDRRRRRR.',
  'RRRRRRRDDDDDDDDDDRRRRRRR',
  'RRRRRRRDDDDDDDDDDRRRRRRR',
  'RRRRRrRDDDDDDDDDDRRRrRRR',
];
const MOONY = ['..CCCCCC..', '.CCCCCCCC.', 'CCWKCCWKCC', 'CCCCppCCCC', 'CCCCCCCCCC', '.CCCCCCCC.'];
const HEAD = (eyes, mouth) => [
  '....SSSSSSSSSS....',
  '...SSSSSSSSSSSS...',
  '..SSSSSSSSSSSSSs..',
  '..SSSSSSSSSSSSss..',
  '..SBBBBSSSSBBBBs..',
  `..S${eyes}Ss..`,
  '..SSSSSSnnSSSSss..',
  '..SSSSSSnnSSSSss..',
  '..SSSSSnnnnSSSss..',
  '..SSSSSSSSSSSSss..',
  ...mouth,
  '..SSSSSSSSSSSSss..',
  '...SSSSSSSSSSss...',
  'gggsssssssssssgggg',
  'gggggggggggggggggg',
];
const POT = [
  '..GGgGGGgGGG..',
  '.GGGGWGGGGGGG.',
  'BBBBBBBBBBBBBB',
  '.BBBBBBBBBBBB.',
  'BBbBBBBBBBBBBB',
  'BBbBBBBBBBBBBB',
  'BBBBBBBBBBBBBB',
  '.BBBBBBBBBBBB.',
  '..BBBBBBBBBB..',
  '..B........B..',
];
const FOAL = [
  '.........y..',
  '........yW..',
  '.......WWWW.',
  '......WWKWWp',
  '..MNM.WWWWW.',
  '.MWWWWWWW...',
  'MWWWWWWWW...',
  '.WWWWWWWW...',
  '.W.W..W.W...',
  '.h.h..h.h...',
];
export const WHALE = (eye) => [
  '.........BBBBBBBB.............',
  '.......BBBBBBBBBBBB.........T.',
  '.....BBBBBBBBBBBBBBBB.....TT..',
  '....BBBsBBBBBBBsBBBBBB...TT...',
  '...BBBBBBBBBBBBBBBBBBBBBBT....',
  `..BB${eye}BBBBBBBBBBBBBBBBBBBBB....`,
  '..BBBBBBBBBBBBBBBBBBBBBBBTT...',
  '.mmmmmBBBBBBBBBBBBBBBBB..TT...',
  '..wwwwwwwwwwwwwwBBBBB......T..',
  '....wwwwwwwwwwwww.............',
];
const SPOUT = (h) => ['y.y.y', '.y.y.', 'y.y.y', ...Array(h).fill('..y..')];

/**
 * The hidden spots. Each: name, the line said when tapped, size, and frames(i) giving the layers
 * for frame 0 (resting) and 1/2 (the two it flips between when tapped): [[x, y, rows, pal, outline?]].
 */
export const SECRETS = {
  'bg-meadow': {
    name: 'The Great Oak',
    lines: ['Hoo! Hoo! You found my tree!', 'Hoo! I keep watch all night.', 'Hoo-hoo! Shh, it’s nap time.'],
    w: 22, h: 22,
    frames: (i) => {
      const pal = { L: '#2f9e44', l: '#69db7c', T: '#8b5a2b', t: '#5c3a1e', H: '#2a1838', O: '#c98a4b', o: '#8a5226', w: '#f1d3a5', n: '#fcc419', '-': '#5c3a1e', Y: '#ffe066' };
      const eyes = [['OOOOOOOO', 'O--OO--O'], ['OYYOOYYO', 'OYKOOYKO'], ['OYYOOOOO', 'OYKOO--O']][i];
      return [[1, 1, OWL_TREE, pal], [7, 11, OWL(eyes), pal, false]];
    },
  },
  'bg-sunset': {
    name: 'The ghost ship wreck',
    lines: ['A bottle! The note says: “Ahoy, treasure hunter!”', 'The note says: “Keep it up, matey!”', 'The note says: “X marks the spot!”'],
    w: 28, h: 17,
    frames: (i) => {
      const pal = { M: '#5c3a1e', F: '#f8f9fa', H: '#8b5a2b', h: '#5c3a1e', w: '#2a1838', s: '#f6e0a3', S: '#e9c46a', G: '#69db7c', P: '#fff3d6', c: '#a0612f' };
      const layers = [[1, 1, SHIP, pal], [1, 14, SAND, pal]];
      if (i) layers.push([22, i === 1 ? 9 : 8, ['.c.', '.G.', 'GGG', 'GPG', 'GGG'], pal]);
      return layers;
    },
  },
  'bg-ocean': {
    name: 'The Kraken’s ship',
    lines: ['An octopus! It squirts ink and giggles.', 'Blub blub! This ship is my house.', 'Boo! Got you with my ink!'],
    w: 28, h: 20,
    frames: (i) => {
      const pal = { M: '#495057', F: '#96f2d7', H: '#5c4d3a', h: '#3d3326', w: '#1a1028', s: '#e9c46a', S: '#c9a24a', P: '#b197fc', W: '#ffffff', i: '#343a40' };
      const octo = ['..PPPP..', '.PPPPPP.', 'PWKPPWKP', 'PPPPPPPP', '.PPPPPP.', 'P.P.P.P.', '.P.P.P.P'];
      const layers = [[13, i ? 3 : 8, octo, pal], [1, 4, SHIP, pal], [1, 17, SAND, pal]];
      if (i === 2) layers.push([22, 2, ['.ii.', 'iiii', 'iiii', '.ii.'], pal], [5, 3, ['.ii', 'iii', '.i.'], pal]);
      return layers;
    },
  },
  'bg-space': {
    name: 'The moon worm’s cave',
    lines: ['A sleepy moon puff! It yawns hello.', 'Moon puff says: boop!', 'Moon puff waves. Bye!'],
    w: 26, h: 16,
    frames: (i) => {
      const pal = { R: '#ced4da', r: '#868e96', D: '#1a1028', C: '#e5dbff', W: '#ffffff', p: '#f783ac', z: '#a5d8ff', '-': '#868e96' };
      const layers = [[1, 4, MOUND, pal]];
      if (!i) layers.push([10, 11, ['--..--'], pal, false], [19, 1, ['zzz', '.z.', 'zzz'], pal, false]);
      else layers.push([8, i === 1 ? 8 : 7, MOONY, pal]);
      return layers;
    },
  },
  'bg-castle': {
    name: 'The Dragon King’s door',
    lines: ['A baby dragon guarding gold! It sneezes a spark.', 'Rawr! (That’s dragon for hi.)', 'The baby dragon counts its coins.'],
    w: 26, h: 20,
    frames: (i) => {
      const pal = { S: '#adb5bd', s: '#868e96', D: '#8b5a2b', d: '#5c3a1e', r: '#fcc419', x: '#1a1028', g: '#fcc419', G: '#ffe066', L: '#69db7c', l: '#2f9e44', e: '#ffffff', f: '#ff922b' };
      const door = i
        ? ['.xxxxxxxx.', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xxxxxxxxxx', 'xGgGxxgGgx', 'GgGgGgGgGg', 'gGgGgGgGgG']
        : ['.DDDDDDDD.', 'DDdDDDdDDD', 'DDdDDDdDDD', 'DDdDDDdDDD', 'DDdDDDdDDD', 'DDdDDDdDrD', 'DDdDDDdDrD', 'DDdDDDdDDD', 'DDdDDDdDDD', 'DDdDDDdDDD', 'DDdDDDdDDD'];
      const layers = [[1, 1, brick(24, 18, 'S', 's'), pal], [8, 8, door, pal, false]];
      if (i) {
        layers.push([10, i === 1 ? 10 : 9, ['.L....L.', 'LLLLLLLL', 'LeKLLeKL', 'LLLLLLLL', '.LllllL.'], pal]);
        if (i === 2) layers.push([18, 11, ['ff', '.f'], pal, false]);
      }
      return layers;
    },
  },
  'bg-volcano': {
    name: 'The fire stone face',
    lines: ['The stone face opens its eyes. RUMBLE!', 'It says: “WHO… IS… TICKLING… ME?”', 'The stone face winks at you.'],
    w: 20, h: 20,
    frames: (i) => {
      const pal = { S: '#868e96', s: '#495057', B: '#495057', e: i ? '#ff6b6b' : '#495057', E: i ? '#ffe066' : '#495057', n: '#6c757d', M: '#343a40', m: '#1a1028', g: '#40c057' };
      const eyes = i === 2 ? 'EeeSSSSSSssS' : i ? 'EeeSSSSSSEeeS'.slice(0, 12) : 'SeeSSSSSSeeS';
      const mouth = i === 2 ? ['..SSSmmmmmmSss..', '..SSSSmmmmSSss..'] : ['..SSSMMMMMMMSss..'.slice(0, 18)];
      const rows = HEAD(eyes, mouth).map((r) => r.padEnd(18, '.').slice(0, 18));
      return [[1 + (i === 2 ? 1 : 0), 1, rows, pal]];
    },
  },
  'bg-rainbow': {
    name: 'The pot of gold',
    lines: ['A baby unicorn! It neighs a little rainbow.', 'The baby unicorn nuzzles the gold.', 'Neigh! Want to race?'],
    w: 30, h: 15,
    frames: (i) => {
      const pal = { G: '#fcc419', g: '#f08c00', W: '#ffffff', B: '#343a40', b: '#868e96', y: '#ffe066', p: '#f783ac', M: '#f783ac', N: '#74c0fc', h: '#b197fc', s: '#ffffff' };
      const layers = [[1, 4, POT, pal]];
      if (i) layers.push([17, i === 1 ? 4 : 3, FOAL, pal]);
      if (i === 2) layers.push([16, 1, ['s.s', '.s.', 's.s'], pal, false]);
      return layers;
    },
  },
  'bg-galaxy': {
    name: 'The star whale',
    lines: ['A space whale! It spouts stars. WHOOSH!', 'The whale sings a long, low song.', 'The whale winks. Splash!'],
    w: 32, h: 18,
    frames: (i) => {
      const pal = { B: '#5c7cfa', s: '#fff3bf', w: '#d0bfff', m: '#3b5bdb', T: '#4c6ef5', E: '#1a1028', y: '#ffe066', '-': '#364fc7' };
      const layers = [[1, 7, WHALE(i ? 'E' : '-'), pal]];
      if (i) layers.push([5, i === 1 ? 3 : 1, SPOUT(i === 1 ? 1 : 3), pal, false]);
      return layers;
    },
  },
};

/** The hidden spot's SVG: three frames stacked, CSS shows one at a time (see .map-secret). */
export function secretSvg(themeId, scale = 4) {
  const s = SECRETS[themeId];
  if (!s) return '';
  // the big landmark if there is one (landmarks.js), else the small spot above
  const art = LANDMARKS[themeId] || s;
  const w = art.w + 2;
  const h = art.h + 2;
  const frames = [0, 1, 2].map((i) => {
    const p = new Pix(w, h);
    for (const [x, y, rows, pal, outline = true] of art.frames(i)) p.put(x + 1, y + 1, rows, pal, outline);
    return `<g class="f${i}">${p.rects()}</g>`;
  }).join('');
  return svgOf(w, h, scale, 'secret-svg', frames);
}
