// Little games for the littlest: Little Bakery (the kitchen in the village) and Animal Puzzles
// (the puzzle box in the buddy's room). Pictures only, big buttons, nothing timed and nothing
// that can go wrong. Rules and the star jar are in littlerules.js.
//
// One full-screen overlay with a 16:10 stage. Its screens:
//   hub     the star jar, the buddy (tap it for a hop), a door to each game and the sticker book
//   bakery  an animal comes in its map's way and shows the cookie it wants; the kid picks a cutter
//           and a frosting, taps or drags on the cookie for sprinkles, taps candies on and rings
//           the bell; the cookie bakes and the animal eats it in three bites
//   puzzle  a picture of a map animal cut into 2, 4 or 6 pieces: drag a piece near its spot, or
//           tap a piece and then the spot it goes in (a wrong spot sends it back to the tray)
//   book    the map's six stickers (shadows until met), hearts for repeat visits, gold ones
// A visit (one star) is VISIT_ROUNDS rounds. In a game the house button has to be held to leave,
// so a palm on the corner doesn't end it. A little hand points at what to tap after a while.

import { critterById } from './critters.js';
import { critterPic } from './critterart.js';
import { littleMap, voiceOf, nextAnimal, puzzleSize, VISIT_ROUNDS, GOLD_CHANCE, JAR_MAX } from './littlerules.js';

const INK = '#2a1838';
const N = 48; // the cookie's pixels
const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#74c0fc', '#b197fc'];
const BASE_FROST = ['#ff9ec4', '#74c0fc', '#ffe066'];
const SHAPES = ['circle', 'heart', 'star'];

// each map's sky and ground for the hub, the puzzle pictures and the bakery window
const SCENES = {
  'bg-meadow': { sky: ['#8fd0ef', '#b8e2f4'], ground: '#6cbf4a', ground2: '#4f9a35', style: 'trees' },
  'bg-fjord': { sky: ['#9cc3e6', '#d4e7f6'], ground: '#eef4f8', ground2: '#9db6cc', style: 'peaks' },
  'bg-rainforest': { sky: ['#7cc47f', '#b5e3a6'], ground: '#2f7d3b', ground2: '#1f5c2a', style: 'jungle' },
  'bg-ocean': { sky: ['#2f8fd0', '#6cc3ec'], ground: '#f0d9a0', ground2: '#d9b973', style: 'reef' },
  'bg-rainbow': { sky: ['#f6c8f0', '#fde7f8'], ground: '#a8e6a0', ground2: '#7fcf76', style: 'rainbow' },
  'bg-castle': { sky: ['#9fc4e8', '#c8def2'], ground: '#7cb860', ground2: '#5c9444', style: 'towers' },
  'bg-volcano': { sky: ['#f4a582', '#fcd3b4'], ground: '#5c4a44', ground2: '#3d302c', style: 'volcano' },
  'bg-sunset': { sky: ['#ff9f6b', '#ffc796'], ground: '#f3d9a4', ground2: '#dcbc80', style: 'sea' },
  'bg-galaxy': { sky: ['#3b2a6e', '#4d3a8a'], ground: '#6a5acd', ground2: '#5546b0', style: 'stars' },
  'bg-space': { sky: ['#141a33', '#1f2748'], ground: '#9aa3b5', ground2: '#7c8598', style: 'moon' },
};
const sceneOf = (theme) => SCENES[theme] || SCENES['bg-meadow'];

const rnd = (n) => Math.floor(Math.random() * n);
const pick = (a) => a[rnd(a.length)];

// ---------------- sound: little synth blips, and a call for each animal ----------------
let actx = null;
let soundOn = true;
function tone(f, t = 0.12, type = 'square', vol = 0.06, delay = 0, slide = 0) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const o = actx.createOscillator(); const g = actx.createGain(); const at = actx.currentTime + delay;
    o.type = type; o.frequency.setValueAtTime(f, at); if (slide) o.frequency.exponentialRampToValueAtTime(slide, at + t);
    g.gain.setValueAtTime(vol, at); g.gain.exponentialRampToValueAtTime(0.0001, at + t);
    o.connect(g).connect(actx.destination); o.start(at); o.stop(at + t + 0.02);
  } catch { /* no sound on this device */ }
}
function noise(t = 0.15, vol = 0.05, hp = 3000) {
  if (!soundOn) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    const b = actx.createBuffer(1, Math.ceil(actx.sampleRate * t), actx.sampleRate); const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = actx.createBufferSource(); const g = actx.createGain(); const f = actx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = hp; g.gain.value = vol;
    s.buffer = b; s.connect(f).connect(g).connect(actx.destination); s.start();
  } catch { /* no sound on this device */ }
}
const SFX = {
  pop: () => tone(520, 0.08, 'triangle', 0.07, 0, 880),
  squish: () => tone(220, 0.3, 'sine', 0.14, 0, 90),
  shake: () => noise(0.1, 0.05),
  plink: () => { tone(784, 0.08, 'triangle', 0.08); tone(1175, 0.1, 'triangle', 0.06, 0.06); },
  ding: () => { tone(1318, 0.6, 'sine', 0.1); tone(1975, 0.7, 'sine', 0.05, 0.02); },
  crunch: () => noise(0.12, 0.12, 900),
  chime: () => [784, 988, 1175, 1568].forEach((f, i) => tone(f, 0.2, 'triangle', 0.07, i * 0.09)),
  snap: () => tone(700, 0.06, 'square', 0.05, 0, 1200),
  star: () => [1046, 1318, 1568].forEach((f, i) => tone(f, 0.12, 'triangle', 0.06, i * 0.07)),
  soft: () => [660, 880].forEach((f, i) => tone(f, 0.2, 'sine', 0.07, i * 0.12)),
  whoosh: () => noise(0.35, 0.04, 600),
};
const VOICES = {
  squeak: () => [0, 0.14].forEach((d) => tone(1400, 0.08, 'sine', 0.08, d, 2000)),
  chitter: () => [0, 0.07, 0.14, 0.21].forEach((d) => tone(1100 + rnd(300), 0.05, 'square', 0.04, d)),
  tweet: () => [0, 0.16, 0.32].forEach((d, i) => tone(2000 + i * 200, 0.1, 'sine', 0.07, d, 2800)),
  grunt: () => { tone(110, 0.35, 'sawtooth', 0.07, 0, 80); tone(90, 0.3, 'sawtooth', 0.05, 0.3, 70); },
  whistle: () => tone(900, 0.4, 'sine', 0.08, 0, 1600),
  ribbit: () => [0, 0.18].forEach((d) => tone(180, 0.12, 'square', 0.07, d, 260)),
  blub: () => [0, 0.12, 0.24].forEach((d) => tone(300, 0.1, 'sine', 0.1, d, 700)),
  click: () => [0, 0.08, 0.16].forEach(() => noise(0.03, 0.12, 2000)),
  baa: () => { tone(420, 0.5, 'sawtooth', 0.05, 0, 380); tone(430, 0.5, 'triangle', 0.04, 0, 390); },
};
const call = (id) => (VOICES[voiceOf(id)] || VOICES.squeak)();

