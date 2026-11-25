// The kid's garden as it stands in the village: the Forest Village's vegetable garden (gardenB in
// meadowart.js, a raised bed with a rail fence in front), beside the kid's house on every map
// (plot in villagemaps.js). Tapping it walks the buddy up to its fence and into the garden scene
// (garden.js). On the maps where the garden scene has a dome over it (SHIELDS in gardenart.js)
// the village garden gets one too: domeB, drawn over it on the village's land.

import { PB, propB, groundShadow } from './meadowart.js';
import { inEll, grid, h2 } from './pixelkit.js';

/** The garden's bed, in village pixels (its rail fence stands 17 more below it). */
export const PLOT = { w: 56, h: 33, fence: 17 };

/** Where the buddy stands to go in: in front of the middle of the fence. */
export function plotGate(p) {
  return { x: Math.round(p.x + p.w / 2), y: p.y + p.h + p.fence + 5 };
}

// glass and frame for each kind of dome: a bubble of air under the sea, a steel-ribbed dome on the
// moon and in the galaxy, amber heat glass on copper on the volcano
const DOMES = {
  bubble: { frame: null, glass: 'rgba(200,240,255,0.16)', rim: ['#e8fbff', '#a8dcf0', '#6ab0d0'], shine: 'rgba(255,255,255,0.8)' },
  steel: { frame: ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde'], glass: 'rgba(190,240,255,0.2)', rim: ['#e2ddde', '#c0bcc8', '#9894aa'], shine: 'rgba(255,255,255,0.75)' },
  heat: { frame: ['#5a2a24', '#8a4a2a', '#b86a3a', '#d8904a', '#f0b870'], glass: 'rgba(255,190,120,0.18)', rim: ['#ffe0b0', '#f0b870', '#c07a3a'], shine: 'rgba(255,250,230,0.8)' },
};

/** Which dome a map's village garden gets (from the garden scene's SHIELDS kind). */
export const domeKind = (mapId, shield) => (!shield ? null : shield === 'heat' ? 'heat' : mapId === 'bg-ocean' ? 'bubble' : 'steel');

/**
 * A glass dome over the village garden p ({ x, y, w, h, fence }), in style B: a base ring round
 * the garden, ribs (steel and heat), a soft rim and a shine on the glass. px: the land's painter.
 */
export function domeB(px, p, kind = 'steel') {
  const D = DOMES[kind] || DOMES.steel;
  const W = p.w + 16; const H = p.h + p.fence + 18; // the whole dome's box
  const X = p.x - 8; const Y = p.y - 16;
  const cx = W / 2; const base = H - 3; const rx = W / 2 - 0.5; const ry = H - 4;
  groundShadow(px, X + cx, Y + base + 1, rx + 1, 2.6, 0.2);
  propB(px, X, Y, W, H, (b) => {
    // the ring it stands on (a bubble just touches the sand)
    if (D.frame) {
      for (let x = 0; x < W; x += 1) {
        b.set(x, base, D.frame[4], 'frame'); b.set(x, base + 1, x % 6 === 2 ? D.frame[1] : D.frame[2], 'frame'); b.set(x, base + 2, D.frame[1], 'frame');
      }
    }
    // a squarish dome (a superellipse), so its shoulders clear the garden's back corners
    const N = 3.2;
    const inDome = (x, y, ax, ay) => Math.abs((x + 0.5 - cx) / ax) ** N + Math.abs((y + 0.5 - base) / ay) ** N <= 1;
    for (let y = 0; y < base; y += 1) {
      for (let x = 0; x < W; x += 1) {
        if (!inDome(x, y, rx, ry)) continue;
        const edge = !inDome(x, y, rx - 1.3, ry - 1.3);
        const inner = !inDome(x, y, rx - 2.4, ry - 2.4);
        // the ribs: up the middle and two more, and one band round the dome
        const t = (x + 0.5 - cx) / rx;
        const reach = (1 - Math.abs((y + 0.5 - base) / ry) ** N) ** (1 / N);
        const rib = D.frame && (Math.abs(t) < 0.03 || Math.abs(Math.abs(t) - 0.55 * reach) < 0.035 || Math.abs(y + 0.5 - base * 0.4) < 0.5);
        if (edge) b.set(x, y, y < base * 0.35 ? D.rim[0] : y < base * 0.7 ? D.rim[1] : D.rim[2], 'rim');
        else if (rib) b.set(x, y, y < base * 0.4 ? D.frame[3] : D.frame[2], 'frame');
        else if (inner && x < cx) b.set(x, y, 'rgba(255,255,255,0.28)', 'air');
        else if (inEll(x, y, cx - rx * 0.55, base * 0.22, rx * 0.16, ry * 0.08) || inEll(x, y, cx - rx * 0.8, base * 0.5, 1.4, ry * 0.12)) b.set(x, y, D.shine, 'shine');
        else b.set(x, y, D.glass, 'air');
      }
    }
    // a few bubbles rising off the sea dome
    if (kind === 'bubble') [[W - 6, 6, 1.6], [W - 2, -2, 1.1], [W - 8, -6, 0.8]].forEach(([bx, by, r]) => {
      for (let y = Math.floor(by - r - 1); y <= by + r + 1; y += 1) for (let x = Math.floor(bx - r - 1); x <= bx + r + 1; x += 1) {
        if (inEll(x, y, bx, by, r + 0.6, r + 0.6)) b.set(x, y, inEll(x, y, bx, by, r - 0.4, r - 0.4) ? 'rgba(220,245,255,0.35)' : D.rim[1], 'rim');
      }
    });
  }, { pad: 10, outline: (t) => (t === 'frame' ? PB.ink : t === 'rim' ? (kind === 'bubble' ? null : D.frame?.[0] || null) : null) });
}

// ---------- each map's own garden ----------
// The Forest Village keeps its vegetable garden (gardenB). The other maps get the same raised
// bed and fence in front, made of what that map is made of, growing what would grow there.

const RAMP = {
  wood: PB.wood.slice(0, 5), stone: ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8', '#e2ddde'],
  drift: ['#4a3a3e', '#6e5a56', '#93806e', '#b8a690', '#d8ccb4'], log: ['#3a2a2e', '#5a4038', '#7a5a48', '#9a7a5e', '#bea07e'],
  steel: ['#3a3450', '#5a6080', '#8090b0', '#aec0d8', '#dce8f4'], bamboo: ['#5a5a1e', '#86862a', '#b0a83a', '#d4c860', '#ece49a'],
  brass: ['#6a4a1a', '#9a6a1a', '#d89a2a', '#f0c040', '#ffe27a'], lava: ['#2a1e26', '#3e2a30', '#5a3a3a', '#7a4e44', '#9a6a52'],
  candy: ['#a01e3a', '#e03a5a', '#ff8fa8', '#fff0f4', '#ffffff'], coral: ['#7a3a4a', '#c0506a', '#f07a90', '#ffb0c0', '#ffe0e8'],
};
const SOILS = {
  dirt: ['#5a3438', '#7a4a3e', '#94603e', '#aa7450', '#c48c60'], sand: ['#8a6a4e', '#a8845e', '#c4a072', '#dcbc8a', '#ecd4a4'],
  ash: ['#1e1620', '#2e2228', '#40302e', '#564036', '#6e5240'], choc: ['#3a1e1e', '#5a2e26', '#7a4030', '#9a5a3a', '#b8764a'],
  moon: ['#1e1838', '#2e2650', '#40366a', '#564a86', '#7060a4'], peat: ['#2a1e22', '#3e2a2a', '#543a32', '#6a4c3c', '#82604a'],
  sea: ['#3a2e3e', '#544050', '#6e5660', '#8a6e70', '#a88a84'],
};
const THEMES = {
  'bg-sunset': { bed: 'drift', rim: 'plank', soil: 'sand', crops: ['pineapple', 'melon', 'pineapple', 'melon'], fence: 'rope', fwood: 'drift', deco: 'shells' },
  'bg-ocean': { bed: 'coral', rim: 'shell', soil: 'sea', crops: ['kelp', 'lettuce', 'kelp'], fence: 'rope', fwood: 'drift', deco: 'shells' },
  'bg-space': { bed: 'steel', rim: 'panel', soil: 'moon', crops: ['lettuce', 'tomato', 'cabbage'], fence: 'steel', fwood: 'steel' },
  'bg-castle': { bed: 'stone', rim: 'stone', soil: 'dirt', crops: ['cabbage', 'carrot', 'pumpkin'], fence: 'wattle', fwood: 'wood' },
  'bg-volcano': { bed: 'lava', rim: 'stone', soil: 'ash', crops: ['pepper', 'pineapple', 'pepper'], fence: 'bamboo', fwood: 'bamboo', deco: 'embers' },
  'bg-rainforest': { bed: 'bamboo', rim: 'bamboo', soil: 'peat', crops: ['banana', 'pepper', 'pineapple'], fence: 'bamboo', fwood: 'bamboo' },
  'bg-rainbow': { bed: 'candy', rim: 'stripe', soil: 'choc', crops: ['gumdrop', 'lollipop', 'gumdrop'], fence: 'candy', fwood: 'candy', deco: 'sprinkles' },
  'bg-galaxy': { bed: 'brass', rim: 'gem', soil: 'moon', crops: ['star', 'moonleaf', 'crystal'], fence: 'brass', fwood: 'brass', deco: 'sparkles' },
  'bg-fjord': { bed: 'log', rim: 'log', soil: 'peat', crops: ['cabbage', 'carrot', 'lettuce'], fence: 'rail', fwood: 'log' },
};
const TAG = { wood: 'wood', drift: 'wood', log: 'wood', bamboo: 'wood', stone: 'stone', lava: 'stone', steel: 'metal', brass: 'gold', candy: 'red', coral: 'pot' };

/** One crop at (x, y), its foot on the ridge (put is the bed's pixel setter). Returns its width. */
function crop(put, kind, x, ry, i) {
  const L4 = PB.leaf[4]; const L3 = PB.leaf[3]; const L2 = PB.leaf[2];
  const g = (rows, pal) => grid(put, x, ry - rows.length + 1, rows, pal);
  switch (kind) {
    case 'carrot': g(['l.l', '.L.', 'lLl', '.o.'], { l: L4, L: L3, o: '#f08c3a' }); return 5;
    case 'lettuce': g(['.lll.', 'lLlLl', 'LLLLd', '.ddd.'], { l: '#c8ec8c', L: L4, d: L3 }); return 8;
    case 'cabbage': g(['.lLl.', 'lCCCL', 'CCcCd', '.ddd.'], { l: '#b8e0c8', L: '#8cc4a8', C: '#6aa890', c: '#a8dcc0', d: '#4a8070' }); return 8;
    case 'pumpkin': g(['..s....', '.oOo.lL', 'oOooo..', 'ooood..', '.ddd...'], { s: L2, o: '#f08c3a', O: '#ffc47a', d: '#c0581e', l: L4, L: L2 }); return 9;
    case 'tomato': g(['.L.L.', 'lrLrl', '.LrL.', 'rRL.r', '.L.L.'], { l: L4, L: L3, r: '#e03131', R: '#ff8787' }); return 7;
    case 'pepper': g(['l.L.l', '.lLl.', 'r.L.r', 'R.r.R', 'r...r'].map((row) => row), { l: L4, L: L3, r: '#d02a2a', R: '#ff6a5a' }); return 7;
    case 'pineapple': g(['l.L.l', '.lLl.', '..L..', '.oOo.', 'oOoOo', 'ooooo', '.ddd.'], { l: L4, L: L3, o: '#d89a2a', O: '#f8d060', d: '#9a6a1a' }); return 8;
    case 'melon': g(['..lL....', '.gGgGg..', 'gGgGgGg.', 'gggGggd.', '.ddddd..'], { l: L4, L: L2, g: '#3a8a3a', G: '#8ad070', d: '#246a2e' }); return 10;
    case 'banana': g(['L....L', '.L..L.', '..LL..', '.lLLl.', '.yyL..', 'yYyL..', '..L...'], { l: L4, L: L3, y: '#f0c040', Y: '#fff0a0' }); return 8;
    case 'kelp': g(['.k..', 'k.K.', '.k.k', 'K.k.', '.kK.', '..k.'], { k: '#3e9a5a', K: '#8ad08a' }); return 5;
    case 'gumdrop': { const c = [['#e03a5a', '#ff9ab0'], ['#3ab0e0', '#a8e4ff'], ['#f0c040', '#fff0a0'], ['#5ac05a', '#b8f0a0'], ['#a060e0', '#d8b8ff']][i % 5]; g(['..l..', '.pPp.', 'pPwpp', 'ppppd', '.ddd.'], { l: L4, p: c[0], P: c[1], w: '#ffffff', d: mixDark(c[0]) }); return 7; }
    case 'lollipop': { const c = ['#ff5a8a', '#5ab0ff', '#ffb03a'][i % 3]; g(['.cCc.', 'cCwCc', 'cwCwc', '.cCc.', '..s..', '.ls..', '..s..'], { c, C: '#ffffff', w: mixDark(c), s: '#f8f0e0', l: L4 }); return 8; }
    case 'star': g(['..y..', '.yYy.', 'yYwYy', '.y.y.', '..L..', '.lL..'], { y: '#f0c040', Y: '#ffe27a', w: '#ffffff', l: L4, L: L3 }); return 7;
    case 'moonleaf': g(['.lLl.', 'lCCCL', 'CCcCd', '.ddd.'], { l: '#e0d0ff', L: '#b8a0f0', C: '#9078d8', c: '#d8c8ff', d: '#6a50b0' }); return 8;
    case 'crystal': g(['..c..', '.cCc.', '.cwc.', '.cCc.', '..L..', '.lLl.'], { c: '#5ad0e8', C: '#b8f4ff', w: '#ffffff', l: L4, L: L3 }); return 6;
    default: return 8;
  }
}
const mixDark = (c) => { const n = parseInt(c.slice(1), 16); const f = (v) => Math.round(v * 0.62).toString(16).padStart(2, '0'); return `#${f(n >> 16)}${f((n >> 8) & 255)}${f(n & 255)}`; };

/** The raised bed: its rim (in the map's material), its furrowed soil and the crops. */
function bedB(px, X, Y, w, h, T, seed) {
  const R = RAMP[T.bed]; const S = SOILS[T.soil]; const tag = TAG[T.bed];
  groundShadow(px, X + w / 2 + 2, Y + h, w / 2 + 2, 2.5, 0.18);
  propB(px, X, Y, w, h, (b) => {
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const rim = x < 2 || x >= w - 2 || y < 2;
        const front = y >= h - 4;
        if (front || rim) {
          let c;
          const fy = y - (h - 4);
          if (T.rim === 'stone') { // blocks of stone with mortar lines
            const bx = Math.floor((x + (front && fy >= 2 ? 3 : 0)) / 6);
            c = (front && fy === 1) || (!front && y === 1) || (x + (front && fy >= 2 ? 3 : 0)) % 6 === 5 ? R[1] : h2(bx, fy >= 2 ? 2 : 1, seed) < 0.4 ? R[2] : R[3];
            if (y === 0 || (front && fy === 0)) c = R[4];
          } else if (T.rim === 'stripe') { // a candy stripe
            c = ((x + y) >> 1) % 2 ? R[1] : R[4];
            if (y === 0 || (front && fy === 0)) c = ((x >> 1) % 2) ? R[2] : R[4];
          } else if (T.rim === 'panel') { // steel panels with rivets
            c = x % 12 === 11 ? R[1] : front && fy === 2 && x % 6 === 3 ? R[4] : R[2];
            if (y === 0 || (front && fy === 0)) c = R[4];
            if (front && fy === 3) c = R[1];
          } else if (T.rim === 'bamboo' || T.rim === 'log') { // round poles with nodes or log ends
            c = (front ? fy : y) % 2 === 0 ? R[3] : R[2];
            if (x % (T.rim === 'bamboo' ? 9 : 14) === 0) c = R[1];
            if (y === 0 || (front && fy === 0)) c = R[4];
          } else if (T.rim === 'gem') { // polished brass with little gems
            c = y === 0 || (front && fy === 0) ? R[4] : front && fy === 3 ? R[1] : R[3];
            if (front && fy === 2 && x % 8 === 4) c = ['#ff6ab0', '#5ad0ff', '#b08aff'][(x >> 3) % 3];
          } else if (T.rim === 'shell') { // a coral-pink stone rim with shells set in it
            c = y === 0 || (front && fy === 0) ? R[4] : front && fy === 3 ? R[1] : R[2];
            if (front && fy >= 1 && fy <= 2 && x % 9 >= 3 && x % 9 <= 5) c = fy === 1 ? '#fff4e8' : '#f0d0b8';
          } else { // planks
            c = front ? (fy === 0 ? R[4] : x % 16 === 15 ? R[1] : fy === 3 ? R[2] : R[3]) : (y === 0 || x === 0 ? R[4] : x === w - 1 ? R[2] : R[3]);
          }
          b.set(x, y, c, tag);
        } else {
          const r = (y - 2) % 9;
          let c = r < 2 ? S[3] : r < 5 ? S[2] : r < 7 ? S[1] : S[0];
          if (r === 0 && h2(x, y, seed) < 0.3) c = S[4];
          b.set(x, y, c, 'dirt');
        }
      }
    }
  }, {
    after: (b) => {
      const put = (x, y, c) => b.set(x, y, c, 'leaf');
      const rows = Math.floor((h - 6) / 9);
      for (let r = 0; r < rows; r += 1) {
        const ry = 2 + r * 9 + 4;
        const kind = T.crops[r % T.crops.length];
        let i = 0;
        for (let x = 4; x < w - 8;) { const jx = x + (h2(x, r, seed) < 0.5 ? 0 : 1); x += crop(put, kind, jx, ry, i + r); i += 1; }
      }
      // a little touch of the map on the bed
      if (T.deco === 'sparkles' || T.deco === 'sprinkles') {
        const cols = T.deco === 'sparkles' ? ['#ffffff', '#ffe27a', '#b8f4ff'] : ['#ff5a8a', '#5ab0ff', '#ffd23f', '#7ad07a'];
        for (let k = 0; k < 9; k += 1) { const x = 3 + Math.floor(h2(k, 3, seed) * (w - 6)); const y = 3 + Math.floor(h2(k, 5, seed) * (h - 9)); if (b.tag(x, y) === 'dirt') b.set(x, y, cols[k % cols.length], 'dirt'); }
      }
      if (T.deco === 'embers') for (let k = 0; k < 6; k += 1) { const x = 3 + Math.floor(h2(k, 9, seed) * (w - 6)); const y = 3 + Math.floor(h2(k, 11, seed) * (h - 9)); if (b.tag(x, y) === 'dirt') b.set(x, y, k % 2 ? '#ff8a3a' : '#ffc46a', 'dirt'); }
      if (T.deco === 'shells') { grid((x, y, c) => b.set(x, y, c, 'white'), 3, h - 7, ['.w.', 'wpw'], { w: '#fff4e8', p: '#f0a8b8' }); }
      // the watering can, as in the Forest Village
      grid((x, y, c) => b.set(x, y, c, 'metal'), w - 13, h - 10, ['.mmm....', 'mMMMm..m', 'mMllm.m.', 'mMMMmm..', 'mdddm...', '.ddd....'], { m: '#5a6a8a', M: '#8aa0c0', l: '#c0d4e8', d: '#4a5878' });
    },
  });
}

