// The moon worm's cave, the Moon Base's landmark (it stands there once the space treasure map is
// finished), drawn for the village in its storybook style: one village pixel per art pixel, the
// grandest thing on the moon. A big crater with a rocky hill inside it, studded with glowing
// crystals; in the hill a cave, and in the mouth of the cave the shy, fluffy moon worm (the one
// that gives the buddy a ride in the map's show) sleeps with its chin on the doorstep, while the
// tip of its tail pokes out of a hole round the side. A cheap overlay animates it: crystals glint
// and glow, moon dust drifts up, the worm breathes and dreams in z's, peeks out with one eye now
// and then, and its tail wiggles. Tapped, it pops right out of its cave, opens its big eyes,
// lights up its antennae and wiggles hello.

import { mix, h2, vnoise, bayer, Buf, inEll, grid, pixelBuffer, clamp } from './pixelkit.js';
import { SB } from './spaceart.js';

export const CAVE = { w: 164, h: 108 };
const W = CAVE.w; const H = CAVE.h;

const MG = SB.dust; const RK = SB.rock; const SKY = SB.sky; const INK = SB.ink;
const WM = ['#3a2a6e', '#5a46a0', '#8a76d0', '#b4a2ec', '#d6c8fa', '#f0eaff']; // the moon worm, dark .. light

// ---------- where things are (art pixels) ----------

const RIM = { x: 82, y: 82, ox: 80, oy: 24, ix: 64, iy: 15 }; // the crater: outer and inner edges of its rim
const HILL = { x: 82, y: 58, rx: 47, ry: 44 }; // the rocky hill inside it
const MOUTH = { x: 82, y: 64, w: 32, h: 26 }; // the cave mouth: an arch, its floor at y + h
const HEAD = { x: 82, y: 79, r: 8.5 }; // the worm's head, resting on the doorstep
const EYES = [[78, 78], [87, 78]];
const TAIL = { x: 125, y: 70 }; // where the tail pokes out of the hill
const CRYSTALS = [
  // x, y (the foot), height, color, light
  [36, 52, 26, '#7ae8f8', '#e0fcff'], [44, 54, 16, '#7ae8f8', '#e0fcff'], [27, 56, 12, '#b4a0ff', '#ece6ff'],
  [128, 46, 24, '#ff8ad0', '#ffe0f4'], [137, 50, 14, '#ff8ad0', '#ffe0f4'], [119, 50, 11, '#ffd860', '#fff6c8'],
  [104, 25, 23, '#ffd860', '#fff6c8'], [96, 26, 13, '#7ae8f8', '#e0fcff'], [112, 28, 12, '#ff8ad0', '#ffe0f4'],
  [16, 90, 12, '#b4a0ff', '#ece6ff'], [150, 86, 13, '#7ae8f8', '#e0fcff'], [56, 100, 9, '#ff8ad0', '#ffe0f4'], [114, 101, 8, '#ffd860', '#fff6c8'],
];
const MOTES = Array.from({ length: 14 }, (_, i) => [8 + ((i * 53) % 148), (i * 37) % 60, 0.6 + (i % 4) * 0.25]);

// a puff of the worm: a fluffy round lump lit from the top left, edged in dark violet
function puffShape(r, dark = 0) {
  const cells = [];
  const R = Math.ceil(r) + 2;
  for (let y = -R; y <= R; y += 1) for (let x = -R; x <= R; x += 1) {
    const a = Math.atan2(y, x); const bump = Math.cos(a * 7) * 0.5 + 0.4;
    const d = Math.hypot(x + 0.5 - 0.5, y + 0.5 - 0.5);
    if (d > r + bump) continue;
    const edge = d > r + bump - 1.1;
    const lit = (-x * 0.6 - y * 0.8) / r + Math.sqrt(Math.max(0, 1 - (d / (r + 1)) ** 2)) * 0.6;
    const k = edge ? 0 : lit > 0.95 ? 5 : lit > 0.55 ? 4 : lit > 0.1 ? 3 : 2;
    cells.push([x, y, edge ? WM[0] : WM[Math.max(1, k - dark)]]);
  }
  return cells;
}

