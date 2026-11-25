// Animal pictures for the photo train (js/phototrain.js) and the critter album.
//
// Every animal is drawn from a body plan with its own colors and parts, the way
// fishart.js draws every fish from one shape with a look. Pictures are in fine
// pixels (the game draws them at Z = 2 fine pixels for each game pixel, like the
// fish), with a dark outline worked out from the silhouette, light from the top
// left and a darker belly side, so a small animal still reads at a glance.
//
// An animal faces LEFT (the way the scenery runs past the train). Frames:
//   'stand'  side on, head forward
//   'walk'   side on, legs apart (walk/run cycles swap stand and walk)
//   'pose'   stopped, head turned to the camera: both eyes, a little shine
//   'peek'   only the head and shoulders (out of a burrow, over a log, out of water)
//   'fly'    wings up (birds and bugs; 'stand' is wings down)
//
// look: { plan, len (body length in fine pixels), fur, belly?, dark?, eye?, nose?, beak?,
//   ears: 'point' | 'long' | 'round' | 'tuft' | 'none', tail: 'bushy' | 'short' | 'long' |
//   'ring' | 'fan' | 'none', legs (leg length as a share of len), horns: 'antler' | 'palm' |
//   'curl' | 'spike' | 'horn' | null, mark: 'spots' | 'stripes' | 'mask' | 'blaze' | 'chest' |
//   'cap' | 'wingbar' | 'shell' | 'glow' | null, accent, extra: 'mane' | 'hump' | 'crest' |
//   'beard' | 'tusks' | 'wings' | 'sparkle' | 'halo' | null }
// plan: 'quad' (deer, fox, bear...), 'hop' (rabbits, hares), 'small' (squirrels, otters on land),
//   'bird' (perching birds), 'big-bird' (owls, eagles, standing upright), 'wader' (herons,
//   flamingos), 'swim' (seals, otters, whales: a back out of the water), 'frog', 'lizard',
//   'bug' (butterflies, dragonflies), 'crab', 'snail'
import { canvas } from './play.js';
import { Buf, inEll, line, ramp, mix } from './pixelkit.js';

const INK = '#1b1430';
const mixPale = (c) => (c.toLowerCase() === '#ffffff' ? '#eef1f7' : c);
const cache = new Map();

