// Pictures for the dino dig (dig.js): each map's dig site seen from above (ground, the cliff
// with its rock layers, scree, the creek, rocks, trees and landmarks), holes, the shovels,
// and every find (bones, skulls, treasures). Sites are painted with Z fine pixels per game
// pixel, like the fishing lake.
import { pixelBuffer, Buf, ramp, mix, vnoise, h2, bayer } from './pixelkit.js';
import { findInfo, DINOS } from './digfinds.js';

const INK = '#1b1430';
const TIDE = 16; // how far the tide goes out on the beach (dig.js TIDE_OUT)
const doc = () => globalThis.document;
function canvas(w, h) { const c = doc().createElement('canvas'); c.width = Math.max(1, Math.ceil(w)); c.height = Math.max(1, Math.ceil(h)); return c; }
function bufCanvas(b) {
  const c = canvas(b.W, b.H); const x = c.getContext('2d');
  b.each((px, py) => { const col = b.get(px, py); if (col) { x.fillStyle = col; x.fillRect(px + b.pad, py + b.pad, 1, 1); } });
  return c;
}

// ---------- each map's look ----------
// ground: 3 tones (dark, mid, light); cliff: the rock face's layers top to bottom; lip: the
// plateau on top; dirt: what a hole shows; layers: the 5 dig depths; rock; creek; bits: tiny
// things on the ground.
export const SITE_LOOKS = {
  'bg-meadow': {
    ground: ['#4f8f3f', '#5fa84a', '#76bd58'], lip: ['#5fa84a', '#86c766'], cliff: ['#c9956a', '#b07850', '#d9ad7c', '#9c6544', '#c08a5c', '#8a5638'],
    dirt: ['#5c3a1e', '#8b5a2b'], layers: ['#8b5a2b', '#7a4a26', '#a0662e', '#6e4a3a', '#594038'], rock: '#9a978e', creek: ['#d8c49a', '#c2ab7e', '#a78f63'],
    bits: ['#ffd43b', '#ffffff', '#f783ac', '#3d7a30'], soft: true,
  },
  'bg-castle': {
    ground: ['#46804a', '#559458', '#6aa968'], lip: ['#559458', '#7cb877'], cliff: ['#9aa0a6', '#868c94', '#adb3b8', '#787e86', '#9298a0', '#6a7078'],
    dirt: ['#4a3626', '#6e5038'], layers: ['#6e5038', '#5e4636', '#7a6a5a', '#545a60', '#44484e'], rock: '#8e9096', creek: ['#c9bfa8', '#b0a68e', '#958b74'],
    bits: ['#ffffff', '#ffd43b', '#9775fa', '#2f6a34'], wall: true,
  },
  'bg-sunset': {
    ground: ['#d9b57a', '#e8c98e', '#f4dcaa'], lip: ['#e8c98e', '#f4dcaa'], cliff: ['#e08850', '#c96a3a', '#eea468', '#b0552e', '#d97c48', '#9a4a2a'],
    dirt: ['#a8814a', '#c9a066'], layers: ['#c9a066', '#b88c56', '#a87a4a', '#966a40', '#7e5a38'], rock: '#b8a68e', creek: ['#c9a066', '#b88c56', '#a87a4a'],
    bits: ['#ffffff', '#ffa8a8', '#ffd8a8', '#e8590c'], soft: true, sea: ['#2b8fcf', '#4dabf7', '#a5d8ff'],
  },
  'bg-ocean': {
    ground: ['#b8ae86', '#cdc298', '#ddd3ac'], lip: ['#7a5ca8', '#9a78c8'], cliff: ['#a061b8', '#8a4ea2', '#c07ad4', '#784490', '#e07898', '#6a3a80'],
    dirt: ['#8e8460', '#a89c74'], layers: ['#a89c74', '#968a64', '#7e7458', '#6a6250', '#585446'], rock: '#8a8e9e', creek: ['#bfb48c', '#aaa078', '#948a66'],
    bits: ['#ff8787', '#ffffff', '#ffd43b', '#e599f7'], soft: true, tint: 'rgba(40,120,200,0.18)', under: true,
  },
  'bg-volcano': {
    ground: ['#4a3e3c', '#5a4c48', '#6e605a'], lip: ['#3a8a3a', '#56a84a'], cliff: ['#3a3034', '#2a2226', '#4a3e42', '#c2410c', '#36292c', '#221a1e'],
    dirt: ['#2a2226', '#4a3a36'], layers: ['#4a3a36', '#5a3a30', '#7a3a24', '#a84420', '#d9531e'], rock: '#3e3638', creek: ['#ff922b', '#e8590c', '#ffd43b'],
    bits: ['#868e96', '#ff922b', '#adb5bd', '#2a2226'],
  },
  'bg-rainforest': {
    ground: ['#2f6a30', '#3a7d38', '#4c9446'], lip: ['#2f6a30', '#4c9446'], cliff: ['#6a7a50', '#5a6a42', '#7e8e5e', '#4e5a38', '#3a7d38', '#40482e'],
    dirt: ['#4a2e1a', '#6e4428'], layers: ['#6e4428', '#7a3e22', '#8a4a26', '#6a3a2a', '#523026'], rock: '#7e8478', creek: ['#4aa3c9', '#3a8ab0', '#8ad0e8'],
    bits: ['#ff6b6b', '#ffd43b', '#da77f2', '#1e4a20'],
  },
  'bg-fjord': {
    ground: ['#c8d4d8', '#dde6ea', '#f1f5f7'], lip: ['#dde6ea', '#ffffff'], cliff: ['#7e8a94', '#6a7680', '#949ea8', '#5a646e', '#8a96a0', '#4e5862'],
    dirt: ['#5a4a3e', '#7a6656'], layers: ['#7a6656', '#6a5a4e', '#8aa4b4', '#5e6e7a', '#4a5660'], rock: '#7c848c', creek: ['#5aa8d8', '#3a88c0', '#b8e0f4'],
    bits: ['#ffffff', '#a5d8ff', '#6a7680', '#d0ebff'],
  },
  'bg-space': {
    ground: ['#8a8e94', '#9ea3a8', '#b6babe'], lip: ['#9ea3a8', '#c6cacd'], cliff: ['#7a7e84', '#6a6e74', '#8e9298', '#5a5e64', '#80848a', '#4e5258'],
    dirt: ['#5a5e64', '#74787e'], layers: ['#74787e', '#686c72', '#5c6066', '#50545a', '#44484e'], rock: '#7a7e84', creek: ['#7a7e84', '#6a6e74', '#8e9298'],
    bits: ['#ced4da', '#6a6e74', '#ffffff', '#adb5bd'], sky: true,
  },
  'bg-rainbow': {
    ground: ['#d9b8e8', '#e8cdf4', '#f6e4fb'], lip: ['#a9e34b', '#c0eb75'], cliff: ['#ff8787', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#9775fa'],
    dirt: ['#b07ac8', '#c99ad8'], layers: ['#ff8787', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7'], rock: '#c0a8d8', creek: ['#a5d8ff', '#ffc9c9', '#fff3bf'],
    bits: ['#ffffff', '#ffd43b', '#ff8787', '#66d9e8'], soft: true,
  },
  'bg-galaxy': {
    ground: ['#2a1d4a', '#36265e', '#46327a'], lip: ['#46327a', '#5e44a0'], cliff: ['#e0b23a', '#c8962a', '#f0cc5a', '#a87820', '#d8a634', '#8a6018'],
    dirt: ['#1a1230', '#2a1d4a'], layers: ['#2a1d4a', '#3a2466', '#4a2a80', '#5a3096', '#ffd43b'], rock: '#5e4a8a', creek: ['#ffd43b', '#f0b429', '#fff3bf'],
    bits: ['#ffffff', '#ffd43b', '#b197fc', '#fff3bf'],
  },
};

// ---------- the site ----------
/** Paint the flat part of a site (ground, cliff, creek, scree, decals) into a canvas. */
export function paintSite(look, L, W, H, Z, seed = 1) {
  const FW = W * Z; const FH = H * Z;
  const { px, put } = pixelBuffer(FW, FH);
  const g = look.ground;
  // the ground: soft patches of three tones, dithered where they meet
  for (let y = 0; y < FH; y += 1) {
    for (let x = 0; x < FW; x += 1) {
      const n = vnoise(x, y, 22, seed) * 0.7 + vnoise(x, y, 7, seed + 1) * 0.3;
      const k = n + (bayer(x, y) - 0.5) * 0.16;
      px(x, y, k < 0.38 ? g[0] : k < 0.68 ? g[1] : g[2]);
    }
  }
  // grass tufts and speckles
  for (let k = 0; k < (FW * FH) / 180; k += 1) {
    const x = Math.floor(h2(k, 1, seed) * FW); const y = Math.floor(h2(k, 2, seed) * FH);
    const c = h2(k, 3, seed) < 0.5 ? g[0] : g[2];
    px(x, y, c); px(x + 1, y - 1, c); if (h2(k, 4, seed) < 0.4) px(x - 1, y - 1, c);
  }
  // decals that lie under everything: the path, scree, pools, craters, vents
  for (const d of L.decals) paintDecal(px, look, L, d, Z, seed, W);
  // the creek (dry: a sandy wash with pebbles; water / lava: a running stream)
  if (L.creek) paintCreek(px, look, L, Z, seed);
  // the cliff along the top: plateau, then the rock face with its layers, then its shadow
  const C = look.cliff;
  for (let x = 0; x < FW; x += 1) {
    const foot = L.top(x / Z) * Z; const faceH = 22 * Z + Math.round(vnoise(x, 0, 30, seed) * 6 * Z);
    const lipY = foot - faceH;
    for (let y = 0; y < foot && y < FH; y += 1) {
      if (y < lipY) {
        // the plateau on top
        const n = vnoise(x, y, 10, seed + 3);
        px(x, y, n < 0.55 ? look.lip[0] : look.lip[1]);
      } else if (y < lipY + Z) {
        px(x, y, mix(look.lip[1], '#ffffff', 0.25));
      } else {
        // the face: wavy horizontal rock layers (the layers bones come out of)
        const depth = (y - lipY) / faceH;
        const wav = Math.sin(x / (13 * Z) + seed) * 2 * Z + vnoise(x, y, 18, seed + 5) * 3 * Z;
        const band = Math.floor(((y - lipY + wav) / (faceH + 6 * Z)) * 6);
        let c = C[Math.max(0, Math.min(5, band))];
        if (look.wall) {
          // castle: stone blocks in rows
          const row = Math.floor((y - lipY) / (5 * Z)); const off = row % 2 ? 4 * Z : 0;
          if ((y - lipY) % (5 * Z) === 0 || ((x + off) % (9 * Z)) === 0) c = C[5];
        }
        // cracks and lit tops of ledges
        if (vnoise(x, y, 5, seed + 7) > 0.82) c = mix(c, INK, 0.3);
        if (depth > 0.86) c = mix(c, INK, 0.25 + (depth - 0.86) * 2);
        px(x, y, c);
      }
    }
    // a soft shadow on the ground at the foot of the cliff
    for (let y = foot; y < foot + 3 * Z; y += 1) if (bayer(x, y) < 0.6 - (y - foot) / (6 * Z)) px(x, y, mix(g[0], INK, 0.35));
  }
  // the sea along the bottom (the beach)
  if (L.bottom && look.sea) {
    for (let x = 0; x < FW; x += 1) {
      // wet sand where the tide will go out, then the sea for good
      const b0 = L.bottom(x / Z) * Z;
      for (let y = b0 - 10 * Z; y < b0 + TIDE * Z; y += 1) if (y >= b0 - 6 * Z || bayer(x, y) < 0.5) px(x, y, vnoise(x, y, 8, seed) > 0.62 ? mix(look.ground[0], '#7a5a30', 0.35) : mix(look.ground[0], '#7a5a30', 0.22));
      const b = b0 + TIDE * Z;
      for (let y = b; y < FH; y += 1) {
        const d = y - b;
        px(x, y, d < 2 * Z ? mix(look.ground[2], '#ffffff', 0.4) : d < 6 * Z ? look.sea[2] : d < 12 * Z ? look.sea[1] : look.sea[0]);
        if (d >= 6 * Z && vnoise(x, y, 9, seed + 9) > 0.78) px(x, y, look.sea[2]);
      }
      // wet sand
      for (let y = b - 4 * Z; y < b; y += 1) if (bayer(x, y) < 0.35) px(x, y, mix(look.ground[0], '#8a6a40', 0.25));
    }
  }
  // under the sea: everything a little blue, with light ripples
  if (look.tint) {
    for (let y = 0; y < FH; y += 1) for (let x = 0; x < FW; x += 1) {
      const rip = vnoise(x + y * 0.4, y, 16, seed + 11);
      px(x, y, rip > 0.72 ? 'rgba(200,240,255,0.22)' : look.tint);
    }
  }
  const c = canvas(FW, FH); put(c.getContext('2d'));
  return c;
}

function paintCreek(px, look, L, Z, seed) {
  const cr = look.creek; const wet = L.kind.creek === 'water' || L.kind.creek === 'lava';
  const pts = L.creek;
  for (let k = 0; k < pts.length - 1; k += 1) {
    const [x0, y0] = pts[k]; const [x1, y1] = pts[k + 1];
    for (let s = 0; s <= 6; s += 1) {
      const x = (x0 + ((x1 - x0) * s) / 6) * Z; const y = (y0 + ((y1 - y0) * s) / 6) * Z;
      const w = (wet ? 5 : 6) * Z;
      for (let dx = -w - Z; dx <= w + Z; dx += 1) {
        const edge = Math.abs(dx) > w;
        const xx = Math.round(x + dx);
        for (let dy = 0; dy < Z * 1; dy += 1) {
          if (edge) { px(xx, y + dy, mix(look.ground[0], INK, 0.25)); continue; }
          const n = vnoise(xx, y + dy, 6, seed + 13);
          const flow = wet && Math.sin((y + dy) / (3 * Z) + xx / (5 * Z)) > 0.7;
          px(xx, y + dy, flow ? cr[2] : n < 0.5 ? cr[0] : cr[1]);
        }
      }
    }
  }
  // pebbles in a dry wash
  if (!wet) for (let k = 0; k < pts.length; k += 1) {
    const [x, y] = pts[k];
    for (let q = 0; q < 2; q += 1) {
      const ox = (h2(k, q, seed) - 0.5) * 9; const oy = h2(k, q + 5, seed) * 6;
      const X = Math.round((x + ox) * Z); const Y = Math.round((y + oy) * Z);
      px(X, Y, cr[2], 2, 1); px(X, Y - 1, mix(cr[0], '#ffffff', 0.4), 2, 1);
    }
  }
}

function paintDecal(px, look, L, d, Z, seed, W) {
  const g = look.ground;
  if (d.type === 'scree') {
    // a fan of loose stones fallen from the cliff, thick near the foot
    for (let k = 0; k < 150; k += 1) {
      const a = 0.15 + h2(k, 1, d.x) * (Math.PI - 0.3); const rr = h2(k, 2, d.x) ** 0.7;
      const x = d.x + Math.cos(a) * rr * d.w * 0.55; const y = L.top(d.x) + 1 + Math.sin(a) * rr * d.h;
      const X = Math.round(x * Z); const Y = Math.round(y * Z);
      const c = look.cliff[[0, 2, 4][k % 3]]; const w = 2 + (k % 3);
      px(X - 1, Y - 2, INK, w + 2, 4); px(X, Y - 1, mix(c, INK, 0.3), w, 2); px(X, Y - 1, c, w, 1); px(X, Y - 1, mix(c, '#ffffff', 0.35), 1, 1);
    }
  } else if (d.type === 'path') {
    for (let x = 0; x < W * Z; x += 1) {
      const y = (d.y + 4 * Math.sin(x / Z / 31 + d.ph)) * Z;
      for (let dy = -3 * Z; dy <= 3 * Z; dy += 1) {
        const e = Math.abs(dy) > 2 * Z;
        if (e && bayer(x, y + dy) > 0.5) continue;
        px(x, y + dy, e ? mix(g[0], look.dirt[1], 0.5) : vnoise(x, y + dy, 4, seed) > 0.6 ? mix(look.dirt[1], '#ffffff', 0.3) : mix(look.dirt[1], g[1], 0.35));
      }
    }
  } else if (d.type === 'pool' || d.type === 'crater') {
    const rx = (d.w / 2) * Z; const ry = (d.h / 2) * Z;
    for (let y = -ry - Z; y <= ry + Z; y += 1) for (let x = -rx - Z; x <= rx + Z; x += 1) {
      const e = (x / rx) ** 2 + (y / ry) ** 2;
      const X = Math.round(d.x * Z + x); const Y = Math.round(d.y * Z + y);
      if (d.type === 'pool') {
        if (e > 1.25) continue;
        px(X, Y, e > 1 ? look.rock : e > 0.75 ? '#4dabf7' : (vnoise(X, Y, 5, seed) > 0.7 ? '#a5d8ff' : '#339af0'));
      } else {
        if (e > 1.3) continue;
        // a crater: a raised lit rim, a shaded bowl
        const lit = y < 0;
        px(X, Y, e > 1 ? mix(g[2], '#ffffff', 0.25) : e > 0.8 ? (lit ? mix(g[0], INK, 0.3) : g[2]) : (lit ? mix(g[0], INK, 0.15) : g[1]));
      }
    }
  } else if (d.type === 'vent') {
    // a steaming crack in the ground, glowing inside
    for (let k = -6; k <= 6; k += 1) {
      const X = Math.round((d.x + k) * Z); const Y = Math.round((d.y + Math.sin(k * 1.3) * 1.2) * Z);
      px(X, Y, INK, Z, Z * 2); if (Math.abs(k) < 4) px(X, Y + Z * 0.5, '#ff922b', Z, Z);
    }
  } else if (d.type === 'fords') {
    for (const [x, y] of d.at) for (let q = -1; q <= 1; q += 1) {
      const X = Math.round((x + q * 4) * Z); const Y = Math.round((y + q) * Z);
      px(X - Z, Y, mix(look.rock, INK, 0.3), 4 * Z, 2 * Z); px(X - Z, Y - Z, look.rock, 4 * Z, Z * 1.5); px(X, Y - Z, mix(look.rock, '#ffffff', 0.35), Z, Z * 0.5);
    }
  } else if (d.type === 'molehill') {
    // a little heap of fresh dark crumbly dirt
    const rx = 6 * Z; const ry = 4 * Z;
    for (let y = -ry - Z; y <= ry; y += 1) for (let x = -rx - Z; x <= rx + Z; x += 1) {
      const e = (x / rx) ** 2 + (y / ry) ** 2;
      const X = Math.round(d.x * Z + x); const Y = Math.round(d.y * Z + y);
      if (e > 1.25) continue;
      if (e > 1) { if (y > 0) px(X, Y, mix(look.ground[0], INK, 0.35)); continue; }
      const lit = (x + rx * 0.4) ** 2 / (rx * rx) + (y + ry * 0.5) ** 2 / (ry * ry) < 0.35;
      const crumb = h2(X >> 1, Y >> 1, 3) > 0.72;
      px(X, Y, lit ? mix(look.dirt[1], '#ffffff', crumb ? 0.35 : 0.15) : crumb ? look.dirt[0] : y > ry * 0.3 ? mix(look.dirt[1], INK, 0.25) : look.dirt[1]);
    }
  } else if (d.type === 'thaw') {
    // a sun-thawed dark patch in the frozen ground
    const rx = (d.w / 2) * Z; const ry = (d.h / 2) * Z;
    for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) {
      const e = (x / rx) ** 2 + (y / ry) ** 2 + (vnoise(x, y, 6, seed) - 0.5) * 0.5; if (e > 1) continue;
      const X = Math.round(d.x * Z + x); const Y = Math.round(d.y * Z + y);
      if (e > 0.85 && bayer(X, Y) > 0.5) continue;
      px(X, Y, vnoise(X, Y, 4, seed + 2) > 0.55 ? '#7a8a5a' : '#6a6050');
    }
  } else if (d.type === 'hot') {
    // hot ground: dark crusted rock with glowing cracks
    const rx = (d.w / 2) * Z; const ry = (d.h / 2) * Z;
    for (let y = -ry; y <= ry; y += 1) for (let x = -rx; x <= rx; x += 1) {
      const e = (x / rx) ** 2 + (y / ry) ** 2 + (vnoise(x, y, 7, seed) - 0.5) * 0.4; if (e > 1) continue;
      const X = Math.round(d.x * Z + x); const Y = Math.round(d.y * Z + y);
      const crack = Math.abs(vnoise(X, Y, 9, seed + 4) - 0.5) < 0.035;
      px(X, Y, crack ? (e < 0.6 ? '#ffd43b' : '#ff922b') : e > 0.8 ? mix(look.ground[0], '#7a2a10', 0.3) : mix(look.ground[0], '#a8401a', 0.22 + (1 - e) * 0.2));
    }
  } else if (d.type === 'flag') {
    // the castle path's one odd flagstone (a cellar under it)
    const X = Math.round((d.x - 6) * Z); const Y = Math.round((d.y - 4) * Z);
    px(X - Z, Y - Z, INK, 14 * Z, 10 * Z);
    px(X, Y, '#b8a07a', 12 * Z, 8 * Z); px(X, Y, '#d8c49a', 12 * Z, Z); px(X, Y, '#d8c49a', Z, 8 * Z);
    px(X + 10 * Z, Y + 2 * Z, '#8a7450', 2 * Z, 6 * Z);
    px(X + 4 * Z, Y + 3 * Z, '#5c4630', 4 * Z, Z); px(X + 5 * Z, Y + 2 * Z, '#5c4630', 2 * Z, 3 * Z); // a little iron ring
  } else if (d.type === 'bit') {
    const X = Math.round(d.x * Z); const Y = Math.round(d.y * Z);
    const c = look.bits[d.v];
    if (d.v < 2) { px(X, Y, c); px(X + 1, Y, c); px(X, Y + 1, c); px(X + 1, Y + 1, c); px(X + Z, Y - 1, mix(c, '#ffffff', 0.5)); } else { px(X, Y, c, 2, 1); px(X + 1, Y - 1, c); }
  }
}

// ---------- things that stand up (drawn in y order with the buddies) ----------
const propCache = new Map();
/** A prop's picture (fine pixels) and where its foot is in it: { pic, fx, fy }. */
export function propPic(look, p, Z = 2) {
  const key = `${look.cliff[0]}|${p.type}|${p.v}|${p.s.toFixed(2)}|${p.crystal ? 1 : 0}`;
  if (propCache.has(key)) return propCache.get(key);
  const out = drawProp(look, p, Z);
  propCache.set(key, out);
  return out;
}

function drawProp(look, p, Z) {
  const s = p.s * Z;
  const b = new Buf(Math.ceil(60 * Z), Math.ceil(64 * Z), 2);
  let fx = 30 * Z; let fy = 60 * Z; // the foot
  const ell = (cx, cy, rx, ry, fn, t) => b.fill(Math.floor(cx - rx), Math.floor(cy - ry), Math.ceil(rx * 2) + 1, Math.ceil(ry * 2) + 1, (x, y) => (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1 ? fn(x, y) : null), t);
  if (p.type === 'rock') {
    const R = ramp(look.rock, 3, 2);
    const rx = 6 * s; const ry = 4.6 * s;
    ell(fx, fy - ry, rx, ry, (x, y) => {
      const lx = (x - (fx - rx * 0.3)) / rx; const ly = (y - (fy - ry * 1.5)) / ry;
      const l = 1 - Math.hypot(lx, ly);
      const n = vnoise(x, y, 3 * Z, p.v);
      return l > 0.55 ? R[4] : l > 0.2 ? (n > 0.6 ? R[2] : R[3]) : l > -0.2 ? R[2] : R[1];
    }, 'rock');
    if (p.crystal) {
      // crystals poking out of the outcrop's middle rock
      const cc = ['#b197fc', '#e5dbff', '#7950f2'];
      for (let q = -1; q <= 1; q += 1) {
        const x0 = fx + q * 2.5 * Z; const hh = (5 - Math.abs(q) * 1.5) * Z;
        for (let y = 0; y < hh; y += 1) for (let x = -Z; x < Z; x += 1) b.set(x0 + x, fy - ry * 1.6 - y, x < 0 ? cc[1] : cc[0], 'gem');
        b.set(x0, fy - ry * 1.6 - hh, cc[1], 'gem');
      }
    }
    b.outline((t) => (t === 'gem' ? '#5f3dc4' : INK));
  } else if (p.type === 'oak' || p.type === 'pine' || p.type === 'spruce' || p.type === 'palm' || p.type === 'kapok' || p.type === 'lolly' || p.type === 'crystal' || p.type === 'kelp') {
    drawTree(b, look, p, fx, fy, s, Z, ell);
  } else if (p.type === 'ruin') {
    // broken pillars and a bit of wall
    const R = ramp('#a8aeb4', 3, 2);
    const cols = p.v === 0 ? [[-9, 18], [0, 11], [9, 15]] : p.v === 1 ? [[-8, 9], [6, 20]] : [[-10, 14], [-2, 7], [8, 12]];
    for (const [dx, hh] of cols) {
      const x0 = fx + dx * Z; const top = fy - hh * Z;
      b.rect(x0 - 3 * Z, top, 6 * Z, hh * Z, R[2], 'stone');
      b.rect(x0 - 3 * Z, top, 2 * Z, hh * Z, R[3], 'stone');
      b.rect(x0 + 2 * Z, top, Z, hh * Z, R[1], 'stone');
      for (let y = top + 4 * Z; y < fy; y += 5 * Z) b.rect(x0 - 3 * Z, y, 6 * Z, Math.max(1, Z / 2), R[1], 'stone');
      b.rect(x0 - 4 * Z, fy - 2 * Z, 8 * Z, 2 * Z, R[1], 'stone');
      // moss
      b.rect(x0 - 3 * Z, top, 3 * Z, Z, '#5c940d', 'moss');
    }
    b.outline(() => INK);
  } else if (p.type === 'wreck') {
    // a sunken rowboat, half buried in sand
    const R = ramp('#8b5a2b', 3, 2);
    ell(fx, fy - 5 * Z, 16 * Z, 6 * Z, (x, y) => (y < fy - 7 * Z ? R[1] : y < fy - 4 * Z ? R[3] : R[2]), 'wood');
    for (let x = fx - 13 * Z; x < fx + 13 * Z; x += 5 * Z) b.rect(x, fy - 11 * Z, Z, 8 * Z, R[0], 'wood');
    b.rect(fx + 3 * Z, fy - 22 * Z, Z * 1.5, 14 * Z, R[2], 'wood');
    b.outline(() => INK);
  } else if (p.type === 'lander') {
    // an old moon lander's leg and base (people leave things on the Moon too)
    const R = ramp('#c9a227', 2, 2);
    b.rect(fx - 8 * Z, fy - 14 * Z, 16 * Z, 8 * Z, R[2], 'gold');
    b.rect(fx - 8 * Z, fy - 14 * Z, 16 * Z, 2 * Z, R[3], 'gold');
    for (const dx of [-9, 8]) for (let y = 0; y < 8 * Z; y += 1) b.set(fx + dx * Z + Math.round(y / 3) * Math.sign(dx), fy - 6 * Z + y, '#adb5bd', 'leg');
    b.rect(fx + 2 * Z, fy - 26 * Z, Z, 12 * Z, '#dee2e6', 'pole');
    b.rect(fx + 3 * Z, fy - 26 * Z, 8 * Z, 5 * Z, '#ffffff', 'flag');
    b.rect(fx + 3 * Z, fy - 26 * Z, 3 * Z, 3 * Z, '#1c7ed6', 'flag');
    for (let y = 0; y < 2; y += 1) b.rect(fx + 6 * Z, fy - (24 - y * 2) * Z, 5 * Z, Z / 2, '#e03131', 'flag');
    b.outline(() => INK);
  } else if (p.type === 'glacier') {
    // the snout of a glacier spilling over the cliff: a blocky blue-white ice wall with cracks
    const R = ['#3a6a9a', '#5a90c0', '#8ec4ea', '#c4e4fa', '#f4fbff'];
    const hw = 26 * Z;
    for (let x = -hw; x <= hw; x += 1) {
      const top = fy - (24 * Z - Math.abs(x) * 0.25 - Math.round(Math.sin(x / (3 * Z)) * Z));
      const bot = fy - Math.round(Math.abs(Math.sin(x / (5 * Z))) * 2 * Z);
      for (let y = top; y <= bot; y += 1) {
        const d = (y - top) / Math.max(1, bot - top);
        const crack = ((x + Math.round(y * 0.35)) % (7 * Z) === 0 && d > 0.2) || (y - top) % (8 * Z) === 0;
        b.set(fx + x, y, crack ? R[1] : d < 0.12 ? R[4] : d < 0.45 ? R[3] : d < 0.8 ? R[2] : R[1], 'ice');
      }
    }
    // meltwater pooling at its foot
    for (let x = -hw + 4 * Z; x <= hw - 4 * Z; x += 1) b.set(fx + x, fy + Z, (x % (5 * Z)) < Z ? '#ffffff' : '#74c0fc', 'water');
    b.outline((t) => (t === 'water' ? null : '#1c3a5e'));
  }
  const pic = bufCanvas(b);
  return { pic, fx: fx + b.pad, fy: fy + b.pad };
}

function drawTree(b, look, p, fx, fy, s, Z, ell) {
  const t = p.type;
  const trunk = (w, h, c) => { const R = ramp(c, 2, 1); for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) b.set(fx - w / 2 + x, fy - y, x < w * 0.35 ? R[1] : x > w * 0.75 ? R[3] : R[2], 'trunk'); };
  const blob = (cx, cy, rx, ry, base, tag) => {
    const R = ramp(base, 3, 2);
    ell(cx, cy, rx, ry, (x, y) => {
      const l = 1 - Math.hypot((x - (cx - rx * 0.35)) / rx, (y - (cy - ry * 0.45)) / ry);
      const n = vnoise(x, y, 2.5 * Z, p.v * 7 + cx);
      const k = l + (n - 0.5) * 0.45;
      return k > 0.62 ? R[4] : k > 0.35 ? R[3] : k > 0.05 ? R[2] : R[1];
    }, tag);
  };
  if (t === 'oak') {
    trunk(4 * s, 10 * s, '#7a4a26');
    blob(fx, fy - 17 * s, 11 * s, 9 * s, ['#3e8a35', '#4a9a3a', '#2f7a2e'][p.v], 'leaf');
    blob(fx - 6 * s, fy - 13 * s, 6 * s, 5 * s, ['#3e8a35', '#4a9a3a', '#2f7a2e'][p.v], 'leaf');
    blob(fx + 6 * s, fy - 13 * s, 6 * s, 5 * s, ['#3e8a35', '#4a9a3a', '#2f7a2e'][p.v], 'leaf');
  } else if (t === 'pine' || t === 'spruce') {
    trunk(3 * s, 6 * s, '#6a4024');
    const base = t === 'pine' ? '#2b6a3a' : '#2a5a48';
    const R = ramp(base, 3, 2);
    for (let k = 0; k < 4; k += 1) {
      const w = (12 - k * 2.6) * s; const y0 = fy - (5 + k * 6) * s;
      for (let y = 0; y < 8 * s; y += 1) {
        const hw = (w * (y + 1)) / (8 * s);
        for (let x = -hw; x <= hw; x += 1) b.set(fx + x, y0 - 8 * s + y, x < -hw * 0.3 ? R[3] : x > hw * 0.5 ? R[1] : R[2], 'leaf');
      }
      if (t === 'spruce') for (let x = -w; x <= w; x += Z * 2) b.set(fx + x * 0.8, y0 - 8 * s + Z, '#ffffff', 'snow');
    }
  } else if (t === 'palm') {
    const R = ramp('#9a6a3a', 2, 1);
    for (let y = 0; y < 20 * s; y += 1) { const x = Math.round(Math.sin(y / (8 * s)) * 3 * s); for (let w = -1.5 * s; w < 1.5 * s; w += 1) b.set(fx + x + w, fy - y, (Math.floor(y / (2 * Z)) % 2 ? R[1] : R[2]), 'trunk'); }
    const top = [fx + Math.round(Math.sin(20 / 8) * 3 * s), fy - 20 * s];
    const G = ramp('#3a9a3a', 2, 2);
    for (const [ax, ay] of [[-1, 0.3], [1, 0.3], [-0.7, -0.5], [0.7, -0.5], [0, -0.8], [-1, 0.9], [1, 0.9]]) {
      for (let k = 0; k < 12 * s; k += 1) {
        const x = top[0] + ax * k; const y = top[1] + ay * k * 0.6 + (k * k) / (30 * s);
        b.set(x, y, G[3], 'leaf'); b.set(x, y + 1, G[2], 'leaf'); if (k % 3 === 0) b.set(x, y + 2, G[1], 'leaf');
      }
    }
    b.rect(top[0] - Z, top[1] + Z, 2 * Z, 2 * Z, '#6a4024', 'nut');
  } else if (t === 'kapok') {
    // a giant rainforest tree with buttress roots
    trunk(6 * s, 16 * s, '#8a6a4a');
    const R = ramp('#8a6a4a', 2, 1);
    for (const dir of [-1, 1]) for (let k = 0; k < 7 * s; k += 1) for (let y = 0; y < (7 * s - k) * 0.7; y += 1) b.set(fx + dir * (3 * s + k), fy - y, R[dir < 0 ? 2 : 1], 'trunk');
    blob(fx, fy - 26 * s, 15 * s, 10 * s, '#2b7a2b', 'leaf');
    blob(fx - 9 * s, fy - 20 * s, 8 * s, 6 * s, '#1e6a28', 'leaf');
    blob(fx + 9 * s, fy - 21 * s, 8 * s, 6 * s, '#368a30', 'leaf');
  } else if (t === 'lolly') {
    // a lollipop tree with a swirl
    const R = ramp('#ffffff', 1, 1);
    for (let y = 0; y < 12 * s; y += 1) for (let x = 0; x < 2 * Z; x += 1) b.set(fx - Z + x, fy - y, x ? R[0] : R[1], 'stick');
    const col = ['#ff8787', '#69db7c', '#4dabf7'][p.v];
    ell(fx, fy - 19 * s, 8 * s, 8 * s, (x, y) => {
      const a = Math.atan2(y - (fy - 19 * s), x - fx); const d = Math.hypot(x - fx, y - (fy - 19 * s));
      return Math.sin(a * 1 + d / (1.6 * Z)) > 0.2 ? col : '#ffffff';
    }, 'candy');
  } else if (t === 'crystal') {
    // a tree of golden crystal
    const cc = ['#ffd43b', '#fff3bf', '#f08c00', '#e599f7'];
    for (let k = -2; k <= 2; k += 1) {
      const hh = (16 - Math.abs(k) * 4) * s; const x0 = fx + k * 4 * s;
      for (let y = 0; y < hh; y += 1) {
        const w = Math.max(1, Math.round((2.4 * s * (hh - y)) / hh + Z));
        for (let x = -w; x <= w; x += 1) b.set(x0 + x, fy - y - Math.abs(k) * Z, x < 0 ? cc[1] : x > w / 2 ? cc[2] : cc[k === 0 ? 3 : 0], 'gem');
      }
    }
  } else if (t === 'kelp') {
    const G = ramp('#5c8a2a', 2, 2);
    for (let q = -1; q <= 1; q += 1) {
      const hh = (24 - Math.abs(q) * 6) * s;
      for (let y = 0; y < hh; y += 1) {
        const x = fx + q * 4 * s + Math.round(Math.sin(y / (5 * Z) + q) * 2 * Z);
        b.set(x, fy - y, G[2], 'leaf'); b.set(x + 1, fy - y, G[3], 'leaf');
        if (y % (6 * Z) === 0) { b.set(x + 2, fy - y, G[3], 'leaf'); b.set(x + 3, fy - y + 1, G[2], 'leaf'); b.set(x - 2, fy - y - 2, G[2], 'leaf'); }
      }
    }
  }
  b.outline((tag) => (tag === 'gem' ? '#8a5a00' : tag === 'candy' ? '#c92a6a' : INK));
}

