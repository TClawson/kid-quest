// Real seasons on every map, in pictures (seasons.js says which season it is and how far in).
//
// The villages, the garden behind the buddy's house and the family's own trees and flowers are
// painted once; this recolours them for the season, palette-aware and one village pixel at a time
// (never finer, never smoothed), and makes the weather that drifts over them:
//   spring: fresher, brighter greens, blossom on the trees, petals and now and then a shower;
//   summer: as painted, a touch warmer;
//   autumn: the trees turn gold, orange and red a little more each week, leaves on the grass and
//     drifting down;
//   winter: a light dusting of snow on everything that faces up (roof tops, tree crowns, fence
//     rails, the ground in drifts), frosted grass, ice at the edge of ponds, snow falling.
// Maps where snow doesn't fit get their own: under the sea the water turns cooler and bluer and
// marine snow drifts down and settles; on the moon and in the galaxy, frost on the rims and
// sparkles (and a meteor shower in autumn); on the volcano, snow on the cool rock but none near
// the lava, with steam rising off it, and ash flurries in autumn; on the beach, a little snow on
// the sand.
//
//   seasonTint(canvas, season, mapId, progress)   the painted village (or the garden yard, mapId
//       'garden') for the season: a NEW canvas, the same size. Cached per source canvas, season and
//       progress (in fifths), so call it as often as you like; the source must not change after.
//   seasonSprite(canvas, season, progress, mapId) the same for a standing piece (a tree, a flower,
//       a house piece, a decoration): a NEW canvas with the same anchor (ax, ay). Cached per
//       source canvas, season and progress.
//   weather(season, mapId)                       what drifts over the map: { kind, count, ..., layers }
//   particleArt(kind, frame, variant)            the tiny sprites (snowflakes, leaves, petals ...)
//   stepParticles(state, dt, W, H, weather, o)   moves them (state starts as {}); o: { scale, reduce }
//   drawParticles(ctx, state)                    draws them (clears the canvas first)
// Everything comes from fixed seeds: the same day looks the same each time.

import { h2, vnoise, bayer, rng } from './pixelkit.js';
import { villageLayout } from './villagemaps.js';
import { PROPS, waterDepth } from './villageprops.js';

export const SEASON_KINDS = ['spring', 'summer', 'autumn', 'winter'];

// ---------- colour ----------

function toHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  let h = 0; let s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360; s = Math.max(0, Math.min(1, s)); l = Math.max(0, Math.min(1, l));
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return pack((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : Math.round(v));
const pack = (r, g, b) => (clamp8(r) << 16) | (clamp8(g) << 8) | clamp8(b);
const hex = (s) => parseInt(s.slice(1), 16);
const R = (c) => (c >> 16) & 255; const G = (c) => (c >> 8) & 255; const B = (c) => c & 255;
const mixc = (a, b, t) => pack(R(a) + (R(b) - R(a)) * t, G(a) + (G(b) - G(a)) * t, B(a) + (B(b) - B(a)) * t);
const hueTo = (h, target, t) => { const d = ((target - h + 540) % 360) - 180; return h + d * t; };
const smooth = (a, b, v) => { const t = Math.max(0, Math.min(1, (b === a ? 1 : (v - a) / (b - a)))); return t * t * (3 - 2 * t); };
const ramp = (...cs) => cs.map(hex);
/** Winter light: a little greyer and bluer (in RGB, so warm whites don't go pink on the way round the hue wheel). */
const chill = (c, k) => {
  let r = R(c); let g = G(c); let b = B(c); const y = 0.299 * r + 0.587 * g + 0.114 * b;
  r += (y - r) * 0.3 * k; g += (y - g) * 0.3 * k; b += (y - b) * 0.3 * k;
  return pack(r * (1 - 0.08 * k), g * (1 - 0.02 * k), b + (255 - b) * 0.07 * k);
};
const dim = (c, k) => pack(R(c) * k, G(c) * k, B(c) * k);

// what a colour is made of, roughly: by hue and lightness (each map's own palette is hand-picked,
// so these broad families are enough to tell leaves from water from lava)
const C_DARK = 1; const C_GREEN = 2; const C_BLUE = 3; const C_HOT = 4; const C_WARM = 5; const C_GREY = 6; const C_PASTEL = 7;
function classify(h, s, l, y, r) {
  if (y < 0.15 && l < 0.2) return C_DARK;
  if ((h <= 50 || h >= 350) && s > 0.68 && l > 0.42 && l < 0.75 && r > 200) return C_HOT;
  if (h >= 58 && h <= 172 && s >= 0.14 && l > 0.07 && l < 0.93) return C_GREEN;
  if (h > 172 && h <= 258 && s >= 0.2) return C_BLUE;
  if (l > 0.74 && s > 0.45) return C_PASTEL;
  if ((h < 58 || h >= 330) && s >= 0.16) return C_WARM;
  return C_GREY;
}

// ---------- the palettes the seasons paint with ----------

// the snow: [highlight on top, body, shade, shadow underneath], per map
const SNOW = {
  plain: ramp('#ffffff', '#eef3fa', '#d6e0f0', '#b8c6de'),
  sugar: ramp('#ffffff', '#fbf3fa', '#eedff2', '#d8c6e6'), // Rainbow Land: powdered sugar
  ashy: ramp('#ffffff', '#f0eef2', '#d8d4e0', '#b8b2c6'), // the volcano's snow, a little grey in the shade
  sand: ramp('#ffffff', '#f6f4f4', '#e2dee6', '#c8c2d2'), // on the beach, warm-shadowed
  marine: ramp('#e8f6fc', '#cfe6f2', '#a8cce2', '#8ab4d4'), // marine snow, settled
  frost: ramp('#f4fcff', '#d4ecf8', '#a8cce6', '#8cb0d8'), // moon frost
  starfrost: ramp('#fbf8ff', '#e2dcfa', '#beb2ee', '#9c8ee0'), // galaxy frost
};
// autumn leaf families, dark .. light (each turned tree picks one; the leaf's own light picks the shade)
const AUTUMN = [
  ramp('#5a3a22', '#86561c', '#b8801e', '#e0aa28', '#f6d04a', '#fff09a'), // gold
  ramp('#5a2a20', '#8a3c1c', '#bc5a22', '#e27e2e', '#f6a64c', '#ffd28a'), // orange
  ramp('#4a1a28', '#76222e', '#a63236', '#d04a40', '#ec7454', '#ffa886'), // red
  ramp('#3e2428', '#64382a', '#8a5030', '#ae6e3a', '#cc9250', '#e6b878'), // russet
];
// Rainbow Land's candy trees turn to warm pastels
const CANDY_AUTUMN = [
  ramp('#b8604e', '#da7c62', '#f29c7c', '#ffbc98', '#ffd8bc', '#fff0e2'), // peach
  ramp('#b8863a', '#d8a648', '#f0c25c', '#ffd87c', '#ffe8a8', '#fff6d8'), // butterscotch
  ramp('#b04456', '#d4626e', '#ee8486', '#ffa6a0', '#ffc6be', '#ffe4dc'), // coral
  ramp('#9a5a3a', '#c07a4a', '#de9a62', '#f4ba84', '#ffd6aa', '#fff0d6'), // caramel
];
// under the sea, kelp and sea grass go golden brown
const KELP = ramp('#3a2e1a', '#5e4a22', '#86702c', '#ab9238', '#ccb24a', '#e8d27a');
// spring blossom: [shade, petal, light]
const BLOSSOM = [ramp('#e07aa4', '#f7a8c6', '#ffdcea'), ramp('#d8a8c8', '#fff0f6', '#ffffff'), ramp('#c890e0', '#e8c4f6', '#f8ecff')];
const SPECKS = ramp('#ffffff', '#ffe066', '#ffb0cc', '#c8a8ff');
const BARE = ramp('#5e4a56', '#76606a', '#8e7880', '#a89298'); // a blossom tree's crown in winter, twigs and all
const ICE = ramp('#e8f4fc', '#c4e0f2', '#a4cce8');

// ---------- each map ----------
// snow: how much settles (0 for maps with their own winter); lava: snow stays off the hot rock;
// autumn: how far the trees turn; ground: how the ground itself changes; blossom; leaves: how
// many fall on the ground.
const MAPS = {
  'bg-meadow': { snow: 1, pal: 'plain', autumn: 1, ground: 'grass', blossom: 1, leaves: 1, ice: true, band: 24 },
  'bg-castle': { snow: 1, pal: 'plain', autumn: 1, ground: 'grass', blossom: 1, leaves: 1, ice: true },
  'bg-rainforest': { snow: 0.85, pal: 'plain', autumn: 0.75, ground: 'grass', blossom: 0.9, leaves: 1, ice: true },
  // the fjord paints its own land for each season; this is for its sprites and weather (spruce stay green)
  'bg-fjord': { snow: 1, pal: 'plain', autumn: 0.3, ground: 'grass', blossom: 0, leaves: 0.2, ice: true },
  'bg-sunset': { snow: 0.6, pal: 'sand', autumn: 0.35, ground: 'sand', blossom: 0, leaves: 0.25, ice: true },
  'bg-volcano': { snow: 0.95, pal: 'ashy', autumn: 0.9, ground: 'ash', blossom: 0.8, leaves: 0.7, lava: true, band: 38 },
  'bg-rainbow': { snow: 1, pal: 'sugar', autumn: 1, ground: 'candy', blossom: 0.8, leaves: 1, candy: true, band: 30 },
  'bg-ocean': { snow: 0, pal: 'marine', autumn: 0.8, ground: 'sea', blossom: 0, leaves: 0, sea: true, band: 22 },
  'bg-space': { snow: 0, pal: 'frost', autumn: 0.35, ground: 'moon', blossom: 0.4, leaves: 0, frost: true },
  'bg-galaxy': { snow: 0, pal: 'starfrost', autumn: 0.3, ground: 'stars', blossom: 0.4, leaves: 0, frost: true },
  garden: { snow: 1, pal: 'plain', autumn: 1, ground: 'grass', blossom: 1, leaves: 1, ice: true },
};
const cfgOf = (mapId) => MAPS[mapId] || MAPS['bg-meadow'];

// how the season goes on: autumn turns step by step; the first snow is light, the deepest in
// the middle of winter, and a little thinner by the end of February
const turned = (p) => 0.1 + 0.86 * smooth(0, 0.85, p);
const snowAmount = (p) => 0.62 + 0.38 * smooth(0, 0.5, p) - 0.14 * smooth(0.8, 1, p);
const bloomAmount = (p) => 0.35 + 0.65 * smooth(0, 0.35, p) - 0.55 * smooth(0.7, 1, p);
const bucket = (p) => Math.round(Math.max(0, Math.min(1, Number(p) || 0)) * 5) / 5;

// ---------- cached noise fields ----------

const fields = new Map();
/** One octave of vnoise (pixelkit) over a whole W x H field, added in with weight w (the same numbers, made faster). */
function octave(v, W, H, scale, s, w) {
  const nx = Math.floor((W - 1) / scale) + 2; const ny = Math.floor((H - 1) / scale) + 2;
  const lat = new Float64Array(nx * ny);
  for (let j = 0; j < ny; j += 1) for (let i = 0; i < nx; i += 1) lat[j * nx + i] = h2(i, j, s);
  const IX = new Int32Array(W); const SX = new Float64Array(W);
  for (let x = 0; x < W; x += 1) { const f = x / scale; const ix = Math.floor(f); const t = f - ix; IX[x] = ix; SX[x] = t * t * (3 - 2 * t); }
  for (let y = 0; y < H; y += 1) {
    const f = y / scale; const iy = Math.floor(f); const t = f - iy; const sy = t * t * (3 - 2 * t);
    const r0 = iy * nx; const r1 = r0 + nx; const row = y * W;
    for (let x = 0; x < W; x += 1) {
      const ix = IX[x]; const sx = SX[x];
      const a = lat[r0 + ix]; const b = lat[r0 + ix + 1]; const c = lat[r1 + ix]; const d = lat[r1 + ix + 1];
      v[row + x] += (a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy) * w;
    }
  }
}
/** A W x H field of soft noise, 0..1, with features about `scale` px across, plus its sorted sample. */
function field(W, H, kind) {
  const key = `${W}x${H}:${kind}`;
  let f = fields.get(key);
  if (f) return f;
  const [a, b, c, s] = { drift: [22, 9, 4, 11], cluster: [16, 7, 0, 23], turn: [20, 8, 0, 37], fine: [5, 2, 0, 41], roof: [9, 4, 2, 53], small: [11, 5, 2, 61] }[kind];
  const acc = new Float64Array(W * H);
  octave(acc, W, H, a, s, 0.58); octave(acc, W, H, b, s + 1, 0.3);
  if (c) octave(acc, W, H, c, s + 2, 0.12);
  else for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) acc[y * W + x] += h2(x, y, s + 3) * 0.12;
  const v = Float32Array.from(acc);
  const sample = new Float32Array(Math.ceil(v.length / 7));
  for (let i = 0, j = 0; i < v.length; i += 7, j += 1) sample[j] = v[i];
  sample.sort();
  f = { v, sample };
  if (fields.size > 24) fields.delete(fields.keys().next().value);
  fields.set(key, f);
  return f;
}
/** The value a share `c` of the field lies above. */
const above = (f, c) => (c <= 0 ? 2 : c >= 1 ? -1 : f.sample[Math.min(f.sample.length - 1, Math.floor((1 - c) * f.sample.length))]);

