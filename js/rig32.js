// The live buddy at twice the detail, for close-ups (the kid screen, the piano timer,
// the shop): the 32 x 32 drawings from art32.js in a 48 x 48 scene. The pose comes
// from the same Brain as rig.js (in its 24 px units), so the buddy feels and moves
// exactly the same; here a move of half a small pixel is one whole fine pixel.
// Outfits, pianos, gear and backgrounds are still drawn at the small size, so they
// are blown up with Scale2x (rounder edges) until each one gets its own big drawing.
import { speciesArt } from './art32.js';
import { buildRig } from './rig.js';
import { wandCells, OUT } from './avatar.js';

export const N = 48;
const X0 = 8; // the small sprite's corner (4, 7), doubled
const Y0 = 14;

const colorize = (rows, pal) => rows.map((r) => [...r].map((ch) => (ch === '.' ? null : pal[ch] || null)));
function part(c, x, y, pivot) {
  const h = c.length; const w = c[0]?.length || 0;
  return { c, w, h, x, y, pivot: pivot || [x + w / 2, y + h / 2] };
}

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
// turned parts are sampled from an 8x copy, so a turned arm or tail keeps clean edges
function up8(p) {
  if (!p.c8) {
    let c = p.c; let w = p.w; let h = p.h;
    for (let i = 0; i < 3; i += 1) { c = scale2x(c, w, h); w *= 2; h *= 2; }
    p.c8 = c;
  }
  return p.c8;
}
/** A small (24 px scene) part at twice the size, smoothed. */
function big(p) {
  if (!p) return null;
  return { ...part(scale2x(p.c, p.w, p.h), p.x * 2, p.y * 2), behind: p.behind };
}

const mul = (m, n) => [
  m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5],
];
const T = (x, y) => [1, 0, 0, 1, x, y];
const I = T(0, 0);
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

