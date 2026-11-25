// December in the village (1 to 31 December, Denver): string lights on every house, a wreath on
// every door, a lit tree by the landmark and lanterns along the paths, each map in its own way:
// colored bulbs under the Forest Village's thatch, warm white and red on the fjord's cabins, gold
// on the castle, shell lights at Sunset Beach, glowing pearls (bioluminescent) on the domes under
// the sea, crystal lights on the moon, ember lights and lava-glow lanterns on the volcano, firefly
// lights in the rainforest, candy lights on Rainbow Land, golden stars in the galaxy.
//
// The holiday lights go away in January (the night, nightfx.js, stays all year).
//
//   xmasOn(day)                 December, or a parent's try-out on this device (kidquest.xmas)
//   xmasScene(L, probe, base)   where everything goes, worked out from the painted houses (their
//                               roofs and doors, nightfx.js nightProbe) and the open ground
//   xmasLayer(L, scene, o)      three frames (W x H) of the lights and wreaths on the houses
//   xmasTreeArt(mapId, o) / lanternArt(mapId, o)   the standing things, frame by frame
//   xmasLights(L, scene)        where their light falls at night (nightfx.js nightLand)
//   findSpot(L, x, y, w, h, taken)  open ground near a point, clear of everything the kid needs

import { mix, h2, bayer, inEll, hexRgb } from './pixelkit.js';
import { probeCells, nightColor } from './nightfx.js';
import { spriteOf, R6, lighter, darker, INK } from './xmaskit.js';

// ---------- when ----------

const KEY = 'kidquest.xmas';
/** Are the December decorations up? A parent can try them ('on') or hide them ('off') on this device. */
export function xmasOn(day, storage = globalThis.localStorage) {
  let o = null;
  try { o = storage?.getItem(KEY); } catch { /* no storage */ }
  if (o === 'on') return true;
  if (o === 'off') return false;
  return String(day || '').slice(5, 7) === '12';
}

// ---------- each map's look ----------

export const XMAS = {
  'bg-meadow': { modes: ['eave'], roof: ['thatch'], bulbs: ['#ff5a5a', '#ffd23f', '#58d070', '#5aa8ff', '#ff8ad0'], shape: 'c9', wire: '#2f5a3a', wreath: 'pine', tree: 'pine', lantern: 'post' },
  'bg-fjord': { modes: ['outline', 'eave'], roof: ['roof'], bulbs: ['#fff0b8', '#ff5a5a', '#fff0b8', '#ffc870'], shape: 'c9', wire: '#2a3a4a', wreath: 'pine', tree: 'spruce', lantern: 'ice' },
  'bg-castle': { modes: ['outline'], roof: ['roof'], bulbs: ['#ffd84a', '#ff6a5a', '#ffd84a', '#fff2c0'], shape: 'c9', wire: '#4a3a2a', wreath: 'holly', tree: 'royal', lantern: 'iron' },
  'bg-sunset': { modes: ['eave'], roof: ['thatch'], bulbs: ['#ff9a8a', '#6ae0e0', '#ffe07a', '#ff7ab0'], shape: 'shell', wire: '#6a4a2a', wreath: 'lei', tree: 'palm', lantern: 'tiki' },
  'bg-ocean': { modes: ['ribs', 'eave'], roof: ['glass'], bulbs: ['#7af8ff', '#ff8ae0', '#b8a8ff', '#8affc8'], shape: 'pearl', wire: '#2a6a72', wreath: 'kelp', tree: 'coral', lantern: 'jelly' },
  'bg-space': { modes: ['outline', 'eave'], roof: ['glass'], bulbs: ['#bff4ff', '#e0b8ff', '#ffffff', '#9ae8ff'], shape: 'crystal', wire: '#5a5a7a', wreath: 'tinsel', tree: 'crystal', lantern: 'crystal' },
  'bg-volcano': { modes: ['eave'], roof: ['thatch'], bulbs: ['#ff7a2a', '#ffc840', '#ff4a3a', '#ffe080'], shape: 'flame', wire: '#3a2a2a', wreath: 'lei', tree: 'norfolk', lantern: 'lava' },
  'bg-rainforest': { modes: ['eave'], roof: ['thatch'], bulbs: ['#d8ff6a', '#ffe85a', '#ff8ad8', '#a8ff8a'], shape: 'firefly', wire: '#3a4a2a', wreath: 'leaf', tree: 'fern', lantern: 'paper' },
  'bg-rainbow': { modes: ['eave'], roof: ['cap'], bulbs: ['#ff8ab8', '#7af0c0', '#fff08a', '#c8a8ff', '#8ad0ff'], shape: 'candy', wire: 'candy', wreath: 'candy', tree: 'candy', lantern: 'cane' },
  'bg-galaxy': { modes: ['eave'], roof: ['cap'], bulbs: ['#ffe07a', '#fff8e0', '#d8c0ff', '#ffc84a'], shape: 'star', wire: '#8a6a3a', wreath: 'star', tree: 'nebula', lantern: 'star' },
};
const look = (mapId) => XMAS[mapId] || XMAS['bg-meadow'];

// ---------- open ground ----------

/** Boxes [x, y, w, h] where nothing new may stand: everything the kid walks to or reads. */
export function keepClear(L, { slots = 8 } = {}) {
  const out = [];
  // the villagers' spots (a day has at most six a half, most days four or five: the first ones are kept)
  for (const s of [...L.slots.morning.slice(0, slots), ...L.slots.afternoon.slice(0, slots)]) out.push([s.x - 11, s.y - 34, 22, 40]);
  for (const p of [L.shop, L.chest, L.start, L.coach].filter(Boolean)) out.push([p.x - 13, p.y - 32, 26, 40]);
  for (const k of ['left', 'right']) { const g = L.green[k]; out.push([g.x - 8, g.y - 8, g.w + 16, g.h + 18]); }
  for (const g of L.green.idle || []) out.push([g.x - 9, g.y - 28, 18, 34]);
  for (const k of ['morning', 'afternoon']) { const lb = L.labels?.[k]; if (lb) out.push([lb[0] - 46, lb[1] - 4, 92, 18]); }
  if (L.plot) out.push([L.plot.x - 6, L.plot.y - 18, L.plot.w + 12, L.plot.h + L.plot.fence + 24]);
  for (const h of [L.home, ...L.houses]) out.push([h.x + h.w / 2 - 16, h.y + h.h - 4, 32, 22], [h.x - 4, h.y - 40, h.w + 8, h.h + 40]);
  if (L.landmark) { const m = L.landmark; out.push([m.x - 2, m.y - 2, m.w + 4, m.h + 4]); if (m.stand) out.push([m.stand.x - 12, m.stand.y - 30, 24, 36]); }
  return out;
}
const hit = (a, b) => a[0] < b[0] + b[2] && a[0] + a[2] > b[0] && a[1] < b[1] + b[3] && a[1] + a[3] > b[1];

/**
 * Open ground for something w x h standing with its foot at (x, y), searched outward from
 * (x0, y0) up to `reach` pixels: not on a house, a prop, the water, a path (unless onPath),
 * nor on anything in keepClear(L) or `taken`. Returns { x, y } (its foot) or null.
 */
