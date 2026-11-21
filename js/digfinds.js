// Dino dig finds: the skeletons, their bones, and every map's treasures, with real facts for
// the dig book; the shovel tiers; and how a round's finds are seeded into a dig site.
// Pure logic, no DOM (digart.js draws them, dig.js plays them).
//
// A skeleton is a skull and five bones. Three common dinosaurs (bones and skulls on every
// map) are easy to finish. The seven special ones each have their skull on ONE map only (that
// map's key piece), and every one can be finished on its skull map; a couple of other maps
// tease a few of its body bones. Maps with no skull have an extra special treasure instead.
//
// The kid's collection lives on the kid's synced record:
//   kid.digBones = { 'trex-skull': { n: 2, q: 3, date }, ... }   (q: best condition 1-3)
//   kid.digTreasures = { 'meadow-amethyst': { n: 1, q: 2, date }, ... }
//   kid.digShow = { skeleton: 'trike', pedestal: 'meadow-amethyst' }
//   kid.digDry = { 'bg-volcano': 2 }   rounds on a map since its skull or special turned up

import { CUE_KINDS } from './digsite.js';
export { CUE_KINDS };

export const RARITY = {
  common: { id: 'common', name: 'Common', points: 10, color: '#e9ecef' },
  uncommon: { id: 'uncommon', name: 'Uncommon', points: 20, color: '#8ce99a' },
  rare: { id: 'rare', name: 'Rare', points: 50, color: '#74c0fc' },
  skull: { id: 'skull', name: 'Key piece!', points: 100, color: '#ffd43b' },
  special: { id: 'special', name: 'Super special!', points: 150, color: '#f783ac' },
  critter: { id: 'critter', name: 'Just a critter', points: 1, color: '#c0eb75' },
};
// The clean lift: how well a find came out of the ground (like the sled's finds).
export const CONDITIONS = [
  null,
  { q: 1, name: 'Rough', stars: '★', mult: 1 },
  { q: 2, name: 'Fine', stars: '★★', mult: 1.5 },
  { q: 3, name: 'Perfect', stars: '★★★', mult: 2 },
];

/**
 * The shovels. walk: walking speed; zoom: how much of the site you see; screens: how wide the
 * site is (in views); odds: rare, skull and special finds; layers: what the first stroke of a
 * hole takes; test: the steel spade taps the ground when you stop (thud or tok);
 * sense: the golden shovel makes things within this many cells twinkle; double: chance a find
 * has a second one under it. stroke: seconds for one stroke.
 */
export const SHOVELS = [
  { tier: 1, name: 'Shovel', walk: 1, zoom: 1, screens: 2, odds: 1, first: 1, test: false, sense: 0, double: 0, stroke: 0.42 },
  { tier: 2, name: 'Steel spade', walk: 1.25, zoom: 1.2, screens: 2.5, odds: 1.75, first: 2, test: true, sense: 0, double: 0, stroke: 0.36 },
  { tier: 3, name: 'Golden shovel', walk: 1.35, zoom: 1.4, screens: 3, odds: 2.5, first: 2, test: true, sense: 3, double: 0.25, stroke: 0.32 },
];

const B = (part, name, shape, fact) => ({ part, name, shape, fact });

/**
 * The skeletons. skullMap: the one map with the skull (common ones: every map). pose: how the
 * skeleton stands on its display stand (digart.js). about: the book page's facts.
 */
