// The Kraken's ship, Under the Sea's landmark (it stands there once the ocean treasure map is
// finished), drawn for the village in its storybook style: one village pixel per art pixel, the
// grandest thing on the sea floor. An old galleon lies broken in two on a bank of sand, its bow
// tipped up one way and its stern the other, overgrown with coral, sponges and anemones. Behind
// the break a big, friendly, very sleepy octopus has made its home: its head rises over the gap
// and its arms are draped over both halves, one of them hugging a pearl. Glowing jellyfish drift
// overhead. A cheap overlay animates it: the jellyfish pulse and bob, the octopus breathes and
// dreams, little fish peek out of the portholes and circle the crow's nest, the windows glow,
// gold glints in the sand. Tapped, the octopus wakes, opens its big eyes, waves an arm and puffs
// a giggly cloud of ink.

import { mix, h2, vnoise, bayer, Buf, inEll, grid, pixelBuffer, clamp } from './pixelkit.js';
import { OB } from './oceanart.js';

export const GALLEON = { w: 184, h: 124 };
const W = GALLEON.w; const H = GALLEON.h;

const WD = ['#1a1820', '#2a2630', '#3c3538', '#544841', '#6c5c4c', '#86735a', '#a28d6c']; // drowned wood, dark .. light
const HOLD = ['#0c0a14', '#16121e']; // the dark inside the broken hull
const OC = ['#2a1850', '#3e2a74', '#583e9a', '#7458bc', '#9278d6', '#b49eea', '#d8ccf8']; // the octopus
const SK = ['#b884c4', '#eabce4', '#fae6f6']; // its suckers
const SF = OB.floor; // the sea floor, as the village's
const GD = ['#6a3a1e', '#a0682a', '#d49a36', '#f4c850', '#fff0a8'];
const AQ = ['#1a5a6a', '#2a8a8a', '#4ac0b0', '#8aeed8', '#d4fff4']; // a soft sea-green glow
const KP = OB.kelp;
const INK = '#141c34';

// ---------- where things are (art pixels) ----------

// the bow half, tipped up to the left; its planks end raggedly at the break, the ribs a little further
const bowTop = (x) => 46 + (x - 8) * 0.31 - Math.sin(((x - 8) / 80) * Math.PI) * 3;
const bowKeel = (x) => 84 + (x - 8) * 0.17;
const bowStem = (y) => 8 + clamp((y - 46) / 40, 0, 1) ** 1.6 * 14;
const bowRow = (x, y) => Math.floor((y - x * 0.31) / 4);
const bowPlank = (row) => 73 + Math.floor(h2(row, 1, 5) * 10);
const bowFrame = (row, y) => 84 + Math.max(0, y - 64) * 0.18 + Math.floor(h2(row, 2, 5) * 4);
const inBow = (x, y) => x + 0.5 >= bowStem(y) && y >= bowTop(x) && y <= bowKeel(x) && x <= bowFrame(bowRow(x, y), y);
// the stern half, tipped up to the right, with its castle
const sternTop = (x) => (x > 146 ? 38 - (x - 146) * 0.1 : 74 - (x - 98) * 0.4);
const sternKeel = (x) => 102 - (x - 98) * 0.17;
const sternEnd = (y) => 177 - Math.max(0, y - 56) * 0.14;
const sternRow = (x, y) => Math.floor((y + x * 0.4) / 4);
const sternPlank = (row) => 112 - Math.floor(h2(row, 1, 11) * 11);
const sternFrame = (row, y) => 102 - Math.max(0, y - 64) * 0.18 - Math.floor(h2(row, 2, 11) * 4);
const inStern = (x, y) => x <= sternEnd(y) && y >= sternTop(x) && y <= sternKeel(x) && x >= sternFrame(sternRow(x, y), y);
const MOUND = (x) => 97 + Math.abs(x - 92) * 0.07 - 4 * Math.exp(-(((x - 92) / 26) ** 2)) + Math.sin(x / 6) * 1.2 + Math.sin(x / 2.3) * 0.4;

const HEAD = { x: 93, y: 42, rx: 18, ry: 16 };
const EYES = [[86, 46], [100, 46]];
const MOUTH = [93, 54];
const PORTS = [[24, 62], [40, 68], [140, 70], [160, 66]];
const WINDOWS = [[155, 43], [167, 42]];
const MAST = { x0: 120, y0: 66, x1: 136, y1: 2 };
const NEST = { x: 133, y: 13 };
const JELLIES = [[14, 8, '#c8a8ff', 0], [46, 16, '#ff9ad8', 1], [166, 12, '#9ad8ff', 1]];
const PEARL = [94, 103];
const COINS = [[80, 108], [104, 110], [110, 104], [74, 112], [116, 112], [86, 113]];

