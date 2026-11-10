// The kid's garden behind the buddy's house: what the seeds are, how each plant grows from
// one of the kid's own chores, when it droops, what a harvest gives, and the garden's
// decorations. Pure logic, no DOM (garden.js is the walkable garden, gardenart.js draws it).
//
// Each plant stands for one chore the kid picks when planting. It grows one step on each
// day the kid marks that chore done (a parent's check isn't needed), so a plant is a
// picture of a habit. Plants never die: a missed day makes the plant droop until the chore
// is done again. Flowers and vegetables are harvested when grown (kept in the house for a
// while, or sold for about what the seeds cost); a fruit tree is never harvested: once
// grown it stays and drops fruit into the fruit bowl in the house every few days.
//
// The garden is shared by all of a kid's buddies (like the furniture). It lives on the kid's
// synced record: kid.garden = {
//   beds: [plot | null] x BEDS, trees: [plot | null] x TREES,
//   kept: [{ seed, kind, at, until }],  // harvests kept in the house
//   seeds: { seedId: count },            // seed packets bought in the shop, not planted yet
//   n: a counter for plot ids,
// }, plot = { id, seed, task, planted }. Decorations are shop items in kid.owned, and
// kid.gardenDecor says which owned one stands in each spot (like kid.home for furniture).
// Watering is only for show and lives on this device (see watered()).

import { tasksForDay, entryFor, addDays, isExercise, habitInfo } from './logic.js';

export const BEDS = 6;
export const TREES = 2;

// days: done-days to grow. stages: how many looks the art has (0 = just planted).
export const KINDS = {
  flower: { name: 'Flowers', days: 7, stages: 4, keepDays: 7 },
  veg: { name: 'Vegetables', days: 21, stages: 5, keepDays: 14 },
  tree: { name: 'Fruit tree', days: 60, stages: 6, keepDays: 0 },
};

export const SEEDS = [
  { id: 'seed-sunflower', kind: 'flower', name: 'Sunflower', icon: '🌻', price: 5 },
  { id: 'seed-tulip', kind: 'flower', name: 'Tulips', icon: '🌷', price: 5 },
  { id: 'seed-daisy', kind: 'flower', name: 'Daisies', icon: '🌼', price: 5 },
  { id: 'seed-carrot', kind: 'veg', name: 'Carrots', icon: '🥕', price: 10 },
  { id: 'seed-tomato', kind: 'veg', name: 'Tomatoes', icon: '🍅', price: 10 },
  { id: 'seed-pumpkin', kind: 'veg', name: 'Pumpkin', icon: '🎃', price: 10 },
  { id: 'seed-apple', kind: 'tree', name: 'Apple tree', icon: '🍎', price: 25 },
  { id: 'seed-cherry', kind: 'tree', name: 'Cherry tree', icon: '🍒', price: 25 },
  { id: 'seed-orange', kind: 'tree', name: 'Orange tree', icon: '🍊', price: 25 },
];
const seedMap = new Map(SEEDS.map((s) => [s.id, s]));
export const seedById = (id) => seedMap.get(id) || null;

// A fruit tree drops a fruit every FRUIT_EVERY done-days once grown; the bowl holds BOWL_MAX.
export const FRUIT_EVERY = 3;
export const BOWL_MAX = 5;
// Selling pays the seed price, up to CARE more or less depending on how steadily it was cared for.
export const CARE = 0.15;

// ---------- decorations (Garden tab of the shop) ----------

export const GARDEN_SPOTS = [
  { id: 'fence', name: 'Fence', icon: '🪵', basic: 'garden-fence-basic' },
  { id: 'path', name: 'Path', icon: '🪨' },
  { id: 'water', name: 'Birdbath', icon: '🐦' },
  { id: 'bees', name: 'Bee house', icon: '🐝' },
  { id: 'seat', name: 'Seat', icon: '🪑' },
  { id: 'can', name: 'Watering can', icon: '🚿', basic: 'garden-can-basic' },
];
export const gardenSpotById = (id) => GARDEN_SPOTS.find((s) => s.id === id) || null;

