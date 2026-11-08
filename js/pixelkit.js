// Small helpers for hand-drawn pixel art on whole village pixels: hue-shifted color ramps,
// fixed-seed randomness and noise, ordered dithering, a sprite buffer that works out
// outlines from a finished silhouette, and a painter that writes straight into ImageData
// (one putImageData for a whole village, instead of a fillRect per pixel).

// ---------- color ----------

export const hexRgb = (h) => { const n = parseInt(h.slice(1, 7), 16); return [n >> 16, (n >> 8) & 255, n & 255]; };
export const rgbHex = (r, g, b) => `#${[r, g, b].map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('')}`;
/** A solid color part way from a to b (an in-between palette color, not transparency). */
export const mix = (a, b, t) => { const A = hexRgb(a); const B = hexRgb(b); return rgbHex(...A.map((v, i) => v + (B[i] - v) * t)); };

function toHsl(hex) {
  const [r, g, b] = hexRgb(hex).map((v) => v / 255);
  const mx = Math.max(r, g, b); const mn = Math.min(r, g, b); const l = (mx + mn) / 2;
  let h = 0; let s = 0;
  if (mx !== mn) {
    const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
    h = (mx === r ? (g - b) / d + (g < b ? 6 : 0) : mx === g ? (b - r) / d + 2 : (r - g) / d + 4) * 60;
  }
  return [h, s, l];
}
function fromHsl(h, s, l) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s; const x = c * (1 - Math.abs(((h / 60) % 2) - 1)); const m = l - c / 2;
  const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  return rgbHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}
const toward = (h, target, amt) => { const d = ((target - h + 540) % 360) - 180; return h + Math.sign(d) * Math.min(Math.abs(d), amt); };

/**
 * A hue-shifted ramp round a base color: shadows lean to blue-purple and lights to warm
 * yellow, instead of plain darker and lighter of one hue. Returns dark..light with the base
 * at index `dark`, so any color (a kid's own color too) gets a hand-picked-looking ramp.
 */
export function ramp(base, dark = 3, light = 2) {
  const [h, s, l] = toHsl(base);
  const out = [];
  for (let k = -dark; k <= light; k += 1) {
    if (k === 0) { out.push(base); continue; }
    const a = Math.abs(k);
    let hh = toward(h, k < 0 ? 262 : 52, a * 11);
    let ss = k < 0 ? Math.min(1, s * (1 + 0.04 * a)) : s * (1 - 0.12 * a);
    if (s < 0.1) { hh = k < 0 ? 250 : 45; ss = k < 0 ? 0.1 + 0.04 * a : 0.18 + 0.06 * a; }
    const ll = k < 0 ? l - a * 0.1 : l + a * 0.085;
    out.push(fromHsl(hh, ss, Math.max(0.07, Math.min(0.95, ll))));
  }
  return out;
}

// ---------- randomness (fixed seeds: every drawing comes out the same each time) ----------