/** Draw a hole at x, y (game pixels; the context is in game pixels). */
export function drawHole(ctx, look, x, y, h, t, Z) {
  const d = Math.min(5, Math.ceil(h.d));
  if (h.d <= 0) return;
  const f = 1 / Z;
  if (h.d < 1) {
    // only cracked (ice): a little star of cracks
    ctx.fillStyle = '#5a7a94';
    ctx.fillRect(x - 3, y, 6, f); ctx.fillRect(x, y - 2, f, 4); ctx.fillRect(x - 2, y - 1.5, f, f); ctx.fillRect(x + 2, y + 1, f, f);
    return;
  }
  const rx = 3.5 + Math.min(d, 3) * 0.9; const ry = 2.2 + Math.min(d, 3) * 0.55;
  // the dirt pile thrown to one side, with flecks of what's below
  const pile = look.dirt[1]; const px0 = Math.round(x + rx - 1); const py0 = Math.round(y + ry - 3);
  ctx.fillStyle = INK; ctx.fillRect(px0 - f, py0 - f, 6 + 2 * f, 3 + 2 * f);
  ctx.fillStyle = mix(pile, INK, 0.25); ctx.fillRect(px0, py0 + 1, 6, 2);
  ctx.fillStyle = pile; ctx.fillRect(px0, py0, 5, 1.5);
  ctx.fillStyle = mix(pile, '#ffffff', 0.3); ctx.fillRect(px0 + 1, py0, 2, f);
  if (h.flecks) {
    const tw = Math.floor(t * 4) % 2;
    const col = h.flecks === 'bone' ? '#ffffff' : h.flecks === 'gem' ? (tw ? '#ffffff' : '#a5d8ff') : h.flecks === 'made' ? (tw ? '#d9480f' : '#2f9e44') : h.flecks;
    ctx.fillStyle = col;
    ctx.fillRect(px0 + 1, py0 + 1, f * 2, f * 2); ctx.fillRect(px0 + 3.5, py0 + 0.5, f * 2, f * 2); ctx.fillRect(px0 + 2.5, py0 + 2, f * 2, f);
  }
  // the rim, then the hole: the color of the layer it reached, its far half in shadow
  for (let yy = -ry - f; yy <= ry + f; yy += f) {
    const w = (rx + f) * Math.sqrt(Math.max(0, 1 - (yy / (ry + f)) ** 2));
    if (w <= 0) continue;
    ctx.fillStyle = yy > 0 ? mix(look.dirt[1], '#ffffff', 0.2) : INK; ctx.fillRect(x - w, y + yy, w * 2, f);
  }
  for (let yy = -ry; yy <= ry; yy += f) {
    const w = rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2));
    if (w <= 0) continue;
    ctx.fillStyle = yy < -ry * 0.15 ? mix(look.layers[d - 1], INK, 0.55) : look.layers[d - 1];
    ctx.fillRect(x - w, y + yy, w * 2, f);
  }
  // a find's glow from deep down (after a rare clink)
  if (h.glow && !h.found) { ctx.globalAlpha = 0.35 + 0.25 * Math.sin(t * 8); ctx.fillStyle = '#fff3bf'; ctx.fillRect(x - rx * 0.5, y - ry * 0.3, rx, ry * 0.8); ctx.globalAlpha = 1; }
  // a hole that gave a find gets a tiny flag in its rarity color
  if (h.found && h.flag) {
    ctx.fillStyle = '#5c3a1e'; ctx.fillRect(x - rx - 1, y - 8, f * 2, 9);
    ctx.fillStyle = INK; ctx.fillRect(x - rx - 1, y - 8 - f, 5 + f, 3 + 2 * f);
    ctx.fillStyle = h.flag; ctx.fillRect(x - rx - 1 + f, y - 8, 4, 3);
  }
}

