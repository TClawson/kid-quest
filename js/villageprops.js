// The pieces each village is built from (see villagemaps.js for where they stand): the
// ground, the water that splits morning from after school, bridges, houses in each map's
// style, and props (palms, coral, craters, crystals...). Everything is drawn at one canvas
// pixel per village pixel, lit from the top left with a dark outline, like the meadow's
// hand-drawn trees and cottages in villageart.js.

import {
  OUT, shade, hashXY, seeded, painter, bigTree, bush, cottage, well, fence, garden, laundry, plaza, flower, noteSign, pond, frozen,
} from './villageart.js';
import { paintMeadow, lanternB, birdhouseB, mailboxB, scarecrowB, benchB, barrowB, mushroomsB, snailB } from './meadowart.js';

// ---------- a lit shape ----------

/**
 * Paints a shape w x h at X, Y. colorAt(x, y) gives a cell's color, or null outside the shape.
 * Edges facing the top left are lit, edges facing the bottom right are shaded, the outside
 * gets a one-pixel outline. o: { hi, lo, tex (speckle amount), outline (false: none) }.
 */
export function blob(px, X, Y, w, h, colorAt, o = {}) {
  const at = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : colorAt(x, y));
  const hi = o.hi ?? 0.28; const lo = o.lo ?? 0.24; const tex = o.tex ?? 0.12;
  for (let y = -1; y <= h; y += 1) {
    for (let x = -1; x <= w; x += 1) {
      const c = at(x, y);
      if (!c) {
        if (o.outline !== false && (at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1))) px(X + x, Y + y, o.outline || OUT);
        continue;
      }
      let k = 0;
      if (!at(x, y - 1) || !at(x - 1, y)) k = hi;
      else if (!at(x, y + 1) || !at(x + 1, y)) k = -lo;
      else if (!at(x - 1, y - 2) || !at(x - 2, y - 1)) k = hi * 0.4;
      else if (!at(x + 1, y + 2) || !at(x + 2, y + 1)) k = -lo * 0.4;
      // a seam where two colors meet, so parts read apart
      else if (o.seams && at(x, y - 1) !== c) k = -0.18;
      const t = hashXY(X + x, Y + y);
      if (!k && tex) k = t < tex ? -0.1 : t > 1 - tex ? 0.08 : 0;
      px(X + x, Y + y, k ? shade(c, k) : c);
    }
  }
}

const ell = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const shadow = (px, X, Y, w) => px(X, Y, 'rgba(27,20,48,0.2)', w, 2);

// ---------- props ----------

/** A palm: a ringed trunk leaning a little, and fronds drooping from the top. 36 x 44. */
function palm(px, X, Y, pal = {}) {
  const G = pal.G || '#2f9e44'; const g = pal.g || '#8ce99a'; const T = pal.T || '#a0612f';
  shadow(px, X + 8, Y + 42, 20);
  blob(px, X, Y, 36, 44, (x, y) => {
    if (y >= 14) {
      const cx = 18 + Math.round(((44 - y) / 30) ** 2 * 3);
      if (x >= cx - 2 && x <= cx + 2) return (y % 4 === 0) ? shade(T, -0.25) : T;
    }
    return null;
  }, { tex: 0 });
  // fronds: arcs out from the crown, wide in the middle, drooping at the tips, with a light midrib
  const fronds = [[-1, -0.2], [1, -0.2], [-0.9, 0.45], [0.9, 0.45], [-0.45, -1], [0.45, -1], [0, -0.7], [-1, 0.9], [1, 0.9]];
  blob(px, X, Y, 36, 32, (x, y) => {
    for (const [dx, dy] of fronds) {
      const len = Math.hypot(dx, dy) > 1.1 ? 13 : 17;
      for (let s2 = 0; s2 <= 1; s2 += 0.04) {
        const fx = 18 + dx * s2 * len; const fy = 14 + dy * s2 * 9 + s2 * s2 * 8;
        const r = 3.6 * Math.sin(Math.PI * Math.min(1, s2 + 0.15)) + 0.8;
        const d2 = (x + 0.5 - fx) ** 2 + (y + 0.5 - fy) ** 2;
        if (d2 <= r * r) return d2 < 0.8 && s2 > 0.15 ? g : (s2 > 0.6 && (x + y) % 3 === 0 ? g : G);
      }
    }
    return null;
  }, { tex: 0.15, seams: true });
  // coconuts
  px(X + 16, Y + 16, '#5c3a1e', 2, 2); px(X + 19, Y + 17, '#5c3a1e', 2, 2); px(X + 16, Y + 16, '#8b5a2b');
}

/** A rock: a lit lump. w x h, color c. */
function rock(px, X, Y, w = 22, h = 16, c = '#adb5bd') {
  shadow(px, X + 2, Y + h, w - 2);
  blob(px, X, Y, w, h, (x, y) => (ell(x, y * 1.15, w / 2, h / 2 + 1.5, w / 2, h / 2 + 1) ? c : null), { tex: 0.2 });
}

/** Branching coral, w 24 x 22, color c. */
function coral(px, X, Y, c = '#ff8787') {
  const arms = [[12, 21, 12, 8], [12, 14, 5, 5], [12, 12, 19, 3], [5, 6, 3, 1], [19, 4, 21, 0], [12, 9, 13, 0]];
  blob(px, X, Y, 24, 22, (x, y) => {
    for (const [x0, y0, x1, y1] of arms) {
      const dx = x1 - x0; const dy = y1 - y0; const l = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / l));
      if (Math.hypot(x + 0.5 - (x0 + t * dx), y + 0.5 - (y0 + t * dy)) < 2.9 - t * 0.6) return c;
    }
    return null;
  }, { tex: 0.25 });
}

/** Kelp: three wavy strands, 16 x 42. */
function kelp(px, X, Y, pal = {}) {
  const G = pal.G || '#2b8a3e'; const g = pal.g || '#69db7c';
  blob(px, X, Y, 16, 42, (x, y) => {
    for (const [bx, top, ph] of [[4, 4, 0], [8, 0, 1.5], [12, 8, 3]]) {
      if (y < top) continue;
      const cx = bx + Math.sin(y / 5 + ph) * 1.6;
      if (Math.abs(x + 0.5 - cx) < 1.4) return y % 7 === 3 ? g : G;
      // little leaves
      if (y % 6 === 2 && Math.abs(x + 0.5 - (cx + 2)) < 1.2) return g;
    }
    return null;
  }, { tex: 0 });
}

/** A giant clam with a pearl, 26 x 18. */
function clam(px, X, Y) {
  shadow(px, X + 2, Y + 17, 22);
  blob(px, X, Y, 26, 18, (x, y) => {
    if (y < 9 && ell(x, y, 13, 9, 13, 9)) return (x % 4 === 0) ? '#e599f7' : '#f3d9fa';
    if (y >= 9 && ell(x, y, 13, 9, 12, 8)) return (x % 4 === 0) ? '#da77f2' : '#eebefa';
    return null;
  }, { tex: 0 });
  px(X + 11, Y + 8, OUT, 5, 4); px(X + 12, Y + 8, '#ffffff', 3, 3); px(X + 12, Y + 8, '#fff9db');
}

/** An old anchor half in the sand, 20 x 26. */
function anchor(px, X, Y) {
  blob(px, X, Y, 20, 26, (x, y) => {
    if (y < 5 && ell(x, y, 10, 3, 3.5, 3.5) && !ell(x, y, 10, 3, 1.5, 1.5)) return '#868e96';
    if (x >= 9 && x <= 10 && y >= 5 && y < 22) return '#868e96';
    if (y >= 8 && y <= 9 && x >= 5 && x <= 14) return '#868e96';
    if (y >= 16 && y < 24 && ell(x, y, 10, 15, 9, 8) && !ell(x, y, 10, 15, 7, 6.5) && y > 16) return '#868e96';
    return null;
  }, { tex: 0 });
  px(X + 4, Y + 24, '#c9a35d', 12, 2);
}

