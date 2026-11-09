// The fire stone face, Volcano Island's landmark, drawn for the village at one art pixel per
// village pixel (STONE.w x STONE.h): a great friendly stone head with a mossy cap of flowers and a
// toucan on top, long ears, a big round nose and a flower lei, standing on a basalt platform with
// a little shrine of fruit offerings and two tiki torches before it; behind it a rock spire pours
// a little lava waterfall into a glowing pool, and a steam vent puffs on the other side.
//
// It sleeps, smiling, and snores little z's and puffs of steam. Tapped, it rumbles awake: its
// eyes open glowing, its cracks light up, it talks ("WHO... IS... TICKLING... ME?"), then winks;
// the toucan flutters up and lands again. While the map's show plays it stays awake to watch.
//
// The still parts are painted once into ImageData and canvases; startStone() redraws the moving
// parts about ten times a second. village.js uses it for the landmark whose art is 'stone'.

import { mix, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer } from './pixelkit.js';
import { sel, tg } from './castleart.js';
import { VB } from './volcanoart.js';

export const STONE = { w: 128, h: 152 };
const W = STONE.w; const H = STONE.h;
const STN = ['#2a2234', '#3e3244', '#564658', '#6e5e6e', '#887884', '#a4949c', '#c2b4b6', '#e0d4d0'];
const R = VB.rock; const LV = VB.lava; const GL = VB.lawn; const J = VB.jungle; const BS = VB.bamboo;
const Wd = ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const HEAD = { cx: 62, cy: 63, rx: 28, ry: 43 }; // a rounded slab: top at 20, chin at 106
const EYES = [[49, 57], [75, 57]];
const MOUTH = { x: 62, y: 89 };
const SPIRE = { x0: 92, x1: 126, top: 22 };
const FALL = { x: 110, top: 33, bottom: 116 };
const POOL = { x: 114, y: 119, rx: 11, ry: 4.2 };
const VENT = { x: 15, y: 76 };
const TORCHES = [[26, 98], [98, 98]];
const PERCH = { x: 72, y: 11 }; // the toucan's top-left, standing on the moss
const CRACKS = [[[71, 27], [73, 31], [72, 34], [75, 38], [76, 41]], [[37, 62], [39, 66], [38, 69], [41, 73]], [[86, 80], [87, 84], [85, 87], [87, 91]]];

const inHead = (x, y) => Math.abs((x + 0.5 - HEAD.cx) / HEAD.rx) ** 2.6 + Math.abs((y + 0.5 - HEAD.cy) / HEAD.ry) ** 2.6 <= 1;
const lineTo = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i += 1) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n)); };
const crackPixels = () => {
  const out = new Map();
  CRACKS.forEach((pts) => { for (let i = 1; i < pts.length; i += 1) lineTo(pts[i - 1][0], pts[i - 1][1], pts[i][0], pts[i][1], (x, y) => out.set(`${x},${y}`, [x, y])); });
  return [...out.values()];
};

/** Turns a Buf into a canvas, outlined. */
function toCanvas(b, w, h, pad) {
  b.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'glow' || k === 'fx') return null;
    return sel(t, side);
  });
  const pb = pixelBuffer(w + pad * 2, h + pad * 2);
  b.blit(pb.px, pad, pad);
  const c = document.createElement('canvas'); c.width = w + pad * 2; c.height = h + pad * 2;
  pb.put(c.getContext('2d'));
  return c;
}

/** A round leafy clump into a Buf. */
function clump(b, cx, cy, r, P, seed) {
  for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
    const dx = (x + 0.5 - cx) / r; const dy = (y + 0.5 - cy) / r;
    if (dx * dx + dy * dy > 1 - (h2(x, y, seed) > 0.85 ? 0.14 : 0)) continue;
    const l = -(dx * 0.6 + dy * 0.8);
    let i = l > 0.45 ? 6 : l > 0.1 ? 5 : l > -0.3 ? 4 : 3;
    if ((x + y * 2) % 5 === 0 && h2(x, y, seed + 1) > 0.4) i += l > -0.2 ? 1 : -1;
    b.set(x, y, P[clamp(i, 1, 7)], tg('leaf', P[3]));
  }
}
const hibiscus = (b, x, y, c) => grid((xx, yy, cc) => b.set(xx, yy, cc, tg('fl', c[0])), x - 2, y - 2, ['.a.a.', 'aaBaa', '.BYB.', 'aaBaa', '.a.a.'], { a: c[1], B: c[0], Y: '#ffe680' });
const FLOWERS = [['#c8203a', '#ff5a6a'], ['#e0508a', '#ff9ac0'], ['#e89a20', '#ffd23f'], ['#e86a2a', '#ffa860']];