export function findSpot(L, x0, y0, w, h, taken = [], { reach = 60, onPath = false, clear = keepClear(L) } = {}) {
  const ok = (x, y) => {
    const box = [x - w / 2, y - h, w, h];
    if (box[0] < 24 || box[1] < 24 || box[0] + w > L.W - 24 || y > L.H - 22) return false;
    if (clear.some((c) => hit(box, c)) || taken.some((c) => hit(box, c))) return false;
    for (let yy = box[1]; yy <= y; yy += 3) {
      for (let xx = box[0]; xx <= box[0] + w; xx += 3) {
        if (L.covered(xx, yy) || L.inWater(xx, yy, 3) || L.blocked(xx, yy, 1)) return false;
        if (!onPath && yy > y - 8 && L.onPath(xx, yy, 3)) return false;
      }
    }
    return true;
  };
  for (let r = 0; r <= reach; r += 3) {
    const n = Math.max(1, Math.round((r * Math.PI * 2) / 5));
    for (let k = 0; k < n; k += 1) {
      const a = (k / n) * Math.PI * 2 + r * 0.37;
      const x = Math.round(x0 + Math.cos(a) * r); const y = Math.round(y0 + Math.sin(a) * r * 0.8);
      if (ok(x, y)) return { x, y };
    }
  }
  return null;
}

// ---------- where the lights go ----------

/** The columns of a house's roof (cells with one of `tags`): for each x, its top and its eave. */
function roofOf(probe, base, h, tags) {
  const cells = probeCells(probe, tags, [h.x - 14, h.y - 46, h.w + 28, h.h + 46], base);
  const top = new Map(); const bot = new Map();
  for (const [x, y] of cells) {
    if (y > h.y + h.h - 8) continue;
    top.set(x, Math.min(top.get(x) ?? 1e9, y)); bot.set(x, Math.max(bot.get(x) ?? -1, y));
  }
  const xs = [...top.keys()].sort((a, b) => a - b);
  return { xs, top, bot };
}
const median = (a) => { const s = [...a].sort((p, q) => p - q); return s[Math.floor(s.length / 2)]; };

/** A string that droops between hooks: [{ wire: [[x, y]...], bulbs: [[x, y]...] }]. */
function draped(x0, x1, yAt, every = 10, sag = 2.6) {
  const n = Math.max(1, Math.round((x1 - x0) / every));
  const hooks = Array.from({ length: n + 1 }, (_, i) => Math.round(x0 + ((x1 - x0) * i) / n));
  const wire = []; const bulbs = [];
  for (let i = 1; i < hooks.length; i += 1) {
    const a = hooks[i - 1]; const b = hooks[i]; const ya = yAt(a); const yb = yAt(b);
    const s = Math.min(sag, (b - a) * 0.24);
    for (let x = a; x <= b; x += 1) {
      const t = (x - a) / Math.max(1, b - a);
      const y = Math.round(ya + (yb - ya) * t + s * 4 * t * (1 - t));
      wire.push([x, y]);
      if (x > a && x < b && (x - a) % 3 === 2 && b - x > 1) bulbs.push([x, y + 1]);
    }
  }
  return { wire, bulbs };
}

/**
 * Where every December thing goes in this village. probe: nightProbe() of the land's paint, base:
 * that paint (before the season's tint). Returns { strings, wreaths, tree, lanterns, taken }.
 */
export function xmasScene(L, probe, base, reserved = []) {
  const X = look(L.id);
  const strings = []; const wreaths = [];
  for (const h of [L.home, ...L.houses]) {
    const R = roofOf(probe, base, h, X.roof);
    if (R.xs.length < 10) continue;
    const xL = R.xs[0]; const xR = R.xs[R.xs.length - 1];
    const eave = (x) => { const v = []; for (let k = -3; k <= 3; k += 1) if (R.bot.has(x + k)) v.push(R.bot.get(x + k)); return v.length ? median(v) : h.y + h.h / 2; };
    if (X.modes.includes('eave')) {
      // under a dome or a mushroom cap the string runs along its rim; under thatch, along the hem
      const s = draped(xL + 3, xR - 3, (x) => eave(x) + 1, X.modes.includes('ribs') ? 9 : 10, 2.6);
      strings.push({ ...s, kind: 'eave' });
    }
    if (X.modes.includes('outline')) {
      // bulbs sitting along the roof's top edge, run by run (a castle's three cones are three runs)
      let run = [];
      const flush = () => {
        if (run.length > 6) {
          const bulbs = []; let acc = 0;
          for (let i = 2; i < run.length - 2; i += 1) {
            acc += Math.hypot(1, run[i][1] - run[i - 1][1]);
            if (acc >= 3.4) { acc = 0; bulbs.push([run[i][0], run[i][1] - 1]); }
          }
          strings.push({ wire: [], bulbs, kind: 'outline' });
        }
        run = [];
      };
      for (let x = xL; x <= xR; x += 1) {
        if (!R.top.has(x)) { flush(); continue; }
        // a step of more than 5 rows is a new run (a cone beside a wall)
        if (run.length && Math.abs(R.top.get(x) - run[run.length - 1][1]) > 5) flush();
        run.push([x, R.top.get(x)]);
      }
      flush();
    }
    if (X.modes.includes('ribs')) {
      // strings of glowing pearls from the dome's top down to its rim, like a lit-up tent
      let topY = Infinity; R.xs.forEach((x) => { topY = Math.min(topY, R.top.get(x)); });
      const rim = eave(Math.round((xL + xR) / 2)) - 1; const cx = (xL + xR) / 2; const rx = (xR - xL) / 2 - 2; const ry = rim - topY - 1;
      for (const s of [-0.66, 0, 0.66]) {
        const wire = []; const bulbs = []; let acc = 0; let last = null;
        for (let k = 0; k <= 60; k += 1) {
          const e = (Math.PI / 2) * (1 - k / 60);
          const x = Math.round(cx + rx * Math.cos(e) * s); const y = Math.round(rim - ry * Math.sin(e) + 1);
          if (last && last[0] === x && last[1] === y) continue;
          if (last) acc += Math.hypot(x - last[0], y - last[1]);
          wire.push([x, y]); last = [x, y];
          if (acc >= 4 && k > 3 && k < 58) { acc = 0; bulbs.push([x, y]); }
        }
        strings.push({ wire, bulbs, kind: 'rib', onWire: true });
      }
    }
    // the wreath, on the upper middle of the door
    const door = probeCells(probe, ['door'], [h.x, h.y + h.h * 0.35, h.w, h.h * 0.65 + 2], base);
    if (door.length > 20) {
      let x0 = Infinity; let x1 = -Infinity; let y0 = Infinity;
      for (const [x, y] of door) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); }
      // a door's shape can be odd (a curtain, a round top): its middle column's top
      const mid = Math.round((x0 + x1) / 2);
      const colTop = Math.min(...door.filter(([x]) => Math.abs(x - mid) <= 1).map(([, y]) => y));
      wreaths.push({ x: mid, y: colTop + 7 });
    }
  }
  // the lit tree beside the landmark (or where the landmark stands, before it is found): the open
  // spot nearest its foot, a little way out from it on any side
  const lm = L.landmark;
  const taken = [...reserved];
  const clear = keepClear(L, { slots: 5 });
  let tree = null;
  // a map that names its spots (villagemaps.js xmas, picked by hand) uses them; else the open ground nearest the landmark
  const named = L.xmas || null;
  if (named?.tree) { tree = { x: named.tree[0], y: named.tree[1] }; taken.push([tree.x - 16, tree.y - 46, 32, 50]); } else if (lm) {
    const fx = lm.x + lm.w / 2; const fy = lm.y + lm.h;
    let best = Infinity;
    for (const out of [14, 26, 40, 56]) {
      for (let x = lm.x - out; x <= lm.x + lm.w + out; x += 4) {
        for (let y = lm.y + 30; y <= fy + out; y += 4) {
          if (x > lm.x - out + 3 && x < lm.x + lm.w + out - 3 && y < fy + out - 3 && x > lm.x - 8 && x < lm.x + lm.w + 8 && y < fy) continue;
          const d = Math.hypot((x - fx) * 0.6, y - fy);
          if (d >= best) continue;
          if (findSpot(L, x, y, 26, 44, taken, { reach: 0, clear })) { best = d; tree = { x, y }; }
        }
      }
      if (tree) break;
    }
    // a landmark out in the water (the lighthouse) or hemmed in: the nearest open ground to where the buddy looks at it
    if (!tree && lm.stand) tree = findSpot(L, lm.stand.x, lm.stand.y, 26, 44, taken, { reach: 130, clear });
    // a crowded village (the fjord): wherever there is room
    if (!tree) tree = findSpot(L, L.W / 2, L.H / 2, 26, 44, taken, { reach: 420, clear });
    if (tree) taken.push([tree.x - 16, tree.y - 46, 32, 50]);
  }
  // lanterns along the paths, either side by turns
  const lanterns = named?.lanterns ? named.lanterns.map(([x, y]) => ({ x, y })) : [];
  let side = 1;
  for (const pts of named?.lanterns ? [] : L.paths) {
    let acc = 30;
    for (let i = 1; i < pts.length; i += 1) {
      const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i]; const len = Math.hypot(x1 - x0, y1 - y0);
      const nx = -(y1 - y0) / (len || 1); const ny = (x1 - x0) / (len || 1);
      for (let d = 0; d < len; d += 4) {
        acc += 4;
        if (acc < 66) continue;
        const px = x0 + ((x1 - x0) * d) / len; const py = y0 + ((y1 - y0) * d) / len;
        const at = [11, -11].map((o) => [Math.round(px + nx * o * side), Math.round(py + ny * o * side + (Math.abs(ny) > 0.5 ? 0 : 3))]);
        const spot = at.map(([x, y]) => (lanterns.some((l) => Math.hypot(l.x - x, l.y - y) < 56) ? null : findSpot(L, x, y, 10, 24, taken, { reach: 3, onPath: true, clear }))).find(Boolean);
        if (spot && !L.onPath(spot.x, spot.y, 4)) { lanterns.push(spot); taken.push([spot.x - 6, spot.y - 24, 12, 26]); acc = 0; side = -side; }
      }
    }
  }
  return { strings, wreaths, tree, lanterns: lanterns.slice(0, 8), taken };
}

