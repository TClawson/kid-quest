// The Golden Galaxy in style B, "soft storybook": a warm, magical night rather than cold sci-fi.
// Deep indigo-violet ground drifting with soft nebula clouds and sprinkled with stars, a ridge of
// glowing crystal spires round the edge, paths of glowing golden stepping stones in a trail of
// star-dust, round golden star-dial plazas, the stream of stars as a river between shimmering
// banks with a golden bridge over it, golden domes with brass ribs and glowing round windows (the
// kid's dome is their own color), and the green as the galaxy has it: a nebula pool, a moon-glass
// rink, a star-dust field with golden goals.
// Whimsy: a brass telescope on a tripod, a moon-rock garden with moon flowers, a star puppy asleep
// in a crater bed, a comet weather vane, a planet swing, a jar of stardust, and a meteor in its
// crater with a "do not touch" sign.
//
// One canvas pixel per village pixel, painted into one ImageData and shown with a single
// putImageData. villageprops.js calls paintGalaxy() for 'bg-galaxy' only.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, pathField, pixelBuffer } from './pixelkit.js';
import { propB, groundShadow, laundryB } from './meadowart.js';
import { sel, tg } from './castleart.js';

const INK = '#140c2c';
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
export const GXP = {
  night: ['#0e0924', '#150e34', '#1d1446', '#261b56', '#2f2366', '#3a2c78', '#47388c', '#5848a2'], // base 3
  gold: ['#5a2a10', '#8a4a14', '#c07a1c', '#e8a82a', '#fcc83c', '#ffe27a', '#fff6c8'],
  brass: ['#3a2018', '#6a3e20', '#9a6428', '#c48a36', '#e2b056', '#f6d68a'],
  cream: ['#5e4a6e', '#8a7090', '#b49cae', '#d8c4c4', '#eee0d4', '#fbf4e8'],
};
const NT = GXP.night; const GD = GXP.gold; const BR = GXP.brass; const CR = GXP.cream;
const NEB = ['#c45ab4', '#7e52d6', '#3e8cc8'];
const LIL = ramp('#b197fc', 3, 3);
const CRYS = { gold: ramp('#ffd43b', 3, 3), lilac: LIL, teal: ramp('#63e6be', 3, 3), rose: ramp('#f783ac', 3, 3) };
const crysOf = (c) => (!c ? CRYS.lilac : /ffe066|ffd43b|fcc419|ffa94d|f59f00/i.test(c) ? CRYS.gold : /63e6be|38d9a9/i.test(c) ? CRYS.teal : ramp(c, 3, 3));
const line = (x0, y0, x1, y1, fn) => { const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5)); for (let i = 0; i <= n; i += 1) fn(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), i / n); };
const edgeOf = (t, side) => {
  const k = String(t).split(':')[0];
  if (k === 'glow' || k === 'fx' || k === 'water' || k === 'net' || k === 'star') return null;
  if (k === 'crys') return side === 'top' || side === 'left' ? mix(String(t).split(':')[1], '#ffffff', 0.15) : mix(String(t).split(':')[1], INK, 0.5);
  return sel(t, side);
};
/** A soft round glow on the ground: dithered light, strongest in the middle. */
function glow(px, cx, cy, rx, ry, c, k = 0.5) {
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const e = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (e >= 1) continue;
      if (bayer(x, y) < (1 - e) * k * 1.6) px(x, y, c + (e < 0.35 ? '66' : '38'));
    }
  }
}
/** A four-point twinkle. */
const twinkle = (px, x, y, c = '#ffffff', big = false) => {
  px(x, y, '#ffffff'); px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c);
  if (big) { px(x - 2, y, c + '99'); px(x + 2, y, c + '99'); px(x, y - 2, c + '99'); px(x, y + 2, c + '99'); }
};

// ---------- the night ground ----------

function groundGX(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const t = (bayer(x, y) - 0.5) * 0.2;
      const n = vnoise(x, y, 34, seed) * 0.6 + vnoise(x, y, 11, seed + 1) * 0.4;
      let i = n < 0.34 + t ? 2 : n < 0.66 + t ? 3 : 4;
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e < 50 && (50 - e) / 50 > 0.45 + t * 2) i -= 1;
      let c = NT[clamp(i, 0, 7)];
      // nebula clouds: soft drifts of rose, violet and blue mist
      const k = (vnoise(x, y, 64, seed + 3) - 0.56) * 2.4 + (vnoise(x, y, 17, seed + 4) - 0.5) * 0.7;
      if (k > 0) {
        const w = vnoise(x, y, 110, seed + 5);
        const tint = NEB[w < 0.42 ? 0 : w < 0.68 ? 1 : 2];
        const a = Math.min(1, k * 1.4);
        const b = bayer(x, y);
        if (b < a) c = mix(c, tint, b < a * 0.4 ? 0.42 : 0.26);
      }
      // stars, warm and cool
      const s = h2(x, y, seed + 6);
      if (s > 0.9965) c = s > 0.9993 ? '#ffffff' : s > 0.998 ? '#ffe9a0' : '#c8b8ff';
      px(x, y, c);
    }
  }
}

/** Little things on the ground: twinkles, moon pebbles, star-dust, tiny glowing moon flowers. */
function scatterGX(px, L, seed, busy) {
  const rnd = rng(seed);
  const { W, H } = L;
  for (let n = 0; n < 1100; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H);
    const k = rnd();
    if (busy(x, y)) continue;
    if (k < 0.16) twinkle(px, x, y, rnd() < 0.5 ? '#ffe27a' : '#c8b8ff', rnd() < 0.3);
    else if (k < 0.42) grid(px, x - 1, y - 1, ['.ab', 'abc'], { a: NT[6], b: NT[5], c: NT[1] });
    else if (k < 0.6) { px(x, y, GD[5]); px(x + 2, y + 1, GD[4]); px(x + 1, y - 1, '#fff6c8'); }
    else if (k < 0.74) grid(px, x - 1, y - 2, ['.a.', 'aYa', '.g.'], { a: rnd() < 0.5 ? '#e0d0ff' : '#ffd0e8', Y: '#fff3bf', g: '#4a6aa8' });
    else if (k < 0.82) grid(px, x - 1, y - 3, ['.a.', '.ab', 'aab'], { a: LIL[5], b: LIL[3] });
  }
}

// ---------- the crystal ridge round the edge ----------

/** A crystal shard standing on base: a six-sided prism with a pointed tip, lit on its left face. */
function shardInto(set, cx0, base, w, h, P, lean) {
  const tip = Math.max(3, w * 0.9);
  for (let y = Math.floor(base - h); y <= base; y += 1) {
    const yy = y - (base - h);
    const half = yy < tip ? (yy / tip) * (w / 2) : w / 2;
    const cx = cx0 + lean * ((base - y) / h) * 4;
    for (let x = Math.floor(cx - half); x <= cx + half; x += 1) {
      const u = (x + 0.5 - cx) / Math.max(0.5, half);
      let i = u < -0.35 ? 5 : u < 0.25 ? 4 : 2;
      if (yy < tip && u < 0.25) i += 1;
      if (Math.abs(u - 0.25) < 0.12 && half > 2) i = 6;
      if (yy > h * 0.7 && i > 2) i -= 1;
      set(x, y, P[clamp(i, 0, 6)]);
    }
  }
}

