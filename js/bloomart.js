// The village's own trees, flowers and critters (familygarden.js says what has grown; the
// village draws them). Each map grows its own: fruit trees and wildflowers in the Forest
// Village, palms and hibiscus on the beach, a coral reef over bare rock under the sea, glowing
// crystal gardens on the moon, roses and topiary at the castle, tree ferns and ember flowers on
// the volcano, flowering giants and orchids in the rainforest, blossom trees in every colour in
// Rainbow Land, star blossoms and comet-tail trees in the golden galaxy, and spruce, hemlock,
// birch and fireweed by the Alaskan fjord.
//
// Drawn in each map's own style B "soft storybook" (see meadowart.js): one art pixel per village
// pixel, warm hue-shifted ramps lit from the top left, selective outlines (each thing edged in a
// darker shade of its own colour, the ink line only where it meets the ground) and soft shadows.
//
//   treeArt(mapId, spot, stage, wilt)          stage 0 sapling .. 5 grand; wilt 0..3
//   flowerArt(mapId, kind, stage, wilt, age, v) kind 0..3; stage 0 sprout, 1 leaves, 2 bud, 3 bloom;
//                                               age 0..6 days in bloom (5, 6 a little past its best);
//                                               v: any number (a spot index) for a different clump
//   critterArt(mapId, which, frame, v)          which: an id from CRITTERS[mapId] (or its index);
//                                               v: a colour variant (0 .. variants - 1)
//
// Each returns a canvas (shared and cached: never draw on it) with its anchor at c.ax, c.ay:
// draw it at (x - c.ax, y - c.ay). Plants and walking or sitting critters are anchored at their
// feet (sort them with the buddy by that y); flying and swimming critters at their middle.
// Critters face right (flip them to go left).
//
// A spot's tree is always the same kind and look (its number picks them), so bloomspots.js
// could be chosen with each spot's grown tree measured. Grown trees are about 24-48 px wide and
// 23-61 tall above their foot (glows and sparkles a little more); flower clumps about 10-22 by
// 8-17; critters 5-21 px.

import { ramp, mix, h2, vnoise, bayer, Buf, grid, inEll, clamp, line, hexRgb, pixelBuffer } from './pixelkit.js';

// ---------- the maps' inks and ground shadows ----------

const MAP = {
  'bg-meadow': { ink: '#3b2235', shade: '42,24,56' },
  'bg-sunset': { ink: '#3b2235', shade: '110,60,80' },
  'bg-ocean': { ink: '#142038', shade: '14,28,64' },
  'bg-space': { ink: '#181830', shade: '20,18,44' },
  'bg-castle': { ink: '#2e2238', shade: '42,24,56' },
  'bg-volcano': { ink: '#2e2238', shade: '18,10,20' },
  'bg-rainforest': { ink: '#2e2238', shade: '8,22,20' },
  'bg-rainbow': { ink: '#3a2850', shade: '70,50,130' },
  'bg-galaxy': { ink: '#140c2c', shade: '8,4,24' },
  'bg-fjord': { ink: '#2e2238', shade: '20,30,56' },
};
const mapOf = (id) => (MAP[id] ? id : 'bg-meadow');

// each map's art registers itself in these (see each map's section)
const TREES = {};
const FLOWERS = {};
const CRITTERS_ART = {};
/**
 * Each map's critters: { id, frames, size: [w, h] (about), moves: 'walk' | 'fly' | 'swim' | 'sit',
 * level: the critterLevel (1..4) they first come out at, variants: colour variants }.
 */
export const CRITTERS = {};

// ---------- the kit ----------

// outline kinds: no outline at all, ink under things that stand on the ground
const NOLINE = new Set(['glow', 'fx', 'ground', 'spark', 'water', 'glass', 'stem']);
const GROUNDED = new Set(['wood', 'stake', 'stone', 'rock', 'pot', 'shell', 'body', 'metal']);
const LIVING = new Set(['leaf', 'frond', 'fl', 'fruit', 'moss', 'coral', 'crys', 'floss', 'vine', 'cloud', 'neb', 'stem']);

function edger(ink) {
  const cache = new Map();
  return (tag, side) => {
    if (!tag) return null;
    const [k, c] = String(tag).split(':');
    if (NOLINE.has(k) || !c || c[0] !== '#') return null;
    const key = `${k}|${c}|${side}`;
    let v = cache.get(key);
    if (v === undefined) {
      if (side === 'bottom') v = GROUNDED.has(k) ? ink : mix(c, ink, 0.6);
      else if (side === 'right') v = mix(c, ink, 0.5);
      else v = mix(c, ink, side === 'left' ? 0.4 : 0.34);
      cache.set(key, v);
    }
    return v;
  };
}
const EDGERS = {};
const edgeOf = (map) => EDGERS[map] || (EDGERS[map] = edger(MAP[map].ink));

const tg = (k, c) => `${k}:${c}`;
const kindOf = (t) => String(t || '').split(':')[0];

function makeCanvas(w, h) {
  if (typeof document !== 'undefined') { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
  return new OffscreenCanvas(w, h);
}

/**
 * A sprite being drawn: a Buf for the solid art (outlined when done) and an `under` list of
 * see-through pixels drawn first (shadows on the ground, glows). Coordinates are local, with
 * the anchor at (ax, ay).
 */
class Sprite {
  constructor(map, w, h, ax, ay, pad = 3) { this.map = map; this.b = new Buf(w, h, pad); this.under = []; this.over = []; this.ax = ax; this.ay = ay; }
  set(x, y, c, t) { this.b.set(x, y, c, t); }
  get(x, y) { return this.b.get(x, y); }
  kind(x, y) { return kindOf(this.b.tag(x, y)); }
  /** A soft shadow on the ground. */
  shadow(cx, cy, rx, ry, a = 0.22) {
    const s = MAP[this.map].shade;
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1) this.under.push([x, y, `rgba(${s},${(d < 0.45 ? a : a * 0.55).toFixed(3)})`]);
    }
  }
  /** A soft glow, dithered, strongest in the middle (under: on the ground; over: in the air, over the art). */
  glow(cx, cy, rx, ry, c, k = 0.4, over = false) {
    const [r, g, b] = hexRgb(c);
    for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = Math.hypot((x + 0.5 - cx) / rx, (y + 0.5 - cy) / ry);
      if (d >= 1) continue;
      const a = (1 - d) * k;
      if (bayer(x, y) > a * 2.2) continue;
      (over ? this.over : this.under).push([x, y, `rgba(${r},${g},${b},${Math.min(0.6, a + 0.12).toFixed(3)})`]);
    }
  }
  /** Outline (style B), smooth the curves, and make the canvas. */
  finish(o = {}) {
    const b = this.b;
    const ink = MAP[this.map].ink;
    b.outline(o.outline || edgeOf(this.map));
    const soft = new Set();
    b.each((x, y) => { const t = b.tag(x, y); if (t && !String(t).endsWith(':edge') && (o.soften || ['leaf', 'fl', 'coral', 'floss', 'cloud', 'fruit']).includes(kindOf(t))) soft.add(t); });
    if (soft.size) b.soften((c) => mix(c, ink, 0.22), [...soft]);
    if (o.after) o.after(this);
    return render(b, this.under, this.over, this.ax, this.ay);
  }
}

function render(b, under, over, ax, ay) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  const grow = (x, y) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; };
  b.each((x, y) => { if (b.get(x, y)) grow(x, y); });
  under.forEach(([x, y]) => grow(x, y));
  over.forEach(([x, y]) => grow(x, y));
  if (x1 < x0) { x0 = ax; y0 = ay; x1 = ax; y1 = ay; }
  const w = x1 - x0 + 1; const h = y1 - y0 + 1;
  const pb = pixelBuffer(w, h);
  under.forEach(([x, y, c]) => pb.px(x - x0, y - y0, c));
  b.each((x, y) => { const c = b.get(x, y); if (c) pb.px(x - x0, y - y0, c); });
  over.forEach(([x, y, c]) => pb.px(x - x0, y - y0, c));
  const cv = makeCanvas(w, h);
  pb.put(cv.getContext('2d'));
  cv.ax = ax - x0; cv.ay = ay - y0;
  return cv;
}

// ---------- colour ----------

const lum = (c) => { const [r, g, b] = hexRgb(c); return (0.3 * r + 0.59 * g + 0.11 * b) / 255; };
const gray = (c) => { const v = Math.round(lum(c) * 255).toString(16).padStart(2, '0'); return `#${v}${v}${v}`; };
/** Duller: less colour, a little toward the map's tired tint, a little darker. */
function dull(c, k, tint) {
  if (!c || c[0] !== '#' || c.length !== 7) return c;
  let d = mix(c, gray(c), Math.min(0.7, 0.2 * k));
  d = mix(d, tint, 0.09 * k);
  return mix(d, '#201828', 0.03 * k);
}
// how each map's living things look when the family has slipped: the colour fades toward this tint,
// and a few leaves turn these browns (dark .. light)
const TIRED = {
  'bg-meadow': { tint: '#a08a5a', brown: ['#6a4430', '#94602e', '#c08a3a', '#dcb05a'] },
  'bg-sunset': { tint: '#b09468', brown: ['#6e4a34', '#9a6c3c', '#c49450', '#e0bc78'] },
  'bg-ocean': { tint: '#e0dcd0', brown: ['#9a9488', '#bcb6a8', '#d8d2c4', '#f0ece2'] }, // coral bleaches
  'bg-space': { tint: '#7a7890', brown: ['#3e3c52', '#5a586e', '#7a788c', '#9c9aac'] }, // the glow goes out
  'bg-castle': { tint: '#a08a5a', brown: ['#6a4430', '#94602e', '#c08a3a', '#dcb05a'] },
  'bg-volcano': { tint: '#7a6a60', brown: ['#4a3830', '#6a4e3c', '#8e6e50', '#b09070'] }, // back to ash
  'bg-rainforest': { tint: '#8a8050', brown: ['#5a3a26', '#86582c', '#ae7c36', '#cca04a'] },
  'bg-rainbow': { tint: '#b4aec0', brown: ['#8a8098', '#a49cb2', '#c0b8cc', '#dcd6e4'] }, // the colour washes out
  'bg-galaxy': { tint: '#4a4460', brown: ['#2a2440', '#3e3858', '#56506e', '#726c88'] }, // the stars dim
  'bg-fjord': { tint: '#8a8468', brown: ['#5a3e30', '#845a30', '#aa7a38', '#c89c50'] }, // needles rust
};

/** Wilt the living parts of a sprite: duller colour, a few leaves browning, petals dropping at 2 and 3. */
function wither(s, wilt, seed = 0) {
  if (!wilt) return;
  const T = TIRED[s.map];
  const b = s.b;
  const brownAt = [0, 0.04, 0.08, 0.13][wilt];
  b.each((x, y) => {
    const t = b.tag(x, y); const k = kindOf(t);
    if (!LIVING.has(k)) return;
    let c = b.get(x, y);
    if ((k === 'fl') && wilt >= 2 && h2(x, y, seed + 31) < (wilt - 1) * 0.13) { b.del(x, y); return; }
    c = dull(c, wilt, T.tint);
    if ((k === 'leaf' || k === 'frond' || k === 'vine' || k === 'moss' || k === 'coral' || k === 'floss' || k === 'neb') && h2(Math.floor((x + 9) / 2), Math.floor((y + 9) / 2), seed + 37) < brownAt) c = T.brown[clamp(Math.floor(lum(c) * 5), 0, 3)];
    b.set(x, y, c);
  });
  // glows fade
  s.under = s.under.filter(([, , c]) => !c.startsWith('rgba(') || c.startsWith(`rgba(${MAP[s.map].shade}`) || wilt < 2);
  s.over = wilt >= 2 ? [] : s.over;
}

// ---------- shapes ----------

/**
 * A leafy crown of round clumps (later clumps in front), lit from the top left, with a line of
 * shade under each front clump so the leaves look bunched. P: a 7-colour ramp, dark .. light.
 */
function leafMass(s, clumps, P, o = {}) {
  const tag = tg(o.kind || 'leaf', P[3]); const seed = o.seed || 0; const wob = o.wob ?? 1.1;
  const xs = clumps.flatMap(([cx, , r]) => [cx - r, cx + r]); const ys = clumps.flatMap(([, cy, r]) => [cy - r, cy + r]);
  const gx0 = Math.floor(Math.min(...xs) - 2); const gx1 = Math.ceil(Math.max(...xs) + 2); const gy0 = Math.floor(Math.min(...ys) - 2); const gy1 = Math.ceil(Math.max(...ys) + 2);
  const gcx = (gx0 + gx1) / 2; const gcy = (gy0 + gy1) / 2; const gR = Math.max(4, (gx1 - gx0) / 2);
  const sq = o.squash || 1;
  const inside = (i, x, y) => { const [cx, cy, r] = clumps[i]; const rr = r + (vnoise(x, y, 3, seed + i) - 0.5) * wob; return ((x + 0.5 - cx) / rr) ** 2 + ((y + 0.5 - cy) / (rr * sq)) ** 2 <= 1; };
  const front = (x, y) => { for (let i = clumps.length - 1; i >= 0; i -= 1) if (inside(i, x, y)) return i; return -1; };
  for (let y = gy0; y <= gy1; y += 1) {
    for (let x = gx0; x <= gx1; x += 1) {
      const k = front(x, y);
      if (k < 0) continue;
      if (o.skip && o.skip(x, y)) continue;
      const [cx, cy, r] = clumps[k];
      const l = -(((x + 0.5 - cx) / r) * 0.6 + ((y + 0.5 - cy) / (r * sq)) * 0.8);
      const g = -(((x + 0.5 - gcx) / gR) * 0.45 + ((y + 0.5 - gcy) / gR) * 0.7);
      const v = l * 0.55 + g * 0.6 + (bayer(x, y) - 0.5) * 0.18;
      let i = v > 0.78 ? 5 : v > 0.36 ? 4 : v > -0.12 ? 3 : v > -0.55 ? 2 : 1;
      // the shade under a clump in front
      const above = front(x, y - 1); const above2 = front(x, y - 2);
      if (above > k) i = Math.min(i, 1);
      else if (above2 > k && above2 !== front(x, y + 1)) i = Math.min(i, 2);
      if (i >= 4 && h2(x, y, seed + 5) > 0.95) i = 6;
      else if (i === 3 && h2(x, y, seed + 6) < 0.06) i = 2;
      // a thinning crown: leaves gone from its edge
      if (o.thin && h2(x, y, seed + 8) < o.thin * 0.12 && (front(x, y - 2) < 0 || front(x - 2, y) < 0 || front(x + 2, y) < 0 || front(x, y + 2) < 0)) continue;
      s.set(x, y, P[i], tag);
    }
  }
}

/** A tapering trunk from (x, yBot) up to yTop, lit on the left, with bark marks and a root flare. */
function trunk(s, x, yTop, yBot, wTop, wBot, BK, o = {}) {
  const tag = tg(o.kind || 'wood', BK[3]); const lean = o.lean || 0; const seed = o.seed || 0;
  for (let y = yTop; y <= yBot; y += 1) {
    const t = (y - yTop) / Math.max(1, yBot - yTop);
    const flare = o.roots ? Math.max(0, (t - 0.72) / 0.28) ** 2 * o.roots : 0;
    const half = (wTop + (wBot - wTop) * t) / 2 + flare;
    const cx = x + lean * (1 - t) ** 1.5;
    for (let xx = Math.floor(cx - half + 0.5); xx < cx + half - 0.01; xx += 1) {
      const u = (xx + 0.5 - cx) / Math.max(0.5, half);
      let i = u < -0.5 ? 5 : u < 0.05 ? 4 : u < 0.55 ? 3 : 2;
      if (half > 1.6 && (xx * 3 + Math.floor((y + seed) / 3) * 5) % 7 === 0) i -= 1;
      if (half > 2.5 && h2(xx, y, seed + 9) < 0.06) i = 1;
      s.set(xx, y, BK[clamp(i, 1, 6)], tag);
    }
  }
}

/** A branch: a line from (x0, y0) to (x1, y1), w thick, in bark colours. */
function branch(s, x0, y0, x1, y1, w, BK, kind = 'wood') {
  const tag = tg(kind, BK[3]);
  line(x0, y0, x1, y1, (x, y, t) => {
    const ww = Math.max(1, Math.round(w * (1 - t * 0.5)));
    for (let d = 0; d < ww; d += 1) s.set(x + d - Math.floor(ww / 2), y, BK[d === 0 && ww > 1 ? 5 : d === ww - 1 && ww > 1 ? 2 : 4], tag);
  });
}

/** Little grids into a sprite. */
const dab = (s, x, y, rows, pal, tag) => grid((xx, yy, c) => s.set(xx, yy, c, tag), x, y, rows, pal);

/**
 * Picks points over a crown on a jittered grid (deterministic), for fruit and blossoms: fn(x, y, k)
 * for each point where test(x, y) holds. Light falls on the top left, so `lit` keeps to it.
 */
function sprinkle(box, step, seed, test, fn) {
  const [x0, y0, x1, y1] = box; let k = 0;
  for (let gy = y0; gy <= y1; gy += step) for (let gx = x0 + ((Math.floor((gy - y0) / step) % 2) * step) / 2; gx <= x1; gx += step) {
    const x = Math.round(gx + (h2(gx, gy, seed) - 0.5) * step * 0.8); const y = Math.round(gy + (h2(gy, gx, seed + 1) - 0.5) * step * 0.8);
    if (test(x, y)) { fn(x, y, k); k += 1; }
  }
}
const crownBox = (clumps) => [Math.min(...clumps.map((c) => c[0] - c[2])), Math.min(...clumps.map((c) => c[1] - c[2])), Math.max(...clumps.map((c) => c[0] + c[2])), Math.max(...clumps.map((c) => c[1] + c[2]))].map(Math.round);
const isKind = (s, k) => (x, y) => s.kind(x, y) === k;

/** Clumps for a crown of half-width R centred at (cx, cy), from a template in units of R. */
const clumpsOf = (tpl, cx, cy, R, droop = 0, flip = 1) => tpl.map(([u, v, r]) => [cx + u * R * flip * (1 + droop * 0.03), cy + v * R + droop * R * 0.1 * (0.5 + Math.abs(u) * 1.2) * (v > -0.3 ? 1 : 0.75), r * R * (1 - droop * 0.04)]);

// crown templates (u, v, r in units of the crown's half-width), back to front
const ROUND = [[0, -0.42, 0.5], [-0.5, -0.12, 0.46], [0.52, -0.1, 0.46], [-0.28, -0.58, 0.38], [0.3, -0.56, 0.38], [0, 0.02, 0.55], [-0.62, 0.28, 0.36], [0.62, 0.3, 0.36], [-0.24, 0.36, 0.44], [0.26, 0.38, 0.42]];
const OVAL = [[0, -0.72, 0.42], [-0.34, -0.4, 0.44], [0.36, -0.42, 0.42], [0, -0.2, 0.5], [-0.5, 0.1, 0.42], [0.5, 0.12, 0.42], [-0.18, 0.34, 0.44], [0.24, 0.36, 0.42], [0, -0.92, 0.28]];
const WIDE = [[-0.3, -0.36, 0.42], [0.34, -0.38, 0.4], [-0.66, -0.02, 0.36], [0.68, 0, 0.34], [0, -0.1, 0.5], [-0.42, 0.22, 0.4], [0.44, 0.24, 0.4], [0, 0.3, 0.42]];
const SMALL = [[0, -0.3, 0.62], [-0.42, 0.12, 0.5], [0.44, 0.14, 0.48], [0, 0.26, 0.55]];
const TINY = [[0, -0.1, 0.8], [-0.45, 0.25, 0.5], [0.45, 0.28, 0.48]];

// growth: crown half-width, trunk height (foot to the crown's bottom) and width, by stage
const GROW = { R: [0, 5, 8, 11.5, 15, 19], th: [0, 5, 7, 9, 11, 13], tw: [1, 2, 3, 4, 5, 7] };

/** A sapling tied to a little stake, in a ring of fresh soil (stage 0 of a broadleaf tree). o: { BK, P, soil, wilt, tie, stake } */
function sapling(s, fx, fy, o) {
  const { BK, P, soil } = o;
  if (soil) {
    for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 5; x <= fx + 5; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 5.2, 1.6)) s.set(x, y, Math.abs(x - fx) > 3 || y > fy ? soil[1] : soil[2], 'ground');
    s.set(fx - 1, fy - 1, soil[3], 'ground'); s.set(fx + 2, fy, soil[0], 'ground');
  }
  // the stake and its tie
  const SK = o.stake || ['#a8763e', '#c49060', '#e8c48a'];
  if (o.stake !== false) for (let y = fy - 12; y <= fy; y += 1) s.set(fx + 3, y, y === fy - 12 ? SK[2] : SK[1], tg('stake', SK[0]));
  const droop = o.wilt || 0;
  for (let y = fy - 9; y <= fy; y += 1) s.set(fx + (y < fy - 6 && droop > 1 ? 1 : 0), y, BK[y < fy - 4 ? 5 : 4], tg('wood', BK[3]));
  if (o.stake !== false) { s.set(fx + 1, fy - 6, o.tie || '#e8505a', 'fx'); s.set(fx + 2, fy - 6, o.tie || '#e8505a', 'fx'); }
  const top = droop > 1 ? fx + 1 : fx;
  const lf = tg('leaf', P[3]);
  [[-1, -4, -1], [1, -6, 1], [-1, -8, -1], [1, -9, 1]].forEach(([dx, dy, dir]) => {
    const yy = fy + dy + (droop > 0 ? 1 : 0);
    const x0 = (dy < -6 ? top : fx) + dx;
    s.set(x0, yy, P[4], lf); s.set(x0 + dir, yy + (droop ? 1 : 0), P[droop > 1 ? 2 : 3], lf);
  });
  s.set(top, fy - 10 + (droop > 1 ? 1 : 0), P[5], lf);
  s.shadow(fx + 1, fy + 1, 4, 1.2, 0.16);
}

/**
 * A broadleaf tree grown to a stage: a trunk (roots at 4 and 5, branches from 3) under a crown of
 * clumps. o: { P: leaf ramp, BK: bark ramp, soil, tpl (the crown's template from stage 3), ry
 * (how tall the crown is for its width), Rk (crown size), th (extra trunk), crownKind, stake,
 * crownP (the crown's colours instead of P), trunkKind }. Returns where the crown is, for the
 * fruit and blossom, or null for a sapling.
 */
function roundTree(s, stage, wilt, v, o) {
  const fx = 40; const fy = 80; const flip = v % 2 ? -1 : 1;
  const { P, BK } = o;
  if (stage === 0) { (o.sapling || sapling)(s, fx, fy, { BK, P, soil: o.soil, wilt, stake: o.stake, tie: o.tie }); return null; }
  const R = GROW.R[stage] * (o.Rk || 1);
  const th = GROW.th[stage] + (o.th || 0) * (stage / 5); const tw = GROW.tw[stage] * (o.tw || 1);
  const tpl = stage === 1 ? TINY : stage === 2 ? SMALL : (o.tpl || ROUND);
  const ry = o.ry || 0.86;
  const cy = fy - th - R * ry * 0.78;
  const lean = (h2(v, stage, 3) - 0.5) * 2 * (stage > 2 ? 1 : 0);
  s.shadow(fx + 2, fy, R * 0.85 + 2, 2.4 + stage * 0.3, 0.2);
  if (o.trunk) o.trunk(fx, fy, cy, R, tw, flip); else {
    trunk(s, fx, Math.round(cy), fy, Math.max(1, tw - 1.5), tw, BK, { roots: stage >= 4 ? stage - 2 : 0, lean, seed: v, kind: o.trunkKind });
    if (stage >= 3) {
      branch(s, fx, Math.round(cy + R * 0.3), Math.round(fx - R * 0.5 * flip), Math.round(cy - R * 0.2), Math.max(1, tw - 3), BK, o.trunkKind);
      branch(s, fx, Math.round(cy + R * 0.2), Math.round(fx + R * 0.45 * flip), Math.round(cy - R * 0.3), Math.max(1, tw - 3), BK, o.trunkKind);
    }
  }
  if (stage === 1 && o.stake !== false) { const SK = o.stake || ['#a8763e', '#c49060', '#e8c48a']; for (let y = fy - 12; y <= fy; y += 1) s.set(fx + 4, y, y === fy - 12 ? SK[2] : SK[1], tg('stake', SK[0])); s.set(fx + 2, fy - 6, o.tie || '#e8505a', 'fx'); s.set(fx + 3, fy - 6, o.tie || '#e8505a', 'fx'); }
  const clumps = clumpsOf(tpl, fx + lean * 0.5, cy, R, wilt, flip);
  const CP = (o.crownP && o.crownP(stage)) || P;
  const kind = (o.crownKind && o.crownKind(stage)) || 'leaf';
  leafMass(s, clumps, CP, { seed: v * 7 + stage, squash: ry, kind, thin: wilt });
  const box = crownBox(clumps);
  const inCrown = (x, y) => { const k = s.kind(x, y); return (k === kind) && s.get(x, y - 2) && s.get(x - 1, y) && s.get(x + 1, y); };
  const keep = (k) => h2(k, stage, 91) > wilt * 0.22;
  return { fx, fy, flip, R, cy, box, clumps, inCrown, keep, CP };
}

/**
 * A bush, wider than tall, grown to a stage. o: { P, BK, soil, R (half-widths by stage), ry,
 * head(x, y, k) for a flower on it, every (spacing of the flowers by stage) }.
 */
function bushy(s, stage, wilt, v, o) {
  const fx = 40; const fy = 80; const { P, BK } = o;
  if (stage === 0) {
    if (o.soil) for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 5; x <= fx + 5; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 5.2, 1.6)) s.set(x, y, Math.abs(x - fx) > 3 ? o.soil[1] : o.soil[2], 'ground');
    [[-2, -4], [0, -6], [2, -5]].forEach(([dx, h]) => { for (let y = fy + h; y <= fy; y += 1) s.set(fx + dx + (y < fy + h / 2 && wilt > 1 ? 1 : 0), y, BK[4], tg('wood', BK[3])); dab(s, fx + dx - 1, fy + h - 1 + (wilt ? 1 : 0), ['ab', '.b'], { a: P[4], b: P[3] }, tg('leaf', P[3])); });
    s.shadow(fx, fy + 1, 5, 1.2, 0.16);
    return null;
  }
  const R = (o.R || [0, 6, 9, 12, 15, 18])[stage];
  const ry = o.ry || 0.66;
  const cy = fy - R * ry - 1;
  s.shadow(fx + 2, fy, R + 1, 2.2 + stage * 0.3, 0.22);
  for (const dx of [-2, 1, 3]) for (let y = fy - 4; y <= fy; y += 1) s.set(fx + dx, y, BK[dx < 0 ? 4 : 3], tg('wood', BK[3]));
  const tpl = stage <= 2 ? [[0, -0.2, 0.62], [-0.5, 0.15, 0.5], [0.5, 0.15, 0.5]] : [[-0.45, -0.3, 0.45], [0.42, -0.32, 0.44], [0, -0.45, 0.48], [-0.7, 0.12, 0.36], [0.7, 0.12, 0.36], [-0.3, 0.2, 0.46], [0.32, 0.22, 0.46]];
  const clumps = clumpsOf(tpl, fx, cy, R, wilt, v % 3 ? 1 : -1);
  leafMass(s, clumps, P, { seed: v * 5 + stage, squash: ry * 1.1, thin: wilt });
  const box = crownBox(clumps);
  const inCrown = (x, y) => s.kind(x, y) === 'leaf' && s.get(x, y - 2) && s.get(x - 1, y + 1) && s.get(x + 1, y + 1);
  const keep = (k) => h2(k, stage, 93) > wilt * 0.22;
  if (o.head && stage >= (o.from ?? 3)) sprinkle(box, (o.every || [0, 9, 8, 7, 6, 5])[stage], v + 31, inCrown, (x, y, k) => { if (keep(k)) o.head(x, y, k); });
  return { fx, fy, R, cy, box, inCrown, keep };
}

// ---------- the Forest Village ----------

const LEAF = {
  meadow: ['#1f4a3e', '#2f6a46', '#3f8a48', '#4fa04c', '#74bc58', '#9ad466', '#c8ec8a'],
  apple: ['#1e463c', '#2c6444', '#3a8446', '#4b9a48', '#6eb652', '#94cc5e', '#c4e888'],
  pear: ['#26483a', '#346840', '#468a44', '#5ca44a', '#80bc58', '#a8d468', '#d4ee94'],
  shrub: ['#1c4038', '#285c40', '#367a44', '#469248', '#66ac52', '#8cc65e', '#bce486'],
};
const BARK = {
  meadow: ['#3a2430', '#5a3a36', '#764e3a', '#8a5a3c', '#a6744c', '#c29262', '#dab484'],
  cherry: ['#3a2032', '#5a2e3a', '#74403e', '#88503e', '#a46a50', '#c08a6a', '#d8aa88'],
};
const BLOSSOM = {
  cherry: ['#9a3a6a', '#c8588c', '#e47ca8', '#f49cbe', '#fabcd4', '#ffd8e8', '#fff2f8'],
  apple: ['#c86a8a', '#f4b8cc', '#fff4f8'],
  pear: ['#b8aed0', '#f6f2fa', '#ffffff'],
};
const SOIL = ['#5a3a34', '#7a4f46', '#a5714f', '#c48f5c'];

/** Petals drifting down from a crown and lying round its foot. */
function petalFall(s, t, C, n = 16) {
  const { fx, fy, flip, R, cy, keep } = t;
  [[-14, 4], [12, 8], [-8, 12], [17, 14], [-18, 16], [6, 18]].forEach(([dx, dy], k) => { if (keep(k + 3)) s.set(fx + Math.round(dx * flip * R / 19), Math.round(cy + R * 0.5 + dy * 0.6), C[k % 2], 'fx'); });
  for (let k = 0; k < n; k += 1) { const a = h2(k, R, 5) * 6.28; const d = 5 + h2(R, k, 6) * (R + 2); const x = Math.round(fx + Math.cos(a) * d); const y = Math.round(fy + Math.sin(a) * d * 0.25); if (!s.get(x, y) && keep(k)) s.set(x, y, C[k % 3 ? 0 : 1], 'ground'); }
}

