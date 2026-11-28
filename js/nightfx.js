// Night in the village, on every map: after sunset in Denver the land turns a deep storybook blue,
// windows glow warm, lamps and fires (and the December lights, xmaslights.js) throw dithered pools
// of light, stars twinkle in the water and the snow glints. Pure pixel work at one canvas pixel per
// village pixel: the land is recoloured once per paint (never per frame), the twinkles are three
// small frames shown in turn.
//
//   isNightAt(date)            true between sunset and sunrise in Denver (a month's table, good to ~15 min)
//   shownNight(date)           the same, unless a parent tried day or night on this device (kidquest.night)
//   nightProbe(paint)          runs a village painter and notes where its windows, lamps, roofs and doors went
//   nightLand(land, L, probe, lights)   the painted (season-tinted) land at night
//   nightColor(hex, mapId)     one color at night (sprites drawn for the night use it)
//   nightFrames(L, land, probe, o)      three W x H canvases of twinkles (stars in water, snow glints, aurora)
//   nightFilter(mapId)         an SVG filter that does nightColor to whole sprites (villagers, the buddy)
//
// The night colors are a matrix per map (blue for the forest, teal under the sea, violet on the moon,
// plum on the volcano), the same in nightLand, nightColor and the SVG filter, so a villager and the
// ground under it agree.

import { hexRgb, rgbHex, bayer, h2, Buf, lostCanvas } from './pixelkit.js';
import { waterDepth } from './villageprops.js';

// ---------- when ----------

// Denver sunrise and sunset by month (local clock time, hours), mid-month
const SUNRISE = [7.3, 6.9, 7.15, 6.45, 5.85, 5.55, 5.75, 6.25, 6.75, 7.25, 6.85, 7.2];
const SUNSET = [16.95, 17.55, 19.05, 19.55, 20.1, 20.5, 20.45, 19.95, 19.15, 18.35, 16.75, 16.65];

/** Is it dark in Denver at this moment? (December: after about 4:40 PM, until about 7:15 AM.) */
export function isNightAt(date = new Date()) {
  let parts;
  try {
    parts = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', month: 'numeric', hour: 'numeric', minute: 'numeric', hourCycle: 'h23' }).formatToParts(date).map((p) => [p.type, p.value]));
  } catch { parts = { month: date.getMonth() + 1, hour: date.getHours(), minute: date.getMinutes() }; }
  const m = Number(parts.month) - 1; const t = Number(parts.hour) + Number(parts.minute) / 60;
  return t < SUNRISE[m] || t >= SUNSET[m];
}

/**
 * Is a photo train ride now a night ride? After dark in Denver, or after 7 PM (so night animals
 * can be found in summer too, when it gets dark long after the kids' games), until sunrise.
 * A parent's night/day try-out on this device counts too.
 */
export function rideIsNight(date = new Date(), storage = globalThis.localStorage) {
  let o = null;
  try { o = storage?.getItem(KEY); } catch { /* no storage */ }
  if (o === 'day') return false;
  if (shownNight(date, storage)) return true;
  try {
    const h = Number(new Intl.DateTimeFormat('en-US', { timeZone: 'America/Denver', hour: 'numeric', hourCycle: 'h23' }).format(date));
    return h >= 19;
  } catch { return date.getHours() >= 19; }
}

const KEY = 'kidquest.night';
/** Night to show: a parent's try-out on this device ('night' or 'day') if set, else the real sky. */
export function shownNight(date = new Date(), storage = globalThis.localStorage) {
  let o = null;
  try { o = storage?.getItem(KEY); } catch { /* no storage */ }
  if (o === 'night') return true;
  if (o === 'day') return false;
  return isNightAt(date);
}
/** Try night or day on this device (null goes back to the real sky). */
export function tryNight(v, storage = globalThis.localStorage) {
  try { if (v === 'night' || v === 'day') storage?.setItem(KEY, v); else storage?.removeItem(KEY); } catch { /* fine */ }
}

// ---------- colors ----------