// ---------- the octopus's arms ----------

/** Points along a smooth curve through pts (Catmull-Rom), about one per pixel. */
function spline(pts) {
  const P = [pts[0], ...pts, pts[pts.length - 1]];
  const out = [];
  for (let i = 1; i < P.length - 2; i += 1) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    const n = Math.max(2, Math.ceil(Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) * 1.5));
    for (let k = 0; k < n; k += 1) {
      const t = k / n; const t2 = t * t; const t3 = t2 * t;
      const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
      out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1])]);
    }
  }
  out.push(pts[pts.length - 1]);
  return out;
}

/** The curl at an arm's tip: a few points winding round from the end of pts (dir 1 turns right). */
function curl(pts, dir = 1, r = 3.2) {
  const [ax, ay] = pts[pts.length - 2]; const [bx, by] = pts[pts.length - 1];
  const a0 = Math.atan2(by - ay, bx - ax);
  const cx = bx + Math.cos(a0 + (dir * Math.PI) / 2) * r; const cy = by + Math.sin(a0 + (dir * Math.PI) / 2) * r;
  const out = [];
  for (let k = 1; k <= 8; k += 1) { const a = a0 - (dir * Math.PI) / 2 + dir * k * 0.72; const rr = r * (1 - k * 0.08); out.push([cx + Math.cos(a) * rr, cy + Math.sin(a) * rr]); }
  return [...pts, ...out];
}

/**
 * An arm: a tube along pts, r0 thick at the root tapering to r1, lit from the top left, a row
 * of pale suckers along its underside (side: which side is under, 1 or -1). shade darkens it.
 */
function arm(b, pts, r0, r1, side = 1, shade = 0) {
  const S = spline(pts);
  const R = (i) => r0 + (r1 - r0) * (i / (S.length - 1)) ** 0.8;
  const xs = S.map((p) => p[0]); const ys = S.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys) - r0 - 1); y <= Math.max(...ys) + r0 + 1; y += 1) {
    for (let x = Math.floor(Math.min(...xs) - r0 - 1); x <= Math.max(...xs) + r0 + 1; x += 1) {
      let bi = -1; let bd = Infinity;
      for (let i = 0; i < S.length; i += 1) { const d = Math.hypot(x + 0.5 - S[i][0], y + 0.5 - S[i][1]) - R(i); if (d < bd) { bd = d; bi = i; } }
      if (bd > 0) continue;
      const r = R(bi); const nx = (x + 0.5 - S[bi][0]) / r; const ny = (y + 0.5 - S[bi][1]) / r;
      const lit = -nx * 0.6 - ny * 0.8;
      const k = (lit > 0.5 ? 5 : lit > 0.1 ? 4 : lit > -0.4 ? 3 : 2) - shade;
      b.set(x, y, OC[Math.max(1, k)], 'octo');
    }
  }
  // suckers along the underside
  for (let i = 3; i < S.length - 3; i += 3) {
    const j = Math.min(S.length - 1, i + 1); const dx = S[j][0] - S[i][0]; const dy = S[j][1] - S[i][1]; const dl = Math.hypot(dx, dy) || 1;
    const r = R(i); if (r < 1.5) continue;
    const ux = (-dy / dl) * side; const uy = (dx / dl) * side;
    const sx = Math.round(S[i][0] + ux * (r - 0.9)); const sy = Math.round(S[i][1] + uy * (r - 0.9));
    if (b.tag(sx, sy) !== 'octo') continue;
    b.set(sx, sy, r > 2.4 ? SK[1] : SK[2], 'sucker');
    if (r > 2.4 && b.tag(sx + Math.round(ux), sy + Math.round(uy)) === 'octo') b.set(sx + Math.round(ux), sy + Math.round(uy), SK[0], 'sucker');
  }
}

// ---------- the ship ----------

/**
 * Drowned planks running along a half at its slope, weathered and weedy. At the break the planks
 * end raggedly (plankAt says where, row by row; side 1 means the break is on the right) and the
 * dark hold shows through between the ribs.
 */
