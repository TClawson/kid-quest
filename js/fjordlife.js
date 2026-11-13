// The Alaskan Fjord's wild things: the ones that swim in from the sea (a pod of orcas, a
// humpback whale and the puffin it blows into the air, sea otters with their oysters) and the
// ones that wander down to the water (a moose, a grizzly after the salmon). Sprites only, one
// art pixel to one village pixel like everything in the village; maplife.js moves them.
//
// Each sprite is rows of letters ('.' is see-through); sprite() wraps the shape in a dark
// outline (K). FJORD_PAL maps the letters to colors.

import { draw } from './maplife.js';
import { sounds } from './fx.js';
import { fjordFalls, fjordSeason, spruceCover } from './fjordart.js';

function sprite(rows, outline = true) {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.'));
  if (!outline) return g;
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

export const FJORD_PAL = {
  K: '#1b1430',
  // orcas: b black, g the sheen on the back, w white, s the grey saddle
  orca: { K: '#10121e', b: '#1e2233', g: '#3c4460', w: '#f6f8fc', s: '#8f98b4', e: '#10121e' },
  // the humpback: b slate, h the light along its back, d dark, w the white under its tail and chin, k knobs
  whale: { K: '#161c2c', b: '#3b475e', h: '#5d6c88', d: '#262f44', w: '#eef2f8', k: '#7d8aa6', e: '#0e1220' },
  // spray: w white, a pale, c blue
  spray: { w: '#ffffff', a: '#dff2fa', c: '#a8d8ee' },
  // the puffin: k black, w white, o orange, r red, y yellow, e eye, f feet
  puffin: { K: '#1b1430', k: '#22263a', w: '#ffffff', g: '#d8dce8', o: '#ff922b', r: '#e03131', y: '#ffd43b', e: '#1b1430', f: '#ff922b' },
  // sea otters: b brown, B the paler belly, F the cream face, n nose, e eye, p paws, o O the oyster, W whiskers
  otter: { K: '#2a1a1e', b: '#6b4a3a', B: '#9a7456', d: '#4e342c', F: '#ecd8b8', f: '#d2b890', n: '#2a1a1e', e: '#1b1430', p: '#3e2a26', o: '#8a8ea0', O: '#e8ecf4', W: '#ffffff', x: '#ffffff' },
  // the moose: D dark, M brown, L the lighter hump, n the muzzle, N nostril, A antlers, a their shade, l pale legs, e eye, g water weed
  moose: { K: '#1e1418', D: '#3a2622', M: '#5a3c2c', L: '#7a5638', n: '#8c6a50', N: '#2a1a1e', A: '#e2c690', a: '#b08e5c', l: '#a08468', e: '#1b1430', g: '#4c9050', G: '#8cc066' },
  // the grizzly: B brown, H the pale hump and back, D dark, m muzzle, n nose, e eye; the salmon: r red, R light, s green head
  bear: { K: '#22161a', B: '#7a5236', H: '#a87c50', D: '#5a3a28', m: '#c8a070', n: '#22161a', e: '#1b1430', c: '#f0e8d8', r: '#d8483e', R: '#ff8f7a', s: '#4c8a5a', t: '#b83a36' },
};

// ---------- orcas ----------
// Facing right, rising through the surface: the tall fin, the black back, the white patch behind
// the eye and the grey saddle behind the fin. The water line is the bottom row.

/** A big bull: a tall straight fin. 36 wide. */
export const ORCA_BULL = sprite([
  '...............b....................',
  '..............bb....................',
  '..............bbg...................',
  '.............bbbg...................',
  '.............bbbg...................',
  '............bbbbg...................',
  '............bbbbg...................',
  '...........bbbbbg...................',
  '...........bbbbbg...................',
  '..........bbbbbbgggggggg............',
  '.......gggbbbbbbbbbbbbbbgggg........',
  '....ggbbbbbbbbbsssbbbbbbbbbbgg......',
  '..gbbbbbbbbbbbbbssbbbbbbbbwwbbbg....',
  '.bbbbbbbbbbbbbbbbbbbbbbbbwwwwbebb...',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbww.',
]);
/** A cow: a shorter fin that curves back. 30 wide. */
export const ORCA_COW = sprite([
  '...........bb.................',
  '..........bbbg................',
  '.........bbbbg................',
  '.........bbbbg................',
  '........bbbbbg................',
  '........bbbbbbgggggg..........',
  '.....gggbbbbbbbbbbbbggg.......',
  '...gbbbbbbbbsssbbbbbbbbbgg....',
  '.gbbbbbbbbbbbssbbbbbbwwbbbg...',
  'bbbbbbbbbbbbbbbbbbbbwwwwbebb..',
  'bbbbbbbbbbbbbbbbbbbbbbbbbbbbww',
]);
/** A calf, keeping close. 20 wide. */
export const ORCA_CALF = sprite([
  '.......b............',
  '......bbg...........',
  '......bbg...........',
  '.....bbbbgggg.......',
  '...ggbbbbbbbbbgg....',
  '.gbbbbbbssbbbwwbbg..',
  'bbbbbbbbbbbbwwwbebb.',
  'bbbbbbbbbbbbbbbbbbww',
]);
/** Only the fin cutting the water (between breaths). */
export const ORCA_FIN = sprite([
  '....b...',
  '...bb...',
  '...bbg..',
  '..bbbg..',
  '..bbbg..',
  '.bbbbg..',
  '.bbbbg..',
  'bbbbbbg.',
]);
/** A whole orca in the air, facing right: tail flukes, the tall fin, a white belly and chin. For the northern lights show. */
export const ORCA_LEAP = sprite([
  '....................bb........................',
  '...................bbbg.......................',
  '..................bbbbg.......................',
  '.................bbbbbg.......................',
  'bb.............ggbbbbbbgggggggg...............',
  'bbb.........gggbbbbbbbbbbbbbbbbbbgggg.........',
  '.bbb.....ggbbbbbbbbbsssbbbbbbbbbbbbbbbgg......',
  '.bbbb..gbbbbbbbbbbbbbssbbbbbbbbbbbwwwbbbbg....',
  '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbwwwwwbebbb...',
  '..bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb..',
  '.bbbb.bbbbbbbbbbbbwwwwwwwwwwwwwwwwwwwwwwwwww..',
  'bbb.....bbbbbwwwwwwwwwwwwwwwwwwwwwwwwwwwww....',
  'bb.........wwwwwwwwwbbbbwwwwwwwwwwwwww........',
  '.....................bbbbb....................',
  '......................bbbb....................',
  '.......................bb.....................',
]);
/** An orca's short, bushy blow. */
export const ORCA_BLOW = sprite(['.a.a.', 'awwwa', '.www.', '..w..', '..w..'], false);

// ---------- the humpback ----------

/** The whale's back rolling through the surface, facing right: knobs on its head, the blowhole, a small fin far back. 66 wide. */
export const WHALE_BACK = sprite([
  '..................................hhhhhhhhhhhhhh..................',
  '...........................hhhhhhhbbbbbbbbbbbbbbhhhhhhe...........',
  '............d........hhhhhhbbbbbbbbbbbbbbbbbbbbbbbbbbbbhhhkh......',
  '...........dd...hhhhhbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbhkh...',
  '.........hdddhhhbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkbbbhk.',
  '.....hhhhbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbkbbb',
  '..hhhbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb',
  'bbbbbbbbbbbbbbbbbbbbbddddddddddddddddddddddddddbbbbbbbbbbbbwwbbwwb',
]);
/** The tail lifted clear as it dives: white underneath, water running off. 32 wide. */
export const WHALE_FLUKE = sprite([
  '..bbbb....................bbbb..',
  '.bbbbbbb................bbbbbbb.',
  'hbbbbbbbbb............bbbbbbbbbh',
  'hbbwwbbbbbbb........bbbbbbbwwbbb',
  '.bbbwwwbbbbbbb....bbbbbbbwwwbbb.',
  '..bbbwwwwbbbbbbbbbbbbbbwwwwbbb..',
  '...bbbbwwwwbbbbddbbbbwwwwbbbb...',
  '.....bbbbbwbbbbddbbbbwbbbbb.....',
  '........bbbbbbbbbbbbbbbb........',
  '..........hbbbbbbbbbbd..........',
  '...........hbbbbbbbbd...........',
  '...........hbbbbbbbbd...........',
  '..........hbbbbbbbbbbd..........',
  '..........hbbbbbbbbbbd..........',
]);
/** The whale's blow: a tall column of spray, three frames as it climbs and falls apart. */
export const WHALE_BLOW = [
  sprite(['...aa...', '..awwa..', '..awwa..', '...ww...', '...ww...'], false),
  sprite(['..a.aa.a...', '.aawwwwaa..', 'aawwwwwwaa.', '.aawwwwaa..', '..awwwwa...', '...awwa....', '...awwa....', '....ww.....', '....ww.....', '....ww.....'], false),
  sprite(['.a..a.aa..a..', 'a.awwawwaa.a.', '.awwwwwwwwa..', 'aawwwwwwwwaa.', '.aawwwwwwaa.a', '..aawwwwaa...', '...awwwwa....', '....awwa.....', '....awwa.....', '.....ww......', '.....ww......', '.....ww......', '.....ww......', '.....ww......'], false),
];

// ---------- the puffin ----------

/** Sitting on the water, facing right. */
export const PUFFIN = sprite([
  '..kkkk....',
  '.kkwwkoo..',
  '.kwwewyor.',
  'kkkwwwoo..',
  'kkkkkww...',
  'kkkkkkww..',
  '.kkkkwww..',
]);
/** Blown into the air, squeaking: wings out, feet dangling, beak wide open. Two frames. */
export const PUFFIN_UP = [
  sprite([
    'kk.........kk',
    'kkk.kkkk..kkk',
    '.kkkkwwkkkkk.',
    '..kkwewwkoo..',
    '...kwwwwk.rr.',
    '...kkwwwkoo..',
    '....kwwwk....',
    '....f...f....',
    '...ff..ff....',
  ]),
  sprite([
    '....kkkk.....',
    '...kkwwkk....',
    '.kkkwewwkoo..',
    'kkkkwwwwk.rr.',
    'kk.kkwwwkookk',
    '....kwwwk.kkk',
    '....f...f..kk',
    '....ff..ff...',
  ]),
];

// ---------- sea otters ----------
// Floating on their backs, head to the right, feet to the left.

/** Tapping the oyster on its chest (two frames: paws down, paws up). */
export const OTTER = [
  sprite([
    '...................dd.dd..',
    '..................dbbbbbd.',
    '..pp..............bFFFFFb.',
    '.pbbp.......oO....bFeFeFb.',
    '.bbbbbbbbbbpOOpbbbbFFnFFb.',
    'bbbbBBBBBBBpooPBBBbbfFFfb.',
    'bbbbbBBBBBBBBBBBBBbbbbbb..',
    '.dbbbbbbbbbbbbbbbbbbdd....',
  ]),
  sprite([
    '...................dd.dd..',
    '...........oO.....dbbbbbd.',
    '..pp.......OOo....bFFFFFb.',
    '.pbbp......p..p...bFeFeFb.',
    '.bbbbbbbbbbpbbpbbbbFFnFFb.',
    'bbbbBBBBBBBBBBBBBBbbfFFfb.',
    'bbbbbBBBBBBBBBBBBBbbbbbb..',
    '.dbbbbbbbbbbbbbbbbbbdd....',
  ]),
];
/** Tapped: it fumbles, the oyster jumps out of its paws. */
export const OTTER_FUMBLE = sprite([
  '.........oO...............',
  '.........OOo.......dd.dd..',
  '..........o..p....dbbbbbd.',
  '..pp......p..p....bFFFFFb.',
  '.pbbp.....p...p...bFEFEFb.',
  '.bbbbbbbbbbbbbpbbbbFFnFFb.',
  'bbbbBBBBBBBBBBBBBBbbfnnfb.',
  'bbbbbBBBBBBBBBBBBBbbbbbb..',
  '.dbbbbbbbbbbbbbbbbbbdd....',
]);
/** Plop: the oyster is gone, the otter looks at its empty paws. */
export const OTTER_OH = sprite([
  '...................dd.dd..',
  '..................dbbbbbd.',
  '..pp..............bFFFFFb.',
  '.pbbp......p..p...bFEFEFb.',
  '.bbbbbbbbbbpbbpbbbbFFnFFb.',
  'bbbbBBBBBBBBBBBBBBbbfFnfb.',
  'bbbbbBBBBBBBBBBBBBbbbbbb..',
  '.dbbbbbbbbbbbbbbbbbbdd....',
]);
/** Diving after it: back arched over, tail and feet in the air. */
export const OTTER_DIVE = sprite([
  '......bbbbbb......',
  '....bbbbbbbbbb.pp.',
  '...bbbBBBBbbbbbbbp',
  '..bbbBB...bbbbbbp.',
  '..bbb.......bbb...',
  '.dbb..............',
  '.dbb..............',
]);
/** The oyster on its own (falling), and the ring where it went in. */
export const OYSTER = sprite(['.oO.', 'oOOo', '.oo.']);

// ---------- the moose ----------

/** Standing, facing left: wide antlers, the long nose, the hump, pale legs. 42 wide. */
const MOOSE_ROWS = [
  '..A..A.A....A.A..A........................',
  '.AA.AA.AA..AA.AA.AA.......................',
  '.AAAAAAAa..AAAAAAAa.......................',
  '..AAAAAAa...aAAAAAa.......................',
  '...aAAAa.....aAAAa........................',
  '.....aAa.MMM.aAa....LLLLL.................',
  '......aMMMMMMMa...LLLLLLLLL...............',
  '......MMMMMMMMMMMLLLLLLLLLLLMMMMMMMMM.....',
  '....MMMMeMMMMMMMMMLLLLLLLLLMMMMMMMMMMMM...',
  '..nnMMMMMMMMMMMMMMMLLLLLLMMMMMMMMMMMMMMM..',
  '.nnnnMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.',
  'nnnnnnMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  'nNnnnnMMM.MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  '.nnnnn..D..MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  '........D..DMMMMMMMMMMMMMMMMMMMMMMMMMMMMDD',
  '........D...DDMMMMMMMMMMMMMMMMMMMMMMMMMDD.',
  '.............DDDDMMMMMMMMMMMMMMMMMMMDDDD..',
  '.............DDDDDDDDD.......DDDDDDDDD....',
  '.............MMM..MMM.........MMM..MMM....',
  '.............MMM..MMM.........MMM..MMM....',
  '.............MM...MM..........MM....MM....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '............DDl..DDl.........DDl...DDl....',
];
export const MOOSE = sprite(MOOSE_ROWS);
/** Head down in the shallows, then up with a mouthful of water weed (rows that replace the head). */
export const MOOSE_EATS = sprite([
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '....................LLLLL.................',
  '..............MM..LLLLLLLLL...............',
  '..A.A.A.....MMMMMLLLLLLLLLLLMMMMMMMMM.....',
  '.AAAAAAa..MMMMMMMMLLLLLLLLLMMMMMMMMMMMM...',
  '.AAAAAAaMMMMMMMMMMMLLLLLLMMMMMMMMMMMMMMM..',
  '..aAAaMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMM.',
  '...MMMMeMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  '..MMMMMMMM.MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  '.nnnnMMM...MMMMMMMMMMMMMMMMMMMMMMMMMMMMMMD',
  'nnnnnn.D...DMMMMMMMMMMMMMMMMMMMMMMMMMMMMDD',
  'nNnnnn.D....DDMMMMMMMMMMMMMMMMMMMMMMMMMDD.',
  '.gnGng.......DDDDMMMMMMMMMMMMMMMMMMMDDDD..',
  '.gGgGg.......DDDDDDDDD.......DDDDDDDDD....',
  '..g.g........MMM..MMM.........MMM..MMM....',
  '.............MMM..MMM.........MMM..MMM....',
  '.............MM...MM..........MM....MM....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '.............ll...ll..........ll....ll....',
  '............DDl..DDl.........DDl...DDl....',
]);

// ---------- the grizzly ----------

/** On all fours, facing left: the shoulder hump, the dished face, small round ears. 34 wide. */
const GRIZZLY_ROWS = [
  '...DD..DD.....HHHHHH..............',
  '..DBBDDBBD..HHHHHHHHHH............',
  '..BBBBBBBBBHHHHHHHHHHHHBBBBBB.....',
  '.BBBBBBBBBBBHHHHHHHHHHBBBBBBBBB...',
  '.BBeBBBBBBBBBBHHHHHBBBBBBBBBBBBB..',
  'mmBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  'nmmmBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  'mmmmBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD',
  '.mmBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD',
  '....DBBBBBBBBBBBBBBBBBBBBBBBBBBBD.',
  '.....DBBBBBBBBBBBBBBBBBBBBBBBBBBD.',
  '.....DBBBBBBDDDDDDDDDDDDBBBBBBBD..',
  '.....BBBBBBD...........DBBBBBBB...',
  '.....BBBBB.DBB.........BBBBB.DBB..',
  '.....BBBB..DBB.........BBBB..DBB..',
  '....DBBBB..DBB........DBBBB..DBB..',
  '....cBBBB.cDBB........cBBBB.cDBB..',
];
export const GRIZZLY = sprite(GRIZZLY_ROWS);
/** A salmon caught: the rows that replace the grizzly's head (the fish flapping in its jaws). */
export const GRIZZLY_CATCH = sprite([
  '...DD..DD.....HHHHHH..............',
  '..DBBDDBBD..HHHHHHHHHH............',
  '..BBBBBBBBBHHHHHHHHHHHHBBBBBB.....',
  '.BBBBBBBBBBBHHHHHHHHHHBBBBBBBBB...',
  '.BBeBBBBBBBBBBHHHHHBBBBBBBBBBBBB..',
  'mmBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  'srrmBBBBBBBBBBBBBBBBBBBBBBBBBBBBB.',
  'sRrrBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD',
  'rrrtBBBBBBBBBBBBBBBBBBBBBBBBBBBBBD',
  '.rt.DBBBBBBBBBBBBBBBBBBBBBBBBBBBD.',
  '.tt..DBBBBBBBBBBBBBBBBBBBBBBBBBBD.',
  '.....DBBBBBBDDDDDDDDDDDDBBBBBBBD..',
  '.....BBBBBBD...........DBBBBBBB...',
  '.....BBBBB.DBB.........BBBBB.DBB..',
  '.....BBBB..DBB.........BBBB..DBB..',
  '....DBBBB..DBB........DBBBB..DBB..',
  '....cBBBB.cDBB........cBBBB.cDBB..',
]);
/** A salmon leaping up the creek. */
export const SALMON_LEAP = sprite(['....srrr..', '..rrrRRrr.', 'ttrrRRr...', '.t.rr.....']);

// ---------- walking frames ----------

/** The same animal with some legs lifted: in those columns the lowest `n` rows move up one. */
function lifted(rows, cols, n) {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.').split(''));
  const h = g.length;
  for (const [a, b] of cols) {
    for (let x = a; x <= b; x += 1) {
      for (let y = h - n; y < h - 1; y += 1) g[y][x] = g[y + 1][x];
      g[h - 1][x] = '.';
    }
  }
  return g.map((r) => r.join(''));
}
const MOOSE_STEP = [sprite(lifted(MOOSE_ROWS, [[12, 15], [35, 38]], 7)), sprite(lifted(MOOSE_ROWS, [[17, 20], [29, 32]], 7))];
const GRIZZLY_STEP = [sprite(lifted(GRIZZLY_ROWS, [[4, 9], [28, 31]], 4)), sprite(lifted(GRIZZLY_ROWS, [[10, 13], [22, 27]], 4))];

// ---------- the fjord's life ----------
// Who comes and when (all times in frames, 12.5 a second):
//   sea otters   a raft of two near where the kid is looking, about half the time. Tap one and it
//                fumbles its oyster, watches it sink, and dives after it.
//   the orcas    a pod swims in through the channel, once round the bay and out again, coming up
//                to breathe as it goes. The otters duck under until it has passed.
//   the humpback surfaces two or three times: bubbles, its back, the blow, then its tail. Now and
//                then it comes up right under a puffin, and the blow sends the bird flying.
//   moose, bear  one at a time, never together: it comes out of the trees at the north-east
//                corner and wades along the beach. The moose eats water weed, the grizzly fishes
//                for the salmon leaping at the creek mouth. The bear sleeps through the winter.
// Plus the waterfall's falling water, its spray, and glints on the bay.

const FPS = 12.5;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const hash = (a, b) => { const h = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return h - Math.floor(h); };
const FOAM = ['#ffffff', '#cfeaf2'];

/**
 * A sprite in the water. x, y: its left end on the water line; its lowest `sink` rows stay under
 * (and the outline under its belly always does); foam flickers where it breaks the surface.
 */
function afloat(ctx, rows, pal, x, y, sink, flip, f, foam = true) {
  const n = Math.min(rows.length - 1, rows.length - 1 - Math.round(sink));
  if (n < 2) return;
  const X = Math.round(x); const Y = Math.round(y);
  draw(ctx, X, Y - n, rows.slice(0, n), pal, flip);
  if (!foam) return;
  const last = rows[n - 1]; const w = last.length;
  for (let i = 0; i < w; i += 1) {
    if (last[flip ? w - 1 - i : i] === '.') continue;
    const k = hash(X + i, Y + Math.floor(f / 3));
    if (k < 0.55) { ctx.fillStyle = FOAM[k < 0.25 ? 0 : 1]; ctx.fillRect(X + i, Y, 1, 1); }
  }
}

/** A rounded path through the points, to walk along by distance. */
function route(points) {
  let p = points.map(([x, y]) => [x, y]);
  for (let n = 0; n < 2; n += 1) {
    const q = [p[0]];
    for (let i = 0; i < p.length - 1; i += 1) {
      const [a, b] = [p[i], p[i + 1]];
      q.push([a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25], [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75]);
    }
    q.push(p[p.length - 1]);
    p = q;
  }
  const at = [0];
  for (let i = 1; i < p.length; i += 1) at.push(at[i - 1] + Math.hypot(p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]));
  const length = at[at.length - 1];
  return {
    length,
    at(s) {
      const d = Math.max(0, Math.min(length, s));
      let i = 1;
      while (i < at.length - 1 && at[i] < d) i += 1;
      const span = at[i] - at[i - 1] || 1; const k = (d - at[i - 1]) / span;
      const [a, b] = [p[i - 1], p[i]];
      return { x: a[0] + (b[0] - a[0]) * k, y: a[1] + (b[1] - a[1]) * k, dx: (b[0] - a[0]) / span, dy: (b[1] - a[1]) / span };
    },
  };
}