/** A flat crater with a lit rim, w x h. */
function crater(px, X, Y, w = 36, h = 18, pal = {}) {
  const d = pal.d || '#5c6088'; const D = pal.D || '#6a6f96'; const l = pal.l || '#a5aacf';
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      if (!ell(x, y, w / 2, h / 2, w / 2, h / 2)) continue;
      const inner = ell(x, y, w / 2, h / 2 + 1, w / 2 - 3, h / 2 - 2.5);
      if (!inner) px(X + x, Y + y, y < h / 2 ? d : l);
      else px(X + x, Y + y, y < h / 2 - 1 ? shade(D, -0.15) : D);
    }
  }
}

/** A crystal cluster, 20 x 24: a tall point and two short ones. */
function crystal(px, X, Y, c = '#99e9f2', C = '#3bc9db') {
  shadow(px, X + 2, Y + 23, 16);
  const shards = [[10, 0, 4, 24], [4, 9, 3, 24], [16, 11, 3, 24]];
  blob(px, X, Y, 20, 24, (x, y) => {
    for (const [cx, top, half, bot] of shards) {
      if (y < top || y >= bot) continue;
      const wdt = Math.min(half, ((y - top) / 4) * half + 0.6);
      if (Math.abs(x + 0.5 - cx) <= wdt) return x + 0.5 < cx ? c : C;
    }
    return null;
  }, { tex: 0, hi: 0.4 });
  px(X + 9, Y + 4, '#ffffff', 1, 4);
}

/** A tall glowing spire, 22 x 46. */
function spire(px, X, Y, c = '#ffe066', C = '#f59f00') {
  shadow(px, X + 3, Y + 45, 16);
  blob(px, X, Y, 22, 46, (x, y) => {
    const half = Math.min(8, 1 + y * 0.2);
    if (Math.abs(x + 0.5 - 11) <= half && y < 46) return x < 11 ? c : C;
    // a small side spire
    const h2 = Math.min(3, (y - 22) * 0.25);
    if (y > 22 && Math.abs(x + 0.5 - 19) <= h2) return C;
    return null;
  }, { tex: 0, hi: 0.4 });
  for (let y = 8; y < 40; y += 8) px(X + 10, Y + y, '#ffffff', 2, 1);
}

/** An antenna dish on a post, 28 x 32. */
function dish(px, X, Y) {
  shadow(px, X + 6, Y + 31, 18);
  blob(px, X, Y, 28, 32, (x, y) => {
    if (y >= 18 && x >= 12 && x <= 15) return '#868e96';
    if (y >= 26 && x >= 7 && x <= 20) return '#495057';
    if (y < 18 && ell(x, y, 13, 9, 12, 8) && !ell(x - 3, y + 3, 13, 9, 11, 7)) return '#e9ecef';
    return null;
  }, { tex: 0 });
  px(X + 14, Y + 3, OUT, 2, 7); px(X + 13, Y + 1, '#ff6b6b', 3, 3);
}

/** A lamp post with a glowing top (light color c), 10 x 32. */
function lamp(px, X, Y, c = '#ffd43b', post = '#495057') {
  shadow(px, X + 1, Y + 31, 8);
  px(X + 4, Y + 8, OUT, 3, 24); px(X + 5, Y + 8, post, 1, 23);
  px(X + 1, Y + 29, OUT, 9, 3); px(X + 2, Y + 30, post, 7, 1);
  px(X + 1, Y, OUT, 9, 9); px(X + 2, Y + 1, c, 7, 7); px(X + 3, Y + 2, '#ffffff', 2, 2);
  px(X - 1, Y + 3, `${c}55`, 13, 3);
}

/** A flag on a pole, 16 x 30, color c. */
function flag(px, X, Y, c = '#ff6b6b') {
  shadow(px, X, Y + 29, 6);
  px(X, Y, OUT, 3, 30); px(X + 1, Y + 1, '#dee2e6', 1, 28);
  blob(px, X + 3, Y + 1, 13, 9, (x, y) => (y < 9 - Math.abs(x - 6) * 0.2 && y >= Math.sin(x / 2) * 0.8 ? c : null), { tex: 0 });
}

/** A beach umbrella over a towel, 32 x 36, stripes c. */
function umbrella(px, X, Y, c = '#ff6b6b') {
  px(X + 6, Y + 26, OUT, 20, 10); px(X + 7, Y + 27, '#74c0fc', 18, 8);
  for (let x = 7; x < 25; x += 4) px(X + x, Y + 27, '#ffffff', 2, 8);
  px(X + 15, Y + 8, OUT, 3, 26); px(X + 16, Y + 8, '#f8f9fa', 1, 25);
  blob(px, X, Y, 32, 14, (x, y) => (ell(x, y * 1.6, 16, 16, 16, 16) && y < 12 ? (Math.floor((x - 16) / 5 + 10) % 2 ? c : '#ffffff') : null), { tex: 0 });
}

/** A sandcastle with a little flag, 30 x 26. */
function sandcastle(px, X, Y) {
  shadow(px, X + 2, Y + 25, 26);
  const S = '#e5b574';
  blob(px, X, Y, 30, 26, (x, y) => {
    if (y >= 12 && x >= 2 && x < 28) return y > 12 && (x === 8 || x === 21) && y < 17 ? shade(S, -0.3) : S;
    if (y >= 4 && ((x >= 3 && x < 10) || (x >= 20 && x < 27))) return (y === 4 && x % 2) ? null : S;
    if (y >= 8 && x >= 11 && x < 19) return (y === 8 && x % 2) ? null : S;
    return null;
  }, { tex: 0.2 });
  px(X + 13, Y + 21, OUT, 4, 5); px(X + 14, Y + 22, '#a0612f', 2, 4);
  px(X + 14, Y - 2, OUT, 1, 10); px(X + 15, Y - 2, '#ff6b6b', 4, 3);
}

/** A surfboard stuck in the sand, 10 x 30, color c. */
function surfboard(px, X, Y, c = '#4dabf7') {
  shadow(px, X, Y + 29, 10);
  blob(px, X, Y, 10, 30, (x, y) => (ell(x, y, 5, 15, 4.5, 15) ? (Math.abs(x + 0.5 - 5) < 1 ? '#ffffff' : c) : null), { tex: 0 });
}

/** A stone fountain with water, 40 x 32. */
function fountain(px, X, Y) {
  shadow(px, X + 2, Y + 31, 36);
  blob(px, X, Y + 14, 40, 18, (x, y) => (ell(x, y, 20, 9, 20, 9) ? (ell(x, y, 20, 8, 16, 6) ? '#4dabf7' : '#ced4da') : null), { tex: 0.1 });
  blob(px, X + 16, Y + 4, 8, 16, (x, y) => (x >= 2 && x < 6 ? '#adb5bd' : y < 4 ? '#ced4da' : null), { tex: 0 });
  // the spray
  [[19, 0], [21, -1], [17, 2], [23, 2], [15, 6], [25, 6], [14, 11], [26, 11]].forEach(([x, y]) => px(X + x, Y + y, '#a5d8ff', 2, 2));
  px(X + 10, Y + 20, '#d0ebff', 6, 1); px(X + 24, Y + 23, '#d0ebff', 5, 1);
}

/** A banner on a pole, 12 x 38, color c. */
function banner(px, X, Y, c = '#7048e8') {
  shadow(px, X + 2, Y + 37, 8);
  px(X + 5, Y, OUT, 3, 38); px(X + 6, Y + 1, '#8b5a2b', 1, 36);
  px(X, Y + 2, OUT, 13, 2);
  blob(px, X + 1, Y + 4, 11, 18, (x, y) => (y < 14 || Math.abs(x - 5) > y - 14 ? (y > 5 && y < 9 && x > 3 && x < 7 ? '#fcc419' : c) : null), { tex: 0 });
}

/** A hay bale, 22 x 16. */
function haybale(px, X, Y) {
  shadow(px, X + 1, Y + 15, 20);
  blob(px, X, Y, 22, 16, (x, y) => (ell(x, y, 11, 8, 11, 8) || (y > 3 && y < 15 && x > 1 && x < 21) ? (x % 5 === 0 ? '#e0a33c' : '#f2c14e') : null), { tex: 0.2 });
  px(X + 6, Y + 2, '#c48a2c', 1, 13); px(X + 15, Y + 2, '#c48a2c', 1, 13);
}

