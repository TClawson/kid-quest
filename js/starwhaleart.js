// The star whale, the Golden Galaxy's landmark, drawn for the village at one art pixel per village
// pixel (STARWHALE.w x STARWHALE.h): a huge friendly cosmic whale floating over a nebula pool,
// its body a window onto the night sky full of stars and golden constellations, a tiny golden
// observatory on its back, and a little orrery of planets going round it on a golden orbit.
//
// Idle, the whale breathes (it rises and settles), stars twinkle inside it, the planets go round
// and now and then a little comet passes. Tapped, it sings (rings of light and notes come off
// it), spouts a fountain of stars from its blowhole, the planets spin round fast, a shooting star
// crosses and it winks. While the map's show plays it keeps singing.
//
// The still parts are painted once into canvases; startStarwhale() redraws the moving parts about
// ten times a second. village.js uses it for the landmark whose art is 'starwhale'.

import { mix, h2, vnoise, bayer, Buf, grid, inEll, ramp, pixelBuffer, clamp } from './pixelkit.js';
import { sel, tg } from './castleart.js';

export const STARWHALE = { w: 168, h: 140 };
const W = STARWHALE.w; const H = STARWHALE.h;
const INK = '#140c2c';

// the palettes
const SKY = ['#0c0828', '#140e3a', '#1c144e', '#261c64', '#32267c', '#40329a', '#5a4cc0', '#8070e0', '#b0a4f4']; // the whale's sky
const BELLY = ['#5a4a90', '#7a6ab4', '#a090d4', '#c4b8ec', '#e2dafa', '#f6f2ff'];
const GD = ['#5a2a10', '#8a4a14', '#c07a1c', '#e8a82a', '#fcc83c', '#ffe27a', '#fff6c8'];
const BR = ['#3a2018', '#6a3e20', '#9a6428', '#c48a36', '#e2b056', '#f6d68a'];
const NEB = ['#c45ab4', '#7e52d6', '#3e8cc8'];

// where things are
const POOL = { cx: 88, cy: 120, rx: 74, ry: 15 };
const ORBIT = { cx: 90, cy: 76, rx: 74, ry: 19 };
const EYE = { x: 143, y: 63 };
const SPOUT = { x: 127, y: 36 };
const OBS = 98; // the observatory's middle
const SH = 110; // the whale sprite's height
const PLANETS = [
  { r: 5, period: 14, phase: 0.1, P: ramp('#ffc94a', 3, 3), ring: true },
  { r: 3.5, period: 9, phase: 0.55, P: ramp('#ff8fa8', 3, 3) },
  { r: 2.6, period: 6, phase: 0.8, P: ramp('#5ad0d8', 3, 3) },
];

// the body's outline: its back and its belly, from the tail stock to the round snout
const TOP = [[30, 66], [44, 60], [60, 53], [78, 46], [96, 41], [114, 37], [128, 35], [140, 37], [150, 41], [157, 47], [161, 54], [163, 61], [163.6, 66]];
const BOT = [[30, 78], [44, 85], [60, 91], [78, 95], [96, 97], [114, 96], [128, 93], [140, 88], [150, 82], [157, 77], [161, 72], [163, 69], [163.6, 66]];
const curve = (P, x) => {
  if (x <= P[0][0]) return P[0][1];
  for (let i = 1; i < P.length; i += 1) {
    if (x <= P[i][0]) {
      const [x0, y0] = P[i - 1]; const [x1, y1] = P[i];
      const u = (x - x0) / (x1 - x0); const s = (1 - Math.cos(u * Math.PI)) / 2;
      return y0 + (y1 - y0) * s;
    }
  }
  return null;
};
const topAt = (x) => curve(TOP, x);
const botAt = (x) => curve(BOT, x);
// the mouth: a long smile from under the eye to the snout
const mouthAt = (x) => 85 - ((x - 112) / 50) * 10 - Math.sin(((x - 112) / 50) * Math.PI) * 3;

