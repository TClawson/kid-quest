// Under the Sea (the ocean map's village) in style B, "soft storybook", like the Forest Village
// (meadowart.js) and Sunset Beach (sunsetart.js): hue-shifted colors, round shapes, selective
// outlines (each thing edged in a darker shade of its own color, ink only where it meets the
// ground), and soft dithered edges. A pale sea floor lit from above, with still shafts of light
// and the net of caustic light on the sand; a deep canyon splitting morning from after school,
// crossed by an old stone bridge; paths of crushed shell; plazas of pearly tiles; pearl-white
// houses under glass-colored domes; kelp, coral, giant clams and little sea things everywhere.
//
// Everything is one canvas pixel per village pixel, painted into one ImageData and shown with
// a single putImageData. villageprops.js calls paintOcean() for the ocean map; every other map
// keeps its own painter.

import { ramp, mix, rng, h2, vnoise, bayer, grid, inEll, pixelBuffer, pathField } from './pixelkit.js';
import { propB, groundShadow, laundryB } from './meadowart.js';

// ---------- the palette ----------

export const OB = {
  floor: ['#142c52', '#1b3f68', '#22557e', '#2c6c92', '#3a85a4', '#4e9db2', '#6ab6bc', '#8ecec4', '#b8e4cc'], // base 4
  path: ['#2a5a82', '#507e9a', '#7c9eac', '#a2bab8', '#c0d0c4', '#dce4d4', '#f2f4e8'], // crushed shell, base 3..4
  pearl: ['#3a5288', '#5e78a8', '#8aa4c8', '#b4cadf', '#d8e6f0', '#f2f8fc'],
  nacre: ['#a8709a', '#d090b8', '#eab4d0', '#f8d8e8'],
  deep: ['#050a20', '#081430', '#0c1d40', '#122a52', '#1a3864', '#244878'], // the canyon, black .. its upper wall
  rock: ['#1a2244', '#262f5a', '#363f72', '#4a548a', '#6470a2', '#8894bc', '#b0bad4'],
  stone: ['#2a3054', '#3e4670', '#56608a', '#7480a6', '#98a2c0', '#bcc4d8', '#dfe4ee'],
  kelp: ['#16362e', '#1f4a38', '#2c6040', '#3e7a48', '#589650', '#7cb45a', '#a8d06a', '#d4e888'],
  brass: ['#4a2e1e', '#7a4e22', '#b07a2a', '#dca640', '#f8d470', '#fff0b0'],
  glow: ['#5a3a3a', '#a8603a', '#e8a048', '#ffd47a', '#fff4c8'],
  ink: '#142038',
};
const SF = OB.floor; const PS = OB.path; const PL = OB.pearl; const NC = OB.nacre; const DP = OB.deep; const RK = OB.rock; const ST = OB.stone;
const KP = OB.kelp; const BR = OB.brass; const GW = OB.glow; const INK = OB.ink;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------- the sea floor ----------

/**
 * Pale sand under blue water: big soft patches blended by ordered dithering, ripples in fields,
 * the bright net of caustic light, still shafts of light slanting down from the surface, a few
 * darker grains, and the floor dimming towards the kelp at the edges.
 */
function floorB(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const b = bayer(x, y);
      const n = vnoise(x, y, 34, seed) * 0.75 + vnoise(x, y, 10, seed + 1) * 0.25;
      const t = (b - 0.5) * 0.14;
      let k = 4;
      if (n < 0.3 + t) k = 3; else if (n > 0.66 + t) k = 5;
      // ripples in the sand
      const field = vnoise(x, y, 46, seed + 5);
      if (field > 0.56) {
        const ph = (y + Math.sin(x / 12 + field * 9) * 3) / 7;
        const f = ph - Math.floor(ph);
        if (f < 0.12) k = Math.min(k + 1, 6); else if (f > 0.86 && field > 0.62) k = Math.max(k - 1, 3);
      }
      // broad shafts of light slanting down from the surface
      const ray = Math.sin((x * 0.55 - y) / 34 + Math.sin(x / 90) * 1.2);
      if (ray > 0.55 && b < (ray - 0.55) * 2.6) k = Math.min(k + 1, 6);
      // the net of caustic light, in patches
      if (vnoise(x, y, 64, seed + 14) > 0.5) {
        const cn = Math.abs(vnoise(x * 1.15, y, 12, seed + 12) - vnoise(x, y * 1.15 + 17, 12, seed + 13));
        if (cn < 0.018) k = Math.min(k + 1, 7);
      }
      let c = SF[k];
      const g = h2(x, y, seed + 3);
      if (g < 0.012) c = SF[3]; else if (g > 0.994) c = SF[7];
      // dimmer towards the edges, under the kelp
      const e = Math.min(x, y, W - 1 - x, H - 1 - y);
      if (e < 22) { const d = e + (vnoise(x, y, 9, seed + 9) - 0.5) * 7; if (d < 16 && b < (16 - d) / 11) c = d < 7 ? SF[2] : SF[3]; }
      px(x, y, c);
    }
  }
}

// ---------- the canyon ----------

/**
 * The deep canyon between morning and after school: a lip of rock all along, the far (north)
 * wall dropping away in ledges you can see, the near wall hidden under its overhang, then dark
 * water going down to black, with a few glowing specks of deep-sea life far below.
 */
function canyonB(px, L, wa, depth, seed) {
  const half = wa.w / 2;
  const ys = wa.pts.map((p) => p[1]);
  const Y0 = Math.max(0, Math.floor(Math.min(...ys) - half - 8)); const Y1 = Math.min(L.H, Math.ceil(Math.max(...ys) + half + 8));
  for (let y = Y0; y < Y1; y += 1) {
    for (let x = 0; x < L.W; x += 1) {
      const d = depth(wa, x, y);
      if (d < -6) continue;
      const b = bayer(x, y);
      // which side: the far wall is the side whose ground lies above (north)
      const north = depth(wa, x, y - 3) < d;
      if (d < -2) { if (b < (d + 6) / 6) px(x, y, north ? SF[3] : SF[2]); continue; }
      if (d < 0.6) { px(x, y, north ? (d < -0.8 ? RK[5] : RK[4]) : (d < -0.8 ? RK[3] : RK[2])); continue; } // the rocky lip
      let c;
      if (north) {
        // the far wall, in ledges, lit from above and darkening as it drops
        const wall = d / (half * 0.9);
        const ledge = (Math.floor(d + vnoise(x, y, 10, seed) * 3) % 4) === 0;
        if (wall < 0.55) c = ledge ? RK[4] : (wall < 0.25 ? RK[3] : RK[2]);
        else c = wall < 0.75 ? (b < 0.5 ? RK[1] : DP[4]) : DP[3];
        if (!ledge && wall < 0.5 && vnoise(x, y, 4, seed + 2) > 0.7) c = RK[2];
      } else {
        // under the near overhang: deep shadow at once
        c = d < 2 ? RK[0] : d < 3.2 && b < 0.5 ? RK[0] : DP[2];
      }
      // the deep water: black in the middle
      const mid = half - d;
      if (mid < half * 0.55) c = mid < half * 0.25 ? DP[0] : b < 0.5 ? DP[1] : (north ? DP[2] : DP[1]);
      px(x, y, c);
    }
  }
  // tiny glowing specks of deep-sea life
  for (let y = Y0; y < Y1; y += 1) for (let x = 0; x < L.W; x += 1) {
    if (h2(x, y, seed + 5) < 0.9965) continue;
    const d = depth(wa, x, y);
    if (d < half * 0.55) continue;
    const c = h2(y, x, seed + 6) < 0.5 ? '#7af0e0' : '#c8a8ff';
    px(x, y, c); px(x - 1, y, 'rgba(122,240,224,0.25)'); px(x + 1, y, 'rgba(122,240,224,0.25)');
  }
}