/** A fruit or blossom tree: apple, cherry or pear. pal: { P, BK, blossom, fruit, young } */
function orchardTree(s, stage, wilt, v, kind, pal = {}) {
  const P = pal.P || LEAF[kind] || LEAF.meadow;
  const BK = pal.BK || (kind === 'cherry' ? BARK.cherry : BARK.meadow);
  const t = roundTree(s, stage, wilt, v, {
    P, BK, soil: pal.soil || SOIL,
    tpl: kind === 'pear' ? OVAL : kind === 'cherry' ? WIDE : ROUND, ry: kind === 'pear' ? 1.1 : kind === 'cherry' ? 0.8 : 0.86,
    Rk: kind === 'pear' ? 0.86 : kind === 'cherry' ? 1.06 : 1, th: kind === 'pear' ? 2 : 0,
    crownP: (st) => (kind === 'cherry' && st >= 4 ? BLOSSOM.cherry : null), crownKind: (st) => (kind === 'cherry' && st >= 4 ? 'floss' : null),
  });
  if (!t) return;
  const { fx, fy, flip, box, inCrown, keep } = t;
  if (kind === 'cherry') {
    // blossom: a few clusters at 3, the crown pink at 4 with green peeking, a pink cloud at 5 with petals drifting down
    if (stage === 3) sprinkle(box, 5, v + 11, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: BLOSSOM.cherry[4], b: BLOSSOM.cherry[6] }, tg('fl', BLOSSOM.cherry[3])); });
    if (stage >= 4) {
      sprinkle(box, stage === 4 ? 7 : 10, v + 12, inCrown, (x, y) => dab(s, x - 1, y, ['.g', 'gG'], { g: P[3], G: P[4] }, tg('leaf', P[3])));
      sprinkle(box, 5, v + 13, inCrown, (x, y, k) => { if (keep(k) && h2(x, y, 4) < 0.4) dab(s, x, y, ['w'], { w: BLOSSOM.cherry[6] }, tg('fl', BLOSSOM.cherry[3])); });
    }
    if (stage === 5) petalFall(s, t, [BLOSSOM.cherry[4], BLOSSOM.cherry[5]]);
    return;
  }
  // apples and pears: white or pink blossom at 3, blossom and young fruit at 4, ripe fruit at 5 (and some on the ground)
  const B = pal.blossom || BLOSSOM[kind] || BLOSSOM.apple;
  const fruit = pal.fruit || (kind === 'pear' ? ['#8a7a1e', '#c8b432', '#ecdc6a', '#fff4b0'] : ['#8a1e30', '#d8343e', '#ff6a5a', '#ffc0a8']);
  const young = pal.young || (kind === 'pear' ? ['#4a6a2a', '#8ab040', '#c4dc70', '#e8f4a8'] : ['#5a7a2a', '#9ac042', '#d0e070', '#f0f8b0']);
  const putFruit = (x, y, F) => (kind === 'pear'
    ? dab(s, x, y - 1, ['.c', 'bc', 'ab', '.a'], { a: F[0], b: F[1], c: F[2] }, tg('fruit', F[1]))
    : dab(s, x, y, ['cb', 'ba'], { a: F[0], b: F[1], c: F[3] }, tg('fruit', F[1])));
  if (stage === 3 || stage === 4) sprinkle(box, stage === 3 ? 5 : 6, v + 21, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: B[1], b: B[2] }, tg('fl', B[0])); });
  if (stage === 4) sprinkle(box, 8, v + 22, inCrown, (x, y, k) => { if (keep(k + 5)) putFruit(x, y, young); });
  if (stage === 5) {
    sprinkle(box, 6, v + 23, inCrown, (x, y, k) => { if (keep(k)) putFruit(x, y, k % 5 === 4 ? young : fruit); });
    [[-9, 1], [7, 2], [-3, 3]].forEach(([dx, dy], k) => { if (keep(k + 9)) dab(s, fx + dx * flip, fy + dy - 1, kind === 'pear' ? ['c', 'b'] : ['cb', 'ba'], { a: fruit[0], b: fruit[1], c: fruit[2] }, tg('fruit', fruit[1])); });
  }
}

/** A flowering shrub, wider than tall: lilac cones (v even) or hydrangea heads (v odd). */
function shrub(s, stage, wilt, v) {
  const hyd = v % 2 === 1;
  const F = hyd ? ['#3a5ec0', '#6e9af0', '#a8c8ff', '#e0ecff'] : ['#6a3aa8', '#9a6ad8', '#c49cf0', '#ecdcff'];
  const F2 = hyd ? ['#a8407a', '#e07ab0', '#f8b0d4', '#ffe4f0'] : ['#b8aed0', '#e8e2f4', '#f8f6ff', '#ffffff'];
  bushy(s, stage, wilt, v, {
    P: LEAF.shrub, BK: BARK.meadow, soil: SOIL,
    head: (x, y, k) => { const C = k % 4 === 3 ? F2 : F; return hyd
      ? dab(s, x - 1, y - 1, ['.cb.', 'cbba', 'bbaa', '.aa.'], { a: C[0], b: C[1], c: C[2] }, tg('fl', C[1]))
      : dab(s, x - 1, y - 3, ['.c.', 'cb.', 'cbb', 'bba', 'bab', '.a.'], { a: C[0], b: C[1], c: C[2] }, tg('fl', C[1])); },
  });
}

// ---------- flowers: the kit ----------
// A flower clump stands in a 32 x 30 box with its foot at (16, 26).

const FX = 16; const FY = 26;
// where a clump's stems stand (dx from the foot, how tall, which way they lean): three looks
const CLUMPS = [
  [[-4, 0.82, -1], [4, 0.72, 1], [0, 1, 0]],
  [[-6, 0.66, -1], [5, 0.7, 1], [-2, 0.95, 0], [2, 0.84, 1]],
  [[-3, 0.92, -1], [3, 0.8, 1]],
];

/** A stem from the ground up to (x1, y1), bowing by `bend`; returns its points. */
function stem(s, x0, y0, x1, y1, bend, C, kind = 'leaf') {
  const pts = [];
  const n = Math.max(2, Math.abs(y1 - y0) * 2);
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const x = Math.round(x0 + (x1 - x0) * t * t + bend * Math.sin(t * Math.PI)); const y = Math.round(y0 + (y1 - y0) * t);
    pts.push([x, y]);
    s.set(x, y, t > 0.6 ? C[1] : C[0], tg(kind === 'leaf' ? 'stem' : kind, C[0]));
  }
  return pts;
}

/** Fresh seedlings in a little patch of turned soil (every map's stage 0, in its own colours). */
function sprouts(s, v, C, soil, wilt) {
  if (soil) for (let x = FX - 6; x <= FX + 6; x += 1) for (let y = FY - 1; y <= FY + 1; y += 1) if (inEll(x, y, FX + 0.5, FY + 0.5, 6.5, 1.7)) s.set(x, y, h2(x, y, 3) < 0.25 ? soil[0] : y > FY ? soil[1] : soil[2], 'ground');
  const at = [[-3, 0], [2, -1], [5, 1], [-5, 1]].slice(0, v === 2 ? 2 : 3 + (v === 1 ? 1 : 0));
  at.forEach(([dx, dy], i) => {
    const x = FX + dx; const y = FY + dy - 1;
    const tall = 1 + ((i + v) % 2);
    for (let k = 0; k < tall; k += 1) s.set(x, y - k, C[1], tg('leaf', C[1]));
    const d = wilt ? 1 : 0;
    s.set(x - 1, y - tall + d, C[2], tg('leaf', C[1])); s.set(x + 1, y - tall + d, C[3], tg('leaf', C[1]));
  });
  s.shadow(FX, FY + 1, 6, 1.2, 0.12);
}

/** A low tuft of leaves round the foot of a clump: blades (or round leaves) w either side. */
function tuft(s, w, C, o = {}) {
  const tag = tg('leaf', C[1]);
  for (let x = -w; x <= w; x += 1) {
    const hgt = Math.max(1, Math.round((o.h || 3) * (1 - (x / (w + 1)) ** 2) + (h2(x, w, o.seed || 1) - 0.5) * 2));
    const lean = x < 0 ? -1 : 1;
    for (let k = 0; k < hgt; k += 1) {
      const xx = FX + x + (k === hgt - 1 && hgt > 1 && Math.abs(x) > 1 ? lean : 0);
      s.set(xx, FY - k, k === hgt - 1 ? C[3] : k === 0 ? C[1] : C[2], tag);
    }
  }
}

/** Puts flower heads on a clump's stems: head(x, y, i, lean) for each stem top. */
function clump(s, v, stage, wilt, old, H, C, head, o = {}) {
  const stems = CLUMPS[v];
  const bow = wilt + old * 0.5;
  stems.forEach(([dx, hf, lean], i) => {
    const h = Math.round(H * hf * (stage === 2 ? 0.86 : 1) - wilt * 0.8);
    const tx = FX + dx + lean * (1 + Math.round(bow)) + (wilt >= 2 ? (lean || 1) * (wilt - 1) : 0);
    const ty = FY - h + Math.round(bow * 0.6);
    const pts = stem(s, FX + dx, FY, tx, ty, lean * (o.bow ?? 0.6) + (wilt ? (lean || 1) * wilt * 0.6 : 0), C);
    if (o.leaves) o.leaves(pts, i, lean);
    head(tx, ty, i, lean || (i % 2 ? 1 : -1));
  });
}

// ---------- the Forest Village's flowers ----------

const MSTEM = ['#33704a', '#4a9450', '#6cb85a', '#9ed46a'];
const MFL = {
  poppy: ['#8a1a2e', '#d8343a', '#ff6448', '#ffa078'],
  bell: ['#3a3ea8', '#5a6ad8', '#8ea0f0', '#c8d4ff'],
  daisy: ['#b8aed0', '#f6f2fa', '#ffffff', '#ffcf3a'],
  lupin: [['#4a3a9a', '#7a5ad0', '#a888ee', '#d8c8ff'], ['#a8306a', '#e05a98', '#f890c0', '#ffd0e4'], ['#c87a1a', '#f0b030', '#ffd860', '#fff4b0']],
};

FLOWERS['bg-meadow'] = {
  draw(s, kind, stage, wilt, old, v) {
    if (stage === 0) { sprouts(s, v, MSTEM, SOIL, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.16);
    const pale = (c) => (old ? mix(c, '#fff4f0', 0.14 * old) : c);
    if (kind === 0) {
      // poppies: grey-green lobed leaves, hairy stems, scarlet cups with a dark eye
      tuft(s, 5, ['#2c5a40', '#3e7a50', '#5a9a62', '#86b880'], { h: stage === 1 ? 4 : 3, seed: v });
      if (stage === 1) return;
      const P = MFL.poppy.map(pale);
      clump(s, v, stage, wilt, old, 13, MSTEM, (x, y, i, lean) => {
        if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: '#5a8a4a', b: P[1] }, tg('fl', P[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['bc.', '.ab'], { a: P[0], b: P[1], c: P[2] }, tg('fl', P[1])); return; }
        dab(s, x - 1, y - 2, ['.cc.', 'cbkb', '.ab.'].map((r) => (lean < 0 ? r : r)), { a: P[0], b: P[1], c: P[2], k: '#2a1424' }, tg('fl', P[1]));
      });
      if (old === 2) { s.set(FX - 6, FY + 1, MFL.poppy[2], 'ground'); s.set(FX + 5, FY, MFL.poppy[1], 'ground'); }
      return;
    }
    if (kind === 1) {
      // bluebells: strappy leaves, stems arching over, a row of nodding bells
      tuft(s, 4, ['#2a6040', '#3a7e48', '#58a050', '#8cc462'], { h: stage === 1 ? 5 : 3, seed: v + 3 });
      if (stage === 1) return;
      const P = MFL.bell.map(pale);
      CLUMPS[v].forEach(([dx, hf, lean], i) => {
        const dir = lean || (i % 2 ? 1 : -1);
        const h = Math.round(12 * hf - wilt);
        const x0 = FX + dx; let x = x0; let y = FY;
        const path = [];
        for (let k = 0; k < h; k += 1) { y -= 1; if (k > h * 0.55) x += dir * (k % 2 ? 1 : 0); path.push([x, y]); s.set(x, y, MSTEM[k > h / 2 ? 1 : 0], tg('stem', MSTEM[0])); }
        // the tip arches over
        const tipx = x + dir; s.set(tipx, y, MSTEM[1], tg('stem', MSTEM[0])); s.set(tipx + dir, y + 1 + (wilt ? 1 : 0), MSTEM[1], tg('stem', MSTEM[0]));
        const bells = stage === 2 ? 2 : 3 - (wilt >= 2 ? 1 : 0);
        for (let b = 0; b < bells; b += 1) {
          const [bx, by] = b === 0 ? [tipx + dir, y + 2 + wilt] : path[Math.max(0, path.length - 1 - b * 2)];
          if (stage === 2) { s.set(bx + dir, by + 1, P[1], tg('fl', P[1])); continue; }
          dab(s, bx + (dir > 0 ? 0 : -1), by + 1, ['bc', 'ab', 'a.'].map((r) => (dir > 0 ? r : [...r].reverse().join(''))), { a: P[0], b: P[1], c: P[2] }, tg('fl', P[1]));
        }
      });
      return;
    }
    if (kind === 2) {
      // ox-eye daisies: a mound of small leaves, many stems, white heads with gold eyes
      tuft(s, 5, ['#2e6844', '#428a4a', '#62a856', '#90c868'], { h: stage === 1 ? 3 : 2, seed: v + 5 });
      if (stage === 1) { [[-3, -4], [2, -5], [5, -3]].forEach(([dx, dy]) => dab(s, FX + dx, FY + dy, ['ab', 'b.'], { a: '#90c868', b: '#62a856' }, tg('leaf', '#428a4a'))); return; }
      const P = MFL.daisy.map(pale);
      const extra = v === 2 ? [[-6, 0.55, -1], [6, 0.6, 1]] : [[1, 0.55, 1]];
      const stems = [...CLUMPS[v], ...extra];
      stems.forEach(([dx, hf, lean], i) => {
        const h = Math.round(11 * hf - wilt);
        const tx = FX + dx + lean * (wilt ? wilt : 0); const ty = FY - h + wilt;
        stem(s, FX + dx, FY, tx, ty, lean * 0.5, MSTEM);
        if (stage === 2) { dab(s, tx, ty - 1, ['a', 'g'], { a: '#e8f0d0', g: '#6cb85a' }, tg('fl', '#e8f0d0')); return; }
        if (wilt >= 2) { dab(s, tx - 1, ty - 1, ['.y.', 'aaa'], { a: P[0], y: P[3] }, tg('fl', P[1])); return; }
        dab(s, tx - 1, ty - 2, ['.b.', 'cyb', '.a.'], { a: P[0], b: P[1], c: P[2], y: P[3] }, tg('fl', P[1]));
        if (i === 0 && stage === 3 && !old) s.set(tx - 2, ty - 1, P[2], tg('fl', P[1]));
      });
      if (old === 2) { s.set(FX - 5, FY + 1, '#ffffff', 'ground'); s.set(FX + 6, FY, '#f6f2fa', 'ground'); }
      return;
    }
    // lupins: hands of leaves, tall spikes of pea flowers, purple, pink and gold, palest at the tip
    tuft(s, 5, ['#2a5e48', '#3c7c52', '#5aa060', '#8cc47a'], { h: stage === 1 ? 4 : 3, seed: v + 7 });
    if (stage === 1) { [[-4, -5], [3, -6]].forEach(([dx, dy]) => dab(s, FX + dx - 1, FY + dy, ['a.a', '.b.'], { a: '#8cc47a', b: '#5aa060' }, tg('leaf', '#3c7c52'))); return; }
    CLUMPS[v].forEach(([dx, hf, lean], i) => {
      const P = MFL.lupin[(i + v) % (v === 1 ? 3 : 2)].map(pale);
      const h = Math.round(15 * hf - wilt);
      const tx = FX + dx + (wilt >= 2 ? (lean || 1) * (wilt - 1) : 0);
      const pts = stem(s, FX + dx, FY, tx, FY - h + 1, 0, MSTEM);
      const spike = stage === 2 ? 4 : 7;
      for (let k = 0; k < spike; k += 1) {
        const [x, y] = pts[Math.max(0, pts.length - 1 - Math.round(k * (pts.length / h)))];
        const t = k / spike;
        const c = stage === 2 ? (k < 2 ? '#7aa860' : P[0]) : t < 0.25 ? P[3] : t < 0.6 ? P[2] : P[1];
        const wide = stage === 3 && k > 0 && k < spike - 1 && !(wilt >= 2 && k % 2);
        s.set(x, y, c, tg('fl', P[1]));
        if (wide) { s.set(x - 1, y, k % 2 ? P[1] : c, tg('fl', P[1])); s.set(x + 1, y, k % 2 ? c : P[0], tg('fl', P[1])); }
      }
    });
  },
};

// ---------- critters: the kit ----------

/**
 * A critter from a letter grid: pal maps a letter to a colour, or to [colour, kind] (kind 'body'
 * by default, which gets the ink line under it; 'fur' doesn't). K is an ink pixel (eyes).
 * o: { feet: anchored at the bottom middle (else the middle), shadow: a shadow under it }.
 */
function critterOf(map, rows, pal, o = {}) {
  const w = Math.max(...rows.map((r) => r.length)); const h = rows.length;
  const ax = o.ax ?? Math.floor(w / 2); const ay = o.feet ? h : (o.ay ?? Math.floor(h / 2));
  const s = new Sprite(map, w, h, ax, ay, 2);
  const ink = MAP[map].ink;
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) {
    const ch = r[x];
    if (ch === '.' || ch === ' ') continue;
    if (ch === 'K') { s.set(x, y, ink, 'eye'); continue; }
    const p = pal[ch]; if (!p) continue;
    const [c, k] = Array.isArray(p) ? p : [p, o.kind || 'body'];
    s.set(x, y, c, tg(k, c));
  } });
  if (o.shadow) s.shadow(ax + (o.shadow[2] || 0), h, o.shadow[0], o.shadow[1], 0.24);
  if (o.glow) s.glow(...o.glow);
  return s.finish({ soften: o.soften || [] });
}
/** A grid with some rows swapped out from row `from`. */
const swapRows = (rows, from, repl) => rows.map((r, i) => (i >= from && i < from + repl.length ? repl[i - from] : r));

// ---------- the Forest Village's critters ----------

const BUTTERFLY = [
  ['AA.AA', 'AaBaA', '.cBc.', '.c.c.'],
  ['.A.A.', '.aBa.', '..B..', '.....'],
];
const SONGBIRD = [
  ['.WW.....', '..WW....', '.bbbHH..', 'tbbbHHKo', '..ccc...', '........'],
  ['........', '........', '.bbbHH..', 'tbbbHHKo', '..WWc...', '...WW...'],
  ['...bHH..', '.bbbHHKo', 'tbbcc...', '..c.c...'],
];
const RABBIT = [
  ['......ii.', '......ie.', '.....hhhh', '..fffhhKh', '.ffffhhhn', 'wfffffff.', '.ffffff..', '..dd.ddd.'],
  ['.......ii', '.......ie', '......hhh', '..ffffhKh', '.fffffhhn', 'wfffffff.', '.ffff.dd.', 'dd.......'],
];
const DEER = [
  ['...........e.e.', '...........hhh.', '..........hhhKh', '..........hhhhn', '.........nnh...', '..ffffffffnh...', '.wfffsffsfff...', '.ffsffffffff...', '..fffffffff....', '..ll....ll.....', '..ll....ll.....', '..ll....ll.....', '..kk....kk.....'],
  ['...........e.e.', '...........hhh.', '..........hhhKh', '..........hhhhn', '.........nnh...', '..ffffffffnh...', '.wfffsffsfff...', '.ffsffffffff...', '..fffffffff....', '..ll.....ll....', '.ll.....ll.....', '.l.......ll....', '.k.......kk....'],
  ['...............', '...............', '...............', '...............', '...............', '..ffffffffn....', '.wfffsffsffnn..', '.ffsfffffffhhe.', '..fffffffffhhhe', '..ll....llhhKh.', '..ll....ll.hhhn', '..ll....ll.....', '..kk....kk.....'],
];
const STAG = [
  ['............g.g.g', '...........g.gg..', '............gg.g.', '............e.e..', '............hhh..', '...........hhhKh.', '...........hhhhn.', '..........nnh....', '...ffffffffnh....', '..wfffffffff.....', '..fffffffffff....', '...fffffffff.....', '...ll....ll......', '...ll....ll......', '...ll....ll......', '...kk....kk......'],
  ['............g.g.g', '...........g.gg..', '............gg.g.', '............e.e..', '............hhh..', '...........hhhKh.', '...........hhhhn.', '..........nnh....', '...ffffffffnh....', '..wfffffffff.....', '..fffffffffff....', '...fffffffff.....', '...ll.....ll.....', '..ll.....ll......', '..l.......ll.....', '..k.......kk.....'],
];

CRITTERS['bg-meadow'] = [
  { id: 'butterfly', frames: 2, size: [7, 6], moves: 'fly', level: 1, variants: 3 },
  { id: 'songbird', frames: 3, size: [10, 8], moves: 'fly', level: 2, variants: 2 },
  { id: 'rabbit', frames: 2, size: [11, 10], moves: 'walk', level: 2, variants: 2 },
  { id: 'deer', frames: 3, size: [17, 15], moves: 'walk', level: 3 },
  { id: 'stag', frames: 2, size: [19, 18], moves: 'walk', level: 4 },
];
CRITTERS_ART['bg-meadow'] = {
  butterfly: (f, v) => {
    const C = [['#f08c3a', '#ffc47a', '#e85a2a'], ['#5a8af0', '#a8ccff', '#3a5ec0'], ['#fff4a8', '#ffffff', '#ffd23f']][v];
    return critterOf('bg-meadow', BUTTERFLY[f], { A: [C[0], 'fur'], a: [C[1], 'fur'], c: [C[2], 'fur'], B: ['#3b2235', 'fur'] });
  },
  songbird: (f, v) => {
    const C = v ? { b: '#8a5a3c', H: '#7a4a32', c: '#f08a3a', W: '#a8764e' } : { b: '#4a7ae0', H: '#3a62c8', c: '#f4a860', W: '#7aa8f8' };
    return critterOf('bg-meadow', SONGBIRD[f], { b: [C.b, 'fur'], H: [C.H, 'fur'], c: [C.c, 'fur'], W: [C.W, 'fur'], t: [C.H, 'fur'], o: ['#ffb02a', 'fur'] }, { feet: f === 2 });
  },
  rabbit: (f, v) => {
    const C = v ? { f: '#b8b0b8', h: '#c8c0c8', d: '#8a8090' } : { f: '#b88a62', h: '#c89a70', d: '#8a6448' };
    return critterOf('bg-meadow', RABBIT[f], { f: C.f, h: C.h, d: C.d, i: '#f4a8b8', e: C.h, n: '#f48aa0', w: '#ffffff' }, { feet: true, shadow: [4, 1.2] });
  },
  deer: (f) => critterOf('bg-meadow', DEER[f], { f: '#b8743e', h: '#c88450', n: '#c88450', s: '#f4dcb0', e: '#a8643a', w: '#fff4e0', l: '#9a5e34', k: '#3b2235' }, { feet: true, shadow: [7, 1.4] }),
  stag: (f) => critterOf('bg-meadow', STAG[f], { f: '#f4f0f4', h: '#ffffff', n: '#f4f0f4', e: '#e8e0ec', w: '#ffffff', l: '#dcd4e4', k: '#8a7a9a', g: ['#ffd23f', 'fur'] }, { feet: true, shadow: [8, 1.5], glow: [9, 8, 12, 10, '#fff4c8', 0.35] }),
};

// ---------- the Forest Village's trees ----------

TREES['bg-meadow'] = {
  kinds: ['apple', 'cherry', 'pear', 'shrub'],
  draw: (s, kind, stage, wilt, v) => (kind === 'shrub' ? shrub(s, stage, wilt, v) : orchardTree(s, stage, wilt, v, kind)),
};

// ---------- shared: palms, fronds, rocks ----------

/**
 * A frond from (cx, cy) at angle a (radians, y squashed), len long, drooping by droop at its tip:
 * a light midrib, leaflets feathery on the lower edge, the back ones darker. P: 7-colour ramp.
 */
function frond(s, cx, cy, a, len, droop, P, o = {}) {
  const S = [];
  const wd = o.w ?? 2.7; const k = o.k || 0;
  for (let i = 0; i <= 30; i += 1) {
    const t = i / 30;
    S.push([cx + Math.cos(a) * len * t, cy + Math.sin(a) * len * t * 0.7 + droop * t * t, wd * Math.sin(Math.PI * Math.min(1, t * 0.88 + 0.12)) + 0.35, t]);
  }
  const xs = S.map((q) => q[0]); const ys = S.map((q) => q[1]);
  const tag = tg(o.kind || 'frond', P[3]);
  for (let y = Math.floor(Math.min(...ys) - 4); y <= Math.max(...ys) + 4; y += 1) {
    for (let x = Math.floor(Math.min(...xs) - 4); x <= Math.max(...xs) + 4; x += 1) {
      let best = null; let bd = Infinity; let bi = 0;
      S.forEach((q, i) => { const d = Math.hypot(x + 0.5 - q[0], y + 0.5 - q[1]) - q[2]; if (d < bd) { bd = d; best = q; bi = i; } });
      if (bd > 0) continue;
      const nxt = S[Math.min(30, bi + 1)]; const prv = S[Math.max(0, bi - 1)];
      const tx = nxt[0] - prv[0]; const ty = nxt[1] - prv[1];
      const side = tx * (y + 0.5 - best[1]) - ty * (x + 0.5 - best[0]);
      const below = side * Math.sign(tx || 1) > 0;
      const dist = Math.hypot(x + 0.5 - best[0], y + 0.5 - best[1]);
      if (below && dist > best[2] * 0.4 && (x + y * 2 + k) % 3 === 0) continue;
      let i = below ? 2 : 4;
      if (dist < 0.75 && best[3] > 0.15) i = 5;
      if (best[3] > 0.82) i += 1;
      if (!below && h2(x, y, k + 7) < 0.12) i -= 1;
      if (o.back) i -= 1;
      if (o.tipC && best[3] > 0.85) { s.set(x, y, o.tipC, tag); continue; }
      s.set(x, y, P[clamp(i, 1, 6)], tag);
    }
  }
}

/** A ringed palm trunk from the foot (fx, fy) up L, its top leaning by lean. Returns the crown point. */
function palmTrunk(s, fx, fy, L, lean, tw, TR, v = 0) {
  const cy = fy - L;
  for (let y = cy + 1; y <= fy; y += 1) {
    const t = (fy - y) / L;
    const x0 = fx + lean * Math.pow(t, 1.7);
    const hw = tw - t * 0.7 + (y > fy - 3 ? (y - (fy - 3)) * 0.6 : 0);
    for (let x = Math.floor(x0 - hw); x <= x0 + hw; x += 1) {
      const u = (x + 0.5 - x0) / hw;
      if (Math.abs(u) > 1) continue;
      const r = (y + v) % 3;
      let c = u < -0.4 ? TR[4] : u > 0.45 ? TR[2] : TR[3];
      if (r === 0) c = u < -0.4 ? TR[3] : TR[1];
      else if (r === 1 && u < 0.3) c = u < -0.4 ? TR[5] : TR[4];
      s.set(x, y, c, tg('wood', TR[2]));
    }
  }
  return [fx + lean, cy];
}

const PALM_BACK = [[-2.45, 13, 3], [-0.7, 13, 3], [-1.62, 10, 2]];
const PALM_FRONT = [[3.05, 16, 8], [0.09, 16, 8], [2.45, 15, 10], [0.7, 15, 10], [1.85, 10, 6], [1.3, 11, 6]];
/** A palm's crown at (cx, cy), k its size (1 grown), with coconuts. */
function palmCrown(s, cx, cy, k, wilt, v, PL, nuts) {
  const j = (n) => (h2(n, v, 41) - 0.5) * 0.25;
  const w = 2.7 * Math.min(1, 0.45 + k * 0.6);
  PALM_BACK.forEach(([a, len, dr], n) => frond(s, cx, cy, a + j(n), len * k, (dr + wilt * 3) * k, PL, { back: true, k: n, w }));
  if (nuts) [[-1, 2, 0], [2, 3, 1], [0, 4, 0]].forEach(([dx, dy, q]) => dab(s, Math.round(cx + dx - 1), Math.round(cy + dy - 1), ['.cc.', 'cCcd', 'cccd', '.dd.'], nuts[q], tg('wood', nuts[q].c)));
  PALM_FRONT.forEach(([a, len, dr], n) => frond(s, cx, cy, a + j(n + 3), len * k, (dr + wilt * 3.5) * k, PL, { k: n + 3, w }));
}

/** A lit lump of rock, rx by ry, its foot at (cx, fy). R: rock ramp (dark .. light). */
function rockLump(s, cx, fy, rx, ry, R, seed = 0, kind = 'rock') {
  for (let y = Math.floor(fy - ry * 2); y <= fy; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
    const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - (fy - ry)) / ry;
    const w = (vnoise(x, y, 3, seed) - 0.5) * 0.3;
    if (dx * dx + dy * dy > 1 + w || y > fy) continue;
    const l = -(dx * 0.6 + dy * 0.8) + (bayer(x, y) - 0.5) * 0.3;
    let i = l > 0.5 ? 5 : l > 0.1 ? 4 : l > -0.35 ? 3 : 2;
    if (h2(x, y, seed + 3) < 0.08) i -= 1;
    s.set(x, y, R[clamp(i, 1, 6)], tg(kind, R[3]));
  }
}

// ---------- Sunset Beach ----------

const SUN = {
  palm: ['#1c4446', '#265e4a', '#33804e', '#4ea056', '#7cc060', '#b2dc74', '#e0f29a'],
  trunk: ['#4a3036', '#6e4a40', '#946a50', '#b88c62', '#d4ae7e', '#ecd0a0'],
  sand: ['#a87e7c', '#cc9e86', '#e2b98e', '#f0d0a2'],
  glossy: ['#123828', '#1c5034', '#286a3c', '#368444', '#52a04e', '#7ebc5c', '#b4dc7c'],
  frangi: ['#1c4634', '#26603a', '#347e42', '#46984a', '#62b252', '#8ccc64', '#bce68a'],
  pale: ['#5a4a4a', '#7a6660', '#9a8478', '#b8a090', '#d0baa6', '#e6d4c0', '#f6ecdc'],
};
const NUTS = { green: { c: '#6a8a3a', C: '#b8d070', d: '#3e5a2e' }, brown: { c: '#7a5a3a', C: '#c8a070', d: '#4a3a2e' } };
const HIBISCUS = [['#9a1830', '#e03040', '#ff7060', '#ffd040'], ['#a82a6a', '#f05a9a', '#ff9ac4', '#ffe060'], ['#b8481a', '#f88030', '#ffb860', '#ffe8a0'], ['#b88a10', '#f8c830', '#fff080', '#e04a3a']];

/** A big hibiscus flower: five round petals round a long red stamen. */
const hibiscusHead = (s, x, y, C) => dab(s, x - 2, y - 2, ['.bb..', 'bcbb.', 'bbydb', '.bdbb', '..ba.'], { a: C[0], b: C[1], c: C[2], d: mix(C[1], C[0], 0.5), y: C[3] }, tg('fl', C[1]));

