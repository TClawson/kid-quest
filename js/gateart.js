// The Dragon King's door, the Castle's landmark (it stands there once the castle treasure map is
// finished), drawn for the village in its storybook style: one village pixel per art pixel, the
// grandest thing in the town. A great old gatehouse: two round towers under tall slate roofs with
// pennants, battlements, a dragon crest over the arch, ivy, glowing windows and torches, and a
// half-raised portcullis with the Dragon King's gold glittering behind it. On top, curled along
// the battlements with its tail wound round the right-hand tower, sleeps the baby dragon who
// guards it. A cheap overlay animates it: pennants wave, torches flicker, windows glow, the gold
// glints, the dragon breathes little smoke puffs, peeks with one eye now and then and flicks its
// tail. Tapped, it lifts its head, opens its wings, sneezes a spark and counts its coins; the
// portcullis creaks up a little. While the map's show plays it stays awake to watch.

import { mix, h2, bayer, Buf, grid, inEll, pixelBuffer } from './pixelkit.js';
import { CB, sel, tg, masonry, coneRoof } from './castleart.js';
import { PB } from './meadowart.js';

export const GATE = { w: 156, h: 156 };
const W = GATE.w; const H = GATE.h;
const St = CB.stone; const Sl = CB.slate; const Au = CB.gold; const Gl = CB.glow; const INK = CB.ink; const Tb = CB.timber;
const LF = PB.leaf; const Wd = PB.wood;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- where things are (art pixels) ----------

const TOWERS = [24, 132]; // the towers' middles; each 40 wide
const TR = 20;
const BLOCK = [40, 116]; // the gate block between them
const ARCH = { x: 78, r: 18, spring: 112, floor: 150 }; // the archway: round top centered at spring
const PORT = { down: 120, up: 104 }; // the portcullis' lower edge, resting and raised
const WINDOWS = [[24, 86], [132, 86]];
const TORCHES = [[55, 106], [101, 106]];
const DR = {
  body: ['#6a2c22', '#a8482a', '#dc7238', '#f49a52', '#ffc284', '#ffe2bc'],
  belly: ['#c88a50', '#e8b878', '#ffdca8', '#fff2d8'],
  wing: ['#8a3050', '#c84e6e', '#ec7e94', '#ffb8c4'],
  eye: '#2a1a28',
  cheek: '#ff8aa0',
};
const BODY = { x: 82, y: 51, rx: 24, ry: 8.5 };
const HEAD = { x: 53, y: 52, r: 9.5 }; // asleep, chin on its paws
const HEADUP = { x: 59, y: 35, r: 10.5 }; // awake
const TAIL = [[103, 54, 6.4], [111, 57, 6], [120, 62, 5.4], [128, 69, 4.8], [133, 78, 4.2], [132, 87, 3.6], [126, 92, 3.1], [120, 89, 2.7], [120, 83, 2.4], [125, 80, 2]];
const COINS = [[60, 151], [64, 153], [69, 152], [88, 153], [93, 151], [97, 153], [73, 154], [83, 155]];

// ---------- painting ----------

/** A round tower: stone courses shaded round the drum, a rounded foot. */
function towerBody(b, cx, top, bottom, seed) {
  for (let y = top; y < bottom + 3; y += 1) for (let x = cx - TR; x < cx + TR; x += 1) {
    const u = (x + 0.5 - cx) / TR;
    if (y >= bottom && !inEll(x, y, cx, bottom, TR, 3)) continue;
    let c = masonry(x * 1.0 + (u * u * 6 | 0), y, { bw: 9, bh: 5, seed, lit: u < -0.55 ? 1 : u > 0.5 ? -1 : 0 });
    if (Math.abs(u) > 0.9) c = u < 0 ? St[4] : St[1];
    else if (u > 0.72 && bayer(x, y) < 0.5) c = St[2];
    b.set(x, y, c, tg('stone', St[3]));
  }
  // a band of corbels under the roof
  for (let x = cx - TR; x < cx + TR; x += 1) { b.set(x, top, St[5], tg('stone', St[3])); if ((x - cx + 40) % 5 < 3) { b.set(x, top + 1, St[4], tg('stone', St[3])); b.set(x, top + 2, St[2], tg('stone', St[3])); } }
}