/** The crystal ridge: clusters of glowing shards, gold and lilac, in rows round the edge. */
function wallGX(px, L, seed, skip) {
  const { W, H } = L;
  const cl = [];
  const add = (x, base, s, k) => { if (!skip(x, base)) cl.push({ x, base, s, k }); };
  let i = 0;
  for (let x = -4; x < W + 8; x += 14 + (i % 3) * 3, i += 1) {
    add(x, 18 + (i % 2) * 5, 0.9 + (i % 3) * 0.15, i);
    add(x + 7, 10, 0.8, i + 1);
    add(x, H + 2 - (i % 2) * 4, 0.9 + ((i + 1) % 3) * 0.15, i + 2);
  }
  i = 0;
  for (let y = 26; y < H - 8; y += 15 + (i % 3) * 2, i += 1) {
    add(6 + (i % 2) * 5, y, 0.75 + (i % 3) * 0.12, i);
    add(W - 6 - (i % 2) * 5, y, 0.75 + ((i + 1) % 3) * 0.12, i + 2);
  }
  cl.sort((a, b) => a.base - b.base);
  const b = new Buf(W, H + 30, 0);
  cl.forEach((c, n) => {
    const P = (c.k + n) % 3 === 0 ? CRYS.gold : (c.k + n) % 3 === 1 ? CRYS.lilac : CRYS.lilac;
    // a glow on the ground round its foot
    glow(px, c.x, c.base - 2, 14 * c.s, 6 * c.s, P === CRYS.gold ? '#ffd860' : '#b8a0ff', 0.45);
    const set = (x, y, col) => b.set(x, y, col, tg('crys', P[1]));
    const r = h2(c.k, n, seed);
    shardInto(set, c.x - 6 * c.s, c.base, 6 * c.s, (14 + r * 6) * c.s, P, -1);
    shardInto(set, c.x + 6 * c.s, c.base, 6 * c.s, (12 + r * 8) * c.s, P, 1);
    shardInto(set, c.x, c.base + 1, 8 * c.s, (22 + r * 10) * c.s, P, 0);
  });
  b.outline((t, side) => (side === 'top' || side === 'left' ? null : mix(LIL[0], INK, 0.4)));
  b.blit(px, 0, 0);
}

// ---------- paths and plazas ----------

/** Paths of glowing golden stepping stones, staggered, set in a warm trail of star-dust. */
function pathsGX(px, L, seed) {
  const { W, H } = L;
  const pf = pathField(L.paths, 12);
  const xs = L.paths.flat().map((p) => p[0]); const ys = L.paths.flat().map((p) => p[1]);
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - 12)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + 12));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - 12)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + 12));
  const STEP = 8.2;
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = pf(x, y);
      if (p.d > 11) continue;
      // the nearest stepping stone: each a little different in size and place
      let best = 9; let du = 0; let dv = 0; let sz = 1;
      const r0 = Math.round(p.along / STEP);
      for (let r = r0 - 1; r <= r0 + 1; r += 1) {
        const side = ((r % 2) + 2) % 2 ? 1 : -1;
        const jx = (h2(r, 1, seed) - 0.5) * 1.6; const jy = (h2(r, 2, seed) - 0.5) * 1.4;
        const k = 0.85 + h2(r, 3, seed) * 0.3;
        const u = p.along - r * STEP - jx; const v = p.off - side * 2.6 - jy;
        const e = (u / (4.3 * k)) ** 2 + (v / (3.5 * k)) ** 2 + (vnoise(x, y, 3, seed + r) - 0.5) * 0.35;
        if (e < best) { best = e; du = u / k; dv = v / k; sz = k; }
      }
      if (best < 1 && p.d < 8.5) {
        const l = -(du * 0.35 + dv * 0.85) / 3.5;
        const t = (bayer(x, y) - 0.5) * 0.3;
        let c = best > 0.66 && l < 0 ? BR[3] : l > 0.4 + t ? '#fff1c0' : l > -0.15 + t ? '#f2d080' : '#d6a24e';
        if (best < 0.1 && sz > 0.95) c = '#fffbe6';
        px(x, y, c);
        continue;
      }
      // a dark rim under each stone's lower side, then the star-dust round it
      if (best < 1.35 && p.d < 9 && dv > 0) { px(x, y, '#3a2240'); continue; }
      const fall = p.d < 6.5 ? 1 : (10.5 - p.d) / 4;
      const tt = bayer(x, y);
      if (tt < fall * 0.85) {
        const g = h2(x, y, seed + 3);
        px(x, y, g > 0.95 ? GD[6] : g > 0.88 ? GD[4] : tt < fall * 0.35 ? '#8a6a86' : '#6e5280');
      } else if (h2(x, y, seed + 4) > 0.98) px(x, y, '#fff6c8');
    }
  }
}

/** A round plaza: a brass rim with rivets, a deep blue dial and a golden eight-point star. */
function plazaGX(px, cx, cy, r, seed) {
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y += 1) {
    for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x += 1) {
      const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
      if (d > r + 2.4) continue;
      if (d > r + 0.6) { px(x, y, d > r + 1.5 ? 'rgba(255,210,120,0.22)' : INK); continue; }
      const a = Math.atan2(dy, dx);
      const lit = -(dx * 0.6 + dy * 0.8) / Math.max(1, d);
      if (d > r - 3.2) {
        const seg = (((a + Math.PI) / (Math.PI * 2)) * Math.round(r * 0.9)) % 1;
        let c = d > r - 1 ? (lit > 0 ? BR[4] : BR[2]) : d < r - 2.4 ? BR[1] : lit > 0.2 ? BR[5] : BR[3];
        if (seg < 0.12 && d > r - 2.4 && d < r - 1) c = GD[6];
        px(x, y, c);
        continue;
      }
      // the dial: a deep blue disc, a golden star on it
      const ri = r - 3.2;
      const f = Math.abs(((((a + Math.PI) / (Math.PI / 4)) % 1) + 1) % 1 - 0.5) * 2; // 1 at a point
      const big = Math.round((a + Math.PI) / (Math.PI / 4)) % 2 === 0;
      const sr = ri * (0.36 + (big ? 0.6 : 0.4) * f ** 2.2);
      if (d < sr) {
        const side = Math.sin(a * 4 + Math.PI / 2) > 0;
        let c = side ? GD[5] : GD[3];
        if (d < ri * 0.2) c = d < ri * 0.1 ? '#fffbe6' : GD[6];
        else if (sr - d < 0.8) c = GD[2];
        px(x, y, c);
        continue;
      }
      let c = d > ri - 1 ? NT[5] : (Math.round(d) % 4 === 0 ? NT[3] : NT[2]);
      if (h2(x, y, seed) > 0.95) c = h2(x, y, seed + 1) > 0.5 ? '#ffffff' : GD[5];
      px(x, y, c);
    }
  }
}

// ---------- the stream of stars and its bridge ----------

/** The stream of stars: deep night water swirling with nebula colors, thick with stars, between shimmering banks. */
function riverGX(px, L, wa, seed) {
  const { W, H } = L;
  const pf = pathField([wa.pts], wa.w);
  const xs = wa.pts.map((p) => p[0]); const ys = wa.pts.map((p) => p[1]);
  const pad = wa.w / 2 + 10;
  const x0 = Math.max(0, Math.floor(Math.min(...xs) - pad)); const x1 = Math.min(W, Math.ceil(Math.max(...xs) + pad));
  const y0 = Math.max(0, Math.floor(Math.min(...ys) - pad)); const y1 = Math.min(H, Math.ceil(Math.max(...ys) + pad));
  const depth = (x, y) => { const wob = Math.sin(x / 13 + y / 17) * 1.2 + Math.sin(x / 5.3 - y / 7.1) * 0.5; return wa.w / 2 + wob - pf(x, y).d; };
  const DEEP = ['#0c0828', '#140e3a', '#1c144e', '#261c64', '#32267c', '#40329a', '#5a4cc0', '#8070e0'];
  for (let y = y0; y < y1; y += 1) {
    for (let x = x0; x < x1; x += 1) {
      const p = pf(x, y);
      if (p.d > wa.w / 2 + 9) continue;
      const d = depth(x, y);
      if (d < -7) continue;
      const lit = p.nx * 0.6 + p.ny * 0.8;
      if (d < 0) {
        // the bank: a glowing lilac rim, then shimmering golden star-dust fading into the night
        const b = -d;
        if (b < 1.3) { px(x, y, lit < 0 ? '#d8c4ff' : '#9c80ec'); continue; }
        if (b < 3.4) { const g = h2(x, y, seed); px(x, y, g > 0.8 ? '#fff6c8' : bayer(x, y) < 0.55 ? GD[4] + 'aa' : 'rgba(255,210,120,0.3)'); continue; }
        if (bayer(x, y) < (7 - b) / 7) px(x, y, h2(x, y, seed + 1) > 0.85 ? GD[5] : 'rgba(255,210,120,0.22)');
        continue;
      }
      // the water: deep in the middle, nebula colors drifting along it
      const t = (bayer(x, y) - 0.5) * 0.3;
      let i = d < 1.2 ? 5 : d < 3 + t * 2 ? 4 : d < 6 + t * 3 ? 3 : 2;
      let c = DEEP[i];
      const nv = vnoise(p.along * 0.8 + 500, p.off * 2.2 + 500, 9, seed + 2);
      if (nv > 0.6 + t) c = mix(c, NEB[Math.floor(vnoise(p.along, 0, 60, seed + 3) * 2.99)], nv > 0.72 + t ? 0.5 : 0.3);
      // light streaks drifting along
      const st = Math.floor(p.along / 9); const ln = Math.round(p.off / 2.6);
      if (d > 2.5 && h2(st, ln, seed + 1) > 0.84 && ((p.along % 9) + 9) % 9 < 4) c = mix(c, '#b8a8ff', 0.45);
      // stars, lots of them
      const s = h2(x, y, seed + 4);
      if (s > 0.972) c = s > 0.995 ? '#ffffff' : s > 0.985 ? '#ffe9a0' : s > 0.978 ? '#c8d8ff' : '#e8d8ff';
      px(x, y, c);
    }
  }
  return depth;
}

