// The pot of gold at the rainbow's end, Rainbow Land's landmark, drawn for the village at one art
// pixel per village pixel (GOLDPOT.w x GOLDPOT.h): a big rainbow arching down out of the sky and
// pouring into a huge black pot heaped and spilling over with gold, on a soft cloud island with
// piles of coins round it, a sleepy baby unicorn curled up beside the pot and a little cloud
// sheep dozing under the arch.
//
// Asleep, a shine runs along the rainbow's bands, a coin glints now and then, the unicorn breathes
// slowly with tiny z's drifting up and the sheep nods. Tapped, the rainbow lights up, coins
// fountain up out of the pot and land back in it, the unicorn wakes and sneezes a puff of
// sparkles, and the sheep bounces. While the map's show plays it all keeps going.
//
// The still parts are painted once into ImageData and canvases; startGoldpot() redraws the moving
// parts about ten times a second. village.js uses it for the landmark whose art is 'goldpot'.

import { mix, h2, vnoise, bayer, Buf, grid, inEll, ramp, pixelBuffer } from './pixelkit.js';
import { sel, tg } from './castleart.js';

export const GOLDPOT = { w: 152, h: 150 };
const W = GOLDPOT.w; const H = GOLDPOT.h;
const INK = '#3a2850';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// the palettes
const CL = ['#6e5c9c', '#8c7cb8', '#ab9ed0', '#c9c0e4', '#e2ddf2', '#f3f0fb', '#ffffff']; // cloud, lavender to white
const GD = ['#6e3418', '#9a5418', '#c67a1c', '#e8a42a', '#fcc83c', '#ffe27a', '#fff6c8']; // gold
const PT = ['#16121f', '#221c30', '#302842', '#433a5a', '#5c5276', '#7c72a0', '#a89ccc']; // the pot, plum-black iron
const BANDS = ['#ff6b81', '#ffa25c', '#ffd84a', '#7ad98a', '#5ab4ff', '#a98cff'].map((c) => ramp(c, 2, 3)); // each: dark..light, base at 2
const FUR = ['#7e74a8', '#a49ccc', '#cfcaea', '#ece9f9', '#ffffff'];
const MANE = ['#ff9ec4', '#c4a4ff', '#8ccaff', '#8ee8b8', '#ffe08a'];
const SPARK = ['#ff6b9a', '#ffd43b', '#5ad88a', '#4dabf7', '#b197fc', '#ffffff'];
const HORN = ['#b8741e', '#e8a82e', '#ffd860', '#fff3b0'];

// where things are
const ARC = { cx: 50, cy: 98, rx: 50, ry: 66, band: 3 }; // the rainbow: a half ellipse, six bands 3 wide
const POT = { cx: 94, rim: 82, rx: 25, ry: 6, belly: 101, brx: 29, bry: 19 };
const ISLE = { cx: 78, cy: 116, rx: 70, ry: 13 }; // the top of the cloud island
const UNI = { x: 86, y: 74 }; // the unicorn sprite's corner
const SHEEP = { x: 22, y: 98 };
const PILES = [[40, 113, 10], [64, 126, 8], [124, 128, 7], [140, 112, 5]]; // coin piles: x, y (base), radius

/** The rainbow's pixels: for each, its band (0 outer red .. 5 inner violet) and how far along the arc it is (0..1). */
function arcPixels() {
  const out = [];
  for (let y = ARC.cy - ARC.ry - 1; y <= ARC.cy + 14; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const dx = (x + 0.5 - ARC.cx); const dy = (y + 0.5 - ARC.cy);
      if (dy > 14) continue;
      // distance in from the outer edge, measured along the normal of the ellipse (near enough)
      const k = Math.hypot(dx / ARC.rx, Math.min(dy, 0) / ARC.ry);
      const r = Math.hypot(dx, Math.min(dy, 0)) || 1;
      const scale = r / Math.max(1e-3, k);
      const inward = (1 - k) * scale; // pixels in from the outer edge
      if (inward < 0 || inward >= ARC.band * 6) continue;
      const band = Math.floor(inward / ARC.band);
      const a = Math.atan2(-Math.min(dy, 0), dx); // pi at the left foot, 0 at the right foot
      out.push({ x, y, band, sub: inward - band * ARC.band, t: 1 - a / Math.PI });
    }
  }
  return out;
}

