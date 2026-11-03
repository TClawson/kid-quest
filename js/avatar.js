// Draws a kid's buddy as 16-bit style pixel art in an inline SVG (a 24 x 24 pixel scene).
// Every layer (background, species sprite, outfit items) is a small grid of palette letters.
// Animation is done in CSS (see .buddy rules in style.css) using the classes set here.

import { ITEMS, itemById, fitsSpecies } from './items.js';

const SIZE = 24;
const OUT = '#2a1838'; // outline
const SPRITE_X = 4;
const SPRITE_Y = 7;

// ---------- species ----------

const EARS = {
  pointed: [
    '..KK........KK..',
    '..KoK......KoK..',
    '..KooK....KooK..',
    '..KoOOKKKKOOoK..',
  ],
  round: [
    '................',
    '..KKK......KKK..',
    '.KoooK....KoooK.',
    '.KooOKKKKKKOooK.',
  ],
  // three back plates standing on top of the head
  // back plates; the tall middle one starts in the two DINO_CREST rows above
  plates: [
    '..K..KssssK..K..',
    '.KsK.KssssK.KsK.',
    '.KsKKKKssKKKKsK.',
    '..KKOOOOOOOOKK..',
  ],
  // floppy ears are painted down the sides of the head in speciesGrid
  floppy: [
    '................',
    '....KKKKKKKK....',
    '..KKOOOOOOOOKK..',
    '.KOOOOOOOOOOOOK.',
  ],
  // a smooth round head, no ears
  dome: [
    '................',
    '.....KKKKKK.....',
    '...KKOOOOOOKK...',
    '..KOOOOOOOOOOK..',
  ],
};

const BODY = [
  '.KOOOOOOOOOOOOK.', // 4
  '.KOOOOOOOOOOOOK.', // 5
  '.KOOEHOOOOEHOOK.', // 6
  '.KOOEEOOOOEEOOK.', // 7
  '.KPWWWWNNWWWWPK.', // 8
  '..KWWWMWWMWWWK..', // 9
  '...KWWWMMWWWK...', // 10
  '....KKKKKKKK....', // 11
  '...KOOWWWWOOK.KK', // 12
  '..KOOOWWWWOOOKTK', // 13
  '..KOOOWWWWOOOKtK', // 14
  '..KKOOKKKKOOKKK.', // 15
];

// rows that change with mood (row index -> string)
const MOOD_ROWS = {
  happy: {},
  excited: { 6: '.KOOOEOOOOEOOOK.', 7: '.KOOEOEOOEOEOOK.', 9: '..KWWMMMMMMWWK..', 10: '...KWWMPPMWWK...' },
  proud: { 9: '..KWMWWWWWWMWK..', 10: '...KWMMMMMMWK...' },
  sleepy: { 6: '.KOOOOOOOOOOOOK.', 7: '.KOEEOOOOOOEEOK.', 9: '..KWWWWWWWWWWK..', 10: '...KWWWMMWWWK...' },
  sad: { 5: '.KOOOEOOOOEOOOK.', 8: '.KPBWWWNNWWWWPK.', 9: '..KWWWWMMWWWWK..', 10: '...KWWMWWMWWK...' },
};

const COMMON = { K: OUT, E: OUT, N: OUT, H: '#ffffff', P: '#ff8fa3', M: '#7a2e1c', B: '#4dabf7' };

const SPECIES = {
  fox: { ears: 'pointed', tail: true, pal: { O: '#f08a3c', W: '#fff3e0', o: '#7a2e1c', T: '#f08a3c', t: '#fff3e0' }, shade: { O: ['#ffb066', '#c25e1c'], W: ['#ffffff', '#e8cfb4'], T: ['#ffb066', '#c25e1c'] } },
  bear: { ears: 'round', tail: false, pal: { O: '#b07443', W: '#ecc9a2', o: '#e8a77a' }, shade: { O: ['#d3955f', '#7f4f2a'], W: ['#f8e0c4', '#cfa77c'] } },
  panda: { ears: 'round', tail: false, pal: { O: '#ffffff', W: '#ffffff', o: '#2f2a36', D: '#2f2a36', Q: '#4f475e', M: '#2f2a36' }, shade: { O: ['#ffffff', '#d4d6e2'], W: ['#ffffff', '#d4d6e2'], D: ['#4a4356', '#1d1924'] } },
  cat: { ears: 'pointed', tail: true, whiskers: true, pal: { O: '#a6b1c6', W: '#f3f5fa', o: '#ffb3c6', T: '#a6b1c6', t: '#a6b1c6' }, shade: { O: ['#c8d0de', '#7d889e'], W: ['#ffffff', '#d5dae6'], T: ['#c8d0de', '#7d889e'] } },
  puppy: { ears: 'floppy', tail: true, floppy: true, pal: { O: '#e0a85e', W: '#fff4df', o: '#8a5530', T: '#e0a85e', t: '#8a5530' }, shade: { O: ['#f5c582', '#b47a3a'], W: ['#ffffff', '#e8d2ae'], o: ['#a8703f', '#5e3519'], T: ['#f5c582', '#b47a3a'] } },
  turtle: { ears: 'dome', tail: false, shell: true, pal: { O: '#7ccf6a', W: '#dff5b8', S: '#4f8a3a', s: '#a6d86b', y: '#f2d27a', Y: '#c99a3f' }, shade: { O: ['#a3e38f', '#4f9e44'], W: ['#f2ffd8', '#b8d98a'], S: ['#6aa84f', '#2f5e22'], y: ['#ffe8a3', '#c99a3f'] } },
  dino: { ears: 'plates', tail: true, pal: { O: '#5cbf5f', W: '#e6f7c8', w: '#c2e09a', d: '#3f9446', c: '#fffbe6', s: '#f79a38', T: '#5cbf5f', t: '#5cbf5f' }, shade: { O: ['#88d98a', '#3a8c41'], W: ['#f6ffe6', '#bcd99a'], T: ['#88d98a', '#3a8c41'], s: ['#ffc46b', '#c8650f'] } },
};

const paint = (g, y, x, row) => {
  for (let i = 0; i < row.length; i += 1) if (row[i] !== ' ') g[y][x + i] = row[i];
};