export const DINOS = [
  {
    id: 'psitta', name: 'Psittacosaurus', say: 'SIT-ak-oh-SORE-us', common: true, pose: 'small-biped',
    about: {
      means: 'Parrot lizard', when: 'About 125 to 100 million years ago', where: 'Asia', size: 'About 6 feet long',
      eats: 'Plants', wow: 'Hundreds of skeletons have been found, and one fossil kept its colors: a dark back and a pale belly. It is an early cousin of Triceratops.',
    },
    bones: [
      B('skull', 'Psittacosaurus skull', 'skull', 'Its beak looked like a parrot\'s, perfect for snipping tough plants.'),
      B('horn', 'Cheek horn', 'horn', 'Little horns stuck out sideways from its cheeks.'),
      B('arm', 'Arm bone', 'arm', 'Short arms with four fingers. Grown-ups walked on two legs.'),
      B('ribs', 'Ribs', 'ribs', 'Stomach stones found inside its ribs helped it grind up food.'),
      B('leg', 'Leg bone', 'femur', 'Babies crawled on four legs and stood up on two as they grew.'),
      B('tail', 'Tail', 'tail', 'A row of long bristles stood up along the top of its tail.'),
    ],
  },
  {
    id: 'compy', name: 'Compsognathus', say: 'komp-SOG-nah-thus', common: true, pose: 'small-biped',
    about: {
      means: 'Dainty jaw', when: 'About 150 million years ago', where: 'Europe (Germany and France)', size: 'About 3 to 4 feet long, the size of a turkey',
      eats: 'Lizards and bugs', wow: 'It lived on warm islands next to Archaeopteryx, one of the first birds. Only two skeletons have ever been found!',
    },
    bones: [
      B('skull', 'Compsognathus skull', 'skull', 'Its skull was only about 3 inches long, with small sharp teeth.'),
      B('neck', 'Neck bones', 'neck', 'A long bendy neck for snapping up quick prey.'),
      B('hand', 'Hand claw', 'claw', 'Grasping claws for catching lizards.'),
      B('ribs', 'Ribs', 'ribs', 'One skeleton has a whole lizard inside its ribs: its last meal!'),
      B('leg', 'Leg bone', 'femur', 'Long shins are the mark of a fast runner.'),
      B('tail', 'Tail', 'tail', 'Its tail was more than half its length, for balance.'),
    ],
  },
  {
    id: 'edmonto', name: 'Edmontosaurus', say: 'ed-MON-toe-SORE-us', common: true, pose: 'duckbill',
    about: {
      means: 'Edmonton lizard', when: 'About 73 to 66 million years ago', where: 'North America, from Colorado all the way to Alaska', size: 'About 40 feet long',
      eats: 'Plants', wow: 'Some Edmontosaurus "mummies" still have their skin, and one showed a soft comb on its head like a rooster\'s.',
    },
    bones: [
      B('skull', 'Edmontosaurus skull', 'skull', 'A wide, flat, toothless beak, like a duck\'s bill.'),
      B('jaw', 'Jaw with teeth', 'jaw', 'Over 1,000 teeth packed in stacks. New ones kept growing in as old ones wore out.'),
      B('hand', 'Hand', 'arm', 'Mummies show its hand was a hoof-like mitten.'),
      B('ribs', 'Ribs', 'ribs', 'A huge barrel of ribs held a big belly for digesting tough plants.'),
      B('leg', 'Leg bone', 'femur', 'It could walk on four legs or run on two.'),
      B('tail', 'Tail', 'tail', 'One Edmontosaurus tail has a healed T. rex bite. It got away!'),
    ],
  },
  {
    id: 'trike', name: 'Triceratops', say: 'try-SAIR-uh-tops', skullMap: 'bg-meadow', pose: 'horned',
    about: {
      means: 'Three-horned face', when: '68 to 66 million years ago', where: 'North America', size: 'About 30 feet long, heavier than an elephant',
      eats: 'Plants', wow: 'Triceratops was one of the very last dinosaurs, alive right up until the asteroid hit.',
    },
    bones: [
      B('skull', 'Triceratops skull', 'skull', 'Up to about 8 feet long: one of the biggest skulls of any land animal ever.'),
      B('horn', 'Brow horn', 'horn', 'About 3 feet long. Young ones\' horns curved backward, then swung forward as they grew up.'),
      B('frill', 'Frill', 'frill', 'Solid bone. Some frills have healed T. rex tooth marks!'),
      B('arm', 'Front leg', 'arm', 'Sturdy front legs, with elbows a little bent.'),
      B('ribs', 'Ribs', 'ribs', 'A barrel belly for digesting plants.'),
      B('tail', 'Tail', 'tail', 'A short tail, held up off the ground.'),
    ],
  },
  {
    id: 'trex', name: 'Tyrannosaurus rex', short: 'T. rex', say: 'tie-RAN-oh-SORE-us rex', skullMap: 'bg-volcano', pose: 'big-biped',
    about: {
      means: 'Tyrant lizard king', when: '68 to 66 million years ago', where: 'North America', size: 'About 40 feet long and up to about 9 tons',
      eats: 'Other dinosaurs, like Triceratops and Edmontosaurus', wow: '"Sue", the T. rex in Chicago, is about 90% complete. T. rex had a super sense of smell.',
    },
    bones: [
      B('skull', 'T. rex skull', 'skull', 'Up to 5 feet long, with one of the strongest bites of any land animal: about 8,000 pounds or more.'),
      B('tooth', 'T. rex tooth', 'tooth', 'Banana-sized with its root, with edges like a steak knife.'),
      B('arm', 'Tiny arm', 'arm', 'Only about 3 feet long with two fingers, but strong.'),
      B('ribs', 'Ribs', 'ribs', 'Sue has ribs that broke and healed again.'),
      B('leg', 'Thigh bone', 'femur', 'About 4 feet long. Sue\'s is about 4 feet 4 inches!'),
      B('tail', 'Tail', 'tail', 'A heavy tail balanced its huge head, like a seesaw.'),
    ],
  },
  {
    id: 'stego', name: 'Stegosaurus', say: 'STEG-oh-SORE-us', skullMap: 'bg-castle', pose: 'plated',
    about: {
      means: 'Roof lizard', when: 'About 155 to 150 million years ago', where: 'The western USA, and Portugal too', size: 'Up to about 30 feet long',
      eats: 'Low plants like ferns', wow: 'T. rex lived closer in time to us than to Stegosaurus! It was found in Portugal because Europe and North America were much closer back then.',
    },
    bones: [
      B('skull', 'Stegosaurus skull', 'skull', 'Small and narrow, with a brain about the size of a lime.'),
      B('plate', 'Back plate', 'plate', '17 plates up to 2 feet tall, set in its skin, not joined to the skeleton.'),
      B('spike', 'Tail spike', 'horn', 'An Allosaurus bone has a hole that fits one! People call the spikes a "thagomizer", from a cartoon.'),
      B('arm', 'Front leg', 'arm', 'Short front legs kept its head low, near the ferns.'),
      B('leg', 'Back leg', 'femur', 'Much longer back legs, so its back sloped up to the hips.'),
      B('hip', 'Hip bone', 'hip', 'A space in its hips once made people think it had a second brain. It did not!'),
    ],
  },
  {
    id: 'raptor', name: 'Velociraptor', say: 'veh-LOSS-ih-rap-tor', skullMap: 'bg-sunset', pose: 'small-biped',
    about: {
      means: 'Swift thief', when: 'About 75 to 71 million years ago', where: 'The Gobi Desert in Mongolia, which had big sand dunes back then too', size: 'Turkey-sized: about 6 feet with its tail, about 30 pounds',
      eats: 'Small animals', wow: 'It had feathers! The movie ones are much too big. One was found locked in a fight with a Protoceratops.',
    },
    bones: [
      B('skull', 'Velociraptor skull', 'skull', 'Long and low, about 10 inches, with an upturned snout.'),
      B('claw', 'Sickle claw', 'claw', 'About 2.5 inches, held up off the ground so it stayed sharp.'),
      B('arm', 'Arm bone', 'arm', 'Little bumps where feathers attached proved it had feathers (2007).'),
      B('wish', 'Wishbone', 'wish', 'A wishbone just like a bird\'s.'),
      B('leg', 'Leg bone', 'femur', 'Built for quick dashes.'),
      B('tail', 'Tail', 'tail', 'Stiffened by bony rods, for balance as it turned.'),
    ],
  },
  {
    id: 'spino', name: 'Spinosaurus', say: 'SPY-no-SORE-us', skullMap: 'bg-rainforest', pose: 'sail',
    about: {
      means: 'Spine lizard', when: 'About 99 to 94 million years ago', where: 'North Africa, in a land of huge rivers', size: 'About 46 feet long, one of the longest meat eaters ever',
      eats: 'Giant fish', wow: 'Scientists still argue about how well it could swim. Its tail, found in 2020, was shaped like a paddle.',
    },
    bones: [
      B('skull', 'Spinosaurus skull', 'skull', 'Long and narrow, like a crocodile\'s.'),
      B('tooth', 'Spinosaurus tooth', 'tooth', 'Cone-shaped and smooth, for gripping slippery fish.'),
      B('sail', 'Sail spine', 'sail', 'Spines up to about 5 feet tall held up the sail on its back.'),
      B('claw', 'Hand claw', 'claw', 'Big hooked claws, maybe for hooking fish.'),
      B('leg', 'Back leg', 'femur', 'Oddly short, with heavy, solid bones.'),
      B('tail', 'Paddle tail', 'tail', 'Tall and flat like a paddle.'),
    ],
  },
  {
    id: 'pachy', name: 'Pachyrhinosaurus', say: 'PACK-ee-RYE-no-SORE-us', skullMap: 'bg-fjord', pose: 'horned',
    about: {
      means: 'Thick-nosed lizard', when: 'About 73 to 69 million years ago', where: 'Alaska and Canada. Alaska\'s were found in river bluffs on the North Slope', size: 'About 20 feet long',
      eats: 'Plants', wow: 'It lived through dark Arctic winters. A bone bed in Canada holds a whole herd!',
    },
    bones: [
      B('skull', 'Pachyrhinosaurus skull', 'skull', 'Instead of a nose horn, a thick, lumpy pad of bone called a boss.'),
      B('horn', 'Frill horn', 'horn', 'Curved horns and spikes on its frill, different in each kind.'),
      B('jaw', 'Lower jaw', 'jaw', 'A beak in front and slicing teeth behind.'),
      B('ribs', 'Ribs', 'ribs', 'A wide body for a big plant-eating belly.'),
      B('leg', 'Leg bone', 'femur', 'Stout legs for long walks with the herd.'),
      B('tail', 'Tail', 'tail', 'A short, thick tail, like its cousin Triceratops.'),
    ],
  },
  {
    id: 'mosa', name: 'Mosasaurus', say: 'MOE-zah-SORE-us', skullMap: 'bg-ocean', pose: 'swimmer', notDino: true,
    about: {
      means: 'Meuse lizard (a river in the Netherlands)', when: 'About 82 to 66 million years ago', where: 'Seas all over the world', size: 'About 40 feet long, as long as a bus',
      eats: 'Fish, turtles, even other sea reptiles', wow: 'It is NOT a dinosaur! It was a giant sea lizard, a cousin of monitor lizards and snakes, and it gave birth in the water.',
    },
    bones: [
      B('skull', 'Mosasaurus skull', 'skull', 'The first one was found in a Dutch mine in the 1700s, before anyone had a word for "dinosaur".'),
      B('jaw', 'Lower jaw', 'jaw', 'An extra hinge in the middle let it gulp big prey.'),
      B('teeth', 'Roof teeth', 'tooth', 'A second set of teeth on the roof of its mouth!'),
      B('flipper', 'Flipper', 'flipper', 'Its finger bones spread out into a paddle.'),
      B('back', 'Backbone', 'neck', 'More than 100 bones in its backbone.'),
      B('tail', 'Tail', 'tail', 'The end bent down to hold a tail fin like a shark\'s.'),
    ],
  },
];
export const dinoById = (id) => DINOS.find((d) => d.id === id);
export const boneKey = (dino, part) => `${dino}-${part}`;