/** A coin lying flat: a little gold ellipse, its rim dark below and lit at the top left. */
function coin(b, x, y, r = 2.2, tagged = 'gold') {
  for (let yy = -2; yy <= 2; yy += 1) for (let xx = -3; xx <= 3; xx += 1) {
    if (!inEll(x + xx, y + yy, x + 0.5, y + 0.5, r + 0.3, r * 0.62 + 0.3)) continue;
    const top = !inEll(x + xx, y + yy - 1, x + 0.5, y + 0.5, r + 0.3, r * 0.62 + 0.3);
    const bot = !inEll(x + xx, y + yy + 1, x + 0.5, y + 0.5, r + 0.3, r * 0.62 + 0.3);
    let c = bot ? GD[2] : top ? GD[5] : xx < 0 ? GD[4] : GD[3];
    if (xx === -1 && yy === -1) c = GD[6];
    b.set(x + xx, y + yy, c, tg(tagged, GD[2]));
  }
}

/** A heap of coins: a dome of coins laid from the back to the front. */
function heap(b, cx, base, rx, ry, seed, n) {
  const coins = [];
  for (let k = 0; k < n; k += 1) {
    const u = h2(k, 1, seed) * 2 - 1; const v = h2(k, 2, seed);
    const top = base - Math.sqrt(Math.max(0, 1 - u * u)) * ry;
    coins.push([Math.round(cx + u * rx * (1 - v * 0.15)), Math.round(top + v * (base - top)), 1.8 + h2(k, 3, seed) * 0.9]);
  }
  // the ones at the back first
  coins.sort((p, q) => p[1] - q[1]).forEach(([x, y, r]) => coin(b, x, y, r));
}

// ---------- the still parts ----------

