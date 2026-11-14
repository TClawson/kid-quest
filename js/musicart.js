// The music house inside, in the village's soft storybook style (style B, like houseart.js):
// warm hue-shifted ramps, ordered dithering and selective outlines, one art pixel per village
// pixel. It has three whole looks, one for each piano the kid earns:
//   1 Cozy Studio (the little keyboard): knotty pine, fairy lights, a cassette 4-track,
//   2 Music Parlor (the upright piano): damask wallpaper, parquet, a reel-to-reel mixing desk,
//   3 Rock Arena (the rock star piano): a stage with flame pipes, light rigs, a big console.
// Every look has the same five stations in the same places (the piano, the sheet music, the
// studio, the Note-o-Matic sound lab and the composing desk), so walking round works the same in each.
//
// paintMusicRoom() paints the room and everything against its walls into one canvas; pieces
// standing out on the floor come back as their own canvases (musichouse.js sorts them with the
// buddy), and life(px, t) paints what moves (lights, flames, meters) on a layer above the room.

import { ramp, mix, h2, vnoise, bayer, grid, inEll, line, pixelBuffer } from './pixelkit.js';
import { sprite, shadow, INK } from './houseart.js';

// ---------- the room's plan (village pixels) ----------

export const MROOM = {
  W: 320, H: 184,
  floorTop: 50, // the back wall stands above this line
  floorBottom: 174, // the front wall's top edge
  door: { x: 148, w: 24 }, // the way out, in the middle of the front wall
  mat: { x: 147, y: 161, w: 26, h: 10 },
};
const R = MROOM;
const FT = R.floorTop;
const FB = R.floorBottom;

// where the composing desk stands on the floor (the same in every look)
const DESK = { x: 240, y: 112 };

// where each station's art goes (its top-left corner), for each look
const AT = {
  1: { sheets: { x: 12, y: 18 }, piano: { x: 136, y: 28 }, studio: { x: 230, y: 20 }, lab: { x: 30, y: 102 } },
  2: { sheets: { x: 12, y: 6 }, piano: { x: 129, y: 14 }, studio: { x: 226, y: 14 }, lab: { x: 30, y: 100 } },
  3: { sheets: { x: 12, y: 8 }, piano: { x: 118, y: 22 }, studio: { x: 226, y: 22 }, lab: { x: 28, y: 96 } },
};

// ---------- colors ----------

const BEAM = ['#2e1e2a', '#46303a', '#5e4044', '#78564e', '#94705e'];
const PINE = ['#4a2a2a', '#6e3e30', '#94583a', '#b8784a', '#d49a60', '#ecc084', '#f8deb0'];
const FL1 = ['#4e2e2a', '#6e4032', '#8e5638', '#a86a42', '#c0844e', '#d8a064', '#ecc088'];
const STEEL = ['#2a2838', '#3e3c50', '#5a586e', '#7e7c92', '#a8a6b8', '#d2d0dc', '#f4f2f8'];
const DARK = ['#16121e', '#221c2c', '#2e2638', '#3c3248', '#4e425c'];
const CREAM = ['#b89a7a', '#d8bc98', '#ecd8b8', '#f8ecd4', '#fffaf0'];
const BRASS = ['#6a3e18', '#986020', '#c88a2a', '#e8b23e', '#f8d870', '#fff4c0'];
const LEAF = ['#244a40', '#33704a', '#4a9450', '#6cb85a', '#9ed46a', '#d0ec8c'];
const SKY = ['#4f8ad8', '#6ea8e8', '#9ccaf4', '#d4ecfc'];
const TEAL = ramp('#2e9a9a', 3, 2);
const BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac', '#ff922b'];
const NOTE = '#3b2a4a';

/** A darker shade of a ramp's color for its outline (selective outlines like houseart.js). */
const dk = (c, k = 0.4) => mix(c.slice(0, 7), INK, k);

// a tiny pixel font (3 x 5) for the few words painted on signs
const FONT = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'], C: ['.##', '#..', '#..', '#..', '.##'], E: ['###', '#..', '##.', '#..', '###'],
  I: ['###', '.#.', '.#.', '.#.', '###'], K: ['#.#', '#.#', '##.', '#.#', '#.#'], L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'], N: ['##.', '#.#', '#.#', '#.#', '#.#'], O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'], R: ['##.', '#.#', '##.', '#.#', '#.#'], S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'], U: ['#.#', '#.#', '#.#', '#.#', '###'], '!': ['#', '#', '#', '.', '#'], ' ': ['..', '..', '..', '..', '..'],
};
/** Paints a word in the tiny font; returns its width. */
function word(put, X, Y, text, c) {
  let x = X;
  for (const ch of text) {
    const g = FONT[ch] || FONT[' '];
    g.forEach((row, y) => { for (let i = 0; i < row.length; i += 1) if (row[i] === '#') put(x + i, Y + y, c); });
    x += g[0].length + 1;
  }
  return x - X - 1;
}

/** A sagging wire between two points (a catenary-ish curve): fn(x, y) for each pixel along it. */
function swag(x0, y0, x1, y1, sag, fn) {
  const n = Math.max(1, Math.abs(x1 - x0));
  let last = null;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t);
    const y = Math.round(y0 + (y1 - y0) * t + sag * 4 * t * (1 - t));
    if (last && Math.abs(y - last[1]) > 1) for (let yy = Math.min(y, last[1]) + 1; yy < Math.max(y, last[1]); yy += 1) fn(x, yy, t);
    fn(x, y, t);
    last = [x, y];
  }
}

// ---------- shared: the side walls, the front wall and its doorway ----------

function frontWalls(px, cap, outside = '#68bf55') {
  const { W, H } = R;
  for (let y = 0; y < H; y += 1) for (let x = 0; x < 6; x += 1) { px(x, y, x === 5 ? cap[1] : x === 0 ? cap[0] : cap[2]); px(W - 1 - x, y, x === 5 ? cap[3] : x === 0 ? cap[0] : cap[2]); }
  const d = R.door;
  for (let y = FB; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (x >= d.x && x < d.x + d.w) continue;
      const yy = y - FB;
      px(x, y, yy === 0 ? cap[4] : yy < 6 ? ((x + yy) % 11 === 0 ? cap[3] : cap[2]) : yy === 6 ? cap[0] : cap[1]);
    }
  }
  for (let y = FB; y < H; y += 1) {
    for (let x = d.x; x < d.x + d.w; x += 1) {
      const yy = y - FB;
      let c = yy < 3 ? (yy === 0 ? '#e2ddde' : '#c0bcc8') : (h2(x, y, 3) < 0.2 ? mix(outside, '#ffffff', 0.15) : outside);
      if (yy >= 3 && bayer(x, y) < 0.3) c = mix(outside, '#ffff80', 0.2);
      px(x, y, c);
    }
  }
  for (let y = FB - 1; y < H; y += 1) { px(d.x - 1, y, cap[3]); px(d.x - 2, y, cap[1]); px(d.x + d.w, y, cap[3]); px(d.x + d.w + 1, y, cap[1]); }
}

/** The doormat inside the door. */
function doormat(px, C) {
  const m = R.mat;
  for (let y = 0; y < m.h; y += 1) for (let x = 0; x < m.w; x += 1) {
    const edge = x === 0 || y === 0 || x === m.w - 1 || y === m.h - 1;
    px(m.x + x, m.y + y, edge ? C[0] : (y === 3 || y === 6) ? C[2] : (x + y) % 2 ? C[1] : mix(C[1], C[0], 0.3));
  }
}

/** Planks running across the floor, 5 px tall, staggered joints and grain. */
function plankFloor(px, P, x0 = 0, x1 = R.W, y0 = FT, y1 = FB) {
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const row = Math.floor((y - FT) / 5); const yy = (y - FT) % 5;
      const off = Math.floor(h2(row, 3, 17) * 40);
      const len = 30 + Math.floor(h2(row, 5, 17) * 22);
      const seg = Math.floor((x + off) / len);
      const at = (x + off) % len;
      const tone = h2(seg, row, 5);
      let k = tone < 0.22 ? 3 : tone > 0.82 ? 5 : 4;
      if (yy === 4) k = 2;
      else if (yy === 0) k += 1;
      else if (vnoise(x * 0.5, y * 3, 6, row) > 0.72) k -= 1;
      if (at === 0 && yy !== 4) k = 2;
      if (h2(seg, row, 9) < 0.08 && at === 9 && yy === 2) k = 1;
      px(x, y, P[Math.max(0, Math.min(P.length - 1, k))]);
    }
  }
}

/** Ambient shadow along the back wall and the sides of the floor. */
function floorShade(px, a = 0.28) {
  for (let y = FT; y < FB; y += 1) {
    for (let x = 0; x < R.W; x += 1) {
      const dy = y - FT;
      if (dy < 6 && bayer(x, y) < (6 - dy) / 7) px(x, y, `rgba(42,24,56,${a})`);
      if ((x < 12 || x > R.W - 12) && bayer(x, y) < (x < 12 ? (12 - x) / 14 : (x - R.W + 12) / 14)) px(x, y, `rgba(42,24,56,${a * 0.7})`);
    }
  }
}

// ---------- 1: the Cozy Studio ----------

function wall1(px) {
  for (let y = 0; y < FT; y += 1) {
    for (let x = 0; x < R.W; x += 1) {
      let c;
      if (y < 5) c = y === 0 ? BEAM[1] : y === 4 ? BEAM[0] : (x + y) % 9 === 0 ? BEAM[3] : BEAM[2];
      else if (y >= FT - 4) c = y === FT - 4 ? PINE[5] : y === FT - 1 ? PINE[0] : PINE[2];
      else {
        // knotty pine boards, 9 px wide, with a groove and a lit edge
        const p = Math.floor(x / 9); const xx = x % 9;
        const tone = h2(p, 0, 31);
        c = tone < 0.3 ? PINE[3] : tone > 0.75 ? PINE[5] : PINE[4];
        if (vnoise(x * 2.5, y * 0.35, 5, p) > 0.7) c = mix(c, PINE[2], 0.45); // grain
        if (xx === 0) c = PINE[1];
        else if (xx === 1) c = mix(c, PINE[6], 0.35);
        const ky = 10 + Math.floor(h2(p, 2, 31) * 28);
        if (h2(p, 1, 31) < 0.45 && inEll(x, y, p * 9 + 5, ky, 1.6, 1.2)) c = inEll(x, y, p * 9 + 5, ky, 0.8, 0.6) ? PINE[1] : PINE[2]; // a knot
        if (y < 10 && bayer(x, y) < (10 - y) / 6) c = mix(c, PINE[1], 0.5); // shadow under the beam
      }
      px(x, y, c);
    }
  }
}

/** A braided rag rug: rings of color round and round. */
function braidRug(px, cx, cy, rx, ry) {
  const C = ['#b04a32', '#d8a038', '#3a8a8a', '#f0dcb0', '#7a4a6a', '#d8a038', '#b04a32'];
  for (let y = Math.floor(cy - ry) - 1; y <= cy + ry + 1; y += 1) {
    for (let x = Math.floor(cx - rx) - 1; x <= cx + rx + 1; x += 1) {
      const r = Math.sqrt(((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2);
      if (r > 1) continue;
      const ring = Math.min(C.length - 1, Math.floor(r * C.length));
      const base = C[ring];
      const stitch = (x * 2 + y * 3 + ring * 5) % 4;
      let c = stitch === 0 ? mix(base, INK, 0.25) : stitch === 2 ? mix(base, '#ffffff', 0.18) : base;
      if (r > 0.96) c = mix(base, INK, 0.45);
      px(x, y, c);
    }
  }
}

/** Fairy lights strung along the top of the back wall; returns where each bulb is. */
function fairyLights(px) {
  const bulbs = [];
  const pts = [[8, 6], [52, 6], [96, 7], [142, 6], [188, 7], [232, 6], [276, 7], [312, 6]];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    let n = 0;
    swag(x0, y0, x1, y1, 7, (x, y) => {
      px(x, y, '#3a2a30');
      if (n % 11 === 5) bulbs.push({ x, y: y + 1, c: BULBS[bulbs.length % BULBS.length] });
      n += 1;
    });
  }
  for (const b of bulbs) {
    px(b.x, b.y, '#5a4a40');
    px(b.x, b.y + 1, mix(b.c, INK, 0.25)); px(b.x, b.y + 2, mix(b.c, INK, 0.35));
  }
  return bulbs;
}

function roundWindow(px, cx, cy) {
  for (let y = cy - 13; y <= cy + 13; y += 1) {
    for (let x = cx - 13; x <= cx + 13; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > 12.5) continue;
      let c;
      if (d > 10.5) c = y < cy ? PINE[5] : PINE[2];
      else if (d > 9.5) c = PINE[1];
      else {
        c = y < cy - 3 ? SKY[1] : y < cy + 3 ? SKY[2] : SKY[3];
        if (inEll(x, y, cx - 3, cy - 3, 4, 1.6) || inEll(x, y, cx, cy - 4, 3, 1.6)) c = '#ffffff';
        if (y > cy + 5 - Math.round(Math.sin(x / 3) * 1.2)) c = y > cy + 7 ? LEAF[2] : LEAF[3];
        if (x === cx || x === cx - 1 || y === cy) c = PINE[3];
      }
      px(x, y, c);
    }
  }
}

