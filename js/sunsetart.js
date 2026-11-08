// Sunset Beach (the sunset map's village) in style B, "soft storybook", like the Forest
// Village (meadowart.js): warm hue-shifted colors, round shapes, selective outlines (each
// thing edged in a darker shade of its own color, ink only where it meets the ground), and
// soft dithered edges. Peachy sand with wind ripples and shells, a turquoise lagoon down the
// middle, surf rolling in at the bottom, sun-bleached boardwalks, palm-thatched huts, palms.
//
// Everything is one canvas pixel per village pixel, painted into one ImageData and shown with
// a single putImageData. villageprops.js calls paintSunset() for the sunset map; every other
// map keeps its own painter.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer } from './pixelkit.js';
import { PB, propB, groundShadow, laundryB, stoneB, selective } from './meadowart.js';

// ---------- the palette ----------

export const SB = {
  sand: ['#7a5a6a', '#a87e7c', '#cc9e86', '#e2b98e', '#f0d0a2', '#f8e2bc', '#fff4dc'], // base 4
  wet: ['#9a7676', '#b28c80', '#c6a088', '#d6b292'],
  lagoon: ['#1c4a72', '#1f6a8c', '#2a8ea8', '#3cb0bc', '#62cdca', '#9ae6da', '#d4fbf0'],
  sea: ['#1e3878', '#225898', '#2a78b2', '#3a9ac6', '#62bcd6', '#a0e0ea', '#e8fcff'],
  board: ['#4a2e3a', '#74483e', '#9a6648', '#bc8858', '#d8a870', '#ecc890', '#f8e4b4'],
  drift: ['#3e2a36', '#5e3e42', '#7e5a4e', '#9e7a62', '#bc9a7a', '#d8bc98', '#f0dcbc'],
  palm: ['#1c4446', '#265e4a', '#33804e', '#4ea056', '#7cc060', '#b2dc74', '#e0f29a'],
  trunk: ['#4a3036', '#6e4a40', '#946a50', '#b88c62', '#d4ae7e', '#ecd0a0'],
  thatch: ['#5a3a3e', '#8a5c46', '#b28452', '#d4a862', '#ecc880', '#f8e2a8'],
  bamboo: ['#5e4a3a', '#8a7448', '#b4a05a', '#d4c272', '#ece09a', '#faf4c8'],
  rope: ['#7a5a4a', '#b0906a', '#dcc496', '#f4e6c0'],
  ink: '#3b2235',
};
const SD = SB.sand; const WT = SB.wet; const AQ = SB.lagoon; const SEA = SB.sea; const BW = SB.board; const INK = SB.ink;

// ---------- the sand ----------

/**
 * Peachy sand: big soft patches blended by ordered dithering, wind ripples in fields, grains,
 * and a band of dune grass along the edges where the palms stand.
 */
function sandB(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const n = vnoise(x, y, 30, seed) * 0.7 + vnoise(x, y, 9, seed + 1) * 0.3;
      const t = (bayer(x, y) - 0.5) * 0.16;
      let c = SD[4];
      if (n < 0.34 + t) c = n < 0.25 + t ? '#e6c290' : '#ebc998';
      else if (n > 0.66 + t) c = n > 0.76 + t ? '#f8e0b4' : '#f4d8aa';
      // wind ripples: soft broken lines in patches of the beach
      const field = vnoise(x, y, 44, seed + 5);
      if (field > 0.52 && vnoise(x, y, 8, seed + 7) > 0.38) {
        const ph = (y + Math.sin(x / 11 + vnoise(x, y, 24, seed + 6) * 5) * 2.8) / 6;
        const f = ph - Math.floor(ph);
        if (f < 0.12) c = '#fbe6c2';
        else if (f > 0.84 && field > 0.58) c = '#e4bd8e';
      }
      const g = h2(x, y, seed + 3);
      if (g < 0.018) c = '#dcb084'; else if (g > 0.99) c = '#fff8e8';
      // the edges, under the palms: a little darker
      const e = Math.min(x, y, W - 1 - x);
      if (e < 18) { const d = e + (vnoise(x, y, 9, seed + 9) - 0.5) * 7; if (d < 14 && bayer(x, y) < (14 - d) / 10) c = d < 6 ? '#d8ac84' : '#e2b88c'; }
      px(x, y, c);
    }
  }
}

// ---------- water ----------

/**
 * The lagoon down the middle: wet sand at the banks, clear turquoise shallows over sand bars,
 * a deeper channel, light rippling on the bottom, and sparkles. depth(wa, x, y) is how far
 * into the water a point is (the same banks the buddy walks round).
 */
function lagoonB(px, L, wa, depth, seed, dry) {
  const half = wa.w / 2;
  const xs = wa.pts.map((p) => p[0]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - half - 10)); const x1 = Math.min(L.W, Math.ceil(Math.max(...xs) + half + 10));
  for (let y = 0; y < L.H; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const d = depth(wa, x, y);
      if (d < -7 || dry(x, y)) continue;
      const b = bayer(x, y);
      if (d < -2.5) { const t = (d + 7) / 4.5; if (b < t * 0.65) px(x, y, t > 0.6 ? WT[3] : '#e2bf98'); continue; }
      // the bank: wet sand, the up-left side in the shade of its lip
      const upLeft = depth(wa, x - 1, y - 1) < d;
      if (d < 0) { px(x, y, d < -1.3 ? WT[2] : upLeft ? WT[0] : WT[1]); continue; }
      let c = AQ[3];
      if (d < 1.3) c = upLeft ? AQ[2] : b < 0.5 ? AQ[6] : AQ[5];
      else if (d < 4 || (d < 6 && b < (6 - d) / 2)) c = upLeft && d < 2.6 ? AQ[3] : AQ[4];
      else if (d > half - 5 || (d > half - 7 && b < (d - half + 7) / 2)) c = AQ[2];
      // sand bars showing through, and light rippling over the bottom
      if (c === AQ[3] && vnoise(x, y, 14, seed) > 0.66 && b < 0.6) c = AQ[4];
      const cn = Math.abs(vnoise(x * 1.2, y, 5, seed + 1) - vnoise(x, y * 1.2 + 9, 5, seed + 2));
      if (cn < 0.035 && d > 2) c = c === AQ[2] ? AQ[3] : c === AQ[3] ? AQ[4] : AQ[5];
      px(x, y, c);
    }
  }
  // sparkles on the open water
  for (let y = 0; y < L.H; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      if (h2(x, y, seed + 3) < 0.994) continue;
      if (depth(wa, x, y) < 4 || depth(wa, x + 4, y) < 4 || dry(x, y)) continue;
      px(x, y, '#ffffff'); px(x + 1, y, AQ[6], 1 + Math.floor(h2(y, x, seed) * 3), 1);
    }
  }
}

/**
 * The sea along the bottom: wet glossy sand, lacy foam where the last wave reached, a white
 * line of surf, turquoise shallows, then deeper blue with rolling crests and sparkles.
 */
function seaB(px, L, wa, depth, seed, river) {
  for (let y = 0; y < L.H; y += 1) {
    for (let x = 0; x < L.W; x += 1) {
      const d = depth(wa, x, y);
      if (d < -14) continue;
      const b = bayer(x, y);
      const inRiver = river(x, y) > 0;
      if (d < 0 && inRiver) continue;
      if (d < -6) { const t = (d + 14) / 8; if (b < t * 0.8) px(x, y, t > 0.55 ? WT[3] : '#e2bf98'); continue; }
      if (d < 0) {
        // the swash: dark wet sand that shines, with lace where the last wave reached
        let c = d < -3.5 ? WT[2] : WT[1];
        if (vnoise(x, y, 6, seed) > 0.62 && b < 0.5) c = '#d8bca6';
        const lace = -2.2 + Math.sin(x / 6.5 + 1.1) * 1.1 + Math.sin(x / 2.6) * 0.45;
        if (Math.abs(d - lace) < 0.5) c = h2(x, 1, seed) < 0.12 ? WT[2] : '#f4fbfc';
        else if (Math.abs(d - lace + 1) < 0.5 && h2(x, 2, seed) < 0.35) c = '#e2eeee';
        px(x, y, c);
        continue;
      }
      const foam = 2.4 + Math.sin(x / 9 + 1.3) * 1.1 + vnoise(x, 0, 6, seed) * 1.6;
      let c;
      if (d < foam - 1) c = '#ffffff';
      else if (d < foam) c = b < 0.5 ? '#ffffff' : '#c8f0f4';
      else if (d < foam + 4) c = b < (d - foam) / 4 ? SEA[4] : SEA[5];
      else if (d < 13 || (d < 17 && b < (17 - d) / 4)) c = SEA[4];
      else c = d > 24 && b < 0.5 ? SEA[2] : SEA[3];
      if (d > foam + 4) {
        // rolling crests
        const ph = (d + Math.sin(x / 13 + d / 6) * 1.8) / 7.5;
        const f = ph - Math.floor(ph);
        if (f < 0.09) c = d < 16 ? '#e8fcff' : SEA[5];
        else if (f < 0.17) c = c === SEA[3] || c === SEA[2] ? SEA[4] : SEA[5];
        if (h2(x, y, seed + 5) > 0.994) c = '#ffffff';
      }
      px(x, y, c);
    }
  }
}

// ---------- boardwalks ----------

/**
 * Sun-bleached boardwalks along the paths (all straight runs): planks across the way, each
 * lit on its near edge with a dark gap after it, ragged ends, nail heads, sand blown over the
 * edges in places, a shadow on the sand along the bottom and right.
 */