// ---------- paths and plazas ----------

/** Paths of crushed shell: pale and speckled, edged with a row of round pebbles, a soft shadow on the low side. */
function pathsB(px, L, seed) {
  const R = 6;
  const field = pathField(L.paths, R + 3);
  for (let y = 0; y < L.H; y += 1) for (let x = 0; x < L.W; x += 1) {
    const f = field(x, y);
    if (f.d > R + 2) continue;
    const b = bayer(x, y);
    if (f.d > R) { if (f.ny > 0.3 || f.nx > 0.3 ? b < 0.5 : b < 0.25) px(x, y, SF[3]); continue; } // its shadow
    if (f.d > R - 1.6) {
      // pebbles along the edge
      const along = Math.floor(f.along / 3.2);
      const peb = h2(along, f.off > 0 ? 1 : 2, seed);
      px(x, y, peb < 0.5 ? (f.ny < -0.3 || f.nx < -0.3 ? PS[5] : PS[2]) : peb < 0.8 ? PS[3] : PS[1]);
      continue;
    }
    let c = PS[4];
    const n = vnoise(x, y, 7, seed + 1);
    if (n < 0.3 + (b - 0.5) * 0.2) c = PS[3]; else if (n > 0.74) c = PS[5];
    const g = h2(x, y, seed + 2);
    if (g < 0.05) c = PS[2]; else if (g > 0.965) c = g > 0.99 ? NC[2] : PS[6]; // bits of shell, a pink one now and then
    px(x, y, c);
  }
}

/** A round plaza of pearly tiles in rings, a pink nacre star in the middle, a rim of stone. */
function plazaB(px, cx, cy, r, seed) {
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y += 1) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x += 1) {
    const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
    if (d > r + 2.5) continue;
    if (d > r) { px(x, y, dy > 0 ? (d > r + 1.5 ? 'rgba(20,32,56,0.25)' : ST[2]) : ST[4]); continue; } // the rim
    const ring = Math.floor(d / 5); const a = Math.atan2(dy, dx);
    const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * Math.max(6, ring * 7 + 6));
    const gap = d % 5 < 0.9 || ((a + Math.PI) / (Math.PI * 2) * Math.max(6, ring * 7 + 6)) % 1 < 0.12;
    const lit = (dx + dy) / r;
    let c = gap ? PL[2] : (h2(seg, ring, seed) < 0.22 ? NC[3] : lit < -0.4 ? PL[5] : lit > 0.5 ? PL[3] : PL[4]);
    if (ring === 0) {
      // the star
      const star = Math.cos(a * 5 + 0.3) * 0.35 + 0.65;
      c = d < 4.6 * star ? (d < 1.6 ? NC[3] : lit < 0 ? NC[2] : NC[1]) : PL[4];
    }
    px(x, y, c);
  }
}

// ---------- the bridge ----------

/** The old stone bridge over the canyon: big flat slabs, low parapets, barnacles and a little coral. */
function bridgeV(px, c, seed = 91) {
  const { x: X, y: Y, w, h } = c;
  const x0 = Math.round(X + 2); const x1 = Math.round(X + w - 2);
  groundShadow(px, X + w / 2 + 3, Y + h / 2 + 2, w / 2 + 2, h / 2, 0.3);
  propB(px, x0 - 2, Math.round(Y) - 2, x1 - x0 + 4, Math.round(h) + 4, (b) => {
    const H0 = Math.round(h) + 4; const W0 = x1 - x0 + 4;
    // the deck: slabs laid across
    for (let y = 2; y < H0 - 2; y += 1) for (let x = 3; x < W0 - 3; x += 1) {
      const row = Math.floor((y - 2) / 7); const r = (y - 2) % 7;
      const off = (row % 2) * 6; const seam = (x + off) % 12 === 0;
      let col = r === 6 ? ST[2] : seam ? ST[3] : r === 0 ? ST[6] : h2(Math.floor((x + off) / 12), row, seed) < 0.35 ? ST[4] : ST[5];
      if (vnoise(x + X, y + Y, 4, seed) > 0.72 && r !== 6 && !seam) col = mix(col, '#7aa890', 0.35); // a little weed
      b.set(x, y, col, 'stone');
    }
    // the parapets either side
    for (const side of [0, W0 - 3]) for (let y = 0; y < H0; y += 1) for (let k = 0; k < 3; k += 1) {
      const cap = y % 9 === 0;
      b.set(side + k, y, cap ? ST[6] : k === (side ? 2 : 0) ? ST[2] : k === 1 ? ST[4] : ST[3], 'stone');
    }
    // barnacles and a tuft of coral
    for (let y = 3; y < H0 - 3; y += 5) { if (h2(y, 1, seed) < 0.5) { b.set(1, y, '#e8e4f0', 'shell'); b.set(W0 - 2, y + 2, '#e8e4f0', 'shell'); } }
    grid((x, y, col) => b.set(x, y, col, 'coral'), W0 - 4, H0 - 8, ['.p.', 'pPp', '.p.'], { p: '#f07a9a', P: '#ffc0d0' });
    grid((x, y, col) => b.set(x, y, col, 'coral'), 0, 6, ['o.o', 'oOo'], { o: '#ff9a5a', O: '#ffd0a0' });
  }, { outline: (t, side) => (t === 'shell' || t === 'coral' ? null : side === 'bottom' ? INK : side === 'right' ? ST[0] : ST[1]) });
}

// ---------- outlines ----------

const EDGE = {
  pearl: [PL[2], PL[1]], brass: [BR[2], BR[1]], glass: null, stone: [ST[2], ST[1]], rock: [RK[2], RK[1]],
  kelp: [KP[2], KP[1]], shell: ['#a87a9a', '#7a5a7a'], iron: ['#5a5470', '#3a3450'], wood: ['#6a4a40', '#4a3036'],
};
const GROUNDED = new Set(['pearl', 'stone', 'rock', 'wood', 'iron', 'shell']);
/** Each material edged in a darker shade of itself (lit sides softer); ink only where things meet the floor. */
function sel(tag, side) {
  const t = String(tag || '').split(':')[0];
  if (side === 'bottom' && GROUNDED.has(t)) return INK;
  const e = EDGE[t];
  if (e === null) return null;
  if (!e) return side === 'bottom' || side === 'right' ? '#1c2a48' : '#2c3c60';
  return side === 'bottom' || side === 'right' ? e[1] : e[0];
}

// ---------- the dome houses ----------

/**
 * A dome house: a pearl-white round wall with a brass band, portholes glowing warm and a round
 * door; over it a dome of colored sea glass held in brass ribs, glossy where the light catches
 * it, a little brass vent on top trailing bubbles. o: { glass, door, sign, home, seed }.
 */
