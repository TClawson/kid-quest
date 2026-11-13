// Buddy species, wardrobe items and the rules for unlocking them. Pure data + logic, no DOM.

import { FURNITURE } from './furniture.js';

export const SPECIES = [
  { id: 'fox', name: 'Fox' },
  { id: 'bear', name: 'Bear' },
  { id: 'panda', name: 'Panda' },
  { id: 'cat', name: 'Cat' },
  { id: 'dino', name: 'Dino' },
  { id: 'puppy', name: 'Puppy' },
  { id: 'turtle', name: 'Turtle' },
];

export const SLOTS = [
  { id: 'background', name: 'Places', icon: '🏞️' },
  { id: 'hat', name: 'Hats', icon: '🎩' },
  { id: 'face', name: 'Glasses', icon: '🕶️' },
  { id: 'neck', name: 'Extras', icon: '🎀' },
  { id: 'hand', name: 'Magic', icon: '🪄' }, // held in a paw: the magic wand
  { id: 'music', name: 'Music', icon: '🎹' },
  { id: 'sport', name: 'Sports', icon: '⚽' },
  { id: 'home', name: 'Home', icon: '🏠' }, // furniture for the buddy's house (furniture.js)
  { id: 'garden', name: 'Garden', icon: '🌱' }, // seed packets and garden decorations (gardenrules.js): not ITEMS, app.js draws this tab itself
];

// Slots the buddy wears. Bought items in these slots belong to one buddy: switching
// to a new buddy means buying them again for it. Everything else (places, pianos)
// belongs to the kid and works with every buddy. Earned prizes work with every buddy.
export const WORN_SLOTS = ['hat', 'face', 'neck', 'hand'];
export const isWorn = (item) => WORN_SLOTS.includes(item?.slot);

