// The great kapok tree, the Rainforest's landmark, drawn for the village at one art pixel per
// village pixel (KAPOK.w x KAPOK.h): a giant of a tree on huge buttress roots, its broad crown
// full of leaves, vines hanging down, a bromeliad and orchids on its limbs, a sleepy sloth
// hanging from a branch, a warm hollow in its trunk and a big rain drum in front of it, three
// little poison-dart frogs sitting round the drum, glowing mushrooms at its foot.
//
// Asleep, the sloth snoozes, the frogs blink and puff their throats, a blue morpho flutters
// round, vines sway and motes drift down a shaft of light. Tapped, the drum goes BOOM-boom: the
// frogs hop and sing, a little rain cloud gathers over the crown and rains (then a rainbow), a
// monkey pops up to dance, and the sloth opens its eyes and waves... very... slowly. While the
// map's show plays it all keeps going.
//
// The still parts are painted once into ImageData and canvases; startKapok() redraws the moving
// parts about ten times a second. village.js uses it for the landmark whose art is 'kapok'.

import { mix, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer, clamp, line } from './pixelkit.js';
import { sel, tg } from './castleart.js';
import { PB } from './meadowart.js';
import { RB } from './rainforestart.js';

export const KAPOK = { w: 160, h: 174 };
const W = KAPOK.w; const H = KAPOK.h;
const KB = ['#2e262e', '#463c42', '#5e5458', '#786e6c', '#948a82', '#b0a698', '#ccc2b0', '#e4dccc']; // kapok bark, pale and grey
const Wd = PB.wood; const J = RB.jungle; const TE = RB.teal; const LI = RB.lime; const MS = RB.moss; const GW = RB.glow;
const INK = '#2e2238';
// the kapok's crown: fresher, brighter greens than the jungle round it, so it stands out
const CR = [
  ['#0e2a24', '#16402e', '#205a38', '#2e7642', '#42924a', '#5eae52', '#84c85e', '#b2e278'],
  ['#1a3020', '#264826', '#36622a', '#4a7e30', '#649c36', '#84b840', '#aad252', '#d6ea78'],
  ['#0c2a2c', '#123e38', '#1a5844', '#22744e', '#30905a', '#4cac68', '#76c87c', '#ace29a'],
];

const TRUNK = { cx: 86, top: 60, foot: 140 };
const trunkHw = (y) => 10 + Math.max(0, (y - 100) / 40) ** 2.2 * 12;
const HOLLOW = { cx: 87, top: 108, bottom: 139, hw: 8 };
const DRUM = { cx: 64, top: 143, rx: 15, ry: 5, bottom: 162 };
// quadratic curves (from the trunk, a pull, the tip) and their thickness at each end
const LIMBS = [
  [[80, 82], [64, 74], [48, 60], 5, 3],
  [[92, 80], [110, 72], [126, 58], 5, 3],
  [[78, 96], [56, 89], [26, 84], 3.5, 1.5], // the sloth's branch
  [[95, 100], [106, 98], [116, 91], 3, 2], // a stub with a bromeliad on it
];
// the buttress roots: from the trunk to the tip, and their height at the trunk
const FINS = [[[74, 128], [16, 150], 34], [[100, 128], [154, 150], 34], [[78, 136], [40, 170], 26], [[96, 136], [124, 170], 26]];
const finTop = (fi, x) => {
  const [[x0, y0], [x1, y1], h0] = FINS[fi];
  const s = clamp((x - x0) / (x1 - x0), 0, 1);
  return Math.round(y0 + (y1 - y0) * s + Math.sin(s * Math.PI * 1.4) * 2.5 * (fi % 2 ? 1 : -1) - ((1 - s) ** 1.7 * h0 + 1.5));
};
const FROGS = [
  { x: 55, y: 132, pal: { k: '#0e1a40', b: '#2a62e0', B: '#6aa8ff', s: '#101830', w: '#ffffff', t: '#9ad0ff' }, face: 1 },
  { x: 33, y: finTop(0, 38) - 7, pal: { k: '#3a0e14', b: '#e0402a', B: '#ff8a5a', s: '#1a0a10', w: '#ffffff', t: '#ffc0a0' }, face: 1 },
  { x: 128, y: finTop(1, 133) - 7, pal: { k: '#3a2a08', b: '#f0b820', B: '#fff070', s: '#1a1408', w: '#ffffff', t: '#fff4b0' }, face: -1 },
];
const SLOTH = { x: 34, y: 82 }; // the top-left of the sloth, its claws hooked over its branch
const VINES = [[12, 70, 28], [24, 72, 10], [112, 74, 20], [136, 70, 34], [151, 66, 22], [62, 74, 10]];
const MUSH = [[112, 162, 3], [118, 165, 2.5], [107, 166, 2], [123, 163, 2]];
const PODS = [[28, 40], [64, 24], [108, 38], [142, 50], [86, 56], [46, 58], [124, 22]]; // kapok pods, burst into fluff
const CLOUD = { cx: 96, cy: 13 };
const MONKEY = { x: 126, y: 6 };

/** Turns a Buf into a canvas, outlined. */
function toCanvas(b, pad) {
  b.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'glow' || k === 'fx') return null;
    return sel(t, side);
  });
  const pb = pixelBuffer(W + pad * 2, H + pad * 2);
  b.blit(pb.px, pad, pad);
  const c = document.createElement('canvas'); c.width = W + pad * 2; c.height = H + pad * 2;
  pb.put(c.getContext('2d'));
  return c;
}

