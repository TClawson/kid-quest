// Art for the walkable village (village.js): the villagers who hand out quests, and
// the land itself (houses, trees, paths, the river and bridge), drawn on one canvas
// at one canvas pixel per village pixel. The village is shown at 3 screen pixels per
// village pixel on a tablet (2 on a phone), the same size as the buddies' pixels.

const OUT = '#2a1838';
const EYE = '#1b1430';
const BLUSH = '#ff8fab';

/** Lighten (k > 0) or darken (k < 0) a #rrggbb color. */
export function shade(hex, k) {
  if (!/^#[0-9a-f]{6}$/i.test(hex)) return hex;
  const n = parseInt(hex.slice(1), 16); const c = [n >> 16, (n >> 8) & 255, n & 255]; const t = k > 0 ? [255, 255, 255] : [27, 20, 48]; const a = Math.abs(k);
  return `#${c.map((v, i) => Math.round(v + (t[i] - v) * a).toString(16).padStart(2, '0')).join('')}`;
}
const hashXY = (i, j) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };

function seeded(n) {
  let s = n % 2147483647 || 7;
  return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
}

// ---------- villagers ----------
// Letter grids, 16 wide: a head per kind on a shared body. K outline, e eyes, w a glint
// in the eye, b cheeks (pink when happy), C/c clothes, M a pocket, A fur, a light fur.

const BODY = [
  '..KCCcCCCCcCCK..',
  '.KAKCCCCCCCCKAK.',
  '.KAKCCCMMCCCKAK.',
  '..KKCCCCCCCCKK..',
  '...KAAK..KAAK...',
  '...KKKK..KKKK...',
];

const HEADS = {
  bunny: [
    '....KK....KK....',
    '...KiAK..KiAK...',
    '...KiAK..KiAK...',
    '...KiAK..KiAK...',
    '..KKAAKKKKAAKK..',
    '.KAAAAAAAAAAAAK.',
    '.KAAweAAAAweAAK.',
    '.KAAeeAAAAeeAAK.',
    '.KAbbAANNAAbbAK.',
    '..KAAAaaaaAAAK..',
    '...KKKKKKKKKK...',
  ],
  beaver: [
    '...KK......KK...',
    '..KDAKKKKKKADK..',
    '.KAAAAAAAAAAAAK.',
    '.KAAAAAAAAAAAAK.',
    '.KAAweAAAAweAAK.',
    '.KAAeeAAAAeeAAK.',
    '.KAbbAaNNaAbbAK.',
    '..KAAaaaaaaAAK..',
    '...KAaaTTaaAK...',
    '....KKKTTKKK....',
  ],
  owl: [
    '..KK........KK..',
    '..KAK......KAK..',
    '..KAAKKKKKKAAK..',
    '.KAAAAAAAAAAAAK.',
    '.KAwwwwAAwwwwAK.',
    '.KAweewAAweewAK.',
    '.KAweewAAweewAK.',
    '.KAwwwwOOwwwwAK.',
    '..KAAAAOOAAAAK..',
    '..KAaaaaaaaaAK..',
    '...KaaaaaaaaK...',
  ],
  frog: [
    '..KKKK....KKKK..',
    '.KAweAK..KAweAK.',
    '.KAeeAKKKKAeeAK.',
    'KAAAAAAAAAAAAAAK',
    'KAbbAAAAAAAAbbAK',
    'KAAKAAAAAAAAKAAK',
    '.KAAKKKKKKKKAAK.',
    '.KAaaaaaaaaaaAK.',
    '..KAaaaaaaaaAK..',
    '...KKKKKKKKKK...',
  ],
  sheep: [
    '....KK.KK.KK....',
    '...KWWKWWKWWK...',
    '..KWWWWWWWWWWK..',
    '.KWWWWWWWWWWWWK.',
    'KDKWWFFFFFFWWKDK',
    'KDKWFFFFFFFFWKDK',
    '.KK.KFwFFwFK.KK.',
    '...KFbeFFebFK...',
    '...KFFFNNFFFK...',
    '....KFFFFFFK....',
    '....KKKKKKKK....',
  ],
  hedgehog: [
    '....KK.KK.KK....',
    '...KSSKSSKSSK...',
    '..KSSsSSsSSsSK..',
    '.KSSSSSSSSSSSSK.',
    'KSSSAAAAAAAASSSK',
    'KSSAweAAAAweASSK',
    'KSAAeeAAAAeeAASK',
    '.KAbbAANNAAbbAK.',
    '..KAAAaaaaAAAK..',
    '...KKKKKKKKKK...',
  ],
  raccoon: [
    '..KK........KK..',
    '..KDK......KDK..',
    '..KDAKKKKKKADK..',
    '.KAAAAAAAAAAAAK.',
    '.KAaaaAAAAaaaAK.',
    '.KMMweMAAMweMMK.',
    '.KMMeeMAAMeeMMK.',
    '.KAbaaaNNaaabAK.',
    '..KAaaaaaaaaAK..',
    '...KKKKKKKKKK...',
  ],
  mouse: [
    '.KKKK......KKKK.',
    'KAiiAK....KAiiAK',
    'KAiiAK....KAiiAK',
    '.KAAAKKKKKKAAAK.',
    '..KAAAAAAAAAAK..',
    '.KAAweAAAAweAAK.',
    '.KAAeeAAAAeeAAK.',
    '.KAbbAaNNaAbbAK.',
    '..KAAaaaaaaAAK..',
    '...KKKKKKKKKK...',
  ],
};