/** Big twinkles over the stream and glints on its banks, away from the bridge. */
function riverEdgeGX(px, L, depth, seed, clear) {
  const rnd = rng(seed);
  const { W, H } = L;
  for (let n = 0; n < 900; n += 1) {
    const x = Math.floor(rnd() * W); const y = Math.floor(rnd() * H);
    if (!clear(x, y)) continue;
    const d = depth(x, y);
    if (d > 3 && rnd() < 0.12) twinkle(px, x, y, rnd() < 0.5 ? '#ffe9a0' : '#c8d0ff', rnd() < 0.4);
    else if (d < -2 && d > -5 && rnd() < 0.06) twinkle(px, x, y, '#ffe27a', false);
  }
}

/** The golden bridge: an arched deck of golden planks, brass rails, little lanterns on the posts. */
function bridgeGX(px, c) {
  const { x: X, y: Y, w, h } = c;
  for (let y = Y + 4; y < Y + h + 3; y += 1) for (let x = X + 3; x < X + w + 3; x += 1) px(x, y, 'rgba(8,4,24,0.35)');
  propB(px, X, Y - 3, w, h + 6, (b) => {
    const mid = (h + 6) / 2;
    for (let y = 0; y < h + 6; y += 1) {
      const plank = Math.floor(y / 3);
      for (let x = 4; x < w - 4; x += 1) {
        const rise = 1 - Math.abs(y - mid) / mid;
        let c = y % 3 === 2 ? GD[2] : x < 7 ? GD[5] : x > w - 8 ? GD[3] : GD[4];
        if (rise > 0.55 && y % 3 === 0 && x > 6 && x < w - 7) c = GD[5];
        if ((x * 7 + plank * 3) % 11 === 0 && y % 3 === 1) c = GD[3];
        b.set(x, y, c, tg('wood', GD[1]));
      }
      for (const rx of [1, 2, w - 3, w - 2]) b.set(rx, y, rx < w / 2 ? (rx === 1 ? BR[5] : BR[4]) : (rx === w - 2 ? BR[2] : BR[3]), tg('metal', BR[1]));
    }
    for (const py of [0, Math.round(mid) - 1, h + 3]) for (const pxx of [0, w - 4]) {
      grid((x, y, cc) => b.set(x, y, cc, cc === '#fffbe6' || cc === GD[5] ? tg('glow', GD[4]) : tg('metal', BR[1])), pxx, py - 3, ['.bb.', 'bYyb', 'byyb', '.bb.', '.B..', '.B..'], { b: BR[4], Y: '#fffbe6', y: GD[5], B: BR[3] });
    }
  }, { outline: edgeOf, pad: 2 });
  // the lanterns' light on the deck and the water
  for (const py of [0, Math.round((h + 6) / 2) - 1, h + 3]) for (const pxx of [0, w - 4]) glow(px, X + pxx + 2, Y - 3 + py, 7, 5, '#ffd860', 0.35);
}

// ---------- the green ----------

function roundRect(Z, x, y, g = 0, rr = 10) {
  const qx = Math.max(Z.x + rr - g, Math.min(Z.x + Z.w - rr + g, x + 0.5)); const qy = Math.max(Z.y + rr - g, Math.min(Z.y + Z.h - rr + g, y + 0.5));
  return Math.hypot(x + 0.5 - qx, y + 0.5 - qy) <= rr;
}

/** A nebula pool in a ring of golden moon stones: swirling rose, violet and blue, with stars in it. */
function nebulaPoolGX(px, Z, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2; const rx = Z.w / 2 + 3; const ry = Z.h / 2 + 3;
  for (let y = Math.floor(cy - ry - 3); y <= cy + ry + 3; y += 1) {
    for (let x = Math.floor(cx - rx - 3); x <= cx + rx + 3; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1.22) { if (d < 1.4 && bayer(x, y) < 0.5) px(x, y, 'rgba(255,210,120,0.25)'); continue; }
      if (d > 1) {
        const a = Math.atan2(y + 0.5 - cy, x + 0.5 - cx); const f = (((a + Math.PI) / (Math.PI * 2)) * 26) % 1;
        const lit = -((x + 0.5 - cx) * 0.6 + (y + 0.5 - cy) * 0.8);
        px(x, y, f < 0.16 ? BR[1] : d > 1.14 ? BR[2] : lit > 0 ? GD[5] : GD[3]);
        continue;
      }
      const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      const sw = (a + Math.sqrt(d) * 5 + 10) % (Math.PI * 2);
      const k = Math.floor((sw / (Math.PI * 2)) * 3 + vnoise(x, y, 8, seed) * 0.8) % 3;
      const t = (bayer(x, y) - 0.5) * 0.2;
      let c = d > 0.86 ? '#1c144e' : mix('#20185a', NEB[k], d < 0.5 + t ? 0.55 : 0.35);
      if (d < 0.2 + t) c = mix(c, '#ffffff', 0.25);
      const s = h2(x, y, seed + 1);
      if (s > 0.975) c = s > 0.993 ? '#ffffff' : '#ffe9a0';
      px(x, y, c);
    }
  }
  twinkle(px, Math.round(cx - rx * 0.4), Math.round(cy - ry * 0.2), '#ffe27a', true);
  twinkle(px, Math.round(cx + rx * 0.45), Math.round(cy + ry * 0.25), '#c8d0ff', true);
}

/** A rink of moon-glass in golden boards: pale lavender ice with star lines. */
function moonRinkGX(px, Z, seed) {
  const I = ramp('#c4c8f4', 3, 3);
  for (let y = Z.y - 6; y < Z.y + Z.h + 6; y += 1) {
    for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
      if (roundRect(Z, x, y, 5, 13)) {
        if (!roundRect(Z, x, y, 2, 11)) {
          const lit = y < Z.y + Z.h / 2;
          let c = roundRect(Z, x, y, 3.5, 12) ? (lit ? GD[5] : GD[3]) : lit ? GD[4] : BR[2];
          if (h2(x, y, seed) > 0.86) c = '#fff6c8';
          px(x, y, c);
          continue;
        }
        const n = vnoise(x, y, 8, seed + 1); const t = (bayer(x, y) - 0.5) * 0.2;
        let c = n < 0.35 + t ? I[3] : n < 0.65 + t ? I[4] : I[5];
        if (((x - Z.x) * 0.7 - (y - Z.y) + 400) % 24 < 2) c = '#ffffff';
        const mid = Z.x + Z.w / 2;
        if (Math.abs(x + 0.5 - mid) < 0.6) c = GD[3];
        if (Math.abs(Math.hypot(x + 0.5 - mid, y + 0.5 - (Z.y + Z.h / 2)) - 7) < 0.55) c = GD[3];
        if (Math.abs(x + 0.5 - (Z.x + 16)) < 0.55 || Math.abs(x + 0.5 - (Z.x + Z.w - 16)) < 0.55) c = '#8c8ce0';
        px(x, y, c);
      } else if (roundRect(Z, x, y, 6.5, 14)) px(x, y, 'rgba(6,2,20,0.3)');
    }
  }
  goalsGX(px, Z, 6, 4);
}

