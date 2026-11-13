// The Alaskan Fjord (the fjord map's village) in style B, "soft storybook", like the other
// villages (meadowart.js): hue-shifted colors, selective outlines, soft dithered edges. A cold
// green bay between two walls of steep, snow-capped mountains, a waterfall down the east wall,
// spruce forest, bright fishing cabins with metal roofs, a boardwalk on pilings under the west
// wall, and a little harbor with docks and fishing boats where the channel runs out to sea.
//
// This map paints its own seasons (opts.season, opts.progress), because the cold changes it more
// than a recolor could: in winter the snow lies deep on everything, the shore freezes and ice
// floes drift in the bay; in autumn the spruces stay green and it is the low plants (blueberry
// scrub, fireweed, the tundra on the slopes) that turn red and gold, while the first snow creeps
// down the peaks; in spring the snow line pulls back up and lupine comes out.
//
// Everything is one canvas pixel per village pixel, painted into one ImageData and shown with a
// single putImageData. villageprops.js calls paintFjord() for the fjord map.

import { ramp, mix, rng, h2, vnoise, bayer, Buf, grid, inEll, pixelBuffer, clamp, oval, grow, inRound, pathField } from './pixelkit.js';
import { propB, groundShadow, laundryB, smokeB, PB } from './meadowart.js';

// ---------- the palette ----------

export const FJ = {
  grass: ['#234a4a', '#2f6650', '#3f8454', '#55a05a', '#78b862', '#a4d074', '#d6ea9c'], // base 3
  moss: ['#3a5a3a', '#55783c', '#74963e', '#96b248', '#bccc62', '#e0e48c'],
  spruce: ['#12303a', '#184440', '#1f5a46', '#2c744c', '#44905a', '#6cb06c', '#a0d08a'],
  bark: ['#3a2a36', '#5a3e3e', '#7a5646', '#9a7456', '#b8946e'],
  rock: ['#34304a', '#4d4a66', '#6b6a86', '#8c8ca4', '#b0b0c0', '#d4d2d8', '#f0ece8'],
  shingle: ['#4a465a', '#6a6676', '#8a8690', '#a8a4a6', '#c6c0b8', '#e0d8c8', '#f4eedc'],
  snow: ['#7f8fc4', '#a3b4dc', '#c6d4ee', '#e2ebf8', '#f4f8fd', '#ffffff'],
  water: ['#143a5c', '#17506e', '#1d6a82', '#2a8896', '#49a7a8', '#7cc8bc', '#b9e6d6', '#e6faf2'],
  creek: ['#1f5a8a', '#2a78a8', '#3f9ac0', '#6cbcd4', '#a8dcea', '#e2f6fa'],
  ice: ['#8fb8d8', '#b4d4ea', '#d4e8f6', '#eef8fd'],
  board: ['#3a2c3a', '#584450', '#7a6266', '#9c847c', '#bca694', '#d8c8b0', '#efe4cc'],
  rope: ['#7a5a4a', '#b0906a', '#dcc496', '#f4e6c0'],
  red: ['#5c1f30', '#8e2c38', '#b83c40', '#d8584c', '#ec8068', '#f8b09a'],
  gold: ['#8a5a1e', '#b8801e', '#e0aa28', '#f6d04a', '#fff09a'],
  ember: ['#5a2a20', '#8a3c1c', '#bc5a22', '#e27e2e', '#f6a64c', '#ffd28a'],
  wine: ['#4a1a28', '#76222e', '#a63236', '#d04a40', '#ec7454', '#ffa886'],
  fire: ['#7a2a5a', '#b03a7e', '#dc5a9e', '#f08abc', '#ffc4de'], // fireweed
  lupine: ['#3a3a8a', '#5a5ac0', '#8284e0', '#b4b8f6', '#e2e4ff'],
  ink: '#2e2238',
};
const G = FJ.grass; const SP = FJ.spruce; const RK = FJ.rock; const SH = FJ.shingle; const SN = FJ.snow; const WA = FJ.water; const BD = FJ.board; const INK = FJ.ink;

// ---------- the season ----------

const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

/**
 * What a season does here. snowline: how far down the peaks the snow reaches (share of a peak's
 * height, from its top); deep: snow on the ground (0..1); turn: how far the low plants have
 * turned; thaw: patches of old snow left in spring.
 */
export function fjordSeason(season = 'summer', progress = 0.5) {
  const p = clamp(Number(progress) || 0, 0, 1);
  const se = { name: season, p, snowline: 0.36, deep: 0, turn: 0, thaw: 0, bloom: 1 };
  if (season === 'autumn') { se.turn = 0.35 + 0.65 * smooth(0, 0.7, p); se.snowline = 0.34 + 0.16 * smooth(0.3, 1, p); se.bloom = 0.25; }
  else if (season === 'winter') { se.deep = 1; se.snowline = 1.2; se.bloom = 0; }
  else if (season === 'spring') { se.snowline = 0.8 - 0.36 * smooth(0, 0.9, p); se.thaw = 1 - smooth(0, 0.6, p); se.bloom = 0.5 + 0.5 * smooth(0.2, 0.7, p); }
  return se;
}

// ---------- the mountains ----------

/** How wide a peak is on the way down: 0 at the summit, 1 at its foot. */
const prof = (t) => 0.03 + 0.97 * Math.pow(clamp(t, 0, 1), 0.9);

/** The boxes a buddy can't walk into: each peak's whole shape, in slabs. */
export function peakBlocks(peaks) {
  const out = [];
  for (const pk of peaks) {
    const top = pk.base - pk.h;
    for (let y = top; y < pk.base; y += 10) {
      const half = pk.hw * prof((Math.min(pk.base, y + 10) - top) / pk.h);
      out.push([Math.round(pk.cx - half), y, Math.round(half * 2), 10]);
    }
  }
  return out;
}

const SNOW_LIT = [SN[0], SN[0], SN[1], SN[2], SN[3], SN[4], SN[5]];
const TUNDRA = ['#27484a', '#31604e', '#40784e', '#5a9052', '#7ea85a', '#a6c06a', '#cfdc8c'];
const TURNED = [
  ['#4a1a28', '#6a2430', '#903236', '#b84a3c', '#d86c48', '#eea066', '#f8cc92'], // blueberry red
  ['#5a3a22', '#7a4e20', '#a06a22', '#c88c2a', '#e4b03e', '#f4d264', '#fdeea0'], // dwarf birch gold
  ['#5a2a20', '#7c3a1e', '#a85222', '#cc7230', '#e6984a', '#f6c074', '#fde2a8'], // orange
];

/** A tiny spruce on a far slope, 5 x 8. */
function miniSpruce(set, x, y, se, v) {
  const D = se.deep ? ['#2a5a56', SN[3], SN[5]] : [SP[1], SP[3], SP[4]];
  const rows = v % 2 ? ['..b..', '.ab..', '.abc.', 'aabc.', '.abcc', 'aabcc', '..t..'] : ['..b..', '.ab..', 'aabc.', '.abc.', 'aabcc', '..t..'];
  const pal = { a: D[2], b: D[1], c: D[0], t: FJ.bark[1] };
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (pal[r[i]]) set(x - 2 + i, y - rows.length + 1 + j, pal[r[i]]); });
}

/**
 * One peak: a steep pyramid with a ridge down its middle and a few spurs running off it. Lit from
 * the top left: the left flank is light, the right one in shade, and under every spur lies a wedge
 * of shadow, so it reads as planes of rock. Snow on the top (with a toothed lower edge, further
 * down in the gullies), bare rock under it, tundra on the lower slopes and spruce at the foot.
 * Painted straight onto the village, then its reflection below it where there is water (wet(x, y)).
 */
function peakF(out, pk, se, seed, wet, W, H) {
  const { px, data } = out;
  const top = pk.base - pk.h;
  const rnd0 = rng(seed + 40);
  const nSp = pk.h > 190 ? 4 : 3;
  const mk = () => Array.from({ length: nSp }, (_, i) => ({ oy: top + (0.05 + (i + rnd0() * 0.7) * (0.72 / nSp)) * pk.h, m1: 0.5 + rnd0() * 0.45, m2: 1.7 + rnd0() * 1.2 }));
  const spursL = mk(); const spursR = mk();
  const falls = pk.falls ? fallsLine(pk) : null;
  const edge = (y, s) => {
    const t = clamp((y - top) / pk.h, 0, 1);
    const half = pk.hw * prof(t);
    // shoulders and ledges on the way down, and a ragged edge
    const j = (vnoise(seed * 3 + s * 17, y, 16, seed + s) - 0.5) * 0.44 * half + (vnoise(seed + s * 5, y, 6, seed + 9 + s) - 0.5) * 0.18 * half + (vnoise(s * 31, y, 2.4, seed + 5 + s) - 0.5) * 2.4 * Math.min(1, t * 6);
    return Math.max(0.5, half + j * Math.min(1, t * 3 + 0.15));
  };
  const ridgeAt = (y) => {
    const t = clamp((y - top) / pk.h, 0, 1);
    return pk.cx + (vnoise(7, y, 26, seed + 3) - 0.5) * pk.hw * prof(t) * 0.5 + (vnoise(9, y, 6, seed + 4) - 0.5) * 3.4 * Math.min(1, t * 5);
  };
  const footAt = (x) => pk.base + Math.round((vnoise(x, 3, 7, seed + 31) - 0.5) * 5 + (vnoise(x, 5, 2.5, seed + 32) - 0.5) * 2);
  const tooth = (x) => { const q = (x + seed * 3) / 11; const f = q - Math.floor(q); return (Math.abs(f - 0.5) * 2 - 0.5) * (0.05 + h2(Math.floor(q), 4, seed) * 0.07); };
  const y1 = Math.min(H - 1, pk.base + 4);
  for (let y = Math.max(0, top); y <= y1; y += 1) {
    const t = clamp((y - top) / pk.h, 0, 1);
    const xl = Math.round(pk.cx - edge(Math.min(y, pk.base), 1)); const xr = Math.round(pk.cx + edge(Math.min(y, pk.base), 2));
    const ridge = ridgeAt(y);
    for (let x = Math.max(0, xl); x <= Math.min(W - 1, xr); x += 1) {
      if (y > footAt(x)) continue;
      const left = x < ridge;
      const dist = Math.abs(x - ridge);
      const wob = (vnoise(x, y, 6, seed + 6) - 0.5) * 3.2;
      // the spurs on this flank: under each lies a wedge of shadow
      let wedges = 0; let crest = false; let crease = false;
      for (const sp of left ? spursL : spursR) {
        const dy = y - sp.oy + wob;
        if (dy <= 0 || dist < 1.5) continue;
        const a = dist * sp.m1; const z = dist * sp.m2;
        if (dy >= a && dy <= z) wedges += 1;
        if (Math.abs(dy - a) < 0.75) crest = true; else if (Math.abs(dy - z) < 0.7 && dist > 4) crease = true;
      }
      let k = left ? 5 : 3;
      if (wedges) k -= wedges > 1 ? 2 : 1;
      if (crest) k = left ? 6 : 4; else if (crease) k -= 1;
      if (dist < 1.1 && t > 0.02) k = left ? 6 : 2;
      // the faces turn away near the two edges
      if (xr - x < 3 && !left) k -= 1;
      k = clamp(k, 1, 6);
      const shade = wedges > 0;

      // what lies here: snow, rock, tundra
      const sj = tooth(x) + (vnoise(x, y, 7, seed + 10) - 0.5) * 0.06 + (shade ? 0.1 : 0) + (left ? -0.02 : 0.04);
      const steep = !left && shade && vnoise(x * 2.2, y * 0.45, 5, seed + 12) > 0.62 && t > 0.14 && t < 0.84;
      const snowy = se.deep ? !steep : t < se.snowline + sj;
      let c;
      if (snowy) {
        c = SNOW_LIT[k];
        if (!se.deep && t > se.snowline + sj - 0.04 && h2(x, y, seed + 13) > 0.6) c = RK[Math.max(1, k - 1)]; // the snow's ragged hem
        else if (h2(x, y, seed + 13) > 0.988 && t > 0.1 && !se.deep) c = RK[Math.max(1, k - 2)];
      } else {
        const vt = se.deep ? 2 : 0.62 + (vnoise(x, y, 12, seed + 14) - 0.5) * 0.26 + tooth(x + 40) * 0.8 - (shade ? 0.04 : 0) - (se.name === 'spring' ? 0.03 : 0);
        if (t > vt + 0.05 || (t > vt && bayer(x, y) < (t - vt) / 0.05)) {
          // the tundra: green in summer, red and gold when it turns
          let rampV = TUNDRA;
          if (se.turn) {
            const pick = vnoise(x, y, 8, seed + 15); const how = vnoise(x, y, 5, seed + 16);
            if (how < se.turn * 0.95) rampV = TURNED[pick < 0.42 ? 0 : pick < 0.74 ? 1 : 2];
          } else if (se.name === 'spring' && vnoise(x, y, 7, seed + 15) > 0.6) rampV = ['#3a4a3a', '#4e5e3e', '#667846', '#84944e', '#a4b05e', '#c4cc7a', '#e0e4a0'];
          let kk = (crest ? (left ? 5 : 3) : k) - 1;
          const sp2 = h2(x, y, seed + 17);
          if (sp2 < 0.1) kk -= 1; else if (sp2 > 0.9) kk += 1;
          c = rampV[clamp(kk, 1, 5)];
          if (sp2 > 0.985) c = RK[Math.max(1, k - 1)];
        } else {
          let kk = k;
          // strata: short broken ledges a shade darker, and the odd fleck
          if ((y + Math.floor((x - pk.cx) * 0.3)) % 5 === 0 && h2(x >> 2, y, seed + 19) > 0.55) kk -= 1;
          const sp2 = h2(x, y, seed + 8);
          if (sp2 < 0.035) kk -= 1; else if (sp2 > 0.97) kk += 1;
          c = RK[clamp(kk, 1, 6)];
        }
      }
      // the silhouette
      if (x === xl) c = mix(c, INK, 0.2); else if (x === xr) c = mix(c, INK, 0.5);
      else if (y === Math.max(0, top)) c = mix(c, INK, 0.3);
      px(x, y, c);
    }
  }
  if (falls) fallsF(px, falls, se, seed + 30);

  // spruce on the lower slopes, thicker towards the foot
  const rnd = rng(seed + 20);
  const trees = [];
  for (let i = 0; i < pk.hw * 3.4; i += 1) {
    const t = 0.7 + rnd() * 0.3; const y = Math.round(top + t * pk.h);
    const half = pk.hw * prof(t) - 3;
    const x = Math.round(pk.cx + (rnd() * 2 - 1) * half);
    if (rnd() > (t - 0.66) / 0.24 || x < 2 || x > W - 3 || y > H - 2 || y > footAt(x) - 1) continue;
    if (falls && Math.abs(x - falls.xAt(y)) < 11 && y > falls.y0 - 4) continue;
    trees.push([x, y, Math.floor(rnd() * 4)]);
  }
  trees.sort((a, b) => a[1] - b[1]).forEach(([x, y, v]) => miniSpruce((xx, yy, c) => px(xx, yy, c), x, y, se, v));

  // the foot: wet rock and a broken line of foam at the waterline, then the reflection
  const R = Math.round(Math.min(46, pk.h * 0.26));
  for (let x = Math.max(0, Math.round(pk.cx - pk.hw - 2)); x <= Math.min(W - 1, pk.cx + pk.hw + 2); x += 1) {
    const yb = footAt(x);
    if (yb + 2 >= H || !wet(x, yb + 2)) continue;
    px(x, yb, RK[1]);
    const fo = h2(x, 5, seed + 22);
    if (fo > 0.42) px(x, yb + 1, se.deep ? FJ.ice[3] : fo > 0.8 ? '#ffffff' : WA[7]);
    if (fo > 0.86) px(x, yb + 2, WA[6]);
    for (let dy = 2; dy < R; dy += 1) {
      const yy = yb + dy; if (yy >= H) break;
      if (!wet(x, yy)) break;
      const sy = Math.round(yb - dy * 2.4);
      const sx = clamp(Math.round(x + Math.sin(dy / 2.2 + x / 9) * 1.4), 0, W - 1);
      if (sy < Math.max(0, top)) break;
      // broken by ripples, fading with distance
      const rip = h2(Math.floor((x + dy * 3) / 5), dy, seed + 23);
      const a = 0.5 * (1 - dy / R) * (rip < 0.22 ? 0.25 : 1);
      const i = (yy * W + x) * 4; const j = (sy * W + sx) * 4;
      data[i] += (data[j] * 0.8 - data[i]) * a; data[i + 1] += (data[j + 1] * 0.86 - data[i + 1]) * a; data[i + 2] += (data[j + 2] * 0.95 - data[i + 2]) * a;
    }
  }
}

