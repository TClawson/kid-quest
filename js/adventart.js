// The Advent calendar house (December): a small festive building in every village, a different
// look per map, and inside it a wall of 25 numbered doors, one to open each day (door 25 the big
// present). Style B like the rest of the village: hue-shifted ramps, selective outlines,
// dithered edges, one art pixel per village pixel.
//
//   ADVENT_LOOK[mapId]            which house (log cabin, red boathouse, gatehouse tower, stone hut, gingerbread
//                                 hut, coral grotto, beach hut, moon dome, star observatory) in what colors
//   adventSpot(L, scene)          where it stands (open ground, clear of everything the kid needs)
//   adventHouseArt(mapId, o)      the house, o: { night: mapId, frame }
//   adventLights(L, spot)         its light at night (nightfx.js)
//   adventWallArt(o)              the inside: the wall of doors, o: { mapId, today, opened: {n: prize}, missed: [n], frame }
//
// Every house carries the same sign over its door: a wreath round a big 25 (review 1: the little
// 5 x 5 grid of doors it had read as stained glass at 1x).

import { mix, h2, bayer, inEll } from './pixelkit.js';
import { spriteOf, lighter, darker, number, INK, DIGITS } from './xmaskit.js';
import { findSpot, keepClear } from './xmaslights.js';

export const ADVENT = { w: 66, h: 62 };

// each map's house: its design and its colors
export const ADVENT_LOOK = {
  'bg-meadow': { design: 'cabin', logs: ['#4a2a2e', '#6e4030', '#925a3a', '#b4784a', '#d49a62', '#ecc088'], door: '#2f8a5a', trim: '#e03a4a' },
  'bg-rainforest': { design: 'cabin', logs: ['#3a3a22', '#5a5a2a', '#7a7a36', '#9a9a44', '#bcba5a', '#dcd884'], door: '#c0306a', trim: '#ffd84a' },
  'bg-fjord': { design: 'boathouse', wall: ['#3e1622', '#621e2a', '#8a2a30', '#ac3a38', '#c85846', '#e48a66'], trim: ['#9aa0b8', '#d8dce8', '#f8f6ee'], door: '#4a6a9a' },
  'bg-castle': { design: 'tower', stone: ['#34304a', '#4e4a66', '#6a6884', '#8c8ca6', '#b2b2c6', '#d8d8e6'], banner: '#7a3ab0', trim: '#f0b830', door: '#7a4a2e' },
  'bg-volcano': { design: 'stonehut', stone: ['#1e1a22', '#2e2832', '#433a44', '#5a4e58', '#766a70', '#9a8c8a'], straw: ['#4a3020', '#6a4426', '#8e5e30', '#b07c3e', '#d0a058', '#e8c47a'], door: '#5a2e22', glow: '#ff7a2a' },
  'bg-rainbow': { design: 'ginger' },
  'bg-ocean': { design: 'grotto', rock: ['#5a2a5a', '#82386e', '#b04a7e', '#d8688a', '#f08ea0', '#ffc0bc'], door: '#9af0ff' },
  'bg-sunset': { design: 'beachhut', stripes: ['#ff8a7a', '#fff0d8'], roof: ['#1e4a5a', '#2a6a78', '#3a8e96', '#5ab4b4', '#8ad8d0'], door: '#3ab0c0', wood: ['#5a3a2a', '#7a5236', '#9c6e46', '#c0925e'] },
  'bg-space': { design: 'dome', ice: ['#3e3e6a', '#5a5e8e', '#7e86b4', '#a6b0d6', '#ccd6ee', '#eef4ff'], hatch: '#e0505a' },
  'bg-galaxy': { design: 'observatory', stone: ['#2a1e4a', '#3e2e6a', '#56428a', '#7a62a8', '#a08ac6', '#c8b8e4'], dome: ['#4a2418', '#7a421c', '#a8682a', '#d8963a', '#f4c45a', '#fff0b0'], door: '#3a2a7a' },
};
const lookOf = (mapId) => ADVENT_LOOK[mapId] || ADVENT_LOOK['bg-meadow'];
// each design's size [w, h] and its foot (the middle of its doorstep) [ax, ay]
const SIZE = { cabin: [66, 62, 33, 58], ginger: [66, 62, 33, 58], grotto: [66, 62, 33, 58], dome: [66, 62, 33, 58], boathouse: [60, 66, 30, 62], tower: [46, 82, 23, 78], beachhut: [56, 62, 28, 58], observatory: [48, 76, 24, 72], stonehut: [58, 58, 29, 54] };
export const adventSize = (mapId) => SIZE[lookOf(mapId).design];

// where it would like to stand on each map when villagemaps.js names no spot (it takes the nearest open ground)
const WANT = {
  'bg-meadow': [320, 200], 'bg-sunset': [116, 244], 'bg-ocean': [128, 224], 'bg-space': [236, 442], 'bg-castle': [260, 214],
  'bg-volcano': [380, 190], 'bg-rainforest': [188, 450], 'bg-fjord': [92, 676], 'bg-rainbow': [344, 394], 'bg-galaxy': [296, 202],
};

/**
 * Where the advent house stands: { x, y } its foot (the middle of its doorstep), w, h. Each map
 * names its spot (villagemaps.js xmas.advent, picked by hand on open ground); else the nearest gap.
 */
export function adventSpot(L) {
  const [w, h, , ay] = adventSize(L.id);
  let at = L.xmas?.advent ? { x: L.xmas.advent[0], y: L.xmas.advent[1] } : null;
  if (!at) {
    const [x, y] = WANT[L.id] || [L.W / 2, L.H / 2];
    const clear = keepClear(L, { slots: 5 });
    for (const ww of [w - 2, w - 6, w - 10]) if (!at) at = findSpot(L, x, y, ww, 56, [], { reach: 160, clear });
  }
  if (!at) return null;
  return { x: at.x, y: at.y, w, h, stand: { x: at.x, y: at.y + 8 }, box: [at.x - w / 2 + 3, at.y - ay, w - 6, ay + 12] };
}

/** Its windows and doorway at night: [{ x, y, r, ry, i, tint }] for nightfx.js nightLand. */
export function adventLights(L, s) {
  if (!s) return [];
  const tint = lookOf(L.id).design === 'grotto' ? [0.7, 1, 0.95] : [1, 0.86, 0.6];
  const k = s.w / 66;
  return [{ x: s.x, y: s.y + 2, r: 30 * Math.max(0.8, k), ry: 13, i: 0.95, tint }, { x: s.x - 18 * k, y: s.y - 10, r: 12, ry: 9, i: 0.5, tint }, { x: s.x + 18 * k, y: s.y - 10, r: 12, ry: 9, i: 0.5, tint }];
}

// ---------- drawing helpers ----------

const inPoly = (x, y, pts) => {
  let ins = false; const px = x + 0.5; const py = y + 0.5;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i, i += 1) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) ins = !ins;
  }
  return ins;
};
const rows = (b, X, Y, art, pal, tag, litKeys = '') => art.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const ch = row[x]; if (pal[ch]) b.set(X + x, Y + y, pal[ch], litKeys.includes(ch) ? 'lit' : tag); } });
const SNOW = ['#8a90c0', '#aeb6dc', '#d2daf0', '#eef2fc', '#ffffff'];
const GLOWR = ['#c86a3a', '#f0a848', '#ffd878', '#fff4c8'];

// ---------- the houses ----------

function cabin(b, P, f) {
  const L6 = P.logs; const W = 66;
  // walls: round logs, each 3 rows (lit top, body, dark under-crack), corner log ends
  const wallTop = 34; const wallBot = 56;
  for (let y = wallTop; y < wallBot; y += 1) {
    for (let x = 7; x < W - 7; x += 1) {
      const r = (y - wallTop) % 3;
      let k = r === 0 ? 4 : r === 1 ? 3 : 1;
      if (h2(x >> 2, Math.floor(y / 3), 3) < 0.25 && r === 1) k = 2;
      if (x > W - 14 && bayer(x, y) < 0.5) k -= 1;
      b.set(x, y, L6[Math.max(0, k)], 'log');
    }
  }
  for (const ex of [4, W - 9]) for (let y = wallTop; y < wallBot; y += 3) rows(b, ex, y, ['.aa.', 'aCca', '.aa.'], { a: L6[2], C: L6[5], c: L6[4] }, 'log');
  // the gable: logs right up under the roof
  const apex = [33, 5];
  const roofEdge = (x) => apex[1] + Math.abs(x + 0.5 - apex[0]) * 0.92;
  for (let y = 12; y < wallTop; y += 1) for (let x = 8; x < W - 8; x += 1) {
    if (y < roofEdge(x) + 5) continue;
    const r = (y - wallTop + 30) % 3;
    b.set(x, y, L6[r === 0 ? 4 : r === 1 ? 3 : 1], 'log');
  }
  // the sign in the gable: a wreath round a big 25, this is the advent house
  wreathSign(b, 33, 25, f, { bow: P.trim });
  // the snowy roof: a thick band along both slopes, snow piled on top, icicles under it
  for (let y = 0; y < 44; y += 1) for (let x = 0; x < W; x += 1) {
    const e = roofEdge(x); const d = y - e;
    if (d < -3 || d > 5) continue;
    if (y > 40) continue;
    let c;
    if (d < 0) c = SNOW[d < -2 ? 3 : 4];
    else if (d < 3) c = SNOW[x < apex[0] ? 3 : 2] ;
    else c = d === 3 ? '#a8604a' : '#7a3e3a'; // the shingles' edge under the snow
    if (d >= 0 && d < 3 && bayer(x, y) < 0.18) c = SNOW[x < apex[0] ? 4 : 1];
    b.set(x, y, c, d >= 3 ? 'shingle' : 'snow');
  }
  // icicles along the eaves
  for (let x = 0; x < W; x += 1) {
    if (Math.abs(x - apex[0]) < 8) continue;
    const y = Math.round(roofEdge(x) + 6); if (y > 41) continue;
    const len = h2(x, 1, 9) < 0.35 ? 2 + Math.floor(h2(x, 2, 9) * 3) : 0;
    for (let k = 0; k < len; k += 1) b.set(x, y + k, k === len - 1 ? '#c8dcf8' : '#eef6ff', 'ice');
  }
  // a stone chimney through the right slope, snow cap, a curl of smoke
  for (let y = 6; y < 16; y += 1) for (let x = 46; x < 52; x += 1) if (y < roofEdge(x) + 1) b.set(x, y, (x + (y % 2) * 2) % 3 === 0 ? '#6e6a86' : x < 48 ? '#c0bcc8' : '#9894aa', 'stone');
  rows(b, 45, 4, ['.wwwwww.', 'wwwwwwww'], { w: '#f4f8ff' }, 'snow');
  rows(b, 47 + (f === 1 ? 1 : 0), -3 + (f === 2 ? -1 : 0), ['.ss.', 's..s', '.ss.'], { s: '#d8d8ec' }, 'smoke');
  // the door: planks, rounded top, a wreath, a lit window in it
  const dx = 26; const dy = 38; const dw = 14;
  const D = [darker(P.door, 0.45), darker(P.door, 0.2), P.door, lighter(P.door, 0.25)];
  for (let y = dy - 2; y < wallBot; y += 1) for (let x = dx - 2; x < dx + dw + 2; x += 1) {
    const inD = x >= dx && x < dx + dw && (y >= dy + 4 || inEll(x, y, dx + dw / 2, dy + 5, dw / 2, 7));
    const frameD = !inD && x >= dx - 2 && x < dx + dw + 2 && (y >= dy + 4 || inEll(x, y, dx + dw / 2, dy + 5, dw / 2 + 2, 9));
    if (inD) { const pl = (x - dx) % 4; b.set(x, y, pl === 0 ? D[1] : pl === 1 ? D[3] : D[2], 'door'); } else if (frameD) b.set(x, y, L6[1], 'log');
  }
  rows(b, dx + 9, dy + 11, ['yY', 'oy'], { y: '#f0c030', Y: '#fff0a0', o: '#a86a1a' }, 'knob');
  rows(b, dx + 4, dy + 3, ['.gg.', 'gGGg', 'gGGg'], { g: GLOWR[1], G: GLOWR[2] }, 'lit');
  // windows either side: warm light, a candle, snow on the sill
  for (const wx of [11, W - 22]) {
    for (let y = 38; y < 47; y += 1) for (let x = wx; x < wx + 11; x += 1) {
      const edge = y === 38 || y === 46 || x === wx || x === wx + 10;
      const mull = x === wx + 5 || y === 42;
      b.set(x, y, edge ? L6[1] : mull ? L6[2] : (y < 42 ? GLOWR[3] : GLOWR[2]), edge || mull ? 'log' : 'lit');
    }
    rows(b, wx + 2, 43, ['.f.', '.w.'], { f: '#fff4c8', w: '#f0e0d0' }, 'lit');
    rows(b, wx - 1, 47, ['wwwwwwwwwwwww', '.ddddddddddd.'], { w: '#ffffff', d: '#c8d4ee' }, 'snow');
  }
  // a stone footing and snow banked against it
  for (let x = 5; x < W - 5; x += 1) { b.set(x, 56, (x % 5) ? '#9894aa' : '#6e6a86', 'stone'); b.set(x, 57, '#6e6a86', 'stone'); }
  for (let x = 3; x < W - 3; x += 1) { if (x >= dx - 2 && x < dx + dw + 2) continue; const hh = 1 + Math.round(h2(x, 4, 4) * 1.6); for (let k = 0; k < hh; k += 1) b.set(x, 58 - k, k === hh - 1 ? '#ffffff' : '#dce4f6', 'snow'); }
  // firewood stacked under a cap of snow on the left, a red sled leaning on the right
  rows(b, -1, 46, ['.wwwwww.', 'ocococo.', 'cocococo', 'ocococo.', 'cocococo'], { w: '#ffffff', o: '#d4a066', c: '#8a5a3a' }, 'wood');
  rows(b, W - 4, 40, ['.r..', 'rr..', 'rR..', 'rR..', 'rR..', 'rR..', 'rR..', 'rR.k', 'rRrk', '.rrk', '..kk'], { r: '#c8303a', R: '#e8505a', k: '#5a5670' }, 'sled');
  // the lights along the eaves, and a lantern each side of the door
  for (let x = 2; x < W - 2; x += 3) {
    if (Math.abs(x - apex[0]) < 4) continue;
    const y = Math.round(roofEdge(x) + 6); if (y > 40) continue;
    const c = ['#ff5a5a', '#ffd23f', '#58d070', '#5aa8ff'][Math.floor(x / 3) % 4];
    const on = (Math.floor(x / 3) + f) % 3 !== 0;
    b.set(x, y, on ? c : mix(c, '#5a4a6a', 0.4), 'lit'); b.set(x, y + 1, on ? lighter(c, 0.4) : mix(c, '#5a4a6a', 0.5), 'lit');
  }
  for (const lx of [dx - 6, dx + dw + 3]) rows(b, lx, 40, ['.m.', 'mym', 'mYm', '.m.'], { m: '#4a4a5a', y: GLOWR[2], Y: f === 1 ? '#ffffff' : GLOWR[3] }, 'lamp', 'yY');
}