/** Golden goals with star-string nets at each end of a patch. */
function goalsGX(px, Z, gw, inset) {
  const mid = Math.round(Z.y + Z.h / 2);
  for (const [gx, dir] of [[Z.x + inset, 1], [Z.x + Z.w - inset - gw, -1]]) {
    propB(px, gx, mid - 8, gw, 16, (b) => {
      for (let y = 0; y < 16; y += 1) for (let x = 0; x < gw; x += 1) {
        const post = y < 2 || y > 13 || (dir > 0 ? x === 0 : x === gw - 1);
        if (post) b.set(x, y, y < 2 || x === 0 ? GD[5] : GD[3], tg('metal', BR[1]));
        else if ((x + y) % 2 === 0) b.set(x, y, '#e8e0ff', tg('net', '#ffffff'));
      }
    }, { outline: edgeOf, pad: 1 });
  }
}

/** A star-dust field for soccer or football: a soft golden oval with glowing lines, golden goals or posts. */
function dustFieldGX(px, Z, kind, seed) {
  const cx = Z.x + Z.w / 2; const cy = Z.y + Z.h / 2;
  const S = ramp('#6a4a8a', 3, 3);
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) {
    for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
      const dx = (x + 0.5 - cx) / (Z.w / 2 + 4); const dy = (y + 0.5 - cy) / (Z.h / 2 + 4);
      const k = 1 - Math.abs(dx) ** 4 - dy ** 4;
      const edgeN = (vnoise(x, y, 4, seed) - 0.5) * 0.25;
      if (k + edgeN < 0) continue;
      if (k + edgeN < 0.1) { if (bayer(x, y) < 0.6) px(x, y, 'rgba(255,210,120,0.3)'); continue; }
      const n = vnoise(x, y, 14, seed + 1); const t = (bayer(x, y) - 0.5) * 0.3;
      let c = n < 0.3 + t ? S[2] : n < 0.75 + t ? S[3] : S[4];
      if (h2(x, y, seed + 2) > 0.97) c = h2(x, y, seed + 3) > 0.5 ? GD[5] : '#ffffff';
      if (Math.abs(x + 0.5 - cx) < 1 && k > 0.2) c = GD[5];
      if (Math.abs(Math.hypot(x + 0.5 - cx, y + 0.5 - cy) - 7) < 0.6) c = GD[5];
      if (Math.abs(k - 0.22) < 0.035) c = GD[4];
      px(x, y, c);
    }
  }
  const mid = Math.round(cy);
  if (kind === 'football') {
    for (const gx of [Z.x + 4, Z.x + Z.w - 7]) {
      propB(px, gx - 5, mid - 18, 14, 22, (b) => {
        for (let y = 0; y < 22; y += 1) b.set(5, y, GD[y % 4 < 2 ? 5 : 3], tg('metal', BR[1]));
        for (let x = 0; x < 13; x += 1) b.set(x, 8, GD[4], tg('metal', BR[1]));
        for (let y = 0; y < 9; y += 1) { b.set(0, y, GD[4], tg('metal', BR[1])); b.set(12, y, GD[4], tg('metal', BR[1])); }
        b.set(0, 0, '#fffbe6', 'glow'); b.set(12, 0, '#fffbe6', 'glow');
      }, { outline: edgeOf, pad: 1 });
    }
  } else goalsGX(px, Z, 8, 0);
}

// ---------- golden domes ----------

/**
 * A domed house: a drum of warm cream stone banded in brass, round glowing windows and a round-
 * topped door, and over it a big dome with brass ribs, a ring of little glowing portholes and a
 * star on its finial. Most domes are gold; o.kid: the kid's own, its dome in their color, with a
 * pennant; o.sign 'note': the music house.
 */