/** A tiki torch with a flame, 10 x 32. */
function torch(px, X, Y) {
  shadow(px, X + 1, Y + 31, 8);
  px(X + 3, Y + 10, OUT, 4, 22); px(X + 4, Y + 10, '#a0612f', 2, 21);
  px(X + 1, Y + 7, OUT, 8, 6); px(X + 2, Y + 8, '#8b5a2b', 6, 4); px(X + 2, Y + 9, '#5c3a1e', 6, 1);
  blob(px, X + 2, Y, 6, 8, (x, y) => (ell(x, y, 3, 5, 3, 5) ? (y > 4 ? '#ff922b' : '#ffd43b') : null), { tex: 0, outline: false });
  px(X + 4, Y + 3, '#fff3bf', 2, 2);
}

/** A smoking volcano, 120 x 90, with lava running down. */
function volcano(px, X, Y) {
  blob(px, X, Y + 10, 120, 80, (x, y) => {
    const half = 14 + (y / 80) * 46;
    if (Math.abs(x + 0.5 - 60) > half) return null;
    // lava streams down from the crater
    const lav = Math.abs(x + 0.5 - (60 + Math.sin(y / 7) * 4 + y * 0.15)) < 2.5 - y / 60;
    if (y < 8) return Math.abs(x + 0.5 - 60) < 10 ? '#ff6b1a' : '#4b3d38';
    if (lav) return y % 5 ? '#ff922b' : '#ffd43b';
    return x < 60 ? '#6b5a52' : '#4b3d38';
  }, { tex: 0.18 });
  // smoke puffs
  [[56, 6, 7], [64, 0, 6], [52, -6, 5]].forEach(([cx, cy, r]) => blob(px, X + cx - r, Y + cy - r, r * 2, r * 2, (x, y) => (ell(x, y, r, r, r, r) ? '#adb5bd' : null), { tex: 0, outline: false }));
}

/** A steaming vent in the ground, 16 x 10. */
function vent(px, X, Y) {
  blob(px, X, Y + 4, 16, 6, (x, y) => (ell(x, y, 8, 3, 8, 3) ? (ell(x, y, 8, 3, 4, 1.6) ? '#ff922b' : '#3d3330') : null), { tex: 0 });
  [[6, 0], [9, -3], [7, -6]].forEach(([x, y]) => px(X + x, Y + y, 'rgba(255,255,255,0.5)', 3, 2));
}

/** A big rainforest tree with hanging vines, 46 x 56. */
function jungleTree(px, X, Y, pal = {}) {
  const G = pal.G || '#2b8a3e'; const g = pal.g || '#51cf66'; const d = pal.d || '#1b5e20'; const T = pal.T || '#6e4b2a';
  shadow(px, X + 6, Y + 54, 34);
  // roots and trunk
  blob(px, X, Y, 46, 56, (x, y) => {
    if (y < 26) return null;
    const half = 4 + Math.max(0, (y - 46) * 0.9);
    return Math.abs(x + 0.5 - 23) <= half && y < 56 ? ((x + y) % 6 === 0 ? shade(T, -0.25) : T) : null;
  }, { tex: 0.15 });
  const clumps = [[23, 10, 11], [11, 18, 10], [35, 18, 10], [23, 22, 11], [15, 9, 8], [31, 9, 8]];
  blob(px, X, Y, 46, 34, (x, y) => {
    const k = clumps.findIndex(([cx, cy, r]) => ell(x, y, cx, cy, r, r * 0.9));
    if (k < 0) return null;
    const l = ((clumps[k][0] - x) + (clumps[k][1] - y)) / clumps[k][2];
    return l > 0.55 ? g : l < -0.4 ? d : G;
  }, { tex: 0.12, hi: 0.15 });
  // vines
  for (const [vx, len] of [[8, 14], [14, 20], [33, 18], [39, 12]]) for (let y = 0; y < len; y += 1) px(X + vx + Math.round(Math.sin(y / 3)), Y + 24 + y, y % 5 === 4 ? '#94d82d' : '#5c940d');
}

/** A fern, 22 x 14. */
function fern(px, X, Y, pal = {}) {
  const G = pal.G || '#2f9e44'; const g = pal.g || '#8ce99a';
  blob(px, X, Y, 22, 14, (x, y) => {
    for (const [ang, len] of [[-2.4, 10], [-1.9, 11], [-1.57, 12], [-1.2, 11], [-0.75, 10]]) {
      for (let s = 0; s < len; s += 0.7) {
        const fx = 11 + Math.cos(ang) * s; const fy = 13 + Math.sin(ang) * s + (s / len) ** 2 * 3;
        if (Math.hypot(x + 0.5 - fx, y + 0.5 - fy) < 1.6 - s / len) return s > len * 0.6 ? g : G;
      }
    }
    return null;
  }, { tex: 0 });
}

/** A big jungle flower, 18 x 20, petals c. */
function bigFlower(px, X, Y, c = '#ff6b6b') {
  blob(px, X, Y, 18, 20, (x, y) => {
    if (y >= 10 && Math.abs(x + 0.5 - 9) < 1.2) return '#2f9e44';
    if (y >= 13 && y < 17 && ell(x, y, 13, 15, 4, 2)) return '#40c057';
    if (y < 11) { if (ell(x, y, 9, 5, 2.5, 2.5)) return '#ffd43b'; if (ell(x, y, 9, 5, 8, 5.5)) return c; }
    return null;
  }, { tex: 0 });
}

/** A lollipop, 16 x 34, colors c and W. */
function lollipop(px, X, Y, c = '#ff6b6b', W = '#ffffff') {
  shadow(px, X + 4, Y + 33, 8);
  px(X + 7, Y + 14, OUT, 3, 20); px(X + 8, Y + 14, '#f8f9fa', 1, 19);
  blob(px, X, Y, 16, 16, (x, y) => {
    if (!ell(x, y, 8, 8, 8, 8)) return null;
    const a = Math.atan2(y + 0.5 - 8, x + 0.5 - 8) + Math.hypot(x + 0.5 - 8, y + 0.5 - 8) / 3;
    return Math.floor(((a + Math.PI) / Math.PI) * 3) % 2 ? c : W;
  }, { tex: 0, hi: 0.2 });
}

/** A cloud puff resting on the ground, 32 x 16. */
function cloud(px, X, Y, c = '#ffffff') {
  blob(px, X, Y, 32, 16, (x, y) => (ell(x, y, 9, 10, 9, 6) || ell(x, y, 18, 7, 9, 7) || ell(x, y, 25, 10, 7, 5) ? c : null), { tex: 0, lo: 0.12, outline: '#a5b4d4' });
}

/** A mushroom, 22 x 24, cap c with white spots. */
function mushroom(px, X, Y, c = '#ff6b6b') {
  shadow(px, X + 4, Y + 23, 14);
  blob(px, X, Y, 22, 24, (x, y) => {
    if (y >= 11 && Math.abs(x + 0.5 - 11) < 4) return '#fff9db';
    if (y < 12 && ell(x, y, 11, 11, 11, 11)) return (ell(x, y, 7, 5, 2, 2) || ell(x, y, 15, 7, 2, 2) || ell(x, y, 11, 2, 1.5, 1.5)) ? '#ffffff' : c;
    return null;
  }, { tex: 0 });
}

/** A small planet on a stand, 22 x 30, color c with a ring. */
function orb(px, X, Y, c = '#b197fc') {
  shadow(px, X + 4, Y + 29, 14);
  px(X + 9, Y + 18, OUT, 4, 12); px(X + 10, Y + 18, '#fab005', 2, 11); px(X + 5, Y + 27, OUT, 12, 3); px(X + 6, Y + 28, '#fcc419', 10, 1);
  blob(px, X + 3, Y + 2, 16, 16, (x, y) => (ell(x, y, 8, 8, 7, 7) ? (y % 5 === 2 ? shade(c, -0.15) : c) : null), { tex: 0, hi: 0.35 });
  for (let x = 0; x < 22; x += 1) { const y = Y + 10 + Math.round((x - 11) * 0.25); if (x < 5 || x > 16) px(X + x, y, '#ffd43b', 1, 1); }
}

/** A big candy-colored tree (the meadow tree in other colors). */
const candyTree = (px, X, Y, pal) => bigTree(px, X, Y, pal);

