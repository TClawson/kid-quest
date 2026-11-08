// The Forest Village (the meadow's village) in style B, "soft storybook": warm hue-shifted
// colors, round shapes, and selective outlines: each thing is edged in a darker shade of its
// own color (lighter on the lit top-left, darker on the bottom-right), with the near-black ink
// line kept only where things meet the ground. Paths, plazas and banks fade into the grass
// with ordered dithering instead of a hard edge. Thatched cottages with whitewashed walls.
//
// Everything is one canvas pixel per village pixel, painted into one ImageData and shown with
// a single putImageData. villageprops.js calls paintMeadow() for the meadow; every other map
// keeps its own painter.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, stones, pathField, pixelBuffer } from './pixelkit.js';
import { bigTree, bush } from './villageart.js';

export const PB = {
  grass: ['#2f6a4f', '#3f8a4c', '#54a752', '#68bf55', '#8dd263', '#b8e37a', '#e4f39c'], // base 3
  dirt: ['#7a4f46', '#a5714f', '#c48f5c', '#dcae74', '#eac48e', '#f6dcaa'],
  sand: ['#7a5a5e', '#a8846c', '#cfae88', '#e6cfa8', '#f6e8c8', '#fff8e6'],
  thatch: ['#5a3a42', '#8a5a40', '#b9844a', '#dba95c', '#efcb7c', '#fae6a8'],
  wash: ['#94788c', '#c9aeb2', '#e8d6cc', '#fbf0e0', '#fffaf0'],
  brick: ['#7a3a46', '#b0524a', '#d4785c', '#eea47c'],
  wood: ['#4a2a36', '#7a4436', '#a8663e', '#cc8a50', '#e8b674', '#f8dca0'],
  leaf: ['#244a40', '#33704a', '#4a9450', '#6cb85a', '#9ed46a', '#d0ec8c'],
  stone: ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde', '#f8f2e6'],
  glow: ['#7a3a3a', '#c86a3a', '#f0a848', '#ffd878', '#fff4c8'],
  water: ['#2a3f86', '#2f5aa6', '#3878c4', '#4f9ad8', '#86c4ec', '#cdeefc'],
  ink: '#3b2235',
};
const G = PB.grass; const Dt = PB.dirt; const T = PB.thatch; const WS = PB.wash; const Wd = PB.wood; const LF = PB.leaf; const St = PB.stone; const Wa = PB.water; const INK = PB.ink;

const FL = {
  pink: ['#c0487a', '#f58cb0', '#ffd2e2'], rose: ['#a8304a', '#e0546a', '#ff9a9a'], yellow: ['#d08a1a', '#ffd23f', '#fff4a8'], white: ['#b8aed0', '#f6f2fa', '#ffffff'],
  blue: ['#3a5ec0', '#6ea0f0', '#c0dcff'], lilac: ['#6a4ab0', '#a07ee0', '#d8c4ff'], orange: ['#c0581e', '#f08c3a', '#ffc47a'],
};

// selective outlines: [lit side, shaded side] per material; things standing on the ground get ink underneath
const EDGE = {
  thatch: [T[1], T[0]], wall: [WS[0], WS[0]], stone: [St[1], St[0]], wood: [Wd[1], Wd[0]], leaf: [LF[1], LF[0]], door: [Wd[1], Wd[0]],
  chim: [St[1], St[0]], brick: [PB.brick[0], PB.brick[0]], glass: [Wd[1], Wd[0]], fl: [LF[1], LF[0]], pot: ['#7a3a3a', '#5a2a34'], metal: ['#3a3450', '#2a2438'],
  sand: [PB.sand[1], PB.sand[0]], dirt: [Dt[1], Dt[0]], cloth: ['#7a4a5a', '#5a3048'], straw: [T[1], T[0]], fur: ['#5a4a5a', '#3a2a3a'],
  awnR: ['#9a2a3c', '#7a1e34'], awnC: ['#b89a8a', '#94788c'], mail: ['#8a2434', '#6a1a30'], gold: ['#9a6a1a', '#7a4a1e'], white: [St[2], St[1]], red: ['#8a2434', '#6a1a30'],
};
const GROUNDED = new Set(['wall', 'stone', 'door', 'wood', 'pot', 'sand', 'leaf', 'metal', 'mail', 'gold', 'white', 'red']);
function selective(tag, side) {
  const base = (tag || '').split(':')[0];
  const e = EDGE[base] || [INK, INK];
  if (side === 'bottom') return GROUNDED.has(base) ? INK : e[1];
  return side === 'right' ? e[1] : e[0];
}

/** A soft round shadow on the ground (see-through, so the grass shows through it). */
function groundShadow(px, cx, cy, rx, ry, a = 0.2) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d <= 1) px(x, y, `rgba(42,24,56,${d < 0.45 ? a : a * 0.55})`);
    }
  }
}

/** Draws a sprite into a buffer, outlines it selectively, and puts it on the village. */
function propB(px, X, Y, w, h, draw, o = {}) {
  const b = new Buf(w, h, o.pad ?? 4);
  const put = (tag) => (x, y, c) => b.set(x, y, c, tag);
  draw(b, put);
  b.outline(o.outline || selective);
  if (o.soften) b.soften((c) => mix(c, INK, 0.25), o.soften);
  if (o.after) o.after(b, put);
  b.blit(px, X, Y);
}

// ---------- grass ----------

const STROKES = [['.L', 'D.'], ['L.', '.D'], ['L', 'D'], ['..L', '.D.', 'D..'], ['L.L', '.D.'], ['.L.', 'D.D']];
const tuft = (px, x, y, k) => grid(px, x, y, STROKES[k % STROKES.length], { D: G[2], L: G[4] });

/** A small flower: daisy, forget-me-nots, buttercup, dandelion puff or clover. */
function flowerB(px, x, y, kind, col = 'white') {
  const [d, m, l] = FL[col] || FL.white;
  if (kind === 'daisy') { px(x - 1, y, l); px(x + 1, y, m); px(x, y - 1, l); px(x, y + 1, d); px(x, y, '#ffcf3a'); px(x + 1, y + 1, G[2]); return; }
  if (kind === 'forget') { px(x, y, m); px(x + 1, y, d); px(x, y - 1, l); px(x + 2, y - 1, m); px(x + 2, y - 2, l); px(x + 1, y + 1, G[2]); return; }
  if (kind === 'cup') { px(x, y, m); px(x + 1, y, d); px(x, y - 1, l); px(x + 1, y - 1, m); px(x, y + 1, G[2]); return; }
  if (kind === 'puff') { px(x, y - 1, '#ffffff'); px(x - 1, y, '#f6f2fa'); px(x + 1, y, '#d8d2e8'); px(x, y + 1, '#d8d2e8'); px(x, y, '#e8e2f0'); px(x, y + 2, G[1]); return; }
  if (kind === 'clover') { px(x, y, '#e8b8d8'); px(x + 1, y, '#c890c0'); px(x, y - 1, '#fbe4f2'); px(x + 1, y - 1, '#e8b8d8'); px(x, y + 1, G[2]); return; }
  px(x, y, m); px(x, y - 1, l);
}

/**
 * The meadow: warm green with big soft patches blended by ordered dithering, little curved
 * grass strokes, clover, and wildflowers in clumps of one kind. o.edge(x, y) gives the color
 * of the dark forest floor round the village (or null), where no flowers grow.
 */
function grassB(px, W, H, seed, o = {}) {
  const rnd = rng(seed);
  const edge = o.edge || (() => null);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const e = edge(x, y);
      if (e) { px(x, y, e); continue; }
      const n = vnoise(x, y, 26, seed) * 0.7 + vnoise(x, y, 9, seed + 1) * 0.3;
      const t = (bayer(x, y) - 0.5) * 0.16;
      let c = G[3];
      if (n < 0.33 + t) c = n < 0.24 + t ? '#56ad4f' : '#5fb652';
      else if (n > 0.66 + t) c = n > 0.76 + t ? '#86d062' : '#77c85b';
      px(x, y, c);
    }
  }
  for (let gy = 0; gy < H; gy += 6) {
    for (let gx = 0; gx < W; gx += 7) {
      if (rnd() < 0.5) continue;
      const x = gx + Math.floor(rnd() * 7); const y = gy + Math.floor(rnd() * 6); const k = Math.floor(rnd() * STROKES.length);
      const n = vnoise(x, y, 26, seed);
      if (edge(x, y)) grid(px, x, y, STROKES[k], { D: G[0], L: G[2] });
      else grid(px, x, y, STROKES[k], { D: n < 0.4 ? G[1] : G[2], L: n > 0.6 ? G[5] : G[4] });
    }
  }
  for (let i = 0; i < (W * H) / 1400; i += 1) {
    const cx = rnd() * W; const cy = rnd() * H;
    for (let j = 0; j < 5; j += 1) {
      const x = Math.round(cx + (rnd() - 0.5) * 10); const y = Math.round(cy + (rnd() - 0.5) * 6);
      if (edge(x, y)) continue;
      px(x, y, G[2]); px(x + 1, y, G[1]); px(x, y - 1, G[4]); px(x - 1, y, G[2]);
    }
  }
  const kinds = [['daisy', 'white'], ['daisy', 'white'], ['forget', 'blue'], ['cup', 'yellow'], ['puff'], ['clover'], ['daisy', 'pink'], ['forget', 'lilac']];
  for (let i = 0; i < ((W * H) / 2200) * (o.flowers ?? 1.5); i += 1) {
    const cx = rnd() * W; const cy = rnd() * H; const [k, c] = kinds[Math.floor(rnd() * kinds.length)];
    const n = k === 'puff' ? 1 + Math.floor(rnd() * 2) : 3 + Math.floor(rnd() * 5);
    for (let j = 0; j < n; j += 1) {
      const x = Math.round(cx + (rnd() - 0.5) * 14); const y = Math.round(cy + (rnd() - 0.5) * 8);
      if (!edge(x, y) && !edge(x, y + 2)) flowerB(px, x, y, k, c);
    }
  }
}

// ---------- paths and plazas ----------

function bbox(lines, pad) {
  const xs = lines.flat().map((p) => p[0]); const ys = lines.flat().map((p) => p[1]);
  const x0 = Math.floor(Math.min(...xs) - pad); const y0 = Math.floor(Math.min(...ys) - pad);
  return [x0, y0, Math.ceil(Math.max(...xs) + pad) - x0, Math.ceil(Math.max(...ys) + pad) - y0];
}

/** A pebble: no line on top, a warm dark line under it. */
function pebbleB(px, x, y, k) {
  const p = [['lm', 'md', 'ss'], ['.lm.', 'lmmd', '.ss.'], ['l', 's'], ['lmm', 'mmd', '.ss']][k % 4];
  grid(px, x, y, p, { l: St[5], m: St[4], d: St[2], s: Dt[1] });
}

/**
 * Dirt paths with no outline: the edge dithers into the grass, grass strokes lean over it,
 * the middle is worn pale, with pebbles, fallen petals and a few boot prints. All the paths
 * share one distance field, so where they meet they run into each other.
 */