function hullPaint(b, inside, topAt, slope, rowAt, plankAt, side, seed) {
  for (let y = 20; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    if (!inside(x, y)) continue;
    const d = y - topAt(x);
    const row = rowAt(x, y); const pe = plankAt(row);
    const past = side > 0 ? x - pe : pe - x;
    let c;
    if (past > 0) {
      // the hold, with its ribs
      const rib = ((x % 5) + 5) % 5 < 2;
      c = rib ? (((x % 5) + 5) % 5 === 0 ? WD[3] : WD[2]) : (d < 8 ? HOLD[1] : HOLD[0]);
    } else if (d < 1) c = WD[6];
    else if (d < 2) c = WD[4];
    else if (d < 4) c = WD[1]; // the wale
    else {
      const k = y - x * slope; const r = ((Math.floor(k) % 4) + 4) % 4;
      const seg = Math.floor((x + row * 11) / 19); const tone = h2(seg, row, seed);
      c = r === 3 ? WD[2] : tone < 0.18 ? (r === 0 ? WD[6] : WD[5]) : tone > 0.85 ? WD[3] : r === 0 ? WD[5] : WD[4];
      if ((((x + row * 11) % 19) + 19) % 19 === 0) c = WD[2];
      if (past === 0) c = WD[6]; // a splintered plank end
    }
    // weed and the green of the sea creeping over the old wood
    if (past <= 0 && vnoise(x, y, 6, seed + 3) > 0.7) c = mix(c, '#4a8a6a', 0.38);
    b.set(x, y, c, past > 0 ? 'hold' : 'wood');
  }
}