const T = (id, name, rarity, cue, shape, colors, fact) => ({ id, name, rarity, cue, shape, colors, fact });

/**
 * Each map's site: its name, the start tip, its skull (or special treasure), which special
 * dinosaurs' bones are here (home: the skull map, lots; tease: a few), and its treasures.
 */
export const SITES = {
  'bg-meadow': {
    name: 'Meadow dig', skull: 'trike', twist: 'molehills', tip: 'Fresh molehills dig in one stroke!',
    tease: ['trex', 'stego'],
    treasures: [
      T('petwood', 'Petrified wood', 'common', 'bone', 'wood', ['#c98a4b', '#7a4a26', '#e9b77a'], 'Wood that slowly turned to stone, bit by bit. Arizona\'s stone logs are over 200 million years old.'),
      T('coprolite', 'Coprolite', 'common', 'bone', 'poop', ['#8a6a4a', '#4a3626', '#b08a5a'], 'Fossil poop! One T. rex coprolite is about 17 inches long and full of crushed bone.'),
      T('trilobite', 'Trilobite', 'uncommon', 'bone', 'trilo', ['#868e96', '#495057', '#ced4da'], 'A sea animal far older than the dinosaurs, with eyes made of crystal.'),
      T('amethyst', 'Amethyst', 'uncommon', 'gem', 'crystal', ['#9775fa', '#5f3dc4', '#e5dbff'], 'Purple quartz. Heat it up and it can turn yellow!'),
      T('egg', 'Dinosaur egg', 'rare', 'bone', 'egg', ['#d9c9a8', '#8d7a5a', '#f4ead0'], 'Even giant dinosaurs hatched from eggs no bigger than a soccer ball. Maiasaura nests in Montana showed that some dinosaurs cared for their babies.'),
    ],
  },
  'bg-castle': {
    name: 'Castle dig', skull: 'stego', twist: 'cellar', tip: 'One odd flagstone hides a secret cellar!',
    tease: ['trike', 'pachy'],
    treasures: [
      T('romancoin', 'Roman coin', 'common', 'made', 'coin', ['#c9a227', '#8a6a18', '#fff3bf'], 'Many castles stand on old Roman forts. In 2010 a finder in England reported a pot of 52,503 Roman coins to a museum.'),
      T('thimble', 'Brass thimble', 'common', 'made', 'bell', ['#e0b23a', '#8a6018', '#fff3bf'], 'A finger cap for sewing. People lost so many that they are a common find around old houses.'),
      T('lapis', 'Lapis lazuli', 'uncommon', 'gem', 'rock', ['#1c4fd6', '#0b2a7a', '#ffd43b'], 'A blue stone mined in Afghanistan for over 6,000 years. Ground up, it made a blue paint that cost more than gold.'),
      T('glass', 'Stained glass piece', 'uncommon', 'made', 'gem', ['#e03131', '#1c4fd6', '#ffc9c9'], 'Metals color glass: cobalt makes blue, and copper can make red or green.'),
      T('chessman', 'Old chess piece', 'rare', 'made', 'statue', ['#f1e6c8', '#9a8460', '#ffffff'], 'In 1831, 78 chess pieces carved about 800 years ago were found on a beach in Scotland.'),
    ],
  },
  'bg-sunset': {
    name: 'Beach dig', skull: 'raptor', twist: 'tide', tip: 'The tide goes out. Wet sand digs fast!',
    tease: ['spino', 'mosa'],
    treasures: [
      T('cowrie', 'Cowrie shell', 'common', 'gem', 'shell', ['#f4e4c8', '#a0522d', '#ffffff'], 'Smooth, shiny shells that people used as money for hundreds of years.'),
      T('coquina', 'Coquina', 'common', 'gem', 'rock', ['#e9d8b4', '#a88a5a', '#fff4e6'], 'Rock made of little bits of shell. A fort in Florida built of it swallowed cannonballs instead of cracking!'),
      T('fulgurite', 'Fulgurite', 'uncommon', 'gem', 'wood', ['#adb5bd', '#495057', '#f8f9fa'], 'A glass tube made when lightning, hotter than the surface of the Sun, melts sand.'),
      T('footprint', 'Dinosaur footprint', 'uncommon', 'bone', 'rock', ['#c9a066', '#7e5a38', '#e9d8b4'], 'A trace fossil. Scientists work out how fast a dinosaur ran from the space between its prints.'),
      T('bottle', 'Message in a bottle', 'rare', 'made', 'bell', ['#63e6be', '#087f5b', '#e6fcf5'], 'The oldest ever found was thrown from a ship in 1886 and turned up in Australia in 2018.'),
    ],
  },
  'bg-ocean': {
    name: 'Sea floor dig', skull: 'mosa', twist: 'current', tip: 'Swim over rocks! Watch for sand ripples.',
    tease: ['spino'],
    treasures: [
      T('coral', 'Fossil coral', 'common', 'gem', 'rock', ['#e9d8b4', '#a88a5a', '#fff4e6'], 'Coral adds a thin layer every day. Old corals show that a year once had about 400 days!'),
      T('nodule', 'Manganese nodule', 'common', 'gem', 'nugget', ['#495057', '#212529', '#868e96'], 'A metal lump from the deep sea floor. It grows a few millimeters in a million years, often around a shark tooth.'),
      T('sealily', 'Sea lily fossil', 'uncommon', 'bone', 'trilo', ['#c9a97a', '#8d6e63', '#e9d8b4'], 'An animal, not a plant: a cousin of starfish. Its stem breaks into pieces like tiny beads.'),
      T('bell', 'Ship\'s bell', 'uncommon', 'made', 'bell', ['#c9a227', '#6a4a12', '#fff3bf'], 'The name on a ship\'s bell is how divers know which wreck they found.'),
      T('astrolabe', 'Mariner\'s astrolabe', 'rare', 'made', 'coin', ['#e0b23a', '#6a4a12', '#fff3bf'], 'Sailors used it to find their way by the Sun. The oldest known was found in 2014 on a wreck that sank in 1503.'),
    ],
  },
  'bg-volcano': {
    name: 'Volcano dig', skull: 'trex', twist: 'hot', tip: 'Hot ground hides gems. Let your shovel cool!',
    tease: ['raptor', 'trike'],
    treasures: [
      T('basalt', 'Basalt column', 'common', 'gem', 'rock', ['#495057', '#212529', '#868e96'], 'Cooling lava cracks into six-sided pillars. The Giant\'s Causeway in Ireland has about 40,000!'),
      T('sulfur', 'Sulfur crystal', 'common', 'gem', 'crystal', ['#ffe066', '#e6a700', '#fff9db'], 'Yellow crystals grow at steam vents. Pure sulfur has no smell; the rotten-egg stink is a sulfur gas.'),
      T('zircon', 'Zircon', 'uncommon', 'gem', 'gem', ['#ff922b', '#a84420', '#ffe8cc'], 'Tiny, tough crystals from magma. The oldest are 4.4 billion years old: the oldest bits of Earth ever found.'),
      T('sunstone', 'Sunstone', 'uncommon', 'gem', 'gem', ['#ff8787', '#c92a2a', '#ffe3e3'], 'Found in Oregon lava flows. Flakes of copper inside make it glitter.'),
      T('diamond', 'Diamond in kimberlite', 'rare', 'gem', 'gem', ['#e7f5ff', '#74c0fc', '#ffffff'], 'Diamonds form about 100 miles down, and rare volcanic eruptions carry them up. Most are over a billion years old.'),
    ],
  },
  'bg-rainforest': {
    name: 'Rainforest dig', skull: 'spino', twist: 'rain', tip: 'Rain washes the riverbank. Watch for bone tips!',
    tease: ['stego', 'mosa'],
    treasures: [
      T('leaf', 'Fossil leaf', 'common', 'bone', 'shell', ['#8a9a5a', '#4a5a2a', '#c0d08a'], 'Leaves from a 58-million-year-old rainforest in Colombia, found with giant snake bones.'),
      T('cassava', 'Cassava root', 'common', 'made', 'wood', ['#c98a4b', '#7a4a26', '#f4ead0'], 'A root that feeds about 800 million people (it must be cooked). Boba pearls are made from it!'),
      T('titanoboa', 'Titanoboa backbone', 'uncommon', 'bone', 'bone', ['#c9a97a', '#8d6e63', '#e9d8b4'], 'From Titanoboa, the biggest snake ever: about 42 feet long.'),
      T('aquamarine', 'Aquamarine', 'uncommon', 'gem', 'crystal', ['#66d9e8', '#1098ad', '#e3fafc'], 'A sea-blue gem from Brazil. The biggest cut one is about 14 inches tall.'),
      T('slothclaw', 'Giant ground sloth claw', 'rare', 'bone', 'claw', ['#c9a97a', '#6e4a2a', '#e9d8b4'], 'From Eremotherium, a sloth as big as an elephant that walked on the ground.'),
    ],
  },
  'bg-fjord': {
    name: 'Fjord dig', skull: 'pachy', twist: 'ice', tip: 'Crack the ice first. Ice keeps finds fine!',
    tease: ['edmonto', 'trex'],
    treasures: [
      T('copper', 'Copper nugget', 'common', 'gem', 'nugget', ['#e8823a', '#8a3a12', '#ffd8a8'], 'Copper can be found as pure metal. The Statue of Liberty\'s skin is copper about as thick as two pennies.'),
      T('scratched', 'Glacier-scratched stone', 'common', 'gem', 'rock', ['#868e96', '#495057', '#dee2e6'], 'Glaciers drag rocks like sandpaper. The rock dust they make turns fjord water milky turquoise.'),
      T('bison', 'Steppe bison horn', 'uncommon', 'bone', 'horn', ['#5a4a3e', '#2a2226', '#8a7a6a'], 'A frozen ice-age bison called Blue Babe was found by Alaska gold miners in 1979.'),
      T('platinum', 'Platinum nugget', 'uncommon', 'gem', 'nugget', ['#dee2e6', '#868e96', '#ffffff'], 'Rarer than gold. One bay in Alaska was America\'s main source of it for years.'),
      T('cavelion', 'Cave lion tooth', 'rare', 'bone', 'tooth', ['#f1e6c8', '#9a8460', '#ffffff'], 'Lions lived in ice-age Alaska! A frozen cub found in Siberia still had its whiskers after 28,000 years.'),
    ],
  },
  'bg-space': {
    name: 'Moon dig', skull: null, twist: 'meteor', tip: 'Moon hops! A meteor will land. Dig where it hits!',
    tease: [],
    special: T('impactor', 'Dino-ender space rock', 'special', 'gem', 'rock', ['#343a40', '#121416', '#868e96'], 'A carbonaceous chondrite: the same kind of dark asteroid, about 6 miles wide, that hit Earth 66 million years ago and ended the age of dinosaurs.'),
    treasures: [
      T('moondust', 'Moon dust', 'common', 'gem', 'orb', ['#adb5bd', '#495057', '#f1f3f5'], 'Apollo astronauts said it smelled like burnt gunpowder. The grains are sharp, like tiny glass.'),
      T('micromet', 'Micrometeorite', 'common', 'gem', 'orb', ['#495057', '#212529', '#ced4da'], 'A space dust ball smaller than a grain of sand. About 5,000 tons fall on Earth every year, some on rooftops!'),
      T('shattercone', 'Shatter cone', 'uncommon', 'gem', 'arrow', ['#868e96', '#343a40', '#dee2e6'], 'Rock with cone-shaped ridges that only a giant impact can make.'),
      T('vesta', 'Vesta meteorite', 'uncommon', 'gem', 'rock', ['#ced4da', '#495057', '#f8f9fa'], 'A piece of the asteroid Vesta, which a spacecraft visited in 2011.'),
      T('golfball', 'Moon golf ball', 'rare', 'made', 'orb', ['#ffffff', '#adb5bd', '#ffffff'], 'Astronaut Alan Shepard hit two golf balls on the Moon in 1971. They are still up there!'),
    ],
  },
  'bg-rainbow': {
    name: 'Rainbow dig', skull: null, twist: 'bands', tip: 'The dirt\'s color tells what\'s below. Red: common, violet: rare!',
    tease: ['raptor', 'stego'],
    special: T('opalbone', 'Opalized dinosaur bone', 'special', 'bone', 'bone', ['#a5d8ff', '#e599f7', '#c3fae8'], 'At Lightning Ridge in Australia, some dinosaur bones turned to opal! A dinosaur named in 2019 was found this way.'),
    treasures: [
      T('malachite', 'Malachite', 'common', 'gem', 'rock', ['#2f9e44', '#0b5a1e', '#8ce99a'], 'A green copper mineral with swirly bands, ground into green paint since ancient Egypt.'),
      T('azurite', 'Azurite', 'common', 'gem', 'crystal', ['#1c4fd6', '#0b2a7a', '#74c0fc'], 'A deep blue copper mineral that slowly turns into malachite.'),
      T('tourmaline', 'Watermelon tourmaline', 'uncommon', 'gem', 'crystal', ['#f783ac', '#2f9e44', '#ffdeeb'], 'Pink in the middle, green outside. Warm it up and it pulls dust like a magnet.'),
      T('rhodo', 'Rhodochrosite', 'uncommon', 'gem', 'orb', ['#f783ac', '#c2255c', '#ffffff'], 'Pink and white rings. It is Argentina\'s national stone.'),
      T('alexandrite', 'Alexandrite', 'rare', 'gem', 'gem', ['#2f9e44', '#c2255c', '#b2f2bb'], 'Green in daylight and red by lamp light!'),
    ],
  },
  'bg-galaxy': {
    name: 'Galaxy dig', skull: null, twist: 'stars', tip: 'Each find lights a star. Follow the line to the next!',
    tease: ['trex', 'spino'],
    special: T('ureilite', 'Diamond meteorite', 'special', 'gem', 'star', ['#e7f5ff', '#495057', '#ffffff'], 'In 2008 astronomers spotted an asteroid hours before it hit Sudan, and students found pieces with tiny diamonds inside. Far away, a dead star called "Lucy" has a crystal heart of carbon about 2,500 miles wide!'),
    treasures: [
      T('heliodor', 'Heliodor', 'common', 'gem', 'crystal', ['#ffd43b', '#e67700', '#fff9db'], 'Golden beryl, a cousin of emerald. Its name means "gift of the sun".'),
      T('topaz', 'Golden topaz', 'common', 'gem', 'gem', ['#ffa94d', '#c2410c', '#fff4e6'], 'A museum in New York has one topaz crystal that weighs 596 pounds.'),
      T('starruby', 'Star ruby', 'uncommon', 'gem', 'orb', ['#e03131', '#7a0a0a', '#ffc9c9'], 'Tiny needles inside make a six-rayed star that glides as you turn it.'),
      T('stardust', 'Stardust grains', 'uncommon', 'gem', 'star', ['#fff3bf', '#ffd43b', '#ffffff'], 'Specks in a meteorite that fell in 1969 are up to 7 billion years old: older than the Sun!'),
      T('rutile', 'Golden rutile star', 'rare', 'gem', 'star', ['#ffd43b', '#a87820', '#fff9db'], 'Golden needles that grow out from a crystal in a six-pointed star.'),
    ],
  },
};