function pathsB(px, lines, seed, o = {}) {
  const R = 6.5;
  const F = pathField(lines, R + 4);
  const [bx, by, bw, bh] = bbox(lines, 10);
  const edge = []; const bits = [];
  for (let y = by; y < by + bh; y += 1) {
    for (let x = bx; x < bx + bw; x += 1) {
      const f = F(x, y);
      if (f.d > R + 3) continue;
      const r = R + (vnoise(x, y, 8, seed) - 0.5) * 1.8 + (vnoise(x, y, 3, seed + 3) - 0.5) * 0.8;
      const e = f.d - r; // < 0 inside
      if (e > 1.5) continue;
      const lit = f.nx * 0.8 + f.ny;
      if (e > -1) {
        const t = (e + 1) / 2.5; // 0 inside .. 1 out in the grass
        if (bayer(x, y) < t) { if (e < 0.6 && lit < 0 && bayer(x, y) < t - 0.3) px(x, y, G[2]); continue; }
        px(x, y, lit < 0 ? Dt[2] : '#d6aa72');
        edge.push([x, y, lit]);
        continue;
      }
      let c = Dt[3];
      const m = vnoise(x, y, 10, seed + 2) + (bayer(x, y) - 0.5) * 0.14;
      if (m < 0.34) c = '#d8ad76'; else if (m > 0.64) c = Dt[4];
      const worn = Math.abs(f.off) < 2.2 + vnoise(f.along, 0, 6, seed) * 1.2;
      if (worn && bayer(x, y) < 0.45 + (m - 0.5)) c = Dt[4];
      if (e > -2 && lit < -0.2 && bayer(x, y) < 0.55) c = '#d2a26c';
      px(x, y, c);
      if (f.d < R - 2) bits.push([x, y]);
    }
  }
  // pebbles, fallen petals and leaves, grit
  bits.forEach(([x, y]) => {
    const hh = h2(x, y, seed);
    if (hh > 0.994) pebbleB(px, x, y, Math.floor(h2(y, x, seed) * 4));
    else if (hh < 0.003) { px(x, y, FL.pink[1]); px(x + 1, y, FL.pink[0]); }
    else if (hh < 0.006) { px(x, y, '#e8a040'); px(x + 1, y + 1, '#c0702a'); }
    else if (hh < 0.015) px(x, y, Dt[2]);
  });
  // grass leaning over the edges, now and then
  edge.forEach(([x, y, lit]) => {
    const hh = h2(x, y, seed + 7);
    if (hh < 0.08) { px(x, y, G[2]); px(x + (lit < 0 ? 1 : -1), y + (lit < 0 ? 1 : -1), G[4]); }
    else if (hh > 0.988) flowerB(px, x, y, 'daisy', 'white');
  });
  // boot prints walking up a path
  if (o.prints !== false) {
    const ln = lines[o.printLine ?? 0]; const [x0, y0] = ln[0]; const [x1, y1] = ln[1];
    const len = Math.hypot(x1 - x0, y1 - y0); const ux = (x1 - x0) / len; const uy = (y1 - y0) / len;
    const s0 = len * (o.printAt ?? 0.35);
    for (let s = s0, i = 0; s < s0 + 30 && s < len - 4; s += 6, i += 1) {
      const side = i % 2 ? 1.6 : -1.6; const x = Math.round(x0 + ux * s - uy * side); const y = Math.round(y0 + uy * s + ux * side);
      px(x, y, '#c08a5a', 2, 1); px(x, y + 1, '#c08a5a', 2, 1); px(x, y + 3, '#c08a5a', 2, 1);
    }
  }
  return F;
}

/** One flat stone set in the ground. */
function stoneB(px, cx, cy, rx, ry, mossy, seed) {
  const b = new Buf(Math.ceil(rx * 2) + 2, Math.ceil(ry * 2) + 2, 2);
  const ox = Math.ceil(rx) + 1; const oy = Math.ceil(ry) + 1;
  b.fill(0, 0, ox * 2, oy * 2, (x, y) => {
    const wob = (h2(Math.round(Math.atan2(y - oy, x - ox) * 3), 0, seed) - 0.5) * 0.25;
    if (!inEll(x, y, ox, oy, rx * (1 + wob), ry * (1 + wob))) return null;
    const s = (x + 0.5 - ox) / rx + (y + 0.5 - oy) / ry;
    let c = s < -0.7 ? St[5] : s > 0.8 ? St[2] : St[4];
    if (mossy && vnoise(x + cx, y + cy, 3, seed) > 0.62) c = s < 0 ? LF[4] : LF[3];
    return c;
  }, 'stone');
  b.outline((t, side) => (side === 'bottom' || side === 'right' ? St[1] : null));
  b.blit(px, cx - ox, cy - oy);
}

/**
 * A plaza of warm sandstone flags laid by hand: irregular slabs with joints of dirt, each
 * slab lit top-left and edged in its own darker color. The rim has no line: slabs thin out
 * and grass grows between them at the edge (but not where a path comes in: onPath(x, y)).
 */
function plazaB(px, cx, cy, r, seed, onPath = () => false) {
  const rnd = rng(seed); const S = PB.sand;
  const seeds = [];
  for (let y = cy - r - 4; y <= cy + r + 4; y += 6) for (let x = cx - r - 4; x <= cx + r + 4; x += 7) seeds.push([x + rnd() * 6.5, y + rnd() * 5.5]);
  const cell = stones(seeds, 1, 1.2);
  const map = new Map();
  const at = (x, y) => {
    const k = y * 4096 + x;
    if (map.has(k)) return map.get(k);
    const d = Math.hypot(x - cx, y - cy) + (vnoise(x, y, 6, seed) - 0.5) * 3;
    let v = null;
    if (d <= r) {
      const c = cell(x, y);
      const sd = Math.hypot(seeds[c.k][0] - cx, seeds[c.k][1] - cy);
      const dropped = sd > r - 3 && h2(c.k, 1, seed) < 0.3 && !onPath(seeds[c.k][0], seeds[c.k][1]); // slabs missing at the edge
      v = c.gap < 0.95 || dropped ? -1 : c.k;
    }
    map.set(k, v); return v;
  };
  for (let y = cy - r - 2; y <= cy + r + 2; y += 1) {
    for (let x = cx - r - 2; x <= cx + r + 2; x += 1) {
      const k = at(x, y);
      if (k === null) continue;
      const d = Math.hypot(x - cx, y - cy);
      if (k === -1) { // a joint: dirt in the middle, grass growing in it near the edge
        const grass = d > r * 0.7 && !onPath(x, y) && vnoise(x, y, 5, seed + 2) > 0.62 - (d / r) * 0.35;
        if (grass) px(x, y, bayer(x, y) < 0.5 ? G[2] : G[3]);
        else px(x, y, at(x, y - 1) !== -1 && at(x, y - 1) !== null ? '#7e5e56' : Dt[1]);
        continue;
      }
      const hk = h2(k, 5, seed);
      const t = hk < 0.22 ? [S[1], S[2], S[3], S[4]] : hk < 0.34 ? ['#7e6e80', '#a69aa6', '#c4bac0', '#e0d8d8'] : hk < 0.44 ? ['#8a7c56', '#b0a27a', '#cabe96', '#e2d8b4'] : ['#987868', '#b89a7e', '#d2b694', '#e8d4b0'];
      let c = t[2];
      const up = at(x, y - 1); const lf = at(x - 1, y); const dn = at(x, y + 1); const rt = at(x + 1, y);
      if (dn !== k || rt !== k) c = t[0];
      else if (up !== k || lf !== k) c = t[3];
      else if (vnoise(x, y, 3, k) < 0.25) c = t[1];
      px(x, y, c);
    }
  }
}

// ---------- water ----------

/** A lily pad (7 x 4) with a notch, and a flower on some. */
function lilyPad(px, x, y, flower, mirror) {
  for (let yy = 0; yy < 4; yy += 1) {
    for (let xx = 0; xx < 7; xx += 1) {
      if (!inEll(xx, yy, 3.5, 2, 3.6, 2.1)) continue;
      const notch = (mirror ? xx < 3 : xx > 3) && Math.abs(yy + 0.5 - 2) < 0.6;
      if (notch) continue;
      const s = (xx - 3) / 3.5 + (yy - 1.5) / 2;
      px(x + xx, y + yy, s < -0.6 ? LF[5] : s > 0.7 ? LF[2] : LF[4]);
    }
  }
  for (let xx = 1; xx < 6; xx += 1) px(x + xx, y + 4, Wa[1]); // its shadow on the water
  if (flower) grid(px, x + 2, y - 2, ['.l.', 'lml', '.d.'], { l: FL.pink[2], m: '#ffe070', d: FL.pink[1] });
}

/** A clump of reeds with cattails, standing on the ground at (x, y). */
function reeds(px, x, y, seed) {
  const n = 3 + Math.floor(h2(x, y, seed) * 3);
  for (let i = 0; i < n; i += 1) {
    const bx = x + i * 2 - n + (i % 2); const hgt = 5 + Math.floor(h2(i, x, seed) * 6); const lean = i < n / 2 ? -1 : 1;
    for (let k = 0; k < hgt; k += 1) px(bx + (k > hgt * 0.6 ? lean : 0), y - k, k > hgt - 2 ? LF[4] : i % 2 ? LF[3] : LF[2]);
    if (h2(i, y, seed + 1) < 0.45) { const cx = bx + lean; px(cx, y - hgt - 1, Wd[2]); px(cx, y - hgt - 2, Wd[1]); px(cx, y - hgt - 3, Wd[1]); px(cx, y - hgt - 4, LF[3]); }
  }
  px(x - n, y + 1, 'rgba(42,24,56,0.18)', n * 2 + 1, 1);
}

/**
 * The river across the village. depth(wa, x, y) is how far into the water a point is (the
 * same wobbly banks the buddy walks round). The far (north) bank shows its earth face over a
 * shadowed strip of water; the near bank's grass meets light shallows; streaks of current,
 * shines, lily pads, reeds and a few stones.
 */
function riverB(px, L, wa, depth, seed, avoid) {
  const ys = wa.pts.map((p) => p[1]);
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - wa.w / 2 - 10)); const y1 = Math.min(L.H, Math.ceil(Math.max(...ys) + wa.w / 2 + 10));
  const half = wa.w / 2;
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < L.W; x += 1) {
      const d = depth(wa, x, y);
      if (d < -7) continue;
      const north = depth(wa, x, y + 1) > d;
      const b = bayer(x, y);
      if (d < -2.5) { // damp grass near the water
        const t = (d + 7) / 4.5;
        if (b < t * 0.5) px(x, y, G[2]);
        continue;
      }
      if (d < 0) {
        if (north) px(x, y, d < -1.6 ? G[4] : d < -0.5 ? Dt[3] : Dt[2]);
        else px(x, y, d < -1.2 ? G[2] : G[1]);
        continue;
      }
      let c = Wa[2];
      if (north) {
        if (d < 1.4) c = Dt[1];
        else if (d < 2.4) c = '#3a3466';
        else if (d < 5 || (d < 7 && b < (7 - d) / 2)) c = Wa[1];
      } else if (d < 1.2) c = b < 0.5 ? Wa[5] : Wa[4];
      else if (d < 3.5 || (d < 5 && b < (5 - d) / 1.5)) c = Wa[3];
      if (c === Wa[2]) {
        const s = vnoise(x * 0.3, y, 2.4, seed);
        if (s > 0.68 || (s > 0.6 && b < (s - 0.6) * 10)) c = Wa[3];
        else if (d > half - 3.5 && b < 0.5) c = Wa[1];
      }
      px(x, y, c);
    }
  }
  // shines: little dashes on the open water
  for (let y = y0; y < y1; y += 1) {
    for (let x = 0; x < L.W; x += 1) {
      if (h2(x, y, seed + 3) < 0.9955) continue;
      const d = depth(wa, x, y);
      if (d < 4 || depth(wa, x + 5, y) < 4) continue;
      const n = 2 + Math.floor(h2(y, x, seed) * 4);
      px(x, y, Wa[5]); px(x + 1, y, Wa[4], n, 1);
    }
  }
  const rnd = rng(seed + 9);
  // lily pads on the near side, reeds on both banks, stones at the edge
  for (let i = 0; i < L.W / 34; i += 1) {
    const x = Math.floor(rnd() * (L.W - 20)) + 10;
    if (avoid(x, 0)) continue;
    for (let y = y0; y < y1; y += 1) {
      const d = depth(wa, x, y);
      if (d > 3.5 && d < 5 && depth(wa, x, y + 1) < d) { lilyPad(px, x - 3, y - 2, i % 3 === 0, i % 2); if (rnd() < 0.5) lilyPad(px, x + 4, y + 1, false, true); break; }
    }
  }
  for (let i = 0; i < L.W / 30; i += 1) {
    const x = Math.floor(rnd() * (L.W - 30)) + 15; const northBank = i % 2 === 0;
    if (avoid(x, 0)) continue;
    for (let y = y0; y < y1; y += 1) {
      const d = depth(wa, x, y); const down = depth(wa, x, y + 1) > d;
      if (northBank && down && d > -2.2) { reeds(px, x, y, seed + i); break; }
      if (!northBank && !down && d < -0.5 && d > -1.5) { reeds(px, x, y, seed + i); break; }
    }
  }
  for (let i = 0; i < L.W / 60; i += 1) {
    const x = Math.floor(rnd() * (L.W - 30)) + 15;
    if (avoid(x, 0)) continue;
    for (let y = y0; y < y1; y += 1) if (depth(wa, x, y) > 0.5) { if (rnd() < 0.5) { stoneB(px, x, y - 1, 3 + rnd() * 1.5, 2, rnd() < 0.5, seed + i); } break; }
    for (let y = y1; y > y0; y -= 1) if (depth(wa, x + 20, y) > 0.2) { if (rnd() < 0.6) stoneB(px, x + 20, y + 1, 3 + rnd() * 1.2, 1.8, rnd() < 0.4, seed + i + 50); break; }
  }
}