// ---------- where things are on each map ----------

const Z_OPEN = 0; const Z_TREE = 1; const Z_PROP = 2; const Z_HOUSE = 3; const Z_KEEP = 4;
const F_WATER = 1; const F_LAVA = 2; const F_PATH = 4; const F_BRIDGE = 8; const F_NOICE = 16; const F_ROOF = 32; const F_SOLID = 64;
const TREEISH = new Set(['tree', 'bush', 'palm', 'jungletree', 'fern', 'candytree', 'kelp', 'garden', 'bigflower', 'dragonfruit', 'bromeliad', 'orchids']);

// the garden behind the buddy's house (gardenart.js YARD: 320 x 184, the house's back wall down
// to y 50, raised beds, a path down the middle, the fence along the bottom)
const YARD_BEDS = [[90, 60], [176, 60], [90, 98], [176, 98], [90, 136], [176, 136]];
function gardenPlan(W, H, zone, flag, roof) {
  const box = (x, y, w, h, z, f = 0) => { for (let yy = Math.max(0, y); yy < Math.min(H, y + h); yy += 1) for (let xx = Math.max(0, x); xx < Math.min(W, x + w); xx += 1) { const i = yy * W + xx; if (z !== undefined) zone[i] = z; flag[i] |= f; } };
  box(150, 50, 20, H - 50, undefined, F_PATH);
  box(24, 0, 272, 52, Z_HOUSE, F_SOLID); // the back of the house (all house: its straw is the path's colour, its moss the grass's)
  for (let y = 0; y < 30; y += 1) for (let x = 24; x < 296; x += 1) { flag[y * W + x] |= F_ROOF; roof[y * W + x] = 1 + Math.round((y / 30) * 254); }
  for (const [x, y] of YARD_BEDS) box(x - 1, y - 1, 56, 26, Z_PROP);
  box(0, 0, 10, H, Z_PROP); box(W - 10, 0, 10, H, Z_PROP); // side fences
  box(0, 164, W, H - 164, Z_PROP); // the bottom fence and gate
}

const plans = new Map();
function planFor(mapId, W, H) {
  const key = `${mapId}|${W}x${H}`;
  let P = plans.get(key);
  if (P) return P;
  const zone = new Uint8Array(W * H); const flag = new Uint8Array(W * H); const roof = new Uint8Array(W * H);
  const box = (x, y, w, h, z, only) => {
    x = Math.round(x); y = Math.round(y);
    for (let yy = Math.max(0, y); yy < Math.min(H, y + Math.round(h)); yy += 1) {
      for (let xx = Math.max(0, x); xx < Math.min(W, x + Math.round(w)); xx += 1) {
        const i = yy * W + xx;
        if (only === undefined || zone[i] === only) zone[i] = z;
      }
    }
  };
  let L = null;
  if (mapId === 'garden' || mapId === 'garden-dome') gardenPlan(W, H, zone, flag, roof);
  else {
    L = villageLayout(mapId);
    if (L.id !== mapId || L.W !== W || L.H !== H) L = null;
  }
  if (L) {
    for (const q of L.props) {
      const sz = PROPS[q.kind];
      if (!sz || sz.flat) continue;
      box(q.x - 1, q.y - 1, (q.w || sz.w) + 2, (q.h || sz.h) + 2, TREEISH.has(q.kind) ? Z_TREE : Z_PROP);
    }
    // a wall of trees round the edge, drawn by the map's own painter
    const band = cfgOf(mapId).band || 0;
    if (band) {
      const sides = L.border?.sides || ['top', 'bottom', 'left', 'right'];
      if (sides.includes('top')) box(0, 0, W, band, Z_TREE, Z_OPEN);
      if (sides.includes('bottom')) box(0, H - band, W, band, Z_TREE, Z_OPEN);
      if (sides.includes('left')) box(0, 0, band, H, Z_TREE, Z_OPEN);
      if (sides.includes('right')) box(W - band, 0, band, H, Z_TREE, Z_OPEN);
    }
    for (const b of L.crossings) {
      box(b.x - 1, b.y - 1, b.w + 2, b.h + 2, Z_PROP);
      for (let y = Math.max(0, Math.round(b.y)); y < Math.min(H, b.y + b.h); y += 1) for (let x = Math.max(0, Math.round(b.x)); x < Math.min(W, b.x + b.w); x += 1) flag[y * W + x] |= F_BRIDGE;
    }
    for (const h of [L.home, ...L.houses]) {
      box(h.x - 4, h.y - 16, h.w + 8, h.h + 20, Z_HOUSE);
      const top = h.y - 16; const roofBottom = h.y + h.h * (h.style === 'stilts' ? 0.42 : h.style === 'keep' ? 0.3 : 0.5);
      for (let y = Math.max(0, top); y < Math.min(H, roofBottom); y += 1) {
        for (let x = Math.max(0, h.x - 4); x < Math.min(W, h.x + h.w + 4); x += 1) { flag[y * W + x] |= F_ROOF; roof[y * W + x] = 1 + Math.round(((y - top) / (roofBottom - top)) * 254); }
      }
    }
    if (L.falls) box(L.falls.cliff[0] - 8, 0, L.falls.cliff[1] - L.falls.cliff[0] + 16, L.falls.base, Z_PROP);
    for (const k of ['left', 'right']) { const g = L.green[k]; box(g.x - 4, g.y - 4, g.w + 8, g.h + 8, Z_KEEP, Z_OPEN); }
    for (const wa of L.water) {
      const pad = wa.w / 2 + 4;
      const bits = F_WATER | (wa.kind === 'lava' ? F_LAVA : 0) | (wa.kind !== 'river' ? F_NOICE : 0);
      // a band is in the water where any one of its stretches is (the same as waterDepth over the whole line)
      for (let k = 1; k < wa.pts.length; k += 1) {
        const [a, b] = [wa.pts[k - 1], wa.pts[k]]; const one = { w: wa.w, pts: [a, b] };
        for (let y = Math.max(0, Math.floor(Math.min(a[1], b[1]) - pad)); y < Math.min(H, Math.ceil(Math.max(a[1], b[1]) + pad)); y += 1) {
          for (let x = Math.max(0, Math.floor(Math.min(a[0], b[0]) - pad)); x < Math.min(W, Math.ceil(Math.max(a[0], b[0]) + pad)); x += 1) {
            const i = y * W + x;
            if ((flag[i] & F_BRIDGE) || (flag[i] & bits) === bits) continue;
            if (waterDepth(one, x, y) > -0.5) flag[i] |= bits;
          }
        }
      }
      if (wa.pts.length === 1) {
        const [a] = wa.pts;
        for (let y = Math.max(0, Math.floor(a[1] - pad)); y < Math.min(H, Math.ceil(a[1] + pad)); y += 1) {
          for (let x = Math.max(0, Math.floor(a[0] - pad)); x < Math.min(W, Math.ceil(a[0] + pad)); x += 1) {
            const i = y * W + x;
            if (!(flag[i] & F_BRIDGE) && waterDepth(wa, x, y) > -0.5) flag[i] |= bits;
          }
        }
      }
    }
    // paths and plazas (trodden: less snow settles)
    const seg = (x, y, [x0, y0], [x1, y1]) => { const dx = x1 - x0; const dy = y1 - y0; const l = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l)); return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy)); };
    for (const pts of L.paths) {
      for (let k = 1; k < pts.length; k += 1) {
        const [a, b] = [pts[k - 1], pts[k]];
        for (let y = Math.max(0, Math.min(a[1], b[1]) - 7); y < Math.min(H, Math.max(a[1], b[1]) + 7); y += 1) {
          for (let x = Math.max(0, Math.min(a[0], b[0]) - 7); x < Math.min(W, Math.max(a[0], b[0]) + 7); x += 1) if (seg(x + 0.5, y + 0.5, a, b) < 6.5) flag[y * W + x] |= F_PATH;
        }
      }
    }
    for (const [px, py, r] of L.plazas) {
      for (let y = Math.max(0, py - r - 2); y < Math.min(H, py + r + 2); y += 1) for (let x = Math.max(0, px - r - 2); x < Math.min(W, px + r + 2); x += 1) if (Math.hypot(x + 0.5 - px, y + 0.5 - py) < r + 1) flag[y * W + x] |= F_PATH;
    }
  }
  P = { zone, flag, roof, W, H, nearV: null, layout: !!L || mapId === 'garden' || mapId === 'garden-dome' };
  if (plans.size > 12) plans.delete(plans.keys().next().value);
  plans.set(key, P);
  return P;
}