export const DECOR = [
  { id: 'garden-fence-basic', spot: 'fence', name: 'Wooden fence', art: 'fence-wood' },
  { id: 'garden-fence-picket', spot: 'fence', name: 'White picket fence', art: 'fence-picket', price: 40 },
  { id: 'garden-fence-flower', spot: 'fence', name: 'Painted flower fence', art: 'fence-flower', price: 60 },
  { id: 'garden-path-stones', spot: 'path', name: 'Stepping stones', art: 'path-stones', price: 20 },
  { id: 'garden-path-brick', spot: 'path', name: 'Brick path', art: 'path-brick', price: 35 },
  { id: 'garden-birdbath', spot: 'water', name: 'Birdbath', art: 'birdbath', price: 30 },
  { id: 'garden-pond', spot: 'water', name: 'Little pond', art: 'pond', price: 60 },
  { id: 'garden-beehouse', spot: 'bees', name: 'Bee house', art: 'beehouse', price: 30 },
  { id: 'garden-bench', spot: 'seat', name: 'Garden bench', art: 'bench', price: 40 },
  { id: 'garden-swing', spot: 'seat', name: 'Tree swing', art: 'swing', price: 60 },
  { id: 'garden-can-basic', spot: 'can', name: 'Tin watering can', art: 'can-tin' },
  { id: 'garden-can-copper', spot: 'can', name: 'Copper watering can', art: 'can-copper', price: 25 },
  { id: 'garden-can-rainbow', spot: 'can', name: 'Rainbow watering can', art: 'can-rainbow', price: 50 },
].map((d) => ({ ...d, slot: 'garden', garden: true }));
const decorMap = new Map(DECOR.map((d) => [d.id, d]));
export const decorById = (id) => decorMap.get(id) || null;

/** What stands in each garden spot: { fence, path, water, bees, seat, can }, each a decoration or null. */
export function gardenLayout(kid) {
  const owned = new Set(kid?.owned || []);
  const out = {};
  for (const s of GARDEN_SPOTS) {
    const d = decorById(kid?.gardenDecor?.[s.id]);
    const ok = d && d.spot === s.id && (!d.price || owned.has(d.id));
    out[s.id] = ok ? d : s.basic ? decorById(s.basic) : null;
  }
  return out;
}

/** Put a decoration in its spot, or take it out if it's there already. Returns the new kid.gardenDecor. */
export function placeDecor(kid, item) {
  const decor = { ...(kid.gardenDecor || {}) };
  if (gardenLayout(kid)[item.spot]?.id !== item.id) decor[item.spot] = item.id;
  else if (item.id !== gardenSpotById(item.spot).basic) delete decor[item.spot];
  return decor;
}

// ---------- the garden ----------

/** The kid's garden, filled out to its full shape (never changes the kid). */
export function gardenOf(kid) {
  const g = kid?.garden || {};
  const fill = (list, n) => Array.from({ length: n }, (_, i) => (list && list[i] && seedById(list[i].seed) ? list[i] : null));
  const seeds = {};
  for (const [id, c] of Object.entries(g.seeds || {})) if (seedById(id) && c > 0) seeds[id] = Math.floor(c);
  return { beds: fill(g.beds, BEDS), trees: fill(g.trees, TREES), kept: Array.isArray(g.kept) ? g.kept : [], seeds, n: g.n || 0 };
}

/** Buy a seed packet in the shop: kid.spent goes up by its price. The caller checks the coins. */
export function buySeed(kid, seedId) {
  const seed = seedById(seedId);
  if (!seed) return false;
  const g = gardenOf(kid);
  g.seeds[seed.id] = (g.seeds[seed.id] || 0) + 1;
  kid.garden = g;
  kid.spent = (kid.spent || 0) + seed.price;
  return true;
}

/** How many packets of a seed the kid has waiting to be planted. */
export const seedCount = (kid, seedId) => gardenOf(kid).seeds[seedId] || 0;

/** The chores a plant can stand for: the kid's quest tasks (not the bonus exercise). */
export const plantableTasks = (kid) => (kid?.tasks || []).filter((t) => !isExercise(t));

const saidDone = (entry, id) => ['done', 'pending'].includes(entry?.tasks?.[id]?.status);
const onList = (state, kid, key, today, id) => tasksForDay(state, kid, key, today).some((t) => t.id === id && !isExercise(t));

/**
 * How a plant is doing today: {
 *   seed, kind, task (the kid's task, or null if it was deleted), grown (done-days so far,
 *   capped at the kind's days for flowers and vegetables), days, stage (0..stages-1),
 *   ripe (ready to harvest, or a fully grown tree), droopy, doneToday, scheduled (the chore's
 *   days since planting), done (of those, the ones done), fruit (a grown tree's fruit so far),
 * }. Days the chore wasn't on the list, and excused days, neither grow nor droop it.
 */
