// Shared hills for the downhill gear games (the sled's treasure hill, and later the skis,
// the bike and the camera train). Pure logic and colors, no DOM, so every game and the
// tests can use it.
//
// Every map has its own hill, and it slides all year in its own way: grass in the meadow
// summer, sand dunes on the beach, a mud slide in the rainforest, black ash on the volcano,
// moon dust in space, a glacier on the fjord. Winter brings snow to the maps that get it
// (hillFor). Each day has one "snow kind" for everybody (snowOfDay), like the fishing bait of
// the day: fast, soft or slow, with words that fit the hill (icy snow, packed sand...).
//
// Keep this file the same in every branch that uses it: changes go through the sled thread.

export const SEASONS = ['spring', 'summer', 'autumn', 'winter'];

/** A small seeded random number source (0..1). */
export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
/** A whole number from any string, for seeding. */
export function hash(str) {
  let h = 7;
  for (const ch of String(str)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// ---------- the snow kind of the day ----------
/**
 * speed: how fast the hill runs (x the base speed). grip: how quickly a rider can change
 * speed (1 normal). deep: how deep things sink in (finds hide more, landings are soft).
 */
export const SNOW_KINDS = {
  icy: { id: 'icy', name: 'Icy', emoji: '🧊', speed: 1.25, grip: 0.6, deep: 0 },
  powder: { id: 'powder', name: 'Powder', emoji: '❄️', speed: 0.85, grip: 1, deep: 1 },
  slushy: { id: 'slushy', name: 'Slushy', emoji: '💧', speed: 0.95, grip: 1.3, deep: 0.5 },
};
export const SNOW_IDS = Object.keys(SNOW_KINDS);

/** Today's snow kind id ('icy' | 'powder' | 'slushy'): the same for everyone all day. */
export function snowOfDay(day) {
  const r = rng(hash(`snow:${day}`));
  r(); // the first number from a fresh seed barely changes from day to day
  return SNOW_IDS[Math.floor(r() * SNOW_IDS.length)];
}

// ---------- surfaces ----------
/**
 * What the ground is made of. kinds: the words for the three snow kinds on it
 * [icy, powder, slushy] (the fast one, the soft one, the slow one), with an emoji each.
 * friction: x the speed (grass is slower than snow). spray: the color kicked up.
 */
export const SURFACES = {
  snow: { id: 'snow', name: 'snow', friction: 1, kinds: [['Icy snow', '🧊'], ['Fresh powder', '❄️'], ['Slushy snow', '💧']], spray: '#ffffff' },
  glacier: { id: 'glacier', name: 'glacier ice', friction: 1.05, kinds: [['Blue ice', '🧊'], ['Fresh powder', '❄️'], ['Melting snow', '💧']], spray: '#e7f5ff' },
  grass: { id: 'grass', name: 'grass', friction: 0.85, kinds: [['Dry, slick grass', '🌾'], ['Long, soft grass', '🌿'], ['Dewy grass', '💧']], spray: '#69db7c' },
  leaves: { id: 'leaves', name: 'fallen leaves', friction: 0.9, kinds: [['Crunchy leaves', '🍂'], ['Deep leaf piles', '🍁'], ['Wet leaves', '💧']], spray: '#f08c00' },
  sand: { id: 'sand', name: 'sand dunes', friction: 0.9, kinds: [['Hard-packed sand', '🏜️'], ['Soft, deep sand', '🌬️'], ['Wet sand', '💧']], spray: '#ffe8a3' },
  seafloor: { id: 'seafloor', name: 'the sandy sea floor', friction: 0.8, kinds: [['Fast current', '🌊'], ['Soft silt', '🫧'], ['Kelp tangles', '🌿']], spray: '#d0ebff' },
  mud: { id: 'mud', name: 'a mud slide', friction: 1.05, kinds: [['Slick mud', '🟫'], ['Deep, gooey mud', '🫠'], ['Sticky clay', '💧']], spray: '#8b5a2b' },
  ash: { id: 'ash', name: 'volcanic ash', friction: 0.95, kinds: [['Glassy cinders', '🪨'], ['Fluffy ash', '🌫️'], ['Warm, sticky ash', '♨️']], spray: '#868e96' },
  dust: { id: 'dust', name: 'moon dust', friction: 0.9, kinds: [['Smooth dust', '🌑'], ['Deep dust', '🌫️'], ['Clumpy dust', '🪨']], spray: '#ced4da' },
  stardust: { id: 'stardust', name: 'golden stardust', friction: 0.95, kinds: [['Shiny stardust', '✨'], ['Deep stardust', '🌟'], ['Sticky stardust', '🍯']], spray: '#ffe066' },
  rainbow: { id: 'rainbow', name: 'a rainbow slide', friction: 1.1, kinds: [['Slippery rainbow', '🌈'], ['Fluffy cloud', '☁️'], ['Sticky candy', '🍬']], spray: '#ff8cc6' },
};

/** The words and emoji for a snow kind on a surface: { name, emoji, kind }. */
export function snowWords(kind, surface) {
  const s = SURFACES[surface] || SURFACES.snow;
  const i = Math.max(0, SNOW_IDS.indexOf(kind));
  return { kind: SNOW_IDS[i], name: s.kinds[i][0], emoji: s.kinds[i][1] };
}

// ---------- the hills ----------
/**
 * One hill per map, keyed by background id. surface: what it is most of the year;
 * winter: the surface in winter (null keeps it; tropical and pretend places stay the same);
 * seasons: other per-season surfaces. gravity: x the normal pull (floaty on the moon).
 * pal: colors. sky [top, bottom]; far [back hills, front hills]; ground [top edge, fill, deep];
 * props: colors for the trees and rocks along the hill. props names what grows on the hill;
 * hazards names what's in the way (each game draws them its own way).
 * winterPal: colors that change in winter.
 */
export const HILLS = {
  'bg-meadow': {
    name: 'Pinecone Hill', surface: 'grass', winter: 'snow', seasons: { autumn: 'leaves' }, gravity: 1,
    pal: { sky: ['#7cc7ff', '#d0ecff'], far: ['#8fcf8a', '#5cbd52'], ground: ['#69db7c', '#40a046', '#2b7a30'], props: ['#2f7d32', '#1b5e20', '#8b5a2b'] },
    winterPal: { sky: ['#a9c8e8', '#e8f1fa'], far: ['#dfe9f3', '#c5d6e6'], ground: ['#ffffff', '#e3edf7', '#b8cce0'], props: ['#2f6b3a', '#1f4d29', '#6e4520'] },
    autumnPal: { far: ['#e8a33d', '#c97b2a'], ground: ['#f0a845', '#c97b2a', '#8b5a2b'], props: ['#d9480f', '#e8590c', '#6e4520'] },
    props: ['pine', 'oak', 'bush'], hazards: ['log', 'rock', 'stump'],
  },
  'bg-castle': {
    name: 'Castle Hill', surface: 'grass', winter: 'snow', seasons: { autumn: 'leaves' }, gravity: 1,
    pal: { sky: ['#8fb8ff', '#d0e1ff'], far: ['#9aa5b1', '#7c8a96'], ground: ['#69db7c', '#3c9a3c', '#2b6e2b'], props: ['#868e96', '#495057', '#8b5a2b'] },
    winterPal: { sky: ['#b0c4de', '#eef3fa'], far: ['#c9d3dd', '#aab6c2'], ground: ['#ffffff', '#e6eef6', '#bccbdb'], props: ['#868e96', '#495057', '#6e4520'] },
    autumnPal: { ground: ['#e8a33d', '#b8732a', '#7a4a1e'] },
    props: ['banner', 'wall', 'hay'], hazards: ['barrel', 'hay', 'stone'],
  },
  'bg-sunset': {
    name: 'Sunset Dunes', surface: 'sand', winter: null, gravity: 1,
    pal: { sky: ['#ff922b', '#ffe3bf'], far: ['#f4c27a', '#e8a95a'], ground: ['#ffe8a3', '#f3c98b', '#d9a35f'], props: ['#2b8a3e', '#8d6e63', '#e9d2b4'] },
    props: ['palm', 'grass', 'shell'], hazards: ['driftwood', 'crab', 'sandcastle'],
  },
  'bg-ocean': {
    name: 'Reef Slope', surface: 'seafloor', winter: null, gravity: 0.75,
    pal: { sky: ['#1864ab', '#4dabf7'], far: ['#1c7ed6', '#1971c2'], ground: ['#f0d9a0', '#d9b86e', '#a07a3c'], props: ['#f06595', '#ffa94d', '#0ca678'] },
    props: ['coral', 'kelp', 'anemone'], hazards: ['rock', 'clam', 'urchin'],
  },
  'bg-volcano': {
    name: 'Cinder Cone', surface: 'ash', winter: null, gravity: 1,
    pal: { sky: ['#3d1a12', '#a8461f'], far: ['#4a3530', '#3a2a26'], ground: ['#6c6460', '#494240', '#2b2422'], props: ['#ff6b1a', '#212529', '#ffd43b'] },
    props: ['steam', 'rock', 'fern'], hazards: ['lavarock', 'vent', 'boulder'],
  },
  'bg-rainforest': {
    name: 'Mudslide Gully', surface: 'mud', winter: null, gravity: 1,
    pal: { sky: ['#8ce99a', '#e6fcf5'], far: ['#2f9e44', '#237032'], ground: ['#a0703f', '#7a5230', '#4a3220'], props: ['#2b8a3e', '#69db7c', '#5c940d'] },
    props: ['fern', 'kapok', 'vine'], hazards: ['root', 'puddle', 'log'],
  },
  'bg-fjord': {
    name: 'Glacier Run', surface: 'glacier', winter: 'snow', seasons: { spring: 'snow' }, gravity: 1,
    pal: { sky: ['#9cc9e8', '#e3f2fb'], far: ['#c3dcef', '#9fc0da'], ground: ['#f8fcff', '#d6ecfa', '#9fc6e3'], props: ['#2f5d4a', '#1d3d30', '#6e4520'] },
    winterPal: { sky: ['#6f8fb5', '#c8d8ea'], ground: ['#ffffff', '#e6eef6', '#b8cce0'] },
    props: ['spruce', 'iceblock', 'rock'], hazards: ['ice', 'rock', 'snowdrift'],
  },
  'bg-space': {
    name: 'Crater Rim', surface: 'dust', winter: null, gravity: 0.45,
    pal: { sky: ['#0b1026', '#1b1f4b'], far: ['#5c5f8a', '#474a73'], ground: ['#c3c6dd', '#9a9fc4', '#6d7199'], props: ['#3bc9db', '#adb5bd', '#e9ecef'] },
    props: ['crystal', 'flag', 'dish'], hazards: ['crater', 'moonrock', 'antenna'],
  },
  'bg-rainbow': {
    name: 'Rainbow Slide', surface: 'rainbow', winter: null, gravity: 0.9,
    pal: { sky: ['#a5d8ff', '#fff0f6'], far: ['#ffc9e9', '#d0bfff'], ground: ['#ff8cc6', '#c77dff', '#7950f2'], props: ['#ffd43b', '#69db7c', '#ffffff'] },
    props: ['cloud', 'lollipop', 'mushroom'], hazards: ['gumdrop', 'cloudpuff', 'candycane'],
  },
  'bg-galaxy': {
    name: 'Golden Comet Trail', surface: 'stardust', winter: null, gravity: 0.6,
    pal: { sky: ['#1a1033', '#3b2470'], far: ['#5f3dc4', '#4c2f9e'], ground: ['#ffe066', '#fab005', '#b8860b'], props: ['#ffd43b', '#ffffff', '#d0bfff'] },
    props: ['star', 'planet', 'comet'], hazards: ['asteroid', 'starburst', 'ring'],
  },
};
export const HILL_IDS = Object.keys(HILLS);
export const DEFAULT_HILL = 'bg-meadow';

/**
 * The hill on a map in a season, ready to draw: { id, name, surface, gravity, pal, props,
 * hazards, snowy }. Winter turns the maps that get snow white (and swaps their colors).
 */
export function hillFor(mapId, season = 'summer') {
  const id = HILLS[mapId] ? mapId : DEFAULT_HILL;
  const h = HILLS[id];
  const surface = (season === 'winter' && h.winter) || h.seasons?.[season] || h.surface;
  const extra = season === 'winter' && h.winter ? h.winterPal : season === 'autumn' ? h.autumnPal : null;
  const pal = { ...h.pal, ...(extra || {}) };
  return { id, name: h.name, surface, gravity: h.gravity, pal, props: h.props, hazards: h.hazards, snowy: surface === 'snow' || surface === 'glacier' };
}

/** How fast a hill runs today: the surface's friction x the snow kind's speed. */
export function hillSpeed(hill, kind) {
  return (SURFACES[hill.surface]?.friction || 1) * (SNOW_KINDS[kind]?.speed || 1);
}

// ---------- the ground ----------
/**
 * A long downhill run, the same for a seed: the ground's height (in pixels, bigger is lower
 * on the screen) at any distance along it, with rolling bumps and the odd jump. Games scroll
 * along x and ask groundAt(x). opts: { drop: how much it falls per pixel (0.18), bump: how big
 * the rolls are (10), ramps: jumps per 1000 px (1.5) }.
 * Returns { at(x): height, slope(x): dy/dx, ramps: [{ x, w, h }] }. Ramps rise sharply at the
 * end (x + w) so a rider leaves the ground there.
 */
export function makeGround(seed, opts = {}) {
  const r = rng(hash(`ground:${seed}`));
  const drop = opts.drop ?? 0.18; const bump = opts.bump ?? 10; const rampRate = opts.ramps ?? 1.5;
  // a few sine waves of different lengths make the rolls
  const waves = [0, 1, 2].map((i) => ({ len: 180 + r() * 220 / (i + 1), amp: bump / (i + 1) * (0.6 + r() * 0.6), ph: r() * Math.PI * 2 }));
  const ramps = [];
  const LEN = opts.length ?? 20000;
  for (let x = 400; x < LEN; x += 1000 / rampRate * (0.6 + r() * 0.8)) ramps.push({ x: Math.round(x), w: 26 + Math.round(r() * 14), h: 8 + Math.round(r() * 8) });
  const rampAt = (x) => {
    for (const p of ramps) {
      if (x < p.x) return 0;
      if (x <= p.x + p.w) { const k = (x - p.x) / p.w; return p.h * k * k; }
    }
    return 0;
  };
  const at = (x) => {
    let y = x * drop;
    for (const w of waves) y += Math.sin(x / w.len * Math.PI * 2 + w.ph) * w.amp;
    return y - rampAt(x);
  };
  return { at, slope: (x) => (at(x + 1) - at(x - 1)) / 2, ramps, length: LEN };
}
