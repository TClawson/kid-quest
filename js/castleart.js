// The Castle village in style B, "soft storybook": the castle's curtain wall round the edge with
// its walk, battlements and corner towers, a stone-lined moat round the inner ward and a
// drawbridge over it, the kid's keep with roofs and a banner in their own color, cobbled lanes
// and plazas, a flagstone courtyard, and timber-framed town houses with tiled roofs. It shares
// the meadow's grass, trees, bushes, flowers, garden, well and laundry line (meadowart.js).
//
// One canvas pixel per village pixel, painted into one ImageData and shown with a single
// putImageData. villageprops.js calls paintCastle() for 'bg-castle' only.

import { ramp, mix, rng, h2, vnoise, bayer, grid, inEll, pathField, pixelBuffer, bbox, cobble } from './pixelkit.js';
import { PB, propB, groundShadow, grassB, flowerB, treeB, bushB, gardenB, flowersB, lilyPad, reeds, laundryB, wellB, smokeB, stoneB, tuft } from './meadowart.js';

export const CB = {
  stone: ['#3a3450', '#524b6a', '#6c6584', '#89829f', '#a8a1b9', '#c6c0d1', '#e1dce7', '#f6f3f5'], // castle stone, base 4
  warm: ['#4e3e4a', '#6e5a62', '#90797c', '#b09a98', '#cdbab2', '#e6d8ce'], // warm stone and plaster shadows
  slate: ['#26285a', '#34387c', '#46509e', '#5c6cbc', '#7e90d6', '#aab8ec'], // the wall towers' roofs
  water: ['#1a2660', '#223a88', '#2c52a8', '#3a6cc4', '#5a8ede', '#94c0f0', '#d4ecfc'],
  ice: ['#7a9cc8', '#a8c8e8', '#c8e2f6', '#e4f2fc'],
  snow: ['#a8a8cc', '#ccd0e8', '#e6eaf6', '#f8faff'],
  sand: ['#8a6a52', '#b08c66', '#cfac7e', '#e2c494', '#f0dab0', '#faecd0'],
  timber: ['#2e1c26', '#4a2c30', '#6a4038'],
  gold: ['#8a5a1a', '#c8902a', '#f0c040', '#ffe680', '#fff6c8'],
  glow: ['#c86a3a', '#f0a848', '#ffd878', '#fff4c8'],
  ink: '#2e2238',
};
const St = CB.stone; const Wm = CB.warm; const Sl = CB.slate; const Wa = CB.water; const Sa = CB.sand; const Tb = CB.timber; const Au = CB.gold; const Gl = CB.glow; const INK = CB.ink;
const G = PB.grass; const Wd = PB.wood; const WS = PB.wash; const T = PB.thatch; const LF = PB.leaf;

// ---------- outlines ----------
// every tag is 'kind:#color': the outline is a darker shade of that color (lighter on the lit
// top-left); things standing on the ground get the ink line underneath
const GROUNDED = new Set(['stone', 'wood', 'door', 'hay', 'metal', 'body']);
const edgeCache = new Map();
export function sel(tag, side) {
  if (!tag) return null;
  const [k, c] = String(tag).split(':');
  if (k === 'glow' || k === 'fx' || k === 'net' || k === 'water') return null;
  const key = `${k}|${c}|${side}`;
  if (edgeCache.has(key)) return edgeCache.get(key);
  const base = c || St[3];
  const v = side === 'bottom' ? (GROUNDED.has(k) ? INK : mix(base, INK, 0.62)) : mix(base, INK, side === 'right' ? 0.55 : 0.36);
  edgeCache.set(key, v);
  return v;
}
export const tg = (k, c) => `${k}:${c}`;

/** Masonry: which block a point is in (rows bh high, blocks bw wide, every other row offset). */
function block(x, y, bw = 8, bh = 4, seed = 0) {
  const row = Math.floor(y / bh); const v = y - row * bh;
  const off = (((row % 2) + 2) % 2) * (bw >> 1) + Math.floor(h2(row, 3, seed) * 3);
  const col = Math.floor((x + off) / bw); const u = x + off - col * bw;
  return { u, v, id: h2(col, row, seed), mortar: v === bh - 1 || u === bw - 1 };
}
/** A masonry color: lit top rows, shaded right ends, blocks a touch different from each other. */
export function masonry(x, y, o = {}) {
  const { bw = 8, bh = 4, seed = 0, lit = 0, P = St } = o;
  const k = block(x, y, bw, bh, seed);
  if (k.mortar) return P[Math.max(0, 1 + lit)];
  let i = 3 + lit;
  if (k.v === 0) i += 1;
  else if (k.u === bw - 2 || k.v === bh - 2) i -= 1;
  if (k.id < 0.18) i -= 1; else if (k.id > 0.9) i += 1;
  const c = P[Math.max(0, Math.min(P.length - 1, i))];
  return k.id > 0.55 && k.id < 0.68 ? mix(c, '#c8a890', 0.18) : c;
}

// ---------- cobbles ----------

const COB = [
  ['#5a5068', '#786e86', '#988ea4', '#b6aec0', '#d4cedc'], // cool grey
  ['#644e56', '#866e70', '#a68e8a', '#c4aea4', '#e0d0c4'], // warm grey
  ['#685a4a', '#8c7c62', '#ac9c7e', '#c8ba98', '#e2d8b8'], // sandstone
];
const MORTAR = '#6e5e68';
function cobbleColor(c, seed, worn = 0) {
  if (c.mortar) return MORTAR;
  const hk = h2(c.id, c.row, seed);
  const t = COB[hk < 0.55 ? 0 : hk < 0.85 ? 1 : 2];
  let i = 2;
  if (c.v === 0 || c.u === 0) i = 3;
  if (c.v === 2 || c.u === c.w - 2) i = 1;
  if (c.v === 0 && c.u === 0) i = 2;
  if (c.v === 0 && c.u === 1 && hk > 0.5) i = 4;
  if (worn && i < 4 && hk < worn) i += 1;
  return t[i];
}

/** Cobbled lanes: stones set in dark mortar, edged by whole stones with grass in the joints. */
function cobblesK(px, L, seed) {
  const R = 6.5;
  const F = pathField(L.paths, R + 4);
  const [bx, by, bw, bh] = bbox(L.paths, 10);
  const inside = new Map();
  const stoneIn = (c) => {
    const k = c.cy * 4096 + c.cx * 2;
    let v = inside.get(k);
    if (v === undefined) { v = F(c.cx, c.cy).d < R - 0.5 + (h2(c.id, c.row, seed + 5) - 0.5) * 2.4; inside.set(k, v); }
    return v;
  };
  for (let y = Math.max(0, by); y < by + bh; y += 1) {
    for (let x = Math.max(0, bx); x < bx + bw; x += 1) {
      const f = F(x, y);
      if (f.d > R + 4) continue;
      const c = cobble(x, y, seed);
      if (!stoneIn(c)) {
        // a soft shade where the lane meets the grass
        if (f.d < R + 2 && bayer(x, y) < 0.3) px(x, y, G[1]);
        continue;
      }
      if (c.mortar) { px(x, y, f.d > R - 2.5 ? (bayer(x, y) < 0.55 ? G[2] : G[1]) : MORTAR); continue; }
      px(x, y, cobbleColor(c, seed, Math.abs(f.off) < 2.5 ? 0.35 : 0));
    }
  }
  return F;
}

/** A round plaza of cobbles, with a kerb of big dressed stones round it; mosaic: a star of pale stones in the middle. */
function plazaK(px, cx, cy, r, seed, mosaic) {
  for (let y = Math.floor(cy - r - 2); y <= cy + r + 2; y += 1) {
    for (let x = Math.floor(cx - r - 2); x <= cx + r + 2; x += 1) {
      const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
      if (d > r + 1) continue;
      if (d > r - 3.5) {
        // the kerb: long stones round the rim, lit on the side that faces the light
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx);
        const seg = Math.floor(((a + Math.PI) * r) / 9);
        const joint = Math.abs(((a + Math.PI) * r) / 9 - seg - 0) < 0.08;
        const lit = -Math.cos(a) * 0.6 - Math.sin(a) * 0.8;
        let c = joint ? St[1] : d > r - 0.5 ? St[2] : d < r - 2.5 ? St[5] : lit > 0.3 ? St[5] : lit < -0.3 ? St[3] : St[4];
        if (!joint && h2(seg, 2, seed) < 0.2 && d > r - 2.5) c = mix(c, '#c8a890', 0.25);
        px(x, y, c);
        continue;
      }
      const c = cobble(x, y, seed);
      let col = cobbleColor(c, seed);
      if (mosaic && !c.mortar) {
        const a = Math.atan2(c.cy - cy, c.cx - cx); const dd = Math.hypot(c.cx - cx, c.cy - cy);
        const star = dd < (r - 6) * (0.38 + 0.62 * Math.abs(Math.cos(a * 2)) ** 6);
        if (star) col = [Au[1], '#e8d4a8', '#f6ead0', '#fff8e8', '#ffffff'][Math.min(4, Math.max(0, COB[0].indexOf(col) >= 0 ? COB[0].indexOf(col) : 2))];
      }
      px(x, y, col);
    }
  }
}

/** The courtyard before the keep: big flagstones in rows, a kerb round it. */
function courtyardK(px, X, Y, w, h, seed) {
  const rr = 6;
  const inRect = (x, y, g = 0) => {
    const dx = Math.max(X + rr - g - (x + 0.5), 0, x + 0.5 - (X + w - rr + g)); const dy = Math.max(Y + rr - g - (y + 0.5), 0, y + 0.5 - (Y + h - rr + g));
    return Math.hypot(dx, dy) <= rr;
  };
  const FW = [11, 9, 13, 10, 12, 9]; const FC = FW.reduce((a, v) => [...a, a[a.length - 1] + v], [0]); const FS = FC[FC.length - 1];
  for (let y = Y - 1; y < Y + h + 1; y += 1) {
    for (let x = X - 1; x < X + w + 1; x += 1) {
      if (!inRect(x, y, 1)) continue;
      if (!inRect(x, y, -2)) { px(x, y, x + y < X + Y + 8 || y < Y + 2 ? St[5] : y > Y + h - 3 ? St[2] : St[4]); continue; } // the kerb
      const row = Math.floor((y - Y) / 7); const v = y - Y - row * 7;
      const s = Math.floor(h2(row, 4, seed) * FS); const q = x + s; const m = ((q % FS) + FS) % FS;
      let i = 0; while (FC[i + 1] <= m) i += 1;
      const u = m - FC[i]; const fw = FW[i]; const id = Math.floor(q / FS) * 6 + i;
      if (u === fw - 1 || v === 6) { px(x, y, vnoise(x, y, 6, seed) > 0.68 ? (bayer(x, y) < 0.5 ? G[2] : G[3]) : Wm[2]); continue; }
      const hk = h2(id, row, seed);
      const t = hk < 0.4 ? ['#968898', '#b0a4b0', '#c8bec6', '#ddd4d8'] : hk < 0.75 ? ['#a49280', '#bea996', '#d4c2aa', '#e6d8c2'] : ['#8e8ea4', '#a8a8bc', '#c2c2d2', '#d8d8e4'];
      let c = t[2];
      if (v === 0 || u === 0) c = t[3];
      else if (v === 5 || u === fw - 2) c = t[1];
      else if (vnoise(x, y, 4, id) < 0.22) c = t[1];
      if (h2(x, y, seed) > 0.992) c = t[0];
      px(x, y, c);
    }
  }
}