export function plantInfo(state, kid, plot, today) {
  const seed = seedById(plot?.seed);
  if (!seed) return null;
  const K = KINDS[seed.kind];
  const task = (kid.tasks || []).find((t) => t.id === plot.task && !isExercise(t)) || null;
  let done = 0; let scheduled = 0; let lastMissed = false; let lastSeen = false;
  const planted = plot.planted && plot.planted <= today ? plot.planted : today;
  // walk from today back to the day it was planted
  for (let key = today, i = 0; key >= planted && i < 400; key = addDays(key, -1), i += 1) {
    if (!onList(state, kid, key, today, plot.task)) continue;
    const entry = entryFor(state, kid.id, key);
    const did = saidDone(entry, plot.task);
    if (key !== today && entry?.excused && !did) continue;
    if (key === today && !did) continue; // today isn't over yet
    scheduled += 1;
    if (did) done += 1;
    if (key !== today && !lastSeen) { lastSeen = true; lastMissed = !did; }
  }
  const doneToday = saidDone(entryFor(state, kid.id, today), plot.task);
  let mastered = false;
  if (seed.kind === 'tree' && task) mastered = !!habitInfo(state, kid, today).get(task.id)?.mastered;
  const ripe = done >= K.days || mastered;
  const grown = seed.kind === 'tree' ? done : Math.min(done, K.days);
  const stage = ripe ? K.stages - 1 : Math.min(K.stages - 2, Math.floor((done / K.days) * (K.stages - 1)));
  const fruit = seed.kind === 'tree' && ripe ? 1 + Math.floor(Math.max(0, done - K.days) / FRUIT_EVERY) : 0;
  return {
    seed, kind: seed.kind, task, grown, days: K.days, stage, ripe,
    droopy: !!task && lastMissed && !doneToday, doneToday, scheduled, done, fruit,
  };
}

/** What a grown flower or vegetable sells for: the seed price, up to 15% more or less for care. */
export function sellPrice(info) {
  if (!info || info.kind === 'tree') return 0;
  const ratio = info.scheduled ? info.done / info.scheduled : 1;
  return Math.max(1, Math.round(info.seed.price * (1 - CARE + 2 * CARE * ratio)));
}

const slotList = (g, where) => (where === 'trees' ? g.trees : g.beds);

/**
 * Plant one of the kid's seed packets in an empty bed (where 'beds') or tree spot (where
 * 'trees'), for one of the kid's chores. Returns an error string, or null when planted.
 */
export function plant(kid, where, index, seedId, taskId, today) {
  const seed = seedById(seedId);
  if (!seed) return 'No such seed.';
  if ((where === 'trees') !== (seed.kind === 'tree')) return seed.kind === 'tree' ? 'Trees go in the big tree spots.' : 'Seeds go in the garden beds.';
  if (!plantableTasks(kid).some((t) => t.id === taskId)) return 'Pick one of your chores for it.';
  const g = gardenOf(kid);
  const list = slotList(g, where);
  if (index < 0 || index >= list.length) return 'No such spot.';
  if (list[index]) return 'Something is already growing there.';
  if (!g.seeds[seed.id]) return 'Buy a packet of these seeds in the shop first.';
  const n = g.n + 1;
  list[index] = { id: `p${n}`, seed: seed.id, task: taskId, planted: today };
  g.seeds[seed.id] -= 1;
  if (!g.seeds[seed.id]) delete g.seeds[seed.id];
  kid.garden = { ...g, n };
  return null;
}

/** Dig up a plant (no coins back). */
export function digUp(kid, where, index) {
  const g = gardenOf(kid);
  const list = slotList(g, where);
  if (!list[index]) return false;
  list[index] = null;
  kid.garden = g;
  return true;
}

/** Point a plant at a different chore (when its chore was removed). Growth so far restarts counting from that chore. */
export function relink(kid, where, index, taskId, today) {
  const g = gardenOf(kid);
  const p = slotList(g, where)[index];
  if (!p || !plantableTasks(kid).some((t) => t.id === taskId)) return false;
  slotList(g, where)[index] = { ...p, task: taskId, planted: today };
  kid.garden = g;
  return true;
}