function ginger(b, f) {
  const W = 66;
  const G = ['#4a2a22', '#6a3a26', '#8a5030', '#a86a3e', '#c8864e', '#e0a868'];
  const ICE = ['#c8b8d8', '#e8e0f0', '#ffffff'];
  const apex = [33, 4]; const edge = (x) => apex[1] + Math.abs(x + 0.5 - apex[0]) * 0.86;
  // gingerbread walls with a speckled bake
  for (let y = 14; y < 56; y += 1) for (let x = 7; x < W - 7; x += 1) {
    if (y < edge(x) + 4) continue;
    let k = 3; if (h2(x, y, 5) < 0.12) k = 2; if (h2(x, y, 6) > 0.93) k = 4; if (x > W - 14 && bayer(x, y) < 0.5) k -= 1;
    b.set(x, y, G[k], 'ginger');
  }
  // the roof: chocolate tiles, a thick lid of icing with drips, candies pressed in
  for (let y = 0; y < 44; y += 1) for (let x = -2; x < W + 2; x += 1) {
    const d = y - edge(x);
    if (d < -4 || d > 4 || y > 40) continue;
    let c; let t = 'ice';
    if (d < 1) c = ICE[d < -2 ? 1 : 2];
    else { c = (x + (y % 4 < 2 ? 0 : 2)) % 4 === 0 ? '#4a2a22' : '#6a3a2a'; t = 'choc'; }
    b.set(x, y, c, t);
  }
  for (let x = 0; x < W; x += 1) { const y = Math.round(edge(x)) + 1; if (y > 40) continue; const drip = h2(x, 3, 3); if (drip < 0.4) for (let k = 0; k < 1 + Math.floor(drip * 6); k += 1) b.set(x, y + 4 + k, k ? ICE[1] : ICE[2], 'ice'); }
  for (let i = 0; i < 12; i += 1) { const x = 4 + i * 5; const y = Math.round(edge(x)) - 2; if (y < 40 && Math.abs(x - apex[0]) > 2) { const c = ['#ff5a7a', '#7af0c0', '#ffd84a', '#8a6aff'][i % 4]; b.set(x, y, c, 'candy'); b.set(x + 1, y, darker(c, 0.25), 'candy'); } }
  // a candy-cane chimney
  for (let y = 4; y < 16; y += 1) for (let x = 47; x < 52; x += 1) if (y < edge(x) + 1) b.set(x, y, (x + y) % 4 < 2 ? '#e8405a' : '#ffffff', 'cane');
  rows(b, 46, 2, ['.iiiiii.', 'iiiiiiii'], { i: '#ffffff' }, 'ice');
  // icing piped along the wall corners and the top of the walls
  for (let y = 22; y < 56; y += 1) for (const x of [7, W - 8]) b.set(x + ((y % 2) ? 0 : 1) * (x < 20 ? 1 : -1), y, '#ffffff', 'ice');
  // the sign: a wreath of mint leaves round an icing plaque with a big 25
  wreathSign(b, 33, 25, f, { ring: ['#1e6a5a', '#2a8a6a', '#3aa87a', '#6ac890', '#a8f0c0'], plate: ['#e8c8d8', '#fff0f6', '#ffffff'], ink: '#e8405a', bow: '#ff6a9a', lights: ['#ff8ab8', '#fff08a', '#c8a8ff', '#ffffff'] });
  // the door: a chocolate bar, a peppermint wreath
  const dx = 26; const dy = 38; const dw = 14;
  for (let y = dy; y < 56; y += 1) for (let x = dx - 1; x < dx + dw + 1; x += 1) {
    const inD = x >= dx && x < dx + dw && (y >= dy + 4 || inEll(x, y, dx + dw / 2, dy + 5, dw / 2, 6));
    if (inD) { const sq = ((x - dx) % 5 === 4) || ((y - dy) % 5 === 4); b.set(x, y, sq ? '#3a2018' : (x - dx) % 5 === 0 || (y - dy) % 5 === 0 ? '#7a4a32' : '#5a3424', 'choc'); }
    else if (x >= dx - 1 && x < dx + dw + 1 && (y >= dy + 4 || inEll(x, y, dx + dw / 2, dy + 5, dw / 2 + 1, 7))) b.set(x, y, '#ffffff', 'ice');
  }
  for (let y = -4; y <= 4; y += 1) for (let x = -4; x <= 4; x += 1) {
    if (!inEll(x, y, 0, 0, 4.4, 4.4) || inEll(x, y, 0, 0, 1.6, 1.6)) continue;
    const a = Math.atan2(y, x); b.set(33 + x, dy + 9 + y, Math.floor((a + Math.PI) / (Math.PI / 5)) % 2 ? '#ffffff' : '#e8405a', 'candy');
  }
  // round sugar-glass windows with icing rims, gumdrops along the foot
  for (const wx of [16, W - 16]) for (let y = -5; y <= 5; y += 1) for (let x = -5; x <= 5; x += 1) {
    if (!inEll(x, y, 0, 0, 5.4, 5.4)) continue;
    const rim = !inEll(x, y, 0, 0, 4.1, 4.1);
    b.set(wx + x, 43 + y, rim ? '#ffffff' : x === 0 || y === 0 ? '#e8a040' : (x + y < 0 ? GLOWR[3] : GLOWR[2]), rim ? 'ice' : 'lit');
  }
  for (let i = 0; i < 9; i += 1) { const x = 6 + i * 6 + (i > 3 ? 8 : 0); if (x > W - 8) break; const c = ['#ff5a7a', '#7af0c0', '#ffd84a', '#8a6aff', '#ff8a3a'][i % 5]; rows(b, x, 54, ['.cc.', 'cCcc', 'cccc'], { c, C: lighter(c, 0.5) }, 'candy'); }
  // candy canes stuck in the snow either side of the door
  for (const cx of [20, 44]) { rows(b, cx, 40, ['.rw.', 'r..w', 'w...', 'r...', 'w...', 'r...', 'w...', 'r...', 'w...', 'r...', 'w...', 'r...', 'w...', 'r...', 'w...', 'r...'], { r: '#e8405a', w: '#ffffff' }, 'cane'); }
  for (let x = 2; x < W - 2; x += 1) { if (x >= dx - 1 && x < dx + dw + 1) continue; const hh = 1 + Math.round(h2(x, 4, 7) * 1.6); for (let k = 0; k < hh; k += 1) b.set(x, 58 - k, k === hh - 1 ? '#ffffff' : '#e4e8f6', 'snow'); }
  // lights along the icing: pink, mint, lemon
  for (let x = 2; x < W - 2; x += 3) {
    if (Math.abs(x - apex[0]) < 4) continue;
    const y = Math.round(edge(x) + 5); if (y > 40) continue;
    const c = ['#ff8ab8', '#7af0c0', '#fff08a', '#c8a8ff'][Math.floor(x / 3) % 4]; const on = (Math.floor(x / 3) + f) % 3 !== 0;
    b.set(x, y, on ? c : mix(c, '#6a5a7a', 0.45), 'lit'); b.set(x + 1, y, on ? lighter(c, 0.4) : mix(c, '#6a5a7a', 0.5), 'lit');
  }
}