function palmTree(s, stage, wilt, v) {
  const fx = 40; const fy = 80;
  const lean = [-5, 4, 6, -3][v] * (stage / 5);
  if (stage === 0) {
    // a coconut on the sand putting up its first leaves
    s.shadow(fx + 1, fy + 1, 5, 1.3, 0.2);
    dab(s, fx - 3, fy - 4, ['.ccc.', 'cCccd', 'ccccd', '.ddd.'], NUTS.brown, tg('wood', NUTS.brown.c));
    for (let y = fy - 9; y < fy - 4; y += 1) s.set(fx + (y < fy - 7 && wilt > 1 ? 1 : 0), y, SUN.palm[3], tg('frond', SUN.palm[2]));
    frond(s, fx, fy - 8, -2.2, 6, 1 + wilt, SUN.palm, { w: 1.2 }); frond(s, fx, fy - 8, -0.9, 6, 1 + wilt, SUN.palm, { w: 1.2, k: 1 }); frond(s, fx, fy - 9, -1.6, 4, wilt, SUN.palm, { w: 1, k: 2 });
    return;
  }
  const L = [0, 6, 12, 19, 26, 33][stage]; const k = [0, 0.42, 0.6, 0.76, 0.9, 1.05][stage];
  s.shadow(fx + 5 + lean, fy, 6 + stage * 2.2, 2 + stage * 0.3, 0.22);
  // a young palm beside the grand one
  if (stage === 5 && v % 2 === 0) { const [bx, by] = palmTrunk(s, fx - 12, fy - 1, 12, -3, 1.8, SUN.trunk, v + 1); palmCrown(s, bx, by, 0.55, wilt, v + 1, SUN.palm, null); }
  const [cx, cy] = palmTrunk(s, fx, fy, L, lean, [0, 1.6, 2, 2.3, 2.6, 2.9][stage], SUN.trunk, v);
  palmCrown(s, cx, cy, k, wilt, v, SUN.palm, stage >= 3 ? (stage === 3 ? [NUTS.green, NUTS.green, NUTS.green] : [NUTS.brown, NUTS.green, NUTS.brown]) : null);
  if (stage === 5) [[-7, 1], [9, 0]].forEach(([dx, dy], q) => { if (h2(q, wilt, 3) > wilt * 0.25) dab(s, fx + dx, fy + dy - 2, ['cc.', 'Ccd', '.dd'], NUTS.brown, tg('wood', NUTS.brown.c)); });
  if (wilt >= 2) frond(s, fx + 8, fy, -0.15, 9, 1, SUN.palm.map((c) => mix(c, '#c8a060', 0.5)), { w: 1.4, k: 9, kind: 'ground' });
}

function frangipani(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const BK = SUN.pale; const P = SUN.frangi;
  const C = v % 2 ? ['#d04a7a', '#ff9ac0', '#fff0f4', '#ffe060'] : ['#c8a040', '#fff4d8', '#ffffff', '#ffc830'];
  if (stage === 0) { sapling(s, fx, fy, { BK, P, soil: SUN.sand, wilt, stake: false }); return; }
  const H = [0, 8, 12, 17, 21, 25][stage]; const spread = [0, 3, 6, 9, 12, 15][stage];
  s.shadow(fx + 2, fy, spread + 5, 2 + stage * 0.35, 0.22);
  const tips = [];
  // the trunk forks into smooth candelabra branches
  const fork = (x, y, len, ang, depth, w) => {
    const x1 = x + Math.sin(ang) * len; const y1 = y - Math.cos(ang) * len + (wilt * depth * 0.4);
    branch(s, Math.round(x), Math.round(y), Math.round(x1), Math.round(y1), w, BK);
    if (depth <= 0) { tips.push([Math.round(x1), Math.round(y1)]); return; }
    const sp = 0.42 + depth * 0.06;
    fork(x1, y1, len * 0.72, ang - sp, depth - 1, Math.max(1, w - 1));
    fork(x1, y1, len * 0.72, ang + sp, depth - 1, Math.max(1, w - 1));
  };
  const depth = stage >= 4 ? 2 : stage >= 2 ? 1 : 0;
  fork(fx, fy, H * 0.45, (h2(v, 1, 2) - 0.5) * 0.3, depth, Math.max(1, Math.round(stage * 0.7)));
  // leaf rosettes at the tips, flowers in their middle
  tips.sort((a, b) => a[1] - b[1]).forEach(([x, y], n) => {
    const lv = 7;
    for (let q = 0; q < lv; q += 1) {
      const a = -Math.PI / 2 + (q - (lv - 1) / 2) * 0.55 + (h2(q, n, v) - 0.5) * 0.3;
      const len = 3 + Math.min(5, stage * 1.05);
      const dr = 1 + wilt * 1.2;
      for (let t = 1; t <= len; t += 0.5) {
        const xx = Math.round(x + Math.cos(a) * t * 1.15); const yy = Math.round(y + Math.sin(a) * t * 0.8 + (t / len) ** 2 * dr);
        const c = t > len - 1 ? P[5] : Math.cos(a) < 0 ? P[4] : P[3];
        s.set(xx, yy, c, tg('leaf', P[3])); if (t > 1.5 && t < len - 0.8) s.set(xx, yy + 1, P[2], tg('leaf', P[3]));
      }
    }
    if (stage >= 3 && h2(n, stage, 7) > wilt * 0.25) {
      // a posy of pinwheel flowers on each rosette
      const fl = (xx, yy, k) => dab(s, xx - 1, yy - 1, k % 2 ? ['bb.', 'aYb', '.aa'] : ['.bb', 'bYa', 'aa.'], { a: C[1], b: C[2], Y: C[3] }, tg('fl', C[0]));
      [[0, -3], [2, -1], [-2, -1], [1, -5], [-1, 0]].slice(0, stage - 1).forEach(([dx, dy], k) => fl(x + dx, y + dy, k + n));
    }
  });
  if (stage === 5) for (let q = 0; q < 5; q += 1) { const x = fx + Math.round((h2(q, v, 9) - 0.5) * 24); const y = fy + Math.round(h2(v, q, 9) * 3) - 1; if (!s.get(x, y) && h2(q, 3, wilt) > wilt * 0.25) dab(s, x, y, ['ab'], { a: C[1], b: C[2] }, 'ground'); }
}

TREES['bg-sunset'] = {
  kinds: ['palm', 'hibiscus', 'palm', 'frangipani'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'palm') return palmTree(s, stage, wilt, v);
    if (kind === 'frangipani') return frangipani(s, stage, wilt, v);
    const C = HIBISCUS[v];
    return bushy(s, stage, wilt, v, { P: SUN.glossy, BK: SUN.trunk, soil: SUN.sand, R: [0, 6, 9, 12, 14, 17], ry: 0.72, every: [0, 9, 8, 7, 6, 6], head: (x, y, k) => hibiscusHead(s, x, y, k % 5 === 4 ? HIBISCUS[(v + 1) % 4] : C) });
  },
};

FLOWERS['bg-sunset'] = {
  draw(s, kind, stage, wilt, old, v) {
    const G = ['#2a6a3c', '#3e8a44', '#5aa64e', '#86c060'];
    if (stage === 0) { sprouts(s, v, ['#2a6a3c', '#3e8a44', '#5aa64e', '#86c060'], null, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.18);
    const pale = (c) => (old ? mix(c, '#fff4ec', 0.14 * old) : c);
    if (kind === 0) {
      // a hibiscus shrublet: glossy leaves and one or two big flowers
      // a little upright shrub on a woody stem, taller than the roses
      for (let y = FY - 4; y <= FY; y += 1) { s.set(FX, y, SUN.trunk[3], tg('wood', SUN.trunk[2])); s.set(FX + 1, y, SUN.trunk[2], tg('wood', SUN.trunk[2])); }
      const leaves = [[0, -8, 5], [-4, -6, 3.8], [4, -7, 3.8], [-1, -12, 3.6], [2, -4, 3]];
      const lv = stage === 1 ? leaves.slice(0, 3).map(([x, y, r]) => [x, y * 0.7, r * 0.75]) : leaves;
      leafMass(s, lv.map(([x, y, r]) => [FX + x + (v === 1 ? 1 : 0), FY + y + 1 + wilt * 0.5, r]), SUN.glossy, { seed: v + 3, thin: wilt });
      if (stage === 1) return;
      const C = HIBISCUS[(v + (v === 2 ? 1 : 0)) % 4].map(pale);
      const at = v === 2 ? [[-1, -12]] : [[-3, -11], [3, -7]];
      at.forEach(([dx, dy], i) => {
        const x = FX + dx + (wilt >= 2 ? 1 : 0); const y = FY + dy + wilt;
        if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: '#3e8a44', b: C[1] }, tg('fl', C[1])); return; }
        if (wilt >= 2 || (old === 2 && i)) { dab(s, x - 1, y, ['bb.', '.ab', '..a'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
        hibiscusHead(s, x, y, C);
      });
      return;
    }
    if (kind === 1) {
      // beach roses: a low prickly mound, flat pink roses with gold hearts, and red hips once they fade
      leafMass(s, [[FX - 5, FY - 2, 3.6], [FX + 5, FY - 2, 3.6], [FX, FY - 4, 4.6]].map(([x, y, r]) => [x, y + wilt * 0.5, r * (stage === 1 ? 0.7 : 1)]), ['#183c2c', '#245434', '#326c3a', '#428440', '#5e9e4a', '#80b85a', '#aad27a'], { seed: v + 9, thin: wilt });
      if (stage === 1) return;
      const C = (v === 1 ? ['#a02a5a', '#e05a8e', '#ff9cc0', '#ffe070'] : ['#b03a6a', '#f07aaa', '#ffc0d8', '#ffe070']).map(pale);
      [[-5, -4], [3, -6], [-1, -8], [6, -3]].slice(0, v === 2 ? 3 : 4).forEach(([dx, dy], i) => {
        const x = FX + dx; const y = FY + dy + wilt;
        if (stage === 2) { dab(s, x, y, ['b', 'a'], { a: '#5e9e4a', b: C[1] }, tg('fl', C[1])); return; }
        if (old === 2 && i % 2) { dab(s, x, y, ['ab', 'bb'], { a: '#ff6a4a', b: '#d0302a' }, tg('fruit', '#d0302a')); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['bab'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
        dab(s, x - 1, y - 1, ['.c.', 'cyb', '.b.'], { a: C[0], b: C[1], c: C[2], y: C[3] }, tg('fl', C[1]));
      });
      return;
    }
    if (kind === 2) {
      // dune grass: long blades arching in the wind, and golden seed plumes when it blooms
      const B = ['#5a7a4a', '#7a9a58', '#a0b86a', '#c8d48a'];
      const blades = [[-5, 9, -3], [-3, 12, -2], [-1, 14, 1], [1, 11, 3], [3, 13, 4], [5, 9, 5], [0, 8, -4], [6, 7, 6]];
      blades.forEach(([dx, h, lean], i) => {
        const hh = Math.round(h * (stage === 1 ? 0.55 : stage === 2 ? 0.85 : 1)) - wilt;
        const bend = lean * 0.5 + wilt * (lean < 0 ? -1 : 1) * 0.8;
        let last = null;
        for (let k = 0; k <= hh; k += 1) { const t = k / hh; const x = Math.round(FX + dx + bend * t * t * 2); const y = FY - k + Math.round(Math.abs(bend) * t * t * (wilt ? 1.2 : 0.4)); s.set(x, y, B[t < 0.3 ? 0 : t < 0.7 ? 1 : 2], tg('stem', B[0])); last = [x, y]; }
        if (stage === 3 && i % 2 === 0 && i < 6) {
          const [x, y] = last; const Y = (old ? ['#c8a050', '#e8c878', '#f8e8b8'] : ['#c09040', '#e8c060', '#fff0a8']);
          for (let k = 0; k < 4; k += 1) s.set(x + (k % 2 ? 1 : 0) * (lean < 0 ? -1 : 1), y + k, Y[k === 0 ? 2 : k < 3 ? 1 : 0], tg('fl', Y[1]));
        }
        if (stage === 2 && i % 3 === 0) { const [x, y] = last; s.set(x, y, '#d8c888', tg('stem', B[0])); }
      });
      return;
    }
    // a beach morning glory creeping over the sand: heart leaves and purple trumpets, open wide
    const V = ['#2a5a3a', '#3a7a44', '#58a050', '#84c060'];
    const reach = stage === 1 ? 5 : 9;
    for (const dir of [-1, 1]) for (let k = 0; k <= reach; k += 1) {
      const x = FX + dir * k; const y = FY - 1 + Math.round(Math.sin(k * 0.8 + v) * 0.8);
      s.set(x, y, V[1], tg('stem', V[0]));
      if (k % 3 === 1) dab(s, x - 1, y - 2 + (k % 2), ['ab.', 'bbc', '.c.'], { a: V[3], b: V[2], c: V[1] }, tg('leaf', V[1]));
    }
    if (stage === 1) return;
    const C = (v === 1 ? ['#8a2a8a', '#c85ac8', '#f0a8f0', '#ffffff'] : ['#7a2aa0', '#b05ad8', '#e0a8f8', '#fff4ff']).map(pale);
    [[-7, -2], [-2, -4], [4, -3], [8, -1]].slice(0, v === 2 ? 3 : 4).forEach(([dx, dy], i) => {
      const x = FX + dx; const y = FY + dy + Math.floor(wilt / 2);
      if (stage === 2 || (wilt >= 2 && i % 2)) { dab(s, x, y, ['ab'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
      dab(s, x - 1, y - 1, ['bcb', 'cwb', '.a.'], { a: C[0], b: C[1], c: C[2], w: C[3] }, tg('fl', C[1]));
    });
  },
};

const HERMIT = [
  ['..sss....', '.sSSss.e.', 'sSssSs.r.', 'sSsSSsrrR', '.ssssrrrr', '..r.r.r..'],
  ['..sss....', '.sSSss..e', 'sSssSs.r.', 'sSsSSsrrR', '.ssssrrrR', '.r.r.r...'],
];
const PELICAN = [
  ['..ww............', '...www..........', '....wwww....HH..', '.tbbbbbbbbbHHHKy', '..bbbbbbbbb.yyyy', '............yyy.'],
  ['............HH..', '.tbbbbbbbbbHHHKy', '..bbbbwwwbb.yyyy', '.....wwww...yyy.', '......www.......', '................'],
];
const NESTER = [
  ['.....ssssss.......', '...ssSsSsSsss.....', '..sSsSsSsSsSss.hh.', '.fssssssssssssshhK', 'ff.ssssssssss.fhhh', '..ff.......ff.....', '.......ooo........'],
  ['.....ssssss.......', '...ssSsSsSsss.....', '..sSsSsSsSsSss.....', 'fssssssssssssshh..', '.f.ssssssssss.hhhK', '.ff........fffhhh.', '.......ooo........'],
];
const HATCHLING = [['.ss.h.', 'sSsshK', 'f..f..'], ['.ss.h.', 'sSsshK', '.f..f.']];

CRITTERS['bg-sunset'] = [
  { id: 'crab', frames: 2, size: [11, 8], moves: 'walk', level: 1, variants: 3 },
  { id: 'pelican', frames: 2, size: [18, 8], moves: 'fly', level: 2 },
  { id: 'turtle', frames: 2, size: [20, 9], moves: 'sit', level: 3 },
  { id: 'hatchling', frames: 2, size: [8, 5], moves: 'walk', level: 4 },
];
CRITTERS_ART['bg-sunset'] = {
  crab: (f, v) => { const S = [['#f0d8b8', '#c89a7a'], ['#f8c8d8', '#d888a8'], ['#d8e8f0', '#88a8c8']][v]; return critterOf('bg-sunset', HERMIT[f], { s: [S[0], 'shell'], S: [S[1], 'shell'], r: '#e05a3a', R: '#f07a4a', e: '#2a1838' }, { feet: true, shadow: [4, 1] }); },
  pelican: (f) => critterOf('bg-sunset', PELICAN[f], { b: ['#f4f0ec', 'fur'], w: ['#9a9aa8', 'fur'], H: ['#ffffff', 'fur'], t: ['#5a5a6a', 'fur'], y: ['#f8b84a', 'fur'] }),
  turtle: (f) => critterOf('bg-sunset', NESTER[f], { s: '#6a7a3a', S: '#9aa850', f: '#8a9a5a', h: '#9aa860', o: ['#fff8e8', 'shell'] }, { feet: true, shadow: [9, 1.6] }),
  hatchling: (f) => critterOf('bg-sunset', HATCHLING[f], { s: '#4a5a3a', S: '#7a8a50', f: '#5a6a40', h: '#6a7a48' }, { feet: true }),
};

// ---------- Under the Sea ----------

const SEA = {
  rock: ['#1a2244', '#262f5a', '#363f72', '#4a548a', '#6470a2', '#8894bc', '#b0bad4'],
  kelp: ['#16362e', '#1f4a38', '#2c6040', '#3e7a48', '#589650', '#7cb45a', '#a8d06a', '#d4e888'],
};
// coral colours, each a ramp dark .. light
const CORAL = [ramp('#ff7a5a', 3, 3), ramp('#c86ae0', 3, 3), ramp('#ffc83a', 3, 3), ramp('#ff6aa8', 3, 3), ramp('#5ad8c8', 3, 3)];

/** Brain coral: a dome of winding ridges and grooves. */
function brainCoral(s, cx, fy, rx, P, seed) {
  const ry = rx * 0.72;
  for (let y = Math.floor(fy - ry * 2); y <= fy; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
    const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - (fy - ry * 0.85)) / ry;
    if (dx * dx + dy * dy > 1 || y > fy) continue;
    const l = -(dx * 0.55 + dy * 0.85);
    let i = l > 0.45 ? 5 : l > 0 ? 4 : l > -0.45 ? 3 : 2;
    const g = Math.sin((x * 0.9 + vnoise(x, y, 5, seed) * 9 + y * 0.35) * 1.3);
    if (g > 0.55) i -= 2; else if (g > 0.2) i -= 1;
    if (rx > 6 && h2(x, y, seed) > 0.96) i = 6;
    s.set(x, y, P[clamp(i, 0, 6)], tg('coral', P[3]));
  }
}

/** Branching coral: arms forking up from the rock, lit tips and pale polyps. */
function staghorn(s, x0, y0, size, P, seed, wilt) {
  const tag = tg('coral', P[3]);
  const arm = (x, y, len, ang, depth, w) => {
    const n = Math.max(2, Math.round(len * 1.5));
    let xx = x; let yy = y;
    for (let i = 1; i <= n; i += 1) {
      const t = i / n; const a = ang + wilt * 0.12 * Math.sign(ang || 1) * t;
      xx = x + Math.sin(a) * len * t; yy = y - Math.cos(a) * len * t;
      for (let d = 0; d < w; d += 1) s.set(Math.round(xx) + d, Math.round(yy), d === 0 && w > 1 ? P[4] : P[3], tag);
    }
    if (depth <= 0 || len < 3) { s.set(Math.round(xx), Math.round(yy), P[6], tag); s.set(Math.round(xx) + 1, Math.round(yy), P[5], tag); s.set(Math.round(xx), Math.round(yy) - 1, P[5], tag); return; }
    const sp = 0.45 + h2(depth, seed, 3) * 0.25;
    arm(xx, yy, len * 0.72, ang - sp, depth - 1, Math.max(1, w - 1));
    arm(xx, yy, len * 0.68, ang + sp, depth - 1, Math.max(1, w - 1));
    if (depth >= 2 && h2(seed, depth, 4) > 0.5) arm(xx, yy, len * 0.55, ang + (h2(depth, seed, 5) - 0.5) * 0.4, depth - 2, 1);
  };
  const depth = size < 6 ? 1 : size < 10 ? 2 : 3;
  arm(x0, y0, size * 0.5, -0.5, depth, size > 9 ? 3 : 2);
  arm(x0 + 1, y0, size * 0.58, 0.1, depth, size > 9 ? 3 : 2);
  if (size > 7) arm(x0 + 2, y0, size * 0.45, 0.65, depth - 1, 2);
  // polyps
  s.b.each((x, y) => { if (s.kind(x, y) === 'coral' && h2(x, y, seed + 9) > 0.93 && s.get(x, y - 1)) s.set(x, y, '#fff4e8'); });
}

/** A sea fan: a lacy fan on a short stalk. */
function seaFan(s, cx, fy, r, P, wilt) {
  const tag = tg('coral', P[3]); const by = fy - 2;
  const lean = wilt * 0.08;
  for (let y = Math.floor(by - r * 1.15 - 1); y <= by; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
    const dx = x + 0.5 - cx - (by - y) * lean; const dy = (y + 0.5 - by) * 1.15;
    const d = Math.hypot(dx, dy);
    if (d > r || y > by - 1) continue;
    const a = Math.atan2(dy, dx);
    const spoke = Math.abs(((a / Math.PI) * (6 + r * 0.4) + 20) % 1 - 0.5) > 0.34;
    const arc = d > r - 1 || Math.abs(d - r * 0.66) < 0.5 || Math.abs(d - r * 0.36) < 0.5;
    if (!spoke && !arc) { if ((x + y) % 2 === 0 && d < r - 1) s.set(x, y, P[2], tag); continue; }
    s.set(x, y, d > r - 1 ? P[5] : dx < 0 ? P[4] : P[3], tag);
  }
  for (let y = by - 2; y <= fy; y += 1) { s.set(Math.round(cx), y, P[1], tag); s.set(Math.round(cx) + 1, y, P[2], tag); }
}

/** Giant kelp: stalks swaying up from a holdfast, long blades and golden floats. */
function kelpStand(s, fx, fy, H, n, wilt, seed) {
  const K = SEA.kelp; const tag = tg('leaf', K[3]);
  for (let st = 0; st < n; st += 1) {
    const bx = fx - (n - 1) * 2 + st * 4; const top = Math.round(H * (0.75 + h2(st, seed, 2) * 0.25));
    for (let k = 0; k < top; k += 1) {
      const y = fy - k; const sway = Math.sin(k / 6 + st * 2 + seed) * 2 + (k / top) ** 2 * wilt * 3 * (st % 2 ? 1 : -1);
      const x = Math.round(bx + sway);
      s.set(x, y, K[3], tag); s.set(x + 1, y, K[2], tag);
      if ((k + st * 3) % 6 === 0 && k > 2 && k < top - 2) {
        const dir = (Math.floor(k / 6) + st) % 2 ? 1 : -1; const bl = 3 + Math.min(4, Math.round(H / 14));
        for (let q = 1; q <= bl; q += 1) { const xx = x + dir * q; const yy = y - Math.round(q * 0.45) + Math.round(wilt * q * 0.35); s.set(xx, yy, q > bl - 2 ? K[6] : K[5], tag); s.set(xx, yy + 1, K[4], tag); }
        s.set(x + dir, y + 1, '#e0c058', tg('fruit', '#c8a040'));
      }
    }
    const tx = Math.round(bx + Math.sin(top / 6 + st * 2 + seed) * 2 + wilt * (st % 2 ? 1 : -1));
    s.set(tx, fy - top, K[7], tag); s.set(tx + 1, fy - top + 1, K[6], tag);
  }
}

function reef(s, kind, stage, wilt, v) {
  const fx = 40; const fy = 80;
  const P = CORAL[(v + (kind === 'fan' ? 1 : kind === 'brain' ? 2 : 0)) % CORAL.length];
  const seed = v * 13 + 5;
  // the bare rock the reef grows over: it stays, and the coral covers more of it
  const rw = kind === 'kelp' ? 7 : 9; const rh = kind === 'kelp' ? 3 : 4.5;
  s.shadow(fx + 2, fy, rw + 2 + stage * 1.6, 2 + stage * 0.3, 0.26);
  if (kind === 'brain') {
    rockLump(s, fx, fy, rw, rh, SEA.rock, seed);
    if (stage === 0) { dab(s, fx - 2, fy - 7, ['ab.b', '.a..'], { a: P[3], b: P[5] }, tg('coral', P[3])); return; }
    const rx = [0, 5, 8, 11, 14, 17][stage] - wilt * 0.6;
    brainCoral(s, fx + 1, fy, rx, P, seed);
    if (stage >= 3) brainCoral(s, fx - rx * 0.75, fy + 1, rx * 0.5, CORAL[(v + 3) % 5], seed + 2);
    if (stage >= 4) staghorn(s, fx + rx * 0.7, fy - 1, stage * 1.4, CORAL[(v + 4) % 5], seed + 4, wilt);
  } else if (kind === 'staghorn') {
    rockLump(s, fx, fy, rw, rh, SEA.rock, seed);
    if (stage === 0) { dab(s, fx, fy - 9, ['.c', 'bc', 'b.'], { b: P[3], c: P[5] }, tg('coral', P[3])); return; }
    staghorn(s, fx - 1, fy - 5, [0, 7, 11, 15, 19, 23][stage], P, seed, wilt);
    if (stage >= 3) staghorn(s, fx - 7, fy - 2, stage * 2.2, CORAL[(v + 2) % 5], seed + 6, wilt);
    if (stage >= 5) brainCoral(s, fx + 7, fy + 1, 5, CORAL[(v + 3) % 5], seed + 7);
  } else if (kind === 'fan') {
    rockLump(s, fx, fy, rw, rh, SEA.rock, seed);
    if (stage === 0) { s.set(fx, fy - 9, P[4], tg('coral', P[3])); s.set(fx, fy - 10, P[5], tg('coral', P[3])); s.set(fx + 1, fy - 10, P[3], tg('coral', P[3])); return; }
    const r = [0, 6, 9, 13, 17, 21][stage];
    if (stage >= 4) seaFan(s, fx - 8, fy - 3, r * 0.6, CORAL[(v + 3) % 5], wilt);
    seaFan(s, fx + 1, fy - 5, r, P, wilt);
    if (stage >= 3) brainCoral(s, fx + 7, fy + 1, 4 + stage * 0.4, CORAL[(v + 2) % 5], seed + 3);
  } else {
    rockLump(s, fx, fy, rw, rh, SEA.rock, seed);
    if (stage === 0) { kelpStand(s, fx, fy - 4, 5, 1, wilt, seed); return; }
    kelpStand(s, fx, fy - 4, [0, 12, 22, 34, 46, 58][stage], [0, 1, 2, 2, 3, 4][stage], wilt, seed);
    if (stage >= 3) brainCoral(s, fx - 8, fy + 1, 3 + stage * 0.5, CORAL[(v + 1) % 5], seed + 1);
  }
  // the grown reef: a starfish on the rock and bubbles rising
  if (stage === 5) {
    dab(s, fx + 4, fy - 2, ['.a.', 'aba', 'a.a'], { a: '#ff8a4a', b: '#ffd0a0' }, tg('fruit', '#e06a3a'));
    if (wilt < 2) [[-3, 46], [-1, 52], [-4, 57]].forEach(([dx, dy]) => s.set(fx + dx + 12, fy - dy * (kind === 'kelp' ? 1.15 : 0.8), '#c8f0ff', 'fx'));
  }
}

TREES['bg-ocean'] = {
  kinds: ['brain', 'staghorn', 'fan', 'kelp'],
  draw: (s, kind, stage, wilt, v) => reef(s, kind, stage, wilt, v),
};

FLOWERS['bg-ocean'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#f0f0e8', 0.12 * old) : c);
    s.shadow(FX, FY + 1, 6, 1.4, 0.22);
    // a pebble they grow on
    rockLump(s, FX + (v === 1 ? 2 : 0), FY + 1, 4, 1.6, SEA.rock, v + kind * 5);
    if (stage === 0) { [[-2, -3], [1, -4], [3, -2]].forEach(([dx, dy], i) => s.set(FX + dx, FY + dy, CORAL[(kind + i) % 5][5], tg('coral', CORAL[kind][3]))); return; }
    if (kind === 0) {
      // anemones: a soft column and a crown of waving tentacles, glowing at the tips
      const C = [['#c04a8a', '#ff7ab8', '#ffc0e0', '#fff0f8'], ['#7a4ab8', '#b07ae8', '#d8b8ff', '#f4ecff'], ['#3a9a7a', '#5ad8a8', '#a8f4d0', '#ecfff6']][v].map(pale);
      const n = stage === 1 ? 5 : stage === 2 ? 7 : 11; const len = stage === 1 ? 2 : stage === 2 ? 4 : 6;
      for (let k = 0; k < n; k += 1) {
        const bx = FX - n * 0.45 + k * 0.9; const l = len + Math.round(Math.sin(k * 1.3 + v) * 1.2) - Math.floor(wilt / 2);
        for (let j = 0; j < l; j += 1) {
          const x = Math.round(bx + Math.sin(j / 2 + k) * 1.1 + (j / l) * (k - n / 2) * 0.25 * (1 + wilt * 0.5)); const y = FY - 2 - j + Math.round((j / l) ** 2 * wilt);
          s.set(x, y, j > l - 2 ? C[3] : j > l - 3 ? C[2] : C[1], tg('fl', C[0]));
        }
      }
      for (let x = -2; x <= 2; x += 1) s.set(FX + x, FY - 1, x < 0 ? C[1] : C[0], tg('fl', C[0]));
      return;
    }
    if (kind === 1) {
      const P = CORAL[[0, 2, 4][v]].map(pale);
      staghorn(s, FX - 1, FY - 1, [0, 4, 6, 9][stage], P, v + 3, wilt);
      if (stage === 3) staghorn(s, FX + 3, FY, 5, CORAL[(v + 3) % 5].map(pale), v + 7, wilt);
      return;
    }
    if (kind === 2) {
      const P = CORAL[[1, 3, 0][v]].map(pale);
      seaFan(s, FX, FY - 1, [0, 4, 6, 8][stage], P, wilt);
      return;
    }
    // tube sponges: bright tubes with dark open mouths
    const P = [ramp('#ffb83a', 3, 3), ramp('#b06ae8', 3, 3), ramp('#ff6a4a', 3, 3)][v].map(pale);
    const tubes = [[-3, 6], [0, 9], [3, 5], [5, 3]].slice(0, stage === 1 ? 2 : 4);
    tubes.forEach(([dx, h], i) => {
      const hh = Math.round(h * [0, 0.4, 0.7, 1][stage]) + 1 - Math.floor(wilt / 2);
      const lean = wilt >= 2 ? (dx < 0 ? -1 : 1) : 0;
      for (let k = 0; k < hh; k += 1) { const x = FX + dx + Math.round((k / hh) * lean * 2); s.set(x, FY - 1 - k, P[4], tg('coral', P[3])); s.set(x + 1, FY - 1 - k, i % 2 ? P[2] : P[3], tg('coral', P[3])); }
      const x = FX + dx + lean * 2; s.set(x, FY - hh, P[1], tg('coral', P[3])); s.set(x + 1, FY - hh, P[0], tg('coral', P[3])); s.set(x, FY - hh - 1, P[5], tg('coral', P[3])); s.set(x + 1, FY - hh - 1, P[5], tg('coral', P[3]));
    });
  },
};

const CLOWN = [
  ['...ooo...', 'f.oWoWooo', 'ffoWoWoKo', 'f.oWoWooo', '...o.o...'],
  ['...ooo...', '..oWoWooo', 'ffoWoWoKo', '..oWoWooo', '...o.o...'],
];
const SEAHORSE = [
  ['..hhh.', '.hhhKh', '.hhh.nn', '.dhh...', 'ddhh...', '.dhh...', '..hhh..', '...hh..', '..hd...', '..dh...'],
  ['..hhh.', '.hhhKh', '.hhh.nn', '..hhd..', '.hhdd..', '.hhd...', '..hhh..', '...hh..', '...hd..', '..hd...'],
];
const RAY = [
  ['......ww.....', '.....wwwww...', '....wwwwwwww.', 'tttbbbbbbbbKb', '....dddddddd.', '.....ddddd...', '......dd.....'],
  ['.............', '.....wwww....', '...wwwwwwwww.', 'tttbbbbbbbbKb', '...ddddddddd.', '.....dddd....', '.............'],
];
const SEATURTLE = [
  ['....ff..........', '.....ff.........', '...ssssss.......', '..sSsSsSss..hh..', 'tsSsSsSsSssshhKh', '..ssssssss..hhh.', '....dd...ff.....', '.....dd...ff....'],
  ['................', '.....ff.........', '...sssssf.......', '..sSsSsSss..hh..', 'tsSsSsSsSssshhKh', '..ssssssss..hhh.', '.....dd.ff......', '................'],
];

CRITTERS['bg-ocean'] = [
  { id: 'clownfish', frames: 2, size: [11, 7], moves: 'swim', level: 1 },
  { id: 'seahorse', frames: 2, size: [9, 12], moves: 'swim', level: 2, variants: 2 },
  { id: 'ray', frames: 2, size: [15, 9], moves: 'swim', level: 3 },
  { id: 'turtle', frames: 2, size: [18, 10], moves: 'swim', level: 4 },
];
CRITTERS_ART['bg-ocean'] = {
  clownfish: (f) => critterOf('bg-ocean', CLOWN[f], { o: ['#ff7a2a', 'fur'], W: ['#ffffff', 'fur'], f: ['#ff9a4a', 'fur'] }),
  seahorse: (f, v) => { const C = v ? ['#ff9ac0', '#d86a98'] : ['#ffc83a', '#e0962a']; return critterOf('bg-ocean', SEAHORSE[f], { h: [C[0], 'fur'], d: [C[1], 'fur'], n: [C[1], 'fur'] }); },
  ray: (f) => critterOf('bg-ocean', RAY[f], { w: ['#8aa4c8', 'fur'], b: ['#6a84b0', 'fur'], d: ['#4e6694', 'fur'], t: ['#4e6694', 'fur'] }),
  turtle: (f) => critterOf('bg-ocean', SEATURTLE[f], { s: ['#6a8a4a', 'fur'], S: ['#a8b860', 'fur'], f: ['#8aa86a', 'fur'], d: ['#6a8a5a', 'fur'], h: ['#9ab878', 'fur'], t: ['#8aa86a', 'fur'] }),
};

// ---------- Moon Base ----------

const MOON = {
  dust: ['#22213a', '#302f52', '#403f68', '#52537e', '#666a96', '#7c80ac', '#9498c2', '#b2b4d4'],
  steel: ['#252a40', '#363d5a', '#4c5476', '#667092', '#8690b0', '#a8b0cc', '#ccd2e4', '#eef0f8'],
  moss: ['#0e3a3a', '#145a4a', '#1e7a58', '#2ea064', '#4ec878', '#8ae890', '#d0ffc0'],
};
const GEMS = [ramp('#5ae8e0', 3, 3), ramp('#ff8ad8', 3, 3), ramp('#b08aff', 3, 3), ramp('#ffd85a', 3, 3)];

/** A crystal shard standing on base: a prism with a pointed tip, lit on its left face. */
function shard(s, cx0, base, w, h, P, lean = 0, kind = 'crys') {
  const tag = tg(kind, P[2]); const tip = Math.max(2, w * 0.9);
  for (let y = Math.floor(base - h); y <= base; y += 1) {
    const yy = y - (base - h);
    const half = yy < tip ? (yy / tip) * (w / 2) : w / 2;
    const cx = cx0 + lean * ((base - y) / h) * 4;
    for (let x = Math.floor(cx - half); x <= cx + half; x += 1) {
      const u = (x + 0.5 - cx) / Math.max(0.5, half);
      let i = u < -0.35 ? 5 : u < 0.25 ? 4 : 2;
      if (yy < tip && u < 0.25) i += 1;
      if (Math.abs(u - 0.25) < 0.14 && half > 1.5) i = 6;
      if (yy > h * 0.75 && i > 2) i -= 1;
      s.set(x, y, P[clamp(i, 0, 6)], tag);
    }
  }
}

/** A little crater ring of moon dust round a foot. */
function craterRing(s, fx, fy, rx) {
  for (let y = fy - 2; y <= fy + 2; y += 1) for (let x = Math.floor(fx - rx - 1); x <= fx + rx + 1; x += 1) {
    const d = ((x + 0.5 - fx) / (rx + 1)) ** 2 + ((y + 0.5 - fy) / 2.4) ** 2;
    if (d > 1) continue;
    s.set(x, y, d > 0.55 ? (y < fy ? MOON.dust[3] : MOON.dust[6]) : MOON.dust[y < fy ? 2 : 4], 'ground');
  }
}

function crystalTree(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const P = GEMS[v % 4]; const Q = GEMS[(v + 1) % 4];
  craterRing(s, fx, fy, 4 + stage * 1.6);
  const H = [5, 10, 16, 24, 32, 40][stage] - wilt * 2;
  s.glow(fx, fy - 1, 6 + stage * 3, 2.5 + stage * 0.6, P[5], 0.5);
  if (stage >= 3) s.glow(fx, fy - H * 0.5, 6 + stage * 2, H * 0.55, P[5], 0.16, true);
  if (stage === 0) { shard(s, fx, fy - 1, 3, 5, P); shard(s, fx + 2, fy, 2, 3, P, 1); return; }
  const sag = wilt * 0.25;
  // side shards first (behind), the tall middle one, then the little ones in front
  const sides = [[-0.45, 0.55, -0.6, 0.62], [0.42, 0.6, 0.7, 0.55], [-0.75, 0.38, -1, 0.5], [0.78, 0.34, 1.1, 0.48], [-0.2, 0.7, -0.3, 0.58], [0.25, 0.66, 0.4, 0.6]];
  sides.slice(0, [0, 2, 2, 4, 5, 6][stage]).forEach(([dx, hf, lean, wf], k) => shard(s, fx + dx * (6 + stage * 3), fy - 1, Math.max(2, (3 + stage) * wf), H * hf, k % 3 === 2 ? Q : P, lean + sag * Math.sign(lean)));
  shard(s, fx, fy - 1, 3 + stage * 0.9, H, P, (v % 2 ? 0.2 : -0.2) + sag);
  if (stage >= 2) [[-3, 0.25, -0.8], [4, 0.2, 0.9], [1, 0.3, 0.2]].slice(0, stage - 1).forEach(([dx, hf, lean]) => shard(s, fx + dx, fy + 1, 2.4, H * hf + 2, Q, lean));
  // sparkles in the air round it
  if (stage >= 4 && wilt < 2) [[-12, 0.6], [11, 0.8], [-7, 1.05], [14, 0.4]].forEach(([dx, hf], k) => { if (k < stage - 1) { const x = fx + dx; const y = Math.round(fy - H * hf); s.set(x, y, '#ffffff', 'fx'); s.set(x - 1, y, P[5], 'fx'); s.set(x + 1, y, P[5], 'fx'); s.set(x, y - 1, P[5], 'fx'); s.set(x, y + 1, P[5], 'fx'); } });
  s.b.each((x, y) => { if (s.kind(x, y) === 'crys' && h2(x, y, v + 4) > 0.985) s.set(x, y, '#ffffff'); });
}

function greenhouse(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const ST = MOON.steel;
  const glassK = ['#5ab8c8', '#8ad8e0', '#c8f4f8'];
  const plants = [MOON.moss, ramp('#7ad84a', 3, 3), ramp('#4ab8a0', 3, 3)];
  const bloom = [ramp('#ff7ad0', 2, 3), ramp('#ffd84a', 2, 3), ramp('#7ae0ff', 2, 3)];
  const r = [5, 6, 9, 12, 15, 18][stage];
  s.shadow(fx + 2, fy, r + 2, 2.4, 0.26);
  // the steel ring it stands on, with little lights
  for (let x = fx - r - 1; x <= fx + r + 1; x += 1) for (let y = fy - 2; y <= fy; y += 1) s.set(x, y, y === fy - 2 ? ST[6] : y === fy - 1 ? ST[4] : ST[3], tg('metal', ST[3]));
  if (stage >= 2) for (let x = fx - r + 2; x < fx + r; x += 5) s.set(x, fy - 1, (x / 5) % 2 ? '#ffd43b' : '#74f0c0', 'fx');
  if (stage === 0) {
    for (let y = fy - 6; y < fy - 2; y += 1) s.set(fx, y, MOON.moss[4], tg('leaf', MOON.moss[3]));
    s.set(fx - 1, fy - 6 + (wilt ? 1 : 0), MOON.moss[5], tg('leaf', MOON.moss[3])); s.set(fx + 1, fy - 6 + (wilt ? 1 : 0), MOON.moss[6], tg('leaf', MOON.moss[3]));
    return;
  }
  const top = fy - 3; const ry = r * 0.95;
  const inDome = (x, y) => y <= top && ((x + 0.5 - fx) / r) ** 2 + ((y + 0.5 - top) / ry) ** 2 <= 1;
  // the plants inside (drawn, then seen through the glass)
  const inner = new Sprite(s.map, 80, 84, 40, 80, 4);
  const n = [0, 2, 3, 4, 5, 6][stage];
  for (let k = 0; k < n; k += 1) {
    const px = fx - r + 3 + Math.round(((k + 0.5) / n) * (r * 2 - 6)); const hgt = Math.round(ry * (0.35 + h2(k, v, 3) * 0.45)) - wilt;
    const P = plants[(k + v) % 3];
    leafMass(inner, [[px, top - hgt * 0.5, Math.max(2, hgt * 0.45)], [px + 1, top - hgt * 0.25, Math.max(2, hgt * 0.4)]], P, { seed: k + v, kind: 'leaf', thin: wilt });
    if (stage >= 3 && h2(k, stage, 9) > wilt * 0.3) { const B = bloom[(k + v) % 3]; dab(inner, px - 1, Math.round(top - hgt * 0.7), ['.a.', 'aba', '.a.'], { a: B[2], b: B[4] }, tg('fl', B[2])); }
  }
  inner.b.each((x, y) => { const c = inner.b.get(x, y); if (c && inDome(x, y)) s.set(x, y, c, inner.b.tag(x, y)); });
  // the glass: tinted, lit at the top left, steel ribs
  for (let y = Math.floor(top - ry - 1); y <= top; y += 1) for (let x = fx - r - 1; x <= fx + r + 1; x += 1) {
    if (!inDome(x, y)) continue;
    const dx = (x + 0.5 - fx) / r; const dy = (y + 0.5 - top) / ry; const d = dx * dx + dy * dy;
    const c = s.get(x, y);
    const rib = Math.abs(dx) < 0.06 || Math.abs(Math.abs(dx) - 0.55) < 0.06 || Math.abs(d - 1) < 0.12 / r * 8;
    if (rib) { s.set(x, y, d > 0.85 ? ST[5] : ST[4], tg('metal', ST[4])); continue; }
    const shine = dx < -0.2 && dy < -0.3 && Math.abs(dx + dy + 0.95) < 0.12;
    if (shine) { s.set(x, y, '#ffffff', tg('glass', '#ffffff')); continue; }
    if (c) s.set(x, y, mix(c, glassK[1], 0.3), s.b.tag(x, y));
    else s.set(x, y, mix(MOON.dust[2], glassK[0], 0.35 + (dy < -0.5 ? 0.1 : 0)), tg('glass', glassK[0]));
  }
  if (stage >= 3) { s.set(fx, Math.floor(top - ry - 1), ST[6], tg('metal', ST[4])); s.set(fx, Math.floor(top - ry - 2), ST[5], tg('metal', ST[4])); s.set(fx, Math.floor(top - ry - 3), wilt >= 2 ? '#8a6a5a' : '#ff6a6a', 'fx'); }
  if (stage >= 4) { const dx = fx + Math.round(r * 0.45); dab(s, dx - 2, top - 6, ['.dd.', 'dDDd', 'dDDd', 'dDDd', 'dDDd', 'dddd'], { d: ST[2], D: ST[3] }, tg('metal', ST[3])); s.set(dx, top - 3, '#ffd43b', 'fx'); }
  s.glow(fx, fy - 1, r + 6, 4, '#8af0c0', 0.3);
}

function glowPod(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const P = [ramp('#3ab8b0', 3, 3), ramp('#8a6ae0', 3, 3)][v % 2]; const B = [ramp('#ff7ad8', 2, 3), ramp('#7af0ff', 2, 3), ramp('#ffe07a', 2, 3)][v % 3];
  craterRing(s, fx, fy, 3 + stage);
  if (stage === 0) { sprouts(s, v % 3, [P[2], P[3], P[4], P[5]], null, wilt); return; }
  const H = [0, 8, 14, 22, 30, 38][stage] - wilt * 2;
  s.shadow(fx + 2, fy, 5 + stage * 2, 2, 0.24);
  // a curling stalk, its leaves arching out, glowing pods hanging from it
  const stalks = stage >= 4 ? [[0, 1], [-5, 0.7], [5, 0.62]] : stage >= 2 ? [[0, 1], [-3, 0.65]] : [[0, 1]];
  stalks.forEach(([dx, hf], k) => {
    const h = Math.round(H * hf); let tx = fx + dx; let ty = fy;
    for (let i = 0; i <= h; i += 1) { const t = i / h; tx = Math.round(fx + dx + Math.sin(t * 3 + v + k) * 1.5 + (dx ? dx * t * 0.6 : 0)); ty = fy - i; s.set(tx, ty, P[t > 0.7 ? 4 : 3], tg('leaf', P[3])); if (h > 12) s.set(tx + 1, ty, P[2], tg('leaf', P[3])); }
    // the curl at the top
    dab(s, tx - 1, ty - 2, wilt >= 2 ? ['..', 'aa', '.a'] : ['.aa', 'a..', 'aa.'], { a: P[4] }, tg('leaf', P[3]));
    const fl = Math.max(4, h * 0.45);
    frond(s, tx, ty + 2, -0.4 + k * 0.2, fl, 2 + wilt * 2, P, { w: 1.6, kind: 'leaf', k });
    frond(s, tx, ty + 3, 3.4 - k * 0.2, fl * 0.9, 2 + wilt * 2, P, { w: 1.6, kind: 'leaf', k: k + 2, back: true });
    if (stage >= 2) {
      const pods = stage >= 4 ? 3 : stage >= 3 ? 2 : 1;
      for (let q = 0; q < pods; q += 1) {
        const px = tx + [3, -3, 5][q] + (wilt ? 0 : 0); const py = ty + 4 + q * 3 + wilt;
        s.set(px, py - 1, P[2], tg('leaf', P[3]));
        dab(s, px - 1, py, ['.b.', 'bcb', 'aba'], { a: B[1], b: B[3], c: wilt >= 2 ? B[3] : '#ffffff' }, tg('fruit', B[1]));
        if (wilt < 2) s.glow(px + 0.5, py + 1.5, 5, 4.5, B[4], 0.32, true);
      }
    }
  });
  s.glow(fx, fy, 8 + stage * 2, 3, P[5], 0.3);
}

TREES['bg-space'] = {
  kinds: ['crystal', 'dome', 'pod', 'crystal', 'pod'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'crystal') return crystalTree(s, stage, wilt, v);
    if (kind === 'dome') return greenhouse(s, stage, wilt, v);
    return glowPod(s, stage, wilt, v);
  },
};

FLOWERS['bg-space'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#e8e8f4', 0.14 * old) : c);
    const DS = [MOON.dust[2], MOON.dust[3], MOON.dust[4], MOON.dust[6]];
    if (stage === 0) { sprouts(s, v, [MOON.moss[2], MOON.moss[3], MOON.moss[5], MOON.moss[6]], DS, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.24);
    if (kind === 0) {
      // moon moss: a soft glowing mound; in bloom, spore stalks with bright tips
      const M = MOON.moss.map(pale);
      leafMass(s, [[FX - 3, FY - 2, 3.5], [FX + 3, FY - 2, 3.5], [FX, FY - 3, 4]].map(([x, y, r]) => [x, y + 1, r * (stage === 1 ? 0.7 : 1)]), M, { seed: v + 2, kind: 'moss', squash: 0.7, thin: wilt });
      if (stage >= 2) [[-4, 4], [0, 6], [3, 5], [5, 3], [-2, 5]].slice(0, stage === 2 ? 3 : 5).forEach(([dx, h]) => { const hh = h + (stage === 3 ? 2 : 0) - wilt; for (let k = 1; k < hh; k += 1) s.set(FX + dx + (wilt >= 2 && k > hh / 2 ? 1 : 0), FY - 3 - k, M[4], tg('stem', M[3])); s.set(FX + dx + (wilt >= 2 ? 1 : 0), FY - 3 - hh, stage === 3 ? '#e8ffd0' : M[5], tg('fl', M[5])); });
      if (stage === 3 && wilt < 2) s.glow(FX, FY - 6, 9, 6, '#a8ffc0', 0.28, true);
      return;
    }
    if (kind === 1) {
      const P = GEMS[[1, 2, 0][v]].map(pale); const Q = GEMS[[2, 0, 1][v]].map(pale);
      const k = [0, 0.4, 0.7, 1][stage];
      s.glow(FX, FY - 1, 8, 3, P[5], 0.4);
      shard(s, FX - 4, FY - 1, 2.5, 6 * k + 2 - wilt, Q, -0.6 - wilt * 0.2);
      shard(s, FX + 4, FY - 1, 2.5, 5 * k + 2 - wilt, Q, 0.6 + wilt * 0.2);
      shard(s, FX, FY - 1, 3.4, 10 * k + 2 - wilt, P, wilt * 0.15);
      if (stage === 3) { shard(s, FX - 2, FY, 2, 4, P, -0.3); shard(s, FX + 2, FY, 2, 3, Q, 0.3); if (wilt < 2) { s.set(FX - 6, FY - 9, '#ffffff', 'fx'); s.set(FX + 6, FY - 7, P[6], 'fx'); } }
      return;
    }
    if (kind === 2) {
      // a little glass cloche on a steel foot, a flower growing inside
      const ST = MOON.steel; const B = [ramp('#ff7ad0', 2, 3), ramp('#7ae0ff', 2, 3), ramp('#ffd84a', 2, 3)][v].map(pale);
      for (let x = FX - 5; x <= FX + 5; x += 1) { s.set(x, FY - 1, ST[5], tg('metal', ST[3])); s.set(x, FY, ST[3], tg('metal', ST[3])); }
      const h = [0, 3, 5, 7][stage] - (wilt >= 2 ? 1 : 0);
      for (let k = 1; k <= h; k += 1) s.set(FX + (wilt >= 2 && k > h - 2 ? 1 : 0), FY - 1 - k, MOON.moss[4], tg('stem', MOON.moss[3]));
      dab(s, FX - 2, FY - 3, ['a...a', '.a.a.'], { a: MOON.moss[5] }, tg('leaf', MOON.moss[3]));
      const tx = FX + (wilt >= 2 ? 1 : 0); const ty = FY - 2 - h;
      if (stage === 2) dab(s, tx, ty - 1, ['b', 'a'], { a: MOON.moss[4], b: B[2] }, tg('fl', B[2]));
      if (stage === 3) dab(s, tx - 1, ty - 1, wilt >= 2 ? ['bab'] : ['.c.', 'cwc', '.b.'], { a: B[1], b: B[2], c: B[3], w: '#ffffff' }, tg('fl', B[2]));
      for (let y = FY - 11; y <= FY - 2; y += 1) for (let x = FX - 5; x <= FX + 5; x += 1) {
        const d = ((x + 0.5 - FX) / 5) ** 2 + ((y + 0.5 - (FY - 2)) / 9) ** 2;
        if (d > 1) continue;
        const edge = d > 0.7;
        const c = s.get(x, y);
        if (c && !edge) s.set(x, y, mix(c, '#c8f4f8', 0.2));
        else if (edge) s.set(x, y, x < FX ? '#d8f8ff' : '#8ac8d8', tg('glass', '#8ac8d8'));
        else if ((x + y) % 2 === 0 && x < FX - 1 && y < FY - 6) s.set(x, y, '#e8fcff', tg('glass', '#e8fcff'));
      }
      s.set(FX, FY - 12, ST[6], tg('metal', ST[4]));
      if (stage === 3 && wilt < 2) s.glow(FX, FY - 6, 7, 7, B[3], 0.25, true);
      return;
    }
    // glow bulbs: alien tulips, round lamps on curling stalks
    const B = [ramp('#7ae0ff', 2, 3), ramp('#ff7ad8', 2, 3), ramp('#c0ff7a', 2, 3)];
    tuft(s, 4, [MOON.moss[1], MOON.moss[2], MOON.moss[3], MOON.moss[5]], { h: 2, seed: v });
    if (stage === 1) return;
    clump(s, v, stage, wilt, old, 12, [MOON.moss[2], MOON.moss[3]], (x, y, i) => {
      const C = B[(i + v) % 3].map(pale);
      if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: MOON.moss[4], b: C[2] }, tg('fl', C[2])); return; }
      dab(s, x - 1, y - 2, wilt >= 2 ? ['.b.', 'aba'] : ['.b.', 'bcb', 'aba'], { a: C[1], b: C[3], c: '#ffffff' }, tg('fl', C[2]));
      if (wilt < 2) s.glow(x + 0.5, y - 1, 4, 4, C[4], 0.3, true);
    });
  },
};

