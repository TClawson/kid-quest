// The kid's garden as it looks from the village: a little fenced plot beside the kid's house
// (where each map puts it: plot in villagemaps.js), with the same six beds and two fruit
// trees as the garden scene (garden.js), drawn small at village pixel size. Each plant shows
// its real stage, droops when its chore was missed, and a grown tree shows its fruit. The
// buddy goes in through the gate at the front, into the garden scene.
//
// The plot is PLOT.w x PLOT.h village pixels from its top left corner (x, y); the trees and the
// tall flowers stand up to PLOT.over pixels above it. paintPlot draws it on the village's land
// canvas (before the season's tint, so it snows on it in winter like everything else).

import { PB, selective } from './meadowart.js';
import { Buf, grid, mix, h2 } from './pixelkit.js';
import { seedById } from './gardenrules.js';

export const PLOT = { w: 56, h: 38, over: 22 };

const Wd = PB.wood; const LF = PB.leaf; const G = PB.grass; const Dt = PB.dirt; const INK = PB.ink;
const SOIL = ['#3a2230', '#4e2c36', '#66403e', '#7e5244', '#9a6a4e'];
const BARK = ['#3a2430', '#5a3634', '#7a4c3c', '#9a6648'];

// bed boxes inside the plot, in the garden's reading order (0 top left, 1 top right, 2 middle left ...)
const BEDS = [0, 1, 2].flatMap((r) => [{ x: 11, y: 6 + r * 10 }, { x: 31, y: 6 + r * 10 }]).map((b) => ({ ...b, w: 14, h: 5 }));
const TREES = [{ x: 5, y: 31 }, { x: 50, y: 31 }];
const GATE = { x: 24, w: 8 };

/** Where the gate is (the middle of its opening) and where the buddy stands outside it. */
export function plotGate(p) {
  return { x: p.x + GATE.x + GATE.w / 2, y: p.y + PLOT.h + 6 };
}

// petal colors [dark, mid, light] and the middle, for each flower
const PETALS = {
  'seed-sunflower': [['#c07a12', '#ffd23f', '#fff4a8'], '#7a4a1e'],
  'seed-tulip': [['#a8304a', '#e0546a', '#ff9a9a'], '#ff9a9a'],
  'seed-daisy': [['#b8aed0', '#f6f2fa', '#ffffff'], '#ffcf3a'],
  'seed-lavender': [['#6a4ab0', '#a07ee0', '#d8c4ff'], '#d8c4ff'],
  'seed-rose': [['#8a1e36', '#d0344e', '#ff8a8a'], '#8a1e36'],
  'seed-poppy': [['#b02a1a', '#f04a2a', '#ff9a7a'], '#2a1838'],
  'seed-hibiscus': [['#c0487a', '#f58cb0', '#ffd2e2'], '#ffd23f'],
  'seed-bluebell': [['#3a5ec0', '#6ea0f0', '#c0dcff'], '#c0dcff'],
  'seed-pansy': [['#5a3aa0', '#9a6ae0', '#ffd23f'], '#ffd23f'],
  'seed-lily': [['#d07aa0', '#fff0f6', '#ffffff'], '#ffb03a'],
};
const FRUIT = { 'seed-apple': ['#c0242a', '#ff6a5a'], 'seed-cherry': ['#7a1030', '#d0304a'], 'seed-orange': ['#d0661a', '#ffa84a'] };
const BLOSSOM = { 'seed-apple': '#ffffff', 'seed-cherry': '#ffb8d0', 'seed-orange': '#fff8e0' };

const dull = (c) => mix(c, '#8a7a5a', 0.35);

