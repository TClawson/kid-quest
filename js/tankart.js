// The fish tanks in the buddy's house, from the free little tank up to the wall aquarium, in
// the house's storybook pixel style (houseart.js). Each bigger tank holds more of the kid's fish
// (furniture.js: fish) and has more going on inside: the little tank has weed and a castle, the
// big tank a treasure chest, a driftwood log and a snail, the grand aquarium stands on its own
// cabinet with lights, a rock cave, red and green water plants, shrimp and a bubble wall, and
// the wall aquarium is a piece of the front wall turned into a reef: coral, kelp, a crab, a
// starfish on the glass and sunken treasure.
//
// The fish, their bubbles and the name plaque are put on top by house.js, in each tank's swim
// box (TANKS[...].water). Plants in front of the fish come back as a second, see-through layer
// (front), drawn over the fish.

import { mix, h2, bayer, grid, inEll, line, Buf } from './pixelkit.js';
import { sprite } from './houseart.js';

const WD = ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'];
const WP = ['#b0948a', '#d2b6a4', '#e8d2bc', '#f4e4cc', '#fdf2e0'];
const SAGE = ['#3e5650', '#56705e', '#6e8a70', '#8aa686', '#a8c2a0', '#cadcbc'];
const DARK = ['#2e1e2a', '#46303a', '#5e4044', '#78564e', '#94705e'];
const IRON = ['#262236', '#3a3550', '#4a4560', '#6e6a86', '#9894aa'];
const LEAF = ['#244a40', '#33704a', '#4a9450', '#6cb85a', '#9ed46a', '#d0ec8c'];
const RED = ['#7a1e2e', '#b03040', '#e0546a', '#f08c6a', '#ffc08a'];
const GOLD = ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];
const STONE = ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde'];
const SAND = ['#c8a070', '#dcb880', '#ecd09a', '#f8e4b8'];
const PEBBLE = ['#e8c890', '#d4a86a', '#f0a8a0', '#a0c8f0', '#c8a8e8', '#a8784a', '#fff4dc'];
const WATER = {
  clear: ['#c8eef8', '#94d4ec', '#68b8e0', '#4a9ccc', '#3a82b8'],
  green: ['#c4f0e4', '#90dcd0', '#62c0c0', '#46a2b4', '#3884a4'],
  reef: ['#bdf0fc', '#84d6f4', '#52b6e6', '#3696d0', '#2878b8', '#205e9e'],
};

/**
 * Each tank: where its art's top-left corner goes in the room (at), its size, the swim box for
 * the fish (water: [x, y, w, h] from the art's corner), where bubbles rise from (bubblers, and
 * how far: rise), the name plaque, the fish book's box (book), how many fish it holds, and where
 * the sports gear rack goes when the tank takes its corner (gear).
 */
export const TANKS = {
  tank: { fish: 1, at: { x: 132, y: 133 }, w: 62, h: 39, water: [3, 4, 41, 13], bubblers: [{ x: 13, y: 18 }], rise: 14, plaque: { x: 23, y: 31 }, book: [46, 12, 16, 13], glass: [1, 0, 45, 24] },
  'tank-big': { fish: 2, at: { x: 127, y: 129 }, w: 68, h: 43, water: [3, 4, 47, 17], bubblers: [{ x: 31, y: 18 }, { x: 10, y: 21 }], rise: 16, plaque: { x: 25, y: 35 }, book: [52, 14, 16, 13], glass: [1, 0, 51, 28] },
  'tank-grand': { fish: 3, at: { x: 126, y: 122 }, w: 86, h: 50, water: [3, 6, 63, 23], bubblers: [{ x: 6, y: 33 }, { x: 10, y: 33 }, { x: 14, y: 33 }, { x: 34, y: 28 }], rise: 27, plaque: { x: 34, y: 43 }, book: [70, 12, 16, 13], glass: [1, 0, 67, 37], gear: { x: 63, y: 134 } },
  'tank-wall': { fish: 5, at: { x: 126, y: 124 }, w: 110, h: 50, water: [5, 7, 84, 27], bubblers: [{ x: 52, y: 31 }, { x: 7, y: 39 }, { x: 84, y: 39 }, { x: 70, y: 37 }], rise: 31, plaque: { x: 46, y: 46 }, book: [91, 12, 16, 13], glass: [0, 0, 106, 42], gear: { x: 63, y: 134 } },
};