// ---------------- pixel helpers ----------------
function mk(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; c.className = 'lt-pix'; return c; }
function img(src) { const i = new Image(); i.src = src; i.className = 'lt-pix'; i.draggable = false; i.alt = ''; return i; }
function sprite(rows, pal) {
  const c = mk(rows[0].length, rows.length); const x = c.getContext('2d');
  rows.forEach((r, y) => [...r].forEach((ch, xx) => { if (pal[ch]) { x.fillStyle = pal[ch]; x.fillRect(xx, y, 1, 1); } }));
  return c.toDataURL();
}
let ART = null; // sprites, made on first open (they need a canvas)
function art() {
  if (ART) return ART;
  ART = {
    star: sprite(['....#....', '...#y#...', '###yyy###', '#yyyyyyy#', '.#yyyyy#.', '..#yyy#..', '.#yy#yy#.', '#yy#.#yy#', '###...###'], { '#': INK, y: '#ffd43b' }),
    heart: sprite(['.##..##.', '#pp##pw#', '#ppppppw', '#pppppp#', '.#pppp#.', '..#pp#..', '...##...'], { '#': INK, p: '#ff5c8a', w: '#ffc2d4' }),
    heartEmpty: sprite(['.##..##.', '#..##..#', '#......#', '#......#', '.#....#.', '..#..#..', '...##...'], { '#': '#cbb99a' }),
    sparkle: sprite(['...#...', '...y...', '..yyy..', '#yyWyy#', '..yyy..', '...y...', '...#...'], { '#': '#fff3a0', y: '#ffd43b', W: '#ffffff' }),
  };
  return ART;
}
const picCache = new Map();
/** An animal's picture as a data URL (frame 'pose' or 'stand'), with its size. */
function animalPic(id, frame = 'pose') {
  const key = `${id}|${frame}`;
  if (picCache.has(key)) return picCache.get(key);
  const c = critterById(id);
  const cv = critterPic(c.look, frame);
  const p = { url: cv.toDataURL(), w: cv.width, h: cv.height, name: c.name };
  picCache.set(key, p);
  return p;
}
const HAND = '<svg viewBox="0 0 12 14" shape-rendering="crispEdges"><path fill="#2a1838" d="M4 0h2v1h1v4h2v1h2v1h1v5h-1v2H4v-1H3v-1H2v-1H1V8H0V6h2v1h1V1h1z"/><path fill="#fff" d="M4 1h2v5h1V6h2v1h2v5h-1v1H5v-1H4v-1H3v-1H2V8H1V7h1v1h2z"/></svg>';
const HOUSE = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#2a1838" d="M8 1 1 8h2v7h4v-4h2v4h4V8h2z"/><path fill="#ffd43b" d="M8 3 4 7v7h2v-4h4v4h2V7z"/></svg>';
const BOOK = '<svg viewBox="0 0 16 16" shape-rendering="crispEdges"><path fill="#2a1838" d="M2 2h12v12H2z"/><path fill="#d9467a" d="M3 3h10v10H3z"/><path fill="#ffd43b" d="M8 5l1 2h2l-2 1 1 2-2-1-2 1 1-2-2-1h2z"/></svg>';

