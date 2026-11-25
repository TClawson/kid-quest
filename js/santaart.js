// Santa's flyover (December): the first time each day a kid comes out into the village, Santa's
// sleigh and his reindeer fly across it, trailing gently falling snow, and drop a present by the
// kid's door on a little candy-striped parachute. Tapping it opens it: 5 gems, 10 coins or 2 extra
// visitor game plays, with a letter from Santa about a Christmas tradition somewhere in the world.
// Style B like the village (hue-shifted ramps, selective outlines, dithering), one art pixel per
// village pixel, drawn frame by frame (no smoothing).
//
//   teamArt(frame, o)       the sleigh, Santa and four reindeer (Rudolph leading), 4 gallop frames
//   presentArt(state, o)    the present: 'chute' (two sway frames), 'squash', 'bounce', 'rest'
//   openedArt(prize, frame) the present opened, its prize popping out ('gems', 'coins', 'plays')
//   letterArt()             Santa's letter: a parchment card with a wax seal and a holly sprig
//   flyover(L, t, o)        where everything is t seconds into the flight (for drawing or a preview)
//   mountSanta(section, world, L, o)  runs it in a live village, once a day per kid

import { mix, h2, bayer, inEll } from './pixelkit.js';
import { spriteOf, lighter, darker, INK } from './xmaskit.js';

// ---------- the team ----------

const FUR = ['#3a2228', '#5a3428', '#7c4a32', '#9e6640', '#c08a58', '#e4b884'];
const RED = ['#5a1428', '#8a1e30', '#b82a38', '#e0404a', '#ff7a6a', '#ffb0a0'];
const GOLD = ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a', '#fff6c8'];
const SKIN = ['#b86a5a', '#e8a088', '#ffc8a8'];
const WHITE = ['#9a9ac0', '#c8cce4', '#eef0fa', '#ffffff'];

/** One reindeer, facing right, its body's middle at (X, Y). leg: gallop frame 0..3; nose: Rudolph's. */
function reindeer(b, X, Y, leg, o = {}) {
  const F = o.fur || FUR;
  // legs first (behind the body): a thigh (2 wide) and a longer shin each, angled by the gallop frame
  // (angles from straight down, forward positive): 0 the flying leap, 1 front tucked, 2 landing, 3 the push
  const POSE = [
    { front: [1.25, 0.35], hind: [-1.25, -0.35] },
    { front: [1.0, -2.3], hind: [-0.5, 0.25] },
    { front: [0.15, 0.05], hind: [0.65, -1.7] },
    { front: [-0.45, -0.2], hind: [0.8, 0.35] },
  ][leg % 4];
  const hips = [[X + 4, Y + 2, 'front', 0.3], [X + 5, Y + 2, 'front', 0], [X - 4, Y + 2, 'hind', -0.3], [X - 3, Y + 2, 'hind', 0]];
  hips.forEach(([hx, hy, end, far], i) => {
    const [a1, a2] = POSE[end].map((a, k) => a + (k === 0 ? far : 0));
    const kx = hx + Math.round(Math.sin(a1) * 3); const ky = hy + Math.round(Math.cos(a1) * 3);
    const fx = kx + Math.round(Math.sin(a1 + a2) * 4); const fy = ky + Math.round(Math.cos(a1 + a2) * 4);
    const c = i % 2 ? F[2] : F[1]; // the far legs darker
    const seg = (x0, y0, x1, y1, wide) => { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let k = 0; k <= n; k += 1) { const x = Math.round(x0 + ((x1 - x0) * k) / n); const y = Math.round(y0 + ((y1 - y0) * k) / n); b.set(x, y, c, 'fur'); if (wide) b.set(x - 1, y, c, 'fur'); } };
    seg(hx, hy, kx, ky, true); seg(kx, ky, fx, fy, false);
    b.set(fx, fy, '#3a2a2a', 'hoof');
  });
  // the body, the belly, a white tail flicked up
  for (let y = Y - 4; y <= Y + 3; y += 1) for (let x = X - 7; x <= X + 7; x += 1) {
    if (!inEll(x, y, X + 0.5, Y, 7.2, 3.6)) continue;
    let k = 3 - (y - Y) * 0.45 - (x - X) * 0.05 + (bayer(x, y) - 0.5) * 0.5;
    if (y >= Y + 2 && Math.abs(x - X) < 5) k = 4.4;
    b.set(x, y, F[Math.max(1, Math.min(5, Math.round(k)))], 'fur');
  }
  b.set(X - 7, Y - 3, WHITE[3], 'tail'); b.set(X - 8, Y - 4, WHITE[2], 'tail'); b.set(X - 7, Y - 4, WHITE[3], 'tail');
  // neck up to the head
  for (let k = 0; k < 5; k += 1) for (let w = 0; w < 3; w += 1) b.set(X + 5 + Math.round(k * 0.6) + w, Y - 2 - k, F[w === 0 ? 4 : 3], 'fur');
  const hx = X + 9; const hy = Y - 7;
  for (let y = hy - 2; y <= hy + 2; y += 1) for (let x = hx - 2; x <= hx + 4; x += 1) {
    if (!inEll(x, y, hx + 0.8, hy + 0.2, 3.2, 2.2) && !(y >= hy && x >= hx + 2 && x <= hx + 4)) continue;
    b.set(x, y, y < hy ? F[4] : F[3], 'fur');
  }
  b.set(hx + 1, hy - 1, '#2a1a2a', 'eye'); b.set(hx + 4, hy + 1, F[2], 'fur');
  // the nose: Rudolph's glows red
  if (o.rudolph) { b.set(hx + 5, hy + 1, '#ff3a3a', 'lit'); b.set(hx + 5, hy, '#ffb0a0', 'lit'); b.set(hx + 6, hy + 1, '#e02030', 'lit'); }
  else b.set(hx + 5, hy + 1, '#2a1a2a', 'nose');
  // an ear and the antlers
  b.set(hx - 2, hy - 2, F[3], 'fur'); b.set(hx - 3, hy - 3, F[4], 'fur');
  // the antlers: thin branching lines (review 1), a beam sweeping back and up with two tines reaching
  // forward; the near one pale with a dark back edge, the far one in the dark tone behind it
  const AN = ['#6a4630', '#a07848', '#ecd4a4'];
  const BEAM = [[0, -3], [0, -4], [-1, -5], [-1, -6], [-1, -7], [-2, -8], [-3, -9]];
  const TINES = [[1, -5], [2, -6], [0, -8], [1, -9], [-4, -9]];
  const antler = (ox, c, edge) => {
    BEAM.forEach(([dx, dy]) => { b.set(hx + ox + dx, hy + dy, c, 'antler'); if (edge) b.set(hx + ox + dx - 1, hy + dy, edge, 'antler'); });
    TINES.forEach(([dx, dy]) => b.set(hx + ox + dx, hy + dy, c, 'antler'));
  };
  antler(3, AN[1], null);
  antler(0, AN[2], AN[0]);
  // the harness: a red collar with gold bells, a red strap round the middle
  for (let y = Y - 4; y <= Y + 3; y += 1) if (b.get(X + 4, y)) b.set(X + 4, y, y === Y - 4 ? RED[4] : RED[3], 'strap');
  for (let k = 0; k < 4; k += 1) b.set(X + 6 + Math.round(k * 0.5), Y - 2 - k, RED[k % 2 ? 2 : 3], 'strap');
  b.set(X + 7, Y - 1, o.bell ? GOLD[5] : GOLD[4], 'bell'); b.set(X + 8, Y, GOLD[3], 'bell');
}