// ---------- bulbs ----------

// each shape's pixels from the bulb's hang point: [dx, dy, role]; role c = its color, h = lit top,
// d = its shaded foot, s = a socket (the wire's color)
const SHAPES = {
  c9: [[0, 0, 's'], [0, 1, 'h'], [0, 2, 'c']],
  shell: [[0, 0, 's'], [0, 1, 'h'], [1, 1, 'c'], [0, 2, 'c'], [1, 2, 'd']],
  pearl: [[0, 0, 'h'], [1, 0, 'c'], [0, 1, 'c'], [1, 1, 'd']],
  crystal: [[0, 0, 's'], [0, 1, 'h'], [-1, 2, 'c'], [0, 2, 'h'], [1, 2, 'd'], [0, 3, 'c']],
  flame: [[0, 0, 's'], [0, 1, 'h'], [0, 2, 'c'], [0, 3, 'd']],
  firefly: [[0, 0, 's'], [0, 1, 'h'], [0, 2, 'c'], [-1, 1, 'w'], [1, 1, 'w']],
  candy: [[0, 0, 's'], [0, 1, 'h'], [1, 1, 'c'], [0, 2, 'c'], [1, 2, 'd']],
  star: [[0, 0, 's'], [0, 1, 'h'], [-1, 2, 'c'], [0, 2, 'h'], [1, 2, 'c'], [0, 3, 'd']],
};

/**
 * Puts one bulb: put(x, y, color, lit). state 0 dim, 1 on, 2 bright (a twinkle); at night a lit
 * bulb gets a halo of its own color, a pixel all round (solid in-between colors, no blending).
 */
function bulb(put, x, y, c, shape, state, night, wire) {
  const S = SHAPES[shape] || SHAPES.c9;
  const dim = mix(c, '#5a4a6a', night ? 0.5 : 0.3);
  const col = { h: state === 0 ? mix(c, dim, 0.4) : lighter(c, state === 2 ? 0.75 : 0.5), c: state === 0 ? dim : c, d: state === 0 ? darker(dim, 0.25) : mix(c, '#8a3a6a', 0.3), s: wire, w: state === 0 ? null : lighter(c, 0.6) };
  if (night && state > 0) {
    const halo = new Set(S.map(([dx, dy]) => `${dx},${dy}`));
    const ring = [];
    for (const [dx, dy] of S) for (const [ex, ey] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const k = `${dx + ex},${dy + ey}`; if (!halo.has(k) && dy + ey > 0) { halo.add(k); ring.push([dx + ex, dy + ey]); } }
    const hc = mix(c, '#1a1a4a', state === 2 ? 0.38 : 0.55);
    ring.forEach(([dx, dy]) => put(x + dx, y + dy, hc, true));
    if (state === 2) for (const [dx, dy] of [[0, 4], [-2, 2], [2, 2]]) if (!halo.has(`${dx},${dy}`) && (dx + dy + x) % 2 === 0) put(x + dx, y + dy, mix(c, '#1a1a4a', 0.68), true);
  }
  for (const [dx, dy, role] of S) { const cc = col[role]; if (cc) put(x + dx, y + dy, cc, role !== 's'); }
}
const phase = (x, y) => Math.floor(h2(x, y, 77) * 3);

// ---------- the lights and wreaths on the houses ----------

/**
 * Three frames (W x H canvases) of the strings of lights and the wreaths, by day or at night.
 * o: { night }.
 */
export function xmasLayer(L, scene, o = {}) {
  const X = look(L.id);
  const wreathArt = [0, 1, 2].map((f) => wreathOf(X.wreath, { night: o.night ? L.id : null, frame: f }));
  return [0, 1, 2].map((f) => {
    const c = document.createElement('canvas'); c.width = L.W; c.height = L.H;
    const ctx = c.getContext('2d');
    const put = (x, y, col, lit) => { ctx.fillStyle = o.night && !lit ? nightColor(col, L.id) : col; ctx.fillRect(x, y, 1, 1); };
    for (const s of scene.strings) {
      s.wire.forEach(([x, y], i) => put(x, y, X.wire === 'candy' ? (Math.floor(i / 2) % 2 ? '#ffffff' : '#e8405a') : X.wire, false));
      s.bulbs.forEach(([x, y], i) => {
        const col = X.bulbs[i % X.bulbs.length];
        const st = (phase(x, y) + f) % 3;
        bulb(put, x, s.onWire ? y - 1 : y, col, X.shape, st, o.night, X.wire === 'candy' ? '#e8405a' : X.wire);
      });
    }
    for (const w of scene.wreaths) { const a = wreathArt[f]; ctx.drawImage(a, w.x - a.ax, w.y - a.ay); }
    return c;
  });
}

