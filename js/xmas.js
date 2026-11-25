// The December event's collectables (design-v2 sections 2 and 5): the ornaments for the buddy's
// tree, the star toppers, and the wrapping for sibling gifts. Pure data + small rules, no DOM
// (xmasart.js draws them, houseart.js puts the tree in the room, xmasgifts.js has the gift rules).
//
// What a kid has is kept on the kid (synced like the rest of the kid, store.js mergeSafe adds to
// found and photo rather than overwriting, and sends tinsel as a change):
//   kid.xmas = { found: [ids in the order found, star ids too], star, tinsel,
//                photo: ['2026:bg-meadow', ...] (maps whose perfect December photo gave its ornament),
//                rolls: { day, fish, dig } (today's catches and digs, so drops are seeded) }
//
// Every map has 4 ornaments of its own (2 common, 1 rare, 1 super-rare), each tied to that map's
// characters and landmark, plus a Star topper. Finding all 4 of a map's ornaments wins its star;
// door 25 of the advent calendar gives any one star the kid picks. A map only drops its own
// ornaments, so kids travel to fill the tree.

/** The maps in the order the book shows them (the shop's order of places). */
export const XMAS_MAPS = [
  { id: 'bg-meadow', name: 'Forest Village' },
  { id: 'bg-sunset', name: 'Sunset Beach' },
  { id: 'bg-ocean', name: 'Under the Sea' },
  { id: 'bg-space', name: 'Moon Base' },
  { id: 'bg-castle', name: 'Castle' },
  { id: 'bg-volcano', name: 'Volcano Island' },
  { id: 'bg-rainforest', name: 'Rainforest' },
  { id: 'bg-fjord', name: 'Alaskan Fjord' },
  { id: 'bg-rainbow', name: 'Rainbow Land' },
  { id: 'bg-galaxy', name: 'Golden Galaxy' },
];

/** How often each ornament of a map drops (design-v2): each common 35%, the rare 20%, the super-rare 10%. */
export const RARITY = {
  common: { name: 'Common', chance: 0.35 },
  rare: { name: 'Rare', chance: 0.2 },
  super: { name: 'Super rare', chance: 0.1 },
};
/** A drop that would be a double rolls again, once, half the time; a double turns into tinsel. */
export const REROLL_DOUBLE = 0.5;
/** Tinsel that buys any missing ornament. */
export const TINSEL_PRICE = 3;

// [id, map, rarity, name]: the book lists them in this order (per map: common, common, rare, super)
const LIST = [
  ['orn-acorn', 'bg-meadow', 'common', 'Acorn bauble'],
  ['orn-toadstool', 'bg-meadow', 'common', 'Toadstool'],
  ['orn-oak', 'bg-meadow', 'rare', 'Tiny Great Oak'],
  ['orn-owl', 'bg-meadow', 'super', 'Owl lantern'],

  ['orn-shell', 'bg-sunset', 'common', 'Seashell'],
  ['orn-crab', 'bg-sunset', 'common', 'Beach crab'],
  ['orn-pirate', 'bg-sunset', 'rare', 'Pirate ship'],
  ['orn-parrot', 'bg-sunset', 'super', 'Captain Parrot'],

  ['orn-pearl', 'bg-ocean', 'common', 'Pearl clam'],
  ['orn-clown', 'bg-ocean', 'common', 'Clownfish ball'],
  ['orn-octopus', 'bg-ocean', 'rare', 'Sleepy octopus'],
  ['orn-galleon', 'bg-ocean', 'super', 'Galleon in a bubble'],

  ['orn-moon', 'bg-space', 'common', 'Crater moon'],
  ['orn-rocket', 'bg-space', 'common', 'Toy rocket'],
  ['orn-saucer', 'bg-space', 'rare', 'Flying saucer'],
  ['orn-moonworm', 'bg-space', 'super', 'Moon worm'],

  ['orn-shield', 'bg-castle', 'common', 'Royal shield'],
  ['orn-tower', 'bg-castle', 'common', 'Castle tower'],
  ['orn-crown', 'bg-castle', 'rare', 'Tiny crown'],
  ['orn-dragonegg', 'bg-castle', 'super', 'Dragon egg'],

  ['orn-lava', 'bg-volcano', 'common', 'Lava drop'],
  ['orn-dragonfruit', 'bg-volcano', 'common', 'Dragonfruit'],
  ['orn-stoneface', 'bg-volcano', 'rare', 'Stone guardian'],
  ['orn-capybara', 'bg-volcano', 'super', 'Hot-tub capybara'],

  ['orn-kapok', 'bg-rainforest', 'common', 'Kapok seed'],
  ['orn-frog', 'bg-rainforest', 'common', 'Dart frog'],
  ['orn-sloth', 'bg-rainforest', 'rare', 'Hanging sloth'],
  ['orn-morpho', 'bg-rainforest', 'super', 'Blue morpho'],

  ['orn-moose', 'bg-fjord', 'common', 'Moose'],
  ['orn-puffin', 'bg-fjord', 'common', 'Puffin'],
  ['orn-lighthouse', 'bg-fjord', 'rare', 'Lighthouse'],
  ['orn-aurora', 'bg-fjord', 'super', 'Northern lights ball'],

  ['orn-lolly', 'bg-rainbow', 'common', 'Swirl lollipop'],
  ['orn-sheep', 'bg-rainbow', 'common', 'Cloud sheep'],
  ['orn-goldpot', 'bg-rainbow', 'rare', 'Pot of gold'],
  ['orn-unicorn', 'bg-rainbow', 'super', 'Baby unicorn'],

  ['orn-planet', 'bg-galaxy', 'common', 'Ringed planet'],
  ['orn-starpup', 'bg-galaxy', 'common', 'Star puppy'],
  ['orn-stardust', 'bg-galaxy', 'rare', 'Jar of stardust'],
  ['orn-starwhale', 'bg-galaxy', 'super', 'Star whale'],
];