/** The sleigh with Santa and his sack, facing right, its runner's back end at (X, Y). */
function sleigh(b, X, Y, f, o) {
  // the sack of presents behind Santa
  for (let y = Y - 25; y <= Y - 9; y += 1) for (let x = X + 1; x <= X + 11; x += 1) {
    if (!inEll(x, y, X + 6.5, Y - 16, 6, 8)) continue;
    const k = 2 - (x - X - 6) * 0.18 - (y - Y + 16) * 0.08 + (h2(x, y, 4) - 0.5) * 0.8;
    b.set(x, y, ['#5a3a2a', '#7a5434', '#9a7044', '#ba8e58', '#d8b076'][Math.max(0, Math.min(4, Math.round(k)))], 'sack');
  }
  [[X + 3, Y - 26, '#3ac0e0', '#ffffff'], [X + 7, Y - 28, '#ff6aa8', '#ffd84a'], [X + 10, Y - 25, '#58d070', '#e8404a']].forEach(([x, y, c, r]) => { for (let yy = 0; yy < 4; yy += 1) for (let xx = 0; xx < 4; xx += 1) b.set(x + xx, y + yy, xx === 1 || yy === 1 ? r : xx < 2 ? lighter(c, 0.2) : c, 'gift'); });
  // Santa: hat, beard, red coat, a mitten waving
  const sx = X + 14; const sy = Y - 22;
  const wave = [0, 1, 2, 1][f % 4];
  const S = [
    '......wW..',
    '....rrRw..',
    '...rrRRr..',
    '..rrRRRRr.',
    '..wwwwwww.',
    '..wsSSsww.',
    '..wSeSesw.',
    '.wWwSnSww.',
    '.wWWWWWWw.',
    '.rwWWWWWr.',
    'rrRwWWwRrr',
    'rRRRwwRRRr',
    'rRRRRRRRRr',
    'kkkkGkkkkk',
  ];
  const pal = { r: RED[2], R: RED[3], w: WHITE[2], W: WHITE[3], s: SKIN[1], S: SKIN[2], e: '#3a2a3a', n: '#ff8a8a', k: '#3a2838', G: GOLD[4] };
  S.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) b.set(sx + x, sy + y, c, row[x] === 'w' || row[x] === 'W' ? 'beard' : row[x] === 's' || row[x] === 'S' ? 'face' : 'coat'); } });
  // the hat's tip and pompom flop back in the wind
  b.set(sx + 3, sy + 1, RED[2], 'coat'); b.set(sx + 2, sy + 2, RED[3], 'coat'); b.set(sx + 1, sy + 3, WHITE[3], 'beard'); b.set(sx + 1, sy + 2, WHITE[2], 'beard');
  // the waving arm (up, out, down) and the other holding the reins
  const arms = [[[10, 9], [11, 7], [12, 5], [12, 4]], [[10, 9], [11, 8], [12, 7], [13, 6]], [[10, 10], [11, 9], [12, 9], [13, 9]]][wave];
  arms.forEach(([dx, dy], i) => b.set(sx + dx, sy + dy, i === arms.length - 1 ? '#f4f0ff' : RED[3], i === arms.length - 1 ? 'mitt' : 'coat'));
  b.set(sx + arms[3][0], sy + arms[3][1] - 1, '#f4f0ff', 'mitt');
  // the sleigh's body: a high back, a dip for Santa, a curl at the front
  for (let x = 0; x <= 34; x += 1) {
    const t = x / 34;
    const topY = Math.round(Y - 13 + (t < 0.15 ? -(0.15 - t) * 40 : 0) + Math.sin(t * Math.PI) * 3 - (t > 0.82 ? (t - 0.82) * 50 : 0));
    const botY = Y - 3 - (t > 0.85 ? Math.round((t - 0.85) * 30) : 0);
    for (let y = topY; y <= botY; y += 1) {
      let k = 3 - (y - topY) / Math.max(1, botY - topY) * 1.8 + (bayer(X + x, y) - 0.5) * 0.4;
      if (y === topY) k = 5;
      if (y === topY + 1) { b.set(X + x, y, GOLD[x % 3 ? 3 : 4], 'trim'); continue; }
      b.set(X + x, y, RED[Math.max(1, Math.min(5, Math.round(k)))], 'sleigh');
    }
  }
  // a gold swirl painted on its side
  [[12, -8], [13, -9], [14, -9], [15, -8], [15, -7], [14, -6], [13, -7], [18, -7], [19, -8], [20, -8], [21, -7]].forEach(([dx, dy]) => b.set(X + dx, Y + dy, GOLD[4], 'trim'));
  // the runners: gold, curling up at the front, on two struts
  for (let x = -2; x <= 36; x += 1) b.set(X + x, Y, x > 30 ? GOLD[4] : GOLD[3], 'runner');
  [[37, -1], [38, -2], [38, -3], [37, -4], [36, -4], [35, -3]].forEach(([dx, dy]) => b.set(X + dx, Y + dy, GOLD[4], 'runner'));
  b.set(X - 3, Y - 1, GOLD[3], 'runner');
  for (const sx2 of [6, 24]) { b.set(X + sx2, Y - 1, GOLD[2], 'runner'); b.set(X + sx2, Y - 2, GOLD[2], 'runner'); }
  // a lantern hung on the front, lit
  b.set(X + 33, Y - 17, '#5a4a5a', 'lamp'); b.set(X + 33, Y - 16, f % 2 ? '#fff4c8' : '#ffd878', 'lit'); b.set(X + 33, Y - 15, '#f0a848', 'lit');
}

