// Each map's twist in the visitor ball games and its event at the fishing lake (2026-11-22).
// The looks are in fieldlooks.js. A twist changes how the map plays, never by much (about 20%
// at most), and the start screen says it in one short line. The same map feels the same in every
// game: the fjord is slippery, the moon is floaty, Rainbow Land bounces, the galaxy has its
// gravity well, Under the Sea floats, Volcano Island puffs steam. The numbers here are read by
// play.js (keepy-uppy), hockey.js, football.js and fishing.js.

/**
 * Keepy-uppy. beat: air time times this; wob: how much an off kick wobbles it, times this;
 * step: pass calls build this much faster; plus one special rule (the key the game looks for).
 */
export const SOCCER_TWISTS = {
  'bg-meadow': { name: 'Acorn drop', tip: 'Acorns fall from the oaks. Tap one as it lands: +2!', acorn: true },
  'bg-sunset': { name: 'Beach ball', tip: 'A big beach ball: floatier, but wobblier!', beat: 1.15, wob: 1.2, ball: 'beach' },
  'bg-ocean': { name: 'Floaty water', tip: 'Under water, everything floats slowly.', beat: 1.2, bubbles: true },
  'bg-space': { name: 'Moon kicks', tip: 'Every 5th kick is a moon kick: way up, slow down!', moon: 5 },
  'bg-castle': { name: 'Royal fanfare', tip: '3 Perfects in a row: fanfare and +1!', fanfare: 3 },
  'bg-volcano': { name: 'Hot potato', tip: 'The ball heats up! Pass it while it glows: +1!', step: 2, hot: 2, ball: 'lava' },
  'bg-rainforest': { name: 'Rain showers', tip: 'In the rain it goes quicker, but Perfects count double!', rain: { every: 22, last: 9, beat: 0.9 } },
  'bg-fjord': { name: 'Slippery ice', tip: 'Ice wobbles fast. One Perfect steadies it all!', wob: 1.4, clear: true },
  'bg-rainbow': { name: 'Bouncy candy', tip: 'Drop it? The candy grass bounces it back, once every 10 kicks!', bounce: 10 },
  'bg-galaxy': { name: 'Gravity waves', tip: 'Gravity changes every 10 kicks. Watch the stars!', waves: 10 },
};

/**
 * Hockey. mouth: the goals' half width; keep: how much speed a loose puck keeps each second;
 * glide: how fast skating follows where you steer (lower = slidier); plus one special thing.
 */
export const HOCKEY_TWISTS = {
  'bg-meadow': { name: 'Big pond goals', tip: 'Pond hockey: the goals are extra wide!', mouth: 12 },
  'bg-sunset': { name: 'Waves', tip: 'Waves wash up the rink. Watch for the foam!', waves: { every: 7, last: 1.4, push: 70 } },
  'bg-ocean': { name: 'Sea current', tip: 'The current drifts the puck. Follow the bubbles!', current: { push: 34, flip: 15 }, puck: 'sanddollar', goal: 'clam' },
  'bg-space': { name: 'Lob shots', tip: 'Low gravity: shots fly over the other buddy!', lob: 0.6 },
  'bg-castle': { name: 'Magic doors', tip: 'A puck in a magic door pops out of its twin!', doors: true },
  'bg-volcano': { name: 'Lava vents', tip: 'Vents glow, then puff. A puff tosses the puck!', vents: 3, puck: 'ember' },
  'bg-rainforest': { name: 'Mud puddles', tip: 'Mud puddles slow skaters down!', mud: 3 },
  'bg-fjord': { name: 'Glacier ice', tip: 'Super slick ice! And watch out for the seal.', keep: 0.75, glide: 2.4, seal: { every: 11, warn: 1, up: 2 } },
  'bg-rainbow': { name: 'Candy bumpers', tip: 'Candy bumpers boing the puck away fast!', bumpers: 2 },
  'bg-galaxy': { name: 'Gravity well', tip: 'The gravity well bends the puck around it!', well: 5200 },
};

/**
 * Football. hang: flight time times this; deep: points for a deep catch; plus one special
 * thing. slow: the most a twist slows the catcher (so the thrower waits long enough).
 */
