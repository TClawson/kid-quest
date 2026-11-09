// The Moon Base (the space map's village) in style B, "soft storybook", like the Forest Village
// (meadowart.js), Sunset Beach (sunsetart.js) and Under the Sea (oceanart.js): hue-shifted colors,
// round shapes, selective outlines (each thing edged in a darker shade of its own color, ink only
// where it meets the ground), and soft dithered edges. Lilac moon dust pocked with little craters,
// the black starry sky over the far rim with the Earth hanging in it, a rift in the ground that
// looks right through to the stars, crossed by a metal gangway; roads of packed dust with rover
// tracks; round metal landing plates; white habitats under glass domes; dishes, lamps, crystals
// and the little things of a moon base.
//
// Everything is one canvas pixel per village pixel, painted into one ImageData and shown with
// a single putImageData. villageprops.js calls paintSpace() for the space map; every other map
// keeps its own painter.

import { ramp, mix, rng, h2, vnoise, bayer, grid, inEll, pixelBuffer, pathField, clamp, oval, grow, inRound } from './pixelkit.js';
import { propB, groundShadow } from './meadowart.js';

// ---------- the palette ----------

export const SB = {
  dust: ['#22213a', '#302f52', '#403f68', '#52537e', '#666a96', '#7c80ac', '#9498c2', '#b2b4d4', '#d4d4e8'], // base 5
  sky: ['#04040f', '#080a1e', '#0e1030', '#161a44', '#20265a'],
  rock: ['#1e1c34', '#2c2a4a', '#3c3c62', '#50527c', '#666a96', '#8286b0', '#a2a6c8', '#c4c6de'],
  steel: ['#252a40', '#363d5a', '#4c5476', '#667092', '#8690b0', '#a8b0cc', '#ccd2e4', '#eef0f8'],
  glow: ['#5a3a3a', '#a8603a', '#e8a048', '#ffd47a', '#fff4c8'],
  hazard: ['#3a2a1a', '#c88a1a', '#ffd43b', '#fff0a0'],
  ink: '#181830',
};
const MG = SB.dust; const SKY = SB.sky; const RK = SB.rock; const ST = SB.steel; const GW = SB.glow; const HZ = SB.hazard; const INK = SB.ink;

// ---------- the moon dust ----------

/**
 * Lilac moon dust: big soft patches blended by ordered dithering, darker "seas" here and there,
 * fine grains and a glint now and then, the ground dimming towards the edges.
 */
function floorS(px, L, seed) {
  const { W, H } = L;
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const b = bayer(x, y);
      const n = vnoise(x, y, 36, seed) * 0.7 + vnoise(x, y, 11, seed + 1) * 0.3;
      const t = (b - 0.5) * 0.14;
      let k = 5;
      if (n < 0.32 + t) k = 4; else if (n > 0.68 + t) k = 6;
      // the darker seas of old lava
      const sea = vnoise(x, y, 90, seed + 4);
      if (sea < 0.34 + (b - 0.5) * 0.08) k -= 1;
      let c = MG[k];
      const g = h2(x, y, seed + 3);
      if (g < 0.014) c = MG[Math.max(2, k - 2)]; else if (g > 0.993) c = g > 0.9985 ? '#eef2ff' : MG[Math.min(8, k + 2)];
      const e = Math.min(x, W - 1 - x, H - 1 - y);
      if (e < 22) { const d = e + (vnoise(x, y, 9, seed + 9) - 0.5) * 7; if (d < 16 && b < (16 - d) / 11) c = d < 7 ? MG[3] : MG[4]; }
      px(x, y, c);
    }
  }
}

/** A crater pressed into the dust: a lit rim, the upper-left inner wall in shadow, the far wall lit. */
function pit(px, cx, cy, rx, ry, deep = 1) {
  for (let y = Math.floor(cy - ry - 2); y <= cy + ry + 2; y += 1) for (let x = Math.floor(cx - rx - 2); x <= cx + rx + 2; x += 1) {
    const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - cy) / ry; const d = Math.hypot(dx, dy);
    if (d > 1.32) continue;
    const lit = -dx * 0.6 - dy * 0.8;
    if (d > 1) { // the raised rim, lit on the upper left
      if (lit > 0.2) px(x, y, d < 1.16 ? MG[7] : MG[6]); else if (lit < -0.45 && d < 1.14) px(x, y, MG[4]);
      continue;
    }
    // inside: the near wall (upper left) in shadow, the far wall (lower right) catching the light
    const s = (dx * 0.6 + dy * 0.8) / Math.max(0.2, d);
    let c = MG[4];
    if (d > 0.45 && s < -0.25) c = d > 0.8 ? MG[2 + (deep ? 0 : 1)] : MG[3];
    else if (d > 0.55 && s > 0.35) c = MG[6];
    else if (d < 0.45) c = MG[4];
    px(x, y, c);
  }
}

/** Little craters scattered over the open ground, big and small, clear of paths, water and buildings. */
function pitsS(px, L, seed) {
  const rnd = rng(seed);
  const busy = (x, y, r) => L.blocked(x, y, r + 4) || L.onPath(x, y, r + 8) || L.inWater(x, y, r + 6) || y < 40 || y > L.H - 24 || x < 24 || x > L.W - 24;
  for (let gy = 0; gy < L.H; gy += 24) for (let gx = 0; gx < L.W; gx += 24) {
    if (rnd() > 0.42) continue;
    const r = 1.6 + rnd() * rnd() * 7;
    const x = gx + rnd() * 24; const y = gy + rnd() * 24;
    if (busy(x, y, r)) continue;
    pit(px, x, y, r, r * 0.6, r > 4);
  }
}

// ---------- the sky over the far rim ----------

/** The black sky above the far rim: stars, a faint band of the Milky Way, and the Earth hanging in it. */
function skyS(px, L, seed) {
  const hz = (x) => 22 + Math.sin(x / 37) * 2.6 + Math.sin(x / 13 + 1) * 1.4 + (vnoise(x, 0, 6, seed) - 0.5) * 2 - 3 * Math.exp(-(((x - 268) / 30) ** 2));
  for (let x = 0; x < L.W; x += 1) {
    const top = hz(x);
    for (let y = 0; y < top + 7; y += 1) {
      const b = bayer(x, y);
      if (y < top) {
        let c = y < 7 ? SKY[0] : y < 13 ? (b < 0.5 ? SKY[0] : SKY[1]) : y < top - 3 ? SKY[1] : SKY[2];
        const band = vnoise(x, y, 18, seed + 2) * (1 - Math.abs(y - 8) / 14);
        if (band > 0.42 && b < (band - 0.42) * 3) c = SKY[3];
        const g = h2(x, y, seed + 5);
        if (g > 0.982) c = g > 0.997 ? '#ffffff' : g > 0.99 ? '#c8d8ff' : '#7a86b8';
        px(x, y, c);
        continue;
      }
      // the far rim: a hazy ridge, lit along its crest, fading into the near ground
      const r = y - top;
      if (r < 1) px(x, y, MG[6]);
      else if (r < 3) px(x, y, MG[3]);
      else if (r < 5) px(x, y, b < 0.5 ? MG[3] : MG[4]);
      else if (b < 0.4) px(x, y, MG[4]);
    }
  }
  // a few big stars, twinkling as crosses
  [[34, 6], [118, 4], [196, 10], [330, 5], [402, 9], [430, 3]].forEach(([x, y]) => {
    if (y >= hz(x) - 2) return;
    px(x, y, '#ffffff'); px(x - 1, y, '#8a9ad8'); px(x + 1, y, '#8a9ad8'); px(x, y - 1, '#8a9ad8'); px(x, y + 1, '#8a9ad8');
  });
  // the Earth: blue seas, green and sandy lands, white clouds, lit from the left, a soft blue halo
  const E = { x: 268, y: 14, r: 12.5 };
  for (let y = 0; y < 30; y += 1) for (let x = E.x - 17; x <= E.x + 17; x += 1) {
    const dx = (x + 0.5 - E.x) / E.r; const dy = (y + 0.5 - E.y) / E.r; const d = Math.hypot(dx, dy);
    if (y >= hz(x)) continue;
    if (d > 1) { if (d < 1.25 && bayer(x, y) < (1.25 - d) * 3) px(x, y, 'rgba(110,170,255,0.45)'); continue; }
    const z = Math.sqrt(1 - d * d);
    const lit = -dx * 0.75 - dy * 0.25 + z * 0.45;
    const land = vnoise((x - E.x) + 40, (y - E.y) + 40, 5.5, seed + 7);
    const cloud = vnoise((x - E.x) * 0.9 + 9, (y - E.y) * 2 + 3, 4, seed + 8);
    let c = land > 0.6 ? (land > 0.78 ? '#d8c078' : '#58b860') : '#3a7ae0';
    if (cloud > 0.64 || (Math.abs(Math.sin((y - E.y) * 0.9 + (x - E.x) * 0.25)) < 0.12 && cloud > 0.5)) c = '#f4f8ff';
    if (lit < -0.05) c = mix(c, '#0a1440', 0.65); else if (lit < 0.25) c = mix(c, '#0a1440', 0.3);
    else if (lit > 0.75 && c === '#3a7ae0') c = '#6aa8ff';
    if (d > 0.88 && lit > 0) c = mix(c, '#a8d8ff', 0.4);
    px(x, y, c);
  }
}