function boardwalkB(px, lines, seed) {
  const R = 6;
  const segs = [];
  lines.forEach((pts) => { for (let i = 1; i < pts.length; i += 1) segs.push([pts[i - 1], pts[i]]); });
  const box = ([[ax, ay], [bx, by]]) => ({ x0: Math.min(ax, bx) - R, x1: Math.max(ax, bx) + R, y0: Math.min(ay, by) - R, y1: Math.max(ay, by) + R, v: ax === bx });
  const boxes = segs.map(box);
  const on = (x, y) => boxes.some((q) => x >= q.x0 && x < q.x1 && y >= q.y0 && y < q.y1);
  // the shadow along the bottom and right
  boxes.forEach((q) => {
    for (let y = q.y0; y < q.y1 + 3; y += 1) for (let x = q.x0; x < q.x1 + 2; x += 1) if (!on(x, y) && (on(x - 1, y - 2) || on(x - 2, y - 1))) px(x, y, 'rgba(110,60,70,0.28)');
  });
  boxes.forEach((q) => {
    for (let y = q.y0; y < q.y1; y += 1) {
      for (let x = q.x0; x < q.x1; x += 1) {
        const along = q.v ? y : x; const across = q.v ? x - q.x0 : y - q.y0; const wid = q.v ? q.x1 - q.x0 : q.y1 - q.y0;
        const k = Math.floor(along / 5); const a = ((along % 5) + 5) % 5;
        // now and then a plank a little short at one end
        const lo = h2(k, 1, seed) < 0.12 ? 1 : 0; const hi = h2(k, 2, seed) < 0.12 ? wid - 1 : wid;
        if (across < lo || across >= hi) continue;
        const t = h2(k, 3, seed);
        const P = t < 0.2 ? [BW[2], BW[3], BW[4]] : t > 0.82 ? [BW[3], BW[5], BW[6]] : [BW[3], BW[4], BW[5]];
        let c = a === 4 ? BW[2] : a === 0 ? P[2] : a === 3 ? P[0] : P[1];
        // the edges of the walk: lit on the near side, in shade on the far side
        if (across === lo) c = a === 4 ? BW[3] : P[2];
        else if (across === hi - 1) c = a === 4 ? BW[0] : BW[1];
        else if (across === hi - 2 && a !== 4) c = P[0];
        if (a === 1 && (across === lo + 2 || across === hi - 4)) c = '#7a5a5a'; // nails
        else if (a !== 4 && h2(x >> 1, y >> 1, seed + 9) < 0.05) c = P[0]; // grain
        // sand blown over the boards
        const sd = vnoise(x, y, 9, seed + 4);
        if (sd > 0.76 && bayer(x, y) < (sd - 0.76) * 4) c = bayer(x, y) < 0.3 ? SD[5] : SD[4];
        px(x, y, c);
      }
    }
  });
}

/** The round deck the treasure chest stands on: planks in rows, a rim beam, little posts, a shadow. */
function deckB(px, cx, cy, r, seed) {
  for (let y = cy - r; y <= cy + r + 4; y += 1) for (let x = cx - r; x <= cx + r + 3; x += 1) {
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r) continue;
    if (Math.hypot(x - 1.5 - cx, y - 2.5 - cy) <= r) px(x, y, 'rgba(110,60,70,0.3)');
  }
  for (let y = cy - r; y <= cy + r; y += 1) {
    for (let x = cx - r; x <= cx + r; x += 1) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
      if (d > r) continue;
      let c;
      if (d > r - 2.2) c = dx + dy < -r * 0.3 ? BW[5] : dx + dy > r * 0.4 ? BW[1] : BW[3];
      else if (d > r - 3) c = BW[0];
      else {
        const k = Math.floor((y + 64) / 4); const a = (y + 64) % 4;
        const t = h2(k, Math.floor((x + 3 * k) / 17), seed);
        const P = t < 0.25 ? [BW[2], BW[3], BW[4]] : t > 0.8 ? [BW[3], BW[5], BW[6]] : [BW[2], BW[4], BW[5]];
        c = a === 3 ? BW[1] : a === 0 ? P[2] : a === 2 ? P[0] : P[1];
        if ((x + 3 * k) % 17 === 0 && a !== 3) c = BW[1]; // plank ends
        if (a === 1 && (x + 3 * k) % 17 === 2) c = '#6a4a50';
      }
      px(x, y, c);
    }
  }
  // posts round the rim with a coil of rope on top
  for (let i = 0; i < 10; i += 1) {
    const ang = (i / 10) * Math.PI * 2 + 0.3; const x = Math.round(cx + Math.cos(ang) * (r - 1)); const y = Math.round(cy + Math.sin(ang) * (r - 1));
    grid(px, x - 1, y - 2, ['lmd', 'lmd', 'mdd'], { l: BW[5], m: BW[3], d: BW[1] });
  }
}

/** The bridge over the lagoon, walked across left to right: planks down, rope rails sagging between posts, a shadow on the water. */
function bridgeH(px, c, seed = 83) {
  const { x: X, y: Y, w, h } = c;
  const top = Y + 5; const bot = Y + h - 5;
  for (let y = top + 3; y < bot + 4; y += 1) px(X + 2, y, 'rgba(20,40,80,0.28)', w, 1);
  propB(px, X, top, w, bot - top, (b) => {
    for (let x = -1; x < w + 1; x += 1) {
      const k = Math.floor((x + X) / 4); const a = (((x + X) % 4) + 4) % 4;
      const lo = h2(k, 1, seed) < 0.3 ? 1 : 0; const hi = h2(k, 2, seed) < 0.3 ? bot - top - 1 : bot - top;
      const t = h2(k, 3, seed);
      const P = t < 0.25 ? [BW[1], BW[2], BW[3], BW[4]] : t > 0.8 ? [BW[2], BW[4], BW[5], BW[6]] : [BW[1], BW[3], BW[4], BW[5]];
      for (let y = lo; y < hi; y += 1) {
        let col = a === 3 ? BW[0] : a === 0 ? P[3] : a === 2 ? P[1] : P[2];
        if (y === hi - 1 && a !== 3) col = P[0];
        if (a === 1 && (y === lo + 2 || y === hi - 3)) col = '#6a4a50';
        if (a !== 3 && h2(x, y >> 1, seed + 5) < 0.07) col = P[1];
        b.set(x, y, col, 'wood');
      }
    }
  }, { pad: 4, outline: (t, side) => (side === 'top' ? BW[2] : side === 'left' ? BW[2] : BW[0]) });
  // posts and rope rails: the far rail behind the deck, the near one in front
  const R = SB.rope;
  const posts = [X - 2, X + Math.round(w / 2) - 1, X + w - 1];
  const rail = (y0, front) => {
    for (let i = 1; i < posts.length; i += 1) {
      const a = posts[i - 1] + 1; const z = posts[i] + 1;
      for (let x = a; x <= z; x += 1) {
        const sag = Math.round(Math.sin(((x - a) / (z - a)) * Math.PI) * 3);
        px(x, y0 + sag, R[2]); px(x, y0 + sag + 1, R[0]);
        if (front) px(x, y0 + sag + 3, 'rgba(20,40,80,0.18)');
      }
    }
    posts.forEach((x) => grid(px, x - 1, y0 - 4, ['.ll.', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'dddd'], { l: BW[5], m: BW[3], d: BW[1] }));
  };
  rail(Y + 1, false);
  rail(Y + h - 4, true);
}

// ---------- outlines ----------

// selective outlines for the beach's materials: [lit side, shaded side]; things standing on the sand get ink underneath
const EDGE = {
  thatch: [SB.thatch[1], SB.thatch[0]], bamboo: [SB.bamboo[1], SB.bamboo[0]], drift: [SB.drift[2], SB.drift[1]], board: [SB.board[2], SB.board[1]],
  leaf: [SB.palm[1], SB.palm[0]], trunk: [SB.trunk[1], SB.trunk[0]], rope: [SB.rope[0], SB.drift[1]], sandc: [SD[2], SD[1]],
  shell: ['#c8909a', '#a06a7a'], rock: ['#7a6e8a', '#5a4e6a'], cloth: ['#7a4a5a', '#5a3048'],
};
const GROUNDED_B = new Set(['bamboo', 'drift', 'board', 'trunk', 'sandc', 'rock', 'wood', 'stone', 'door']);
function sel(tag, side) {
  const base = (tag || '').split(':')[0];
  const e = EDGE[base];
  if (!e) return selective(tag, side);
  if (side === 'bottom') return GROUNDED_B.has(base) ? INK : e[1];
  return side === 'right' ? e[1] : e[0];
}

// ---------- palms ----------

const PL = SB.palm; const TR = SB.trunk;
const palmSprites = new Map();
/**
 * A palm, 36 x 44 with its foot at (18, 42): a ringed trunk curving up to the crown, feathery
 * fronds (the back ones darker), coconuts, and its shadow on the sand. lean: how far the crown
 * leans, v: a variant. Drawn once per look and kept, so the ~50 palms cost little.
 */