// need: { streak: n } uses the kid's BEST streak ever, so a broken streak never takes items away.
// price: n is a shop item: the kid buys it with coins (each task earns coins; parents can set how many) and keeps it.
// Items with neither are free from the start.
// species: 'fox' is a buddy special: only that kind of buddy sees it in the shop and can wear it.
// need: { pianoWeeks: n } uses the BEST piano streak: n weeks of piano days in a row
// (n x the kid's piano days per week, so 10 piano days for 2 weeks of Mon–Fri).
const BASE_ITEMS = [
  { id: 'bg-meadow', slot: 'background', name: 'Sunny meadow' },
  { id: 'bg-sunset', slot: 'background', name: 'Sunset beach', need: { streak: 3 } },
  { id: 'bg-ocean', slot: 'background', name: 'Under the sea', price: 100 },
  { id: 'bg-space', slot: 'background', name: 'Outer space', need: { streak: 14 } },
  { id: 'bg-castle', slot: 'background', name: 'Castle', need: { streak: 30 } },
  { id: 'bg-volcano', slot: 'background', name: 'Volcano island', price: 300 },
  { id: 'bg-rainforest', slot: 'background', name: 'Rainforest', price: 300 },
  { id: 'bg-fjord', slot: 'background', name: 'Alaskan Fjord', price: 500 },
  { id: 'bg-rainbow', slot: 'background', name: 'Rainbow land', need: { streak: 60 } },
  { id: 'bg-galaxy', slot: 'background', name: 'Golden galaxy', need: { streak: 100 } },

  { id: 'hat-cap', slot: 'hat', name: 'Ball cap', price: 40 },
  { id: 'hat-party', slot: 'hat', name: 'Party hat', need: { streak: 5 } },
  { id: 'hat-beanie', slot: 'hat', name: 'Beanie', price: 80 },
  { id: 'hat-headphones', slot: 'hat', name: 'Headphones', price: 140 },
  { id: 'hat-cowboy', slot: 'hat', name: 'Cowboy hat', need: { streak: 10 } },
  { id: 'hat-wizard', slot: 'hat', name: 'Wizard hat', need: { streak: 21 } },
  { id: 'hat-tophat', slot: 'hat', name: 'Top hat', price: 240 },
  { id: 'hat-crown', slot: 'hat', name: 'Crown', need: { streak: 30 } },

  { id: 'face-round', slot: 'face', name: 'Round glasses', price: 60 },
  { id: 'face-sun', slot: 'face', name: 'Sunglasses', need: { streak: 7 } },
  { id: 'face-heart', slot: 'face', name: 'Heart glasses', price: 200 },
  { id: 'face-star', slot: 'face', name: 'Star glasses', need: { streak: 14 } },
  { id: 'face-pirate', slot: 'face', name: 'Pirate patch', price: 300 },

  { id: 'neck-bowtie', slot: 'neck', name: 'Bow tie', need: { streak: 2 } },
  { id: 'neck-scarf', slot: 'neck', name: 'Cozy scarf', price: 120 },
  { id: 'neck-medal', slot: 'neck', name: 'Gold medal', need: { streak: 7 } },
  { id: 'neck-cape', slot: 'neck', name: 'Hero cape', need: { streak: 14 } },
  { id: 'neck-necklace', slot: 'neck', name: 'Gem necklace', price: 400 },

  // The wizard set. The wand glows brighter with each of today's chores done, and
  // sparks once they are all done (see wandPower and wandCells in avatar.js).
  { id: 'hat-wizard-star', slot: 'hat', name: 'Starry wizard hat', price: 250 },
  { id: 'face-beard', slot: 'face', name: 'Wizard beard', price: 150 },
  { id: 'neck-robe', slot: 'neck', name: 'Wizard robe', price: 300 },
  { id: 'hand-wand', slot: 'hand', name: 'Magic wand', price: 500, note: 'It glows brighter with every chore you finish today. Finish them all and it sparks!' },

  // Buddy specials: each is made for one kind of buddy and only sold to it.
  { id: 'hat-coonskin', slot: 'hat', name: 'Raccoon hat', price: 1000, species: 'fox' },
  { id: 'hat-beehive', slot: 'hat', name: 'Beehive hat', price: 1000, species: 'bear' },
  { id: 'neck-bamboo', slot: 'neck', name: 'Bamboo stick', price: 1000, species: 'panda' },
  { id: 'neck-yarn', slot: 'neck', name: 'Yarn ball necklace', price: 1000, species: 'cat' },
  { id: 'neck-jersey', slot: 'neck', name: 'Basketball jersey', price: 1000, species: 'dino' },
  { id: 'neck-bone', slot: 'neck', name: 'Chew bone', price: 1000, species: 'puppy' },
  { id: 'face-ninja', slot: 'face', name: 'Ninja mask', price: 1000, species: 'turtle' },

  { id: 'music-keyboard', slot: 'music', name: 'Little keyboard', need: { pianoWeeks: 2 } },
  { id: 'music-upright', slot: 'music', name: 'Upright piano', need: { pianoWeeks: 4 } },
  { id: 'music-rock', slot: 'music', name: 'Rock star piano', need: { pianoWeeks: 6 } },
];

// Paint colors for color versions of the cheaper accessories. avatar.js has the pixel colors.
export const COLORS = {
  red: 'Red', orange: 'Orange', yellow: 'Yellow', green: 'Green', teal: 'Teal',
  blue: 'Blue', purple: 'Purple', pink: 'Pink', black: 'Black', gold: 'Gold',
};

// Extra colors of cheap accessories. Each is its own shop item, bought on its own,
// and listed right after the item it recolors. The id is `${base}-${color}`.
// The bow tie's first color is a streak prize; its other colors are cheap to buy.
export const COLOR_VERSIONS = {
  'neck-bowtie': { price: 30, colors: ['blue', 'green', 'purple', 'pink', 'black'] },
  'hat-cap': { colors: ['blue', 'green', 'yellow', 'purple', 'black'] },
  'face-round': { colors: ['red', 'blue', 'green', 'pink', 'gold'] },
  'hat-beanie': { colors: ['red', 'green', 'teal', 'purple', 'pink'] },
  'neck-scarf': { colors: ['red', 'yellow', 'green', 'blue', 'purple'] },
};