const FLOWERS = [['#c8203a', '#ff5a6a', '#ffd23f'], ['#d0408a', '#ff8ac0', '#fff4a8'], ['#e86a1a', '#ffa848', '#fff4a8'], ['#8a48c8', '#c08af0', '#fff4ff']];
const flower = (b, x, y, c) => grid((xx, yy, cc) => b.set(xx, yy, cc, tg('fl', c[0])), x - 1, y - 1, ['.a.', 'aYa', '.a.'], { a: c[1], Y: c[2] });

// ---------- the still parts ----------

/** Behind everything that moves: the shadow, the roots, the trunk with its hollow, the limbs, the crown. */
function paintBack() {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // the tree's shadow on the floor
  for (let y = 136; y < H; y += 1) for (let x = 8; x < W; x += 1) {
    const e = ((x + 0.5 - 88) / 78) ** 2 + ((y + 0.5 - 158) / 15) ** 2;
    if (e < 1 && bayer(x, y) < 0.8) px(x, y, `rgba(8,16,20,${e < 0.5 ? 0.32 : 0.18})`);
  }
  const b = new Buf(W, H, 2);
  const bark = (x, y, c) => b.set(x, y, c, tg('wood', KB[3]));
  // the trunk: pale, tall and straight, with long ridges, lichen, little spines and moss low down;
  // it flares out at the foot into the buttress roots
  for (let y = TRUNK.top; y < TRUNK.foot + 4; y += 1) {
    const hw = trunkHw(y);
    for (let x = Math.floor(TRUNK.cx - hw); x <= TRUNK.cx + hw; x += 1) {
      const u = (x + 0.5 - TRUNK.cx) / hw;
      let i = u < -0.7 ? 6 : u < -0.3 ? 5 : u < 0.2 ? 4 : u < 0.65 ? 3 : 2;
      const ridge = (x + Math.round(Math.sin(y / 9) * 1.5)) % 5;
      if (ridge === 0) i -= 1; else if (ridge === 1 && u < 0.3) i += 1;
      if (h2(x, y, 3) > 0.97) i += 1;
      let c = KB[clamp(i, 0, 7)];
      if (vnoise(x, y, 7, 4) > 0.72 && bayer(x, y) < 0.6) c = mix(c, '#b8c08a', 0.35);
      if (y > 118 && vnoise(x, y, 5, 5) > 0.58 - (y - 118) * 0.012) c = MS[u < 0 ? 4 : 3];
      bark(x, y, c);
    }
  }
  for (const [x, y] of [[80, 70], [92, 76], [78, 88], [95, 92], [82, 102], [98, 112], [88, 66], [76, 112]]) { bark(x, y, KB[6]); bark(x + 1, y, KB[4]); bark(x, y + 1, KB[2]); }
  // the buttress roots: great wavy planks running out from the trunk, high at the trunk and
  // sweeping down to the floor, lit along the top edge, mossy low down
  FINS.forEach(([[x0, y0], [x1, y1], h0], fi) => {
    const right = x1 > x0; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.6);
    for (let q = 0; q <= n; q += 1) {
      const s = q / n;
      const x = Math.round(x0 + (x1 - x0) * s);
      const yb = Math.round(y0 + (y1 - y0) * s + Math.sin(s * Math.PI * 1.4) * 2.5 * (fi % 2 ? 1 : -1));
      const ht = Math.round((1 - s) ** 1.7 * h0 + 1.5);
      for (let y = yb - ht; y <= yb; y += 1) {
        const v = (y - (yb - ht)) / Math.max(1, ht);
        let c;
        if (y === yb - ht) c = KB[7];
        else if (v < 0.16 || y === yb - ht + 1) c = KB[6];
        else c = right ? (v > 0.75 ? KB[1] : KB[3]) : (v > 0.75 ? KB[3] : KB[5]);
        if (!right && (x + Math.round(v * 3)) % 7 === 0 && v > 0.2) c = KB[4];
        if (v > 0.5 && vnoise(x, y, 4, 6 + fi) > 0.48) c = MS[right ? 2 : 4];
        bark(x, y, c);
      }
    }
  });
  // the hollow between the front roots: a dark arch with a warm glow deep inside
  for (let y = HOLLOW.top; y < HOLLOW.bottom; y += 1) {
    const t = (y - HOLLOW.top) / (HOLLOW.bottom - HOLLOW.top);
    const hw = HOLLOW.hw * Math.min(1, Math.sqrt(t * 3.2));
    for (let x = Math.floor(HOLLOW.cx - hw - 1); x <= HOLLOW.cx + hw + 1; x += 1) {
      const d = Math.abs(x + 0.5 - HOLLOW.cx) - hw;
      if (d > 1) continue;
      if (d > 0) { bark(x, y, x < HOLLOW.cx ? KB[2] : KB[5]); continue; }
      const g = ((x + 0.5 - HOLLOW.cx) / HOLLOW.hw) ** 2 + ((y - HOLLOW.bottom + 9) / 13) ** 2;
      const tq = (bayer(x, y) - 0.5) * 0.18;
      b.set(x, y, g < 0.18 + tq ? '#b07a3e' : g < 0.42 + tq ? '#7a4c2e' : g < 0.8 + tq ? '#45282a' : '#24161e', tg('glow', '#3a2428'));
    }
  }
  // the limbs: two great ones up into the crown, the sloth's branch, a stub with a bromeliad
  LIMBS.forEach(([[x0, y0], [x1, y1], [x2, y2], w0, w1], li) => {
    const n = 120;
    for (let q = 0; q <= n; q += 1) {
      const t = q / n; const a = (1 - t) * (1 - t); const bq = 2 * (1 - t) * t; const c2 = t * t;
      const x = Math.round(a * x0 + bq * x1 + c2 * x2); const y = Math.round(a * y0 + bq * y1 + c2 * y2);
      const w = Math.round(w0 + (w1 - w0) * t);
      for (let k = -w; k <= w; k += 1) {
        const v = (k + w) / (2 * w);
        let c = v < 0.2 ? KB[6] : v < 0.45 ? KB[5] : v < 0.8 ? KB[3] : KB[1];
        if (v < 0.3 && vnoise(x, y, 4, 11 + li) > 0.45) c = MS[v < 0.15 ? 5 : 4];
        bark(x, y + k, c);
      }
    }
  });
  // a few leaves at the end of the sloth's branch
  grid((x, y, c) => b.set(x, y, c, tg('leaf', CR[0][3])), 18, 79, ['..g.....', '.gGg.g..', 'gg.gGgg.', '.g..gg.g', '....g...'], { g: CR[0][5], G: CR[0][6] });
  // the crown: a broad umbrella of clumps in tiers, the lower ones in front, darker underneath,
  // sunlit along the top
  const C1 = CR[0]; const C2 = CR[1]; const C3 = CR[2];
  const tiers = [
    [[46, 22, 11, C2], [70, 17, 12, C1], [96, 16, 12, C2], [122, 22, 11, C3]],
    [[20, 35, 12, C1], [44, 32, 13, C3], [68, 29, 14, C2], [96, 28, 14, C1], [120, 32, 13, C2], [142, 37, 12, C3]],
    [[7, 49, 11, C2], [28, 48, 13, C2], [52, 46, 14, C1], [78, 44, 15, C3], [104, 44, 15, C2], [128, 47, 14, C1], [151, 50, 11, C3]],
    [[18, 60, 10, C3], [40, 62, 11, C1], [62, 60, 11, C2], [100, 60, 11, C3], [122, 62, 11, C1], [143, 60, 10, C2]],
  ];
  const all = tiers.flatMap((row, ti) => row.map(([cx, cy, r, P]) => ({ cx, cy, r, P, ti })));
  const crown = new Uint8Array(W * H);
  for (let y = 2; y < 80; y += 1) {
    for (let x = 0; x < W; x += 1) {
      let best = null; let bd = 0;
      for (const c of all) {
        const d = Math.hypot(x + 0.5 - c.cx, (y + 0.5 - c.cy) * 1.1);
        if (d > c.r - (h2(x, y, c.cx) > 0.86 ? 1 : 0)) continue;
        if (!best || c.cy > best.cy) { best = c; bd = d; }
      }
      if (!best) continue;
      crown[y * W + x] = 1;
      const dx = (x + 0.5 - best.cx) / best.r; const dy = (y + 0.5 - best.cy) / best.r;
      const l = -(dx * 0.6 + dy * 0.8);
      let i = l > 0.72 ? 7 : l > 0.45 ? 6 : l > 0.15 ? 5 : l > -0.2 ? 4 : l > -0.5 ? 3 : 2;
      const hk = h2(x, y, 9);
      if ((x + y * 2) % 5 === 0 && hk > 0.4) i += l > -0.3 ? 1 : -1;
      else if (hk > 0.94) i += 1;
      if (best.ti === 3) i -= 1;
      if (bd > best.r - 1.3) i = l > 0.35 ? 5 : 1;
      b.set(x, y, best.P[clamp(i, 1, 7)], tg('leaf', best.P[2]));
    }
  }
  // the crown's shadow, down and to the right of it, so it stands up off the jungle below
  for (let y = 4; y < 92; y += 1) for (let x = 2; x < W; x += 1) {
    if (crown[y * W + x] || b.get(x, y)) continue;
    let s = 0;
    for (const [dx, dy] of [[2, 3], [3, 5], [4, 7]]) { const xx = x - dx; const yy = y - dy; if (xx >= 0 && yy >= 0 && crown[yy * W + xx]) s += 1; }
    if (s) px(x, y, `rgba(6,14,18,${s > 1 ? 0.34 : 0.2})`);
  }
  // the crown's shade on the trunk and limbs just under it
  for (let y = 56; y < 96; y += 1) for (let x = 0; x < W; x += 1) {
    const c = b.get(x, y);
    if (!c || String(b.tag(x, y)).startsWith('leaf')) continue;
    let up = 0;
    for (let k = 1; k <= 8; k += 1) { const yy = y - k; const xx = x - Math.round(k / 2); if (yy >= 0 && xx >= 0 && crown[yy * W + xx]) up += 1; }
    if (up > 2) b.set(x, y, mix(c, '#14202a', 0.38));
  }
  // flowers in the crown, kapok pods bursting into white fluff
  [[40, 24, 0], [76, 14, 1], [116, 20, 2], [18, 42, 1], [92, 36, 0], [140, 42, 3], [60, 54, 2], [132, 56, 0], [8, 56, 2], [106, 52, 3]].forEach(([x, y, k]) => flower(b, x, y, FLOWERS[k]));
  PODS.forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, tg('fluff', '#c8c0b8')), x - 2, y - 2, ['.ww.', 'wWwW', 'Wwbw', '.ww.'], { w: '#ffffff', W: '#e4e0ea', b: '#8a5a3a' }));
  // a bromeliad on the stub, orchids on the trunk
  grid((x, y, c) => b.set(x, y, c, tg('leaf', LI[3])), 110, 82, [
    '.g..r..g.',
    '..g.r.g..',
    'g.grRrg.g',
    '.ggrRrgg.',
    '..ggggg..',
  ], { g: LI[5], r: '#e84a4a', R: '#ffd23f' });
  grid((x, y, c) => b.set(x, y, c, tg('fl', '#8a48c8')), 98, 104, ['.a.a.', 'aaBaa', '.BYB.', '..a..', '..g..', '.gg..'], { a: '#c08af0', B: '#f4e8ff', Y: '#ffe060', g: J[5] });
  grid((x, y, c) => b.set(x, y, c, tg('fl', '#c84a98')), 72, 92, ['.a.a.', 'aaBaa', '.BYB.', '..g..'], { a: '#f08ac8', B: '#fff0f8', Y: '#ffe060', g: J[5] });
  b.outline((t, side) => (String(t).startsWith('glow') ? null : sel(t, side)));
  b.blit(px, 0, 0);
  return new ImageData(out.data, W, H);
}