// ---------- the rift ----------

/**
 * The rift between morning and after school: a lip of moon rock all along, the far (north) wall
 * dropping away in ledges, the near wall hidden under its overhang, and at the bottom nothing but
 * the black of space: stars, a wisp of nebula, a little ringed planet far away.
 */
function riftS(px, L, wa, depth, seed) {
  const half = wa.w / 2;
  const ys = wa.pts.map((p) => p[1]);
  const Y0 = Math.max(0, Math.floor(Math.min(...ys) - half - 8)); const Y1 = Math.min(L.H, Math.ceil(Math.max(...ys) + half + 8));
  for (let y = Y0; y < Y1; y += 1) {
    for (let x = 0; x < L.W; x += 1) {
      const d = depth(wa, x, y);
      if (d < -6) continue;
      const b = bayer(x, y);
      const north = depth(wa, x, y - 3) < d;
      if (d < -2) { if (b < (d + 6) / 6) px(x, y, north ? MG[4] : MG[3]); continue; }
      if (d < 0.6) { px(x, y, north ? (d < -0.8 ? RK[6] : RK[5]) : (d < -0.8 ? RK[4] : RK[3])); continue; } // the rocky lip
      let c;
      if (north) {
        const wall = d / (half * 0.9);
        const ledge = (Math.floor(d + vnoise(x, y, 10, seed) * 3) % 4) === 0;
        if (wall < 0.55) c = ledge ? RK[5] : (wall < 0.25 ? RK[4] : RK[3]);
        else c = wall < 0.75 ? (b < 0.5 ? RK[2] : SKY[3]) : SKY[2];
        if (!ledge && wall < 0.5 && vnoise(x, y, 4, seed + 2) > 0.7) c = RK[3];
      } else c = d < 2 ? RK[1] : d < 3.2 && b < 0.5 ? RK[1] : SKY[2];
      const mid = half - d;
      if (mid < half * 0.55) {
        c = mid < half * 0.25 ? SKY[0] : b < 0.5 ? SKY[0] : SKY[1];
        const neb = vnoise(x, y, 14, seed + 3);
        if (neb > 0.6 && b < (neb - 0.6) * 2.4) c = h2(Math.floor(x / 40), 0, seed) < 0.5 ? '#2a1850' : '#14284e';
      }
      px(x, y, c);
    }
  }
  // stars down in the dark
  for (let y = Y0; y < Y1; y += 1) for (let x = 0; x < L.W; x += 1) {
    const g = h2(x, y, seed + 5);
    if (g < 0.985) continue;
    const d = depth(wa, x, y);
    if (d < half * 0.5) continue;
    px(x, y, g > 0.997 ? '#ffffff' : g > 0.992 ? '#ffe8a8' : '#9aaae0');
  }
  // a little ringed planet, far, far away
  const pts = wa.pts; const [ax, ay] = pts[1]; const [bx, by] = pts[2];
  const P = { x: Math.round((ax + bx) / 2 - 10), y: Math.round((ay + by) / 2) };
  if (depth(wa, P.x, P.y) > half * 0.6) {
    grid(px, P.x - 4, P.y - 3, ['...pPp...', '..pPPpp..', 'rRrrrrrRr', '..ppppd..', '...pdd...'], { p: '#e8a868', P: '#ffd8a0', d: '#a86a48', r: '#c8b8f0', R: '#f0e8ff' });
  }
}

// ---------- roads and landing plates ----------

/** Roads of packed dust: smoother and paler than the ground, two rover tracks along them, pebbles at the edge. */
function pathsS(px, L, seed) {
  const R = 6;
  const field = pathField(L.paths, R + 3);
  for (let y = 0; y < L.H; y += 1) for (let x = 0; x < L.W; x += 1) {
    const f = field(x, y);
    if (f.d > R + 2) continue;
    const b = bayer(x, y);
    if (f.d > R) { if (f.ny > 0.3 || f.nx > 0.3 ? b < 0.5 : b < 0.25) px(x, y, MG[4]); continue; } // its low side
    if (f.d > R - 1.4) {
      const along = Math.floor(f.along / 3.4);
      const peb = h2(along, f.off > 0 ? 1 : 2, seed);
      px(x, y, peb < 0.45 ? (f.ny < -0.3 || f.nx < -0.3 ? MG[7] : MG[4]) : peb < 0.8 ? MG[5] : MG[3]);
      continue;
    }
    let c = MG[6];
    const n = vnoise(x, y, 9, seed + 1);
    if (n < 0.3 + (b - 0.5) * 0.2) c = mix(MG[6], MG[5], 0.5); else if (n > 0.76) c = MG[7];
    // rover tracks: two treaded lines along the road
    const tr = Math.abs(Math.abs(f.off) - 2.6);
    if (tr < 0.6) c = Math.floor(f.along) % 3 === 0 ? MG[4] : MG[5];
    const g = h2(x, y, seed + 2);
    if (g < 0.03) c = MG[4]; else if (g > 0.985) c = MG[8];
    px(x, y, c);
  }
}

/** A round landing plate: steel plates in rings, rivets, a hazard ring at its rim and little lights. */
function plateS(px, cx, cy, r, seed) {
  groundShadow(px, cx + 2, cy + 3, r + 2, r * 0.9, 0.22);
  for (let y = Math.floor(cy - r - 3); y <= cy + r + 3; y += 1) for (let x = Math.floor(cx - r - 3); x <= cx + r + 3; x += 1) {
    const dx = x + 0.5 - cx; const dy = y + 0.5 - cy; const d = Math.hypot(dx, dy);
    if (d > r + 1.5) continue;
    const a = Math.atan2(dy, dx); const lit = (dx + dy) / r;
    if (d > r) { px(x, y, dy > 0 ? ST[1] : ST[3]); continue; } // the edge
    if (d > r - 3) { // the hazard ring
      const seg = Math.floor(((a + Math.PI) / (Math.PI * 2)) * 24 + d * 0.3) % 2;
      px(x, y, seg ? (lit < 0 ? HZ[3] : HZ[2]) : '#2e2c40');
      continue;
    }
    const ring = Math.floor(d / 6); const n = Math.max(6, ring * 6 + 6);
    const u = ((a + Math.PI) / (Math.PI * 2)) * n;
    const seam = d % 6 < 0.9 || u % 1 < 0.1;
    let c = seam ? ST[2] : lit < -0.45 ? ST[6] : lit > 0.45 ? ST[4] : ST[5];
    if (!seam && h2(Math.floor(u), ring, seed) < 0.2) c = mix(c, ST[3], 0.4);
    if (!seam && (u % 1 > 0.42 && u % 1 < 0.58) && d % 6 > 4.4) c = ST[7]; // rivets
    if (d < 4) c = d < 2.2 ? '#7af0ff' : ST[3]; // the beacon in the middle
    px(x, y, c);
  }
  for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2 + 0.4; const x = Math.round(cx + Math.cos(a) * (r + 0.5)); const y = Math.round(cy + Math.sin(a) * (r + 0.5)); px(x, y, '#8af4ff'); px(x, y + 1, '#3aa8c8'); }
}

// ---------- the gangway ----------

/** The metal gangway over the rift: a deck of ridged plates, yellow rails on posts, a lamp at each end. */
function gangwayS(px, c) {
  const { x: X, y: Y, w, h } = c;
  const x0 = Math.round(X + 2); const x1 = Math.round(X + w - 2);
  groundShadow(px, X + w / 2 + 3, Y + h / 2 + 2, w / 2 + 2, h / 2, 0.3);
  propB(px, x0 - 2, Math.round(Y) - 2, x1 - x0 + 4, Math.round(h) + 4, (b) => {
    const H0 = Math.round(h) + 4; const W0 = x1 - x0 + 4;
    for (let y = 2; y < H0 - 2; y += 1) for (let x = 3; x < W0 - 3; x += 1) {
      const r = (y - 2) % 10; const ridge = (y - 2) % 2 === 0;
      let col = r === 9 ? ST[1] : r === 0 ? ST[6] : ridge ? ST[5] : ST[4];
      if (x === 3 || x === W0 - 4) col = ST[2];
      if ((r === 1 || r === 8) && (x === 5 || x === W0 - 6)) col = ST[7]; // bolts
      b.set(x, y, col, 'steel');
    }
    // hazard stripes at each end
    for (const yy of [2, 3, H0 - 4, H0 - 3]) for (let x = 3; x < W0 - 3; x += 1) b.set(x, yy, (x + yy) % 6 < 3 ? HZ[2] : '#2e2c40', 'hazard');
    // the rails: yellow, on posts
    for (const side of [0, W0 - 3]) for (let y = 0; y < H0; y += 1) for (let k = 0; k < 3; k += 1) {
      const post = y % 10 === 0;
      b.set(side + k, y, post ? (k === 1 ? ST[6] : ST[3]) : k === 1 ? HZ[2] : k === (side ? 2 : 0) ? HZ[1] : HZ[3], 'rail');
    }
  }, { outline: (t, side) => (side === 'bottom' ? INK : t === 'rail' ? HZ[0] : side === 'right' ? ST[0] : ST[1]) });
  // little lights on the end posts
  for (const [x, y] of [[x0, Y - 1], [x1 - 1, Y - 1], [x0, Y + h], [x1 - 1, Y + h]]) { px(x, y, '#ff6a6a'); px(x, y - 1, 'rgba(255,120,120,0.35)'); }
}