/** "Blue" + "Ball cap" -> "Blue ball cap" */
const colorName = (color, name) => `${COLORS[color]} ${name.charAt(0).toLowerCase()}${name.slice(1)}`;

// ---------- sports gear ----------
// Bought with gems, which only exercise earns. Gear belongs to the kid (every
// buddy can use it), like the pianos. Each kind comes in three versions; a
// better version makes its moves flashier and its fish rarer.
export const SPORTS = [
  { id: 'rod', name: 'Fishing rod', icon: '🎣' },
  { id: 'soccer', name: 'Soccer ball', icon: '⚽' },
  { id: 'shoes', name: 'Running shoes', icon: '👟' },
  { id: 'football', name: 'Football', icon: '🏈' },
  { id: 'hockey', name: 'Hockey stick', icon: '🏒' },
];
export const TIERS = [
  { tier: 1, id: 'regular', name: '', gems: 40 },
  { tier: 2, id: 'good', name: 'Good', gems: 120 },
  { tier: 3, id: 'super', name: 'Super', gems: 300 },
];
const SPORT_ITEMS = SPORTS.flatMap((k) => TIERS.map((t) => ({
  id: `sport-${k.id}-${t.id}`,
  slot: 'sport',
  name: t.name ? `${t.name} ${k.name.charAt(0).toLowerCase()}${k.name.slice(1)}` : k.name,
  gems: t.gems,
  kind: k.id,
  tier: t.tier,
})));
/**
 * The fishing boat (Taylor, 2026-11-10): not held like the rest, it waits at the lake. In the
 * fishing game it takes the kid and the visitor out from the shore to deeper water, where bigger
 * fish swim (see js/fishing.js). bestGear gives { boat: 1 }.
 */
SPORT_ITEMS.push({ id: 'sport-boat', slot: 'sport', name: 'Fishing boat', gems: 100, kind: 'boat', tier: 1, noHold: true });

// Moves a buddy does when tapped. Each kind of gear has three, unlocked by the
// best exercise streak: 1, 3 and 6 weeks. 'body' moves need no gear.
export const MOVE_WEEKS = [1, 3, 6];
export const MOVES = [
  { id: 'jacks', kind: 'body', step: 1, name: 'Jumping jacks' },
  { id: 'cartwheel', kind: 'body', step: 2, name: 'Cartwheel' },
  { id: 'backflip', kind: 'body', step: 3, name: 'Backflip' },
  { id: 'cast', kind: 'rod', step: 1, name: 'Big cast' },
  { id: 'reel', kind: 'rod', step: 2, name: 'Reel one in' },
  { id: 'whopper', kind: 'rod', step: 3, name: 'The whopper' },
  { id: 'keepy', kind: 'soccer', step: 1, name: 'Keepy-uppy' },
  { id: 'flick', kind: 'soccer', step: 2, name: 'Rainbow flick' },
  { id: 'bicycle', kind: 'soccer', step: 3, name: 'Bicycle kick' },
  { id: 'dash', kind: 'shoes', step: 1, name: 'Speed dash' },
  { id: 'hurdle', kind: 'shoes', step: 2, name: 'Hurdle jump' },
  { id: 'tornado', kind: 'shoes', step: 3, name: 'Tornado spin' },
  { id: 'spike', kind: 'football', step: 1, name: 'Touchdown spike' },
  { id: 'spiral', kind: 'football', step: 2, name: 'Spiral pass' },
  { id: 'flipcatch', kind: 'football', step: 3, name: 'Flip catch' },
  { id: 'dangle', kind: 'hockey', step: 1, name: 'Stickhandling' },
  { id: 'slapshot', kind: 'hockey', step: 2, name: 'Slap shot' },
  { id: 'spinorama', kind: 'hockey', step: 3, name: 'Spin-o-rama' },
];
export const moveById = (id) => MOVES.find((m) => m.id === id);
export const moveWeeks = (move) => MOVE_WEEKS[move.step - 1];

