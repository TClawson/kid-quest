// Volcano Island in style B, "soft storybook": warm dark ash in the middle of the island with
// lush jungle growing in from every edge, a smoking volcano with glowing rivulets, the lava flow
// that splits the morning from after school (crusted plates, bright seams, a warm glow on the
// banks) and a stone bridge over it, flagstone paths, thatched tiki huts (the kid's roof in their
// own color, with bunting and a tiki shield), and the green as an island has it: a prismatic hot
// spring, an obsidian rink, a black-sand court. Island whimsy: a capybara in a hot tub, a tiki
// totem, a dodo, obsidian crystals, a marshmallow fire, a geyser and a dragonfruit cactus.
//
// One canvas pixel per village pixel, painted into one ImageData and shown with a single
// putImageData. villageprops.js calls paintVolcano() for 'bg-volcano' only.

import { ramp, mix, rng, h2, vnoise, bayer, grid, inEll, pathField, pixelBuffer, clamp, line, bbox, cobble } from './pixelkit.js';
import { PB, propB, groundShadow, flowerB, laundryB } from './meadowart.js';
import { sel, tg } from './castleart.js';

export const VB = {
  ash: ['#231b29', '#2f2530', '#3d3038', '#4b3c40', '#5a4a4a', '#6c5a55', '#826c62', '#9e8676'], // base 3
  rock: ['#18141f', '#241e2d', '#322a3c', '#443a4e', '#584e62', '#706678', '#8c8496'], // basalt
  lava: ['#5e1230', '#a01e2e', '#d83a20', '#f8661a', '#ff9a22', '#ffcc3c', '#fff08e', '#fffbe0'],
  jungle: ['#0f2c2e', '#154036', '#1c563c', '#286e42', '#3a8a48', '#56a64c', '#80c25a', '#b2dc72'],
  teal: ['#0e2a34', '#123e40', '#185646', '#1e6e4e', '#2c8a58', '#4aa868', '#7ac682', '#b4e2a0'],
  lime: ['#1e3426', '#2a4a2a', '#3a6430', '#4e8034', '#689c3a', '#8cb846', '#b6d45c', '#e0ec86'],
  lawn: ['#24563e', '#2e6c42', '#3b8246', '#4c984a', '#62ae50', '#82c45c', '#aad86e'], // base 3
  obsid: ['#100c1c', '#1c1430', '#2a1e48', '#3c2c66', '#56428a', '#7c68b4', '#b4a4e4', '#ece4ff'],
  spring: ['#0e3a62', '#125688', '#1676a8', '#2a9ec0', '#50c2cc', '#94e0d8', '#d8f8ee'],
  mat: ['#a83c22', '#d8642a', '#f09a36', '#f6c84a', '#e8e070', '#f4f0d8'], // the hot spring's colored rings, out to the travertine
  bsand: ['#16141e', '#221e2c', '#302a3c', '#40384e', '#544a64', '#6e6480', '#9a90aa'],
  bamboo: ['#4a3a1c', '#6e5826', '#967e32', '#bca448', '#d8c46a', '#efe2a0'],
  steam: ['#bcb4ca', '#d8d2e2', '#eeeaf4', '#ffffff'],
  glass: ['#a8401e', '#e8742a', '#ffa83e', '#ffd878', '#fff4c8'],
};
const A = VB.ash; const R = VB.rock; const LV = VB.lava; const J = VB.jungle; const GL = VB.lawn; const OB = VB.obsid; const SPR = VB.spring;
const MT = VB.mat; const BS = VB.bamboo; const SA = VB.bsand; const STM = VB.steam; const GS = VB.glass;
const Wd = PB.wood; const INK = '#2e2238';
const CANOPY = [VB.jungle, VB.teal, VB.lime];

// ---------- the ground: ash in the middle, the jungle's lawn round the edges ----------

/** Is a cell green (the lush lawn) or ash? Green grows in from the edges, never near the lava or up the volcano. */
function greenField(L, seed, lavaF) {
  return (x, y) => {
    const e = Math.min(x, y, L.W - 1 - x, L.H - 1 - y);
    let g = (70 - e) / 34 + (vnoise(x, y, 30, seed + 11) - 0.5) * 1.15;
    const dl = lavaF(x, y).d;
    if (dl < 44) g -= (44 - dl) / 16;
    const dv = ((x - 362) / 100) ** 2 + ((y - 64) / 70) ** 2;
    if (dv < 1) g -= (1 - dv) * 1.6;
    return g - 0.5;
  };
}

function groundV(px, L, seed, green) {
  const { W, H } = L;
  const mask = new Uint8Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = (bayer(x, y) - 0.5) * 0.16;
      if (green(x, y) > t) {
        mask[y * W + x] = 1;
        const n = vnoise(x, y, 24, seed) * 0.7 + vnoise(x, y, 8, seed + 1) * 0.3;
        px(x, y, n < 0.3 + t ? GL[2] : n < 0.4 + t ? '#448c48' : n > 0.72 + t ? GL[5] : n > 0.62 + t ? GL[4] : GL[3]);
        continue;
      }
      const n = vnoise(x, y, 18, seed + 2) * 0.65 + vnoise(x, y, 6, seed + 3) * 0.35;
      let c = n < 0.3 + t ? A[2] : n > 0.66 + t ? A[4] : A[3];
      const hk = h2(x, y, seed + 4);
      if (hk > 0.982) c = A[5]; else if (hk < 0.014) c = A[1];
      // where the ash meets the lawn it is dusted with moss
      const g = green(x, y);
      if (g > -0.12 && bayer(x, y) < (g + 0.12) * 3) c = mix(c, GL[1], 0.45);
      px(x, y, c);
    }
  }
  return mask;
}

/** Little things on the ground: grass strokes and flowers on the lawn; pebbles, cracks, embers and hardy ferns on the ash. */
function scatterV(px, L, seed, mask, busy) {
  const { W, H } = L;
  const rnd = rng(seed);
  const isG = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  const STROKES = [['.L', 'D.'], ['L.', '.D'], ['L', 'D'], ['..L', '.D.', 'D..'], ['L.L', '.D.']];
  for (let gy = 0; gy < H; gy += 5) {
    for (let gx = 0; gx < W; gx += 6) {
      const x = gx + Math.floor(rnd() * 6); const y = gy + Math.floor(rnd() * 5); const k = Math.floor(rnd() * STROKES.length); const r = rnd();
      if (busy(x, y)) continue;
      if (isG(x, y) && isG(x, y + 2)) { if (r < 0.6) grid(px, x, y, STROKES[k], { D: GL[1], L: r < 0.3 ? GL[5] : GL[4] }); continue; }
      if (isG(x, y) || r > 0.22) continue;
      // on the ash: a pebble, a crack, or a little ember
      if (r < 0.1) { px(x, y, R[2]); px(x + 1, y, R[1]); px(x, y - 1, A[5]); } else if (r < 0.17) { px(x, y, A[1]); px(x + 1, y + 1, A[1]); px(x + 2, y + 1, A[2]); } else { px(x, y, LV[3]); px(x, y + 1, '#7a2a2a'); if (r < 0.19) px(x - 1, y, 'rgba(255,120,40,0.35)'); }
    }
  }
  // tropical flowers on the lawn, in little clumps
  const kinds = [['daisy', 'pink'], ['daisy', 'white'], ['cup', 'yellow'], ['forget', 'lilac'], ['daisy', 'orange'], ['cup', 'orange']];
  for (let i = 0; i < (W * H) / 2600; i += 1) {
    const cx = rnd() * W; const cy = rnd() * H; const [k, c] = kinds[Math.floor(rnd() * kinds.length)];
    const n = 2 + Math.floor(rnd() * 4);
    for (let j = 0; j < n; j += 1) {
      const x = Math.round(cx + (rnd() - 0.5) * 12); const y = Math.round(cy + (rnd() - 0.5) * 7);
      if (isG(x, y) && isG(x, y + 2) && isG(x - 2, y) && isG(x + 2, y) && !busy(x, y)) flowerB(px, x, y, k, c);
    }
  }
  // hardy ferns and lava-rock flowers out on the ash
  for (let i = 0; i < (W * H) / 3200; i += 1) {
    const x = Math.round(rnd() * W); const y = Math.round(rnd() * H); const r = rnd();
    if (isG(x, y) || isG(x, y + 3) || busy(x, y) || busy(x, y + 3)) continue;
    if (r < 0.55) grid(px, x - 2, y - 2, ['l...l', '.l.l.', 'dlLld', '.ddd.'], { l: GL[4], L: GL[5], d: GL[1] });
    else { grid(px, x - 2, y - 1, ['.rr..', 'rRrR.', '.rrr.'], { r: R[2], R: R[4] }); px(x, y - 2, r < 0.8 ? '#ff8ab0' : '#ffd23f'); px(x - 1, y - 2, r < 0.8 ? '#ffd2e2' : '#fff4a8'); }
  }
}

// ---------- the jungle round the edge ----------