// ---------- the still parts ----------

/** Behind the head: the steam vent's mound on the left, the spire with the lava fall's channel on the right, the pool, shadows. */
function paintBack() {
  const out = pixelBuffer(W, H);
  const { px } = out;
  for (let y = 100; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const e = ((x + 0.5 - 64) / 64) ** 2 + ((y + 0.5 - 140) / 13) ** 2;
    if (e < 1 && bayer(x, y) < 0.75) px(x, y, `rgba(30,16,40,${e < 0.5 ? 0.26 : 0.14})`);
  }
  const b = new Buf(W, H, 2);
  // the spire: a tall knuckle of basalt, a notch in it where the lava comes out
  for (let y = SPIRE.top; y < 124; y += 1) for (let x = SPIRE.x0 - 6; x < SPIRE.x1 + 2; x += 1) {
    const t = (y - SPIRE.top) / (124 - SPIRE.top);
    const xl = SPIRE.x0 + 10 - t * 14 + (vnoise(x, y, 5, 3) - 0.5) * 4; const xr = SPIRE.x1 - 6 + t * 7 + (vnoise(x, y, 5, 4) - 0.5) * 4;
    if (x < xl || x > xr) continue;
    if (y < SPIRE.top + 6 && !inEll(x, y, (xl + xr) / 2, SPIRE.top + 6, (xr - xl) / 2, 6)) continue;
    const u = (x - xl) / (xr - xl);
    let i = u < 0.25 ? 5 : u < 0.6 ? 4 : u < 0.85 ? 3 : 2;
    const ly = (y + Math.round(vnoise(x, 1, 6, 5) * 3)) % 9;
    if (ly === 0) i -= 1; else if (ly === 8) i += 1;
    if (h2(x, y, 7) > 0.95) i += 1;
    let c = R[clamp(i, 0, 6)];
    // the fall's warm light on the rock either side of it
    const df = Math.abs(x + 0.5 - FALL.x);
    if (y > FALL.top && df < 8 && bayer(x, y) < (8 - df) / 10) c = mix(c, LV[2], 0.4);
    b.set(x, y, c, tg('stone', R[3]));
  }
  // jungle on the spire's shoulders and the mound
  clump(b, 100, 30, 8, J, 1); clump(b, 118, 26, 7, VB.teal, 2); clump(b, 122, 40, 6, VB.lime, 3);
  // the mound with the steam vent, on the left
  for (let y = 66; y < 126; y += 1) for (let x = 0; x < 40; x += 1) {
    if (!inEll(x, y, 17, 100, 19, 32) || y > 124) continue;
    const l = -((x + 0.5 - 17) / 19 * 0.6 + (y + 0.5 - 100) / 32 * 0.8);
    let c = R[l > 0.5 ? 5 : l > 0.15 ? 4 : l > -0.25 ? 3 : 2];
    if (h2(x, y, 9) > 0.93) c = R[2];
    b.set(x, y, c, tg('stone', R[3]));
  }
  for (let y = VENT.y - 1; y < VENT.y + 9; y += 1) for (let x = VENT.x - 7; x <= VENT.x + 7; x += 1) {
    const hwV = 2.6 + (y - VENT.y) * 0.5;
    if (Math.abs(x + 0.5 - VENT.x) > hwV) continue;
    const top = y < VENT.y + 1;
    const u = (x + 0.5 - VENT.x) / hwV;
    b.set(x, y, top ? (Math.abs(u) < 0.6 ? R[0] : '#f6d64a') : y < VENT.y + 3 && h2(x, y, 4) > 0.5 ? '#fff0a0' : u < -0.3 ? R[5] : u < 0.4 ? R[4] : R[2], tg('stone', R[3]));
  }
  clump(b, 6, 72, 7, VB.lime, 4); clump(b, 30, 74, 6, J, 5); clump(b, 4, 90, 6, VB.teal, 6);
  hibiscus(b, 8, 70, FLOWERS[0]); hibiscus(b, 31, 72, FLOWERS[2]); hibiscus(b, 117, 24, FLOWERS[1]);
  // the pool the fall runs into, in a rim of stones
  for (let y = POOL.y - 7; y < POOL.y + 7; y += 1) for (let x = POOL.x - POOL.rx - 3; x < POOL.x + POOL.rx + 3; x += 1) {
    if (!inEll(x, y, POOL.x, POOL.y, POOL.rx + 2.5, POOL.ry + 2)) continue;
    if (inEll(x, y, POOL.x, POOL.y, POOL.rx, POOL.ry)) b.set(x, y, LV[4], tg('glow', LV[4]));
    else b.set(x, y, y < POOL.y ? R[2] : (x + y) % 5 === 0 ? R[2] : R[4], tg('stone', R[3]));
  }
  b.outline((t, side) => (String(t).startsWith('glow') ? null : sel(t, side)));
  b.blit(px, 0, 0);
  return new ImageData(out.data, W, H);
}