/** The fence along the front, w wide and 15 tall from (X, Y), in the map's own kind. */
function fenceB(px, X, Y, w, T, seed) {
  const R = RAMP[T.fwood]; const tag = TAG[T.fwood];
  for (let x = 1; x < w; x += 1) px(X + x, Y + 14, 'rgba(59,34,53,0.16)');
  propB(px, X, Y, w, 15, (b) => {
    const kind = T.fence;
    const posts = (gap) => { const out = []; for (let x = 0; x < w - 3; x += gap) out.push(x); out.push(w - 3); return out; };
    const sag = (a, c, x, k) => Math.round(Math.sin(((x - a) / (c - a + 3)) * Math.PI) * k);
    if (kind === 'candy') {
      // candy canes for posts, a ribbon swag between them
      const ps = posts(12);
      for (let i = 1; i < ps.length; i += 1) for (let x = ps[i - 1] + 2; x < ps[i] + 1; x += 1) { const y = 6 + sag(ps[i - 1], ps[i], x, 2); b.set(x, y, '#ff8fc0', 'red'); b.set(x, y + 1, '#d0508a', 'red'); }
      ps.forEach((x0) => {
        for (let y = 3; y < 15; y += 1) for (let dx = 0; dx < 2; dx += 1) b.set(x0 + dx, y, ((y + dx) >> 1) % 2 ? R[1] : R[4], (((y + dx) >> 1) % 2) ? 'red' : 'white');
        // the hook over the top
        [[0, 2], [0, 1], [1, 0], [2, 0], [3, 1], [3, 2]].forEach(([dx, dy], k) => b.set(x0 + dx, dy, k % 2 ? R[1] : R[4], k % 2 ? 'red' : 'white'));
      });
    } else if (kind === 'bamboo') {
      for (let x = 0; x < w; x += 3) {
        const top = 1 + Math.floor(h2(x, 1, seed) * 3);
        for (let y = top; y < 15; y += 1) { b.set(x, y, (y - top) % 5 === 4 ? R[1] : R[3], 'wood'); b.set(x + 1, y, (y - top) % 5 === 4 ? R[0] : R[2], 'wood'); }
        b.set(x, top, R[4], 'wood');
      }
      for (const ry of [5, 10]) for (let x = 0; x < w; x += 1) { b.set(x, ry, R[4], 'wood'); b.set(x, ry + 1, R[1], 'wood'); }
      for (let x = 1; x < w; x += 6) { b.set(x, 5, '#8a5a3a', 'wood'); b.set(x, 10, '#8a5a3a', 'wood'); }
    } else if (kind === 'steel') {
      const ps = posts(14);
      for (const ry of [4, 9]) for (let x = 0; x < w; x += 1) { b.set(x, ry, R[4], 'metal'); b.set(x, ry + 1, R[2], 'metal'); }
      ps.forEach((x0) => { for (let y = 1; y < 15; y += 1) { b.set(x0, y, R[3], 'metal'); b.set(x0 + 1, y, R[2], 'metal'); b.set(x0 + 2, y, R[1], 'metal'); } b.set(x0 + 1, 0, '#7af0ff', 'metal'); b.set(x0, 0, '#dcffff', 'metal'); });
    } else if (kind === 'brass') {
      const ps = posts(13);
      for (let i = 1; i < ps.length; i += 1) for (const ry of [5, 10]) for (let x = ps[i - 1] + 3; x < ps[i]; x += 1) { if ((x - ps[i - 1]) % 2) b.set(x, ry + sag(ps[i - 1], ps[i], x, 1.5), R[3], 'gold'); }
      ps.forEach((x0) => {
        for (let y = 4; y < 15; y += 1) { b.set(x0, y, R[4], 'gold'); b.set(x0 + 1, y, R[3], 'gold'); b.set(x0 + 2, y, R[1], 'gold'); }
        grid((x, y, c) => b.set(x, y, c, 'gold'), x0 - 1, 0, ['..y..', '.yYy.', '..y..', '..y..'], { y: '#f0c040', Y: '#fff6c8' });
      });
    } else if (kind === 'rope') {
      const ps = posts(14);
      for (let i = 1; i < ps.length; i += 1) for (const [ry, k] of [[4, 2], [9, 1.5]]) for (let x = ps[i - 1] + 2; x < ps[i] + 1; x += 1) { const y = ry + sag(ps[i - 1], ps[i], x, k); b.set(x, y, (x % 2) ? '#e8c890' : '#c8a060', 'wood'); }
      ps.forEach((x0, i) => { const top = h2(i, 3, seed) < 0.5 ? 1 : 2; for (let y = top; y < 15; y += 1) { b.set(x0, y, R[3], 'wood'); b.set(x0 + 1, y, R[2], 'wood'); b.set(x0 + 2, y, R[1], 'wood'); } b.set(x0, top, R[4], 'wood'); b.set(x0 + 1, top, R[4], 'wood'); });
    } else if (kind === 'wattle') {
      // stakes with withies woven between them
      for (let y = 2; y < 14; y += 1) for (let x = 0; x < w; x += 1) { const over = ((x >> 2) + (y >> 1)) % 2; b.set(x, y, y % 2 ? (over ? R[2] : R[1]) : (over ? R[4] : R[3]), 'wood'); }
      for (let x = 0; x < w; x += 8) for (let y = 0; y < 15; y += 1) { b.set(x, y, R[3], 'wood'); b.set(x + 1, y, R[1], 'wood'); }
    } else { // split rails
      const ps = posts(15);
      for (const ry of [4, 9]) for (let i = 1; i < ps.length; i += 1) for (let x = ps[i - 1]; x < ps[i] + 3; x += 1) { const y = ry + sag(ps[i - 1], ps[i], x, ry === 4 ? 1 : 0.6); b.set(x, y, h2(x, ry, seed) < 0.15 ? R[2] : R[3], tag); b.set(x, y + 1, R[1], tag); }
      ps.forEach((x0, i) => { const top = h2(i, 3, seed) < 0.5 ? 0 : 1; for (let y = top; y < 15; y += 1) { b.set(x0, y, R[3], tag); b.set(x0 + 1, y, R[2], tag); b.set(x0 + 2, y, R[1], tag); } b.set(x0, top, R[4], tag); });
    }
  });
}

/** The kid's garden for a map: the Forest Village's vegetable garden there, the map's own kind elsewhere. */
export function kidGardenB(px, X, Y, w, h, mapId, fallback) {
  const T = THEMES[mapId];
  if (!T) { fallback(px, X, Y, w, h); return; }
  bedB(px, X, Y, w, h, T, 91);
  fenceB(px, X - 2, Y + h + 2, w + 4, T, 52);
}
