// The December event's art, in the house's soft storybook style (style B, like houseart.js and
// gardenart.js): warm hue-shifted ramps, ordered dithering, and selective outlines (each thing
// edged in a darker shade of its own color, worked out from its silhouette by houseart.js
// sprite()). One art pixel per room pixel, like the rest of the house.
//
//  ornamentArt(id, frame): one of the 40 tree ornaments (xmas.js ORNAMENTS) or the 10 star
//    toppers (STARS) as a sprite buffer; super-rare ones and stars sparkle (frame 0 / 1).
//  treeArt(o): the little tree in the buddy's room, its ornaments hung on it as tiny versions,
//    with its string of lights in three twinkle frames.
//  giftArt(shape, paper, o): a wrapped present (small, tall, round), a tag, the shake wiggle, and
//    the unwrap frames.
//
// Everything is drawn in code from fixed seeds (no Math.random), so a drawing is the same every
// time.

import { ramp, mix, h2, bayer, Buf, grid, inEll, line, pixelBuffer } from './pixelkit.js';
import { sprite } from './houseart.js';
import { ORNAMENTS, GIFT_PAPERS } from './xmas.js';

const ORN_RARITY = Object.fromEntries(ORNAMENTS.map((o) => [o.id, o.rarity]));

// ---------- palettes (dark .. light) ----------

const GOLD = ['#6a3a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];
const SILV = ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde', '#ffffff'];
const RED = ['#4e1a34', '#7e2440', '#b0343e', '#d8503e', '#f07e58', '#ffb48a'];
const CREAM = ['#8a6a72', '#b8988e', '#dcc4ac', '#f2e2c6', '#fff6e2', '#ffffff'];
const SNOW = ['#5a6088', '#8a94b8', '#b8c4dc', '#dce6f2', '#f4f8fc', '#ffffff'];
const PINE = ['#163032', '#1e4640', '#2a5e48', '#3a7a50', '#55985a', '#7eb868', '#b0d684'];
const BARK = ['#3a2430', '#5a3634', '#7a4c3c', '#9a6648', '#b8845a', '#d4a676'];
const NUT = ['#5a2e28', '#8a4a2e', '#b46e3a', '#d8964a', '#f0bc66', '#fde09a'];
const CUPULE = ['#3a2228', '#583430', '#7a4c38', '#9a6a44', '#b88a58', '#d4aa74'];
const MUSH = ['#4e1a34', '#86243e', '#c0343c', '#e45a44', '#f88a5e', '#ffbc8a'];
const LEAF = ['#1e3a34', '#2a5640', '#3e7648', '#5a9a50', '#86bc5e', '#bcdc7c'];
const SKYN = ['#2a2458', '#3a3a7a', '#4e5a9e', '#6e86c0', '#9cb4dc', '#d0e2f4'];
const CORAL = ['#6a2a48', '#a43e5a', '#d8606a', '#f08a7a', '#ffb49a', '#ffdcc0'];
const ORANGE = ['#5e2228', '#984030', '#d0663a', '#f08e44', '#ffb866', '#ffe09a'];
const TEAL = ['#183a4a', '#205a62', '#2e7e7a', '#46a690', '#76c8a6', '#b4e6c6'];
const PARROT = ['#173a2e', '#1e5a3a', '#2e8044', '#4aa64a', '#86cc5a', '#c4ec84'];
const WOOD = ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'];
const INKY = '#3b2235';

// ---------- little drawing helpers ----------

const P2 = (b, tag) => (x, y, c) => b.set(x, y, c, tag);
/** A letter grid into a buffer (houseart's grid, tagged). */
const stamp = (b, x, y, rows, pal, tag) => grid(P2(b, tag), x, y, rows, pal);

/**
 * A shaded glass ball (or any round blob): lit from the top left and a little in front, with a
 * reflected light along its lower right edge, ordered dithering between the shades and a hard
 * white glint. paint(x, y, k) can pick another ramp for a cell (stripes, bands, spots), given the
 * shade index k it worked out; it returns a color or null for the ball's own ramp.
 */
function ball(b, cx, cy, rx, ry, P, o = {}) {
  const L = P.length - 1;
  const lx = -0.5; const ly = -0.62; const lz = 0.6;
  for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) {
    for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      if (!inEll(x, y, cx, cy, rx, ry)) continue;
      const nx = (x + 0.5 - cx) / rx; const ny = (y + 0.5 - cy) / ry;
      const d2 = nx * nx + ny * ny; const nz = Math.sqrt(Math.max(0, 1 - d2));
      let s = Math.max(0, nx * lx + ny * ly + nz * lz) * 0.82 + 0.1;
      if (d2 > 0.55 && nx + ny > 0.7) s += 0.16; // bounce light on the shaded rim
      s += o.lift || 0;
      let k = Math.round(s * (L - 1) + (bayer(x, y) - 0.5) * (o.dither ?? 0.9));
      k = Math.max(0, Math.min(L - 1, k));
      const glint = o.glint !== false && nx * lx + ny * ly + nz * lz > (o.glintAt ?? 0.95);
      let c = o.paint ? o.paint(x, y, k, nx, ny) : null;
      if (!c) c = P[k];
      if (glint) c = o.glintC || P[L];
      b.set(x, y, c, o.tag);
    }
  }
}

/** The gold cap and hanging loop on top of an ornament: cap 3 (or 5) wide, its middle at cx. */
function cap(b, cx, y, wide = 3, M = GOLD) {
  // the loop, tagged soft so it stays an open ring (no outline fills it)
  b.set(cx - 1, y, M[1], 'soft'); b.set(cx, y - 1, M[2], 'soft'); b.set(cx + 1, y, M[1], 'soft');
  const h = wide >= 5 ? 2 : 2;
  for (let i = 0; i < h; i += 1) {
    for (let x = 0; x < wide; x += 1) {
      const xx = cx - Math.floor(wide / 2) + x;
      const c = i === 0 ? (x === 0 ? M[4] : x === wide - 1 ? M[2] : M[3]) : (x === 0 ? M[3] : x === wide - 1 ? M[1] : (x % 2 ? M[2] : M[3]));
      b.set(xx, y + 1 + i, c);
    }
  }
}

/** A tiny twinkle: a plus with a bright middle (no outline). big: longer arms. */
function twinkle(b, x, y, big = false, c = '#fff6c8', core = '#ffffff') {
  b.set(x, y, core, 'soft');
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(x + dx, y + dy, c, 'soft');
  if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) b.set(x + dx, y + dy, mix(c, '#f0c040', 0.45), 'soft');
}
/** A single-pixel glimmer. */
const dot = (b, x, y, c = '#fff6c8') => b.set(x, y, c, 'soft');

/** Sparkles round a super-rare ornament: two sets that take turns (frame 0, 1). */
function sparkles(b, frame, a, z, c) {
  for (const [x, y, big] of frame % 2 ? z : a) {
    if (big === 2) dot(b, x, y, c);
    else twinkle(b, x, y, big, c);
  }
}

// ---------- more palettes ----------

const PEARL = ['#5e4a7a', '#8e7aaa', '#bcaed0', '#e2d8ec', '#f6f0fa', '#ffffff'];
const SHELLP = ['#5e2a4e', '#8e4a6e', '#bc7290', '#e09aae', '#f6c4cc', '#ffe8e8'];
const PURP = ['#2e1e4a', '#4a2e6e', '#6e46a0', '#9466c4', '#b890e0', '#dcc0f4'];
const SEA = ['#1e4a6a', '#2e6e8e', '#4a9ab0', '#7cc4cc', '#b4e2e2', '#e4f8f4'];
const MOON = ['#3a2e5e', '#5a4a8a', '#8476b4', '#aea4d4', '#d4ccec', '#f4f0ff'];
const WM = ['#3a2a6e', '#5a46a0', '#8a76d0', '#b4a2ec', '#d6c8fa', '#f0eaff']; // caveart.js's moon worm
const BLUE = ['#1e2a5a', '#2a4486', '#3a66b4', '#5a90d8', '#8ab8ee', '#c4e0fa'];
const STONE = ['#3a3040', '#5a4e58', '#7e7070', '#a09488', '#c4b8a4', '#e2d8c4'];
const LAVA = ['#4a1a2a', '#8a2430', '#c8402e', '#f07a2a', '#ffb840', '#fff0a0'];
const PINK = ['#5e1e48', '#9a2e62', '#d0507e', '#f07aa0', '#ffaac4', '#ffd8e4'];
const CAPY = ['#3a2228', '#5e3a2e', '#865a3a', '#a87a4a', '#c89a66', '#e2be8a'];
const FROGB = ['#14224e', '#1e3a86', '#2e5ec4', '#4a8ae8', '#7ab4f8', '#b8dcff'];
const MORPHO = ['#0e1a4a', '#16348a', '#1e5ad0', '#2e8ef0', '#5ac4fc', '#a8ecff'];
const MOOSE = ['#2a1a1e', '#4a2e2a', '#6a4432', '#8a5e40', '#a87c56', '#c49c72'];
const ANTLER = ['#7a5a40', '#a8845e', '#d4b484', '#ecd4a4', '#fbecc8'];
const NIGHT = ['#0e1230', '#18204a', '#24306a', '#34468a', '#4a64a8'];
const INDIGO = ['#140e36', '#221a58', '#342a80', '#4a40a8', '#6a62cc', '#9a94e8'];
const MINT = ['#1e5a5a', '#2e8a7a', '#4ab89a', '#7adcb4', '#b4f0d0', '#e4fff0'];
const IRON = ['#1e1a2a', '#2e2a3e', '#45405a', '#615c78'];
const K = '#2a1838';

/** A seashell's fan: ribs from a hinge at (hx, hy), grooves as crisp lines, a scalloped top edge. */
function fan(b, hx, hy, R, spread, ribs, P, y0) {
  const step = (2 * spread) / ribs;
  for (let y = y0; y < hy; y += 1) for (let x = Math.floor(hx - R - 1); x <= hx + R + 1; x += 1) {
    const dx = x + 0.5 - hx; const dy = y + 0.5 - hy;
    const r = Math.hypot(dx, dy); const a = Math.atan2(dx, -dy);
    if (Math.abs(a) > spread) continue;
    const u = (a + spread) / step; const f = u - Math.floor(u);
    if (r > R - 0.8 + Math.sin(Math.PI * f) * 1.1) continue;
    let groove = false;
    for (let g = 1; g < ribs; g += 1) { const ag = -spread + g * step; if (r > 2.6 && Math.abs(r * Math.sin(a - ag)) < 0.5 && Math.cos(a - ag) > 0) groove = true; }
    const lit = 1 - (a + spread) / (2 * spread); // the left side faces the light
    let k = Math.round(1.8 + lit * 1.9 + (r > R - 2 ? 0.6 : 0) + (bayer(x, y) - 0.5) * 0.5);
    if (groove) k -= 2;
    b.set(x, y, P[Math.max(0, Math.min(P.length - 1, k))]);
  }
}

/** A gold ring (a hoop or a medallion's rim), lit on its top left, with no outline of its own. */
function hoop(b, cx, cy, r, thick, M = GOLD, tag = 'soft') {
  for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
    if (d > r || d < r - thick) continue;
    const lit = -(x + 0.5 - cx) - (y + 0.5 - cy);
    const outer = d > r - thick / 2;
    b.set(x, y, lit > r * 0.5 ? M[outer ? 5 : 4] : lit < -r * 0.5 ? M[outer ? 2 : 1] : M[outer ? 4 : 3], tag);
  }
}