/** The tail, a chain of round puffs tapering to a heart-shaped tip. */
function tailPuffs(b) {
  const pts = [];
  for (let i = 1; i < TAIL.length; i += 1) {
    const [x0, y0, r0] = TAIL[i - 1]; const [x1, y1, r1] = TAIL[i];
    for (let t = 0; t < 1; t += 0.2) pts.push([x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, r0 + (r1 - r0) * t]);
  }
  pts.forEach(([cx, cy, r], i) => {
    for (let y = Math.floor(cy - r - 1); y <= cy + r + 1; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) > r) continue;
      const s = ((x + 0.5 - cx) * 0.7 + (y + 0.5 - cy) * 0.9) / r;
      b.set(x, y, s < -0.5 ? DR.body[4] : s < 0.15 ? DR.body[3] : s < 0.6 ? DR.body[2] : DR.body[1], tg('body', DR.body[2]));
    }
    // little spikes along its top
    if (i % 5 === 2 && i < pts.length - 6) { b.set(Math.round(cx - r * 0.3), Math.round(cy - r - 1), Au[3], tg('horn', Au[2])); b.set(Math.round(cx - r * 0.3), Math.round(cy - r - 2), Au[4], tg('horn', Au[2])); }
  });
  // the heart-shaped tip
  const [tx, ty] = TAIL[TAIL.length - 1];
  grid((x, y, c) => b.set(x, y, c, tg('wing', DR.wing[2])), tx - 1, ty - 4, ['.ww.ww', 'wWWwWw', 'wWwwww', '.wwwd.', '..wd..'], { w: DR.wing[2], W: DR.wing[3], d: DR.wing[1] });
}