function palmSprite(lean, v) {
  const id = `${lean}|${v}`;
  if (palmSprites.has(id)) return palmSprites.get(id);
  const cells = [];
  const put = (x, y, c, w = 1, h = 1) => cells.push([x, y, c, w, h]);
  const cx = 18 + lean; const cy = 13;
  // the shadow of the crown, cast down to the right
  for (let y = 38; y < 46; y += 1) for (let x = 0; x < 44; x += 1) { const d = ((x + 0.5 - cx - 7) / 12) ** 2 + ((y + 0.5 - 42.5) / 2.6) ** 2; if (d <= 1) put(x, y, `rgba(110,60,80,${d < 0.4 ? 0.22 : 0.13})`); }
  const b = new Buf(36, 44, 10);
  for (let y = cy + 1; y <= 42; y += 1) {
    const t = (42 - y) / (42 - cy);
    const x0 = 18 + lean * Math.pow(t, 1.7);
    const hw = 2.7 - t * 0.7 + (y > 39 ? (y - 39) * 0.6 : 0);
    for (let x = Math.floor(x0 - hw); x <= x0 + hw; x += 1) {
      const u = (x + 0.5 - x0) / hw;
      if (Math.abs(u) > 1) continue;
      const r = (y + v) % 3;
      let c = u < -0.4 ? TR[4] : u > 0.45 ? TR[2] : TR[3];
      if (r === 0) c = u < -0.4 ? TR[3] : TR[1];
      else if (r === 1 && u < 0.3) c = u < -0.4 ? TR[5] : TR[4];
      b.set(x, y, c, 'trunk');
    }
  }
  const frond = (a, len, droop, back, k) => {
    const S = [];
    for (let i = 0; i <= 36; i += 1) {
      const s = i / 36;
      S.push([cx + Math.cos(a) * len * s, cy + Math.sin(a) * len * s * 0.7 + droop * s * s, 2.7 * Math.sin(Math.PI * Math.min(1, s * 0.88 + 0.12)) + 0.35, s]);
    }
    const xs = S.map((q) => q[0]); const ys = S.map((q) => q[1]);
    for (let y = Math.floor(Math.min(...ys) - 4); y <= Math.max(...ys) + 4; y += 1) {
      for (let x = Math.floor(Math.min(...xs) - 4); x <= Math.max(...xs) + 4; x += 1) {
        let best = null; let bd = Infinity; let bi = 0;
        S.forEach((q, i) => { const d = Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]) - q[2]; if (d < bd) { bd = d; best = q; bi = i; } });
        if (bd > 0) continue;
        const nxt = S[Math.min(36, bi + 1)]; const prv = S[Math.max(0, bi - 1)];
        const tx = nxt[0] - prv[0]; const ty = nxt[1] - prv[1];
        const side = tx * (y + 0.5 - best[1]) - ty * (x + 0.5 - best[0]); // which side of the midrib
        const below = Math.sign(side) === Math.sign(tx || 1) ? side * Math.sign(tx || 1) > 0 : false;
        const dist = Math.hypot(x + 0.5 - best[0], y + 0.5 - best[1]);
        // leaflets: the lower edge is feathery
        if (below && dist > best[2] * 0.4 && (x + y * 2 + k) % 3 === 0) continue;
        let i = below ? 2 : 4;
        if (dist < 0.75 && best[3] > 0.15) i = 5;
        if (best[3] > 0.82) i += 1;
        if (!below && h2(x, y, k + 7) < 0.12) i -= 1;
        if (back) i -= 1;
        b.set(x, y, PL[clamp(i, 1, 6)], 'leaf');
      }
    }
  };
  const j = (n) => (h2(n, v, 41) - 0.5) * 0.25;
  // back fronds, coconuts, then the fronds in front
  [[-2.45, 13, 3], [-0.7, 13, 3], [-1.62, 10, 2]].forEach(([a, len, dr], k) => frond(a + j(k), len, dr, true, k));
  [[-1, 2, 0], [2, 3, 1], [0, 4, 0]].forEach(([dx, dy, k]) => grid((x, y, c) => b.set(x, y, c, 'trunk'), cx + dx - 1, cy + dy - 1, ['.cc.', 'cCcd', 'cccd', '.dd.'], { c: k ? '#7a6a3a' : '#8a7a40', C: '#c8b870', d: '#4a3a2e' }));
  [[3.05, 16, 8], [0.09, 16, 8], [2.45, 15, 10], [0.7, 15, 10], [1.85, 10, 6], [1.3, 11, 6]].forEach(([a, len, dr], k) => frond(a + j(k + 3), len, dr, false, k + 3));
  b.outline(sel);
  b.soften((c) => mix(c, PL[1], 0.4), ['leaf']);
  b.blit(put, 0, 0);
  palmSprites.set(id, cells);
  return cells;
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
function palmB(px, p) {
  const k = h2(p.x, p.y, 13);
  const lean = [-5, -3, 3, 5, 6][Math.floor(k * 5)];
  palmSprite(lean, Math.floor(h2(p.y, p.x, 17) * 3)).forEach(([x, y, c, w, h]) => px(p.x + x, p.y + y, c, w, h));
}

// ---------- huts ----------

const TH = SB.thatch; const BB = SB.bamboo; const DW = SB.drift; const GL = PB.glow;

/**
 * A beach hut in the same box as the old one: a deep thatch of dried palm leaves in shaggy
 * courses, bamboo walls with lashed driftwood beams, a plank porch, a painted door with a
 * porthole, shuttered windows lit warm inside with hibiscus in the boxes. o: { door, shutter
 * (paint), home (the kid's hut: a pennant in their color on the roof), sign: 'note', buoy, seed }.
 */