// colors for each kind; lid is what closed (happy) eyes are drawn over
const PALS = {
  bunny: { A: '#f1f3f5', a: '#ffffff', i: '#ffadc6', N: '#ff8fab', C: '#4c6ef5', lid: 'A' },
  beaver: { A: '#a0612f', a: '#d9a066', D: '#6e3d1a', N: '#3b2314', T: '#ffffff', C: '#4dabf7', lid: 'A' },
  owl: { A: '#a47148', a: '#e8cfa5', w: '#fff8e7', O: '#f59f00', C: '#2f9e44', lid: 'w', noGlint: true },
  frog: { A: '#5cb85c', a: '#d8f5a2', C: '#f08c00', lid: 'A' },
  sheep: { W: '#f8f9fa', F: '#5c5f66', D: '#343a40', N: '#ff8fab', C: '#e9ecef', A: '#5c5f66', lid: 'F' },
  hedgehog: { S: '#7a4a26', s: '#b07a47', A: '#f3d6a4', a: '#fff0d0', N: '#3b2314', C: '#7048e8', lid: 'A' },
  raccoon: { A: '#adb5bd', a: '#f1f3f5', D: '#495057', M: '#3d4249', N: '#1b1430', C: '#e03131', lid: 'M' },
  mouse: { A: '#ced4da', a: '#f1f3f5', i: '#ffadc6', N: '#ff6b9a', C: '#fcc419', lid: 'A' },
};

export const VILLAGER_KINDS = Object.keys(HEADS);

/** A villager's letter grid, and its size. */
export function villagerGrid(kind) {
  const head = HEADS[kind] || HEADS.bunny;
  return [...head, ...BODY];
}

/** Draws a villager onto a canvas (one canvas pixel per grid cell). happy: closed eyes and pink cheeks. */
export function drawVillager(canvas, kind, happy = false) {
  const rows = villagerGrid(kind);
  const pal = PALS[kind] || PALS.bunny;
  canvas.width = 16;
  canvas.height = rows.length;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, 16, rows.length);
  const at = (x, y) => rows[y]?.[x] || '.';
  const colorOf = (ch, x, y) => {
    if (ch === 'K') return OUT;
    if (ch === 'e') {
      if (!happy) return EYE;
      // closed eyes: a dark line on the top row of each eye, fur below it
      return at(x, y - 1) === 'e' ? pal[pal.lid] : OUT;
    }
    if (ch === 'w') return pal.noGlint ? pal.w : happy ? pal[pal.lid] : '#ffffff';
    if (ch === 'b') return happy ? BLUSH : pal.A;
    if (ch === 'c') return shade(pal.C, 0.3);
    if (ch === 'M' && !pal.M) return shade(pal.C, -0.2);
    return pal[ch] || null;
  };
  const solid = (x, y) => { const ch = at(x, y); return ch !== '.' && ch !== 'K'; };
  for (let y = 0; y < rows.length; y += 1) {
    for (let x = 0; x < 16; x += 1) {
      const ch = at(x, y);
      if (ch === '.') continue;
      let c = colorOf(ch, x, y);
      if (!c) continue;
      // a light top edge and a shaded bottom edge on fur and clothes
      if (ch !== 'K' && ch !== 'e' && ch !== 'w' && ch !== 'b') {
        if (!solid(x, y - 1)) c = shade(c, 0.18);
        else if (!solid(x, y + 1)) c = shade(c, -0.15);
      }
      ctx.fillStyle = c;
      ctx.fillRect(x, y, 1, 1);
    }
  }
  return canvas;
}

// ---------- the land ----------

const GRASS = '#5cbd52';
const GRASS_DARK = '#4aa842';
const GRASS_LIGHT = '#7bd66b';
const DIRT = '#d9a86c';
const DIRT_EDGE = '#a4743f';