/** How near a tree each pixel is (leaves fall under trees), 0..1; worked out the first time it's asked for. */
function nearOf(P) {
  if (P.nearV) return P.nearV;
  const { zone, W, H } = P;
  const near = new Float32Array(W * H);
  {
    const r = 12; const tmp = new Float32Array(W * H);
    for (let y = 0; y < H; y += 1) {
      let s = 0;
      for (let x = -r; x < W; x += 1) {
        if (x + r < W && zone[y * W + x + r] === Z_TREE) s += 1;
        if (x - r - 1 >= 0 && zone[y * W + x - r - 1] === Z_TREE) s -= 1;
        if (x >= 0) tmp[y * W + x] = s;
      }
    }
    for (let x = 0; x < W; x += 1) {
      let s = 0;
      for (let y = -r; y < H; y += 1) {
        if (y + r < H) s += tmp[(y + r) * W + x];
        if (y - r - 1 >= 0) s -= tmp[(y - r - 1) * W + x];
        if (y >= 0) near[y * W + x] = Math.min(1, s / ((2 * r + 1) * (2 * r + 1) * 0.35));
      }
    }
  }
  P.nearV = near;
  return near;
}

/** Distance (in px, roughly) from each pixel to the nearest hot one (lava, fire), capped. */
function heatField(W, H, hot) {
  const D = new Float32Array(W * H).fill(99);
  for (let i = 0; i < W * H; i += 1) if (hot[i]) D[i] = 0;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const i = y * W + x; let d = D[i];
      if (x > 0) d = Math.min(d, D[i - 1] + 1);
      if (y > 0) { d = Math.min(d, D[i - W] + 1); if (x > 0) d = Math.min(d, D[i - W - 1] + 1.4); if (x < W - 1) d = Math.min(d, D[i - W + 1] + 1.4); }
      D[i] = d;
    }
  }
  for (let y = H - 1; y >= 0; y -= 1) {
    for (let x = W - 1; x >= 0; x -= 1) {
      const i = y * W + x; let d = D[i];
      if (x < W - 1) d = Math.min(d, D[i + 1] + 1);
      if (y < H - 1) { d = Math.min(d, D[i + W] + 1); if (x < W - 1) d = Math.min(d, D[i + W + 1] + 1.4); if (x > 0) d = Math.min(d, D[i + W - 1] + 1.4); }
      D[i] = d;
    }
  }
  return D;
}

// ---------- the recolouring ----------

const M_OUT = 0; const M_GROUND = 1; const M_THING = 2; const M_PROP = 3; const M_HOUSE = 4; const M_WATER = 5; const M_LAVA = 6;

/**
 * Recolours RGBA pixels (W x H) in place for the season. plan: where things are (null for a
 * sprite: everything in it stands up). Returns nothing; data is changed.
 */
function recolour(data, W, H, season, mapId, p, plan, seed) {
  const cfg = cfgOf(mapId);
  const N = W * H;
  const sprite = !plan;
  // the colours in the picture, each worked out once
  const idx = new Int32Array(N).fill(-1);
  const pal = []; const palIdx = new Map();
  let lastC = -1; let lastK = -1;
  for (let i = 0; i < N; i += 1) {
    if (data[i * 4 + 3] < 24) continue;
    const c = (data[i * 4] << 16) | (data[i * 4 + 1] << 8) | data[i * 4 + 2];
    if (c === lastC) { idx[i] = lastK; continue; }
    let k = palIdx.get(c);
    if (k === undefined) {
      const r = data[i * 4]; const g = data[i * 4 + 1]; const b = data[i * 4 + 2];
      const [h, s, l] = toHsl(r, g, b); const y = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      k = pal.length; palIdx.set(c, k);
      pal.push({ c, h, s, l, y, cls: classify(h, s, l, y, r), n: 0, nOpen: 0 });
    }
    idx[i] = k; lastC = c; lastK = k;
  }
  {
    const n = new Int32Array(pal.length);
    for (let i = 0; i < N; i += 1) { const k = idx[i]; if (k >= 0) n[k] += 1; }
    for (let k = 0; k < pal.length; k += 1) pal[k].n = n[k];
  }
  // a blossom tree (bloomart.js) drops its blossom by autumn: those pinks turn like leaves, and in winter hold snow
  if (sprite && H > 26 && H <= 90 && !cfg.candy && !cfg.sea && !cfg.frost && (season === 'autumn' || season === 'winter')) {
    for (const e of pal) if ((e.h >= 290 || e.h <= 14) && e.s > 0.3 && e.l > 0.55 && e.l < 0.97) e.blossom = true;
  }
  const zone = plan ? plan.zone : null; const flag = plan ? plan.flag : null;
  // the ground's own colours: the common ones out in the open
  const ground = new Uint8Array(pal.length);
  if (plan) {
    let open = 0;
    const n = new Int32Array(pal.length);
    for (let i = 0; i < N; i += 1) { const k = idx[i]; if (k >= 0 && zone[i] === Z_OPEN && !(flag[i] & F_WATER)) { n[k] += 1; open += 1; } }
    for (let k = 0; k < pal.length; k += 1) pal[k].nOpen = n[k];
    const order = pal.map((e, k) => k).filter((k) => pal[k].nOpen > 0).sort((a, b) => pal[b].nOpen - pal[a].nOpen);
    let acc = 0;
    for (const k of order) {
      if (acc > open * 0.985 || pal[k].nOpen < open * 0.0004) break;
      if (pal[k].cls === C_HOT) continue;
      ground[k] = 1; acc += pal[k].nOpen;
    }
  }
  // ground colours among a house's or a tree's own are only ground where most round them are too
  let crowd = null;
  if (plan) {
    const sat = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y += 1) {
      let row = 0;
      for (let x = 0; x < W; x += 1) { const k = idx[y * W + x]; row += k >= 0 && ground[k] ? 1 : 0; sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row; }
    }
    crowd = (x, y) => {
      const x0 = Math.max(0, x - 2); const y0 = Math.max(0, y - 2); const x1 = Math.min(W, x + 3); const y1 = Math.min(H, y + 3);
      return (sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0]) / ((x1 - x0) * (y1 - y0));
    };
  }
  // and on a house, only where they run on from the ground outside it, colour into like colour
  // (the white spots on a mushroom roof, or straw thatch the colour of a sandy path, are shut in)
  let joined = null;
  if (plan) {
    joined = new Uint8Array(N);
    const from = new Int32Array(N); // the outside colour each run started from (so a run can't drift through a gradient)
    const todo = [];
    const like = (a, b) => {
      if (a === b) return true;
      if (a < 0 || b < 0 || !ground[a] || !ground[b]) return false;
      const A = pal[a]; const B = pal[b];
      const dh = Math.abs(((A.h - B.h + 540) % 360) - 180);
      return Math.abs(A.y - B.y) < 0.15 && (dh < 30 || (A.s < 0.15 && B.s < 0.15));
    };
    for (let i = 0; i < N; i += 1) {
      if (zone[i] !== Z_HOUSE || idx[i] < 0 || !ground[idx[i]]) continue;
      const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || zone[j] === Z_HOUSE || !like(idx[j], idx[i])) continue;
        joined[i] = 1; from[i] = idx[j]; todo.push(i); break;
      }
    }
    while (todo.length) {
      const i = todo.pop(); const x = i % W;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, i - W, i + W]) {
        if (j < 0 || j >= N || joined[j] || zone[j] !== Z_HOUSE || !like(from[i], idx[j])) continue;
        joined[j] = 1; from[j] = from[i]; todo.push(j);
      }
    }
  }
  // what each pixel is
  const mat = new Uint8Array(N);
  for (let i = 0; i < N; i += 1) {
    const k = idx[i];
    if (k < 0) { mat[i] = M_OUT; continue; }
    if (sprite) { mat[i] = M_THING; continue; }
    const f = flag[i]; const z = zone[i];
    if (f & F_LAVA) mat[i] = M_LAVA;
    else if (f & F_WATER) mat[i] = pal[k].cls === C_DARK ? M_THING : M_WATER;
    else if (ground[k] && (z === Z_OPEN || (z === Z_HOUSE ? joined[i] === 1 && !(f & F_SOLID) : z !== Z_TREE || !cfg.wall) && crowd(i % W, (i / W) | 0) >= 0.5)) mat[i] = M_GROUND;
    else if (z === Z_HOUSE) mat[i] = M_HOUSE;
    else if (z === Z_PROP) mat[i] = M_PROP;
    else if (z === Z_KEEP) mat[i] = pal[k].cls === C_BLUE ? M_WATER : M_PROP;
    else mat[i] = M_THING;
  }
  // foliage brightness range, so turned leaves keep their light and shade
  let fLo = 1; let fHi = 0;
  {
    const ys = [];
    for (let k = 0; k < pal.length; k += 1) if (isLeaf(pal[k], cfg, { sprite, H }) && !ground[k]) for (let j = 0; j < Math.min(pal[k].n, 40); j += 1) ys.push(pal[k].y);
    ys.sort((a, b) => a - b);
    if (ys.length) { fLo = ys[Math.floor(ys.length * 0.03)]; fHi = ys[Math.floor(ys.length * 0.97)]; }
    if (fHi - fLo < 0.2) { const m = (fHi + fLo) / 2; fLo = m - 0.1; fHi = m + 0.1; }
  }
  // a sprite's leaves: a full round crown (a tree that can blossom and turn) or sparse fronds (a palm, a fern)
  let crown = true;
  if (sprite) {
    let n = 0; let x0 = W; let x1 = -1; let y0 = H; let y1 = -1;
    for (let i = 0; i < N; i += 1) {
      if (idx[i] < 0 || pal[idx[i]].cls !== C_GREEN) continue;
      const x = i % W; const y = (i / W) | 0; n += 1;
      if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
    }
    crown = n > 0 && n / ((x1 - x0 + 1) * (y1 - y0 + 1)) > 0.5;
  }
  const ctx = { data, W, H, N, idx, pal, mat, zone, flag, plan, cfg, mapId, p, sprite, seed, fLo, fHi, ground, crown };
  if (season === 'winter') winter(ctx);
  else if (season === 'autumn') autumn(ctx);
  else if (season === 'spring') spring(ctx);
  else summer(ctx);
}