/** The best version (1-3) of each kind of gear in a list of owned item ids. */
export function bestGear(owned = []) {
  const out = {};
  for (const id of owned) {
    const item = itemById(id);
    if (item?.slot === 'sport') out[item.kind] = Math.max(out[item.kind] || 0, item.tier);
  }
  return out;
}

/**
 * Moves a buddy can do: body moves, plus moves for gear the kid owns, up to
 * what their best exercise streak (in weeks) has unlocked. Each comes with the
 * gear version to use: [{ move, tier }].
 */
export function unlockedMoves(owned, bestWeeks) {
  const gear = bestGear(owned);
  return MOVES.filter((m) => (m.kind === 'body' || gear[m.kind]) && (bestWeeks || 0) >= moveWeeks(m))
    .map((move) => ({ move, tier: gear[move.kind] || 0 }));
}

/** Pick a random move, avoiding the one just done when there is a choice. */
export function pickMove(moves, last, rnd = Math.random) {
  const pool = moves.length > 1 ? moves.filter((m) => m.move.id !== last) : moves;
  return pool.length ? pool[Math.floor(rnd() * pool.length)] : null;
}

export const ITEMS = [...BASE_ITEMS, ...SPORT_ITEMS, ...FURNITURE].flatMap((item) => {
  const cv = COLOR_VERSIONS[item.id];
  if (!cv) return [item];
  return [item, ...cv.colors.map((color) => ({
    id: `${item.id}-${color}`,
    slot: item.slot,
    name: colorName(color, item.name),
    price: cv.price || item.price,
    base: item.id,
    color,
  }))];
});

export const itemById = (id) => ITEMS.find((i) => i.id === id);

export function isUnlocked(item, progress) {
  if (item.gems) return Boolean(progress.owned?.includes(item.id));
  if (item.price) return Boolean(progress.owned?.includes(item.id));
  if (!item.need) return true;
  if (item.need.streak) return progress.best >= item.need.streak;
  if (item.need.pianoWeeks) return pianoDaysNeeded(item, progress) <= (progress.pianoBest || 0);
  return false;
}

/** Old level-based items a kid had already reached before the shop existed. They keep them free. */
// Color versions came later, so they were never level items.
// Buddy specials came later too.
// Furniture came later too, and so did the wizard set.
const LATER = new Set(['hat-wizard-star', 'face-beard', 'neck-robe', 'hand-wand']);
export const LEGACY_LEVEL = (item) => (item.price && !item.base && !item.species && !item.home && !LATER.has(item.id) ? item.price / 20 : Infinity);

/** Whether a buddy of this species can have this item: buddy specials are for their own species only. */
export const fitsSpecies = (item, species) => !item?.species || item.species === species;

/** Piano days in a row an item needs, for this kid's piano schedule (Mon–Fri if none is set). */
export function pianoDaysNeeded(item, progress) {
  return item.need.pianoWeeks * (progress.pianoPerWeek || 5);
}

/** Roughly how far off an earned item is, to pick the next one to show. Shop items aren't included. */
export function needGap(item, progress) {
  if (!item.need) return Infinity;
  if (item.need.streak) return item.need.streak - progress.best;
  return pianoDaysNeeded(item, progress) - (progress.pianoBest || 0);
}

export function needLabel(item) {
  if (item.gems) return `${item.gems} gems`;
  if (item.price) return `${item.price} coins`;
  if (!item.need) return 'Free';
  if (item.need.streak) return `${item.need.streak}-day streak`;
  return `${item.need.pianoWeeks}-week piano streak`;
}

/** Newly unlocked item ids that the kid hasn't been shown yet. */
export function newUnlocks(kid, progress) {
  const seen = new Set(kid.seenUnlocks || []);
  return ITEMS.filter((i) => i.need && isUnlocked(i, progress) && !seen.has(i.id)).map((i) => i.id);
}

