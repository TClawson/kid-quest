// The kid's garden behind the buddy's house, in the village's soft storybook style (style B,
// like houseart.js and meadowart.js): warm hue-shifted ramps, ordered dithering, and selective
// outlines (each thing edged in a darker shade of its own color, near-black ink only where it
// meets the ground). One art pixel per scene pixel, the same scale as the house inside.
//
// The yard is seen from above and a little in front, like the house: the back of the buddy's
// cottage stands across the top with its back door, a path runs down the middle to a garden
// gate in the fence at the bottom, three raised beds stand each side of the path, and two big
// tree spots sit to the left and right. paintYard() paints everything flat into one canvas;
// plants, standing decorations, critters and the watering can are their own little canvases
// (so the buddy can walk behind them), each with its anchor (ax, ay) on the canvas.
//
// Everything is drawn in code from fixed seeds (no Math.random) and kept by key, so asking
// again for the same picture is free. Kept canvases are shared: draw them into your own
// canvas (drawImage) rather than putting the same one in the page twice.

import { ramp, mix, hexRgb, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer, rng } from './pixelkit.js';
import { sprite, shadow } from './houseart.js';
import { PB, FL, tuft, flowerB, grassB, lilyPad, reeds, pebbleB } from './meadowart.js';
import { seedById, decorById } from './gardenrules.js';

const INK = '#3b2235'; // houseart.js INK (kept here too, so nothing runs on a half-loaded import)
const WD = PB.wood; const LEAF = PB.leaf; const G = PB.grass; const ST = PB.stone; const WS = PB.wash;
const TH = PB.thatch; const WA = PB.water; const DT = PB.dirt; const BR = PB.brick;
const SAGE = ['#3e5650', '#56705e', '#6e8a70', '#8aa686', '#a8c2a0', '#cadcbc'];
const GOLD = ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];
const GLOW = ['#7a3a3a', '#c86a3a', '#f0a848', '#ffd878', '#fff4c8'];
const SOIL = ['#3a2230', '#4e2c36', '#66403e', '#7e5244', '#9a6a4e', '#b8875e'];
const BARK = ['#3a2430', '#5a3634', '#7a4c3c', '#9a6648', '#b8845a', '#d4a676'];
const WHITE = ['#6e6888', '#a09cb8', '#cdcadc', '#ecebf3', '#ffffff'];
const METAL = ['#3e4058', '#5a6080', '#8090b0', '#aec0d8', '#dce8f4', '#ffffff'];

// ---------- the yard's plan (scene pixels, same size as the house's ROOM) ----------

const W = 320; const H = 184;
const WALL = 50; // the foot of the house's back wall: the garden's ground starts below it
const FENCE = 180; // the foot of the fence along the bottom
const bed = (x, y) => ({ x, y, w: 54, h: 24 });
const BEDS = [bed(90, 60), bed(176, 60), bed(90, 98), bed(176, 98), bed(90, 136), bed(176, 136)];

/**
 * The garden's plan, in scene pixels (W x H like ROOM in houseart.js).
 *  beds[i]: { x, y, w, h } the raised bed's box (frame and front included), in reading order
 *    (0 top left, 1 top right, 2 middle left ...). foot: where plantArt's anchor goes (the front
 *    edge of the soil, in the middle). stand: where the buddy stands to tend it, and face (1
 *    looks right, -1 left): on the path beside the bed.
 *  trees[i]: { x, y } the tree's trunk foot (plantArt's anchor goes there), with stand / face.
 *  spots: each a foot point (bottom middle) for decorArt / canArt: water (birdbath; the pond is
 *    painted flat round it), bees, seat, can (where the watering can waits), and fence / path
 *    (a point on them, for a tap target or a sparkle when one is bought).
 *  door: the back door's box in the house wall (leads inside); doorStep: where the buddy stands
 *    coming out of it. gate: the gateway's box in the bottom fence (out to the village);
 *    gateStep: just inside it.
 *  blocks: [x, y, w, h] boxes the buddy can't walk into, always (the house, the fences, the
 *    beds, the tree trunks), in the same form as house.js obstacles for makeGrid.
 *    yardBlocks(layout) adds the standing decorations; walk(x, y, layout) says if a point is open.
 */
export const YARD = {
  W, H, wall: WALL, fence: FENCE,
  path: { x: 150, w: 20 },
  beds: BEDS.map((b, i) => ({
    ...b,
    foot: { x: b.x + b.w / 2, y: b.y + b.h - 6 },
    stand: i % 2 ? { x: b.x - 7, y: b.y + b.h - 3, face: 1 } : { x: b.x + b.w + 7, y: b.y + b.h - 3, face: -1 },
  })),
  trees: [{ x: 46, y: 106, stand: { x: 74, y: 110, face: -1 } }, { x: 274, y: 106, stand: { x: 246, y: 110, face: 1 } }],
  spots: {
    fence: { x: 40, y: FENCE }, path: { x: 160, y: 118 },
    water: { x: 46, y: 152 }, bees: { x: 300, y: 134 }, seat: { x: 262, y: 162 }, can: { x: 182, y: 57 },
  },
  door: { x: 151, y: 22, w: 18, h: 28 },
  doorStep: { x: 160, y: 60 },
  gate: { x: 148, y: 166, w: 24, h: 18 },
  gateStep: { x: 160, y: 168 },
  blocks: [
    [0, 0, W, WALL + 3], // the house and the hedges
    [0, 0, 9, H], [W - 9, 0, 9, H], // the side fences
    [0, FENCE - 10, 148, 14], [172, FENCE - 10, 148, 14], // the bottom fence, open at the gate
    ...BEDS.map((b) => [b.x, b.y, b.w, b.h]),
    [46 - 7, 106 - 5, 14, 7], [274 - 7, 106 - 5, 14, 7], // the tree spots
  ],
  walk: (x, y, layout) => !yardBlocks(layout).some(([bx, by, bw, bh]) => x >= bx && x < bx + bw && y >= by && y < by + bh),
};
const SP = YARD.spots;

/** Everything the buddy can't walk into with these decorations out: YARD.blocks plus the standing ones. */
export function yardBlocks(layout = {}) {
  const out = [...YARD.blocks];
  const w = layout?.water?.art; const s = layout?.seat?.art;
  if (w === 'pond') out.push([20, 138, 52, 21]);
  else if (w) out.push([SP.water.x - 7, SP.water.y - 6, 14, 7]);
  if (layout?.bees) out.push([SP.bees.x - 8, SP.bees.y - 6, 16, 7]);
  if (s === 'bench') out.push([SP.seat.x - 15, SP.seat.y - 7, 30, 8]);
  else if (s === 'swing') out.push([SP.seat.x - 19, SP.seat.y - 5, 6, 6], [SP.seat.x + 13, SP.seat.y - 5, 6, 6]);
  return out;
}

// ---------- drawing helpers ----------

const kept = new Map();
const keep = (key, fn) => { if (!kept.has(key)) kept.set(key, fn()); return kept.get(key); };

function newCanvas(w, h, doc) {
  const d = doc || globalThis.document;
  const c = d ? d.createElement('canvas') : new OffscreenCanvas(w, h);
  c.width = w; c.height = h;
  return c;
}

/** A sprite buffer as a canvas, its anchor (ax, ay) set from a point in the sprite's own coordinates. */
function toCanvas(b, ax, ay, doc) {
  const c = newCanvas(b.W, b.H, doc);
  const pb = pixelBuffer(b.W, b.H);
  b.blit(pb.px, b.pad, b.pad);
  pb.put(c.getContext('2d'));
  c.ax = ax + b.pad; c.ay = ay + b.pad;
  return c;
}

/** A copy of a kept canvas (for a shop card, which goes in the page). */
function copyCanvas(src, doc) {
  const c = newCanvas(src.width, src.height, doc);
  c.getContext('2d').drawImage(src, 0, 0);
  c.ax = src.ax; c.ay = src.ay;
  return c;
}

const put = (b, tag) => (x, y, c) => b.set(x, y, c, tag);

/** A color dulled for a droopy plant: a little greyer and warmer, still alive. */
const dullCache = new Map();
function dull(c, k = 0.3) {
  if (!c || c[0] !== '#') return c;
  const key = `${c}|${k}`;
  if (!dullCache.has(key)) {
    const [r, g, b] = hexRgb(c);
    const l = r * 0.32 + g * 0.5 + b * 0.18;
    dullCache.set(key, mix(c.slice(0, 7), `#${[l * 1.06 + 8, l * 0.98 + 4, l * 0.8].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`, k));
  }
  return dullCache.get(key);
}

// ---------- the ground ----------

/** A worn dirt path down the middle: no outline, the edges dithered into the grass, pebbles. */
function dirtPath(px, seed) {
  const cx = 160; const R = 9.5;
  for (let y = WALL; y < H; y += 1) {
    for (let x = cx - 14; x < cx + 14; x += 1) {
      const wob = (vnoise(x, y, 7, seed) - 0.5) * 2.4 + (vnoise(x, y, 3, seed + 1) - 0.5) * 0.9;
      const d = Math.abs(x + 0.5 - cx - Math.sin(y / 23) * 1.2) - R - wob;
      if (d > 1.5) continue;
      const lit = x < cx ? 1 : -1;
      if (d > -1) {
        const t = (d + 1) / 2.5;
        if (bayer(x, y) < t) { if (lit < 0 && d < 0.6 && bayer(x, y) < t - 0.3) px(x, y, G[2]); continue; }
        px(x, y, lit < 0 ? DT[2] : '#d6aa72');
        if (h2(x, y, seed + 7) < 0.07) { px(x, y, G[2]); px(x + (lit < 0 ? 1 : -1), y - 1, G[4]); }
        continue;
      }
      let c = DT[3];
      const m = vnoise(x, y, 9, seed + 2) + (bayer(x, y) - 0.5) * 0.14;
      if (m < 0.34) c = '#d8ad76'; else if (m > 0.64) c = DT[4];
      if (Math.abs(x + 0.5 - cx) < 3.2 && bayer(x, y) < 0.42 + (m - 0.5)) c = DT[4];
      if (d > -2 && lit < 0 && bayer(x, y) < 0.55) c = '#d2a26c';
      px(x, y, c);
      const hh = h2(x, y, seed);
      if (d < -2.5 && hh > 0.993) pebbleB(px, x, y, Math.floor(h2(y, x, seed) * 4));
      else if (d < -2 && hh < 0.012) px(x, y, DT[2]);
    }
  }
}

const FLAG = ['#5e5464', '#7e7480', '#9e949a', '#bcb2ae', '#d6ccc0', '#ece4d6'];

/** A flat stone set in the grass: lit top left, a darker lip bottom right, a little moss. */
function flatStone(px, cx, cy, rx, ry, mossy, seed) {
  const inS = (x, y) => { const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const wob = 1 + (h2(Math.round(a * 2.5), 1, seed) - 0.5) * 0.18; return inEll(x, y, cx, cy, rx * wob, ry * wob); };
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y += 1) {
    for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
      if (!inS(x, y)) { if (inS(x, y - 1) || inS(x - 1, y - 1)) px(x, y, 'rgba(42,24,56,0.28)'); continue; }
      const s2 = (x + 0.5 - cx) / rx + (y + 0.5 - cy) / ry;
      let c = s2 < -0.9 ? FLAG[5] : s2 < -0.2 ? FLAG[4] : s2 > 0.75 ? FLAG[2] : FLAG[3];
      if (!inS(x, y + 1) || !inS(x + 1, y)) c = FLAG[1];
      else if (!inS(x, y - 1) || !inS(x - 1, y)) c = FLAG[4];
      if (h2(x, y, seed) > 0.94 && c !== FLAG[1]) c = FLAG[2];
      if (mossy && vnoise(x, y, 2.5, seed) > 0.64 && c !== FLAG[1]) c = s2 < 0 ? '#9ec46a' : '#78a85a';
      px(x, y, c);
    }
  }
}

/** Stepping stones down the middle: flat warm stones in the grass, the grass trodden darker round them. */
function stonePath(px, seed) {
  const stones = [];
  for (let y = WALL + 9, i = 0; y < H + 6; y += 11, i += 1) stones.push([160 + (i % 2 ? 2.5 : -2.5) + Math.round((h2(i, 2, seed) - 0.5) * 2), y, 6 + h2(i, 3, seed) * 1.2, 3.2 + h2(i, 4, seed) * 0.5]);
  for (const [cx, cy, rx, ry] of stones) {
    for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y += 1) {
      for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x += 1) {
        if (inEll(x, y, cx, cy + 0.5, rx + 1.6, ry + 1.3) && bayer(x, y) < 0.5) px(x, y, G[2]);
        else if (inEll(x, y, cx, cy + 0.5, rx + 3, ry + 2.4) && bayer(x, y) < 0.18) px(x, y, G[2]);
      }
    }
  }
  stones.forEach(([cx, cy, rx, ry], i) => flatStone(px, cx, cy, rx, ry, h2(i, 9, seed) < 0.35, seed + i));
  // clover and daisies poking up between them
  for (let i = 0; i < stones.length - 1; i += 1) {
    const [x0, y0] = stones[i]; const [x1, y1] = stones[i + 1];
    const mx = Math.round((x0 + x1) / 2) + (i % 2 ? 7 : -8); const my = Math.round((y0 + y1) / 2);
    if (h2(i, 5, seed) < 0.5) flowerB(px, mx, my, i % 3 ? 'daisy' : 'clover', 'white'); else tuft(px, mx, my, i);
  }
}

/** A brick path: basket-weave bricks in warm reds, an edging of bricks on end, moss in a few joints. */
function brickPath(px, seed) {
  const x0 = 148; const x1 = 172;
  const tone = (k) => { const t = h2(k, 1, seed); return t < 0.2 ? ['#8a3e46', '#b85a4e', '#d47a5c'] : t < 0.4 ? ['#9a4a3e', '#c87050', '#e09468'] : t < 0.5 ? ['#7a3a46', '#a65050', '#c46a5a'] : ['#94423e', '#c06050', '#dc8462']; };
  const mortar = ['#a8866e', '#d8bc98'];
  for (let y = WALL + 2; y < H; y += 1) {
    for (let x = x0 - 2; x < x1 + 2; x += 1) {
      const edge = x < x0 + 2 || x >= x1 - 2;
      if (x < x0 || x >= x1) { if (bayer(x, y) < 0.45) px(x, y, '#8a6a52'); continue; } // a little dark soil line
      let c;
      if (edge) {
        // the edging: bricks on end, 2 wide and 5 long, along both sides
        const k = Math.floor((y - WALL) / 5) * 2 + (x < 160 ? 0 : 1); const v = (y - WALL) % 5; const u = x < 160 ? x - x0 : x - (x1 - 2);
        const T = tone(k + 500);
        c = v === 4 ? mortar[0] : v === 0 ? T[2] : u === 1 ? T[0] : T[1];
      } else {
        // basket weave: 6 x 6 squares, two bricks across then two bricks down
        const lx = x - (x0 + 2); const ly = y - WALL - 2;
        const sx = Math.floor(lx / 6); const sy = Math.floor(ly / 6); const u = lx % 6; const v = ly % 6;
        const across = (sx + sy) % 2 === 0;
        const half = across ? Math.floor(v / 3) : Math.floor(u / 3);
        const bu = across ? u : u % 3; const bv = across ? v % 3 : v;
        const T = tone(sx * 31 + sy * 7 + half);
        const lenEnd = across ? bu === 5 : bv === 5; const sideEnd = across ? bv === 2 : bu === 2;
        if (lenEnd || sideEnd) c = (lenEnd && sideEnd) ? mortar[0] : (h2(x, y, seed) < 0.5 ? mortar[0] : mortar[1]);
        else if ((across ? bv : bu) === 0) c = T[2];
        else c = (h2(x >> 1, y, seed + 3) < 0.14) ? T[0] : T[1];
        if ((lenEnd || sideEnd) && vnoise(x, y, 5, seed + 4) > 0.72) c = bayer(x, y) < 0.5 ? LEAF[3] : LEAF[2]; // moss
      }
      // worn paler down the middle, a shade along the edges
      if (!edge && Math.abs(x + 0.5 - 160) < 5 && bayer(x, y) < 0.18) c = mix(c, '#f4dcb8', 0.25);
      px(x, y, c);
    }
  }
  // grass leaning over the edging now and then
  for (let y = WALL + 4; y < H; y += 3) { if (h2(y, 1, seed) < 0.3) tuft(px, x0 - 1, y, y); if (h2(y, 2, seed) < 0.3) tuft(px, x1 - 1, y, y + 1); }
}