/** The ornaments: [w, h, draw(b, frame), opt]. The loop is at the top (y 0), the cap under it. */
const ORN = {
  // ---------------- Forest Village ----------------
  'orn-acorn': [11, 15, (b) => {
    cap(b, 5, 1);
    for (let y = 4; y < 8; y += 1) for (let x = 0; x < 11; x += 1) {
      const half = y === 4 ? 3.5 : y === 7 ? 5 : 5.5;
      if (Math.abs(x + 0.5 - 5.5) > half) continue;
      const scale = (x + y) % 2 === 0;
      const k = y === 4 ? 4 : y === 7 ? 1 : x < 3 ? 4 : x > 7 ? 2 : 3;
      b.set(x, y, scale ? CUPULE[Math.min(5, k + 1)] : CUPULE[Math.max(0, k - 1)]);
    }
    ball(b, 5.5, 10, 4.5, 4.6, NUT, { lift: 0.1, dither: 0.6 });
    b.set(5, 15, NUT[2]);
    stamp(b, 7, 3, ['.LL', 'Lll', '.r.'], { L: LEAF[4], l: LEAF[2], r: RED[3] });
  }],

  'orn-toadstool': [13, 16, (b) => {
    cap(b, 6, 1);
    for (let y = 4; y < 10; y += 1) for (let x = 0; x < 13; x += 1) {
      if (!inEll(x, y, 6.5, 9.6, 6.5, 5.8) || y > 8) continue;
      const nx = (x + 0.5 - 6.5) / 6.5; const ny = (y + 0.5 - 9.6) / 5.8;
      const k = Math.max(1, Math.min(5, Math.round(2.4 - nx * 1.6 - (ny + 0.5) * 1.6 + (bayer(x, y) - 0.5))));
      b.set(x, y, MUSH[k]);
    }
    for (let x = 1; x < 12; x += 1) b.set(x, 9, x % 3 === 0 ? MUSH[1] : MUSH[2]);
    stamp(b, 2, 5, ['ww......', 'w...ww..', '....ww.w', '.w......'], { w: CREAM[4] });
    b.set(9, 5, CREAM[3]); b.set(10, 6, CREAM[3]);
    for (let y = 10; y < 16; y += 1) for (let x = 3; x < 10; x += 1) {
      if (y === 15 && (x === 3 || x === 9)) continue;
      b.set(x, y, x < 5 ? CREAM[4] : x > 7 ? CREAM[2] : CREAM[3]);
    }
    for (let x = 3; x < 10; x += 1) b.set(x, 10, CREAM[1]);
    stamp(b, 5, 12, ['.dd.', 'dDDd', 'dDgd', 'dDDd'], { d: WOOD[1], D: WOOD[2], g: GOLD[4] });
    b.set(8, 11, '#ffd878');
  }],

  'orn-oak': [15, 18, (b) => {
    // a gold medallion with the Great Oak inside on its hill at dusk, tied on with a red bow
    const cx = 7.5; const cy = 10.5;
    for (let y = 3; y < 18; y += 1) for (let x = 0; x < 15; x += 1) {
      if (!inEll(x, y, cx, cy, 6.3, 6.3)) continue;
      const t = (y - 4) / 12;
      let c = t < 0.3 ? '#f4c8b0' : t < 0.55 ? '#fbe0b8' : '#fff0c8';
      if (t >= 0.25 && t < 0.35 && bayer(x, y) < 0.5) c = '#fbe0b8';
      if (t >= 0.5 && t < 0.6 && bayer(x, y) < 0.5) c = '#fff0c8';
      const hill = 14 - Math.round(Math.cos((x - 7.5) / 3.2) * 1.2);
      if (y >= hill) c = y === hill ? LEAF[4] : bayer(x, y) < 0.3 ? LEAF[2] : LEAF[3];
      b.set(x, y, c);
    }
    // the oak: a stout trunk with roots and a big round crown, gold acorns in it
    stamp(b, 5, 10, ['.bBb.', '.bBb.', '.bBbb', 'bbBbb', 'b.Bbb.b'], { b: BARK[2], B: BARK[4] });
    b.set(7, 11, '#2a1838');
    ball(b, 7.5, 7.6, 5.2, 3.4, LEAF, { lift: 0.08, glint: false });
    ball(b, 5, 6.4, 2.4, 1.8, LEAF, { lift: 0.18, glint: false });
    ball(b, 9.6, 6.2, 2.3, 1.7, LEAF, { lift: 0.14, glint: false });
    b.set(4, 8, GOLD[4]); b.set(10, 8, GOLD[4]); b.set(7, 6, GOLD[4]);
    hoop(b, cx, cy, 7.5, 1.6, GOLD, 'rim');
    // the bow on top
    stamp(b, 3, 0, ['rr...rr', 'rRr.rRr', '.rrkrr.', '..r.r..'], { r: RED[3], R: RED[5], k: RED[2] });
  }],

  'orn-owl': [13, 19, (b) => {
    // a little brass lantern, warm light inside, the Great Oak's snowy owl peeking out
    b.set(5, 0, GOLD[2], 'soft'); b.set(6, 0, GOLD[2], 'soft'); b.set(7, 0, GOLD[2], 'soft');
    b.set(4, 1, GOLD[1], 'soft'); b.set(8, 1, GOLD[1], 'soft');
    stamp(b, 3, 2, ['..yYy..', '.yYYYy.', 'yyYYYyy', 'ddddddd'], { y: GOLD[3], Y: GOLD[4], d: GOLD[1] });
    for (let y = 6; y < 15; y += 1) for (let x = 2; x < 11; x += 1) {
      if (x === 2 || x === 10) { b.set(x, y, x === 2 ? GOLD[4] : GOLD[2]); continue; }
      const d = Math.hypot(x - 6, (y - 9) * 0.9);
      b.set(x, y, d < 1.6 ? '#fff4c8' : d < 3 ? '#ffe08a' : d < 4.4 ? (bayer(x, y) < 0.5 ? '#ffc060' : '#ffe08a') : '#f0a848');
    }
    stamp(b, 3, 8, [
      '.wwwww.',
      'wwWwWww',
      'wyKwyKw',
      'wwwowww',
      'WwvwvwW',
      'WwwvwwW',
      '.WwwwW.',
    ], { w: SNOW[5], W: SNOW[3], y: '#ffd23f', K, o: '#e8823a', v: SNOW[2] });
    stamp(b, 1, 15, ['yyyyyyyyyyy', '.ddddddddd.', '..YYYYYYY..'], { y: GOLD[3], d: GOLD[1], Y: GOLD[4] });
  }, { glow: [6.5, 10, 8], sparkle: [[[0, 5, 1], [12, 12, 0], [1, 17, 2]], [[12, 4, 0], [0, 11, 1], [11, 18, 2]]] }],

  // ---------------- Sunset Beach ----------------
  'orn-shell': [15, 14, (b) => {
    cap(b, 7, 1);
    // a scallop: ribs fanning out from the hinge, grooves as crisp lines, notches along the top
    for (let y = 3; y < 12; y += 1) for (let x = 0; x < 15; x += 1) {
      if (!inEll(x, y, 7.5, 11.6, 7.6, 8.8)) continue;
      const k = (x < 4 ? 4 : x < 10 ? 3 : 2) + (y < 5 ? 1 : 0) - (y > 9 ? 1 : 0);
      b.set(x, y, CORAL[Math.min(5, k)]);
    }
    const grooves = [[2, 4, 5, 10], [5, 3, 6, 10], [7, 3, 7, 10], [9, 3, 8, 10], [12, 4, 9, 10]];
    for (const [x0, y0, x1, y1] of grooves) {
      line(x0, y0, x1, y1, (x, y) => { const c = b.get(x, y); if (c) b.set(x, y, CORAL[Math.max(0, CORAL.indexOf(c) - 1)]); });
      b.del(x0, y0 - 1); // a notch in the rim where the groove meets it
    }
    stamp(b, 3, 10, ['pp.....pp', 'pPppppppp', '.ppPPPpp.'], { p: CORAL[2], P: CORAL[3] });
    b.set(3, 5, '#ffffff'); b.set(3, 6, CORAL[5]);
  }],
  'orn-crab': [15, 14, (b) => {
    b.set(6, 0, GOLD[2], 'soft'); b.set(7, 0, GOLD[3], 'soft'); b.set(8, 0, GOLD[2], 'soft');
    b.set(7, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      '.OO.........OO.',
      'OoOO.......OOoO',
      'Oo.O.......O.oO',
      '.oo..w...w..oo.',
      '..o..K...K..o..',
      '..o..o...o..o..',
      '...ooooooooo...',
      '..oOOOoooooood.',
      '.oOOoKoooKoood.',
      '.oooooKKKooddo.',
      '..ddddddddddd..',
      '.d.d.d...d.d.d.',
    ], { o: ORANGE[3], O: ORANGE[4], d: ORANGE[2], w: '#ffffff', K });
    b.set(5, 9, ORANGE[4]); b.set(3, 10, '#ff9a9a'); b.set(11, 10, '#ff9a9a');
    // a scrap of red ribbon tied round one claw
    b.set(1, 4, RED[3]); b.set(2, 4, RED[4]);
  }],

  'orn-pirate': [15, 18, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      '.......kkkk....',
      '.......kwkk....',
      '.......m.......',
      '....wwwmwww....',
      '...SSSSmSSss...',
      '..SSSSSmSSsss..',
      '..SSSpSmSSsss..',
      '..SSSSSmSSsss..',
      '...SSSSmSSss...',
      '....wwwmwww....',
      'gg.....m.....gg',
      'ghhhhhhhhhhhhhg',
      '.hHoHHHoHHHoHh.',
      '..hhhhhhhhhhh..',
      '...ggggggggg...',
    ], { k: '#2a2438', w: WOOD[3], m: WOOD[1], S: CREAM[4], s: CREAM[2], p: RED[3], g: GOLD[3], h: TEAL[2], H: TEAL[3], o: '#ffd878' });
    b.set(3, 6, CREAM[5]); b.set(3, 7, CREAM[5]); b.set(8, 7, CREAM[3]);
    stamp(b, 0, 17, ['.ww...ww...ww..', 'wWWw.wWWw.wWWw.'], { w: SEA[3], W: SEA[5] });
  }],

  'orn-parrot': [15, 21, (b) => {
    // a gold hoop, and on it the crow's-nest parrot in a captain's hat, its tail hanging below
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    hoop(b, 7.5, 9.5, 7.6, 1.5, GOLD, 'rim');
    stamp(b, 4, 4, [
      '..kkkkk..',
      '.kkkykkk.',
      '..gGGGg..',
      '.gGGwKgOO',
      '.gGGGGgOo',
      '..gGGGgo.',
      '.rgGGGG..',
      'rrdgGGG..',
      'rddgGGg..',
      '.ddgGgg..',
      '..ddggg..',
      '...ff....',
    ], { k: '#2a2438', y: GOLD[4], g: PARROT[3], G: PARROT[4], w: '#ffffff', K, O: '#ffd23f', o: '#d89a2a', d: PARROT[2], r: RED[3], f: '#e8823a' });
    stamp(b, 6, 16, ['rr.', 'rbr', 'rbb', '.bb', '.b.'], { r: RED[3], b: BLUE[3] });
  }, { sparkle: [[[1, 5, 1], [14, 14, 0], [13, 3, 2]], [[14, 6, 1], [0, 13, 0], [2, 2, 2]]] }],

  // ---------------- Under the Sea ----------------
  'orn-pearl': [13, 14, (b) => {
    cap(b, 6, 1);
    fan(b, 6.5, 9, 6.4, 1.25, 6, SHELLP, 3);
    for (let x = 1; x < 12; x += 1) b.set(x, 8, SHELLP[1]);
    for (let y = 8; y < 11; y += 1) for (let x = 2; x < 11; x += 1) b.set(x, y, '#7a3a5e');
    ball(b, 6.5, 9.2, 2.6, 2.4, PEARL, { lift: 0.12 });
    for (let y = 10; y < 14; y += 1) for (let x = 0; x < 13; x += 1) {
      const half = [6.5, 6, 5, 3][y - 10];
      if (Math.abs(x + 0.5 - 6.5) > half) continue;
      const rib = x % 2 === 0;
      b.set(x, y, y === 10 ? SHELLP[4] : rib ? SHELLP[3] : SHELLP[2]);
    }
  }, { glow: [6.5, 9, 5] }],

  'orn-clown': [13, 14, (b) => {
    cap(b, 6, 1);
    const cx = 6.5; const cy = 8.8;
    ball(b, cx, cy, 4.8, 4.8, ORANGE, {
      lift: 0.05,
      paint: (x, y, k, nx) => {
        const band = (Math.abs(nx + 0.38) < 0.17) || (Math.abs(nx - 0.36) < 0.17);
        const edge = (Math.abs(nx + 0.38) < 0.3) || (Math.abs(nx - 0.36) < 0.3);
        if (band) return SNOW[Math.min(5, k + 2)];
        if (edge) return '#3b2235';
        return null;
      },
    });
    stamp(b, 2, 7, ['wK'], { w: '#ffffff', K });
    // fins: one on top, a tail fin on the right, a little one underneath
    stamp(b, 11, 7, ['.oo', 'ooO', '.oo'], { o: ORANGE[3], O: ORANGE[4] });
    stamp(b, 5, 13, ['oOo'], { o: ORANGE[2], O: ORANGE[3] });
  }],

  'orn-octopus': [15, 16, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    ball(b, 7.5, 7.6, 4.8, 4.4, PURP, { lift: 0.08 });
    // the nightcap, stripy, flopping over to the right with its pompom
    stamp(b, 3, 2, [
      '...rcrc....',
      '..crcrcrc..',
      '.rcrcrcrcrw',
      '..........W',
    ], { r: RED[3], c: CREAM[4], w: '#ffffff', W: SNOW[3] });
    stamp(b, 4, 7, ['kk...kk', '.......', 'p.kkk.p'], { k: K, p: '#ff9ac4' });
    // the arms curling out, two of them hugging a pearl
    stamp(b, 0, 11, [
      '..pPp..p.p..pPp',
      '.pp..pp...pp..pp',
      '.p...pWWp.pp...p',
      '.pp..pWwp...p.pp',
      '..p...pp.....p..',
    ], { p: PURP[3], P: PURP[4], W: PEARL[5], w: PEARL[3] });
  }],

  'orn-galleon': [15, 17, (b) => {
    cap(b, 7, 0, 3, SILV);
    const cx = 7.5; const cy = 9.5;
    for (let y = 2; y < 17; y += 1) for (let x = 0; x < 15; x += 1) {
      if (!inEll(x, y, cx, cy, 7.4, 7.4)) continue;
      const t = (y - 3) / 13;
      let c = t < 0.4 ? SEA[4] : t < 0.7 ? SEA[3] : SEA[2];
      if (t > 0.34 && t < 0.46 && bayer(x, y) < 0.5) c = SEA[3];
      if (t > 0.64 && t < 0.76 && bayer(x, y) < 0.5) c = SEA[2];
      if (y >= 14 - Math.round(Math.sin(x / 2.2))) c = y > 14 ? '#d8b878' : '#f0d8a0';
      b.set(x, y, c);
    }
    stamp(b, 3, 5, [
      '...r..r...',
      '..ww..ww..',
      '.wwwmwwwm.',
      '.wwwmwwwm.',
      '..wwmwwwm.',
      '....m...m.',
      'hhhhhhhhhhh',
      '.hhohhohhh.',
      '..hhhhhhh..',
    ], { r: RED[3], w: CREAM[5], m: WOOD[1], h: WOOD[2], o: '#ffd878' });
    // the bubble's glassy rim and shine, and little bubbles going up
    hoop(b, cx, cy, 7.5, 1, ['#2e6e8e', '#4a9ab0', '#7cc4cc', '#b4e2e2', '#e4f8f4', '#ffffff'], 'rim');
    for (const [x, y] of [[3, 5], [4, 4], [5, 3], [3, 6]]) b.set(x, y, '#ffffff');
    b.set(12, 6, '#ffffff'); b.set(11, 4, SEA[5]); b.set(12, 9, SEA[5]);
  }, { sparkle: [[[0, 3, 1], [14, 13, 0], [13, 1, 2]], [[14, 4, 1], [1, 15, 0], [0, 9, 2]]] }],

  // ---------------- Moon Base ----------------
  'orn-moon': [12, 14, (b) => {
    cap(b, 6, 1, 3, SILV);
    ball(b, 6, 9, 5, 5, MOON, { lift: 0.22, dither: 0.5 });
    // craters: a shaded dip with a lit rim on its lower right
    const crater = (x, y, big) => stamp(b, x, y, big ? ['.dd.', 'dmml', '.lll'] : ['dm', 'ml'], { d: MOON[1], m: MOON[2], l: MOON[5] });
    crater(5, 6, true); crater(2, 10, false); crater(7, 11, true); crater(8, 8, false);
  }],
  'orn-rocket': [9, 17, (b) => {
    b.set(4, 0, SILV[3], 'soft'); b.set(3, 1, SILV[2], 'soft'); b.set(5, 1, SILV[2], 'soft');
    stamp(b, 0, 2, [
      '....r....',
      '...rRr...',
      '...rRr...',
      '..wWWww..',
      '..wbBbw..',
      '..wbBbw..',
      '..wwbww..',
      '..rrrrr..',
      '..wWwww..',
      '.rwWwwwr.',
      'rrwWwwwrr',
      'rr.ddd.rr',
      '...oyo...',
      '....o....',
    ], { r: RED[3], R: RED[5], w: SNOW[4], W: SNOW[5], b: BLUE[3], B: BLUE[5], d: SILV[1], o: '#f08e44', y: '#ffe27a' });
    b.set(4, 6, '#ffffff');
  }],

  'orn-saucer': [15, 13, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    stamp(b, 4, 2, [
      '...y...',
      '..cCc..',
      '.cgggc.',
      'cgwKgwc',
      'cgggggc',
    ].map((r) => r.replace('wK', 'Kg')), { y: GOLD[4], c: '#bfeaf0', C: '#ffffff', g: '#7ad860', w: '#ffffff', K });
    b.set(6, 5, K); b.set(9, 5, K); b.set(6, 4, '#ffffff');
    stamp(b, 0, 7, [
      '..sSSSSSSSSSs..',
      '.sSSSSSSSSSSSs.',
      'gRgYgBgRgYgBgRg',
      '.dddddddddddd..',
      '...dddddddd....',
      '.....yyyyy.....',
    ], { s: SILV[3], S: SILV[4], g: GOLD[3], R: '#ff6a6a', Y: '#ffe27a', B: '#6ad0ff', d: SILV[2], y: 'rgba(200,255,160,0.55)' });
  }],

  'orn-moonworm': [15, 15, (b) => {
    b.set(4, 0, GOLD[3], 'soft'); b.set(3, 1, GOLD[2], 'soft'); b.set(5, 1, GOLD[2], 'soft');
    // a gold crescent moon, and curled in its hollow the shy, fluffy moon worm, fast asleep
    for (let y = 1; y < 15; y += 1) for (let x = 0; x < 15; x += 1) {
      const inO = inEll(x, y, 7, 8.2, 6.6, 6.6); const inI = inEll(x, y, 9.6, 7, 5.6, 5.8);
      if (!inO || inI) continue;
      const lit = -(x - 7) - (y - 8);
      b.set(x, y, lit > 3 ? GOLD[5] : lit > -2 ? GOLD[4] : lit > -6 ? GOLD[3] : GOLD[2]);
    }
    const seg = [[6.2, 12, 2.1], [9, 12.4, 2.1], [11.5, 10.6, 2.0], [12, 7.6, 2.3]];
    for (const [x, y, r] of seg) ball(b, x, y, r, r, WM, { lift: 0.16, glint: false, dither: 1 });
    // fluff: little light tufts round the edge
    for (const [x, y] of [[5, 10], [8, 10], [10, 9], [13, 9], [7, 14], [10, 14], [13, 12]]) b.set(x, y, WM[5]);
    stamp(b, 10, 6, ['a...a', '.a.a.'], { a: WM[4] });
    stamp(b, 11, 7, ['d.d', '...', 'p.p'], { d: WM[0], p: '#ff9ac4' });
    stamp(b, 11, 4, ['c..c', '.cc.'], { c: WM[3] }); // antennae
  }, { sparkle: [[[1, 3, 1], [14, 2, 0], [2, 14, 2]], [[13, 1, 1], [0, 9, 0], [14, 14, 2]]] }],

  // ---------------- Castle ----------------
  'orn-shield': [11, 15, (b) => {
    cap(b, 5, 1);
    for (let y = 4; y < 15; y += 1) for (let x = 0; x < 11; x += 1) {
      const half = y < 10 ? 5.5 : 5.5 - (y - 9) * 1.05;
      if (Math.abs(x + 0.5 - 5.5) > half) continue;
      const rim = Math.abs(x + 0.5 - 5.5) > half - 1 || y === 4;
      const left = x < 5 || (x === 5 && y % 2);
      let c = rim ? (x < 5 ? GOLD[4] : GOLD[2]) : left ? (y < 6 ? BLUE[4] : BLUE[3]) : (y < 6 ? RED[4] : RED[3]);
      if (!rim && x === 5) c = GOLD[3];
      if (!rim && !left && bayer(x, y) < 0.2) c = RED[2];
      if (!rim && left && bayer(x, y) < 0.2) c = BLUE[2];
      b.set(x, y, c);
    }
    stamp(b, 3, 7, ['..y..', '.yYy.', 'yYYYy', '.y.y.'], { y: GOLD[3], Y: GOLD[5] });
  }],

  'orn-tower': [11, 18, (b) => {
    b.set(5, 0, GOLD[3], 'soft'); b.set(4, 1, GOLD[2], 'soft'); b.set(6, 1, GOLD[2], 'soft');
    stamp(b, 5, 1, ['ppp', 'm..'], { p: '#ffd23f', m: WOOD[1] });
    stamp(b, 0, 3, [
      '.....m.....',
      '....rRr....',
      '...rRRrr...',
      '...rRrrr...',
      '..rRRrrrr..',
      '..rRrrrrr..',
      '.rRRrrrrrr.',
      '.ddddddddd.',
    ], { m: WOOD[1], r: RED[2], R: RED[4], d: RED[1] });
    for (let y = 11; y < 18; y += 1) for (let x = 2; x < 9; x += 1) {
      const course = y % 2; const joint = (x + course * 2) % 4 === 0;
      b.set(x, y, joint ? STONE[2] : x < 4 ? STONE[5] : x > 6 ? STONE[3] : STONE[4]);
    }
    stamp(b, 4, 12, ['yY', 'yy'], { y: '#ffd878', Y: '#fff4c8' });
    stamp(b, 4, 15, ['dd', 'dd', 'dd'], { d: WOOD[1] });
  }],

  'orn-crown': [15, 13, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    stamp(b, 0, 1, [
      '.w.....w.....w.',
      '.y.....y.....y.',
      '.yy...yYy...yy.',
      '.yYy.yYYYy.yYy.',
      '.yYyyyYrYyyyYy.',
      '.yYYYYYYYYYYYy.',
      '.yYgYYbYbYYrYy.',
      '.yYYYYYYYYYYYy.',
      '.ddddddddddddd.',
      'eeEeeeEeeeEeeee',
      '.eeeeeeeeeeeee.',
    ], { w: PEARL[5], y: GOLD[3], Y: GOLD[4], r: '#e0304a', g: '#40c070', b: '#4a8ae8', d: GOLD[1], e: SNOW[4], E: K });
    for (let y = 4; y < 6; y += 1) for (const x of [4, 10]) b.set(x, y, '#a8304a'); // velvet between the points
    b.set(2, 5, GOLD[5]); b.set(7, 4, GOLD[5]);
  }],

  'orn-dragonegg': [13, 17, (b) => {
    cap(b, 6, 1);
    const EG = TEAL;
    for (let y = 4; y < 17; y += 1) for (let x = 0; x < 13; x += 1) {
      const ry = y < 10.5 ? 6.6 : 6; const rx = 5.4 - Math.max(0, 10 - y) * 0.12;
      if (!inEll(x, y, 6.5, 10.8, rx, ry)) continue;
      const nx = (x + 0.5 - 6.5) / rx; const ny = (y + 0.5 - 10.8) / ry;
      const s = -0.5 * nx - 0.5 * ny + 0.4;
      // scales: staggered rows of little arcs
      const row = Math.floor(y / 2); const sx = (x + (row % 2) * 1.5) % 3;
      let k = Math.round(1.6 + s * 2.2 + (bayer(x, y) - 0.5) * 0.7);
      if (y % 2 === 1 && sx < 1) k -= 1;
      if (y % 2 === 0 && sx >= 1 && sx < 2) k += 1;
      b.set(x, y, EG[Math.max(0, Math.min(5, k))]);
      if (h2(x, y, 41) < 0.06) b.set(x, y, GOLD[4]);
    }
    // a zigzag crack across its middle, light pouring out of it
    const crack = [[1, 11], [2, 10], [3, 10], [4, 11], [5, 12], [6, 11], [7, 10], [8, 10], [9, 11], [10, 12], [11, 11]];
    for (const [x, y] of crack) { b.set(x, y - 1, EG[0]); b.set(x, y, '#fff6c8'); b.set(x, y + 1, '#ffc040'); }
    b.set(6, 12, '#ffe27a'); b.set(3, 11, '#fff6c8'); b.set(8, 11, '#fff6c8');
  }, { glow: [6.5, 11.5, 8], sparkle: [[[0, 6, 1], [12, 14, 0], [12, 3, 2]], [[12, 7, 1], [1, 15, 0], [0, 2, 2]]] }],

  // ---------------- Volcano Island ----------------
  'orn-lava': [9, 15, (b) => {
    cap(b, 4, 1, 3, ['#1a1424', '#2a2238', '#3e3450', '#584c6c', '#7a6e90', '#a49ab8']);
    for (let y = 4; y < 15; y += 1) for (let x = 0; x < 9; x += 1) {
      const round = inEll(x, y, 4.5, 10.6, 4.4, 4.4);
      const point = y < 10.6 && Math.abs(x + 0.5 - 4.5) < (y - 3.6) * 0.62;
      if (!round && !point) continue;
      const d = Math.hypot((x + 0.5 - 4.3) / 4.4, (y + 0.5 - 11) / 4.6);
      const k = Math.round(5 - d * 4.4 + (bayer(x, y) - 0.5) * 0.9);
      b.set(x, y, LAVA[Math.max(1, Math.min(5, k))]);
    }
    b.set(2, 9, '#ffffff'); b.set(2, 10, LAVA[5]); b.set(3, 8, LAVA[5]);
  }, { glow: [4.5, 10.5, 6] }],

  'orn-dragonfruit': [13, 16, (b) => {
    b.set(6, 0, GOLD[3], 'soft'); b.set(5, 1, GOLD[2], 'soft'); b.set(7, 1, GOLD[2], 'soft');
    stamp(b, 3, 2, ['.l.l.l.', 'lLlLlLl', '.lllll.'], { l: LEAF[3], L: LEAF[4] });
    ball(b, 6.5, 10, 5, 5.4, PINK, { lift: 0.1, dither: 0.4 });
    // the scales: pink flaps curling up off the skin, tipped green
    const flap = (x, y, d) => { b.set(x, y, PINK[4]); b.set(x + d, y - 1, PINK[3]); b.set(x + 2 * d, y - 2, LEAF[4]); };
    flap(3, 8, -1); flap(9, 8, 1); flap(5, 11, -1); flap(8, 12, 1); flap(6, 7, 1); flap(3, 13, -1); flap(10, 12, 1);
  }],
  'orn-stoneface': [13, 18, (b) => {
    b.set(6, 0, GOLD[3], 'soft'); b.set(5, 1, GOLD[2], 'soft'); b.set(7, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      '...gGgpgGg...',
      '..gGgGyGgGg..',
      '.ssggggggggs.',
      '.sSSSSSSSSss.',
      'esSSSSSSSSsse',
      'eSSbbSSSbbsse',
      'eSkkSSSSSkkse',
      'eSSSSnnnSSsse',
      'eSSSnNNNnSsse',
      '.SSSSnnnSSss.',
      '.SSSmSSSmSss.',
      '.SSSSmmmSSss.',
      '.sSSSSSSSsss.',
      'pyPwpyPwpyPwp',
      '.ssssssssss..',
    ], { g: LEAF[3], G: LEAF[4], p: '#ff8ac0', y: '#ffd23f', s: STONE[2], S: STONE[3], e: STONE[2], b: STONE[1], k: STONE[0], n: STONE[4], N: STONE[5], m: STONE[1], P: '#ff5a9a', w: '#ffffff' });
    // the stone's lit left side and little cracks
    for (let y = 5; y < 15; y += 1) b.set(2, y, STONE[4]);
    b.set(9, 6, STONE[1]); b.set(10, 7, STONE[1]);
  }],

  'orn-capybara': [15, 16, (b, f) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    // a yuzu on its head, the capybara up to its shoulders in a steaming wooden tub
    stamp(b, 5, 2, ['.l.', 'oOo', 'ooo'], { l: LEAF[4], o: '#f0b030', O: '#ffe27a' });
    stamp(b, 2, 5, [
      '..ee.....ee',
      '.cCCCCCCCcc',
      'cCCCCCCCCccc',
      'cCkCCCCkCccc',
      'cCCCCCCCCcccc',
      'cCCCnnnnnccc.',
      '.cCCnNNNnccc.',
    ], { e: CAPY[2], c: CAPY[2], C: CAPY[4], k: K, n: CAPY[1], N: CAPY[0] });
    b.set(3, 9, '#ff9a9a'); b.set(9, 9, '#ff9a9a');
    for (let x = 0; x < 15; x += 1) { b.set(x, 11, x % 3 ? SEA[4] : SEA[5]); b.set(x, 12, SEA[3]); }
    for (let y = 12; y < 16; y += 1) for (let x = 1; x < 14; x += 1) {
      if (y === 15 && (x === 1 || x === 13)) continue;
      b.set(x, y, y === 12 ? WOOD[4] : (x % 4 === 0 ? WOOD[1] : x < 4 ? WOOD[4] : x > 10 ? WOOD[2] : WOOD[3]));
    }
    for (let x = 1; x < 14; x += 1) b.set(x, 14, GOLD[2]);
    // steam puffs, rising (they move between the frames)
    const st = f % 2 ? [[1, 6], [13, 4], [0, 3]] : [[0, 7], [14, 6], [13, 2]];
    for (const [x, y] of st) { b.set(x, y, 'rgba(255,255,255,0.8)', 'soft'); b.set(x, y - 1, 'rgba(255,255,255,0.5)', 'soft'); }
  }, { sparkle: [[[1, 1, 1], [14, 9, 2]], [[13, 0, 1], [0, 10, 2]]] }],

  // ---------------- Rainforest ----------------
  'orn-kapok': [13, 17, (b) => {
    cap(b, 6, 1, 3, WOOD);
    // a long pod split open down its front, its silky white fluff bulging out, seeds in it
    for (const [x, y, r] of [[6.5, 7.6, 2.8], [6.5, 12, 3], [4, 9.8, 2.6], [9, 9.8, 2.6], [6.5, 9.8, 3]]) ball(b, x, y, r, r, SNOW, { lift: 0.24, glint: false, dither: 1.1 });
    for (let y = 4; y < 17; y += 1) for (let x = 0; x < 13; x += 1) {
      if (!inEll(x, y, 6.5, 10.2, 5.4, 6.6)) continue;
      const left = x < 6.5;
      const open = inEll(x, y, 6.5, 10.2, 3.4 + (y > 6 && y < 14 ? 0.9 : 0), 5.6);
      if (open) continue;
      const nx = (x + 0.5 - 6.5) / 5.4;
      b.set(x, y, left ? (nx < -0.75 ? '#a8b860' : '#7e9a48') : (nx > 0.75 ? '#4e6a36' : '#62803e'));
    }
    for (const [x, y] of [[5, 8], [8, 11], [6, 13], [4, 11], [8, 7]]) b.set(x, y, '#5a3a2a');
    b.set(5, 6, '#ffffff'); b.set(4, 9, '#ffffff');
  }],
  'orn-frog': [13, 14, (b) => {
    cap(b, 6, 1);
    stamp(b, 0, 3, [
      '..bbb...bbb..',
      '.bwwKb.bwwKb.',
      '.bwwKbbbwwKb.',
      'bBbbbBBBbbbBb',
      'bBBkBBBBBkBBb',
      'bBBBBBBBBBBBb',
      'bBmBBBBBBBmBb',
      '.bBmmmmmmmBb.',
      '.bkBBBBBBkBb.',
      'bbb.bbbbb.bbb',
      '.LLLLLLLLLLL.',
    ], { b: FROGB[2], B: FROGB[3], w: '#ffffff', K, k: '#1a1430', m: FROGB[0], L: LEAF[4] });
    b.set(2, 6, FROGB[5]); b.set(3, 7, FROGB[4]); b.set(1, 4, FROGB[4]);
  }],
  'orn-sloth': [17, 19, (b) => {
    // a mossy branch with a flower is the hanger; the sloth dangles from it by its claws
    b.set(8, 0, GOLD[3], 'soft'); b.set(7, 1, GOLD[2], 'soft'); b.set(9, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      '.ll.......pPp...',
      'lLbbbbbbbbbbbbbl',
      '.BBBBBBBBBBBBBB.',
      '....c.....c..ll.',
    ], { l: LEAF[4], L: LEAF[5], b: BARK[4], B: BARK[2], p: '#ff8ac0', P: '#ffd23f', c: CREAM[4] });
    stamp(b, 3, 5, [
      '.ff.....ff.',
      '.ff.....ff.',
      '.fff...fff.',
      '..ffFFFff..',
      '..fFFFFFf..',
      '.fFwwwwwFf.',
      '.fwkkwkkwf.',
      '.fwkwwwkwf.',
      '.fwwwnwwwf.',
      '.fFwmmmwFf.',
      '.ffFFFFFff.',
      '..fFFFFFf..',
      '..ffFFFff..',
      '...ff.ff...',
    ], { f: CAPY[3], F: CAPY[4], w: CREAM[4], k: CAPY[1], n: K, m: CAPY[1] });
    b.set(5, 11, '#ffffff'); b.set(9, 11, '#ffffff');
  }],

  'orn-morpho': [17, 14, (b) => {
    b.set(8, 0, GOLD[3], 'soft'); b.set(7, 1, GOLD[2], 'soft'); b.set(9, 1, GOLD[2], 'soft');
    const wing = (x, y) => {
      const ax = Math.abs(x + 0.5 - 8.5);
      if (ax < 1) return null;
      const up = inEll(ax, y, 4.6, 5.6, 4.4, 3.6); const lo = inEll(ax, y, 3.6, 10.2, 3.1, 2.6);
      if (!up && !lo) return null;
      const edge = up ? !inEll(ax, y, 4.4, 5.6, 3.4, 2.7) : !inEll(ax, y, 3.4, 10, 2.2, 1.8);
      if (edge) return (Math.floor(ax + y) % 3 === 0 && up) ? '#ffffff' : MORPHO[0];
      const t = Math.hypot(ax - 3, y - 6.5) / 5;
      return MORPHO[Math.max(1, Math.min(5, Math.round(5 - t * 3.6 + (bayer(x, y) - 0.5))))];
    };
    for (let y = 1; y < 14; y += 1) for (let x = 0; x < 17; x += 1) { const c = wing(x, y); if (c) b.set(x, y, c); }
    for (let y = 4; y < 13; y += 1) b.set(8, y, y < 6 ? '#3a2a4a' : '#2a2038');
    b.set(7, 2, '#3a2a4a'); b.set(9, 2, '#3a2a4a'); b.set(6, 1, '#3a2a4a'); b.set(10, 1, '#3a2a4a');
  }, { sparkle: [[[1, 1, 1], [16, 12, 0], [15, 2, 2]], [[16, 3, 1], [0, 11, 0], [2, 13, 2]]] }],

  // ---------------- Alaskan Fjord ----------------
  'orn-moose': [17, 15, (b) => {
    b.set(8, 0, GOLD[3], 'soft'); b.set(7, 1, GOLD[2], 'soft'); b.set(9, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      'a.a.a.......a.a.a',
      'aAaAa.......aAaAa',
      '.aAAAa.....aAAAa.',
      '..aaaa.....aaaa..',
      '....aemmmmmea....',
      '....mMMMMMMmm....',
      '....mMkMMMkmm....',
      '....mMMMMMMmm....',
      '....mMMMMMmmm....',
      '.....nNNNNnn.....',
      '.....nkNNknn.....',
      '.....nNNNNnn.....',
      '......mmmmm......',
      '.......mmm.......',
    ], { a: ANTLER[2], A: ANTLER[4], e: MOOSE[2], m: MOOSE[2], M: MOOSE[3], k: K, n: MOOSE[4], N: MOOSE[5] });
    b.set(7, 8, '#ffffff'); b.set(11, 8, '#ffffff');
    // a red knit scarf round its neck
    stamp(b, 5, 13, ['rRrRrRr'], { r: RED[3], R: CREAM[4] });
  }],

  'orn-puffin': [11, 15, (b) => {
    cap(b, 5, 1);
    stamp(b, 0, 4, [
      '...kkkkk...',
      '..kwwwwwk..',
      '.kwwwwwwwk.',
      '.kwKwwwwwk.',
      'ykwwwwwwOok',
      'y.kwwwwOOrr',
      '.kkkwwwOrr.',
      'kkkkWWWwk..',
      'kkkWWWWWk..',
      'kkkWWWWWWk.',
      '.kkWWWWWk..',
      '..kkWWWk...',
      '...oo.oo...',
    ], { k: '#2a2638', w: '#ffffff', W: SNOW[4], K, y: '#ffe27a', O: '#ffb030', o: '#f08e44', r: '#e0402e' });
    b.set(3, 6, SNOW[3]); b.set(2, 9, '#3e3a50');
  }],

  'orn-lighthouse': [11, 19, (b) => {
    b.set(5, 0, GOLD[3], 'soft'); b.set(4, 1, GOLD[2], 'soft'); b.set(6, 1, GOLD[2], 'soft');
    stamp(b, 0, 2, [
      '....sss....',
      '...rRrrr...',
      '..rrrrrrr..',
      '..iiiiiii..',
      '..iYYYyyi..',
      '..iYWYyyi..',
      '.iiiiiiiii.',
      '...wWwww...',
      '...rRrrr...',
      '...rRrrr...',
      '..wwWwwww..',
      '..wwWwwww..',
      '..rrRrrrr..',
      '..rrRrrrr..',
      '.wwwWwwwww.',
      '.ggggggggg.',
      'gGgggGgggGg',
    ], { s: SNOW[4], r: RED[3], R: RED[4], i: IRON[2], Y: '#fff4c8', y: '#ffd878', W: '#ffffff', w: SNOW[3], g: STONE[3], G: STONE[5] });
    b.set(4, 3, SNOW[5]); b.set(3, 16, SNOW[5]); b.set(8, 17, SNOW[5]);
  }, { beams: true }],

  'orn-aurora': [15, 17, (b) => {
    cap(b, 7, 0, 3, SILV);
    const cx = 7.5; const cy = 9.5;
    for (let y = 2; y < 17; y += 1) for (let x = 0; x < 15; x += 1) {
      if (!inEll(x, y, cx, cy, 7.3, 7.3)) continue;
      const t = (y - 2) / 15;
      let c = NIGHT[Math.min(4, 1 + Math.floor(t * 3.6))];
      if (t > 0.25 && t < 0.4 && bayer(x, y) < 0.4) c = NIGHT[2];
      const w1 = 6.6 + Math.sin(x / 2.1) * 1.5 - x * 0.1; const w2 = 9.2 + Math.sin(x / 2.6 + 1.4) * 1.2;
      if (Math.abs(y - w1) < 1.1) c = y < w1 ? '#a8f8c8' : '#4ad090';
      else if (y < w1 && y > w1 - 3 && bayer(x, y) < 0.35) c = '#2e9a6a';
      if (Math.abs(y - w2) < 0.7) c = bayer(x, y) < 0.6 ? '#f4a0d8' : '#d06ab4';
      if (h2(x, y, 7) < 0.07 && y < 6) c = '#fff6c8';
      const hill = 13 - Math.round(Math.sin(x / 3) * 0.8);
      if (y >= hill) c = y === hill ? SNOW[5] : bayer(x, y) < 0.3 ? SNOW[2] : SNOW[3];
      b.set(x, y, c);
    }
    // little spruces on the snowy hill
    for (const [x, y] of [[4, 10], [10, 11], [11, 10]]) stamp(b, x - 1, y, ['.k.', 'kkk', '.k.'], { k: '#1e3a3a' });
    hoop(b, cx, cy, 7.5, 1, ['#2a3060', '#3a4a80', '#6e86c0', '#9cb4dc', '#d0e2f4', '#ffffff'], 'rim');
    for (const [x, y] of [[3, 5], [4, 4], [3, 6]]) b.set(x, y, '#ffffff');
  }, { sparkle: [[[0, 4, 1], [14, 12, 0], [13, 1, 2]], [[14, 4, 1], [0, 14, 0], [1, 1, 2]]] }],

  // ---------------- Rainbow Land ----------------
  'orn-lolly': [11, 17, (b) => {
    cap(b, 5, 1, 3, SILV);
    // a candy swirl: rainbow stripes with white between, curling in to the middle
    const bands = ['#ff6b8a', '#fff6f8', '#ffc03b', '#fff6f8', '#4ab8f0', '#fff6f8'];
    for (let y = 4; y < 14; y += 1) for (let x = 0; x < 11; x += 1) {
      if (!inEll(x, y, 5.5, 8.8, 5.3, 5.1)) continue;
      const dx = x + 0.5 - 5.5; const dy = y + 0.5 - 8.8;
      const t = (Math.atan2(dy, dx) / (2 * Math.PI) + 1) % 1;
      let c = bands[Math.floor(t * 3 * 2 + Math.hypot(dx, dy) * 0.62) % 6];
      if (dx + dy > 4) c = mix(c, '#7a4a8a', 0.22);
      b.set(x, y, c);
    }
    b.set(2, 6, '#ffffff'); b.set(3, 5, '#ffffff');
    for (let y = 14; y < 17; y += 1) { b.set(5, y, SNOW[4]); b.set(6, y, SNOW[2]); }
    stamp(b, 3, 13, ['pP.Pp', '.ppp.'], { p: '#e8509a', P: '#ff9ac8' });
  }],
  'orn-sheep': [15, 13, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    const puffs = [[7.5, 5.6, 3], [4.2, 7, 2.8], [10.8, 6.8, 2.8], [3, 9.6, 2.4], [7.5, 9.2, 3.2], [12, 9.4, 2.4]];
    for (const [x, y, r] of puffs) ball(b, x, y, r, r * 0.9, SNOW, { lift: 0.3, glint: false, dither: 1.1 });
    stamp(b, 4, 6, ['.ffff.', 'ffffff', 'fkffkf', 'pfmmfp', '.ffff.'], { f: '#b8b0cc', k: '#4a4060', m: '#7a7090', p: '#ffb0c8' });
    stamp(b, 3, 7, ['e'], { e: '#9890b0' }); stamp(b, 10, 7, ['e'], { e: '#9890b0' });
    stamp(b, 4, 12, ['k...k.k...k'], { k: '#7a7090' });
  }],

  'orn-goldpot': [15, 17, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    // a little rainbow arching down into a black pot heaped with coins
    const bands = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
    for (let y = 2; y < 10; y += 1) for (let x = 0; x < 15; x += 1) {
      const d = Math.hypot(x + 0.5 - 7.5, (y + 0.5 - 10) * 1.05);
      const i = Math.floor(7.4 - d);
      if (i >= 0 && i < 6 && d > 1.4) b.set(x, y, bands[5 - i]);
    }
    for (let y = 7; y < 11; y += 1) for (let x = 2; x < 13; x += 1) {
      if (!inEll(x, y, 7.5, 10.6, 5.6, 3.8) || y > 10) continue;
      const coin = (x + y * 2) % 3;
      b.set(x, y, coin === 0 ? GOLD[5] : coin === 1 ? GOLD[4] : GOLD[3]);
    }
    for (let y = 10; y < 17; y += 1) for (let x = 1; x < 14; x += 1) {
      if (!inEll(x, y, 7.5, 12.5, 6.4, 4.6)) continue;
      const nx = (x + 0.5 - 7.5) / 6.4;
      b.set(x, y, y === 10 ? IRON[3] : nx < -0.55 ? IRON[3] : nx > 0.4 ? IRON[0] : IRON[1]);
    }
    for (let x = 1; x < 14; x += 1) b.set(x, 10, x % 2 ? IRON[3] : IRON[2]);
    b.set(3, 12, '#9a94b8'); b.set(3, 13, IRON[3]);
    stamp(b, 12, 9, ['yY', 'Yy'], { y: GOLD[3], Y: GOLD[5] });
    stamp(b, 1, 15, ['y'], { y: GOLD[4] });
    b.set(6, 8, '#ffffff');
  }],

  'orn-unicorn': [15, 16, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    // a baby unicorn's face: a gold horn, soft ears, a rainbow forelock and mane, sleepy eyes
    stamp(b, 0, 2, [
      '.......Y.......',
      '.......yY......',
      '......Yyy......',
      '..ee..yYy..ee..',
      '..eEe.pbl.eEe..',
      '..wwwplbpbwwwl.',
      '.wwwwwppwwwwwlb',
      '.wwwwwwwwwwwwbl',
      '.wkkwwwwwwkkwlp',
      '.wwwwwwwwwwwwpl',
      '.wcwwwwwwwwcwl.',
      '..wwnnnnnnwwpl.',
      '..wwnknnknww.p.',
      '...wwnnnnww....',
      '.....wwww......',
    ], { Y: GOLD[4], y: GOLD[2], e: '#e8d8ec', E: '#ffb0c8', w: '#ffffff', p: '#f783ac', b: '#74c0fc', l: '#b197fc', k: '#4a3a6a', c: '#ffb0c8', n: '#fbe0ec' });
  }, { sparkle: [[[1, 2, 1], [14, 15, 0], [13, 3, 2]], [[13, 1, 1], [0, 13, 0], [3, 0, 2]]] }],

  // ---------------- Golden Galaxy ----------------
  'orn-planet': [17, 13, (b) => {
    b.set(8, 0, GOLD[3], 'soft'); b.set(7, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    const ring = (x, y, front) => {
      const dx = (x + 0.5 - 8.5) / 8; const dy = (y + 0.5 - 7.6 - (x - 8.5) * 0.12) / 2.1;
      const d = dx * dx + dy * dy;
      if (d > 1 || d < 0.6) return null;
      if (front !== dy > 0) return null;
      return d > 0.82 ? GOLD[3] : GOLD[4];
    };
    for (let y = 3; y < 13; y += 1) for (let x = 0; x < 17; x += 1) { const c = ring(x, y, false); if (c) b.set(x, y, c); }
    const PL = ['#3a2050', '#6a3a78', '#a05a8a', '#e08a8a', '#f8b89a', '#fde0c0'];
    ball(b, 8.5, 7.5, 4.6, 4.6, PL, { lift: 0.06, paint: (x, y, k) => (Math.floor((y + 0.5) / 1.6) % 3 === 1 ? ['#3a2050', '#5a3a88', '#7a5ab0', '#a08ad4', '#c4b4ec', '#e8e0ff'][k] : null) });
    for (let y = 3; y < 13; y += 1) for (let x = 0; x < 17; x += 1) { const c = ring(x, y, true); if (c) b.set(x, y, c); }
  }],

  'orn-starpup': [15, 14, (b) => {
    b.set(7, 0, GOLD[3], 'soft'); b.set(6, 1, GOLD[2], 'soft'); b.set(8, 1, GOLD[2], 'soft');
    // the galaxy's star puppy: cream, big floppy brown ears, a blue collar with a gold star tag
    stamp(b, 0, 2, [
      '....ccccccc....',
      '..ecCCCCCCCce..',
      '.eEcCCCwCCCcEe.',
      'eEEcCCCCCCCcEEe',
      'eEEckwCCCkwcEEe',
      'eEEcCCCCCCCcEEe',
      'eEecCCmmmCCceEe',
      '.eecCmmNmmCcee.',
      '.ee.cCmmmCc.ee.',
      '....cbbbbbc....',
      '......bYb......',
      '.......Y.......',
    ], { c: '#e8c078', C: '#f8e0a8', e: '#7a4a22', E: '#a8703a', w: '#ffffff', k: '#3a2018', m: '#fff4d8', N: K, b: '#5a7ae0', Y: GOLD[4] });
    b.set(7, 4, '#fff6c8'); b.set(6, 4, '#ffe27a'); b.set(8, 4, '#ffe27a');
    b.set(4, 8, '#ffb0a0'); b.set(10, 8, '#ffb0a0');
  }],
  'orn-stardust': [11, 17, (b) => {
    b.set(5, 0, GOLD[3], 'soft'); b.set(4, 1, GOLD[2], 'soft'); b.set(6, 1, GOLD[2], 'soft');
    stamp(b, 3, 2, ['ccccc', 'cCCCc', '.ccc.'], { c: WOOD[3], C: WOOD[4] });
    stamp(b, 2, 5, ['yyyyyyy', '...Yy..'], { y: GOLD[3], Y: GOLD[5] });
    for (let y = 6; y < 17; y += 1) for (let x = 0; x < 11; x += 1) {
      const half = y < 8 ? 3.5 : y > 15 ? 4.5 : 5.5;
      if (Math.abs(x + 0.5 - 5.5) > half) continue;
      const rim = Math.abs(x + 0.5 - 5.5) > half - 1;
      let c = rim ? (x < 5 ? '#eef8fc' : '#9ac0d4') : '#d4ecf4';
      if (!rim && y >= 9) c = y > 13 ? INDIGO[2] : y > 11 ? INDIGO[3] : INDIGO[4];
      if (!rim && y === 9 && bayer(x, y) < 0.5) c = '#d4ecf4';
      b.set(x, y, c);
    }
    // glowing specks of stardust: gold, pink and sky, a couple of them twinkling
    for (const [x, y, c] of [[3, 11, '#ffe27a'], [7, 10, '#ff9ac4'], [5, 13, '#ffe27a'], [8, 14, '#8ad8ff'], [3, 15, '#ff9ac4'], [6, 15, '#fff6c8'], [8, 12, '#fff6c8'], [4, 13, '#8ad8ff']]) b.set(x, y, c);
    stamp(b, 5, 11, ['.w.', 'wWw', '.w.'], { w: '#ffe27a', W: '#ffffff' });
    b.set(2, 8, '#ffffff'); b.set(2, 9, '#ffffff'); b.set(2, 10, '#ffffff');
  }, { glow: [5.5, 13, 7] }],
  'orn-starwhale': [19, 14, (b) => {
    b.set(8, 0, GOLD[3], 'soft'); b.set(7, 1, GOLD[2], 'soft'); b.set(9, 1, GOLD[2], 'soft');
    stamp(b, 6, 1, ['..y..', '.yYy.', 'yYYYy', 'ddddd'], { y: GOLD[3], Y: GOLD[5], d: GOLD[1] });
    for (let y = 4; y < 14; y += 1) for (let x = 0; x < 16; x += 1) {
      if (!inEll(x, y, 7.5, 8.8, 7.6, 4.8)) continue;
      const belly = y > 9.6 + (x - 7.5) * 0.08 && x < 12;
      const nx = (x + 0.5 - 7.5) / 7.6; const ny = (y + 0.5 - 8.8) / 4.8;
      let k = Math.round(2.4 - nx * 0.9 - ny * 1.2 + (bayer(x, y) - 0.5) * 0.8);
      let c = INDIGO[Math.max(1, Math.min(5, k))];
      if (belly) c = y > 12 ? '#c8b8f0' : '#e4dcff';
      if (!belly && h2(x, y, 9) < 0.1) c = '#fff6c8';
      b.set(x, y, c);
    }
    stamp(b, 14, 3, ['....ii', '...iIi', '..iIi.', '.iIi..', 'iIii..', 'iii...'], { i: INDIGO[2], I: INDIGO[4] });
    for (const [x, y] of [[4, 6], [6, 7], [9, 6]]) b.set(x, y, GOLD[4]);
    stamp(b, 2, 8, ['wK', '..', '.mm'], { w: '#ffffff', K, m: '#ff8ab0' });
  }, { sparkle: [[[1, 3, 1], [18, 12, 0], [17, 1, 2]], [[17, 8, 1], [0, 12, 0], [4, 1, 2]]] }],
};