/** The wooden footbridge over the river: planks across, log rails on posts, a shadow on the water. */
function bridgeB(px, c, seed = 81) {
  const { x: X, y: Y, w, h } = c;
  px(X + w + 4, Y + 4, 'rgba(26,22,72,0.32)', 4, h - 6);
  px(X + 2, Y + h, 'rgba(26,22,72,0.28)', w + 4, 2);
  propB(px, X, Y, w, h, (b) => {
    // the deck: planks three rows deep with a dark gap, ragged ends, worn pale down the middle
    for (let y = -1; y < h + 1; y += 1) {
      const r = (y + 4) % 4; const k = Math.floor((y + 4) / 4);
      const l0 = h2(k, 1, seed) < 0.3 ? -1 : 0; const r0 = h2(k, 2, seed) < 0.3 ? w + 1 : w;
      const tone = h2(k, 3, seed);
      const P = tone < 0.25 ? [Wd[1], Wd[2], Wd[3], Wd[4]] : tone > 0.8 ? [Wd[2], Wd[3], Wd[4], Wd[5]] : [Wd[1], Wd[2], Wd[3], Wd[4]];
      for (let x = l0; x < r0; x += 1) {
        let col;
        if (r === 3) col = Wd[0];
        else if (r === 0) col = x < 2 ? P[3] : P[3];
        else col = x >= w - 3 ? P[1] : P[2];
        if (r === 1 && Math.abs(x + 0.5 - w / 2) < 6 && bayer(x, y) < 0.35) col = P[3];
        if (r !== 3 && r !== 0 && h2(x >> 2, y, seed + 5) < 0.12) col = P[1]; // grain
        if (r === 1 && (x === 3 || x === w - 4)) col = '#5a4a5a'; // nails
        b.set(x, y, col, 'wood');
      }
    }
    // beams under the deck edges, then the log rails and their posts
    for (const bx of [-2, w]) for (let y = -2; y < h + 2; y += 1) { b.set(bx, y, Wd[2], 'wood'); b.set(bx + 1, y, Wd[1], 'wood'); }
    for (const rx of [-5, w + 2]) {
      for (let y = -6; y < h + 5; y += 1) { b.set(rx, y, Wd[4], 'wood'); b.set(rx + 1, y, Wd[3], 'wood'); b.set(rx + 2, y, Wd[2], 'wood'); }
      for (const py of [-8, Math.round(h / 2) - 3, h + 2]) {
        for (let y = 0; y < 6; y += 1) for (let x = 0; x < 5; x += 1) b.set(rx - 1 + x, py + y, y === 0 ? (x < 3 ? Wd[5] : Wd[4]) : x === 0 ? Wd[4] : x === 4 ? Wd[1] : y === 5 ? Wd[2] : Wd[3], 'wood');
        b.set(rx + 1, py + 2, Wd[2], 'wood');
      }
    }
  }, { pad: 10 });
}

/** An oval in a box: how far into it (x, y) is, 1 in the middle, 0 at the edge, negative outside. */
const oval = (Z, x, y) => { const dx = (x + 0.5 - (Z.x + Z.w / 2)) / (Z.w / 2); const dy = (y + 0.5 - (Z.y + Z.h / 2)) / (Z.h / 2); return 1 - (dx * dx + dy * dy); };
const grow = (Z, g) => ({ x: Z.x - g, y: Z.y - g, w: Z.w + g * 2, h: Z.h + g * 2 });

/** The village fishing pond on the green: a dark earth rim at the back, sand at the front, stones, lily pads, reeds. */
function pondB(px, Z, seed) {
  const g1 = grow(Z, 1); const g2 = grow(Z, 2.5); const g5 = grow(Z, 6);
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 7; y < Z.y + Z.h + 7; y += 1) {
    for (let x = Z.x - 7; x < Z.x + Z.w + 7; x += 1) {
      const k = oval(Z, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
      if (k < 0) {
        if (oval(g1, x, y) >= 0) px(x, y, north ? Dt[1] : PB.sand[2]);
        else if (oval(g2, x, y) >= 0) px(x, y, north ? G[4] : PB.sand[3]);
        else if (oval(g5, x, y) >= 0 && b < oval(g5, x, y) * 2.2) px(x, y, G[2]);
        continue;
      }
      let c = Wa[2];
      const top = north && oval(grow(Z, -3), x, y) < 0;
      if (top) c = oval(grow(Z, -1.5), x, y) < 0 ? '#3a3466' : Wa[1];
      else if (!north && oval(grow(Z, -2), x, y) < 0) c = b < 0.5 ? Wa[4] : Wa[3];
      else if (k > 0.6 || (k > 0.45 && b < (k - 0.45) * 6)) c = Wa[1];
      else if (!north && oval(grow(Z, -5), x, y) < 0 && b < 0.5) c = Wa[3];
      px(x, y, c);
    }
  }
  const rnd = rng(seed);
  for (let i = 0; i < 10; i += 1) { const x = Z.x + 14 + Math.floor(rnd() * (Z.w - 34)); const y = Z.y + 9 + Math.floor(rnd() * (Z.h - 18)); if (oval(grow(Z, -6), x, y) > 0) { px(x, y, Wa[5]); px(x + 1, y, Wa[4], 2 + Math.floor(rnd() * 3), 1); } }
  // stones round the rim
  [[0.06, 0.62], [0.13, 0.86], [0.5, 1.02], [0.9, 0.22], [0.95, 0.6], [0.72, 0.98], [0.3, -0.02]].forEach(([fx, fy], i) => stoneB(px, Math.round(Z.x + fx * Z.w), Math.round(Z.y + fy * Z.h), 3 + (i % 3) * 0.6, 2 + (i % 2) * 0.4, i % 3 === 0, seed + i));
  lilyPad(px, Math.round(Z.x + 0.22 * Z.w), Math.round(Z.y + 0.55 * Z.h), true, false);
  lilyPad(px, Math.round(Z.x + 0.66 * Z.w), Math.round(Z.y + 0.28 * Z.h), false, true);
  lilyPad(px, Math.round(Z.x + 0.75 * Z.w), Math.round(Z.y + 0.62 * Z.h), false, false);
  reeds(px, Z.x + 8, Z.y + 6, seed); reeds(px, Z.x + Z.w - 12, Z.y + 4, seed + 1); reeds(px, Z.x + Z.w - 9, Z.y + Z.h - 4, seed + 2);
}

/** A frozen pond for hockey: snow banked round the edge, pale ice with streaks and cracks, two little nets. */
function frozenB(px, Z, seed) {
  const Sn = ['#a8a8cc', '#ccd0e8', '#e6eaf6', '#f8faff'];
  const ice = ['#7a9cc8', '#a8c8e8', '#c8e2f6', '#e4f2fc'];
  const snowZ = { x: Z.x - 6, y: Z.y - 4, w: Z.w + 12, h: Z.h + 8 };
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 9; y < Z.y + Z.h + 9; y += 1) {
    for (let x = Z.x - 10; x < Z.x + Z.w + 10; x += 1) {
      const s = oval(snowZ, x, y); const b = bayer(x, y);
      if (s < 0) { const near = (g) => oval(grow(snowZ, g), x, y) >= 0; if (near(1) || (near(2.2) && b < 0.5)) px(x, y, y + 0.5 < mid ? Sn[2] : Sn[1]); continue; }
      const k = oval(Z, x, y); const north = y + 0.5 < mid;
      if (k < 0) {
        // a soft bank of snow: lit on top, a cool shade where it falls to the ice
        const inner = oval(grow(Z, 1.2), x, y) >= 0;
        px(x, y, inner ? (north ? Sn[1] : Sn[2]) : s < 0.12 ? (north ? Sn[2] : Sn[1]) : (vnoise(x, y, 4, seed) > 0.6 ? Sn[2] : Sn[3]));
        continue;
      }
      let c = ice[2];
      if (north && oval(grow(Z, -3), x, y) < 0) c = ice[1];
      else if (vnoise(x * 0.4, y, 3, seed) > 0.64 && b < 0.6) c = ice[3];
      if (h2(x, y, seed) > 0.985) c = '#ffffff';
      px(x, y, c);
    }
  }
  // cracks and a red line across the middle
  const rnd = rng(seed);
  for (let i = 0; i < 4; i += 1) {
    let x = Z.x + 14 + Math.floor(rnd() * (Z.w - 28)); let y = Z.y + 6 + Math.floor(rnd() * (Z.h - 12));
    for (let k = 0; k < 9; k += 1) { if (oval(grow(Z, -3), x, y) > 0) px(x, y, ice[0]); x += rnd() < 0.6 ? 1 : 0; y += rnd() < 0.5 ? 1 : -1; }
  }
  for (let y = Z.y + 3; y < Z.y + Z.h - 3; y += 1) if (oval(grow(Z, -1), Z.x + Z.w / 2, y) > 0) px(Z.x + Z.w / 2 - 1, y, y % 3 ? '#e8788a' : '#f0a0b0');
  const m = Math.round(mid);
  const net = (x, dir) => propB(px, x, m - 6, 4, 13, (b) => {
    for (let y = 0; y < 13; y += 1) for (let xx = 0; xx < 4; xx += 1) {
      const front = dir > 0 ? xx === 3 : xx === 0; const back = dir > 0 ? xx === 0 : xx === 3;
      if (front || y === 0 || y === 12) b.set(xx, y, y === 0 ? '#ff8a8a' : '#d8384a', 'red');
      else if (back) b.set(xx, y, '#c8384a', 'red');
      else if (y % 2 === 0 || xx % 2 === 1) b.set(xx, y, '#f4f4fa', 'white');
    }
  });
  net(Z.x + 6, 1); net(Z.x + Z.w - 10, -1);
}

/** A worn patch of dirt for soccer or football, fading into the grass, with goals or goalposts. */
function clearingB(px, Z, kind, seed) {
  const big = grow(Z, 2);
  for (let y = Z.y - 3; y < Z.y + Z.h + 3; y += 1) {
    for (let x = Z.x - 3; x < Z.x + Z.w + 3; x += 1) {
      const k = oval(big, x, y);
      if (k < 0) continue;
      const b = bayer(x, y);
      const n = vnoise(x, y, 7, seed) * 0.6 + vnoise(x, y, 3, seed + 1) * 0.4;
      // the rim: grass breaking through, dithered
      if (k < 0.3 && b < (0.3 - k) / 0.3 + (n - 0.5) * 0.6) { if (k > 0.15 && b > 0.8) px(x, y, G[2]); continue; }
      let c = Dt[3];
      if (n < 0.36) c = '#d8ad76'; else if (n > 0.64) c = Dt[4];
      if (k > 0.55 && b < (k - 0.55) * 2) c = Dt[4];
      if (k < 0.4 && n < 0.3 && b < 0.5) c = Dt[2];
      px(x, y, c);
      const hh = h2(x, y, seed);
      if (k > 0.3 && hh > 0.996) pebbleB(px, x, y, Math.floor(h2(y, x, seed) * 4));
      else if (k < 0.45 && k > 0.3 && hh < 0.03) tuft(px, x, y - 1, Math.floor(hh * 200));
    }
  }
  const mid = Math.round(Z.y + Z.h / 2);
  if (kind === 'football') {
    const Y4 = ['#c08a1a', '#f0b42a', '#ffd84a', '#fff0a0'];
    const post = (x) => propB(px, x - 6, mid - 18, 13, 22, (b) => {
      for (let y = 9; y < 22; y += 1) { b.set(6, y, Y4[2], 'gold'); b.set(7, y, Y4[1], 'gold'); }
      for (let xx = 0; xx < 13; xx += 1) { b.set(xx, 8, Y4[3], 'gold'); b.set(xx, 9, Y4[1], 'gold'); }
      for (const ux of [0, 11]) for (let y = 0; y < 9; y += 1) { b.set(ux, y, Y4[2], 'gold'); b.set(ux + 1, y, Y4[1], 'gold'); }
      b.set(0, 0, Y4[3], 'gold'); b.set(11, 0, Y4[3], 'gold');
    });
    groundShadow(px, Z.x + 6, mid + 4, 4, 1.2, 0.2); groundShadow(px, Z.x + Z.w - 5, mid + 4, 4, 1.2, 0.2);
    post(Z.x + 4); post(Z.x + Z.w - 7);
  } else {
    const goal = (x, dir) => propB(px, x, mid - 7, 8, 15, (b) => {
      for (let y = 0; y < 15; y += 1) {
        for (let i = 0; i < 8; i += 1) {
          const xx = dir > 0 ? i : 7 - i; // i counts from the back of the goal to its open mouth
          if (i >= 6) b.set(xx, y, i === 6 ? St[5] : St[3], 'white'); // the posts at the mouth
          else if (y === 0 || y === 14) b.set(xx, y, y === 0 ? St[5] : St[3], 'white');
          else if (i === 0) b.set(xx, y, St[4], 'white');
          else if ((i + y) % 2 === 0) b.set(xx, y, 'rgba(255,255,255,0.62)', 'net');
        }
      }
    }, { outline: (t, side) => (t === 'net' ? null : selective(t, side)) });
    groundShadow(px, Z.x + 5, mid + 8, 5, 1.2, 0.18); groundShadow(px, Z.x + Z.w - 4, mid + 8, 5, 1.2, 0.18);
    goal(Z.x, 1); goal(Z.x + Z.w - 8, -1);
    // the chalk spot in the middle
    grid(px, Math.round(Z.x + Z.w / 2) - 3, mid - 3, ['..ww..', '.w..w.', 'w....w', 'w....w', '.w..w.', '..ww..'], { w: '#fff6e0' });
  }
}