// ---------- each map's twist, drawn over the ground ----------
export function drawTwistDecals(ctx, g, Z, layer = 'ground') {
  const f = 1 / Z;
  if (layer === 'sea') {
    // the sea, going out with the tide
    const L = g.layout; const look = g.look;
    const x0 = Math.max(0, Math.floor(g.camX)); const x1 = Math.min(g.W, Math.ceil(g.camX + g.fieldW));
    for (let x = x0; x < x1; x += f) {
      const top = g.sea(x); const end = L.bottom(x) + TIDE;
      if (top >= end) continue;
      const foam = Math.sin(x / 7 + g.t * 2.2) > 0.3;
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x, top - (foam ? f : 0), f, 2 * f);
      ctx.fillStyle = look.sea[2]; ctx.fillRect(x, top + 2 * f, f, Math.min(4, end - top));
      if (end - top > 4) { ctx.fillStyle = look.sea[1]; ctx.fillRect(x, top + 4, f, end - top - 4); }
    }
    return;
  }
  if (g.twist === 'hot') {
    // heat shimmer over hot ground
    for (const d of g.layout.decals) {
      if (d.type !== 'hot') continue;
      for (let k = 0; k < 4; k += 1) {
        const ph = (g.t * 0.8 + k * 0.25) % 1;
        ctx.globalAlpha = 0.5 * (1 - ph);
        ctx.fillStyle = '#ffa94d';
        ctx.fillRect(d.x - 8 + k * 5, d.y - ph * 10, f * 2, f);
      }
    }
    ctx.globalAlpha = 1;
  }
  if (g.twist === 'current') {
    // bubbles rising from the sea floor
    for (let k = 0; k < 18; k += 1) {
      const bx = (k * 97.3) % g.W; const ph = (g.t * 0.12 + k * 0.137) % 1;
      const by = g.H - ph * g.H;
      ctx.globalAlpha = 0.6 * (1 - ph);
      ctx.fillStyle = '#e7f5ff'; ctx.fillRect(bx + Math.sin(g.t * 2 + k) * 1.5, by, 1, 1);
      ctx.fillStyle = '#a5d8ff'; ctx.fillRect(bx + Math.sin(g.t * 2 + k) * 1.5 + f, by + f, f, f);
    }
    ctx.globalAlpha = 1;
  }
  if (g.twist === 'meteor' && g.meteor && g.t - g.meteor.at > 1.15) {
    const c = g.meteor.c;
    for (let yy = -5; yy <= 5; yy += f) for (let xx = -8; xx <= 8; xx += f) {
      const e = (xx / 8) ** 2 + (yy / 5) ** 2; if (e > 1) continue;
      ctx.fillStyle = e > 0.75 ? '#ced4da' : yy < 0 ? '#5c6066' : '#74787e';
      ctx.fillRect(c.x + xx, c.y + yy, f, f);
    }
    if (g.t - g.meteor.at < 3) { ctx.globalAlpha = 0.5 + 0.5 * Math.sin(g.t * 10); ctx.fillStyle = '#ff922b'; ctx.fillRect(c.x - 1, c.y - 1, 2, 2); ctx.globalAlpha = 1; }
  }
}