/** The rain drum: a big hide drum, its wooden body carved with bands, laced in red and yellow. */
function drumSprite() {
  const b = new Buf(W, H, 2);
  const { cx, top, rx, ry, bottom } = DRUM;
  // the body: a barrel, lit on the left, bands carved round it
  for (let y = top; y <= bottom; y += 1) {
    const t = (y - top) / (bottom - top);
    const hw = rx - Math.abs(t - 0.4) * 2.4;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x += 1) {
      const u = (x + 0.5 - cx) / hw;
      const yb = bottom - Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * ry);
      if (y > yb) continue;
      let c = u < -0.7 ? Wd[4] : u < -0.2 ? Wd[3] : u < 0.5 ? Wd[2] : Wd[1];
      const yy = y - top;
      if (yy >= 8 && yy <= 10) c = u < -0.2 ? '#e8504a' : '#a83032';
      if (yy === 9 && ((x + 40) % 4 === 0)) c = '#ffd23f';
      if (yy >= 13 && yy <= 14) c = u < -0.2 ? '#2ea8a0' : '#1e6a6a';
      if (y === yb) c = Wd[0];
      b.set(x, y, c, tg('wood', Wd[2]));
    }
  }
  // the lacing: zigzags of cord from the rim down to the band
  for (let x = cx - rx + 2; x <= cx + rx - 2; x += 1) {
    const k = (x - (cx - rx + 2)) % 6; const yy = top + 2 + (k < 3 ? k * 2 : (6 - k) * 2);
    const u = (x + 0.5 - cx) / rx;
    if (Math.abs(u) < 0.95) { b.set(x, yy, u < 0.2 ? '#ffd23f' : '#d8a020', tg('wood', Wd[2])); b.set(x, yy + 1, u < 0.2 ? '#ffd23f' : '#c89020', tg('wood', Wd[2])); }
  }
  // the head: stretched hide, lit at the back-left, a rim of wood
  for (let y = top - ry - 1; y <= top + ry + 1; y += 1) for (let x = cx - rx - 1; x <= cx + rx + 1; x += 1) {
    if (!inEll(x, y, cx + 0.5, top + 0.5, rx + 0.5, ry + 0.5)) continue;
    const inner = inEll(x, y, cx + 0.5, top + 0.5, rx - 1, ry - 1);
    if (!inner) { b.set(x, y, y < top ? Wd[4] : Wd[1], tg('wood', Wd[2])); continue; }
    const g = ((x + 0.5 - cx + 4) / rx) ** 2 + ((y + 0.5 - top + 1.5) / ry) ** 2;
    b.set(x, y, g < 0.3 ? '#fff4dc' : g < 0.8 ? '#f4e2c0' : '#dcc49a', tg('skin', '#dcc49a'));
  }
  // two leafy beaters leaning on it
  line(cx + rx + 2, bottom - 2, cx + rx - 3, top + 3, (x, y) => { b.set(x, y, Wd[3], tg('wood', Wd[2])); b.set(x + 1, y, Wd[1], tg('wood', Wd[2])); });
  grid((x, y, c) => b.set(x, y, c, tg('leaf', LI[3])), cx + rx - 6, top - 1, ['.gg.', 'gGgg', 'gggg', '.gg.'], { g: LI[4], G: LI[6] });
  line(cx + rx + 6, bottom - 1, cx + rx + 3, top + 6, (x, y) => { b.set(x, y, Wd[4], tg('wood', Wd[2])); b.set(x + 1, y, Wd[2], tg('wood', Wd[2])); });
  grid((x, y, c) => b.set(x, y, c, tg('leaf', LI[3])), cx + rx + 1, top + 2, ['.gg.', 'gGgg', 'gggg', '.gg.'], { g: TE[4], G: TE[6] });
  return toCanvas(b, 2);
}

