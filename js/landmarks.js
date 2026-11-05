// The big secret landmarks, one per map (see SECRETS in treasure-art.js and mapshow.js).
// Drawn with simple shapes into letter grids at one art pixel per map pixel, so they match
// the map. Each landmark has a resting frame (0) and two frames it flips between when tapped.

/** A letter grid to draw shapes into. */
function grid(w, h) {
  const g = Array.from({ length: h }, () => Array(w).fill('.'));
  const api = {
    w, h,
    set(x, y, c) { x = Math.round(x); y = Math.round(y); if (x >= 0 && y >= 0 && x < w && y < h && c) g[y][x] = typeof c === 'function' ? c(x, y, g[y][x]) : c; return api; },
    get(x, y) { return x >= 0 && y >= 0 && x < w && y < h ? g[y][x] : '.'; },
    rect(x0, y0, rw, rh, c) { for (let y = y0; y < y0 + rh; y += 1) for (let x = x0; x < x0 + rw; x += 1) api.set(x, y, c); return api; },
    ellipse(cx, cy, rx, ry, c) {
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y += 1) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x += 1) {
          if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1) api.set(x, y, c);
        }
      }
      return api;
    },
    line(x0, y0, x1, y1, c, t = 1) {
      const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= n; i += 1) {
        const x = x0 + ((x1 - x0) * i) / n;
        const y = y0 + ((y1 - y0) * i) / n;
        api.rect(Math.round(x - (t - 1) / 2), Math.round(y - (t - 1) / 2), t, t, c);
      }
      return api;
    },
    /** Stamp a small letter grid ('.' is see-through). */
    stamp(x0, y0, rows) { rows.forEach((r, y) => [...r].forEach((c, x) => { if (c !== '.') api.set(x0 + x, y0 + y, c); })); return api; },
    rows: () => g.map((r) => r.join('')),
  };
  return api;
}

/** A steady pseudo-random number for a pixel, so the texture is the same every time. */
const noise = (x, y, k = 0) => {
  let n = (x * 374761393 + y * 668265263 + k * 2147483647) | 0;
  n = (n ^ (n >>> 13)) * 1274126177;
  return ((n ^ (n >>> 16)) >>> 0) / 4294967295;
};
/** Shade a fill: a lighter letter on top-left edges, a darker one at bottom-right, some speckle. */
const textured = (base, light, dark, speck = 0.08) => (x, y) => {
  const r = noise(x, y);
  return r < speck ? dark : r > 1 - speck ? light : base;
};

const FLAME = [
  ['..y..', '.yYy.', 'yYrYy', '.rrr.'],
  ['.y...', '.yY..', 'yYrYy', '.rrr.'],
  ['...y.', '..Yy.', 'yYrYy', '.rrr.'],
];
/** A torch on a post or a brazier bowl, with one of three flame shapes. */
const torch = (G, x, y, f) => { G.stamp(x, y, FLAME[f % 3]); G.rect(x + 1, y + 4, 3, 1, 'b').rect(x + 2, y + 5, 1, 4, 'b'); };

// ---------- the landmarks ----------