function paintGate() {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // soft shadows on the grass
  for (let y = 140; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const e = ((x + 0.5 - 80) / 78) ** 2 + ((y + 0.5 - 151) / 6) ** 2;
    if (e < 1 && bayer(x, y) < 0.7) px(x, y, `rgba(42,24,56,${e < 0.5 ? 0.22 : 0.12})`);
  }
  const b = new Buf(W, H, 2);

  // ---------- the gate block ----------
  for (let y = 58; y < ARCH.floor + 1; y += 1) for (let x = BLOCK[0]; x < BLOCK[1]; x += 1) {
    const merlon = y < 66;
    if (merlon && ((x - BLOCK[0]) % 12) > 6) continue;
    let c;
    if (merlon) c = y === 58 ? St[6] : (x - BLOCK[0]) % 12 === 0 ? St[5] : (x - BLOCK[0]) % 12 === 6 ? St[2] : St[4];
    else if (y < 70) c = y === 66 ? St[2] : (x % 6 < 4 ? (y === 67 ? St[5] : St[3]) : St[1]); // corbels
    else c = masonry(x, y, { bw: 10, bh: 5, seed: 31 });
    b.set(x, y, c, tg('stone', St[3]));
  }
  // the arch: dressed voussoirs round a dark passage, gold heaped inside, lit by its own glow
  for (let y = ARCH.spring - ARCH.r - 4; y < ARCH.floor; y += 1) for (let x = ARCH.x - ARCH.r - 4; x < ARCH.x + ARCH.r + 4; x += 1) {
    const dTop = Math.hypot(x + 0.5 - ARCH.x, y + 0.5 - ARCH.spring);
    const inside = y + 0.5 < ARCH.spring ? dTop <= ARCH.r : Math.abs(x + 0.5 - ARCH.x) <= ARCH.r;
    const ring = !inside && (y + 0.5 < ARCH.spring ? dTop <= ARCH.r + 4 : Math.abs(x + 0.5 - ARCH.x) <= ARCH.r + 4);
    if (ring) {
      const a = Math.atan2(y + 0.5 - ARCH.spring, x + 0.5 - ARCH.x);
      const k = y + 0.5 < ARCH.spring ? Math.floor((a + Math.PI) * 3.4) : Math.floor(y / 6);
      const lit = x < ARCH.x;
      b.set(x, y, (y + 0.5 < ARCH.spring ? Math.abs((a + Math.PI) * 3.4 - k) < 0.12 : y % 6 === 5) ? St[2] : k % 2 ? (lit ? St[6] : St[4]) : (lit ? St[5] : St[3]), tg('stone', St[3]));
    } else if (inside) {
      // deep inside: dark at the top, glowing gold below
      const g = clamp((y - (ARCH.spring - 10)) / 36, 0, 1);
      const DEEP = ['#1a1028', '#2a1a30', '#3e2430', '#5a3428', '#7a4a28', '#9a6028', '#b8782c'];
      let c = DEEP[Math.min(DEEP.length - 1, Math.floor(g * (DEEP.length - 1) + bayer(x, y)))];
      // the heap of gold
      const heap = ARCH.floor - 2 - (1 - ((x + 0.5 - ARCH.x) / ARCH.r) ** 2) * 13;
      if (y > heap) {
        const n = h2(x, y, 7);
        c = n < 0.18 ? Au[1] : n < 0.6 ? Au[2] : n < 0.92 ? Au[3] : Au[4];
        if ((x + y * 2) % 7 === 0) c = Au[1];
      }
      b.set(x, y, c, tg('glow', Au[2]));
    }
  }
  // a goblet and a crown on the heap
  grid((x, y, c) => b.set(x, y, c, tg('glow', Au[2])), ARCH.x - 11, ARCH.floor - 14, ['GgG', '.g.', '.g.', 'ggg'], { G: Au[4], g: Au[2] });
  grid((x, y, c) => b.set(x, y, c, tg('glow', Au[2])), ARCH.x + 5, ARCH.floor - 15, ['g.g.g', 'ggggg', 'gRgBg'], { g: Au[3], R: '#ff5a6a', B: '#5ab0f0' });
  // the dragon crest over the arch: a shield with a little golden dragon
  grid((x, y, c) => b.set(x, y, c, tg('cloth', '#2f6ac0')), ARCH.x - 7, 72, [
    'kkkkkkkkkkkkkk',
    'kBBBBBBBBBBBBk',
    'kBBBBggBBBBBBk',
    'kBBBgggBBgBBBk',
    'kBBggggggggBBk',
    'kBBBggggggBBBk',
    'kBBBgBBBBgBBBk',
    '.kBBBBBBBBBBk.',
    '..kBBBBBBBBk..',
    '...kkBBBBkk...',
    '.....kkkk.....',
  ], { k: '#1e3a78', B: '#3a7ad8', g: Au[3] });
  // the step, with coins spilling out of the gate
  for (let y = ARCH.floor - 1; y < ARCH.floor + 4; y += 1) for (let x = ARCH.x - 24; x < ARCH.x + 24; x += 1) {
    if (y > ARCH.floor + 1 && (x < ARCH.x - 22 || x > ARCH.x + 21)) continue;
    b.set(x, y, y < ARCH.floor + 1 ? St[6] : St[4], tg('stone', St[4]));
  }

  // ---------- the towers ----------
  TOWERS.forEach((cx, i) => towerBody(b, cx, 58, ARCH.floor, 41 + i));
  // their windows (dark here; they glow in the overlay) and arrow slits
  WINDOWS.forEach(([cx, wy]) => {
    for (let y = wy - 3; y < wy + 15; y += 1) for (let x = cx - 7; x < cx + 7; x += 1) {
      const inW = y + 0.5 < wy + 2 ? Math.hypot(x + 0.5 - cx, y + 0.5 - (wy + 2)) <= 4.5 : Math.abs(x + 0.5 - cx) <= 4.5 && y < wy + 12;
      const ring = !inW && (y + 0.5 < wy + 2 ? Math.hypot(x + 0.5 - cx, y + 0.5 - (wy + 2)) <= 6.5 : Math.abs(x + 0.5 - cx) <= 6.5 && y < wy + 14);
      if (inW) b.set(x, y, Math.abs(x + 0.5 - cx) < 0.6 || y === wy + 5 ? Tb[1] : '#3a2438', tg('glow', Gl[1]));
      else if (ring) b.set(x, y, y >= wy + 12 ? St[6] : x < cx ? St[5] : St[3], tg('stone', St[3]));
    }
    for (let y = 66; y < 76; y += 1) { b.set(cx - 1, y, '#1a1028', tg('glow', '#1a1028')); b.set(cx, y, '#2a1a30', tg('glow', '#1a1028')); }
  });
  // ivy up the left tower and over the arch
  const ivy = (x0, y0, n, dir, seed) => {
    for (let k = 0; k < n; k += 1) {
      const x = Math.round(x0 + Math.sin(k * 0.5 + seed) * 2.5 + k * 0.15 * dir); const y = y0 - k;
      b.set(x, y, k % 2 ? LF[3] : LF[2], tg('leaf', LF[3]));
      if (k % 3 === 0) { b.set(x + 1, y, LF[4], tg('leaf', LF[3])); b.set(x - 1, y + 1, LF[3], tg('leaf', LF[3])); }
      if (k % 4 === 1) { b.set(x + 2 * dir, y - 1, LF[2], tg('leaf', LF[3])); b.set(x + 2 * dir, y, LF[4], tg('leaf', LF[3])); }
    }
  };
  ivy(8, 150, 70, 1, 0); ivy(15, 148, 40, 1, 2); ivy(60, 112, 24, 1, 4);
  // the torch brackets
  TORCHES.forEach(([x, y]) => { for (let k = 0; k < 7; k += 1) b.set(x, y + k, k < 2 ? Wd[4] : Wd[2], tg('wood', Wd[3])); b.set(x - 1, y + 4, '#5a5470', tg('metal', '#5a5470')); b.set(x + 1, y + 4, '#5a5470', tg('metal', '#5a5470')); b.set(x - 1, y - 1, '#4a4460', tg('metal', '#5a5470')); b.set(x + 1, y - 1, '#4a4460', tg('metal', '#5a5470')); });
  // the roofs
  TOWERS.forEach((cx) => coneRoof(b, cx, 60, TR + 5, 50, Sl, tg('roof', Sl[2])));

  // ---------- the baby dragon, asleep along the battlements ----------
  for (let y = Math.floor(BODY.y - BODY.ry - 1); y <= BODY.y + BODY.ry + 1; y += 1) for (let x = Math.floor(BODY.x - BODY.rx - 1); x <= BODY.x + BODY.rx + 1; x += 1) {
    if (!inEll(x, y, BODY.x, BODY.y, BODY.rx, BODY.ry)) continue;
    const u = (x + 0.5 - BODY.x) / BODY.rx; const v = (y + 0.5 - BODY.y) / BODY.ry;
    let c;
    if (v > 0.35) c = (y - BODY.y) % 3 === 0 ? DR.belly[0] : v > 0.75 ? DR.belly[1] : DR.belly[2]; // its tummy, in soft bands
    else { const s = u * 0.5 + v * 0.9; c = s < -0.55 ? DR.body[4] : s < -0.1 ? DR.body[3] : s < 0.3 ? DR.body[2] : DR.body[1]; }
    b.set(x, y, c, tg('body', DR.body[2]));
  }
  // spikes down its back
  [64, 71, 78, 85, 92, 99].forEach((x, i) => grid((xx, yy, c) => b.set(xx, yy, c, tg('horn', Au[2])), x - 1, Math.round(BODY.y - BODY.ry * Math.sqrt(Math.max(0, 1 - ((x - BODY.x) / BODY.rx) ** 2))) - 2 - (i % 2), ['.a.', 'aAa'], { a: Au[2], A: Au[3] }));
  tailPuffs(b);
  // paws hanging over the edge, and a back foot
  [[47, 59], [57, 60], [98, 58]].forEach(([x, y], i) => grid((xx, yy, c) => b.set(xx, yy, c, tg('body', DR.body[2])), x, y, i < 2 ? ['.bbbb.', 'bBBBbb', 'bbbbbb', 'c.c.c.'] : ['.bbb.', 'bBBbb', 'c.c.c'], { b: DR.body[3], B: DR.body[4], c: '#fff4dc' }));

  b.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'glow') return null;
    if (k === 'body' || k === 'wing') return side === 'bottom' || side === 'right' ? DR.body[0] : mix(DR.body[1], INK, 0.3);
    if (k === 'horn') return Au[0];
    return sel(t, side);
  });
  b.blit(px, 0, 0);
  // the glow of the gold spilling onto the step and the stones round the arch
  for (let y = ARCH.spring - 2; y < H; y += 1) for (let x = ARCH.x - 30; x < ARCH.x + 30; x += 1) {
    const d = Math.hypot((x + 0.5 - ARCH.x) / 30, (y + 0.5 - ARCH.floor) / 26);
    if (d > 1 || bayer(x, y) > (1 - d) * 0.8) continue;
    px(x, y, 'rgba(255,200,90,0.16)');
  }
  COINS.forEach(([x, y], i) => { px(x, y, i % 2 ? Au[3] : Au[2], 2, 1); px(x, y + 1, Au[1], 2, 1); });
  return new ImageData(out.data, W, H);
}