// ---------- the star toppers ----------

/**
 * A faceted 5-pointed star (10 sided), lit from the top left: each point is a ridge, lit on the
 * face toward the light. paint(x, y, k, d) gives the color for shade k (0 dark .. 1 lit) at
 * distance d (0 middle .. 1 tip); null leaves the cell to the star's default.
 */
function starShape(b, cx, cy, R, r, paint) {
  const pts = [];
  for (let i = 0; i < 10; i += 1) { const a = -Math.PI / 2 + (i * Math.PI) / 5; const rr = i % 2 ? r : R; pts.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  const inside = (px, py) => { let c = false; for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) { const [xi, yi] = pts[i]; const [xj, yj] = pts[j]; if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) c = !c; } return c; };
  for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y += 1) for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x += 1) {
    if (!inside(x + 0.5, y + 0.5)) continue;
    const px = x + 0.5 - cx; const py = y + 0.5 - cy;
    let best = -2; let t = [0, -1];
    for (let i = 0; i < 5; i += 1) { const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5; const tx = Math.cos(a); const ty = Math.sin(a); const dd = (px * tx + py * ty) / (Math.hypot(px, py) || 1); if (dd > best) { best = dd; t = [tx, ty]; } }
    const side = t[0] * py - t[1] * px > 0 ? 1 : -1;
    const n = side > 0 ? [-t[1], t[0]] : [t[1], -t[0]];
    const lit = 0.62 * (n[0] * -0.6 + n[1] * -0.8) + 0.45;
    const d = Math.hypot(px, py) / R;
    const k = Math.max(0, Math.min(1, lit + (bayer(x, y) - 0.5) * 0.12));
    const c = paint(x, y, k, d);
    if (c) b.set(x, y, c);
  }
}
const pick = (P, k) => P[Math.max(0, Math.min(P.length - 1, Math.round(k * (P.length - 1))))];
const GOLDS = GOLD.slice(1);