/** A little pond (flat, the water spot): a stone rim, dark water at the back, lily pads, reeds, a frog. */
function pondArt(px, seed = 77) {
  const Z = { x: 20, y: 137, w: 52, h: 22 };
  const ov = (g, x, y) => { const dx = (x + 0.5 - (Z.x + Z.w / 2)) / (Z.w / 2 + g); const dy = (y + 0.5 - (Z.y + Z.h / 2)) / (Z.h / 2 + g); return 1 - (dx * dx + dy * dy); };
  const mid = Z.y + Z.h / 2;
  shadow(px, Z.x + Z.w / 2 + 1, Z.y + Z.h / 2 + 1, Z.w / 2 + 4, Z.h / 2 + 3, 0.12);
  for (let y = Z.y - 4; y < Z.y + Z.h + 4; y += 1) {
    for (let x = Z.x - 4; x < Z.x + Z.w + 4; x += 1) {
      const k = ov(0, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
      if (k < 0) { if (ov(1.2, x, y) >= 0) px(x, y, north ? DT[1] : DT[3]); continue; }
      let c = WA[2];
      if (north && ov(-2.5, x, y) < 0) c = ov(-1.2, x, y) < 0 ? '#3a3466' : WA[1];
      else if (!north && ov(-2, x, y) < 0) c = b < 0.5 ? WA[4] : WA[3];
      else if (k > 0.55 || (k > 0.4 && b < (k - 0.4) * 6)) c = WA[1];
      px(x, y, c);
    }
  }
  for (const [x, y, n] of [[33, 147, 3], [54, 152, 2], [46, 144, 4]]) { px(x, y, WA[5]); px(x + 1, y, WA[4], n, 1); }
  // stones round the rim
  [[0.02, 0.55], [0.09, 0.9], [0.3, 1.06], [0.56, 1.1], [0.82, 1.0], [0.97, 0.7], [0.99, 0.32], [0.84, 0.02], [0.6, -0.06], [0.36, -0.06], [0.12, 0.12]].forEach(([fx, fy], i) => flatStone(px, Math.round(Z.x + fx * Z.w), Math.round(Z.y + fy * Z.h), 3.2 + (i % 3) * 0.7, 2 + (i % 2) * 0.4, i % 3 === 1, seed + i));
  lilyPad(px, Z.x + 10, Z.y + 9, true, false);
  lilyPad(px, Z.x + 30, Z.y + 12, false, true);
  lilyPad(px, Z.x + 36, Z.y + 6, true, true);
  reeds(px, Z.x + 6, Z.y + 3, seed); reeds(px, Z.x + Z.w - 7, Z.y + 2, seed + 1);
  // a little frog on a stone
  grid(px, Z.x + Z.w - 9, Z.y + Z.h - 3, ['.kk.kk.', 'kwekewk', 'kGGGGGk', '.kgggk.'], { k: '#2f5a2a', w: '#ffffff', e: '#2a2438', G: '#6cc05a', g: '#c8ec98' });
}

/** An empty tree spot: a round of dark mulch with bark chips, ringed with little stones. */
function treeSpot(px, cx, cy, seed) {
  shadow(px, cx + 1, cy + 1, 14, 5.5, 0.1);
  for (let y = cy - 6; y <= cy + 6; y += 1) {
    for (let x = cx - 14; x <= cx + 14; x += 1) {
      if (!inEll(x, y, cx + 0.5, cy + 0.5, 12.5, 5)) continue;
      const n = vnoise(x, y, 2.2, seed);
      let c = n > 0.66 ? BARK[3] : n > 0.5 ? BARK[2] : n < 0.25 ? SOIL[1] : SOIL[2];
      if (!inEll(x, y - 1, cx + 0.5, cy + 0.5, 12.5, 5)) c = SOIL[1]; // the back lip, in shade
      if (h2(x, y, seed) > 0.93) c = BARK[4];
      px(x, y, c);
    }
  }
  for (let i = 0; i < 18; i += 1) {
    const a = (i / 18) * Math.PI * 2;
    const x = Math.round(cx + Math.cos(a) * 14); const y = Math.round(cy + 0.5 + Math.sin(a) * 6);
    const back = Math.sin(a) < -0.3;
    grid(px, x - 1, y - 1, back ? ['lm', 'md'] : ['lmm', 'mmd'], { l: ST[5], m: h2(i, 1, seed) < 0.3 ? '#d8c8b0' : ST[4], d: ST[2] });
    if (!back) px(x - 1, y + 1, 'rgba(42,24,56,0.25)', 3, 1);
  }
}

/** A raised bed: plank sides with corner posts, the front face showing, dark crumbly soil inside. */
function bedFrame(px, Z, seed) {
  const { x: X, y: Y, w, h } = Z;
  shadow(px, X + w / 2 + 2, Y + h, w / 2 + 2, 2, 0.2);
  const b = sprite(w, h, (b) => {
    const fy = h - 6; // the front's top edge
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        let c;
        const post = x < 3 || x >= w - 3;
        if (y >= fy) {
          const yy = y - fy;
          if (post) c = yy === 0 ? WD[5] : x === 0 ? WD[4] : x === w - 1 ? WD[1] : x === 2 || x === w - 3 ? WD[2] : WD[3];
          else {
            c = yy === 0 ? WD[5] : yy === 1 ? WD[4] : yy === 3 ? WD[1] : yy === 5 ? WD[2] : WD[3];
            if ((yy === 2 || yy === 4) && h2(x >> 2, yy, seed) < 0.18) c = WD[2]; // grain
            if ((yy === 2 || yy === 4) && (x === 6 || x === w - 7)) c = WD[0]; // nails
            if (yy === 1 && h2(x, 1, seed) < 0.1) c = WD[5];
          }
        } else if (y < 3) {
          c = y === 0 ? WD[5] : y === 1 ? WD[4] : WD[2];
          if (post && y < 2) c = WD[5];
          if (y === 2 && post) c = WD[3];
        } else if (x < 3) c = x === 0 ? WD[5] : x === 1 ? WD[4] : WD[2];
        else if (x >= w - 3) c = x === w - 3 ? WD[4] : x === w - 2 ? WD[3] : WD[2];
        else {
          // soil: crumbly clods lit from the top left, shade under the back plank and the left side
          const n = vnoise(x, y, 2.6, seed) * 0.7 + vnoise(x, y, 6, seed + 1) * 0.3;
          let k = 3;
          if (n > 0.62) k = 4; else if (n < 0.36) k = 2;
          if (n > 0.66 && bayer(x, y) < 0.5) k = 5;
          const row = (y - 3) % 5;
          if (row === 4 && bayer(x, y) < 0.6) k = Math.min(k, 2);
          if (y < 5 && bayer(x, y) < (5 - y) / 2.4) k = 1;
          if (x === 3 && bayer(x, y) < 0.7) k = Math.min(k, 2);
          if (h2(x, y, seed) > 0.975) k = 5;
          c = SOIL[k];
          if (h2(x, y, seed + 4) > 0.993) c = ST[3]; // a little stone
        }
        b.set(x, y, c);
      }
    }
    // the corner posts stand a little proud of the rim
    for (const x0 of [0, w - 3]) { b.set(x0, -1, WD[5]); b.set(x0 + 1, -1, WD[4]); b.set(x0 + 2, -1, WD[3]); b.set(x0, fy - 1, WD[5]); b.set(x0 + 1, fy - 1, WD[4]); b.set(x0 + 2, fy - 1, WD[3]); }
  });
  b.blit(px, X, Y);
}

// ---------- the house's back ----------

const HX0 = 24; const HX1 = 296; // the house wall's ends

/** A clipped hedge beside the house: round clumps lit from the top left, a few white flowers. */
function hedge(px, x0, x1, seed) {
  const top = (x) => 3 + Math.round(Math.sin(x * 0.55) * 1.5 + vnoise(x, 0, 5, seed) * 3);
  for (let y = 0; y < WALL + 2; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const t = top(x);
      if (y < t) continue;
      const n = vnoise(x, y, 3.2, seed) * 0.75 + vnoise(x, y, 8, seed + 1) * 0.25;
      const fx = vnoise(x + 2, y + 2, 3.2, seed) * 0.75 + vnoise(x + 2, y + 2, 8, seed + 1) * 0.25;
      let k = n > 0.6 ? 3 : n > 0.42 ? 2 : 1;
      if (n - fx > 0.07 && bayer(x, y) < 0.7) k += 1; // lit sides of clumps
      if (n - fx < -0.08 && bayer(x, y) < 0.6) k -= 1;
      if (y === t) k = 4; else if (y === t + 1) k = Math.max(k, 3);
      if (y > WALL - 6 && bayer(x, y) < (y - WALL + 6) / 7) k = Math.min(k, 1);
      px(x, y, LEAF[Math.max(0, Math.min(5, k))]);
      if (h2(x, y, seed) > 0.985 && y < WALL - 6) { px(x, y, '#ffffff'); px(x + 1, y, '#e8e2f0'); }
    }
  }
}

/** Hollyhocks against the wall: a stalk with cup flowers stepping up it, buds at the top. */
function hollyhock(b, x, base, hgt, col) {
  const [d, m, l] = FL[col];
  for (let y = base - 1; y > base - hgt; y -= 1) b.set(x, y, LEAF[2]);
  grid((xx, yy, c) => b.set(xx, yy, c), x - 3, base - 4, ['.lL...L.', 'lLLd.LLl', '.Ld..dL.'], { l: LEAF[4], L: LEAF[3], d: LEAF[2] });
  let i = 0;
  for (let y = base - 7; y > base - hgt + 2; y -= 3, i += 1) {
    const fx = x + (i % 2 ? 0 : -1);
    if (y < base - hgt + 6) { b.set(fx + 1, y, m); b.set(fx + 1, y - 1, l); continue; }
    grid((xx, yy, c) => b.set(xx, yy, c), fx, y - 1, ['.lm.', 'lmcd', '.dd.'], { l, m, d, c: '#f6e070' });
  }
  b.set(x, base - hgt + 1, LEAF[4]);
}

/** The back of the buddy's cottage: a thatch eave, whitewashed wall, the back door, windows with flower boxes. */
function houseBack(px, doorColor, seed = 17) {
  hedge(px, 0, HX0 + 4, seed);
  hedge(px, HX1 - 4, W, seed + 5);
  const w = HX1 - HX0; const top = 12;
  const b = new Buf(w, WALL + 2, 6);
  const P = (x, y, c, t) => b.set(x - HX0, y, c, t);
  // the wall: whitewash with soft patches, shade under the eave, grubby at the foot
  for (let y = top - 1; y < WALL; y += 1) {
    for (let x = HX0; x < HX1; x += 1) {
      let c = WS[3];
      const n = vnoise(x, y, 5, seed);
      if (n < 0.32 && bayer(x, y) < 0.5) c = WS[2];
      if (n > 0.7 && bayer(x, y) < 0.4) c = WS[4];
      const sh = (top + 6 - y) / 6;
      if (bayer(x, y) < sh) c = sh > 0.55 ? WS[1] : WS[2];
      const foot = (y - (WALL - 12)) / 10;
      if (bayer(x, y) < foot * 0.7) c = mix(WS[2], DT[2], 0.35);
      if (x === HX0) c = WS[4]; else if (x === HX0 + 1) c = c === WS[3] ? WS[4] : c;
      if (x >= HX1 - 2) c = x === HX1 - 1 ? WS[1] : WS[2];
      P(x, y, c, 'wall');
    }
  }
  // plaster fallen off: bricks showing in two soft patches
  const patch = (cx, cy, rw, rh) => {
    for (let y = Math.floor(cy - rh - 1); y <= cy + rh + 1; y += 1) {
      for (let x = Math.floor(cx - rw - 1); x <= cx + rw + 1; x += 1) {
        const inP = (xx, yy) => inEll(xx, yy, cx, cy, rw, rh) && vnoise(xx, yy, 2, seed) > 0.2;
        if (inP(x, y)) {
          const row = Math.floor(y / 3); const bx = (x + (row % 2) * 3) % 6;
          P(x, y, y % 3 === 2 || bx === 5 ? '#c8a898' : bx === 0 ? BR[3] : BR[2], 'wall');
        } else if (inP(x - 1, y) || inP(x, y - 1)) P(x, y, WS[4], 'wall');
        else if (inP(x + 1, y) || inP(x, y + 1)) P(x, y, WS[1], 'wall');
      }
    }
  };
  patch(HX0 + 18, 36, 4.5, 3); patch(HX1 - 52, 22, 3.5, 2.2);
  // a footing of stones along the bottom
  const rnd = rng(seed);
  for (const [y0, hh] of [[WALL - 7, 4], [WALL - 3, 3]]) {
    let x = HX0 - (y0 % 2 ? 2 : 0);
    while (x < HX1) {
      const sw = 5 + Math.floor(rnd() * 4); const t = rnd();
      const R3 = t < 0.25 ? ['#8a8a6e', '#b4b48e', '#d8d6b0'] : t < 0.4 ? ['#a08074', '#c8a898', '#e8ccb8'] : [ST[2], ST[3], ST[4]];
      for (let yy = 0; yy < hh; yy += 1) {
        for (let xx = 0; xx < sw; xx += 1) {
          const X = x + xx; if (X < HX0 || X >= HX1) continue;
          if ((xx === 0 || xx === sw - 1) && (yy === 0 || yy === hh - 1)) { P(X, y0 + yy, '#7a6a72', 'stone'); continue; }
          P(X, y0 + yy, xx === sw - 1 || yy === hh - 1 ? R3[0] : xx === 0 || yy === 0 ? R3[2] : R3[1], 'stone');
        }
      }
      x += sw;
    }
  }
  // the back door: round-topped, painted, a little round window, a big knob; a stone step
  const D = ramp(doorColor, 3, 2);
  const dr = YARD.door; const dw = dr.w; const dx = dr.x; const dy = dr.y;
  const inD = (x, y, g = 0) => x >= dx - g && x < dx + dw + g && y < WALL && (y >= dy + dw / 2 || inEll(x, y, dx + dw / 2, dy + dw / 2, dw / 2 + g, dw / 2 + g));
  for (let y = dy - 3; y < WALL; y += 1) {
    for (let x = dx - 3; x < dx + dw + 3; x += 1) {
      if (inD(x, y)) {
        const pl = (x - dx) % 4;
        let c = pl === 0 ? D[2] : pl === 1 ? D[4] : D[3];
        if (x >= dx + dw - 2) c = pl === 0 ? D[1] : D[2];
        if (!inD(x, y - 1)) c = D[1];
        if (y === WALL - 1) c = D[1];
        P(x, y, c, 'door');
      } else if (inD(x, y, 1)) P(x, y, WD[1], 'door');
      else if (inD(x, y, 2)) P(x, y, (x < dx + dw / 2 && y < dy + dw) || x < dx ? WD[4] : WD[2], 'wood');
    }
  }
  const mx = dx + dw / 2;
  grid((x, y, c) => P(x, y, c, 'door'), mx - 3, dy + 3, ['.KKKK.', 'KgGgGK', 'KGKKGK', 'KgGgGK', '.KKKK.'], { K: D[0], g: GLOW[3], G: GLOW[2] });
  grid((x, y, c) => P(x, y, c, 'door'), dx + dw - 6, dy + 16, ['.yY.', 'yYYo', '.oo.'], { y: '#fff0a0', Y: '#f0c030', o: '#a86a1a' });
  // a lantern by the door
  grid((x, y, c) => P(x, y, c, 'metal'), dx - 8, dy + 1, ['..m..', '.mmm.', 'mlyLm', 'myYym', 'moyom', '.mmm.', '..m..'], { m: '#4a4a5a', l: GLOW[4], y: GLOW[3], Y: GLOW[4], o: GLOW[2], L: GLOW[3] });
  // windows: wood frames lit warm from inside, sage shutters, flower boxes
  const win = (cx, wy, box, vine) => {
    const ww = 14; const wh = 12; const x = cx - ww / 2;
    for (let yy = 0; yy < wh; yy += 1) {
      for (let xx = 0; xx < ww; xx += 1) {
        let c;
        if (xx === 0 || yy === 0) c = WD[4]; else if (xx === ww - 1 || yy === wh - 1) c = WD[1];
        else if (xx === 1 || yy === 1 || xx === ww - 2 || yy === wh - 2) c = WD[2];
        else {
          c = yy < wh / 2 ? GLOW[3] : GLOW[2];
          if (xx + yy < 6) c = GLOW[4];
          if (xx === ww / 2 || xx === ww / 2 - 1 || yy === wh / 2) c = WD[3];
          if (yy === wh - 3 && xx > 2 && xx < ww - 3 && xx !== ww / 2 && xx !== ww / 2 - 1) c = GLOW[1];
        }
        P(x + xx, wy + yy, c, 'glass');
      }
    }
    // a curtain peeking in the top corners
    grid((xx, yy, c) => P(xx, yy, c, 'glass'), x + 2, wy + 2, ['ccc', 'cC.', 'c..'], { c: '#e8846a', C: '#f4a888' });
    grid((xx, yy, c) => P(xx, yy, c, 'glass'), x + ww - 5, wy + 2, ['ccc', '.Cc', '..c'], { c: '#e8846a', C: '#f4a888' });
    for (const [sx, lit] of [[x - 5, true], [x + ww + 1, false]]) {
      for (let yy = 0; yy < wh; yy += 1) {
        for (let xx = 0; xx < 4; xx += 1) {
          let c = yy % 3 === 2 ? SAGE[1] : lit ? SAGE[3] : SAGE[2];
          if (xx === 0) c = lit ? SAGE[4] : SAGE[3]; if (xx === 3) c = SAGE[1];
          if (yy === 0) c = SAGE[5];
          P(sx + xx, wy + yy, c, 'wood');
        }
      }
    }
    // the box and its flowers
    const by = wy + wh + 1;
    for (let xx = -2; xx < ww + 2; xx += 1) { P(x + xx, by, WD[4], 'wood'); P(x + xx, by + 1, WD[3], 'wood'); P(x + xx, by + 2, WD[2], 'wood'); }
    for (let xx = -2; xx < ww + 2; xx += 1) {
      const f = (xx * 3 + 7) % 5;
      P(x + xx, by - 1, LEAF[3], 'leaf');
      if (f < 3) P(x + xx, by - 2, f === 0 ? FL[box][2] : FL[box][1], 'fl');
      if (f === 1) P(x + xx, by - 3, FL[box][1], 'fl');
      if (f === 3) { P(x + xx, by + 3, LEAF[2], 'leaf'); if (xx % 2) P(x + xx, by + 4, LEAF[3], 'leaf'); }
    }
    if (vine) {
      // a climbing rose round the window
      for (let k = 0; k < 40; k += 1) {
        const t = k / 39; const a = Math.PI * (1 - t);
        const vx = Math.round(cx + Math.cos(a) * 15); const vy = Math.round(wy + 4 - Math.sin(a) * 6 + (t < 0.1 || t > 0.9 ? 6 : 0));
        P(vx, vy, LEAF[2], 'leaf'); if (k % 3 === 0) P(vx + 1, vy - 1, LEAF[4], 'leaf');
        if (k % 7 === 3) grid((xx, yy, c) => P(xx, yy, c, 'fl'), vx - 1, vy - 1, ['.l.', 'lmd', '.d.'], { l: FL.pink[2], m: FL.pink[1], d: FL.pink[0] });
      }
      for (let y = by + 3; y < WALL - 2; y += 1) { const vx = cx + 15 + Math.round(Math.sin(y / 3)); P(vx, y, LEAF[2], 'leaf'); if (y % 3 === 0) P(vx + 1, y, LEAF[3], 'leaf'); }
    }
  };
  win(84, 19, 'rose', false);
  win(236, 19, 'yellow', true);
  // a rain barrel left of the door with a downpipe from the eave, flower pots by it
  const bx = 124; const btop = 33;
  for (let y = 9; y < btop + 1; y += 1) { P(bx + 6, y, METAL[3], 'metal'); P(bx + 7, y, METAL[2], 'metal'); }
  P(bx + 5, btop, METAL[3], 'metal'); P(bx + 8, btop, METAL[1], 'metal');
  for (let y = btop; y < WALL + 1; y += 1) {
    const bulge = y > btop + 3 && y < WALL - 2 ? 1 : 0;
    for (let x = bx - bulge; x < bx + 14 + bulge; x += 1) {
      const u = x - bx;
      let c = u % 4 === 3 ? WD[1] : u < 3 ? WD[4] : u > 10 ? WD[2] : WD[3];
      if (y === btop) c = WD[5];
      if (y === btop + 1 && u > 1 && u < 12) c = u < 6 ? WA[4] : WA[3];
      if (y === btop + 4 || y === WALL - 3) c = u < 3 ? METAL[2] : METAL[1];
      P(x, y, c, 'wood');
    }
  }
  // pots stacked by the barrel, one with a seedling
  grid((x, y, c) => P(x, y, c, 'pot'), bx - 13, WALL - 9, ['....gG....', '...gGg....', '.ppppppp..', '.PPPPPPq..', '..PPPPq...', '..PPPPq.pp', '..qqqqqpPq', '.......pPq'], { g: LEAF[3], G: LEAF[4], p: '#f0a070', P: '#d8784a', q: '#a8503a' });
  // a rake and a spade leaning on the wall
  for (let i = 0; i < 26; i += 1) { P(262 + Math.floor(i / 9), WALL - 1 - i, i % 4 ? WD[3] : WD[4], 'wood'); }
  grid((x, y, c) => P(x, y, c, 'metal'), 261, WALL - 30, ['m.m.m.m', 'mmmmmmm', '...M...'], { m: METAL[2], M: METAL[1] });
  for (let i = 0; i < 22; i += 1) P(272 - Math.floor(i / 8), WALL - 7 - i, WD[3], 'wood');
  grid((x, y, c) => P(x, y, c, 'metal'), 270, WALL - 8, ['mMMm', 'mMMm', 'mMMm', '.mm.'], { m: METAL[2], M: METAL[4] });
  grid((x, y, c) => P(x, y, c, 'wood'), 268, WALL - 31, ['.ww.', 'w..w', '.ww.'], { w: WD[4] });
  // hollyhocks against the wall
  hollyhock({ set: (x, y, c) => P(x, y, c, 'leaf') }, 52, WALL, 30, 'pink');
  hollyhock({ set: (x, y, c) => P(x, y, c, 'leaf') }, 58, WALL, 22, 'white');
  hollyhock({ set: (x, y, c) => P(x, y, c, 'leaf') }, 208, WALL, 27, 'lilac');
  hollyhock({ set: (x, y, c) => P(x, y, c, 'leaf') }, 113, WALL - 9, 14, 'rose');
  // outline what stands on the wall (not the wall itself), then the thatch over it all
  const marks = [];
  b.each((x, y) => {
    if (b.tag(x, y) === 'wall' || b.tag(x, y) === 'stone') return;
    if (!b.get(x, y)) return;
    for (const [dx2, dy2, side] of [[0, 1, 'b'], [1, 0, 'r'], [0, -1, 't'], [-1, 0, 'l']]) {
      const t = b.tag(x + dx2, y + dy2);
      if (t === 'wall' || t === 'stone') marks.push([x + dx2, y + dy2, mix(b.get(x, y).slice(0, 7), INK, side === 'b' || side === 'r' ? 0.5 : 0.3)]);
    }
  });
  marks.forEach(([x, y, c]) => b.set(x, y, c, 'edge'));
  b.blit(px, HX0, 0);
  thatchEave(px, seed);
  // the step, and the shade along the wall's foot
  for (let x = HX0; x < HX1; x += 1) { px(x, WALL, INK); if (bayer(x, WALL + 1) < 0.6) px(x, WALL + 1, 'rgba(42,24,56,0.28)'); if (bayer(x, WALL + 2) < 0.3) px(x, WALL + 2, 'rgba(42,24,56,0.2)'); }
  grid(px, 147, WALL - 1, ['.lllllllllllllllllllllll.', 'lmmmmmmmmmmmmmmmmmmmmmmmd', 'ddddddddddddddddddddddddd', '.kkkkkkkkkkkkkkkkkkkkkkk.'], { l: ST[5], m: ST[4], d: ST[2], k: INK });
}