export function rng(seed) {
  let a = (seed * 2654435761) >>> 0;
  return () => { a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** A hash of a cell: 0..1. */
export function h2(x, y, s = 0) {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
/** Smooth value noise: 0..1, with features about `scale` pixels across. */
export function vnoise(x, y, scale, s = 0) {
  const fx = x / scale; const fy = y / scale; const ix = Math.floor(fx); const iy = Math.floor(fy);
  const tx = fx - ix; const ty = fy - iy; const sx = tx * tx * (3 - 2 * tx); const sy = ty * ty * (3 - 2 * ty);
  const a = h2(ix, iy, s); const b = h2(ix + 1, iy, s); const c = h2(ix, iy + 1, s); const d = h2(ix + 1, iy + 1, s);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** The ordered-dither threshold for a pixel: 0..1 in a 4 x 4 pattern. */
export const bayer = (x, y) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;

// ---------- a sprite buffer ----------

/**
 * A little grid of colors and material tags to draw a sprite into before it goes on the
 * village, so its outline can be worked out from the finished silhouette. Coordinates are
 * local (0, 0 is the sprite's corner), with pad cells of room on every side.
 */
export class Buf {
  constructor(w, h, pad = 4) { this.pad = pad; this.W = w + pad * 2; this.H = h + pad * 2; this.c = new Array(this.W * this.H).fill(null); this.t = new Array(this.W * this.H).fill(null); }
  i(x, y) { x = Math.round(x) + this.pad; y = Math.round(y) + this.pad; return x < 0 || y < 0 || x >= this.W || y >= this.H ? -1 : y * this.W + x; }
  get(x, y) { const i = this.i(x, y); return i < 0 ? null : this.c[i]; }
  tag(x, y) { const i = this.i(x, y); return i < 0 ? null : this.t[i]; }
  set(x, y, c, t) { const i = this.i(x, y); if (i < 0 || !c) return; this.c[i] = c; if (t !== undefined) this.t[i] = t; }
  del(x, y) { const i = this.i(x, y); if (i >= 0) { this.c[i] = null; this.t[i] = null; } }
  rect(x, y, w, h, c, t) { for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) this.set(x + xx, y + yy, c, t); }
  /** Paint a shape: fn(x, y) gives a color or null for each cell of the box. */
  fill(x0, y0, w, h, fn, t) { for (let y = y0; y < y0 + h; y += 1) for (let x = x0; x < x0 + w; x += 1) { const c = fn(x, y); if (c) this.set(x, y, c, t); } }
  each(fn) { for (let y = -this.pad; y < this.H - this.pad; y += 1) for (let x = -this.pad; x < this.W - this.pad; x += 1) fn(x, y); }
  /** Recolor filled cells: fn(color, tag, x, y) returns the new color. */
  map(fn) { this.each((x, y) => { const c = this.get(x, y); if (c) { const n = fn(c, this.tag(x, y), x, y); if (n !== c) this.set(x, y, n); } }); }
  /**
   * Outline the silhouette: each empty cell beside a filled one (not diagonally) gets
   * fn(tag, side), where side is the side of the shape it is on: 'top' and 'left' face the
   * light, 'bottom' and 'right' are in shadow. Return null to leave the cell empty.
   */
  outline(fn) {
    const marks = [];
    this.each((x, y) => {
      if (this.get(x, y)) return;
      let side; let tag;
      if (this.get(x, y - 1)) { side = 'bottom'; tag = this.tag(x, y - 1); } else if (this.get(x - 1, y)) { side = 'right'; tag = this.tag(x - 1, y); } else if (this.get(x, y + 1)) { side = 'top'; tag = this.tag(x, y + 1); } else if (this.get(x + 1, y)) { side = 'left'; tag = this.tag(x + 1, y); } else return;
      const c = fn(tag, side);
      if (c) marks.push([x, y, c, tag]);
    });
    marks.forEach(([x, y, c, tag]) => this.set(x, y, c, `${tag || ''}:edge`));
  }
  /**
   * Hand anti-aliasing on curves: a filled cell tucked into a stair step of the outline (edge
   * cells on two sides that meet at its corner) takes an in-between color, so round shapes
   * read smooth with no blur. Only cells with one of `tags`.
   */
  soften(fn, tags) {
    const edge = (x, y) => !this.get(x, y) || String(this.tag(x, y)).endsWith(':edge');
    const marks = [];
    this.each((x, y) => {
      const c = this.get(x, y);
      if (!c || !tags.includes(this.tag(x, y))) return;
      const u = edge(x, y - 1); const d = edge(x, y + 1); const l = edge(x - 1, y); const r = edge(x + 1, y);
      if (u + d + l + r === 2 && ((u || d) && (l || r))) marks.push([x, y, fn(c)]);
    });
    marks.forEach(([x, y, c]) => this.set(x, y, c));
  }
  blit(px, X, Y) { this.each((x, y) => { const c = this.get(x, y); if (c) px(X + x, Y + y, c); }); }
}

/** A letter-grid sprite: rows of characters; pal maps a character to a color ('.' is empty). */
export function grid(put, X, Y, rows, pal, tag) {
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) { const c = pal[r[x]]; if (c) put(X + x, Y + y, c, tag); } });
}

// ---------- shapes ----------

/** Is cell (x, y) inside an ellipse? Cells are tested at their centers. */
export const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Stones from seed points: for a cell, the nearest seed k, and gap (small on the joints between two stones). */
export function stones(seeds, sx = 1, sy = 1) {
  return (x, y) => {
    let b1 = Infinity; let b2 = Infinity; let k = -1;
    for (let i = 0; i < seeds.length; i += 1) {
      const dx = (x + 0.5 - seeds[i][0]) * sx; const dy = (y + 0.5 - seeds[i][1]) * sy; const d = dx * dx + dy * dy;
      if (d < b1) { b2 = b1; b1 = d; k = i; } else if (d < b2) b2 = d;
    }
    return { k, gap: Math.sqrt(b2) - Math.sqrt(b1) };
  };
}

