// The ski race's hills: each map's hidden shortcuts and its own way of skiing (pure data, no
// DOM). The colors, surfaces and the snow kind of the day come from slopes.js (shared with
// the sled, the bike and the camera).
//
// Every hill hides six shortcuts: four common, one uncommon and one legendary (like each lake's
// special fish). A legendary one only opens on its own snow kind. A shortcut is one of five
// kinds, drawn in each map's colors:
//   tunnel  a narrow passage with a few posts to weave around, and a burst of speed out the end
//   jump    a ramp that throws you over the trees; land in the landing zone
//   ice     a fast, slippery chute with walls
//   bridge  a narrow bridge over a gap; fall off the side and you tumble
//   ride    a lane that carries you (a current, a conveyor, a wind): stay in it
// Each one has a real-world fact for the shortcut book.

export const SHORTCUT_KINDS = ['tunnel', 'jump', 'ice', 'bridge', 'ride'];
export const RARITY = { common: 1, uncommon: 0.45, legendary: 0.08 };

/**
 * Each map's twist (cheap constants the game reads):
 *   speed     x the hill's speed            turn   x how quickly you can turn (grip)
 *   width     x the trail's width           ramps  jumps per 1000 px of trail
 *   air       x airtime off a jump          drift  sideways push (px/s), it flips every section
 *   tide      a fast wet strip that wanders across the trail
 *   walls     narrow walled alleys          vents  steam vents that throw you up (a free jump)
 *   lava      hot patches that make you tumble   gaps  crevasses: take the snow bridge or jump
 *   pads      boost pads                    wells  gravity wells that bend your line
 * twist: what the start card says about it.
 */