export const TEAM = { w: 140, h: 40 };
/**
 * The whole team, flying right (TEAM.w x TEAM.h, more with its padding), frame 0..3: the reindeer
 * gallop through the air in turns, Santa waves, the bells swing. Its anchor (ax, ay) is the sleigh's
 * runner. o: { night: mapId }.
 */
export function teamArt(frame = 0, o = {}) {
  const f = frame % 4;
  return spriteOf(TEAM.w, TEAM.h, (b) => {
    const X = 2; const Y = 36;
    const deer = [[50, 25], [73, 22], [96, 19], [119, 16]].map(([x, y], i) => [X + x, y + (((f + i) % 2) ? 1 : 0)]);
    const line = (x0, y0, x1, y1, sag, c) => { for (let x = x0; x <= x1; x += 1) { const t = (x - x0) / Math.max(1, x1 - x0); b.set(x, Math.round(y0 + (y1 - y0) * t + Math.sin(t * Math.PI) * sag), c, 'rein'); } };
    // the gold traces: from the sleigh's curl to the first girth, and on from each chest to the next girth
    line(X + 36, Y - 13, deer[0][0] + 3, deer[0][1], 1.5, GOLD[3]);
    for (let i = 0; i < 3; i += 1) line(deer[i][0] + 8, deer[i][1] - 1, deer[i + 1][0] + 3, deer[i + 1][1], 1, GOLD[3]);
    // the reins: one red line from Santa's mitten to the first reindeer's head, sagging with the gallop
    line(X + 24, Y - 12, deer[0][0] + 8, deer[0][1] - 5, 2 + (f % 2), RED[3]);
    // four reindeer, rising toward the front, each a step on in the gallop; Rudolph leads
    deer.forEach(([x, y], i) => reindeer(b, x, y, f + i, { rudolph: i === 3, bell: (f + i) % 2 === 0 }));
    sleigh(b, X, Y, f, o);
  }, { night: o.night || null, nightMix: 0.5, ax: 20, ay: 36, pad: 3, noLine: ['rein', 'tail', 'antler'] });
}