const GLOWBUG = [['a.a', '.b.', 'gGg'], ['.a.', 'aba', 'gGg']];
const ALIEN = [
  ['...y...y....', '....a.a.....', '...gggggg...', '..lllggggg..', '.glKggKggg..', '.ggggggggd..', '..ggKKKgg...', '...dggggd...', '..gggggggwww', '.g.ggggggw.w', '...gggggg...', '...gg..gg...', '...dd..dd...'],
  ['...y...y....', '....a.a.....', '...gggggg...', '..lllggggg..', '.glKggKggg..', '.ggggggggd..', '..ggKKKgg...', '...dggggd...', '..gggggggwww', '.g.ggggggw.w', '...gggggg...', '..gg....gg..', '..dd....dd..'],
];
const MOONBUNNY = [
  ['.....ii....', '.....iei...', '.....hhhh..', '..ffffhhKh.', '.fffffhhhn.', 'wffffffff..', '.fffffff...', '..dd..dd...'],
  ['......ii...', '......iei..', '......hhhh.', '..fffffhKh.', '.ffffffhhn.', 'wffffffff..', '.ffff..dd..', 'dd.........'],
];
const JELLY = [
  ['..bbbb..', '.bBwBBb.', 'bBBBBBBb', 'bbbbbbbb', '.t.t.t..', '.t.t..t.', 't..t.t..', '...t....'],
  ['..bbbb..', '.bBwBBb.', 'bBBBBBBb', '.bbbbbb.', '..t.t.t.', '.t.t.t..', '..t..t..', '.t......'],
];

CRITTERS['bg-space'] = [
  { id: 'glowbug', frames: 2, size: [9, 9], moves: 'fly', level: 1, variants: 3 },
  { id: 'alien', frames: 2, size: [14, 15], moves: 'walk', level: 2 },
  { id: 'moonbunny', frames: 2, size: [13, 10], moves: 'walk', level: 3 },
  { id: 'jelly', frames: 2, size: [14, 14], moves: 'fly', level: 4, variants: 2 },
];
CRITTERS_ART['bg-space'] = {
  glowbug: (f, v) => { const C = ['#a8ff8a', '#7ae8ff', '#ffd87a'][v]; return critterOf('bg-space', GLOWBUG[f], { a: ['#d8e8ff', 'fx'], b: ['#3a3a5a', 'fur'], g: ['#ffffff', 'glow'], G: [C, 'glow'] }, { glow: [1.5, 2.5, 4.5, 3.5, C, 0.55] }); },
  alien: (f) => critterOf('bg-space', ALIEN[f], { g: '#7ad86a', l: '#b8f49a', d: '#4aa850', a: '#7ad86a', y: ['#fff07a', 'glow'], w: ['#8690b0', 'metal'] }, { feet: true, shadow: [5, 1.2] }),
  moonbunny: (f) => critterOf('bg-space', MOONBUNNY[f], { f: '#e8e8f8', h: '#f4f4ff', d: '#b8b8d8', i: '#f8c0d8', e: '#f4f4ff', n: '#ff9ac0', w: '#ffffff' }, { feet: true, shadow: [4, 1.2], glow: [5, 4, 8, 6, '#e8e8ff', 0.25] }),
  jelly: (f, v) => { const C = v ? ['#ff9ae0', '#ffc8f0', '#c86ab0'] : ['#8ae8ff', '#c8f8ff', '#5aa8d0']; return critterOf('bg-space', JELLY[f], { b: [C[0], 'fur'], B: [C[1], 'fur'], w: ['#ffffff', 'fur'], t: [C[2], 'glow'] }, { glow: [4, 3, 8, 7, C[1], 0.4] }); },
};

// ---------- the Royal Castle ----------

const HEDGE = ['#163828', '#1f4e34', '#2a663c', '#357e42', '#4c984a', '#72b458', '#a6d478'];
const ROSE = [['#7a1028', '#c8203a', '#f05060', '#ff9a9a'], ['#a03a6a', '#e070a0', '#ffa8c8', '#ffe0ec'], ['#b8a8b8', '#f4eef0', '#ffffff', '#ffe8b0'], ['#b06a1a', '#f0a030', '#ffd060', '#fff0b0']];

/** A rose: a tight swirl of petals. */
const roseHead = (s, x, y, C) => dab(s, x - 1, y - 1, ['cb.', 'bdb', '.ba'], { a: C[0], b: C[1], c: C[2], d: C[0] }, tg('fl', C[1]));

/** A clipped topiary: cone with a spiral (v 0), tiered balls (v 1) or a hedge peacock (v 2). */
function topiary(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const shape = v % 3;
  // a ring of bark mulch round its foot
  for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 7; x <= fx + 7; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 7, 1.8)) s.set(x, y, h2(x, y, 2) < 0.3 ? '#5a3a30' : '#7a4f3a', 'ground');
  if (stage === 0) { leafMass(s, [[fx, fy - 3, 3]], HEDGE, { seed: v, thin: wilt }); return; }
  s.shadow(fx + 2, fy, 6 + stage * 1.6, 2 + stage * 0.3, 0.24);
  const k = [0, 0.3, 0.45, 0.62, 0.8, 1][stage];
  const tag = tg('leaf', HEDGE[3]);
  // clipped leaves: a fine even texture, lit at the top left, shaggy when it wilts (unclipped sprigs)
  const blob = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry; const d = dx * dx + dy * dy;
      const shag = wilt ? (h2(x, y, 7) < wilt * 0.12 ? 0.35 : 0) : 0;
      if (d > 1 + shag) continue;
      const l = -(dx * 0.6 + dy * 0.8) + ((x + y) % 2 ? 0.08 : -0.08);
      const i = l > 0.6 ? 5 : l > 0.15 ? 4 : l > -0.35 ? 3 : 2;
      s.set(x, y, HEDGE[i], tag);
    }
  };
  const stem = (y0, y1) => { for (let y = y0; y <= y1; y += 1) { s.set(fx, y, '#7a4f3a', tg('wood', '#6a4430')); s.set(fx + 1, y, '#5a3a30', tg('wood', '#6a4430')); } };
  const droop = wilt * 0.8;
  if (shape === 0 || stage <= 2) {
    // a cone with a spiral groove
    const H = Math.round(44 * k); const W = 13 * k + 2;
    stem(fy - 3, fy);
    for (let y = fy - 3 - H; y <= fy - 3; y += 1) {
      const t = (y - (fy - 3 - H)) / H; const half = Math.max(1, W * Math.min(1, t * 1.15)) + (wilt ? (h2(y, 1, 3) - 0.5) * wilt * 0.8 : 0);
      for (let x = Math.floor(fx - half); x <= fx + half; x += 1) {
        const u = (x + 0.5 - fx) / half;
        let i = u < -0.4 ? 5 : u < 0.2 ? 4 : u < 0.65 ? 3 : 2;
        if (stage >= 3 && Math.abs(((y * 0.35 + u * 1.6) % 2 + 2) % 2 - 1) < 0.18) i = Math.max(1, i - 2);
        if ((x + y) % 2 && i > 2) i -= 0;
        s.set(x, y + Math.round(droop * (1 - t) * 0.5), HEDGE[i], tag);
      }
    }
    if (stage === 5) dab(s, fx - 1, fy - 6 - H, ['.a.', 'aba', '.a.'], { a: '#f0c040', b: '#fff6c8' }, tg('fruit', '#c8902a'));
    return;
  }
  if (shape === 1) {
    stem(fy - 34 * k, fy);
    blob(fx, fy - 7 * k, 11 * k, 7 * k);
    blob(fx, fy - 24 * k + droop, 8 * k, 6 * k);
    blob(fx, fy - 38 * k + droop * 1.5, 5.5 * k, 5 * k);
    if (stage === 5) dab(s, fx - 1, Math.round(fy - 45 * k + droop * 1.5), ['.a.', 'aba', '.a.'], { a: '#f0c040', b: '#fff6c8' }, tg('fruit', '#c8902a'));
    return;
  }
  // a peacock of clipped hedge: a fanned tail with flowers for its eyes, a round body, a little head
  const T = 19 * k;
  for (let y = Math.floor(fy - 4 - T * 1.6); y <= fy - 4; y += 1) for (let x = Math.floor(fx - 4 - T); x <= fx - 4 + T; x += 1) {
    const dx = x + 0.5 - (fx - 4); const dy = (y + 0.5 - (fy - 4)) / 1.45; const d = Math.hypot(dx, dy);
    if (d > T || dy > 0) continue;
    const a = Math.atan2(dy, dx); const rib = Math.abs(((a / Math.PI) * 8 + 20) % 1 - 0.5) < 0.12;
    const l = -(dx / T) * 0.4 - (dy / T) * 0.7;
    s.set(x, y + Math.round(droop * d / T), HEDGE[rib ? 2 : l > 0.5 ? 5 : l > 0.1 ? 4 : 3], tag);
  }
  blob(fx + 4, fy - 9 * k, 8 * k, 7 * k);
  blob(fx + 9 * k, fy - 21 * k + droop, 3.5 * k, 4 * k);
  blob(fx + 10 * k, fy - 27 * k + droop * 1.4, 3 * k, 3 * k);
  sprinkle([fx - 4 - T, fy - 4 - T * 1.5, fx - 4 + T, fy - 8], 6, v + 5, (x, y) => s.kind(x, y) === 'leaf' && Math.hypot(x - fx + 4, (y - fy + 4) / 1.45) > T * 0.6, (x, y, q) => { if (h2(q, stage, 4) > wilt * 0.25) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: '#3a8ae0', b: '#ffd84a' }, tg('fl', '#2a6ac0')); });
}