// ---------- outlines ----------

const EDGE = {
  steel: [ST[2], ST[1]], hull: [ST[2], ST[1]], rock: [RK[2], RK[1]], glass: null, dust: [MG[3], MG[2]],
};
const GROUNDED = new Set(['steel', 'hull', 'rock', 'dust']);
/** Each material edged in a darker shade of itself (lit sides softer); ink only where things meet the ground. */
function sel(tag, side) {
  const t = String(tag || '').split(':')[0];
  if (side === 'bottom' && GROUNDED.has(t)) return INK;
  const e = EDGE[t];
  if (e === null) return null;
  if (!e) return side === 'bottom' || side === 'right' ? '#1c1c34' : '#2c2c4a';
  return side === 'bottom' || side === 'right' ? e[1] : e[0];
}

// ---------- the habitats ----------

/**
 * A habitat: a short white metal drum with panel seams and a hazard-striped foot, warm round
 * windows and an airlock door; over it a glass dome in the house's color held in steel ribs,
 * glossy where the light catches it, an antenna on top with a red light. o: { glass, door, sign, home }.
 */
function habitatS(px, X, Y, w, h, o = {}) {
  const G = ramp(o.glass || '#74c0fc', 3, 3);
  const D = ramp(o.door || '#5a6a9a', 2, 2);
  const cx = w / 2; const baseH = Math.round(h * 0.36); const wallTop = h - baseH;
  const ry = wallTop + 2; const rx = w / 2 - 3;
  groundShadow(px, X + w / 2 + 4, Y + h - 1, w / 2 + 2, 4, 0.28);
  propB(px, X, Y, w, h, (b) => {
    for (let y = wallTop - 2; y < h; y += 1) for (let x = 1; x < w - 1; x += 1) {
      const u = (x + 0.5 - cx) / (w / 2 - 1);
      const bot = h - 1 - Math.round((1 - Math.sqrt(Math.max(0, 1 - u * u))) * 3);
      if (y > bot) continue;
      let c = u < -0.55 ? ST[7] : u < 0.15 ? ST[6] : u < 0.62 ? ST[5] : ST[4];
      if (y >= bot - 2) c = ((x + y) % 6 < 3) ? (y === bot ? HZ[1] : HZ[2]) : (y === bot ? '#24223a' : '#34324a'); // a hazard-striped foot
      if (y >= wallTop && y <= wallTop + 1) c = y === wallTop ? ST[6] : ST[3]; // the ring under the dome
      if (y > wallTop + 1 && y < bot - 2 && (x + 4) % 12 === 0) c = mix(c, ST[2], 0.45); // panel seams
      if (y > wallTop + 1 && y < bot - 2 && (x + 4) % 12 === 2 && (y - wallTop) % 5 === 2) c = ST[3]; // rivets
      b.set(x, y, c, 'hull');
    }
    // the dome: colored glass in steel ribs, a round shine at its top left
    for (let y = 0; y < wallTop; y += 1) for (let x = 0; x < w; x += 1) {
      const dx = (x + 0.5 - cx) / rx; const dy = (y + 0.5 - ry) / ry;
      if (dx * dx + dy * dy > 1) continue;
      const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
      const lit = -dx * 0.55 - dy * 0.45 + z * 0.55;
      let k = lit > 0.62 ? 5 : lit > 0.38 ? 4 : lit > 0.1 ? 3 : lit > -0.15 ? 2 : 1;
      const lon = Math.asin(clamp(dx / Math.sqrt(Math.max(0.0001, 1 - dy * dy)), -1, 1)) / (Math.PI / 2);
      const rib = Math.abs(((lon * 2.5 + 3) % 1) - 0.5) > 0.45 || Math.abs(dy + 0.5) < 0.03;
      if (rib) { b.set(x, y, lit > 0.35 ? ST[6] : lit > 0 ? ST[5] : ST[3], 'steel'); continue; }
      if (inEll(x, y, cx - rx * 0.42, ry * 0.42, rx * 0.2, ry * 0.12)) k = 6;
      if (inEll(x, y, cx - rx * 0.22, ry * 0.3, rx * 0.05, ry * 0.05)) k = 6;
      b.set(x, y, G[k], 'glass');
    }
    // the antenna on top: a mast, a crossbar and a ball for the light
    for (let y = -10; y < 1; y += 1) { b.set(Math.round(cx), y, ST[5], 'steel'); b.set(Math.round(cx) + 1, y, ST[3], 'steel'); }
    for (let x = -3; x <= 4; x += 1) b.set(Math.round(cx) + x, -6, ST[4], 'steel');
    grid((x, y, c) => b.set(x, y, c, 'light'), Math.round(cx) - 1, -13, ['.rr.', 'rRrr', '.rr.'], { r: '#e8384a', R: '#ffb0b0' });
    // round windows, glowing warm
    for (const fx of [0.2, 0.8]) {
      const ox = Math.round(w * fx) - 4; const oy = wallTop + Math.round(baseH * 0.22);
      grid((x, y, c) => b.set(x, y, c, 'steel'), ox, oy, ['..ssss..', '.sSwwSs.', 'sSwWWwSs', 'swWYYWws', 'swWYYWws', 'sSwWWwSs', '.sSwwSs.', '..ssss..'], { s: ST[2], S: ST[4], w: GW[3], W: GW[2], Y: GW[4] });
    }
    // the airlock door: a rounded hatch in a striped frame, a little window, a step
    const dw = Math.max(12, Math.round(w * 0.16)); const dh = Math.round(baseH * 0.86); const dx0 = Math.round(cx - dw / 2); const dy0 = h - dh - 1;
    for (let y = dy0 - 1; y < h - 1; y += 1) for (let x = dx0 - 1; x < dx0 + dw + 1; x += 1) {
      const rr = 4; const ix = clamp(x + 0.5, dx0 - 1 + rr, dx0 + dw + 1 - rr); const iy = Math.max(y + 0.5, dy0 - 1 + rr);
      if (Math.hypot(x + 0.5 - ix, y + 0.5 - iy) > rr) continue;
      const frame = x < dx0 || x >= dx0 + dw || y < dy0 || Math.hypot(x + 0.5 - clamp(x + 0.5, dx0 + rr - 1, dx0 + dw - rr + 1), y + 0.5 - Math.max(y + 0.5, dy0 + rr - 1)) > rr - 1.2;
      b.set(x, y, frame ? ST[3] : x < cx - 1 ? D[3] : x === Math.round(cx) - 1 ? D[1] : D[2], 'door');
    }
    grid((x, y, c) => b.set(x, y, c, 'steel'), Math.round(cx) - 2, dy0 + 2, ['.ss.', 'sWws', 'swws', '.ss.'], { s: ST[3], W: '#e8f8ff', w: '#8ac8f0' });
    b.set(dx0 + dw - 3, dy0 + Math.round(dh * 0.55), '#7aff9a', 'light'); // the airlock's green "open" light
    if (o.sign) grid((x, y, c) => b.set(x, y, c, 'sign'), Math.round(cx) - 5, wallTop + 3, ['bbbbbbbbbb', 'bwwwwkkwwb', 'bwwwwkwkwb', 'bwwwwkwwwb', 'bwwkkkwwwb', 'bwkkkkwwwb', 'bwwkkwwwwb', 'bbbbbbbbbb'], { b: ST[2], w: '#fff8e8', k: '#3a2a5a' });
    // a pennant in the dome's color on the antenna, for the kid's own house
    if (o.home) grid((x, y, c) => b.set(x, y, c, 'flag'), Math.round(cx) + 2, -10, ['ggGg', 'gggg.', 'gg'], { g: G[3], G: G[5] });
    // little landing feet
    for (const fx of [5, w - 9]) grid((x, y, c) => b.set(x, y, c, 'steel'), fx, h - 2, ['.ss.', 'ssSs'], { s: ST[3], S: ST[5] });
  }, { pad: 15, outline: (t, side) => (t === 'glass' ? (side === 'bottom' || side === 'right' ? G[0] : G[1]) : t === 'door' ? D[0] : t === 'flag' || t === 'light' ? null : t === 'sign' ? ST[1] : sel(t, side)) });
  // the red light's glow
  for (let y = -4; y <= 4; y += 1) for (let x = -4; x <= 4; x += 1) { const d = Math.hypot(x, y); if (d > 1.6 && d < 4.2 && bayer(X + cx + x, Y + y) < 0.5) px(Math.round(X + cx + x), Y - 12 + y, 'rgba(255,90,90,0.22)'); }
}

// ---------- the shop ----------