function oak(i) {
  const G = grid(46, 46);
  // roots and trunk
  G.ellipse(23, 44, 13, 2.5, 'T');
  G.rect(16, 24, 14, 20, textured('T', 'U', 't', 0.12));
  G.line(16, 43, 11, 45, 'T', 2).line(30, 43, 35, 45, 'T', 2);
  for (let y = 26; y < 43; y += 3) G.set(18 + (y % 7), y, 't').set(26 - (y % 5), y + 1, 't');
  // the crown: big round clumps of leaves, lighter on top
  [[23, 14, 14, 11], [11, 18, 9, 8], [35, 18, 9, 8], [17, 8, 9, 7], [30, 9, 9, 7]].forEach(([cx, cy, rx, ry]) => G.ellipse(cx, cy, rx, ry, (x, y) => (y < cy - ry / 3 && noise(x, y) > 0.55 ? 'l' : noise(x, y, 1) < 0.1 ? 'D' : 'L')));
  for (let x = 4; x < 42; x += 1) if (G.get(x, 24) === 'L') G.set(x, 24, 'D');
  // the face in the trunk
  const eyes = i === 0 ? ['tt..tt', '......'] : i === 1 ? ['YY..YY', 'YK..YK'] : ['YY..tt', 'YK....'];
  G.stamp(19, 29, eyes.map((r) => r.replace(/t/g, 'H')));
  G.stamp(20, 34, i ? ['.HHHH.', 'HHrrHH', '.HHHH.'] : ['.HHHH.']);
  // apples and an owl hole
  [[9, 16], [36, 15], [28, 6], [14, 9], [33, 22]].forEach(([x, y]) => G.set(x, y, 'a'));
  G.ellipse(31, 13, 2.5, 3, 'H');
  G.stamp(30, 12, i ? ['YY', 'KK'] : ['..', 'oo']);
  // fireflies
  [[3, 6], [42, 9], [6, 30], [40, 32], [21, 2]].forEach(([x, y], k) => { if ((k + i) % 2 === 0) G.set(x, y, 'y'); });
  return [[0, 0, G.rows(), { L: '#2f9e44', l: '#69db7c', D: '#237032', T: '#8b5a2b', U: '#a0612f', t: '#5c3a1e', H: '#2a1838', Y: '#ffe066', a: '#e03131', o: '#c98a4b', r: '#c92a2a', y: '#d8f5a2' }]];
}

function wreck(i, sea = false) {
  const G = grid(58, 36);
  // the hull, tipped over in the sand
  for (let x = 6; x < 50; x += 1) {
    const top = 18 + Math.round((x - 6) * 0.12) - (x > 40 ? x - 40 : 0) * 0.5;
    const bottom = 30 - Math.round(Math.abs(x - 28) * 0.18);
    for (let y = Math.round(top); y <= bottom; y += 1) G.set(x, y, (y - Math.round(top)) % 4 === 3 ? 'h' : noise(x, y) < 0.08 ? 'h' : 'H');
  }
  G.line(6, 18, 50, 22, 'R', 1);
  [14, 24, 34].forEach((x) => G.ellipse(x, 24, 1.6, 1.6, i && !sea ? 'g' : 'w'));
  // a broken mast and a tattered sail
  G.line(22, 18, 20, 2, 'M', 2).line(36, 20, 40, 9, 'M', 2);
  G.rect(21, 4, 12, 10, 'F');
  [[24, 8], [29, 6], [27, 11], [31, 10], [23, 12]].forEach(([x, y]) => G.rect(x, y, 2, 2, '.'));
  G.line(21, 4, 33, 4, 'M');
  G.stamp(32, 1, ['ff.', 'fff', 'f..']);
  // the ground
  G.ellipse(28, 32, 29, 5, (x, y) => (y < 31 && G.get(x, y) !== '.' ? G.get(x, y) : noise(x, y) < 0.12 ? 'S' : 's'));
  if (sea) {
    // the kraken: tentacles curl round the hull, and a big eye looks out of a hole
    const arm = (pts) => pts.forEach(([x, y], k) => G.ellipse(x, y, k < 3 ? 2.6 : 1.8, k < 3 ? 2.6 : 1.8, 'P'));
    arm([[4, 31], [4, 27], [5, 23], [8, 20], [11, 19], [13, 21]]);
    arm([[53, 31], [54, 26], [52, 21], [49, 17], [46, 15], [44, 17]]);
    arm([[45, 31], [47, 27], [49, 25]]);
    [[4, 28], [5, 24], [53, 26], [51, 21]].forEach(([x, y]) => G.set(x, y, 'p'));
    G.ellipse(41, 25, 4, 3.2, 'w');
    if (i) G.ellipse(41, 25, 3, 2.4, 'Y').rect(40, 23, 2, 5, 'K');
    else G.line(38, 25, 44, 25, 'P');
    // seaweed
    [[2, 33], [56, 33], [18, 33]].forEach(([x, y]) => G.line(x, y, x + 1, y - 6, 'k').line(x + 1, y - 6, x, y - 9, 'k'));
  } else if (i) {
    // ghosts glow in the portholes and the sail shines
    G.rect(21, 4, 12, 10, (x, y, c) => (c === 'F' ? 'G' : c));
    G.stamp(44, 26, ['.c.', '.B.', 'BBB', 'BPB', 'BBB'].map((r) => r));
  }
  const pal = sea
    ? { H: '#5c4d3a', h: '#3d3326', R: '#2b2219', w: '#1a1028', M: '#495057', F: '#96f2d7', f: '#63e6be', s: '#e9c46a', S: '#c9a24a', P: '#9775fa', p: '#e5dbff', Y: '#ffe066', k: '#2f9e44', g: '#b2f2bb', G: '#c3fae8', B: '#69db7c', c: '#a0612f' }
    : { H: '#8b5a2b', h: '#5c3a1e', R: '#3d2a20', w: '#2a1838', M: '#5c3a1e', F: '#f1f3f5', f: '#e03131', s: '#f6e0a3', S: '#e9c46a', g: '#b2f2bb', G: '#c3fae8', B: '#69db7c', P: '#fff3d6', c: '#a0612f' };
  return [[0, 0, G.rows(), pal]];
}