/** The head: the stone slab with its brow, sockets, nose, ears, cheeks and chin, a cap of moss and flowers, the lei round its neck. */
function headSprite() {
  const b = new Buf(W, H, 2);
  const put = (x, y, c, k = 'stone') => b.set(x, y, c, tg(k, STN[3]));
  for (let y = 16; y < 110; y += 1) {
    for (let x = 30; x < 95; x += 1) {
      if (!inHead(x, y)) continue;
      const u = (x + 0.5 - HEAD.cx) / HEAD.rx; const v = (y + 0.5 - HEAD.cy) / HEAD.ry;
      let i = u < -0.72 ? 6 : u < -0.3 ? 5 : u < 0.3 ? 4 : u < 0.72 ? 3 : 2;
      if (v < -0.8) i += 1; else if (v > 0.85) i -= 1;
      const hk = h2(x, y, 21);
      if (hk > 0.96) i += 1; else if (hk < 0.04) i -= 1;
      let c = STN[clamp(i, 0, 7)];
      // lichen: pale gold and sage spots
      const lk = vnoise(x, y, 6, 22);
      if (lk > 0.74 && bayer(x, y) < 0.6) c = mix(c, lk > 0.8 ? '#c8c070' : '#8aa47a', 0.35);
      put(x, y, c);
    }
  }
  // the long ears, a groove inside each
  for (const [x0, dir] of [[29, -1], [90, 1]]) {
    for (let y = 48; y < 90; y += 1) for (let x = 0; x < 6; x += 1) {
      const t = (y - 48) / 42;
      if (y < 50 + (dir < 0 ? x : 5 - x) * 0.6 || y > 88 - (dir < 0 ? 5 - x : x) * 0.3) continue;
      const groove = (dir < 0 ? x === 3 : x === 2) && t > 0.1 && t < 0.85;
      put(x0 + x, y, groove ? STN[2] : dir < 0 ? (x < 2 ? STN[6] : STN[5]) : (x > 3 ? STN[2] : STN[3]));
    }
  }
  // the brow: a soft ledge, lit on top, shadow beneath
  for (let x = 37; x < 88; x += 1) {
    const u = (x - 37) / 51;
    const by = 46 + Math.round(Math.abs(u - 0.5) * 3);
    put(x, by, u < 0.5 ? STN[6] : STN[5]); put(x, by + 1, u < 0.6 ? STN[5] : STN[4]); put(x, by + 2, STN[3]); put(x, by + 3, STN[2]);
  }
  // the eye sockets, big and round, in the brow's shadow
  EYES.forEach(([ex, ey]) => {
    for (let y = ey - 6; y <= ey + 6; y += 1) for (let x = ex - 10; x <= ex + 10; x += 1) {
      if (!inEll(x, y, ex, ey, 9.6, 5.8)) continue;
      const d = ((x + 0.5 - ex) / 9.6) ** 2 + ((y + 0.5 - ey) / 5.8) ** 2;
      put(x, y, y < ey - 2 ? STN[2] : d > 0.72 ? STN[3] : STN[4]);
    }
  });
  // the nose: short and round, lit on the left, nostrils at its foot
  for (let y = 53; y < 81; y += 1) {
    const t = (y - 53) / 28; const hwN = 3 + t ** 2 * 7.5;
    for (let x = Math.floor(HEAD.cx - hwN - 1); x <= HEAD.cx + hwN + 1; x += 1) {
      const u = (x + 0.5 - HEAD.cx) / hwN;
      if (Math.abs(u) > 1) continue;
      if (y > 75 && Math.abs(u) > 1 - (y - 75) * 0.16) continue;
      let c = u < -0.55 ? STN[7] : u < -0.1 ? STN[6] : u < 0.45 ? STN[5] : STN[3];
      if (Math.abs(u) > 0.88) c = u < 0 ? STN[4] : STN[2];
      put(x, y, c);
    }
  }
  [[57, 78], [66, 78]].forEach(([nx, ny]) => { put(nx, ny, STN[0]); put(nx + 1, ny, STN[0]); put(nx, ny - 1, STN[1]); put(nx + 1, ny - 1, STN[2]); });
  for (let x = 53; x < 72; x += 1) put(x, 81, STN[3]); // its shadow on the lip
  // rosy lichen on the cheeks
  [[42, 75], [82, 75]].forEach(([cx, cy]) => {
    for (let y = cy - 4; y <= cy + 4; y += 1) for (let x = cx - 6; x <= cx + 6; x += 1) if (inEll(x, y, cx, cy, 5.5, 3.6) && bayer(x, y) < 0.55) put(x, y, mix(b.get(x, y) || STN[4], '#ff8a8a', 0.45));
  });
  // dark cracks (they glow when it wakes)
  crackPixels().forEach(([x, y]) => put(x, y, '#4a3038'));
  // the mossy cap: moss over the top, dripping down, with flowers and a fern
  for (let y = 16; y < 40; y += 1) for (let x = 30; x < 95; x += 1) {
    if (!inHead(x, y)) continue;
    const drip = 27 + Math.round(vnoise(x, 1, 4, 23) * 7) + (h2(x, 2, 24) > 0.85 ? 3 : 0);
    if (y > drip) continue;
    const u = (x + 0.5 - HEAD.cx) / HEAD.rx;
    let i = u < -0.5 ? 5 : u < 0.4 ? 4 : 3;
    if (y === drip) i -= 2; else if (y < 25) i += 1;
    if ((x + y * 2) % 5 === 0 && h2(x, y, 25) > 0.5) i += 1;
    put(x, y, GL[clamp(i, 0, 6)], 'leaf');
  }
  for (const [x0, y0, x1, y1] of [[44, 22, 38, 12], [46, 22, 46, 10], [48, 22, 54, 13], [82, 23, 90, 16]]) lineTo(x0, y0, x1, y1, (x, y) => { put(x, y, J[5], 'leaf'); if ((x + y) % 2) put(x + 1, y, J[4], 'leaf'); });
  hibiscus(b, 56, 21, FLOWERS[0]); hibiscus(b, 64, 18, FLOWERS[1]); hibiscus(b, 38, 26, FLOWERS[2]); hibiscus(b, 86, 26, FLOWERS[3]);
  grid((x, y, c) => put(x, y, c, 'fl'), 48, 24, ['.w.', 'wyw', '.w.'], { w: '#fffaf0', y: '#ffd23f' });
  grid((x, y, c) => put(x, y, c, 'fl'), 76, 26, ['.w.', 'wyw', '.w.'], { w: '#fffaf0', y: '#ffd23f' });
  // the lei round its neck
  const lei = ['#ff5a8a', '#ffd23f', '#fffaf0', '#ff9a3a', '#c84aa8'];
  for (let k = 0; k <= 18; k += 1) {
    const t = k / 18; const x = 37 + t * 50; const y = 95 + Math.sin(t * Math.PI) * 6;
    const c = lei[k % lei.length];
    grid((xx, yy, cc) => put(xx, yy, cc, 'fl'), Math.round(x) - 1, Math.round(y) - 1, ['.c.', 'cyc', '.c.'], { c, y: k % 5 === 1 ? '#ff8a3a' : '#ffe680' });
    if (k % 2) { put(Math.round(x) + 1, Math.round(y) + 2, J[4], 'leaf'); put(Math.round(x) + 2, Math.round(y) + 2, J[3], 'leaf'); }
  }
  return toCanvas(b, W, H, 2);
}