/** In front of it all: ferns and big leaves at the foot of the tree, the mushrooms' caps. */
function frontSprite() {
  const b = new Buf(W, H, 2);
  const fern = (cx, cy, P, spread) => {
    for (const [ang, len] of spread) {
      for (let s = 0; s < len; s += 0.5) {
        const fx = cx + Math.cos(ang) * s; const fy = cy + Math.sin(ang) * s * 0.85 + (s / len) ** 2 * 4;
        b.set(Math.round(fx), Math.round(fy), s > len * 0.6 ? P[6] : P[4], tg('leaf', P[3]));
        if (Math.round(s * 2) % 3 === 0 && s > 1.5) {
          const w = 2.2 * (1 - s / len) + 0.7;
          for (const sd of [-1, 1]) b.set(Math.round(fx - Math.sin(ang) * w * sd), Math.round(fy + Math.cos(ang) * w * sd), sd < 0 ? P[5] : P[3], tg('leaf', P[3]));
        }
      }
    }
  };
  fern(24, 174, J, [[-2.6, 12], [-2.1, 14], [-1.6, 15], [-1.1, 14], [-0.6, 12]]);
  fern(142, 174, TE, [[-2.7, 13], [-2.2, 15], [-1.7, 16], [-1.2, 15], [-0.6, 13], [-0.2, 10]]);
  // an elephant-ear leaf at the right corner
  for (let y = 150; y < H; y += 1) for (let x = 140; x < W; x += 1) {
    const dx = x + 0.5 - 152; const dy = y + 0.5 - 160;
    if (dx * dx / 64 + dy * dy / 40 > 1) continue;
    b.set(x, y, Math.abs(dx + dy * 0.3) < 0.7 ? LI[6] : dx + dy < 0 ? LI[5] : LI[4], tg('leaf', LI[3]));
  }
  // the glowing mushrooms' caps
  MUSH.forEach(([mx, my, r]) => {
    for (let y = Math.floor(my - r); y <= my; y += 1) for (let x = Math.floor(mx - r); x <= mx + r; x += 1) if (inEll(x, y, mx + 0.5, my + 0.5, r + 0.5, r)) b.set(x, y, y < my - r * 0.4 ? (x < mx ? GW[4] : GW[3]) : GW[2], tg('glow', GW[2]));
    for (let y = my + 1; y < my + 4; y += 1) b.set(Math.round(mx), y, '#e8f4ec', tg('glow', GW[1]));
  });
  return toCanvas(b, 2);
}