/** A rose bush that climbs a trellis arch as it grows. */
function roseBush(s, stage, wilt, v) {
  const C = ROSE[v % 4]; const C2 = ROSE[(v + 1) % 4];
  if (stage < 4) {
    bushy(s, stage, wilt, v, { P: HEDGE, BK: BARK.meadow, soil: SOIL, R: [0, 6, 9, 12, 0, 0], ry: 0.75, every: [0, 9, 8, 6], head: (x, y, k) => roseHead(s, x, y, k % 4 === 3 ? C2 : C) });
    return;
  }
  const fx = 40; const fy = 80; const half = stage === 5 ? 15 : 12; const H = stage === 5 ? 38 : 30;
  s.shadow(fx + 2, fy, half + 6, 3, 0.22);
  const W = ['#4a3036', '#7a5040', '#a87a58', '#d8b088'];
  // the trellis: two posts and an arch of thin laths
  for (const sx of [-1, 1]) for (let y = fy - H + half * 0.6; y <= fy; y += 1) { s.set(fx + sx * half, y, W[2], tg('wood', W[1])); s.set(fx + sx * half + 1, y, W[1], tg('wood', W[1])); }
  for (let a = 0; a <= Math.PI; a += 0.04) { const x = Math.round(fx - Math.cos(a) * half); const y = Math.round(fy - H + half * 0.6 - Math.sin(a) * half * 0.6); s.set(x, y, W[3], tg('wood', W[1])); s.set(x, y + 1, W[2], tg('wood', W[1])); }
  // leafy rose canes over it
  const cl = [];
  for (let a = 0.1; a <= Math.PI - 0.1; a += 0.42) cl.push([fx - Math.cos(a) * half, fy - H + half * 0.6 - Math.sin(a) * half * 0.6, 4.2]);
  for (const sx of [-1, 1]) for (let y = fy - 4; y > fy - H + half * 0.6; y -= 7) cl.push([fx + sx * half + sx * 0.5, y, 3.8]);
  leafMass(s, clumpsOf(cl.map(([x, y, r]) => [(x - fx) / 20, (y - fy) / 20, r / 20]), fx, fy, 20, wilt), HEDGE, { seed: v + 3, thin: wilt });
  const keep = (k) => h2(k, stage, 97) > wilt * 0.22;
  sprinkle([fx - half - 5, fy - H - 6, fx + half + 5, fy], 5, v + 6, (x, y) => s.kind(x, y) === 'leaf' && s.get(x, y - 1), (x, y, k) => { if (keep(k)) roseHead(s, x, y, k % 3 === 2 ? C2 : C); });
  if (stage === 5) for (let k = 0; k < 8; k += 1) { const x = fx + Math.round((h2(k, v, 4) - 0.5) * 30); const y = fy + Math.round(h2(v, k, 4) * 3) - 1; if (!s.get(x, y) && keep(k)) s.set(x, y, C[2], 'ground'); }
}

TREES['bg-castle'] = {
  kinds: ['apple', 'topiary', 'rose', 'pear', 'topiary'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'topiary') return topiary(s, stage, wilt, v);
    if (kind === 'rose') return roseBush(s, stage, wilt, v);
    return orchardTree(s, stage, wilt, v, kind);
  },
};