// ---------- the waterfall ----------

/** Where the waterfall runs on its peak: out of the snow, down a cleft in the west flank in two leaps, into the bay. */
function fallsLine(pk) {
  const top = pk.base - pk.h;
  const y0 = Math.round(top + pk.h * 0.33); const yMid = Math.round(top + pk.h * 0.6); const y1 = pk.base + 1;
  const x0 = Math.round(pk.cx - pk.hw * 0.3); const x1 = Math.round(pk.cx - pk.hw * 0.46);
  const xAt = (y) => (y < yMid ? x0 + Math.round(Math.sin((y - y0) / 9) * 0.8) : x0 - 3 + Math.round(((y - yMid) / (y1 - yMid)) * (x1 - x0 + 3)));
  return { x0, y0, yMid, y1, x1, xAt, widthAt: (y) => (y < yMid ? 2.2 + ((y - y0) / (yMid - y0)) * 1.2 : 3.2 + ((y - yMid) / (y1 - yMid)) * 2) };
}

/** The spec's waterfall for the things that move (maplife): its line down the mountain. */
export function fjordFalls(L) {
  const pk = (L.peaks || []).find((q) => q.falls);
  return pk ? fallsLine(pk) : null;
}

function fallsF(px, f, se, seed) {
  const ice = se.deep;
  const W1 = ice ? ['#8fb8d8', '#b4d4ea', '#d4e8f6', '#eef8fd', '#ffffff'] : ['#7cc8dc', '#b4e2ee', '#dcf2f8', '#f4fcfe', '#ffffff'];
  for (let y = f.y0 - 2; y <= f.y1; y += 1) {
    const cx = f.xAt(Math.max(f.y0, y)); const hw = f.widthAt(Math.max(f.y0, y));
    // the cleft: dark wet rock either side, ragged
    const cl = hw + 3 + Math.round(vnoise(3, y, 5, seed) * 2.4);
    for (let x = Math.round(cx - cl); x <= Math.round(cx + cl); x += 1) {
      const d = Math.abs(x - cx) / cl;
      if (d > 0.8 && h2(x, y, seed + 1) > 0.5) continue;
      px(x, y, x < cx ? (d > 0.7 ? RK[3] : RK[2]) : d > 0.7 ? RK[2] : RK[1]);
    }
    if (y < f.y0) continue;
    for (let x = Math.round(cx - hw); x <= Math.round(cx + hw); x += 1) {
      const u = (x - (cx - hw)) / (hw * 2 || 1);
      let k = u < 0.18 ? 1 : u < 0.45 ? 3 : u < 0.8 ? 4 : 2;
      const streak = h2(x, Math.floor((y + x * 5) / (ice ? 9 : 5)), seed + 2);
      if (streak > 0.72) k = Math.min(4, k + 1); else if (streak < 0.2) k = Math.max(0, k - 1);
      px(x, y, W1[k]);
    }
    // the ledge half way: spray
    if (Math.abs(y - f.yMid) < 4) for (let x = Math.round(cx - hw - 4); x <= cx + hw + 4; x += 1) if (bayer(x, y) < 0.85 - Math.abs(y - f.yMid) * 0.18) px(x, y, ice ? '#eef8fd' : '#ffffff');
  }
  if (ice) {
    // icicles off the ledge and the lip
    for (const yy of [f.yMid + 3, f.y0 + 1]) for (let x = f.xAt(yy) - 6; x <= f.xAt(yy) + 7; x += 2) { const len = 2 + Math.floor(h2(x, yy, seed + 3) * 6); for (let k = 0; k < len; k += 1) px(x, yy + k, k === len - 1 ? '#b4d4ea' : '#eef8fd'); }
    return;
  }
  // spray where it lands
  const bx = f.xAt(f.y1); const by = f.y1;
  for (const [mx, my, rx, ry, a] of [[bx, by + 1, 10, 3.4, 1], [bx - 8, by + 3, 6, 2.4, 0.8], [bx + 8, by + 3, 6, 2.4, 0.8], [bx, by - 5, 9, 5, 0.6], [bx - 2, by + 7, 13, 2.6, 0.4]]) {
    for (let y = Math.floor(my - ry); y <= my + ry; y += 1) for (let x = Math.floor(mx - rx); x <= mx + rx; x += 1) {
      if (!inEll(x, y, mx, my, rx, ry)) continue;
      const dd = ((x + 0.5 - mx) / rx) ** 2 + ((y + 0.5 - my) / ry) ** 2;
      if (bayer(x, y) < a * (1.25 - dd)) px(x, y, dd < 0.4 ? '#ffffff' : '#e6faf2');
    }
  }
}

// ---------- the ground ----------

const SNOWG = ['#b9c8ea', '#cfdcf2', '#e2ebf8', '#f0f5fc', '#fafcff', '#ffffff'];

/** Cool meadow grass with mossy patches; deep drifted snow in winter; old snow in the hollows in early spring. */
function groundF(px, L, se, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const n = vnoise(x, y, 26, seed) * 0.7 + vnoise(x, y, 9, seed + 1) * 0.3;
      const b = bayer(x, y); const t = (b - 0.5) * 0.16;
      let c;
      const hollow = vnoise(x, y, 34, seed + 4) * 0.75 + vnoise(x, y, 8, seed + 5) * 0.25;
      if (se.deep || (se.thaw && hollow > 1 - se.thaw * 0.5 + t)) {
        // drifts: light on the side facing the sun (top left), blue in the lee
        const dn = vnoise(x, y, 30, seed + 2) * 0.65 + vnoise(x, y, 11, seed + 3) * 0.35;
        const lee = vnoise(x - 3, y - 3, 30, seed + 2) * 0.65 + vnoise(x - 3, y - 3, 11, seed + 3) * 0.35;
        const s = (dn - lee) * 9 + t * 1.6;
        c = s > 0.34 ? SNOWG[5] : s > 0.08 ? SNOWG[4] : s > -0.2 ? SNOWG[3] : s > -0.42 ? SNOWG[2] : SNOWG[1];
        const sp = h2(x, y, seed + 6);
        if (sp > 0.992) c = '#ffffff'; else if (sp < 0.006) c = SNOWG[2];
        if (!se.deep && hollow < 1 - se.thaw * 0.5 + 0.04) c = b < 0.5 ? SNOWG[2] : '#8aa08a';
      } else {
        c = G[3];
        if (n < 0.33 + t) c = n < 0.24 + t ? '#479256' : '#4e9a58';
        else if (n > 0.66 + t) c = n > 0.76 + t ? '#72b660' : '#63aa5c';
        // moss and sedge, yellower
        const ms = vnoise(x, y, 38, seed + 7) * 0.7 + vnoise(x, y, 7, seed + 8) * 0.3;
        if (ms > 0.6 + t) c = ms > 0.68 + t ? '#86aa4e' : '#6ea252';
        if (se.name === 'autumn') c = mix(c, ms > 0.5 ? '#c2a44a' : '#9aa052', se.turn * (ms > 0.5 ? 0.6 : 0.34));
        else if (se.name === 'spring') c = mix(c, '#8cc468', 0.22 * se.bloom);
      }
      px(x, y, c);
    }
  }
  if (se.deep) return;
  // tufts
  const rnd = rng(seed + 9);
  const TF = [['.L', 'D.'], ['L.', '.D'], ['L', 'D'], ['..L', '.D.', 'D..'], ['L.L', '.D.'], ['.L.', 'D.D']];
  for (let gy = 0; gy < H; gy += 6) for (let gx = 0; gx < W; gx += 7) {
    if (rnd() < 0.5) continue;
    const x = gx + Math.floor(rnd() * 7); const y = gy + Math.floor(rnd() * 6); const k = Math.floor(rnd() * TF.length);
    const dry = se.name === 'autumn' && rnd() < se.turn * 0.6;
    grid(px, x, y, TF[k], dry ? { D: '#9a8a3e', L: '#e0cc72' } : { D: G[2], L: G[4] });
  }
}

/**
 * The low plants: blueberry scrub in mats (it turns red in autumn), fireweed in tall magenta
 * spikes (seed fluff in autumn), lupine in spring and summer, cotton grass, little rocks.
 * free(x, y): nothing else is there.
 */
function plantsF(px, L, se, seed, free) {
  const rnd = rng(seed);
  const { W, H } = L;
  // scrub mats
  for (let i = 0, placed = 0; i < 700 && placed < 44; i += 1) {
    const cx = 24 + rnd() * (W - 48); const cy = 26 + rnd() * (H - 52); const rx = 5 + rnd() * 7; const ry = 2.5 + rnd() * 3; const pick = rnd();
    if (!free(cx, cy, 6) || !free(cx - rx, cy, 2) || !free(cx + rx, cy, 2)) continue;
    placed += 1;
    const R0 = se.turn && rnd() < se.turn + 0.15 ? TURNED[pick < 0.6 ? 0 : pick < 0.85 ? 2 : 1] : ['#1f4a44', '#2a6048', '#38784a', '#4c9050', '#6aa858', '#8cc066', '#b4d67e'];
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 1; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (vnoise(x, y, 3, seed + i) - 0.5) * 0.5;
      if (d > 1) { if (d < 1.25 && y > cy && !se.deep) px(x, y, 'rgba(30,34,56,0.18)'); continue; }
      if (se.deep) { px(x, y, y < cy - ry * 0.2 ? SNOWG[5] : d > 0.7 ? SNOWG[1] : SNOWG[3]); if (d > 0.5 && y > cy && h2(x, y, seed) > 0.72) px(x, y, '#5a4650'); continue; }
      const l = -((x - cx) / rx * 0.5 + (y - cy) / ry * 0.9);
      let k = l > 0.5 ? 5 : l > 0.1 ? 4 : l > -0.4 ? 3 : 2;
      const s = h2(x, y, seed + 3); if (s > 0.86) k += 1; else if (s < 0.14) k -= 1;
      px(x, y, R0[clamp(k, 1, 6)]);
      if (!se.turn && se.name !== 'spring' && h2(x, y, seed + 4) > 0.955) px(x, y, '#4a56b0'); // berries
    }
  }
  // fireweed and lupine in drifts
  const spike = (x, y, hgt, C, leaf) => { for (let k = 0; k < hgt; k += 1) { const c = k < 2 ? leaf : C[k > hgt - 2 ? 3 : k % 2 ? 2 : 1]; px(x, y - k, c); if (k >= 2 && k < hgt - 1 && k % 2 === 0) px(x + (k % 4 ? 1 : -1), y - k, C[2]); } };
  for (let i = 0, placed = 0; i < 900 && placed < 64; i += 1) {
    const cx = 24 + rnd() * (W - 48); const cy = 30 + rnd() * (H - 60); const lup = rnd() < 0.42;
    const n = 5 + Math.floor(rnd() * 8);
    if (!free(cx, cy, 2)) continue;
    placed += 1;
    for (let j = 0; j < n; j += 1) {
      const x = Math.round(cx + (rnd() - 0.5) * 16); const y = Math.round(cy + (rnd() - 0.5) * 8); const hgt = 5 + Math.floor(rnd() * 4);
      if (!free(x, y, 4) || !free(x, y - hgt, 2)) continue;
      if (se.deep) { if (rnd() < 0.35) { px(x, y, '#8a7a72'); px(x, y - 1, '#a8988a'); px(x, y - 2, '#ffffff'); } continue; }
      if (se.name === 'autumn') {
        if (lup) { px(x, y, '#8a7a3e'); px(x, y - 1, '#b09a4a'); continue; }
        // fireweed gone to seed: red leaves, white fluff
        for (let k = 0; k < hgt; k += 1) px(x, y - k, k < hgt - 3 ? (k % 2 ? '#c8443a' : '#a03236') : '#f6eee8');
        px(x + 1, y - hgt + 1, '#ffffff'); px(x - 1, y - hgt + 2, '#e8dcd8');
        continue;
      }
      if (se.name === 'spring' && !lup && se.p < 0.6) { px(x, y, G[2]); px(x, y - 1, '#c05a6a'); continue; } // red shoots
      spike(x, y, lup ? hgt - 1 : hgt, lup ? FJ.lupine : FJ.fire, lup ? G[2] : G[1]);
    }
  }
  // cotton grass and forget-me-nots, single
  for (let i = 0; i < 620; i += 1) {
    const x = Math.round(22 + rnd() * (W - 44)); const y = Math.round(26 + rnd() * (H - 52)); const k = rnd();
    if (!free(x, y, 4)) continue;
    if (se.deep) { if (k < 0.2) { px(x, y, SNOWG[1], 2, 1); px(x, y - 1, '#ffffff', 2, 1); } continue; }
    if (k < 0.34) { px(x, y, G[2]); px(x, y - 1, G[2]); px(x, y - 2, '#fbf8ee'); px(x + 1, y - 2, '#e4dcc8'); }
    else if (k < 0.7 && se.name !== 'autumn') { px(x, y, '#6ea0f0'); px(x + 1, y, '#c0dcff'); px(x, y + 1, G[2]); px(x + 2, y + 1, '#6ea0f0'); px(x + 2, y, '#fff4a8'); }
    else if (k < 0.82) { px(x, y, RK[3], 3, 1); px(x, y - 1, RK[5], 2, 1); px(x, y + 1, 'rgba(30,34,56,0.25)', 3, 1); }
    else if (se.name === 'autumn') { px(x, y, '#d86c48'); px(x + 1, y - 1, '#e4b03e'); px(x - 1, y, '#b84a3c'); }
    else { px(x, y, G[5]); px(x + 1, y - 1, G[4]); }
  }
}

// ---------- the bay ----------

/**
 * Glacier-fed sea water: pale and milky at the shore, teal over the shallows, deep blue-green
 * out in the middle, long ripples and sparkles. D(x, y) is how far into the water a point is.
 * In winter the shore freezes into a shelf and floes drift in the bay.
 */
