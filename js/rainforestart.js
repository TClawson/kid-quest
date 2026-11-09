// The Rainforest in style B, "soft storybook": a deep green jungle floor dappled with sunflecks
// and fallen leaves, soft shafts of light slanting down through the canopy, a dense wall of
// jungle round the edge with big leaves and vines hanging over, warm earth paths, a jade river
// that pours over a mossy cliff (mist round its foot) and winds down the village under a rope
// bridge, stilt huts with palm-thatch roofs (the kid's roof in their own color, with bunting and
// a pennant), and the green as a rainforest has it: a lily-pad pond, a mossy rink, a muddy
// clearing. Jungle whimsy: a poison-dart frog on a leaf, a giant bromeliad, orchids on a stump,
// a glowing mushroom log, leafcutter ants, a carved mask and a blue morpho butterfly.
//
// One canvas pixel per village pixel, painted into one ImageData and shown with a single
// putImageData. villageprops.js calls paintRainforest() for 'bg-rainforest' only.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, stones, pathField, pixelBuffer } from './pixelkit.js';
import { PB, propB, groundShadow, laundryB } from './meadowart.js';
import { sel, tg } from './castleart.js';

export const RB = {
  floor: ['#0c2622', '#12342a', '#194430', '#205636', '#2a683c', '#387c42', '#4c9248', '#68aa50'], // base 3
  litter: ['#2e1e20', '#4a2c26', '#6a3e2c', '#8a5432', '#a86c3a', '#c48a48'],
  jungle: ['#0b2226', '#10342e', '#174634', '#1f5c3a', '#2c7442', '#408e48', '#5ea852', '#8cc464'],
  teal: ['#0a2430', '#0e3638', '#144a40', '#1a6048', '#257852', '#3a945e', '#62b072', '#9ad08c'],
  lime: ['#1a2e22', '#243f26', '#32562a', '#45702e', '#5c8c34', '#7aa83e', '#a0c650', '#cce070'],
  earth: ['#38201f', '#553227', '#76482e', '#966236', '#b07c42', '#c89652', '#ddb26c', '#eccd92'],
  water: ['#0a2638', '#0c3a4a', '#105058', '#156a66', '#1f8672', '#38a482', '#6cc49c', '#b8e8cc'],
  rock: ['#1c2028', '#2a3038', '#3a4248', '#4e585c', '#667272', '#808c88', '#a0aaa2', '#c4ccc0'],
  bark: ['#24181e', '#3a2626', '#52382e', '#6c4c38', '#866244', '#a07c54', '#bc9a6c'],
  mud: ['#2e1c1a', '#462a22', '#60392a', '#7a4c34', '#946240', '#ae7c52', '#c89a6c'],
  bamboo: ['#4a3a1c', '#6e5826', '#967e32', '#bca448', '#d8c46a', '#efe2a0'],
  moss: ['#1e3a24', '#2a5028', '#3c6a2c', '#548632', '#70a23a', '#94bc4a', '#bcd866'],
  mist: ['#bcd4d0', '#d8e8e4', '#eef6f2', '#ffffff'],
  glow: ['#1e6a6a', '#2ea8a0', '#5ad8c4', '#a8f4e0', '#eafff6'],
  glass: ['#a8401e', '#e8742a', '#ffa83e', '#ffd878', '#fff4c8'],
};
const F = RB.floor; const LT = RB.litter; const J = RB.jungle; const E = RB.earth; const WA = RB.water; const R = RB.rock; const BK = RB.bark;
const MD = RB.mud; const BS = RB.bamboo; const MS = RB.moss; const MI = RB.mist; const GW = RB.glow; const GS = RB.glass;
const Wd = PB.wood; const INK = '#2e2238';
const CANOPY = [RB.jungle, RB.teal, RB.lime, RB.jungle];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i += 1) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), i / n); };
const FLOWERS = [['#c8203a', '#ff5a6a', '#ffd23f'], ['#d0408a', '#ff8ac0', '#fff4a8'], ['#e86a1a', '#ffa848', '#fff4a8'], ['#e8b020', '#ffe060', '#fffbe0'], ['#8a48c8', '#c08af0', '#fff4ff']];

// ---------- the jungle floor ----------

function groundR(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = (bayer(x, y) - 0.5) * 0.18;
      const n = vnoise(x, y, 26, seed) * 0.6 + vnoise(x, y, 8, seed + 1) * 0.4;
      let i = n < 0.26 + t ? 2 : n < 0.5 + t ? 3 : n < 0.72 + t ? 4 : 5;
      // deeper shade under the canopy round the edge
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e < 64 && (64 - e) / 64 > 0.45 + t * 2 + vnoise(x, y, 12, seed + 7) * 0.3) i -= 1;
      // sunflecks where the light gets through
      const sun = vnoise(x, y, 10, seed + 3) * 0.5 + vnoise(x, y, 34, seed + 4) * 0.5;
      if (sun > 0.69 + t * 0.6) i += 1;
      if (sun > 0.77 + t * 0.6) i += 1;
      let c = F[clamp(i, 1, 7)];
      // drifts of fallen leaves, warm brown
      const lt = vnoise(x, y, 15, seed + 2) * 0.7 + vnoise(x, y, 4, seed + 5) * 0.3;
      if (lt > 0.76 + t) c = lt > 0.8 + t ? mix(LT[2 + (sun > 0.7 ? 1 : 0)], c, 0.35) : mix(c, LT[2], 0.3);
      const hk = h2(x, y, seed + 6);
      if (hk > 0.988) c = F[6]; else if (hk < 0.01) c = F[1];
      px(x, y, c);
    }
  }
}

/** Little things on the floor: plant strokes, seedlings, flowers, fallen leaves, pebbles and toadstools. */
function scatterR(px, L, seed, busy, colors) {
  const { W, H } = L;
  const rnd = rng(seed);
  const STROKES = [['.L', 'D.'], ['L.', '.D'], ['L', 'D'], ['..L', '.D.', 'D..'], ['L.L', '.D.'], ['.L.', 'D.D']];
  for (let gy = 0; gy < H; gy += 5) {
    for (let gx = 0; gx < W; gx += 6) {
      const x = gx + Math.floor(rnd() * 6); const y = gy + Math.floor(rnd() * 5); const k = Math.floor(rnd() * STROKES.length); const r = rnd();
      if (busy(x, y) || r > 0.62) continue;
      grid(px, x, y, STROKES[k], { D: F[2], L: r < 0.25 ? F[6] : F[5] });
    }
  }
  // fallen leaves: little ovals with a midrib, in warm browns, ochre and the odd yellow
  const LEAVES = [['.aa.', 'abBa', '.bb.'], ['aa..', 'aBba', '..bb'], ['.aab', 'aBb.'], ['ab', 'aB', '.b']];
  const lc = [[LT[3], LT[2]], [LT[4], LT[3]], ['#c89a3a', '#a07a2e'], [LT[5], LT[3]], ['#7aa83e', '#5c8c34']];
  for (let i = 0; i < (W * H) / 260; i += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H); const [a, b] = lc[Math.floor(rnd() * lc.length)];
    if (busy(x, y) || busy(x + 3, y + 2)) continue;
    grid(px, x, y, LEAVES[Math.floor(rnd() * LEAVES.length)], { a, b, B: mix(a, '#fff0c0', 0.35) });
  }
  // flowers in little clumps
  for (let i = 0; i < (W * H) / 2300; i += 1) {
    const cx = rnd() * W; const cy = rnd() * H; const col = colors[Math.floor(rnd() * colors.length)];
    const P = ramp(col, 2, 2);
    const n = 2 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j += 1) {
      const x = Math.round(cx + (rnd() - 0.5) * 12); const y = Math.round(cy + (rnd() - 0.5) * 7);
      if (busy(x, y) || busy(x, y + 2)) continue;
      px(x, y + 1, F[2]); px(x - 1, y, P[2]); px(x + 1, y, P[1]); px(x, y - 1, P[3]); px(x, y + 1, P[1]); px(x, y, '#ffe680');
    }
  }
  // seedlings, pebbles and toadstools
  for (let i = 0; i < (W * H) / 1500; i += 1) {
    const x = Math.round(rnd() * W); const y = Math.round(rnd() * H); const r = rnd();
    if (busy(x, y) || busy(x, y + 3)) continue;
    if (r < 0.45) grid(px, x - 2, y - 3, ['l...l', '.l.l.', 'dlLld', '..d..'], { l: F[5], L: F[6], d: F[2] });
    else if (r < 0.75) { px(x, y, R[4]); px(x + 1, y, R[3]); px(x, y - 1, R[6]); px(x + 1, y + 1, 'rgba(10,20,20,0.35)'); }
    else { grid(px, x - 1, y - 2, ['rRr', 'rrr', '.w.'], { r: '#e0503a', R: '#ffd2c0', w: '#f0e6d0' }); px(x + 1, y + 1, 'rgba(10,20,20,0.3)'); }
  }
}

/** Soft shafts of sunlight slanting down through the canopy, falling to the right. */
function shaftsR(px, L, seed) {
  const { W, H } = L;
  const beams = [[40, 22], [150, 16], [262, 26], [372, 18], [470, 22]];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const s = x - y * 0.42;
      for (const [s0, wd] of beams) {
        const d = Math.abs(s - s0) / (wd / 2);
        if (d >= 1) continue;
        // brighter in streaks down the beam, dithered at its soft edges
        const k = (1 - d) * (0.55 + vnoise(s, y * 0.15, 6, seed) * 0.6);
        if (k > 0.55) px(x, y, 'rgba(255,244,176,0.13)');
        else if (bayer(x, y) < k * 1.4) px(x, y, 'rgba(255,244,176,0.09)');
      }
    }
  }
}

// ---------- the dense jungle round the edge ----------

/** A wall of jungle round the village: round leafy clumps (the front ones over the back ones), flowers, and its shadow on the floor. */
function jungleR(px, L, seed, skip) {
  const { W, H } = L; const C = 12;
  const cells = new Map();
  const cell = (i, j) => {
    const k = (i + 10) * 1000 + j + 10;
    if (cells.has(k)) return cells.get(k);
    const cx = i * C + 6 + (h2(i, j, seed) - 0.5) * 7; const cy = j * C + 6 + (h2(j, i, seed + 1) - 0.5) * 7;
    const e = Math.min(cx, cy, W - cx, H - cy);
    let v = null;
    if (e < 18 + h2(i, j, seed + 3) * 13 && !skip(cx, cy)) v = { cx, cy, r: 8 + h2(i, j, seed + 2) * 5.5, P: CANOPY[Math.floor(h2(i, j, seed + 4) * 3.6) % 4], deep: e < 8 };
    cells.set(k, v);
    return v;
  };
  const mask = new Uint8Array(W * H);
  const top = new Map();
  for (let y = 0; y < H; y += 1) {
    const band = y < 52 || y > H - 52;
    for (let x = 0; x < W; x += 1) {
      if (!band && x === 52) x = W - 52;
      const ci = Math.floor(x / C); const cj = Math.floor(y / C);
      let best = null; let bd = 0;
      for (let dj = -1; dj <= 1; dj += 1) {
        for (let di = -1; di <= 1; di += 1) {
          const c = cell(ci + di, cj + dj);
          if (!c) continue;
          const d = Math.hypot(x + 0.5 - c.cx, (y + 0.5 - c.cy) * 1.08);
          if (d > c.r) continue;
          if (!best || c.cy > best.cy || (c.cy === best.cy && c.cx > best.cx)) { best = c; bd = d; }
        }
      }
      if (!best) continue;
      mask[y * W + x] = 1;
      top.set(y * W + x, best);
      const dx = (x + 0.5 - best.cx) / best.r; const dy = (y + 0.5 - best.cy) / best.r;
      const l = -(dx * 0.6 + dy * 0.8);
      let i = l > 0.5 ? 6 : l > 0.18 ? 5 : l > -0.18 ? 4 : l > -0.5 ? 3 : 2;
      const hk = h2(x, y, seed + 7);
      if ((x + y * 2) % 5 === 0 && hk > 0.4) i += l > -0.3 ? 1 : -1;
      else if (hk > 0.93) i += 1;
      if (best.deep) i -= 1;
      if (bd > best.r - 1.2) i = l > 0.35 ? 4 : 1;
      px(x, y, best.P[clamp(i, 1, 7)]);
    }
  }
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (Math.min(x, y, W - x, H - y) > 56 || on(x, y)) continue;
      if (on(x - 1, y - 2) || on(x - 2, y - 4)) px(x, y, on(x, y - 1) ? 'rgba(8,16,20,0.48)' : 'rgba(8,16,20,0.32)');
    }
  }
  // flowers in the canopy: hibiscus, heliconia and orchids, on the lit side of a clump
  const rnd = rng(seed + 9);
  for (let n = 0; n < 300; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H); const c = FLOWERS[Math.floor(rnd() * FLOWERS.length)];
    const t = top.get(y * W + x);
    if (!t || !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) continue;
    if ((x + 0.5 - t.cx) + (y + 0.5 - t.cy) > 2) continue;
    px(x - 1, y, c[0]); px(x + 1, y, c[0]); px(x, y - 1, c[1]); px(x, y + 1, c[0]); px(x, y, c[2]); px(x + 1, y + 1, t.P[1]);
  }
  return { mask, on };
}