function painter(ctx) {
  const px = (x, y, c, w = 1, h = 1) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
  return px;
}

/** A big leafy tree, 32 x 40: round clumps of leaves lit from the top left, a trunk and a shadow. */
export function bigTree(px, X, Y, pal = {}) {
  const G = pal.G || '#3c9a3c'; const g = pal.g || '#6ccf5f'; const d = pal.d || '#256b2b'; const T = pal.T || '#7a4a26';
  const clumps = [[16, 8, 7.5], [8.5, 14, 8], [23.5, 14, 8], [16, 18, 8.5], [11, 9, 6], [21, 9, 6]];
  const inside = (x, y) => clumps.findIndex(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  // shadow, then the trunk
  for (let x = 5; x < 28; x += 1) px(X + x, Y + 37, 'rgba(27,20,48,0.2)', 1, 2 + (x > 8 && x < 24 ? 1 : 0));
  px(X + 11, Y + 22, OUT, 10, 17);
  px(X + 12, Y + 22, T, 8, 16);
  px(X + 12, Y + 22, shade(T, 0.2), 2, 16);
  px(X + 17, Y + 22, shade(T, -0.25), 3, 16);
  px(X + 14, Y + 28, shade(T, -0.3), 1, 4); px(X + 15, Y + 33, shade(T, -0.3), 2, 1);
  px(X + 9, Y + 37, OUT, 3, 2); px(X + 20, Y + 37, OUT, 3, 2); px(X + 10, Y + 37, T, 2, 1); px(X + 20, Y + 37, shade(T, -0.2), 2, 1);
  for (let y = -1; y <= 28; y += 1) {
    for (let x = -1; x <= 32; x += 1) {
      const k = inside(x, y);
      if (k < 0) {
        if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) >= 0)) px(X + x, Y + y, OUT);
        continue;
      }
      const [cx, cy, r] = clumps[k];
      const l = ((cx - (x + 0.5)) + (cy - (y + 0.5))) / r;
      const th = ((x * 3 + y * 7) % 5) / 5 - 0.4;
      let c = l > 0.6 + th * 0.3 ? g : l < -0.45 + th * 0.3 ? d : G;
      // a line of shade where clumps overlap, so the leaves look bunched
      const other = clumps.findIndex(([ox, oy, orr], j) => j !== k && (x + 0.5 - ox) ** 2 + (y - 0.5 - oy) ** 2 <= orr * orr);
      if (other >= 0 && other < k && !((x + 0.5 - clumps[other][0]) ** 2 + (y + 0.5 - clumps[other][1]) ** 2 <= clumps[other][2] ** 2)) c = d;
      if (c === G && hashXY(X + x, Y + y) < 0.14) c = d;
      if (c === g && hashXY(X + x, Y + y) > 0.88) c = '#c0f2a8';
      px(X + x, Y + y, c);
    }
  }
}

/** A round bush, 18 x 13. berries: a few red berries on it. */
export function bush(px, X, Y, berries = false) {
  const clumps = [[5, 7, 4.5], [12, 7, 4.5], [8.5, 4.5, 4.5]];
  const inside = (x, y) => clumps.findIndex(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  for (let x = 2; x < 16; x += 1) px(X + x, Y + 12, 'rgba(27,20,48,0.18)');
  for (let y = -1; y <= 12; y += 1) {
    for (let x = -1; x <= 18; x += 1) {
      const k = inside(x, y);
      if (k < 0) { if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => inside(x + dx, y + dy) >= 0)) px(X + x, Y + y, OUT); continue; }
      const [cx, cy, r] = clumps[k];
      const l = ((cx - (x + 0.5)) + (cy - (y + 0.5))) / r;
      let c = l > 0.6 ? '#6ccf5f' : l < -0.5 ? '#256b2b' : '#3c9a3c';
      if (c === '#3c9a3c' && hashXY(X + x, Y + y) < 0.15) c = '#256b2b';
      px(X + x, Y + y, c);
    }
  }
  if (berries) [[5, 5], [10, 8], [13, 4], [7, 9]].forEach(([x, y]) => { px(X + x, Y + y, '#e03131'); px(X + x, Y + y - 1, '#ff8787'); });
}

/**
 * A cottage w wide and h tall (roof plus walls): a shingled roof with a chimney, windows
 * with flower boxes, a door with a step and a shadow on the ground. The door is centered.
 */