/** A poster with a big music note and stars, pinned with tacks. */
function notePoster(px, X, Y) {
  grid(px, X, Y, [
    'rpppppppppppppb',
    'pPPPPPPPPPPPPPd',
    'pPPyPPPPPKKPPPd',
    'pPyYyPPPPKKKPPd',
    'pPPyPPPPPKPKKPd',
    'pPPPPPPPPKPPKPd',
    'pPPPPPPPPKPPPPd',
    'pPPPPPPPPKPPPPd',
    'pPPPPPKKKKPPyPd',
    'pPPPPKKKKKPyYyd',
    'pPPPPKKKKPPPyPd',
    'pPPPPPKKPPPPPPd',
    'pPyPPPPPPPPPPPd',
    'pyYyPPPPPPPPPPd',
    'pPyPPPPPPPPPPPd',
    'pddddddddddddd.',
  ], { r: '#e03131', b: '#4dabf7', p: '#7aa8e8', P: '#9cc4f4', d: '#4a6ab0', K: NOTE, y: '#ffe27a', Y: '#fff6c8' });
}

/** A poster of a rocking guitar with a lightning bolt. */
function guitarPoster(px, X, Y) {
  grid(px, X, Y, [
    'g...............',
    '.oooooooooooooo.',
    '.oOOOOOOOOOOOOd.',
    '.oOOOOOOOOOkkOd.',
    '.oOOOOOOOOkkOOd.',
    '.oOOOyOOOkkOOOd.',
    '.oOOyyOOkkOOOOd.',
    '.oOyyOOkkOOOOOd.',
    '.oOOyyyrrROOOOd.',
    '.oOOOOrRRRrOOOd.',
    '.oOOOyrRwRrOOOd.',
    '.oOOOyrRRRrOOOd.',
    '.oOOyyOrrrOOOOd.',
    '.oOOOOOOOOOOOOd.',
    '.oOOOOOOOOOOOOd.',
    '.oddddddddddddd.',
  ], { g: '#69db7c', o: '#3a2a52', O: '#5a3a82', d: '#2a1a40', k: '#c88a50', y: '#ffe27a', r: '#a51d1d', R: '#e03131', w: '#fff6c8' });
}

/** An acoustic guitar hanging on the wall from a hook. */
function wallGuitar(px, X, Y) {
  const B = ramp('#c8783a', 3, 2);
  for (let y = 0; y < 30; y += 1) {
    for (let x = 0; x < 13; x += 1) {
      let c = null;
      if (y < 4 && x >= 5 && x <= 7) c = y === 0 ? STEEL[3] : B[0]; // the head
      else if (y >= 4 && y < 14 && x >= 5 && x <= 7) c = x === 6 ? '#3a2a20' : B[1]; // the neck
      else if (inEll(x, y, 6.5, 17.5, 4.5, 4) || inEll(x, y, 6.5, 24.5, 6.5, 5.5)) {
        c = x < 4 ? B[4] : x > 9 ? B[2] : B[3];
        if (inEll(x, y, 6.5, 20.5, 1.8, 1.8)) c = '#2a1a14';
        if (y === 25 && x > 3 && x < 10) c = B[0];
      }
      if (c) px(X + x, Y + y, c);
    }
  }
  px(X + 6, Y - 2, STEEL[4]); px(X + 6, Y - 1, STEEL[2]);
  for (let y = 0; y < 25; y += 1) if (y > 3) px(X + 6, Y + y, y % 3 ? '#e8e0d0' : '#c8c0b0');
}

/** Egg-crate sound foam on the wall: little pyramids in rows. */
function foam(px, X, Y, w, h, base = '#5a6a8a') {
  const F = ramp(base, 2, 2);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const cx = x % 6; const cy = y % 6;
    let c = F[2];
    if (cx + cy < 3) c = F[4]; else if (cx + cy > 7) c = F[0]; else if (cx > cy + 1) c = F[1]; else if (cy > cx + 1) c = F[3];
    if (x === 0 || y === 0) c = F[3];
    if (x === w - 1 || y === h - 1) c = F[0];
    px(X + x, Y + y, c);
  }
}

/**
 * A brass horn (a gramophone bell): a neck at (nx, ny) flaring out to a bell at (bx, by) whose
 * mouth opens upward, radius r at the bell.
 */
function horn(b, nx, ny, bx, by, r, P = BRASS) {
  const steps = 60;
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const cx = nx + (bx - nx) * t; const cy = ny + (by - ny) * Math.sqrt(t);
    const rr = 0.9 + (r - 0.9) * t ** 2.4;
    for (let y = Math.floor(cy - rr); y <= cy + rr; y += 1) for (let x = Math.floor(cx - rr); x <= cx + rr; x += 1) {
      if (!inEll(x, y, cx, cy, rr, rr * (0.55 + 0.45 * (1 - t)))) continue;
      const side = (x + 0.5 - cx) / rr;
      b.set(x, y, side < -0.45 ? P[5] : side < 0 ? P[4] : side < 0.5 ? P[3] : P[2]);
    }
  }
  // the mouth, open to the sky
  for (let y = Math.floor(by - r); y <= by + r; y += 1) for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x += 1) {
    if (!inEll(x, y, bx, by - r * 0.35, r + 0.6, r * 0.42 + 0.6)) continue;
    const inner = inEll(x, y, bx, by - r * 0.35, r - 1.2, r * 0.42 - 0.8);
    b.set(x, y, inner ? (y < by - r * 0.35 ? P[0] : P[1]) : (x < bx ? P[5] : P[3]));
  }
}

/** The little keyboard on its X stand, with a page of music on its rest. */
function keyboardArt() {
  const C = ramp('#495057', 3, 2);
  return sprite(48, 36, (b) => {
    // the music rest and a page on it
    b.rect(14, 0, 20, 11, CREAM[3]); b.rect(14, 0, 20, 1, CREAM[4]); b.rect(33, 0, 1, 11, CREAM[1]);
    for (const ly of [2, 5, 8]) for (let x = 15; x < 33; x += 1) b.set(x, ly, x % 4 === 0 ? NOTE : CREAM[1]);
    for (const [x, y] of [[17, 1], [21, 4], [25, 3], [29, 7], [19, 7]]) { b.set(x, y, NOTE); b.set(x + 1, y, NOTE); b.set(x + 1, y - 1, NOTE); }
    b.rect(12, 10, 24, 2, C[1]);
    // the body: the top panel with knobs, lights and speaker grilles
    b.rect(0, 11, 48, 5, C[2]); b.rect(0, 11, 48, 1, C[4]); b.rect(0, 15, 48, 1, C[1]);
    for (let x = 2; x < 10; x += 1) for (let y = 12; y < 15; y += 1) b.set(x, y, (x + y) % 2 ? C[0] : C[1]);
    for (let x = 38; x < 46; x += 1) for (let y = 12; y < 15; y += 1) b.set(x, y, (x + y) % 2 ? C[0] : C[1]);
    b.rect(13, 12, 9, 3, '#1e3a2e'); b.rect(14, 13, 5, 1, '#69db7c'); // a little screen
    b.set(25, 13, '#ff6b6b'); b.set(28, 13, '#69db7c'); b.set(31, 13, '#ffd43b'); b.set(34, 13, '#4dabf7');
    // the keys: 15 white keys with black keys between
    const kx = 1;
    for (let i = 0; i < 15; i += 1) {
      for (let y = 16; y < 23; y += 1) {
        b.set(kx + i * 3, y, y === 22 ? CREAM[1] : CREAM[4]); b.set(kx + i * 3 + 1, y, y === 22 ? CREAM[1] : CREAM[3]);
        b.set(kx + i * 3 + 2, y, CREAM[0]);
      }
    }
    for (let i = 0; i < 14; i += 1) {
      if ([2, 6, 9, 13].includes(i)) continue;
      for (let y = 16; y < 20; y += 1) { b.set(kx + i * 3 + 2, y, DARK[1]); b.set(kx + i * 3 + 3, y, y === 16 ? DARK[3] : DARK[1]); }
    }
    b.rect(0, 16, 1, 7, C[1]); b.rect(47, 16, 1, 7, C[0]);
    b.rect(0, 23, 48, 2, C[1]); b.rect(0, 23, 48, 1, C[2]);
    // the X stand
    line(10, 25, 22, 35, (x, y) => { b.set(x, y, STEEL[1]); b.set(x + 1, y, STEEL[3]); });
    line(22, 25, 10, 35, (x, y) => { b.set(x, y, STEEL[1]); b.set(x + 1, y, STEEL[3]); });
    line(26, 25, 38, 35, (x, y) => { b.set(x, y, STEEL[1]); b.set(x + 1, y, STEEL[3]); });
    line(38, 25, 26, 35, (x, y) => { b.set(x, y, STEEL[1]); b.set(x + 1, y, STEEL[3]); });
  });
}

/** The studio desk: a cassette 4-track, a little mic, two speakers and headphones. */
function desk1Art() {
  const W = ['#4a2a2a', '#6e4030', '#96603e', '#ba8250', '#d8a468', '#f0c890'];
  return sprite(78, 44, (b) => {
    // the desk
    b.rect(0, 24, 78, 5, W[4]); b.rect(0, 24, 78, 1, W[5]); b.rect(0, 28, 78, 1, W[3]);
    b.rect(0, 29, 78, 5, W[2]); b.rect(0, 33, 78, 1, W[1]);
    b.rect(30, 30, 18, 3, W[3]); b.set(38, 31, BRASS[4]); b.set(39, 31, BRASS[3]);
    for (const lx of [1, 73]) { b.rect(lx, 34, 4, 10, W[2]); b.rect(lx, 34, 1, 10, W[3]); b.rect(lx + 3, 34, 1, 10, W[1]); }
    // speakers
    for (const sx of [2, 64]) {
      b.rect(sx, 8, 12, 17, DARK[2]); b.rect(sx, 8, 12, 1, DARK[4]); b.rect(sx + 11, 8, 1, 17, DARK[0]);
      for (let y = 0; y < 17; y += 1) for (let x = 0; x < 12; x += 1) {
        if (inEll(x, y, 6, 12, 4, 4)) b.set(sx + x, 8 + y, inEll(x, y, 6, 12, 1.6, 1.6) ? STEEL[4] : inEll(x, y, 6, 12, 3, 3) ? DARK[0] : STEEL[1]);
        if (inEll(x, y, 6, 4, 2, 2)) b.set(sx + x, 8 + y, inEll(x, y, 6, 4, 1, 1) ? STEEL[5] : STEEL[1]);
      }
    }
    // the cassette 4-track: a silver box with a tape window, four faders and buttons
    b.rect(20, 13, 38, 11, STEEL[4]); b.rect(20, 13, 38, 1, STEEL[6]); b.rect(20, 23, 38, 1, STEEL[2]); b.rect(57, 13, 1, 11, STEEL[2]);
    b.rect(22, 15, 14, 6, DARK[1]);
    for (const rx of [25, 32]) for (let y = 15; y < 21; y += 1) for (let x = rx - 2; x <= rx + 2; x += 1) if (inEll(x, y, rx + 0.5, 18, 2.2, 2.2)) b.set(x, y, inEll(x, y, rx + 0.5, 18, 0.9, 0.9) ? STEEL[5] : '#6a4030');
    b.rect(23, 21, 12, 1, STEEL[3]);
    for (let i = 0; i < 4; i += 1) { const fx = 39 + i * 4; b.rect(fx, 15, 1, 6, DARK[0]); b.rect(fx - 1, 16 + ((i * 3) % 4), 3, 2, i === 3 ? '#e03131' : DARK[3]); }
    b.set(54, 15, '#e03131'); b.set(54, 18, '#69db7c'); b.set(54, 21, STEEL[1]);
    // a little desk mic
    b.rect(16, 21, 3, 3, DARK[2]); b.rect(17, 12, 1, 9, STEEL[2]);
    for (let y = 6; y < 13; y += 1) for (let x = 14; x < 21; x += 1) if (inEll(x, y, 17.5, 9.5, 3, 3.4)) b.set(x, y, (x + y) % 2 ? STEEL[3] : STEEL[5]);
    // headphones hanging off the front edge, and a mug
    for (let y = 24; y < 33; y += 1) for (let x = 60; x < 70; x += 1) if (inEll(x, y, 65, 28, 4.5, 4.5) && !inEll(x, y, 65, 28, 3.3, 3.3) && y < 29) b.set(x, y, '#e03131');
    b.rect(59, 28, 3, 5, DARK[2]); b.rect(68, 28, 3, 5, DARK[2]);
    b.rect(8, 26, 5, 5, '#f8f4e8'); b.rect(8, 26, 5, 1, '#6a4030'); b.set(13, 27, '#f8f4e8'); b.set(13, 28, '#d8d0c0'); b.set(10, 29, '#e03131');
  });
}