FLOWERS['bg-castle'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#fff4f0', 0.14 * old) : c);
    if (stage === 0) { sprouts(s, v, MSTEM, SOIL, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.16);
    if (kind === 0) {
      // a little rose bush
      leafMass(s, [[FX - 3, FY - 3, 3.6], [FX + 3, FY - 3, 3.6], [FX, FY - 6, 4]].map(([x, y, r]) => [x, y + wilt * 0.5 + (stage === 1 ? 2 : 0), r * (stage === 1 ? 0.7 : 1)]), HEDGE, { seed: v + 4, thin: wilt });
      if (stage === 1) return;
      const C = ROSE[[0, 1, 0][v]].map(pale); const C2 = ROSE[[1, 2, 3][v]].map(pale);
      [[-3, -6], [3, -7], [0, -10], [4, -3]].forEach(([dx, dy], i) => {
        const x = FX + dx; const y = FY + dy + wilt;
        if (stage === 2) { dab(s, x, y, ['b', 'a'], { a: HEDGE[4], b: C[1] }, tg('fl', C[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['bab'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
        roseHead(s, x, y, i === 2 ? C2 : C);
      });
      return;
    }
    if (kind === 1) {
      // tulips in royal colours
      const TU = [['#4a1a7a', '#7a3ab8', '#a86ae0', '#d8b0ff'], ['#9a6a10', '#e0a820', '#ffd84a', '#fff4b0'], ['#8a1028', '#d02a40', '#ff6a6a', '#ffb0a8']];
      for (const [dx, dir] of [[-4, -1], [4, 1], [0, 1]]) dab(s, FX + dx - (dir < 0 ? 1 : 0), FY - (stage === 1 ? 4 : 5), dir < 0 ? ['a.', 'ab', '.b', '.b'] : ['.a', 'ba', 'b.', 'b.'], { a: '#7ab868', b: '#4a8a50' }, tg('leaf', '#4a8a50'));
      if (stage === 1) return;
      clump(s, v, stage, wilt, old, 12, ['#3e7a48', '#5a9a52'], (x, y, i) => {
        const C = TU[(i + v) % 3].map(pale);
        if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: '#5a9a52', b: C[1] }, tg('fl', C[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['b.b', 'aba'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
        dab(s, x - 1, y - 3, old === 2 ? ['c.b', 'cbb', 'bba'] : ['c.b', 'cbb', 'bba', '.a.'], { a: C[0], b: C[1], c: C[2] }, tg('fl', C[1]));
      }, { bow: 0.2 });
      return;
    }
    if (kind === 2) {
      // lavender: grey-green tufts and purple spikes
      tuft(s, 5, ['#4a6a5a', '#6a8a72', '#8aa88a', '#b0c8a8'], { h: stage === 1 ? 5 : 4, seed: v + 2 });
      if (stage === 1) return;
      const L = ['#4a3a8a', '#7a5ac0', '#a888e0', '#d0c0f8'].map(pale);
      [[-5, 10, -2], [-2, 13, -1], [1, 12, 1], [4, 11, 2], [6, 8, 3]].slice(0, v === 2 ? 4 : 5).forEach(([dx, h, lean]) => {
        const hh = h - wilt; const tx = FX + dx + lean + (wilt >= 2 ? Math.sign(lean) * wilt : 0);
        const pts = stem(s, FX + dx, FY - 2, tx, FY - hh, 0, ['#5a7a62', '#7a9a7a']);
        for (let k = 0; k < (stage === 2 ? 3 : 5); k += 1) { const [x, y] = pts[Math.max(0, pts.length - 1 - k)]; s.set(x, y, stage === 2 ? (k < 2 ? '#7a9a7a' : L[0]) : L[k < 1 ? 3 : k < 3 ? 2 : 1], tg('fl', L[1])); if (stage === 3 && k % 2 && wilt < 2) s.set(x + 1, y, L[1], tg('fl', L[1])); }
      });
      return;
    }
    // an old stone urn with ivy spilling out of it and tiny white flowers
    const SN = ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde'];
    dab(s, FX - 4, FY - 7, ['eeeeeeeee', '.dcccccb.', '..dcccb..', '...dcb...', '...dcb...', '..ddcbb..', '.ddddbbb.'], { b: SN[1], c: SN[2], d: SN[3], e: SN[4] }, tg('stone', SN[2]));
    const IV = ['#1e4630', '#2c6038', '#3e7a42', '#5a9a4e', '#86bc62'];
    const n = [0, 4, 7, 10][stage];
    for (let k = 0; k < n; k += 1) {
      const side = k % 2 ? 1 : -1; const len = 3 + (k % 4) + (stage === 3 ? 2 : 0);
      for (let j = 0; j < len; j += 1) {
        const x = FX + side * (2 + Math.floor(k / 2) * 0.8 + Math.round(j * 0.5)); const y = FY - 8 + j - (j < 2 ? 1 : 0) + Math.floor(k / 4);
        s.set(Math.round(x), y, IV[1], tg('stem', IV[1]));
        if (j % 2 === 0) dab(s, Math.round(x) + (side > 0 ? 0 : -1), y, ['ab'], { a: IV[3], b: IV[2] }, tg('leaf', IV[2]));
      }
    }
    leafMass(s, [[FX, FY - 9, 3.5], [FX - 3, FY - 9, 2.5], [FX + 3, FY - 9, 2.5]].map(([x, y, r]) => [x, y + (stage === 1 ? 1 : 0), r]), ['#163828', '#1e4630', '#2c6038', '#3e7a42', '#5a9a4e', '#86bc62', '#b0d88a'], { seed: v, thin: wilt });
    if (stage >= 2) [[-3, -11], [2, -12], [0, -9], [5, -5], [-5, -4]].slice(0, stage === 2 ? 2 : 5).forEach(([dx, dy]) => s.set(FX + dx, FY + dy, stage === 2 ? '#d8e8c8' : pale('#ffffff'), tg('fl', '#d8d0e0')));
  },
};

const DOVE = [['..ww....', '...ww...', '.bbbbhh.', 'tbbbbhKo', '..bbb...'], ['........', '.bbbbhh.', 'tbbbbhKo', '..www...', '...ww...']];
const SWAN = [
  ['..........hh.', '.........hhKo', '.........hh..', '.........hh..', '..wwww...hh..', '.wwWWwwwwhh..', 'wwwWWwwwwwww.', '.wwwwwwwwww..', '..rrrrrrrr...'],
  ['..........hh.', '.........hhKo', '.........hh..', '.........hh..', '..wwww...hh..', '.wwWWwwwwhh..', 'wwwWWwwwwwww.', '.wwwwwwwwww..', '.rr.rrrr.rr..'],
];
const PEACOCK = [
  ['..............c..', '.............hh..', '.............hKy.', 'tttt........hh...', 'tTtTttt.bbbbhh...', 'ttTttTtbbbbbbb...', '.tttttttbbbbb....', '........l..l.....', '........l..l.....', '.......kk.kk.....'],
  ['..............c..', '.............hh..', '.............hKy.', 'tttt........hh...', 'tTtTttt.bbbbhh...', 'ttTttTtbbbbbbb...', '.tttttttbbbbb....', '.........ll......', '........l..l.....', '.......kk..kk....'],
];
/** The display: the tail fanned up behind it in rays, eye spots in a ring. */
PEACOCK.push((() => {
  const W = 19; const H = 13; const cx = 9; const cy = 8.5; const g = [];
  for (let y = 0; y < H; y += 1) { g.push([]); for (let x = 0; x < W; x += 1) { const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.18); g[y].push(y + 0.5 <= cy + 0.6 && d <= 8.6 ? (Math.floor((Math.atan2(cy - y - 0.5, x + 0.5 - cx) + 0.13) * 5.2) % 2 ? 't' : 'T') : '.'); } }
  const put = (x, y, c) => { if (y >= 0 && y < H && x >= 0 && x < W) g[y][x] = c; };
  [[0.22, 6.6], [0.75, 6.8], [1.57, 6.9], [2.39, 6.8], [2.92, 6.6], [0.95, 3.9], [2.19, 3.9]].forEach(([a, r]) => { const x = Math.round(cx - 0.5 + Math.cos(a) * r); const y = Math.round(cy - 0.5 - Math.sin(a) * r / 1.18); put(x, y, 'E'); put(x - 1, y, 'O'); put(x + 1, y, 'O'); });
  [[12, 3, 'c'], [11, 4, 'h'], [12, 4, 'h'], [11, 5, 'h'], [12, 5, 'K'], [13, 5, 'y'], [11, 6, 'h'], [11, 7, 'h']].forEach(([x, y, c]) => put(x, y, c));
  for (let y = 7; y <= 9; y += 1) for (let x = 7; x <= 12; x += 1) if (!(y === 9 && (x === 7 || x === 12))) put(x, y, 'b');
  put(9, 10, 'l'); put(11, 10, 'l'); put(9, 11, 'l'); put(11, 11, 'l'); put(8, 12, 'k'); put(9, 12, 'k'); put(11, 12, 'k'); put(12, 12, 'k');
  return g.map((r) => r.join(''));
})());

CRITTERS['bg-castle'] = [
  { id: 'dove', frames: 2, size: [10, 7], moves: 'fly', level: 1 },
  { id: 'swan', frames: 2, size: [15, 11], moves: 'swim', level: 2 },
  { id: 'peacock', frames: 3, size: [19, 12], moves: 'walk', level: 3 },
  { id: 'whitepeacock', frames: 3, size: [19, 12], moves: 'walk', level: 4 },
];
CRITTERS_ART['bg-castle'] = {
  dove: (f) => critterOf('bg-castle', DOVE[f], { b: ['#f4f2f8', 'fur'], h: ['#ffffff', 'fur'], w: ['#d8d4e4', 'fur'], t: ['#c8c4d8', 'fur'], o: ['#ff9a8a', 'fur'] }),
  swan: (f) => critterOf('bg-castle', SWAN[f], { w: ['#f8f6fc', 'fur'], W: ['#e0dcec', 'fur'], h: ['#ffffff', 'fur'], o: ['#ff8a3a', 'fur'], r: ['#9ac8f0', 'glow'] }),
  peacock: (f) => critterOf('bg-castle', PEACOCK[f], { t: '#2a8a6a', T: '#4ac0a0', b: '#2a5ad0', h: '#2a6ae0', c: ['#4ac0e0', 'fur'], y: '#e0c080', l: '#8a7a6a', k: '#5a4a4a', E: ['#1a3aa0', 'fur'], O: ['#e8c040', 'fur'] }, { feet: true, shadow: [7, 1.3] }),
  whitepeacock: (f) => critterOf('bg-castle', PEACOCK[f], { t: '#f4f2f8', T: '#fff4c8', b: '#ffffff', h: '#ffffff', c: ['#fff4c8', 'fur'], y: '#f0c080', l: '#c8c0d0', k: '#8a7a9a', E: ['#e8e0f0', 'fur'], O: ['#ffe8a0', 'fur'] }, { feet: true, shadow: [7, 1.3], glow: [9, 6, 12, 8, '#fff8e0', 0.3] }),
};

// ---------- Volcano Island ----------

const VOL = {
  rock: ['#18141f', '#241e2d', '#322a3c', '#443a4e', '#584e62', '#706678', '#8c8496'],
  ash: ['#2f2530', '#3d3038', '#4b3c40', '#5a4a4a', '#6c5a55'],
  lava: ['#a01e2e', '#d83a20', '#f8661a', '#ff9a22', '#ffcc3c', '#fff08e'],
  fern: ['#14362a', '#1e5034', '#2c6c3a', '#3e8a40', '#5aa646', '#86c456', '#bce07a'],
  moss: ['#1e3a24', '#2a5028', '#3c6a2c', '#548632', '#70a23a', '#94bc4a', '#bcd866'],
  ohia: ['#163a30', '#1f5038', '#2a683e', '#3c8444', '#58a04c', '#82bc62', '#b6d88c'],
  silver: ['#2a3a34', '#3a5246', '#4e6a58', '#66846c', '#86a084', '#a8bca0', '#d0dcc4'],
  shag: ['#2a1a1e', '#3e2626', '#56362c', '#704834', '#8a5c3e', '#a6764e', '#c49464'],
  dragon: ['#10302a', '#164234', '#1e5a3c', '#2a7444', '#3e904c', '#5eac58', '#8ccc70'],
};

/** New life on black rock: a patch of basalt, a glowing crack while it's young, then moss spreading. */
function lavaRock(s, fx, fy, stage, wilt) {
  const r = 5 + stage * 1.2;
  for (let y = fy - 2; y <= fy + 2; y += 1) for (let x = Math.floor(fx - r - 1); x <= fx + r + 1; x += 1) {
    const d = ((x + 0.5 - fx) / (r + 1)) ** 2 + ((y + 0.5 - fy) / 2.6) ** 2;
    if (d > 1 + (vnoise(x, y, 3, 5) - 0.5) * 0.4) continue;
    s.set(x, y, VOL.rock[y < fy ? 3 : d > 0.6 ? 2 : 4], 'ground');
  }
  if (stage <= 1) { for (let x = -3; x <= 3; x += 1) s.set(fx + x, fy + (x % 3 === 0 ? 1 : 0), stage === 0 ? VOL.lava[2 + (x & 1)] : VOL.lava[0], 'ground'); if (stage === 0) s.glow(fx, fy, 6, 2.5, '#ff9a22', 0.35); }
  // the moss ring grows with the plant (and browns when it wilts)
  const mr = stage * 2.4;
  for (let k = 0; k < stage * 7; k += 1) {
    const a = h2(k, 3, 7) * 6.28; const d = 2 + h2(7, k, 3) * mr;
    const x = Math.round(fx + Math.cos(a) * d); const y = Math.round(fy + Math.sin(a) * d * 0.3);
    if (!s.get(x, y) || s.kind(x, y) === 'ground') { s.set(x, y, VOL.moss[3 + (k % 3)], 'ground'); if (k % 2) s.set(x + 1, y, VOL.moss[4], 'ground'); }
  }
  void wilt;
}

function treeFern(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const P = VOL.fern; const BK = VOL.shag;
  lavaRock(s, fx, fy, stage, wilt);
  const curl = (x, y) => dab(s, x - 1, y - 3, ['.ab', 'a.b', '.bb', '.b.'], { a: P[6], b: P[5] }, tg('frond', P[4]));
  if (stage === 0) { curl(fx, fy - 4); for (let y = fy - 4; y < fy; y += 1) s.set(fx, y, P[4], tg('frond', P[4])); frond(s, fx, fy - 2, -0.6, 5, 1 + wilt, P, { w: 1.2, k: 1 }); return; }
  const H = [0, 3, 8, 14, 20, 27][stage]; const len = [0, 7, 10, 13, 16, 19][stage];
  s.shadow(fx + 3, fy, len * 0.8, 2.4, 0.26);
  // a shaggy trunk of old frond bases
  for (let y = fy - H; y <= fy; y += 1) for (let dx = -2; dx <= 2; dx += 1) {
    if (Math.abs(dx) === 2 && (y + dx) % 3) continue;
    const x = fx + dx + Math.round(Math.sin((fy - y) / 9 + v) * 0.8);
    s.set(x, y, BK[clamp((dx < 0 ? 4 : 3) - ((y * 3 + dx) % 4 === 0 ? 2 : 0), 1, 6)], tg('wood', BK[3]));
  }
  const cx = fx + Math.round(Math.sin(H / 9 + v) * 0.8); const cy = fy - H;
  const dr = 3 + wilt * 3;
  [[-2.5, 0.85], [-0.65, 0.85], [-1.6, 0.6]].forEach(([a, l], k) => frond(s, cx, cy, a, len * l, dr * 0.6, P, { back: true, w: 2.2, k }));
  [[3.1, 1], [0.05, 1], [2.5, 0.9], [0.65, 0.9], [1.9, 0.55], [1.25, 0.6]].forEach(([a, l], k) => frond(s, cx, cy, a, len * l, dr * (l > 0.8 ? 1 : 0.5), P, { w: 2.2, k: k + 3 }));
  if (stage >= 3 && wilt < 2) { curl(cx - 1, cy - 1); if (stage >= 4) curl(cx + 2, cy); }
}

function ohia(s, stage, wilt, v) {
  const BK = ['#2a2228', '#3e3238', '#56484a', '#6e5e5c', '#8a7a74', '#a89890', '#c8bab0'];
  const F = [['#7a0a1e', '#d0202e', '#ff5a4a', '#ffc070'], ['#a83a0a', '#f06a1a', '#ffa83a', '#ffe080'], ['#a8800a', '#f0c020', '#ffe85a', '#fff8c0']][v % 4 === 3 ? 1 : v % 4 === 2 ? 2 : 0];
  lavaRock(s, 40, 80, stage, wilt);
  const t = roundTree(s, stage, wilt, v, {
    P: VOL.ohia, BK, stake: false, tpl: WIDE, ry: 0.72, Rk: 0.95, th: 3,
    sapling: (ss, fx, fy, o) => { for (let y = fy - 6; y < fy; y += 1) ss.set(fx + (y < fy - 3 && wilt > 1 ? 1 : 0), y, BK[4], tg('wood', BK[3])); dab(ss, fx - 2, fy - 8 + (wilt ? 1 : 0), ['ab.ba', '.bab.'], { a: '#e05a4a', b: '#a83a3a' }, tg('leaf', '#a83a3a')); void o; },
  });
  if (!t) return;
  const { box, inCrown, keep } = t;
  // new leaves come in red
  if (stage <= 2) sprinkle(box, 4, v + 3, inCrown, (x, y) => dab(s, x, y, ['ab'], { a: '#e86a5a', b: '#b84a4a' }, tg('leaf', '#a83a3a')));
  if (stage >= 3) sprinkle(box, stage === 3 ? 7 : stage === 4 ? 6 : 5, v + 5, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['a.a', '.b.', 'aca'], { a: F[1], b: F[2], c: F[3] }, tg('fl', F[1])); });
  if (stage === 5) petalFall(s, t, [F[1], F[2]], 10);
}

function dragonTree(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const P = VOL.dragon; const BK = ['#3a2a2a', '#54403a', '#6e5648', '#887060', '#a48a76', '#c0a894', '#dcc8b4'];
  lavaRock(s, fx, fy, stage, wilt);
  const spiky = (cx, cy, rx, ry) => {
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 3; y += 1) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry;
      const hang = dy > 0 && (x * 7 + y) % 3 === 0 ? 0.5 : 0; // spiky leaves hanging under the dome
      if (dx * dx + dy * dy > 1 + hang + (wilt ? wilt * 0.08 * (dy > 0 ? 1 : 0) : 0)) continue;
      if (dy > 0.55 && (x + Math.floor(y / 2)) % 2) continue;
      const l = -(dx * 0.5 + dy * 0.85);
      let i = l > 0.5 ? 5 : l > 0.1 ? 4 : l > -0.3 ? 3 : 2;
      if ((x * 3 + y * 5) % 7 === 0) i -= 1;
      s.set(x, y + Math.round(wilt * Math.abs(dx) * 1.2), P[clamp(i, 1, 6)], tg('leaf', P[3]));
    }
  };
  if (stage === 0) { spiky(fx, fy - 3, 3.5, 2.5); return; }
  const H = [0, 5, 9, 14, 18, 22][stage]; const R = [0, 5, 8, 12, 15, 19][stage];
  s.shadow(fx + 3, fy, R + 2, 2.6, 0.26);
  trunk(s, fx, fy - H, fy, Math.max(2, stage), stage + 1.5, BK, { roots: stage >= 4 ? 2 : 0, seed: v });
  const heads = stage >= 3 ? [[-0.55, 0.2, 0.55], [0.55, 0.2, 0.55], [-0.25, -0.05, 0.6], [0.28, -0.08, 0.6]] : [[0, 0, 1]];
  heads.forEach(([u, w, rr]) => {
    const tx = fx + Math.round(u * R); const ty = Math.round(fy - H - R * 0.35 + w * R);
    if (stage >= 3) branch(s, fx, fy - H + 1, tx, ty + 2, 2, BK);
    spiky(tx, ty, R * rr, R * rr * 0.55);
  });
  if (stage >= 4) sprinkle([fx - R, fy - H - R, fx + R, fy - H], 7, v + 9, (x, y) => s.kind(x, y) === 'leaf' && s.get(x, y - 1), (x, y, k) => { if (h2(k, stage, 3) > wilt * 0.3) dab(s, x, y, ['ab', 'b.'], { a: '#ff7a5a', b: '#c8302a' }, tg('fruit', '#c8302a')); });
}

TREES['bg-volcano'] = {
  kinds: ['fern', 'ohia', 'fern', 'dragon', 'ohia'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'fern') return treeFern(s, stage, wilt, v);
    if (kind === 'ohia') return ohia(s, stage, wilt, v);
    return dragonTree(s, stage, wilt, v);
  },
};

FLOWERS['bg-volcano'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#d8c8c0', 0.14 * old) : c);
    const ASH = [VOL.rock[2], VOL.rock[3], VOL.rock[4], VOL.rock[5]];
    if (stage === 0) { sprouts(s, v, VOL.moss.slice(2, 6), ASH, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.3);
    // every clump sits on a little moss cushion on the black rock
    for (let x = -5; x <= 5; x += 1) s.set(FX + x, FY + (Math.abs(x) > 3 ? 0 : 1), VOL.moss[Math.abs(x) > 3 ? 2 : 3], 'ground');
    if (kind === 0) {
      // fire lilies: strappy leaves, orange-red lilies with curled-back petals
      tuft(s, 4, VOL.fern.slice(2, 6), { h: stage === 1 ? 5 : 3, seed: v + 1 });
      if (stage === 1) return;
      clump(s, v, stage, wilt, old, 12, [VOL.fern[3], VOL.fern[4]], (x, y, i) => {
        const C = [['#a01e2e', '#f04a1a', '#ff9a3a', '#ffe070'], ['#b0381a', '#ff7a1a', '#ffc04a', '#fff0a0']][(i + v) % 2].map(pale);
        if (stage === 2) { dab(s, x, y - 2, ['b', 'b', 'a'], { a: VOL.fern[4], b: C[1] }, tg('fl', C[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['bab', '.a.'], { a: C[0], b: C[1] }, tg('fl', C[1])); return; }
        dab(s, x - 2, y - 3, ['c...c', 'bc.cb', '.bcb.', '.aba.', '..a..'], { a: C[0], b: C[1], c: C[2] }, tg('fl', C[1]));
        s.set(x, y - 4, C[3], 'fx');
      });
      return;
    }
    if (kind === 1) {
      // ember flowers: little glowing stars that smoulder on dark stems
      tuft(s, 4, VOL.moss.slice(1, 5), { h: 2, seed: v + 3 });
      if (stage === 1) { [[-2, -3], [2, -4]].forEach(([dx, dy]) => s.set(FX + dx, FY + dy, VOL.lava[0], tg('fl', VOL.lava[0]))); return; }
      clump(s, v, stage, wilt, old, 11, ['#3a2a2a', '#5a3a30'], (x, y) => {
        const C = VOL.lava.map(pale);
        if (stage === 2) { s.set(x, y, C[1], tg('fl', C[1])); s.set(x, y - 1, C[2], tg('fl', C[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y, ['aba'], { a: C[0], b: C[1] }, tg('fl', C[0])); return; }
        dab(s, x - 2, y - 2, ['..b..', '.bcb.', 'bcdcb', '.bcb.', '..b..'], { b: C[2], c: C[4], d: '#ffffff' }, tg('fl', C[1]));
        s.glow(x + 0.5, y + 0.5, 5, 5, '#ffb03a', 0.4, true);
      });
      return;
    }
    if (kind === 2) {
      // obsidian blooms: petals of black glass round a glowing heart
      const O = ['#100c1c', '#1c1430', '#2a1e48', '#3c2c66', '#56428a', '#7c68b4', '#b4a4e4', '#ece4ff'];
      const k = [0, 0.45, 0.75, 1][stage];
      const petals = stage === 3 ? 7 : 5;
      for (let p = 0; p < petals; p += 1) {
        const a = -Math.PI + (p / (petals - 1)) * Math.PI + (wilt >= 2 ? 0.2 : 0);
        const len = (6 + (p % 2) * 2) * k + 2 - wilt * 0.6;
        shard(s, FX + Math.round(Math.cos(a) * 2), FY - 1, 2.6, len, O.map((c) => pale(c)), Math.cos(a) * 1.1, 'crys');
      }
      if (stage >= 2) {
        const C = [['#ff4a8a', '#ff9ad0'], ['#ff8a2a', '#ffd06a'], ['#8a5aff', '#d0b0ff']][v];
        dab(s, FX - 1, FY - 3, stage === 3 && wilt < 2 ? ['.b.', 'bab', '.b.'] : ['b'], { a: '#ffffff', b: C[0] }, tg('glow', C[0]));
        if (stage === 3 && wilt < 2) s.glow(FX + 0.5, FY - 2, 7, 5, C[1], 0.45);
      }
      return;
    }
    // silverswords: a ball of silver blades, and once in bloom a tall spike of magenta flowers
    const SV = ['#5a6a6a', '#7a8c8a', '#9aaeaa', '#c0d0cc', '#e4eeea', '#ffffff'];
    const r = [0, 3, 4.5, 5][stage];
    for (let a = 0; a < 6.28; a += 0.35) for (let t = 0.5; t <= r; t += 0.5) {
      const x = Math.round(FX + Math.cos(a) * t * 1.2); const y = Math.round(FY - 3 - Math.sin(a) * t * 0.9 + (wilt ? t * 0.3 : 0));
      if (y > FY) continue;
      s.set(x, y, SV[t > r - 1 ? 4 : Math.cos(a + 0.8) > 0 ? 3 : 2], tg('leaf', SV[2]));
    }
    if (stage === 3) {
      const M = ['#6a1a5a', '#b02a8a', '#e05ab8', '#ff9ae0'].map(pale);
      const h = 12 - wilt * 2;
      for (let k = 0; k < h; k += 1) {
        const x = FX + (wilt >= 2 && k > h / 2 ? 1 : 0); const y = FY - 7 - k;
        s.set(x, y, k < 2 ? SV[3] : M[k > h - 3 ? 3 : (k % 2) + 1], tg('fl', M[1]));
        if (k > 1 && k < h - 1 && k % 2 === 0 && !(wilt >= 2 && k % 4)) { s.set(x - 1, y, M[2], tg('fl', M[1])); s.set(x + 1, y, M[1], tg('fl', M[1])); }
      }
    }
  },
};

const LIZARD = [['.......hh...', 'tttbbbbbhhKh', '..f..f..f...'], ['.......hh...', 'tttbbbbbhhKh', '.f..f..f....']];
const MOTH = [['a...a', 'aabaa', '.cbc.'], ['.a.a.', '.aba.', '..b..']];
const CHICK = [['..cc...', '.cbbb..', 'bbbbKy.', 'bbBbbb.', '.bbbb..', '..l.l..'], ['..cc...', '.cbbb..', 'bbbbKy.', 'bbBbbb.', '.bbbb..', '.l...l.']];
const PHOENIX = [
  ['.....ff.............', '....fff...........c.', '...ffff.........ccc.', 'tt..fffff.....bbbbK.', 'ttt.ffffffbbbbbbbbby', '.tttttbbbbbbbbbbbb..', '..ttttt.bbbbbb......', '....tt..............'],
  ['....................', '..................c.', '................ccc.', 'tt............bbbbK.', 'ttt...bbbbbbbbbbbbby', '.tttttbbbbffffbbbb..', '..ttttt..fffff......', '....tt....fff.......'],
];

CRITTERS['bg-volcano'] = [
  { id: 'lizard', frames: 2, size: [14, 5], moves: 'walk', level: 1, variants: 2 },
  { id: 'embermoth', frames: 2, size: [9, 7], moves: 'fly', level: 2 },
  { id: 'chick', frames: 2, size: [9, 8], moves: 'walk', level: 3 },
  { id: 'phoenix', frames: 2, size: [22, 10], moves: 'fly', level: 4 },
];
CRITTERS_ART['bg-volcano'] = {
  lizard: (f, v) => critterOf('bg-volcano', LIZARD[f], v ? { b: '#3a4a5a', h: '#4a5a6a', t: '#2a3a4a', f: '#2a3a4a' } : { b: '#5a3a3a', h: '#6a4a40', t: '#ff7a2a', f: '#4a2a2a' }, { feet: true, shadow: [5, 1] }),
  embermoth: (f) => critterOf('bg-volcano', MOTH[f], { a: ['#ffb03a', 'fur'], b: ['#3a2020', 'fur'], c: ['#ff6a1a', 'fur'] }, { glow: [2.5, 1.5, 5, 4, '#ffb03a', 0.45] }),
  chick: (f) => critterOf('bg-volcano', CHICK[f], { b: '#ff9a3a', B: '#ffd06a', c: ['#ff4a2a', 'fur'], y: '#ffe060', l: '#c86a2a' }, { feet: true, shadow: [3, 1] }),
  phoenix: (f) => critterOf('bg-volcano', PHOENIX[f], { b: ['#ff6a1a', 'fur'], f: ['#ffc83a', 'fur'], c: ['#ffe070', 'fur'], t: ['#ff3a2a', 'fur'], y: ['#ffe070', 'fur'] }, { glow: [10, 4, 13, 7, '#ffb03a', 0.4] }),
};

// ---------- the Rainforest ----------

const JUNGLE = {
  leaf: ['#10342e', '#174634', '#1f5c3a', '#2c7442', '#408e48', '#5ea852', '#8cc464'],
  bright: ['#1a4430', '#225c36', '#2e763c', '#3e9042', '#5aaa4a', '#82c45a', '#b4e07a'],
  bark: ['#3a2626', '#52382e', '#6c4c38', '#866244', '#a07c54', '#bc9a6c', '#d8b88a'],
  earth: ['#38201f', '#553227', '#76482e', '#966236'],
  flame: ['#8a1a1a', '#c8301e', '#f0521e', '#ff7a2a', '#ffa040', '#ffcc6a', '#fff0b0'],
  banana: ['#14402a', '#1e5a30', '#2c7a36', '#3e9a3c', '#62b84a', '#94d460', '#c8ec8a'],
  lime: ['#1a2e22', '#243f26', '#32562a', '#45702e', '#5c8c34', '#7aa83e', '#a0c650', '#cce070'],
};

function flameTree(s, stage, wilt, v) {
  const t = roundTree(s, stage, wilt, v, {
    P: JUNGLE.bright, BK: JUNGLE.bark, soil: JUNGLE.earth, tpl: WIDE, ry: 0.62, Rk: 1.1, th: 4,
    crownP: (st) => (st >= 4 ? JUNGLE.flame : null), crownKind: (st) => (st >= 4 ? 'floss' : null),
  });
  if (!t) return;
  const { box, inCrown, keep } = t; const F = JUNGLE.flame;
  if (stage === 3) sprinkle(box, 5, v + 1, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.a.', 'aba'], { a: F[3], b: F[5] }, tg('fl', F[2])); });
  if (stage >= 4) {
    sprinkle(box, stage === 4 ? 6 : 9, v + 2, inCrown, (x, y) => dab(s, x - 1, y, ['.g', 'gG'], { g: JUNGLE.bright[3], G: JUNGLE.bright[4] }, tg('leaf', JUNGLE.bright[3])));
    sprinkle(box, 5, v + 3, inCrown, (x, y, k) => { if (keep(k) && h2(x, y, 4) < 0.45) s.set(x, y, F[6], tg('fl', F[3])); });
  }
  if (stage === 5) petalFall(s, t, [F[2], F[4]]);
}

function jadeVine(s, stage, wilt, v) {
  const t = roundTree(s, stage, wilt, v, { P: JUNGLE.leaf, BK: JUNGLE.bark, soil: JUNGLE.earth, tpl: ROUND, ry: 0.8, th: 3 });
  if (!t) return;
  const { box, fx } = t; const J = ['#1a8a7a', '#3ac8b0', '#6ae8d0', '#b8fff0'];
  if (stage < 3) return;
  // chains of turquoise claw flowers hanging from under the crown
  const n = [0, 0, 0, 3, 5, 7][stage];
  for (let k = 0; k < n; k += 1) {
    const x = Math.round(fx - t.R * 0.8 + ((k + 0.5) / n) * t.R * 1.6 + (h2(k, v, 3) - 0.5) * 3);
    let y = box[1]; while (y < box[3] + 2 && !(s.get(x, y) && !s.get(x, y + 1))) y += 1;
    if (h2(k, stage, 9) < wilt * 0.25) continue;
    const len = Math.round((4 + h2(k, v, 5) * 6) * (stage / 5) + 2) - wilt;
    for (let j = 1; j <= len; j += 1) {
      s.set(x, y + j, j === 1 ? JUNGLE.leaf[2] : J[(j % 3) + (j > len - 2 ? 1 : 0)], tg('fl', J[1]));
      if (j % 2 === 0 && j > 1) s.set(x + (j % 4 ? 1 : -1), y + j, J[j % 4 ? 2 : 1], tg('fl', J[1]));
    }
  }
}

function bananaPlant(s, stage, wilt, v) {
  const fx = 40; const fy = 80; const P = JUNGLE.banana;
  for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 6; x <= fx + 6; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 6, 1.7)) s.set(x, y, h2(x, y, 3) < 0.3 ? JUNGLE.earth[1] : JUNGLE.earth[2], 'ground');
  const H = [4, 6, 11, 16, 21, 26][stage]; const len = [5, 8, 11, 15, 18, 21][stage];
  s.shadow(fx + 3, fy, len * 0.8, 2.4, 0.26);
  // the stem: rolled leaf bases, green and wine-red
  for (let y = fy - H; y <= fy; y += 1) for (let dx = -1; dx <= 2; dx += 1) s.set(fx + dx, y, dx < 0 ? '#8ab060' : dx === 2 ? '#3a5a2a' : (y % 5 === 0 ? '#7a3a3a' : '#5a8a40'), tg('wood', '#4a6a34'));
  // big paddle leaves with torn edges and a light midrib
  const paddle = (a, l, k) => {
    const dr = 2 + wilt * 4;
    for (let t = 0; t <= l; t += 0.5) {
      const x = fx + Math.cos(a) * t; const y = fy - H + Math.sin(a) * t * 0.6 + (t / l) ** 2 * dr;
      const wd = Math.sin(Math.PI * Math.min(1, (t / l) * 0.9 + 0.1)) * (2 + l * 0.09);
      for (let q = -wd; q <= wd; q += 0.5) {
        const xx = Math.round(x - Math.sin(a) * q * 0.5); const yy = Math.round(y + Math.cos(a) * q * 0.9);
        if (Math.abs(q) > 1 && (Math.round(t * 2) + k) % 5 === 0) continue; // the tears
        const c = Math.abs(q) < 0.5 ? P[6] : q < 0 ? P[5] : P[3];
        s.set(xx, yy, c, tg('leaf', P[3]));
      }
    }
  };
  const leaves = stage === 0 ? [[-1.4, 1]] : stage === 1 ? [[-2.4, 1], [-0.7, 1]] : [[-2.8, 1], [-0.35, 1], [-2.1, 0.85], [-1.0, 0.9], [-1.6, 0.7]];
  leaves.forEach(([a, l], k) => paddle(a, len * l, k + v));
  if (stage >= 4) {
    // a hanging bunch of bananas and its wine-red flower
    const bx = fx + 4; const by = fy - H + 3;
    for (let y = by; y < by + 3; y += 1) s.set(bx, y, '#5a8a40', tg('wood', '#4a6a34'));
    const Y = stage === 5 ? ['#a87a10', '#e8c030', '#ffe878'] : ['#4a7a2a', '#8ab840', '#c8e070'];
    dab(s, bx - 2, by + 3, ['abcba', 'bcccb', '.bcb.', '..b..'], { a: Y[0], b: Y[1], c: Y[2] }, tg('fruit', Y[1]));
    dab(s, bx - 1, by + 7, ['aba', '.a.'], { a: '#7a1a3a', b: '#c83a5a' }, tg('fl', '#a02a4a'));
  }
}

TREES['bg-rainforest'] = {
  kinds: ['flame', 'jade', 'banana', 'flame', 'jade'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'flame') return flameTree(s, stage, wilt, v);
    if (kind === 'jade') return jadeVine(s, stage, wilt, v);
    return bananaPlant(s, stage, wilt, v);
  },
};

FLOWERS['bg-rainforest'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#fff4f0', 0.14 * old) : c);
    const L = JUNGLE.bright;
    if (stage === 0) { sprouts(s, v, [L[2], L[3], L[5], L[6]], JUNGLE.earth, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.3);
    if (kind === 0) {
      // orchids: two broad leaves, arching sprays of flowers
      for (const [sd, ox] of [[-1, -3], [1, 3]]) for (let y = FY - 5; y <= FY; y += 1) for (let x = FX - 7; x <= FX + 7; x += 1) if (inEll(x, y, FX + ox, FY - 2, 3.2, 2.2)) s.set(x, y, Math.abs(y - (FY - 2)) < 0.6 ? L[5] : x < FX + ox ? L[4] : L[3], tg('leaf', L[3]));
      if (stage === 1) return;
      const O = [['#6a2a9a', '#a85ae0', '#e0b8ff', '#ffe060'], ['#a82a6a', '#f070b0', '#ffc0e0', '#ffe060'], ['#8a8aa0', '#f6f2fa', '#ffffff', '#ff7ab0']][v].map(pale);
      const sp = v === 2 ? [[-1, 1]] : [[-1, 1], [1, 0.8]];
      sp.forEach(([dir, k]) => {
        const pts = []; for (let i = 0; i <= 12 * k; i += 1) { const t = i / (12 * k); const x = Math.round(FX + dir * (t * 7 * k)); const y = Math.round(FY - 4 - Math.sin(t * Math.PI * 0.8) * 9 * k + wilt * t * 3); pts.push([x, y]); s.set(x, y, L[2], tg('stem', L[2])); }
        const n = stage === 2 ? 2 : 3 - (wilt >= 2 ? 1 : 0);
        for (let q = 0; q < n; q += 1) {
          const [x, y] = pts[pts.length - 1 - q * 3];
          if (stage === 2) { s.set(x, y + 1, O[1], tg('fl', O[1])); continue; }
          dab(s, x - 1, y - 1, ['b.b', '.y.', 'aca'], { a: O[1], b: O[2], c: O[0], y: O[3] }, tg('fl', O[1]));
        }
      });
      return;
    }
    if (kind === 1) {
      // bromeliads: a rosette of striped leaves with a red heart
      const len = [0, 5, 8, 9][stage];
      for (const [a, l] of [[-2.7, 0.9], [-2.2, 1], [-1.8, 0.9], [-1.35, 1], [-0.9, 0.9], [-0.45, 1], [-3.1, 0.7], [0, 0.7]]) {
        const ll = len * l;
        for (let t = 0; t < ll; t += 0.5) {
          const x = FX + Math.cos(a) * t * 1.1; const y = FY - 1 + Math.sin(a) * t * 0.85 + (t / ll) ** 2 * (2 + wilt * 1.5);
          const w = 1.4 * (1 - t / ll) + 0.5;
          for (let q = -w; q <= w; q += 0.5) {
            const c = stage === 3 && t > ll - 2 ? pale('#e8504a') : Math.round(t * 1.4) % 3 === 0 ? JUNGLE.lime[6] : q < 0 ? JUNGLE.lime[5] : JUNGLE.lime[4];
            s.set(Math.round(x - Math.sin(a) * q), Math.round(y + Math.cos(a) * q), c, tg('leaf', JUNGLE.lime[3]));
          }
        }
      }
      if (stage >= 2) dab(s, FX - 2, FY - 5, stage === 2 ? ['.rr.', 'rRRr'] : ['..r.r', '.rRrR', 'rRwWR', '.rrwr'], { r: pale('#d8303a'), R: pale('#ff6a5a'), w: '#5ab8d8', W: '#d8f4ff' }, tg('fl', '#c8203a'));
      return;
    }
    if (kind === 2) {
      // birds of paradise: blue-green paddle leaves and the orange and blue crest
      for (const [a, l] of [[-2.4, 7], [-0.8, 7], [-1.7, 9]]) frond(s, FX, FY, a, l * [0, 0.6, 0.9, 1][stage], 1 + wilt, ['#143a3a', '#1e5244', '#2a6a4e', '#3a8458', '#5aa068', '#84bc80', '#b0d8a0'], { w: 1.8, kind: 'leaf', k: Math.round(a * 3) });
      if (stage === 1) return;
      clump(s, v === 1 ? 2 : v, stage, wilt, old, 13, ['#3a7458', '#5a9a6a'], (x, y, i, lean) => {
        if (stage === 2) { dab(s, x - 1, y, ['ab'], { a: '#4a8a6a', b: '#e07a3a' }, tg('fl', '#c86a2a')); return; }
        const d = lean > 0 ? 1 : -1;
        const rows = wilt >= 2 ? ['aab', '..b'] : ['o...', 'oo..', 'BooB', 'aaab'];
        dab(s, x - (d > 0 ? 0 : 3), y - (wilt >= 2 ? 0 : 3), d > 0 ? rows : rows.map((r) => [...r].reverse().join('')), { o: pale('#ff8a2a'), B: '#3a6ae0', a: '#5a8a6a', b: '#3a6a58' }, tg('fl', '#e07a2a'));
        void i;
      });
      return;
    }
    // anthuriums: heart-shaped leaves and glossy red spathes with a yellow spike
    for (const [dx, dy] of [[-4, -4], [4, -5], [0, -7]].slice(0, stage === 1 ? 2 : 3)) dab(s, FX + dx - 2, FY + dy + wilt, ['ab.ba', 'abbba', '.bbb.', '..b..'], { a: L[5], b: L[3] }, tg('leaf', L[3]));
    if (stage === 1) return;
    const A = [['#8a0a1e', '#e0203a', '#ff7a7a', '#ffe060'], ['#a83a6a', '#f07ab0', '#ffc0e0', '#fff0a0'], ['#8a0a1e', '#e0203a', '#ff7a7a', '#ffe060']][v].map(pale);
    [[-2, -10], [3, -9]].slice(0, v === 2 ? 1 : 2).forEach(([dx, dy]) => {
      const x = FX + dx + (wilt >= 2 ? 1 : 0); const y = FY + dy + wilt;
      for (let k = y + 3; k < FY - 3; k += 1) s.set(x, k, L[2], tg('stem', L[2]));
      if (stage === 2) { dab(s, x, y + 1, ['b', 'a'], { a: L[4], b: A[1] }, tg('fl', A[1])); return; }
      dab(s, x - 2, y, wilt >= 2 ? ['.bb.', 'baab', '.bb.'] : ['cb.bc', 'bbybb', '.bbb.', '..a..'], { a: A[0], b: A[1], c: A[2], y: A[3] }, tg('fl', A[1]));
      if (wilt < 2) s.set(x, y - 1, A[3], tg('fl', A[3]));
    });
  },
};

const MORPHO = [['AA.AA', 'AaBaA', '.cBc.', '.c.c.'], ['.A.A.', '.aBa.', '..B..', '.....']];
const HUMMER = [['..ww....', '.ww.....', '.ggggh..', 'tggrhKbb', '..gg....'], ['........', '.ggggh..', 'tggrhKbb', '.ww.....', 'ww......']];
const FROG = [['.ee.ee.', 'eKggKe.', 'gggggggg', 'gwwwwwg.', 'ff...ff.'], ['.ee.ee.', 'eKggKe.', 'ggggggg.', 'gwwwwwgg', 'ff...ff.']];
const TOUCAN = [['......bbbb.........', '....bbbbbbW........', '..bbbbbbbWWeKOOOOO.', '.bbbbbbbWWWWOOOOOOy', 'bbbBbbbbWWWWoooooy.', 'bbbbbbbbbWW........', '.bbbbbbbbb.........', '..rr.bbb...........'], ['......bbbb.........', '....bbbbbbW........', '..bbbbbbbWWKKOOOOO.', '.bbbbbbbWWWWOOOOOOy', 'bbbBbbbbWWWWoooooy.', 'bbbbbbbbbWW........', '.bbbbbbbbb.........', '..rr.bbb...........']];

CRITTERS['bg-rainforest'] = [
  { id: 'morpho', frames: 2, size: [7, 6], moves: 'fly', level: 1 },
  { id: 'hummingbird', frames: 2, size: [10, 7], moves: 'fly', level: 2, variants: 2 },
  { id: 'treefrog', frames: 2, size: [10, 7], moves: 'sit', level: 3, variants: 2 },
  { id: 'toucan', frames: 2, size: [21, 10], moves: 'sit', level: 4 },
];
CRITTERS_ART['bg-rainforest'] = {
  morpho: (f) => critterOf('bg-rainforest', MORPHO[f], { A: ['#2a6ae8', 'fur'], a: ['#6ab8ff', 'fur'], c: ['#1a3a9a', 'fur'], B: ['#2a1a2a', 'fur'] }),
  hummingbird: (f, v) => critterOf('bg-rainforest', HUMMER[f], { g: ['#2ab88a', 'fur'], h: ['#3ad8a0', 'fur'], r: [v ? '#c83aa8' : '#e83a3a', 'fur'], w: ['#a8f0e0', 'fx'], t: ['#1a7a6a', 'fur'], b: ['#2a1a2a', 'fur'] }),
  treefrog: (f, v) => critterOf('bg-rainforest', FROG[f], v ? { e: '#3a6ae0', g: '#2a5ad8', w: '#7ab0ff', f: '#1a2a6a' } : { e: '#e83a3a', g: '#4ac84a', w: '#d8f4a8', f: '#ff8a2a' }, { feet: true, shadow: [4, 1] }),
  toucan: (f) => critterOf('bg-rainforest', TOUCAN[f], { b: '#2a2238', B: '#3a3248', W: '#fff4c8', e: '#5ad8ff', O: '#ff9a2a', o: '#ffd040', y: '#2a1a1a', r: '#e83a3a' }, { feet: true, shadow: [6, 1.2] }),
};

// ---------- shared: weeping trees, streamers, twinkles ----------

/** A little four-point twinkle in the air (fx: no outline). */
function twinkle(s, x, y, c, core = '#ffffff') {
  s.set(x, y, core, 'fx'); s.set(x - 1, y, c, 'fx'); s.set(x + 1, y, c, 'fx'); s.set(x, y - 1, c, 'fx'); s.set(x, y + 1, c, 'fx');
}

/**
 * A weeping tree: a trunk, a low dome of leaves and a curtain of hanging strands, the middle ones
 * shorter so the trunk shows. o: { P (the dome's leaves), BK, soil, stake, tie, domeP(stage), domeKind(stage),
 * strand(t, lit, x, y) → [colour, kind] for a strand's pixel (t 0 at the top .. 1 at the tip; lit -1..1) }.
 */
function weeping(s, stage, wilt, v, o) {
  const fx = 40; const fy = 80; const { P, BK } = o;
  if (stage === 0) { sapling(s, fx, fy, { BK, P, soil: o.soil, wilt, stake: o.stake, tie: o.tie }); return null; }
  const R = [0, 6, 9, 12.5, 16, 19][stage]; const th = [0, 7, 10, 14, 18, 22][stage];
  const cy = Math.round(fy - th - R * 0.35);
  const flip = v % 2 ? -1 : 1; const tw = GROW.tw[stage];
  s.shadow(fx + 2, fy, R + 2, 2.4 + stage * 0.3, 0.22);
  trunk(s, fx, cy, fy, Math.max(1, tw - 1.5), tw, BK, { roots: stage >= 4 ? stage - 2 : 0, seed: v, lean: ((v % 3) - 1) * 0.8 });
  if (stage >= 3) {
    branch(s, fx, Math.round(cy + R * 0.25), Math.round(fx - R * 0.55 * flip), Math.round(cy - R * 0.15), Math.max(1, tw - 3), BK);
    branch(s, fx, Math.round(cy + R * 0.15), Math.round(fx + R * 0.5 * flip), Math.round(cy - R * 0.25), Math.max(1, tw - 3), BK);
  }
  // the curtain, hanging from under the dome
  const full = (fy - 3 - cy) * (1 - wilt * 0.1);
  for (let x = Math.floor(fx - R * 1.04); x <= fx + R * 1.04; x += 1) {
    const dx = x + 0.5 - fx; const e = Math.abs(dx) / R;
    if (h2(x, v, 23) < 0.12 + wilt * 0.08) continue; // gaps in the curtain
    const mid = 0.42 + 0.58 * Math.min(1, e / 0.5);
    const rim = e > 0.86 ? 1 - (e - 0.86) * 2.6 : 1;
    const len = Math.round(full * mid * rim + (h2(v, x, 24) - 0.5) * 4 - (x % 3 === 0 ? 2 : 0));
    const y0 = Math.round(cy + R * 0.1 - (1 - e * e) * R * 0.1);
    const lit = clamp(-dx / R * 0.7 + ((x + v) % 2 ? -0.45 : 0.3), -1, 1);
    for (let j = 0; j <= len; j += 1) {
      const y = y0 + j;
      // the strands swing out a little at their tips (more when they wilt: they hang limp)
      const xx = x + (j > len * 0.7 && e > 0.6 && wilt < 2 ? Math.sign(dx) : 0);
      const [c, k] = o.strand(j / Math.max(1, len), lit, xx, y);
      s.set(xx, y, c, tg(k, c));
    }
  }
  const tpl = [[0, -0.18, 0.6], [-0.56, 0.06, 0.46], [0.56, 0.08, 0.46], [-0.26, -0.44, 0.42], [0.3, -0.46, 0.4], [0, 0.1, 0.5]];
  const dome = clumpsOf(tpl, fx, cy, R, wilt, flip);
  const DP = (o.domeP && o.domeP(stage)) || P; const kind = (o.domeKind && o.domeKind(stage)) || 'leaf';
  leafMass(s, dome, DP, { seed: v * 7 + stage, squash: 0.72, kind, thin: wilt });
  const box = crownBox(dome);
  const inCrown = (x, y) => s.kind(x, y) === kind && s.get(x, y - 2) && s.get(x - 1, y) && s.get(x + 1, y);
  const keep = (k) => h2(k, stage, 95) > wilt * 0.22;
  return { fx, fy, flip, R, cy, box, clumps: dome, inCrown, keep };
}

/** A soft streamer from (x0, y0) at angle a, len long, drooping, w0 thick at its root, coloured along its length from G. */
function streamer(s, x0, y0, a, len, droop, w0, G, kind, seed = 0) {
  const n = Math.max(4, Math.round(len * 3));
  for (let i = 0; i <= n; i += 1) {
    const t = i / n;
    const cx = x0 + Math.cos(a) * len * t; const cy = y0 + Math.sin(a) * len * t * 0.6 + droop * t * t;
    const nx = -Math.sin(a); const ny = Math.cos(a);
    const w = w0 * (1 - t * 0.78) + 0.35;
    for (let q = -w; q <= w; q += 0.5) {
      const x = Math.round(cx + nx * q); const y = Math.round(cy + ny * q);
      if (t > 0.6 && Math.abs(q) > w * 0.5 && h2(x, y, seed) < 0.25) continue; // a frayed tail
      const gi = clamp(Math.floor(t * G.length + (bayer(x, y) - 0.5) * 1.3), 0, G.length - 1);
      const R = G[gi];
      const c = q < -w * 0.35 ? R[2] : q > w * 0.4 ? R[0] : R[1];
      s.set(x, y, c, tg(kind, R[1]));
    }
  }
}

// ---------- Rainbow Land ----------

const RBOW = {
  hue: ['#ff94b4', '#ffb070', '#ffd84a', '#86da94', '#76bfff', '#b89aff'].map((c) => ramp(c, 3, 3)),
  leaf: ['#22665e', '#2e8266', '#3e9e6e', '#56b878', '#7ccc84', '#a8e09a', '#d6f6c0'],
  bark: ['#5a3656', '#7e4c66', '#a46a76', '#c48c88', '#dcae9e', '#f0d0ba', '#fceadc'],
  cloud: ['#6e5c9c', '#8c7cb8', '#ab9ed0', '#c9c0e4', '#e2ddf2', '#f3f0fb', '#ffffff'],
  soil: ['#8a5a7a', '#a87892', '#c89aae', '#e4c0cc'],
  stem: ['#2e8266', '#46a070', '#6cbe80', '#a0dc96'],
};
const CANE = ['#e4709a', '#ff9ab8', '#ffffff'];

/** A blossom tree in one of the rainbow's colours (v): green and budding, then a cloud of its colour. */
function rainbowBlossom(s, stage, wilt, v) {
  const H = RBOW.hue[v % 6]; const H2 = RBOW.hue[(v + 3) % 6];
  const t = roundTree(s, stage, wilt, v, {
    P: RBOW.leaf, BK: RBOW.bark, soil: RBOW.soil, tpl: v % 2 ? WIDE : ROUND, ry: v % 2 ? 0.78 : 0.86, Rk: 1.05, th: 2,
    stake: CANE, tie: RBOW.hue[(v + 4) % 6][3],
    crownP: (st) => (st >= 4 ? H : null), crownKind: (st) => (st >= 4 ? 'floss' : null),
  });
  if (!t) return;
  const { fx, fy, R, box, inCrown, keep } = t;
  if (stage === 3) sprinkle(box, 5, v + 41, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: H[4], b: H[6] }, tg('fl', H[3])); });
  if (stage >= 4) {
    sprinkle(box, stage === 4 ? 7 : 11, v + 42, inCrown, (x, y) => dab(s, x - 1, y, ['.g', 'gG'], { g: RBOW.leaf[3], G: RBOW.leaf[4] }, tg('leaf', RBOW.leaf[3])));
    sprinkle(box, 4, v + 43, inCrown, (x, y, k) => { if (keep(k) && h2(x, y, 4) < 0.42) s.set(x, y, h2(x, y, 5) < 0.35 ? '#ffffff' : H[6], tg('fl', H[3])); });
  }
  if (stage === 5) {
    // a few blossoms of the opposite colour, petals drifting, sugar sparkles in the air
    sprinkle(box, 9, v + 44, inCrown, (x, y, k) => { if (keep(k + 2)) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: H2[4], b: '#ffffff' }, tg('fl', H2[3])); });
    petalFall(s, t, [H[4], H[5]]);
    if (wilt < 2) [[-1.15, -0.4], [1.1, -0.7], [-0.6, -1.05]].forEach(([u, w]) => twinkle(s, Math.round(fx + u * R), Math.round(t.cy + w * R), H[5]));
  }
  void fy;
}

/** A rainbow willow: a green dome, its curtain turning to rainbow bands as it grows. */
function rainbowWillow(s, stage, wilt, v) {
  const L = RBOW.leaf;
  const band = (t) => RBOW.hue[clamp(Math.floor(t * 6), 0, 5)];
  const t = weeping(s, stage, wilt, v, {
    P: L, BK: RBOW.bark, soil: RBOW.soil, stake: CANE, tie: RBOW.hue[5][3],
    domeP: (st) => (st >= 4 ? RBOW.hue[0] : null), domeKind: (st) => (st >= 4 ? 'floss' : null),
    strand: (tt, lit, x, y) => {
      const i = clamp(3 + Math.round(lit), 2, 5);
      if (stage <= 2 || (stage === 3 && tt < 0.62)) return [L[i], 'vine'];
      const tb = stage === 3 ? (tt - 0.62) / 0.38 * 0.99 : tt;
      const B = band(tb + (bayer(x, y) - 0.5) * 0.06);
      return [B[clamp(i, 2, 6)], 'fl'];
    },
  });
  if (!t) return;
  const { box, inCrown, keep, fx, R, cy } = t;
  if (stage === 3) sprinkle(box, 5, v + 51, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: RBOW.hue[0][4], b: '#ffffff' }, tg('fl', RBOW.hue[0][3])); });
  if (stage >= 4) sprinkle(box, 5, v + 52, inCrown, (x, y, k) => { if (keep(k) && h2(x, y, 6) < 0.45) s.set(x, y, '#ffffff', tg('fl', RBOW.hue[0][3])); });
  if (stage === 5 && wilt < 2) [[-1.2, 0.2], [1.25, -0.1], [0.9, -0.85]].forEach(([u, w]) => twinkle(s, Math.round(fx + u * R), Math.round(cy + w * R), RBOW.hue[2][5]));
}

/** A candy-striped trunk (like the candy trees round Rainbow Land). */
const caneTrunk = (s) => (fx, fy, cy, R, tw) => {
  const half = Math.max(1, tw / 2);
  for (let y = Math.round(cy); y <= fy; y += 1) for (let x = Math.floor(fx - half + 0.5); x < fx + half; x += 1) {
    const u = (x + 0.5 - fx) / half; const st = (y + x + 64) % 6 < 3;
    s.set(x, y, st ? (u < 0 ? '#ffffff' : '#f0e4f4') : (u < 0 ? '#ff9ab8' : '#e4709a'), tg('wood', '#c06090'));
  }
};

