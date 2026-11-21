// The dig site for each map: where the cliff runs, the rocks, trees, the dry creek and the
// map's own landmarks, and the cues they give (which kinds of finds like to be near them).
// Pure logic, no DOM (digart.js draws it). A new site is laid out every round.
//
// Cue kinds (all real):
//  bone: fossils weather out at the foot of cliffs and slopes and along dry creek beds,
//        where erosion wears the rock away. That is where real fossil hunters look.
//  gem:  crystals and minerals grow in cracks in rock: look by outcrops and boulders.
//  made: things people lost or hid: by big old trees, ruins and paths.

export const CUE_KINDS = ['bone', 'gem', 'made'];

const LIKES = {
  cliff: { bone: 3.2 },
  scree: { bone: 2.4, gem: 0.4 },
  creek: { bone: 2.2, gem: 0.9 },
  rock: { gem: 2.2, bone: 0.5 },
  outcrop: { gem: 3.4, bone: 0.4 },
  tree: { made: 2.6 },
  ruin: { made: 4, gem: 0.4 },
  path: { made: 1.2 },
  vent: { gem: 3.6 },
  crater: { gem: 2.4, bone: 1.6 },
  glacier: { bone: 3.6 },
  pool: { gem: 1.4, made: 1.4 },
  roots: { made: 2, bone: 0.6 },
  hot: { gem: 4.2 },
  wet: { gem: 1.2, made: 1.2, bone: 1 },
};

// What each map's site has. trees: how many; tree: which kind; rocks/outcrops: how many;
// creek: 'dry' | 'water' | 'lava' | 'none'; extras: the map's own things; sea: water along the
// bottom; hard: ground that takes an extra stroke ('roots' near trees, 'frozen' everywhere
// near the glacier).
export const SITE_KINDS = {
  'bg-meadow': { trees: 7, tree: 'oak', rocks: 6, outcrops: 2, creek: 'dry', extras: ['path', 'molehill', 'molehill', 'molehill', 'molehill', 'molehill'] },
  'bg-castle': { trees: 5, tree: 'pine', rocks: 4, outcrops: 2, creek: 'none', extras: ['ruin', 'ruin', 'path', 'flag'], wall: true },
  'bg-sunset': { trees: 5, tree: 'palm', rocks: 4, outcrops: 3, creek: 'none', extras: ['pool', 'pool'], sea: true },
  'bg-ocean': { trees: 8, tree: 'kelp', rocks: 6, outcrops: 3, creek: 'none', extras: ['wreck'], under: true },
  'bg-volcano': { trees: 5, tree: 'palm', rocks: 7, outcrops: 2, creek: 'lava', extras: ['hot', 'hot', 'vent', 'vent'] },
  'bg-rainforest': { trees: 8, tree: 'kapok', rocks: 4, outcrops: 1, creek: 'water', extras: ['roots'], hard: 'roots' },
  'bg-fjord': { trees: 6, tree: 'spruce', rocks: 6, outcrops: 2, creek: 'water', extras: ['glacier', 'thaw', 'thaw', 'thaw'], hard: 'frozen' },
  'bg-space': { trees: 0, tree: null, rocks: 7, outcrops: 3, creek: 'none', extras: ['crater', 'crater', 'crater', 'lander'] },
  'bg-rainbow': { trees: 7, tree: 'lolly', rocks: 5, outcrops: 2, creek: 'dry', extras: ['path'] },
  'bg-galaxy': { trees: 6, tree: 'crystal', rocks: 6, outcrops: 3, creek: 'none', extras: ['crater', 'crater'] },
};

/**
 * Lay out a site. r: random numbers (0-1); W, H: the site in game pixels.
 * Returns { top(x): the cliff foot (nobody walks above it), bottom(x) (the sea, or null),
 *   blocks: [{ x, y, r }] (round things in the way), cues: [{ x, y, r, likes }],
 *   props: [{ type, x, y, s, v }] (things drawn standing up), decals: [...] (things drawn flat),
 *   creek: [[x, y], ...] or null, hardAt(x, y): 1 where the ground is hard }
 */