function domeB(px, X, Y, w, h, o = {}) {
  const G = ramp(o.glass || '#74c0fc', 3, 3); // dark .. light, 7 steps
  const D = ramp(o.door || '#2f9e8e', 2, 2);
  const cx = w / 2; const baseH = Math.round(h * 0.36); const wallTop = h - baseH;
  const ry = wallTop + 2; const rx = w / 2 - 3;
  groundShadow(px, X + w / 2 + 4, Y + h - 1, w / 2 + 2, 4, 0.26);
  propB(px, X, Y, w, h, (b) => {
    // the wall: a short pearly cylinder, lit on the left
    for (let y = wallTop - 2; y < h; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const u = (x + 0.5 - cx) / (w / 2 - 1);
      const bot = h - 1 - Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * 3);
      if (y > bot) continue;
      let c = u < -0.55 ? PL[5] : u < 0.15 ? PL[4] : u < 0.62 ? PL[3] : PL[2];
      if (y === bot || y === bot - 1) c = y === bot ? BR[1] : BR[3]; // the brass foot
      if (y >= wallTop && y <= wallTop + 1) c = y === wallTop ? BR[4] : BR[2]; // the brass band under the dome
      if (y > wallTop + 1 && y < bot - 1 && (x + Math.round(y * 0.2)) % 11 === 0) c = mix(c, PL[1], 0.35); // panel seams
      b.set(x, y, c, 'pearl');
    }
    // the dome: sea glass in brass ribs, a round shine at its top left
    for (let y = 0; y < wallTop; y += 1) for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - ry) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      const lit = -dx * 0.55 - dy * 0.45 + z * 0.55;
      let k = lit > 0.62 ? 5 : lit > 0.38 ? 4 : lit > 0.1 ? 3 : lit > -0.15 ? 2 : 1;
      const lon = Math.asin(clamp(dx / Math.sqrt(Math.max(0.0001, 1 - dy * dy)), -1, 1)) / (Math.PI / 2); // -1 .. 1 across
      const rib = Math.abs(((lon * 3 + 3) % 1) - 0.5) > 0.44 || Math.abs(dy + 0.42) < 0.035;
      if (rib) { b.set(x, y, lit > 0.35 ? BR[4] : lit > 0 ? BR[3] : BR[2], 'brass'); continue; }
      if (inEll(x, y, cx - rx * 0.42, ry * 0.42, rx * 0.2, ry * 0.12)) k = 6; // the shine
      b.set(x, y, G[k], 'glass');
    }
    // the vent on top
    grid((x, y, c) => b.set(x, y, c, 'brass'), Math.round(cx) - 3, -4, ['.bBb.', 'bBBBb', '.bbb.', '.bdb.'], { b: BR[2], B: BR[4], d: BR[1] });
    // portholes, glowing warm
    for (const fx of [0.2, 0.8]) {
      const ox = Math.round(w * fx) - 4; const oy = wallTop + Math.round(baseH * 0.28);
      grid((x, y, c) => b.set(x, y, c, 'brass'), ox, oy, ['..bbbb..', '.bBwwBb.', 'bBwWWwBb', 'bwWYYWwb', 'bwWYYWwb', 'bBwWWwBb', '.bBwwBb.', '..bbbb..'], { b: BR[1], B: BR[3], w: GW[3], W: GW[2], Y: GW[4] });
    }
    // the round-topped door with a brass porthole, a stone step
    const dw = Math.max(12, Math.round(w * 0.16)); const dh = Math.round(baseH * 0.86); const dx0 = Math.round(cx - dw / 2); const dy0 = h - dh - 1;
    for (let y = dy0; y < h - 1; y += 1) for (let x = dx0; x < dx0 + dw; x += 1) {
      const top = y - dy0 < dw / 2 && !inEll(x, y, cx, dy0 + dw / 2, dw / 2, dw / 2);
      if (top) continue;
      const edge = x === dx0 || x === dx0 + dw - 1 || (y - dy0 < dw / 2 && !inEll(x, y, cx, dy0 + dw / 2, dw / 2 - 1, dw / 2 - 1));
      b.set(x, y, edge ? BR[2] : x < cx - 1 ? D[3] : x === Math.round(cx) - 1 ? D[1] : D[2], 'door');
    }
    grid((x, y, c) => b.set(x, y, c, 'brass'), Math.round(cx) - 2, dy0 + 3, ['.bb.', 'bWwb', 'bwwb', '.bb.'], { b: BR[3], W: '#e8f8ff', w: '#a8d8f0' });
    b.set(dx0 + dw - 3, dy0 + Math.round(dh * 0.6), BR[4], 'brass');
    if (o.sign) grid((x, y, c) => b.set(x, y, c, 'sign'), Math.round(cx) - 5, wallTop + 3, ['bbbbbbbbbb', 'bwwwwkkwwb', 'bwwwwkwkwb', 'bwwwwkwwwb', 'bwwkkkwwwb', 'bwkkkkwwwb', 'bwwkkwwwwb', 'bbbbbbbbbb'], { b: BR[2], w: '#fff8e8', k: '#3a2a5a' });
    // a sea-glass pennant on the vent, in the dome's color, for the kid's own house
    if (o.home) {
      for (let y = -12; y < -3; y += 1) b.set(Math.round(cx), y, BR[1], 'brass');
      grid((x, y, c) => b.set(x, y, c, 'flag'), Math.round(cx) + 1, -12, ['ggGg', 'gggg.', 'gg'], { g: G[3], G: G[5] });
    }
    // kelp and a tuft of coral at its foot
    grid((x, y, c) => b.set(x, y, c, 'kelp'), 2, h - 11, ['.k.', 'kK.', '.kk', '.Kk', 'kk.', '.k.', 'kK.', '.k.', '.k.', 'kk.'], { k: KP[3], K: KP[5] });
    grid((x, y, c) => b.set(x, y, c, 'coral'), w - 9, h - 6, ['o.o.o', 'oOoOo', '.ooo.', '..o..'], { o: '#ff8a6a', O: '#ffd0b0' });
  }, { outline: (t, side) => (t === 'glass' ? (side === 'bottom' || side === 'right' ? G[0] : G[1]) : t === 'door' ? D[0] : t === 'flag' ? null : t === 'kelp' || t === 'coral' || t === 'sign' ? (t === 'sign' ? BR[1] : null) : sel(t, side)) });
  // bubbles rising from the vent
  [[0, -8, 2], [2, -14, 1], [-1, -19, 2], [1, -25, 1]].forEach(([dx, dy, r]) => {
    const bx = Math.round(X + cx + dx); const by = Y + dy;
    if (r > 1) { px(bx, by - 1, 'rgba(220,250,255,0.7)'); px(bx - 1, by, 'rgba(220,250,255,0.7)'); px(bx + 1, by, 'rgba(160,220,240,0.6)'); px(bx, by + 1, 'rgba(160,220,240,0.6)'); px(bx - 1, by - 1, '#ffffff'); }
    else px(bx, by, 'rgba(230,250,255,0.8)');
  });
}

// ---------- the stall ----------