/** A big leaf on a Buf: kind 'banana', 'monstera' or 'frond', from its stem at (ax, ay) pointing at angle a, length len. */
function bigLeaf(b, kind, ax, ay, a, len, P, seed) {
  const ca = Math.cos(a); const sa = Math.sin(a);
  const R2 = len + 4;
  for (let y = Math.floor(ay - R2); y <= ay + R2; y += 1) {
    for (let x = Math.floor(ax - R2); x <= ax + R2; x += 1) {
      const u = (x + 0.5 - ax) * ca + (y + 0.5 - ay) * sa; const v = -(x + 0.5 - ax) * sa + (y + 0.5 - ay) * ca;
      if (u < 0 || u > len) continue;
      const t = u / len; let c = null;
      if (kind === 'banana') {
        const hw = len * 0.2 * Math.sin(Math.PI * Math.min(1, t * 1.08)) ** 0.7;
        if (Math.abs(v) > hw) continue;
        // torn into slits here and there
        const sk = Math.floor(u / 3);
        if (Math.abs(v) > hw * 0.28 && h2(sk, v < 0 ? 1 : 2, seed) > 0.72 && (u % 3) < 0.9) continue;
        let i = v < 0 ? 5 : 3;
        if (Math.abs(v) < 0.75) i = 6;
        else if (((u + Math.abs(v) * 0.9) % 3.2) < 0.9) i -= 1;
        if (Math.abs(v) > hw - 1) i -= 1;
        c = P[clamp(i, 1, 7)];
      } else if (kind === 'monstera') {
        const rr = len * 0.5; const cx = len * 0.52;
        const dx = u - cx; const d = Math.hypot(dx, v);
        const th = Math.atan2(v, dx);
        if (d > rr * (1 - 0.18 * Math.max(0, -Math.cos(th)) ** 3)) { if (u < cx - rr * 0.6 && Math.abs(v) < 0.8) c = P[4]; else continue; }
        // the slits from the edge in, and holes along the midrib
        if (!c) {
          const sl = ((th / (Math.PI / 4.5)) % 1 + 1) % 1;
          if (d > rr * 0.5 && Math.abs(sl - 0.5) < 0.09) continue;
          if (Math.abs(Math.abs(v) - rr * 0.32) < 1.2 && ((dx + rr) % (rr * 0.5)) < 1.4 && d < rr * 0.8) continue;
          let i = v < 0 ? 5 : 3;
          if (Math.abs(v) < 0.7 && dx > -rr) i = 6;
          else if (d > rr - 1.2) i -= 1;
          c = P[clamp(i, 1, 7)];
        }
      } else {
        // a palm frond: a curving stem with narrow leaflets either side
        const bend = t * t * len * 0.12; const vv = v - bend;
        if (Math.abs(vv) < 0.7) c = P[4];
        else {
          const hw = len * 0.24 * Math.sin(Math.PI * Math.min(1, t * 1.05));
          if (Math.abs(vv) > hw) continue;
          const lf = ((u - Math.abs(vv) * 0.9) % 3 + 3) % 3;
          if (lf > 1.4) continue;
          c = P[clamp((vv < 0 ? 5 : 3) - (lf > 0.9 ? 1 : 0), 1, 7)];
        }
      }
      if (c) b.set(x, y, c, tg('leaf', P[3]));
    }
  }
}

/** Big leaves and vines hanging over the floor from the jungle round the edge, where nothing important is. */
function overhangR(px, L, seed, clear) {
  const { W, H } = L;
  const rnd = rng(seed);
  const spots = [];
  for (let x = 30; x < W - 30; x += 22 + Math.floor(rnd() * 12)) { spots.push([x, 34 + rnd() * 6, Math.PI / 2 + (rnd() - 0.5) * 1.1]); spots.push([x, H - 36 - rnd() * 6, -Math.PI / 2 + (rnd() - 0.5) * 1.1]); }
  for (let y = 50; y < H - 50; y += 22 + Math.floor(rnd() * 12)) { spots.push([34 + rnd() * 6, y, (rnd() - 0.5) * 1.2]); spots.push([W - 35 - rnd() * 6, y, Math.PI + (rnd() - 0.5) * 1.2]); }
  const kinds = ['banana', 'monstera', 'frond', 'banana', 'frond'];
  spots.forEach(([ax, ay, a0], k) => {
    const kind = kinds[(k + Math.floor(rnd() * 3)) % kinds.length];
    const len0 = kind === 'monstera' ? 20 + rnd() * 6 : 26 + rnd() * 10;
    // inward if there's room, else turned along the edge, or shorter
    let a = null; let len = 0;
    for (const [da, kl] of [[0, 1], [0.6, 1], [-0.6, 1], [0, 0.72], [0.9, 0.8], [-0.9, 0.8]]) {
      const aa = a0 + da; const ll = len0 * kl;
      const ok = [1, 0.55].every((q) => clear(ax + Math.cos(aa) * ll * q, ay + Math.sin(aa) * ll * q, 5));
      if (ok) { a = aa; len = ll; break; }
    }
    if (a === null) return;
    const P = [RB.lime, RB.teal, RB.jungle][k % 3].map((c, i, arr) => arr[Math.min(arr.length - 1, i + 1)]);
    // its shadow on the floor below it, then the leaf
    const R2 = Math.ceil(len) + 6; const X = Math.round(ax) - R2; const Y = Math.round(ay) - R2;
    const b = new Buf(R2 * 2, R2 * 2, 1);
    bigLeaf(b, kind, R2, R2, a, len, P, seed + k);
    b.outline(sel);
    b.each((x, y) => { if (b.get(x, y)) px(X + x + 3, Y + y + 4, 'rgba(8,16,20,0.24)'); });
    b.blit(px, X, Y);
  });
  // vines hanging from the canopy: a strand with little leaves, the odd flower
  for (let n = 0; n < 46; n += 1) {
    const side = n % 4; let x; let y;
    if (side === 0) { x = 30 + rnd() * (W - 60); y = 30 + rnd() * 6; } else if (side === 1) { x = 28 + rnd() * 6; y = 44 + rnd() * (H - 100); } else if (side === 2) { x = W - 30 - rnd() * 6; y = 44 + rnd() * (H - 100); } else continue;
    const len = 14 + rnd() * 28; const ph = rnd() * 6;
    let ok = true;
    for (let k = 0; k <= len; k += 4) if (!clear(x + Math.sin(k / 6 + ph) * 2, y + k, 6)) ok = false;
    if (!ok) continue;
    for (let k = 0; k < len; k += 1) {
      const vx = Math.round(x + Math.sin(k / 6 + ph) * 2); const vy = Math.round(y + k);
      px(vx, vy, k % 5 === 2 ? MS[5] : MS[3]); px(vx + 1, vy, 'rgba(8,16,20,0.3)');
      if (k % 4 === 1 && k > 2) { const s = (k >> 2) % 2 ? 1 : -2; px(vx + s, vy, J[5]); px(vx + s + (s > 0 ? 1 : 0), vy + 1, J[4]); px(vx + (s > 0 ? s : s + 1), vy - 1, J[6]); }
    }
    if (rnd() < 0.4) { const c = FLOWERS[n % FLOWERS.length]; const vx = Math.round(x + Math.sin(len / 6 + ph) * 2); const vy = Math.round(y + len); px(vx, vy, c[1]); px(vx - 1, vy + 1, c[0]); px(vx + 1, vy + 1, c[0]); px(vx, vy + 1, c[2]); px(vx, vy + 2, c[0]); }
  }
}

/** Low plants over the floor: elephant ears, fern rosettes, striped prayer plants and gingers, where nothing important is. */
function undergrowthR(px, L, seed, ok) {
  const rnd = rng(seed);
  const placed = [];
  for (let n = 0; n < 900 && placed.length < 46; n += 1) {
    const x = 30 + Math.floor(rnd() * (L.W - 60)); const y = 40 + Math.floor(rnd() * (L.H - 80));
    if (!ok(x, y, 8) || !ok(x - 6, y - 8, 4) || !ok(x + 6, y - 8, 4) || placed.some(([qx, qy]) => Math.hypot(qx - x, qy - y) < 22)) continue;
    placed.push([x, y]);
    const kind = placed.length % 4; const P = [RB.jungle, RB.teal, RB.lime][placed.length % 3];
    groundShadow(px, x, y, 6, 1.6, 0.25);
    propB(px, x - 8, y - 12, 16, 13, (b) => {
      if (kind === 0) {
        // elephant ears: big heart-shaped leaves on stalks
        for (const [cx, cy, r, sd] of [[5, 5, 3.6, -1], [11, 4, 3.8, 1], [8, 8, 3.2, 0]]) {
          for (let yy = 0; yy < 13; yy += 1) for (let xx = 0; xx < 16; xx += 1) {
            const dx = xx + 0.5 - cx; const dy = yy + 0.5 - cy;
            if (dx * dx / (r * r) + dy * dy / (r * r * 0.7) > 1 || (dy < -r * 0.4 && Math.abs(dx) < 0.8)) continue;
            b.set(xx, yy, Math.abs(dx - dy * sd * 0.2) < 0.6 ? P[6] : dx + dy < 0 ? P[5] : P[4], tg('leaf', P[3]));
          }
          line(cx, cy + r * 0.6, 8, 12, (xx, yy) => b.set(xx, yy, P[3], tg('leaf', P[3])));
        }
      } else if (kind === 1) {
        // a fern rosette
        for (const [ang, len] of [[-2.8, 7], [-2.3, 7], [-1.9, 7], [-1.57, 7], [-1.25, 7], [-0.85, 7], [-0.35, 7]]) {
          for (let q = 0; q < len; q += 0.5) {
            const fx = 8 + Math.cos(ang) * q; const fy = 12 + Math.sin(ang) * q * 0.9 + (q / len) ** 2 * 3;
            b.set(Math.round(fx), Math.round(fy), q > len * 0.6 ? P[6] : P[4], tg('leaf', P[3]));
            if (Math.round(q * 2) % 3 === 0 && q > 1) b.set(Math.round(fx - Math.sin(ang)), Math.round(fy + Math.cos(ang)), P[5], tg('leaf', P[3]));
          }
        }
      } else if (kind === 2) {
        // a prayer plant: oval leaves striped light and dark
        for (const [cx, cy, a] of [[4, 6, -0.5], [12, 6, 0.5], [8, 4, 0], [6, 9, -0.2], [10, 9, 0.2]]) {
          for (let yy = 0; yy < 13; yy += 1) for (let xx = 0; xx < 16; xx += 1) {
            const dx = xx + 0.5 - cx; const dy = yy + 0.5 - cy;
            const u = dx * Math.cos(a) + dy * Math.sin(a); const v = -dx * Math.sin(a) + dy * Math.cos(a);
            if ((u * u) / 4 + (v * v) / 9 > 1) continue;
            b.set(xx, yy, Math.abs(u) < 0.6 ? mix('#e8b0c8', P[5], 0.55) : Math.round(v) % 2 ? P[5] : P[3], tg('leaf', P[3]));
          }
        }
      } else {
        // a ginger: tall leaves and a bright flower spike
        for (const [sx, h] of [[5, 9], [8, 11], [11, 8]]) line(sx, 12, sx + (sx - 8) * 0.4, 12 - h, (xx, yy, t) => { b.set(xx, yy, t > 0.5 ? P[5] : P[4], tg('leaf', P[3])); b.set(xx + 1, yy, P[3], tg('leaf', P[3])); });
        const c = FLOWERS[(x + y) % FLOWERS.length];
        grid((xx, yy, cc) => b.set(xx, yy, cc, tg('fl', c[0])), 7, 0, ['.a.', 'aba', 'bab', '.b.'], { a: c[1], b: c[0] });
      }
    }, { outline: sel, pad: 1 });
  }
}