// ---------- critters ----------
const CRIT = {
  worm: [['..PPP...', '.P...P.P', 'P.....P.'], { P: '#f783ac' }],
  grub: [['.WWW.', 'WWWWW', 'BWWW.'], { W: '#fff4e6', B: '#c2410c' }],
  mole: [['.KKKK..', 'KKKKKKP', 'KKKKKK.', '.W..W..'], { K: '#5c4a5a', P: '#f783ac', W: '#fff4e6' }],
  crab: [['R.....R', '.RRRRR.', 'RRKRKRR', '.R.R.R.'], { R: '#fa5252', K: INK }],
  bolt: [['.GGG.', 'GGGGG', '.GGG.', '..G..', '..G..'], { G: '#adb5bd' }],
  twinkle: [['..Y..', '.YWY.', 'YWWWY', '.YWY.', '..Y..'], { Y: '#ffd43b', W: '#ffffff' }],
};
const critCache = new Map();
export function critterPic(id) {
  if (critCache.has(id)) return critCache.get(id);
  const [rows, pal] = CRIT[id] || CRIT.worm;
  const c = canvas(rows[0].length + 2, rows.length + 2); const x = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = INK; x.fillRect(i, j, 3, 3); } });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = pal[r[i]]; x.fillRect(i + 1, j + 1, 1, 1); } });
  critCache.set(id, c);
  return c;
}

