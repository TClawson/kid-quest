// Little games for the littlest (Little Bakery and Animal Puzzles, little.js): the rules, no DOM.
//
// A parent turns on "Little games" for a kid (kid.littleGames, behind the parent PIN). From that
// day on, every chore the kid finishes also drops a star in their star jar, on top of the
// chore's normal coins. One star opens one visit: three cookies for three animals, or three
// puzzles. The jar holds at most JAR_MAX stars and keeps them until they're used.
//
// Stars are worked out from the days, not stored: earned = chores done since the switch went
// on, and kid.little.spent counts the stars used. So a star syncs like everything else, and a
// chore that's undone takes its star back out of the jar.
//
// kid.little: { since: dateKey, spent, stickers: { [critterId]: { gold, hearts } }, puzzles, visits }
//
// Every animal the kid meets (baked for or puzzled) goes in the sticker book: six per map, new
// ones first. Meeting one again fills a heart on its sticker (up to three), and about one animal
// in ten comes glowing and leaves a gold sticker.

import { questTasks, tasksForDay } from './logic.js';

export const JAR_MAX = 10;
export const VISIT_ROUNDS = 3;
export const GOLD_CHANCE = 0.1;
export const MAX_HEARTS = 3;

// Each map's six animals (the photo train's art, critters.js), how they come into the bakery,
// and its own cutter, frosting and sprinkles. voice: the little call each one makes.
// enter: hop | slide | drop | swim | float | rise | stroll | beam
export const LITTLE_MAPS = {
  'bg-meadow': {
    animals: ['meadow-cottontail', 'meadow-raccoon', 'meadow-chipmunk', 'meadow-cardinal', 'meadow-deer', 'meadow-frog'],
    voices: ['squeak', 'chitter', 'squeak', 'tweet', 'grunt', 'ribbit'],
    enter: 'hop', cutter: 'flower', frost: '#7ac74f', sprinkle: ['#ff6b9d', '#ffd43b', '#ffffff'], bits: 'flower',
    wall: ['#f3d9b1', '#e8c899'],
  },
  'bg-fjord': {
    animals: ['fjord-otter', 'fjord-puffin', 'fjord-bear', 'fjord-moose', 'fjord-seal', 'fjord-goat'],
    voices: ['whistle', 'tweet', 'grunt', 'grunt', 'blub', 'baa'],
    enter: 'slide', cutter: 'fish', frost: '#ffffff', sprinkle: ['#ffffff', '#bfe3ff'], bits: 'snow',
    wall: ['#d6e6f2', '#c3d8ea'],
  },
  'bg-rainforest': {
    animals: ['jungle-monkey', 'jungle-toucan', 'jungle-sloth', 'jungle-treefrog', 'jungle-macaw', 'jungle-dartfrog'],
    voices: ['chitter', 'tweet', 'grunt', 'ribbit', 'tweet', 'ribbit'],
    enter: 'drop', cutter: 'leaf', frost: '#ffb347', sprinkle: ['#3f9f3a', '#8fdc5a'], bits: 'leaf',
    wall: ['#e9dcae', '#dccb92'],
  },
  'bg-ocean': {
    animals: ['ocean-octopus', 'ocean-turtle', 'ocean-clownfish', 'ocean-lobster', 'ocean-jelly', 'ocean-parrotfish'],
    voices: ['blub', 'blub', 'blub', 'click', 'blub', 'blub'],
    enter: 'swim', cutter: 'shell', frost: '#5ad1c9', sprinkle: ['#ffffff', '#bfefff'], bits: 'bubble',
    wall: ['#5ab4e0', '#4aa4d4'],
  },
  'bg-rainbow': {
    animals: ['rainbow-bunny', 'rainbow-sheep', 'rainbow-tiger', 'rainbow-parrot', 'rainbow-snail', 'rainbow-ladybug'],
    voices: ['squeak', 'baa', 'grunt', 'tweet', 'squeak', 'chitter'],
    enter: 'float', cutter: 'cloud', frost: 'rainbow', sprinkle: ['#ffd43b', '#ff8ad8', '#74c0fc'], bits: 'star',
    wall: ['#fbe3f6', '#f3d0ee'],
  },
  'bg-castle': {
    animals: ['castle-squirrel', 'castle-hedgehog', 'castle-swan', 'castle-peacock', 'castle-badger', 'castle-deer'],
    voices: ['chitter', 'squeak', 'whistle', 'tweet', 'grunt', 'grunt'],
    enter: 'hop', cutter: 'crown', frost: '#b197fc', sprinkle: ['#ffd43b', '#ffffff'], bits: 'star',
    wall: ['#d8d2c4', '#c9c1b0'],
  },
  'bg-volcano': {
    animals: ['volcano-tortoise', 'volcano-penguin', 'volcano-crab', 'volcano-sealion', 'volcano-iguana', 'volcano-booby'],
    voices: ['grunt', 'squeak', 'click', 'baa', 'chitter', 'tweet'],
    enter: 'rise', cutter: 'drop', frost: '#ff6b3d', sprinkle: ['#ffd43b', '#ff922b', '#ff3d3d'], bits: 'dots',
    wall: ['#e6c4a8', '#d9b292'],
  },
  'bg-sunset': {
    animals: ['sunset-dolphin', 'sunset-pelican', 'sunset-crab', 'sunset-hatchling', 'sunset-spoonbill', 'sunset-iguana'],
    voices: ['whistle', 'grunt', 'click', 'squeak', 'tweet', 'chitter'],
    enter: 'stroll', cutter: 'sun', frost: '#ffa94d', sprinkle: ['#ff6b9d', '#ffd43b'], bits: 'dots',
    wall: ['#ffd8b8', '#ffc9a0'],
  },
  'bg-galaxy': {
    animals: ['galaxy-roo', 'galaxy-bear', 'galaxy-armadillo', 'galaxy-gecko', 'galaxy-comet', 'galaxy-jelly'],
    voices: ['squeak', 'grunt', 'chitter', 'chitter', 'tweet', 'blub'],
    enter: 'beam', cutter: 'moon', frost: '#9775fa', sprinkle: ['#ffffff', '#ffd43b', '#74c0fc'], bits: 'star',
    wall: ['#cbbdf0', '#bba9ea'],
  },
  'bg-space': {
    animals: ['space-bunny', 'space-crab', 'space-goat', 'space-moth', 'space-owl', 'space-fox'],
    voices: ['squeak', 'click', 'baa', 'chitter', 'tweet', 'squeak'],
    enter: 'float', cutter: 'moon', frost: '#ced4da', sprinkle: ['#ffffff', '#ffd43b'], bits: 'star',
    wall: ['#b9c3d6', '#a9b4ca'],
  },
};
export const littleMap = (theme) => LITTLE_MAPS[theme] || LITTLE_MAPS['bg-meadow'];