/** The sheet music corner: a milk crate of songbooks and a wire music stand with an open book. */
function sheets1Art() {
  const CR = ramp('#3e7ab8', 3, 2);
  const SP = ['#e03131', '#f0a848', '#4a9a50', '#7a4ab0', '#e0709a', '#3e6ab0', '#e8c840'];
  return sprite(46, 48, (b) => {
    // songbooks standing in the crate
    for (let i = 0; i < 6; i += 1) {
      const x = 2 + i * 3; const top = 26 + (i % 3);
      const S = ramp(SP[i], 1, 1);
      for (let y = top; y < 36; y += 1) { b.set(x, y, S[2]); b.set(x + 1, y, S[1]); b.set(x + 2, y, S[0]); }
      b.set(x + 1, top + 2, '#fff6c8');
    }
    // the crate: blue plastic with holes
    for (let y = 33; y < 48; y += 1) for (let x = 0; x < 22; x += 1) {
      let c = x === 0 ? CR[4] : x === 21 ? CR[1] : CR[3];
      if (y === 33) c = CR[5];
      if (y === 47) c = CR[1];
      if (x > 1 && x < 20 && y > 35 && y < 45 && (x % 4 === 2 || x % 4 === 3) && (y % 4 === 1 || y % 4 === 2)) c = CR[1];
      b.set(x, y, c);
    }
    // the music stand: tripod, shaft, and a tray holding an open book
    for (let y = 18; y < 42; y += 1) { b.set(34, y, STEEL[1]); b.set(35, y, STEEL[3]); }
    line(34, 41, 27, 47, (x, y) => b.set(x, y, STEEL[1]));
    line(35, 41, 42, 47, (x, y) => b.set(x, y, STEEL[2]));
    b.set(34, 47, STEEL[1]); b.set(35, 46, STEEL[1]);
    for (let y = 2; y < 18; y += 1) for (let x = 24; x < 46; x += 1) {
      let c = x < 35 ? CREAM[4] : CREAM[3];
      if (x === 34 || x === 35) c = CREAM[1];
      if (x === 24 || x === 45) c = '#a8443a';
      if (y === 2) c = x < 35 ? CREAM[4] : CREAM[3];
      if ([5, 8, 11, 14].includes(y) && x > 25 && x < 44 && x !== 34 && x !== 35) c = h2(x, y, 3) < 0.3 ? NOTE : '#b8a890';
      b.set(x, y, c);
    }
    b.rect(23, 17, 24, 2, STEEL[2]); b.rect(23, 17, 24, 1, STEEL[4]);
  });
}

/** The Note-o-Matic: a homemade box on wheels with a brass horn, dials and a screen. */
function lab1Art() {
  return sprite(40, 44, (b) => {
    // the horn: a brass bell up top, its neck down into the box
    horn(b, 13, 18, 8, 7, 7);
    // the antenna
    for (let y = 4; y < 18; y += 1) b.set(33, y, STEEL[2]);
    b.rect(32, 2, 3, 3, '#e03131'); b.set(32, 2, '#ff8a8a');
    // the box: teal paint on wooden boards
    for (let y = 17; y < 40; y += 1) for (let x = 2; x < 37; x += 1) {
      let c = x === 2 ? TEAL[4] : x === 36 ? TEAL[1] : TEAL[3];
      if (y === 17) c = TEAL[5];
      if (y === 39) c = TEAL[1];
      if ((y - 17) % 8 === 7 && x > 2 && x < 36) c = TEAL[2];
      b.set(x, y, c);
    }
    // the screen and dials
    b.rect(5, 20, 16, 9, DARK[0]); b.rect(5, 20, 16, 1, DARK[2]);
    for (let x = 6; x < 20; x += 1) b.set(x, 24 + Math.round(Math.sin(x * 0.9) * 2), '#3a7a4a');
    for (const [dx, col] of [[25, '#e03131'], [31, '#ffd43b']]) {
      for (let y = 19; y < 27; y += 1) for (let x = dx - 3; x <= dx + 3; x += 1) if (inEll(x, y, dx + 0.5, 23, 3.2, 3.2)) b.set(x, y, inEll(x, y, dx - 0.5, 22, 1.4, 1.4) ? mix(col, '#ffffff', 0.4) : col);
      b.set(dx, 21, INK); b.set(dx, 22, INK);
    }
    for (let i = 0; i < 4; i += 1) b.rect(6 + i * 4, 31, 3, 2, ['#ff6b6b', '#69db7c', '#4dabf7', '#ffd43b'][i]);
    // the slot, and a strip of paper with notes curling out of it
    b.rect(24, 32, 10, 2, DARK[1]);
    for (let y = 33; y < 43; y += 1) { const x = 33 + Math.round((y - 33) * 0.45); b.set(x, y, CREAM[4]); b.set(x + 1, y, CREAM[3]); b.set(x + 2, y, CREAM[2]); if (y % 3 === 0) b.set(x + 1, y, NOTE); }
    // wheels
    for (const wx of [8, 30]) for (let y = 38; y < 44; y += 1) for (let x = wx - 3; x <= wx + 3; x += 1) if (inEll(x, y, wx + 0.5, 40.5, 3, 3)) b.set(x, y, inEll(x, y, wx + 0.5, 40.5, 1, 1) ? STEEL[4] : DARK[2]);
  });
}

/** A monstera in a pot. */
function plantArt() {
  return sprite(22, 32, (b) => {
    const leaves = [[11, 6, 7, 5], [5, 12, 6, 4], [16, 13, 6, 4], [11, 15, 5, 4]];
    for (const [cx, cy, rx, ry] of leaves) for (let y = cy - ry; y <= cy + ry; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) {
      if (!inEll(x, y, cx, cy, rx, ry)) continue;
      let c = x < cx ? LEAF[4] : LEAF[3];
      if (x === cx) c = LEAF[2];
      if ((x + y) % 5 === 0 && Math.abs(x - cx) > 2) c = null; // monstera holes
      if (c) b.set(x, y, c);
    }
    for (let y = 18; y < 22; y += 1) b.set(11, y, LEAF[1]);
    const P = ramp('#d0704a', 2, 2);
    for (let y = 21; y < 32; y += 1) for (let x = 4; x < 18; x += 1) {
      const inset = Math.floor((y - 21) / 4);
      if (x < 4 + inset || x > 17 - inset) continue;
      b.set(x, y, y < 23 ? P[3] : x < 8 ? P[3] : x > 14 ? P[1] : P[2]);
    }
  });
}

/** A couple of cardboard boxes, one with a music note drawn on it. */
function boxesArt() {
  const K = ['#7a5434', '#a0703e', '#c49058', '#dcae74', '#f0cc98'];
  return sprite(26, 28, (b) => {
    const box = (x0, y0, w, h) => {
      for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) {
        let c = y < y0 + 4 ? (y === y0 ? K[4] : K[3]) : x === x0 + w - 1 ? K[1] : K[2];
        if (y === y0 + 4) c = K[1];
        if (x === x0 + Math.floor(w / 2) && y < y0 + 4) c = K[1];
        b.set(x, y, c);
      }
    };
    box(0, 10, 26, 18); box(4, 0, 16, 11);
    grid((x, y, c) => b.set(x, y, c), 10, 17, ['..KK', '..KKK', '..K.K', 'KKK..', 'KKK..'], { K: NOTE });
  });
}

// ---------- the composing desk, in each look ----------

/** Manuscript paper on a desk top: a cream page with two staves and a few notes (x, y: its top-left corner). */
function manuscript(b, X, Y, w = 16, h = 7, paper = CREAM) {
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) b.set(X + x, Y + y, y === 0 ? paper[4] : x === w - 1 ? paper[1] : paper[3]);
  for (const ly of [2, 4]) for (let x = 1; x < w - 1; x += 1) b.set(X + x, Y + ly, '#b8a890');
  for (const [x, y] of [[3, 1], [6, 3], [9, 2], [12, 4]]) if (x < w - 1) { b.set(X + x, Y + y, NOTE); b.set(X + x + 1, Y + y, NOTE); b.set(X + x + 1, Y + y - 1, NOTE); }
}

/** The Cozy Studio's composing desk: a little pine desk with a pad of music paper, a pencil jar and a yellow lamp. */
function compose1Art() {
  const W = ['#4a2a2a', '#6e4030', '#96603e', '#ba8250', '#d8a468', '#f0c890'];
  const Y = ramp('#f0b429', 3, 2);
  return sprite(40, 38, (b) => {
    // the lamp: a bendy arm from a round foot up to a yellow shade
    for (let x = 28; x < 36; x += 1) b.set(x, 18, x < 31 ? Y[4] : Y[2]);
    line(31, 17, 34, 9, (x, y) => b.set(x, y, Y[2]));
    line(34, 9, 27, 4, (x, y) => b.set(x, y, Y[2]));
    for (let y = 2; y < 9; y += 1) for (let x = 22; x < 31; x += 1) if (inEll(x, y, 26, 7, 4.5, 4) && y < 8) b.set(x, y, y < 4 ? Y[5] : x < 25 ? Y[4] : Y[3]);
    b.rect(23, 8, 7, 1, '#fff6c8');
    // the desk top and its drawer
    b.rect(0, 19, 40, 3, W[4]); b.rect(0, 19, 40, 1, W[5]); b.rect(0, 21, 40, 1, W[3]);
    b.rect(2, 22, 36, 5, W[2]); b.rect(2, 26, 36, 1, W[1]);
    b.rect(16, 23, 8, 3, W[3]); b.set(19, 24, BRASS[4]); b.set(20, 24, BRASS[3]);
    for (const lx of [2, 35]) { b.rect(lx, 27, 3, 11, W[2]); b.rect(lx, 27, 1, 11, W[3]); b.rect(lx + 2, 27, 1, 11, W[1]); }
    // the music pad, a pencil on it, and a jar of pencils
    manuscript(b, 7, 12, 17, 7);
    line(16, 15, 22, 11, (x, y) => b.set(x, y, '#f0a848'));
    b.set(22, 11, '#e0709a'); b.set(15, 16, DARK[2]);
    b.rect(2, 13, 4, 6, STEEL[4]); b.rect(2, 13, 4, 1, STEEL[6]); b.rect(5, 13, 1, 6, STEEL[2]);
    for (const [x, c] of [[2, '#e03131'], [3, '#4a9a50'], [4, '#3e6ab0']]) for (let y = 9; y < 13; y += 1) b.set(x + (y < 11 ? x - 3 : 0) * 0, y, c);
  });
}

/** The Music Parlor's composing desk: a mahogany writing desk with gold trim, an inkwell and quill and a candle. */
function compose2Art() {
  const M = ['#2a1012', '#46201c', '#64302a', '#84443a', '#a45c48', '#c47a5e'];
  return sprite(42, 38, (b) => {
    // a little shelf of pigeonholes at the back
    b.rect(4, 4, 34, 13, M[2]); b.rect(4, 4, 34, 1, M[5]); b.rect(37, 4, 1, 13, M[1]);
    for (let i = 0; i < 4; i += 1) { b.rect(6 + i * 8, 6, 6, 5, M[0]); b.rect(6 + i * 8, 6, 6, 1, M[1]); }
    for (const [i, c] of [[0, CREAM[3]], [2, CREAM[4]], [3, '#e8c840']]) b.rect(7 + i * 8, 8, 4, 3, c);
    b.rect(4, 4, 34, 1, GOLDS[4]);
    // the desk top with a gold edge, and a drawer
    b.rect(0, 17, 42, 3, M[4]); b.rect(0, 17, 42, 1, GOLDS[4]); b.rect(0, 19, 42, 1, M[3]);
    b.rect(2, 20, 38, 6, M[2]); b.rect(2, 25, 38, 1, M[1]);
    b.rect(15, 21, 12, 3, M[3]); b.set(20, 22, GOLDS[4]); b.set(21, 22, GOLDS[3]);
    // curvy legs
    for (const [lx, d] of [[3, 1], [37, -1]]) for (let y = 26; y < 38; y += 1) { const x = lx + Math.round(Math.sin((y - 26) / 3.5) * d); b.set(x, y, M[3]); b.set(x + 1, y, M[1]); }
    // the manuscript, an inkwell with a quill, a candle
    manuscript(b, 10, 11, 16, 6, CREAM);
    b.rect(29, 13, 4, 4, DARK[1]); b.rect(29, 13, 4, 1, DARK[3]); b.set(30, 14, '#3e3a8a');
    line(31, 13, 36, 3, (x, y) => b.set(x, y, '#fffaf0'));
    line(32, 12, 37, 4, (x, y) => b.set(x, y, '#e8e0d0'));
    b.rect(5, 12, 3, 5, '#fff6e0'); b.rect(4, 16, 5, 1, GOLDS[3]); b.set(6, 11, INK);
  });
}

/** The Rock Arena's composing desk: a black desk with a neon edge, a glowing note pad and a neon lamp. */
function compose3Art() {
  return sprite(42, 38, (b) => {
    // the neon lamp's arm and head
    line(36, 18, 36, 6, (x, y) => b.set(x, y, STEEL[2]));
    line(36, 6, 30, 3, (x, y) => b.set(x, y, STEEL[2]));
    b.rect(24, 2, 8, 3, DARK[2]); b.rect(24, 4, 8, 1, NEON.cyan);
    // the screen pad on a stand
    b.rect(8, 6, 22, 12, DARK[0]); b.rect(8, 6, 22, 1, DARK[3]); b.rect(29, 6, 1, 12, DARK[2]);
    for (const ly of [9, 11, 13, 15]) for (let x = 10; x < 28; x += 1) b.set(x, ly, 'rgba(160,110,255,0.55)');
    b.rect(18, 18, 2, 1, STEEL[3]);
    // the desk: black with a pink neon edge, on two chunky legs
    b.rect(0, 19, 42, 3, DARK[3]); b.rect(0, 19, 42, 1, NEON.pink); b.rect(0, 21, 42, 1, DARK[1]);
    b.rect(2, 22, 38, 4, DARK[2]); b.rect(2, 25, 38, 1, DARK[0]);
    for (const lx of [3, 34]) { b.rect(lx, 26, 5, 12, DARK[2]); b.rect(lx, 26, 1, 12, DARK[4]); b.rect(lx + 4, 26, 1, 12, DARK[0]); }
    // headphones lying on the desk
    for (let y = 13; y < 19; y += 1) for (let x = 0; x < 8; x += 1) if (inEll(x, y, 4, 18, 3.6, 4.5) && !inEll(x, y, 4, 18, 2.4, 3.3)) b.set(x, y, NEON.lime);
  });
}