// ---------- the moat ----------

/**
 * The moat round the inner ward: water between dressed stone edges. Where it runs east-west
 * the far (north) side shows its wall face over a shadowed strip of water; the west walls of
 * the long arms shade the water a little. Ripples, shines, lily pads and a family of ducks.
 */
function moatK(px, L, wa, seed) {
  const F = pathField([wa.pts], 18);
  const [bx, by, bw, bh] = bbox([wa.pts], 18);
  const rim = 12; // the water's half width
  for (let y = Math.max(0, by); y < Math.min(L.H, by + bh); y += 1) {
    for (let x = Math.max(0, bx); x < Math.min(L.W, bx + bw); x += 1) {
      const f = F(x, y);
      const d = f.d;
      if (d > rim + 4.5) continue;
      const north = f.ny < -0.6; const west = f.nx < -0.6; const b = bayer(x, y);
      if (d >= rim) {
        // the coping: dressed stones, the lit edge along the water
        if (d > rim + 3.5) { if (b < 0.5) px(x, y, St[2]); continue; }
        const joint = Math.abs(f.along % 9) < 1;
        let c = joint ? St[2] : d < rim + 1 ? St[6] : d > rim + 2.6 ? St[3] : St[5];
        if (!joint && h2(Math.floor(f.along / 9), 7, seed) < 0.25 && d >= rim + 1) c = mix(c, '#c8a890', 0.2);
        if (!joint && h2(x, y, seed) > 0.97) c = St[4];
        px(x, y, c);
        continue;
      }
      if (north && d > rim - 6) {
        // the north bank's wall face, wet and mossy at the foot
        const k = d - (rim - 6); // 6 at the top .. 0 at the water
        let c = masonry(x, Math.round(k * -1 + 40), { bw: 7, bh: 3, seed, lit: -1 });
        if (k > 5.2) c = St[4];
        else if (k < 1.2) c = b < 0.5 ? '#3a5a5a' : '#2e4a54';
        else if (k < 2.2 && h2(x, 3, seed) < 0.4) c = '#4a7a5a';
        px(x, y, c);
        continue;
      }
      // the water
      let c = Wa[2];
      const n = vnoise(x, y, 9, seed);
      if (north && d > rim - 9) c = d > rim - 7.5 ? Wa[0] : (b < 0.5 ? Wa[1] : Wa[0]); // in the wall's shadow
      else if (west && d > rim - 3) c = b < 0.6 ? Wa[1] : Wa[2];
      else if (!north && !west && d > rim - 2.5) c = b < 0.5 ? Wa[3] : Wa[4]; // light off the near stones
      else if (n > 0.66 && b < (n - 0.66) * 4) c = Wa[3];
      else if (n < 0.3 && b < 0.4) c = Wa[1];
      px(x, y, c);
    }
  }
  // ripples and shines
  const rnd = rng(seed);
  for (let i = 0; i < 70; i += 1) {
    const x = bx + Math.floor(rnd() * bw); const y = by + Math.floor(rnd() * bh); const len = 2 + Math.floor(rnd() * 4);
    const f = F(x, y);
    if (f.d > rim - 3.5 || (f.ny < -0.6 && f.d > rim - 9) || y < 24) continue;
    px(x, y, Wa[4], len, 1); px(x + 1, y, Wa[5], Math.max(1, len - 2), 1);
  }
  return F;
}

/** A duck (mother) or duckling on the water, 9 x 6 / 5 x 4, swimming left or right. */
function duckK(px, X, Y, baby, dir = 1) {
  const rows = baby ? ['.yy..', 'yyoy.', 'yyyyy', '.www.'] : ['....hh...', '...hhho..', '.wwwhh...', 'wWWWWww..', 'WWWWWWW..', '.sssss...'];
  const pal = baby ? { y: '#ffd84a', o: '#f08c3a', w: Wa[5] } : { h: '#2f8a5a', o: '#f0a030', w: '#fffaf0', W: '#e8dcc8', s: Wa[5] };
  rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) { const c = pal[r[x]]; if (c) px(dir > 0 ? X + x : X + r.length - 1 - x, Y + y, c); } });
  if (!baby) px(dir > 0 ? X + 5 : X + 3, Y + 1, '#1a1028');
}

/** The drawbridge: thick planks banded with iron, chains up to two stone gate posts on the castle side. */
function drawbridgeK(px, c) {
  const X = Math.round(c.x); const Y = Math.round(c.y); const w = Math.round(c.w); const h = Math.round(c.h);
  // its shadow on the water
  for (let y = Y + 4; y < Y + h - 2; y += 1) { px(X - 2, y, 'rgba(10,16,50,0.35)', 2, 1); px(X + w, y, 'rgba(10,16,50,0.45)', 3, 1); }
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        const r = y % 4; const plank = Math.floor(y / 4);
        let col = r === 0 ? Wd[4] : r === 3 ? Wd[1] : Wd[3];
        if (r === 1 && h2(plank, x >> 3, 4) < 0.3) col = Wd[2];
        if (h2(x, y, 9) > 0.985) col = Wd[2];
        if (x <= 2 || x >= w - 3) col = x === 1 || x === w - 3 ? Wd[4] : Wd[2]; // the side beams
        if (x === 5 || x === w - 6) col = r === 0 ? '#9a94a8' : '#6a6478'; // iron bands
        b.set(x, y, col, tg('wood', Wd[3]));
      }
      if (y % 4 === 1) { b.set(5, y, '#c8c4d4', tg('wood', Wd[3])); b.set(w - 6, y, '#c8c4d4', tg('wood', Wd[3])); } // rivets
    }
    // a ring to haul it up by, at the free end
    grid((x, y, cc) => b.set(x, y, cc, tg('metal', '#6a6478')), Math.round(w / 2) - 2, h - 6, ['.mm.', 'm..m', '.mm.'], { m: '#8a84a0' });
  }, { outline: sel });
  // the gate posts and their chains
  const top = Y - 12;
  for (const [gx, dir] of [[X - 6, 1], [X + w - 2, -1]]) {
    propB(px, gx, top, 8, 18, (b) => {
      for (let y = 0; y < 18; y += 1) for (let x = 0; x < 8; x += 1) b.set(x, y, y < 3 ? (x < 4 ? St[6] : St[5]) : masonry(x + gx, y, { bw: 8, bh: 4, seed: 3 }), tg('stone', St[4]));
      b.set(3, 1, Au[3]); b.set(4, 1, Au[2]);
    }, { outline: sel });
    const x0 = dir > 0 ? gx + 6 : gx + 1; const y0 = top + 5; const x1 = dir > 0 ? X + 3 : X + w - 4; const y1 = Y + h - 5;
    const n = Math.round(Math.hypot(x1 - x0, y1 - y0));
    for (let i = 0; i <= n; i += 1) {
      const t = i / n; const sag = Math.sin(t * Math.PI) * 2.5;
      const x = Math.round(x0 + (x1 - x0) * t + sag * dir * 0.6); const y = Math.round(y0 + (y1 - y0) * t);
      px(x, y, i % 3 === 0 ? '#3a3448' : i % 3 === 1 ? '#a8a2b8' : '#6a6478');
    }
  }
}

// ---------- the castle wall ----------