/** A band of jungle canopy round the island: round leafy clumps, lit top-left, with flowers, and a shadow on the ground at its foot. */
function jungleV(px, L, seed, lavaF) {
  const { W, H } = L; const C = 13;
  const cells = new Map();
  const cell = (i, j) => {
    const k = (i + 10) * 1000 + j + 10;
    if (cells.has(k)) return cells.get(k);
    const cx = i * C + 6.5 + (h2(i, j, seed) - 0.5) * 7; const cy = j * C + 6.5 + (h2(j, i, seed + 1) - 0.5) * 7;
    const e = Math.min(cx, cy, W - cx, H - cy);
    let v = null;
    if (e < 11 + h2(i, j, seed + 3) * 10 && lavaF(cx, cy).d > 27) v = { cx, cy, r: 8.5 + h2(i, j, seed + 2) * 4.5, P: CANOPY[Math.floor(h2(i, j, seed + 4) * 2.7) % 3], i, j };
    cells.set(k, v);
    return v;
  };
  const mask = new Uint8Array(W * H);
  const top = new Map();
  for (let y = 0; y < H; y += 1) {
    const band = y < 37 || y > H - 37;
    for (let x = 0; x < W; x += 1) {
      if (!band && x === 37) x = W - 37;
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
      // leaves: short diagonal strokes, lit on top
      const hk = h2(x, y, seed + 7);
      if ((x + y * 2) % 5 === 0 && hk > 0.4) i += l > -0.3 ? 1 : -1;
      else if (hk > 0.93) i += 1;
      if (bd > best.r - 1.2) i = l > 0.35 ? 4 : 1;
      px(x, y, best.P[clamp(i, 1, 7)]);
    }
  }
  // the canopy's shadow on the ground, down and to the right of it
  const on = (x, y) => x >= 0 && y >= 0 && x < W && y < H && mask[y * W + x];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      if (Math.min(x, y, W - x, H - y) > 40 || on(x, y)) continue;
      if (on(x - 1, y - 2) || on(x - 2, y - 3)) px(x, y, on(x, y - 1) ? 'rgba(18,10,30,0.45)' : 'rgba(18,10,30,0.3)');
    }
  }
  // flowers in the canopy: hibiscus and bird-of-paradise, on the lit side of a clump
  const rnd = rng(seed + 9);
  const cols = [['#e0304a', '#ff7a8a', '#ffd23f'], ['#f06aa0', '#ffb0d0', '#fff4a8'], ['#ff7a1a', '#ffb44a', '#fff4a8'], ['#ffd23f', '#fff4a8', '#f08c3a']];
  for (let n = 0; n < 260; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H); const c = cols[Math.floor(rnd() * cols.length)];
    const t = top.get(y * W + x);
    if (!t || !on(x - 1, y) || !on(x + 1, y) || !on(x, y - 1) || !on(x, y + 1)) continue;
    if ((x + 0.5 - t.cx) + (y + 0.5 - t.cy) > 2) continue;
    px(x - 1, y, c[0]); px(x + 1, y, c[0]); px(x, y - 1, c[1]); px(x, y + 1, c[0]); px(x, y, c[2]); px(x + 1, y + 1, t.P[1]);
  }
  return mask;
}

// ---------- the lava flow ----------

function lavaV(px, L, wa, seed) {
  const F = pathField([wa.pts], 30);
  const [bx, by, bw, bh] = bbox([wa.pts], 30);
  const hw = wa.w / 2;
  for (let y = Math.max(0, by); y < Math.min(L.H, by + bh); y += 1) {
    for (let x = Math.max(0, bx); x < Math.min(L.W, bx + bw); x += 1) {
      const f = F(x, y); const d = f.d;
      if (d > hw + 14) continue;
      const b = bayer(x, y);
      const bank = hw + 3.4 + (vnoise(x, y, 4, seed + 1) - 0.5) * 2.6;
      if (d < hw) {
        const u = d / hw;
        // floating crust plates with bright seams round them; more of them near the banks
        const n = vnoise(f.along * 0.9, f.off * 1.6 + 40, 6, seed + 5);
        const thr = 0.76 - u * 0.12;
        if (n > thr + 0.03 && u > 0.15) {
          let c = n > thr + 0.055 ? '#4a1a26' : '#8a3a30';
          if (n > thr + 0.055 && h2(x, y, seed) > 0.75) c = '#62262c';
          px(x, y, c);
          continue;
        }
        if (n > thr) { px(x, y, u < 0.5 ? LV[6] : LV[5]); continue; }
        // the molten flow: hotter in the middle, streaks along the way it runs
        const st = Math.sin(f.along * 0.38 + vnoise(f.along, f.off, 9, seed + 6) * 7 + f.off * 0.3);
        let i = u < 0.32 ? 5 : u < 0.62 ? 4 : u < 0.86 ? 3 : 2;
        if (st > 0.82) i += 1; else if (st < -0.8 && b < 0.6) i -= 1;
        if (u > 0.9 && b < 0.5) i = 1;
        px(x, y, LV[clamp(i, 1, 7)]);
        continue;
      }
      if (d < bank) {
        // the bank: dark basalt, its lip lit by the lava
        const k = d - hw;
        let c = vnoise(x, y, 5, seed + 2) > 0.55 ? R[3] : R[2];
        if (h2(x, y, seed + 3) > 0.9) c = R[4];
        if (k < 1.1) c = b < 0.5 ? LV[1] : '#7a2a30';
        else if (k < 2.1) c = mix(c, LV[2], 0.45);
        else if (d > bank - 1) c = R[1];
        px(x, y, c);
        continue;
      }
      // the warm glow it throws on the ground
      const g = 1 - (d - bank) / (hw + 14 - bank);
      const lvl = Math.floor(g * 3 + b - 0.5);
      if (lvl > 0) px(x, y, `rgba(255,${100 + lvl * 20},40,${(0.08 + lvl * 0.07).toFixed(2)})`);
    }
  }
  // bubbles and pops in the hottest part
  const rnd = rng(seed + 8);
  for (let i = 0; i < 26; i += 1) {
    const x = bx + Math.floor(rnd() * bw); const y = by + Math.floor(rnd() * bh); const f = F(x, y);
    if (f.d > hw * 0.5 || x < 2 || y < 100) continue;
    if (i % 3) { grid(px, x - 1, y - 1, ['.o.', 'oco', '.o.'], { o: LV[6], c: LV[4] }); } else { px(x, y, LV[7]); px(x + 1, y, LV[6]); }
  }
  return F;
}

/** The stone bridge: flagstones between parapets, a glowing stone lantern on each corner post, its shadow on the lava. */
function bridgeV(px, c) {
  const X = Math.round(c.x); const Y = Math.round(c.y); const w = Math.round(c.w); const h = Math.round(c.h);
  for (let y = Y + 3; y < Y + h - 2; y += 1) { px(X - 3, y, 'rgba(40,6,20,0.45)', 3, 1); px(X + w, y, 'rgba(40,6,20,0.55)', 4, 1); }
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const side = x < 4 || x >= w - 4;
        let col;
        if (side) {
          // parapets: capstones lit on top, joints every few
          const xx = x < 4 ? x : w - 1 - x; const joint = (y + (x < 4 ? 0 : 3)) % 7 === 0;
          col = joint ? R[2] : xx === 0 ? R[3] : xx === 3 ? R[2] : x < 4 ? '#a8a0b4' : '#8a8298';
          if (!joint && xx === 1 && x < 4) col = '#c4bece';
        } else {
          const row = Math.floor(y / 5); const v = y % 5; const off = (row % 2) * 4 + Math.floor(h2(row, 1, 5) * 3);
          const col0 = Math.floor((x + off) / 8); const u = (x + off) % 8;
          const hk = h2(col0, row, 7);
          const P = hk < 0.5 ? ['#4e4658', '#6e6678', '#8e8696', '#aaa2b0', '#c8c0cc'] : hk < 0.8 ? ['#5a4848', '#7a6460', '#9a8278', '#b89e92', '#d4bcae'] : ['#4a4a58', '#646474', '#828292', '#a0a0ae', '#c0c0cc'];
          col = v === 4 || u === 7 ? R[2] : v === 0 || u === 0 ? P[3] : v === 3 ? P[1] : P[2];
          if (Math.abs(x - w / 2) < 4 && v > 0 && v < 4 && u > 0 && u < 7 && hk < 0.6) col = P[3]; // worn smooth down the middle
        }
        b.set(x, y, col, tg('stone', R[4]));
      }
    }
    // corner posts with stone lanterns
    for (const [px0, py0] of [[-1, -3], [w - 6, -3], [-1, h - 6], [w - 6, h - 6]]) {
      for (let y = 0; y < 8; y += 1) for (let x = 0; x < 7; x += 1) b.set(px0 + x, py0 + y, y < 2 ? (x < 3 ? '#c4bece' : '#a8a0b4') : x < 2 ? '#8a8298' : x > 4 ? R[2] : R[3], tg('stone', R[4]));
      grid((x, y, cc) => b.set(x, y, cc, tg('glow', GS[2])), px0 + 2, py0 - 4, ['.r.', 'rgr', 'ryr', 'rrr'], { r: R[2], g: GS[3], y: GS[4] });
    }
  }, { outline: sel, pad: 6 });
}

// ---------- paths and the plaza ----------