/** The shop: a kiosk with a striped awning on steel posts over a counter of moon rocks, crystals and space treats. */
function stallS(px, X, Y, pal = {}) {
  const A = ramp(pal.a || '#ffd43b', 2, 2);
  groundShadow(px, X + 23, Y + 32, 23, 3, 0.26);
  propB(px, X, Y, 44, 33, (b) => {
    for (const x0 of [3, 38]) for (let y = 10; y < 33; y += 1) { b.set(x0, y, ST[5], 'steel'); b.set(x0 + 1, y, ST[3], 'steel'); }
    for (let y = 20; y < 32; y += 1) for (let x = 1; x < 43; x += 1) b.set(x, y, y === 20 ? ST[7] : y === 21 ? ST[6] : (x - 1) % 10 === 0 ? ST[3] : y > 29 ? ST[4] : ST[5], 'steel');
    for (let x = 4; x < 40; x += 1) b.set(x, 25, (x % 4 < 2) ? '#7af0ff' : ST[4], 'steel'); // a strip of little lights
    // goods: a jar of glowing crystals, moon rocks, a packet of space ice cream, a toy rocket
    grid((x, y, c) => b.set(x, y, c, 'goods'), 5, 13, ['.kk.', 'gggg', 'gCcg', 'gcCg', 'gggg'], { k: ST[3], g: '#b8e8f8', C: '#7af0ff', c: '#d8f8ff' });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 11, 16, ['.rr..r.', 'rRrrrRr', 'rrrrrrr'], { r: RK[4], R: RK[6] });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 20, 13, ['pppp', 'pWwp', 'pwWp', 'pppp', 'pppp'], { p: '#f0f0ff', W: '#ff9ac8', w: '#8ad8ff' });
    grid((x, y, c) => b.set(x, y, c, 'goods'), 28, 11, ['..r..', '.rWr.', '.rrr.', '.yyy.', 'r.r.r'], { r: '#ff6a6a', W: '#bfe8ff', y: '#ffd43b' });
    // the striped awning, scalloped
    for (let y = 0; y < 12; y += 1) for (let x = 0; x < 44; x += 1) {
      const u = (x + 0.5 - 22) / 22; const top = Math.round(4 * u * u);
      const hem = 9 + Math.round(Math.abs(Math.sin(((x + 0.5) / 44) * Math.PI * 5.5)) * 2);
      if (y < top || y > hem) continue;
      const stripe = Math.floor((x + 0.5) / 44 * 11) % 2;
      b.set(x, y, stripe ? (y === hem ? ST[3] : ST[1]) : (y === hem ? A[1] : u < -0.4 ? A[3] : A[2]), 'awning');
    }
    for (let y = -6; y < 1; y += 1) b.set(40, y, ST[4], 'steel');
    b.set(40, -7, '#7aff9a', 'goods');
  }, { pad: 9, outline: (t, side) => (t === 'goods' ? null : t === 'awning' ? (side === 'bottom' ? A[0] : ST[1]) : sel(t, side)) });
}

// ---------- the things of a moon base ----------

/** A crater, w x h, flat in the ground: a raised lit rim, its inner walls in light and shade, pebbles inside. */
function craterS(px, X, Y, w = 36, h = 18) {
  pit(px, X + w / 2, Y + h / 2, w / 2 - 2, h / 2 - 1.5, 1);
  [[0.4, 0.62], [0.58, 0.55], [0.5, 0.72]].forEach(([fx, fy], i) => { const x = Math.round(X + w * fx); const y = Math.round(Y + h * fy); px(x, y, MG[6]); px(x + 1, y, MG[5]); if (i === 0) px(x, y + 1, MG[3], 2, 1); });
}

/** Moon crystals, 20 x 24, in color c: three faceted shards lit on one face, a glow on the dust round them. */
function crystalS(px, X, Y, c = '#99e9f2') {
  const C = ramp(c, 3, 3);
  for (let y = 14; y < 26; y += 1) for (let x = -2; x < 22; x += 1) { const d = Math.hypot((x - 10) / 12, (y - 22) / 4); if (d < 1 && bayer(X + x, Y + y) < (1 - d) * 1.2) px(X + x, Y + y, `rgba(${parseInt(c.slice(1, 3), 16)},${parseInt(c.slice(3, 5), 16)},${parseInt(c.slice(5, 7), 16)},0.28)`); }
  groundShadow(px, X + 11, Y + 23, 7, 1.5, 0.22);
  propB(px, X, Y, 20, 24, (b) => {
    const shards = [[10, 0, 4, 24], [4, 9, 3, 24], [16, 11, 3, 24]];
    for (const [cx, top, half, bot] of shards) {
      for (let y = top; y < bot; y += 1) {
        const t = (y - top) / 4; const hw = Math.min(half, t * half);
        for (let x = Math.floor(cx - hw); x <= cx + hw; x += 1) {
          const left = x + 0.5 < cx;
          b.set(x, y, y - top < 2 ? C[6] : left ? (x + 0.5 < cx - hw + 1.2 ? C[5] : C[4]) : (x + 0.5 > cx + hw - 1 ? C[1] : C[2]), 'crystal');
        }
      }
    }
    b.set(9, 5, '#ffffff', 'crystal'); b.set(9, 6, C[6], 'crystal'); b.set(3, 13, '#ffffff', 'crystal');
    for (let x = 1; x < 20; x += 1) b.set(x, 23, x % 3 ? RK[4] : RK[3], 'rock');
  }, { outline: (t, side) => (t === 'rock' ? (side === 'bottom' ? INK : RK[2]) : side === 'bottom' || side === 'right' ? C[0] : C[1]) });
}

/** A moon boulder or rock, lit on the upper left, pocked with little pits, now and then a crystal growing from it. */
function boulderS(px, X, Y, w = 34, h = 26) {
  groundShadow(px, X + w / 2 + 2, Y + h - 1, w / 2 + 1, 2.6, 0.26);
  const xtal = h2(X, Y, 5) < 0.3 && w > 26;
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const wob = (vnoise(x + X, y + Y, 5, 5) - 0.5) * 0.24;
      if (!inEll(x, y, w / 2, h * 0.56, w / 2 * (1 + wob), h * 0.56 * (1 + wob)) || y > h - 2) continue;
      const s = (x + 0.5 - w / 2) / w * 1.6 + (y + 0.5 - h / 2) / h * 1.8;
      let c = s < -0.95 ? RK[7] : s < -0.35 ? RK[6] : s > 0.75 ? RK[4] : RK[5];
      if (y > h - 5) c = bayer(x, y) < 0.5 ? RK[4] : RK[3];
      b.set(x, y, c, 'rock');
    }
    // pits
    [[0.34, 0.36, 2], [0.64, 0.5, 1.5], [0.46, 0.66, 1.2]].forEach(([fx, fy, r]) => { const x = Math.round(w * fx); const y = Math.round(h * fy); if (b.tag(x, y) !== 'rock') return; b.set(x, y, RK[3], 'rock'); if (r > 1.4) { b.set(x + 1, y, RK[4], 'rock'); b.set(x, y + 1, RK[6], 'rock'); b.set(x + 1, y + 1, RK[6], 'rock'); } });
    if (xtal) grid((x, y, c) => b.set(x, y, c, 'xtal'), Math.round(w * 0.62), Math.round(h * 0.02), ['.c.', 'cCc', 'cCd', 'cCd'], { c: '#9af0ff', C: '#e0fcff', d: '#3aa8c8' });
  }, { outline: (t, side) => (t === 'xtal' ? '#2a6a8a' : sel(t, side)) });
}

/** A radar dish, 28 x 32, on a white stand: the bowl turned up to the sky, a feed on struts, a red light. */
function dishS(px, X, Y) {
  groundShadow(px, X + 15, Y + 30, 10, 2.2, 0.26);
  propB(px, X, Y, 28, 32, (b) => {
    // the stand
    for (let y = 18; y < 31; y += 1) for (let x = 10; x < 18; x += 1) { if (y < 22 && (x < 12 || x > 15)) continue; b.set(x, y, x < 13 ? ST[6] : x < 15 ? ST[5] : ST[4], 'steel'); }
    for (let x = 7; x < 21; x += 1) b.set(x, 30, x < 12 ? ST[5] : ST[3], 'steel');
    // the bowl, tilted towards the upper left
    for (let y = 2; y < 20; y += 1) for (let x = 0; x < 28; x += 1) {
      const u = (x + 0.5 - 13) / 13; const v = (y + 0.5 - 11) / 7.5;
      const rot = u * 0.94 + v * 0.34; const rv = -u * 0.34 + v * 0.94;
      const d = rot * rot + rv * rv;
      if (d > 1) continue;
      const inner = rot * rot / 0.86 + (rv + 0.18) * (rv + 0.18) / 0.5 < 1;
      b.set(x, y, inner ? (rv < -0.2 ? ST[5] : rv < 0.3 ? ST[6] : ST[7]) : (rv > 0.3 ? ST[4] : ST[5]), 'dish');
    }
    // the feed on its struts
    for (let k = 0; k < 8; k += 1) { b.set(13 - k, 10 - k, ST[3], 'steel'); b.set(13 + Math.round(k * 0.2) - k, 12 - k, ST[3], 'steel'); }
    grid((x, y, c) => b.set(x, y, c, 'steel'), 3, 0, ['.ss.', 'sSSs', '.ss.'], { s: ST[3], S: ST[6] });
    grid((x, y, c) => b.set(x, y, c, 'light'), 15, 22, ['r', 'R'], { r: '#ff6a6a', R: '#c82a3a' });
  }, { outline: (t, side) => (t === 'light' ? null : t === 'dish' ? (side === 'bottom' || side === 'right' ? ST[2] : ST[3]) : sel(t, side)) });
}