/** The curtain wall round the village: its walk and battlements, the inner face along the top, round corner towers with slate roofs. */
function wallsK(px, L, seed) {
  const W = L.W; const H = L.H;
  const moatX = L.water.flatMap((wa) => wa.pts.filter((p) => p[1] < 0).map((p) => p[0]));
  // the side walls, seen from above: outer parapet with merlons, the walk, an inner lip
  for (let y = 18; y < H - 14; y += 1) {
    for (let k = 0; k < 20; k += 1) {
      for (const right of [false, true]) {
        const x = right ? W - 1 - k : k;
        let c;
        if (k < 6) {
          const merlon = (y + (right ? 5 : 0)) % 12 < 7;
          c = merlon ? (k < 1 ? St[2] : (y + (right ? 5 : 0)) % 12 === 0 ? St[5] : (right ? St[3] : St[4])) : (k < 1 ? St[2] : St[3]);
          if (merlon && (y + (right ? 5 : 0)) % 12 === 6) c = St[2];
        } else if (k < 15) {
          const flag = Math.floor(y / 9); const v = y - flag * 9;
          c = v === 8 ? St[2] : (k === 6 && !right) || (k === 14 && right) ? St[2] : v === 0 ? St[5] : St[4];
          if (h2(flag, k > 10 ? 1 : 0, seed) < 0.3 && v !== 8) c = mix(c, '#c8a890', 0.18);
        } else if (k < 19) c = k === 15 ? St[6] : right ? St[5] : St[3];
        else c = INK;
        px(x, y, c);
      }
    }
    // the wall's shadow on the grass to its right
    if (bayer(20, y) < 0.6) px(20, y, 'rgba(42,24,56,0.22)');
    if (bayer(21, y) < 0.3) px(21, y, 'rgba(42,24,56,0.16)');
  }
  // the bottom wall, seen from above: an inner lip, the walk, merlons along the outer edge
  for (let x = 14; x < W - 14; x += 1) {
    for (let y = H - 18; y < H; y += 1) {
      const k = y - (H - 18);
      let c;
      if (k === 0) c = INK;
      else if (k < 4) c = k === 1 ? St[6] : St[5];
      else if (k < 12) { const flag = Math.floor(x / 9); const u = x - flag * 9; c = u === 8 ? St[2] : k === 4 ? St[3] : k === 11 ? St[2] : St[4]; if (h2(flag, 5, seed) < 0.3 && u !== 8) c = mix(c, '#c8a890', 0.18); }
      else { const m = x % 12 < 7; c = m ? (k === 12 ? St[5] : x % 12 === 6 ? St[3] : St[4]) : St[3]; if (k === 17) c = St[2]; }
      px(x, y, c);
    }
  }
  // the top wall: crenels with sky behind them, the walk, and its inner face
  for (let x = 0; x < W; x += 1) {
    for (let y = 0; y < 23; y += 1) {
      let c;
      if (y < 4) {
        const m = (x + 3) % 12 < 7;
        c = m ? (y === 0 ? St[6] : (x + 3) % 12 === 6 ? St[3] : St[5]) : (y < 3 ? (bayer(x, y) < 0.5 ? '#cfe8f6' : '#bcdcf0') : St[2]);
      } else if (y < 8) { const flag = Math.floor(x / 9); c = x - flag * 9 === 8 ? St[3] : y === 4 ? St[3] : St[5]; }
      else if (y === 8) c = St[6];
      else if (y > 20) c = y === 22 ? INK : St[1];
      else c = masonry(x, y, { bw: 9, bh: 4, seed: seed + 1 });
      px(x, y, c);
    }
  }
  // where the moat runs under the wall: a dark arch with a grate
  moatX.forEach((mx) => {
    for (let y = 9; y < 23; y += 1) {
      for (let x = mx - 13; x <= mx + 13; x += 1) {
        const r = 11; const inArch = y > 13 + 0 ? Math.abs(x + 0.5 - mx) <= r : Math.hypot(x + 0.5 - mx, y + 0.5 - 21) <= r;
        const ring = !inArch && (y > 13 ? Math.abs(x + 0.5 - mx) <= r + 2 : Math.hypot(x + 0.5 - mx, y + 0.5 - 21) <= r + 2);
        if (ring) px(x, y, x < mx ? St[6] : St[4]);
        else if (inArch) {
          const bar = (x - mx + 30) % 4 === 0 || (y % 5 === 0 && y < 20);
          px(x, y, bar ? (y % 5 === 0 ? '#5a5470' : '#4a4460') : y > 19 ? Wa[0] : '#141028');
          if (bar && y === 22) px(x, y, Wa[2]);
        }
      }
    }
  });
  // banners hanging down the inner face, ivy, and a torch or two
  [[38, '#7048e8'], [170, '#e64980'], [278, '#1c7ed6'], [410, '#7048e8']].forEach(([x, col], i) => {
    const P = ramp(col, 3, 2);
    for (let y = 8; y < 21; y += 1) for (let k = 0; k < 8; k += 1) {
      const tail = y > 17 && Math.abs(k - 3.5) < (y - 17) * 1.3;
      if (tail) continue;
      px(x + k, y, k === 0 ? P[3] : k === 7 ? P[1] : y === 8 ? P[0] : P[2]);
    }
    grid(px, x + 2, 11, i % 2 ? ['.yy.', 'yYYy', '.yy.', '.y..'] : ['y.y.', 'yyy.', 'YYY.'], { y: Au[2], Y: Au[3] });
    px(x - 1, 8, Au[1], 10, 1);
  });
  [[60, 9], [252, 10], [392, 9]].forEach(([x, y0], i) => {
    for (let k = 0; k < 14; k += 1) {
      const xx = x + Math.round(Math.sin(k * 0.9 + i) * 2) + (k % 3); const yy = y0 + Math.floor(k * 0.9);
      px(xx, yy, k % 2 ? LF[3] : LF[2]); px(xx + 1, yy, LF[4]); if (k % 3 === 0) px(xx - 1, yy + 1, LF[2]);
    }
  });
  // round towers in the corners: a ring of merlons, a slate cone roof, a pennant
  const tower = (cx, cy) => {
    const R = 19;
    for (let y = Math.floor(cy - R - 1); y <= cy + R + 1; y += 1) {
      for (let x = Math.floor(cx - R - 1); x <= cx + R + 1; x += 1) {
        const d = Math.hypot(x + 0.5 - cx, (y + 0.5 - cy) * 1.05);
        if (d > R + 0.5) continue;
        if (x < 0 || y < 0 || x >= W || y >= H) continue;
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const lit = -Math.cos(a) * 0.6 - Math.sin(a) * 0.8;
        let c;
        if (d > R - 0.8) c = INK;
        else if (d > R - 4.5) { const m = Math.floor(((a + Math.PI) * R) / 6) % 2 === 0; c = m ? (lit > 0.2 ? St[6] : lit < -0.3 ? St[3] : St[5]) : St[2]; }
        else c = d > R - 5.5 ? St[2] : (bayer(x, y) < 0.5 ? St[4] : St[3]);
        px(x, y, c);
      }
    }
    // the cone roof
    const rr = 12; const tall = 22; const base = cy + 5;
    for (let y = Math.floor(base - tall); y <= base + 3; y += 1) {
      for (let x = Math.floor(cx - rr - 1); x <= cx + rr + 1; x += 1) {
        const t = (y + 0.5 - (base - tall)) / tall; const half = t * rr;
        const inCone = y + 0.5 <= base ? Math.abs(x + 0.5 - cx) <= half : inEll(x, y, cx, base, rr, 3);
        if (!inCone || y < 0) continue;
        const u = (x + 0.5 - cx) / Math.max(1, rr);
        let c = u < -0.45 ? Sl[4] : u < 0.05 ? Sl[3] : u < 0.5 ? Sl[2] : Sl[1];
        const ring = Math.floor((y - (base - tall)) / 3);
        if ((y - (base - tall)) % 3 === 2 && (x + ring) % 2 === 0) c = Sl[Math.max(0, Sl.indexOf(c) - 1)];
        if (Math.abs(x + 0.5 - cx) > half - 0.9 && y + 0.5 <= base) c = Sl[0];
        if (y + 0.5 > base) c = inEll(x, y - 1, cx, base, rr, 3) ? Sl[1] : Sl[0];
        px(x, y, c);
      }
    }
    const ty = Math.round(base - tall);
    if (ty - 6 >= 0) { px(Math.round(cx), ty - 6, Tb[1], 1, 6); grid(px, Math.round(cx) + 1, ty - 6, ['rrr', 'rR.', 'r..'], { r: '#e64980', R: '#ff9ac0' }); }
    else px(Math.round(cx) - 1, Math.max(0, ty), Au[2], 2, 2);
  };
  tower(16, 15); tower(W - 16, 15); tower(16, H - 17); tower(W - 16, H - 17);
}

// ---------- the green ----------

function roundRect(Z, x, y, g = 0, rr = 8) {
  const dx = Math.max(Z.x + rr - g - (x + 0.5), 0, x + 0.5 - (Z.x + Z.w - rr + g)); const dy = Math.max(Z.y + rr - g - (y + 0.5), 0, y + 0.5 - (Z.y + Z.h - rr + g));
  return rr - Math.hypot(dx, dy); // > 0 inside
}

/** A stone-lined pool in the castle gardens (pond), or the same pool frozen hard for hockey. */
function poolK(px, Z, seed, frozen) {
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) {
    for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
      const k = roundRect(Z, x, y, 3); const b = bayer(x, y); const north = y + 0.5 < mid;
      if (k < 0) { if (k > -1.5 && b < 0.5) px(x, y, 'rgba(42,24,56,0.2)'); continue; }
      if (k < 3.2) {
        const along = Math.floor((x + y * 0.7) / 8);
        let c = k < 0.9 ? (north ? St[3] : St[2]) : k > 2.4 ? St[6] : (h2(along, 2, seed) < 0.3 ? mix(St[5], '#c8a890', 0.25) : St[5]);
        if ((x + Math.round(y * 0.7)) % 8 === 0) c = St[2];
        if (frozen && k > 0.8 && vnoise(x, y, 4, seed) > 0.52) c = vnoise(x, y, 3, seed + 1) > 0.6 ? CB.snow[3] : CB.snow[2];
        px(x, y, c);
        continue;
      }
      const inner = k - 3.2;
      if (frozen) {
        let c = CB.ice[2];
        if (north && inner < 3) c = CB.ice[1];
        else if (vnoise(x * 0.4, y, 3, seed) > 0.64 && b < 0.6) c = CB.ice[3];
        if (h2(x, y, seed) > 0.985) c = '#ffffff';
        px(x, y, c);
      } else {
        let c = Wa[3];
        if (north && inner < 3) c = inner < 1.5 ? Wa[1] : Wa[2];
        else if (!north && inner < 1.5) c = b < 0.5 ? Wa[4] : Wa[3];
        else if (vnoise(x, y, 8, seed) > 0.68 && b < 0.5) c = Wa[4];
        px(x, y, c);
      }
    }
  }
  const rnd = rng(seed);
  if (frozen) {
    for (let i = 0; i < 4; i += 1) {
      let x = Z.x + 14 + Math.floor(rnd() * (Z.w - 28)); let y = Z.y + 8 + Math.floor(rnd() * (Z.h - 16));
      for (let k = 0; k < 9; k += 1) { if (roundRect(Z, x, y, 3) > 5) px(x, y, CB.ice[0]); x += rnd() < 0.6 ? 1 : 0; y += rnd() < 0.5 ? 1 : -1; }
    }
    for (let y = Z.y + 5; y < Z.y + Z.h - 5; y += 1) px(Math.round(Z.x + Z.w / 2) - 1, y, y % 3 ? '#e8788a' : '#f0a0b0');
    const m = Math.round(mid);
    const net = (x, dir) => propB(px, x, m - 6, 4, 13, (b) => {
      for (let y = 0; y < 13; y += 1) for (let xx = 0; xx < 4; xx += 1) {
        const front = dir > 0 ? xx === 3 : xx === 0; const back = dir > 0 ? xx === 0 : xx === 3;
        if (front || y === 0 || y === 12) b.set(xx, y, y === 0 ? '#ff8a8a' : '#d8384a', tg('metal', '#d8384a'));
        else if (back) b.set(xx, y, '#c8384a', tg('metal', '#c8384a'));
        else if (y % 2 === 0 || xx % 2 === 1) b.set(xx, y, '#f4f4fa', tg('net', '#ffffff'));
      }
    }, { outline: sel });
    net(Z.x + 7, 1); net(Z.x + Z.w - 11, -1);
    // snow banked in two corners
    [[Z.x - 2, Z.y + Z.h - 4], [Z.x + Z.w - 12, Z.y - 3]].forEach(([x, y]) => { for (let k = 0; k < 14; k += 1) px(x + k, y + (k < 3 || k > 10 ? 1 : 0), k < 7 ? CB.snow[3] : CB.snow[2]); });
  } else {
    for (let i = 0; i < 9; i += 1) { const x = Z.x + 12 + Math.floor(rnd() * (Z.w - 30)); const y = Z.y + 9 + Math.floor(rnd() * (Z.h - 18)); if (roundRect(Z, x, y, 3) > 7) { px(x, y, Wa[5]); px(x + 1, y, Wa[4], 2 + Math.floor(rnd() * 3), 1); } }
    lilyPad(px, Math.round(Z.x + 0.2 * Z.w), Math.round(Z.y + 0.56 * Z.h), true, false);
    lilyPad(px, Math.round(Z.x + 0.68 * Z.w), Math.round(Z.y + 0.3 * Z.h), false, true);
    lilyPad(px, Math.round(Z.x + 0.78 * Z.w), Math.round(Z.y + 0.62 * Z.h), true, false);
    reeds(px, Z.x + 2, Z.y + 4, seed); reeds(px, Z.x + Z.w - 3, Z.y + Z.h - 2, seed + 1);
  }
}