const COB = [
  ['#3e3440', '#5c5058', '#7c6c70', '#9c8a88', '#bcaaa2'], // warm basalt
  ['#4a3a3a', '#6c524a', '#8e6e5e', '#ae8c76', '#ccac92'], // red tuff
  ['#38364a', '#545266', '#727084', '#9290a2', '#b4b2c2'], // grey stone
];
const MORTAR = '#2a2026';
function cobbleColor(c, seed, worn = 0) {
  if (c.mortar) return MORTAR;
  const hk = h2(c.id, c.row, seed);
  const t = COB[hk < 0.5 ? 0 : hk < 0.8 ? 1 : 2];
  let i = 2;
  if (c.v === 0 || c.u === 0) i = 3;
  if (c.v === 2 || c.u === c.w - 2) i = 1;
  if (c.v === 0 && c.u === 0) i = 2;
  if (c.v === 0 && c.u === 1 && hk > 0.5) i = 4;
  if (worn && i < 4 && hk < worn) i += 1;
  return t[i];
}

/** Flagstone paths: stones set in dark ash, edged by whole stones with the ground showing between them. */
function pathsV(px, L, seed) {
  const Rr = 6.5;
  const F = pathField(L.paths, Rr + 4);
  const [bx, by, bw, bh] = bbox(L.paths, 10);
  const inside = new Map();
  const stoneIn = (c) => {
    const k = c.cy * 4096 + c.cx * 2;
    let v = inside.get(k);
    if (v === undefined) { v = F(c.cx, c.cy).d < Rr - 0.5 + (h2(c.id, c.row, seed + 5) - 0.5) * 2.4; inside.set(k, v); }
    return v;
  };
  for (let y = Math.max(0, by); y < by + bh; y += 1) {
    for (let x = Math.max(0, bx); x < bx + bw; x += 1) {
      const f = F(x, y);
      if (f.d > Rr + 4) continue;
      const c = cobble(x, y, seed);
      if (!stoneIn(c)) { if (f.d < Rr + 2 && bayer(x, y) < 0.3) px(x, y, 'rgba(20,12,24,0.3)'); continue; }
      if (c.mortar) { if (f.d < Rr - 2.5) px(x, y, MORTAR); else if (bayer(x, y) < 0.5) px(x, y, 'rgba(20,12,24,0.35)'); continue; }
      px(x, y, cobbleColor(c, seed, Math.abs(f.off) < 2.5 ? 0.35 : 0));
    }
  }
}

/** The round fire plaza: a basalt kerb round dark pavers, and a sun of gold and orange stones in the middle. */
function plazaV(px, cx, cy, r, seed) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y += 1) {
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r + 1) continue;
      const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
      const lit = -Math.cos(a) * 0.6 - Math.sin(a) * 0.8;
      if (d > r - 3.5) {
        const seg = Math.floor(((a + Math.PI) * r) / 8);
        const joint = Math.abs(((a + Math.PI) * r) / 8 - seg) < 0.1;
        px(x, y, joint ? R[1] : d > r - 0.5 ? R[1] : d < r - 2.5 ? R[5] : lit > 0.3 ? R[5] : lit < -0.3 ? R[3] : R[4]);
        continue;
      }
      const q = ((a + Math.PI) / (Math.PI * 2)) * 8; const fr = Math.abs(q - Math.floor(q) - 0.5) * 2;
      const b = bayer(x, y);
      if (d < 5.2) { px(x, y, d < 2 && lit > -0.2 ? '#fff6c0' : lit > 0.2 ? '#ffe070' : d > 4.3 ? '#e09028' : '#ffc848'); continue; }
      if (d < 6.4) { px(x, y, '#a8401e'); continue; }
      if (fr < 0.62 * (1 - (d - 6.4) / (r - 9.5))) { const P = Math.floor(q) % 2 ? ['#c84a22', '#f0782a', '#ffa848'] : ['#a83a2a', '#e05a2a', '#ff8a4a']; px(x, y, fr > 0.5 * (1 - (d - 6.4) / (r - 9.5)) || lit < -0.3 ? P[0] : lit > 0.3 && b < 0.5 ? P[2] : P[1]); continue; }
      const c = cobble(x, y, seed);
      px(x, y, c.mortar ? MORTAR : ['#2e2a36', '#3e3846', '#4e4858', '#625a6a', '#766e7e'][c.v === 0 || c.u === 0 ? 3 : c.v === 2 ? 1 : 2]);
    }
  }
}

// ---------- the green: hot spring, obsidian rink, black-sand court ----------

function roundRect(Z, x, y, g = 0, rr = 10) {
  const x0 = Z.x - g; const y0 = Z.y - g; const x1 = Z.x + Z.w + g; const y1 = Z.y + Z.h + g; const r = Math.min(rr + g, (y1 - y0) / 2);
  const cx = clamp(x + 0.5, x0 + r, x1 - r); const cy = clamp(y + 0.5, y0 + r, y1 - r);
  return Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - r; // < 0 inside
}

/** A prismatic hot spring: travertine terraces round rings of orange, gold and green, deep blue in the middle, and wisps of steam. */
function springV(px, Z, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2;
  for (let y = Z.y - 5; y < Z.y + Z.h + 6; y += 1) {
    for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
      const s = roundRect(Z, x, y, 3, 18);
      if (s > 0.5) continue;
      const b = bayer(x, y);
      if (s > -2.5) {
        // the travertine rim, cream and white, in little scalloped terraces
        const lit = y < cy ? 1 : 0;
        px(x, y, s > -0.5 ? '#b8a48a' : lit ? (b < 0.5 ? '#fff6e4' : '#f2e6cc') : '#e2d2b4');
        continue;
      }
      const k = -s - 2.5; // depth in from the rim
      const n = (vnoise(x, y, 7, seed) - 0.5) * 2.2;
      let c;
      if (k < 2 + n * 0.5) c = MT[b < 0.5 ? 0 : 1];
      else if (k < 3.6 + n) c = MT[2];
      else if (k < 5 + n) c = MT[3];
      else if (k < 6.2 + n) c = b < 0.5 ? MT[4] : SPR[5];
      else if (k < 8.5 + n) c = SPR[4];
      else if (k < 11.5 + n) c = SPR[3];
      else if (k < 15 + n) c = SPR[2];
      else c = k < 18 ? SPR[1] : SPR[0];
      // the near rim's shadow on the water, a shine
      if (y < Z.y + 3 && k < 9 && b < 0.4) c = mix(c, '#1a1028', 0.25);
      if (h2(x, y, seed) > 0.992 && k > 7) c = SPR[6];
      px(x, y, c);
    }
  }
  // steam drifting off it
  steamWisp(px, cx - Z.w * 0.22, cy - 2, seed + 1); steamWisp(px, cx + Z.w * 0.18, cy - 4, seed + 2); steamWisp(px, cx, cy + 4, seed + 3);
}

/** A soft wisp of steam rising from (x, y). */
function steamWisp(px, x, y, seed) {
  const r = rng(seed);
  for (let k = 0; k < 4; k += 1) {
    const cx = x + Math.sin(k * 1.3 + r() * 2) * 3; const cy = y - k * 4; const rr = 1.6 + k * 0.6;
    for (let yy = Math.floor(cy - rr); yy <= cy + rr; yy += 1) {
      for (let xx = Math.floor(cx - rr); xx <= cx + rr; xx += 1) {
        if (!inEll(xx, yy, cx, cy, rr, rr * 0.8)) continue;
        if (bayer(xx, yy) < 0.25 + k * 0.12) continue;
        px(xx, yy, `rgba(255,255,255,${(0.55 - k * 0.1).toFixed(2)})`);
      }
    }
  }
}

/** An obsidian rink: black volcanic glass, purple in its depths, with bright reflections and a basalt rim, and two little nets. */
function rinkV(px, Z, seed) {
  for (let y = Z.y - 4; y < Z.y + Z.h + 5; y += 1) {
    for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
      const s = roundRect(Z, x, y, 2, 12);
      if (s > 0.5) continue;
      if (s > -2.5) { px(x, y, s > -0.5 ? R[0] : y < Z.y + Z.h / 2 ? R[4] : R[3]); continue; }
      const n = vnoise(x, y, 14, seed);
      let c = n < 0.35 ? OB[1] : n < 0.6 ? OB[2] : n < 0.8 ? OB[3] : OB[4];
      // long diagonal reflections across the glass
      const d = (x - Z.x) * 0.55 - (y - Z.y);
      const m = ((d % 26) + 26) % 26;
      if (m < 1.2) c = OB[6]; else if (m < 2.6) c = OB[5]; else if (m > 24.5 && bayer(x, y) < 0.5) c = OB[4];
      if (h2(x, y, seed + 1) > 0.994) c = OB[7];
      // a few fine cracks
      if (Math.abs(vnoise(x, y, 11, seed + 4) - 0.5) < 0.012) c = OB[0];
      px(x, y, c);
    }
  }
  const mid = Math.round(Z.y + Z.h / 2);
  for (let y = Z.y + 3; y < Z.y + Z.h - 3; y += 2) px(Z.x + Z.w / 2, y, OB[5]);
  const net = (x, dir) => {
    propB(px, x, mid - 7, 9, 14, (b) => {
      for (let y = 0; y < 14; y += 1) for (let xx = 0; xx < 9; xx += 1) {
        const post = dir > 0 ? xx === 0 : xx === 8;
        if (post || y === 0) b.set(xx, y, post ? BS[3] : BS[4], tg('wood', BS[2]));
        else if ((xx + y) % 3 === 0) b.set(xx, y, '#f4f0f8', tg('net', '#f4f0f8'));
      }
    }, { outline: sel });
  };
  net(Z.x + 2, 1); net(Z.x + Z.w - 11, -1);
}