/** A cloud tree: a puff of cloud on a candy-striped trunk; pastel blossoms in it, then its own little rainbow. */
function cloudTree(s, stage, wilt, v) {
  const C = RBOW.cloud;
  const t = roundTree(s, stage, wilt, v, {
    P: C, BK: RBOW.bark, soil: RBOW.soil, tpl: WIDE, ry: 0.68, Rk: 1.02, th: 3, stake: CANE, tie: RBOW.hue[4][3],
    crownKind: () => 'cloud',
    trunk: (fx, fy, cy, R, tw, flip) => {
      caneTrunk(s)(fx, fy, cy + R * 0.2, R, Math.max(2, tw - 1));
      if (stage === 5 && wilt < 2) {
        // a little rainbow arching over the cloud (behind it)
        const ox = fx; const oy = cy + R * 0.3; const r0 = R * 1.12;
        for (let y = Math.floor(oy - r0 - 1); y <= oy; y += 1) for (let x = Math.floor(ox - r0 - 1); x <= ox + r0 + 1; x += 1) {
          const d = Math.hypot(x + 0.5 - ox, (y + 0.5 - oy) * 1.08);
          const b = Math.floor((r0 - d) / 1.2);
          if (b < 0 || b > 5) continue;
          s.set(x, y, RBOW.hue[b][4], tg('fl', RBOW.hue[b][3]));
        }
      }
      void flip;
    },
  });
  if (!t) return;
  const { fx, R, cy, box, inCrown, keep } = t;
  if (stage >= 3) sprinkle(box, stage === 3 ? 6 : 5, v + 61, inCrown, (x, y, k) => {
    if (!keep(k)) return;
    const H = RBOW.hue[(k + v) % 6];
    if (stage === 3) s.set(x, y, H[4], tg('fl', H[3])); else dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: H[4], b: H[6] }, tg('fl', H[3]));
  });
  // a sprinkle of sugar raindrops under it
  if (stage >= 4 && wilt < 2) [[-0.5, 0.55], [0.1, 0.75], [0.6, 0.5], [-0.15, 0.95]].slice(0, stage - 2).forEach(([u, w], k) => { const x = Math.round(fx + u * R); const y = Math.round(cy + w * R); s.set(x, y, RBOW.hue[4][5], 'fx'); s.set(x, y + 1, RBOW.hue[4][3], 'fx'); void k; });
  if (stage === 5 && wilt < 2) twinkle(s, Math.round(fx - R * 1.15), Math.round(cy - R * 0.2), RBOW.hue[2][5]);
}

TREES['bg-rainbow'] = {
  kinds: ['blossom', 'willow', 'blossom', 'cloud', 'blossom'],
  vary: (spot) => ((spot % 6) + 6) % 6, // the blossoms go round the rainbow
  draw(s, kind, stage, wilt, v) {
    if (kind === 'willow') return rainbowWillow(s, stage, wilt, v);
    if (kind === 'cloud') return cloudTree(s, stage, wilt, v);
    return rainbowBlossom(s, stage, wilt, v);
  },
};

FLOWERS['bg-rainbow'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#ffffff', 0.16 * old) : c);
    const ST = RBOW.stem;
    if (stage === 0) { sprouts(s, v, ST, RBOW.soil, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.2);
    if (kind === 0) {
      // rainbow tulips: every stem its own colour
      tuft(s, 4, ['#256e58', '#3a9068', '#5cb07a', '#8ed090'], { h: stage === 1 ? 5 : 3, seed: v });
      if (stage === 1) return;
      clump(s, v, stage, wilt, old, 12, ST, (x, y, i) => {
        const P = RBOW.hue[(i * 2 + v) % 6].map(pale);
        if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: ST[2], b: P[3] }, tg('fl', P[3])); return; }
        if (wilt >= 2) { dab(s, x - 1, y - 1, ['b.b', 'aba'], { a: P[1], b: P[3] }, tg('fl', P[3])); return; }
        dab(s, x - 1, y - 3, ['c.b', 'cbb', 'bba', '.a.'], { a: P[1], b: P[3], c: P[5] }, tg('fl', P[3]));
      });
      return;
    }
    if (kind === 1) {
      // cloud flowers: puffs of cloud on silvery stems, a drop of colour in each
      tuft(s, 4, ['#3e7a7a', '#56989a', '#7ab8b4', '#a8d8d0'], { h: stage === 1 ? 4 : 2, seed: v + 2 });
      if (stage === 1) { [[-3, -4], [3, -5]].forEach(([dx, dy]) => dab(s, FX + dx - 1, FY + dy, ['ab', 'bb'], { a: '#c8ece4', b: '#7ab8b4' }, tg('leaf', '#56989a'))); return; }
      const C = RBOW.cloud;
      clump(s, v, stage, wilt, old, 12, ['#56989a', '#7ab8b4'], (x, y, i) => {
        if (stage === 2) { dab(s, x - 1, y - 1, ['ab', 'bb'], { a: C[5], b: C[3] }, tg('cloud', C[3])); return; }
        const H = RBOW.hue[(i + v * 2) % 6];
        if (wilt >= 2) { dab(s, x - 1, y - 1, ['abb', '.bc'], { a: C[4], b: C[3], c: C[2] }, tg('cloud', C[3])); return; }
        dab(s, x - 2, y - 3, ['.ab..', 'aabb.', 'abhbb', '.bbcc'], { a: pale(C[6]), b: pale(C[5]), c: C[3], h: H[4] }, tg('cloud', C[4]));
      });
      return;
    }
    if (kind === 2) {
      // heart blossoms: heart-shaped leaves and hearts in bloom
      const lv = ['#2e8266', '#46a070', '#6cbe80'];
      [[-5, -3], [3, -4], [-1, -6]].slice(0, stage === 1 ? 2 : 3).forEach(([dx, dy]) => dab(s, FX + dx, FY + dy + wilt, ['a.a', 'abb', '.b.'], { a: lv[2], b: lv[1] }, tg('leaf', lv[1])));
      if (stage === 1) return;
      const P = [RBOW.hue[0], ramp('#ff6a9a', 3, 3), RBOW.hue[5]][v].map(pale);
      clump(s, v, stage, wilt, old, 12, ST, (x, y, i) => {
        if (stage === 2) { dab(s, x - 1, y - 1, ['.b', 'ba'], { a: P[2], b: P[4] }, tg('fl', P[3])); return; }
        if (wilt >= 2) { dab(s, x - 1, y - 1, ['b.b', '.a.'], { a: P[2], b: P[3] }, tg('fl', P[3])); return; }
        dab(s, x - 2, y - 3, ['.c.b.', 'cwbbb', 'bbbba', '.bba.', '..a..'], { a: P[1], b: P[3], c: P[5], w: '#ffffff' }, tg('fl', P[3]));
        void i;
      });
      return;
    }
    // lollipop flowers: candy swirls on sugar-white sticks
    if (stage === 1) { tuft(s, 4, ['#256e58', '#3a9068', '#5cb07a', '#8ed090'], { h: 4, seed: v + 9 }); return; }
    tuft(s, 3, ['#256e58', '#3a9068', '#5cb07a', '#8ed090'], { h: 2, seed: v + 9 });
    clump(s, v, stage, wilt, old, 13, ['#d8c8d8', '#f8f0f8'], (x, y, i) => {
      const H = RBOW.hue[(i * 2 + v + 1) % 6];
      if (stage === 2) { dab(s, x - 1, y - 1, ['ab', 'bb'], { a: H[5], b: H[3] }, tg('fl', H[3])); return; }
      const r = wilt >= 2 ? 1.6 : 2.6;
      for (let yy = -3; yy <= 3; yy += 1) for (let xx = -3; xx <= 3; xx += 1) {
        const d = Math.hypot(xx, yy);
        if (d > r) continue;
        const sw = Math.floor(((Math.atan2(yy, xx) + Math.PI) / (Math.PI * 2)) * 4 + d * 0.9) % 2;
        const c = d < 0.6 ? '#ffffff' : sw ? pale(H[xx + yy < 0 ? 4 : 3]) : (xx + yy < 0 ? '#ffffff' : '#f6eef8');
        s.set(x + xx, y - 2 + yy, c, tg('fl', H[2]));
      }
    });
  },
};

const RBFLY = [
  ['rr...rr', 'royByor', '.gyByg.', '.bb.bb.', '.v...v.'],
  ['..r.r..', '..oBo..', '..yBy..', '..gBg..', '.......'],
];
const UNICORN = [
  ['.........A......', '........eA......', '.......rhhhh....', '......rohhhKh...', '......oyhhhhhn..', '......yGbhhh....', '.......Gbhhh....', '.vb.fffffhhh....', 'vb.ffffffffff...', 'v..fsffffffsf...', 'v...fffffffff...', '....ll.....ll...', '....ll.....ll...', '....kk.....kk...'],
  ['.........A......', '........eA......', '.......rhhhh....', '......rohhhKh...', '......oyhhhhhn..', '......yGbhhh....', '.......Gbhhh....', '.vb.fffffhhh....', 'vb.ffffffffff...', 'v..fsffffffsf...', 'v...fffffffff...', '....ll......ll..', '...ll.....ll....', '...k.......kk...'],
];
const PEGASUS = [
  ['....WW..........', '...WwwW....e....', '...WwwW...hhhh..', '....WwW..mhhKhh.', '.....Ww..mhhhhhn', '......W.mmhhh...', '.pp..ffffffhh...', 'p.pffffffffff...', 'p..ffffffffff...', '....ll....ll....', '...ll....ll.....'],
  ['................', '...........e....', '..........hhhh..', '.........mhhKhh.', '.........mhhhhhn', '........mmhhh...', '.pp..ffffffhh...', 'p.pffWwwWffff...', 'p..fffWwwWfff...', '....llWwW.ll....', '...ll..W.ll.....'],
];

CRITTERS['bg-rainbow'] = [
  { id: 'butterfly', frames: 2, size: [7, 5], moves: 'fly', level: 1, variants: 2 },
  { id: 'cloudbunny', frames: 2, size: [11, 10], moves: 'walk', level: 2 },
  { id: 'unicorn', frames: 2, size: [16, 14], moves: 'walk', level: 3, variants: 2 },
  { id: 'pegasus', frames: 2, size: [16, 11], moves: 'fly', level: 4 },
];
CRITTERS_ART['bg-rainbow'] = {
  butterfly: (f, v) => {
    const H = RBOW.hue.map((r) => r[v ? 5 : 3]);
    return critterOf('bg-rainbow', RBFLY[f], { r: [H[0], 'fur'], o: [H[1], 'fur'], y: [H[2], 'fur'], g: [H[3], 'fur'], b: [H[4], 'fur'], v: [H[5], 'fur'], B: ['#3a2850', 'fur'] });
  },
  cloudbunny: (f) => critterOf('bg-rainbow', RABBIT[f], { f: '#f3f0fb', h: '#ffffff', d: '#c9c0e4', i: '#ffb0c8', e: '#ffffff', n: '#ff8aa8', w: '#ffffff' }, { feet: true, shadow: [4, 1.2] }),
  unicorn: (f, v) => {
    const H = RBOW.hue.map((r) => r[3]);
    const body = v ? { f: '#fde4f0', h: '#fff0f8', s: '#f4c8dc', l: '#f4d4e4' } : { f: '#f6f2fc', h: '#ffffff', s: '#e2d8f2', l: '#ece4f6' };
    return critterOf('bg-rainbow', UNICORN[f], { ...body, e: '#ffc0d8', n: '#ffa8c4', k: '#b292ff', A: ['#ffd84a', 'fur'], r: [H[0], 'fur'], o: [H[1], 'fur'], y: [H[2], 'fur'], G: [H[3], 'fur'], b: [H[4], 'fur'], v: [H[5], 'fur'] }, { feet: true, shadow: [6, 1.4] });
  },
  pegasus: (f) => critterOf('bg-rainbow', PEGASUS[f], { f: '#fde8f4', h: '#fff4fa', W: ['#ffffff', 'fur'], w: ['#ffd0e4', 'fur'], m: ['#86c6ff', 'fur'], p: ['#b292ff', 'fur'], e: '#ffc0d8', n: '#ff9ab8', l: '#f0d8e8' }, { glow: [8, 6, 10, 7, '#fff4fa', 0.25] }),
};

// ---------- the Golden Galaxy ----------

const GAL = {
  leaf: ramp('#6a6ae0', 3, 3),
  teal: ramp('#3ab8b0', 3, 3),
  bark: ['#1e1238', '#2c1a4e', '#3e2866', '#523a80', '#6a5098', '#8a70b4', '#b49ad4'],
  silver: ['#2a2a50', '#3e3e6a', '#585a88', '#7476a6', '#9496c2', '#b8badc', '#e0e2f4'],
  gold: ['#5a2a10', '#8a4a14', '#c07a1c', '#e8a82a', '#fcc83c', '#ffe27a', '#fff6c8'],
  dust: ['#140e3a', '#261c64', '#3a2c84', '#6a5cc8'],
  stem: ['#2a5a7a', '#3a7a94', '#58a0b4', '#8ac8d4'],
  neb: [ramp('#e070c8', 1, 1), ramp('#a070f0', 1, 1), ramp('#5aa0e8', 1, 1), ramp('#60d8e0', 1, 1)],
};
const GSTAKE = ['#c07a1c', '#e8a82a', '#fff6c8'];

/** A star-blossom tree: twilight leaves, gold stars opening all over it, then a halo of starlight. */
function starBlossom(s, stage, wilt, v) {
  const G = GAL.gold;
  const t = roundTree(s, stage, wilt, v, {
    P: GAL.leaf, BK: GAL.bark, soil: GAL.dust, tpl: v % 2 ? OVAL : ROUND, ry: v % 2 ? 1.05 : 0.86, Rk: v % 2 ? 0.9 : 1, th: 2,
    stake: GSTAKE, tie: '#63e6be',
  });
  if (!t) return;
  const { fx, R, cy, box, inCrown, keep } = t;
  const star = (x, y) => dab(s, x - 1, y - 1, ['.a.', 'aba', '.a.'], { a: G[4], b: G[6] }, tg('fl', G[3]));
  const big = (x, y) => dab(s, x - 2, y - 2, ['..a..', '.aba.', 'abwba', '.aba.', '..a..'], { a: G[3], b: G[5], w: '#ffffff' }, tg('fl', G[3]));
  if (stage === 2) sprinkle(box, 5, v + 71, inCrown, (x, y, k) => { if (keep(k) && k % 2) s.set(x, y, G[5], tg('fl', G[3])); });
  if (stage >= 3) sprinkle(box, stage === 3 ? 6 : stage === 4 ? 5 : 4, v + 72, inCrown, (x, y, k) => { if (keep(k)) (stage === 5 && k % 4 === 1 ? big : star)(x, y); });
  if (stage >= 4 && wilt < 2) {
    s.glow(fx, cy, R * 1.25, R * 1.05, G[5], stage === 5 ? 0.22 : 0.12, true);
    [[-1.2, -0.3], [1.15, -0.6], [-0.7, -1.1], [0.8, 0.5]].slice(0, stage === 5 ? 4 : 2).forEach(([u, w]) => twinkle(s, Math.round(fx + u * R), Math.round(cy + w * R), G[5]));
  }
  if (stage === 5) petalFall(s, t, [G[4], G[6]], 10);
}

/** A comet-tail tree: a slender silver tree whose crown becomes a glowing comet head trailing a long tail. */
function cometTree(s, stage, wilt, v) {
  if (stage <= 2) { roundTree(s, stage, wilt, v, { P: GAL.teal, BK: GAL.silver, soil: GAL.dust, stake: GSTAKE, tie: '#ffd43b' }); return; }
  const fx = 40; const fy = 80; const flip = v % 2 ? -1 : 1; const BK = GAL.silver;
  const H = [0, 0, 0, 24, 31, 38][stage] - wilt * 2; const lean = 5 * flip;
  s.shadow(fx + 2, fy, 8 + stage * 2, 2.4 + stage * 0.3, 0.22);
  // the dust ring at its foot
  for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 6; x <= fx + 6; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 6, 1.6)) s.set(x, y, h2(x, y, 4) < 0.12 ? GAL.gold[5] : y > fy ? GAL.dust[1] : GAL.dust[2], 'ground');
  trunk(s, fx, fy - H, fy, 1.5, Math.max(2.5, GROW.tw[stage] - 2.5), BK, { roots: stage >= 4 ? 1.5 : 1, lean, seed: v });
  const hx = fx + lean; const hy = fy - H; const r = [0, 0, 0, 4.5, 6, 7.5][stage] - wilt * 0.5;
  // the tail: streamers swept back and down from the head, gold to teal to violet
  const TAIL = [
    [GAL.gold[3], GAL.gold[5], GAL.gold[6]],
    [GAL.teal[3], GAL.teal[4], GAL.teal[6]],
    [GAL.neb[2][0], GAL.neb[2][1], GAL.neb[2][2]],
    [GAL.neb[1][0], GAL.neb[1][1], GAL.neb[1][2]],
    [GAL.neb[0][0], GAL.neb[0][1], GAL.neb[0][2]],
  ];
  const back = flip > 0 ? Math.PI : 0; const L = r * (stage === 3 ? 3 : 3.6);
  const sweep = [[-0.32, 1, 1.9], [-0.1, 0.92, 1.6], [0.18, 1.06, 1.8], [0.42, 0.86, 1.5], [0.64, 0.7, 1.3]];
  sweep.forEach(([da, lk, w], k) => {
    const a = back - da * flip; // fanned, mostly downward
    streamer(s, hx - flip * r * 0.4, hy + da * r, a, L * lk, (6 + wilt * 4 + k * 1.5), w * (r / 6) * 1.35, TAIL, 'neb', v + k);
  });
  // the head: a round glowing puff of star-flowers
  leafMass(s, [[hx, hy, r], [hx - flip * r * 0.5, hy + r * 0.25, r * 0.7], [hx + flip * r * 0.25, hy - r * 0.2, r * 0.65]], ['#8a4a14', '#c07a1c', '#e8a82a', '#fcc83c', '#ffe27a', '#fff6c8', '#ffffff'], { seed: v + 3, kind: 'neb', thin: wilt });
  if (wilt < 2) {
    s.glow(hx, hy, r * 2.4, r * 2, '#ffe27a', 0.3, true);
    s.glow(fx, fy, 10, 3, '#ffe27a', 0.25);
    [[-2.6, -0.8], [-3.6, 0.9], [-1.8, 1.6], [1.6, -1.5]].slice(0, stage - 1).forEach(([u, w]) => twinkle(s, Math.round(hx + u * r * flip), Math.round(hy + w * r), GAL.gold[5]));
  }
}

/** A nebula willow: a twilight dome and a curtain of nebula, pink to violet to blue, full of tiny stars. */
function nebulaWillow(s, stage, wilt, v) {
  const N = [GAL.neb[0], GAL.neb[1], GAL.neb[2], GAL.neb[3]];
  const t = weeping(s, stage, wilt, v, {
    P: GAL.leaf, BK: GAL.bark, soil: GAL.dust, stake: GSTAKE, tie: '#f783ac',
    strand: (tt, lit, x, y) => {
      if (stage <= 2) return [GAL.leaf[clamp(3 + Math.round(lit), 2, 5)], 'vine'];
      if (h2(x, y, v + 81) > 0.965 && wilt < 2) return ['#ffffff', 'neb'];
      const ti = (stage === 3 ? tt * 0.6 : tt) * 3.2 + (bayer(x, y) - 0.5) * 0.9 + (v % 2) * 0.4;
      const B = N[clamp(Math.floor(ti), 0, 3)];
      return [B[clamp(1 + Math.round(lit), 0, 2)], 'neb'];
    },
  });
  if (!t) return;
  const { fx, R, cy, box, inCrown, keep } = t;
  if (stage >= 3) sprinkle(box, 5, v + 82, inCrown, (x, y, k) => { if (keep(k) && k % 2 === 0) s.set(x, y, k % 3 ? '#fff6c8' : '#ffffff', tg('fl', GAL.gold[4])); });
  if (stage >= 4 && wilt < 2) {
    s.glow(fx, cy + R * 0.6, R * 1.3, R * 1.1, '#c08af0', stage === 5 ? 0.2 : 0.12, true);
    s.glow(fx, 80, R + 4, 3.5, '#c08af0', 0.3);
  }
  if (stage === 5 && wilt < 2) [[-1.25, -0.2], [1.2, 0.3], [0.5, -1.0]].forEach(([u, w]) => twinkle(s, Math.round(fx + u * R), Math.round(cy + w * R), '#e0b8ff'));
}

TREES['bg-galaxy'] = {
  kinds: ['star', 'comet', 'nebula', 'star', 'comet'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'comet') return cometTree(s, stage, wilt, v);
    if (kind === 'nebula') return nebulaWillow(s, stage, wilt, v);
    return starBlossom(s, stage, wilt, v);
  },
};

FLOWERS['bg-galaxy'] = {
  draw(s, kind, stage, wilt, old, v) {
    const pale = (c) => (old ? mix(c, '#c8c0e0', 0.16 * old) : c);
    const ST = GAL.stem; const LV = ['#1e3a6a', '#2a5488', '#3a72a4', '#5a96c0'];
    const glow = (x, y, c, k = 0.32) => { if (wilt < 2) s.glow(x + 0.5, y + 0.5, 4, 3.5, c, k, true); };
    if (stage === 0) { sprouts(s, v, ST, GAL.dust, wilt); if (!wilt) s.set(FX + 4, FY + 1, GAL.gold[5], 'ground'); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.3);
    if (kind === 0) {
      // star blossoms: gold stars on fine stems, glowing
      tuft(s, 4, LV, { h: stage === 1 ? 4 : 3, seed: v });
      if (stage === 1) return;
      const G = GAL.gold.map(pale);
      clump(s, v, stage, wilt, old, 12, ST, (x, y, i) => {
        if (stage === 2) { dab(s, x, y - 1, ['b', 'a'], { a: ST[2], b: G[4] }, tg('fl', G[3])); return; }
        if (wilt >= 2) { dab(s, x - 1, y - 1, ['a.a', '.b.'], { a: G[3], b: G[4] }, tg('fl', G[3])); return; }
        const C = i % 3 === 2 ? ['#9ad8ff', '#d8f4ff', '#ffffff'] : [G[4], G[5], G[6]];
        dab(s, x - 2, y - 3, ['..a..', 'aabaa', '.bcb.', '.a.a.'], { a: C[0], b: C[1], c: C[2] }, tg('fl', C[0]));
        glow(x, y - 2, C[1]);
      });
      return;
    }
    if (kind === 1) {
      // nebula vines: a trailing vine with puffs of nebula, pink, violet and blue, and tiny stars
      const n = stage === 1 ? 7 : 10;
      const pts = [];
      for (let i = -n; i <= n; i += 1) { const x = FX + i; const y = Math.round(FY - 1 - Math.sin((i + v * 3) * 0.45) * 1.4 - (1 - (i / n) ** 2) * 2 + wilt * 0.4); pts.push([x, y]); s.set(x, y, LV[i % 3 === 0 ? 2 : 1], tg('vine', LV[1])); if (i % 3 === 1) s.set(x, y - 1, LV[3], tg('leaf', LV[2])); }
      if (stage === 1) return;
      const at = [[-8, 0], [-3, 1], [2, 2], [7, 3], [9, 0]].slice(0, stage === 2 ? 3 : 4 + (v === 1 ? 1 : 0));
      at.forEach(([dx, c]) => {
        const [x, y] = pts[clamp(dx + n, 0, pts.length - 1)];
        const B = GAL.neb[(c + v) % 4].map(pale);
        if (stage === 2) { dab(s, x - 1, y - 2, ['ab', 'bb'], { a: B[2], b: B[1] }, tg('fl', B[1])); return; }
        const r = wilt >= 2 ? 1.5 : 2.6;
        for (let yy = -4; yy <= 1; yy += 1) for (let xx = -3; xx <= 3; xx += 1) {
          const d = Math.hypot(xx, (yy + 1.5) * 1.1); if (d > r + (h2(xx + x, yy, 3) - 0.5) * 0.8) continue;
          const l = -(xx * 0.5 + (yy + 1.5) * 0.8) / r + (bayer(x + xx, y + yy) - 0.5) * 0.6;
          s.set(x + xx, y + yy - 1, l > 0.5 ? B[2] : l > -0.3 ? B[1] : B[0], tg('fl', B[1]));
        }
        if (wilt < 2) { s.set(x - 1, y - 3, '#ffffff', tg('fl', B[1])); glow(x, y - 2, B[2], 0.26); }
      });
      return;
    }
    if (kind === 2) {
      // moon lilies: pale lilies opening like little moons, silver light round them
      for (const [dx, h, d] of [[-3, 6, -1], [2, 7, 1], [0, 5, 1]]) for (let k = 0; k < h - wilt; k += 1) s.set(FX + dx + (k > h * 0.6 ? d : 0), FY - k, k > h * 0.5 ? LV[3] : LV[2], tg('leaf', LV[1]));
      if (stage === 1) return;
      const P = [['#8a7ab8', '#c8c0e8', '#f4f0ff', '#ffffff'], ['#8a6aa8', '#e0c8f0', '#fff0ff', '#ffffff'], ['#6a8ab8', '#c0d8f0', '#f0f8ff', '#ffffff']][v].map(pale);
      clump(s, v, stage, wilt, old, 13, ST, (x, y, i) => {
        if (stage === 2) { dab(s, x, y - 2, ['b', 'a', 'a'], { a: ST[2], b: P[1] }, tg('fl', P[1])); return; }
        if (wilt >= 2) { dab(s, x - 1, y - 1, ['b..', 'aba', '.a.'], { a: P[0], b: P[1] }, tg('fl', P[1])); return; }
        dab(s, x - 2, y - 3, ['c.c.b', 'cbybb', '.bbb.', '..a..'], { a: P[0], b: P[1], c: P[3], y: '#ffe27a' }, tg('fl', P[1]));
        glow(x, y - 2, '#e0e0ff', 0.28);
        void i;
      });
      return;
    }
    // planet bulbs: little ringed planets on stems
    tuft(s, 4, LV, { h: stage === 1 ? 3 : 2, seed: v + 5 });
    if (stage === 1) { [[-4, -4], [3, -5]].forEach(([dx, dy]) => dab(s, FX + dx - 1, FY + dy, ['ab.', 'bbb'], { a: LV[3], b: LV[2] }, tg('leaf', LV[1]))); return; }
    const PL = [ramp('#ff9e6a', 3, 3), ramp('#63e6be', 3, 3), ramp('#f783ac', 3, 3), ramp('#b197fc', 3, 3)];
    clump(s, v, stage, wilt, old, 13, ST, (x, y, i) => {
      const P = PL[(i + v) % 4].map(pale); const RG = GAL.gold;
      if (stage === 2) { dab(s, x - 1, y - 1, ['ab', 'bc'], { a: P[5], b: P[3], c: P[2] }, tg('fl', P[3])); return; }
      const r = wilt >= 2 ? 1.6 : 2.4; const cy = y - 2;
      for (let yy = -3; yy <= 3; yy += 1) for (let xx = -3; xx <= 3; xx += 1) {
        const d = Math.hypot(xx, yy); if (d > r) continue;
        const l = -(xx * 0.6 + yy * 0.8) / r;
        s.set(x + xx, cy + yy, P[l > 0.45 ? 5 : l > 0 ? 4 : l > -0.5 ? 3 : 2], tg('fl', P[3]));
      }
      if (wilt < 2) for (let xx = -4; xx <= 4; xx += 1) { const yy = cy + Math.round(xx * -0.3); if (Math.abs(xx) > 2 || yy > cy) s.set(x + xx, yy, Math.abs(xx) > 3 ? RG[4] : RG[5], tg('fl', RG[3])); }
    });
  },
};

const STARSPRITE = [
  ['...b...', '..bba..', 'bbbaaac', '.aKaKc.', '.aaacc.', '.ac.cc.', '.c...c.'],
  ['w..b..w', '..bba..', 'bbbaaac', '.aKaKc.', '.aaacc.', '.ac.cc.', 'wc...cw'],
];
const MOONMOTH = [
  ['AA.....AA', 'AaA.B.AaA', '.AaABAaA.', '..AABAA..', '.cc.B.cc.', '.c.....c.'],
  ['...A.A...', '..AaBaA..', '...ABA...', '....B....', '...c.c...', '.........'],
];
const flipRows = (rows) => rows.map((r) => [...r].reverse().join(''));
const SPACEWHALE = [
  ['.....hhhhhh...tt', '...hbbbbbbbbh.t.', '..bbbsbbbbbbbbt.', '.bKbbbbbbsbbbb..', '.wwwwbbbbbbbb...', '..wwwwwwbbbb....', '....ff..........'],
  ['.....hhhhhh.....', '...hbbbbbbbbh...', '..bbbsbbbbbbbbt.', '.bKbbbbbbsbbbbtt', '.wwwwbbbbbbbb..t', '..wwwwwwbbbb....', '....ff..........'],
].map(flipRows);
const dots = (rows, pts, ch) => rows.map((r, y) => [...r].map((c, x) => (c === 'f' && pts.some(([px, py]) => px === x && py === y) ? ch : c)).join(''));
const STARSTAG = STAG.map((rows) => dots(rows, [[5, 9], [8, 10], [10, 9], [6, 11]], 's'));

CRITTERS['bg-galaxy'] = [
  { id: 'starsprite', frames: 2, size: [7, 7], moves: 'fly', level: 1, variants: 2 },
  { id: 'moonmoth', frames: 2, size: [9, 6], moves: 'fly', level: 2 },
  { id: 'spacewhale', frames: 2, size: [16, 7], moves: 'fly', level: 3 },
  { id: 'stardeer', frames: 2, size: [17, 16], moves: 'walk', level: 4 },
];
CRITTERS_ART['bg-galaxy'] = {
  starsprite: (f, v) => {
    const C = v ? { a: '#c8e8ff', b: '#ffffff', c: '#8ab8f0', w: '#e0f4ff' } : { a: '#ffd43b', b: '#fff6c8', c: '#e8a82a', w: '#fff6c8' };
    return critterOf('bg-galaxy', STARSPRITE[f], { a: [C.a, 'fur'], b: [C.b, 'fur'], c: [C.c, 'fur'], w: [C.w, 'fx'] }, { glow: [3.5, 3.5, 7, 7, C.b, 0.4] });
  },
  moonmoth: (f) => critterOf('bg-galaxy', MOONMOTH[f], { A: ['#c9b8f4', 'fur'], a: ['#fff6c8', 'fur'], B: ['#6a5aa8', 'fur'], c: ['#a890e8', 'fur'] }, { glow: [4.5, 3, 6, 4, '#e0d4ff', 0.25] }),
  spacewhale: (f) => critterOf('bg-galaxy', SPACEWHALE[f], { h: '#a8b4ff', b: '#7a8af0', s: '#fff6c8', w: '#c8c0f4', f: '#5a6ad0', t: '#6a7ae0' }, { glow: [8, 3.5, 10, 6, '#a8b4ff', 0.2] }),
  stardeer: (f) => critterOf('bg-galaxy', STARSTAG[f], { f: '#3e3a9e', h: '#4e4ab8', n: '#4e4ab8', e: '#5a56c8', w: '#fff6c8', l: '#34308a', k: '#ffd43b', g: ['#ffe27a', 'fur'], s: ['#fff6c8', 'fur'] }, { feet: true, shadow: [8, 1.5], glow: [9, 8, 12, 10, '#8a7aff', 0.35] }),
};

// ---------- the Alaskan Fjord ----------
// Evergreens mostly, as in the village's own woods: Sitka spruce and mountain hemlock, with a
// paper birch and a mountain ash (a rowan, red with berries) here and there. Fireweed, lupine,
// forget-me-nots and arctic poppies (or a tuft of cotton grass) in the grass. A blue butterfly,
// ptarmigan, snowshoe hares, a hoary marmot that stands up to whistle, and a bald eagle overhead.