// ---------------- cookies ----------------
function shapePath(ctx, shape, s) {
  const c = N / 2;
  ctx.beginPath();
  if (shape === 'circle') ctx.arc(c, c, 21 * s, 0, Math.PI * 2);
  else if (shape === 'heart') { ctx.save(); ctx.translate(c, c + 2); ctx.scale(s, s); ctx.moveTo(0, 18); ctx.bezierCurveTo(-30, -2, -18, -26, 0, -10); ctx.bezierCurveTo(18, -26, 30, -2, 0, 18); ctx.restore(); }
  else if (shape === 'star') { for (let i = 0; i < 10; i += 1) { const r = (i % 2 ? 10 : 23) * s; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(c + r * Math.cos(a), c + 2 + r * Math.sin(a)); } }
  else if (shape === 'flower') { for (let i = 0; i < 5; i += 1) { const a = -Math.PI / 2 + i * 2 * Math.PI / 5; ctx.moveTo(c + 13 * s * Math.cos(a) + 10 * s, c + 13 * s * Math.sin(a)); ctx.arc(c + 13 * s * Math.cos(a), c + 13 * s * Math.sin(a), 10 * s, 0, Math.PI * 2); } ctx.moveTo(c + 12 * s, c); ctx.arc(c, c, 12 * s, 0, Math.PI * 2); }
  else if (shape === 'fish') { ctx.ellipse(c - 3, c, 16 * s, 11 * s, 0, 0, Math.PI * 2); ctx.moveTo(c + 9 * s, c); ctx.lineTo(c + 22 * s, c - 11 * s); ctx.lineTo(c + 22 * s, c + 11 * s); }
  else if (shape === 'leaf') { ctx.save(); ctx.translate(c, c); ctx.rotate(-0.6); ctx.scale(s, s); ctx.moveTo(0, -22); ctx.quadraticCurveTo(20, 0, 0, 22); ctx.quadraticCurveTo(-20, 0, 0, -22); ctx.restore(); }
  else if (shape === 'shell') { ctx.moveTo(c, c + 20 * s); ctx.arc(c, c + 2, 21 * s, Math.PI * 1.05, Math.PI * 1.95); ctx.closePath(); }
  else if (shape === 'cloud') { [[-10, 4, 10], [0, -4, 13], [11, 3, 10], [0, 8, 11]].forEach(([dx, dy, r]) => { ctx.moveTo(c + dx * s + r * s, c + dy * s); ctx.arc(c + dx * s, c + dy * s, r * s, 0, Math.PI * 2); }); }
  else if (shape === 'crown') { ctx.save(); ctx.translate(c, c); ctx.scale(s, s); ctx.moveTo(-20, 14); ctx.lineTo(-20, -12); ctx.lineTo(-10, 0); ctx.lineTo(0, -18); ctx.lineTo(10, 0); ctx.lineTo(20, -12); ctx.lineTo(20, 14); ctx.restore(); }
  else if (shape === 'drop') { ctx.save(); ctx.translate(c, c + 4); ctx.scale(s, s); ctx.moveTo(0, -24); ctx.quadraticCurveTo(18, -2, 16, 6); ctx.arc(0, 6, 16, 0, Math.PI); ctx.quadraticCurveTo(-18, -2, 0, -24); ctx.restore(); }
  else if (shape === 'sun') { for (let i = 0; i < 24; i += 1) { const r = (i % 2 ? 17 : 23) * s; const a = i * Math.PI / 12; ctx.lineTo(c + r * Math.cos(a), c + r * Math.sin(a)); } }
  else if (shape === 'moon') { ctx.arc(c, c, 21 * s, Math.PI * 0.35, Math.PI * 1.65); ctx.arc(c + 10 * s, c - 2 * s, 15 * s, Math.PI * 1.5, Math.PI * 0.5, true); }
  ctx.closePath();
}
const maskCache = new Map();
function mask(shape, s) {
  const k = shape + s;
  if (maskCache.has(k)) return maskCache.get(k);
  const c = mk(N, N); const x = c.getContext('2d'); x.fillStyle = '#000'; shapePath(x, shape, s); x.fill('nonzero');
  const d = x.getImageData(0, 0, N, N).data; const m = new Uint8Array(N * N);
  for (let i = 0; i < N * N; i += 1) m[i] = d[i * 4 + 3] > 120 ? 1 : 0;
  maskCache.set(k, m);
  return m;
}
function shade(hex, f) {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `rgb(${ch(n >> 16)},${ch((n >> 8) & 255)},${ch(n & 255)})`;
}
const CANDIES = {
  cherry: [' ...g ', '  .g. ', ' rrr  ', 'rWrrr ', 'rrrrr ', ' rrr  '],
  choc: [' kkk ', 'kKkkk', 'kkkkk', 'kkkkk', ' kkk '],
  gum: ['  G  ', ' GwG ', 'GwGGG', 'GGGGG', 'GGGGG'],
};
const CANDY_COLORS = { g: '#2f9e44', '.': '#2f9e44', r: '#e03131', W: '#ffc9c9', k: '#5c3b1e', K: '#8d6240', G: '#40c057', w: '#d3f9d8' };
function drawCandy(x, k, cx, cy) {
  CANDIES[k].forEach((row, y) => [...row].forEach((ch, xx) => { if (CANDY_COLORS[ch]) { x.fillStyle = CANDY_COLORS[ch]; x.fillRect(cx - 2 + xx, cy - 3 + y, 1, 1); } }));
}
/** A cookie: { shape (null: a dough ball), frost, sprinkles, candies, bites }. */
function drawCookie(cv, ck) {
  const x = cv.getContext('2d'); x.clearRect(0, 0, N, N);
  const bites = ck.bites || [];
  const raw = ck.shape ? mask(ck.shape, 1) : mask('circle', 0.55);
  const bitten = (xx, yy) => bites.some(([bx, by, r]) => (xx - bx) ** 2 + (yy - by) ** 2 < r * r);
  const inD = (xx, yy) => xx >= 0 && yy >= 0 && xx < N && yy < N && raw[yy * N + xx] && !bitten(xx, yy);
  const fm = ck.frost ? mask(ck.shape, 0.8) : null;
  const inF = (xx, yy) => fm && xx >= 0 && yy >= 0 && xx < N && yy < N && fm[yy * N + xx];
  for (let yy = 0; yy < N; yy += 1) {
    for (let xx = 0; xx < N; xx += 1) {
      if (!inD(xx, yy)) continue;
      const edge = !inD(xx + 1, yy) || !inD(xx - 1, yy) || !inD(xx, yy + 1) || !inD(xx, yy - 1);
      let col = edge ? INK : (!inD(xx + 2, yy + 2) ? '#b8783c' : (!inD(xx - 2, yy - 2) ? '#f2c98a' : '#dca05c'));
      if (!ck.shape && !edge) col = !inD(xx + 2, yy + 2) ? '#d7a86e' : '#f0cf9c';
      if (!edge && inF(xx, yy)) {
        const base = ck.frost === 'rainbow' ? RAINBOW[Math.floor(yy / 7) % 6] : ck.frost;
        col = !inF(xx + 1, yy + 1) ? shade(base, 0.8) : (!inF(xx - 1, yy - 1) ? shade(base, 1.1) : base);
      }
      x.fillStyle = col; x.fillRect(xx, yy, 1, 1);
    }
  }
  for (const p of ck.sprinkles || []) {
    if (!inD(p.x, p.y)) continue;
    x.fillStyle = p.c;
    if (p.k === 'snow' || p.k === 'star') { x.fillRect(p.x, p.y - 1, 1, 3); x.fillRect(p.x - 1, p.y, 3, 1); }
    else if (p.k === 'leaf') { x.fillRect(p.x, p.y, 2, 1); x.fillRect(p.x + 1, p.y - 1, 1, 1); }
    else if (p.k === 'bubble') { x.fillRect(p.x, p.y, 2, 2); x.fillStyle = '#fff'; x.fillRect(p.x, p.y, 1, 1); }
    else if (p.k === 'flower') { x.fillRect(p.x - 1, p.y, 3, 1); x.fillRect(p.x, p.y - 1, 1, 3); x.fillStyle = '#fff3a0'; x.fillRect(p.x, p.y, 1, 1); }
    else x.fillRect(p.x, p.y, p.h ? 2 : 1, p.h ? 1 : 2);
  }
  for (const c of ck.candies || []) if (inD(c.x, c.y)) drawCandy(x, c.k, c.x, c.y);
}