// ---------- the present ----------

const WRAP = { paper: ['#2a6ab0', '#3a8ae0', '#6ab0ff', '#a8d4ff'], ribbon: ['#c8302a', '#e8404a', '#ff8a7a'] };
/** The present, 13 x 13 (with a parachute above it while it falls), its foot at (ax, ay). state: chute0, chute1, squash, bounce, rest. */
export function presentArt(state = 'rest', o = {}) {
  const P = o.paper || WRAP.paper; const Rb = o.ribbon || WRAP.ribbon;
  const squash = state === 'squash';
  return spriteOf(30, 40, (b) => {
    const w = squash ? 15 : 13; const h = squash ? 10 : 12;
    const x0 = 15 - Math.floor(w / 2); const y0 = 39 - h;
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
      const mid = Math.abs(x - Math.floor(w / 2)) <= 1; const band = y === 3 || y === 4;
      const top = y < 3;
      let c = top ? P[x < w / 2 ? 3 : 2] : P[x < 3 ? 2 : x > w - 3 ? 0 : 1];
      if (!top && (x + y) % 5 === 0) c = P[3]; // a pattern of little stars on the paper
      if (mid || band) c = Rb[mid && band ? 2 : top ? 2 : 1];
      b.set(x0 + x, y0 + y, c, 'gift');
    }
    // the bow
    const by = y0 - 3; const bx = 15;
    ['rr.rr', 'rRrRr', '.rrr.'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(bx - 2 + x, by + y, row[x] === 'R' ? Rb[2] : Rb[1], 'bow'); });
    if (state.startsWith('chute')) {
      // a candy-striped parachute, swaying, its strings to the bow
      const sway = state === 'chute1' ? 1 : -1;
      for (let y = 0; y < 9; y += 1) for (let x = 0; x < 25; x += 1) {
        if (!inEll(x, y, 12.5 + sway, 9, 12.5, 9) || y > 7) continue;
        const stripe = Math.floor(((x - sway) + 1) / 5) % 2;
        b.set(x + 2, y, y === 7 ? (stripe ? '#c8c0d8' : '#c02a40') : stripe ? (x < 12 ? '#ffffff' : '#ece6f4') : (x < 12 ? '#ff5a6a' : '#e8404a'), 'chute');
      }
      for (const sx of [3, 9, 20, 26]) for (let y = 8; y < by; y += 1) { const x = Math.round(sx + (bx - sx) * ((y - 8) / (by - 8))) + (y < 14 ? sway : 0); if ((y + sx) % 2 === 0 || y > by - 3) b.set(x, y, '#d8d0e8', 'string'); }
    }
    if (state === 'rest') {
      // the parachute folded beside it, and a sparkle saying "tap me"
      ['.rwr.', 'rwrwr', 'wrwrw'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(23 + x, 36 + y, row[x] === 'r' ? '#e8404a' : '#ffffff', 'chute'); });
      ['..w..', '.wWw.', '..w..'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(22 + x, 22 + y, row[x] === 'W' ? '#ffffff' : '#fff6c8', 'lit'); });
    }
  }, { night: o.night || null, nightMix: 0.55, ax: 15, ay: state === 'bounce' ? 35 : 39, pad: 2, ground: state === 'rest' || state === 'squash' ? 1 : 0, noLine: ['string'] });
}