/** The shop: a scallop-shell canopy on coral posts over a stone counter of shells, pearls and starfish. */
function stallO(px, X, Y, pal = {}) {
  const A = ramp(pal.a || '#f783ac', 2, 2);
  groundShadow(px, X + 23, Y + 32, 23, 3, 0.24);
  propB(px, X, Y, 44, 33, (b) => {
    // coral posts
    for (const x0 of [3, 38]) for (let y = 10; y < 33; y += 1) { b.set(x0, y, '#ff9a8a', 'coral'); b.set(x0 + 1, y, '#e8606a', 'coral'); if (y % 6 === 2) b.set(x0 + (x0 < 20 ? -1 : 2), y, '#ffc0b0', 'coral'); }
    // the stone counter
    for (let y = 20; y < 32; y += 1) for (let x = 1; x < 43; x += 1) b.set(x, y, y === 20 ? ST[6] : y === 21 ? ST[5] : (x + (Math.floor((y - 22) / 4) % 2) * 5) % 10 === 0 ? ST[2] : y > 29 ? ST[3] : ST[4], 'stone');
    // goods: a plate of pearls, a conch, a starfish, a jar of glowing bubbles
    grid((x, y, c) => b.set(x, y, c, 'goods'), 5, 16, ['.wWw.', 'wWWWw', 'ppppp'], { w: '#f0f0ff', W: '#ffffff', p: ST[3] });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 13, 14, ['...cc.', '.cCCc.', 'cCcpCc', '.cccc.', '..cc..', '...c..'], { c: '#f0b890', C: '#ffe0c8', p: '#f08aa8' });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 22, 15, ['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: '#ff8a4a', O: '#ffd0a0' });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 30, 13, ['.kk.', 'gggg', 'gWbg', 'gbWg', 'gggg'], { k: '#8a6a4a', g: '#9ad8e8', W: '#ffffff', b: '#c8f0ff' });
    // the scallop canopy: ribbed, striped in the shop's color
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 44; x += 1) {
      const u = (x + 0.5 - 22) / 22; const top = Math.round(7 * u * u);
      const hem = 10 + Math.round(Math.abs(Math.sin(((x + 0.5) / 44) * Math.PI * 7)) * 1.6);
      if (y < top || y > hem) continue;
      const rib = Math.floor((x + 0.5) / 44 * 9);
      const k = y === hem ? 1 : rib % 2 ? 4 : 3;
      b.set(x, y, rib % 2 ? (y === hem ? '#d8c8d8' : u < -0.4 ? '#ffffff' : '#fff0f8') : A[k], 'shell');
    }
    grid((x, y, c) => b.set(x, y, c, 'shell'), 18, -3, ['.pPp.', 'pPPPp', '.ppp.'], { p: A[3], P: A[5] }); // a pink pearl on top
  }, { outline: (t, side) => (t === 'goods' ? null : t === 'coral' ? '#a83a4a' : t === 'shell' ? (side === 'bottom' ? A[0] : A[1]) : sel(t, side)) });
}

// ---------- kelp, coral, clams, anchor, rocks ----------

/** Kelp, 16 x 42: two or three wavy stalks with long blades and little gas floats, lit at the tips. */
function kelpB(px, X, Y) {
  groundShadow(px, X + 9, Y + 41, 6, 1.6, 0.22);
  propB(px, X, Y, 16, 42, (b) => {
    const n = 2 + (h2(X, Y, 3) < 0.5 ? 1 : 0);
    for (let s = 0; s < n; s += 1) {
      const bx = 5 + s * 3; const top = 2 + s * 5 + Math.round(h2(X, s, 4) * 4);
      for (let y = top; y < 42; y += 1) {
        const x = Math.round(bx + Math.sin(y / 5 + s * 2 + X) * 2);
        b.set(x, y, KP[3], 'kelp'); b.set(x + 1, y, KP[2], 'kelp');
        // blades off the stalk, alternate sides
        if ((y + s * 3) % 7 === 0 && y < 38) {
          const dir = (Math.floor(y / 7) + s) % 2 ? 1 : -1;
          for (let k = 1; k < 6; k += 1) {
            const xx = x + dir * k; const yy = y - Math.round(k * 0.5);
            b.set(xx, yy, k > 3 ? KP[6] : KP[5], 'kelp'); b.set(xx, yy + 1, KP[4], 'kelp');
          }
          b.set(x + dir, y + 1, '#d0b858', 'float'); // a gas float
        }
      }
      b.set(Math.round(bx + Math.sin(top / 5 + s * 2 + X) * 2), top - 1, KP[7], 'kelp');
    }
  }, { outline: (t, side) => (t === 'float' ? null : side === 'bottom' || side === 'right' ? KP[1] : KP[2]) });
}

/** Coral, 24 x 22, in color c: a branching bush with lit tips and polyps, or now and then a fan. */
function coralB(px, X, Y, col = '#ff8787') {
  const C = ramp(col, 2, 2);
  groundShadow(px, X + 13, Y + 21, 9, 1.8, 0.22);
  const fan = h2(X, Y, 7) < 0.3;
  propB(px, X, Y, 24, 22, (b) => {
    if (fan) {
      for (let y = 0; y < 21; y += 1) for (let x = 0; x < 24; x += 1) {
        const r = Math.hypot(x + 0.5 - 12, (y + 0.5 - 19) * 1.15);
        if (r > 12.5 || y > 18) continue;
        const a = Math.atan2(y + 0.5 - 19, x + 0.5 - 12);
        const spoke = Math.abs(((a / Math.PI) * 9 + 20) % 1 - 0.5) > 0.36;
        const arc = r > 11.5 || Math.abs(r - 8) < 0.5 || Math.abs(r - 4.5) < 0.5;
        if (!spoke && !arc) { if ((x + y) % 2 === 0 && r < 11) b.set(x, y, C[1], 'coral'); continue; } // the lace between
        b.set(x, y, r > 11.5 ? C[4] : x < 12 ? C[3] : C[2], 'coral');
      }
      for (let y = 17; y < 22; y += 1) { b.set(11, y, C[1], 'coral'); b.set(12, y, C[2], 'coral'); }
      return;
    }
    // branches: from the foot, forking up
    const arms = [[12, 21, 5, 4], [12, 21, 19, 6], [12, 21, 11, 0], [8, 12, 3, 6], [16, 13, 21, 9], [11, 8, 8, 2], [13, 6, 16, 1]];
    arms.forEach(([x0, y0, x1, y1], i) => {
      const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)) * 2;
      for (let k = 0; k <= n; k += 1) {
        const t = k / n; const x = Math.round(x0 + (x1 - x0) * t); const y = Math.round(y0 + (y1 - y0) * t);
        const thick = i < 3 ? 2 : 1;
        for (let d = 0; d < thick; d += 1) b.set(x + d, y, d ? C[2] : C[3], 'coral');
      }
      b.set(x1, y1, C[5], 'coral'); b.set(x1 + 1, y1, C[4], 'coral'); b.set(x1, y1 - 1, C[4], 'coral');
    });
    // polyps
    [[6, 9], [17, 11], [10, 4], [14, 15], [4, 14]].forEach(([x, y]) => { if (b.get(x, y)) b.set(x, y, '#fff4e8', 'coral'); });
  }, { outline: (t, side) => (side === 'bottom' ? INK : side === 'right' ? C[0] : C[1]) });
}

/** A giant clam, 26 x 18: wavy blue-violet lips open a little, the mantle inside, a pearl. */
function clamB(px, X, Y) {
  groundShadow(px, X + 14, Y + 16, 13, 2.4, 0.24);
  const S = ['#3a3070', '#5a4c98', '#7e6cba', '#a690d4', '#ccb8ea', '#ece2fa'];
  propB(px, X, Y, 26, 18, (b) => {
    for (let y = 2; y < 18; y += 1) for (let x = 0; x < 26; x += 1) {
      if (!inEll(x, y, 13, 11, 13, 8)) continue;
      const wave = Math.sin((x + 0.5) / 26 * Math.PI * 5);
      const lip = 9 + Math.round(wave * 1.5);
      const ridge = Math.abs(Math.sin((x + 0.5 - 13) / 2.6)) < 0.3;
      if (y < lip - 1) b.set(x, y, ridge ? S[3] : x < 9 ? S[5] : S[4], 'shell'); // the top shell
      else if (y <= lip + 1) b.set(x, y, Math.abs(x - 13) < 7 ? (y === lip ? '#3ac8b0' : '#2a8a90') : S[1], 'mantle'); // the mantle showing
      else b.set(x, y, ridge ? S[1] : x < 9 ? S[3] : S[2], 'shell'); // the bottom shell
    }
    grid((x, y, c) => b.set(x, y, c, 'pearl'), 11, 7, ['.ww.', 'wWWw', 'wwwd', '.dd.'], { w: '#f0eaff', W: '#ffffff', d: '#c0b0e0' });
  }, { outline: (t, side) => (t === 'pearl' || t === 'mantle' ? null : side === 'bottom' ? INK : side === 'right' ? S[0] : S[1]) });
}