/** The tank spec for a furniture item's art ('tank' when there's none). */
export const tankSpec = (art) => TANKS[art] || TANKS.tank;

// ---------- drawing helpers ----------

/** Water from y0 to y1: light at the surface, deeper further down (dithered between bands). */
function water(b, x0, y0, x1, y1, pal) {
  const n = pal.length - 1;
  for (let y = y0; y <= y1; y += 1) {
    const band = Math.min(n, ((y - y0) / Math.max(1, y1 - y0)) * n * 1.05);
    const lo = Math.floor(band); const k = band - lo;
    for (let x = x0; x <= x1; x += 1) b.set(x, y, k > bayer(x, y) && lo < n ? pal[lo + 1] : pal[lo]);
  }
  for (let x = x0; x <= x1; x += 1) b.set(x, y0, pal[0]);
}
/** Tint a cell already drawn toward a color (light rays, shines): stays solid, so nothing shows through. */
function tint(b, x, y, c, a) {
  const was = b.get(x, y);
  if (was && was[0] === '#' && was.length === 7) b.set(x, y, mix(was, c, a));
}
/** Soft rays of light slanting down through the water. */
function rays(b, x0, y0, x1, y1, starts, a = 0.16) {
  for (const s of starts) {
    for (let y = y0; y <= y1; y += 1) {
      const fade = 1 - (y - y0) / (y1 - y0 + 1);
      for (let w = 0; w < 3; w += 1) { const x = s + w + Math.round((y - y0) * 0.35); if (x >= x0 && x <= x1) tint(b, x, y, '#ffffff', a * fade * (w === 1 ? 1.4 : 1)); }
    }
  }
}
/** Shines on the front glass: two thin slants near a corner. */
function shines(b, x, y, n = 6) {
  for (let i = 0; i < n; i += 1) { tint(b, x + i, y - i, '#ffffff', 0.45); tint(b, x + 2 + i, y - i, '#ffffff', 0.25); }
}
/** A swaying ribbon of weed from (x0, bottom) up to top: wiggles a pixel every few rows. */
function weed(b, x0, top, bottom, ph, c1 = LEAF[2], c2 = LEAF[4], wide = false) {
  for (let y = top; y <= bottom; y += 1) {
    const x = x0 + (Math.floor((y + ph) / 3) % 2);
    b.set(x, y, y % 3 === 0 ? c2 : c1);
    if (wide && y > top + 1) b.set(x + 1, y, y % 4 === 1 ? c2 : c1);
  }
}
/** A dithered round stone. */
function stone(b, cx, cy, rx, ry, pal = STONE) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
    if (!inEll(x, y, cx, cy, rx, ry)) continue;
    const lx = (x + 0.5 - cx) / rx; const ly = (y + 0.5 - cy) / ry;
    const light = -0.6 * lx - 0.8 * ly; // lit from the top left
    const i = Math.max(0, Math.min(pal.length - 1, Math.round(1.6 + light * 1.4 + (bayer(x, y) - 0.5) * 0.8)));
    b.set(x, y, pal[i]);
  }
}
/** Gravel along the bottom (bumpy top), little colored pebbles. */
function gravel(b, x0, x1, y0, y1, seed = 7) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
    if (y === y0 && h2(x, seed) < 0.45) continue;
    b.set(x, y, PEBBLE[Math.floor(h2(x * 3 + y, y * 7 + seed) * PEBBLE.length)]);
  }
}
/** Sand along the bottom: a gently rolling top, ripples, a few specks. */
function sand(b, x0, x1, y0, y1, seed = 3) {
  for (let x = x0; x <= x1; x += 1) {
    const top = y0 + Math.round(Math.sin(x * 0.19 + seed) * 1.2 + Math.sin(x * 0.07 + seed * 2) * 0.8);
    for (let y = top; y <= y1; y += 1) {
      let c = y === top ? SAND[3] : SAND[2 - Math.min(2, Math.floor((y - top) / 2))];
      if (y > top && (x + y * 3) % 9 === 0) c = SAND[3];
      if (h2(x * 5, y * 3 + seed) < 0.06) c = PEBBLE[Math.floor(h2(x, y) * 5)];
      b.set(x, y, c);
    }
  }
}
/** A glass frame round a box: dark rims top and bottom, the sides in pal. */
function frame(b, x0, y0, x1, y1, pal, rims = 2) {
  for (let x = x0; x <= x1; x += 1) {
    for (let r = 0; r < rims; r += 1) { b.set(x, y0 + r, pal[r === 0 ? 3 : 1]); b.set(x, y1 - r, pal[r === 0 ? 0 : 1]); }
  }
  for (let y = y0 + rims; y <= y1 - rims; y += 1) { b.set(x0, y, pal[2]); b.set(x1, y, pal[0]); }
}
/** The fish book, open on a little stand (top-left of its box at X, Y). */
function book(b, X, Y) {
  for (let y = 2; y < 10; y += 1) for (let x = 1; x < 15; x += 1) b.set(X + x, Y + y, '#2f6b4a');
  for (let y = 1; y < 9; y += 1) for (let x = 2; x < 14; x += 1) {
    if (y === 1 && (x === 2 || x === 7 || x === 8 || x === 13)) continue;
    b.set(X + x, Y + y, x === 7 || x === 8 ? '#e0d0a8' : x < 7 ? '#fdf4dc' : '#fffaf0');
  }
  grid((x, y, c) => b.set(x, y, c), X + 2, Y + 3, ['.oo..', 'oOoo.o', 'ooooo', '.oo..o'], { o: '#f08c3a', O: '#3b2235' });
  for (const y of [3, 5, 7]) for (let x = 9; x < 13; x += 1) if (!(y === 7 && x > 11)) b.set(X + x, Y + y, '#b0a090');
  for (let x = 4; x < 12; x += 1) b.set(X + x, Y + 10, WD[2]);
  for (const x of [5, 10]) b.set(X + x, Y + 11, WD[1]);
  for (let x = 3; x < 13; x += 1) b.set(X + x, Y + 12, WD[3]);
}
/** A cabinet of width w from y0 to y1: a top, doors ([from, to] x pairs), feet at the ends. */
function cabinet(b, x0, w, y0, y1, doors, pal = WD, knobs = []) {
  for (let y = y0; y <= y1; y += 1) for (let x = x0; x < x0 + w; x += 1) {
    if (y === y1 && x > x0 + 2 && x < x0 + w - 3) continue; // feet only at the ends
    let c = y === y0 ? pal[5] ?? pal[4] : y === y0 + 1 ? pal[4] : y >= y1 - 1 ? pal[1] : pal[3];
    if (y > y0 + 2 && y < y1 - 2) {
      for (const [a, z] of doors) {
        if (x === a || x === z || y === y0 + 3 || y === y1 - 3) { if (x >= a && x <= z) c = pal[2]; } else if (x > a && x < z) c = x === a + 1 || y === y0 + 4 ? pal[4] : pal[3];
      }
    }
    if (x === x0 || x === x0 + w - 1) c = pal[2];
    b.set(x, y, c);
  }
  for (const [x, y] of knobs) { b.set(x, y, GOLD[3]); b.set(x, y + 1, GOLD[1]); }
}
const CHEST = { b: '#6e3a2a', B: '#a8663e', y: '#ffe27a', Y: '#f0c040', k: '#4a2a36', w: '#fff6c8' };
/** A treasure chest with its lid up and gold showing (8 x 7). */
function chest(b, X, Y) {
  grid((x, y, c) => b.set(x, y, c), X, Y, ['.bBBBBb.', 'bBbbbbBb', 'kwyYyywk', 'bbbbbbbb', 'bBbYYbBb', 'bBbkkbBb', 'bbbbbbbb'], CHEST);
}
/** A snail stuck to the glass (5 x 4). */
function snail(b, X, Y) {
  grid((x, y, c) => b.set(x, y, c), X, Y, ['.ss..', 'sSss.', 'sssse', 'ffffF'], { s: '#c8783a', S: '#f0c060', f: '#e8d6b0', F: '#b0948a', e: '#3b2235' });
}