/** An animal picture (a canvas, facing left), cached by look + frame. */
export function critterPic(look, frame = 'stand') {
  const key = `${JSON.stringify(look)}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  // room all round: a moose's palms and the December trimmings (a lantern, stardust) reach out past
  // the box. (Other animals keep the old 4 for now: a few of them get clipped at the edge, see NOTES.)
  const pad = look.xmas || look.horns === 'palm' ? 16 : 4;
  const b = new Buf(Math.ceil(look.len * 2.4), Math.ceil(look.len * 2.4), pad);
  const draw = PLANS[look.plan] || PLANS.quad;
  b.hd = null; b.neck = null; b.palms = [];
  const box = draw(b, look, frame) || {};
  if (look.xmas) dress(b, look, frame, box);
  finish(b, look);
  for (const [x, y, col] of box.after || []) if (!b.get(x, y)) b.set(x, y, col, 'after');
  // crop to what was drawn
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  b.each((x, y) => { if (b.get(x, y)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); } });
  if (!Number.isFinite(x0)) { x0 = 0; y0 = 0; x1 = 1; y1 = 1; }
  const c = canvas(x1 - x0 + 1, y1 - y0 + 1);
  const ctx = c.getContext('2d');
  b.each((x, y) => { const col = b.get(x, y); if (col) { ctx.fillStyle = col; ctx.fillRect(x - x0, y - y0, 1, 1); } });
  // where the eye is and where the feet are, in the cropped picture
  c.feet = (box?.feet ?? y1) - y0;
  c.eye = box?.eye ? [box.eye[0] - x0, box.eye[1] - y0] : null;
  cache.set(key, c);
  return c;
}

// tags: 'fur' (main color, shaded), 'belly', 'dark', 'accent', 'eye', 'shine', 'nose', 'horn', 'beak'
function finish(b, look) {
  const fur = ramp(look.fur, 3, 2);
  const belly = ramp(look.belly || look.fur, 3, 2);
  const dark = look.dark || fur[0];
  const shell = ramp(look.shell || look.fur, 3, 2);
  // white animals get a blue-grey underside, so they still show on snow
  const pale = (h) => { const n = parseInt(h.slice(1, 7), 16); return ((n >> 16) + ((n >> 8) & 255) + (n & 255)) / 3 > 225; };
  if (pale(look.fur)) { fur[2] = '#c5cee0'; fur[3] = mixPale(fur[3]); }
  // shade the fur: light along the top edge, darker toward the bottom edge
  const top = (x, y) => !b.get(x, y - 1);
  const bottom = (x, y) => !b.get(x, y + 1);
  b.map((c, t, x, y) => {
    if (t === 'fur') return top(x, y) ? fur[4] : bottom(x, y) || !b.get(x + 1, y) ? fur[2] : fur[3];
    if (t === 'belly') return top(x, y) ? belly[4] : pale(look.belly || look.fur) && bottom(x, y) ? '#c5cee0' : belly[3];
    if (t === 'dark') return dark;
    if (t === 'shell') return top(x, y) ? shell[4] : bottom(x, y) ? shell[2] : shell[3];
    if (t === 'accent') return look.accent || '#e03131';
    if (t === 'horn') return look.hornCol ? (top(x, y) ? '#fff3bf' : bottom(x, y) ? '#e8a200' : look.hornCol) : top(x, y) ? '#e9d8b4' : '#b08d57';
    if (t === 'beak') return look.beak || '#f59f00';
    return c;
  });
  // December trimmings that stick out get an outline in their own darker color, not ink
  b.outline((t) => (t === 'palm' ? PALM.edge : look.xmas && t in XOUT ? XOUT[t] : INK));
}

// ---------- shared parts ----------
const ell = (b, cx, cy, rx, ry, tag, col = tag) => b.fill(Math.floor(cx - rx - 1), Math.floor(cy - ry - 1), Math.ceil(rx * 2 + 3), Math.ceil(ry * 2 + 3), (x, y) => (inEll(x, y, cx, cy, rx, ry) ? col : null), tag);
const thick = (b, x0, y0, x1, y1, w, tag) => line(x0, y0, x1, y1, (x, y) => b.rect(x - Math.floor(w / 2), y, w, 1, tag, tag));
const px = (b, x, y, tag) => b.set(x, y, tag, tag);

/** Eyes: side on one eye, posing two (and a shine). */
function eyes(b, look, hx, hy, r, frame) {
  const col = look.eye || INK;
  if (frame === 'pose') {
    const d = Math.max(1, Math.round(r * 0.45));
    for (const ex of [hx - d, hx + d]) { b.set(ex, hy, col, 'eye'); if (r >= 4) b.set(ex, hy - 1, col, 'eye'); b.set(ex, hy - (r >= 4 ? 1 : 0), col, 'eye'); }
    b.set(hx - d, hy - (r >= 4 ? 1 : 0), '#ffffff', 'shine');
    b.set(hx + d, hy - (r >= 4 ? 1 : 0), '#ffffff', 'shine');
    return [hx, hy];
  }
  const ex = hx - Math.max(1, Math.round(r * 0.4));
  b.set(ex, hy, col, 'eye'); if (r >= 4) b.set(ex, hy - 1, col, 'eye');
  if (r >= 4) b.set(ex, hy - 1, '#ffffff', 'shine');
  return [ex, hy];
}

function ears(b, look, hx, hy, r, frame) {
  const kind = look.ears || 'point';
  const pose = frame === 'pose';
  const spots = pose ? [hx - r * 0.6, hx + r * 0.6] : [hx + r * 0.2, hx + r * 0.65];
  for (const ex of spots) {
    const x = Math.round(ex);
    if (kind === 'point') { for (let k = 0; k < Math.max(2, r * 0.8); k += 1) b.rect(x - Math.floor((r * 0.8 - k) / 2.2), Math.round(hy - r - k + 1), Math.max(1, Math.round((r * 0.8 - k) / 1.1)), 1, 'fur', 'fur'); px(b, x, Math.round(hy - r + 1), 'dark'); }
    if (kind === 'tuft') { for (let k = 0; k < r; k += 1) b.rect(x - Math.floor((r - k) / 3), Math.round(hy - r - k + 1), Math.max(1, Math.round((r - k) / 1.5)), 1, 'fur', 'fur'); px(b, x, Math.round(hy - 2 * r + 1), 'dark'); px(b, x, Math.round(hy - 2 * r), 'dark'); }
    if (kind === 'long') { const L = Math.round(r * 2.2); b.rect(x - 1, Math.round(hy - r - L + 2), 2, L, 'fur', 'fur'); px(b, x, Math.round(hy - r - L + 2), 'fur'); if (look.dark) px(b, x - 1, Math.round(hy - r - L + 2), 'dark'); }
    if (kind === 'lynx') { for (let k = 0; k < Math.max(2, r * 0.7); k += 1) b.rect(x - Math.floor((r * 0.7 - k) / 2.2), Math.round(hy - r - k + 1), Math.max(1, Math.round((r * 0.7 - k) / 1.1)), 1, 'fur', 'fur'); const ty = Math.round(hy - r - r * 0.7 + 1); px(b, x, ty, 'dark'); px(b, x, ty - 1, 'dark'); px(b, x, ty - 2, 'dark'); }
    if (kind === 'round') ell(b, x, hy - r + 0.5, Math.max(1.2, r * 0.38), Math.max(1.2, r * 0.38), 'fur');
  }
}

function horns(b, look, hx, hy, r, frame) {
  const k = look.horns; if (!k) return;
  const pose = frame === 'pose';
  const bases = pose ? [hx - r * 0.5, hx + r * 0.5] : [hx + r * 0.3];
  for (const bx of bases) {
    const x = Math.round(bx); const y = Math.round(hy - r);
    const dir = pose ? (bx < hx ? -1 : 1) : 1;
    if (k === 'antler') { // branching, deer and elk
      thick(b, x, Math.round(hy - r * 0.72), x, y, 1, 'horn'); // the base, rooted in the skull (no gap above the head)
      thick(b, x, y, x + dir * Math.round(r * 0.6), y - r * 1.6, 1, 'horn');
      thick(b, x + dir * Math.round(r * 0.3), y - r * 0.8, x - dir * Math.round(r * 0.3), y - r * 1.4, 1, 'horn');
      thick(b, x + dir * Math.round(r * 0.5), y - r * 1.3, x + dir * Math.round(r * 1.1), y - r * 1.8, 1, 'horn');
    } else if (k === 'palm') { // moose: a broad flat paddle each side, on a short thick beam out of the skull
      if (pose) palm(b, Math.round(hx + dir * r * 0.42), Math.round(hy - r * 0.7), dir, r);
      else { palm(b, Math.round(hx + r * 0.02), Math.round(hy - r * 0.8), -1, r); palm(b, Math.round(hx + r * 0.42), Math.round(hy - r * 0.78), 1, r); }
    } else if (k === 'curl') { // bighorn / ram
      for (let a = 0; a < 6; a += 0.4) { const rr = r * 0.25 + a * r * 0.11; px(b, Math.round(x + dir * (Math.cos(a) * rr + r * 0.3)), Math.round(y + Math.sin(a) * rr - r * 0.2), 'horn'); px(b, Math.round(x + dir * (Math.cos(a) * rr + r * 0.3)) + 1, Math.round(y + Math.sin(a) * rr - r * 0.2), 'horn'); }
    } else if (k === 'spike') { // mountain goat: short black daggers
      thick(b, x, y, x + dir * 1, y - Math.round(r * 0.6), 2, 'dark');
      thick(b, x + dir * 1, y - Math.round(r * 0.6), x + dir * Math.round(r * 0.7), y - Math.round(r * 1.05), 2, 'dark');
    } else if (k === 'horn') { // one unicorn horn in the middle
      const hx0 = pose ? hx : x - 1;
      for (let t = 0; t < r * (look.rainbow ? 2.2 : 1.4); t += 1) px(b, Math.round(hx0 - (pose ? 0 : t * 0.3)), Math.round(y - t), t % 2 ? 'accent' : 'horn');
      if (pose) break;
    }
  }
  if (k === 'palm') shadePalms(b);
}

// a moose's antler palms: bone, lit from the top, with their own dark brown outline (not ink)
const PALM = { lt: '#f2e2b8', md: '#d4b077', sh: '#b48a52', dk: '#94683a', edge: '#5e3f1c' };

/**
 * One antler palm: a 3-wide beam out of the skull at (x0, y0), then a broad scoop reaching out
 * (d: -1 forward/left, 1 back/right), rising at its far end, with tines along its top edge and
 * round its tip. Its top edge goes in b.palms (inner end first), for the lights.
 */
function palm(b, x0, y0, d, r) {
  const ex = Math.round(x0 + d * r * 0.4); const ey = Math.round(y0 - r * 0.28);
  thick(b, x0, y0 + 1, ex, ey, 3, 'palm');
  const W = Math.max(9, Math.round(r * 1.6));
  const edge = [];
  let tipTop = 0; let tipBot = 0;
  for (let u = 0; u <= W; u += 1) {
    const t = u / W;
    const bot = ey + 1 - t * t * r * 0.32; // nearly flat underneath, scooping up a little at the far end
    const top = bot - r * (0.36 + 0.42 * Math.sin(Math.min(1, t * 1.45) * Math.PI / 2)) - t ** 1.5 * r * 0.18;
    const x = ex + d * (u - 1);
    for (let y = Math.round(top); y <= Math.round(bot); y += 1) b.set(x, y, PALM.md, 'palm');
    // tines along the top edge
    if (t > 0.22 && u % 3 === 2 && u < W) { const n = t > 0.6 ? 3 : 2; for (let k = 1; k <= n; k += 1) b.set(x + (k === n && t > 0.6 ? d : 0), Math.round(top) - k, PALM.md, 'palm'); }
    edge.push([x, Math.round(top)]);
    tipTop = Math.round(top); tipBot = Math.round(bot);
  }
  // tines round the tip, pointing out
  const tx = ex + d * (W - 1);
  for (let y = tipTop + 1; y <= tipBot - 1; y += 2) { b.set(tx + d, y, PALM.md, 'palm'); b.set(tx + 2 * d, y - 1, PALM.md, 'palm'); }
  b.palms?.push({ d, edge, tip: [tx, tipTop, tipBot] });
}

function shadePalms(b) {
  const is = (x, y) => b.tag(x, y) === 'palm' && b.get(x, y);
  const marks = [];
  b.each((x, y) => {
    if (!is(x, y)) return;
    const up = is(x, y - 1); const dn = is(x, y + 1); const dn2 = is(x, y + 2);
    marks.push([x, y, !up ? PALM.lt : !dn ? PALM.dk : !dn2 ? ((x + y) & 1 ? PALM.sh : PALM.dk) : (x + y) % 4 === 0 && !is(x, y + 3) ? PALM.sh : PALM.md]);
  });
  for (const [x, y, c] of marks) b.set(x, y, c);
}

/** A side-on (or turned) head. Returns the eye position. */
function head(b, look, hx, hy, r, frame) {
  const pose = frame === 'pose';
  ears(b, look, hx, hy, r, frame);
  ell(b, hx, hy, r, r * 0.92, 'fur');
  let snout = look.snout ?? 0.9;
  if (!pose && snout > 0) {
    // muzzle forward (to the left)
    ell(b, hx - r * 0.85, hy + r * 0.25, r * 0.65 * snout, r * 0.5, look.muzzle ? 'belly' : 'fur');
    b.set(Math.round(hx - r * 0.85 - r * 0.6 * snout), Math.round(hy + r * 0.1), look.nose || INK, 'nose');
  } else if (pose) {
    ell(b, hx, hy + r * 0.45, r * 0.45, r * 0.32, look.muzzle ? 'belly' : 'fur');
    b.set(Math.round(hx), Math.round(hy + r * 0.3), look.nose || INK, 'nose');
  }
  if (look.star) { const nx = pose ? hx : hx - r * 0.85 - r * 0.6 * snout; const ny = pose ? hy + r * 0.35 : hy + r * 0.15; for (let k = 0; k < 8; k += 1) { const a = (k / 8) * Math.PI * 2; b.set(Math.round(nx + Math.cos(a) * 2), Math.round(ny + Math.sin(a) * 2), look.star, 'star'); } }
  if (look.mark === 'mask') {
    for (let x = -r; x <= r; x += 1) if (Math.abs(x) > (pose ? 0.6 : -1)) { px(b, Math.round(hx + x), Math.round(hy - 0.5), 'dark'); px(b, Math.round(hx + x), Math.round(hy + 0.5), 'dark'); if (look.brow) px(b, Math.round(hx + x), Math.round(hy - 1.5), 'belly'); }
  }
  if (look.extra === 'ruff') for (const s of pose ? [-1, 1] : [1]) {
    const jx = pose ? hx + s * r * 0.95 : hx + r * 0.35; const jy = hy + r * 0.55;
    for (let k = 0; k < 3; k += 1) { px(b, Math.round(jx + s * k * 0.6), Math.round(jy + k), 'fur'); px(b, Math.round(jx + s * k * 0.6) - s, Math.round(jy + k), 'fur'); }
    px(b, Math.round(jx + s * 1.5), Math.round(jy + 3), 'dark');
  }
  if (look.mark === 'blaze') for (let y = -r; y < r * 0.4; y += 1) px(b, Math.round(pose ? hx : hx - r * 0.3), Math.round(hy + y), 'belly');
  if (look.extra === 'beard') thick(b, Math.round(hx - (pose ? 0 : r * 0.5)), Math.round(hy + r * 0.8), Math.round(hx - (pose ? 0 : r * 0.6)), Math.round(hy + r * 1.6), 2, 'fur');
  horns(b, look, hx, hy, r, frame);
  b.hd = { x: hx, y: hy, r, ry: r * 0.92, pose };
  return eyes(b, look, hx, hy - (pose ? 0 : 0.3), r, frame);
}

function tail(b, look, tx, ty, r, frame) {
  const k = look.tail || 'short';
  if (k === 'none') return;
  if (k === 'short') ell(b, tx + r * 0.3, ty - r * 0.2, r * 0.45, r * 0.35, look.tailTag || 'fur');
  if (k === 'bushy' && look.tailUp) { for (let t = 0; t <= 1; t += 0.1) ell(b, tx + r * 0.2 + Math.sin(t * 2.6) * r * 0.9, ty - t * r * 1.9, r * (0.35 + t * 0.3), r * (0.35 + t * 0.3), 'fur'); return; }
  if (k === 'bushy') { for (let t = 0; t <= 1; t += 0.1) ell(b, tx + r * 0.4 + t * r * 1.3, ty + t * r * 0.6 - Math.sin(t * 3) * r * 0.5, r * (0.35 + t * 0.35), r * (0.35 + t * 0.3), 'fur'); if (look.tip) ell(b, tx + r * 1.8, ty + r * 0.5, r * 0.35, r * 0.3, 'belly'); }
  if (k === 'long') thick(b, tx, ty, tx + r * 1.6, ty + r * (frame === 'walk' ? 0.2 : 0.9), Math.max(1, Math.round(r * 0.35)), 'fur');
  if (k === 'ring') { for (let t = 0; t <= 1; t += 0.08) { const x = tx + t * r * 1.8; const y = ty + t * r * 0.5 - Math.sin(t * 3.2) * r * 0.6; ell(b, x, y, r * 0.35, r * 0.35, Math.floor(t * 6) % 2 ? 'dark' : 'fur'); } }
  if (k === 'fan') { for (let a = -0.9; a <= 0.9; a += 0.3) thick(b, tx, ty, tx + Math.cos(a) * r * 1.4, ty + Math.sin(a) * r * 1.2 - r * 0.6, 1, look.tailTag || 'accent'); }
}

// ---------- body plans ----------
const PLANS = {
  /** Four legs: deer, fox, moose, bear, lynx, goat, wolf. */
  quad(b, look, frame) {
    const L = look.len; const legs = (look.legs ?? 0.5) * L;
    const bodyH = L * (look.bulk ?? 0.42);
    const by = L * 0.3 + legs * 0.0 + bodyH * 0.5 + L * 0.35; // body middle
    const bx = L * 0.75;
    const feet = Math.round(by + bodyH * 0.35 + legs);
    if (frame === 'peek') {
      const r = L * (look.headR ?? 0.2);
      ell(b, bx - L * 0.3, by + bodyH * 0.2, L * 0.28, bodyH * 0.45, 'fur');
      const eye = head(b, look, bx - L * 0.45, by - bodyH * 0.25, r, 'pose');
      return { feet: Math.round(by + bodyH * 0.55), eye };
    }
    // legs (far pair darker), swung apart on 'walk'
    const sw = frame === 'walk' ? L * 0.12 : 0;
    const legW = Math.max(2, Math.round(L * (look.legW ?? 0.08)));
    const top = Math.round(by + bodyH * 0.2);
    const legAt = [bx - L * 0.32, bx + L * 0.3];
    if (look.flies && (frame === 'fly' || frame === 'walk')) {
      // up in the air: front legs folded up under the chest, back legs kicked out behind
      const ext = frame === 'fly' ? 1 : 0.75;
      const kx = legAt[0] - L * 0.1 * ext; const ky = top + legs * 0.45;
      for (const [o, tag] of [[2, 'dark'], [0, 'fur']]) {
        thick(b, Math.round(legAt[0] + o), top, Math.round(kx + o), Math.round(ky), legW, tag);
        thick(b, Math.round(kx + o), Math.round(ky), Math.round(kx + o + L * 0.09), Math.round(ky + legs * 0.3), legW, tag);
        if (look.hooves) b.rect(Math.round(kx + o + L * 0.09) - Math.floor(legW / 2), Math.round(ky + legs * 0.3) + 1, legW, 1, 'dark', 'dark');
      }
      for (const [o, tag] of [[-2, 'dark'], [0, 'fur']]) {
        const ex = legAt[1] + o + L * 0.3 * ext; const ey = top + legs * (0.62 - ext * 0.12);
        thick(b, Math.round(legAt[1] + o), top, Math.round(ex), Math.round(ey), legW, tag);
        if (look.hooves) b.rect(Math.round(ex) + 1, Math.round(ey) - 1, 1, legW, 'dark', 'dark');
      }
    } else for (const [i, lx] of legAt.entries()) {
      const s = i === 0 ? sw : -sw;
      thick(b, Math.round(lx + 1), top, Math.round(lx + 1 - s), feet, legW, 'dark');
      thick(b, Math.round(lx - 1), top, Math.round(lx - 1 + s), feet, legW, 'fur');
      if (look.paler) b.rect(Math.round(lx - 1 + s) - Math.floor(legW / 2), feet - Math.round(legs * 0.35), legW, Math.round(legs * 0.35), 'belly', 'belly');
      if (look.hooves) { b.rect(Math.round(lx - 1 + s) - Math.floor(legW / 2), feet, legW, 1, 'dark', 'dark'); }
    }
    // body
    ell(b, bx, by, L * 0.48, bodyH * 0.5, 'fur');
    if (look.belly) ell(b, bx, by + bodyH * 0.3, L * 0.36, bodyH * 0.2, 'belly');
    if (look.extra === 'hump') ell(b, bx - L * 0.2, by - bodyH * 0.45, L * 0.2, bodyH * 0.25, 'fur');
    if (look.extra === 'mane') for (let t = 0; t < 1; t += 0.12) ell(b, bx - L * 0.38 + t * L * 0.25, by - bodyH * 0.5 - t * 2, 1.6, 2.2, look.rainbow ? 'rb' : 'accent', look.rainbow ? ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc'][Math.round(t * 8) % 6] : 'accent');
    if (look.rainbow) { const RB = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#b197fc']; for (let k = 0; k < 6; k += 1) thick(b, Math.round(bx + L * 0.45), Math.round(by - bodyH * 0.25 + k), Math.round(bx + L * 0.75), Math.round(by + bodyH * 0.6 + k * 1.2 + (frame === 'walk' ? -3 : 0)), 1, 'rb'); b.each((x, y) => { if (b.tag(x, y) === 'rb' && b.get(x, y) === 'rb') b.set(x, y, RB[((y % 6) + 6) % 6], 'rb'); }); }
    if (look.mark === 'spots') for (let k = 0; k < 6; k += 1) px(b, Math.round(bx - L * 0.25 + (k * L * 0.53) % (L * 0.6)), Math.round(by - bodyH * 0.15 + ((k * 7) % 3) * 2 - 1), look.spotTag || 'belly');
    if (look.mark === 'stripes') for (let k = 0; k < 5; k += 1) thick(b, Math.round(bx - L * 0.25 + k * L * 0.13), Math.round(by - bodyH * 0.45), Math.round(bx - L * 0.28 + k * L * 0.13), Math.round(by + bodyH * 0.2), 1, 'dark');
    tail(b, look, bx + L * 0.45, by - bodyH * 0.2, L * 0.18, frame);
    // neck and head, in front (left)
    const r = L * (look.headR ?? 0.2);
    const neck = look.neck ?? 0.35;
    const hx = bx - L * 0.5 - r * 0.2 + (look.headIn ?? 0) * L; const hy = by - bodyH * 0.35 - neck * L * 0.6;
    thick(b, Math.round(bx - L * 0.36), Math.round(by - bodyH * 0.1), Math.round(hx + r * 0.3), Math.round(hy + r * 0.3), Math.max(2, Math.round(r * 1.2)), 'fur');
    b.neck = { x0: bx - L * 0.36, y0: by - bodyH * 0.1, x1: hx + r * 0.3, y1: hy + r * 0.3, w: Math.max(2, Math.round(r * 1.2)) };
    b.body = { x: bx, y: by, rx: L * 0.48, ry: bodyH * 0.5 };
    if (look.mark === 'chest') ell(b, bx - L * 0.4, by, r * 0.6, bodyH * 0.35, 'belly');
    if (look.dewlap) thick(b, Math.round(hx + r * 0.1), Math.round(hy + r * 0.8), Math.round(hx + r * 0.2), Math.round(hy + r * 1.7), 2, 'fur');
    if (look.lion) { ell(b, hx + r * 0.1, hy + r * 0.1, r * 1.7, r * 1.6, 'accent'); for (let k = 0; k < 10; k += 1) { const a = (k / 10) * Math.PI * 2; px(b, Math.round(hx + Math.cos(a) * r * 1.9), Math.round(hy + Math.sin(a) * r * 1.8), 'accent'); } }
    const eye = head(b, look, hx, hy, r, frame);
    if (look.extra === 'wings') {
      const wl = look.wingL ?? 1; const lift = frame === 'walk' ? 0.4 : frame === 'pose' ? 2.2 : 1.4;
      const ax = bx - L * 0.1; const ay = by - bodyH * 0.3;
      const tips = [0, 1, 2, 3].map((t) => [bx + L * (0.05 + t * 0.12) * wl, by - bodyH * lift * wl + t * t * 2.2]);
      for (let k = 0; k < 3; k += 1) { const [p1, p2] = [tips[k], tips[k + 1]]; for (let u = 0; u <= 1; u += 0.012) for (let v = 0; v <= 1 - u; v += 0.012) { const x = ax + (p1[0] - ax) * u + (p2[0] - ax) * v; const y = ay + (p1[1] - ay) * u + (p2[1] - ay) * v + (k === 2 ? 0 : 0); b.set(Math.round(x), Math.round(y), 'accent', 'accent'); } }
      for (const [tx, ty2] of tips) thick(b, Math.round(ax), Math.round(ay), Math.round(tx), Math.round(ty2), 1, 'dark');
    }
    return { feet, eye };
  },

  /** Rabbits and hares: round body, big back foot, long ears. */
  hop(b, look, frame) {
    const L = look.len;
    const by = L * 1.0; const bx = L * 0.7; const feet = Math.round(by + L * 0.35);
    if (frame === 'peek') {
      const eye = head(b, { ...look, snout: 0.4 }, bx - L * 0.15, by, L * 0.24, 'pose');
      return { feet: Math.round(by + L * 0.25), eye };
    }
    if (look.roo) { // a kangaroo: upright, a thick tail that props it up, big back feet
      const jump = frame === 'walk' ? L * 0.12 : 0;
      thick(b, Math.round(bx + L * 0.2), Math.round(by + L * 0.1 - jump), Math.round(bx + L * 0.75), feet - 1 - Math.round(jump * 0.5), Math.max(2, Math.round(L * 0.12)), 'fur');
      ell(b, bx + L * 0.05, feet - 1 - jump, L * 0.3, L * 0.07, 'fur');
      ell(b, bx, by - jump, L * 0.26, L * 0.4, 'fur');
      if (look.belly) ell(b, bx - L * 0.08, by + L * 0.05 - jump, L * 0.14, L * 0.26, 'belly');
      thick(b, Math.round(bx - L * 0.2), Math.round(by - L * 0.15 - jump), Math.round(bx - L * 0.32), Math.round(by + L * 0.02 - jump), 2, 'fur');
      const eye = head(b, { ...look, snout: 0.5, ears: look.ears || 'point' }, bx - L * 0.14, by - L * 0.5 - jump, L * 0.18, frame);
      return { feet, eye };
    }
    const stretch = frame === 'walk' ? 1.25 : 1;
    ell(b, bx + L * 0.05, by + L * 0.02, L * 0.42 * stretch, L * 0.32 / stretch, 'fur');
    // back foot and front paw
    ell(b, bx + L * 0.25, feet - 1, L * 0.24, L * 0.08, 'fur');
    thick(b, Math.round(bx - L * 0.28 - (frame === 'walk' ? L * 0.15 : 0)), Math.round(by + L * 0.1), Math.round(bx - L * 0.3 - (frame === 'walk' ? L * 0.25 : 0)), feet, 2, 'fur');
    if (look.tail === 'long') thick(b, Math.round(bx + L * 0.35), Math.round(by + L * 0.1), Math.round(bx + L * 0.95), Math.round(feet - 1), Math.max(2, Math.round(L * 0.09)), 'fur'); // a kangaroo's big tail
    else tail(b, { ...look, tail: 'short', tailTag: look.belly ? 'belly' : 'fur' }, bx + L * 0.4, by - L * 0.05, L * 0.2, frame);
    const r = L * 0.22;
    const eye = head(b, { ...look, snout: look.snout ?? 0.45, ears: look.ears || 'long' }, bx - L * 0.35, by - L * (look.tall ?? 0.25) + (frame === 'walk' ? L * 0.08 : 0), r, frame);
    if (look.dark && look.ears === 'long') { /* black ear tips (hares) are drawn by ears() */ }
    return { feet, eye };
  },

  /** Low and long: squirrels, chipmunks, raccoons, marmots, otters on land, foxes in the snow. */
  small(b, look, frame) {
    const L = look.len;
    const by = L * 0.95; const bx = L * 0.75; const feet = Math.round(by + L * 0.32);
    if (frame === 'peek') {
      if (look.quills) { b.body = { x: bx - L * 0.21, y: by - L * 0.15, rx: L * 0.34, ry: L * 0.3, peek: true }; quillCoat(b, look, b.body, frame); }
      ell(b, bx - L * 0.2, by + L * 0.15, L * 0.22, L * 0.22, 'fur');
      const eye = head(b, look, bx - L * 0.22, by - L * 0.12, L * 0.2, 'pose');
      return { feet: Math.round(by + L * 0.3), eye };
    }
    const upright = frame === 'pose' && look.sits;
    if (upright) {
      b.body = { x: bx - L * 0.1, y: by, rx: L * 0.2, ry: L * 0.34, upright: true };
      if (look.quills) quillCoat(b, look, b.body, frame);
      ell(b, bx - L * 0.1, by, L * 0.2, L * 0.34, 'fur');
      if (look.belly) ell(b, bx - L * 0.15, by + L * 0.05, L * 0.12, L * 0.24, 'belly');
      tail(b, look, bx + L * 0.05, by + L * 0.15, L * 0.22, frame);
      b.rect(Math.round(bx - L * 0.22), feet - 1, Math.round(L * 0.3), 1, 'fur', 'fur');
      const eye = head(b, look, bx - L * 0.12, by - L * 0.42, L * 0.18, 'pose');
      return { feet, eye };
    }
    const sw = frame === 'walk' ? L * 0.08 : 0;
    for (const [i, lx] of (look.manyLegs ? [bx - L * 0.3, bx - L * 0.1, bx + L * 0.1, bx + L * 0.28] : [bx - L * 0.28, bx + L * 0.22]).entries()) thick(b, Math.round(lx), Math.round(by + L * 0.1), Math.round(lx + (i % 2 ? sw : -sw)), feet, 2, 'dark');
    b.body = { x: bx, y: by, rx: L * 0.4, ry: L * (look.bodyH ?? 0.2) };
    if (look.quills) quillCoat(b, look, b.body, frame);
    ell(b, bx, by, L * 0.4, L * (look.bodyH ?? 0.2), 'fur');
    if (look.spines) { // a hedgehog: a spiky coat over the back
      const bh = L * (look.bodyH ?? 0.2);
      for (let k = -0.32; k <= 0.42; k += 0.09) { const sx = bx + k * L; const sy = by - bh * Math.sqrt(Math.max(0, 1 - (k / 0.42) ** 2)) * 0.95; thick(b, Math.round(sx), Math.round(sy + 2), Math.round(sx + 1), Math.round(sy - 2), 1, 'dark'); }
      ell(b, bx + L * 0.05, by - bh * 0.15, L * 0.32, bh * 0.7, 'dark');
      for (let k = 0; k < 7; k += 1) px(b, Math.round(bx - L * 0.2 + k * L * 0.08), Math.round(by - bh * 0.3 + (k % 2) * 2), 'fur');
    }
    if (look.belly) ell(b, bx - L * 0.05, by + L * 0.1, L * 0.28, L * 0.09, 'belly');
    if (look.mark === 'spines') for (let x = -L * 0.34; x <= L * 0.36; x += 2) { const hh = Math.round(L * (look.bodyH ?? 0.2) * Math.sqrt(Math.max(0, 1 - (x / (L * 0.4)) ** 2))); for (let k = 0; k < 3; k += 1) px(b, Math.round(bx + x + k * 0.5), Math.round(by - hh - k + 1), k === 2 ? 'belly' : 'dark'); }
    if (look.mark === 'stripes') for (let k = 0; k < 3; k += 1) thick(b, Math.round(bx - L * 0.25), Math.round(by - L * 0.12 + k * 3), Math.round(bx + L * 0.3), Math.round(by - L * 0.12 + k * 3), 1, k === 1 ? 'belly' : 'dark');
    tail(b, look, bx + L * 0.35, by - L * 0.05, L * 0.22, frame);
    const eye = head(b, look, bx - L * 0.42, by - L * 0.12, L * (look.headR ?? 0.18), frame);
    return { feet, eye };
  },

  /** Perching birds: cardinals, jays, puffins, parrots, toucans. Wings out on 'fly'. */
  bird(b, look, frame) {
    const L = look.len;
    const by = L * 0.9; const bx = L * 0.8; const feet = Math.round(by + L * 0.42);
    const fly = frame === 'fly' || frame === 'walk';
    if (!fly) {
      const legT = look.feet ? 'feet' : 'dark'; const legC = look.feet || 'dark';
      thick(b, Math.round(bx - 1), Math.round(by + L * 0.2), Math.round(bx - 1), feet, 1, legT === 'feet' ? 'feet' : 'dark');
      thick(b, Math.round(bx + 2), Math.round(by + L * 0.2), Math.round(bx + 2), feet, 1, legT === 'feet' ? 'feet' : 'dark');
      if (look.feet) { b.each((x, y) => { if (b.tag(x, y) === 'feet') b.set(x, y, legC, 'feet'); }); b.rect(Math.round(bx - 4), feet, 4, 1, legC, 'feet'); b.rect(Math.round(bx + 1), feet, 4, 1, legC, 'feet'); }
    }
    // tail
    if (look.tail === 'long') thick(b, Math.round(bx + L * 0.25), Math.round(by + L * 0.05), Math.round(bx + L * 0.75), Math.round(by + L * (fly ? 0.05 : 0.45)), 2, look.tailTag || 'fur');
    else thick(b, Math.round(bx + L * 0.25), Math.round(by + L * 0.05), Math.round(bx + L * 0.5), Math.round(by + L * (fly ? 0.05 : 0.3)), 2, look.tailTag || 'fur');
    if (look.train && frame === 'pose') { // the peacock fans his train up behind him
      for (let a = Math.PI * 1.05; a <= Math.PI * 1.95; a += 0.025) for (let rr = L * 0.25; rr < L * 0.95; rr += 1) b.set(Math.round(bx + L * 0.15 + Math.cos(a) * rr), Math.round(by + L * 0.1 + Math.sin(a) * rr), 'accent', 'accent');
      for (let a = Math.PI * 1.1; a <= Math.PI * 1.9; a += 0.14) for (const rr of [L * 0.62, L * 0.86]) { const ex = Math.round(bx + L * 0.15 + Math.cos(a) * rr); const ey = Math.round(by + L * 0.1 + Math.sin(a) * rr); ell(b, ex, ey, 1.6, 1.6, 'eyespot', '#fcc419'); b.set(ex, ey, '#1c3d8a', 'eyespot'); }
    } else if (look.train) { // trailing behind
      for (let k = 0; k < L * 0.9; k += 1) { const hh = Math.max(1, Math.round(L * 0.1 * (1 - k / (L * 1.2)))); for (let y = -hh; y <= hh; y += 1) b.set(Math.round(bx + L * 0.2 + k), Math.round(by + L * 0.15 + k * (fly ? 0 : 0.25) + y), 'accent', 'accent'); if (k % 6 === 4) b.set(Math.round(bx + L * 0.2 + k), Math.round(by + L * 0.15 + k * (fly ? 0 : 0.25)), '#fcc419', 'eyespot'); }
    }
    ell(b, bx, by, L * 0.32, L * 0.25, 'fur');
    if (look.belly) ell(b, bx - L * 0.08, by + L * 0.1, L * 0.2, L * 0.14, 'belly');
    // wing
    if (fly) {
      const up = frame === 'fly';
      for (let t = 0; t < 4; t += 1) thick(b, Math.round(bx - L * 0.05), Math.round(by - L * 0.05), Math.round(bx + L * (0.1 + t * 0.12)), Math.round(by + (up ? -L * (0.7 - t * 0.08) : L * (0.35 - t * 0.05))), 2, t === 3 && look.mark === 'wingbar' ? 'accent' : 'fur');
    } else {
      ell(b, bx + L * 0.06, by - L * 0.02, L * 0.22, L * 0.15, look.wingTag || 'fur');
      if (look.mark === 'wingbar') thick(b, Math.round(bx - L * 0.05), Math.round(by), Math.round(bx + L * 0.2), Math.round(by), 1, 'accent');
    }
    const r = L * 0.2;
    const hx = bx - L * 0.28; const hy = by - L * 0.3;
    b.hd = { x: hx, y: hy, r, ry: r, pose: frame === 'pose' };
    if (look.extra === 'crest') { thick(b, Math.round(hx), Math.round(hy - r), Math.round(hx + r * 0.8), Math.round(hy - r * 2), 2, 'fur'); }
    ell(b, hx, hy, r, r, 'fur');
    if (look.mark === 'cap') ell(b, hx, hy - r * 0.5, r * 0.9, r * 0.45, 'dark');
    if (look.mark === 'mask') ell(b, hx - r * 0.4, hy + r * 0.1, r * 0.55, r * 0.45, 'dark');
    if (look.mark === 'chest') ell(b, hx + r * 0.1, hy + r * 1.2, r * 0.7, r * 0.6, 'accent');
    if (look.face) { ell(b, hx - r * 0.15, hy + r * 0.1, r * 0.7, r * 0.6, 'face', look.face); if (look.tufts) for (let k = 0; k < 4; k += 1) b.set(Math.round(hx + r * 0.4 + k), Math.round(hy - r * 0.5 + k * 0.6), look.tufts, 'tuft'); }
    // beak
    const bl = Math.max(2, Math.round(L * (look.bill ?? 0.14)));
    const pose = frame === 'pose';
    if (pose) { b.rect(Math.round(hx - 1), Math.round(hy + r * 0.3), 2, Math.max(1, Math.round(bl * 0.6)), 'beak', 'beak'); }
    else for (let k = 0; k < bl; k += 1) b.rect(Math.round(hx - r - k), Math.round(hy + (look.bigBill ? -1 : 0)), 1, Math.max(1, Math.round((look.bigBill ? 4 : 2) * (1 - k / bl))) + 1, 'beak', 'beak');
    const eye = eyes(b, look, hx, hy - 0.5, Math.max(4, r), frame);
    return { feet, eye };
  },

  /** Owls and eagles: upright, broad. Owls turn their whole face to you. */
  'big-bird'(b, look, frame) {
    const L = look.len;
    const by = L * 0.95; const bx = L * 0.75; const feet = Math.round(by + L * 0.45);
    const fly = frame === 'fly' || frame === 'walk';
    if (fly) {
      const up = frame === 'fly';
      ell(b, bx, by, L * 0.35, L * 0.18, 'fur');
      for (let s = -1; s <= 1; s += 2) for (let t = 0; t < 5; t += 1) thick(b, Math.round(bx + s * L * 0.05), Math.round(by - L * 0.05), Math.round(bx + s * L * (0.25 + t * 0.12)), Math.round(by + (up ? -L * (0.5 - t * 0.05) : L * (0.25 + t * 0.02))), 2, t > 3 && look.mark === 'wingbar' ? 'dark' : 'fur');
      ell(b, bx - L * 0.35, by - L * 0.08, L * 0.15, L * 0.14, look.headTag || 'fur');
      b.rect(Math.round(bx - L * 0.5 - 2), Math.round(by - L * 0.08), 3, 2, 'beak', 'beak');
      if (look.tail !== 'none') thick(b, Math.round(bx + L * 0.3), Math.round(by), Math.round(bx + L * 0.55), Math.round(by), 3, look.tailTag || 'fur');
      return { feet: Math.round(by + L * 0.2), eye: [Math.round(bx - L * 0.38), Math.round(by - L * 0.1)] };
    }
    thick(b, Math.round(bx - 2), Math.round(by + L * 0.3), Math.round(bx - 2), feet, 2, 'beak');
    thick(b, Math.round(bx + 2), Math.round(by + L * 0.3), Math.round(bx + 2), feet, 2, 'beak');
    if (!look.owl) { // hawks and eagles: slimmer, leaning forward, tail showing below
      thick(b, Math.round(bx + L * 0.1), Math.round(by + L * 0.2), Math.round(bx + L * 0.2), Math.round(feet + L * 0.08), 4, look.tailTag || 'fur');
      ell(b, bx + L * 0.04, by + L * 0.08, L * 0.22, L * 0.3, 'fur');
      ell(b, bx - L * 0.06, by - L * 0.14, L * 0.19, L * 0.24, 'fur');
      if (look.belly) ell(b, bx - L * 0.1, by, L * 0.12, L * 0.22, 'belly');
      ell(b, bx + L * 0.1, by + L * 0.02, L * 0.13, L * 0.32, 'fur'); // folded wing down to the tail
      thick(b, Math.round(bx + L * 0.12), Math.round(by + L * 0.2), Math.round(bx + L * 0.18), Math.round(by + L * 0.38), 2, 'dark');
      const r = L * 0.2; const hx = bx - L * 0.2; const hy = by - L * 0.42;
      ell(b, hx, hy, r, r * 0.9, look.headTag || 'fur');
      if (frame === 'pose') {
        for (const s2 of [-1, 1]) { const ex = Math.round(hx + s2 * r * 0.45); b.rect(ex - 1, Math.round(hy) - 1, 2, 2, look.eye || INK, 'eye'); b.set(ex - 1, Math.round(hy) - 1, '#ffffff', 'shine'); b.rect(ex - 1, Math.round(hy) - 2, 3, 1, 'dark', 'dark'); }
        b.rect(Math.round(hx), Math.round(hy + r * 0.25), 2, 2, 'beak', 'beak'); b.set(Math.round(hx), Math.round(hy + r * 0.25) + 2, 'beak', 'beak');
        return { feet, eye: [Math.round(hx), Math.round(hy)] };
      }
      // hooked beak: out, then down at the tip
      const bx0 = Math.round(hx - r);
      b.rect(bx0 - 3, Math.round(hy), 4, 2, 'beak', 'beak'); b.set(bx0 - 3, Math.round(hy) + 2, 'beak', 'beak'); b.set(bx0 - 4, Math.round(hy) + 1, 'beak', 'beak');
      const ex = Math.round(hx - r * 0.35); const ey = Math.round(hy - 1);
      b.rect(ex - 1, ey - 1, 2, 2, look.eye || INK, 'eye'); b.set(ex - 1, ey - 1, '#ffffff', 'shine');
      b.rect(ex - 2, ey - 2, 4, 1, 'dark', 'dark'); // brow
      return { feet, eye: [ex, ey] };
    }
    ell(b, bx, by, L * 0.3, L * 0.4, 'fur');
    if (look.belly) ell(b, bx - L * 0.06, by + L * 0.06, L * 0.18, L * 0.28, 'belly');
    if (look.mark === 'spots') for (let k = 0; k < 7; k += 1) px(b, Math.round(bx - L * 0.15 + ((k * 5) % 7)), Math.round(by - L * 0.1 + ((k * 3) % 6) * 2), 'dark');
    ell(b, bx + L * 0.12, by, L * 0.16, L * 0.3, 'fur'); // folded wing
    const r = L * 0.22;
    const hx = bx - L * 0.05; const hy = by - L * 0.48;
    const owl = look.owl;
    ell(b, hx, hy, r * 1.05, r, look.headTag || 'fur');
    if (owl && look.ears === 'tuft') for (const s of [-1, 1]) thick(b, Math.round(hx + s * r * 0.6), Math.round(hy - r * 0.7), Math.round(hx + s * r * 0.85), Math.round(hy - r * 1.4), 2, 'fur');
    if (owl || frame === 'pose') {
      // a face toward you: owls always, eagles when they pose
      if (owl) { ell(b, hx - r * 0.42, hy, r * 0.42, r * 0.42, 'belly'); ell(b, hx + r * 0.42, hy, r * 0.42, r * 0.42, 'belly'); }
      const blink = owl && frame !== 'pose' && frame !== 'stand';
      for (const s of [-1, 1]) {
        const ex = Math.round(hx + s * r * 0.42); const ey = Math.round(hy);
        if (blink) b.rect(ex - 1, ey, 2, 1, INK, 'eye');
        else { b.rect(ex - 1, ey - 1, 2, 2, look.eye || INK, 'eye'); if (look.eye) b.set(ex, ey, INK, 'eye'); b.set(ex - 1, ey - 1, '#ffffff', 'shine'); }
      }
      b.rect(Math.round(hx), Math.round(hy + r * 0.3), 1, 2, 'beak', 'beak');
      return { feet, eye: [Math.round(hx), Math.round(hy)] };
    }
    for (let k = 0; k < 3; k += 1) b.rect(Math.round(hx - r - k), Math.round(hy), 1, 3 - k, 'beak', 'beak');
    const eye = eyes(b, look, hx - 1, hy - 0.5, Math.max(4, r), frame);
    return { feet, eye };
  },

  /** Herons, cranes, flamingos: long legs, long neck. */
  wader(b, look, frame) {
    const L = look.len;
    const bx = L * 0.8; const by = L * 0.9; const feet = Math.round(by + L * 0.9);
    const fly = frame === 'fly' || frame === 'walk';
    if (fly) thick(b, Math.round(bx), Math.round(by + L * 0.1), Math.round(bx + L * 0.5), Math.round(by + L * 0.12), 1, 'beak');
    else { thick(b, Math.round(bx - 1), Math.round(by + L * 0.1), Math.round(bx - 2), feet, 1, 'beak'); thick(b, Math.round(bx + 2), Math.round(by + L * 0.1), Math.round(bx + 3), feet, 1, 'beak'); b.rect(Math.round(bx - 4), feet, 3, 1, 'beak', 'beak'); b.rect(Math.round(bx + 1), feet, 3, 1, 'beak', 'beak'); }
    // body: a sloped oval (tail end low)
    ell(b, bx, by, L * 0.28, L * 0.13, 'fur'); ell(b, bx + L * 0.16, by + L * 0.05, L * 0.16, L * 0.09, 'fur');
    if (fly) for (const up of [true]) for (let t = 0; t < 4; t += 1) thick(b, Math.round(bx), Math.round(by), Math.round(bx + L * (0.05 + t * 0.12)), Math.round(by + (frame === 'fly' === up ? -L * 0.6 : L * 0.3)), 2, t === 3 ? 'dark' : 'fur');
    const hx = bx - L * (fly ? 0.65 : 0.3); const hy = by - L * (fly ? 0.05 : 0.65);
    if (fly) thick(b, Math.round(bx - L * 0.2), Math.round(by - L * 0.05), Math.round(hx + 1), Math.round(hy + 1), 2, 'fur');
    else { // an S-curved neck
      const mx = bx - L * 0.12; const my = by - L * 0.35;
      thick(b, Math.round(bx - L * 0.2), Math.round(by - L * 0.05), Math.round(mx), Math.round(my), 2, 'fur');
      thick(b, Math.round(mx), Math.round(my), Math.round(hx + 1), Math.round(hy + 2), 2, 'fur');
    }
    ell(b, hx, hy, L * 0.09, L * 0.08, look.face ? 'face' : 'fur', look.face || 'fur');
    const bl = Math.round(L * (look.bill ?? 0.3));
    if (frame === 'pose') b.rect(Math.round(hx - 1), Math.round(hy + 1), 2, Math.round(bl * 0.4), 'beak', 'beak');
    else thick(b, Math.round(hx - 2), Math.round(hy), Math.round(hx - 2 - bl), Math.round(hy + (look.bent ? 3 : 1)), 1, 'beak');
    if (look.mark === 'cap') thick(b, Math.round(hx - 1), Math.round(hy - 1), Math.round(hx + L * 0.15), Math.round(hy - 2), 1, 'dark');
    const eye = eyes(b, look, hx + 1, hy - 0.5, 3, frame === 'pose' ? 'pose' : 'stand');
    return { feet, eye };
  },

  /** In the water: a back, a head, and (whales) a fin or a tail. Only the part above the water line is drawn. */
  swim(b, look, frame) {
    const L = look.len;
    const wy = Math.round(L * 0.9); // the water line
    const bx = L * 0.8;
    const kind = look.swim || 'head'; // 'head' (seal, otter), 'back' (whale, orca, dolphin), 'float' (otter on its back)
    if (kind === 'leap') { // a dolphin jumping in an arc: a beak, a smile, a fin and a fluke
      const hgt = L * (frame === 'walk' ? 0.32 : 0.42); const th = Math.max(3, Math.round(L * 0.13));
      const pt = (t) => [bx - L * 0.5 + t * L, wy - Math.sin(t * Math.PI) * hgt];
      for (let t = 0.08; t <= 0.92; t += 0.02) { const [x, y] = pt(t); const w = Math.round(th * (0.55 + Math.sin(t * Math.PI) * 0.5)); b.rect(Math.round(x), Math.round(y - w / 2), 1, w, 'fur', 'fur'); }
      for (let t = 0.2; t <= 0.8; t += 0.03) { const [x, y] = pt(t); b.set(Math.round(x), Math.round(y + th * 0.4), 'belly', 'belly'); }
      const [hx, hy] = pt(0.12); const [fx, fy] = pt(0.5); const [tx, ty] = pt(0.9);
      thick(b, Math.round(hx - 1), Math.round(hy + 1), Math.round(hx - 4), Math.round(hy + 3), 2, 'fur'); // the beak
      b.set(Math.round(hx - 1), Math.round(hy + 2), INK, 'smile'); b.set(Math.round(hx), Math.round(hy + 2), INK, 'smile');
      b.set(Math.round(hx + 1), Math.round(hy - 1), INK, 'eye');
      for (let k = 0; k < 4; k += 1) b.rect(Math.round(fx - k * 0.4), Math.round(fy - th * 0.5 - k), Math.max(1, 3 - k), 1, 'dark', 'dark');
      for (const s of [-1, 1]) thick(b, Math.round(tx), Math.round(ty), Math.round(tx + 3), Math.round(ty + s * 3), 1, 'fur');
      const after = [];
      for (let x = Math.round(bx - L * 0.6); x <= Math.round(bx + L * 0.6); x += 1) if ((x & 3) !== 3) after.push([x, wy + 1, '#ffffff']);
      return { feet: wy, eye: [Math.round(hx + 1), Math.round(hy - 1)], after };
    }
    if (kind === 'back') {
      const arch = frame === 'walk' ? 0.6 : frame === 'pose' ? 1 : 0.8;
      for (let x = -L * 0.5; x <= L * 0.5; x += 1) { const hgt = Math.round(L * (look.back ?? 0.16) * arch * Math.cos((x / L) * Math.PI)); for (let y = 0; y < hgt; y += 1) b.set(Math.round(bx + x), wy - y, 'fur', 'fur'); }
      if (look.rostrum) { thick(b, Math.round(bx - L * 0.5), wy - Math.round(L * 0.03), Math.round(bx - L * 0.6), wy - 1, 2, 'fur'); b.set(Math.round(bx - L * 0.44), wy - Math.round(L * 0.08 * arch) - 1, INK, 'eye'); }
      if (look.roundSnout) { ell(b, bx - L * 0.5, wy - L * 0.06, L * 0.07, L * 0.06, 'fur'); b.set(Math.round(bx - L * 0.5), wy - Math.round(L * 0.08), INK, 'eye'); b.set(Math.round(bx - L * 0.56), wy - Math.round(L * 0.04), INK, 'nose'); }
      if (look.fin) { const fh = Math.round(L * (look.fin === 'tall' ? 0.32 : look.fin === 'mid' ? 0.2 : 0.12) * arch); for (let k = 0; k < fh; k += 1) b.rect(Math.round(bx + L * 0.05 - k * 0.25), wy - Math.round(L * 0.15 * arch) - k, Math.max(1, Math.round((fh - k) * 0.45)), 1, 'dark', 'dark'); }
      if (look.mark === 'patch') { ell(b, bx - L * 0.3, wy - L * 0.09 * arch, Math.max(2, L * 0.05), Math.max(1.4, L * 0.025), 'belly'); ell(b, bx + L * 0.16, wy - L * 0.17 * arch, L * 0.08, L * 0.03, 'accent'); }
      if (frame === 'pose' && look.fluke !== false) { // the tail fluke up out of the water
        const fx = bx + L * 0.42; const fw = Math.max(7, L * 0.13); const ftop = wy - Math.round(L * 0.26);
        thick(b, Math.round(fx), wy, Math.round(fx + 1), ftop + 2, Math.max(2, Math.round(L * 0.03)), 'fur');
        for (const sd of [-1, 1]) for (let t = 0; t <= 1; t += 0.1) { const x = fx + 1 + sd * t * fw; const y = ftop + 2 - Math.sin(t * Math.PI * 0.8) * 2 - t * 2; b.rect(Math.round(x), Math.round(y), 1, Math.max(2, Math.round(4 - t * 2)), 'fur', 'fur'); }
      }
      if (frame === 'pose' && look.spout !== false) { // a puff of spray over the blowhole
        const sx = bx - L * 0.3; const sy = wy - Math.round(L * (look.back ?? 0.16)) - 4;
        for (const [dx, dy, rr] of [[0, 0, 2.2], [-3, -3, 2.6], [3, -3, 2.6], [0, -6, 3]]) ell(b, sx + dx, sy + dy, rr, rr * 0.8, 'spray', '#e7f5ff');
      }
      return { feet: wy, eye: [Math.round(bx - L * 0.35), wy - 2] };
    }
    if (kind === 'swan') { // a swan gliding: a white body on the water, an S-curved neck, an orange beak
      ell(b, bx, wy - L * 0.08, L * 0.32, L * 0.12, 'fur');
      ell(b, bx + L * 0.08, wy - L * 0.16, L * 0.2, L * 0.09, 'fur'); // folded wings, raised
      const pose = frame === 'pose';
      const nx = bx - L * 0.26; const hx = bx - L * (pose ? 0.3 : 0.36); const hy = wy - L * 0.5;
      thick(b, Math.round(nx), Math.round(wy - L * 0.1), Math.round(nx - L * 0.06), Math.round(wy - L * 0.3), 3, 'fur');
      thick(b, Math.round(nx - L * 0.06), Math.round(wy - L * 0.3), Math.round(hx + 1), Math.round(hy + 2), 3, 'fur');
      ell(b, hx, hy, L * 0.07, L * 0.06, 'fur');
      if (pose) { b.rect(Math.round(hx) - 1, Math.round(hy + 2), 2, 3, 'beak', 'beak'); for (const s2 of [-1, 1]) b.set(Math.round(hx + s2 * 2), Math.round(hy), INK, 'eye'); }
      else { b.rect(Math.round(hx - L * 0.07) - 3, Math.round(hy), 4, 2, 'beak', 'beak'); b.set(Math.round(hx - L * 0.07), Math.round(hy - 1), 'dark', 'dark'); b.set(Math.round(hx - 1), Math.round(hy - 1), INK, 'eye'); }
      b.each((x, y) => { if (y > wy) b.del(x, y); });
      const after = [];
      for (let x = Math.round(bx - L * 0.45); x <= Math.round(bx + L * 0.4); x += 1) if ((x & 3) !== 2) after.push([x, wy + 1, '#ffffff']);
      return { feet: wy, eye: [Math.round(hx), Math.round(hy)], after };
    }
    if (kind === 'float') { // otter on its back: pale face, paws on the chest holding a shell, feet up
      ell(b, bx, wy - L * 0.06, L * 0.34, L * 0.11, 'fur');
      ell(b, bx - L * 0.02, wy - L * 0.12, L * 0.2, L * 0.06, 'belly');
      for (const fx of [bx + L * 0.28, bx + L * 0.36]) { thick(b, Math.round(fx), Math.round(wy - L * 0.1), Math.round(fx + 1), Math.round(wy - L * 0.24), 2, 'dark'); }
      const hr = L * 0.15; const hx = bx - L * 0.36; const hy = wy - L * 0.14;
      ell(b, hx, hy, hr, hr * 0.9, 'belly');
      for (const s2 of [-1, 1]) ell(b, hx + s2 * hr * 0.7, hy - hr * 0.8, 1.3, 1.3, 'fur');
      for (const s2 of [-1, 1]) { b.set(Math.round(hx + s2 * hr * 0.4), Math.round(hy - 1), INK, 'eye'); }
      if (frame === 'pose') for (const s2 of [-1, 1]) b.set(Math.round(hx + s2 * hr * 0.4), Math.round(hy - 2), '#ffffff', 'shine');
      b.rect(Math.round(hx) - 1, Math.round(hy + 1), 2, 1, INK, 'nose');
      // forepaws on the chest, holding a shell
      thick(b, Math.round(bx - L * 0.16), Math.round(wy - L * 0.12), Math.round(bx - L * 0.1), Math.round(wy - L * 0.22), 2, 'dark');
      ell(b, bx - L * 0.12, wy - L * 0.24, 2, 1.5, 'accent');
      const after = [];
      for (let x = Math.round(bx - L * 0.55); x <= Math.round(bx + L * 0.45); x += 1) if ((x & 3) !== 3) after.push([x, wy + 1, '#ffffff']);
      return { feet: wy, eye: [Math.round(hx), Math.round(hy)], after };
    }
    if (look.seal) { // a round dome head looking at you, big dark eyes, whiskers, a ripple
      const r = L * (look.headR ?? 0.18); const up = frame === 'peek' ? 0.55 : 1;
      ell(b, bx + r * 1.3, wy, r * 1.5, r * 0.55, 'fur'); // back hump behind
      const hx = bx - r * 0.2; const hy = wy - r * 0.9 * up;
      ell(b, hx, wy - r * 0.2, r * 1.0, r * 0.9 * up + 1, 'fur');
      ell(b, hx, hy, r * 1.2, r * 0.95, 'fur');
      const pose = frame === 'pose' || frame === 'peek';
      const exs = pose ? [hx - r * 0.5, hx + r * 0.5] : [hx - r * 0.75, hx + r * 0.05];
      ell(b, pose ? hx : hx - r * 0.55, hy + r * 0.45, r * 0.5, r * 0.32, 'belly');
      for (const ex of exs) { b.rect(Math.round(ex) - 1, Math.round(hy) - 1, 2, 2, INK, 'eye'); b.set(Math.round(ex) - 1, Math.round(hy) - 1, '#ffffff', 'shine'); }
      const nx = Math.round(pose ? hx : hx - r * 0.75); b.rect(nx - 1, Math.round(hy + r * 0.3), 2, 1, INK, 'nose');
      for (const s2 of [-1, 1]) { b.set(nx + s2 * 2, Math.round(hy + r * 0.5), '#f1f3f5', 'whisker'); b.set(nx + s2 * 3, Math.round(hy + r * 0.45), '#f1f3f5', 'whisker'); }
      if (look.mark === 'spots') for (let k = 0; k < 4; k += 1) px(b, Math.round(hx + r * 0.6 + k * 2), Math.round(hy - r * 0.4 + (k % 2) * 2), 'dark');
      b.each((x, y) => { if (y > wy) b.del(x, y); });
      const after = [];
      for (let x = Math.round(hx - r * 2); x <= Math.round(bx + r * 2.6); x += 1) if ((x & 3) !== 1) after.push([x, wy + 1, '#ffffff']);
      return { feet: wy, eye: [Math.round(hx), Math.round(hy)], after };
    }
    // a head and neck out of the water (seal, otter, turtle, crocodile eyes)
    const r = L * (look.headR ?? 0.16);
    const up = frame === 'peek' ? 0.5 : 1;
    thick(b, Math.round(bx), wy, Math.round(bx - r * 0.2), Math.round(wy - r * 1.3 * up), Math.round(r * 1.6), 'fur');
    if (look.shell) ell(b, bx + r * 1.6, wy, r * 2.2, r * 0.9, 'shell');
    const eye = head(b, look, bx - r * 0.2, wy - r * 1.6 * up, r, frame === 'peek' ? 'pose' : frame);
    if (look.whiskers) for (const s of [-1, 1]) thick(b, Math.round(bx - r * 0.2 + s * r * (frame === 'pose' ? 0.7 : 0) - (frame === 'pose' ? 0 : r)), Math.round(wy - r * 1.3 * up), Math.round(bx - r * 0.2 + s * r * 1.4 - (frame === 'pose' ? 0 : r)), Math.round(wy - r * 1.2 * up), 1, 'belly');
    // cut everything below the water line
    b.each((x, y) => { if (y > wy) b.del(x, y); });
    return { feet: wy, eye };
  },

  /** Frogs and toads: crouched, big eyes on top. */
  frog(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.8; const feet = Math.round(by + L * 0.25);
    const jump = frame === 'walk';
    if (jump) { thick(b, Math.round(bx + L * 0.2), Math.round(by), Math.round(bx + L * 0.7), Math.round(by + L * 0.15), 2, 'fur'); thick(b, Math.round(bx - L * 0.2), Math.round(by), Math.round(bx - L * 0.5), Math.round(by + L * 0.1), 2, 'fur'); }
    else { ell(b, bx + L * 0.22, by + L * 0.12, L * 0.18, L * 0.12, 'fur'); thick(b, Math.round(bx - L * 0.2), Math.round(by), Math.round(bx - L * 0.25), feet, 2, 'fur'); }
    ell(b, bx, by, L * 0.34, L * 0.2, 'fur');
    ell(b, bx - L * 0.06, by + L * 0.08, L * 0.24, L * 0.1, 'belly');
    if (look.mark === 'spots') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.1 + k * 2.3), Math.round(by - L * 0.08 + (k % 2) * 2), 'dark');
    const pose = frame === 'pose';
    const spots = pose ? [bx - L * 0.14, bx + L * 0.06] : [bx - L * 0.18];
    for (const ex of spots) { ell(b, ex, by - L * 0.18, 2, 2, 'fur'); b.set(Math.round(ex), Math.round(by - L * 0.2), look.eye || INK, 'eye'); if (pose) b.set(Math.round(ex) - 1, Math.round(by - L * 0.21), '#ffffff', 'shine'); }
    if (pose && look.croak !== false) ell(b, bx - L * 0.3, by + L * 0.08, L * 0.12, L * 0.1, 'accent'); // throat puffed out
    return { feet, eye: [Math.round(spots[0]), Math.round(by - L * 0.2)] };
  },

  /** Lizards, salamanders, iguanas, crocodiles: long and low. */
  lizard(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.8; const feet = Math.round(by + L * 0.12);
    const sw = frame === 'walk' ? 2 : 0;
    for (const [i, lx] of [bx - L * 0.2, bx + L * 0.15].entries()) thick(b, Math.round(lx), Math.round(by), Math.round(lx + (i ? sw : -sw) - 1), feet, 1, 'fur');
    ell(b, bx, by, L * 0.28, L * 0.08, 'fur');
    thick(b, Math.round(bx + L * 0.25), Math.round(by), Math.round(bx + L * 0.75), Math.round(by + (frame === 'walk' ? -2 : 2)), Math.max(1, Math.round(L * 0.06)), 'fur');
    b.body = { x: bx, y: by, rx: L * 0.28, ry: L * 0.08 };
    if (look.extra === 'crest') for (let k = 0; k < L * 0.5; k += 2) px(b, Math.round(bx - L * 0.2 + k), Math.round(by - L * 0.1), 'accent');
    if (look.mark === 'spots') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.15 + k * 3), Math.round(by - 1), 'accent');
    if (look.mark === 'stripes') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.15 + k * 3), Math.round(by), 'dark');
    const hx = bx - L * 0.33; const hy = by - (frame === 'pose' ? L * 0.08 : L * 0.02);
    ell(b, hx, hy, L * 0.1, L * 0.065, look.face ? 'face' : 'fur', look.face || 'fur');
    b.hd = { x: hx, y: hy, r: L * 0.1, ry: L * 0.065, pose: frame === 'pose' };
    if (look.throat) ell(b, hx + L * 0.02, hy + L * 0.06, L * 0.07, L * 0.04, 'throat', look.throat);
    if (frame === 'pose') { b.set(Math.round(hx - L * 0.05), Math.round(hy - 1), INK, 'eye'); b.set(Math.round(hx + L * 0.03), Math.round(hy - 1), INK, 'eye'); }
    else b.set(Math.round(hx - L * 0.03), Math.round(hy - 1), INK, 'eye');
    return { feet, eye: [Math.round(hx), Math.round(hy - 1)] };
  },

  /** Butterflies, moths, dragonflies, bees, fireflies. 'fly' = wings up. */
  bug(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.7;
    const up = frame === 'fly';
    const pose = frame === 'pose' || frame === 'stand';
    if (look.dragon) {
      thick(b, Math.round(bx - L * 0.35), Math.round(by), Math.round(bx + L * 0.45), Math.round(by), 1, 'fur');
      for (const s of [-1, 1]) for (const dx of [-0.12, 0.05]) thick(b, Math.round(bx + dx * L), Math.round(by), Math.round(bx + dx * L + 1), Math.round(by + s * L * (up ? 0.35 : 0.25)), 2, 'belly');
      ell(b, bx - L * 0.38, by, 1.5, 1.5, 'fur');
      return { feet: Math.round(by + 2), eye: [Math.round(bx - L * 0.38), Math.round(by)] };
    }
    const span = up ? 0.25 : pose ? 0.5 : 0.4;
    for (const s of [-1, 1]) {
      ell(b, bx + s * L * span * 0.55, by - L * 0.12, L * span * 0.5, L * 0.22, 'fur');
      ell(b, bx + s * L * span * 0.45, by + L * 0.12, L * span * 0.38, L * 0.15, look.belly ? 'belly' : 'fur');
      if (look.mark === 'spots') { px(b, Math.round(bx + s * L * span * 0.7), Math.round(by - L * 0.15), 'accent'); px(b, Math.round(bx + s * L * span * 0.4), Math.round(by + L * 0.12), 'accent'); }
      if (look.mark === 'stripes') thick(b, Math.round(bx + s * 1), Math.round(by - L * 0.2), Math.round(bx + s * L * span), Math.round(by - L * 0.25), 1, 'dark');
    }
    thick(b, Math.round(bx), Math.round(by - L * 0.2), Math.round(bx), Math.round(by + L * 0.22), 1, 'dark');
    thick(b, Math.round(bx), Math.round(by - L * 0.22), Math.round(bx - 2), Math.round(by - L * 0.38), 1, 'dark');
    thick(b, Math.round(bx), Math.round(by - L * 0.22), Math.round(bx + 2), Math.round(by - L * 0.38), 1, 'dark');
    if (look.mark === 'glow') ell(b, bx, by + L * 0.2, 1.5, 1.5, 'accent');
    return { feet: Math.round(by + L * 0.25), eye: [Math.round(bx), Math.round(by - L * 0.2)] };
  },

  /** Bats: a furry body, big ears, wings of skin stretched over long fingers. */
  bat(b, look, frame) {
    const L = look.len;
    const bx = L * 0.9; const by = L * 0.7;
    const up = frame === 'fly' ? -1 : frame === 'walk' ? 0.4 : -0.3;
    for (const s of [-1, 1]) {
      const tipX = bx + s * L * 0.85; const tipY = by + up * L * 0.35;
      for (let t = 0; t <= 1; t += 0.04) {
        const x = bx + (tipX - bx) * t; const top = by - L * 0.05 + (tipY - by) * t;
        const bottom = by + L * 0.12 + (tipY - by) * t * 0.6 - Math.abs(Math.sin(t * Math.PI * 3)) * L * 0.1;
        for (let y = Math.round(top); y <= Math.round(Math.max(top, bottom)); y += 1) b.set(Math.round(x), y, 'belly', 'belly');
      }
      thick(b, Math.round(bx), Math.round(by - L * 0.05), Math.round(tipX), Math.round(tipY), 1, 'dark');
    }
    ell(b, bx, by, L * 0.14, L * 0.2, 'fur');
    for (const s of [-1, 1]) thick(b, Math.round(bx + s * L * 0.07), Math.round(by - L * 0.25), Math.round(bx + s * L * 0.12), Math.round(by - L * 0.42), 2, 'fur');
    const pose = frame === 'pose';
    b.set(Math.round(bx - 2), Math.round(by - L * 0.15), INK, 'eye'); b.set(Math.round(bx + 2), Math.round(by - L * 0.15), INK, 'eye');
    if (pose) { b.set(Math.round(bx - 2), Math.round(by - L * 0.16), '#ffffff', 'shine'); }
    return { feet: Math.round(by + L * 0.25), eye: [Math.round(bx), Math.round(by - L * 0.15)] };
  },

  /** Crabs: wide shell, claws up when posing. */
  crab(b, look, frame) {
    const L = look.len;
    const bx = L * 0.8; const by = L * 0.8; const feet = Math.round(by + L * 0.2);
    for (let k = 0; k < 3; k += 1) for (const s of [-1, 1]) thick(b, Math.round(bx + s * L * 0.15), Math.round(by), Math.round(bx + s * L * (0.32 + k * 0.05)), Math.round(feet - (k === 1 && frame === 'walk' ? 1 : 0)), 1, 'fur');
    ell(b, bx, by, L * 0.28, L * 0.15, 'fur');
    if (look.mark === 'shell') { // a hermit crab's borrowed snail shell on its back
      const sc = look.shellCol || '#e9d8b4'; const sx = bx + L * 0.12; const sy = by - L * 0.22;
      ell(b, sx, sy, L * 0.3, L * 0.26, 'shell', sc);
      for (let a = 0; a < 9; a += 0.5) b.set(Math.round(sx + Math.cos(a) * a * 0.55), Math.round(sy + Math.sin(a) * a * 0.55), '#8d6e63', 'shellLine');
    } else if (look.mark === 'bauble') bauble(b, look, bx + L * 0.14, by - L * 0.26, L * 0.29, frame); // a Christmas bauble for a shell
    const up = frame === 'pose' || frame === 'walk';
    for (const s of [-1, 1]) {
      const cx = bx + s * L * 0.35; const cy = by - (up ? L * 0.3 : L * 0.05);
      thick(b, Math.round(bx + s * L * 0.2), Math.round(by - 1), Math.round(cx), Math.round(cy), 1, 'fur');
      const big = look.bigClaw && s < 0 ? 1.45 : 1; // a hermit crab's one big claw (it shuts the door with it)
      ell(b, cx, cy, L * 0.09 * big, L * 0.08 * big, look.claw ? 'claw' : 'fur', look.claw || 'fur');
    }
    if (look.mark === 'bauble') { // eyes on stalks, poking out in front of the bauble
      const ex = Math.round(bx - L * 0.2); const ey = Math.round(by - L * 0.12);
      for (const d of frame === 'pose' ? [-2, 1] : [-1, 1]) { b.rect(ex + d, ey, 1, 3, 'fur', 'fur'); b.rect(ex + d - (d < 0 ? 0 : 0), ey - 2, 2, 2, INK, 'eye'); b.set(ex + d, ey - 2, '#ffffff', 'shine'); }
      return { feet, eye: [ex, ey - 2] };
    }
    for (const s of [-1, 1]) { b.set(Math.round(bx + s * 2), Math.round(by - L * 0.2), 'fur', 'fur'); b.set(Math.round(bx + s * 2), Math.round(by - L * 0.2) - 1, INK, 'eye'); }
    return { feet, eye: [Math.round(bx), Math.round(by - L * 0.2)] };
  },

  /** Snails and slugs. */
  snail(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.9; const feet = Math.round(by + 1);
    thick(b, Math.round(bx - L * 0.45), feet - 1, Math.round(bx + L * 0.3), feet - 1, 2, 'belly');
    if (look.shell === false) { // a sea slug: a soft body with frilly gills on the back
      ell(b, bx - L * 0.05, by - L * 0.06, L * 0.4, L * 0.1, 'fur');
      for (let k = 0; k < 5; k += 1) { const gx = bx - L * 0.25 + k * L * 0.12; thick(b, Math.round(gx), Math.round(by - L * 0.12), Math.round(gx + (k % 2 ? 1 : -1)), Math.round(by - L * 0.3 - (k % 2) * 2), 2, k % 2 ? 'accent' : 'fur'); }
      if (look.mark === 'spots') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.3 + k * L * 0.15), Math.round(by - L * 0.05), 'accent');
    } else {
      ell(b, bx, by - L * 0.2, L * 0.26, L * 0.24, 'fur');
      for (let a = 0; a < 9; a += 0.5) px(b, Math.round(bx + Math.cos(a) * a * 0.55), Math.round(by - L * 0.2 + Math.sin(a) * a * 0.55), 'dark');
    }
    const out = frame === 'pose' ? L * 0.3 : L * 0.2;
    thick(b, Math.round(bx - L * 0.42), feet - 2, Math.round(bx - L * 0.45), Math.round(feet - 2 - out), 1, 'belly');
    b.set(Math.round(bx - L * 0.45), Math.round(feet - 3 - out), INK, 'eye');
    return { feet, eye: [Math.round(bx - L * 0.45), Math.round(feet - 3 - out)] };
  },
  /** Fish: an oval body, a forked tail, a back fin. shape 'shark' is long with a tall fin; 'tall' is deep (angelfish, tangs). */
  fish(b, look, frame) {
    const L = look.len;
    const shark = look.shape === 'shark';
    const ry = L * (look.depth ?? (shark ? 0.13 : 0.22));
    const bx = L * 0.75; const by = L * 0.75;
    const sw = frame === 'walk' ? 1 : frame === 'fly' ? -1 : 0;
    // tail
    const tx = bx + L * 0.36; const tw = L * (shark ? 0.22 : 0.18); const th = Math.max(3, ry * (shark ? 1.5 : 1.1));
    for (let k = 0; k <= tw; k += 1) {
      const f = k / tw; const up = th * (0.25 + f * 0.75) * (shark ? 1.2 : 1); const dn = th * (0.25 + f * 0.75) * (shark ? 0.7 : 1);
      const off = Math.round(sw * f * 2);
      for (let y = Math.round(by - up) + off; y <= Math.round(by + dn) + off; y += 1) if (!(f > 0.65 && Math.abs(y - by - off) < th * (f - 0.65) * 1.6)) b.set(Math.round(tx + k), y, look.tailTag || 'fur', look.tailTag || 'fur');
    }
    ell(b, bx, by, L * (shark ? 0.42 : 0.4), ry, 'fur');
    if (shark || look.belly) ell(b, bx - L * 0.05, by + ry * 0.45, L * 0.32, ry * 0.45, 'belly');
    // back fin (and a belly fin)
    const fh = look.fin === false ? 0 : shark ? ry * 1.5 : ry * 0.6;
    for (let k = 0; k < fh; k += 1) b.rect(Math.round(bx - L * 0.05 + k * (shark ? 0.45 : 0.6)), Math.round(by - ry - k), Math.max(1, Math.round((fh - k) * (shark ? 0.6 : 1.4))), 1, look.finTag || 'dark', look.finTag || 'dark');
    if (look.finTip) for (let k = Math.round(fh * 0.6); k < fh; k += 1) b.set(Math.round(bx - L * 0.05 + k * (shark ? 0.45 : 0.6)), Math.round(by - ry - k), look.finTip, 'tip');
    thick(b, Math.round(bx - L * 0.12), Math.round(by + ry * 0.4), Math.round(bx - L * 0.02 + (frame === 'walk' ? 1 : 0)), Math.round(by + ry * 0.4 + Math.max(2, ry * 0.5)), 1, look.finTag || 'dark');
    if (look.mark === 'bands') for (const f of [-0.22, 0.05, 0.3]) { const x = Math.round(bx + f * L); for (let y = -ry; y <= ry; y += 1) if (b.get(x, Math.round(by + y))) { px(b, x, Math.round(by + y), 'accent'); px(b, x + 1, Math.round(by + y), 'accent'); px(b, x - 1, Math.round(by + y), 'dark'); px(b, x + 2, Math.round(by + y), 'dark'); } }
    if (look.mark === 'spots') for (let sx = Math.round(bx - L * 0.32); sx < bx + L * 0.4; sx += 3) for (let sy = Math.round(by - ry); sy < by + ry * 0.3; sy += 3) { const jx = sx + ((sy * 7) % 2); if (b.tag(jx, sy) === 'fur' && b.tag(jx, sy - 1) && b.tag(jx + 1, sy)) b.set(jx, sy, look.spotColor || '#e7f5ff', 'spot'); }
    if (look.mark === 'stripe') thick(b, Math.round(bx - L * 0.3), Math.round(by), Math.round(bx + L * 0.35), Math.round(by), 1, 'accent');
    if (look.mark === 'scales') for (let k = 0; k < 10; k += 1) px(b, Math.round(bx - L * 0.2 + (k % 5) * L * 0.1), Math.round(by - ry * 0.3 + Math.floor(k / 5) * ry * 0.6), 'dark');
    // head: a beak (parrotfish), a face color, the eye
    const hx = bx - L * 0.3; const hy = by - ry * 0.25;
    if (look.face) ell(b, hx + 1, hy + 1, L * 0.1, ry * 0.75, 'face', look.face);
    if (look.beak) b.rect(Math.round(bx - L * 0.43), Math.round(by), 2, 2, 'beak', 'beak');
    if (look.glow) b.rect(Math.round(hx) - 1, Math.round(hy) + 2, 3, 2, look.glow, 'glow');
    const pose = frame === 'pose';
    b.rect(Math.round(hx) - 1, Math.round(hy) - 1, 2, 2, look.eye || INK, 'eye');
    if (pose || L > 26) b.set(Math.round(hx) - 1, Math.round(hy) - 1, '#ffffff', 'shine');
    if (pose) b.rect(Math.round(bx - L * 0.42), Math.round(by + 1), 2, 1, INK, 'mouth');
    return { feet: Math.round(by + ry + 1), eye: [Math.round(hx), Math.round(hy)] };
  },

  /** Jellyfish and comb jellies: a see-through dome, trailing arms. 'fly' squeezes the dome (a pulse). */
  jelly(b, look, frame) {
    const L = look.len;
    const bx = L * 0.6; const top = L * 0.3;
    const squeeze = frame === 'fly' ? 0.8 : 1;
    const rx = L * 0.32 * squeeze; const ry = L * 0.24 / squeeze;
    const comb = look.comb;
    for (let y = 0; y <= (comb ? ry * 2 : ry); y += 1) {
      const yy = comb ? y - ry : y - ry;
      const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy * yy) / (ry * ry))));
      b.rect(Math.round(bx - half), Math.round(top + y), half * 2 + 1, 1, 'fur', 'fur');
    }
    const bottom = Math.round(top + (comb ? ry * 2 : ry));
    if (look.mark === 'rings') for (const s of [-1, 1]) for (const dx of [0.3, 0.6]) ell(b, bx + s * rx * dx - s, top + ry * 0.6, 1.4, 1.4, 'accent');
    if (comb) {
      const rain = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
      for (const s of [-0.6, -0.2, 0.2, 0.6]) for (let y = 1; y < ry * 2; y += 1) b.set(Math.round(bx + s * rx * Math.sqrt(Math.max(0, 1 - ((y - ry) / ry) ** 2))), Math.round(top + y), rain[(Math.floor(y / 2) + Math.round(s * 5) + 5 + (frame === 'walk' ? 1 : 0)) % rain.length], 'comb');
      for (const s of [-1, 1]) for (let y = 0; y < L * 0.5; y += 1) b.set(Math.round(bx + s * rx * 0.5 + Math.sin(y / 3 + s) * 1.5), bottom + 1 + y, 'belly', 'belly');
    } else {
      const wav = frame === 'walk' ? 1 : frame === 'fly' ? -1 : 0;
      for (let k = 0; k < 5; k += 1) {
        const ax = bx - rx * 0.8 + (k * rx * 1.6) / 4;
        for (let y = 0; y < L * (k % 2 ? 0.55 : 0.4); y += 1) b.set(Math.round(ax + Math.sin(y / 3 + k + wav) * 1.2), bottom + 1 + y, k % 2 ? 'belly' : 'dark', k % 2 ? 'belly' : 'dark');
      }
    }
    const pose = frame === 'pose';
    if (pose && look.eye !== false) for (const s of [-1, 1]) { b.set(Math.round(bx + s * rx * 0.3), Math.round(top + ry * 0.55), INK, 'eye'); b.set(Math.round(bx + s * rx * 0.3), Math.round(top + ry * 0.55) - 1, '#ffffff', 'shine'); }
    return { feet: Math.round(bottom + L * 0.3), eye: [Math.round(bx), Math.round(top + ry * 0.5)] };
  },

  /** Octopuses: a round head, big eyes, eight curling arms (spread wide when it poses). */
  octopus(b, look, frame) {
    const L = look.len;
    const bx = L * 0.75; const by = L * 0.55; const feet = Math.round(by + L * 0.42);
    const pose = frame === 'pose';
    for (let k = 0; k < 8; k += 1) {
      const a = Math.PI * (0.1 + (k / 7) * 0.8);
      const reach = L * (pose ? 0.55 : 0.42);
      let x = bx + Math.cos(a) * L * 0.12; let y = by + L * 0.12;
      const curl = (k % 2 ? 1 : -1) * (frame === 'walk' ? 1.4 : 1);
      for (let t = 0; t < 1; t += 0.06) {
        const dir = a + Math.sin(t * 3 + k) * 0.3 * curl;
        x += Math.cos(dir) * reach * 0.06 * (pose ? 1.4 : 1); y += Math.max(0.2, Math.sin(dir)) * reach * 0.06 * (pose ? 0.6 : 1);
        const w = t < 0.6 ? 2 : 1;
        b.rect(Math.round(x), Math.round(Math.min(y, feet)), w, w, k < 4 ? 'fur' : 'dark', k < 4 ? 'fur' : 'dark');
        if (t > 0.2 && Math.round(t * 16) % 3 === 0) b.set(Math.round(x), Math.round(Math.min(y, feet)) + 1, 'belly', 'belly');
      }
    }
    ell(b, bx + L * 0.05, by - L * 0.08, L * 0.2, L * 0.22, 'fur');
    ell(b, bx - L * 0.02, by + L * 0.1, L * 0.16, L * 0.08, 'fur');
    if (look.mark === 'spots') for (let k = 0; k < 6; k += 1) px(b, Math.round(bx - L * 0.06 + (k % 3) * 3), Math.round(by - L * 0.18 + Math.floor(k / 3) * 4), 'belly');
    const ex = pose ? [bx - L * 0.08, bx + L * 0.06] : [bx - L * 0.1];
    for (const x of ex) { ell(b, x, by + L * 0.04, 2, 2, 'belly'); b.rect(Math.round(x) - 1, Math.round(by + L * 0.04), 2, 1, INK, 'eye'); if (pose) b.set(Math.round(x), Math.round(by + L * 0.04) - 1, '#ffffff', 'shine'); }
    return { feet, eye: [Math.round(ex[0]), Math.round(by + L * 0.04)] };
  },

  /** Rays: a diamond seen a little from above, wings flapping, a long thin tail. */
  ray(b, look, frame) {
    const L = look.len;
    const bx = L * 0.6; const by = L * 0.6;
    const flap = frame === 'fly' ? -1 : frame === 'walk' ? 1 : 0;
    const head = [bx - L * 0.32, by]; const tailB = [bx + L * 0.22, by];
    const up = [bx + L * 0.02, by - L * 0.34 + flap * L * 0.08]; const dn = [bx + L * 0.02, by + L * 0.26 + flap * L * 0.06];
    const inTri = (x, y, a, b2, c) => { const s1 = (b2[0] - a[0]) * (y - a[1]) - (b2[1] - a[1]) * (x - a[0]); const s2 = (c[0] - b2[0]) * (y - b2[1]) - (c[1] - b2[1]) * (x - b2[0]); const s3 = (a[0] - c[0]) * (y - c[1]) - (a[1] - c[1]) * (x - c[0]); return (s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0); };
    for (let y = Math.floor(by - L * 0.5); y <= by + L * 0.4; y += 1) for (let x = Math.floor(bx - L * 0.4); x <= bx + L * 0.3; x += 1) {
      if (inTri(x, y, head, up, tailB)) b.set(x, y, 'fur', 'fur');
      else if (inTri(x, y, head, dn, tailB)) b.set(x, y, 'belly', 'belly');
    }
    thick(b, Math.round(tailB[0]), Math.round(by), Math.round(bx + L * 0.75), Math.round(by + (frame === 'walk' ? 2 : 1)), 1, 'dark');
    // the two horn-like fins by the mouth (mantas), and the eye
    for (const dy of [-2, 2]) thick(b, Math.round(head[0]), Math.round(by + dy), Math.round(head[0] - 3), Math.round(by + dy * 1.5), 1, 'fur');
    if (look.mark === 'spots') for (let k = 0; k < 10; k += 1) { const sx = Math.round(bx - L * 0.12 + ((k * 7) % 10) * L * 0.025); const sy = Math.round(by - L * 0.18 + ((k * 3) % 5) * 2); if (b.tag(sx, sy) === 'fur') px(b, sx, sy, 'accent'); }
    const ex = Math.round(head[0] + 4); const ey = Math.round(by - 2);
    b.set(ex, ey, INK, 'eye');
    if (frame === 'pose') { b.set(ex, ey - 1, '#ffffff', 'shine'); b.rect(Math.round(head[0]) - 1, Math.round(by), 3, 1, INK, 'mouth'); }
    return { feet: Math.round(dn[1] + 2), eye: [ex, ey] };
  },

  /** Turtles and tortoises: a domed shell with plates, a head on a neck. look.flippers for sea turtles (they swim). */
  turtle(b, look, frame) {
    const L = look.len;
    const sea = look.flippers;
    const bx = L * 0.75; const by = L * 0.8; const feet = Math.round(by + L * (sea ? 0.12 : 0.18));
    const domeH = L * (sea ? 0.2 : look.dome ?? 0.32);
    const sw = frame === 'walk' ? 2 : 0;
    if (sea) {
      const up = frame === 'fly' ? -1 : frame === 'walk' ? 0.5 : 0.2;
      thick(b, Math.round(bx - L * 0.2), Math.round(by - 1), Math.round(bx - L * 0.12 + 1), Math.round(by + up * L * 0.35 + L * 0.12), 3, 'fur');
      thick(b, Math.round(bx + L * 0.28), Math.round(by), Math.round(bx + L * 0.4), Math.round(by + L * 0.1), 2, 'fur');
    } else {
      for (const [i, lx] of [bx - L * 0.22, bx + L * 0.2].entries()) { b.rect(Math.round(lx + (i ? sw : -sw)) - 2, Math.round(by), Math.max(3, Math.round(L * 0.08)), feet - Math.round(by) + 1, 'fur', 'fur'); b.rect(Math.round(lx + (i ? sw : -sw)) - 2, feet, Math.max(3, Math.round(L * 0.08)), 1, 'dark', 'dark'); }
    }
    // shell
    for (let x = -L * 0.36; x <= L * 0.36; x += 1) {
      const h = Math.round(domeH * Math.sqrt(Math.max(0, 1 - (x / (L * 0.36)) ** 2)));
      for (let y = 0; y <= h; y += 1) b.set(Math.round(bx + x), Math.round(by - y), 'shell', 'shell');
    }
    b.rect(Math.round(bx - L * 0.38), Math.round(by), Math.round(L * 0.76), 2, 'belly', 'belly');
    for (let k = -2; k <= 2; k += 1) { const x = Math.round(bx + k * L * 0.13); for (let y = 2; y < domeH * 0.85; y += 1) if (b.get(x, Math.round(by - y))) px(b, x, Math.round(by - y), 'dark'); }
    thick(b, Math.round(bx - L * 0.3), Math.round(by - domeH * 0.45), Math.round(bx + L * 0.3), Math.round(by - domeH * 0.45), 1, 'dark');
    // neck and head (out in front)
    const r = L * (look.headR ?? 0.1);
    const reach = look.neck ?? 0.18;
    const pose = frame === 'pose';
    const hx = bx - L * (0.36 + reach) + (pose ? L * 0.04 : 0); const hy = by - domeH * (sea ? 0.2 : 0.35) - (pose ? r : 0);
    thick(b, Math.round(bx - L * 0.3), Math.round(by - domeH * 0.15), Math.round(hx + r * 0.5), Math.round(hy + r * 0.3), Math.max(2, Math.round(r * 1.2)), 'fur');
    ell(b, hx, hy, r * 1.15, r * 0.9, 'fur');
    if (pose) { for (const s of [-1, 1]) { b.set(Math.round(hx + s * r * 0.5), Math.round(hy - 1), INK, 'eye'); b.set(Math.round(hx + s * r * 0.5), Math.round(hy - 2), '#ffffff', 'shine'); } b.rect(Math.round(hx) - 1, Math.round(hy + r * 0.5), 3, 1, 'dark', 'dark'); }
    else { b.set(Math.round(hx - r * 0.4), Math.round(hy - 1), INK, 'eye'); b.rect(Math.round(hx - r * 1.1), Math.round(hy + r * 0.3), Math.round(r * 0.8), 1, 'dark', 'dark'); }
    return { feet, eye: [Math.round(hx), Math.round(hy - 1)] };
  },

  /** Penguins: upright, a white front, flippers, a waddle. They turn their white tummy to you when they pose. */
  penguin(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.85; const feet = Math.round(by + L * 0.42);
    const pose = frame === 'pose';
    const tilt = frame === 'walk' ? 1 : 0;
    b.rect(Math.round(bx - L * 0.12) - tilt, feet - 1, Math.round(L * 0.1), 2, look.feet || '#495057', 'feet');
    b.rect(Math.round(bx + L * 0.04) + tilt, feet - 1, Math.round(L * 0.1), 2, look.feet || '#495057', 'feet');
    ell(b, bx + tilt * 0.5, by, L * 0.22, L * 0.4, 'fur');
    if (pose) ell(b, bx, by + L * 0.06, L * 0.15, L * 0.32, 'belly');
    else ell(b, bx - L * 0.07, by + L * 0.06, L * 0.12, L * 0.32, 'belly');
    for (const s of pose ? [-1, 1] : [1]) thick(b, Math.round(bx + s * L * 0.18), Math.round(by - L * 0.15), Math.round(bx + s * L * (0.28 + tilt * 0.04)), Math.round(by + L * 0.15), 2, 'fur');
    const hx = bx - (pose ? 0 : L * 0.04); const hy = by - L * 0.42;
    ell(b, hx, hy, L * 0.15, L * 0.14, 'fur');
    if (look.accent) { if (pose) for (const s of [-1, 1]) ell(b, hx + s * L * 0.13, hy + L * 0.06, L * 0.04, L * 0.08, 'accent'); else ell(b, hx + L * 0.05, hy + L * 0.06, L * 0.05, L * 0.09, 'accent'); }
    if (look.face) for (const s of pose ? [-1, 1] : [1]) thick(b, Math.round(hx + s * L * 0.02 - (pose ? 0 : L * 0.08)), Math.round(hy - L * 0.05), Math.round(hx + s * L * 0.1), Math.round(hy + L * 0.1), 1, 'belly');
    if (pose) { b.rect(Math.round(hx) - 1, Math.round(hy + L * 0.04), 2, 2, 'beak', 'beak'); for (const s of [-1, 1]) { b.set(Math.round(hx + s * L * 0.06), Math.round(hy - 1), INK, 'eye'); b.set(Math.round(hx + s * L * 0.06), Math.round(hy - 2), '#ffffff', 'shine'); } }
    else { b.rect(Math.round(hx - L * 0.15) - 2, Math.round(hy + 1), 3, 2, 'beak', 'beak'); b.set(Math.round(hx - L * 0.06), Math.round(hy - 1), INK, 'eye'); }
    return { feet, eye: [Math.round(hx), Math.round(hy - 1)] };
  },
};

// ---------- December animals (js/critters.js, december: true) ----------
// look.xmas lists the trimmings drawn over the body plan, before the shading and the outline.
// Each trimming is shaded by hand in its own hue-shifted ramp, and where it sticks out of the
// body it is outlined in its own darker color (cloth, glass, gold), not in ink: the soft
// storybook selective outline. Glows are 'after' pixels: dithered, outside the outline.
const XOUT = {
  hat: '#8f1d2c', fluff: '#8d96b4', pom: '#8d96b4', gold: '#8a5200', bell: '#8a5200', star: '#8a5200',
  scarf: '#1f5e33', lantern: '#2b2118', holly: '#1f5e33', berry: '#7a1424', glass: '#6b1222',
  pop: '#24170f', cran: '#24170f', string: '#24170f', collar: '#6b1020', wire: null, bulb: null,
};
const RED = ramp('#e03131'); // dark..light, the base at [3]
const GREEN = ramp('#2f9e44');
const GOLD = ['#7a4a00', '#a86400', '#e8a200', '#fcc419', '#ffe066', '#fff3bf'];
const SNOW = ['#9aa3bf', '#b9c1d6', '#d5dbe7', '#eef1f6', '#ffffff', '#ffffff'];
const BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac'];
const hash = (x, y, s = 0) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263) + Math.imul(s | 0, 1442695041)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };

/** A letter-grid sprite; pal maps a letter to a color, tags to a tag (or one tag for all). */
const spr = (b, X, Y, rows, pal, tags) => rows.forEach((row, j) => { for (let i = 0; i < row.length; i += 1) { const c = pal[row[i]]; if (c) b.set(X + i, Y + j, c, typeof tags === 'string' ? tags : tags[row[i]]); } });

/** Light from the top left over one tag's pixels: light on top, dark along the bottom and right. */
function shadeTag(b, tag, dk, md, lt) {
  const same = (x, y) => b.tag(x, y) === tag && b.get(x, y);
  const marks = [];
  b.each((x, y) => { if (same(x, y)) marks.push([x, y, !same(x, y - 1) ? lt : !same(x, y + 1) || !same(x + 1, y) ? dk : md]); });
  for (const [x, y, c] of marks) b.set(x, y, c);
}

function dress(b, look, frame, box) {
  const after = box.after || (box.after = []);
  const hd = b.hd;
  for (const t of [].concat(look.xmas)) {
    if (t === 'santa' && hd) santaHat(b, hd);
    if (t === 'bobble' && hd) bobbleHat(b, hd);
    if (t === 'scarf' && b.neck) scarf(b, look, frame);
    if (t === 'lantern' && hd) lantern(b, look, hd, frame, after);
    if (t === 'lights') antlerLights(b, frame, after);
    if (t === 'holly' && hd) holly(b, hd);
    if (t === 'candy') candyBill(b);
    if (t === 'ginger') ginger(b, look, frame, box);
    if (t === 'garland' && b.body) garland(b, look, frame);
    if (t === 'sneeze' && frame === 'pose' && hd) sneeze(hd, after);
    if (t === 'bells' && b.neck) bellCollar(b, look);
    if (t === 'stardust' && (frame === 'fly' || frame === 'walk') && b.body) stardust(b, look, frame, after);
    else if (t === 'stardust') stardustSettling(b, look, frame, box, after);
    if (t === 'twinkle' && box.eye) twinkleTips(b, look, frame, after);
    if (t === 'patches' && b.body) patches(b, look);
  }
  shadeTag(b, 'pom', SNOW[1], SNOW[3], SNOW[4]);
  if (look.claw) { const c = ramp(look.claw); shadeTag(b, 'claw', c[2], c[3], c[4]); }
}

/** A Santa hat: a red cone leaning back with a floppy tip and a pompom, on a white fur brim. */
function santaHat(b, hd) {
  const w = Math.max(7, Math.round(hd.r * 1.6));
  const cx = hd.x + (hd.pose ? 0 : hd.r * 0.35);
  const base = Math.round(hd.y - hd.ry * 0.8);
  const bh = w >= 10 ? 3 : 2; const H = Math.round(w * 0.85);
  let tx = cx; let ty = base - bh;
  for (let k = 0; k < H; k += 1) {
    const t = k / Math.max(1, H - 1);
    const half = Math.max(0.5, (w / 2 - 0.7) * (1 - t * 0.9));
    const xc = cx + t * t * w * 0.42; const y = base - bh - k;
    const a = Math.round(xc - half); const z = Math.max(a, Math.round(xc + half) - 1);
    for (let x = a; x <= z; x += 1) b.set(x, y, z > a && x === a ? RED[4] : z - a > 1 && x === z ? RED[2] : RED[3], 'hat');
    tx = Math.round(xc); ty = y;
  }
  // the tip flops over the back, with a pompom on the end
  b.set(tx + 1, ty, RED[3], 'hat'); b.set(tx + 1, ty + 1, RED[2], 'hat'); b.set(tx + 2, ty + 1, RED[2], 'hat'); b.set(tx + 2, ty + 2, RED[1], 'hat');
  ell(b, tx + 3, ty + 3.4, 1.6, 1.6, 'pom', '#ffffff');
  // the brim: soft white fur, a little bumpy
  const x0 = Math.round(cx - w / 2);
  for (let j = 0; j < bh; j += 1) for (let x = x0; x < x0 + w; x += 1) b.set(x, base - j, j === bh - 1 ? SNOW[4] : j === 0 ? ((x & 1) ? SNOW[2] : SNOW[3]) : SNOW[3], 'fluff');
  b.set(x0 - 1, base - 1, SNOW[3], 'fluff'); b.set(x0 + w, base - 1, SNOW[2], 'fluff');
}

/** A knitted bobble hat: red and white stripes, a ribbed cuff, a big pompom. */
function bobbleHat(b, hd) {
  const w = Math.round(hd.r * 2.15); const cx = hd.x + (hd.pose ? 0 : hd.r * 0.15);
  const base = Math.round(hd.y - hd.ry * 0.38); const h = Math.round(w * 0.42);
  const x0 = Math.round(cx - w / 2);
  for (let k = 0; k < h; k += 1) {
    const t = (k + 0.5) / h; const half = (w / 2 - 0.3) * Math.sqrt(Math.max(0, 1 - t * t));
    const a = Math.round(cx - half); const z = Math.round(cx + half) - 1; const y = base - 2 - k;
    const rp = Math.floor(k / 2) % 2 ? SNOW : RED;
    for (let x = a; x <= z; x += 1) b.set(x, y, x <= a + 1 && k > 0 ? rp[4] : x >= z - 1 ? rp[2] : (x + k) % 4 === 0 ? rp[2] : rp[3], 'hat');
  }
  for (let j = 0; j < 2; j += 1) for (let x = x0 - 1; x <= x0 + w; x += 1) b.set(x, base - j, j ? (x & 1 ? RED[4] : RED[3]) : (x & 1 ? RED[2] : RED[1]), 'hat');
  ell(b, cx + 0.5, base - 2 - h - 1.2, Math.max(2, hd.r * 0.36), Math.max(2, hd.r * 0.34), 'pom', '#ffffff');
}

/** A knitted scarf round the neck, a stripe knitted in, one end flying out behind (or hanging down the front). */
function scarf(b, look, frame) {
  const n = b.neck; const tm = n.tm ?? 0.68;
  const G = look.scarf ? ramp(look.scarf) : GREEN; const S = look.scarfStripe ? ramp(look.scarfStripe) : RED;
  const xm = n.x0 + (n.x1 - n.x0) * tm; const ym = n.y0 + (n.y1 - n.y0) * tm;
  const slope = (n.x1 - n.x0) / ((n.y1 - n.y0) || 1);
  const rows = n.rows ?? 3; const w = n.w + 2;
  let left = null; let right = null;
  for (let j = 0; j < rows; j += 1) {
    const y = Math.round(ym) - 1 + j; const a = Math.round(xm + slope * (y - ym) - w / 2);
    for (let i = 0; i < w; i += 1) {
      const stripe = j === 1 && i % 4 === 1;
      const col = stripe ? S[3] : j === 0 ? (i >= w - 2 ? G[3] : G[4]) : i >= w - 2 || j === rows - 1 ? G[2] : G[3];
      b.set(a + i, y, col, 'scarf');
    }
    if (j === rows - 1) { left = [a, y]; right = [a + w - 1, y]; }
  }
  // the loose end, knitted in stripes, with a fringe
  const len = n.endLen ?? Math.max(5, Math.round(n.w * 1.1)) + (n.hang ? 1 : 0);
  for (let k = 0; k < len; k += 1) {
    const cols = Math.floor(k / 2) % 2 ? S : G;
    let x; let y;
    if (n.hang) { x = left[0] + Math.round(w * 0.18) + (k > len - 3 ? 1 : 0); y = left[1] + 1 + k; } // hanging down the front
    else { x = right[0] - 1 + Math.round(k * 0.75); y = right[1] - 1 + Math.round(k * 0.5) + (frame === 'walk' && k > 2 ? 1 : 0); } // flying out behind
    b.set(x, y, cols[4], 'scarf'); b.set(x + 1, y, cols[3], 'scarf'); b.set(x + 2, y, cols[2], 'scarf');
    if (k === len - 1) { b.set(x, y + 1, cols[3], 'scarf'); b.set(x + 2, y + 1, cols[2], 'scarf'); }
  }
}

/** A lantern held by its handle in the mouth, glowing. */
function lantern(b, look, hd, frame, after) {
  const pose = hd.pose;
  const mx = Math.round(pose ? hd.x : hd.x - hd.r * 0.85 - hd.r * 0.6 * (look.snout ?? 0.9) + 1);
  const my = Math.round(hd.y + hd.r * (pose ? 0.62 : 0.42));
  const big = hd.r >= 8;
  const rows = big ? ['...k...', '..k.k..', '..kkk..', '.kKKKk.', 'kyyWyyk', 'kyWWWyk', 'kyyWyyk', 'kyyYyyk', 'koooook', '.kkkkk.', '.k...k.'] : ['..k..', '.k.k.', '.kKk.', 'kyWyk', 'kWWWk', 'kyYyk', '.kkk.'];
  const pal = { k: '#3b3a4a', K: '#6b6a80', y: '#ffd43b', Y: '#fcc419', W: '#fff9db', o: '#f59f00' };
  const w = rows[0].length; const X = mx - Math.floor(w / 2) - (pose ? 0 : 1); const Y = my;
  spr(b, X, Y, rows, pal, 'lantern');
  // the glow: warm light round the glass, dithered, fading out
  const gx = X + w / 2 - 0.5; const gy = Y + rows.length * 0.6;
  const R = big ? 9 : 7;
  for (let y = Math.floor(gy - R); y <= gy + R; y += 1) for (let x = Math.floor(gx - R); x <= gx + R; x += 1) {
    const d = Math.hypot(x - gx, (y - gy) * 1.1);
    if (d > R) continue;
    const near = d < R * 0.55;
    const band = d < R * 0.4 ? 0 : d < R * 0.7 ? 1 : 2;
    if (band === 0 ? (x + y) % 2 === 0 : band === 1 ? x % 2 === 0 && y % 2 === 0 : (x + 2 * y) % 6 === 0) after.push([x, y, band === 0 ? '#ffe066' : band === 1 ? '#ffec99' : '#fff3bf']);
  }
}

/**
 * A string of Christmas lights wound along a moose's antlers: along the top edge of each palm,
 * draped over the skull between them, and down round the tip of the back palm. Every bulb sits
 * on the palm, so nothing hangs in the air.
 */
function antlerLights(b, frame, after) {
  const P = [...b.palms].sort((p, q) => p.edge[0][0] - q.edge[0][0]); if (!P.length) return;
  const along = (p) => p.edge.map(([x, y]) => [x, y + 1]); // just inside the top edge, inner end first
  let pts = [];
  if (P.length === 2 && P[0].d < 0 && P[1].d > 0) {
    // forward palm from its tip in to the skull, over the head, then out along the back palm
    const a = along(P[0]).reverse(); const c = along(P[1]);
    pts = [...a, ...c];
  } else for (const p of P) pts.push(...along(p));
  const last = P[P.length - 1];
  const [tx, t0, t1] = last.tip;
  for (let y = t0 + 2; y <= t1 - 1; y += 1) pts.push([tx - last.d, y]); // down round the tip
  const off = { walk: 2, fly: 1, peek: 3, pose: 4 }[frame] || 0; // the colors move along from frame to frame: they twinkle
  let d = 0; let n = 0; let prev = '';
  const bulbs = [];
  for (let i = 1; i < pts.length; i += 1) {
    const [a, c] = [pts[i - 1], pts[i]];
    line(a[0], a[1], c[0], c[1], (x, y) => {
      if (prev === `${x},${y}`) return; prev = `${x},${y}`;
      if (b.tag(x, y) !== 'bulb') b.set(x, y, '#2b5d2b', 'wire');
      d += 1;
      if (d % 4 === 2) { bulbs.push([x, y, BULBS[(n + off) % BULBS.length]]); n += 1; }
    });
  }
  for (const [x, y, col] of bulbs) {
    // a 2 x 2 bulb hanging from the wire onto the palm, lit at its top left
    b.set(x, y + 1, mix(col, '#ffffff', 0.6), 'bulb'); b.set(x + 1, y + 1, col, 'bulb'); b.set(x, y + 2, col, 'bulb'); b.set(x + 1, y + 2, mix(col, '#7a3060', 0.2), 'bulb');
    const glow = mix(col, '#ffffff', 0.5);
    for (const [gx, gy] of [[x - 1, y + 1], [x + 2, y + 2], [x, y + 3], [x + 1, y], [x - 1, y + 3], [x + 2, y]]) after.push([gx, gy, glow]);
  }
}

/** A sprig of holly on the head: two leaves and red berries. */
function holly(b, hd) {
  const rows = ['l.....l', 'Gl...lG', '.GGbGG.', '..bBb..'];
  const X = Math.round(hd.x + (hd.pose ? -3 : hd.r * 0.15 - 2)); const Y = Math.round(hd.y - hd.ry - 3);
  spr(b, X, Y, rows, { l: '#69db7c', G: '#2f9e44', b: '#c92a2a', B: '#ff8787' }, { l: 'holly', G: 'holly', b: 'berry', B: 'berry' });
}

/** A candy-cane bill: red and white stripes, slanting. */
function candyBill(b) {
  const marks = [];
  b.each((x, y) => { if (b.tag(x, y) === 'beak') marks.push([x, y]); });
  for (const [x, y] of marks) {
    const red = ((x + y) >> 1) & 1; const top = b.tag(x, y - 1) !== 'beak' && b.tag(x, y - 1) !== 'cane';
    b.set(x, y, red ? (top ? '#ff6b6b' : '#e03131') : (top ? '#ffffff' : '#eef1f6'), 'cane');
  }
}

/** Gingerbread: white icing piped along the back, icing cuffs, gumdrop buttons and an icing smile. */
function ginger(b, look, frame, box) {
  const B = b.body; const hd = b.hd;
  const ICE = '#ffffff';
  if (B && !B.upright) {
    const gums = [['#ff6b6b', '#ffc9c9'], ['#51cf66', '#d3f9d8'], ['#fcc419', '#fff3bf']];
    gums.forEach(([c, l], k) => { const gx = Math.round(B.x - B.rx * 0.45 + k * B.rx * 0.42); const gy = Math.round(B.y + B.ry * 0.05); spr(b, gx, gy, ['.l.', 'ccc'], { l, c }, 'gum'); });
  } else if (B) {
    // standing up to face you, arms out, like a gingerbread man: icing cuffs, buttons down the front
    for (const s of [-1, 1]) {
      const ax = B.x + s * B.rx * 1.75; const ay = B.y - B.ry * 0.5;
      thick(b, Math.round(B.x + s * B.rx * 0.6), Math.round(B.y - B.ry * 0.28), Math.round(ax), Math.round(ay), 3, 'fur');
      for (let k = -1; k <= 1; k += 1) b.set(Math.round(ax - s * 2) + (k === 0 ? s : 0), Math.round(ay) + k, ICE, 'icing');
      const lx = B.x + s * B.rx * 0.5;
      thick(b, Math.round(lx), Math.round(B.y + B.ry * 0.6), Math.round(lx + s * B.rx * 0.25), box.feet - 1, 3, 'fur');
    }
    const gums = [['#ff6b6b', '#ffc9c9'], ['#51cf66', '#d3f9d8'], ['#fcc419', '#fff3bf']];
    gums.forEach(([c, l], k) => spr(b, Math.round(B.x - 2), Math.round(B.y - B.ry * 0.42 + k * B.ry * 0.36), ['.l.', 'ccc'], { l, c }, 'gum'));
    // icing scallops round the tummy's edge
    for (let a = 0.25; a < Math.PI - 0.25; a += 0.22) b.set(Math.round(B.x + Math.cos(a) * B.rx * 0.78), Math.round(B.y + Math.sin(a) * B.ry * 0.82), ICE, 'icing');
  }
  // piped icing all the way round, one pixel in from the edge, like on a gingerbread cookie (it
  // reads even small and fast on the train): every fur pixel that is not on the edge but touches one
  const filled = (x, y) => Boolean(b.get(x, y));
  const fur = (x, y) => b.tag(x, y) === 'fur' && filled(x, y);
  const onEdge = (x, y) => filled(x, y) && (!filled(x - 1, y) || !filled(x + 1, y) || !filled(x, y - 1) || !filled(x, y + 1));
  const [eyeX, eyeY] = box.eye || [-99, -99];
  const pipe = [];
  b.each((x, y) => {
    if (!fur(x, y) || onEdge(x, y)) return;
    if (Math.abs(x - eyeX) <= 2 && Math.abs(y - eyeY) <= 1) return; // not across the eye
    let near = false;
    for (let dy = -1; dy <= 1 && !near; dy += 1) for (let dx = -1; dx <= 1; dx += 1) if ((dx || dy) && fur(x + dx, y + dy) && onEdge(x + dx, y + dy)) { near = true; break; }
    if (near) pipe.push([x, y]);
  });
  for (const [x, y] of pipe) b.set(x, y, ICE, 'icing');
  // icing cuffs round the feet
  const fy = box.feet - 2; const cuffs = [];
  b.each((x, y) => { if (y === fy && b.tag(x, y) === 'dark') cuffs.push(x); });
  for (const x of cuffs) b.set(x, fy, ICE, 'icing');
  if (!hd) return;
  // an icing smile (and an icing eyebrow) on the face
  if (hd.pose) {
    const y = Math.round(hd.y + hd.r * 0.68);
    for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]]) b.set(Math.round(hd.x) + dx, y + dy, ICE, 'icing');
    for (const s of [-1, 1]) b.set(Math.round(hd.x + s * hd.r * 0.62), Math.round(hd.y + hd.r * 0.35), '#ffa8c5', 'icing');
  } else {
    const y = Math.round(hd.y + hd.r * 0.6);
    for (const [dx, dy] of [[-1, 0], [0, 1], [1, 1]]) b.set(Math.round(hd.x - hd.r * 0.7) + dx, y + dy, ICE, 'icing');
    b.set(Math.round(hd.x + hd.r * 0.05), Math.round(hd.y + hd.r * 0.3), '#ffa8c5', 'icing');
  }
}

/** A porcupine's coat of quills: a dark cape over the back, spiky round the edge with pale tips, flowing back. */
function quillCoat(b, look, B, frame) {
  const tip = look.quillTip || '#f1e3c8'; const mid = look.quillMid || '#8a7462';
  const cx = B.x + (B.upright ? B.rx * 0.4 : B.peek ? 0 : B.rx * 0.1); const cy = B.y - (B.upright ? B.ry * 0.05 : B.peek ? 0 : B.ry * 0.32);
  const rx = B.rx * (B.upright || B.peek ? 0.9 : 1.0); const ry = B.ry * (B.upright || B.peek ? 1.0 : 1.08);
  ell(b, cx, cy, rx, ry, 'dark');
  const [a0, a1, sw] = B.peek ? [Math.PI * 0.9, Math.PI * 2.1, 0] : B.upright ? [Math.PI * 1.45, Math.PI * 2.45, 0.5] : [Math.PI * 1.05, Math.PI * 2.2, 0.62];
  const n = Math.round(((a1 - a0) * (rx + ry)) / 2 / 1.6);
  for (let i = 0; i <= n; i += 1) {
    const phi = a0 + ((a1 - a0) * i) / n + (frame === 'walk' ? 0.04 : 0);
    const c = Math.cos(phi); const s = Math.sin(phi);
    let nx = c / rx; let ny = s / ry; const m = Math.hypot(nx, ny); nx /= m; ny /= m;
    const dx = nx * Math.cos(sw) - ny * Math.sin(sw); const dy = nx * Math.sin(sw) + ny * Math.cos(sw);
    const f = i / n; const len = (i % 2 ? 2.5 : 4) * (B.peek ? 0.55 + 0.6 * Math.sin(Math.PI * f) : 0.6 + 0.6 * Math.sin(Math.PI * Math.min(1, 0.15 + f)));
    const x0 = cx + c * (rx - 1.5); const y0 = cy + s * (ry - 1.5);
    line(x0, y0, x0 + dx * (len + 1.5), y0 + dy * (len + 1.5), (x, y, t) => b.set(x, y, t > 0.7 ? tip : 'dark', t > 0.7 ? 'quill' : 'dark'));
  }
  // streaks of lighter quills on the cape, flowing back
  for (let k = 0; k < 9; k += 1) {
    const u = -0.7 + (k % 5) * 0.34 + (k > 4 ? 0.17 : 0); const v = k > 4 ? -0.15 : -0.55;
    const x0 = cx + u * rx; const y0 = cy + v * ry * Math.sqrt(Math.max(0, 1 - u * u));
    if (b.tag(Math.round(x0), Math.round(y0)) !== 'dark') continue;
    line(x0, y0, x0 + 3.2, y0 + 1.4 + u, (x, y) => { if (b.tag(x, y) === 'dark') b.set(x, y, mid, 'quill2'); });
  }
}

/**
 * A garland of popcorn and cranberries draped over the quills in swags: 2 x 2 beads, white
 * popcorn and red cranberries (every third), each ringed in dark so they read as beads even small.
 */
function garland(b, look, frame) {
  const B = b.body; const L = look.len;
  const POP = ['#ffffff', '#ffffff', '#fff4d6', '#e9d6a8']; const CRAN = ['#ff8787', '#e03131', '#e03131', '#a61e1e']; // top left, top right, bottom left, bottom right
  const RING = '#24170f';
  const swags = B.upright ? 1 : 2;
  const xa = B.upright ? B.x - B.rx * 0.2 : B.peek ? B.x - B.rx * 0.82 : B.x - B.rx * 0.6;
  const xb = B.upright ? B.x + B.rx * 1.3 : B.peek ? B.x + B.rx * 0.82 : B.x + B.rx * 0.85;
  const beads = [];
  let i = 0;
  if (B.peek) { // peeking out: the garland wound round its crown of quills, over the head
    const rx = B.rx * 0.72; const ry = B.ry * 0.8; const n = Math.max(3, Math.round((Math.PI * 0.8 * (rx + ry)) / 2 / 3));
    for (let k = 0; k <= n; k += 1) { const a = Math.PI * (1.1 + (0.8 * k) / n); beads.push([Math.round(B.x + Math.cos(a) * rx - 0.5), Math.round(B.y + Math.sin(a) * ry - 0.5), k % 3 === 1]); }
  } else for (let x = Math.round(xa); x <= xb - 1; x += 3) {
    const u = (x - xa) / (xb - xa);
    const k = (u * swags) % 1;
    const top = B.upright ? B.y - B.ry * 0.55 + u * B.ry * 0.5
      : B.peek ? B.y - B.ry * 0.62 * Math.sqrt(Math.max(0, 1 - ((x - B.x) / (B.rx * 0.95)) ** 2))
        : B.y - B.ry * Math.sqrt(Math.max(0, 1 - ((x - B.x) / (B.rx * 1.05)) ** 2)) - L * 0.07;
    const y = Math.round(top + Math.sin(k * Math.PI) * L * 0.11 + (frame === 'walk' && k > 0.5 ? 1 : 0));
    beads.push([x, y, i % 3 === 2]);
    i += 1;
  }
  const mine = new Set(beads.flatMap(([x, y]) => [`${x},${y}`, `${x + 1},${y}`, `${x},${y + 1}`, `${x + 1},${y + 1}`]));
  // the dark ring round each bead, over the coat (where a bead sticks out, the outline does it)
  for (const [x, y] of beads) for (let dy = -1; dy <= 2; dy += 1) for (let dx = -1; dx <= 2; dx += 1) {
    if (mine.has(`${x + dx},${y + dy}`) || !b.get(x + dx, y + dy)) continue;
    b.set(x + dx, y + dy, RING, 'string');
  }
  for (const [x, y, cran] of beads) {
    const c = cran ? CRAN : POP; const t = cran ? 'cran' : 'pop';
    b.set(x, y, c[0], t); b.set(x + 1, y, c[1], t); b.set(x, y + 1, c[2], t); b.set(x + 1, y + 1, c[3], t);
  }
}

/** Patches of a second color over the shoulder and hip (the Christmas iguana's green on red). */
function patches(b, look) {
  const B = b.body; const c = ramp(look.accent);
  for (const [fx, fy, w, h] of [[-0.55, -0.2, 4, 2], [-0.4, 0.4, 3, 2], [0.35, -0.1, 4, 2], [0.62, 0.5, 2, 1]]) {
    const x0 = Math.round(B.x + fx * B.rx); const y0 = Math.round(B.y + fy * B.ry);
    for (let j = 0; j < h; j += 1) for (let i = 0; i < w - (j && i === 0 ? 1 : 0); i += 1) if (b.tag(x0 + i + j, y0 + j) === 'fur') b.set(x0 + i + j, y0 + j, j ? c[2] : c[3], 'patch');
  }
}

/** A salty sneeze (marine iguanas sneeze out the salt from the sea water). */
function sneeze(hd, after) {
  const rows = ['.w..w..', 'w.wwb.w', '.wwbw..', 'w.bw.w.', '..w....'];
  const X = Math.round(hd.x - hd.r * 1.15) - rows[0].length; const Y = Math.round(hd.y - 3);
  rows.forEach((r, j) => { for (let i = 0; i < r.length; i += 1) if (r[i] !== '.') after.push([X + i, Y + j, r[i] === 'w' ? '#ffffff' : '#d0ebff']); });
}

/** A red collar with a golden jingle bell. */
function bellCollar(b, look) {
  const n = b.neck; let low = null; let last = null;
  line(n.x0, n.y0, n.x1, n.y1, (x, y, t) => {
    if (t < 0.5 || t > 0.66 || last === y) return; last = y;
    const a = x - Math.floor(n.w / 2);
    for (let i = 0; i < n.w; i += 1) b.set(a + i, y, i === 0 ? RED[4] : i === n.w - 1 ? RED[2] : RED[3], 'collar');
    if (!low || y >= low[1]) low = [a + Math.floor(n.w / 2) - 1, y];
  });
  if (!low) return;
  const big = n.w >= 7;
  spr(b, low[0] - (big ? 1 : 0), low[1] + 1, big ? ['.lm.', 'lmmd', 'mmdd', '.kk.'] : ['lm.', 'mmd', '.k.'], { l: GOLD[5], m: GOLD[3], d: GOLD[2], k: GOLD[0] }, 'bell');
}

/** Stardust streaming out behind a flying reindeer. */
function stardust(b, look, frame, after) {
  const B = b.body; const L = look.len;
  const x0 = B.x + B.rx * 0.7; const y0 = B.y - B.ry * 0.1; const span = L * 1.15; const ph = frame === 'walk' ? 1 : 0;
  for (let x = Math.round(x0); x < x0 + span; x += 1) {
    const u = (x - x0) / span;
    const yc = y0 - u * L * 0.18 + Math.sin(u * 6 + ph) * 1.2;
    const spread = 1 + u * L * 0.1;
    for (let y = Math.floor(yc - spread); y <= yc + spread; y += 1) {
      const h = hash(x, y, ph + 7);
      const core = Math.abs(y - yc) < 0.8 + u;
      if (h < (core ? 0.75 : 0.32) * (1 - u * 0.85)) after.push([x, y, core && h < 0.3 ? '#ffd43b' : h < 0.12 ? '#ffffff' : '#ffe8a3']);
    }
  }
  // a few twinkles in the trail
  for (let k = 0; k < 3; k += 1) {
    const sx = Math.round(x0 + span * (0.25 + k * 0.27)); const sy = Math.round(y0 - (0.25 + k * 0.27) * L * 0.18 + (k % 2 ? -4 : 4) + ph);
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) after.push([sx + dx, sy + dy, dx || dy ? '#fff3bf' : '#ffffff']);
  }
}

/** Standing still, the stardust it brought settles round it: a glittering drift at its hooves and a few twinkles. */
function stardustSettling(b, look, frame, box, after) {
  const L = look.len; const feet = box.feet ?? 0;
  let x0 = Infinity; let x1 = -Infinity;
  b.each((x, y) => { if (b.get(x, y) && y >= feet - 1) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); } });
  if (!Number.isFinite(x0)) return;
  // glitter on the ground round the hooves
  for (let x = x0 - 4; x <= x1 + 6; x += 1) for (let y = feet - 1; y <= feet + 1; y += 1) {
    const h = hash(x, y, 31);
    if (h < (y === feet + 1 ? 0.3 : 0.18)) after.push([x, y, h < 0.07 ? '#ffffff' : h < 0.17 ? '#ffd43b' : '#ffe8a3']);
  }
  // specks still drifting down, and twinkles
  const top = box.eye ? box.eye[1] : feet - L * 0.8;
  for (let k = 0; k < 14; k += 1) {
    const x = Math.round(x0 - 3 + hash(k, 1, 33) * (x1 - x0 + 8)); const y = Math.round(top + hash(k, 2, 33) * (feet - top));
    if (!b.get(x, y)) after.push([x, y, k % 3 ? '#ffe8a3' : '#ffffff']);
  }
  const ph = frame === 'pose' ? 1 : 0;
  for (let k = 0; k < 2; k += 1) {
    const sx = Math.round(k ? x1 + 3 : x0 - 2); const sy = Math.round(feet - L * (0.25 + 0.2 * ((k + ph) % 2)));
    for (const [dx, dy] of [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]]) if (!b.get(sx + dx, sy + dy)) after.push([sx + dx, sy + dy, dx || dy ? '#fff3bf' : '#ffffff']);
  }
}

/** Little star glints at the tips of golden antlers. */
function twinkleTips(b, look, frame, after) {
  const tips = [];
  b.each((x, y) => { if (b.tag(x, y) === 'horn' && !b.get(x, y - 1) && !b.get(x - 1, y) && !b.get(x + 1, y)) tips.push([x, y]); });
  tips.sort((p, q) => p[1] - q[1]);
  tips.slice(0, frame === 'pose' ? 3 : 2).forEach(([x, y], i) => {
    if ((i + ({ walk: 1, fly: 1 }[frame] || 0)) % 2 && frame !== 'pose') return;
    for (const [dx, dy] of [[0, -1], [-1, -2], [1, -2], [0, -3]]) after.push([x + dx, y + dy, dy === -2 && dx === 0 ? '#ffffff' : '#fff3bf']);
    after.push([x, y - 2, '#ffffff']);
  });
}

/** A Christmas bauble the hermit crab wears for a shell: shiny glass, a gold band, a gold cap. */
function bauble(b, look, cx, cy, R, frame) {
  const rp = ramp(look.bauble || '#e03131', 3, 2);
  b.fill(Math.floor(cx - R - 1), Math.floor(cy - R - 1), Math.ceil(R * 2 + 3), Math.ceil(R * 2 + 3), (x, y) => {
    if (!inEll(x, y, cx, cy, R, R)) return null;
    const dx = (x + 0.5 - cx) / R; const dy = (y + 0.5 - cy) / R; const dz = Math.sqrt(Math.max(0, 1 - dx * dx - dy * dy));
    const lit = -dx * 0.4 - dy * 0.55 + dz * 0.7; // light from the top left
    if (dz < 0.45 && dx > 0.05 && dy > 0.2) return rp[2]; // the rim in shadow, then a little light bounced up from the sand
    return lit > 0.92 ? rp[4] : lit > 0.45 ? rp[3] : lit > 0.05 ? rp[2] : rp[1];
  }, 'glass');
  // a soft reflected light along the lower right rim
  for (let a = 0.35; a < 1.1; a += 0.1) b.set(Math.round(cx + Math.cos(a) * (R - 1.6)), Math.round(cy + Math.sin(a) * (R - 1.6)), rp[3], 'glass');
  // the gold band round the middle, curving with the glass
  for (let x = Math.ceil(cx - R); x <= cx + R; x += 1) {
    const u = (x + 0.5 - cx) / R; if (Math.abs(u) > 0.96) continue;
    const y = Math.round(cy + 0.3 + (1 - u * u) * R * 0.14);
    if (b.tag(x, y) !== 'glass') continue;
    b.set(x, y, u < -0.2 ? GOLD[4] : u > 0.55 ? GOLD[2] : GOLD[3], 'gold');
    if (b.tag(x, y + 1) === 'glass') b.set(x, y + 1, u > 0.4 ? GOLD[1] : GOLD[2], 'gold');
  }
  // a window glint
  const gx = Math.round(cx - R * 0.45); const gy = Math.round(cy - R * 0.5);
  b.set(gx, gy, '#ffffff', 'glass'); b.set(gx + 1, gy, '#ffffff', 'glass'); b.set(gx, gy + 1, '#ffffff', 'glass'); b.set(gx + 2, gy - 1, rp[5], 'glass'); b.set(gx - 1, gy + 2, rp[5], 'glass');
  // the gold cap and its hanging loop, tipped back
  const capX = Math.round(cx + R * 0.25); const capY = Math.round(cy - R - 1);
  spr(b, capX - 2, capY - 3, ['.kk..', 'k..k.', 'lmmmd', 'lmmdd'], { k: GOLD[2], l: GOLD[4], m: GOLD[3], d: GOLD[1] }, 'gold');
}

/** Christmas tree worms: two spiral crowns, like little Christmas trees, out of a tube in the coral. */
PLANS.treeworm = function treeworm(b, look, frame) {
  const L = look.len;
  const bx = L * 0.6; const base = Math.round(L * 1.0);
  const out = frame === 'peek' ? 0.45 : 1;
  const twist = { walk: 1, fly: 2 }[frame] || 0;
  // the lump of brain coral it lives in
  const R = L * 0.4; const ch = L * 0.2;
  for (let x = -Math.ceil(R); x <= Math.ceil(R); x += 1) {
    const f = Math.sqrt(Math.max(0, 1 - ((x + 0.5) / R) ** 2)); const h = Math.round(ch * f);
    for (let y = -h; y <= 1; y += 1) b.set(Math.round(bx + x), base + 2 + y, 'shell', 'shell');
  }
  for (const [gy, ph] of [[0.4, 0], [0.75, 2]]) for (let x = -Math.round(R) + 2; x < R - 2; x += 1) {
    const X = Math.round(bx + x); const Y = base + 2 - Math.round(ch * (1 - gy)) + Math.round(Math.sin(x * 0.85 + ph) * 1.1);
    if (b.tag(X, Y) === 'shell' && b.tag(X, Y - 1) === 'shell') px(b, X, Y, 'dark');
  }
  // the tube, and the worm's face peeking out of it
  b.rect(Math.round(bx - L * 0.14), base - 3, Math.round(L * 0.28) + 1, 4, 'belly', 'belly');
  // the two crowns: spiral cones in tiers
  const H = Math.round(L * 0.6 * out); const W = L * 0.32;
  const cols = [look.fur, look.accent || look.fur];
  const tips = [];
  for (const [i, s] of [-1, 1].entries()) {
    const cx = bx + s * L * 0.15; const top = base - 4 - H; const rp = ramp(cols[i], 3, 2);
    for (let k = 0; k <= H; k += 1) {
      const t = k / H; const tier = k % 3;
      const half = 0.5 + t * (W / 2 - 0.5) + (tier === 2 && k > 2 ? 0.9 : 0);
      const a = Math.round(cx - half); const z = Math.round(cx + half);
      for (let x = a; x <= z; x += 1) {
        // tiers like a little fir tree (light on top, dark under each), and a pale stripe winding up round them: the spiral
        const wind = ((x - a) + k + twist * 2 + i * 2) % 6 === 0;
        const col = wind ? rp[5] : tier === 2 ? (x >= z - 1 ? rp[1] : rp[2]) : tier === 0 ? (x <= a + 1 ? rp[5] : rp[4]) : x >= z ? rp[2] : rp[3];
        b.set(x, top + k, col, 'plume');
      }
    }
    tips.push([Math.round(cx), top - 1]);
  }
  // little gold stars on top of the crowns
  for (const [tx, ty] of tips) spr(b, tx - 1, ty - 2, ['.l.', 'lmd', '.d.'], { l: GOLD[5], m: GOLD[3], d: GOLD[2] }, 'star');
  // the worm itself, peeking out of the tube under its crowns
  const pose = frame === 'pose';
  const ex = Math.round(bx); const ey = base - 1;
  const look2 = frame === 'walk' ? 1 : frame === 'fly' ? -1 : 0; // it looks about
  for (const d of [-2, 1]) { b.set(ex + d + look2, ey, INK, 'eye'); b.set(ex + d + look2, ey - 1, INK, 'eye'); if (pose) b.set(ex + d, ey - 1, '#ffffff', 'shine'); }
  if (pose) { b.set(ex - 1, ey + 1, '#e8590c', 'mouth'); b.set(ex, ey + 1, '#e8590c', 'mouth'); }
  return { feet: base + 3, eye: [ex, ey] };
};

/** A yeti: upright and shaggy, long arms, big flat feet, a blue face. Waves when it poses. */
PLANS.yeti = function yeti(b, look, frame) {
  const L = look.len;
  const bx = L * 0.8; const by = L * 1.05;
  const bw = L * 0.27; const bh = L * 0.31;
  const feet = Math.round(by + bh + L * 0.13);
  const hr = L * 0.21;
  const pose = frame === 'pose'; const peek = frame === 'peek'; const front = pose || peek;
  const hx = bx - (front ? 0 : L * 0.06); const hy = by - bh - hr * 0.45;
  const face = look.face || '#8fa2e6'; const fr = ramp(face, 3, 2);
  const aw = Math.max(3, Math.round(L * 0.1));
  const mitt = (x, y) => ell(b, x, y, L * 0.065, L * 0.06, 'mitt', fr[2]);
  if (!peek) {
    const sw = frame === 'walk' ? 2 : 0;
    for (const [i, s] of [[0, -1], [1, 1]]) {
      const lx = bx + s * bw * 0.45 + (i ? -sw : sw);
      thick(b, Math.round(lx), Math.round(by + bh * 0.4), Math.round(lx), feet - 1, Math.max(3, Math.round(L * 0.13)), i && !front ? 'dark' : 'fur');
      ell(b, lx - (front ? 0 : L * 0.05), feet - 1, L * 0.11, L * 0.05, 'sole', fr[3]);
    }
    // arms behind the body (side on, the far arm; posing, the waving arm goes up)
    const arm = (sx, sy, ex, ey, tag) => {
      if (tag === 'fur') thick(b, Math.round(sx) + 1, Math.round(sy) + 1, Math.round(ex) + 1, Math.round(ey) + 1, aw, 'dark'); // a shadow down its back edge, so a white arm shows on a white body
      thick(b, Math.round(sx), Math.round(sy), Math.round(ex), Math.round(ey), aw, tag); mitt(ex, ey + 1);
    };
    const up = frame === 'fly';
    if (front) {
      arm(bx - bw * 0.75, by - bh * 0.45, bx - bw * 1.3, by - bh * (pose ? 1.45 : 0.2), 'fur');
      arm(bx + bw * 0.75, by - bh * 0.45, bx + bw * 1.15, by + bh * 0.45, 'fur');
    } else if (up) {
      arm(bx + bw * 0.2, by - bh * 0.5, bx + bw * 0.7, by - bh * 1.6, 'dark');
    } else arm(bx + bw * 0.25, by - bh * 0.5, bx + bw * 0.6 - sw, by + bh * 0.45, 'dark');
    ell(b, bx, by, bw, bh, 'fur');
    // shaggy: tufts hanging off the bottom edge and the sides
    for (let a = 0.2; a < Math.PI - 0.2; a += 0.3) { const x = Math.round(bx + Math.cos(a) * bw * 0.95); const y = Math.round(by + Math.sin(a) * bh); px(b, x, y + 1, 'fur'); if (Math.round(a * 10) % 2) px(b, x, y + 2, 'fur'); }
    for (const s of [-1, 1]) for (let k = 0; k < 3; k += 1) px(b, Math.round(bx + s * (bw + 1)), Math.round(by - bh * 0.2 + k * 3), 'fur');
    if (!front) {
      if (up) arm(bx - bw * 0.3, by - bh * 0.5, bx - bw * 0.75, by - bh * 1.65, 'fur');
      else arm(bx - bw * 0.3, by - bh * 0.45, bx - bw * 0.8 + sw, by + bh * 0.4, 'fur');
    }
    if (look.belly) ell(b, bx - (front ? 0 : bw * 0.2), by + bh * 0.15, bw * 0.55, bh * 0.55, 'belly');
  } else {
    ell(b, bx, hy + hr * 1.7, bw * 0.95, hr * 1.0, 'fur'); // shoulders
  }
  // the head, with a shaggy fringe
  ell(b, hx, hy, hr * 1.05, hr * 0.95, 'fur');
  for (const s of [-1, 1]) { px(b, Math.round(hx + s * hr * 1.1), Math.round(hy + hr * 0.3), 'fur'); px(b, Math.round(hx + s * hr * 1.05), Math.round(hy + hr * 0.6), 'fur'); }
  let eye;
  if (front) {
    ell(b, hx, hy + hr * 0.18, hr * 0.72, hr * 0.58, 'face', fr[3]);
    for (let x = -1; x <= 1; x += 1) b.set(Math.round(hx + x), Math.round(hy - hr * 0.42), 'fur', 'fur'); // a fringe of fur over the face
    for (const s of [-1, 1]) { const ex = Math.round(hx + s * hr * 0.36) - (s < 0 ? 1 : 0); b.set(ex, Math.round(hy), INK, 'eye'); b.set(ex, Math.round(hy) - 1, INK, 'eye'); b.set(ex, Math.round(hy) - 1, '#ffffff', 'shine'); }
    b.set(Math.round(hx) - 1, Math.round(hy + hr * 0.2), fr[0], 'nose'); b.set(Math.round(hx), Math.round(hy + hr * 0.2), fr[0], 'nose');
    const my = Math.round(hy + hr * 0.5);
    for (const [dx, dy] of [[-2, 0], [-1, 1], [0, 1], [1, 1], [2, 0]]) b.set(Math.round(hx) + dx - 1 + 1, my + dy, INK, 'mouth');
    b.set(Math.round(hx) - 1, my + 2, '#ffffff', 'tooth'); b.set(Math.round(hx) + 1, my + 2, '#ffffff', 'tooth');
    eye = [Math.round(hx), Math.round(hy)];
  } else {
    ell(b, hx - hr * 0.5, hy + hr * 0.2, hr * 0.62, hr * 0.55, 'face', fr[3]);
    const ex = Math.round(hx - hr * 0.62); const ey = Math.round(hy);
    b.set(ex, ey, INK, 'eye'); b.set(ex, ey - 1, INK, 'eye'); b.set(ex, ey - 1, '#ffffff', 'shine');
    b.set(ex - 1, ey - 2, 'fur', 'fur'); b.set(ex, ey - 2, 'fur', 'fur'); b.set(ex + 1, ey - 2, 'fur', 'fur'); // shaggy brow
    b.set(Math.round(hx - hr * 1.08), Math.round(hy + hr * 0.15), fr[0], 'nose');
    b.set(Math.round(hx - hr * 0.95), Math.round(hy + hr * 0.55), INK, 'mouth'); b.set(Math.round(hx - hr * 0.75), Math.round(hy + hr * 0.6), INK, 'mouth');
    eye = [ex, ey];
  }
  b.hd = { x: hx, y: hy, r: hr, ry: hr * 0.95, pose: front };
  b.neck = { x0: hx + (front ? 0 : hr * 0.15), y0: hy + hr * 1.35, x1: hx, y1: hy + hr * 0.55, w: Math.round(hr * 1.8), tm: 0.55, hang: front, endLen: peek ? 2 : null };
  b.body = peek ? null : { x: bx, y: by, rx: bw, ry: bh };
  return { feet: peek ? Math.round(hy + hr * 2.6) : feet, eye };
};

/** Every body plan, for tests and the art preview. */
export const PLAN_NAMES = Object.keys(PLANS);