/** The thatch's hem along the top: rounded at the ends, strands and courses, a shaggy edge. */
function thatchEave(px, seed) {
  const x0 = HX0 - 5; const x1 = HX1 + 5;
  const hem = (x) => {
    let y = 12 + Math.round(Math.sin(x * 0.85) * 0.6 + (h2(x, 2, seed) < 0.35 ? 1 : 0));
    const end = Math.min(x - x0, x1 - 1 - x);
    if (end < 8) y -= Math.round((8 - end) ** 2 / 9);
    return y;
  };
  const b = new Buf(x1 - x0, 18, 2);
  for (let x = x0; x < x1; x += 1) {
    const hy = hem(x);
    for (let y = 0; y <= hy; y += 1) {
      let k = 3;
      const strand = h2(x, Math.floor((y + h2(x, 1, seed) * 6) / 4), seed);
      if (strand < 0.22) k -= 1; else if (strand > 0.84) k += 1;
      if (y < 3) k += 1;
      if (y === 5 + Math.round(Math.sin(x / 4) * 0.8)) k -= 1;
      if (y === 6 + Math.round(Math.sin(x / 4) * 0.8)) k += 1;
      if (y >= hy - 1) k = (x % 2 ? 1 : 2);
      if (y === hy - 2 && x % 3 === 0) k = 5;
      b.set(x - x0, y, TH[Math.max(0, Math.min(5, k))], 'thatch');
    }
    if (h2(x, 3, seed) < 0.3) b.set(x - x0, hy + 1, TH[1], 'thatch'); // straggly ends
  }
  // moss in a couple of clumps
  for (const [cx, cy, rx, ry] of [[70, 6, 5, 2.2], [232, 4, 3.5, 1.6], [180, 7, 2.5, 1.2]]) {
    for (let y = cy - 3; y <= cy + 3; y += 1) for (let x = cx - 6; x <= cx + 6; x += 1) {
      if (!inEll(x, y, cx, cy, rx, ry) || !b.get(x - x0, y)) continue;
      b.set(x - x0, y, !inEll(x, y - 1, cx, cy, rx, ry) ? LEAF[4] : !inEll(x, y + 1, cx, cy, rx, ry) ? LEAF[2] : LEAF[3], 'thatch');
    }
  }
  b.outline((t, side) => (side === 'bottom' ? TH[0] : side === 'right' || side === 'left' ? TH[1] : null));
  b.soften((c) => mix(c, TH[1], 0.45), ['thatch']);
  b.blit(px, x0, 0);
  // its shadow on the wall
  for (let x = HX0; x < HX1; x += 1) { const y = hem(x) + 2; if (bayer(x, y) < 0.7) px(x, y, 'rgba(58,30,60,0.22)'); px(x, y + 1, 'rgba(58,30,60,0.12)'); }
}

// ---------- fences ----------

const FENCES = {
  'fence-wood': { name: 'wood' },
  'fence-picket': { name: 'picket' },
  'fence-flower': { name: 'flower' },
};
const PASTEL = [ramp('#f4a6c0', 2, 2), ramp('#ffe08a', 2, 2), ramp('#a6e0c0', 2, 2), ramp('#a8ccf4', 2, 2), ramp('#d4b8f0', 2, 2)];

/** The fence along the bottom, as a sprite w wide (one run between posts at its ends). */
function fenceRun(kind, w, seed) {
  const hgt = 15;
  return sprite(w, hgt, (b) => {
    if (kind === 'wood') {
      const posts = []; for (let x = 0; x < w - 4; x += 15 + Math.floor(h2(x, 1, seed) * 3)) posts.push(x);
      posts.push(w - 3);
      for (const ry of [4, 9]) {
        for (let i = 1; i < posts.length; i += 1) {
          const a = posts[i - 1]; const c = posts[i];
          for (let x = a; x < c + 3; x += 1) {
            const sag = Math.round(Math.sin(((x - a) / (c - a + 3)) * Math.PI) * (ry === 4 ? 1 : 0.6));
            b.set(x, ry + sag, h2(x, ry, seed) < 0.15 ? WD[3] : WD[4]); b.set(x, ry + sag + 1, h2(x, ry + 1, seed) < 0.2 ? WD[1] : WD[2]);
            if (h2(x, ry, 9) < 0.08) b.set(x, ry + sag, WD[5]);
          }
        }
      }
      posts.forEach((x, i) => {
        const lean = i % 3 === 1 ? 1 : 0; const top = h2(i, 3, seed) < 0.5 ? 0 : 1;
        for (let y = top; y < hgt; y += 1) {
          const lx = x + (y < 6 ? lean : 0);
          b.set(lx, y, WD[3]); b.set(lx + 1, y, WD[2]); b.set(lx + 2, y, WD[1]);
          if (y === top) { b.set(lx, y, WD[5]); b.set(lx + 1, y, WD[4]); b.set(lx + 2, y, WD[3]); }
        }
        if (h2(i, 7, seed) < 0.5) b.set(x + 1, 8, WD[0]);
      });
    } else if (kind === 'picket') {
      // two rails behind, then white pickets with pointed tops; a square post every 5
      for (let x = 0; x < w; x += 1) { b.set(x, 4, WHITE[2]); b.set(x, 5, WHITE[1]); b.set(x, 10, WHITE[2]); b.set(x, 11, WHITE[1]); }
      for (let x = 0, i = 0; x < w - 2; x += 4, i += 1) {
        const post = i % 6 === 0;
        if (post) {
          for (let y = 0; y < hgt; y += 1) for (let xx = 0; xx < 4; xx += 1) b.set(x + xx, y, y === 0 ? WHITE[4] : xx === 0 ? WHITE[4] : xx === 3 ? WHITE[1] : WHITE[3]);
          grid((xx, yy, c) => b.set(xx, yy, c), x, -3, ['.ww.', 'wWWw', '.ww.'], { w: WHITE[3], W: WHITE[4] });
          continue;
        }
        const tip = h2(i, 2, seed) < 0.2 ? 1 : 0;
        for (let y = 1 + tip; y < hgt; y += 1) {
          b.set(x, y, y === 1 + tip ? null : WHITE[4]); b.set(x + 1, y, y === 1 + tip ? WHITE[4] : WHITE[3]); b.set(x + 2, y, y === 1 + tip ? null : WHITE[2]);
        }
        if (h2(i, 4, seed) < 0.25) b.set(x + 1, 7, WHITE[2]); // a weathered spot
      }
    } else {
      // painted boards in pastels with round tops and little painted flowers, a post every 5
      for (let x = 0; x < w; x += 1) { b.set(x, 5, WD[3]); b.set(x, 6, WD[2]); b.set(x, 10, WD[3]); b.set(x, 11, WD[2]); }
      for (let x = 0, i = 0; x < w - 3; x += 5, i += 1) {
        const P = PASTEL[(i * 3) % 5];
        for (let y = 0; y < hgt; y += 1) {
          for (let xx = 0; xx < 4; xx += 1) {
            if (y === 0 && (xx === 0 || xx === 3)) continue;
            let c = xx === 0 ? P[3] : xx === 3 ? P[1] : P[2];
            if (y === 0 || (y === 1 && xx > 0 && xx < 3)) c = P[4];
            b.set(x + xx, y, c);
          }
        }
        if (i % 2 === 0) grid((xx, yy, c) => b.set(xx, yy, c), x, 5, ['.w..', 'wyw.', '.w..'], { w: '#ffffff', y: GOLD[3] });
        else b.set(x + 2, 9, '#ffffff');
      }
    }
  }, { pad: 4 });
}

/** A side fence, seen end on down the side of the garden: a column of post tops and rails. */
function fenceSide(px, kind, X, y0, y1, right, seed) {
  const b = sprite(5, y1 - y0, (b) => {
    const n = y1 - y0;
    if (kind === 'wood') {
      for (let y = 0; y < n; y += 1) { b.set(1, y, right ? WD[3] : WD[4]); b.set(2, y, right ? WD[2] : WD[3]); b.set(3, y, WD[1]); if (h2(y >> 2, 1, seed) < 0.2) b.set(2, y, WD[2]); }
      for (let y = 2; y < n; y += 16) {
        for (let yy = 0; yy < 7; yy += 1) for (let x = 0; x < 5; x += 1) b.set(x, y + yy, yy === 0 ? WD[5] : yy === 1 ? WD[4] : x === 0 ? WD[4] : x === 4 ? WD[1] : yy === 6 ? WD[2] : WD[3]);
      }
    } else if (kind === 'picket') {
      for (let y = 0; y < n; y += 1) {
        const r = y % 4;
        b.set(1, y, r === 0 ? WHITE[4] : WHITE[3]); b.set(2, y, r === 0 ? WHITE[4] : r === 3 ? WHITE[1] : WHITE[3]); b.set(3, y, r === 3 ? WHITE[1] : WHITE[2]);
        if (r === 0) b.set(0, y, WHITE[3]);
      }
      for (let y = 4; y < n; y += 24) {
        for (let yy = 0; yy < 6; yy += 1) for (let x = 0; x < 5; x += 1) b.set(x, y + yy, yy < 2 ? WHITE[4] : x === 0 ? WHITE[4] : x === 4 ? WHITE[1] : WHITE[3]);
        grid((xx, yy, c) => b.set(xx, yy, c), 1, y - 2, ['.w.', 'wWw'], { w: WHITE[3], W: WHITE[4] });
      }
    } else {
      for (let y = 0; y < n; y += 1) {
        const i = Math.floor(y / 5); const r = y % 5; const P = PASTEL[(i * 2) % 5];
        b.set(1, y, r === 0 ? P[4] : P[3]); b.set(2, y, r === 0 ? P[4] : r === 4 ? P[1] : P[2]); b.set(3, y, r === 4 ? P[0] : P[1]);
      }
      // a vine with flowers climbing along it
      for (let y = 0; y < n; y += 1) {
        const vx = 2 + Math.round(Math.sin(y / 3 + seed) * 1.6);
        if (h2(y, 5, seed) < 0.45) b.set(vx, y, LEAF[3]);
        if (y % 9 === 4) grid((xx, yy, c) => b.set(xx, yy, c), vx - 1, y - 1, ['.l.', 'lmd', '.d.'], { l: FL.rose[2], m: FL.rose[1], d: FL.rose[0] });
      }
    }
  }, { pad: 3, ground: false });
  // its shade on the grass inside
  for (let y = y0; y < y1; y += 1) for (let x = 0; x < 3; x += 1) if (bayer(x, y) < 0.45 - x * 0.14) px(right ? X - 1 - x : X + 5 + x, y + 1, 'rgba(42,24,56,0.22)');
  b.blit(px, X, y0);
}

/** A gate post: taller than the fence, with a cap that goes with it. */
function gatePost(kind, seed) {
  return sprite(5, 20, (b) => {
    const R = kind === 'picket' ? WHITE : kind === 'flower' ? PASTEL[(seed % 2) ? 0 : 3] : WD;
    const k = kind === 'wood' ? 0 : 0;
    for (let y = 2; y < 20; y += 1) for (let x = 0; x < 5; x += 1) b.set(x, y, y === 2 ? R[R.length - 1] : x === 0 ? R[R.length - 2] : x === 4 ? R[k + 1] : x === 3 ? R[2] : R[3]);
    if (kind === 'wood') grid((x, y, c) => b.set(x, y, c), 0, 0, ['.ll..', 'lllmd'], { l: WD[5], m: WD[4], d: WD[2] });
    else if (kind === 'picket') grid((x, y, c) => b.set(x, y, c), 0, -2, ['.ww..', 'wWWw.', '.www.', 'wwwwd'], { w: WHITE[3], W: WHITE[4], d: WHITE[1] });
    else grid((x, y, c) => b.set(x, y, c), -1, -3, ['..l..', '.lml.', 'lmymd', '.ldd.', '..g..'], { l: FL.yellow[2], m: FL.yellow[1], d: FL.yellow[0], y: '#e8783a', g: LEAF[3] });
  }, { pad: 4 });
}

/** The arch over the gate (a piece of its own, standing in front of the buddy): rustic, white or roses. */
function archArt(kind, doc) {
  return keep(`arch|${kind}|${doc ? 'd' : ''}`, () => {
    const w = 40; const h = 46;
    const b = sprite(w, h, (b) => {
      const R = kind === 'picket' ? WHITE : kind === 'flower' ? WHITE : WD;
      // two posts (the gate posts' tops show on the background) and a round top
      for (const x0 of [0, w - 5]) {
        for (let y = 14; y < h; y += 1) for (let x = 0; x < 5; x += 1) {
          let c = x === 0 ? R[R.length - 2] : x === 4 ? R[1] : x === 3 ? R[2] : R[3];
          if (kind === 'picket' && (y - 14) % 6 === 5 && x > 0 && x < 4) c = R[2]; // lattice
          b.set(x0 + x, y, c);
        }
      }
      for (let x = 0; x < w; x += 1) {
        const t = (x + 0.5 - w / 2) / (w / 2);
        const top = Math.round(2 + t * t * 13);
        for (let y = top; y < top + 4; y += 1) {
          let c = y === top ? R[R.length - 1] : y === top + 3 ? R[1] : R[3];
          if (kind === 'wood' && y === top + 1 && h2(x, 2, 7) < 0.2) c = R[2];
          b.set(x, y, c);
        }
        if (kind !== 'wood' && x > 4 && x < w - 5 && x % 3 === 0) { const y = top + 4; b.set(x, y, R[2]); b.set(x, y + 1, R[1]); }
      }
      // greenery: ivy round a rustic arch, roses round the others
      const flowers = kind === 'wood' ? null : kind === 'picket' ? FL.white : FL.pink;
      for (let k = 0; k < 120; k += 1) {
        const t = k / 119;
        // up the left post, over the top, down the right post
        let x; let y;
        if (t < 0.3) { x = 2 + Math.round(Math.sin(k * 0.9) * 2.5); y = h - 2 - Math.round((t / 0.3) * (h - 18)); } else if (t < 0.7) { const u = (t - 0.3) / 0.4; x = Math.round(u * (w - 1)); const tt = (x + 0.5 - w / 2) / (w / 2); y = Math.round(2 + tt * tt * 13) + Math.round(Math.sin(k * 1.3) * 2); } else { x = w - 3 + Math.round(Math.sin(k * 0.8) * 2.5); y = 16 + Math.round(((t - 0.7) / 0.3) * (h - 22)); }
        if (kind === 'picket' && t > 0.3 && t < 0.7 && h2(k, 1, 3) < 0.5) continue;
        if (kind !== 'wood' && (t < 0.3 || t > 0.7) && y > h - 14 && h2(k, 2, 3) < 0.6) continue;
        const hh = h2(k, 3, 5);
        b.set(x, y, hh < 0.4 ? LEAF[2] : hh < 0.75 ? LEAF[3] : LEAF[4]);
        if (hh > 0.5) b.set(x + 1, y, LEAF[2]);
        if (flowers && k % 6 === 2) grid((xx, yy, c) => b.set(xx, yy, c), x - 1, y - 1, ['.l.', 'lmd', '.d.'], { l: flowers[2], m: flowers[1], d: flowers[0] });
        if (!flowers && k % 11 === 5) { b.set(x, y, LEAF[5]); }
      }
      if (kind === 'wood') {
        // a little hanging sign
        for (const x of [16, 23]) { b.set(x, 7, WD[2]); b.set(x, 8, WD[2]); }
        grid((x, y, c) => b.set(x, y, c), 13, 9, ['.wwwwwwwwww.', 'wllllllllllw', 'wlfffffffflw', 'wllllllllllw', '.dddddddddd.'], { w: WD[4], l: WD[3], f: LEAF[4], d: WD[1] });
        grid((x, y, c) => b.set(x, y, c), 16, 10, ['.r..r', 'rRr.r'], { r: FL.rose[1], R: FL.rose[2] });
      }
    }, { pad: 4 });
    const c = toCanvas(b, w / 2, h, doc);
    return c;
  });
}

function fences(px, kind, seed) {
  const k = FENCES[kind]?.name || 'wood';
  fenceSide(px, k, 1, WALL - 8, FENCE, false, seed);
  fenceSide(px, k, W - 6, WALL - 8, FENCE, true, seed + 1);
  // along the bottom, open at the gate
  const left = fenceRun(k, 144, seed); const right = fenceRun(k, 144, seed + 3);
  for (let x = 0; x < W; x += 1) if (x < 145 || x > 175) { px(x, FENCE, 'rgba(59,34,53,0.18)'); }
  left.blit(px, 0, FENCE - 15);
  right.blit(px, 176, FENCE - 15);
  gatePost(k, 0).blit(px, 143, FENCE - 20);
  gatePost(k, 1).blit(px, 172, FENCE - 20);
  // tufts at the fence's foot
  for (let x = 4; x < W - 4; x += 5) if ((x < 140 || x > 180) && h2(x, seed, 3) < 0.5) tuft(px, x, FENCE - 1, Math.floor(h2(x, 2, seed) * 6));
}

/** Lavender and little flowers along the fences' feet inside, now and then. */
function borders(px, seed) {
  const lav = (x, y) => { for (let i = -2; i <= 2; i += 1) { const hgt = 4 + ((i + 3) % 2) + (i === 0 ? 1 : 0); for (let k = 0; k < hgt; k += 1) px(x + i, y - k, k > hgt - 3 ? (k === hgt - 1 ? FL.lilac[2] : FL.lilac[1]) : G[1 + (k % 2)]); } px(x - 2, y + 1, 'rgba(42,24,56,0.2)', 5, 1); };
  for (const [x, y] of [[13, 70], [12, 124], [307, 84], [308, 158], [12, 164], [128, 166], [200, 166], [306, 64]]) lav(x, y);
  for (const [x, y, k, c] of [[18, 92, 'daisy', 'white'], [302, 108, 'forget', 'blue'], [20, 110, 'cup', 'yellow'], [116, 92, 'daisy', 'pink'], [240, 130, 'daisy', 'white'], [80, 128, 'clover'], [232, 92, 'forget', 'lilac']]) {
    for (let j = 0; j < 4; j += 1) flowerB(px, x + Math.round((h2(j, x, seed) - 0.5) * 8), y + Math.round((h2(j, y, seed) - 0.5) * 5), k, c);
  }
}