function grotto(b, P, f) {
  const W = 66; const R = P.rock; const cx = 33; const base = 57;
  // a round coral mound, lumpy along the top, lit from the top left
  const top = (x) => {
    const u = (x + 0.5 - cx) / 32;
    if (Math.abs(u) >= 1) return base + 1;
    const lump = Math.sin(x * 0.62) * 1.3 + Math.sin(x * 0.27 + 1.7) * 1.6;
    return Math.round(base - 47 * Math.pow(1 - u * u, 0.62) - lump);
  };
  for (let x = 1; x < W - 1; x += 1) {
    const t0 = top(x);
    for (let y = t0; y < base; y += 1) {
      const u = (x + 0.5 - cx) / 32; const v = (y - t0) / Math.max(1, base - t0);
      let k = 3.1 - u * 1.4 + (1 - v) * 0.8 - v * 0.7 + (bayer(x, y) - 0.5) * 0.55;
      // brain-coral grooves winding over it
      const g = Math.sin(x * 0.55 + Math.sin(y * 0.45) * 2.2 + y * 0.35);
      if (g > 0.86) k -= 1.2; else if (g > 0.7) k += 0.5;
      b.set(x, y, R[Math.max(0, Math.min(5, Math.round(k)))], 'rock');
    }
  }
  // polyps: little round pale spots with a dark heart
  for (let i = 0; i < 26; i += 1) {
    const x = 4 + Math.floor(h2(i, 1, 21) * 58); const y = top(x) + 3 + Math.floor(h2(i, 2, 21) * (base - top(x) - 6));
    if (b.tag(x, y) !== 'rock' || b.tag(x + 1, y + 1) !== 'rock') continue;
    b.set(x, y, R[5], 'rock'); b.set(x + 1, y, R[4], 'rock'); b.set(x, y + 1, R[4], 'rock'); b.set(x + 1, y + 1, R[1], 'rock');
  }
  // shells stuck in it
  [[7, 36], [55, 32], [10, 50], [53, 48]].forEach(([x, y], i) => rows(b, x, y, i % 2 ? ['.sss.', 'sSsSs', '.sss.'] : ['s.s.s', '.sSs.', '..s..'], { s: i % 2 ? '#f0e0d8' : '#ffd0b0', S: '#ffffff' }, 'shell'));
  // kelp waving on top, a starfish crowning it
  for (const [kx, len] of [[13, 10], [17, 7], [48, 9], [52, 12]]) for (let k = 0; k < len; k += 1) { const x = kx + Math.round(Math.sin((k + f) * 0.8) * 1.2); b.set(x, top(kx) - k, k % 2 ? '#3a8068' : '#56a078', 'kelp'); if (k % 3 === 1) b.set(x + 1, top(kx) - k, '#86c090', 'kelp'); }
  rows(b, 29, top(33) - 6, ['...o...', '..oOo..', 'oooOooo', '.oOOOo.', '..o.o..', '.o...o.'], { o: '#ff8a3a', O: '#ffc080' }, 'star');
  // the sign: a kelp wreath with glowing pearls round a sandstone plaque with a big 25
  wreathSign(b, 33, 24, f, { ring: ['#1a4a4a', '#28645a', '#3a8068', '#56a078', '#86c090'], plate: ['#c8a878', '#f0dcb4', '#fff4dc'], ink: '#b04a7e', bow: '#ff8ae0', lights: ['#7af8ff', '#ff8ae0', '#b8a8ff', '#8affc8'] });
  // the entrance, and its bubble door: a wobbly, shiny film you could pop
  const dx = 24; const dy = 39; const dw = 18;
  for (let y = dy - 2; y < base; y += 1) for (let x = dx - 2; x < dx + dw + 2; x += 1) {
    const inD = x >= dx && x < dx + dw && (y >= dy + 8 || inEll(x, y, dx + dw / 2, dy + 9, dw / 2, 9));
    const rim = !inD && (y >= dy + 8 ? x >= dx - 2 && x < dx + dw + 2 : inEll(x, y, dx + dw / 2, dy + 9, dw / 2 + 2, 11));
    if (inD) {
      const u = (x + 0.5 - (dx + dw / 2)) / (dw / 2); const v = (y - dy) / 20;
      let c = mix('#2a3a6a', P.door, 0.35 + v * 0.25);
      if (inEll(x, y, dx + 5 + (f === 1 ? 1 : 0), dy + 6, 2.2, 3.5) && !inEll(x, y, dx + 5.5 + (f === 1 ? 1 : 0), dy + 6.5, 1.2, 2.5)) c = '#ffffff';
      if (Math.abs(u) > 0.82) c = lighter(P.door, 0.3);
      if ((x + y + f) % 9 === 0 && v > 0.4) c = lighter(P.door, 0.55);
      b.set(x, y, c, 'lit');
    } else if (rim) b.set(x, y, R[(x + y) % 3 ? 4 : 5], 'rim');
  }
  // round windows glowing like jellyfish, either side
  for (const wx of [12, W - 13]) for (let y = -4; y <= 4; y += 1) for (let x = -4; x <= 4; x += 1) {
    if (!inEll(x, y, 0, 0, 4.4, 4.4)) continue;
    const rim = !inEll(x, y, 0, 0, 3.2, 3.2);
    b.set(wx + x, 42 + y, rim ? R[5] : (x + y < -1 ? '#e8ffff' : x + y < 2 ? '#9af0ff' : '#5ad0e8'), rim ? 'rim' : 'lit');
  }
  // a kelp wreath with pearls over the door, anemones at its feet
  [[3, 53, '#ff7ab0'], [57, 53, '#b88aff'], [15, 54, '#ffb05a'], [46, 54, '#7af0c0']].forEach(([x, y, c]) => rows(b, x, y, ['t.t.t', '.tTt.', 'bbbbb'], { t: c, T: lighter(c, 0.4), b: darker(c, 0.3) }, 'anem'));
  // bubbles going up from the top, a frame each
  [[30, -6], [37, -10], [33, -14]].forEach(([x, y], i) => { const yy = y - ((f + i) % 3) * 2; rows(b, x, yy, ['.b.', 'b.b', '.b.'], { b: '#c8f4ff' }, 'bubble'); });
  // glowing pearls strung along the brow
  for (let x = 5; x < W - 5; x += 3) { const y = top(x) + 3; if (y > 30) continue; const on = (Math.floor(x / 3) + f) % 3 !== 0; const c = ['#7af8ff', '#ff8ae0', '#b8a8ff', '#8affc8'][Math.floor(x / 3) % 4]; b.set(x, y, on ? c : mix(c, '#3a4a6a', 0.45), 'lit'); }
}

function dome(b, P, f) {
  const W = 66; const I = P.ice;
  const cx = 33; const base = 55; const rx = 31; const ry = 44;
  // a dome of blocks: rows follow the curve, joints staggered, lit from the top left
  for (let y = base - ry; y < base; y += 1) for (let x = cx - rx; x <= cx + rx; x += 1) {
    if (!inEll(x, y, cx, base, rx, ry)) continue;
    const e = Math.asin(Math.min(1, (base - y - 0.5) / ry));
    const row = Math.floor(e / 0.21);
    const span = Math.max(4, Math.round(11 * Math.cos(e)));
    const off = row % 2 ? Math.floor(span / 2) : 0;
    const joint = Math.floor((e % 0.21) * 36) === 0 || (x + off) % span === 0;
    const lit = (x - cx) / rx * 0.95 - (base - y) / ry * 0.55;
    let k = 3 - Math.round(lit * 1.6 + (bayer(x, y) - 0.5) * 0.6);
    if (joint) k = Math.min(k, 3) - 1;
    b.set(x, y, I[Math.max(0, Math.min(5, k))], 'ice');
  }
  // frost along the very top
  for (let x = cx - 12; x <= cx + 8; x += 1) { const y = Math.ceil(base - ry * Math.sqrt(Math.max(0, 1 - ((x - cx) / rx) ** 2))); if (h2(x, 3, 9) > 0.3) b.set(x, y, '#ffffff', 'ice'); }
  // the sign on the dome's face: a tinsel wreath round a lit plaque with a big 25
  wreathSign(b, 33, 28, f, { ring: ['#1e2e5e', '#2a4a8a', '#3a6ab0', '#6a9ad8', '#bfe0ff'], plate: ['#a6b0d6', '#eef4ff', '#ffffff'], ink: '#d83a4a', bow: '#e8404a', lights: ['#bff4ff', '#e0b8ff', '#ffffff', '#9ae8ff'] });
  // a tunnel out in front: half a barrel of blocks, the airlock door in its mouth
  const tw = 13; const th = 14;
  for (let y = base - th; y < base + 1; y += 1) for (let x = cx - tw; x <= cx + tw; x += 1) {
    if (!inEll(x, y, cx, base + 1, tw + 0.5, th + 1)) continue;
    const u = (x - cx) / tw; const d = base + 1 - y;
    const joint = d % 5 === 0 || (x + (Math.floor(d / 5) % 2) * 3) % 7 === 0;
    let k = 4 - Math.round(u * 1.5 + (bayer(x, y) - 0.5) * 0.5); if (joint) k -= 1;
    b.set(x, y, I[Math.max(1, Math.min(5, k))], 'tunnel');
  }
  // the airlock: an arched metal door in a colored frame, rivets, the wreath hung on it
  const dw = 8; const dt = base - 12;
  for (let y = dt - 2; y < base; y += 1) for (let x = cx - dw - 2; x <= cx + dw + 2; x += 1) {
    const inD = Math.abs(x - cx) <= dw && (y >= dt + 4 || inEll(x, y, cx, dt + 4, dw + 0.5, 5));
    const inF = Math.abs(x - cx) <= dw + 2 && (y >= dt + 4 || inEll(x, y, cx, dt + 4, dw + 2.5, 7));
    if (inD) {
      const seam = x === cx;
      const c = seam ? '#5a5670' : x < cx - 4 ? '#e2ddde' : x < cx + 3 ? '#c4c0cc' : '#9894aa';
      b.set(x, y, (y - dt) % 4 === 1 && Math.abs(x - cx) === dw - 1 ? '#6e6a86' : c, 'hatch');
    } else if (inF) b.set(x, y, x + y < cx + dt + 3 ? lighter(P.hatch, 0.25) : x > cx + 2 ? darker(P.hatch, 0.25) : P.hatch, 'frame');
  }
  // round portholes either side, warm inside
  for (const [wx, wy] of [[12, 45], [W - 12, 45]]) for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) {
    if (!inEll(x, y, 0, 0, 3.5, 3.5)) continue;
    const rim = !inEll(x, y, 0, 0, 2.3, 2.3);
    b.set(wx + x, wy + y, rim ? (x + y < 0 ? '#c4c0cc' : '#6e6a86') : (x + y < 0 ? '#fff4c8' : '#ffd878'), rim ? 'metal' : 'lit');
  }
  // an antenna with a blinking star, a little dish on the left shoulder wearing a Santa hat
  for (let y = 4; y < 14; y += 1) b.set(cx + 10, y, y % 3 ? '#86829c' : '#c0bcc8', 'metal');
  rows(b, cx + 8, 0, ['..y..', '.yWy.', '..y..'], { y: f === 1 ? '#fff0a0' : '#ffd84a', W: f === 2 ? '#fff0a0' : '#ffffff' }, 'lit', 'yW');
  for (let y = 19; y < 24; y += 1) b.set(11, y, '#6e6a86', 'metal');
  rows(b, 5, 13, ['...ddd..', '..dDDDd.', '.dDDDDd.', 'dDDDDd..', '.ddd....', '....m...'], { d: '#9894aa', D: '#e2ddde', m: '#6e6a86' }, 'metal');
  rows(b, 8, 8, ['....w', '...rr', '..rrR', '.rrRR', 'wwwww'], { r: '#c8303a', R: '#e8505a', w: '#ffffff' }, 'hat');
  // crystal lights strung round its middle, frost and moon rocks at its foot
  for (let x = cx - rx + 3; x <= cx + rx - 3; x += 3) {
    if (Math.abs(x - cx) < tw + 1) continue;
    const y = base - 15 + Math.round(((x - cx) / rx) ** 2 * 6);
    const c = ['#bff4ff', '#e0b8ff', '#ffffff', '#9ae8ff'][Math.floor(x / 3) % 4]; const on = (Math.floor(x / 3) + f) % 3 !== 0;
    b.set(x, y - 1, on ? lighter(c, 0.5) : mix(c, '#4a4a6a', 0.5), 'lit'); b.set(x, y, on ? c : mix(c, '#4a4a6a', 0.45), 'lit');
  }
  for (let x = 1; x < W - 1; x += 1) { if (Math.abs(x - cx) < 9) continue; const hh = 1 + Math.round(h2(x, 4, 8) * 1.4); for (let k = 0; k < hh; k += 1) b.set(x, 57 - k, k === hh - 1 ? '#f4f8ff' : '#c8d0ec', 'snow'); }
  rows(b, 53, 52, ['.rrr.', 'rRRrr', 'rrrrd'], { r: '#8a8aa8', R: '#b0b0c8', d: '#5a5a7a' }, 'rock');
  rows(b, 4, 53, ['.rr.', 'rRrd'], { r: '#8a8aa8', R: '#b0b0c8', d: '#5a5a7a' }, 'rock');
}

// ---------- the sign every house carries: a wreath round a big 25 ----------

/**
 * A round wreath, a cream plaque in it with a big red 25 (Christmas Day, the last door), lights
 * twinkling in its leaves and a bow under it: this is the advent house. r: its outer radius.
 */
function wreathSign(b, cx, cy, f, o = {}) {
  const ring = o.ring || ['#1e4a3a', '#2a6a44', '#3a8a4c', '#5aa85a', '#8ccf6a'];
  const plate = o.plate || ['#c8a878', '#f4e4c0', '#fffbe8'];
  const ink = o.ink || '#b82a38'; const R = o.r || 10.6; const ri = R - 3.6;
  for (let y = -11; y <= 11; y += 1) for (let x = -11; x <= 11; x += 1) {
    if (!inEll(x, y, 0, 0, R, R)) continue;
    if (inEll(x, y, 0, 0, ri, ri)) {
      // the plaque: lit from the top left, a darker rim at its bottom right (it glows at night)
      const rim = !inEll(x, y, 0, 0, ri - 1, ri - 1);
      b.set(cx + x, cy + y, rim ? (x + y > 0 ? plate[0] : plate[2]) : (x + y < -6 ? plate[2] : plate[1]), 'litsign');
      continue;
    }
    const l = (x + y) / (R * 2.2) - (h2(x, y, 43) - 0.5) * 0.55;
    b.set(cx + x, cy + y, ring[l < -0.3 ? 4 : l < -0.05 ? 3 : l < 0.25 ? 2 : l < 0.45 ? 1 : 0], 'ring');
  }
  // the big 25: the 5 x 7 digits, a pale shadow down and right
  ['2', '5'].forEach((ch, i) => FONT5[ch].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] === 'x') { b.set(cx - 5 + i * 6 + x, cy - 3 + y, ink, 'litsign'); if (FONT5[ch][y + 1]?.[x] !== 'x') b.set(cx - 5 + i * 6 + x, cy - 2 + y, plate[0], 'litsign'); } }));
  // little lights round the ring, twinkling in turn
  const lights = o.lights || ['#ff5a5a', '#ffd23f', '#fff4c8', '#ff8a3a'];
  for (let k = 0; k < 10; k += 1) {
    const a = (k / 10) * Math.PI * 2 + 0.3; const x = Math.round(Math.cos(a) * (R - 1.8)); const y = Math.round(Math.sin(a) * (R - 1.8));
    const c = lights[k % lights.length]; const on = (k + f) % 3 !== 0;
    b.set(cx + x, cy + y, on ? c : mix(c, ring[0], 0.5), 'lit');
  }
  // the bow, under it
  const bow = o.bow || '#e03a4a';
  rows(b, cx - 3, cy + Math.round(R) - 2, ['bb.bb', 'bBcBb', '.bcb.', 'b.c.b'], { b: bow, B: lighter(bow, 0.3), c: darker(bow, 0.3) }, 'bow');
}