/** Is this colour a leaf's (green; on Rainbow Land the candy trees' pastels too)? */
function isLeaf(e, cfg, X) {
  if (e.blossom) return true;
  if (e.cls === C_GREEN) return !(cfg.frost && e.l > 0.7); // pale mint on the moon is crystal, not leaf
  if (!cfg.candy || (X && X.sprite && (X.H <= 26 || X.H > 90))) return false; // candy flowers and big things keep their colours
  return e.cls === C_PASTEL || (e.s > 0.3 && e.l > 0.55 && e.l < 0.95 && e.cls !== C_HOT);
}

const put = (data, i, c) => { data[i * 4] = R(c); data[i * 4 + 1] = G(c); data[i * 4 + 2] = B(c); };

// a cache of graded colours per (palette entry, recipe: a material 0..7 and a family 0..7)
function grader(pal, fn) {
  const memo = new Int32Array(pal.length * 64).fill(-1);
  return (k, a = 0, b = 0) => {
    const key = k * 64 + a * 8 + b;
    let v = memo[key];
    if (v < 0) { v = fn(pal[k], a, b); memo[key] = v; }
    return v;
  };
}

/**
 * Is this pixel the top edge of something, where snow would sit? 2: its very top (open sky,
 * an ink line or a one-pixel outline above it, the ground behind it); 1: the lit top of a leaf
 * clump under the shaded one above. Texture inside a roof or a wall doesn't count.
 */
function capEdge(X, i, x, y) {
  const { idx, pal, W, mat, sprite } = X;
  const k = idx[i]; if (k < 0) return 0;
  const e = pal[k]; if (e.cls === C_DARK) return 0;
  if (y === 0) return 0;
  const a = idx[i - W];
  if (a < 0) return 2;
  const q = pal[a];
  const m = mat[i]; const ma = mat[i - W];
  // on a house only its outer edge counts, not the ink between rows of tiles or thatch
  if (!sprite && m === M_HOUSE && ma === M_HOUSE && (y < 2 || mat[i - 2 * W] === M_HOUSE)) return 0;
  if (q.cls === C_DARK) return e.y - q.y > 0.06 ? 2 : 0;
  if (!sprite && ma !== m && (ma === M_GROUND || ma === M_WATER)) return e.y > q.y - 0.12 ? 2 : 0;
  if (!sprite && m === M_HOUSE) return 0;
  if (q.y < e.y - 0.07) {
    // a one-pixel line above (an outline): what is above it is lighter, see-through or another thing
    if (y < 2) return 2;
    const b = idx[i - 2 * W];
    if (b < 0 || (!sprite && (mat[i - 2 * W] === M_GROUND || mat[i - 2 * W] === M_WATER))) return 2;
    // a clump's top inside a tree crown (not texture in soil, stone or wood)
    if (pal[b].y > q.y + 0.07 && e.y - q.y > 0.16 && (sprite || X.zone[i] === Z_TREE)) return 1;
  }
  return 0;
}

// ---------- winter ----------

const RIM = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [2, 0, 2], [-2, 0, 2], [0, 2, 2], [0, -2, 2]];