function hutB(px, X, Y, w, h, o = {}) {
  const seed = o.seed ?? (X * 7 + Y);
  const mid = w / 2;
  const eave = Math.round(h * 0.56);
  const wallTop = eave - 4; const floor = h - 5;
  const b = new Buf(w, h, 16);
  groundShadow(px, X + mid + 4, Y + h + 1, w / 2 + 4, 3.4, 0.2);
  // bamboo walls, shaded under the thatch
  for (let y = wallTop; y < floor; y += 1) {
    for (let x = 3; x < w - 3; x += 1) {
      const pole = Math.floor((x - 3) / 4); const c4 = (x - 3) % 4;
      let c = c4 === 0 ? BB[4] : c4 === 3 ? BB[1] : BB[3];
      if (c4 === 2 && h2(pole, y >> 2, seed) < 0.3) c = BB[2];
      const node = (y + Math.floor(h2(pole, 1, seed) * 9)) % 10;
      if (c4 !== 3 && node === 0) c = BB[1]; else if (c4 !== 3 && node === 1) c = BB[5];
      const sh = (wallTop + 7 - y) / 7;
      if (bayer(x, y) < sh) c = sh > 0.55 ? BB[0] : BB[1];
      if (x >= w - 6 && bayer(x, y) < 0.5) c = mix(c, BB[0], 0.35);
      b.set(x, y, c, 'bamboo');
    }
  }
  // driftwood beams lashed across
  for (const by of [wallTop + 6, floor - 6]) {
    for (let x = 2; x < w - 2; x += 1) { b.set(x, by, DW[5], 'drift'); b.set(x, by + 1, DW[3], 'drift'); b.set(x, by + 2, DW[2], 'drift'); }
    for (let x = 5; x < w - 4; x += 8) { b.set(x, by - 1, SB.rope[2], 'rope'); b.set(x, by + 3, SB.rope[1], 'rope'); b.set(x + 1, by + 1, SB.rope[2], 'rope'); }
  }
  // the porch: planks along the front
  for (let x = 0; x < w; x += 1) for (let y = floor; y < h; y += 1) {
    let c = y === floor ? BW[5] : y === floor + 1 ? BW[4] : y === h - 1 ? BW[1] : BW[3];
    if ((x + 3) % 11 === 0 && y > floor) c = BW[1];
    b.set(x, y, c, 'board');
  }
  // the door: painted planks under a rounded top, a porthole, a knob, a driftwood frame, a step
  const Dc = ramp(o.door || '#2f9e8e', 3, 2);
  const dw = o.home ? 16 : 14; const dh = o.home ? 24 : 21; const dx = Math.round(mid - dw / 2); const dy = floor - dh;
  const inD = (x, y, g = 0) => x >= dx - g && x < dx + dw + g && y < floor && (y >= dy + dw / 2 || inEll(x, y, dx + dw / 2, dy + dw / 2, dw / 2 + g, dw / 2 + g));
  for (let y = dy - 3; y < floor; y += 1) {
    for (let x = dx - 3; x < dx + dw + 3; x += 1) {
      if (inD(x, y)) {
        const pl = (x - dx) % 4;
        let c = pl === 0 ? Dc[4] : pl === 3 ? Dc[2] : Dc[3];
        if (x >= dx + dw - 2) c = pl === 3 ? Dc[1] : Dc[2];
        if (!inD(x, y - 2)) c = Dc[1];
        b.set(x, y, c, 'door');
      } else if (inD(x, y, 2)) b.set(x, y, x < mid && y < dy + dw ? DW[5] : x < dx ? DW[4] : DW[2], 'drift');
    }
  }
  const pw = Math.round(mid) - 2; const py = dy + 5;
  grid((x, y, c) => b.set(x, y, c, 'metal'), pw - 1, py - 1, ['.ooo.', 'oGgYo', 'ogYyo', 'oYyyo', '.ooo.'], { o: '#c08a3a', G: GL[4], g: GL[3], Y: GL[3], y: GL[2] });
  grid((x, y, c) => b.set(x, y, c, 'metal'), dx + dw - 5, dy + Math.round(dh * 0.62), ['yY', 'Yo'], { y: '#fff0a0', Y: '#f0c030', o: '#a86a1a' });
  for (let x = dx - 2; x < dx + dw + 2; x += 1) { b.set(x, h, x < dx ? BW[5] : BW[4], 'board'); b.set(x, h + 1, BW[2], 'board'); }
  // windows: warm light inside, shutters, a box of hibiscus underneath
  const Sc = ramp(o.shutter || '#4dabf7', 3, 2);
  const win = (x, y) => {
    const ww = 12; const wh = 10;
    b.rect(x - 1, y - 1, ww + 2, wh + 2, DW[2], 'drift'); b.rect(x - 1, y - 1, ww + 2, 1, DW[4], 'drift'); b.rect(x - 1, y - 1, 1, wh + 2, DW[4], 'drift');
    for (let yy = 0; yy < wh; yy += 1) for (let xx = 0; xx < ww; xx += 1) {
      let c = yy < wh / 2 ? GL[3] : GL[2];
      if (xx + yy < 4) c = GL[4];
      if (yy === wh - 1 || xx === ww - 1) c = GL[1];
      if (xx === ww / 2 || yy === wh / 2) c = DW[3];
      b.set(x + xx, y + yy, c, 'glass');
    }
    for (const sx of [x - 6, x + ww + 1]) for (let yy = -1; yy < wh + 1; yy += 1) for (let xx = 0; xx < 5; xx += 1) {
      b.set(sx + xx, y + yy, yy % 2 ? (xx === 4 ? Sc[1] : Sc[3]) : (xx === 4 ? Sc[2] : Sc[4]), 'shutter');
    }
    const by = y + wh + 1;
    b.rect(x - 2, by, ww + 4, 3, DW[3], 'drift'); b.rect(x - 2, by, ww + 4, 1, DW[5], 'drift');
    for (let xx = x - 2; xx < x + ww + 2; xx += 1) {
      const f = (xx * 3 + seed) % 6;
      b.set(xx, by - 1, PL[3], 'leaf');
      if (f === 0 || f === 3) { const fc = ['#ff6a8a', '#ffd23f', '#ff8a5a'][(xx + seed) % 3]; b.set(xx, by - 2, fc, 'flower'); b.set(xx - 1, by - 2, mix(fc, '#ffffff', 0.4), 'flower'); b.set(xx, by - 3, mix(fc, '#7a2a4a', 0.3), 'flower'); }
      else if (f === 1) b.set(xx, by - 2, PL[4], 'leaf');
    }
  };
  const gap = (w - dw) / 2;
  win(Math.round(gap / 2) - 3, wallTop + 11);
  win(Math.round(w - gap / 2) - 9, wallTop + 11);
  if (o.buoy) grid((x, y, c) => b.set(x, y, c, 'cloth'), w - 14, floor - 13, ['..rrr..', '.rRwRr.', 'rw...wr', 'rR...Rr', 'rw...wr', '.rRwRr.', '..rrr..'], { r: '#c8384a', R: '#f06a6a', w: '#fff6f0' });

  // the thatch: dried palm leaves in shaggy courses, lit from the left, a long ragged hem
  const rw = w * 0.17; const hb = w / 2 + 6;
  const hem = (x) => eave + (h2(x, 2, seed) < 0.5 ? 1 : 0) + (h2(x, 3, seed) < 0.22 ? 2 : 0);
  const fringe = (x, c) => 1 + Math.floor(h2(x, c, seed + 1) * 2.6); // how far a course's strands hang over the next
  for (let y = 0; y <= eave + 3; y += 1) {
    const t = Math.min(1, y / eave);
    let half = rw + (hb - rw) * Math.pow(t, 0.7);
    if (y < 3) half -= (3 - y) ** 2 * 0.6;
    for (let x = Math.round(mid - half); x < Math.round(mid + half); x += 1) {
      if (y > hem(x)) continue;
      const side = (x + 0.5 - mid) / half;
      const wob = Math.round(Math.sin(x / 5 + seed) * 0.8);
      const yy = y + wob - 3; const course = Math.floor(yy / 7); const yc = ((yy % 7) + 7) % 7;
      // round: lit up the left, in shade down the right and towards the hem
      let k = 3 - Math.round(side * 1.15 + t * 0.6 - 0.3);
      const fl = fringe(x, course - 1);
      if (course > 0 && yc < fl) k += yc === fl - 1 ? 1 : 0; // strands of the course above hanging over
      else if (course > 0 && yc === fl) k -= 2; // the shadow under them
      else if (h2(x, course, seed) < 0.24) k -= 1; // streaks of darker leaves
      else if (h2(x, course, seed + 3) > 0.86) k += 1;
      if (y >= hem(x) - 1) k = 1 + (x < mid ? 1 : 0) - (y === hem(x) ? 1 : 0);
      if (y < 4) k = ((x + seed) % 7 === 0) ? 2 : y === 1 ? 5 : 4; // the ridge roll
      b.set(x, y, TH[clamp(k, 0, 5)], 'thatch');
    }
  }
  for (let x = Math.round(mid - rw); x < mid + rw; x += 6) { b.set(x, 1, SB.rope[1], 'rope'); b.set(x, 2, SB.rope[1], 'rope'); b.set(x, 3, SB.rope[0], 'rope'); }
  // a tuft on top; on the kid's hut a pennant in their color
  grid((x, y, c) => b.set(x, y, c, 'thatch'), Math.round(mid) - 3, -4, ['.l.l.', 'lLlLl', '.mLm.', '..m..'], { l: TH[5], L: TH[4], m: TH[2] });
  if (o.home) {
    const Fc = ramp(o.door || '#e03131', 2, 2);
    for (let y = -16; y < -2; y += 1) { b.set(Math.round(mid) + 3, y, DW[4], 'drift'); b.set(Math.round(mid) + 4, y, DW[2], 'drift'); }
    grid((x, y, c) => b.set(x, y, c, 'flag'), Math.round(mid) + 5, -16, ['LLLmm.....', 'LLmmmmmd..', 'mmmmmmmmdd', 'mmmmmdd...', 'mddd......'], { L: Fc[3], m: Fc[2], d: Fc[1] });
  }
  if (o.sign === 'note') {
    grid((x, y, c) => b.set(x, y, c, 'drift'), Math.round(mid) - 7, dy - 15, [
      '.LLLLLLLLLLLL.',
      'LllllllllllldD',
      'LlccccKKcccccD',
      'LlccccKKKccccD',
      'LlccccKcKKcccD',
      'LlccccKccKcccD',
      'LlccccKcccccdD',
      'LlcKKKKcccccdD',
      'LlKKKKKcccccdD',
      'LlcKKKccccccdD',
      'LddddddddddddD',
      '.DDDDDDDDDDDD.',
    ], { L: DW[5], D: DW[1], l: '#fffbe8', c: '#fff0c8', d: '#e8d0a0', K: '#5a3a8a' });
  }
  b.outline((t, side) => (t === 'flag:edge' || (t || '').startsWith('flag') ? (side === 'bottom' || side === 'right' ? mix(o.door || '#e03131', INK, 0.5) : null) : sel(t, side)));
  b.soften((c) => mix(c, TH[1], 0.45), ['thatch']);
  // a shell wind chime hanging from the eave
  const chx = Math.round(mid + hb - 9);
  for (let y = eave + 2; y < eave + 9; y += 1) b.set(chx, y, SB.rope[1]);
  [[0, 5, '#ffd0d8'], [0, 8, '#fff6ea'], [0, 11, '#ffc8a8']].forEach(([dx2, dy2, c]) => { b.set(chx + dx2 - 1, eave + dy2, c); b.set(chx + dx2, eave + dy2, c); b.set(chx + dx2, eave + dy2 + 1, mix(c, '#a06a7a', 0.5)); });
  b.blit(px, X, Y);
}

// ---------- the stall ----------

/** The buddy shop's beach stall, 44 x 33: bamboo posts, a scalloped striped awning, shirts hanging inside, a sign with a shirt, hats and flip-flops on a woven counter. */
function stallB(px, X, Y, pal = {}) {
  groundShadow(px, X + 23, Y + 31, 22, 2.4, 0.2);
  const R = ramp(pal.a || '#22b8cf', 2, 2); const C = ['#c8b8a0', '#ece0c4', '#fffbe8', '#ffffff'];
  propB(px, X, Y, 44, 33, (b, put) => {
    b.fill(5, 9, 34, 12, (x, y) => (y < 11 ? '#3a2a4a' : bayer(x, y) < 0.5 ? '#5a3c50' : '#4a3248'), 'drift');
    b.rect(5, 11, 34, 1, BB[3], 'bamboo');
    grid(put('cloth'), 7, 12, ['.oO.oo.', 'oOOyooo', 'o.oyo.d', '..ooy..', '..oyd..', '..odd..'], { o: '#ff8a5a', O: '#ffc09a', y: '#ffe070', d: '#c0582e' });
    grid(put('cloth'), 31, 12, ['..t..', '.tTt.', '.tTw.', 'ttwTt', 'twttt', 'tdddt'], { t: '#3ac0b0', T: '#9aeee0', w: '#fff6ea', d: '#1f8a80' });
    for (const x of [2, 39]) for (let y = 8; y < 31; y += 1) { b.set(x, y, (y + x) % 7 === 0 ? BB[1] : BB[4], 'bamboo'); b.set(x + 1, y, (y + x) % 7 === 0 ? BB[1] : BB[3], 'bamboo'); b.set(x + 2, y, BB[2], 'bamboo'); }
    b.rect(1, 20, 42, 1, DW[6], 'drift'); b.rect(1, 21, 42, 1, DW[4], 'drift');
    for (let x = 1; x < 43; x += 1) for (let y = 22; y < 30; y += 1) {
      const wv = ((Math.floor(x / 3) + Math.floor((y - 22) / 2)) % 2);
      b.set(x, y, y === 29 ? TH[1] : wv ? TH[3] : TH[4], 'thatch');
    }
    for (let y = 0; y < 11; y += 1) {
      for (let x = 0; x < 44; x += 1) {
        const s = Math.floor(x / 6) % 2; const P = s ? C : R; const sx = x % 6;
        if (y === 0 && (x === 0 || x === 43)) continue;
        if (y >= 8) {
          const dx2 = Math.abs(sx + 0.5 - 3);
          if ((y === 8 && dx2 > 3) || (y === 9 && dx2 > 2.5) || (y === 10 && dx2 > 1.5)) continue;
          b.set(x, y, y === 10 || sx === 5 ? P[0] : P[1], 'cloth');
          continue;
        }
        let c = y < 2 ? P[3] : P[2];
        if ((y >= 4 && sx === 5) || y === 7 || (x > 37 && y >= 2)) c = P[1];
        b.set(x, y, c, 'cloth');
      }
    }
  }, {
    outline: sel,
    after: (b, put) => {
      grid(put('drift'), 15, 10, [
        '.s..........s.',
        'LLLLLLLLLLLLLD',
        'LccBBBccBBBccD',
        'LcBbbbBBbbbBcD',
        'LcbbbbbbbbbbcD',
        'LcccbbbbbbcccD',
        'LcccbbbbbbcccD',
        'LcccbbbbbbcccD',
        'LccccccccccccD',
        'DDDDDDDDDDDDDD',
      ], { s: '#5a4040', L: DW[5], D: DW[1], c: '#fff4d8', B: '#ffb08a', b: '#f0603a' });
      // a straw sun hat and flip-flops on the counter
      grid(put('cloth'), 3, 16, ['..hhh..', '.hHHHh.', 'hrrrrrh', 'hhhhhhh'], { h: '#e8c070', H: '#f8e0a0', r: '#e04a6a' });
      grid(put('cloth'), 31, 17, ['.p..p.', 'pPp.pP', 'ppp.pp'], { p: '#ff7aa8', P: '#ffd0e0' });
    },
  });
}