// ---------- the new houses (review 1): boathouse, gatehouse tower, beach hut, observatory, stone hut ----------

// a run of bulbs along points [[x, y]...], every `step` pixels, twinkling in thirds
function bulbsAlong(b, pts, colors, f, { step = 3, dim = '#4a3a5a', shape = 'dot' } = {}) {
  pts.forEach(([x, y], i) => {
    if (i % step) return;
    const k = Math.floor(i / step); const c = colors[k % colors.length]; const on = (k + f) % 3 !== 0;
    const C = on ? c : mix(c, dim, 0.45);
    if (shape === 'shell') rows(b, x - 1, y, ['c.c', 'CcC'], { c: C, C: on ? lighter(c, 0.45) : C }, 'lit');
    else if (shape === 'star') rows(b, x - 1, y, ['.c.', 'cCc', '.c.'], { c: C, C: on ? '#ffffff' : C }, 'lit');
    else if (shape === 'flame') rows(b, x, y, ['c', 'C'], { c: on ? lighter(c, 0.45) : C, C }, 'lit');
    else { b.set(x, y, C, 'lit'); b.set(x, y + 1, on ? lighter(c, 0.4) : mix(c, dim, 0.5), 'lit'); }
  });
}
const snowFoot = (b, x0, x1, y, skip = []) => { for (let x = x0; x < x1; x += 1) { if (skip.some(([a, z]) => x >= a && x < z)) continue; const hh = 1 + Math.round(h2(x, 4, 4) * 1.6); for (let k = 0; k < hh; k += 1) b.set(x, y - k, k === hh - 1 ? '#ffffff' : '#dce4f6', 'snow'); } };

/** Fjord: a red Nordic boathouse, falu-red boards, white trim, big boat doors ajar with warm light, a lifebuoy. */
function boathouse(b, P, f) {
  const W = 60; const R = P.wall; const T = P.trim; const cx = 30;
  const edge = (x) => 3 + Math.abs(x + 0.5 - cx) * 1.02; // the steep gable
  const wallTop = 33; const base = 59;
  // the boards, standing up, each 4 wide: a lit left edge, a dark seam; the right of the house in shade
  for (let y = 8; y < base; y += 1) for (let x = 5; x < W - 5; x += 1) {
    if (y < edge(x) + 3) continue;
    const bx = (x - 5) % 4;
    let k = bx === 0 ? 1 : bx === 1 ? 4 : 3;
    if (h2(x >> 2, y >> 3, 7) < 0.15 && bx > 1) k = 2;
    if (x > W - 18 && bayer(x, y) < (x - (W - 18)) / 14) k -= 1;
    if (y < wallTop && bayer(x, y) < 0.25) k -= 1; // under the eaves a touch darker
    b.set(x, y, R[Math.max(0, k)], 'board');
  }
  // white corner boards and a white band where the gable meets the walls
  for (let y = wallTop - 1; y < base; y += 1) for (const x of [5, 6, W - 7, W - 6]) b.set(x, y, x === 5 || x === W - 7 ? T[2] : T[1], 'trim');
  for (let x = 5; x < W - 5; x += 1) { b.set(x, wallTop - 1, T[2], 'trim'); b.set(x, wallTop, T[0], 'trim'); }
  // the roof seen end-on: dark slate barge boards, white trim under them, a deep lid of snow on top
  for (let y = 0; y < wallTop + 2; y += 1) for (let x = 0; x < W; x += 1) {
    const d = y - edge(x);
    if (d < -3 || d > 4) continue;
    let c; let t = 'snow';
    if (d < 0) c = SNOW[d < -2 ? 3 : 4];
    else if (d < 2) { c = x < cx ? SNOW[3] : SNOW[2]; if (bayer(x, y) < 0.15) c = SNOW[x < cx ? 4 : 1]; }
    else if (d < 3) { c = '#3a3a52'; t = 'slate'; } else { c = T[2]; t = 'trim'; }
    b.set(x, y, c, t);
  }
  // icicles at the eave ends
  for (let x = 1; x < W - 1; x += 1) { if (Math.abs(x - cx) < 18) continue; const y = Math.round(edge(x) + 5); if (y > wallTop + 1) continue; const len = h2(x, 1, 9) < 0.45 ? 1 + Math.floor(h2(x, 2, 9) * 3) : 0; for (let k = 0; k < len; k += 1) b.set(x, y + k, k === len - 1 ? '#c8dcf8' : '#eef6ff', 'ice'); }
  // the boat doors: two leaves in a white frame, white braces, the right one ajar with the warm boathouse inside
  const dx0 = 17; const dx1 = W - 17; const dy = 37;
  for (let y = dy - 2; y < base; y += 1) for (let x = dx0 - 2; x < dx1 + 2; x += 1) {
    const inD = x >= dx0 && x < dx1 && y >= dy;
    if (!inD) { if (y === dy - 2 || y === dy - 1 || x < dx0 || x >= dx1) b.set(x, y, y === dy - 2 || x === dx0 - 2 ? T[2] : T[1], 'trim'); continue; }
    const u = x - dx0; const mid = Math.floor((dx1 - dx0) / 2);
    if (u >= mid && u < mid + 4) { b.set(x, y, y < dy + 3 ? GLOWR[1] : u === mid ? GLOWR[3] : GLOWR[2], 'lit'); continue; } // the gap: lamplight
    const bx = u % 4; const leafL = u < mid;
    let c = R[bx === 0 ? 1 : bx === 1 ? 3 : 2];
    if (!leafL) c = R[bx === 0 ? 0 : bx === 1 ? 2 : 1]; // the open leaf turned away, in its own shade
    b.set(x, y, c, 'door');
  }
  // the white Z braces on the left leaf, a plain rail on the right
  for (let k = 0; k < 9; k += 1) { b.set(dx0 + 1 + k, base - 2 - Math.round(k * 1.6), T[1], 'trim'); }
  for (let x = dx0; x < dx0 + 11; x += 1) { b.set(x, dy + 2, T[2], 'trim'); b.set(x, base - 2, T[1], 'trim'); }
  for (let x = dx0 + 15; x < dx1; x += 1) { b.set(x, dy + 2, T[0], 'trim'); b.set(x, base - 2, T[0], 'trim'); }
  // a little lit window on the left wall, a lifebuoy hanging on the right
  for (let y = 41; y < 48; y += 1) for (let x = 8; x < 14; x += 1) { const fr = x === 8 || x === 13 || y === 41 || y === 47; b.set(x, y, fr ? T[2] : x === 10 || y === 44 ? T[1] : (y < 44 ? GLOWR[3] : GLOWR[2]), fr || x === 10 || y === 44 ? 'trim' : 'lit'); }
  for (let y = -4; y <= 4; y += 1) for (let x = -4; x <= 4; x += 1) {
    if (!inEll(x, y, 0, 0, 4.5, 4.5) || inEll(x, y, 0, 0, 2, 2)) continue;
    const q = (x < 0) !== (y < 0);
    b.set(W - 11 + x, 44 + y, q ? (x + y < 0 ? '#ff6a5a' : '#d83a3a') : (x + y < 0 ? '#ffffff' : '#d8dce8'), 'buoy');
  }
  // the sign in the gable, over the doors
  wreathSign(b, cx, 22, f, { bow: '#2a6ab0', lights: ['#fff0b8', '#ff5a5a', '#fff0b8', '#ffc870'] });
  // warm white lights along the barge boards
  const pts = []; for (let x = 2; x < W - 2; x += 1) if (Math.abs(x - cx) > 3) pts.push([x, Math.round(edge(x) + 5)]);
  bulbsAlong(b, pts.filter(([, y]) => y <= wallTop), ['#fff0b8', '#ffc870', '#fff0b8', '#ff8a6a'], f, { step: 3 });
  // a grey stone footing, a plank slipway down to the water, snow banked either side
  for (let x = 4; x < W - 4; x += 1) { b.set(x, base, (x % 5) ? '#9894aa' : '#6e6a86', 'stone'); b.set(x, base + 1, '#6e6a86', 'stone'); }
  for (let y = base; y < base + 4; y += 1) for (let x = dx0 - 1 - (y - base); x < dx1 + 1 + (y - base); x += 1) b.set(x, y, (x - dx0) % 5 === 0 ? '#5a3a2a' : y === base ? '#c0925e' : '#9c6e46', 'plank');
  snowFoot(b, 1, W - 1, base + 2, [[dx0 - 6, dx1 + 6]]);
}