// ---------------- scenes ----------------
function drawScene(cv, theme, opts = {}) {
  const m = sceneOf(theme); const x = cv.getContext('2d'); const W = cv.width; const H = cv.height;
  x.imageSmoothingEnabled = false;
  const gy = Math.round(H * (opts.groundAt || 0.62));
  for (let i = 0; i < 6; i += 1) { x.fillStyle = i % 2 ? m.sky[1] : m.sky[0]; x.fillRect(0, Math.round(gy * i / 6), W, Math.ceil(gy / 6)); }
  const st = m.style;
  if (st === 'stars' || st === 'moon') { for (let i = 0; i < 40; i += 1) { x.fillStyle = i % 5 ? '#ffffff' : '#ffd43b'; x.fillRect((i * 37 + 11) % W, (i * 19 + 3) % Math.max(1, gy - 4), 1, 1); } }
  if (!opts.plain) {
    if (st === 'peaks' || st === 'volcano') {
      for (let i = 0; i < W; i += 1) {
        const h = Math.round((16 + 12 * Math.abs(Math.sin(i / 17)) + (i % 7 < 3 ? 2 : 0)) * H / 100);
        x.fillStyle = st === 'peaks' ? '#7c95b0' : '#6b4a3e'; x.fillRect(i, gy - h, 1, h);
        x.fillStyle = st === 'peaks' ? '#ffffff' : '#ff6b3d'; x.fillRect(i, gy - h, 1, st === 'peaks' ? 2 : 1);
      }
    }
    if (st === 'trees' || st === 'jungle' || st === 'towers') {
      for (let i = 2; i < W; i += 13 + (i % 3)) {
        const t = Math.round((st === 'jungle' ? 26 : 18) * H / 100) + (i % 5);
        x.fillStyle = '#5b3a1e'; x.fillRect(i + 5, gy - 10, 3, 10);
        x.fillStyle = st === 'jungle' ? '#1f6b2c' : '#2f8f3a'; x.fillRect(i, gy - t - 4, 13, t - 4); x.fillRect(i + 2, gy - t - 6, 9, 2);
        x.fillStyle = st === 'jungle' ? '#2f8f3a' : '#49b04c'; x.fillRect(i + 2, gy - t - 4, 6, 3);
      }
      if (st === 'towers') { const tx = Math.round(W * 0.62); x.fillStyle = '#9a8f80'; x.fillRect(tx, gy - 34, 26, 34); x.fillRect(tx - 6, gy - 44, 10, 44); x.fillRect(tx + 22, gy - 44, 10, 44); x.fillStyle = '#c92a2a'; x.fillRect(tx - 6, gy - 48, 10, 4); x.fillRect(tx + 22, gy - 48, 10, 4); x.fillStyle = INK; x.fillRect(tx + 10, gy - 12, 6, 12); }
    }
    if (st === 'reef') { x.fillStyle = 'rgba(255,255,255,.35)'; for (let i = 0; i < 9; i += 1) x.fillRect((i * 37) % W, (i * 23) % gy, 2, 2); x.fillStyle = '#e8597a'; for (let i = 6; i < W; i += 22) { x.fillRect(i, gy - 8, 2, 8); x.fillRect(i - 2, gy - 6, 2, 2); x.fillRect(i + 2, gy - 5, 2, 2); } }
    if (st === 'rainbow') { RAINBOW.forEach((c, i) => { x.fillStyle = c; for (let a = 0; a <= 180; a += 1) { const r = W * 0.32 - i * 3; const ang = Math.PI + a * Math.PI / 180; x.fillRect(Math.round(W / 2 + r * Math.cos(ang)), Math.round(gy + r * Math.sin(ang) * 0.8), 3, 3); } }); }
    if (st === 'sea') { x.fillStyle = '#ffe066'; x.fillRect(Math.round(W * 0.7), gy - 22, 14, 14); x.fillStyle = '#3b8fc0'; x.fillRect(0, gy - 8, W, 8); x.fillStyle = '#ffffff'; for (let i = 0; i < W; i += 9) x.fillRect(i, gy - 8, 4, 1); }
    if (st === 'moon') { x.fillStyle = '#5c7cfa'; x.fillRect(Math.round(W * 0.72), 8, 16, 16); x.fillStyle = '#69db7c'; x.fillRect(Math.round(W * 0.72) + 3, 11, 6, 5); }
    if (st === 'stars') { x.fillStyle = '#ff8ad8'; x.fillRect(Math.round(W * 0.2), 10, 12, 12); x.fillStyle = '#ffd43b'; x.fillRect(Math.round(W * 0.2) - 4, 15, 20, 2); }
  }
  if (!['reef', 'stars', 'moon'].includes(st)) { x.fillStyle = '#fff'; [[0.18, 0.14], [0.7, 0.1]].forEach(([fx, fy]) => { const cx = Math.round(W * fx); const cy = Math.round(H * fy); x.fillRect(cx, cy, 14, 4); x.fillRect(cx + 3, cy - 3, 7, 3); }); }
  x.fillStyle = m.ground; x.fillRect(0, gy, W, H - gy);
  x.fillStyle = m.ground2; for (let i = 0; i < W; i += 6) x.fillRect(i + (i % 12 ? 2 : 0), gy + 3 + (i % 18 ? 4 : 9), 2, 1);
  x.fillRect(0, gy, W, 1);
}
/** The bakery: a kitchen wall in the map's colors, a shelf of jars, and a window onto the map. */
function drawKitchen(cv, theme) {
  const wall = littleMap(theme).wall; const x = cv.getContext('2d'); const W = cv.width; const H = cv.height;
  for (let y = 0; y < H; y += 8) for (let xx = 0; xx < W; xx += 8) { x.fillStyle = ((xx + y) / 8) % 2 ? wall[0] : wall[1]; x.fillRect(xx, y, 8, 8); }
  const win = mk(38, 30); drawScene(win, theme, { groundAt: 0.72 });
  x.fillStyle = INK; x.fillRect(116, 18, 42, 34); x.drawImage(win, 118, 20);
  x.fillStyle = '#8a5527'; x.fillRect(136, 20, 2, 30); x.fillRect(118, 34, 38, 2);
  x.fillStyle = '#ff9ec4'; x.fillRect(114, 16, 46, 4); for (let i = 0; i < 46; i += 6) { x.fillStyle = '#fff'; x.fillRect(114 + i, 20, 3, 2); }
  x.fillStyle = '#8a5527'; x.fillRect(4, 30, 30, 3);
  [['#ffd43b', 6], ['#ff9ec4', 15], ['#74c0fc', 24]].forEach(([c, sx]) => { x.fillStyle = INK; x.fillRect(sx, 20, 8, 10); x.fillStyle = c; x.fillRect(sx + 1, 23, 6, 6); x.fillStyle = '#d9467a'; x.fillRect(sx, 19, 8, 2); });
}

/** The icon on the bakery's door sign in the village (a frosted heart cookie), as a canvas. */
export function cookieIcon() {
  const c = mk(N, N);
  drawCookie(c, { shape: 'heart', frost: '#ff9ec4', sprinkles: [{ x: 18, y: 18, c: '#fff' }, { x: 27, y: 20, c: '#ffe066', h: 1 }, { x: 22, y: 26, c: '#74c0fc' }], candies: [{ k: 'cherry', x: 24, y: 18 }] });
  return c;
}

// ---------------- the overlay ----------------
let openOne = null;

/**
 * Opens the little games. opts: {
 *   kid, theme: the kid's map, start: 'bakery' | 'puzzle' | 'hub', buddy: the buddy's svg markup,
 *   sound: whether to play sounds, newStars: stars that came in since the jar was last seen (they fly in),
 *   stars(): the stars in the jar now, spend(): takes one out for a visit (false when empty),
 *   stickers(): kid.little.stickers, puzzles(): puzzles finished so far,
 *   onRound({ kind, animal, gold }): a round was won (save the sticker; a puzzle counts too),
 *   onClose(),
 * }
 * Returns a function that closes it.
 */