/** A crystal: a tall faceted shard with a lit face and a shaded face, a bright tip. */
function shard(b, x0, foot, hgt, col, light, lean = 0) {
  const C = [mix(col, '#1a1040', 0.55), mix(col, '#1a1040', 0.3), col, mix(col, light, 0.5), light];
  const half = Math.max(2, Math.round(hgt * 0.18));
  for (let y = foot - hgt; y < foot; y += 1) {
    const t = (y - (foot - hgt)) / 4; const hw = Math.min(half, t * half);
    const cx = x0 + (foot - y) * lean;
    for (let x = Math.floor(cx - hw); x <= cx + hw; x += 1) {
      const left = x + 0.5 < cx;
      const c = y - (foot - hgt) < 2 ? C[4] : left ? (x + 0.5 < cx - hw + 1.2 ? C[4] : C[3]) : (x + 0.5 > cx + hw - 1 ? C[0] : C[1]);
      b.set(x, y, c, 'crystal');
    }
  }
}

function paintCave(worm = true) {
  const out = pixelBuffer(W, H);
  const { px } = out;

  // a soft shadow round the crater and the glow of the crystals on the dust
  for (let y = 50; y < H; y += 1) for (let x = 0; x < W; x += 1) {
    const e = ((x + 0.5 - RIM.x - 3) / (RIM.ox + 2)) ** 2 + ((y + 0.5 - RIM.y - 3) / (RIM.oy + 2)) ** 2;
    if (e < 1 && e > 0.8 && bayer(x, y) < 0.5) px(x, y, 'rgba(30,20,60,0.25)');
  }

  // ---------- the crater ----------
  for (let y = RIM.y - RIM.oy - 1; y < Math.min(H, RIM.y + RIM.oy + 2); y += 1) for (let x = 0; x < W; x += 1) {
    const dx = (x + 0.5 - RIM.x); const dy = (y + 0.5 - RIM.y);
    const outer = (dx / RIM.ox) ** 2 + (dy / RIM.oy) ** 2; const inner = (dx / RIM.ix) ** 2 + (dy / RIM.iy) ** 2;
    if (outer > 1) continue;
    const b = bayer(x, y); const front = dy > 0;
    let c;
    if (inner > 1) {
      // the rim: how far across it, 0 at the inner edge .. 1 at the outer
      const t = clamp((Math.sqrt(inner) - 1) / (RIM.ox / RIM.ix - 1), 0, 1);
      const crest = Math.abs(t - 0.35) < 0.12;
      if (front) c = crest ? MG[8] : t < 0.35 ? (b < 0.5 ? MG[4] : MG[5]) : t > 0.85 ? MG[5] : MG[7]; // the outer slope faces us, lit
      else c = crest ? MG[7] : t < 0.35 ? (dx < 0 ? MG[4] : MG[6]) : (dx < 0 ? MG[5] : MG[6]); // we see the inside of the far rim
      if (vnoise(x, y, 5, 3) > 0.74) c = mix(c, MG[3], 0.4);
    } else {
      // the floor of the crater: in shade under the far rim on the left, lighter towards the front right
      const s = dx / RIM.ix * 0.6 + dy / RIM.iy * 0.8;
      c = s < -0.5 ? MG[3] : s < 0 ? (b < 0.5 ? MG[3] : MG[4]) : s < 0.5 ? MG[4] : MG[5];
      if (h2(x, y, 7) > 0.985) c = MG[7];
    }
    px(x, y, c);
  }
  // footprints across the crater floor to the door
  [[34, 88], [40, 92], [46, 89], [52, 93], [58, 90], [64, 94]].forEach(([x, y]) => grid(px, x, y, ['dd', 'dd', '.d'], { d: MG[2] }));

  const b = new Buf(W, H, 3);

  // ---------- the hill, with its cave ----------
  const hillTop = (x) => HILL.y - HILL.ry * Math.sqrt(Math.max(0, 1 - ((x + 0.5 - HILL.x) / HILL.rx) ** 2)) + (vnoise(x, 0, 6, 11) - 0.5) * 9 + Math.sin(x / 4) * 1.4;
  for (let x = HILL.x - HILL.rx; x <= HILL.x + HILL.rx; x += 1) {
    const top = Math.round(hillTop(x));
    for (let y = top; y < 92; y += 1) {
      const dx = (x + 0.5 - HILL.x) / HILL.rx; const dy = (y + 0.5 - HILL.y) / HILL.ry;
      if (y > 70 && (dx * dx + ((y - 70) / 22) ** 2 * 1.4) > 1) continue; // its base, inside the crater
      // a round rock dome lit from the upper left, in a few broad tones with a dithered seam between them
      const lump = vnoise(x, y, 12, 21);
      const lit = -dx * 1.05 - dy * 0.5 + (lump - 0.5) * 0.55 + 0.05;
      const lv = lit + (bayer(x, y) - 0.5) * 0.14;
      let c = lv > 0.6 ? RK[6] : lv > 0.2 ? RK[5] : lv > -0.25 ? RK[4] : lv > -0.7 ? RK[3] : RK[2];
      if (y - top < 2) c = dx < 0.45 ? RK[7] : RK[5]; // the sunlit brow
      if (y > 82) c = bayer(x, y) < 0.5 ? RK[3] : RK[2];
      // stony ledges that wrap round the dome: a dark crease with a lit lip above it
      for (const [ly, seed] of [[30, 1], [43, 2], [56, 3], [69, 4]]) {
        const yy = ly + (1 - dx * dx) * 5 + Math.sin(x / 7 + seed) * 1.2;
        if (vnoise(x, seed * 31, 10, 41) < 0.5) continue;
        if (Math.round(yy) === y) c = RK[2];
        else if (Math.round(yy) - 1 === y && dx < 0.35) c = RK[7];
        else if (Math.round(yy) + 1 === y && c !== RK[2]) c = RK[3];
      }
      b.set(x, y, c, 'rock');
    }
  }
  // pits in the rock
  [[60, 30, 3], [104, 26, 2.4], [70, 50, 2], [112, 58, 2.6], [50, 64, 2], [96, 44, 1.6]].forEach(([cx, cy, r]) => {
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let x = Math.floor(cx - r - 1); x <= cx + r + 1; x += 1) {
      if (!inEll(x, y, cx, cy, r + 0.8, r * 0.7)) continue;
      if (b.tag(x, y) !== 'rock') continue;
      b.set(x, y, inEll(x, y, cx, cy, r, r * 0.6) ? ((x - cx) + (y - cy) < 0 ? RK[2] : RK[4]) : RK[6], 'rock');
    }
  });
  // the cave mouth: a dark arch, a glow coming from deep inside, a lit stone lintel round it
  const inArch = (x, y, g = 0) => { const { x: cx, y: cy, w, h } = MOUTH; const r = w / 2 - g; if (y + 0.5 < cy - g || y + 0.5 > cy + h) return false; if (y + 0.5 < cy + r) return Math.hypot(x + 0.5 - cx, y + 0.5 - (cy + r)) <= r; return Math.abs(x + 0.5 - cx) <= r; };
  for (let y = MOUTH.y - 4; y < MOUTH.y + MOUTH.h; y += 1) for (let x = MOUTH.x - MOUTH.w / 2 - 4; x <= MOUTH.x + MOUTH.w / 2 + 4; x += 1) {
    if (inArch(x, y)) {
      const d = Math.hypot((x + 0.5 - MOUTH.x) / (MOUTH.w / 2), (y + 0.5 - (MOUTH.y + MOUTH.h)) / MOUTH.h);
      let c = d > 0.85 ? SKY[0] : d > 0.6 ? (bayer(x, y) < 0.5 ? SKY[1] : SKY[0]) : d > 0.35 ? '#241a52' : '#38287a';
      if (!inArch(x, y, 2) && x + 0.5 < MOUTH.x) c = SKY[0];
      b.set(x, y, c, 'dark');
    } else if (inArch(x, y, -3) && b.tag(x, y) === 'rock') b.set(x, y, (x + 0.5 < MOUTH.x || y < MOUTH.y + 4) ? RK[7] : RK[5], 'rock'); // the lintel
  }
  // the cave's violet light spills out onto the rock round its mouth
  for (let y = MOUTH.y - 9; y < MOUTH.y + MOUTH.h + 2; y += 1) for (let x = MOUTH.x - MOUTH.w / 2 - 9; x <= MOUTH.x + MOUTH.w / 2 + 9; x += 1) {
    if (b.tag(x, y) !== 'rock' || inArch(x, y, -3)) continue;
    if (inArch(x, y, -6) ? bayer(x, y) < 0.75 : inArch(x, y, -9) && bayer(x, y) < 0.3) b.set(x, y, mix(b.get(x, y), '#a08cf0', 0.28), 'rock');
  }
  // little crystals glowing deep inside
  grid((x, y, c) => b.set(x, y, c, 'glow'), MOUTH.x - 11, MOUTH.y + 12, ['.c....', 'cC..c.', 'cc.cCc'], { c: '#5ab8e0', C: '#c8f4ff' });
  grid((x, y, c) => b.set(x, y, c, 'glow'), MOUTH.x + 9, MOUTH.y + 11, ['.p.', 'pPp', 'pp.'], { p: '#c86ab0', P: '#ffd0f0' });
  // the doorstep: a flat stone with a little star mat on it
  for (let y = MOUTH.y + MOUTH.h - 1; y < MOUTH.y + MOUTH.h + 4; y += 1) for (let x = MOUTH.x - 18; x <= MOUTH.x + 18; x += 1) {
    if (!inEll(x, y, MOUTH.x, MOUTH.y + MOUTH.h + 1, 19, 3.5)) continue;
    b.set(x, y, y < MOUTH.y + MOUTH.h + 1 ? RK[6] : RK[4], 'rock');
  }
  // the tail's hole, round the side of the hill
  for (let y = TAIL.y - 3; y <= TAIL.y + 3; y += 1) for (let x = TAIL.x - 4; x <= TAIL.x + 4; x += 1) if (inEll(x, y, TAIL.x, TAIL.y, 4, 3)) b.set(x, y, inEll(x, y, TAIL.x, TAIL.y, 3, 2) ? SKY[0] : RK[7], 'dark');

  // ---------- the moon worm, asleep in its doorway (unless it's out giving the buddy a ride) ----------
  // a body puff behind its head, in the shade of the cave
  if (worm) puffShape(8, 1).forEach(([x, y, c]) => b.set(HEAD.x + 4 + x, HEAD.y - 6 + y, c, 'worm'));
  if (worm) puffShape(HEAD.r).forEach(([x, y, c]) => b.set(HEAD.x + x, HEAD.y + y, c, 'worm'));
  // antennae drooping sleepily, with dim bulbs
  if (worm) [[-1, 1], [1, 1]].forEach(([s]) => { for (let k = 0; k < 6; k += 1) b.set(HEAD.x + s * (2 + Math.round(k * 0.8)), HEAD.y - HEAD.r - k + (k > 3 ? (k - 3) * 2 : 0), WM[1], 'worm'); });
  if (worm) [[HEAD.x - 7, HEAD.y - 13], [HEAD.x + 7, HEAD.y - 13]].forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'bulb'), x - 1, y - 1, ['.y.', 'yYy', '.y.'], { y: '#c8a040', Y: '#f0d070' }));
  // the tip of its tail, with a fluffy tuft
  if (worm) puffShape(3.2).forEach(([x, y, c]) => b.set(TAIL.x + 3 + x, TAIL.y - 1 + y, c, 'worm'));
  if (worm) grid((x, y, c) => b.set(x, y, c, 'worm'), TAIL.x + 5, TAIL.y - 7, ['.w.w', 'wWw.', '.ww.'], { w: WM[4], W: WM[5] });

  // ---------- crystals all over ----------
  CRYSTALS.forEach(([x, foot, hgt, col, light], i) => shard(b, x, foot, hgt, col, light, i % 3 === 1 ? 0.18 : i % 3 === 2 ? -0.15 : 0));
  // a tiny sign by the door: a z on a post, "asleep, please knock softly"
  for (let y = 80; y < 92; y += 1) { b.set(108, y, '#c8884a', 'sign'); b.set(109, y, '#8a5a2a', 'sign'); }
  grid((x, y, c) => b.set(x, y, c, 'sign'), 103, 74, ['bbbbbbbbbbbb', 'bwwwwwwwwwwb', 'bwkkkwwkkkwb', 'bwwkwwwwkwwb', 'bwkkkwwkkkwb', 'bbbbbbbbbbbb'], { b: '#8a5a2a', w: '#fff4d8', k: '#5a46a0' });

  b.outline((t, side) => {
    const m = String(t).split(':')[0];
    if (m === 'dark' || m === 'glow' || m === 'bulb') return null;
    if (m === 'worm') return null;
    if (m === 'crystal') return side === 'bottom' || side === 'right' ? '#2a2058' : '#3a3070';
    if (m === 'sign') return '#4a2a1a';
    return side === 'bottom' ? INK : side === 'right' ? RK[1] : RK[2];
  });
  // the sleeping face, over the outline pass: closed eyes, rosy cheeks, a little smile
  if (worm) EYES.forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'face'), x - 2, y, ['o...o', '.ooo.'], { o: WM[0] }));
  if (worm) [[HEAD.x - 7, HEAD.y + 2], [HEAD.x + 5, HEAD.y + 2]].forEach(([x, y]) => grid((xx, yy, c) => b.set(xx, yy, c, 'face'), x, y, ['pP'], { p: '#f08ac8', P: '#ffb4dc' }));
  if (worm) grid((x, y, c) => b.set(x, y, c, 'face'), HEAD.x - 1, HEAD.y + 3, ['o.o', '.o.'], { o: WM[0] });
  b.blit(px, 0, 0);
  // the crystals' soft glow
  CRYSTALS.forEach(([x, foot, hgt, col]) => {
    const r = hgt * 0.55; const cy = foot - hgt * 0.45;
    for (let y = Math.floor(cy - r); y <= cy + r; y += 1) for (let xx = Math.floor(x - r); xx <= x + r; xx += 1) {
      const d = Math.hypot(xx + 0.5 - x, (y + 0.5 - cy) * 0.9) / r;
      if (d > 1 || d < 0.35 || bayer(xx, y) > (1 - d) * 0.9) continue;
      const [rr, gg, bb] = [1, 3, 5].map((k) => parseInt(col.slice(k, k + 2), 16));
      px(xx, y, `rgba(${rr},${gg},${bb},0.18)`);
    }
  });
  return new ImageData(out.data, W, H);
}