export const COURSES = {
  'bg-meadow': {
    twist: 'A friendly hill with gates to chase.',
    mech: { ramps: 1.2 },
    shortcuts: [
      { id: 'fox-den', name: "Fox's den", kind: 'tunnel', rarity: 'common', clue: 'tracks', fact: 'A fox family\'s den can have several entrances, and the same den can be used by foxes for many years.' },
      { id: 'hay-ramp', name: 'Hay bale ramp', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'A big round hay bale can weigh more than a small car, about 1,000 to 2,000 pounds.' },
      { id: 'creek', name: 'Frozen creek', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'Moving water freezes more slowly than still water, so creeks often freeze at the edges first.' },
      { id: 'log-bridge', name: 'Old log bridge', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'A fallen log in a forest can take 50 to 100 years to rot away, and it feeds mushrooms, beetles and moss the whole time.' },
      { id: 'orchard', name: 'Orchard row', kind: 'ride', rarity: 'uncommon', clue: 'gap', fact: 'Apple trees are planted in straight rows so sunlight reaches every tree and people can pick between them.' },
      { id: 'pond-bridge', name: 'Trout pond ice bridge', kind: 'bridge', rarity: 'legendary', snow: 'icy', clue: 'sparkle', fact: 'Ice needs to be at least 4 inches thick before it is safe for a person to walk on.' },
    ],
  },
  'bg-sunset': {
    twist: 'Soft sand, but the wet sand by the tide is fast.',
    mech: { tide: 1, speed: 1.05, ramps: 1.4 },
    shortcuts: [
      { id: 'dune-tunnel', name: 'Dune tunnel', kind: 'tunnel', rarity: 'common', clue: 'tracks', fact: 'Sand dunes move! Wind can push a dune several feet across the beach in a single year.' },
      { id: 'driftwood', name: 'Driftwood ramp', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'Driftwood can float across whole oceans; some logs travel for years before washing ashore.' },
      { id: 'tide-flat', name: 'Wet tide flat', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'Wet sand is firmer than dry sand because a thin film of water holds the grains together.' },
      { id: 'pier', name: 'Under the pier', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Pier posts are covered in barnacles, mussels and sea stars that cling on when the tide goes out.' },
      { id: 'crab-path', name: "Crab's path", kind: 'ride', rarity: 'uncommon', clue: 'tracks', fact: 'Crabs walk sideways because their legs bend sideways at the joints, so that way is fastest.' },
      { id: 'shipwreck', name: 'Shipwreck hull', kind: 'tunnel', rarity: 'legendary', snow: 'slushy', clue: 'sparkle', fact: 'There are millions of shipwrecks on the ocean floor, and many become reefs full of fish.' },
    ],
  },
  'bg-ocean': {
    twist: 'A current pushes you sideways. Lean into it!',
    mech: { drift: 14, speed: 1.15, air: 1.3 },
    shortcuts: [
      { id: 'kelp-gap', name: 'Kelp gap', kind: 'tunnel', rarity: 'common', clue: 'gap', fact: 'Giant kelp can grow up to 2 feet in a single day, one of the fastest-growing living things.' },
      { id: 'current', name: 'Current stream', kind: 'ride', rarity: 'common', clue: 'sparkle', fact: 'Sea turtles ride ocean currents like highways to travel thousands of miles.' },
      { id: 'sea-cave', name: 'Sea cave', kind: 'tunnel', rarity: 'common', clue: 'tracks', fact: 'Sea caves are carved by waves pounding the same weak spot in a cliff for thousands of years.' },
      { id: 'coral-arch', name: 'Coral arch', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Coral reefs are built by tiny animals called polyps; a reef grows only about an inch a year.' },
      { id: 'turtle', name: 'Turtle ride', kind: 'ride', rarity: 'uncommon', clue: 'tracks', fact: 'Green sea turtles can hold their breath for hours while they rest underwater.' },
      { id: 'whale-wake', name: "Whale's wake", kind: 'jump', rarity: 'legendary', snow: 'icy', clue: 'sparkle', fact: 'A blue whale is the biggest animal that has ever lived, bigger than any dinosaur.' },
    ],
  },
  'bg-space': {
    twist: 'Low gravity: jumps fly a long, long way.',
    mech: { air: 2, ramps: 2.4, speed: 1.08 },
    shortcuts: [
      { id: 'crater-rim', name: 'Crater rim ramp', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'The Moon has no air or rain, so its craters can stay sharp for billions of years.' },
      { id: 'lava-tube', name: 'Moon lava tube', kind: 'tunnel', rarity: 'common', clue: 'gap', fact: 'The Moon has real lava tubes, caves left behind by ancient lava, and they could shelter future astronauts.' },
      { id: 'dish', name: 'Satellite dish slide', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'A satellite dish is curved so it bounces faint radio signals to one spot, making them stronger.' },
      { id: 'rover', name: 'Rover tracks', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'Footprints and rover tracks on the Moon can last for millions of years because there is no wind.' },
      { id: 'comet-tail', name: 'Comet tail', kind: 'ride', rarity: 'uncommon', clue: 'sparkle', fact: 'A comet\'s tail always points away from the Sun, pushed by sunlight and the solar wind.' },
      { id: 'wormhole', name: 'Wormhole', kind: 'tunnel', rarity: 'legendary', snow: 'powder', clue: 'sparkle', fact: 'Wormholes are shortcuts through space that scientists have imagined with math, but no one has ever found one.' },
    ],
  },
  'bg-castle': {
    twist: 'Narrow stone alleys. Steer true!',
    mech: { walls: 1, width: 0.9 },
    shortcuts: [
      { id: 'drawbridge', name: 'Drawbridge', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Drawbridges were raised with chains, pulleys and heavy counterweights so a few guards could lift them.' },
      { id: 'passage', name: 'Secret passage', kind: 'tunnel', rarity: 'common', clue: 'sign', fact: 'Some real castles had secret tunnels so people could escape or bring in food during a siege.' },
      { id: 'moat', name: 'Frozen moat', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'Moats were often filled with water to stop attackers from digging under the castle walls.' },
      { id: 'market', name: 'Market alley', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'Medieval markets were held on fixed days, and towns rang a bell to start the trading.' },
      { id: 'tower-slide', name: 'Tower slide', kind: 'jump', rarity: 'uncommon', clue: 'sign', fact: 'Castle stairs usually spiral clockwise going up, which made it hard for right-handed attackers to swing a sword.' },
      { id: 'dragon-lair', name: "Dragon's lair", kind: 'tunnel', rarity: 'legendary', snow: 'slushy', clue: 'sparkle', fact: 'Dragons are pretend, but the Komodo dragon is real: a lizard up to 10 feet long that lives in Indonesia.' },
    ],
  },
  'bg-volcano': {
    twist: 'Steam vents toss you up. Stay off the glowing lava!',
    mech: { vents: 1, lava: 1 },
    shortcuts: [
      { id: 'lava-tube', name: 'Lava tube', kind: 'tunnel', rarity: 'common', clue: 'gap', fact: 'Lava tubes form when the outside of a lava river cools into rock while hot lava keeps flowing inside.' },
      { id: 'obsidian', name: 'Obsidian chute', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'Obsidian is natural glass made when lava cools so fast that crystals have no time to grow.' },
      { id: 'steam-lift', name: 'Steam vent lift', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'Steam vents are called fumaroles; they puff out gas from hot rock deep underground.' },
      { id: 'palm-grove', name: 'Palm grove', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'New volcanic islands get their first plants from seeds carried by wind, waves and birds.' },
      { id: 'hot-spring', name: 'Hot spring bridge', kind: 'bridge', rarity: 'uncommon', clue: 'gap', fact: 'Snow monkeys in Japan warm up in volcanic hot springs during the winter.' },
      { id: 'lava-raft', name: 'Lava river raft', kind: 'ride', rarity: 'legendary', snow: 'icy', clue: 'sparkle', fact: 'Lava from Hawaiian volcanoes can be about 2,100 °F, hot enough to melt many metals.' },
    ],
  },
  'bg-rainforest': {
    twist: 'Slippery mud: turns take longer.',
    mech: { turn: 0.7, speed: 1.05 },
    shortcuts: [
      { id: 'vine', name: 'Vine swing', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'Some rainforest vines, called lianas, climb over 100 feet up to reach the sunlight.' },
      { id: 'waterfall', name: 'Waterfall cave', kind: 'tunnel', rarity: 'common', clue: 'sparkle', fact: 'Swifts, a kind of bird, build nests on the rocks behind waterfalls where few predators can reach.' },
      { id: 'log-bridge', name: 'Fallen kapok bridge', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Kapok trees can grow taller than a 15-story building and stick out above the rest of the forest.' },
      { id: 'fern', name: 'Fern tunnel', kind: 'tunnel', rarity: 'common', clue: 'tracks', fact: 'Ferns are older than dinosaurs; they have been on Earth for over 350 million years.' },
      { id: 'rapids', name: 'River rapids', kind: 'ride', rarity: 'uncommon', clue: 'sparkle', fact: 'The Amazon River carries more water than the next seven biggest rivers in the world put together.' },
      { id: 'temple', name: 'Temple stairs', kind: 'ice', rarity: 'legendary', snow: 'powder', clue: 'sparkle', fact: 'Ancient Maya cities with tall stone pyramids were hidden in the rainforest for centuries.' },
    ],
  },
  'bg-fjord': {
    twist: 'The fastest hill. Cross the crevasses on snow bridges!',
    mech: { speed: 1.08, gaps: 1, turn: 0.9 },
    shortcuts: [
      { id: 'snow-bridge', name: 'Crevasse snow bridge', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Crevasses are cracks in a glacier that open as the ice bends over bumps in the ground; some are hundreds of feet deep.' },
      { id: 'ice-cave', name: 'Blue ice cave', kind: 'tunnel', rarity: 'common', clue: 'sparkle', fact: 'Glacier ice looks blue because it is so thick and tightly packed that it soaks up red light.' },
      { id: 'moose', name: 'Moose trail', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'Moose have long legs that let them walk through snow that is 3 feet deep.' },
      { id: 'frozen-falls', name: 'Frozen waterfall', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'In very cold winters some waterfalls freeze into giant icicles, and climbers scale them with ice axes.' },
      { id: 'avalanche', name: 'Avalanche chute', kind: 'jump', rarity: 'uncommon', clue: 'sign', fact: 'Avalanche chutes are paths where snow slides often, so trees can\'t grow there and you see a bare stripe down the mountain.' },
      { id: 'aurora', name: 'Northern lights run', kind: 'ride', rarity: 'legendary', snow: 'powder', clue: 'sparkle', fact: 'Northern lights glow when particles from the Sun hit gases high in the air; green comes from oxygen.' },
    ],
  },
  'bg-rainbow': {
    twist: 'A wide, easy hill full of boost pads.',
    mech: { width: 1.25, pads: 1, speed: 1.02 },
    shortcuts: [
      { id: 'cloud-hop', name: 'Cloud hop', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'A big fluffy cloud can weigh over a million pounds; it floats because its water drops are tiny and spread out.' },
      { id: 'candy-gate', name: 'Candy cane gate', kind: 'bridge', rarity: 'common', clue: 'gap', fact: 'Candy canes were first plain white sticks; the red stripes were added around 1900.' },
      { id: 'color-tunnel', name: 'Color tunnel', kind: 'tunnel', rarity: 'common', clue: 'sparkle', fact: 'White light is all the rainbow colors mixed together; a prism or raindrop splits them apart.' },
      { id: 'unicorn', name: 'Unicorn trail', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'The narwhal is the real "unicorn of the sea": its long spiral tusk is actually a tooth.' },
      { id: 'gold-pot', name: 'Pot of gold slide', kind: 'ice', rarity: 'uncommon', clue: 'sparkle', fact: 'You can never reach the end of a rainbow: it moves as you move, because it depends on where you stand.' },
      { id: 'rainbow-bridge', name: 'Rainbow bridge', kind: 'bridge', rarity: 'legendary', snow: 'slushy', clue: 'sparkle', fact: 'Seen from an airplane, a rainbow can be a full circle instead of an arch.' },
    ],
  },
  'bg-galaxy': {
    twist: 'Gravity wells bend your line. Use them!',
    mech: { wells: 1, air: 1.5 },
    shortcuts: [
      { id: 'ring-slide', name: 'Ring slide', kind: 'ice', rarity: 'common', clue: 'sparkle', fact: 'Saturn\'s rings are made of chunks of ice and rock, from grains of dust to pieces as big as houses.' },
      { id: 'asteroids', name: 'Asteroid hop', kind: 'jump', rarity: 'common', clue: 'sign', fact: 'Most asteroids in our solar system orbit the Sun in a belt between Mars and Jupiter.' },
      { id: 'star-gate', name: 'Star gate', kind: 'tunnel', rarity: 'common', clue: 'gap', fact: 'The light from some stars you see tonight left them thousands of years ago.' },
      { id: 'nebula', name: 'Nebula drift', kind: 'ride', rarity: 'common', clue: 'tracks', fact: 'A nebula is a giant cloud of gas and dust where new stars are born.' },
      { id: 'sun-flare', name: 'Sun flare bridge', kind: 'bridge', rarity: 'uncommon', clue: 'gap', fact: 'A solar flare can release more energy in minutes than people on Earth use in many years.' },
      { id: 'black-hole', name: 'Black hole slingshot', kind: 'ride', rarity: 'legendary', snow: 'icy', clue: 'sparkle', fact: 'Space probes use a planet\'s gravity as a slingshot to speed up, called a gravity assist.' },
    ],
  },
};

/** The course for a map (the meadow's for anything unknown). */
export const courseFor = (mapId) => COURSES[mapId] || COURSES['bg-meadow'];

/** Every shortcut on every map: [{ map, ...shortcut }], in book order. */
export const ALL_SHORTCUTS = Object.entries(COURSES).flatMap(([map, c]) => c.shortcuts.map((s) => ({ map, ...s })));

/**
 * Gear (Regular / Good / Super, from Fable's review 2026-11-21). Each tier changes what you
 * can do, not just a number: Good adds a boost and faster recovery, Super sees more of the hill,
 * gets an arrow to the nearest open shortcut and two boosts.
 */
export const SKI_GEAR = [
  null,
  { speed: 1, turn: 1, clue: 1, recover: 0.5, boosts: 0, zoom: 1, arrow: false, legend: 0.08, trail: 'plain' },
  { speed: 1.1, turn: 1.25, clue: 1.6, recover: 0.35, boosts: 1, zoom: 1, arrow: false, legend: 0.14, trail: 'spray' },
  { speed: 1.18, turn: 1.45, clue: 2.2, recover: 0.35, boosts: 2, zoom: 1.25, arrow: true, legend: 0.2, trail: 'gold' },
];
export const skiGear = (tier) => SKI_GEAR[Math.max(1, Math.min(3, tier || 1))];