// ---------- paths and plazas ----------

function pathsR(px, L, seed) {
  const { W, H } = L;
  const pf = pathField(L.paths, 12);
  const xs = L.paths.flat().map((p) => p[0]); const ys = L.paths.flat().map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - 12)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + 12));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - 12)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + 12));
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = pf(x, y);
      if (p.d > 11) continue;
      const edge = 7 + (vnoise(x, y, 5, seed) - 0.5) * 1.8;
      if (p.d > edge + 1) {
        // trampled moss at the path's edge, fading into the floor
        if (p.d < edge + 3 && bayer(x, y) < (edge + 3 - p.d) / 3) px(x, y, F[2]);
        continue;
      }
      if (p.d > edge) { px(x, y, E[1]); continue; }
      const t = (bayer(x, y) - 0.5) * 1.6;
      const lit = p.nx * 0.6 + p.ny * 0.8;
      let i = p.d > edge - 1.1 ? (lit < 0 ? 2 : 3) : p.d < 2.4 + t ? 5 : 4;
      const n = vnoise(x, y, 4, seed + 1);
      if (n > 0.74) i += 1; else if (n < 0.2) i -= 1;
      const hk = h2(x, y, seed + 2);
      let c = E[clamp(i, 1, 7)];
      if (hk > 0.97) c = E[7]; else if (hk < 0.03) c = E[2];
      px(x, y, c);
    }
  }
  // roots across the path and fallen leaves on it
  const rnd = rng(seed + 3);
  L.paths.forEach((pts) => {
    for (let i = 1; i < pts.length; i += 1) {
      const [ax, ay] = pts[i - 1]; const [bx, by] = pts[i]; const len = Math.hypot(bx - ax, by - ay);
      for (let s = 10; s < len - 10; s += 22 + rnd() * 26) {
        const cx = ax + ((bx - ax) * s) / len; const cy = ay + ((by - ay) * s) / len;
        const nx = -(by - ay) / len; const ny = (bx - ax) / len;
        if (rnd() < 0.4) {
          // a root reaching in from the edge, knobbly, lit on top
          const sd = rnd() < 0.5 ? -1 : 1; const reach = 3 + rnd() * 3; const bend = (rnd() - 0.5) * 4;
          line(cx + nx * sd * 8, cy + ny * sd * 8, cx + nx * sd * (7 - reach) + ny * bend, cy + ny * sd * (7 - reach) - nx * bend, (x, y) => { px(x, y - 1, BK[5]); px(x, y, BK[3]); px(x, y + 1, 'rgba(30,16,16,0.45)'); });
        } else {
          const c = [LT[4], '#c89a3a', LT[5]][Math.floor(rnd() * 3)];
          grid(px, Math.round(cx + (rnd() - 0.5) * 6), Math.round(cy + (rnd() - 0.5) * 6), ['.aa', 'abB', 'bb.'], { a: c, b: mix(c, LT[1], 0.4), B: mix(c, '#fff0c0', 0.4) });
        }
      }
    }
  });
}

/** A round platform of mossy flagstones with a carved leaf in the middle. */
function plazaR(px, cx, cy, r, seed) {
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y += 1) {
    for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x += 1) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
      if (d > r + 2) continue;
      if (d > r + 0.6) { px(x, y, d > r + 1.4 ? 'rgba(8,16,20,0.3)' : R[1]); continue; }
      const a = Math.atan2(dy, dx);
      // a ring of kerb stones
      if (d > r - 3.4) {
        const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * Math.round(r * 0.9));
        const joint = Math.abs(((((a + Math.PI) / (Math.PI * 2)) * Math.round(r * 0.9)) % 1) - 0.5) > 0.44;
        const lit = -(dx * 0.6 + dy * 0.8) / d;
        let c = joint ? R[2] : d > r - 1 ? (lit > 0 ? R[4] : R[2]) : lit > 0.3 ? R[6] : lit > -0.3 ? R[5] : R[4];
        if (!joint && h2(seg, 3, seed) > 0.6 && bayer(x, y) < 0.4) c = MS[4];
        px(x, y, c);
        continue;
      }
      // flagstones in rings, moss in the joints
      const ring = Math.floor(d / 5.2);
      const n = Math.max(3, Math.round(ring * 2.6 + 3));
      const f = (((a + Math.PI) / (Math.PI * 2)) * n + ring * 0.37) % 1;
      const jr = (d % 5.2) < 0.9; const ja = Math.abs(f - 0.5) > 0.45 && d > 4;
      let c;
      if (jr || ja) c = bayer(x, y) < 0.6 ? MS[3] : MS[2];
      else {
        const k = h2(Math.floor(((a + Math.PI) / (Math.PI * 2)) * n + ring * 0.37), ring, seed);
        const P = k < 0.5 ? [R[4], R[5], R[6]] : k < 0.8 ? ['#6e7466', '#8a9080', '#a8ae9a'] : ['#706660', '#8c827a', '#aa9e94'];
        c = (d % 5.2) < 1.8 ? P[2] : (d % 5.2) > 4.4 ? P[0] : P[1];
        if (h2(x, y, seed + 1) > 0.94) c = MS[4];
      }
      px(x, y, c);
    }
  }
  // the carved leaf in the middle
  grid(px, Math.round(cx) - 3, Math.round(cy) - 4, ['...l...', '..lLl..', '.lLmLl.', '.lLmLl.', '..lml..', '...m...', '...m...'], { l: R[3], L: R[6], m: R[2] });
}

// ---------- the river and the waterfall ----------

function riverR(px, L, wa, seed) {
  const { W, H } = L;
  const pf = pathField([wa.pts], wa.w);
  const xs = wa.pts.map((p) => p[0]); const ys = wa.pts.map((p) => p[1]);
  const pad = wa.w / 2 + 10;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + pad));
  const depth = (x, y) => { const wob = Math.sin(x / 13 + y / 17) * 1.5 + Math.sin(x / 5.3 - y / 7.1) * 0.7; return wa.w / 2 + wob - pf(x, y).d; };
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const d = depth(x, y);
      if (d < -8) continue;
      const p = pf(x, y);
      const lit = p.nx * 0.6 + p.ny * 0.8;
      if (d < 0) {
        // the muddy bank: dithered into the floor, wet and dark at the water
        const b = -d;
        if (b > 5) { if (bayer(x, y) < (8 - b) / 4) px(x, y, MD[2]); continue; }
        let c = b > 2.6 ? (h2(x, y, seed) > 0.8 ? MD[4] : MD[3]) : b > 1.1 ? MD[2] : MD[1];
        if (b > 2.6 && lit < -0.2 && b < 4) c = MD[4];
        px(x, y, c);
        continue;
      }
      const k = d / (wa.w / 2);
      const t = (bayer(x, y) - 0.5) * 0.24;
      let c;
      if (d < 1.4) c = lit < 0 ? WA[1] : WA[6];
      else if (d < 3.4) c = lit < 0 ? WA[2] : WA[5];
      else c = k < 0.42 + t ? WA[4] : k < 0.62 + t ? WA[3] : WA[2];
      // the current: light streaks drifting along
      const st = Math.floor(p.along / 9); const ln = Math.round(p.off / 2.2);
      if (d > 3 && h2(st, ln, seed + 1) > 0.84 && ((p.along % 9) + 9) % 9 < 4) c = d > 6 ? WA[5] : WA[6];
      if (d > 4 && h2(x, y, seed + 2) > 0.995) c = WA[7];
      px(x, y, c);
    }
  }
  return depth;
}

/** Reeds, rushes and lily pads along the river, away from the bridge and the falls. */
function riverEdgeR(px, L, depth, seed, clear) {
  const rnd = rng(seed);
  const { W, H } = L;
  for (let n = 0; n < 900; n += 1) {
    const x = Math.floor(rnd() * W); const y = 60 + Math.floor(rnd() * (H - 60));
    const d = depth(x, y);
    if (!clear(x, y)) continue;
    if (d > 2.5 && d < 6 && rnd() < 0.12) {
      // a lily pad, sometimes with a flower
      const r = 2.2 + rnd() * 1.4;
      for (let yy = -3; yy <= 3; yy += 1) for (let xx = -4; xx <= 4; xx += 1) {
        if (!inEll(x + xx, y + yy, x + 0.5, y + 0.5, r + 0.5, r * 0.75)) continue;
        if (xx > 0 && Math.abs(yy) < 1 && xx < r) continue; // the notch
        px(x + xx, y + yy, inEll(x + xx, y + yy, x + 0.5, y + 0.5, r - 0.6, r * 0.75 - 0.6) ? (xx + yy < 0 ? RB.lime[5] : RB.lime[4]) : RB.lime[3]);
      }
      if (rnd() < 0.35) { px(x, y - 1, '#ffc0d8'); px(x - 1, y, '#ff8ab4'); px(x + 1, y, '#ff8ab4'); px(x, y, '#ffe680'); }
    } else if (d < -2.5 && d > -5.5 && rnd() < 0.25) {
      // reeds and rushes on the bank
      const h = 4 + Math.floor(rnd() * 4);
      for (let k = 0; k < h; k += 1) { px(x, y - k, k > h - 2 ? MS[6] : MS[4]); if (k < h - 2) px(x + 2, y - k + 1, MS[3]); }
      if (rnd() < 0.5) { px(x + 2, y - h, BK[3]); px(x + 2, y - h + 1, BK[3]); px(x + 2, y - h - 1, BK[4]); }
      px(x + 1, y + 1, 'rgba(8,16,20,0.3)');
    }
  }
}