// rows: out = a*R + b*G + c*B + lift (0..255); blue-violet shadows, highlights leaning periwinkle,
// outlines going navy (never black). light: the tint a warm lamp gives the day color.
const BASE = { m: [[0.30, 0.08, 0.06, 14], [0.06, 0.34, 0.10, 18], [0.08, 0.14, 0.48, 52]], light: [1, 0.86, 0.62] };
const NIGHT = {
  'bg-meadow': BASE,
  // the castle's courtyard is mostly snow and pale stone: a deeper matrix, or its night reads as dusk
  'bg-castle': { m: [[0.22, 0.06, 0.05, 8], [0.05, 0.25, 0.08, 12], [0.07, 0.12, 0.38, 42]], light: [1, 0.86, 0.62] },
  'bg-sunset': { m: [[0.32, 0.08, 0.06, 20], [0.06, 0.31, 0.10, 17], [0.09, 0.14, 0.46, 58]], light: [1, 0.84, 0.6] },
  'bg-ocean': { m: [[0.20, 0.05, 0.06, 6], [0.04, 0.33, 0.14, 24], [0.06, 0.16, 0.52, 52]], light: [0.7, 1, 0.95], cool: true },
  'bg-space': { m: [[0.30, 0.06, 0.10, 20], [0.05, 0.27, 0.12, 14], [0.10, 0.12, 0.52, 58]], light: [0.82, 0.92, 1] },
  'bg-volcano': { m: [[0.34, 0.06, 0.06, 24], [0.05, 0.27, 0.08, 12], [0.08, 0.12, 0.40, 44]], light: [1, 0.72, 0.46] },
  'bg-rainforest': { m: [[0.24, 0.08, 0.06, 10], [0.06, 0.36, 0.10, 20], [0.08, 0.16, 0.44, 48]], light: [1, 0.9, 0.6] },
  'bg-fjord': { m: [[0.26, 0.08, 0.06, 12], [0.06, 0.34, 0.12, 20], [0.08, 0.16, 0.50, 58]], light: [1, 0.86, 0.62] },
  'bg-rainbow': { m: [[0.18, 0.05, 0.05, 10], [0.04, 0.16, 0.06, 8], [0.07, 0.09, 0.30, 34]], light: [1, 0.84, 0.7] },
  'bg-galaxy': { m: [[0.50, 0.06, 0.06, 10], [0.05, 0.50, 0.08, 8], [0.06, 0.10, 0.68, 28]], light: [1, 0.9, 0.62] },
};
export const nightSpec = (mapId) => NIGHT[mapId] || BASE;

const nightRgb = (r, g, b, M) => [
  M[0][0] * r + M[0][1] * g + M[0][2] * b + M[0][3],
  M[1][0] * r + M[1][1] * g + M[1][2] * b + M[1][3],
  M[2][0] * r + M[2][1] * g + M[2][2] * b + M[2][3],
];
const colorCache = new Map();
/** A color as it looks at night on this map (a solid palette color, for sprites drawn for the night). */
export function nightColor(c, mapId) {
  const k = `${mapId}|${c}`;
  if (!colorCache.has(k)) { const [r, g, b] = hexRgb(c); colorCache.set(k, rgbHex(...nightRgb(r, g, b, nightSpec(mapId).m))); }
  return colorCache.get(k);
}

/** An SVG filter doing nightColor to whatever it is put on (crisp: it works pixel by pixel). */
export function nightFilter(mapId, id = `kq-night-${mapId}`) {
  const M = nightSpec(mapId).m;
  const row = (r) => `${r[0]} ${r[1]} ${r[2]} 0 ${(r[3] / 255).toFixed(3)}`;
  return `<svg class="kq-night-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="${id}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${row(M[0])} ${row(M[1])} ${row(M[2])} 0 0 0 1 0"/></filter></svg>`;
}

/**
 * The characters' filters (the buddy, villagers, visitors): they stay readable at night, a soft
 * moonlit blue (about 80% bright) away from the lights, and warm, almost day-bright, in a pool of
 * light. Two filters: #kq-folk-<map> and #kq-folk-lit-<map>.
 */
const FOLK_MOON = [[0.72, 0.04, 0.04, 4], [0.03, 0.76, 0.07, 8], [0.03, 0.07, 0.86, 30]];
/** The characters' night matrix on a map: moonlit, or warm (lit) in a pool of light. */
export function folkMatrix(mapId, lit = false) {
  if (!lit) return FOLK_MOON;
  const t = nightSpec(mapId).light;
  return [[0.94 * t[0], 0.04, 0.02, 10], [0.02, 0.92 * t[1], 0.03, 6], [0.02, 0.04, 0.86 * t[2] + 0.06, 8]];
}