// ---------- props ----------

const RK = ['#5a4e6a', '#7a6e8a', '#9a90a8', '#bab2c4', '#dcd6e2', '#f4f0f6'];
const CS = ['#8a6a62', '#b08a74', '#cfa684', '#e2be96', '#f2d6ae', '#fbe8c8']; // packed wet sand

/** A beach umbrella, 32 x 36: a striped canopy with a scalloped hem, a pole, a striped towel in its shade. */
export function umbrellaB(px, X, Y, c = '#ff6b6b') {
  const P = ramp(c, 2, 2); const Wt = ['#c8b8c8', '#ece4ec', '#ffffff', '#ffffff', '#ffffff'];
  const Tw = ramp(c === '#4dabf7' ? '#ffd23f' : '#3ac0b0', 2, 2);
  // the towel, with fringes, and the canopy's shade over it
  for (let y = 0; y < 8; y += 1) for (let x = -1; x < 23; x += 1) {
    const fr = x < 0 || x > 21;
    if (fr && (y % 2 || y === 7)) continue;
    px(X + 5 + x, Y + 27 + y, fr ? Tw[3] : y === 7 ? Tw[0] : Math.floor(x / 4) % 2 ? '#fff6ea' : Tw[2]);
  }
  groundShadow(px, X + 19, Y + 30, 13, 3.6, 0.22);
  propB(px, X, Y, 32, 36, (b) => {
    for (let y = 8; y < 35; y += 1) { b.set(15, y, Wt[2], 'pole'); b.set(16, y, Wt[1], 'pole'); }
    for (let y = 1; y < 15; y += 1) {
      for (let x = 0; x < 32; x += 1) {
        const dx = (x + 0.5 - 16) / 16; const dy = (y + 0.5 - 14) / 12.5;
        if (dx * dx + dy * dy > 1) continue;
        const panel = Math.floor((Math.atan2(y + 0.5 - 15, x + 0.5 - 16) + Math.PI) / (Math.PI / 6));
        const R = panel % 2 ? Wt : P;
        const sx = x - 16;
        // the scalloped hem
        const sc = 12 + Math.round(Math.cos(((sx + 32) % 5.33) / 5.33 * Math.PI * 2) * 0.8);
        if (y > sc) continue;
        let k = 2 - (dx < -0.35 ? -1 : dx > 0.4 ? 1 : 0);
        if (y >= sc - 1) k -= 1;
        if (dy < -0.75) k += 1;
        b.set(x, y, R[clamp(k, 0, 4)], panel % 2 ? 'white' : 'cloth');
      }
    }
    grid((x, y, col) => b.set(x, y, col, 'pole'), 14, -2, ['.w.', 'wWw', '.d.'], { w: Wt[2], W: '#fffbe8', d: Wt[0] });
  }, { outline: (t, side) => (t === 'pole' ? (side === 'bottom' ? INK : '#9a8a9a') : t === 'white' ? (side === 'bottom' || side === 'right' ? '#a898a8' : '#c8b8c8') : sel(t, side) || P[0]) });
  px(X + 13, Y + 35, 'rgba(110,60,70,0.3)', 6, 1);
}

/** A sandcastle, 30 x 26: two bucket towers and a tall keep with battlements, a door, shells, a flag, a moat in front, a red bucket. */
export function sandcastleB(px, X, Y) {
  groundShadow(px, X + 16, Y + 25, 15, 2.4, 0.2);
  for (let x = 1; x < 29; x += 1) { px(X + x, Y + 25, x % 5 === 2 ? '#a8d8e0' : '#62bcd6'); px(X + x, Y + 26, CS[1]); }
  propB(px, X, Y, 30, 26, (b) => {
    const tone = (x, y, x0, x1) => { const u = (x + 0.5 - x0) / (x1 - x0); return u < 0.25 ? CS[4] : u > 0.78 ? CS[2] : CS[3]; };
    const merlons = (x0, x1, y0) => { for (let x = x0; x < x1; x += 1) if ((x - x0) % 3 !== 2) b.set(x, y0, tone(x, y0, x0, x1) === CS[2] ? CS[3] : CS[5], 'sandc'); };
    for (let y = 14; y < 25; y += 1) for (let x = 2; x < 28; x += 1) b.set(x, y, y === 14 ? CS[5] : tone(x, y, 2, 28), 'sandc');
    merlons(2, 28, 13);
    for (const [x0, x1] of [[3, 10], [20, 27]]) {
      for (let y = 7; y < 25; y += 1) for (let x = x0; x < x1; x += 1) { let c = tone(x, y, x0, x1); if ((y - 7) % 5 === 4) c = CS[2]; if ((y - 7) % 5 === 0) c = mix(c, CS[5], 0.5); b.set(x, y, c, 'sandc'); }
      merlons(x0, x1, 6);
      b.set(x0 + 3, 11, CS[0], 'sandc'); b.set(x0 + 3, 12, CS[1], 'sandc');
    }
    for (let y = 3; y < 25; y += 1) for (let x = 11; x < 19; x += 1) b.set(x, y, y === 3 ? CS[5] : tone(x, y, 11, 19), 'sandc');
    merlons(11, 19, 2);
    b.fill(12, 18, 6, 7, (x, y) => (inEll(x, y, 15, 21, 3, 3.5) || y > 21 ? (y < 20 ? CS[0] : '#6a4a5a') : null), 'sandc');
    b.set(14, 8, CS[0], 'sandc'); b.set(15, 8, CS[0], 'sandc'); b.set(14, 9, CS[1], 'sandc'); b.set(15, 9, CS[1], 'sandc');
    grid((x, y, c) => b.set(x, y, c, 'shell'), 13, 11, ['.pP.', 'pPPp', '.pp.'], { p: '#ff9ab0', P: '#ffd0dc' });
    grid((x, y, c) => b.set(x, y, c, 'shell'), 5, 17, ['wW', 'ww'], { w: '#fff6ea', W: '#ffffff' });
    for (let y = -6; y < 2; y += 1) b.set(15, y, '#7a5a4a', 'stick');
    grid((x, y, c) => b.set(x, y, c, 'flag'), 16, -6, ['rRr..', 'rrrrr', 'rr...'], { r: '#e8384a', R: '#ff8a8a' });
    // a red bucket by the wall
    grid((x, y, c) => b.set(x, y, c, 'cloth'), 25, 19, ['hhhhh', 'RrrRr', '.rrr.', '.rrd.', '.ddd.'], { h: '#ffe070', R: '#ff8a8a', r: '#e8384a', d: '#a82040' });
  }, { outline: (t, side) => (t === 'stick' || t === 'flag' ? null : sel(t, side)) });
}

/** A surfboard stuck in the sand, 10 x 30: a stripe down it, a darker rail, a little mound of sand at its foot. */
export function surfboardB(px, X, Y, c = '#4dabf7') {
  const P = ramp(c, 2, 2);
  for (let k = 0; k < 7; k += 1) px(X + 6 + k, Y + 27 - Math.round(k * 0.4), 'rgba(110,60,70,0.22)', 2, 2);
  propB(px, X, Y, 10, 30, (b) => {
    for (let y = 0; y < 27; y += 1) for (let x = 0; x < 10; x += 1) {
      if (!inEll(x, y, 5, 14, 4.4, 14.5)) continue;
      const u = (x + 0.5 - 5) / 4.4;
      let k = u < -0.45 ? 3 : u > 0.5 ? 1 : 2;
      if (Math.abs(x + 0.5 - 5) < 1) k = 4;
      if (y < 4 && u < 0) k = 4;
      b.set(x, y, k === 4 ? '#fff6ea' : P[k], 'cloth');
    }
    for (let x = 1; x < 9; x += 1) for (let y = 25; y < 30; y += 1) if (inEll(x, y, 5, 29, 4.6, 3.6)) b.set(x, y, y === 25 || x < 3 ? SD[5] : SD[3], 'sandc');
  }, { outline: (t, side) => (t === 'sandc' ? (side === 'bottom' ? SD[2] : null) : side === 'bottom' || side === 'right' ? P[0] : mix(P[0], P[1], 0.5)) });
}

