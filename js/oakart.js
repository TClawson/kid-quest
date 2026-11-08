// The Great Oak, the Forest Village's landmark (it stands there once the meadow's treasure map
// is finished), drawn for the village in its storybook style: one village pixel per art pixel,
// the biggest thing in the village. Centuries old: a thick twisting trunk with deep furrows,
// burls and knots, huge mossy roots, heavy crooked limbs and a broad layered crown with acorns.
// A faint, friendly face hides in the bark, an owl lives in a hollow, a tiny door with a lantern
// sits in a root, and little glowing mushrooms ring its feet. A cheap overlay animates it:
// drifting motes, glows that breathe, the face's slow blink, the owl peeking out.

import { h2, vnoise, bayer, Buf, inEll, grid, pixelBuffer } from './pixelkit.js';

export const OAK = { w: 156, h: 152 };
const W = OAK.w; const H = OAK.h; const CX = 78;

const BK = ['#2a1a26', '#3e2834', '#56383c', '#6e4c42', '#886450', '#a48062', '#c4a27c']; // bark, dark .. light
const LV = ['#1a3436', '#22473c', '#2e6040', '#3f7c46', '#579a4e', '#7cb85a', '#a8d46c', '#d0ec8c']; // leaves
const WD = ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'];
const GLOW = ['#7a3a3a', '#c86a3a', '#f0a848', '#ffd878', '#fff4c8'];
const INK = '#3b2235';
const SHROOM = ['#4a9a98', '#7ad8c8', '#c8fff0']; // the glowing mushrooms: shade, cap, light

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
// the trunk: a twisting waist, flaring into its limbs above and its roots below, lumpy all the way
const TOP = 76; const BASE = 136;
const trunkX = (y) => CX - 1 + Math.sin((y - 60) / 13) * 3;
const flare = (y) => Math.max(0, 86 - y) * 0.9 + Math.max(0, y - 108) ** 2 * 0.026;
const hwL = (y) => 19 + flare(y) + Math.sin(y / 6.3) * 1.3 + Math.sin(y / 2.9 + 1) * 0.5;
const hwR = (y) => 19 + flare(y) + Math.sin(y / 5.7 + 2) * 1.3 + Math.sin(y / 3.1) * 0.5;

// where things are (art pixels)
const FX = Math.round(trunkX(94));
const EYES = [[FX - 8, 94], [FX + 7, 93]];
const MOUTH_Y = 107;
const HOLLOW = { x: 45, y: 69 };
const DOOR = { x: CX + 43, y: 118 };
const RING = [-15, 8, 30, 55, 82, 104, 125, 150, 172, 195].map((a, i) => { const r = (a * Math.PI) / 180; return [Math.round(CX + Math.cos(r) * 70), Math.round(140 + Math.sin(r) * 8), i % 2]; });

/**
 * A tapering curve (a limb or a root): paint(x, y, nx, ny, t, across) for each cell inside it, with
 * the cell's offset from the middle (in radii), how far along it is, and its signed offset across it.
 */
function tube(p0, p1, p2, r0, r1, paint) {
  const S = [];
  for (let i = 0; i <= 80; i += 1) {
    const t = i / 80; const a = (1 - t) * (1 - t); const b = 2 * (1 - t) * t; const c = t * t;
    const dx = 2 * (1 - t) * (p1[0] - p0[0]) + 2 * t * (p2[0] - p1[0]); const dy = 2 * (1 - t) * (p1[1] - p0[1]) + 2 * t * (p2[1] - p1[1]); const dl = Math.hypot(dx, dy) || 1;
    S.push([a * p0[0] + b * p1[0] + c * p2[0], a * p0[1] + b * p1[1] + c * p2[1], r0 + (r1 - r0) * t, t, dx / dl, dy / dl]);
  }
  const xs = S.map((s) => s[0]); const ys = S.map((s) => s[1]); const R = Math.max(r0, r1) + 1;
  for (let y = Math.floor(Math.min(...ys) - R); y <= Math.max(...ys) + R; y += 1) {
    for (let x = Math.floor(Math.min(...xs) - R); x <= Math.max(...xs) + R; x += 1) {
      let best = null; let bd = Infinity;
      for (const s of S) { const d = Math.hypot(x + 0.5 - s[0], y + 0.5 - s[1]) - s[2]; if (d < bd) { bd = d; best = s; } }
      if (bd > 0) continue;
      const nx = (x + 0.5 - best[0]) / best[2]; const ny = (y + 0.5 - best[1]) / best[2];
      paint(x, y, nx, ny, best[3], nx * best[5] - ny * best[4]);
    }
  }
}

