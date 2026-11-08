// Fish and bait pictures for the fishing game (js/fishing.js).
//
// Pictures are drawn at Z fine pixels for every game pixel (Z = 2 in the
// game), so fish have shading, scales, gills and fin rays while the buddies
// keep their chunkier pixels. A fish faces left: the nose is at the left end,
// one game pixel in from the edge.
//
// look: { depth (body height / length), back, side, belly, fin, eye?, bar?,
//   mark?, shape?, tail?, snout?, flat?, spiny?, mouth?, fangs?, eyes3? }
// shape: 'fish' (default), 'eel', 'shark', 'angel', 'puffer', 'sword'
// tail: 'fork' (default), 'fan', 'shark'
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

/** A fish picture, nose on the left. Returns a canvas. */
export function fishPic(look, len, Z = 1) {
  const shape = look.shape || (look.mark === 'puff' ? 'puffer' : look.mark === 'sword' ? 'sword' : 'fish');
  const tail = look.tail || (shape === 'shark' ? 'shark' : shape === 'angel' || shape === 'puffer' ? 'fan' : shape === 'eel' ? 'none' : 'fork');
  const L = Math.max(6, Math.round(len * Z));
  const D = Math.max(4, Math.round(L * look.depth));
  const pad = Z + 1;
  const bill = shape === 'sword' ? Math.round(L * 0.24) : 0;
  const finUp = shape === 'angel' ? 0.66 : shape === 'shark' || shape === 'sword' ? 0.7 : shape === 'eel' ? 0.3 : 0.32;
  const finDown = shape === 'angel' ? 0.66 : shape === 'shark' ? 0.5 : shape === 'eel' ? 0.3 : 0.22;
  const head = look.mark === 'horn' ? D * 0.7 : look.mark === 'crown' ? D * 0.4 + 2 * Z : 0;
  const up = Math.round(Math.max(D * finUp, head, tail === 'shark' ? D * 0.5 : 0)) + pad;
  const down = Math.round(D * Math.max(finDown, look.mark === 'whiskers' ? 0.45 : 0)) + pad;
  const w = L + bill + 2 * pad; const h = up + D + down;
  const x0 = pad + bill; // where the body starts (the nose)
  const cy = up + D / 2;
  const c = canvas(w, h); const x = c.getContext('2d');
  const tailAt = shape === 'shark' ? 0.74 : shape === 'angel' || shape === 'puffer' ? 0.84 : tail === 'fan' ? 0.82 : 0.8;
  const neck = D * (shape === 'shark' ? 0.12 : 0.17);
  const front = shape === 'shark' || shape === 'sword' ? 0.42 : look.snout ? 0.55 : look.depth > 0.5 ? 0.45 : 0.35;

  // half heights of the body above and below the middle line at u (0 nose - 1 tail tip), or null
  const bodyAt = (u) => {
    if (u < 0 || u > 1) return null;
    if (shape === 'eel') {
      const k = u < 0.08 ? Math.sqrt(u / 0.08) : u < 0.7 ? 1 : 1 - 0.85 * ((u - 0.7) / 0.3);
      return [D / 2 * k, D / 2 * k];
    }
    if (u > tailAt) return null;
    const k = u / tailAt;
    let half;
    if (k < front) {
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
      if (shape === 'eel') return u > 0.28 && u < 0.98 ? D * 0.22 * Math.min(1, (u - 0.28) / 0.1) : 0;
      if (shape === 'shark') return tri(0.3, 0.5, D * 0.65, 0.25) + tri(0.6, 0.68, D * 0.22, 0.3);
      if (shape === 'sword') return tri(0.18, 0.36, D * 0.7, 0.3);
      if (shape === 'angel') return u > 0.26 && u < 0.84 ? D * 0.62 * Math.min(((u - 0.26) / 0.48) ** 0.8, (0.84 - u) / 0.1) : 0;
      if (shape === 'puffer') return tri(0.6, 0.72, D * 0.16, 0.4);
      const H = D * 0.24;
      if (look.spiny) return u > 0.3 && u < 0.66 ? (u < 0.46 ? H * 1.15 * (0.75 + 0.25 * Math.sin(u * 70)) : H * 0.9 * (1 - (u - 0.46) / 0.2)) : 0;
      return tri(0.36, 0.66, H, 0.05);
    }
    if (shape === 'eel') return u > 0.5 && u < 0.98 ? D * 0.2 * Math.min(1, (u - 0.5) / 0.1) : 0;
    if (shape === 'shark') return tri(0.24, 0.36, D * 0.5, 0.15) + tri(0.62, 0.68, D * 0.18, 0.3);
    if (shape === 'sword') return tri(0.25, 0.32, D * 0.35, 0.2);
    if (shape === 'angel') return u > 0.32 && u < 0.84 ? D * 0.62 * Math.min(((u - 0.32) / 0.42) ** 0.8, (0.84 - u) / 0.1) : 0;
    if (shape === 'puffer') return tri(0.6, 0.7, D * 0.14, 0.4);
    return tri(0.58, 0.72, D * 0.15, 0.2);
  };

  // what each pixel is: 0 nothing, 1 body, 2 fin
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
      const edge = !at(i - 1, j) || !at(i + 1, j) || !at(i, j - 1) || !at(i, j + 1);
      if (edge) { px(i, j, INK); continue; }
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
  const top = (u) => { const b = bodyAt(u); return b ? cy - b[0] : cy; };
  const bot = (u) => { const b = bodyAt(u); return b ? cy + b[1] : cy; };
  const X = (u) => Math.round(x0 + L * u);

  // the pectoral fin, just behind the gills
  if (fine && shape !== 'eel' && shape !== 'puffer') {
    const fx = X(shape === 'shark' ? 0.24 : 0.24); const fy = Math.round(cy + D * 0.12);
    const n = Math.max(3, Math.round(L * 0.09));
    for (let k = 0; k < n; k += 1) for (let d = 0; d <= Math.round((1 - k / n) * D * 0.13); d += 1) px(fx + k, fy + d, k === n - 1 || d === Math.round((1 - k / n) * D * 0.13) ? finDark : look.fin);
  }
  // gills
  if (fine) {
    if (shape === 'shark') {
      for (const g of [0.19, 0.215, 0.24]) for (let j = Math.round(cy - D * 0.14); j <= Math.round(cy + D * 0.14); j += 1) px(X(g), j, shade(look.side, -0.3));
    } else if (shape !== 'eel') {
      const gx = x0 + L * (look.snout ? 0.2 : shape === 'angel' ? 0.24 : 0.2);
      for (let j = Math.round(top(0.2) + 2); j < Math.round(bot(0.2) - 1); j += 1) {
        const v = (j - top(0.2)) / Math.max(1, bot(0.2) - top(0.2));
        px(Math.round(gx + Math.sin(Math.PI * v) * Z * 1.5), j, shade(look.side, -0.32));
      }
    }
  }
  // the eye
  const eu = shape === 'eel' ? 0.06 : shape === 'shark' ? 0.1 : shape === 'sword' ? 0.08 : look.snout ? 0.15 : shape === 'angel' ? 0.14 : 0.11;
  const ex = X(eu); const ey = Math.round(cy - D * (shape === 'eel' ? 0.1 : 0.18));
  const eyeR = fine ? (L > 36 ? 2 : 1) : 0;
  const eye = (cx, cyy) => {
    if (!fine) { px(cx, cyy, look.eye || '#ffffff'); px(cx + 1, cyy, INK); return; }
    for (let a = -eyeR; a <= eyeR; a += 1) for (let bb = -eyeR; bb <= eyeR; bb += 1) if (a * a + bb * bb <= eyeR * eyeR + 1) px(cx + a, cyy + bb, look.eye || '#ffffff');
    px(cx - 1, cyy, INK); px(cx, cyy, INK); if (eyeR > 1) { px(cx - 1, cyy + 1, INK); px(cx, cyy + 1, INK); }
    px(cx - 1, cyy - 1 + (eyeR > 1 ? 0 : 0), '#ffffff');
  };
  eye(ex, ey);
  if (look.eyes3) { eye(ex + 3 * Z, ey - Z - 1); eye(ex + 3 * Z, ey + 2 * Z); }
  // the mouth
  const my = Math.round(cy + D * (look.mouth === 'big' ? 0.12 : shape === 'shark' ? 0.14 : 0.06));
  const ml = Math.max(Z, Math.round(L * (look.mouth === 'big' ? 0.1 : look.snout || shape === 'eel' ? 0.08 : 0.05)));
  if (shape !== 'sword') for (let k = 0; k < ml; k += 1) px(x0 + k + (shape === 'shark' ? Z : 0), my + (look.mouth === 'big' && k > ml * 0.6 ? -1 : 0), INK);
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
  return c;
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