// ---------- houses ----------

function stoneRow(b, x0, y0, w, h, rnd, tag = 'stone') {
  let x = x0 - 1;
  while (x < x0 + w) {
    const sw = 5 + Math.floor(rnd() * 4); const sh = h - (rnd() < 0.4 ? 1 : 0); const t = rnd();
    const ramp3 = t < 0.25 ? ['#8a8a6e', '#b4b48e', '#d8d6b0'] : t < 0.4 ? ['#a08074', '#c8a898', '#e8ccb8'] : [St[2], St[3], St[4]];
    const sx = x;
    b.fill(x, y0 + h - sh, sw, sh, (X, Y) => {
      if (X < x0 || X >= x0 + w) return null;
      const xx = X - sx; const yy = Y - (y0 + h - sh);
      if ((xx === 0 || xx === sw - 1) && (yy === 0 || yy === sh - 1)) return null;
      if (xx === sw - 1 || yy === sh - 1) return ramp3[0];
      if (xx === 0 || yy === 0) return ramp3[2];
      return ramp3[1];
    }, tag);
    x += sw;
  }
}

/** A curl of chimney smoke: round puffs, no outline, a cool shade on the bottom-right. */
function smokeB(px, x, y) {
  const puffs = [[3.5, 26, 2.2], [6, 20, 3], [4, 13, 3.3], [8, 6.5, 2.7], [12, 1.8, 1.8]];
  const b = new Buf(18, 30, 3);
  puffs.forEach(([cx, cy, rr]) => b.fill(-2, -2, 22, 34, (xx, yy) => (inEll(xx, yy, cx, cy, rr, rr * 0.9) ? ((xx + 0.5 - cx) + (yy + 0.5 - cy) > rr * 0.5 ? '#d6d0e4' : (xx + 0.5 - cx) + (yy + 0.5 - cy) < -rr * 0.6 ? '#ffffff' : '#f2eef6') : null)));
  b.blit(px, x - 3, y - 28);
}

/**
 * One hollyhock: a stalk with round cup flowers (dark middles) stepping up it from side to
 * side, buds at the top, and broad leaves at the foot. put(x, y, color, tag); base is the ground y.
 */
function hollyhock(put, x, base, hgt, col) {
  const [d, m, l] = FL[col];
  for (let y = base - 1; y > base - hgt; y -= 1) put(x, y, LF[2], 'leaf');
  grid((xx, yy, c) => put(xx, yy, c, 'leaf'), x - 3, base - 4, ['.lL...L.', 'lLLd.LLl', '.Ld..dL.'], { l: LF[4], L: LF[3], d: LF[2] });
  let i = 0;
  for (let y = base - 7; y > base - hgt + 2; y -= 3, i += 1) {
    const fx = x + (i % 2 ? 0 : -1);
    if (y < base - hgt + 6) { put(fx + 1, y, m, 'fl'); put(fx + 1, y - 1, l, 'fl'); continue; }
    grid((xx, yy, c) => put(xx, yy, c, 'fl'), fx, y - 1, ['.lm.', 'lmcd', '.dd.'], { l, m, d, c: '#f6e070' });
  }
  put(x, base - hgt + 1, LF[4], 'leaf');
}

/**
 * A cottage (same box as villageart's cottage(px, X, Y, w, h)): a thick rounded thatch with a
 * patterned ridge and a shaggy hem, a leaning stone chimney, whitewashed walls with bricks
 * showing where the plaster fell off, a round-topped painted door, crooked windows lit warm
 * from inside. o: { door (its paint), roof (a tint for the thatch), seed, home (the kid's
 * home: an eyebrow window and a heart over the door), sign: 'note', cat: 'left' | 'right',
 * boxes: [left, right] window-box flowers, holly: [[x, height, color]...], rose, smoke, bird }.
 */