function winter(X) {
  const { data, W, H, N, idx, pal, mat, flag, zone, cfg, p, sprite, mapId } = X;
  const snowPal = SNOW[cfg.pal] || SNOW.plain;
  const sea = !!cfg.sea; const frost = !!cfg.frost;
  const amt = snowAmount(p);
  // the base colours: cooler, the greens dulled to winter evergreens, the ground frosted
  const grade = grader(pal, (e, m) => {
    const { h, s, l } = e;
    if (e.cls === C_DARK) return chill(e.c, 0.5);
    if (e.blossom) return BARE[Math.max(0, Math.min(3, Math.round((e.l - 0.55) * 9)))]; // blossom gone: bare twigs
    if (sea) {
      if (e.cls === C_BLUE) return fromHsl(hueTo(h, 218, 0.35), s * 0.88, l * 0.9);
      if (e.cls === C_GREEN) return fromHsl(hueTo(h, 175, 0.4), s * 0.6, l * 0.92);
      return dim(chill(e.c, 0.6), 0.94);
    }
    if (frost) {
      if (m === M_GROUND) return mixc(chill(e.c, 0.6), 0xdcecfa, 0.07);
      return chill(e.c, 0.4);
    }
    if (m === M_LAVA) return e.c;
    if (m === M_WATER) return e.cls === C_BLUE ? fromHsl(hueTo(h, 212, 0.3), s * 0.8, l * 0.92) : chill(e.c, 0.6);
    if (e.cls === C_GREEN) {
      if (m === M_GROUND) return fromHsl(hueTo(h, 150, 0.45), s * 0.42, l + (0.82 - l) * 0.28);
      return fromHsl(hueTo(h, 162, 0.5), s * 0.55, l * 0.94);
    }
    if (m === M_GROUND) return mixc(chill(e.c, cfg.candy ? 0.5 : 0.7), 0xe8eef8, cfg.candy ? 0.3 : 0.12);
    return chill(e.c, 0.5);
  });
  for (let i = 0; i < N; i += 1) if (idx[i] >= 0) put(data, i, grade(idx[i], mat[i]));

  const snow = new Uint8Array(N); // 1 snow, 2 frost-mix, 3 ice
  // the snow's own texture (the 'fine' field, worked out only where there is snow)
  const fineAt = (x, y) => Math.fround(vnoise(x, y, 5, 41) * 0.58 + vnoise(x, y, 2, 42) * 0.3 + h2(x, y, 44) * 0.12);
  let heat = null;
  if (cfg.lava && !sprite) {
    const hot = new Uint8Array(N);
    // a blob of fire, not a single ember: seven or more fiery pixels in the 5 x 5 round it
    const fiery = new Uint8Array(pal.length); for (let k = 0; k < pal.length; k += 1) fiery[k] = pal[k].cls === C_HOT ? 1 : 0;
    const sat = new Int32Array((W + 1) * (H + 1));
    for (let y = 0; y < H; y += 1) {
      let row = 0;
      for (let x = 0; x < W; x += 1) { const k = idx[y * W + x]; if (k >= 0) row += fiery[k]; sat[(y + 1) * (W + 1) + x + 1] = sat[y * (W + 1) + x + 1] + row; }
    }
    for (let i = 0; i < N; i += 1) {
      if (mat[i] === M_LAVA) { hot[i] = 1; continue; }
      const k = idx[i];
      if (k < 0 || !fiery[k] || zone[i] === Z_HOUSE) continue;
      const x = i % W; const y = (i / W) | 0;
      const x0 = x < 2 ? 0 : x - 2; const y0 = y < 2 ? 0 : y - 2; const x1 = Math.min(W, x + 3); const y1 = Math.min(H, y + 3);
      if (sat[y1 * (W + 1) + x1] - sat[y0 * (W + 1) + x1] - sat[y1 * (W + 1) + x0] + sat[y0 * (W + 1) + x0] >= 7) hot[i] = 1;
    }
    heat = heatField(W, H, hot);
  }
  const cool = (i) => (heat ? smooth(9, 26, heat[i]) : 1);

  if (!sea && !frost) {
    // the ground: frosted, with only small soft drifts here and there; the paths stay clear
    if (!sprite) {
      const f = field(W, H, 'small');
      const base = cfg.snow * (0.045 + 0.065 * amt) * (cfg.ground === 'ash' ? 0.7 : 1);
      const rim = cfg.ground === 'ash' ? 0.35 : 0.7;
      let lastQ = -1; let t = 0; let tLo = 0;
      for (let i = 0; i < N; i += 1) {
        const m = mat[i];
        if (m !== M_GROUND && !(m === M_THING && zone[i] === Z_OPEN)) continue;
        const k = idx[i]; if (pal[k].cls === C_DARK) continue;
        const fl = flag[i];
        let c = base * cool(i);
        if (fl & F_PATH) c *= 0.25;
        if (fl & F_BRIDGE) c *= 0.4;
        if (c <= 0.005) continue;
        const q = Math.round(c * 100);
        if (q !== lastQ) { lastQ = q; t = above(f, q / 100); tLo = above(f, Math.min(1, (q / 100) * 2 + 0.02)); }
        const v = f.v[i];
        if (v > t) { snow[i] = 1; continue; }
        if (v > tLo) { const x = i % W; const y = (i / W) | 0; const r = (v - tLo) / (t - tLo); if (bayer(x, y) < r * r * rim) snow[i] = 1; }
      }
    }
    // thin crisp caps on everything's upward edges: roof ridges, crowns, rails, sills, signs
    const capP = Math.min(1, cfg.snow * (0.7 + 0.3 * amt));
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const m = mat[i];
        if (m === M_OUT || m === M_WATER || m === M_LAVA || m === M_GROUND || snow[i]) continue;
        if (!sprite && (flag[i] & F_PATH)) continue; // trodden paths stay clear
        const edge = capEdge(X, i, x, y);
        if (!edge) continue;
        const e = pal[idx[i]];
        if (e.y > 0.9 && !sprite) continue; // already white (whitewash under the eaves)
        const small = sprite && H <= 26;
        if (small && (edge < 2 || h2(x, y, 75) > 0.5)) continue;
        if (vnoise(x, y, 4, 71) > capP * cool(i) * (edge === 2 ? 1.25 : 0.7)) continue;
        snow[i] = 1;
        // a second row where the top is wide and flat enough to hold it
        const j = i + W;
        if (edge === 2 && !small && y + 1 < H && idx[j] >= 0 && mat[j] === m && pal[idx[j]].cls !== C_DARK && Math.abs(pal[idx[j]].y - e.y) < 0.2 && vnoise(x, y, 6, 73) < 0.25 + 0.3 * amt) snow[j] = 1;
      }
    }
    // roofs: a crisp cap along the ridge and down the slopes, two to four pixels deep
    if (!sprite) {
      const roof = X.plan.roof;
      for (let x = 1; x < W - 1; x += 1) {
        let y = 0;
        while (y < H) {
          if (!roof[y * W + x]) { y += 1; continue; }
          let end = y; while (end < H && roof[end * W + x]) end += 1;
          // the roof's top in this column: up from the walls through the house to where it meets the ground
          let top = -1;
          if (mat[(end - 1) * W + x] === M_HOUSE) {
            top = end - 1; let line = -1;
            while (top > y && mat[(top - 1) * W + x] === M_HOUSE) {
              if (pal[idx[top * W + x]].y < pal[idx[(top - 1) * W + x]].y - 0.2) line = top;
              top -= 1;
            }
            // a shadow on the ground above the roof isn't the roof: the roof starts at its outline
            // (unless the roof runs on off the top of the picture, as the garden's does)
            if (line >= 0 && line - top <= 6 && top > 0) top = line;
          }
          if (top >= 0) {
            const depth = Math.round((2 + 2.4 * vnoise(x, top, 6, 59)) * cfg.snow * (0.75 + 0.25 * amt));
            let got = 0;
            // the roof's own outline stays: start under it
            let yy = top;
            const t0 = idx[top * W + x]; const t1 = top + 1 < H ? idx[(top + 1) * W + x] : -1;
            if (pal[t0].cls === C_DARK || pal[t0].y < 0.3 || (t1 >= 0 && pal[t1].y - pal[t0].y > 0.06)) yy += 1;
            for (; yy < end && got < depth; yy += 1) {
              const i = yy * W + x;
              if (mat[i] !== M_HOUSE) break;
              const e = pal[idx[i]];
              if (e.y > 0.93) break;
              // and so does the outline down the sides
              if (mat[i - 1] !== M_HOUSE || mat[i + 1] !== M_HOUSE) continue;
              snow[i] = 1; got += 1;
            }
          }
          y = end;
        }
      }
    }
    // a very few flakes caught in the leaves
    for (let i = 0; i < N; i += 1) {
      const m = mat[i];
      if (snow[i] || (m !== M_THING && m !== M_PROP)) continue;
      if (!sprite && zone[i] === Z_OPEN) continue;
      const e = pal[idx[i]]; if (e.cls !== C_GREEN && !(cfg.candy && isLeaf(e, cfg, X))) continue;
      const x = i % W; const y = (i / W) | 0;
      if ((e.y - X.fLo) / (X.fHi - X.fLo) > 0.5 && h2(x, y, 79) < 0.035 * amt * cool(i)) snow[i] = 1;
    }
    // ice at the edges of ponds and rivers
    if (cfg.ice && !sprite) {
      for (let y = 2; y < H - 2; y += 1) {
        for (let x = 2; x < W - 2; x += 1) {
          const i = y * W + x;
          if (mat[i] !== M_WATER || (flag[i] & F_NOICE && zone[i] !== Z_KEEP)) continue;
          let edge = 0;
          for (let r = 0; r < 8 && edge !== 1; r += 1) if (mat[i + RIM[r][1] * W + RIM[r][0]] !== M_WATER) edge = edge || RIM[r][2];
          if (edge === 1 || (edge === 2 && bayer(x, y) < 0.25 + amt * 0.25)) snow[i] = 3;
        }
      }
    }
  } else {
    // under the sea: marine snow settles on top of things; on the moon and in the galaxy: frost on the rims
    const capP = sea ? 0.32 + 0.2 * amt : 0.55 + 0.3 * amt;
    for (let y = 0; y < H; y += 1) {
      for (let x = 0; x < W; x += 1) {
        const i = y * W + x; const m = mat[i];
        if (m === M_OUT || m === M_WATER || m === M_LAVA) continue;
        if (!sprite && m === M_GROUND) continue;
        const edge = capEdge(X, i, x, y);
        if (!edge || (sea && edge < 2)) continue;
        if (pal[idx[i]].y > 0.88) continue;
        if (vnoise(x, y, 3, 71) > capP + 0.1) continue;
        snow[i] = 1;
        if (!sea && y + 1 < H && idx[i + W] >= 0 && h2(x, y, 73) < 0.25 * amt && pal[idx[i + W]].cls !== C_DARK) snow[i + W] = 1;
      }
    }
    if (!sprite) {
      const f = field(W, H, 'drift'); const drift = f.v;
      const t = above(f, sea ? 0.0 : 0.32 * amt);
      for (let i = 0; i < N; i += 1) {
        if (mat[i] !== M_GROUND) continue;
        const x = i % W; const y = (i / W) | 0;
        if (sea) { if (h2(x, y, 83) < 0.012 * amt) snow[i] = 1; continue; }
        if (mapId !== 'bg-galaxy' && drift[i] > t && h2(x, y, 87) < 0.08 + (drift[i] - t) * 1.2) snow[i] = 2;
        else if (h2(x, y, 83) < 0.005) snow[i] = 1;
      }
    }
  }

  // shade the snow: bright on top, a cool shadow on the bottom edge
  const S = snowPal;
  for (let i = 0; i < N; i += 1) {
    const s = snow[i]; if (!s) continue;
    const x = i % W; const y = (i / W) | 0;
    if (s === 3) { put(data, i, ICE[(x + y) % 3 === 0 ? 0 : h2(x, y, 5) < 0.4 ? 2 : 1]); continue; }
    if (s === 2) {
      const k = idx[i]; const base = grade(k, mat[i]);
      put(data, i, mixc(base, S[1], 0.5));
      continue;
    }
    const top = y === 0 || !snow[i - W] || snow[i - W] === 3;
    const bot = y === H - 1 || !snow[i + W] || snow[i + W] === 3;
    let c = top ? S[0] : bot ? S[2] : S[1];
    if (!top && !bot && fineAt(x, y) < 0.32) c = S[2];
    if (top && !bot && mat[i] === M_GROUND && fineAt(x, y) > 0.7) c = S[1];
    put(data, i, c);
  }
  // a soft shadow under drifts and caps where they meet what is below
  if (!sea && !frost) {
    for (let i = W; i < N - W; i += 1) {
      if (snow[i] || !snow[i - W] || snow[i - W] === 3 || idx[i] < 0) continue;
      const m = mat[i]; if (m === M_WATER || m === M_LAVA) continue;
      if (m === M_GROUND && h2(i % W, (i / W) | 0, 91) < 0.5) put(data, i, mixc(grade(idx[i], m), S[3], 0.22));
    }
    // frost glints on the bare ground
    if (!sprite) {
      for (let i = 0; i < N; i += 1) {
        if (snow[i] || mat[i] !== M_GROUND) continue;
        const x = i % W; const y = (i / W) | 0;
        const dark = pal[idx[i]].y < 0.4;
        const up = !(flag[i] & F_PATH) && y > 0 && idx[i - W] >= 0 && pal[idx[i]].y - pal[idx[i - W]].y > 0.05;
        if ((up && h2(x, y, 95) < (dark ? 0.2 : 0.55) * cool(i)) || h2(x, y, 97) < (dark ? 0.012 : 0.03) * cfg.snow * cool(i)) put(data, i, mixc(grade(idx[i], M_GROUND), S[1], dark ? 0.35 : 0.55));
      }
    }
  }
  void mapId;
}

// ---------- autumn ----------