function bayF(px, L, D, se, seed) {
  const { W, H } = L;
  const C = se.deep ? ['#122e52', '#153f62', '#1a5272', '#236a82', '#3c8a96', '#6eb0b0', '#b4d4ea', '#eef8fd'] : se.name === 'autumn' ? ['#143654', '#174a66', '#1d627a', '#2a808e', '#4a9ea0', '#7cc0b4', '#b9e0d0', '#e6f6ee'] : WA;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const d = D(x, y);
      if (d < -11) continue;
      const b = bayer(x, y);
      if (d < 0) {
        // the beach: shingle, darker and wet near the water, pebbles
        const tt = (d + 11) / 5;
        if (d < -6 && b > tt * 0.9) continue;
        const pe = h2(x >> 1, y >> 1, seed + 1); const fine = h2(x, y, seed + 2);
        let c = SH[4];
        if (pe < 0.2) c = SH[3]; else if (pe > 0.82) c = SH[5];
        if (fine < 0.07) c = SH[2]; else if (fine > 0.95) c = SH[6];
        if (d > -3) c = d > -1.4 ? SH[1] : mix(c, SH[1], 0.5);
        if (se.deep) c = d > -2 ? FJ.ice[1] : (fine > 0.9 ? SNOWG[3] : SNOWG[4]);
        else if (se.thaw && vnoise(x, y, 12, seed + 3) > 1 - se.thaw * 0.45) c = SNOWG[3];
        px(x, y, c);
        continue;
      }
      // long ripples: stretched noise sideways
      const wv = vnoise(x * 0.35, y * 1.5, 6, seed + 4) * 0.6 + vnoise(x * 0.5, y * 2.2, 3, seed + 5) * 0.4;
      const dj = d + (vnoise(x, y, 14, seed + 6) - 0.5) * 8;
      let k;
      if (d < 1.2) k = b < 0.55 ? 7 : 6;
      else if (d < 3.2) k = wv > 0.55 ? 6 : 5;
      else if (dj < 9) k = b < (9 - dj) / 5 ? 5 : 4;
      else if (dj < 22) k = b < (22 - dj) / 12 ? 4 : 3;
      else if (dj < 52) k = b < (52 - dj) / 30 ? 3 : 2;
      else k = b < (88 - dj) / 36 ? 2 : 1;
      if (d > 3) { if (wv > 0.69) k = Math.min(6, k + 1); else if (wv < 0.3) k = Math.max(0, k - 1); }
      let c = C[k];
      if (se.deep) {
        // the frozen shore: a shelf of ice with a broken blue edge
        const shelf = 7 + (vnoise(x, y, 16, seed + 7) - 0.3) * 14;
        if (d < shelf) c = d > shelf - 1.3 ? FJ.ice[0] : d > shelf - 2.6 ? FJ.ice[1] : h2(x, y, seed + 8) > 0.9 ? FJ.ice[2] : SNOWG[4 + (h2(x >> 2, y >> 1, seed + 9) > 0.6 ? 1 : 0)];
      }
      px(x, y, c);
    }
  }
  // sparkles on the open water
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (h2(x, y, seed + 10) < 0.9955) continue;
    if (D(x, y) < (se.deep ? 22 : 6) || D(x + 4, y) < 6) continue;
    px(x, y, '#ffffff'); px(x + 1, y, C[6], 1 + Math.floor(h2(y, x, seed) * 3), 1);
  }
  if (!se.deep) return;
  // ice floes
  const rnd = rng(seed + 11);
  for (let i = 0; i < 70; i += 1) {
    const cx = rnd() * W; const cy = rnd() * H; const rx = 3 + rnd() * 7; const ry = 1.6 + rnd() * 2.6;
    if (D(cx, cy) < 24 || D(cx - rx, cy) < 16 || D(cx + rx, cy) < 16) continue;
    for (let y = Math.floor(cy - ry - 1); y <= cy + ry + 2; y += 1) for (let x = Math.floor(cx - rx - 1); x <= cx + rx + 1; x += 1) {
      const dd = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + (vnoise(x, y, 3, seed + i) - 0.5) * 0.7;
      if (dd <= 1) px(x, y, dd > 0.72 && y > cy ? FJ.ice[1] : (x - cx) + (y - cy) * 2 < -rx * 0.3 ? '#ffffff' : SNOWG[4]);
      else if (((x + 0.5 - cx) / rx) ** 2 + ((y - 1.5 - cy) / ry) ** 2 <= 1) px(x, y, C[1]);
    }
  }
}

/** The creek: stones along its banks, clear quick water; in winter, snowed over with a dark thread of open water. */
function creekF(px, L, wa, depth, se, seed, bayD) {
  const xs = wa.pts.map((p) => p[0]); const ys = wa.pts.map((p) => p[1]);
  const C = FJ.creek;
  for (let y = Math.max(0, Math.min(...ys) - 12); y < Math.min(L.H, Math.max(...ys) + 12); y += 1) {
    for (let x = Math.max(0, Math.min(...xs) - 14); x < Math.min(L.W, Math.max(...xs) + 14); x += 1) {
      const d = depth(wa, x, y);
      if (d < -4.5 || bayD(x, y) > 0.5) continue;
      const b = bayer(x, y);
      if (d < 0) {
        // banks: gravel, bigger stones
        if (d < -2.5 && b > (d + 4.5) / 2) continue;
        const st = h2(x >> 1, y >> 1, seed);
        let c = st < 0.3 ? SH[3] : st > 0.8 ? SH[5] : SH[4];
        if (d > -1.2) c = SH[1];
        if (se.deep) c = d > -1.2 ? FJ.ice[1] : SNOWG[4];
        px(x, y, c);
        continue;
      }
      const upLeft = depth(wa, x - 1, y - 1) < d;
      let c = d < 1.2 ? (upLeft ? C[1] : C[4]) : d < 3 ? C[2] : C[1];
      const rp = h2(Math.floor((x + y * 0.6) / 3), Math.floor(y / 2), seed + 1);
      if (d >= 1.2 && rp > 0.8) c = C[4]; else if (d >= 1.2 && rp < 0.12) c = C[0];
      if (se.deep) c = d < 2.2 ? (h2(x, y, seed + 2) > 0.85 ? FJ.ice[2] : SNOWG[4]) : d < 3.2 ? FJ.ice[0] : '#1f4a72';
      px(x, y, c);
    }
  }
  // stepping boulders
  const rnd = rng(seed + 3);
  for (let i = 0; i < 16; i += 1) {
    const k = 1 + Math.floor(rnd() * (wa.pts.length - 1)); const u = rnd();
    const x = wa.pts[k - 1][0] + (wa.pts[k][0] - wa.pts[k - 1][0]) * u + (rnd() < 0.5 ? -1 : 1) * (wa.w / 2 + rnd() * 2);
    const y = wa.pts[k - 1][1] + (wa.pts[k][1] - wa.pts[k - 1][1]) * u;
    if (y < 24 || bayD(x, y) > -6) continue;
    boulderF(px, Math.round(x), Math.round(y), 2.4 + rnd() * 2, se, seed + i);
  }
}

/** A rounded grey boulder, lit from the top left, snow-capped in winter. */
export function boulderF(px, cx, cy, r, se, seed) {
  const ry = r * 0.72;
  for (let x = Math.floor(cx - r); x <= cx + r + 1; x += 1) px(x, Math.round(cy + ry), 'rgba(30,34,56,0.3)');
  for (let y = Math.floor(cy - ry); y <= cy + ry; y += 1) for (let x = Math.floor(cx - r); x <= cx + r; x += 1) {
    if (!inEll(x, y, cx + 0.5, cy + 0.5, r + 0.3, ry + 0.3)) continue;
    const l = -((x + 0.5 - cx) / r * 0.6 + (y + 0.5 - cy) / ry * 0.8);
    let c = RK[l > 0.5 ? 6 : l > 0.1 ? 5 : l > -0.35 ? 4 : l > -0.7 ? 3 : 2];
    if (h2(x, y, seed) > 0.9) c = RK[3];
    if (se.deep && y < cy - ry * 0.1) c = l > 0.3 ? '#ffffff' : SNOWG[3];
    else if (!se.deep && y < cy - ry * 0.5 && vnoise(x, y, 2, seed) > 0.55) c = FJ.moss[3];
    px(x, y, c);
  }
}

/** A rocky islet in the bay: wave-washed rock, a tuft of grass on top, a couple of little spruces. */
function isletF(px, it, se, seed) {
  const { x: cx, y: cy, rx, ry } = it;
  for (let y = Math.floor(cy - ry - 5); y <= cy + ry + 3; y += 1) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
    const nz = (vnoise(x, y, 4, seed) - 0.5) * 0.5;
    const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 + nz;
    const dTop = ((x + 0.5 - cx) / (rx - 2)) ** 2 + ((y + 4.5 - cy) / (ry - 1)) ** 2 + nz;
    if (d > 1) { if (d < 1.3) px(x, y, bayer(x, y) < 0.6 ? (se.deep ? FJ.ice[3] : WA[7]) : WA[5]); continue; }
    if (dTop <= 1) {
      // the top: grass (snow in winter)
      const l = -((x - cx) / rx * 0.5 + (y + 4 - cy) / ry * 0.9);
      if (se.deep) px(x, y, l > 0.3 ? '#ffffff' : l > -0.3 ? SNOWG[4] : SNOWG[2]);
      else px(x, y, se.turn && vnoise(x, y, 3, seed + 1) > 0.5 ? TURNED[0][l > 0 ? 4 : 3] : G[l > 0.4 ? 5 : l > -0.2 ? 4 : 3]);
    } else {
      const band = Math.floor((y + vnoise(x, 0, 5, seed + 2) * 3) / 3);
      let k = y > cy + ry * 0.45 ? 1 : x < cx - rx * 0.3 ? 4 : x > cx + rx * 0.5 ? 2 : 3;
      if (band % 2) k += 1;
      px(x, y, RK[clamp(k, 1, 5)]);
    }
  }
}

// ---------- spruce ----------

const spruceKept = new Map();
/** A spruce w x h as a list of cells: tiers of drooping boughs, lit from the left; snow on every bough in winter. */
function spruceCells(w, h, v, deep) {
  const key = `${w}|${h}|${v}|${deep ? 1 : 0}`;
  if (spruceKept.has(key)) return spruceKept.get(key);
  const b = new Buf(w, h, 2);
  const mid = (w - 1) / 2; const body = h - 4; const tiers = Math.max(3, Math.round(body / 7.5)); const tierH = body / tiers;
  // the trunk
  for (let y = h - 6; y < h; y += 1) { b.set(Math.floor(mid), y, FJ.bark[2], 'bark'); b.set(Math.floor(mid) + 1, y, FJ.bark[1], 'bark'); if (w > 18) b.set(Math.floor(mid) - 1, y, FJ.bark[3], 'bark'); }
  for (let y = 0; y < body; y += 1) {
    const tier = Math.floor(y / tierH); const ph = (y - tier * tierH) / tierH;
    const tt = (y + 1) / body;
    const half = Math.max(0.6, (mid + 0.4) * (0.1 + 0.9 * tt) * (0.56 + 0.44 * ph) + (h2(y, v, 77) - 0.5) * 1.1);
    for (let x = Math.ceil(mid - half); x <= Math.floor(mid + half); x += 1) {
      const u = (x - mid) / (half || 1);
      let k = u < -0.45 ? 5 : u < 0.05 ? 4 : u < 0.5 ? 3 : 2;
      if (ph > 0.78) k -= 1; // under each bough
      if (ph < 0.22 && u < 0.2 && tier > 0) k += 1;
      const s = h2(x, y, 31 + v * 7);
      if (s > 0.86) k += 1; else if (s < 0.16) k -= 1;
      let c = SP[clamp(k, 1, 6)];
      if (deep) {
        // snow lies on the top of each bough, the dark green shows under it
        const lie = ph < 0.5 + (h2(x, tier, 5 + v) - 0.5) * 0.3;
        if (lie || tier === 0) c = u < -0.2 ? '#ffffff' : u < 0.45 ? SNOWG[4] : SNOWG[2];
        else c = SP[clamp(k - 2, 0, 3)];
      }
      b.set(x, y, c, 'leaf');
    }
  }
  b.outline((tag, side) => (tag === 'bark' ? (side === 'bottom' ? INK : FJ.bark[0]) : side === 'top' || side === 'left' ? (deep ? SN[1] : SP[1]) : (deep ? SN[0] : SP[0])));
  const cells = [];
  b.each((x, y) => { const c = b.get(x, y); if (c) cells.push([x, y, c]); });
  spruceKept.set(key, cells);
  return cells;
}

const SPRUCE_SIZES = { s: [13, 22], m: [17, 30], l: [21, 40], xl: [25, 50] };
/** A spruce standing with its foot at (x, y) (the middle of its trunk's bottom). */
function spruceAt(px, x, y, size, se, v = 0) {
  const [w, h] = SPRUCE_SIZES[size] || SPRUCE_SIZES.l;
  if (!se.deep) groundShadow(px, x + 2, y, w * 0.42, 2.2, 0.2);
  else groundShadow(px, x + 2, y, w * 0.42, 2.2, 0.12);
  const X = Math.round(x - (w - 1) / 2); const Y = y - h + 1;
  spruceCells(w, h, v % 3, se.deep).forEach(([cx, cy, c]) => px(X + cx, Y + cy, c));
}
/** The spruce as a village prop (see villageprops.js PROPS): p.x, p.y its top left, 21 x 40. */
export function spruceF(px, p, se = fjordSeason()) { spruceAt(px, p.x + 10, p.y + 39, p.s || 'l', se, (p.x + p.y) % 3); }

/** The forest wall along the edges of the land (not where the mountains or the water are). */
function forestF(L, se, seed, open) {
  const { W, H } = L;
  const rnd = rng(seed);
  const out = [];
  const add = (x, y, size) => { if (open(x, y)) out.push({ y, draw: (px) => spruceAt(px, x, y, size, se, Math.floor(rnd() * 3)) }); };
  for (let row = 0; row < 3; row += 1) {
    for (let x = -6 + row * 5; x < W + 8; x += 9 + Math.floor(rnd() * 6)) {
      add(x, [9, 18, 26][row] + Math.floor(rnd() * 4), ['xl', 'l', 'l'][row]);
      add(x + 4, H + [22, 12, 3][row] - Math.floor(rnd() * 4), ['xl', 'l', 'm'][row]);
    }
  }
  for (let col = 0; col < 2; col += 1) {
    for (let y = 30; y < H - 6; y += 10 + Math.floor(rnd() * 7)) {
      add([2, 11][col] + Math.floor(rnd() * 4), y + col * 5, col ? 'l' : 'xl');
      add(W - [3, 12][col] - Math.floor(rnd() * 4), y + col * 5, col ? 'l' : 'xl');
    }
  }
  return out;
}

// ---------- paths, plazas, decks ----------

/** Gravel paths that fade into the grass; in winter a trodden trench in the snow, with boot prints. */
function pathsF(px, L, se, seed, skip) {
  const F = pathField(L.paths, 10);
  const [bx, by, bw, bh] = [0, 0, L.W, L.H];
  for (let y = by; y < by + bh; y += 1) {
    for (let x = bx; x < bx + bw; x += 1) {
      const f = F(x, y);
      if (f.d > 8.5 || skip(x, y)) continue;
      const b = bayer(x, y);
      const edge = 5.2 + (vnoise(x, y, 6, seed) - 0.5) * 2.4;
      if (f.d > edge) { if (f.d < edge + 2.4 && b < ((edge + 2.4 - f.d) / 2.4) * 0.8) px(x, y, se.deep ? SNOWG[2] : SH[3]); continue; }
      let c;
      if (se.deep) {
        c = f.d > edge - 1.1 ? (f.nx + f.ny < 0 ? SNOWG[0] : SNOWG[5]) : f.d < 2.6 ? SNOWG[1] : SNOWG[2];
        const st = Math.floor(f.along / 5); const side = st % 2 ? 1.6 : -1.6;
        if (Math.abs(f.off - side) < 1 && Math.abs((f.along % 5) - 2) < 1.2 && h2(st, 1, seed) > 0.25) c = '#8a9acc';
      } else {
        const pe = h2(x >> 1, y >> 1, seed + 1); const fine = h2(x, y, seed + 2);
        c = pe < 0.22 ? SH[3] : pe > 0.8 ? SH[5] : SH[4];
        if (fine < 0.06) c = SH[2]; else if (fine > 0.95) c = SH[6];
        if (f.d > edge - 1.2) c = f.nx + f.ny < 0 ? SH[2] : SH[3];
        else if (f.d < 2 && b < 0.4) c = SH[5];
        if (se.thaw && vnoise(x, y, 10, seed + 3) > 1 - se.thaw * 0.3) c = SNOWG[3];
      }
      px(x, y, c);
    }
  }
}