let base = null; let empty = null;
const caveBase = () => (base ||= paintCave());
const emptyCave = () => (empty ||= paintCave(false));

/**
 * Starts the cave on its canvas. Returns step(now), to call every animation frame; it redraws
 * about ten times a second. host.dataset.wake (a performance.now() time) wakes the worm for a
 * while: it pops out of its cave, opens its big eyes, lights its antennae and wiggles hello.
 * While the map's show plays (the village has .show-on) the worm is out giving the buddy a ride,
 * so the cave stands empty.
 */
export function startCave(canvas, host) {
  const ctx = canvas.getContext('2d');
  const img = caveBase();
  let last = -1;
  const dot = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const sprite = (rows, X, Y, pal) => rows.forEach((r, y) => { for (let x = 0; x < r.length; x += 1) { const c = pal[r[x]]; if (c) dot(X + x, Y + y, c); } });
  const puff = (cx, cy, r, dark = 0) => puffShape(r, dark).forEach(([x, y, c]) => dot(Math.round(cx) + x, Math.round(cy) + y, c));
  return (now) => {
    const f = Math.floor(now / 100);
    if (f === last) return;
    last = f;
    const t = now / 1000;
    const since = now - Number(host?.dataset.wake || -1e9);
    const away = !!host?.closest?.('.village')?.classList.contains('show-on');
    const awake = since > -100 && since < 4500 && !away;
    ctx.putImageData(away ? emptyCave() : img, 0, 0);

    // the cave breathes its soft violet glow
    const g = 0.5 + 0.5 * Math.sin(t * 1.2);
    ctx.fillStyle = `rgba(150,120,255,${(0.06 + g * 0.08 + (awake ? 0.1 : 0)).toFixed(3)})`;
    for (let y = MOUTH.y + 6; y < MOUTH.y + MOUTH.h - 1; y += 1) { const hw = Math.round(Math.min(MOUTH.w / 2 - 2, (y - MOUTH.y) * 1.4)); ctx.fillRect(MOUTH.x - hw, y, hw * 2, 1); }

    // moon dust drifting up, slowly
    MOTES.forEach(([x0, y0, sp], i) => {
      const p = ((t * sp * 6 + y0) % 70) / 70;
      const x = x0 + Math.sin(t * 0.7 + i) * 3; const y = 88 - p * 86;
      const a = Math.sin(p * Math.PI) * (awake ? 0.95 : 0.7);
      dot(x, y, `rgba(${i % 3 ? '230,230,255' : '255,240,200'},${a.toFixed(2)})`);
    });

    // the crystals glint, one after another
    for (let k = 0; k < (awake ? 5 : 2); k += 1) {
      const p = (t * 0.7 + k * 0.37) % 1;
      if (p > 0.32) continue;
      const [x, foot, hgt] = CRYSTALS[(Math.floor(t * 0.7 + k * 0.37) * 5 + k * 3) % CRYSTALS.length];
      const y = foot - hgt + 2; const s = p < 0.16 ? 2 : 1;
      dot(x, y, '#ffffff');
      for (let d = 1; d <= s; d += 1) { dot(x - d, y, 'rgba(255,255,255,0.7)'); dot(x + d, y, 'rgba(255,255,255,0.7)'); dot(x, y - d, 'rgba(255,255,255,0.7)'); dot(x, y + d, 'rgba(255,255,255,0.7)'); }
    }

    if (away) return;
    if (!awake) {
      // asleep: it breathes, the tail tip wiggles now and then, it dreams in z's
      if (Math.sin(t * 1.3) > 0.4) {
        ctx.fillStyle = WM[0]; ctx.fillRect(HEAD.x - 4, HEAD.y - HEAD.r - 2, 9, 1);
        ctx.fillStyle = WM[4]; ctx.fillRect(HEAD.x - 3, HEAD.y - HEAD.r - 1, 7, 1);
      }
      const wig = (t % 6) < 1.2 ? Math.round(Math.sin(t * 14)) : 0;
      if (wig) { puff(TAIL.x + 3, TAIL.y - 1 + wig, 3.2); sprite(['.w.w', 'wWw.', '.ww.'], TAIL.x + 5 + wig, TAIL.y - 7 + wig, { w: WM[4], W: WM[5] }); }
      // every so often it opens one eye to peek, then goes back to sleep
      const peek = (t % 9.5) > 7.6 && (t % 9.5) < 8.8;
      if (peek) sprite(['.ooo.', 'oWWko', 'oWkko', '.ooo.'], EYES[1][0] - 2, EYES[1][1] - 2, { o: WM[0], W: '#ffffff', k: '#1a1030' });
      for (let k = 0; k < 3; k += 1) {
        const p = (t / 4.5 + k / 3) % 1;
        if (p > 0.85 || peek) continue;
        const x = Math.round(HEAD.x + 10 + p * 14 + Math.sin(p * 9) * 2); const y = Math.round(HEAD.y - 14 - p * 30);
        const a = (0.95 - p * 0.7).toFixed(2);
        sprite(p > 0.35 ? ['zzzz', '...z', '..z.', '.z..', 'zzzz'] : ['zzz', '..z', '.z.', 'zzz'], x, y, { z: `rgba(236,230,255,${a})` });
      }
      return;
    }

    // awake: it pops out of the cave in a big arch, wiggling, and says hello
    const up = clamp(since / 500, 0, 1) * (since > 4000 ? clamp((4500 - since) / 500, 0, 1) : 1);
    const wob = Math.sin(t * 6) * 3 * up;
    const segs = [];
    for (let k = 0; k <= 5; k += 1) {
      const u = k / 5;
      segs.push([HEAD.x + Math.sin(u * 2.2) * 6 * up + wob * u * u, HEAD.y + 2 - u * 42 * up, 9 - u * 1.2]);
    }
    segs.forEach(([x, y, r], k) => { if (k < segs.length - 1) puff(x, y, r, k % 2); });
    const [hx, hy] = segs[segs.length - 1];
    puff(hx, hy, 10.5);
    // antennae, standing up, bulbs glowing
    [[-1], [1]].forEach(([s]) => {
      for (let k = 0; k < 7; k += 1) dot(hx + s * (3 + k * 0.6) + Math.sin(t * 8 + s) * (k / 7), hy - 10 - k, WM[1]);
      const bx = Math.round(hx + s * 7.5 + Math.sin(t * 8 + s)); const by = Math.round(hy - 18);
      ctx.fillStyle = 'rgba(255,230,120,0.35)'; ctx.fillRect(bx - 2, by - 2, 5, 5);
      sprite(['.y.', 'yYy', '.y.'], bx - 1, by - 1, { y: '#ffd43b', Y: '#fffbe0' });
    });
    // big round eyes (blinking now and then), rosy cheeks, a happy open smile
    const blink = since > 1400 && (since % 1700) < 130;
    [[-5, 0], [5, 0]].forEach(([dx]) => {
      const ex = Math.round(hx + dx) - 3; const ey = Math.round(hy) - 4;
      if (blink) sprite(['ooooo'], ex + 1, ey + 3, { o: WM[0] });
      else sprite(['.ooo.', 'oWWWo', 'oWkKo', 'oWkko', '.ooo.'], ex + 1, ey + 1, { o: WM[0], W: '#ffffff', k: '#1a1030', K: '#ffffff' });
    });
    sprite(['pP', ''], Math.round(hx) - 9, Math.round(hy) + 3, { p: '#f08ac8', P: '#ffb4dc' });
    sprite(['Pp'], Math.round(hx) + 7, Math.round(hy) + 3, { p: '#f08ac8', P: '#ffb4dc' });
    sprite(['o...o', 'oRRRo', '.oPo.'], Math.round(hx) - 2, Math.round(hy) + 3, { o: WM[0], R: '#c83a7a', P: '#ff8ab8' });
    // a burst of sparkles as it pops out
    if (since < 1500) {
      const u = since / 1500;
      for (let k = 0; k < 10; k += 1) {
        const a = (k / 10) * Math.PI * 2 + 0.3; const r = 6 + u * 26;
        const x = MOUTH.x + Math.cos(a) * r; const y = MOUTH.y + 8 + Math.sin(a) * r * 0.6;
        dot(x, y, k % 2 ? `rgba(255,240,160,${(1 - u).toFixed(2)})` : `rgba(200,240,255,${(1 - u).toFixed(2)})`);
      }
    }
  };
}