const FJORD = {
  spruce: ['#12303a', '#184440', '#1f5a46', '#2c744c', '#44905a', '#6cb06c', '#a0d08a'],
  hemlock: ['#14303e', '#1b444a', '#245a54', '#31725e', '#4a8c6c', '#70a880', '#a2c89c'],
  birch: ['#26503c', '#377044', '#4c9048', '#66aa4e', '#8cc45c', '#b4dc70', '#dcf09a'],
  rowan: ['#1e463c', '#2c6444', '#3c8446', '#509c48', '#74b652', '#9ccc60', '#c8e88c'],
  bark: ['#3a2a36', '#5a3e3e', '#7a5646', '#9a7456', '#b8946e', '#d0b088', '#e4cca4'],
  white: ['#4a4456', '#7c7888', '#a8a6b4', '#cdcdd6', '#e6e6ec', '#f6f6f8', '#ffffff'],
  soil: ['#3e3440', '#5a4a4e', '#7a6658', '#9a8468'],
  stem: ['#2c6a4a', '#44904e', '#68b45a', '#9cd06c'],
  cone: { a: '#6a4028', b: '#946430', c: '#b88648' },
  under: '#102a34', // the deep shade under a bough
};

/**
 * A conifer grown to a stage: tiers of boughs that droop at their tips, lit from the left, over a
 * short bare trunk. o: { P, BK, H, W (how tall and wide by stage), tier (a tier's height), rag
 * (how uneven the boughs are), nod (the top bends over: a hemlock), cones (from stage 4) }.
 * at: { fx, fy, back } for a second, smaller tree behind the first.
 */
function conifer(s, stage, wilt, v, o, at = {}) {
  const fx = at.fx ?? 40; const fy = at.fy ?? 80; const { P, BK } = o;
  const flip = v % 2 ? -1 : 1;
  const lf = tg('leaf', P[3]);
  if (stage === 0) {
    // a seedling in a ring of fresh soil, tied to its stake
    for (let y = fy - 1; y <= fy + 1; y += 1) for (let x = fx - 5; x <= fx + 5; x += 1) if (inEll(x, y, fx + 0.5, fy + 0.5, 5.2, 1.6)) s.set(x, y, Math.abs(x - fx) > 3 || y > fy ? FJORD.soil[1] : FJORD.soil[2], 'ground');
    s.set(fx - 2, fy - 1, FJORD.soil[3], 'ground');
    const SK = ['#a8763e', '#c49060', '#e8c48a'];
    for (let y = fy - 12; y <= fy; y += 1) s.set(fx + 4, y, y === fy - 12 ? SK[2] : SK[1], tg('stake', SK[0]));
    s.set(fx, fy, BK[3], tg('wood', BK[3])); s.set(fx, fy - 1, BK[4], tg('wood', BK[3]));
    const rows = wilt > 1 ? ['...a.', '..ab.', '.abb.', '..bc.', 'abbc.', '.bbcc'] : ['..a..', '..b..', '.abc.', '..b..', '.abc.', 'abbcc', '.abc.', 'aabcc'];
    dab(s, fx - 2, fy - 1 - rows.length, rows, { a: P[5], b: P[4], c: P[2] }, lf);
    s.set(fx + 2, fy - 6, '#e8505a', 'fx'); s.set(fx + 3, fy - 6, '#e8505a', 'fx');
    s.shadow(fx + 1, fy + 1, 4, 1.2, 0.16);
    return null;
  }
  const H = Math.round(o.H[stage] * (at.k || 1)); const W = o.W[stage] * (at.k || 1);
  const bare = Math.max(2, Math.round(H * 0.09));
  const body = H - bare; const top = fy - H;
  const tiers = Math.max(2, Math.round(body / (o.tier || 7))); const tierH = body / tiers;
  s.shadow(fx + 2, fy, W * 0.42 + 1.5, 2 + stage * 0.3, at.back ? 0.14 : 0.2);
  trunk(s, fx, fy - bare - 4, fy, Math.max(1, W * 0.06), Math.max(1.6, W * 0.11), BK, { roots: stage >= 4 ? 1.1 : 0, seed: v });
  const rag = o.rag ?? 1.1;
  const nod = o.nod ? Math.max(2, Math.round(H * 0.09)) : 0;
  const sag = 1 - wilt * 0.05;
  for (let y = 0; y < body; y += 1) {
    const tier = Math.floor(y / tierH); const ph = (y - tier * tierH) / tierH;
    const tt = (y + 1) / body;
    // the leader of a hemlock nods to one side
    const mid = fx + (y < nod ? flip * Math.round((nod - y) * 0.8) : 0);
    const base = (W / 2) * (0.08 + 0.92 * tt ** (o.pow || 1)) * (0.54 + 0.46 * ph) * sag;
    const hl = Math.max(0.6, base + (h2(tier, 1, v + 77) - 0.5) * rag + (h2(y, v, 78) - 0.5) * 0.9);
    const hr = Math.max(0.6, base + (h2(tier, 2, v + 77) - 0.5) * rag + (h2(y, v, 79) - 0.5) * 0.9);
    const x0 = Math.ceil(mid - hl); const x1 = Math.floor(mid + hr);
    for (let x = x0; x <= x1; x += 1) {
      const u = x < mid ? (x - mid) / hl : (x - mid) / hr;
      // a thirsty tree thins at the tips of its boughs
      if (wilt && Math.abs(u) > 0.55 && h2(x, y, v + 81) < wilt * 0.16) continue;
      let k = u < -0.45 ? 5 : u < 0.05 ? 4 : u < 0.5 ? 3 : 2;
      // a dark line under each bough and a light one along the top of the next: the tiers read
      // in summer, and in winter the snow settles along them
      const under = y + 1 < body && Math.floor((y + 1) / tierH) !== tier && h2(x, tier, v + 5) > 0.1;
      const over = tier > 0 && Math.floor((y - 1) / tierH) !== tier;
      if (under) k -= 2; else if (ph > 0.76) k -= 1;
      if (over) k += 1; else if (ph < 0.24 && u < 0.25 && tier > 0) k += 1;
      const n = h2(x, y, 31 + v * 7);
      if (!under && !over) { if (n > 0.86) k += 1; else if (n < 0.16) k -= 1; }
      s.set(x, top + y, under && u >= 0.05 ? FJORD.under : P[clamp(k, 1, 6)], lf);
    }
    // the tips hang a little lower than the bough
    if (y > nod + 2 && Math.floor((y + 1) / tierH) !== tier && W > 9) {
      s.set(x0 - 1, top + y + 1 + (wilt > 1 ? 1 : 0), P[3], lf);
      s.set(x1 + 1, top + y + 1 + (wilt > 1 ? 1 : 0), P[2], lf);
      if (wilt) { s.set(x0 - 1, top + y + 2, P[2], lf); s.set(x1 + 1, top + y + 2, P[1], lf); }
    }
  }
  s.set(fx + (nod ? flip * Math.round(nod * 0.8) + flip : 0), top - 1, P[5], lf);
  // cones hanging under the upper boughs
  if (o.cones && stage >= 4 && !at.back) {
    const n = stage === 4 ? 4 : 7;
    for (let q = 0; q < n; q += 1) {
      if (h2(q, stage, 91) <= wilt * 0.22) continue;
      const tier = 1 + (q % Math.max(1, Math.min(3, tiers - 2)));
      const y = Math.round(top + (tier + 1) * tierH) - 2;
      const half = (W / 2) * (0.08 + 0.92 * (((tier + 1) * tierH) / body)) * 0.8;
      const x = Math.round(fx + (h2(q, v, 92) - 0.5) * 2 * half);
      if (s.kind(x, y) !== 'leaf' || s.kind(x, y + 3) !== 'leaf') continue;
      dab(s, x, y, o.nod ? ['b', 'a'] : ['c', 'b', 'a'], FJORD.cone, tg('fruit', FJORD.cone.b));
    }
  }
  return { fx, fy, top, H, W };
}

const SPRUCE = { P: FJORD.spruce, BK: FJORD.bark, H: [0, 17, 27, 38, 48, 58], W: [0, 11, 15, 21, 27, 31], tier: 7, rag: 1.2, cones: true };
const HEMLOCK = { P: FJORD.hemlock, BK: FJORD.bark, H: [0, 15, 24, 34, 44, 53], W: [0, 9, 13, 17, 21, 25], tier: 5.5, rag: 3, pow: 0.85, nod: true, cones: true };

function fjordConifer(s, kind, stage, wilt, v) {
  const o = kind === 'hemlock' ? HEMLOCK : SPRUCE;
  // a grand one has a young one coming up beside it
  if (stage === 5 && v % 2 === 0) conifer(s, 2, wilt, v + 1, o, { fx: 40 + (v % 4 ? 15 : -15), fy: 79, back: true });
  conifer(s, stage, wilt, v, o);
}

/** A paper birch: a slim white trunk with dark marks, an airy crown; catkins when it is grand. */
function paperBirch(s, stage, wilt, v) {
  const P = FJORD.birch; const BK = FJORD.white;
  const t = roundTree(s, stage, wilt, v, { P, BK, soil: FJORD.soil, tpl: OVAL, ry: 1.16, Rk: 0.74, th: 7, tw: 0.72 });
  if (!t) return;
  const { fx, fy, cy, R, box, inCrown, keep } = t;
  // the bark's dark dashes, and the dark foot of an old trunk
  for (let y = Math.round(cy); y <= fy; y += 1) {
    const xs = [];
    for (let x = fx - 8; x <= fx + 8; x += 1) if (s.kind(x, y) === 'wood') xs.push(x);
    if (!xs.length) continue;
    const r = h2(y, v, 51);
    if (r < 0.34) { const x = xs[Math.floor(h2(v, y, 52) * xs.length)]; s.set(x, y, BK[0], tg('wood', BK[3])); if (xs.length > 2 && r < 0.16 && s.kind(x + 1, y) === 'wood') s.set(x + 1, y, BK[1], tg('wood', BK[3])); }
    if (stage >= 4 && y > fy - 3) xs.forEach((x) => { if (h2(x, y, 53) < 0.6) s.set(x, y, BK[1], tg('wood', BK[3])); });
  }
  if (stage === 5) sprinkle(box, 7, v + 14, inCrown, (x, y, k) => { if (keep(k) && y > cy - R * 0.2) dab(s, x, y, ['a', 'b', 'a'], { a: '#b8a04a', b: '#dcc870' }, tg('fruit', '#b8a04a')); });
}

/** A mountain ash: a small round tree, creamy flower heads, then bunches of berries that ripen red. */
function mountainAsh(s, stage, wilt, v) {
  const P = FJORD.rowan; const BK = ['#342a36', '#4e4046', '#6a5856', '#857266', '#a28e7c', '#bcaa94', '#d6c6ae'];
  const t = roundTree(s, stage, wilt, v, { P, BK, soil: FJORD.soil, tpl: ROUND, ry: 0.8, Rk: 0.82, tw: 0.8 });
  if (!t) return;
  const { fx, fy, flip, box, inCrown, keep } = t;
  const bunch = (x, y, C) => dab(s, x - 1, y - 1, ['ab.', 'bcb', '.ba'], { a: C[0], b: C[1], c: C[2] }, tg('fruit', C[1]));
  const RED = ['#8e1c2c', '#d8343a', '#ff7a5c']; const YOUNG = ['#8a8a2a', '#d4a43a', '#f6d86a'];
  if (stage === 3) sprinkle(box, 6, v + 21, inCrown, (x, y, k) => { if (keep(k)) dab(s, x - 1, y - 1, ['.b.', 'bcb', 'aba'], { a: '#c8c4a8', b: '#f2eed8', c: '#ffffff' }, tg('fl', '#c8c4a8')); });
  if (stage === 4) sprinkle(box, 7, v + 22, inCrown, (x, y, k) => { if (keep(k)) bunch(x, y, k % 3 === 2 ? RED : YOUNG); });
  if (stage === 5) {
    sprinkle(box, 6, v + 23, inCrown, (x, y, k) => { if (keep(k)) bunch(x, y, RED); });
    [[-8, 1], [6, 2], [-2, 3], [10, 1]].forEach(([dx, dy], k) => { if (keep(k + 9)) dab(s, fx + dx * flip, fy + dy - 1, ['ab'], { a: RED[1], b: RED[2] }, tg('fruit', RED[1])); });
  }
}

TREES['bg-fjord'] = {
  kinds: ['spruce', 'hemlock', 'birch', 'spruce', 'rowan', 'spruce', 'hemlock', 'birch', 'spruce', 'rowan'],
  draw(s, kind, stage, wilt, v) {
    if (kind === 'birch') return paperBirch(s, stage, wilt, v);
    if (kind === 'rowan') return mountainAsh(s, stage, wilt, v);
    return fjordConifer(s, kind, stage, wilt, v);
  },
};

const FJFL = {
  fire: ['#7a2a5a', '#b03a7e', '#dc5a9e', '#f08abc', '#ffc4de'],
  lupine: ['#34348a', '#5252c4', '#7c80e4', '#b0b6f8', '#eef0ff'],
  forget: [['#2c5cc0', '#5c98f0', '#a4d0ff', '#ffe060'], ['#2c5cc0', '#5c98f0', '#a4d0ff', '#ffe060'], ['#4a6ad0', '#84a8f4', '#c4dcff', '#fff0a0']],
  poppy: [['#b08a14', '#f2cf3a', '#fff29a', '#d88a1c'], ['#b0a890', '#f4f0e0', '#ffffff', '#f0c83a']],
};

FLOWERS['bg-fjord'] = {
  draw(s, kind, stage, wilt, old, v) {
    if (stage === 0) { sprouts(s, v, FJORD.stem, FJORD.soil, wilt); return; }
    s.shadow(FX, FY + 1, 7, 1.4, 0.18);
    const pale = (c) => (old ? mix(c, '#fff4f0', 0.14 * old) : c);
    const G = FJORD.stem;
    // a point on a stem, k rows down from its top
    const down = (pts, h, k) => pts[Math.max(0, pts.length - 1 - Math.round(k * (pts.length / h)))];
    if (kind === 0) {
      // fireweed: tall red stems, narrow leaves up them, a spire of magenta flowers that opens from
      // the bottom (buds at the tip); past its best the lowest flowers go to white seed fluff
      tuft(s, 4, ['#2a5a44', '#3c7a50', '#5a9a5e', '#88bc74'], { h: stage === 1 ? 5 : 3, seed: v });
      if (stage === 1) { [[-3, -6], [2, -7], [5, -5]].forEach(([dx, dy]) => dab(s, FX + dx - 1, FY + dy, ['a..', '.bb'], { a: '#88bc74', b: '#5a9a5e' }, tg('leaf', '#3c7a50'))); return; }
      const F = FJFL.fire.map(pale);
      const ST = ['#7a4650', '#9a5a5c'];
      CLUMPS[v].forEach(([dx, hf, lean], i) => {
        const h = Math.round(18 * hf - wilt);
        const tx = FX + dx + (wilt >= 2 ? (lean || 1) * (wilt - 1) : 0);
        const pts = stem(s, FX + dx, FY, tx, FY - h + 1, lean * 0.4, ST);
        const spike = stage === 2 ? 4 : Math.min(9, Math.round(h * 0.55));
        // the leaves, alternating up the stem under the flowers
        for (let k = spike + 1; k < h - 1; k += 2) { const [x, y] = down(pts, h, k); const d = (k >> 1) % 2 ? 1 : -1; s.set(x + d, y, G[2], tg('leaf', G[1])); s.set(x + d * 2, y - 1 + (wilt ? 1 : 0), G[3], tg('leaf', G[1])); }
        for (let k = 0; k < spike; k += 1) {
          const [x, y] = down(pts, h, k);
          if (stage === 2) { s.set(x, y, k < 2 ? '#8a5a6a' : F[1], tg('fl', F[1])); continue; }
          if (k < 2) { s.set(x, y, k ? F[1] : '#8a4a66', tg('fl', F[1])); continue; } // buds at the tip
          const seed = old && k >= spike - old * 2;
          if (seed) { s.set(x, y, ST[1], tg('stem', ST[0])); s.set(x - 1, y, '#f6f0f4', tg('fl', '#d8ccd8')); if (k % 2) s.set(x + 1, y - 1, '#ffffff', tg('fl', '#d8ccd8')); continue; }
          s.set(x, y, k % 3 === 1 ? F[1] : F[2], tg('fl', F[2]));
          if (!(wilt >= 2 && k % 2)) { s.set(x - 1, y, k % 3 === 2 ? F[4] : F[3], tg('fl', F[2])); s.set(x + 1, y, k % 3 === 1 ? F[0] : F[1], tg('fl', F[2])); }
          if (k > 3 && k % 3 === i % 3 && wilt < 2) s.set(x + (k % 2 ? 2 : -2), y, F[4], tg('fl', F[2]));
        }
      });
      return;
    }
    if (kind === 1) {
      // Nootka lupine: hands of leaves, fat spikes of blue-violet pea flowers tipped with white
      tuft(s, 5, ['#2a5e48', '#3c7c52', '#5aa060', '#8cc47a'], { h: stage === 1 ? 4 : 3, seed: v + 7 });
      [[-5, -5], [4, -6], [0, -4]].slice(0, stage === 1 ? 3 : 2).forEach(([dx, dy]) => dab(s, FX + dx - 1, FY + dy + (wilt ? 1 : 0), ['a.a', '.b.', 'a.a'], { a: '#8cc47a', b: '#5aa060' }, tg('leaf', '#3c7c52')));
      if (stage === 1) return;
      const P = FJFL.lupine.map(pale);
      CLUMPS[v].forEach(([dx, hf, lean], i) => {
        const h = Math.round(13 * hf - wilt);
        const tx = FX + dx + (wilt >= 2 ? (lean || 1) * (wilt - 1) : 0);
        const pts = stem(s, FX + dx, FY, tx, FY - h + 1, 0, G);
        const spike = stage === 2 ? 4 : 7;
        for (let k = 0; k < spike; k += 1) {
          const [x, y] = down(pts, h, k);
          if (stage === 2) { s.set(x, y, k < 2 ? '#7aa860' : P[1], tg('fl', P[1])); continue; }
          const c = k === 0 ? P[3] : k % 3 === 0 ? P[1] : P[2];
          s.set(x, y, c, tg('fl', P[1]));
          if (k > 0 && !(wilt >= 2 && k % 2)) {
            s.set(x - 1, y, k % 3 === 1 ? P[4] : P[3], tg('fl', P[1])); // the white banner of each flower
            s.set(x + 1, y, k % 3 === 0 ? P[0] : P[1], tg('fl', P[1]));
            if (k > 2 && k < spike - 1 && (k + i) % 2) s.set(x - 2, y, P[2], tg('fl', P[1]));
          }
        }
      });
      return;
    }
    if (kind === 2) {
      // forget-me-nots: a low cushion of leaves starred with small sky-blue flowers, gold-eyed (the buds are pink)
      const LG = ['#2a6044', '#3c8050', '#58a05c', '#86c070'];
      const rx = stage === 1 ? 5.5 : 7.5; const ry = stage === 1 ? 2.6 : 3.8 - wilt * 0.3;
      for (let y = FY - 8; y <= FY; y += 1) for (let x = FX - 9; x <= FX + 9; x += 1) {
        const dx = (x + 0.5 - FX) / rx; const dy = (y + 0.5 - (FY - ry + 1)) / ry;
        if (dx * dx + dy * dy > 1 + (h2(x, y, v + 3) - 0.5) * 0.5) continue;
        const l = -(dx * 0.6 + dy * 0.8) + (bayer(x, y) - 0.5) * 0.4;
        s.set(x, y, LG[l > 0.45 ? 3 : l > 0 ? 2 : l > -0.5 ? 1 : 0], tg('leaf', LG[1]));
      }
      if (stage === 1) return;
      const C = FJFL.forget[v].map(pale);
      const spots = [[-5, -2], [-1, -5], [4, -3], [1, -1], [-3, -7], [3, -7], [7, -1], [-7, 0], [0, -8]].slice(0, 6 + v + (stage === 3 ? 1 : -2));
      spots.forEach(([dx, dy], i) => {
        const x = FX + dx; const y = FY + dy + (wilt >= 2 ? 1 : 0);
        if (stage === 2) { s.set(x, y, i % 2 ? '#f29ac0' : C[1], tg('fl', C[1])); return; }
        if (wilt >= 2 && i % 3 === 0) return;
        dab(s, x - 1, y - 1, i % 3 === 2 ? ['.b.', 'cyb', '.a.'] : ['.c.', 'byb', '.b.'], { a: C[0], b: C[1], c: C[2], y: C[3] }, tg('fl', C[1]));
      });
      if (old === 2) { s.set(FX - 8, FY + 1, C[2], 'ground'); s.set(FX + 7, FY, C[1], 'ground'); }
      return;
    }
    if (v === 2) {
      // cotton grass: a tussock of fine blades, white tufts nodding on thin stalks
      tuft(s, 5, ['#3a6a4a', '#55884e', '#7aa65a', '#a8c672'], { h: stage === 1 ? 6 : 5, seed: 11 });
      if (stage === 1) return;
      [[-5, 0.7, -1], [4, 0.78, 1], [-1, 1, 0], [2, 0.6, 1], [-3, 0.55, -1]].forEach(([dx, hf, lean], i) => {
        const h = Math.round(13 * hf - wilt);
        const tx = FX + dx + lean * (1 + wilt); const ty = FY - h + wilt;
        stem(s, FX + dx, FY, tx, ty, lean * 0.5, ['#6a8a52', '#8aa862']);
        if (stage === 2) { dab(s, tx, ty - 1, ['a', 'b'], { a: '#c8b48a', b: '#8a7a5a' }, tg('fl', '#a8946a')); return; }
        if (wilt >= 2 && i % 2) { s.set(tx, ty, '#e8e4ec', tg('fl', '#c8c4d0')); return; }
        dab(s, tx - 1, ty - 2, ['.w.', 'wWw', 'aww'], { w: pale('#f0eef4'), W: '#ffffff', a: '#d0cedc' }, tg('fl', '#c8c4d0'));
      });
      return;
    }
    // arctic poppies: a rosette of feathery grey-green leaves, hairy stalks, pale yellow (or white) cups
    tuft(s, 5, ['#34624a', '#4a8256', '#6ca266', '#9cc084'], { h: stage === 1 ? 4 : 3, seed: v + 9 });
    if (stage === 1) return;
    const P = FJFL.poppy[v].map(pale);
    clump(s, v, stage, wilt, old, 11, ['#5a8a52', '#7aa862'], (x, y, i, lean) => {
      if (stage === 2) { dab(s, x + (lean > 0 ? 1 : -1), y, ['b', 'a'], { a: '#5a8a52', b: '#4a5a3a' }, tg('fl', '#4a6a42')); return; } // the bud nods
      if (wilt >= 2) { dab(s, x - 1, y, ['bc.', '.ab'], { a: P[0], b: P[1], c: P[2] }, tg('fl', P[1])); return; }
      dab(s, x - 1, y - 2, ['.cc.', 'cbyb', '.ab.'], { a: P[0], b: P[1], c: P[2], y: P[3] }, tg('fl', P[1]));
    });
    if (old === 2) { s.set(FX - 6, FY + 1, FJFL.poppy[v][2], 'ground'); s.set(FX + 5, FY, FJFL.poppy[v][1], 'ground'); }
  },
};

const PTARMIGAN = [
  ['.......rh..', '......hhKo.', '..bbbbhhh..', '.bbmbbbbh..', 'tbbbmbbww..', '.bbbbwwww..', '..wwwwww...', '...f..f....'],
  ['.......rh..', '......hhKo.', '..bbbbhhh..', '.bbmbbbbh..', 'tbbbmbbww..', '.bbbbwwww..', '..wwwwww...', '..f....f...'],
];
const MARMOT = [
  ['............', '............', '............', '........ee..', '..gggggghhh.', '.gggggghhKhn', 'tgggggggwhh.', 'tggggggwww..', '.dd...dd....'],
  ['.....ee.....', '....hhhh....', '....hKhhn...', '....hhhh....', '...gwwwg....', '...gwwwgd...', '...gwwwg....', '..tggwwg....', '.ttdd.dd....'],
];
const EAGLE = [
  ['...BB................', '...BBBB..............', '....BBBBB............', '.....bBBBBBb...WW....', 'TT..bbbbbbbbbbWWKy...', 'TTTbbbbbbbbbbbWWWyy..', '.TT..bbbbbbbbbb......', '.........yy..........'],
  ['.....................', '.....................', '...............WW....', 'TT..bbbbbbbbbbWWKy...', 'TTTbbbbBBBBbbbWWWyy..', '.TT..BBBBBBBbbb......', '....BBBBBB...yy......', '...BBBB..............'],
];

CRITTERS['bg-fjord'] = [
  { id: 'bluebutterfly', frames: 2, size: [7, 6], moves: 'fly', level: 1, variants: 2 },
  { id: 'ptarmigan', frames: 2, size: [11, 8], moves: 'walk', level: 2, variants: 2 },
  { id: 'hare', frames: 2, size: [11, 10], moves: 'walk', level: 2, variants: 2 },
  { id: 'marmot', frames: 2, size: [12, 9], moves: 'sit', level: 3 },
  { id: 'eagle', frames: 2, size: [21, 8], moves: 'fly', level: 4 },
];
CRITTERS_ART['bg-fjord'] = {
  bluebutterfly: (f, v) => {
    const C = [['#5a9af0', '#b8dcff', '#3a6ac8'], ['#fff0a0', '#ffffff', '#e8c040']][v];
    return critterOf('bg-fjord', BUTTERFLY[f], { A: [C[0], 'fur'], a: [C[1], 'fur'], c: [C[2], 'fur'], B: ['#2e2238', 'fur'] });
  },
  // brown and barred in summer, or white as the snow
  ptarmigan: (f, v) => critterOf('bg-fjord', PTARMIGAN[f], v
    ? { h: '#ffffff', b: '#f4f2f6', m: '#e0dce8', w: '#ffffff', t: '#3a2e36', o: '#3a2e36', f: '#e0dce8', r: ['#e03a3a', 'fur'] }
    : { h: '#9a6a42', b: '#8a5e3c', m: '#5a3c2c', w: '#f4eee4', t: '#3a2e36', o: '#3a2e36', f: '#e8e0d4', r: ['#e03a3a', 'fur'] }, { feet: true, shadow: [4, 1.2] }),
  // a snowshoe hare: big white feet and black-tipped ears, brown in summer or white in winter
  hare: (f, v) => {
    const C = v ? { f: '#f0eef4', h: '#ffffff', d: '#dcd8e4' } : { f: '#9a7652', h: '#aa8660', d: '#f2eee8' };
    return critterOf('bg-fjord', RABBIT[f], { f: C.f, h: C.h, d: C.d, i: '#3a2e36', e: C.h, n: '#f48aa0', w: '#ffffff' }, { feet: true, shadow: [4, 1.2] });
  },
  marmot: (f) => critterOf('bg-fjord', MARMOT[f], { g: '#a8a4a0', h: '#6a5a52', w: '#e4dcd0', t: '#7a5a42', d: '#3a2e36', e: '#5a4a44', n: '#3a2e36' }, { feet: true, shadow: [5, 1.3] }),
  eagle: (f) => critterOf('bg-fjord', EAGLE[f], { b: ['#4a3428', 'fur'], B: ['#35241e', 'fur'], W: ['#ffffff', 'fur'], T: ['#f4f2f0', 'fur'], y: ['#f2c22e', 'fur'] }),
};

// ---------- the API ----------

const cache = new Map();
const cached = (key, make) => { let c = cache.get(key); if (!c) { c = make(); cache.set(key, c); } return c; };

/** A tree for a spot, grown to a stage (0 sapling .. 5 grand), wilted 0..3. Anchored at its foot. */
export function treeArt(mapId, spot, stage, wilt = 0) {
  const map = mapOf(mapId);
  const T = TREES[map] || TREES['bg-meadow'];
  const kind = T.kinds[((spot % T.kinds.length) + T.kinds.length) % T.kinds.length];
  const v = T.vary ? T.vary(spot) : Math.floor(h2(spot, 7, 101) * 4);
  const st = clamp(Math.round(stage), 0, 5); const w = clamp(Math.round(wilt), 0, 3);
  return cached(`t|${map}|${kind}|${v}|${st}|${w}`, () => {
    const s = new Sprite(map, 80, 84, 40, 80, 4);
    T.draw(s, kind, st, w, v);
    wither(s, w, v);
    if (w >= 2 && st > 0) fallenLeaves(s, 40, 80, st, w);
    return s.finish();
  });
}

/** A few tired leaves on the ground round a wilting tree's foot. */
function fallenLeaves(s, fx, fy, stage, wilt) {
  const T = TIRED[s.map];
  const n = wilt === 3 ? 7 : 4;
  for (let k = 0; k < n; k += 1) {
    const a = h2(k, stage, 61) * 6.28; const d = 3 + h2(stage, k, 62) * (4 + stage * 2.5);
    const x = Math.round(fx + Math.cos(a) * d); const y = Math.round(fy + 1 + Math.sin(a) * d * 0.28);
    if (!s.get(x, y)) s.set(x, y, T.brown[1 + (k % 3)], 'ground');
  }
}

/** A clump of flowers of a kind (0..3) at a stage (0 sprout, 1 leaves, 2 bud, 3 bloom). Anchored at its foot. */
export function flowerArt(mapId, kind, stage, wilt = 0, age = 0, v = 0) {
  const map = mapOf(mapId);
  const F = FLOWERS[map] || FLOWERS['bg-meadow'];
  const k = clamp(Math.round(kind), 0, 3); const st = clamp(Math.round(stage), 0, 3); const w = clamp(Math.round(wilt), 0, 3);
  const old = st === 3 ? (age >= 6 ? 2 : age >= 5 ? 1 : 0) : 0;
  const vv = ((Math.round(v) % 3) + 3) % 3;
  return cached(`f|${map}|${k}|${st}|${w}|${old}|${vv}`, () => {
    const s = new Sprite(map, 32, 30, 16, 26, 3);
    F.draw(s, k, st, w, old, vv);
    wither(s, w, k * 3 + vv);
    return s.finish();
  });
}

/** A critter (see CRITTERS for each map's), one frame of its animation, facing right. */
export function critterArt(mapId, which, frame = 0, v = 0) {
  const map = mapOf(mapId);
  const list = CRITTERS[map] || [];
  const c = typeof which === 'number' ? list[which] : list.find((q) => q.id === which);
  if (!c) return null;
  const f = ((Math.round(frame) % c.frames) + c.frames) % c.frames;
  const vv = ((Math.round(v) % (c.variants || 1)) + (c.variants || 1)) % (c.variants || 1);
  return cached(`c|${map}|${c.id}|${f}|${vv}`, () => CRITTERS_ART[map][c.id](f, vv));
}