function paintGalleon() {
  const out = pixelBuffer(W, H);
  const { px } = out;

  // a soft shadow and the bank of sand the wreck lies on, fading into the sea floor
  for (let y = 70; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const e = ((x + 0.5 - 92) / 92) ** 2 + ((y + 0.5 - 106) / 20) ** 2;
    if (e > 1) continue;
    const fade = e > 0.55 ? (1 - e) / 0.45 : 1;
    if (bayer(x, y) > fade) continue;
    const top = MOUND(x);
    if (y < top) continue;
    const r = y - top;
    const wave = Math.sin(x / 4.5 + y * 1.2 + Math.sin(x / 13) * 2);
    let c = r < 1 ? SF[8] : r < 2.5 ? SF[7] : SF[6];
    if (r >= 2.5 && wave > 0.84) c = SF[5]; else if (r >= 2.5 && wave < -0.9) c = SF[7];
    if (r > 2.5 && r < 6 && (inBow(x, Math.floor(top) - 2) || inStern(x, Math.floor(top) - 2)) && bayer(x, y) < 0.55) c = SF[4]; // shade under the hulls
    if (r > 12) c = bayer(x, y) < 0.5 ? SF[5] : SF[6];
    px(x, y, c);
  }

  const b = new Buf(W, H, 3);

  // ---------- behind: the octopus, its head rising over the break ----------
  // its body down in the gap, in the shade of the hulls
  for (let y = 56; y < 98; y += 1) for (let x = 74; x < 112; x += 1) {
    if (!inEll(x, y, 93, 74, 17, 22)) continue;
    const lit = -(x + 0.5 - 93) / 17 - (y - 62) / 20;
    b.set(x, y, OC[lit > 0.3 ? 3 : lit > -0.45 ? 2 : 1], 'octo');
  }
  // two arm tips peeking out from behind the far ends, curled on the sand
  arm(b, curl([[36, 92], [24, 98], [12, 98]], 1, 2.6), 2.8, 1.1, -1);
  arm(b, curl([[150, 94], [164, 98], [176, 96]], -1, 2.6), 2.8, 1.1, 1);
  // the head: a round mantle, a little wider at the bottom
  for (let y = HEAD.y - HEAD.ry; y <= HEAD.y + HEAD.ry + 8; y += 1) for (let x = HEAD.x - HEAD.rx - 2; x <= HEAD.x + HEAD.rx + 2; x += 1) {
    const dx = (x + 0.5 - HEAD.x) / HEAD.rx; const dy = (y + 0.5 - HEAD.y) / HEAD.ry;
    const wid = 1 + clamp(dy, 0, 1) * 0.1;
    if (dx * dx / (wid * wid) + (dy < 0 ? dy * dy : (dy * 0.78) ** 2) > 1) continue;
    const z = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const lit = -dx * 0.5 - dy * 0.6 + z * 0.5;
    let k = lit > 0.78 ? 6 : lit > 0.5 ? 5 : lit > 0.2 ? 4 : lit > -0.15 ? 3 : 2;
    if (inEll(x, y, HEAD.x - 7, HEAD.y - 9, 4, 2.6)) k = 6; // the shine
    if (h2(x, y, 9) < 0.05 && k < 6 && k > 2 && dy < 0.3) k -= 1; // freckles
    b.set(x, y, OC[k], 'octo');
  }

  // ---------- the leaning mast on the stern, with a crow's nest and a tattered sail ----------
  const n = Math.ceil(Math.hypot(MAST.x1 - MAST.x0, MAST.y1 - MAST.y0)) * 2;
  for (let i = 0; i <= n; i += 1) {
    const t = i / n; const x = MAST.x0 + (MAST.x1 - MAST.x0) * t; const y = MAST.y0 + (MAST.y1 - MAST.y0) * t;
    const r = 2 - t * 0.7;
    for (let yy = -3; yy <= 3; yy += 1) for (let xx = -3; xx <= 3; xx += 1) {
      const d = Math.hypot(xx, yy); if (d > r) continue;
      b.set(Math.round(x + xx), Math.round(y + yy), xx + yy < -0.5 ? WD[6] : xx + yy > 1 ? WD[2] : WD[4], 'mast');
    }
  }
  grid((x, y, c) => b.set(x, y, c, 'mast'), NEST.x - 5, NEST.y, ['rrrrrrrrrrr', 'wWwwWwwWwwd', '.wwwWwwwwd.', '..ddddddd..'], { r: WD[6], w: WD[4], W: WD[5], d: WD[2] });
  // a yard across the mast with a sail hanging off it in tatters, pale and green with weed
  const mastX = (y) => MAST.x0 + ((MAST.x1 - MAST.x0) * (MAST.y0 - y)) / (MAST.y0 - MAST.y1);
  for (let k = -13; k <= 13; k += 1) { const x = Math.round(mastX(26)) + k; const y = 26 + Math.round(k * 0.12); b.set(x, y, WD[5], 'mast'); b.set(x, y + 1, WD[3], 'mast'); }
  const SL = ['#5e7c6e', '#7e9c8a', '#a0bca4', '#c4d8c0'];
  for (let k = -12; k <= 12; k += 1) {
    const x0 = Math.round(mastX(26)) + k; const y0 = 28 + Math.round(k * 0.12);
    const len = 13 - Math.round(Math.abs(k) * 0.25) + Math.round(Math.sin(k * 1.7) * 1.6 + Math.sin(k * 0.6) * 1.2);
    for (let j = 0; j < len; j += 1) {
      const x = x0 + Math.round(j * 0.12); const y = y0 + j;
      if (inEll(x, y, mastX(26) + 5, 34, 2, 1.6) || inEll(x, y, mastX(26) - 7, 37, 1.4, 1.3)) continue; // holes
      const belly = Math.sin(((k + 12) / 24) * Math.PI); // it billows a little: lighter in the middle
      b.set(x, y, j === 0 ? SL[0] : j === len - 1 ? SL[1] : belly > 0.8 && j < len - 3 ? SL[3] : k < -6 ? SL[1] : SL[2], 'sail');
    }
  }
  for (let k = 0; k < 12; k += 1) b.set(Math.round(mastX(26)) + 10 + Math.round(Math.sin(k / 2) * 1.2), 30 + k, KP[k < 3 ? 6 : 4], 'weed');

  // ---------- the two halves of the hull ----------
  hullPaint(b, inBow, bowTop, 0.31, bowRow, bowPlank, 1, 5);
  hullPaint(b, inStern, sternTop, -0.4, sternRow, sternPlank, -1, 11);
  // the deck seen above each half: a strip of planks and the far rail, ragged at the break too
  for (let x = 12; x < 86; x += 1) { const g = Math.round(bowTop(x)); for (let y = g - 6; y < g; y += 1) { if (x > bowPlank(bowRow(x, g)) + (g - y) % 3 || b.get(x, y)) continue; b.set(x, y, y === g - 6 ? WD[6] : y < g - 4 ? WD[2] : (x + y) % 9 === 0 ? WD[3] : WD[5], 'wood'); } }
  for (let x = 100; x < 177; x += 1) { const g = Math.round(sternTop(x)); const D = x > 146 ? 5 : 6; for (let y = g - D; y < g; y += 1) { if (x < sternPlank(sternRow(x, g)) - (g - y) % 3 || b.get(x, y)) continue; b.set(x, y, y === g - D ? WD[6] : y < g - D + 2 ? WD[2] : (x + y) % 9 === 0 ? WD[3] : WD[5], 'wood'); } }
  // the castle's front wall, a shade darker
  for (let y = 38; y < 55; y += 1) for (let x = 145; x < 148; x += 1) if (b.tag(x, y) === 'wood') b.set(x, y, x === 145 ? WD[6] : WD[2], 'wood');
  // the stern castle: windows glowing a soft sea-green, gold trim
  WINDOWS.forEach(([wx, wy]) => grid((x, y, c) => b.set(x, y, c, 'window'), wx - 3, wy, ['.ggggg.', 'gaAaAag', 'gAagaAg', 'ggggggg', 'gaAgAag', 'ggggggg'], { g: GD[1], a: AQ[2], A: AQ[3] }));
  for (let x = 148; x < 176; x += 1) { const y = Math.round(sternTop(x)) + 4; b.set(x, y, GD[3], 'gold'); b.set(x, y + 1, GD[1], 'gold'); }
  // the bowsprit, pointing up out of the bow, with a little gold figurehead
  for (let i = 0; i <= 28; i += 1) {
    const t = i / 28; const x = 12 - t * 10; const y = 50 - t * 28; const r = 1.8 - t * 0.7;
    for (let yy = -2; yy <= 2; yy += 1) for (let xx = -2; xx <= 2; xx += 1) if (Math.hypot(xx, yy) <= r) b.set(Math.round(x + xx), Math.round(y + yy), xx < 0 ? WD[6] : WD[3], 'mast');
  }
  grid((x, y, c) => b.set(x, y, c, 'gold'), 4, 46, ['.gg.', 'gGGg', '.gGg', '..g.', '.gg.'], { g: GD[2], G: GD[4] });
  // portholes: dark, with brass rims (fish look out of them in the overlay)
  PORTS.forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'port'), x - 3, y - 3, ['.bbbb.', 'bkkkkb', 'bkKKkb', 'bkKKkb', 'bkkkkb', '.bbbb.'], { b: GD[1], k: '#0e1428', K: '#081020' }));

  // ---------- what grows on it ----------
  const coral = (x0, y0, col, rows) => grid((x, y, c) => b.set(x, y, c, 'coral'), x0, y0, rows, col);
  coral(18, 42, { o: '#ff7a8a', O: '#ffc0c8', d: '#c84a6a' }, ['o.o..o', 'O.o.oO', '.ooOo.', '..oo..', '..dd..']);
  coral(62, 54, { o: '#ffa04a', O: '#ffe0a0', d: '#c8702a' }, ['.o.o.', 'oOoOo', '.ooo.', '..d..']);
  coral(170, 28, { o: '#ff7aa8', O: '#ffd0e4', d: '#c84a7a' }, ['o..o', 'oOoO', '.oo.', '.dd.']);
  coral(72, 82, { y: '#f0d040', Y: '#fff0a0', d: '#b09020' }, ['y.Y.y', 'y.y.y', 'yyyyy', '.ddd.']); // tube sponges
  // anemones on the hulls
  [[30, 80, '#ff9ad0'], [150, 84, '#c8a0ff'], [168, 74, '#ffb070']].forEach(([x, y, c]) => grid((xx, yy, cc) => b.set(xx, yy, cc, 'anem'), x - 3, y - 3, ['t.t.t', '.tTt.', 'tTTTt', '.ppp.'], { t: c, T: mix(c, '#ffffff', 0.55), p: mix(c, '#3a1a4a', 0.4) }));
  // a starfish, barnacles near the sand, weed hanging off the rails
  grid((x, y, c) => b.set(x, y, c, 'star'), 66, 82, ['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: '#ff8a4a', O: '#ffd0a0' });
  for (let x = 12; x < 176; x += 1) {
    if (vnoise(x, 0, 8, 21) < 0.58) continue;
    const y = Math.round(x < 92 ? bowKeel(x) : sternKeel(x)) - 3 - (h2(x, 1, 3) < 0.5 ? 1 : 0);
    if (b.tag(x, y) === 'wood' && h2(x, 2, 3) < 0.6) { b.set(x, y, '#e8e4f0', 'barnacle'); b.set(x, y + 1, '#8a84a0', 'barnacle'); }
  }
  [[16, 54, 8], [48, 62, 7], [132, 64, 8], [172, 46, 7]].forEach(([x0, y0, len], i) => { for (let k = 0; k < len; k += 1) b.set(x0 + Math.round(Math.sin(k / 2 + i) * 1.1), y0 + k, KP[k < 2 ? 6 : k % 3 ? 4 : 3], 'weed'); });
  // a kelp growing up from the bow's deck
  for (let y = 16; y < 46; y += 1) { const x = 30 + Math.round(Math.sin(y / 5) * 2); b.set(x, y, KP[4], 'weed'); if (y % 6 === 0) { b.set(x - 1, y - 1, KP[5], 'weed'); b.set(x - 2, y - 2, KP[6], 'weed'); } if (y % 6 === 3) { b.set(x + 1, y - 1, KP[5], 'weed'); b.set(x + 2, y - 2, KP[6], 'weed'); } }

  // ---------- in front: its arms, draped over both halves, and one hugging a pearl ----------
  arm(b, curl([[83, 57], [72, 59], [60, 56], [48, 52], [40, 50]], -1, 2.4), 3.4, 1.2, 1); // along the bow's deck
  arm(b, curl([[84, 61], [74, 66], [66, 73], [60, 83], [57, 93]], 1, 3), 3.8, 1.3, -1); // over the bow's rail
  arm(b, curl([[103, 57], [114, 60], [126, 58], [136, 54], [142, 52]], 1, 2.4), 3.4, 1.2, -1); // along the stern's deck
  arm(b, curl([[102, 61], [112, 66], [120, 74], [123, 84], [127, 94]], -1, 3), 3.8, 1.3, 1); // over the stern's rail
  arm(b, curl([[89, 96], [85, 102], [88, 108], [96, 109], [101, 105]], -1, 2.4), 3.2, 1.2, -1); // round the pearl

  b.outline((t, side) => {
    const m = String(t).split(':')[0];
    if (m === 'weed' || m === 'barnacle' || m === 'star' || m === 'window' || m === 'sucker' || m === 'anem' || m === 'coral' || m === 'port') return null;
    if (m === 'octo') return side === 'bottom' || side === 'right' ? OC[0] : OC[1];
    if (m === 'sail') return side === 'bottom' || side === 'right' ? '#3a5a4e' : '#4a6a5e';
    if (m === 'gold') return side === 'bottom' || side === 'right' ? GD[0] : null;
    return side === 'bottom' || side === 'right' ? INK : WD[1];
  });
  // the face, drawn over the outline pass: sleepy closed eyes (the overlay opens them), rosy cheeks, a small smile
  EYES.forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'face'), x - 3, y - 1, ['o.....o', '.o...o.', '..ooo..'], { o: OC[0] }));
  [[EYES[0][0] - 4, 51], [EYES[1][0] + 2, 51]].forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'face'), x, y, ['pPp'], { p: '#f08ac8', P: '#ffb4dc' }));
  grid((x, y, c) => b.set(x, y, c, 'face'), MOUTH[0] - 2, MOUTH[1], ['o...o', '.ooo.'], { o: OC[0] });
  b.blit(px, 0, 0);
  // the windows' glow spills softly round them
  WINDOWS.forEach(([wx, wy]) => { for (let y = -3; y < 9; y += 1) for (let x = -6; x < 7; x += 1) { const d = (x / 6.5) ** 2 + ((y - 3) / 6) ** 2; if (d < 1 && d > 0.4 && bayer(wx + x, wy + y) < 0.5) px(wx + x, wy + y, 'rgba(140,255,220,0.18)'); } });
  // the pearl it hugs, and gold spilled from the broken hold onto the sand
  grid(px, PEARL[0] - 2, PEARL[1] - 2, ['.ppp.', 'pWWpp', 'pWppq', 'ppppq', '.qqq.'], { p: '#e8e4f8', W: '#ffffff', q: '#a8a0d0' });
  COINS.forEach(([x, y], i) => grid(px, x, y, i % 2 ? ['cC', 'cc'] : ['Cc'], { c: GD[2], C: GD[4] }));
  grid(px, 70, 106, ['.rr.', 'rRrr', '.rr.'], { r: '#e8385a', R: '#ff9aaa' }); // a ruby
  return new ImageData(out.data, W, H);
}

