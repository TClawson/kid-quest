// Draws a kid's buddy as 16-bit style pixel art in an inline SVG (a 24 x 24 pixel scene).
// Every layer (background, species sprite, outfit items) is a small grid of palette letters.
// Animation is done in CSS (see .buddy rules in style.css) using the classes set here.

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
  spikes: [
    '......K..K......',
    '.....KsKKsK.....',
    '....KKssssKK....',
    '..KKOOOOOOOOKK..',
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
  panda: { ears: 'round', tail: false, pal: { O: '#ffffff', W: '#ffffff', o: '#2f2a36', D: '#2f2a36' }, shade: { O: ['#ffffff', '#d4d6e2'], W: ['#ffffff', '#d4d6e2'], D: ['#4a4356', '#1d1924'] } },
  cat: { ears: 'pointed', tail: true, whiskers: true, pal: { O: '#a6b1c6', W: '#f3f5fa', o: '#ffb3c6', T: '#a6b1c6', t: '#a6b1c6' }, shade: { O: ['#c8d0de', '#7d889e'], W: ['#ffffff', '#d5dae6'], T: ['#c8d0de', '#7d889e'] } },
  dino: { ears: 'spikes', tail: true, pal: { O: '#6cc56f', W: '#dcf5c9', s: '#f7b538', T: '#6cc56f', t: '#6cc56f' }, shade: { O: ['#94dc94', '#3f9446'], W: ['#f0ffe4', '#b5dca0'], T: ['#94dc94', '#3f9446'], s: ['#ffd36b', '#d08c12'] } },
};

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
  if (speciesId === 'panda') {
    // black eye patches (eyes become white), black arms and legs
    for (const y of [6, 7]) {
      for (const x of [3, 4, 5, 10, 11, 12]) {
        const c = g[y][x];
        if (c === 'O') g[y][x] = 'D';
        else if (c === 'E' || c === 'K') g[y][x] = 'H';
      }
    }
    for (let y = 12; y < 16; y += 1) for (let x = 0; x < 16; x += 1) if (g[y][x] === 'O') g[y][x] = 'D';
  }
  if (sp.whiskers) {
    g[8][0] = 'K'; g[9][0] = 'K'; g[8][15] = 'K'; g[9][15] = 'K';
  }
  g = g.map((r) => r.join(''));
  return { grid: g, pal: { ...COMMON, ...sp.pal }, shade: sp.shade };
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
};

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

/**
 * buddy: { species, outfit: { background, hat, face, neck } }
 * mood: happy | excited | proud | sleepy | sad
 * opts.background: false to draw the character only (for small chips)
 */
export function buddySvg(buddy, mood = 'happy', opts = {}) {
  const speciesId = SPECIES[buddy?.species] ? buddy.species : 'bear';
  const o = buddy?.outfit || {};
  const showBg = opts.background !== false;

  let bg = '';
  if (showBg) {
    const px = new Pixels();
    (BACKGROUNDS[o.background] || BACKGROUNDS['bg-meadow'])(px);
    bg = px.svg();
  }

  const sp = speciesGrid(speciesId, mood);
  const body = new Pixels();
  body.grid(SPRITE_X, SPRITE_Y, sp.grid, sp.pal, sp.shade);

  const shadow = `<rect class="shadow" x="7" y="23" width="10" height="1" fill="#000" opacity="0.18"/>`;
  const capeBehind = ITEM_ART[o.neck]?.[4] ? itemLayer(o.neck) : '';
  const neckFront = ITEM_ART[o.neck]?.[4] ? '<rect x="10" y="18" width="4" height="1" fill="#fcc419"/>' : itemLayer(o.neck);

  return `<svg class="buddy-svg pixel" viewBox="0 0 ${SIZE} ${SIZE}" xmlns="http://www.w3.org/2000/svg" shape-rendering="crispEdges" role="img" aria-label="${speciesId} buddy, ${mood}">
    ${showBg ? `<g class="bg">${bg}</g>` : ''}
    ${showBg ? shadow : ''}
    <g class="char">
      ${capeBehind}
      ${body.svg()}
      ${neckFront}
      ${itemLayer(o.face)}
      ${itemLayer(o.hat)}
    </g>
    <g class="fx ${mood === 'sleepy' ? 'zzz' : 'sparkles'}">${extras(mood)}</g>
  </svg>`;
}

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