function cottageB(px, X, Y, w, h, o = {}) {
  const seed = o.seed ?? (X * 5 + Y * 11 + w);
  const rnd = rng(seed);
  const home = !!o.home;
  const Th = o.roof ? ramp(mix(T[3], o.roof, o.tint ?? 0.14), 3, 2) : T;
  const b = new Buf(w, h, 36);
  const eave = Math.round(h * 0.54);
  const mid = w / 2;
  groundShadow(px, X + mid + 3, Y + h + 1, w / 2 + 2, 3.2, 0.2);

  // the chimney, leaning a little, behind the thatch
  const chx = Math.round(w * 0.7); const chTop = -7;
  for (let y = chTop, row = 0; y < 14; y += 3, row += 1) {
    const lean = y < 0 ? 1 : 0; let x = chx + lean - (row % 2);
    while (x < chx + lean + 9) {
      const sw = 3 + Math.floor(rnd() * 3); const t = rnd() < 0.3 ? ['#a08074', '#c8a898', '#e8ccb8'] : [St[2], St[3], St[4]];
      for (let yy = 0; yy < 3; yy += 1) for (let xx = 0; xx < sw; xx += 1) {
        const X2 = x + xx; if (X2 < chx + lean || X2 >= chx + lean + 9) continue;
        b.set(X2, y + yy, yy === 2 || xx === sw - 1 ? t[0] : yy === 0 ? t[2] : t[1], 'chim');
      }
      x += sw;
    }
  }
  b.map((c, t, x) => (t === 'chim' && x >= chx + 7 ? mix(c, St[1], 0.4) : c));
  grid((x, y, c) => b.set(x, y, c, 'pot'), chx + 2, chTop - 4, ['.pPq.', 'pPPqq', '.pPq.', 'ppPqq'], { p: '#e08a5a', P: '#c86a42', q: '#9a4a3a' });

  // walls: whitewash, leaning a pixel, in shadow under the thatch (dithered), grubby at the foot
  const top = eave - 3;
  const wallL = (y) => 4 + (y < top + (h - top) * 0.45 ? 1 : 0);
  const wallR = (y) => w - 4 - (y < top + (h - top) * 0.6 ? 1 : 0);
  for (let y = top; y < h; y += 1) {
    for (let x = wallL(y); x < wallR(y); x += 1) {
      let c = WS[3];
      const n = vnoise(x + X, y + Y, 5, seed);
      if (n < 0.3 && bayer(x, y) < 0.5) c = WS[2];
      const sh = (top + 7 - y) / 6;
      if (bayer(x, y) < sh) c = sh > 0.6 ? WS[1] : WS[2];
      const foot = (y - (h - 9)) / 8;
      if (bayer(x, y) < foot * 0.8) c = mix(WS[2], Dt[2], 0.35);
      if (x >= wallR(y) - 2 && bayer(x, y) < 0.6) c = WS[2];
      b.set(x, y, c, 'wall');
    }
  }
  // plaster fallen off in a soft patch: bricks inside, a dark lip top-left, a light lip bottom-right
  const patch = (px0, py0, rw, rh) => {
    const inP = (x, y) => inEll(x, y, px0, py0, rw, rh) && vnoise(x, y, 2, seed) > 0.2;
    for (let y = Math.floor(py0 - rh - 1); y <= py0 + rh + 1; y += 1) {
      for (let x = Math.floor(px0 - rw - 1); x <= px0 + rw + 1; x += 1) {
        if (inP(x, y)) {
          const row = Math.floor(y / 2); const bx = (x + (row % 2) * 2) % 4;
          b.set(x, y, y % 2 === 1 ? WS[1] : bx === 3 ? WS[1] : (h2(Math.floor((x + (row % 2) * 2) / 4), row, seed) < 0.4 ? PB.brick[1] : PB.brick[2]), 'wall');
        } else if (inP(x + 1, y) || inP(x, y + 1)) b.set(x, y, WS[0], 'wall');
        else if (inP(x - 1, y) || inP(x, y - 1)) b.set(x, y, WS[4], 'wall');
      }
    }
  };
  patch(o.patchRight ? w - 16 : 15, h - 13, 4.5, 3);
  if (home) patch(16, top + 12, 3, 2);
  stoneRow(b, 3, h - 5, w - 6, 5, rnd);

  // the thatch: rounded, thick, with strands, layered courses and a shaggy hem
  const rw = w * 0.26; const hb = w / 2 + 4;
  const hem = (x) => eave + Math.round(Math.sin(x * 0.85) * 0.6 + (h2(x, 2, seed) < 0.35 ? 1 : 0));
  for (let y = 0; y <= eave + 1; y += 1) {
    const t = Math.min(1, y / eave);
    let half = rw + (hb - rw) * Math.pow(t, 0.6);
    if (y < 4) half -= (4 - y) ** 2 * 0.45;
    const x0 = Math.round(mid - half); const x1 = Math.round(mid + half);
    for (let x = x0; x < x1; x += 1) {
      if (y > hem(x)) continue;
      let k = 3;
      const side = (x + 0.5 - mid) / half;
      const hatch = h2(x, Math.floor((y + h2(x, 5, seed) * 5) / 3), seed + 11);
      if (hatch < (side - 0.1) * 0.9) k -= 1;
      else if (hatch < (-side - 0.3) * 1.1) k += 1;
      const strand = h2(x, Math.floor((y + h2(x, 1, seed) * 6) / 4), seed);
      if (strand < 0.22) k -= 1; else if (strand > 0.84) k += 1;
      const course = (y + Math.round(Math.sin(x / 4) * 0.8)) % 8;
      if (y > 6 && course === 0) k -= 1; else if (y > 6 && course === 1) k += 1;
      if (y >= hem(x) - 1) k = (x % 2 ? 1 : 2) + (x < mid ? 1 : 0);
      if (y === hem(x) - 2 && x % 3 === 0) k = 5;
      const yb = 4 + Math.round(Math.abs((((x + 300) % 6) - 3)) / 1.5);
      if (y >= 1 && y < yb) k = ((x + y) % 6 === 0 || (x - y + 600) % 6 === 0) ? 1 : (y === 1 ? 5 : 4);
      else if (y === yb) k = 2;
      b.set(x, y, Th[Math.max(0, Math.min(5, k))], 'thatch');
    }
  }
  // moss on the thatch, in clumps
  const clumps = [[w * (0.74 + rnd() * 0.1), eave - 6, 4.5, 2.2], [w * (0.55 + rnd() * 0.1), eave - 13, 2.6, 1.6], [w * (0.14 + rnd() * 0.08), eave - 4, 3, 1.6]];
  clumps.forEach(([cx, cy, rx, ry]) => b.fill(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) => {
    if (b.tag(x, y) !== 'thatch' || !inEll(x, y, cx, cy, rx, ry)) return null;
    return !inEll(x, y - 1, cx, cy, rx, ry) ? LF[4] : !inEll(x, y + 1, cx, cy, rx, ry) || !inEll(x + 1, y, cx, cy, rx, ry) ? LF[2] : LF[3];
  }, 'thatch'));

  // the door: round-topped, painted, with a big round knob and a little window
  const Dc = ramp(o.door || '#3e8e7e', 3, 2);
  const dw = home ? 16 : 14; const dh = Math.min(h - eave - 3, home ? 25 : 22); const dx = Math.round(mid - dw / 2); const dy = h - dh;
  const inD = (x, y, g = 0) => x >= dx - g && x < dx + dw + g && y < h && (y >= dy + dw / 2 || inEll(x, y, dx + dw / 2, dy + dw / 2, dw / 2 + g, dw / 2 + g));
  for (let y = dy - 3; y < h; y += 1) {
    for (let x = dx - 3; x < dx + dw + 3; x += 1) {
      if (inD(x, y)) {
        const pl = (x - dx) % 4;
        let c = pl === 0 ? Dc[2] : pl === 1 ? Dc[4] : Dc[3];
        if (x >= dx + dw - 2) c = pl === 0 ? Dc[1] : Dc[2];
        if (!inD(x, y - 1)) c = Dc[1];
        b.set(x, y, c, 'door');
      } else if (inD(x, y, 1)) b.set(x, y, Wd[1], 'door');
      else if (inD(x, y, 2)) b.set(x, y, (x < mid && y < dy + dw) || x < dx ? Wd[4] : Wd[2], 'wood');
    }
  }
  const kx = Math.round(mid) - 1; const ky = dy + Math.round(dh * 0.6);
  grid((x, y, c) => b.set(x, y, c, 'door'), kx + 3, ky - 1, ['.yY.', 'yYYo', '.oo.'], { y: '#fff0a0', Y: '#f0c030', o: '#a86a1a' });
  grid((x, y, c) => b.set(x, y, c, 'door'), kx - 2, dy + 3, ['.g.g.', 'gGgGg', '.gGg.', '..g..'], { g: PB.glow[2], G: PB.glow[3] });
  grid((x, y, c) => b.set(x, y, c, 'stone'), dx - 2, h, ['lmmmmmmmmmmmmmmmmmmmd'.slice(0, dw + 4), 'dddddddddddddddddddddd'.slice(0, dw + 4)], { l: St[5], m: St[4], d: St[2] });

  // windows: crooked, lit warm from inside, with thick wooden frames
  const winB = (x, y, ww, wh2, opt = {}) => {
    b.rect(x - 1, y - 2, ww + 2, 2, Wd[3], 'wood'); b.rect(x - 1, y - 2, ww + 2, 1, Wd[4], 'wood');
    b.rect(x, y, ww, wh2, Wd[2], 'wood');
    for (let yy = 1; yy < wh2 - 1; yy += 1) {
      for (let xx = 1; xx < ww - 1; xx += 1) {
        const mx = Math.floor(ww / 2); const my = Math.floor(wh2 / 2);
        let c = yy < my ? PB.glow[3] : PB.glow[2];
        if (xx + yy < 4) c = PB.glow[4];
        if (yy === wh2 - 2 || xx === ww - 2) c = PB.glow[1];
        if (xx === mx || yy === my) c = Wd[3];
        b.set(x + xx, y + yy, c, 'glass');
      }
    }
    b.rect(x - 1, y + wh2, ww + 2, 1, Wd[4], 'wood'); b.rect(x - 1, y + wh2 + 1, ww + 2, 1, Wd[1], 'wood');
    if (opt.cat) grid((xx, yy, c) => b.set(xx, yy, c, 'fur'), x + 1, y + wh2 - 6, ['K...K.', 'KgKgK.', 'KgggK.', 'KwgwgK', 'KgggggK'], { K: '#4a3e52', g: '#8a8296', w: '#f6f0fa' });
    if (opt.pot) grid((xx, yy, c) => b.set(xx, yy, c, 'leaf'), x + ww - 6, y + wh2 - 5, ['.r.r.', 'rLrLr', '.LLL.', '.PPP.', '.ppp.'], { r: FL.rose[1], L: LF[3], P: '#e08a5a', p: '#b05a3a' });
    if (opt.box) {
      const by = y + wh2 + 2;
      b.rect(x - 1, by, ww + 2, 3, Wd[3], 'wood'); b.rect(x - 1, by, ww + 2, 1, Wd[4], 'wood');
      for (let xx = x - 1; xx < x + ww + 1; xx += 1) {
        const f = (xx * 3 + seed) % 5;
        b.set(xx, by - 1, LF[3], 'leaf');
        if (f < 3) b.set(xx, by - 2, f === 0 ? FL[opt.box][2] : FL[opt.box][1], 'fl');
        if (f === 1) b.set(xx, by - 3, FL[opt.box][1], 'fl');
        if (f === 3) b.set(xx, by + 3, LF[2], 'leaf');
      }
    }
  };
  const gap = (w - dw) / 2;
  const wy = top + 9;
  const boxes = o.boxes || ['rose', 'yellow'];
  winB(Math.round(gap / 2) - 3, wy, 12, 11, { cat: o.cat === 'left', pot: o.cat === 'right', box: boxes[0] });
  winB(Math.round(w - gap / 2) - 7, wy - 1 + (home ? 0 : 1), 11, 11, { cat: o.cat === 'right', pot: o.cat !== 'right', box: boxes[1] });

  // hollyhocks by a corner, a climbing rose up the other
  (o.holly || []).forEach(([x, hgt, col]) => hollyhock((xx, yy, c, t) => b.set(xx, yy, c, t), x < 0 ? w + x : x, h, hgt, col));
  if (o.rose !== false) {
    const rx0 = o.rose === 'left' ? 6 : w - 6;
    for (let y = h - 1; y > top + 3; y -= 1) {
      const x = rx0 + Math.round(Math.sin(y / 3) * 1.2);
      b.set(x, y, LF[2], 'leaf'); b.set(x + 1, y, LF[3], 'leaf');
      if (y % 3 === 0) { b.set(x - 1, y, LF[3], 'leaf'); b.set(x + 2, y, LF[1], 'leaf'); }
      if (y % 5 === 1) { b.set(x - 1, y - 1, FL.pink[1], 'fl'); b.set(x, y - 1, FL.pink[2], 'fl'); b.set(x - 1, y, FL.pink[0], 'fl'); }
    }
  }

  if (home) {
    // an eyebrow window in the thatch
    const ex = Math.round(w * 0.3); const ey = eave - 16;
    for (let y = ey - 5; y < ey + 8; y += 1) for (let x = ex - 9; x < ex + 10; x += 1) {
      if (!inEll(x, y, ex + 0.5, ey + 4, 9.5, 9) || y > ey + 5) continue;
      if (inEll(x, y, ex + 0.5, ey + 4, 6, 6)) continue;
      b.set(x, y, inEll(x, y, ex + 0.5, ey + 4, 7.5, 7.5) ? Th[1] : ((x + y) % 3 ? Th[4] : Th[3]), 'thatch');
    }
    b.fill(ex - 5, ey - 1, 12, 8, (x, y) => (inEll(x, y, ex + 0.5, ey + 4, 6, 6) && y < ey + 6 ? (y >= ey + 5 ? Wd[2] : x === ex || y === ey + 2 ? Wd[3] : (y < ey + 2 ? PB.glow[3] : PB.glow[2])) : null), 'glass');
    // a heart-shaped sign over the door
    grid((x, y, c) => b.set(x, y, c, 'wood'), Math.round(mid) - 4, dy - 9, ['.ll.ll.', 'lHHlHHl', 'lhHHHHl', '.lHHHl.', '..lHl..', '...l...'], { l: Wd[2], H: '#ff6a8a', h: '#ffc0d0' });
  }
  if (o.sign === 'note') {
    // a painted board with a music note: this is the music hall
    grid((x, y, c) => b.set(x, y, c, 'wood'), Math.round(mid) - 7, dy - 15, [
      '.LLLLLLLLLLLL.',
      'LllllllllllldD',
      'LlccccKKcccccD',
      'LlccccKKKccccD',
      'LlccccKcKKcccD',
      'LlccccKccKcccD',
      'LlccccKcccccdD',
      'LlcKKKKcccccdD',
      'LlKKKKKcccccdD',
      'LlcKKKccccccdD',
      'LddddddddddddD',
      '.DDDDDDDDDDDD.',
    ], { L: Wd[4], D: Wd[1], l: '#fffbe8', c: '#fff0c8', d: '#e8d0a0', K: '#5a3a8a' });
  }

  b.outline(selective);
  b.soften((c) => mix(c, Th[1], 0.45), ['thatch']);
  if (o.bird) grid((x, y, c) => b.set(x, y, c, 'bird'), Math.round(mid - rw * 0.4), -4, ['.dd..', 'dbwd.', 'dbbbd', '.dyd.'], { d: '#2a4a8a', b: '#6ea0f0', w: '#ffffff', y: '#f0a030' });
  b.blit(px, X, Y);
  if (o.smoke !== false) smokeB(px, X + chx + 4, Y + chTop - 4);
  // a round doormat, and grass at the foot of the walls
  const mx = Math.round(mid);
  for (let yy = 0; yy < 3; yy += 1) for (let xx = -5; xx <= 5; xx += 1) if (inEll(xx, yy, 0.5, 1.5, 5.5, 1.6)) px(X + mx + xx, Y + h + 2 + yy, yy === 1 && Math.abs(xx) < 3 ? '#f0c060' : (xx + yy) % 2 ? '#c8783a' : '#a85a32');
  for (let x = 2; x < w - 2; x += 1) if (h2(x, seed, 4) < 0.12 && (x < dx - 4 || x > dx + dw + 4)) tuft(px, X + x, Y + h - 1, Math.floor(h2(x, 1, seed) * 6));
}

// ---------- props ----------

/** A rustic split-rail fence: crooked posts, two sagging rails with bark, a robin on a rail. */
function railFenceB(px, X, Y, w, seed = 52) {
  const rnd = rng(seed);
  for (let x = 1; x < w; x += 1) px(X + x, Y + 14, 'rgba(59,34,53,0.16)');
  propB(px, X, Y, w, 15, (b) => {
    const posts = []; for (let x = 0; x < w - 2; x += 15 + Math.floor(rnd() * 3)) posts.push(x);
    posts.push(w - 3);
    for (const ry of [4, 9]) {
      for (let i = 1; i < posts.length; i += 1) {
        const a = posts[i - 1]; const c = posts[i];
        for (let x = a; x < c + 3; x += 1) {
          const sag = Math.round(Math.sin(((x - a) / (c - a + 3)) * Math.PI) * (ry === 4 ? 1 : 0.6));
          b.set(x, ry + sag, h2(x, ry, seed) < 0.15 ? Wd[3] : Wd[4], 'wood'); b.set(x, ry + sag + 1, h2(x, ry + 1, seed) < 0.2 ? Wd[1] : Wd[2], 'wood');
          if (h2(x, ry, 9) < 0.08) b.set(x, ry + sag, Wd[5], 'wood');
        }
      }
    }
    posts.forEach((x, i) => {
      const lean = i % 3 === 1 ? 1 : 0; const top = h2(i, 3, seed) < 0.5 ? 0 : 1;
      for (let y = top; y < 15; y += 1) {
        const lx = x + (y < 6 ? lean : 0);
        b.set(lx, y, Wd[3], 'wood'); b.set(lx + 1, y, Wd[2], 'wood'); b.set(lx + 2, y, Wd[1], 'wood');
        if (y === top) { b.set(lx, y, Wd[5], 'wood'); b.set(lx + 1, y, Wd[4], 'wood'); b.set(lx + 2, y, Wd[3], 'wood'); }
      }
      if (h2(i, 7, seed) < 0.5) b.set(x + 1, 8, Wd[0], 'wood');
    });
  }, {
    after: (b, put) => {
      grid(put('bird'), 7, 0, ['.dd..', 'dowd.', 'dooodd', '.dyd..'], { d: '#7a3a2a', o: '#e0603a', w: '#ffffff', y: '#3a2a3a' });
      for (let y = 14; y > 5; y -= 1) b.set(w - 3 + ((y % 4) < 2 ? -1 : 0), y, LF[3], 'leaf');
      b.set(w - 5, 7, FL.pink[1]); b.set(w - 4, 7, FL.pink[2]); b.set(w - 2, 11, LF[4]);
    },
  });
  for (let x = 2; x < w; x += 6) if (h2(x, seed, 3) < 0.6) tuft(px, X + x, Y + 13, Math.floor(h2(x, 2, seed) * 6));
}