/** The present opened (44 x 44): the lid flying off, the prize up out of it with rays. prize: gems, coins, plays. */
export function openedArt(prize = 'gems', frame = 0, o = {}) {
  const P = o.paper || WRAP.paper; const Rb = o.ribbon || WRAP.ribbon;
  return spriteOf(60, 58, (b) => {
    const cx = 27; const cy = 27;
    // a warm burst of light behind the prize, dithered out at its edge, and rays turning
    for (let y = 0; y < 50; y += 1) for (let x = 0; x < 60; x += 1) {
      const r = Math.hypot(x - cx, (y - cy) * 1.15);
      const d = bayer(x, y);
      if (r < 11 || (r < 15 && d < 0.75) || (r < 19 && d < 0.35) || (r < 23 && d < 0.1)) b.set(x, y, r < 11 ? '#fff6d8' : r < 15 ? '#ffeeb0' : '#ffe08a', 'lit');
    }
    for (let k = 0; k < 10; k += 1) {
      if ((k + frame) % 2) continue;
      const a = (k / 10) * Math.PI * 2 + 0.3;
      for (let r = 16; r < 29; r += 1) { const x = Math.round(cx + Math.cos(a) * r); const y = Math.round(cy + Math.sin(a) * r * 0.87); if (r < 25 || (r + k) % 2) b.set(x, y, r < 21 ? '#fff0b0' : '#ffd860', 'lit'); }
    }
    // the box, open at the top: its back rim, the dark inside, a front face with the ribbon
    const X0 = 14; const X1 = 41;
    for (let y = 37; y <= 54; y += 1) for (let x = X0; x <= X1; x += 1) {
      let c;
      if (y === 37) c = P[1];
      else if (y <= 39) c = x === X0 || x === X1 ? P[1] : '#2a1838';
      else if (y === 40) c = P[3];
      else c = x <= X0 + 2 ? P[2] : x >= X1 - 3 ? P[0] : P[1];
      if (y >= 40 && x >= 26 && x <= 29) c = x === 26 ? Rb[2] : x === 29 ? Rb[0] : Rb[1];
      if (y > 40 && (x + y * 3) % 11 === 0 && c === P[1]) c = P[2];
      b.set(x, y, c, y > 37 && y <= 39 && x > X0 && x < X1 ? 'inside' : 'gift');
    }
    // the lid, popped off and flying up to the right, its bow on top
    for (let x = 0; x < 30; x += 1) {
      const lx = 15 + x; const ly = 8 + (x >= 15 ? 1 : 0);
      for (let y = 0; y < 6; y += 1) {
        let c = y === 0 ? P[3] : y === 1 ? P[2] : y === 2 ? P[3] : x < 2 ? P[2] : x > 27 ? P[0] : P[1];
        if (x >= 13 && x <= 16) c = y < 2 ? Rb[2] : x === 16 ? Rb[0] : Rb[1];
        b.set(lx, ly + y, c, 'lid');
      }
    }
    put(b, ['.rr...rr.', 'rRRr.rRRr', 'rRdrrrdRr', '.rrrdrrr.'], { r: Rb[1], R: Rb[2], d: Rb[0] }, 26, 4);
    put(b, ['.w', 'w.', '..', 'w.'], { w: '#ffffff' }, 11, 7, 'lit'); put(b, ['w.', '.w', '..', '.w'], { w: '#ffffff' }, 46, 8, 'lit');
    // the prize, popping out
    if (prize === 'gems') {
      const gem = ['..CCCC..', '.CWWCCc.', 'CWCCCccc', '.cCCccd.', '..cCcd..', '...cd...'];
      [[13, 25, '#58d070'], [31, 26, '#40c8d8'], [22, 17, '#8a6aff'], [19, 28, '#ff5aa8'], [26, 30, '#ffb03a']].forEach(([x, y, c]) => put(b, gem, { c, C: lighter(c, 0.45), W: '#ffffff', d: darker(c, 0.35) }, x, y));
    } else if (prize === 'coins') {
      const coin = ['.dddd.', 'dyYYyd', 'dYWyyd', 'dYyyod', 'dyyood', '.dddd.'];
      [[16, 30], [23, 31], [30, 30], [19, 25], [27, 24], [23, 19], [33, 22], [12, 23], [29, 15], [17, 16]].forEach(([x, y], i) => put(b, i % 3 === 2 ? ['.dd.', 'dYyd', 'dyod', 'dyod', 'dyod', '.dd.'] : coin, { y: GOLD[3], Y: GOLD[4], W: GOLD[5], o: GOLD[2], d: GOLD[1] }, x, y));
    } else {
      // two game tickets, each with a star
      [[11, 20, '#ff7ab0'], [25, 24, '#7ad0ff']].forEach(([x, y, c]) => {
        for (let yy = 0; yy < 12; yy += 1) for (let xx = 0; xx < 17; xx += 1) {
          const notch = (xx === 0 || xx === 16) && (yy >= 5 && yy <= 6);
          if (notch) continue;
          b.set(x + xx, y + yy, xx === 5 && yy % 2 ? lighter(c, 0.55) : yy === 0 || xx === 0 ? lighter(c, 0.35) : yy === 11 || xx === 16 ? darker(c, 0.25) : c, 'ticket');
        }
        put(b, ['..y..', '.yYy.', 'yYWYy', '.yYy.', 'y...y'], { y: GOLD[2], Y: GOLD[4], W: '#ffffff' }, x + 8, y + 3);
        put(b, ['x', 'x', 'x'].map((r, i) => (i === 1 ? 'xx' : 'x.')), { x: darker(c, 0.3) }, x + 2, y + 4);
      });
    }
    // sparkles round it
    [[5, 9], [48, 30], [50, 44], [3, 33], [22, 3], [8, 46]].forEach(([x, y], i) => { if ((i + frame) % 3 === 0) return; put(b, (i + frame) % 3 === 1 ? ['.w.', 'wWw', '.w.'] : ['..w..', '..w..', 'wwWww', '..w..', '..w..'], { w: '#fff6c8', W: '#ffffff' }, x, y, 'lit'); });
  }, { night: null, ax: 27, ay: 54, pad: 2, ground: 1, noLine: ['inside'] });
}
const put = (b, rows, pal, X, Y, tag = 'prize') => rows.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) b.set(X + x, Y + y, c, tag); } });