/** In front of the head: the basalt platform, the shrine with its offerings, bushes and the torches' poles. */
function frontSprite() {
  const b = new Buf(W, H, 2);
  const put = (x, y, c, k = 'stone', base = R[3]) => b.set(x, y, c, tg(k, base));
  // the platform: big fitted stones, its top lit
  for (let y = 104; y < 127; y += 1) for (let x = 18; x < 107; x += 1) {
    if (y < 108) { put(x, y, y === 104 ? R[6] : y < 106 ? R[5] : R[4]); continue; }
    const row = y < 117 ? 0 : 1; const v = row ? y - 117 : y - 108;
    const widths = row ? [13, 17, 11, 15, 16, 13, 12] : [16, 12, 18, 14, 11, 14, 12];
    let acc = 18 + (row ? 4 : 0); let k = 0; while (k < widths.length - 1 && x >= acc + widths[k]) { acc += widths[k]; k += 1; }
    const u = x - acc; const wk = widths[k];
    let c = R[3];
    if (u === 0 || v === 0) c = R[4];
    if (u === wk - 1 || v === (row ? 9 : 8)) c = R[1];
    if ((u === wk - 2 || v === (row ? 8 : 7)) && c === R[3]) c = R[2];
    if (h2(x, y, 31) > 0.94) c = R[2];
    if (y < 111 && h2(x, 3, 32) > 0.7 && bayer(x, y) < 0.6) c = GL[3];
    put(x, y, c);
  }
  // the shrine: a low altar stone with a spiral carved in it
  for (let y = 124; y < 141; y += 1) for (let x = 38; x < 87; x += 1) {
    if (y < 128) { if (y === 124 && (x === 38 || x === 86)) continue; put(x, y, y === 124 ? STN[7] : x < 60 ? STN[6] : STN[5], 'stone', STN[4]); continue; }
    let c = x < 42 ? STN[5] : x > 82 ? STN[2] : STN[4];
    if (y === 128) c = STN[2];
    const d = Math.hypot(x + 0.5 - 62, (y + 0.5 - 134.5) * 1.4); const a = Math.atan2(y + 0.5 - 134.5, x + 0.5 - 62);
    if (d < 6 && Math.abs((((d - a * 1.1) % 2.6) + 2.6) % 2.6 - 1.3) < 0.4) c = STN[2];
    put(x, y, c, 'stone', STN[4]);
  }
  // the offerings on it: a pineapple, a bunch of bananas, a coconut, a watermelon slice, a dragonfruit, mangoes
  grid((x, y, c) => put(x, y, c, 'fruit', '#c88a2a'), 40, 109, [
    '..g.g.g...................................',
    '...ggg....................................',
    '.g.ggg.g..................................',
    '..ggggg...................................',
    '.pPppPp...yy..............................',
    'pPppPppp.yyyy.........................g...',
    'ppPppPpp.yy.yy..........rrrrrrrr.....gpg..',
    'pPppPppp.y...yy..bbbb...rrkrrkrr....pPppp.',
    'ppPppPpp.y....yybbWbbb..rrrrrrrr...pPPpppp',
    'pPppPppp......ybbWWWbb...wwwwww....ppPpppp',
    '.pPppPp........bbbbbbb....GGGG.....pppppp.',
    '..pppp..........bbbbb...............pppp..',
    '..........oo...........................oo.',
    '.........oOoo.........................oOoo',
    '.........oooo.........................oooo',
    '..........oo...........................oo.',
  ], { g: '#3a9a48', p: '#e8a83a', P: '#ffd060', y: '#ffd23f', b: '#7a4a2a', W: '#fffaf0', r: '#ff5a6a', k: '#2e2238', w: '#f4f0d0', G: '#3aa050', o: '#ff7a3a', O: '#ffc070' });
  for (let x = 40; x < 86; x += 2) put(x, 123, ['#ff5a8a', '#ffd23f', '#fffaf0'][(x >> 1) % 3], 'fl', '#ff5a8a');
  // the torches' bamboo poles
  TORCHES.forEach(([tx, ty]) => {
    for (let y = ty + 8; y < 148; y += 1) { put(tx - 1, y, BS[4], 'wood', BS[2]); put(tx, y, BS[3], 'wood', BS[2]); put(tx + 1, y, BS[2], 'wood', BS[2]); if (y % 6 === 2) { put(tx - 1, y, BS[1]); put(tx, y, BS[1]); put(tx + 1, y, BS[1]); } }
    for (let y = ty + 10; y < ty + 14; y += 1) for (let x = tx - 2; x <= tx + 2; x += 1) if ((x + y) % 2) put(x, y, '#c8a070', 'wood', BS[2]);
    grid((x, y, c) => put(x, y, c, 'wood', Wd[2]), tx - 3, ty + 6, ['wwwwwww', '.wWWWw.', '..www..'], { w: Wd[2], W: Wd[4] });
  });
  // bushes with flowers at the corners
  clump(b, 9, 136, 9, J, 11); clump(b, 19, 143, 6, VB.lime, 12); clump(b, 117, 138, 9, VB.teal, 13); clump(b, 107, 145, 5, J, 14);
  hibiscus(b, 7, 132, FLOWERS[1]); hibiscus(b, 13, 139, FLOWERS[0]); hibiscus(b, 119, 134, FLOWERS[2]); hibiscus(b, 113, 140, FLOWERS[3]);
  return toCanvas(b, W, H, 2);
}