export function folkFilters(mapId) {
  const row = (r) => `${r[0]} ${r[1]} ${r[2]} 0 ${(r[3] / 255).toFixed(3)}`;
  const mat = (M) => `${row(M[0])} ${row(M[1])} ${row(M[2])} 0 0 0 1 0`;
  const moon = folkMatrix(mapId, false);
  const lit = folkMatrix(mapId, true);
  return `<svg class="kq-night-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><filter id="kq-folk-${mapId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${mat(moon)}"/></filter><filter id="kq-folk-lit-${mapId}" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="${mat(lit)}"/></filter></svg>`;
}

/** How lit a spot is by these lights (0 dark .. about 1 in the middle of a pool). */
export function lightAt(lights, x, y) {
  let f = 0;
  for (const l of lights) {
    const ry = l.ry || l.r * 0.7;
    const q = ((x - l.x) / l.r) ** 2 + ((y - l.y) / ry) ** 2;
    if (q < 1) f += l.i * (1 - q) * (1 - q * 0.35);
  }
  return f;
}

// the warm glow ramp a lit window is painted in (the meadow's own, PB.glow)
const GLOW = ['#6a3040', '#c86a3a', '#f0a848', '#ffd878', '#fff4c8'].map(hexRgb);
// the warm pool a lamp throws on the ground, dark to light (amber to orange to honey)
const POOL = ['#5a3448', '#94503e', '#c8783e', '#e8a050', '#f8c878'].map(hexRgb);

// ---------- what the painter drew where ----------

const KEEP = new Set(['glass', 'glow', 'light', 'lamp', 'fire', 'shine', 'flame', 'door', 'thatch', 'roof', 'cap', 'hull', 'pearl', 'brass']);
/**
 * Runs paint() (a village painter) and notes every sprite cell it put down with one of the
 * tags above (the house painters tag their windows 'glass' or 'glow', roofs 'thatch', 'roof',
 * 'cap'...). Returns { result, cells: Map(tag -> { x: [], y: [], c: [] }) }.
 */
export function nightProbe(paint) {
  const cells = new Map();
  const orig = Buf.prototype.blit;
  Buf.prototype.blit = function blitNoted(px, X, Y) {
    this.each((x, y) => {
      const c = this.get(x, y);
      if (!c || c[0] !== '#') return;
      const t = String(this.tag(x, y) ?? '');
      if (t.endsWith(':edge')) return;
      const k = t.split(':')[0];
      if (!KEEP.has(k)) return;
      if (!cells.has(k)) cells.set(k, { x: [], y: [], c: [] });
      const e = cells.get(k); e.x.push(X + x); e.y.push(Y + y); e.c.push(c);
    });
    return orig.call(this, px, X, Y);
  };
  let result;
  try { result = paint(); } finally { Buf.prototype.blit = orig; }
  return { result, cells };
}

/** The probe's cells of some tags inside a box [x, y, w, h], still showing on the finished land. */
export function probeCells(probe, tags, box, land = null) {
  const out = [];
  const [bx, by, bw, bh] = box;
  const data = land && (probe.data || (probe.data = land.getContext('2d').getImageData(0, 0, land.width, land.height).data));
  for (const t of tags) {
    const e = probe.cells.get(t);
    if (!e) continue;
    for (let i = 0; i < e.x.length; i += 1) {
      const x = e.x[i]; const y = e.y[i];
      if (x < bx || y < by || x >= bx + bw || y >= by + bh) continue;
      if (data) { const j = (y * land.width + x) * 4; const [r, g, b] = hexRgb(e.c[i]); if (Math.abs(data[j] - r) + Math.abs(data[j + 1] - g) + Math.abs(data[j + 2] - b) > 6) continue; }
      out.push([x, y, e.c[i]]);
    }
  }
  return out;
}