/** Critters that pop out of an empty hole (1 point, then they run off). */
export const CRITTERS = {
  default: [['worm', 'Earthworm'], ['grub', 'Beetle grub'], ['mole', 'Mole']],
  'bg-sunset': [['crab', 'Sand crab'], ['worm', 'Lugworm']],
  'bg-ocean': [['crab', 'Hermit crab'], ['worm', 'Sea worm']],
  'bg-space': [['bolt', 'Lost bolt']],
  'bg-galaxy': [['twinkle', 'Star sprite']],
};

// ---------- looking things up ----------
const ALL = new Map();
for (const d of DINOS) for (const b of d.bones) {
  const key = boneKey(d.id, b.part);
  ALL.set(key, {
    key, kind: 'bone', dino: { ...d, special: !d.common }, part: b.part, shape: b.shape, name: b.part === 'skull' ? b.name : `${d.short || d.name} ${b.name.toLowerCase()}`,
    short: b.name, fact: b.fact,
    rarity: b.part === 'skull' ? (d.common ? 'rare' : 'skull') : d.common ? 'common' : 'uncommon',
  });
}
for (const [map, s] of Object.entries(SITES)) {
  for (const t of [...s.treasures, ...(s.special ? [s.special] : [])]) {
    const key = `${map.replace(/^bg-/, '')}-${t.id}`;
    ALL.set(key, { ...t, key, kind: 'treasure', map, wowShort: null });
  }
}
for (const [map, list] of Object.entries(CRITTERS)) for (const [id, name] of list) ALL.set(`critter-${id}`, { key: `critter-${id}`, kind: 'critter', name, shape: id, rarity: 'critter' });
export const findInfo = (key) => ALL.get(key) || { key, kind: 'treasure', name: key, rarity: 'common', shape: 'rock' };
export const ALL_TREASURES = [...ALL.values()].filter((x) => x.kind === 'treasure');
export const digPoints = (key, q = 1) => Math.round(RARITY[findInfo(key).rarity].points * (CONDITIONS[q]?.mult || 1));