// ---------- the four tanks ----------

/** The little tank (free): weed, broad leaves, a castle and a bubbling stone, on a low cabinet. */
function littleTank() {
  const T = TANKS.tank;
  return sprite(T.w, T.h, (b) => {
    water(b, 2, 3, 44, 21, WATER.clear);
    gravel(b, 2, 44, 18, 21);
    for (const [x0, top, ph] of [[4, 7, 0], [6, 10, 2], [8, 8, 1]]) weed(b, x0, top, 18, ph);
    grid((x, y, c) => b.set(x, y, c), 37, 7, ['..l...', '.lL.l.', '.lLlL.', 'l.lLL.', 'lLl.Ll', '.lLlL.', '..lLl.', '..ss..', '..ss..', '..ss..', '.ssss.'], { l: LEAF[3], L: LEAF[5], s: LEAF[1] });
    grid((x, y, c) => b.set(x, y, c), 26, 11, ['g.g.g.', 'gGgGgg', 'gGgggg', 'ggkkgg', 'gGkkgg', 'ggkkgg', 'gggggg'], { g: '#9894aa', G: '#c0bcc8', k: '#4a4560' });
    grid((x, y, c) => b.set(x, y, c), 11, 17, ['.ss.', 'sSss'], { s: '#6e6a86', S: '#9894aa' });
    frame(b, 1, 0, 45, 23, [SAGE[0], SAGE[1], SAGE[2], SAGE[3]], 2);
    for (let x = 1; x < 46; x += 1) { b.set(x, 0, SAGE[3]); b.set(x, 1, SAGE[1]); b.set(x, 2, SAGE[0]); }
    for (let x = 14; x < 32; x += 1) b.set(x, 1, '#fff4c8'); // the lid's light
    shines(b, 5, 11);
    for (let i = 0; i < 3; i += 1) tint(b, 40 + i, 6 - i, '#ffffff', 0.4);
    cabinet(b, 0, 62, 24, 38, [[3, 22], [24, 43], [47, 58]], WD, [[20, 31], [26, 31], [50, 31]]);
    book(b, T.book[0], T.book[1]);
  });
}