/** Is (x, y) inside the whale? Its body, the tail stock and the two flukes, the flipper. */
function shape() {
  const inE = (x, y, cx, cy, rx, ry, a = 0) => {
    const dx = x + 0.5 - cx; const dy = y + 0.5 - cy;
    const c = Math.cos(a); const s = Math.sin(a);
    return ((dx * c + dy * s) / rx) ** 2 + ((-dx * s + dy * c) / ry) ** 2 <= 1;
  };
  // the tail stock: a tapering curve from the body up to the flukes
  const stock = (x, y) => {
    for (let k = 0; k <= 1; k += 0.03) {
      const bx = (1 - k) ** 2 * 40 + 2 * (1 - k) * k * 20 + k * k * 17;
      const by = (1 - k) ** 2 * 72 + 2 * (1 - k) * k * 75 + k * k * 45;
      const r = 8.5 - k * 5.5;
      if (Math.hypot(x + 0.5 - bx, y + 0.5 - by) <= r) return true;
    }
    return false;
  };
  return {
    body: (x, y) => {
      const X = x + 0.5; const Y = y + 0.5;
      if (X >= 30 && X <= 163.6 && Y >= topAt(X) && Y <= botAt(X)) return true;
      return X < 46 && stock(x, y);
    },
    fluke: (x, y) => inE(x, y, 9.5, 40.5, 9.5, 4, 0.47) || inE(x, y, 24.5, 40.5, 8.5, 3.8, -0.46),
    fin: (x, y) => inE(x, y, 101, 99, 12, 4.2, -0.62),
  };
}