/** The tiltyard: raked sand inside a low wooden rail, with pennant posts; goals or posts at the ends. */
function yardK(px, Z, kind, seed) {
  for (let y = Z.y - 4; y < Z.y + Z.h + 4; y += 1) {
    for (let x = Z.x - 4; x < Z.x + Z.w + 4; x += 1) {
      const k = roundRect(Z, x, y, 2, 6); const b = bayer(x, y);
      if (k < 0) { if (k > -2 && b < (k + 2) / 3) px(x, y, Sa[2]); continue; }
      const n = vnoise(x, y, 7, seed);
      let c = Sa[3];
      if ((y - Z.y) % 4 === 0 && h2(x >> 2, y, seed) < 0.7) c = Sa[2]; // rake lines
      else if (n > 0.66 && b < 0.5) c = Sa[4];
      else if (n < 0.3 && b < 0.4) c = Sa[2];
      if (k < 1.2) c = b < 0.5 ? Sa[2] : Sa[1];
      if (h2(x, y, seed) > 0.994) c = Sa[0];
      px(x, y, c);
    }
  }
  // a hoof print or two from the knight's horse
  [[0.3, 0.3], [0.36, 0.42], [0.62, 0.6]].forEach(([fx, fy]) => grid(px, Math.round(Z.x + fx * Z.w), Math.round(Z.y + fy * Z.h), ['.dd.', 'd..d', 'd..d'], { d: Sa[1] }));
  // the rail along the top and bottom
  const rail = (y, front) => {
    for (let x = Z.x - 2; x < Z.x + Z.w + 2; x += 1) {
      px(x, y, Wd[4]); px(x, y + 1, Wd[2]);
      if ((x - Z.x + 2) % 18 === 0) { px(x, y - 2, Wd[4], 2, 2); px(x, y + 2, front ? Wd[1] : Wd[2], 2, 3); px(x + 1, y - 2, Wd[2], 1, 7); }
    }
  };
  rail(Z.y - 4, false); rail(Z.y + Z.h + 2, true);
  // striped posts with pennants at the corners
  [[Z.x - 4, Z.y - 4, '#e64980'], [Z.x + Z.w + 1, Z.y - 4, '#1c7ed6'], [Z.x - 4, Z.y + Z.h + 2, '#fcc419'], [Z.x + Z.w + 1, Z.y + Z.h + 2, '#7048e8']].forEach(([x, y, col], i) => {
    propB(px, x - 1, y - 16, 10, 19, (b) => {
      for (let yy = 2; yy < 19; yy += 1) { b.set(1, yy, yy % 4 < 2 ? '#fff4e4' : '#e64940', tg('wood', '#e64940')); b.set(2, yy, yy % 4 < 2 ? '#d8c8b8' : '#b03030', tg('wood', '#e64940')); }
      b.set(1, 1, Au[3], tg('metal', Au[2])); b.set(2, 1, Au[2], tg('metal', Au[2]));
      const P = ramp(col, 2, 2); const right = i % 2 === 0;
      grid((xx, yy, c) => b.set(right ? 3 + xx : -4 + 3 - xx, yy, c, tg('cloth', col)), 0, 2, ['ppppp', 'pPPp.', 'ppp..', 'p....'], { p: P[2], P: P[3] });
    }, { outline: sel });
  });
  const mid = Math.round(Z.y + Z.h / 2);
  if (kind === 'football') {
    const post = (x) => propB(px, x - 6, mid - 18, 13, 22, (b) => {
      for (let y = 9; y < 22; y += 1) { b.set(6, y, Wd[4], tg('wood', Wd[3])); b.set(7, y, Wd[2], tg('wood', Wd[3])); }
      for (let xx = 0; xx < 13; xx += 1) { b.set(xx, 8, Wd[5], tg('wood', Wd[3])); b.set(xx, 9, Wd[3], tg('wood', Wd[3])); }
      for (const ux of [0, 11]) for (let y = 0; y < 9; y += 1) { b.set(ux, y, y % 4 < 2 ? '#fff4e4' : '#e64940', tg('wood', '#e64940')); b.set(ux + 1, y, y % 4 < 2 ? '#d8c8b8' : '#b03030', tg('wood', '#e64940')); }
    }, { outline: sel });
    groundShadow(px, Z.x + 6, mid + 4, 4, 1.2, 0.2); groundShadow(px, Z.x + Z.w - 5, mid + 4, 4, 1.2, 0.2);
    post(Z.x + 4); post(Z.x + Z.w - 7);
  } else {
    const goal = (x, dir) => propB(px, x, mid - 8, 8, 16, (b) => {
      for (let y = 0; y < 16; y += 1) {
        for (let i = 0; i < 8; i += 1) {
          const xx = dir > 0 ? i : 7 - i;
          if (i >= 6) b.set(xx, y, i === 6 ? Wd[4] : Wd[2], tg('wood', Wd[3]));
          else if (y === 0 || y === 15) b.set(xx, y, y === 0 ? Wd[4] : Wd[2], tg('wood', Wd[3]));
          else if (i === 0) b.set(xx, y, Wd[3], tg('wood', Wd[3]));
          else if ((i + y) % 2 === 0) b.set(xx, y, 'rgba(250,240,220,0.7)', tg('net', '#ffffff'));
        }
      }
      b.set(dir > 0 ? 7 : 0, 0, Au[3], tg('metal', Au[2]));
    }, { outline: sel });
    groundShadow(px, Z.x + 5, mid + 9, 5, 1.2, 0.18); groundShadow(px, Z.x + Z.w - 4, mid + 9, 5, 1.2, 0.18);
    goal(Z.x + 1, 1); goal(Z.x + Z.w - 9, -1);
    grid(px, Math.round(Z.x + Z.w / 2) - 3, mid - 3, ['..ww..', '.w..w.', 'w....w', 'w....w', '.w..w.', '..ww..'], { w: '#fff6e0' });
  }
}

// ---------- the keep ----------

/** A cone roof with rows of scalloped tiles, lit on the left: base (cx, by) half-width r, apex ht above. */
export function coneRoof(b, cx, by, r, ht, P, tag) {
  for (let y = Math.floor(by - ht); y <= by + 2; y += 1) {
    for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      const t = (y + 0.5 - (by - ht)) / ht; const half = Math.pow(Math.max(0, t), 0.9) * r;
      const curve = y + 0.5 > by - 1 ? inEll(x, y, cx, by - 1, r, 2.6) : Math.abs(x + 0.5 - cx) <= half;
      if (!curve) continue;
      const u = (x + 0.5 - cx) / r;
      let i = u < -0.55 ? 4 : u < -0.1 ? 3 : u < 0.4 ? 2 : 1;
      const row = Math.floor((y - (by - ht)) / 3.2); const v = (y - (by - ht)) - row * 3.2;
      const sc = Math.floor((x + (row % 2) * 2) / 4); const su = x + (row % 2) * 2 - sc * 4;
      if (v > 2.2 && su !== 1 && su !== 2) i -= 1; // the scalloped lower edge of each row of tiles
      if (y + 0.5 > by - 1) i = Math.min(i, 1);
      b.set(x, y, P[Math.max(0, Math.min(P.length - 1, i))], tag);
    }
  }
}

/** A tall pennant on a pole, waving to the right. */
function pennant(b, x, y, hgt, col, tag) {
  const P = ramp(col, 2, 2);
  for (let k = 0; k < hgt; k += 1) b.set(x, y + k, Tb[2], tg('wood', Tb[2]));
  b.set(x, y - 1, Au[3], tg('metal', Au[2]));
  grid((xx, yy, c) => b.set(xx, yy, c, tag || tg('cloth', col)), x + 1, y, ['pppppp.', 'pPPPpppp', 'pppppp..', 'ppp.....'], { p: P[2], P: P[3] });
}

/**
 * The kid's keep, w x h: a square tower under a tall cone roof in the kid's color, two round
 * turrets with roofs to match, curtain walls with battlements, a studded oak door under a
 * banner with a golden crown, stained-glass windows, ivy, and pennants on top.
 */