// which tags are a house's windows on each map, and which maps' houses are glass domes lit from inside
const WINDOW_TAGS = { 'bg-meadow': ['glass'], 'bg-sunset': ['glass'], 'bg-fjord': ['glass'], 'bg-castle': ['glow'], 'bg-volcano': ['glow'], 'bg-rainforest': ['glow'], 'bg-rainbow': ['glow'], 'bg-galaxy': ['glow'], 'bg-ocean': ['brass'], 'bg-space': ['light'] };
const DOMES = { 'bg-ocean': ['glass'], 'bg-space': ['glass'] };
const LAMP_TAGS = ['glass', 'glow', 'light', 'lamp', 'fire', 'shine', 'flame'];
const houseBox = (h) => [h.x - 8, h.y - 30, h.w + 16, h.h + 32];
const inBox = (x, y, [bx, by, bw, bh]) => x >= bx && y >= by && x < bx + bw && y < by + bh;

/**
 * Where light comes from at night on this map: each house's lit windows (a pool on its front and on
 * the ground before its door), the lamps, fires and glowing things the painter drew, and the lava.
 * Returns [{ x, y, r, ry, i, tint: [r, g, b] }].
 */
export function landLights(L, probe, land) {
  const spec = nightSpec(L.id);
  const out = [];
  const houses = [L.home, ...L.houses];
  for (const h of houses) {
    const win = probeCells(probe, WINDOW_TAGS[L.id] || ['glass'], houseBox(h), land);
    // the windows, a cell at a time in 8 x 8 bins: a small pool round each
    const bins = new Map();
    for (const [x, y] of win) { const k = `${x >> 3},${y >> 3}`; const b = bins.get(k) || { n: 0, x: 0, y: 0 }; b.n += 1; b.x += x; b.y += y; bins.set(k, b); }
    for (const b of bins.values()) if (b.n >= 4) out.push({ x: b.x / b.n, y: b.y / b.n + 3, r: 11, ry: 9, i: 0.55, tint: spec.light });
    // the doorstep, lit from inside (domes glow all over)
    const dome = DOMES[L.id];
    out.push({ x: h.x + h.w / 2, y: h.y + h.h + 3, r: h.w * (dome ? 0.62 : 0.5), ry: 10, i: dome ? 0.85 : 0.7, tint: spec.light });
  }
  // lamps, fires, glowing things away from the houses
  const bins = new Map();
  for (const t of LAMP_TAGS) {
    const e = probe.cells.get(t);
    if (!e) continue;
    for (let i = 0; i < e.x.length; i += 1) {
      const x = e.x[i]; const y = e.y[i];
      if (houses.some((h) => inBox(x, y, houseBox(h)))) continue;
      const k = `${Math.floor(x / 14)},${Math.floor(y / 14)}`; const b = bins.get(k) || { n: 0, x: 0, y: 0, c: [0, 0, 0] };
      const rgb = hexRgb(e.c[i]); b.n += 1; b.x += x; b.y += y; b.c = b.c.map((v, j) => v + rgb[j]); bins.set(k, b);
    }
  }
  for (const b of bins.values()) {
    if (b.n < 3) continue;
    const c = b.c.map((v) => v / b.n / 255); const m = Math.max(...c, 0.01);
    const tint = c.map((v) => Math.min(1, 0.55 + (0.45 * v) / m));
    out.push({ x: b.x / b.n, y: b.y / b.n + 6, r: Math.min(22, 10 + b.n * 0.6), ry: Math.min(15, 7 + b.n * 0.4), i: Math.min(0.9, 0.45 + b.n * 0.03), tint });
  }
  // a lava river lights its banks orange
  for (const wa of L.water) {
    if (wa.kind !== 'lava') continue;
    for (let i = 1; i < wa.pts.length; i += 1) {
      const [x0, y0] = wa.pts[i - 1]; const [x1, y1] = wa.pts[i]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 14);
      for (let k = 0; k < n; k += 1) out.push({ x: x0 + ((x1 - x0) * k) / n, y: y0 + ((y1 - y0) * k) / n, r: wa.w * 1.25, ry: wa.w * 1.05, i: 0.7, tint: [1, 0.62, 0.36] });
    }
  }
  return out;
}

// ---------- the land at night ----------

const nightCache = new WeakMap();
/**
 * The land at night: every pixel through the map's night matrix, windows repainted in the warm glow
 * ramp, glass domes lit from inside, lava, lamps and flames kept bright, and pools of light (each a
 * few ordered-dither steps, no smooth gradients) round every light in lights.
 * land: the painted (and season-tinted) village; probe: nightProbe() of its paint.
 */