/** A fresh kid.little for the day the switch goes on. */
export function newLittle(since) {
  return { since, spent: 0, stickers: {}, puzzles: 0, visits: 0 };
}

/** Whether a kid plays the little games. */
export const playsLittle = (kid) => Boolean(kid?.littleGames && kid.little?.since);

/** Chores finished (done, not waiting for a parent) on the days since the switch went on, today too. */
export function starsEarned(state, kid, today) {
  const since = kid?.little?.since;
  if (!since) return 0;
  let n = 0;
  for (const [key, day] of Object.entries(state.log || {})) {
    if (key < since || key > today) continue;
    const entry = day?.[kid.id];
    if (!entry?.tasks) continue;
    const ids = new Set(questTasks(tasksForDay(state, kid, key, today)).map((t) => t.id));
    for (const [id, t] of Object.entries(entry.tasks)) if (t?.status === 'done' && ids.has(id)) n += 1;
  }
  return n;
}

/** The stars in the jar now. */
export function jarStars(state, kid, today) {
  if (!playsLittle(kid)) return 0;
  return Math.max(0, Math.min(JAR_MAX, starsEarned(state, kid, today) - (kid.little.spent || 0)));
}

/**
 * Takes one star out of the jar for a visit. Stars past a full jar are let go first, so a full
 * jar that's used goes down to nine (not back up to all the extra stars). Returns false when empty.
 */
export function spendStar(state, kid, today) {
  if (!playsLittle(kid)) return false;
  const earned = starsEarned(state, kid, today);
  const L = kid.little;
  L.spent = Math.max(L.spent || 0, earned - JAR_MAX);
  if (earned - L.spent <= 0) return false;
  L.spent += 1;
  L.visits = (L.visits || 0) + 1;
  return true;
}

/** The next animal for a round on this map: one the kid hasn't met yet when there is one. */
export function nextAnimal(kid, theme, rnd = Math.random) {
  const list = littleMap(theme).animals;
  const met = kid?.little?.stickers || {};
  const fresh = list.filter((a) => !met[a]);
  const from = fresh.length ? fresh : list;
  return from[Math.floor(rnd() * from.length) % from.length];
}

/** Puts an animal in the sticker book (or fills a heart on its sticker). Returns the sticker. */
export function earnSticker(kid, id, gold = false) {
  const L = kid.little || (kid.little = newLittle(null));
  L.stickers = L.stickers || {};
  const had = L.stickers[id];
  const s = had ? { ...had } : { gold: false, hearts: 0 };
  s.gold = Boolean(s.gold || gold);
  if (had) s.hearts = Math.min(MAX_HEARTS, (s.hearts || 0) + 1);
  L.stickers[id] = s;
  return s;
}

/** How many pieces the next puzzle has, [cols, rows]: 2, then 4, then 6 as the kid finishes more. */
export function puzzleSize(done = 0) {
  return done < 3 ? [2, 1] : done < 8 ? [2, 2] : [3, 2];
}

/** The voice (a little call) of an animal. */
export function voiceOf(id) {
  for (const m of Object.values(LITTLE_MAPS)) {
    const i = m.animals.indexOf(id);
    if (i >= 0) return m.voices[i];
  }
  return 'squeak';
}