/** A black-sand court: glittering dark sand inside a rope on bamboo posts, with bamboo goals (soccer) or posts (football). */
function courtV(px, Z, kind, seed) {
  for (let y = Z.y - 3; y < Z.y + Z.h + 4; y += 1) {
    for (let x = Z.x - 4; x < Z.x + Z.w + 4; x += 1) {
      const s = roundRect(Z, x, y, 2, 10);
      if (s > 1.5) continue;
      const b = bayer(x, y);
      if (s > -2) { if (s < 0.5 || b < (1.5 - s) / 2) px(x, y, s > 0 ? '#a8987e' : s > -1 ? '#e6d6b4' : '#cfbd98'); continue; }
      const n = vnoise(x, y, 9, seed) * 0.6 + vnoise(x, y, 3, seed + 1) * 0.4;
      let c = n < 0.38 ? SA[2] : n > 0.62 ? SA[4] : SA[3];
      const hk = h2(x, y, seed + 2);
      if (hk > 0.996) c = '#e8e0ff'; else if (hk > 0.99) c = SA[5];
      // wind ripples across it
      const rp = Math.sin((y - Z.y) * 0.9 + vnoise(x, y, 12, seed + 3) * 5);
      if (rp > 0.86) c = SA[4]; else if (rp < -0.9 && b < 0.6) c = SA[2];
      px(x, y, c);
    }
  }
  // the rope round it on little bamboo posts
  const posts = [];
  for (let x = Z.x; x <= Z.x + Z.w; x += Math.round(Z.w / 5)) posts.push([x, Z.y - 2], [x, Z.y + Z.h + 1]);
  for (let x = Z.x; x < Z.x + Z.w; x += 1) { px(x, Z.y - 3 + (Math.abs(((x - Z.x) % 20) - 10) > 8 ? 0 : 1), '#e8c890'); px(x, Z.y + Z.h + (Math.abs(((x - Z.x) % 20) - 10) > 8 ? 0 : 1), '#e8c890'); }
  posts.forEach(([x, y]) => { px(x, y - 3, BS[4], 1, 4); px(x + 1, y - 3, BS[2], 1, 4); px(x, y + 1, INK, 2, 1); });
  const mid = Math.round(Z.y + Z.h / 2);
  if (kind === 'football') {
    for (const gx of [Z.x + 5, Z.x + Z.w - 8]) {
      propB(px, gx - 5, mid - 18, 13, 22, (b) => {
        for (let y = 0; y < 22; y += 1) { b.set(5, y, BS[4], tg('wood', BS[3])); b.set(6, y, BS[2], tg('wood', BS[3])); if (y % 5 === 2) { b.set(5, y, BS[1]); b.set(6, y, BS[1]); } }
        for (let x = 0; x < 13; x += 1) { b.set(x, 8, BS[4], tg('wood', BS[3])); b.set(x, 9, BS[2], tg('wood', BS[3])); }
        for (let y = 0; y < 9; y += 1) { b.set(0, y, BS[4], tg('wood', BS[3])); b.set(12, y, BS[3], tg('wood', BS[3])); }
      }, { outline: sel });
    }
  } else {
    for (const [gx, dir] of [[Z.x + 1, 1], [Z.x + Z.w - 9, -1]]) {
      propB(px, gx, mid - 8, 8, 16, (b) => {
        for (let y = 0; y < 16; y += 1) for (let x = 0; x < 8; x += 1) {
          const frame = y === 0 || (dir > 0 ? x === 0 : x === 7);
          if (frame) b.set(x, y, y === 0 ? BS[4] : BS[3], tg('wood', BS[3]));
          else if ((x + y) % 3 === 0) b.set(x, y, '#f4eee0', tg('net', '#f4eee0'));
        }
      }, { outline: sel });
    }
    // a coconut for a ball? no: a proper ball in the middle
    grid(px, Z.x + Z.w / 2 - 2, mid - 2, ['.ww.', 'wkww', 'wwkw', '.ww.'], { w: '#ffffff', k: '#2e2238' });
  }
}

// ---------- the volcano ----------

const VC = ['#24182a', '#3a2834', '#52363e', '#6c464a', '#885a56', '#a67262', '#c48e76', '#dcae90']; // the volcano's warm rock

/** The big volcano: a broad cone of warm rock lit from the left, ledges and gullies, a wide glowing crater whose lava spills over the rim in drips, one running down into the flow. */
function volcanoV(px, X, Y) {
  const Wv = 120; const cx = 60; const top = 12; const base = 89;
  const hw = (y) => 17 + 43 * ((y - top) / (base - top)) ** 0.92;
  // where the lava runs: the main channel (down to the flow at the foot) and short drips off the rim
  const mainF = pathField([[[56, 14], [53, 24], [50, 34], [51, 44], [47, 56], [44, 68], [41, 80], [40, 95]]], 10);
  const drips = [[44, 15, 13], [50, 16, 7], [63, 16, 10], [69, 15, 18], [75, 14, 8]].map(([x, y, len]) => ({ x, y, len, F: pathField([[[x, y], [x + (x - cx) * 0.18, y + len]]], 5) }));
  propB(px, X, Y, Wv, 92, (b) => {
    for (let y = top - 1; y < base + 4; y += 1) {
      for (let x = 0; x < Wv; x += 1) {
        const hy = hw(Math.max(y, top));
        if (Math.abs(x + 0.5 - cx) > hy + (vnoise(x, y, 5, 7) - 0.5) * 3) continue;
        if (y > base - 2 + (vnoise(x, 0, 5, 8) - 0.5) * 7) continue;
        const u = (x + 0.5 - cx) / hy; const v = (y - top) / (base - top);
        const ang = Math.atan2(x + 0.5 - cx, y - top + 14);
        const g = Math.sin(ang * 20 + vnoise(x, y, 12, 3) * 4);
        let i = u < -0.6 ? 6 : u < -0.2 ? 5 : u < 0.25 ? 4 : u < 0.62 ? 3 : 2;
        if (g > 0.8) i += 1; else if (g < -0.78) i -= 1;
        // ledges: broken dark lines across the slope with a lit lip above
        const ly = (y + Math.round(vnoise(x, 2, 7, 4) * 4)) % 13;
        if (ly === 0 && vnoise(x, y, 6, 5) > 0.55) i -= 1; else if (ly === 12 && vnoise(x, y + 1, 6, 5) > 0.55) i += 1;
        const hk = h2(x, y, 11);
        if (hk > 0.965) i += 1; else if (hk < 0.03) i -= 1;
        let c = VC[clamp(i, 0, 7)];
        // moss and ferns on the lower slopes
        const veg = vnoise(x, y, 5, 5) * 0.8 + v * 0.55 + h2(x >> 1, y >> 1, 6) * 0.2;
        if (veg > 1.08 && v > 0.45) c = J[clamp((u < -0.3 ? 5 : u < 0.3 ? 4 : 3) + (hk > 0.8 ? 1 : 0) - (veg < 1.11 ? 1 : 0), 1, 7)];
        // the lava's warm light on the rock beside it
        const fr = Math.min(mainF(x, y).d, ...drips.map((d) => d.F(x, y).d + 1.5));
        if (fr < 6 && bayer(x, y) < (6 - fr) / 7) c = mix(c, LV[2], 0.35);
        b.set(x, y, c, tg('rock', VC[3]));
      }
    }
    // the lava: the main channel, wider as it goes, and the drips with round ends
    for (let y = top; y < 94; y += 1) {
      for (let x = 20; x < 100; x += 1) {
        if (!b.get(x, y)) continue;
        const f = mainF(x, y); const wv = 1.8 + (y - top) * 0.04;
        if (f.d < wv + 1) {
          const u = f.d / wv; const st = Math.sin(f.along * 0.6 + f.off) > 0.55;
          b.set(x, y, u > 1 ? '#5a1626' : u > 0.62 ? LV[3] : st ? LV[6] : LV[5], tg('glow', LV[4]));
          continue;
        }
        for (const d of drips) {
          const f2 = d.F(x, y); const t = f2.along / d.len; const wd = 2.1 - t * 0.5;
          if (f2.d < wd + 1 && t < 1.08) { b.set(x, y, f2.d > wd ? '#5a1626' : f2.d > wd * 0.5 ? (t > 0.7 ? LV[2] : LV[3]) : (t > 0.75 ? LV[3] : LV[5]), tg('glow', LV[4])); break; }
        }
      }
    }
    // the crater: a wide lit rim round a glowing pool
    for (let y = 5; y < 22; y += 1) {
      for (let x = cx - 20; x < cx + 20; x += 1) {
        if (!inEll(x, y, cx, 13, 17.5, 5.4)) continue;
        if (inEll(x, y, cx, 13.8, 14, 3.6)) {
          const d = ((x + 0.5 - cx) / 14) ** 2 + ((y + 0.5 - 13.8) / 3.6) ** 2;
          b.set(x, y, y < 12 ? (bayer(x, y) < 0.5 ? LV[2] : LV[1]) : d < 0.25 ? LV[6] : d < 0.6 ? LV[5] : LV[4], tg('glow', LV[4]));
        } else b.set(x, y, y < 12 ? (x < cx ? VC[7] : VC[6]) : y > 15 ? VC[3] : VC[5], tg('rock', VC[3]));
      }
    }
  }, { outline: sel, pad: 4 });
  // bushes round its foot, so it rises out of the jungle
  [[4, 85, 7], [14, 89, 6], [106, 89, 6], [116, 85, 7]].forEach(([x, y, r], i) => clumpV(px, X + x, Y + y, r, CANOPY[i % 3], i));
  // a puff of steam from the crater drifting right
  puffs(px, X + cx + 4, Y + 4, [[0, 0, 3.6], [7, -5, 4.4], [14, -8, 3.8], [20, -9, 2.6]]);
}