export function nightLand(land, L, probe, lights = [], key = '') {
  const kept = nightCache.get(land);
  if (kept && kept.key === key) return kept.canvas;
  const W = land.width; const H = land.height;
  const spec = nightSpec(L.id); const M = spec.m;
  const src = land.getContext('2d').getImageData(0, 0, W, H);
  const d = src.data;
  const out = new ImageData(W, H); const o = out.data;
  // emissive: 1 a window, 2 kept bright (lamps, flames, lava), 3 a glass dome lit from inside
  const em = new Uint8Array(W * H);
  const dome = new Float32Array(W * H);
  const houses = [L.home, ...L.houses];
  for (const h of houses) {
    for (const [x, y] of probeCells(probe, WINDOW_TAGS[L.id] || ['glass'], houseBox(h), land)) em[y * W + x] = 1;
    if (DOMES[L.id]) {
      const cells = probeCells(probe, DOMES[L.id], houseBox(h), land);
      if (cells.length) {
        let top = Infinity; let bot = -Infinity; cells.forEach(([, y]) => { top = Math.min(top, y); bot = Math.max(bot, y); });
        for (const [x, y] of cells) { em[y * W + x] = 3; dome[y * W + x] = (y - top) / Math.max(1, bot - top); }
      }
    }
  }
  for (const t of LAMP_TAGS) {
    const e = probe.cells.get(t);
    if (!e) continue;
    for (let i = 0; i < e.x.length; i += 1) { const x = e.x[i]; const y = e.y[i]; if (x >= 0 && y >= 0 && x < W && y < H && !em[y * W + x] && !houses.some((h) => inBox(x, y, houseBox(h)))) em[y * W + x] = 2; }
  }
  const lava = L.water.some((wa) => wa.kind === 'lava') || L.id === 'bg-volcano';
  // the light field: how lit each pixel is, and the tint of its light
  const F = new Float32Array(W * H); const TR = new Float32Array(W * H); const TG = new Float32Array(W * H); const TB = new Float32Array(W * H);
  for (const l of lights) {
    const ry = l.ry || l.r * 0.7;
    const x0 = Math.max(0, Math.floor(l.x - l.r)); const x1 = Math.min(W - 1, Math.ceil(l.x + l.r));
    const y0 = Math.max(0, Math.floor(l.y - ry)); const y1 = Math.min(H - 1, Math.ceil(l.y + ry));
    const tint = l.tint || spec.light;
    for (let y = y0; y <= y1; y += 1) {
      for (let x = x0; x <= x1; x += 1) {
        const q = ((x + 0.5 - l.x) / l.r) ** 2 + ((y + 0.5 - l.y) / ry) ** 2;
        if (q >= 1) continue;
        const f = l.i * (1 - q) * (1 - q * 0.35);
        const j = y * W + x;
        F[j] += f; TR[j] += f * tint[0]; TG[j] += f * tint[1]; TB[j] += f * tint[2];
      }
    }
  }
  const STEP = [0, 0.3, 0.56, 0.8];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const j = y * W + x; const i = j * 4;
      const r = d[i]; const g = d[i + 1]; const b = d[i + 2];
      o[i + 3] = d[i + 3];
      const e = em[j];
      const lum = (r * 0.3 + g * 0.55 + b * 0.15) / 255;
      if (e === 1) {
        const k = lum < 0.28 ? 0 : lum < 0.46 ? 1 : lum < 0.62 ? 2 : lum < 0.8 ? 3 : 4;
        const kk = Math.min(4, k + (bayer(x, y) < 0.25 && k < 4 ? 1 : 0));
        [o[i], o[i + 1], o[i + 2]] = GLOW[kk];
        continue;
      }
      if (e === 2 || (lava && r > 190 && g > 60 && b < 90 && r - b > 130)) {
        // kept bright, a touch warmer
        o[i] = Math.min(255, r * 1.02 + 6); o[i + 1] = g; o[i + 2] = b * 0.92;
        continue;
      }
      let [nr, ng, nb] = nightRgb(r, g, b, M);
      // the pool of light: a few dithered steps between night and the warm-lit day color
      const f = Math.min(1.25, F[j]);
      if (e === 3) {
        // a glass dome lit from inside: brighter toward its foot, dithered in bands
        const t = 0.28 + dome[j] * 0.42 + (bayer(x, y) - 0.5) * 0.16;
        const tl = spec.light;
        const lr = r * tl[0]; const lg = g * tl[1]; const lb = b * tl[2];
        const s = t < 0.36 ? 0.3 : t < 0.5 ? 0.46 : t < 0.62 ? 0.6 : 0.72;
        nr += (lr - nr) * s; ng += (lg - ng) * s; nb += (lb - nb) * s;
      } else if (f > 0.02) {
        const q = f * 3;
        let lv = Math.floor(q); if (q - lv > bayer(x, y)) lv += 1;
        lv = Math.min(3, lv);
        if (lv > 0) {
          const s = STEP[lv];
          const tr = TR[j] / F[j]; const tg = TG[j] / F[j]; const tb = TB[j] / F[j];
          let lr = r * tr; let lg = g * tg; let lb = b * tb;
          if (tb < 0.8 && tr > tg) {
            // a warm light: lean the lit ground into the amber-to-orange pool ramp (green grass under
            // a lamp goes honey, not lime), keeping a little of its own texture
            const [pr, pg, pb] = POOL[Math.min(4, Math.floor(lum * 5))];
            lr = lr * 0.35 + pr * 0.65; lg = lg * 0.35 + pg * 0.65; lb = lb * 0.35 + pb * 0.65;
          }
          nr += (lr - nr) * s; ng += (lg - ng) * s; nb += (lb - nb) * s;
        }
      }
      o[i] = nr; o[i + 1] = ng; o[i + 2] = nb;
    }
  }
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d').putImageData(out, 0, 0);
  nightCache.set(land, { key, canvas: c });
  return c;
}