const STAR_SPARK = [[[0, 2, 1], [16, 13, 0], [15, 0, 2]], [[16, 4, 1], [1, 15, 0], [1, 7, 2]]];
const STAR = {
  'star-meadow': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.6, (x, y, k) => pick(GOLDS, k));
    stamp(b, 7, 7, ['.c.', 'ccc', 'nNn', '.n.'], { c: CUPULE[3], n: NUT[3], N: NUT[5] });
    stamp(b, 4, 12, ['L.......L', 'lL.....Ll'], { L: LEAF[4], l: LEAF[2] });
  }],
  'star-sunset': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.9, (x, y, k, d) => (d < 0.4 ? pick(ORANGE.slice(2), k) : pick(CORAL.slice(1), k)));
    for (const [x, y] of [[8, 4], [4, 8], [12, 8], [6, 12], [11, 12], [8, 8]]) b.set(x, y, '#fff4c8');
  }],
  'star-ocean': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.8, (x, y, k) => pick(['#2e8a8e', '#46b4b0', '#7ad8cc', '#b4f0e4', '#e4fff8'], k));
    ball(b, 8.5, 9.4, 2, 2, PEARL, { lift: 0.15 });
  }],
  'star-space': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.7, (x, y, k) => pick(SILV.slice(1), k));
    for (let y = 6; y < 13; y += 1) for (let x = 5; x < 12; x += 1) if (inEll(x, y, 8.5, 9.4, 2.8, 2.8) && !inEll(x, y, 9.8, 8.6, 2.2, 2.2)) b.set(x, y, x < 7 ? GOLD[5] : GOLD[4]);
  }],
  'star-castle': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.7, (x, y, k) => pick(GOLDS, k));
    stamp(b, 6, 7, ['.rRr.', 'rRRrr', '.rrr.'], { r: '#c0304a', R: '#ff7a8a' });
    b.set(7, 7, '#ffffff');
  }],
  'star-volcano': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.7, (x, y, k, d) => {
      const crack = Math.abs(Math.sin((x * 1.7 + y * 0.9))) < 0.22 || d < 0.28;
      return crack ? pick(LAVA.slice(3), k + 0.2) : pick(['#1a1424', '#2a2238', '#3e3450', '#584c6c'], k);
    });
  }],
  'star-rainforest': [17, 17, (b) => {
    starShape(b, 8.5, 9, 8.4, 3.6, (x, y, k, d) => (d > 0.5 && (x + y) % 5 === 0 ? LEAF[1] : pick(LEAF.slice(1), k)));
    stamp(b, 6, 7, ['.p.p.', 'pPyPp', '.pPp.', '..p..'], { p: '#e8509a', P: '#ff9ac8', y: '#ffe27a' });
  }],
  'star-fjord': [17, 17, (b) => {
    // a snowflake: six arms with little branches, icy blue
    const put = (x, y, c) => b.set(Math.round(x), Math.round(y), c);
    for (let i = 0; i < 6; i += 1) {
      const a = -Math.PI / 2 + (i * Math.PI) / 3; const cx = 8.5 - 0.5; const cy = 8.5;
      for (let r = 0; r <= 7.6; r += 0.5) put(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r > 6.5 ? SNOW[5] : i < 3 ? SNOW[4] : SNOW[3]);
      for (const s of [-1, 1]) for (let r = 0; r <= 2.2; r += 0.5) { const bx = cx + Math.cos(a) * 4.4 + Math.cos(a + s * 1.05) * r; const by = cy + Math.sin(a) * 4.4 + Math.sin(a + s * 1.05) * r; put(bx, by, '#bfe6ff'); }
    }
    for (let y = 6; y < 12; y += 1) for (let x = 5; x < 12; x += 1) if (inEll(x, y, 8.5, 9, 2, 2)) b.set(x, y, '#d8f0ff');
    b.set(8, 9, '#ffffff');
  }],
  'star-rainbow': [17, 17, (b) => {
    const bands = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'];
    starShape(b, 8.5, 9, 8.4, 3.8, (x, y, k) => { const c = bands[Math.max(0, Math.min(5, Math.floor((y - 1) / 2.6)))]; return k > 0.6 ? mix(c, '#ffffff', 0.35) : k < 0.35 ? mix(c, '#5a3a7a', 0.25) : c; });
  }],
  'star-galaxy': [17, 17, (b) => {
    // a gold star with a curling comet tail of stardust
    for (const [x, y, c] of [[2, 15, '#9a94e8'], [3, 14, '#9a94e8'], [3, 15, '#6a62cc'], [4, 13, '#ff9ac4'], [5, 13, '#ff9ac4'], [4, 14, '#c4b4ec'], [1, 16, '#6a62cc']]) b.set(x, y, c, 'soft');
    starShape(b, 9.5, 8, 7.6, 3.4, (x, y, k) => pick(GOLDS, k));
    b.set(9, 8, '#ffffff');
  }],
};
for (const k of Object.keys(STAR)) STAR[k][3] = { sparkle: STAR_SPARK, star: true };