/** The mossy cliff at the top of the village with the river pouring over it, a plunge pool and mist (maplife.js animates the water). */
function fallsR(px, f, seed) {
  const [c0, c1] = f.cliff; const base = f.base; const cx = (f.x0 + f.x1) / 2;
  const spread = (y) => Math.round(clamp((y - f.lip) / (base - f.lip), 0, 1) * 2);
  const wl = (y) => f.x0 - 1 - spread(y); const wr = (y) => f.x1 + 1 + spread(y);
  // the pool at its foot
  for (let y = base - 4; y < base + 13; y += 1) for (let x = Math.floor(cx - 27); x < cx + 27; x += 1) {
    if (!inEll(x, y, cx + 0.5, base + 4, 25, 8.5)) continue;
    const dd = ((x + 0.5 - cx) / 25) ** 2 + ((y - base - 4) / 8.5) ** 2;
    let c = dd > 0.8 ? MD[1] : dd > 0.64 ? (y < base + 4 ? WA[1] : WA[5]) : dd > 0.3 ? WA[3] : WA[4];
    if (dd <= 0.64 && h2(x, y, seed + 9) > 0.96) c = WA[6];
    px(x, y, c);
  }
  // the rock: big rounded stones stacked either side of the water, moss on their tops
  const rnd = rng(seed);
  const seeds = [];
  for (let y = 3; y < base + 8; y += 9) for (let x = c0 - 14; x < c1 + 14; x += 11) seeds.push([x + (rnd() - 0.5) * 7 + (Math.floor(y / 9) % 2) * 5, y + (rnd() - 0.5) * 4]);
  const st = stones(seeds, 1, 1.3);
  const edgeL = (y) => c0 - Math.round(Math.sin(clamp(y / base, 0, 1) * Math.PI * 0.5) * 9) + Math.round((vnoise(3, y, 5, seed) - 0.5) * 5);
  const edgeR = (y) => c1 + Math.round(Math.sin(clamp(y / base, 0, 1) * Math.PI * 0.5) * 9) + Math.round((vnoise(9, y, 5, seed + 1) - 0.5) * 5);
  const foot = (x) => base - 1 - Math.round(vnoise(x, 0, 5, seed + 2) * 3) - Math.max(0, Math.round((Math.max(c0 - x, x - c1, -8) + 8) * 0.5));
  propB(px, 0, 0, 448, base + 6, (b) => {
    for (let y = 0; y < base + 2; y += 1) {
      for (let x = edgeL(y); x < edgeR(y); x += 1) {
        if (y > foot(x)) continue;
        if (y >= f.lip - 1 && x >= wl(y) && x <= wr(y)) continue;
        const s = st(x, y); const [sx, sy] = seeds[s.k];
        const dw = Math.min(Math.abs(x - wl(y)), Math.abs(x - wr(y)));
        let c; let tag = tg('stone', R[3]);
        if (s.gap < 1.1) c = h2(s.k, 1, seed) > 0.55 ? MS[2] : R[1];
        else {
          const dx = x + 0.5 - sx; const dy = (y + 0.5 - sy) * 1.3;
          const l = -(dx * 0.6 + dy * 0.8) / 6;
          let i = l > 0.55 ? 6 : l > 0.15 ? 5 : l > -0.25 ? 4 : l > -0.6 ? 3 : 2;
          const hk = h2(x, y, seed + 3);
          if (hk > 0.95) i += 1; else if (hk < 0.05) i -= 1;
          c = R[clamp(i, 1, 7)];
          if (dw < 4 && y > f.lip) c = mix(c, WA[2], 0.35);
          if (dy < -2.2 && vnoise(x, y, 4, seed + 4) > 0.34) { c = MS[clamp(l > 0.3 ? 5 : l > -0.2 ? 4 : 3, 1, 6)]; tag = tg('leaf', MS[3]); }
        }
        b.set(x, y, c, tag);
      }
    }
    // the water: bands of light and dark sliding down, spreading as it falls, foam at its edges
    for (let y = f.lip - 1; y <= base; y += 1) for (let x = wl(y); x <= wr(y); x += 1) {
      const u = (x - wl(y)) / (wr(y) - wl(y));
      let c = u < 0.1 || u > 0.9 ? WA[3] : u < 0.3 ? WA[5] : u < 0.72 ? WA[6] : WA[4];
      const sk = h2(x, Math.floor((y + x * 3) / 6), seed + 5);
      if (sk > 0.78) c = u > 0.15 && u < 0.85 ? MI[2] : WA[5];
      else if (sk < 0.12) c = WA[3];
      if ((x === wl(y) || x === wr(y)) && h2(x, y, seed + 6) > 0.45) c = MI[1];
      if (y < f.lip + 1) c = MI[3];
      else if (y < f.lip + 3) c = u < 0.2 || u > 0.8 ? WA[6] : WA[7];
      b.set(x, y, c, tg('water', WA[4]));
    }
    // the jungle over the top of the cliff, the water coming out from under it
    let k = 0;
    for (let x = c0 - 8; x < c1 + 10; x += 9) {
      if (Math.abs(x - cx) < 11) continue;
      clumpInto(b, x + (h2(k, 1, seed) - 0.5) * 3, 1 + h2(k, 2, seed) * 4, 6.5 + h2(k, 3, seed) * 3, CANOPY[k % 3], seed + 20 + k);
      k += 1;
    }
    clumpInto(b, f.x0 - 5, -2, 6, RB.teal, seed + 30); clumpInto(b, f.x1 + 6, -2, 6, RB.lime, seed + 31);
    // ferns and flowers growing out of the rock
    const fern = (x, y, dir) => { for (let q = 0; q < 7; q += 1) { b.set(x + dir * q, y - Math.round(Math.sin((q / 6) * Math.PI) * 2), RB.lime[4 + (q % 2)], tg('leaf', RB.lime[3])); if (q % 2) b.set(x + dir * q, y + 1 - Math.round(Math.sin((q / 6) * Math.PI) * 2), RB.lime[3], tg('leaf', RB.lime[3])); } };
    fern(c0 - 4, 26, -1); fern(c0 + 10, 40, 1); fern(c1 - 8, 32, 1); fern(c1 + 3, 18, 1); fern(f.x0 - 9, 24, -1); fern(f.x1 + 7, 40, 1);
    [[c0 + 6, 16, 0], [c1 - 10, 24, 1], [f.x0 - 13, 36, 4], [f.x1 + 14, 14, 3], [c0 + 20, 30, 2]].forEach(([x, y, q]) => grid((xx, yy, c) => b.set(xx, yy, c, tg('fl', FLOWERS[q][0])), x - 1, y - 1, ['.a.', 'aYa', '.a.'], { a: FLOWERS[q][1], Y: FLOWERS[q][2] }));
  }, { outline: sel, pad: 2 });
  // foam where the water lands
  for (const [fx, fy, rx, ry] of [[cx, base + 1, 9, 2.6], [cx - 7, base + 3, 5, 2.2], [cx + 7, base + 3, 5, 2.2], [cx - 14, base + 5, 3, 1.5], [cx + 14, base + 5, 3, 1.5], [cx, base + 6, 4, 1.6]]) {
    for (let y = Math.floor(fy - ry); y <= fy + ry; y += 1) for (let x = Math.floor(fx - rx); x <= fx + rx; x += 1) {
      if (!inEll(x, y, fx, fy, rx, ry)) continue;
      const dd = ((x + 0.5 - fx) / rx) ** 2 + ((y + 0.5 - fy) / ry) ** 2;
      px(x, y, dd > 0.6 ? MI[1] : (x + 0.5 - fx) + (y + 0.5 - fy) < -1 ? MI[3] : MI[2]);
    }
  }
  // mossy boulders at its foot
  for (const [bx, by, r] of [[c0 + 2, base + 1, 6], [c1 - 6, base + 3, 5], [f.x0 - 16, base + 9, 3.5], [f.x1 + 18, base + 10, 3]]) {
    propB(px, Math.round(bx - r - 1), Math.round(by - r), Math.ceil(r * 2 + 2), Math.ceil(r * 1.6 + 1), (b) => {
      for (let y = 0; y < r * 1.6 + 1; y += 1) for (let x = 0; x < r * 2 + 2; x += 1) {
        if (!inEll(x, y, r + 1, r * 0.85, r + 0.5, r * 0.85)) continue;
        const l = -((x + 0.5 - r - 1) / r * 0.6 + (y + 0.5 - r * 0.85) / r * 0.8);
        const moss = y < r * 0.6 && vnoise(x + bx, y, 3, seed + 6) > 0.35;
        b.set(x, y, moss ? MS[l > 0.2 ? 5 : 4] : R[l > 0.4 ? 6 : l > 0 ? 5 : l > -0.4 ? 4 : 3], tg(moss ? 'leaf' : 'stone', moss ? MS[3] : R[3]));
      }
    }, { outline: sel, pad: 1 });
  }
  // mist drifting up off the pool
  for (const [mx, my, rx, ry, a] of [[cx - 17, base + 1, 9, 4, 0.3], [cx + 16, base + 2, 10, 4, 0.28], [cx, base - 4, 13, 4, 0.2], [cx - 28, base + 9, 7, 3, 0.18], [cx + 28, base + 10, 7, 3, 0.18], [cx - 6, base + 14, 9, 3, 0.16]]) {
    for (let y = Math.floor(my - ry); y <= my + ry; y += 1) for (let x = Math.floor(mx - rx); x <= mx + rx; x += 1) {
      if (!inEll(x, y, mx, my, rx, ry)) continue;
      const dd = ((x + 0.5 - mx) / rx) ** 2 + ((y + 0.5 - my) / ry) ** 2;
      if (dd > 0.55 && bayer(x, y) > 0.5) continue;
      px(x, y, `rgba(236,248,244,${a})`);
    }
  }
}

/** The rope bridge: a plank deck slung between posts on the banks, rope rails sagging above it. */
function ropeBridgeR(px, c) {
  const X = Math.round(c.x); const Y = Math.round(c.y); const w = Math.round(c.w); const h = Math.round(c.h);
  const top = 7; const bot = h - 7;
  // its shadow on the water
  for (let x = X + 2; x < X + w - 2; x += 1) px(x, Y + bot + 1, 'rgba(6,20,26,0.45)', 1, 3);
  propB(px, X, Y, w, h, (b) => {
    for (let x = 2; x < w - 2; x += 1) {
      const k = Math.floor((x - 2) / 4); const u = (x - 2) % 4;
      const sag = Math.round(Math.sin(((x - 2) / (w - 4)) * Math.PI) * 1.4);
      const hk = h2(k, 1, 11);
      for (let y = top + sag; y < bot + sag; y += 1) {
        if (u === 3) { if (y === top + sag || y === bot + sag - 1) b.set(x, y, BK[1], tg('wood', BK[3])); continue; }
        const P = hk < 0.4 ? [Wd[1], Wd[2], Wd[3], Wd[4]] : hk < 0.75 ? [BK[2], BK[3], BK[4], BK[5]] : [Wd[1], Wd[3], Wd[4], Wd[5]];
        let col = u === 0 ? P[3] : u === 2 ? P[1] : P[2];
        if (y === top + sag) col = P[3];
        if (y === bot + sag - 1) col = P[0];
        // ragged plank ends and a few knots
        if ((y === top + sag || y === bot + sag - 1) && h2(k, y, 12) > 0.6) continue;
        if (h2(x, y, 13) > 0.97) col = P[0];
        b.set(x, y, col, tg('wood', Wd[2]));
      }
      // the lashing that ties each plank on
      if (u === 1 && k % 2 === 0) { b.set(x, top + sag + 1, '#e6d2a0', tg('rope', '#c8a868')); b.set(x, bot + sag - 2, '#c8a868', tg('rope', '#c8a868')); }
    }
    // rope rails, sagging, with hangers down to the deck
    for (const ry of [3, h - 4]) {
      for (let x = 0; x < w; x += 1) {
        const sag = Math.round(Math.sin((x / (w - 1)) * Math.PI) * 3);
        b.set(x, ry + sag, (x % 3) ? '#e6d2a0' : '#b89a5e', tg('rope', '#c8a868'));
        if (x > 4 && x < w - 4 && x % 6 === 3) { const dy = ry < h / 2 ? 1 : -1; const to = ry < h / 2 ? top : bot - 1; for (let y = ry + sag + dy; dy > 0 ? y < to + 1 : y > to - 1; y += dy) b.set(x, y, '#c8a868', tg('rope', '#c8a868')); }
      }
    }
    // posts on the banks, with leaves twined round
    for (const [qx, qy] of [[-2, 0], [w - 3, 0], [-2, h - 7], [w - 3, h - 7]]) {
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 5; x += 1) b.set(qx + x, qy + y, y === 0 ? Wd[5] : x === 0 ? Wd[4] : x === 4 ? Wd[1] : y % 3 === 1 ? '#c8a868' : Wd[3], tg('wood', Wd[2]));
      b.set(qx + 1, qy + 3, J[5], tg('leaf', J[3])); b.set(qx + 2, qy + 4, J[4], tg('leaf', J[3])); b.set(qx + 3, qy + 2, J[6], tg('leaf', J[3]));
    }
  }, { outline: (t, side) => (String(t).startsWith('rope') ? (side === 'bottom' ? 'rgba(6,20,26,0.5)' : null) : sel(t, side)), pad: 3 });
}

// ---------- the green ----------

function roundRect(Z, x, y, g = 0, rr = 10) {
  const qx = Math.max(Z.x + rr - g, Math.min(Z.x + Z.w - rr + g, x + 0.5)); const qy = Math.max(Z.y + rr - g, Math.min(Z.y + Z.h - rr + g, y + 0.5));
  return Math.hypot(x + 0.5 - qx, y + 0.5 - qy) <= rr;
}