/** Where the December lights throw light at night: [{ x, y, r, ry, i, tint }]. */
export function xmasLights(L, scene) {
  const X = look(L.id);
  const out = [];
  const tintOf = (c) => { const v = hexRgb(c).map((n) => n / 255); const m = Math.max(...v); return v.map((n) => 0.45 + (0.55 * n) / m); };
  for (const s of scene.strings) s.bulbs.forEach(([x, y], i) => { if (i % 2 === 0) out.push({ x, y: y + 3, r: 6, ry: 5, i: 0.42, tint: tintOf(X.bulbs[i % X.bulbs.length]) }); });
  for (const w of scene.wreaths) out.push({ x: w.x, y: w.y + 2, r: 9, ry: 7, i: 0.35, tint: [1, 0.85, 0.6] });
  const avg = X.bulbs.reduce((a, c) => a.map((v, j) => v + tintOf(c)[j] / X.bulbs.length), [0, 0, 0]);
  if (scene.tree) out.push({ x: scene.tree.x, y: scene.tree.y - 8, r: 24, ry: 17, i: 0.95, tint: avg });
  const lt = LANTERN_TINT[X.lantern] || [1, 0.85, 0.6];
  for (const l of scene.lanterns) out.push({ x: l.x, y: l.y - 4, r: 20, ry: 13, i: 0.9, tint: lt });
  return out;
}
const LANTERN_TINT = { jelly: [0.62, 1, 0.98], crystal: [0.78, 0.92, 1], lava: [1, 0.62, 0.36], star: [1, 0.92, 0.6], cane: [1, 0.8, 0.86], ice: [0.92, 0.94, 1], paper: [1, 0.78, 0.56] };

// ---------- wreaths ----------

const WREATH = {
  pine: { ring: ['#1e4a3a', '#2a6a44', '#3a8a4c', '#5aa85a', '#8ccf6a'], bow: '#e03a4a', dots: ['#ff4a5a'], top: null },
  holly: { ring: ['#1a4038', '#245a40', '#2f7a48', '#4a9a52', '#7cc066'], bow: '#f0b830', dots: ['#e83040', '#e83040', '#ffd84a'], top: null },
  lei: { ring: ['#2a6a40', '#3a8a4c', '#4aa050', '#6cc05a', '#9ed46a'], bow: null, dots: ['#ff7ab0', '#ffd84a', '#ffffff', '#ff9a5a'], flowers: true, top: 'starfish' },
  kelp: { ring: ['#1a4a4a', '#28645a', '#3a8068', '#56a078', '#86c090'], bow: null, dots: ['#7af8ff', '#ffd0f0', '#7af8ff'], litDots: true, top: 'starfish' },
  tinsel: { ring: ['#4a4a6e', '#7878a0', '#a8b0d0', '#d0dcf0', '#f4f8ff'], bow: '#c070ff', dots: ['#9ae8ff', '#e0b8ff'], litDots: true, top: 'star' },
  leaf: { ring: ['#1e5a30', '#2e7a3a', '#44a044', '#6cc84a', '#a8e46a'], bow: null, dots: ['#ff5ab0', '#ffe85a'], flowers: true, top: null, bottom: 'orchid' },
  candy: { ring: null, bow: '#ff6aa8', dots: [], candy: true, top: null },
  star: { ring: ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040', '#ffe27a'], bow: null, dots: ['#fff6c8'], litDots: true, top: null, bottom: 'star' },
};

/** A wreath, 11 x 13: a ring with berries or flowers or pearls, and a bow or a starfish or a star. */
export function wreathOf(kind, o = {}) {
  const K = WREATH[kind] || WREATH.pine;
  const f = o.frame || 0;
  return spriteOf(11, 13, (b) => {
    for (let y = 0; y < 11; y += 1) {
      for (let x = 0; x < 11; x += 1) {
        if (!inEll(x, y, 5.5, 5.5, 5.6, 5.6) || inEll(x, y, 5.5, 5.5, 2.4, 2.4)) continue;
        if (K.candy) {
          // a ring of peppermint: red and white stripes going round, a mint candy here and there
          const a = Math.atan2(y + 0.5 - 5.5, x + 0.5 - 5.5);
          const st = Math.floor((a + Math.PI) / (Math.PI / 6)) % 2;
          const lit = x + y < 9;
          b.set(x, y, st ? (lit ? '#ffffff' : '#ecdff0') : (lit ? '#ff5a74' : '#d83a5a'), 'candy');
          continue;
        }
        const light = (x + y) / 20 - (h2(x, y, 41) - 0.5) * 0.5 - (bayer(x, y) - 0.5) * 0.15;
        const k = light < 0.25 ? 4 : light < 0.45 ? 3 : light < 0.68 ? 2 : light < 0.85 ? 1 : 0;
        b.set(x, y, K.ring[k], 'ring');
      }
    }
    if (K.candy) [[1, 4], [8, 2], [7, 8]].forEach(([x, y]) => { b.set(x, y, '#7af0c0', 'candy'); b.set(x + 1, y, '#3ac090', 'candy'); });
    // berries, blossoms or pearls round the ring
    const spots = [[2, 2], [8, 1], [9, 6], [1, 7], [5, 0], [6, 9], [3, 9], [0, 4]];
    spots.forEach(([x, y], i) => {
      if (!K.dots.length) return;
      const c = K.dots[i % K.dots.length];
      const lit = K.litDots && (i + f) % 3 !== 0;
      if (K.flowers) { b.set(x, y, c, 'fl'); b.set(x + 1, y, mix(c, '#8a3a5a', 0.3), 'fl'); b.set(x, y + 1, mix(c, '#8a3a5a', 0.3), 'fl'); b.set(x + 1, y + 1, '#ffe07a', 'fl'); }
      else b.set(x, y, lit ? c : mix(c, '#4a3a5a', 0.3), lit ? 'lit' : 'berry');
    });
    if (K.bow) {
      const B = K.bow; const Bd = mix(B, '#4a1a3a', 0.35); const Bl = lighter(B, 0.35);
      [['ll.c.rr', 'lLLcRRr', '.l.c.r.'], ['..d.d..', '.d...d.']].flat().forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const ch = row[x]; if (ch === '.') continue; b.set(x + 2, y + 8, ch === 'c' ? Bd : ch === 'L' || ch === 'R' ? Bl : ch === 'd' ? Bd : B, 'bow'); } });
    }
    if (K.top === 'starfish') ['..o..', '.oOo.', 'oOOOo', '.o.o.'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(x + 3, y - 1, row[x] === 'O' ? '#ffa860' : '#f07a3a', 'star'); });
    if (K.top === 'star') { const lit = f !== 1; ['.y.', 'yYy', '.y.'].forEach((row, y) => { for (let x = 0; x < 3; x += 1) if (row[x] !== '.') b.set(x + 4, y - 1, row[x] === 'Y' ? '#ffffff' : (lit ? '#ffe27a' : '#d8a830'), 'lit'); }); }
    if (K.bottom === 'star') ['..y..', '.yYy.', 'yYWYy', '.yYy.', '.y.y.'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(x + 3, y + 8, row[x] === 'W' ? '#ffffff' : row[x] === 'Y' ? '#ffe27a' : '#f0b830', 'lit'); });
    if (K.bottom === 'orchid') ['.p.p.', 'pPwPp', '.pPp.'].forEach((row, y) => { for (let x = 0; x < 5; x += 1) if (row[x] !== '.') b.set(x + 3, y + 8, row[x] === 'w' ? '#fff0a0' : row[x] === 'P' ? '#ff8ad8' : '#d84aa8', 'fl'); });
  }, { night: o.night, nightMix: 0.62, ax: 5, ay: 5, noLine: [] });
}