/** Soft round puffs of steam: [dx, dy, r]. */
function puffs(px, X, Y, list) {
  list.forEach(([dx, dy, r]) => {
    const cx = X + dx; const cy = Y + dy;
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      if (inEll(x, y, cx, cy, r, r * 0.85)) {
        const s = (x + 0.5 - cx) + (y + 0.5 - cy);
        px(x, y, s > r * 0.5 ? STM[1] : s < -r * 0.6 ? STM[3] : STM[2]);
      } else if (inEll(x, y, cx, cy, r + 1, r * 0.85 + 1)) px(x, y, 'rgba(160,150,180,0.5)');
    }
  });
}

/** A round leafy clump of jungle, outlined. */
function clumpV(px, cx, cy, r, P, seed) {
  propB(px, Math.round(cx - r), Math.round(cy - r), Math.ceil(r * 2), Math.ceil(r * 2), (b) => {
    for (let y = 0; y < r * 2; y += 1) for (let x = 0; x < r * 2; x += 1) {
      const dx = (x + 0.5 - r) / r; const dy = (y + 0.5 - r) / r;
      if (dx * dx + dy * dy > 1 - (h2(x, y, seed) > 0.85 ? 0.12 : 0)) continue;
      const l = -(dx * 0.6 + dy * 0.8);
      let i = l > 0.45 ? 6 : l > 0.1 ? 5 : l > -0.3 ? 4 : 3;
      if ((x + y * 2) % 5 === 0 && h2(x, y, seed + 1) > 0.4) i += l > -0.2 ? 1 : -1;
      b.set(x, y, P[clamp(i, 1, 7)], tg('leaf', P[3]));
    }
  }, { outline: sel, pad: 2 });
}

// ---------- huts ----------

/**
 * A tiki hut: a tall thatched roof with crossed poles at the ridge, bamboo walls, round glowing
 * windows, a doorway hung with a curtain, on a basalt plinth. o.kid: the kid's own (roof, curtain,
 * bunting and tiki shield in their color); o.sign 'note': the music hall (a drum and a note).
 */
function hutV(px, X, Y, w, h, o = {}) {
  const P = ramp(o.roof || '#2f9e44', 3, 2);
  const wallTop = Math.round(h * 0.46); const baseY = h - 6; const eave = wallTop + 6;
  const rx0 = Math.round(w * 0.3); const rx1 = Math.round(w * 0.7);
  groundShadow(px, X + w / 2, Y + h - 1, w / 2 + 3, 4, 0.28);
  const OX = 8; const OY = 14;
  propB(px, X - OX, Y - OY, w + OX * 2, h + OY, (b) => {
    const set = (x, y, c, t) => b.set(x + OX, y + OY, c, t);
    // the plinth
    for (let y = baseY; y < h; y += 1) for (let x = 3; x < w - 3; x += 1) {
      const row = Math.floor((y - baseY) / 3); const off = row * 5; const u = (x + off) % 10;
      set(x, y, u === 9 ? R[1] : (y - baseY) % 3 === 0 ? R[4] : (y - baseY) % 3 === 2 ? R[2] : R[3], tg('stone', R[3]));
    }
    // bamboo walls
    for (let y = wallTop; y < baseY; y += 1) for (let x = 8; x < w - 8; x += 1) {
      const k = Math.floor((x - 8) / 3); const p = (x - 8) % 3;
      let c = p === 0 ? BS[4] : p === 1 ? BS[3] : BS[2];
      if ((y + k * 3) % 8 === 0) c = BS[1];
      if (y - wallTop === Math.round((baseY - wallTop) * 0.35) || y - wallTop === Math.round((baseY - wallTop) * 0.8)) c = p === 1 ? '#e8c890' : '#b08850';
      if (y < eave + 3) c = mix(c, '#3a2030', 0.45 - (y - eave) * 0.1);
      set(x, y, c, tg('wood', BS[2]));
    }
    // round windows glowing warm
    const wy = Math.round((wallTop + baseY) / 2) + 2;
    for (const wx of [Math.round(w * 0.22), Math.round(w * 0.78)]) {
      for (let y = wy - 6; y <= wy + 6; y += 1) for (let x = wx - 6; x <= wx + 6; x += 1) {
        const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
        if (d > 5.6) continue;
        if (d > 4.2) { set(x, y, (x + y) < wx + wy ? BS[5] : BS[2], tg('wood', BS[2])); continue; }
        let c = (x - wx) - (y - wy) > 2 ? GS[3] : (y > wy + 1 ? GS[1] : GS[2]);
        if (x === wx || y === wy) c = BS[1];
        set(x, y, c, tg('glow', GS[2]));
      }
    }
    // the doorway and its curtain
    const dx0 = Math.round(w / 2 - 7); const dTop = baseY - 22;
    for (let y = dTop; y < baseY; y += 1) for (let x = dx0 - 1; x < dx0 + 15; x += 1) {
      const top = dTop + (Math.abs(x + 0.5 - w / 2) > 5 ? Math.abs(x + 0.5 - w / 2) - 5 : 0) * 1.2;
      if (y < top) continue;
      const frame = x === dx0 - 1 || x === dx0 + 14 || y < top + 1;
      if (frame) { set(x, y, x === dx0 + 14 ? Wd[1] : Wd[3], tg('wood', Wd[2])); continue; }
      const strand = (x - dx0) % 2;
      const len = baseY - 3 - Math.round(Math.abs(x + 0.5 - w / 2) * 0.5);
      let c = '#3a2228';
      if (y < len) {
        const kc = o.kid ? [P[4], '#fff4e0', P[3], '#fff4e0'] : ['#d8b070', '#b08850', '#e8c890', '#9a7040'];
        c = kc[(Math.floor((y - dTop) / 3) + strand) % 4];
        if (strand && y % 2) c = mix(c, '#3a2228', 0.25);
      }
      set(x, y, c, tg('door', Wd[2]));
    }
    // a step to the door
    for (let x = dx0 - 2; x < dx0 + 16; x += 1) { set(x, h - 2, R[5], tg('stone', R[3])); set(x, h - 1, R[3], tg('stone', R[3])); }
    // the thatched roof, row upon row, each row's fringe over the next
    for (let y = 1; y <= eave; y += 1) {
      const t = ((y - 1) / (eave - 1)) ** 0.92;
      const xl = rx0 + (-5 - rx0) * t; const xr = rx1 + (w + 5 - rx1) * t;
      for (let x = Math.floor(xl); x < Math.ceil(xr); x += 1) {
        const u = (x + 0.5 - (xl + xr) / 2) / ((xr - xl) / 2);
        // rows of thatch 8 high; each bundle of straw hangs a little lower or higher than the next
        const j = Math.floor(h2(x >> 1, 7, 3) * 3);
        const fromEave = eave - y + j; const row = Math.floor(fromEave / 8); const ry = fromEave % 8;
        let i = u < -0.45 ? 4 : u < 0.45 ? 3 : 2;
        const hs = h2(x, row, 5);
        if (ry === 7) i = h2(x, row, 6) < 0.6 ? 1 : i - 1; // the shadow under the row above
        else if (ry === 6) i -= hs < 0.5 ? 1 : 0;
        else if (ry <= 1) i += (x + row) % 2 ? 1 : 0; // the straw ends, catching the light
        else if (hs < 0.3) i -= 1; // long strands
        else if (hs > 0.82) i += 1;
        set(x, y, P[clamp(i, 0, 5)], tg('thatch', P[2]));
      }
    }
    // a ragged fringe along the eave
    for (let x = -5; x < w + 5; x += 1) { const n = 1 + Math.floor(h2(x, 1, 9) * 3); for (let k = 1; k <= n; k += 1) set(x, eave + k, k === n ? P[1] : P[2], tg('thatch', P[2])); }
    // the ridge, rolled and lashed, with crossed poles at each end
    for (let x = rx0 - 2; x < rx1 + 2; x += 1) { set(x, -1, P[4], tg('thatch', P[2])); set(x, 0, P[3], tg('thatch', P[2])); set(x, 1, P[2], tg('thatch', P[2])); if (x % 6 === 0) { set(x, 0, BS[1]); set(x, 1, BS[1]); } }
    for (const ex of [rx0 - 1, rx1]) {
      line(ex - 4, 2, ex + 5, -9, (x, y) => { set(x, y, Wd[3], tg('wood', Wd[2])); set(x + 1, y, Wd[2], tg('wood', Wd[2])); });
      line(ex + 4, 2, ex - 5, -9, (x, y) => { set(x, y, Wd[4], tg('wood', Wd[2])); set(x + 1, y, Wd[2], tg('wood', Wd[2])); });
      set(ex, -2, BS[1]); set(ex + 1, -2, BS[1]);
    }
    if (o.kid) {
      // carved tiki posts at the corners
      for (const px0 of [5, w - 9]) for (let y = eave - 2; y < baseY; y += 1) for (let x = 0; x < 4; x += 1) {
        const yy = y - eave; let c = x === 0 ? Wd[4] : x === 3 ? Wd[1] : Wd[3];
        if ((yy === 5 || yy === 17) && (x === 1 || x === 2)) c = '#fff4e0';
        if ((yy === 9 || yy === 21) && x > 0 && x < 3) c = Wd[0];
        if (yy % 12 === 0) c = Wd[1];
        set(px0 + x, y, c, tg('wood', Wd[2]));
      }
      // the tiki shield over the door, in the kid's color
      const sx = Math.round(w / 2); const sy = dTop - 6;
      for (let y = sy - 6; y <= sy + 6; y += 1) for (let x = sx - 5; x <= sx + 5; x += 1) {
        if (!inEll(x, y, sx, sy, 5.2, 6.6)) continue;
        const r2 = ((x + 0.5 - sx) / 5.2) ** 2 + ((y + 0.5 - sy) / 6.6) ** 2;
        set(x, y, r2 > 0.62 ? P[1] : (x < sx ? P[4] : P[3]), tg('wood', P[2]));
      }
      grid((x, y, c) => set(x, y, c), sx - 3, sy - 3, ['ww.ww', 'wk.kw', '.....', '.www.', 'w.w.w', '.www.'], { w: '#fff4e0', k: '#2e2238' });
    }
    if (o.sign === 'note') {
      // a round sign with a note over the door
      const sx = Math.round(w / 2); const sy = dTop - 6;
      for (let y = sy - 6; y <= sy + 6; y += 1) for (let x = sx - 6; x <= sx + 6; x += 1) { const d = Math.hypot(x + 0.5 - sx, y + 0.5 - sy); if (d < 6.2) set(x, y, d > 5 ? Wd[1] : d > 4 ? Wd[4] : Wd[3], tg('wood', Wd[2])); }
      grid((x, y, c) => set(x, y, c), sx - 2, sy - 4, ['..yy', '..yY', '..y.', '..y.', 'yyy.', 'yyy.'], { y: '#ffd23f', Y: '#fff4a8' });
    }
    // a pole with a pennant at the peak
    if (o.kid) {
      const fx = Math.round(w / 2);
      for (let y = -12; y < -1; y += 1) set(fx, y, Wd[3], tg('wood', Wd[2]));
      grid((x, y, c) => set(x, y, c, tg('cloth', P[3])), fx + 1, -12, ['ppppp', 'pPPPpppp', 'pppppp', 'ppp'], { p: P[3], P: P[5] });
    }
  }, { outline: sel });
  if (o.kid) {
    // bunting along the eave in the kid's color
    const by = Y + eave + 2; const P2 = ramp(o.roof, 3, 2);
    for (let x = X - 2; x < X + w + 2; x += 1) px(x, by + Math.round(Math.sin(((x - X) / (w + 4)) * Math.PI * 2) * 1.2 + 1), '#6a4a3a');
    for (let k = 0; k < 9; k += 1) {
      const fx = X + 2 + Math.round((k * (w - 8)) / 8); const fy = by + Math.round(Math.sin(((fx - X) / (w + 4)) * Math.PI * 2) * 1.2 + 1) + 1;
      grid(px, fx - 2, fy, ['ccccc', '.ccc.', '..c..'], { c: k % 2 ? '#fff4e0' : P2[4] });
      px(fx - 2, fy, k % 2 ? '#d8c8b0' : P2[2], 1, 1);
    }
  }
  if (o.sign === 'note') {
    // a pair of island drums by the door
    drumsV(px, X + Math.round(w / 2) + 12, Y + h - 12);
  }
}