// ---------- the tree in the buddy's room ----------

/** The tree's size (room pixels) and where its trunk's foot is in that box. */
export const TREE = { w: 40, h: 64, foot: { x: 20, y: 63 } };
const TCX = 20;
const BODY0 = 7; const BODY1 = 55; const TIER_N = 5; const HALF = 19.4;
const tierH = (BODY1 - BODY0) / TIER_N;
/** The tree's half width at a height (tt 0 top .. 1 foot) and how far down its tier (ph). */
const halfAt = (tt, ph) => HALF * (0.1 + 0.9 * tt) * (0.52 + 0.48 * ph);
/**
 * The branches as a mask, worked out once: like the fjord's spruces (fjordart.js), tiers of
 * drooping boughs, each wider at its foot than its top, its foot edge hanging in little tips.
 * FOL.get(key) is { tier, ph (0 top .. 1 foot of its tier), u (-1 left .. 1 right) }.
 */
const FOL = (() => {
  const m = new Map();
  for (let y = BODY0; y < BODY1; y += 1) {
    const yy = y - BODY0;
    const tier = Math.floor(yy / tierH); const ph = (yy - tier * tierH) / tierH;
    const tt = (yy + 1) / (BODY1 - BODY0);
    const half = Math.max(0.6, halfAt(tt, ph) + (h2(y, 3, 77) - 0.5) * 0.8);
    for (let x = 0; x < TREE.w; x += 1) {
      const dx = x + 0.5 - TCX;
      if (Math.abs(dx) > half) continue;
      // the bough tips: along each tier's foot only every other pair of cells hangs down
      if (ph > 0.86 && Math.abs(dx) > 1.5 && Math.floor((dx + 40) / 2) % 2 === 0) continue;
      m.set(`${x},${y}`, { tier, ph, u: dx / half });
    }
  }
  return m;
})();
const fol = (x, y) => FOL.get(`${x},${y}`);
/** Which tier a cell of the tree is in, or -1. */
const tierAt = (x, y) => fol(x, y)?.tier ?? -1;