// ---------- the whole yard ----------

const yardKept = new Map();

/**
 * Paints the garden into canvas (YARD.W x YARD.H). o: { layout: gardenLayout(kid), color: the
 * back door's paint (the kid's color; optional) }. Paints the ground, the back of the house
 * and its door, the fence (layout.fence.art) and gate posts, the path (layout.path.art, or a
 * worn dirt path), the raised beds and tree spots (empty), and the pond if layout.water is
 * the pond. Returns { pieces, blocks }: pieces stand out of the ground and go in front of or
 * behind the buddy like house.js pieces ([{ id, x, y, w, h, foot, canvas }]: the arch over the
 * gate); blocks is yardBlocks(layout).
 */
export function paintYard(canvas, o = {}) {
  const lay = o.layout || {};
  const fenceArt = lay.fence?.art || 'fence-wood';
  const pathArt = lay.path?.art || null;
  const waterArt = lay.water?.art || null;
  const color = o.color || '#5aa0c8';
  const key = `${fenceArt}|${pathArt}|${waterArt}|${color}`;
  canvas.width = W; canvas.height = H;
  let img = yardKept.get(key);
  if (!img) {
    img = pixelBuffer(W, H);
    const { px } = img;
    const seed = 4242;
    grassB(px, W, H, seed, { flowers: 0.45 });
    if (pathArt === 'path-stones') stonePath(px, seed + 1);
    else if (pathArt === 'path-brick') brickPath(px, seed + 1);
    else dirtPath(px, seed + 1);
    YARD.trees.forEach((t, i) => treeSpot(px, t.x, t.y, seed + 20 + i));
    borders(px, seed + 3);
    if (waterArt === 'pond') pondArt(px);
    BEDS.forEach((b, i) => bedFrame(px, b, seed + 30 + i));
    houseBack(px, color, 17);
    fences(px, fenceArt, seed + 9);
    if (yardKept.size > 12) yardKept.clear();
    yardKept.set(key, img);
  }
  img.put(canvas.getContext('2d'));
  const arch = archArt(FENCES[fenceArt]?.name || 'wood', canvas.ownerDocument);
  const pieces = [{ id: 'arch', x: 160 - arch.ax, y: FENCE + 1 - arch.ay, w: arch.width, h: arch.height, foot: FENCE + 1, canvas: arch }];
  return { pieces, blocks: yardBlocks(lay) };
}

// ---------- plants ----------
// A bed's plants are one sprite PW wide that fills the bed's soil: its anchor is the middle of
// the soil's front edge (YARD.beds[i].foot). Plants stand in rows at a depth d into the bed
// (0 at the front, up to 14 at the back): their feet are at y = gy(d) in the sprite.

const PW = 48; const PH = 50;
const gy = (d) => PH - 1 - d;
const SUN = ['#9a4a1e', '#cc7a1e', '#eea628', '#ffcc3a', '#ffe47a', '#fff6c0'];
const DISK = ['#2e1a24', '#4a2a26', '#6a3e28', '#8a5a2e', '#a8783a'];
const CARROT = ['#9a3a1e', '#d0602a', '#f08a3a', '#ffb868', '#ffd8a0'];
const TOMATO = ['#7a1a2a', '#b82a36', '#e04844', '#ff7a66', '#ffc2b0'];
const GREENFRUIT = ['#4a7a3a', '#6a9a3e', '#94bc4e', '#c0dc78', '#e8f4b0'];
const PUMP = ['#7a2e1c', '#a8481e', '#d0661e', '#ee8a2a', '#ffae4a', '#ffd488'];
const TUL = [FL.rose, FL.yellow, FL.pink, FL.orange, FL.lilac];
const lit4 = (P) => [P[0], P[1], P[2], mix(P[2], '#ffffff', 0.5)];

/** A leaf from (x, y) pointing along angle a (0 right, -PI/2 up): a pointed oval, lit on its upper side, with a vein. */
function leaf(b, x, y, a, len, wid, P = LEAF, tag) {
  const ca = Math.cos(a); const sa = Math.sin(a);
  const cx = x + ca * len / 2; const cy = y + sa * len / 2;
  const R = Math.ceil(Math.max(len, wid)) + 1;
  for (let yy = Math.floor(cy - R); yy <= cy + R; yy += 1) {
    for (let xx = Math.floor(cx - R); xx <= cx + R; xx += 1) {
      const dx = xx + 0.5 - cx; const dy = yy + 0.5 - cy;
      const u = (dx * ca + dy * sa) / (len / 2); const v = (-dx * sa + dy * ca) / (wid / 2);
      const vv = v / (1 - Math.max(0, u) * 0.35); // a bit pointed at the tip
      if (u * u + vv * vv > 1) continue;
      const up = (-dx * sa + dy * ca) * (ca >= 0 ? 1 : -1) < 0; // the side facing up
      let c = up ? P[3] : P[2];
      if (Math.abs(v) < 0.28 && u > -0.75 && u < 0.7) c = up ? P[4] : P[3];
      if (u > 0.55 && !up) c = P[2];
      b.set(xx, yy, c, tag);
    }
  }
}

/** A stem from (x, y0) up to (x + lean, y1), bending; 1 or 2 wide. Thin stems are 'soft' (no outline). */
function stem(b, x, y0, y1, lean = 0, wide = 1, P = LEAF, curve = 1) {
  const n = y0 - y1;
  let last = x;
  for (let i = 0; i <= n; i += 1) {
    const t = i / Math.max(1, n);
    const xx = Math.round(x + lean * t ** (1 + curve));
    const y = y0 - i;
    if (wide > 1) { b.set(xx, y, P[3]); b.set(xx + 1, y, P[1]); } else b.set(xx, y, P[2], 'soft');
    if (Math.abs(xx - last) > 1) b.set(Math.round((xx + last) / 2), y, wide > 1 ? P[2] : P[2], wide > 1 ? undefined : 'soft');
    last = xx;
  }
  return last;
}

/** Little mounds of raked soil where the seeds went in, and a label stick with the packet's color. */
function seedMounds(b, spots, tagColor) {
  for (const [x, d] of spots) {
    const y = gy(d);
    grid((xx, yy, c) => b.set(xx, yy, c, 'soft'), x - 3, y - 1, ['.llll.', 'mmmmmd'], { l: SOIL[5], m: SOIL[4], d: SOIL[3] });
    b.set(x, y - 1, '#f4e4b8', 'soft'); b.set(x + 1, y - 1, '#c8a878', 'soft');
  }
  label(b, tagColor);
}
function label(b, c) {
  const C = ramp(c, 1, 1);
  for (let y = gy(1) - 7; y <= gy(1); y += 1) b.set(2, y, y < gy(1) - 4 ? WD[4] : WD[3]);
  grid((x, y, cc) => b.set(x, y, cc), 0, gy(1) - 11, ['wwwww', 'wcCcw', 'wcccw', 'wwwwd'], { w: '#fff8e8', d: '#d8c8a8', c: C[1], C: C[2] });
}

/** A seedling: two round seed leaves on a little stem (or a pointed one for bulbs). */
function sprout(b, x, d, kind = 'round', droopy = false) {
  const y = gy(d);
  const L = { L: LEAF[4], l: LEAF[3], s: LEAF[2] };
  const set = (xx, yy, c) => b.set(xx, yy, c, c === LEAF[2] ? 'soft' : undefined);
  if (kind === 'blade') grid(set, x - 1, y - 5, droopy ? ['....', '.Ll.', 'l.s.', '..s.', '.ss.'] : ['.L.', '.Ll', 'Ll.', '.s.', 'ss.'], L);
  else if (kind === 'tiny') grid(set, x - 1, y - 3, droopy ? ['...', 'l.l', '.s.'] : ['l.L', '.s.', '.s.'], L);
  else grid(set, x - 2, y - 5, droopy ? ['.....', '.....', 'll.lL', 'l.s.l', '..s..'] : ['LL.LL', 'lLsLl', '..s..', '..s..', '..s..'], L);
}

// --- flowers ---

/** A sunflower's head: petals round a seedy brown middle, lit from the top left. */
function sunHead(b, cx, cy, r) {
  const R = Math.ceil(r) + 2;
  for (let y = Math.floor(cy - R); y <= cy + R; y += 1) {
    for (let x = Math.floor(cx - R); x <= cx + R; x += 1) {
      const dx = x + 0.5 - cx; const dy = (y + 0.5 - cy) / 0.92;
      const d = Math.hypot(dx, dy); const a = Math.atan2(dy, dx);
      const petal = Math.abs(Math.cos(a * 6 + 0.3));
      const rp = r * (0.8 + 0.2 * petal);
      if (d > rp) continue;
      const lit = -(dx * 0.6 + dy * 0.8) / r;
      const disk = r * 0.48;
      let c;
      if (d < disk) {
        const k = d > disk - 1 ? 1 : (x + y) % 2 === 0 && d < disk - 1.2 ? 1 : 2;
        c = DISK[Math.max(0, Math.min(4, k + (lit > 0.25 ? 1 : 0) + (lit > 0.5 && (x + y) % 2 ? 1 : 0)))];
      } else {
        let k = 3 + (lit > 0.3 ? 1 : 0) - (lit < -0.35 ? 1 : 0);
        if (petal > 0.85 && d > disk + 1) k += 1;
        if (d < disk + 1.1) k -= 1;
        if (petal < 0.3) k -= 1;
        c = SUN[Math.max(0, Math.min(5, k))];
      }
      b.set(x, y, c, 'head');
    }
  }
}

/** A sunflower head turned down (droopy): the green back and petals hanging round it. */
function sunHeadDown(b, cx, cy) {
  grid((x, y, c) => b.set(x, y, c, 'head'), cx - 4, cy - 2, [
    '..gggg...',
    '.gGGggg..',
    'yggggggdy',
    'yYggggdy.',
    '.yYdddy..',
    '..yYyYy..',
    '...y.y...',
  ], { g: LEAF[2], G: LEAF[3], d: LEAF[1], y: SUN[3], Y: SUN[4] });
}

function sunflowers(b, stage, droopy) {
  const plants = [[10, 10, 36], [25, 4, 30], [38, 11, 39]];
  if (stage === 0) return seedMounds(b, plants, SUN[3]);
  if (stage === 1) { plants.forEach(([x, d]) => sprout(b, x, d, 'round', droopy)); label(b, SUN[3]); return; }
  plants.forEach(([x, d, hgt], i) => {
    const h = stage === 2 ? Math.round(hgt * 0.62) : hgt;
    const y0 = gy(d); const y1 = y0 - h;
    const lean = droopy ? 0 : (i - 1);
    const top = stem(b, x, y0, y1 + 3, lean, 2);
    // big leaves up the stem
    for (let k = 0, y = y0 - 5; y > y1 + 8; y -= 6, k += 1) {
      const side = (k + i) % 2 ? 1 : -1; const xx = x + Math.round(lean * ((y0 - y) / h) ** 2) + (side > 0 ? 2 : -1);
      const a = droopy ? (side > 0 ? 0.9 : Math.PI - 0.9) : (side > 0 ? -0.35 : Math.PI + 0.35);
      leaf(b, xx, y, a, stage === 2 ? 5 : 7, stage === 2 ? 3.4 : 4.6);
    }
    if (stage === 2) {
      // a green bud, petal tips just showing
      grid((xx, yy, c) => b.set(xx, yy, c, 'head'), top - 2 + (droopy ? 2 : 0), y1 + (droopy ? 2 : -1), droopy ? ['..gg.', '.gGgy', 'ggggy', '.ggy.'] : ['.y.y.', 'ygGgy', 'gGggd', '.gdd.'], { g: LEAF[3], G: LEAF[4], d: LEAF[2], y: SUN[3] });
    } else if (droopy) {
      // the top of the stem bends over, the head hangs
      b.set(top + 1, y1 + 2, LEAF[3]); b.set(top + 2, y1 + 2, LEAF[2]); b.set(top + 3, y1 + 3, LEAF[2]);
      sunHeadDown(b, top + 4, y1 + 7);
    } else sunHead(b, top + 0.5 + lean * 0.5, y1, 6.2 - (i === 1 ? 0.8 : 0));
  });
}

/** A tulip cup, 5 wide: three petal tips, lit on the left. */
function tulipCup(b, x, y, P, tilt) {
  const [d, m, l] = P; const L = mix(l, '#ffffff', 0.45);
  const pal = { L, l, m, d, k: mix(d, INK, 0.25) };
  const set = (xx, yy, c) => b.set(xx, yy, c, 'head');
  if (tilt) grid(set, x - 2, y, tilt > 0 ? ['..lm.', '.Llmd', 'Llmd.', '.ld..'] : ['.ml..', 'dmlL.', '.dmlL', '..dl.'], pal);
  else grid(set, x - 2, y, ['L.m.d', 'LLlmd', 'lLlmd', '.lmk.'], pal);
}

function tulips(b, stage, droopy) {
  const plants = [[7, 11, 14, 0], [18, 12, 16, 1], [30, 11, 15, 2], [41, 12, 14, 3], [12, 4, 13, 2], [24, 3, 15, 0], [36, 4, 13, 1]];
  if (stage === 0) return seedMounds(b, plants.slice(0, 5), FL.pink[1]);
  if (stage === 1) { plants.forEach(([x, d]) => sprout(b, x, d, 'blade', droopy)); label(b, FL.pink[1]); return; }
  plants.forEach(([x, d, hgt, ci], i) => {
    const y0 = gy(d); const h = stage === 2 ? Math.round(hgt * 0.7) : hgt;
    const tilt = droopy ? (i % 2 ? 1 : -1) : 0;
    // strap leaves at the foot
    for (const s of [-1, 1]) {
      const n = droopy ? 4 : 6;
      for (let k = 0; k < n; k += 1) {
        const xx = x + s * Math.round(k * (droopy ? 0.7 : 0.35)); const yy = y0 - Math.round(k * (droopy ? 0.6 : 1));
        b.set(xx, yy, k > n - 2 ? LEAF[4] : LEAF[3]); b.set(xx + s, yy, LEAF[2]);
      }
    }
    const top = stem(b, x, y0 - 1, y0 - h + 4, droopy ? tilt * 3 : 0, 1);
    if (stage === 2) grid((xx, yy, c) => b.set(xx, yy, c, 'head'), top - 1, y0 - h + 1 + (droopy ? 1 : 0), ['.g.', 'gcg', 'gcd', '.d.'], { g: LEAF[3], d: LEAF[2], c: TUL[ci][1] });
    else tulipCup(b, top + tilt, y0 - h + (droopy ? 2 : 0), TUL[ci], tilt);
  });
}

/** A daisy head: white petals round a yellow eye (5 x 3 seen from above, or 3 x 3 small). */
function daisy(b, x, y, big, pink, droopy) {
  const W2 = pink ? FL.pink : FL.white;
  const pal = { w: W2[2], v: W2[1], d: W2[0], y: '#ffcf3a', o: '#e09a20' };
  const set = (xx, yy, c) => b.set(xx, yy, c, 'head');
  if (droopy) grid(set, x - 1, y, big ? ['.wv.', 'wyov', '.vd.'] : ['wv', 'yv'], pal);
  else if (big) grid(set, x - 2, y - 1, ['.w.v.', 'wwyvv', '.vov.', '..d..'], pal);
  else grid(set, x - 1, y - 1, ['.w.', 'wyv', '.d.'], pal);
}

function daisies(b, stage, droopy) {
  const clumps = [[11, 7, 10.5], [25, 10, 10], [38, 6, 10.5]];
  if (stage === 0) return seedMounds(b, [[9, 8], [19, 3], [27, 10], [37, 5]], '#ffffff');
  if (stage === 1) { [[8, 9], [15, 3], [22, 11], [29, 5], [36, 10], [41, 3]].forEach(([x, d]) => sprout(b, x, d, 'tiny', droopy)); label(b, '#f6f2fa'); return; }
  const tall = (stage === 2 ? 6 : 9) * (droopy ? 0.75 : 1);
  // bushy clumps of small leaves
  const DL = ['#1e4038', '#2a5e42', '#3a7e48', '#54a04e', '#7cc05a', '#acdc78', '#dcf2a0'];
  for (const [cx, d, rx] of clumps) crown(b, cx, gy(d) - tall * 0.55, rx * 0.95, tall * 0.85, DL, cx, { floor: gy(d) + 1, sag: droopy ? 1 : 0 });
  // flower heads on top
  const heads = [[4, 9, 0], [9, 14, 1], [15, 11, 0], [7, 5, 1], [19, 16, 0], [24, 19, 1], [30, 16, 0], [22, 10, 0], [34, 12, 1], [38, 15, 0], [43, 9, 1], [40, 5, 0], [27, 8, 1], [14, 4, 0], [33, 4, 1]];
  heads.forEach(([x, up, big], i) => {
    const y = gy(0) - Math.round(up * (stage === 2 ? 0.62 : droopy ? 0.72 : 1));
    if (stage === 2) { if (i % 2 === 0) { b.set(x, y, LEAF[4], 'head'); b.set(x + 1, y, LEAF[3], 'head'); b.set(x, y - 1, '#ffffff', 'head'); } return; }
    daisy(b, x, y, big, i % 5 === 3, droopy);
  });
}

// --- vegetables ---

/** A carrot's feathery top: a tuft of fine fronds (no outline, so it stays airy). */
const CARROT_TOPS = {
  2: [['.T.T.', 'l.L.l', '.lLl.', '..s..'], ['.......', '.T.l.T.', 'lL.s.Ll', '...s...']],
  3: [['.T...T.', 'l.T.T.l', '.lLlLl.', 'L.lLl.L', '.l.s.l.', '...s...'], ['.........', '..T.l.T..', 'TlL.l.LlT', '.l.lsl.l.', '....s....']],
  4: [['..T...T..', '.l.T.T.l.', 'T.lL.Ll.T', '.lLlLlLl.', 'l.lLsLl.l', '.l.lsl.l.', '...lsl...', '....s....'], ['...........', '...T.l.T...', '.TlL.L.LlT.', 'L.lLlslLl.L', '.l..lsl..l.', '.....s.....']],
};
function carrotTop(b, x, y, stage, droopy) {
  const rows = CARROT_TOPS[stage][droopy ? 1 : 0];
  grid((xx, yy, c) => b.set(xx, yy, c, 'soft'), x - Math.floor(rows[0].length / 2), y - rows.length + 1, rows, { T: LEAF[5], L: LEAF[4], l: LEAF[3], s: LEAF[2] });
}

function carrots(b, stage, droopy) {
  const plants = [];
  for (let i = 0; i < 5; i += 1) plants.push([6 + i * 9, 10 + (i % 2)]);
  for (let i = 0; i < 5; i += 1) plants.push([10.5 + i * 9, 2 + (i % 2)]);
  if (stage === 0) {
    // two raked furrows with seed mounds along them
    for (const d of [10, 3]) for (let x = 2; x < PW - 2; x += 1) { b.set(x, gy(d) - 1, SOIL[4]); b.set(x, gy(d), x % 4 === 1 ? SOIL[5] : SOIL[2]); }
    label(b, CARROT[2]);
    return;
  }
  plants.forEach(([fx, d]) => {
    const x = Math.round(fx); const y = gy(d);
    if (stage === 1) { sprout(b, x, d, 'tiny', droopy); return; }
    if (stage === 4) grid((xx, yy, c) => b.set(xx, yy, c, 'root'), x - 2, y - 2, ['.oOo.', 'oOooq', 'ooqqq'], { o: CARROT[2], O: CARROT[4], q: CARROT[1] });
    carrotTop(b, x, y - (stage === 4 ? 3 : 1), stage, droopy);
  });
  if (stage <= 2) label(b, CARROT[2]);
}