// ---------- twinkles ----------

const FRAMES = 3;
/**
 * Three frames of night sparkle over the land (each W x H, mostly empty): stars and a moon
 * reflected in the water, glints on the snow, and over the fjord the northern lights in the bay.
 * o: { snow: true when the ground is snowy, extra(ctx, frame): more to draw on each frame }.
 */
export function nightFrames(L, land, o = {}) {
  const W = land.width; const H = land.height;
  const d = land.getContext('2d').getImageData(0, 0, W, H).data;
  const frames = [];
  const houses = [L.home, ...L.houses];
  const nearHouse = (x, y) => houses.some((h) => x > h.x - 6 && x < h.x + h.w + 6 && y > h.y - 30 && y < h.y + h.h + 4);
  const wet = (x, y) => !L.onBridge(x, y) && L.water.some((wa) => wa.kind !== 'lava' && wa.kind !== 'rainbow' && waterDepth(wa, x, y) > 2);
  // the moon's reflection: in the widest open water near the middle of the village
  let moon = null;
  for (let tries = 0, best = -1; tries < 400; tries += 1) {
    const x = 60 + (h2(tries, 3, L.seed) * (W - 120)) | 0; const y = 40 + (h2(tries, 7, L.seed) * (H - 80)) | 0;
    if (!wet(x, y)) continue;
    let s = 0; for (let k = -16; k <= 16; k += 4) if (wet(x + k, y) && wet(x + k, y - 4) && wet(x + k, y + 4)) s += 1;
    if (s > best) { best = s; moon = { x, y }; }
  }
  const stars = []; const glints = [];
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const hh = h2(x, y, 911);
      if (hh < 0.0065 && wet(x, y) && wet(x + 2, y) && wet(x - 2, y) && (!moon || Math.abs(x - moon.x) > 12 || Math.abs(y - moon.y) > 6)) stars.push([x, y, h2(x, y, 3)]);
      else if (o.snow && hh > 0.9965 && !nearHouse(x, y)) {
        const i = (y * W + x) * 4;
        if (d[i] > 225 && d[i + 1] > 228 && d[i + 2] > 232) glints.push([x, y, h2(x, y, 5)]);
      }
    }
  }
  // the northern lights mirrored in open water (the fjord): which pixels are deep water
  let aurora = null;
  if (o.aurora) {
    const cells = [];
    const open = (x, y) => { const i = (y * W + x) * 4; return d[i] < 96 && d[i + 1] > d[i] + 20 && d[i + 2] > d[i] + 24; }; // painted as water, not under a mountain or the ice
    // only the open bay: runs of deep, water-colored pixels at least 60 wide (not the strip by the
    // boardwalk, the shore rocks or the cliff's foot), a few pixels in from their ends
    const bridged = (x, y) => (L.crossings || []).some((c) => x > c.x - 6 && x < c.x + c.w + 6 && y > c.y - 6 && y < c.y + c.h + 6);
    for (let y = 0; y < H; y += 1) {
      let x = 0;
      while (x < W) {
        if (!(open(x, y) && wet(x, y) && !bridged(x, y))) { x += 1; continue; }
        let e = x; while (e < W && open(e, y) && wet(e, y) && !bridged(e, y)) e += 1;
        if (e - x >= 60) for (let k = x + 4; k < e - 4; k += 1) if (open(k, y - 3) && open(k, y + 3)) cells.push(k, y);
        x = e;
      }
    }
    if (cells.length) {
      // the ribbons run across the widest stretch of water: the rows at least half as wet as the wettest
      const per = new Array(H).fill(0); for (let k = 1; k < cells.length; k += 2) per[cells[k]] += 1;
      const most = Math.max(...per); let y0 = per.indexOf(most); let y1 = y0;
      while (y0 > 0 && per[y0 - 1] > most / 2) y0 -= 1;
      while (y1 < H - 1 && per[y1 + 1] > most / 2) y1 += 1;
      aurora = { cells, y0, y1 };
    }
  }
  for (let f = 0; f < FRAMES; f += 1) {
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const x = c.getContext('2d');
    const px = (xx, yy, col) => { x.fillStyle = col; x.fillRect(xx, yy, 1, 1); };
    for (const [sx, sy, k] of stars) {
      const ph = (Math.floor(k * 3) + f) % 3;
      if (ph === 0) continue;
      const col = k < 0.5 ? '#fff6d0' : '#d8e6ff';
      px(sx, sy, col);
      // the brightest few are little crosses, flaring in turn
      if (k > 0.82 && ph === 2) { px(sx - 1, sy, '#8ea8e8'); px(sx + 1, sy, '#8ea8e8'); px(sx, sy - 1, '#a8bcf0'); px(sx, sy + 1, '#6a86d0'); }
    }
    if (moon) {
      // a whole pale moon, one brighter ripple row sliding across it, and one ripple below it
      const { x: mx, y: my } = moon;
      const rows = [[-2, 3], [-1, 4], [0, 4], [1, 3], [2, 2]];
      rows.forEach(([dy, hw]) => {
        for (let dx = -hw; dx <= hw; dx += 1) px(mx + dx, my + dy, dy < 0 ? '#fff8dc' : dy === 0 ? '#f0ecd8' : '#dcdcec');
      });
      const ry = my - 1 + (f % 3); const off = f - 1;
      for (let dx = -3; dx <= 3; dx += 2) px(mx + dx + off, ry, '#ffffff');
      for (let dx = -6; dx <= 6; dx += 2) if (wet(mx + dx + off, my + 5)) px(mx + dx + off, my + 5, '#c8d0f0');
    }
    for (const [gx, gy, k] of glints) {
      const ph = (Math.floor(k * 3) + f) % 3;
      if (ph !== 1) continue;
      px(gx, gy, '#ffffff');
      if (k > 0.7) { px(gx - 1, gy, '#c8d8ff'); px(gx + 1, gy, '#c8d8ff'); }
    }
    if (aurora) drawAurora(px, aurora, f, moon);
    o.extra?.(x, f);
    frames.push(c);
  }
  return frames;
}