/** Builds the big parts for a buddy ({ species, outfit }). opts.background: false for no background. */
export function buildRig32(buddy, opts = {}) {
  const small = buildRig(buddy, opts); // the outfit, pianos, gear and background, at the small size
  const art = speciesArt(small.species);
  const pal = art.pal;
  const ox = X0; const oy = Y0;
  const H = colorize(art.head, pal);
  const hasEars = art.head[0].includes('K') || art.head[3].includes('K');
  const ears = [];
  if (art.flop) {
    // floppy ears hang in front of the cheeks and swing from the top
    const c = colorize(art.flop, pal); const cr = c.map((r) => r.slice().reverse());
    const L = part(c, ox - 2, oy + 6, [ox + 2, oy + 7]); L.side = -1; L.front = true;
    const R = part(cr, ox + 27, oy + 6, [ox + 29, oy + 7]); R.side = 1; R.front = true;
    ears.push(L, R);
  } else if (art.crest) {
    const C = part(colorize(art.crest, pal), ox, oy - 3, [ox + 16, oy + 4]); C.side = 0;
    ears.push(C);
  } else if (hasEars) {
    // only the ear moves: the head keeps its own top edge. Round ears hop instead of turning.
    const round = art.head[2].includes('KKKK');
    const inEar = (x, y) => (y < 7 ? x <= 10 || x >= 21 : x <= 9 || x >= 22);
    const earRows = round ? H.slice(0, 8).map((r, y) => r.map((c, x) => (inEar(x, y) ? c : null))) : H.slice(0, 6);
    const L = part(earRows.map((r) => r.map((c, x) => (x < 16 ? c : null))), ox, oy, [ox + 7, oy + 7]); L.side = -1;
    const R = part(earRows.map((r) => r.map((c, x) => (x >= 16 ? c : null))), ox, oy, [ox + 24, oy + 7]); R.side = 1;
    if (round) { L.round = true; R.round = true; }
    ears.push(L, R);
  }
  const top = hasEars && !art.flop && !art.crest ? 6 : 4;
  const head = part(H.slice(top), ox, oy + top, [ox + 16, oy + 23]);
  const body = part(colorize(art.body, pal), ox, oy + 24, [ox + 16, oy + 30]);
  const feet = colorize(art.feet, pal);
  const footL = part(feet.map((r) => r.map((c, x) => (x < 16 ? c : null))), ox, oy + 30);
  const footR = part(feet.map((r) => r.map((c, x) => (x >= 16 ? c : null))), ox, oy + 30);
  const tail = art.tail ? part(colorize(art.tail, pal), ox + 26, oy + 15, [ox + 27, oy + 27]) : null;
  // arms: a short paw in fur color, turning at the shoulder (0 degrees hangs down, hidden)
  const fur = art.panda ? pal.D : pal.O; const dark = art.panda ? '#1d1924' : pal.d;
  const armRows = ['.KKK.', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOOK', 'KOOdK', 'KdddK', '.KKK.'];
  const armC = armRows.map((r) => [...r].map((ch) => (ch === 'K' ? OUT : ch === 'O' ? fur : ch === 'd' ? dark : null)));
  const armL = part(armC, ox + 4, oy + 24, [ox + 6.5, oy + 25.5]);
  const armR = part(armC, ox + 23, oy + 24, [ox + 25.5, oy + 25.5]);
  const scene = (p) => (p ? big(p) : null);
  return {
    species: small.species, face: art.face, dino: art.dino,
    head, ears, body, footL, footR, tail, armL, armR,
    eyeL: [ox + 8, oy + 12], eyeR: [ox + 20, oy + 12], lid: pal.d,
    hat: big(small.hat), faceItem: big(small.face), neck: big(small.neck), neckFront: big(small.neckFront),
    wand: small.wand,
    music: small.music && { behind: scene(small.music.behind), front: scene(small.music.front), flames: small.music.flames.map(scene) },
    gear: small.gear && { ...big(small.gear), kind: small.gear.kind, held: small.gear.held },
    bg: small.bg ? scale2x(small.bg, 24, 24) : null,
  };
}

// ---------- the face ----------
const EYES = {
  open: { at: [0, 0], rows: ['.KK.', 'KHKK', 'KKKK', '.KK.'] },
  wide: { at: [-1, -1], rows: ['.KKKK.', 'KKHHKK', 'KKHKKK', 'KKKKKK', 'KKKKKH', '.KKKK.'] },
  half: { at: [0, 0], rows: ['LLLL', 'LLLL', 'KHKK', '.KK.'] },
  closed: { at: [0, 2], rows: ['KKKK'] },
  happy: { at: [0, 1], rows: ['.KK.', 'K..K', 'K..K'] },
  sleep: { at: [0, 2], rows: ['K..K', '.KK.'] },
  dizzy: { at: [0, 0], rows: ['K..K', '.KK.', '.KK.', 'K..K'] },
};
const MOUTHS = {
  happy: ['K..KK..K', '.KK..KK.'],
  excited: ['KKKKKKKK', 'KMMMMMMK', '.KMTTMK.', '..KKKK..'],
  proud: ['K......K', '.KKKKKK.'],
  sleepy: ['..KKKK..'],
  sad: ['..KKKK..', '.K....K.'],
  o: ['..KKKK..', '.KMMMMK.', '.KMMMMK.', '..KKKK..'],
};
const TURTLE_MOUTHS = {
  happy: ['K..........K', '.KK......KK.', '...KKKKKK...'],
  excited: ['KKKKKKKKKKKK', '.KMMMMMMMMK.', '..KMMTTMMK..', '...KKKKKK...'],
  proud: ['K..........K', '.KKKKKKKKKK.'],
  sleepy: ['...KKKKKK...'],
  sad: ['....KKKK....', '..KK....KK..'],
  o: ['....KKKK....', '...KMMMMK...', '....KKKK....'],
};
const DINO_MOUTHS = {
  happy: ['K..........K', 'KHMHMMMMHMHK', '.KMMMTTMMMK.', '..KKKKKKKK..'],
  excited: ['KKKKKKKKKKKK', 'KHMHMHHMHMHK', 'KMMMMTTMMMMK', '.KMMTTTTMMK.', '..KKKKKKKK..'],
  proud: ['K..........K', '.KHHKHHKHHK.', '..KKKKKKKK..'],
  sleepy: ['...KKKKKK...'],
  sad: ['...KKKKKK...', '..K......K..'],
  o: ['....KKKK....', '...KMMMMK...', '...KMMMMK...', '....KKKK....'],
};

function drawFace(rig, bmp, f) {
  const hx = rig.head.x; const hy = rig.head.y;
  const put = (sx, sy, col) => {
    const x = Math.round(sx - hx); const y = Math.round(sy - hy);
    if (y >= 0 && y < bmp.length && x >= 0 && x < bmp[0].length) bmp[y][x] = col;
  };
  const stamp = (x0, y0, rows, pal) => rows.forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') put(x0 + i, y0 + j, pal[ch]); }));
  const ox = X0; const oy = Y0;
  const mpal = { K: OUT, M: '#7a2e1c', T: '#ff6b81', H: '#ffffff' };
  if (rig.face === 'turtle') {
    stamp(ox + 14, oy + 15, ['K..K'], { K: OUT });
    stamp(ox + 10, oy + 16 + (f.mouth === 'sleepy' ? 1 : 0), TURTLE_MOUTHS[f.mouth] || TURTLE_MOUTHS.happy, mpal);
  } else if (rig.dino) {
    stamp(ox + 13, oy + 16, ['K....K'], { K: OUT });
    stamp(ox + 10, oy + 18, DINO_MOUTHS[f.mouth] || DINO_MOUTHS.happy, mpal);
  } else {
    stamp(ox + 14, oy + 16, ['KKKK', '.KK.'], { K: OUT });
    stamp(ox + 12, oy + 18, MOUTHS[f.mouth] || MOUTHS.happy, mpal);
  }
  const g = EYES[f.eye] || EYES.open;
  const moves = ['open', 'wide', 'half'].includes(f.eye);
  const lx = moves ? f.lookX : 0; const ly = moves ? f.lookY : 0;
  const epal = { K: OUT, H: '#ffffff', L: rig.lid };
  for (const [ex, ey] of [rig.eyeL, rig.eyeR]) stamp(ex + g.at[0] + lx, ey + g.at[1] + ly, g.rows, epal);
  // brows: brow > 0 worried (inner ends up), < 0 determined (inner ends down), browUp raised
  if (Math.abs(f.brow) > 0.35 || f.browUp) {
    const top = (f.eye === 'wide' ? -4 : -3) - (f.browUp ? 1 : 0);
    for (const [ex, ey, side] of [[...rig.eyeL, -1], [...rig.eyeR, 1]]) {
      for (let i = 0; i < 4; i += 1) {
        const inner = side < 0 ? i : 3 - i;
        let dy = 0;
        if (f.brow > 0.35) dy = -Math.round(inner / 2); else if (f.brow < -0.35) dy = Math.round(inner / 2);
        put(ex + i, ey + top + dy, OUT);
      }
    }
  }
  if (f.blush) {
    for (const [ex, ey, s] of [[...rig.eyeL, -1], [...rig.eyeR, 1]]) {
      const x = s < 0 ? ex - 2 : ex + 3;
      for (let i = 0; i < 3; i += 1) put(x + i, ey + 5, '#ff8fa3');
    }
  }
  if (f.tear) for (let i = 0; i < 2; i += 1) put(rig.eyeL[0] + 1, rig.eyeL[1] + 4 + i + (f.tear % 2) * 2, '#4dabf7');
}

const FX = {
  note: { rows: ['..KKK', '..KKK', '..K..', '..K..', 'KKK..', 'KKK..'], pal: { K: '#5f3dc4' } },
  note2: { rows: ['.KKKKKK', '.K....K', '.K....K', 'KK...KK', 'KK...KK'], pal: { K: '#c2255c' } },
  z: { rows: ['KKKK', '..K.', '.K..', 'KKKK'], pal: { K: '#4c6ef5' } },
  Z: { rows: ['KKKKK', '...K.', '..K..', '.K...', 'KKKKK'], pal: { K: '#4c6ef5' } },
  bang: { rows: ['KK', 'KK', 'KK', 'KK', '..', 'KK'], pal: { K: '#e03131' } },
  what: { rows: ['.KKK.', 'K...K', '...K.', '..K..', '.....', '..K..'], pal: { K: '#1c7ed6' } },
  sparkle: { rows: ['..Y..', '..Y..', 'YYWYY', '..Y..', '..Y..'], pal: { Y: '#ffd43b', W: '#fff9db' } },
  heart: { rows: ['.RR.RR.', 'RRRRRRR', 'RRRRRRR', '.RRRRR.', '..RRR..', '...R...'], pal: { R: '#f03e3e' } },
  sweat: { rows: ['..B', '.BB', 'BBW', 'BWW'], pal: { B: '#4dabf7', W: '#d0ebff' } },
};

function darken(hex, t) {
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - t)).toString(16).padStart(2, '0')).join('');
}
function blend(under, c, a) {
  if (a >= 1) return c;
  if (!under) return c + Math.round(a * 255).toString(16).padStart(2, '0');
  const u = under.slice(0, 7);
  return '#' + [1, 3, 5].map((i) => Math.round(parseInt(u.slice(i, i + 2), 16) * (1 - a) + parseInt(c.slice(i, i + 2), 16) * a).toString(16).padStart(2, '0')).join('');
}