// ---------- shovels ----------
const shovelCache = [];
/** The shovel for a tier (1-3), in game pixels, blade down: 7 x 16. */
export function shovelPic(tier) {
  if (shovelCache[tier]) return shovelCache[tier];
  const pal = [null,
    { H: '#b07850', h: '#7a4a26', B: '#adb5bd', b: '#6c757d', L: '#e9ecef', G: '#7a4a26' },
    { H: '#e03131', h: '#a61e1e', B: '#ced4da', b: '#868e96', L: '#ffffff', G: '#343a40' },
    { H: '#ffd43b', h: '#e67700', B: '#ffe066', b: '#f08c00', L: '#fff9db', G: '#ffd43b' },
  ][tier];
  const rows = [
    '.GGGGG.',
    '.G...G.',
    '..GHG..',
    '...Hh..',
    '...Hh..',
    '...Hh..',
    '...Hh..',
    '...Hh..',
    '...Hh..',
    '..bHhb.',
    '.bLBBBb',
    '.bLBBBb',
    '.bLBBBb',
    '.bLBBbb',
    '..bBBb.',
    '...bb..',
  ];
  const c = canvas(7, 16); const x = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) { const col = pal[r[i]]; if (col) { x.fillStyle = col; x.fillRect(i, j, 1, 1); } } });
  shovelCache[tier] = c;
  return c;
}