/** The well, 26 x 30: a round stone well under a little thatched roof, a bucket on the rim, a frog, ferns. */
export function wellB(px, X, Y, seed = 62) {
  const rnd = rng(seed);
  groundShadow(px, X + 14, Y + 29, 13, 2.6, 0.2);
  propB(px, X, Y, 26, 30, (b, put) => {
    for (const x of [3, 20]) { b.rect(x, 6, 3, 14, Wd[3], 'wood'); b.rect(x, 6, 1, 14, Wd[4], 'wood'); b.rect(x + 2, 6, 1, 14, Wd[2], 'wood'); }
    b.rect(6, 10, 14, 2, Wd[2], 'wood'); b.rect(6, 10, 14, 1, Wd[3], 'wood');
    b.rect(10, 9, 6, 4, '#d8b478', 'straw'); b.rect(10, 9, 6, 1, '#f0d49a', 'straw'); for (let x = 10; x < 16; x += 2) b.set(x, 11, '#a88050', 'straw');
    b.rect(23, 10, 2, 1, Wd[2], 'wood'); b.rect(24, 11, 1, 3, Wd[2], 'wood');
    for (let y = 0; y < 9; y += 1) {
      const half = 6 + Math.pow(y / 8, 0.6) * 9 - (y < 2 ? (2 - y) * 1.5 : 0); const x0 = Math.round(13 - half); const x1 = Math.round(13 + half);
      for (let x = x0; x < x1; x += 1) {
        if (y === 8 && x % 2) continue;
        let k = 3; if (x < 9) k += 1; if (x > 18) k -= 1;
        const s = h2(x, Math.floor(y / 3), seed); if (s < 0.25) k -= 1; else if (s > 0.85) k += 1;
        if (y === 1) k = 5; if (y >= 7) k = x % 2 ? 1 : 2;
        b.set(x, y, T[Math.max(0, Math.min(5, k))], 'thatch');
      }
    }
    b.fill(0, 16, 26, 14, (x, y) => (y >= 19 || inEll(x, y, 13, 19.5, 13, 3.6) ? St[3] : null), 'stone');
    const seeds = []; for (let row = 0; row < 3; row += 1) for (let x = row % 2 ? -1 : 1; x < 28; x += 5 + Math.floor(rnd() * 2)) seeds.push([x + rnd() * 1.5, 21.5 + row * 3]);
    const cell = stones(seeds, 1, 1.3);
    b.fill(0, 20, 26, 10, (x, y) => {
      if (!b.get(x, y)) return null;
      const c = cell(x, y); const dn = cell(x, y + 1); const up = cell(x, y - 1);
      const t = h2(c.k, 1, seed) < 0.25 ? ['#a08074', '#c8a898', '#e8ccb8'] : [St[2], St[3], St[4]];
      const curve = x < 4 || x > 22 ? -1 : 0;
      if (c.gap < 0.85) return St[1];
      if (dn.k !== c.k || dn.gap < 0.85) return t[0];
      if (up.k !== c.k || up.gap < 0.85) return t[2 + curve];
      return x > 19 ? t[0] : t[1];
    }, 'stone');
    b.fill(0, 16, 26, 5, (x, y) => (inEll(x, y, 13, 19.5, 13, 3.6) ? (inEll(x, y, 13, 19.8, 10, 2.2) ? (y < 19 ? '#1e3a5a' : '#3a78b0') : (y < 19 ? St[5] : St[4])) : null), 'stone');
    b.set(8, 19, '#a8d8f8'); b.set(9, 19, '#a8d8f8');
    for (let x = 0; x < 9; x += 1) { b.set(x, 20 + (x % 3 === 0 ? 1 : 0), LF[3], 'leaf'); if (x % 2) b.set(x, 21 + (x % 3 === 0 ? 1 : 0), LF[2], 'leaf'); }
  }, {
    after: (b, put) => {
      grid(put('wood'), 17, 13, ['.KKKKK.', 'KwWWWdK', 'KMMMMMK', 'KwWWWdK', '.KKKKK.'], { K: Wd[0], w: Wd[4], W: Wd[3], d: Wd[2], M: '#6e6a86' });
      grid(put('frog'), 4, 14, ['.KK...KK.', 'KweK.KewK', 'KGGKKKGGK', 'KGGGGGGGK', 'KGgggggGK', '.KKKKKKK.'], { K: '#2f5a2a', w: '#ffffff', e: '#2a2438', G: '#6cc05a', g: '#c8ec98' });
    },
  });
  const fern = (x, y, dir) => { for (let i = 0; i < 6; i += 1) { px(x + i * dir, y - Math.round(i * 0.7) + (i > 3 ? 1 : 0), LF[2]); if (i % 2) px(x + i * dir, y - Math.round(i * 0.7) - 1, LF[4]); } };
  fern(X + 2, Y + 30, -1); fern(X + 24, Y + 30, 1); fern(X + 4, Y + 31, 1);
}

/** The vegetable garden, w x h: a raised bed of plank sides, rows of carrots, lettuces, cabbages and pumpkins, a watering can; a split-rail fence in front. */
function gardenB(px, X, Y, w, h, seed = 91) {
  groundShadow(px, X + w / 2 + 2, Y + h, w / 2 + 2, 2.5, 0.18);
  const soil = ['#5a3438', '#7a4a3e', '#94603e', '#aa7450', '#c48c60'];
  propB(px, X, Y, w, h, (b) => {
    // the bed's sides: a plank rim on top, the front face showing
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const rim = x < 2 || x >= w - 2 || y < 2;
        const front = y >= h - 4;
        if (front) b.set(x, y, y === h - 4 ? Wd[4] : (x % 16 === 15 ? Wd[1] : y === h - 1 ? Wd[2] : Wd[3]), 'wood');
        else if (rim) b.set(x, y, y === 0 || x === 0 ? Wd[4] : x === w - 1 ? Wd[2] : Wd[3], 'wood');
        else {
          // furrows: a lit ridge, then shade
          const r = (y - 2) % 9;
          let c = r < 2 ? soil[3] : r < 5 ? soil[2] : r < 7 ? soil[1] : soil[0];
          if (r === 0 && h2(x, y, seed) < 0.3) c = soil[4];
          if (r >= 2 && r < 5 && h2(x, y, seed + 1) < 0.08) c = soil[3];
          b.set(x, y, c, 'dirt');
        }
      }
    }
  }, {
    after: (b) => {
      const put = (x, y, c) => b.set(x, y, c, 'leaf');
      const rows = Math.floor((h - 6) / 9);
      for (let r = 0; r < rows; r += 1) {
        const ry = 2 + r * 9 + 4; // the foot of the ridge the row grows on
        const kind = ['carrot', 'lettuce', 'cabbage', 'pumpkin'][r % 4];
        for (let x = 4; x < w - 6; x += kind === 'carrot' ? 5 : 8) {
          const jx = x + (h2(x, r, seed) < 0.5 ? 0 : 1);
          if (kind === 'carrot') grid(put, jx, ry - 3, ['l.l', '.L.', 'lLl', '.o.'], { l: LF[4], L: LF[3], o: '#f08c3a' });
          else if (kind === 'lettuce') grid(put, jx, ry - 3, ['.lll.', 'lLlLl', 'LLLLd', '.ddd.'], { l: '#c8ec8c', L: LF[4], d: LF[3] });
          else if (kind === 'cabbage') grid(put, jx, ry - 3, ['.lLl.', 'lCCCL', 'CCcCd', '.ddd.'], { l: '#b8e0c8', L: '#8cc4a8', C: '#6aa890', c: '#a8dcc0', d: '#4a8070' });
          else grid(put, jx, ry - 3, ['..s..', '.oOo.', 'oOooo', 'ooood', '.ddd.'], { s: LF[2], o: '#f08c3a', O: '#ffc47a', d: '#c0581e' });
          if (kind === 'pumpkin') { put(jx + 5, ry, LF[3]); put(jx + 6, ry - 1, LF[2]); put(jx + 7, ry - 1, LF[4]); }
        }
      }
      // a watering can on the rim
      grid((x, y, c) => b.set(x, y, c, 'metal'), w - 13, h - 10, ['.mmm....', 'mMMMm..m', 'mMllm.m.', 'mMMMmm..', 'mdddm...', '.ddd....'], { m: '#5a6a8a', M: '#8aa0c0', l: '#c0d4e8', d: '#4a5878' });
    },
  });
  railFenceB(px, X - 2, Y + h + 2, w + 4);
}

/** Barty's stall, 44 x 33: a scalloped striped awning, clothes hanging inside, a sign with a shirt on it, folded shirts and a cap on the counter. */
function stallB(px, X, Y) {
  groundShadow(px, X + 23, Y + 31, 22, 2.4, 0.2);
  const R = ['#9a2a3c', '#c8404a', '#e8645a', '#ff9a86']; const C = ['#c8a890', '#ecdcc8', '#fff4e4', '#ffffff'];
  propB(px, X, Y, 44, 33, (b, put) => {
    // the shade inside the stall, and a rail of clothes
    b.fill(5, 9, 34, 12, (x, y) => (y < 11 ? '#4a2a3a' : bayer(x, y) < 0.5 ? '#6a4048' : '#5a3644'), 'wood');
    b.rect(5, 11, 34, 1, Wd[3], 'wood');
    grid(put('cloth'), 7, 12, ['.gG.gg.', 'gGGgggd', 'g.ggg.d', '..ggd..', '..ggd..', '..gdd..'], { g: '#46b070', G: '#8ad89a', d: '#2f8050' });
    grid(put('cloth'), 31, 12, ['..p..', '.pPp.', '.pPp.', 'pppPp', 'ppppp', 'pdddp'], { p: '#f07aa8', P: '#ffb8d0', d: '#c04a80' });
    // posts
    for (const x of [2, 39]) { b.rect(x, 8, 1, 23, Wd[4], 'wood'); b.rect(x + 1, 8, 1, 23, Wd[3], 'wood'); b.rect(x + 2, 8, 1, 23, Wd[2], 'wood'); }
    // the counter: a lit top, a striped cloth along the front, planks below
    b.rect(1, 20, 42, 1, Wd[5], 'wood'); b.rect(1, 21, 42, 1, Wd[4], 'wood');
    for (let x = 1; x < 43; x += 1) {
      for (let y = 22; y < 30; y += 1) {
        let c = (x - 1) % 6 === 5 ? Wd[2] : Wd[3];
        if (y === 29) c = Wd[1];
        if (y < 25) c = Math.floor((x - 1) / 3) % 2 ? '#2f8a7a' : '#46a890';
        if (y === 25 && (x % 3 === 1)) c = '#2f8a7a';
        b.set(x, y, c, y < 26 ? 'cloth' : 'wood');
      }
    }
    // the awning: stripes, lit along the top roll, a scalloped hem
    for (let y = 0; y < 11; y += 1) {
      for (let x = 0; x < 44; x += 1) {
        const s = Math.floor(x / 6) % 2; const P = s ? C : R; const sx = x % 6;
        if (y === 0 && (x === 0 || x === 43)) continue;
        if (y >= 8) { // scallops: each stripe ends in a round tongue
          const dx = Math.abs(sx + 0.5 - 3);
          if (y === 8 && dx > 3) continue;
          if (y === 9 && dx > 2.5) continue;
          if (y === 10 && dx > 1.5) continue;
          b.set(x, y, y === 10 || sx === 5 ? P[0] : P[1], s ? 'awnC' : 'awnR');
          continue;
        }
        let c = y < 2 ? P[3] : y < 4 ? P[2] : P[2];
        if (y >= 4 && sx === 5) c = P[1];
        if (y === 7) c = P[1];
        if (x > 37 && y >= 2) c = P[1];
        b.set(x, y, c, s ? 'awnC' : 'awnR');
      }
    }
  }, {
    after: (b, put) => {
      // the sign: a wooden board hanging from the awning, a big blue shirt painted on it
      grid(put('wood'), 15, 10, [
        '.s..........s.',
        'LLLLLLLLLLLLLD',
        'LccBBBccBBBccD',
        'LcBbbbBBbbbBcD',
        'LcbbbbbbbbbbcD',
        'LcccbbbbbbcccD',
        'LcccbbbbbbcccD',
        'LcccbbbbbbcccD',
        'LccccccccccccD',
        'DDDDDDDDDDDDDD',
      ], { s: '#5a4040', L: Wd[4], D: Wd[1], c: '#fff4d8', B: '#8cb8ff', b: '#3a78e8' });
      // folded shirts and a cap on the counter
      grid(put('cloth'), 4, 16, ['.yyyyy.', 'YYYYYYy', 'gggggg.', 'GGGGGGg'], { y: '#ffe070', Y: '#f0b830', g: '#7ad070', G: '#46a050' });
      grid(put('cloth'), 31, 17, ['..rrr..', '.rRRrr.', 'rrrrrrrr'], { r: '#e04a4a', R: '#ff8a8a' });
      b.set(38, 19, '#c03030', 'cloth');
    },
  });
}