/** A lily-pad pond in a rim of mossy stones, with lotus flowers, a frog on a pad, and reeds. */
function lilyPondR(px, Z, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2; const rx = Z.w / 2 + 3; const ry = Z.h / 2 + 3;
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y += 1) {
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x += 1) {
      const wob = (vnoise(x, y, 7, seed) - 0.5) * 0.12;
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + wob;
      if (d > 1.18) continue;
      if (d > 1) {
        // the rim: mossy stones
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const st = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 34);
        const lit = -((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8);
        let c = (((a + Math.PI) / (Math.PI * 2)) * 34) % 1 < 0.14 ? R[1] : d > 1.12 ? R[2] : lit > 0 ? R[5] : R[4];
        if (h2(st, 2, seed) > 0.55 && d < 1.09 && c !== R[1]) c = MS[lit > 0 ? 5 : 4];
        px(x, y, c);
        continue;
      }
      const t = (bayer(x, y) - 0.5) * 0.14;
      let c = d > 0.86 ? (y < cy ? WA[1] : WA[5]) : d > 0.55 + t ? WA[4] : d > 0.25 + t ? WA[3] : WA[2];
      if (h2(x, y, seed + 1) > 0.993) c = WA[7];
      px(x, y, c);
    }
  }
  // lily pads and lotus flowers
  const rnd = rng(seed + 2);
  for (let n = 0; n < 22; n += 1) {
    const a = rnd() * Math.PI * 2; const k = 0.35 + rnd() * 0.5;
    const x = Math.round(cx + Math.cos(a) * rx * k); const y = Math.round(cy + Math.sin(a) * ry * k);
    if (Math.abs(x - cx) < 10 && Math.abs(y - cy) < 4) continue;
    const r = 2.4 + rnd() * 1.8; const notch = rnd() * Math.PI * 2;
    for (let yy = -4; yy <= 4; yy += 1) for (let xx = -5; xx <= 5; xx += 1) {
      if (!inEll(x + xx, y + yy, x + 0.5, y + 0.5, r + 0.5, r * 0.72)) continue;
      const th = Math.atan2(yy, xx);
      if (Math.abs(((th - notch + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < 0.4) continue;
      const rim = !inEll(x + xx, y + yy, x + 0.5, y + 0.5, r - 0.5, r * 0.72 - 0.6);
      px(x + xx, y + yy, rim ? RB.lime[3] : xx + yy < 0 ? RB.lime[6] : RB.lime[5]);
    }
    px(x + 1, y + Math.ceil(r * 0.72), 'rgba(6,20,26,0.35)', 2, 1);
    if (n % 4 === 0) grid(px, x - 2, y - 3, ['.p.p.', 'pPwPp', '.pYp.', '..p..'], { p: '#f08ab8', P: '#ffc4dc', w: '#fff4fa', Y: '#ffd23f' });
  }
  // a little green frog sitting on a pad
  const fx = Math.round(cx + rx * 0.42); const fy = Math.round(cy - ry * 0.25);
  for (let yy = -3; yy <= 3; yy += 1) for (let xx = -5; xx <= 5; xx += 1) if (inEll(fx + xx, fy + yy, fx + 0.5, fy + 0.5, 5, 3.4)) px(fx + xx, fy + yy, inEll(fx + xx, fy + yy, fx + 0.5, fy + 0.5, 4, 2.6) ? RB.lime[5] : RB.lime[3]);
  grid(px, fx - 3, fy - 4, ['.ww.ww.', 'wKgwKg.', 'gggggg.', 'gGGGGg.', '.g..g..'], { w: '#f4fff0', K: INK, g: '#5cb848', G: '#9ce070' });
  // reeds at the ends
  for (const [x, y] of [[Z.x - 3, Z.y + 4], [Z.x + Z.w + 1, Z.y + Z.h - 6], [Z.x + 4, Z.y + Z.h + 1]]) {
    for (let k = 0; k < 4; k += 1) { const hh = 5 + ((k * 3) % 4); for (let j = 0; j < hh; j += 1) px(x + k * 2, y - j, j > hh - 2 ? MS[6] : MS[4]); if (k % 2) { px(x + k * 2, y - hh, BK[3]); px(x + k * 2, y - hh - 1, BK[4]); } }
  }
}

/** A mossy rink: a smooth slab of slick moss inside mossy log boards, with bamboo goals. */
function mossRinkR(px, Z, seed) {
  for (let y = Z.y - 6; y < Z.y + Z.h + 6; y += 1) {
    for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
      if (roundRect(Z, x, y, 5, 13)) {
        if (!roundRect(Z, x, y, 2, 11)) {
          // the log boards round it
          const lit = y < Z.y + Z.h / 2;
          const ring = (x + y * 3) % 11 === 0;
          let c = ring ? BK[2] : roundRect(Z, x, y, 3.5, 12) ? (lit ? BK[5] : BK[3]) : lit ? BK[4] : BK[2];
          if (h2(x, y, seed) > 0.7 && lit) c = MS[4];
          px(x, y, c);
          continue;
        }
        const n = vnoise(x, y, 7, seed + 1);
        const t = (bayer(x, y) - 0.5) * 0.2;
        let c = n < 0.35 + t ? MS[4] : n < 0.62 + t ? MS[5] : MS[6];
        // a sheen like wet glass, slanting across
        const sh = ((x - Z.x) * 0.7 - (y - Z.y) + 400) % 26;
        if (sh < 2) c = mix(c, '#f0ffe0', 0.4);
        // the lines and circles
        const mid = Z.x + Z.w / 2;
        if (Math.abs(x + 0.5 - mid) < 0.6) c = '#eaf8d8';
        const dm = Math.hypot(x + 0.5 - mid, y + 0.5 - (Z.y + Z.h / 2));
        if (Math.abs(dm - 7) < 0.55) c = '#eaf8d8';
        if (Math.abs(x + 0.5 - (Z.x + 16)) < 0.55 || Math.abs(x + 0.5 - (Z.x + Z.w - 16)) < 0.55) c = mix(c, '#ffb0a0', 0.5);
        px(x, y, c);
      } else if (roundRect(Z, x, y, 6.5, 14)) px(x, y, 'rgba(8,16,20,0.3)');
    }
  }
  // bamboo goals with vine nets at the ends
  const mid = Math.round(Z.y + Z.h / 2);
  for (const [gx, dir] of [[Z.x + 4, 1], [Z.x + Z.w - 9, -1]]) {
    propB(px, gx, mid - 8, 6, 16, (b) => {
      for (let y = 0; y < 16; y += 1) for (let x = 0; x < 6; x += 1) {
        const post = y < 2 || y > 13 || (dir > 0 ? x === 0 : x === 5);
        if (post) b.set(x, y, y % 4 === 0 ? BS[1] : BS[3], tg('wood', BS[2]));
        else if ((x + y) % 2 === 0) b.set(x, y, '#b8d898', tg('net', '#b8d898'));
      }
    }, { outline: sel, pad: 1 });
  }
}

/** A muddy clearing for soccer or football: churned mud, puddles that catch the sky, footprints, bamboo goals or posts. */
function mudClearingR(px, Z, kind, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2;
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) {
    for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
      const dx = (x + 0.5 - cx) / (Z.w / 2 + 4); const dy = (y + 0.5 - cy) / (Z.h / 2 + 4);
      const k = 1 - Math.max(Math.abs(dx) ** 3, 0) - dy * dy * 0.9 - Math.abs(dx) * dy * dy * 0.1;
      const edgeN = (vnoise(x, y, 4, seed) - 0.5) * 0.3;
      if (k + edgeN < 0) continue;
      if (k + edgeN < 0.12) { if (bayer(x, y) < 0.6) px(x, y, MD[2]); continue; }
      const n = vnoise(x, y, 6, seed + 1); const t = (bayer(x, y) - 0.5) * 0.2;
      let c = n < 0.3 + t ? MD[3] : n < 0.62 + t ? MD[4] : MD[5];
      // puddles
      const pd = vnoise(x, y, 9, seed + 2);
      if (pd > 0.74 && k > 0.3) c = pd > 0.79 ? (y % 3 === 0 && bayer(x, y) < 0.5 ? '#bcdcd8' : '#7aa8a8') : MD[1];
      px(x, y, c);
    }
  }
  // footprints in the mud
  const rnd = rng(seed + 3);
  for (let n = 0; n < 16; n += 1) {
    const x = Math.round(Z.x + 10 + rnd() * (Z.w - 20)); const y = Math.round(Z.y + 6 + rnd() * (Z.h - 12));
    px(x, y, MD[2], 2, 1); px(x, y + 1, MD[2], 2, 1); px(x + 3, y + 2, MD[2], 2, 1); px(x + 3, y + 3, MD[2], 2, 1);
  }
  const mid = Math.round(cy);
  if (kind === 'football') {
    for (const gx of [Z.x + 4, Z.x + Z.w - 7]) {
      propB(px, gx - 5, mid - 18, 14, 22, (b) => {
        for (let y = 0; y < 22; y += 1) b.set(5, y, y % 5 === 0 ? BS[1] : BS[3], tg('wood', BS[2]));
        for (let x = 0; x < 13; x += 1) b.set(x, 8, x % 5 === 0 ? BS[1] : BS[4], tg('wood', BS[2]));
        for (let y = 0; y < 9; y += 1) { b.set(0, y, BS[3], tg('wood', BS[2])); b.set(12, y, BS[3], tg('wood', BS[2])); }
      }, { outline: sel, pad: 1 });
    }
  } else {
    for (const [gx, dir] of [[Z.x, 1], [Z.x + Z.w - 8, -1]]) {
      propB(px, gx, mid - 8, 8, 16, (b) => {
        for (let y = 0; y < 16; y += 1) for (let x = 0; x < 8; x += 1) {
          const post = y < 2 || y > 13 || (dir > 0 ? x === 0 : x === 7);
          if (post) b.set(x, y, y % 4 === 0 ? BS[1] : BS[3], tg('wood', BS[2]));
          else if ((x + y) % 2 === 0) b.set(x, y, (x * 7 + y) % 5 === 0 ? J[5] : '#c8dca8', tg('net', '#c8dca8'));
        }
      }, { outline: sel, pad: 1 });
    }
  }
}

// ---------- stilt huts ----------

/**
 * A hut on stilts: a palm-thatch roof in rows of pointed leaf tips, woven walls, square windows
 * with shutters propped open, a doorway hung with a curtain, on a plank deck raised on poles,
 * a ladder down from the door. o.kid: the kid's own (roof, shutters, curtain, bunting and a
 * pennant in their color, a flower box); o.sign 'note': the music hall (a note sign and drums).
 */