let base = null;
const galleonBase = () => (base ||= paintGalleon());

// ---------- the overlay: what moves ----------

const FISH = ['.oo.', 'oWoo', '.oo.'];
// the arm that waves hello when it wakes, in two poses, drawn once
const WAVES = [
  curl([[80, 46], [73, 39], [70, 31], [72, 24]], 1, 2.4),
  curl([[80, 46], [71, 41], [64, 35], [61, 27]], 1, 2.4),
];
let waveImgs = null;
function waveSprites() {
  if (waveImgs) return waveImgs;
  waveImgs = WAVES.map((pts) => {
    const b = new Buf(W, H, 2);
    arm(b, pts, 3.2, 1.2, 1);
    b.outline((t, side) => (String(t).startsWith('sucker') ? null : side === 'bottom' || side === 'right' ? OC[0] : OC[1]));
    const o = pixelBuffer(W, H); b.blit(o.px, 0, 0);
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    c.getContext('2d').putImageData(new ImageData(o.data, W, H), 0, 0);
    return c;
  });
  return waveImgs;
}
// a soft round glow for the jellyfish: [dx, dy, alpha]
const HALO = [];
for (let y = -6; y <= 6; y += 1) for (let x = -7; x <= 7; x += 1) { const d = Math.hypot(x / 7, y / 6); if (d < 1) HALO.push([x, y, (1 - d) ** 1.4]); }

