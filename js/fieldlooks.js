// How each map looks in the visitor ball games (keepy-uppy, hockey, football), 2026-11-22.
// Before this every map played on the same green field and the same blue rink. Now each map
// brings its own ground (sand at Sunset Beach, moon dust at Moon Base, packed snow in the
// fjord...), its own rink (a frozen village pond, an obsidian rink on Volcano Island...) and
// its own backdrop along the top of the screen (palms and the sea, the castle wall, a smoking
// volcano...). The twists that change how each map plays live in mapplay.js.
//
// Everything paints whole pixels onto a 2D canvas context, the same way the games already do.
import { SPRITES } from './maparts.js';
import { h2, vnoise, cobble, mix } from './pixelkit.js';

const S = SPRITES;
const OUT = S.OUT;

/** Draws a letter-grid sprite with its bottom middle at (cx, by). K is the outline, . is see-through. */
export function sprite(x, grid, pal, cx, by, flip = false) {
  const h = grid.length; const w = grid[0].length;
  const x0 = Math.round(cx - w / 2); const y0 = Math.round(by - h);
  for (let j = 0; j < h; j += 1) {
    for (let i = 0; i < w; i += 1) {
      const ch = grid[j][flip ? w - 1 - i : i];
      if (ch === '.') continue;
      x.fillStyle = ch === 'K' ? OUT : (pal[ch] || OUT);
      x.fillRect(x0 + i, y0 + j, 1, 1);
    }
  }
}

const band = (x, y0, y1, W, top, bottom) => {
  for (let y = y0; y < y1; y += 1) { x.fillStyle = mix(top, bottom, (y - y0) / Math.max(1, y1 - y0 - 1)); x.fillRect(0, y, W, 1); }
};
const disc = (x, cx, cy, r, col, squash = 1) => {
  x.fillStyle = col;
  for (let yy = -r; yy <= r; yy += 1) { const w = Math.round(Math.sqrt(Math.max(0, r * r - yy * yy))); x.fillRect(cx - w, Math.round(cy + yy * squash), w * 2 + 1, 1); }
};
// a skyline of hills: height at column i from value noise
const ridge = (x, W, base, amp, scale, seed, col, hi) => {
  for (let i = 0; i < W; i += 1) {
    const h = Math.round(amp * vnoise(i, 0, scale, seed));
    x.fillStyle = col; x.fillRect(i, base - h, 1, h + 1);
    if (hi) { x.fillStyle = hi; x.fillRect(i, base - h, 1, 1); }
  }
};
const stars = (x, W, h, n, seed, cols = ['#ffffff']) => {
  for (let i = 0; i < n; i += 1) {
    x.fillStyle = cols[i % cols.length];
    x.fillRect(Math.floor(h2(i, 1, seed) * W), Math.floor(h2(i, 2, seed) * (h - 2)), 1, 1);
  }
};
// props along the bottom of the backdrop, spaced out, a little random
const row = (x, W, by, gap, seed, draw) => {
  for (let i = 0, cx = 4 + Math.floor(h2(0, 9, seed) * gap); cx < W + 6; i += 1, cx += Math.round(gap * (0.7 + h2(i, 3, seed) * 0.6))) draw(cx, by, i);
};

// ---------- the looks ----------
/**
 * One look per Places background.
 * ground: [main, second, speck] for keepy-uppy and football; tex: how the ground is textured;
 * line: field lines; end: football end zone [main, speck] (or 'surf' for the sea);
 * rink: { ice, scuff, board, boardHi, rim, line, blue }; back(x, W, h): the backdrop strip.
 * tint: the shadow color under buddies and balls.
 */