/** The laundry line: two T posts, a sagging rope, shirts and socks pegged on it. */
function laundryB(px, X, Y, w) {
  const sag = (x) => Math.round(Math.sin(((x - X) / (w - 6)) * Math.PI) * 3);
  groundShadow(px, X + 2, Y + 26, 4, 1.3, 0.2); groundShadow(px, X + w - 2, Y + 26, 4, 1.3, 0.2);
  for (const x of [X, X + w - 4]) {
    propB(px, x - 3, Y, 10, 27, (b) => {
      b.rect(4, 2, 1, 25, Wd[4], 'wood'); b.rect(5, 2, 1, 25, Wd[3], 'wood'); b.rect(6, 2, 1, 25, Wd[2], 'wood');
      b.rect(1, 0, 9, 1, Wd[4], 'wood'); b.rect(1, 1, 9, 1, Wd[3], 'wood'); b.rect(1, 2, 9, 1, Wd[2], 'wood');
    });
  }
  for (let x = X + 4; x < X + w - 4; x += 1) { px(x, Y + 3 + sag(x), '#efe2c8'); px(x, Y + 4 + sag(x), '#a8907a'); }
  const clothes = [['#ff6b6b', 'shirt'], ['#4dabf7', 'sock'], ['#ffd43b', 'shirt'], ['#69db7c', 'sock'], ['#b197fc', 'shirt'], ['#ff8fab', 'sock']];
  let x = X + 8;
  clothes.forEach(([col, kind], i) => {
    if (x > X + w - 14) return;
    const y = Y + 4 + sag(x);
    const P = ramp(col, 2, 2);
    if (kind === 'shirt') {
      propB(px, x - 3, y, 16, 11, (b) => {
        grid((xx, yy, c) => b.set(xx, yy, c, 'cloth'), 0, 0, [
          '..mlllllmm...',
          'mlllmmmmmmmd.',
          'llmmmmmmmmmdd',
          '.d.mmmmmmmd.d',
          '...mmmmmmmd..',
          '...mmmmmmmd..',
          '...mmmmmmmd..',
          '...mmmmmmdd..',
          '...dddddddd..',
        ], { l: P[3], m: P[2], d: P[1] });
        if (i === 2) for (let yy = 3; yy < 8; yy += 2) for (let xx = 4; xx < 10; xx += 1) b.set(xx, yy, P[3], 'cloth');
      }, { outline: (t, side) => (side === 'top' ? null : side === 'bottom' || side === 'right' ? P[0] : mix(P[0], P[1], 0.5)) });
      px(x + 1, y - 1, Wd[4]); px(x + 1, y, Wd[3]); px(x + 7, y - 1, Wd[4]); px(x + 7, y, Wd[3]); // pegs
      x += 15;
    } else {
      propB(px, x - 1, y, 8, 10, (b) => {
        grid((xx, yy, c) => b.set(xx, yy, c, 'cloth'), 0, 0, ['wwww..', 'lmmd..', 'lmmd..', 'lmmd..', 'lmmd..', 'lmmmmd', 'mmmmmd', '.dddd.'], { w: '#ffffff', l: P[3], m: P[2], d: P[1] });
      }, { outline: (t, side) => (side === 'top' ? null : side === 'bottom' || side === 'right' ? P[0] : mix(P[0], P[1], 0.5)) });
      px(x + 1, y - 1, Wd[4]); px(x + 1, y, Wd[3]);
      x += 10;
    }
  });
}

/** A lantern hung from a shepherd's crook, 16 x 34, with a moth. */
export function lanternB(px, X, Y) {
  groundShadow(px, X + 5, Y + 33, 4, 1.4, 0.2);
  propB(px, X, Y, 16, 34, (b, put) => {
    for (let y = 6; y < 34; y += 1) { b.set(3, y, Wd[3], 'wood'); b.set(4, y, Wd[2], 'wood'); }
    [[3, 5], [3, 4], [4, 3], [4, 2], [5, 1], [6, 1], [7, 1], [8, 1], [9, 2], [10, 2], [10, 3], [11, 4]].forEach(([x, y]) => { b.set(x, y, Wd[3], 'wood'); b.set(x, y + 1, Wd[2], 'wood'); });
    b.set(5, 0, Wd[4], 'wood'); b.set(6, 0, Wd[4], 'wood'); b.set(7, 0, Wd[4], 'wood');
    b.set(11, 6, '#4a4a5a', 'metal'); b.set(11, 7, '#4a4a5a', 'metal');
    grid(put('metal'), 8, 8, ['..mmm..', '.mMMMm.', 'm.lyl.m', 'm.yYy.m', 'm.oyo.m', '.mmmmm.', '...m...'], { m: '#4a4a5a', M: '#6e6a86', l: PB.glow[4], y: PB.glow[3], Y: PB.glow[4], o: PB.glow[2] });
    for (let y = 10; y < 13; y += 1) { b.set(9, y, PB.glow[3], 'glass'); b.set(13, y, PB.glow[2], 'glass'); }
  });
  grid(px, X + 14, Y + 6, ['w.w', '.d.'], { w: '#f6f0ff', d: '#8a7a9a' });
  tuft(px, X + 2, Y + 33, 4);
}

/** A scarecrow, 22 x 32: a burlap face with a stitched smile, a patched coat, straw, a crow on his arm. */
export function scarecrowB(px, X, Y) {
  groundShadow(px, X + 11, Y + 31, 5, 1.5, 0.2);
  propB(px, X, Y, 22, 32, (b, put) => {
    b.rect(10, 8, 2, 24, Wd[3], 'wood'); b.rect(11, 8, 1, 24, Wd[2], 'wood');
    b.rect(1, 13, 20, 2, Wd[3], 'wood'); b.rect(1, 14, 20, 1, Wd[2], 'wood');
    grid(put('cloth'), 3, 11, [
      '.ss.cccccccccc.ss.',
      'sSsscCCccCCccssSs.',
      '.ss.cCpPcCCcc.ss..',
      '....cCPPcCCcc.....',
      '....cCCccCCcc.....',
      '....cCCcbbCcc.....',
      '....cCCcbbCcc.....',
      '.....cccccccc.....',
      '......s.s..s......',
    ], { c: '#3e6ab0', C: '#5a8ad0', p: '#e0546a', P: '#ff9a9a', b: '#f0c040', s: '#f0d070', S: '#c89a40' });
    grid(put('cloth'), 6, 0, ['...hhhh...', '..hHHHHh..', 'hhhhhhhhhh', '.ffffffff.', '.fefffeff.', '.ffffffff.', '.fmfmfmff.', '..ffffff..', '...ss.s...'], { h: '#a8663e', H: '#cc8a50', f: '#e8c890', e: '#3b2235', m: '#a8663e', s: '#f0d070' });
    b.set(8, 5, '#f0a0a0'); b.set(14, 5, '#f0a0a0');
  }, {
    after: (b, put) => grid(put('bird'), 15, 8, ['.kk..', 'kkwk.', 'kkkkyy', '.kk...', '.k.k..'], { k: '#2a2438', w: '#ffffff', y: '#f0a030' }),
  });
}

/** A wheelbarrow of pumpkins and flowers, 26 x 16. */
export function barrowB(px, X, Y) {
  groundShadow(px, X + 13, Y + 15, 11, 1.6, 0.2);
  propB(px, X, Y, 26, 16, (b, put) => {
    b.fill(3, 6, 18, 7, (x, y) => { const yy = y - 6; if (x < 3 + yy * 0.6 || x > 20 - yy * 0.3) return null; return yy === 0 ? Wd[4] : yy % 3 === 0 ? Wd[2] : Wd[3]; }, 'wood');
    b.rect(19, 9, 6, 1, Wd[2], 'wood'); b.rect(22, 9, 3, 1, Wd[3], 'wood');
    grid(put('wood'), 1, 10, ['.mm.', 'mMMm', 'mM.m', 'mMMm', '.mm.'], { m: '#4a4a5a', M: '#8a86a0' });
    b.rect(14, 13, 1, 3, Wd[2], 'wood');
    grid(put('fl'), 5, 0, ['....g..........', '..ooOoo..yY.r..', '.oOOoOoo.gyy.rR', '.oooooooggLgg..', '..oooooo.......'], { o: '#f08c3a', O: '#ffc47a', g: LF[3], L: LF[4], y: FL.yellow[1], Y: FL.yellow[2], r: FL.rose[1], R: FL.rose[2] });
  });
}

/** A birdhouse on a pole, 12 x 30, with a bird peeking out. */
export function birdhouseB(px, X, Y) {
  groundShadow(px, X + 6, Y + 29, 4, 1.4, 0.2);
  propB(px, X, Y, 12, 30, (b, put) => {
    b.rect(5, 14, 2, 16, Wd[3], 'wood'); b.rect(6, 14, 1, 16, Wd[2], 'wood');
    grid(put('wood'), 0, 0, [
      '.....rr.....', '....rRRr....', '...rRRrrr...', '..rRRrrrrr..', '.rRRrrrrrrr.', 'rrrrrrrrrrrr', '.wwwwwwwwdd.',
      '.wwwKKKwwdd.', '.wwKbbbKwdd.', '.wwKbewKwdd.', '.wwwKKKwwdd.', '.wwwwwwwwdd.', '.wwwwPwwwdd.', '.dddddddddd.',
    ], { r: '#c8463c', R: '#f07a5a', w: '#f4d6a0', d: '#c89a6a', K: '#3b2235', b: '#6ea0f0', e: '#3b2235', P: Wd[2] });
    b.set(5, 9, '#ffffff');
  });
}

/** A red mailbox on a post, 12 x 20, its flag up and a letter peeking out. */
export function mailboxB(px, X, Y) {
  groundShadow(px, X + 6, Y + 19, 4, 1.3, 0.2);
  const M = ramp('#d8443a', 2, 2);
  propB(px, X, Y, 12, 20, (b) => {
    for (let y = 9; y < 20; y += 1) { b.set(4, y, Wd[4], 'wood'); b.set(5, y, Wd[3], 'wood'); b.set(6, y, Wd[2], 'wood'); }
    b.rect(2, 9, 8, 1, Wd[2], 'wood');
    for (let y = 1; y < 9; y += 1) {
      const x0 = y === 1 ? 3 : y === 2 ? 2 : 1; const x1 = y === 1 ? 8 : y === 2 ? 9 : 10;
      for (let x = x0; x < x1; x += 1) b.set(x, y, y <= 2 || x === x0 ? M[3] : x >= x1 - 2 || y === 8 ? M[1] : M[2], 'mail');
    }
    for (let y = 3; y < 8; y += 1) b.set(2, y, M[1], 'mail'); // the door's seam
    b.rect(10, 2, 1, 6, St[2], 'metal'); b.rect(10, 1, 2, 2, '#ffd23f', 'metal');
  }, { after: (b) => { b.set(0, 4, '#ffffff'); b.set(0, 5, '#e8e2f0'); b.set(1, 4, '#ffffff'); } });
}