/** Bark on a round limb or root: lit along its top, shaded below, with grooves along the grain. */
const barkTone = (x, y, nx, ny, k0 = 3, t = 0, across = 0, len = 1) => {
  let k = k0 + Math.round(-(nx * 0.5 + ny * 0.9) * 1.8 + (bayer(x, y) - 0.5) * 0.7);
  const g = across * 2.6 + Math.sin(t * len * 0.35) * 0.35 + (vnoise(x, y, 5, 13) - 0.5) * 0.5;
  const f = g - Math.floor(g);
  if (f < 0.15) k -= 2; else if (f < 0.26) k += 1;
  else if (h2(x >> 1, y, 7) < 0.08) k -= 1;
  return BK[clamp(k, 1, 6)];
};

// the crown: a dark mass of leaves behind the limbs, then clumps in front, back to front [x, y, rx, ry, layer]
const BACK = [[78, 38, 74, 30], [28, 54, 26, 17], [128, 54, 26, 17], [78, 54, 46, 14]];
const CLUMPS = [
  [24, 44, 22, 17, 0], [50, 28, 26, 20, 0], [78, 20, 30, 19, 0], [106, 28, 26, 20, 0], [132, 44, 22, 17, 0], [10, 58, 12, 10, 0], [146, 58, 12, 10, 0], [78, 40, 34, 16, 0], [22, 62, 14, 9, 0], [134, 62, 14, 9, 0],
  [34, 38, 16, 13, 1], [60, 22, 18, 14, 1], [96, 20, 18, 13, 1], [122, 38, 16, 13, 1], [78, 36, 22, 13, 1], [44, 50, 14, 9, 1], [112, 50, 14, 9, 1], [18, 52, 10, 8, 1], [138, 52, 10, 8, 1],
  [46, 28, 12, 9, 2], [74, 13, 14, 10, 2], [100, 16, 12, 9, 2], [28, 46, 10, 8, 2], [128, 46, 10, 8, 2], [62, 40, 10, 7, 2], [96, 38, 10, 7, 2], [78, 47, 12, 7, 2],
].map(([x, y, rx, ry, layer], i) => ({ x, y, rx, ry, layer, s: i * 1.7 }));
const inClump = (c, x, y) => {
  const dx = (x + 0.5 - c.x) / c.rx; const dy = (y + 0.5 - c.y) / c.ry; const a = Math.atan2(dy, dx);
  const r = 1 + 0.07 * Math.sin(a * 9 + c.s) + 0.04 * Math.sin(a * 17 + c.s * 2);
  return dx * dx + dy * dy <= r * r;
};
const CROWN_H = 80;