// ---------- the tree by the landmark ----------

const TREES = {
  pine: { G: ['#183a34', '#1e5038', '#2a6a42', '#3c8a4a', '#5aa858', '#8acc6a'], snow: true, pot: 'tub', top: 'star', orn: 'balls', lights: 'map' },
  spruce: { G: ['#14302e', '#1a4436', '#245a3e', '#357848', '#4e9654', '#7cbc66'], snow: 2, pot: 'crate', top: 'straw', orn: 'hearts', lights: 'map' },
  royal: { G: ['#183a34', '#1e5038', '#2a6a42', '#3c8a4a', '#5aa858', '#8acc6a'], snow: true, pot: 'stone', top: 'crown', orn: 'balls', lights: 'map' },
  norfolk: { G: ['#14302a', '#1a4630', '#245e36', '#327a3e', '#4a9848', '#7ab85a'], tiers: 'norfolk', pot: 'basket', top: 'flame', orn: 'flowers', lights: 'map' },
  fern: { G: ['#123a26', '#1a5230', '#246c38', '#348a40', '#50aa48', '#86cc5a'], tiers: 'droop', pot: 'bowl', top: 'bromeliad', orn: 'orchids', lights: 'map' },
  candy: { G: ['#2a8a7a', '#40aa8e', '#5cc8a0', '#80e0b4', '#aaf0c8', '#d8fce4'], tiers: 'frost', pot: 'cupcake', top: 'lolly', orn: 'gumdrops', lights: 'map' },
  nebula: { G: ['#1a1040', '#2a1a68', '#3e2a8e', '#5a3eb0', '#7a5ad0', '#a888ec'], tiers: 'smooth', pot: 'planet', top: 'comet', orn: 'gold', lights: 'map', sparkle: true },
  crystal: { G: ['#3a4a7a', '#4a6a9e', '#6a92c0', '#8ebcdc', '#b8e0f0', '#e4f8ff'], tiers: 'facet', pot: 'crater', top: 'ringstar', orn: 'none', lights: 'map' },
  palm: { special: 'palm' },
  coral: { special: 'coral' },
};

/** The lit tree, about 30 x 48 with its pot and presents, its foot at (ax, ay). o: { night: mapId, frame }. */
export function xmasTreeArt(mapId, o = {}) {
  const X = look(mapId); const T = TREES[X.tree] || TREES.pine;
  const f = o.frame || 0;
  const W = 32; const H = 50;
  const night = o.night ? mapId : null;
  return spriteOf(W, H, (b) => {
    const cx = 15.5;
    const bulbsAt = [];
    if (T.special === 'palm') palmTree(b, cx, bulbsAt);
    else if (T.special === 'coral') coralTree(b, cx, bulbsAt, f);
    else coneTree(b, T, cx, bulbsAt, f);
    // its lights twinkle: each bulb on its own turn
    bulbsAt.forEach(([x, y], i) => {
      const c = X.bulbs[i % X.bulbs.length]; const st = (phase(x, y) + f) % 3;
      const core = st === 0 ? mix(c, '#5a4a6a', 0.35) : st === 2 ? lighter(c, 0.55) : c;
      b.set(x, y, core, 'lit');
      if (st === 2 && night) for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (b.tag(x + dx, y + dy) !== 'lit') b.set(x + dx, y + dy, mix(c, nightColor(b.get(x + dx, y + dy)?.slice(0, 7) || '#203040', mapId), 0.45), 'lit');
    });
    potOf(b, T.pot || 'sand', cx);
    presents(b, mapId);
    toppers(b, T.top || (T.special === 'palm' ? 'starfish' : 'pearl'), cx, f);
  }, { night, nightMix: 0.72, ax: 16, ay: H - 1, ground: 2, noLine: ['fan'] });
}