function drumsV(px, X, Y) {
  propB(px, X, Y, 14, 12, (b) => {
    for (const [cx, r, hgt] of [[3.5, 3.5, 10], [10, 3, 8]]) {
      for (let y = 12 - hgt; y < 12; y += 1) for (let x = Math.floor(cx - r); x < cx + r; x += 1) {
        const top = y < 12 - hgt + 2;
        const u = (x + 0.5 - cx) / r;
        b.set(x, y, top ? (u < 0 ? '#f4e6c8' : '#dcc8a4') : (y % 4 === 1 ? '#e8c890' : u < -0.3 ? Wd[4] : u > 0.4 ? Wd[2] : Wd[3]), tg('wood', Wd[2]));
      }
    }
  }, { outline: sel, pad: 2 });
}

// ---------- props ----------

/** A coconut palm: a curved ringed trunk, a crown of feathery fronds, coconuts. */
function palmV(px, X, Y, flip = false) {
  groundShadow(px, X + 18, Y + 42, 10, 2.6, 0.24);
  propB(px, X - 4, Y - 6, 44, 52, (b) => {
    const set = (x, y, c, t) => b.set(flip ? 39 - x : x, y, c, t);
    // trunk from (22, 48) up to (24, 18), leaning
    for (let k = 0; k <= 30; k += 1) {
      const t = k / 30; const x = 22 + Math.sin(t * 1.4) * 4 - t * 2; const y = 48 - t * 30;
      const ring = k % 3 === 0;
      for (let dx = -2; dx <= 2; dx += 1) set(Math.round(x + dx), Math.round(y), ring ? Wd[1] : dx < 0 ? Wd[4] : dx > 0 ? Wd[2] : Wd[3], tg('wood', Wd[2]));
    }
    // fronds
    const cx = 24; const cy = 17;
    const fr = [[-17, 4], [-13, -7], [-3, -12], [9, -10], [17, -2], [15, 8], [-9, 9]];
    fr.forEach(([ex, ey], n) => {
      const len = Math.hypot(ex, ey);
      for (let k = 0; k <= len * 1.5; k += 1) {
        const t = k / (len * 1.5);
        const x = cx + ex * t; const y = cy + ey * t + Math.sin(t * Math.PI) * -2 + t * t * 6;
        set(Math.round(x), Math.round(y), J[5], tg('leaf', J[4]));
        // leaflets hanging off both sides
        if (k % 2 === 0 && t > 0.15) {
          const nx = -ey / len; const ny = ex / len; const ll = (1 - t) * 4 + 1.5;
          for (const s of [-1, 1]) for (let q = 1; q <= ll; q += 1) set(Math.round(x + nx * q * s * 0.8), Math.round(y + Math.abs(ny * q * s) * 0.7 + q * 0.6), q > ll - 1 ? J[3] : n % 2 ? J[5] : J[4], tg('leaf', J[4]));
        }
      }
    });
    // coconuts
    grid((x, y, c) => set(x, y, c, tg('wood', Wd[2])), cx - 4, cy - 1, ['.bb.bb.', 'bBbbBbb', 'bbb.bbb', '..bb...', '.bBb...', '..b....'], { b: '#6a4a2a', B: '#a8784a' });
  }, { outline: sel, pad: 3 });
}

/** A tiki torch: a bamboo pole bound with cord, a bowl, and its flame. */
function torchV(px, X, Y) {
  groundShadow(px, X + 5, Y + 31, 4, 1.4, 0.22);
  // its warm light on the ground
  for (let y = Y + 22; y < Y + 36; y += 1) for (let x = X - 6; x < X + 16; x += 1) if (inEll(x, y, X + 5, Y + 30, 11, 5) && bayer(x, y) < 0.35) px(x, y, 'rgba(255,170,60,0.18)');
  propB(px, X, Y, 10, 32, (b) => {
    for (let y = 10; y < 32; y += 1) { b.set(4, y, BS[4], tg('wood', BS[2])); b.set(5, y, BS[3], tg('wood', BS[2])); b.set(6, y, BS[2], tg('wood', BS[2])); if (y % 6 === 4) { b.set(4, y, BS[1]); b.set(5, y, BS[1]); b.set(6, y, BS[1]); } }
    for (let y = 12; y < 16; y += 1) for (let x = 3; x < 8; x += 1) if ((x + y) % 2) b.set(x, y, '#c8a070', tg('wood', BS[2]));
    grid((x, y, c) => b.set(x, y, c, tg('wood', Wd[2])), 2, 8, ['wwwwww', '.wWWw.', '..ww..'], { w: Wd[2], W: Wd[4] });
    grid((x, y, c) => b.set(x, y, c, tg('glow', LV[4])), 2, 0, ['..o...', '..oo..', '.oyo..', '.oyyo.', 'oyWyoo', 'oyWWyo', '.oyyo.', '..oo..'], { o: LV[3], y: LV[5], W: LV[7] });
  }, { outline: sel, pad: 2 });
}