function keepK(px, X, Y, w, h, color) {
  const R = ramp(color, 3, 2);
  groundShadow(px, X + w / 2 + 3, Y + h - 1, w / 2 + 2, 4, 0.22);
  const cx = Math.round(w / 2);
  const main = [cx - 26, cx + 26]; // the main tower
  const tur = [[2, 28], [w - 28, w - 2]]; // the turrets
  propB(px, X, Y, w, h, (b) => {
    const stone = (x, y, lit = 0) => masonry(x, y, { bw: 8, bh: 4, seed: 11, lit });
    // curtain walls between the turrets and the tower, with battlements
    for (let y = 46; y < h - 2; y += 1) for (let x = 20; x < w - 20; x += 1) {
      if (y < 50 && (x % 8) > 4) continue;
      b.set(x, y, y < 50 ? (y === 46 ? St[6] : St[5]) : stone(x, y, -1), tg('stone', St[3]));
    }
    // the turrets: round, shaded from the left
    tur.forEach(([a, z], ti) => {
      const r = (z - a) / 2; const mx = a + r;
      for (let y = 36; y < h - 1; y += 1) for (let x = a; x < z; x += 1) {
        const u = (x + 0.5 - mx) / r;
        let c = stone(x, y, u < -0.5 ? 1 : u > 0.45 ? -1 : 0);
        if (Math.abs(u) > 0.88) c = u < 0 ? St[4] : St[1];
        b.set(x, y, c, tg('stone', St[3]));
      }
      // a slit window, glowing
      for (let y = 52; y < 62; y += 1) { b.set(mx - 1, y, y < 53 ? Tb[0] : Gl[1], tg('glow', Gl[1])); b.set(mx, y, y < 53 ? Tb[0] : Gl[2], tg('glow', Gl[1])); }
      b.set(mx - 1, 51, St[1]); b.set(mx, 51, St[1]);
      // a little banner in the kid's color
      if (ti === 1) for (let y = 66; y < 80; y += 1) for (let x = mx - 3; x < mx + 4; x += 1) { if (y > 76 && Math.abs(x + 0.5 - mx) < (y - 76) * 1.2) continue; b.set(x, y, x === mx - 3 ? R[4] : x === mx + 3 ? R[1] : R[2], tg('cloth', color)); }
    });
    // the main tower
    for (let y = 30; y < h - 1; y += 1) for (let x = main[0]; x < main[1]; x += 1) {
      if (y < 34 && ((x - main[0]) % 9) > 5) continue;
      let c = y < 34 ? (y === 30 ? St[6] : St[5]) : stone(x, y, x < main[0] + 5 ? 1 : x > main[1] - 6 ? -1 : 0);
      if (y === 34) c = St[2];
      b.set(x, y, c, tg('stone', St[3]));
    }
    // the door: an arch of dressed stones round studded oak, a step
    const dx0 = cx - 10; const dy0 = h - 30;
    for (let y = dy0 - 3; y < h - 1; y += 1) for (let x = dx0 - 3; x < dx0 + 23; x += 1) {
      const top = y < dy0 + 10; const inDoor = top ? Math.hypot(x + 0.5 - cx, y + 0.5 - (dy0 + 10)) <= 10 : Math.abs(x + 0.5 - cx) <= 10;
      const inArch = top ? Math.hypot(x + 0.5 - cx, y + 0.5 - (dy0 + 10)) <= 13 : Math.abs(x + 0.5 - cx) <= 13;
      if (inDoor) {
        const plank = Math.floor((x - dx0) / 4); let c = (x - dx0) % 4 === 3 ? Wd[1] : plank % 2 ? Wd[2] : Wd[3];
        if (y === dy0 + 12 || y === h - 8) c = '#5a5470';
        if ((y === dy0 + 12 || y === h - 8) && (x - dx0) % 3 === 1) c = '#c8c4d4';
        if (x + 0.5 < cx && x + 0.5 > cx - 1.5) c = Wd[0];
        b.set(x, y, c, tg('door', Wd[2]));
      } else if (inArch) {
        const a = Math.atan2(y + 0.5 - (dy0 + 10), x + 0.5 - cx); const vs = top ? Math.floor((a + Math.PI) * 4) % 2 : Math.floor(y / 4) % 2;
        b.set(x, y, x < cx ? (vs ? St[6] : St[5]) : (vs ? St[4] : St[3]), tg('stone', St[3]));
      }
    }
    grid((x, y, c) => b.set(x, y, c, tg('metal', Au[1])), cx + 3, h - 17, ['.gg.', 'g..g', '.gg.'], { g: Au[2] });
    for (let x = dx0 - 4; x < dx0 + 24; x += 1) { b.set(x, h - 2, St[5], tg('stone', St[3])); b.set(x, h - 1, St[3], tg('stone', St[3])); }
    // the banner over the door, in the kid's color, with a golden crown
    for (let y = 36; y < 60; y += 1) for (let x = cx - 7; x < cx + 7; x += 1) {
      if (y > 54 && Math.abs(x + 0.5 - cx) < (y - 54) * 1.3) continue;
      let c = x === cx - 7 ? R[4] : x === cx + 6 ? R[1] : (x - cx + 7) % 5 === 0 ? R[3] : R[2];
      if (y === 36) c = R[1];
      b.set(x, y, c, tg('cloth', color));
    }
    for (let x = cx - 9; x < cx + 9; x += 1) b.set(x, 35, Tb[2], tg('wood', Tb[2]));
    grid((x, y, c) => b.set(x, y, c, tg('cloth', color)), cx - 4, 41, ['g.g.g.g', 'ggggggg', 'gGgRgGg', 'ggggggg'], { g: Au[2], G: Au[3], R: '#ff6b8a' });
    // stained-glass windows either side, in lead frames
    [[main[0] + 7, 40], [main[1] - 15, 40]].forEach(([wx, wy], i) => {
      grid((x, y, c) => b.set(x, y, c, tg('glow', '#7048e8')), wx, wy, [
        '..kkkk..',
        '.kBRYBk.',
        'kRYkkYRk',
        'kBkYYkBk',
        'kYkRBkYk',
        'kRBkkRBk',
        'kBRYYRBk',
        'kkkkkkkk',
      ], { k: '#3a2a48', B: i ? '#5ab0f0' : '#7a6af0', R: i ? '#f06a8a' : '#f08a4a', Y: '#ffd860' });
      for (let x = wx; x < wx + 8; x += 1) b.set(x, wy + 8, St[6], tg('stone', St[4]));
    });
    // ivy up the left turret
    for (let k = 0; k < 34; k += 1) {
      const x = 4 + Math.round(Math.sin(k * 0.55) * 3 + k * 0.12); const y = h - 3 - k;
      b.set(x, y, k % 2 ? LF[3] : LF[2], tg('leaf', LF[3])); if (k % 3 === 0) { b.set(x + 1, y, LF[4], tg('leaf', LF[3])); b.set(x - 1, y - 1, LF[3], tg('leaf', LF[3])); }
      if (k % 7 === 3) b.set(x + 2, y + 1, LF[2], tg('leaf', LF[3]));
    }
    // the roofs, in the kid's color
    tur.forEach(([a, z]) => coneRoof(b, (a + z) / 2, 38, (z - a) / 2 + 3, 34, R, tg('roof', color)));
    coneRoof(b, cx, 32, 30, 54, R, tg('roof', color));
  }, {
    pad: 40,
    outline: sel,
    after: (b) => {
      // pennants and a golden weathervane star
      pennant(b, cx, -34, 13, color);
      tur.forEach(([a, z]) => pennant(b, Math.round((a + z) / 2), -8, 8, '#fcc419'));
      // little round windows in the roofs, glowing
      grid((x, y, c) => b.set(x, y, c, tg('glow', Gl[1])), cx - 3, 2, ['.kkk.', 'kYyYk', 'kyYyk', '.kkk.'], { k: mix(color, INK, 0.6), Y: Gl[3], y: Gl[2] });
    },
  });
}

// ---------- the town houses ----------

/**
 * A timber-framed town house, w x h: a steep tiled roof in the house's color with a cross
 * gable over the door, white plaster crossed by dark beams, a stone plinth, leaded windows
 * with shutters and window boxes, an oak door, a chimney. sign: 'note' for the music hall.
 */
function townK(px, X, Y, w, h, o = {}) {
  const R = ramp(o.roof || '#e64980', 3, 2); const Sh = ramp(o.shutter || '#7048e8', 2, 2);
  const seed = Math.round(X * 7 + Y);
  groundShadow(px, X + w / 2 + 3, Y + h - 1, w / 2 + 1, 3.5, 0.22);
  const rh = Math.round(h * 0.47); // where the roof meets the walls
  const gw = Math.round(w * 0.36); const gx = Math.round(w / 2 - gw / 2); // the cross gable
  propB(px, X, Y, w, h, (b) => {
    // the walls: plaster, beams, a plinth
    for (let y = rh - 2; y < h - 1; y += 1) {
      for (let x = 1; x < w - 1; x += 1) {
        let c = (bayer(x, y) < 0.15 && y > h - 14) ? WS[2] : WS[3];
        let tag = tg('wall', WS[2]);
        if (y >= h - 5) { c = masonry(x, y, { bw: 7, bh: 3, seed, P: [Wm[0], Wm[1], Wm[2], Wm[3], Wm[4], Wm[5], '#f0e6dc', '#fff8f0'] }); tag = tg('stone', Wm[3]); }
        else {
          const post = x % 14 < 2 || x > w - 4; const beam = y === rh - 2 || y === rh - 1 || y === h - 7 || y === h - 6;
          const panel = Math.floor(x / 14); const px0 = panel * 14 + 2; const pw = 12; const py0 = rh; const ph = h - 7 - rh;
          const dg = (panel + Math.floor(seed)) % 3 === 0 ? Math.abs((x - px0) / pw - (y - py0) / ph) < 0.09 : (panel % 3 === 1 ? Math.abs((x - px0) / pw - (1 - (y - py0) / ph)) < 0.09 : false);
          if (post || beam || dg) { c = (x % 14 === 0 && !beam) || y === rh - 1 || y === h - 6 ? Tb[1] : Tb[2]; tag = tg('wood', Tb[2]); }
          if (x < 3) c = beam || post ? Tb[1] : WS[4];
        }
        b.set(x, y, c, tag);
      }
    }
    // the cross gable's front: plaster with beams in a herringbone, a little round window
    const ga = -3; // its apex
    for (let y = ga; y < rh + 2; y += 1) {
      const half = ((y - ga) / (rh + 2 - ga)) * (gw / 2 + 4);
      for (let x = gx - 6; x < gx + gw + 6; x += 1) {
        if (Math.abs(x + 0.5 - (gx + gw / 2)) > half) continue;
        const u = x - gx; let c = WS[3]; let tag = tg('wall', WS[2]);
        if (y === rh + 1 || y === rh) { c = Tb[1]; tag = tg('wood', Tb[2]); }
        else if (Math.abs(u - gw / 2) < 1 || Math.abs(u + 0.5 - gw / 2 - ((y - 4) * 0.8)) < 0.7 || Math.abs(u + 0.5 - gw / 2 + ((y - 4) * 0.8)) < 0.7) { c = Tb[2]; tag = tg('wood', Tb[2]); }
        b.set(x, y, c, tag);
      }
    }
    // the main roof: rows of tiles, the hip ends lit and shaded
    for (let y = 0; y < rh; y += 1) {
      const inset = Math.round((1 - y / rh) * 12);
      for (let x = inset - 2; x < w - inset + 2; x += 1) {
        const row = Math.floor(y / 3); const v = y % 3;
        const sc = Math.floor((x + (row % 2) * 2) / 4); const su = x + (row % 2) * 2 - sc * 4;
        let i = 2;
        if (x < inset + 6) i = 3; else if (x > w - inset - 7) i = 1;
        if (v === 0) i += 1;
        if (v === 2 && su !== 1 && su !== 2) i -= 1;
        if (h2(sc, row, seed) < 0.08) i -= 1;
        if (y === rh - 1) i = 0;
        if (y === 0) i = 4;
        b.set(x, y, R[Math.max(0, Math.min(R.length - 1, i))], tg('roof', o.roof));
      }
    }
    // the gable's own roof: two sloping bargeboards of tiles
    for (let y = ga - 2; y < rh + 1; y += 1) {
      const half = ((y - ga + 2) / (rh + 3 - ga)) * (gw / 2 + 6);
      for (const s of [-1, 1]) for (let k = 0; k < 4; k += 1) {
        const x = Math.round(gx + gw / 2 + s * (half - k));
        b.set(x, y, k === 0 ? R[0] : s < 0 ? R[k === 3 ? 2 : 3] : R[k === 3 ? 1 : 2], tg('roof', o.roof));
      }
    }
    for (let y = ga - 2; y < ga; y += 1) b.set(gx + Math.round(gw / 2), y, R[4], tg('roof', o.roof));
    // the chimney
    const chx = w - 22;
    for (let y = -6; y < 9; y += 1) for (let x = chx; x < chx + 7; x += 1) b.set(x, y, y < -4 ? (x < chx + 3 ? Wm[5] : Wm[4]) : masonry(x, y + 20, { bw: 4, bh: 3, seed, P: [Wm[0], Wm[1], '#7a4a46', '#a8604e', '#c8785a', '#e09878', '#f0b898', '#ffd8c0'] }), tg('stone', '#a8604e'));
    // the door, under the gable
    const dx = Math.round(w / 2) - 6; const dh = 19;
    for (let y = h - 6 - dh; y < h - 5; y += 1) for (let x = dx; x < dx + 12; x += 1) {
      const top = y < h - 6 - dh + 6;
      if (top && Math.hypot(x + 0.5 - (dx + 6), y + 0.5 - (h - 6 - dh + 6)) > 6) continue;
      let c = (x - dx) % 4 === 3 ? Wd[1] : (x - dx) < 2 ? Wd[4] : Wd[3];
      if (y === h - 14) c = '#5a5470';
      b.set(x, y, c, tg('door', Wd[2]));
    }
    b.set(dx + 9, h - 13, Au[2], tg('metal', Au[1]));
    for (let x = dx - 2; x < dx + 14; x += 1) b.set(x, h - 5, Wm[4], tg('stone', Wm[3]));
    // windows: leaded diamond panes, warm light, shutters, a box of flowers
    const win = (wx, wy, ww, wh) => {
      for (let y = wy; y < wy + wh; y += 1) for (let x = wx; x < wx + ww; x += 1) {
        const fr = y === wy || y === wy + wh - 1 || x === wx || x === wx + ww - 1;
        const lead = ((x - wx) + (y - wy)) % 3 === 0 || ((x - wx) - (y - wy) + 30) % 3 === 0;
        b.set(x, y, fr ? Tb[1] : lead ? '#8a6a4a' : (y < wy + 3 ? Gl[3] : Gl[2]), fr ? tg('wood', Tb[2]) : tg('glow', Gl[2]));
      }
      for (let y = wy; y < wy + wh; y += 1) for (const sx of [wx - 4, wx + ww]) for (let k = 0; k < 4; k += 1) b.set(sx + k, y, (y - wy) % 3 === 0 ? Sh[1] : k === 0 ? Sh[3] : Sh[2], tg('wood', o.shutter));
      for (let x = wx - 1; x < wx + ww + 1; x += 1) { b.set(x, wy + wh, Wd[3], tg('wood', Wd[3])); b.set(x, wy + wh + 1, Wd[2], tg('wood', Wd[3])); }
    };
    win(10, rh + 6, 10, 10); win(w - 20, rh + 6, 10, 10);
    // the gable's little round window
    grid((x, y, c) => b.set(x, y, c, tg('glow', Gl[2])), gx + Math.round(gw / 2) - 3, rh - 12, ['.kkkk.', 'kYyYyk', 'kyYyYk', 'kYyYyk', '.kkkk.'], { k: Tb[1], Y: Gl[3], y: Gl[2] });
  }, {
    pad: 10,
    outline: sel,
    after: (b) => {
      // flowers in the window boxes
      const rh2 = rh + 6 + 10;
      [9, w - 21].forEach((wx, i) => { for (let x = wx; x < wx + 12; x += 2) { b.set(x, rh2 - 1, i ? '#ff8ab0' : '#ffd23f', tg('fl', LF[2])); b.set(x + 1, rh2 - 1, LF[4], tg('fl', LF[2])); b.set(x, rh2 - 2, i ? '#ffd2e2' : '#fff4a8', tg('fl', LF[2])); } });
      if (o.sign === 'note') {
        // the music hall's sign: a board on a bracket with a note painted on it, and a lute by the door
        for (let x = w - 30; x < w - 18; x += 1) b.set(x, rh + 1, Tb[1], tg('wood', Tb[2]));
        grid((x, y, c) => b.set(x, y, c, tg('wood', Wd[3])), w - 29, rh + 2, ['.s......s.', 'LLLLLLLLLD', 'LccccNNccD', 'LccccNcNcD', 'LccccNccND', 'LcNNNNcccD', 'LNNNNNcccD', 'LcNNNccccD', 'DDDDDDDDDD'], { s: Tb[0], L: Wd[4], D: Wd[1], c: '#fff4d8', N: '#3a2a48' });
      }
    },
  });
  smokeB(px, X + w - 19, Y - 6);
}