export function cottage(px, X, Y, w, h, opts = {}) {
  const R = opts.roof || '#e03131'; const r = shade(R, 0.3); const W = opts.wall || '#fff3d6'; const B = '#4dabf7'; const D = opts.door || '#8b4513';
  const K = OUT;
  const roofH = Math.round(h * 0.48);
  const wallTop = Y + roofH;
  const wallH = h - roofH;
  // shadow on the ground and the right side
  px(X + 4, Y + h, 'rgba(27,20,48,0.22)', w - 2, 3);
  px(X + w - 4, wallTop + 2, 'rgba(27,20,48,0.16)', 6, wallH);
  // chimney
  const cx = X + Math.round(w * 0.68);
  px(cx, Y - 6, K, 10, 16); px(cx + 1, Y - 5, '#adb5bd', 8, 15); px(cx + 1, Y - 5, '#dee2e6', 8, 1); px(cx + 7, Y - 4, '#868e96', 2, 14);
  for (let i = 0; i < 4; i += 1) px(cx + 1, Y - 3 + i * 3, '#868e96', 6, 1);
  px(cx - 1, Y - 7, K, 12, 3); px(cx, Y - 6, '#ced4da', 10, 1);
  // roof: rows of shingles, wider as they go down, lit on the left
  const ridge = Math.round(w * 0.22);
  for (let y = 0; y < roofH; y += 1) {
    const half = ridge + (y / (roofH - 1)) * (w / 2 - ridge + 2);
    const x0 = Math.round(X + w / 2 - half); const x1 = Math.round(X + w / 2 + half);
    px(x0 - 1, Y + y, K, x1 - x0 + 2, 1);
    for (let x = x0; x < x1; x += 1) {
      let c = R;
      const row = Math.floor(y / 4);
      if (y % 4 === 3) c = shade(R, -0.2);
      else if ((x - X + row * 3) % 6 === 0) c = shade(R, -0.12);
      if (x - x0 < 3 && y % 4 !== 3) c = r;
      if (x1 - x < 3) c = shade(R, -0.25);
      px(x, Y + y, c);
    }
  }
  px(Math.round(X + w / 2 - ridge), Y - 1, K, ridge * 2, 1);
  px(Math.round(X + w / 2 - ridge) + 1, Y, r, ridge * 2 - 2, 1); px(Math.round(X + w / 2 - ridge) + 2, Y, '#ffffff', 4, 1);
  px(X - 2, wallTop - 1, K, w + 4, 1); px(X - 1, wallTop - 2, shade(R, -0.35), w + 2, 1);
  // walls with a timber frame
  px(X + 2, wallTop, K, w - 4, wallH);
  px(X + 3, wallTop, W, w - 6, wallH - 1);
  px(X + 3, wallTop, shade(W, -0.22), w - 6, 3);
  px(X + 3, wallTop + wallH - 3, shade(W, -0.1), w - 6, 2);
  for (let x = X + 6; x < X + w - 6; x += 7) for (let y = wallTop + 6; y < wallTop + wallH - 4; y += 4) px(x + ((y >> 2) % 2) * 3, y, shade(W, -0.07), 3, 1);
  px(X + 3, wallTop + 3, shade(W, -0.35), 2, wallH - 4); px(X + w - 5, wallTop + 3, shade(W, -0.35), 2, wallH - 4);
  // the door with a round top, a knob and a step
  const dw = 14; const dh = Math.min(wallH - 3, 22); const dx = Math.round(X + w / 2 - dw / 2); const dy = Y + h - dh;
  px(dx - 1, dy, K, dw + 2, dh); px(dx + 1, dy - 1, K, dw - 2, 1);
  px(dx, dy + 1, D, dw, dh - 1); px(dx + 1, dy, D, dw - 2, 1);
  px(dx, dy + 1, shade(D, 0.25), dw, 1);
  for (let x = dx + 3; x < dx + dw; x += 4) px(x, dy + 2, shade(D, -0.25), 1, dh - 2);
  px(dx + dw - 4, dy + Math.round(dh / 2), '#fcc419', 2, 2);
  px(dx - 3, Y + h, '#adb5bd', dw + 6, 2); px(dx - 3, Y + h + 2, '#868e96', dw + 6, 1);
  // windows with shutters and flower boxes, either side of the door
  const win = (wx) => {
    const wy = wallTop + 7;
    px(wx - 3, wy, opts.shutter || '#2f9e44', 3, 12); px(wx + 12, wy, opts.shutter || '#2f9e44', 3, 12);
    px(wx - 3, wy, OUT, 1, 12); px(wx + 14, wy, OUT, 1, 12);
    px(wx, wy, K, 12, 12); px(wx + 1, wy + 1, B, 10, 10);
    px(wx + 1, wy + 1, shade(B, 0.55), 4, 1); px(wx + 1, wy + 2, shade(B, 0.4), 2, 2);
    px(wx + 5, wy + 1, K, 2, 10); px(wx + 1, wy + 5, K, 10, 2);
    px(wx + 7, wy + 7, shade(B, -0.2), 4, 4);
    // flower box
    px(wx - 2, wy + 13, K, 16, 4); px(wx - 1, wy + 14, '#a0612f', 14, 2);
    for (let i = 0; i < 14; i += 2) { px(wx - 1 + i, wy + 12, i % 4 ? '#ffd43b' : '#ff6b6b'); px(wx + i, wy + 12, '#2f9e44'); }
  };
  const gap = Math.round((w - dw) / 2);
  if (gap > 28) { win(X + Math.round(gap / 2) - 4); win(X + w - Math.round(gap / 2) - 8); }
  if (opts.sign) opts.sign(px, Math.round(X + w / 2), dy - 2);
}