/**
 * Harvest a grown flower or vegetable. how: 'keep' puts it in the house (a vase of flowers
 * for a week, a basket of vegetables for two), 'sell' gives back about the seed price.
 * Returns { coins, kept } or an error string.
 */
export function harvest(state, kid, index, how, today) {
  const g = gardenOf(kid);
  const p = g.beds[index];
  const info = p && plantInfo(state, kid, p, today);
  if (!info || info.kind === 'tree') return 'Nothing to pick there.';
  if (!info.ripe) return 'Not grown yet.';
  g.beds[index] = null;
  let coins = 0; let kept = null;
  if (how === 'sell') {
    coins = sellPrice(info);
    kid.spent = (kid.spent || 0) - coins;
  } else {
    kept = { seed: info.seed.id, kind: info.kind, at: today, until: addDays(today, KINDS[info.kind].keepDays - 1) };
    // only what's still in the house is kept on the record
    g.kept = [...g.kept.filter((k) => k.until >= today), kept];
  }
  kid.garden = g;
  return { coins, kept };
}

/**
 * What the garden puts in the house today: { vases: [seed], baskets: [seed], bowl: [seed] }
 * (newest first; at most 3 vases, 3 baskets and BOWL_MAX fruit). The bowl holds the grown
 * trees' fruit.
 */
export function houseHarvest(state, kid, today) {
  const g = gardenOf(kid);
  const now = g.kept.filter((k) => k.at <= today && k.until >= today && seedById(k.seed)).reverse();
  const bowl = [];
  for (const p of g.trees) {
    const info = p && plantInfo(state, kid, p, today);
    if (info?.fruit) for (let i = 0; i < info.fruit; i += 1) bowl.push(info.seed.id);
  }
  return {
    vases: now.filter((k) => k.kind === 'flower').slice(0, 3).map((k) => k.seed),
    baskets: now.filter((k) => k.kind === 'veg').slice(0, 3).map((k) => k.seed),
    bowl: bowl.slice(0, BOWL_MAX),
  };
}

/**
 * Everything the garden shows today: { beds: [info|null], trees: [info|null], layout,
 * critters: { butterflies, bees, bird } }. Butterflies come with blooms, bees with the bee
 * house and a flower, a bird with the birdbath or pond.
 */
export function gardenView(state, kid, today) {
  const g = gardenOf(kid);
  const info = (p) => (p ? { ...plantInfo(state, kid, p, today), id: p.id, plot: p } : null);
  const beds = g.beds.map(info);
  const trees = g.trees.map(info);
  const layout = gardenLayout(kid);
  const all = [...beds, ...trees].filter(Boolean);
  const blooms = all.filter((p) => p.stage >= 2 && !p.droopy).length;
  return {
    beds, trees, layout,
    critters: {
      butterflies: Math.min(3, Math.floor(blooms / 2) + (blooms ? 1 : 0)),
      bees: layout.bees && all.some((p) => p.kind === 'flower' && p.stage >= 2) ? 2 : 0,
      bird: !!layout.water,
    },
  };
}

// ---------- watering (only for show, on this device) ----------
// Marking a chore done grows its plant. The buddy watering it is a little moment the kid
// can have whenever they like (stepping into the garden, or the Water button), so ticking
// off a run of chores is never interrupted. Which plants were watered today is kept on this
// device only.

const WKEY = 'kidquest.watered';
function readW(storage) { try { return JSON.parse(storage?.getItem(WKEY) || '{}') || {}; } catch { return {}; } }

/** Plant ids watered today on this device. */
export function watered(kidId, today, storage = globalThis.localStorage) {
  const w = readW(storage)[kidId];
  return new Set(w && w.day === today ? w.ids : []);
}

/** Mark plants as watered today. */
export function setWatered(kidId, today, ids, storage = globalThis.localStorage) {
  const all = readW(storage);
  const was = watered(kidId, today, storage);
  for (const id of ids) was.add(id);
  all[kidId] = { day: today, ids: [...was] };
  try { storage?.setItem(WKEY, JSON.stringify(all)); } catch { /* not remembered, that's fine */ }
}

/** The plants waiting for water: their chore is done today and they haven't been watered yet. */
export function thirsty(view, kidId, today, storage = globalThis.localStorage) {
  const w = watered(kidId, today, storage);
  return [...view.beds, ...view.trees].filter((p) => p && p.doneToday && !w.has(p.id)).map((p) => p.id);
}