// ---------- props ----------

/** The wishing fountain, 40 x 32: a round stone basin, a tiered column with water falling, coins under the water. */
function fountainK(px, X, Y) {
  groundShadow(px, X + 21, Y + 29, 19, 3, 0.2);
  propB(px, X, Y, 40, 32, (b) => {
    // the basin
    for (let y = 14; y < 32; y += 1) for (let x = 0; x < 40; x += 1) {
      if (!inEll(x, y, 20, 22, 20, 9)) continue;
      const lip = !inEll(x, y, 20, 22, 17, 7);
      const front = y >= 22;
      let c;
      if (front && !inEll(x, y - 3, 20, 22, 20, 9)) c = masonry(x, y, { bw: 6, bh: 3, seed: 2, lit: x < 12 ? 1 : x > 28 ? -1 : 0 }); // its outside face
      else if (lip) c = y < 19 ? St[6] : x < 20 ? St[6] : St[5];
      else c = y < 19 ? Wa[2] : bayer(x, y) < 0.5 ? Wa[3] : Wa[4];
      b.set(x, y, c, lip || (front && !inEll(x, y - 3, 20, 22, 20, 9)) ? tg('stone', St[4]) : tg('water', Wa[3]));
    }
    // the column and its bowl
    for (let y = 4; y < 24; y += 1) for (let x = 18; x < 23; x += 1) b.set(x, y, x === 18 ? St[6] : x === 22 ? St[3] : St[5], tg('stone', St[4]));
    for (let y = 6; y < 11; y += 1) for (let x = 10; x < 31; x += 1) if (inEll(x, y, 20.5, 8, 10, 3)) b.set(x, y, y < 8 ? (inEll(x, y, 20.5, 8, 8, 1.8) ? Wa[3] : St[6]) : (x < 20 ? St[5] : St[4]), tg('stone', St[4]));
    for (let y = 0; y < 5; y += 1) for (let x = 18; x < 23; x += 1) if (inEll(x, y, 20.5, 2.5, 2.4, 2.6)) b.set(x, y, x < 20 ? Au[3] : Au[2], tg('metal', Au[1]));
  }, {
    outline: sel,
    after: (b) => {
      // water falling from the bowl, and coins glinting under it
      for (const [x0, dir] of [[11, -1], [30, 1]]) for (let k = 0; k < 11; k += 1) b.set(x0 + dir * Math.round(k * 0.35), 10 + k, k % 3 === 2 ? Wa[6] : Wa[5], tg('fx', Wa[5]));
      for (let k = 0; k < 4; k += 1) b.set(19 + k, 11 + k * 2, Wa[6], tg('fx', Wa[5]));
      [[8, 21], [14, 24], [25, 25], [31, 22], [12, 19], [28, 19]].forEach(([x, y], i) => { b.set(x, y, Au[i % 2 ? 2 : 3], tg('fx', Au[2])); b.set(x + 1, y, Au[1], tg('fx', Au[2])); });
    },
  });
}

/** A banner on a tall pole, 12 x 38: a swallowtailed flag in its color with a golden crown. */
function bannerK(px, X, Y, col) {
  const P = ramp(col, 3, 2);
  groundShadow(px, X + 6, Y + 37, 4, 1.2, 0.2);
  propB(px, X, Y, 12, 38, (b) => {
    for (let y = 2; y < 38; y += 1) { b.set(5, y, Tb[2], tg('wood', Tb[2])); b.set(6, y, Tb[1], tg('wood', Tb[2])); }
    for (let x = 0; x < 12; x += 1) b.set(x, 4, Au[1], tg('metal', Au[1]));
    b.set(5, 0, Au[3], tg('metal', Au[1])); b.set(6, 0, Au[2], tg('metal', Au[1])); b.set(5, 1, Au[2], tg('metal', Au[1])); b.set(6, 1, Au[1], tg('metal', Au[1]));
    for (let y = 5; y < 27; y += 1) for (let x = 1; x < 11; x += 1) {
      if (y > 22 && Math.abs(x + 0.5 - 6) < (y - 22) * 1.3) continue;
      const fold = Math.sin(x * 1.3 + y * 0.1);
      b.set(x, y, x === 1 ? P[4] : x === 10 ? P[1] : fold > 0.7 ? P[3] : fold < -0.8 ? P[1] : P[2], tg('cloth', col));
    }
    grid((x, y, c) => b.set(x, y, c, tg('cloth', col)), 3, 10, ['g.g.g', 'ggggg', 'gGgGg', 'ggggg'], { g: Au[2], G: Au[3] });
    b.set(4, 16, Au[2], tg('cloth', col)); b.set(5, 17, Au[2], tg('cloth', col)); b.set(6, 16, Au[2], tg('cloth', col));
  }, { outline: sel });
}

/** A round bale of hay, 22 x 16, tied with twine, a few loose straws. */
function haybaleK(px, X, Y) {
  groundShadow(px, X + 12, Y + 15, 11, 2, 0.2);
  propB(px, X, Y, 22, 16, (b) => {
    for (let y = 0; y < 16; y += 1) for (let x = 0; x < 22; x += 1) {
      const top = y < 6 && inEll(x, y, 11, 5.5, 11, 5.5); const body = y >= 5 && y < 15 && x >= 0 && x < 22;
      if (!top && !body && !(y >= 14 && inEll(x, y, 11, 14, 11, 2))) continue;
      const n = h2(x, y >> 1, 3);
      let c = top ? (y < 2 ? T[5] : T[4]) : x < 4 ? T[4] : x > 17 ? T[2] : T[3];
      if (!top && (n < 0.2)) c = T[2]; else if (!top && n > 0.88) c = T[5];
      if (top && (Math.hypot(x + 0.5 - 11, (y + 0.5 - 5.5) * 2) % 4) < 1) c = T[3];
      if (x === 6 || x === 15) c = y < 5 ? T[2] : '#a8603a';
      b.set(x, y, c, tg('hay', T[3]));
    }
  }, { outline: sel });
  px(X + 2, Y + 15, T[4]); px(X + 3, Y + 16, T[3]); px(X + 20, Y + 15, T[4]); px(X + 21, Y + 14, T[5]);
}

/** The buddy shop's stall, 44 x 33: a striped awning (pal.a and pal.b), capes, a crown and a feathered hat on the counter. */
function stallK(px, X, Y, pal = {}) {
  const A = ramp(pal.a || '#7048e8', 2, 2); const B = ramp(pal.b || '#fff3bf', 2, 1);
  groundShadow(px, X + 23, Y + 31, 22, 2.4, 0.2);
  propB(px, X, Y, 44, 33, (b, put) => {
    b.fill(5, 9, 34, 12, (x, y) => (y < 11 ? '#3a2a4a' : bayer(x, y) < 0.5 ? '#5a4060' : '#4a3654'), tg('wood', Wd[2]));
    b.rect(5, 11, 34, 1, Wd[3], tg('wood', Wd[3]));
    // capes hanging inside
    grid(put(tg('cloth', '#e64940')), 8, 12, ['.rr.', 'rRRr', 'rRrr', 'rrrr', 'rrdr', 'rd.r'], { r: '#e64940', R: '#ff8a7a', d: '#a82a30' });
    grid(put(tg('cloth', '#1c7ed6')), 31, 12, ['.bb.', 'bBBb', 'bBbb', 'bbbb', 'bbdb', 'bd.b'], { b: '#3a8ae0', B: '#8ac4ff', d: '#1a5aa8' });
    for (const x of [2, 39]) { b.rect(x, 8, 1, 23, Wd[4], tg('wood', Wd[3])); b.rect(x + 1, 8, 1, 23, Wd[3], tg('wood', Wd[3])); b.rect(x + 2, 8, 1, 23, Wd[2], tg('wood', Wd[3])); }
    b.rect(1, 20, 42, 1, Wd[5], tg('wood', Wd[3])); b.rect(1, 21, 42, 1, Wd[4], tg('wood', Wd[3]));
    for (let x = 1; x < 43; x += 1) for (let y = 22; y < 30; y += 1) {
      let c = (x - 1) % 6 === 5 ? Wd[2] : Wd[3];
      if (y === 29) c = Wd[1];
      if (y < 26) c = Math.floor((x - 1) / 4) % 2 ? A[2] : A[3];
      if (y === 25) c = Au[2];
      b.set(x, y, c, y < 26 ? tg('cloth', pal.a || '#7048e8') : tg('wood', Wd[3]));
    }
    // the awning: stripes of the two colors, a scalloped hem
    for (let y = 0; y < 11; y += 1) for (let x = 0; x < 44; x += 1) {
      const s = Math.floor(x / 6) % 2; const P = s ? B : A; const sx = x % 6;
      if (y === 0 && (x === 0 || x === 43)) continue;
      if (y >= 8) { const dx = Math.abs(sx + 0.5 - 3); if ((y === 8 && dx > 3) || (y === 9 && dx > 2.5) || (y === 10 && dx > 1.5)) continue; b.set(x, y, y === 10 || sx === 5 ? P[1] : P[2], tg('cloth', s ? (pal.b || '#fff3bf') : (pal.a || '#7048e8'))); continue; }
      let c = y < 2 ? P[P.length - 1] : P[P.length - 2];
      if (y >= 4 && sx === 5) c = P[1];
      if (y === 7) c = P[1];
      if (x > 37 && y >= 2) c = P[1];
      b.set(x, y, c, tg('cloth', s ? (pal.b || '#fff3bf') : (pal.a || '#7048e8')));
    }
  }, {
    outline: sel,
    after: (b, put) => {
      // a sign with a crown on it, a crown, a feathered hat
      grid(put(tg('wood', Wd[3])), 15, 10, ['.s..........s.', 'LLLLLLLLLLLLLD', 'LccccccccccccD', 'LccgcgcgcgcccD', 'LcccgggggggccD', 'LcccgGgRgGgccD', 'LcccgggggggccD', 'LccccccccccccD', 'DDDDDDDDDDDDDD'], { s: Tb[0], L: Wd[4], D: Wd[1], c: '#fff4d8', g: Au[2], G: Au[3], R: '#e64940' });
      grid(put(tg('metal', Au[2])), 5, 17, ['g.g.g', 'ggggg', 'gRgBg'], { g: Au[2], R: '#e64940', B: '#3a8ae0' });
      grid(put(tg('cloth', '#2f8a5a')), 30, 15, ['....ff', '...ff.', '.hhhh.', 'hhhhhh', 'HHHHHH'], { f: '#ffffff', h: '#2f8a5a', H: '#1e6a44' });
    },
  });
}