export function makeLayout(map, r, W, H) {
  const K = SITE_KINDS[map] || SITE_KINDS['bg-meadow'];
  // the cliff along the top: its foot wanders between 30 and 46 pixels down
  const ph = [r() * 6, r() * 6, r() * 6];
  const topBase = 34;
  const top = (x) => Math.round(topBase + 5 * Math.sin(x / 47 + ph[0]) + 3 * Math.sin(x / 19 + ph[1]) + 2 * Math.sin(x / 9 + ph[2]));
  const seaBase = H - 22;
  const bottom = K.sea ? (x) => Math.round(seaBase + 3 * Math.sin(x / 23 + ph[1])) : null;
  const floor = (x) => (bottom ? bottom(x) - 6 : H - 6);
  const blocks = []; const cues = []; const props = []; const decals = [];
  const free = (x, y, rad) => y > top(x) + 8 + rad && y < floor(x) - rad && x > rad + 4 && x < W - rad - 4
    && blocks.every((b) => Math.hypot(x - b.x, y - b.y) > b.r + rad + 6)
    && props.every((p) => Math.hypot(x - p.x, y - p.y) > rad + 10);
  const place = (rad, tries = 60, yLo = 0, yHi = 1) => {
    for (let k = 0; k < tries; k += 1) {
      const x = 10 + r() * (W - 20);
      const y0 = top(x) + 8; const y1 = floor(x);
      const y = y0 + (yLo + r() * (yHi - yLo)) * (y1 - y0);
      if (free(x, y, rad)) return [x, y];
    }
    return null;
  };
  const cue = (x, y, rad, kind, boost = 1) => {
    const likes = {}; for (const k in LIKES[kind]) likes[k] = LIKES[kind][k] * boost;
    cues.push({ x, y, r: rad, likes, kind });
  };

  // the cliff foot is good for bones all along; some stretches have a slope of scree
  for (let x = 8; x < W; x += 18) cue(x, top(x) + 4, 22, 'cliff');
  const screes = 3 + Math.floor(r() * 2);
  for (let k = 0; k < screes; k += 1) {
    const x = 30 + r() * (W - 60);
    const w = 26 + r() * 18;
    decals.push({ type: 'scree', x, y: top(x), w, h: 16 + r() * 8 });
    cue(x, top(x) + 12, 26, 'scree', 1.2);
  }

  // the creek: from the cliff down to the bottom, wandering
  let creek = null;
  if (K.creek !== 'none') {
    creek = [];
    let x = W * (0.35 + r() * 0.3);
    const dx = (r() - 0.5) * 1.2;
    for (let y = top(x) - 2; y <= (bottom ? bottom(x) : H) + 4; y += 6) {
      creek.push([x, y]);
      x += dx * 6 + Math.sin(y / 17 + ph[0]) * 3;
      x = Math.max(24, Math.min(W - 24, x));
    }
    for (let k = 0; k < creek.length; k += 3) {
      const [cx, cy] = creek[k];
      cue(cx - 9, cy, 16, 'creek'); cue(cx + 9, cy, 16, 'creek');
    }
    // running water (or lava) is in the way except at a few stepping stones
    if (K.creek === 'water' || K.creek === 'lava') {
      const fords = new Set([Math.floor(creek.length * 0.3), Math.floor(creek.length * 0.7)]);
      creek.forEach(([cx, cy], k) => { if (![...fords].some((f) => Math.abs(f - k) <= 1)) blocks.push({ x: cx, y: cy, r: 4, water: true }); });
      decals.push({ type: 'fords', at: [...fords].map((f) => creek[f]) });
    }
  }

  // landmarks first (they need the most room)
  for (const ex of K.extras) {
    if (ex === 'glacier') {
      // the glacier fills a corner along the top; bones melt out at its edge
      const gx = r() < 0.5 ? W * 0.12 : W * 0.82;
      props.push({ type: 'glacier', x: gx, y: top(gx) + 10, s: 1 });
      blocks.push({ x: gx, y: top(gx) + 4, r: 22, big: true });
      for (let a = -2; a <= 2; a += 1) cue(gx + a * 14, top(gx) + 26, 18, 'glacier');
      continue;
    }
    if (ex === 'molehill' || ex === 'thaw' || ex === 'hot') {
      const sz = { molehill: 4, thaw: 16, hot: 18 }[ex];
      const at = place(sz, 80, 0.1, 0.95);
      if (!at) continue;
      decals.push({ type: ex, x: at[0], y: at[1], w: sz * 2, h: sz * 1.3, v: Math.floor(r() * 3) });
      if (ex === 'hot') cue(at[0], at[1], sz + 8, 'hot');
      continue;
    }
    if (ex === 'flag') continue; // laid on the path below
    if (ex === 'path') {
      // a footpath across the site: people dropped things along it
      const y0 = 60 + r() * (H - 110);
      decals.push({ type: 'path', y: y0, ph: ph[2] });
      for (let x = 20; x < W; x += 30) cue(x, y0 + 4 * Math.sin(x / 31 + ph[2]), 14, 'path');
      if (K.extras.includes('flag')) {
        // the castle: one flagstone a different color, in the path (a cellar under it)
        const fx = W * (0.3 + r() * 0.5);
        decals.push({ type: 'flag', x: fx, y: y0 + 4 * Math.sin(fx / 31 + ph[2]) });
      }
      continue;
    }
    const sz = { ruin: 14, pool: 10, vent: 5, crater: 13, wreck: 16, lander: 9, roots: 0 }[ex];
    if (ex === 'roots') continue;
    const at = place(sz, 80, 0.15, 0.95);
    if (!at) continue;
    const [x, y] = at;
    if (ex === 'pool' || ex === 'crater') {
      decals.push({ type: ex, x, y, w: sz * 2, h: sz * 1.3, v: Math.floor(r() * 3) });
      if (ex === 'pool') blocks.push({ x, y, r: sz * 0.75, big: true });
      cue(x, y, sz + 18, ex);
    } else if (ex === 'vent') {
      decals.push({ type: 'vent', x, y, v: Math.floor(r() * 3) });
      cue(x, y, 22, 'vent');
    } else {
      props.push({ type: ex, x, y, s: 1, v: Math.floor(r() * 3) });
      blocks.push({ x, y: y - 2, r: sz * 0.7, big: true });
      cue(x, y, sz + 22, ex === 'lander' ? 'ruin' : ex === 'wreck' ? 'ruin' : 'ruin');
    }
  }

  // trees
  for (let k = 0; k < K.trees; k += 1) {
    const at = place(7, 60, 0.05, 1);
    if (!at) continue;
    const [x, y] = at;
    props.push({ type: K.tree, x, y, s: 0.85 + r() * 0.35, v: Math.floor(r() * 3) });
    blocks.push({ x, y: y - 1, r: 4 });
    cue(x, y + 4, 22, 'tree');
    if (K.hard === 'roots') cue(x, y + 4, 20, 'roots');
  }
  // boulders and outcrops (an outcrop: a few rocks together)
  for (let k = 0; k < K.rocks; k += 1) {
    const at = place(6, 60);
    if (!at) continue;
    const [x, y] = at; const s = 0.8 + r() * 0.6;
    props.push({ type: 'rock', x, y, s, v: Math.floor(r() * 3) });
    blocks.push({ x, y: y - 1, r: 5 * s });
    cue(x, y, 20, 'rock');
  }
  for (let k = 0; k < K.outcrops; k += 1) {
    const at = place(12, 60);
    if (!at) continue;
    const [x, y] = at;
    const n = 3 + Math.floor(r() * 2);
    for (let q = 0; q < n; q += 1) {
      const a = (q / n) * Math.PI * 2 + r(); const d = q ? 7 + r() * 3 : 0;
      const px = x + Math.cos(a) * d; const py = y + Math.sin(a) * d * 0.6; const s = q ? 0.6 + r() * 0.3 : 1.1;
      props.push({ type: 'rock', x: px, y: py, s, v: Math.floor(r() * 3), crystal: q === 0 });
      blocks.push({ x: px, y: py - 1, r: 4.5 * s });
    }
    cue(x, y, 28, 'outcrop');
  }
  // little things on the ground that don't matter (flowers, pebbles, shells...)
  for (let k = 0; k < 40; k += 1) {
    const x = r() * W; const y = top(x) + 6 + r() * (floor(x) - top(x));
    decals.push({ type: 'bit', x, y, v: Math.floor(r() * 4) });
  }

  const hardAt = (x, y) => {
    if (K.hard === 'frozen') return decals.some((d) => d.type === 'thaw' && Math.hypot(x - d.x, (y - d.y) * 1.3) < d.w / 2) ? 0 : 1;
    if (K.hard === 'roots') return props.some((p) => p.type === K.tree && Math.hypot(x - p.x, (y - p.y) * 1.4) < 14) ? 1 : 0;
    return 0;
  };
  return { top, bottom, blocks, cues, props, decals, creek, hardAt, kind: K };
}