/** Mushrooms in a little fairy ring, 14 x 9 (flat: walked past, not round). */
export function mushroomsB(px, X, Y) {
  propB(px, X, Y, 14, 9, (b, put) => {
    grid(put('cloth'), 0, 2, ['.rRr.', 'rwrrr', 'rrrwr', '.sSs.', '..s..', '..s..'], { r: '#e0546a', R: '#ff9a9a', w: '#fff6ea', s: '#f6e8c8', S: '#d8c8a8' });
    grid(put('cloth'), 6, 0, ['..rrR..', '.rwrrrr', 'rrrrrwr', '.dsSsd.', '...s...', '...s...', '...s...', '...s...'], { r: '#e0546a', R: '#ff9a9a', w: '#fff6ea', s: '#f6e8c8', S: '#d8c8a8', d: '#c03a50' });
    grid(put('cloth'), 11, 5, ['.bb', 'bBb', '.s.', '.s.'], { b: '#c08a5a', B: '#f0c890', s: '#f6e8c8' });
  });
}
/** A snail, 9 x 6 (flat). */
export function snailB(px, X, Y) {
  propB(px, X, Y, 9, 6, (b, put) => grid(put('shell'), 0, 0, ['..ooo....', '.oOsoo...', '.osSso..e', '.oossoo.b', 'bbbbbbbbb'], { o: '#d08a3a', O: '#ffd08a', s: '#8a4a2a', S: '#ffd08a', b: '#c8c8a0', e: '#3b2235' }));
}
const butterflyB = (px, X, Y, c) => grid(px, X, Y, ['a.a', 'bkb', 'a.a'], { k: '#3b2235', a: c[0], b: c[1] });

/** A low bench, 24 x 12: a split log on two stumps. */
export function benchB(px, X, Y) {
  groundShadow(px, X + 12, Y + 11, 11, 1.5, 0.18);
  propB(px, X, Y, 24, 12, (b) => {
    b.rect(0, 3, 24, 3, Wd[4], 'wood'); b.rect(0, 3, 24, 1, Wd[5], 'wood'); b.rect(0, 6, 24, 1, Wd[2], 'wood');
    for (let x = 2; x < 22; x += 5) b.set(x, 4, Wd[3], 'wood');
    grid((x, y, c) => b.set(x, y, c, 'wood'), 0, 2, ['ww', 'wR', 'wr', 'wr'], { w: Wd[5], R: Wd[3], r: Wd[2] });
    for (const x of [3, 17]) { b.rect(x, 7, 4, 5, Wd[3], 'wood'); b.rect(x, 7, 1, 5, Wd[4], 'wood'); b.rect(x + 3, 7, 1, 5, Wd[1], 'wood'); }
  });
}

/** A clump of wildflowers, 16 x 12 (flat): a leafy mound with flowers of a few kinds on top. */
function flowersB(px, X, Y, seed) {
  groundShadow(px, X + 8, Y + 11, 8, 1.6, 0.14);
  for (let y = 4; y < 12; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      if (!inEll(x, y, 8, 8.5, 8, 3.8)) continue;
      const s = (x - 8) / 8 + (y - 8.5) / 3.8;
      px(X + x, Y + y, !inEll(x, y + 1, 8, 8.5, 8, 3.8) ? LF[1] : s < -0.5 ? LF[4] : s > 0.6 ? LF[2] : LF[3]);
    }
  }
  const sets = [[['daisy', 'white'], ['cup', 'yellow']], [['forget', 'blue'], ['daisy', 'pink']], [['cup', 'orange'], ['daisy', 'white']], [['forget', 'lilac'], ['cup', 'yellow']]];
  const set = sets[seed % sets.length];
  [[3, 5], [7, 3], [12, 5], [5, 8], [10, 7], [14, 9], [1, 9], [8, 6]].forEach(([x, y], i) => { const [k, c] = set[i % 2]; flowerB(px, X + x, Y + y, k, c); });
}

/**
 * Redraws today's art (drawn by draw(px)) with selective outlines: every dark outline pixel
 * becomes a darker shade of the color it borders, lighter on the lit top-left, with the ink
 * line kept under the thing where it meets the ground. Shadows (rgba) pass straight through.
 * recolor: a Map of today's colors to style B's.
 */
function restyle(px, X, Y, w, h, draw, recolor) {
  const OUTC = '#2a1838';
  const b = new Buf(w, h, 4); const shadows = [];
  draw((x, y, c, ww = 1, hh = 1) => {
    if (c.startsWith('rgba')) { shadows.push([x, y, c, ww, hh]); return; }
    const cc = recolor?.get(c) || c;
    for (let yy = 0; yy < hh; yy += 1) for (let xx = 0; xx < ww; xx += 1) b.set(Math.round(x) - X + xx, Math.round(y) - Y + yy, cc, c === OUTC ? 'out' : 'fill');
  });
  shadows.forEach((s) => px(...s));
  const fillAt = (x, y) => (b.tag(x, y) === 'fill' ? b.get(x, y) : null);
  const marks = [];
  b.each((x, y) => {
    if (b.tag(x, y) !== 'out') return;
    const dn = fillAt(x, y + 1); const rt = fillAt(x + 1, y); const up = fillAt(x, y - 1); const lf = fillAt(x - 1, y);
    const emptyBelow = !b.get(x, y + 1);
    let c;
    if (up && emptyBelow) c = mix(up, INK, 0.62);
    else if (up || lf) c = mix(up || lf, INK, 0.5);
    else if (dn || rt) c = mix(dn || rt, INK, 0.3);
    else c = mix('#3a5a3a', INK, 0.4);
    marks.push([x, y, c]);
  });
  marks.forEach(([x, y, c]) => b.set(x, y, c));
  b.blit(px, X, Y);
}

// leaf colors: the border forest is deeper and cooler, the trees inside the village warmer
const TREE_PALS = {
  forest: [{ G: '#3d8a4c', g: '#78bc5c', d: '#2a5e48', T: '#6e4636' }, { G: '#468f4a', g: '#84c45e', d: '#2c6246', T: '#7a4a36' }, { G: '#3a8450', g: '#70b664', d: '#28584a', T: '#6a4438' }],
  village: [{ G: '#4fa04c', g: '#9ad466', d: '#2f6a46', T: '#8a5a3c' }, { G: '#58a64a', g: '#a6da6a', d: '#346e44', T: '#8a5a3c' }],
};
const BUSH_COLORS = new Map([['#6ccf5f', '#94d466'], ['#3c9a3c', '#4f9e4a'], ['#256b2b', '#2f6a46'], ['#c0f2a8', '#d8f4a0']]);

// A tree's look comes from its palette and a few fixed texture variants, so the ~65 trees
// are drawn from a handful of sprites (kept between paints) instead of one by one.
const treeSprites = new Map();
function treeSprite(pal, key, v) {
  const id = `${key}|${v}`;
  if (!treeSprites.has(id)) {
    const X0 = 101 + v * 67; const Y0 = 53 + v * 41; const cells = [];
    restyle((x, y, c, w = 1, h = 1) => cells.push([x - X0, y - Y0, c, w, h]), X0, Y0, 32, 40, (q) => bigTree(q, X0, Y0, pal));
    treeSprites.set(id, cells);
  }
  return treeSprites.get(id);
}
function treeB(px, p, L) {
  const forest = p.x < 0 || p.x + 32 > L.W || p.y < 0 || p.y + 40 > L.H;
  const pals = forest ? TREE_PALS.forest : TREE_PALS.village;
  const k = Math.floor(h2(p.x, p.y, 5) * pals.length); const v = Math.floor(h2(p.y, p.x, 9) * 3);
  treeSprite(pals[k], `${forest ? 'f' : 'v'}${k}`, v).forEach(([x, y, c, w, h]) => px(p.x + x, p.y + y, c, w, h));
  // the trees in the village bear fruit or blossom
  if (!forest) {
    const fruit = h2(p.x, p.y, 7) < 0.5 ? ['#e0404a', '#ff9a8a'] : ['#f6c0d8', '#ffffff'];
    [[8, 12], [14, 6], [22, 11], [18, 17], [10, 19], [25, 18], [5, 15]].forEach(([x, y], i) => { if (h2(i, p.x, 3) < 0.75) { px(p.x + x, p.y + y, fruit[0]); px(p.x + x, p.y + y - 1, fruit[1]); } });
  }
}
function bushB(px, x, y, berries) {
  restyle(px, x, y, 18, 13, (q) => bush(q, x, y, berries), BUSH_COLORS);
}

// ---------- the whole village ----------

/**
 * Paints the meadow's village in style B. opts: { homeRoof: the kid's color (the home's
 * door), areas: the green's ponds and play patches }. lib: { waterDepth, PROPS } from
 * villageprops.js (passed in so the two files don't import each other).
 */
export function paintMeadow(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 1234;
  const PROPS = lib.PROPS || {};

  // the ground, darker under the forest round the edge
  const edge = (x, y) => {
    const e = Math.min(x, y, L.W - 1 - x, L.H - 1 - y);
    if (e > 30) return null;
    const d = e + (vnoise(x, y, 10, seed + 9) - 0.5) * 9;
    if (d < 13) return bayer(x, y) < (13 - d) / 6 ? G[0] : G[1];
    if (d < 24 && bayer(x, y) < ((24 - d) / 11) * 0.85) return G[1];
    return null;
  };
  grassB(px, L.W, L.H, seed, { edge, flowers: 1.3 });

  const F = pathsB(px, L.paths, seed + 2, { printLine: 0, printAt: 0.36 });
  L.plazas.forEach(([x, y, r], i) => plazaB(px, x, y, r, seed + 40 + i, (xx, yy) => F(xx, yy).d < 8));
  const bridgeAt = (x) => L.crossings.some((c) => x > c.x - 18 && x < c.x + c.w + 18);
  L.water.forEach((wa, i) => riverB(px, L, wa, lib.waterDepth, seed + 60 + i, bridgeAt));
  (opts.areas || []).forEach((a, i) => {
    if (a.kind === 'pond') pondB(px, a, seed + 70 + i);
    else if (a.kind === 'hockey') frozenB(px, a, seed + 70 + i);
    else clearingB(px, a, a.kind, seed + 70 + i);
  });
  L.crossings.forEach((c) => bridgeB(px, c));

  const DRAW = {
    tree: (p) => treeB(px, p, L),
    bush: (p) => bushB(px, p.x, p.y, p.berries),
    well: (p) => wellB(px, p.x, p.y),
    garden: (p) => gardenB(px, p.x, p.y, p.w || 62, p.h || 34),
    stall: (p) => stallB(px, p.x, p.y),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
    flowers: (p) => flowersB(px, p.x, p.y, p.x + p.y),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p));
  L.props.filter((p) => PROPS[p.kind]?.flat).forEach(draw);
  butterflyB(px, 196, 226, ['#f08c3a', '#ffc47a']); butterflyB(px, 100, 508, FL.lilac.slice(1)); butterflyB(px, 300, 452, FL.yellow.slice(0, 2));

  // things that stand up, back to front
  const home = L.home;
  const houseLook = [
    { boxes: ['yellow', 'rose'], holly: [[3, 22, 'lilac'], [8, 16, 'white']], rose: true, smoke: false, seed: 21 },
    { boxes: ['blue', 'yellow'], cat: 'right', holly: [[-4, 24, 'pink'], [-9, 17, 'yellow']], rose: 'left', patchRight: false, seed: 37 },
    { boxes: ['pink', 'lilac'], holly: [[4, 20, 'rose']], rose: true, smoke: false, seed: 53 },
  ];
  const things = [
    { y: home.y + home.h, draw: () => cottageB(px, home.x, home.y, home.w, home.h, { home: true, door: opts.homeRoof || '#e03131', seed: 7, cat: 'left', boxes: ['rose', 'yellow'], holly: [[2, 25, 'pink'], [7, 19, 'rose'], [11, 15, 'white']], bird: true, patchRight: true }) },
    ...L.houses.map((hs, i) => ({ y: hs.y + hs.h, draw: () => cottageB(px, hs.x, hs.y, hs.w, hs.h, { door: hs.roof, roof: hs.roof, sign: hs.sign, ...houseLook[i % houseLook.length] }) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