/** A stone well with a little roof, 26 x 30. */
export function well(px, X, Y) {
  px(X + 2, Y + 29, 'rgba(27,20,48,0.2)', 24, 2);
  // posts and roof
  px(X + 3, Y + 6, OUT, 4, 14); px(X + 19, Y + 6, OUT, 4, 14); px(X + 4, Y + 6, '#7a4a26', 2, 14); px(X + 20, Y + 6, '#7a4a26', 2, 14);
  for (let y = 0; y < 8; y += 1) { const half = 6 + y * 1.2; px(X + 13 - half - 1, Y + y, OUT, half * 2 + 2, 1); px(X + 13 - half, Y + y, y % 3 === 2 ? '#a61e4d' : '#c2255c', half * 2, 1); }
  px(X + 4, Y + 1, '#f06595', 4, 1);
  px(X + 8, Y + 9, OUT, 10, 1); px(X + 12, Y + 9, OUT, 2, 7); px(X + 11, Y + 15, OUT, 4, 4); px(X + 12, Y + 16, '#a0612f', 2, 2);
  // the stone ring
  px(X, Y + 18, OUT, 26, 11); px(X + 1, Y + 19, '#ced4da', 24, 9);
  px(X + 3, Y + 18, '#1c3d5a', 20, 3); px(X + 4, Y + 18, '#2b8adf', 18, 2); px(X + 6, Y + 18, '#9fd0ff', 3, 1);
  for (let i = 0; i < 4; i += 1) { px(X + 1 + i * 6, Y + 22, '#868e96', 1, 3); px(X + 4 + i * 6, Y + 25, '#868e96', 1, 3); }
  px(X + 1, Y + 24, '#adb5bd', 24, 1); px(X + 1, Y + 27, '#adb5bd', 24, 1);
}

/** A picket fence along x from X for w pixels. */
function fence(px, X, Y, w, c = '#c98a4b') {
  px(X, Y + 3, OUT, w, 5); px(X, Y + 4, c, w, 1); px(X, Y + 6, shade(c, -0.25), w, 1);
  for (let x = 0; x < w; x += 5) { px(X + x, Y, OUT, 3, 10); px(X + x + 1, Y + 1, shade(c, 0.25), 1, 8); px(X + x + 1, Y - 1, OUT); }
}

/** A garden with rows of sprouts and a few carrots, w x h. */
function garden(px, X, Y, w, h) {
  px(X - 1, Y - 1, OUT, w + 2, h + 2); px(X, Y, '#7a4a26', w, h);
  for (let y = Y + 2; y < Y + h - 2; y += 7) {
    px(X + 1, y + 3, '#5c3317', w - 2, 2);
    for (let x = X + 3; x < X + w - 3; x += 6) {
      px(x, y + 1, '#2f9e44', 1, 3); px(x + 2, y, '#2f9e44', 1, 4); px(x + 1, y - 1, '#69db7c', 1, 3);
      if ((x + y) % 3 === 0) px(x + 1, y + 3, '#f76707', 1, 2);
    }
  }
}