/**
 * Starts the galleon on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes it for a while:
 * the octopus opens its eyes, waves an arm and puffs a giggly cloud of ink; the jellyfish glow.
 */
export function startGalleon(canvas, host) {
  const ctx = canvas.getContext('2d');
  const img = galleonBase();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rect = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  const sprite = (rows, X, Y, pal, flip = false) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) { const c = pal[r[x]]; if (c) dot(flip ? X + r.length - 1 - x : X + x, Y + y, c); } });
  const bubble = (x, y, r, a = 0.8) => { if (r > 1) { rect(x, y - 1, 1, 1, `rgba(220,250,255,${a})`); rect(x - 1, y, 1, 1, `rgba(220,250,255,${a})`); rect(x + 1, y, 1, 1, `rgba(160,220,240,${a * 0.8})`); rect(x, y + 1, 1, 1, `rgba(160,220,240,${a * 0.8})`); dot(x - 1, y - 1, '#ffffff'); } else rect(x, y, 1, 1, `rgba(230,250,255,${a})`); };
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const awake = since < 4500;
    ctx.putImageData(img, 0, 0);

    // the windows breathe their sea-green glow
    const g = 0.5 + 0.5 * Math.sin(t * 1.3);
    WINDOWS.forEach(([wx, wy]) => rect(wx - 2, wy + 1, 5, 4, `rgba(180,255,230,${(awake ? 0.4 : 0.1) + g * 0.22})`));

    // jellyfish, pulsing and bobbing in a soft glow, trailing their tentacles
    JELLIES.forEach(([jx, jy, c, big], i) => {
      const bob = Math.sin(t * 0.8 + i * 2.1) * 2.5 - (awake ? 2 : 0);
      const pulse = (t * 1.2 + i * 0.37) % 1 < 0.3;
      const x = Math.round(jx + Math.sin(t * 0.35 + i) * 1.5); const y = Math.round(jy + bob);
      const glow = (awake ? 0.4 : 0.24) * (pulse ? 1.25 : 1);
      HALO.forEach(([dx, dy, a]) => rect(x + dx, y + dy + 1, 1, 1, `rgba(${c === '#ff9ad8' ? '255,200,240' : c === '#9ad8ff' ? '200,240,255' : '230,215,255'},${(a * glow).toFixed(3)})`));
      const pal = { c: mix(c, '#ffffff', 0.2), C: mix(c, '#ffffff', 0.6), W: '#ffffff', d: mix(c, '#3a2a6a', 0.35), o: mix(c, '#3a2a6a', 0.55) };
      const bell = big
        ? (pulse ? ['...ooooo...', '.ooCCCccoo.', 'oCWWCcccccd', 'occcccccddd', '.d.d.d.d.d.'] : ['...ooooo...', '..oCCCcco..', '.oCWWCccco.', '.oCWCccccd.', '.occcccccd.', '..d.d.d.d..'])
        : (pulse ? ['..ooo..', '.oCCco.', 'oCWcccd', 'occccdd', '.d.d.d.'] : ['..ooo..', '.oCCco.', '.oWccd.', '.occcd.', '.d.d.d.']);
      const bw = bell[0].length;
      sprite(bell, x - (bw >> 1), y - 2, pal);
      const tn = big ? 5 : 3;
      for (let k = 0; k < tn; k += 1) for (let j = 0; j < (big ? 7 : 4) + (k % 2) * 2; j += 1) {
        const tx = x - (bw >> 1) + 1 + k * 2 + Math.round(Math.sin(t * 2 + j * 0.7 + k) * 0.8); const ty = y + bell.length - 2 + j;
        rect(tx, ty, 1, 1, `rgba(${j < 3 ? '255,235,250' : '235,215,255'},${(0.8 - j * 0.08).toFixed(2)})`);
      }
    });

    // little fish look out of the portholes, one at a time
    const pi = Math.floor(t / 2.6) % PORTS.length; const ph = (t % 2.6) / 2.6;
    if (ph > 0.15 && ph < 0.85) {
      const [px0, py0] = PORTS[pi]; const peek = Math.round(Math.sin(((ph - 0.15) / 0.7) * Math.PI) * 2);
      const left = pi < 2; // the bow's fish look left, the stern's right
      sprite(FISH, px0 - 2 + (left ? -peek : peek), py0 - 1, { o: ['#ffd040', '#ff8a4a', '#6ad0ff', '#ff7ab0'][pi], W: '#1a1a2a' }, !left);
    }
    // a small school circling the crow's nest
    for (let i = 0; i < 4; i += 1) {
      const a = t * 0.9 + i * 0.5; const x = NEST.x + Math.cos(a) * 13; const y = NEST.y + 1 + Math.sin(a) * 4;
      const dir = -Math.sin(a) > 0 ? 1 : -1;
      if (Math.sin(a) < -0.2 && Math.abs(x - NEST.x) < 6) continue; // behind the nest
      sprite(['oo.', 'oWo'], Math.round(x) - 1, Math.round(y), { o: '#ffe070', W: '#1a1a2a' }, dir < 0);
    }

    // the octopus: asleep, it breathes and dreams; awake, it looks, waves and giggles out ink
    if (Math.sin(t * 1.1) > 0.3) { rect(HEAD.x - 8, HEAD.y - HEAD.ry - 1, 17, 1, OC[1]); rect(HEAD.x - 7, HEAD.y - HEAD.ry, 15, 1, OC[5]); }
    if (awake) {
      const blink = since > 1500 && (since % 1800) < 140;
      EYES.forEach(([x, y]) => {
        if (blink) { sprite(['ooooo'], x - 2, y, { o: OC[0] }); return; }
        sprite(['..ooo..', '.oWWWo.', 'oWWWWWo', 'oWkkWWo', 'oWkKkWo', 'oWkkkWo', '.oWWWo.', '..ooo..'], x - 3, y - 4, { o: OC[0], W: '#ffffff', k: '#1a1030', K: '#ffffff' });
      });
      sprite(['o.....o', 'oPPPPPo', '.oPRPo.', '..ooo..'], MOUTH[0] - 3, MOUTH[1] - 1, { o: OC[0], P: '#c83a7a', R: '#ff8ab8' });
      // an arm waves hello
      ctx.drawImage(waveSprites()[Math.sin(t * 7) > 0 ? 0 : 1], 0, 0);
      // a giggly puff of ink, drifting up and fading (dithered, so it stays crisp)
      if (since < 3600) {
        // a cartoon cloud: a few round puffs run together, outlined, lit from the top left
        const u = since / 3600; const grow = 0.75 + u * 0.6; const ox = 116 + u * 12; const oy = 50 - u * 14;
        const puffs = [[0, 0, 5], [6, -3, 4], [-5, -3, 3.5], [3, 4, 3.5], [-3, 3, 3]].map(([x, y, r]) => [ox + x * grow, oy + y * grow, r * grow]);
        const inCloud = (x, y) => puffs.find(([cx, cy, r]) => Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= r);
        for (let y = Math.floor(oy - 12); y <= oy + 12; y += 1) for (let x = Math.floor(ox - 12); x <= ox + 14; x += 1) {
          const p = inCloud(x, y); if (!p) continue;
          if (bayer(x, y) > (1 - u) * 1.6) continue; // it thins away, crisply
          const edge = !inCloud(x - 1, y) || !inCloud(x + 1, y) || !inCloud(x, y - 1) || !inCloud(x, y + 1);
          const lit = (p[0] - x - 0.5) + (p[1] - y - 0.5) > p[2] * 0.55;
          dot(x, y, edge ? '#2a1e5c' : lit ? '#8a78c8' : '#5a4898');
        }
        dot(ox - 3, oy - 2, '#c8bcf0'); dot(ox + 4, oy - 5, '#c8bcf0');
        [[110, 34], [116, 28], [106, 26]].forEach(([x, y], k) => bubble(x + Math.sin(t * 3 + k) * 1.5, y - ((since / 1000 + k * 0.4) % 1.4) * 10, k % 2 ? 1 : 2, 0.9));
      }
    } else {
      // dreaming: little z's float up from its head
      for (let k = 0; k < 3; k += 1) {
        const p = (t / 4.5 + k / 3) % 1;
        if (p > 0.85) continue;
        const x = Math.round(HEAD.x + 14 + p * 12 + Math.sin(p * 9) * 2); const y = Math.round(HEAD.y - HEAD.ry - 1 - p * 20);
        const a = (0.95 - p * 0.7).toFixed(2);
        sprite(p > 0.35 ? ['zzzz', '...z', '..z.', '.z..', 'zzzz'] : ['zzz', '..z', '.z.', 'zzz'], x, y, { z: `rgba(240,236,255,${a})` });
      }
    }

    // bubbles rising out of the break
    for (let i = 0; i < 5; i += 1) {
      const p = (t / 3.4 + i * 0.21) % 1;
      const x = Math.round([84, 102, 89, 106, 80][i] + Math.sin(p * 7 + i) * 1.5); const y = Math.round(84 - p * 80);
      if (Math.hypot(x - HEAD.x, (y - HEAD.y) * 1.1) < HEAD.rx + 3 || (y > 40 && x > 76 && x < 110)) continue;
      bubble(x, y, i % 2 ? 1 : 2, 0.7);
    }

    // the gold glints
    for (let i = 0; i < (awake ? 4 : 2); i += 1) {
      const p = (t * 0.8 + i * 0.41) % 1;
      if (p > 0.3) continue;
      const [sx, sy] = COINS[(i + Math.floor(t * 0.8 + i * 0.41)) % COINS.length];
      rect(sx - 1, sy, 3, 1, 'rgba(255,250,220,0.9)'); rect(sx, sy - 1, 1, 3, 'rgba(255,250,220,0.9)'); dot(sx, sy, '#ffffff');
    }
  };
}
