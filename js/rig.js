// The live buddy: the pixel sprite from avatar.js cut into parts (ears, head, body,
// feet, tail, plus little arms), with eyes and brows drawn here so they can move.
// A Brain eases a few feelings (mood, energy, sleepy, surprise, ...) and turns them
// into a pose; render() draws the pose into a 24 x 24 grid of colors.
// The look is "style A": parts move in whole pixels and turn only in big steps
// (45 degrees for arms, 30 for ears and tails), and the pose changes 12 times a
// second (see live.js), like a hand-drawn 16-bit sprite. No DOM here.
import { speciesGrid, itemArt, backgroundCells, liveLook, wandCells, OUT, SIZE, SPRITE_X, SPRITE_Y } from './avatar.js';

// ---------- letter grids to colors (the same 16-bit shading rule as avatar.js) ----------
function resolve(rows, pal, shade = {}) {
  return rows.map((row, y) => [...row].map((ch, x) => {
    if (ch === '.' || ch === ' ') return null;
    let col = ch === 'K' ? OUT : pal[ch];
    let sh = shade[ch];
    if (Array.isArray(col)) { sh = col[1]; col = col[0]; }
    if (!col) return null;
    if (sh) {
      const at = (dx, dy) => (rows[y + dy] || '')[x + dx];
      if (at(1, 0) === 'K' || at(0, 1) === 'K') col = sh[1];
      else if (at(-1, 0) === 'K' || at(0, -1) === 'K') col = sh[0];
    }
    return col;
  }));
}

/** A part: colors c[y][x], its top-left corner in the 24 x 24 scene, and the point it turns around. */
function part(c, x, y, pivot) {
  const h = c.length; const w = c[0]?.length || 0;
  return { c, w, h, x, y, pivot: pivot || [x + w / 2, y + h / 2] };
}

function slice(colors, r0, r1, c0, c1, keep, ox, oy) {
  const rows = [];
  for (let y = r0; y <= r1; y += 1) {
    const row = [];
    for (let x = c0; x <= c1; x += 1) row.push(keep(x, y) ? (colors[y]?.[x] ?? null) : null);
    rows.push(row);
  }
  return part(rows, ox + c0, oy + r0);
}

// Scale2x three times: turned parts are sampled from this 8x copy, so a turned
// arm or tail keeps clean pixel edges instead of jagged holes.
function scale2x(c, w, h) {
  const out = Array.from({ length: h * 2 }, () => Array(w * 2).fill(null));
  const g = (x, y) => (x < 0 || y < 0 || x >= w || y >= h ? null : c[y][x]);
  for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) {
    const E = g(x, y); const B = g(x, y - 1); const D = g(x - 1, y); const F = g(x + 1, y); const H = g(x, y + 1);
    let e0 = E; let e1 = E; let e2 = E; let e3 = E;
    if (B !== H && D !== F) { e0 = D === B ? D : E; e1 = B === F ? F : E; e2 = D === H ? D : E; e3 = H === F ? F : E; }
    out[y * 2][x * 2] = e0; out[y * 2][x * 2 + 1] = e1; out[y * 2 + 1][x * 2] = e2; out[y * 2 + 1][x * 2 + 1] = e3;
  }
  return out;
}
function up8(p) {
  if (!p.c8) {
    let c = p.c; let w = p.w; let h = p.h;
    for (let i = 0; i < 3; i += 1) { c = scale2x(c, w, h); w *= 2; h *= 2; }
    p.c8 = c;
  }
  return p.c8;
}

// ---------- 2D transforms: [a, b, c, d, e, f] maps (x, y) to (a x + c y + e, b x + d y + f) ----------
const I = [1, 0, 0, 1, 0, 0];
const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x, y) => [1, 0, 0, 1, x, y];
const about = ([px, py], deg = 0, sx = 1, sy = 1) => {
  const r = (deg * Math.PI) / 180; const co = Math.cos(r); const si = Math.sin(r);
  return mul(T(px, py), mul([co * sx, si * sx, -si * sy, co * sy, 0, 0], T(-px, -py)));
};
const inv = (m) => {
  const det = m[0] * m[3] - m[1] * m[2];
  const a = m[3] / det; const b = -m[1] / det; const c = -m[2] / det; const d = m[0] / det;
  return [a, b, c, d, -(a * m[4] + c * m[5]), -(b * m[4] + d * m[5])];
};
const ap = (m, x, y) => [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]];
const snap = (a, step) => Math.round(a / step) * step;