let base = null;
const gateBase = () => (base ||= paintGate());

// ---------- sprites for the overlay, each outlined once and kept as a small canvas ----------

function sprite(w, h, draw, outline = true) {
  const pad = 2;
  const b = new Buf(w, h, pad);
  draw(b);
  if (outline) b.outline((t, side) => (side === 'bottom' || side === 'right' ? DR.body[0] : mix(DR.body[1], INK, 0.3)));
  const pb = pixelBuffer(w + pad * 2, h + pad * 2);
  b.blit(pb.px, pad, pad);
  const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
  pb.put(c.getContext('2d'));
  return c;
}

/** The dragon's round head: o.awake faces us, eyes open; asleep it lies chin-down facing left, eyes shut. */
function headSprite(o = {}) {
  const r = o.awake ? HEADUP.r : HEAD.r;
  const S = Math.ceil(r) + 10;
  return sprite(S * 2, S * 2, (b) => {
    const cx = S; const cy = S;
    const put = (x, y, c, k = 'body') => b.set(x, y, c, tg(k, DR.body[2]));
    // horns and little frills, behind the head
    if (o.awake) {
      for (const s of [-1, 1]) for (let k = 0; k < 7; k += 1) { const x = Math.round(cx + s * (5 + k * 0.45)); const y = Math.round(cy - r + 2 - k); put(x, y, k > 4 ? Au[4] : Au[2], 'horn'); put(x + s, y, Au[1], 'horn'); }
      for (const s of [-1, 1]) grid((x, y, c) => put(x, y, c, 'wing'), cx + s * (r + 1) - 2, cy - 4, s < 0 ? ['.ww', 'wWw', 'ww.'] : ['ww.', 'wWw', '.ww'], { w: DR.wing[2], W: DR.wing[3] });
    } else {
      for (let k = 0; k < 7; k += 1) { put(Math.round(cx + 4 + k * 0.9), Math.round(cy - r + 3 - k * 0.5), k > 4 ? Au[4] : Au[2], 'horn'); put(Math.round(cx + 4 + k * 0.9), Math.round(cy - r + 4 - k * 0.5), Au[1], 'horn'); }
      grid((x, y, c) => put(x, y, c, 'wing'), cx + r - 3, cy - 5, ['ww.', 'wWw', '.ww'], { w: DR.wing[2], W: DR.wing[3] });
    }
    // the head
    for (let y = cy - S; y < cy + S; y += 1) for (let x = cx - S; x < cx + S; x += 1) {
      if (Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05) > r) continue;
      const s = ((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.9) / r;
      put(x, y, s < -0.55 ? DR.body[5] : s < -0.15 ? DR.body[4] : s < 0.35 ? DR.body[3] : DR.body[2]);
    }
    // the snout: a soft round muzzle, lighter
    const mx = o.awake ? cx : cx - r + 1; const my = o.awake ? cy + 5 : cy + 2.5; const mrx = o.awake ? 5 : 5.5; const mry = o.awake ? 3 : 4;
    for (let y = Math.floor(my - mry); y <= my + mry; y += 1) for (let x = Math.floor(mx - mrx); x <= mx + mrx; x += 1) {
      if (!inEll(x, y, mx, my, mrx, mry)) continue;
      put(x, y, o.awake ? (y + 0.5 < my - mry * 0.3 ? DR.body[5] : DR.body[4]) : (y + 0.5 < my - mry * 0.4 ? DR.belly[3] : y + 0.5 > my + mry * 0.5 ? DR.belly[1] : DR.belly[2]));
    }
    // nostrils
    if (o.awake) { put(Math.round(mx) - 2, Math.round(my) - 2, DR.body[1]); put(Math.round(mx) + 1, Math.round(my) - 2, DR.body[1]); } else { put(Math.round(mx - mrx) + 2, Math.round(my) - 1, DR.body[1]); put(Math.round(mx - mrx) + 2, Math.round(my), DR.body[1]); }
  });
}