export const ORNAMENTS = LIST.map(([id, map, rarity, name]) => ({ id, map, rarity, name }));

/** The star toppers, one per map (door 25 of that map's advent calendar). */
export const STARS = [
  ['star-meadow', 'bg-meadow', 'Acorn star'],
  ['star-sunset', 'bg-sunset', 'Starfish star'],
  ['star-ocean', 'bg-ocean', 'Sea-glass star'],
  ['star-space', 'bg-space', 'Crescent star'],
  ['star-castle', 'bg-castle', 'Crown star'],
  ['star-volcano', 'bg-volcano', 'Ember star'],
  ['star-rainforest', 'bg-rainforest', 'Orchid star'],
  ['star-fjord', 'bg-fjord', 'Snowflake star'],
  ['star-rainbow', 'bg-rainbow', 'Rainbow star'],
  ['star-galaxy', 'bg-galaxy', 'Comet star'],
].map(([id, map, name]) => ({ id, map, name, rarity: 'star' }));

const byId = new Map([...ORNAMENTS, ...STARS].map((o) => [o.id, o]));
export const ornamentById = (id) => byId.get(id);
export const mapOrnaments = (map) => ORNAMENTS.filter((o) => o.map === map);

/**
 * An ornament drop on a map, for a kid who has found these ids: { id, double } (a double turns
 * into tinsel). Each ornament by its rarity's chance; a double rolls again once, half the time.
 * rand: () => 0..1.
 */
export function rollOrnament(map, found = [], rand = Math.random) {
  const list = mapOrnaments(map);
  if (!list.length) return null;
  const roll = () => {
    let r = rand() * list.reduce((t, o) => t + RARITY[o.rarity].chance, 0);
    for (const o of list) { r -= RARITY[o.rarity].chance; if (r < 0) return o.id; }
    return list[list.length - 1].id;
  };
  let id = roll();
  if (found.includes(id) && rand() < REROLL_DOUBLE) id = roll();
  return { id, double: found.includes(id) };
}

/** The star a map's 4 ornaments win, once all 4 are found. */
export const mapStar = (map) => STARS.find((s) => s.map === map);
/** Is every ornament of a map found? */
export const mapDone = (map, found = []) => mapOrnaments(map).every((o) => found.includes(o.id));

/**
 * The star toppers a kid has: each map with all 4 ornaments found wins its star, and stars
 * picked at door 25 (star ids in found) count too. In the book's order.
 */
export function starsWon(found = []) {
  return STARS.filter((s) => found.includes(s.id) || mapDone(s.map, found)).map((s) => s.id);
}

/**
 * How full the tree looks: 0 bare (just its lights), 1 a few ornaments, 2 about half, 3 full
 * (every ornament found). The star sits on top whenever the kid has one.
 */
export function treeLevel(found = []) {
  const n = found.filter((id) => byId.get(id)?.rarity !== 'star').length;
  return n >= ORNAMENTS.length ? 3 : n >= 16 ? 2 : n ? 1 : 0;
}

// ---------- gifts (section 5) ----------