/** A round place laid with flat beach stones (the snow shovelled off its middle in winter). */
function plazaF(px, cx, cy, r, se, seed) {
  for (let y = cy - r - 2; y <= cy + r + 2; y += 1) for (let x = cx - r - 2; x <= cx + r + 2; x += 1) {
    const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy) + (vnoise(x, y, 5, seed) - 0.5) * 2.2;
    if (d > r + 1.5) continue;
    const b = bayer(x, y);
    if (d > r - 0.5) { if (b < (r + 1.5 - d) / 2) px(x, y, se.deep ? SNOWG[2] : SH[3]); continue; }
    // slabs: rows 5 tall, stones 6 to 9 wide, each row shifted
    const row = Math.floor(y / 5); const v = ((y % 5) + 5) % 5;
    const sh = Math.floor(h2(row, 1, seed) * 8); const q = x + sh; const col = Math.floor(q / 8); const u = ((q % 8) + 8) % 8;
    const t = h2(col, row, seed + 1);
    let c = t < 0.3 ? SH[4] : t > 0.75 ? RK[5] : SH[5];
    if (v === 4 || u === 7) c = SH[2]; else if (v === 0 || u === 0) c = SH[6];
    if (se.deep) {
      const cleared = d < r * 0.62 + (vnoise(x, y, 4, seed + 2) - 0.5) * 4;
      if (!cleared) c = d > r - 3 ? SNOWG[5] : SNOWG[4];
      else if (v === 4 || u === 7 || h2(x, y, seed + 3) > 0.8) c = SNOWG[3];
      else c = mix(c, SNOWG[2], 0.35);
    }
    px(x, y, c);
  }
}

/**
 * A deck on pilings: the boardwalk under the cliffs (dir 'v': walked up and down), the wharf and
 * the docks (dir 'h'). Weathered planks, a beam under the near edge, posts standing in the water
 * with their shadows; in winter snow lies on it but for a trodden lane down the middle.
 */
function deckF(px, B, se, seed, wet, o = {}) {
  const v = B.dir !== 'h';
  const { x: X, y: Y, w, h } = B;
  // its shadow on the water
  for (let y = Y + 3; y < Y + h + 7; y += 1) for (let x = X + 2; x < X + w + 3; x += 1) if ((x >= X + w || y >= Y + h) && wet(x, y)) px(x, y, 'rgba(8,24,52,0.34)');
  // pilings under the near edge, and their reflections
  const posts = [];
  if (v) { for (let y = Y + 8; y < Y + h - 2; y += 22) posts.push([X - 1, y], [X + w - 2, y]); posts.push([X + 1, Y + h - 1], [X + w - 4, Y + h - 1]); }
  else { for (let x = X + 3; x < X + w - 2; x += 16) posts.push([x, Y + h - 1]); posts.push([X + w - 4, Y + h - 1]); }
  for (const [x, y] of posts) {
    if (!wet(x + 1, y + 5)) continue;
    for (let k = 0; k < 7; k += 1) { px(x, y + k, BD[3]); px(x + 1, y + k, BD[2]); px(x + 2, y + k, BD[0]); }
    px(x, y + 7, WA[6], 3, 1); px(x - 1, y + 8, WA[5], 2, 1);
    for (let k = 9; k < 13; k += 1) if (k % 2) px(x + (k % 4 === 1 ? 0 : 1), y + k, 'rgba(20,24,44,0.4)', 2, 1);
  }
  for (let y = Y; y < Y + h; y += 1) {
    for (let x = X; x < X + w; x += 1) {
      const along = v ? y : x; const across = v ? x - X : y - Y; const wid = v ? w : h;
      const k = Math.floor(along / 4); const a = ((along % 4) + 4) % 4;
      const lo = h2(k, 1, seed) < 0.14 ? 1 : 0; const hi = h2(k, 2, seed) < 0.14 ? wid - 1 : wid;
      if (across < lo || across >= hi) continue;
      const t = h2(k, 3, seed);
      const P = t < 0.22 ? [BD[2], BD[3], BD[4]] : t > 0.8 ? [BD[3], BD[5], BD[6]] : [BD[3], BD[4], BD[5]];
      let c = a === 3 ? BD[1] : a === 0 ? P[2] : a === 2 ? P[0] : P[1];
      if (across === lo) c = a === 3 ? BD[2] : BD[5];
      else if (across === hi - 1) c = BD[1];
      if (a === 1 && (across === lo + 2 || across === hi - 3)) c = BD[1]; // nails
      else if (a !== 3 && h2(x >> 1, y >> 1, seed + 9) < 0.05) c = P[0];
      if (se.deep) {
        const lane = Math.abs(across - wid / 2 + 0.5) < wid * 0.22 + (vnoise(x, y, 5, seed + 4) - 0.5) * 2.6;
        if (!lane) c = across < wid / 2 ? SNOWG[5] : SNOWG[3];
        else if (a !== 3 && bayer(x, y) < 0.45) c = SNOWG[2];
      } else if (se.thaw && vnoise(x, y, 8, seed + 5) > 1 - se.thaw * 0.35) c = SNOWG[4];
      px(x, y, c);
    }
  }
  // the beam under the near edge
  if (!v || o.cap) for (let x = X; x < X + w; x += 1) { px(x, Y + h, BD[2]); px(x, Y + h + 1, BD[0]); }
  if (v) for (let y = Y; y < Y + h; y += 1) px(X + w, y, wet(X + w + 1, y) ? BD[0] : 'rgba(20,24,44,0.3)');
  // a rope rail on posts along the water side (o.rail: 'e' east, 's' south)
  if (o.rail === 'e') {
    const R = FJ.rope; const xs = X + w - 2;
    const ys = []; for (let y = Y + 4; y <= Y + h - 2; y += 24) ys.push(y);
    for (let i = 1; i < ys.length; i += 1) for (let y = ys[i - 1]; y <= ys[i]; y += 1) { const sag = Math.round(Math.sin(((y - ys[i - 1]) / (ys[i] - ys[i - 1])) * Math.PI) * 1.6); px(xs + 2 + sag, y - 4, R[2]); }
    ys.forEach((y) => { grid(px, xs, y - 8, ['.ll.', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'lmmd', 'dddd'], { l: se.deep ? '#ffffff' : BD[5], m: BD[3], d: BD[1] }); if (se.deep) px(xs, y - 9, '#ffffff', 4, 1); });
  }
}

/** A bollard on a dock, with a turn of rope. */
function bollardF(px, x, y, se) {
  grid(px, x, y, ['.ll.', 'lmmd', 'rrrr', 'lmmd', 'dddd'], { l: se.deep ? '#ffffff' : BD[5], m: BD[3], d: BD[0], r: FJ.rope[2] });
}

/** The little footbridge over the creek: a few logs side by side with a rail. */
function logBridgeF(px, c, se) {
  const { x: X, y: Y, w, h } = c;
  px(X + 1, Y + h, 'rgba(8,24,52,0.3)', w, 2);
  for (let y = Y + 2; y < Y + h - 2; y += 1) for (let x = X - 1; x < X + w + 1; x += 1) {
    const a = ((y - Y) % 4 + 4) % 4;
    let c2 = a === 3 ? BD[1] : a === 0 ? BD[5] : a === 2 ? BD[3] : BD[4];
    if (h2(x >> 1, y, 5) < 0.08) c2 = BD[2];
    if (se.deep && a !== 3 && (Math.abs(y - (Y + h / 2)) > 3 || bayer(x, y) < 0.4)) c2 = a === 0 ? '#ffffff' : SNOWG[3];
    px(x, y, c2);
  }
  for (const x of [X - 2, X + w - 1]) { px(x, Y + 1, INK, 3, h - 2); px(x, Y + 1, BD[2], 2, h - 3); }
  // rails
  for (const yy of [Y - 3, Y + h - 6]) {
    for (let x = X - 3; x < X + w + 3; x += 1) { px(x, yy, se.deep ? '#ffffff' : BD[5]); px(x, yy + 1, BD[2]); }
    for (const x of [X - 3, X + w + 1]) grid(px, x, yy - 2, ['ll', 'md', 'md', 'md', 'md', 'dd'], { l: se.deep ? '#ffffff' : BD[5], m: BD[3], d: BD[1] });
  }
}

// ---------- cabins ----------

const TRIM = ['#8a8098', '#c9c0c8', '#ece6de', '#fbf7ee'];
const cabinEdge = (RF, WL) => (tag, side) => {
  const t = (tag || '').split(':')[0];
  const e = { roof: [RF[1], RF[0]], wall: [WL[1], WL[0]], trim: [TRIM[1], TRIM[0]], wood: [BD[2], BD[0]], metal: ['#4a465a', '#34304a'], snow: [SN[2], SN[0]], glass: [BD[2], BD[0]], stone: [RK[2], RK[0]], buoy: ['#8a3a2a', '#5c1f30'], door: [BD[1], BD[0]] }[t] || [INK, INK];
  if (side === 'bottom') return ['wall', 'stone', 'wood', 'door', 'trim'].includes(t) ? INK : e[1];
  return side === 'right' ? e[1] : e[0];
};

/**
 * A fishing cabin: painted clapboard walls with white trim, a steep metal roof with standing
 * seams, a stovepipe, a little porch with a gable over the door, lit windows, buoys hung by
 * the door and firewood stacked under a window. o: { roof, wall, door, home, sign, seed }.
 * In winter the snow lies thick on the roof, icicles hang from the eaves and a drift leans on the wall.
 */