/** The whale, as a canvas: eye open or winking, mouth shut or singing. Also returns the sky pixels stars can twinkle in. */
function whaleSprite(mode) {
  const S = shape();
  const b = new Buf(W, SH - 2, 2);
  const sky = [];
  const rnd = (x, y, k) => h2(x, y, 4100 + k);
  // constellations: a few little star patterns joined by faint golden lines
  const CONS = [
    [[46, 70], [54, 64], [62, 68], [70, 60]],
    [[80, 58], [88, 52], [97, 56], [106, 50], [112, 58]],
    [[116, 74], [124, 66], [132, 72], [126, 80]],
    [[78, 76], [86, 82], [96, 77]],
  ];
  const onLine = (x, y) => CONS.some((c) => c.some((p, i) => {
    if (!i) return false;
    const [x0, y0] = c[i - 1]; const [x1, y1] = p;
    const l = Math.hypot(x1 - x0, y1 - y0); const t = clamp(((x - x0) * (x1 - x0) + (y - y0) * (y1 - y0)) / (l * l), 0, 1);
    return Math.hypot(x - (x0 + t * (x1 - x0)), y - (y0 + t * (y1 - y0))) < 0.55 && t > 0.12 && t < 0.88;
  }));
  // the belly: pale and pleated along the bottom, deepest under the head, up to the mouth
  const bellyTop = (x) => {
    const bo = botAt(x + 0.5);
    if (x + 0.5 >= 112) return mouthAt(x + 0.5) + 1;
    return bo - clamp((x - 62) / 50, 0, 1) * 12.6;
  };
  for (let y = 0; y < SH - 2; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const fl = S.fluke(x, y); const bd = S.body(x, y);
      if (!fl && !bd) continue;
      if (bd && x >= 62 && x <= 162 && y + 0.5 > bellyTop(x)) {
        const fromBot = botAt(x + 0.5) - (y + 0.5);
        const pleat = Math.round(fromBot) % 3 === 1 && fromBot > 2 && x < 158;
        const l = (x - 62) / 100;
        let c = pleat ? BELLY[2] : fromBot < 2 ? BELLY[1] : fromBot < 5 ? BELLY[3] : l > 0.4 ? BELLY[4] : BELLY[3];
        if (!pleat && y + 0.5 - bellyTop(x) < 1.2 && x > 66) c = BELLY[5];
        b.set(x, y, c, tg('belly', BELLY[1]));
        continue;
      }
      // the sky inside: darker low down, a soft nebula drift, stars, and a rim of light along its back
      const up = (() => { let k = 0; while (k < 6 && (S.body(x, y - k - 1) || S.fluke(x, y - k - 1))) k += 1; return k; })();
      const t = (bayer(x, y) - 0.5) * 0.3;
      const depth = (y + 0.5 - topAt(clamp(x + 0.5, 30, 163))) / Math.max(8, botAt(clamp(x + 0.5, 30, 163)) - topAt(clamp(x + 0.5, 30, 163)));
      let i = up < 1 ? 8 : up < 2 ? 7 : up < 4 + t * 2 ? 6 : depth > 0.62 + t ? 2 : depth > 0.4 + t ? 3 : 4;
      if (fl) i = up < 1 ? 8 : up < 2 ? 6 : 4;
      let c = SKY[i];
      const nv = vnoise(x, y, 14, 77);
      if (i <= 4 && nv > 0.6 + t && x < 126) c = mix(c, NEB[Math.floor(vnoise(x, y, 40, 78) * 2.99)], nv > 0.7 ? 0.45 : 0.28);
      if (i <= 4) {
        const s = rnd(x, y, 0);
        if (s > 0.965) c = s > 0.992 ? '#ffffff' : s > 0.98 ? '#ffe9a0' : '#c8d0ff';
        else if (s < 0.025 && (x + y) % 2 && Math.hypot(x - EYE.x, y - EYE.y) > 8 && Math.abs(x - OBS) > 13) sky.push([x, y]);
        if (onLine(x, y)) c = mix(c, GD[4], 0.5);
      }
      b.set(x, y, c, tg('sky', SKY[2]));
    }
  }
  // the constellation stars, bright and golden
  CONS.forEach((c) => c.forEach(([x, y], k) => { b.set(x, y, '#fffbe6', 'star'); if (k % 2 === 0) { b.set(x - 1, y, GD[5], 'star'); b.set(x + 1, y, GD[5], 'star'); b.set(x, y - 1, GD[5], 'star'); b.set(x, y + 1, GD[5], 'star'); } }));
  // the flipper, in front, pale like the belly
  for (let y = 88; y < SH - 2; y += 1) for (let x = 84; x < 120; x += 1) {
    if (!S.fin(x, y)) continue;
    const l = -((x - 101) * 0.5 + (y - 99) * 0.9);
    b.set(x, y, l > 1.2 ? BELLY[4] : l > -1.5 ? BELLY[3] : BELLY[2], tg('belly', BELLY[1]));
  }
  // the blowhole
  b.set(SPOUT.x - 1, SPOUT.y + 1, SKY[1], 'face'); b.set(SPOUT.x, SPOUT.y + 1, SKY[0], 'face'); b.set(SPOUT.x + 1, SPOUT.y + 1, SKY[1], 'face');
  // the eye: a big friendly one with a twinkle, or shut in a wink; a pink cheek; a smile
  const { x: ex, y: ey } = EYE;
  if (mode === 'wink') {
    grid((x, y, c) => b.set(x, y, c, 'face'), ex - 3, ey - 1, ['k.....k', 'kk...kk', '.kkkkk.'], { k: '#ffffff' });
  } else {
    grid((x, y, c) => b.set(x, y, c, 'face'), ex - 3, ey - 4, ['..www..', '.wwwww.', 'wwkkkww', 'wkWWkkw', 'wkWWkkw', 'wkkkkkw', '.wkkkw.', '..www..'], { w: '#ffffff', k: INK, W: '#ffffff' });
  }
  grid((x, y, c) => b.set(x, y, c, 'face'), ex + 2, ey + 6, ['.pp.p', 'ppppp', '.ppp.'], { p: '#ff9ac8' });
  const mouthOpen = mode === 'sing';
  for (let x = 112; x < 163; x += 1) {
    const y = Math.round(mouthAt(x + 0.5));
    if (S.body(x, y)) b.set(x, y, INK, 'face');
  }
  if (mouthOpen) grid((x, y, c) => b.set(x, y, c, 'face'), 148, 75, ['.kkkkk.', 'kprrrpk', 'kprrrpk', 'kpprppk', '.kkkkk.'], { k: INK, p: '#a03a6a', r: '#ff8ab0' });
  // a tiny golden observatory on its back: a brass drum with glowing windows, a dome with its slit open, a telescope peeking out
  const ox = OBS; const base = Math.round(topAt(ox)) + 3;
  for (let y = base - 12; y < base; y += 1) for (let x = ox - 10; x <= ox + 10; x += 1) {
    if (y < base - 2 && Math.abs(x - ox) > 9) continue;
    const u = (x - ox) / 9;
    let c = y >= base - 2 ? BR[2] : u < -0.5 ? GD[5] : u < 0.3 ? GD[4] : u < 0.75 ? GD[3] : GD[2];
    if (y === base - 12) c = BR[3];
    b.set(x, y, c, tg('metal', BR[1]));
  }
  for (let y = base - 26; y < base - 11; y += 1) for (let x = ox - 11; x <= ox + 11; x += 1) {
    const u = (x + 0.5 - ox) / 11; const v = (base - 11 - (y + 0.5)) / 14;
    if (u * u + v * v > 1) continue;
    const l = -u * 0.7 + v * 0.5;
    let c = l > 0.45 ? GD[6] : l > 0.05 ? GD[5] : l > -0.35 ? GD[4] : GD[3];
    if (Math.abs(u + 0.5) < 0.06 || Math.abs(u - 0.5) < 0.06) c = mix(c, BR[2], 0.6); // brass ribs
    if (Math.abs(x + 0.5 - ox - 2.5) < 1.6 && v > 0.25) c = SKY[1]; // the slit
    b.set(x, y, c, tg('metal', BR[1]));
  }
  for (let k = 0; k < 11; k += 1) {
    const x = ox + 3 + Math.round(k * 0.75); const y = base - 19 - k;
    b.set(x, y, k < 8 ? BR[4] : GD[5], tg('metal', BR[1])); if (k < 8) b.set(x + 1, y, BR[2], tg('metal', BR[1]));
  }
  grid((x, y, c) => b.set(x, y, c, 'glow'), ox - 7, base - 9, ['.ww....ww.', 'wWWw..wWWw', 'wWWw..wWWw', '.ww....ww.'], { w: '#ffc040', W: '#fff4b8' });
  grid((x, y, c) => b.set(x, y, c, 'glow'), ox - 1, base - 8, ['bb', 'kk', 'kk', 'kk', 'kk', 'kk'], { b: BR[3], k: '#6a3e20' });
  b.set(ox - 1, base - 27, GD[6], 'star'); b.set(ox - 1, base - 26, GD[4], tg('metal', BR[1]));
  // outlines: dark violet round the whale, ink only underneath, none round the face or stars
  b.outline((t, side) => {
    const k = String(t).split(':')[0];
    if (k === 'face' || k === 'star' || k === 'glow') return null;
    if (k === 'sky') return side === 'top' || side === 'left' ? '#9a8af0' : side === 'bottom' ? INK : '#2a1e6a';
    if (k === 'belly') return side === 'bottom' ? INK : BELLY[0];
    return sel(t, side);
  });
  const pb = pixelBuffer(W, SH);
  b.blit(pb.px, 0, 0);
  const c = document.createElement('canvas'); c.width = W; c.height = SH;
  pb.put(c.getContext('2d'));
  return { canvas: c, sky };
}