function stiltHutR(px, X, Y, w, h, o = {}) {
  const P = ramp(o.roof || '#2f9e44', 3, 2);
  const legs = 16; const deck = h - legs; // the deck's top
  const wallTop = Math.round(deck * 0.5); const eave = wallTop + 5;
  const rx0 = Math.round(w * 0.3); const rx1 = Math.round(w * 0.7);
  const Kp = o.kid ? ramp(o.roof, 2, 2) : null;
  groundShadow(px, X + w / 2 + 2, Y + h - 1, w / 2 + 2, 5, 0.3);
  // the dark under the deck
  for (let y = Y + deck + 3; y < Y + h - 1; y += 1) for (let x = X + 4; x < X + w - 4; x += 1) if (bayer(x, y) < 0.75) px(x, y, 'rgba(8,16,20,0.28)');
  const OX = 9; const OY = 16;
  propB(px, X - OX, Y - OY, w + OX * 2, h + OY, (b) => {
    const set = (x, y, c, t) => b.set(x + OX, y + OY, c, t);
    // the stilts, with cross braces between the outer pairs
    const posts = [5, Math.round(w * 0.36) - 2, Math.round(w * 0.64) - 2, w - 9];
    posts.forEach((qx) => { for (let y = deck + 2; y < h; y += 1) for (let x = 0; x < 4; x += 1) set(qx + x, y, x === 0 ? BK[5] : x === 3 ? BK[2] : y % 5 === 0 ? BK[3] : BK[4], tg('wood', BK[3])); });
    for (const [a, z] of [[posts[0] + 3, posts[1]], [posts[2] + 3, posts[3]]]) {
      line(a, deck + 3, z, h - 3, (x, y) => set(x, y, BK[3], tg('wood', BK[3])));
      line(a, h - 3, z, deck + 3, (x, y) => set(x, y, BK[2], tg('wood', BK[3])));
    }
    // the deck: planks, lit along its front edge
    for (let y = deck - 2; y < deck + 3; y += 1) for (let x = 1; x < w - 1; x += 1) {
      let c = y === deck - 2 ? Wd[5] : y === deck - 1 ? Wd[4] : y === deck + 2 ? Wd[1] : (x % 7 === 0 ? Wd[1] : Wd[3]);
      if (y >= deck && h2(Math.floor(x / 7), 4, 5) > 0.6 && x % 7 !== 0) c = Wd[2];
      set(x, y, c, tg('wood', Wd[2]));
    }
    // the ladder from the door down to the ground
    const lx = Math.round(w / 2) - 5;
    for (let y = deck + 2; y < h; y += 1) { set(lx, y, Wd[4], tg('wood', Wd[2])); set(lx + 1, y, Wd[2], tg('wood', Wd[2])); set(lx + 9, y, Wd[4], tg('wood', Wd[2])); set(lx + 10, y, Wd[2], tg('wood', Wd[2])); }
    for (let y = deck + 4; y < h; y += 4) for (let x = lx + 2; x < lx + 9; x += 1) { set(x, y, Wd[4], tg('wood', Wd[2])); set(x, y + 1, Wd[1], tg('wood', Wd[2])); }
    // woven walls between corner poles
    for (let y = wallTop; y < deck - 2; y += 1) for (let x = 7; x < w - 7; x += 1) {
      let c;
      if (x < 10 || x > w - 11) c = x === 7 || x === w - 11 + 1 ? BK[5] : x === 9 || x === w - 8 ? BK[2] : BK[4];
      else {
        const wx = Math.floor((x - 10) / 3); const wy = Math.floor((y - wallTop) / 3);
        const over = (wx + wy) % 2;
        const u = over ? (x - 10) % 3 : (y - wallTop) % 3;
        c = over ? (u === 0 ? BS[5] : u === 1 ? BS[4] : BS[3]) : (u === 0 ? BS[4] : u === 1 ? BS[3] : BS[2]);
      }
      if (y < eave + 4) c = mix(c, '#20141c', 0.5 - (y - eave) * 0.1);
      set(x, y, c, tg('wood', BS[2]));
    }
    // square windows, glowing warm, shutters propped open either side
    const wy = Math.round((wallTop + deck) / 2) + 1;
    for (const wx of [Math.round(w * 0.24), Math.round(w * 0.76)]) {
      for (let y = wy - 5; y <= wy + 5; y += 1) for (let x = wx - 5; x <= wx + 5; x += 1) {
        const fr = Math.abs(x - wx) === 5 || Math.abs(y - wy) === 5;
        if (fr) { set(x, y, y === wy - 5 ? Wd[4] : x === wx + 5 || y === wy + 5 ? Wd[1] : Wd[3], tg('wood', Wd[2])); continue; }
        let c = (x - wx) - (y - wy) > 3 ? GS[3] : y > wy + 1 ? GS[1] : GS[2];
        if (x === wx || y === wy) c = Wd[2];
        set(x, y, c, tg('glow', GS[2]));
      }
      const S = o.kid ? Kp : [Wd[1], Wd[2], Wd[3], Wd[4], Wd[5]];
      for (const sd of [-1, 1]) for (let y = wy - 5; y <= wy + 5; y += 1) for (let k = 0; k < 4; k += 1) {
        const x = wx + sd * (6 + k);
        set(x, y, k === 3 || y === wy + 5 ? S[0] : (y - wy + 5) % 3 === 0 ? S[1] : k === 0 ? S[3] : S[2], tg('wood', S[1]));
      }
    }
    // the doorway and its curtain
    const dx0 = Math.round(w / 2 - 7); const dTop = deck - 24;
    for (let y = dTop; y < deck - 2; y += 1) for (let x = dx0 - 1; x < dx0 + 15; x += 1) {
      const top = dTop + (Math.abs(x + 0.5 - w / 2) > 5 ? Math.abs(x + 0.5 - w / 2) - 5 : 0) * 1.2;
      if (y < top) continue;
      const frame = x === dx0 - 1 || x === dx0 + 14 || y < top + 1;
      if (frame) { set(x, y, x === dx0 + 14 ? Wd[1] : Wd[4], tg('wood', Wd[2])); continue; }
      const strand = (x - dx0) % 2;
      const len = deck - 5 - Math.round(Math.abs(x + 0.5 - w / 2) * 0.5);
      let c = '#2a1a22';
      if (y < len) {
        const kc = o.kid ? [Kp[3], '#fff4e0', Kp[2], '#fff4e0'] : ['#7ab858', '#5a9440', '#a0d070', '#4a7a36'];
        c = kc[(Math.floor((y - dTop) / 3) + strand) % 4];
        if (strand && y % 2) c = mix(c, '#2a1a22', 0.22);
      }
      set(x, y, c, tg('door', Wd[2]));
    }
    // the palm-thatch roof: rows of pointed leaf tips, each row hanging over the next
    for (let y = 1; y <= eave; y += 1) {
      const t = ((y - 1) / (eave - 1)) ** 0.9;
      const xl = rx0 + (-6 - rx0) * t; const xr = rx1 + (w + 6 - rx1) * t;
      for (let x = Math.floor(xl); x < Math.ceil(xr); x += 1) {
        const u = (x + 0.5 - (xl + xr) / 2) / ((xr - xl) / 2);
        const fromEave = eave - y; const row = Math.floor(fromEave / 7); const ry = fromEave % 7;
        // the rows are long leaf blades side by side, each ending in a point at the row's foot
        const blade = (x + row * 2 + 40) % 5; const point = ry < 2 && Math.abs(blade - 2) > ry + 0.6;
        let i = u < -0.45 ? 4 : u < 0.45 ? 3 : 2;
        if (point) i = 1;
        else if (blade === 4) i -= 1;
        else if (blade === 0 && ry > 1) i += 1;
        else if (blade === 2 && ry < 4) i += 1;
        if (ry === 6) i -= 1;
        if (h2(x, row, 7) > 0.92) i -= 1;
        set(x, y, P[clamp(i, 0, 5)], tg('thatch', P[2]));
      }
    }
    // the leaf tips along the eave, hanging down
    for (let x = -6; x < w + 6; x += 1) { const tip = (x + 1) % 5; const n = tip === 2 ? 3 : tip === 1 || tip === 3 ? 2 : 1; for (let k = 1; k <= n; k += 1) set(x, eave + k, k === n ? P[1] : P[2], tg('thatch', P[2])); }
    // the ridge: a rolled leaf cap, tied
    for (let x = rx0 - 2; x < rx1 + 2; x += 1) { set(x, -1, P[4], tg('thatch', P[2])); set(x, 0, P[3], tg('thatch', P[2])); set(x, 1, P[2], tg('thatch', P[2])); if (x % 7 === 0) { set(x, -1, BS[2]); set(x, 0, BS[1]); } }
    // a flower box under each window (the kid's), or a sign with a note (the music hall)
    if (o.kid) {
      for (const wx of [Math.round(w * 0.24), Math.round(w * 0.76)]) {
        for (let x = wx - 6; x <= wx + 6; x += 1) { set(x, wy + 6, Wd[4], tg('wood', Wd[2])); set(x, wy + 7, Wd[2], tg('wood', Wd[2])); set(x, wy + 8, Wd[1], tg('wood', Wd[2])); }
        for (let k = 0; k < 5; k += 1) { const c = FLOWERS[(k + wx) % FLOWERS.length]; const fx = wx - 5 + k * 2 + (k % 2); set(fx, wy + 5, c[1], tg('fl', c[0])); set(fx, wy + 4, k % 2 ? c[2] : c[0], tg('fl', c[0])); set(fx + 1, wy + 5, J[5], tg('leaf', J[3])); }
      }
      // a pennant on a pole at the ridge
      const fx = Math.round(w / 2);
      for (let y = -13; y < -1; y += 1) set(fx, y, Wd[3], tg('wood', Wd[2]));
      grid((x, y, c) => set(x, y, c, tg('cloth', Kp[2])), fx + 1, -13, ['ppppp', 'pPPPpppp', 'pppppp', 'ppp'], { p: Kp[2], P: Kp[4] });
    }
    if (o.sign === 'note') {
      const sx = Math.round(w / 2); const sy = dTop - 6;
      for (let y = sy - 6; y <= sy + 6; y += 1) for (let x = sx - 6; x <= sx + 6; x += 1) { const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy); if (d < 6.2) set(x, y, d > 5 ? Wd[1] : d > 4 ? Wd[4] : Wd[3], tg('wood', Wd[2])); }
      grid((x, y, c) => set(x, y, c), sx - 2, sy - 4, ['..yy', '..yY', '..y.', '..y.', 'yyy.', 'yyy.'], { y: '#ffd23f', Y: '#fff4a8' });
      // bongo drums on the deck by the door
      for (const [cx, r, hh] of [[w / 2 + 13, 3.5, 8], [w / 2 + 20, 3, 6]]) {
        for (let y = deck - 2 - hh; y < deck - 2; y += 1) for (let x = Math.floor(cx - r); x < cx + r; x += 1) {
          const tp = y < deck - hh;
          const u = (x + 0.5 - cx) / r;
          set(x, y, tp ? (u < 0 ? '#f4e6c8' : '#dcc8a4') : (y % 3 === 0 ? '#e8c890' : u < -0.3 ? Wd[4] : u > 0.4 ? Wd[2] : Wd[3]), tg('wood', Wd[2]));
        }
      }
    }
  }, { outline: sel });
  if (o.kid) {
    // bunting along the eave in the kid's color
    const by = Y + eave + 3;
    for (let x = X - 3; x < X + w + 3; x += 1) px(x, by + Math.round(Math.sin(((x - X) / (w + 6)) * Math.PI * 2) * 1.2 + 1), '#6a4a3a');
    for (let k = 0; k < 9; k += 1) {
      const fx = X + 2 + Math.round((k * (w - 8)) / 8); const fy = by + Math.round(Math.sin(((fx - X) / (w + 6)) * Math.PI * 2) * 1.2 + 1) + 1;
      grid(px, fx - 2, fy, ['ccccc', '.ccc.', '..c..'], { c: k % 2 ? '#fff4e0' : Kp[3] });
      px(fx - 2, fy, k % 2 ? '#d8c8b0' : Kp[1], 1, 1);
    }
  }
}

// ---------- props ----------

/** A leafy clump into a Buf. */
function clumpInto(b, cx, cy, r, P, seed, kind = 'leaf') {
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
    const dx = (x + 0.5 - cx) / r; const dy = (y + 0.5 - cy) / r;
    if (dx * dx + dy * dy > 1 - (h2(x, y, seed) > 0.85 ? 0.14 : 0)) continue;
    const l = -(dx * 0.6 + dy * 0.8);
    let i = l > 0.45 ? 6 : l > 0.1 ? 5 : l > -0.3 ? 4 : 3;
    if ((x + y * 2) % 5 === 0 && h2(x, y, seed + 1) > 0.4) i += l > -0.2 ? 1 : -1;
    b.set(x, y, P[clamp(i, 1, 7)], tg(kind, P[3]));
  }
}

/** A big rainforest tree: a pale trunk on buttress roots, a round crown in clumps, vines hanging and a bromeliad on a branch (46 x 56). */
function jungleTreeR(px, X, Y, seed = 1) {
  groundShadow(px, X + 24, Y + 52, 21, 4.5, 0.3);
  propB(px, X, Y, 46, 56, (b) => {
    // the trunk
    for (let y = 18; y < 48; y += 1) for (let x = 19; x < 28; x += 1) {
      const u = (x + 0.5 - 23.5) / 4.5;
      let i = u < -0.5 ? 6 : u < 0 ? 5 : u < 0.5 ? 4 : 3;
      if ((x * 5 + Math.floor(y / 3)) % 9 === 0) i -= 1;
      b.set(x, y, BK[clamp(i, 1, 6)], tg('wood', BK[3]));
    }
    // the buttress roots: fins running out from the trunk, lit on top, their faces shaded
    for (const [tx, ty] of [[4, 53], [42, 53], [14, 56], [33, 56], [23, 56]]) {
      const n = 24;
      for (let q = 0; q <= n; q += 1) {
        const s2 = q / n; const x = Math.round(23.5 + (tx - 23.5) * s2); const yb = Math.round(42 + (ty - 42) * s2);
        const ht = Math.round((1 - s2) * 9 + 1);
        for (let y = yb - ht; y <= yb; y += 1) b.set(x, y, y === yb - ht ? BK[6] : y === yb - ht + 1 ? BK[5] : tx < 23 ? BK[4] : tx > 24 ? BK[2] : BK[3], tg('wood', BK[3]));
      }
    }
    // the crown
    const P = CANOPY[seed % 3];
    for (const [cx, cy, r] of [[23, 13, 12], [10, 20, 10], [36, 20, 10], [16, 9, 9], [31, 9, 9], [23, 24, 10]]) clumpInto(b, cx, cy, r, P, seed + cx);
    // vines hanging from it
    for (const [vx, len] of [[8, 16], [15, 20], [33, 18], [39, 13]]) for (let y = 0; y < len; y += 1) {
      const x = vx + Math.round(Math.sin(y / 3 + vx) * 0.8);
      b.set(x, 26 + y, y % 5 === 4 ? MS[6] : MS[3], tg('leaf', MS[2]));
      if (y % 5 === 2) b.set(x + (y % 10 < 5 ? 1 : -1), 26 + y, J[5], tg('leaf', J[3]));
    }
    // a bromeliad tucked in the crown, and a flower or two
    grid((x, y, c) => b.set(x, y, c, tg('fl', '#c8203a')), 30, 21, ['g.r.g', '.grg.', 'ggRgg'], { g: RB.lime[5], r: '#ff5a6a', R: '#c8203a' });
    grid((x, y, c) => b.set(x, y, c, tg('fl', FLOWERS[1][0])), 12, 12, ['.a.', 'aYa', '.a.'], { a: FLOWERS[1][1], Y: FLOWERS[1][2] });
  }, { outline: sel });
}