function domeGX(px, X, Y, w, h, o = {}) {
  const D = o.kid ? ramp(o.cap || '#ff6b6b', 3, 3) : GD;
  const A = ramp(o.accent || '#b197fc', 3, 3);
  const top = Y - 8; const drumTop = Y + Math.round(h * 0.5); const base = Y + h;
  const cx = X + w / 2; const rx = w / 2 + 2; const ry = drumTop - top + 2;
  groundShadow(px, cx + 2, base, w / 2 + 6, 4, 0.3);
  glow(px, cx, base + 2, w / 2 + 10, 8, '#ffd860', 0.3);
  const ox = X - 6; const oy = top - 22; const BW = w + 12; const BH = base - oy + 2;
  propB(px, ox, oy, BW, BH, (b) => {
    const set = (x, y, c, t) => b.set(x - ox, y - oy, c, t);
    // the drum: cream stone, a brass band round its top and its foot
    for (let y = drumTop - 2; y < base; y += 1) {
      for (let x = X; x < X + w; x += 1) {
        const u = (x + 0.5 - X) / w;
        const t = (bayer(x, y) - 0.5) * 0.12;
        let i = u < 0.14 + t ? 3 : u < 0.62 + t ? 4 : u < 0.88 + t ? 3 : 2;
        if (y < drumTop + 3) i -= 1;
        let c = CR[clamp(i, 0, 5)];
        let tag = tg('stone', CR[2]);
        if (y < drumTop + 1 || y > base - 4) { c = y === drumTop - 2 || y === base - 3 ? BR[5] : u < 0.5 ? BR[4] : BR[2]; tag = tg('metal', BR[1]); }
        else if (y === drumTop + 4 || y === drumTop + 5) { c = u < 0.5 ? A[3] : A[2]; tag = tg('cloth', A[1]); }
        set(x, y, c, tag);
      }
    }
    // the door, round-topped, in a brass frame, a warm little window in it
    const dx = cx; const dw = Math.round(w * 0.11) + 2; const dTop = base - Math.round(h * 0.34);
    for (let y = dTop - dw; y < base - 3; y += 1) for (let x = Math.floor(dx - dw - 1); x <= dx + dw + 1; x += 1) {
      const inArch = y >= dTop ? Math.abs(x + 0.5 - dx) <= dw : Math.hypot(x + 0.5 - dx, y + 0.5 - dTop) <= dw;
      const inFrame = y >= dTop ? Math.abs(x + 0.5 - dx) <= dw + 1.2 : Math.hypot(x + 0.5 - dx, y + 0.5 - dTop) <= dw + 1.2;
      if (!inFrame) continue;
      if (!inArch) { set(x, y, BR[3], tg('metal', BR[1])); continue; }
      const P = o.kid ? D : [NT[1], NT[2], NT[3], NT[4], NT[5]];
      let c = (x - Math.floor(dx - dw)) % 3 === 0 ? P[1] : P[3];
      if (Math.hypot(x + 0.5 - dx, y + 0.5 - (dTop + 1)) < 2.2) c = '#ffe9a0';
      set(x, y, c, tg('door', P[1]));
    }
    set(Math.round(dx + dw * 0.5), dTop + dw, GD[5], tg('metal', BR[1]));
    // round glowing windows either side, brass rims
    const wr = w < 90 ? 4 : 5; const wy = Math.round((drumTop + 6 + base - 3) / 2);
    const off = Math.round((dw + w / 2) / 2) + 1;
    for (const wx of [Math.round(dx - off), Math.round(dx + off)]) {
      for (let y = wy - wr - 2; y <= wy + wr + 2; y += 1) for (let x = wx - wr - 2; x <= wx + wr + 2; x += 1) {
        const d = Math.hypot(x + 0.5 - wx, y + 0.5 - wy);
        if (d > wr + 1.6) continue;
        if (d > wr) { set(x, y, d > wr + 0.8 ? BR[1] : BR[4], tg('metal', BR[1])); continue; }
        let c = d < wr * 0.45 ? '#fffbe6' : y < wy ? '#ffe9a0' : '#ffc860';
        if (Math.abs(x + 0.5 - wx) < 0.6 || Math.abs(y + 0.5 - wy) < 0.6) c = BR[4];
        set(x, y, c, tg('glow', '#ffd070'));
      }
    }
    // the dome: lit at the top left, brass ribs running up to the finial, a ring of portholes
    for (let y = top; y <= drumTop; y += 1) {
      for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
        const u = (x + 0.5 - cx) / rx; const v = (drumTop + 1 - (y + 0.5)) / ry;
        if (v < 0 || u * u + v * v > 1) continue;
        const l = -(u * 0.65) + (v - 0.45) * 0.9;
        const t = (bayer(x, y) - 0.5) * 0.25;
        const i = l > 0.5 + t ? 6 : l > 0.2 + t ? 5 : l > -0.15 + t ? 4 : l > -0.5 + t ? 3 : 2;
        let c = D[clamp(o.kid ? i - 1 : i, 0, 6)];
        // ribs: meridians of the dome
        const lon = Math.asin(clamp(u / Math.sqrt(Math.max(0.0001, 1 - v * v)), -1, 1));
        const rib = Math.abs(((lon / (Math.PI / 8)) % 1 + 1) % 1 - 0.5) > 0.42 && v < 0.93 && Math.abs(lon) < Math.PI * 0.45;
        if (rib) c = o.kid ? (l > 0 ? GD[5] : GD[3]) : (l > 0 ? GD[6] : BR[3]);
        if (v < 0.06) c = BR[2];
        set(x, y, c, tg('cap', D[2]));
      }
    }
    // portholes round the dome's lower ring: dark brass rims, warm light inside
    const pv = 0.32; const py = Math.round(drumTop + 1 - pv * ry);
    for (const pu of [-0.62, -0.21, 0.21, 0.62]) {
      const pxx = Math.round(cx + pu * rx * Math.sqrt(1 - pv * pv));
      grid((x, y, c) => set(x, y, c, c === BR[1] ? tg('metal', BR[1]) : tg('glow', '#ffd070')), pxx - 2, py - 2, ['.ddd.', 'dyYyd', 'dYWYd', 'dyYyd', '.ddd.'], { d: BR[1], y: '#ffc860', Y: '#ffe9a0', W: '#fffbe6' });
    }
    // the finial and its star
    const fy = top;
    for (let y = fy - 7; y < fy + 1; y += 1) { set(Math.round(cx) - 1, y, BR[4], tg('metal', BR[1])); set(Math.round(cx), y, BR[2], tg('metal', BR[1])); }
    grid((x, y, c) => set(x, y, c, tg('glow', GD[3])), Math.round(cx) - 3, fy - 13, ['...y...', '...y...', '.yyYyy.', 'yyYWYyy', '.yyYyy.', '..y.y..'], { y: GD[4], Y: GD[5], W: '#fffbe6' });
    if (o.kid) {
      // a pennant in their color on a little mast at the side of the dome
      const fx = Math.round(cx - rx * 0.5); const fyy = Math.round(drumTop + 1 - Math.sqrt(1 - 0.25) * ry) + 2;
      for (let y = fyy - 16; y < fyy; y += 1) set(fx, y, BR[3], tg('metal', BR[1]));
      set(fx, fyy - 17, GD[5], tg('metal', BR[1]));
      for (let y = 0; y < 6; y += 1) for (let x = 1; x <= 10 - y * 1.6; x += 1) set(fx + x, fyy - 16 + y, y < 2 ? D[5] : D[3], tg('cloth', D[1]));
    }
    if (o.sign === 'note') {
      grid((x, y, c) => set(x, y, c, tg('wood', BR[1])), Math.round(dx) + dw + 4, dTop - 4, ['bbbbbbb', 'bPPPPPb', 'bPPkkPb', 'bPPkPPb', 'bPkkPPb', 'bPkkPPb', 'bbbbbbb'], { b: BR[3], P: '#fff4e6', k: INK });
    }
  }, { outline: edgeOf, soften: ['cap:' + D[2]] });
}

// ---------- props ----------

/** A golden stall under an indigo awning sewn with stars, jars of stardust on the counter. */
function stallGX(px, X, Y) {
  groundShadow(px, X + 22, Y + 31, 22, 3, 0.3);
  glow(px, X + 22, Y + 30, 28, 8, '#ffd860', 0.3);
  propB(px, X, Y, 44, 33, (b) => {
    for (const x of [2, 40]) for (let y = 6; y < 33; y += 1) { b.set(x, y, BR[4], tg('metal', BR[1])); b.set(x + 1, y, BR[2], tg('metal', BR[1])); }
    for (let y = 20; y < 33; y += 1) for (let x = 3; x < 41; x += 1) {
      const top = y < 22;
      b.set(x, y, top ? (y === 20 ? GD[6] : GD[5]) : (x - 3) % 6 < 3 ? GD[4] : GD[3], tg('wood', GD[1]));
    }
    // jars of stardust
    for (let k = 0; k < 5; k += 1) {
      const jx = 6 + k * 7; const C = [GD, LIL, CRYS.teal, CRYS.rose, GD][k];
      grid((x, y, c) => b.set(x, y, c, tg('glass', '#8878b8')), jx, 13, ['.cc.', 'gaag', 'gAag', 'gaag'], { c: BR[3], g: '#c8c0f0', a: C[4], A: '#ffffff' });
    }
    // the awning: indigo with gold stars, scalloped, a gold trim
    for (let y = 0; y < 11; y += 1) for (let x = -2; x < 46; x += 1) {
      const u = (x + 2) % 8; const tipY = 8 + Math.round(Math.sin((u / 8) * Math.PI) * 2.5);
      if (y > tipY) continue;
      let c = y < 2 ? NT[6] : NT[4];
      if (Math.floor((x + 2) / 4) % 2) c = y < 2 ? NT[7] : NT[5];
      if (y >= tipY - 1) c = GD[4];
      if ((x * 5 + y * 3) % 13 === 0 && y < tipY - 1) c = GD[6];
      b.set(x, y, c, tg('cloth', NT[2]));
    }
  }, { outline: edgeOf });
}

/** The washing line between brass posts topped with stars (the clothes are the Forest Village's). */
function laundryGX(px, X, Y, w) {
  laundryB(px, X, Y, w);
  for (const x of [X, X + w - 4]) {
    propB(px, x - 3, Y, 10, 27, (b) => {
      for (let y = 2; y < 27; y += 1) { b.set(4, y, BR[4], tg('metal', BR[1])); b.set(5, y, BR[3], tg('metal', BR[1])); b.set(6, y, BR[2], tg('metal', BR[1])); }
      for (let i = 1; i < 10; i += 1) { b.set(i, 1, GD[5], tg('metal', BR[1])); b.set(i, 2, GD[3], tg('metal', BR[1])); }
      b.set(5, 0, '#fffbe6', 'glow');
    }, { outline: edgeOf });
  }
}