/** A lamp post, 10 x 32: a slim steel post with a glowing cap of light in color c, its pool of light on the dust. */
function lampS(px, X, Y, c = '#74c0fc') {
  const C = ramp(c, 2, 2);
  for (let y = 22; y < 36; y += 1) for (let x = -8; x < 18; x += 1) { const d = Math.hypot((x - 5) / 13, (y - 30) / 5); if (d < 1 && bayer(X + x, Y + y) < (1 - d) * 1.1) px(X + x, Y + y, 'rgba(150,220,255,0.2)'); }
  groundShadow(px, X + 6, Y + 31, 4, 1.4, 0.24);
  propB(px, X, Y, 10, 32, (b) => {
    for (let y = 7; y < 31; y += 1) { b.set(4, y, ST[6], 'steel'); b.set(5, y, ST[4], 'steel'); }
    for (let x = 2; x < 8; x += 1) { b.set(x, 30, ST[5], 'steel'); b.set(x, 31, ST[3], 'steel'); }
    grid((x, y, col) => b.set(x, y, col, 'lamp'), 1, 0, ['.ssss.', 'sLLLLs', 'LWWLLL', 'LWLLLL', '.LLLL.', '.ssss.', '..ss..'], { s: ST[3], L: C[3], W: '#ffffff' });
  }, { outline: (t, side) => (t === 'lamp' ? (side === 'bottom' || side === 'right' ? C[0] : C[1]) : sel(t, side)) });
  for (let y = -3; y < 9; y += 1) for (let x = -3; x < 13; x += 1) { const d = Math.hypot((x - 4.5) / 7, (y - 3) / 5.5); if (d < 1 && d > 0.5 && bayer(X + x, Y + y) < 0.5) px(X + x, Y + y, 'rgba(160,230,255,0.3)'); }
}

/** A planted flag, 16 x 30: a pole with a stiff flag held out by a top bar (no wind on the moon), boot prints at its foot. */
function flagS(px, X, Y, c = '#ff6b6b') {
  const F = ramp(c, 2, 2);
  groundShadow(px, X + 3, Y + 29, 4, 1.2, 0.24);
  propB(px, X, Y, 16, 30, (b) => {
    for (let y = 0; y < 30; y += 1) { b.set(1, y, ST[6], 'steel'); b.set(2, y, ST[4], 'steel'); }
    for (let x = 3; x < 16; x += 1) b.set(x, 1, ST[5], 'steel');
    for (let y = 2; y < 12; y += 1) for (let x = 3; x < 16; x += 1) {
      const wave = Math.round(Math.sin(x / 2.6) * 0.8);
      if (y + wave < 2 || y + wave > 11) continue;
      b.set(x, y, (y - 2) % 4 < 2 ? F[2] : F[3], 'flag');
    }
    grid((x, y, col) => b.set(x, y, col, 'star'), 4, 3, ['.w.', 'www', '.w.'], { w: '#ffffff' });
  }, { outline: (t, side) => (t === 'star' ? null : t === 'flag' ? F[0] : sel(t, side)) });
  [[6, 26], [10, 29], [-6, 27], [-2, 30]].forEach(([dx, dy]) => grid(px, X + dx, Y + dy, ['dd', 'dd', '.d'], { d: MG[4] }));
}

/** The clothesline on the moon: two steel poles with little lights, colorful washing pegged out, and a tiny space suit. */
function laundryS(px, X, Y, w) {
  const sag = (x) => Math.round(Math.sin(((x - X) / (w - 6)) * Math.PI) * 3);
  groundShadow(px, X + 2, Y + 26, 4, 1.3, 0.24); groundShadow(px, X + w - 2, Y + 26, 4, 1.3, 0.24);
  for (const x of [X, X + w - 4]) {
    propB(px, x - 3, Y, 10, 27, (b) => {
      b.rect(4, 2, 1, 25, ST[6], 'steel'); b.rect(5, 2, 1, 25, ST[4], 'steel'); b.rect(6, 2, 1, 25, ST[3], 'steel');
      b.rect(1, 1, 9, 1, ST[6], 'steel'); b.rect(1, 2, 9, 1, ST[3], 'steel');
      b.set(5, 0, '#7af0ff', 'light');
    }, { outline: (t, side) => (t === 'light' ? null : sel(t, side)) });
  }
  for (let x = X + 4; x < X + w - 4; x += 1) { px(x, Y + 3 + sag(x), '#e8eaf4'); px(x, Y + 4 + sag(x), '#8a8eaa'); }
  const items = [['#ff6b6b', 'shirt'], ['#4dabf7', 'sock'], ['#f4f4fa', 'suit'], ['#69db7c', 'sock'], ['#b197fc', 'shirt']];
  let x = X + 8;
  items.forEach(([col, kind]) => {
    if (x > X + w - 14) return;
    const y = Y + 4 + sag(x);
    const P = ramp(col, 2, 2);
    const rows = kind === 'shirt'
      ? ['..mlllllmm...', 'mlllmmmmmmmd.', 'llmmmmmmmmmdd', '.d.mmmmmmmd.d', '...mmmmmmmd..', '...mmmmmmmd..', '...mmmmmmmd..', '...mmmmmmdd..', '...dddddddd..']
      : kind === 'suit'
        ? ['..mllllmm..', 'llmmmmmmmdd', 'lmmmrrmmmmd', 'l.mmmmmmm.d', '..mmmmmmm..', '..mmmmmmm..', '..mmm.mmm..', '..mmm.mmm..', '..mmd.mmd..', '..rrr.rrr..']
        : ['mmmm', 'mlmm', 'mmmm', 'mmmm', 'mmmm', 'mmmmdd', 'dmmmmd', '.dddd.'];
    const width = rows[0].length;
    propB(px, x - 3, y, width + 3, rows.length + 2, (b) => {
      grid((xx, yy, c) => b.set(xx, yy, c, 'cloth'), 0, 0, rows, kind === 'suit' ? { l: '#ffffff', m: '#e4e6f0', d: '#a8acc4', r: '#ff6a6a' } : { l: P[3], m: P[2], d: P[1] });
    }, { outline: (t, side) => (side === 'top' ? null : kind === 'suit' ? '#6a6e8a' : side === 'bottom' || side === 'right' ? P[0] : mix(P[0], P[1], 0.5)) });
    px(x + 1, y - 1, ST[5]); px(x + 1, y, ST[3]);
    x += width + 3;
  });
}

// ---------- the green, on the moon ----------

const GOO = ['#0c3428', '#12503a', '#1a7046', '#28944e', '#48b45a', '#7cd47a', '#bdf0a8', '#e8ffd8'];

/** The fishing spot: a crater full of glowing green moon goo, a lit rocky rim, its far wall showing, bubbles on top. */
function gooS(px, Z, seed) {
  const mid = Z.y + Z.h / 2;
  for (let y = Z.y - 5; y < Z.y + Z.h + 5; y += 1) for (let x = Z.x - 5; x < Z.x + Z.w + 5; x += 1) {
    const k = oval(Z, x, y); const north = y + 0.5 < mid; const b = bayer(x, y);
    if (k < 0) {
      if (oval(grow(Z, 2), x, y) >= 0) px(x, y, north ? (oval(grow(Z, 1), x, y) >= 0 ? RK[5] : RK[6]) : RK[3]);
      else if (oval(grow(Z, 4.5), x, y) >= 0 && b < 0.5) px(x, y, north ? MG[6] : MG[3]);
      continue;
    }
    let c;
    if (north && oval(grow(Z, -4), x, y) < 0) c = oval(grow(Z, -2), x, y) < 0 ? RK[4] : RK[3]; // the far wall
    else if (!north && oval(grow(Z, -1.5), x, y) < 0) c = RK[1]; // the near wall in shade
    else {
      // the goo: brighter towards the middle, slow swirls of light
      c = k > 0.55 ? GOO[4] : k > 0.25 ? (b < 0.5 ? GOO[4] : GOO[3]) : GOO[3];
      const sw = Math.sin((x - Z.x) / 7 + Math.sin((y - Z.y) / 5) * 2 + vnoise(x, y, 9, seed) * 4);
      if (sw > 0.86) c = GOO[5]; else if (sw < -0.9 && b < 0.5) c = GOO[2];
      if (oval(grow(Z, -6), x, y) < 0 && north) c = b < 0.5 ? GOO[2] : GOO[3];
    }
    px(x, y, c);
  }
  // bubble rings and glints
  const rnd = rng(seed);
  for (let i = 0; i < 5; i += 1) {
    const x = Math.round(Z.x + 14 + rnd() * (Z.w - 28)); const y = Math.round(Z.y + 12 + rnd() * (Z.h - 18));
    if (oval(grow(Z, -7), x, y) < 0) continue;
    if (i % 2) grid(px, x - 1, y - 1, ['.g.', 'g.g', '.g.'], { g: GOO[6] }); else { px(x, y, GOO[7]); px(x + 1, y, GOO[6]); }
  }
  // a little glow on the dust round it
  for (let y = Z.y - 9; y < Z.y + Z.h + 9; y += 1) for (let x = Z.x - 9; x < Z.x + Z.w + 9; x += 1) { const k = oval(grow(Z, 8), x, y); if (k > 0 && oval(grow(Z, 2.5), x, y) < 0 && bayer(x, y) < k * 1.1) px(x, y, 'rgba(120,255,150,0.13)'); }
}