/** Behind everything that moves: the cloud island, the rainbow, the pot of gold and the coin piles. */
function paintBack(arc) {
  const out = pixelBuffer(W, H);
  const { px } = out;
  // the island's shadow on the meadow below
  for (let y = 128; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const e = ((x + 0.5 - 80) / 74) ** 2 + ((y + 0.5 - 144) / 6) ** 2;
    if (e < 1 && bayer(x, y) < 0.85) px(x, y, `rgba(60,40,110,${e < 0.5 ? 0.22 : 0.12})`);
  }
  const b = new Buf(W, H, 2);
  // the cloud island: a flat soft top and fat puffs round its edge
  const puffs = [[12, 120, 11], [28, 128, 12], [48, 133, 12], [70, 136, 12], [94, 136, 12], [116, 133, 12], [134, 126, 11], [144, 116, 8], [10, 108, 8], [26, 104, 7]];
  const inTop = (x, y) => inEll(x, y, ISLE.cx, ISLE.cy, ISLE.rx, ISLE.ry);
  const inPuff = (x, y) => puffs.find(([px0, py0, r]) => inEll(x, y, px0, py0, r, r * 0.86));
  for (let y = 96; y < H - 2; y += 1) for (let x = 0; x < W; x += 1) {
    const top = inTop(x, y); const p = inPuff(x, y);
    if (!top && !p) continue;
    const t = (bayer(x, y) - 0.5) * 0.25;
    let c;
    if (top && (!p || y < p[1] - p[2] * 0.4)) {
      // the top: brightest at the back left, soft lavender dimples
      const l = -((x + 0.5 - ISLE.cx) / ISLE.rx * 0.5 + (y + 0.5 - ISLE.cy) / ISLE.ry * 0.5);
      c = l > 0.25 + t ? CL[6] : l > -0.2 + t ? CL[5] : CL[4];
      if (vnoise(x, y, 6, 3) > 0.7) c = CL[4];
    } else {
      const [qx, qy, r] = p;
      const l = -(((x + 0.5 - qx) / r) * 0.55 + ((y + 0.5 - qy) / r) * 0.85);
      c = l > 0.5 + t ? CL[6] : l > 0.1 + t ? CL[5] : l > -0.35 + t ? CL[4] : l > -0.7 + t ? CL[3] : CL[2];
    }
    b.set(x, y, c, tg('cloud', CL[3]));
  }
  // the rainbow (it pours into the pot, so the pot is drawn over its foot)
  arc.forEach(({ x, y, band, sub }) => {
    const B = BANDS[band];
    const c = sub < 1 ? B[3] : sub < 2 ? B[2] : B[1];
    b.set(x, y, c, `rb:${band}`);
  });
  // the pot: the back of the rim, the gold heaped in the mouth, the iron belly in front
  const { cx, rim, rx, ry, belly, brx, bry } = POT;
  const iron = (x, y, c) => b.set(x, y, c, tg('metal', PT[3]));
  for (let y = rim - ry - 2; y <= rim; y += 1) for (let x = cx - rx - 2; x <= cx + rx + 2; x += 1) {
    if (!inEll(x, y, cx + 0.5, rim + 0.5, rx + 1.5, ry + 1.5)) continue;
    iron(x, y, inEll(x, y, cx + 0.5, rim + 0.5, rx - 1, ry - 1) ? PT[1] : x < cx ? PT[5] : PT[3]);
  }
  // the heap of gold, rising out of the mouth
  heap(b, cx, rim + 2, rx - 1, 20, 11, 120);
  // the belly
  for (let y = rim; y <= belly + bry; y += 1) for (let x = cx - brx - 1; x <= cx + brx + 1; x += 1) {
    if (!inEll(x, y, cx + 0.5, belly + 0.5, brx, bry)) continue;
    const u = (x + 0.5 - cx) / brx; const v = (y + 0.5 - belly) / bry;
    const l = -(u * 0.7 + v * 0.55);
    const t = (bayer(x, y) - 0.5) * 0.2;
    let c = l > 0.55 + t ? PT[5] : l > 0.2 + t ? PT[4] : l > -0.25 + t ? PT[3] : l > -0.6 + t ? PT[2] : PT[1];
    // a band round its middle, and the rainbow's colors faintly in the shine on the left
    if (Math.abs(y - (belly - 3)) < 1) c = l > 0 ? PT[5] : PT[3];
    iron(x, y, c);
  }
  // the front lip of the rim, over the gold
  for (let y = rim - 1; y <= rim + ry + 2; y += 1) for (let x = cx - rx - 2; x <= cx + rx + 2; x += 1) {
    if (!inEll(x, y, cx + 0.5, rim + 0.5, rx + 1.5, ry + 1.5) || inEll(x, y, cx + 0.5, rim - 0.5, rx - 0.5, ry - 0.5)) continue;
    if (y < rim) continue;
    iron(x, y, x < cx - rx * 0.4 ? PT[6] : x < cx + rx * 0.3 ? PT[5] : PT[4]);
  }
  // handles each side, three stubby feet, a gold star on its belly
  for (const s of [-1, 1]) {
    for (let k = 0; k < 7; k += 1) { const a = (k / 6) * Math.PI; iron(cx + s * (brx - 1) + s * Math.round(Math.sin(a) * 4), rim + 4 + Math.round((1 - Math.cos(a)) * 3.2), s < 0 ? PT[5] : PT[3]); }
  }
  for (const fx of [cx - 18, cx, cx + 18]) for (let y = 0; y < 4; y += 1) for (let x = -3; x <= 3 - y; x += 1) iron(fx + x, belly + bry - 2 + y, x < 0 ? PT[3] : PT[2]);
  grid((x, y, c) => b.set(x, y, c, tg('gold', GD[2])), cx - 4, belly - 1, ['...y...', '..yYy..', 'yyYWYyy', '.yYYYy.', '.yy.yy.', 'y.....y'], { y: GD[3], Y: GD[4], W: GD[6] });
  // gold spilling over the front of the rim, and a little heap fallen at the pot's foot
  [[cx - 16, rim + 5], [cx - 13, rim + 8], [cx - 2, rim + 6], [cx + 9, rim + 5], [cx + 12, rim + 8], [cx + 14, rim + 11]].forEach(([x, y]) => coin(b, x, y, 2.1));
  heap(b, cx - 6, belly + bry + 4, 14, 5, 21, 26);
  // coin piles on the cloud, and a few strays
  PILES.forEach(([x, y, r], i) => heap(b, x, y, r, r * 0.75, 30 + i, Math.round(r * r * 0.7)));
  [[54, 118], [80, 124], [110, 124], [30, 116], [128, 120], [58, 130], [100, 130]].forEach(([x, y]) => coin(b, x, y, 1.9));
  b.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'rb') return side === 'bottom' || side === 'right' ? mix(BANDS[5][1], INK, 0.3) : mix(BANDS[0][1], INK, 0.35);
    if (k === 'cloud') return side === 'bottom' ? CL[1] : side === 'right' ? CL[2] : CL[3];
    if (k === 'gold') return side === 'bottom' ? GD[0] : GD[1];
    return sel(t, side);
  });
  b.blit(px, 0, 0);
  // which rainbow pixels show (not under the pot): those get the shimmer
  const shown = arc.filter(({ x, y }) => String(b.tag(x, y)).startsWith('rb:'));
  // and where the coins are, for glints
  const coins = [];
  b.each((x, y) => { if (b.get(x, y) === GD[6]) coins.push([x, y]); });
  return { img: new ImageData(out.data, W, H), shown, coins };
}