/**
 * The aurora's reflection: two long wavy ribbons of green light across the water, a violet fringe
 * on their far side, broken by ripples and striped like the curtains they mirror; each frame
 * they ripple and the stripes shift. Dithered (no see-through).
 */
function drawAurora(px, a, f, moon) {
  const span = Math.max(40, a.y1 - a.y0);
  // [where across the water, how far it hangs, phase]: a curtain mirrored hangs down from a bright edge
  const bands = [[0.24, 26, 0], [0.6, 20, 2.1]];
  for (let k = 0; k < a.cells.length; k += 2) {
    const x = a.cells[k]; const y = a.cells[k + 1];
    if (moon && Math.abs(x - moon.x) < 14 && Math.abs(y - moon.y) < 10) continue;
    if ((y + f + Math.floor((x + y * 3) / 9)) % 3 === 0) continue; // ripples, broken into dashes
    let best = 0; let edge = 0;
    for (const [at, hang, ph] of bands) {
      const yc = a.y0 + span * at + Math.sin(x * 0.03 + ph) * 12 + Math.sin(x * 0.011 + ph * 2) * 18 + Math.sin(x * 0.13 + f * 0.8 + ph) * 1.2;
      const d = y - yc;
      if (d < -3 || d > hang) continue;
      // bright along its edge, fading as it hangs; streaked like the curtain's folds, the folds drifting
      const fall = d < 0 ? 1 + d / 3 : Math.pow(1 - d / hang, 1.1);
      const fold = 0.55 + 0.45 * Math.sin(x * 0.27 + Math.sin(x * 0.071 + ph) * 3 + f * 0.7);
      const i = fall * (0.35 + 0.65 * fold) * (0.75 + 0.25 * Math.sin(x * 0.017 + ph * 3));
      if (i > best) { best = i; edge = d; }
    }
    if (best < 0.08) continue;
    if (best * 0.8 < bayer(x, y)) continue;
    const col = edge < 2 && best > 0.5 ? '#c8ffe0' : edge < 6 ? '#6aeeb0' : edge < 14 ? '#3cc49c' : best > 0.25 ? '#4a8ac8' : '#7a62c8';
    px(x, y, col);
  }
}