// ---------- finds ----------
const findCache = new Map();
/** A find's picture in game pixels (about 12 x 12; skulls a bit bigger). */
export function findPic(key) {
  if (findCache.has(key)) return findCache.get(key);
  const info = findInfo(key);
  const c = info.kind === 'bone' ? bonePic(info) : info.kind === 'critter' ? critterPic(info.shape) : treasurePic(info);
  findCache.set(key, c);
  return c;
}

const BONE = { B: '#e9d8b4', b: '#c9a97a', d: '#8d6e63', W: '#ffffff', K: INK };
// Body bones by shape (6 rows of letters, scaled up from a little grid)
const BONE_SHAPES = {
  femur: ['.BB.........', 'BBBB......BB', '.BbBBBBBBBBB', '..bbbbbbbBbB', '.........bb.'],
  rib: ['..BBBB....', '.Bb..bB...', 'Bb....bB..', 'B......bB.', 'b.......bB', '.........b'],
  ribs: ['BBBBBBBBB.', 'B.B.B.B.Bb', 'B.B.B.B.b.', 'b.B.B.b...', '..b.b.....'],
  vert: ['...BB...', '.BBBBBB.', 'BBbBBbBB', '.bBBBBb.', '..bBBb..', '...bb...'],
  neck: ['BB.BB.BB.BB.', 'BbBBbBBbBBbB', '.bb.bb.bb.bb'],
  tail: ['BB.BB.B.B...', 'bBBbBBbBbBbB', '.bb.b..b..b.'],
  claw: ['..BBB...', '.BBbBB..', 'BBb..BB.', 'Bb....Bb', 'b......B', '.......b'],
  arm: ['BB......', 'BbB.....', '.bBB....', '..bBBB..', '....bBBB', '.....bBb', '......b.'],
  tooth: ['BBBBB', 'BbBbB', '.BBb.', '.Bb..', '..b..'],
  plate: ['....BB....', '...BBbB...', '..BBbbBB..', '.BBbbbbBB.', 'BBbbbbbbBB', 'bbbbbbbbbb'],
  sail: ['B.........', 'BB........', 'BbB.......', 'B.bB......', 'B..bBB....', 'BBBBBBBBBB'],
  horn: ['.......B', '......BB', '....BBBb', '..BBBbb.', 'BBBbb...', 'bbb.....'],
  frill: ['..BBBBBB..', '.BbBbbBbB.', 'BbB....BbB', 'Bb......bB', 'b........b'],
  flipper: ['BBB.......', 'BbBBB.....', '.bBbBBB...', '..bBbBbBB.', '...bbbbbBB', '.......bb.'],
  hip: ['.BBBBBB.', 'BBbBBbBB', 'Bb.BB.bB', 'b..bb..b'],
  jaw: ['BBBBBBBBB.', 'BWbWbWbWBB', '.bbbbbbbbB', '.......bb.'],
  wish: ['B.......B', 'Bb.....bB', '.Bb...bB.', '..BbbbB..', '...BBB...'],
  egg: ['.BBB.', 'BBbBB', 'BbbbB', 'BbbbB', '.bbb.'],
};

function bonePic(info) {
  if (info.part === 'skull') return skullPic(info.dino);
  const shape = BONE_SHAPES[info.shape] || BONE_SHAPES.femur;
  const w = Math.max(...shape.map((r) => r.length)); const h = shape.length;
  const c = canvas(w + 2, h + 2); const x = c.getContext('2d');
  const tint = BONE;
  // outline first, then fill
  shape.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = INK; x.fillRect(i, j, 3, 3); } });
  shape.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = tint[r[i]]; x.fillRect(i + 1, j + 1, 1, 1); } });
  return c;
}

// Each dinosaur's skull, facing right (the key piece, so each one is its own drawing).
// B bone, b shade, d deep shade, K holes (eye, nostril, window), W teeth.
const SKULLS = {
  trex: ['.....BBBBBBB........', '...BBBBBBBBBBBBB....', '..BBKKBBBBBBBBBBBB..', '.BBBKKBBKKKBBBBBBKB.', 'BBBBBBBBKKKBBBBBBBBB', 'BbBBBBBBBBBBBBBBBBBb', '.bbddddddddddddddddb', '..WWbWWbWWbWWbWWbWW.', '..bBBBBBBBBBBBBBBBb.', '...bbbbbbbbbbbbbbb..'],
  trike: ['BBB.................', 'BBBB.........B.B....', 'BbBBB.......BB.B....', 'BbbBBB.....BB.BB....', '.BbbBBBBBBBBBBB...B.', '..BbBBBKKBBBBBBBBBB.', '..BbBBBKKBBBBBBBBBBB', '...bBBBBBBBBBBBBBBBb', '....bbbBBBBBBbbbbbd.', '.......bbbbbbbb.....'],
  stego: ['....BBBBB.....', '..BBBBBBBBBB..', '.BBKKBBBBBBBB.', 'BBBKKBBBBBBBBB', 'BbbbbBBBBBBBBd', '.bbbbbbbbbbbd.'],
  raptor: ['.....BBBBBBBB.....', '..BBBBBBBBBBBBBBB.', '.BBKKBBKKBBBBBBBBB', 'BBBKKBBBBBBBBBBBB.', 'BbdddddddddddddB..', '.WbWbWbWbWbWbWb...', '..bbbbbbbbbbbbb...'],
  spino: ['...BBBBBB.............', '.BBBBBBBBBBBBBBB......', 'BBKKBBBBBBBBBBBBBBBBB.', 'BBKKBBBBKBBBBBBBBBBBBB', 'BbbddddddddddddddddBBB', '.WbWbWbWbWbWbWbWbWbWb.', '..bbbbbbbbbbbbbbbbbbb.'],
  pachy: ['B..B..............', 'BB.BB.............', 'BBBBBBBBBB........', '.BBBBBBBBBBBBB....', '.BBBKKBBBBbbbBBB..', '..BBKKBBBbbbbbBBB.', '..bBBBBBBBBBBBBBBd', '...bbbbbbbbbbbbdd.'],
  mosa: ['....BBBBBBBBBB..........', '..BBBBBBBBBBBBBBBBBB....', '.BBKKBBBBBBBBBBBBBBBBBB.', 'BBBKKBBBBBBBBBBBBBBBBBBB', 'BbdddddddddddddddddddddB', '.WWbWWbWWbWWbWWbWWbWWbW.', '..bbbbbbbbbbbbbbbbbbbbb.'],
  psitta: ['..BBBBBB....', '.BBBBBBBBB..', 'BBKKBBBBBBB.', 'BBKKBBBBBBBB', '.BBBBBBbBBBB', 'B.bbbbbbbBBd', '.......bBBd.'],
  compy: ['...BBBBB....', '.BBBBBBBBBB.', 'BBKKBBKBBBBB', 'BbdddddddBB.', '.WbWbWbWb...', '..bbbbbbb...'],
  edmonto: ['..BBBBB...........', '.BBBBBBBBBB.......', 'BBKKBBBBBBBBBBB...', 'BBKKBBBBBBBBBBBBBB', 'BbbbBBBBBBBBBBBBBB', '.bbbbbbbbbbbbbbbd.'],
};

function skullPic(dino) {
  const rows = SKULLS[dino.id] || SKULLS.compy;
  const w = Math.max(...rows.map((r) => r.length)); const h = rows.length;
  const c = canvas(w + 2, h + 2); const x = c.getContext('2d');
  const pal = { B: '#efe2bf', b: '#c9a97a', d: '#7a6450', W: '#ffffff', K: '#2a2026' };
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = INK; x.fillRect(i, j, 3, 3); } });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = pal[r[i]]; x.fillRect(i + 1, j + 1, 1, 1); } });
  return c;
}