/** One bed plant (a flower or vegetable) at stage st, its foot on (x, by) in buffer b. */
function bedPlant(b, seed, st, droopy, x, by) {
  const L = droopy ? LF.map(dull) : LF;
  const put = (xx, yy, c) => b.set(xx, yy, droopy ? dull(c) : c, 'leaf');
  const sprite = (rows, pal) => grid(put, x - Math.floor(rows[0].length / 2), by - rows.length + 1, rows, pal);
  if (st === 0) { put(x, by, L[4]); return; }
  if (st === 1) { sprite(['l.l', '.L.'], { l: L[4], L: L[3] }); return; }
  if (seed.kind === 'flower') {
    const [[d, m, l], mid] = PETALS[seed.id] || PETALS['seed-daisy'];
    const P = { l: L[4], L: L[3], s: L[2], d, m, w: l, c: mid };
    if (st === 2) { sprite(droopy ? ['d..', '.L.', 'lL.', '.L.'] : ['.d.', '.L.', 'lLl', '.L.'], P); return; }
    if (seed.id === 'seed-sunflower') {
      sprite(droopy ? ['mmm..', 'mcm..', '.mL..', '..L..', '.lL..', '..Ll.', '..L..'] : ['.mwm.', 'mcccm', '.mmm.', '..L..', '.lL..', '..Ll.', '..L..'], P);
    } else if (seed.id === 'seed-lavender') {
      sprite(droopy ? ['d..', 'm.d', 'Lm.', '.L.'] : ['w.w', 'm.m', 'dmd', 'L.L', '.L.'], P);
    } else if (seed.id === 'seed-tulip' || seed.id === 'seed-lily') {
      sprite(droopy ? ['mm.', 'dL.', 'lL.', '.L.'] : ['m.m', 'mwm', 'dmd', 'lL.', '.Ll', '.L.'], P);
    } else if (seed.id === 'seed-bluebell') {
      sprite(droopy ? ['.L.', 'm.L', 'd.L', '.lL', '.L.'] : ['.L.', 'L.L', 'm.m', 'd.d', 'lLl', '.L.'], P);
    } else {
      sprite(droopy ? ['wm.', 'mc.', '.L.', 'lL.', '.L.'] : ['.w.', 'mcm', '.d.', 'lLl', '.L.'], P);
    }
    return;
  }
  // vegetables: leaves, then green fruit, then ripe
  const V = { l: L[4], L: L[3], s: L[2] };
  if (seed.id === 'seed-carrot') {
    if (st === 2) sprite(['l.l', 'lLl', '.L.'], V);
    else sprite(droopy ? ['ll..', '.lL.', 'lLl.', '.o.'] : ['l.l.l', '.lLl.', 'lLLLl', '..o..'], { ...V, o: st === 4 ? '#f08c3a' : '#c0581e' });
  } else if (seed.id === 'seed-tomato') {
    const r = st === 4 ? '#e03131' : '#8ac04a'; const R = st === 4 ? '#ff8787' : '#b8e07a';
    if (st === 2) sprite(['lLl', '.L.', 'lL.', '.L.'], V);
    else sprite(droopy ? ['.L..', 'rR..', 'lLr.', 'rLl.', '.L..'] : ['.lLl.', 'rRLrR', 'lLrLl', '.rLr.', '..L..'], { ...V, r, R });
  } else {
    const o = st === 4 ? '#f08c3a' : '#a8c050'; const O = st === 4 ? '#ffc47a' : '#d0e080'; const q = st === 4 ? '#c0581e' : '#6a9040';
    if (st === 2) sprite(['lLl.l', '.LlLl', '..L..'], V);
    else sprite(['l.s..', 'lLoOo', '.oOoo', '.qqqq'].map((row) => (droopy ? row.replace(/l/g, 's') : row)), { ...V, o, O, q });
  }
}