/**
 * Draws a pose from rig.js's Brain. Returns 48 x 48 colors, row by row (null where
 * nothing is drawn). Arms turn in 22.5 degree steps, ears and tails in 15.
 * opts.wand: how much of today's chores are done (0 to 1), for the wand's glow.
 */
export function render32(rig, pose, frame = 0, opts = {}) {
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
  // pose numbers are in small pixels: one small pixel is two here
  const q = (v) => Math.round(v * 2);

  if (rig.bg) for (let y = 0; y < N; y += 1) for (let x = 0; x < N; x += 1) buf[y * N + x] = rig.bg[y][x];
  const rootX = q(pose.root.dx); const rootY = q(pose.root.dy);
  if (rig.bg) {
    // the shadow shrinks as the buddy jumps
    const w = Math.max(12, 20 + Math.min(0, rootY));
    for (let x = Math.round(24 - w / 2 + rootX); x < 24 + w / 2 + rootX; x += 1) {
      if (x >= 0 && x < N) for (const y of [46, 47]) buf[y * N + x] = darken(buf[y * N + x] || '#74d474', 0.2);
    }
  }
  if (rig.music) draw(rig.music.behind, I);

  const root = T(rootX, rootY);
  const stretch = q(pose.body.stretch);
  const widen = Math.round(pose.body.widen * 2) / 2;
  const bodyM = mul(root, about(rig.body.pivot, 0, 1 + widen * 0.1, (rig.body.h + stretch) / rig.body.h));
  const neckM = mul(root, T(0, -stretch));
  // a head turn shows as a shift: turning a face looks rough
  const headM = mul(neckM, T(q(pose.head.dx) + q(pose.head.rot / 9), q(pose.head.dy)));
  const hb = rig.head.c.map((r) => r.slice());
  drawFace(rig, hb, pose.face);
  const earM = (e) => {
    const ep = e.side === 1 ? pose.earR : pose.earL;
    if (e.round) return mul(headM, T(0, q(ep.dy) + (ep.rot > 10 ? -1 : ep.rot < -20 ? 1 : 0)));
    const rot = e.front ? -e.side * snap(ep.rot * 0.6, 15) : (e.side || 0) * snap(ep.rot, 15);
    return mul(headM, mul(T(0, q(ep.dy)), about(e.pivot, rot)));
  };

  if (rig.neck?.behind) draw(rig.neck, neckM);
  if (rig.tail) draw(rig.tail, mul(root, about(rig.tail.pivot, snap(pose.tail.rot, 15))));
  draw(rig.footL, mul(root, T(q(pose.footL.dx || 0), q(pose.footL.dy))));
  draw(rig.footR, mul(root, T(q(pose.footR.dx || 0), q(pose.footR.dy))));
  draw(rig.body, bodyM);
  if (rig.gear?.kind === 'shoes') draw(rig.gear, root);
  rig.ears.forEach((e) => { if (!e.front) draw(e, earM(e)); });
  draw(rig.head, headM, hb);
  rig.ears.forEach((e) => { if (e.front) draw(e, earM(e)); });
  if (rig.neck && !rig.neck.behind) draw(rig.neck, neckM);
  if (rig.neckFront) draw(rig.neckFront, neckM);
  if (rig.faceItem) draw(rig.faceItem, headM);
  if (rig.hat) draw(rig.hat, headM);
  if (rig.wand) {
    // held at the side, moving with the body; its cells are small pixels
    const wx = Math.round(neckM[4]); const wy = Math.round(neckM[5]);
    for (const { x, y, c, a } of wandCells(opts.wand, rig.wand.side, frame)) {
      for (let j = 0; j < 2; j += 1) for (let i = 0; i < 2; i += 1) {
        const X = x * 2 + i + wx; const Y = y * 2 + j + wy;
        if (X < 0 || Y < 0 || X >= N || Y >= N) continue;
        buf[Y * N + X] = blend(buf[Y * N + X], c, a);
      }
    }
  }
  for (const [arm, a] of [[rig.armL, pose.armL], [rig.armR, pose.armR]]) {
    const r = snap(a.rot, 22.5);
    if (Math.abs(r) > 0) draw(arm, mul(neckM, about(arm.pivot, r)));
  }
  if (rig.gear && rig.gear.kind !== 'shoes') draw(rig.gear, rig.gear.held ? neckM : I);
  if (rig.music) {
    draw(rig.music.front, I);
    if (rig.music.flames.length) draw(rig.music.flames[frame % rig.music.flames.length], I);
  }
  for (const fx of pose.fx || []) {
    const g = FX[fx.kind];
    if (!g) continue;
    draw(part(g.rows.map((r) => [...r].map((ch) => (ch === '.' ? null : g.pal[ch] || OUT))), Math.round(fx.x * 2), Math.round(fx.y * 2)), I);
  }
  return buf;
}
