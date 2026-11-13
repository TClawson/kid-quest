// The Alaskan Fjord's wild things: the ones that swim in from the sea (a pod of orcas, a
// humpback whale and the puffin it blows into the air, sea otters with their oysters) and the
// ones that wander down to the water (a moose, a grizzly after the salmon). Sprites only, one
// art pixel to one village pixel like everything in the village; maplife.js moves them.
//
// Each sprite is rows of letters ('.' is see-through); sprite() wraps the shape in a dark
// outline (K). FJORD_PAL maps the letters to colors.

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
/** An orca's short, bushy blow. */
export const ORCA_BLOW = sprite(['a..a.a.', '.awawa.', 'awwwwwa', '.awwwa.', '..www..', '...w...'], false);

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
export const MOOSE = sprite([
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
]);
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
export const GRIZZLY = sprite([
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
]);
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