function autumn(X) {
  const { data, W, H, N, idx, pal, mat, zone, flag, cfg, p, sprite, seed, fLo, fHi } = X;
  const turn = turned(p) * Math.min(1, cfg.autumn + 0.05);
  const strength = cfg.autumn;
  const cluster = field(W, H, 'cluster'); const turnF = field(W, H, 'turn');
  const fams = cfg.candy ? CANDY_AUTUMN : AUTUMN;
  // which family each patch of trees picks: gold early on, more orange and red as autumn deepens
  const cut = [0.5 - 0.28 * p, 0.8 - 0.12 * p, 0.95 - 0.07 * p];
  const famAt = (v) => (v < cut[0] ? 0 : v < cut[1] ? 1 : v < cut[2] ? 2 : 3);
  const qc = (q) => cluster.sample[Math.min(cluster.sample.length - 1, Math.floor(q * cluster.sample.length))];
  const famCuts = cut.map(qc);
  const shadeOf = (e) => Math.max(0, Math.min(5, Math.round(((e.y - fLo) / (fHi - fLo)) * 4.6 + 0.4)));
  const grade = grader(pal, (e, m, fam) => {
    let { h, s, l } = e;
    if (e.cls === C_DARK) return e.c;
    const leaf = isLeaf(e, cfg, X);
    if (m === M_WATER || m === M_LAVA || m === M_HOUSE) return fromHsl(hueTo(h, 35, 0.04), s, l);
    if (leaf && fam > 0) {
      // a turned leaf: the family's shade at this leaf's light
      if (cfg.sea) return KELP[shadeOf(e)];
      const F = fams[fam - 1];
      const t = shadeOf(e);
      const k = X.crown ? strength : strength * 0.45; // palms and ferns only tinge
      return k >= 0.6 ? F[t] : mixc(fromHsl(hueTo(h, 60, 0.3), s, l), F[t], k * 1.4);
    }
    if (leaf && e.cls === C_GREEN) {
      if (m === M_GROUND) {
        // grass goes olive and golden as autumn goes on
        const k = (cfg.ground === 'grass' ? 0.22 + 0.42 * p : 0.12 + 0.2 * p) * Math.min(1, strength + 0.2);
        return fromHsl(hueTo(h, 46, k), s * (1 - 0.18 * k), l * (1 - 0.04 * k));
      }
      // not turned yet: a little yellower
      return fromHsl(hueTo(h, 72, 0.2 * strength), s * 0.95, l);
    }
    if (leaf && cfg.candy && m === M_GROUND) return fromHsl(hueTo(h, 40, 0.15 + 0.2 * p), s * 0.85, l);
    // everything else in warm low autumn light
    if (cfg.frost) return fromHsl(hueTo(h, 35, 0.06), s, l);
    return fromHsl(hueTo(h, 35, 0.06), s * 1.02, l * 0.99);
  });
  for (let i = 0; i < N; i += 1) {
    const k = idx[i]; if (k < 0) continue;
    const m = mat[i]; const e = pal[k];
    let fam = 0;
    const canTurn = isLeaf(e, cfg, X) && (m === M_THING || (sprite && m === M_THING)) && (!cfg.candy || sprite || zone[i] === Z_TREE);
    if (canTurn) {
      const x = i % W; const y = (i / W) | 0;
      const sx = sprite ? x + seed * 37 : x; const sy = sprite ? y + seed * 11 : y;
      let on;
      if (sprite) {
        // each plant turns as a whole; one on the turn is a speckled mix of green and gold
        const v = turn - h2(seed, 1, 5);
        on = v > 0.12 || (v > -0.12 && h2(sx >> 1, sy >> 1, 37) < (v + 0.12) / 0.24);
      } else {
        // turned patches, with a dithered edge where green gives way
        const v = turnF.v[i] - above(turnF, turn);
        on = v > 0 || (v > -0.035 && bayer(x, y) < (v + 0.035) / 0.035);
      }
      if (on) {
        const cv = sprite ? h2(seed, 2, 7) : cluster.v[i];
        fam = 1 + (sprite ? (H <= 52 && !cfg.candy ? (cv < 0.6 ? 0 : 3) : famAt(cv)) : (cv < famCuts[0] ? 0 : cv < famCuts[1] ? 1 : cv < famCuts[2] ? 2 : 3));
        if (!sprite && cfg.sea) fam = 1;
      }
    }
    put(data, i, grade(k, m, fam));
  }
  if (sprite) return;
  // leaves on the ground, more under the trees and later in the season; a few float on the water
  const dens = cfg.leaves * (0.006 + 0.05 * smooth(0, 1, p));
  if (dens > 0) {
    const near = nearOf(X.plan);
    for (let i = 0; i < N; i += 1) {
      const m = mat[i];
      if (m !== M_GROUND && m !== M_WATER && !(m === M_THING && zone[i] === Z_OPEN)) continue;
      if (m === M_WATER && (flag[i] & F_NOICE) && zone[i] !== Z_KEEP) continue;
      const x = i % W; const y = (i / W) | 0;
      const nearT = near[i];
      let d = dens * (0.25 + 1.6 * nearT);
      if (m === M_WATER) d *= 0.15;
      if (flag[i] & F_PATH) d *= 0.6;
      // two-pixel leaves: decide per pair, light pixel on the left
      const cx = x >> 1;
      if (h2(cx, y, seed + 101) >= d) continue;
      const F = fams[Math.floor(h2(cx, y, seed + 103) * (p < 0.4 ? 2.4 : 4)) % 4];
      const lone = h2(cx, y, seed + 107) < 0.4;
      if ((x & 1) && lone) continue;
      put(data, i, F[(x & 1) ? 2 : 3 + (h2(cx, y, 109) < 0.3 ? 1 : 0)]);
    }
  }
}

// ---------- spring ----------

function spring(X) {
  const { data, W, H, N, idx, pal, mat, zone, cfg, p, sprite, seed, fLo, fHi } = X;
  const grade = grader(pal, (e, m) => {
    let { h, s, l } = e;
    if (e.cls === C_DARK) return e.c;
    if (e.cls === C_GREEN) {
      if (cfg.sea) return fromHsl(hueTo(h, 150, 0.12), Math.min(1, s * 1.1), l * 1.02);
      // fresh new growth: yellower, a touch brighter and more saturated
      const k = m === M_GROUND ? 0.22 : 0.16;
      return fromHsl(hueTo(h, 96, k), Math.min(1, s * 1.1), l + (0.9 - l) * 0.06);
    }
    if (cfg.sea && e.cls === C_BLUE) return fromHsl(hueTo(h, 190, 0.08), s, l * 1.02);
    if (m === M_WATER) return fromHsl(h, Math.min(1, s * 1.04), l + (1 - l) * 0.03);
    return fromHsl(h, s, l + (1 - l) * 0.02);
  });
  for (let i = 0; i < N; i += 1) if (idx[i] >= 0) put(data, i, grade(idx[i], mat[i]));
  if (!cfg.blossom) return;
  // blossom on some of the trees: little clusters on the lit leaves
  const amt = bloomAmount(p) * cfg.blossom;
  const cl = field(X.W, X.H, 'cluster');
  const hiCut = above(cl, 0.42);
  for (let i = 0; i < N; i += 1) {
    const k = idx[i]; if (k < 0 || mat[i] !== M_THING) continue;
    const e = pal[k]; if (!isLeaf(e, cfg, X)) continue;
    if (!sprite && zone[i] !== Z_TREE) continue;
    const x = i % W; const y = (i / W) | 0;
    const tree = sprite ? X.crown && H > 26 && h2(seed, 3, 11) < 0.55 : cl.v[i] > hiCut;
    if (!tree) continue;
    const lit = (e.y - fLo) / (fHi - fLo);
    if (lit < 0.3) continue;
    const cx = x >> 1; const cy = y >> 1;
    if (h2(cx, cy, seed + 113) > amt * (0.18 + 0.3 * lit)) continue;
    const P = BLOSSOM[sprite ? Math.floor(h2(seed, 5, 13) * 3) : (cl.v[i] > above(cl, 0.2) ? 1 : cl.v[i] > above(cl, 0.32) ? 2 : 0)];
    const q = (x & 1) + (y & 1) * 2;
    if (q === 3 && h2(x, y, 127) < 0.5) continue;
    put(data, i, P[q === 0 ? 2 : q === 3 ? 0 : 1]);
  }
  if (sprite) return;
  // a few new flowers in the grass, and petals under the blossom trees
  const near = nearOf(X.plan);
  for (let i = 0; i < N; i += 1) {
    if (mat[i] !== M_GROUND || pal[idx[i]].cls !== C_GREEN) continue;
    const x = i % W; const y = (i / W) | 0;
    if (h2(x, y, seed + 131) < 0.0035 * cfg.blossom) put(data, i, SPECKS[Math.floor(h2(x, y, 137) * 4)]);
    else if (near[i] > 0.15 && h2(x, y, seed + 139) < 0.012 * amt * near[i]) put(data, i, BLOSSOM[0][1 + (x & 1)]);
  }
}

// ---------- summer ----------

function summer(X) {
  const { data, N, idx, pal, mat, cfg } = X;
  const grade = grader(pal, (e) => {
    const { h, s, l } = e;
    if (e.cls === C_DARK) return e.c;
    if (e.cls === C_GREEN && !cfg.sea) return fromHsl(hueTo(h, 90, 0.05), Math.min(1, s * 1.05), l);
    return fromHsl(hueTo(h, 40, 0.03), Math.min(1, s * 1.03), l);
  });
  for (let i = 0; i < N; i += 1) if (idx[i] >= 0) put(data, i, grade(idx[i], mat[i]));
}

// ---------- the exports: the land and the standing pieces ----------

function newCanvas(w, h, like) {
  const d = like?.ownerDocument || globalThis.document;
  const c = d ? d.createElement('canvas') : new OffscreenCanvas(w, h);
  c.width = w; c.height = h;
  return c;
}

const tintKept = new WeakMap();
/**
 * The painted village (or the garden yard: mapId 'garden') recoloured for the season, progress
 * 0..1 through it (seasons.js seasonProgress). Returns a new canvas the same size; the same
 * source, season and progress (to the nearest fifth) give back the same canvas.
 */
export function seasonTint(canvas, season, mapId = 'bg-meadow', progress = 0.5) {
  if (!SEASON_KINDS.includes(season)) season = 'summer';
  const b = bucket(progress);
  let per = tintKept.get(canvas);
  if (!per) { per = new Map(); tintKept.set(canvas, per); }
  const key = `${mapId}|${season}|${b}`;
  const hit = per.get(key);
  if (hit) return hit;
  const W = canvas.width; const H = canvas.height;
  const out = newCanvas(W, H, canvas);
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  recolour(img.data, W, H, season, mapId, b, planFor(mapId, W, H), 0);
  ctx.putImageData(img, 0, 0);
  if (per.size > 10) per.delete(per.keys().next().value);
  per.set(key, out);
  return out;
}