function moonCave(i) {
  const G = grid(56, 34);
  G.ellipse(28, 26, 27, 13, textured('R', 'W', 'r', 0.1));
  G.ellipse(28, 18, 18, 14, textured('R', 'W', 'r', 0.1));
  // craters
  [[8, 26, 3], [47, 27, 4], [38, 9, 2.5], [16, 11, 2]].forEach(([x, y, r]) => G.ellipse(x, y, r, r * 0.6, 'r').ellipse(x, y - 0.5, r - 1, r * 0.4, 'D'));
  // the glowing cave mouth
  G.ellipse(28, 26, 10, 9, 'g').ellipse(28, 27, 8, 8, 'D');
  G.rect(18, 31, 21, 3, (x, y, c) => (c === 'D' || c === 'g' ? 'D' : c));
  // crystals
  [[6, 30], [13, 31], [44, 31], [50, 29]].forEach(([x, y], k) => G.stamp(x, y - 5, k % 2 ? ['.c.', 'cCc', 'cCc', 'cCc', 'ccc'] : ['c.', 'Cc', 'Cc', 'cc']));
  if (i === 0) { G.stamp(24, 26, ['ee..ee']); G.stamp(36, 18, ['zzz', '..z', '.z.', 'zzz']); }
  else G.ellipse(28, 27 - i, 6, 5, 'm').stamp(25, 25 - i, ['WK.WK', '.....', '.pp..']);
  return [[0, 0, G.rows(), { R: '#ced4da', W: '#f1f3f5', r: '#868e96', D: '#1a1028', g: '#74c0fc', c: '#66d9e8', C: '#e3fafc', e: '#868e96', z: '#a5d8ff', m: '#e5dbff', p: '#f783ac' }]];
}

function gatehouse(i) {
  const G = grid(56, 50);
  const stone = (x, y) => (y % 4 === 3 || (x + (Math.floor(y / 4) % 2) * 4) % 8 === 0 ? 's' : noise(x, y) < 0.06 ? 'S' : 'Q');
  G.rect(8, 16, 40, 34, stone);
  // two towers with pointed roofs and flags
  [[0, 10], [42, 10]].forEach(([x, y]) => {
    G.rect(x, y, 14, 40, stone);
    for (let k = 0; k < 14; k += 4) G.rect(x + k, y - 3, 2, 3, stone);
    G.rect(x + 5, y + 8, 3, 6, 'K');
    G.line(x + 7, y - 4, x + 7, y - 9, 'b').stamp(x + 8, y - 9, ['ff', 'fff']);
  });
  for (let k = 14; k < 42; k += 4) G.rect(k, 13, 2, 3, stone);
  // the big arched door
  G.ellipse(28, 30, 10, 9, 'A');
  G.rect(18, 30, 21, 20, 'A');
  G.ellipse(28, 30, 8, 7, 'D');
  G.rect(20, 30, 17, 20, i ? 'x' : 'D');
  if (!i) {
    G.ellipse(28, 30, 8, 7, (x, y, c) => (c === 'D' ? 'D' : c));
    for (let x = 21; x < 36; x += 3) G.line(x, 25, x, 49, 'd');
    G.rect(32, 38, 2, 2, 'g');
    G.stamp(26, 26, ['RR..RR']);
  } else {
    G.ellipse(28, 30, 8, 7, 'x');
    // gold piled up inside, and the baby dragon sitting on it
    G.ellipse(28, 50, 10, 7, (x, y) => (noise(x, y) < 0.3 ? 'G' : noise(x, y, 2) < 0.15 ? 'W' : 'g'));
    G.stamp(23, 30 + (i === 2 ? -1 : 0), ['..L......L', '.LLLLLLLLL.', 'LLeKLLLeKL', 'LLLLLLLLLLL', '.LlllllllL.', '..LLLLLLL']);
    if (i === 2) G.stamp(35, 34, ['ff', '.fy']);
  }
  // gold coins spilling under the door
  [[19, 49], [22, 48], [35, 48], [38, 49], [16, 49], [41, 49]].forEach(([x, y]) => G.rect(x, y, 2, 1, 'G'));
  // torches
  torch(G, 13, 27, i);
  torch(G, 38, 27, i + 1);
  return [[0, 0, G.rows(), { Q: '#adb5bd', S: '#ced4da', s: '#868e96', A: '#6c757d', D: '#8b5a2b', d: '#5c3a1e', x: '#1a1028', K: '#1a1028', R: '#ff6b6b', g: '#fcc419', G: '#ffe066', W: '#ffffff', L: '#69db7c', l: '#2f9e44', e: '#ffffff', b: '#5c3a1e', f: '#e64980', y: '#ffe066', Y: '#ffd43b', r: '#ff922b' }]];
}