/** Present shapes: a small box, a tall box, and a squashy round one gathered at the top. */
export const GIFT_SHAPES = ['small', 'tall', 'round'];
/** Wrapping papers, each with its ribbon. */
export const GIFT_PAPERS = [
  { id: 'candy', name: 'Candy stripes', ribbon: 'green' },
  { id: 'dots', name: 'Snowy dots', ribbon: 'gold' },
  { id: 'stars', name: 'Starry night', ribbon: 'red' },
  { id: 'plaid', name: 'Cozy plaid', ribbon: 'cream' },
  { id: 'kraft', name: 'Brown paper and string', ribbon: 'twine' },
];

// ---------- drops (design-v2 section 2) ----------

/** How often each place drops an ornament in December (the chest's comes on top of its prize). */
export const DROP_ODDS = { chest: 1 / 2, fish: 1 / 8, dig: 1 / 6 };

/** The kid's December things, filled out (never changes the kid). */
export function xmasOf(kid) {
  const x = kid?.xmas || {};
  return {
    ...x,
    found: Array.isArray(x.found) ? x.found : [],
    tinsel: Math.max(0, Math.floor(x.tinsel || 0)),
    photo: Array.isArray(x.photo) ? x.photo : [],
  };
}

/**
 * Give a kid an ornament (or a star topper, door 25): a new one goes in found, one they have
 * already turns into a tinsel. Changes kid.xmas (a new object). Returns { id, kind: 'new' | 'tinsel' }
 * or null for an id that is no ornament. The advent wall and the gifts call this too.
 */
export function addOrnament(kid, id) {
  if (!kid || !byId.has(id)) return null;
  const x = xmasOf(kid);
  if (x.found.includes(id)) {
    kid.xmas = { ...(kid.xmas || {}), tinsel: x.tinsel + 1 };
    return { id, kind: 'tinsel' };
  }
  kid.xmas = { ...(kid.xmas || {}), found: [...x.found, id] };
  return { id, kind: 'new' };
}

/**
 * A drop on a map (the chest, a fish, a dig, an advent ornament door): rolled by rarity, a double
 * rolls again once half the time (rollOrnament), then given (addOrnament). rand: () => 0..1, seeded
 * where the result must match on every device. Returns { id, kind } or null.
 */
export function grantOrnament(kid, map, rand = Math.random) {
  const roll = rollOrnament(map, xmasOf(kid).found, rand);
  return roll ? addOrnament(kid, roll.id) : null;
}

/** The ornaments a kid is missing (not the stars), in the book's order; a map's only, if given. */
export function missingOrnaments(found = [], map = null) {
  return ORNAMENTS.filter((o) => !found.includes(o.id) && (!map || o.map === map)).map((o) => o.id);
}

/**
 * Any missing ornament, from any map (advent ornament doors, golden doors: design-v2 section 0),
 * picked by rarity chance among the missing ones; rarity: only that rarity ('super' for a golden
 * door). null when none is missing.
 */
export function pickMissing(found = [], rand = Math.random, { rarity = null, map = null } = {}) {
  const list = missingOrnaments(found, map).map((id) => byId.get(id)).filter((o) => !rarity || o.rarity === rarity);
  if (!list.length) return null;
  let r = rand() * list.reduce((t, o) => t + RARITY[o.rarity].chance, 0);
  for (const o of list) { r -= RARITY[o.rarity].chance; if (r < 0) return o.id; }
  return list[list.length - 1].id;
}

/**
 * The daily chest's ornament (December, 1 in 2, on top of its prize), from the map the kid is on.
 * rand: rng seeded by kid and day, so every device gets the same. Returns { id, kind } or null
 * (and the kid is changed only when there is one).
 */
export function chestOrnament(kid, map, day, rand) {
  if (!isXmas(day) || !mapOrnaments(map).length) return null;
  if (rand() >= DROP_ODDS.chest) return null;
  return grantOrnament(kid, map, rand);
}

/**
 * The n-th fish or dig of the day (source 'fish' or 'dig'): counts it on the kid (kid.xmas.rolls,
 * so the count syncs) and returns that one's roll number, for a seeded random (kid, day, source, n).
 */
export function nextRoll(kid, source, day) {
  const x = xmasOf(kid);
  const rolls = x.rolls?.day === day ? x.rolls : { day };
  const n = rolls[source] || 0;
  kid.xmas = { ...(kid.xmas || {}), rolls: { ...rolls, [source]: n + 1 } };
  return n;
}

