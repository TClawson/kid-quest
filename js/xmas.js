// The December event's collectables (design-v2 sections 2 and 5): the ornaments for the buddy's
// tree, the star toppers, and the wrapping for sibling gifts. Pure data + small rules, no DOM
// (xmasart.js draws them, houseart.js puts the tree in the room).
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

// ---------- in the buddy's house ----------

/** Is day (YYYY-MM-DD, Denver) in the December event? */
export const isXmas = (day) => /^\d{4}-12-/.test(day || '');

/**
 * What the buddy's house shows in December (house.js houseHtml's xmas), or null in any other
 * month. The tree carries the kid's ornaments (kid.xmas.found, in the order found) and its star
 * (kid.xmas.star when the kid has won it, else the first star won); a string of gold beads comes
 * once it's about half full. The presents are the ones siblings put under it this year and that
 * aren't unwrapped yet (state.xmas.gifts: { from, to, year, shape, paper, opened }).
 */
export function xmasHouse(state, kid, day) {
  if (!isXmas(day)) return null;
  const x = kid.xmas || {};
  const all = x.found || [];
  const found = all.filter((id) => byId.get(id) && byId.get(id).rarity !== 'star');
  const won = starsWon(all);
  const star = won.includes(x.star) ? x.star : won[0] || null;
  const level = treeLevel(found);
  const year = day.slice(0, 4);
  const gifts = (state.xmas?.gifts || [])
    .filter((g) => g.to === kid.id && String(g.year) === year && !g.opened)
    .map((g) => {
      const giver = (state.kids || []).find((k) => k.id === g.from);
      return { shape: GIFT_SHAPES.includes(g.shape) ? g.shape : 'small', paper: g.paper || 'candy', from: giver ? `${giver.name}'s ${giver.buddy?.species || 'buddy'}` : 'a friend' };
    });
  return { tree: { ornaments: found, star, garland: level >= 2 ? 1 : 0 }, found: found.length, total: ORNAMENTS.length, gifts };
}