/** A goal frame of steel tube with a net, its mouth facing dir. */
function netGoalS(px, X, Y, w, h, dir) {
  groundShadow(px, X + w / 2 + 1, Y + h, w / 2 + 2, 1.6, 0.24);
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) for (let i = 0; i < w; i += 1) {
      const x = dir > 0 ? i : w - 1 - i;
      if (i >= w - 2) b.set(x, y, i === w - 2 ? ST[7] : ST[4], 'steel');
      else if (y === 0 || y === h - 1) b.set(x, y, y === 0 ? ST[7] : ST[3], 'steel');
      else if (i === 0) b.set(x, y, ST[4], 'steel');
      else if ((i + y) % 3 === 0 || (i - y + 99) % 3 === 0) b.set(x, y, 'rgba(236,240,255,0.8)', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : sel(t, side)) });
}

/** A pitch on the moon: a smoothed, raked patch of pale dust ringed with stones, white lines, steel goals or yellow posts. */
function courtS(px, Z, kind, seed) {
  if (kind === 'hockey') { rinkS(px, Z, seed); return; }
  const P = { x: Z.x - 4, y: Z.y - 3, w: Z.w + 8, h: Z.h + 6 };
  for (let y = P.y - 2; y < P.y + P.h + 2; y += 1) for (let x = P.x - 2; x < P.x + P.w + 2; x += 1) {
    const inside = inRound(x, y, P.x, P.y, P.w, P.h, 12);
    if (!inside) { if (inRound(x, y, P.x - 2, P.y - 2, P.w + 4, P.h + 4, 14)) { const peb = h2(Math.floor(x / 3), Math.floor(y / 3), seed); px(x, y, peb < 0.4 ? MG[4] : peb < 0.7 ? MG[7] : MG[5]); } continue; }
    const rake = (y - P.y) % 3 === 0;
    const n = vnoise(x, y, 14, seed) + (bayer(x, y) - 0.5) * 0.2;
    px(x, y, rake ? MG[6] : n < 0.3 ? MG[6] : n > 0.72 ? MG[8] : MG[7]);
  }
  const line = (x, y) => px(x, y, '#f4f6ff');
  const L0 = { x: Z.x + 2, y: Z.y + 1, w: Z.w - 4, h: Z.h - 3 };
  for (let x = L0.x + 2; x < L0.x + L0.w - 2; x += 1) { line(x, L0.y); line(x, L0.y + L0.h); }
  for (let y = L0.y + 1; y < L0.y + L0.h; y += 1) { line(L0.x, y); line(L0.x + L0.w, y); }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = L0.y + 1; y < L0.y + L0.h; y += 1) line(mx, y);
  for (let a = 0; a < 40; a += 1) { const t = (a / 40) * Math.PI * 2; line(Math.round(mx + Math.cos(t) * 7), Math.round(mid + Math.sin(t) * 5)); }
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
  netGoalS(px, Z.x - 1, mid - 8, 9, 16, 1); netGoalS(px, Z.x + Z.w - 8, mid - 8, 9, 16, -1);
}

/** The hockey rink: a shallow crater of smooth blue ice, worn glassy, with red and blue lines and little red nets. */
function rinkS(px, Z, seed) {
  const R = { x: Z.x - 3, y: Z.y - 2, w: Z.w + 6, h: Z.h + 5 };
  const I = ['#4a6aa8', '#6a8ac8', '#9ab8e4', '#c4dcf4', '#e4f0fc', '#ffffff'];
  for (let y = R.y - 2; y < R.y + R.h + 2; y += 1) for (let x = R.x - 2; x < R.x + R.w + 2; x += 1) {
    if (!inRound(x, y, R.x - 2, R.y - 2, R.w + 4, R.h + 4, 12)) continue;
    if (!inRound(x, y, R.x, R.y, R.w, R.h, 10)) { px(x, y, y < R.y + R.h / 2 ? MG[7] : MG[3]); continue; } // the lip of the crater
    const edge = !inRound(x, y, R.x + 2, R.y + 2, R.w - 4, R.h - 4, 8);
    if (edge) { px(x, y, y < R.y + R.h / 2 ? I[1] : I[2]); continue; }
    const c = (x - y * 1.4) % 34 < 4 && bayer(x, y) < 0.5 ? I[5] : vnoise(x, y, 16, seed) > 0.62 && bayer(x, y) < 0.5 ? I[3] : I[4];
    px(x, y, c);
  }
  const mx = Math.round(Z.x + Z.w / 2); const mid = Math.round(Z.y + Z.h / 2);
  for (let y = R.y + 3; y < R.y + R.h - 2; y += 1) { px(mx - 1, y, '#e8485a'); px(mx, y, '#ff6a7a'); }
  for (const lx of [Math.round(Z.x + Z.w * 0.3), Math.round(Z.x + Z.w * 0.7)]) for (let y = R.y + 3; y < R.y + R.h - 2; y += 1) px(lx, y, '#4a8ae8');
  for (let a = 0; a < 44; a += 1) { const t = (a / 44) * Math.PI * 2; px(Math.round(mx + Math.cos(t) * 8), Math.round(mid + Math.sin(t) * 6), '#4a8ae8'); }
  const goal = (x, dir) => propB(px, x, mid - 6, 6, 12, (b) => {
    for (let y = 0; y < 12; y += 1) for (let i = 0; i < 6; i += 1) {
      const xx = dir > 0 ? i : 5 - i;
      if (i >= 4) b.set(xx, y, i === 4 ? '#ff8a8a' : '#d8384a', 'red');
      else if (y === 0 || y === 11) b.set(xx, y, y === 0 ? '#ff8a8a' : '#d8384a', 'red');
      else if (i === 0) b.set(xx, y, '#d8384a', 'red');
      else if ((i + y) % 2 === 0) b.set(xx, y, 'rgba(255,255,255,0.75)', 'net');
    }
  }, { outline: (t, side) => (t === 'net' ? null : side === 'bottom' ? INK : '#a82040') });
  goal(Z.x + 2, 1); goal(Z.x + Z.w - 8, -1);
}

// ---------- little things on the dust ----------

/** Pebbles, tiny crystals, glints and pairs of boot prints, scattered where nothing else is. */
function scatterS(px, L, areas, seed) {
  const busy = (x, y) => L.blocked(x, y, 7) || L.onPath(x, y, 10) || L.inWater(x, y, 6) || areas.some((a) => x > a.x - 12 && x < a.x + a.w + 12 && y > a.y - 12 && y < a.y + a.h + 12);
  const rnd = rng(seed);
  for (let i = 0; i < (L.W * L.H) / 520; i += 1) {
    const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H); const k = rnd(); const v = Math.floor(rnd() * 4);
    if (Math.min(x, L.W - x) < 26 || y < 34 || y > L.H - 26 || busy(x, y)) continue;
    if (k < 0.4) { px(x, y, MG[7]); px(x + 1, y, MG[5]); px(x, y + 1, MG[3], 2, 1); } // a pebble
    else if (k < 0.55) grid(px, x, y, v % 2 ? ['.c', 'cC', 'cd'] : ['c.c', 'CcC', 'dd.'], { c: ['#9af0ff', '#ffb0e0', '#c8a8ff', '#ffe08a'][v], C: '#ffffff', d: MG[3] }); // a tiny crystal
    else if (k < 0.75) { const dx = v % 2 ? 1 : -1; grid(px, x, y, ['dd.', 'dd.', '.d.'], { d: MG[4] }); grid(px, x + 4 * dx, y + 3, ['dd.', 'dd.', '.d.'], { d: MG[4] }); } // boot prints
    else if (k < 0.85) { px(x, y, '#ffffff'); px(x - 1, y, 'rgba(255,255,255,0.35)'); px(x + 1, y, 'rgba(255,255,255,0.35)'); } // a glint
    else { px(x, y, MG[4], 3, 1); px(x + 1, y - 1, MG[7]); } // a little stone
  }
}

// ---------- a moon base's little things ----------