// ---------- the characters ----------

/**
 * The baby unicorn, lying curled on the cloud facing the pot, as a canvas: asleep (breathing in
 * or out), awake with its head up (eyes open or blinking), or mid-sneeze.
 */
function unicornSprite(mode) {
  const S = 1.4;
  const b0 = new Buf(66, 56, 2);
  // drawn on a 48 x 40 plan, every cell scaled up S times
  const b = {
    set: (x, y, c, t) => { for (let yy = Math.floor(y * S); yy < Math.floor((y + 1) * S); yy += 1) for (let xx = Math.floor(x * S); xx < Math.floor((x + 1) * S); xx += 1) b0.set(xx, yy, c, t); },
  };
  const fur = (x, y, c) => b.set(x, y, c, tg('fur', FUR[1]));
  const breathe = mode === 'in' ? 1 : 0;
  const up = mode === 'awake' || mode === 'blink' || mode === 'sneeze';
  const shade = (x, y, cx, cy, r) => { const l = -(((x + 0.5 - cx) / r) * 0.5 + ((y + 0.5 - cy) / r) * 0.85); return l > 0.45 ? FUR[4] : l > -0.1 ? FUR[3] : l > -0.55 ? FUR[2] : FUR[1]; };
  const ell = (cx, cy, rx, ry, P = null) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      if (inEll(x, y, cx, cy, rx, ry)) (P ? b.set(x, y, P(x, y), tg('fur', FUR[1])) : fur(x, y, shade(x, y, cx, cy, Math.max(rx, ry))));
    }
  };
  // the tail, curling round behind it
  const tail = [[42, 26], [45, 29], [45, 33], [42, 35], [37, 36], [32, 36]];
  tail.forEach(([x, y], i) => { for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if (xx * xx + yy * yy <= 5) b.set(x + xx, y + yy, MANE[(i + (yy > 0 ? 1 : 0)) % 4], tg('mane', mix(MANE[i % 4], INK, 0.2))); });
  // the body, the haunch, the tucked legs
  ell(28, 28 - breathe * 0.5, 13, 7 + breathe * 0.5);
  ell(36, 27, 7, 6.5);
  ell(33, 34, 5, 2.2);
  ell(12, 34, 7, 2.3);
  for (const [x, y] of [[5, 34], [6, 34], [27, 35], [28, 35], [5, 35], [27, 36]]) b.set(x, y, '#c4a0e8', tg('hoof', '#9a78c8'));
  // the neck and head: resting on its front legs asleep, held up awake
  const hx = up ? (mode === 'sneeze' ? 11 : 10) : 9; const hy = up ? (mode === 'sneeze' ? 16 : 18) : 28;
  ell(17, up ? 23 : 28, 6, up ? 7 : 5.5);
  ell(hx, hy, 6.5, 5);
  ell(hx - 5, hy + 2, 3.8, 3.2, (x, y) => (y > hy + 2 ? FUR[2] : FUR[3]));
  // the ear
  for (let k = 0; k < 4; k += 1) for (let j = -1; j <= (k < 2 ? 1 : 0); j += 1) fur(hx + 4 + j + Math.floor(k / 2), hy - 5 - k, k > 1 ? '#ffc4dc' : FUR[2]);
  // the horn: a little gold spiral
  for (let k = 0; k < 9; k += 1) {
    const x = hx - 1 - Math.round(k * 0.45); const y = hy - 5 - k;
    const w = k < 3 ? 2 : k < 6 ? 1 : 0;
    for (let j = 0; j <= w; j += 1) b.set(x + j, y, (k + j) % 3 === 0 ? HORN[0] : j === 0 ? HORN[3] : HORN[2], tg('horn', HORN[0]));
  }
  // the mane: puffs of pastel from its forehead down its neck to its back
  const mane = up ? [[hx + 2, hy - 5], [hx + 5, hy - 3], [hx + 8, hy], [19, 18], [21, 21], [23, 23]] : [[hx + 2, hy - 5], [hx + 6, hy - 4], [hx + 9, hy - 3], [20, 23], [23, 22], [26, 22]];
  mane.forEach(([x, y], i) => { for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if (xx * xx + yy * yy <= 4 + (i % 2)) b.set(x + xx, y + yy, yy + xx < -1 ? mix(MANE[i % 5], '#ffffff', 0.4) : MANE[i % 5], tg('mane', mix(MANE[i % 5], INK, 0.25))); });
  // its face
  const ex = hx - 2; const ey = hy - 1;
  if (mode === 'awake') {
    grid((x, y, c) => b.set(x, y, c, 'face'), ex - 1, ey - 1, ['.KK', 'KWK', 'KKK'], { K: '#2e2040', W: '#ffffff' });
  } else if (mode === 'sneeze') {
    grid((x, y, c) => b.set(x, y, c, 'face'), ex - 1, ey, ['K.K', '.K.'], { K: '#2e2040' });
  } else {
    // shut, smiling eyes with a lash
    grid((x, y, c) => b.set(x, y, c, 'face'), ex - 1, ey, ['K..K', '.KK.'], { K: '#5a4878' });
  }
  b.set(hx - 8, hy + 2, '#8a6aa8', 'face');
  b.set(hx - 3, hy + 2, '#ffb0c8', 'face'); b.set(hx - 2, hy + 2, '#ffb0c8', 'face');
  if (mode === 'sneeze') { b.set(hx - 8, hy + 3, '#5a4878', 'face'); b.set(hx - 7, hy + 4, '#5a4878', 'face'); }
  b0.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'face') return null;
    if (k === 'fur' || k === 'hoof') return side === 'bottom' ? '#5a4c86' : side === 'right' ? '#7a6ca8' : '#9a8ec4';
    return sel(t, side);
  });
  const pb = pixelBuffer(70, 60);
  b0.blit(pb.px, 2, 2);
  const c = document.createElement('canvas'); c.width = 70; c.height = 60;
  pb.put(c.getContext('2d'));
  return c;
}