/** A laundry line between two posts with clothes hung on it (shirts, socks). */
function laundry(px, X, Y, w) {
  const post = (x) => { px(x, Y, OUT, 4, 26); px(x + 1, Y, '#a0612f', 2, 25); px(x - 2, Y, OUT, 8, 3); px(x - 1, Y + 1, '#c98a4b', 6, 1); px(x - 1, Y + 26, 'rgba(27,20,48,0.2)', 7, 2); };
  post(X); post(X + w - 4);
  for (let x = X + 3; x < X + w - 3; x += 1) px(x, Y + 3 + Math.round(Math.sin(((x - X) / (w - 6)) * Math.PI) * 3), '#495057');
  const clothes = [['#ff6b6b', 'shirt'], ['#4dabf7', 'sock'], ['#ffd43b', 'shirt'], ['#69db7c', 'sock'], ['#b197fc', 'shirt'], ['#ff8fab', 'sock']];
  let x = X + 8;
  clothes.forEach(([c, kind]) => {
    if (x > X + w - 14) return;
    const y = Y + 4 + Math.round(Math.sin(((x - X) / (w - 6)) * Math.PI) * 3);
    if (kind === 'shirt') {
      px(x - 1, y, OUT, 12, 11); px(x - 3, y + 1, OUT, 16, 4);
      px(x, y + 1, c, 10, 9); px(x - 2, y + 2, c, 14, 2); px(x, y + 1, shade(c, 0.3), 10, 1); px(x + 4, y + 1, OUT, 2, 2);
      x += 15;
    } else {
      px(x - 1, y, OUT, 5, 9); px(x - 1, y + 6, OUT, 8, 4); px(x, y + 1, c, 3, 8); px(x, y + 7, c, 6, 2); px(x, y + 1, '#ffffff', 3, 1);
      x += 10;
    }
  });
}

/** A round plaza of cobblestones. */
function plaza(px, cx, cy, r) {
  for (let y = -r - 1; y <= r + 1; y += 1) {
    for (let x = -r - 1; x <= r + 1; x += 1) {
      const d = Math.sqrt(x * x + y * y);
      if (d > r + 1) continue;
      if (d > r) { px(cx + x, cy + y, '#868e96'); continue; }
      // stones in rings, with dark gaps between them
      const ring = Math.floor(d / 5);
      const ang = Math.atan2(y, x);
      const seg = Math.floor(((ang + Math.PI) / (2 * Math.PI)) * (6 + ring * 6) + ring * 0.5);
      const gapR = d % 5 < 1;
      const gapA = Math.abs((((ang + Math.PI) / (2 * Math.PI)) * (6 + ring * 6) + ring * 0.5) - seg) < 0.08 * (1 + ring * 0.15);
      let c = hashXY(ring, seg) < 0.5 ? '#ced4da' : '#dee2e6';
      if (hashXY(ring * 3, seg * 7) > 0.85) c = '#c8bfa8';
      if (gapR || gapA) c = '#adb5bd';
      px(cx + x, cy + y, c);
    }
  }
}

/** A dirt path along the points, w wide, with a darker edge and a little grit. */
function path(px, pts, w, rnd) {
  const dots = [];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let s = 0; s <= n; s += 1) dots.push([x0 + ((x1 - x0) * s) / n, y0 + ((y1 - y0) * s) / n]);
  }
  const disc = (r, c) => dots.forEach(([x, y]) => { for (let dy = -r; dy <= r; dy += 1) { const half = Math.floor(Math.sqrt(r * r - dy * dy)); px(x - half, y + dy, c, half * 2 + 1, 1); } });
  disc(Math.ceil(w / 2) + 1, DIRT_EDGE);
  disc(Math.ceil(w / 2), DIRT);
  dots.forEach(([x, y], i) => {
    if (i % 3) return;
    const g = rnd();
    if (g < 0.35) px(x + Math.round((rnd() - 0.5) * w), y + Math.round((rnd() - 0.5) * w), shade(DIRT, -0.14));
    else if (g > 0.85) px(x + Math.round((rnd() - 0.5) * w), y + Math.round((rnd() - 0.5) * w), shade(DIRT, 0.2));
    else if (g > 0.8) { const ox = x + Math.round((rnd() - 0.5) * (w - 4)); const oy = y + Math.round((rnd() - 0.5) * (w - 4)); px(ox, oy, '#adb5bd', 2, 1); px(ox, oy + 1, '#868e96', 2, 1); }
  });
}