/** The nebula pool under the whale and the back half of the planets' orbit, as a canvas. */
function paintBack() {
  const pb = pixelBuffer(W, H);
  const { px } = pb;
  const { cx, cy, rx, ry } = POOL;
  // a soft glow round it
  for (let y = cy - ry - 8; y <= cy + ry + 6; y += 1) for (let x = cx - rx - 10; x <= cx + rx + 10; x += 1) {
    const e = ((x + 0.5 - cx) / (rx + 10)) ** 2 + ((y + 0.5 - cy) / (ry + 7)) ** 2;
    if (e < 1 && bayer(x, y) < (1 - e) * 0.7) px(x, y, e < 0.6 ? '#b8a0ff40' : '#ffd86030');
  }
  for (let y = cy - ry - 3; y <= cy + ry + 3; y += 1) {
    for (let x = cx - rx - 3; x <= cx + rx + 3; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1.18) continue;
      if (d > 1) {
        // a rim of golden moon stones
        const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx); const f = (((a + Math.PI) / (Math.PI * 2)) * 34) % 1;
        const lit = -((x + 0.5 - cx) * 0.3 + (y + 0.5 - cy) * 1.2);
        px(x, y, f < 0.14 ? BR[1] : d > 1.11 ? (lit > 0 ? BR[3] : BR[2]) : lit > 0 ? GD[5] : GD[4]);
        continue;
      }
      // swirling nebula colors with stars in it, lighter where the whale's glow falls
      const a = Math.atan2((y + 0.5 - cy) / ry, (x + 0.5 - cx) / rx);
      const sw = (a + Math.sqrt(d) * 5 + 20) % (Math.PI * 2);
      const k = Math.floor((sw / (Math.PI * 2)) * 3 + vnoise(x, y, 9, 31) * 0.8) % 3;
      const t = (bayer(x, y) - 0.5) * 0.2;
      let c = d > 0.85 ? SKY[2] : mix(SKY[3], NEB[k], d < 0.45 + t ? 0.58 : 0.36);
      if (d < 0.12 + t) c = mix(c, '#ffffff', 0.3);
      // the whale's shadow on the pool
      if (inEll(x, y, 94, 113, 52, 5) && bayer(x, y) < 0.6) c = mix(c, SKY[0], 0.5);
      const s = h2(x, y, 33);
      if (s > 0.972) c = s > 0.993 ? '#ffffff' : '#ffe9a0';
      px(x, y, c);
    }
  }
  const pool = pb.data.slice();
  // the golden orbit: a dotted line, the half behind the whale here, the front half in its own canvas
  const ring = (front) => {
    const out = pixelBuffer(W, H);
    for (let k = 0; k < 520; k += 1) {
      const a = (k / 520) * Math.PI * 2;
      if ((Math.sin(a) > 0) !== front) continue;
      if (k % 4 === 3) continue;
      const x = Math.round(ORBIT.cx + Math.cos(a) * ORBIT.rx); const y = Math.round(ORBIT.cy + Math.sin(a) * ORBIT.ry);
      out.px(x, y, k % 4 === 0 ? GD[5] : GD[3]);
    }
    return out;
  };
  const back = ring(false);
  for (let i = 0; i < pool.length; i += 4) if (back.data[i + 3]) { pool[i] = back.data[i]; pool[i + 1] = back.data[i + 1]; pool[i + 2] = back.data[i + 2]; pool[i + 3] = 255; }
  const front = ring(true);
  return { back: new ImageData(pool, W, H), front: toCanvas(front) };
}
function toCanvas(pb) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  pb.put(c.getContext('2d'));
  return c;
}