/** A little moon rover, 36 x 24: six wire wheels, a white body, a solar panel on its back and an antenna with a flag. */
export function roverB(px, X, Y) {
  groundShadow(px, X + 19, Y + 22, 17, 2.4, 0.28);
  propB(px, X, Y, 36, 24, (b) => {
    // the body
    for (let y = 8; y < 16; y += 1) for (let x = 4; x < 32; x += 1) b.set(x, y, y === 8 ? ST[7] : y > 13 ? ST[4] : x < 12 ? ST[7] : ST[6], 'hull');
    for (let x = 6; x < 30; x += 4) b.set(x, 11, ST[4], 'hull');
    // the solar panel
    for (let y = 3; y < 8; y += 1) for (let x = 8 + (7 - y); x < 30 - (7 - y) * 0; x += 1) b.set(x, y, (x + y) % 4 === 0 ? '#8ab8ff' : y === 3 ? '#4a7ad8' : '#2a4aa8', 'panel');
    // the cab window and a headlight
    grid((x, y, c) => b.set(x, y, c, 'glass'), 25, 9, ['wwWw', 'wWww'], { w: '#6ac8f0', W: '#e8f8ff' });
    b.set(32, 12, '#fff4a8', 'light'); b.set(33, 12, '#fff4a8', 'light');
    // the antenna with a little flag
    for (let y = -6; y < 3; y += 1) b.set(9, y, ST[5], 'steel');
    grid((x, y, c) => b.set(x, y, c, 'flag'), 10, -6, ['rrr', 'rR.'], { r: '#ff6a6a', R: '#ffb0b0' });
    // six wheels
    for (const wx of [7, 18, 29]) for (let y = 14; y < 23; y += 1) for (let x = wx - 4; x <= wx + 4; x += 1) {
      const d = Math.hypot(x + 0.5 - (wx + 0.5), y + 0.5 - 18.5);
      if (d > 4.3) continue;
      b.set(x, y, d < 1.4 ? ST[6] : d > 3.4 ? ((Math.round(Math.atan2(y - 18, x - wx) * 3) % 2) ? '#3a3a52' : '#55556e') : (x + y) % 2 ? ST[2] : ST[3], 'wheel');
    }
  }, { pad: 8, outline: (t, side) => (t === 'light' || t === 'flag' ? null : t === 'panel' ? '#1a2a6a' : t === 'wheel' ? (side === 'bottom' ? INK : '#24243a') : sel(t, side)) });
  // its tracks behind it in the dust
  for (let x = X - 18; x < X + 2; x += 2) { px(x, Y + 21, MG[4]); px(x + 1, Y + 23, MG[4]); }
}

/** Solar panels, 32 x 22: two blue panels tilted to the sun on a steel frame. */
export function solarB(px, X, Y) {
  groundShadow(px, X + 17, Y + 20, 15, 2.2, 0.26);
  propB(px, X, Y, 32, 22, (b) => {
    for (const x0 of [0, 17]) {
      for (let y = 0; y < 12; y += 1) for (let x = 0; x < 15; x += 1) {
        const xx = x0 + x + Math.round(y * 0.0);
        const cell = x % 5 === 0 || y % 4 === 0;
        b.set(xx, y, cell ? '#9ac0ff' : x + y < 6 ? '#5a8ae8' : y > 8 ? '#2a46a0' : '#3a62c8', 'panel');
      }
      for (let y = 12; y < 21; y += 1) { b.set(x0 + 7, y, ST[6], 'steel'); b.set(x0 + 8, y, ST[4], 'steel'); }
      for (let x = x0 + 4; x < x0 + 12; x += 1) b.set(x, 21, ST[3], 'steel');
    }
    for (let x = 7; x < 25; x += 1) b.set(x, 16, ST[4], 'steel');
  }, { outline: (t, side) => (t === 'panel' ? (side === 'bottom' || side === 'right' ? '#1a2a6a' : '#2a3a8a') : sel(t, side)) });
}

/** A satellite that came down too fast, 34 x 22: nose in the dust, one panel bent, a little dish, a puff of dust. */
export function satelliteB(px, X, Y) {
  groundShadow(px, X + 18, Y + 20, 15, 2.4, 0.28);
  propB(px, X, Y, 34, 22, (b) => {
    // the body, a gold-foil box, tilted
    for (let y = 6; y < 18; y += 1) for (let x = 11; x < 23; x += 1) {
      const xx = x + Math.round((y - 6) * 0.25);
      b.set(xx, y, (x + y) % 5 === 0 ? '#fff0a0' : x < 15 ? '#f0c840' : y > 14 ? '#a8701a' : '#d8a02a', 'foil');
    }
    // panels: one straight, one bent down into the dust
    for (let y = 8; y < 13; y += 1) for (let x = 0; x < 11; x += 1) b.set(x, y + Math.round((10 - x) * 0.15), x % 4 === 0 ? '#9ac0ff' : '#3a62c8', 'panel');
    for (let k = 0; k < 10; k += 1) for (let j = 0; j < 5; j += 1) b.set(25 + Math.round(k * 0.8), 12 + j + Math.round(k * 0.6), k % 4 === 0 ? '#9ac0ff' : '#2a4aa8', 'panel');
    // a little dish and antenna
    grid((x, y, c) => b.set(x, y, c, 'steel'), 14, 0, ['.ssss.', 'sSSSSs', '..ss..', '..s...', '..s...', '..s...'], { s: ST[4], S: ST[6] });
    // the dust heaped where it hit
    for (let x = 6; x < 30; x += 1) for (let y = 18; y < 22; y += 1) if (y > 18 + Math.abs(x - 17) * 0.25) b.set(x, y, y === 19 ? MG[7] : MG[5], 'dust');
  }, { outline: (t, side) => (t === 'panel' ? '#1a2a6a' : t === 'foil' ? (side === 'bottom' || side === 'right' ? '#6a4010' : '#a8701a') : sel(t, side)) });
  [[30, 2, 2], [33, -3, 1], [28, -6, 1]].forEach(([dx, dy, r]) => { if (r > 1) grid(px, X + dx - 1, Y + dy - 1, ['.d.', 'ddd', '.d.'], { d: 'rgba(200,204,230,0.6)' }); else px(X + dx, Y + dy, 'rgba(200,204,230,0.6)'); });
}

/** A telescope on a tripod, 18 x 26, looking up at the Earth. */
export function telescopeB(px, X, Y) {
  groundShadow(px, X + 9, Y + 25, 7, 1.6, 0.24);
  propB(px, X, Y, 18, 26, (b) => {
    // the tripod
    for (let k = 0; k < 13; k += 1) { b.set(9 - Math.round(k * 0.45), 13 + k, ST[5], 'steel'); b.set(9 + Math.round(k * 0.45), 13 + k, ST[3], 'steel'); b.set(9, 13 + k, ST[4], 'steel'); }
    // the tube, angled up to the sky
    for (let k = 0; k < 15; k += 1) for (let j = -2; j <= 1; j += 1) {
      const x = 3 + k * 0.8 + j * 0.5; const y = 12 - k * 0.7 + j * 0.8;
      b.set(Math.round(x), Math.round(y), j === -2 ? '#ffffff' : j === 1 ? '#5a6ab8' : k > 11 ? '#3a4aa0' : '#8a9ae8', 'tube');
    }
    grid((x, y, c) => b.set(x, y, c, 'glass'), 14, 0, ['.gg', 'gGg', 'gg.'], { g: '#6ac8f0', G: '#e8f8ff' });
    b.set(4, 13, ST[6], 'steel'); b.set(3, 14, ST[6], 'steel'); // the eyepiece
  }, { outline: (t, side) => (t === 'glass' ? null : t === 'tube' ? '#2a2a6a' : sel(t, side)) });
}

/** The joke rock: the moon really is made of cheese here. A wedge with holes, a little mouse in a space helmet. 22 x 16. */
export function cheeseB(px, X, Y) {
  groundShadow(px, X + 11, Y + 15, 10, 1.8, 0.26);
  propB(px, X, Y, 22, 16, (b) => {
    grid((x, y, c) => b.set(x, y, c, 'cheese'), 0, 2, [
      '...........ttt.......',
      '........tttTTt.......',
      '.....tttTTTTTyy......',
      '..tttTTTTTTyyyy......',
      'ttTTTTTTyyyyyyy......',
      'yyyyyyyyyyyyyyy......',
      'yyhyyyyyyyhyyyyd.....',
      'yhHyyyyyyhHyyyyd.....',
      'yyyyyyhyyyyyyhyd.....',
      'yyyyyhHyyyyyhHyd.....',
      'yyyyyyyyyyyyyyyd.....',
      'dddddddddddddddd.....',
    ], { t: '#fff0a0', T: '#ffe270', y: '#f8c840', h: '#c8901a', H: '#e8b030', d: '#c8901a' });
    // the mouse, in a helmet, nibbling
    grid((x, y, c) => b.set(x, y, c, 'mouse'), 15, 5, ['.gggg.', 'gwmmwg', 'gmkmmg', 'gmpmmg', '.gggg.', '.mmmm.', '.m..m.'], { g: '#bfe8ff', w: '#ffffff', m: '#c8c0d8', k: '#1a1a2a', p: '#ff9ac0' });
    b.set(21, 10, '#c8c0d8', 'mouse'); b.set(22, 9, '#c8c0d8', 'mouse');
  }, { outline: (t, side) => (t === 'mouse' ? (side === 'bottom' ? INK : '#6a8aa8') : side === 'bottom' ? INK : side === 'right' ? '#a86a10' : '#c8901a') });
}