/** A little cloud sheep: a puff of wool with a plum face, eyes shut or open. */
function sheepSprite(awake, squash = 0) {
  const b = new Buf(20, 16, 2);
  const wool = [[6, 7, 4], [10, 5, 4.5], [14, 7, 4], [9, 9, 4.5], [13, 9.5, 4], [5, 10, 3.5]];
  for (let y = 0; y < 16; y += 1) for (let x = 0; x < 20; x += 1) {
    const yy = squash ? 10 + (y - 10) * 1.25 : y;
    const p = wool.find(([cx, cy, r]) => inEll(x, yy, cx, cy, r, r * (squash ? 0.8 : 1)));
    if (!p) continue;
    const l = -((x + 0.5 - p[0]) * 0.55 + (yy + 0.5 - p[1]) * 0.85) / p[2];
    b.set(x, y, l > 0.35 ? CL[6] : l > -0.2 ? CL[5] : CL[4], tg('cloud', CL[3]));
  }
  // its face, peeping out at the left, and four little legs
  grid((x, y, c) => b.set(x, y, c, tg('body', '#5a3a6a')), 1, 6 + squash, ['.hh.', 'hhhh', awake ? 'hWhh' : 'hehh', 'hhhh', '.hp.'], { h: '#6a4a7a', W: '#ffffff', e: '#3a2448', p: '#ffa0c0' });
  if (!squash) for (const x of [6, 9, 13, 15]) { b.set(x, 13, '#5a3a6a', tg('body', '#5a3a6a')); b.set(x, 14, '#3a2448', tg('body', '#5a3a6a')); }
  b.outline((t, side) => (String(t).startsWith('cloud') ? (side === 'bottom' ? CL[1] : CL[2]) : sel(t, side)));
  const pb = pixelBuffer(24, 20);
  b.blit(pb.px, 2, 2);
  const c = document.createElement('canvas'); c.width = 24; c.height = 20;
  pb.put(c.getContext('2d'));
  return c;
}