/** A market stall, 44 x 33. pal: { a: awning, b: stripe, wood, goods: [[c, light]...] }. */
export function stallOf(px, X, Y, pal = {}) {
  const a = pal.a || '#fa5252'; const b = pal.b || '#fff5f5'; const wood = pal.wood || '#c98a4b';
  px(X + 2, Y + 30, 'rgba(27,20,48,0.2)', 40, 3);
  px(X + 2, Y + 8, OUT, 3, 22); px(X + 37, Y + 8, OUT, 3, 22); px(X + 3, Y + 9, shade(wood, -0.2), 1, 20); px(X + 38, Y + 9, shade(wood, -0.2), 1, 20);
  px(X, Y, OUT, 44, 11);
  for (let x = 1; x < 43; x += 1) px(X + x, Y + 1, Math.floor(x / 6) % 2 ? b : a, 1, 8);
  for (let x = 1; x < 43; x += 6) px(X + x, Y + 9, Math.floor(x / 6) % 2 ? b : a, 6, 2);
  px(X + 1, Y + 1, '#ffffff', 42, 1);
  px(X + 1, Y + 20, OUT, 42, 10); px(X + 2, Y + 21, wood, 40, 8); px(X + 2, Y + 21, shade(wood, 0.25), 40, 1);
  const goods = pal.goods || [['#e03131', '#ff8787'], ['#f08c00', '#ffc078'], ['#fcc419', '#fff3bf'], ['#2f9e44', '#8ce99a']];
  for (let i = 0; i < 8; i += 1) { const [c, l] = goods[i % goods.length]; px(X + 4 + i * 5, Y + 17, OUT, 5, 4); px(X + 5 + i * 5, Y + 17, c, 3, 3); px(X + 5 + i * 5, Y + 17, l); }
  // a little hanging sign with a shirt on it: this is where the buddy shop is
  px(X + 17, Y + 11, OUT, 10, 7); px(X + 18, Y + 12, '#fff3bf', 8, 5);
  px(X + 19, Y + 13, '#4dabf7', 6, 2); px(X + 20, Y + 15, '#4dabf7', 4, 2);
}

// ---------- houses ----------

/** A beach or island hut: a thatched roof and woven walls. Same box as cottage(). */
function hut(px, X, Y, w, h, o = {}) {
  const R = o.roof || '#d4a24c'; const W = o.wall || '#ffd8a8'; const D = o.door || '#8b4513';
  const roofH = Math.round(h * 0.55); const wallTop = Y + roofH - 4;
  px(X + 4, Y + h, 'rgba(27,20,48,0.22)', w - 2, 3);
  blob(px, X + 4, wallTop, w - 8, h - roofH + 4, (x, y) => (x % 6 === 0 ? shade(W, -0.18) : W), { tex: 0.15 });
  blob(px, X - 3, Y, w + 6, roofH, (x, y) => {
    const half = (w + 6) / 2 * Math.min(1, 0.25 + y / roofH);
    if (Math.abs(x + 0.5 - (w + 6) / 2) > half) return null;
    return (y % 4 === 3) ? shade(R, -0.2) : ((x + y * 3) % 7 === 0 ? shade(R, 0.15) : R);
  }, { tex: 0.18 });
  // fringe at the eaves
  for (let x = X - 2; x < X + w + 2; x += 2) px(x, Y + roofH, shade(R, -0.3), 1, 2 + (x % 3));
  const dw = 12; const dh = Math.min(h - roofH, 18); const dx = Math.round(X + w / 2 - dw / 2);
  px(dx - 1, Y + h - dh, OUT, dw + 2, dh); px(dx, Y + h - dh + 1, D, dw, dh - 1); px(dx, Y + h - dh + 1, shade(D, 0.25), dw, 1);
  // round windows
  for (const wx of [X + 10, X + w - 20]) if (w > 60) { blob(px, wx, wallTop + 8, 10, 10, (x, y) => (ell(x, y, 5, 5, 5, 5) ? (o.glass || '#3bc9db') : null), { tex: 0 }); px(wx + 2, wallTop + 10, '#ffffff', 2, 2); }
  if (o.sign) o.sign(px, Math.round(X + w / 2), Y + h - dh - 2);
}

/** A dome house (under the sea, on the moon, in the galaxy): a round roof on a low wall, portholes. */
function dome(px, X, Y, w, h, o = {}) {
  const R = o.roof || '#74c0fc'; const W = o.wall || '#ced4da'; const D = o.door || '#495057'; const B = o.glass || '#ff6b6b';
  px(X + 2, Y + h, 'rgba(27,20,48,0.22)', w - 2, 3);
  const baseH = Math.round(h * 0.34);
  blob(px, X, Y + h - baseH, w, baseH, (x, y) => (y === 2 ? shade(W, -0.15) : W), { tex: 0.1 });
  blob(px, X + 2, Y, w - 4, h - baseH + 2, (x, y) => (ell(x, y, (w - 4) / 2, h - baseH + 2, (w - 4) / 2, h - baseH + 2) ? ((x + y) % 9 === 0 ? shade(R, 0.15) : R) : null), { tex: 0.06, hi: 0.4 });
  // a shine and seams on the dome
  for (let i = 0; i < 4; i += 1) px(X + w * 0.28 + i, Y + 8 + i * 2, shade(R, 0.6), 2, 1);
  for (const f of [0.33, 0.66]) for (let y = 4; y < h - baseH; y += 1) { const x = X + 2 + (w - 4) * f + ((f < 0.5 ? -1 : 1) * (h - baseH - y)) * 0.25; px(x, Y + y, shade(R, -0.2)); }
  // portholes
  for (const wx of [X + Math.round(w * 0.22), X + Math.round(w * 0.78) - 10]) {
    blob(px, wx, Y + h - baseH - 14, 10, 10, (x, y) => (ell(x, y, 5, 5, 5, 5) ? (ell(x, y, 5, 5, 3.5, 3.5) ? B : '#adb5bd') : null), { tex: 0 });
    px(wx + 3, Y + h - baseH - 12, '#ffffff', 2, 1);
  }
  const dw = 14; const dh = Math.min(h - 6, 22); const dx = Math.round(X + w / 2 - dw / 2);
  blob(px, dx, Y + h - dh, dw, dh, (x, y) => (y < 6 && !ell(x, y, 7, 7, 7, 7) ? null : (x === 7 ? shade(D, -0.3) : D)), { tex: 0 });
  px(dx + 10, Y + h - dh / 2, '#fcc419', 2, 2);
  if (o.sign) o.sign(px, Math.round(X + w / 2), Y + h - dh - 2);
}

/** A mushroom house (Rainbow Land): a spotted cap over a round stem with a door. */
function mushroomHouse(px, X, Y, w, h, o = {}) {
  const R = o.roof || '#ff6b6b'; const W = o.wall || '#fff9db'; const D = o.door || '#f783ac';
  px(X + 4, Y + h, 'rgba(27,20,48,0.2)', w - 6, 3);
  const capH = Math.round(h * 0.55);
  blob(px, X + Math.round(w * 0.16), Y + capH - 6, Math.round(w * 0.68), h - capH + 6, (x, y) => (x % 7 === 3 && y > 4 ? shade(W, -0.08) : W), { tex: 0.05 });
  blob(px, X - 4, Y, w + 8, capH, (x, y) => {
    if (!ell(x, y, (w + 8) / 2, capH, (w + 8) / 2, capH)) return null;
    const spots = [[0.25, 0.45, 5], [0.55, 0.25, 6], [0.8, 0.55, 4.5], [0.42, 0.7, 3.5]];
    return spots.some(([fx, fy, r]) => ell(x, y, fx * (w + 8), fy * capH, r, r * 0.8)) ? '#ffffff' : R;
  }, { tex: 0.05, hi: 0.35 });
  const dw = 12; const dh = Math.min(h - capH, 18); const dx = Math.round(X + w / 2 - dw / 2);
  blob(px, dx, Y + h - dh, dw, dh, (x, y) => (y < 5 && !ell(x, y, 6, 6, 6, 6) ? null : D), { tex: 0 });
  px(dx + 9, Y + h - dh / 2, '#fcc419', 2, 2);
  blob(px, X + Math.round(w * 0.2), Y + capH + 2, 8, 8, (x, y) => (ell(x, y, 4, 4, 4, 4) ? (o.glass || '#74c0fc') : null), { tex: 0 });
  if (o.sign) o.sign(px, Math.round(X + w / 2), Y + h - dh - 2);
}