function stoneFace(i) {
  const G = grid(50, 52);
  // the rock it stands on
  G.ellipse(25, 48, 24, 5, textured('B', 'b', 'k', 0.15));
  // the head
  G.ellipse(25, 22, 15, 20, textured('S', 'W', 's', 0.1));
  G.rect(12, 22, 26, 22, textured('S', 'W', 's', 0.1));
  G.rect(10, 4, 30, 6, textured('S', 'W', 's', 0.1));
  // brow, deep eyes, a long nose, a stern mouth, glowing cracks
  G.rect(13, 14, 10, 3, 's').rect(27, 14, 10, 3, 's');
  const eye = i ? 'e' : 'k';
  G.rect(15, 18, 6, 4, 'k').rect(29, 18, 6, 4, 'k');
  if (i) { G.rect(16, 19, 4, 2, eye).rect(30, 19, 4, 2, eye); G.set(17, 19, 'E'); G.set(31, 19, 'E'); }
  G.rect(23, 17, 4, 12, 'W').rect(22, 27, 6, 3, 's');
  G.rect(16, 34, 18, i === 2 ? 5 : 2, 'k');
  if (i === 2) G.rect(18, 35, 14, 3, 'e');
  const crack = i ? 'c' : 'C';
  G.line(13, 26, 16, 31, crack).line(36, 8, 33, 12, crack).line(34, 28, 37, 33, crack);
  // moss
  [[11, 6], [14, 5], [36, 5], [39, 7], [12, 40], [37, 41]].forEach(([x, y]) => G.rect(x, y, 3, 2, 'm'));
  // braziers burning each side
  [[1, 32], [44, 32]].forEach(([x, y], k) => { G.stamp(x, y, FLAME[(i + k) % 3]); G.rect(x - 1, y + 4, 7, 2, 'b').rect(x + 1, y + 6, 3, 8, 'b'); });
  return [[i === 2 ? 1 : 0, 0, G.rows(), { S: '#868e96', W: '#adb5bd', s: '#495057', k: '#1a1028', B: '#5c4d3a', b: '#3d3326', e: '#ff6b6b', E: '#ffe066', C: '#6b2a1a', c: '#ff922b', m: '#40c057', y: '#ffe066', Y: '#ffd43b', r: '#e03131' }]];
}