function coneTree(b, T, cx, bulbsAt, f) {
  const G = T.G;
  const top = 6; const bottom = 38;
  // tiers: each starts narrow under the one above and flares out
  const tiers = T.tiers === 'norfolk' ? [[6, 12, 4], [11, 19, 7], [17, 27, 10], [24, 36, 13]] : [[6, 14, 5], [11, 21, 8], [17, 29, 11], [24, 38, 14]];
  const halfAt = (y) => {
    let best = -1;
    for (const [t0, t1, hw] of tiers) {
      if (y < t0 || y > t1) continue;
      const u = (y - t0) / (t1 - t0);
      let w = 1 + (hw - 1) * u;
      if (T.tiers === 'droop') w = 1 + (hw - 1) * Math.sqrt(u);
      if (T.tiers === 'smooth' || T.tiers === 'facet') w = 1 + ((y - top) / (bottom - top)) * 13;
      best = Math.max(best, w);
    }
    return best;
  };
  for (let y = top; y <= bottom; y += 1) {
    const hw = halfAt(y);
    if (hw < 0) continue;
    for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw - 1); x += 1) {
      const side = (x + 0.5 - cx) / hw; // -1 left (lit) .. 1 right (shade)
      let k = 3 - side * 1.6 + (h2(x, y, 9) - 0.5) * 1.3 + (bayer(x, y) - 0.5) * 0.6;
      // the hem of each tier is darker, needles hang in little points
      const hem = tiers.some(([, t1]) => y === t1 || y === t1 - 1);
      if (hem) k -= 1;
      if (T.tiers === 'facet') { k = 3 - side * 1.4 + (((x + y) % 7 === 0) ? 1.5 : 0) + (Math.floor((y - top) / 8) % 2 ? -0.5 : 0.4); }
      if (T.tiers === 'smooth') k = 3 - side * 1.3 + (vn(x, y) - 0.5) * 1.6;
      if (T.tiers === 'frost') { const band = (y + Math.round(x * 0.5)) % 7; k = 3 - side * 1.2 + (band === 0 ? -1.2 : band === 1 ? 1 : 0); }
      if (y === tiers.find(([, t1]) => y <= t1)?.[1] && (x % 2 === 0) && Math.abs(side) > 0.2) continue;
      b.set(x, y, G[Math.max(0, Math.min(5, Math.round(k)))], 'tree');
    }
  }
  // snow resting on the tiers' shoulders
  if (T.snow) {
    for (const [t0, t1] of tiers) {
      for (let x = Math.floor(cx - 12); x <= cx + 12; x += 1) {
        for (let y = t0; y <= t1; y += 1) {
          if (!b.get(x, y) || b.get(x, y - 1)) continue;
          if (x > cx + 3) continue;
          if (h2(x, y, 3) < (T.snow === 2 ? 0.85 : 0.6)) { b.set(x, y, '#f4f8ff', 'snow'); if (h2(x, y, 4) < 0.5 && b.get(x, y + 1)) b.set(x, y + 1, '#c8d4ee', 'snow'); }
          break;
        }
      }
    }
  }
  if (T.sparkle) for (let i = 0; i < 14; i += 1) { const x = Math.round(cx - 10 + h2(i, 1, 7) * 20); const y = Math.round(10 + h2(i, 2, 7) * 26); if (b.tag(x, y) === 'tree') b.set(x, y, (i + f) % 3 ? '#fff6c8' : '#c8b0ff', 'lit'); }
  if (T.tiers === 'frost') for (let y = top + 2; y < bottom; y += 1) { const x = Math.round(cx - halfAt(y) + 1 + ((y * 3) % Math.max(1, Math.round(halfAt(y) * 2 - 2)))); if (b.tag(x, y) === 'tree' && y % 3 === 0) b.set(x, y, '#ffffff', 'tree'); }
  // a spiral of lights, and ornaments between
  for (let i = 0; i < 26; i += 1) {
    const t = i / 26; const y = Math.round(top + 4 + t * (bottom - top - 5));
    const hw = halfAt(y); if (hw < 2) continue;
    const x = Math.round(cx + Math.sin(t * Math.PI * 7) * (hw - 1.5));
    if (b.get(x, y)) bulbsAt.push([x, y]);
  }
  const orn = T.orn;
  const ORN = { balls: ['#e8404a', '#f0c040', '#4a8ae8'], hearts: ['#e8404a', '#ffffff'], flowers: ['#ff7ab0', '#ffd84a', '#ffffff'], orchids: ['#ff5ab0', '#c070ff'], gumdrops: ['#ff6aa8', '#ffd84a', '#8a6aff', '#ff8a3a'], gold: ['#ffd84a', '#f0a830'] }[orn];
  if (ORN) {
    const at = [[-5, 18], [4, 15], [-8, 27], [1, 24], [8, 26], [-3, 33], [6, 34], [-11, 35], [11, 36], [0, 11]];
    at.forEach(([dx, y], i) => {
      const x = Math.round(cx + dx - 0.5); if (b.tag(x, y) !== 'tree' || b.tag(x + 1, y + 1) !== 'tree') return;
      const c = ORN[i % ORN.length];
      if (orn === 'hearts') { b.set(x, y, c, 'orn'); b.set(x + 1, y, c, 'orn'); b.set(x, y + 1, mix(c, '#5a1a3a', 0.3), 'orn'); return; }
      b.set(x, y, lighter(c, 0.5), 'orn'); b.set(x + 1, y, c, 'orn'); b.set(x, y + 1, c, 'orn'); b.set(x + 1, y + 1, mix(c, '#3a1a4a', 0.4), 'orn');
    });
  }
  // the trunk
  for (let y = bottom + 1; y <= 41; y += 1) for (let x = Math.round(cx) - 2; x <= Math.round(cx) + 1; x += 1) b.set(x, y, x < cx ? '#8a5a3a' : '#6a3e2e', 'trunk');
}
const vn = (x, y) => (h2(Math.floor(x / 3), Math.floor(y / 3), 5) + h2(x, y, 6)) / 2;

function palmTree(b, cx, bulbsAt) {
  // a curving palm trunk wrapped round with lights, fronds on top hung with baubles
  for (let y = 12; y <= 41; y += 1) {
    const x0 = Math.round(cx - 1 + Math.sin((41 - y) / 12) * 3);
    const ring = y % 3 === 0;
    for (let x = x0 - 1; x <= x0 + 1; x += 1) b.set(x, y, ring ? '#8a5a3a' : x === x0 - 1 ? '#c8945a' : x === x0 ? '#a8743e' : '#7a4a30', 'trunk');
    if (y % 4 === 1) bulbsAt.push([x0 + (y % 8 === 1 ? -1 : 1), y]);
  }
  const tx = Math.round(cx - 1 + Math.sin(29 / 12) * 3); const ty = 12;
  const fronds = [[-1, -0.35], [1, -0.35], [-1, 0.25], [1, 0.25], [-0.4, -0.9], [0.45, -0.85]];
  fronds.forEach(([dx, dy], k) => {
    for (let s = 0; s < 13; s += 1) {
      const x = Math.round(tx + dx * s); const y = Math.round(ty + dy * s + (s * s) / 22);
      const G = ['#245a3a', '#2f7a44', '#45984a', '#68b85a', '#9ad46a'];
      b.set(x, y, G[s < 4 ? 3 : 2], 'leaf'); b.set(x, y + 1, G[1], 'leaf');
      if (s > 2 && s % 2 === 0) { b.set(x, y - 1, G[4], 'leaf'); b.set(x, y + 2, G[0], 'leaf'); }
      if (s === 11 && k < 4) { b.set(x, y + 3, ['#e8404a', '#40c0d0', '#f0c040', '#ff7ab0'][k], 'orn'); b.set(x, y + 4, mix(['#e8404a', '#40c0d0', '#f0c040', '#ff7ab0'][k], '#3a1a4a', 0.35), 'orn'); }
      if (s === 7) bulbsAt.push([x, y + 2]);
    }
  });
  [[-1, 0], [1, 0], [0, 1]].forEach(([dx, dy]) => b.set(tx + dx, ty + 2 + dy, '#6a4a2a', 'nut'));
}

function coralTree(b, cx, bulbsAt, f) {
  // a pink fan coral grown into a cone, glowing pearls in its branches and a jellyfish bauble
  const C = ['#7a2a5a', '#a83a6e', '#d8587e', '#f07a92', '#ffa8b0', '#ffd4d0'];
  const branch = (x0, y0, ang, len, depth) => {
    let x = x0; let y = y0;
    for (let s = 0; s < len; s += 1) {
      x += Math.cos(ang) * 0.9; y += Math.sin(ang) * 0.9;
      const xi = Math.round(x); const yi = Math.round(y);
      b.set(xi, yi, C[Math.max(1, 4 - depth - (xi > cx ? 1 : 0))], 'coral');
      if (depth < 2 && s > 1) b.set(xi + (xi > cx ? 1 : -1), yi, C[2 - (xi > cx ? 1 : 0) + 1], 'coral');
    }
    if (depth < 3) { branch(x, y, ang - 0.5, len * 0.62, depth + 1); branch(x, y, ang + 0.5, len * 0.62, depth + 1); }
    else bulbsAt.push([Math.round(x), Math.round(y)]);
  };
  // behind the branches, a sea fan: a fine lattice filling the tree's cone, purple in its shade
  for (let y = 6; y <= 38; y += 1) {
    const half = (y - 4) * 0.42 + Math.sin(y * 0.9) * 0.8;
    const x0 = Math.round(cx - half); const x1 = Math.round(cx + half);
    for (let x = x0; x <= x1; x += 1) {
      const u = x - cx;
      const mesh = (x + y) % 4 === 0 || (x - y + 400) % 4 === 0;
      if (mesh || x === x0 || x === x1) b.set(x, y, u > 2 ? '#a8487e' : u > -3 ? '#c45a88' : '#dc7898', 'fan');
    }
  }
  for (let x = Math.round(cx) - 1; x <= Math.round(cx) + 1; x += 1) for (let y = 30; y <= 41; y += 1) b.set(x, y, x <= cx ? C[3] : C[2], 'coral');
  branch(cx, 31, -Math.PI / 2, 12, 0);
  branch(cx - 1, 38, -Math.PI / 2 - 0.95, 8, 1);
  branch(cx + 1, 38, -Math.PI / 2 + 0.95, 8, 1);
  // strings of pearls draped across it, glowing faintly
  for (const [y0, w] of [[14, 5], [22, 8], [30, 11]]) for (let x = -w; x <= w; x += 2) {
    const y = y0 + Math.round((1 - (x / w) ** 2) * 2) + Math.round(x * 0.15);
    b.set(Math.round(cx) + x, y, (x + f) % 3 ? '#fff4f0' : '#ffd8f0', 'lit');
  }
  // a jellyfish bauble bobbing on a branch
  const jy = 22 + (f === 1 ? 1 : 0);
  ['.jj.', 'jJJj', 'j..j', '.l.l', 'l.l.'].forEach((row, y) => { for (let x = 0; x < 4; x += 1) if (row[x] !== '.') b.set(Math.round(cx) + 4 + x, jy + y, row[x] === 'J' ? '#f0d8ff' : row[x] === 'l' ? '#b8a0f0' : '#c8a8ff', 'lit'); });
}