/** A tomato: round, red (or green while growing), a shine top left and a little green star on top. */
function tomato(b, x, y, P, big) {
  const set = (xx, yy, c) => b.set(xx, yy, c, 'fruit');
  if (big) grid(set, x - 2, y - 2, ['.gsg.', 'rLrrr', 'rrrrd', '.rdd.'], { g: LEAF[2], s: LEAF[4], r: P[2], L: P[4], d: P[1] });
  else grid(set, x - 1, y - 1, ['rg.', 'Lrr', 'rrd'], { g: LEAF[3], r: P[2], L: P[4], d: P[1] });
}

/** A wire cage: three rings and four uprights. part: 'back' (behind the plant) or 'front'. */
function cage(b, x, y0, h, part) {
  const rx = 6.5;
  for (const hy of [Math.round(h * 0.25), Math.round(h * 0.58), h]) {
    const y = y0 - hy;
    for (let i = 0; i < 40; i += 1) {
      const a = (i / 40) * Math.PI * 2; const front = Math.sin(a) > 0;
      if ((part === 'front') !== front) continue;
      const xx = Math.round(x + Math.cos(a) * rx); const yy = Math.round(y + Math.sin(a) * 1.6);
      if (front && (i % 5 === 2 || h2(i, hy, 3) < 0.3)) continue; // leaves hide bits of it
      b.set(xx, yy, front ? (Math.cos(a) < 0 ? METAL[3] : METAL[2]) : METAL[1], 'soft');
    }
  }
  const ups = part === 'front' ? [-4, 4] : [-6, 6];
  for (const dx of ups) for (let yy = y0; yy >= y0 - h; yy -= 1) if (part === 'back' || yy % 5 !== 0) b.set(x + dx, yy + (part === 'front' ? 1 : 0), part === 'front' ? (dx < 0 ? METAL[3] : METAL[2]) : METAL[1], 'soft');
}

/** A tomato plant's leafy body inside its cage. */
function tomatoBush(b, x, y0, h, rx, droopy, seed) {
  const blobs = [];
  for (let k = 0; k < 9; k += 1) {
    const t = k / 8;
    blobs.push([x + (k % 2 ? 1 : -1) * rx * (0.3 + 0.3 * Math.abs(Math.sin(k * 2.1 + seed))), y0 - 3 - t * (h - 4) + (droopy ? 2 + t * 2 : 0), 2.8 + (1 - t) * 1.4]);
  }
  for (let y = y0 - h - 3; y <= y0; y += 1) {
    for (let xx = x - rx - 3; xx <= x + rx + 3; xx += 1) {
      let best = null;
      for (const [bx, by, r] of blobs) { const d = Math.hypot(xx + 0.5 - bx, (y + 0.5 - by) * 1.1); if (d < r && (!best || by > best[1])) best = [bx, by, r, d]; }
      if (!best) continue;
      const [bx, by, r] = best;
      const lit = -((xx + 0.5 - bx) * 0.6 + (y + 0.5 - by) * 0.8) / r;
      let k = lit > 0.35 ? 4 : lit > -0.1 ? 3 : 2;
      if (lit > 0.1 && vnoise(xx, y, 1.6, seed) > 0.62) k = 4;
      if (bayer(xx, y) < 0.25 && k === 3 && lit < 0) k = 2;
      b.set(xx, y, LEAF[k]);
    }
  }
  if (droopy) for (let i = 0; i < 6; i += 1) { const xx = Math.round(x - rx + i * (rx * 2) / 5); const yy = y0 - Math.round(h * 0.45) + (i % 3); b.set(xx, yy + 1, LEAF[2]); b.set(xx, yy + 2, LEAF[3]); }
}

function tomatoes(b, stage, droopy) {
  const plants = [[13, 7], [35, 7]];
  if (stage === 0) return seedMounds(b, plants, TOMATO[2]);
  if (stage === 1) { plants.forEach(([x, d]) => { sprout(b, x - 2, d + 2, 'round', droopy); sprout(b, x + 3, d - 2, 'round', droopy); }); label(b, TOMATO[2]); return; }
  const H2 = [0, 0, 11, 23, 26][stage]; const RX = [0, 0, 4.5, 7.5, 8.2][stage];
  plants.forEach(([x, d], i) => {
    const y0 = gy(d); const ch = stage === 2 ? 14 : 24;
    cage(b, x, y0, ch, 'back');
    stem(b, x, y0, y0 - 3, 0, 2);
    tomatoBush(b, x, y0, H2, RX, droopy, i * 3 + stage);
    if (stage === 3) {
      [[x - 3, y0 - 9], [x + 2, y0 - 14], [x - 1, y0 - 18]].forEach(([fx, fy]) => tomato(b, fx, fy + (droopy ? 2 : 0), GREENFRUIT, false));
      [[x + 3, y0 - 8], [x - 3, y0 - 15], [x + 1, y0 - 21]].forEach(([fx, fy]) => { b.set(fx, fy, GOLD[4], 'fruit'); b.set(fx + 1, fy, GOLD[3], 'fruit'); b.set(fx, fy + 1, GOLD[2], 'fruit'); });
    }
    cage(b, x, y0, ch, 'front');
    if (stage === 4) [[x - 4, y0 - 6, 1], [x + 4, y0 - 10, 1], [x - 2, y0 - 15, 1], [x + 3, y0 - 19, 0], [x - 5, y0 - 21, 0], [x + 1, y0 - 4, 0], [x + 6, y0 - 15, 0]].forEach(([fx, fy, big]) => tomato(b, fx, fy + (droopy ? 2 : 0), TOMATO, big));
  });
}

/** A pumpkin: fat, ribbed, lit from the top left, with a curly stalk. */
function pumpkin(b, cx, by, rx, ry, P = PUMP) {
  const cy = by - ry;
  const R = Math.ceil(Math.max(rx, ry)) + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y += 1) {
    for (let x = Math.floor(cx - R); x <= cx + R; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry;
      if (dx * dx + dy * dy > 1 - 0.06 * Math.abs(Math.sin(dx * 7.5)) ** 2 * (1 - dy * dy)) continue;
      // ribs: bands across that follow the round body
      const u = Math.asin(Math.max(-1, Math.min(1, dx / Math.sqrt(Math.max(0.05, 1 - dy * dy))))) / (Math.PI / 2); // -1..1 round the body
      const rib = (u * 2.5 + 2.5) % 1; // 0..1 inside each rib
      let s = -(dx * 0.55 + dy * 0.75) * 0.9 + (0.5 - Math.abs(rib - 0.45)) * 1.1;
      s += (bayer(x, y) - 0.5) * 0.3;
      let k = s > 0.55 ? 5 : s > 0.25 ? 4 : s > -0.08 ? 3 : s > -0.45 ? 2 : 1;
      if (rib < 0.1 || rib > 0.92) k = Math.min(k, 2);
      if (dy > 0.72) k = Math.min(k, 2);
      b.set(x, y, P[Math.max(0, Math.min(5, k))], 'fruit');
    }
  }
  // the stalk
  grid((x, y, c) => b.set(x, y, c, 'fruit'), Math.round(cx) - 1, Math.round(cy - ry) - 3, ['.sS', 'sS.', 'ss.'], { s: '#6a7a3a', S: '#a8b860' });
}

/** A big round pumpkin leaf, lobed, with pale veins. */
function pumpLeaf(b, cx, cy, r, droopy) {
  const R = Math.ceil(r) + 1;
  for (let y = Math.floor(cy - R); y <= cy + R; y += 1) {
    for (let x = Math.floor(cx - R); x <= cx + R; x += 1) {
      const dx = x + 0.5 - cx; const dy = (y + 0.5 - cy) * (droopy ? 1.5 : 1.15);
      const a = Math.atan2(dy, dx); const d = Math.hypot(dx, dy);
      if (d > r * (0.86 + 0.14 * Math.abs(Math.cos(a * 2.5)))) continue;
      const lit = -(dx * 0.6 + dy * 0.8) / r;
      let k = lit > 0.45 ? 4 : lit > -0.25 ? 3 : 2;
      if (d > r * 0.75 && lit < 0) k = Math.min(k, 2);
      const vein = [-0.9, -2.2, -1.57].some((va) => Math.abs(Math.sin(a - va)) * d < 0.5 && Math.cos(a - va) > 0) && d > 0.8 && d < r * 0.8;
      if (vein) k = Math.min(5, k + 1);
      if (droopy && d > r * 0.7 && dy > 0) k = 2;
      b.set(x, y, LEAF[k]);
    }
  }
}

function pumpkins(b, stage, droopy) {
  if (stage === 0) return seedMounds(b, [[24, 7]], PUMP[3]);
  if (stage === 1) { sprout(b, 21, 8, 'round', droopy); sprout(b, 28, 5, 'round', droopy); label(b, PUMP[3]); return; }
  // a vine wandering across the soil with tendrils
  const vineY = (x) => gy(6) + Math.round(Math.sin(x / 5) * 2.2);
  const span = stage === 2 ? [12, 36] : [2, 46];
  for (let x = span[0]; x < span[1]; x += 1) { b.set(x, vineY(x), LEAF[2]); if (x % 7 === 3) { b.set(x, vineY(x) - 1, LEAF[3]); b.set(x + 1, vineY(x) - 2, LEAF[4]); b.set(x + 2, vineY(x) - 2, LEAF[3]); } }
  const leaves = stage === 2 ? [[18, 9, 4.2], [30, 8, 4.6], [24, 4, 3.6]] : [[7, 10, 5], [17, 12, 5.4], [40, 11, 5.2], [31, 13, 4.6], [44, 4, 4], [5, 3, 4]];
  for (const [x, d, r] of leaves) {
    const y = gy(d) - Math.round(r * (droopy ? 0.5 : 0.85));
    stem(b, x, gy(d) - 1, y + 1, 0, 1);
    pumpLeaf(b, x, y, r, droopy);
  }
  if (stage === 3) {
    pumpkin(b, 22, gy(3), 4, 3, ['#5a6a2e', '#7a8a34', '#9aac44', '#bccc5c', '#dce884', '#f0f6b4']);
    // a yellow trumpet flower
    grid((x, y, c) => b.set(x, y, c, 'fruit'), 31, gy(5) - 7, ['y.y.y', 'yYYYy', '.yoy.', '..g..'], { y: GOLD[3], Y: GOLD[5], o: GOLD[2], g: LEAF[3] });
  }
  if (stage === 4) {
    pumpkin(b, 24, gy(0) + 2, 11.5, 8);
    // a small one tucked behind
    pumpkin(b, 39, gy(9), 4.5, 3.5);
  }
}

const BED_DRAW = {
  'seed-sunflower': sunflowers, 'seed-tulip': tulips, 'seed-daisy': daisies,
  'seed-carrot': carrots, 'seed-tomato': tomatoes, 'seed-pumpkin': pumpkins,
};

function bedPlant(seedId, stage, droopy) {
  const b = sprite(PW, PH, (bb) => {
    BED_DRAW[seedId](bb, stage, droopy);
    if (droopy) bb.map((c) => dull(c));
  }, { ground: false, pad: 4 });
  // nothing below the soil's front edge (that's the bed's front plank), but a fat pumpkin's belly
  const below = seedId === 'seed-pumpkin' && stage >= 4 ? 3 : 0;
  b.each((x, y) => { if (y >= PH + below) b.del(x, y); });
  return toCanvas(b, PW / 2, PH);
}

// --- trees ---

const TREE_LOOK = {
  'seed-apple': { leaf: ['#1e4038', '#2a5e42', '#3a7e48', '#54a04e', '#7cc05a', '#acdc78', '#dcf2a0'], shape: [1.05, 0.95], fruit: 'apple' },
  'seed-cherry': { leaf: ['#22443e', '#2e6446', '#40844c', '#5aa452', '#84c45e', '#b4dc80', '#e2f4a8'], shape: [1.12, 0.88], fruit: 'cherry' },
  'seed-orange': { leaf: ['#173a38', '#1e5440', '#2a7246', '#3e904c', '#62b056', '#98d06a', '#d0ec96'], shape: [0.95, 1.05], fruit: 'orange' },
};
const BLOSSOM = ['#7a3658', '#a84e78', '#d26c98', '#ec92b4', '#f8b8cc', '#ffdce6', '#fff4f6'];
const FRUIT_ART = {
  apple: [['..sL.', 'rR.rr', 'rRrrd', 'rrrrd', '.ddd.'], { s: BARK[1], L: '#7cc05a', R: '#ffb0a0', r: '#e8343c', d: '#a01e32' }],
  cherry: [['...sL..', '..s.s..', '.s...s.', 'RRr.Rrr', 'rrd.rrd', '.d...d.'], { s: '#5a6a2a', L: '#7cc05a', R: '#ff8a98', r: '#d01e3e', d: '#7a0e2a' }],
  orange: [['..Ll.', '.OOo.', 'oOooq', 'ooooq', '.qqq.'], { l: '#2a7246', L: '#62b056', O: '#ffd890', o: '#f8a030', q: '#c8641e' }],
};
// where fruit hangs on a grown crown, as fractions of its size (most visible first)
const FRUIT_AT = [[-0.46, 0.38], [0.34, 0.2], [-0.02, 0.62], [-0.2, -0.22], [0.6, 0.55]];

/**
 * A round crown of leaves: overlapping puffs, the lower ones in front, each lit from the top
 * left with a leafy speckle, the whole crown darker toward its bottom right. P: 7 shades.
 * o: { sag (droopy: puffs slump down), mixP / mixAmt (some puffs in a second ramp), floor (no
 * leaves below this y) }. Returns inside(x, y).
 */
function crown(b, cx, cy, rx, ry, P, seed, o = {}) {
  const rnd = rng(seed);
  const pr = Math.max(2.6, Math.min(rx, ry) * 0.46);
  const puffs = [];
  for (let y = cy - ry + pr * 0.85; y <= cy + ry - pr * 0.7; y += pr * 0.92) {
    const span = Math.max(0, rx * Math.sqrt(Math.max(0, 1 - ((y - cy) / ry) ** 2)) - pr * 0.75);
    const n = Math.max(1, Math.round((span * 2) / (pr * 1.15)) + 1);
    for (let i = 0; i < n; i += 1) {
      const x = n === 1 ? cx : cx - span + (2 * span * i) / (n - 1);
      puffs.push([x + (rnd() - 0.5) * pr * 0.5, y + (rnd() - 0.5) * pr * 0.35, pr * (0.88 + rnd() * 0.3), puffs.length]);
    }
  }
  const sag = o.sag || 0;
  if (sag) puffs.forEach((p) => { p[1] += sag * (0.4 + (p[1] - (cy - ry)) / (2 * ry)); p[2] *= 0.96; });
  puffs.sort((p, q) => p[1] - q[1]);
  const front = (x, y) => { for (let i = puffs.length - 1; i >= 0; i -= 1) { const [px, py, r] = puffs[i]; const dx = x + 0.5 - px; const dy = (y + 0.5 - py) * 1.08; if (dx * dx + dy * dy < r * r) return puffs[i]; } return null; };
  const inside = (x, y) => !!front(x, y) && (o.floor === undefined || y < o.floor);
  const L = P.length - 1;
  for (let y = Math.floor(cy - ry - pr); y <= cy + ry + sag + pr; y += 1) {
    for (let x = Math.floor(cx - rx - pr); x <= cx + rx + pr; x += 1) {
      if (!inside(x, y)) continue;
      const [px, py, r, id] = front(x, y);
      const dx = (x + 0.5 - px) / r; const dy = (y + 0.5 - py) / r;
      const d = Math.hypot(dx, dy);
      const local = -(0.55 * dx + 0.8 * dy);
      const glob = -(0.5 * (x + 0.5 - cx) / rx + 0.75 * (y + 0.5 - cy) / ry);
      let s = 0.5 + local * 0.3 + glob * 0.26;
      if (d > 0.78 && local < 0) s -= 0.16; // the shaded rim of each puff
      if (d > 0.8 && local > 0.3) s += 0.08;
      s += (vnoise(x, y, 1.6, seed) - 0.5) * 0.3;
      const k = Math.max(1, Math.min(L, Math.round(s * L + (bayer(x, y) - 0.5) * 0.9)));
      const R2 = o.mixP && h2(id, 3, seed) < o.mixAmt ? o.mixP : P;
      b.set(x, y, R2[k], 'crown');
    }
  }
  // drooping leaves hanging off the bottom edge
  if (sag) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 3) {
      let y = Math.floor(cy + ry + sag + pr);
      while (y > cy && !inside(x, y)) y -= 1;
      if (y <= cy) continue;
      const n = 1 + Math.floor(h2(x, 1, seed) * 3);
      for (let k = 1; k <= n; k += 1) b.set(x, y + k, P[k === n ? 3 : 2], 'crown');
    }
  }
  return inside;
}

/** A trunk from the foot (x, y) up to height h, w wide, lit on the left, with roots and branches. */
function trunk(b, x, y, h, w, fork) {
  for (let i = 0; i < h; i += 1) {
    const yy = y - 1 - i;
    const flare = i < 2 && w >= 3 ? 2 - i : 0;
    const lean = Math.round(Math.sin(i / 9) * (w >= 3 ? 1 : 0.6));
    for (let xx = -flare; xx < w + flare; xx += 1) {
      const u = (xx + 0.5) / w;
      let c = u < 0.3 ? BARK[4] : u < 0.7 ? BARK[3] : BARK[2];
      if (xx < 0) c = BARK[3]; if (xx >= w) c = BARK[1];
      if (w >= 3 && h2(xx, yy >> 1, 3) < 0.12) c = BARK[1]; // bark grooves
      b.set(x - Math.floor(w / 2) + xx + lean, yy, c);
    }
  }
  // branches up into the crown
  if (w >= 2) {
    for (const s of [-1, 1]) {
      const n = Math.max(3, Math.round(h * 0.35));
      for (let i = 0; i < n; i += 1) {
        const bx = x + s * Math.round(1 + i * 0.9); const by = y - fork - i;
        b.set(bx, by, i < 2 ? BARK[4] : BARK[3]); if (w >= 4) b.set(bx + s, by, BARK[2]);
      }
    }
  }
}