// Treasures by shape: a little grid; letters A (main), a (shade), L (light), D (dark)
const T_SHAPES = {
  crystal: ['...L...', '..LAa..', '..LAa..', '.LAAAa.', '.LAAAa.', 'LAAAAAa', '.DDDDD.'],
  gem: ['.LLLLL.', 'LAAAAAa', 'LAAAAaa', '.AAAaa.', '..Aaa..', '...a...'],
  coin: ['..LLL..', '.LAAAa.', 'LAADAAa', 'LADDDAa', 'LAADAAa', '.LAAAa.', '..aaa..'],
  ring: ['..LAL..', '..AaA..', '.DD.DD.', 'D.....D', 'D.....D', '.D...D.', '..DDD..'],
  arrow: ['...L...', '..LAa..', '..LAa..', '.LAAAa.', '.LAAAa.', 'LAAAAAa', 'a.AAa.a', '...a...'],
  egg: ['..LLL..', '.LAAAa.', 'LAAaAAa', 'LAAAAAa', 'LAaAAAa', '.AAAAa.', '..aaa..'],
  poop: ['...L...', '..LAa..', '.LAAAa.', '..aaa..', '.LAAAAa', 'LAAAAAAa', '.aaaaaa.'],
  trilo: ['..LAL..', '.LAAAa.', 'LADADAa', '.LAAAa.', 'LADADAa', '.LAAAa.', '..AaA..', '...a...'],
  wood: ['.LLLLLLL.', 'LAAaAAaAa', 'LADDaDDAa', 'LAAaAAaAa', '.aaaaaaa.'],
  nugget: ['..LL...', '.LAAa..', 'LAAAAa.', 'LAAAAAa', '.AAaAa.', '..aa...'],
  bell: ['..LA...', '.LAAa..', '.LAAa..', 'LAAAAa.', 'LAAAAAa', 'aaaaaaa', '...D...'],
  shell: ['...L...', '..LAa..', '.LADAa.', 'LADADAa', 'LADADAa', '.aaaaa.'],
  claw: ['LL.....', 'LAa....', '.LAa...', '.LAAa..', '..LAAa.', '...aAAa', '....aaa'],
  tooth: ['LLLLL', 'LAAAa', '.LAa.', '.LAa.', '..a..'],
  statue: ['..LA...', '.LAAa..', '..Aa...', '.LAAAa.', '.LAAAa.', '..A.a..', '.aaaaa.'],
  orb: ['..LLL..', '.LLAAa.', 'LLAAAAa', 'LAAAAAa', 'LAAAAaa', '.AAAaa.', '..aaa..'],
  star: ['...L...', '...A...', '.LLAAa.', 'LAAAAAa', '.LAAAa.', '.La.Aa.', 'a.....a'],
  rock: ['..LLL..', '.LAADa.', 'LADAAAa', 'LAAADAa', '.AaAAa.', '..aaa..'],
  bone: ['LL...LL', 'LAAAAAa', '.aaaaa.', 'LL...La', 'aa...aa'],
};

function treasurePic(info) {
  const rows = T_SHAPES[info.shape] || T_SHAPES.rock;
  const [A, D, L] = info.colors || ['#ffd43b', '#e67700', '#fff3bf'];
  const pal = { A, a: mix(A, D, 0.55), D, L };
  const w = Math.max(...rows.map((r) => r.length)); const h = rows.length;
  const c = canvas(w + 2, h + 2); const x = c.getContext('2d');
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = INK; x.fillRect(i, j, 3, 3); } });
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') { x.fillStyle = pal[r[i]]; x.fillRect(i + 1, j + 1, 1, 1); } });
  return c;
}

// ---------- skeletons: the book page and the display stand ----------
// Each skeleton is drawn from a side-view body plan (game pixels, facing right, ground at
// y 38). Six regions light up as the kid finds the bones that build them; missing parts are a
// dark blue-gray outline.
const POSES = {
  'big-biped': { spine: [[2, 21], [10, 18], [20, 16], [30, 15], [40, 15], [47, 16], [52, 13], [55, 10]], hip: 3, sh: 5, ribs: [3, 5, 8],
    legs: [[[30, 16], [35, 26], [31, 33], [37, 37]]], arms: [[[47, 18], [49, 22], [52, 22]]], skull: [55, 6], sk: 1 },
  'small-biped': { spine: [[6, 20], [14, 19], [22, 18], [30, 18], [37, 18], [42, 16], [45, 13]], hip: 3, sh: 4, ribs: [3, 4, 6],
    legs: [[[30, 19], [33, 27], [30, 33], [35, 37]]], arms: [[[37, 20], [40, 24], [43, 24]]], skull: [45, 9], sk: 1 },
  duckbill: { spine: [[2, 24], [12, 20], [22, 17], [32, 16], [42, 18], [48, 20], [52, 16], [55, 12]], hip: 3, sh: 5, ribs: [3, 5, 9],
    legs: [[[32, 17], [37, 27], [33, 33], [38, 37]]], arms: [[[48, 22], [49, 30], [51, 37]]], skull: [55, 8], sk: 1 },
  horned: { spine: [[4, 22], [12, 20], [20, 18], [30, 17], [40, 18], [47, 21], [50, 22]], hip: 3, sh: 5, ribs: [3, 5, 10],
    legs: [[[30, 18], [32, 28], [30, 37]]], arms: [[[45, 22], [43, 30], [45, 37]]], skull: [48, 14], sk: 1 },
  plated: { spine: [[2, 28], [10, 22], [20, 16], [28, 13], [36, 15], [44, 20], [50, 24], [53, 26]], hip: 3, sh: 5, ribs: [3, 5, 11],
    legs: [[[28, 14], [31, 26], [29, 37]]], arms: [[[44, 21], [43, 30], [45, 37]]], skull: [52, 21], sk: 1 },
  sail: { spine: [[2, 18], [12, 17], [22, 17], [30, 17], [38, 17], [46, 17], [52, 15], [56, 12]], hip: 3, sh: 5, ribs: [3, 5, 8],
    legs: [[[30, 18], [33, 27], [30, 33], [34, 37]]], arms: [[[46, 19], [48, 24], [51, 25]]], skull: [56, 8], sk: 1 },
  swimmer: { spine: [[2, 26], [10, 22], [18, 18], [28, 16], [38, 16], [46, 17], [52, 16]], hip: 2, sh: 5, ribs: [2, 5, 7],
    legs: [[[20, 19], [24, 24], [29, 26]]], arms: [[[44, 19], [48, 24], [53, 27]]], skull: [52, 11], sk: 1 },
};
// which parts light which region (anything not listed lights with the ribs)
const REGIONS = {
  psitta: { skull: ['skull', 'neck'], horn: ['horns'], arm: ['arm'], ribs: ['ribs', 'back'], leg: ['leg'], tail: ['tail'] },
  compy: { skull: ['skull'], neck: ['neck'], hand: ['arm'], ribs: ['ribs', 'back'], leg: ['leg'], tail: ['tail'] },
  edmonto: { skull: ['skull', 'neck'], jaw: ['jaw'], hand: ['arm'], ribs: ['ribs', 'back'], leg: ['leg'], tail: ['tail'] },
  trike: { skull: ['skull', 'neck'], horn: ['horns'], frill: ['frill'], arm: ['arm', 'leg'], ribs: ['ribs', 'back'], tail: ['tail'] },
  trex: { skull: ['skull', 'neck'], tooth: ['teeth'], arm: ['arm'], ribs: ['ribs', 'back'], leg: ['leg'], tail: ['tail'] },
  stego: { skull: ['skull', 'neck'], plate: ['plates'], spike: ['tail', 'spikes'], arm: ['arm'], leg: ['leg'], hip: ['ribs', 'back'] },
  raptor: { skull: ['skull', 'neck'], claw: ['claw'], arm: ['arm'], wish: ['ribs', 'back'], leg: ['leg'], tail: ['tail'] },
  spino: { skull: ['skull', 'neck'], tooth: ['teeth'], sail: ['sail', 'back', 'ribs'], claw: ['arm'], leg: ['leg'], tail: ['tail'] },
  pachy: { skull: ['skull', 'neck'], horn: ['horns'], jaw: ['jaw'], ribs: ['ribs', 'back'], leg: ['leg', 'arm'], tail: ['tail'] },
  mosa: { skull: ['skull', 'neck'], jaw: ['jaw'], teeth: ['teeth'], flipper: ['arm', 'leg'], back: ['ribs', 'back'], tail: ['tail'] },
};
const SCALE = { psitta: 0.8, compy: 0.65, raptor: 0.75, edmonto: 1, trike: 1, trex: 1, stego: 1, spino: 1, pachy: 0.9, mosa: 1 };