/** A rock on the beach: lilac-grey, lit top-left, barnacles and a little seaweed near its foot. */
export function rockB(px, X, Y, w = 22, h = 16) {
  groundShadow(px, X + w / 2 + 2, Y + h - 1, w / 2 + 1, 2.4, 0.22);
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const wob = (vnoise(x + X, y + Y, 4, 5) - 0.5) * 0.25;
      if (!inEll(x, y, w / 2, h * 0.58, w / 2 * (1 + wob), h * 0.6 * (1 + wob)) || y > h - 2) continue;
      const s = (x + 0.5 - w / 2) / w * 1.6 + (y + 0.5 - h / 2) / h * 1.8;
      let c = s < -0.9 ? RK[5] : s < -0.3 ? RK[4] : s > 0.8 ? RK[2] : RK[3];
      if (y > h - 5) c = bayer(x, y) < 0.5 ? RK[2] : RK[1];
      if (vnoise(x + X, y + Y, 3, 9) > 0.7 && s > -0.5) c = RK[2];
      b.set(x, y, c, 'rock');
    }
    for (let x = 2; x < w - 2; x += 1) {
      const by = h - 4 - (h2(x, 1, X) < 0.4 ? 1 : 0);
      if (h2(x, 3, Y) < 0.28 && b.get(x, by)) { b.set(x, by, '#fff6f0', 'rock'); b.set(x, by + 1, RK[1], 'rock'); }
      if (h2(x, 4, Y) < 0.22 && b.get(x, h - 2)) { b.set(x, h - 2, '#4a7a4e', 'leaf'); b.set(x, h - 3, '#6a9a52', 'leaf'); }
    }
  }, { outline: sel });
}

// ---------- the beach's little things ----------

/** A striped hammock slung between two palm trunks: from (X, Y) to (X + w, Y + dy), sagging, with a pillow and a sun hat. */
export function hammockB(px, X, Y, w = 44, dy = 6) {
  const sag = (t) => Math.sin(t * Math.PI) * 10;
  const y = (x) => Y + (dy * (x - X)) / w + sag((x - X) / w);
  groundShadow(px, X + w / 2 + 3, Y + 22, w / 2 - 4, 3, 0.18);
  // ropes fanning from each trunk to the hammock's ends
  for (let k = 0; k < 6; k += 1) { px(X + k, Y + k * 0.6, SB.rope[1]); px(X + w - k, Y + dy + k * 0.6, SB.rope[1]); }
  propB(px, X + 5, Math.floor(Y - 2), w - 10, 22, (b) => {
    for (let x = X + 5; x < X + w - 5; x += 1) {
      const top = Math.round(y(x)) - Math.floor(Y - 2); const t = (x - X) / w;
      const deep = 2 + Math.round(Math.sin(t * Math.PI) * 4);
      for (let yy = top; yy < top + deep; yy += 1) {
        const stripe = Math.floor((x - X) / 4) % 3;
        const c = ['#ff8a5a', '#fff2d0', '#3ac0b0'][stripe];
        b.set(x - X - 5, yy, yy === top ? mix(c, '#ffffff', 0.35) : yy === top + deep - 1 ? mix(c, INK, 0.3) : c, 'cloth');
      }
    }
    grid((xx, yy, c) => b.set(xx, yy, c, 'cloth'), 3, Math.round(y(X + 10)) - Math.floor(Y - 2) - 3, ['.www.', 'wWWww', '.www.'], { w: '#f4ecf8', W: '#ffffff' });
    grid((xx, yy, c) => b.set(xx, yy, c, 'cloth'), w - 26, Math.round(y(X + w - 16)) - Math.floor(Y - 2) - 3, ['..hhh..', '.hHHHh.', 'hhrrrhh'], { h: '#e8c070', H: '#f8e0a0', r: '#e04a6a' });
  }, { outline: (t, side) => (side === 'bottom' || side === 'right' ? '#7a4a5a' : '#a86a6a') });
}

/** A rowboat on the water, 38 x 16: planked, a seat, oars shipped, a rope to a post, a gull on the post. */
export function rowboatB(px, X, Y) {
  for (let x = 2; x < 36; x += 1) px(X + x, Y + 14, x % 3 ? 'rgba(20,40,90,0.3)' : '#e8fcff');
  propB(px, X, Y, 38, 15, (b) => {
    for (let y = 2; y < 14; y += 1) for (let x = 0; x < 38; x += 1) {
      const u = (x + 0.5 - 19) / 19; const top = 3 + Math.round(u * u * -2); const bot = 13 - Math.round(u * u * 8);
      if (y < top || y > bot) continue;
      let c;
      if (y <= top + 1) c = y === top ? SB.board[6] : SB.board[4];
      else if (y > top + 1 && y < top + 4 && Math.abs(u) < 0.82) c = y === top + 2 ? '#4a3a4a' : '#6a4a50'; // inside
      else c = (y - top) % 3 === 0 ? '#2a78a8' : y > bot - 2 ? '#1e5a8a' : '#3a9ad0';
      b.set(x, y, c, 'board');
    }
    for (let x = 14; x < 24; x += 1) b.set(x, 4, SB.board[5], 'board');
    for (let k = 0; k < 14; k += 1) b.set(8 + k, 1 + Math.round(k * 0.1), SB.board[3], 'board');
    grid((x, y, c) => b.set(x, y, c, 'board'), 20, 0, ['ppp', 'pdp'], { p: SB.board[5], d: SB.board[2] });
  }, { outline: (t, side) => (side === 'bottom' ? '#1e3a6a' : side === 'right' ? '#1e4a7a' : '#2a5a8a') });
  // the rope to a post, and a gull on it
  for (let k = 0; k < 14; k += 1) px(X + 37 + k, Y + 6 + Math.round(Math.sin((k / 13) * Math.PI) * 2), SB.rope[1]);
  propB(px, X + 50, Y - 2, 4, 16, (b) => { for (let y = 0; y < 16; y += 1) { b.set(0, y, DW[4], 'drift'); b.set(1, y, DW[3], 'drift'); b.set(2, y, DW[2], 'drift'); } });
  gullB(px, X + 47, Y - 9, true);
}

/** A seagull standing, 9 x 8. */
export function gullB(px, X, Y, perched = false) {
  if (!perched) px(X + 1, Y + 8, 'rgba(110,60,70,0.22)', 7, 1);
  grid(px, X, Y, ['...ww....', '..wWWo...', '.ggwWw...', 'gGGGWWw..', '.ggGWWww.', '...wWw...', '...y.y...', '...y.y...'], { w: '#e8e4f0', W: '#ffffff', o: '#f0a030', g: '#8a90a8', G: '#b0b6c8', y: '#f0a030' });
}

/** A tide pool among rocks, 30 x 16: clear water over sand, a starfish, an anemone, a tiny fish. */
export function tidepoolB(px, X, Y) {
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 30; x += 1) {
    const k = ((x + 0.5 - 15) / 13) ** 2 + ((y + 0.5 - 8) / 6) ** 2;
    if (k > 1.25) continue;
    if (k > 1) { px(X + x, Y + y, WT[1]); continue; }
    px(X + x, Y + y, k > 0.7 ? (y < 8 ? AQ[3] : AQ[5]) : k > 0.4 ? AQ[4] : bayer(x, y) < 0.5 ? AQ[4] : AQ[5]);
  }
  grid(px, X + 9, Y + 6, ['..o..', '.oOo.', 'oOOOo', '.o.o.'], { o: '#f07a5a', O: '#ffb08a' });
  grid(px, X + 18, Y + 8, ['p.p', '.P.', 'p.p'], { p: '#e05aa0', P: '#ffb0d8' });
  px(X + 22, Y + 5, '#ffa040', 2, 1); px(X + 24, Y + 5, '#e06a20');
  [[0, 6, 3.6, 2.6], [5, 13, 3, 2], [26, 4, 3.4, 2.4], [24, 13, 3.8, 2.4], [14, 1, 3, 2]].forEach(([x, y, rx, ry], i) => {
    for (let yy = -3; yy <= 3; yy += 1) for (let xx = -4; xx <= 4; xx += 1) {
      if (!inEll(xx, yy, 0, 0, rx, ry)) continue;
      const sh = xx / rx + yy / ry;
      px(X + x + xx, Y + y + yy, sh < -0.6 ? RK[4] : sh > 0.7 ? RK[1] : (i + xx) % 3 === 0 && yy > 0 ? '#5a8a52' : RK[3]);
    }
  });
}

/** A bleached driftwood log, 32 x 12, with a knot and a shell resting on it. */
export function driftwoodB(px, X, Y) {
  groundShadow(px, X + 17, Y + 10, 15, 2, 0.2);
  propB(px, X, Y, 32, 12, (b) => {
    for (let x = 0; x < 32; x += 1) {
      const top = 3 + Math.round(Math.sin(x / 6) * 0.8) + (x < 2 || x > 29 ? 1 : 0); const bot = 9 - (x > 29 ? 1 : 0);
      for (let y = top; y <= bot; y += 1) {
        let c = y === top ? DW[6] : y === top + 1 ? DW[5] : y > bot - 2 ? DW[2] : DW[4];
        if (h2(x >> 1, y, 3) < 0.12 && y > top) c = DW[3];
        b.set(x, y, c, 'drift');
      }
    }
    for (let k = 0; k < 6; k += 1) { b.set(24 + k, 2 - Math.round(k * 0.5), DW[5], 'drift'); b.set(24 + k, 3 - Math.round(k * 0.5), DW[3], 'drift'); }
    grid((x, y, c) => b.set(x, y, c, 'drift'), 9, 5, ['.dd.', 'dDDd', '.dd.'], { d: DW[2], D: DW[1] });
    grid((x, y, c) => b.set(x, y, c, 'shell'), 15, 1, ['.pPp.', 'ppppp', '.ddd.'], { p: '#ffb8c8', P: '#ffe4ea', d: '#d07a90' });
  }, { outline: sel });
}