// ---------- 2: the Music Parlor ----------

const WAL = ['#2a1418', '#46222a', '#6a3630', '#8a4c38', '#a86a48', '#c88c5e', '#e4b07c'];
const DAMASK = ramp('#2e6a62', 3, 2);
const VELVET = ramp('#a8243a', 3, 2);
const GOLDS = ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];

function wall2(px) {
  for (let y = 0; y < FT; y += 1) {
    for (let x = 0; x < R.W; x += 1) {
      let c;
      if (y < 6) c = y === 0 ? CREAM[1] : y === 1 ? CREAM[4] : y === 2 ? CREAM[3] : y === 3 ? GOLDS[3] : y === 4 ? CREAM[2] : CREAM[0];
      else if (y >= FT - 4) c = y === FT - 4 ? WAL[5] : y === FT - 1 ? WAL[0] : WAL[2];
      else if (y >= FT - 19) {
        // the wainscot: a rail, then raised walnut panels
        const yy = y - (FT - 19);
        if (yy === 0) c = WAL[6]; else if (yy === 1) c = WAL[4]; else if (yy === 2) c = WAL[1];
        else {
          const px0 = x % 26; const py = yy - 3;
          c = WAL[3];
          if (px0 >= 3 && px0 <= 22 && py >= 2 && py <= 10) c = px0 === 3 || py === 2 ? WAL[1] : px0 === 22 || py === 10 ? WAL[5] : WAL[4];
          if (px0 === 0) c = WAL[2];
        }
      } else {
        // damask wallpaper: deep green with little gold lilies on a diamond grid
        const gx = x % 14; const gy = (y - 6) % 16;
        const ox = (Math.floor((y - 6) / 16) % 2) * 7;
        const lx = (x + ox) % 14 - 7; const ly = gy - 8;
        c = (x + y) % 2 ? DAMASK[3] : DAMASK[2];
        if (gx === 0 && gy % 2 === 0) c = DAMASK[2];
        const lily = (Math.abs(lx) + Math.abs(ly) === 4) || (lx === 0 && Math.abs(ly) <= 2) || (ly === 0 && Math.abs(lx) <= 1) || (Math.abs(lx) === 1 && ly === -2);
        if (lily) c = Math.abs(lx) + Math.abs(ly) === 4 ? DAMASK[4] : GOLDS[2];
        if (y < 10 && bayer(x, y) < (10 - y) / 6) c = mix(c, DAMASK[0], 0.5);
      }
      px(x, y, c);
    }
  }
}

/** A parquet floor: squares of four slats, turning each way in turn. */
function parquet(px) {
  const P = ['#5e3426', '#7e4a30', '#9e6238', '#b87a46', '#cc9258', '#e0ae74'];
  for (let y = FT; y < FB; y += 1) for (let x = 0; x < R.W; x += 1) {
    const sx = Math.floor(x / 8); const sy = Math.floor((y - FT) / 8);
    const lx = x % 8; const ly = (y - FT) % 8;
    const across = (sx + sy) % 2 === 0;
    const slat = across ? Math.floor(ly / 2) : Math.floor(lx / 2);
    const along = across ? lx : ly;
    const tone = h2(sx * 4 + slat, sy, 13);
    let k = tone < 0.3 ? 2 : tone > 0.75 ? 4 : 3;
    if ((across ? ly : lx) % 2 === 1) k -= 1;
    if (along === 0) k = 1;
    if (lx === 7 && ly === 7) k = 0;
    px(x, y, P[Math.max(0, k)]);
  }
}

/** A big Persian rug: a red field, a navy and gold border, a medallion, a fringe. */
function persianRug(px, X, Y, w, h) {
  const RD = ramp('#9a2a36', 2, 2); const NV = ramp('#2a3a6a', 2, 2);
  for (let y = 0; y < h; y += 1) for (let x = -3; x < w + 3; x += 1) {
    if (x < 0 || x >= w) { if (y % 2 === 0 && y > 1 && y < h - 2) px(X + x, Y + y, CREAM[3]); continue; }
    const e = Math.min(x, y, w - 1 - x, h - 1 - y);
    let c;
    if (e === 0) c = NV[0];
    else if (e < 5) {
      c = NV[2];
      if (e === 1 || e === 4) c = GOLDS[2];
      else if ((x + y) % 4 === 0) c = RD[3];
    } else if (e < 7) c = e === 5 ? GOLDS[3] : RD[1];
    else {
      c = (x * 3 + y * 5) % 7 === 0 ? RD[1] : RD[2];
      const dx = Math.abs(x + 0.5 - w / 2) / (w / 2 - 7); const dy = Math.abs(y + 0.5 - h / 2) / (h / 2 - 7);
      const d = dx + dy;
      if (d < 0.5) c = d < 0.2 ? GOLDS[4] : d < 0.28 ? NV[2] : d < 0.42 ? GOLDS[2] : (x + y) % 2 ? NV[3] : NV[2];
      else if (Math.abs(d - 0.62) < 0.04) c = GOLDS[3];
      // corner flowers
      for (const [cx, cy] of [[12, 10], [w - 13, 10], [12, h - 11], [w - 13, h - 11]]) if (Math.abs(x - cx) + Math.abs(y - cy) <= 2) c = Math.abs(x - cx) + Math.abs(y - cy) === 0 ? GOLDS[4] : NV[3];
    }
    px(X + x, Y + y, c);
  }
}

/** A tall arched window with red velvet curtains and gold tie-backs. */
function parlorWindow(px, X, Y) {
  const w = 28; const h = 38;
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const arch = y < 14 ? inEll(x, y, w / 2, 14, w / 2, 14) : true;
    if (!arch) continue;
    const inner = y < 14 ? inEll(x, y, w / 2, 14, w / 2 - 3, 11) : x >= 3 && x < w - 3 && y < h - 3;
    let c;
    if (!inner) c = x < 3 || y < 8 ? CREAM[4] : CREAM[2];
    else {
      c = y < 14 ? SKY[1] : y < 24 ? SKY[2] : SKY[3];
      if (inEll(x, y, 9, 17, 4, 1.6) || inEll(x, y, 12, 16, 3, 1.4)) c = '#ffffff';
      if (y > 28 - Math.round(Math.sin(x / 3) * 1.5)) c = y > 31 ? LEAF[2] : LEAF[3];
      if (x === 13 || x === 14 || y === 22) c = CREAM[3];
    }
    px(X + x, Y + y, c);
  }
  for (let x = -2; x < w + 2; x += 1) { px(X + x, Y + h - 3, CREAM[4]); px(X + x, Y + h - 2, CREAM[2]); px(X + x, Y + h - 1, WAL[1]); }
  // curtains
  for (let y = 0; y < h + 2; y += 1) {
    const tie = y > 22 && y < 26;
    const wl = y < 4 ? 8 : tie ? 3 : y < 22 ? 6 - Math.floor((y - 4) / 6) : 4 + Math.floor((y - 26) / 5);
    for (let i = 0; i < wl; i += 1) {
      const c = i === 0 ? VELVET[1] : (i + Math.floor(y / 2)) % 3 === 0 ? VELVET[2] : VELVET[3];
      px(X - 3 + i, Y + y, c); px(X + w + 2 - i, Y + y, i === 0 ? VELVET[0] : c);
    }
    if (tie) { px(X - 1, Y + y, GOLDS[3]); px(X + w, Y + y, GOLDS[3]); }
  }
  for (let x = -5; x < w + 5; x += 1) { px(X + x, Y - 2, GOLDS[2]); px(X + x, Y - 1, GOLDS[4]); }
}

/** A portrait in a gold frame: a buddy in a ruff, playing the violin, very serious. */
function portrait(px, X, Y) {
  grid(px, X, Y, [
    'GGGGGGGGGGGGGGGG',
    'GgggggggggggggdG',
    'GgBBBBBBBBBBBBdG',
    'GgBBBBoooBBBBBdG',
    'GgBBBoOOOoBBBBdG',
    'GgBBBoOkOkoBBBdG',
    'GgBBBoOOnOoBBBdG',
    'GgBBBBoOOoBBBBdG',
    'GgBBBwwwwwwBBBdG',
    'GgBBwwWWWWwwvBdG',
    'GgBBpppppppvvBdG',
    'GgBpppppppvpvBdG',
    'GgBppppppvpppBdG',
    'GgBpppppppppppdG',
    'GddddddddddddddG',
    'GGGGGGGGGGGGGGGG',
  ], { G: GOLDS[3], g: GOLDS[4], d: GOLDS[1], B: '#3a2a3a', o: '#a8582a', O: '#e8823a', k: INK, n: '#2a1a14', w: '#f8f4e8', W: '#ffffff', p: '#5a2a5a', v: '#b4733e' });
}

/** A candle sconce on the wall: a brass arm and a candle (the flame is on the live layer). */
function sconce(px, X, Y) {
  grid(px, X, Y, ['..W..', '..W..', '.WWw.', '.bBb.', 'bbBbb', '..b..', '.bBb.', '..B..'], { W: '#fff8e0', w: '#e8d8b8', b: BRASS[2], B: BRASS[4] });
}

/** A framed gold record. */
function goldRecord(px, X, Y, plat = false) {
  const D = plat ? ['#8a8aa0', '#b8b8c8', '#e0e0ec', '#ffffff'] : [GOLDS[1], GOLDS[2], GOLDS[3], GOLDS[5]];
  for (let y = 0; y < 14; y += 1) for (let x = 0; x < 14; x += 1) {
    let c = x === 0 || y === 0 ? '#4a3a4a' : x === 13 || y === 13 ? '#1e1626' : '#2a2034';
    if (inEll(x, y, 7, 7, 5.5, 5.5)) {
      c = (Math.round(Math.hypot(x + 0.5 - 7, y + 0.5 - 7)) % 2) ? D[1] : D[2];
      if (inEll(x, y, 5.5, 5.5, 1.5, 1.2)) c = D[3];
      if (inEll(x, y, 7, 7, 1.6, 1.6)) c = '#e03131';
    }
    px(X + x, Y + y, c);
  }
}

/** The upright piano: walnut, a carved front, candles, music on the rest, and its bench. */
function uprightArt() {
  return sprite(60, 62, (b) => {
    const P = WAL;
    // the lid and the upper case
    b.rect(0, 0, 60, 2, P[5]); b.rect(0, 2, 60, 1, P[3]);
    for (let y = 3; y < 26; y += 1) for (let x = 0; x < 60; x += 1) {
      let c = x < 2 ? P[4] : x > 57 ? P[1] : P[3];
      // a carved panel with a fretwork of swirls
      if (x >= 6 && x <= 53 && y >= 5 && y <= 23) {
        c = x === 6 || y === 5 ? P[1] : x === 53 || y === 23 ? P[5] : P[2];
        if (x > 8 && x < 51 && y > 7 && y < 21 && (Math.round(Math.sin(x * 0.5) * 3 + 14) === y || Math.round(Math.cos(x * 0.5) * 3 + 14) === y)) c = GOLDS[1];
      }
      b.set(x, y, c);
    }
    // music on the rest
    for (let y = 8; y < 20; y += 1) for (let x = 18; x < 42; x += 1) {
      let c = x < 30 ? CREAM[4] : CREAM[3];
      if (x === 29 || x === 30) c = CREAM[1];
      if ([10, 13, 16].includes(y) && x > 19 && x < 40 && x !== 29 && x !== 30) c = h2(x, y, 7) < 0.3 ? NOTE : '#b8a890';
      b.set(x, y, c);
    }
    b.rect(16, 20, 28, 2, P[1]); b.rect(16, 20, 28, 1, P[4]);
    // candle holders on swinging brass arms
    for (const cx of [3, 54]) { b.rect(cx, 13, 3, 1, BRASS[3]); b.rect(cx, 11, 3, 2, '#fff8e0'); b.set(cx + 2, 12, '#e8d8b8'); b.rect(cx - 1, 14, 5, 1, BRASS[2]); }
    // the fallboard with a gold name, then the keys
    b.rect(0, 26, 60, 3, P[2]); b.rect(0, 26, 60, 1, P[4]); b.rect(26, 27, 8, 1, GOLDS[3]);
    for (let i = 0; i < 19; i += 1) for (let y = 29; y < 35; y += 1) {
      const x = 2 + i * 3;
      b.set(x, y, y === 34 ? CREAM[1] : CREAM[4]); b.set(x + 1, y, y === 34 ? CREAM[1] : CREAM[3]); b.set(x + 2, y, CREAM[0]);
    }
    for (let i = 0; i < 18; i += 1) {
      if ([2, 6, 9, 13, 16].includes(i)) continue;
      for (let y = 29; y < 32; y += 1) { b.set(2 + i * 3 + 2, y, DARK[0]); b.set(2 + i * 3 + 3, y, y === 29 ? DARK[3] : DARK[1]); }
    }
    b.rect(0, 29, 2, 6, P[3]); b.rect(58, 29, 2, 6, P[1]);
    b.rect(0, 35, 60, 2, P[4]); b.rect(0, 36, 60, 1, P[2]);
    // the lower case: two panels, the cheeks, pedals
    for (let y = 37; y < 50; y += 1) for (let x = 0; x < 60; x += 1) {
      let c = x < 2 ? P[4] : x > 57 ? P[1] : P[3];
      for (const [x0, x1] of [[5, 27], [32, 54]]) if (x >= x0 && x <= x1 && y >= 39 && y <= 47) c = x === x0 || y === 39 ? P[1] : x === x1 || y === 47 ? P[5] : P[2];
      b.set(x, y, c);
    }
    b.rect(24, 48, 3, 2, GOLDS[3]); b.rect(29, 48, 3, 2, GOLDS[3]); b.rect(34, 48, 3, 2, GOLDS[3]);
    b.rect(0, 50, 60, 1, P[1]);
    // the bench: tufted red velvet on turned legs
    for (let y = 52; y < 62; y += 1) for (let x = 14; x < 46; x += 1) {
      let c;
      if (y < 57) { c = y === 52 ? VELVET[5] : (x + y) % 6 === 0 && y === 54 ? VELVET[1] : VELVET[3]; if (y === 56) c = VELVET[1]; if (x === 14) c = VELVET[4]; if (x === 45) c = VELVET[1]; }
      else if (y === 57) c = P[4];
      else c = (x === 15 || x === 16 || x === 43 || x === 44) ? (x % 2 ? P[3] : P[2]) : null;
      if (c) b.set(x, y, c);
    }
  });
}