const spriteKept = new WeakMap();
/** A number for a sprite's look, so each tree picks its own autumn colour (the same each time). */
function spriteSeed(data, W, H) {
  let s = (W * 131 + H * 977) >>> 0;
  for (let i = 0; i < data.length; i += 4 * 7) s = (Math.imul(s ^ (data[i] + data[i + 1] * 3 + data[i + 3] * 7), 16777619) >>> 0);
  return s % 9973;
}
/**
 * A standing piece (a tree, a flower, a house piece, a decoration) recoloured for the season,
 * so it matches its tinted ground: snow on its top in winter, turned leaves in autumn, blossom in
 * spring. A new canvas with the same anchor (ax, ay); cached per source canvas, season and
 * progress. o: { cache: false } for a canvas that is redrawn (an animated landmark).
 */
export function seasonSprite(canvas, season, progress = 0.5, mapId = 'bg-meadow', o = {}) {
  if (!canvas || !canvas.width) return canvas;
  if (!SEASON_KINDS.includes(season)) season = 'summer';
  const b = bucket(progress);
  const key = `${mapId}|${season}|${b}`;
  let per = null;
  if (o.cache !== false) {
    per = spriteKept.get(canvas);
    if (!per) { per = new Map(); spriteKept.set(canvas, per); }
    const hit = per.get(key);
    if (hit) return hit;
  }
  const W = canvas.width; const H = canvas.height;
  const out = newCanvas(W, H, canvas);
  const ctx = out.getContext('2d');
  ctx.drawImage(canvas, 0, 0);
  const img = ctx.getImageData(0, 0, W, H);
  recolour(img.data, W, H, season, mapId, b, null, spriteSeed(img.data, W, H));
  ctx.putImageData(img, 0, 0);
  out.ax = canvas.ax; out.ay = canvas.ay;
  if (per) { if (per.size > 8) per.delete(per.keys().next().value); per.set(key, out); }
  return out;
}

// ---------- the weather ----------

// count: how many for a whole village (448 x 600 px), scaled by the overlay's size; speed: px a
// second downwards (negative rises); sway: px side to side; wind: px a second sideways
const SNOWFALL = { kind: 'snow', count: 80, speed: 9, sway: 3, wind: 2, variants: 3 };
const LEAVES = { kind: 'leaves', count: 26, speed: 15, sway: 9, wind: 5, variants: 4, frames: 4, fps: 5 };
const PETALS = { kind: 'petals', count: 22, speed: 10, sway: 7, wind: 4, variants: 3, frames: 3, fps: 4 };
const SHOWERS = { kind: 'rain', count: 70, speed: 170, sway: 0, wind: 16, variants: 2, showers: { period: 80, share: 0.35 } };
const MARINE = { kind: 'marine', count: 90, speed: 3.5, sway: 2.5, wind: 0.8, variants: 3 };
const ASH = { kind: 'ash', count: 46, speed: 8, sway: 4, wind: 3, variants: 3, frames: 2, fps: 3 };
const SPARKLE = { kind: 'sparkle', count: 26, speed: 0, sway: 0, wind: 0, variants: 1, frames: 4, fps: 5 };
const METEOR = { kind: 'meteor', count: 3, speed: 150, sway: 0, wind: -110, variants: 1 };
const FLUFF = { kind: 'fluff', count: 9, speed: 3, sway: 6, wind: 4, variants: 2 };

/**
 * What drifts over a map in a season (progress 0..1 is optional): { kind, count, speed, sway,
 * wind, ..., layers: [every kind, the main one first] } or null. kind is one of 'snow', 'leaves',
 * 'petals', 'rain', 'marine', 'ash', 'sparkle', 'meteor', 'steam', 'fluff'. On the volcano in
 * winter, layers include steam rising from vents: [x, y] points in village pixels (only right
 * when the overlay covers the whole village, one canvas pixel per village pixel).
 */
export function weather(season, mapId = 'bg-meadow', progress = 0.5) {
  const p = Math.max(0, Math.min(1, Number(progress) || 0));
  const L = [];
  const add = (spec, o = {}) => L.push({ ...spec, ...o });
  const dome = mapId === 'garden-dome';
  if (season === 'winter') {
    if (mapId === 'bg-ocean') add(MARINE, { count: 150, variant: 'snow' });
    else if (mapId === 'bg-space') { add(SPARKLE, { count: 30, variant: 'ice' }); add(METEOR, { count: 1 }); }
    else if (mapId === 'bg-galaxy') add(SPARKLE, { count: 34, variant: 'star' });
    else if (dome) add(SPARKLE, { count: 12, variant: 'ice' });
    else {
      const k = 0.7 + 0.5 * snowAmount(p) - 0.2;
      add(SNOWFALL, { count: Math.round(SNOWFALL.count * k * (mapId === 'bg-sunset' ? 0.6 : mapId === 'bg-volcano' ? 0.8 : 1)), variant: mapId === 'bg-rainbow' ? 'sugar' : 'plain' });
      if (mapId === 'bg-volcano') add({ kind: 'steam', count: 0, speed: -8, sway: 2, wind: 2, variants: 1, frames: 4, vents: steamVents(mapId) });
    }
  } else if (season === 'autumn') {
    if (mapId === 'bg-ocean') add(MARINE, { count: 50, variant: 'snow' });
    else if (mapId === 'bg-space' || mapId === 'bg-galaxy') add(METEOR, { count: 3 });
    else if (mapId === 'bg-volcano') { add(ASH); add(LEAVES, { count: 8 }); }
    else if (!dome) add(LEAVES, { count: Math.round(LEAVES.count * (0.5 + p) * (mapId === 'bg-sunset' ? 0.35 : mapId === 'bg-fjord' ? 0.3 : 1)), variant: mapId === 'bg-rainbow' ? 'candy' : 'plain' });
  } else if (season === 'spring') {
    if (mapId === 'bg-ocean') add(MARINE, { count: 70, variant: 'plankton' });
    else if (mapId === 'bg-space') add(SPARKLE, { count: 10, variant: 'ice' });
    else if (mapId === 'bg-galaxy') add(SPARKLE, { count: 18, variant: 'star' });
    else if (!dome) {
      // no blossom trees in the fjord's spruce woods, so no petals there
      if (mapId !== 'bg-fjord') add(PETALS, { count: Math.round(PETALS.count * (mapId === 'bg-volcano' ? 0.5 : 1)), variant: mapId === 'bg-sunset' ? 'hibiscus' : 'plain' });
      add(SHOWERS, { count: mapId === 'bg-rainforest' ? 110 : SHOWERS.count, showers: { period: 80, share: mapId === 'bg-rainforest' ? 0.5 : 0.32 } });
    }
  } else if (['bg-meadow', 'bg-castle', 'garden'].includes(mapId)) add(FLUFF);
  if (!L.length) return null;
  return { ...L[0], season, mapId, key: `${season}|${mapId}|${Math.round(p * 5)}`, layers: L };
}

/** Where steam rises off the volcano's lava (village pixels). */
function steamVents(mapId) {
  const L = villageLayout(mapId);
  const out = [];
  for (const wa of L.water) {
    if (wa.kind !== 'lava') continue;
    for (let k = 1; k < wa.pts.length; k += 1) {
      const [x0, y0] = wa.pts[k - 1]; const [x1, y1] = wa.pts[k];
      const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 46));
      for (let j = 0; j < n; j += 1) {
        const t = (j + 0.5) / n; const x = Math.round(x0 + (x1 - x0) * t); const y = Math.round(y0 + (y1 - y0) * t);
        if (x > 8 && x < L.W - 8 && y > 8) out.push([x + ((j % 2) ? 6 : -6), y - 4]);
      }
    }
  }
  return out;
}

// ---------- the particles' art ----------

const ART = new Map();
function art(rows, pal) {
  const h = rows.length; const w = Math.max(...rows.map((r) => r.length));
  const c = newCanvas(w, h);
  const x = c.getContext('2d');
  rows.forEach((r, y) => { for (let i = 0; i < r.length; i += 1) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, y, 1, 1); } } });
  return c;
}
const LEAF_COLS = [['#fff09a', '#f6c83a', '#c88a1e'], ['#ffc27a', '#ec7e2e', '#a8481c'], ['#ff9a7a', '#d84a3e', '#8a2430'], ['#e6b878', '#b07038', '#6a3c2a']];
const CANDY_LEAF = [['#fff0e2', '#ffbc98', '#da7c62'], ['#fff6d8', '#ffd87c', '#d8a648'], ['#ffe4dc', '#ffa6a0', '#d4626e'], ['#f8ecff', '#d8b8f8', '#a07ad8']];
const LEAF_FRAMES = [
  ['.LL..', 'LMMds', '.dd..'],
  ['..L.', '.LM.', 'LMd.', 'd..s'],
  ['LMMds'],
  ['.L..', 'LML.', '.Mdd', '...s'],
];
const PETAL_COLS = { plain: [['#ffdcea', '#f7a8c6', '#e07aa4'], ['#ffffff', '#fff0f6', '#e8c8dc'], ['#f8ecff', '#e8c4f6', '#c890e0']], hibiscus: [['#ffb0a0', '#f05a6a', '#b8303e'], ['#fff4c8', '#ffd860', '#e0a020'], ['#ffd0e6', '#f58cb8', '#c0487a']] };
const PETAL_FRAMES = [['LM', 'Md'], ['LMd'], ['L', 'M']];

/**
 * A particle's sprite (cached; draw it, never draw on it). kind as in weather(); frame for the
 * ones that tumble or twinkle; variant: a whole number (its look), or for some kinds a name and
 * a number ('plain' / 'sugar' snow, 'plain' / 'candy' leaves, 'plain' / 'hibiscus' petals,
 * 'snow' / 'plankton' marine motes, 'ice' / 'star' sparkles) as variant = `${name}:${n}`.
 */