/** Castle: a little gatehouse tower, stone blocks, battlements under snow, banners, a studded arched door. */
function tower(b, P, f) {
  const W = 46; const S = P.stone; const cx = 23; const top = 22; const base = 75;
  // the tower: dressed stone in courses of 5, blocks of 8 staggered, the right side in shade
  for (let y = top; y < base; y += 1) for (let x = 5; x < W - 5; x += 1) {
    const row = Math.floor((y - top) / 5); const off = row % 2 ? 4 : 0;
    const joint = (y - top) % 5 === 4 || (x - 5 + off) % 8 === 7;
    let k = joint ? 1 : 3;
    if (!joint && (x - 5 + off) % 8 === 0) k = 4; if (!joint && (y - top) % 5 === 0) k = Math.max(k, 4);
    if (!joint && h2((x - 5 + off) >> 3, row, 11) < 0.25) k -= 1;
    if (x > W - 12 || (x > W - 15 && bayer(x, y) < 0.5)) k -= 1;
    b.set(x, y, S[Math.max(0, k)], 'stone');
  }
  // a corbel ledge, the battlements on it (merlons 6 wide, gaps 4), snow on each
  for (let x = 3; x < W - 3; x += 1) { b.set(x, top - 1, S[4], 'stone'); b.set(x, top, S[x % 3 ? 2 : 1], 'stone'); b.set(x, top + 1, S[0], 'stone'); }
  for (let m = 0; m < 4; m += 1) {
    const x0 = 3 + m * 10;
    for (let y = top - 9; y < top - 1; y += 1) for (let x = x0; x < x0 + 6 && x < W - 3; x += 1) b.set(x, y, x === x0 ? S[4] : x === x0 + 5 ? S[1] : (y - top) % 4 === 0 ? S[2] : S[3], 'stone');
    for (let x = x0 - 1; x < x0 + 7 && x < W - 2; x += 1) { b.set(x, top - 10, '#ffffff', 'snow'); b.set(x, top - 11, x > x0 && x < x0 + 5 ? '#eef2fc' : null, 'snow'); }
    if (m < 3) for (let x = x0 + 6; x < x0 + 10; x += 1) b.set(x, top - 2, '#eef2fc', 'snow');
  }
  // a flag on a pole over the middle, waving
  for (let y = 0; y < top - 11; y += 1) b.set(cx, y, '#6e6a86', 'pole');
  rows(b, cx + 1, 1, f === 1 ? ['bbbb..', 'bByyb.', 'bbbbbb', 'bbb...'] : f === 2 ? ['bbbbb.', 'bByybb', 'bbbbb.', 'bb....'] : ['bbbbbb', 'bByybb', 'bbbb..', 'b.....'], { b: P.banner, B: lighter(P.banner, 0.3), y: P.trim }, 'flag');
  rows(b, cx - 1, -1, ['.y.', 'yYy'], { y: P.trim, Y: '#fff0a0' }, 'flag');
  // arrow slits, warm inside
  for (const sx of [11, W - 13]) for (let y = 28; y < 37; y += 1) for (let x = sx - 1; x < sx + 3; x += 1) {
    const slit = x >= sx && x < sx + 2 && !(y === 28 && x === sx + 1); const cross = y === 32 && x >= sx - 1 && x < sx + 3;
    if (slit || cross) b.set(x, y, y < 32 ? GLOWR[3] : GLOWR[2], 'lit');
  }
  // the gate: an arch of pale voussoirs, a studded oak door, iron straps, a lamp-lit gap at its foot
  const dw = 8; const dt = 55;
  for (let y = dt - 4; y < base; y += 1) for (let x = cx - dw - 3; x <= cx + dw + 3; x += 1) {
    const inD = Math.abs(x + 0.5 - cx) <= dw && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw, 6));
    const inA = Math.abs(x + 0.5 - cx) <= dw + 3 && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw + 3, 9));
    if (inD) {
      const pl = Math.floor((x - (cx - dw)) / 4); const seam = (x - (cx - dw)) % 4 === 0;
      let c = seam ? darker(P.door, 0.35) : pl % 2 ? P.door : lighter(P.door, 0.12);
      if (y === dt + 6 || y === base - 6) c = '#3a3448';
      if ((y === dt + 6 || y === base - 6) && (x - cx) % 3 === 0) c = '#9894aa';
      if (y >= base - 2) c = GLOWR[(x + y) % 2 ? 2 : 1];
      b.set(x, y, c, y >= base - 2 ? 'lit' : 'door');
    } else if (inA) b.set(x, y, (Math.floor(Math.atan2(y - dt - 3, x + 0.5 - cx) * 4) % 2 ? S[4] : S[5]), 'arch');
  }
  rows(b, cx + 4, dt + 11, ['yY', 'oy'], { y: '#f0c030', Y: '#fff0a0', o: '#a86a1a' }, 'knob');
  // banners either side of the gate: royal purple, a gold edge and a gold crown
  for (const bx of [7, W - 13]) {
    rows(b, bx - 1, 44, ['yyyyyyyy'], { y: '#8a5418' }, 'rod');
    for (let y = 45; y < 63; y += 1) for (let x = bx; x < bx + 6; x += 1) {
      const tail = y > 58 && Math.abs(x + 0.5 - (bx + 3)) < (y - 58) * 0.8;
      if (tail) continue;
      const rim = x === bx || x === bx + 5;
      b.set(x, y, rim ? P.trim : x === bx + 1 ? lighter(P.banner, 0.25) : x === bx + 4 ? darker(P.banner, 0.25) : P.banner, 'banner');
    }
    rows(b, bx + 1, 49, ['y.y.', 'yyyy', 'yYYy'].map((r) => r.slice(0, 4)), { y: P.trim, Y: '#fff0a0' }, 'banner');
  }
  // the sign over the gate
  wreathSign(b, cx, 42, f, { bow: P.trim, lights: ['#ffd84a', '#ff6a5a', '#ffd84a', '#fff2c0'] });
  // gold lights along the ledge
  const pts = []; for (let x = 4; x < W - 4; x += 1) pts.push([x, top + 2]);
  bulbsAlong(b, pts, ['#ffd84a', '#ff6a5a', '#ffd84a', '#fff2c0'], f, { step: 3 });
  // a plinth, snow banked against it
  for (let x = 3; x < W - 3; x += 1) { b.set(x, base, S[x % 6 ? 3 : 1], 'stone'); b.set(x, base + 1, S[1], 'stone'); }
  snowFoot(b, 1, W - 1, base + 2, [[cx - dw - 1, cx + dw + 1]]);
}

/** Sunset: a striped beach hut on stilts, shell lights along its roof, a surfboard, a starfish. */
function beachhut(b, P, f) {
  const W = 56; const cx = 28; const RF = P.roof; const WD = P.wood; const [s0, s1] = P.stripes;
  const edge = (x) => 6 + Math.abs(x + 0.5 - cx) * 0.62; const wallTop = 23; const deck = 47; const base = 58;
  // the hut: stripes 4 wide, coral and cream, the right side in shade; its gable striped too
  for (let y = 8; y < deck; y += 1) for (let x = 8; x < W - 8; x += 1) {
    if (y < edge(x) + 3) continue;
    let c = Math.floor((x - 8) / 4) % 2 ? s1 : s0;
    if ((x - 8) % 4 === 0) c = darker(c, 0.12);
    if (x > W - 18 && bayer(x, y) < (x - (W - 18)) / 12) c = darker(c, 0.18);
    if (y > deck - 3) c = darker(c, 0.15);
    b.set(x, y, c, 'board');
  }
  // the roof: teal boards with a dusting of snow, overhanging
  for (let y = 0; y < wallTop + 3; y += 1) for (let x = 2; x < W - 2; x += 1) {
    const d = y - edge(x);
    if (d < -2 || d > 3) continue;
    let c; let t = 'roof';
    if (d < 0) { c = d < -1 ? '#eef2fc' : '#ffffff'; t = 'snow'; if (h2(x, 1, 5) < 0.3) { c = RF[4]; t = 'roof'; } } else c = RF[d === 0 ? 3 : d === 1 ? 2 : d === 2 ? 1 : 0];
    if (x > cx && d >= 0) c = RF[Math.max(0, (d === 0 ? 3 : d === 1 ? 2 : 1) - 1)];
    b.set(x, y, c, t);
  }
  // the door: aqua planks, a round porthole window, lit
  const dx = cx - 6; const dy = 30;
  for (let y = dy; y < deck; y += 1) for (let x = dx - 1; x < dx + 13; x += 1) {
    const fr = x === dx - 1 || x === dx + 12 || y === dy;
    b.set(x, y, fr ? '#fff8e8' : (x - dx) % 4 === 0 ? darker(P.door, 0.25) : (x - dx) % 4 === 1 ? lighter(P.door, 0.25) : P.door, fr ? 'trim' : 'door');
  }
  for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) { if (!inEll(x, y, 0, 0, 3.4, 3.4)) continue; const rim = !inEll(x, y, 0, 0, 2.2, 2.2); b.set(cx + x, dy + 6 + y, rim ? '#f0c040' : (x + y < 0 ? GLOWR[3] : GLOWR[2]), rim ? 'brass' : 'lit'); }
  rows(b, dx + 9, dy + 10, ['yY', 'oy'], { y: '#f0c030', Y: '#fff0a0', o: '#a86a1a' }, 'knob');
  // shuttered windows either side, warm light
  for (const wx of [10, W - 17]) {
    for (let y = 30; y < 38; y += 1) for (let x = wx; x < wx + 7; x += 1) { const fr = x === wx || x === wx + 6 || y === 30 || y === 37; b.set(x, y, fr ? '#fff8e8' : x === wx + 3 ? '#e8a040' : y < 34 ? GLOWR[3] : GLOWR[2], fr ? 'trim' : 'lit'); }
    rows(b, wx - 1, 38, ['ggggggggg', '.pPpPpPp.'], { g: '#5aa85a', p: '#ff7ab0', P: '#ffe07a' }, 'flowers');
  }
  // a starfish on the gable
  // the deck, the stilts, steps down to the sand
  for (let x = 4; x < W - 4; x += 1) { b.set(x, deck, WD[3], 'plank'); b.set(x, deck + 1, (x % 5) ? WD[2] : WD[0], 'plank'); b.set(x, deck + 2, WD[0], 'plank'); }
  for (const sx of [6, 18, W - 20, W - 8]) for (let y = deck + 3; y < base; y += 1) { b.set(sx, y, WD[2], 'post'); b.set(sx + 1, y, WD[0], 'post'); }
  for (let s = 0; s < 3; s += 1) for (let x = dx - 2 - s; x < dx + 14 + s; x += 1) { b.set(x, deck + 4 + s * 3, WD[3], 'plank'); b.set(x, deck + 5 + s * 3, WD[1], 'plank'); }
  // the sign on the gable, over the door
  wreathSign(b, cx, 18, f, { r: 9.6, ring: ['#1a4a4a', '#28645a', '#3a8068', '#56a078', '#86c090'], bow: '#ff7ab0', lights: ['#ff9a8a', '#6ae0e0', '#ffe07a', '#ff7ab0'] });
  // shell lights along both eaves
  const pts = []; for (let x = 3; x < W - 3; x += 1) if (Math.abs(x - cx) > 11) pts.push([x, Math.round(edge(x) + 4)]);
  bulbsAlong(b, pts, ['#ff9a8a', '#6ae0e0', '#ffe07a', '#ff7ab0'], f, { step: 4, shape: 'shell' });
  // a surfboard leaning on the right, a starfish at the left foot, sand and a little snow
  for (let y = 0; y < 30; y += 1) for (let x = 0; x < 5; x += 1) {
    const u = (y + 0.5) / 30; const half = 2.5 * Math.sin(Math.PI * Math.min(1, u * 1.08 + 0.04));
    if (Math.abs(x + 0.5 - 2.5) > half) continue;
    b.set(W - 6 + x + Math.floor(y / 15), 27 + y, x === 2 ? '#ff7a6a' : x < 2 ? '#fff8e8' : '#e8d8c0', 'board');
  }
  rows(b, 1, base - 6, ['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: '#ff8a3a', O: '#ffc080' }, 'star');
  for (let x = 0; x < W; x += 1) { const hh = 1 + Math.round(h2(x, 4, 6) * 1.4); for (let k = 0; k < hh; k += 1) b.set(x, base + 1 - k, k === hh - 1 ? (h2(x, 5, 6) < 0.4 ? '#ffffff' : '#f8e8cc') : '#e8cca6', 'sand'); }
}

/** Golden Galaxy: a star observatory, a round tower under a ribbed golden dome, its telescope out. */
function observatory(b, P, f) {
  const W = 48; const S = P.stone; const D = P.dome; const cx = 24; const ring = 38; const base = 71;
  // the round tower: curved courses, lit from the left like a cylinder
  for (let y = ring; y < base; y += 1) for (let x = 8; x < W - 8; x += 1) {
    const u = (x + 0.5 - cx) / 16; const row = Math.floor((y - ring) / 4); const off = row % 2 ? 3 : 0;
    const joint = (y - ring) % 4 === 3 || Math.round((Math.asin(Math.max(-1, Math.min(1, u))) * 9) + off) % 6 === 0;
    let k = 3.6 - u * 1.8 + (bayer(x, y) - 0.5) * 0.7; if (joint) k -= 1.2;
    b.set(x, y, S[Math.max(0, Math.min(5, Math.round(k)))], 'stone');
  }
  // the dome: golden ribs (meridians), a dark slit open to the sky, lit from the top left
  const dcx = cx; const dcy = ring; const rx = 19; const ry = 21;
  for (let y = dcy - ry; y < dcy; y += 1) for (let x = dcx - rx; x <= dcx + rx; x += 1) {
    if (!inEll(x, y, dcx, dcy, rx, ry)) continue;
    const u = (x + 0.5 - dcx) / rx; const v = (dcy - y - 0.5) / ry;
    const lon = Math.asin(Math.max(-1, Math.min(1, u / Math.sqrt(Math.max(0.0001, 1 - v * v)))));
    const rib = Math.abs(((lon / (Math.PI / 10)) % 1 + 1) % 1 - 0.5) > 0.42;
    let k = 3.4 - u * 1.4 + v * 0.9 + (bayer(x, y) - 0.5) * 0.6; if (rib) k -= 1.1;
    const slit = Math.abs(lon - 0.42) < 0.16 && v > 0.25;
    b.set(x, y, slit ? (v > 0.8 ? '#1a1030' : '#2a1e4a') : D[Math.max(0, Math.min(5, Math.round(k)))], slit ? 'slit' : 'dome');
  }
  for (let x = dcx - 11; x <= dcx + 5; x += 1) { const y = Math.ceil(dcy - ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - dcx) / rx) ** 2))); if (h2(x, 3, 9) > 0.25) { b.set(x, y, '#ffffff', 'snow'); if (Math.abs(x - dcx + 3) < 5) b.set(x, y + 1, '#eef2fc', 'snow'); } }
  // the telescope, poking out of the slit up to the right: a brass tube, a lens that glints
  for (let k = 0; k < 17; k += 1) for (let t = -2; t <= 1; t += 1) {
    const x = Math.round(dcx + 6 + k * 0.85 - t * 0.5); const y = Math.round(dcy - 10 - k * 0.62 + t * 0.85);
    b.set(x, y, t === -2 ? '#fff0b0' : t === 1 ? '#8a5418' : k % 6 === 5 ? '#a8701e' : '#e0a83a', 'scope');
  }
  rows(b, dcx + 19, dcy - 24, ['.ww', 'wWw', 'ww.'], { w: f === 1 ? '#ffffff' : '#bff4ff', W: '#ffffff' }, 'lit');
  // a gold band (a little balcony rail) where the dome sits on the tower, star lights on it
  for (let x = 6; x < W - 6; x += 1) { b.set(x, ring, D[4], 'rail'); b.set(x, ring + 1, x % 3 ? D[3] : D[1], 'rail'); b.set(x, ring + 2, D[1], 'rail'); }
  // round windows either side, warm
  for (const wx of [13, W - 13]) for (let y = -2; y <= 2; y += 1) for (let x = -2; x <= 2; x += 1) { if (!inEll(x, y, 0, 0, 2.6, 2.6)) continue; const rim = !inEll(x, y, 0, 0, 1.5, 1.5); b.set(wx + x, 51 + y, rim ? D[3] : '#fff4c8', rim ? 'rail' : 'lit'); }
  // the door: an arched indigo door with gold studs, stars painted on it
  const dw = 6; const dt = 58;
  for (let y = dt - 2; y < base; y += 1) for (let x = cx - dw - 2; x <= cx + dw + 2; x += 1) {
    const inD = Math.abs(x + 0.5 - cx) <= dw && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw, 5));
    const inF = Math.abs(x + 0.5 - cx) <= dw + 2 && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw + 2, 7));
    if (inD) b.set(x, y, x === cx ? darker(P.door, 0.3) : x < cx - 2 ? lighter(P.door, 0.2) : P.door, 'door');
    else if (inF) b.set(x, y, x < cx ? D[4] : D[2], 'rail');
  }
  rows(b, cx - 4, dt + 4, ['.y......', 'yYy...y.', '.y...yYy', '......y.'], { y: '#f0c040', Y: '#fff0a0' }, 'door');
  rows(b, cx + 2, dt + 9, ['y'], { y: '#fff0a0' }, 'knob');
  // the sign over the door
  wreathSign(b, cx, 47, f, { r: 9.6, plate: ['#d8b070', '#fff4d8', '#fffbe8'], ink: '#4a2ea0', bow: '#f0c040', lights: ['#ffe07a', '#fff8e0', '#ffc84a', '#ffffff'] });
  // star lights strung along the rail, stars twinkling round the dome
  const pts = []; for (let x = 7; x < W - 7; x += 1) pts.push([x, ring + 3]);
  bulbsAlong(b, pts, ['#ffe07a', '#fff8e0', '#d8c0ff', '#ffc84a'], f, { step: 5, shape: 'star' });
  [[3, 8], [8, 20], [W - 4, 30]].forEach(([x, y], i) => { if ((i + f) % 3 === 2) return; rows(b, x - 1, y - 1, (i + f) % 3 ? ['.w.', 'wWw', '.w.'] : ['...', '.W.', '...'], { w: '#fff6c8', W: '#ffffff' }, 'lit'); });
  // a stone footing, snow, star dust
  for (let x = 6; x < W - 6; x += 1) { b.set(x, base, S[x % 5 ? 3 : 1], 'stone'); b.set(x, base + 1, S[1], 'stone'); }
  snowFoot(b, 2, W - 2, base + 2, [[cx - dw - 1, cx + dw + 1]]);
}

