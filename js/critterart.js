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
import { Buf, inEll, line, ramp } from './pixelkit.js';

const INK = '#1b1430';
const mixPale = (c) => (c.toLowerCase() === '#ffffff' ? '#eef1f7' : c);
const cache = new Map();

/** An animal picture (a canvas, facing left), cached by look + frame. */
export function critterPic(look, frame = 'stand') {
  const key = `${JSON.stringify(look)}|${frame}`;
  if (cache.has(key)) return cache.get(key);
  const b = new Buf(Math.ceil(look.len * 2.4), Math.ceil(look.len * 2.4), 4);
  const draw = PLANS[look.plan] || PLANS.quad;
  const box = draw(b, look, frame);
  finish(b, look);
  for (const [x, y, col] of box?.after || []) if (!b.get(x, y)) b.set(x, y, col, 'after');
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
    if (t === 'horn') return top(x, y) ? '#e9d8b4' : '#b08d57';
    if (t === 'beak') return look.beak || '#f59f00';
    return c;
  });
  b.outline(() => INK);
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
      thick(b, x, y, x + dir * Math.round(r * 0.6), y - r * 1.6, 1, 'horn');
      thick(b, x + dir * Math.round(r * 0.3), y - r * 0.8, x - dir * Math.round(r * 0.3), y - r * 1.4, 1, 'horn');
      thick(b, x + dir * Math.round(r * 0.5), y - r * 1.3, x + dir * Math.round(r * 1.1), y - r * 1.8, 1, 'horn');
    } else if (k === 'palm') { // moose: broad flat paddles
      const sides = pose ? [dir] : [-1, 1]; // side on, both palms show: one forward, one back
      for (const d of sides) {
        const pcx = x + d * r * 1.25; const pcy = y - r * 0.75; const rx = Math.max(4.5, r * 0.95); const ry = Math.max(2.8, r * 0.5);
        thick(b, x, y, Math.round(x + d * r * 0.6), Math.round(y - r * 0.45), 2, 'horn');
        b.fill(Math.round(pcx - rx - 1), Math.round(pcy - ry - 1), Math.ceil(rx * 2 + 3), Math.ceil(ry * 2 + 3), (xx, yy) => (inEll(xx, yy, pcx, pcy, rx, ry) ? 'horn' : null), 'horn');
        for (let t = 0; t < 4; t += 1) { const tx = Math.round(pcx - rx * 0.75 + (t * rx * 1.5) / 3); px(b, tx, Math.round(pcy - ry - 1), 'horn'); px(b, tx, Math.round(pcy - ry - 2), 'horn'); }
      }
    } else if (k === 'curl') { // bighorn / ram
      for (let a = 0; a < 6; a += 0.4) { const rr = r * 0.25 + a * r * 0.11; px(b, Math.round(x + dir * (Math.cos(a) * rr + r * 0.3)), Math.round(y + Math.sin(a) * rr - r * 0.2), 'horn'); px(b, Math.round(x + dir * (Math.cos(a) * rr + r * 0.3)) + 1, Math.round(y + Math.sin(a) * rr - r * 0.2), 'horn'); }
    } else if (k === 'spike') { // mountain goat: short black daggers
      thick(b, x, y, x + dir * 1, y - Math.round(r * 0.6), 2, 'dark');
      thick(b, x + dir * 1, y - Math.round(r * 0.6), x + dir * Math.round(r * 0.7), y - Math.round(r * 1.05), 2, 'dark');
    } else if (k === 'horn') { // one unicorn horn in the middle
      const hx0 = pose ? hx : x - 1;
      for (let t = 0; t < r * 1.4; t += 1) px(b, Math.round(hx0 - (pose ? 0 : t * 0.3)), Math.round(y - t), t % 2 ? 'accent' : 'horn');
      if (pose) break;
    }
  }
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
    for (const [i, lx] of legAt.entries()) {
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
    if (look.extra === 'mane') for (let t = 0; t < 1; t += 0.12) ell(b, bx - L * 0.38 + t * L * 0.25, by - bodyH * 0.5 - t * 2, 1.6, 2.2, 'accent');
    if (look.mark === 'spots') for (let k = 0; k < 6; k += 1) px(b, Math.round(bx - L * 0.25 + (k * L * 0.53) % (L * 0.6)), Math.round(by - bodyH * 0.15 + ((k * 7) % 3) * 2 - 1), look.spotTag || 'belly');
    if (look.mark === 'stripes') for (let k = 0; k < 5; k += 1) thick(b, Math.round(bx - L * 0.25 + k * L * 0.13), Math.round(by - bodyH * 0.45), Math.round(bx - L * 0.28 + k * L * 0.13), Math.round(by + bodyH * 0.2), 1, 'dark');
    tail(b, look, bx + L * 0.45, by - bodyH * 0.2, L * 0.18, frame);
    // neck and head, in front (left)
    const r = L * (look.headR ?? 0.2);
    const neck = look.neck ?? 0.35;
    const hx = bx - L * 0.5 - r * 0.2 + (look.headIn ?? 0) * L; const hy = by - bodyH * 0.35 - neck * L * 0.6;
    thick(b, Math.round(bx - L * 0.36), Math.round(by - bodyH * 0.1), Math.round(hx + r * 0.3), Math.round(hy + r * 0.3), Math.max(2, Math.round(r * 1.2)), 'fur');
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
      ell(b, bx - L * 0.2, by + L * 0.15, L * 0.22, L * 0.22, 'fur');
      const eye = head(b, look, bx - L * 0.22, by - L * 0.12, L * 0.2, 'pose');
      return { feet: Math.round(by + L * 0.3), eye };
    }
    const upright = frame === 'pose' && look.sits;
    if (upright) {
      ell(b, bx - L * 0.1, by, L * 0.2, L * 0.34, 'fur');
      if (look.belly) ell(b, bx - L * 0.15, by + L * 0.05, L * 0.12, L * 0.24, 'belly');
      tail(b, look, bx + L * 0.05, by + L * 0.15, L * 0.22, frame);
      b.rect(Math.round(bx - L * 0.22), feet - 1, Math.round(L * 0.3), 1, 'fur', 'fur');
      const eye = head(b, look, bx - L * 0.12, by - L * 0.42, L * 0.18, 'pose');
      return { feet, eye };
    }
    const sw = frame === 'walk' ? L * 0.08 : 0;
    for (const [i, lx] of (look.manyLegs ? [bx - L * 0.3, bx - L * 0.1, bx + L * 0.1, bx + L * 0.28] : [bx - L * 0.28, bx + L * 0.22]).entries()) thick(b, Math.round(lx), Math.round(by + L * 0.1), Math.round(lx + (i % 2 ? sw : -sw)), feet, 2, 'dark');
    ell(b, bx, by, L * 0.4, L * (look.bodyH ?? 0.2), 'fur');
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
    if (kind === 'back') {
      const arch = frame === 'walk' ? 0.6 : frame === 'pose' ? 1 : 0.8;
      for (let x = -L * 0.5; x <= L * 0.5; x += 1) { const hgt = Math.round(L * (look.back ?? 0.16) * arch * Math.cos((x / L) * Math.PI)); for (let y = 0; y < hgt; y += 1) b.set(Math.round(bx + x), wy - y, 'fur', 'fur'); }
      if (look.fin) { const fh = Math.round(L * (look.fin === 'tall' ? 0.32 : 0.12) * arch); for (let k = 0; k < fh; k += 1) b.rect(Math.round(bx + L * 0.05 - k * 0.25), wy - Math.round(L * 0.15 * arch) - k, Math.max(1, Math.round((fh - k) * 0.45)), 1, 'dark', 'dark'); }
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
    if (look.extra === 'crest') for (let k = 0; k < L * 0.5; k += 2) px(b, Math.round(bx - L * 0.2 + k), Math.round(by - L * 0.1), 'accent');
    if (look.mark === 'spots') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.15 + k * 3), Math.round(by - 1), 'accent');
    if (look.mark === 'stripes') for (let k = 0; k < 4; k += 1) px(b, Math.round(bx - L * 0.15 + k * 3), Math.round(by), 'dark');
    const hx = bx - L * 0.33; const hy = by - (frame === 'pose' ? L * 0.08 : L * 0.02);
    ell(b, hx, hy, L * 0.1, L * 0.065, 'fur');
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
    const up = frame === 'pose' || frame === 'walk';
    for (const s of [-1, 1]) {
      const cx = bx + s * L * 0.35; const cy = by - (up ? L * 0.3 : L * 0.05);
      thick(b, Math.round(bx + s * L * 0.2), Math.round(by - 1), Math.round(cx), Math.round(cy), 1, 'fur');
      ell(b, cx, cy, L * 0.09, L * 0.08, 'fur');
    }
    for (const s of [-1, 1]) { b.set(Math.round(bx + s * 2), Math.round(by - L * 0.2), 'fur', 'fur'); b.set(Math.round(bx + s * 2), Math.round(by - L * 0.2) - 1, INK, 'eye'); }
    return { feet, eye: [Math.round(bx), Math.round(by - L * 0.2)] };
  },

  /** Snails and slugs. */
  snail(b, look, frame) {
    const L = look.len;
    const bx = L * 0.7; const by = L * 0.9; const feet = Math.round(by + 1);
    thick(b, Math.round(bx - L * 0.45), feet - 1, Math.round(bx + L * 0.3), feet - 1, 2, 'belly');
    ell(b, bx, by - L * 0.2, L * 0.26, L * 0.24, 'fur');
    for (let a = 0; a < 9; a += 0.5) px(b, Math.round(bx + Math.cos(a) * a * 0.55), Math.round(by - L * 0.2 + Math.sin(a) * a * 0.55), 'dark');
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

/** Every body plan, for tests and the art preview. */
export const PLAN_NAMES = Object.keys(PLANS);