/** The parlor's grandfather clock (its pendulum swings on the live layer). */
function clockArt() {
  return sprite(16, 56, (b) => {
    const P = WAL;
    for (let y = 0; y < 56; y += 1) for (let x = 0; x < 16; x += 1) {
      const w = y < 18 ? 16 : y < 50 ? 12 : 14;
      const x0 = (16 - w) / 2;
      if (x < x0 || x >= x0 + w) continue;
      let c = x === x0 ? P[4] : x === x0 + w - 1 ? P[1] : P[3];
      if (y === 0 || y === 18 || y === 50) c = P[5];
      if (y < 3 && (x < 2 || x > 13)) c = null;
      if (c) b.set(x, y, c);
    }
    for (let y = 3; y < 16; y += 1) for (let x = 2; x < 14; x += 1) if (inEll(x, y, 8, 9.5, 5.6, 5.6)) b.set(x, y, inEll(x, y, 8, 9.5, 4.6, 4.6) ? CREAM[4] : GOLDS[3]);
    b.set(8, 6, INK); b.set(8, 7, INK); b.set(8, 8, INK); b.set(8, 9, INK); b.set(9, 9, INK); b.set(10, 9, INK);
    for (let y = 21; y < 47; y += 1) for (let x = 4; x < 12; x += 1) b.set(x, y, y === 21 || x === 4 ? P[0] : '#2a1a20');
  });
}

/** The parlor studio: a reel-to-reel on a wooden mixing desk, needle meters, monitors, a ribbon mic. */
function desk2Art() {
  const P = WAL;
  return sprite(78, 52, (b) => {
    // monitors on stands, left and right
    for (const sx of [0, 67]) {
      b.rect(sx, 6, 11, 16, DARK[2]); b.rect(sx, 6, 11, 1, DARK[4]); b.rect(sx + 10, 6, 1, 16, DARK[0]);
      for (let y = 0; y < 16; y += 1) for (let x = 0; x < 11; x += 1) {
        if (inEll(x, y, 5.5, 11, 3.6, 3.6)) b.set(sx + x, 6 + y, inEll(x, y, 5.5, 11, 1.4, 1.4) ? '#e8b23e' : inEll(x, y, 5.5, 11, 2.6, 2.6) ? DARK[0] : STEEL[1]);
        if (inEll(x, y, 5.5, 4, 1.6, 1.6)) b.set(sx + x, 6 + y, STEEL[4]);
      }
      b.rect(sx + 4, 22, 3, 28, STEEL[1]); b.rect(sx + 5, 22, 1, 28, STEEL[3]); b.rect(sx + 1, 49, 9, 2, STEEL[1]);
    }
    // the reel-to-reel behind the desk
    b.rect(21, 0, 36, 21, STEEL[3]); b.rect(21, 0, 36, 1, STEEL[5]); b.rect(56, 0, 1, 21, STEEL[1]); b.rect(21, 20, 36, 1, STEEL[1]);
    for (const rx of [29, 49]) for (let y = 1; y < 15; y += 1) for (let x = rx - 7; x <= rx + 7; x += 1) {
      if (!inEll(x, y, rx + 0.5, 8, 6.5, 6.5)) continue;
      let c = inEll(x, y, rx + 0.5, 8, 4.5, 4.5) ? '#5a3a2a' : STEEL[5];
      if (inEll(x, y, rx + 0.5, 8, 1.2, 1.2)) c = STEEL[2];
      b.set(x, y, c);
    }
    b.rect(26, 16, 26, 2, DARK[2]); for (let i = 0; i < 5; i += 1) b.rect(28 + i * 5, 16, 3, 1, i === 4 ? '#e03131' : STEEL[5]);
    // the desk: a sloped top of faders and knobs on walnut, needle meters on the bridge
    for (let y = 21; y < 50; y += 1) for (let x = 12; x < 66; x += 1) {
      let c;
      if (y < 27) c = y === 21 ? P[5] : P[4];
      else if (y < 40) c = STEEL[1];
      else if (y === 40) c = P[5];
      else c = x === 12 ? P[4] : x === 65 ? P[1] : (y === 49 ? P[1] : P[3]);
      b.set(x, y, c);
    }
    for (const mx of [22, 46]) { b.rect(mx, 22, 10, 5, CREAM[3]); b.rect(mx, 22, 10, 1, '#ffffff'); b.set(mx + 8, 23, '#e03131'); b.set(mx + 9, 23, '#e03131'); }
    for (let i = 0; i < 12; i += 1) {
      const fx = 15 + i * 4;
      b.set(fx, 28, ['#e03131', '#ffd43b', '#4dabf7', '#69db7c'][i % 4]); b.set(fx + 1, 28, '#ffffff');
      b.set(fx, 30, STEEL[4]); b.set(fx + 1, 30, STEEL[3]);
      b.rect(fx, 32, 1, 7, DARK[0]);
      const k = 33 + ((i * 5) % 5);
      b.rect(fx - 1, k, 3, 2, i === 11 ? '#e03131' : STEEL[5]);
    }
    // a ribbon mic on a boom over the left of the desk
    line(10, 44, 18, 8, (x, y) => b.set(x, y, STEEL[1]));
    for (let y = 2; y < 9; y += 1) for (let x = 16; x < 22; x += 1) if (inEll(x, y, 19, 5.5, 2.6, 3.6)) b.set(x, y, (y % 2) ? GOLDS[3] : GOLDS[1]);
  });
}

/** The parlor's sheet music: a tall bookcase of binders and folios, and a carved music stand. */
function sheets2Art() {
  const P = WAL;
  const SP = ['#9a2a36', '#2a3a6a', '#3a6a3a', '#d8a038', '#6a3a7a', '#f0e0c0', '#2e6a62', '#b04a32'];
  return sprite(48, 58, (b) => {
    for (let y = 0; y < 58; y += 1) for (let x = 0; x < 32; x += 1) {
      let c = x < 2 ? P[4] : x > 29 ? P[1] : P[2];
      if (y < 3) c = y === 0 ? P[5] : P[4];
      if ([18, 34, 50].includes(y)) c = P[5];
      if ([19, 35, 51].includes(y)) c = P[1];
      if (y > 55) c = P[1];
      b.set(x, y, c);
    }
    // binders and folios on three shelves
    for (const [top, bottom] of [[4, 18], [20, 34], [36, 50]]) {
      let x = 3;
      let i = top;
      while (x < 29) {
        const w = 2 + Math.floor(h2(x, top, 5) * 3);
        const hgt = bottom - top - Math.floor(h2(x, top, 9) * 4);
        const C = ramp(SP[(i += 3) % SP.length], 1, 1);
        if (x + w > 29) break;
        for (let y = bottom - hgt; y < bottom; y += 1) for (let k = 0; k < w; k += 1) b.set(x + k, y, k === 0 ? C[2] : k === w - 1 ? C[0] : C[1]);
        if (hgt > 8) b.set(x + 1, bottom - hgt + 3, GOLDS[4]);
        x += w;
      }
    }
    b.rect(4, 52, 24, 3, P[3]); b.rect(15, 53, 2, 1, GOLDS[3]);
    // the carved music stand with an open folio
    for (let y = 22; y < 54; y += 1) { b.set(40, y, P[2]); b.set(41, y, P[4]); }
    line(40, 52, 35, 57, (x, y) => b.set(x, y, P[2])); line(41, 52, 46, 57, (x, y) => b.set(x, y, P[3]));
    for (let y = 8; y < 24; y += 1) for (let x = 33; x < 48; x += 1) {
      let c = x < 40 ? CREAM[4] : CREAM[3];
      if (x === 40) c = CREAM[1];
      if (x === 33 || x === 47 || y === 8) c = P[3];
      if ([12, 15, 18].includes(y) && x > 34 && x < 46 && x !== 40) c = h2(x, y, 11) < 0.3 ? NOTE : '#b8a890';
      b.set(x, y, c);
    }
    b.rect(32, 23, 17, 2, P[2]); b.rect(32, 23, 17, 1, P[5]);
  });
}

/** The parlor's Note-o-Matic: a walnut synth cabinet with patch cables, an oscilloscope and a brass horn. */
function lab2Art() {
  const P = WAL;
  return sprite(42, 48, (b) => {
    // the brass horn: a big polished bell on a neck
    horn(b, 17, 18, 10, 7, 9);
    // the cabinet
    for (let y = 16; y < 46; y += 1) for (let x = 0; x < 42; x += 1) {
      let c = x < 2 ? P[4] : x > 39 ? P[1] : P[3];
      if (y === 16) c = P[5];
      if (y > 43) c = P[1];
      b.set(x, y, c);
    }
    // the black panel: an oscilloscope, knobs, and a patch bay with cables
    b.rect(3, 19, 36, 23, DARK[1]); b.rect(3, 19, 36, 1, DARK[3]);
    for (let y = 20; y < 31; y += 1) for (let x = 4; x < 16; x += 1) if (inEll(x, y, 10, 25.5, 5.5, 5)) b.set(x, y, inEll(x, y, 10, 25.5, 4.5, 4) ? '#0e2a1a' : STEEL[3]);
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 2; j += 1) { const kx = 19 + i * 5; const ky = 21 + j * 5; b.rect(kx, ky, 3, 3, STEEL[4]); b.set(kx + 1, ky, '#ffffff'); }
    for (let i = 0; i < 8; i += 1) { b.set(5 + i * 4, 34, STEEL[5]); b.set(5 + i * 4, 38, STEEL[5]); }
    const CAB = [['#e03131', 5, 21, 3], ['#ffd43b', 9, 29, 4], ['#4dabf7', 13, 33, 2], ['#69db7c', 17, 25, 5]];
    for (const [col, a, z, sag] of CAB) swag(a, 34, z, 38, sag, (x, y) => b.set(x, y, col));
    // little feet
    for (const fx of [2, 37]) b.rect(fx, 46, 3, 2, P[1]);
  });
}

/** A fern on a tall pedestal. */
function fernArt() {
  return sprite(24, 40, (b) => {
    for (let i = 0; i < 9; i += 1) {
      const a = -Math.PI * 0.9 + (i / 8) * Math.PI * 0.8;
      line(12, 13, 12 + Math.cos(a) * 11, 13 + Math.sin(a) * 10 + 4, (x, y, t) => { b.set(x, y, t > 0.7 ? LEAF[4] : LEAF[3]); if (t > 0.2 && t < 0.9 && (x + y) % 2 === 0) b.set(x, y + 1, LEAF[2]); });
    }
    for (let y = 12; y < 18; y += 1) for (let x = 6; x < 18; x += 1) if (inEll(x, y, 12, 13, 6, 4.5)) b.set(x, y, y > 14 ? CREAM[1] : CREAM[3]);
    for (let y = 18; y < 40; y += 1) { const w = y < 21 ? 3 : y > 36 ? 5 : 2; for (let x = 12 - w; x < 12 + w; x += 1) b.set(x, y, x === 12 - w ? CREAM[4] : x === 12 + w - 1 ? CREAM[0] : CREAM[2]); }
  });
}

// ---------- 3: the Rock Arena ----------

const NIGHT = ['#0e0a16', '#161020', '#1e162c', '#281e3a', '#34284a', '#44365c'];
const NEON = { pink: '#ff4fd8', cyan: '#3ff0ff', yellow: '#fff03f', lime: '#7dff5a' };
const RED = ramp('#e03131', 3, 2);
const STAGE = { x: 92, y: FT - 10, w: 136, h: 42 }; // the stage's top, in front of the back wall
const PARS = [24, 58, 92, 128, 192, 228, 262, 296].map((x, i) => ({ x, c: ['#ff4fd8', '#3ff0ff', '#fff03f', '#7dff5a', '#ff4fd8', '#3ff0ff', '#fff03f', '#7dff5a'][i] }));