/**
 * The nearest point on a set of paths (lists of points, like villagemaps.js paths): its
 * distance d, the signed offset across the path, how far along it is, and the unit normal
 * (nx, ny) from the path's middle out to the cell. Points further than `reach` from every
 * path come back quickly as FAR (d = Infinity).
 */
const FAR = Object.freeze({ d: Infinity, off: 0, along: 0, nx: 0, ny: 0 });
export function pathField(lines, reach = Infinity) {
  const segs = [];
  lines.forEach((pts, li) => {
    let acc = li * 1000;
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const len = Math.hypot(x1 - x0, y1 - y0) || 1;
      segs.push({ x0, y0, dx: x1 - x0, dy: y1 - y0, len, acc, bx0: Math.min(x0, x1) - reach, bx1: Math.max(x0, x1) + reach, by0: Math.min(y0, y1) - reach, by1: Math.max(y0, y1) + reach });
      acc += len;
    }
  });
  return (x, y) => {
    let best = null; let bd = Infinity; let bt = 0; let bqx = 0; let bqy = 0;
    for (const s of segs) {
      if (x < s.bx0 || x > s.bx1 || y < s.by0 || y > s.by1) continue;
      const t = Math.max(0, Math.min(1, ((x - s.x0) * s.dx + (y - s.y0) * s.dy) / (s.len * s.len)));
      const qx = s.x0 + t * s.dx; const qy = s.y0 + t * s.dy; const d = Math.hypot(x - qx, y - qy);
      if (d < bd) { bd = d; best = s; bt = t; bqx = qx; bqy = qy; }
    }
    if (!best || bd > reach) return FAR;
    const s = best;
    return { d: bd, off: (s.dx * (y - s.y0) - s.dy * (x - s.x0)) / s.len, along: s.acc + bt * s.len, nx: bd ? (x - bqx) / bd : 0, ny: bd ? (y - bqy) / bd : 0 };
  };
}

// ---------- painting into ImageData ----------

const parsed = new Map();
function rgba(c) {
  let v = parsed.get(c);
  if (v) return v;
  if (c[0] === '#') { const n = hexRgb(c); v = [...n, c.length >= 9 ? parseInt(c.slice(7, 9), 16) / 255 : 1]; }
  else { const m = c.match(/[\d.]+/g).map(Number); v = [m[0], m[1], m[2], m.length > 3 ? m[3] : 1]; }
  parsed.set(c, v);
  return v;
}

/**
 * A W x H picture held as ImageData. px(x, y, color, w, h) fills whole pixels (colors may be
 * #rrggbb, #rrggbbaa or rgba(); see-through colors blend over what is there, like a canvas
 * fillRect). put(ctx) shows it in one go.
 */
export function pixelBuffer(W, H) {
  const data = new Uint8ClampedArray(W * H * 4);
  const px = (x, y, c, w = 1, h = 1) => {
    if (!c) return;
    x = Math.round(x); y = Math.round(y);
    const [r, g, b, a] = rgba(c);
    const x0 = Math.max(0, x); const y0 = Math.max(0, y); const x1 = Math.min(W, x + Math.round(w)); const y1 = Math.min(H, y + Math.round(h));
    for (let yy = y0; yy < y1; yy += 1) {
      let i = (yy * W + x0) * 4;
      for (let xx = x0; xx < x1; xx += 1, i += 4) {
        if (a >= 1) { data[i] = r; data[i + 1] = g; data[i + 2] = b; data[i + 3] = 255; continue; }
        const da = data[i + 3] / 255; const oa = a + da * (1 - a);
        data[i] = (r * a + data[i] * da * (1 - a)) / oa; data[i + 1] = (g * a + data[i + 1] * da * (1 - a)) / oa; data[i + 2] = (b * a + data[i + 2] * da * (1 - a)) / oa; data[i + 3] = oa * 255;
      }
    }
  };
  return { px, data, put: (ctx) => ctx.putImageData(new ImageData(data, W, H), 0, 0) };
}