/** A glowing crystal ball on a brass tripod stand, 22 x 30. */
function orbGX(px, X, Y, c) {
  const P = crysOf(c);
  groundShadow(px, X + 11, Y + 29, 7, 1.8, 0.3);
  glow(px, X + 11, Y + 12, 16, 14, P[5], 0.35);
  propB(px, X, Y, 22, 30, (b) => {
    line(11, 18, 5, 29, (x, y) => b.set(x, y, BR[3], tg('metal', BR[1])));
    line(11, 18, 17, 29, (x, y) => b.set(x, y, BR[2], tg('metal', BR[1])));
    line(11, 18, 11, 29, (x, y) => b.set(x, y, BR[4], tg('metal', BR[1])));
    for (let x = 6; x < 17; x += 1) { b.set(x, 18, GD[4], tg('metal', BR[1])); b.set(x, 19, BR[2], tg('metal', BR[1])); }
    for (let y = 0; y < 18; y += 1) for (let x = 2; x < 20; x += 1) {
      const d = Math.hypot(x + 0.5 - 11, y + 0.5 - 9.5);
      if (d > 8.4) continue;
      const l = -((x + 0.5 - 11) * 0.6 + (y + 0.5 - 9.5) * 0.8) / 8;
      let col = d < 2.5 ? '#ffffff' : d < 4.5 ? P[6] : l > 0.2 ? P[5] : l > -0.3 ? P[4] : P[3];
      if (inEll(x, y, 7.5, 6, 1.6, 1.2)) col = '#ffffff';
      b.set(x, y, col, tg('glow', P[2]));
    }
  }, { outline: (t, side) => (String(t).startsWith('glow') ? (side === 'bottom' || side === 'right' ? P[1] : P[2]) : edgeOf(t, side)) });
}

/** A brass lamp post with a star-shaped lantern, 10 x 32. */
function lampGX(px, X, Y) {
  groundShadow(px, X + 5, Y + 31, 4, 1.4, 0.3);
  glow(px, X + 5, Y + 5, 13, 11, '#ffd860', 0.45);
  propB(px, X, Y, 10, 32, (b) => {
    for (let y = 9; y < 31; y += 1) { b.set(4, y, BR[4], tg('metal', BR[1])); b.set(5, y, BR[2], tg('metal', BR[1])); }
    for (let x = 2; x < 8; x += 1) { b.set(x, 31, BR[3], tg('metal', BR[1])); }
    grid((x, y, c) => b.set(x, y, c, tg('glow', GD[3])), 0, 0, ['....y.....', '....y.....', '..yyYyy...', 'yyyYWYyyy.', '..yyYyy...', '.yy.y.yy..', '.y..y..y..', '....b.....', '...bbb....'].map((r) => r.slice(0, 10)), { y: GD[4], Y: GD[5], W: '#fffbe6', b: BR[3] });
  }, { outline: edgeOf });
}

/** A cluster of glowing crystals, 20 x 24. */
function crystalGX(px, X, Y, c) {
  const P = crysOf(c);
  glow(px, X + 10, Y + 20, 16, 7, P[5], 0.45);
  propB(px, X, Y, 20, 24, (b) => {
    const set = (x, y, col) => b.set(x, y, col, tg('crys', P[1]));
    shardInto(set, 5, 23, 5, 12, P, -1);
    shardInto(set, 15, 23, 5, 10, P, 1);
    shardInto(set, 10, 23, 7, 20, P, 0);
  }, { outline: edgeOf });
}

/** A tall glowing crystal spire with little shards round its foot, 22 x 46. */
function spireGX(px, X, Y, c) {
  const P = crysOf(c);
  glow(px, X + 11, Y + 42, 20, 8, P[5], 0.5);
  glow(px, X + 11, Y + 20, 12, 24, P[5], 0.2);
  propB(px, X, Y, 22, 46, (b) => {
    const set = (x, y, col) => b.set(x, y, col, tg('crys', P[1]));
    shardInto(set, 11, 44, 9, 42, P, 0);
    shardInto(set, 4, 45, 5, 12, P, -1);
    shardInto(set, 18, 45, 5, 10, P, 1);
  }, { outline: edgeOf, after: (b) => { b.set(10, 6, '#ffffff'); b.set(9, 7, '#ffffff'); } });
}

// ---------- whimsy ----------

/** A brass telescope on a tripod, tipped up at the sky, 22 x 30 (foot [3, 24, 16, 5]). */
export function scopeGX(px, X, Y) {
  groundShadow(px, X + 11, Y + 29, 9, 1.8, 0.3);
  propB(px, X, Y, 22, 30, (b) => {
    // the tripod
    line(11, 15, 3, 29, (x, y) => b.set(x, y, BR[3], tg('metal', BR[1])));
    line(11, 15, 19, 29, (x, y) => b.set(x, y, BR[2], tg('metal', BR[1])));
    line(11, 15, 12, 29, (x, y) => b.set(x, y, BR[4], tg('metal', BR[1])));
    // the tube, from the eyepiece low at the right up to the big lens at the top left
    for (let k = 0; k <= 20; k += 1) {
      const x = 17 - k * 0.72; const y = 18 - k * 0.62; const r = 1.6 + k * 0.07;
      for (let dy = -3; dy <= 3; dy += 1) for (let dx = -2; dx <= 2; dx += 1) {
        if (Math.hypot(dx, dy) > r + 0.3) continue;
        const l = -(dx * 0.4 + dy * 0.9) / r;
        const band = k === 6 || k === 7 || k === 16;
        b.set(Math.round(x + dx), Math.round(y + dy), band ? GD[5] : l > 0.3 ? BR[5] : l > -0.3 ? BR[4] : BR[2], tg('metal', BR[1]));
      }
    }
    // the lens catching the starlight, the eyepiece
    grid((x, y, c) => b.set(x, y, c, tg('glass', '#7090c8')), 0, 2, ['.ll.', 'lWbl', 'lbbl', '.ll.'], { l: GD[4], W: '#ffffff', b: '#a8c8ff' });
    grid((x, y, c) => b.set(x, y, c, tg('metal', BR[1])), 17, 17, ['bb', 'bB'], { b: BR[2], B: BR[1] });
  }, { outline: edgeOf });
}

/** A moon-rock garden: a bed of pale moon rocks with little glowing moon flowers, 34 x 18 (foot [2, 6, 30, 11]). */
export function moongardenGX(px, X, Y) {
  glow(px, X + 17, Y + 12, 22, 8, '#c8b8ff', 0.3);
  propB(px, X, Y, 34, 18, (b) => {
    // a ring of moon rocks round soft dark soil
    for (let y = 6; y < 18; y += 1) for (let x = 0; x < 34; x += 1) {
      if (!inEll(x, y, 17, 12, 17, 6)) continue;
      b.set(x, y, h2(x, y, 3) > 0.8 ? NT[4] : NT[2], tg('stone', NT[1]));
    }
    const rocks = [[3, 12, 3], [8, 15, 3.4], [15, 16, 3], [22, 16, 3.4], [29, 14, 3], [31, 10, 2.6], [5, 8, 2.6], [26, 8, 2.4]];
    for (const [rx, ry, r] of rocks) for (let y = Math.floor(ry - r); y <= ry + r; y += 1) for (let x = Math.floor(rx - r); x <= rx + r; x += 1) {
      const d = Math.hypot(x + 0.5 - rx, (y + 0.5 - ry) * 1.3);
      if (d > r) continue;
      const l = -((x + 0.5 - rx) * 0.6 + (y + 0.5 - ry) * 0.8) / r;
      b.set(x, y, l > 0.4 ? '#e8e2f4' : l > -0.1 ? '#c4bcdc' : '#9a90bc', tg('stone', '#6a6090'));
      if (h2(x, y, 5) > 0.9) b.set(x, y, '#8078a8', tg('stone', '#6a6090'));
    }
    // moon flowers: pale glowing cups on thin stems, and one big one in the middle
    const fl = [[10, 10, 0], [15, 8, 1], [20, 10, 2], [24, 11, 0], [13, 12, 2], [19, 13, 1]];
    for (const [fx, fy, k] of fl) {
      const C = [['#fff6c8', '#ffe27a'], ['#e8dcff', '#b8a0ff'], ['#d8f4ff', '#90c8f0']][k];
      b.set(fx, fy + 1, '#5a8a9a', tg('leaf', '#3a6070')); b.set(fx, fy + 2, '#5a8a9a', tg('leaf', '#3a6070'));
      grid((x, y, c) => b.set(x, y, c, tg('glow', C[1])), fx - 1, fy - 2, ['a.a', 'aWa', '.a.'], { a: C[1], W: C[0] });
    }
    grid((x, y, c) => b.set(x, y, c, tg('glow', '#e8a82a')), 15, 0, ['.a.a.', 'aaWaa', '.aaa.', '..g..', '..g..'], { a: '#ffe27a', W: '#ffffff', g: '#5a8a9a' });
  }, { outline: edgeOf, pad: 4 });
}