/** An old anchor, 20 x 26, stuck in the sand, crusted with rust and weed, a length of chain. */
function anchorB(px, X, Y) {
  groundShadow(px, X + 11, Y + 24, 9, 2, 0.22);
  const I = ['#2a2640', '#423e5a', '#625c7a', '#8a84a2', '#b0aac6'];
  propB(px, X, Y, 20, 26, (b) => {
    grid((x, y, c) => b.set(x, y, c, 'iron'), 1, 0, [
      '.......rrr........',
      '......r...r.......',
      '.......rrr........',
      '..SSSSSSSSSSSs....',
      '..sssssssssss.....',
      '........Ii........',
      '........Ii........',
      '........Ii........',
      '........Ii........',
      '........Ii........',
      '........Ii........',
      'F.......Ii.......F',
      'FF......Ii......Ff',
      '.Ff.....Ii.....Ff.',
      '..Ff....Ii....Ff..',
      '...FFf..Ii..fFf...',
      '.....FFFIiFFff....',
      '.......FFff.......',
    ], { r: I[3], s: I[1], S: I[3], I: I[3], i: I[1], F: I[3], f: I[1] });
    [[5, 3], [12, 4], [9, 9], [4, 13], [12, 15]].forEach(([x, y]) => b.set(x, y, '#c0683a', 'iron'));
    for (let y = 18; y < 26; y += 1) for (let x = 2; x < 19; x += 1) if (y > 20 + Math.abs(x - 10) * 0.3) b.set(x, y, y < 22 ? PS[5] : PS[4], 'sand'); // sand heaped round its crown
    grid((x, y, c) => b.set(x, y, c, 'weed'), 10, 6, ['k.', '.k', 'kK', '.k', 'k.'], { k: KP[3], K: KP[5] });
  }, { outline: (t, side) => (t === 'weed' ? null : t === 'sand' ? (side === 'bottom' ? SF[3] : null) : side === 'bottom' || side === 'right' ? I[0] : I[1]) });
}

/** A rock on the sea floor, lilac-blue, lit on top, with an anemone or a cluster of barnacles. */
function rockO(px, X, Y, w = 22, h = 16) {
  groundShadow(px, X + w / 2 + 2, Y + h - 1, w / 2 + 1, 2.4, 0.24);
  const anem = h2(X, Y, 5) < 0.5;
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const wob = (vnoise(x + X, y + Y, 4, 5) - 0.5) * 0.25;
      if (!inEll(x, y, w / 2, h * 0.58, w / 2 * (1 + wob), h * 0.6 * (1 + wob)) || y > h - 2) continue;
      const s = (x + 0.5 - w / 2) / w * 1.6 + (y + 0.5 - h / 2) / h * 1.8;
      let c = s < -0.9 ? RK[6] : s < -0.3 ? RK[5] : s > 0.8 ? RK[3] : RK[4];
      if (y > h - 5) c = bayer(x, y) < 0.5 ? RK[3] : RK[2];
      if (vnoise(x + X, y + Y, 3, 9) > 0.72 && s > -0.5) c = mix(c, '#5a9a7a', 0.4);
      b.set(x, y, c, 'rock');
    }
    if (anem) {
      const ax = Math.round(w * 0.55); const ay = Math.round(h * 0.15);
      grid((x, y, c) => b.set(x, y, c, 'anem'), ax - 3, ay - 3, ['t.t.t', '.tTt.', 'tTTTt', '.ppp.'], { t: '#ff9ad0', T: '#ffd0ea', p: '#c85a9a' });
    } else for (let k = 0; k < 4; k += 1) { const x = Math.round(w * 0.3) + k * 3; b.set(x, Math.round(h * 0.3) + (k % 2), '#f4f0fa', 'rock'); }
  }, { outline: (t, side) => (t === 'anem' ? null : sel(t, side)) });
}

// ---------- the green, under the sea ----------

const oval = (Z, x, y) => { const dx = (x + 0.5 - (Z.x + Z.w / 2)) / (Z.w / 2); const dy = (y + 0.5 - (Z.y + Z.h / 2)) / (Z.h / 2); return 1 - (dx * dx + dy * dy); };
const grow = (Z, g) => ({ x: Z.x - g, y: Z.y - g, w: Z.w + g * 2, h: Z.h + g * 2 });
const inRound = (x, y, x0, y0, w, h, r) => {
  const cx = Math.max(x0 + r, Math.min(x0 + w - r, x + 0.5)); const cy = Math.max(y0 + r, Math.min(y0 + h - r, y + 0.5));
  return (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r;
};

/** The fishing spot: a blue hole in the sea floor, a rim of rock, its far wall in ledges, dark and deep in the middle. */
function blueHoleB(px, Z, seed) {
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
    const k = oval(Z, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
    if (k < 0) { if (oval(grow(Z, 1.6), x, y) >= 0) px(x, y, north ? RK[5] : RK[3]); else if (oval(grow(Z, 4.5), x, y) >= 0 && b < 0.5) px(x, y, SF[3]); continue; }
    let c;
    if (north && oval(grow(Z, -6), x, y) < 0) c = oval(grow(Z, -2), x, y) < 0 ? RK[4] : oval(grow(Z, -4), x, y) < 0 ? RK[3] : (b < 0.5 ? RK[2] : DP[4]);
    else if (!north && oval(grow(Z, -2.5), x, y) < 0) c = RK[0];
    else c = k > 0.5 ? DP[1] : k > 0.3 ? (b < 0.5 ? DP[1] : DP[2]) : DP[3];
    px(x, y, c);
  }
  const rnd = rng(seed);
  for (let i = 0; i < 6; i += 1) { const x = Z.x + 14 + Math.floor(rnd() * (Z.w - 28)); const y = Z.y + 12 + Math.floor(rnd() * (Z.h - 20)); if (oval(grow(Z, -8), x, y) > 0) px(x, y, i % 2 ? '#7af0e0' : '#c8a8ff'); }
  // a little coral on the rim
  grid(px, Math.round(Z.x + Z.w * 0.8), Math.round(Z.y - 3), ['o.o', 'oOo', '.o.'], { o: '#ff8a6a', O: '#ffd0b0' });
  grid(px, Math.round(Z.x + Z.w * 0.12), Math.round(Z.y + Z.h - 1), ['.p.', 'pPp'], { p: '#e86aa8', P: '#ffc0e0' });
}

/** A goal of driftwood and old net, its mouth facing dir. */
function netGoalO(px, X, Y, w, h, dir) {
  const DW = ['#3a2e3e', '#5a4a52', '#7a6a6a', '#9a8c84', '#bcb0a4', '#dcd4c8'];
  groundShadow(px, X + w / 2 + 1, Y + h, w / 2 + 2, 1.6, 0.24);
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let i = 0; i < w; i += 1) {
      const x = dir > 0 ? i : w - 1 - i;
      if (i >= w - 2) b.set(x, y, i === w - 2 ? DW[5] : DW[3], 'wood');
      else if (y === 0 || y === h - 1) b.set(x, y, y === 0 ? DW[5] : DW[2], 'wood');
      else if (i === 0) b.set(x, y, DW[3], 'wood');
      else if ((i + y) % 3 === 0 || (i - y + 99) % 3 === 0) b.set(x, y, 'rgba(230,246,240,0.8)', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : sel(t, side)) });
}