/** A rainforest hut on stilts, with a ladder. */
function stilts(px, X, Y, w, h, o = {}) {
  const legs = 14;
  px(X + 4, Y + h, 'rgba(27,20,48,0.22)', w - 2, 3);
  for (const lx of [X + 6, X + w - 10, X + Math.round(w / 2) - 14]) { px(lx, Y + h - legs, OUT, 5, legs); px(lx + 1, Y + h - legs, '#6e4b2a', 3, legs); }
  // the ladder
  const lx = X + Math.round(w / 2) - 5;
  px(lx, Y + h - legs, OUT, 2, legs); px(lx + 9, Y + h - legs, OUT, 2, legs);
  for (let y = Y + h - legs + 2; y < Y + h; y += 4) px(lx + 1, y, '#a0612f', 9, 1);
  hut(px, X, Y, w, h - legs, { ...o, wall: o.wall || '#d9a066' });
  px(X - 2, Y + h - legs - 1, OUT, w + 4, 3); px(X - 1, Y + h - legs, '#8b5a2b', w + 2, 1);
}

/** A castle keep (the kid's home in the castle): a stone tower with battlements and a cone roof. */
function keep(px, X, Y, w, h, o = {}) {
  const R = o.roof || '#7048e8'; const S = '#ced4da';
  px(X + 4, Y + h, 'rgba(27,20,48,0.22)', w, 3);
  const roofH = Math.round(h * 0.38);
  blob(px, X, Y + roofH - 4, w, h - roofH + 4, (x, y) => {
    if (y < 5 && x % 8 > 4) return null;
    const row = Math.floor(y / 5);
    return (y % 5 === 0 || (x + row * 4) % 9 === 0) ? shade(S, -0.18) : S;
  }, { tex: 0.12 });
  // two cone roofs on round towers at the corners, and a big one in the middle
  for (const [cx, cw, ch] of [[X + 10, 16, roofH - 2], [X + w - 10, 16, roofH - 2], [X + w / 2, 28, roofH + 4]]) {
    blob(px, Math.round(cx - cw / 2), Y + roofH - ch, cw, ch, (x, y) => (Math.abs(x + 0.5 - cw / 2) <= (y / ch) * (cw / 2) + 0.5 ? (x < cw / 2 ? shade(R, 0.15) : R) : null), { tex: 0 });
  }
  px(X + w / 2 - 1, Y - 10, OUT, 2, 8); px(X + w / 2 + 1, Y - 10, o.flag || '#fcc419', 7, 4);
  const dw = 16; const dh = 22; const dx = Math.round(X + w / 2 - dw / 2);
  blob(px, dx, Y + h - dh, dw, dh, (x, y) => (y < 7 && !ell(x, y, 8, 8, 8, 8) ? null : (x % 4 === 0 ? '#5c3a1e' : '#8b5a2b')), { tex: 0 });
  for (const wx of [X + 14, X + w - 22]) { px(wx, Y + roofH + 10, OUT, 8, 12); px(wx + 1, Y + roofH + 11, '#fcc419', 6, 10); px(wx + 1, Y + roofH + 16, OUT, 6, 1); }
}

/** Draws a house by its style. o: { roof, wall, door, glass, shutter, sign: 'note' } */
export function house(px, hs) {
  const o = { ...hs, sign: hs.sign === 'note' ? noteSign : null };
  const fn = { cottage, hut, dome, mushroom: mushroomHouse, stilts, keep }[hs.style || 'cottage'] || cottage;
  fn(px, hs.x, hs.y, hs.w, hs.h, o);
}

// ---------- the prop registry ----------
// w, h: the drawing's box; foot: the part the buddy walks round [dx, dy, w, h]; base: where it
// sorts (its feet); flat: drawn on the ground before anything stands up.