function treeArt(seedId, stage, droopy, fruit) {
  const T = TREE_LOOK[seedId];
  const size = [null, [7, 5.5, 20], [11, 9, 29], [16, 13, 38], [22, 17, 48], [28, 21, 55]][stage];
  const w = 64; const h = 84;
  const fx = w / 2; const fy = h - 1;
  const b = sprite(w, h, (bb) => {
    // a soft shadow under the crown
    const sw = size ? size[0] * 0.8 : 5;
    for (let y = fy - 2; y <= fy + 2; y += 1) for (let x = Math.floor(fx - sw - 2); x <= fx + sw + 3; x += 1) if (inEll(x, y, fx + 2, fy + 0.5, sw + 1, 2.4)) bb.set(x, y, 'rgba(42,24,56,0.18)', 'soft');
    const stake = stage <= 2;
    if (stake) {
      const sh = [15, 19, 22][stage];
      for (let y = fy - sh; y <= fy; y += 1) { bb.set(fx - 4, y, y === fy - sh ? WD[5] : WD[4]); bb.set(fx - 3, y, WD[2]); }
    }
    if (stage === 0) {
      // a whip of a sapling with a few leaves at its tip, tied to the stake
      const top = fy - 17;
      for (let y = fy; y > top; y -= 1) bb.set(fx + (y < fy - 10 ? 1 : 0), y, BARK[3]);
      const P = droopy ? T.leaf : T.leaf;
      if (droopy) { leaf(bb, fx + 1, top + 2, 2.2, 4, 2.4, P.slice(1)); leaf(bb, fx + 2, top + 2, 0.9, 4, 2.4, P.slice(1)); leaf(bb, fx + 1, top + 6, 2.6, 4, 2.2, P.slice(1)); }
      else { leaf(bb, fx + 1, top + 1, -2.2, 4, 2.6, P.slice(1)); leaf(bb, fx + 2, top + 1, -0.8, 4, 2.6, P.slice(1)); leaf(bb, fx + 1, top - 1, -1.57, 4, 2.4, P.slice(1)); leaf(bb, fx, top + 6, -2.6, 4, 2.2, P.slice(1)); }
      grid((x, y, c) => bb.set(x, y, c), fx - 4, fy - 12, ['rrrr', '.R..'], { r: '#e0546a', R: '#a8304a' });
    } else {
      const [rx0, ry0, cyUp] = size;
      const rx = rx0 * T.shape[0]; const ry = ry0 * T.shape[1];
      const cy = fy - cyUp;
      const tw = [0, 1, 2, 3, 4, 5][stage];
      trunk(bb, fx, fy + 1, cyUp - 2, tw, Math.round(cyUp - ry * 0.75));
      if (stage <= 2) grid((x, y, c) => bb.set(x, y, c), fx - 4, fy - 12, ['rrrrr', '.R...'], { r: '#e0546a', R: '#a8304a' });
      let P = T.leaf; let mixP = null; let mixAmt = 0;
      if (seedId === 'seed-cherry' && stage === 3) { P = BLOSSOM; mixP = T.leaf; mixAmt = 0.12; }
      if (seedId === 'seed-cherry' && stage === 4) { P = BLOSSOM; mixP = T.leaf; mixAmt = 0.3; }
      const inside = crown(bb, fx, cy, rx, ry, P, stage * 7 + seedId.length, { sag: droopy ? 2 : 0, mixP, mixAmt });
      // blossom dots on the cherry's green puffs
      if (seedId === 'seed-cherry' && stage === 4) bb.each((x, y) => { if (bb.tag(x, y) === 'crown' && T.leaf.includes(bb.get(x, y)) && h2(x, y, 4) < 0.18) bb.set(x, y, h2(x, y, 5) < 0.5 ? BLOSSOM[5] : BLOSSOM[4], 'crown'); });
      // blossoms sprinkled on apple and orange trees before they fruit
      if (stage === 4 && seedId !== 'seed-cherry') {
        for (let i = 0; i < 70; i += 1) {
          const x = Math.round(fx + (h2(i, 1, 9) - 0.5) * rx * 1.9); const y = Math.round(cy + (h2(i, 2, 9) - 0.5) * ry * 1.9);
          if (!inside(x, y) || !inside(x + 1, y + 1)) continue;
          const pink = seedId === 'seed-apple';
          bb.set(x, y, '#ffffff', 'crown'); bb.set(x + 1, y, pink ? '#ffd0dc' : '#fff6e0', 'crown'); bb.set(x, y + 1, pink ? '#f4a0b8' : '#f0e6d0', 'crown');
        }
      }
      // fruit, more clusters as it piles up
      if (stage === 5 && fruit > 0) {
        const [rows, pal] = FRUIT_ART[T.fruit];
        const n = Math.min(5, fruit);
        const per = T.fruit === 'cherry' ? [2, 1, 1, 2, 1] : [2, 1, 2, 1, 2];
        for (let i = 0; i < n; i += 1) {
          const [ax, ay] = FRUIT_AT[i];
          const x = Math.round(fx + ax * rx) - 2; const y = Math.round(cy + ay * ry) - 2 + (droopy ? 2 : 0);
          grid((xx, yy, c) => bb.set(xx, yy, c, 'fruit'), x, y, rows, pal);
          if (per[i] > 1) grid((xx, yy, c) => bb.set(xx, yy, c, 'fruit'), x + (T.fruit === 'cherry' ? 5 : 4), y + (T.fruit === 'cherry' ? -2 : 3), rows, pal);
        }
      }
    }
    if (droopy) bb.map((c, t) => (t === 'fruit' ? dull(c, 0.12) : dull(c)));
  }, { pad: 4, inkUp: 0 });
  // falling petals round a cherry in bloom
  if (seedId === 'seed-cherry' && (stage === 3 || stage === 4) && !droopy) {
    [[-14, -10], [12, -4], [-6, 2], [18, -20], [-20, -26], [6, -1]].forEach(([dx, dy], i) => b.set(fx + dx, fy + dy, i % 2 ? '#ffd0dc' : '#ffffff', 'soft'));
  }
  return toCanvas(b, fx, fy + 1);
}

/**
 * A plant at a growth stage (0 .. KINDS[kind].stages - 1), as a canvas with its anchor (ax, ay).
 * Bed plants (flowers, vegetables) fill a bed: put the anchor on YARD.beds[i].foot. Trees:
 * put the anchor on YARD.trees[i] (the trunk's foot). o: { droopy: leaves and heads sag and
 * the colors dull a little; fruit: a grown tree's fruit count (shows up to 5 bunches) }.
 */
export function plantArt(seedId, stage = 0, { droopy = false, fruit = 0 } = {}) {
  const seed = seedById(seedId);
  if (!seed) return null;
  const n = seed.kind === 'tree' ? 6 : seed.kind === 'veg' ? 5 : 4;
  const st = Math.max(0, Math.min(n - 1, Math.round(stage) || 0));
  const fr = seed.kind === 'tree' && st === n - 1 ? Math.max(0, Math.min(5, Math.floor(fruit) || 0)) : 0;
  return keep(`plant|${seedId}|${st}|${droopy ? 1 : 0}|${fr}`, () => (seed.kind === 'tree' ? treeArt(seedId, st, !!droopy, fr) : bedPlant(seedId, st, !!droopy)));
}

// ---------- standing decorations ----------
// Each comes back as a canvas with its anchor (ax, ay) at its foot (bottom middle): put that on
// its YARD.spots point and sort it with the buddy by that y.

const STONEW = ['#5a5068', '#7e7488', '#a49aa8', '#c8c0c4', '#e4dedc', '#faf6ee'];
const ROOF = ['#4a2230', '#7a3436', '#a84a3e', '#cc6a4c', '#e89068', '#f8b88a'];

function birdbathArt() {
  return sprite(20, 25, (b) => {
    const S = STONEW;
    // the base and the pedestal with a ring
    for (let y = 20; y < 25; y += 1) for (let x = 3; x < 17; x += 1) { if (y === 20 && (x < 5 || x > 14)) continue; b.set(x, y, y === 20 || y === 21 ? (x < 6 ? S[5] : x > 13 ? S[2] : S[4]) : x < 5 ? S[4] : x > 14 ? S[1] : S[3]); }
    for (let y = 9; y < 20; y += 1) {
      const half = y > 16 ? 3 : 2;
      for (let x = 10 - half; x < 10 + half; x += 1) b.set(x, y, x === 10 - half ? S[5] : x === 10 + half - 1 ? S[1] : x < 10 ? S[4] : S[2]);
    }
    for (let x = 6; x < 14; x += 1) { b.set(x, 13, x < 8 ? S[5] : x > 11 ? S[2] : S[4]); b.set(x, 14, x > 11 ? S[1] : S[2]); }
    // the bowl: a wide rim, water inside, the underside tapering into the pedestal
    for (let y = 0; y < 10; y += 1) {
      for (let x = 0; x < 20; x += 1) {
        const rim = inEll(x, y, 10, 3.5, 10, 3.5);
        const under = y >= 3 && y < 10 && Math.abs(x + 0.5 - 10) < 9.5 - (y - 3) * 1.15;
        if (!rim && !under) continue;
        let c;
        if (rim) {
          const water = inEll(x, y, 10, 3.2, 7.2, 2.1);
          if (water) c = y < 3 ? WA[3] : (x + y) % 5 === 0 ? WA[5] : WA[4];
          else c = y < 3 ? (x < 10 ? S[5] : S[4]) : x < 6 ? S[4] : x > 14 ? S[2] : S[3];
          if (water && x > 4 && x < 9 && y === 3) c = '#ffffff';
        } else c = x < 7 ? S[3] : x > 13 ? S[1] : S[2];
        b.set(x, y, c);
      }
    }
    // moss and a little ivy curling up the pedestal
    [[4, 22], [5, 21], [14, 23], [15, 22], [7, 1], [8, 1]].forEach(([x, y]) => b.set(x, y, y < 5 ? '#8aae6a' : LEAF[3]));
    for (let y = 22; y > 9; y -= 1) { const x = 10 + Math.round(Math.sin(y / 2) * 2.2); b.set(x, y, LEAF[2]); if (y % 3 === 0) b.set(x + (y % 2 ? 1 : -1), y, LEAF[4]); }
  }, { pad: 3 });
}

function beehouseArt() {
  return sprite(22, 30, (b) => {
    // two posts and a back board in shade
    for (const x of [2, 18]) for (let y = 6; y < 30; y += 1) { b.set(x, y, WD[4]); b.set(x + 1, y, WD[2]); }
    for (let y = 7; y < 21; y += 1) for (let x = 4; x < 18; x += 1) b.set(x, y, (x - 4) % 4 === 3 ? WD[0] : y < 10 ? WD[0] : WD[1]);
    // the shelf
    for (let x = 0; x < 22; x += 1) { b.set(x, 21, WD[5]); b.set(x, 22, WD[3]); b.set(x, 23, WD[1]); }
    // the skep: a dome of coiled straw with a dark doorway
    for (let y = 9; y < 21; y += 1) {
      for (let x = 3; x < 19; x += 1) {
        if (!inEll(x, y, 11, 21, 7.6, 11.8)) continue;
        const coil = (y - 9) % 3;
        const lit = -((x + 0.5 - 11) / 7.6) * 0.7 - ((y - 15) / 10) * 0.5;
        let k = coil === 0 ? 4 : coil === 1 ? 3 : 2;
        if (lit > 0.35) k += 1; else if (lit < -0.3) k -= 1;
        if (coil === 2 && (x + y) % 4 === 0) k -= 1; // the binding stitches
        b.set(x, y, TH[Math.max(0, Math.min(5, k))]);
      }
    }
    grid((x, y, c) => b.set(x, y, c), 9, 17, ['.kk.', 'kKKk', 'kKKk', 'kKKk'], { k: TH[0], K: '#2e1a24' });
    // a drip of honey on the shelf, a tiny sign
    grid((x, y, c) => b.set(x, y, c), 14, 21, ['yY', 'y.', 'y.'], { y: GOLD[2], Y: GOLD[4] });
    // the roof: two slopes of scalloped shingles
    for (let y = 0; y < 8; y += 1) {
      const half = 3 + y * 1.45;
      for (let x = Math.floor(11 - half); x < Math.ceil(11 + half); x += 1) {
        if (x < -1 || x > 22) continue;
        const row = Math.floor(y / 2); const sc = (x + row) % 3;
        let k = y % 2 === 0 ? 3 : 2;
        if (sc === 0 && y % 2 === 1) k = 1;
        if (x < 11) k += 1;
        if (y === 7) k = 1;
        b.set(x, y, ROOF[Math.max(0, Math.min(5, k))]);
      }
    }
    b.set(10, -1, ROOF[5]); b.set(11, -1, ROOF[4]);
    // flowers at its feet
    grid((x, y, c) => b.set(x, y, c), 4, 26, ['.p.y.', 'pPgYy', '.gg.g'], { p: FL.lilac[1], P: FL.lilac[2], y: FL.yellow[1], Y: FL.yellow[2], g: LEAF[3] });
  }, { pad: 3 });
}

function benchArt() {
  return sprite(34, 21, (b) => {
    const P = WD;
    // back legs rising to round tops, slats with a heart cut out of the middle one
    for (const x of [1, 31]) for (let y = 0; y < 21; y += 1) { b.set(x, y, y === 0 ? P[5] : P[4]); b.set(x + 1, y, y === 0 ? P[4] : P[2]); }
    for (const sy of [2, 5, 8]) {
      for (let x = 3; x < 31; x += 1) {
        b.set(x, sy, P[4]); b.set(x, sy + 1, P[2]);
        if (h2(x >> 2, sy, 5) < 0.15) b.set(x, sy, P[3]);
      }
    }
    grid((x, y, c) => b.set(x, y, c), 14, 4, ['.k.k.', 'kkkkk', '.kkk.', '..k..'], { k: '#5a3a3a' });
    for (const [x, y] of [[15, 5], [17, 5]]) b.set(x, y, P[1]);
    // the arms
    for (const x0 of [0, 29]) { for (let x = x0; x < x0 + 5; x += 1) { b.set(x, 9, P[5]); b.set(x, 10, P[3]); } }
    // the seat, its front edge, the front legs
    for (let x = 0; x < 34; x += 1) { b.set(x, 12, P[5]); b.set(x, 13, P[4]); b.set(x, 14, P[3]); b.set(x, 15, P[1]); }
    for (const x of [2, 30]) for (let y = 16; y < 21; y += 1) { b.set(x, y, P[4]); b.set(x + 1, y, P[2]); }
    for (const x of [1, 31]) for (let y = 10; y < 12; y += 1) { b.set(x, y, P[4]); b.set(x + 1, y, P[2]); }
    // a little cushion on one end
    grid((x, y, c) => b.set(x, y, c), 4, 9, ['.ccccc.', 'cCCcCCc', 'cccccc.'], { c: '#e8846a', C: '#f8b8a0' });
  }, { pad: 3 });
}

function swingArt() {
  return sprite(42, 44, (b) => {
    // two A-frames and the beam across
    const legs = [[6, 0], [6, 12], [34, 28], [34, 40]];
    for (const [tx, bx] of legs) {
      for (let y = 2; y < 44; y += 1) {
        const t = (y - 2) / 41; const x = Math.round(tx + (bx - tx) * t);
        b.set(x, y, WD[4]); b.set(x + 1, y, WD[2]);
      }
    }
    for (const [x0, x1] of [[3, 9], [31, 37]]) for (let x = x0; x <= x1; x += 1) { b.set(x, 27, WD[4]); b.set(x, 28, WD[2]); }
    for (let x = 1; x < 41; x += 1) { b.set(x, 1, WD[5]); b.set(x, 2, WD[4]); b.set(x, 3, WD[2]); if (h2(x >> 2, 1, 7) < 0.2) b.set(x, 2, WD[3]); }
    b.set(0, 2, WD[4]); b.set(41, 2, WD[2]);
    // ropes down to the seat
    for (const x of [15, 26]) {
      for (let y = 4; y < 32; y += 1) b.set(x, y, y % 2 ? '#e8d0a0' : '#c8a878', 'soft');
      b.set(x - 1, 4, '#b89a70'); b.set(x + 1, 4, '#b89a70');
    }
    for (let x = 13; x < 29; x += 1) { b.set(x, 32, WD[5]); b.set(x, 33, WD[3]); b.set(x, 34, WD[1]); }
    // ivy and flowers twined round the beam and a leg
    for (let x = 3; x < 39; x += 1) {
      const y = 2 + Math.round(Math.sin(x / 2.2) * 1.4);
      if (h2(x, 2, 5) < 0.55) b.set(x, y, h2(x, 3, 5) < 0.5 ? LEAF[3] : LEAF[2]);
      if (x % 6 === 2) grid((xx, yy, c) => b.set(xx, yy, c), x - 1, y - 1, ['.l.', 'lmd', '.d.'], { l: FL.pink[2], m: FL.pink[1], d: FL.pink[0] });
    }
    for (let y = 6; y < 40; y += 1) { const x = Math.round(6 - (y - 2) * 6 / 41) + Math.round(Math.sin(y / 2) * 1.2); if (h2(y, 4, 5) < 0.6) b.set(x, y, LEAF[3]); if (y % 7 === 3) b.set(x + 1, y, FL.yellow[1]); }
  }, { pad: 3 });
}

const DECOR_ART = { birdbath: birdbathArt, beehouse: beehouseArt, bench: benchArt, swing: swingArt };

/**
 * A standing decoration: 'garden-birdbath', 'garden-beehouse', 'garden-bench', 'garden-swing'
 * (and the watering cans, upright). A canvas with its anchor (ax, ay) at its foot. Flat ones
 * (the pond, fences, paths) are painted by paintYard: null.
 */
export function decorArt(id) {
  const d = decorById(id);
  if (!d) return null;
  if (d.spot === 'can') return canArt(id, 0);
  const fn = DECOR_ART[d.art];
  if (!fn) return null;
  return keep(`decor|${id}`, () => { const b = fn(); return toCanvas(b, Math.floor(b.w / 2), b.h); });
}

// ---------- watering cans ----------

const CAN_PAL = {
  'garden-can-basic': METAL,
  'garden-can-copper': ['#5a2a24', '#8a4430', '#b8663a', '#d88a4a', '#f0b070', '#ffdcaa'],
  'garden-can-rainbow': null,
};
const RAINBOW = ['#e0465a', '#f08c3a', '#ffd23f', '#5abf5a', '#4f9ad8', '#9a6ae0'];

const CAN_ROWS = [
  '...hhhh......',
  '..h....h.....',
  '..h....h.....',
  '.TTTTTTTT..rR',
  '.LwMMMMMD..rR',
  '.LwMMMMMD.s..',
  '.LMMMMMMDs...',
  '.LMMMMMMS....',
  '.LMMMMMMD....',
  '.dddddddd....',
];

/** The can's colors, as a grid of colors (null where empty). */
function canColors(key) {
  const P = CAN_PAL[key];
  return CAN_ROWS.map((row, y) => [...row].map((ch, x) => {
    if (ch === '.') return null;
    if (P) {
      const c = { h: P[2], T: P[5], L: P[4], w: P[5], M: P[3], D: P[1], d: P[2], s: P[3], S: P[2], r: P[4], R: P[2] }[ch];
      if (key === 'garden-can-copper' && ch === 'M' && h2(x, y, 4) < 0.12) return '#6ab8a0'; // a bit of patina
      return c;
    }
    if ('hsSrR'.includes(ch)) return { h: '#9a6ae0', s: '#6ab0f0', S: '#3e78c8', r: '#ffe27a', R: '#d8a020' }[ch];
    const R = ramp(RAINBOW[Math.max(0, Math.min(5, y - 4))], 1, 1);
    return ch === 'T' ? ramp(RAINBOW[0], 1, 2)[3] : ch === 'L' || ch === 'w' ? R[2] : ch === 'D' || ch === 'd' ? R[0] : R[1];
  }));
}

/** A grid of colors turned by angle a round (px0, py0): each new cell takes the color most of it covers. */
function turnGrid(cols, a, px0, py0) {
  const ca = Math.cos(a); const sa = Math.sin(a);
  const h = cols.length; const w = cols[0].length;
  const out = [];
  for (let y = -4; y < h + 4; y += 1) {
    for (let x = -4; x < w + 4; x += 1) {
      const count = new Map(); let n = 0;
      for (let sy = 0; sy < 4; sy += 1) for (let sx = 0; sx < 4; sx += 1) {
        const dx = x + (sx + 0.5) / 4 - px0; const dy = y + (sy + 0.5) / 4 - py0;
        const ux = px0 + dx * ca + dy * sa; const uy = py0 - dx * sa + dy * ca;
        const c = cols[Math.floor(uy)]?.[Math.floor(ux)];
        if (c) { count.set(c, (count.get(c) || 0) + 1); n += 1; }
      }
      if (n < 7) continue;
      let best = null; let bn = 0;
      for (const [c, k] of count) if (k > bn) { best = c; bn = k; }
      out.push([x, y, best]);
    }
  }
  return out;
}