function paintOak() {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // a soft shadow on the ground under it all
  for (let y = 120; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const d = ((x + 0.5 - CX) / 76) ** 2 + ((y + 0.5 - 140) / 11) ** 2;
    if (d <= 1) px(x, y, `rgba(30,22,52,${d < 0.45 ? 0.26 : 0.13})`);
  }
  const b = new Buf(W, H, 3);
  const bark = (x, y, c, t = 'bark') => b.set(x, y, c, t);

  // the dark heart of the crown, behind the limbs
  for (let y = 0; y < CROWN_H; y += 1) for (let x = 0; x < W; x += 1) {
    const wob = Math.sin(x / 4.3) * 1.6 + Math.sin(x / 2.1 + 1) * 0.7;
    if (!BACK.some(([cx, cy, rx, ry]) => inEll(x, y - (y > cy ? wob : 0), cx, cy, rx, ry))) continue;
    const n = vnoise(x, y, 4, 31);
    b.set(x, y, n > 0.68 ? LV[2] : (y > 60 && bayer(x, y) < (y - 60) / 12) ? LV[0] : LV[1], 'leaf:back');
  }
  // roots behind the trunk, then the trunk
  [[[CX - 22, 118], [CX - 36, 115], [CX - 48, 121], 5], [[CX + 22, 116], [CX + 34, 112], [CX + 46, 116], 5]].forEach(([p0, p1, p2, r]) => tube(p0, p1, p2, r, 2, (x, y, nx, ny) => bark(x, y, barkTone(x, y, nx, ny, 2))));
  for (let y = TOP; y <= BASE; y += 1) {
    const cx = trunkX(y); const l = hwL(y); const r = hwR(y);
    for (let x = Math.floor(cx - l); x <= cx + r; x += 1) {
      const u = x + 0.5 < cx ? (x + 0.5 - cx) / l : (x + 0.5 - cx) / r;
      if (Math.abs(u) > 1) continue;
      let k = 5 - Math.floor(clamp((u + 1) * 2.3 + (bayer(x, y) - 0.5) * 0.7, 0, 4.99));
      // deep furrows twisting round the trunk, each with a lit ridge beside it
      const p = u * 4.6 + y / 11 + Math.sin(y / 15) * 0.8 + (vnoise(x, y, 7, 3) - 0.5) * 0.8;
      const f = p - Math.floor(p);
      // the bark is a little smoother round the face, so it can be made out on a second look
      const calm = inEll(x, y, FX, 101, 15, 13);
      if (f < 0.17) k -= calm ? 1 : 2; else if (f < 0.29 && !calm) k += 1;
      if (h2(x, y >> 2, 5) < 0.04) k -= 1;
      let c = BK[clamp(k, 0, 6)];
      // moss up the shady foot of the trunk
      if (u < -0.5 && y > 110 && vnoise(x, y, 4, 9) > 0.5) c = vnoise(x, y, 2, 4) > 0.55 ? LV[5] : LV[4];
      bark(x, y, c);
    }
  }
  // roots spreading over the ground in front: crooked, knobbly, mossy on top
  [
    [[CX - 26, 124], [CX - 40, 124], [CX - 52, 131], 9, 5], [[CX - 52, 131], [CX - 62, 136], [CX - 74, 136], 5, 1.5],
    [[CX - 16, 130], [CX - 20, 138], [CX - 32, 143], 8, 4], [[CX - 32, 143], [CX - 40, 147], [CX - 50, 146], 4, 1.3],
    [[CX + 1, 133], [CX - 1, 141], [CX + 6, 146], 6, 1.5],
    [[CX + 15, 131], [CX + 22, 139], [CX + 34, 142], 8, 3.5], [[CX + 34, 142], [CX + 42, 145], [CX + 52, 144], 3.5, 1.3],
    [[CX + 22, 120], [CX + 38, 117], [CX + 50, 127], 11, 7], [[CX + 50, 127], [CX + 60, 135], [CX + 74, 134], 7, 1.5],
  ].forEach(([p0, p1, p2, r0, r1], i) => tube(p0, p1, p2, r0, r1, (x, y, nx, ny, t, across) => {
    let c = barkTone(x, y, nx, ny, 3, t, across, 30);
    if (ny < -0.15 && vnoise(x, y, 4, 20 + i) > 0.55) c = ny < -0.55 ? LV[5] : LV[4]; // moss on top
    bark(x, y, c);
  }));
  // heavy crooked limbs up into the crown, elbowed like old arms
  [
    [[CX - 6, 88], [CX - 22, 78], [CX - 34, 68], 12, 8], [[CX - 34, 68], [CX - 44, 58], [CX - 62, 56], 8, 3.5], [[CX - 44, 61], [CX - 50, 52], [CX - 46, 42], 4, 2],
    [[CX + 6, 86], [CX + 22, 74], [CX + 32, 64], 12, 8], [[CX + 32, 64], [CX + 46, 62], [CX + 62, 50], 8, 3.5], [[CX + 44, 63], [CX + 54, 67], [CX + 62, 68], 4, 2],
    [[CX + 1, 86], [CX + 6, 66], [CX - 2, 46], 12, 6],
  ].forEach(([p0, p1, p2, r0, r1]) => tube(p0, p1, p2, r0, r1, (x, y, nx, ny, t, across) => {
    let c = barkTone(x, y, nx, ny, 3, t, across, 30);
    if (ny < -0.6 && vnoise(x, y, 3, 40) > 0.62) c = LV[4]; // a little moss along the tops
    bark(x, y, c, 'limb');
  }));

  // the crown, back to front: each clump lit from the top left, shaded under the clump in front of it
  const owner = new Int16Array(W * CROWN_H).fill(-1);
  CLUMPS.forEach((c, k) => { for (let y = Math.max(0, Math.floor(c.y - c.ry * 1.12)); y < Math.min(CROWN_H, c.y + c.ry * 1.12); y += 1) for (let x = Math.max(0, Math.floor(c.x - c.rx * 1.12)); x < Math.min(W, c.x + c.rx * 1.12); x += 1) if (inClump(c, x, y)) owner[y * W + x] = k; });
  const own = (x, y) => (x < 0 || y < 0 || x >= W || y >= CROWN_H ? -1 : owner[y * W + x]);
  for (let y = 0; y < CROWN_H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const k = own(x, y);
      if (k < 0) continue;
      const c = CLUMPS[k];
      const dx = (x + 0.5 - c.x) / c.rx; const dy = (y + 0.5 - c.y) / c.ry;
      let t = 2.3 + c.layer * 1.1 - (dx * 0.55 + dy * 0.8) * 1.7 + (vnoise(x, y, 3, 11) - 0.5) * 1.3 + (bayer(x, y) - 0.5) * 0.8;
      if (dy > 0.55) t -= (dy - 0.55) * 3;
      for (let j = 1; j <= 3; j += 1) { const o = own(x, y - j); if (o > k && o >= 0) { t -= 2.4 - j * 0.5; break; } }
      let i = clamp(Math.round(t), 0, 7);
      if (i >= 5 && h2(x, y, 21) < 0.05) i += 1;
      else if (i <= 2 && h2(x, y, 22) < 0.06) i = 0;
      b.set(x, y, LV[clamp(i, 0, 7)], 'leaf');
    }
  }
  // the crown's shade falls on the limbs and the top of the trunk
  b.map((col, tag, x, y) => { if ((tag !== 'bark' && tag !== 'limb') || y > 100) return col; for (let j = 1; j <= 5; j += 1) if (b.tag(x, y - j) === 'leaf') return j < 3 ? BK[1] : bayer(x, y) < 0.5 ? BK[1] : BK[2]; return col; });

  // burls bulging out of the bark, and a knothole
  const burl = (bx, by, rx, ry) => b.fill(Math.floor(bx - rx - 1), Math.floor(by - ry - 1), Math.ceil(rx * 2 + 3), Math.ceil(ry * 2 + 3), (x, y) => {
    if (!inEll(x, y, bx, by, rx, ry)) return null;
    const s = (x + 0.5 - bx) / rx + (y + 0.5 - by) / ry;
    return inEll(x, y, bx, by, rx * 0.35, ry * 0.35) ? BK[2] : s < -0.7 ? BK[6] : s < -0.1 ? BK[5] : s > 0.8 ? BK[2] : BK[4];
  }, 'bark');
  burl(trunkX(101) - hwL(101) + 2, 101, 5, 4.5); burl(trunkX(116) + hwR(116) - 2, 116, 4, 3.5); burl(CX + 15, 80, 3, 3);
  grid(bark, Math.round(trunkX(122)) - 15, 120, ['.aaa.', 'aKKKb', 'aKKKb', '.bbb.'], { a: BK[5], K: BK[0], b: BK[2] });

  // the face: two knots for eyes, a little burl of a nose, a gentle fold of a smile
  EYES.forEach(([x, y]) => grid(bark, x - 3, y - 2, ['..rrr..', '.rdddr.', 'rdDDDdr', '.rdddr.', '..rrr..'], { r: BK[4], d: BK[2], D: BK[0] }));
  EYES.forEach(([x, y], i) => grid(bark, x - 3, y - 4, i ? ['..lll..', '.l...l.'] : ['.lll...', 'l...l..'], { l: BK[5] })); // brows: folds of bark above
  burl(FX, 100.5, 2.6, 2.2);
  for (let x = FX - 6; x <= FX + 6; x += 1) {
    const y = MOUTH_Y - Math.round(((x - FX) / 6) ** 2 * 2.2);
    bark(x, y, Math.abs(x - FX) <= 2 ? BK[0] : BK[1]);
    if (Math.abs(x - FX) <= 4) bark(x, y + 1, BK[5]);
  }
  [-8, 8].forEach((d) => { bark(FX + d, MOUTH_Y - 3, BK[2]); bark(FX + d, MOUTH_Y - 4, BK[4]); }); // the corners of the smile, folded up into cheeks

  // the owl's hollow, in the elbow of the left limb: dark inside, a warm glow at the bottom
  b.fill(HOLLOW.x - 4, HOLLOW.y - 5, 9, 11, (x, y) => {
    if (inEll(x, y, HOLLOW.x + 0.5, HOLLOW.y, 3.3, 4.3)) return y > HOLLOW.y + 1 ? (bayer(x, y) < 0.5 ? GLOW[1] : GLOW[0]) : '#24161e';
    if (inEll(x, y, HOLLOW.x + 0.5, HOLLOW.y, 4.4, 5.4)) return x + 0.5 < HOLLOW.x + 0.5 || y < HOLLOW.y - 2 ? BK[5] : BK[2];
    return null;
  }, 'limb');

  b.outline((tag, side) => {
    const base = (tag || '').split(':')[0];
    if (base === 'leaf') return side === 'bottom' || side === 'right' ? LV[0] : LV[1];
    if (base === 'limb') return side === 'top' || side === 'left' ? BK[1] : BK[0];
    if (base === 'bark') return side === 'bottom' ? INK : side === 'right' ? BK[0] : BK[1];
    return INK;
  });
  b.soften(() => LV[1], ['leaf']);

  // acorns hanging in the crown
  [[30, 52], [48, 44], [66, 50], [90, 48], [108, 46], [126, 52], [40, 58], [116, 58], [62, 30], [88, 30], [140, 58], [16, 58], [78, 52], [52, 18], [104, 24]].forEach(([x, y]) => {
    if (b.tag(x, y) !== 'leaf') return;
    grid((xx, yy, c) => b.set(xx, yy, c, 'acorn'), x - 1, y - 1, ['.k.', 'cCc', 'nNs', '.s.'], { k: LV[2], c: '#7a5236', C: '#a87a50', n: '#d8a850', N: '#f4d080', s: '#a87a3a' });
  });
  // the tiny door in the big root's knee, a lantern beside it, a pebble step
  grid((x, y, c) => b.set(x, y, c, 'door'), DOOR.x - 3, DOOR.y, [
    '..ddd..', '.dDDDd.', 'dDgGgDd', 'dDDDDDd', 'dDEDEDd', 'dDEDkDd', 'dDEDEDd', 'ddddddd',
  ], { d: WD[1], D: WD[3], E: WD[2], g: GLOW[3], G: GLOW[4], k: '#ffd23f' });
  grid((x, y, c) => b.set(x, y, c, 'lamp'), DOOR.x + 5, DOOR.y + 1, ['.m.', 'mym', 'mYm', '.m.', '.m.', '.m.'], { m: '#4a4a5a', y: GLOW[3], Y: GLOW[4] });
  grid((x, y, c) => b.set(x, y, c, 'stone'), DOOR.x - 3, DOOR.y + 8, ['.lmmd.', '..ss..'], { l: '#f8f2e6', m: '#e2ddde', d: '#9894aa', s: 'rgba(42,24,56,0.3)' });
  // little red toadstools on the mossy roots
  [[CX - 55, 127], [CX + 36, 136], [CX - 10, 139]].forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'shroom'), x, y, ['.rRr.', 'rwrrr', '.sSs.', '..s..'], { r: '#e0546a', R: '#ff9a9a', w: '#fff6ea', s: '#f6e8c8', S: '#d8c8a8' }));
  // a ring of tiny glowing mushrooms round its feet (they breathe in the overlay)
  RING.forEach(([x, y, big]) => grid((xx, yy, c) => b.set(xx, yy, c, 'glow'), x - 1, y - 2, big ? ['.Cl.', 'cCCl', '.ss.'] : ['.l.', 'cCl', '.s.'], { c: SHROOM[0], C: SHROOM[1], l: SHROOM[2], s: '#e8f4ec' }));
  // fallen acorns and leaves on the ground
  [[CX - 62, 146], [CX + 64, 143], [CX + 24, 148], [CX - 28, 150], [CX + 8, 150]].forEach(([x, y], i) => { if (i % 2) { px(x, y, '#a87a50'); px(x + 1, y, '#d8a850'); px(x, y + 1, '#a87a3a'); } else { px(x, y, LV[5]); px(x + 1, y + 1, LV[4]); } });

  b.blit(px, 0, 0);
  return new ImageData(out.data, W, H);
}