/** Santa's letter: a parchment card, 152 x 104, rolled at top and bottom, a wax seal and a sprig of holly. */
export function letterArt() {
  const W = 152; const H = 104;
  const PA = ['#b48a5a', '#d4ae7a', '#e8cc98', '#f4e2b8', '#fcf2d8'];
  return spriteOf(W, H, (b) => {
    for (let y = 6; y < H - 6; y += 1) for (let x = 3; x < W - 3; x += 1) {
      // a little uneven at the sides, darker toward the edges, a few old spots
      const e = Math.min(x - 3, W - 4 - x, y - 6, H - 7 - y);
      if (x < 5 + Math.round(h2(1, y >> 2, 3) * 2) || x > W - 6 - Math.round(h2(2, y >> 2, 3) * 2)) continue;
      let k = e < 3 ? 2 : e < 7 ? 3 : 4;
      if (e < 7 && bayer(x, y) < 0.4) k -= 1;
      if (e >= 7 && h2(x >> 3, y >> 3, 9) < 0.07 && bayer(x, y) < 0.5) k -= 1; // an old stain or two, dithered in
      b.set(x, y, PA[Math.max(0, k)], 'paper');
    }
    // the rolls at top and bottom
    for (const [y0, flip] of [[0, false], [H - 9, true]]) {
      for (let y = 0; y < 9; y += 1) for (let x = 1; x < W - 1; x += 1) {
        const r = Math.abs(y - 4);
        if (r > 4) continue;
        const k = flip ? 4 - r : (y < 4 ? 4 - Math.floor(r / 1.5) : 2 - Math.floor(r / 2));
        b.set(x, y0 + y, PA[Math.max(0, Math.min(4, Math.round(k)))], 'roll');
      }
      for (const ex of [0, W - 2]) for (let y = 1; y < 8; y += 1) b.set(ex + (ex ? 0 : 1), y0 + y, PA[1], 'roll');
    }
    // a sprig of holly tucked over the top roll, at its left end
    const leaf = (X, Y, flip, up) => ['.gg.....', 'gGGgg...', '.gGGGgg.', '..ggGGGg', '.....ggg'].forEach((row, y) => { for (let x = 0; x < 8; x += 1) { const c = { g: '#2a6a44', G: '#5aa85a' }[row[x]]; if (c) b.set(flip ? X - x : X + x, up ? Y - y : Y + y, c, 'holly'); } });
    leaf(6, 3, false, false); leaf(25, 3, true, false); leaf(12, 10, false, true);
    for (const [x, y] of [[15, 4], [18, 3], [16, 7]]) put(b, ['rR', 'dr'], { r: '#e8404a', R: '#ffb0a0', d: '#a82a3a' }, x, y, 'berry');
    // the wax seal in its own block at the bottom right (the text wraps round it: .v-seal-room), on two
    // ribbon tails that stop clear of the roll, a star pressed in it
    const cx = W - 19; const cy = H - 29;
    for (const sgn of [-1, 1]) for (let k = 0; k < 12; k += 1) for (let w = 0; w < 3; w += 1) {
      const x = cx + sgn * (2 + Math.round(k * 0.45) + w); const y = cy + 4 + k;
      const notch = k === 11 && w === 1;
      if (!notch) b.set(x, y, w === 0 ? RED[4] : w === 1 ? RED[3] : RED[2], 'ribbon');
    }
    for (let y = -10; y <= 10; y += 1) for (let x = -10; x <= 10; x += 1) {
      const a = Math.atan2(y, x); const r = Math.hypot(x, y);
      const wob = 8.6 + Math.sin(a * 7 + 0.5) * 0.7 + Math.sin(a * 3) * 0.4;
      if (r > wob) continue;
      let k = r > wob - 1.2 ? (x + y < 0 ? 3 : 1) : r > 6.4 ? (x + y < -1 ? 4 : 2) : r > 5.4 ? (x + y < 0 ? 1 : 3) : (x + y < -3 ? 3 : 2);
      b.set(cx + x, cy + y, RED[k], 'seal');
    }
    ['...d...', '...d...', 'ddddddd', '.ddDdd.', '..dDd..', '.dd.dd.', '.d...d.'].forEach((row, y) => { for (let x = 0; x < 7; x += 1) if (row[x] !== '.') b.set(cx - 3 + x, cy - 3 + y, row[x] === 'D' ? RED[2] : RED[0], 'seal'); });
    b.set(cx - 5, cy - 6, RED[5], 'seal'); b.set(cx - 4, cy - 7, RED[5], 'seal');
  }, { night: null, ax: 0, ay: 0, pad: 2 });
}

// ---------- the flight ----------