/** The big tank (2 fish): a driftwood log, a treasure chest that bubbles, shells and a snail. */
function bigTank() {
  const T = TANKS['tank-big'];
  return sprite(T.w, T.h, (b) => {
    water(b, 2, 3, 50, 25, WATER.clear);
    rays(b, 2, 4, 50, 20, [12, 30], 0.12);
    gravel(b, 2, 50, 21, 25, 11);
    // weed at the back left, a broad-leaf plant at the right
    for (const [x0, top, ph] of [[4, 6, 0], [6, 9, 2], [8, 7, 1], [10, 12, 0]]) weed(b, x0, top, 22, ph);
    grid((x, y, c) => b.set(x, y, c), 42, 9, ['..l....', '.lL.l..', '.lLlLl.', 'l.lLL.l', 'lLl.LlL', '.lLlLl.', 'l.lLl..', '.lLsl..', '..ss...', '..ss...', '..ss...', '..ss...', '.ssss..'], { l: LEAF[3], L: LEAF[5], s: LEAF[1] });
    // a driftwood log leaning on a stone, a little branch off it
    stone(b, 22, 21, 4, 2.6);
    line(13, 22, 26, 14, (x, y, t) => { b.set(x, y, WD[t > 0.8 ? 3 : 2]); b.set(x, y + 1, WD[1]); b.set(x + 1, y + 1, WD[0]); });
    line(20, 18, 22, 13, (x, y) => b.set(x, y, WD[2]));
    b.set(23, 12, LEAF[3]); b.set(22, 12, LEAF[4]);
    // the treasure chest, shells on the gravel
    chest(b, 28, 17);
    grid((x, y, c) => b.set(x, y, c), 37, 22, ['.pp.', 'pPPp'], { p: '#e0709a', P: '#ffd0e0' });
    grid((x, y, c) => b.set(x, y, c), 46, 23, ['ww.', 'wWw'], { w: '#e8d6cc', W: '#fffaf0' });
    // the frame, the lid's light, a snail on the glass, shines
    frame(b, 1, 0, 51, 27, [SAGE[0], SAGE[1], SAGE[2], SAGE[3]], 2);
    for (let x = 1; x <= 51; x += 1) { b.set(x, 0, SAGE[3]); b.set(x, 1, SAGE[1]); b.set(x, 2, SAGE[0]); }
    for (let x = 12; x < 40; x += 1) b.set(x, 1, '#fff4c8');
    snail(b, 46, 6);
    shines(b, 4, 14, 7);
    for (let i = 0; i < 4; i += 1) tint(b, 44 + i, 8 - i, '#ffffff', 0.4);
    cabinet(b, 0, 68, 28, 42, [[3, 24], [26, 48], [52, 64]], WD, [[22, 35], [28, 35], [55, 35]]);
    book(b, T.book[0], T.book[1]);
  });
}