const TOUCAN = [
  '...KKk......',
  '..Kkekoooo..',
  '..kkkkOOOOOr',
  '.kkkkWyyyyy.',
  '.kkkWWW.....',
  'kkkkWWW.....',
  '.kkkkWW.....',
  '..kkkk......',
  '...f.f......',
];
const TOUCAN_PAL = { k: '#1e1a2a', K: '#4a4660', e: '#5ac0f0', o: '#ff9a2a', O: '#ffb83a', r: '#e83a3a', W: '#fff4c0', y: '#ffd23f', f: '#5a8ae8' };

let cache = null;
const art = () => (cache ||= { back: paintBack(), head: headSprite(), front: frontSprite(), cracks: crackPixels() });

/**
 * Starts the stone face on its canvas. Returns step(now), to call every animation frame; it
 * redraws about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a
 * while; while the map's show plays (the village has .show-on) it stays awake to watch.
 */
export function startStone(canvas, host) {
  const ctx = canvas.getContext('2d');
  const A = art();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal, flip = false) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(flip ? X + row.length - 1 - x : X + x, Y + y, c); } });
  const blob = (cx, cy, rx, ry, c) => { for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) if (inEll(x, y, cx, cy, rx, ry)) dot(x, y, c); };
  const puff = (cx, cy, r, k) => {
    // a puff of steam that thins away pixel by pixel as k goes 0 to 1
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      if (k > 0.92 || !inEll(x, y, cx, cy, r + 0.6, r)) continue;
      const s = (x + 0.5 - cx) + (y + 0.5 - cy);
      const P = k < 0.55 ? ['#d8d2e2', '#ffffff', '#eeeaf4'] : ['#b4accc', '#d8d2e2', '#c8c0d8'];
      dot(x, y, s > r * 0.5 ? P[0] : s < -r * 0.5 ? P[1] : P[2]);
    }
  };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 4800);
    ctx.putImageData(A.back, 0, 0);

    // the lava fall: it pours over a lip in the spire, curving down, bright bands sliding down it
    for (let y = FALL.top; y < FALL.bottom + 2; y += 1) {
      const k = (y - FALL.top) / (FALL.bottom - FALL.top);
      const cxF = FALL.x - 6 + 6 * Math.min(1, k * 3.2) - (k < 0.31 ? (1 - k / 0.31) * 0 : 0) + Math.sin(y * 0.35 + t * 2.4) * 0.5;
      const hwF = 2.6 + k * 2.4;
      for (let x = Math.floor(cxF - hwF - 1); x <= cxF + hwF + 1; x += 1) {
        const d = Math.abs(x + 0.5 - cxF);
        if (d > hwF + 1) continue;
        const band = (((y - f * 2 + Math.round((x - cxF) * 0.6)) % 8) + 8) % 8;
        dot(x, y, d > hwF ? '#5a1626' : d > hwF * 0.62 ? (x < cxF ? LV[4] : LV[3]) : band < 2 ? LV[7] : band < 4 ? LV[6] : LV[5]);
      }
    }
    // the lip it spills over
    for (let x = FALL.x - 10; x < FALL.x - 1; x += 1) { dot(x, FALL.top - 1, R[5]); dot(x, FALL.top, LV[4]); }
    // the pool: ripples drifting, a bubble popping now and then
    for (let y = POOL.y - 4; y <= POOL.y + 4; y += 1) for (let x = POOL.x - POOL.rx; x <= POOL.x + POOL.rx; x += 1) {
      if (!inEll(x, y, POOL.x, POOL.y, POOL.rx, POOL.ry)) continue;
      const w = Math.sin((x - POOL.x) * 0.5 + y * 1.3 - t * 3.5);
      dot(x, y, y < POOL.y - 2 ? LV[2] : w > 0.7 ? LV[6] : w > -0.2 ? LV[5] : LV[4]);
    }
    for (let k = 0; k < 3; k += 1) { const sx = FALL.x - 3 + ((f + k * 3) % 7); const sy = POOL.y - 2 - ((f + k * 2) % 3); dot(sx, sy, k ? LV[6] : LV[7]); }
    // steam from the vent and off the pool, and embers rising
    for (let k = 0; k < 3; k += 1) {
      const p = (t / 2.6 + k / 3) % 1;
      puff(VENT.x + Math.sin(p * 5 + k) * 2, VENT.y - 3 - p * 28, 1.5 + p * 3, p);
    }
    for (let k = 0; k < 2; k += 1) { const p = (t / 3.4 + k / 2) % 1; puff(POOL.x - 4 + k * 8 + Math.sin(p * 4) * 2, POOL.y - 6 - p * 20, 1.2 + p * 2.4, p); }
    for (let k = 0; k < 4; k += 1) { const p = (t / 4 + k / 4) % 1; dot(POOL.x - 8 + ((k * 7) % 17) + Math.sin(p * 9 + k) * 2, POOL.y - 4 - p * 40, p < 0.6 ? LV[6] : LV[4]); }

    // the head (it shakes as it rumbles awake)
    const rumble = !show && since > -100 && since < 750;
    const sx = rumble ? [1, -1, 1, -1, 0, 1, -1][f % 7] : 0;
    ctx.drawImage(A.head, sx - 2, -2);
    // its cracks: a faint warm pulse asleep, bright awake
    const pulse = 0.5 + 0.5 * Math.sin(t * 1.3);
    A.cracks.forEach(([x, y], i) => dot(x + sx, y, awake ? (i % 3 ? LV[5] : LV[6]) : pulse > 0.7 ? '#9a4a34' : pulse > 0.35 ? '#743a34' : '#5a3036'));
    const talk = !show && since > 400 && since < 2600;
    const wink = !show && since > 3000 && since < 3600;
    // the eyes
    EYES.forEach(([ex, ey], i) => {
      const x = ex + sx;
      if (!awake) {
        // asleep: a contented curve with lashes
        rows(['k.........k', '.k.......k.', '..kkkkkkk..', '..l..l..l..'], x - 5, ey - 1, { k: STN[1], l: STN[2] });
        return;
      }
      // lifted brows
      rows(['..bbbbbbb..', '.bBBBBBBBb.', 'b.........b'], x - 5, ey - 11, { b: STN[2], B: STN[6] });
      if (wink && i === 0) { rows(['...kkkkk...', '.kk.....kk.', 'k.........k'], x - 5, ey - 1, { k: STN[1] }); return; }
      // open: big round glowing eyes, the pupils on the buddy (down and right), or up at the show
      blob(x + 0.5, ey + 0.5, 7, 4.8, '#a8501e');
      blob(x + 0.5, ey + 0.5, 6, 4, '#ffa830');
      blob(x + 0.5, ey - 0.4, 4.4, 2.6, '#ffd060');
      blob(x - 1.5, ey - 1.5, 1.6, 1, '#fff4c0');
      const lx = show ? -1 : since < 700 ? 0 : 1; const ly = show ? -1 : since < 700 ? 0 : 1;
      rows(['.kk.', 'kkkk', 'kkkk', '.kk.'], x + lx - 2, ey + ly - 2, { k: '#2e2238' });
      dot(x + lx - 1, ey + ly - 1, '#ffffff');
    });
    if (wink) {
      const p = (since - 3000) / 600; const k = p < 0.5 ? 1 : 0;
      rows(k ? ['..w..', '..w..', 'wwyww', '..w..', '..w..'] : ['.w.', 'wyw', '.w.'], EYES[0][0] - 14 + sx - (k ? 2 : 1), EYES[0][1] - 9 - (k ? 2 : 1), { w: '#fffbe0', y: '#ffd23f' });
    }
    // a warm blush when it's awake
    if (awake) [[42, 75], [82, 75]].forEach(([cx, cy]) => { for (let y = cy - 2; y <= cy + 2; y += 1) for (let x = cx - 4; x <= cx + 4; x += 1) if (inEll(x, y, cx, cy, 4.2, 2.4) && (x + y) % 2) dot(x + sx, y, '#ff8a8a'); });
    // the mouth: a smile asleep; awake it talks, then beams
    const mx = MOUTH.x + sx; const my = MOUTH.y;
    const grin = (wide, deep) => {
      // an open smile: flat-ish top, round bottom, a pink tongue, the lip lit below
      for (let x = mx - wide; x <= mx + wide; x += 1) {
        const u = (x - mx) / wide; const top = my - 1 - Math.round(u * u * 2); const bot = my - 1 + Math.round(Math.sqrt(Math.max(0, 1 - u * u)) * deep);
        for (let y = top; y <= bot; y += 1) dot(x, y, y === top || y === bot || Math.abs(u) > 0.92 ? STN[1] : y > bot - 2 && Math.abs(u) < 0.5 ? '#e8708a' : y === top + 1 ? '#5a2030' : '#3a1420');
        dot(x, bot + 1, STN[6]);
      }
    };
    if (talk) {
      if ((f % 6) < 3) grin(8, 7);
      else grin(6, 4);
    } else if (awake) grin(10, 6);
    else {
      for (let x = mx - 9; x <= mx + 9; x += 1) {
        const u = (x - mx) / 9; const yy = my - 1 + Math.round((1 - u * u) * 2);
        dot(x, yy, STN[1]); dot(x, yy + 1, STN[6]);
      }
      // snoring: little z's float up
      for (let k = 0; k < 3; k += 1) {
        const p = (t / 3 + k / 3) % 1;
        if (p > 0.85) continue;
        const zx = 92 + p * 12 + Math.sin(p * 6) * 2; const zy = 46 - p * 26;
        rows(p < 0.3 ? ['zzz', '.z.', 'zzz'] : ['zzzz', '..z.', '.z..', 'zzzz'], zx, zy, { z: p > 0.65 ? '#c8c0d8' : '#f6f2fa' });
      }
    }

    ctx.drawImage(A.front, -2, -2);
    // dust shaken up at its foot as it rumbles
    if (rumble) {
      const p = clamp(since / 750, 0, 1);
      for (let k = 0; k < 5; k += 1) {
        const cx = 22 + k * 21 + Math.sin(k * 2) * 3; const cy = 146 - p * 5 - (k % 2) * 2; const r = 1.4 + p * 2.2;
        for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) if (inEll(x, y, cx, cy, r + 0.6, r) && p < 0.9) dot(x, y, (x + y) % 3 ? '#b8a090' : '#d8c4b0');
      }
    }

    // the torch flames
    TORCHES.forEach(([tx, ty], i) => {
      const k = (f + i * 2) % 4;
      const FL = [['..o..', '.ooo.', '.oyo.', 'oyWyo', 'oyWyo', '.oyo.'], ['...o.', '..oo.', '.oyo.', 'oyyoo', 'oyWyo', '.oyo.'], ['.o...', '.oo..', '.oyo.', 'ooyyo', 'oyWyo', '.oyo.'], ['..o..', '..oo.', '.oyo.', 'oyWyo', 'oyWWo', '.ooo.']][k];
      rows(FL, tx - 2, ty, { o: LV[3], y: LV[5], W: LV[7] });
    });
    // the toucan: hops round now and then; flutters up as the stone wakes, then lands
    const flap = !show && since > -100 && since < 1400;
    const up = flap ? Math.sin(clamp(since / 1400, 0, 1) * Math.PI) * 9 : 0;
    const face = flap ? 1 : (Math.floor(t / 5.5) % 2 ? -1 : 1);
    const tx = PERCH.x + sx; const ty = PERCH.y - Math.round(up) - (!flap && (t % 5.5) < 0.2 ? 1 : 0);
    rows(TOUCAN, tx, ty, TOUCAN_PAL, face < 0);
    if (flap) rows(f % 2 ? ['kk....', '.kkk..', '..kk..'] : ['......', 'kkkk..', '.kkk..'], tx + (face < 0 ? 6 : 1), ty + 2 - (f % 2 ? 2 : 0), { k: '#1e1a2a' });
  };
}