/** The river across the whole village, from y0 to y1, with grassy banks. Returns the water band. */
function river(px, W, y0, y1, rnd) {
  for (let x = 0; x < W; x += 1) {
    const wob = Math.round(Math.sin(x / 13) * 1.5 + Math.sin(x / 5.3) * 0.7);
    const top = y0 + wob; const bot = y1 + Math.round(Math.sin(x / 11 + 2) * 1.5);
    px(x, top - 3, '#3c9a3c', 1, 2); px(x, top - 1, '#8b5a2b', 1, 2);
    px(x, top + 1, '#1f6fc0', 1, bot - top - 1);
    px(x, top + 3, '#2b8adf', 1, bot - top - 6);
    px(x, bot, '#8b5a2b', 1, 2); px(x, bot + 2, '#3c9a3c', 1, 2);
  }
  // little shines on the water
  for (let i = 0; i < W / 6; i += 1) {
    const x = Math.floor(rnd() * W); const y = y0 + 5 + Math.floor(rnd() * (y1 - y0 - 10));
    px(x, y, '#9fd0ff', 3 + Math.floor(rnd() * 4), 1);
  }
  // reeds and lily pads on the banks
  for (let i = 0; i < W / 30; i += 1) {
    const x = Math.floor(rnd() * W);
    px(x, y0 - 6, '#2b8a3e', 1, 5); px(x + 2, y0 - 8, '#2b8a3e', 1, 7); px(x + 2, y0 - 9, '#7a4a26', 1, 3);
    const lx = Math.floor(rnd() * W); const ly = y1 - 6;
    px(lx, ly, '#2f9e44', 5, 2); px(lx + 1, ly - 1, '#69db7c', 3, 1); if (i % 3 === 0) px(lx + 2, ly - 1, '#ff8fab');
  }
}

/** A wooden bridge across the river: planks, rails and posts. */
function bridge(px, X, Y0, Y1, w) {
  px(X - 3, Y0 - 2, 'rgba(27,20,48,0.25)', w + 8, Y1 - Y0 + 6);
  px(X - 1, Y0 - 2, OUT, w + 2, Y1 - Y0 + 4);
  for (let y = Y0 - 1; y < Y1 + 1; y += 1) {
    const c = y % 4 === 3 ? '#7a4a26' : y % 8 < 4 ? '#b06a35' : '#a0582a';
    px(X, y, c, w, 1);
    if (y % 4 === 1) { px(X + 4, y, '#6e3d1a'); px(X + w - 5, y, '#6e3d1a'); }
  }
  px(X, Y0 - 1, '#c98a4b', w, 1);
  // rails with posts
  for (const rx of [X - 4, X + w]) {
    px(rx, Y0 - 6, OUT, 4, Y1 - Y0 + 10); px(rx + 1, Y0 - 5, '#c98a4b', 2, Y1 - Y0 + 8);
    for (let y = Y0 - 6; y < Y1 + 4; y += 10) { px(rx - 1, y, OUT, 6, 5); px(rx, y + 1, '#8b5a2b', 4, 3); px(rx, y + 1, '#c98a4b', 4, 1); }
  }
}

/** A signpost with a small board. */
function signpost(px, X, Y) {
  px(X + 7, Y + 8, OUT, 4, 14); px(X + 8, Y + 8, '#7a4a26', 2, 13);
  px(X, Y, OUT, 18, 10); px(X + 1, Y + 1, '#d9a066', 16, 8); px(X + 1, Y + 1, '#ecc78f', 16, 1);
  px(X + 3, Y + 4, '#8b5a2b', 12, 1); px(X + 3, Y + 6, '#8b5a2b', 8, 1);
  px(X + 6, Y + 22, 'rgba(27,20,48,0.2)', 7, 2);
}

/** A music note sign over the music hall's door. */
function noteSign(px, cx, y) {
  px(cx - 9, y - 16, OUT, 18, 14); px(cx - 8, y - 15, '#fff3bf', 16, 12);
  px(cx - 1, y - 14, OUT, 2, 8); px(cx + 1, y - 14, OUT, 4, 2); px(cx - 4, y - 8, OUT, 4, 3);
}

/** A market stall with a striped awning and fruit. */
function stall(px, X, Y) {
  px(X + 2, Y + 30, 'rgba(27,20,48,0.2)', 40, 3);
  px(X + 2, Y + 8, OUT, 3, 22); px(X + 37, Y + 8, OUT, 3, 22);
  px(X, Y, OUT, 44, 11);
  for (let x = 1; x < 43; x += 1) px(X + x, Y + 1, Math.floor(x / 6) % 2 ? '#fff5f5' : '#fa5252', 1, 8);
  for (let x = 1; x < 43; x += 6) px(X + x, Y + 9, Math.floor(x / 6) % 2 ? '#fff5f5' : '#fa5252', 6, 2);
  px(X + 1, Y + 1, '#ffffff', 42, 1);
  px(X + 1, Y + 20, OUT, 42, 10); px(X + 2, Y + 21, '#c98a4b', 40, 8); px(X + 2, Y + 21, '#e0a96d', 40, 1);
  const fruit = [['#e03131', '#ff8787'], ['#f08c00', '#ffc078'], ['#fcc419', '#fff3bf'], ['#2f9e44', '#8ce99a']];
  for (let i = 0; i < 8; i += 1) { const [c, l] = fruit[i % 4]; px(X + 4 + i * 5, Y + 17, OUT, 5, 4); px(X + 5 + i * 5, Y + 17, c, 3, 3); px(X + 5 + i * 5, Y + 17, l); }
}