// ---------- cutting a buddy into parts ----------
const MOUTHS = ['happy', 'excited', 'proud', 'sleepy', 'sad', 'o'];

/** Builds the parts for a buddy ({ species, outfit }). opts.background: false for no background. */
export function buildRig(buddy, opts = {}) {
  const look = liveLook(buddy);
  const species = look.species;
  const base = speciesGrid(species, 'happy');
  const L = base.lift; const W = base.grid[0].length;
  const ox = SPRITE_X; const oy = SPRITE_Y - L;
  const isDino = species === 'dino';
  const earKind = { fox: 'pointed', cat: 'pointed', bear: 'round', panda: 'round', dino: 'plates' }[species];
  const hasTail = ['fox', 'cat', 'puppy', 'dino'].includes(species);

  // the rig draws the eyes, so take them out of the sprite
  const wipe = (rows) => rows.map((r, y) => ((y >= L + 5 && y <= L + 7)
    ? [...r].map((ch) => ch).map((ch, x) => {
      if (ch !== 'E' && ch !== 'H') return ch;
      const above = rows[L + 5][x];
      return 'OQWD'.includes(above) ? above : 'O';
    }).join('') : r));

  // one head per mouth, taken from the sprite's own mood drawings
  const variant = (mouth) => {
    const src = mouth === 'o' ? speciesGrid(species, isDino ? 'excited' : 'sleepy').grid : speciesGrid(species, mouth).grid;
    const rows = wipe(base.grid).slice();
    for (let y = L + 8; y <= L + 10; y += 1) rows[y] = src[y].replace('B', 'W');
    if (mouth === 'o' && !isDino) {
      const r9 = [...rows[L + 9]]; r9[7] = 'M'; r9[8] = 'M'; rows[L + 9] = r9.join('');
    }
    return resolve(rows, base.pal, base.shade);
  };
  const colors = {};
  for (const m of MOUTHS) colors[m] = variant(m);

  const headTop = earKind ? L + 3 : 0;
  const isTail = (x, y) => {
    if (!hasTail) return false;
    if (isDino) return (y >= L + 11 && x >= 13) || (y >= L + 8 && y <= L + 10 && x >= 16);
    return y >= L + 12 && y <= L + 14 && x >= 13;
  };
  const all = () => true;
  const headPivot = [ox + 8, oy + L + 11];
  const heads = {};
  for (const m of MOUTHS) {
    heads[m] = slice(colors[m], headTop, L + 11, 0, W - 1, (x, y) => !isTail(x, y), ox, oy);
    heads[m].pivot = headPivot;
  }
  const c0 = colors.happy;

  const ears = [];
  if (earKind === 'plates') {
    const crest = slice(c0, 0, L + 2, 0, W - 1, (x) => x < 16, ox, oy);
    crest.pivot = [ox + 8, oy + L + 3]; crest.side = 0;
    ears.push(crest);
  } else if (earKind) {
    const l = slice(c0, 0, 2, 0, 7, all, ox, oy); l.pivot = [ox + 3, oy + 3]; l.side = -1;
    const r = slice(c0, 0, 2, 8, 15, all, ox, oy); r.pivot = [ox + 13, oy + 3]; r.side = 1;
    ears.push(l, r);
  }

  const body = slice(c0, L + 12, L + 14, 0, W - 1, (x, y) => !isTail(x, y), ox, oy);
  body.pivot = [ox + 8, oy + L + 15];
  const footL = slice(c0, L + 15, L + 15, 0, 7, (x, y) => !isTail(x, y), ox, oy);
  const footR = slice(c0, L + 15, L + 15, 8, W - 1, (x, y) => !isTail(x, y), ox, oy);
  let tail = null;
  if (hasTail) {
    tail = slice(c0, L + 8, L + 15, 0, W - 1, isTail, ox, oy);
    tail.pivot = [ox + 13, oy + L + 14];
  }

  // arms: a little stick in fur color, turning at the shoulder (0 degrees hangs down)
  const fur = base.pal.D && species === 'panda' ? base.pal.D : base.pal.O;
  const furDark = species === 'panda' ? '#1d1924' : (base.shade?.O || [fur, fur])[1];
  const armC = ['KOK', 'KOK', 'KOK', 'KoK', '.K.'].map((r) => [...r].map((ch) => (ch === 'K' ? OUT : ch === 'O' ? fur : ch === 'o' ? furDark : null)));
  const armL = part(armC, ox + 2, oy + L + 12, [ox + 3.5, oy + L + 12.5]);
  const armR = part(armC.map((r) => r.slice().reverse()), ox + 11, oy + L + 12, [ox + 12.5, oy + L + 12.5]);

  const scene = (cells) => (cells ? part(cells, 0, 0) : null);
  const item = (id) => { const a = id && itemArt(id); return a ? { ...part(a.c, 0, 0), behind: a.behind } : null; };

  return {
    species, heads, ears, body, footL, footR, tail, armL, armR,
    hat: item(look.hat), face: item(look.face), neck: item(look.neck), neckFront: item(look.neckFront),
    wand: look.wand,
    music: look.music && { behind: scene(look.music.behind), front: scene(look.music.front), flames: look.music.flames.map(scene) },
    gear: look.gear && { ...scene(look.gear.c), kind: look.gear.kind, held: look.gear.held },
    bg: opts.background === false ? null : backgroundCells(look.background),
    eyeL: [ox + 4, oy + L + 6], eyeR: [ox + 10, oy + L + 6],
    lid: (base.shade?.O || [base.pal.O, base.pal.O])[1],
  };
}

