// Paints the Forest Village quest map: a 16-bit top-down scene behind the stops.
// The stops, labels and buddy stay as HTML on top; this only draws the land on a <canvas>.
// One art pixel is SCALE screen pixels, so the scene stays chunky at any screen size.

const SCALE = 4;
const OUT = '#2a1838';

const GRASS = '#5cbd52';
const GRASS_DARK = '#4aa842';
const GRASS_LIGHT = '#7bd66b';
const ROAD_EDGE = '#a4743f';
const ROAD = '#d9a86c';
const ROAD_WALKED = '#ecc78f';
const WATER = '#2b8adf';
const WATER_DEEP = '#1f6fc0';
const WATER_SHINE = '#9fd0ff';
const BANK = '#3c9a3c';

const TREE = ['..KKKK..', '.KGGGgK.', 'KGgGGGGK', 'KGGGGgGK', 'KgGGGGdK', '.KdGGdK.', '..KKKK..', '...TT...', '...TT...'];
const TREE_PAL = { G: '#3c9a3c', g: '#6ccf5f', d: '#256b2b', T: '#7a4a26' };
const BUSH = ['.KKK.', 'KgGGK', 'KGGdK', '.KKK.'];
const ROCK = ['.KKK.', 'KLLLK', 'KLdLK', '.KKK.'];
const ROCK_PAL = { L: '#adb5bd', d: '#868e96' };
const HOUSE = [
  '...KKKK...',
  '..KRRRRK..',
  '.KRrRRRRK.',
  'KRRRRRRRRK',
  'KKKKKKKKKK',
  '.KWWWWWWK.',
  '.KWBWWDWK.',
  '.KWWWWDWK.',
  '.KKKKKKKK.',
];
const FLOWERS = ['#ff8fa3', '#ffd43b', '#ffffff', '#b197fc'];