/**
 * The grand aquarium (3 fish), on a dark cabinet under a lit hood: a rock cave, tall green and
 * red plants, a carpet of little plants, shrimp, a snail and a bubble wall at the back left.
 * The fish book stands on a little table beside it.
 */
function grandTank() {
  const T = TANKS['tank-grand'];
  return sprite(T.w, T.h, (b) => {
    water(b, 2, 4, 66, 34, WATER.green);
    rays(b, 2, 5, 66, 30, [10, 30, 46], 0.15);
    sand(b, 2, 66, 30, 34, 2);
    // tall plants all along the back
    for (const [x0, top, ph] of [[3, 7, 0], [5, 10, 2], [7, 6, 1], [20, 12, 1], [22, 9, 0], [41, 11, 2], [43, 8, 0], [62, 9, 1], [64, 13, 0]]) weed(b, x0, top, 31, ph, LEAF[1], LEAF[3], true);
    // red plants at the right: stems with leaf pairs
    for (const [x0, top] of [[52, 8], [55, 11], [58, 9]]) {
      for (let y = top; y <= 31; y += 1) b.set(x0, y, '#7a4436');
      for (let y = top; y < 30; y += 3) { b.set(x0 - 1, y, RED[2]); b.set(x0 + 1, y, RED[3]); b.set(x0 - 2, y + 1, RED[1]); b.set(x0 + 2, y + 1, RED[2]); }
      b.set(x0, top - 1, RED[4]);
    }
    // the rock cave in the middle, with a fern on top
    stone(b, 34, 29, 11, 8);
    stone(b, 26, 31, 5, 4);
    stone(b, 43, 31, 5, 4);
    for (let y = 26; y <= 33; y += 1) for (let x = 30; x <= 38; x += 1) if (inEll(x, y, 34, 33, 4, 6)) b.set(x, y, y < 28 ? STONE[0] : '#2a2638');
    grid((x, y, c) => b.set(x, y, c), 29, 17, ['..l..l..', '.lLl.Ll.', 'l.lLlL.l', '.lLlLLl.', '..llll..'], { l: LEAF[2], L: LEAF[4] });
    // a carpet of little plants on the sand
    for (let x = 3; x < 66; x += 1) {
      if (x > 22 && x < 47) continue;
      const top = 30 + Math.round(Math.sin(x * 0.19 + 2) * 1.2 + Math.sin(x * 0.07 + 4) * 0.8);
      if (h2(x, 31) < 0.7) { b.set(x, top - 1, x % 3 ? LEAF[3] : LEAF[4]); if (h2(x, 9) < 0.4) b.set(x, top - 2, LEAF[4]); }
    }
    // shrimp and a snail
    grid((x, y, c) => b.set(x, y, c), 24, 25, ['.rr.', 'rRrr', '.r.r'], { r: RED[2], R: RED[4] });
    grid((x, y, c) => b.set(x, y, c), 47, 27, ['rr..', 'rrRr', 'r.r.'], { r: RED[1], R: RED[3] });
    snail(b, 60, 13);
    // the bubble wall: an air bar along the back left
    for (let x = 4; x < 17; x += 1) b.set(x, 33, x % 2 ? STONE[1] : STONE[2]);
    // the hood with its lights, the glass rims
    for (let y = 0; y < 4; y += 1) for (let x = 0; x < 69; x += 1) b.set(x, y, y === 0 ? IRON[3] : y === 3 ? IRON[0] : IRON[2]);
    for (const [a, z] of [[8, 28], [40, 60]]) for (let x = a; x < z; x += 1) { b.set(x, 3, '#fff4c8'); b.set(x, 4, mix(WATER.green[0], '#fff4c8', 0.6)); }
    for (let x = 0; x < 69; x += 1) { b.set(x, 35, IRON[1]); b.set(x, 36, IRON[0]); }
    for (let y = 4; y < 35; y += 1) { b.set(1, y, IRON[2]); b.set(67, y, IRON[0]); }
    shines(b, 5, 20, 8);
    for (let i = 0; i < 5; i += 1) tint(b, 58 + i, 12 - i, '#ffffff', 0.35);
    // the dark wood cabinet under it, with brass knobs
    cabinet(b, 0, 69, 37, 49, [[3, 33], [35, 65]], [...DARK, '#b08a6e'], [[31, 42], [37, 42]]);
    // the little table with the fish book
    for (let x = 69; x < 86; x += 1) { b.set(x, 25, DARK[4]); b.set(x, 26, DARK[3]); b.set(x, 27, DARK[1]); }
    for (let y = 28; y < 50; y += 1) for (const x of [71, 83]) { b.set(x, y, DARK[3]); b.set(x + 1, y, DARK[1]); }
    for (let x = 72; x < 83; x += 1) b.set(x, 40, DARK[2]);
    book(b, T.book[0], T.book[1]);
  });
}