let base = null;
const oakBase = () => (base ||= paintOak());

// ---------- the overlay: what moves ----------

const MOTES = [[16, 30], [142, 28], [58, 4], [116, 74], [24, 84], [134, 92], [44, 112], [112, 104], [62, 70], [6, 66], [150, 70], [92, 76], [98, 6], [36, 12]];

/**
 * Starts the oak on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a while:
 * the face opens its eyes with a twinkle, the owl looks out, more motes come.
 */
export function startOak(canvas, host) {
  const ctx = canvas.getContext('2d');
  const img = oakBase();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const awake = now - Number(host?.dataset.wake || -1e9) < 3500;
    ctx.putImageData(img, 0, 0);
    // the hollow's glow breathes
    const g = 0.5 + 0.5 * Math.sin(t * 1.3);
    ctx.fillStyle = `rgba(255,216,120,${0.25 + g * 0.35})`; ctx.fillRect(HOLLOW.x - 1, HOLLOW.y + 2, 3, 2);
    // the owl: asleep, peeks out now and then; wide awake when the tree is tapped
    const peek = awake || (t % 11) > 9.4;
    if (peek) {
      const blink = (t % 2.3) < 0.15;
      for (const ox of [-1, 1]) { const ex = HOLLOW.x + ox; if (blink) dot(ex, HOLLOW.y - 1, '#c88a2a'); else { dot(ex, HOLLOW.y - 2, '#ffe066'); dot(ex, HOLLOW.y - 1, '#2a1838'); } }
    } else { dot(HOLLOW.x - 1, HOLLOW.y - 1, '#6a4a3a'); dot(HOLLOW.x + 1, HOLLOW.y - 1, '#6a4a3a'); }
    // the face blinks very slowly now and then; awake, its eyes twinkle
    const shut = !awake && (t % 7.3) < 0.2;
    EYES.forEach(([x, y]) => {
      if (shut) { ctx.fillStyle = BK[3]; ctx.fillRect(x - 2, y - 1, 5, 3); ctx.fillStyle = BK[1]; ctx.fillRect(x - 2, y, 5, 1); }
      else if (awake) { dot(x - 1, y - 1, GLOW[3]); dot(x, y, '#2a1838'); }
    });
    if (awake) { ctx.fillStyle = BK[5]; ctx.fillRect(FX - 4, MOUTH_Y + 2, 9, 1); }
    // the mushroom ring glows in a slow wave round the tree
    RING.forEach(([x, y], i) => {
      const a = 0.5 + 0.5 * Math.sin(t * 1.4 - i * 0.8);
      ctx.fillStyle = `rgba(150,255,225,${(awake ? 0.35 : 0.14) + a * 0.3})`;
      ctx.fillRect(x - 2, y - 2, 1, 1); ctx.fillRect(x + 2, y - 2, 1, 1); ctx.fillRect(x, y - 4, 1, 1); ctx.fillRect(x - 1, y - 3, 3, 1);
      if (a > 0.6) dot(x, y - 2, '#f0fffa');
    });
    // fireflies drifting and twinkling
    const n = awake ? MOTES.length : 8;
    for (let i = 0; i < n; i += 1) {
      const [ax, ay] = MOTES[i];
      const x = ax + Math.sin(t * 0.5 + i * 1.7) * 7; const y = ay + Math.sin(t * 0.37 + i * 2.3) * 5;
      const b = 0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1);
      if (b < 0.2 && !awake) continue;
      ctx.fillStyle = `rgba(232,255,160,${0.18 + b * 0.3})`;
      ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1); ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      dot(x, y, b > 0.55 ? '#fffbe0' : '#e8f8a8');
    }
  };
}