function wall3(px) {
  for (let y = 0; y < FT; y += 1) {
    for (let x = 0; x < R.W; x += 1) {
      let c;
      // a dark backdrop with a starburst behind the stage
      const a = Math.atan2(y - 44, x - 160);
      const ray = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 28) % 2;
      const d = Math.hypot(x - 160, (y - 44) * 1.6);
      c = d < 140 && ray ? NIGHT[3] : NIGHT[2];
      if (d < 90 && ray) c = NIGHT[4];
      if (bayer(x, y) < Math.max(0, (d - 120) / 120)) c = NIGHT[1];
      // acoustic panels at the sides
      if ((x < 90 || x > 230) && y > 8 && y < FT - 6) {
        const pxl = (x - (x < 90 ? 8 : 238)) % 20; const pyl = (y - 8) % 12;
        if (pxl >= 0 && pxl < 18 && pyl < 10) c = pxl === 0 || pyl === 0 ? NIGHT[4] : pxl === 17 || pyl === 9 ? NIGHT[0] : (pxl + pyl) % 2 ? NIGHT[2] : NIGHT[3];
      }
      if (y >= FT - 3) c = y === FT - 3 ? NIGHT[4] : NIGHT[0];
      px(x, y, c);
    }
  }
  // the lighting truss along the top, with a par can every so often
  for (let x = 0; x < R.W; x += 1) {
    px(x, 0, STEEL[2]); px(x, 1, STEEL[5]); px(x, 5, STEEL[4]); px(x, 6, STEEL[1]);
    const k = x % 6;
    if (k === 0) for (let y = 1; y < 6; y += 1) px(x, y, STEEL[3]);
    px(x, 1 + Math.abs(3 - k) % 4, STEEL[3]);
  }
  for (const p of PARS) {
    grid(px, p.x - 3, 7, ['.sss.', 'sKKKs', 'KKKKK', 'KcccK', '.ccc.'], { s: STEEL[4], K: DARK[1], c: mix(p.c, INK, 0.45) });
  }
}

/** A neon sign: "ROCK!" in pink tubes with a cyan lightning bolt (it glows on the live layer). */
function neonSign(px, X, Y, on = false) {
  const pink = on ? NEON.pink : mix(NEON.pink, NIGHT[1], 0.55);
  const cyan = on ? NEON.cyan : mix(NEON.cyan, NIGHT[1], 0.55);
  // big letters: each pixel of the tiny font is 2 x 2
  let x = X;
  for (const ch of 'ROCK!') {
    const g = FONT[ch];
    g.forEach((row, yy) => { for (let i = 0; i < row.length; i += 1) if (row[i] === '#') { px(x + i * 2, Y + yy * 2, pink); px(x + i * 2 + 1, Y + yy * 2, pink); px(x + i * 2, Y + yy * 2 + 1, mix(pink, '#ffffff', on ? 0.4 : 0)); px(x + i * 2 + 1, Y + yy * 2 + 1, pink); } });
    x += g[0].length * 2 + 2;
  }
  grid(px, x + 1, Y - 2, ['...cc', '..cc.', '.cc..', 'cccc.', '..cc.', '.cc..', 'cc...', 'c....'], { c: cyan });
}

/** The stage: a black deck with a silver edge and footlights, speaker stacks on each side. */
function stage(px) {
  const S = STAGE;
  for (let y = S.y; y < S.y + S.h; y += 1) for (let x = S.x; x < S.x + S.w; x += 1) {
    const yy = y - S.y;
    let c;
    if (yy < S.h - 8) {
      c = (Math.floor(x / 8) + Math.floor(yy / 8)) % 2 ? NIGHT[2] : NIGHT[3]; // the deck
      if (yy % 8 === 0) c = NIGHT[1];
      if (x === S.x || x === S.x + S.w - 1) c = STEEL[3];
    } else if (yy === S.h - 8) c = STEEL[5];
    else if (yy === S.h - 7) c = STEEL[3];
    else {
      c = yy === S.h - 1 ? NIGHT[0] : NIGHT[1]; // the front of the stage
      if ((x - S.x) % 12 === 6 && yy > S.h - 6 && yy < S.h - 2) c = '#5a4a3a'; // footlight sockets
    }
    px(x, y, c);
  }
}

function speakerStack(px, X, Y) {
  for (let i = 0; i < 3; i += 1) {
    const y0 = Y + i * 15;
    for (let y = 0; y < 15; y += 1) for (let x = 0; x < 22; x += 1) {
      let c = (x + y) % 2 ? DARK[1] : DARK[2];
      if (x < 2 || x > 19 || y < 2 || y > 12) c = DARK[3];
      if (x === 0 || y === 0) c = DARK[4];
      if (x === 21 || y === 14) c = DARK[0];
      if (y === 1 && x > 7 && x < 14) c = GOLDS[3];
      for (const cx of [6, 15]) if (inEll(x, y, cx, 8, 4, 4)) c = inEll(x, y, cx, 8, 1.4, 1.4) ? STEEL[4] : inEll(x, y, cx, 8, 2.8, 2.8) ? DARK[0] : STEEL[1];
      px(X + x, y0 + y, c);
    }
  }
}

/** The rock star piano: glossy black and red, flame decals, chrome pipes (they shoot fire on the live layer). */
function rockPianoArt() {
  return sprite(84, 44, (b) => {
    // chrome exhaust pipes, two each side, rising behind the body
    for (const [x0, top] of [[2, 0], [8, 4], [72, 4], [78, 0]]) {
      for (let y = top; y < 22; y += 1) { b.set(x0, y, STEEL[3]); b.set(x0 + 1, y, STEEL[6]); b.set(x0 + 2, y, STEEL[4]); b.set(x0 + 3, y, STEEL[1]); }
      b.rect(x0 - 1, top, 6, 2, STEEL[5]); b.rect(x0 - 1, top + 1, 6, 1, STEEL[2]);
    }
    // the body
    for (let y = 12; y < 40; y += 1) for (let x = 0; x < 84; x += 1) {
      let c;
      if (y < 15) c = y === 12 ? RED[5] : RED[3];
      else if (y < 26) c = x < 3 ? DARK[3] : x > 80 ? DARK[0] : DARK[1];
      else if (y < 28) c = y === 26 ? RED[4] : RED[2];
      else if (y < 34) c = null; // the keys go here
      else c = y === 34 ? RED[4] : y > 37 ? DARK[0] : DARK[1];
      if (c) b.set(x, y, c);
    }
    // a gleam on the gloss
    for (let x = 10; x < 70; x += 1) if ((x - 10) % 20 < 6) b.set(x, 16 + Math.floor(((x - 10) % 20) / 3), DARK[4]);
    // flame decals licking up the black front
    for (let x = 3; x < 81; x += 1) {
      const hgt = 4 + Math.round(Math.abs(Math.sin(x * 0.45)) * 5 + Math.sin(x * 0.17) * 2);
      for (let k = 0; k < hgt; k += 1) b.set(x, 25 - k, k > hgt - 2 ? '#ffe066' : k > hgt - 4 ? '#ff922b' : RED[3]);
    }
    // the keys
    for (let i = 0; i < 27; i += 1) for (let y = 28; y < 34; y += 1) {
      const x = 1 + i * 3;
      b.set(x, y, y === 33 ? CREAM[1] : CREAM[4]); b.set(x + 1, y, y === 33 ? CREAM[1] : CREAM[3]); b.set(x + 2, y, CREAM[0]);
    }
    for (let i = 0; i < 26; i += 1) {
      if ([2, 6, 9, 13, 16, 20, 23].includes(i)) continue;
      for (let y = 28; y < 31; y += 1) { b.set(1 + i * 3 + 2, y, DARK[0]); b.set(1 + i * 3 + 3, y, y === 28 ? DARK[3] : DARK[1]); }
    }
    b.set(0, 28, RED[2]); b.set(83, 28, RED[1]);
    // gold studs along the bottom, and chunky legs
    for (let x = 4; x < 82; x += 6) b.set(x, 36, GOLDS[4]);
    for (const lx of [3, 76]) b.rect(lx, 40, 5, 4, STEEL[3]);
  });
}

/** The arena's studio: a big console with a meter bridge, a rack of gear with blinking lights. */
function desk3Art() {
  return sprite(82, 42, (b) => {
    // the rack tower
    for (let y = 0; y < 42; y += 1) for (let x = 0; x < 16; x += 1) {
      let c = x === 0 ? DARK[4] : x === 15 ? DARK[0] : DARK[2];
      if (y % 7 === 0) c = STEEL[2];
      b.set(x, y, c);
    }
    for (let r = 0; r < 6; r += 1) { b.rect(2, r * 7 + 2, 8, 3, DARK[0]); b.set(12, r * 7 + 3, STEEL[4]); }
    // a big screen with a waveform
    b.rect(30, 0, 34, 17, DARK[3]); b.rect(32, 2, 30, 13, '#0a1830');
    for (let x = 33; x < 61; x += 1) { const hgt = Math.round(Math.abs(Math.sin(x * 0.7) * Math.sin(x * 0.13)) * 5); for (let y = 8 - hgt; y <= 8 + hgt; y += 1) b.set(x, y, '#3a7aff'); }
    b.rect(45, 17, 4, 4, DARK[2]);
    // the console: a meter bridge, then rows of knobs and faders
    for (let y = 20; y < 42; y += 1) for (let x = 18; x < 82; x += 1) {
      let c;
      if (y < 24) c = y === 20 ? DARK[4] : DARK[2];
      else if (y < 36) c = (x + y) % 2 ? NIGHT[3] : NIGHT[2];
      else if (y === 36) c = STEEL[4];
      else c = y === 41 ? DARK[0] : DARK[1];
      if (x === 18) c = c && mix(c, '#ffffff', 0.2);
      b.set(x, y, c);
    }
    for (let i = 0; i < 15; i += 1) {
      const fx = 20 + i * 4;
      b.set(fx, 25, ['#ff4fd8', '#3ff0ff', '#fff03f', '#7dff5a'][i % 4]); b.set(fx + 1, 25, '#ffffff');
      b.set(fx, 27, STEEL[4]);
      b.rect(fx, 29, 1, 6, DARK[0]);
      b.rect(fx - 1, 29 + ((i * 7) % 5), 3, 2, i % 5 === 4 ? '#ff4fd8' : STEEL[5]);
    }
  });
}

/** The arena's sheet music: a chrome lectern with a glowing gold songbook, records on the wall. */
function sheets3Art() {
  return sprite(48, 56, (b) => {
    // a wall of gold and platinum records behind
    const rec = (X, Y, plat) => {
      const D = plat ? ['#8a8aa0', '#b8b8c8', '#e0e0ec', '#ffffff'] : [GOLDS[1], GOLDS[2], GOLDS[3], GOLDS[5]];
      for (let y = 0; y < 14; y += 1) for (let x = 0; x < 14; x += 1) {
        let c = x === 0 || y === 0 ? '#4a3a4a' : x === 13 || y === 13 ? '#0e0a16' : '#1e1626';
        if (inEll(x, y, 7, 7, 5.5, 5.5)) { c = (Math.round(Math.hypot(x + 0.5 - 7, y + 0.5 - 7)) % 2) ? D[1] : D[2]; if (inEll(x, y, 5.5, 5.5, 1.5, 1.2)) c = D[3]; if (inEll(x, y, 7, 7, 1.6, 1.6)) c = NEON.pink; }
        b.set(X + x, Y + y, c);
      }
    };
    rec(0, 0, false); rec(16, 0, true); rec(32, 0, false); rec(8, 16, true); rec(24, 16, false);
    // the lectern
    for (let y = 32; y < 52; y += 1) { b.set(23, y, STEEL[2]); b.set(24, y, STEEL[6]); b.set(25, y, STEEL[3]); }
    b.rect(16, 52, 18, 2, STEEL[4]); b.rect(16, 54, 18, 2, STEEL[1]);
    for (let y = 22; y < 34; y += 1) for (let x = 8; x < 42; x += 1) {
      const slope = Math.floor((y - 22) / 4);
      if (x < 8 + slope || x > 41 - slope) continue;
      let c = y === 22 ? STEEL[6] : y > 31 ? STEEL[1] : STEEL[3];
      // the open songbook: gold edges, glowing pages
      if (y > 22 && y < 31 && x > 10 + slope && x < 39 - slope) {
        c = x < 25 ? '#fffbe8' : '#fff2c8';
        if (x === 24 || x === 25) c = GOLDS[2];
        if ((y === 25 || y === 28) && x % 3 && x !== 24 && x !== 25) c = h2(x, y, 3) < 0.35 ? NOTE : '#d8c8a0';
        if (x === 11 + slope || x === 38 - slope) c = GOLDS[3];
      }
      b.set(x, y, c);
    }
  });
}