/** The grand aquarium's plants in front of the fish. */
function grandFront() {
  const T = TANKS['tank-grand'];
  const b = new Buf(T.w, T.h, 3);
  for (const [x0, top, ph] of [[13, 24, 0], [15, 26, 1], [64, 22, 2]]) weed(b, x0, top, 33, ph, LEAF[2], LEAF[4]);
  for (let x = 28; x < 34; x += 1) if (x % 2) b.set(x, 33, LEAF[3]);
  b.w = T.w; b.h = T.h;
  return b;
}

/**
 * The wall aquarium (5 fish): a piece of the front wall, wallpaper pillars and the wainscot
 * below like the back wall, the glass full of reef. A niche at the right holds the fish book
 * and a jar of shells.
 */
function wallTank() {
  const T = TANKS['tank-wall'];
  return sprite(T.w, T.h, (b) => {
    // the wall round it: pillars of wallpaper, a wooden beam with little lights, the wainscot
    for (let y = 0; y < 42; y += 1) for (const [a, z] of [[0, 3], [90, 92], [106, 109]]) for (let x = a; x <= z; x += 1) b.set(x, y, x === a ? WP[1] : x === z ? WP[0] : (y % 6 === 2 && x === a + 1) ? '#e8a0a0' : WP[3]);
    for (let x = 0; x < 110; x += 1) {
      b.set(x, 0, WD[5]); b.set(x, 1, WD[4]); b.set(x, 2, WD[3]); b.set(x, 3, WD[2]); b.set(x, 4, WD[1]);
      if (x > 4 && x < 90 && x % 6 === 3) { b.set(x, 3, GOLD[5]); b.set(x, 4, GOLD[4]); }
    }
    for (let y = 42; y < 50; y += 1) for (let x = 0; x < 110; x += 1) {
      let c = y === 42 ? WD[4] : y === 43 ? WD[2] : y === 49 ? SAGE[0] : (x % 8 === 0 ? SAGE[1] : x % 8 === 1 ? SAGE[4] : SAGE[3]);
      if (y === 48) c = SAGE[1];
      b.set(x, y, c);
    }
    // the niche: a shelf with the fish book, a jar of shells under it
    for (let y = 5; y < 42; y += 1) for (let x = 93; x < 106; x += 1) b.set(x, y, y < 7 ? WP[0] : (x + y) % 5 === 0 ? WP[1] : WP[2]);
    for (let x = 93; x < 106; x += 1) { b.set(x, 26, WD[4]); b.set(x, 27, WD[2]); b.set(x, 28, WD[1]); }
    book(b, T.book[0], T.book[1]);
    grid((x, y, c) => b.set(x, y, c), 96, 31, ['.gggggg.', 'g.....Gg', 'gpw.y.Gg', 'g.yww.pg', 'gwpyywwg', 'gwwpwyyg', '.gggggg.'], { g: '#9cc8d0', G: '#e8f8fc', p: '#f0a8a0', w: '#fff4dc', y: '#f0c060' });
    for (let i = 0; i < 7; i += 1) for (let x = 97; x < 103; x += 1) if (!b.get(x, 32 + i)) b.set(x, 32 + i, '#cfeaf0');
    for (let x = 93; x < 106; x += 1) b.set(x, 41, WP[0]);

    // the reef: deep blue water, rays of light, sand
    water(b, 4, 5, 89, 41, WATER.reef);
    rays(b, 4, 6, 89, 36, [8, 30, 52, 70], 0.17);
    sand(b, 4, 89, 37, 41, 5);
    // kelp at the back, tall and swaying
    for (const [x0, top, ph] of [[24, 7, 0], [28, 11, 2], [33, 9, 1], [78, 10, 0]]) weed(b, x0, top, 38, ph, '#5a7a2a', '#9ab048', true);
    // the left reef: stacked rocks with coral
    stone(b, 11, 34, 9, 7);
    stone(b, 8, 26, 5, 5);
    stone(b, 17, 29, 5, 4);
    // a pink brain coral, an orange fan coral, a purple branch coral
    for (let y = 27; y < 35; y += 1) for (let x = 12; x < 21; x += 1) if (inEll(x, y, 16.5, 31, 4.5, 3.5)) b.set(x, y, (x * 2 + Math.floor(y * 1.5)) % 4 === 0 ? '#c0507a' : y < 30 ? '#ffb0c8' : '#f080a0');
    line(8, 21, 8, 13, (x, y) => b.set(x, y, '#d8602a'));
    for (const [x1, y1] of [[3, 12], [5, 9], [11, 9], [13, 13], [6, 15], [10, 15]]) line(8, 19, x1 + 1, y1, (x, y) => b.set(x, y, (x + y) % 2 ? '#f08c3a' : '#ffb070'));
    for (const [x1, y1] of [[20, 18], [23, 21], [17, 20]]) line(20, 26, x1, y1, (x, y, t) => b.set(x, y, t > 0.8 ? '#e0b0ff' : '#9a5ad0'));
    // treasure in the middle, half in the sand, coins spilled out
    chest(b, 48, 31);
    grid((x, y, c) => b.set(x, y, c), 44, 37, ['.y..Y', 'yYy.yY'], { y: GOLD[4], Y: GOLD[3] });
    for (let x = 47; x < 57; x += 1) b.set(x, 38, SAND[2]);
    // a crab on the sand, a clam
    grid((x, y, c) => b.set(x, y, c), 36, 34, ['r.....r', 'rr.e.rr', '.rRRRr.', 'r.rrr.r'], { r: '#d8443a', R: '#ff8a7a', e: '#3b2235' });
    grid((x, y, c) => b.set(x, y, c), 60, 37, ['.ccc.', 'cCwCc', 'ccccc'], { c: '#b088c8', C: '#e0c0f0', w: '#ffffff' });
    // the right reef: a rock arch with an anemone and a sea urchin
    stone(b, 73, 33, 6, 6);
    stone(b, 85, 31, 5, 8);
    for (let x = 72; x < 86; x += 1) for (let y = 21; y < 26; y += 1) if (inEll(x, y, 79, 25, 8, 4.5) && !inEll(x, y, 79, 27, 5, 3)) b.set(x, y, STONE[(x + y) % 3 === 0 ? 1 : y < 23 ? 3 : 2]);
    for (let y = 26; y < 38; y += 1) for (let x = 76; x < 81; x += 1) if (inEll(x, y, 78.5, 32, 3, 7)) b.set(x, y, WATER.reef[5]);
    for (let i = 0; i < 9; i += 1) { const x = 74 + i; const h = 3 + (i % 3); for (let y = 0; y < h; y += 1) b.set(x + (y === h - 1 ? (i % 2 ? 1 : -1) : 0), 21 - y, y === h - 1 ? '#ffd0e8' : '#f070b0'); }
    grid((x, y, c) => b.set(x, y, c), 66, 23, ['u.u.u', '.uUu.', 'uUUUu', '.uuu.'], { u: '#4a2a6a', U: '#7a4ab0' });
    // seagrass tufts on the sand
    for (const x0 of [42, 58, 64, 69]) for (let i = 0; i < 3; i += 1) line(x0 + i, 38, x0 + i + (i - 1), 34 + (i % 2), (x, y) => b.set(x, y, LEAF[2 + (i % 2)]));
    // a starfish stuck on the glass, shines
    grid((x, y, c) => b.set(x, y, c), 55, 9, ['..o..', '..o..', 'ooOoo', '.oOo.', 'o...o'], { o: '#f08c3a', O: '#ffd23f' });
    shines(b, 7, 18, 9);
    for (let i = 0; i < 6; i += 1) tint(b, 82 + i, 13 - i, '#ffffff', 0.35);
    // the glass rim inside the frame
    for (let y = 5; y < 42; y += 1) { tint(b, 4, y, '#000000', 0.25); tint(b, 89, y, '#ffffff', 0.2); }
  }, { inkUp: 0 });
}