/** A planet, as a canvas: shaded, a ring round the big one. */
function planetSprite(p) {
  const n = Math.ceil(p.r) * 2 + (p.ring ? 10 : 4);
  const b = new Buf(n, n, 1);
  const c0 = n / 2;
  for (let y = 0; y < n; y += 1) for (let x = 0; x < n; x += 1) {
    const dx = x + 0.5 - c0; const dy = y + 0.5 - c0;
    const ringHere = p.ring && inEll(x, y, c0, c0, p.r + 4.5, 1.8) && !inEll(x, y, c0, c0, p.r + 1.5, 0.9);
    const d = Math.hypot(dx, dy);
    if (ringHere && (dy > 0 || d > p.r)) { b.set(x, y, dy > 0 ? GD[5] : GD[3], tg('metal', GD[1])); continue; }
    if (d > p.r) continue;
    const l = -(dx * 0.6 + dy * 0.8) / p.r;
    let c = p.P[l > 0.45 ? 5 : l > 0 ? 4 : l > -0.45 ? 3 : 2];
    if (p.ring && Math.abs(dy + dx * 0.2 - 1.5) < 0.6) c = p.P[2];
    b.set(x, y, c, tg('body', p.P[1]));
  }
  b.outline((t, side) => (side === 'bottom' || side === 'right' ? mix(String(t).split(':')[1] || GD[1], INK, 0.4) : null));
  const pb = pixelBuffer(n + 2, n + 2);
  b.blit(pb.px, 1, 1);
  const c = document.createElement('canvas'); c.width = n + 2; c.height = n + 2;
  pb.put(c.getContext('2d'));
  return c;
}

let cache = null;
const art = () => {
  if (cache) return cache;
  const open = whaleSprite('open');
  cache = { ...paintBack(), whale: open.canvas, wink: whaleSprite('wink').canvas, sing: whaleSprite('sing').canvas, sky: open.sky, planets: PLANETS.map(planetSprite) };
  return cache;
};

/**
 * Starts the star whale on its canvas. Returns step(now), to call every animation frame; it
 * redraws about ten times a second. host.dataset.wake (a performance.now() time) sets it singing
 * for a while; while the map's show plays (the village has .show-on) it keeps singing.
 */