/** The Sound Transformer: a chrome machine with two glowing tubes, dials and a hologram projector. */
function lab3Art() {
  return sprite(44, 50, (b) => {
    // the tubes (their liquid glows on the live layer)
    for (const tx of [3, 31]) for (let y = 4; y < 30; y += 1) for (let x = tx; x < tx + 10; x += 1) {
      let c = x === tx || x === tx + 9 ? STEEL[3] : (x === tx + 2 ? 'rgba(255,255,255,0.5)' : 'rgba(120,200,255,0.25)');
      if (y < 6 || y > 27) c = y < 6 ? STEEL[5] : STEEL[2];
      b.set(x, y, c, y < 6 || y > 27 || x === tx || x === tx + 9 ? undefined : 'soft');
    }
    // the body
    for (let y = 26; y < 48; y += 1) for (let x = 0; x < 44; x += 1) {
      let c = x < 2 ? STEEL[5] : x > 41 ? STEEL[1] : STEEL[3];
      if (y === 26) c = STEEL[6];
      if (y > 45) c = STEEL[1];
      if (y > 29 && y < 43 && x > 3 && x < 40) c = NIGHT[1];
      b.set(x, y, c);
    }
    // the projector dish on top
    for (let y = 14; y < 26; y += 1) for (let x = 15; x < 29; x += 1) {
      if (y > 20 && x > 19 && x < 24) b.set(x, y, STEEL[2]);
      if (inEll(x, y, 22, 17, 6.5, 3)) b.set(x, y, inEll(x, y, 22, 16.5, 4.5, 1.6) ? '#7a3aff' : STEEL[4]);
    }
    // dials, a keypad and a little screen
    for (const [dx, col] of [[9, NEON.pink], [17, NEON.cyan]]) for (let y = 32; y < 40; y += 1) for (let x = dx - 3; x <= dx + 3; x += 1) if (inEll(x, y, dx + 0.5, 36, 3, 3)) b.set(x, y, inEll(x, y, dx + 0.5, 36, 1.2, 1.2) ? '#ffffff' : col);
    b.rect(24, 32, 13, 6, '#0a1830');
    for (let i = 0; i < 6; i += 1) b.rect(25 + (i % 3) * 4, 39 + Math.floor(i / 3) * 2, 3, 1, STEEL[5]);
    // feet
    for (const fx of [3, 37]) b.rect(fx, 48, 4, 2, DARK[2]);
  });
}

/** An electric guitar on its stand. */
function guitarStandArt() {
  return sprite(16, 40, (b) => {
    const G = ramp('#3fa0ff', 3, 2);
    for (let y = 0; y < 40; y += 1) for (let x = 0; x < 16; x += 1) {
      let c = null;
      if (y < 4 && x >= 6 && x <= 9) c = DARK[2];
      else if (y >= 4 && y < 20 && x >= 7 && x <= 8) c = x === 7 ? '#c88a50' : '#9a6030';
      else if ((inEll(x, y, 8, 26, 6, 6) || inEll(x, y, 5, 21, 3, 3) || inEll(x, y, 11, 22, 2.5, 3)) && y < 34) {
        c = x < 5 ? G[4] : x > 11 ? G[2] : G[3];
        if (y > 22 && y < 30 && x > 5 && x < 11) c = y % 3 === 0 ? STEEL[5] : '#fffbe8';
      }
      if (c) b.set(x, y, c);
    }
    for (let y = 4; y < 30; y += 1) b.set(8, y, STEEL[5]);
    line(4, 39, 8, 31, (x, y) => b.set(x, y, DARK[3])); line(12, 39, 8, 31, (x, y) => b.set(x, y, DARK[2]));
  });
}

// ---------- the parts that move ----------

/** Overlay pixels for the live layer: a glow round a point (dithered, see-through). */
function glow(px, cx, cy, r, c, a = 0.5) {
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) / r;
    if (d > 1) continue;
    if (bayer(x, y) < (1 - d) * 0.9) px(x, y, `rgba(${c},${(a * (1 - d * 0.6)).toFixed(2)})`);
  }
}
const rgbOf = (hex) => { const n = parseInt(hex.slice(1, 7), 16); return `${n >> 16},${(n >> 8) & 255},${n & 255}`; };

// ---------- painting a whole room ----------

/**
 * Paints the music house for a look (tier 1, 2 or 3) into canvas (MROOM.W x MROOM.H). o: {
 *   color: the kid's color (the doormat's stripe),
 * }. Returns {
 *   pieces: [{ id, x, y, w, h, foot, canvas, anim? }]: things standing out on the floor
 *     (musichouse.js draws them as their own canvases, in front of or behind the buddy;
 *     anim(px, t) paints their moving bits, in their own pixels),
 *   blocks: [[x, y, w, h]...] where the buddy can't walk,
 *   hot: { piano, sheets, studio, lab, desk: [x, y, w, h] }: the stations' tappable boxes,
 *   spots: { piano, sheets, studio, lab, desk, door, wake: { x, y, face? } }: where the buddy stands to use each,
 *   life(px, t): paints what moves on the layer over the room (t in seconds),
 * }
 */