export const FLIGHT_S = 8; // seconds across
/** Where the flight is at t seconds: { team: { x, y, frame }, shadow, snow: [[x, y, kind]], present: { x, y, state } | null }. */
export function flyover(L, t, o = {}) {
  const W = L.W;
  const u = Math.min(1, Math.max(0, t / FLIGHT_S));
  const x = -140 + u * (W + 170);
  const yTop = o.y ?? Math.max(36, (L.home.y || 40) + 6);
  const y = Math.round(yTop + 26 - u * 22 + Math.sin(t * 2.2) * 3);
  const frame = Math.floor(t * 8) % 4;
  // the snow trail: flakes shaken from the runners every so often, falling and drifting
  const snow = [];
  for (let k = 0; k < 120; k += 1) {
    const born = k * 0.07; if (born > t) break;
    const age = t - born; if (age > 2.6) continue;
    const bu = Math.min(1, born / FLIGHT_S); const bx = -140 + bu * (W + 170) + 6 + h2(k, 1, 5) * 18; const by = Math.round(yTop + 26 - bu * 22 + Math.sin(born * 2.2) * 3);
    const fx = Math.round(bx + Math.sin(age * 2 + k) * 3 - age * 4); const fy = Math.round(by + age * 16 + h2(k, 2, 5) * 4);
    // the older a flake, the more often it's missing (it fades by dithering out)
    if (age > 1.6 && (k + Math.floor(t * 10)) % 2) continue;
    snow.push([fx, fy, h2(k, 3, 5) < 0.2 ? 'spark' : h2(k, 4, 5) < 0.5 ? 'gold' : 'flake']);
  }
  // the present: let go over the kid's house, it floats down to the doorstep on its parachute
  const door = o.door || { x: L.home.x + L.home.w / 2 + 26, y: L.home.y + L.home.h + 12 };
  const dropX = door.x; const tDrop = ((dropX + 140 - 60) / (W + 170)) * FLIGHT_S;
  let present = null;
  if (t >= tDrop) {
    const a = t - tDrop; const fall = 1.6;
    const sy = Math.round(yTop + 26 - (tDrop / FLIGHT_S) * 22 - 8);
    if (a < fall) present = { x: Math.round(dropX + Math.sin(a * 4) * 2), y: Math.round(sy + (door.y - sy) * (a / fall)), state: Math.floor(a * 4) % 2 ? 'chute1' : 'chute0' };
    else if (a < fall + 0.12) present = { x: dropX, y: door.y, state: 'squash' };
    else if (a < fall + 0.3) present = { x: dropX, y: door.y, state: 'bounce' };
    else present = { x: dropX, y: door.y, state: 'rest' };
  }
  return { team: { x: Math.round(x), y, frame }, shadow: { x: Math.round(x + 40), y: Math.min(L.H - 30, y + 74), w: 60 }, snow, present, tDrop };
}

const SEEN = 'kidquest.santaSeen';
/**
 * Santa in a live village, once a December day per kid (remembered on this device): his flight over
 * a canvas above everything, then the present by the door to tap. o: { night, mapId, today, kid,
 * onPresent(prize) }. With kidquest.santa = 'off' he stays home; 'test' draws only what a preview
 * asks for (section.kqSanta(t)).
 */