// On the tree each ornament is a tiny bauble (2 x 2, lit from the top left) in its own main color,
// so a full tree reads as baubles, not as 40 crumbs of picture
const BAUBLE = {
  'orn-acorn': '#c4843e', 'orn-toadstool': '#e0443a', 'orn-oak': '#e8b030', 'orn-owl': '#f0c040',
  'orn-shell': '#f48a86', 'orn-crab': '#f07a30', 'orn-pirate': '#36a0a4', 'orn-parrot': '#e8463a',
  'orn-pearl': '#ece0f4', 'orn-clown': '#ff8c24', 'orn-octopus': '#a070d4', 'orn-galleon': '#44b4e8',
  'orn-moon': '#d4ccbc', 'orn-rocket': '#e04848', 'orn-saucer': '#84dc64', 'orn-moonworm': '#cc8ce0',
  'orn-shield': '#4a74d8', 'orn-tower': '#b0a8c0', 'orn-crown': '#f4c840', 'orn-dragonegg': '#2cb4a4',
  'orn-lava': '#ff6a24', 'orn-dragonfruit': '#f05aa4', 'orn-stoneface': '#9aa884', 'orn-capybara': '#c48c54',
  'orn-kapok': '#f6f2ea', 'orn-frog': '#3a8cec', 'orn-sloth': '#bc9474', 'orn-morpho': '#2a7cf4',
  'orn-moose': '#946240', 'orn-puffin': '#ff9a34', 'orn-lighthouse': '#e44444', 'orn-aurora': '#64e4a4',
  'orn-lolly': '#ff6ea0', 'orn-sheep': '#f2f0fa', 'orn-goldpot': '#f0c040', 'orn-unicorn': '#f8a8dc',
  'orn-planet': '#f4aa74', 'orn-starpup': '#f2d494', 'orn-stardust': '#7c84ec', 'orn-starwhale': '#4c5acc',
};
const BAUBLE_RAMP = Object.fromEntries(Object.entries(BAUBLE).map(([id, c]) => [id, ramp(c, 3, 2)]));
// the star toppers on the tree: a small faceted star in each one's colors, and its middle
const STAR_MINI = {
  'star-meadow': [GOLDS, NUT[3]], 'star-sunset': [CORAL.slice(1), ORANGE[4]], 'star-ocean': [['#2e8a8e', '#46b4b0', '#7ad8cc', '#b4f0e4', '#e4fff8'], PEARL[5]],
  'star-space': [SILV.slice(1), GOLD[4]], 'star-castle': [GOLDS, '#e0304a'], 'star-volcano': [['#1a1424', '#2a2238', '#3e3450', '#584c6c'], LAVA[4]],
  'star-rainforest': [LEAF.slice(1), '#e8509a'], 'star-fjord': [['#8aa8d4', '#b8d0ec', '#dceaf8', '#ffffff'], '#ffffff'],
  'star-rainbow': [['#9775fa', '#4dabf7', '#69db7c', '#ffd43b', '#ffa94d'], '#ff6b6b'], 'star-galaxy': [GOLDS, '#ffffff'],
};

/**
 * Where the ornaments hang and the bulbs shine: two rows across each tier (one up under the bough
 * above, one along its drooping tips), points spaced evenly along each row and staggered from the
 * row above, so the tree looks dressed with care rather than sprinkled. Every third point is a
 * bulb on the string of lights; the rest are the 40 ornament spots, in the order they fill up
 * (each time the spot furthest from every one taken, so a few look evenly spread).
 */
const BULB_C = ['#ff5a5a', '#ffd23f', '#5ad0ff', '#ff8ad8', '#8af07a'];
const { SLOTS, BULBS } = (() => {
  const pts = [];
  let row = 0;
  for (let t = 0; t < TIER_N; t += 1) {
    for (const ph of [0.2, 0.5, 0.8]) {
      const y = Math.round(BODY0 + tierH * (t + ph));
      const tt = (y - BODY0 + 1) / (BODY1 - BODY0);
      const half = Math.max(0, halfAt(tt, ph) - 1.8);
      const n = Math.max(1, Math.round((half * 2) / 3.8) + 1);
      const step = n > 1 ? (half * 2) / (n - 1) : 0;
      for (let i = 0; i < n; i += 1) {
        const x = Math.round(TCX - half + i * step - 1 + (n > 1 ? (row % 2 ? 0.7 : -0.7) : 0));
        pts.push({ x, y, row, i });
      }
      row += 1;
    }
  }
  const inside = (p) => [[0, 0], [1, 0], [0, 1], [1, 1]].every(([dx, dy]) => tierAt(p.x + dx, p.y + dy) >= 0);
  // a spot that pokes out past the branches moves in a pixel toward the trunk
  const ok = pts.map((p) => {
    if (inside(p)) return p;
    const s = Math.sign(TCX - 1 - p.x) || 1;
    return [[s, 0], [2 * s, 0], [0, -1], [s, -1]].map(([dx, dy]) => ({ ...p, x: p.x + dx, y: p.y + dy })).find(inside);
  }).filter((p, k, all) => p && !all.slice(0, k).some((q) => q && Math.abs(q.x - p.x) < 3 && q.y === p.y));
  // the bulbs: every third point, the pattern sliding along each row so they spiral round
  const isBulb = (p) => (p.i + p.row * 2) % 3 === 1;
  const bulbs = ok.filter(isBulb).map((p, k) => ({ x: p.x + (k % 2), y: p.y + 1, c: BULB_C[(k * 2) % 5], phase: k % 3 }));
  const cand = ok.filter((p) => !isBulb(p)).map((p) => [p.x, p.y]);
  const out = [cand.reduce((a, c) => (Math.hypot(c[0] - TCX, c[1] - 34) < Math.hypot(a[0] - TCX, a[1] - 34) ? c : a))];
  while (out.length < Math.min(40, cand.length)) {
    let best = null; let bd = -1;
    for (const c of cand) {
      if (out.includes(c)) continue;
      const d = Math.min(...out.map((o) => Math.hypot(c[0] - o[0], (c[1] - o[1]) * 1.1)));
      if (d > bd) { bd = d; best = c; }
    }
    out.push(best);
  }
  return { SLOTS: out, BULBS: bulbs };
})();