function cabinF(px, X, Y, w, h, o, se) {
  const seed = o.seed ?? (X * 7 + Y * 13 + w);
  const RF = ramp(o.roof || '#b83c40', 3, 2);
  const WL = ramp(o.wall || '#efe3cf', 3, 2);
  const DR = ramp(o.door || o.roof || '#b83c40', 3, 2);
  const b = new Buf(w, h + 4, 30);
  const eave = Math.round(h * 0.5); const mid = Math.round(w / 2);
  const floor = h - 4; // the porch boards
  groundShadow(px, X + mid + 3, Y + h + 1, w / 2 + 3, 3.4, se.deep ? 0.14 : 0.22);

  // the stovepipe, behind the roof
  const sx = Math.round(w * 0.76);
  for (let y = -10; y < 8; y += 1) { b.set(sx, y, '#a8a4a6', 'metal'); b.set(sx + 1, y, '#8a8690', 'metal'); b.set(sx + 2, y, '#5a566a', 'metal'); }
  grid((x, y, c) => b.set(x, y, c, 'metal'), sx - 2, -13, ['..lmd..', '.lmmmd.', 'lmmmmmd'], { l: '#c6c0b8', m: '#8a8690', d: '#4a465a' });

  // walls: clapboard, in shade under the eave, corner boards, short stone piers
  const top = eave - 2; const wl = 4; const wr = w - 4;
  for (let y = top; y < floor; y += 1) {
    for (let x = wl; x < wr; x += 1) {
      const a = ((y - top) % 4 + 4) % 4;
      let c = a === 3 ? WL[1] : a === 0 ? WL[5] : WL[3];
      if (a !== 3 && vnoise(x + X, y + Y, 7, seed) < 0.3 && bayer(x, y) < 0.5) c = WL[2];
      const shd = (top + 7 - y) / 6;
      if (bayer(x, y) < shd) c = a === 3 ? WL[0] : shd > 0.6 ? WL[1] : WL[2];
      if (x >= wr - 3 && a !== 3) c = WL[2];
      if (a !== 3 && h2(x, Math.floor((y - top) / 4), seed + 1) < 0.03) c = WL[1]; // board ends
      b.set(x, y, c, 'wall');
    }
  }
  for (let y = top; y < floor; y += 1) { b.set(wl, y, TRIM[3], 'trim'); b.set(wl + 1, y, TRIM[2], 'trim'); b.set(wr - 2, y, TRIM[2], 'trim'); b.set(wr - 1, y, TRIM[1], 'trim'); }
  for (let x = wl; x < wr; x += 1) { b.set(x, floor - 1, TRIM[2], 'trim'); }
  for (let x = wl + 1; x < wr - 1; x += 1) {
    const pier = ((x - wl) % 14) < 5;
    for (let y = floor; y < h; y += 1) b.set(x, y, pier ? (y === floor ? RK[5] : (x - wl) % 14 === 4 ? RK[2] : RK[4]) : (y === floor ? BD[1] : '#241a2e'), pier ? 'stone' : 'wood');
  }

  // the roof: metal sheets with standing seams
  const roofL = (y) => Math.round(-3 + (1 - y / eave) * 9); const roofR = (y) => w - 1 - roofL(y);
  for (let y = 0; y <= eave; y += 1) {
    for (let x = roofL(y); x <= roofR(y); x += 1) {
      const u = (x - roofL(y)) / (roofR(y) - roofL(y));
      const seam = ((x - mid) % 7 + 7) % 7;
      let c = u < 0.34 ? RF[4] : RF[3];
      if (u >= 0.3 && u < 0.38 && bayer(x, y) < 0.5) c = RF[3];
      if (seam === 0) c = RF[2]; else if (seam === 1) c = RF[5];
      if (y <= 1) c = y === 0 ? RF[5] : RF[4];
      if (y >= eave - 1) c = y === eave ? RF[1] : RF[2];
      if (x >= roofR(y) - 2) c = RF[2]; else if (x === roofL(y)) c = RF[5];
      if (h2(x, y, seed + 2) < 0.02) c = RF[2];
      b.set(x, y, c, 'roof');
    }
  }

  // windows: white frames, four warm panes
  const win = (x0, y0, ww, wh) => {
    b.rect(x0 - 1, y0 - 1, ww + 2, wh + 2, TRIM[3], 'trim');
    for (let yy = 0; yy < wh; yy += 1) for (let xx = 0; xx < ww; xx += 1) {
      const mx = Math.floor(ww / 2); const my = Math.floor(wh / 2);
      let c = yy < my ? PB.glow[3] : PB.glow[2];
      if (xx + yy < 3) c = PB.glow[4];
      if (yy === wh - 1 || xx === ww - 1) c = PB.glow[1];
      if (xx === mx || yy === my) c = TRIM[2];
      b.set(x0 + xx, y0 + yy, c, 'glass');
    }
    b.rect(x0 - 1, y0 + wh + 1, ww + 2, 1, TRIM[1], 'trim'); b.rect(x0 - 2, y0 + wh, ww + 4, 1, TRIM[3], 'trim');
    b.rect(x0 + ww, y0 - 1, 1, wh + 2, TRIM[1], 'trim');
    // a curtain
    for (let yy = 0; yy < 3; yy += 1) for (let xx = 0; xx < ww; xx += 1) if (xx !== Math.floor(ww / 2) && (yy < 2 || xx % 3 === 0)) b.set(x0 + xx, y0 + yy, yy === 2 ? '#e8a8a0' : '#f6c8bc', 'glass');
    if (se.deep) b.rect(x0 - 2, y0 + wh - 1, ww + 4, 1, '#ffffff', 'snow');
  };
  const dw = o.home ? 15 : 13; const dh = Math.min(floor - eave - 5, o.home ? 24 : 21); const dx = mid - Math.floor(dw / 2); const dy = floor - dh;
  const gapL = dx - wl; const wy = top + 9;
  const wx1 = wl + Math.round(gapL / 2) - 6; const wx2 = wr - Math.round(gapL / 2) - 5;
  win(wx1, wy, 11, 11); win(wx2, wy, 11, 11);

  // the porch: boards, two steps, posts and a little gable roof over the door
  const pw = dw + 16; const pl = mid - Math.floor(pw / 2);
  for (let x = pl - 1; x < pl + pw + 1; x += 1) { b.set(x, floor, BD[5], 'wood'); b.set(x, floor + 1, BD[3], 'wood'); b.set(x, floor + 2, BD[1], 'wood'); }
  for (let x = pl + 4; x < pl + pw - 4; x += 1) { b.set(x, floor + 3, BD[5], 'wood'); b.set(x, floor + 4, BD[3], 'wood'); b.set(x, floor + 5, BD[1], 'wood'); }
  // the door
  for (let y = dy; y < floor; y += 1) for (let x = dx; x < dx + dw; x += 1) {
    const edge = x === dx || x === dx + dw - 1 || y === dy;
    let c = DR[3];
    const pxl = x - dx; const pyl = y - dy;
    if (pxl >= 2 && pxl < dw - 2 && pyl >= Math.round(dh * 0.5) && pyl < dh - 2) c = pxl === 2 || pyl === Math.round(dh * 0.5) ? DR[1] : pxl === dw - 3 || pyl === dh - 3 ? DR[4] : DR[2];
    if (x >= dx + dw - 3) c = c === DR[3] ? DR[2] : c;
    if (edge) c = TRIM[3];
    b.set(x, y, c, 'door');
  }
  for (let yy = 3; yy < Math.round(dh * 0.42); yy += 1) for (let xx = 3; xx < dw - 3; xx += 1) b.set(dx + xx, dy + yy, xx === Math.floor(dw / 2) ? TRIM[2] : yy === 3 || xx === 3 ? PB.glow[4] : PB.glow[3], 'glass');
  grid((x, y, c) => b.set(x, y, c, 'door'), dx + dw - 5, dy + Math.round(dh * 0.56), ['yY', 'Yo'], { y: '#fff0a0', Y: '#f0c030', o: '#a86a1a' });
  // porch posts
  const gy = eave + 5; // where the porch roof sits
  for (const x of [pl, pl + pw - 2]) for (let y = gy; y < floor; y += 1) { b.set(x, y, TRIM[3], 'trim'); b.set(x + 1, y, TRIM[1], 'trim'); }
  // the porch gable: a pediment in the wall's color, two roof slopes over it
  const gh = 9; const gx0 = pl - 3; const gx1 = pl + pw + 2; const gm = (gx0 + gx1) / 2;
  for (let y = gy - gh; y <= gy; y += 1) {
    const half = ((y - (gy - gh)) / gh) * ((gx1 - gx0) / 2);
    for (let x = Math.ceil(gm - half); x <= Math.floor(gm + half); x += 1) {
      const d = half - Math.abs(x - gm);
      let c;
      if (d < 3 || y === gy - gh) c = x < gm ? (d < 1 ? RF[5] : RF[4]) : (d < 1 ? RF[1] : RF[2]);
      else if (d < 4) c = TRIM[3];
      else c = y === gy ? TRIM[1] : WL[4];
      b.set(x, y, c, d < 3 ? 'roof' : d < 4 ? 'trim' : 'wall');
    }
  }
  if (o.sign === 'note') {
    // a painted board with a music note under the gable: this is the music hall
    grid((x, y, c) => b.set(x, y, c, 'wood'), mid - 6, gy - 7, [
      '.LLLLLLLLLL.',
      'LcccKKKccccD',
      'LcccKcKKcccD',
      'LcccKccKcccD',
      'LcKKKcccccdD',
      'LKKKKcccccdD',
      'LcKKccccccdD',
      '.DDDDDDDDDD.',
    ], { L: BD[5], D: BD[1], c: '#fff0c8', d: '#e8d0a0', K: '#5a3a8a' });
  } else if (o.home) {
    // a heart on the gable: this is home
    grid((x, y, c) => b.set(x, y, c, 'trim'), mid - 3, gy - 6, ['hH.hH', 'HHHHH', '.HHH.', '..H..'], { H: '#ff6a8a', h: '#ffc0d0' });
  } else {
    // a round vent
    grid((x, y, c) => b.set(x, y, c, 'trim'), mid - 2, gy - 5, ['.ww.', 'wddw', '.ww.'], { w: TRIM[3], d: BD[1] });
  }

  // buoys hung by the door, on a peg
  const bx = pl + pw + 5;
  if (bx + 9 < wx2 + 13 || true) {
    const by = eave + 8;
    const buoy = (x, y, C) => grid((xx, yy, c) => b.set(xx, yy, c, 'buoy'), x, y, ['.r.', '.r.', 'lLd', 'LLd', 'wwW', 'LLd', '.d.'], { r: FJ.rope[2], l: C[2], L: C[1], d: C[0], w: '#ffffff', W: '#c9c0c8' });
    if (!o.noBuoys) { buoy(wl + 3, by + 13, ['#b04a1a', '#f08c3a', '#ffc47a']); buoy(wl + 7, by + 15, ['#8e2c38', '#d8584c', '#f8b09a']); if (o.home) buoy(wr - 7, by + 15, ['#b8801e', '#f6d04a', '#fff09a']); }
  }
  // firewood stacked against the wall on the right
  if (o.wood !== false) {
    const fx = wr - 20; const fy = floor - 7;
    for (let r = 0; r < 3; r += 1) for (let q = 0; q < 5 - (r === 2 ? 1 : 0); q += 1) {
      const x = fx + q * 3 + (r % 2); const y = fy + (2 - r) * 2 + 1;
      if (x + 3 > wr - 2) continue;
      grid((xx, yy, c) => b.set(xx, yy, c, 'wood'), x, y, ['lm', 'md'], { l: '#e8c890', m: h2(q, r, seed) > 0.5 ? '#c89a5a' : '#b08048', d: BD[1] });
    }
    if (se.deep) for (let q = 0; q < 13; q += 1) b.set(fx + q, fy + 1, '#ffffff', 'snow');
  }

  if (se.deep) {
    // deep snow on the roof: a thick slab, higher than the ridge, its front edge in blue shadow
    const slabEnd = eave - 3;
    for (let x = roofL(0) - 1; x <= roofR(0) + 1; x += 1) {
      const mound = 3 + Math.round(Math.sin((x - roofL(0)) / (roofR(0) - roofL(0)) * Math.PI) * 1.6 + (vnoise(x, 1, 6, seed + 3) - 0.5) * 1.6);
      for (let y = -mound; y < 0; y += 1) b.set(x, y, y === -mound ? '#ffffff' : SNOWG[5], 'snow');
    }
    for (let y = 0; y <= slabEnd; y += 1) for (let x = roofL(y) - 1; x <= roofR(y) + 1; x += 1) {
      const u = (x - roofL(y)) / (roofR(y) - roofL(y));
      const wob = Math.round(Math.sin(x / 5 + seed) * 1.2 + (vnoise(x, 2, 4, seed + 4) - 0.5) * 2);
      if (y > slabEnd + wob) continue;
      let c = u < 0.3 ? '#ffffff' : u > 0.9 ? SNOWG[2] : SNOWG[5];
      const dn = vnoise(x + X, y + Y, 9, seed + 5);
      if (dn < 0.32) c = SNOWG[3]; else if (dn > 0.74) c = '#ffffff';
      if (y >= slabEnd + wob - 1) c = y === slabEnd + wob ? SNOWG[0] : SNOWG[2];
      b.set(x, y, c, 'snow');
    }
    // icicles off the eave
    for (let x = roofL(eave) + 1; x < roofR(eave); x += 1) {
      const r = h2(x, 7, seed + 6);
      if (r < 0.5 || (x > pl - 4 && x < pl + pw + 3)) continue;
      const len = 1 + Math.floor((r - 0.5) * 10);
      for (let k = 1; k <= len; k += 1) b.set(x, eave + k, k === len ? '#b4d4ea' : '#eef8fd', 'ice');
    }
    // snow on the porch gable, the stovepipe's cap, and a drift along the foot of the wall
    for (let y = gy - gh - 2; y <= gy - 2; y += 1) {
      const half = ((y + 2 - (gy - gh)) / gh) * ((gx1 - gx0) / 2) + 1;
      for (let x = Math.ceil(gm - half); x <= Math.floor(gm + half); x += 1) { const d = half - Math.abs(x - gm); if (d < 3.2) b.set(x, y, d < 1.2 ? (x < gm ? '#ffffff' : SNOWG[3]) : x < gm ? SNOWG[5] : SNOWG[2], 'snow'); }
    }
    grid((x, y, c) => b.set(x, y, c, 'snow'), sx - 2, -15, ['..www..', '.wwwww.'], { w: '#ffffff' });
    for (let x = wl - 2; x < wr + 2; x += 1) {
      if (x > pl - 2 && x < pl + pw + 1) continue;
      const hgt = 3 + Math.round(vnoise(x, 3, 7, seed + 7) * 4);
      for (let k = 0; k < hgt; k += 1) b.set(x, h - 1 - k, k === hgt - 1 ? '#ffffff' : k < 1 ? SNOWG[2] : SNOWG[4], 'snow');
    }
    for (let x = pl + 4; x < pl + pw - 4; x += 1) if (Math.abs(x - mid) > 3) { b.set(x, floor + 3, '#ffffff', 'snow'); }
  }

  b.outline(cabinEdge(RF, WL));
  b.blit(px, X, Y);
  if (o.smoke !== false) smokeB(px, X + sx + 1, Y - 15);
}

/** The fish market stall: a striped awning on posts, a counter with crates of fish on ice, a hanging scale. 44 x 33. */
function stallF(px, X, Y, se) {
  groundShadow(px, X + 24, Y + 32, 23, 2.6, se.deep ? 0.14 : 0.22);
  propB(px, X, Y, 44, 33, (b) => {
    const A = ['#12707a', '#1c9c8c', '#5cc8b4']; const Wt = ['#c9c0c8', '#f6f2ea', '#ffffff'];
    // posts
    for (const x of [2, 40]) for (let y = 9; y < 32; y += 1) { b.set(x, y, BD[4], 'wood'); b.set(x + 1, y, BD[2], 'wood'); }
    // the back: nets and a board
    for (let y = 11; y < 21; y += 1) for (let x = 4; x < 40; x += 1) b.set(x, y, (x + y) % 3 === 0 ? BD[2] : BD[1], 'wood');
    // hanging fish and a scale
    grid((x, y, c) => b.set(x, y, c, 'wood'), 8, 11, ['.k.', '.k.', 'sSs', 'sSs', 'sSd', '.s.', 'sds'], { k: BD[4], s: '#c8d4dc', S: '#f0f6f8', d: '#8a98a8' });
    grid((x, y, c) => b.set(x, y, c, 'wood'), 14, 11, ['.k.', 'pPp', 'pPp', 'pPd', '.p.', 'pdp'], { k: BD[4], p: '#f08a7a', P: '#ffc0a8', d: '#c0584a' });
    grid((x, y, c) => b.set(x, y, c, 'wood'), 30, 11, ['..k..', '..k..', '.ggg.', 'gGGGg', '.ggg.', '..g..', 'ggggg'], { k: BD[4], g: '#e0aa28', G: '#fff09a' });
    // the counter: crates of ice with fish laid on it
    for (let y = 21; y < 32; y += 1) for (let x = 1; x < 43; x += 1) {
      const a = (y - 21) % 4;
      b.set(x, y, y === 21 ? BD[6] : a === 0 ? BD[2] : x > 39 ? BD[2] : BD[4], 'wood');
    }
    const crate = (x, C) => { for (let yy = 0; yy < 5; yy += 1) for (let xx = 0; xx < 11; xx += 1) b.set(x + xx, 17 + yy, yy === 4 || xx === 0 || xx === 10 ? BD[3] : (xx + yy) % 2 ? '#e8f4fa' : '#ffffff', 'wood'); C.forEach(([fx, fy, c1, c2]) => { b.set(x + fx, 17 + fy, c1, 'wood'); b.set(x + fx + 1, 17 + fy, c2, 'wood'); b.set(x + fx + 2, 17 + fy, c1, 'wood'); b.set(x + fx + 3, 17 + fy, '#3a4a5a', 'wood'); }); };
    crate(3, [[1, 1, '#9aa8b8', '#d8e2ea'], [5, 2, '#9aa8b8', '#d8e2ea'], [2, 3, '#8a98a8', '#c8d4dc']]);
    crate(16, [[1, 1, '#e87a6a', '#ffb09a'], [5, 1, '#e87a6a', '#ffb09a'], [3, 3, '#d86a5a', '#f8a08a']]);
    crate(29, [[2, 1, '#c84a3a', '#f08a6a'], [5, 3, '#c84a3a', '#f08a6a']]);
    // the awning: stripes, a scalloped hem
    for (let y = 0; y < 11; y += 1) {
      const inset = y < 2 ? 2 - y : 0;
      for (let x = -1 + inset; x < 45 - inset; x += 1) {
        const stripe = Math.floor((x + 1) / 5) % 2;
        if (y === 10 && ((x + 1) % 5 === 0 || (x + 1) % 5 === 4)) continue;
        let c = stripe ? (y < 3 ? A[2] : y > 8 ? A[0] : A[1]) : (y < 3 ? Wt[2] : y > 8 ? Wt[0] : Wt[1]);
        if (se.deep && y < 4 + Math.round(Math.sin(x / 4) * 1.2)) c = y < 2 ? '#ffffff' : SNOWG[4];
        b.set(x, y, c, 'awn');
      }
    }
  }, { outline: (t, side) => (t === 'awn' ? (side === 'bottom' ? '#0e4a56' : side === 'right' ? '#12707a' : '#8a98a8') : side === 'bottom' ? INK : side === 'right' ? BD[0] : BD[1]) });
}

// ---------- boats ----------

/**
 * A fishing boat tied up, about 46 x 36: a painted hull with a white rail, a wheelhouse with
 * dark windows, a mast and boom with a net and floats, its reflection under it. o: { hull, dir }.
 */