/** Small seeded random so a kid's map looks the same every time. */
function seeded(text) {
  let s = 7;
  for (const ch of String(text)) s = (s * 31 + ch.charCodeAt(0)) % 2147483647;
  if (s <= 0) s = 7;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function painter(ctx, w, h) {
  const px = (x, y, c, ww = 1, hh = 1) => {
    ctx.fillStyle = c;
    ctx.fillRect(Math.round(x), Math.round(y), ww, hh);
  };
  const sprite = (x0, y0, rows, pal) => rows.forEach((r, y) => {
    for (let x = 0; x < r.length; x += 1) {
      const ch = r[x];
      if (ch === '.') continue;
      const c = ch === 'K' ? OUT : pal[ch];
      if (c) px(x0 + x, y0 + y, c);
    }
  });
  return { px, sprite, w, h };
}

/** The road follows the same curves as the stops: a cubic between each pair of points. */
function roadSamples(pts) {
  const out = [];
  for (let i = 1; i < pts.length; i += 1) {
    const q = pts[i - 1];
    const p = pts[i];
    const my = (q.y + p.y) / 2;
    const n = Math.max(8, Math.ceil(Math.abs(p.y - q.y) + Math.abs(p.x - q.x)));
    for (let s = 0; s <= n; s += 1) {
      const t = s / n;
      const u = 1 - t;
      const x = u * u * u * q.x + 3 * u * u * t * q.x + 3 * u * t * t * p.x + t * t * t * p.x;
      const y = u * u * u * q.y + 3 * u * u * t * my + 3 * u * t * t * my + t * t * t * p.y;
      out.push({ x, y, seg: i });
    }
  }
  return out;
}

const timers = new WeakMap();

/**
 * Paint every quest map inside root. Each .quest-map carries its stops as data:
 * data-pts: [[xPercent, yPx, kind], ...], data-here: index of the buddy's stop,
 * data-river: y in px of the river (or empty), data-seed: text for the random layout.
 */
export function paintQuestMaps(root = document) {
  root.querySelectorAll('.quest-map[data-pts]').forEach(paintOne);
}

function paintOne(section) {
  const canvas = section.querySelector('canvas.map-land');
  if (!canvas) return;
  const W = section.clientWidth;
  const H = section.clientHeight;
  if (!W || !H) return;
  const aw = Math.ceil(W / SCALE);
  const ah = Math.ceil(H / SCALE);
  canvas.width = aw;
  canvas.height = ah;
  canvas.style.width = `${aw * SCALE}px`;
  canvas.style.height = `${ah * SCALE}px`;
  const ctx = canvas.getContext('2d');
  const { px, sprite } = painter(ctx, aw, ah);
  const rnd = seeded(section.dataset.seed || 'map');

  const stops = JSON.parse(section.dataset.pts).map(([x, y, kind]) => ({ x: (x / 100) * aw, y: y / SCALE, kind }));
  const here = Number(section.dataset.here) || 0;
  const riverY = section.dataset.river ? Number(section.dataset.river) / SCALE : null;
  const road = roadSamples([{ x: aw / 2, y: 0 }, ...stops]);
  const nearRoad = (x, y, d) => road.some((r) => Math.abs(r.x - x) < d && Math.abs(r.y - y) < d);
  const wall = Math.min(20, Math.floor(aw * 0.12));

  // grass with darker and lighter tufts
  px(0, 0, GRASS, aw, ah);
  const tufts = Math.floor((aw * ah) / 60);
  for (let i = 0; i < tufts; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    px(x, y, GRASS_DARK, 2, 1);
    px(x + 1, y - 1, GRASS_LIGHT);
  }

  // forest walls down both sides
  for (let y = -6, row = 0; y < ah; y += 7, row += 1) {
    const jig = row % 2 ? 2 : 0;
    sprite(-4 + jig, y, TREE, TREE_PAL);
    sprite(wall - 9 - jig, y + 3, TREE, TREE_PAL);
    sprite(aw - 4 - jig, y, TREE, TREE_PAL);
    sprite(aw - wall + 1 + jig, y + 3, TREE, TREE_PAL);
  }

  // a few trees and bushes in the open, away from the road
  const open = (x, y, r) => x > wall + 2 && x < aw - wall - 8 && !nearRoad(x + 4, y + 4, r);
  // more scenery on wide screens, where there is lots of open grass
  const clumps = Math.floor((ah * Math.max(1, aw - 2 * wall)) / 900);
  for (let i = 0; i < clumps; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(20 + rnd() * (ah - 40));
    if (!open(x, y, 14)) continue;
    sprite(x, y, i % 3 ? BUSH : TREE, TREE_PAL);
    if (i % 3 === 0 && open(x + 7, y + 4, 14)) sprite(x + 7, y + 4, TREE, TREE_PAL);
  }
  for (let i = 0; i < Math.floor(ah / 30); i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    if (open(x, y, 10)) sprite(x, y, ROCK, ROCK_PAL);
  }

  // the river cuts through everything except the road (the bridge takes the road across)
  let band = null;
  if (riverY !== null) band = drawRiver(ctx, px, aw, riverY, road);

  // the dirt road: edge, then fill; the part already walked is lighter
  const hereY = stops[here]?.y ?? 0;
  for (const [size, color] of [[9, ROAD_EDGE], [7, ROAD]]) {
    for (const r of road) {
      if (band && r.y > band.top && r.y < band.bottom) continue;
      px(r.x - (size >> 1), r.y - (size >> 1), color, size, size);
    }
  }
  for (const r of road) {
    if (r.y > hereY || (band && r.y > band.top && r.y < band.bottom)) continue;
    px(r.x - 2, r.y - 2, ROAD_WALKED, 5, 5);
  }
  // pebbles along the road
  for (let i = 0; i < road.length; i += 7) {
    const r = road[i];
    if (band && r.y > band.top - 2 && r.y < band.bottom + 2) continue;
    if (rnd() < 0.5) px(r.x + (rnd() < 0.5 ? -2 : 2), r.y, ROAD_EDGE);
  }
  if (band) drawBridge(px, band);

  // the village at the start: houses on both sides of the road, more on wide screens
  const housePals = [
    { R: '#e03131', r: '#ff6b6b' }, { R: '#4c6ef5', r: '#748ffc' }, { R: '#2f9e44', r: '#69db7c' }, { R: '#f08c00', r: '#ffc078' },
  ];
  const homes = aw > 140 ? [0.2, 0.33, 0.67, 0.8] : [0.24, 0.76];
  homes.forEach((f, i) => {
    const x = Math.round(aw * f - 5);
    const y = 2 + (i % 2) * 5;
    sprite(x, y, HOUSE, { ...housePals[i % housePals.length], W: '#fff3d6', B: '#4dabf7', D: '#8b4513' });
    for (let fx = x - 1; fx < x + 11; fx += 2) px(fx, y + 10, '#8b5a2b', 1, 2);
  });

  // the temple at the treasure
  const chest = stops[stops.length - 1];
  if (chest) drawTemple(px, chest.x, chest.y);

  // flowers last so they sit on top of the grass
  const flowers = Math.floor((aw * ah) / 180);
  for (let i = 0; i < flowers; i += 1) {
    const x = Math.floor(rnd() * aw);
    const y = Math.floor(rnd() * ah);
    if (x < wall || x > aw - wall || nearRoad(x, y, 6)) continue;
    if (band && y > band.top - 2 && y < band.bottom + 2) continue;
    px(x, y, FLOWERS[i % FLOWERS.length]);
  }

  animateRiver(canvas, ctx, band);
}

function drawRiver(ctx, px, aw, riverY, road) {
  const wave = (x) => Math.round(riverY + Math.sin(x / 13) * 2);
  const half = 5;
  for (let x = 0; x < aw; x += 1) {
    const y = wave(x);
    px(x, y - half - 1, BANK);
    px(x, y - half, WATER, 1, half * 2);
    px(x, y + half - 1, WATER_DEEP);
    px(x, y + half, BANK);
  }
  // where the road crosses, so the bridge covers it
  const inBand = road.filter((r) => r.y > riverY - half - 1 && r.y < riverY + half + 1);
  const xs = inBand.length ? inBand.map((r) => r.x) : [aw / 2];
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const top = riverY - half - 4;
  const bottom = riverY + half + 4;
  return {
    wave, half, top, bottom, aw,
    bx0: Math.round(minX - 6),
    bx1: Math.round(maxX + 6),
    image: null,
  };
}

function drawBridge(px, band) {
  const { bx0, bx1, top, bottom } = band;
  const w = bx1 - bx0;
  const h = bottom - top;
  px(bx0, top, OUT, w, h);
  px(bx0 + 1, top, '#a0522d', w - 2, h);
  for (let y = top; y < bottom; y += 2) px(bx0 + 1, y, '#7a4a26', w - 2, 1);
  // rails
  px(bx0 + 1, top, '#c98a4b', 1, h);
  px(bx1 - 2, top, '#c98a4b', 1, h);
  for (let y = top; y < bottom; y += 3) { px(bx0, y, OUT, 2, 1); px(bx1 - 2, y, OUT, 2, 1); }
}

function drawTemple(px, cx, cy) {
  const x0 = Math.round(cx - 18);
  const y0 = Math.round(cy - 22);
  // roof
  px(x0 + 4, y0, OUT, 28, 1);
  px(x0 + 2, y0 + 1, OUT, 32, 1);
  px(x0 + 3, y0 + 1, '#ced4da', 30, 1);
  px(x0, y0 + 2, OUT, 36, 4);
  px(x0 + 1, y0 + 2, '#e9ecef', 34, 3);
  px(x0 + 1, y0 + 4, '#adb5bd', 34, 1);
  px(x0 + 16, y0 + 2, '#fcc419', 4, 2); // gold crest
  // columns
  for (const cxo of [2, 8, 26, 32]) {
    px(x0 + cxo, y0 + 6, OUT, 4, 26);
    px(x0 + cxo + 1, y0 + 6, '#f1f3f5', 2, 26);
    px(x0 + cxo + 2, y0 + 6, '#ced4da', 1, 26);
  }
  // steps
  px(x0 - 1, y0 + 32, OUT, 38, 3);
  px(x0, y0 + 32, '#dee2e6', 36, 2);
  px(x0 - 3, y0 + 35, OUT, 42, 3);
  px(x0 - 2, y0 + 35, '#ced4da', 40, 2);
}

function animateRiver(canvas, ctx, band) {
  const old = timers.get(canvas);
  if (old) clearInterval(old);
  if (!band) return;
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const h = band.bottom - band.top + 1;
  const base = ctx.getImageData(0, band.top, band.aw, h);
  let phase = 0;
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(timers.get(canvas)); return; }
    ctx.putImageData(base, 0, band.top);
    ctx.fillStyle = WATER_SHINE;
    for (let x = 0; x < band.aw - 2; x += 1) {
      if ((x + phase) % 11 !== 0) continue;
      if (x + 3 > band.bx0 && x < band.bx1) continue;
      const y = band.wave(x) - 2 + (x % 3);
      ctx.fillRect(x, y, 3, 1);
    }
    phase = (phase + 1) % 11;
  };
  tick();
  if (!reduce) timers.set(canvas, setInterval(tick, 260));
}