function wingSprite(up) {
  // two bat wings from the shoulders: an arm along the leading edge to a clawed wrist, three fingers
  // fanning out from it, and a membrane scalloped between the finger tips. Up is the beat's top.
  const W = up
    ? { S: [44, 34], E: [50, 17], T: [60, 3], F: [[73, 9], [72, 21], [61, 31]] }
    : { S: [44, 34], E: [54, 21], T: [68, 10], F: [[75, 19], [72, 29], [59, 35]] };
  const P = [W.S, W.E, W.T, ...W.F];
  const segD = ([ax, ay], [bx, by], x, y) => {
    const dx = bx - ax; const dy = by - ay; const L2 = dx * dx + dy * dy;
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
    return [Math.hypot(x - ax - dx * t, y - ay - dy * t), t, ((x - ax) * dy - (y - ay) * dx) / Math.sqrt(L2)];
  };
  const inside = (x, y) => {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i, i += 1) {
      const [xi, yi] = P[i]; const [xj, yj] = P[j];
      if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const trail = [[W.T, W.F[0]], [W.F[0], W.F[1]], [W.F[1], W.F[2]], [W.F[2], W.S]];
  const cell = (x, y) => {
    // the arm: lit along its outer edge
    const arm = Math.min(segD(W.S, W.E, x, y)[0], segD(W.E, W.T, x, y)[0]);
    const side = segD(W.E, W.T, x, y)[2];
    if (arm < 1.45) return [arm < 0.7 ? DR.body[3] : side < 0 ? DR.body[4] : DR.body[2], 'body'];
    if (!inside(x, y)) return null;
    // the scallops between the finger tips
    let edge = 9;
    for (const [A, B] of trail) {
      const [d, t] = segD(A, B, x, y); const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
      const bite = Math.min(3.2, L * 0.24) * Math.sin(Math.PI * t);
      if (d < bite) return null;
      edge = Math.min(edge, d - bite);
    }
    // the fingers
    for (const F of W.F) if (segD(W.T, F, x, y)[0] < 0.62) return [DR.body[2], 'body'];
    // the membrane: lit by the arm, deeper at the trailing edge, the panels between fingers alternate
    const a = Math.atan2(y - W.T[1], x - W.T[0]);
    const panel = W.F.filter(([fx, fy]) => Math.atan2(fy - W.T[1], fx - W.T[0]) < a).length;
    const shade = panel % 2 ? mix(DR.wing[2], DR.wing[1], 0.3) : DR.wing[2];
    if (arm < 2.6) return [DR.wing[3], 'wing'];
    if (edge < 1.2) return [DR.wing[1], 'wing'];
    return [shade, 'wing'];
  };
  return sprite(76, 40, (b) => {
    for (let y = 0; y < 40; y += 1) for (let x = 38; x < 76; x += 1) {
      const c = cell(x + 0.5, y + 0.5);
      if (!c) continue;
      b.set(x, y, c[0], tg(c[1], DR.wing[2]));
      b.set(75 - x, y, c[0], tg(c[1], DR.wing[2]));
    }
    // a little claw at each wrist
    for (const s of [1, -1]) {
      const cx = s > 0 ? W.T[0] : 75 - W.T[0];
      b.set(cx, W.T[1] - 1, Au[3], tg('horn', Au[3])); b.set(cx - s, W.T[1] - 2, Au[4], tg('horn', Au[3]));
    }
  });
}

function foldedWing() {
  return sprite(24, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 24; x += 1) {
      const top = x < 5 ? 9 - x * 1.8 : (x - 5) * 0.5;
      if (y < top || y > 11 - (x < 3 ? (3 - x) : 0) || (y > 9 && (x % 6) > 3)) continue;
      const rib = x === 8 || x === 15;
      b.set(x, y, Math.round(top) === y ? DR.body[3] : rib ? DR.wing[1] : y > 9 ? DR.wing[1] : DR.wing[2], tg('wing', DR.wing[2]));
    }
  });
}