/** A tiki torch, 10 x 34: a bamboo pole, a woven cup, a flame, a little carved face. */
export function tikiB(px, X, Y) {
  groundShadow(px, X + 5, Y + 33, 3.5, 1.2, 0.22);
  propB(px, X, Y, 10, 34, (b) => {
    for (let y = 12; y < 34; y += 1) { const n = (y + 1) % 7 === 0; b.set(4, y, n ? BB[1] : BB[4], 'bamboo'); b.set(5, y, n ? BB[1] : BB[3], 'bamboo'); b.set(6, y, BB[2], 'bamboo'); }
    grid((x, y, c) => b.set(x, y, c, 'thatch'), 2, 7, ['ttTTtt.', 'tTttTtt', '.tddtt.', '.tttt..', '..tt...'], { t: TH[3], T: TH[4], d: TH[1] });
    grid((x, y, c) => b.set(x, y, c, 'drift'), 3, 13, ['.ddd.', 'dkdkd', 'ddddd', 'dkkkd', '.ddd.'], { d: DW[3], k: DW[0] });
  }, { outline: sel, after: (b) => grid((x, y, c) => b.set(x, y, c), 3, 0, ['..y.', '.yY.', 'yYWo', 'oYYo', '.oo.', '.r..'], { y: '#ffd23f', Y: '#ffe890', W: '#fffbe0', o: '#ff8a3a', r: '#e85a2a' }) });
}

/** A little pile of coconuts, 12 x 6. */
export function coconutsB(px, X, Y) {
  px(X + 1, Y + 5, 'rgba(110,60,70,0.22)', 11, 1);
  [[0, 2], [4, 2], [2, 0], [7, 3]].forEach(([x, y]) => grid(px, X + x, Y + y, ['.cc.', 'cCcd', '.dd.'], { c: '#7a5a3a', C: '#b8905a', d: '#4a3430' }));
  grid(px, X + 8, Y, ['ww', 'Wk'], { w: '#fff6ea', W: '#ffffff', k: '#7a5a3a' }); // one cracked open
}

// ---------- the green on the sand ----------

const oval = (Z, x, y) => { const dx = (x + 0.5 - (Z.x + Z.w / 2)) / (Z.w / 2); const dy = (y + 0.5 - (Z.y + Z.h / 2)) / (Z.h / 2); return 1 - (dx * dx + dy * dy); };
const grow = (Z, g) => ({ x: Z.x - g, y: Z.y - g, w: Z.w + g * 2, h: Z.h + g * 2 });

/** The fishing pool on the green: a rock pool with a rim of stones, turquoise water, a starfish. */
function poolB(px, Z, seed) {
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 6; y < Z.y + Z.h + 6; y += 1) for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
    const k = oval(Z, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
    if (k < 0) {
      if (oval(grow(Z, 1.5), x, y) >= 0) px(x, y, north ? WT[0] : WT[2]);
      else if (oval(grow(Z, 5), x, y) >= 0 && b < oval(grow(Z, 5), x, y) * 2.4) px(x, y, WT[3]);
      continue;
    }
    let c = AQ[3];
    if (north && oval(grow(Z, -3), x, y) < 0) c = oval(grow(Z, -1.5), x, y) < 0 ? AQ[1] : AQ[2];
    else if (!north && oval(grow(Z, -2.5), x, y) < 0) c = b < 0.5 ? AQ[6] : AQ[5];
    else if (k > 0.55 || (k > 0.42 && b < (k - 0.42) * 7)) c = AQ[2];
    else if (!north && oval(grow(Z, -6), x, y) < 0) c = AQ[4];
    px(x, y, c);
  }
  const rnd = rng(seed);
  for (let i = 0; i < 9; i += 1) { const x = Z.x + 12 + Math.floor(rnd() * (Z.w - 30)); const y = Z.y + 8 + Math.floor(rnd() * (Z.h - 16)); if (oval(grow(Z, -6), x, y) > 0) { px(x, y, '#ffffff'); px(x + 1, y, AQ[6], 2, 1); } }
  [[0.05, 0.6], [0.14, 0.88], [0.48, 1.04], [0.88, 0.2], [0.96, 0.62], [0.74, 1], [0.3, -0.04], [0.62, -0.02]].forEach(([fx, fy], i) => stoneB(px, Math.round(Z.x + fx * Z.w), Math.round(Z.y + fy * Z.h), 3.2 + (i % 3) * 0.7, 2.2 + (i % 2) * 0.5, i % 4 === 0, seed + i));
  grid(px, Math.round(Z.x + Z.w * 0.82), Math.round(Z.y + Z.h * 0.86), ['..o..', '.oOo.', 'oOOOo', '.o.o.'], { o: '#f07a5a', O: '#ffb08a' });
}

/** A rounded box test: inside a w x h box at (x0, y0) with corner radius r. */
const inRound = (x, y, x0, y0, w, h, r) => {
  const cx = Math.max(x0 + r, Math.min(x0 + w - r, x + 0.5)); const cy = Math.max(y0 + r, Math.min(y0 + h - r, y + 0.5));
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
};

/** A goal of driftwood and old fishing net, w x h, its mouth facing dir (1: right, -1: left). */
function netGoal(px, X, Y, w, h, dir, frame = DW) {
  groundShadow(px, X + w / 2 + 1, Y + h, w / 2 + 2, 1.6, 0.2);
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let i = 0; i < w; i += 1) {
      const x = dir > 0 ? i : w - 1 - i;
      const mouth = i >= w - 2; const back = i === 0;
      if (mouth) b.set(x, y, i === w - 2 ? frame[5] : frame[3], 'drift');
      else if (y === 0 || y === h - 1) b.set(x, y, y === 0 ? frame[5] : frame[2], 'drift');
      else if (back) b.set(x, y, frame[3], 'drift');
      else if ((i + y) % 3 === 0 || (i - y + 99) % 3 === 0) b.set(x, y, (i + y) % 3 === 0 ? 'rgba(255,246,226,0.85)' : 'rgba(236,214,180,0.75)', 'net');
    }
    // a float or two tied on the net
    b.set(dir > 0 ? 2 : w - 3, 3, '#ff8a5a', 'net'); b.set(dir > 0 ? 3 : w - 4, h - 4, '#ffd23f', 'net');
  }, { outline: (t, side) => (t === 'net' ? null : sel(t, side)) });
}

/** A little flag on a stick, stuck in the sand at a court's corner. */
function cornerFlag(px, x, y, c) {
  px(x + 1, y + 1, 'rgba(42,24,56,0.2)', 3, 1);
  for (let k = 0; k < 8; k += 1) px(x, y - k, k === 0 ? DW[1] : DW[4]);
  grid(px, x + 1, y - 8, ['cC', 'cc', 'c.'], { c, C: mix(c, '#ffffff', 0.45) });
}

/**
 * A game court on the sand: smooth raked sand, its lines drawn in the sand with a stick, shells along
 * the edge, flags at the corners, and goals of driftwood and fishing net (or tall yellow posts for football).
 */
function courtB(px, Z, kind, seed) {
  if (kind === 'hockey') { rinkB(px, Z, seed); return; }
  const P = { x: Z.x - 4, y: Z.y - 3, w: Z.w + 8, h: Z.h + 6 };
  for (let y = P.y - 2; y < P.y + P.h + 2; y += 1) for (let x = P.x - 2; x < P.x + P.w + 2; x += 1) {
    const inside = inRound(x, y, P.x, P.y, P.w, P.h, 12);
    const rim = !inside && inRound(x, y, P.x - 2, P.y - 2, P.w + 4, P.h + 4, 14);
    if (rim) { if (bayer(x, y) < 0.5) px(x, y, SD[4]); continue; }
    if (!inside) continue;
    const row = (y - P.y) % 3;
    let c = row === 0 ? CS[4] : row === 1 ? SD[4] : SD[5];
    if (row === 0 && h2(x >> 3, y, seed) < 0.18) c = SD[4];
    px(x, y, c);
  }
  // the lines, scratched into the sand: a groove, lit on its lower lip
  const groove = (x, y) => { px(x, y, CS[2]); px(x, y + 1, '#fff2d6'); };
  const L0 = { x: Z.x + 2, y: Z.y + 1, w: Z.w - 4, h: Z.h - 3 };
  for (let x = L0.x + 2; x < L0.x + L0.w - 2; x += 1) { if ((x + seed) % 9 === 4) continue; groove(x, L0.y); groove(x, L0.y + L0.h); }
  for (let y = L0.y + 1; y < L0.y + L0.h; y += 1) { if ((y + seed) % 7 === 3) continue; px(L0.x, y, CS[2]); px(L0.x + 1, y, '#fff2d6'); px(L0.x + L0.w - 1, y, CS[2]); px(L0.x + L0.w, y, '#fff2d6'); }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = L0.y + 2; y < L0.y + L0.h - 1; y += 2) { px(mx, y, CS[2]); px(mx + 1, y, '#fff2d6'); }
  for (let a = 0; a < 40; a += 1) { const t = (a / 40) * Math.PI * 2; const x = Math.round(mx + Math.cos(t) * 7); const y = Math.round(mid + Math.sin(t) * 5); px(x, y, CS[2]); if (Math.sin(t) > 0.2) px(x, y + 1, '#fff2d6'); }
  // shells along the long sides
  const rnd = rng(seed);
  for (let i = 0; i < 7; i += 1) {
    const x = Math.round(Z.x + 10 + rnd() * (Z.w - 20)); const top = i % 2 === 0;
    grid(px, x, top ? Z.y - 3 : Z.y + Z.h + 1, ['.pP', 'ppp', '.d.'], { p: ['#ffb8c8', '#fff6ea', '#ffd8a0'][i % 3], P: '#ffffff', d: ['#d07a90', '#c8b8a8', '#d8a060'][i % 3] });
  }
  cornerFlag(px, Z.x - 2, Z.y + 1, '#ff6b6b'); cornerFlag(px, Z.x + Z.w + 1, Z.y + 1, '#ffd23f');
  if (kind === 'football') {
    const Y4 = ['#b07a1a', '#e8a82a', '#ffd84a', '#fff0a0'];
    const post = (x) => propB(px, x - 6, mid - 20, 13, 24, (b) => {
      for (let y = 9; y < 24; y += 1) { b.set(6, y, Y4[2], 'gold'); b.set(7, y, Y4[1], 'gold'); }
      for (let xx = 0; xx < 13; xx += 1) { b.set(xx, 8, Y4[3], 'gold'); b.set(xx, 9, Y4[1], 'gold'); }
      for (const ux of [0, 11]) for (let y = 0; y < 9; y += 1) { b.set(ux, y, Y4[2], 'gold'); b.set(ux + 1, y, Y4[1], 'gold'); }
      grid((xx, yy, c) => b.set(xx, yy, c, 'flag'), 0, -4, ['rr', 'rR', 'r.', 'r.'], { r: '#e8384a', R: '#ff8a8a' });
    }, { outline: (t, side) => (t === 'flag' ? null : side === 'bottom' ? INK : '#9a6a2a') });
    groundShadow(px, Z.x + 7, mid + 4, 4, 1.2, 0.22); groundShadow(px, Z.x + Z.w - 4, mid + 4, 4, 1.2, 0.22);
    post(Z.x + 5); post(Z.x + Z.w - 6);
    return;
  }
  netGoal(px, Z.x - 1, mid - 8, 9, 16, 1); netGoal(px, Z.x + Z.w - 8, mid - 8, 9, 16, -1);
}