/** Volcano: a round stone hut of dark lava rock, a thick thatch roof, ember-glow windows, flame lights. */
function stonehut(b, P, f) {
  const W = 58; const S = P.stone; const T = P.straw; const cx = 29; const base = 53; const eave = 29;
  // the walls: fieldstones of lava rock, round-ish, mortar between, lit from the left
  for (let y = eave - 2; y < base; y += 1) for (let x = 5; x < W - 5; x += 1) {
    const gx = x / 7; const gy = y / 5; const ix = Math.floor(gx + (Math.floor(gy) % 2) * 0.5); const iy = Math.floor(gy);
    const fx = gx + (Math.floor(gy) % 2) * 0.5 - ix; const fy = gy - iy;
    const mortar = fx < 0.14 || fy < 0.2;
    let k = 3 - (x + 0.5 - cx) / 26 * 1.6 + (h2(ix, iy, 31) - 0.5) * 1.6 + (fy < 0.45 ? 0.6 : -0.2) + (bayer(x, y) - 0.5) * 0.4;
    if (mortar) k = 1;
    b.set(x, y, S[Math.max(0, Math.min(5, Math.round(k)))], 'stone');
  }
  // the thatch: a deep bell of straw, streaked, a ragged fringe, patchy snow on top
  const top = (x) => { const u = Math.abs(x + 0.5 - cx) / 29; return u >= 1 ? 99 : Math.round(4 + Math.pow(u, 1.6) * 24); };
  for (let x = 0; x < W; x += 1) {
    const t0 = top(x); if (t0 > 90) continue;
    const fringe = eave + 2 + Math.round(h2(x, 7, 3) * 2);
    for (let y = t0; y < fringe; y += 1) {
      const u = (x + 0.5 - cx) / 29; const v = (y - t0) / Math.max(1, fringe - t0);
      let k = 3.4 - u * 1.6 - v * 0.8 + (h2(x, y >> 1, 5) - 0.5) * 1.2;
      if ((x + Math.floor(y / 3)) % 5 === 0) k -= 1;
      b.set(x, y, T[Math.max(0, Math.min(5, Math.round(k)))], 'straw');
    }
    if (h2(x, 9, 2) > 0.3 && Math.abs(x - cx) < 20) { b.set(x, t0, '#ffffff', 'snow'); if (h2(x, 10, 2) > 0.5) b.set(x, t0 + 1, '#e4e8f6', 'snow'); }
  }
  // a smoke hole at the top, a curl of smoke
  rows(b, cx - 2, 3, ['.dd.', 'dDDd'], { d: T[1], D: '#2a1e1e' }, 'straw');
  rows(b, cx - 1 + (f === 1 ? 1 : 0), -3 + (f === 2 ? -1 : 0), ['.ss.', 's..s', '.ss.'], { s: '#c8c0cc' }, 'smoke');
  // the door: low, round topped, heavy planks, a lava-glow gap round it
  const dw = 6; const dt = 38;
  for (let y = dt - 2; y < base; y += 1) for (let x = cx - dw - 2; x <= cx + dw + 2; x += 1) {
    const inD = Math.abs(x + 0.5 - cx) <= dw && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw, 5));
    const inF = Math.abs(x + 0.5 - cx) <= dw + 1.5 && (y >= dt + 3 || inEll(x, y, cx, dt + 3, dw + 1.5, 6.5));
    if (inD) { const pl = (x - (cx - dw)) % 4; b.set(x, y, y === dt + 7 || y === base - 4 ? '#2a2028' : pl === 0 ? darker(P.door, 0.3) : pl === 1 ? lighter(P.door, 0.2) : P.door, 'door'); }
    else if (inF) b.set(x, y, (x + y) % 2 ? '#ffb040' : P.glow, 'lit');
  }
  rows(b, cx + 3, dt + 9, ['yY', 'oy'], { y: '#f0c030', Y: '#fff0a0', o: '#a86a1a' }, 'knob');
  // round windows, an ember glow in each
  for (const wx of [13, W - 13]) for (let y = -3; y <= 3; y += 1) for (let x = -3; x <= 3; x += 1) {
    if (!inEll(x, y, 0, 0, 3.5, 3.5)) continue;
    const rim = !inEll(x, y, 0, 0, 2.3, 2.3);
    b.set(wx + x, 41 + y, rim ? S[4] : (x + y < 0 ? '#ffe080' : x + y < 2 ? '#ffb040' : P.glow), rim ? 'stone' : 'lit');
  }
  // the sign hung on the thatch, over the door
  wreathSign(b, cx, 22, f, { r: 9.6, ring: ['#1e3a22', '#2a5a2a', '#3a7a36', '#5aa048', '#8cc85a'], bow: '#ff7a2a', lights: ['#ff7a2a', '#ffc840', '#ff4a3a', '#ffe080'] });
  // flame lights along the fringe
  const pts = []; for (let x = 2; x < W - 2; x += 1) if (Math.abs(x - cx) > 10) pts.push([x, eave + 4 + Math.round(h2(x, 7, 3) * 2) - (Math.abs(x - cx) > 26 ? 1 : 0)]);
  bulbsAlong(b, pts, ['#ff7a2a', '#ffc840', '#ff4a3a', '#ffe080'], f, { step: 4, shape: 'flame', dim: '#3a2a2a' });
  // a fire bowl of lava rock by the door, a little flame dancing
  rows(b, W - 9, base - 6, f === 1 ? ['..y..', '.yYy.', '.oyo.', 'ssSss', '.sss.'] : f === 2 ? ['.y...', '.yYy.', 'oyYyo', 'ssSss', '.sss.'] : ['...y.', '.yYy.', '.oYyo', 'ssSss', '.sss.'], { y: '#ffc840', Y: '#fff0a0', o: '#ff7a2a', s: S[3], S: S[4] }, 'fire', 'yYo');
  for (let x = 4; x < W - 4; x += 1) { b.set(x, base, S[x % 5 ? 2 : 0], 'stone'); }
  snowFoot(b, 1, W - 1, base + 2, [[cx - dw - 2, cx + dw + 2]]);
}

/** The advent house (its size: adventSize(mapId)), its foot (doorstep) at (ax, ay). */
export function adventHouseArt(mapId, o = {}) {
  const P = lookOf(mapId); const f = o.frame || 0;
  const [w, h, ax, ay] = SIZE[P.design];
  const draw = { cabin: () => (b) => cabin(b, P, f), ginger: () => (b) => ginger(b, f), grotto: () => (b) => grotto(b, P, f), dome: () => (b) => dome(b, P, f), boathouse: () => (b) => boathouse(b, P, f), tower: () => (b) => tower(b, P, f), beachhut: () => (b) => beachhut(b, P, f), observatory: () => (b) => observatory(b, P, f), stonehut: () => (b) => stonehut(b, P, f) }[P.design]();
  return spriteOf(w, h, draw, { night: o.night || null, nightMix: 0.76, ax, ay, ground: 3, pad: 8, noLine: ['smoke', 'bubble', 'ice', 'snow', 'sand'] });
}

// ---------- inside: the wall of doors ----------

export const WALL = { W: 204, H: 238 };
const DOOR_COLORS = ['#c8404a', '#3a8a5a', '#e8c070', '#4a6ab0', '#9a4a8a', '#e07a3a'];
// the 24 small doors are scattered over the wall (like a real advent calendar); 25 is the big one
const ORDER = [7, 18, 3, 12, 22, 9, 15, 1, 20, 5, 24, 11, 16, 2, 8, 19, 13, 23, 4, 10, 17, 6, 21, 14];

const FONT5 = {
  0: ['.xxx.', 'x...x', 'x..xx', 'x.x.x', 'xx..x', 'x...x', '.xxx.'], 1: ['..x..', '.xx..', 'x.x..', '..x..', '..x..', '..x..', 'xxxxx'],
  2: ['.xxx.', 'x...x', '....x', '..xx.', '.x...', 'x....', 'xxxxx'], 3: ['xxxx.', '....x', '....x', '.xxx.', '....x', '....x', 'xxxx.'],
  4: ['...x.', '..xx.', '.x.x.', 'x..x.', 'xxxxx', '...x.', '...x.'], 5: ['xxxxx', 'x....', 'xxxx.', '....x', '....x', 'x...x', '.xxx.'],
  6: ['..xx.', '.x...', 'x....', 'xxxx.', 'x...x', 'x...x', '.xxx.'], 7: ['xxxxx', '....x', '...x.', '..x..', '.x...', '.x...', '.x...'],
  8: ['.xxx.', 'x...x', 'x...x', '.xxx.', 'x...x', 'x...x', '.xxx.'], 9: ['.xxx.', 'x...x', 'x...x', '.xxxx', '....x', '...x.', '.xx..'],
};
function num5(b, X, Y, n, c, shadow) {
  String(n).split('').forEach((ch, i) => FONT5[ch].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] === 'x') { if (shadow) b.set(X + i * 6 + x + 1, Y + y + 1, shadow, 'num'); b.set(X + i * 6 + x, Y + y, c, 'num'); } }));
  return String(n).length * 6 - 1;
}