/** A small faceted star topper (9 x 9), centered on (cx, cy). */
function miniStar(b, cx, cy, id) {
  const [P, mid] = STAR_MINI[id] || STAR_MINI['star-meadow'];
  starShape(b, cx, cy, 4.6, 2, (x, y, k) => pick(P, k));
  b.set(Math.floor(cx), Math.floor(cy), mid);
}

/**
 * The little tree in the buddy's room. o: { ornaments: ids hung on it (xmas.js ORNAMENTS, in
 * the order they were found), star: a star topper id or null, garland: 0 none, 1 gold beads }.
 * Returns { body, lights }: body is the tree (outlined, its foot at TREE.foot) with every bulb
 * unlit; lights are three twinkle frames (see-through, no outline) to lay over it in turn, with
 * the star's warm glow in each.
 */
export function treeArt(o = {}) {
  const orns = (o.ornaments || []).filter((id) => BAUBLE[id]).slice(0, SLOTS.length);
  // past half full the ornaments carry the color, so the string of lights thins to about 12 bulbs
  const bulbs = orns.length > 20 ? BULBS.filter((_, i) => i % 2 === 0).slice(0, 12) : BULBS;
  // the star topper, drawn on its own first: the tree needs its cells for its outline and glow
  const star = new Map();
  if (o.star) {
    const sb = new Buf(TREE.w, TREE.h, 4);
    miniStar(sb, TCX, 5.2, o.star);
    sb.each((x, y) => { if (sb.get(x, y)) star.set(`${x},${y}`, sb.get(x, y)); });
  }
  const isStar = (x, y) => star.has(`${x},${y}`);
  const body = sprite(TREE.w, TREE.h, (b) => {
    // the branches, lit from the left: four bands of light across each bough, dark under it,
    // its top lit where it comes out from under the bough above, a few needles catching light
    for (const [key, f] of FOL) {
      const [x, y] = key.split(',').map(Number);
      let k = f.u < -0.5 ? 5 : f.u < 0 ? 4 : f.u < 0.5 ? 3 : 2;
      if (f.ph > 0.76) k -= 1;
      if (f.ph < 0.2 && f.u < 0.3 && f.tier > 0) k += 1;
      const r = h2(x, y, 31);
      if (r > 0.93 && f.ph < 0.7) k += 1; else if (r < 0.05) k -= 1;
      // the needles' texture: a little ordered dither where two bands meet
      if (Math.abs(f.u + 0.5) < 0.09 || Math.abs(f.u) < 0.08 || Math.abs(f.u - 0.5) < 0.09) k += bayer(x, y) > 0.5 ? 0 : -1;
      b.set(x, y, PINE[Math.max(1, Math.min(6, k))]);
    }
    // the trunk and the pot: a red pot with a cream band and a gold bow
    for (let y = 53; y < 57; y += 1) for (let x = 18; x < 22; x += 1) b.set(x, y, x === 18 ? BARK[4] : x === 21 ? BARK[1] : BARK[2]);
    for (let y = 55; y < 64; y += 1) for (let x = 12; x < 28; x += 1) {
      const taper = y > 60 ? 1 : 0;
      if (x < 12 + taper || x > 27 - taper) continue;
      let c = y === 55 ? RED[5] : y === 56 ? RED[4] : x < 15 ? RED[4] : x > 24 ? RED[2] : RED[3];
      if (y === 58 || y === 59) c = x < 15 ? CREAM[5] : x > 24 ? CREAM[3] : CREAM[4];
      b.set(x, y, c);
    }
    stamp(b, 18, 57, ['g.g', '.G.', 'g.g'], { g: GOLD[3], G: GOLD[5] });
    // a string of gold beads swags across two tiers between the rows of ornaments (about half full)
    const swag = (tier, put, step = 1) => {
      const y0 = BODY0 + tierH * (tier + 0.5);
      const half = halfAt((y0 - BODY0) / (BODY1 - BODY0), 0.5);
      for (let x = 0; x < TREE.w; x += step) {
        const u = (x + 0.5 - TCX) / half;
        if (Math.abs(u) > 0.96) continue;
        const y = Math.round(y0 - u * 0.8 + 1.6 * (1 - u * u) - 0.8);
        if (tierAt(x, y) >= 0) put(x, y);
      }
    };
    if (o.garland >= 1) for (const t of [1, 3]) swag(t, (x, y) => b.set(x, y, x % 4 === 1 ? GOLD[5] : GOLD[3]), 2);
    // the bulbs, unlit (a darker glass), each on its little green socket
    for (const l of bulbs) b.set(l.x, l.y, mix(l.c, '#3b2235', 0.4));
    // the ornaments, little 2 x 2 baubles in their own colors; rare and super-rare ones hang from a
    // gold cap. On a busy tree (over 20) they shade softer and lose the caps, so 40 read as baubles,
    // not confetti (the book shows the rarity)
    const busy = orns.length > 20;
    orns.forEach((id, i) => {
      const [x, y] = SLOTS[i];
      const r = BAUBLE_RAMP[id];
      b.set(x, y, r[busy ? 4 : 5]); b.set(x + 1, y, r[3]); b.set(x, y + 1, r[3]); b.set(x + 1, y + 1, r[busy ? 2 : 1]);
      // a little shadow on the needles under it, so it hangs in front of the branch
      if (tierAt(x + 1, y + 2) >= 0) b.set(x + 1, y + 2, PINE[1]);
      const rar = ORN_RARITY[id];
      if (!busy && (rar === 'rare' || rar === 'super')) b.set(x + (i % 2), y - 1, GOLD[4]);
    });
    // the star on top, or the bare tip
    if (o.star) for (const [k, c] of star) { const [x, y] = k.split(',').map(Number); b.set(x, y, c); }
    else { b.set(19, 6, PINE[5]); b.set(20, 5, PINE[5]); b.set(20, 6, PINE[4]); }
  }, {
    pad: 4, inkUp: 0,
    // the star's outline in a dark shade of its own colors, so a pale star holds against a pale wall
    after: (b) => {
      if (!o.star) return;
      const dark = mix((STAR_MINI[o.star] || STAR_MINI['star-meadow'])[0][0], '#2a1838', 0.5);
      for (const k of star.keys()) {
        const [x, y] = k.split(',').map(Number);
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          if (!isStar(x + dx, y + dy) && b.tag(x + dx, y + dy) === 'edge') b.set(x + dx, y + dy, dark, 'edge');
        }
      }
    },
  });
  // the star's warm glow: two pixels round it, outside its outline (soft, see-through)
  const glow = [];
  if (o.star) {
    const ring = (x, y) => [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => isStar(x + dx, y + dy));
    for (let y = -4; y < 14; y += 1) for (let x = 10; x < 30; x += 1) {
      if (isStar(x, y) || ring(x, y)) continue;
      let d = 9;
      for (const k of star.keys()) { const [sx, sy] = k.split(',').map(Number); d = Math.min(d, Math.hypot(x - sx, y - sy)); }
      if (d <= 2.3 && !fol(x, y)) glow.push([x, y, d < 1.6 ? 'rgba(255,214,120,0.55)' : 'rgba(255,214,120,0.28)']);
    }
  }
  // three frames of lights: a third of the bulbs bright each time, with a soft glow round them;
  // the super-rare ornaments and the star glint now and then too
  const lights = [0, 1, 2].map((f) => {
    const b = new Buf(TREE.w, TREE.h, 4);
    // the bulbs chase round: this frame's third bright with a glow, the next third half lit,
    // the rest left dim (the tree's own unlit glass shows through)
    for (const [x, y, c] of glow) b.set(x, y, c, 'soft');
    for (const l of bulbs) {
      if (l.phase === f) {
        b.set(l.x, l.y, mix(l.c, '#ffffff', 0.6), 'soft');
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) b.set(l.x + dx, l.y + dy, `${l.c}b0`, 'soft');
        for (const [dx, dy] of [[1, 1], [-1, -1], [1, -1], [-1, 1]]) b.set(l.x + dx, l.y + dy, `${l.c}40`, 'soft');
      } else if (l.phase === (f + 1) % 3) b.set(l.x, l.y, l.c, 'soft');
    }
    orns.forEach((id, i) => { if (ORN_RARITY[id] === 'super' && (i + f) % 3 === 0) { const [x, y] = SLOTS[i]; b.set(x, y, '#ffffff', 'soft'); b.set(x - 1, y - 1, '#fff6c880', 'soft'); } });
    if (o.star) {
      const tw = [[20, -1], [25, 4], [15, 6]][f];
      twinkle(b, tw[0], tw[1], false, '#fff6c8');
    }
    b.w = TREE.w; b.h = TREE.h;
    return b;
  });
  return { body, lights };
}

// ---------- presents (sibling gifts) ----------

const KRAFT = ['#5a3a30', '#8a5e44', '#b8865a', '#d4a874', '#ecc892', '#fae4b8'];
const PLAID_G = ['#183a32', '#1e5a40', '#2e7a4a', '#46985a', '#6cb870', '#a0d890'];
const RIBBONS = {
  green: ['#163a2e', '#1e5a3a', '#2e8044', '#4aa64a', '#86cc5a', '#c4ec84'],
  gold: GOLD, red: RED, cream: CREAM,
  // red baker's twine, so the string shows on the brown paper
  twine: ['#4e1a34', '#7e2440', '#a8343e', '#c84a44', '#e8705a', '#ffa888'],
};
/** The wrapping paper's color at (x, y) for shade k (0 dark .. 5 light): its pattern in two ramps. */
function paperAt(id, x, y, k) {
  const at = (P, d = 0) => P[Math.max(0, Math.min(5, k + d))];
  switch (id) {
    case 'candy': return (x + y + 64) % 6 < 3 ? at(RED) : at(CREAM, 1);
    case 'dots': return ((x % 4 === 1 && y % 4 === 1) || (x % 4 === 3 && y % 4 === 3)) ? at(SNOW, 2) : at(BLUE);
    case 'stars': {
      const gx = (x + (Math.floor(y / 5) % 2) * 3) % 6; const gy = y % 5;
      if (gx === 2 && gy === 2) return '#fff6c8';
      if ((gx === 2 && (gy === 1 || gy === 3)) || (gy === 2 && (gx === 1 || gx === 3))) return at(GOLD, 0);
      return at(INDIGO, -1);
    }
    case 'plaid': {
      // a cozy tartan: red, crossed by dark green bands, with a thin cream line between them
      const bx = (x + 64) % 7; const by = (y + 64) % 7;
      const gx = bx < 2; const gy = by < 2;
      if (gx && gy) return at(PLAID_G, -2);
      if (gx || gy) return at(PLAID_G, -1);
      if (bx === 4 || by === 4) return at(CREAM, -1);
      return at(RED);
    }
    default: return h2(x, y, 3) < 0.1 ? at(KRAFT, -1) : at(KRAFT); // brown paper
  }
}

/** A bow: two loops and two tails, its knot at (cx, y). */
function bow(b, cx, y, R) {
  stamp(b, cx - 3, y - 2, ['.ll.ll.', 'lLlklLl', '.l.k.l.', '..l.l..'], { l: R[3], L: R[5], k: R[1] });
}

/**
 * A wrapped present as a sprite (outlined, its foot along the bottom row). shape: small, tall
 * or round; paper: xmas.js GIFT_PAPERS id; o.tag: a little gift tag hanging off the bow.
 */
export function giftArt(shape = 'small', paper = 'candy', o = {}) {
  const P = GIFT_PAPER_BY[paper] || GIFT_PAPER_BY.candy;
  const R = RIBBONS[P.ribbon] || RIBBONS.gold;
  const [w, h] = GIFT_SIZE[shape] || GIFT_SIZE.small;
  return sprite(w, h, (b) => drawGift(b, shape, paper, R, o), { pad: 5, inkUp: 0 });
}
export const GIFT_SIZE = { small: [13, 13], tall: [10, 18], round: [13, 14] };
/**
 * Where the presents sit under the tree (the middle of each one's foot, in the tree's box, see
 * TREE): one each side of the pot, then one in front, then the gaps between.
 */
export const GIFT_AT = [{ x: 7, y: 64 }, { x: 33, y: 64 }, { x: -3, y: 68 }, { x: 20, y: 69 }];
const GIFT_PAPER_BY = Object.fromEntries(GIFT_PAPERS.map((p) => [p.id, p]));