/** The wall aquarium's reef in front of the fish: seagrass and the front of the left rocks. */
function wallFront() {
  const T = TANKS['tank-wall'];
  const b = new Buf(T.w, T.h, 3);
  for (const [x0, top, ph] of [[20, 27, 0], [22, 29, 1], [67, 28, 2], [69, 30, 0]]) weed(b, x0, top, 40, ph, LEAF[2], LEAF[4]);
  stone(b, 5, 39, 4, 2.5);
  b.w = T.w; b.h = T.h;
  return b;
}

const ART = { tank: littleTank, 'tank-big': bigTank, 'tank-grand': grandTank, 'tank-wall': wallTank };
const FRONT = { 'tank-grand': grandFront, 'tank-wall': wallFront };
const cache = new Map();

/** A tank's art (a houseart.js sprite) by its furniture art key. */
export function tankArt(art) {
  const key = ART[art] ? art : 'tank';
  if (!cache.has(key)) cache.set(key, ART[key]());
  return cache.get(key);
}
/** The plants in front of the fish (a Buf, see-through), or null for the smaller tanks. */
export function tankFront(art) {
  if (!FRONT[art]) return null;
  const key = `front|${art}`;
  if (!cache.has(key)) cache.set(key, FRONT[art]());
  return cache.get(key);
}