/** A skeleton picture (96 x 56): bones = the kid's bones ({ key: ... }); all: draw it complete. */
export function skeletonPic(dinoId, bones = {}, all = false) {
  const dino = DINO_POSE[dinoId];
  const P = POSES[dino.pose]; const k = (SCALE[dinoId] || 1) * 1.3;
  const lit = new Set();
  for (const [part, regs] of Object.entries(REGIONS[dinoId])) if (all || bones[`${dinoId}-${part}`]) regs.forEach((r) => lit.add(r));
  const Wc = 96; const Hc = 56;
  const b = new Buf(Wc, Hc, 0);
  const ox = Math.round((Wc - 66 * k) / 2); const oy = Math.round(Hc - 3 - 38 * k);
  const T = ([a, c]) => [ox + a * k, oy + c * k];
  const ON = ['#f4ead0', '#d9c49a']; const OFF = ['#4a5a72', '#3e4c62'];
  // a bone: a line of the given thickness, light on its top side
  const bone = (A, B, on, th = 2, reg = 'x') => {
    const [x0, y0] = T(A); const [x1, y1] = T(B);
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 1.5));
    const col = on ? ON : OFF;
    for (let i = 0; i <= n; i += 1) {
      const px = Math.round(x0 + ((x1 - x0) * i) / n); const py = Math.round(y0 + ((y1 - y0) * i) / n);
      for (let t = 0; t < th; t += 1) b.set(px, py + t, t === 0 ? col[0] : col[1], on ? 'on' : 'off');
    }
  };
  const knob = (A, on) => { const [px, py] = T(A); b.rect(Math.round(px) - 1, Math.round(py) - 1, 3, 3, on ? ON[0] : OFF[0], on ? 'on' : 'off'); };
  const S = P.spine;
  const region = (i) => (i < P.hip ? 'tail' : i >= P.sh ? 'neck' : 'back');
  const th = k >= 1.1 ? 2 : 1;
  // the sail and the plates stand behind
  if (dinoId === 'spino') for (let i = P.hip - 1; i <= P.sh; i += 1) { const [a, c] = S[i]; bone([a, c], [a, c - 12 + Math.abs(i - 3.5) * 2], lit.has('sail'), 1); }
  if (dinoId === 'stego') for (let i = 1; i < S.length - 2; i += 1) {
    const [a, c] = S[i]; const on = lit.has('plates'); const hh = 7 - Math.abs(i - 3) * 1.2;
    for (let q = 0; q < hh * k; q += 1) { const w = Math.round(((hh * k - q) / 2.6)); for (let x = -w; x <= w; x += 1) { const [px, py] = T([a, c - 1.5]); b.set(Math.round(px + x), Math.round(py - q), on ? (x < 0 ? ON[1] : ON[0]) : OFF[x < 0 ? 1 : 0], on ? 'on' : 'off'); } }
  }
  // the backbone, with a knob for each vertebra group
  for (let i = 0; i < S.length - 1; i += 1) bone(S[i], S[i + 1], lit.has(region(i)), th);
  for (let i = 1; i < S.length - 1; i += 1) { const [px, py] = T(S[i]); b.set(Math.round(px), Math.round(py) - 1, lit.has(region(Math.min(i, S.length - 2))) ? ON[0] : OFF[0], lit.has(region(Math.min(i, S.length - 2))) ? 'on' : 'off'); }
  if (dinoId === 'stego') { const [a, c] = S[1]; for (const [dx, dy] of [[-3, -4], [-1, -5], [1, -4], [-4, -2]]) bone([a, c], [a + dx, c + dy], lit.has('spikes'), 1); }
  // ribs hanging from the back
  const [r0, r1, rl] = P.ribs;
  for (let i = r0; i < r1; i += 1) for (const f of [0, 0.34, 0.67]) {
    const a = S[i][0] + (S[i + 1][0] - S[i][0]) * f; const c = S[i][1] + (S[i + 1][1] - S[i][1]) * f;
    const mid = (r0 + r1) / 2; const len = rl * (1 - (Math.abs(i + f - mid) / ((r1 - r0) / 2 + 1)) ** 2);
    bone([a, c + 1], [a - 1.2, c + 1 + len], lit.has('ribs'), 1);
  }
  // legs (the far one a step behind), and arms
  for (const L of P.legs) for (const back of [true, false]) {
    const on = lit.has('leg'); const dx = back ? -3 : 0;
    for (let i = 0; i < L.length - 1; i += 1) bone([L[i][0] + dx, L[i][1]], [L[i + 1][0] + dx, L[i + 1][1]], on, i < 2 ? th : 1);
    knob([L[0][0] + dx, L[0][1]], on);
    if (dinoId === 'raptor' && !back) { const t = L[L.length - 2]; bone([t[0] + 0.5, t[1] + 1], [t[0] + 2.5, t[1] - 1.5], lit.has('claw'), 1); }
  }
  for (const A of P.arms) for (let i = 0; i < A.length - 1; i += 1) bone(A[i], A[i + 1], lit.has('arm'), 1);
  // horns and frills on the head
  const H0 = P.skull;
  if (dinoId === 'trike' || dinoId === 'pachy') {
    const fon = lit.has(dinoId === 'trike' ? 'frill' : 'horns');
    for (let q = 0; q < 9; q += 1) { const [px, py] = T([H0[0] - 3 + q * 0.25, H0[1] - 6 + q * 1.1]); b.rect(Math.round(px) - 2, Math.round(py), 3, 1, fon ? ON[q % 3 ? 0 : 1] : OFF[0], fon ? 'on' : 'off'); }
    if (dinoId === 'pachy') for (let q = 0; q < 3; q += 1) bone([H0[0] - 4 + q * 1.5, H0[1] - 6], [H0[0] - 6 + q * 1.5, H0[1] - 10], lit.has('horns'), 1);
  }
  b.outline((tag) => (String(tag).startsWith('on') ? INK : String(tag).startsWith('off') ? '#2a3346' : null));
  const c = canvas(Wc, Hc); const x = c.getContext('2d');
  b.each((px, py) => { const col = b.get(px, py); if (col) { x.fillStyle = col; x.fillRect(px, py, 1, 1); } });
  // the skull, from its find picture (a dark silhouette when missing), and its brow horns
  const sk = findPic(`${dinoId}-skull`);
  const [sx, sy] = T(H0);
  const s2 = canvas(sk.width, sk.height); const sx2 = s2.getContext('2d'); sx2.drawImage(sk, 0, 0);
  if (!lit.has('skull')) { sx2.globalCompositeOperation = 'source-atop'; sx2.fillStyle = '#4a5a72'; sx2.fillRect(0, 0, s2.width, s2.height); }
  x.drawImage(s2, Math.round(sx - 3), Math.round(sy - sk.height / 2));
  if (dinoId === 'trike') {
    const on = lit.has('horns'); x.fillStyle = on ? ON[0] : OFF[0];
    for (let q = 0; q < 7; q += 1) { x.fillRect(Math.round(sx + 8 + q), Math.round(sy - sk.height / 2 - q * 0.9), 2, 1); }
    x.fillStyle = INK; x.fillRect(Math.round(sx + 15), Math.round(sy - sk.height / 2 - 7), 1, 1);
  }
  if (REGIONS[dinoId].jaw && !lit.has('jaw')) { x.fillStyle = '#4a5a72'; x.fillRect(Math.round(sx - 1), Math.round(sy + sk.height / 2 - 2), Math.round(sk.width * 0.8), 2); }
  if ((REGIONS[dinoId].tooth || REGIONS[dinoId].teeth) && !lit.has('teeth')) { x.fillStyle = '#4a5a72'; for (let q = 1; q < sk.width - 3; q += 2) x.fillRect(Math.round(sx - 2 + q), Math.round(sy + sk.height / 2 - 3), 1, 1); }
  return c;
}
let DINO_POSE = {};
export function setDinoPoses(dinos) { DINO_POSE = Object.fromEntries(dinos.map((d) => [d.id, d])); }

/** The house displays: 'stand' with a finished skeleton (id), or 'pedestal' with a treasure (key). */
export function displayPic(kind, id) {
  if (kind === 'stand') {
    const c = canvas(104, 70); const x = c.getContext('2d');
    // wood base with a brass plaque, two dark metal posts holding the skeleton up
    x.fillStyle = INK; x.fillRect(3, 58, 98, 11);
    x.fillStyle = '#8b5a2b'; x.fillRect(4, 59, 96, 9);
    x.fillStyle = '#a8703a'; x.fillRect(4, 59, 96, 2);
    for (let i = 7; i < 98; i += 11) { x.fillStyle = '#7a4a26'; x.fillRect(i, 63, 5, 1); x.fillRect(i + 4, 65, 4, 1); }
    x.fillStyle = INK; x.fillRect(41, 61, 22, 6); x.fillStyle = '#e0b23a'; x.fillRect(42, 62, 20, 4); x.fillStyle = '#fff3bf'; x.fillRect(42, 62, 4, 1);
    if (!id) return c;
    x.fillStyle = '#343a40'; x.fillRect(38, 36, 2, 23); x.fillRect(62, 34, 2, 25);
    x.fillStyle = '#495057'; x.fillRect(38, 36, 1, 23); x.fillRect(62, 34, 1, 25);
    x.drawImage(skeletonPic(id, {}, true), 4, 4);
    return c;
  }
  const c = canvas(24, 40); const x = c.getContext('2d');
  // a stone column, a velvet cushion, and a glass dome drawn with two highlights
  x.fillStyle = INK; x.fillRect(4, 20, 16, 20);
  x.fillStyle = '#ced4da'; x.fillRect(5, 21, 14, 18);
  x.fillStyle = '#adb5bd'; x.fillRect(14, 21, 5, 18); x.fillStyle = '#f1f3f5'; x.fillRect(6, 21, 2, 18);
  x.fillStyle = '#868e96'; x.fillRect(3, 20, 18, 2); x.fillRect(3, 37, 18, 2);
  x.fillStyle = '#c92a2a'; x.fillRect(6, 17, 12, 3); x.fillStyle = '#e03131'; x.fillRect(7, 17, 10, 1);
  if (id) { const p = findPic(id); const s = Math.min(1, 12 / Math.max(p.width, p.height)); x.drawImage(p, 12 - (p.width * s) / 2, 17 - p.height * s, p.width * s, p.height * s); }
  x.fillStyle = 'rgba(255,255,255,0.85)';
  for (let a = 0; a <= Math.PI; a += 0.05) { const px = Math.round(12 + Math.cos(a) * 10); const py = Math.round(18 - Math.sin(a) * 15); if (a > 1.9 && a < 2.6) x.fillRect(px, py, 1, 1); }
  x.fillRect(19, 9, 1, 6); x.fillStyle = 'rgba(255,255,255,0.4)'; x.fillRect(2, 18, 20, 1);
  return c;
}

setDinoPoses(DINOS);