// ---------- eyes and brows ----------
// rows from the eye's top-left pixel: K outline, H shine, L eyelid (fur shadow), R red
const EYES = {
  open: { at: [0, 0], rows: ['KH', 'KK'] },
  wide: { at: [-1, -1], rows: ['.KK.', 'KKHK', 'KKKK', '.KK.'] },
  half: { at: [0, 0], rows: ['LL', 'KH'] },
  closed: { at: [0, 1], rows: ['KK'] },
  happy: { at: [-1, 0], rows: ['.KK.', 'K..K'] },
  sleep: { at: [-1, 1], rows: ['K..K', '.KK.'] },
  dizzy: { at: [-1, -1], rows: ['K.K', '.K.', 'K.K'] },
};

function drawFace(rig, bmp, f) {
  const hx = rig.heads.happy.x; const hy = rig.heads.happy.y;
  const put = (sx, sy, col) => {
    const x = Math.round(sx - hx); const y = Math.round(sy - hy);
    if (y >= 0 && y < bmp.length && x >= 0 && x < bmp[0].length) bmp[y][x] = col;
  };
  const glyph = EYES[f.eye] || EYES.open;
  const moves = ['open', 'wide', 'half'].includes(f.eye);
  const lx = moves ? f.lookX : 0; const ly = moves ? f.lookY : 0;
  for (const [ex, ey] of [rig.eyeL, rig.eyeR]) {
    glyph.rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      const col = ch === 'K' ? OUT : ch === 'H' ? '#ffffff' : ch === 'R' ? '#f03e3e' : rig.lid;
      put(ex + glyph.at[0] + i + lx, ey + glyph.at[1] + j + ly, col);
    }));
  }
  // brows: brow > 0 worried (inner ends up), < 0 determined (inner ends down), browUp raised
  if (Math.abs(f.brow) > 0.35 || f.browUp) {
    const [lx0, ly0] = rig.eyeL; const [rx0, ry0] = rig.eyeR;
    const top = f.eye === 'wide' ? -3 : -2;
    const up = f.browUp ? 1 : 0;
    if (f.brow > 0.35) {
      put(lx0, ly0 + top + 1 - up, OUT); put(lx0 + 1, ly0 + top - up, OUT);
      put(rx0 + 1, ry0 + top + 1 - up, OUT); put(rx0, ry0 + top - up, OUT);
    } else if (f.brow < -0.35) {
      put(lx0, ly0 + top, OUT); put(lx0 + 1, ly0 + top + 1, OUT);
      put(rx0 + 1, ry0 + top, OUT); put(rx0, ry0 + top + 1, OUT);
    } else {
      put(lx0, ly0 + top - up, OUT); put(lx0 + 1, ly0 + top - up, OUT);
      put(rx0, ry0 + top - up, OUT); put(rx0 + 1, ry0 + top - up, OUT);
    }
  }
  if (f.blush) { put(rig.eyeL[0] - 1, rig.eyeL[1] + 2, '#ff8fa3'); put(rig.eyeR[0] + 2, rig.eyeR[1] + 2, '#ff8fa3'); }
  if (f.tear) put(rig.eyeL[0], rig.eyeL[1] + 2 + (f.tear % 2), '#4dabf7');
}