/** How many of a skeleton's six bones the kid has. */
export function skeletonProgress(dinoId, bones = {}) {
  const d = dinoById(dinoId);
  const have = d.bones.filter((b) => bones[boneKey(d.id, b.part)]).length;
  return { have, total: d.bones.length };
}
export const completeSkeletons = (bones = {}) => DINOS.filter((d) => skeletonProgress(d.id, bones).have === d.bones.length).map((d) => d.id);

/** The dinosaur of the day: its bones show up three times as often today, on every map. */
export function digOfDay(map, day = 'today') {
  const s = SITES[map] || SITES['bg-meadow'];
  const here = DINOS.filter((d) => d.common || d.id === s.skull || s.tease.includes(d.id));
  let h = 11; for (const ch of String(day)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const d = here[h % here.length];
  return { id: d.id, name: d.short || d.name };
}

// ---------- seeding a round ----------
export const DIG_PITY = 6; // the skull (or special) is sure to be there on this many rounds without it
/** The chance the map's skull or special treasure is buried this round. */
export const keyChance = (dry = 0, tier = 1) => Math.min(1, (0.15 + 0.17 * dry) * (1 + (SHOVELS[tier - 1].odds - 1) * 0.4));

const DEPTHS = [0, 0.1, 0.25, 0.3, 0.2, 0.15]; // how deep things usually are
function pickDepth(r, big) {
  if (big) return 3 + Math.floor(r() * 3);
  let x = r();
  for (let d = 1; d <= 5; d += 1) { x -= DEPTHS[d]; if (x <= 0) return d; }
  return 3;
}
function weighted(list, r) {
  const tot = list.reduce((s, [, w]) => s + w, 0); let x = r() * tot;
  for (const [v, w] of list) { x -= w; if (x <= 0) return v; }
  return list[list.length - 1][0];
}

/**
 * Seed a round's finds into the site's cells. cells: from dig.js (open, like.{bone,gem,made}).
 * opts: { tier, dry (rounds without the key piece), today ({ id }), bones (the kid's bones, so
 *   needed ones come up more), maps (the maps the kid owns), first (the kid's very first
 *   round: a Psittacosaurus bed with its skull near start), start: [x, y], count }
 * Returns { items: [{ key, cell, depth, bed, under? }], key: true when the skull/special is here }
 */
export function seedFinds(map, cells, r, opts = {}) {
  const site = SITES[map] || SITES['bg-meadow'];
  const tier = opts.tier || 1; const odds = SHOVELS[tier - 1].odds;
  const bones = opts.bones || {}; const maps = opts.maps;
  const items = []; const used = new Set();
  const open = cells.filter((c) => c.open && !c.noSeed);
  const pickCell = (kind, near = null, spread = 2) => {
    const list = [];
    for (const c of open) {
      if (used.has(c.idx)) continue;
      if (near) { const d = Math.max(Math.abs(c.i - near.i), Math.abs(c.j - near.j)); if (d < 1 || d > spread) continue; list.push([c, 1]); continue; }
      list.push([c, 0.12 + c.like[kind] ** 1.5]);
    }
    if (!list.length) return null;
    const c = weighted(list, r); used.add(c.idx); return c;
  };
  const add = (key, cell, big = false, bed = null) => { if (!cell) return null; const it = { key, cell: cell.idx, depth: pickDepth(r, big), bed }; items.push(it); return it; };

  // which dinosaurs' bones are here, and how much
  const homeDino = site.skull;
  const dinoW = [];
  for (const d of DINOS) {
    let w = d.common ? 2 : d.id === homeDino ? 3.2 : site.tease.includes(d.id) ? 0.7 : 0;
    if (!w) continue;
    // a special dinosaur whose skull map the kid doesn't have yet: only a few of its bones
    if (!d.common && d.id !== homeDino && maps && !maps.includes(d.skullMap)) w *= 0.25;
    if (opts.today?.id === d.id) w *= 3;
    dinoW.push([d, w]);
  }
  // teased dinosaurs only bring the bones that aren't their skull, and only 3 kinds of them
  const boneOf = (d) => {
    const parts = d.bones.filter((b) => b.part !== 'skull' || d.common);
    const teaseOnly = !d.common && d.id !== homeDino ? parts.slice(1, 4) : parts;
    const list = teaseOnly.map((b) => {
      const key = boneKey(d.id, b.part);
      let w = bones[key] ? 1 : 3; // needed bones come up more
      if (b.part === 'skull') w *= 0.35; // common skulls are a bit rarer
      return [key, w];
    });
    return weighted(list, r);
  };

  // the very first round: a Psittacosaurus bed with its skull, near where the kid starts
  if (opts.first) {
    const st = opts.start || [0, 0];
    const near = [...open].sort((a, b) => (Math.hypot(a.x - st[0], a.y - st[1]) - b.like.bone * 10) - (Math.hypot(b.x - st[0], b.y - st[1]) - a.like.bone * 10))[0];
    if (near) {
      used.add(near.idx);
      const sk = add('psitta-skull', near, false, 'first'); sk.depth = 2;
      for (const part of ['ribs', 'leg']) { const it = add(boneKey('psitta', part), pickCell('bone', near, 2), false, 'first'); if (it) it.depth = 1 + Math.floor(r() * 2); }
    }
  }

  // the map's key piece: its skull, or its special treasure
  let key = false;
  if (r() < keyChance(opts.dry || 0, tier)) {
    const c = pickCell(site.skull ? 'bone' : site.special.cue);
    if (c) {
      const k = site.skull ? boneKey(site.skull, 'skull') : `${map.replace(/^bg-/, '')}-${site.special.id}`;
      const it = add(k, c, true, site.skull ? 'key' : null);
      key = true;
      // the skull lies in a bed with a couple of its bones
      if (site.skull) for (let q = 0; q < 2; q += 1) add(boneOf(dinoById(site.skull)), pickCell('bone', c, 2), false, it.key);
    }
  }

  // everything else: about half bones (in beds of 2-3), half treasures
  const count = opts.count || 30;
  let beds = 0;
  while (items.length < count) {
    if (r() < 0.5) {
      const d = weighted(dinoW, r);
      const c0 = pickCell('bone'); if (!c0) break;
      const bed = `bed${beds += 1}`;
      add(boneOf(d), c0, false, bed);
      const more = 1 + Math.floor(r() * 2);
      for (let q = 0; q < more && items.length < count; q += 1) add(boneOf(d), pickCell('bone', c0, 2), false, bed);
    } else {
      const rare = site.treasures.filter((t) => t.rarity === 'rare');
      const list = site.treasures.map((t) => [t, t.rarity === 'common' ? 30 : t.rarity === 'uncommon' ? 14 : 3.5 * odds]);
      const t = weighted(list, r) || rare[0];
      add(`${map.replace(/^bg-/, '')}-${t.id}`, pickCell(t.cue), false, null);
    }
  }
  // the golden shovel: some finds have a second one right under them
  const dbl = SHOVELS[tier - 1].double;
  if (dbl) for (const it of items) {
    if (it.under || r() >= dbl) continue;
    if (it.depth >= 5) it.depth = 4;
    const t = weighted(site.treasures.map((x) => [x, x.rarity === 'common' ? 3 : 2]), r);
    it.under = `${map.replace(/^bg-/, '')}-${t.id}`;
  }
  return { items, key };
}

// ---------- the kid's collection ----------
/** Add a find to a record list ({ key: { n, q, date } }); answers 'new', 'better' or null. */
export function recordDig(records = {}, { key, q = 1, date }) {
  const old = records[key];
  if (!old) { records[key] = { n: 1, q, date }; return 'new'; }
  old.n += 1;
  if (q > (old.q || 1)) { old.q = q; old.date = date; return 'better'; }
  return null;
}
/** Bump the pity counter for a map after a round: 0 when the key piece turned up. */
export function nextDry(dry = 0, gotKey) { return gotKey ? 0 : Math.min(DIG_PITY - 1, dry + 1); }