// little fish for the shop's pictures (the real ones are the kid's own catches)
const SHOP_FISH = [
  [['.oo.o', 'oOooo', '.oo.o'], { o: '#f08c3a', O: '#3b2235' }],
  [['.bb.b', 'bBbbb', '.bb.b'], { b: '#4dabf7', B: '#3b2235' }],
  [['.yyy.y', 'yYyyyy', '.yyy.y'], { y: '#ffd23f', Y: '#3b2235' }],
  [['.pp.p', 'pPppp', '.pp.p'], { p: '#e0709a', P: '#3b2235' }],
  [['.gg.g', 'gGggg', '.gg.g'], { g: '#69db7c', G: '#3b2235' }],
];
/** The tank for the shop: its art with a few little fish swimming in it, and the front plants. */
export function tankThumb(art) {
  const T = tankSpec(art);
  const src = tankArt(art);
  const b = new Buf(T.w, T.h, src.pad);
  src.each((x, y) => { const c = src.get(x, y); if (c) b.set(x, y, c); });
  const [wx, wy, ww, wh] = T.water;
  for (let i = 0; i < T.fish; i += 1) {
    const [rows, pal] = SHOP_FISH[i];
    const fx = wx + 3 + Math.round(((i * 37) % 100) / 100 * (ww - 12));
    const fy = wy + 2 + Math.round((((i * 53) + 20) % 100) / 100 * (wh - 6));
    grid((x, y, c) => b.set(x, y, c), fx, fy, i % 2 ? rows.map((r) => [...r].reverse().join('')) : rows, pal);
  }
  const front = tankFront(art);
  if (front) front.each((x, y) => { const c = front.get(x, y); if (c) b.set(x, y, c); });
  b.w = T.w; b.h = T.h;
  return b;
}