export const PROPS = {
  tree: { w: 32, h: 40, foot: [6, 14, 20, 24], base: 36, draw: (px, p) => bigTree(px, p.x, p.y, p.pal) },
  bush: { w: 18, h: 13, foot: [1, 2, 16, 10], base: 12, draw: (px, p) => bush(px, p.x, p.y, p.berries) },
  well: { w: 26, h: 30, foot: [0, 14, 26, 16], base: 28, draw: (px, p) => well(px, p.x, p.y) },
  garden: { w: 62, h: 34, foot: [0, 0, 62, 48], base: 0, draw: (px, p) => { garden(px, p.x, p.y, p.w || 62, p.h || 34); fence(px, p.x - 2, p.y + (p.h || 34) + 4, (p.w || 62) + 4); } },
  stall: { w: 44, h: 33, foot: [0, 12, 44, 20], base: 30, draw: (px, p) => stallOf(px, p.x, p.y, p.pal) },
  laundry: { w: 84, h: 28, foot: null, base: 26, draw: (px, p) => laundry(px, p.x, p.y, p.w || 84) },
  flowers: { w: 16, h: 12, foot: null, flat: true, draw: (px, p) => { const cs = p.colors || ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc']; for (let i = 0; i < 9; i += 1) flower(px, p.x + (i % 3) * 5 + (Math.floor(i / 3) % 2) * 2, p.y + Math.floor(i / 3) * 4, cs[(i + p.x) % cs.length]); } },
  palm: { w: 36, h: 44, foot: [12, 30, 12, 12], base: 42, draw: (px, p) => palm(px, p.x, p.y, p.pal) },
  rock: { w: 22, h: 16, foot: [2, 4, 18, 10], base: 15, draw: (px, p) => rock(px, p.x, p.y, p.w || 22, p.h || 16, p.c) },
  boulder: { w: 34, h: 26, foot: [3, 8, 28, 16], base: 25, draw: (px, p) => rock(px, p.x, p.y, 34, 26, p.c) },
  coral: { w: 24, h: 22, foot: [4, 10, 16, 10], base: 21, draw: (px, p) => coral(px, p.x, p.y, p.c) },
  kelp: { w: 16, h: 42, foot: [3, 32, 10, 8], base: 41, draw: (px, p) => kelp(px, p.x, p.y, p.pal) },
  clam: { w: 26, h: 18, foot: [1, 4, 24, 12], base: 17, draw: (px, p) => clam(px, p.x, p.y) },
  anchor: { w: 20, h: 26, foot: [3, 14, 14, 10], base: 25, draw: (px, p) => anchor(px, p.x, p.y) },
  crater: { w: 36, h: 18, foot: null, flat: true, draw: (px, p) => crater(px, p.x, p.y, p.w || 36, p.h || 18, p.pal) },
  crystal: { w: 20, h: 24, foot: [3, 14, 14, 9], base: 23, draw: (px, p) => crystal(px, p.x, p.y, p.c, p.C) },
  spire: { w: 22, h: 46, foot: [4, 34, 14, 11], base: 45, draw: (px, p) => spire(px, p.x, p.y, p.c, p.C) },
  dish: { w: 28, h: 32, foot: [6, 20, 16, 11], base: 31, draw: (px, p) => dish(px, p.x, p.y) },
  lamp: { w: 10, h: 32, foot: [1, 26, 8, 6], base: 31, draw: (px, p) => lamp(px, p.x, p.y, p.c, p.post) },
  flag: { w: 16, h: 30, foot: [0, 24, 5, 6], base: 29, draw: (px, p) => flag(px, p.x, p.y, p.c) },
  umbrella: { w: 32, h: 36, foot: [13, 26, 6, 8], base: 35, draw: (px, p) => umbrella(px, p.x, p.y, p.c) },
  sandcastle: { w: 30, h: 26, foot: [1, 10, 28, 15], base: 25, draw: (px, p) => sandcastle(px, p.x, p.y) },
  surfboard: { w: 10, h: 30, foot: [1, 22, 8, 8], base: 29, draw: (px, p) => surfboard(px, p.x, p.y, p.c) },
  fountain: { w: 40, h: 32, foot: [1, 14, 38, 17], base: 31, draw: (px, p) => fountain(px, p.x, p.y) },
  banner: { w: 12, h: 38, foot: [3, 32, 7, 6], base: 37, draw: (px, p) => banner(px, p.x, p.y, p.c) },
  haybale: { w: 22, h: 16, foot: [1, 4, 20, 11], base: 15, draw: (px, p) => haybale(px, p.x, p.y) },
  torch: { w: 10, h: 32, foot: [2, 26, 6, 6], base: 31, draw: (px, p) => torch(px, p.x, p.y) },
  volcano: { w: 120, h: 90, foot: [14, 40, 92, 48], base: 88, draw: (px, p) => volcano(px, p.x, p.y) },
  vent: { w: 16, h: 10, foot: [2, 4, 12, 6], base: 9, draw: (px, p) => vent(px, p.x, p.y) },
  jungletree: { w: 46, h: 56, foot: [14, 40, 18, 15], base: 54, draw: (px, p) => jungleTree(px, p.x, p.y, p.pal) },
  fern: { w: 22, h: 14, foot: [3, 6, 16, 8], base: 13, draw: (px, p) => fern(px, p.x, p.y, p.pal) },
  bigflower: { w: 18, h: 20, foot: [5, 12, 8, 8], base: 19, draw: (px, p) => bigFlower(px, p.x, p.y, p.c) },
  lollipop: { w: 16, h: 34, foot: [5, 28, 7, 6], base: 33, draw: (px, p) => lollipop(px, p.x, p.y, p.c, p.W) },
  candytree: { w: 32, h: 40, foot: [6, 14, 20, 24], base: 36, draw: (px, p) => candyTree(px, p.x, p.y, p.pal) },
  cloud: { w: 32, h: 16, foot: [2, 5, 28, 10], base: 15, draw: (px, p) => cloud(px, p.x, p.y, p.c) },
  mushroom: { w: 22, h: 24, foot: [5, 14, 12, 10], base: 23, draw: (px, p) => mushroom(px, p.x, p.y, p.c) },
  orb: { w: 22, h: 30, foot: [4, 22, 14, 8], base: 29, draw: (px, p) => orb(px, p.x, p.y, p.c) },
  // the Forest Village's little things, drawn in its storybook style (meadowart.js)
  lantern: { w: 16, h: 34, foot: [1, 28, 7, 6], base: 33, draw: (px, p) => lanternB(px, p.x, p.y) },
  birdhouse: { w: 12, h: 30, foot: [3, 25, 6, 5], base: 29, draw: (px, p) => birdhouseB(px, p.x, p.y) },
  mailbox: { w: 12, h: 20, foot: [2, 15, 8, 5], base: 19, draw: (px, p) => mailboxB(px, p.x, p.y) },
  scarecrow: { w: 22, h: 32, foot: [8, 26, 6, 6], base: 31, draw: (px, p) => scarecrowB(px, p.x, p.y) },
  bench: { w: 24, h: 12, foot: [0, 4, 24, 8], base: 11, draw: (px, p) => benchB(px, p.x, p.y) },
  barrow: { w: 26, h: 16, foot: [1, 6, 24, 10], base: 15, draw: (px, p) => barrowB(px, p.x, p.y) },
  mushrooms: { w: 14, h: 9, foot: null, flat: true, draw: (px, p) => mushroomsB(px, p.x, p.y) },
  snail: { w: 9, h: 6, foot: null, flat: true, draw: (px, p) => snailB(px, p.x, p.y) },
};

// ---------- the ground ----------

const GROUNDS = {
  // tufts of grass and speckles
  grass: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 70; i += 1) {
      const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H);
      px(x, y, g[1], 3, 1); px(x + 1, y - 1, g[1]); px(x + 3, y - 1, g[1]); px(x + 1, y - 2, g[2]); px(x + 3, y - 2, g[2]);
    }
    for (let i = 0; i < (L.W * L.H) / 25; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
  },
  // sand: grains and wind ripples
  sand: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 12; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    for (let i = 0; i < (L.W * L.H) / 400; i += 1) { const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); for (let k = 0; k < 9; k += 1) px(x + k, y + Math.round(Math.sin(k / 2)), g[1]); }
  },
  // the sea floor: speckles and wavy light from above
  seabed: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 14; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    for (let i = 0; i < (L.W * L.H) / 300; i += 1) { const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); for (let k = 0; k < 14; k += 1) px(x + k, y + Math.round(Math.sin(k / 2.2) * 1.5), shade(g[2], 0.15)); }
  },
  // moon dust: pebbles and tiny craters
  moon: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 14; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    for (let i = 0; i < (L.W * L.H) / 500; i += 1) { const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const r = 2 + Math.floor(rnd() * 3); px(x - r, y, g[1], r * 2, 1); px(x - r + 1, y - 1, g[1], r * 2 - 2, 1); px(x - r + 1, y + 1, g[2], r * 2 - 2, 1); }
  },
  // dark volcanic ground with cracks that glow a little
  ash: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 14; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    for (let i = 0; i < (L.W * L.H) / 900; i += 1) {
      let x = Math.floor(rnd() * L.W); let y = Math.floor(rnd() * L.H);
      for (let k = 0; k < 12; k += 1) { px(x, y, k % 5 === 2 ? '#c2410c' : '#2b211d'); x += rnd() < 0.5 ? 1 : 0; y += rnd() < 0.6 ? 1 : 0; x += rnd() < 0.3 ? -1 : 0; }
    }
  },
  // pastel ground with tiny sparkles
  candy: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 18; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    const cs = ['#ffffff', '#fcc2d7', '#d0bfff', '#ffec99'];
    for (let i = 0; i < (L.W * L.H) / 700; i += 1) { const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const c = cs[i % cs.length]; px(x, y - 1, c); px(x - 1, y, c, 3, 1); px(x, y + 1, c); }
  },
  // deep space: stars
  stars: (px, L, g, rnd) => {
    for (let i = 0; i < (L.W * L.H) / 16; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? g[1] : g[2]);
    for (let i = 0; i < (L.W * L.H) / 260; i += 1) { const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const c = rnd() < 0.3 ? '#ffd43b' : rnd() < 0.5 ? '#d0bfff' : '#ffffff'; px(x, y, c); if (rnd() < 0.15) { px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); } }
  },
};

// little things scattered on open ground
const SCATTER = {
  flowers: (px, x, y, i, rnd, colors) => flower(px, x, y, colors[i % colors.length]),
  shells: (px, x, y, i) => { const c = ['#fff0f6', '#ffd8a8', '#ffc9c9'][i % 3]; if (i % 4 === 0) { px(x - 1, y, '#ff922b', 3, 1); px(x, y - 1, '#ff922b', 1, 3); } else { px(x, y, OUT, 3, 2); px(x, y, c, 2, 1); } },
  sea: (px, x, y, i) => { if (i % 3 === 0) { px(x, y, '#ff8787', 1, 3); px(x + 1, y - 1, '#ff8787', 1, 3); px(x - 1, y + 1, '#ff8787'); } else if (i % 3 === 1) { px(x, y, '#2b8a3e', 1, 4); px(x + 2, y + 1, '#2b8a3e', 1, 3); px(x + 1, y - 1, '#69db7c'); } else { px(x, y, '#ffd43b', 2, 2); } },
  pebbles: (px, x, y, i, rnd, colors) => { px(x, y, colors[0], 2, 1); px(x, y + 1, colors[1], 2, 1); },
  embers: (px, x, y, i) => { px(x, y, i % 3 ? '#2b211d' : '#ff922b', 2, 1); if (i % 5 === 0) px(x + 1, y - 1, '#ffd43b'); },
  candy: (px, x, y, i) => { const c = ['#ff6b6b', '#845ef7', '#4dabf7', '#ffd43b', '#f783ac'][i % 5]; px(x, y, OUT, 4, 3); px(x + 1, y + 1, c, 2, 1); px(x - 1, y + 1, c); px(x + 4, y + 1, c); },
};

// ---------- the water between morning and after school ----------

/** Distance from (x, y) to a line of points. */
function lineDist(x, y, pts) {
  let best = Infinity;
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    const dx = x1 - x0; const dy = y1 - y0; const l = dx * dx + dy * dy || 1;
    const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l));
    best = Math.min(best, Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)));
  }
  return best;
}
export const waterDist = lineDist;