/** A basalt boulder with moss on its crown and a fern at its foot (w x h). */
function boulderV(px, X, Y, w, h, seed = 3) {
  groundShadow(px, X + w / 2 + 2, Y + h - 2, w / 2, h * 0.18, 0.25);
  propB(px, X, Y, w, h, (b) => {
    const cx = w / 2; const cy = h * 0.55; const rx = w / 2 - 1; const ry = h * 0.45;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry;
      const dd = dx * dx + dy * dy + (vnoise(x, y, 4, seed) - 0.5) * 0.25;
      if (dd > 1 || y + 0.5 > h - 1) continue;
      const l = -(dx * 0.6 + dy * 0.8);
      let c = R[l > 0.45 ? 5 : l > 0.1 ? 4 : l > -0.3 ? 3 : 2];
      if (h2(x, y, seed) > 0.9) c = R[2];
      if (dy < -0.5 && vnoise(x, y, 5, seed + 1) > 0.56) c = l > 0.3 ? GL[5] : GL[4];
      b.set(x, y, c, tg('stone', R[3]));
    }
    grid((x, y, c) => b.set(x, y, c, tg('leaf', GL[3])), 1, h - 6, ['l..l..', '.ll.l.', 'lLlLl.', '.lll..'], { l: GL[4], L: GL[5] });
  }, { outline: sel, pad: 2 });
}

/** A fumarole: a ring of sulfur-crusted rocks round a glowing crack, and a puff of steam. */
function ventV(px, X, Y) {
  propB(px, X, Y, 16, 10, (b) => {
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < 16; x += 1) {
      if (!inEll(x, y, 8, 5.5, 8, 4.5)) continue;
      const inner = inEll(x, y, 8, 5.5, 4.5, 2.2);
      let c = inner ? (y < 5 ? R[0] : LV[3]) : (h2(x, y, 4) > 0.55 ? '#f6d64a' : y < 5 ? R[4] : R[2]);
      if (inner && y >= 6 && x > 6 && x < 10) c = LV[5];
      b.set(x, y, c, tg(inner ? 'glow' : 'stone', R[3]));
    }
  }, { outline: sel, pad: 2 });
  puffs(px, X + 9, Y - 2, [[0, 0, 2.2], [2, -5, 2.8], [5, -10, 2.2]]);
}

/** The fruit stall: bamboo posts, a striped awning, a counter heaped with pineapples, bananas, mangoes and coconuts. */
function stallV(px, X, Y, pal = {}) {
  const a = pal.a || '#ff922b'; const c2 = pal.b || '#fff3bf';
  const Pa = ramp(a, 2, 1); const Pb = ramp(c2, 2, 1);
  groundShadow(px, X + 22, Y + 31, 22, 3, 0.25);
  propB(px, X, Y, 44, 33, (b) => {
    for (const x of [2, 40]) for (let y = 6; y < 33; y += 1) { b.set(x, y, BS[4], tg('wood', BS[2])); b.set(x + 1, y, BS[2], tg('wood', BS[2])); if (y % 6 === 0) { b.set(x, y, BS[1]); b.set(x + 1, y, BS[1]); } }
    // the counter
    for (let y = 20; y < 33; y += 1) for (let x = 3; x < 41; x += 1) {
      const top = y < 22; const k = Math.floor((x - 3) / 3);
      b.set(x, y, top ? (y === 20 ? Wd[4] : Wd[3]) : (x - 3) % 3 === 2 ? BS[1] : (k % 2 ? BS[3] : BS[4]), tg('wood', Wd[2]));
    }
    // fruit on the counter
    grid((x, y, c) => b.set(x, y, c, tg('fruit', '#c88a2a')), 5, 13, [
      '..g.......yy..............rr.........',
      '.ggg.....yyyy....oo......rRrr...bb...',
      '.ppp....yy..yy..oOoo.....rrrr..bBbb..',
      'pPpp...yy....y..oooo..gg..rr...bbbb..',
      'pppP..........y..oo..gGgg.......bb...',
      '.pPp................gggg.............',
      '.ppp.................gg..............',
    ], { g: '#3a9a48', p: '#e8a83a', P: '#ffd060', y: '#ffd23f', o: '#ff8a2a', O: '#ffc070', r: '#e83a5a', R: '#ff9ab0', b: '#7a4a2a', B: '#b07a4a' });
    // the awning: stripes, scalloped hem
    for (let y = 0; y < 10; y += 1) for (let x = 0; x < 44; x += 1) {
      const stripe = Math.floor(x / 5) % 2;
      const hem = y >= 7 && Math.hypot(((x % 5) + 0.5) - 2.5, y - 7) > 2.6;
      if (hem) continue;
      const P = stripe ? Pb : Pa;
      b.set(x, y, y === 0 ? P[3] : y < 3 ? P[2] : P[1], tg('cloth', P[1]));
    }
  }, { outline: sel });
}

// ---------- island whimsy ----------

/** A capybara soaking in a little rock hot tub, a yuzu on its head, steam rising (44 x 28). */
export function spaV(px, X, Y) {
  propB(px, X, Y, 44, 28, (b) => {
    for (let y = 4; y < 28; y += 1) for (let x = 0; x < 44; x += 1) {
      if (!inEll(x, y, 22, 16, 22, 11.5)) continue;
      const inner = inEll(x, y, 22, 16.5, 17, 7.5);
      if (!inner) { const l = y < 16 ? (x < 22 ? 5 : 4) : 3; b.set(x, y, h2(x, y, 3) > 0.85 ? R[l - 1] : R[l], tg('stone', R[3])); continue; }
      const d = ((x + 0.5 - 22) / 17) ** 2 + ((y + 0.5 - 16.5) / 7.5) ** 2;
      b.set(x, y, y < 12 ? SPR[2] : d > 0.7 ? SPR[4] : d > 0.35 ? SPR[3] : SPR[2], tg('water', SPR[3]));
    }
    // the capybara, up to its chin in the water, a yuzu on its head
    grid((x, y, c) => b.set(x, y, c, tg('fur', '#a0683a')), 12, 3, [
      '......yy.........',
      '.....yYyy........',
      '...bbbbbbb.e.....',
      '..bBBBBBBBbe.....',
      '.bBBkBBBBBBBbbbb.',
      'bBBBBBBBBBBBBBBBb',
      'nBBBBBBBBBBBBBBBb',
      'NnbBBBBBBBBBBBBbb',
      '.wwwwwwwwwwwwwwww',
    ], { b: '#8a5430', B: '#b07a48', k: '#2e2238', e: '#6a3a24', n: '#5a3424', N: '#3a2018', y: '#f6c42a', Y: '#fff08a', w: SPR[5] });
    b.set(15, 6, '#fff4e0');
  }, { outline: sel, pad: 4 });
  steamWisp(px, X + 8, Y + 12, 4); steamWisp(px, X + 37, Y + 14, 5);
}

/** A tiki totem: three carved faces stacked, painted, with feathers on top (14 x 36). */
export function totemV(px, X, Y) {
  groundShadow(px, X + 8, Y + 35, 7, 1.6, 0.25);
  propB(px, X, Y, 14, 36, (b) => {
    const faces = [['#e8742a', '#ffb05a'], ['#3aa0a8', '#7ad0cc'], ['#d84a4a', '#ff8a7a']];
    for (let y = 6; y < 36; y += 1) for (let x = 1; x < 13; x += 1) {
      const k = Math.floor((y - 6) / 10); const v = (y - 6) % 10;
      let c = x < 4 ? Wd[4] : x > 10 ? Wd[2] : Wd[3];
      if (v === 0) c = Wd[1];
      if (v === 3 && (x === 3 || x === 4 || x === 9 || x === 10)) c = faces[k][1];
      if (v === 4 && (x === 4 || x === 9)) c = '#2e2238';
      if (v === 4 && (x === 3 || x === 10)) c = faces[k][0];
      if ((v === 6 || v === 7) && x >= 4 && x <= 9) c = v === 6 ? '#fff4e0' : faces[k][0];
      if (v === 7 && (x === 5 || x === 8)) c = '#fff4e0';
      if (v === 2 && x >= 3 && x <= 10) c = Wd[1];
      b.set(x, y, c, tg('wood', Wd[2]));
    }
    grid((x, y, c) => b.set(x, y, c, tg('cloth', '#e83a5a')), 1, 0, ['r..y..g..b', '.r.y.g..b.', '..ryg.bb..', '...rybg...', '..WWWWWW..', '.WWWWWWWW.'], { r: '#e83a5a', y: '#ffd23f', g: '#3ab060', b: '#4a8ae8', W: Wd[3] });
  }, { outline: sel, pad: 2 });
}

/** A dodo, round and pleased with itself (16 x 16). */
export function dodoV(px, X, Y) {
  groundShadow(px, X + 8, Y + 15, 6, 1.4, 0.25);
  propB(px, X, Y, 16, 16, (b) => {
    grid((x, y, c) => b.set(x, y, c, tg('fur', '#8a8aa8')), 0, 0, [
      '...hhh..........',
      '..hhhhh.........',
      '..hkhhh.........',
      'yyyhhhh.........',
      'Yyyyhhh.........',
      '.YY.hhhgggg.....',
      '....hgggggggg...',
      '...ggGGGGGgggt..',
      '...gGGGGGggggtt.',
      '...gGGGGggggggtt',
      '...ggGGgggggggt.',
      '....gggggggggg..',
      '.....gggggggg...',
      '......o...o.....',
      '......o...o.....',
      '.....oo..oo.....',
    ], { h: '#b8b4cc', k: '#2e2238', y: '#ffd23f', Y: '#e8a020', g: '#8a86a6', G: '#aeaac6', t: '#f4f0f8', o: '#f0a030' });
  }, { outline: sel, pad: 2 });
}