/**
 * A watering can, small enough for the buddy to hold (13 x 10). tilt 0 stands upright, 1 tips
 * forward pouring. Anchor (ax, ay): its foot (bottom middle); also hx, hy: the top of the
 * handle (where a paw holds it), and sx, sy: the spout's rose (where waterDrops start).
 */
export function canArt(id, tilt = 0) {
  const d = decorById(id);
  const key = d && d.spot === 'can' ? id : 'garden-can-basic';
  const t = tilt ? 1 : 0;
  return keep(`can|${key}|${t}`, () => {
    const a = t ? 0.6 : 0; const pv = [5, 6];
    const turn = ([x, y]) => [pv[0] + (x - pv[0]) * Math.cos(a) - (y - pv[1]) * Math.sin(a), pv[1] + (x - pv[0]) * Math.sin(a) + (y - pv[1]) * Math.cos(a)];
    const cells = t ? turnGrid(canColors(key), a, pv[0], pv[1]) : canColors(key).flatMap((row, y) => row.map((c, x) => [x, y, c]).filter((q) => q[2]));
    const b = sprite(16, 13, (bb) => { for (const [x, y, c] of cells) bb.set(x, y, c); }, { pad: 4 });
    // keep the hole in the handle open
    b.each((x, y) => {
      if (b.tag(x, y) !== 'edge') return;
      const [ux, uy] = t ? [pv[0] + (x + 0.5 - pv[0]) * Math.cos(a) + (y + 0.5 - pv[1]) * Math.sin(a), pv[1] - (x + 0.5 - pv[0]) * Math.sin(a) + (y + 0.5 - pv[1]) * Math.cos(a)] : [x + 0.5, y + 0.5];
      if (ux > 3 && ux < 7 && uy > 1 && uy < 3) b.del(x, y);
    });
    const foot = turn([4.5, 10]); const hand = turn([4.5, 0]); const rose = turn([12.5, 3.5]);
    const c = toCanvas(b, Math.round(foot[0]), Math.round(foot[1]));
    c.hx = Math.round(hand[0]) + b.pad; c.hy = Math.round(hand[1]) + b.pad;
    c.sx = Math.round(rose[0]) + b.pad; c.sy = Math.round(rose[1]) + b.pad;
    return c;
  });
}

/** Water falling from a can's rose, 3 frames (loop them): anchor (ax, ay) is the top of the spray (put it on the can's sx, sy). */
export function waterDrops(frame = 0) {
  const f = ((frame % 3) + 3) % 3;
  return keep(`drops|${f}`, () => {
    const b = new Buf(9, 12, 1);
    const drops = [[1, 0], [4, 2], [7, 1], [2, 5], [5, 7], [8, 6], [3, 10], [6, 11]];
    for (const [x, y] of drops) {
      const yy = (y + f * 4) % 12; const xx = x + Math.floor(yy / 6) * (x < 4 ? -1 : x > 5 ? 1 : 0);
      b.set(xx, yy, '#e8f8ff'); b.set(xx, yy + 1, WA[4]);
    }
    for (let x = 2; x < 7; x += 2) b.set(x, 0, 'rgba(205,238,252,0.6)');
    return toCanvas(b, 4, 0);
  });
}

// ---------- critters ----------
// Tiny and drawn plainly (no outline: they're only a few pixels). Anchor (ax, ay): the body's middle.

function hsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return `#${[r, g, b].map((v) => Math.round((v + m) * 255).toString(16).padStart(2, '0')).join('')}`;
}

const BFLY = [
  ['..k.k..', 'LL.k.LL', 'LMLkLML', '.MMkMM.', '.DMkMD.', '..D.D..'],
  ['..k.k..', '.L.k.L.', '.LMkML.', '.MMkMM.', '..DkD..', '.......'],
  ['..k.k..', '..LkL..', '..LkM..', '..MkM..', '...k...', '.......'],
];

/** A butterfly, 3 frames (wings open, half, closed: play 0 1 2 1); hue: its wings' color (degrees). */
export function butterflyArt(frame = 0, hue = 330) {
  const f = ((frame % 3) + 3) % 3; const hh = Math.round(hue) % 360;
  return keep(`bfly|${f}|${hh}`, () => {
    const b = new Buf(7, 6, 1);
    grid((x, y, c) => b.set(x, y, c), 0, 0, BFLY[f], { k: INK, L: hsl(hh + 12, 0.95, 0.82), M: hsl(hh, 0.85, 0.64), D: hsl(hh - 14, 0.7, 0.46) });
    if (f === 0) { b.set(1, 2, '#ffffff'); b.set(5, 2, '#ffffff'); }
    return toCanvas(b, 3, 3);
  });
}

/** A bumblebee, 2 frames (wings up, wings down), facing right. */
export function beeArt(frame = 0) {
  const f = ((frame % 2) + 2) % 2;
  return keep(`bee|${f}`, () => {
    const b = new Buf(7, 5, 1);
    const rows = f ? ['.......', '.wWww..', '.YkYkk.', 'yYkYkKe', '.ykyk..'] : ['..wW...', '..wWw..', '.YkYkk.', 'yYkYkKe', '.ykyk..'];
    grid((x, y, c) => b.set(x, y, c), 0, 0, rows, { w: 'rgba(230,244,255,0.85)', W: '#ffffff', Y: '#ffe27a', y: '#f0b42a', k: '#3b2235', K: '#2a1a2a', e: '#2a1a2a' });
    return toCanvas(b, 3, 3);
  });
}

const BIRD = [
  ['....bbb.', '...bBebO', '..bbbRR.', '.bbbRRR.', 'bBbbRRR.', 'tbbbbRb.', '..bbbb..', '...l.l..'],
  ['........', '........', '..bBb...', '.bBbbbb.', 'bbbbRbbe', 'tbbbRRbO', '..bbbb..', '...l.l..'],
  ['.BB.....', '..BBB.bb', '...bBbeO', 'tbbbRRb.', '.bbbRR..', '...bb...', '........', '........'],
];

/** A robin, 3 frames: standing, pecking, flying (wings up). Facing right; anchor at its feet. */
export function birdArt(frame = 0) {
  const f = ((frame % 3) + 3) % 3;
  return keep(`bird|${f}`, () => {
    const b = new Buf(8, 8, 1);
    grid((x, y, c) => b.set(x, y, c), 0, 0, BIRD[f], { b: '#8a5a44', B: '#b8845e', R: '#e8643a', e: '#2a1a2a', O: '#f0b030', t: '#6a4434', l: '#7a4a3a' });
    return toCanvas(b, 4, 8);
  });
}

// ---------- shop thumbs ----------

const PACKET = {
  'seed-sunflower': ['#fff0b8', '#e8a020'], 'seed-tulip': ['#ffe0ea', '#e0546a'], 'seed-daisy': ['#e4f6dc', '#4a9a50'],
  'seed-carrot': ['#ffe8cc', '#e8762a'], 'seed-tomato': ['#ffe0d8', '#c8303a'], 'seed-pumpkin': ['#ffe4c0', '#d0661e'],
  'seed-apple': ['#e8f4d0', '#3a8a48'], 'seed-cherry': ['#ffe0e8', '#b8284a'], 'seed-orange': ['#fff0d0', '#e88a1e'],
};

/** The picture on a seed packet: the grown plant, small. Drawn round (cx, by) = its foot. */
function packetPicture(b, seedId, cx, by) {
  const set = (x, y, c) => b.set(x, y, c);
  switch (seedId) {
    case 'seed-sunflower':
      for (let y = by; y > by - 7; y -= 1) b.set(cx, y, LEAF[2]);
      leaf(b, cx + 1, by - 3, -0.4, 4, 2.6); leaf(b, cx, by - 2, Math.PI + 0.4, 4, 2.6);
      sunHead(b, cx + 0.5, by - 9, 4.6);
      break;
    case 'seed-tulip':
      for (const [x, c, h] of [[cx - 3, 0, 8], [cx + 3, 1, 9], [cx, 2, 11]]) { for (let y = by; y > by - h + 3; y -= 1) b.set(x, y, LEAF[2]); tulipCup(b, x, by - h, TUL[c], 0); }
      grid(set, cx - 5, by - 3, ['L.........L', 'lL.......Ll', '.lL.....Ll.'], { L: LEAF[4], l: LEAF[3] });
      break;
    case 'seed-daisy':
      grid(set, cx - 6, by - 3, ['..lLl..lLl..', '.lLLLllLLLl.', 'lllllllllll.'], { l: LEAF[3], L: LEAF[4] });
      for (const [x, y, big] of [[cx - 3, by - 7, 1], [cx + 3, by - 8, 1], [cx, by - 11, 1], [cx - 5, by - 3, 0], [cx + 5, by - 3, 0]]) daisy(b, x, y, big, false, false);
      break;
    case 'seed-carrot':
      grid(set, cx - 5, by - 13, ['.....T.T....', '....l.L.l...', '.....lLl....', '......l.....', '.....oOo....', '....oOooq...', '....oOooq...', '.....oooq...', '.....ooq....', '.....oqq....', '......oq....', '......q.....', '......q.....'], { T: LEAF[5], L: LEAF[4], l: LEAF[3], o: CARROT[2], O: CARROT[4], q: CARROT[1] });
      break;
    case 'seed-tomato':
      grid(set, cx - 6, by - 11, ['....l.L.....', '...lLlLl....', '..sssssss...', '...s....s...'], { l: LEAF[3], L: LEAF[4], s: LEAF[2] });
      tomato(b, cx - 3, by - 5, TOMATO, true); tomato(b, cx + 3, by - 4, TOMATO, true); tomato(b, cx, by - 1, TOMATO, true);
      break;
    case 'seed-pumpkin':
      pumpLeaf(b, cx + 5, by - 7, 3.2, false);
      pumpkin(b, cx, by, 6, 4.6);
      break;
    default: {
      const T = TREE_LOOK[seedId];
      crown(b, cx, by - 9, 7, 6, T.leaf, 5);
      for (let y = by; y > by - 4; y -= 1) { b.set(cx, y, BARK[3]); b.set(cx + 1, y, BARK[2]); }
      const [rows, pal] = FRUIT_ART[T.fruit];
      grid(set, cx - 4, by - 10, rows, pal); grid(set, cx + 1, by - 8, rows, pal);
    }
  }
}

function seedPacket(seedId) {
  const [paper, accent] = PACKET[seedId];
  const Pp = ramp(paper, 2, 1); const A = ramp(accent, 2, 2);
  return sprite(24, 30, (b) => {
    for (let y = 0; y < 30; y += 1) {
      for (let x = 0; x < 24; x += 1) {
        let c = x === 0 ? Pp[3] : x === 23 ? Pp[1] : y === 29 ? Pp[1] : Pp[2];
        if (y < 3) { if (y === 0 && x % 2) continue; c = y === 2 ? A[1] : A[2]; } // the crimped top
        if (y === 3) c = Pp[0];
        if (y >= 23 && y < 28 && x > 1 && x < 22) c = y === 23 ? A[3] : A[2]; // the name band
        b.set(x, y, c);
      }
    }
    // name "letters" on the band
    for (let x = 4; x < 20; x += 1) if (h2(x, 1, seedId.length) < 0.7 && x % 4 !== 3) { b.set(x, 25, '#fffaf0'); if (x % 2) b.set(x, 26, mix('#fffaf0', A[2], 0.4)); }
    // the picture window: sky, a hill, the plant
    for (let y = 5; y < 22; y += 1) {
      for (let x = 2; x < 22; x += 1) {
        if ((x === 2 || x === 21) && (y === 5 || y === 21)) continue;
        let c = y < 12 ? '#bfe4f8' : y < 17 ? '#d8f0fc' : '#9ed46a';
        if (y >= 17 && y === 17 + Math.round(Math.sin(x / 3) * 0.8)) c = '#c0e48a';
        if (y >= 19) c = y === 19 ? LEAF[3] : SOIL[3];
        if (inEll(x, y, 6, 8, 3, 1.3)) c = '#ffffff';
        b.set(x, y, c);
      }
    }
    packetPicture(b, seedId, 12, 19);
  }, { pad: 3 });
}

/** A seed packet for the shop: a canvas showing the grown plant on its front. */
export function seedThumb(doc, seedId) {
  if (!seedById(seedId)) return null;
  return copyCanvas(keep(`packet|${seedId}`, () => toCanvas(seedPacket(seedId), 12, 30)), doc);
}

/** A little round of grass with something flat painted on it (a path, the pond), for a shop card. */
function patchThumb(paintFn, x0, y0, w, h) {
  const pb = pixelBuffer(W, H);
  grassB(pb.px, W, H, 4242, { flowers: 0.3 });
  paintFn(pb.px);
  const b = new Buf(w, h, 2);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const e = ((x + 0.5 - w / 2) / (w / 2)) ** 2 + ((y + 0.5 - h / 2) / (h / 2)) ** 2;
      if (e > 1 || (e > 0.8 && bayer(x, y) < (e - 0.8) * 5)) continue;
      const i = ((y0 + y) * W + (x0 + x)) * 4;
      const d = pb.data;
      b.set(x, y, `#${[d[i], d[i + 1], d[i + 2]].map((v) => v.toString(16).padStart(2, '0')).join('')}`);
    }
  }
  return toCanvas(b, w / 2, h);
}

/** A garden decoration on its own, for a shop card. */
export function decorThumb(doc, id) {
  const d = decorById(id);
  if (!d) return null;
  const src = keep(`thumb|${id}`, () => {
    if (d.spot === 'fence') {
      const k = FENCES[d.art].name;
      const b = new Buf(44, 24, 4);
      const run = fenceRun(k, 34, 9);
      run.blit((x, y, c) => b.set(x, y, c), 0, 5);
      gatePost(k, 1).blit((x, y, c) => b.set(x, y, c), 35, 0);
      return toCanvas(b, 22, 20);
    }
    if (d.spot === 'path') return patchThumb((px) => (d.art === 'path-brick' ? brickPath(px, 4243) : stonePath(px, 4243)), 138, 94, 44, 30);
    if (d.art === 'pond') return patchThumb((px) => pondArt(px), 12, 128, 68, 38);
    if (d.spot === 'can') return canArt(id, 0);
    return decorArt(id);
  });
  return src ? copyCanvas(src, doc) : null;
}

// ---------- harvests in the house ----------
// Small pieces for the house (on or beside the table), each with its anchor (ax, ay) at its foot.

/** A vase of flowers from the garden (about 12 x 18): sunflowers in a jug, tulips in glass, daisies in a little pitcher. */
export function vaseArt(seedId) {
  return keep(`vase|${seedId}`, () => {
    const b = sprite(14, 20, (bb) => {
      const set = (x, y, c, t) => bb.set(x, y, c, t);
      if (seedId === 'seed-sunflower') {
        for (const [x, top] of [[4, 4], [9, 2], [7, 8]]) for (let y = top; y < 13; y += 1) set(x, y, LEAF[2], 'soft');
        leaf(bb, 3, 9, Math.PI + 0.6, 4, 2.6); leaf(bb, 10, 10, -0.5, 4, 2.6);
        sunHead(bb, 4, 3, 3.6); sunHead(bb, 10, 2, 3.6); sunHead(bb, 7.5, 7, 3.2);
        // a cream jug with a blue band
        for (let y = 12; y < 20; y += 1) for (let x = 3; x < 11; x += 1) { if ((y === 12 || y === 19) && (x === 3 || x === 10)) continue; set(x, y, y === 15 || y === 16 ? (x < 5 ? '#8ab8e8' : '#4f7ac8') : x < 5 ? '#fffaf0' : x > 8 ? '#d8c8b0' : '#f4ead8'); }
        grid((x, y, c) => set(x, y, c), 11, 13, ['cc', '.c', 'cc'], { c: '#e8dcc8' });
      } else if (seedId === 'seed-tulip') {
        [[3, 3, 0, -2], [7, 1, 1, 0], [11, 3, 2, 2], [5, 6, 3, -1], [9, 6, 0, 1]].forEach(([x, top, ci, lean]) => { for (let y = top + 3; y < 14; y += 1) set(x + Math.round(lean * (1 - (y - top) / 12)), y, LEAF[2], 'soft'); tulipCup(bb, x + lean, top, TUL[ci], 0); });
        grid((x, y, c) => set(x, y, c), 2, 10, ['L.......L.', '.l.....l..'], { L: LEAF[4], l: LEAF[3] });
        // a clear glass vase: you see the stems through it
        for (let y = 12; y < 20; y += 1) for (let x = 3; x < 12; x += 1) {
          if (y > 12 && y < 15 && (x === 3 || x === 11)) continue;
          const glass = x === 4 || y === 19 ? '#e8f6fc' : x === 11 || x === 10 ? '#8ac0dc' : (x === 6 || x === 8) && y < 18 ? LEAF[3] : y > 15 ? '#a8d8ec' : '#cdeefc';
          set(x, y, glass);
        }
      } else {
        for (let i = 0; i < 9; i += 1) { const x = 2 + i * 1.2; for (let y = 6 + (i % 3); y < 13; y += 1) set(Math.round(x + (i - 4) * (13 - y) * 0.06), y, LEAF[2], 'soft'); }
        grid((x, y, c) => set(x, y, c), 2, 8, ['.lL..Ll..', 'lL.lL.Ll.'], { l: LEAF[3], L: LEAF[4] });
        [[2, 6, 1], [6, 4, 1], [10, 6, 1], [4, 9, 0], [8, 8, 0], [11, 10, 0], [1, 10, 0]].forEach(([x, y, big], i) => daisy(bb, x, y, big, i === 2, false));
        // a little blue and white pitcher
        for (let y = 12; y < 20; y += 1) for (let x = 3; x < 11; x += 1) { if (y === 19 && (x === 3 || x === 10)) continue; set(x, y, (x + y) % 4 === 0 && y > 13 ? '#4f7ac8' : x < 5 ? '#ffffff' : x > 8 ? '#c8d4ec' : '#eef2fc'); }
        grid((x, y, c) => set(x, y, c), 2, 11, ['bbbbbbbbbb'], { b: '#4f7ac8' });
        grid((x, y, c) => set(x, y, c), 11, 13, ['cc', '.c', 'cc'], { c: '#c8d4ec' });
      }
    }, { pad: 3, inkUp: 0 });
    return toCanvas(b, 7, 20);
  });
}

/** A wicker basket of vegetables from the garden (about 16 x 12): carrots, tomatoes or a pumpkin. */
export function basketArt(seedId) {
  return keep(`basket|${seedId}`, () => {
    const b = sprite(18, 14, (bb) => {
      const set = (x, y, c) => bb.set(x, y, c);
      const fill = () => {
        if (seedId === 'seed-carrot') {
          grid(set, 1, 2, ['.T.T....T.T.....', 'l.L.l..l.L.l.T..', '.lLl....lLl.l.L.', '..l......l..lLl.', '.oOo...oOo...l..', 'oOooqoOooqoOo...', 'oooqqoooqqoooq..'], { T: LEAF[5], L: LEAF[4], l: LEAF[3], o: CARROT[2], O: CARROT[4], q: CARROT[1] });
          grid(set, 12, 6, ['oOo', 'ooq', 'oqq'], { o: CARROT[2], O: CARROT[4], q: CARROT[1] });
        } else if (seedId === 'seed-tomato') {
          for (const [x, y] of [[5, 5], [10, 4], [14, 6], [7, 7], [12, 7], [3, 7]]) tomato(bb, x, y, TOMATO, true);
        } else pumpkin(bb, 9, 10, 6.5, 5);
      };
      fill();
      // the basket: woven rows, a lit rim, a handle at each end
      for (let y = 8; y < 14; y += 1) {
        const inset = y > 11 ? 1 : 0;
        for (let x = inset; x < 18 - inset; x += 1) {
          let c = (x + (y % 2) * 2) % 4 < 2 ? '#d4a86a' : '#b8844e';
          if (y === 8) c = '#f0d49a'; else if (y === 9) c = '#c8965a';
          if (x === inset) c = '#e8c890'; if (x === 17 - inset) c = '#8a5a3a';
          if (y === 13) c = '#8a5a3a';
          set(x, y, c);
        }
      }
      grid(set, -1, 9, ['h', 'h'], { h: '#a8784a' }); grid(set, 18, 9, ['h', 'h'], { h: '#8a5a3a' });
    }, { pad: 3 });
    return toCanvas(b, 9, 14);
  });
}