/** A fern: arching fronds, lit on top (22 x 14). */
function fernR(px, X, Y) {
  groundShadow(px, X + 11, Y + 13, 9, 2, 0.25);
  propB(px, X, Y, 22, 14, (b) => {
    for (const [ang, len] of [[-2.5, 10], [-2.0, 11], [-1.57, 12], [-1.15, 11], [-0.65, 10]]) {
      for (let s = 0; s < len; s += 0.5) {
        const fx = 11 + Math.cos(ang) * s; const fy = 13 + Math.sin(ang) * s + (s / len) ** 2 * 4;
        b.set(Math.round(fx), Math.round(fy), s > len * 0.6 ? J[5] : J[4], tg('leaf', J[3]));
        // leaflets either side
        if (Math.round(s * 2) % 3 === 0 && s > 1.5) {
          const w = 1.8 * (1 - s / len) + 0.6;
          for (const sd of [-1, 1]) b.set(Math.round(fx - Math.sin(ang) * w * sd), Math.round(fy + Math.cos(ang) * w * sd), sd < 0 ? J[6] : J[3], tg('leaf', J[3]));
        }
      }
    }
  }, { outline: sel, pad: 2 });
}

/** A big tropical flower: a heliconia's red and yellow claws on a stalk with broad leaves (18 x 20); c tints it. */
function bigFlowerR(px, X, Y, c = '#ff6b6b') {
  const Pf = ramp(c, 2, 2);
  groundShadow(px, X + 9, Y + 19, 7, 2, 0.25);
  propB(px, X, Y, 18, 20, (b) => {
    // two broad leaves
    for (const [sd, ox] of [[-1, 4], [1, 13]]) for (let y = 8; y < 19; y += 1) for (let x = 0; x < 18; x += 1) {
      if (!inEll(x, y, ox, 13 + sd, 3.2, 6)) continue;
      b.set(x, y, Math.abs(x + 0.5 - ox) < 0.6 ? J[6] : (x < ox ? J[5] : J[4]), tg('leaf', J[3]));
    }
    for (let y = 6; y < 20; y += 1) b.set(9, y, J[4], tg('leaf', J[3]));
    // the claws, stacked up the stalk, alternating sides
    for (let k = 0; k < 4; k += 1) {
      const sd = k % 2 ? 1 : -1; const y = 2 + k * 3;
      for (let j = 0; j < 5; j += 1) { b.set(9 + sd * j, y + Math.round(j * 0.4), j === 4 ? Pf[1] : Pf[3 - (j > 2 ? 1 : 0)], tg('fl', Pf[1])); b.set(9 + sd * j, y + 1 + Math.round(j * 0.4), j > 2 ? '#ffd23f' : Pf[1], tg('fl', Pf[1])); }
    }
    b.set(9, 0, Pf[3], tg('fl', Pf[1])); b.set(9, 1, Pf[2], tg('fl', Pf[1]));
  }, { outline: sel, pad: 2 });
}

/** The fruit stall: a counter of bamboo under an awning of big banana leaves, fruit piled on it (44 x 33). */
function stallR(px, X, Y, pal = {}) {
  groundShadow(px, X + 22, Y + 31, 22, 3, 0.28);
  propB(px, X, Y, 44, 33, (b) => {
    for (const x of [2, 40]) for (let y = 6; y < 33; y += 1) { b.set(x, y, BS[4], tg('wood', BS[2])); b.set(x + 1, y, BS[2], tg('wood', BS[2])); if (y % 6 === 0) { b.set(x, y, BS[1]); b.set(x + 1, y, BS[1]); } }
    for (let y = 20; y < 33; y += 1) for (let x = 3; x < 41; x += 1) {
      const top = y < 22; const k = Math.floor((x - 3) / 3);
      b.set(x, y, top ? (y === 20 ? Wd[4] : Wd[3]) : (x - 3) % 3 === 2 ? BS[1] : (k % 2 ? BS[3] : BS[4]), tg('wood', Wd[2]));
    }
    grid((x, y, c) => b.set(x, y, c, tg('fruit', '#c88a2a')), 5, 13, [
      '..g.......yy..............rr.........',
      '.ggg.....yyyy....oo......rRrr...pp...',
      '.ppp....yy..yy..oOoo.....rrrr..pPpp..',
      'pPpp...yy....y..oooo..gg..rr...pppp..',
      'pppP..........y..oo..gGgg.......pp...',
      '.pPp................gggg.............',
      '.ppp.................gg..............',
    ], { g: '#3a9a48', p: '#e8a83a', P: '#ffd060', y: '#ffd23f', o: '#ff8a2a', O: '#ffc070', r: '#e83a5a', R: '#ff9ab0' });
    // the awning: overlapping banana leaves, ribbed, hanging in tips
    const A = ramp(pal.a || '#5c940d', 3, 2);
    for (let y = 0; y < 11; y += 1) for (let x = -2; x < 46; x += 1) {
      const leaf = Math.floor((x + 2) / 8); const u = (x + 2) % 8;
      const tipY = 8 + Math.round(Math.sin((u / 8) * Math.PI) * 2.5);
      if (y > tipY) continue;
      let i = u === 0 ? 1 : u < 4 ? 4 : 3;
      if (u === 4) i = 5;
      if (y === 0) i = 5;
      if (y === tipY) i = 1;
      if ((u + y) % 3 === 0 && u > 0 && u !== 4) i -= 1;
      if (leaf % 2 && i > 1) i -= 1;
      b.set(x, y, A[clamp(i, 0, 5)], tg('leaf', A[2]));
    }
  }, { outline: sel });
}

// ---------- jungle whimsy ----------

/** A bright blue poison-dart frog on a big leaf (24 x 16). */
export function dartfrogR(px, X, Y) {
  groundShadow(px, X + 12, Y + 14, 10, 2.2, 0.28);
  propB(px, X, Y, 24, 16, (b) => {
    // the leaf, lying on a short stem, its midrib and veins
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 24; x += 1) {
      if (!inEll(x, y, 12, 8.5, 11.5, 6)) continue;
      const v = y + 0.5 - 8.5 - (x - 12) * 0.12;
      let c = Math.abs(v) < 0.6 ? J[6] : ((x + Math.abs(v) * 1.3) % 4 < 1 ? J[3] : v < 0 ? J[5] : J[4]);
      if (!inEll(x, y, 12, 8.5, 10.4, 5)) c = v < 0 ? J[4] : J[3];
      b.set(x, y, c, tg('leaf', J[3]));
    }
    // the frog: blue with black spots, big eyes
    grid((x, y, c) => b.set(x, y, c, tg('body', '#2a6ad0')), 7, 2, [
      '..ee..ee..',
      '.eKwbbKwe.',
      '.bbbbbbbb.',
      'bBbbkbbbbb',
      'bbbkbbbkbb',
      '.bbbbkbbb.',
      'b.bbbbbb.b',
      'bb......bb',
    ], { e: '#3a8ae8', K: INK, w: '#ffffff', b: '#2a7ae0', B: '#8ac8ff', k: '#14204a' });
  }, { outline: sel, pad: 2 });
}

/** A giant bromeliad: a rosette of stiff striped leaves, a red heart with a little pool in it (20 x 18). */
export function bromeliadR(px, X, Y) {
  groundShadow(px, X + 10, Y + 16, 9, 2.4, 0.28);
  propB(px, X, Y, 20, 18, (b) => {
    const leaves = [[-2.7, 9], [-2.2, 10], [-1.8, 9], [-1.35, 10], [-0.9, 9], [-0.45, 10], [-3.1, 7], [0, 7]];
    leaves.forEach(([a, len], k) => {
      for (let s = 0; s < len; s += 0.5) {
        const x = 10 + Math.cos(a) * s * 1.1; const y = 13 + Math.sin(a) * s * 0.85 + (s / len) ** 2 * 2;
        const w = 1.6 * (1 - s / len) + 0.5;
        for (let q = -w; q <= w; q += 0.5) {
          const xx = Math.round(x - Math.sin(a) * q); const yy = Math.round(y + Math.cos(a) * q);
          const stripe = Math.round(s * 1.4) % 3 === 0;
          b.set(xx, yy, s > len - 2 ? '#e8504a' : stripe ? RB.lime[6] : q < 0 ? RB.lime[5] : RB.lime[4], tg('leaf', RB.lime[3]));
        }
      }
      void k;
    });
    // the red heart and its pool of rainwater
    grid((x, y, c) => b.set(x, y, c, tg('fl', '#c8203a')), 6, 8, ['..r.r..', '.rRrRr.', 'rRwWwRr', '.rrwrr.', '..rrr..'], { r: '#d8303a', R: '#ff6a5a', w: '#5ab8d8', W: '#d8f4ff' });
  }, { outline: sel, pad: 2 });
}

/** Orchids growing on a mossy stump: purple, pink and white sprays (18 x 22). */
export function orchidsR(px, X, Y) {
  groundShadow(px, X + 9, Y + 21, 8, 2, 0.28);
  propB(px, X, Y, 18, 22, (b) => {
    for (let y = 12; y < 22; y += 1) for (let x = 3; x < 15; x += 1) {
      const u = (x + 0.5 - 9) / 6;
      if (y === 12 && Math.abs(u) > 0.8) continue;
      let c = y < 14 ? (Math.abs(u) < 0.5 ? BK[2] : BK[4]) : u < -0.4 ? BK[5] : u < 0.4 ? BK[4] : BK[2];
      if (y < 16 && vnoise(x, y, 3, 4) > 0.45) c = MS[y < 14 ? 5 : 4];
      b.set(x, y, c, tg(c === MS[5] || c === MS[4] ? 'leaf' : 'wood', BK[3]));
    }
    // leaves and arching stems
    for (const [sx, dir] of [[5, -1], [12, 1]]) for (let k = 0; k < 6; k += 1) { b.set(sx + dir * k, 12 - Math.round(Math.sin((k / 5) * Math.PI) * 2), J[5], tg('leaf', J[3])); b.set(sx + dir * k, 13 - Math.round(Math.sin((k / 5) * Math.PI) * 2), J[3], tg('leaf', J[3])); }
    line(7, 12, 4, 3, (x, y) => b.set(x, y, J[4], tg('leaf', J[3])));
    line(10, 12, 13, 2, (x, y) => b.set(x, y, J[4], tg('leaf', J[3])));
    const orchid = (x, y, P) => grid((xx, yy, c) => b.set(xx, yy, c, tg('fl', P[0])), x - 2, y - 2, ['.a.a.', 'aaBaa', '.BYB.', '..a..'], { a: P[1], B: P[2], Y: '#ffe060' });
    orchid(4, 3, ['#8a48c8', '#c08af0', '#f4e8ff']); orchid(3, 8, ['#c84a98', '#f08ac8', '#fff0f8']); orchid(13, 2, ['#c84a98', '#f08ac8', '#fff0f8']);
    orchid(14, 7, ['#9a9ab0', '#f6f2fa', '#ffd0e8']); orchid(9, 5, ['#8a48c8', '#c08af0', '#f4e8ff']);
  }, { outline: sel, pad: 2 });
}