export function trawlerF(px, X, Y, o, se) {
  const HL = ramp(o.hull || '#2a4a8a', 3, 2);
  const dir = o.dir || 1; const w = 46;
  const fx = (x) => (dir > 0 ? x : w - 1 - x);
  // reflection and ripples
  for (let y = 0; y < 7; y += 1) for (let x = 3; x < w - 3; x += 1) {
    const r = h2(Math.floor((x + y * 3) / 4), y, o.seed || 3);
    if (r < 0.3 + y * 0.08) continue;
    px(X + x, Y + 36 + y, y < 2 ? mix(HL[1], WA[1], 0.3) : `rgba(16,34,66,${0.42 - y * 0.05})`);
  }
  for (let x = 1; x < w - 1; x += 1) if (h2(x, 2, o.seed || 3) > 0.45) px(X + x, Y + 36, se.deep ? '#eef8fd' : WA[7]);
  propB(px, X, Y, w, 36, (b) => {
    const set = (x, y, c, t) => b.set(fx(x), y, c, t);
    // the hull: bow (right) rides higher
    for (let x = 0; x < w; x += 1) {
      const u = x / (w - 1);
      const deck = Math.round(24 - (u > 0.6 ? ((u - 0.6) / 0.4) ** 2 * 5 : 0) - (u < 0.15 ? (0.15 - u) * 8 : 0));
      const keel = Math.round(35 - (u > 0.86 ? ((u - 0.86) / 0.14) * 9 : 0) - (u < 0.08 ? ((0.08 - u) / 0.08) * 4 : 0));
      for (let y = deck; y <= keel; y += 1) {
        let c = y === deck ? '#fbf7ee' : y === deck + 1 ? '#c9c0c8' : y < deck + 5 ? HL[4] : y < keel - 2 ? HL[3] : y < keel ? HL[2] : '#8e2c38';
        if (y > deck + 1 && u < 0.2) c = y < keel - 1 ? HL[2] : c;
        if (y > deck + 1 && h2(x, y, o.seed || 3) < 0.04) c = HL[2];
        set(x, y, c, 'hull');
      }
    }
    // the wheelhouse
    const hx = 22; const hy = 12;
    for (let y = hy; y < 24; y += 1) for (let x = hx; x < hx + 14; x += 1) {
      let c = x > hx + 11 ? '#c9c0c8' : '#f6f2ea';
      if (y === hy) c = HL[4]; else if (y === hy + 1) c = HL[2];
      set(x, y, c, 'house');
    }
    for (let x = hx - 1; x < hx + 16; x += 1) { set(x, hy - 1, se.deep ? '#ffffff' : HL[5], 'house'); if (se.deep) set(x, hy - 2, '#ffffff', 'snow'); }
    for (const wx of [hx + 2, hx + 6, hx + 10]) for (let y = hy + 3; y < hy + 7; y += 1) for (let x = wx; x < wx + 3; x += 1) set(x, y, y === hy + 3 && x === wx ? '#a8dcea' : '#2a4a6a', 'glass');
    for (let y = hy + 8; y < 24; y += 1) { set(hx + 1, y, '#8a8098', 'house'); } // a door line
    // the mast, the boom and the stays
    for (let y = 0; y < 24; y += 1) { set(17, y, BD[5], 'mast'); set(18, y, BD[2], 'mast'); }
    for (let k = 0; k < 15; k += 1) set(17 - k, 6 + Math.round(k * 0.55), BD[4], 'mast');
    for (let k = 0; k < 18; k += 1) set(19 + k, 1 + Math.round(k * 0.62), '#5a566a', 'line');
    for (let k = 0; k < 12; k += 1) set(16 - k, 1 + Math.round(k * 1.9), '#5a566a', 'line');
    set(17, -1, '#e03131', 'mast'); set(18, -1, '#ff8787', 'mast'); set(19, -1, '#e03131', 'mast'); set(19, 0, '#e03131', 'mast');
    // the net on the boom with its floats, and a stack of gear on the stern
    for (let k = 2; k < 13; k += 1) { const yy = 7 + Math.round(k * 0.55); for (let d = 1; d < 4 + (k % 3); d += 1) set(17 - k, yy + d, (k + d) % 2 ? '#8a9a7a' : '#5a6a5a', 'net'); if (k % 3 === 0) set(17 - k, yy + 1, '#f08c3a', 'net'); }
    grid((x, y, c) => set(x, y, c, 'gear'), 3, 19, ['.oOo..', 'oOOOo.', 'oOOOow', '.ooowW'], { o: '#d86a1a', O: '#ffa848', w: '#f6f2ea', W: '#c9c0c8' });
    grid((x, y, c) => set(x, y, c, 'gear'), 37, 19, ['.yy.', 'yYYy', 'yyyy'], { y: '#e0aa28', Y: '#fff09a' });
    if (se.deep) for (let x = 2; x < 44; x += 1) if (x < 20 || x > 37) { const u = x / (w - 1); const deck = Math.round(24 - (u > 0.6 ? ((u - 0.6) / 0.4) ** 2 * 5 : 0) - (u < 0.15 ? (0.15 - u) * 8 : 0)); if (h2(x, 4, 9) > 0.25) set(x, deck - 1, '#ffffff', 'snow'); }
  }, { outline: (t, side) => (t === 'line' || t === 'net' ? null : t === 'hull' ? (side === 'bottom' ? '#1a2a4a' : HL[0]) : t === 'snow' ? SN[1] : side === 'bottom' || side === 'right' ? '#5a566a' : '#8a8098'), pad: 3 });
}

/** A skiff with an outboard, 24 x 9. */
export function skiffF(px, X, Y, c0, se) {
  const C = ramp(c0 || '#d8584c', 2, 2);
  for (let x = 2; x < 22; x += 1) px(X + x, Y + 9, x % 3 ? 'rgba(16,34,66,0.35)' : WA[7]);
  propB(px, X, Y, 24, 9, (b) => {
    for (let y = 1; y < 9; y += 1) for (let x = 0; x < 24; x += 1) {
      const u = x / 23; const top = 2 - (u > 0.75 ? Math.round((u - 0.75) * 8) : 0); const bot = 8 - (u > 0.8 ? Math.round((u - 0.8) * 20) : 0) - (u < 0.06 ? 1 : 0);
      if (y < top || y > bot) continue;
      let c = y === top ? '#fbf7ee' : y < top + 3 && u > 0.1 && u < 0.8 ? (y === top + 1 ? '#4a3a4a' : BD[3]) : y > bot - 1 ? C[0] : C[2];
      if (se.deep && y === top + 1 && u > 0.1 && u < 0.8) c = '#ffffff';
      b.set(x, y, c, 'hull');
    }
    grid((x, y, c) => b.set(x, y, c, 'hull'), 0, 0, ['kk', 'kK', 'k.'], { k: '#4a465a', K: '#8a8690' });
    for (let x = 9; x < 13; x += 1) b.set(x, 3, BD[5], 'hull');
  }, { outline: (t, side) => (side === 'bottom' ? '#1a2a4a' : C[0]) });
}

// ---------- the harbor's and the village's little things ----------

/** Crab pots stacked two high with their buoys, 24 x 20. */
export function crabpotsF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 13, Y + 19, 12, 2, 0.2);
  propB(px, X, Y, 24, 20, (b) => {
    const pot = (x, y) => { for (let yy = 0; yy < 8; yy += 1) for (let xx = 0; xx < 11; xx += 1) { const frame = yy === 0 || yy === 7 || xx === 0 || xx === 10; b.set(x + xx, y + yy, frame ? (yy === 0 || xx === 0 ? '#8a8690' : '#4a465a') : (xx + yy) % 2 ? '#5a6a6a' : '#2e3a44', 'pot'); } b.set(x + 5, y + 3, '#1a1a2a', 'pot'); b.set(x + 5, y + 4, '#1a1a2a', 'pot'); };
    pot(1, 12); pot(12, 12); pot(6, 4);
    grid((x, y, c) => b.set(x, y, c, 'pot'), 18, 5, ['.r.', 'oOo', 'oOd', 'wwW', 'oOd', '.d.'], { r: FJ.rope[2], o: '#f08c3a', O: '#ffc47a', d: '#b04a1a', w: '#ffffff', W: '#c9c0c8' });
    grid((x, y, c) => b.set(x, y, c, 'pot'), 1, 6, ['yYy', 'yYd', 'ddd'], { y: '#f6d04a', Y: '#fff09a', d: '#b8801e' });
    if (se.deep) { for (let x = 6; x < 17; x += 1) b.set(x, 3, '#ffffff', 'snow'); for (const x of [1, 2, 3, 4, 18, 19, 20, 21, 22]) b.set(x, 11, '#ffffff', 'snow'); }
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : '#34304a') });
}

/** A rack of salmon drying, 30 x 24: split fish hung in rows on poles, under a little shake roof. */
export function fishrackF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 16, Y + 23, 15, 2, 0.2);
  propB(px, X, Y, 30, 24, (b) => {
    for (const x of [2, 26]) for (let y = 4; y < 24; y += 1) { b.set(x, y, BD[4], 'wood'); b.set(x + 1, y, BD[2], 'wood'); }
    for (let x = -1; x < 31; x += 1) { const y = 3 - Math.round(Math.abs(x - 15) * 0.2) + 3; b.set(x, y - 3, se.deep ? '#ffffff' : BD[5], se.deep ? 'snow' : 'wood'); b.set(x, y - 2, se.deep ? SNOWG[4] : BD[3], se.deep ? 'snow' : 'wood'); b.set(x, y - 1, BD[1], 'wood'); }
    for (const y of [8, 15]) {
      for (let x = 2; x < 28; x += 1) b.set(x, y, BD[5], 'wood');
      for (let x = 5; x < 25; x += 4) grid((xx, yy, c) => b.set(xx, yy, c, 'fish'), x, y + 1, ['rR', 'rR', 'rR', 'rd', 'd.'], { r: '#e0584a', R: '#ff9a7a', d: '#a8323e' });
    }
  }, { outline: (t, side) => (t === 'fish' ? (side === 'bottom' || side === 'right' ? '#76222e' : null) : t === 'snow' ? SN[1] : side === 'bottom' ? INK : BD[0]) });
}

/** A net hung out to dry between two posts, with its floats, 36 x 22. */
export function netrackF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 4, Y + 21, 4, 1.3, 0.2); groundShadow(px, X + 33, Y + 21, 4, 1.3, 0.2);
  propB(px, X, Y, 36, 22, (b) => {
    for (const x of [1, 32]) for (let y = 0; y < 22; y += 1) { b.set(x, y, BD[5], 'wood'); b.set(x + 1, y, BD[3], 'wood'); b.set(x + 2, y, BD[1], 'wood'); }
    for (let x = 4; x < 32; x += 1) {
      const sag = Math.round(Math.sin(((x - 4) / 28) * Math.PI) * 3);
      b.set(x, 2 + sag, FJ.rope[2], 'net');
      const len = 9 + Math.round(Math.sin(x / 3) * 2);
      for (let k = 1; k < len; k += 1) if ((x + k) % 3 === 0 || (x - k + 60) % 3 === 0) b.set(x, 2 + sag + k, (x + k) % 3 === 0 ? '#6a8a7a' : '#4a6a62', 'net');
      if (x % 6 === 1) { b.set(x, 2 + sag, '#f08c3a', 'net'); b.set(x, 3 + sag, '#ffc47a', 'net'); }
      if (se.deep && x % 2) b.set(x, 1 + sag, '#ffffff', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : side === 'bottom' ? INK : BD[0]) });
}

/** Two kayaks on a rack, 36 x 18. */
export function kayaksF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 19, Y + 17, 17, 2, 0.2);
  propB(px, X, Y, 36, 18, (b) => {
    for (const x of [5, 28]) for (let y = 2; y < 18; y += 1) { b.set(x, y, BD[4], 'wood'); b.set(x + 1, y, BD[2], 'wood'); }
    const kayak = (y, C) => { for (let x = 0; x < 36; x += 1) { const u = Math.abs(x - 17.5) / 17.5; const hh = u > 0.9 ? 0 : u > 0.6 ? 1 : 2; for (let k = -hh; k <= hh; k += 1) b.set(x, y + k, k === -hh ? C[2] : k === hh ? C[0] : C[1], 'hull'); } for (let x = 14; x < 21; x += 1) b.set(x, y - 1, '#2e2238', 'hull'); if (se.deep) for (let x = 3; x < 33; x += 1) if (x < 14 || x > 20) b.set(x, y - 2 + (Math.abs(x - 17.5) > 10 ? 1 : 0), '#ffffff', 'snow'); };
    kayak(5, ['#b8801e', '#f6d04a', '#fff09a']); kayak(12, ['#8e2c38', '#d8584c', '#f8b09a']);
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : side === 'right' ? '#34304a' : '#5a566a') });
}

/** A woodpile with a chopping block and an axe, 30 x 18. */
export function woodpileF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 16, Y + 17, 15, 2, 0.2);
  propB(px, X, Y, 30, 18, (b) => {
    for (let r = 0; r < 4; r += 1) for (let q = 0; q < 6 - (r > 2 ? 1 : 0); q += 1) {
      const x = 1 + q * 3 + (r % 2) + (r > 2 ? 1 : 0); const y = 14 - r * 3;
      grid((xx, yy, c) => b.set(xx, yy, c, 'wood'), x, y, ['lmd', 'mMd', 'ddd'], { l: '#f0d8a0', m: '#d8b070', M: h2(q, r, 3) > 0.5 ? '#b08048' : '#c89a5a', d: BD[1] });
    }
    if (se.deep) for (let x = 2; x < 19; x += 1) { b.set(x, 4, '#ffffff', 'snow'); b.set(x, 3, x > 3 && x < 17 ? '#ffffff' : null, 'snow'); }
    // the block and the axe
    for (let y = 11; y < 18; y += 1) for (let x = 21; x < 29; x += 1) b.set(x, y, y === 11 ? '#f0d8a0' : x > 26 ? BD[2] : y === 12 ? '#d8b070' : BD[3], 'wood');
    grid((x, y, c) => b.set(x, y, c, 'metal'), 22, 3, ['....hh', '...hh.', 'ss.h..', 'sSSh..', 'sSh...', '.h....', '.h....', 'h.....'].map((r) => r.split('').reverse().join('')), { h: '#b08048', s: '#8a8690', S: '#d4d2d8' });
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : BD[0]) });
}

/** A husky asleep in front of its doghouse, 34 x 24 (the doghouse has a metal roof like the cabins). */
export function huskyF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 18, Y + 23, 16, 2, 0.2);
  propB(px, X, Y, 34, 24, (b) => {
    const RF = ramp('#1c9c8c', 3, 2);
    for (let y = 9; y < 23; y += 1) for (let x = 2; x < 19; x += 1) b.set(x, y, (y - 9) % 4 === 3 ? BD[2] : x > 15 ? BD[3] : BD[4], 'wood');
    for (let y = 13; y < 23; y += 1) for (let x = 7; x < 14; x += 1) if (y > 14 || (x > 7 && x < 13)) b.set(x, y, '#241a2e', 'wood');
    for (let y = 0; y < 10; y += 1) { const half = 1 + y * 1.1; for (let x = Math.round(10.5 - half); x <= Math.round(10.5 + half); x += 1) b.set(x, y, se.deep && y < 7 ? (x < 10 ? '#ffffff' : SNOWG[3]) : y === 9 ? RF[1] : x < 10 ? RF[4] : RF[2], se.deep && y < 7 ? 'snow' : 'roof'); }
    // the dog, curled up: grey back, white face and paws, pointed ears
    grid((x, y, c) => b.set(x, y, c, 'fur'), 15, 14, [
      '..........g.g....',
      '.........gGgGg...',
      '...ggggggGwGwGg..',
      '..gGGGGGGwwkwwg..',
      '.gGGGGGGGGwwnww..',
      'gGGGGGGGGGGwwww..',
      'gGGwwGGGGGwwww...',
      '.gwwwwwwwwwww....',
      '..www.....ww.....',
    ], { g: '#6a6676', G: '#9a98a8', w: '#f6f2ea', k: '#2e2238', n: '#2e2238' });
    grid((x, y, c) => b.set(x, y, c, 'z'), 31, 6, ['zzz', '.z.', 'zzz'], { z: '#f6f2ea' });
  }, { outline: (t, side) => (t === 'z' ? null : t === 'snow' ? SN[1] : t === 'fur' ? (side === 'bottom' ? INK : '#4a465a') : side === 'bottom' ? INK : BD[0]) });
}