/** A court on the sea floor: smooth pale sand ringed with pebbles and shells, lines drawn in it, net goals or yellow posts. */
function courtO(px, Z, kind, seed) {
  if (kind === 'hockey') { rinkO(px, Z, seed); return; }
  const P = { x: Z.x - 4, y: Z.y - 3, w: Z.w + 8, h: Z.h + 6 };
  for (let y = P.y - 2; y < P.y + P.h + 2; y += 1) for (let x = P.x - 2; x < P.x + P.w + 2; x += 1) {
    const inside = inRound(x, y, P.x, P.y, P.w, P.h, 12);
    if (!inside) { if (inRound(x, y, P.x - 2, P.y - 2, P.w + 4, P.h + 4, 14)) { const peb = h2(Math.floor(x / 3), Math.floor(y / 3), seed); px(x, y, peb < 0.4 ? PS[2] : peb < 0.7 ? PS[3] : SF[5]); } continue; }
    const n = vnoise(x, y, 14, seed) + (bayer(x, y) - 0.5) * 0.2;
    px(x, y, n < 0.3 ? SF[5] : n > 0.72 ? SF[7] : SF[6]);
  }
  const groove = (x, y) => { px(x, y, SF[4]); px(x, y + 1, PS[5]); };
  const L0 = { x: Z.x + 2, y: Z.y + 1, w: Z.w - 4, h: Z.h - 3 };
  for (let x = L0.x + 2; x < L0.x + L0.w - 2; x += 1) { groove(x, L0.y); groove(x, L0.y + L0.h); }
  for (let y = L0.y + 1; y < L0.y + L0.h; y += 1) { px(L0.x, y, SF[4]); px(L0.x + 1, y, PS[5]); px(L0.x + L0.w - 1, y, SF[4]); px(L0.x + L0.w, y, PS[5]); }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = L0.y + 2; y < L0.y + L0.h - 1; y += 2) { px(mx, y, SF[4]); px(mx + 1, y, PS[5]); }
  for (let a = 0; a < 40; a += 1) { const t = (a / 40) * Math.PI * 2; px(Math.round(mx + Math.cos(t) * 7), Math.round(mid + Math.sin(t) * 5), SF[4]); }
  if (kind === 'football') {
    const Y4 = ['#a8701a', '#e0a02a', '#ffd04a', '#fff0a0'];
    const post = (x) => propB(px, x - 6, mid - 20, 13, 24, (b) => {
      for (let y = 9; y < 24; y += 1) { b.set(6, y, Y4[2], 'gold'); b.set(7, y, Y4[1], 'gold'); }
      for (let xx = 0; xx < 13; xx += 1) { b.set(xx, 8, Y4[3], 'gold'); b.set(xx, 9, Y4[1], 'gold'); }
      for (const ux of [0, 11]) for (let y = 0; y < 9; y += 1) { b.set(ux, y, Y4[2], 'gold'); b.set(ux + 1, y, Y4[1], 'gold'); }
    }, { outline: (t, side) => (side === 'bottom' ? INK : '#8a5a1a') });
    groundShadow(px, Z.x + 7, mid + 4, 4, 1.2, 0.24); groundShadow(px, Z.x + Z.w - 4, mid + 4, 4, 1.2, 0.24);
    post(Z.x + 5); post(Z.x + Z.w - 6);
    return;
  }
  netGoalO(px, Z.x - 1, mid - 8, 9, 16, 1); netGoalO(px, Z.x + Z.w - 8, mid - 8, 9, 16, -1);
}

/** The hockey court: a smooth flat slab of pale stone, worn glassy, with painted lines and little red nets. */
function rinkO(px, Z, seed) {
  const R = { x: Z.x - 3, y: Z.y - 2, w: Z.w + 6, h: Z.h + 5 };
  groundShadow(px, R.x + R.w / 2 + 2, R.y + R.h + 1, R.w / 2, 3, 0.24);
  for (let y = R.y; y < R.y + R.h; y += 1) for (let x = R.x; x < R.x + R.w; x += 1) {
    if (!inRound(x, y, R.x, R.y, R.w, R.h, 10)) continue;
    const edge = !inRound(x, y, R.x + 2, R.y + 2, R.w - 4, R.h - 4, 8);
    if (edge) { px(x, y, y > R.y + R.h / 2 ? (y >= R.y + R.h - 1 ? ST[2] : ST[3]) : ST[5]); continue; }
    const c = (x - y * 1.4) % 34 < 4 && bayer(x, y) < 0.5 ? ST[5] : vnoise(x, y, 16, seed) > 0.62 && bayer(x, y) < 0.5 ? ST[3] : ST[4];
    px(x, y, c);
  }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = R.y + 3; y < R.y + R.h - 2; y += 1) { px(mx - 1, y, '#e8485a'); px(mx, y, '#ff6a7a'); }
  for (const lx of [Math.round(Z.x + Z.w * 0.3), Math.round(Z.x + Z.w * 0.7)]) for (let y = R.y + 3; y < R.y + R.h - 2; y += 1) px(lx, y, '#4a8ae8');
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

// ---------- little things on the sea floor ----------