/**
 * How bright the magic wand glows: the share of today's chores done (or waiting for
 * a parent's OK), from a day summary { done, total } (see todaySummary in logic.js).
 * A day with nothing to do counts as all done; no summary (unknown) is 0.
 */
export function wandPower(summary) {
  if (!summary) return 0;
  if (!summary.total) return 1;
  return Math.max(0, Math.min(1, summary.done / summary.total));
}

/** Map an old emoji avatar to a species, for kids created before buddies existed. */
export function speciesFromEmoji(emoji) {
  return { '🦊': 'fox', '🐼': 'panda', '🐱': 'cat', '🦖': 'dino', '🐲': 'dino', '🐻': 'bear', '🐨': 'bear', '🐶': 'puppy', '🐕': 'puppy', '🐢': 'turtle' }[emoji] || 'bear';
}

/**
 * What this kid owns for the buddy they use now: their shared items (places)
 * plus what they bought for this buddy. kid.owned holds shared items;
 * kid.buddyOwned[species] holds worn items bought for that buddy.
 */
export function ownedFor(kid, species = kid.buddy?.species) {
  return [...(kid.owned || []), ...(kid.buddyOwned?.[species] || [])];
}

/** Record a bought item: worn items go to the current buddy, the rest to the kid. */
export function addOwned(kid, item) {
  if (isWorn(item)) {
    const sp = kid.buddy.species;
    kid.buddyOwned = { ...(kid.buddyOwned || {}), [sp]: [...(kid.buddyOwned?.[sp] || []), item.id] };
  } else {
    kid.owned = [...(kid.owned || []), item.id];
  }
}

/**
 * Before worn items were tied to a buddy, everything was in kid.owned. Move worn
 * items from there to the buddy the kid uses now, so nobody loses anything.
 * Safe to run again: it only moves what is still in kid.owned. Returns true if it changed the kid.
 */
export function moveWornToBuddy(kid) {
  if (!Array.isArray(kid.owned) || !kid.buddy) return false;
  const worn = kid.owned.filter((id) => isWorn(itemById(id)));
  if (!worn.length) return false;
  const sp = kid.buddy.species;
  const mine = kid.buddyOwned?.[sp] || [];
  kid.buddyOwned = { ...(kid.buddyOwned || {}), [sp]: [...mine, ...worn.filter((id) => !mine.includes(id))] };
  kid.owned = kid.owned.filter((id) => !worn.includes(id));
  return true;
}

/**
 * Switch the kid to another buddy. The old buddy keeps what it was wearing for
 * next time, and the new buddy puts back on what it wore last, as long as it is
 * still unlocked for it. The place and piano stay as they are.
 * unlocked(item, species) says whether the kid can use an item with that buddy.
 */
export function switchSpecies(kid, species, unlocked) {
  const buddy = kid.buddy;
  if (buddy.species === species) return;
  const outfit = buddy.outfit || {};
  const closet = { ...(buddy.closet || {}) };
  const worn = {};
  const shared = {};
  for (const [slot, id] of Object.entries(outfit)) (WORN_SLOTS.includes(slot) ? worn : shared)[slot] = id;
  closet[buddy.species] = worn;
  const back = {};
  for (const [slot, id] of Object.entries(closet[species] || {})) {
    const item = itemById(id);
    if (item && unlocked(item, species)) back[slot] = id;
  }
  kid.buddy = { ...buddy, species, outfit: { ...shared, ...back }, closet };
}

export function defaultBuddy(species = 'fox') {
  return { species, outfit: { background: 'bg-meadow' } };
}

/**
 * The buddy's resting mood for the quest screen.
 * proud: today is done. sad: missed yesterday (not frozen or excused) and nothing done yet today.
 * sleepy: nothing done yet today. happy: some progress.
 */
export function restingMood({ todayDone, todayComplete, missedYesterday }) {
  if (todayComplete) return 'proud';
  if (todayDone === 0 && missedYesterday) return 'sad';
  if (todayDone === 0) return 'sleepy';
  return 'happy';
}