// Panda: black ears, slanted teardrop eye patches with white-ringed eyes, a black shoulder band, arms and legs.
function pandaMarks(g) {
  const patch = { 5: [4, 5, 10, 11], 6: [3, 4, 5, 6, 9, 10, 11, 12], 7: [3, 4, 5, 6, 9, 10, 11, 12], 8: [3, 4, 5, 10, 11, 12] };
  for (const [y, xs] of Object.entries(patch)) {
    for (const x of xs) {
      const c = g[y][x];
      if (c === 'O' || c === 'W' || c === 'P') g[y][x] = 'Q';
    }
  }
  for (let y = 0; y < 4; y += 1) for (let x = 0; x < 16; x += 1) if (g[y][x] === 'O' || g[y][x] === 'o') g[y][x] = 'D';
  for (let y = 12; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (g[y][x] === 'O') g[y][x] = 'D';
  return g;
}

// Dino mouths by mood: a wide jaw that pokes out past the cheeks, with nostrils and little teeth.
const DINO_CREST = ['.......KK.......', '......KssK......'];

const DINO_MOUTH = {
  happy: ['KOPOOONOONOOOPOK', 'KOOMHMHMMHMHMOOK', '.KOOMMMPPMMMOOK.'],
  excited: ['KOPOOONOONOOOPOK', 'KOMHMHMHHMHMHMOK', '.KOOMMMPPMMMOOK.'],
  proud: ['KOPOOONOONOOOPOK', 'KOMOOOOOOOOOOMOK', '.KOMHMHMMHMHMOK.'],
  sleepy: ['KOPOOONOONOOOPOK', 'KOOOOOOOOOOOOOOK', '.KOOOOMMMMOOOOK.'],
  sad: ['KOBOOONOONOOOPOK', 'KOOOOOMMMMOOOOOK', '.KOOOMOOOOMOOOK.'],
};

// Dino: a ridge of spikes on the head, brow ridges, a wide toothy jaw, a striped belly and a big spiky tail.
function dinoMarks(g, mood) {
  g = g.map((r) => [...r, '.', '.', '.', '.']);
  const mouth = DINO_MOUTH[mood] || DINO_MOUTH.happy;
  mouth.forEach((r, i) => paint(g, 8 + i, 0, r.replace(/\./g, ' ')));
  paint(g, 11, 2, 'KKKKKKKKKKKK');
  // brow ridges over the eyes and spots on the head
  for (const [y, x] of [[5, 3], [5, 4], [5, 11], [5, 12], [4, 6], [4, 9]]) if (g[y][x] === 'O') g[y][x] = 'd';
  // striped belly
  paint(g, 13, 6, 'wwww');
  // claws
  paint(g, 15, 4, 'cc'); paint(g, 15, 10, 'cc');
  // big tail with spikes along the top
  const tail = {
    8: '      K ',
    9: '     KsK',
    10: '  K  KTK',
    11: ' KsK KTK',
    12: 'KsTsKKTK',
    13: 'KTTTTTTK',
    14: 'TTTTTTK ',
    15: 'KKKKKK  ',
  };
  for (const [y, r] of Object.entries(tail)) paint(g, Number(y), 12, r);
  return g;
}

function speciesGrid(speciesId, mood) {
  const sp = SPECIES[speciesId] || SPECIES.bear;
  const rows = [...EARS[sp.ears], ...BODY];
  const moodRows = MOOD_ROWS[mood] || {};
  for (const [i, r] of Object.entries(moodRows)) rows[Number(i)] = r;
  let g = rows.map((r) => r.split(''));
  if (!sp.tail) {
    for (const [y, x] of [[12, 14], [12, 15], [13, 13], [13, 14], [13, 15], [14, 13], [14, 14], [14, 15], [15, 14]]) g[y][x] = '.';
    g[13][13] = 'K'; g[14][13] = 'K';
    g[12][12] = 'K';
  }
  if (speciesId === 'panda') g = pandaMarks(g);
  if (speciesId === 'dino') g = dinoMarks(g, mood);
  if (sp.floppy) {
    // ears hang down beside the cheeks
    const left = ['Koo', 'Koo', 'KooK', 'KooK', '.KoK'];
    left.forEach((r, i) => {
      const y = 4 + i;
      for (let x = 0; x < r.length; x += 1) {
        if (r[x] === '.') continue;
        g[y][x] = r[x];
        g[y][15 - x] = r[x];
      }
    });
    g[3][0] = '.'; g[3][15] = '.'; g[3][1] = 'K'; g[3][14] = 'K';
    g[8][1] = '.'; g[8][14] = '.';
  }
  if (sp.shell) {
    // shell at the sides with a light rim, a yellow belly plate in front, green arms and feet
    const shell = {
      11: '.KSKKKKKKKKKKSK.',
      12: 'KSsKOOyyyyOOKsSK',
      13: 'KSsKOOYYYYOOKsSK',
      14: 'KSsKKKyyyyKKKsSK',
      15: '.KKKOOKKKKOOKKK.',
    };
    for (const [y, r] of Object.entries(shell)) g[Number(y)] = r.split('');
  }
  if (sp.whiskers) {
    g[8][0] = 'K'; g[9][0] = 'K'; g[8][15] = 'K'; g[9][15] = 'K';
  }
  // rows drawn above the usual top of the sprite (the dino's tallest plate)
  const above = speciesId === 'dino' ? DINO_CREST.map((r) => r.padEnd(g[0].length, '.').split('')) : [];
  g = [...above, ...g].map((r) => r.join(''));
  return { grid: g, lift: above.length, pal: { ...COMMON, ...sp.pal }, shade: sp.shade };
}

// ---------- outfit items: [originX, originY, grid, palette, shade?, behind?] ----------

const SH = (base, light, dark) => [base, [light, dark]];

const ITEM_ART = {
  'hat-cap': [5, 5, [
    '.....KKKK.....',
    '...KKRRRRKK...',
    '..KRRRWWRRRK..',
    '.KRRRRRRRRRRK.',
    '.KRRRRRRRRRRK.',
    'KRRRRRRRRRRRRKKKK',
    'KKKKKKKKKKKKKRRRK',
    '.............KKK.',
  ], { R: SH('#e03131', '#ff6b6b', '#a51d1d'), W: '#ffffff' }],
  'hat-party': [8, 0, [
    '....Y....',
    '...YYY...',
    '....K....',
    '...KPK...',
    '...KPK...',
    '..KPYPK..',
    '..KPPPK..',
    '.KYPPPYK.',
    '.KPPPPPK.',
    'KPPYPYPPK',
    'KKKKKKKKK',
  ], { P: SH('#845ef7', '#b197fc', '#5f3dc4'), Y: '#ffd43b' }],
  'hat-beanie': [5, 3, [
    '......WW......',
    '.....WWWW.....',
    '....KKKKKK....',
    '..KKBBBBBBKK..',
    '.KBBBBBBBBBBK.',
    '.KBBBBBBBBBBK.',
    'KbbbbbbbbbbbbK',
    'KbbbbbbbbbbbbK',
    '.KKKKKKKKKKKK.',
  ], { B: SH('#1c7ed6', '#4dabf7', '#1864ab'), b: SH('#1864ab', '#1c7ed6', '#0b4f8a'), W: '#ffffff' }],
  'hat-headphones': [3, 7, [
    '...KKKKKKKKKKKK...',
    '..KGGGGGGGGGGGGK..',
    '.KGK..........KGK.',
    '.KG............GK.',
    '.KG............GK.',
    'KKKK..........KKKK',
    'KMMK..........KMMK',
    'KMMK..........KMMK',
    'KMMK..........KMMK',
    'KKKK..........KKKK',
  ], { G: SH('#495057', '#868e96', '#343a40'), M: SH('#e64980', '#f783ac', '#a61e4d') }],
  'hat-cowboy': [3, 4, [
    '......KKKKKK......',
    '.....KCCCCCCK.....',
    '.....KCCCCCCK.....',
    '.....KCCCCCCK.....',
    '.....KYYYYYYK.....',
    'KKKKKKKKKKKKKKKKKK',
    'KCCCCCCCCCCCCCCCCK',
    '.KKKKKKKKKKKKKKKK.',
  ], { C: SH('#a0522d', '#c97a4a', '#6e3517'), Y: '#ffd43b' }],
  'hat-wizard': [4, 0, [
    '..........KK....',
    '.........KUK....',
    '........KUUK....',
    '.......KUUK.....',
    '......KUUYK.....',
    '......KUUUK.....',
    '.....KUYUUUK....',
    '.....KUUUUUK....',
    '....KUUUUYUUK...',
    '...KUUUUUUUUUK..',
    'KKKKKKKKKKKKKKKK',
    'KVVVVVVVVVVVVVVK',
    '.KKKKKKKKKKKKKK.',
  ], { U: SH('#5f3dc4', '#845ef7', '#3b1f8f'), V: SH('#7048e8', '#9775fa', '#4c2bb5'), Y: '#ffd43b' }],
  'hat-tophat': [6, 1, [
    '..KKKKKKKK..',
    '..KAAAAAAK..',
    '..KAAAAAAK..',
    '..KAAAAAAK..',
    '..KAAAAAAK..',
    '..KAAAAAAK..',
    '..KRRRRRRK..',
    '..KAAAAAAK..',
    'KKKKKKKKKKKK',
    'KAAAAAAAAAAK',
    'KKKKKKKKKKKK',
  ], { A: SH('#343a40', '#5c636a', '#1b1e21'), R: '#e03131' }],
  'hat-crown': [5, 4, [
    '.K....KK....K.',
    'KYK..KYYK..KYK',
    'KYYKKYYYYKKYYK',
    'KYYYYYYYYYYYYK',
    'KYGYYYRRYYYBYK',
    'KYYYYYYYYYYYYK',
    'KKKKKKKKKKKKKK',
  ], { Y: SH('#fcc419', '#ffe066', '#e67700'), G: '#51cf66', R: '#e64980', B: '#4dabf7' }],

  'face-round': [7, 12, [
    'KKKK..KKKK',
    'K..KKKK..K',
    'K..K..K..K',
    'KKKK..KKKK',
  ], {}],
  'face-sun': [7, 12, [
    'KKKKKKKKKK',
    'KLSK..KLSK',
    'KSSK..KSSK',
    '.KK....KK.',
  ], { S: '#343a40', L: '#adb5bd' }],
  'face-heart': [6, 12, [
    'QQ.QQ..QQ.QQ',
    'QQQQQKKQQQQQ',
    '.QQQ....QQQ.',
    '..Q......Q..',
  ], { Q: '#f06595' }],
  'face-star': [6, 11, [
    '..Y......Y..',
    '.YYY....YYY.',
    'YYYYYKKYYYYY',
    '.YYY....YYY.',
    '.Y.Y....Y.Y.',
  ], { Y: '#fcc419' }],
  'face-pirate': [5, 10, [
    'KK...........',
    '..KK.........',
    '....KK..KKKK.',
    '......KKKKKK.',
    '........KKKK.',
    '.........KK..',
  ], {}],

  'neck-bowtie': [8, 18, [
    'KRRKKRRK',
    'KRRRRRRK',
    'KRRKKRRK',
  ], { R: SH('#e03131', '#ff6b6b', '#a51d1d') }],
  'neck-scarf': [6, 18, [
    'KOOOOOOOOOOK',
    'KOWOWOWOWOOK',
    '.KKKKKKOOKK.',
    '.......KOOK.',
    '.......KKKK.',
  ], { O: SH('#f76707', '#ff922b', '#c2410c'), W: '#ffc078' }],
  'neck-medal': [9, 18, [
    'B....B',
    '.B..B.',
    '..KK..',
    '.KYYK.',
    '.KYYK.',
    '..KK..',
  ], { B: '#1c7ed6', Y: SH('#fcc419', '#ffe066', '#e67700') }],
  'neck-cape': [4, 17, [
    '..KKKKKKKKKKKK..',
    '.KRRRRRRRRRRRRK.',
    '.KRRRRRRRRRRRRK.',
    'KRRRRRRRRRRRRRRK',
    'KRRRRRRRRRRRRRRK',
    'KRRRRRRRRRRRRRRK',
    'KKKKKKKKKKKKKKKK',
  ], { R: SH('#e03131', '#ff6b6b', '#a51d1d') }, true],
  'neck-necklace': [7, 18, [
    'Y........Y',
    '.Y......Y.',
    '..YY..YY..',
    '....KK....',
    '...KBBK...',
    '....KK....',
  ], { Y: '#fcc419', B: '#4dabf7' }],
  // ----- buddy specials (one kind of buddy each, see items.js) -----
  // fox: a furry frontier cap with a ringed tail hanging down the side
  'hat-coonskin': [5, 4, [
    '....KKKKKK........',
    '..KKFFfFFFKK......',
    '.KFFFfFFFfFFK.....',
    '.KFfFFFFFFFfKKK...',
    'KFFFFFfFFFFFFtdK..',
    'KFFfFFFFFfFFFKttK.',
    'KBBBBBBBBBBBBKddK.',
    'KBbBBbBBbBBbBKttK.',
    'KKKKKKKKKKKKKKddK.',
    '..............KttK',
    '..............KddK',
    '..............KttK',
    '..............KddK',
    '...............KK.',
  ], { F: SH('#9c8470', '#c4ad96', '#6e5a48'), f: '#c4ad96', t: '#d9ccb8', d: '#2f2a28', B: SH('#6e4a2e', '#8d6240', '#4a2f1c'), b: '#b08a62' }],
  // bear: a straw beehive worn upside down on the head, dripping honey, with two bees
  'hat-beehive': [2, 1, [
    '........KKKK........',
    '.......KYYYYK.......',
    '......KbbbbbbK......',
    'WW....KYYYYYYK......',
    'YK...KbbbbbbbbK.....',
    '.....KYYYYYYYYK.....',
    '....KbbbbbbbbbbK..WW',
    '....KYYYKKKYYYYK..KY',
    '...KbbbbKKKbbbbbK...',
    '...KYYYYYYYYYYYYK...',
    '...KbbbbbbbbbbbbK...',
    '...KHKKKKKKKKKKHK...',
    '....H..........H....',
  ], { Y: SH('#f2c25a', '#ffe08a', '#c98a2b'), b: '#c98a3a', H: '#f59f00', W: '#e7f5ff' }],
  // panda: a bamboo stick leaning on the side away from held sports gear (drawn behind the panda)
  'neck-bamboo': [16, 6, [
    'LL....l.',
    '.LLL.ll.',
    '...LKlK.',
    '..KGgK..',
    '..KGgK..',
    '..KNNK..',
    '..KGgK..',
    '...KGgK.',
    '...KGgK.',
    '...KNNK.',
    '...KGgK.',
    '...KGgK.',
    '....KGgK',
    '....KNNK',
    '....KGgK',
    '....KGgK',
    '....KNNK',
    '....KKKK',
  ], { G: '#69b34c', g: '#3f8a2e', N: '#2f6e22', L: '#3f9e34', l: '#7bd65a' }, 'behind'],
  // cat: a yarn necklace with a ball of yarn and a loose end
  'neck-yarn': [6, 18, [
    'S..........S',
    '.SS......SS.',
    '...SSKKKSS..',
    '....KRrRK...',
    '...KRRrRRK..',
    '....KrRRK.SS',
  ], { S: '#c92a2a', R: SH('#f03e3e', '#ff8787', '#a51d1d'), r: '#ffc9c9' }],
  // dino: a basketball jersey with a gold collar and a number 7, fitted inside the body outline below the chin
  'neck-jersey': [7, 19, [
    '.JJTTTTJJ',
    'JJJJWWJJJ',
    'JJJJJWJJJ',
  ], { J: SH('#7048e8', '#9775fa', '#4c2bb5'), T: '#ffd43b', W: '#ffffff' }],
  // puppy: a chew bone held in its mouth
  'neck-bone': [3, 15, [
    '.KK............KK.',
    'KWWKKKKKKKKKKKKWWK',
    'KWWWWWWWWWWWWWWWWK',
    'KWWKKKKKKKKKKKKWWK',
    '.KK............KK.',
  ], { W: SH('#fbf8f0', '#ffffff', '#c9c1ad') }],
  // turtle: a tied cloth eye mask with two tails fluttering behind
  'face-ninja': [5, 12, [
    'KKKKKKKKKKKKKK....',
    'KMM..MMMM..MMKKK..',
    'KMM..MMMM..MMKMMK.',
    'KKKKKKKKKKKKKKKMMK',
    '.............KMK.K',
    '..............KMMK',
    '...............KK.',
  ], { M: SH('#1c7ed6', '#4dabf7', '#1864ab') }],
};

// ---------- music items: an instrument the buddy sits at ----------
// behind: drawn before the buddy (cabinet, pipes), front: drawn over the buddy's body (keys).
// flames: two frames that CSS swaps for a flicker.

const KEYS20 = 'WkWkWWkWkWkWWkWkWWkW';
const WOOD = SH('#a0612f', '#c98a4b', '#6e3d1a');
const GLOSS = SH('#2b2533', '#4a4256', '#16121b');
const CHROME = SH('#ced4da', '#ffffff', '#868e96');
const KEYS = { W: '#fffdf5', k: OUT };
const FIRE = { Y: '#ffe066', O: '#ff922b', R: '#e03131' };

const MUSIC_ART = {
  'music-keyboard': {
    front: [[3, 18, [
      '.KKKKKKKKKKKKKKKK.',
      'KCCCCCCCCCCCCrCgCK',
      'KWkWkWWkWkWkWWkWkK',
      'KWWWWWWWWWWWWWWWWK',
      '.KKKKKKKKKKKKKKKK.',
      '..KK..........KK..',
    ], { C: SH('#495057', '#868e96', '#343a40'), r: '#ff6b6b', g: '#69db7c', ...KEYS }]],
  },
  'music-upright': {
    behind: [
      [1, 11, [
        'KKKKKKKKKKKKKKKKKKKKKK',
        'KLLLLLLLLLLLLLLLLLLLLK',
        'KKKKKKKKKKKKKKKKKKKKKK',
        ...Array(4).fill('KBBBBBBBBBBBBBBBBBBBBK'),
      ], { L: SH('#d39b5c', '#f0c48a', '#a0612f'), B: WOOD }],
      // a candle on the left, sheet music on the right
      [2, 7, ['.Y.', '.O.', 'KWK', 'KWK'], { Y: '#ffe066', O: '#ff922b', W: '#fff3d6' }],
      [18, 7, ['KKKKK', 'KWkWK', 'KkWWK', 'KWWkK'], { W: '#fffdf5', k: '#5c4a6a' }],
    ],
    front: [[1, 18, [
      'KKKKKKKKKKKKKKKKKKKKKK',
      `K${KEYS20}K`,
      'KKKKKKKKKKKKKKKKKKKKKK',
      'KBBBBBBBGBBBBGBBBBBBBK',
      'KBBBBBBBBBBBBBBBBBBBBK',
      'KKKKKKKKKKKKKKKKKKKKKK',
    ], { B: WOOD, G: '#fcc419', ...KEYS }]],
  },
  'music-rock': {
    behind: [
      // chrome exhaust pipes on both sides
      [0, 3, [
        'KKKK................KKKK',
        ...Array(7).fill('KCCK................KCCK'),
      ], { C: CHROME }],
      [0, 11, [
        'KKKKKKKKKKKKKKKKKKKKKKKK',
        'KRRRRRRRRRRRRRRRRRRRRRRK',
        'KKKKKKKKKKKKKKKKKKKKKKKK',
        ...Array(4).fill('KNNNNNNNNNNNNNNNNNNNNNNK'),
      ], { R: SH('#e03131', '#ff6b6b', '#a51d1d'), N: GLOSS }],
      // flame decals on the sides
      [1, 13, ['..Y.', '.YY.', '.YOY', 'YOOY', 'OROO'], FIRE],
      [19, 13, ['.Y..', '.YY.', 'YOY.', 'YOOY', 'OORO'], FIRE],
    ],
    front: [[0, 18, [
      'KKKKKKKKKKKKKKKKKKKKKKKK',
      'KWkWkWWkWkWkWWkWkWWkWkWK',
      'KRRRRRRRRRRRRRRRRRRRRRRK',
      'KNNYNNNNYNNNNYNNNNYNNNNK',
      'KNYOYNNYOYNNYOYNNYOYNNNK',
      'KKKKKKKKKKKKKKKKKKKKKKKK',
    ], { R: '#e03131', N: GLOSS, ...FIRE, ...KEYS }]],
    flames: [
      [[0, 0, ['.Y..', 'YOY.', '.RO.'], FIRE], [20, 0, ['..Y.', '.YOY', '.OR.'], FIRE]],
      [[0, 0, ['..Y.', '.YOY', '.OR.'], FIRE], [20, 0, ['.Y..', 'YOY.', '.RO.'], FIRE]],
    ],
  },
};

/** A piano's pixels: part is 'behind' or 'front', or a flame frame index for the rock piano. */
function musicPx(id, part) {
  const art = MUSIC_ART[id];
  const px = new Pixels();
  const pieces = typeof part === 'number' ? art?.flames?.[part] : art?.[part];
  (pieces || []).forEach(([x, y, rows, pal]) => px.grid(x, y, rows, pal));
  return px;
}

function musicLayer(id, part) {
  const art = MUSIC_ART[id];
  if (!art) return '';
  if (part === 'flames') return (art.flames || []).map((_, i) => `<g class="flame flame-${i}">${musicPx(id, i).svg()}</g>`).join('');
  return musicPx(id, part).svg();
}

// ---------- sports gear ----------
// Each kind has one drawing and three palettes: regular, good and super.
// Gear is drawn where the buddy holds it. During a move, CSS animates the
// .gear and .prop groups (see the .trick-* rules in style.css).

const GEAR_ART = {
  soccer: [0, 16, [
    '..KKK..',
    '.KWDWK.',
    'KWDDDWK',
    'KDWDWDK',
    'KWWWWWK',
    '.KWDWK.',
    '..KKK..',
  ], [
    { W: SH('#ffffff', '#ffffff', '#ced4da'), D: '#343a40' },
    { W: SH('#ffffff', '#ffffff', '#ced4da'), D: '#1c7ed6' },
    { W: SH('#ffe066', '#fff3bf', '#f59f00'), D: '#e8590c' },
  ]],
  football: [0, 15, [
    '..KKKK..',
    '.KBBBBK.',
    'KWBLLBWK',
    '.KBBBBK.',
    '..KKKK..',
  ], [
    { B: SH('#a0522d', '#c97a4a', '#6e3517'), W: '#ffffff', L: '#ffffff' },
    { B: SH('#7a2e1c', '#a0522d', '#4a1a0e'), W: '#ffd43b', L: '#ffffff' },
    { B: SH('#fcc419', '#ffe066', '#e67700'), W: '#ffffff', L: '#e03131' },
  ]],
  hockey: [0, 10, [
    '....KK',
    '...KTK',
    '..KSK.',
    '..KSK.',
    '.KSK..',
    '.KSK..',
    '.KSK..',
    'KSK...',
    'KSK...',
    'KSK...',
    'KSKKKK',
    'KBBBBK',
    'KKKKKK',
  ], [
    { S: SH('#c98a4b', '#f0c48a', '#a0612f'), T: '#343a40', B: '#ffffff' },
    { S: SH('#343a40', '#5c636a', '#1b1e21'), T: '#e03131', B: '#1c7ed6' },
    { S: SH('#fcc419', '#ffe066', '#e67700'), T: '#e03131', B: '#e03131' },
  ]],
  rod: [17, 5, [
    '.....KK',
    '....KRK',
    '....KRK',
    '...KRK.',
    '...KRK.',
    '..KRK..',
    '.KCCK..',
    '.KCCK..',
    '.KRK...',
    'KRK....',
    'KKK....',
  ], [
    { R: '#c98a4b', C: '#868e96' },
    { R: '#495057', C: '#e03131' },
    { R: '#fcc419', C: '#4dabf7' },
  ]],
  // worn on the feet
  shoes: [0, 0, null, [
    { S: SH('#e03131', '#ff6b6b', '#a51d1d'), W: '#ffffff' },
    { S: SH('#1c7ed6', '#4dabf7', '#1864ab'), W: '#ffd43b' },
    { S: SH('#fcc419', '#ffe066', '#e67700'), W: '#ffffff' },
  ]],
};
const SHOE = ['KSSSK.', 'KSWSSK', 'KWWWWK'];
const WING = ['W.', 'WW'];

/** The gear's pixels. dx/dy move it from where it is held. */
function gearPixels(kind, tier, dx = 0, dy = 0) {
  return GEAR_ART[kind] ? gearPx(kind, tier, dx, dy).svg() : '';
}

function gearPx(kind, tier, dx = 0, dy = 0) {
  const art = GEAR_ART[kind];
  const pal = art[3][Math.max(0, Math.min(2, tier - 1))];
  const px = new Pixels();
  if (kind === 'shoes') {
    px.grid(6 + dx, 21 + dy, SHOE, pal);
    px.grid(13 + dx, 21 + dy, SHOE, pal);
    if (tier >= 3) { px.grid(4 + dx, 20 + dy, WING, { W: '#ffffff' }); px.grid(11 + dx, 20 + dy, WING, { W: '#ffffff' }); }
  } else {
    px.grid(art[0] + dx, art[1] + dy, art[2], pal);
  }
  return px;
}

/** A ball (or puck) on its own, for visitors playing a game together. */
export function ballSvg(kind, tier = 1) {
  const art = kind === 'hockey' ? [0, 0, PROP_ART.puck[2], PROP_ART.puck[3]] : GEAR_ART[kind];
  if (!art) return '';
  const rows = art[2];
  const pal = kind === 'hockey' ? art[3] : art[3][Math.max(0, Math.min(2, tier - 1))];
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Pixels();
  px.grid(0, 0, rows, pal);
  return `<svg class="ball-svg pixel" viewBox="0 0 ${w} ${rows.length}" width="${w * 2.4}" height="${rows.length * 2.4}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${px.svg()}</svg>`;
}

/** The same ball (or puck) as colors, row by row (null for see-through), for canvas games. */
export function ballCells(kind, tier = 1) {
  const art = kind === 'hockey' ? [0, 0, PROP_ART.puck[2], PROP_ART.puck[3]] : GEAR_ART[kind];
  if (!art) return null;
  const rows = art[2];
  const pal = kind === 'hockey' ? art[3] : art[3][Math.max(0, Math.min(2, tier - 1))];
  const w = Math.max(...rows.map((r) => r.length));
  const px = new Pixels();
  px.grid(0, 0, rows, pal);
  return Array.from({ length: rows.length }, (_, y) => Array.from({ length: w }, (_, x) => px.cells.get(`${x},${y}`) || null));
}

// Small pieces some moves need, drawn at [x, y].
const PROP_ART = {
  puck: [6, 22, ['KKK', 'KPK'], { P: '#495057' }],
  hurdle: [20, 17, ['KKKK', 'KRWK', 'K..K', 'K..K', 'K..K', 'K..K'], { R: '#e03131', W: '#ffffff' }],
  bobber: [20, 18, ['KK', 'RW'], { R: '#e03131', W: '#ffffff' }],
  dust: [1, 20, ['.D.', 'DDD', '.D.'], { D: '#dee2e6' }],
  wind: [1, 9, ['WW....WW', '......', '..WWW...'], { W: '#e7f5ff' }],
};
const FISH = ['.KKK.K', 'KFFFKF', 'KFEFFK', 'KFFFKF', '.KKK.K'];
const FISH_PAL = [
  { F: SH('#74c0fc', '#d0ebff', '#1c7ed6'), E: OUT },
  { F: SH('#ff922b', '#ffc078', '#d9480f'), E: OUT },
  { F: SH('#fcc419', '#fff3bf', '#e67700'), E: OUT },
];
const BIG_FISH = [
  '...KKKKKK....K',
  '..KFFFFFFK..KF',
  '.KFHFFFFFFKKFK',
  'KFEFFFfFfFFFFK',
  'KFFFFFFfFFFFFK',
  '.KFFFFFFFFKKFK',
  '..KFFFFFFK..KF',
  '...KKKKKK....K',
];

function propPixels(id, tier) {
  const px = new Pixels();
  if (id === 'fish') px.grid(18, 14, FISH, FISH_PAL[Math.max(0, tier - 1)]);
  else if (id === 'bigfish') px.grid(5, 0, BIG_FISH, { ...FISH_PAL[Math.max(0, tier - 1)], H: '#ffffff', f: FISH_PAL[Math.max(0, tier - 1)].F[1][1] });
  else if (id === 'twinkle') {
    const star = (x, y) => px.grid(x - 1, y - 1, ['.Y.', 'YWY', '.Y.'], { Y: tier >= 3 ? '#ffd43b' : '#a5d8ff', W: '#ffffff' });
    star(2, 8); star(21, 4); star(3, 20);
  } else {
    const [x, y, rows, pal] = PROP_ART[id];
    px.grid(x, y, rows, pal);
  }
  return px.svg();
}

// What each move draws. gear: where the gear goes ('char' moves with the body,
// 'free' moves on its own). props: extra pieces, each in its own .prop-<id> group.
// ms: how long the move lasts (the CSS animations match).
export const MOVE_ART = {
  jacks: { props: ['arms'], ms: 1600 },
  cartwheel: { ms: 1600 },
  backflip: { ms: 1600 },
  keepy: { gear: 'free', ms: 1800 },
  flick: { gear: 'free', ms: 1600 },
  bicycle: { gear: 'free', ms: 1800 },
  dash: { gear: 'char', props: ['dust'], ms: 1400 },
  hurdle: { gear: 'char', props: ['hurdle'], ms: 1600 },
  tornado: { gear: 'char', props: ['wind'], ms: 1800 },
  spike: { gear: 'free', ms: 1600 },
  spiral: { gear: 'free', ms: 1800 },
  flipcatch: { gear: 'free', ms: 1800 },
  dangle: { gear: 'char', props: ['puck'], ms: 1600 },
  slapshot: { gear: 'char', props: ['puck'], ms: 1600 },
  spinorama: { gear: 'char', props: ['puck'], ms: 1800 },
  cast: { gear: 'char', props: ['bobber'], ms: 1800 },
  reel: { gear: 'char', props: ['fish'], ms: 1800 },
  whopper: { gear: 'char', props: ['bigfish'], ms: 2200 },
};

// ---------- what visitors catch in each map's pond ----------
// [name, grid, palette]: a common catch and a rare one per map theme. Better rods catch rare ones more often.
const CRAB = ['K.K..K.K', 'KRK..KRK', '.KRKKRK.', 'KRHRRHRK', 'KRRRRRRK', '.KKKKKK.', 'K.K..K.K'];
const JELLY = ['..KKKK..', '.KJJJJK.', 'KJHJJHJK', 'KJJJJJJK', 'KKKKKKKK', '.J.J.J.J', 'J.J.J.J.'];
const BOOT = ['.KKKK...', '.KBBK...', '.KBBK...', '.KBBK...', '.KBBKKKK', 'KBBBBBBK', 'KKKKKKKK'];
const GOBLET = ['KKKKKKK', 'KGgGGGK', 'KGGGGGK', '.KGGGK.', '..KGK..', '..KGK..', '.KGGGK.', 'KKKKKKK'];
const STAR = ['...K...', '..KYK..', 'KKKYKKK', 'KYYYYYK', '.KYYYK.', '.KYKYK.', 'KK...KK'];
const PEARL = ['.KKKKK.', 'KSSSSSK', 'KSKWKSK', 'KSKKKSK', 'KSSSSSK', '.KKKKK.'];
const fishPal = (base, light, dark) => ({ F: SH(base, light, dark), E: OUT });
const CATCHES = {
  'bg-meadow': [['bluegill', FISH, fishPal('#4dabf7', '#a5d8ff', '#1971c2')], ['golden trout', FISH, fishPal('#fcc419', '#fff3bf', '#e67700')]],
  'bg-sunset': [['crab', CRAB, { R: SH('#fa5252', '#ff8787', '#c92a2a'), H: '#ffffff' }], ['starfish', STAR, { Y: SH('#f783ac', '#fcc2d7', '#c2255c') }]],
  'bg-ocean': [['pufferfish', FISH, fishPal('#ffd43b', '#fff3bf', '#f08c00')], ['pearl', PEARL, { S: SH('#e599f7', '#f3d9fa', '#ae3ec9'), W: '#ffffff' }]],
  'bg-space': [['space jelly', JELLY, { J: SH('#63e6be', '#c3fae8', '#0ca678'), H: '#ffffff' }], ['moon fish', FISH, fishPal('#dee2e6', '#ffffff', '#868e96')]],
  'bg-castle': [['old boot', BOOT, { B: SH('#8d5524', '#b07443', '#5c3a1e') }], ['golden goblet', GOBLET, { G: SH('#fcc419', '#fff3bf', '#e67700'), g: '#ffffff' }]],
  'bg-volcano': [['lava fish', FISH, fishPal('#ff6b1a', '#ffe066', '#c92a2a')], ['fire dragon fish', FISH, fishPal('#e03131', '#ffd43b', '#862e9c')]],
  'bg-rainbow': [['rainbow trout', FISH, { F: SH('#ff8787', '#ffe066', '#748ffc'), E: OUT }], ['unicorn fish', FISH, fishPal('#f3d9fa', '#ffffff', '#da77f2')]],
  'bg-galaxy': [['star fish', STAR, { Y: SH('#ffd43b', '#fff9db', '#f08c00') }], ['comet fish', FISH, fishPal('#b197fc', '#e5dbff', '#5f3dc4')]],
};
const CATCH_ICON = { 'bg-volcano': '🔥', 'bg-space': '🚀', 'bg-castle': '🏰', 'bg-galaxy': '✨', 'bg-ocean': '🫧', 'bg-rainbow': '🌈', 'bg-sunset': '🏖️', 'bg-meadow': '🎣' };

/**
 * A catch for a fishing visitor on this map theme. rod: 1-3, better rods land
 * the rare catch more often. Returns { name, rare, icon, svg }.
 */
export function catchFor(theme, rod = 1, rnd = Math.random) {
  const list = CATCHES[theme] || CATCHES['bg-meadow'];
  const rare = rnd() < [0.1, 0.25, 0.5][Math.max(0, Math.min(2, rod - 1))];
  const [name, grid, pal] = list[rare ? 1 : 0];
  const w = Math.max(...grid.map((r) => r.length));
  const px = new Pixels();
  px.grid(0, 0, grid, pal);
  return {
    name, rare, icon: CATCH_ICON[theme] || '🎣',
    svg: `<svg class="catch-svg pixel" viewBox="0 0 ${w} ${grid.length}" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">${px.svg()}</svg>`,
  };
}

/** Arms for jumping jacks, in the buddy's fur color: up and down frames. */
function armPixels(speciesId) {
  const sp = SPECIES[speciesId] || SPECIES.bear;
  const fur = sp.pal.D && speciesId === 'panda' ? sp.pal.D : sp.pal.O;
  const up = new Pixels();
  up.grid(2, 9, ['K.', 'OK', 'KOK', '.KOK'], { O: fur });
  up.grid(18, 9, ['.K', 'KO', 'KOK', 'KOK.'].map((r) => r.padStart(4, '.')), { O: fur });
  const down = new Pixels();
  down.grid(2, 19, ['.KOK', 'KOK.', 'KK..'], { O: fur });
  down.grid(18, 19, ['KOK.', '.KOK', '..KK'], { O: fur });
  return `<g class="arms-up">${up.svg()}</g><g class="arms-down">${down.svg()}</g>`;
}

// ---------- backgrounds ----------

function bands(px, stops) {
  // stops: [[fromY, color], ...] filled to the next stop
  for (let i = 0; i < stops.length; i += 1) {
    const [y0, c] = stops[i];
    const y1 = i + 1 < stops.length ? stops[i + 1][0] : SIZE;
    px.rect(0, y0, SIZE, y1 - y0, c);
  }
}

const dots = (px, color, pts) => pts.forEach(([x, y]) => px.rect(x, y, 1, 1, color));

const BACKGROUNDS = {
  'bg-meadow': (px) => {
    bands(px, [[0, '#8fd3ff'], [7, '#a8ddff'], [13, '#c6ebff'], [20, '#74d474'], [21, '#5cc45c']]);
    px.rect(18, 2, 3, 3, '#ffe066'); dots(px, '#fff3bf', [[19, 1], [17, 3], [21, 3], [19, 5]]);
    px.rect(2, 4, 5, 1, '#ffffff'); px.rect(3, 3, 3, 1, '#ffffff');
    dots(px, '#ff8fa3', [[2, 22], [15, 23]]); dots(px, '#ffd43b', [[21, 21], [8, 23]]); dots(px, '#4fa84f', [[5, 21], [11, 22], [18, 22]]);
  },
  'bg-sunset': (px) => {
    bands(px, [[0, '#6741d9'], [5, '#9c36b5'], [9, '#e64980'], [13, '#ff922b'], [17, '#1c7ed6'], [21, '#ffe08a']]);
    px.rect(10, 14, 4, 1, '#ffd43b'); px.rect(9, 15, 6, 2, '#ffd43b');
    dots(px, '#74c0fc', [[3, 18], [4, 18], [16, 19], [17, 19], [10, 18], [11, 18], [12, 18]]);
    dots(px, '#ffffff', [[4, 2], [15, 1], [20, 4]]);
  },
  'bg-ocean': (px) => {
    bands(px, [[0, '#74c0fc'], [8, '#4dabf7'], [15, '#1c7ed6'], [21, '#ffe08a']]);
    dots(px, '#d0ebff', [[4, 3], [5, 6], [19, 2], [18, 9], [3, 12], [20, 14]]);
    px.rect(1, 15, 1, 6, '#2f9e44'); px.rect(2, 13, 1, 8, '#40c057'); px.rect(21, 14, 1, 7, '#2f9e44'); px.rect(22, 16, 1, 5, '#40c057');
    dots(px, '#ff8787', [[17, 22], [18, 22], [17, 21]]);
  },
  'bg-space': (px) => {
    bands(px, [[0, '#0b1026'], [12, '#1b1f4b'], [21, '#5c5f99']]);
    dots(px, '#ffffff', [[2, 2], [7, 5], [12, 1], [4, 10], [21, 9], [14, 4], [1, 15], [22, 16], [9, 13]]);
    px.rect(17, 2, 4, 4, '#ff8787'); px.rect(18, 2, 2, 1, '#ffa8a8'); px.rect(15, 4, 8, 1, '#ffd8a8');
    dots(px, '#4c4f86', [[3, 22], [4, 22], [16, 23], [17, 23], [11, 22]]);
  },
  'bg-castle': (px) => {
    bands(px, [[0, '#d0bfff'], [10, '#e5dbff'], [20, '#74d474'], [21, '#5cc45c']]);
    px.rect(0, 10, 4, 10, '#9775fa'); px.rect(20, 10, 4, 10, '#9775fa'); px.rect(4, 14, 16, 6, '#b197fc');
    dots(px, '#9775fa', [[4, 13], [6, 13], [8, 13], [15, 13], [17, 13], [19, 13], [0, 9], [2, 9], [21, 9], [23, 9]]);
    px.rect(1, 6, 1, 3, OUT); px.rect(2, 6, 2, 1, '#f783ac'); px.rect(22, 6, 1, 3, OUT); px.rect(20, 6, 2, 1, '#f783ac');
    px.rect(11, 16, 2, 4, '#5f3dc4');
  },
  'bg-volcano': (px) => {
    bands(px, [[0, '#ffa94d'], [9, '#ffd8a8'], [20, '#ffe066']]);
    for (let i = 0; i < 12; i += 1) px.rect(17 - Math.floor(i / 2), 8 + i, 7 + Math.floor(i / 2) * 2 - 6 + 6, 1, '#7a4a26');
    px.rect(16, 7, 4, 2, '#fa5252'); dots(px, '#ff8787', [[17, 9], [18, 10]]);
    px.rect(16, 3, 2, 2, '#ced4da'); px.rect(18, 1, 3, 2, '#e9ecef');
    px.rect(3, 13, 1, 7, '#8d5524'); px.rect(1, 12, 5, 1, '#2f9e44'); dots(px, '#2f9e44', [[0, 13], [6, 13], [2, 11], [4, 11]]);
  },
  'bg-rainbow': (px) => {
    bands(px, [[0, '#d0ebff'], [20, '#74d474'], [21, '#5cc45c']]);
    const colors = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
    for (let y = 0; y < 20; y += 1) {
      for (let x = 0; x < SIZE; x += 1) {
        const d = Math.hypot(x + 0.5 - 12, y + 0.5 - 21);
        const band = Math.floor(17 - d);
        if (band >= 0 && band < colors.length) px.rect(x, y, 1, 1, colors[band]);
      }
    }
    px.rect(0, 17, 5, 3, '#ffffff'); px.rect(1, 16, 3, 1, '#ffffff'); px.rect(19, 17, 5, 3, '#ffffff'); px.rect(20, 16, 3, 1, '#ffffff');
  },
  'bg-galaxy': (px) => {
    bands(px, [[0, '#1a1033'], [10, '#3b1f73'], [17, '#5f3dc4']]);
    dots(px, '#ffd43b', [[2, 3], [10, 1], [20, 2], [5, 9], [22, 11], [1, 17], [21, 20], [14, 6]]);
    const star = (x, y) => { px.rect(x, y - 1, 1, 3, '#fff3bf'); px.rect(x - 1, y, 3, 1, '#fff3bf'); };
    star(4, 5); star(19, 15); star(16, 3);
    px.rect(0, 22, 24, 2, '#7950f2');
  },
};

// ---------- rendering ----------

class Pixels {
  constructor() { this.cells = new Map(); }
  rect(x, y, w, h, c) {
    for (let yy = y; yy < y + h; yy += 1) for (let xx = x; xx < x + w; xx += 1) {
      if (xx >= 0 && yy >= 0 && xx < SIZE && yy < SIZE) this.cells.set(`${xx},${yy}`, c);
    }
  }
  /** Paint a letter grid. pal values are a color or [base, [light, dark]] for 16-bit shading. */
  grid(x0, y0, rows, pal, shade = {}) {
    rows.forEach((row, y) => {
      for (let x = 0; x < row.length; x += 1) {
        const ch = row[x];
        if (ch === '.') continue;
        let col = ch === 'K' ? OUT : pal[ch];
        let sh = shade[ch];
        if (Array.isArray(col)) { sh = col[1]; col = col[0]; }
        if (!col) continue;
        if (sh) {
          // light from the top-left: highlight next to an outline above/left, darken next to one below/right
          const at = (dx, dy) => (rows[y + dy] || '')[x + dx];
          if (at(1, 0) === 'K' || at(0, 1) === 'K') col = sh[1];
          else if (at(-1, 0) === 'K' || at(0, -1) === 'K') col = sh[0];
        }
        this.rect(x0 + x, y0 + y, 1, 1, col);
      }
    });
  }
  /** One <rect> per horizontal run of the same color. */
  svg() {
    let out = '';
    for (let y = 0; y < SIZE; y += 1) {
      let x = 0;
      while (x < SIZE) {
        const c = this.cells.get(`${x},${y}`);
        if (!c) { x += 1; continue; }
        let w = 1;
        while (x + w < SIZE && this.cells.get(`${x + w},${y}`) === c) w += 1;
        out += `<rect x="${x}" y="${y}" width="${w}" height="1" fill="${c}"/>`;
        x += w;
      }
    }
    return out;
  }
}

// ---------- color versions (see COLOR_VERSIONS in items.js) ----------

// [base, light, dark] for each paint color
const PAINT = {
  red: ['#e03131', '#ff6b6b', '#a51d1d'],
  orange: ['#f76707', '#ff922b', '#c2410c'],
  yellow: ['#fcc419', '#ffe066', '#e67700'],
  green: ['#2f9e44', '#69db7c', '#1b6e2e'],
  teal: ['#0ca678', '#38d9a9', '#087060'],
  blue: ['#1c7ed6', '#4dabf7', '#1864ab'],
  purple: ['#7048e8', '#9775fa', '#4c2bb5'],
  pink: ['#e64980', '#f783ac', '#a61e4d'],
  black: ['#343a40', '#5c636a', '#1b1e21'],
  gold: ['#f59f00', '#ffd43b', '#b35c00'],
};

const mix = (a, b, t) => '#' + [1, 3, 5].map((i) => {
  const v = Math.round(parseInt(a.slice(i, i + 2), 16) * (1 - t) + parseInt(b.slice(i, i + 2), 16) * t);
  return v.toString(16).padStart(2, '0');
}).join('');

// How each base item takes a new color: which palette letters change.
const RECOLOR = {
  'hat-cap': ([c, l, d]) => ({ R: SH(c, l, d) }),
  'neck-bowtie': ([c, l, d]) => ({ R: SH(c, l, d) }),
  'hat-beanie': ([c, l, d]) => ({ B: SH(c, l, d), b: SH(d, c, mix(d, '#000000', 0.3)) }),
  'neck-scarf': ([c, l, d]) => ({ O: SH(c, l, d), W: mix(l, '#ffffff', 0.45) }),
  // glasses frames are drawn in outline color; color versions paint the frame instead
  'face-round': ([c], rows) => ({ rows: rows.map((r) => r.replaceAll('K', 'F')), F: c }),
};

for (const item of ITEMS) {
  if (!item.base || ITEM_ART[item.id] || !ITEM_ART[item.base] || !RECOLOR[item.base]) continue;
  const [x, y, rows, pal, behind] = ITEM_ART[item.base];
  const { rows: newRows, ...newPal } = RECOLOR[item.base](PAINT[item.color], rows);
  ITEM_ART[item.id] = [x, y, newRows || rows, { ...pal, ...newPal }, behind];
}

// The bamboo stick on the left, for when held gear is on the right (the fishing rod).
{
  const [x, y, rows, pal, behind] = ITEM_ART['neck-bamboo'];
  const w = rows[0].length;
  ITEM_ART['neck-bamboo-left'] = [SIZE - x - w, y, rows.map((r) => [...r].reverse().join('')), pal, behind];
}

function itemLayer(id) {
  const art = ITEM_ART[id];
  if (!art) return '';
  const [x, y, rows, pal] = art;
  const px = new Pixels();
  px.grid(x, y, rows, pal);
  return px.svg();
}

function extras(mood) {
  const px = new Pixels();
  if (mood === 'sleepy') {
    px.grid(19, 2, ['KKK', '..K', '.K.', 'K..', 'KKK'], {});
    px.grid(16, 5, ['KK', '.K', 'KK'], {});
  }
  if (mood === 'proud' || mood === 'excited') {
    const sparkle = (x, y) => px.grid(x - 1, y - 1, ['.Y.', 'YWY', '.Y.'], { Y: '#ffd43b', W: '#fff9db' });
    sparkle(2, 5); sparkle(21, 10); sparkle(3, 17);
  }
  return px.svg();
}

/** The kind and version of a sport item id, like 'sport-rod-good' -> { kind: 'rod', tier: 2 }. */
export function gearOf(id) {
  const m = /^sport-([a-z]+)-(regular|good|super)$/.exec(id || '');
  return m ? { kind: m[1], tier: { regular: 1, good: 2, super: 3 }[m[2]] } : null;
}

/**
 * buddy: { species, outfit: { background, hat, face, neck, music, sport } }
 * mood: happy | excited | proud | sleepy | sad
 * opts.background: false to draw the character only (for small chips)
 * opts.trick: { move: move id, kind, tier } to draw the buddy doing a move
 * opts.gear: false to leave out held sports gear (small chips)
 */
export function buddySvg(buddy, mood = 'happy', opts = {}) {
  const speciesId = SPECIES[buddy?.species] ? buddy.species : 'bear';
  const o = buddy?.outfit || {};
  const showBg = opts.background !== false;
  const trick = opts.trick && MOVE_ART[opts.trick.move] ? opts.trick : null;
  const art = trick ? MOVE_ART[trick.move] : null;
  // the gear in the buddy's hands: what the move uses, or else what it holds
  let gear = trick ? (trick.kind && trick.kind !== 'body' ? { kind: trick.kind, tier: trick.tier || 1 } : null) : gearOf(o.sport);
  if (opts.gear === false) gear = null;
  // body moves keep held shoes on (they're on the feet); other gear is put down
  if (trick && !gear && gearOf(o.sport)?.kind === 'shoes') gear = gearOf(o.sport);
  const gearSvg = gear ? `<g class="gear gear-${gear.kind} tier-${gear.tier}">${gearPixels(gear.kind, gear.tier)}</g>` : '';
  const inChar = gear && (gear.kind === 'shoes' || gear.kind === 'rod' || gear.kind === 'hockey' || art?.gear === 'char');
  const props = (art?.props || []).map((id) => (id === 'arms' ? armPixels(speciesId) : `<g class="prop prop-${id}">${propPixels(id, trick.tier)}</g>`)).join('');
  const twinkle = trick && trick.tier >= 2 ? `<g class="prop prop-twinkle">${propPixels('twinkle', trick.tier)}</g>` : '';

  let bg = '';
  if (showBg) {
    const px = new Pixels();
    (BACKGROUNDS[o.background] || BACKGROUNDS['bg-meadow'])(px);
    bg = px.svg();
  }

  const sp = speciesGrid(speciesId, mood);
  const body = new Pixels();
  body.grid(SPRITE_X, SPRITE_Y - sp.lift, sp.grid, sp.pal, sp.shade);

  const shadow = `<rect class="shadow" x="7" y="23" width="10" height="1" fill="#000" opacity="0.18"/>`;
  // a buddy special only shows on its own kind of buddy
  const worn = (id) => (fitsSpecies(itemById(id), speciesId) ? id : undefined);
  const hat = worn(o.hat);
  const face = worn(o.face);
  let neck = worn(o.neck);
  // the bamboo leans on the side away from the held gear: only the fishing rod is held on the right
  if (neck === 'neck-bamboo' && (gear?.kind === 'rod' || gearOf(o.sport)?.kind === 'rod')) neck = 'neck-bamboo-left';
  const neckBehind = ITEM_ART[neck]?.[4];
  const capeBehind = neckBehind ? itemLayer(neck) : '';
  const neckFront = !neckBehind ? itemLayer(neck)
    : neck === 'neck-cape' ? '<rect x="10" y="18" width="4" height="1" fill="#fcc419"/>' : '';

  // a piano and sports don't mix: the piano steps aside while the buddy holds gear or shows off
  const music = trick || gearOf(o.sport) ? undefined : o.music;
  const behindProps = art?.props?.includes('bigfish') ? props : '';
  const frontProps = behindProps ? '' : props;
  return `<svg class="buddy-svg pixel${trick ? ` trick trick-${trick.move} tier-${trick.tier || 0}` : ''}" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="${speciesId} buddy, ${trick ? trick.move : mood}">
    ${showBg ? `<g class="bg">${bg}</g>` : ''}
    ${showBg ? shadow : ''}
    ${behindProps}
    <g class="char">
      ${musicLayer(music, 'behind')}
      ${capeBehind}
      ${body.svg()}
      ${neckFront}
      ${itemLayer(face)}
      ${itemLayer(hat)}
      ${inChar ? gearSvg : ''}
      ${musicLayer(music, 'front')}
      ${musicLayer(music, 'flames')}
    </g>
    ${inChar ? '' : gearSvg}
    ${frontProps}
    ${twinkle}
    <g class="fx ${mood === 'sleepy' ? 'zzz' : 'sparkles'}">${extras(mood)}</g>
  </svg>`;
}

// ---------- for the live (animated) buddy in rig.js ----------

/** A Pixels layer as a 24 x 24 grid of colors (null where empty). */
const toCells = (px) => Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => px.cells.get(`${x},${y}`) || null));