/** A fruit tree at stage st (0 a twig .. 5 grown with fruit), its trunk's foot on (x, by). */
function tree(b, seed, st, droopy, fruit, x, by) {
  const L = droopy ? LF.map(dull) : LF;
  const trunk = [1, 3, 5, 6, 7, 8][st];
  for (let i = 0; i < trunk; i += 1) { b.set(x, by - i, BARK[2], 'wood'); if (st >= 3) b.set(x + 1, by - i, BARK[1], 'wood'); }
  if (st >= 4) { b.set(x - 1, by, BARK[2], 'wood'); b.set(x + 2, by, BARK[1], 'wood'); }
  if (st === 0) { b.set(x, by - 1, L[4], 'leaf'); return; }
  if (st === 1) { b.set(x - 1, by - 3, L[4], 'leaf'); b.set(x + 1, by - 3, L[3], 'leaf'); b.set(x, by - 4, L[4], 'leaf'); return; }
  const r = [0, 0, 3, 4.5, 6, 7][st];
  const cx = x + (st >= 3 ? 1 : 0.5); const cy = by - trunk - r + 2 + (droopy ? 1 : 0);
  const ry = r * 0.85;
  for (let yy = Math.floor(cy - ry - 1); yy <= cy + ry + 1; yy += 1) {
    for (let xx = Math.floor(cx - r - 1); xx <= cx + r + 1; xx += 1) {
      const d = ((xx + 0.5 - cx) / r) ** 2 + ((yy + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      const lit = (cx - (xx + 0.5)) + (cy - (yy + 0.5));
      let c = lit > r * 0.55 ? L[4] : lit < -r * 0.45 ? L[1] : L[2];
      if (c === L[2] && h2(xx, yy, 17) < 0.18) c = L[3];
      b.set(xx, yy, c, 'leaf');
    }
  }
  // blossom when nearly grown, fruit once grown
  const dots = [[-3, -1], [2, -3], [3, 1], [-1, 2], [0, -4], [-4, 2], [4, -1]];
  if (st === 4 && !droopy) dots.slice(0, 5).forEach(([dx, dy]) => b.set(Math.round(cx + dx), Math.round(cy + dy), BLOSSOM[seed.id] || '#ffffff', 'leaf'));
  if (st === 5) {
    const [fd, fl] = FRUIT[seed.id] || FRUIT['seed-apple'];
    dots.slice(0, Math.max(3, Math.min(7, 2 + (fruit || 0)))).forEach(([dx, dy]) => {
      const fx = Math.round(cx + dx); const fy = Math.round(cy + dy);
      b.set(fx, fy, droopy ? dull(fd) : fd, 'leaf'); b.set(fx, fy - 1, droopy ? dull(fl) : fl, 'leaf');
    });
  }
}

/**
 * Paint the kid's plot on the village land. ctx: the land canvas's 2d context; at: { x, y } the
 * plot's top left; garden: { beds: [plant or null] x6, trees: [plant or null] x2 }, each plant
 * { seed (id), stage, droopy, fruit } (as gardenView gives them, see plotPlants). shield: 'bubble'
 * or 'heat' on the maps where the garden scene has a dome over it (SHIELDS in gardenart.js).
 */
export function paintPlot(ctx, at, garden = {}, shield = null) {
  const px = (x, y, c) => { ctx.fillStyle = c; ctx.fillRect(at.x + x, at.y + y, 1, 1); };
  const { w, h } = PLOT;
  // a soft shadow along the front
  for (let x = 1; x < w; x += 1) px(x, h + 1, 'rgba(42,24,56,0.22)');

  // the yard: grass inside a low fence, a dirt path up the middle from the gate
  const yard = new Buf(w, h, 2);
  yard.fill(0, 1, w, h - 1, (x, y) => {
    if (x >= GATE.x + 1 && x < GATE.x + GATE.w - 1 && y > 2) return h2(x, y, 5) < 0.2 ? Dt[2] : Dt[3];
    const n = h2(x, y, 11);
    return n < 0.12 ? G[2] : n > 0.9 ? G[4] : G[3];
  }, 'dirt');
  // the back and side fences: little posts with a rail
  const post = (x, y, tall) => { for (let i = 0; i < tall; i += 1) yard.set(x, y + i, i === 0 ? Wd[5] : Wd[3], 'wood'); };
  for (let x = 0; x < w; x += 1) { yard.set(x, 1, Wd[4], 'wood'); yard.set(x, 2, Wd[2], 'wood'); }
  for (let x = 0; x < w; x += 4) post(x, 0, 4);
  for (let y = 0; y < h; y += 1) { yard.set(0, y, Wd[3], 'wood'); yard.set(w - 1, y, Wd[2], 'wood'); }
  // the beds: a plank frame round dark soil, the front plank showing
  BEDS.forEach((bd) => {
    yard.rect(bd.x, bd.y, bd.w, bd.h, Wd[4], 'wood');
    yard.fill(bd.x + 1, bd.y + 1, bd.w - 2, 2, (x, y) => (y === bd.y + 1 ? SOIL[3] : h2(x, y, 3) < 0.3 ? SOIL[1] : SOIL[2]), 'dirt');
    yard.rect(bd.x, bd.y + 3, bd.w, 1, Wd[3], 'wood');
    yard.rect(bd.x, bd.y + 4, bd.w, 1, Wd[1], 'wood');
  });
  // the tree spots: a ring of soil
  TREES.forEach((t) => { for (let dx = -2; dx <= 3; dx += 1) yard.set(t.x + dx, t.y + 1, SOIL[2], 'dirt'); });

  // the plants, back to front
  (garden.beds || []).forEach((p, i) => {
    const bd = BEDS[i];
    const seed = p && seedById(p.seed);
    if (!bd || !seed) return;
    // a flower or vegetable fills its bed: three of it along the soil
    [3, 7, 11].forEach((dx) => bedPlant(yard, seed, Math.max(0, p.stage | 0), !!p.droopy, bd.x + dx, bd.y + 2));
  });
  (garden.trees || []).forEach((p, i) => {
    const seed = p && seedById(p.seed);
    if (!seed || !TREES[i]) return;
    tree(yard, seed, Math.max(0, Math.min(5, p.stage | 0)), !!p.droopy, p.fruit || 0, TREES[i].x, TREES[i].y);
  });

  // the front fence, open at the gate (its two gate posts a little taller)
  const fy = h - 5;
  for (let x = 0; x < w; x += 1) {
    if (x >= GATE.x && x < GATE.x + GATE.w) continue;
    yard.set(x, fy + 1, Wd[4], 'wood'); yard.set(x, fy + 3, Wd[3], 'wood');
  }
  for (let x = 0; x < w; x += 3) {
    if (x > GATE.x - 2 && x < GATE.x + GATE.w) continue;
    for (let i = 0; i < 5; i += 1) yard.set(x, fy + i, i === 0 ? Wd[5] : i === 4 ? Wd[1] : Wd[3], 'wood');
  }
  for (const gx of [GATE.x - 1, GATE.x + GATE.w]) for (let i = -1; i < 5; i += 1) { yard.set(gx, fy + i, i < 0 ? Wd[5] : Wd[2], 'wood'); }
  yard.outline((tag, side) => (side === 'bottom' ? INK : selective(tag, side)));
  yard.blit(px, 0, 0);
  if (shield) dome(px, shield);
}

/** The see-through dome over the plot (air under the sea and in space, cool air on the volcano). */
function dome(px, kind) {
  const { w, h } = PLOT;
  const cx = w / 2; const cy = h - 1; const rx = w / 2 + 5; const ry = h + 4;
  const [rim, glint, tint] = kind === 'heat' ? ['#ffd8a8', '#fff4e0', 'rgba(255,200,140,0.14)'] : ['#c0ecff', '#ffffff', 'rgba(190,235,255,0.2)'];
  for (let y = Math.floor(cy - ry); y < cy; y += 1) {
    for (let x = Math.floor(cx - rx); x <= cx + rx; x += 1) {
      const d = ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2;
      if (d > 1) continue;
      if (d > 0.9) px(x, y, rim);
      else px(x, y, tint);
    }
  }
  // a shine up the left of the glass
  for (let i = 0; i < 12; i += 1) {
    const a = Math.PI * (0.62 + i * 0.012);
    px(Math.round(cx + Math.cos(a) * (rx - 4)), Math.round(cy - Math.sin(a) * (ry - 4)), glint);
  }
}

/** What paintPlot needs from gardenView's beds and trees (only what changes how it looks). */
export function plotPlants(view) {
  const one = (p) => (p ? { seed: p.seed?.id || p.plot?.seed, stage: p.stage || 0, droopy: !!p.droopy, fruit: p.fruit || 0 } : null);
  return { beds: (view?.beds || []).map(one), trees: (view?.trees || []).map(one) };
}

/** A short key for the plot's look (the village keeps its painted land until this changes). */
export const plotKey = (g) => [...(g?.beds || []), ...(g?.trees || [])].map((p) => (p ? `${p.seed}${p.stage}${p.droopy ? 'd' : ''}${Math.min(5, p.fruit || 0)}` : '-')).join('.');