/** Shells, starfish, tufts of sea grass, pebbles, and tiny anemones, scattered where nothing else is. */
function scatterO(px, L, areas, seed) {
  const busy = (x, y) => L.blocked(x, y, 7) || L.onPath(x, y, 10) || L.inWater(x, y, 6) || areas.some((a) => x > a.x - 12 && x < a.x + a.w + 12 && y > a.y - 12 && y < a.y + a.h + 12);
  const rnd = rng(seed);
  const SHELLS = [['#f0b8c8', '#ffe4ea', '#b07a90'], ['#e8f0f4', '#ffffff', '#98a8b8'], ['#f0d0a0', '#fff0d0', '#b08a5a'], ['#d8c0f0', '#f4ecff', '#9a80c0']];
  for (let i = 0; i < (L.W * L.H) / 560; i += 1) {
    const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const k = rnd(); const v = Math.floor(rnd() * 4);
    if (Math.min(x, L.W - x) < 26 || y < 30 || y > L.H - 26 || busy(x, y)) continue;
    const [m, l, d] = SHELLS[v];
    if (k < 0.3) grid(px, x, y, v % 2 ? ['.lm', 'mmm', '.d.'] : ['lm.', 'mmd'], { m, l, d });
    else if (k < 0.42) grid(px, x, y, ['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: v % 2 ? '#f07a5a' : '#e8608a', O: v % 2 ? '#ffc09a' : '#ffb0c8' });
    else if (k < 0.7) { const g = v % 2 ? KP : ['#1e4a40', '#2a6a52', '#3a8a62', '#56a872', '#7cc488', '#a8dca0', '#d0f0c0', '#e8f8e0']; [[0, 0], [1, -1], [2, 0], [1, -2], [3, -1], [-1, -1]].forEach(([dx, dy], j) => { if (j < 4 + v) px(x + dx, y + dy, j % 2 ? g[5] : g[4]); }); px(x, y + 1, SF[3], 4, 1); }
    else if (k < 0.85) { px(x, y, SF[6]); px(x + 1, y, SF[5]); px(x, y + 1, SF[3], 2, 1); }
    else grid(px, x, y, ['p.p.p', '.pPp.', '.ddd.'], { p: v % 2 ? '#c890f0' : '#ff9ad0', P: '#ffe0f4', d: '#7a4a8a' });
  }
}

// ---------- the sea's little things ----------

/** A sea anemone, 20 x 14, with a clownfish tucked in its tentacles. */
export function anemoneB(px, X, Y) {
  groundShadow(px, X + 10, Y + 13, 8, 1.8, 0.24);
  propB(px, X, Y, 20, 14, (b) => {
    for (let y = 9; y < 14; y += 1) for (let x = 5; x < 15; x += 1) if (inEll(x, y, 10, 12, 5, 3.5)) b.set(x, y, x < 9 ? '#d06aa8' : '#a84a8a', 'body');
    for (let k = 0; k < 11; k += 1) {
      const bx = 2 + k * 1.6; const len = 6 + Math.round(Math.sin(k * 1.3) * 2);
      for (let j = 0; j < len; j += 1) { const x = Math.round(bx + Math.sin(j / 2 + k) * 1.1); b.set(x, 10 - j, j > len - 2 ? '#ffe0f4' : j > len - 4 ? '#ffb0dc' : '#ff8ac8', 'tent'); }
    }
    grid((x, y, c) => b.set(x, y, c, 'fish'), 6, 3, ['.ooo..', 'oWoWo.', 'oooWoo', '.oWo..'], { o: '#ff7a2a', W: '#ffffff' });
    b.set(10, 4, '#1a1a2a', 'fish');
  }, { outline: (t, side) => (t === 'tent' ? (side === 'bottom' || side === 'right' ? '#b04a8a' : null) : t === 'fish' ? '#a8401a' : side === 'bottom' ? INK : '#7a3a6a') });
}

/** An old brass diving helmet, 18 x 18, half sunk, with a little fish looking out of its window. */
export function helmetB(px, X, Y) {
  groundShadow(px, X + 10, Y + 17, 9, 2, 0.26);
  propB(px, X, Y, 18, 18, (b) => {
    for (let y = 0; y < 17; y += 1) for (let x = 0; x < 18; x += 1) {
      if (!inEll(x, y, 9, 8, 8, 8.2) && !(y > 12 && x > 1 && x < 16)) continue;
      const lit = (x + 0.5 - 9) / 8 + (y + 0.5 - 8) / 8;
      let c = lit < -0.8 ? BR[5] : lit < -0.2 ? BR[4] : lit < 0.5 ? BR[3] : BR[2];
      if (y > 12) c = y === 13 ? BR[4] : BR[2]; // the collar
      if (vnoise(x + X, y + Y, 3, 7) > 0.74) c = mix(c, '#4a9a8a', 0.5); // verdigris
      b.set(x, y, c, 'brass');
    }
    for (let y = 4; y < 11; y += 1) for (let x = 4; x < 12; x += 1) if (inEll(x, y, 8, 7.5, 3.6, 3.4)) b.set(x, y, inEll(x, y, 8, 7.5, 2.6, 2.4) ? (y < 6 ? '#3a6a8a' : '#1e3a5a') : BR[1], 'brass');
    grid((x, y, c) => b.set(x, y, c, 'fish'), 6, 7, ['ooo', 'oWo'], { o: '#ffd040', W: '#1a1a2a' });
    [[14, 6], [1, 9]].forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'brass'), x - 1, y - 1, ['.b.', 'bBb', '.b.'], { b: BR[1], B: BR[4] }));
    for (let x = 0; x < 18; x += 1) for (let y = 15; y < 18; y += 1) if (y > 15 + Math.abs(x - 9) * 0.12) b.set(x, y, y === 16 ? PS[5] : PS[4], 'sand');
  }, { outline: (t, side) => (t === 'fish' ? null : t === 'sand' ? (side === 'bottom' ? SF[3] : null) : side === 'bottom' ? INK : side === 'right' ? BR[0] : BR[1]) });
}

/** A mermaid statue, 24 x 40, of old pale stone, sitting on a rock: a shell held up high, her tail green with weed. */
export function mermaidB(px, X, Y) {
  groundShadow(px, X + 12, Y + 38, 11, 2.4, 0.26);
  const tl = mix(ST[4], '#3a9a80', 0.4); const TL = mix(ST[5], '#5ac8a0', 0.35); const td = mix(ST[3], '#2a7a6a', 0.4);
  propB(px, X, Y, 24, 40, (b) => {
    // the rock she sits on
    for (let y = 25; y < 40; y += 1) for (let x = 0; x < 24; x += 1) {
      if (!inEll(x, y, 12, 32.5, 11.5, 7.5) || y > 38) continue;
      const lit = (x + 0.5 - 12) / 11.5 + (y + 0.5 - 30) / 7.5;
      b.set(x, y, lit < -0.6 ? RK[5] : lit < 0.2 ? RK[4] : lit < 0.9 ? RK[3] : RK[2], 'rock');
    }
    grid((x, y, c) => b.set(x, y, c, 'stone'), 2, 0, [
      '.........ss.........',
      '........sSss........',
      '........ssss........',
      '.........ff.........',
      '.........f..........',
      '.....hhh.f..........',
      '....hHHHhf..........',
      '...hHffffh..........',
      '...hfFffff..........',
      '...hffffff..........',
      '...hhffff...........',
      '..hhh.ffbb..........',
      '..hh.fbbbbb.........',
      '..hh.bbbbbbf........',
      '..h..bBbbbbf........',
      '.....bbbbbbf........',
      '.....bbbbBb.........',
      '.....tTtttt.........',
      '.....tTttttt........',
      '....ttTtttttt.......',
      '....tTtttttttd......',
      '.....ttttttttttd..TT',
      '.......ttttttttdTTTt',
      '..........tttttTttd.',
      '...............ttT..',
    ], { s: '#f0a8c0', S: '#ffe0ea', h: ST[3], H: ST[4], f: ST[5], F: ST[6], b: ST[5], B: ST[4], t: tl, T: TL, d: td });
    // the shell is pink, her scales show on the tail, a little weed and a starfish on the rock
    for (let y = 0; y < 3; y += 1) for (let x = 10; x < 15; x += 1) if (b.get(x, y) === '#f0a8c0' || b.get(x, y) === '#ffe0ea') b.set(x, y, b.get(x, y), 'shell');
    [[9, 19], [11, 20], [10, 22], [13, 22], [15, 23]].forEach(([x, y]) => { if (b.get(x, y) === tl) b.set(x, y, td, 'stone'); });
    b.set(6, 8, ST[2], 'stone'); // her eye
    grid((x, y, c) => b.set(x, y, c, 'weed'), 2, 26, ['k..', 'k.k', '.kk', '..k'], { k: KP[4] });
    grid((x, y, c) => b.set(x, y, c, 'weed'), 16, 30, ['.o.', 'oOo', 'o.o'], { o: '#ff8a4a', O: '#ffd0a0' });
  }, { outline: (t, side) => (t === 'weed' ? null : t === 'shell' ? '#b06a88' : sel(t, side)) });
}