export function openLittle(opts) {
  if (openOne) openOne();
  soundOn = opts.sound !== false;
  const A = art();
  const theme = opts.theme;
  const LM = littleMap(theme);
  const root = document.createElement('div');
  root.className = 'little';
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-label', 'Little games');
  root.innerHTML = '<div class="lt-stage"><canvas class="lt-scene" width="160" height="100"></canvas><div class="lt-screen"></div><div class="lt-jar" aria-label="Star jar"><div class="lt-lid"></div><div class="lt-glass"></div></div></div>';
  document.body.appendChild(root);
  const stage = root.querySelector('.lt-stage');
  const screen = root.querySelector('.lt-screen');
  const sceneCv = root.querySelector('.lt-scene');
  const jar = root.querySelector('.lt-jar');
  const $ = (s) => screen.querySelector(s);

  let timers = [];
  const later = (fn, ms) => { const t = setTimeout(fn, ms); timers.push(t); return t; };
  const clearTimers = () => { timers.forEach(clearTimeout); timers = []; };
  let intervals = [];
  const every = (fn, ms) => { const t = setInterval(fn, ms); intervals.push(t); return t; };
  const clearIntervals = () => { intervals.forEach(clearInterval); intervals = []; };
  let cur = 'hub';
  let visit = null;

  // the stage fills the screen at 16:10
  const fit = () => {
    const vw = window.innerWidth; const vh = window.innerHeight;
    const w = Math.min(vw, vh * 1.6);
    stage.style.width = `${Math.floor(w)}px`; stage.style.height = `${Math.floor(w / 1.6)}px`;
  };
  fit();
  const onResize = () => { fit(); if (cur === 'puzzle') showPuzzle(); };
  window.addEventListener('resize', onResize);

  // ---- idle hint: a hand points at the next thing to tap ----
  let hintTarget = null; let hintTimer = null; let handEl = null;
  const resetHint = () => {
    clearTimeout(hintTimer); if (handEl) { handEl.remove(); handEl = null; }
    if (!hintTarget) return;
    hintTimer = setTimeout(() => {
      const el = hintTarget && hintTarget();
      if (!el || !el.isConnected) return;
      const r = el.getBoundingClientRect(); const s = stage.getBoundingClientRect();
      handEl = document.createElement('div'); handEl.className = 'lt-hand'; handEl.innerHTML = HAND;
      handEl.style.left = `${r.left - s.left + r.width * 0.55}px`; handEl.style.top = `${r.top - s.top + r.height * 0.45}px`;
      stage.appendChild(handEl);
    }, 4000);
  };
  const hint = (fn) => { hintTarget = fn; resetHint(); };
  stage.addEventListener('pointerdown', resetHint, true);

  // ---- the jar ----
  const renderJar = (n = opts.stars()) => {
    const g = root.querySelector('.lt-glass'); g.innerHTML = '';
    for (let i = 0; i < Math.min(JAR_MAX, n); i += 1) g.appendChild(img(A.star));
  };
  const flyStars = (n) => {
    const have = opts.stars();
    renderJar(Math.max(0, have - n));
    for (let i = 0; i < n; i += 1) {
      later(() => {
        const s = img(A.star); s.className = 'lt-pix lt-fly';
        const r = stage.getBoundingClientRect(); const j = jar.getBoundingClientRect();
        s.style.left = `${r.width * 0.5}px`; s.style.top = `${r.height * 0.9}px`;
        stage.appendChild(s); SFX.star();
        requestAnimationFrame(() => requestAnimationFrame(() => { s.style.left = `${j.left - r.left + j.width * 0.35}px`; s.style.top = `${j.top - r.top + j.height * 0.5}px`; s.style.transform = 'scale(.6)'; }));
        later(() => { s.remove(); renderJar(Math.max(0, have - n + i + 1)); }, 750);
      }, 500 + i * 500);
    }
  };

  // ---- bits shared by the screens ----
  const backBtn = (hold = true) => {
    const b = document.createElement('button'); b.className = 'lt-btn lt-home'; b.innerHTML = HOUSE;
    b.setAttribute('aria-label', hold ? 'Hold to go back' : 'Go back');
    const leave = () => { SFX.pop(); if (cur === 'hub') close(); else showHub(); };
    if (!hold) { b.onclick = leave; return b; }
    let t = null;
    b.addEventListener('pointerdown', () => { b.classList.add('holding'); t = setTimeout(leave, 900); });
    const stop = () => { b.classList.remove('holding'); clearTimeout(t); };
    b.addEventListener('pointerup', stop); b.addEventListener('pointerleave', stop); b.addEventListener('pointercancel', stop);
    b.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') leave(); });
    return b;
  };
  const visitBar = () => {
    const v = document.createElement('div'); v.className = 'lt-visit';
    for (let i = 0; i < VISIT_ROUNDS; i += 1) { const s = img(A.star); if (i >= visit.done) s.classList.add('left'); v.appendChild(s); }
    return v;
  };
  const popUp = (src, left, top) => { const h = img(src); h.className = 'lt-pix lt-float'; h.style.left = `${left}cqw`; h.style.top = `${top}cqw`; screen.appendChild(h); later(() => h.remove(), 1500); };
  const confetti = (n) => {
    for (let i = 0; i < n; i += 1) {
      const c = document.createElement('div'); c.className = 'lt-confetti'; c.style.background = pick(RAINBOW);
      c.style.left = `${rnd(100)}cqw`; c.style.top = `${-2 + rnd(10)}cqw`; c.style.animationDelay = `${Math.random() * 0.4}s`;
      screen.appendChild(c); later(() => c.remove(), 2200);
    }
  };
  const stickerEl = (id) => {
    const st = opts.stickers()[id];
    const w = document.createElement('div'); w.className = `lt-sticker${st ? ' got' : ''}${st?.gold ? ' gold' : ''}`;
    w.appendChild(img(animalPic(id).url));
    if (st) { const h = document.createElement('div'); h.className = 'lt-hearts'; for (let i = 0; i < 3; i += 1) h.appendChild(img(i < (st.hearts || 0) ? A.heart : A.heartEmpty)); w.appendChild(h); }
    return w;
  };
  const showSticker = (id) => {
    const s = stickerEl(id); s.classList.add('lt-new'); screen.appendChild(s); SFX.chime();
    later(() => s.remove(), 1700);
  };
  const win = (kind, id, gold) => opts.onRound?.({ kind, animal: id, gold });
  const roundDone = () => {
    visit.done += 1;
    $('.lt-visit')?.replaceWith(visitBar());
    later(() => {
      if (visit.done >= VISIT_ROUNDS) { confetti(30); SFX.chime(); later(showHub, 1600); } else (visit.kind === 'bakery' ? showBakery : showPuzzle)();
    }, 900);
  };
  const startVisit = (kind) => {
    if (!opts.spend()) { emptyHint(); return; }
    renderJar(); SFX.pop();
    visit = { kind, done: 0 };
    if (kind === 'bakery') showBakery(); else showPuzzle();
  };
  const emptyHint = () => {
    SFX.soft();
    const bud = $('.lt-buddy'); if (bud) { bud.classList.remove('jump'); void bud.offsetWidth; bud.classList.add('jump'); }
    $('.lt-say')?.remove();
    const say = document.createElement('div'); say.className = 'lt-say'; say.setAttribute('aria-label', 'Do a chore to get a star');
    say.innerHTML = '<span>🧸</span><span>👕</span><span>➜</span>'; say.appendChild(img(A.star));
    screen.appendChild(say); later(() => say.remove(), 3000);
  };
  const reset = () => { clearTimers(); clearIntervals(); hint(null); screen.innerHTML = ''; };

  // ---- the hub ----
  function showHub() {
    reset(); visit = null; cur = 'hub'; jar.hidden = false; renderJar();
    drawScene(sceneCv, theme);
    const bud = document.createElement('div'); bud.className = 'lt-buddy'; bud.innerHTML = opts.buddy || ''; screen.appendChild(bud);
    bud.onclick = () => { bud.classList.remove('jump'); void bud.offsetWidth; bud.classList.add('jump'); VOICES.squeak(); popUp(A.heart, 47, 30); };
    const stars = opts.stars();
    const door = (left, icon, label, kind) => {
      const d = document.createElement('button'); d.className = `lt-btn lt-door${stars ? '' : ' empty'}`; d.style.left = left; d.dataset.kind = kind; d.setAttribute('aria-label', label);
      d.appendChild(icon); const c = img(A.star); c.className = 'lt-pix lt-cost'; d.appendChild(c);
      d.onclick = () => startVisit(kind);
      screen.appendChild(d);
    };
    door('8cqw', cookieIcon(), 'Little bakery', 'bakery');
    door('70cqw', puzzleIcon(), 'Animal puzzles', 'puzzle');
    const bk = document.createElement('button'); bk.className = 'lt-btn lt-bookbtn'; bk.setAttribute('aria-label', 'Sticker book'); bk.innerHTML = BOOK;
    bk.onclick = () => { SFX.pop(); showBook(); }; screen.appendChild(bk);
    screen.appendChild(backBtn(false));
    hint(() => (opts.stars() ? $('.lt-door') : bud));
  }
  function puzzleIcon() {
    const pi = mk(40, 28); const tmp = mk(40, 28); drawScene(tmp, theme, { plain: true });
    const p = animalPic(LM.animals[0]);
    const ai = new Image();
    ai.onload = () => {
      const tx = tmp.getContext('2d'); const s = Math.max(1, Math.floor(22 / Math.max(ai.width, ai.height)));
      tx.drawImage(ai, 20 - ai.width * s / 2, 26 - ai.height * s, ai.width * s, ai.height * s);
      const px = pi.getContext('2d');
      [[0, 0], [1, 0], [0, 1], [1, 1]].forEach(([i, j]) => px.drawImage(tmp, i * 20, j * 14, 20, 14, i * 20 + (i ? 1 : -1) * (j ? 1 : 0), j * 14, 20, 14));
      px.fillStyle = INK; px.fillRect(19, 0, 1, 28); px.fillRect(0, 13, 40, 1);
    };
    ai.src = p.url;
    return pi;
  }

  // ---- the bakery ----
  function showBakery() {
    reset(); cur = 'bakery'; jar.hidden = true;
    drawKitchen(sceneCv, theme);
    screen.appendChild(backBtn()); screen.appendChild(visitBar());
    const counter = document.createElement('div'); counter.className = 'lt-counter'; screen.appendChild(counter);
    const id = nextFor();
    const gold = Math.random() < GOLD_CHANCE;
    const pic = animalPic(id);
    const cust = document.createElement('div'); cust.className = `lt-customer enter-${LM.enter}${gold ? ' shiny' : ''}`;
    cust.style.height = `${Math.max(26, Math.min(40, pic.h / 1.3))}%`;
    const cimg = img(pic.url); cust.appendChild(cimg); screen.appendChild(cust);
    later(() => { cust.classList.remove(`enter-${LM.enter}`); if (['swim', 'float', 'beam'].includes(LM.enter)) cust.classList.add('floaty'); call(id); }, 1600);
    if (LM.enter === 'swim') {
      const bubbles = () => { for (let i = 0; i < 3; i += 1) { const b = document.createElement('div'); b.className = 'lt-bub'; b.style.left = `${4 + rnd(90)}cqw`; b.style.top = `${40 + rnd(20)}cqw`; screen.appendChild(b); later(() => b.remove(), 2100); } };
      bubbles(); every(bubbles, 1400);
    }
    if (LM.enter === 'drop') { const vine = document.createElement('div'); vine.className = 'lt-vine'; screen.appendChild(vine); }
    if (LM.enter === 'slide' || LM.enter === 'beam') SFX.whoosh();
    const shapes = [...SHAPES, LM.cutter]; const frosts = [...BASE_FROST, LM.frost];
    const wish = { shape: pick(shapes), frost: pick(frosts) };
    const bub = document.createElement('div'); bub.className = 'lt-bubble'; const bc = mk(N, N);
    drawCookie(bc, { ...wish, sprinkles: [{ x: 20, y: 20, c: '#fff' }, { x: 27, y: 24, c: '#fff', h: 1 }, { x: 23, y: 29, c: '#fff' }] });
    bub.appendChild(bc); bub.style.opacity = 0; screen.appendChild(bub); later(() => { bub.style.opacity = 1; SFX.pop(); }, 1700);
    const plate = document.createElement('div'); plate.className = 'lt-plate'; screen.appendChild(plate);
    const ck = { shape: null, frost: null, sprinkles: [], candies: [], bites: [] };
    const cw = document.createElement('div'); cw.className = 'lt-cookie'; const cv = mk(N, N); cw.appendChild(cv); screen.appendChild(cw);
    const oven = document.createElement('div'); oven.className = 'lt-oven'; screen.appendChild(oven);
    const tray = document.createElement('div'); tray.className = 'lt-tray'; screen.appendChild(tray);
    const redraw = () => drawCookie(cv, ck);
    redraw();
    let step = 'shape';
    const btn = (drawFn, onTap, label) => { const b = document.createElement('button'); b.className = 'lt-btn'; b.setAttribute('aria-label', label); const c = mk(N, N); drawFn(c); b.appendChild(c); b.onclick = () => onTap(b); tray.appendChild(b); return b; };
    const stepShapes = () => {
      step = 'shape'; tray.innerHTML = '';
      shapes.forEach((s) => btn((c) => drawCookie(c, { shape: s }), () => { ck.shape = s; SFX.pop(); redraw(); stepFrost(); }, `${s} cutter`));
      hint(() => tray.querySelector('.lt-btn'));
    };
    const stepFrost = () => {
      step = 'frost'; tray.innerHTML = '';
      frosts.forEach((f) => btn((c) => {
        const x = c.getContext('2d'); const mm = mask('circle', 0.75);
        for (let yy = 0; yy < N; yy += 1) for (let xx = 0; xx < N; xx += 1) if (mm[yy * N + xx]) { const e = !mm[(yy + 1) * N + xx + 1] || !mm[(yy - 1) * N + xx - 1]; x.fillStyle = e ? INK : (f === 'rainbow' ? RAINBOW[Math.floor(yy / 6) % 6] : f); x.fillRect(xx, yy, 1, 1); }
      }, () => { ck.frost = f; SFX.squish(); redraw(); stepDecorate(); }, 'frosting'));
      hint(() => tray.querySelector('.lt-btn'));
    };
    const stepDecorate = () => {
      step = 'decorate'; tray.innerHTML = '';
      Object.keys(CANDIES).forEach((k) => btn((c) => { const x = c.getContext('2d'); x.save(); x.scale(6, 6); drawCandy(x, k, 3.5, 4.5); x.restore(); }, (b) => {
        const dm = mask(ck.shape, 0.7); let px; let py; let tries = 0;
        do { px = 8 + rnd(32); py = 8 + rnd(32); tries += 1; } while (!dm[py * N + px] && tries < 60);
        ck.candies.push({ k, x: px, y: py }); SFX.plink(); redraw();
        cw.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.05)' }, { transform: 'scale(1)' }], 200);
        b.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-2cqw)' }, { transform: 'translateY(0)' }], 250);
      }, k));
      const sep = document.createElement('div'); sep.className = 'lt-sep'; tray.appendChild(sep);
      const bell = btn((c) => {
        const x = c.getContext('2d'); x.fillStyle = INK; x.fillRect(8, 36, 32, 5); x.fillRect(22, 6, 4, 5);
        x.beginPath(); x.moveTo(10, 36); x.quadraticCurveTo(10, 10, 24, 10); x.quadraticCurveTo(38, 10, 38, 36); x.fill();
        x.fillStyle = '#ffd43b'; x.beginPath(); x.moveTo(13, 34); x.quadraticCurveTo(13, 13, 24, 13); x.quadraticCurveTo(35, 13, 35, 34); x.fill();
        x.fillStyle = '#fff3bf'; x.fillRect(17, 18, 3, 12);
      }, () => bake(), 'Ring the bell');
      bell.classList.add('lt-bell');
      hint(() => (ck.sprinkles.length + ck.candies.length > 12 ? bell : cw));
    };
    // tap or drag on the cookie: the map's sprinkles, with some rainbow ones mixed in
    let painting = false; let last = 0;
    const sprinkleAt = (e) => {
      const r = cv.getBoundingClientRect();
      const px = Math.floor((e.clientX - r.left) / r.width * N); const py = Math.floor((e.clientY - r.top) / r.height * N);
      for (let i = 0; i < 6; i += 1) { const rb = Math.random() < 0.35; ck.sprinkles.push({ x: px + rnd(11) - 5, y: py + rnd(11) - 5, c: rb ? pick(RAINBOW) : pick(LM.sprinkle), h: rnd(2), k: rb ? 'dots' : LM.bits }); }
      if (ck.sprinkles.length > 600) ck.sprinkles.splice(0, ck.sprinkles.length - 600);
      const now = performance.now(); if (now - last > 90) { SFX.shake(); last = now; }
      if (ck.sprinkles.length > 30) $('.lt-bell')?.classList.add('ready');
      if (LM.enter === 'swim') { const b = document.createElement('div'); b.className = 'lt-bub'; const s = stage.getBoundingClientRect(); b.style.left = `${e.clientX - s.left}px`; b.style.top = `${e.clientY - s.top}px`; screen.appendChild(b); later(() => b.remove(), 2100); }
      redraw();
    };
    cw.addEventListener('pointerdown', (e) => {
      if (step === 'shape' || step === 'frost') {
        cw.animate([{ transform: 'rotate(-4deg)' }, { transform: 'rotate(4deg)' }, { transform: 'none' }], 250);
        tray.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-1.5cqw)' }, { transform: 'none' }], 300);
        return;
      }
      if (step !== 'decorate') return;
      painting = true; try { cw.setPointerCapture(e.pointerId); } catch { /* fine */ } sprinkleAt(e);
    });
    cw.addEventListener('pointermove', (e) => { if (painting) sprinkleAt(e); });
    cw.addEventListener('pointerup', () => { painting = false; });
    cw.addEventListener('pointercancel', () => { painting = false; });
    const bake = () => {
      step = 'bake'; hint(null); tray.innerHTML = ''; cw.classList.add('baking'); later(() => oven.classList.add('on'), 400);
      later(() => { SFX.ding(); oven.classList.remove('on'); cw.classList.remove('baking'); }, 2300);
      later(() => {
        // the cookie goes to the animal's mouth, then three crunchy bites
        const cr = cust.getBoundingClientRect(); const wr = cw.getBoundingClientRect();
        cw.classList.add('to-mouth');
        cw.style.transform = `translate(${cr.right - wr.left - wr.width * 0.25}px, ${cr.top + cr.height * 0.25 - wr.top - wr.height * 0.3}px) scale(.55)`;
        bub.remove();
        const match = ck.shape === wish.shape && ck.frost === wish.frost;
        [0, 1, 2].forEach((n) => later(() => {
          ck.bites.push([4 + n * 9 + rnd(3), 18 + rnd(12), 9 + n * 2]); if (n === 2) ck.bites.push([30, 24, 30]);
          redraw(); SFX.crunch();
          const s = stage.getBoundingClientRect();
          for (let i = 0; i < 5; i += 1) { const c = document.createElement('div'); c.className = 'lt-crumb'; c.style.left = `${cr.right - s.left + rnd(30)}px`; c.style.top = `${cr.top - s.top + cr.height * 0.4}px`; c.style.setProperty('--dx', `${rnd(10) - 5}cqw`); screen.appendChild(c); later(() => c.remove(), 800); }
        }, 1000 + n * 550));
        later(() => {
          cw.remove(); cust.classList.remove('floaty'); cust.classList.add('hop'); call(id);
          if (theme === 'bg-rainbow') { const g = ck.frost === 'rainbow' ? ['#ff8ad8', '#74c0fc'] : [ck.frost, ck.frost]; cimg.style.filter = `drop-shadow(0 0 1.4cqw ${g[0]}) drop-shadow(0 0 1.4cqw ${g[1]})`; }
          for (let i = 0; i < (match ? 8 : 4); i += 1) later(() => popUp(match && i % 2 ? A.sparkle : A.heart, 8 + rnd(18), 16 + rnd(10)), i * 150);
          if (match) confetti(18);
          win('bakery', id, gold);
          later(() => showSticker(id), 1000);
          later(() => { if (cur === 'bakery') roundDone(); }, 2600);
        }, 2800);
      }, 2800);
    };
    stepShapes();
  }
  const nextFor = () => nextAnimal({ little: { stickers: opts.stickers() } }, theme);

  // ---- the puzzles ----
  function showPuzzle() {
    reset(); cur = 'puzzle'; jar.hidden = true;
    drawScene(sceneCv, theme); screen.appendChild(backBtn()); screen.appendChild(visitBar());
    const id = nextFor();
    const gold = Math.random() < GOLD_CHANCE;
    const level = puzzleSize(opts.puzzles());
    const PW = 120; const PH = 80;
    const pic = mk(PW, PH); drawScene(pic, theme, { groundAt: 0.7, plain: true });
    const bare = mk(PW, PH); drawScene(bare, theme, { groundAt: 0.7, plain: true });
    const a = new Image();
    a.onload = () => {
      if (cur !== 'puzzle') return;
      const x = pic.getContext('2d'); x.imageSmoothingEnabled = false;
      // the animal fills most of the picture
      const s = Math.max(1, Math.floor(Math.min(PH * 0.78 / a.height, PW * 0.8 / a.width)));
      const ax = Math.round(PW / 2 - a.width * s / 2); const ay = Math.round(PH * 0.9 - a.height * s);
      x.drawImage(a, ax, ay, a.width * s, a.height * s);
      if (gold) [x, bare.getContext('2d')].forEach((g) => { g.strokeStyle = '#ffd43b'; g.lineWidth = 3; g.strokeRect(1.5, 1.5, PW - 3, PH - 3); });
      build({ ax, ay, aw: a.width * s });
    };
    a.src = animalPic(id).url;

    function build(apos) {
      const sw = screen.clientWidth; const sh = screen.clientHeight; const bd = 0.6 * sw / 100;
      const bw = sw * 0.5; const bh = bw * PH / PW; const bx = sw * 0.07; const by = (sh - bh) / 2 + sh * 0.04;
      const [cols, rows] = level; const pw = PW / cols; const ph = PH / rows; const k = bw / PW;
      const board = document.createElement('div'); board.className = 'lt-board';
      Object.assign(board.style, { left: `${bx}px`, top: `${by}px`, width: `${bw + 2 * bd}px`, height: `${bh + 2 * bd}px` });
      const ghost = mk(PW, PH); ghost.classList.add('ghost'); ghost.getContext('2d').drawImage(pic, 0, 0); board.appendChild(ghost);
      const slotsEl = document.createElement('div'); slotsEl.className = 'lt-slots';
      slotsEl.style.gridTemplate = `repeat(${rows}, 1fr) / repeat(${cols}, 1fr)`; slotsEl.style.inset = `${bd}px`;
      board.appendChild(slotsEl); screen.appendChild(board);
      const pieces = []; let done = 0;
      // loose pieces wait a bit smaller in the tray, two columns, never past the edge
      const pk = Math.min(1, (sw * 0.16) / (pw * k), (sh * 0.27) / (ph * k));
      let picked = null; let helpTimer = null;
      const unpick = () => { if (picked) picked.classList.remove('picked'); picked = null; clearTimeout(helpTimer); slotsEl.querySelectorAll('.pulse').forEach((d) => d.classList.remove('pulse')); };
      const home = (c) => { c.classList.add('flying'); c.style.setProperty('--s', pk); c.style.left = `${c.dataset.hx}px`; c.style.top = `${c.dataset.hy}px`; setTimeout(() => c.classList.remove('flying'), 460); };
      const placePicked = (i) => {
        if (!picked) return;
        const c = picked; unpick();
        const cell = slotsEl.children[i].getBoundingClientRect(); const sr = screen.getBoundingClientRect();
        c.style.setProperty('--s', 1); c.classList.add('flying'); c.style.left = `${cell.left - sr.left}px`; c.style.top = `${cell.top - sr.top}px`;
        if (Number(c.dataset.idx) === i) { setTimeout(c.snap, 460); return; }
        // the wrong spot: a little wiggle, then it hops back to the tray to try again
        setTimeout(() => { c.animate([{ rotate: '0deg' }, { rotate: '-8deg' }, { rotate: '8deg' }, { rotate: '0deg' }], 350); SFX.soft(); }, 460);
        setTimeout(() => home(c), 900);
      };
      for (let i = 0; i < cols * rows; i += 1) { const d = document.createElement('div'); d.addEventListener('pointerdown', () => placePicked(i)); slotsEl.appendChild(d); }
      const slots = []; for (let j = 0; j < rows; j += 1) for (let i = 0; i < cols; i += 1) slots.push([i, j]);
      const spots = slots.map((_, n) => [sw * 0.63 + (n % 2) * sw * 0.18, sh * 0.16 + Math.floor(n / 2) * sh * 0.29]);
      spots.sort(() => Math.random() - 0.5);
      slots.forEach(([i, j], n) => {
        const c = mk(Math.round(pw), Math.round(ph)); c.getContext('2d').drawImage(pic, i * pw, j * ph, pw, ph, 0, 0, pw, ph);
        c.classList.add('lt-piece'); c.style.width = `${pw * k}px`; c.style.height = `${ph * k}px`;
        const tx = bx + bd + i * pw * k; const ty = by + bd + j * ph * k;
        c.style.setProperty('--s', pk);
        const [x0, y0] = spots[n];
        Object.assign(c.dataset, { idx: j * cols + i, hx: x0, hy: y0, tx, ty });
        c.style.left = `${x0}px`; c.style.top = `${y0}px`;
        screen.appendChild(c); pieces.push(c);
        let ox = 0; let oy = 0; let drag = false; let sx = 0; let sy = 0;
        c.snap = () => {
          c.classList.remove('flying'); c.classList.add('done'); c.style.left = `${tx}px`; c.style.top = `${ty}px`; SFX.snap();
          done += 1; if (done === pieces.length) finish();
        };
        c.addEventListener('pointerdown', (e) => {
          if (c.classList.contains('done') || c.classList.contains('flying')) return;
          drag = true; sx = e.clientX; sy = e.clientY; try { c.setPointerCapture(e.pointerId); } catch { /* fine */ } c.classList.add('dragging');
          const sc = parseFloat(c.style.getPropertyValue('--s')) || 1; c.style.setProperty('--s', 1);
          ox = (e.clientX - c.offsetLeft) / sc; oy = (e.clientY - c.offsetTop) / sc;
          c.style.left = `${e.clientX - ox}px`; c.style.top = `${e.clientY - oy}px`; SFX.pop();
        });
        c.addEventListener('pointermove', (e) => { if (!drag) return; c.style.left = `${e.clientX - ox}px`; c.style.top = `${e.clientY - oy}px`; });
        const up = (e) => {
          if (!drag) return;
          drag = false; c.classList.remove('dragging');
          if (Math.hypot(e.clientX - sx, e.clientY - sy) < 10) {
            // a tap picks the piece up; then she taps the spot where it goes
            const was = picked === c; unpick();
            c.style.left = `${c.dataset.hx}px`; c.style.top = `${c.dataset.hy}px`; c.style.setProperty('--s', pk);
            if (!was) { picked = c; c.classList.add('picked'); helpTimer = setTimeout(() => slotsEl.children[Number(c.dataset.idx)].classList.add('pulse'), 8000); }
            return;
          }
          unpick();
          // a drag lands if it's dropped anywhere near its own spot
          if (Math.hypot(c.offsetLeft - tx, c.offsetTop - ty) < Math.max(pw, ph) * k * 0.6) c.snap();
          else home(c);
        };
        c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
      });
      hint(() => pieces.find((p) => !p.classList.contains('done')));
      function finish() {
        hint(null); clearTimeout(helpTimer);
        later(() => {
          call(id); confetti(26);
          win('puzzle', id, gold);
          pieces.forEach((pc) => pc.remove());
          board.replaceChildren(bare);
          const al = document.createElement('div'); al.className = 'lt-alive';
          Object.assign(al.style, { left: `${bx + bd + apos.ax * k}px`, top: `${by + bd + apos.ay * k}px`, width: `${apos.aw * k}px` });
          al.appendChild(img(animalPic(id).url)); screen.appendChild(al);
          // it hops about in its picture
          let t = 0;
          every(() => { t += 1; al.style.translate = `${Math.sin(t / 2) * 2}cqw ${t % 2 ? -1 : 0}cqw`; }, 260);
          later(() => showSticker(id), 1000);
          later(() => { if (cur === 'puzzle') roundDone(); }, 3000);
        }, 250);
      }
    }
  }

  // ---- the sticker book: this map's six ----
  function showBook() {
    reset(); cur = 'book'; jar.hidden = true;
    drawScene(sceneCv, theme);
    const b = document.createElement('div'); b.className = 'lt-book';
    LM.animals.forEach((a) => {
      const s = stickerEl(a);
      s.onclick = () => { if (!opts.stickers()[a]) { SFX.soft(); return; } call(a); s.classList.remove('wiggle'); void s.offsetWidth; s.classList.add('wiggle'); };
      b.appendChild(s);
    });
    screen.appendChild(b);
    const back = backBtn(false); back.onclick = () => { SFX.pop(); showHub(); }; screen.appendChild(back);
  }

  function close() {
    if (!root.isConnected) return;
    reset(); clearTimeout(hintTimer);
    window.removeEventListener('resize', onResize);
    root.remove();
    openOne = null;
    opts.onClose?.();
  }
  openOne = close;

  showHub();
  if (opts.newStars > 0) flyStars(Math.min(JAR_MAX, opts.newStars));
  else if (opts.start === 'bakery' || opts.start === 'puzzle') later(() => startVisit(opts.start), 300);
  root.close = close; // for tests
  return close;
}
