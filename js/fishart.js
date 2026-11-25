// Fish and bait pictures for the fishing game (js/fishing.js).
//
// Pictures are drawn at Z fine pixels for every game pixel (Z = 2 in the
// game), so fish have shading, scales, gills and fin rays while the buddies
// keep their chunkier pixels. A fish faces left: the nose is at the left end,
// one game pixel in from the edge.
//
// look: { depth (body height / length), back, side, belly, fin, eye?, bar?,
//   mark?, shape?, tail?, snout?, flat?, spiny?, mouth?, fangs?, eyes3? }
// shape: 'fish' (default), 'eel', 'shark', 'angel', 'puffer', 'sword', 'box'
// tail: 'fork' (default), 'fan', 'shark'
// December fish (fishing.js SPOTS holiday) have marks of their own: 'globe' (a snow globe with a
// little pine inside), 'cane' (candy-cane stripes and a crook for a tail), 'present' (wrapping
// paper, a ribbon and a bow), 'lights' (a string of fairy lights), 'jester' (harlequin diamonds,
// a fin of three points with bells), 'cocoa' (marshmallows and steam), 'poinsettia', 'aurora'
// (northern lights), 'mint' (a peppermint swirl, its tail the wrapper's twist) and 'tree' (a
// Christmas tree: garlands, baubles and a star on its top fin). Their trimmings are drawn on the
// same fine pixels, each with an outline in a dark shade of its own color.
import { canvas } from './play.js';

const INK = '#1b1430';