/** A fire ring with a little fire and two log seats, 30 x 20. */
export function firepitF(px, X, Y, se = fjordSeason()) {
  propB(px, X, Y, 30, 20, (b) => {
    // log seats either side
    for (const x of [0, 23]) for (let y = 9; y < 14; y += 1) for (let xx = 0; xx < 7; xx += 1) b.set(x + xx, y, y === 9 ? (se.deep ? '#ffffff' : '#d8b070') : y === 13 ? BD[1] : BD[3], se.deep && y === 9 ? 'snow' : 'wood');
    // the ring of stones
    for (let a = 0; a < 12; a += 1) { const t = (a / 12) * Math.PI * 2; const x = Math.round(14.5 + Math.cos(t) * 5.5); const y = Math.round(13 + Math.sin(t) * 3.4); b.set(x, y, Math.sin(t) < 0 ? RK[5] : RK[3], 'stone'); b.set(x, y + 1, RK[2], 'stone'); }
    // logs and flames
    grid((x, y, c) => b.set(x, y, c, 'fire'), 11, 3, ['...y...', '..yY...', '..yYy..', '.oYWYo.', '.oYWYo.', 'ooYYYoo', '.oOYOo.', 'lmOOOmd', '.lmmmd.'], { y: '#ffe066', Y: '#fff4c8', W: '#ffffff', o: '#f08c3a', O: '#e8590c', l: BD[4], m: BD[2], d: BD[0] });
  }, { outline: (t, side) => (t === 'fire' ? null : t === 'snow' ? SN[1] : side === 'bottom' ? INK : side === 'right' ? RK[0] : RK[1]) });
  for (const [dx, dy] of [[9, 1], [20, 4], [16, -2]]) px(X + dx, Y + dy, '#ffd28a');
}

/** A post hung with old buoys of every color, 16 x 34. */
export function buoypostF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 9, Y + 33, 6, 1.6, 0.2);
  propB(px, X, Y, 16, 34, (b) => {
    for (let y = 2; y < 34; y += 1) { b.set(7, y, BD[5], 'wood'); b.set(8, y, BD[3], 'wood'); b.set(9, y, BD[1], 'wood'); }
    for (let x = 2; x < 14; x += 1) { b.set(x, 5, BD[5], 'wood'); b.set(x, 6, BD[2], 'wood'); }
    const buoy = (x, y, C, tall) => grid((xx, yy, c) => b.set(xx, yy, c, 'buoy'), x, y, tall ? ['.r.', 'lLd', 'LLd', 'wwW', 'LLd', 'LLd', '.d.'] : ['.r.', 'lLd', 'wwW', 'LLd', '.d.'], { r: FJ.rope[2], l: C[2], L: C[1], d: C[0], w: '#ffffff', W: '#c9c0c8' });
    buoy(1, 7, ['#b04a1a', '#f08c3a', '#ffc47a'], true); buoy(11, 7, ['#8e2c38', '#d8584c', '#f8b09a']); buoy(3, 15, ['#12707a', '#1c9c8c', '#96f2d7']);
    buoy(11, 13, ['#b8801e', '#f6d04a', '#fff09a'], true); buoy(2, 22, ['#3a3a8a', '#5a7ae0', '#b4c8f6']); buoy(11, 21, ['#b04a1a', '#f08c3a', '#ffc47a']);
    if (se.deep) { for (let x = 2; x < 14; x += 1) b.set(x, 4, '#ffffff', 'snow'); b.set(7, 1, '#ffffff', 'snow'); b.set(8, 1, '#ffffff', 'snow'); b.set(9, 1, '#ffffff', 'snow'); }
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : t === 'buoy' ? (side === 'bottom' || side === 'right' ? '#5c1f30' : null) : side === 'bottom' ? INK : BD[0]) });
}

/** A lamp on a post, lit, 10 x 30. */
export function lampF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 6, Y + 29, 4, 1.3, 0.2);
  propB(px, X, Y, 10, 30, (b) => {
    for (let y = 9; y < 30; y += 1) { b.set(4, y, '#5a566a', 'metal'); b.set(5, y, '#34304a', 'metal'); }
    grid((x, y, c) => b.set(x, y, c, 'metal'), 1, 0, ['..kkkk..', '.kkkkkk.', '.kyYYyk.', '.kyWYyk.', '.kyYYyk.', '.kyyyyk.', '..kkkk..', '...kk...'], { k: '#34304a', y: PB.glow[2], Y: PB.glow[3], W: PB.glow[4] });
    if (se.deep) { for (let x = 2; x < 8; x += 1) b.set(x, -1, '#ffffff', 'snow'); }
    b.set(3, 29, '#5a566a', 'metal'); b.set(6, 29, '#34304a', 'metal');
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : '#241a2e') });
}

/** A weathered bench, 24 x 12. */
export function benchF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 13, Y + 11, 12, 1.6, 0.2);
  propB(px, X, Y, 24, 12, (b) => {
    for (let x = 0; x < 24; x += 1) { for (const y of [0, 1, 3, 4]) b.set(x, y, y % 3 === 0 ? BD[5] : BD[3], 'wood'); b.set(x, 7, se.deep ? '#ffffff' : BD[6], se.deep ? 'snow' : 'wood'); b.set(x, 8, BD[4], 'wood'); b.set(x, 9, BD[1], 'wood'); }
    for (const x of [2, 20]) for (let y = 0; y < 12; y += 1) { b.set(x, y, BD[4], 'wood'); b.set(x + 1, y, BD[1], 'wood'); }
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : BD[0]) });
}

/** A driftwood log on the beach, 26 x 8. */
export function driftlogF(px, X, Y, se = fjordSeason()) {
  px(X + 2, Y + 7, 'rgba(30,34,56,0.25)', 23, 1);
  propB(px, X, Y, 26, 8, (b) => {
    for (let x = 0; x < 26; x += 1) { const yy = 3 + Math.round(Math.sin(x / 8) * 0.8); for (let k = 0; k < 4; k += 1) b.set(x, yy + k, k === 0 ? (se.deep ? '#ffffff' : '#e8dcc8') : k === 3 ? '#8a7a72' : (x + k) % 5 === 0 ? '#a8988a' : '#c8b8a4', se.deep && k === 0 ? 'snow' : 'wood'); }
    for (let k = 0; k < 4; k += 1) b.set(8 + k, 2 - k, '#c8b8a4', 'wood');
    b.set(25, 4, '#8a7a72', 'wood'); b.set(25, 5, '#6a5a5a', 'wood');
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' || side === 'right' ? '#5a4a52' : '#8a7a72') });
}

/** Fish crates stacked on the wharf, 16 x 16. */
export function cratesF(px, X, Y, se = fjordSeason()) {
  px(X + 2, Y + 16, 'rgba(20,24,44,0.3)', 15, 1);
  propB(px, X, Y, 16, 16, (b) => {
    const crate = (x, y, w, h, C) => { for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) b.set(x + xx, y + yy, yy === 0 ? C[2] : xx === w - 1 || yy === h - 1 ? C[0] : yy % 3 === 0 ? C[0] : C[1], 'wood'); };
    crate(0, 8, 9, 8, ['#8a6a4a', '#c8a070', '#ecd0a0']); crate(8, 9, 8, 7, ['#2a6a8a', '#4a9ac0', '#a8dcea']); crate(3, 1, 9, 7, ['#8a6a4a', '#b89060', '#e0c090']);
    grid((x, y, c) => b.set(x, y, c, 'wood'), 5, 0, ['sSs.', '.sSs'], { s: '#c8d4dc', S: '#f0f6f8' });
    if (se.deep) for (let x = 3; x < 12; x += 1) b.set(x, 0, '#ffffff', 'snow');
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : BD[0]) });
}

/** Two barrels, 12 x 14. */
export function barrelsF(px, X, Y, se = fjordSeason()) {
  px(X + 2, Y + 14, 'rgba(20,24,44,0.3)', 11, 1);
  propB(px, X, Y, 12, 14, (b) => {
    const barrel = (x, y) => grid((xx, yy, c) => b.set(xx, yy, c, 'wood'), x, y, [se.deep ? '.wwww.' : '.llll.', 'lmmmmd', 'kkkkkk', 'lmmmmd', 'lmmmmd', 'kkkkkk', 'lmmmmd', '.dddd.'], { l: '#d8a868', m: '#b07a44', d: '#7a4e30', k: '#5a566a', w: '#ffffff' });
    barrel(0, 3); barrel(6, 6);
  }, { outline: (t, side) => (side === 'bottom' ? INK : '#4a2e2a') });
}

/** A coil of rope lying on the boards, 10 x 6. */
export function ropecoilF(px, X, Y) {
  grid(px, X, Y, ['..rrRRr...', '.rR....Rr.', 'rR..rr..Rd', 'rR..dd..Rd', '.dR....Rd.', '..ddRRdd..'], { r: FJ.rope[3], R: FJ.rope[2], d: FJ.rope[0] });
}

/** A snowman with a red scarf and a bucket hat: he stands here all winter, and only in winter. 14 x 22. */
export function snowmanF(px, X, Y, se = fjordSeason()) {
  if (!se.deep) { boulderF(px, X + 7, Y + 18, 4.5, se, X + Y); return; }
  groundShadow(px, X + 8, Y + 21, 7, 1.8, 0.14);
  propB(px, X, Y, 14, 22, (b) => {
    const ball = (cx, cy, r) => { for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r); x <= cx + r; x += 1) if (inEll(x, y, cx + 0.5, cy + 0.5, r + 0.2, r + 0.2)) { const l = -((x + 0.5 - cx) + (y + 0.5 - cy)) / r; b.set(x, y, l > 0.5 ? '#ffffff' : l > -0.5 ? SNOWG[4] : SNOWG[2], 'snow'); } };
    ball(6.5, 16, 5.2); ball(6.5, 9, 3.8); ball(6.5, 4.5, 2.8);
    grid((x, y, c) => b.set(x, y, c, 'hat'), 4, -1, ['.kkkk.', '.kKKk.', 'kkkkkk'], { k: '#34304a', K: '#6a6676' });
    b.set(5, 4, '#2e2238', 'snow'); b.set(8, 4, '#2e2238', 'snow'); b.set(7, 5, '#f08c3a', 'snow'); b.set(8, 5, '#f08c3a', 'snow');
    for (let x = 3; x < 11; x += 1) b.set(x, 7, x % 3 ? '#e03131' : '#ff8787', 'hat'); b.set(10, 8, '#e03131', 'hat'); b.set(10, 9, '#c92a2a', 'hat');
    b.set(6, 10, '#2e2238', 'snow'); b.set(6, 13, '#2e2238', 'snow');
    for (let k = 0; k < 4; k += 1) { b.set(1 - k, 9 - k, BD[2], 'hat'); b.set(12 + k, 9 - k, BD[2], 'hat'); }
  }, { outline: (t, side) => (t === 'hat' ? '#241a2e' : side === 'bottom' ? '#7f8fc4' : SN[1]) });
}

/** A rowboat pulled up on the beach, upside down, 30 x 12. */
export function beachboatF(px, X, Y, se = fjordSeason()) {
  groundShadow(px, X + 16, Y + 11, 15, 2, 0.22);
  const C = ramp('#3a7ab8', 3, 2);
  propB(px, X, Y, 30, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 30; x += 1) {
      const u = (x - 14.5) / 14.5; const top = Math.round(u * u * 6); if (y < top || y > 10 - (Math.abs(u) > 0.85 ? 2 : 0)) continue;
      let c = y - top < 2 ? C[5] : (y - top) % 3 === 0 ? C[2] : x > 20 ? C[2] : C[3];
      if (y > 8) c = '#fbf7ee';
      if (se.deep && y - top < 3) c = y - top < 1 ? '#ffffff' : SNOWG[4];
      b.set(x, y, c, se.deep && y - top < 3 ? 'snow' : 'hull');
    }
  }, { outline: (t, side) => (t === 'snow' ? SN[1] : side === 'bottom' ? INK : C[0]) });
}

// ---------- the green ----------

/** The fishing pond: a little tarn with a stony rim; in winter it is frozen, with a hole cut in the ice. */
function tarnF(px, Z, se, seed) {
  const mid = Z.y + Z.h / 2; const C = FJ.creek;
  for (let y = Z.y - 6; y < Z.y + Z.h + 6; y += 1) for (let x = Z.x - 6; x < Z.x + Z.w + 6; x += 1) {
    const k = oval(Z, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
    if (k < 0) {
      if (oval(grow(Z, 1.5), x, y) >= 0) px(x, y, se.deep ? (north ? SNOWG[1] : '#ffffff') : north ? SH[1] : SH[3]);
      else if (oval(grow(Z, 5), x, y) >= 0 && b < oval(grow(Z, 5), x, y) * 2.4) px(x, y, se.deep ? SNOWG[3] : SH[4]);
      continue;
    }
    let c;
    if (se.deep) {
      c = k > 0.5 ? FJ.ice[2] : FJ.ice[3];
      if (north && oval(grow(Z, -3), x, y) < 0) c = FJ.ice[0];
      if (h2(Math.floor((x + y) / 7), Math.floor((x - y) / 9), seed) > 0.86 && (x + y) % 2) c = '#ffffff';
    } else {
      c = C[2];
      if (north && oval(grow(Z, -3), x, y) < 0) c = oval(grow(Z, -1.5), x, y) < 0 ? C[0] : C[1];
      else if (!north && oval(grow(Z, -2.5), x, y) < 0) c = b < 0.5 ? C[5] : C[4];
      else if (k > 0.55 || (k > 0.42 && b < (k - 0.42) * 7)) c = C[1];
      else if (!north && oval(grow(Z, -6), x, y) < 0) c = C[3];
    }
    px(x, y, c);
  }
  const rnd = rng(seed);
  if (se.deep) {
    // the fishing hole
    const hx = Math.round(Z.x + Z.w / 2); const hy = Math.round(mid);
    for (let y = hy - 3; y <= hy + 3; y += 1) for (let x = hx - 6; x <= hx + 6; x += 1) if (inEll(x, y, hx + 0.5, hy + 0.5, 6, 3)) px(x, y, inEll(x, y, hx + 0.5, hy + 1, 5, 2.2) ? '#17506e' : y < hy ? FJ.ice[0] : '#ffffff');
  } else {
    for (let i = 0; i < 9; i += 1) { const x = Z.x + 12 + Math.floor(rnd() * (Z.w - 30)); const y = Z.y + 8 + Math.floor(rnd() * (Z.h - 16)); if (oval(grow(Z, -6), x, y) > 0) { px(x, y, '#ffffff'); px(x + 1, y, C[5], 2, 1); } }
  }
  [[0.05, 0.6], [0.14, 0.88], [0.48, 1.04], [0.88, 0.2], [0.96, 0.62], [0.74, 1], [0.3, -0.04], [0.62, -0.02]].forEach(([fx, fy], i) => boulderF(px, Math.round(Z.x + fx * Z.w), Math.round(Z.y + fy * Z.h), 3 + (i % 3) * 0.7, se, seed + i));
}

/** The hockey rink: ice with painted lines inside low boards, snow shovelled up round it. */
function rinkF(px, Z, se, seed) {
  const R = { x: Z.x - 3, y: Z.y - 2, w: Z.w + 6, h: Z.h + 5 };
  groundShadow(px, R.x + R.w / 2 + 2, R.y + R.h + 1, R.w / 2, 3, 0.2);
  for (let y = R.y - 3; y < R.y + R.h + 3; y += 1) for (let x = R.x - 3; x < R.x + R.w + 3; x += 1) {
    if (!inRound(x, y, R.x, R.y, R.w, R.h, 10)) { if (inRound(x, y, R.x - 3, R.y - 3, R.w + 6, R.h + 6, 12) && bayer(x, y) < 0.75) px(x, y, y < R.y + R.h / 2 ? SNOWG[5] : SNOWG[3]); continue; }
    const edge = !inRound(x, y, R.x + 2, R.y + 2, R.w - 4, R.h - 4, 8);
    if (edge) { const south = y > R.y + R.h / 2; px(x, y, south ? (y === R.y + R.h - 1 ? BD[1] : BD[4]) : (se.deep ? '#ffffff' : BD[6])); continue; }
    if (!inRound(x, y, R.x + 3, R.y + 3, R.w - 6, R.h - 6, 7)) { px(x, y, y < R.y + R.h / 2 ? '#8fb8d8' : '#e04050'); continue; }
    let c = FJ.ice[3];
    const sk = vnoise(x, y, 12, seed);
    if (sk < 0.34) c = FJ.ice[2];
    if (h2(Math.floor((x + y * 2) / 9), Math.floor((x * 2 - y) / 11), seed + 1) > 0.9 && (x + y) % 2) c = '#ffffff'; // skate marks
    if (Math.abs((x - R.x) - (y - R.y) * 1.6 - R.w * 0.3) < 3 && bayer(x, y) < 0.5) c = '#ffffff';
    px(x, y, c);
  }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = R.y + 4; y < R.y + R.h - 3; y += 1) { px(mx - 1, y, '#e8384a'); px(mx, y, '#ff5a6a'); }
  for (const lx of [Math.round(Z.x + Z.w * 0.3), Math.round(Z.x + Z.w * 0.7)]) for (let y = R.y + 4; y < R.y + R.h - 3; y += 1) px(lx, y, '#4a8ae8');
  for (let a = 0; a < 44; a += 1) { const t = (a / 44) * Math.PI * 2; px(Math.round(mx + Math.cos(t) * 8), Math.round(mid + Math.sin(t) * 6), '#4a8ae8'); }
  const goal = (x, dir) => propB(px, x, mid - 6, 6, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let i = 0; i < 6; i += 1) {
      const xx = dir > 0 ? i : 5 - i;
      if (i >= 4) b.set(xx, y, i === 4 ? '#ff8a8a' : '#d8384a', 'white');
      else if (y === 0 || y === 11) b.set(xx, y, y === 0 ? '#ff8a8a' : '#d8384a', 'white');
      else if (i === 0) b.set(xx, y, '#d8384a', 'white');
      else if ((i + y) % 2 === 0) b.set(xx, y, 'rgba(255,255,255,0.75)', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : side === 'bottom' ? INK : '#a82040') });
  goal(Z.x + 2, 1); goal(Z.x + Z.w - 8, -1);
}