const FX = {
  note: { rows: ['.KK', '.KK', '.K.', 'KK.', 'KK.'], pal: { K: '#5f3dc4' } },
  note2: { rows: ['KKKK', 'K..K', 'K..K', 'KK.KK', 'KK.KK'], pal: { K: '#c2255c' } },
  z: { rows: ['KKK', '.K.', 'KKK'], pal: { K: '#4c6ef5' } },
  Z: { rows: ['KKKK', '..K.', '.K..', 'KKKK'], pal: { K: '#4c6ef5' } },
  bang: { rows: ['KK', 'KK', 'KK', '..', 'KK'], pal: { K: '#e03131' } },
  what: { rows: ['.KK.', 'K..K', '..K.', '.K..', '....', '.K..'], pal: { K: '#1c7ed6' } },
  sparkle: { rows: ['.Y.', 'YWY', '.Y.'], pal: { Y: '#ffd43b', W: '#fff9db' } },
  heart: { rows: ['RR.RR', 'RRRRR', '.RRR.', '..R..'], pal: { R: '#f03e3e' } },
  sweat: { rows: ['.B', 'BB', 'BW'], pal: { B: '#4dabf7', W: '#d0ebff' } },
};

function darken(hex, t) {
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
}

/** Paints a see-through color over another: solid where there is something under it, else '#rrggbbaa'. */
function blend(under, c, a) {
  if (a >= 1) return c;
  if (!under) return c + Math.round(a * 255).toString(16).padStart(2, '0');
  const u = under.slice(0, 7);
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(u.slice(i, i + 2), 16) * (1 - a) + parseInt(c.slice(i, i + 2), 16) * a).toString(16).padStart(2, '0')).join('');
}

/**
 * Draws a pose. Returns 24 x 24 colors, row by row (null where nothing is drawn).
 * A color can be '#rrggbbaa' where something see-through (the wand's glow) has
 * nothing under it. Parts move in whole pixels; arms turn in 45 degree steps,
 * ears and tails in 30. opts.wand: how much of today's chores are done (0 to 1),
 * for the magic wand's glow.
 */