function drawGift(b, shape, paper, R, o = {}) {
  const [w, h] = GIFT_SIZE[shape];
  if (shape === 'round') {
    // a squashy round bundle, the paper gathered and tied at the top in a ruffle
    for (let y = 4; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      if (!inEll(x, y, 6.5, 9.4, 6.5, 4.8)) continue;
      const nx = (x + 0.5 - 6.5) / 6.5; const ny = (y + 0.5 - 9.4) / 4.8;
      let k = Math.round(3.2 - nx * 1.3 - ny * 0.9 + (bayer(x, y) - 0.5) * 0.5);
      // gathers: creases running up to the tie
      if (Math.abs(nx * 4 - Math.round(nx * 4)) < 0.15 && ny < 0.3) k -= 1;
      b.set(x, y, paperAt(paper, x, y, Math.max(1, Math.min(5, k))));
    }
    for (let y = 1; y < 5; y += 1) for (let x = 3; x < 10; x += 1) {
      const half = [3.4, 2.6, 1.4, 1.6][y - 1];
      if (Math.abs(x + 0.5 - 6.5) > half) continue;
      b.set(x, y, paperAt(paper, x, y, y === 1 ? 4 : x < 6 ? 4 : 2));
    }
    b.del(4, 1); b.del(8, 1); // the ruffle's frilly top
    for (let x = 4; x < 9; x += 1) b.set(x, 4, x === 4 ? R[4] : R[3]);
    bow(b, 6, 4, R);
    stamp(b, 4, 6, ['r', 'r'], { r: R[2] }); stamp(b, 8, 6, ['r', '.r'], { r: R[2] });
  } else {
    // a box seen from above and in front: its lid on top, its front below, a ribbon both ways
    const top = shape === 'tall' ? 3 : 4; const y0 = 3;
    const cxL = Math.floor(w / 2) - 1;
    for (let y = y0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const lid = y < y0 + top;
      let k = lid ? (x < 2 ? 5 : 4) : (x < 1 ? 4 : x > w - 2 ? 2 : 3);
      if (!lid && y === y0 + top) k -= 1; // shadow under the lid's rim
      if (!lid && y === h - 1) k = 2;
      let c = paperAt(paper, x, y, k);
      const ribV = x === cxL || x === cxL + 1;
      const ribH = lid && y === y0 + 1 + (shape === 'tall' ? 0 : 1);
      if (ribV || ribH) c = R[lid ? (x === cxL ? 5 : 4) : (x === cxL ? 4 : 3)];
      if (!lid && y === y0 + top && ribV) c = R[2];
      b.set(x, y, c);
    }
    // the lid sticks out a little over the box
    for (let y = y0; y < y0 + top; y += 1) { b.set(-1, y, paperAt(paper, -1, y, 4)); b.set(w, y, paperAt(paper, w, y, 2)); }
    bow(b, cxL + 1, y0, R);
  }
  if (o.tag) {
    // a little cream tag on a string from the bow, with a red holly berry
    const tx = shape === 'tall' ? w - 2 : w - 4; const ty = shape === 'round' ? 7 : 6;
    stamp(b, tx, ty - 2, ['s.', '.s'], { s: R[1] });
    stamp(b, tx + 1, ty, ['.ttt', 'tTTt', 'tTrt', '.ttt'], { t: CREAM[4], T: CREAM[5], r: RED[3] });
  }
}

/**
 * The shake: three frames of the present wiggling (lean left, hop up, lean right), as sprites
 * the same size (with room round them) and a couple of little shake marks beside it.
 */
export function giftShake(shape, paper, frame) {
  const P = GIFT_PAPER_BY[paper] || GIFT_PAPER_BY.candy;
  const R = RIBBONS[P.ribbon] || RIBBONS.gold;
  const [w, h] = GIFT_SIZE[shape];
  const flat = new Buf(w, h, 5);
  drawGift(flat, shape, paper, R, { tag: true });
  const lean = [-1, 0, 1][frame % 3]; const hop = frame % 3 === 1 ? 2 : 0;
  return sprite(w, h, (b) => {
    flat.each((x, y) => {
      const c = flat.get(x, y);
      if (!c) return;
      const sh = Math.round(lean * (h - 1 - y) / (h - 1) * 2);
      b.set(x + sh, y - hop, c);
    });
  }, {
    pad: 5, inkUp: 0, ground: hop === 0,
    after: (b) => {
      const mk = 'rgba(255,248,231,0.9)';
      if (lean < 0) for (const [x, y] of [[-3, 2], [-4, 3], [-3, 6], [-4, 7]]) b.set(x, y, mk, 'soft');
      if (lean > 0) for (const [x, y] of [[w + 2, 2], [w + 3, 3], [w + 2, 6], [w + 3, 7]]) b.set(x, y, mk, 'soft');
      if (hop) for (const [x, y] of [[1, h], [3, h + 1], [w - 2, h], [w - 4, h + 1]]) b.set(x, y - 1, 'rgba(42,24,56,0.25)', 'soft');
    },
  });
}

/**
 * Christmas morning: four frames of unwrapping, 30 x 26 each. 0 the paper rips at the top and
 * the ribbon springs loose, 1 the paper bursts open and bits fly, 2 the gift pops up out of the
 * box in a burst of light, 3 the gift on show on its pile of torn paper. gift: an ornament id
 * (what was inside).
 */
export function unwrapArt(shape, paper, frame, gift = 'orn-unicorn') {
  const P = GIFT_PAPER_BY[paper] || GIFT_PAPER_BY.candy;
  const R = RIBBONS[P.ribbon] || RIBBONS.gold;
  const W = 30; const H = 26;
  const [gw, gh] = GIFT_SIZE[shape];
  const ox = Math.round((W - gw) / 2); const oy = H - gh;
  const scrap = (b, x, y, i) => { const k = 2 + (i % 3); b.set(x, y, paperAt(paper, x, y, k)); if (i % 2) b.set(x + 1, y, paperAt(paper, x + 1, y, k - 1)); if (i % 3 === 0) b.set(x, y + 1, paperAt(paper, x, y + 1, k - 1)); };
  const box = (b, lidOff) => {
    // the plain white box under the paper
    for (let y = oy + 6; y < H; y += 1) for (let x = ox; x < ox + gw; x += 1) b.set(x, y, y === oy + 6 ? CREAM[5] : x < ox + 2 ? CREAM[4] : x > ox + gw - 3 ? CREAM[2] : CREAM[3]);
    if (lidOff) for (let y = oy + 6; y < oy + 8; y += 1) for (let x = ox + 1; x < ox + gw - 1; x += 1) b.set(x, y, '#7a4a5a'); // the open top, dark inside
  };
  const b = sprite(W, H, (bb) => {
    if (frame === 0) {
      // still wrapped, a tear across the top showing the white box, the ribbon sprung loose
      const g = new Buf(gw, gh, 5); drawGift(g, shape, paper, R, {});
      g.each((x, y) => { const c = g.get(x, y); if (c) bb.set(ox + x, oy + y, c); });
      for (let x = ox + 1; x < ox + gw - 2; x += 1) { const y = oy + 3 + ((x * 7) % 3 === 0 ? 1 : 0) + (x % 2); bb.set(x, y, CREAM[5]); bb.set(x, y + 1, CREAM[3]); }
      // the bow pops off to the side, its ribbon ends curling
      stamp(bb, ox + gw + 1, oy - 3, ['.ll.ll.', 'lLlklLl', '.l.k.l.', '..l..l.', '.l....l'], { l: R[3], L: R[5], k: R[1] });
      for (const [x, y, i] of [[ox - 3, oy + 2, 0], [ox + 3, oy - 3, 1]]) scrap(bb, x, y, i);
    } else if (frame === 1) {
      // the paper bursts: the box shows, torn flaps peel back each side, bits fly up and out
      box(bb, false);
      for (let y = oy + 8; y < H; y += 1) {
        const peel = Math.round((y - oy - 8) * 0.35);
        for (let x = 0; x < 3; x += 1) { bb.set(ox - 1 - peel - x + 1, y, paperAt(paper, ox - peel - x, y, 3)); bb.set(ox + gw - 1 + peel + x, y, paperAt(paper, ox + gw + peel + x, y, 2)); }
      }
      // the lid lifting off
      for (let y = oy + 1; y < oy + 4; y += 1) for (let x = ox - 1; x < ox + gw + 1; x += 1) bb.set(x + (y - oy), y - 2, y === oy + 1 ? CREAM[5] : CREAM[4]);
      [[3, 4], [7, 1], [21, 0], [25, 5], [1, 11], [27, 12], [11, 2], [17, 1]].forEach(([x, y], i) => scrap(bb, x, y, i));
    } else if (frame === 2) {
      // the gift pops out of the open box in a burst of light
      box(bb, true);
      for (let x = 0; x < 4; x += 1) { bb.set(ox - 2 - x, H - 1, paperAt(paper, x, H - 1, 3)); bb.set(ox + gw + 1 + x, H - 1, paperAt(paper, x + 9, H - 1, 2)); bb.set(ox - 1 - x, H - 2, paperAt(paper, x, H - 2, 4)); }
      [[2, 12], [27, 9], [5, 20], [25, 19]].forEach(([x, y], i) => scrap(bb, x, y, i));
    } else {
      // on show: sitting on top of the open box, on a crumpled heap of paper
      box(bb, true);
      for (let y = H - 4; y < H; y += 1) for (let x = 2; x < W - 2; x += 1) {
        if (!inEll(x, y, W / 2, H, 13, 4.2)) continue;
        if (x >= ox && x < ox + gw && y < H - 1) continue;
        const k = 2 + Math.round(Math.sin(x * 1.3 + y * 2.1) * 1.2 + 1);
        bb.set(x, y, paperAt(paper, x, y, Math.min(5, k)));
      }
      stamp(bb, ox + gw - 2, H - 5, ['.ll.', 'lLkl', '.l.l'], { l: R[3], L: R[5], k: R[1] });
    }
  }, { pad: 4, inkUp: 0 });
  // the gift itself (its own sprite, already outlined) and the light round it
  if (frame >= 2) {
    const g = ornamentArt(gift, frame % 2);
    const gx = Math.round(W / 2 - g.w / 2); const gy = frame === 2 ? oy - g.h + 2 : oy - g.h + 7;
    if (frame === 2) for (let i = 0; i < 12; i += 1) { const a = (i / 12) * Math.PI * 2; for (let r = 9; r < 13; r += 1) { const x = Math.round(W / 2 + Math.cos(a) * r); const y = Math.round(gy + g.h / 2 + Math.sin(a) * r * 0.9); if (!b.get(x, y)) b.set(x, y, r < 11 ? 'rgba(255,240,170,0.75)' : 'rgba(255,240,170,0.4)', 'soft'); } }
    g.each((x, y) => { const c = g.get(x, y); if (c) b.set(gx + x, gy + y, c, g.tag(x, y)); });
    if (frame === 3) { twinkle(b, 3, 4, true); twinkle(b, W - 4, 8, false); dot(b, 6, 13); }
  }
  if (frame === 1) { twinkle(b, 15, 2, false); }
  return b;
}

/** Which way an ornament's art is: its size and drawing. */
const artOf = (id) => ORN[id] || STAR[id] || null;

/**
 * An ornament (or star topper) as a sprite buffer, outlined. frame 0 / 1: super-rare ones and
 * stars sparkle between the two.
 */
export function ornamentArt(id, frame = 0, { plain = false } = {}) {
  const a = artOf(id);
  if (!a) return null;
  const [w, h, draw, opt0 = {}] = a;
  const opt = plain ? {} : opt0; // plain: no glow, beams or sparkles (the book's grey shapes)
  return sprite(w, h, (b) => draw(b, frame), {
    ground: false, pad: 4,
    after: (b) => {
      if (opt.glow) {
        // a soft warm light round it (dithered, see-through)
        const [gx, gy, gr] = opt.glow;
        for (let y = -3; y < h + 3; y += 1) for (let x = -3; x < w + 3; x += 1) {
          if (b.get(x, y)) continue;
          const d = Math.hypot(x + 0.5 - gx, y + 0.5 - gy) / gr;
          if (d < 1 && bayer(x, y) < 0.55 - d * 0.4) b.set(x, y, 'rgba(255,214,120,0.5)', 'soft');
        }
      }
      if (opt.beams) for (const s of [-1, 1]) for (let i = 1; i < 5; i += 1) for (let j = -1; j <= Math.floor(i / 2); j += 1) { const x = s < 0 ? 1 - i : 9 + i; const y = 7 + j; if (!b.get(x, y) && bayer(x, y) < 0.7 - i * 0.12) b.set(x, y, 'rgba(255,236,160,0.6)', 'soft'); }
      if (opt.sparkle) sparkles(b, frame, opt.sparkle[0], opt.sparkle[1], '#fff6c8');
    },
  });
}

/**
 * A not-yet-found ornament for the book: its shape in two greys (its outline darker), no glow
 * or sparkle, so a kid can guess what it is.
 */
export function ornamentSilhouette(id) {
  const b = ornamentArt(id, 0, { plain: true });
  if (!b) return null;
  b.map((c) => {
    if (!/^#[0-9a-f]{6}$/i.test(c)) return 'transparent';
    const n = parseInt(c.slice(1), 16);
    const lum = (0.3 * (n >> 16) + 0.59 * ((n >> 8) & 255) + 0.11 * (n & 255)) / 255;
    return lum < 0.3 ? '#b4a49c' : lum > 0.8 ? '#e6dccc' : '#d6c8b8';
  });
  b.each((x, y) => { if (b.get(x, y) === 'transparent') b.del(x, y); });
  return b;
}

/** A sprite buffer as a canvas (its pad included), for the sheets and the book. */
export function artCanvas(b, doc = globalThis.document) {
  const c = doc.createElement('canvas');
  c.width = b.W; c.height = b.H;
  const pb = pixelBuffer(b.W, b.H);
  b.blit(pb.px, b.pad, b.pad);
  pb.put(c.getContext('2d'));
  return c;
}

export const ORNAMENT_IDS = Object.keys(ORN);
export const STAR_IDS = Object.keys(STAR);