/** A star puppy curled up asleep in a little crater bed, a z over it, 26 x 16 (foot [2, 6, 22, 9]). */
export function starpupGX(px, X, Y) {
  propB(px, X, Y, 26, 16, (b) => {
    // the crater: a raised rim of moon dust, a soft dip inside
    for (let y = 4; y < 16; y += 1) for (let x = 0; x < 26; x += 1) {
      if (!inEll(x, y, 13, 10, 13, 5.6)) continue;
      const inner = inEll(x, y, 13, 10.4, 10, 3.8);
      const l = -((x + 0.5 - 13) * 0.4 + (y + 0.5 - 10) * 0.9);
      b.set(x, y, inner ? (y < 10 ? NT[2] : NT[3]) : l > 0 ? '#c4bcdc' : '#8a80b0', tg('stone', '#5a5088'));
    }
    // the pup lying in it, head on its paws at the left: a cream body, a round head, a long snout
    const P = ['#8a5a2a', '#c08a48', '#e8c078', '#f8e0a8', '#fff4d8'];
    const parts = [[15.5, 9.5, 7, 3.6], [7.5, 7.5, 4.2, 3.8], [3.6, 9.3, 2.8, 1.9], [5, 11.6, 3, 1.2]];
    for (let y = 2; y < 15; y += 1) for (let x = 0; x < 24; x += 1) {
      const p = parts.find(([cx, cy, rx, ry]) => inEll(x, y, cx, cy, rx, ry));
      if (!p) continue;
      const l = -((x + 0.5 - p[0]) * 0.4 + (y + 0.5 - p[1]) * 0.9) / p[3];
      b.set(x, y, P[l > 0.45 ? 4 : l > -0.1 ? 3 : l > -0.6 ? 2 : 1], tg('body', P[0]));
    }
    // a big floppy brown ear, a sleepy shut eye, a black nose, a blue collar with a gold star tag
    for (let y = 4; y < 12; y += 1) for (let x = 7; x < 13; x += 1) if (inEll(x, y, 9.6, 7.6, 1.9, 3.4)) b.set(x, y, x < 10 ? '#a8703a' : '#7a4a22', tg('body', '#5a3418'));
    b.set(6, 7, '#3a2018', 'face'); b.set(5, 6, '#3a2018', 'face'); b.set(7, 6, '#3a2018', 'face');
    b.set(1, 9, INK, 'face'); b.set(1, 8, '#3a2848', 'face');
    for (let y = 6; y < 12; y += 1) b.set(12, y, '#5a7ae0', tg('cloth', '#2a3a90'));
    b.set(12, 11, GD[5], 'face'); b.set(13, 11, GD[4], 'face');
    // star spots on its back and a curly tail with a star on the tip
    b.set(16, 7, '#ffffff', 'face'); b.set(19, 8, '#fff6c8', 'face'); b.set(15, 10, '#fff6c8', 'face');
    for (const [x, y] of [[22, 9], [23, 8], [23, 7], [23, 6], [22, 5]]) b.set(x, y, P[2], tg('body', P[0]));
    grid((x, y, c) => b.set(x, y, c, tg('glow', GD[3])), 19, 2, ['..y..', '.yWy.', '..y..'], { y: GD[5], W: '#ffffff' });
  }, { outline: edgeOf, after: (b) => grid((x, y, c) => b.set(x, y, c), 9, -4, ['......ZZZZ', '........Z.', '.......Z..', 'zzz...ZZZZ', '.z........', 'z.........', 'zzz.......'], { z: '#d8ccff', Z: '#a898e8' }) });
}

/** A comet weather vane: a brass pole with N S E W arms and a golden comet on top, 16 x 40 (foot [5, 34, 6, 5]). */
export function cometvaneGX(px, X, Y) {
  groundShadow(px, X + 8, Y + 39, 5, 1.6, 0.3);
  propB(px, X, Y, 16, 40, (b) => {
    for (let y = 10; y < 39; y += 1) { b.set(7, y, BR[4], tg('metal', BR[1])); b.set(8, y, BR[2], tg('metal', BR[1])); }
    for (let x = 5; x < 11; x += 1) b.set(x, 39, BR[3], tg('metal', BR[1]));
    // the arms with their little letter balls
    for (let x = 1; x < 15; x += 1) b.set(x, 18, BR[3], tg('metal', BR[1]));
    for (const ax of [1, 14]) { b.set(ax, 17, GD[5], tg('metal', BR[1])); b.set(ax, 19, GD[3], tg('metal', BR[1])); }
    for (let x = 4; x < 12; x += 1) b.set(x, 23, BR[3], tg('metal', BR[1]));
    b.set(4, 22, GD[4], tg('metal', BR[1])); b.set(11, 22, GD[4], tg('metal', BR[1]));
    // the comet: a round golden head and a long swept tail, pointing into the wind
    grid((x, y, c) => b.set(x, y, c, tg('glow', GD[2])), 0, 0, [
      '.........hhh....',
      '.....ttthHHHh...',
      '..tttTTThHWWHh..',
      'tttTTTTThHWWHh..',
      '..tttTTThHHHHh..',
      '.....ttt.hhhh...',
    ], { t: GD[3], T: GD[4], h: GD[5], H: GD[6], W: '#ffffff' });
    for (let y = 6; y < 10; y += 1) { b.set(7, y, BR[4], tg('metal', BR[1])); b.set(8, y, BR[2], tg('metal', BR[1])); }
  }, { outline: edgeOf });
}

/** A planet swing: a brass A-frame, a ringed planet hung from it for a seat, 30 x 38 (foot [1, 30, 28, 7]). */
export function planetswingGX(px, X, Y) {
  groundShadow(px, X + 15, Y + 37, 14, 2, 0.3);
  const P = ramp('#ff9e6a', 3, 3);
  propB(px, X, Y, 30, 38, (b) => {
    // the frame: two legs each side, a bar across the top
    line(4, 2, 0, 37, (x, y) => b.set(x, y, BR[4], tg('metal', BR[1])));
    line(4, 2, 7, 37, (x, y) => b.set(x, y, BR[2], tg('metal', BR[1])));
    line(25, 2, 22, 37, (x, y) => b.set(x, y, BR[3], tg('metal', BR[1])));
    line(25, 2, 29, 37, (x, y) => b.set(x, y, BR[2], tg('metal', BR[1])));
    for (let x = 2; x < 28; x += 1) { b.set(x, 1, GD[5], tg('metal', BR[1])); b.set(x, 2, BR[3], tg('metal', BR[1])); }
    // the ropes of star-string
    for (let y = 3; y < 22; y += 1) { b.set(10, y, y % 3 ? '#e8e0ff' : GD[5], tg('net', '#ffffff')); b.set(19, y, y % 3 ? '#e8e0ff' : GD[5], tg('net', '#ffffff')); }
    // the planet seat and its ring
    for (let y = 18; y < 32; y += 1) for (let x = 6; x < 24; x += 1) {
      const d = Math.hypot(x + 0.5 - 14.5, y + 0.5 - 25);
      const ring = inEll(x, y, 14.5, 24.5, 11, 2.6) && !inEll(x, y, 14.5, 24.5, 8, 1.4);
      const front = y + 0.5 > 24.5;
      if (ring && (front || d > 6)) { b.set(x, y, front ? GD[5] : GD[3], tg('metal', GD[1])); continue; }
      if (d > 6) continue;
      const l = -((x + 0.5 - 14.5) * 0.6 + (y + 0.5 - 25) * 0.8) / 6;
      let c = P[l > 0.4 ? 5 : l > 0 ? 4 : l > -0.4 ? 3 : 2];
      if (Math.abs((y + 0.5 - 25) + (x + 0.5 - 14.5) * 0.2 - 2) < 0.7) c = P[2];
      b.set(x, y, c, tg('body', P[1]));
    }
  }, { outline: edgeOf });
}