/** How far into a water band a point is (positive inside), with the banks' wobble. */
export function waterDepth(wa, x, y) {
  const wob = Math.sin(x / 13 + y / 17) * 1.5 + Math.sin(x / 5.3 - y / 7.1) * 0.7;
  return wa.w / 2 + wob - lineDist(x, y, wa.pts);
}

function water(px, L, wa, rnd) {
  const c = wa.colors; // { bank, edge, water, deep, shine, glow }
  const xs = wa.pts.map((p) => p[0]); const ys = wa.pts.map((p) => p[1]);
  const pad = wa.w / 2 + 6;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)); const x1 = Math.min(L.W, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)); const y1 = Math.min(L.H, Math.ceil(Math.max(...ys) + pad));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const d = waterDepth(wa, x, y);
      if (d < -4) continue;
      if (d < -2) px(x, y, c.bank);
      else if (d < 0) px(x, y, c.edge);
      else if (d < 2) px(x, y, c.deep);
      else if (d > wa.w / 2 - (wa.w >= 30 ? 7 : 3) && wa.kind !== 'stars' && wa.kind !== 'sea') px(x, y, c.deep);
      else px(x, y, c.water);
    }
  }
  // shines, stars or lava crust on the surface
  const n = Math.round((x1 - x0) * (y1 - y0) / 90);
  for (let i = 0; i < n; i += 1) {
    const x = x0 + Math.floor(rnd() * (x1 - x0)); const y = y0 + Math.floor(rnd() * (y1 - y0));
    if (waterDepth(wa, x, y) < 4) continue;
    if (wa.kind === 'stars') { px(x, y, rnd() < 0.3 ? '#ffd43b' : '#ffffff'); continue; }
    if (wa.kind === 'lava') { px(x, y, rnd() < 0.5 ? c.shine : '#e8590c', 2 + Math.floor(rnd() * 3), 1); continue; }
    if (wa.kind === 'rainbow') { px(x, y, ['#ffffff', '#ffd43b', '#74c0fc'][i % 3], 3, 1); continue; }
    px(x, y, c.shine, 3 + Math.floor(rnd() * 4), 1);
  }
  // reeds by a river's banks
  if (wa.reeds) {
    for (let i = 0; i < n / 6; i += 1) {
      const x = x0 + Math.floor(rnd() * (x1 - x0)); const y = y0 + Math.floor(rnd() * (y1 - y0));
      const d = waterDepth(wa, x, y);
      if (d > -6 || d < -9 || L.blockedHard(x, y)) continue;
      px(x, y - 4, wa.reeds, 1, 5); px(x + 2, y - 6, wa.reeds, 1, 7); px(x + 2, y - 7, '#7a4a26', 1, 3);
    }
  }
}

// ---------- bridges ----------

/** A bridge over the water. c: { kind, dir: 'v' (walk up and down) or 'h', x, y, w, h, pal }. */
function bridgeOf(px, b) {
  const p = b.pal || {};
  const plank = p.plank || '#b06a35'; const dark = p.dark || '#7a4a26'; const rail = p.rail || '#c98a4b';
  const v = b.dir !== 'h';
  px(b.x - 3, b.y - 2, 'rgba(27,20,48,0.25)', b.w + 6, b.h + 5);
  px(b.x - 1, b.y - 1, OUT, b.w + 2, b.h + 2);
  const len = v ? b.h : b.w; const wid = v ? b.w : b.h;
  for (let i = 0; i < len; i += 1) {
    let c;
    if (b.kind === 'rainbow') c = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'][Math.floor(i / 3) % 6];
    else if (b.kind === 'light') c = i % 6 < 3 ? '#ffe066' : '#fff3bf';
    else if (b.kind === 'metal') c = i % 6 === 5 ? dark : plank;
    else if (b.kind === 'stone') c = i % 5 === 4 ? dark : plank;
    else c = i % 4 === 3 ? dark : i % 8 < 4 ? plank : shade(plank, -0.08);
    if (v) px(b.x, b.y + i, c, b.w, 1); else px(b.x + i, b.y, c, 1, b.h);
    // nails, rivets or stone joints
    if (b.kind === 'stone' && i % 5 === 2) { if (v) px(b.x + ((i * 7) % (wid - 4)) + 2, b.y + i, dark, 1, 2); else px(b.x + i, b.y + ((i * 7) % (wid - 4)) + 2, dark, 2, 1); }
    if ((b.kind || 'wood') === 'wood' && i % 4 === 1) { if (v) { px(b.x + 4, b.y + i, dark); px(b.x + wid - 5, b.y + i, dark); } else { px(b.x + i, b.y + 4, dark); px(b.x + i, b.y + wid - 5, dark); } }
  }
  // rails on both sides with posts (ropes for a rope bridge, glow for light)
  const sides = v ? [[b.x - 4, b.y - 5, 4, b.h + 10], [b.x + b.w, b.y - 5, 4, b.h + 10]] : [[b.x - 5, b.y - 4, b.w + 10, 4], [b.x - 5, b.y + b.h, b.w + 10, 4]];
  for (const [rx, ry, rw, rh] of sides) {
    if (b.kind === 'rope') { px(rx + (v ? 1 : 0), ry + (v ? 0 : 1), '#c9a35d', v ? 2 : rw, v ? rh : 2); }
    else { px(rx, ry, OUT, rw, rh); px(rx + 1, ry + 1, rail, rw - 2, rh - 2); }
    const step = 10;
    for (let k = 0; k < (v ? rh : rw); k += step) {
      const qx = v ? rx - 1 : rx + k; const qy = v ? ry + k : ry - 1;
      px(qx, qy, OUT, v ? 6 : 5, v ? 5 : 6); px(qx + 1, qy + 1, b.kind === 'light' ? '#ffffff' : dark, v ? 4 : 3, v ? 3 : 4);
    }
  }
}

// ---------- paths ----------

function pathOf(px, pts, w, st, rnd) {
  const dots = [];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= n; s += 1) dots.push([x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n]);
  }
  const disc = (r, c) => dots.forEach(([x, y]) => { for (let dy = -r; dy <= r; dy += 1) { const half = Math.floor(Math.sqrt(r * r - dy * dy)); px(x - half, y + dy, c, half * 2 + 1, 1); } });
  if (st.layers) { st.layers.forEach(([r, c]) => disc(r, c)); return; }
  disc(Math.ceil(w / 2) + 1, st.edge);
  disc(Math.ceil(w / 2), st.fill);
  dots.forEach(([x, y], i) => {
    if (st.kind === 'planks') { if (i % 4 === 0) px(x - w / 2, y, shade(st.fill, -0.2), w, 1); return; }
    if (st.kind === 'cobble') { if (i % 3 === 0) { const ox = x + Math.round((rnd() - 0.5) * (w - 3)); px(ox, y, shade(st.fill, rnd() < 0.5 ? -0.15 : 0.12), 3, 2); } return; }
    if (i % 3) return;
    const g = rnd();
    if (g < 0.35) px(x + Math.round((rnd() - 0.5) * w), y + Math.round((rnd() - 0.5) * w), shade(st.fill, -0.14));
    else if (g > 0.85) px(x + Math.round((rnd() - 0.5) * w), y + Math.round((rnd() - 0.5) * w), shade(st.fill, 0.2));
  });
}

// ---------- the castle wall round the edge ----------

function castleWall(px, L) {
  const S = '#adb5bd';
  const seg = (x, y, w, h) => blob(px, x, y, w, h, (xx, yy) => ((yy % 6 === 0 || (xx + Math.floor(yy / 6) * 5) % 10 === 0) ? shade(S, -0.2) : S), { tex: 0.1 });
  seg(0, 0, L.W, 20); seg(0, L.H - 20, L.W, 20); seg(0, 0, 18, L.H); seg(L.W - 18, 0, 18, L.H);
  // battlements along the top
  for (let x = 0; x < L.W; x += 10) { px(x + 2, 0, OUT, 6, 4); px(x + 3, 0, '#ced4da', 4, 3); }
  // towers in the corners
  for (const [x, y] of [[-6, -6], [L.W - 34, -6], [-6, L.H - 40], [L.W - 34, L.H - 40]]) {
    blob(px, x, y, 40, 46, (xx, yy) => (ell(xx, yy, 20, 23, 20, 23) ? ((yy % 6 === 0) ? shade(S, -0.2) : S) : null), { tex: 0.1 });
    blob(px, x + 8, y - 10, 24, 18, (xx, yy) => (Math.abs(xx + 0.5 - 12) <= (yy / 18) * 12 + 0.5 ? '#7048e8' : null), { tex: 0 });
  }
}