/** A fallen mossy log with a cluster of softly glowing mushrooms (40 x 16). */
export function mushlogR(px, X, Y) {
  groundShadow(px, X + 20, Y + 14, 19, 2.6, 0.3);
  // a faint glow on the floor round the mushrooms
  for (let y = Y + 2; y < Y + 18; y += 1) for (let x = X + 18; x < X + 42; x += 1) { const d = ((x + 0.5 - X - 30) / 12) ** 2 + ((y + 0.5 - Y - 11) / 7) ** 2; if (d < 1 && bayer(x, y) < (1 - d) * 0.8) px(x, y, 'rgba(120,240,210,0.16)'); }
  propB(px, X, Y, 40, 16, (b) => {
    for (let y = 5; y < 15; y += 1) for (let x = 1; x < 37; x += 1) {
      const v = (y - 5) / 10;
      let c = v < 0.2 ? BK[5] : v < 0.5 ? BK[4] : v < 0.8 ? BK[3] : BK[2];
      if ((x + Math.floor(y / 3) * 3) % 9 === 0) c = BK[2];
      if (v < 0.45 && vnoise(x, y, 4, 9) > 0.4) c = MS[v < 0.2 ? 6 : 5];
      b.set(x, y, c, tg(c === MS[6] || c === MS[5] ? 'leaf' : 'wood', BK[3]));
    }
    // the cut end, ringed
    for (let y = 5; y < 15; y += 1) for (let x = 0; x < 6; x += 1) { if (!inEll(x, y, 3, 10, 3.2, 5)) continue; const d = Math.hypot((x + 0.5 - 3) * 1.6, y + 0.5 - 10); b.set(x, y, Math.round(d) % 2 ? '#d8b07a' : '#b88a5a', tg('wood', BK[3])); }
    // glowing mushrooms
    for (const [mx, my, r] of [[26, 4, 3], [31, 6, 2.5], [21, 6, 2], [34, 9, 2], [29, 1, 2]]) {
      for (let y = Math.floor(my - r); y <= my; y += 1) for (let x = Math.floor(mx - r); x <= mx + r; x += 1) if (inEll(x, y, mx + 0.5, my + 0.5, r + 0.5, r)) b.set(x, y, y < my - r * 0.4 ? (x < mx ? GW[4] : GW[3]) : GW[2], tg('glow', GW[2]));
      for (let y = my + 1; y < my + 4; y += 1) b.set(Math.round(mx), y, '#e8f4ec', tg('glow', GW[1]));
    }
    // a fern at its end
    for (let k = 0; k < 6; k += 1) { b.set(2 + k, 4 - Math.round(Math.sin((k / 5) * Math.PI) * 2), J[5], tg('leaf', J[3])); b.set(2 + k, 5 - Math.round(Math.sin((k / 5) * Math.PI) * 2), J[4], tg('leaf', J[3])); }
  }, { outline: sel, pad: 2 });
}

/** Leafcutter ants carrying bits of leaf home along a trail to their mound (44 x 12, flat). */
export function antsR(px, X, Y) {
  // the mound
  for (let y = Y + 2; y < Y + 12; y += 1) for (let x = X + 32; x < X + 44; x += 1) {
    if (!inEll(x, y, X + 38, Y + 9, 6, 4)) continue;
    const l = -((x + 0.5 - X - 38) * 0.6 + (y + 0.5 - Y - 9) * 0.8);
    px(x, y, inEll(x, y, X + 38, Y + 8.5, 1.4, 1) ? MD[0] : l > 1.5 ? MD[5] : l > -1 ? MD[4] : MD[3]);
  }
  // the trail, worn into the floor, and the ants on it with their leaves held high
  const ty = (x) => Y + 7 + Math.round(Math.sin((x - X) / 7) * 2);
  for (let x = X; x < X + 33; x += 1) px(x, ty(x), x % 3 ? 'rgba(60,30,20,0.35)' : 'rgba(60,30,20,0.2)');
  const leafC = [J[6], RB.lime[6], '#f0a848', J[5], RB.lime[5], '#e86a5a'];
  for (let k = 0; k < 7; k += 1) {
    const x = X + 2 + k * 4 + (k % 2); const y = ty(x);
    px(x, y, '#5a2a1a'); px(x + 1, y, '#7a3a22'); px(x - 1, y + 1, '#3a1a14'); px(x + 2, y + 1, '#3a1a14');
    const c = leafC[k % leafC.length];
    grid(px, x - 1, y - 3, k % 2 ? ['.cc', 'cCc'] : ['cc.', 'cCc'], { c, C: mix(c, '#ffffff', 0.3) });
  }
}

/** A carved wooden mask on a post, smiling, with a crest of leaves and painted stripes (14 x 34). */
export function maskR(px, X, Y) {
  groundShadow(px, X + 7, Y + 33, 6, 2, 0.28);
  propB(px, X, Y, 14, 34, (b) => {
    for (let y = 18; y < 34; y += 1) for (let x = 5; x < 9; x += 1) b.set(x, y, x === 5 ? Wd[4] : x === 8 ? Wd[1] : y % 6 === 0 ? Wd[2] : Wd[3], tg('wood', Wd[2]));
    // the crest of leaves behind
    for (const [a, len] of [[-2.4, 7], [-1.9, 8], [-1.57, 8], [-1.25, 8], [-0.75, 7]]) line(7, 7, 7 + Math.cos(a) * len, 7 + Math.sin(a) * len, (x, y, t) => b.set(x, y, t > 0.6 ? RB.lime[6] : RB.lime[4], tg('leaf', RB.lime[3])));
    grid((x, y, c) => b.set(x, y, c, tg('wood', Wd[2])), 1, 3, [
      '..wwwwwwww..',
      '.wWWWWWWWWw.',
      'wWyyWWWWyyWw',
      'wWkkwWWwkkWw',
      'wWkYwWWwkYWw',
      'wwWWwrrwWWww',
      '.rwWWwwWWwr.',
      '.rwWWwwWWwr.',
      '..wkkkkkkw..',
      '..wkttttkw..',
      '...wkkkkw...',
      '....wwww....',
      '.....ww.....',
    ], { w: Wd[3], W: Wd[4], y: '#ffd23f', k: INK, Y: '#ffffff', r: '#e8504a', t: '#ff8a9a' });
  }, { outline: sel, pad: 2 });
}

/** A blue morpho butterfly resting on a pink flower (12 x 10, flat). */
export function morphoR(px, X, Y) {
  grid(px, X, Y + 4, ['..g..g..', '.gpPpgg.', '..pYp...', '...g....'], { g: J[5], p: '#f08ab8', P: '#ffc4dc', Y: '#ffd23f' });
  grid(px, X + 2, Y, ['bB...Bb', 'bBBkBBb', '.bbkbb.', '..b.b..'], { b: '#2a5ad8', B: '#6ab8ff', k: INK });
}

// ---------- the whole village ----------

/** Paints the rainforest village (see villageprops.js paintVillage). */
export function paintRainforest(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 7703;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];
  const lm = L.landmark;
  const f = L.falls;
  const riverF = pathField(L.water.map((wa) => wa.pts), 40);
  const inArea = (x, y, pad) => areas.some((a) => x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad);
  const inLandmark = (x, y) => lm && lm.w && x > lm.x - 4 && x < lm.x + lm.w + 4 && y > lm.y && y < lm.y + lm.h;
  const atFalls = (x, y, pad = 0) => f && y < f.base + 10 + pad && x > f.cliff[0] - 14 - pad && x < f.cliff[1] + 14 + pad;

  groundR(px, L, seed);
  const busy = (x, y) => L.blocked(x, y, 4) || L.onPath(x, y, 9) || L.inWater(x, y, 8) || inArea(x, y, 8) || inLandmark(x, y) || atFalls(x, y);
  scatterR(px, L, seed + 1, busy, L.scatter?.colors || ['#ff6b6b', '#ffd43b', '#f783ac', '#ff922b']);
  pathsR(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plazaR(px, x, y, r, seed + 40 + i));
  const depths = L.water.map((wa, i) => riverR(px, L, wa, seed + 60 + i));
  const nearBridge = (x, y) => L.crossings.some((c) => x > c.x - 10 && x < c.x + c.w + 10 && y > c.y - 8 && y < c.y + c.h + 8);
  depths.forEach((d, i) => riverEdgeR(px, L, d, seed + 66 + i, (x, y) => !nearBridge(x, y) && !atFalls(x, y, 6) && !inArea(x, y, 6) && Math.min(x, L.W - x, L.H - y) > 30));
  areas.forEach((a, i) => {
    if (a.kind === 'pond') lilyPondR(px, a, seed + 70 + i);
    else if (a.kind === 'hockey') mossRinkR(px, a, seed + 70 + i);
    else mudClearingR(px, a, a.kind, seed + 70 + i);
  });
  if (f) fallsR(px, f, seed + 80);
  L.crossings.forEach((c) => ropeBridgeR(px, c));
  shaftsR(px, L, seed + 90);
  jungleR(px, L, seed + 100, (x, y) => atFalls(x, y, 2) || riverF(x, y).d < 22);

  // big leaves and vines over the floor from the jungle's edge, where nothing important stands
  const spots = [...L.slots.morning, ...L.slots.afternoon, L.shop, L.chest, L.start, lm?.stand].filter(Boolean);
  const labels = Object.values(L.labels || {}).map(([x, y]) => [x - 40, y - 2, 80, 16]);
  const things = [L.home, ...L.houses].map((h) => [h.x - 10, h.y - 18, h.w + 20, h.h + 20]);
  const border = (p) => p.kind === 'jungletree' && (p.x < 20 || p.x + PROPS.jungletree.w > L.W - 20 || p.y < 20 || p.y + PROPS.jungletree.h > L.H - 14);
  const propBoxes = L.props.filter((p) => PROPS[p.kind] && !border(p)).map((p) => [p.x - 4, p.y - 4, (p.w || PROPS[p.kind].w) + 8, (p.h || PROPS[p.kind].h) + 8]);
  const inBox = (x, y, [bx, by, bw, bh], pad) => x > bx - pad && x < bx + bw + pad && y > by - pad && y < by + bh + pad;
  const clear = (x, y, pad) => x > 0 && y > 0 && x < L.W && y < L.H && !L.onPath(x, y, pad + 4) && !L.inWater(x, y, pad) && !inArea(x, y, pad + 6) &&
    !inLandmark(x, y) && !atFalls(x, y, pad) && !spots.some((s) => Math.hypot(s.x - x, s.y - y) < pad + 14) && !labels.some((b) => inBox(x, y, b, pad)) &&
    !things.some((b) => inBox(x, y, b, pad)) && !propBoxes.some((b) => inBox(x, y, b, pad)) && !nearBridge(x, y);
  overhangR(px, L, seed + 110, clear);
  undergrowthR(px, L, seed + 120, (x, y, pad) => clear(x, y, pad) && !L.blocked(x, y, pad) && !L.onPath(x, y, pad + 6) && !L.inWater(x, y, pad + 6) && Math.min(x, y, L.W - x, L.H - y) > 44);

  // the border trees are the jungle wall itself: only the trees inside it are drawn
  const DRAW = {
    jungletree: (p) => jungleTreeR(px, p.x, p.y, (p.x + p.y) % 7),
    fern: (p) => fernR(px, p.x, p.y),
    bigflower: (p) => bigFlowerR(px, p.x, p.y, p.c),
    stall: (p) => stallR(px, p.x, p.y, p.pal),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const props = L.props.filter((p) => !border(p));
  const under = (p) => areas.some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);
  const home = L.home;
  const stand = [
    { y: home.y + home.h, draw: () => stiltHutR(px, home.x, home.y, home.w, home.h, { roof: opts.homeRoof || '#e03131', kid: true }) },
    ...L.houses.map((hs) => ({ y: hs.y + hs.h, draw: () => stiltHutR(px, hs.x, hs.y, hs.w, hs.h, { roof: hs.roof, sign: hs.sign }) })),
    ...props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  stand.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