/**
 * What a door gave, as { kind, id?, item?, color? }: 'coins', 'gem', 'game' (an extra visitor game),
 * 'ornament' (id: this map's ornament), 'outfit' (item and color: a color version of a holiday
 * outfit), 'golden' (id: a super-rare ornament, or item: a holiday outfit piece). A bare string is its kind.
 */
const prizeOf = (p) => (!p ? null : typeof p === 'string' ? { kind: p } : p);

/** A sprite buffer (pixelkit Buf, like xmasart.js ornamentArt gives) stood with its foot at (cx, cy). */
function blitArt(b, art, cx, cy) {
  let x0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  art.each((x, y) => { if (art.get(x, y)) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
  if (y1 < 0) return;
  const ox = cx - Math.round((x0 + x1) / 2); const oy = cy - y1;
  art.each((x, y) => { const c = art.get(x, y); if (c) b.set(ox + x, oy + y, c, 'prize'); });
}

/** The door's number on a little cream tag in the niche's top left corner. */
function numberTag(b, X, Y, n, gold) {
  const t = String(n); const w = t.length * 4 + 1;
  for (let yy = 0; yy < 7; yy += 1) for (let xx = 0; xx < w + 2; xx += 1) {
    if ((yy === 0 || yy === 6) && (xx === 0 || xx === w + 1)) continue;
    b.set(X + xx, Y + yy, yy === 6 || xx === w + 1 ? (gold ? '#a8701e' : '#c8a878') : '#fff4dc', 'tag');
  }
  t.split('').forEach((ch, i) => DIGITS[ch].forEach((row, yy) => { for (let xx = 0; xx < 3; xx += 1) if (row[xx] === 'x') b.set(X + 1 + i * 4 + xx, Y + 1 + yy, '#5a2a3a', 'tag'); }));
}

const SCARF = { red: '#d83a3a', green: '#3a9a4a', blue: '#3a6ad0', purple: '#8a4ac8', pink: '#e86aa0', yellow: '#e8b830', teal: '#2aa0a0' };

/** A prize in an opened door's niche (when no real art is given), sitting on its tissue paper, its foot at (cx, cy). */
function prize(b, Pz, cx, cy, mapId, f) {
  const kind = Pz.kind;
  const P = (art, pal, X, Y, lit = '') => rows(b, X, Y, art, pal, 'prize', lit);
  const G = { y: '#f0c040', Y: '#ffe27a', W: '#fff6c8', o: '#c88a20', d: '#8a5418' };
  if (kind === 'coins') {
    // a little stack of coins and one stood up against it, stamped with a star
    const flat = ['.ooooooooo.', 'oYYYYYYYYyo', 'dyyyyyyyyyd', '.ddddddddd.'];
    P(flat, G, cx - 11, cy - 4); P(flat, G, cx - 10, cy - 7); P(flat, G, cx - 11, cy - 10);
    P(['..ddddd..', '.dyYYYyd.', 'dyYWYYYyd', 'dYYWWWYyd', 'dYWWWWWyd', 'dyYWWWYyd', 'dyYWyWyyd', '.dyyyyyd.', '..ddddd..'].map((r) => r.replace(/W/g, 'Q')), { ...G, Q: '#fff0a0' }, cx + 1, cy - 9, 'yYQ');
    if (f !== 2) P(['w'], { w: '#ffffff' }, cx + 3, cy - 11, 'w');
  } else if (kind === 'gem') {
    P(['...CCCCC...', '..CWWCCcc..', '.CWWCCCccc.', 'CCCCCCCcccc', '.ccCCcccdd.', '..ccCccdd..', '...cCcdd...', '....cdd....', '.....d.....'], { c: '#40c8d8', C: '#a8f0f8', W: '#ffffff', d: '#2a7a9a' }, cx - 5, cy - 10, 'cCWd');
    if (f !== 1) P(['.w.', 'wWw', '.w.'], { w: '#e8ffff', W: '#ffffff' }, cx + 4, cy - 13, 'wW');
  } else if (kind === 'ornament') {
    const c = { 'bg-ocean': '#40c0d0', 'bg-space': '#b8a8ff', 'bg-rainbow': '#ff8ab8', 'bg-fjord': '#5a8ae8' }[mapId] || '#e8404a';
    P(['....k.k....', '.....k.....', '....MMM....', '...MmMmM...', '..CCCCccc..', '.CWWCCcccc.', 'CWWCCCccccd', 'yYyYyYyYyyo', 'cccwcccwccd', 'ccccccccccd', '.cccccccdd.', '..ccccddd..', '....ddd....'],
      { k: '#a8a4b4', M: '#f0c040', m: '#a8701e', c, C: lighter(c, 0.3), W: '#ffffff', w: lighter(c, 0.6), d: darker(c, 0.35), y: '#f0c040', Y: '#fff0a0', o: '#a8701e' }, cx - 5, cy - 13);
  } else if (kind === 'golden') {
    // the golden door's prize when its art is not given: a glittering super-rare bauble (never a star: stars are door 25's)
    P(['....k.k....', '.....k.....', '....MMM....', '...MmMmM...', '..pPPPppp..', '.pWWPpWppp.', 'pWWPPppWppd', 'pPPpWppppWd', 'ppWpppWpppd', 'pppppppWppd', '.ppWppppdd.', '..pppdddd..', '....ddd....'],
      { k: '#a8a4b4', M: '#f0c040', m: '#a8701e', p: '#9a4ad8', P: '#c88aff', W: '#ffffff', d: '#5a2a9a' }, cx - 5, cy - 13, 'W');
  } else if (kind === 'game') {
    // an extra visitor game: a ticket with a star, its stub torn along dots
    P(['.TTTTTTTT.tttt.', 'TWWWWWWWWTtWWt.', 'TWWWyWWWWTtWWWt', 'TWWyYyWWWT.WWWt', 'TWyYYYyWWTtWWWt', 'TWWyYyWWWT.WWWt', 'TWWyWyWWWTtWWWt', 'TWWWWWWWWT.WWt.', '.TTTTTTTT.tttt.'], { T: '#d84a7a', t: '#a83a5a', W: '#ffe0ec', y: '#f0c040', Y: '#fff0a0' }, cx - 7, cy - 9);
  } else if (kind === 'outfit') {
    // a color version of a holiday outfit: the knit scarf, folded, in its new color, fringe at its ends
    const c = SCARF[Pz.color] || Pz.color || '#3a6ad0';
    P(['.cccccccccc.', 'cCCcCCcCCcCc', 'cwwwwwwwwwwd', 'cCcCCcCCcCCd', 'ccccccccccdd', '.cCCcCCcCcd.', '.cwwwwwwwwd.', '.cCcCCcCCcd.', '.ccccccccdd.', '.f.f.f.f.f..', 'f.f.f.f.f...'], { c, C: lighter(c, 0.3), d: darker(c, 0.3), w: '#fff8ee', f: lighter(c, 0.15) }, cx - 6, cy - 11);
  }
}

/**
 * The wall of 25 doors inside the advent house, WALL.W x WALL.H, at one art pixel per village
 * pixel. o: { mapId, today (1..25), opened: { n: prize }, missed: [n
 * waiting from a missed day], frame }. Returns a canvas, and canvas.doors: [{ n, x, y, w, h }] to tap.
 */
export function adventWallArt(o = {}) {
  const { mapId = 'bg-meadow', today = 11, opened = {}, missed = [], frame: f = 0 } = o;
  const { W, H } = WALL;
  const doors = [];
  const cv = spriteOf(W, H, (b) => {
    // the room's wall: warm wood boards, a garland and lights across the top
    const WD = ['#4a2a36', '#6a3a36', '#8a5440', '#a86e4c', '#c48a5c', '#dcaa78'];
    for (let y = 0; y < H; y += 1) for (let x = 0; x < W; x += 1) {
      const board = Math.floor(x / 12); const seam = x % 12 === 0;
      let k = seam ? 1 : 3 - (h2(board, Math.floor(y / 40), 4) < 0.3 ? 1 : 0);
      if (!seam && h2(x, Math.floor(y / 3), board) < 0.06) k -= 1;
      b.set(x, y, WD[Math.max(0, k)], 'wall');
    }
    // the garland swag: pine, red bows, warm lights
    for (let x = 0; x < W; x += 1) {
      const sw = 6 + Math.round(Math.sin((x / W) * Math.PI * 4 - Math.PI / 2) * -4 + 4);
      for (let k = -2; k <= 2; k += 1) { const y = sw + k; const l = (h2(x, y, 1) - 0.5) + k * 0.3; b.set(x, y, ['#1e4a3a', '#2a6a44', '#3a8a4c', '#5aa85a'][Math.max(0, Math.min(3, Math.round(1.6 - l * 2)))], 'pine'); }
      if (x % 7 === 3) { const c = ['#ffd84a', '#ff5a5a', '#fff4c8'][Math.floor(x / 7) % 3]; const on = (Math.floor(x / 7) + f) % 3 !== 0; b.set(x, sw + 3, on ? c : mix(c, '#5a4a4a', 0.4), 'lit'); b.set(x, sw + 4, on ? lighter(c, 0.4) : mix(c, '#5a4a4a', 0.5), 'lit'); }
    }
    for (const bx of [2, Math.round(W / 4), Math.round(W / 2), Math.round((W * 3) / 4), W - 4]) rows(b, bx - 3, 0, ['rr.rr', 'rRcRr', '.rcr.', 'r.c.r', 'r...r'], { r: '#c8303a', R: '#ff5a5a', c: '#8a1a2a' }, 'bow');
    // the calendar: a carved cabinet with a star on top
    // (review 1: the cabinet fits the doors, no empty band under them)
    const C0 = 12; const C1 = W - 12; const T0 = 26; const T1 = H - 4;
    for (let y = T0; y < T1; y += 1) for (let x = C0; x < C1; x += 1) {
      const rim = x < C0 + 4 || x >= C1 - 4 || y < T0 + 4 || y >= T1 - 4;
      b.set(x, y, rim ? (x < C0 + 2 || y < T0 + 2 ? '#a8663e' : (x >= C1 - 2 || y >= T1 - 2 ? '#4a2a2a' : '#7a4436')) : '#3a2030', rim ? 'cab' : 'back');
    }
    rows(b, W / 2 - 6, T0 - 13, ['......y......', '.....yYy.....', 'yyyyyYWYyyyyy', '.yyYYYWYYYyy.', '..yyYYYYYyy..', '...yYYyYYy...', '..yYy...yYy..', '.yy.......yy.'], { y: '#f0b830', Y: '#ffe27a', W: '#ffffff' }, 'lit', 'yYW');
    // the doors: 5 across, 6 down; 25 is three wide and two tall in the middle of the bottom rows
    const gx = C0 + 7; const gy = T0 + 7; const cw = 34; const ch = 33;
    const cells = [];
    for (let r = 0; r < 6; r += 1) for (let c = 0; c < 5; c += 1) if (!(r >= 4 && c >= 1 && c <= 3)) cells.push([c, r]);
    const place = (n, c, r, wc = 1, hc = 1) => {
      const x = gx + c * cw; const y = gy + r * ch; const w = cw * wc - 4; const h = ch * hc - 4;
      doors.push({ n, x: x + 8, y: y + 8, w, h });
      drawDoor(b, n, x, y, w, h, { open: prizeOf(opened[n]), today: n === today, missed: missed.includes(n), f, mapId, art: o.prizeArt });
    };
    ORDER.forEach((n, i) => place(n, cells[i][0], cells[i][1]));
    place(25, 1, 4, 3, 2);
  }, { night: null, ax: 0, ay: 0, pad: 8, outline: false });
  cv.doors = doors;
  return cv;
}

function drawDoor(b, n, x, y, w, h, s) {
  // a missed day's door, still waiting, is solid lilac (review 1: it was lost among the beige doors)
  const base = n === 25 ? '#c8303a' : s.missed && !s.open ? '#a888e0' : DOOR_COLORS[(n * 5) % DOOR_COLORS.length];
  const D = [darker(base, 0.5), darker(base, 0.25), base, lighter(base, 0.2), lighter(base, 0.45)];
  const f = s.f;
  if (s.open) {
    // the niche, deep and lit warm from within; crinkled tissue paper in the bottom (gold for a golden door)
    const P = s.open; const gold = P.kind === 'golden';
    const tissue = { coins: ['#e8b8c8', '#f8d8e0', '#fff0f4'], gem: ['#a8c8e8', '#d0e4f8', '#f4faff'], ornament: ['#c8b890', '#e8d8b0', '#fff4d8'], game: ['#b8d8a8', '#d8f0c8', '#f4fff0'], outfit: ['#c8b8e0', '#e0d8f4', '#f8f4ff'], golden: ['#d89a2a', '#f0c040', '#fff0a0'] }[P.kind] || ['#c8b890', '#e8d8b0', '#fff4d8'];
    for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) {
      const sh = xx < 2 || yy < 2;
      const glow = 1 - Math.min(1, Math.hypot((xx - w / 2) / (w * 0.55), (yy - h * 0.45) / (h * 0.6)));
      const k = glow * 3 + (bayer(xx, yy) - 0.5) * 0.9;
      const ray = gold && Math.floor((Math.atan2(yy - h * 0.55, xx - w / 2) + Math.PI) / (Math.PI / 6) + 0.5) % 2 === 0;
      let c = gold ? ['#6a3a1e', '#8a5418', '#a8701e', '#c88a20', '#d89a2a'][Math.max(0, Math.min(4, Math.round(k + (ray ? 1 : 0))))] : ['#3a1e2c', '#5a3038', '#7a4440', '#9a5e4a', '#b87a58'][Math.max(0, Math.min(4, Math.round(k)))];
      if (sh) c = gold ? '#a8701e' : '#2a1424';
      const ty = h - 6 + Math.round(Math.sin(xx * 1.3) * 1 + Math.sin(xx * 0.6 + 1) * 0.8);
      if (yy >= ty && !(xx < 2)) c = tissue[yy === ty ? 2 : (xx + yy) % 3 === 0 ? 0 : 1];
      b.set(x + xx, y + yy, c, gold ? 'lit' : 'niche');
    }
    if (gold) for (const [sx, sy] of [[w - 6, 6], [5, h - 12], [w - 5, h - 13]]) if ((sx + sy + f) % 3) rows(b, x + sx - 1, y + sy - 1, ['.w.', 'wWw', '.w.'], { w: '#fff6c8', W: '#ffffff' }, 'lit', 'wW');
    // the real prize sitting on the tissue: the ornament itself when its art is given (xmasart.js ornamentArt)
    const cx = x + Math.round(w / 2) + 1; const cy = y + h - 4;
    const art = P.id && s.art ? s.art(P.id, f) : null;
    if (art) blitArt(b, art, cx, cy);
    else prize(b, P, cx, cy, s.mapId, f);
    // its number stays on a little tag, so the kid sees which day gave what
    numberTag(b, x + 3, y + 3, n, gold);
    // the open door, seen edge-on: a narrow panel with its number on its back
    for (let yy = -1; yy <= h; yy += 1) for (let xx = -4; xx < 0; xx += 1) b.set(x + xx, y + yy, xx === -4 ? D[0] : xx === -1 ? D[1] : D[3], 'door');
    for (let yy = 0; yy < h; yy += 1) b.set(x - 1, y + yy, '#e8c890', 'door');
    return;
  }
  if (n === 25) { bigDoor(b, x, y, w, h, s, D); glowRing(b, x, y, w, h, s); return; }
  // a shut door: a raised panel, a number plaque, a little knob
  for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) {
    let k = 2;
    if (xx === 0 || yy === 0) k = 4; else if (xx === w - 1 || yy === h - 1) k = 0;
    else if (xx === 3 || yy === 3) k = 1; else if (xx === w - 4 || yy === h - 4) k = 3;
    else if (h2(xx >> 1, yy >> 2, n) < 0.08) k = 1;
    b.set(x + xx, y + yy, D[k], 'door');
  }
  // the plaque and its number
  const tw = String(n).length * 6 + 3; const px0 = x + Math.round((w - tw) / 2); const py0 = y + 7;
  for (let yy = 0; yy < 11; yy += 1) for (let xx = 0; xx < tw; xx += 1) {
    const corner = (yy === 0 || yy === 10) && (xx === 0 || xx === tw - 1);
    if (corner) continue;
    b.set(px0 + xx, py0 + yy, yy === 0 || xx === 0 ? '#fffbe8' : yy === 10 || xx === tw - 1 ? '#c8a878' : '#f4e4c0', 'plaque');
  }
  num5(b, px0 + 2, py0 + 2, n, '#5a2a3a');
  rows(b, x + w - 7, y + Math.round(h * 0.62), ['yY', 'oy'], { y: '#f0c030', Y: '#fff0a0', o: '#a86a1a' }, 'knob');
  // snow on the little ledge of the doors in the top row is too much; a holly sprig on every fifth one
  if (n % 5 === 0) rows(b, x + 3, y + h - 8, ['g.g', 'gGr', '.rr'], { g: '#2a6a44', G: '#5aa85a', r: '#e8404a' }, 'holly');
  glowRing(b, x, y, w, h, s);
}