/** A small flower: petals round a center. */
function flower(px, x, y, c) {
  px(x, y + 2, '#2f9e44', 1, 2);
  px(x - 1, y, c); px(x + 1, y, c); px(x, y - 1, c); px(x, y + 1, c); px(x, y, '#fff3bf');
}

/**
 * Paints the whole village onto a canvas, one canvas pixel per village pixel.
 * L is the layout from village.js: { W, H, home, cottages, river, paths, plazas, trees, ... }.
 */
export function paintVillage(canvas, L, opts = {}) {
  canvas.width = L.W;
  canvas.height = L.H;
  const ctx = canvas.getContext('2d');
  const px = painter(ctx);
  const rnd = seeded(1234);

  // grass with tufts and speckles
  px(0, 0, GRASS, L.W, L.H);
  for (let i = 0; i < (L.W * L.H) / 70; i += 1) {
    const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H);
    px(x, y, GRASS_DARK, 3, 1); px(x + 1, y - 1, GRASS_DARK); px(x + 3, y - 1, GRASS_DARK);
    px(x + 1, y - 2, GRASS_LIGHT); px(x + 3, y - 2, GRASS_LIGHT);
  }
  for (let i = 0; i < (L.W * L.H) / 25; i += 1) px(Math.floor(rnd() * L.W), Math.floor(rnd() * L.H), rnd() < 0.5 ? GRASS_DARK : GRASS_LIGHT);
  // the deep forest round the edge is darker
  const edge = (x, y) => Math.min(x, y, L.W - x, L.H - y);
  for (let y = 0; y < L.H; y += 1) for (let x = 0; x < L.W; x += 1) if (edge(x, y) < 20) px(x, y, (x + y) % 2 ? '#2f7d32' : '#357f36');

  // paths and plazas
  L.paths.forEach((p) => path(px, p, 12, rnd));
  L.plazas.forEach(([x, y, r]) => plaza(px, x, y, r));
  river(px, L.W, L.river.y0, L.river.y1, rnd);
  bridge(px, L.bridge.x, L.bridge.y0, L.bridge.y1, L.bridge.w);

  // flowers on open grass, away from paths and buildings
  const busy = (x, y) => L.blocked(x, y, 6) || L.onPath(x, y, 10);
  const colors = ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'];
  for (let i = 0; i < (L.W * L.H) / 260; i += 1) {
    const x = Math.floor(rnd() * L.W); const y = Math.floor(rnd() * L.H);
    if (edge(x, y) < 26 || busy(x, y) || (y > L.river.y0 - 10 && y < L.river.y1 + 8)) continue;
    flower(px, x, y, colors[i % colors.length]);
  }
  // little flower beds in clusters
  L.flowerBeds.forEach(([bx, by]) => { for (let i = 0; i < 9; i += 1) flower(px, bx + (i % 3) * 5 + (Math.floor(i / 3) % 2) * 2, by + Math.floor(i / 3) * 4, colors[(i + bx) % colors.length]); });

  // things that stand up, back to front
  const things = [
    ...L.gardens.map((g) => ({ y: g.y, draw: () => garden(px, g.x, g.y, g.w, g.h) })),
    ...L.fences.map((f) => ({ y: f.y, draw: () => fence(px, f.x, f.y, f.w) })),
    { y: L.home.y, draw: () => cottage(px, L.home.x, L.home.y, L.home.w, L.home.h, { roof: opts.homeRoof || '#e03131', shutter: '#4c6ef5' }) },
    ...L.cottages.map((c) => ({ y: c.y, draw: () => cottage(px, c.x, c.y, c.w, c.h, { roof: c.roof, shutter: c.shutter, sign: c.sign === 'note' ? noteSign : null }) })),
    { y: L.well.y, draw: () => well(px, L.well.x, L.well.y) },
    ...L.stalls.map((s) => ({ y: s.y, draw: () => stall(px, s.x, s.y) })),
    ...L.laundry.map((l) => ({ y: l.y, draw: () => laundry(px, l.x, l.y, l.w) })),
    ...L.signs.map(([x, y]) => ({ y, draw: () => signpost(px, x, y) })),
    ...L.bushes.map(([x, y, b]) => ({ y, draw: () => bush(px, x, y, b) })),
    ...L.trees.map(([x, y]) => ({ y: y + 20, draw: () => bigTree(px, x, y) })),
  ].sort((a, b) => a.y - b.y);
  things.forEach((t) => t.draw());
  return canvas;
}