export const FIELD_LOOKS = {
  'bg-meadow': {
    edge: '#3c9a3c', // around the field on a tall or wide screen
    name: 'Forest Village',
    ground: ['#4fae47', '#5cbd52', '#3c9a3c'], tex: 'mown', line: '#f1f3f5', end: ['#e03131', '#c92a2a'],
    rink: { ice: '#e7f5ff', scuff: '#d0ebff', board: '#ffffff', boardHi: '#e9ecef', rim: '#adb5bd', soft: true, line: '#fa5252', blue: '#4dabf7', name: 'the village pond' },
    shade: 'rgba(20,50,20,0.3)',
    back(x, W, h) {
      band(x, 0, h, W, '#7cc7ff', '#c5e8ff');
      ridge(x, W, h - 6, 7, 26, 3, '#7bc96f', '#9be08f');
      x.fillStyle = '#8b5a2b'; x.fillRect(0, h - 4, W, 1); // the fence rail
      for (let i = 2; i < W; i += 6) x.fillRect(i, h - 6, 1, 5);
      row(x, W, h - 1, 26, 11, (cx, by, i) => sprite(x, i % 3 === 1 ? S.BUSH : S.TREE, S.TREE_PAL, cx, by));
      for (let i = 0; i < W / 9; i += 1) { x.fillStyle = ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'][i % 4]; x.fillRect(Math.floor(h2(i, 5, 2) * W), h - 2 + (i % 2), 1, 1); }
    },
  },
  'bg-sunset': {
    edge: '#d9a35f', // around the field on a tall or wide screen
    name: 'Sunset Beach',
    ground: ['#f3c98b', '#ecc07e', '#d9a35f'], tex: 'sand', line: '#ffffff', end: 'surf',
    rink: { ice: '#d9b27a', scuff: '#c99d63', board: '#c9a27a', boardHi: '#e9d2b4', rim: '#8d6e63', line: '#ff6b6b', blue: '#1098ad', name: 'the hard wet sand' },
    shade: 'rgba(120,70,20,0.28)',
    back(x, W, h) {
      band(x, 0, h - 8, W, '#ff922b', '#ffd8a8');
      disc(x, Math.round(W * 0.7), h - 9, 6, '#fff3bf');
      x.fillStyle = '#ffd8a8'; x.fillRect(0, h - 9, W, 1);
      band(x, h - 8, h - 3, W, '#3bc9db', '#1098ad');
      for (let i = 0; i < W / 5; i += 1) { x.fillStyle = '#e3fafc'; x.fillRect(Math.floor(h2(i, 4, 7) * W), h - 7 + (i % 4), 2, 1); }
      x.fillStyle = '#fde3b6'; x.fillRect(0, h - 3, W, 3);
      row(x, W, h, 44, 5, (cx, by, i) => sprite(x, S.PALM, S.PALM_PAL, cx, by, i % 2 === 1));
    },
  },
  'bg-ocean': {
    edge: '#1864ab', // around the field on a tall or wide screen
    name: 'Under the Sea',
    ground: ['#e9d29a', '#f0d9a0', '#c9a35d'], tex: 'ripples', line: '#ffffff', end: ['#20c997', '#12b886'],
    rink: { ice: '#c5f6fa', scuff: '#99e9f2', board: '#ff8787', boardHi: '#ffc9c9', rim: '#c92a2a', line: '#f783ac', blue: '#1c7ed6', name: 'a smooth patch of sea floor' },
    shade: 'rgba(10,40,80,0.3)', water: true,
    back(x, W, h) {
      band(x, 0, h, W, '#1864ab', '#4dabf7');
      for (let i = 0; i < 4; i += 1) { x.fillStyle = 'rgba(208,235,255,0.22)'; const lx = Math.round(W * (0.15 + i * 0.24)); for (let y = 0; y < h - 4; y += 1) x.fillRect(lx + Math.round(y * 0.4), y, 3, 1); }
      row(x, W, h, 18, 13, (cx, by, i) => (i % 3 === 0 ? sprite(x, S.CORAL, { c: i % 2 ? '#ff8787' : '#f783ac' }, cx, by) : sprite(x, S.KELP, S.KELP_PAL, cx, by, i % 2 === 1)));
      for (let i = 0; i < W / 12; i += 1) { x.fillStyle = '#d0ebff'; x.fillRect(Math.floor(h2(i, 6, 3) * W), Math.floor(h2(i, 7, 3) * (h - 8)), 1, 1); }
    },
  },
  'bg-space': {
    edge: '#1b1f4b', // around the field on a tall or wide screen
    name: 'Moon Base',
    ground: ['#9a9fc4', '#a5aacf', '#7d82a8'], tex: 'dust', line: '#ffd43b', end: ['#5c5f8a', '#45476b'],
    rink: { ice: '#ced4da', scuff: '#adb5bd', board: '#495057', boardHi: '#ffd43b', rim: '#212529', line: '#ff6b6b', blue: '#3bc9db', name: 'the moon base rink' },
    shade: 'rgba(20,20,50,0.35)', low: true,
    back(x, W, h) {
      band(x, 0, h, W, '#0b1026', '#1b1f4b');
      stars(x, W, h, Math.round(W / 4), 4, ['#ffffff', '#a5aacf', '#ffe066']);
      const ex = Math.round(W * 0.82);
      disc(x, ex, 7, 5, '#1c7ed6'); x.fillStyle = '#51cf66'; x.fillRect(ex - 2, 5, 3, 2); x.fillRect(ex + 1, 8, 2, 2); x.fillStyle = '#ffffff'; x.fillRect(ex - 3, 9, 2, 1);
      ridge(x, W, h - 2, 6, 18, 9, '#6a6f96', '#9a9fc4');
      row(x, W, h - 1, 60, 3, (cx, by, i) => {
        if (i % 2) { sprite(x, S.CRYSTAL, { c: '#99e9f2', C: '#3bc9db' }, cx, by); return; }
        disc(x, cx, by - 3, 6, OUT, 0.7); disc(x, cx, by - 3, 5, '#d0ebff', 0.7);
        x.fillStyle = '#74c0fc'; x.fillRect(cx - 3, by - 6, 2, 1);
        x.fillStyle = '#868e96'; x.fillRect(cx - 7, by - 1, 15, 2);
      });
    },
  },
  'bg-castle': {
    edge: '#6c757d', // around the field on a tall or wide screen
    name: 'Royal Castle',
    ground: ['#b8b2a6', '#c2bcb0', '#8f897e'], tex: 'cobbles', line: '#fff3d6', end: ['#7048e8', '#5f3dc4'],
    rink: { ice: '#f8f9fa', scuff: '#e9ecef', board: '#adb5bd', boardHi: '#dee2e6', rim: '#495057', line: '#e64980', blue: '#7048e8', marble: true, name: 'the marble great hall' },
    shade: 'rgba(40,30,40,0.3)',
    back(x, W, h) {
      band(x, 0, h, W, '#8fb8ff', '#d0e1ff');
      x.fillStyle = '#868e96'; x.fillRect(0, h - 12, W, 12);
      for (let y = h - 12; y < h; y += 1) for (let i = 0; i < W; i += 1) { const c = cobble(i, y, 4); if (c.mortar) { x.fillStyle = '#6c757d'; x.fillRect(i, y, 1, 1); } }
      for (let i = 0; i < W; i += 6) { x.fillStyle = '#868e96'; x.fillRect(i, h - 15, 4, 3); x.fillStyle = OUT; x.fillRect(i, h - 16, 4, 1); }
      x.fillStyle = OUT; x.fillRect(0, h - 12, W, 1);
      row(x, W, h, 70, 8, (cx) => {
        x.fillStyle = OUT; x.fillRect(cx - 6, 5, 13, h - 5);
        x.fillStyle = '#adb5bd'; x.fillRect(cx - 5, 6, 11, h - 6);
        x.fillStyle = '#ced4da'; x.fillRect(cx - 5, 6, 2, h - 6);
        for (let k = 0; k < 7; k += 1) { x.fillStyle = OUT; x.fillRect(cx - k, 5 - (6 - k), k * 2 + 1, 1); x.fillStyle = '#7048e8'; if (k > 0) x.fillRect(cx - k + 1, 5 - (6 - k), k * 2 - 1, 1); }
        x.fillStyle = OUT; x.fillRect(cx - 1, 9, 3, 4);
        x.fillStyle = '#ffd43b'; x.fillRect(cx, 10, 1, 2);
      });
      row(x, W, h - 3, 32, 21, (cx, by, i) => {
        if (i % 2) return;
        x.fillStyle = OUT; x.fillRect(cx - 3, by - 8, 7, 7);
        x.fillStyle = i % 4 ? '#e64980' : '#7048e8'; x.fillRect(cx - 2, by - 7, 5, 5);
        x.fillStyle = '#ffd43b'; x.fillRect(cx, by - 6, 1, 2);
        x.fillStyle = OUT; x.fillRect(cx - 2, by - 2, 1, 1); x.fillRect(cx + 2, by - 2, 1, 1);
      });
    },
  },
  'bg-volcano': {
    edge: '#2b211d', // around the field on a tall or wide screen
    name: 'Volcano Island',
    ground: ['#5b4b45', '#62514f', '#3e3230'], tex: 'ash', line: '#ffd8a8', end: ['#e8590c', '#d9480f'],
    rink: { ice: '#3b2f3f', scuff: '#5a4a5e', board: '#2b211d', boardHi: '#ff6b1a', rim: '#1a1210', line: '#ff922b', blue: '#ffd43b', dark: true, name: 'the black glass rink' },
    shade: 'rgba(0,0,0,0.35)',
    back(x, W, h) {
      band(x, 0, h, W, '#3d1a12', '#a8431f');
      const vx = Math.round(W * 0.6);
      for (let y = 4; y < h; y += 1) { const w = Math.round((y - 4) * 1.6) + 3; x.fillStyle = OUT; x.fillRect(vx - w - 1, y, w * 2 + 3, 1); x.fillStyle = '#4b3d38'; x.fillRect(vx - w, y, w * 2 + 1, 1); x.fillStyle = '#75645c'; x.fillRect(vx - w, y, 2, 1); }
      x.fillStyle = '#ff6b1a'; x.fillRect(vx - 2, 4, 5, 1); x.fillStyle = '#ffd43b'; x.fillRect(vx - 1, 4, 3, 1);
      for (let y = 5; y < h - 4; y += 2) { x.fillStyle = '#ff6b1a'; x.fillRect(vx + Math.round(Math.sin(y) * 1.5), y, 1, 2); }
      for (let i = 0; i < 6; i += 1) disc(x, vx - 3 + i * 2, 2 - (i % 2), 2, i % 2 ? '#868e96' : '#adb5bd');
      row(x, W, h, 40, 6, (cx, by, i) => (i % 2 ? sprite(x, S.BOULDER, { L: '#3d3330', l: '#5b4b45', d: '#2b211d' }, cx, by) : sprite(x, S.PALM, { G: '#2b8a3e', g: '#51cf66', T: '#5c3a1e' }, cx, by)));
    },
  },
  'bg-rainforest': {
    edge: '#1b5e20', // around the field on a tall or wide screen
    name: 'Rainforest',
    ground: ['#2f9e44', '#37a84c', '#237032'], tex: 'leaves', line: '#e6fcf5', end: ['#1c9c8c', '#127a6e'],
    rink: { ice: '#8b6a45', scuff: '#7a5a38', board: '#6e4b2a', boardHi: '#a0612f', rim: '#3a2614', line: '#ffd43b', blue: '#94d82d', mud: true, name: 'a muddy clearing' },
    shade: 'rgba(10,40,10,0.35)',
    back(x, W, h) {
      band(x, 0, h, W, '#1b5e20', '#2b8a3e');
      ridge(x, W, h - 8, 10, 12, 5, '#237032', '#40c057');
      row(x, W, h, 30, 2, (cx, by, i) => sprite(x, S.JUNGLE_TREE, S.JUNGLE_PAL, cx, by + 2, i % 2 === 1));
      for (let i = 0; i < W / 10; i += 1) { x.fillStyle = '#5c940d'; const vx = Math.floor(h2(i, 8, 4) * W); x.fillRect(vx, 0, 1, 3 + Math.floor(h2(i, 9, 4) * 8)); }
      row(x, W, h, 22, 9, (cx, by, i) => sprite(x, i % 2 ? S.FERN : S.FLOWER, i % 2 ? { G: '#2f9e44', g: '#8ce99a' } : { r: i % 4 === 0 ? '#ff6b6b' : '#f783ac', G: '#2f9e44' }, cx, by));
      x.fillStyle = '#ff6b6b'; x.fillRect(Math.round(W * 0.3), 6, 2, 2); x.fillStyle = '#ffd43b'; x.fillRect(Math.round(W * 0.3) + 2, 6, 1, 1); x.fillStyle = '#4dabf7'; x.fillRect(Math.round(W * 0.3), 8, 2, 1);
    },
  },
  'bg-fjord': {
    edge: '#9fb8cc', // around the field on a tall or wide screen
    name: 'Alaskan Fjord',
    ground: ['#eef4f8', '#f6f9fb', '#c9d8e4'], tex: 'snow', line: '#4a8a9c', end: ['#1c8a9c', '#12586e'],
    rink: { ice: '#d0f0fb', scuff: '#a5e0f2', board: '#ffffff', boardHi: '#f1f3f5', rim: '#9fb8cc', soft: true, line: '#e03131', blue: '#1c7ed6', name: 'the frozen fjord' },
    shade: 'rgba(40,70,100,0.25)',
    back(x, W, h) {
      band(x, 0, h, W, '#b8d4e3', '#e7f5ff');
      for (let i = 0; i < W; i += 1) {
        const m = Math.round(16 * vnoise(i, 0, 22, 7) + 4 * vnoise(i, 1, 6, 7));
        const top = h - 4 - m;
        x.fillStyle = '#6c7a89'; x.fillRect(i, top, 1, m + 4);
        x.fillStyle = '#ffffff'; x.fillRect(i, top, 1, Math.max(1, Math.round(m * 0.35)));
      }
      x.fillStyle = '#1c8a9c'; x.fillRect(0, h - 4, W, 2); x.fillStyle = '#c5f6fa'; for (let i = 0; i < W; i += 7) x.fillRect(i + (i % 3), h - 4, 2, 1);
      row(x, W, h, 14, 17, (cx, by, i) => sprite(x, S.SPRUCE, i % 2 ? S.SPRUCE_PAL : { ...S.SPRUCE_PAL, G: '#24503a', g: '#3e6a4a' }, cx, by));
      x.fillStyle = '#ffffff'; x.fillRect(0, h - 1, W, 1);
    },
  },
  'bg-rainbow': {
    edge: '#fcc2d7', // around the field on a tall or wide screen
    name: 'Rainbow Land',
    ground: ['#c3f0ca', '#d7f5dc', '#a5e3b0'], tex: 'candy', line: '#ffffff', end: ['#f783ac', '#e64980'],
    stripes: ['#ffd6e0', '#ffe8cc', '#fff3bf', '#d3f9d8', '#d0ebff', '#e5dbff'],
    rink: { ice: '#fff0f6', scuff: '#ffdeeb', board: '#ffffff', boardHi: '#ff6b6b', rim: '#e64980', candy: true, line: '#845ef7', blue: '#4dabf7', name: 'the candy rink' },
    shade: 'rgba(120,60,120,0.22)',
    back(x, W, h) {
      band(x, 0, h, W, '#c3fae8', '#fff0f6');
      const cols = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
      const cx = Math.round(W * 0.35); const R = h + 4;
      for (let y = 0; y < h; y += 1) for (let i = -R - 2; i <= R + 2; i += 1) {
        const d = Math.hypot(i, (h - y) * 1.1); const b = Math.floor(R - d);
        if (b >= 0 && b < cols.length) { x.fillStyle = cols[b]; x.fillRect(cx + i, y, 1, 1); }
      }
      for (const [ox, oy] of [[0.1, 6], [0.62, 4], [0.86, 9]]) { disc(x, Math.round(W * ox), oy, 3, '#ffffff', 0.7); disc(x, Math.round(W * ox) + 4, oy + 1, 3, '#ffffff', 0.7); }
      row(x, W, h, 22, 12, (cx2, by, i) => (i % 3 === 2
        ? sprite(x, S.TREE, [{ G: '#faa2c1', g: '#fcc2d7', d: '#f06595', T: '#fff0f6' }, { G: '#b197fc', g: '#d0bfff', d: '#845ef7', T: '#fff0f6' }][i % 2], cx2, by)
        : sprite(x, S.CANDY, { c: ['#ff6b6b', '#845ef7', '#4dabf7'][i % 3], W: '#ffffff' }, cx2, by)));
    },
  },
  'bg-galaxy': {
    edge: '#1a0f40', // around the field on a tall or wide screen
    name: 'Golden Galaxy',
    ground: ['#3b2a6b', '#43307a', '#2a1a5e'], tex: 'starry', line: '#ffd43b', end: ['#f59f00', '#e67700'],
    rink: { ice: '#2a1a5e', scuff: '#3a2878', board: '#fab005', boardHi: '#fff3bf', rim: '#e67700', line: '#ffd43b', blue: '#b197fc', dark: true, starry: true, name: 'the star rink' },
    shade: 'rgba(0,0,20,0.4)',
    back(x, W, h) {
      band(x, 0, h, W, '#1a0f40', '#3a2878');
      stars(x, W, h, Math.round(W / 3), 8, ['#ffd43b', '#fff3bf', '#ffffff', '#b197fc']);
      disc(x, Math.round(W * 0.2), 8, 4, '#ffd43b'); x.fillStyle = '#fff3bf'; x.fillRect(Math.round(W * 0.2) - 7, 8, 15, 1); // a ringed planet
      row(x, W, h, 20, 14, (cx, by, i) => sprite(x, i % 3 === 1 ? S.CRYSTAL : S.SPIRE, i % 2 ? { c: '#d0bfff', C: '#9775fa' } : { c: '#ffe066', C: '#f59f00' }, cx, by));
    },
  },
};

/** The look for a Places background (Forest Village for anything else). */
export const fieldLook = (map) => FIELD_LOOKS[map] || FIELD_LOOKS['bg-meadow'];

/** The backdrop along the top of a field: W wide, h tall (the score sits on it). */
export function paintBackdrop(x, map, W, h) {
  fieldLook(map).back(x, W, h);
  x.fillStyle = OUT; x.fillRect(0, h, W, 1);
}

/** The color of one ground pixel: x, y in field pixels. */
export function groundAt(look, gx, gy) {
  const [a, b, speck] = look.ground;
  const n = h2(gx, gy, 31);
  switch (look.tex) {
    case 'mown': return Math.floor(gx / 12) % 2 ? a : b;
    case 'sand': return n < 0.06 ? speck : n > 0.97 ? '#fff3bf' : vnoise(gx, gy, 9, 2) > 0.6 ? b : a;
    case 'ripples': return Math.sin(gy * 0.9 + vnoise(gx, gy, 14, 3) * 9) > 0.88 ? b : n < 0.03 ? speck : n > 0.98 ? '#fff4d1' : a;
    case 'dust': { const c = vnoise(gx, gy, 6, 5); return c > 0.86 ? speck : c > 0.81 ? '#c5c9e6' : n < 0.05 ? speck : vnoise(gx, gy, 20, 6) > 0.6 ? b : a; }
    case 'cobbles': { const c = cobble(gx, gy, 2); return c.mortar ? speck : h2(c.id, 0, 3) > 0.5 ? a : b; }
    case 'ash': { const c = vnoise(gx, gy, 22, 6); return Math.abs(c - 0.5) < 0.006 ? '#ff6b1a' : n < 0.05 ? speck : vnoise(gx, gy, 9, 2) > 0.6 ? b : a; }
    case 'leaves': return n < 0.05 ? '#51cf66' : n > 0.96 ? speck : vnoise(gx, gy, 8, 4) > 0.6 ? b : a;
    case 'snow': return n < 0.05 ? speck : n > 0.985 ? '#d0ebff' : vnoise(gx, gy, 12, 3) > 0.62 ? b : a;
    case 'candy': return look.stripes[Math.floor(gx / 16) % look.stripes.length];
    case 'starry': return n < 0.012 ? '#ffd43b' : n > 0.992 ? '#fff3bf' : vnoise(gx, gy, 16, 8) > 0.6 ? b : a;
    default: return a;
  }
}

/** Fills a rectangle of the field with the map's ground. */
export function paintGround(x, map, x0, y0, w, h) {
  const look = fieldLook(map);
  for (let gy = y0; gy < y0 + h; gy += 1) {
    for (let gx = x0; gx < x0 + w; gx += 1) { x.fillStyle = groundAt(look, gx, gy); x.fillRect(gx, gy, 1, 1); }
  }
}

/** The ice of a rink: (gx, gy) in rink pixels. */
export function iceAt(look, gx, gy) {
  const r = look.rink; const n = h2(gx, gy, 17);
  if (r.mud) return vnoise(gx, gy, 9, 4) > 0.62 ? r.scuff : n < 0.03 ? '#5c3a1e' : r.ice;
  if (r.starry) return n < 0.01 ? '#ffd43b' : n > 0.993 ? '#ffffff' : r.ice;
  if (r.marble) { const v = vnoise(gx, gy, 11, 9); return Math.abs(v - 0.5) < 0.012 ? '#ced4da' : (Math.floor(gx / 24) + Math.floor(gy / 24)) % 2 ? r.ice : r.scuff; }
  if (r.candy) return Math.floor((gx + gy) / 6) % 4 === 0 ? r.scuff : r.ice;
  return n < 0.02 ? r.scuff : r.ice;
}

/** The shadow color under buddies and balls on a map. */
export const shadeFor = (map) => fieldLook(map).shade;

// ---------- the balls and pucks some maps play with ----------
const BALLS = {
  // keepy-uppy: a striped beach ball (Sunset Beach), a glowing lava rock (Volcano Island)
  beach: [['.KKKK.', 'KRRWWK', 'KRRWYK', 'KBBWYK', 'KBBGGK', '.KKKK.'], { R: '#ff6b6b', W: '#ffffff', Y: '#ffd43b', B: '#4dabf7', G: '#69db7c' }],
  lava: [['.KKKK.', 'KDOODK', 'KOYODK', 'KDOYOK', 'KDDODK', '.KKKK.'], { D: '#5c2d12', O: '#ff6b1a', Y: '#ffd43b' }],
  // hockey: a sand dollar (Under the Sea), an ember (Volcano Island): both bright so they show
  sanddollar: [['KKK', 'KWK'], { W: '#fff4d1' }],
  ember: [['KKK', 'KOK'], { O: '#ff922b' }],
};
/** The cells (rows of colors, null = see-through) of one of a map's own balls or pucks. */
export function mapBallCells(id) {
  const b = BALLS[id];
  if (!b) return null;
  const [rows, pal] = b;
  return rows.map((r) => [...r].map((ch) => (ch === '.' ? null : ch === 'K' ? OUT : pal[ch])));
}