/** A jar of stardust on a little stump of moon rock, glowing, 14 x 20 (foot [1, 12, 12, 7]). */
export function starjarGX(px, X, Y) {
  glow(px, X + 7, Y + 10, 13, 12, '#ffd860', 0.5);
  propB(px, X, Y, 14, 20, (b) => {
    for (let y = 15; y < 20; y += 1) for (let x = 1; x < 13; x += 1) if (inEll(x, y, 7, 17.5, 6, 2.6)) b.set(x, y, y < 17 ? '#c4bcdc' : '#8a80b0', tg('stone', '#5a5088'));
    grid((x, y, c) => b.set(x, y, c, c === '#c8c0f0' || c === '#ffffff' || c === '#e8e4ff' ? tg('glass', '#8878b8') : tg('glow', GD[3])), 2, 0, [
      '..ccc....',
      '.bbbbb...',
      '.gwyyg...',
      'gwyYyyg..',
      'gyyyWyg..',
      'gyYyyyg..',
      'gwyyYyg..',
      'gyyyyyg..',
      '.gyyyg...',
      '..ggg....',
    ].map((r) => r.slice(0, 7)), { c: '#ff9ab8', b: BR[3], g: '#c8c0f0', w: '#ffffff', y: GD[5], Y: '#fffbe6', W: '#ffffff' });
  }, { outline: edgeOf, after: (b) => { b.set(12, 2, '#fff6c8'); b.set(0, 5, '#ffe27a'); b.set(11, 8, '#ffffff'); } });
}

/** A meteor still glowing in the crater it made, a little "do not touch" sign beside it, 34 x 24 (foot [2, 10, 30, 13]). */
export function meteorGX(px, X, Y) {
  glow(px, X + 16, Y + 16, 22, 10, '#ff9a5a', 0.45);
  propB(px, X, Y, 34, 24, (b) => {
    // the crater: a dusty rim, scorched inside
    for (let y = 10; y < 24; y += 1) for (let x = 0; x < 30; x += 1) {
      if (!inEll(x, y, 15, 17, 15, 6.6)) continue;
      const inner = inEll(x, y, 15, 17.4, 11.6, 4.4);
      const l = -((x + 0.5 - 15) * 0.4 + (y + 0.5 - 17) * 0.9);
      b.set(x, y, inner ? (y < 17 ? '#2a1a3a' : '#4a2a3a') : l > 0 ? '#c4bcdc' : '#8a80b0', tg('stone', '#5a5088'));
    }
    // the meteor: a lumpy rock with glowing cracks
    for (let y = 8; y < 21; y += 1) for (let x = 8; x < 23; x += 1) {
      const d = Math.hypot((x + 0.5 - 15) / 6.4, (y + 0.5 - 15) / 5.2) + (vnoise(x, y, 3, 7) - 0.5) * 0.3;
      if (d > 1) continue;
      const l = -((x + 0.5 - 15) * 0.6 + (y + 0.5 - 15) * 0.8) / 6;
      let c = l > 0.35 ? '#7a6a8a' : l > -0.2 ? '#5a4a6a' : '#3a2e4a';
      const crack = Math.abs(Math.sin(x * 0.9 + y * 0.6) + Math.cos(y * 1.3 - x * 0.4)) < 0.22;
      if (crack) c = d < 0.6 ? '#ffe27a' : '#ff9a4a';
      b.set(x, y, c, crack ? tg('glow', '#ff7a3a') : tg('stone', '#2a2038'));
    }
    // the sign: a little post and a board with a red "!" and a hand
    for (let y = 6; y < 22; y += 1) b.set(29, y, BR[3], tg('wood', BR[1]));
    grid((x, y, c) => b.set(x, y, c, tg('wood', BR[1])), 25, 0, ['bbbbbbbbb', 'bWWWrWWWb', 'bWWWrWWWb', 'bWWWrWWWb', 'bWWWWWWWb', 'bWWWrWWWb', 'bbbbbbbbb'].map((r) => r.slice(0, 9)), { b: BR[3], W: '#fff4e6', r: '#e03a3a' });
  }, { outline: edgeOf, after: (b) => { b.set(16, 6, '#ffe27a'); b.set(12, 5, '#ff9a4a'); b.set(19, 4, '#fff6c8'); } });
}

// ---------- the whole village ----------

/** Paints the Golden Galaxy's village. lib: { PROPS } from villageprops.js. */
export function paintGalaxy(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 9901;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];
  const lm = L.landmark;
  const riverF = pathField(L.water.map((wa) => wa.pts), 40);
  const inArea = (x, y, pad) => areas.some((a) => x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad);
  const inLandmark = (x, y) => lm && lm.w && x > lm.x - 4 && x < lm.x + lm.w + 4 && y > lm.y + lm.h * 0.6 && y < lm.y + lm.h;

  groundGX(px, L, seed);
  const busy = (x, y) => L.blocked(x, y, 4) || L.onPath(x, y, 9) || L.inWater(x, y, 8) || inArea(x, y, 8) || inLandmark(x, y);
  scatterGX(px, L, seed + 1, busy);
  pathsGX(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plazaGX(px, x, y, r, seed + 40 + i));
  const depths = L.water.map((wa, i) => riverGX(px, L, wa, seed + 60 + i));
  const nearBridge = (x, y) => L.crossings.some((c) => x > c.x - 8 && x < c.x + c.w + 8 && y > c.y - 8 && y < c.y + c.h + 8);
  depths.forEach((d, i) => riverEdgeGX(px, L, d, seed + 66 + i, (x, y) => !nearBridge(x, y) && !inArea(x, y, 6) && Math.min(x, L.W - x, L.H - y, y) > 24));
  areas.forEach((a, i) => {
    if (a.kind === 'pond') nebulaPoolGX(px, a, seed + 70 + i);
    else if (a.kind === 'hockey') moonRinkGX(px, a, seed + 70 + i);
    else dustFieldGX(px, a, a.kind, seed + 70 + i);
  });
  L.crossings.forEach((c) => bridgeGX(px, c));
  wallGX(px, L, seed + 100, (x, y) => riverF(x, y).d < 20);

  // the border spires are the crystal ridge itself: only the ones inside it are drawn
  const border = (p) => (p.kind === 'spire' || p.kind === 'crystal') && (p.x < 0 || p.x + PROPS[p.kind].w > L.W || p.y < 12 || p.y + PROPS[p.kind].h > L.H);
  const DRAW = {
    stall: (p) => stallGX(px, p.x, p.y),
    laundry: (p) => laundryGX(px, p.x, p.y, p.w || 84),
    orb: (p) => orbGX(px, p.x, p.y, p.c),
    lamp: (p) => lampGX(px, p.x, p.y),
    crystal: (p) => crystalGX(px, p.x, p.y, p.c),
    spire: (p) => spireGX(px, p.x, p.y, p.c),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const props = L.props.filter((p) => !border(p));
  const under = (p) => areas.some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);
  const home = L.home;
  const stand = [
    { y: home.y + home.h, draw: () => domeGX(px, home.x, home.y, home.w, home.h, { cap: opts.homeRoof || '#ff6b6b', kid: true }) },
    ...L.houses.map((hs) => ({ y: hs.y + hs.h, draw: () => domeGX(px, hs.x, hs.y, hs.w, hs.h, { accent: hs.roof, sign: hs.sign }) })),
    ...props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  stand.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