// ---------- the whole village ----------

/**
 * Paints the village for a layout from villagemaps.js onto a canvas, one canvas pixel per
 * village pixel. opts: { homeRoof: the kid's color, areas: the green's ponds and play patches }.
 */
export function paintVillage(canvas, L, opts = {}) {
  // the Forest Village has its own storybook painter
  if (L.id === 'bg-meadow') return paintMeadow(canvas, L, opts, { waterDepth, PROPS });
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const px = painter(ctx);
  const rnd = seeded(L.seed || 1234);
  const g = L.ground.c;

  px(0, 0, g[0], L.W, L.H);
  (GROUNDS[L.ground.kind] || GROUNDS.grass)(px, L, g, rnd);
  // the edge of the village is darker
  if (L.ground.edge) {
    const edge = (x, y) => Math.min(x, y, L.W - x, L.H - y);
    for (let y = 0; y < L.H; y += 1) for (let x = 0; x < L.W; x += 1) if (edge(x, y) < 20) px(x, y, (x + y) % 2 ? L.ground.edge[0] : L.ground.edge[1]);
  }
  // flat things first: paths, plazas, water, bridges, the green
  L.paths.forEach((p) => pathOf(px, p, 12, L.pathStyle, rnd));
  L.plazas.forEach(([x, y, r]) => plaza(px, x, y, r, L.plazaStyle));
  L.water.forEach((wa) => water(px, L, wa, rnd));
  (opts.areas || []).forEach((a) => {
    if (a.kind === 'pond') pond(px, a, rnd, L.pond);
    else if (a.kind === 'hockey') frozen(px, a);
    else clearingOf(px, a, a.kind, L.clearing);
  });
  if (L.falls) fallsOf(px, L.falls);
  L.crossings.forEach((b) => bridgeOf(px, b));
  L.props.filter((p) => PROPS[p.kind]?.flat).forEach((p) => PROPS[p.kind].draw(px, p, rnd));
  if (L.walls === 'castle') castleWall(px, L);

  // little things on open ground
  const busy = (x, y) => L.blocked(x, y, 6) || L.onPath(x, y, 10) || L.inWater(x, y, 6) || (opts.areas || []).some((a) => x > a.x - 8 && x < a.x + a.w + 8 && y > a.y - 8 && y < a.y + a.h + 8);
  const sc = L.scatter;
  if (sc) {
    for (let i = 0; i < (L.W * L.H) / (sc.every || 260); i += 1) {
      const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H);
      if (Math.min(x, y, L.W - x, L.H - y) < 26 || busy(x, y)) continue;
      SCATTER[sc.kind](px, x, y, i, rnd, sc.colors || ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc']);
    }
  }

  // things that stand up, back to front
  const things = [
    { y: L.home.y + L.home.h, draw: () => house(px, { ...L.home, roof: opts.homeRoof || L.home.roof || '#e03131' }) },
    ...L.houses.map((h) => ({ y: h.y + h.h, draw: () => house(px, h) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => PROPS[p.kind]?.draw(px, p, rnd) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  return canvas;
}

/** A mossy cliff at the top of the village with the river pouring over it (maplife.js animates the water). */
function fallsOf(px, f) {
  const [c0, c1] = f.cliff;
  const bottom = f.base - 2;
  for (let y = 0; y <= bottom; y += 1) {
    // the cliff bulges out a little towards its foot
    const grow = Math.round(Math.sin((y / bottom) * Math.PI * 0.5) * 6);
    const a = c0 - grow; const b = c1 + grow;
    px(a, y, OUT, b - a, 1);
    if (y === bottom) continue;
    px(a + 1, y, '#6c757d', b - a - 2, 1);
    for (let x = a + 1; x < b - 1; x += 1) {
      const h = hashXY(x, y);
      if (h < 0.08) px(x, y, '#495057');
      else if (h > 0.94) px(x, y, '#868e96');
    }
    // light on the left of each ledge, shade on the right
    if (y % 9 === 3) { px(a + 1, y, '#adb5bd', Math.round((b - a) * 0.4), 1); px(a + Math.round((b - a) * 0.6), y + 1, '#495057', Math.round((b - a) * 0.4) - 1, 1); }
  }
  // moss over the top, hanging down in strands
  px(c0 - 1, 0, '#1b5e20', c1 - c0 + 2, 7);
  for (let x = c0; x < c1; x += 1) {
    const h = hashXY(x, 3);
    const len = 2 + Math.floor(h * 7);
    if (x % 2 === 0) px(x, 7, h > 0.5 ? '#2f9e44' : '#237032', 1, len);
    if (h > 0.7) px(x, 1 + (x % 3), '#51cf66');
  }
  px(c0 - 1, 7, OUT, 1, 3); px(c1, 7, OUT, 1, 3);
  // the water coming over the edge
  px(f.x0 - 1, f.lip - 1, OUT, f.x1 - f.x0 + 3, f.base - f.lip + 1);
  px(f.x0, f.lip - 1, '#1c9c8c', f.x1 - f.x0 + 1, f.base - f.lip);
  px(f.x0 + 2, f.lip - 1, '#3bc9db', f.x1 - f.x0 - 3, f.base - f.lip);
  px(f.x0, f.lip - 1, '#c5f6fa', f.x1 - f.x0 + 1, 2);
}

/** A worn clearing for soccer or football in the ground's own colors, with goals or posts. */
function clearingOf(px, Z, kind, c = {}) {
  const fill = c.fill || ['#d9b07a', '#c99a5f', '#e8c590']; const grass = c.grass || '#7bd66b';
  for (let y = Z.y - 2; y < Z.y + Z.h + 2; y += 1) {
    for (let x = Z.x - 2; x < Z.x + Z.w + 2; x += 1) {
      const dx = (x + 0.5 - (Z.x + Z.w / 2)) / (Z.w / 2 + 2); const dy = (y + 0.5 - (Z.y + Z.h / 2)) / (Z.h / 2 + 2);
      const k = 1 - (dx * dx + dy * dy);
      if (k < 0) continue;
      const h = hashXY(x, y);
      if (k < 0.25 && h < 0.6 - k * 2) continue;
      px(x, y, h < 0.15 ? fill[1] : h > 0.9 ? fill[2] : fill[0]);
      if (k < 0.3 && h > 0.75) px(x, y, grass);
    }
  }
  const mid = Math.round(Z.y + Z.h / 2);
  if (kind === 'football') {
    const post = (x) => { px(x, mid - 16, OUT, 3, 20); px(x + 1, mid - 15, '#fcc419', 1, 18); px(x - 5, mid - 10, OUT, 13, 3); px(x - 4, mid - 9, '#fcc419', 11, 1); px(x - 5, mid - 18, OUT, 3, 9); px(x + 5, mid - 18, OUT, 3, 9); px(x - 4, mid - 17, '#fcc419', 1, 8); px(x + 6, mid - 17, '#fcc419', 1, 8); };
    post(Z.x + 4); post(Z.x + Z.w - 7);
  } else {
    const goal = (x, dir) => {
      px(x, mid - 7, OUT, 8, 15); px(x + 1, mid - 6, '#f8f9fa', 6, 13);
      for (let y = mid - 6; y < mid + 7; y += 2) px(x + 1, y, '#ced4da', 6, 1);
      for (let xx = x + 1; xx < x + 7; xx += 2) px(xx, mid - 6, '#ced4da', 1, 13);
      px(dir > 0 ? x + 6 : x + 1, mid - 6, '#ffffff', 1, 13);
    };
    goal(Z.x, 1); goal(Z.x + Z.w - 8, -1);
    px(Z.x + Z.w / 2 - 3, mid - 3, shade(fill[0], 0.3), 6, 6);
  }
}