// ---------- the characters ----------

// a poison-dart frog, sitting, front on: k dark (eyes, mouth), b body, B its light, s spots,
// w eye white, t throat
const FROG_TOP = ['.www..www.', '.wkwbbwkw.', 'bbbbbbbbbb'];
const FROG_SIT = [...FROG_TOP, 'bkbbbbbbkb', 'bbkkkkkkbb', 'Bbsbbbbsbb', '.bbbsbbbb.', 'bb.b..b.bb'];
const FROG_SING = [...FROG_TOP, 'bkbbbbbbkb', 'bbkttttkbb', 'bbttttttbb', '.bbttttbb.', 'bb.b..b.bb'];
const FROG_PUFF = [...FROG_TOP, 'bkbbbbbbkb', 'bbkkkkkkbb', 'Bbbttttbsb', '.bbbttbbb.', 'bb.b..b.bb'];
const FROG_BLINK = ['.bbb..bbb.', '.kkkbbkkk.', 'bbbbbbbbbb', 'bkbbbbbbkb', 'bbkkkkkkbb', 'Bbsbbbbsbb', '.bbbsbbbb.', 'bb.b..b.bb'];
const FROG_HOP = [...FROG_TOP, 'bkbbbbbbkb', 'bbkkkkkkbb', 'Bbsbbbbsbb', 'b.bbbbbb.b', 'b........b'];

// the sloth, hanging by its long arms from its branch: a fur, A shade, m face, e eye stripes,
// n nose, c claws
const SLOTH_HANG = [
  'cc..........cc',
  '.aa........aa.',
  '.aa........aa.',
  '.aa........aa.',
  '.aa........aa.',
  '.aa........aa.',
  '.aa........aa.',
  '.aa........aa.',
  '.aa.aaaaaa.aa.',
  '.aaaaaaaaaaaa.',
  'aaaammmmmmaaaa',
  'aammmmmmmmmmaa',
  'ameeemmmmeeema',
  'ameeemmmmeeema',
  'aeemmmnnmmmeea',
  'aammmmmmmmmmaa',
  '.aammmmmmmmaa.',
  '.aaaammmmaaaa.',
  '..aaaaaaaaaa..',
  '..aAAAAAAAAa..',
  '..aAAAAAAAAa..',
  '...aAAAAAAa...',
  '...aa....aa...',
  '...cc....cc...',
];
const SLOTH_PAL = { a: '#a68a64', A: '#7f6545', m: '#ecd6a8', e: '#5a4028', K: '#140c10', n: '#3b2a1a', c: '#3b2a1a', w: '#ffffff' };

// a monkey's head and shoulders, popping up out of the leaves: f fur, t face and ears, K eyes, m mouth
const MONKEY_HEAD = [
  '...ffffff...',
  '..ffffffff..',
  'tffttffttfft',
  'tftKttttKtft',
  '.fttttttttf.',
  '.fttmmmmttf.',
  '..fttttttf..',
  '...ffffff...',
  '..ffffffff..',
  '.ffffffffff.',
];
const MONKEY_PAL = { f: '#8b5a2b', t: '#f1c27d', K: '#1e1418', m: '#c8504a', h: '#f1c27d' };
const NOTE = ['.ss.', '.s.s', '.s..', '.s..', 'ss..', 'ss..'];
const FLUFF = ['.w.', 'wWw', '.w.'];

let cache = null;
const art = () => (cache ||= { back: paintBack(), drum: drumSprite(), front: frontSprite() });

/**
 * Starts the kapok on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a while;
 * while the map's show plays (the village has .show-on) it keeps going.
 */
