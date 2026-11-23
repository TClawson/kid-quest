// Pictures for the printed chore charts (the plan's pages, see charts.js): the buddy doing
// each little-kid chore in its own house, the happy ending, and pixel icons. Ported from the
// robot-buddy chart generator (project files: robot-buddy/chore-charts/source/chart.html), now
// drawn for the kid's own buddy. Needs a DOM (canvas); every picture is a PNG data URL.

import { buildRig, render } from './rig.js';
import { paintRoom } from './houseart.js';
import { homeLayout } from './furniture.js';
import { itemArt } from './avatar.js';

const made = new Map();

/** All the chart pictures for a buddy ({ species, outfit }), made once per look. */
export function chartArt(buddy) {
  const species = buddy?.species || 'fox';
  const hat = buddy?.outfit?.hat || 'hat-cap';
  const neck = buddy?.outfit?.neck || 'neck-scarf';
  const key = `${species}|${hat}|${neck}`;
  if (!made.has(key)) {
    if (made.size > 6) made.clear();
    made.set(key, draw(species, hat, neck));
  }
  return made.get(key);
}

function draw(species, hat, neck) {
  const INK = '#3b2235';
  // ---------- pixel helpers ----------
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  function up(c, k) {
    const o = mk(c.width * k, c.height * k); const x = o.getContext('2d');
    x.imageSmoothingEnabled = false; x.drawImage(c, 0, 0, o.width, o.height);
    return o.toDataURL('image/png');
  }
  const px = (ctx, x, y, col) => { ctx.fillStyle = col; ctx.fillRect(x, y, 1, 1); };
  function glyph(ctx, x, y, rows, pal) {
    rows.forEach((r, j) => [...r].forEach((ch, i) => { if (ch !== '.' && pal[ch]) px(ctx, x + i, y + j, pal[ch]); }));
  }
  /** A letter grid as its own picture, with a dark outline all round. */
  function icon(rows, pal, k = 16) {
    const w = rows[0].length + 2; const h = rows.length + 2;
    const c = mk(w, h); const ctx = c.getContext('2d');
    const at = (i, j) => { const ch = (rows[j] || '')[i]; return ch && ch !== '.' ? ch : null; };
    for (let j = -1; j <= rows.length; j += 1) for (let i = -1; i <= rows[0].length; i += 1) {
      if (at(i, j)) px(ctx, i + 1, j + 1, pal[at(i, j)]);
      else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) px(ctx, i + 1, j + 1, INK);
    }
    return up(c, k);
  }
  const SPARK = [['.Y.', 'YWY', '.Y.'], { Y: '#ffd43b', W: '#fff9db' }];
  const BIGSPARK = [['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'], { Y: '#ffd43b', W: '#ffffff' }];

  // ---------- the buddy ----------
  const base = () => ({
    root: { dx: 0, dy: 0 }, body: { stretch: 0, widen: 0 }, head: { dx: 0, dy: 0, rot: 0 },
    earL: { dy: 0, rot: 0 }, earR: { dy: 0, rot: 0 }, armL: { rot: 0 }, armR: { rot: 0 },
    footL: { dy: 0 }, footR: { dy: 0 }, tail: { rot: 0 },
    face: { eye: 'open', mouth: 'happy', lookX: 0, lookY: 0, brow: 0, browUp: false, blush: false, tear: 0 }, fx: [],
  });
  const pose = (o) => { const p = base(); for (const [k, v] of Object.entries(o)) p[k] = Array.isArray(v) ? v : { ...p[k], ...v }; return p; };
  const rigOf = (outfit, bg) => buildRig({ species, outfit }, { background: bg });
  function drawBuddy(ctx, rig, p, x, y) {
    const buf = render(rig, p, 0);
    for (let j = 0; j < 24; j += 1) for (let i = 0; i < 24; i += 1) { const c = buf[j * 24 + i]; if (c) px(ctx, x + i, y + j, c); }
  }
  function drawCells(ctx, cells, x, y) {
    cells.forEach((row, j) => row.forEach((c, i) => { if (c) px(ctx, x + i, y + j, c); }));
  }
  function floorShadow(ctx, x, y) {
    ctx.fillStyle = 'rgba(40,20,30,0.22)';
    ctx.fillRect(x + 7, y + 23, 10, 1); ctx.fillRect(x + 8, y + 24, 8, 1);
  }

  // ---------- the room scenes ----------
  function room(o) {
    const c = mk(1, 1);
    paintRoom(c, { layout: homeLayout({}), made: true, teeth: true, mess: 0, shelf: 1, color: '#e03131', ...o });
    return c;
  }
  function scene(roomCanvas, crop, draw, k = 12) {
    const c = mk(crop.w, crop.h); const ctx = c.getContext('2d');
    ctx.drawImage(roomCanvas, -crop.x, -crop.y);
    ctx.translate(-crop.x, -crop.y);
    draw(ctx);
    return up(c, k);
  }
  const bare = rigOf({}, false);
  const scarfed = rigOf({ neck }, false);
  const dressed = rigOf({ hat, neck }, false);

  // 1. the bed is made: the buddy stands beside it, cheering
  const bedPic = scene(room({ made: true }), { x: 8, y: 32, w: 50, h: 70 }, (ctx) => {
    floorShadow(ctx, 36, 75);
    drawBuddy(ctx, bare, pose({ armL: { rot: 150 }, armR: { rot: -150 }, face: { eye: 'happy', mouth: 'excited', blush: true }, root: { dy: -1 }, tail: { rot: -20 } }), 36, 75);
    glyph(ctx, 15, 60, ...BIGSPARK); glyph(ctx, 30, 52, ...SPARK); glyph(ctx, 32, 70, ...SPARK); glyph(ctx, 14, 82, ...SPARK); glyph(ctx, 26, 42, ...SPARK);
  });

  // 2. getting dressed: the scarf is on and the hat is going on
  const dressPic = scene(room({}), { x: 46, y: 9, w: 50, h: 70 }, (ctx) => {
    floorShadow(ctx, 59, 50);
    drawBuddy(ctx, scarfed, pose({ armL: { rot: 150 }, armR: { rot: -150 }, face: { eye: 'open', mouth: 'excited', lookY: -1 } }), 59, 50);
    const h = itemArt(hat);
    if (h) drawCells(ctx, h.c, 59, 50 - 9);
    glyph(ctx, 66, 55, ['K', '.', 'K'], { K: '#fff9db' }); glyph(ctx, 75, 55, ['K', '.', 'K'], { K: '#fff9db' });
    glyph(ctx, 54, 48, ...SPARK); glyph(ctx, 86, 46, ...SPARK); glyph(ctx, 82, 60, ...SPARK);
  });

  // 3. brushing teeth at the sink
  const teethPic = scene(room({ teeth: true }), { x: 246, y: 9, w: 50, h: 70 }, (ctx) => {
    const bx = 252; const by = 51;
    floorShadow(ctx, bx, by);
    drawBuddy(ctx, dressed, pose({ armR: { rot: -135 }, face: { eye: 'happy', mouth: 'excited' } }), bx, by);
    // the toothbrush at the mouth, with foam and bubbles
    glyph(ctx, bx + 13, by + 12, ['.WW.......', 'WWWKKKKKKK', 'WWWTTTTTTK', '.W.KKKKKKK'], { W: '#ffffff', T: '#2fc4a2', K: '#3b2235' });
    glyph(ctx, bx + 23, by + 4, ['.BB.', 'BWWB', 'BWWB', '.BB.'], { B: '#6ec8f4', W: '#e4f6ff' });
    glyph(ctx, bx + 27, by + 11, ['BB', 'BB'], { B: '#6ec8f4' });
    glyph(ctx, bx + 20, by, ['.B.', 'BWB', '.B.'], { B: '#6ec8f4', W: '#e4f6ff' });
    glyph(ctx, bx - 3, by + 6, ...SPARK);
  });

  // 3b. brushing teeth at night: the same sink, the lights low
  const teethNightPic = scene(room({ teeth: true }), { x: 246, y: 9, w: 50, h: 70 }, (ctx) => {
    // the lights are low at bedtime; a little moon shines in
    ctx.fillStyle = 'rgba(28, 24, 80, 0.4)'; ctx.fillRect(246, 9, 50, 70);
    glyph(ctx, 286, 14, ['.YY', 'YY.', 'YY.', '.YY'], { Y: '#ffe27a' });
    const bx = 252; const by = 51;
    floorShadow(ctx, bx, by);
    drawBuddy(ctx, dressed, pose({ armR: { rot: -135 }, face: { eye: 'happy', mouth: 'excited' } }), bx, by);
    // the toothbrush at the mouth, with foam and bubbles
    glyph(ctx, bx + 13, by + 12, ['.WW.......', 'WWWKKKKKKK', 'WWWTTTTTTK', '.W.KKKKKKK'], { W: '#ffffff', T: '#2fc4a2', K: '#3b2235' });
    glyph(ctx, bx + 23, by + 4, ['.BB.', 'BWWB', 'BWWB', '.BB.'], { B: '#6ec8f4', W: '#e4f6ff' });
    glyph(ctx, bx + 27, by + 11, ['BB', 'BB'], { B: '#6ec8f4' });
    glyph(ctx, bx + 20, by, ['.B.', 'BWB', '.B.'], { B: '#6ec8f4', W: '#e4f6ff' });
    glyph(ctx, bx - 3, by + 6, ...SPARK);
  });

  // the happy ending: the buddy's own picture, cheering
  const finRig = rigOf({ hat, neck, background: 'bg-meadow' }, true);
  const finC = mk(24, 24);
  drawBuddy(finC.getContext('2d'), finRig, pose({ armL: { rot: 150 }, armR: { rot: -150 }, root: { dy: -2 }, face: { eye: 'happy', mouth: 'excited', blush: true }, tail: { rot: -30 }, fx: [{ kind: 'sparkle', x: 2, y: 4 }, { kind: 'sparkle', x: 19, y: 3 }, { kind: 'heart', x: 18, y: 12 }, { kind: 'sparkle', x: 2, y: 14 }] }), 0, 0);
  const finPic = up(finC, 30);

  // waking up, for the title
  const sleepC = mk(24, 24);
  drawBuddy(sleepC.getContext('2d'), bare, pose({ armL: { rot: 150 }, armR: { rot: -135 }, head: { dy: 0, rot: 0 }, face: { eye: 'sleep', mouth: 'o' }, fx: [{ kind: 'z', x: 18, y: 6 }, { kind: 'Z', x: 20, y: 1 }] }), 0, 0);
  const sleepPic = up(sleepC, 16);
  // the buddy's happy face, for the tokens
  const faceC = mk(18, 14);
  { const t = mk(24, 24); drawBuddy(t.getContext('2d'), bare, pose({ face: { eye: 'happy', mouth: 'excited', blush: true } }), 0, 0); faceC.getContext('2d').drawImage(t, -3, -4); }
  const facePic = up(faceC, 16);

  // ---------- the tidy-up scenes ----------
  /** A letter grid drawn into a scene with a dark outline all round, like the room's own things. */
  function thing(ctx, x, y, rows, pal) {
    const at = (i, j) => { const ch = (rows[j] || '')[i]; return ch && ch !== '.' ? ch : null; };
    for (let j = -1; j <= rows.length; j += 1) for (let i = -1; i <= rows[0].length; i += 1) {
      if (at(i, j)) px(ctx, x + i, y + j, pal[at(i, j)]);
      else if (at(i - 1, j) || at(i + 1, j) || at(i, j - 1) || at(i, j + 1)) px(ctx, x + i, y + j, INK);
    }
  }
  const groundShadow = (ctx, x, y, w) => { ctx.fillStyle = 'rgba(40,20,30,0.22)'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x + 1, y + 1, w - 2, 1); };
  const SHIRT = [['.yy.yy.', 'yyYYYyy', 'yYYYYYy', '.yYYYy.', '.yyyyy.', '.yyyyy.'], { y: '#e8823a', Y: '#ffb070' }];
  const SOCK = [['.ww.', '.wr.', '.ww.', 'wwww', 'rww.'], { w: '#fffaf0', r: '#e0546a' }];
  const BASKET = [[
    '....pppp....bbb...',
    '...pPPppp..bbBbb..',
    'LLLLLLLLLLLLLLLLLL',
    'tTTTTTTTTTTTTTTTTt',
    '.TtTTtTTtTTtTTtTT.',
    '.TTTTTTTTTTTTTTTT.',
    '.TtTTtTTtTTtTTtTT.',
    '.TTTTTTTTTTTTTTTT.',
    '..TtTTtTTtTTtTTT..',
    '..TTTTTTTTTTTTTT..',
    '..TtTTtTTtTTtTTT..',
    '..TTTTTTTTTTTTTT..',
    '..dddddddddddddd..',
  ], { T: '#e2b06a', L: '#f3cf94', t: '#a8663e', d: '#7a4436', p: '#7a4ab0', P: '#a07ee0', b: '#6ea0f0', B: '#c0dcff' }];
  const BIN = [[
    '..tt..t.....pppp....',
    '..tttttt...pPPppp...',
    '..tektt.gg.ppppp....',
    'LLLLLLLLLLLLLLLLLLLL',
    'BBBBBBBBBBBBBBBBBBBB',
    'BBBBBBBBBYBBBBBBBBBB',
    'BBBBBBYYYYYYYBBBBBBB',
    'BBBBBBBYYYYYBBBBBBBB',
    'BBBBBBBYYBYYBBBBBBBB',
    'BBBBBBBBBBBBBBBBBBBB',
    'bbbbbbbbbbbbbbbbbbbb',
  ], { B: '#4d9bf0', L: '#9cc8ff', b: '#2f6cc4', Y: '#ffd43b', t: '#c08a5a', e: '#3b2235', k: '#7a4436', p: '#e0709a', P: '#ffd0e0', g: '#4a9a50' }];
  const BLOCK = [['rrrr', 'rRRr', 'rRRr', 'rrrr'], { r: '#d8443a', R: '#ff8a7a' }];
  const BLOCK2 = [['yyyy', 'yYYy', 'yYYy', 'yyyy'], { y: '#e8b83a', Y: '#ffe27a' }];
  const CAR = [['.rrrr..', 'rRwwRr.', 'rrrrrrr', '.k...k.'], { r: '#3fa860', R: '#9ed46a', w: '#c0dcff', k: '#343a40' }];
  const BOOK = [['rrrrr', 'rRRRr', 'ryyyr', 'rRRRr', 'rrrrr', 'wwwww'], { r: '#a8304a', R: '#e0546a', y: '#ffd23f', w: '#fffaf0' }];
  const BOOK2 = [['bbbbb', 'bBBBb', 'bBBBb', 'bbbbb', 'wwwww'], { b: '#3e6ab0', B: '#6ea0f0', w: '#fffaf0' }];
  const WHOOSH = { K: '#fff9db' };

  // 1. clothes: the shirt goes in the basket, a sock is on its way
  const clothesPic = scene(room({}), { x: 150, y: 14, w: 50, h: 70 }, (ctx) => {
    const bx = 151; const by = 52;
    groundShadow(ctx, 179, 75, 20);
    thing(ctx, 180, 62, ...BASKET);
    floorShadow(ctx, bx, by);
    drawBuddy(ctx, dressed, pose({ armL: { rot: 20 }, armR: { rot: -150 }, face: { eye: 'happy', mouth: 'excited', lookX: 1 } }), bx, by);
    thing(ctx, bx + 17, by - 1, ...SHIRT);
    thing(ctx, 186, 49, ...SOCK);
    glyph(ctx, 183, 44, ['K.', '.K'], WHOOSH); glyph(ctx, 192, 45, ['.K', 'K.'], WHOOSH);
    glyph(ctx, 156, 44, ...SPARK); glyph(ctx, 194, 36, ...SPARK); glyph(ctx, 172, 30, ...SPARK);
  });

  // 2. toys: blocks, the ball and the teddy go in the toy bin at the foot of the bed
  const toysPic = scene(room({}), { x: 8, y: 86, w: 50, h: 70 }, (ctx) => {
    const bx = 32; const by = 117;
    groundShadow(ctx, 10, 139, 22);
    thing(ctx, 11, 127, ...BIN);
    floorShadow(ctx, bx, by);
    drawBuddy(ctx, dressed, pose({ armL: { rot: 150 }, armR: { rot: -20 }, face: { eye: 'happy', mouth: 'excited', lookX: -1 } }), bx, by);
    thing(ctx, bx + 1, by + 1, ...BLOCK);
    thing(ctx, 21, 115, ...BLOCK2);
    glyph(ctx, 19, 111, ['K.', '.K'], WHOOSH); glyph(ctx, 27, 112, ['.K', 'K.'], WHOOSH);
    thing(ctx, 44, 146, ...CAR);
    glyph(ctx, 40, 148, ['KK', '..', 'KK'], WHOOSH);
    glyph(ctx, 14, 104, ...SPARK); glyph(ctx, 50, 110, ...SPARK); glyph(ctx, 38, 102, ...SPARK);
  });

  // 3. books: back on the shelf, one more in hand
  const booksPic = scene(room({}), { x: 76, y: 11, w: 50, h: 70 }, (ctx) => {
    const bx = 98; const by = 56;
    // spines standing on the shelf's boards
    const spine = (x, y, h, c, d) => { ctx.fillStyle = c; ctx.fillRect(x, y - h, 2, h); ctx.fillStyle = d; ctx.fillRect(x, y - h + 1, 1, 1); ctx.fillRect(x, y - 2, 2, 1); };
    [[87, 48, 7, '#e0546a', '#ffd23f'], [89, 48, 8, '#3e6ab0', '#c0dcff'], [91, 48, 6, '#4a9a50', '#ffe27a'], [104, 48, 8, '#e8823a', '#fff3b0'], [106, 48, 7, '#7a4ab0', '#ffd0e0'], [108, 48, 8, '#3e6ab0', '#c0dcff'], [110, 48, 6, '#e0546a', '#ffd23f'],
      [87, 35, 7, '#4a9a50', '#ffe27a'], [89, 35, 6, '#e8823a', '#fff3b0'], [91, 35, 7, '#7a4ab0', '#ffd0e0']].forEach((s) => spine(...s));
    floorShadow(ctx, bx, by);
    drawBuddy(ctx, dressed, pose({ armL: { rot: 150 }, armR: { rot: -20 }, face: { eye: 'happy', mouth: 'excited', lookX: -1, lookY: -1 } }), bx, by);
    thing(ctx, bx, by, ...BOOK);
    thing(ctx, 113, 69, ...BOOK2);
    glyph(ctx, 96, 50, ['K.', '.K'], WHOOSH);
    glyph(ctx, 81, 60, ...SPARK); glyph(ctx, 120, 52, ...SPARK); glyph(ctx, 80, 40, ...SPARK);
  });

  // the buddy humming, for the tidy-up title
  const humC = mk(24, 24);
  drawBuddy(humC.getContext('2d'), dressed, pose({ armL: { rot: 150 }, armR: { rot: -30 }, face: { eye: 'happy', mouth: 'excited', blush: true }, fx: [{ kind: 'note', x: 19, y: 4 }, { kind: 'note2', x: 1, y: 8 }] }), 0, 0);
  const humPic = up(humC, 16);

  // ---------- icons ----------
  const bedIcon = icon([
    '................',
    'HH..............',
    'HH..............',
    'HH.WWWW.........',
    'HH.WwwWBBBBBBBB.',
    'HHBBBBBBbBBBbBBB',
    'HHBBbBBBBBBBBBBB',
    'HHBBBBBBBBbBBBBB',
    'HHdddddddddddddd',
    'HHHHHHHHHHHHHHHH',
    'hhhhhhhhhhhhhhhh',
    'HH............HH',
    'HH............HH',
  ], { H: '#a8663e', h: '#7a4436', W: '#ffffff', w: '#e8d6cc', B: '#4d9bf0', b: '#ffd43b', d: '#2f6cc4' });
  const shirtIcon = icon([
    '...SSS....SSS...',
    '..SSSSScCSSSSS..',
    '.SSSSSSScSSSSSS.',
    'SSSSSSSSSSSSSSSS',
    'SSSSSSSSSSSSSSSS',
    'sSSSSSSSSSSSSSSs',
    '.ssSSSSSSSSSSss.',
    '...SSSSSSSSSS...',
    '...SSSYYYYSSS...',
    '...SSSYYYYSSS...',
    '...SSSSSSSSSS...',
    '...SSSSSSSSSS...',
    '...ssssssssss...',
  ], { S: '#ff9a4a', s: '#d8661c', c: '#d8661c', C: '#d8661c', Y: '#ffe27a' });
  const brushIcon = icon([
    '..........BB....',
    '.........WWBB...',
    '........WWWWB...',
    '.......WWWWWG...',
    '........WWWGGG..',
    '.........WGGG...',
    '.........GGG....',
    '........GGG.....',
    '.......GGG......',
    '......GGG.......',
    '.....GGG........',
    '....GGG.........',
    '...ggG..........',
    '..ggg...........',
    '..gg............',
  ], { W: '#ffffff', B: '#6ec8f4', G: '#2fc4a2', g: '#1a8f76' });
  const starIcon = icon([
    '.......Y.......',
    '......YYY......',
    '......YLY......',
    '.....YYLYY.....',
    'YYYYYYLLYYYYYYY',
    '.YYLLLLYYYYYYY.',
    '..YYLYYYYYYYY..',
    '...YYYYYYYYD...',
    '...YYYYYYYYD...',
    '..YYYYYYYYYDD..',
    '..YYYYD.DYYYD..',
    '.YYYD.....DYDD.',
    '.YD.........DD.',
  ], { Y: '#ffd43b', L: '#fff3b0', D: '#f0a000' });
  const bowlIcon = icon([
    '......................',
    '..rrrrrrrrrrrrrrrrrr..',
    '.rRRRRRRRRRRRRRRRRRRr.',
    '.rddddddddddddddddddr.',
    '..RRRRRRRRRRRRRRRRRR..',
    '..RRRRRRWRRWRRRRRRRR..',
    '...RRRRRRWWRRRRRRRR...',
    '...RRRRRWWWWRRRRRRR...',
    '....RRRRRRRRRRRRRR....',
    '.....dddddddddddd.....',
  ], { R: '#e8463a', r: '#ff8a7a', d: '#a82a24', W: '#fff3e0' });
  const coinIcon = icon([
    '...YYYYYY...',
    '..YLLLLLLY..',
    '.YLYYYYYYDY.',
    'YLYYYDDYYYDY',
    'YLYYDYYYYYDY',
    'YLYYYDDYYYDY',
    'YLYYYYYDYYDY',
    'YLYYDDDYYYDY',
    '.YLYYYYYYDY.',
    '..YDDDDDDY..',
    '...YYYYYY...',
  ], { Y: '#ffd43b', L: '#fff3b0', D: '#f0a000' });
  const sunIcon = icon([
    '.......Y.......',
    '.Y.....Y.....Y.',
    '..Y.........Y..',
    '.....YYYYY.....',
    '....YLLYYYY....',
    '...YLYYYYYYY...',
    '...YLYYYYYYY...',
    'YY.YYYYYYYYY.YY',
    '...YYYYYYYYY...',
    '...YYYYYYYDY...',
    '....YYYYDDY....',
    '.....YYYYY.....',
    '..Y.........Y..',
    '.Y.....Y.....Y.',
    '.......Y.......',
  ], { Y: '#ffc21a', L: '#fff3b0', D: '#f08a00' });

  const moonIcon = icon([
    '....YYYYY...',
    '..YYYLLY....',
    '.YYLLY......',
    '.YLLY.......',
    'YYLY........',
    'YYLY........',
    'YYLY........',
    'YYYYY.......',
    '.YYYYY....Y.',
    '.YYYYYYYYYY.',
    '..YYYYYYYY..',
    '....YYYYY...',
  ], { Y: '#ffd43b', L: '#fff3b0' });

  const hamperIcon = icon([
    '....OOOO........',
    '...OOOOOO.PPP...',
    '..OOoOOOOPPPPP..',
    'LLLLLLLLLLLLPPLL',
    'tTTTTTTTTTTTPPTt',
    '.TtTTtTTtTTTPPT.',
    '.TTTTTTTTTTTTTT.',
    '.TtTTtTTtTTtTTT.',
    '..TTTTTTTTTTTT..',
    '..TtTTtTTtTTtT..',
    '..TTTTTTTTTTTT..',
    '..dddddddddddd..',
  ], { T: '#e2b06a', L: '#f3cf94', t: '#a8663e', d: '#7a4436', O: '#ff9a4a', o: '#d8661c', P: '#6ec8f4' });
  const blocksIcon = icon([
    '....RRRRRRRr....',
    '....RRRWWRRr....',
    '....RRWRRWRr....',
    '....RRWWWWRr....',
    '....RRWRRWRr....',
    '....RRWRRWRr....',
    '....rrrrrrrr....',
    'BBBBBBBbGGGGGGGg',
    'BBWWWBBbGGGWWWGg',
    'BBWBBWBbGGWGGGGg',
    'BBWWWBBbGGWGGGGg',
    'BBWBBWBbGGWGGGGg',
    'BBWWWBBbGGGWWWGg',
    'bbbbbbbbgggggggg',
  ], { R: '#f0564a', r: '#a82a24', B: '#4d9bf0', b: '#2f6cc4', G: '#3fc46a', g: '#2b8a3e', W: '#ffffff' });
  const booksIcon = icon([
    '..RRRRRRRRRRRR..',
    '..RRRRRRRRYYRR..',
    '..WWWWWWWWWWWr..',
    '..rrrrrrrrrrrr..',
    '.GGGGGGGGGGGGGG.',
    '.GGYYGGGGGGGGGG.',
    '.gWWWWWWWWWWWWW.',
    '.gggggggggggggg.',
    'BBBBBBBBBBBBBB..',
    'BBBBBBBBBYYYBB..',
    'WWWWWWWWWWWWWb..',
    'bbbbbbbbbbbbbb..',
  ], { R: '#f0564a', r: '#a82a24', G: '#3fc46a', g: '#2b8a3e', B: '#4d9bf0', b: '#2f6cc4', W: '#fff9ec', Y: '#ffd43b' });
  const noteIcon = icon([
    '....NNNNNNNNN',
    '....NNNNNNNNN',
    '....NN.....NN',
    '....NN.....NN',
    '....NN.....NN',
    '....NN.....NN',
    '....NN.....NN',
    '.NNNNN..NNNNN',
    'NNNNNN.NNNNNN',
    'NNNNNN.NNNNNN',
    '.NNNN...NNNN.',
  ], { N: '#5a6ad8' });

  return { bedPic, dressPic, teethPic, clothesPic, toysPic, booksPic, finPic, sleepPic, humPic, facePic, bedIcon, shirtIcon, brushIcon, starIcon, bowlIcon, coinIcon, sunIcon, moonIcon, hamperIcon, blocksIcon, booksIcon, noteIcon, teethNightPic };
}