function potOf(b, kind, cx) {
  const X0 = Math.round(cx) - 6;
  const P = {
    tub: ['#6a3e2e', '#8a5a3a', '#b07a48', '#d4a066'], crate: ['#5a3a2e', '#7a5038', '#a07048', '#c89a64'], stone: ['#4a4560', '#6e6a86', '#9894aa', '#c0bcc8'],
    basket: ['#6a4a2a', '#8a6a3a', '#b08a4a', '#d4b070'], bowl: ['#4a2a1e', '#6a3e2a', '#8a5a3a', '#b07a48'], cupcake: ['#c84a7a', '#e870a0', '#ff9ac0', '#ffd0e0'],
    planet: ['#7a4a1e', '#a8701e', '#d89a2a', '#f0c040'], crater: ['#4a4a6a', '#6a6a8a', '#8a8aa8', '#b0b0c8'], sand: ['#a8846c', '#cfae88', '#e6cfa8', '#f6e8c8'], clam: ['#8a6aa0', '#b090c8', '#d8b8e8', '#f4e4ff'],
  }[kind] || ['#6a3e2e', '#8a5a3a', '#b07a48', '#d4a066'];
  for (let y = 41; y <= 47; y += 1) {
    const inset = kind === 'cupcake' || kind === 'bowl' || kind === 'tub' ? Math.floor((y - 41) / 3) : 0;
    for (let x = X0 + inset; x <= X0 + 12 - inset; x += 1) {
      let k = x < X0 + 4 ? 3 : x < X0 + 9 ? 2 : 1;
      if (y === 41) k = 3;
      if (kind === 'cupcake' && (x - X0) % 2 === 0) k -= 1;
      if ((kind === 'crate' || kind === 'basket') && (y === 44 || (x - X0) % 4 === 0)) k -= 1;
      if (kind === 'tub' && y === 44) { b.set(x, y, '#e03a4a', 'ribbon'); continue; }
      if (kind === 'stone' && (y === 44 || (x + (y > 44 ? 2 : 0)) % 5 === 0)) k = 0;
      b.set(x, y, P[Math.max(0, k)], 'pot');
    }
  }
}

function presents(b, mapId) {
  const sets = { 'bg-ocean': [['#40c0d0', '#ffffff'], ['#ff8ae0', '#ffd84a']], 'bg-space': [['#9ae8ff', '#c070ff'], ['#ffffff', '#ff5a8a']], 'bg-rainbow': [['#ff8ab8', '#7af0c0'], ['#fff08a', '#c070ff']], 'bg-galaxy': [['#5a3eb0', '#ffd84a'], ['#ffd84a', '#ffffff']] };
  const [[a, ar], [c, cr]] = sets[mapId] || [['#e8404a', '#ffd84a'], ['#3a8ae0', '#ffffff']];
  const box = (x0, y0, w, h, col, rib) => {
    for (let y = 0; y < h; y += 1) for (let x = 0; x < w; x += 1) b.set(x0 + x, y0 + y, x === Math.floor(w / 2) || y === 1 ? rib : (x < w / 2 ? lighter(col, 0.15) : col), 'gift');
    b.set(x0 + Math.floor(w / 2) - 1, y0 - 1, rib, 'gift'); b.set(x0 + Math.floor(w / 2) + 1, y0 - 1, rib, 'gift');
  };
  box(2, 43, 7, 5, a, ar);
  box(23, 44, 6, 4, c, cr);
}

function toppers(b, kind, cx, f) {
  const x0 = Math.round(cx) - 2; const tw = f === 2;
  const put = (rows, pal, X = x0, Y = 0) => rows.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const ch = row[x]; if (pal[ch]) b.set(X + x, Y + y, pal[ch], 'lit'); } });
  if (kind === 'star' || kind === 'straw') {
    const pal = kind === 'straw' ? { y: '#f0c870', Y: '#fff0b0', W: '#fffbe0', s: '#ffe8a0' } : { y: '#f0b830', Y: '#ffe27a', W: '#ffffff', s: '#fff6c8' };
    put([tw ? '..s..' : '.....', '..y..', '.yYy.', 'yYWYy', '.yYy.', '.y.y.'], pal, x0, -1);
    if (tw) { b.set(x0 - 1, 2, pal.s, 'lit'); b.set(x0 + 5, 2, pal.s, 'lit'); }
  } else if (kind === 'crown') put(['y.y.y', 'yYyYy', 'yrYby', 'yyyyy'], { y: '#f0b830', Y: '#ffe27a', r: '#ff4a5a', b: '#4a8ae8' }, x0, 1);
  else if (kind === 'flame') put(['..o..', '.oyo.', '.yWy.', '.oyo.'], { o: '#ff6a2a', y: '#ffc840', W: '#fff8d0' }, x0, tw ? 1 : 2);
  else if (kind === 'bromeliad') put(['r.r.r', '.rRr.', 'rRYRr', '.gGg.'], { r: '#e8404a', R: '#ff7a6a', Y: '#ffe85a', g: '#2f7a44', G: '#5ab85a' }, x0, 2);
  else if (kind === 'lolly') { put(['.pwp.', 'pwpwp', 'wpWpw', 'pwpwp', '.pwp.'], { p: '#ff6aa8', w: '#ffffff', W: tw ? '#ffffff' : '#ffd0e4' }, x0, 0); b.set(x0 + 2, 5, '#ffffff', 'stick'); }
  else if (kind === 'comet') { put(['....yY', '...yWy', 'ccyYy.', 'c.c...'], { y: '#f0c040', Y: '#ffe27a', W: '#ffffff', c: tw ? '#e0d0ff' : '#a888ec' }, x0 - 2, 1); }
  else if (kind === 'ringstar') put(['..w..', 'r.W.r', '.rwr.', '..r..'], { w: '#e4f8ff', W: '#ffffff', r: tw ? '#f0d0ff' : '#c8a0ff' }, x0, 2);
  else if (kind === 'starfish') put(['..o..', 'ooOoo', '.oOo.', 'o...o'], { o: '#ff8a4a', O: '#ffc080' }, x0, 6);
  else if (kind === 'pearl') put(['.ww.', 'wWWw', '.ww.'], { w: '#c8f8ff', W: tw ? '#ffffff' : '#e8ffff' }, x0 + 1, 7);
}