/** An outfit item's art: its top-left corner, its colors, and whether it is drawn behind the buddy. */
export function itemArt(id) {
  const art = ITEM_ART[id];
  if (!art) return null;
  const [x, y, rows, pal, behind] = art;
  const px = new Pixels();
  px.grid(x, y, rows, pal);
  const cells = toCells(px);
  return { x: 0, y: 0, c: cells, behind: Boolean(behind) };
}

/** A background's colors. */
export function backgroundCells(id) {
  const px = new Pixels();
  (BACKGROUNDS[id] || BACKGROUNDS['bg-meadow'])(px);
  return toCells(px);
}

/**
 * What a live buddy wears and holds, by the same rules as buddySvg: specials only
 * on their own kind of buddy, a piano or sports gear (not both), the bamboo on the
 * side away from a fishing rod.
 */
export function liveLook(buddy) {
  const species = SPECIES[buddy?.species] ? buddy.species : 'bear';
  const o = buddy?.outfit || {};
  const worn = (id) => (fitsSpecies(itemById(id), species) ? id : undefined);
  const gear = gearOf(o.sport);
  let neck = worn(o.neck);
  if (neck === 'neck-bamboo' && gear?.kind === 'rod') neck = 'neck-bamboo-left';
  const music = gear ? undefined : o.music;
  return {
    species,
    background: o.background || 'bg-meadow',
    hat: worn(o.hat),
    face: worn(o.face),
    neck,
    music: music && MUSIC_ART[music] ? {
      behind: toCells(musicPx(music, 'behind')),
      front: toCells(musicPx(music, 'front')),
      flames: (MUSIC_ART[music].flames || []).map((_, i) => toCells(musicPx(music, i))),
    } : null,
    gear: gear && GEAR_ART[gear.kind] ? { kind: gear.kind, held: ['shoes', 'rod', 'hockey'].includes(gear.kind), c: toCells(gearPx(gear.kind, gear.tier)) } : null,
  };
}

export { speciesGrid, OUT, SIZE, SPRITE_X, SPRITE_Y };

/** What the buddy says, by mood. */
export function buddyLine(mood, name) {
  const lines = {
    happy: [`Keep going, ${name}!`, "We're doing great!", 'What should we do next?'],
    excited: ['WOOHOO!', 'Yes! You did it!', 'High five! ✋'],
    proud: ['Quest complete! I’m so proud of you!', 'Best day ever!', 'We did it! See you tomorrow!'],
    sleepy: ['Yawn... is it quest time?', "I'm bored... let's do a task!", 'Wake me up with a task!'],
    sad: ['I missed you yesterday...', "Let's get our streak going again!", "Today's a new day. Let's go!"],
  };
  const list = lines[mood] || lines.happy;
  // stable per day so it doesn't change on every redraw
  const i = (new Date().getDate() + name.length) % list.length;
  return list[i];
}