export function startStarwhale(canvas, host) {
  const ctx = canvas.getContext('2d');
  const A = art();
  let last = -1;
  let spin = 0; let lastT = null;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const rows = (r, X, Y, pal) => r.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const c = pal[row[x]]; if (c) dot(X + x, Y + y, c); } });
  const twinkle = (x, y, big, c = '#ffffff') => { dot(x, y, '#ffffff'); dot(x - 1, y, c); dot(x + 1, y, c); dot(x, y - 1, c); dot(x, y + 1, c); if (big) { dot(x - 2, y, c); dot(x + 2, y, c); dot(x, y - 2, c); dot(x, y + 2, c); } };
  // music notes, with a dark edge so they read over the sky
  const NOTE = [['...kk..', '...kkk.', '...k.kk', '...k..k', '...k...', '.kkk...', 'kkkk...', 'kkkk...', '.kk....'], ['...kkkkkk', '...kkkkkk', '...k....k', '...k....k', '...k....k', '.kkk..kkk', 'kkkk.kkkk', 'kkkk.kkkk', '.kk...kk.']].map((r) => {
    const g = ['.'.repeat(r[0].length + 2), ...r.map((row) => `.${row}.`), '.'.repeat(r[0].length + 2)].map((row) => row.split(''));
    const at = (x, y) => g[y]?.[x] === 'k';
    return g.map((row, y) => row.map((c, x) => (c === 'k' ? 'k' : at(x - 1, y) || at(x + 1, y) || at(x, y - 1) || at(x, y + 1) ? 'o' : '.')).join(''));
  });
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const show = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = show || (since > -100 && since < 5200);
    const k = show ? now % 3600 : since; // in the show it sings again every few seconds
    // the planets: slow, or spun round fast for a few seconds after a tap
    const dt = lastT == null ? 0 : Math.min(0.5, t - lastT);
    lastT = t;
    spin += dt * (awake && k > 200 && k < 3200 ? 6 : 1);
    ctx.clearRect(0, 0, W, H);
    ctx.putImageData(A.back, 0, 0);
    const pl = PLANETS.map((p, i) => {
      const a = (spin / p.period + p.phase) * Math.PI * 2;
      return { i, x: Math.round(ORBIT.cx + Math.cos(a) * ORBIT.rx), y: Math.round(ORBIT.cy + Math.sin(a) * ORBIT.ry), front: Math.sin(a) > 0 };
    });
    const drawPlanet = (q) => { const s = A.planets[q.i]; ctx.drawImage(s, q.x - Math.floor(s.width / 2), q.y - Math.floor(s.height / 2)); };
    pl.filter((q) => !q.front).forEach(drawPlanet);

    // the whale breathes: it rises a pixel and settles again
    const bob = Math.floor(t / 1.7) % 2 ? -1 : 0;
    const wink = awake && ((k > 2400 && k < 2900) || (show && k > 3000 && k < 3300));
    const sing = awake && k > 300 && k < 2300;
    ctx.drawImage(wink ? A.wink : sing && Math.floor(k / 400) % 2 === 0 ? A.sing : A.whale, 0, bob);
    // stars twinkle inside its body
    for (let n = 0; n < 6; n += 1) {
      const cyc = Math.floor(t * 1.6 + n * 0.37);
      const ph = (t * 1.6 + n * 0.37) % 1;
      const [x, y] = A.sky[Math.floor(h2(cyc, n, 7) * A.sky.length)] || [0, 0];
      if (ph < 0.5) twinkle(x, y + bob, ph > 0.15 && ph < 0.35 && n % 2 === 0, n % 3 ? '#c8d0ff' : '#ffe9a0');
    }
    ctx.drawImage(A.front, 0, 0);
    pl.filter((q) => q.front).forEach(drawPlanet);

    // a little comet passes now and then; tapped, a shooting star streaks across
    const cometP = (t % 9) / 2.4;
    if (cometP < 1) {
      const x = W + 8 - cometP * (W + 36); const y = 4 + cometP * 12;
      for (let j = 1; j < 12; j += 1) { dot(x + j, y - j * 0.35, j < 3 ? '#fff6c8' : j < 7 ? GD[4] : GD[2]); if (j < 5) dot(x + j, y - j * 0.35 + 1, GD[3]); }
      twinkle(x, y, false, '#fff6c8');
    }
    if (awake && k > 600 && k < 1500) {
      const p = (k - 600) / 900;
      const x = 4 + p * (W - 8); const y = 3 + p * 22;
      for (let j = 1; j < 22; j += 1) { dot(x - j, y - j * 0.4, j < 5 ? '#ffffff' : j < 12 ? '#c8d0ff' : '#7a6ae0'); if (j < 9) dot(x - j, y - j * 0.4 + 1, j < 4 ? '#e8ecff' : '#9a8af0'); }
      twinkle(x, y, true);
    }

    if (awake) {
      // it sings: rings of light open out round its head, and notes float up
      if (k > 300 && k < 2700) {
        for (let r = 0; r < 3; r += 1) {
          const q = (k - 300 - r * 500) / 1400;
          if (q <= 0 || q >= 1) continue;
          const rad = 14 + q * 36;
          const cx = 146; const cy = 64 + bob;
          for (let a = -2.7; a <= 0.9; a += 0.6 / rad) {
            for (let w = 0; w < 2; w += 1) {
              const x = Math.round(cx + Math.cos(a) * (rad + w)); const y = Math.round(cy + Math.sin(a) * (rad + w) * 0.85);
              if (x >= W || y < 0) continue;
              if (bayer(x, y) < 1.05 - q) dot(x, y, w ? (r % 2 ? GD[4] : '#a898ff') : r % 2 ? '#fff6c8' : '#e8e0ff');
            }
          }
        }
        for (let n = 0; n < 5; n += 1) {
          const q = (k - 300 - n * 380) / 1500;
          if (q <= 0 || q >= 1) continue;
          const x = 150 - n * 7 - q * 22 + Math.sin(q * 8 + n) * 4; const y = 62 - q * 56;
          rows(NOTE[n % 2], x, y, { k: n % 2 ? GD[5] : '#ffffff', o: '#2a1e6a' });
        }
      }
      // a fountain of stars out of its blowhole
      if (k > 1200 && k < 3900) {
        const q0 = k - 1200;
        const top = SPOUT.y + bob - 1;
        if (q0 < 2000) {
          const hgt = Math.round(Math.min(18, q0 / 30) * (q0 > 1600 ? (2000 - q0) / 400 : 1));
          for (let y = 0; y < hgt; y += 1) {
            const wob = (y + f) % 3 === 0 ? 1 : 0;
            dot(SPOUT.x - 1 - wob, top - y, '#b8c8ff'); dot(SPOUT.x, top - y, '#ffffff'); dot(SPOUT.x + 1 + (1 - wob) * 0, top - y, '#e0e8ff');
          }
          if (hgt > 6) {
            // a splashing crown at the top
            const cy = top - hgt;
            rows(['..w.w.w..', '.wbwWwbw.', 'b.wWWWw.b', '...wWw...'], SPOUT.x - 4, cy - 2, { w: '#e8f0ff', W: '#ffffff', b: '#a8b8ff' });
          }
        }
        for (let n = 0; n < 26; n += 1) {
          const t0 = 200 + (n % 13) * 110 + (n > 12 ? 55 : 0);
          const p = (q0 - t0) / 1500;
          if (p <= 0 || p >= 1) continue;
          const vx = (h2(n, 3, 5) - 0.5) * 2 * (24 + h2(n, 6, 5) * 30); const up = 8 + h2(n, 4, 5) * 10;
          const x = SPOUT.x + vx * p; const y = top - 18 - Math.sin(p * Math.PI) * up + p * p * 22;
          const c = ['#ffe27a', '#ffffff', '#c8d0ff', '#ffb8d8'][n % 4];
          if (p < 0.8 || f % 2) twinkle(x, y, n % 3 === 0 && p > 0.1 && p < 0.5, c);
        }
      }
    } else {
      // asleep it just breathes: a little puff of mist from the blowhole now and then
      const p = (t % 4.2) / 1.2;
      if (p < 1) { dot(SPOUT.x, SPOUT.y + bob - 1 - p * 6, '#c8d8ff'); dot(SPOUT.x, SPOUT.y + bob - 2 - p * 6, '#e8f0ff'); if (p > 0.3) { dot(SPOUT.x - 1 - p * 2, SPOUT.y + bob - 3 - p * 6, '#a8b8ff'); dot(SPOUT.x + 1 + p * 2, SPOUT.y + bob - 3 - p * 6, '#a8b8ff'); } }
    }
  };
}