/** A sunken rowboat, 40 x 18, half full of sand, an oar beside it, a starfish on its side. */
export function sunkboatB(px, X, Y) {
  groundShadow(px, X + 21, Y + 15, 19, 2.6, 0.26);
  const WD = ['#2a2440', '#463a54', '#6a5468', '#8a7078', '#a88e8a', '#c8b0a0'];
  propB(px, X, Y, 40, 18, (b) => {
    for (let y = 2; y < 16; y += 1) for (let x = 0; x < 40; x += 1) {
      const u = (x + 0.5 - 20) / 20; const top = 4 + Math.round(u * u * -2) + Math.round((x / 40) * 2); const bot = 15 - Math.round(u * u * 7);
      if (y < top || y > bot) continue;
      let c;
      if (y <= top + 1) c = y === top ? WD[5] : WD[3];
      else if (y < top + 5 && Math.abs(u) < 0.8) c = y === top + 2 ? PS[5] : PS[4]; // sand inside
      else c = (y - top) % 3 === 0 ? WD[1] : y > bot - 2 ? WD[2] : WD[3];
      if (c !== PS[5] && c !== PS[4] && vnoise(x + X, y, 4, 3) > 0.7) c = mix(c, '#4a8a6a', 0.4);
      b.set(x, y, c, 'wood');
    }
    for (let k = 0; k < 18; k += 1) b.set(22 + k, 1 + Math.round(k * 0.18), WD[4], 'wood'); // an oar
    grid((x, y, c) => b.set(x, y, c, 'star'), 9, 8, ['..o..', 'ooOoo', '.o.o.'], { o: '#ff8a4a', O: '#ffd0a0' });
  }, { outline: (t, side) => (t === 'star' ? null : side === 'bottom' ? INK : side === 'right' ? WD[0] : WD[1]) });
}

/** An old lost boot, 16 x 13, with a little crab living in it. */
export function bootB(px, X, Y) {
  groundShadow(px, X + 8, Y + 12, 7, 1.6, 0.24);
  propB(px, X, Y, 16, 13, (b) => {
    grid((x, y, c) => b.set(x, y, c, 'wood'), 2, 0, [
      'rrrrrr.....',
      'lbbbbb.....',
      'lbbbbb.....',
      'lbbbbb.....',
      'lbbbbbb....',
      'lbbbbbbbbb.',
      'lbbbbbbbbbb',
      'lbbbbbbbbbb',
      'sssssssssss',
    ], { r: '#5a3a3a', l: '#9a6a5a', b: '#7a4e48', s: '#3a2a30' });
    grid((x, y, c) => b.set(x, y, c, 'crab'), 2, -3, ['c.c..', 'C.C..', 'rrrr.', 'rRRr.'], { c: '#ffffff', C: '#1a1a2a', r: '#e8504a', R: '#ff8a6a' });
    b.set(1, -1, '#e8504a', 'crab'); b.set(6, -1, '#e8504a', 'crab');
  }, { outline: (t, side) => (t === 'crab' ? (side === 'bottom' ? null : '#a8303a') : side === 'bottom' ? INK : '#3a2430') });
}

/** Sea urchins, 12 x 7: spiky purple balls in a little cluster. */
export function urchinsB(px, X, Y) {
  px(X + 1, Y + 6, 'rgba(20,32,56,0.25)', 11, 1);
  [[3, 3, 3], [8, 4, 2.4]].forEach(([cx, cy, r]) => {
    for (let a = 0; a < 16; a += 1) { const t = (a / 16) * Math.PI * 2; px(Math.round(X + cx + Math.cos(t) * (r + 1.6)), Math.round(Y + cy + Math.sin(t) * (r + 1.2)), '#5a3a8a'); }
    for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) if (x * x + y * y <= r * r) px(X + cx + x, Y + cy + y, x + y < -1 ? '#a87ad8' : '#6a4aa0');
  });
}

/** A seahorse, 8 x 14, curled tail, little fin. */
export function seahorseB(px, X, Y) {
  grid(px, X, Y, [
    '..yyy...',
    '.yYyyyy.',
    '.yykyy..',
    '..yyy...',
    '..yyyf..',
    '..yYyff.',
    '..yyyf..',
    '...yyy..',
    '...yYy..',
    '....yy..',
    '.yy.yy..',
    'y..yy...',
    '.yy.....',
  ], { y: '#ffb84a', Y: '#ffe090', k: '#1a1a2a', f: '#ffd8a0' });
}

/** A vent in the sea floor, 16 x 12: a little chimney of rock with a stream of bubbles. */
export function seaventB(px, X, Y) {
  groundShadow(px, X + 8, Y + 11, 7, 1.6, 0.24);
  propB(px, X, Y, 16, 12, (b) => {
    for (let y = 2; y < 12; y += 1) for (let x = 0; x < 16; x += 1) {
      const half = 3 + (y - 2) * 0.5;
      if (Math.abs(x + 0.5 - 8) > half) continue;
      const u = (x + 0.5 - 8) / half;
      b.set(x, y, y < 4 ? (Math.abs(u) < 0.5 ? '#2a1e3a' : RK[5]) : u < -0.3 ? RK[5] : u > 0.4 ? RK[3] : RK[4], 'rock');
    }
    grid((x, y, c) => b.set(x, y, c, 'weed'), 11, 6, ['.o', 'oO'], { o: '#ffd040', O: '#fff0a0' });
  }, { outline: sel });
  [[8, -3, 2], [9, -8, 1], [7, -12, 2], [8, -17, 1], [9, -21, 1]].forEach(([dx, dy, r]) => {
    const bx = X + dx; const by = Y + dy;
    if (r > 1) { px(bx, by - 1, 'rgba(220,250,255,0.75)'); px(bx - 1, by, 'rgba(220,250,255,0.75)'); px(bx + 1, by, 'rgba(160,220,240,0.6)'); px(bx, by + 1, 'rgba(160,220,240,0.6)'); px(bx - 1, by - 1, '#ffffff'); }
    else px(bx, by, 'rgba(230,250,255,0.85)');
  });
}

// ---------- the whole village ----------

/**
 * Paints the ocean map's village in style B. opts: { homeRoof: the kid's color, areas: the green's
 * ponds and play patches }. lib: { waterDepth, PROPS } from villageprops.js (passed in so the two
 * files don't import each other).
 */
export function paintOcean(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 3307;
  const PROPS = lib.PROPS || {};
  const depth = lib.waterDepth;

  floorB(px, L, seed);
  L.water.forEach((wa) => canyonB(px, L, wa, depth, seed + 60));
  pathsB(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plazaB(px, x, y, r, seed + 40 + i));
  (opts.areas || []).forEach((a, i) => (a.kind === 'pond' ? blueHoleB(px, a, seed + 70 + i) : courtO(px, a, a.kind, seed + 70 + i)));
  L.crossings.forEach((c) => bridgeV(px, c));
  scatterO(px, L, opts.areas || [], seed + 90);

  const DRAW = {
    kelp: (p) => kelpB(px, p.x, p.y),
    coral: (p) => coralB(px, p.x, p.y, p.c),
    clam: (p) => clamB(px, p.x, p.y),
    anchor: (p) => anchorB(px, p.x, p.y),
    rock: (p) => rockO(px, p.x, p.y, p.w || 22, p.h || 16),
    stall: (p) => stallO(px, p.x, p.y, p.pal),
    laundry: (p) => laundryB(px, p.x, p.y, p.w || 84),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  L.props.filter((p) => PROPS[p.kind]?.flat).forEach(draw);
  const home = L.home;
  const looks = [{ door: '#e8803a', seed: 21 }, { door: '#9a5ad8', seed: 33 }, { door: '#c8a020', seed: 47 }];
  const things = [
    { y: home.y + home.h, draw: () => domeB(px, home.x, home.y, home.w, home.h, { home: true, glass: opts.homeRoof || '#e03131', door: opts.homeRoof || '#e03131', seed: 11 }) },
    ...L.houses.map((hs, i) => ({ y: hs.y + hs.h, draw: () => domeB(px, hs.x, hs.y, hs.w, hs.h, { glass: hs.roof, sign: hs.sign, ...looks[i % looks.length] }) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