/** A pitch for soccer or football: worn turf with lines, goals of driftwood and old net (or tall posts); packed snow in winter. */
function pitchF(px, Z, kind, se, seed) {
  const P = { x: Z.x - 4, y: Z.y - 3, w: Z.w + 8, h: Z.h + 6 };
  const T = se.deep ? [SNOWG[1], SNOWG[2], SNOWG[3]] : se.name === 'autumn' ? ['#8a8e4a', '#a8a658', '#c2be6c'] : ['#5e9a52', '#74ae5a', '#8cc066'];
  for (let y = P.y - 2; y < P.y + P.h + 2; y += 1) for (let x = P.x - 2; x < P.x + P.w + 2; x += 1) {
    const inside = inRound(x, y, P.x, P.y, P.w, P.h, 12);
    if (!inside) { if (inRound(x, y, P.x - 2, P.y - 2, P.w + 4, P.h + 4, 14) && bayer(x, y) < 0.5) px(x, y, T[1]); continue; }
    const stripe = Math.floor((x - P.x) / 12) % 2;
    let c = stripe ? T[1] : T[2];
    if (h2(x, y, seed) < 0.08) c = T[0];
    // worn in front of the goals and in the middle
    const worn = Math.min(Math.hypot((x - P.x - 8) / 1.2, y - P.y - P.h / 2), Math.hypot((x - P.x - P.w + 8) / 1.2, y - P.y - P.h / 2), Math.hypot((x - P.x - P.w / 2) / 1.6, y - P.y - P.h / 2) + 3);
    if (!se.deep && worn < 9 && bayer(x, y) < (9 - worn) / 8) c = h2(x, y, seed + 1) > 0.5 ? '#b09a6a' : '#c8b282';
    px(x, y, c);
  }
  const ln = se.deep ? '#8fa0d0' : '#f6f2ea';
  const L0 = { x: Z.x + 2, y: Z.y + 1, w: Z.w - 4, h: Z.h - 3 };
  for (let x = L0.x; x <= L0.x + L0.w; x += 1) { if ((x + seed) % 11 === 4) continue; px(x, L0.y, ln); px(x, L0.y + L0.h, ln); }
  for (let y = L0.y; y <= L0.y + L0.h; y += 1) { px(L0.x, y, ln); px(L0.x + L0.w, y, ln); }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = L0.y + 1; y < L0.y + L0.h; y += 2) px(mx, y, ln);
  for (let a = 0; a < 40; a += 1) { const t = (a / 40) * Math.PI * 2; px(Math.round(mx + Math.cos(t) * 7), Math.round(mid + Math.sin(t) * 5), ln); }
  if (kind === 'football') {
    const Y4 = ['#b07a1a', '#e8a82a', '#ffd84a', '#fff0a0'];
    const post = (x) => propB(px, x - 6, mid - 20, 13, 24, (b) => {
      for (let y = 9; y < 24; y += 1) { b.set(6, y, Y4[2], 'gold'); b.set(7, y, Y4[1], 'gold'); }
      for (let xx = 0; xx < 13; xx += 1) { b.set(xx, 8, Y4[3], 'gold'); b.set(xx, 9, Y4[1], 'gold'); }
      for (const ux of [0, 11]) for (let y = 0; y < 9; y += 1) { b.set(ux, y, Y4[2], 'gold'); b.set(ux + 1, y, Y4[1], 'gold'); }
    }, { outline: (t, side) => (side === 'bottom' ? INK : '#9a6a2a') });
    groundShadow(px, Z.x + 7, mid + 4, 4, 1.2, 0.22); groundShadow(px, Z.x + Z.w - 4, mid + 4, 4, 1.2, 0.22);
    post(Z.x + 5); post(Z.x + Z.w - 6);
    return;
  }
  const goal = (X, dir) => {
    groundShadow(px, X + 5, mid + 8, 6, 1.6, 0.2);
    propB(px, X, mid - 8, 9, 16, (b) => {
      for (let y = 0; y < 16; y += 1) for (let i = 0; i < 9; i += 1) {
        const x = dir > 0 ? i : 8 - i;
        if (i >= 7) b.set(x, y, i === 7 ? '#e8dcc8' : '#a8988a', 'drift');
        else if (y === 0 || y === 15) b.set(x, y, y === 0 ? '#e8dcc8' : '#8a7a72', 'drift');
        else if (i === 0) b.set(x, y, '#a8988a', 'drift');
        else if ((i + y) % 3 === 0 || (i - y + 99) % 3 === 0) b.set(x, y, (i + y) % 3 === 0 ? 'rgba(255,246,226,0.85)' : 'rgba(210,224,214,0.75)', 'net');
      }
      b.set(dir > 0 ? 2 : 6, 3, '#f08c3a', 'net'); b.set(dir > 0 ? 3 : 5, 12, '#f6d04a', 'net');
    }, { outline: (t, side) => (t === 'net' ? null : side === 'bottom' ? INK : '#5a4a52') });
  };
  goal(Z.x - 1, 1); goal(Z.x + Z.w - 8, -1);
}

// ---------- the whole village ----------

/**
 * Paints the fjord village. opts: { homeRoof: the kid's color, areas: the green's ponds and play
 * patches, season, progress }. lib: { waterDepth, PROPS } from villageprops.js.
 */
export function paintFjord(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 4907;
  const { W, H } = L;
  const se = fjordSeason(opts.season, opts.progress);
  const depth = lib.waterDepth;
  const PROPS = lib.PROPS || {};
  const areas = opts.areas || [];
  const peaks = [...(L.peaks || [])].sort((a, b) => a.base - b.base);
  const bay = L.water.filter((wa) => wa.bay); const creeks = L.water.filter((wa) => !wa.bay);

  // how far into the bay each pixel is (its bands joined), worked out once
  const DV = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) { let d = -99; for (const wa of bay) { const v = depth(wa, x, y); if (v > d) d = v; } DV[y * W + x] = d; }
  for (const it of L.islets || []) for (let y = Math.floor(it.y - it.ry - 40); y <= it.y + it.ry + 40; y += 1) for (let x = Math.floor(it.x - it.rx - 40); x <= it.x + it.rx + 40; x += 1) {
    if (x < 0 || y < 0 || x >= W || y >= H) continue;
    const e = (Math.sqrt(((x + 0.5 - it.x) / it.rx) ** 2 + ((y + 0.5 - it.y) / it.ry) ** 2) - 1) * it.ry * 1.6;
    // shallow round the islet, fading back to the bay's own depth a little way out
    const i = y * W + x;
    if (e < DV[i]) DV[i] = e < 8 ? e : e < 26 ? e + (DV[i] - e) * ((e - 8) / 18) : DV[i];
  }
  const D = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? -99 : DV[Math.round(y) * W + Math.round(x)]);
  const inPeak = (x, y, pad = 0) => peaks.some((pk) => { const t = (y - (pk.base - pk.h)) / pk.h; return t > -0.02 && y < pk.base + 3 + pad && Math.abs(x - pk.cx) < pk.hw * prof(t) * 1.25 + 3 + pad; });
  const inArea = (x, y, pad) => areas.some((a) => x > a.x - pad && x < a.x + a.w + pad && y > a.y - pad && y < a.y + a.h + pad);
  const decks = L.crossings.filter((c) => c.kind !== 'wood');
  const onDeck = (x, y, pad = 0) => decks.some((c) => x >= c.x - pad && x < c.x + c.w + pad && y >= c.y - pad && y < c.y + c.h + pad);
  const inCreek = (x, y, pad) => creeks.some((wa) => depth(wa, x, y) > -pad);

  groundF(px, L, se, seed);
  const spots = [...L.slots.morning, ...L.slots.afternoon, L.shop, L.chest, L.start, L.coach].filter(Boolean);
  const free = (x, y, pad = 4) => x > 22 && y > 24 && x < W - 22 && y < H - 20 && D(x, y) < -10 - pad && !inCreek(x, y, 5 + pad) && !inPeak(x, y, pad) &&
    !L.blockedHard(x, y, pad) && !L.onPath(x, y, pad + 6) && !inArea(x, y, pad + 4) && !onDeck(x, y, pad + 2) && !spots.some((s) => Math.hypot(s.x - x, s.y - 4 - y) < 7 + pad);
  plantsF(px, L, se, seed + 1, free);
  pathsF(px, L, se, seed + 30, (x, y) => D(x, y) > -1 || inCreek(x, y, 0));
  L.plazas.forEach(([x, y, r], i) => plazaF(px, x, y, r, se, seed + 40 + i));
  bayF(px, L, D, se, seed + 2);
  creeks.forEach((wa, i) => creekF(px, L, wa, depth, se, seed + 3 + i, D));
  (L.islets || []).forEach((it, i) => isletF(px, it, se, seed + 8 + i));
  areas.forEach((a, i) => {
    if (a.kind === 'pond') tarnF(px, a, se, seed + 70 + i);
    else if (a.kind === 'hockey') rinkF(px, a, se, seed + 70 + i);
    else pitchF(px, a, a.kind, se, seed + 70 + i);
  });

  const wetAt = (x, y) => D(x, y) > 1.5;
  const DRAW = {
    spruce: (p) => spruceF(px, p, se),
    stall: (p) => stallF(px, p.x, p.y, se),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
    trawler: (p) => trawlerF(px, p.x, p.y, p, se),
    skiff: (p) => skiffF(px, p.x, p.y, p.c, se),
    crabpots: (p) => crabpotsF(px, p.x, p.y, se),
    fishrack: (p) => fishrackF(px, p.x, p.y, se),
    netrack: (p) => netrackF(px, p.x, p.y, se),
    kayaks: (p) => kayaksF(px, p.x, p.y, se),
    woodpile: (p) => woodpileF(px, p.x, p.y, se),
    husky: (p) => huskyF(px, p.x, p.y, se),
    firepit: (p) => firepitF(px, p.x, p.y, se),
    buoypost: (p) => buoypostF(px, p.x, p.y, se),
    fjordlamp: (p) => lampF(px, p.x, p.y, se),
    fjordbench: (p) => benchF(px, p.x, p.y, se),
    driftlog: (p) => driftlogF(px, p.x, p.y, se),
    snowman: (p) => snowmanF(px, p.x, p.y, se),
    crates: (p) => cratesF(px, p.x, p.y, se),
    barrels: (p) => barrelsF(px, p.x, p.y, se),
    beachboat: (p) => beachboatF(px, p.x, p.y, se),
    boulder: (p) => boulderF(px, p.x + 6, p.y + 6, p.r || 5, se, p.x + p.y),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  const baseOf = (p) => p.y + (PROPS[p.kind]?.base ?? 0);
  const flat = (p) => PROPS[p.kind]?.flat;

  // the peaks first (they stand behind everything at the water's edge), with the forest wall
  const back = [
    ...forestF(L, se, seed + 12, (x, y) => !inPeak(x, y - 4, 6) && D(x, y) < -8 && D(x, y - 12) < -4 && !inCreek(x, y, 7) && !onDeck(x, y, 6)),
    ...peaks.map((pk) => ({ y: pk.base, draw: () => peakF(out, pk, se, seed + 20 + (pk.seed || 0) * 7, wetAt, W, H) })),
  ].sort((a, b) => a.y - b.y);
  back.forEach((t) => t.draw(px));

  // decks over the water, the creek's footbridge, boats and things that lie flat
  L.props.filter((p) => flat(p) && p.under).forEach(draw);
  L.crossings.forEach((c, i) => {
    if (c.kind === 'wood') logBridgeF(px, c, se);
    else deckF(px, c, se, seed + 50 + i, wetAt, { rail: c.kind === 'boardwalk' ? 'e' : null, cap: c.kind !== 'dock' });
  });
  L.crossings.filter((c) => c.kind === 'dock').forEach((c) => { bollardF(px, c.x + c.w - 6, c.y - 3, se); bollardF(px, c.x + Math.round(c.w / 2) - 2, c.y - 3, se); });
  L.props.filter((p) => flat(p) && !p.under).forEach(draw);

  // everything that stands in the village, back to front
  const home = L.home;
  const looks = [{ door: '#f6f2ea', seed: 31 }, { door: '#ffd43b', seed: 47 }];
  const stand = [
    { y: home.y + home.h, draw: () => cabinF(px, home.x, home.y, home.w, home.h, { home: true, roof: opts.homeRoof || '#e03131', door: opts.homeRoof || '#e03131', seed: 11 }, se) },
    ...L.houses.map((hs, i) => ({ y: hs.y + hs.h, draw: () => cabinF(px, hs.x, hs.y, hs.w, hs.h, { roof: hs.roof, wall: hs.wall, sign: hs.sign, ...looks[i % looks.length] }, se) })),
    ...L.props.filter((p) => !flat(p)).map((p) => ({ y: baseOf(p), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  stand.forEach((t) => t.draw());

  out.put(ctx);
  // kept on the canvas, so the season can be painted again (see seasonfx.js)
  canvas.fjord = { L, opts, lib };
  return canvas;
}