let cache = null;
const art = () => {
  if (cache) return cache;
  const arc = arcPixels();
  const back = paintBack(arc);
  cache = {
    ...back,
    uni: { out: unicornSprite('out'), in: unicornSprite('in'), awake: unicornSprite('awake'), blink: unicornSprite('blink'), sneeze: unicornSprite('sneeze') },
    sheep: [sheepSprite(false), sheepSprite(true), sheepSprite(true, 1)],
  };
  return cache;
};

/**
 * Starts the pot of gold on its canvas. Returns step(now), to call every animation frame; it
 * redraws about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a
 * while; while the map's show plays (the village has .show-on) it keeps going.
 */
export function startGoldpot(canvas, host) {
  const ctx = canvas.getContext('2d');
  const A = art();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(X + x, Y + y, c); } });
  const twinkle = (x, y, big, c = '#ffffff') => { dot(x, y, c); dot(x - 1, y, c); dot(x + 1, y, c); dot(x, y - 1, c); dot(x, y + 1, c); if (big) { dot(x - 2, y, '#fff3b0'); dot(x + 2, y, '#fff3b0'); dot(x, y - 2, '#fff3b0'); dot(x, y + 2, '#fff3b0'); } };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 5200);
    const k = show ? (now % 2400) : since; // in the show the coins go up every couple of seconds
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(A.img, 0, 0);

    // the rainbow: a shine running along its bands; tapped, it lights up and glitters
    const glow = show ? 0.7 : since > 0 && since < 3200 ? Math.min(1, (3200 - since) / 1400) : 0;
    const head = (t / 2.6) % 1.6 - 0.3;
    for (const p of A.shown) {
      const B = BANDS[p.band];
      const d = Math.abs(p.t - head + p.band * 0.02);
      const lift = (d < 0.025 ? 2 : d < 0.06 ? 1 : 0) + (glow > 0.15 && bayer(p.x, p.y) < glow * 1.4 ? 1 : 0);
      if (lift) dot(p.x, p.y, B[clamp((p.sub < 1 ? 3 : p.sub < 2 ? 2 : 1) + lift, 0, 5)]);
    }
    if (glow > 0) {
      for (let n = 0; n < 16; n += 1) {
        const p = A.shown[Math.floor(h2(n, Math.floor(t * 5), 13) * A.shown.length)];
        if (p && h2(n, 7, 3) < glow) twinkle(p.x, p.y, n % 4 === 0);
      }
    }
    // sparkles where it pours into the pot
    for (let n = 0; n < 3; n += 1) {
      const p = (t * 1.4 + n / 3) % 1;
      const x = 84 + n * 5 + Math.sin(p * 7 + n) * 2; const y = 70 - p * 10;
      if (p < 0.8) dot(x, y, ['#fff3b0', '#ffffff', '#ffd0e8'][n]);
    }

    // a coin glints now and then
    if (A.coins.length) {
      for (let n = 0; n < 2; n += 1) {
        const cyc = Math.floor(t / 1.3 + n * 0.5);
        const ph = (t / 1.3 + n * 0.5) % 1;
        if (ph > 0.35) continue;
        const [x, y] = A.coins[Math.floor(h2(cyc, n, 5) * A.coins.length)];
        twinkle(x, y, ph > 0.1 && ph < 0.25);
      }
    }

    // the cloud sheep: dozing (it nods), or bouncing when the pot is tapped
    {
      const bouncing = show || (since > 300 && since < 2700);
      let jump = 0; let squash = false;
      if (bouncing) {
        const q = ((show ? now : since - 300) % 600) / 600;
        jump = Math.round(Math.sin(q * Math.PI) * 7);
        squash = q < 0.08 || q > 0.92;
      }
      const nod = !bouncing && Math.floor(t / 1.6) % 3 === 0 ? 1 : 0;
      ctx.drawImage(squash ? A.sheep[2] : bouncing ? A.sheep[1] : A.sheep[0], SHEEP.x - 2, SHEEP.y - 2 - jump + nod);
      if (!awake && !bouncing) {
        const p = (t / 3.4) % 1;
        if (p < 0.7) rows(['zz', '.z', 'zz'], SHEEP.x - 2 - p * 4, SHEEP.y + 2 - p * 12, { z: '#ffffff' });
      }
    }

    // the unicorn: asleep, breathing slowly; awake it lifts its head, then sneezes sparkles
    {
      let mode = Math.floor(t / 1.6) % 2 ? 'in' : 'out';
      if (show) mode = (Math.floor(t / 3) % 5 === 4) ? 'blink' : 'awake';
      else if (since > 300 && since < 4600) {
        mode = since < 1500 ? 'awake' : since < 1900 ? 'sneeze' : (since > 3200 && since < 3400) ? 'blink' : 'awake';
      }
      ctx.drawImage(A.uni[mode], UNI.x - 2, UNI.y - 2);
      // the sneeze: a puff of sparkles from its nose
      const ps = show ? ((now % 3000) - 1200) : since - 1900;
      if (ps > 0 && ps < 1300) {
        const nx = UNI.x + 4; const ny = UNI.y + 26; const q = ps / 1300;
        // a little white puff of breath that swells and thins out
        if (q < 0.55) {
          const r = 2.2 + q * 7;
          for (const [ox, oy, k] of [[-5, -1, 1], [-10, -5, 0.85], [-11, 2, 0.75]]) {
            const cx = nx + ox * (0.6 + q); const cy = ny + oy * (0.6 + q);
            for (let y = -4; y <= 4; y += 1) for (let x = -4; x <= 4; x += 1) {
              if (Math.hypot(x, y) > r * k * 0.62 + 0.4) continue;
              if (q > 0.3 && bayer(Math.round(cx + x), Math.round(cy + y)) < (q - 0.3) * 4) continue;
              dot(cx + x, cy + y, y < 0 ? '#ffffff' : '#ece6fa');
            }
          }
        }
        // and a spray of rainbow sparkles flying out of it
        for (let n = 0; n < 14; n += 1) {
          const a = Math.PI * (0.62 + (n / 14) * 0.85 + (h2(n, 1, 9) - 0.5) * 0.08); const sp = 20 + h2(n, 2, 9) * 18;
          const r = Math.sqrt(q) * sp;
          const x = nx + Math.cos(a) * r; const y = ny + Math.sin(a) * r * 0.75 - q * 8;
          const c = SPARK[n % SPARK.length];
          if (q > 0.75 && (n + f) % 2) continue;
          if (n % 2 === 0) twinkle(x, y, n % 4 === 0 && q < 0.5, c); else dot(x, y, c);
        }
      }
      if (!awake) {
        // tiny z's
        for (let n = 0; n < 2; n += 1) {
          const p = (t / 3 + n / 2) % 1;
          if (p > 0.8) continue;
          rows(p < 0.4 ? ['zz', '.z', 'zz'] : ['zzz', '.z.', 'zzz'], UNI.x + 18 + p * 6, UNI.y + 8 - p * 18, { z: p > 0.55 ? '#d8d0f0' : '#ffffff' });
        }
      }
    }

    // coins fountain up out of the pot and land back in it
    if (k > 0 && k < 2000 && (show || since < 2000)) {
      for (let n = 0; n < 16; n += 1) {
        const t0 = n * 50; const dur = 1100 + h2(n, 4, 3) * 400;
        const p = (k - t0) / dur;
        if (p <= 0 || p >= 1) continue;
        const sx = POT.cx - 10 + h2(n, 5, 3) * 20;
        const vx = (h2(n, 6, 3) - 0.5) * 72; // out in a bloom, and back down into the pot
        const x = sx + vx * Math.sin(p * Math.PI) * 0.8 + vx * p * 0.12; const y = POT.rim - 8 - Math.sin(p * Math.PI) * (40 + h2(n, 7, 3) * 26) + p * 6;
        const spin = (f + n) % 4;
        const sp = spin === 0 ? ['.ooo.', 'oyWyo', 'oyYyo', 'oyyyo', '.ooo.'] : spin === 1 || spin === 3 ? ['.oo.', 'oWyo', 'oYyo', 'oyyo', '.oo.'] : ['.o.', 'oWo', 'oYo', 'oyo', '.o.'];
        rows(sp, x - 2, y - 2, { o: GD[1], y: GD[3], Y: GD[4], W: GD[6] });
        if (n % 3 === 0 && p > 0.3 && p < 0.6) dot(x + 3, y - 3, '#ffffff');
      }
    }
  };
}