// ---------- night colors baked into canvases ----------
// A CSS filter: url(#svg-filter) on a <canvas> draws nothing at all on the family's Android tablet
// (2026-11-27: villagers gone but their fishbowls left, the rainforest's vine and the garden's
// trees gone at night). The filter on a plain element (the buddy's box, a fishbowl) is fine, so
// every canvas in the village takes its night colors in its own pixels instead.

/** Copies src into dst (same size) through the color matrix M (nightSpec(map).m or folkMatrix). */
export function nightPixels(src, dst, M) {
  const W = src.width; const H = src.height;
  if (dst.width !== W) dst.width = W;
  if (dst.height !== H) dst.height = H;
  const out = dst.getContext('2d');
  if (!W || !H) return;
  const img = src.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, W, H);
  const d = img.data; const u = new Uint32Array(d.buffer);
  for (let i = 0, j = 0; j < u.length; j += 1, i += 4) {
    if (!u[j]) continue; // see-through: most of a layer
    const n = nightRgb(d[i], d[i + 1], d[i + 2], M);
    d[i] = n[0]; d[i + 1] = n[1]; d[i + 2] = n[2];
  }
  out.putImageData(img, 0, 0);
}

const folkCache = new WeakMap();
/** A character's sprite at night (moonlit, or warm when lit), kept for next time. */
export function folkSprite(canvas, mapId, lit = false) {
  const k = `${mapId}|${lit ? 1 : 0}`;
  let kept = folkCache.get(canvas);
  if (!kept) { kept = new Map(); folkCache.set(canvas, kept); }
  if (!kept.has(k) || lostCanvas(kept.get(k))) {
    const c = document.createElement('canvas'); c.width = canvas.width; c.height = canvas.height;
    c.getContext('2d', { willReadFrequently: true }); // kept in memory, not on the GPU (play.js lostCanvas)
    nightPixels(canvas, c, folkMatrix(mapId, lit));
    c.ax = canvas.ax; c.ay = canvas.ay;
    kept.set(k, c);
  }
  return kept.get(k);
}

const spriteCache = new WeakMap();
/** A whole canvas (a sprite, a layer) through the night colors, kept for next time. Keeps ax, ay. */
export function nightSprite(canvas, mapId) {
  const kept = spriteCache.get(canvas);
  if (kept && kept.mapId === mapId && !lostCanvas(kept.c)) return kept.c;
  const W = canvas.width; const H = canvas.height;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  c.getContext('2d', { willReadFrequently: true }); // kept in memory, not on the GPU (play.js lostCanvas)
  if (W && H) {
    const img = canvas.getContext('2d').getImageData(0, 0, W, H); const d = img.data; const M = nightSpec(mapId).m;
    for (let i = 0; i < d.length; i += 4) { if (!d[i + 3]) continue; const n = nightRgb(d[i], d[i + 1], d[i + 2], M); d[i] = n[0]; d[i + 1] = n[1]; d[i + 2] = n[2]; }
    c.getContext('2d').putImageData(img, 0, 0);
  }
  c.ax = canvas.ax; c.ay = canvas.ay;
  spriteCache.set(canvas, { mapId, c });
  return c;
}