/** A friendly round robot sweeping the dust off the road with a little broom, 20 x 24, a puff of dust at the broom. */
export function robotB(px, X, Y) {
  groundShadow(px, X + 10, Y + 23, 7, 1.6, 0.26);
  propB(px, X, Y, 20, 24, (b) => {
    // its round head with one big blue eye and an antenna
    for (let y = 2; y < 11; y += 1) for (let x = 3; x < 15; x += 1) { if (!inEll(x, y, 9, 6.5, 6, 4.8)) continue; const l = (x - 9) / 6 + (y - 6) / 5; b.set(x, y, l < -0.5 ? ST[7] : l < 0.4 ? ST[6] : ST[5], 'hull'); }
    grid((x, y, c) => b.set(x, y, c, 'eye'), 6, 4, ['.bbbb.', 'bBWbbb', 'bbbbbb', '.bbbb.'], { b: '#3ab8f0', B: '#a8ecff', W: '#ffffff' });
    for (let y = -2; y < 2; y += 1) b.set(9, y, ST[4], 'steel');
    b.set(9, -3, '#ff6a6a', 'light');
    // its body, a barrel, with a little panel
    for (let y = 11; y < 20; y += 1) for (let x = 4; x < 14; x += 1) b.set(x, y, x < 7 ? ST[7] : x < 11 ? ST[6] : ST[4], 'hull');
    grid((x, y, c) => b.set(x, y, c, 'light'), 6, 13, ['gr', 'yb'], { g: '#7aff9a', r: '#ff6a6a', y: '#ffd43b', b: '#7af0ff' });
    // wheels
    grid((x, y, c) => b.set(x, y, c, 'wheel'), 4, 20, ['.ww..ww.', 'wWww.wWw', '.ww..ww.'], { w: '#3a3a52', W: ST[4] });
    // its arm and the broom
    for (let k = 0; k < 4; k += 1) b.set(14 + k, 14 + Math.round(k * 0.5), ST[4], 'steel');
    for (let k = 0; k < 10; k += 1) b.set(17 - Math.round(k * 0.1), 10 + k, '#c8884a', 'broom');
    grid((x, y, c) => b.set(x, y, c, 'broom'), 14, 19, ['yyyyy', 'yYyYy', 'y.y.y'], { y: '#e8c050', Y: '#fff0a0' });
  }, { outline: (t, side) => (t === 'eye' || t === 'light' ? null : t === 'broom' ? '#8a5a1a' : t === 'wheel' ? INK : sel(t, side)) });
  [[18, 23, 2], [21, 21, 1], [15, 25, 1]].forEach(([dx, dy, r]) => { if (r > 1) grid(px, X + dx - 1, Y + dy - 1, ['.d.', 'ddd', '.d.'], { d: 'rgba(220,222,240,0.55)' }); else px(X + dx, Y + dy, 'rgba(220,222,240,0.55)'); });
}

/** A greenhouse dome, 36 x 30: a glass bubble on a steel ring, green plants and red tomatoes inside, a sprinkler. */
export function greenhouseB(px, X, Y) {
  groundShadow(px, X + 19, Y + 28, 17, 2.4, 0.26);
  propB(px, X, Y, 36, 30, (b) => {
    // the ring it sits on
    for (let y = 23; y < 29; y += 1) for (let x = 1; x < 35; x += 1) b.set(x, y, y === 23 ? ST[7] : y === 28 ? ST[3] : x < 10 ? ST[6] : ST[5], 'hull');
    // plants inside: leafy rows, tomatoes, a sunflower
    const leaf = ['#2a7a3a', '#3e9a46', '#5cbc56', '#8ad870'];
    for (let y = 8; y < 23; y += 1) for (let x = 4; x < 32; x += 1) {
      if (!inEll(x, y, 18, 23, 15, 15)) continue;
      const n = vnoise(x + X, y + Y, 3, 41);
      if (y > 14 + Math.sin(x / 2.4) * 3 || n > 0.66) b.set(x, y, n > 0.7 ? leaf[3] : n > 0.45 ? leaf[2] : y > 19 ? leaf[0] : leaf[1], 'plant');
    }
    [[9, 17], [14, 15], [22, 18], [27, 16], [18, 20]].forEach(([x, y]) => { b.set(x, y, '#ff4a4a', 'plant'); b.set(x + 1, y, '#e8303a', 'plant'); b.set(x, y - 1, '#ffb0a0', 'plant'); });
    grid((x, y, c) => b.set(x, y, c, 'plant'), 16, 7, ['.y.', 'yby', '.y.'], { y: '#ffd43b', b: '#8a5a1a' });
    // the glass over it all, with a shine and ribs
    for (let y = 0; y < 23; y += 1) for (let x = 1; x < 35; x += 1) {
      if (!inEll(x, y, 18, 23, 17, 23)) continue;
      const rim = !inEll(x, y, 18, 23, 15.8, 21.8);
      const rib = Math.abs(x + 0.5 - 18) < 0.6 || Math.abs(y + 0.5 - 13) < 0.5;
      if (rim || rib) b.set(x, y, y < 10 ? ST[6] : ST[5], 'steel');
      else if (inEll(x, y, 11, 8, 3, 2) || inEll(x, y, 8, 13, 1.2, 2)) b.set(x, y, 'rgba(255,255,255,0.75)', 'shine');
      else if (!b.get(x, y)) b.set(x, y, 'rgba(190,240,255,0.32)', 'air');
    }
  }, { outline: (t, side) => (t === 'shine' || t === 'plant' || t === 'air' ? (t === 'air' ? ST[3] : null) : sel(t, side)) });
}

/** A trail of astronaut boot prints wandering across the dust, 44 x 14. */
export function printsB(px, X, Y) {
  for (let k = 0; k < 7; k += 1) {
    const x = X + k * 6; const y = Y + Math.round(Math.sin(k * 0.9) * 3) + (k % 2 ? 4 : 0) + 3;
    grid(px, x, y, ['dDd', 'ddd', 'dDd', '.d.'], { d: MG[3], D: MG[4] });
    px(x, y - 1, MG[6], 3, 1);
  }
}

// ---------- the whole village ----------

/**
 * Paints the space map's village in style B. opts: { homeRoof: the kid's color, areas: the green's
 * ponds and play patches }. lib: { waterDepth, PROPS } from villageprops.js (passed in so the two
 * files don't import each other).
 */
export function paintSpace(canvas, L, opts = {}, lib = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const out = pixelBuffer(L.W, L.H);
  const { px } = out;
  const seed = L.seed || 4409;
  const PROPS = lib.PROPS || {};
  const depth = lib.waterDepth;

  floorS(px, L, seed);
  pitsS(px, L, seed + 30);
  skyS(px, L, seed + 50);
  L.water.forEach((wa) => riftS(px, L, wa, depth, seed + 60));
  pathsS(px, L, seed + 2);
  L.plazas.forEach(([x, y, r], i) => plateS(px, x, y, r, seed + 40 + i));
  (opts.areas || []).forEach((a, i) => (a.kind === 'pond' ? gooS(px, a, seed + 70 + i) : courtS(px, a, a.kind, seed + 70 + i)));
  L.crossings.forEach((c) => gangwayS(px, c));
  scatterS(px, L, opts.areas || [], seed + 90);

  const DRAW = {
    boulder: (p) => boulderS(px, p.x, p.y, 34, 26),
    rock: (p) => boulderS(px, p.x, p.y, p.w || 22, p.h || 16),
    crystal: (p) => crystalS(px, p.x, p.y, p.c),
    crater: (p) => craterS(px, p.x, p.y, p.w || 36, p.h || 18),
    dish: (p) => dishS(px, p.x, p.y),
    lamp: (p) => lampS(px, p.x, p.y, p.c),
    flag: (p) => flagS(px, p.x, p.y, p.c),
    stall: (p) => stallS(px, p.x, p.y, p.pal),
    laundry: (p) => laundryS(px, p.x, p.y, p.w || 84),
  };
  const draw = (p) => (DRAW[p.kind] ? DRAW[p.kind](p) : PROPS[p.kind]?.draw(px, p, rng(seed)));
  // flat things lie on the ground, so a pond or a pitch laid out on the green covers them
  const under = (p) => (opts.areas || []).some((a) => p.x < a.x + a.w + 6 && p.x + (p.w || PROPS[p.kind].w) > a.x - 6 && p.y < a.y + a.h + 6 && p.y + (p.h || PROPS[p.kind].h) > a.y - 6);
  L.props.filter((p) => PROPS[p.kind]?.flat && !under(p)).forEach(draw);
  const home = L.home;
  const doors = ['#e8803a', '#7a5ad8', '#3a9a8a'];
  const things = [
    { y: home.y + home.h, draw: () => habitatS(px, home.x, home.y, home.w, home.h, { home: true, glass: opts.homeRoof || '#e03131', door: opts.homeRoof || '#e03131' }) },
    ...L.houses.map((hs, i) => ({ y: hs.y + hs.h, draw: () => habitatS(px, hs.x, hs.y, hs.w, hs.h, { glass: hs.roof, sign: hs.sign, door: doors[i % doors.length] }) })),
    ...L.props.filter((p) => !PROPS[p.kind]?.flat).map((p) => ({ y: p.y + (PROPS[p.kind]?.base ?? 0), draw: () => draw(p) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  out.put(ctx);
  return canvas;
}