// ---------- castle whimsy ----------

/** A straw training dummy on a post, 18 x 30, a dented old helmet on its head and a wooden shield. */
export function dummyK(px, X, Y) {
  groundShadow(px, X + 9, Y + 29, 6, 1.5, 0.2);
  propB(px, X, Y, 18, 30, (b) => {
    for (let y = 8; y < 30; y += 1) { b.set(8, y, Wd[3], tg('wood', Wd[3])); b.set(9, y, Wd[2], tg('wood', Wd[3])); }
    for (let x = 0; x < 18; x += 1) { b.set(x, 13, Wd[4], tg('wood', Wd[3])); b.set(x, 14, Wd[2], tg('wood', Wd[3])); }
    // the straw body, bound with rope
    for (let y = 10; y < 24; y += 1) for (let x = 4; x < 14; x += 1) { if (!inEll(x, y, 9, 17, 5.2, 7.5)) continue; b.set(x, y, y === 15 || y === 20 ? '#a8603a' : x < 7 ? T[4] : x > 11 ? T[2] : (h2(x, y, 4) < 0.2 ? T[2] : T[3]), tg('hay', T[3])); }
    for (const sx of [0, 15]) for (let k = 0; k < 3; k += 1) b.set(sx + k, 12 + (k % 2), T[4], tg('hay', T[3]));
    // the helmet, with a dent
    for (let y = 1; y < 10; y += 1) for (let x = 4; x < 14; x += 1) {
      if (!inEll(x, y, 9, 6, 5, 5.2)) continue;
      let c = x < 7 ? '#d8d6e4' : x > 11 ? '#7a7890' : '#aeacc2';
      if (y === 6 && x > 5 && x < 13) c = '#2a2438'; // the visor slit
      if (inEll(x, y, 11, 3, 1.6, 1.2)) c = '#6a6880';
      b.set(x, y, c, tg('metal', '#aeacc2'));
    }
    b.set(9, 0, '#e64940', tg('cloth', '#e64940')); b.set(10, 0, '#ff8a7a', tg('cloth', '#e64940')); b.set(9, -1, '#e64940', tg('cloth', '#e64940'));
    // a round wooden shield on its arm
    for (let y = 14; y < 24; y += 1) for (let x = 11; x < 19; x += 1) if (inEll(x, y, 15, 19, 4, 5)) b.set(x, y, inEll(x, y, 15, 19, 1.4, 1.6) ? Au[2] : (x + y) % 4 < 2 ? '#3a8ae0' : '#2a6ac0', tg('wood', '#2a6ac0'));
  }, { outline: sel, pad: 5 });
}

/** A rack of wooden practice swords, a spear and a round shield, 26 x 22. */
export function rackK(px, X, Y) {
  groundShadow(px, X + 13, Y + 21, 12, 1.6, 0.2);
  propB(px, X, Y, 26, 22, (b) => {
    const D = ['#3a2430', '#5a3a34', '#7a5040'];
    for (const x of [1, 22]) for (let y = 6; y < 22; y += 1) { b.set(x, y, D[2], tg('wood', D[2])); b.set(x + 1, y, D[1], tg('wood', D[2])); }
    for (let x = 0; x < 24; x += 1) { b.set(x, 15, D[2], tg('wood', D[2])); b.set(x, 16, D[1], tg('wood', D[2])); }
    // three wooden swords: a pointed blade, a dark crossguard, a red grip, a gold pommel
    [5, 10, 15].forEach((x, i) => {
      const top = 1 + (i % 2) * 2;
      for (let y = top; y < 13; y += 1) {
        if (y === top) { b.set(x, y, '#f6e2bc', tg('wood', '#d8b888')); continue; }
        b.set(x, y, '#f0d8b0', tg('wood', '#d8b888')); b.set(x + 1, y, '#c8a070', tg('wood', '#d8b888'));
      }
      for (let k = -1; k < 3; k += 1) b.set(x + k, 13, D[1], tg('wood', D[2]));
      b.set(x, 14, '#e64940', tg('cloth', '#e64940')); b.set(x + 1, 14, '#a82a30', tg('cloth', '#e64940'));
      b.set(x, 15, '#e64940', tg('cloth', '#e64940')); b.set(x + 1, 15, '#a82a30', tg('cloth', '#e64940'));
      b.set(x, 17, Au[3], tg('metal', Au[2])); b.set(x + 1, 17, Au[1], tg('metal', Au[2]));
    });
    // a spear leaning at the end
    for (let y = 0; y < 21; y += 1) b.set(20, y + 1, D[2], tg('wood', D[2]));
    grid((x, y, c) => b.set(x, y, c, tg('metal', '#8a88a0')), 19, -3, ['.m.', 'mMm', 'mMm', '.m.'], { m: '#aeacc2', M: '#e8e6f2' });
  }, {
    outline: sel,
    pad: 5,
    after: (b) => {
      // a round shield hung on the post
      for (let y = 9; y < 20; y += 1) for (let x = 19; x < 27; x += 1) if (inEll(x, y, 23, 14.5, 4, 5)) b.set(x, y, inEll(x, y, 23, 14.5, 1.3, 1.5) ? Au[3] : (Math.atan2(y - 14.5, x - 23) > 0 ? '#2a6ac0' : '#3a8ae0'), tg('wood', '#2a6ac0'));
    },
  });
}

/** An archery target on a stand, 20 x 26, an arrow in the gold. */
export function targetK(px, X, Y) {
  groundShadow(px, X + 10, Y + 25, 8, 1.5, 0.2);
  propB(px, X, Y, 20, 26, (b) => {
    for (const [x0, x1] of [[4, 2], [15, 17]]) for (let y = 10; y < 26; y += 1) { const x = Math.round(x0 + ((x1 - x0) * (y - 10)) / 16); b.set(x, y, Wd[3], tg('wood', Wd[3])); b.set(x + 1, y, Wd[2], tg('wood', Wd[3])); }
    for (let y = 0; y < 20; y += 1) for (let x = 0; x < 20; x += 1) {
      const d = Math.hypot(x + 0.5 - 10, y + 0.5 - 9.5);
      if (d > 9) continue;
      const ring = d < 2 ? 0 : d < 4 ? 1 : d < 6 ? 2 : d < 8 ? 3 : 4;
      let c = ['#ffd84a', '#e64940', '#3a8ae0', '#f6f2ea', '#c8a868'][ring];
      if ((x + 0.5 - 10) + (y + 0.5 - 9.5) > d * 0.8 && ring > 0) c = mix(c, INK, 0.2);
      b.set(x, y, c, tg('hay', '#c8a868'));
    }
  }, {
    outline: sel,
    after: (b) => {
      for (let k = 0; k < 6; k += 1) b.set(11 + k, 8 - Math.round(k * 0.6), Wd[2], tg('wood', Wd[2]));
      grid((x, y, c) => b.set(x, y, c, tg('cloth', '#ffffff')), 16, 3, ['w.', 'ww', '.w'], { w: '#ffffff' });
    },
  });
}

/** The blacksmith's anvil on a stump, 26 x 20, a hammer and a little shower of sparks, a horseshoe. */
export function anvilK(px, X, Y) {
  groundShadow(px, X + 13, Y + 19, 11, 1.8, 0.22);
  propB(px, X, Y, 26, 20, (b) => {
    for (let y = 11; y < 20; y += 1) for (let x = 7; x < 19; x += 1) b.set(x, y, y === 11 ? Wd[4] : x < 9 ? Wd[4] : x > 16 ? Wd[1] : (y % 3 === 0 ? Wd[2] : Wd[3]), tg('wood', Wd[3]));
    for (let y = 4; y < 11; y += 1) for (let x = 2; x < 24; x += 1) {
      const horn = y < 7 && x < 8 && Math.abs(y + 0.5 - 5.5) < (x - 1) * 0.35;
      const face = y < 7 && x >= 8 && x < 22; const waist = y >= 7 && x >= 10 && x < 17; const foot = y >= 9 && x >= 8 && x < 19;
      if (!horn && !face && !waist && !foot) continue;
      b.set(x, y, y === 4 ? '#c8c6d8' : x < 12 ? '#7a7890' : '#5a5870', tg('metal', '#6a6880'));
    }
    // the hammer
    for (let k = 0; k < 9; k += 1) b.set(15 + k, 3 - Math.round(k * 0.3), Wd[3], tg('wood', Wd[3]));
    for (let y = -1; y < 3; y += 1) for (let x = 13; x < 17; x += 1) b.set(x, y, x < 15 ? '#aeacc2' : '#6a6880', tg('metal', '#6a6880'));
    // a glowing horseshoe on the anvil
    grid((x, y, c) => b.set(x, y, c, tg('glow', '#ff8a3a')), 17, 2, ['o..o', 'O..O', '.OO.'], { o: '#ffd060', O: '#ff8a3a' });
  }, {
    outline: sel,
    after: (b) => [[18, -2], [21, -4], [23, -1], [16, -4], [20, 0], [24, -3]].forEach(([x, y], i) => b.set(x, y, i % 2 ? '#ffe680' : '#ffb040', tg('fx', '#ffe680'))),
    pad: 6,
  });
}