export function render(rig, pose, frame = 0, opts = {}) {
  const N = SIZE;
  const buf = new Array(N * N).fill(null);
  const draw = (p, m, c = p.c) => {
    if (!p) return;
    const im = inv(m);
    const pts = [[0, 0], [p.w, 0], [0, p.h], [p.w, p.h]].map(([x, y]) => ap(m, p.x + x, p.y + y));
    const x0 = Math.max(0, Math.floor(Math.min(...pts.map((v) => v[0]))) - 1);
    const x1 = Math.min(N - 1, Math.ceil(Math.max(...pts.map((v) => v[0]))) + 1);
    const y0 = Math.max(0, Math.floor(Math.min(...pts.map((v) => v[1]))) - 1);
    const y1 = Math.min(N - 1, Math.ceil(Math.max(...pts.map((v) => v[1]))) + 1);
    const turned = Math.abs(m[1]) > 1e-6 || Math.abs(m[2]) > 1e-6;
    const c8 = turned ? up8(c === p.c ? p : { ...p, c, c8: null }) : null;
    for (let y = y0; y <= y1; y += 1) for (let x = x0; x <= x1; x += 1) {
      const [sx, sy] = ap(im, x + 0.5, y + 0.5);
      const u = sx - p.x; const v = sy - p.y;
      const col = turned ? c8[Math.floor(v * 8)]?.[Math.floor(u * 8)] : c[Math.floor(v)]?.[Math.floor(u)];
      if (col) buf[y * N + x] = col;
    }
  };
  const q = Math.round;

  if (rig.bg) for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) buf[y * N + x] = rig.bg[y][x];
  const rootX = q(pose.root.dx); const rootY = q(pose.root.dy);
  if (rig.bg) {
    // the shadow shrinks as the buddy jumps
    const w = Math.max(6, 10 + Math.min(0, rootY));
    for (let x = q(12 - w / 2 + rootX); x < 12 + w / 2 + rootX; x += 1) if (x >= 0 && x < N) buf[23 * N + x] = darken(buf[23 * N + x] || '#74d474', 0.2);
  }
  if (rig.music) draw(rig.music.behind, I);

  const root = T(rootX, rootY);
  const stretch = q(pose.body.stretch);
  const widen = q(pose.body.widen * 2) / 2;
  const bodyM = mul(root, about(rig.body.pivot, 0, 1 + widen * 0.12, (rig.body.h + stretch) / rig.body.h));
  const neckM = mul(root, T(0, -stretch));
  // a head turn shows as a shift: turning a face this small looks rough
  const headM = mul(neckM, T(q(pose.head.dx) + q(pose.head.rot / 9), q(pose.head.dy)));
  const head = rig.heads[pose.face.mouth] || rig.heads.happy;
  const hb = head.c.map((r) => r.slice());
  drawFace(rig, hb, pose.face);
  const armM = (arm, a) => mul(neckM, about(arm.pivot, snap(a.rot, 45)));
  const arms = [[rig.armL, pose.armL], [rig.armR, pose.armR]];
  const showArm = (a) => Math.abs(snap(a.rot, 45)) > 0;

  if (rig.neck?.behind) draw(rig.neck, neckM);
  // the dino's big tail breaks apart when it turns, so it swishes side to side instead
  if (rig.tail) draw(rig.tail, mul(root, rig.species === 'dino' ? T(q(pose.tail.rot / 25), 0) : about(rig.tail.pivot, snap(pose.tail.rot, 30))));
  draw(rig.footL, mul(root, T(q(pose.footL.dx || 0), q(pose.footL.dy))));
  draw(rig.footR, mul(root, T(q(pose.footR.dx || 0), q(pose.footR.dy))));
  draw(rig.body, bodyM);
  if (rig.gear?.kind === 'shoes') draw(rig.gear, root);
  rig.ears.forEach((e) => {
    const ep = e.side === 1 ? pose.earR : pose.earL;
    draw(e, mul(headM, mul(T(0, q(ep.dy)), about(e.pivot, (e.side || 0) * snap(ep.rot, 30)))));
  });
  draw(head, headM, hb);
  if (rig.neck && !rig.neck.behind) draw(rig.neck, neckM);
  if (rig.neckFront) draw(rig.neckFront, neckM);
  if (rig.face) draw(rig.face, headM);
  if (rig.hat) draw(rig.hat, headM);
  if (rig.wand) {
    // held at the side, moving with the body
    const wx = q(neckM[4]); const wy = q(neckM[5]);
    for (const { x, y, c, a } of wandCells(opts.wand, rig.wand.side, frame)) {
      const X = x + wx; const Y = y + wy;
      if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
      buf[Y * N + X] = blend(buf[Y * N + X], c, a);
    }
  }
  for (const [arm, a] of arms) if (showArm(a)) draw(arm, armM(arm, a));
  if (rig.gear && rig.gear.kind !== 'shoes') draw(rig.gear, rig.gear.held ? neckM : I);
  if (rig.music) {
    draw(rig.music.front, I);
    if (rig.music.flames.length) draw(rig.music.flames[frame % rig.music.flames.length], I);
  }
  for (const fx of pose.fx || []) {
    const g = FX[fx.kind];
    if (!g) continue;
    draw(part(g.rows.map((r) => [...r].map((ch) => (ch === '.' ? null : g.pal[ch] || OUT))), q(fx.x), q(fx.y)), I);
  }
  return buf;
}

// ---------- the brain: feelings in, a pose out ----------
const ease = (cur, target, dt, speed) => cur + (target - cur) * (1 - Math.exp(-speed * dt));
function rand(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }

/** Every feeling at rest. valence is -1 (sad) to 1 (happy); the rest are 0 to 1. */
export const CALM = { valence: 0.5, arousal: 0.5, sleep: 0, surprise: 0, curious: 0, listen: 0, dance: 0, focus: 0, cheer: 0, kick: 0, sing: 0, pat: 0, giggle: 0, hop: 0, dizzy: 0 };
const SPEED = { surprise: 12, kick: 18, cheer: 10, hop: 20, giggle: 12, pat: 10 };
const HOLD = { surprise: 0.7, kick: 0.45, hop: 0.12, giggle: 0.6, pat: 1.2, dizzy: 1.4, cheer: 1.6 };

export class Brain {
  constructor(seed = 1) {
    this.r = rand(seed * 7919 + 13);
    this.s = { ...CALM };
    this.target = { ...CALM };
    this.pending = [];
    this.release = {};
    this.nextBlink = 1 + this.r() * 2; this.blinkUntil = 0;
    this.wander = [0, 0]; this.wanderAt = 0;
    this.twitchUntil = 0; this.nextTwitch = 2 + this.r() * 3; this.twitchSide = 1;
    this.personality = this.r();
  }

  /** Sets where feelings are heading; they ease there. */
  set(targets) { Object.assign(this.target, targets); }

  /** Jumps straight to the targets (a buddy that just appeared). */
  settle() { Object.assign(this.s, this.target); }

  /** A short burst of a feeling, which then fades back to 0. */
  impulse(k, v = 1, hold = HOLD[k] || 0.3) { this.pending.push([k, v, hold]); }