/** Is this open water: deep enough, clear of the mountains, the docks, the islet and the boats? */
function openWater(L) {
  const box = (x, y, [bx, by, bw, bh]) => x >= bx && x <= bx + bw && y >= by && y <= by + bh;
  const boats = L.props.filter((q) => q.kind === 'trawler' || q.kind === 'skiff').map((q) => (q.kind === 'trawler' ? [q.x - 3, q.y - 2, 52, 40] : [q.x - 2, q.y - 2, 28, 13]));
  const decks = L.crossings.map((b) => [b.x - 5, b.y - 5, b.w + 10, b.h + 10]);
  return (x, y) => L.inWater(x, y, -9) && !L.blockedHard(x, y, 5) && !decks.some((b) => box(x, y, b)) && !boats.some((b) => box(x, y, b))
    && !(L.islets || []).some((q) => ((x - q.x) / (q.rx + 6)) ** 2 + ((y - q.y) / (q.ry + 6)) ** 2 < 1);
}

const WHALE_W = WHALE_BACK[0].length;
const WHALE_H = WHALE_BACK.length - 1;
const BLOWHOLE = 55; // the column of the blowhole in WHALE_BACK, and how high the back stands there
const BLOWHOLE_UP = 7;
const FLUKE_H = WHALE_FLUKE.length - 1;
const OTTER_W = OTTER[0][0].length;
const OTTER_H = OTTER[0].length - 1;
const PUFFIN_W = PUFFIN[0].length;