export function particleArt(kind, frame = 0, variant = 0) {
  const key = `${kind}|${frame}|${variant}`;
  let c = ART.get(key);
  if (c) return c;
  const [name, nRaw] = String(variant).includes(':') ? String(variant).split(':') : ['plain', variant];
  const n = Math.abs(Number(nRaw) || 0);
  if (kind === 'snow') {
    const sug = name === 'sugar';
    const pal = { W: '#ffffff', w: sug ? '#fbeef8' : '#eaf2fc', s: sug ? '#e8d4ee' : '#c8d8ee' };
    c = art([['W'], ['Ww', 'ws'], ['.w.', 'wWw', '.w.']][n % 3], pal);
  } else if (kind === 'leaves') {
    const cols = (name === 'candy' ? CANDY_LEAF : LEAF_COLS)[n % 4];
    c = art(LEAF_FRAMES[frame % 4], { L: cols[0], M: cols[1], d: cols[2], s: '#5a3a2a' });
  } else if (kind === 'petals') {
    const cols = (PETAL_COLS[name] || PETAL_COLS.plain)[n % 3];
    c = art(PETAL_FRAMES[frame % 3], { L: cols[0], M: cols[1], d: cols[2] });
  } else if (kind === 'rain') {
    c = art(n % 2 ? ['a', 'b', 'b', 'c'] : ['a', 'b', 'c'], { a: 'rgba(200,226,255,0.35)', b: 'rgba(200,226,255,0.6)', c: 'rgba(236,246,255,0.8)' });
  } else if (kind === 'marine') {
    const pl = name === 'plankton';
    const pal = { a: pl ? '#c8f4d8' : '#e2f2fa', b: pl ? '#90d8b0' : '#a8cce0', c: pl ? '#6ab894' : '#7aa8c8' };
    c = art([['a'], ['b'], ['ab', '.c']][n % 3], pal);
  } else if (kind === 'ash') {
    c = art([['a'], ['ab', 'b.'], [frame % 2 ? 'e' : 'f']][n % 3], { a: '#a8a0a8', b: '#7a7078', e: '#ffd43b', f: '#ff922b' });
  } else if (kind === 'sparkle') {
    const star = name === 'star';
    const pal = { W: '#ffffff', a: star ? '#fff3bf' : '#d8f0ff', b: star ? '#f6c84a' : '#8cc4ec' };
    c = art([['b'], ['.a.', 'aWa', '.a.'], ['..b..', '..a..', 'baWab', '..a..', '..b..'], ['.a.', 'aWa', '.a.']][frame % 4], pal);
  } else if (kind === 'meteor') {
    c = art(['.......c', '......b.', '.....b..', '....a...', '...a....', '..A.....', '.W......', 'W.......'], { W: '#ffffff', A: '#fff8d8', a: '#ffe066', b: '#f59f00', c: '#a8601e' });
  } else if (kind === 'steam') {
    const a = ['rgba(244,244,250,0.7)', 'rgba(236,238,246,0.55)', 'rgba(230,232,242,0.4)', 'rgba(226,228,240,0.22)'][frame % 4];
    c = art([['ss', 'ss'], ['.s.', 'sss', '.s.'], ['.ss.', 'ssss', 'ssss', '.ss.'], ['.sss.', 's...s', '.s.s.']][frame % 4], { s: a });
  } else if (kind === 'fluff') {
    c = art(n % 2 ? ['W'] : ['.w.', 'wWw', '.w.'], { W: '#ffffff', w: '#f2f0e4' });
  } else c = art(['W'], { W: '#ffffff' });
  ART.set(key, c);
  return c;
}

// ---------- moving them ----------

const AREA = 448 * 600;
function spawn(P, Ly, rand, W, H, fresh) {
  P.v = Math.floor(rand() * (Ly.variants || 1));
  P.ph = rand() * Math.PI * 2;
  P.f = Math.floor(rand() * (Ly.frames || 1));
  P.sp = (Ly.speed || 0) * (0.7 + rand() * 0.6);
  P.x = rand() * W;
  P.y = fresh ? rand() * H : (Ly.speed < 0 ? H + 4 : -6);
  if (Ly.kind === 'snow') { P.v = rand() < 0.62 ? 0 : rand() < 0.75 ? 1 : 2; P.sp *= 0.8 + P.v * 0.25; }
  if (Ly.kind === 'marine') P.v = rand() < 0.5 ? 0 : rand() < 0.7 ? 1 : 2;
  if (Ly.kind === 'sparkle') { P.y = rand() * H; P.life = rand() * 3; P.wait = rand() * 4; }
  if (Ly.kind === 'meteor') { P.wait = fresh ? 1 + rand() * 6 : 3 + rand() * 9; P.x = W * (0.3 + rand() * 0.9); P.y = -10 - rand() * H * 0.2; }
  if (Ly.kind === 'steam') { const v = Ly.vents[Math.floor(rand() * Ly.vents.length)] || [W / 2, H / 2]; P.x = v[0] + (rand() - 0.5) * 6; P.y = v[1]; P.life = fresh ? rand() * 3 : 0; P.wait = fresh ? 0 : rand() * 1.5; }
}

/**
 * Moves the weather on by dt seconds over a W x H overlay (one canvas pixel per village pixel).
 * state starts as {} (or null) and is kept between frames; it starts again by itself when the
 * size or the weather changes. o: { scale: fewer on a phone (0.6, say), reduce: true when the kid
 * prefers reduced motion (a few, standing still) }. Returns the state.
 */
export function stepParticles(state, dt, W, H, wx, o = {}) {
  state = state || {};
  const scale = o.scale ?? 1; const reduce = !!o.reduce;
  const key = `${wx ? wx.key : '-'}|${W}x${H}|${scale}|${reduce ? 1 : 0}`;
  if (state.key !== key) {
    state.key = key; state.t = 0; state.W = W; state.H = H; state.reduce = reduce;
    let s = 0; for (let i = 0; i < key.length; i += 1) s = (Math.imul(s, 31) + key.charCodeAt(i)) | 0;
    state.rand = rng(Math.abs(s) % 100000 + 1);
    state.layers = (wx?.layers || []).map((Ly) => {
      let n = Ly.kind === 'steam' ? Ly.vents.length * 3 : Math.round((Ly.count || 0) * ((W * H) / AREA) * scale);
      if (Ly.kind === 'meteor') n = Math.max(1, Ly.count);
      if (reduce) n = Ly.kind === 'rain' || Ly.kind === 'meteor' || Ly.kind === 'steam' ? 0 : Math.ceil(n * 0.3);
      const list = [];
      for (let i = 0; i < n; i += 1) { const P = {}; spawn(P, Ly, state.rand, W, H, true); list.push(P); }
      return { spec: Ly, list, on: 1 };
    });
  }
  if (reduce || !dt) return state;
  dt = Math.min(dt, 0.25);
  state.t += dt;
  const t = state.t; const rand = state.rand;
  for (const Lr of state.layers) {
    const Ly = Lr.spec;
    // rain comes in showers
    if (Ly.showers) {
      const { period, share } = Ly.showers;
      const ph = ((t / period) + 0.6) % 1;
      Lr.on = ph < share ? Math.min(1, Math.sin((ph / share) * Math.PI) * 2.2) : 0;
    }
    Lr.list.forEach((P, n) => {
      if (Ly.kind === 'sparkle') {
        if (P.wait > 0) { P.wait -= dt; return; }
        P.life += dt;
        if (P.life > 1.6) { P.life = 0; P.wait = 0.5 + rand() * 4; P.x = rand() * W; P.y = rand() * H; }
        return;
      }
      if (Ly.kind === 'meteor') {
        if (P.wait > 0) { P.wait -= dt; return; }
        P.x += Ly.wind * dt; P.y += Ly.speed * dt;
        if (P.y > H * 0.75 || P.x < -10) spawn(P, Ly, rand, W, H, false);
        return;
      }
      if (Ly.kind === 'steam') {
        if (P.wait > 0) { P.wait -= dt; return; }
        P.life += dt; P.y += Ly.speed * dt; P.x += Math.sin(t * 1.3 + P.ph) * Ly.sway * dt + Ly.wind * dt * 0.5;
        if (P.life > 2.8) spawn(P, Ly, rand, W, H, false);
        return;
      }
      if (Ly.showers && Lr.on <= 0 && P.y < 0) return; // between showers, none start
      P.y += P.sp * dt;
      P.x += (Ly.wind + Math.cos(t * (0.6 + (n % 5) * 0.13) + P.ph) * Ly.sway) * dt;
      if (Ly.frames && Ly.fps) P.f = Math.floor(t * Ly.fps + P.ph) % Ly.frames;
      if (P.x < -6) P.x += W + 12; else if (P.x > W + 6) P.x -= W + 12;
      if (P.y > H + 6 || P.y < -8) {
        spawn(P, Ly, rand, W, H, false);
        if (Ly.showers && Lr.on < rand()) P.y = -8 - rand() * 20; // a thin shower leaves gaps
      }
    });
  }
  return state;
}

/** Draws the weather (stepParticles keeps it moving) on the overlay's 2d context, after clearing it. */
export function drawParticles(ctx, state) {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  if (!state?.layers) return;
  ctx.imageSmoothingEnabled = false;
  for (const Lr of state.layers) {
    const Ly = Lr.spec;
    const vname = typeof Ly.variant === 'string' ? Ly.variant : 'plain';
    for (const P of Lr.list) {
      let frame = P.f || 0;
      if (Ly.kind === 'sparkle') {
        if (P.wait > 0 && !state.reduce) continue;
        frame = state.reduce ? 1 : [0, 1, 2, 3, 0][Math.min(4, Math.floor(P.life / 0.32))];
      }
      if (Ly.kind === 'meteor' && (P.wait > 0 || P.y < -8)) continue;
      if (Ly.kind === 'steam') { if (P.wait > 0) continue; frame = Math.min(3, Math.floor(P.life / 0.7)); }
      if (Ly.kind === 'rain' && P.y < -2) continue;
      const a = particleArt(Ly.kind, frame, `${vname}:${P.v || 0}`);
      ctx.drawImage(a, Math.round(P.x - a.width / 2), Math.round(P.y - a.height / 2));
    }
  }
}