  /**
   * t, dt in seconds. inputs: { beat: { index, phase } | null, lookAt: [x, y] in the 24 x 24 scene | null, notes: bool }
   */
  pose(t, dt, inputs = {}) {
    const s = this.s; const r = this.r;
    for (const [k, v, hold] of this.pending) { s[k] = v; this.target[k] = v; this.release[k] = t + hold; }
    this.pending = [];
    for (const [k, until] of Object.entries(this.release)) if (t > until) { this.target[k] = 0; delete this.release[k]; }
    for (const k of Object.keys(s)) s[k] = ease(s[k], this.target[k], dt, SPEED[k] || 5);
    const v = s.valence; const a = s.arousal; const sleep = s.sleep;
    const beat = inputs.beat;

    // where it looks: a finger, or around now and then
    if (t > this.wanderAt) { this.wander = [Math.round((r() - 0.5) * 2.4), r() < 0.3 ? -1 : 0]; this.wanderAt = t + 1 + r() * 2.5; }
    let look = [0, 0];
    if (inputs.lookAt) {
      const dx = inputs.lookAt[0] - 12; const dy = inputs.lookAt[1] - 12;
      look = [Math.abs(dx) > 2.5 ? Math.sign(dx) : 0, dy < -4 ? -1 : dy > 6 ? 1 : 0];
    } else if (s.curious > 0.3 || (a > 0.3 && sleep < 0.3 && s.listen < 0.4 && s.dance < 0.4)) {
      look = this.wander;
    }
    if (t > this.nextBlink) { this.blinkUntil = t + 0.12; this.nextBlink = t + 1.8 + r() * 3; }
    const blinking = t < this.blinkUntil;

    let eye = 'open';
    if (sleep > 0.6) eye = 'sleep';
    else if (sleep > 0.25 || a < 0.2) eye = 'half';
    if (s.listen > 0.5 && s.dance < 0.5) eye = 'happy';
    if (s.cheer > 0.5 || s.giggle > 0.4 || s.pat > 0.4) eye = 'happy';
    if (v > 0.75 && a > 0.75 && s.dance > 0.5 && beat && beat.index % 4 === 3) eye = 'happy';
    if (s.dizzy > 0.5) eye = 'dizzy';
    if (s.surprise > 0.45) eye = 'wide';
    if (blinking && (eye === 'open' || eye === 'half' || eye === 'wide')) eye = 'closed';

    let mouth = 'sleepy';
    if (v > 0.15) mouth = 'happy';
    if (v > 0.55 && a > 0.65) mouth = 'excited';
    if (s.cheer > 0.5 || s.giggle > 0.4 || s.dizzy > 0.5) mouth = 'excited';
    if (v < -0.3) mouth = 'sad';
    if (s.focus > 0.5) mouth = 'proud';
    if (s.surprise > 0.45) mouth = 'o';
    if (s.sing > 0.5 && beat) mouth = beat.index % 2 ? 'o' : 'happy';
    if (sleep > 0.7) mouth = Math.sin(t * 1.4) > 0.6 ? 'o' : 'sleepy';

    let brow = 0; let browUp = false;
    if (v < -0.3) brow = 0.8;
    if (s.focus > 0.5) brow = -0.8;
    if (s.curious > 0.5 || s.surprise > 0.45) { brow = 0.1; browUp = true; }

    // breathing, hops, the beat
    const breath = Math.sin(t * Math.PI * 2 * (0.35 + a * 0.5 - sleep * 0.15));
    let stretch = breath * (0.35 + sleep * 0.4);
    let widen = 0;
    let rootDy = 0; let rootDx = 0;
    let headDx = look[0] * 0.6; let headDy = 0; let headRot = 0;
    let armL = { rot: 8 }; let armR = { rot: -8 };
    let footL = { dy: 0 }; let footR = { dy: 0 };
    let earL = { dy: 0, rot: 0 }; let earR = { dy: 0, rot: 0 };

    if (a > 0.7 && v > 0.4 && !beat && s.dance < 0.3) {
      const hop = Math.abs(Math.sin(t * Math.PI * 2.2));
      rootDy -= hop * 2.6 * (a - 0.6) / 0.4;
      if (hop < 0.25) { stretch = -1; widen = 1; }
    }
    if (s.hop > 0.05) rootDy -= s.hop * 2;
    const droop = Math.max(0, -v) * 0.9 + sleep;
    headDy += Math.min(1.4, droop);
    earL = { dy: droop > 0.5 ? 1 : 0, rot: -droop * 28 }; earR = { dy: earL.dy, rot: -droop * 28 };
    if (sleep > 0.6) headRot += 9 * sleep;
    if (a > 0.8 || s.surprise > 0.4) { earL.rot -= 10; earR.rot -= 10; }
    if (t > this.nextTwitch) { this.twitchUntil = t + 0.18; this.nextTwitch = t + 2 + r() * 4; this.twitchSide = r() < 0.5 ? -1 : 1; }
    if (t < this.twitchUntil && sleep < 0.5) (this.twitchSide < 0 ? earL : earR).rot += 22;
    headRot += s.curious * 8 * (this.personality < 0.5 ? 1 : -1);

    // calm listening: a sway every two beats
    if (beat && s.listen > 0.05) {
      const sw = Math.sin(((beat.index % 2) + beat.phase) * Math.PI);
      const side = beat.index % 4 < 2 ? 1 : -1;
      headRot += s.listen * sw * 9 * side;
      rootDx += s.listen * sw * side * 0.6;
      footR.dy -= s.listen * (beat.phase < 0.25 ? 1 : 0);
    }
    // dancing: a bounce on every beat, new moves every 8 beats
    if (beat && s.dance > 0.05) {
      const d = s.dance; const ph = beat.phase; const odd = beat.index % 2 ? 1 : -1;
      const pop = Math.exp(-ph * 7);
      rootDy += d * (pop - Math.sin(ph * Math.PI) * 1.8);
      if (ph < 0.15) { stretch = -d; widen = d; } else if (ph < 0.6) stretch = d;
      headRot += d * odd * 7 * (1 - pop * 0.5);
      headDx += d * odd;
      const style = Math.floor(beat.index / 8) % 3;
      if (style === 0) { armL = { rot: odd > 0 ? 150 : 40 }; armR = { rot: odd > 0 ? -40 : -150 }; }
      else if (style === 1) { const up = 120 + pop * 40; armL = { rot: up }; armR = { rot: -up }; }
      else { const w = 50 * Math.sin((beat.index + ph) * Math.PI); armL = { rot: 70 + w }; armR = { rot: -70 + w }; }
      armL.rot *= d; armR.rot *= d;
      (odd > 0 ? footL : footR).dy -= d * (ph < 0.5 ? 1 : 0);
      earL.rot += d * odd * 10; earR.rot -= d * odd * 10;
    }
    if (s.cheer > 0.05) {
      const c = s.cheer;
      armL = { rot: armL.rot * (1 - c) + c * (150 + Math.sin(t * 18) * 15) };
      armR = { rot: armR.rot * (1 - c) - c * (150 + Math.sin(t * 18 + 1) * 15) };
      rootDy -= c * Math.abs(Math.sin(t * Math.PI * 3)) * 3;
    }
    if (s.giggle > 0.05) {
      const g = s.giggle;
      rootDy -= g * Math.abs(Math.sin(t * Math.PI * 6)) * 1.5;
      headDx += g * (Math.sin(t * 30) > 0 ? 1 : -1) * 0.6;
      armL = { rot: armL.rot + g * 45 }; armR = { rot: armR.rot - g * 45 };
    }
    if (s.pat > 0.05) { headDy += s.pat; stretch -= s.pat * 0.6; earL.rot -= s.pat * 25; earR.rot -= s.pat * 25; }
    if (s.dizzy > 0.05) headDx += s.dizzy * Math.round(Math.sin(t * 9) * 1.4);
    if (s.surprise > 0.05) {
      const k = s.surprise;
      rootDy -= k * 2.5; armL = { rot: armL.rot + k * 70 }; armR = { rot: armR.rot - k * 70 };
      stretch += k;
    }
    if (s.kick > 0.05) { footR = { dy: -s.kick * 2, dx: s.kick * 3 }; armL = { rot: s.kick * 80 }; armR = { rot: -s.kick * 40 }; }
    if (s.focus > 0.05) { stretch -= s.focus * 0.8; headDy += s.focus * 0.4; }

    const wag = 1 + 3 * a * Math.max(0, v) + s.dance * 2;
    const tailRot = Math.sin(t * Math.PI * 2 * wag) * (8 + 26 * Math.max(0, v) * a) + droop * 30;

    const fx = [];
    if (sleep > 0.6) {
      const z = (t * 0.7) % 1; const z2 = (t * 0.7 + 0.5) % 1;
      fx.push({ kind: 'z', x: 17 + z * 3, y: 7 - z * 5 }, { kind: 'Z', x: 17 + z2 * 3, y: 7 - z2 * 5 });
    }
    if (s.surprise > 0.5) fx.push({ kind: 'bang', x: 19, y: 3 + rootDy });
    if (s.curious > 0.5) fx.push({ kind: 'what', x: 19, y: 2 });
    if (s.pat > 0.4) { const u = (t * 0.8) % 1; fx.push({ kind: 'heart', x: 17 + u * 2, y: 6 - u * 5 }); }
    if (s.cheer > 0.5 || (s.dance > 0.7 && v > 0.7 && beat && beat.index % 4 === 0) || (v > 0.85 && a > 0.6 && s.dance < 0.3)) {
      const on = Math.floor(t * 6) % 2;
      fx.push(on ? { kind: 'sparkle', x: 2, y: 5 } : { kind: 'sparkle', x: 20, y: 3 }, on ? { kind: 'sparkle', x: 19, y: 10 } : { kind: 'sparkle', x: 2, y: 14 });
    }
    if (s.focus > 0.5 && Math.floor(t * 3) % 2) fx.push({ kind: 'sweat', x: 18, y: 6 });
    if (inputs.notes && beat) {
      for (let i = 0; i < 3; i += 1) {
        const age = (beat.phase + i) / 3;
        fx.push({ kind: (beat.index - i) % 3 === 2 ? 'note2' : 'note', x: ((beat.index - i) % 2 + 2) % 2 + Math.sin(age * 12) * 0.8, y: 15 - age * 14 });
      }
    }

    return {
      root: { dx: rootDx, dy: rootDy },
      body: { stretch: Math.max(-1, Math.min(1.5, stretch)), widen },
      head: { dx: headDx, dy: headDy, rot: headRot },
      earL, earR, armL, armR, footL, footR,
      tail: { rot: tailRot },
      face: { eye, mouth, lookX: look[0], lookY: look[1], brow, browUp, blush: v > 0.6 && a > 0.5, tear: v < -0.6 ? Math.floor(t * 2) : 0 },
      fx,
    };
  }
}