function rgb(hex) { const n = parseInt(hex.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
/** Lighten (k > 0, toward white) or darken (k < 0, toward ink) a #rrggbb color. */
export function shade(hex, k) {
  const c = rgb(hex); const t = k > 0 ? [255, 255, 255] : [27, 20, 48]; const a = Math.min(1, Math.abs(k));
  return `#${c.map((v, i) => Math.round(v + (t[i] - v) * a).toString(16).padStart(2, '0')).join('')}`;
}
/** A mix of two #rrggbb colors (k = 0 a, 1 b). */
export function mix(a, b, k) {
  const x = rgb(a); const y = rgb(b);
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * k).toString(16).padStart(2, '0')).join('')}`;
}
const hash = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };
const TAU = Math.PI * 2;
/** Where the candy-cane eel's straight ends and its crook begins (share of its length). */
const CANE_END = 0.84;
/** The jester pike's three fin points (share of its length). */
const JESTER = [0.42, 0.53, 0.64];
/** Fairy-light bulb colors, in order along the string. */
const BULBS = ['#ff6b6b', '#ffd43b', '#69db7c', '#4dabf7', '#f783ac'];
/** The snow globe's little pines (S star, L/G/d/D greens lit from the top left, W snow, T trunk). */
const PINES = {
  big: ['....S....', '....L....', '...LGd...', '..LLGdd..', '.WLLGddW.', '...LGd...', '..LLGdd..', '.LLLGddd.', 'WLLLGdddW', '..LLGdd..', '.LLLGddd.', 'LLLLGdddD', 'WWLLGddWW', '....T....'],
  mid: ['...S...', '...L...', '..LGd..', '.WLGdW.', '..LGd..', '.LLGdd.', 'WLLGddW', '.LLGdd.', 'LLLGddD', 'WWLGdWW', '...T...'],
  small: ['..S..', '..L..', '.LGd.', 'WLGdW', '.LGd.', 'LLGdD', 'WLGdW', '..T..'],
};
const PINE_PAL = { S: '#fcc419', L: '#69db7c', G: '#40c057', d: '#2b8a3e', D: '#237032', W: '#ffffff', T: '#8b5a2b' };
/** A tree's baubles. */
const BAUBLES = ['#ff6b6b', '#4dabf7', '#ffd43b', '#f783ac', '#e5dbff'];

/** A fish picture, nose on the left. Returns a canvas. */
export function fishPic(look, len, Z = 1) {
  const shape = look.shape || (look.mark === 'puff' ? 'puffer' : look.mark === 'sword' ? 'sword' : 'fish');
  const tail = look.tail || (shape === 'shark' ? 'shark' : shape === 'angel' || shape === 'puffer' || shape === 'box' ? 'fan' : shape === 'eel' ? 'none' : 'fork');
  const L = Math.max(6, Math.round(len * Z));
  const D = Math.max(4, Math.round(L * look.depth));
  const pad = Z + 1;
  const mk = look.mark;
  const cane = shape === 'eel' && mk === 'cane';
  const bill = shape === 'sword' ? Math.round(L * 0.24) : 0;
  const finUp = shape === 'angel' ? 0.66 : shape === 'shark' || shape === 'sword' ? 0.7 : shape === 'eel' ? 0.3 : 0.32;
  const finDown = shape === 'angel' ? 0.66 : shape === 'shark' ? 0.5 : shape === 'eel' ? 0.3 : 0.22;
  // room above the body for what sits on top: a horn, a crown, and the December trimmings
  const trim = { cane: D * 1.95, present: 6 * Z, jester: D * 0.72 + 3 * Z, cocoa: 8 * Z, tree: D * 0.62 + 4 * Z }[mk] || 0;
  const head = look.mark === 'horn' ? D * 0.7 : look.mark === 'crown' ? D * 0.4 + 2 * Z : trim;
  const up = Math.round(Math.max(D * finUp, head, tail === 'shark' ? D * 0.5 : 0)) + pad;
  const down = Math.round(D * Math.max(finDown, look.mark === 'whiskers' ? 0.45 : 0)) + pad;
  const tailRoom = cane ? Math.round(D * 1.6) : 0; // the candy cane's crook curls out past the tail end
  const w = L + bill + 2 * pad + tailRoom; const h = up + D + down;
  const x0 = pad + bill; // where the body starts (the nose)
  const cy = up + D / 2;
  const c = canvas(w, h); const x = c.getContext('2d');
  const tailAt = shape === 'shark' ? 0.74 : shape === 'angel' || shape === 'puffer' || shape === 'box' ? 0.84 : tail === 'fan' ? 0.82 : 0.8;
  const neck = D * (shape === 'shark' ? 0.12 : 0.17);
  const front = shape === 'shark' || shape === 'sword' ? 0.42 : look.snout ? 0.55 : look.depth > 0.5 ? 0.45 : 0.35;

  // half heights of the body above and below the middle line at u (0 nose - 1 tail tip), or null
  const bodyAt = (u) => {
    if (u < 0 || u > 1) return null;
    if (shape === 'eel') {
      if (cane && u > CANE_END) return null; // the candy cane's straight runs on into its crook
      const k = u < 0.08 ? Math.sqrt(u / 0.08) : u < 0.7 || cane ? 1 : 1 - 0.85 * ((u - 0.7) / 0.3);
      return [D / 2 * k, D / 2 * k];
    }
    if (u > tailAt) return null;
    const k = u / tailAt;
    let half;
    if (shape === 'box') {
      // a boxfish: a box with rounded corners, then a short wrist to its little fan tail
      half = k < 0.16 ? (D / 2) * (0.5 + 0.5 * Math.sqrt(Math.sin((Math.PI / 2) * (k / 0.16)))) : k < 0.86 ? D / 2 : D / 2 - (D / 2 - neck) * ((k - 0.86) / 0.14) ** 0.6;
    } else if (k < front) {
      const a = k / front;
      half = (D / 2) * (look.snout || shape === 'shark' || shape === 'sword' ? 0.28 + 0.72 * Math.sin((Math.PI / 2) * a) : Math.sqrt(Math.sin((Math.PI / 2) * a)));
    } else half = D / 2 - (D / 2 - neck) * ((k - front) / (1 - front)) ** (shape === 'puffer' ? 0.8 : 1.4);
    const t = look.flat ? half * 0.82 : half;
    const b = look.flat ? half * 1.04 : half;
    return [t, b];
  };
  // the tail fin: [top, bottom] half heights at u, or null
  const tailAt2 = (u, dy) => {
    if (tail === 'none' || u <= tailAt || u > 1) return false;
    const k = (u - tailAt) / (1 - tailAt);
    if (tail === 'fork') {
      const half = neck + (D / 2 * 1.1 - neck) * k;
      if (k > 0.5 && Math.abs(dy) < half * (0.5 * (k - 0.5) / 0.5 + 0.1)) return false;
      return Math.abs(dy) <= half;
    }
    if (tail === 'fan') {
      const half = neck + (D / 2 * 0.95 - neck) * Math.sqrt(k);
      const round = k > 0.5 ? 0.45 + 0.55 * Math.sqrt(Math.max(0, 1 - ((k - 0.5) / 0.5) ** 2)) : 1; // a rounded end
      return Math.abs(dy) <= half * round;
    }
    // shark: a tall top lobe, a short bottom one
    const top = neck + D * 0.75 * k ** 0.9;
    const bot = k < 0.5 ? neck + D * 0.3 * (k / 0.5) : (neck + D * 0.3) * (1 - (k - 0.5) / 0.5) * 1.1;
    if (dy < 0) return -dy <= top && !(k > 0.7 && -dy < top - D * 0.22 * (k - 0.6) / 0.4 - neck && -dy > neck);
    return dy <= Math.max(neck, bot);
  };
  // fins on the back (up) and belly (down): how far past the body they reach at u
  const finAt = (u, dir) => {
    const tri = (a, b, H, peak = 0) => { if (u < a || u > b) return 0; const p = a + (b - a) * peak; return u < p ? H * (u - a) / Math.max(1e-6, p - a) : H * (1 - (u - p) / (b - p)) ** 0.8; };
    if (dir < 0) {
      if (cane) return u > 0.1 && u < CANE_END - 0.05 ? D * 0.44 * Math.min(1, (u - 0.1) / 0.08) * (0.8 + 0.2 * Math.sin(u * 60)) : 0; // a frilly fin ridge all along its back
      if (shape === 'eel') return u > 0.28 && u < 0.98 ? D * 0.22 * Math.min(1, (u - 0.28) / 0.1) : 0;
      if (shape === 'box') return 0; // the bow sits where its back fin would be
      if (mk === 'cocoa') return 0; // marshmallows instead of a back fin
      if (mk === 'jester') return JESTER.reduce((a, c) => a + tri(c - 0.06, c + 0.05, D * 0.72, 0.62), 0);
      if (shape === 'shark') return tri(0.3, 0.5, D * 0.65, 0.25) + tri(0.6, 0.68, D * 0.22, 0.3);
      if (shape === 'sword') return tri(0.18, 0.36, D * 0.7, 0.3);
      if (shape === 'angel') return u > 0.26 && u < 0.84 ? D * 0.62 * Math.min(((u - 0.26) / 0.48) ** 0.8, (0.84 - u) / 0.1) : 0;
      if (shape === 'puffer') return tri(0.6, 0.72, D * 0.16, 0.4);
      const H = D * 0.24;
      if (look.spiny) return u > 0.3 && u < 0.66 ? (u < 0.46 ? H * 1.15 * (0.75 + 0.25 * Math.sin(u * 70)) : H * 0.9 * (1 - (u - 0.46) / 0.2)) : 0;
      return tri(0.36, 0.66, H, 0.05);
    }
    if (shape === 'eel') return u > (cane ? 0.42 : 0.5) && u < (cane ? CANE_END - 0.05 : 0.98) ? D * (cane ? 0.26 : 0.2) * Math.min(1, (u - (cane ? 0.42 : 0.5)) / 0.1) : 0;
    if (shape === 'box') return tri(0.64, 0.76, D * 0.12, 0.4);
    if (shape === 'shark') return tri(0.24, 0.36, D * 0.5, 0.15) + tri(0.62, 0.68, D * 0.18, 0.3);
    if (shape === 'sword') return tri(0.25, 0.32, D * 0.35, 0.2);
    if (shape === 'angel') return u > 0.32 && u < 0.84 ? D * 0.62 * Math.min(((u - 0.32) / 0.42) ** 0.8, (0.84 - u) / 0.1) : 0;
    if (shape === 'puffer') return tri(0.6, 0.7, D * 0.14, 0.4);
    return tri(0.58, 0.72, D * 0.15, 0.2);
  };

  const top = (u) => { const b = bodyAt(u); return b ? cy - b[0] : cy; };
  const bot = (u) => { const b = bodyAt(u); return b ? cy + b[1] : cy; };
  const X = (u) => Math.round(x0 + L * u);

  // what each pixel is: 0 nothing, 1 body, 2 fin, 3 a December trimming (its color in deco)
  const kind = new Uint8Array(w * h);
  const at = (i, j) => (i < 0 || j < 0 || i >= w || j >= h ? 0 : kind[j * w + i]);
  for (let i = 0; i < w; i += 1) {
    const u = (i + 0.5 - x0) / L;
    const b = bodyAt(u);
    for (let j = 0; j < h; j += 1) {
      const dy = j + 0.5 - cy;
      if (b && dy >= -b[0] && dy <= b[1]) { kind[j * w + i] = 1; continue; }
      if (tailAt2(u, dy)) { kind[j * w + i] = 2; continue; }
      if (b && dy < -b[0] && -dy - b[0] <= finAt(u, -1)) { kind[j * w + i] = 2; continue; }
      if (b && dy > b[1] && dy - b[1] <= finAt(u, 1)) kind[j * w + i] = 2;
    }
  }
  const dec = mk ? december(look, { L, D, Z, w, h, cy, x0, shape, kind, top, bot, X }) : null;
  const px = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  const fine = Z > 1;
  const finDark = shade(look.fin, -0.22);
  const backHi = shade(look.back, 0.2);
  const sideDark = shade(look.side, -0.1);
  const bellyDark = shade(look.belly, -0.18);
  for (let i = 0; i < w; i += 1) {
    const u = (i + 0.5 - x0) / L;
    const b = bodyAt(u);
    for (let j = 0; j < h; j += 1) {
      const k = at(i, j);
      if (!k) continue;
      if (k === 3) { px(i, j, dec.deco[j * w + i]); continue; }
      const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      if (edge) { px(i, j, INK); continue; }
      const hv = b ? (j + 0.5 - (cy - b[0])) / (b[0] + b[1]) : 0.5;
      const hc = dec?.color(i, j, u, hv, k, (i + j) % 2 === 0, at);
      if (hc) { px(i, j, hc); continue; }
      if (k === 2) {
        // fin rays
        const ray = u > tailAt ? i % 2 === 0 : (i + Math.round(j * 0.5)) % 3 === 0;
        px(i, j, fine && ray ? finDark : look.fin);
        continue;
      }
      const v = b ? (j + 0.5 - (cy - b[0])) / (b[0] + b[1]) : 0.5; // 0 top of the body, 1 bottom
      const dith = (i + j) % 2 === 0;
      let col = v < 0.3 + (dith ? 0.03 : -0.03) ? look.back : v < 0.62 + (dith ? 0.03 : -0.03) ? look.side : look.belly;
      if (fine) {
        if (v > 0.1 && v < 0.18 && u > 0.12 && u < 0.7) col = backHi; // a shine along the back
        if (v > 0.9) col = bellyDark; // shadow under the belly
        if (col === look.side && j % 2 === 0 && (i + (j % 4 === 0 ? 2 : 0)) % 4 === 0 && u > 0.25 && u < 0.75) col = sideDark; // scales
      }
      if (shape === 'eel' && u > 0.8) col = mix(col, look.fin, 0.5);
      // markings
      const m = look.mark;
      const cell = (a, bb, n) => ((Math.floor(i / Z) * a + Math.floor(j / Z) * bb) % n === 0);
      if (m === 'bars' && u > 0.2 && u < 0.76 && Math.floor(u * 9 + (fine && dith ? 0.06 : 0)) % 2 === 0 && v < 0.74) col = look.bar || look.back;
      if (m === 'stripe' && Math.abs(v - 0.5) < 0.09 && u > 0.12 && u < (shape === 'eel' ? 0.95 : 0.8) && Math.sin(u * 46) > -0.7) col = look.bar || look.back;
      if ((m === 'spots' || m === 'glow' || m === 'sugar') && u > 0.16 && u < (shape === 'eel' ? 0.95 : 0.78) && v < (m === 'sugar' ? 0.9 : 0.68) && cell(7, 13, m === 'sugar' ? 5 : 9) && (i % Z === 0 || !fine)) col = m === 'sugar' ? '#ffffff' : m === 'glow' && cell(3, 1, 2) ? '#ffffff' : look.spot || look.belly;
      if (m === 'peacock' && v < 0.7 && [0.3, 0.47, 0.64].some((q) => Math.abs(u - q) < 0.035)) col = '#2b3a1a';
      if (m === 'flame' && u > 0.2 && u < 0.78 && v > 0.32 + 0.16 * Math.sin(u * 30 + (v > 0.6 ? 1 : 0)) && v < 0.86) col = v > 0.6 ? '#ffd43b' : '#ff922b';
      if (m === 'comet' && u > 0.18 && u < 0.78 && cell(5, 3, 7)) col = '#ffffff';
      if (m === 'blotch' && u > 0.18 && u < 0.78 && v < 0.75 && hash(Math.floor((i + (dith ? 1 : 0)) / (1.5 * Z)), Math.floor(j / (1.5 * Z))) > 0.6) col = look.bar || look.back;
      px(i, j, col);
    }
  }
  // the pectoral fin, just behind the gills
  if (fine && shape !== 'eel' && shape !== 'puffer' && look.mark !== 'globe') {
    const fx = X(shape === 'shark' ? 0.24 : 0.24); const fy = Math.round(cy + D * 0.12);
    const n = Math.max(3, Math.round(L * 0.09));
    for (let k = 0; k < n; k += 1) for (let d = 0; d <= Math.round((1 - k / n) * D * 0.13); d += 1) px(fx + k, fy + d, k === n - 1 || d === Math.round((1 - k / n) * D * 0.13) ? finDark : look.fin);
  }
  if (fine && cane) {
    // a little pectoral fin and a gill slit behind the head, so it reads as a fish, not a sweet
    const gx = X(0.13);
    for (let j = Math.round(cy - D * 0.28); j <= Math.round(cy + D * 0.22); j += 1) px(gx + (Math.abs(j - cy) < D * 0.12 ? 1 : 0), j, '#7a1424');
    const fx = X(0.16); const fy = Math.round(cy + D * 0.08); const n = Math.max(4, Math.round(D * 0.55));
    for (let k = 0; k < n; k += 1) {
      const hh = Math.max(1, Math.round((1 - k / n) * D * 0.32));
      for (let d = 0; d <= hh; d += 1) px(fx + k, fy + d, k === n - 1 || d === hh || d === 0 ? INK : (k + d) % 2 ? look.fin : shade(look.fin, -0.15));
    }
  }
  // gills
  if (fine) {
    if (shape === 'shark') {
      for (const g of [0.19, 0.215, 0.24]) for (let j = Math.round(cy - D * 0.14); j <= Math.round(cy + D * 0.14); j += 1) px(X(g), j, shade(look.side, -0.3));
    } else if (shape !== 'eel' && shape !== 'box' && look.mark !== 'globe' && look.mark !== 'mint') {
      const gx = x0 + L * (look.snout ? 0.2 : shape === 'angel' ? 0.24 : 0.2);
      for (let j = Math.round(top(0.2) + 2); j < Math.round(bot(0.2) - 1); j += 1) {
        const v = (j - top(0.2)) / Math.max(1, bot(0.2) - top(0.2));
        px(Math.round(gx + Math.sin(Math.PI * v) * Z * 1.5), j, shade(look.side, -0.32));
      }
    }
  }
  // the eye
  const eu = shape === 'eel' ? 0.06 : shape === 'shark' ? 0.1 : shape === 'sword' ? 0.08 : look.snout ? 0.15 : shape === 'angel' ? 0.14 : shape === 'box' ? 0.13 : 0.11;
  const ex = X(eu); const ey = Math.round(cy - D * (shape === 'eel' ? 0.1 : 0.18));
  const eyeR = fine ? (L > 36 ? 2 : 1) : 0;
  const eye = (cx, cyy) => {
    if (!fine) { px(cx, cyy, look.eye || '#ffffff'); px(cx + 1, cyy, INK); return; }
    for (let a = -eyeR; a <= eyeR; a += 1) for (let bb = -eyeR; bb <= eyeR; bb += 1) if (a * a + bb * bb <= eyeR * eyeR + 1) px(cx + a, cyy + bb, look.eye || '#ffffff');
    px(cx - 1, cyy, INK); px(cx, cyy, INK); if (eyeR > 1) { px(cx - 1, cyy + 1, INK); px(cx, cyy + 1, INK); }
    px(cx - 1, cyy - 1 + (eyeR > 1 ? 0 : 0), '#ffffff');
  };
  if (cane && fine) { // a dark ring round its eye, so it shows on the white stripes
    const R = eyeR + 1;
    for (let a = -R; a <= R; a += 1) for (let bb = -R; bb <= R; bb += 1) { const d = a * a + bb * bb; if (d > eyeR * eyeR + 1 && d <= R * R + 1) px(ex + a, ey + bb, INK); }
  }
  eye(ex, ey);
  if (look.eyes3) { eye(ex + 3 * Z, ey - Z - 1); eye(ex + 3 * Z, ey + 2 * Z); }
  // the mouth
  const my = Math.round(cy + D * (look.mouth === 'big' ? 0.12 : shape === 'shark' ? 0.14 : 0.06));
  const ml = shape === 'box' ? Z : Math.max(Z, Math.round(L * (look.mouth === 'big' ? 0.1 : look.snout || shape === 'eel' ? 0.08 : 0.05)));
  if (shape !== 'sword') for (let k = 0; k < ml; k += 1) px(x0 + k + (shape === 'shark' ? Z : 0), my + (look.mouth === 'big' && k > ml * 0.6 ? -1 : 0), INK);
  if (cane && fine) {
    // its mouth open: two jaws, the water showing between them at the front, dark red inside
    const mo = Math.max(3, Math.round(L * 0.1));
    for (let k = 0; k < mo; k += 1) {
      const oh = Math.round((1 - k / mo) * D * 0.24);
      if (oh < 1) { px(x0 + k, my, INK); continue; }
      for (let d = -oh; d <= oh; d += 1) {
        const yy = my + d;
        if (Math.abs(d) === oh) px(x0 + k, yy, INK);
        else if (k < mo * 0.3) x.clearRect(x0 + k, yy, 1, 1);
        else px(x0 + k, yy, d > 0 ? '#c92a2a' : '#7a1424');
      }
    }
    px(x0 + Math.round(mo * 0.45), my - Math.round(D * 0.12), '#ffffff'); // a little tooth
  }
  if (look.fangs) {
    for (let k = 1; k < ml; k += Math.max(2, Z + 1)) { px(x0 + k + 1, my + 1, '#ffffff'); if (fine) px(x0 + k + 1, my + 2, '#ffffff'); px(x0 + k + 2, my - 1, '#ffffff'); }
    if (look.fangs === 'long') for (let d = -1; d <= 2 * Z + 1; d += 1) { px(x0 + Math.round(ml * 0.6), my - d, '#ffffff'); px(x0 + Math.round(ml * 0.6) + 1, my - d, d > Z ? INK : '#ffffff'); }
  }
  // extras
  const m = look.mark;
  if (look.flap) // bluegill's dark ear flap
    for (let a = 0; a < Z + 1; a += 1) for (let bb = 0; bb < Z; bb += 1) px(ex + 3 * Z + a, ey + Z + bb, INK);
  if (m === 'whiskers') {
    const n = fine ? Math.round(D * 0.35) : 2;
    for (let k = 0; k <= n; k += 1) { px(x0 - Math.round(k * 0.5), my + 1 + k, INK); px(x0 + Z + Math.round(k * 0.2), my + 1 + k, INK); }
    if (fine) for (let k = 0; k <= n * 0.6; k += 1) px(x0 - 1 - k, my - 1 - Math.round(k * 0.5), INK);
  }
  if (m === 'peacock') {
    const tx = X(0.76); const ty = Math.round(cy); const r = Math.max(1, Z);
    for (let a = -r - 1; a <= r + 1; a += 1) for (let bb = -r - 1; bb <= r + 1; bb += 1) { const d = a * a + bb * bb; if (d <= (r + 1) * (r + 1)) px(tx + a, ty + bb, d <= r * r ? INK : '#fcc419'); }
  }
  if (m === 'horn') {
    const hx = X(0.08); const hy = Math.round(top(0.08));
    const n = Math.round(D * 0.6);
    for (let k = 0; k < n; k += 1) {
      const xx = hx - Math.round(k * 0.45); const yy = hy - 1 - k;
      const wdt = Math.max(1, Math.round((1 - k / n) * Z * 1.5));
      for (let d = 0; d < wdt; d += 1) px(xx + d, yy, (k + d) % (2 * Z) < Z ? '#ffd43b' : '#ffffff');
      px(xx - 1, yy, INK); px(xx + wdt, yy, INK);
    }
    px(hx - Math.round(n * 0.45), hy - 1 - n, INK);
  }
  if (m === 'crown') {
    const cx = X(0.09); const base = Math.round(top(0.14)) - 1; const cw = Math.max(5, Math.round(L * 0.22)); const ch = Math.max(2, Math.round(D * 0.3));
    for (let k = 0; k < cw; k += 1) for (let d = 0; d < ch; d += 1) {
      const point = k % Math.max(2, Math.round(cw / 3)) === 0;
      if (d > ch * 0.45 && !point) continue;
      px(cx + k, base - d, d === 0 ? '#e67700' : '#fcc419');
    }
    for (let k = 1; k < cw; k += Math.max(2, Math.round(cw / 3))) px(cx + k, base - 1, '#e03131');
  }
  if (m === 'sword') {
    const by = Math.round(cy - D * 0.06);
    for (let k = 0; k < bill + 2; k += 1) { px(x0 - k, by, '#adb5bd'); px(x0 - k, by - 1, INK); px(x0 - k, by + 1, INK); }
    px(x0 - bill - 2, by, INK);
  }
  if (m === 'puff') {
    for (let i = x0 + 2 * Z; i < x0 + L * 0.74; i += 2 * Z + 1) {
      const u = (i - x0) / L;
      px(i, Math.round(top(u)) - 1, INK); px(i, Math.round(bot(u)) + 1, INK);
      if (fine) { px(i, Math.round(top(u)) - 2, INK); px(i, Math.round(bot(u)) + 2, INK); }
    }
  }
  if (m === 'ring') {
    // a planet's ring, tipped, crossing the body
    const rcx = x0 + L * 0.4; const rx = L * 0.42; const ry = D * 0.2;
    for (let a = 0; a < 360; a += 1.5) {
      const t = (a * Math.PI) / 180;
      const xx = rcx + Math.cos(t) * rx; const yy = cy + Math.sin(t) * ry - Math.cos(t) * D * 0.14;
      if (Math.sin(t) < 0 && at(Math.round(xx), Math.round(yy)) === 1) continue; // the back half goes behind the body
      for (let d = 0; d < Z; d += 1) px(Math.round(xx), Math.round(yy) + d, d === 0 ? '#ffd43b' : '#e67700');
    }
  }
  // the December trimmings drawn last (steam over the cocoa)
  for (const [i, j, col] of dec?.after || []) px(i, j, col);
  return c;
}

// ---------- December fish ----------
// Each December fish's mark: its trimmings (kind 3 in the mask, each pixel's color in deco, drawn
// with a 1-pixel outline in a dark shade of its own color), its own colors for the body and fins
// (color() gives a pixel's color, or null for the fish's usual one), and pixels drawn last (after).
const DEC_MARKS = new Set(['globe', 'cane', 'present', 'lights', 'jester', 'cocoa', 'poinsettia', 'aurora', 'mint', 'tree']);

function december(look, g) {
  const mk = look.mark;
  if (!DEC_MARKS.has(mk)) return null;
  const { L, D, Z, w, h, cy, x0, shape, kind, top, bot, X } = g;
  const deco = new Array(w * h).fill(null);
  const after = [];
  const inBox = (i, j) => i >= 0 && j >= 0 && i < w && j < h;
  /**
   * A little hand-drawn sprite: rows of letters, pal: letter -> color ('.' is empty). It goes
   * over empty pixels only (over: also over the body, sinking into it), with a 1-pixel ring of
   * the outline color round it where it meets the water.
   */
  const stamp = (sx, sy, rows, pal, outline, over = false) => {
    const fills = [];
    rows.forEach((r, dy) => { for (let dx = 0; dx < r.length; dx += 1) if (pal[r[dx]]) fills.push([sx + dx, sy + dy, pal[r[dx]]]); });
    for (const [i, j, col] of fills) {
      if (!inBox(i, j)) continue;
      const n = j * w + i;
      if (kind[n] && kind[n] !== 3 && !over) continue;
      kind[n] = 3; deco[n] = col;
    }
    if (outline) for (const [i, j] of fills) for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const ii = i + a; const jj = j + b;
      if (!inBox(ii, jj) || kind[jj * w + ii]) continue;
      kind[jj * w + ii] = 3; deco[jj * w + ii] = outline;
    }
  };
  const big = L >= 44;
  let color = () => null;

  if (mk === 'globe') {
    // a snow globe: blue glass with snow falling round a little pine, on a snowy ground and a red base
    const tx = X(0.52); const t0 = top(0.52); const tb = bot(0.52); const hh = tb - t0;
    const ground = (u) => 0.66 + 0.035 * Math.sin(u * 23 + 1);
    const treeBase = Math.round(t0 + hh * (ground(0.52) + 0.03));
    const pine = hh >= 26 ? PINES.big : hh >= 17 ? PINES.mid : PINES.small;
    const tree = new Map();
    const tw = pine[0].length;
    pine.forEach((row, r) => { for (let dx = 0; dx < tw; dx += 1) if (PINE_PAL[row[dx]]) tree.set((treeBase - pine.length + 1 + r) * w + tx - (tw >> 1) + dx, PINE_PAL[row[dx]]); });
    color = (i, j, u, v, k, dith) => {
      if (k !== 1) return null;
      if (v > 0.8) return v < 0.87 ? (dith ? '#ffe066' : '#f59f00') : v > 0.93 ? '#8f1d1d' : '#c92a2a'; // the base, gold trim on top
      const gr = ground(u);
      const t = tree.get(j * w + i); if (t) return t;
      if (v > gr) return v < gr + 0.06 && !dith ? '#d0ebff' : '#ffffff'; // snow on the ground
      if (u > 0.13 && u < 0.36 && Math.abs(v - (0.13 + 2.6 * (u - 0.25) ** 2)) < 0.035) return '#ffffff'; // a shine on the glass
      if (u > 0.68 && u < 0.71 && v > 0.3 && v < 0.52) return '#e7f5ff';
      if ((i % 2 === 0 && j % 2 === 1 && hash(i, j) > 0.88) || hash(i + 3, j) > 0.985) return '#ffffff'; // snow falling
      return v < 0.3 + (dith ? 0.04 : -0.04) ? look.back : look.side;
    };
  }

  if (mk === 'cane') {
    // red and white stripes, on round a crook at the tail end
    const R = D * 0.95; const ccx = x0 + L * CANE_END; const ccy = cy - R; const half0 = D / 2; const PHI = 4.9;
    const P = Math.max(5, Math.round(D * 0.9));
    const s0 = ccx + cy;
    const endA = Math.PI / 2 - PHI; const ex = ccx + R * Math.cos(endA); const ey = ccy + R * Math.sin(endA);
    const hook = new Map();
    for (let j = 0; j < h; j += 1) for (let i = Math.floor(ccx - R - D); i < w; i += 1) {
      if (kind[j * w + i]) continue;
      const dx = i + 0.5 - ccx; const dy = j + 0.5 - ccy; const r = Math.hypot(dx, dy);
      let phi = Math.PI / 2 - Math.atan2(dy, dx); phi = ((phi % TAU) + TAU) % TAU;
      const half = half0 * (1 - 0.15 * Math.min(1, phi / PHI));
      const cap = Math.hypot(i + 0.5 - ex, j + 0.5 - ey) <= half0 * 0.85;
      if ((phi <= PHI && Math.abs(r - R) <= half) || cap) { kind[j * w + i] = 1; hook.set(j * w + i, [phi, r, dx / (r || 1), dy / (r || 1), half]); }
    }
    const tone = (red, lit) => (red ? (lit > 0.3 ? '#ff6b6b' : lit < -0.4 ? '#a61e1e' : '#e03131') : (lit > 0.3 ? '#ffffff' : lit < -0.4 ? '#ced4da' : '#f1f3f5'));
    color = (i, j, u, v, k) => {
      if (k !== 1) return null;
      const hk = hook.get(j * w + i);
      if (hk) {
        const [phi, r, nx, ny, half] = hk;
        const st = s0 + Math.min(phi, PHI) * R + (r - R);
        const t = Math.max(-1, Math.min(1, (r - R) / half));
        return tone(((Math.floor(st) % P) + P) % P < P / 2, t * (nx * -0.6 + ny * -0.8));
      }
      return tone(((i + j) % P + P) % P < P / 2, (v - 0.5) * -2 * 0.8);
    };
  }

  if (mk === 'present') {
    // red paper with little dots, a green ribbon each way, and a bow on top
    const rx = X(0.5); const rw = Math.max(Z, Math.round(D * 0.09));
    color = (i, j, u, v, k, dith) => {
      if (k !== 1) return null;
      const ox = i + 0.5 - rx; const oy = j + 0.5 - cy;
      const onV = Math.abs(ox) <= rw; const onH = Math.abs(oy) <= rw;
      if (onV || onH) {
        if (onV && onH) return Math.abs(ox) < rw - 0.5 && Math.abs(oy) < rw - 0.5 ? '#2f9e44' : '#237032';
        if (onV) return ox < -rw + 1 ? '#8ce99a' : ox > rw - 1 ? '#237032' : v < 0.16 ? '#69db7c' : '#40c057';
        return oy < -rw + 1 ? '#8ce99a' : oy > rw - 1 ? '#237032' : '#40c057';
      }
      const row = Math.floor((j - cy + 100) / 5);
      if ((i + (row % 2) * 3) % 6 === 0 && (j - Math.round(cy) + 100) % 5 === 2 && u > 0.1) return v < 0.18 ? '#fff5f5' : '#ffc9c9';
      return v < 0.16 ? '#ff6b6b' : v > 0.86 ? '#a61e1e' : v > 0.8 && dith ? '#c92a2a' : '#e03131';
    };
    const by = Math.round(top(0.5));
    const pal = { G: '#40c057', L: '#8ce99a', K: '#237032', D: '#2b8a3e' };
    if (big) stamp(rx - 5, by - 5, ['.LGG...GGD.', 'LG..G.G..GD', 'LG..GKG..GD', '.LGGKKKGGD.', '...GD.GD...', '..GD...GD..'], pal, '#14532d', true);
    else stamp(rx - 3, by - 3, ['LGG.GGD', 'G.GKG.D', '.GGKGG.', '..D.D..'], pal, '#14532d', true);
  }

  if (mk === 'lights') {
    // a string of fairy lights in swags along its side, each bulb glowing on the dark scales
    const lit = new Map();
    const u0 = 0.24; const u1 = 0.74; const gap = Math.max(7, Math.round(L * 0.1));
    const xs = []; for (let x = X(u0); x <= X(u1); x += gap) xs.push(x);
    const sag = Math.max(2, D * 0.22);
    const wy = (x) => { const k = (x - xs[0]) / gap; const f = k - Math.floor(k); const u = (x + 0.5 - x0) / L; return top(u) + (bot(u) - top(u)) * 0.3 + Math.sin(f * Math.PI) * sag; };
    for (let x = xs[0] - 1; x <= xs[xs.length - 1] + 1; x += 1) lit.set(Math.round(wy(x)) * w + x, '#8bc34a');
    xs.forEach((x, n) => {
      const col = BULBS[n % BULBS.length]; const y = Math.round(wy(x));
      const bw = D >= 22 ? 4 : big ? 3 : 2; const bh = bw + 1; const bx = x - (bw >> 1);
      lit.set(y * w + x, '#2b5d2b'); // the socket
      // the bulb: a drop shape, lit at the top left
      for (let r = 1; r <= bh; r += 1) for (let dx = 0; dx < bw; dx += 1) {
        if (r === bh && (dx === 0 || dx === bw - 1) && bw > 2) continue;
        lit.set((y + r) * w + bx + dx, r === 1 && dx === 0 ? '#ffffff' : r >= bh - 1 && dx === bw - 1 ? shade(col, -0.2) : col);
      }
      // the glow: an in-between color round the bulb, every other pixel further out
      for (let r = -1; r <= bh + 2; r += 1) for (let dx = -2; dx <= bw + 1; dx += 1) {
        const n2 = (y + r) * w + bx + dx; if (lit.has(n2)) continue;
        const near = dx >= -1 && dx <= bw && r >= 0 && r <= bh + 1;
        if (near || (r + dx) % 2 === 0) lit.set(n2, `glow:${col}:${near ? 0.6 : 0.32}`);
      }
    });
    color = (i, j, u, v, k) => {
      if (k !== 1) return null;
      const c = lit.get(j * w + i); if (!c) return null;
      if (!c.startsWith('glow:')) return c;
      const [, col, amt] = c.split(':');
      const base = v < 0.3 ? look.back : v < 0.62 ? look.side : look.belly;
      return mix(base, col, Number(amt));
    };
  }

  if (mk === 'jester') {
    // red and green diamonds, a gold belly, a fin of three points with a bell on each
    const P = Math.max(4, Math.round(D * 0.55));
    const pt = (u) => JESTER.reduce((best, c, n) => (Math.abs(u - c) < Math.abs(u - JESTER[best]) ? n : best), 0);
    color = (i, j, u, v, k, dith, at) => {
      if (k === 2) {
        const tail = u > 0.8; const above = j + 0.5 < cy;
        const red = tail ? above : u > 0.3 && u < 0.75 && above ? pt(u) % 2 === 0 : null;
        if (red === null) return (i + j) % 3 === 0 ? '#e67700' : '#fcc419';
        const ray = tail ? i % 2 === 0 : (i + Math.round(j * 0.5)) % 3 === 0;
        return red ? (ray ? '#a61e1e' : '#e03131') : (ray ? '#1e6b30' : '#2f9e44');
      }
      if (v > 0.8) return v > 0.92 ? '#e67700' : '#fcc419';
      if (u < 0.17) return v < 0.3 ? '#9775fa' : '#7048e8'; // a purple hood over the head
      const a = Math.floor((i - x0 + (j - cy) * 1.4) / P); const bq = Math.floor((i - x0 - (j - cy) * 1.4) / P);
      const red = (((a + bq) % 2) + 2) % 2 === 0;
      const lit = v < 0.22; const dark = v > 0.68;
      return red ? (lit ? '#ff6b6b' : dark ? '#c92a2a' : '#e03131') : (lit ? '#51cf66' : dark ? '#237032' : '#2f9e44');
    };
    const pal = { Y: '#fcc419', W: '#fff9db', D: '#e67700', K: '#5c2b00' };
    for (const c of JESTER) {
      const tx = Math.round(x0 + L * (c - 0.06 + 0.11 * 0.62)); const ty = Math.round(top(c) - D * 0.72);
      if (big) stamp(tx - 2, ty - 3, ['.YY.', 'YWYY', 'YYYD', '.KD.'], pal, '#7a3d00');
      else stamp(tx - 1, ty - 2, ['WY', 'YD'], pal, '#7a3d00');
    }
  }

  if (mk === 'cocoa') {
    // a mug's worth: cocoa brown with a frothy top, a creamy belly, marshmallows bobbing on its back, and steam
    color = (i, j, u, v, k, dith) => {
      if (k !== 1) return null;
      if (v < 0.16 && u > 0.14) return dith ? '#b07a4a' : '#9a6538'; // froth along its back
      if (v < 0.22 && u > 0.14 && dith) return '#9a6538';
      return null;
    };
    const spots = big ? [0.33, 0.46, 0.59] : [0.36, 0.53];
    spots.forEach((u, n) => {
      const mx = X(u); const my = Math.round(top(u));
      const pal = n === 1 ? { H: '#ffffff', W: '#fff0f6', S: '#fcc2d7', D: '#f783ac' } : { H: '#ffffff', W: '#f8f9fa', S: '#dee2e6', D: '#adb5bd' };
      // a soft cube, its top face lit, sunk a little into the cocoa
      if (big) stamp(mx - 3, my - 5 + (n % 2), ['.HHHH.', 'HHHHWW', 'WWWWSS', 'WWWWSD', 'SSSSDD'], pal, '#7a5848', true);
      else stamp(mx - 2, my - 3 + (n % 2), ['HHHW', 'WWWS', 'SSSD'], pal, '#7a5848', true);
    });
    // wisps of steam between the marshmallows, curling up
    const gaps = big ? [0.395, 0.525] : [0.445];
    gaps.forEach((u, n) => {
      const sx = X(u); const sy = Math.round(top(u)) - (big ? 5 : 3);
      const tall = big ? 9 : 6;
      for (let k = 0; k < tall; k += 1) {
        if (k > tall - 3 && k % 2) continue; // it thins out at the top
        const xx = sx + Math.round(Math.sin(k * 0.55 + n * 3) * (big ? 1.5 : 1));
        after.push([xx, sy - k, k % 3 === 0 ? '#e6e9f5' : '#ffffff']);
      }
    });
  }

  if (mk === 'poinsettia') {
    // a poinsettia on its green side: six red bracts round a little yellow-green middle
    const fx = X(0.47); const fy = top(0.47) + (bot(0.47) - top(0.47)) * 0.4; const R = D * 0.4; const sector = TAU / 6;
    color = (i, j, u, v, k, dith) => {
      if (k !== 1) return null;
      if (v > 0.68 && v < 0.74 && dith) return '#e03131'; // the red belly, dithered into the green
      if (v >= 0.74) return v > 0.9 ? '#a61e1e' : '#e03131';
      const dx = i + 0.5 - fx; const dy = (j + 0.5 - fy) * 1.05; const r = Math.hypot(dx, dy);
      if (r > R) return v < 0.3 + (dith ? 0.03 : -0.03) ? look.back : look.side;
      if (r < Math.max(1.5, R * 0.2)) return (i + j) % 2 ? '#fcc419' : '#94d82d';
      let th = Math.atan2(dy, dx) + 0.3; th = ((th % sector) + sector) % sector;
      const tri = 1 - Math.abs(th / sector - 0.5) * 2;
      if (r > R * (0.3 + 0.7 * tri)) return v < 0.3 + (dith ? 0.03 : -0.03) ? look.back : look.side;
      if (tri > 0.9 && r > R * 0.35) return '#a61e1e'; // the vein down each bract
      return dx + dy < -1 ? '#ff6b6b' : r > R * 0.75 ? '#c92a2a' : '#e03131';
    };
  }

  if (mk === 'aurora') {
    // a night sky with stars, and the northern lights hanging across its side: a wavy curtain,
    // violet at the top, green below and a bright edge at the bottom, with rays shining up
    color = (i, j, u, v, k, dith) => {
      if (k === 2) return (u > 0.8 ? i % 2 === 0 : (i + Math.round(j * 0.5)) % 3 === 0) ? '#13203c' : '#24365e';
      if (v > 0.84) return v > 0.93 ? '#868e96' : '#ced4da'; // a snowy silver belly
      const night = v < 0.14 && u > 0.12 && u < 0.7 ? '#2b4170' : '#1b2a4a';
      const lo = 0.71 + 0.06 * Math.sin(u * 11 + 0.4);
      const ray = Math.max(0, Math.sin(u * 47) + Math.sin(u * 19 + 1) - 0.6) * 0.09;
      const tall = 0.46 + 0.05 * Math.sin(u * 23) + ray;
      const t = (v - (lo - tall)) / tall;
      if (u < 0.18 || t < 0 || t > 1) {
        if (t < 0 && i % 2 === 0 && j % 2 === 0 && hash(i, j) > 0.84 && u > 0.18) return '#ffffff'; // stars
        return t > 1 ? '#16304e' : night;
      }
      if (t < 0.16) return dith ? '#7950f2' : night; // its top fades into the dark
      if (t < 0.34) return dith ? '#b197fc' : '#9775fa';
      if (t < 0.86) return ray > 0.02 && dith ? '#8ce99a' : '#51cf66';
      return '#c3fae8';
    };
  }

  if (mk === 'mint') {
    // a peppermint: a red and white swirl, glossy, and its tail the twist of the wrapper
    const sx = X(0.48); const R = D * 0.43; const sector = TAU / 8;
    color = (i, j, u, v, k, dith) => {
      if (k === 2) {
        if (u <= 0.8) return (i + j) % 3 === 0 ? '#c92a2a' : '#e03131';
        return (i + Math.floor(j / 2)) % 3 === 0 ? '#ffffff' : i % 2 ? '#a5d8ff' : '#d0ebff'; // crinkly cellophane
      }
      const dx = i + 0.5 - sx; const dy = j + 0.5 - cy; const r = Math.hypot(dx, dy);
      const lit = dx + dy < -R * 0.5; const dim = dx + dy > R * 0.9;
      if (r <= R && r > 1) {
        let th = Math.atan2(dy, dx) - (r / R) * 1.15; th = ((th % TAU) + TAU) % TAU;
        if (Math.floor(th / sector) % 2 === 0) return lit ? '#ff6b6b' : dim ? '#c92a2a' : '#e03131';
        return dim ? '#e9ecef' : '#ffffff';
      }
      if (u > 0.14 && u < 0.36 && Math.abs(v - (0.15 + 2.5 * (u - 0.25) ** 2)) < 0.04) return '#ffffff';
      return v > 0.86 ? '#ced4da' : v > 0.74 && dith ? '#e9ecef' : '#f8f9fa';
    };
  }

  if (mk === 'tree') {
    // a Christmas tree: green all over, gold garlands across it, baubles, and a star on its top fin
    const P = Math.max(6, Math.round(D * 0.3));
    const baubles = new Map();
    let n = 0;
    for (let j = 1; j < h - 2; j += 1) for (let i = X(0.2); i < w - 2; i += 1) {
      if (hash(i * 3, j * 7) < 0.955) continue;
      const ok = [[0, 0], [1, 0], [0, 1], [1, 1]].every(([a, b]) => { const kk = kind[(j + b) * w + i + a]; return (kk === 1 || kk === 2) && kind[(j + b - 1) * w + i + a] && kind[(j + b + 1) * w + i + a] && kind[(j + b) * w + i + a - 1] && kind[(j + b) * w + i + a + 1]; });
      if (!ok || [-2, -1, 0, 1, 2, 3].some((a) => [-2, -1, 0, 1, 2, 3].some((b) => baubles.has((j + b) * w + i + a)))) continue;
      const col = BAUBLES[n % BAUBLES.length]; n += 1;
      baubles.set(j * w + i, '#ffffff'); baubles.set(j * w + i + 1, col); baubles.set((j + 1) * w + i, col); baubles.set((j + 1) * w + i + 1, shade(col, -0.25));
    }
    const garland = (i, j) => ((Math.floor(i * 0.45 + j) % P) + P) % P === 0;
    color = (i, j, u, v, k, dith) => {
      const bb = baubles.get(j * w + i); if (bb) return bb;
      if (u > 0.18 && garland(i, j)) return dith ? '#ffe066' : '#fab005';
      if (k === 2) return (i + Math.round(j * 0.5)) % 3 === 0 && u < 0.84 ? '#237032' : u > 0.84 && i % 2 ? '#237032' : '#2f9e44';
      return v < 0.2 ? '#40c057' : v > 0.8 ? '#237032' : v > 0.7 && dith ? '#2b8a3e' : '#2f9e44';
    };
    // the star: on the tip of the top fin
    let tx = X(0.7); let ty = Infinity;
    for (let i = X(0.45); i < X(0.86); i += 1) for (let j = 0; j < h; j += 1) if (kind[j * w + i] === 2 && j + 0.5 < cy) { if (j < ty) { ty = j; tx = i; } break; }
    const pal = { Y: '#fcc419', L: '#ffe066', W: '#fff9db', D: '#f08c00' };
    if (big) stamp(tx - 3, ty - 5, ['...L...', '..LYY..', 'LLLWYYD', '.LYYYD.', '..YYD..', '.YD.YD.', '.D...D.'], pal, '#b35300', true);
    else stamp(tx - 2, ty - 3, ['..L..', '.LWY.', 'LYYYD', '.YYD.', '.D.D.'], pal, '#b35300', true);
  }

  return { deco, color, after };
}

// ---------- bait pictures ----------
// 6 x 6 grids, drawn Z times bigger with a light top edge and a shaded bottom edge.
const BAITS = {
  worm: [['......', '.RR...', 'R..R..', '...R.R', '....RR', '......'], { R: '#f06595' }],
  jig: [['..KK..', '.KYYK.', '.KYYK.', '..KYYY', '..YYYY', '...Y.Y'], { K: INK, Y: '#fab005' }],
  spoon: [['..K...', '.KSK..', 'KSWSK.', 'KSSSK.', '.KSK..', '..KR..'], { K: INK, S: '#ced4da', W: '#ffffff', R: '#f06595' }],
  bread: [['......', '.KKKK.', 'KWWWTK', 'KWWTTK', '.KKKK.', '......'], { K: INK, W: '#fff9db', T: '#e9b872' }],
  feather: [['..KK..', '.KRRK.', '.KRRK.', '..KGGG', '..BBGG', '...B.B'], { K: INK, R: '#c92a2a', G: '#2f9e44', B: '#1c7ed6' }],
  spinner: [['..K...', '.KGK..', 'KGWGK.', 'KGGGK.', '.KGK..', '..KR..'], { K: INK, G: '#fcc419', W: '#ffffff', R: '#e03131' }],
  shrimp: [['.....K', '..OOO.', '.OPPO.', 'OPPO..', 'OO.O..', '.O....'], { K: INK, O: '#ff8787', P: '#ffc9c9' }],
  squid: [['..KK..', '.KWWK.', '.KWWK.', '.KWWK.', '.W.W.W', 'W.W.W.'], { K: INK, W: '#f1f3f5' }],
  grub: [['......', '.WWWW.', 'WTWTWK', 'WWWWWK', '.WWWW.', '......'], { K: INK, W: '#fff3bf', T: '#e9b872' }],
  goo: [['......', '.GG...', 'G..G..', '...G.G', '....GG', '......'], { G: '#69db7c' }],
  robot: [['..RR..', '.KSSK.', '.KSSK.', '..KSSS', '..SSSS', '...S.S'], { K: INK, S: '#adb5bd', R: '#ff6b6b' }],
  satellite: [['BB.BB.', 'BBKBB.', '..S...', '.SWS..', '.SSS..', '..R...'], { K: INK, B: '#4dabf7', S: '#ced4da', W: '#ffffff', R: '#ff6b6b' }],
  ember: [['......', '.OO...', 'O..Y..', '...O.O', '....OY', '......'], { O: '#ff6b1a', Y: '#ffd43b' }],
  obsidian: [['..KK..', '.KPPK.', '.KPPK.', '..KPPP', '..PPPP', '...P.P'], { K: INK, P: '#7048e8' }],
  gold: [['..K...', '.KGK..', 'KGWGK.', 'KGGGK.', '.KGK..', '..KR..'], { K: INK, G: '#fab005', W: '#fff3bf', R: '#e03131' }],
  gummy: [['......', '.RO...', 'Y..G..', '...B.P', '....PP', '......'], { R: '#ff6b6b', O: '#ff922b', Y: '#ffd43b', G: '#51cf66', B: '#4dabf7', P: '#cc5de8' }],
  corn: [['..KK..', '.KWWK.', '.KOOK.', '..KOOO', '..YYYY', '...Y.Y'], { K: INK, W: '#ffffff', O: '#ff922b', Y: '#fcc419' }],
  lolly: [['.KKK..', 'KPWPK.', 'KWPWK.', 'KPWPK.', '.KKK..', '..W...'], { K: INK, P: '#f06595', W: '#ffffff' }],
  stardust: [['......', '.YY...', 'Y..W..', '...Y.Y', '....WY', '......'], { Y: '#ffe066', W: '#ffffff' }],
  moonjig: [['..KK..', '.KSSK.', '.KSWK.', '..KSSS', '..SSSS', '...S.S'], { K: INK, S: '#e9ecef', W: '#adb5bd' }],
  star: [['..Y...', '.YYY..', 'YYWYY.', '.YYY..', '.Y.Y..', '..R...'], { Y: '#fcc419', W: '#ffffff', R: '#e03131' }],
};
export const BAIT_ART = Object.keys(BAITS);

/** A bait picture, 6 game pixels square. */
export function baitArt(id, Z = 1) {
  const [rows, col] = BAITS[id] || BAITS.worm;
  const n = 6 * Z; const c = canvas(n, n); const x = c.getContext('2d');
  const cell = (i, j) => (i < 0 || j < 0 || i >= 6 || j >= 6 ? '.' : rows[j][i]);
  for (let j = 0; j < 6; j += 1) for (let i = 0; i < 6; i += 1) {
    const ch = cell(i, j); if (ch === '.') continue;
    const base = col[ch];
    for (let b = 0; b < Z; b += 1) for (let a = 0; a < Z; a += 1) {
      let k = base;
      if (Z > 1 && base !== INK) {
        if (b === 0 && cell(i, j - 1) === '.') k = shade(base, 0.35);
        else if (b === Z - 1 && cell(i, j + 1) === '.') k = shade(base, -0.25);
        else if (a === Z - 1 && cell(i + 1, j) === '.') k = shade(base, -0.12);
      }
      // round off outside corners
      if (Z > 1 && ((a === 0 && b === 0 && cell(i - 1, j) === '.' && cell(i, j - 1) === '.') || (a === Z - 1 && b === Z - 1 && cell(i + 1, j) === '.' && cell(i, j + 1) === '.'))) continue;
      x.fillStyle = k; x.fillRect(i * Z + a, j * Z + b, 1, 1);
    }
  }
  return c;
}