/** A big old hound fast asleep on a blanket, 26 x 15: spotted white and brown, a long floppy ear, its tail curled round. */
export function houndK(px, X, Y) {
  groundShadow(px, X + 13, Y + 13, 12, 2, 0.18);
  const F = ['#7a4a30', '#a8683e', '#d0905a', '#f6ece0', '#fffaf2'];
  propB(px, X, Y, 26, 15, (b) => {
    // the blanket
    for (let y = 9; y < 15; y += 1) for (let x = 0; x < 26; x += 1) if (inEll(x, y, 13, 12, 13, 3.2)) b.set(x, y, (Math.floor(x / 3) + Math.floor(y / 2)) % 2 ? '#e64940' : '#fff0dc', tg('cloth', '#e64940'));
    // its body, curled up: white with a brown saddle
    for (let y = 2; y < 13; y += 1) for (let x = 8; x < 25; x += 1) {
      if (!inEll(x, y, 16.5, 7.5, 8, 5)) continue;
      const saddle = inEll(x, y, 18, 5, 6, 3.4);
      b.set(x, y, saddle ? (y < 4 ? F[2] : F[1]) : (x > 22 || y > 10 ? '#e2d4c4' : F[3]), tg('fur', F[1]));
    }
    // the tail curled round the front
    for (let k = 0; k < 9; k += 1) b.set(22 - k, 12 - Math.round(Math.sin(k / 3) * 1.5), k > 6 ? F[4] : F[2], tg('fur', F[1]));
    // its head on its paws: brown on top, a white muzzle
    for (let y = 3; y < 12; y += 1) for (let x = 1; x < 12; x += 1) {
      if (!inEll(x, y, 6.5, 7.5, 5.2, 4.2)) continue;
      b.set(x, y, y < 7 && x > 3 ? F[2] : x < 5 ? F[4] : F[3], tg('fur', F[1]));
    }
    grid((x, y, c) => b.set(x, y, c, tg('fur', F[1])), 2, 10, ['wwwww', '.w.w.'], { w: F[4] }); // front paws
  }, {
    outline: sel,
    pad: 6,
    after: (b) => {
      // the long floppy ear, the nose, a closed eye, and a z
      grid((x, y, c) => b.set(x, y, c, tg('fur', F[0])), 7, 4, ['.ee', 'eEe', 'eEe', 'eee', 'ee.', 'e..'], { e: F[0], E: F[1] });
      b.set(1, 7, '#2a1a20', tg('fx', '#2a1a20')); b.set(1, 8, '#2a1a20', tg('fx', '#2a1a20'));
      b.set(4, 5, '#3a2428', tg('fx', '#3a2428')); b.set(5, 5, '#3a2428', tg('fx', '#3a2428'));
      grid((x, y, c) => b.set(x, y, c, tg('fx', '#ffffff')), 0, -4, ['zzz', '.z.', 'zzz'], { z: 'rgba(255,255,255,0.92)' });
    },
  });
}

/** A hay cart, 38 x 26: two big spoked wheels, plank sides, piled high with hay, a pitchfork. */
export function cartK(px, X, Y) {
  groundShadow(px, X + 19, Y + 25, 18, 2, 0.2);
  propB(px, X, Y, 38, 26, (b) => {
    // the hay
    for (let y = 0; y < 12; y += 1) for (let x = 3; x < 33; x += 1) {
      if (!inEll(x, y, 18, 11, 15, 10)) continue;
      const n = h2(x, y >> 1, 8);
      b.set(x, y, y < 3 ? T[5] : x < 10 ? T[4] : x > 26 ? T[2] : n < 0.2 ? T[2] : n > 0.85 ? T[5] : T[3], tg('hay', T[3]));
    }
    // the bed and its sides
    for (let y = 10; y < 18; y += 1) for (let x = 2; x < 34; x += 1) b.set(x, y, y === 10 ? Wd[4] : y === 17 ? Wd[1] : (x % 8 === 0 ? Wd[2] : Wd[3]), tg('wood', Wd[3]));
    for (let x = 34; x < 38; x += 1) { b.set(x, 14, Wd[3], tg('wood', Wd[3])); b.set(x, 15, Wd[2], tg('wood', Wd[3])); } // the shafts
    // wheels
    for (const wx of [9, 27]) for (let y = 13; y < 26; y += 1) for (let x = wx - 7; x < wx + 7; x += 1) {
      const d = Math.hypot(x + 0.5 - wx, y + 0.5 - 19.5);
      if (d > 6.3) continue;
      const a = Math.atan2(y + 0.5 - 19.5, x + 0.5 - wx);
      if (d > 4.8) b.set(x, y, d > 5.8 ? Wd[1] : Wd[3], tg('wood', Wd[2]));
      else if (d < 1.4) b.set(x, y, '#6a6478', tg('metal', '#6a6478'));
      else if (Math.abs(Math.sin(a * 3)) < 0.28) b.set(x, y, Wd[2], tg('wood', Wd[2]));
    }
  }, {
    outline: sel,
    after: (b) => {
      for (let k = 0; k < 14; k += 1) b.set(28 - k, -2 + k, Wd[3], tg('wood', Wd[3]));
      grid((x, y, c) => b.set(x, y, c, tg('metal', '#8a88a0')), 27, -5, ['m.m.m', 'mmmmm', '..m..'], { m: '#aeacc2' });
    },
    pad: 6,
  });
}

/** A little bell tower, 20 x 34: a stone foot, oak posts and a tiled cap, a bronze bell with a rope. */
export function bellK(px, X, Y) {
  groundShadow(px, X + 10, Y + 33, 9, 1.6, 0.2);
  propB(px, X, Y, 20, 34, (b) => {
    for (let y = 26; y < 34; y += 1) for (let x = 1; x < 19; x += 1) b.set(x, y, masonry(x, y, { bw: 6, bh: 3, seed: 8, lit: x < 6 ? 1 : x > 14 ? -1 : 0 }), tg('stone', St[3]));
    for (const x of [3, 15]) for (let y = 7; y < 26; y += 1) { b.set(x, y, Wd[3], tg('wood', Wd[3])); b.set(x + 1, y, Wd[2], tg('wood', Wd[3])); }
    for (let x = 2; x < 18; x += 1) { b.set(x, 8, Wd[4], tg('wood', Wd[3])); b.set(x, 9, Wd[2], tg('wood', Wd[3])); }
    // the cap
    for (let y = 0; y < 8; y += 1) { const half = 3 + y * 1.2; for (let x = Math.round(10 - half); x < Math.round(10 + half); x += 1) b.set(x, y, x < 9 ? Sl[4] : x > 12 ? Sl[1] : Sl[3], tg('roof', Sl[3])); }
    // the bell
    for (let y = 10; y < 20; y += 1) for (let x = 5; x < 15; x += 1) {
      const half = 2.2 + Math.pow((y - 10) / 9, 1.6) * 3.2;
      if (Math.abs(x + 0.5 - 10) > half) continue;
      b.set(x, y, y === 19 ? '#8a5a1a' : x < 9 ? '#f0c060' : x > 11 ? '#a8742a' : '#d8a040', tg('metal', '#c8902a'));
    }
    b.set(10, 20, '#6a4a2a', tg('metal', '#c8902a'));
    for (let y = 20; y < 30; y += 1) b.set(11 + (y > 26 ? 1 : 0), y, '#e8d4b0', tg('cloth', '#c8b490'));
  }, { outline: sel });
}

// ---------- little things on the grass ----------

function scatterK(px, L, areas, seed) {
  const rnd = rng(seed);
  const busy = (x, y) => L.blocked(x, y, 6) || L.onPath(x, y, 9) || L.inWater(x, y, 6) || areas.some((a) => x > a.x - 10 && x < a.x + a.w + 10 && y > a.y - 10 && y < a.y + a.h + 10);
  for (let i = 0; i < 70; i += 1) {
    const x = 24 + Math.floor(rnd() * (L.W - 48)); const y = 26 + Math.floor(rnd() * (L.H - 50));
    if (busy(x, y)) continue;
    const k = rnd();
    if (k < 0.3) stoneB(px, x, y, 2.2, 1.5, rnd() < 0.5, seed + i);
    else if (k < 0.55) tuft(px, x, y, i);
    else if (k < 0.75) flowerB(px, x, y, ['daisy', 'forget', 'cup'][i % 3], ['white', 'blue', 'yellow'][i % 3]);
    else { px(x, y, '#ff9ac0'); px(x + 1, y + 1, '#ffd2e2'); } // a fallen petal
  }
}

// ---------- the whole village ----------

/**
 * Paints the Castle village in style B. opts: { homeRoof: the kid's color (the keep's roofs
 * and banners), areas: the green's ponds and play patches }. lib: { waterDepth, PROPS } from
 * villageprops.js (passed in so the two files don't import each other).
 */
export function paintCastle(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 5501;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];

  grassB(px, L.W, L.H, seed, { flowers: 1.2 });
  cobblesK(px, L, seed + 2);
  courtyardK(px, 156, 128, 136, 50, seed + 4);
  L.plazas.forEach(([x, y, r], i) => plazaK(px, x, y, r, seed + 40 + i, i === L.plazas.length - 1));
  L.water.forEach((wa, i) => moatK(px, L, wa, seed + 60 + i));
  // a family of ducks on the moat
  duckK(px, 342, 120, false, -1); duckK(px, 352, 128, true, -1); duckK(px, 358, 133, true, -1);
  areas.forEach((a, i) => {
    if (a.kind === 'pond') poolK(px, a, seed + 70 + i, false);
    else if (a.kind === 'hockey') poolK(px, a, seed + 70 + i, true);
    else yardK(px, a, a.kind, seed + 70 + i);
  });
  L.crossings.forEach((c) => drawbridgeK(px, c));
  scatterK(px, L, areas, seed + 90);
  wallsK(px, L, seed + 100);

  const DRAW = {
    tree: (p) => treeB(px, p, L),
    bush: (p) => bushB(px, p.x, p.y, p.berries),
    well: (p) => wellB(px, p.x, p.y),
    garden: (p) => gardenB(px, p.x, p.y, p.w || 62, p.h || 34),
    stall: (p) => stallK(px, p.x, p.y, p.pal),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
    flowers: (p) => flowersB(px, p.x, p.y, p.x + p.y),
    fountain: (p) => fountainK(px, p.x, p.y),
    banner: (p) => bannerK(px, p.x, p.y, p.c || '#7048e8'),
    haybale: (p) => haybaleK(px, p.x, p.y),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const under = (p) => areas.some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  L.props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);

  const home = L.home;
  const things = [
    { y: home.y + home.h, draw: () => keepK(px, home.x, home.y, home.w, home.h, opts.homeRoof || '#e03131') },
    ...L.houses.map((hs) => ({ y: hs.y + hs.h, draw: () => townK(px, hs.x, hs.y, hs.w, hs.h, { roof: hs.roof, shutter: hs.shutter, sign: hs.sign }) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