/** Today's door glows gold all round and twinkles; a missed day's door, waiting, pulses gently in lilac. */
function glowRing(b, x, y, w, h, s) {
  const f = s.f;
  if (s.today || s.missed) {
    if (s.missed && !s.today) {
      // a solid lilac ring that breathes: brighter and a pixel wider on the middle frame
      const ring = ['#c8a8ff', '#f0e4ff', '#d8c0ff'][f % 3];
      for (let yy = -2; yy <= h + 1; yy += 1) for (let xx = -2; xx <= w + 1; xx += 1) {
        const outer = xx === -2 || yy === -2 || xx === w + 1 || yy === h + 1; const inner = xx === -1 || yy === -1 || xx === w || yy === h;
        if (inner) b.set(x + xx, y + yy, ring, 'lit');
        else if (outer && f % 3 === 1) b.set(x + xx, y + yy, '#e0ccff', 'lit');
      }
      return;
    }
    const ring = ['#ffe27a', '#fff6c8', '#ffd040'];
    for (let yy = -2; yy <= h + 1; yy += 1) for (let xx = -2; xx <= w + 1; xx += 1) {
      const outer = xx === -2 || yy === -2 || xx === w + 1 || yy === h + 1; const inner = xx === -1 || yy === -1 || xx === w || yy === h;
      if (!outer && !inner) continue;
      if (outer && ((xx + yy + f * 2) % 4 === 0)) continue;
      b.set(x + xx, y + yy, inner ? ring[(Math.floor((xx + yy) / 3) + f) % 3] : ring[2], 'lit');
    }
    if (s.today) {
      const sp = [[-5, 4], [w + 3, 10], [w / 2, -6], [6, h + 3], [w + 2, h - 3], [-4, h - 9]];
      sp.forEach(([sx, sy], i) => { if ((i + f) % 3 === 0) return; rows(b, x + Math.round(sx) - 1, y + sy - 1, (i + f) % 3 === 1 ? ['.w.', 'wWw', '.w.'] : ['..w..', '..w..', 'wwWww', '..w..', '..w..'], { w: '#fff6c8', W: '#ffffff' }, 'lit', 'wW'); });
      for (let yy = 1; yy < h - 1; yy += 1) for (let xx = 1; xx < w - 1; xx += 1) if ((xx + yy) % 2 === 0 && (xx < 3 || yy < 3)) b.set(x + xx, y + yy, '#fff0b0', 'lit');
    }
  }
}

/** Door 25: a big present, wrapped in paper with snowflakes, a ribbon both ways, a bow on top and a gold medal with its number. */
function bigDoor(b, x, y, w, h, s, D) {
  const f = s.f; const mx = Math.floor(w / 2); const my = Math.floor(h / 2);
  for (let yy = 0; yy < h; yy += 1) for (let xx = 0; xx < w; xx += 1) {
    let c = xx === 0 || yy === 0 ? D[4] : xx === w - 1 || yy === h - 1 ? D[0] : xx === 1 || yy === 1 ? D[3] : xx === w - 2 || yy === h - 2 ? D[1] : D[2];
    if (c === D[2] && h2(xx >> 2, yy >> 1, 25) < 0.06) c = D[1];
    b.set(x + xx, y + yy, c, 'door');
  }
  // snowflakes printed on the paper, in rows, staggered
  for (let r = 0; r * 12 + 7 < h; r += 1) for (let k = 0; k * 14 + 7 < w; k += 1) {
    const fx = 7 + k * 14 + (r % 2 ? 7 : 0); const fy = 7 + r * 12;
    if (fx > w - 5 || Math.abs(fx - mx) < 7 || Math.abs(fy - my) < 6) continue;
    rows(b, x + fx - 2, y + fy - 2, ['w.w.w', '.wWw.', 'wWWWw', '.wWw.', 'w.w.w'], { w: lighter(D[2], 0.35), W: lighter(D[2], 0.6) }, 'door');
  }
  // the ribbon both ways: gold, a highlight on its top and left edge, a shadow on the other
  for (let yy = 1; yy < h - 1; yy += 1) for (let d = -3; d <= 2; d += 1) b.set(x + mx + d, y + yy, d === -3 ? '#ffe27a' : d === 2 ? '#a8701e' : d === -2 ? '#f8d860' : '#f0c040', 'ribbon');
  for (let xx = 1; xx < w - 1; xx += 1) for (let d = -3; d <= 2; d += 1) if (Math.abs(xx - mx) > 3) b.set(x + xx, y + my + d, d === -3 ? '#ffe27a' : d === 2 ? '#a8701e' : d === -2 ? '#f8d860' : '#d89a2a', 'ribbon');
  // the bow, sitting on the top edge: two loops, a knot and two tails
  const loop = (u, v) => inEll(u, v, -7, -4, 7, 4.6) || inEll(u, v, 7, -4, 7, 4.6);
  const hole = (u, v) => inEll(u, v, -7.5, -4.2, 3.2, 1.6) || inEll(u, v, 7.5, -4.2, 3.2, 1.6);
  const tail = (u, v) => v >= -1 && v <= 8 && Math.abs(Math.abs(u) - (2 + v * 0.7)) < 1.3 && Math.abs(u) > 1;
  const knot = (u, v) => Math.abs(u) <= 2 && v >= -7 && v <= -1;
  const bow = (u, v) => loop(u, v) || tail(u, v) || knot(u, v);
  for (let v = -10; v <= 9; v += 1) for (let u = -15; u <= 15; u += 1) {
    if (!bow(u, v)) continue;
    const rim = !bow(u - 1, v) || !bow(u + 1, v) || !bow(u, v - 1) || !bow(u, v + 1);
    let c = '#f0c040';
    if (hole(u, v)) c = '#a8701e';
    else if (knot(u, v)) c = u < 0 ? '#ffe27a' : '#f0c040';
    else if (rim) c = (v < -4 && !bow(u, v - 1)) || (!bow(u - 1, v) && u < 0) ? '#ffe27a' : '#8a5418';
    else if (u + v < -10 || (u > 0 && u + v < 0 && v < -5)) c = '#ffe27a';
    else if (v > -2) c = '#d89a2a';
    b.set(x + mx + u, y + 1 + v, c, 'ribbon');
  }
  // the gold medal in the middle with a big 25
  for (let yy = -12; yy <= 12; yy += 1) for (let xx = -16; xx <= 16; xx += 1) {
    if (!inEll(xx, yy, 0, 0, 15.6, 11.6)) continue;
    const rim = !inEll(xx, yy, 0, 0, 13.4, 9.4);
    const c = rim ? (!inEll(xx, yy, 0, 0, 14.8, 10.8) ? '#8a5418' : xx + yy < 0 ? '#ffe27a' : '#d89a2a') : xx + yy < -12 ? '#fffbe8' : '#fff0d0';
    b.set(x + mx + xx, y + my + yy, c, 'medal');
  }
  String(25).split('').forEach((ch, i) => FONT5[ch].forEach((row, yy) => { for (let xx = 0; xx < 5; xx += 1) if (row[xx] === 'x') for (const [ox, oy, c] of [[1, 1, '#e8b890'], [0, 0, '#b82a38']]) { const X = x + mx - 11 + i * 12 + xx * 2 + ox; const Y = y + my - 7 + yy * 2 + oy; b.set(X, Y, c, 'num'); b.set(X + 1, Y, c, 'num'); b.set(X, Y + 1, c, 'num'); b.set(X + 1, Y + 1, c, 'num'); } }));
  // sparkles on the paper
  for (const [sx, sy] of [[w - 12, 9], [w - 20, h - 10], [12, h - 9], [16, 12]]) { const on = (sx + f) % 3 !== 0; if (on) rows(b, x + sx - 1, y + sy - 1, ['.w.', 'wWw', '.w.'], { w: '#fff6c8', W: '#ffffff' }, 'lit', 'wW'); }
}

export { number, INK };