/**
 * Starts the gatehouse on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes the dragon for a
 * while. While the map's show plays (the village has .show-on) it stays up to watch.
 */
export function startGate(canvas, host) {
  const ctx = canvas.getContext('2d');
  const img = gateBase();
  const SP = {
    sleep: headSprite(), awake: headSprite({ awake: true }), up: wingSprite(true), down: wingSprite(false), folded: foldedWing(),
  };
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(X + x, Y + y, c); } });
  const blit = (c, x, y) => ctx.drawImage(c, Math.round(x - c.width / 2), Math.round(y - c.height / 2));
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 4800);
    ctx.putImageData(img, 0, 0);

    // windows glow, torches flicker
    WINDOWS.forEach(([cx, wy], i) => {
      const g = 0.75 + 0.25 * Math.sin(t * 2.1 + i * 2);
      ctx.fillStyle = `rgba(255,${190 + Math.round(30 * g)},110,${(0.55 + 0.35 * g).toFixed(2)})`;
      for (let y = wy - 2; y < wy + 12; y += 1) for (let x = cx - 4; x < cx + 5; x += 1) {
        const inW = y + 0.5 < wy + 2 ? Math.hypot(x + 0.5 - cx, y + 0.5 - (wy + 2)) <= 4.3 : Math.abs(x + 0.5 - cx) <= 4.3;
        if (inW && !(Math.abs(x + 0.5 - cx) < 0.6 || y === wy + 5)) ctx.fillRect(x, y, 1, 1);
      }
    });
    TORCHES.forEach(([x, y], i) => {
      const k = (f + i * 2) % 4;
      rows(k < 2 ? ['.y.', 'yYy', 'oYo', '.o.'] : ['y..', '.yy', 'oYy', '.o.'], x - 1, y - 5, { y: '#ffd860', Y: '#fff6c8', o: '#ff8a3a' });
      if (k === 1) dot(x + (i ? 1 : -1), y - 7, 'rgba(255,220,140,0.8)');
    });
    // pennants on the roofs, waving
    TOWERS.forEach((cx, i) => {
      const k = (f + i * 3) % 6 < 3;
      ctx.fillStyle = Tb[2]; ctx.fillRect(cx, 0, 1, 11);
      dot(cx, 0, Au[3]);
      rows(k ? ['pppppp', 'pPPPpppp', 'ppppp', 'pp'] : ['ppppp', 'pPPPppp', 'pppppp.p', 'pp'], cx + 1, 1, { p: i ? '#fcc419' : '#e64980', P: i ? '#fff0a0' : '#ff9ac0' });
    });
    // the gold glints
    for (let k = 0; k < (awake ? 4 : 2); k += 1) {
      const p = (t * 0.8 + k * 0.41) % 1;
      if (p > 0.3) continue;
      const n = Math.floor(t * 0.8 + k * 0.41) * 7 + k * 5;
      const x = ARCH.x - 12 + (n * 13) % 25; const y = ARCH.floor - 4 - ((n * 7) % 9);
      dot(x, y, '#ffffff');
      if (p < 0.15) { dot(x - 1, y, 'rgba(255,255,255,0.7)'); dot(x + 1, y, 'rgba(255,255,255,0.7)'); dot(x, y - 1, 'rgba(255,255,255,0.7)'); dot(x, y + 1, 'rgba(255,255,255,0.7)'); }
    }
    // the portcullis: it creaks up a little while the dragon is awake
    const lift = awake ? clamp((show ? 1500 : since) / 900, 0, 1) * (show ? 1 : clamp((4800 - since) / 900, 0, 1)) : 0;
    const bottom = Math.round(PORT.down - (PORT.down - PORT.up) * lift);
    for (let y = ARCH.spring - ARCH.r; y <= bottom; y += 1) for (let x = ARCH.x - ARCH.r; x <= ARCH.x + ARCH.r; x += 1) {
      const inA = y + 0.5 < ARCH.spring ? Math.hypot(x + 0.5 - ARCH.x, y + 0.5 - ARCH.spring) <= ARCH.r - 0.5 : Math.abs(x + 0.5 - ARCH.x) <= ARCH.r - 0.5;
      if (!inA) continue;
      const vx = (x - ARCH.x + 40) % 5; const hy = (bottom - y) % 6;
      if (vx === 0) { ctx.fillStyle = y === bottom ? '#8a84a0' : '#4a4460'; ctx.fillRect(x, y, 1, 1); if (y === bottom) { ctx.fillStyle = '#4a4460'; ctx.fillRect(x, y + 1, 1, 1); } } else if (vx === 1) { ctx.fillStyle = '#2a2438'; ctx.fillRect(x, y, 1, 1); } else if (hy === 0 && y < bottom) { ctx.fillStyle = '#5a5470'; ctx.fillRect(x, y, 1, 1); }
    }

    // ---------- the baby dragon ----------
    if (!awake) {
      // asleep: wings folded, it breathes, the tip of its tail twitches now and then
      const br = Math.sin(t * 1.4) > 0.3 ? 1 : 0;
      blit(SP.folded, 83, 42 - br);
      blit(SP.sleep, HEAD.x, HEAD.y + (br ? 0 : 0.6));
      const hy = HEAD.y + (br ? 0 : 1);
      // closed eye, a rosy cheek
      const peek = (t % 11) > 8.6 && (t % 11) < 9.9;
      if (peek) rows(['.ooo.', 'oWWko', 'oWkko', '.ooo.'], HEAD.x - 3, hy - 4, { o: DR.body[0], W: '#ffffff', k: DR.eye });
      else rows(['o...o', '.ooo.'], HEAD.x - 3, hy - 2, { o: DR.body[0] });
      rows(['pP'], HEAD.x - 2, hy + 1, { p: DR.cheek, P: '#ffc0cc' });
      // little smoke puffs from its nose
      for (let k = 0; k < 2; k += 1) {
        const p = (t / 3.2 + k * 0.5) % 1;
        if (p > 0.8) continue;
        const x = HEAD.x - 11 - p * 6 + Math.sin(p * 7) * 1.5; const y = hy - 1 - p * 16; const a = (0.75 - p * 0.8).toFixed(2);
        const r = p < 0.3 ? 1 : 2;
        ctx.fillStyle = `rgba(236,232,244,${a})`; ctx.fillRect(Math.round(x - r / 2), Math.round(y - r / 2), r + 1, r);
      }
      const tw = (t % 7) < 0.9 ? Math.round(Math.sin(t * 16)) : 0;
      if (tw) { const [tx, ty] = TAIL[TAIL.length - 1]; rows(['.ww.ww', 'wWWwWw', 'wWwwww', '.wwwd.', '..wd..'], tx - 1 + tw, ty - 4 - Math.abs(tw), { w: DR.wing[2], W: DR.wing[3], d: DR.wing[1] }); }
      return;
    }

    // awake: it lifts its head, opens its wings, sneezes a spark and counts its coins
    const up = show ? 1 : clamp(since / 450, 0, 1) * clamp((4800 - since) / 450, 0, 1);
    const beat = (f % 4) < 2;
    if (up > 0.5) blit(beat ? SP.up : SP.down, 88, 26 + (1 - up) * 10);
    else blit(SP.folded, 83, 42);
    const hx = HEAD.x + (HEADUP.x - HEAD.x) * up; const hy = HEAD.y + (HEADUP.y - HEAD.y) * up + (beat && up > 0.9 ? -1 : 0);
    // its neck: an outline pass, then the fill
    for (const pass of [1, 0]) {
      for (let k = 0; k <= 4; k += 1) {
        const u = k / 4; const nx = Math.round(hx + (66 - hx) * u); const ny = Math.round(hy + 6 + (47 - hy - 6) * u); const r = 5.5 + u;
        for (let y = Math.floor(ny - r - 1); y <= ny + r + 1; y += 1) for (let x = Math.floor(nx - r - 1); x <= nx + r + 1; x += 1) {
          const d = Math.hypot(x + 0.5 - nx, y + 0.5 - ny);
          if (d > r + pass) continue;
          if (pass) { dot(x, y, DR.body[0]); continue; }
          dot(x, y, (x + 0.5 - nx) > r * 0.3 ? DR.body[2] : (x + 0.5 - nx) < -r * 0.4 ? DR.body[4] : (y + 0.5 - ny) > 0 && Math.abs(x + 0.5 - nx) < r * 0.4 ? DR.belly[2] : DR.body[3]);
        }
      }
    }
    blit(SP.awake, hx, hy);
    const ex = Math.round(hx); const ey = Math.round(hy);
    const sneeze = !show && since > 1300 && since < 1900;
    const blink = sneeze || (since > 2200 && since % 1600 < 140);
    [-4, 4].forEach((dx) => {
      if (blink) rows(sneeze ? ['o...o', '.ooo.'] : ['ooooo'], ex + dx - 2, ey - 2, { o: DR.body[0] });
      else rows(['.ooo.', 'oWWko', 'oWkKo', 'okkko', '.ooo.'], ex + dx - 2, ey - 4, { o: DR.body[0], W: '#ffffff', k: DR.eye, K: '#ffffff' });
    });
    rows(['pP'], ex - 8, ey + 2, { p: DR.cheek, P: '#ffc0cc' }); rows(['Pp'], ex + 7, ey + 2, { p: DR.cheek, P: '#ffc0cc' });
    if (sneeze) rows(['.ooo.', 'oRRRo', '.ooo.'], ex - 2, ey + 6, { o: DR.body[0], R: '#c83a5a' });
    else rows(['o...o', 'oRRRo', '.oWo.'], ex - 2, ey + 6, { o: DR.body[0], R: '#c83a5a', W: '#ffffff' });
    // the sneeze: a little cloud puffs out of its nose and drifts off, and sparks pop out and fall
    if (!show && since > 1500 && since < 2700) {
      const u = (since - 1500) / 1200;
      const r = 3 + u * 3.5; const cx = ex - 7 - u * 12; const cy = ey + 9 - u * 3;
      const blobs = [[cx - r * 0.7, cy + r * 0.15, r * 0.75], [cx + r * 0.55, cy - r * 0.1, r * 0.7], [cx, cy - r * 0.35, r]];
      const inC = (x, y, g = 0) => blobs.some(([bx, by, br]) => Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= br + g);
      for (let y = Math.floor(cy - r * 1.5 - 2); y <= cy + r + 2; y += 1) for (let x = Math.floor(cx - r * 1.6 - 2); x <= cx + r * 1.4 + 2; x += 1) {
        if (bayer(x, y) < u * 1.25 - 0.25) continue; // it thins away, pixel by pixel
        if (inC(x, y)) dot(x, y, y + 0.5 > cy + r * 0.3 ? '#f2dccb' : '#fff8ee');
        else if (inC(x, y, 1)) dot(x, y, '#c9a092');
      }
      [[-44, 22], [-32, 32], [-22, 38], [22, 38], [32, 32], [44, 22]].forEach(([vx, vy], k) => {
        const x = Math.round(ex + Math.sign(vx) * 5 + vx * u); const y = Math.round(ey + 8 - vy * u + 36 * u * u);
        if (u < 0.6) rows(['.a.', 'aWa', '.a.'], x - 1, y - 1, { a: k % 2 ? '#ff9a3a' : '#ffb030', W: '#fff6c0' });
        else if (u < 0.85 || (f + k) % 2) dot(x, y, k % 2 ? '#ffd23f' : '#ff9a3a');
      });
    }
    // the coins hop up out of the heap, one, two, three
    const cs = show ? (now % 3000) : since - 2200;
    for (let k = 0; k < 3; k += 1) {
      const u = (cs - k * 500) / 700;
      if (u < 0 || u > 1) continue;
      const x = ARCH.x - 8 + k * 8; const y = ARCH.floor - 10 - Math.sin(u * Math.PI) * 18;
      rows(f % 2 ? ['.gg.', 'gGgg', '.gg.'] : ['.g.', 'gGg', '.g.'], x - 1, Math.round(y) - 1, { g: Au[2], G: Au[4] });
    }
  };
}