/** The hockey court on a beach: a little rink of smooth, varnished deck planks with white boards round it. */
function rinkB(px, Z, seed) {
  const R = { x: Z.x - 3, y: Z.y - 2, w: Z.w + 6, h: Z.h + 5 };
  groundShadow(px, R.x + R.w / 2 + 2, R.y + R.h + 1, R.w / 2, 3, 0.2);
  const PL = ['#b07a4a', '#c8905a', '#d8a46a', '#e8bc80', '#f6d8a4'];
  for (let y = R.y; y < R.y + R.h; y += 1) for (let x = R.x; x < R.x + R.w; x += 1) {
    if (!inRound(x, y, R.x, R.y, R.w, R.h, 10)) continue;
    const edge = !inRound(x, y, R.x + 2, R.y + 2, R.w - 4, R.h - 4, 8);
    const inner = !inRound(x, y, R.x + 3, R.y + 3, R.w - 6, R.h - 6, 7);
    if (edge) { const south = y > R.y + R.h / 2; px(x, y, south ? (y === R.y + R.h - 1 ? '#9a8aa8' : '#d8d0e4') : '#ffffff'); continue; }
    if (inner) { px(x, y, y < R.y + R.h / 2 ? '#8a6a5a' : '#e04050'); continue; } // the boards' shadow, the red kick strip
    const row = Math.floor((y - R.y) / 4); const off = (row * 11 + (seed % 7)) % 24;
    const seam = (x - R.x + off) % 24 === 0; const gap = (y - R.y) % 4 === 3;
    let c = gap ? PL[0] : (y - R.y) % 4 === 0 ? PL[4] : h2(Math.floor((x - R.x + off) / 24), row, seed) < 0.4 ? PL[2] : PL[3];
    if (seam && !gap) c = PL[1];
    // a soft varnish sheen across the deck
    if (!gap && Math.abs((x - R.x) - (y - R.y) * 1.6 - R.w * 0.3) < 3 && bayer(x, y) < 0.6) c = PL[4];
    px(x, y, c);
  }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = R.y + 4; y < R.y + R.h - 3; y += 1) { px(mx - 1, y, '#e8384a'); px(mx, y, '#ff5a6a'); }
  for (const lx of [Math.round(Z.x + Z.w * 0.3), Math.round(Z.x + Z.w * 0.7)]) for (let y = R.y + 4; y < R.y + R.h - 3; y += 1) px(lx, y, '#4a8ae8');
  for (let a = 0; a < 44; a += 1) { const t = (a / 44) * Math.PI * 2; px(Math.round(mx + Math.cos(t) * 8), Math.round(mid + Math.sin(t) * 6), '#4a8ae8'); }
  px(mx - 1, mid, '#3a6ac8', 2, 1);
  const goal = (x, dir) => propB(px, x, mid - 6, 6, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let i = 0; i < 6; i += 1) {
      const xx = dir > 0 ? i : 5 - i;
      if (i >= 4) b.set(xx, y, i === 4 ? '#ff8a8a' : '#d8384a', 'white');
      else if (y === 0 || y === 11) b.set(xx, y, y === 0 ? '#ff8a8a' : '#d8384a', 'white');
      else if (i === 0) b.set(xx, y, '#d8384a', 'white');
      else if ((i + y) % 2 === 0) b.set(xx, y, 'rgba(255,255,255,0.75)', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : side === 'bottom' ? INK : '#a82040') });
  goal(Z.x + 2, 1); goal(Z.x + Z.w - 8, -1);
}

// ---------- little things on the open sand ----------

/** Shells, starfish, pebbles and crab holes scattered where nothing else is. */
function scatterB(px, L, areas, seed) {
  const busy = (x, y) => L.blocked(x, y, 7) || L.onPath(x, y, 10) || L.inWater(x, y, 5) || areas.some((a) => x > a.x - 12 && x < a.x + a.w + 12 && y > a.y - 12 && y < a.y + a.h + 12);
  const rnd = rng(seed);
  const SHELLS = [['#ffb8c8', '#ffe4ea', '#d07a90'], ['#fff6ea', '#ffffff', '#c8b8a8'], ['#ffd8a0', '#fff0d0', '#d8a060'], ['#e0c8f0', '#f8f0ff', '#a890c0']];
  for (let i = 0; i < (L.W * L.H) / 700; i += 1) {
    const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const k = rnd(); const v = Math.floor(rnd() * 4);
    if (Math.min(x, L.W - x) < 24 || y < 28 || busy(x, y)) continue;
    const [m, l, d] = SHELLS[v];
    if (k < 0.4) grid(px, x, y, v % 2 ? ['.lm', 'mmm', '.d.'] : ['lm.', 'mmd'], { m, l, d });
    else if (k < 0.52) grid(px, x, y, ['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: v % 2 ? '#f07a5a' : '#e8608a', O: v % 2 ? '#ffc09a' : '#ffb0c8' });
    else if (k < 0.75) { px(x, y, SB.sand[2]); px(x + 1, y, SB.sand[3]); px(x, y - 1, SB.sand[5]); if (v > 1) { px(x + 3, y + 1, '#b0a4bc'); px(x + 3, y, '#dcd6e2'); } }
    else { px(x, y, '#8a6a6a', 2, 1); px(x, y - 1, SB.sand[5], 2, 1); px(x - 1, y, SB.sand[2]); px(x + 2, y, SB.sand[5]); } // a crab's hole
  }
}

// ---------- the whole village ----------

/**
 * Paints the sunset map's village in style B. opts: { homeRoof: the kid's color, areas: the
 * green's ponds and play patches }. lib: { waterDepth, PROPS } from villageprops.js
 * (passed in so the two files don't import each other).
 */
export function paintSunset(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 2201;
  const PROPS = lib.PROPS || {};
  const depth = lib.waterDepth;

  sandB(px, L, seed);
  const lagoon = L.water.find((wa) => wa.kind !== 'sea'); const sea = L.water.find((wa) => wa.kind === 'sea');
  if (lagoon) lagoonB(px, L, lagoon, depth, seed + 60, (x, y) => (sea ? depth(sea, x, y) > 0 : false));
  if (sea) seaB(px, L, sea, depth, seed + 61, (x, y) => (lagoon ? depth(lagoon, x, y) : -1));
  boardwalkB(px, L.paths, seed + 2);
  L.plazas.forEach(([x, y, r], i) => deckB(px, x, y, r, seed + 40 + i));
  (opts.areas || []).forEach((a, i) => (a.kind === 'pond' ? poolB(px, a, seed + 70 + i) : courtB(px, a, a.kind, seed + 70 + i)));
  L.crossings.forEach((c) => bridgeH(px, c));
  scatterB(px, L, opts.areas || [], seed + 90);

  const DRAW = {
    palm: (p) => palmB(px, p),
    stall: (p) => stallB(px, p.x, p.y, p.pal),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
    umbrella: (p) => umbrellaB(px, p.x, p.y, p.c),
    sandcastle: (p) => sandcastleB(px, p.x, p.y),
    surfboard: (p) => surfboardB(px, p.x, p.y, p.c),
    rock: (p) => rockB(px, p.x, p.y, p.w || 22, p.h || 16),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p));
  L.props.filter((p) => PROPS[p.kind]?.flat).forEach(draw);
  const home = L.home;
  const looks = [{ shutter: '#3ac0b0', buoy: true, seed: 31 }, { shutter: '#f08c3a', seed: 47 }];
  const things = [
    { y: home.y + home.h, draw: () => hutB(px, home.x, home.y, home.w, home.h, { home: true, door: opts.homeRoof || '#e03131', shutter: opts.homeRoof || '#e03131', seed: 11 }) },
    ...L.houses.map((hs, i) => ({ y: hs.y + hs.h, draw: () => hutB(px, hs.x, hs.y, hs.w, hs.h, { door: hs.sign ? '#7a5ae0' : '#2f9e8e', sign: hs.sign, ...looks[i % looks.length] }) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