export function startKapok(canvas, host) {
  const ctx = canvas.getContext('2d');
  const A = art();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal, flip = false) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(flip ? X + row.length - 1 - x : X + x, Y + y, c); } });
  // a sprite with a dark edge round it, so it reads on leaves and bark
  const inked = (r, X, Y, pal, ink = INK) => {
    for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) rows(r, X + dx, Y + dy, Object.fromEntries(Object.keys(pal).map((k) => [k, ink])));
    rows(r, X, Y, pal);
  };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 5000);
    // in the show the drum keeps a slow beat; otherwise BOOM-boom once
    const beat = show ? (now % 1600) : since;
    const hit = (beat > -100 && beat < 160) || (beat > 450 && beat < 600);
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(A.back, 0, 0);

    // vines hanging from the crown, swaying
    VINES.forEach(([vx, vy, len], i) => {
      for (let k = 0; k < len; k += 1) {
        const sw = Math.sin(t * 0.9 + i * 1.7) * (k / len) * 1.6 + (hit ? Math.sin(f * 2 + i) * (k / len) * 1.5 : 0);
        const x = vx + Math.round(Math.sin(k / 5 + i) * 0.8 + sw);
        dot(x, vy + k, k % 6 === 5 ? MS[6] : MS[3]);
        if (k % 4 === 2) { const s = (k >> 2) % 2 ? 1 : -1; dot(x + s, vy + k, J[5]); dot(x + s, vy + k + 1, J[3]); }
      }
    });

    // the sloth, hanging from its branch: asleep, then slowly awake and waving
    {
      const sw = Math.round(Math.sin(t * 0.6) * 0.7);
      const X = SLOTH.x; const Y = SLOTH.y;
      const eyes = !awake || (!show && since < 1300) ? 0 : !show && since < 1900 ? 1 : 2;
      const wave = show || (since > 2000 && since < 4800);
      // its arms stay on the branch; the rest of it sways a little. One arm lets go to wave.
      const arms = SLOTH_HANG.slice(0, 8).map((r) => (wave ? `${r.slice(0, 7)}.......` : r));
      const body = SLOTH_HANG.slice(8).map((r, i) => (wave && i === 0 ? `${r.slice(0, 11)}...` : r));
      inked(arms, X, Y, SLOTH_PAL, '#3a2a20');
      inked(body, X + sw, Y + 8, SLOTH_PAL, '#3a2a20');
      rows(arms.slice(5), X, Y + 5, SLOTH_PAL); // the arms over the edge of the body's ink
      const fx = X + sw; const fy = Y + 4; // the face's rows, as in a sloth with short arms
      if (wave) {
        // waving, very slowly, from the shoulder
        const sl = 0.1 + Math.sin((show ? t : (since - 2000) / 1000) * 1.8) * 0.45;
        const pts = [];
        for (let k = 0; k < 6; k += 1) pts.push([fx + 12 + k, fy + 5 - Math.round(k * sl)]);
        pts.forEach(([ax, ay], k) => { if (k > 1) for (const [dx, dy] of [[-1, 0], [2, 0], [0, -1], [1, -1], [0, 2], [1, 2]]) dot(ax + dx, ay + dy, '#3a2a20'); });
        pts.forEach(([ax, ay]) => { dot(ax, ay, SLOTH_PAL.a); dot(ax + 1, ay, SLOTH_PAL.a); dot(ax, ay + 1, SLOTH_PAL.A); dot(ax + 1, ay + 1, SLOTH_PAL.a); });
        const [hx, hy] = pts[5];
        dot(hx + 2, hy - 1, SLOTH_PAL.c); dot(hx + 2, hy, SLOTH_PAL.c); dot(hx + 2, hy + 1, SLOTH_PAL.c); dot(hx + 3, hy - 1, SLOTH_PAL.c); dot(hx + 3, hy + 1, SLOTH_PAL.c);
      }
      // eyes: shut (just the stripes), sleepy, then wide open with a shine
      if (eyes === 1) { dot(fx + 3, fy + 9, SLOTH_PAL.K); dot(fx + 4, fy + 9, SLOTH_PAL.K); dot(fx + 9, fy + 9, SLOTH_PAL.K); dot(fx + 10, fy + 9, SLOTH_PAL.K); }
      if (eyes === 2) {
        for (const ex of [3, 9]) { dot(fx + ex, fy + 8, SLOTH_PAL.w); dot(fx + ex + 1, fy + 8, SLOTH_PAL.K); dot(fx + ex, fy + 9, SLOTH_PAL.K); dot(fx + ex + 1, fy + 9, SLOTH_PAL.K); }
      }
      // a little smile, pink cheeks when awake
      dot(fx + 5, fy + 11, '#8a4a3a'); dot(fx + 8, fy + 11, '#8a4a3a'); dot(fx + 6, fy + 12, '#8a4a3a'); dot(fx + 7, fy + 12, '#8a4a3a');
      if (eyes === 2) { dot(fx + 2, fy + 11, '#f0a8a0'); dot(fx + 11, fy + 11, '#f0a8a0'); }
      if (!awake) {
        // snoozing: little z's float up
        for (let k = 0; k < 2; k += 1) {
          const p = (t / 3.2 + k / 2) % 1;
          if (p > 0.85) continue;
          const z = p < 0.4 ? ['zz', '.z', 'zz'] : ['zzz', '.z.', 'zzz'];
          inked(z, X - 5 - p * 6, Y + 10 - p * 16, { z: p > 0.6 ? '#c8d8d0' : '#f4fff8' }, '#2e4038');
        }
      }
    }

    // the drum (it jumps a little when it's hit) and the rings of its BOOM
    const dj = hit ? -1 : 0;
    ctx.drawImage(A.drum, -2, -2 + dj);
    if (hit) for (let x = DRUM.cx - 9; x <= DRUM.cx + 7; x += 1) for (let y = DRUM.top - 3; y <= DRUM.top + 2; y += 1) if (inEll(x, y, DRUM.cx - 1, DRUM.top, 9, 3) && (x + y) % 2) dot(x, y + dj, '#ffffff');
    for (const b0 of show ? [0] : [0, 450]) {
      const p = ((show ? beat : since) - b0) / 900;
      if (p < 0 || p > 1) continue;
      const rx = 18 + p * 34; const ry = 6 + p * 11;
      for (let k = 0; k < 72; k += 1) {
        const a = (k / 72) * Math.PI * 2;
        if ((k + f) % 2 && p > 0.5) continue;
        dot(DRUM.cx + Math.cos(a) * rx, DRUM.top + Math.sin(a) * ry, p < 0.5 ? '#fffbe0' : '#e0f0d8');
      }
    }

    // the frogs: blinking and puffing their throats; hopping and singing when the drum goes
    FROGS.forEach((fr, i) => {
      const sing = show || (since > 300 && since < 4000);
      const hop = !show && since > 0 && since < 900 ? Math.round(Math.sin(clamp((since - i * 120) / 500, 0, 1) * Math.PI) * 5) : 0;
      let sp = FROG_SIT;
      if (hop) sp = FROG_HOP;
      else if (sing) sp = (Math.floor(now / 260) + i) % 2 ? FROG_SING : FROG_PUFF;
      else if ((t + i * 1.3) % 4.5 < 0.15) sp = FROG_BLINK;
      else if ((t * 0.6 + i * 0.7) % 3 < 0.5) sp = FROG_PUFF;
      const y = fr.y - hop + (i === 0 ? dj : 0);
      inked(fr.face < 0 ? sp.map((r) => [...r].reverse().join('')) : sp, fr.x, y, fr.pal, fr.pal.k);
      if (sing) {
        // notes float up from each singer
        for (let k = 0; k < 2; k += 1) {
          const p = ((now / 1500) + i / 3 + k / 2) % 1;
          if (p > 0.9) continue;
          inked(NOTE, fr.x + 3 + Math.sin(p * 6 + i + k) * 4, y - 8 - p * 22, { s: ['#ffe040', '#ff8ac0', '#8ae0ff'][(i + k) % 3] }, '#2e2238');
        }
      }
    });

    // the mushrooms glow softly
    const gl = 0.5 + 0.5 * Math.sin(t * 1.4);
    MUSH.forEach(([mx, my, r], i) => { if ((gl + i * 0.2) % 1 > 0.5) for (let k = 0; k < 4; k += 1) dot(mx - r - 1 + ((k * 3 + f) % Math.round(r * 2 + 3)), my - r - 1 - (k % 2), k % 2 ? GW[3] : GW[4]); });

    ctx.drawImage(A.front, -2, -2);

    // kapok fluff drifting down from the pods (lots of it when the drum shakes the tree)
    const nf = awake && !show && since < 3000 ? 9 : 3;
    for (let k = 0; k < nf; k += 1) {
      const p = (t / (k < 3 ? 11 : 4) + k / nf + (k < 3 ? 0 : 0.37)) % 1;
      if (p > 0.88) continue;
      const [sx, sy] = PODS[(k * 3) % PODS.length];
      rows(FLUFF, sx + p * 22 + Math.sin(p * 9 + k) * 4 - 1, sy + 2 + p * 74 - 1, { w: '#f4f0fa', W: '#ffffff' });
    }
    // a blue morpho flutters round the tree
    {
      const p = (t / 14) % 1; const a = p * Math.PI * 2;
      const bx = 84 + Math.cos(a) * 66; const by = 112 + Math.sin(a * 2) * 14 - Math.abs(Math.sin(a)) * 6;
      const up = f % 3 === 0;
      rows(up ? ['bb.bb', 'BbkbB', '.bkb.'] : ['.....', 'BBkBB', 'bb.bb'], bx - 2, by - 1, { b: '#2a5ad8', B: '#7ac0ff', k: INK });
    }
    // motes drifting down a shaft of light
    for (let k = 0; k < 5; k += 1) {
      const p = (t / 7 + k / 5) % 1;
      const x = 56 + k * 9 + p * 26; const y = 70 + p * 60;
      if ((f + k) % 4) dot(x, y, p < 0.7 ? '#fff6c0' : '#e8f0b0');
    }

    // the little rain cloud: it gathers over the crown, rains, and drifts off, leaving a rainbow
    const cloudK = show ? 1 : since < 300 ? 0 : since < 1000 ? (since - 300) / 700 : since < 3800 ? 1 : since < 4400 ? 1 - (since - 3800) / 600 : 0;
    if (awake && cloudK > 0) {
      const { cx, cy } = CLOUD;
      // rain first, so the cloud sits on top of it
      const raining = show || (since > 900 && since < 3900);
      if (raining) {
        for (let k = 0; k < 26; k += 1) {
          const x = cx - 24 + Math.round(k * 1.9);
          const y0 = cy + 7; const fall = 36 + (k % 4) * 5;
          const y = y0 + ((now / 1000) * 80 + h2(k, 1, 7) * fall) % fall;
          dot(x, y, '#4a98d8'); dot(x, y + 1, '#6ab4ec'); dot(x, y + 2, '#a8dcff'); dot(x, y + 3, '#ffffff');
          if (y > y0 + fall - 5) { dot(x - 1, y + 3, '#d8f0ff'); dot(x + 1, y + 3, '#d8f0ff'); dot(x - 2, y + 2, '#a8d8f8'); dot(x + 2, y + 2, '#a8d8f8'); }
        }
      }
      const puffs = [[-16, 3, 8], [-6, -2, 10], [7, -1, 9], [17, 3, 7], [0, 5, 9]];
      const inC = (x, y, k) => puffs.some(([dx, dy, r]) => { const rr = r * (0.4 + 0.6 * cloudK) + k; return inEll(x, y, cx + dx, cy + dy, rr, rr * 0.8); });
      for (let y = cy - 16; y <= cy + 14; y += 1) for (let x = cx - 28; x <= cx + 28; x += 1) {
        if (!inC(x, y, 0)) { if (inC(x, y, 1)) dot(x, y, '#7a88a8'); continue; }
        let best = null;
        for (const [dx, dy, r] of puffs) { const rr = r * (0.4 + 0.6 * cloudK); if (inEll(x, y, cx + dx, cy + dy, rr, rr * 0.8) && (!best || dy > best[1])) best = [dx, dy, rr]; }
        const [dx, dy, rr] = best;
        const l = (x + 0.5 - cx - dx) * 0.6 + (y + 0.5 - cy - dy) * 0.8;
        dot(x, y, l > rr * 0.45 ? '#b8c4d8' : l > -rr * 0.2 ? '#e4eaf4' : '#ffffff');
      }
      if (cloudK > 0.8) {
        // a happy face: closed smiling eyes, rosy cheeks, a little smile
        rows(['.K.', 'K.K'], cx - 7, cy, { K: '#5a6a8a' }); rows(['.K.', 'K.K'], cx + 3, cy, { K: '#5a6a8a' });
        dot(cx - 9, cy + 3, '#ffb0c0'); dot(cx - 8, cy + 3, '#ffb0c0'); dot(cx + 7, cy + 3, '#ffb0c0'); dot(cx + 8, cy + 3, '#ffb0c0');
        dot(cx - 3, cy + 3, '#5a6a8a'); for (let x = cx - 2; x <= cx; x += 1) dot(x, cy + 4, '#5a6a8a'); dot(cx + 1, cy + 3, '#5a6a8a');
      }
    }
    // the rainbow after the rain
    const bowK = show ? 0 : since > 3700 && since < 5000 ? Math.sin(((since - 3700) / 1300) * Math.PI) : 0;
    if (bowK > 0) {
      const C = ['#ff6a6a', '#ffa84a', '#ffe060', '#7ad86a', '#5ab0f0', '#a07ae8'];
      for (let a = Math.PI * 1.08; a < Math.PI * 1.92; a += 0.012) {
        C.forEach((c, k) => {
          const r = 34 - k;
          const x = Math.round(CLOUD.cx + Math.cos(a) * r); const y = Math.round(40 + Math.sin(a) * r * 0.7);
          if (bayer(x, y) < bowK) dot(x, y, c);
        });
      }
    }
    // a monkey pops up out of the leaves to dance, arms up and swinging
    if (show || (since > 700 && since < 4200)) {
      const p = show ? 1 : clamp((since - 700) / 300, 0, 1) * clamp((4200 - since) / 300, 0, 1);
      const bob = Math.floor(now / 200) % 2;
      const shown = Math.round(p * 10);
      const X = MONKEY.x + (Math.floor(now / 400) % 2 ? 1 : -1); const Y = MONKEY.y + 10 - shown - bob;
      inked(MONKEY_HEAD.slice(0, shown), X, Y, MONKEY_PAL, '#3a2418');
      if (shown >= 8) {
        // arms: both up, then one up and one out, in turn
        const pose = Math.floor(now / 400) % 2;
        const arm = (sx, dir, up) => {
          for (let k = 0; k < 5; k += 1) { const ax = sx + dir * (k < 2 ? k : 2); const ay = Y + 8 - (up ? k + 1 : Math.min(k, 1)); dot(ax, ay, MONKEY_PAL.f); }
          const hx = sx + dir * (up ? 2 : 4); const hy = Y + 8 - (up ? 6 : 1);
          dot(hx, hy, MONKEY_PAL.h); dot(hx + dir, hy, MONKEY_PAL.h);
        };
        arm(X, -1, true); arm(X + 11, 1, pose === 0);
      }
      // leaves in front of its tummy
      rows(['.gGg.gggGg.', 'gggGgggggGg', '.ggggggggg.'], X, MONKEY.y + 8, { g: CR[1][4], G: CR[1][6] });
    }
    // leaves shaken loose by the drum, spinning down
    if (!show && since > 0 && since < 2200) {
      for (let k = 0; k < 6; k += 1) {
        const p = clamp((since - k * 90) / 2000, 0, 1);
        if (p <= 0 || p >= 1) continue;
        const x = 24 + k * 22 + Math.sin(p * 8 + k) * 4; const y = 70 + p * 66;
        rows(Math.floor(p * 12 + k) % 2 ? ['gG', 'g.'] : ['.g', 'Gg'], x, y, { g: [LI[5], J[5], '#e8b040'][k % 3], G: LI[6] });
      }
    }
  };
}