// ---------- lanterns along the paths ----------

/** A path lantern, 11 x 24, its foot at (ax, ay). o: { night: mapId, frame }. */
export function lanternArt(mapId, o = {}) {
  const kind = look(mapId).lantern; const f = o.frame || 0;
  const flick = [0, 1, 0][f];
  const glow = (c, d) => (f === 1 ? lighter(c, 0.25) : c) || d;
  const night = o.night ? mapId : null;
  return spriteOf(11, 24, (b) => {
    const post = (c1, c2, y0 = 8) => { for (let y = y0; y < 24; y += 1) { b.set(5, y, c1, 'post'); b.set(6, y, c2, 'post'); } };
    const put = (rows, pal, X, Y, lit = '') => rows.forEach((row, y) => { for (let x = 0; x < row.length; x += 1) { const ch = row[x]; if (pal[ch]) b.set(X + x, Y + y, pal[ch], lit.includes(ch) ? 'lit' : 'lamp'); } });
    if (kind === 'post' || kind === 'iron' || kind === 'ice') {
      // a candle lantern on a post: a snowy cap, a red bow (a garland round the post on the meadow)
      const wood = kind === 'iron' ? ['#3a3650', '#5a5670'] : ['#8a5a3a', '#b07a48'];
      for (let y = 11; y < 24; y += 1) { b.set(4, y, wood[1], 'post'); b.set(5, y, wood[0], 'post'); }
      const m = kind === 'iron' ? { m: '#3a3650', M: '#6e6a86', k: '#2a2640' } : kind === 'ice' ? { m: '#8ab0d8', M: '#d8ecff', k: '#6a90c0' } : { m: '#5a4a5a', M: '#8a7a8a', k: '#3a2a3a' };
      put(['..sss..', '.sSSSs.', '.mMMMm.', 'mmmmmmm', 'm.lyl.m', 'm.yYy.m', 'm.oyo.m', 'mkkkkkm', '..kmk..'], { ...m, s: '#ffffff', S: '#e4ecfa', l: glow('#fff4c8'), y: glow('#ffd878'), Y: flick ? '#ffffff' : '#fff4c8', o: '#f0a848' }, 1, 1, 'lyYo');
      if (kind !== 'iron') put(['rr.rr', '.rRr.', 'r.r.r'], { r: '#d8303a', R: '#ff6a6a' }, 2, 10);
      else put(['.y.', 'yYy'], { y: '#d89a2a', Y: '#ffe27a' }, 3, 10);
      if (kind === 'post') [[3, 14], [6, 16], [3, 18], [6, 20]].forEach(([x, y], i) => { b.set(x, y, '#2a6a44', 'leaf'); b.set(x, y + 1, '#3a8a4c', 'leaf'); if (i % 2) b.set(x, y - 1, '#e8404a', 'berry'); });
      if (kind === 'ice') [[1, 20], [7, 21]].forEach(([x, y]) => { b.set(x, y, '#ffffff', 'snow'); b.set(x + 1, y, '#e4ecfa', 'snow'); });
    } else if (kind === 'tiki') {
      post('#a8743e', '#7a4a30', 9);
      put(['..y..', '.yWy.', '.oyo.', '.ooo.', 'bbbbb', 'bBbBb', '.bbb.'], { y: glow('#ffd84a'), W: flick ? '#ffffff' : '#fff4c8', o: '#ff7a2a', b: '#8a5a3a', B: '#c8945a' }, 3, 2 - flick, 'yWo');
      put(['p.c.y'], { p: '#ff9a8a', c: '#6ae0e0', y: '#ffe07a' }, 3, 12, 'pcy');
    } else if (kind === 'jelly') {
      // a glowing jellyfish lamp on a kelp stalk
      for (let y = 9; y < 24; y += 1) b.set(5 + (Math.floor(y / 3) % 2), y, y % 2 ? '#3a8068' : '#56a078', 'kelp');
      put(['..jjj..', '.jJJJj.', 'jJWJJJj', 'jjjjjjj', '.l.l.l.', 'l.l.l..'], { j: glow('#9af0ff'), J: '#d0fcff', W: '#ffffff', l: '#7ad8f0' }, 2, 2 + flick, 'jJWl');
    } else if (kind === 'crystal') {
      put(['...c...', '..cCc..', '.cCWCc.', '.cCCCd.', '..cCd..', '..cdd..'], { c: glow('#9ae8ff'), C: '#d8f8ff', W: '#ffffff', d: '#6ab8e0' }, 2, 6, 'cCWd');
      put(['.mmmmm.', 'mMMMMMm', '.mmmmm.'], { m: '#5a5a7a', M: '#8a8aa8' }, 2, 12);
      post('#6a6a8a', '#4a4a6a', 15);
    } else if (kind === 'lava') {
      // a little stone lantern with lava glowing inside
      put(['.sssss.', 'sSSSSSs', '..s.s..'], { s: '#4a3a3a', S: '#6a5a58' }, 2, 6);
      put(['.s.s.', 'syoys', 'soOos', 'syoys'], { s: '#4a3a3a', y: glow('#ffc840'), o: '#ff7a2a', O: flick ? '#fff0a0' : '#ffe080' }, 3, 9, 'yoO');
      put(['sssssss', '.sSSSs.', '.sSSSs.', '.sSSSs.', 'sssssss'], { s: '#3a2a2a', S: '#5a4a48' }, 2, 13);
      post('#4a3a3a', '#3a2a2a', 18);
    } else if (kind === 'paper') {
      for (let y = 4; y < 24; y += 1) { b.set(5, y, y % 4 === 0 ? '#8a9a4a' : '#b8c86a', 'bamboo'); }
      put(['..rrr..', '.rRRRr.', 'rRyYyRr', 'rRyYyRr', '.rRRRr.', '..rrr..', '...t...'], { r: '#d8402a', R: glow('#ff6a3a'), y: '#ffc060', Y: flick ? '#fff0b0' : '#ffe080', t: '#ffd84a' }, 2, 5, 'RyYrt');
    } else if (kind === 'cane') {
      // a candy-cane lamp post with a gumdrop light
      for (let y = 8; y < 24; y += 1) { const red = (y + 1) % 4 < 2; b.set(5, y, red ? '#e8405a' : '#ffffff', 'cane'); b.set(6, y, red ? '#c02a4a' : '#e8dcf0', 'cane'); }
      put(['.cc.', 'c..c', 'c...'], { c: '#e8405a' }, 5, 4);
      put(['.gg.', 'gGGg', 'gggg'], { g: glow('#ff8ab8'), G: flick ? '#ffffff' : '#ffd0e4' }, 3, 7, 'gG');
    } else if (kind === 'star') {
      post('#d89a2a', '#a8701e', 9);
      put(['...y...', '..yYy..', 'yyYWYyy', '.yYYYy.', '.yy.yy.', 'y.....y'], { y: glow('#ffd84a'), Y: '#fff0a0', W: '#ffffff' }, 2, 2 - flick, 'yYW');
    }
    // a little snow on the ground at its foot, and its foot
  }, { night, nightMix: 0.8, ax: 5, ay: 23, ground: 1 });
}

/** The tint a map's lantern gives (for a pool of light under one drawn elsewhere). */
export const lanternTint = (mapId) => LANTERN_TINT[look(mapId).lantern] || [1, 0.85, 0.6];
export { INK };