/** The fruit bowl: a cream bowl with a blue band holding up to 5 fruit (apples, cherries, oranges) piled up. */
export function bowlArt(seedIds = []) {
  const list = (seedIds || []).filter((s) => TREE_LOOK[s]).slice(0, 5);
  return keep(`bowl|${list.join(',')}`, () => {
    const b = sprite(20, 13, (bb) => {
      const set = (x, y, c) => bb.set(x, y, c);
      const at = [[5, 3], [10, 3], [2, 1], [7, 0], [12, 1]];
      // the back ones first, so the front ones sit over them
      const order = [3, 2, 4, 0, 1].filter((i) => i < list.length);
      for (const i of order) {
        const [x, y] = at[i]; const kind = TREE_LOOK[list[i]].fruit;
        if (kind === 'cherry') grid(set, x, y, ['..sL.', '.s.s.', 'Rr.Rr', 'rd.rd'], FRUIT_ART.cherry[1]);
        else grid(set, x, y, FRUIT_ART[kind][0], FRUIT_ART[kind][1]);
      }
      for (let y = 7; y < 13; y += 1) {
        for (let x = 0; x < 20; x += 1) {
          const half = y < 9 ? 10 : 10 - (y - 8) * 1.1 - (y > 11 ? 1 : 0);
          if (Math.abs(x + 0.5 - 10) > half) continue;
          let c = x < 5 ? '#fffaf0' : x > 15 ? '#d8c8b0' : '#f4ead8';
          if (y === 7) c = '#fffaf0';
          if (y === 9 || y === 10) c = x < 5 ? '#8ab8e8' : x > 15 ? '#3e62a8' : '#4f7ac8';
          if (y === 12) c = '#c8b498';
          set(x, y, c);
        }
      }
    }, { pad: 3 });
    return toCanvas(b, 10, 13);
  });
}

// ---------- protective domes ----------
// On some maps the garden needs a shield over it: a glassy bubble under the sea and in space,
// a heat-proof dome by the volcano. shieldArt() is a see-through overlay the size of the yard,
// drawn over everything (the topmost layer): the dome's rim and shine, with what's beyond it
// filling the corners outside. The middle stays clear so the garden reads.

/** Which shield each map's garden gets (the buddy's background id); maps not listed get none. */
export const SHIELDS = { 'bg-ocean': 'bubble', 'bg-space': 'bubble', 'bg-galaxy': 'bubble', 'bg-volcano': 'heat' };

// the dome's edge: a superellipse just inside the yard, round over the top and squarer below,
// where it runs off the bottom of the yard (so the gate stays open)
const DOME = { cx: 160, cy: 94, hx: 159, hyTop: 93, hyBot: 106, nTop: 3.2, nBot: 5 };
const domeHy = (dy) => (dy < 0 ? DOME.hyTop : DOME.hyBot);
function domeF(x, y) {
  const X = Math.abs((x - DOME.cx) / DOME.hx); const Y = (y - DOME.cy) / domeHy(y - DOME.cy);
  const n = Y < 0 ? DOME.nTop : DOME.nBot;
  return (X ** n + Math.abs(Y) ** n) ** (1 / n);
}
/** Signed distance (about, in pixels) from the dome's edge at pixel (x, y): negative inside. Also the outward normal there and the angle round the dome. */
function domeDist(x, y) {
  const cx = x + 0.5; const cy = y + 0.5;
  const f = domeF(cx, cy);
  const gx = domeF(cx + 0.5, cy) - domeF(cx - 0.5, cy); const gy = domeF(cx, cy + 0.5) - domeF(cx, cy - 0.5);
  const g = Math.hypot(gx, gy) || 1e-6;
  return { d: (f - 1) / g, nx: gx / g, ny: gy / g, a: Math.atan2((cy - DOME.cy) / domeHy(cy - DOME.cy), (cx - DOME.cx) / DOME.hx) };
}
// how far round the dome's edge each angle is, in pixels (so stones and panes keep one size)
let ARC = null;
function arcAt(a) {
  if (!ARC) {
    const N = 2048; ARC = new Float32Array(N + 1);
    let last = null; let s = 0;
    for (let i = 0; i <= N; i += 1) {
      const t = -Math.PI + (i / N) * 2 * Math.PI; const dx = Math.cos(t); const dy = Math.sin(t);
      const hy = domeHy(dy); const f = domeF(DOME.cx + dx * DOME.hx, DOME.cy + dy * hy);
      const p = [DOME.cx + (dx * DOME.hx) / f, DOME.cy + (dy * hy) / f];
      if (last) s += Math.hypot(p[0] - last[0], p[1] - last[1]);
      ARC[i] = s; last = p;
    }
  }
  const u = ((a + Math.PI) / (2 * Math.PI)) * (ARC.length - 1);
  const i = Math.max(0, Math.min(ARC.length - 2, Math.floor(u)));
  return ARC[i] + (ARC[i + 1] - ARC[i]) * (u - i);
}
/** A point inset pixels inside the dome's edge, at angle a round it. */
function rimPoint(a, inset) {
  const dx = Math.cos(a); const dy = Math.sin(a);
  const hy = domeHy(dy); const f = domeF(DOME.cx + dx * DOME.hx, DOME.cy + dy * hy);
  const x = DOME.cx + (dx * DOME.hx) / f; const y = DOME.cy + (dy * hy) / f;
  const { nx, ny } = domeDist(x - 0.5, y - 0.5);
  return [Math.round(x - nx * inset), Math.round(y - ny * inset)];
}

const rgba = (hex, a) => { const [r, g, b] = hexRgb(hex); return `rgba(${r},${g},${b},${a})`; };

/** What's beyond the dome, at (x, y) outside it (d: how far outside). */
function beyond(theme, x, y, d, seed) {
  const b = bayer(x, y);
  if (theme === 'ocean') {
    const deep = ['#0c2250', '#123064', '#1a427c', '#245896', '#3a74b0'];
    let k = 3 - Math.min(3, Math.floor((d + b * 3) / 5));
    if (y > 150) k = Math.max(0, k - 1);
    const ray = Math.sin((x * 0.6 - y) / 9) > 0.86 && y < 120;
    if (ray && b < 0.4) k += 1;
    let c = deep[Math.max(0, Math.min(4, k))];
    // seaweed in the bottom corners
    const sw = Math.sin(y / 4 + x) * 1.5;
    if (y > 150 && ((x < 26 && Math.abs(((x + sw) % 9) - 4) < 1.1) || (x > 294 && Math.abs(((x + sw) % 8) - 4) < 1.1)) && h2(Math.floor((x + sw) / 9), 1, seed) < 0.8) c = y % 6 < 3 ? '#1e6a5a' : '#2a8a6a';
    return c;
  }
  if (theme === 'volcano') {
    const rock = ['#1a1016', '#2a1a1e', '#3a2426', '#4e302c'];
    const n = vnoise(x, y, 7, seed) * 0.7 + vnoise(x, y, 3, seed + 1) * 0.3;
    let c = rock[n > 0.6 ? 3 : n > 0.45 ? 2 : n > 0.3 ? 1 : 0];
    const crack = Math.abs(vnoise(x, y, 11, seed + 2) - 0.5) < 0.035;
    if (crack) c = b < 0.5 ? '#ff7a2a' : '#ffb84a';
    if (n < 0.24) c = n < 0.18 ? '#ffd870' : n < 0.21 ? '#ffa03a' : '#e8582a'; // lava pools
    // the glow of the heat just outside the dome
    if (d < 6 && b < (6 - d) / 7 && !crack && n >= 0.24) c = mix(c, '#c8401e', 0.45);
    return c;
  }
  // space and galaxy: a starry sky, with clouds of nebula for the galaxy
  const sky = theme === 'galaxy' ? ['#140a2a', '#22103e', '#341856', '#4e2070', '#7a2e86'] : ['#080a1c', '#0e1230', '#161c44', '#20285a', '#2e3a72'];
  let k = 1;
  if (theme === 'galaxy') { const n = vnoise(x, y, 14, seed) * 0.6 + vnoise(x, y, 5, seed + 3) * 0.4; k = n > 0.62 ? 3 + (n > 0.72 ? 1 : 0) : n > 0.48 ? 2 : n < 0.3 ? 0 : 1; if (b < 0.5 && n > 0.55 && n < 0.6) k = 3; } else k = d > 8 ? 0 : 1 + (b < (8 - d) / 16 ? 1 : 0);
  let c = sky[Math.max(0, Math.min(4, k))];
  const s = h2(x, y, seed + 5);
  if (s > 0.985) c = s > 0.996 ? '#ffffff' : theme === 'galaxy' ? '#ffd0f0' : '#c8d8ff';
  return c;
}

/** Things floating outside the dome: bubbles in the sea, twinkles and a planet in space, embers by the volcano. */
function beyondExtras(px, theme, out, seed) {
  if (theme === 'ocean') {
    for (const [x, y, r] of [[8, 20, 2], [14, 8, 1.2], [22, 3, 1], [306, 14, 2.2], [312, 30, 1.2], [300, 4, 1], [6, 166, 1.5], [312, 170, 1.8], [18, 178, 1]]) {
      if (!out(x, y)) continue;
      for (let yy = Math.floor(y - r - 1); yy <= y + r + 1; yy += 1) for (let xx = Math.floor(x - r - 1); xx <= x + r + 1; xx += 1) {
        const d = Math.hypot(xx + 0.5 - x, yy + 0.5 - y);
        if (d <= r + 0.5 && d > r - 0.6) px(xx, yy, xx < x && yy < y ? '#e8f8ff' : 'rgba(200,236,255,0.7)');
      }
      px(Math.round(x - r * 0.4), Math.round(y - r * 0.4), '#ffffff');
    }
    // little fish going by, up in the corners
    if (out(28, 6) && out(34, 8)) grid(px, 28, 5, ['o.oo.', 'oooOo', 'o.oo.'], { o: '#f08c3a', O: '#ffd8a0' });
    if (out(300, 13) && out(300, 15)) grid(px, 300, 13, ['.oo.o', 'Oooo.', '.oo.o'], { o: '#ffd43b', O: '#3b2235' });
  } else if (theme === 'volcano') {
    for (let i = 0; i < 26; i += 1) {
      const x = Math.floor(h2(i, 1, seed) * W); const y = Math.floor(h2(i, 2, seed) * H);
      if (out(x, y)) { px(x, y, i % 3 ? '#ffb84a' : '#fff0a0'); if (i % 4 === 0) px(x, y + 1, 'rgba(255,120,40,0.6)'); }
    }
  } else {
    for (const [x, y] of [[10, 10], [302, 22], [24, 4], [312, 176], [6, 174]]) {
      if (!out(x, y)) continue;
      px(x, y, '#ffffff'); for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px(x + dx, y + dy, theme === 'galaxy' ? '#ffb0e8' : '#a8c8ff');
    }
    // a small ringed planet in the top right corner
    const P = theme === 'galaxy' ? ['#5a2a7a', '#8a4aa8', '#c07ad0', '#f0b8f0'] : ['#3a4a8a', '#5a7ac0', '#8ab0e8', '#d0e4ff'];
    for (let y = 4; y < 16; y += 1) for (let x = 296; x < 316; x += 1) {
      if (!out(x, y)) continue;
      const pd = Math.hypot(x + 0.5 - 306, y + 0.5 - 10);
      const ring = Math.abs((y + 0.5 - 10) - (x + 0.5 - 306) * -0.25) < 0.8 && Math.abs(x + 0.5 - 306) < 9.5 && pd > 3;
      if (pd < 4.2) px(x, y, pd < 2 && x < 306 ? P[3] : (x + y) % 3 === 0 ? P[1] : P[2]);
      else if (ring) px(x, y, '#ffe0a0');
    }
  }
}

/**
 * The shield over the garden: kind 'bubble' (a glassy bubble with a rainbow sheen on its rim) or
 * 'heat' (a crystal dome on a ring of dark stone, cool mist inside, lava glowing outside).
 * theme: what's outside: 'ocean', 'space', 'galaxy' or 'volcano' (a map's background id like
 * 'bg-ocean' works too; by default ocean for the bubble, volcano for the heat dome). A canvas
 * YARD.W x YARD.H, see-through in the middle: draw it over the whole scene. The dome runs off the
 * bottom of the yard round the gate, and stays well clear of the back door.
 */
export function shieldArt(kind = 'bubble', theme, doc) {
  const k = kind === 'heat' ? 'heat' : 'bubble';
  let th = String(theme || (k === 'heat' ? 'volcano' : 'ocean')).replace(/^bg-/, '');
  if (!['ocean', 'space', 'galaxy', 'volcano'].includes(th)) th = k === 'heat' ? 'volcano' : 'ocean';
  return keep(`shield|${k}|${th}|${doc ? 'd' : ''}`, () => {
    const pb = pixelBuffer(W, H);
    const { px } = pb;
    const seed = 909;
    const F = [];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) F.push(domeDist(x, y));
    const at = (x, y) => F[y * W + x];
    const out = (x, y) => x >= 0 && y >= 0 && x < W && y < H && at(x, y).d > (k === 'heat' ? ringW(at(x, y)) : 0);
    // the heat dome's stone ring: thin over the top, thicker down the sides and at the front
    function ringW({ nx, ny }) { return 3 + 1.5 * Math.abs(nx) + 2.5 * Math.max(0, ny); }
    const tint = th === 'ocean' ? '#bfe8ff' : th === 'galaxy' ? '#f0dcff' : th === 'space' ? '#dce8ff' : '#c8ecff';
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const f = at(x, y); const { d, ny, a } = f;
        const b = bayer(x, y);
        // where the dome's edge runs off the bottom of the yard (round the gate), its glass fades away
        if (d < -1.2) { const o = y - ny * d - H; if (o > 0 && b >= 1 - o / 4) continue; }
        if (k === 'heat') {
          const T = ringW(f);
          if (d > T) { px(x, y, beyond(th, x, y, d - T, seed)); continue; }
          if (d > 0) {
            // two courses of dark stone blocks, lit orange on the outside by the lava
            const along = arcAt(a); const course = d < T * 0.5 ? 0 : 1; const u = along + course * 4;
            const blk = Math.floor(u / 8); const tone = h2(blk, course, 5);
            const edge = u % 8 < 1 || (course === 1 && d - T * 0.5 < 0.9);
            let c = edge ? '#1e1218' : tone < 0.3 ? '#3a2a30' : tone < 0.7 ? '#4a3438' : '#584046';
            if (!edge && course === 0 && d < 1) c = '#7a6268'; // the top edge catching the light
            else if (!edge && d > T - 1.4) c = mix(c, '#ff7a2a', b < 0.5 ? 0.45 : 0.3);
            else if (!edge && b < 0.12) c = mix(c, '#7a6268', 0.5);
            px(x, y, c);
            continue;
          }
          // the crystal: a thick pale frame of panes, ribbed, with a cool mist inside
          const along = arcAt(a);
          if (d > -1.2) { px(x, y, rgba('#eefcff', 0.7)); continue; }
          if (d > -3) { px(x, y, rgba('#bfeaff', 0.45)); continue; }
          if (d > -15 && along % 22 < 1) { px(x, y, rgba('#e4f8ff', 0.5 - (-d - 3) * 0.02)); continue; }
          if (d > -15.6 && d <= -14.4) { px(x, y, rgba('#d8f4ff', b < 0.5 ? 0.42 : 0.24)); continue; }
          if (d > -14.4) {
            // the panes themselves: faintly frosted, lighter at their tops
            if (b < 0.3 + (d + 14) * 0.03) px(x, y, rgba('#c8ecff', 0.2));
            continue;
          }
          if (d > -24 && b < 0.22 * (24 + d) / 9) px(x, y, rgba('#d0f0ff', 0.14));
          continue;
        }
        // the bubble
        if (d > 0) {
          let c = beyond(th, x, y, d, seed);
          if (d < 2.5 && b < (2.5 - d) / 3) c = mix(c, '#cfefff', 0.3); // a halo round the film
          px(x, y, c);
          continue;
        }
        const hue = (a * 180) / Math.PI * 1.4 + 210;
        if (d > -1.2) { px(x, y, rgba(hsl(hue, 0.85, 0.86), 0.85)); continue; }
        if (d > -2.4) { px(x, y, rgba(hsl(hue + 30, 0.7, 0.8), 0.45)); continue; }
        if (d > -5 && b < (5 + d) / 2.6 * 0.6) { px(x, y, rgba(hsl(hue + 50, 0.6, 0.86), 0.28)); continue; }
        if (d > -16 && b < 0.2 * (16 + d) / 11) px(x, y, rgba(tint, 0.16));
      }
    }
    // the shine: a long tapering highlight round the top left, a short one inside it, one at the bottom right
    const arcs = k === 'heat'
      ? [[-2.95, -1.75, -7, 1.6, 0.75], [-2.6, -2.15, -11.5, 0.8, 0.5], [0.12, 0.62, -6.5, 1, 0.4]]
      : [[-2.95, -1.75, -7.5, 1.8, 0.82], [-2.55, -2.2, -12, 0.9, 0.5], [0.12, 0.62, -6.5, 1.1, 0.38]];
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const { d, a } = at(x, y);
        if (d > -4 || d < -15) continue;
        for (const [a0, a1, mid, wide, alpha] of arcs) {
          if (a < a0 || a > a1) continue;
          const t = Math.sin(Math.PI * (a - a0) / (a1 - a0)); // 0 at the tips, 1 in the middle
          const half = 0.35 + wide * t;
          const off = Math.abs(d - mid);
          if (off > half) continue;
          const bb = bayer(x, y);
          if (off < half - 0.6 || bb < 0.5) px(x, y, `rgba(255,255,255,${(alpha * (0.55 + 0.45 * t)).toFixed(2)})`);
        }
      }
    }
    const star = (x, y, big) => {
      px(x, y, 'rgba(255,255,255,0.95)');
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) px(x + dx, y + dy, 'rgba(255,255,255,0.6)');
      if (big) for (const [dx, dy] of [[2, 0], [-2, 0], [0, 2], [0, -2]]) px(x + dx, y + dy, 'rgba(255,255,255,0.25)');
    };
    star(...rimPoint(-2.35, 7.5), true);
    star(...rimPoint(-1.9, 7.5), false);
    star(...rimPoint(0.4, 6.5), false);
    // a faint sheen across the top of the dome
    for (let y = 0; y < 90; y += 1) for (let x = 0; x < W; x += 1) {
      const s = x + y * 1.6;
      if (((s > 70 && s < 100) || (s > 108 && s < 116)) && at(x, y).d < -8 && bayer(x, y) < 0.1) px(x, y, 'rgba(255,255,255,0.14)');
    }
    beyondExtras(px, th, out, seed);
    const c = newCanvas(W, H, doc);
    pb.put(c.getContext('2d'));
    c.ax = 0; c.ay = 0;
    return c;
  });
}