/**
 * A December fish (1 catch in 8 has one snagged) or dig (1 in 6): rand seeded with the roll number
 * from nextRoll. Returns { id, kind } or null. Outside December nothing.
 */
export function playDrop(kid, source, map, day, rand) {
  if (!isXmas(day) || !DROP_ODDS[source] || !mapOrnaments(map).length) return null;
  if (rand() >= DROP_ODDS[source]) return null;
  return grantOrnament(kid, map, rand);
}

/**
 * The first perfect photo of a map's December critter each December gives a missing ornament of
 * that map (once per map per year; a map with all 4 gives a tinsel instead). critter: { map, december }.
 * Returns { id, kind } or null.
 */
export function photoOrnament(kid, critter, quality, day, rand = Math.random) {
  if (!isXmas(day) || !critter?.december || quality !== 'perfect' || !mapOrnaments(critter.map).length) return null;
  const tag = `${day.slice(0, 4)}:${critter.map}`;
  const x = xmasOf(kid);
  if (x.photo.includes(tag)) return null;
  kid.xmas = { ...(kid.xmas || {}), photo: [...x.photo, tag] };
  const id = pickMissing(x.found, rand, { map: critter.map }) || mapOrnaments(critter.map)[0].id;
  return addOrnament(kid, id);
}

/**
 * Tinsel buys a missing ornament from any map (TINSEL_PRICE each; no maps unlock in December, so
 * this is how a locked map's ornaments are reached). Returns true when bought.
 */
export function tinselSwap(kid, id) {
  const o = byId.get(id);
  const x = xmasOf(kid);
  if (!o || o.rarity === 'star' || x.found.includes(id) || x.tinsel < TINSEL_PRICE) return false;
  kid.xmas = { ...(kid.xmas || {}), tinsel: x.tinsel - TINSEL_PRICE, found: [...x.found, id] };
  return true;
}

// ---------- in the buddy's house ----------

/** Is day (YYYY-MM-DD, Denver) in the December event? */
export const isXmas = (day) => /^\d{4}-12-/.test(day || '');

/** The ornaments the 3-year-old's tree shows as big pictures, after any she was given. */
export const BIG_BAUBLES = ['orn-starpup', 'orn-clown', 'orn-sheep', 'orn-frog', 'orn-acorn'];

/**
 * What the buddy's house shows (house.js houseHtml's xmas), or null. In December: the tree carries
 * the kid's ornaments (kid.xmas.found, in the order found) and its star (kid.xmas.star when the
 * kid has won it, else the first star won); a string of gold beads comes once it's about half
 * full. From 1 Jan the tree is packed away (tree null), but presents not yet opened still sit there
 * all January. The presents: kid.xmasGifts (xmasgifts.js), this December's (or last December's,
 * in January), not opened yet; open: it can be unwrapped today (25 Dec on).
 * opts.little: the 3-year-old's tree, with big picture baubles instead of little ones.
 */
export function xmasHouse(state, kid, day, opts = {}) {
  const jan = /^\d{4}-01-/.test(day || '');
  if (!isXmas(day) && !jan) return null;
  const year = jan ? String(Number(day.slice(0, 4)) - 1) : day.slice(0, 4);
  const gifts = Object.values(kid.xmasGifts || {})
    .filter((g) => g && String(g.year) === year && !g.opened)
    .sort((a, b) => String(a.id).localeCompare(String(b.id)))
    .map((g) => ({
      id: g.id,
      shape: GIFT_SHAPES.includes(g.shape) ? g.shape : 'small',
      paper: GIFT_PAPERS.some((p) => p.id === g.paper) ? g.paper : 'candy',
      from: g.fromName ? `${g.fromName}'s ${g.fromBuddy || 'buddy'}` : 'a friend',
      open: day >= `${year}-12-25`,
      item: g.kind === 'ornament' ? g.item : null, // what pops out when it's unwrapped
    }));
  if (jan) return gifts.length ? { tree: null, found: 0, total: ORNAMENTS.length, gifts } : null;
  const x = kid.xmas || {};
  const all = x.found || [];
  const found = all.filter((id) => byId.get(id) && byId.get(id).rarity !== 'star');
  const won = starsWon(all);
  const star = won.includes(x.star) ? x.star : won[0] || null;
  const level = treeLevel(found);
  const tree = opts.little
    ? { ornaments: [], big: [...new Set([...found, ...BIG_BAUBLES])].slice(0, 4), star, garland: 1 }
    : { ornaments: found, star, garland: level >= 2 ? 1 : 0 };
  return { tree, found: found.length, total: ORNAMENTS.length, gifts };
}