export function paintMusicRoom(canvas, tier, o = {}) {
  const { W, H } = R;
  canvas.width = W; canvas.height = H;
  const { px, put } = pixelBuffer(W, H);
  const at = AT[tier] || AT[1];
  const pieces = [];
  const blocks = [];
  const hot = {};
  const lives = [];
  const doc = canvas.ownerDocument;
  // a station or prop against the back wall: painted into the room, blocks the floor in front of it
  const spots = { door: { x: R.door.x + R.door.w / 2, y: FB - 8 }, wake: { x: R.door.x + R.door.w / 2, y: FB - 20 } };
  const wallPiece = (id, b, x, y, foot = 4) => {
    shadow(px, x + b.w / 2, y + b.h, b.w / 2, 2, 0.22);
    b.blit(px, x, y);
    blocks.push([x, FT - 4, b.w, y + b.h - FT + foot]);
    if (id) { hot[id] = [x, y, b.w, b.h]; spots[id] = { x: Math.round(x + b.w / 2), y: y + b.h + foot + 9 }; }
  };
  // a piece standing out on the floor, on its own canvas
  const stand = (id, b, x, y, foot, anim) => {
    shadow(px, x + b.w / 2, y + b.h - 1, b.w / 2 + 1, 2.5, 0.22);
    const c = doc.createElement('canvas');
    c.width = b.W; c.height = b.H;
    const buf = pixelBuffer(b.W, b.H);
    b.blit(buf.px, b.pad, b.pad);
    buf.put(c.getContext('2d'));
    pieces.push({ id, x: x - b.pad, y: y - b.pad, w: b.W, h: b.H, foot: y + b.h, canvas: c, pad: b.pad, base: buf.data, anim });
    blocks.push(foot);
    // the buddy uses a standing piece from its right-hand side, facing it
    if (id) { hot[id] = [x, y, b.w, b.h]; spots[id] = { x: foot[0] + foot[2] + 9, y: foot[1] + foot[3] - 4, face: -1 }; }
  };

  if (tier === 1) {
    wall1(px);
    plankFloor(px, FL1);
    floorShade(px);
    braidRug(px, 160, 118, 58, 27);
    doormat(px, ['#5a3a2a', '#a85a32', '#f0c060']);
    roundWindow(px, 88, 23);
    notePoster(px, 106, 14);
    guitarPoster(px, 194, 12);
    wallGuitar(px, 214, 12);
    foam(px, 238, 6, 60, 22);
    const bulbs = fairyLights(px);
    wallPiece('sheets', sheets1Art(), at.sheets.x, at.sheets.y);
    wallPiece('piano', keyboardArt(), at.piano.x, at.piano.y);
    wallPiece('studio', desk1Art(), at.studio.x, at.studio.y);
    const lab = lab1Art();
    stand('lab', lab, at.lab.x, at.lab.y, [at.lab.x + 1, at.lab.y + 30, lab.w - 2, 14], (p, t) => {
      // the screen's wave scrolls, the dials' lights blink
      for (let x = 6; x < 20; x += 1) {
        const y = 24 + Math.round(Math.sin(x * 0.9 + t * 6) * 2 + Math.sin(x * 0.4 - t * 3));
        p(x, y, '#69db7c'); p(x, y + 1, 'rgba(105,219,124,0.35)');
      }
      if (Math.floor(t * 2) % 2) p(33, 3, '#ffffff');
      const k = Math.floor(t * 3) % 4;
      p(7 + k * 4, 31, '#ffffff');
    });
    const desk = compose1Art();
    stand('desk', desk, DESK.x, DESK.y, [DESK.x + 1, DESK.y + 26, desk.w - 2, 12], (p, t) => {
      // the pencil scribbles, and the lamp glows
      const k = Math.floor(t * 4) % 4;
      p(15 + k, 16 - (k % 2), NOTE);
      for (let x = 23; x < 30; x += 1) if ((x + Math.floor(t * 2)) % 3) p(x, 9, 'rgba(255,240,170,0.7)');
    });
    const plant = plantArt();
    stand(null, plant, 290, 128, [293, 150, 16, 8]);
    const boxes = boxesArt();
    stand(null, boxes, 10, 140, [10, 154, 26, 14]);
    lives.push((p, t) => {
      // the fairy lights twinkle
      bulbs.forEach((bb, i) => {
        const on = 0.55 + 0.45 * Math.sin(t * 2.2 + i * 1.7);
        const rgb = rgbOf(bb.c);
        p(bb.x, bb.y + 1, bb.c); p(bb.x, bb.y + 2, mix(bb.c, '#ffffff', on * 0.5));
        glow(p, bb.x + 0.5, bb.y + 2, 3 + on * 1.5, rgb, 0.18 + on * 0.25);
      });
      // the 4-track's record light
      const s = at.studio;
      if (Math.floor(t * 1.5) % 2) { p(s.x + 54, s.y + 15, '#ff8a8a'); glow(p, s.x + 54.5, s.y + 15.5, 2.5, '255,80,80', 0.4); }
    });
    frontWalls(px, BEAM);
  }

  if (tier === 2) {
    wall2(px);
    parquet(px);
    floorShade(px, 0.3);
    persianRug(px, 96, 92, 128, 52);
    doormat(px, [WAL[0], VELVET[2], GOLDS[3]]);
    parlorWindow(px, 64, 8);
    portrait(px, 99, 10);
    sconce(px, 120, 16);
    wallPiece('sheets', sheets2Art(), at.sheets.x, at.sheets.y);
    wallPiece('piano', uprightArt(), at.piano.x, at.piano.y);
    wallPiece(null, clockArt(), 198, 8);
    wallPiece('studio', desk2Art(), at.studio.x, at.studio.y);
    const lab = lab2Art();
    stand('lab', lab, at.lab.x, at.lab.y, [at.lab.x + 1, at.lab.y + 32, lab.w - 2, 16], (p, t) => {
      // the oscilloscope traces a wave
      for (let x = 5; x < 16; x += 1) {
        const y = 25 + Math.round(Math.sin(x * 1.1 + t * 7) * 2.5 * Math.sin(t * 1.3));
        if (inEll(x, y, 10, 25.5, 4.4, 3.9)) { p(x, y, '#8cff9c'); p(x, y + 1, 'rgba(105,219,124,0.4)'); }
      }
      const k = Math.floor(t * 4) % 8;
      p(5 + k * 4, 34, '#ffe27a');
    });
    const desk = compose2Art();
    stand('desk', desk, DESK.x, DESK.y, [DESK.x + 1, DESK.y + 24, desk.w - 2, 14], (p, t) => {
      // the candle flickers
      const f = Math.sin(t * 9) + Math.sin(t * 13.7);
      p(6, 10, '#ffe27a'); p(6, 9, f > 0 ? '#ffd43b' : '#ff922b');
      if (f > 0.6) p(7, 8, '#ff922b');
    });
    stand(null, fernArt(), 292, 116, [295, 148, 18, 8]);
    const ap = at.piano; const st = at.studio;
    lives.push((p, t) => {
      // candle flames flicker: on the piano and on the sconce
      for (const [x, y, i] of [[ap.x + 4, ap.y + 10, 0], [ap.x + 55, ap.y + 10, 1], [122, 15, 2]]) {
        const f = Math.sin(t * 9 + i * 2) + Math.sin(t * 13.7 + i);
        p(x, y, '#ffe27a'); p(x, y - 1, f > 0 ? '#ffd43b' : '#ff922b');
        if (f > 0.6) p(x + (i % 2 ? 1 : -1), y - 2, '#ff922b');
        glow(p, x + 0.5, y, 5, '255,210,120', 0.35);
      }
      // the clock's pendulum swings
      const sw = Math.sin(t * Math.PI) * 2.5;
      line(206, 31, 206 + sw, 48, (x, y) => p(x, y, GOLDS[2]));
      for (let yy = -1; yy <= 1; yy += 1) for (let xx = -1; xx <= 1; xx += 1) if (Math.abs(xx) + Math.abs(yy) < 2) p(Math.round(206 + sw) + xx, 49 + yy, GOLDS[4]);
      // the reels turn, and the needles in the meters bounce
      for (const rx of [st.x + 29, st.x + 49]) {
        const a = t * 3;
        for (let k = 0; k < 3; k += 1) {
          const aa = a + (k * Math.PI * 2) / 3;
          p(Math.round(rx + 0.5 + Math.cos(aa) * 3), Math.round(st.y + 8 + Math.sin(aa) * 3), STEEL[5]);
        }
      }
      for (const [mx, ph] of [[st.x + 22, 0], [st.x + 46, 1.3]]) {
        const v = 0.5 + 0.45 * Math.sin(t * 5 + ph) * Math.abs(Math.sin(t * 1.7 + ph));
        line(mx + 5, st.y + 26, mx + 1 + v * 8, st.y + 23, (x, y) => p(x, y, INK));
      }
    });
    frontWalls(px, [WAL[0], WAL[1], WAL[2], WAL[3], WAL[4]]);
  }

  if (tier === 3) {
    wall3(px);
    // a dark, shiny floor: big tiles with a sheen, and confetti
    for (let y = FT; y < FB; y += 1) for (let x = 0; x < R.W; x += 1) {
      let c = (Math.floor(x / 16) + Math.floor((y - FT) / 12)) % 2 ? NIGHT[2] : NIGHT[1];
      if (x % 16 === 0 || (y - FT) % 12 === 0) c = NIGHT[0];
      if (bayer(x, y) < 0.08 && (x + y) % 9 === 0) c = NIGHT[4];
      if (h2(x, y, 71) < 0.006) c = ['#ff4fd8', '#3ff0ff', '#fff03f', '#7dff5a'][Math.floor(h2(y, x, 3) * 4)];
      px(x, y, c);
    }
    floorShade(px, 0.4);
    stage(px);
    doormat(px, [NIGHT[0], '#a8243a', GOLDS[3]]);
    neonSign(px, 139, 12);
    speakerStack(px, STAGE.x + 2, STAGE.y + 30 - 45);
    speakerStack(px, STAGE.x + STAGE.w - 24, STAGE.y + 30 - 45);
    const S = STAGE;
    blocks.push([S.x, FT - 4, S.w, S.y + S.h - FT + 2]);
    // the piano stands on the stage
    const pb = rockPianoArt();
    shadow(px, at.piano.x + pb.w / 2, at.piano.y + pb.h, pb.w / 2, 2, 0.3);
    pb.blit(px, at.piano.x, at.piano.y);
    hot.piano = [at.piano.x, at.piano.y, pb.w, S.y + S.h - at.piano.y];
    spots.piano = { x: at.piano.x + pb.w / 2, y: S.y + S.h + 9 };
    // a mic stand at the front of the stage
    for (let y = S.y + 8; y < S.y + 27; y += 1) px(S.x + 18, y, STEEL[3]);
    grid(px, S.x + 15, S.y + 3, ['.KKK.', 'KsSsK', '.KKK.', '..s..', '..s..'], { K: DARK[1], s: STEEL[3], S: STEEL[5] });
    grid(px, S.x + 14, S.y + 26, ['.sssss.', 'sSSSSSs'], { s: STEEL[1], S: STEEL[4] });
    wallPiece('sheets', sheets3Art(), at.sheets.x, at.sheets.y);
    wallPiece('studio', desk3Art(), at.studio.x, at.studio.y);
    const lab = lab3Art();
    stand('lab', lab, at.lab.x, at.lab.y, [at.lab.x + 1, at.lab.y + 34, lab.w - 2, 16], (p, t) => {
      // bubbling tubes, a floating hologram note, a busy little screen
      for (const [tx, col] of [[3, '255,79,216'], [31, '63,240,255']]) {
        const lvl = 12 + Math.round(Math.sin(t * 1.5 + tx) * 2);
        for (let y = lvl; y < 28; y += 1) for (let x = tx + 1; x < tx + 9; x += 1) p(x, y, `rgba(${col},${y === lvl ? 0.95 : 0.6})`);
        for (let k = 0; k < 3; k += 1) { const by = 27 - ((t * 9 + k * 6 + tx) % (27 - lvl)); p(tx + 3 + ((k * 3) % 5), Math.round(by), '#ffffff'); }
      }
      const hy = 4 + Math.sin(t * 2) * 1.5;
      for (let y = 0; y < 12; y += 1) for (let x = 15; x < 30; x += 1) if (bayer(x, y + Math.floor(t * 8)) < 0.18 && Math.abs(x - 22) < 3 + y * 0.35) p(x, y + 3, 'rgba(160,110,255,0.55)');
      grid((x, y, c) => p(x, Math.round(y + hy), c), 19, 0, ['...KK.', '...KKK', '...K.K', '..KK..', 'KKKK..', 'KKK...'], { K: Math.floor(t * 4) % 2 ? '#c8a8ff' : '#e8d8ff' });
      for (let i = 0; i < 11; i += 1) p(25 + i, 33 + Math.round(Math.abs(Math.sin(t * 6 + i)) * 3), NEON.lime);
    });
    const desk = compose3Art();
    stand('desk', desk, DESK.x, DESK.y, [DESK.x + 1, DESK.y + 26, desk.w - 2, 12], (p, t) => {
      // notes scroll across the screen, and the neon edge pulses
      for (let k = 0; k < 4; k += 1) {
        const x = 10 + ((Math.floor(t * 6) + k * 5) % 18);
        const y = [8, 10, 12, 14][(k * 3 + Math.floor(t)) % 4];
        p(x, y, '#e8d8ff'); p(x + 1, y, '#e8d8ff'); p(x + 1, y - 1, '#e8d8ff');
      }
      if (Math.sin(t * 3) > 0) for (let x = 0; x < 42; x += 2) p(x, 19, '#ffffff');
    });
    stand(null, guitarStandArt(), 292, 110, [292, 140, 16, 10]);
    const ap = at.piano; const st = at.studio;
    lives.push((p, t) => {
      // light beams from the par cans sweep the floor
      for (const [i, par] of PARS.entries()) {
        const sw = Math.sin(t * 0.9 + i * 1.3) * 60;
        const tx = par.x + sw; const ty = 140 + Math.sin(t * 0.7 + i) * 20;
        const rgb = rgbOf(par.c);
        for (let y = 12; y < ty + 8; y += 1) {
          const k = (y - 12) / (ty - 12);
          const cx = par.x + (tx - par.x) * Math.min(1, k);
          const half = 1 + Math.min(1, k) * 12;
          for (let x = Math.floor(cx - half); x <= cx + half; x += 1) {
            const pool = y > ty - 6 && ((x + 0.5 - tx) / 14) ** 2 + ((y + 0.5 - ty) / 7) ** 2 <= 1;
            if (y > ty && !pool) continue;
            if (pool ? bayer(x, y) < 0.42 : bayer(x, y) < 0.12) p(x, y, `rgba(${rgb},${pool ? 0.32 : 0.22})`);
          }
        }
        p(par.x - 1, 10, par.c); p(par.x, 10, '#ffffff'); p(par.x + 1, 10, par.c);
      }
      // the neon sign buzzes on (and flickers now and then)
      if (Math.sin(t * 23) > -0.92 || Math.floor(t) % 7) neonSign(p, 139, 12, true);
      // the footlights change color
      for (let k = 0; k < 10; k += 1) {
        const c = ['#ff4fd8', '#3ff0ff', '#fff03f', '#7dff5a'][(k + Math.floor(t * 3)) % 4];
        const fx = STAGE.x + 6 + k * 12; const fy = STAGE.y + STAGE.h - 4;
        p(fx, fy, c); p(fx + 1, fy, c);
        glow(p, fx + 1, fy, 4, rgbOf(c), 0.3);
      }
      // the piano's pipes shoot fire: a little flicker, and every few seconds a big burst
      const burst = Math.max(0, Math.sin((t % 4) / 4 * Math.PI * 2 - 1.2));
      for (const [x0, top] of [[2, 0], [8, 4], [72, 4], [78, 0]]) {
        const fx = ap.x + x0 + 1.5; const fy = ap.y + top - 1;
        const hgt = 3 + Math.abs(Math.sin(t * 11 + x0)) * 2 + burst * 12;
        for (let y = 0; y < hgt; y += 1) {
          const w = Math.max(0.5, (1 - y / hgt) * (2.4 + burst * 1.5)) + Math.sin(t * 17 + y + x0) * 0.6;
          for (let x = Math.floor(fx - w); x <= fx + w; x += 1) {
            const k = y / hgt;
            p(x, Math.round(fy - y), k < 0.3 ? '#fff6c8' : k < 0.6 ? '#ffd43b' : k < 0.85 ? '#ff922b' : '#e03131');
          }
        }
        if (burst > 0.3) glow(p, fx, fy - hgt / 2, 6 + burst * 6, '255,160,60', 0.3);
      }
      // the console's meters dance, the rack blinks
      for (let i = 0; i < 15; i += 1) {
        const v = Math.round(Math.abs(Math.sin(t * (4 + (i % 3)) + i * 0.9)) * 3);
        for (let k = 0; k <= v; k += 1) p(st.x + 20 + i * 4, st.y + 23 - k, k > 2 ? '#ff4f4f' : k > 1 ? '#fff03f' : '#7dff5a');
      }
      for (let r = 0; r < 6; r += 1) if (Math.sin(t * 3 + r * 2.1) > 0) p(st.x + 3 + ((r * 5) % 6), st.y + r * 7 + 3, ['#7dff5a', '#ff4fd8', '#3ff0ff'][r % 3]);
      // a disco ball over the floor, throwing sparkles
      const dbx = 76; const dby = 26;
      for (let y = -5; y <= 5; y += 1) for (let x = -5; x <= 5; x += 1) if (x * x + y * y <= 25) p(dbx + x, dby + y, (x + y + Math.floor(t * 6)) % 3 === 0 ? '#ffffff' : (x - y) % 2 ? STEEL[4] : STEEL[2]);
      for (let y = 7; y < dby - 5; y += 1) p(dbx, y, STEEL[3]);
      for (let k = 0; k < 14; k += 1) {
        const sx = Math.round(R.W / 2 + Math.sin(t * 0.6 + k * 2.4) * 150);
        const sy = Math.round(30 + ((k * 37 + t * 10) % 140));
        if (Math.sin(t * 5 + k) > 0) { p(sx, sy, '#ffffff'); p(sx + 1, sy, 'rgba(255,255,255,0.5)'); p(sx, sy + 1, 'rgba(255,255,255,0.5)'); }
      }
      // haze drifting along the stage's foot
      for (let x = STAGE.x - 10; x < STAGE.x + STAGE.w + 10; x += 1) for (let y = STAGE.y + STAGE.h - 2; y < STAGE.y + STAGE.h + 10; y += 1) {
        const n = Math.sin(x * 0.11 + t * 0.8) + Math.sin(x * 0.05 - t * 0.5 + y * 0.3);
        if (n > 0.6 && bayer(x, y) < (n - 0.6) * 0.5) p(x, y, 'rgba(230,220,255,0.35)');
      }
    });
    frontWalls(px, [NIGHT[0], NIGHT[1], NIGHT[2], NIGHT[3], NIGHT[5]]);
  }

  put(canvas.getContext('2d'));
  return { pieces, blocks, hot, spots, life: (p, t) => lives.forEach((f) => f(p, t)) };
}

// ---------- the sign on the music hall in the village ----------

/**
 * The music hall's sign for a look (0 while it is locked): a padlock, a wooden "MUSIC" board,
 * a brass plaque, or a blinking marquee. Returns { url, w, h, frames }: a strip of frames
 * side by side (the marquee's bulbs blink), as a picture.
 */
export function musicSign(doc, tier) {
  const sizes = { 0: [11, 13], 1: [25, 13], 2: [27, 13], 3: [29, 15] };
  const [w, h] = sizes[tier] || sizes[0];
  const frames = tier === 3 ? 2 : 1;
  const c = doc.createElement('canvas');
  c.width = w * frames; c.height = h;
  const { px, put } = pixelBuffer(c.width, h);
  for (let f = 0; f < frames; f += 1) {
    const X = f * w;
    const b = sprite(w - 2, h - 2, (bb) => {
      if (tier === 0) {
        // a padlock on a chain
        for (let x = 0; x < 9; x += 1) if (x % 2 === 0) bb.set(x, 0, STEEL[3]);
        for (let y = 1; y < 6; y += 1) { bb.set(2, y, STEEL[4]); bb.set(6, y, STEEL[2]); }
        bb.rect(3, 1, 3, 1, STEEL[4]);
        bb.rect(0, 5, 9, 6, BRASS[3]); bb.rect(0, 5, 9, 1, BRASS[5]); bb.rect(8, 5, 1, 6, BRASS[1]); bb.rect(0, 10, 9, 1, BRASS[1]);
        bb.set(4, 7, INK); bb.set(4, 8, INK);
      } else if (tier === 1) {
        // a wooden board on two ropes
        bb.set(3, 0, '#c8a070'); bb.set(19, 0, '#c8a070'); bb.set(4, 1, '#c8a070'); bb.set(18, 1, '#c8a070');
        bb.rect(0, 2, 23, 9, PINE[3]); bb.rect(0, 2, 23, 1, PINE[5]); bb.rect(0, 10, 23, 1, PINE[1]);
        word((x, y, cc) => bb.set(x, y, cc), 2, 4, 'MUSIC', CREAM[4]);
      } else if (tier === 2) {
        // a polished brass plaque with a scroll at each end
        for (let y = 0; y < 11; y += 1) for (let x = 0; x < 25; x += 1) {
          if (!inEll(x, y, 12.5, 5.5, 12.5, 5.6) && (x < 2 || x > 22)) continue;
          bb.set(x, y, y < 2 ? GOLDS[5] : y > 8 ? GOLDS[1] : x < 3 ? GOLDS[4] : GOLDS[3]);
        }
        word((x, y, cc) => bb.set(x, y, cc), 3, 3, 'MUSIC', GOLDS[0]);
      } else {
        // a marquee: a black box ringed with bulbs, ROCK! in pink
        bb.rect(0, 0, 27, 13, DARK[1]);
        for (let x = 0; x < 27; x += 1) for (const y of [0, 12]) if (x % 3 === 0) bb.set(x, y, (x / 3 + f) % 2 ? '#fff6c8' : '#a8701e');
        for (let y = 3; y < 12; y += 3) for (const x of [0, 26]) bb.set(x, y, (y / 3 + f) % 2 ? '#fff6c8' : '#a8701e');
        word((x, y, cc) => bb.set(x, y, cc), 4, 4, 'ROCK!', NEON.pink);
      }
    }, { ground: false });
    b.blit(px, X + 1, 1);
  }
  put(c.getContext('2d'));
  return { url: c.toDataURL(), w, h, frames };
}