/** A cluster of obsidian crystals, glossy purple-black, with a glint (20 x 18). */
export function crystalsV(px, X, Y) {
  groundShadow(px, X + 10, Y + 16, 9, 2, 0.25);
  propB(px, X, Y, 20, 18, (b) => {
    const xs = [[3, 8, 2.5], [9, 1, 3.5], [15, 6, 2.6], [6, 11, 2], [13, 12, 2]];
    xs.forEach(([cx, top, hw]) => {
      for (let y = top; y < 18; y += 1) {
        const tip = y < top + hw * 1.6;
        const half = tip ? ((y - top) / (hw * 1.6)) * hw : hw;
        for (let x = Math.floor(cx - half); x <= cx + half; x += 1) {
          const u = (x + 0.5 - cx) / (hw + 0.01);
          b.set(x, y, Math.abs(u + 0.25) < 0.18 ? OB[6] : u < -0.4 ? OB[5] : u < 0.1 ? OB[3] : OB[2], tg('glass', OB[3]));
        }
      }
      b.set(Math.round(cx - hw * 0.5), top + Math.round(hw * 1.6) + 1, OB[7]);
    });
  }, { outline: sel, pad: 2 });
}

/** A campfire in a ring of stones, with marshmallows on sticks toasting over it (30 x 22). */
export function campfireV(px, X, Y) {
  for (let y = Y + 4; y < Y + 26; y += 1) for (let x = X - 6; x < X + 36; x += 1) if (inEll(x, y, X + 15, Y + 16, 20, 9) && bayer(x, y) < 0.3) px(x, y, 'rgba(255,160,60,0.2)');
  propB(px, X, Y, 30, 22, (b) => {
    // the stone ring
    for (let k = 0; k < 10; k += 1) {
      const a = (k / 10) * Math.PI * 2; const sx = 15 + Math.cos(a) * 10; const sy = 16 + Math.sin(a) * 4.5;
      for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) if (inEll(x, y, 0, 0, 2.6, 2)) b.set(Math.round(sx + x), Math.round(sy + y), y < 0 ? R[5] : R[3], tg('stone', R[3]));
    }
    // logs and flames
    grid((x, y, c) => b.set(x, y, c, tg('wood', Wd[2])), 9, 15, ['ww..........', '.wwww...WWWW', '...wwwwWWW..', '..WWWW.www..'], { w: Wd[2], W: Wd[3] });
    grid((x, y, c) => b.set(x, y, c, tg('glow', LV[4])), 11, 4, ['...o....', '..oo..o.', '.oyo..oo', '.oyyooyo', 'oyWyyyyo', 'oyWWyWyo', '.oyyyyo.', '..oooo..'], { o: LV[3], y: LV[5], W: LV[7] });
    // marshmallows on sticks, stuck in the ground leaning over the fire
    for (const [x0, y0, x1, y1] of [[1, 21, 9, 7], [29, 20, 21, 6]]) {
      line(x0, y0, x1, y1, (x, y) => b.set(x, y, Wd[3], tg('wood', Wd[2])));
      grid((x, y, c) => b.set(x, y, c, tg('fur', '#e8dccc')), x1 - 1, y1 - 2, ['ww', 'Wt', 'tT'], { w: '#ffffff', W: '#f4ece0', t: '#e8b070', T: '#c8803a' });
    }
  }, { outline: sel, pad: 3 });
}

/** A geyser: a cone of cream mineral crust round a pool, and a plume of steam (20 x 34). */
export function geyserV(px, X, Y) {
  propB(px, X, Y + 22, 20, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 20; x += 1) {
      if (!inEll(x, y, 10, 7, 10, 5)) continue;
      const pool = inEll(x, y, 10, 5.5, 4, 2);
      const c = pool ? (y < 5 ? SPR[1] : SPR[4]) : y < 7 ? (x < 10 ? '#f8eed8' : '#e8dcc0') : (x % 3 ? '#d8c8a4' : '#c4b08c');
      b.set(x, y, c, tg(pool ? 'water' : 'stone', '#c8b896'));
    }
  }, { outline: sel, pad: 2 });
  // the plume: a column of steam, wider as it rises
  for (let k = 0; k < 6; k += 1) {
    const cy = Y + 25 - k * 4.4; const cx = X + 10 + Math.sin(k * 1.1) * 1.2; const r = 1.8 + k * 0.55;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      if (!inEll(x, y, cx, cy, r + 0.6, r)) continue;
      const s = (x + 0.5 - cx) + (y + 0.5 - cy);
      px(x, y, s > r * 0.6 ? STM[1] : s < -r * 0.5 ? STM[3] : STM[2]);
    }
  }
}

/** A dragonfruit cactus: fat green arms with pink fruit and a flower (24 x 32). */
export function dragonfruitV(px, X, Y) {
  groundShadow(px, X + 12, Y + 31, 9, 1.8, 0.25);
  propB(px, X, Y, 24, 32, (b) => {
    const arm = (x0, y0, x1, y1, r) => line(x0, y0, x1, y1, (x, y) => { for (let dx = -r; dx <= r; dx += 1) b.set(x + dx, y, dx < 0 ? '#7ac85a' : dx > 0 ? '#3a8a48' : '#5aac4e', tg('leaf', '#4a9a4a')); });
    arm(12, 31, 12, 6, 2); arm(12, 20, 4, 14, 2); arm(4, 14, 4, 6, 2); arm(12, 17, 20, 12, 2); arm(20, 12, 20, 4, 2);
    // ribs and spines
    for (let y = 8; y < 30; y += 3) b.set(12, y, '#2e6a3a');
    for (const [x, y] of [[4, 4], [20, 2], [12, 4]]) grid((xx, yy, c) => b.set(xx, yy, c, tg('fruit', '#e83a8a')), x - 2, y - 2, ['.pp.', 'pPpp', 'pppg', '.pg.'], { p: '#e83a8a', P: '#ff9ac8', g: '#9ad85a' });
    grid((xx, yy, c) => b.set(xx, yy, c, tg('fruit', '#f4f0f8')), 15, 15, ['w.w', '.y.', 'w.w'], { w: '#fff4fa', y: '#ffd23f' });
  }, { outline: sel, pad: 3 });
}

// ---------- the whole village ----------

/**
 * Paints Volcano Island in style B. opts: { homeRoof: the kid's color, areas: the green's ponds
 * and play patches }. lib: { waterDepth, PROPS } from villageprops.js.
 */
export function paintVolcano(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 6607;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];
  const lavaF = pathField(L.water.map((wa) => wa.pts), 48);
  const green = greenField(L, seed, lavaF);

  const mask = groundV(px, L, seed, green);
  const busy = (x, y) => L.blocked(x, y, 4) || L.onPath(x, y, 9) || L.inWater(x, y, 12) || areas.some((a) => x > a.x - 8 && x < a.x + a.w + 8 && y > a.y - 8 && y < a.y + a.h + 8) || (L.landmark && x > L.landmark.x - 4 && x < L.landmark.x + (L.landmark.w || 104) + 4 && y > L.landmark.y && y < L.landmark.y + (L.landmark.h || 108));
  scatterV(px, L, seed + 1, mask, busy);
  pathsV(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plazaV(px, x, y, r, seed + 40 + i));
  L.water.forEach((wa, i) => lavaV(px, L, wa, seed + 60 + i));
  areas.forEach((a, i) => {
    if (a.kind === 'pond') springV(px, a, seed + 70 + i);
    else if (a.kind === 'hockey') rinkV(px, a, seed + 70 + i);
    else courtV(px, a, a.kind, seed + 70 + i);
  });
  L.crossings.forEach((c) => bridgeV(px, c));
  jungleV(px, L, seed + 100, lavaF);

  const border = (p) => (p.kind === 'tree' || p.kind === 'boulder') && (p.x < 12 || p.x + PROPS[p.kind].w > L.W - 12 || p.y < 14 || p.y + PROPS[p.kind].h > L.H - 8);
  const DRAW = {
    volcano: (p) => volcanoV(px, p.x, p.y),
    palm: (p) => palmV(px, p.x, p.y, p.flip),
    torch: (p) => torchV(px, p.x, p.y),
    boulder: (p) => boulderV(px, p.x, p.y, 34, 26, p.x + p.y),
    rock: (p) => boulderV(px, p.x, p.y, p.w || 22, p.h || 16, p.x + p.y),
    vent: (p) => ventV(px, p.x, p.y),
    stall: (p) => stallV(px, p.x, p.y, p.pal),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const props = L.props.filter((p) => !border(p));
  const under = (p) => areas.some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);

  const home = L.home;
  const things = [
    { y: home.y + home.h, draw: () => hutV(px, home.x, home.y, home.w, home.h, { roof: opts.homeRoof || '#e03131', kid: true }) },
    ...L.houses.map((hs) => ({ y: hs.y + hs.h, draw: () => hutV(px, hs.x, hs.y, hs.w, hs.h, { roof: hs.roof, sign: hs.sign }) })),
    ...props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