export const FOOTBALL_TWISTS = {
  'bg-meadow': { name: 'Fetch!', tip: 'Drop it and the village dog fetches it: +2!', dog: 2 },
  'bg-sunset': { name: 'Soft sand', tip: 'Soft sand is slow. The wet sand by the surf is fast!', sand: { soft: 0.8, wet: 1.15 }, slow: 0.8 },
  'bg-ocean': { name: 'Floaty throws', tip: 'Under water, the ball floats down slowly.', hang: 1.2 },
  'bg-space': { name: 'Moon throws', tip: 'Deep throws fly sky high. Deep is worth 30!', moonDeep: 1.35, deep: 30 },
  'bg-castle': { name: 'Royal banner', tip: 'Catch at the cone with the banner: double points!', banner: true },
  'bg-volcano': { name: 'Steam vents', tip: 'Run over a steam vent for a speed boost!', vents: 2, boost: 1.5 },
  'bg-rainforest': { name: 'Mud puddles', tip: 'Mud puddles slow you down. Run around them!', mud: 3, mudSlow: 0.6, slow: 0.82 },
  'bg-fjord': { name: 'Ice patches', tip: 'Ice patches are slippery: you slide!', ice: 3, slow: 0.85 },
  'bg-rainbow': { name: 'Bouncy catch', tip: 'Fumble it? It bounces up. Tap CATCH again!', bouncy: true },
  'bg-galaxy': { name: 'Gravity well', tip: 'The gravity well pulls the ball toward it!', well: 14 },
};

/**
 * Fishing: once or twice a game the lake's event. It is said 3 s ahead (warn), lasts `last`
 * seconds, and doubles the odds of the map's own rare fish while it lasts. kind:
 *   spot: a hot spot (fish swim to it and bite more), drift: px/s it moves along;
 *   rise: fish swim up toward the surface; burst: a school swims in; special: the map's rare fish comes.
 */
export const FISHING_EVENTS = {
  'bg-meadow': { name: 'Mayfly hatch', warn: 'Mayflies are hatching!', tip: 'Cast into the rings!', kind: 'spot', look: 'rings' },
  'bg-castle': { name: 'Feeding time', warn: 'The cook is coming with bread!', tip: 'Fish gather at the splash!', kind: 'spot', look: 'bread' },
  'bg-sunset': { name: 'High tide', warn: 'The tide is coming in!', tip: 'Big fish swim in close!', kind: 'tide' },
  'bg-ocean': { name: 'Sea turtle', warn: 'A sea turtle is coming!', tip: 'Fish follow the turtle!', kind: 'spot', look: 'turtle', drift: -9 },
  'bg-space': { name: 'Goo geyser', warn: 'The goo is bubbling!', tip: 'Fish float up in the bubbles!', kind: 'rise', look: 'goo' },
  'bg-volcano': { name: 'Rumble', warn: 'The volcano rumbles...', tip: 'The fire dragon fish is out!', kind: 'special', look: 'shake' },
  'bg-rainforest': { name: 'Fruit raft', warn: 'Fruit is floating down the river!', tip: 'Fish follow the fruit!', kind: 'spot', look: 'fruit', drift: 7 },
  'bg-fjord': { name: 'Salmon run', warn: 'Salmon are coming in!', tip: 'A school swims through the harbor!', kind: 'burst' },
  'bg-rainbow': { name: 'Sprinkle shower', warn: 'Sprinkles are falling!', tip: 'Fish love sprinkles: they bite more!', kind: 'spot', look: 'sprinkles', wide: true },
  'bg-galaxy': { name: 'Shooting star', warn: 'A shooting star!', tip: 'The comet fish swims to the splash!', kind: 'special', look: 'star', spot: true },
};
export const EVENT = { warn: 3, last: 12, first: [14, 26], gap: [22, 32], specialOdds: 2, bite: 1.6 };

/** A twist from one of the tables for a Places background (Forest Village for anything else). */
export const twistFor = (table, map) => table[map] || table['bg-meadow'];
/** The map id the twist tables know (Forest Village for anything else). */
export const mapKey = (map) => (SOCCER_TWISTS[map] ? map : 'bg-meadow');