export function mountSanta(section, world, L, o = {}) {
  let mode = null;
  try { mode = localStorage.getItem('kidquest.santa'); } catch { /* none */ }
  if (mode === 'off') return null;
  let seen = {};
  try { seen = JSON.parse(localStorage.getItem(SEEN) || '{}') || {}; } catch { /* none */ }
  if (mode !== 'test' && seen[o.kid] === o.today) return null;
  const nm = o.night ? o.mapId : null;
  const team = [0, 1, 2, 3].map((f) => teamArt(f, { night: nm }));
  const states = Object.fromEntries(['chute0', 'chute1', 'squash', 'bounce', 'rest'].map((s) => [s, presentArt(s, { night: nm })]));
  const c = document.createElement('canvas');
  c.className = 'v-santa'; c.width = L.W; c.height = L.H;
  c.setAttribute('aria-hidden', 'true');
  c.style.cssText = `position:absolute;left:0;top:0;width:${L.W}px;height:${L.H}px;z-index:9600;pointer-events:none;image-rendering:pixelated`;
  world.append(c);
  const ctx = c.getContext('2d');
  // the name boards and signs in village pixels (a label's left is its middle)
  const signs = [...world.querySelectorAll('.v-label, .v-garden')].map((el) => {
    const w = el.offsetWidth || 40; const h = el.offsetHeight || 10; const x = parseFloat(el.style.left) || 0; const y = parseFloat(el.style.top) || 0;
    return { el, x: el.classList.contains('v-label') ? x - w / 2 : x, y, w, h };
  });
  const shadowC = o.night ? '#1a1838' : '#3a3060';
  const draw = (t) => {
    const s = flyover(L, t);
    ctx.clearRect(0, 0, L.W, L.H);
    // the shadow on the ground, dithered (no see-through)
    // (far below him, so faint: a sparse dither, thickest in the middle)
    for (let y = -2; y <= 2; y += 1) for (let x = -s.shadow.w / 2; x <= s.shadow.w / 2; x += 1) {
      if (!inEll(x, y, 0, 0, s.shadow.w / 2, 2.6)) continue;
      const X = s.shadow.x + x; const Y = s.shadow.y + y;
      const core = Math.abs(x) < s.shadow.w / 4 && Math.abs(y) < 2;
      if (core ? (X + 2 * Y) % 4 === 0 : (X + 2 * Y) % 8 === 0) { ctx.fillStyle = shadowC; ctx.fillRect(X, Y, 1, 1); }
    }
    for (const [x, y, k] of s.snow) {
      ctx.fillStyle = k === 'gold' ? '#fff0b0' : '#ffffff'; ctx.fillRect(x, y, 1, 1);
      if (k === 'spark') { ctx.fillStyle = '#d8e8ff'; ctx.fillRect(x - 1, y, 1, 1); ctx.fillRect(x + 1, y, 1, 1); ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1); }
    }
    const a = team[s.team.frame];
    if (t < FLIGHT_S) ctx.drawImage(a, s.team.x - a.ax, s.team.y - a.ay);
    // the signs under the team step aside while it passes (so the sleigh is always on top, never
    // tangled with a name board), and come back once it has gone by
    const tx = s.team.x - a.ax; const ty = s.team.y - a.ay;
    for (const g of signs) {
      const over = t < FLIGHT_S && g.x < tx + a.width && g.x + g.w > tx && g.y < ty + a.height && g.y + g.h > ty;
      if (g.el.classList.contains('v-santa-off') !== over) g.el.classList.toggle('v-santa-off', over);
    }
    if (s.present && s.present.state !== 'rest') { const p = states[s.present.state]; ctx.drawImage(p, s.present.x - p.ax, s.present.y - p.ay); }
    return s;
  };
  let gift = null;
  const land = (s) => {
    if (gift) return;
    const p = states.rest;
    gift = document.createElement('button');
    gift.className = 'v-deco v-present';
    gift.setAttribute('aria-label', 'A present from Santa');
    gift.style.cssText = `left:${s.present.x - p.ax}px;top:${s.present.y - p.ay}px;width:${p.width}px;height:${p.height}px;z-index:${s.present.y}`;
    const gc = document.createElement('canvas'); gc.className = 'v-deco-art'; gc.width = p.width; gc.height = p.height; gc.getContext('2d').drawImage(p, 0, 0);
    gift.append(gc);
    gift.addEventListener('click', (e) => { e.stopPropagation(); openPresent(section, o); gift.remove(); });
    world.insertBefore(gift, world.querySelector('.v-buddy'));
  };
  section.kqSanta = (t) => { const s = draw(t); if (s.present?.state === 'rest') land(s); else if (gift) { gift.remove(); gift = null; } return s; };
  if (mode === 'test') return c;
  try { localStorage.setItem(SEEN, JSON.stringify({ ...seen, [o.kid]: o.today })); } catch { /* fine */ }
  const t0 = performance.now();
  const tick = (now) => {
    if (!c.isConnected) return;
    const t = (now - t0) / 1000 - 1.2;
    if (t >= 0) { const s = draw(t); if (s.present?.state === 'rest') land(s); if (t > FLIGHT_S + 2.5) { ctx.clearRect(0, 0, L.W, L.H); return; } }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
  return c;
}

const PRIZES = [['gems', '5 gems'], ['coins', '10 coins'], ['plays', '2 extra game plays']];
export const TRADITION = 'In Iceland, 13 Yule Lads visit on the 13 nights before Christmas. Children leave a shoe on the windowsill, and each Lad leaves a little gift in it (or a potato, if they were naughty!).';

/** The present opened over the village: the prize (equal odds) and Santa's letter (a sketch of the real pop-up). */
export function openPresent(section, o = {}) {
  const [kind, label] = o.prize ? PRIZES.find((p) => p[0] === o.prize) : PRIZES[Math.floor(Math.random() * 3)];
  const art = openedArt(kind, 0); const letter = letterArt();
  const pop = document.createElement('div');
  pop.className = 'v-advent-wall v-santa-pop';
  pop.innerHTML = `<div class="v-advent-card"><h2>A present from Santa!</h2><canvas class="gift" width="${art.width}" height="${art.height}"></canvas><p class="prize">${label}</p>
    <div class="v-letter"><canvas width="${letter.width}" height="${letter.height}"></canvas><div class="v-letter-text"><i class="v-seal-room" aria-hidden="true"></i><b>Ho ho ho!</b> ${TRADITION}<span class="v-sign">Love, Santa</span></div></div>
    <button type="button" class="px-btn">Thank you, Santa!</button></div>`;
  pop.querySelector('canvas.gift').getContext('2d').drawImage(art, 0, 0);
  pop.querySelector('.v-letter canvas').getContext('2d').drawImage(letter, 0, 0);
  pop.querySelector('button').addEventListener('click', () => pop.remove());
  section.querySelector('.village-view').append(pop);
  o.onPresent?.(kind);
  return kind;
}