function potOfGold(i) {
  const G = grid(56, 40);
  // a small rainbow climbs out of the pot
  const bands = ['1', '2', '3', '4', '5', '6'];
  bands.forEach((c, k) => {
    const r = 22 - k * 2;
    for (let a = 0; a <= Math.PI; a += 0.02) {
      const x = 22 + Math.cos(a) * r * 1.15;
      const y = 26 - Math.sin(a) * r;
      if (x > 22 || i) G.rect(Math.round(x), Math.round(y), 2, 2, c);
    }
  });
  // coins heaped around
  G.ellipse(28, 37, 26, 3.5, (x, y) => (noise(x, y) < 0.3 ? 'G' : noise(x, y, 3) < 0.1 ? 'W' : 'g'));
  // the big black cauldron, overflowing
  G.ellipse(28, 30, 13, 8, 'B');
  G.rect(14, 21, 28, 3, 'B');
  G.ellipse(28, 21, 12, 3, (x, y) => (noise(x, y) < 0.35 ? 'G' : noise(x, y, 4) < 0.12 ? 'W' : 'g'));
  G.ellipse(28, 18, 8, 3, (x, y) => (noise(x, y) < 0.4 ? 'G' : 'g'));
  G.line(17, 26, 17, 33, 'b').line(19, 27, 19, 31, 'b');
  // sparkles
  [[10, 14], [46, 12], [40, 24], [8, 30], [50, 31]].forEach(([x, y], k) => { if ((k + i) % 2 === 0) G.stamp(x - 1, y - 1, ['.W.', 'WWW', '.W.']); });
  if (i) {
    // the baby unicorn pops up next to the pot
    G.stamp(41, 14 - (i === 2 ? 1 : 0), ['.........y..', '........yW..', '.......WWWW.', '......WWKWWp', '..MNM.WWWWW.', '.MWWWWWWW...', 'MWWWWWWWW...', '.WWWWWWWW...', '.W.W..W.W...', '.h.h..h.h...']);
  }
  return [[0, 0, G.rows(), { 1: '#e03131', 2: '#ff922b', 3: '#ffd43b', 4: '#51cf66', 5: '#339af0', 6: '#cc5de8', G: '#fcc419', g: '#f08c00', W: '#ffffff', B: '#343a40', b: '#868e96', y: '#ffe066', p: '#f783ac', M: '#f783ac', N: '#74c0fc', h: '#b197fc' }]];
}

function starWhale(i) {
  const G = grid(60, 36);
  // a ring of stars it sleeps in
  for (let a = 0; a < Math.PI * 2; a += 0.35) G.stamp(Math.round(30 + Math.cos(a) * 28) - 1, Math.round(19 + Math.sin(a) * 15) - 1, (Math.round(a * 10) % 2) ? ['.y.', 'yYy', '.y.'] : ['Y']);
  // the whale: a big round body, a tail, a fin and star spots
  G.ellipse(28, 20, 20, 9, 'B');
  G.ellipse(26, 25, 16, 4, 'w');
  G.line(46, 18, 53, 12, 'B', 3).stamp(51, 7, ['TT...', 'TTT.T', '.TTTT', '..TT.']);
  G.stamp(24, 25, ['.mmm.', 'mmmmm', '.mmm']);
  [[20, 14], [30, 13], [37, 17], [26, 17], [41, 21]].forEach(([x, y]) => G.set(x, y, 's'));
  for (let x = 14; x < 36; x += 3) G.set(x, 26, 'm');
  if (i) { G.rect(13, 18, 2, 2, 'E'); G.stamp(11, 3 - i, ['y.y.y', '.y.y.', 'y.y.y', '..y..', '..y..', '..y..', '..y..', '..y..'].slice(0, 5 + i * 2)); }
  else G.line(12, 19, 15, 19, 'n');
  G.stamp(10, 21, i ? ['..pp'] : ['....']);
  return [[0, 0, G.rows(), { B: '#5c7cfa', w: '#d0bfff', m: '#3b5bdb', T: '#4c6ef5', s: '#fff3bf', E: '#1a1028', n: '#364fc7', y: '#ffe066', Y: '#fff3bf', p: '#f783ac' }]];
}

/** The landmarks: size and frames(i) giving the layers for frame i: [[x, y, rows, pal]]. */
export const LANDMARKS = {
  'bg-meadow': { w: 46, h: 46, frames: oak },
  'bg-sunset': { w: 58, h: 36, frames: (i) => wreck(i) },
  'bg-ocean': { w: 58, h: 36, frames: (i) => wreck(i, true) },
  'bg-space': { w: 56, h: 34, frames: moonCave },
  'bg-castle': { w: 56, h: 50, frames: gatehouse },
  'bg-volcano': { w: 52, h: 54, frames: stoneFace },
  'bg-rainbow': { w: 56, h: 40, frames: potOfGold },
  'bg-galaxy': { w: 60, h: 36, frames: starWhale },
};