export function fjordLife(m) {
  const L = m.layout;
  if (!L) return { step() {}, draw() {} };
  const hints = L.life || {};
  const sea = openWater(L);
  // with the lighthouse up, its rock is in the way too
  const open = (x, y) => {
    const lm = m.landmark;
    if (lm?.foot && x > lm.x + lm.foot[0] - 8 && x < lm.x + lm.foot[0] + lm.foot[2] + 8 && y > lm.y + lm.foot[1] - 10 && y < lm.y + lm.foot[1] + lm.foot[3] + 8) return false;
    return sea(x, y);
  };
  const fits = (x, y, w) => [0, 0.25, 0.5, 0.75, 1].every((k) => open(x + w * k, y));
  const falls = fjordFalls(L);
  const winter = () => m.season === 'winter';
  const P = FJORD_PAL;
  const podPath = route(hints.pod || [[m.aw / 2, m.ah / 2], [m.aw / 2 + 1, m.ah / 2]]);
  // the water's edge along the north beach, column by column
  const shore = new Map();
  const shoreY = (x) => {
    const k = Math.round(x);
    if (!shore.has(k)) {
      // the bay, not the creek that runs into it: the water has to be wide here
      const wet = (y) => L.inWater(k, y, -3) && L.inWater(k - 9, y, -3) && L.inWater(k + 9, y, -3);
      let y = 150;
      while (y < L.H && !wet(y)) y += 1;
      shore.set(k, y);
    }
    return shore.get(k);
  };
  const creek = L.water.find((w) => w.kind === 'river');
  const mouthX = creek ? creek.pts[creek.pts.length - 1][0] : 300;
  const mouth = { x: mouthX, y: shoreY(mouthX) };

  const s = {
    f: 0, view: { top: 0, bottom: m.ah },
    pod: null, whale: null, nextSea: FPS * 8, lastSea: '',
    otters: null, nextOtters: FPS * 2,
    land: null, nextLand: FPS * 14,
    puffins: [], drops: [], rings: [], oysters: [], salmon: [], blows: [],
  };
  const inView = (y, pad = 16) => y > s.view.top - pad && y < s.view.bottom + pad;
  const say = (name, y, ...args) => { if (inView(y)) sounds[name]?.(...args); };
  const ring = (x, y, big = 0) => s.rings.push({ x, y, t: 0, big });
  const splash = (x, y, n = 6, power = 1) => {
    for (let i = 0; i < n; i += 1) s.drops.push({ x: x + rand(-3, 3), y, vx: rand(-1.1, 1.1) * power, vy: rand(-2.6, -1) * power, floor: y + 1, c: FOAM[i % 2] });
    ring(x, y, power > 1 ? 1 : 0);
  };
  const openSpot = (x0, x1, y0, y1, w = 12) => {
    for (let i = 0; i < 40; i += 1) { const x = rand(x0, x1); const y = rand(y0, y1); if (fits(x, y, w)) return { x, y }; }
    return null;
  };
  // which of some spots the kid can see best ([x, y] or a list of them): one in view if any, else the nearest
  const bestSpot = (spots, yOf) => {
    const mid = (s.view.top + s.view.bottom) / 2;
    const seen = spots.filter((q) => inView(yOf(q), -24));
    return seen.length ? pick(seen) : spots.reduce((a, b) => (Math.abs(yOf(b) - mid) < Math.abs(yOf(a) - mid) ? b : a), spots[0]);
  };

  // ----- puffins: two of them live on the bay -----
  for (let i = 0; i < 2; i += 1) {
    const at = openSpot(150, 330, 250 + i * 80, 300 + i * 100) || { x: 200 + i * 60, y: 280 + i * 90 };
    s.puffins.push({ x: at.x, y: at.y, tx: at.x, ty: at.y, state: 'sit', t: Math.round(rand(0, 80)), dir: i ? -1 : 1, alt: 0, vy: 0, vx: 0, ph: i * 17 });
  }
  const launch = (p, vy, vx) => { p.state = 'fly'; p.vy = vy; p.vx = vx; if (vx) p.dir = vx > 0 ? 1 : -1; say('squeak', p.y); };
  const stepPuffin = (p) => {
    p.t += 1;
    if (p.state === 'sit') {
      if (Math.hypot(p.tx - p.x, p.ty - p.y) > 1) {
        const d = Math.hypot(p.tx - p.x, p.ty - p.y);
        p.x += ((p.tx - p.x) / d) * 0.35; p.y += ((p.ty - p.y) / d) * 0.35;
        if (Math.abs(p.tx - p.x) > 1) p.dir = p.tx > p.x ? 1 : -1;
      } else if (p.t > 110 && Math.random() < 0.02) {
        // paddles off somewhere nearby, staying where the kid can see it if it can
        const to = openSpot(p.x - 40, p.x + 40, Math.max(p.y - 30, s.view.top + 20), Math.min(p.y + 30, s.view.bottom - 10), PUFFIN_W)
          || openSpot(p.x - 40, p.x + 40, p.y - 30, p.y + 30, PUFFIN_W);
        if (to) { p.tx = to.x; p.ty = to.y; }
        p.t = 0;
      }
    } else if (p.state === 'fly') {
      p.alt -= p.vy; p.vy += 0.42; p.x += p.vx;
      if (p.alt <= 0 && p.vy > 0) { p.alt = 0; p.state = 'shake'; p.t = 0; p.tx = p.x; p.ty = p.y; splash(p.x + 5, p.y, 5); say('plop', p.y); }
    } else if (p.state === 'shake' && p.t > 12) { p.state = 'sit'; p.t = 0; }
  };

  // ----- the orca pod -----
  const startPod = () => {
    // they come up to breathe one after another, close together
    const members = [{ rows: ORCA_BULL, lag: 0, off: 0, ph: 0 }, { rows: ORCA_COW, lag: 36, off: -7, ph: 57 }, { rows: ORCA_CALF, lag: 50, off: 9, ph: 53 }];
    if (Math.random() < 0.6) members.push({ rows: ORCA_COW, lag: 78, off: 6, ph: 47 });
    s.pod = { d: 0, members: members.map((o) => ({ ...o, dir: -1, x: 0, y: 0, up: 0, out: true })) };
    s.lastSea = 'pod';
  };
  const stepPod = () => {
    const pod = s.pod;
    pod.d += 1.5;
    let any = false;
    for (const o of pod.members) {
      const d = pod.d - o.lag;
      o.out = d < 0 || d > podPath.length;
      if (o.out) continue;
      any = true;
      const at = podPath.at(d);
      // side by side in the bay, in single file where the channel is narrow
      const off = o.off * Math.max(0, Math.min(1, ((hints.channel ?? Infinity) - at.y) / 36));
      o.x = at.x - at.dy * off; o.y = at.y + at.dx * off;
      if (Math.abs(at.dx) > 0.4) o.dir = at.dx > 0 ? 1 : -1;
      // a breath: up through the surface fin first, a blow, a moment in the air, and under again
      const c = (s.f + o.ph) % 64;
      o.up = c < 8 ? c / 8 : c < 28 ? 1 : c < 38 ? 1 - (c - 28) / 10 : 0;
      if (c === 8) { o.blow = 8; say('spout', o.y, 0.5); }
      if (c === 34) ring(o.x, o.y);
      if (o.blow) o.blow -= 1;
    }
    if (!any && pod.d > 100) { s.pod = null; s.nextSea = s.f + FPS * rand(25, 50); }
  };
  const podNear = (x, y, r) => s.pod && s.pod.members.some((o) => !o.out && Math.hypot(o.x - x, o.y - y) < r);

  // ----- the humpback -----
  const whaleSpot = () => {
    // sometimes right under a puffin sitting where the kid can see it
    const sitters = s.puffins.filter((p) => p.state === 'sit' && inView(p.y, -20));
    if (sitters.length && Math.random() < 0.6) {
      const p = pick(sitters);
      for (const dir of Math.random() < 0.5 ? [1, -1] : [-1, 1]) {
        const x = p.x + PUFFIN_W / 2 - (dir > 0 ? BLOWHOLE : WHALE_W - 1 - BLOWHOLE);
        if (fits(x, p.y, WHALE_W)) return { x, y: p.y, dir, bird: p };
      }
    }
    const spots = (hints.whale || []).filter(([x, y]) => fits(x - WHALE_W / 2, y, WHALE_W));
    if (!spots.length) return null;
    const [x, y] = bestSpot(spots, (q) => q[1]);
    return { x: x - WHALE_W / 2 + rand(-8, 8), y, dir: Math.random() < 0.5 ? 1 : -1, bird: null };
  };
  const startWhale = () => { s.whale = { left: 2 + (Math.random() < 0.5 ? 1 : 0), phase: 'under', t: 0, wait: 4, sink: WHALE_H, x: 0, y: 0, dir: 1, bird: null, fluke: null }; s.lastSea = 'whale'; };
  const blowAt = (w) => ({ x: w.x + (w.dir > 0 ? BLOWHOLE : WHALE_W - 1 - BLOWHOLE), y: w.y - BLOWHOLE_UP });
  const stepWhale = () => {
    const w = s.whale;
    w.t += 1;
    const to = (phase) => { w.phase = phase; w.t = 0; };
    if (w.phase === 'under') {
      if (w.t < w.wait) return;
      const at = whaleSpot();
      if (!at) { s.whale = null; s.nextSea = s.f + FPS * 20; return; }
      Object.assign(w, at, { sink: WHALE_H });
      to('bubbles');
    } else if (w.phase === 'bubbles') {
      const b = blowAt(w);
      if (w.t % 4 === 1) ring(b.x + rand(-10, 10), w.y);
      if (w.t > 14) to('rise');
    } else if (w.phase === 'rise') {
      w.sink = WHALE_H * (1 - w.t / 12);
      if (w.bird) { w.bird.state = 'ride'; w.bird.alt = Math.max(0, BLOWHOLE_UP - w.sink); }
      if (w.t >= 12) { w.sink = 0; to('blow'); }
    } else if (w.phase === 'blow') {
      const b = blowAt(w);
      if (w.t === 1) {
        say('spout', w.y, 1);
        s.blows.push({ x: b.x, y: b.y, t: 0 });
        if (w.bird) { w.bird.alt = BLOWHOLE_UP; launch(w.bird, -6.2, w.dir * 1.35); w.bird = null; }
      }
      if (w.t > 5 && w.t < 16) for (let i = 0; i < 2; i += 1) s.drops.push({ x: b.x + rand(-6, 6), y: b.y - rand(8, 16), vx: rand(-0.7, 0.7), vy: rand(-0.6, 0.4), floor: w.y - (Math.random() < 0.5 ? BLOWHOLE_UP - 1 : 0), c: FOAM[i] });
      if (w.t > 22) to('roll');
    } else if (w.phase === 'roll') {
      w.x += w.dir * 0.45;
      if (w.t > 34) to('down');
    } else if (w.phase === 'down') {
      w.x += w.dir * 0.45;
      w.sink = WHALE_H * (w.t / 12);
      if (w.t >= 12) { w.fluke = { x: w.x + WHALE_W / 2 - WHALE_FLUKE[0].length / 2, y: w.y, sink: FLUKE_H }; to('fluke'); }
    } else if (w.phase === 'fluke') {
      const up = w.t < 5 ? 0 : w.t < 13 ? (w.t - 5) / 8 : w.t < 22 ? 1 : 1 - (w.t - 22) / 11;
      w.fluke.sink = FLUKE_H * (1 - Math.max(0, up));
      if (w.t === 26) { splash(w.fluke.x + 17, w.y, 12, 1.5); say('splash', w.y); }
      if (w.t > 33) {
        w.fluke = null; w.left -= 1;
        if (w.left > 0) { w.wait = Math.round(rand(50, 90)); w.sink = WHALE_H; to('under'); } else { s.whale = null; s.nextSea = s.f + FPS * rand(25, 50); }
      }
    }
  };

  // ----- sea otters -----
  const startOtters = () => {
    const rafts = (hints.otters || []).filter((raft) => raft.every(([x, y]) => fits(x, y, OTTER_W)));
    if (!rafts.length) { s.nextOtters = Infinity; return; }
    const raft = bestSpot(rafts, (r) => r[0][1]);
    s.otters = { until: s.f + FPS * rand(60, 100), members: raft.map(([x, y], i) => ({ x, y, state: 'under', t: 0, wait: 6 + i * 9, ph: i * 13, dir: i % 2 ? -1 : 1, leaving: false })) };
  };
  const stepOtters = () => {
    const raft = s.otters;
    const leave = s.f > raft.until && raft.members.every((o) => o.state === 'float');
    for (const o of raft.members) {
      o.t += 1;
      const to = (state) => { o.state = state; o.t = 0; };
      const cx = o.x + OTTER_W / 2;
      if (o.state === 'float') {
        if (leave) { o.leaving = true; to('dive'); } else if (podNear(cx, o.y, 54)) { o.hiding = true; to('dive'); }
      } else if (o.state === 'fumble') {
        // the oyster jumps out of its paws, toward its feet
        if (o.t === 4) s.oysters.push({ x: cx - o.dir * 2, y: o.y - 13, vx: -o.dir * 0.9, vy: -2.4, floor: o.y + 1 });
        if (o.t > 9) to('oh');
      } else if (o.state === 'oh') {
        if (o.t > 20) to('dive');
      } else if (o.state === 'dive') {
        if (o.t === 3) { splash(cx, o.y, 6); say('plop', o.y); }
        if (o.t > 8) { o.wait = o.leaving ? Infinity : Math.round(rand(30, 44)); to('under'); }
      } else if (o.state === 'under') {
        if (o.hiding) { if (!podNear(cx, o.y, 80)) { o.hiding = false; o.wait = Math.round(rand(16, 30)); o.t = 0; } continue; }
        if (!o.leaving && o.t % 7 === 3) ring(cx + rand(-6, 6), o.y);
        if (o.t > o.wait) to('up');
      } else if (o.state === 'up' && o.t > 8) to('float');
    }
    if (raft.members.every((o) => o.leaving && o.state === 'under')) { s.otters = null; s.nextOtters = s.f + FPS * rand(30, 60); }
  };

  // ----- the moose and the grizzly -----
  const LAND = {
    moose: { stand: MOOSE, step: MOOSE_STEP, pal: P.moose, w: MOOSE[0].length, wade: 9, sink: 5, speed: 0.8 },
    bear: { stand: GRIZZLY, step: GRIZZLY_STEP, pal: P.bear, w: GRIZZLY[0].length, wade: 7, sink: 3, speed: 0.7 },
  };
  // They come out from behind a stand of spruces at the end of the beach (the door: the middle of
  // their feet when they are hidden) and go back behind it to leave. They never fade in or out.
  const sh = hints.shore || {};
  const door = sh.door || [m.aw - 60, shoreY(m.aw - 60) - 6];
  const DOOR_RUN = 44; // how far from the door they are down at the water's edge
  /** Where its feet are when its middle is at cx, and how far into the water it is (0 on the grass .. 1 wading). */
  const landAt = (cx, k) => {
    const wadeY = winter() ? shoreY(cx) - 4 : shoreY(cx) + k.wade;
    const u = Math.max(0, Math.min(1, (cx - (door[0] - DOOR_RUN)) / DOOR_RUN));
    const e = u * u * (3 - 2 * u);
    return { y: wadeY + (door[1] - wadeY) * e, wet: winter() ? 0 : 1 - e };
  };
  let cover = null;
  /** The spruces of the door, painted again to go over an animal standing behind them. */
  const coverArt = () => {
    if (cover || !sh.cover?.length || typeof document === 'undefined') return cover;
    const cells = spruceCover(sh.cover, fjordSeason(m.season, m.progress));
    const xs = cells.map((c) => c[0]); const ys = cells.map((c) => c[1]);
    const x0 = Math.min(...xs); const y0 = Math.min(...ys);
    const c = document.createElement('canvas');
    c.width = Math.max(...xs) - x0 + 1; c.height = Math.max(...ys) - y0 + 1;
    const g = c.getContext('2d');
    for (const [x, y, col] of cells) { g.fillStyle = col; g.fillRect(x - x0, y - y0, 1, 1); }
    cover = { c, x: x0, y: y0 };
    return cover;
  };
  const startLand = (kind) => {
    const k = LAND[kind];
    s.land = { kind, x: door[0] - k.w / 2, tx: sh[kind] ?? (kind === 'bear' ? mouth.x + 4 : 190), state: 'in', t: 0, dir: -1, catches: 0, biting: 0, look: 0, stay: Math.round(FPS * rand(35, 55)), nextLeap: 20 };
  };
  const stepLand = () => {
    const a = s.land; const k = LAND[a.kind];
    a.t += 1;
    if (a.state === 'in') {
      a.x -= k.speed;
      if (a.x <= a.tx) { a.x = a.tx; a.state = 'stay'; a.t = 0; }
    } else if (a.state === 'stay') {
      if (a.look) a.look -= 1;
      if (a.biting) a.biting -= 1;
      if (a.kind === 'moose' && !winter() && a.t % 56 === 1) ring(a.x + 3, shoreY(a.x + k.w / 2) + k.wade);
      if (a.kind === 'bear' && !winter() && a.t >= a.nextLeap) {
        // a salmon leaps at the creek mouth; now and then the bear is quick enough
        const caught = !a.biting && Math.random() < 0.35;
        s.salmon.push({ t: 0, caught });
        if (caught) { a.biting = 30; a.catches += 1; }
        a.nextLeap = a.t + Math.round(rand(20, 44));
      }
      if (a.t > a.stay || a.catches >= 3) { if (!a.biting) { a.state = 'out'; a.dir = 1; a.t = 0; } }
    } else {
      a.x += k.speed;
      // gone once it is right behind the spruces again
      if (a.x + k.w / 2 >= door[0]) { s.land = null; s.nextLand = s.f + FPS * rand(45, 90); }
    }
  };

  // ----- drawing -----
  const drawRing = (ctx, r) => {
    const rx = 2 + r.t * (r.big ? 1.1 : 0.7); const ry = Math.max(1, rx * 0.4);
    ctx.globalAlpha = Math.max(0, 0.75 * (1 - r.t / (r.big ? 16 : 11)));
    ctx.fillStyle = '#e6f6fa';
    const n = Math.max(8, Math.round(rx * 3));
    for (let i = 0; i < n; i += 1) {
      if ((i + r.t) % 3 === 0) continue;
      const a = (i / n) * Math.PI * 2;
      ctx.fillRect(Math.round(r.x + Math.cos(a) * rx), Math.round(r.y + Math.sin(a) * ry), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
  const drawFalls = (ctx) => {
    if (!falls || winter()) return;
    for (let y = falls.y0; y <= falls.y1; y += 1) {
      const cx = falls.xAt(y); const hw = falls.widthAt(y);
      for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x += 1) {
        const k = hash(x, Math.floor((y - s.f * 2) / 4));
        if (k > 0.8) { ctx.fillStyle = k > 0.93 ? '#ffffff' : '#dcf2f8'; ctx.fillRect(x, y, 1, 1); }
      }
    }
    // the spray at its foot
    for (let i = 0; i < 9; i += 1) {
      const g = Math.floor((s.f + i * 2) / 3);
      const r = hash(i, g); const up = ((s.f + i * 2) % 3) / 3;
      ctx.globalAlpha = 0.85 * (1 - up * 0.6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(falls.x1 + (r - 0.5) * 16), Math.round(falls.y1 + 1 - hash(i + 9, g) * 5 - up * 2), 1, 1);
    }
    ctx.globalAlpha = 1;
  };
  const drawGlints = (ctx) => {
    ctx.fillStyle = '#ffffff';
    for (let i = 0; i < 9; i += 1) {
      const g = Math.floor((s.f + i * 5) / 9); const age = (s.f + i * 5) % 9;
      const x = Math.round(118 + hash(i, g) * 250); const y = Math.round(s.view.top + hash(i + 31, g) * (s.view.bottom - s.view.top));
      if (age > 5 || !open(x, y)) continue;
      ctx.globalAlpha = age < 2 || age > 3 ? 0.45 : 0.9;
      ctx.fillRect(x, y, age > 1 && age < 5 ? 2 : 1, 1);
    }
    ctx.globalAlpha = 1;
  };
  const drawOtter = (ctx, o) => {
    const flip = o.dir < 0;
    const bob = Math.sin((s.f + o.ph * 3) / 9) > 0.6 ? 1 : 0;
    const y = o.y + bob;
    if (o.state === 'float') {
      // tap, tap, tap on the oyster, then a rest
      const c = (s.f + o.ph) % 36;
      afloat(ctx, OTTER[c < 12 && (c >> 1) % 2 ? 1 : 0], P.otter, o.x, y, 0, flip, s.f);
    } else if (o.state === 'fumble') afloat(ctx, o.t < 4 ? OTTER_FUMBLE : OTTER_OH, P.otter, o.x, y, 0, flip, s.f);
    else if (o.state === 'oh') afloat(ctx, OTTER_OH, P.otter, o.x + (o.t > 6 && o.t < 16 && o.t % 4 < 2 ? 1 : 0), y, 0, flip, s.f);
    else if (o.state === 'dive') afloat(ctx, OTTER_DIVE, P.otter, o.x + (flip ? 2 : 6), y, Math.max(0, o.t - 4) * 2, flip, s.f);
    else if (o.state === 'up') afloat(ctx, OTTER[1], P.otter, o.x, y, OTTER_H * (1 - o.t / 8), flip, s.f);
  };
  const drawLand = (ctx, a) => {
    const k = LAND[a.kind];
    const walking = a.state !== 'stay';
    let rows = walking ? k.step[(a.t >> 2) & 1] : k.stand;
    if (!walking && a.kind === 'moose' && !a.look && a.t % 56 < 26) rows = MOOSE_EATS;
    if (!walking && a.kind === 'bear' && a.biting) rows = GRIZZLY_CATCH;
    const at = landAt(a.x + k.w / 2, k);
    const bob = walking && (a.t >> 2) & 1 ? 1 : 0;
    // on the grass and the ice it stands on its feet; in the bay the water hides its legs
    if (at.wet < 0.5) draw(ctx, Math.round(a.x), Math.round(at.y) - rows.length + bob, rows, k.pal, a.dir > 0);
    else afloat(ctx, rows, k.pal, a.x, at.y + bob, k.sink * (at.wet - 0.5) * 2, a.dir > 0, s.f);
    // the spruces it walks behind
    const cv = coverArt();
    if (cv && a.x + k.w > cv.x - 2) ctx.drawImage(cv.c, cv.x, cv.y);
  };

  return {
    /** For the preview script: make something happen now ('pod', 'whale', 'otters', 'moose', 'bear'). */
    show(what) {
      if (what === 'pod') startPod(); else if (what === 'whale') startWhale(); else if (what === 'otters') startOtters(); else startLand(what);
    },
    state: s,
    poke(x, y) {
      const raft = s.otters;
      if (raft) {
        for (const o of raft.members) {
          if (o.state === 'float' && x > o.x - 4 && x < o.x + OTTER_W + 4 && y > o.y - 14 && y < o.y + 6) {
            o.state = 'fumble'; o.t = 0;
            say('eep', o.y);
            return true;
          }
        }
      }
      for (const p of s.puffins) {
        if (p.state === 'sit' && x > p.x - 5 && x < p.x + PUFFIN_W + 5 && y > p.y - 13 && y < p.y + 5) { launch(p, -3.6, 0); return true; }
      }
      const a = s.land;
      if (a && a.state === 'stay' && a.kind === 'moose') {
        const k = LAND.moose; const base = shoreY(a.x + k.w / 2);
        if (x > a.x && x < a.x + k.w && y > base - 22 && y < base + 12) { a.look = 20; return true; }
      }
      return false;
    },
    step(t, view) {
      s.f += 1;
      s.view = view;
      if (!s.pod && !s.whale && s.f > s.nextSea) { if (s.lastSea === 'pod' ? Math.random() < 0.75 : Math.random() < 0.35) startWhale(); else startPod(); }
      if (!s.otters && s.f > s.nextOtters) startOtters();
      if (!s.land && s.f > s.nextLand) startLand(winter() || Math.random() < 0.5 ? 'moose' : 'bear');
      if (s.pod) stepPod();
      if (s.whale) stepWhale();
      if (s.otters) stepOtters();
      if (s.land) stepLand();
      s.puffins.forEach(stepPuffin);
      for (const d of s.drops) { d.x += d.vx; d.y += d.vy; d.vy += 0.3; }
      s.drops = s.drops.filter((d) => d.y < d.floor);
      for (const r of s.rings) r.t += 1;
      s.rings = s.rings.filter((r) => r.t < (r.big ? 16 : 11));
      for (const o of s.oysters) {
        o.x += o.vx; o.y += o.vy; o.vy += 0.42;
        if (o.y >= o.floor) { o.done = true; splash(o.x + 2, o.floor, 4, 0.7); say('plop', o.floor); }
      }
      s.oysters = s.oysters.filter((o) => !o.done);
      for (const b of s.blows) b.t += 1;
      s.blows = s.blows.filter((b) => b.t < 20);
      for (const q of s.salmon) q.t += 1;
      s.salmon = s.salmon.filter((q) => q.t < (q.caught ? 6 : 13));
    },
    draw(ctx) {
      drawFalls(ctx);
      drawGlints(ctx);
      s.rings.forEach((r) => drawRing(ctx, r));
      // back to front
      const things = [];
      if (s.otters) for (const o of s.otters.members) things.push([o.y, () => drawOtter(ctx, o)]);
      if (s.pod) {
        for (const o of s.pod.members) {
          if (o.out || o.up <= 0) continue;
          const w = o.rows[0].length; const h = o.rows.length - 1;
          things.push([o.y, () => {
            afloat(ctx, o.rows, P.orca, o.x - w / 2, o.y, h * (1 - o.up), o.dir < 0, s.f);
            if (o.blow) draw(ctx, o.x - w / 2 + (o.dir > 0 ? w - 15 : 10), o.y - 12 - (8 - o.blow) / 2, ORCA_BLOW, P.spray, false);
          }]);
        }
      }
      const w = s.whale;
      if (w && w.phase !== 'under' && w.phase !== 'bubbles' && w.phase !== 'fluke') things.push([w.y, () => afloat(ctx, WHALE_BACK, P.whale, w.x, w.y, w.sink, w.dir < 0, s.f)]);
      if (w && w.fluke) things.push([w.y, () => afloat(ctx, WHALE_FLUKE, P.whale, w.fluke.x, w.fluke.y, w.fluke.sink, false, s.f)]);
      for (const p of s.puffins) {
        things.push([p.y + 0.5, () => {
          const bob = Math.sin((s.f + p.ph) / 7) > 0.5 ? 1 : 0;
          if (p.state === 'fly') draw(ctx, p.x - 2, p.y - p.alt - PUFFIN_UP[0].length + 2, PUFFIN_UP[(s.f >> 1) & 1], P.puffin, p.dir < 0);
          else if (p.state === 'ride') draw(ctx, p.x, p.y - p.alt - PUFFIN.length + 1, PUFFIN, P.puffin, p.dir < 0);
          else afloat(ctx, PUFFIN, P.puffin, p.x + (p.state === 'shake' && p.t % 4 < 2 ? 1 : 0), p.y + (p.state === 'sit' ? bob : 0), 0, p.dir < 0, s.f);
        }]);
      }
      if (s.land) things.push([landAt(s.land.x + LAND[s.land.kind].w / 2, LAND[s.land.kind]).y, () => drawLand(ctx, s.land)]);
      things.sort((a, b) => a[0] - b[0]).forEach(([, paint]) => paint());
      // the salmon at the creek mouth, the oysters in the air, the blow and the spray
      for (const q of s.salmon) {
        const k = q.t / 12;
        draw(ctx, mouth.x - 8 + k * 6, mouth.y + 8 - k * 14 - Math.sin(k * Math.PI) * 8, SALMON_LEAP, P.bear, false);
      }
      for (const o of s.oysters) draw(ctx, o.x, o.y, OYSTER, P.otter, false);
      for (const b of s.blows) {
        const rows = WHALE_BLOW[b.t < 2 ? 0 : b.t < 5 ? 1 : 2];
        ctx.globalAlpha = b.t < 13 ? 1 : Math.max(0, 1 - (b.t - 13) / 7);
        draw(ctx, b.x - rows[0].length / 2, b.y - rows.length + 1, rows, P.spray, false);
        ctx.globalAlpha = 1;
      }
      for (const d of s.drops) { ctx.fillStyle = d.c; ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 1); }
    },
  };
}
