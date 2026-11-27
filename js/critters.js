// The animals of the photo train (js/phototrain.js): who lives on each map, when they come
// out, how they show themselves, and real facts for the critter album. Pure data and logic,
// no DOM (the pictures come from critterart.js).
//
// Taylor (2026-11-21): ride a train through the map and photograph animals that peek out;
// animals depend on the map and the season, with rare ones to hunt. Like the fish book, the
// pretend maps have pretend animals, and each one teaches about a real cousin.
//
// rarity: 'common' | 'uncommon' | 'rare' | 'legend' (one legend a map).
// how: the ways it shows itself (one is picked each time):
//   'step'    walks out from behind a tree or a rock, stops, looks at you, walks back
//   'rise'    comes up from behind a bush or a log (or out of a burrow), looks, ducks down
//   'perch'   flies in, lands on a branch, looks, flies off
//   'fly'     flies across the sky (a mover: a tracked shot is an Action shot)
//   'run'     runs along beside the train (a mover)
//   'surface' comes up out of the water, looks, goes back under (sea animals only ever leave this way)
//   'hop'     big slow hops (the moon), looks at you at the top of a hop
//   'far'     stands far off on the hills: only a zoom lens (Good camera and up) reaches it
//   'track'   stands on the track ahead: the train stops, and it poses a long time
// from: what it hides behind: 'tree' | 'bush' | 'log' | 'rock' | 'burrow' | 'water' | 'reeds' | 'sky' | 'hill'
// seasons: when it comes (all year if left out). weather: weather it likes (3 times likelier then).
// len: picture size in fine pixels (the game draws 2 fine pixels for each game pixel).
// cousin: (pretend animals) the real animal its page teaches about.
// where / eats / wow: a short paragraph each, true facts about the real animal.
// december: (the December animals) only out from 1 to 31 December; fun: a pretend line for its page.

import { inDecember } from './seasons.js';

const SUMMERY = ['spring', 'summer', 'autumn'];

export const CRITTERS = [
  // ---------- Forest Village (bg-meadow): North American woods ----------
  {
    id: 'meadow-deer', map: 'bg-meadow', name: 'White-tailed deer', rarity: 'common', how: ['step', 'step', 'run', 'track'], from: 'tree',
    look: { plan: 'quad', len: 38, fur: '#a0673a', belly: '#f1e3c8', horns: 'antler', hooves: true, legs: 0.55, tail: 'short', tailTag: 'belly' },
    where: 'White-tailed deer live in woods and fields from Canada all the way to South America. They like the edges of forests, where there are trees to hide in and open ground to eat in.',
    eats: 'Leaves, twigs, acorns, apples, grass and garden plants. They eat mostly at dawn and dusk.',
    wow: 'When a white-tailed deer is scared, it lifts its tail like a white flag and bounds away, so the rest of the herd sees it and runs too. It can jump over a fence taller than a grown-up.',
  },
  {
    id: 'meadow-cottontail', map: 'bg-meadow', name: 'Eastern cottontail', rarity: 'common', how: ['rise', 'rise', 'run'], from: 'bush', seasons: SUMMERY,
    look: { plan: 'hop', len: 22, fur: '#a68a6d', belly: '#ffffff', ears: 'long' },
    where: 'Cottontail rabbits live in meadows, hedges and backyards across most of North America. They rest in a shallow dip in the grass called a form.',
    eats: 'Grass and clover in summer, and twigs and bark in winter.',
    wow: 'A cottontail can run in zigzags at about 18 miles an hour to shake off a fox. Its fluffy white tail flashes as it runs, and that is how it got its name.',
  },
  {
    id: 'meadow-chipmunk', map: 'bg-meadow', name: 'Eastern chipmunk', rarity: 'common', how: ['rise', 'rise'], from: 'log', seasons: SUMMERY, weather: ['sunny'],
    look: { plan: 'small', len: 20, fur: '#b5651d', belly: '#f6e3c7', dark: '#3b2a20', tail: 'long', sits: true, ears: 'round', mark: 'stripes' },
    where: 'Chipmunks live in woods across eastern North America. They dig long tunnels with rooms for sleeping and for storing food.',
    eats: 'Nuts, seeds, berries, mushrooms and bugs.',
    wow: 'A chipmunk carries food in stretchy cheek pouches. Its pouches can hold more than 30 seeds at once! In one fall a chipmunk can store thousands of nuts and seeds for winter.',
  },
  {
    id: 'meadow-robin', map: 'bg-meadow', name: 'American robin', rarity: 'common', how: ['perch', 'perch', 'fly'], from: 'tree', seasons: ['spring', 'summer'], weather: ['rain'],
    look: { plan: 'bird', len: 20, fur: '#5c5048', belly: '#e8590c', beak: '#fcc419' },
    where: 'Robins live all over North America: in lawns, parks, woods and gardens. Many fly south in winter, and seeing one is a sign that spring is coming.',
    eats: 'Earthworms, bugs and berries. After rain, robins hop across lawns listening and looking for worms.',
    wow: 'Robin eggs are a bright sky blue, a color so famous it is called robin\'s egg blue.',
  },
  {
    id: 'meadow-frog', map: 'bg-meadow', name: 'Green frog', rarity: 'common', how: ['surface', 'rise'], from: 'water', seasons: ['spring', 'summer'], weather: ['rain'],
    look: { plan: 'frog', len: 18, fur: '#5c940d', belly: '#f4fce3', accent: '#fab005', mark: 'spots', dark: '#2b5d16', croak: false },
    where: 'Green frogs live at the edges of ponds, lakes and streams in eastern North America.',
    eats: 'Insects, spiders, worms, snails and even small fish. A frog flips out its sticky tongue faster than you can blink.',
    wow: 'A green frog\'s call sounds like someone plucking a loose banjo string: "gunk!"',
  },
  {
    id: 'meadow-monarch', map: 'bg-meadow', name: 'Monarch butterfly', rarity: 'uncommon', how: ['fly', 'perch'], from: 'sky', seasons: ['summer', 'autumn'], weather: ['sunny'],
    look: { plan: 'bug', len: 18, fur: '#f76707', belly: '#e8590c', dark: '#212529', mark: 'spots', accent: '#ffffff' },
    where: 'Monarchs live in fields and meadows across North America wherever milkweed grows.',
    eats: 'Caterpillars eat only milkweed leaves. Grown-up butterflies sip nectar from flowers.',
    wow: 'In the fall, millions of monarchs fly up to 3,000 miles to the same mountain forests in Mexico, where they hang from the trees in huge orange clusters all winter.',
  },
  {
    id: 'meadow-squirrel', map: 'bg-meadow', name: 'Eastern gray squirrel', rarity: 'common', how: ['step', 'rise'], from: 'tree',
    look: { plan: 'small', len: 22, fur: '#868e96', belly: '#f1f3f5', tail: 'bushy', tailUp: true, sits: true, ears: 'round' },
    where: 'Gray squirrels live in woods, parks and backyards with big trees across eastern North America.',
    eats: 'Acorns, nuts, seeds, buds and mushrooms.',
    wow: 'A squirrel buries thousands of nuts each fall and finds many of them again by smell, even under snow. The ones it forgets can grow into new trees!',
  },
  {
    id: 'meadow-raccoon', map: 'bg-meadow', name: 'Raccoon', rarity: 'uncommon', how: ['step', 'rise'], from: 'log', weather: ['mist'],
    look: { plan: 'small', len: 24, fur: '#868e96', belly: '#f1f3f5', dark: '#212529', tail: 'ring', mark: 'mask', brow: true, bodyH: 0.26, headR: 0.24, ears: 'round' },
    where: 'Raccoons live in woods near water all over North America, and in towns and cities too.',
    eats: 'Almost anything: crayfish, frogs, fruit, nuts, eggs, insects and the odd trash can snack.',
    wow: 'A raccoon\'s front paws are super sensitive, almost like hands. It feels around underwater for food, and the paws work even better when they are wet.',
  },
  {
    id: 'meadow-heron', map: 'bg-meadow', name: 'Great blue heron', rarity: 'uncommon', how: ['step', 'fly'], from: 'reeds', seasons: SUMMERY,
    look: { plan: 'wader', len: 40, fur: '#748ca8', beak: '#f59f00', mark: 'cap', dark: '#212529', bill: 0.4, face: '#e9ecef' },
    where: 'Great blue herons stand in shallow water at ponds, rivers, marshes and shores all over North America.',
    eats: 'Mostly fish, plus frogs, snakes and even mice. It stands perfectly still, then strikes like lightning.',
    wow: 'Great blue herons are about as tall as a 4 year old kid, but they weigh only about 5 or 6 pounds, because their bones are hollow.',
  },
  {
    id: 'meadow-fox', map: 'bg-meadow', name: 'Red fox', rarity: 'rare', how: ['step', 'rise', 'run'], from: 'bush',
    look: { plan: 'quad', len: 30, fur: '#e8590c', belly: '#ffffff', dark: '#3b2a20', tail: 'bushy', tip: true, legs: 0.36, ears: 'point', muzzle: true },
    where: 'Red foxes live in more parts of the world than any other wild dog: across North America, Europe, Asia and North Africa, in woods, fields and towns.',
    eats: 'Mice and voles most of all, plus rabbits, birds, bugs, berries and fruit.',
    wow: 'A fox can hear a mouse squeak under the snow. It leaps high into the air and dives nose first into the snow to catch it.',
  },
  {
    id: 'meadow-cardinal', map: 'bg-meadow', name: 'Northern cardinal', rarity: 'common', how: ['perch', 'perch'], from: 'tree', seasons: ['winter', 'spring'],
    look: { plan: 'bird', len: 20, fur: '#e03131', dark: '#212529', mark: 'mask', extra: 'crest', beak: '#ff922b', bigBill: true },
    where: 'Cardinals live in backyards, hedges and woodland edges across eastern North America. They don\'t fly south: you can see them all winter.',
    eats: 'Seeds (sunflower seeds are a favorite), berries and insects. Its thick beak cracks seeds open.',
    wow: 'A red cardinal on white snow is one of winter\'s brightest sights. Both the boys and the girls sing.',
  },
  {
    id: 'meadow-hare', map: 'bg-meadow', name: 'Snowshoe hare', rarity: 'uncommon', how: ['rise', 'run', 'step'], from: 'bush', seasons: ['winter'], weather: ['snow'],
    look: { plan: 'hop', len: 24, fur: '#f8f9fa', belly: '#ffffff', dark: '#343a40', ears: 'long' },
    where: 'Snowshoe hares live in the cold northern forests of Canada, Alaska and the northern United States.',
    eats: 'Grass and leaves in summer; twigs, buds and bark in winter.',
    wow: 'Snowshoe hares change color! They are brown in summer and turn white for winter, so they hide in the snow. Their huge furry back feet work like snowshoes.',
  },
  {
    id: 'meadow-owl', map: 'bg-meadow', name: 'Snowy owl', rarity: 'rare', how: ['perch', 'fly'], from: 'tree', seasons: ['winter'],
    look: { plan: 'big-bird', len: 26, fur: '#f8f9fa', belly: '#ffffff', owl: true, eye: '#fcc419', mark: 'spots', dark: '#495057', beak: '#343a40' },
    where: 'Snowy owls live on the Arctic tundra in summer. Some winters they fly south to open fields, beaches and even airports.',
    eats: 'Lemmings, which are like big chubby mice. One owl can eat over 1,000 lemmings in a year.',
    wow: 'Snowy owls hunt in the daytime, which most owls don\'t do. Their feet are covered in thick feathers, like fluffy slippers.',
  },
  {
    id: 'meadow-hawk', map: 'bg-meadow', name: 'Red-tailed hawk', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'big-bird', len: 26, fur: '#7a4a2a', belly: '#f1e3c8', tailTag: 'accent', accent: '#c2410c', beak: '#f0b429', dark: '#3b2414' },
    where: 'Red-tailed hawks live all over North America, in fields, deserts, forests and along highways, perched up high to watch for food.',
    eats: 'Mostly mice, voles, rabbits and squirrels.',
    wow: 'Its scream is so dramatic that movies often use it as the sound of an eagle!',
  },
  {
    id: 'meadow-bear', map: 'bg-meadow', name: 'American black bear', rarity: 'rare', how: ['far'], from: 'hill', seasons: SUMMERY,
    look: { plan: 'quad', len: 44, fur: '#2b2b33', legs: 0.3, bulk: 0.6, legW: 0.15, neck: 0.02, headIn: 0.08, ears: 'round', tail: 'none', headR: 0.25, muzzle: true, belly: '#c9a27a', snout: 1 },
    where: 'Black bears live in forests across North America, from Alaska to Mexico.',
    eats: 'Mostly plants: berries, nuts, grass and roots, plus insects, honey and fish.',
    wow: 'Black bears aren\'t always black: they can be brown, cinnamon, blond or even white. They sleep through most of the winter in a den.',
  },
  {
    id: 'meadow-bat', map: 'bg-meadow', name: 'Little brown bat', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'bat', len: 18, fur: '#6e4b2a', belly: '#4a3424', dark: '#2b1d12' },
    where: 'Little brown bats live across North America. They sleep in caves, tunnels, hollow trees and attics, hanging upside down.',
    eats: 'Flying insects: moths, beetles and lots of mosquitoes. One bat can catch hundreds of bugs in an hour.',
    wow: 'Bats "see" in the dark with sound. They shout high squeaks and listen for the echoes bouncing back off bugs and walls.',
  },
  {
    id: 'meadow-stag', map: 'bg-meadow', name: 'White stag', rarity: 'legend', how: ['step', 'track'], from: 'tree', cousin: 'a leucistic white-tailed deer',
    look: { plan: 'quad', len: 42, fur: '#f8f9fa', belly: '#ffffff', horns: 'antler', hooves: true, legs: 0.55, tail: 'short', eye: '#e03131', nose: '#f783ac' },
    where: 'A white stag is a white-tailed deer born almost all white. It lives in the same woods and fields as other white-tailed deer.',
    eats: 'The same as any white-tailed deer: leaves, twigs, acorns and grass.',
    wow: 'Fewer than 1 deer in 100 is born white, so seeing one is very lucky. In old stories a white stag was a magic animal that led heroes on adventures.',
  },

  // ---------- Alaskan Fjord (bg-fjord) ----------
  // Taylor's rules: one land animal at a time; sea animals only leave by going underwater;
  // land animals walk in and out from behind trees.
  {
    id: 'fjord-otter', map: 'bg-fjord', name: 'Sea otter', rarity: 'common', how: ['surface', 'surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'float', len: 30, fur: '#6f5a48', belly: '#d8c8b0', accent: '#adb5bd' },
    where: 'Sea otters live in the cold coastal waters of the North Pacific, from Alaska to California, often in forests of giant kelp.',
    eats: 'Sea urchins, crabs, clams and mussels. It floats on its back and cracks shells open on a rock balanced on its tummy.',
    wow: 'Sea otters have the thickest fur of any animal: up to a million hairs in a patch the size of a stamp. Mothers float with their babies on their chests, and otters hold paws while they sleep so they don\'t drift apart.',
  },
  {
    id: 'fjord-seal', map: 'bg-fjord', name: 'Harbor seal', rarity: 'common', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'head', seal: true, len: 28, fur: '#8a8f98', belly: '#ced4da', ears: 'none', headR: 0.2, mark: 'spots', dark: '#5c6068' },
    where: 'Harbor seals live along cold and cool coasts of the North Atlantic and North Pacific, resting on rocks and beaches between swims.',
    eats: 'Fish, squid, octopus and shrimp.',
    wow: 'A harbor seal can hold its breath for up to half an hour and dive deeper than 1,000 feet. Its whiskers feel the tiny swirls a swimming fish leaves in the water.',
  },
  {
    id: 'fjord-eagle', map: 'bg-fjord', name: 'Bald eagle', rarity: 'uncommon', how: ['perch', 'fly'], from: 'tree',
    look: { plan: 'big-bird', len: 28, fur: '#4a3424', headTag: 'belly', belly: '#ffffff', tailTag: 'belly', beak: '#fcc419', dark: '#2b1d12' },
    where: 'Bald eagles live near lakes, rivers and coasts across North America. Alaska has more bald eagles than any other state.',
    eats: 'Mostly fish, which it snatches from the water with its feet, plus ducks and leftovers.',
    wow: 'Bald eagles build the biggest nests of any North American bird. One nest was 9 feet across and weighed about as much as a small car! Their heads turn white when they are about 5 years old.',
  },
  {
    id: 'fjord-moose', map: 'bg-fjord', name: 'Moose', rarity: 'uncommon', how: ['step', 'track'], from: 'tree', land: true,
    look: { plan: 'quad', len: 54, fur: '#5a3d2b', belly: '#a08670', paler: true, horns: 'palm', hooves: true, legs: 0.55, extra: 'hump', snout: 1.6, headR: 0.17, tail: 'none', dewlap: true },
    where: 'Moose live in the northern forests of North America, Europe and Asia, near lakes, rivers and swamps.',
    eats: 'Willow and birch twigs, leaves and water plants. A moose eats about as much as 50 pounds of plants a day.',
    wow: 'Moose are the biggest deer in the world: a big male stands taller than a grown-up at the shoulder. They are great swimmers and can dive underwater to munch plants. A male grows new antlers every year.',
  },
  {
    id: 'fjord-bear', map: 'bg-fjord', name: 'Brown bear', rarity: 'uncommon', how: ['step'], from: 'tree', land: true, seasons: SUMMERY,
    look: { plan: 'quad', len: 46, fur: '#7a5230', legs: 0.3, bulk: 0.6, legW: 0.15, neck: 0.02, headIn: 0.08, ears: 'round', tail: 'none', headR: 0.25, extra: 'hump', snout: 1, muzzle: true, belly: '#a07850' },
    where: 'Brown bears (called grizzlies inland) live in Alaska, western Canada, Europe and Asia. Coastal Alaska bears gather at rivers when the salmon swim upstream.',
    eats: 'Salmon in summer, plus berries, roots, grass, clams and ground squirrels.',
    wow: 'A coastal brown bear can eat 30 salmon in one day to get fat for winter. Its shoulder hump is a big muscle for digging.',
  },
  {
    id: 'fjord-puffin', map: 'bg-fjord', name: 'Tufted puffin', rarity: 'uncommon', how: ['surface', 'fly'], from: 'water', sea: true, seasons: ['spring', 'summer'],
    look: { plan: 'bird', len: 20, fur: '#212529', belly: '#343a40', beak: '#fd7e14', bill: 0.2, bigBill: true, face: '#f8f9fa', tufts: '#fcc419' },
    where: 'Tufted puffins nest on rocky islands and cliffs in the North Pacific, from Alaska to California, and spend the winter far out at sea.',
    eats: 'Small fish and squid. It can carry a dozen little fish crosswise in its beak at once.',
    wow: 'Puffins "fly" underwater with their wings. In summer tufted puffins grow golden head feathers that curl back like eyebrows.',
  },
  {
    id: 'fjord-goat', map: 'bg-fjord', name: 'Mountain goat', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'quad', len: 36, fur: '#f8f9fa', horns: 'spike', hooves: true, legs: 0.4, bulk: 0.5, extra: 'beard', tail: 'short', ears: 'point', dark: '#212529' },
    where: 'Mountain goats live on steep, rocky mountains in Alaska, western Canada and the northern Rockies.',
    eats: 'Grass, moss, lichen and low bushes that grow on the cliffs.',
    wow: 'Mountain goats climb cliffs almost straight up. Their hooves have rough, grippy pads in the middle, like the soles of climbing shoes.',
  },
  {
    id: 'fjord-ptarmigan', map: 'bg-fjord', name: 'Willow ptarmigan', rarity: 'common', how: ['rise', 'fly'], from: 'bush', seasons: ['winter'], land: true,
    look: { plan: 'bird', len: 20, fur: '#f8f9fa', belly: '#ffffff', beak: '#343a40', tailTag: 'dark', dark: '#212529' },
    where: 'Willow ptarmigan live on the tundra and in willow thickets of Alaska, Canada and northern Europe and Asia. It is the state bird of Alaska.',
    eats: 'Willow buds and twigs in winter, plus leaves, berries and insects in summer.',
    wow: 'Ptarmigan turn white in winter and brown in summer. They dive into the snow to sleep in a snug snow cave.',
  },
  {
    id: 'fjord-lynx', map: 'bg-fjord', name: 'Canada lynx', rarity: 'rare', how: ['step'], from: 'tree', land: true,
    look: { plan: 'quad', len: 30, fur: '#b8a48a', legs: 0.24, bulk: 0.45, legW: 0.12, neck: 0.15, headR: 0.26, snout: 0.15, ears: 'lynx', tail: 'short', tailTag: 'dark', dark: '#2b2118', mark: 'spots', spotTag: 'dark', extra: 'ruff' },
    where: 'Canada lynx live in the snowy northern forests of Canada and Alaska.',
    eats: 'Snowshoe hares, mostly! When there are lots of hares, there are lots of lynx too.',
    wow: 'A lynx has huge furry paws that spread out like snowshoes, and black tufts on its ears that may help it hear.',
  },
  {
    id: 'fjord-orca', map: 'bg-fjord', name: 'Orca', rarity: 'rare', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'back', len: 56, fur: '#212529', belly: '#ffffff', accent: '#adb5bd', fin: 'tall', mark: 'patch', dark: '#111111', spout: false, back: 0.22 },
    where: 'Orcas live in every ocean, from the icy poles to warm seas. Some families stay close to the coast of Alaska and British Columbia all their lives.',
    eats: 'It depends on the family: some eat only fish like salmon, others hunt seals and even whales.',
    wow: 'Orcas live in families led by the grandmother, and each family has its own calls, like its own accent. The tall fin of a male can be 6 feet tall.',
  },
  {
    id: 'fjord-humpback', map: 'bg-fjord', name: 'Humpback whale', rarity: 'legend', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'back', len: 90, fur: '#343a40', belly: '#adb5bd', fin: 'small', dark: '#212529', back: 0.17 },
    where: 'Humpback whales swim in every ocean. They spend summer feeding in cold water like Alaska\'s and swim to warm water in winter to have their babies.',
    eats: 'Krill and small fish. A group blows a ring of bubbles around a school of fish, then swims up through the middle with mouths wide open.',
    wow: 'Male humpbacks sing long songs that can last 20 minutes and carry for miles underwater. A humpback can leap its whole 40-ton body out of the sea.',
  },

  // ---------- Moon base (bg-space): pretend animals with real cousins ----------
  {
    id: 'space-bunny', map: 'bg-space', name: 'Moon bunny', rarity: 'common', how: ['hop', 'rise'], from: 'rock', cousin: 'snowshoe hare',
    look: { plan: 'hop', len: 24, fur: '#e7e9f7', belly: '#ffffff', dark: '#7d82a8', ears: 'long', eye: '#5c7cfa' },
    where: 'Its real cousin, the snowshoe hare, lives in the cold northern forests of Canada, Alaska and the northern United States.',
    eats: 'Snowshoe hares eat grass and leaves in summer, and twigs, buds and bark in winter.',
    wow: 'Snowshoe hares turn white in winter and brown in summer, and their big furry back feet work like snowshoes. In stories from Asia, people see a rabbit in the moon!',
  },
  {
    id: 'space-crab', map: 'bg-space', name: 'Crater crab', rarity: 'common', how: ['rise', 'step'], from: 'rock', cousin: 'hermit crab',
    look: { plan: 'crab', len: 22, fur: '#9775fa' },
    where: 'Its real cousin, the hermit crab, lives on beaches and in shallow seas around the world.',
    eats: 'Hermit crabs eat almost anything: dead plants and animals, seaweed and leftovers.',
    wow: 'A hermit crab has a soft tail, so it lives inside an empty snail shell. When it grows, it hunts for a bigger shell, and sometimes crabs line up by size and swap shells!',
  },
  {
    id: 'space-owl', map: 'bg-space', name: 'Dust owl', rarity: 'uncommon', how: ['rise', 'perch'], from: 'burrow', cousin: 'burrowing owl',
    look: { plan: 'big-bird', len: 22, fur: '#adb5bd', belly: '#f1f3f5', owl: true, eye: '#ffd43b', mark: 'spots', dark: '#5c5f8a', beak: '#5c5f8a' },
    where: 'Its real cousin, the burrowing owl, lives in grasslands and deserts of North and South America, in holes in the ground.',
    eats: 'Burrowing owls eat beetles, grasshoppers, mice and lizards.',
    wow: 'Burrowing owls live underground in old prairie dog holes. When a snake comes, a baby owl can hiss like a rattlesnake to scare it off.',
  },
  {
    id: 'space-moth', map: 'bg-space', name: 'Glow moth', rarity: 'common', how: ['fly', 'perch'], from: 'sky', cousin: 'luna moth',
    look: { plan: 'bug', len: 20, fur: '#96f2d7', belly: '#c3fae8', dark: '#495057', mark: 'spots', accent: '#ffd43b' },
    where: 'Its real cousin, the luna moth, lives in the forests of eastern North America.',
    eats: 'Luna moth caterpillars eat leaves of walnut, birch and sweetgum trees. Grown-up luna moths don\'t eat at all: they have no mouth!',
    wow: 'Luna moths are pale green with long swirly tails on their back wings. The tails spin as they fly and confuse bats that hunt them.',
  },
  {
    id: 'space-fox', map: 'bg-space', name: 'Star fox', rarity: 'rare', how: ['step', 'run'], from: 'rock', cousin: 'arctic fox',
    look: { plan: 'quad', len: 30, fur: '#e7f5ff', belly: '#ffffff', tail: 'bushy', legs: 0.32, ears: 'round', eye: '#4c6ef5', accent: '#ffd43b', mark: 'spots', spotTag: 'accent' },
    where: 'Its real cousin, the arctic fox, lives on the frozen tundra around the North Pole.',
    eats: 'Arctic foxes eat lemmings, birds, eggs, fish and leftovers from polar bear meals.',
    wow: 'Arctic foxes are white in winter and brown in summer. They curl their fluffy tail over their nose like a scarf, and can stay warm at 50 degrees below zero.',
  },
  {
    id: 'space-goat', map: 'bg-space', name: 'Crater goat', rarity: 'uncommon', how: ['far'], from: 'hill', cousin: 'bighorn sheep',
    look: { plan: 'quad', len: 36, fur: '#9a9fc4', belly: '#e7e9f7', horns: 'curl', hooves: true, legs: 0.42, bulk: 0.5, tail: 'short', extra: 'beard' },
    where: 'Its real cousin, the bighorn sheep, lives in the mountains and deserts of western North America.',
    eats: 'Bighorn sheep eat grass and low desert plants.',
    wow: 'Male bighorns crash their huge curly horns together in contests. You can hear the crack a mile away! Their horns can weigh as much as all the rest of their bones together.',
  },
  {
    id: 'space-whale', map: 'bg-space', name: 'Moon whale', rarity: 'legend', how: ['fly'], from: 'sky', cousin: 'blue whale',
    look: { plan: 'swim', swim: 'back', len: 100, fur: '#5c7cfa', belly: '#dbe4ff', fin: 'small', dark: '#3b5bdb', spout: false, back: 0.17 },
    where: 'Its real cousin, the blue whale, swims in every ocean except the Arctic.',
    eats: 'Blue whales eat krill, tiny shrimp-like animals: up to 4 tons of them a day.',
    wow: 'The blue whale is the biggest animal that has ever lived, bigger than any dinosaur. Its heart is about the size of a golf cart, and its deep calls can travel hundreds of miles underwater.',
  },
  // ---------- Castle (bg-castle): an English castle, its moat and its gardens ----------
  // Twist: the drawbridge stop (the train waits at the moat, and moat animals come up in a row).
  {
    id: 'castle-squirrel', map: 'bg-castle', name: 'Red squirrel', rarity: 'common', how: ['step', 'rise'], from: 'tree',
    look: { plan: 'small', len: 26, fur: '#b5532a', belly: '#f3e3c3', ears: 'tuft', tail: 'bushy', tailUp: true, sits: true },
    where: 'Red squirrels live in pine and mixed woods across Europe and northern Asia. In Britain they are rare now and live mostly in Scotland.',
    eats: 'Pine cone seeds, hazelnuts, beech nuts, mushrooms and berries.',
    wow: 'A red squirrel hides thousands of nuts every autumn and finds many again by smell, even under snow. Its ear tufts grow long and fluffy in winter.',
  },
  {
    id: 'castle-jackdaw', map: 'bg-castle', name: 'Jackdaw', rarity: 'common', how: ['perch', 'perch', 'fly'], from: 'tower',
    look: { plan: 'bird', len: 20, fur: '#495057', belly: '#343a40', mark: 'cap', dark: '#111111', eye: '#e9ecef', beak: '#212529' },
    where: 'Jackdaws live across Europe, western Asia and North Africa. They love to nest in holes in old buildings, chimneys and castle towers.',
    eats: 'Insects, worms, seeds, fruit and scraps.',
    wow: 'Jackdaws are clever crows with pale silver eyes. Pairs stay together for life, and they can tell when a person is looking at them and follow where the person looks.',
  },
  {
    id: 'castle-swan', map: 'bg-castle', name: 'Mute swan', rarity: 'common', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'swan', len: 40, fur: '#f8f9fa', beak: '#fd7e14', dark: '#111111' },
    where: 'Mute swans live on lakes, rivers, ponds and moats across Europe and Asia, and have been brought to North America too.',
    eats: 'Water plants, which it reaches by dipping its long neck under the water.',
    wow: 'A mute swan is one of the heaviest flying birds. In England, the King or Queen has owned wild mute swans on open water for hundreds of years, and every summer they are counted on the River Thames.',
  },
  {
    id: 'castle-hedgehog', map: 'bg-castle', name: 'European hedgehog', rarity: 'common', how: ['rise', 'rise', 'step'], from: 'bush', seasons: SUMMERY,
    look: { plan: 'small', len: 24, fur: '#8a6a4a', belly: '#e6d3b0', mark: 'spines', dark: '#4a3a2a', ears: 'round', tail: 'none', bodyH: 0.24, headR: 0.17 },
    where: 'European hedgehogs live in hedges, woods, parks and gardens across western Europe.',
    eats: 'Beetles, caterpillars, worms and slugs, which it finds at night with its nose.',
    wow: 'A hedgehog has about 5,000 spines and rolls into a prickly ball when it is scared. It hibernates all winter, which is why you only see it from spring to autumn.',
  },
  {
    id: 'castle-swallow', map: 'bg-castle', name: 'Barn swallow', rarity: 'common', how: ['fly', 'fly', 'perch'], from: 'sky', seasons: ['spring', 'summer'],
    look: { plan: 'bird', len: 18, fur: '#1c3d8a', belly: '#f1e3d3', face: '#c0392b', tail: 'long', tailTag: 'dark', dark: '#14285a', beak: '#212529' },
    where: 'Barn swallows nest in barns, stables and old buildings across the Northern Hemisphere, and fly south for the winter.',
    eats: 'Flying insects, which it catches in the air while swooping low over fields and water.',
    wow: 'Swallows from Britain fly all the way to South Africa for the winter, about 6,000 miles, and often come back to the very same barn in spring.',
  },
  {
    id: 'castle-peacock', map: 'bg-castle', name: 'Indian peafowl', rarity: 'uncommon', how: ['step', 'step'], from: 'bush', weather: ['sunny'],
    look: { plan: 'bird', len: 30, fur: '#1864ab', belly: '#1971c2', train: true, accent: '#2b8a3e', extra: 'crest', beak: '#adb5bd' },
    where: 'Peafowl come from the forests of India and Sri Lanka. For hundreds of years people have kept them in the gardens of castles and palaces all over the world.',
    eats: 'Seeds, grain, insects, small lizards and even small snakes.',
    wow: 'The male (the peacock) has a train of over 200 long feathers covered in shiny "eyes". He fans it out and shakes it so it rattles to impress the females.',
  },
  {
    id: 'castle-badger', map: 'bg-castle', name: 'European badger', rarity: 'uncommon', how: ['rise', 'step'], from: 'burrow', weather: ['mist'],
    look: { plan: 'small', len: 34, fur: '#868e96', belly: '#212529', dark: '#111111', mark: 'mask', brow: true, ears: 'round', tail: 'short', bodyH: 0.24, headR: 0.2 },
    where: 'European badgers live in woods and fields across Europe, in big underground homes called setts.',
    eats: 'Mostly earthworms (hundreds in a night!), plus beetles, bulbs, fruit and nuts.',
    wow: 'Some badger setts are over a hundred years old, with dozens of tunnels and rooms dug by many families. Badgers air out their bedding of grass and leaves on sunny days.',
  },
  {
    id: 'castle-deer', map: 'bg-castle', name: 'Red deer', rarity: 'uncommon', how: ['step', 'track'], from: 'tree',
    look: { plan: 'quad', len: 50, fur: '#8b4a2b', belly: '#c9a27a', horns: 'antler', hooves: true, legs: 0.5, tail: 'short', tailTag: 'belly', extra: 'mane', accent: '#5c3018' },
    where: 'Red deer live in woods, moors and mountains across Europe and parts of Asia. Many castles in Britain had deer parks for them.',
    eats: 'Grass, heather, leaves, shoots and bark.',
    wow: 'Each autumn a red deer stag roars to show off. His antlers fall off in late winter and grow back by summer, a little bigger each year.',
  },
  {
    id: 'castle-kite', map: 'bg-castle', name: 'Red kite', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'big-bird', len: 26, fur: '#a0461f', headTag: 'belly', belly: '#dee2e6', tailTag: 'accent', accent: '#c2571a', mark: 'wingbar', dark: '#2b1d12' },
    where: 'Red kites soar over farmland and woods in Europe. They nearly vanished from Britain but were brought back, and now there are thousands again.',
    eats: 'Mostly leftovers and dead animals, plus worms and small animals.',
    wow: 'A red kite steers with its forked tail and hardly flaps at all. It decorates its nest with bits of cloth, paper and even toys.',
  },
  {
    id: 'castle-falcon', map: 'bg-castle', name: 'Peregrine falcon', rarity: 'rare', how: ['far'], from: 'hill',
    look: { plan: 'big-bird', len: 24, fur: '#495057', belly: '#f1f3f5', mark: 'wingbar', dark: '#212529', beak: '#fcc419' },
    where: 'Peregrine falcons live on every continent except Antarctica. They nest on cliffs, and also on tall towers, castles and cathedrals.',
    eats: 'Other birds, which it catches in mid-air.',
    wow: 'Diving after prey, a peregrine falcon can go over 200 miles an hour. That makes it the fastest animal on Earth!',
  },
  {
    id: 'castle-otter', map: 'bg-castle', name: 'Eurasian otter', rarity: 'rare', how: ['surface'], from: 'water', sea: true, shy: true,
    look: { plan: 'swim', swim: 'head', len: 28, fur: '#5c4030', belly: '#c8b49a', ears: 'round', whiskers: true, headR: 0.17, muzzle: true },
    where: 'Eurasian otters live along rivers, lakes and coasts across Europe and Asia. They are shy and mostly come out at dusk.',
    eats: 'Fish, mostly, plus frogs, crayfish and water birds.',
    wow: 'An otter can close its ears and nose underwater, and its whiskers feel for fish in muddy water. It leaves smelly droppings called spraints on rocks so other otters know whose river it is.',
  },
  {
    id: 'castle-owl', map: 'bg-castle', name: 'Barn owl', rarity: 'rare', how: ['perch', 'fly'], from: 'tower',
    look: { plan: 'big-bird', len: 24, fur: '#d9a35f', belly: '#ffffff', headTag: 'belly', owl: true, beak: '#e9d8b4' },
    where: 'Barn owls live on every continent except Antarctica, roosting in barns, church towers, ruins and hollow trees.',
    eats: 'Mice, voles and shrews. One owl family can eat thousands in a year.',
    wow: 'A barn owl\'s heart-shaped face works like a satellite dish, steering sounds to its ears. It can catch a mouse in total darkness by sound alone.',
  },
  {
    id: 'castle-dragon', map: 'bg-castle', name: 'Castle dragon', rarity: 'legend', how: ['step', 'track'], from: 'rock', cousin: 'Komodo dragon',
    look: { plan: 'quad', len: 60, fur: '#2f9e44', belly: '#d8f5a2', extra: 'wings', wingL: 1.5, accent: '#c92a2a', tail: 'long', horns: 'spike', legs: 0.32, bulk: 0.42, headR: 0.18, snout: 1.4, eye: '#fcc419', dark: '#1b4d28', ears: 'none' },
    where: 'Its real cousin, the Komodo dragon, lives on a few small islands in Indonesia, like Komodo and Flores.',
    eats: 'Komodo dragons eat deer, wild pigs and water buffalo, and a big one can eat most of its own weight in one meal.',
    wow: 'The Komodo dragon is the biggest lizard in the world, as long as a canoe. It flicks its forked tongue to smell food from miles away.',
  },
  {
    id: 'castle-bat', map: 'bg-castle', name: 'Common pipistrelle', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'bat', len: 20, fur: '#7a5a3a', belly: '#4a3a2a' },
    where: 'Common pipistrelles live across Europe, roosting in old buildings, walls and roofs.',
    eats: 'Midges and mosquitoes: one pipistrelle can eat 3,000 tiny insects in a night.',
    wow: 'A pipistrelle is small enough to fit in a matchbox, and it finds bugs in the dark by shouting high squeaks and listening for the echoes.',
  },

  // ---------- Sunset beach (bg-sunset): a Florida and Caribbean beach at golden hour ----------
  // Twist: the sun sets during the ride. day: only before the finale; dusk: only in the finale.
  {
    id: 'sunset-gull', map: 'bg-sunset', name: 'Laughing gull', rarity: 'common', how: ['perch', 'fly', 'fly'], from: 'tree', day: true,
    look: { plan: 'bird', len: 22, fur: '#f1f3f5', belly: '#ffffff', wingTag: 'accent', accent: '#868e96', mark: 'cap', dark: '#212529', beak: '#c92a2a' },
    where: 'Laughing gulls live along the Atlantic and Gulf coasts of North America and around the Caribbean.',
    eats: 'Fish, crabs, insects and snacks stolen from beach picnics.',
    wow: 'Its call sounds just like a person laughing: "ha-ha-ha-haaa". In summer it grows a black hood, and in winter the hood fades to grey.',
  },
  {
    id: 'sunset-sanderling', map: 'bg-sunset', name: 'Sanderling', rarity: 'common', how: ['run', 'run', 'step'], from: 'reeds', day: true,
    look: { plan: 'wader', len: 16, fur: '#dee2e6', face: '#f8f9fa', bill: 0.25, beak: '#212529', dark: '#343a40' },
    where: 'Sanderlings nest in the far Arctic and spend the winter on sandy beaches all over the world.',
    eats: 'Tiny crabs, clams and worms in the wet sand.',
    wow: 'Sanderlings run after each wave as it goes out to grab food, then race back before the next wave comes in, like a game of tag with the sea.',
  },
  {
    id: 'sunset-pelican', map: 'bg-sunset', name: 'Brown pelican', rarity: 'common', how: ['fly', 'perch'], from: 'tree', day: true,
    look: { plan: 'bird', len: 30, fur: '#7a6a58', belly: '#a0907a', face: '#fff3bf', bill: 0.5, bigBill: true, beak: '#d9a35f' },
    where: 'Brown pelicans live along the warm coasts of the Americas, from the Carolinas and California down to South America.',
    eats: 'Fish, which it scoops up in the stretchy pouch under its beak.',
    wow: 'A brown pelican dives into the sea head first from high in the air. Its pouch can hold about three gallons of water, more than its stomach can hold.',
  },
  {
    id: 'sunset-crab', map: 'bg-sunset', name: 'Atlantic ghost crab', rarity: 'common', how: ['rise', 'rise', 'run'], from: 'burrow', dusk: true,
    look: { plan: 'crab', len: 22, fur: '#f3e6c4' },
    where: 'Atlantic ghost crabs live on sandy beaches from the eastern United States down to Brazil.',
    eats: 'Clams, insects, turtle eggs and anything washed up by the waves.',
    wow: 'Ghost crabs are sand-colored, so they seem to vanish. They come out at dusk and can run 10 miles an hour sideways, then pop down into a burrow.',
  },
  {
    id: 'sunset-iguana', map: 'bg-sunset', name: 'Green iguana', rarity: 'uncommon', how: ['step', 'step'], from: 'rock', weather: ['sunny'], day: true,
    look: { plan: 'lizard', len: 44, fur: '#5c940d', extra: 'crest', accent: '#d9e95a', mark: 'stripes', dark: '#2b4a10' },
    where: 'Green iguanas come from the forests of Central and South America and the Caribbean, and now live wild in Florida too.',
    eats: 'Leaves, flowers and fruit. Grown-up iguanas are plant eaters.',
    wow: 'Iguanas bask in the sun to warm up. If one falls out of a tree it can drop 40 feet and land unhurt, and it can stay underwater for nearly half an hour.',
  },
  {
    id: 'sunset-spoonbill', map: 'bg-sunset', name: 'Roseate spoonbill', rarity: 'uncommon', how: ['step', 'fly'], from: 'reeds',
    look: { plan: 'wader', len: 32, fur: '#f783ac', face: '#f8f9fa', beak: '#adb5bd', bill: 0.32, dark: '#c2255c' },
    where: 'Roseate spoonbills wade in shallow coastal water and mangroves from Florida and Texas down to South America.',
    eats: 'Shrimp, small fish and water bugs. It swishes its flat spoon-shaped bill from side to side in the water and snaps it shut on food.',
    wow: 'Spoonbills are pink because of what they eat: the shrimp and bugs have the same pink color that makes flamingos pink.',
  },
  {
    id: 'sunset-dolphin', map: 'bg-sunset', name: 'Bottlenose dolphin', rarity: 'uncommon', how: ['surface', 'far'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'back', len: 50, fur: '#6d7f94', belly: '#dee2e6', fin: 'mid', rostrum: true, spout: false, back: 0.2 },
    where: 'Bottlenose dolphins live in warm and mild seas all over the world, often close to the shore.',
    eats: 'Fish, squid and shrimp, which they find by clicking and listening to the echoes.',
    wow: 'Every bottlenose dolphin has its own signature whistle, like a name, and friends call each other by it. Dolphins sleep with one half of the brain at a time.',
  },
  {
    id: 'sunset-hatchling', map: 'bg-sunset', name: 'Sea turtle hatchling', rarity: 'uncommon', how: ['run'], from: 'burrow', seasons: ['summer', 'autumn'], dusk: true,
    look: { plan: 'turtle', flippers: true, len: 14, fur: '#3d3a30', shell: '#4a4436', belly: '#5c5444', headR: 0.14 },
    where: 'Baby loggerhead sea turtles hatch on beaches in Florida, the Caribbean and warm coasts around the world, then swim out to the open ocean.',
    eats: 'Tiny sea creatures and floating seaweed out in the ocean.',
    wow: 'Hatchlings dig out of the sand together after dark and race to the sea, finding it by the light shining on the water. That is why beaches turn off bright lights in nesting season.',
  },
  {
    id: 'sunset-turtle', map: 'bg-sunset', name: 'Loggerhead sea turtle', rarity: 'rare', how: ['surface', 'track'], from: 'water', sea: true, seasons: ['spring', 'summer'], dusk: true,
    look: { plan: 'turtle', flippers: true, len: 44, fur: '#b5651d', shell: '#8a4a20', belly: '#f3d9a4', headR: 0.13 },
    where: 'Loggerhead sea turtles swim in warm oceans around the world. Florida has more loggerhead nests than almost anywhere else.',
    eats: 'Crabs, clams, conchs and jellyfish, crunched with its big strong jaws.',
    wow: 'A mother loggerhead crawls up the beach at night to dig a nest and lay about 100 eggs, often on the same beach where she hatched 30 years before.',
  },
  {
    id: 'sunset-frigate', map: 'bg-sunset', name: 'Magnificent frigatebird', rarity: 'rare', how: ['far', 'fly'], from: 'hill',
    look: { plan: 'bird', len: 26, fur: '#212529', belly: '#343a40', mark: 'chest', accent: '#e03131', tail: 'long', tailTag: 'dark', beak: '#adb5bd', bill: 0.2 },
    where: 'Magnificent frigatebirds soar over warm seas from Florida and Mexico to South America, and nest on islands.',
    eats: 'Fish and squid snatched from the water, and food stolen from other seabirds in mid-air.',
    wow: 'A frigatebird can glide for days without landing. The male puffs up a huge red balloon on his throat to show off to females.',
  },
  {
    id: 'sunset-manatee', map: 'bg-sunset', name: 'West Indian manatee', rarity: 'legend', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'back', len: 70, fur: '#9a9f92', belly: '#adb5bd', roundSnout: true, spout: false, back: 0.15 },
    where: 'West Indian manatees live in warm, shallow coastal water, rivers and springs from Florida and the Caribbean to Brazil.',
    eats: 'Sea grass and water plants: up to 10% of its own weight every day.',
    wow: 'Manatees are gentle giants called "sea cows", and their closest living relatives are elephants. They come up to breathe every few minutes and can live over 60 years.',
  },
  {
    id: 'sunset-bat', map: 'bg-sunset', name: 'Jamaican fruit bat', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'bat', len: 22, fur: '#6b5a48', belly: '#3d3328' },
    where: 'Jamaican fruit bats live in Mexico, Central America, the Caribbean islands and the Florida Keys, roosting in caves and hollow trees.',
    eats: 'Figs, mangoes and other fruit, which it carries away to eat in peace.',
    wow: 'By dropping fruit seeds as they fly, Jamaican fruit bats plant new trees all over the forest, like flying gardeners.',
  },

  // ---------- Under the sea (bg-ocean): a glass tube train along an Indo-Pacific coral reef ----------
  // 'fly' is swimming across; the tunnel is a sea cave. Twist: the octopus hides as a rock (camo).
  {
    id: 'ocean-clownfish', map: 'bg-ocean', name: 'Clownfish', rarity: 'common', how: ['rise', 'rise'], from: 'anemone',
    look: { plan: 'fish', len: 18, fur: '#fd7e14', mark: 'bands', accent: '#ffffff', dark: '#212529', depth: 0.28 },
    where: 'Clownfish live on coral reefs in the warm Indian and Pacific Oceans, from Australia to the Red Sea.',
    eats: 'Tiny floating animals called plankton, algae, and leftovers from the anemone\'s meals.',
    wow: 'A clownfish lives among the stinging arms of a sea anemone. A slimy coat keeps it from being stung, and the anemone keeps it safe from fish that would eat it.',
  },
  {
    id: 'ocean-jelly', map: 'bg-ocean', name: 'Moon jellyfish', rarity: 'common', how: ['fly'], from: 'sky', seasons: ['spring', 'summer', 'autumn'],
    look: { plan: 'jelly', len: 26, fur: '#d0ebff', belly: '#e7f5ff', dark: '#a5d8ff', mark: 'rings', accent: '#e599f7' },
    where: 'Moon jellyfish drift in coastal seas almost all over the world, sometimes in huge groups called blooms in the warmer months.',
    eats: 'Plankton, tiny fish eggs and baby fish, caught on the sticky edge of its bell.',
    wow: 'A jellyfish has no brain, no heart and no bones, and it is about 95% water. The four rings you can see through its bell are where it makes eggs.',
  },
  {
    id: 'ocean-parrotfish', map: 'bg-ocean', name: 'Parrotfish', rarity: 'common', how: ['fly', 'fly', 'rise'], from: 'coral',
    look: { plan: 'fish', len: 30, fur: '#20c997', mark: 'scales', dark: '#087f5b', face: '#f783ac', beak: '#f8f9fa', tailTag: 'accent', accent: '#f783ac', depth: 0.26 },
    where: 'Parrotfish live on coral reefs in warm seas all over the world.',
    eats: 'Algae, which it scrapes off coral and rock with its hard, beak-like teeth.',
    wow: 'Parrotfish poop out the bits of coral they bite off as fine white sand. Some white sand beaches are partly made of parrotfish poop! At night some sleep inside a bubble of slime.',
  },
  {
    id: 'ocean-lobster', map: 'bg-ocean', name: 'Painted spiny lobster', rarity: 'common', how: ['step', 'rise'], from: 'rock',
    look: { plan: 'crab', len: 26, fur: '#2f8f9d' },
    where: 'Painted spiny lobsters hide in cracks and caves on reefs in the Indian and Pacific Oceans.',
    eats: 'Snails, clams, sea urchins and dead animals, found at night.',
    wow: 'Spiny lobsters have no big claws. To scare off a fish they rub their long feelers and make a loud screech, like a violin bow.',
  },
  {
    id: 'ocean-idol', map: 'bg-ocean', name: 'Moorish idol', rarity: 'common', how: ['fly', 'fly'], from: 'sky',
    look: { plan: 'fish', len: 22, fur: '#fff3bf', mark: 'bands', accent: '#343a40', dark: '#212529', depth: 0.42, finTag: 'belly', finTip: '#ffffff', belly: '#f8f9fa' },
    where: 'Moorish idols swim over coral reefs in the Indian and Pacific Oceans, from Africa to Hawaii.',
    eats: 'Sponges and algae, picked off the reef with its long snout.',
    wow: 'A Moorish idol has a long white fin trailing from its back like a banner. It is so famous it was a character in a movie about a clownfish!',
  },
  {
    id: 'ocean-octopus', map: 'bg-ocean', name: 'Day octopus', rarity: 'uncommon', how: ['rise'], from: 'rock', camo: true, shy: true,
    look: { plan: 'octopus', len: 30, fur: '#a0522d', belly: '#e8b48a', dark: '#6e3417', mark: 'spots' },
    where: 'Day octopuses live on coral reefs in the Indian and Pacific Oceans, from Hawaii to East Africa.',
    eats: 'Crabs, shrimp, clams and fish, caught in daylight (most octopuses hunt at night).',
    wow: 'An octopus can change its color and even the bumps on its skin in less than a second, so it looks exactly like a rock or coral. It has three hearts and blue blood.',
  },
  {
    id: 'ocean-turtle', map: 'bg-ocean', name: 'Green sea turtle', rarity: 'uncommon', how: ['fly', 'fly', 'track'], from: 'sky',
    look: { plan: 'turtle', flippers: true, len: 40, fur: '#7a6a4a', shell: '#5c6b2a', belly: '#e9e0b8', headR: 0.1 },
    where: 'Green sea turtles swim in warm seas all over the world and graze in shallow water near reefs.',
    eats: 'Sea grass and algae. It is the only sea turtle that eats only plants when grown up.',
    wow: 'Green sea turtles are named for the green fat under their shell, colored by all the plants they eat. They can rest underwater for hours, and visit "cleaning stations" where fish nibble their shells clean.',
  },
  {
    id: 'ocean-lionfish', map: 'bg-ocean', name: 'Red lionfish', rarity: 'uncommon', how: ['rise', 'fly'], from: 'coral',
    look: { plan: 'fish', len: 26, fur: '#f1e3d3', mark: 'bands', accent: '#c92a2a', dark: '#862e2e', depth: 0.3, finTag: 'accent', finTip: '#ffffff' },
    where: 'Red lionfish come from reefs in the Pacific Ocean. They now live in the Atlantic and Caribbean too, where people try to catch them.',
    eats: 'Small fish and shrimp, which it corners with its big fan-like fins.',
    wow: 'Its long spines hold venom, and its red and white stripes warn other fish to stay away.',
  },
  {
    id: 'ocean-manta', map: 'bg-ocean', name: 'Reef manta ray', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'ray', len: 60, fur: '#212529', belly: '#f8f9fa', dark: '#111111' },
    where: 'Reef manta rays glide in warm seas of the Indian and Pacific Oceans, close to coral reefs and islands.',
    eats: 'Plankton, which it scoops up by swimming with its huge mouth wide open.',
    wow: 'A manta ray can be wider than a car is long, and it has the biggest brain of any fish. Each manta has its own pattern of spots on its belly, like a fingerprint.',
  },
  {
    id: 'ocean-shark', map: 'bg-ocean', name: 'Blacktip reef shark', rarity: 'rare', how: ['fly'], from: 'sky', shy: true,
    look: { plan: 'fish', shape: 'shark', len: 60, fur: '#868e96', belly: '#f1f3f5', finTag: 'fur', finTip: '#111111', tailTag: 'fur' },
    where: 'Blacktip reef sharks swim in the shallow water of coral reefs in the Indian and Pacific Oceans.',
    eats: 'Small fish, squid and shrimp.',
    wow: 'Blacktip reef sharks are shy of people. They swim in shallow water so close to the beach that their black-tipped fins can stick out of the water.',
  },
  {
    id: 'ocean-dugong', map: 'bg-ocean', name: 'Dugong', rarity: 'rare', how: ['far'], from: 'hill',
    look: { plan: 'fish', len: 50, fur: '#9a8f86', belly: '#bcb3aa', depth: 0.2, fin: false, tailTag: 'fur', eye: '#212529' },
    where: 'Dugongs live in warm, shallow seas of the Indian and Pacific Oceans, from East Africa to Australia, in meadows of sea grass.',
    eats: 'Sea grass, roots and all, which it digs up with its big bristly lips.',
    wow: 'Dugongs are cousins of manatees and of elephants. Old sailors who saw them far away may have thought they were mermaids!',
  },
  {
    id: 'ocean-whaleshark', map: 'bg-ocean', name: 'Whale shark', rarity: 'legend', how: ['fly'], from: 'sky',
    look: { plan: 'fish', shape: 'shark', len: 100, fur: '#4a6380', belly: '#dee2e6', mark: 'spots', depth: 0.16, finTag: 'fur', tailTag: 'fur' },
    where: 'Whale sharks swim in warm oceans all over the world, often near reefs and coasts where food is plentiful.',
    eats: 'Plankton and tiny fish, sieved from the water through its huge mouth. It is gentle and has no use for big teeth.',
    wow: 'The whale shark is the biggest fish in the world, as long as a school bus. Every whale shark has its own pattern of white spots, and scientists tell them apart with star-mapping computer programs.',
  },
  {
    id: 'ocean-flashlight', map: 'bg-ocean', name: 'Flashlight fish', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'fish', len: 16, fur: '#212529', glow: '#a5f3fc', eye: '#f8f9fa' },
    where: 'Flashlight fish hide in caves and deep cracks of coral reefs in the Indian and Pacific Oceans by day, and come out on dark nights.',
    eats: 'Plankton and tiny shrimp, which their lights help them see.',
    wow: 'Under each eye a flashlight fish has a light made by glowing bacteria. It blinks the lights off by covering them with a flap of skin, to signal friends and confuse hunters.',
  },

  // ---------- Volcano island (bg-volcano): the Galápagos Islands ----------
  // Twist: steam vents puff and hide animals; the giant tortoise stops the train; the tunnel is a lava tube.
  {
    id: 'volcano-iguana', map: 'bg-volcano', name: 'Marine iguana', rarity: 'common', how: ['step', 'step'], from: 'rock', weather: ['sunny'],
    look: { plan: 'lizard', len: 52, fur: '#4a4542', extra: 'crest', accent: '#e9ecef', mark: 'spots', face: '#dee2e6', dark: '#1a1817' },
    where: 'Marine iguanas live only on the rocky shores of the Galápagos Islands.',
    eats: 'Seaweed, which it dives into the cold sea to nibble off the rocks.',
    wow: 'It is the only lizard in the world that swims in the sea. It sneezes out the extra salt from the seawater, so its head is often crusty white.',
  },
  {
    id: 'volcano-crab', map: 'bg-volcano', name: 'Sally Lightfoot crab', rarity: 'common', how: ['rise', 'step', 'run'], from: 'rock',
    look: { plan: 'crab', len: 22, fur: '#e8590c' },
    where: 'Sally Lightfoot crabs live on rocky shores of the Pacific coast of the Americas and the Galápagos Islands.',
    eats: 'Algae, plus leftovers and dead animals washed up on the rocks.',
    wow: 'It is so quick and nimble that it can hop from rock to rock and even skip across water. Its bright red shell stands out on the black lava.',
  },
  {
    id: 'volcano-sealion', map: 'bg-volcano', name: 'Galápagos sea lion', rarity: 'common', how: ['surface', 'surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'head', seal: true, len: 28, fur: '#8a6a4a', belly: '#c8a882', ears: 'none', headR: 0.2 },
    where: 'Galápagos sea lions live only on the Galápagos Islands, lazing on beaches, rocks and even park benches.',
    eats: 'Sardines and other fish.',
    wow: 'Galápagos sea lions are playful and curious. Young ones love to swim around snorkelers and blow bubbles at them.',
  },
  {
    id: 'volcano-finch', map: 'bg-volcano', name: 'Darwin\'s finch', rarity: 'common', how: ['perch', 'perch'], from: 'tree',
    look: { plan: 'bird', len: 16, fur: '#495057', belly: '#868e96', beak: '#fcc419', bill: 0.2, bigBill: true },
    where: 'Darwin\'s finches live only on the Galápagos Islands (and one kind on Cocos Island). There are about 18 kinds.',
    eats: 'Seeds, cactus flowers, insects. Each kind has a beak shaped for its own food.',
    wow: 'Charles Darwin studied these finches. Their different beaks helped scientists understand how animals change over many generations to fit where they live.',
  },
  {
    id: 'volcano-booby', map: 'bg-volcano', name: 'Blue-footed booby', rarity: 'common', how: ['step', 'fly'], from: 'rock',
    look: { plan: 'bird', len: 26, fur: '#7a6448', belly: '#f8f9fa', face: '#ede0cc', beak: '#6c8ca8', bill: 0.22, feet: '#3bc9db' },
    where: 'Blue-footed boobies nest on dry islands off the Pacific coast of the Americas. About half of them live in the Galápagos.',
    eats: 'Sardines, anchovies and other small fish. It dives into the sea like an arrow.',
    wow: 'The male shows off his bright blue feet in a funny high-stepping dance. The bluer the feet, the healthier the bird.',
  },
  {
    id: 'volcano-penguin', map: 'bg-volcano', name: 'Galápagos penguin', rarity: 'uncommon', how: ['step', 'rise'], from: 'rock',
    look: { plan: 'penguin', len: 22, fur: '#343a40', belly: '#f8f9fa', face: true, feet: '#343a40', beak: '#495057' },
    where: 'Galápagos penguins live only on the Galápagos Islands, on the equator. Cold sea currents keep the water there cool enough for them.',
    eats: 'Small fish like sardines and mullet.',
    wow: 'It is the only penguin that lives in the Northern Hemisphere. To cool off in the hot sun, it pants like a dog and holds its flippers over its feet to shade them.',
  },
  {
    id: 'volcano-tortoise', map: 'bg-volcano', name: 'Galápagos giant tortoise', rarity: 'uncommon', how: ['step', 'track'], from: 'rock', land: true,
    look: { plan: 'turtle', len: 50, fur: '#6c6a5c', shell: '#4a4a3a', belly: '#5c5a4a', neck: 0.3, dome: 0.36, headR: 0.09 },
    where: 'Giant tortoises live only on the Galápagos Islands. Each island has its own kind, with its own shell shape.',
    eats: 'Grass, leaves and cactus pads. It can go a year without eating or drinking.',
    wow: 'Galápagos tortoises are the biggest tortoises in the world, and they can live more than 100 years. The islands are named after them: galápago is an old Spanish word for tortoise.',
  },
  {
    id: 'volcano-albatross', map: 'bg-volcano', name: 'Waved albatross', rarity: 'uncommon', how: ['fly', 'perch'], from: 'tree', seasons: ['spring', 'summer', 'autumn'],
    look: { plan: 'bird', len: 30, fur: '#f8f9fa', belly: '#ffffff', wingTag: 'accent', accent: '#6c5a48', beak: '#fcc419', bill: 0.24, tail: 'short' },
    where: 'Nearly all waved albatrosses nest on Española, one of the Galápagos Islands, from about April to December, then fly out over the Pacific.',
    eats: 'Squid, fish and krill caught at sea.',
    wow: 'Partners greet each other with a long dance: bowing, circling and clacking their beaks together like sword fighting. They stay together for life.',
  },
  {
    id: 'volcano-hawk', map: 'bg-volcano', name: 'Galápagos hawk', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'big-bird', len: 28, fur: '#4a3424', belly: '#6c5040', beak: '#212529', dark: '#2b1d12' },
    where: 'Galápagos hawks live only on the Galápagos Islands, soaring over the volcanoes.',
    eats: 'Lizards, rats, young iguanas, insects and leftovers.',
    wow: 'Galápagos hawks have no enemies and are not afraid of people at all. A female often has two or three husbands who help raise the chicks.',
  },
  {
    id: 'volcano-owl', map: 'bg-volcano', name: 'Short-eared owl', rarity: 'rare', how: ['far'], from: 'hill',
    look: { plan: 'big-bird', len: 22, fur: '#b08a5a', belly: '#f3e3c3', owl: true, eye: '#fcc419', mark: 'spots', dark: '#5c4030', beak: '#212529' },
    where: 'Short-eared owls live on open grassland and tundra across the world. On the Galápagos they nest on the old lava fields.',
    eats: 'Mice, rats and small birds.',
    wow: 'On the Galápagos, where there are no hawks to chase it at night, the short-eared owl hunts in the daytime, waiting by petrel burrows on the lava.',
  },
  {
    id: 'volcano-cormorant', map: 'bg-volcano', name: 'Flightless cormorant', rarity: 'rare', how: ['surface'], from: 'water', sea: true, shy: true,
    look: { plan: 'swim', swim: 'head', len: 28, fur: '#495057', belly: '#adb5bd', muzzle: true, nose: '#fcc419', eye: '#3bc9db', snout: 1.6, ears: 'none', headR: 0.16 },
    where: 'Flightless cormorants live only on the shores of two Galápagos islands, Fernandina and Isabela.',
    eats: 'Eels, octopus and fish, hunted on the sea floor.',
    wow: 'With no enemies on land, its wings shrank over time until it could no longer fly, but it is a superb swimmer. After a dive it still holds its tiny wings out to dry.',
  },
  {
    id: 'volcano-pink', map: 'bg-volcano', name: 'Galápagos pink iguana', rarity: 'legend', how: ['step'], from: 'rock',
    look: { plan: 'lizard', len: 56, fur: '#f783ac', extra: 'crest', accent: '#495057', mark: 'stripes', dark: '#5c2a3a' },
    where: 'Pink iguanas live in just one place in the whole world: the slopes of Wolf Volcano on Isabela Island in the Galápagos.',
    eats: 'Cactus pads, leaves and fruit.',
    wow: 'Scientists only found out it was its own kind of iguana in 2009. There are just a few hundred of them, which makes it one of the rarest lizards on Earth.',
  },
  {
    id: 'volcano-bat', map: 'bg-volcano', name: 'Galápagos red bat', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'bat', len: 20, fur: '#c2571a', belly: '#7a3410' },
    where: 'Galápagos red bats live in the Galápagos Islands. Most days they roost in mangroves and trees rather than caves, so seeing one in a lava tube is a lucky surprise.',
    eats: 'Moths and other flying insects caught at night.',
    wow: 'It is one of the very few mammals that reached the Galápagos on its own, flying across 600 miles of ocean long ago.',
  },

  // ---------- Rainforest (bg-rainforest): a Central American jungle (Costa Rica) ----------
  // Twist: the afternoon downpour. Halfway through it pours: rain animals come out, sun animals hide.
  {
    id: 'jungle-toucan', map: 'bg-rainforest', name: 'Keel-billed toucan', rarity: 'common', how: ['perch', 'perch', 'fly'], from: 'tree', weather: ['sunny'],
    look: { plan: 'bird', len: 24, fur: '#212529', belly: '#212529', face: '#fcc419', beak: '#94d82d', bigBill: true, bill: 0.34 },
    where: 'Keel-billed toucans live in the rainforests of southern Mexico and Central America, high in the treetops.',
    eats: 'Fruit, mostly, plus insects, eggs and small lizards.',
    wow: 'Its rainbow beak is a third as long as its body but very light, like a honeycomb inside. Toucans sleep with their beak tucked under a wing and their tail folded over their head.',
  },
  {
    id: 'jungle-treefrog', map: 'bg-rainforest', name: 'Red-eyed tree frog', rarity: 'common', how: ['rise', 'rise'], from: 'bush', weather: ['rain'], seasons: SUMMERY,
    look: { plan: 'frog', len: 18, fur: '#40c057', belly: '#e9fac8', eye: '#e03131', croak: false },
    where: 'Red-eyed tree frogs live in the lowland rainforests of Central America, on leaves near ponds and streams.',
    eats: 'Crickets, moths, flies and other insects, caught at night.',
    wow: 'By day it sleeps with its eyes shut, looking like a green leaf. If something wakes it, it flashes its huge red eyes, which can startle a hungry bird long enough for the frog to jump away.',
  },
  {
    id: 'jungle-morpho', map: 'bg-rainforest', name: 'Blue morpho butterfly', rarity: 'common', how: ['fly', 'perch'], from: 'sky', weather: ['sunny'],
    look: { plan: 'bug', len: 22, fur: '#228be6', belly: '#1c3d6e', dark: '#343a40', mark: 'spots', accent: '#fff3bf' },
    where: 'Blue morphos live in the rainforests of Central and South America.',
    eats: 'Juice from rotting fruit, tree sap and mushrooms, which it tastes with its feet.',
    wow: 'Its wings are not really blue: tiny scales bend the light so they shine blue. The undersides are brown with eye spots, so when it closes its wings it seems to vanish.',
  },
  {
    id: 'jungle-monkey', map: 'bg-rainforest', name: 'Central American squirrel monkey', rarity: 'common', how: ['step', 'run'], from: 'tree',
    look: { plan: 'small', len: 26, fur: '#e8a33c', belly: '#fff3bf', mark: 'mask', dark: '#343a40', tail: 'long', ears: 'round', sits: true },
    where: 'Central American squirrel monkeys live only in a small part of the Pacific coast rainforest of Costa Rica and Panama.',
    eats: 'Insects, fruit, leaves and flowers.',
    wow: 'They travel in noisy troops of 20 to 70 monkeys, chirping and twittering to stay together. A baby rides on its mother\'s back for its first few weeks.',
  },
  {
    id: 'jungle-dartfrog', map: 'bg-rainforest', name: 'Strawberry poison dart frog', rarity: 'common', how: ['rise', 'step'], from: 'log', weather: ['rain'],
    look: { plan: 'frog', len: 14, fur: '#e03131', belly: '#e03131', mark: 'spots', dark: '#1c3d8a', croak: false },
    where: 'Strawberry poison dart frogs live on the rainforest floor of Nicaragua, Costa Rica and Panama.',
    eats: 'Ants and mites, which make the poison in its skin.',
    wow: 'This frog is only about as big as your fingernail. A mother carries each tadpole up a tree on her back to its own tiny pool of water in a plant, then brings it eggs to eat.',
  },
  {
    id: 'jungle-macaw', map: 'bg-rainforest', name: 'Scarlet macaw', rarity: 'uncommon', how: ['fly', 'perch'], from: 'tree', weather: ['sunny'],
    look: { plan: 'bird', len: 30, fur: '#e03131', belly: '#e03131', tail: 'long', tailTag: 'accent', accent: '#1c7ed6', mark: 'wingbar', face: '#f8f9fa', beak: '#f8f9fa', bigBill: true },
    where: 'Scarlet macaws live in the rainforests of southern Mexico, Central America and the Amazon.',
    eats: 'Nuts, seeds and fruit, cracked open with its strong curved beak.',
    wow: 'Macaws eat clay from riverbanks, which may help with the bitter seeds they eat. They fly in pairs, wing to wing, and can live 50 years or more.',
  },
  {
    id: 'jungle-caiman', map: 'bg-rainforest', name: 'Spectacled caiman', rarity: 'uncommon', how: ['surface'], from: 'water', sea: true,
    look: { plan: 'swim', swim: 'head', len: 32, fur: '#6b6e3a', belly: '#e0d9a0', muzzle: true, snout: 2.2, headR: 0.13, ears: 'round', mark: 'mask', dark: '#3d3f1e', eye: '#fcc419' },
    where: 'Spectacled caimans live in rivers, swamps and lakes from southern Mexico through Central America to the Amazon.',
    eats: 'Fish, snails, crabs, birds and small mammals.',
    wow: 'It is named for a bony ridge between its eyes that looks like the bridge of a pair of glasses. It floats with only its eyes and nose above the water.',
  },
  {
    id: 'jungle-tapir', map: 'bg-rainforest', name: 'Baird\'s tapir', rarity: 'uncommon', how: ['step', 'track'], from: 'tree', land: true,
    look: { plan: 'quad', len: 50, fur: '#4a3f36', belly: '#6c5f54', legs: 0.36, bulk: 0.5, snout: 1.8, headR: 0.17, ears: 'round', tail: 'none', neck: 0.1 },
    where: 'Baird\'s tapirs live in the forests and swamps of Central America, from southern Mexico to Colombia.',
    eats: 'Leaves, twigs, fruit and water plants, grabbed with its bendy nose.',
    wow: 'It is the biggest land animal in Central America. Its stretchy snout works like a short trunk, and it can use it as a snorkel when it hides underwater.',
  },
  {
    id: 'jungle-sloth', map: 'bg-rainforest', name: 'Brown-throated three-toed sloth', rarity: 'uncommon', how: ['far'], from: 'hill',
    look: { plan: 'small', len: 26, fur: '#a08a6a', belly: '#c8b496', mark: 'mask', dark: '#4a3a2a', ears: 'none', tail: 'none', sits: true },
    where: 'Three-toed sloths live high in the rainforest trees of Central and South America.',
    eats: 'Leaves, which take it up to a month to digest.',
    wow: 'Sloths move so slowly that green algae grow in their fur and help hide them. They climb down only about once a week, to poop.',
  },
  {
    id: 'jungle-jaguar', map: 'bg-rainforest', name: 'Jaguar', rarity: 'rare', how: ['step'], from: 'tree', land: true, weather: ['mist'], shy: true,
    look: { plan: 'quad', len: 46, fur: '#e0a030', belly: '#fff3bf', mark: 'spots', spotTag: 'dark', dark: '#3a2a14', legs: 0.3, ears: 'round', tail: 'long', headR: 0.22, snout: 0.6 },
    where: 'Jaguars live in rainforests and swamps from Mexico to Argentina. They are the biggest cats in the Americas.',
    eats: 'Deer, peccaries, capybaras, caimans, turtles and fish.',
    wow: 'Unlike most cats, jaguars love water and are strong swimmers. Their bite is strong enough to crack a turtle shell.',
  },
  {
    id: 'jungle-quetzal', map: 'bg-rainforest', name: 'Resplendent quetzal', rarity: 'rare', how: ['far'], from: 'hill',
    look: { plan: 'bird', len: 22, fur: '#2f9e44', belly: '#e03131', tail: 'long', tailTag: 'fur', extra: 'crest', beak: '#fcc419' },
    where: 'Resplendent quetzals live in misty mountain cloud forests from southern Mexico to Panama.',
    eats: 'Wild avocados and other fruit, swallowed whole, plus insects and small frogs.',
    wow: 'The male\'s green tail feathers can be twice as long as his body. The ancient Maya and Aztecs treasured the feathers, and the quetzal is the name of Guatemala\'s money.',
  },
  {
    id: 'jungle-harpy', map: 'bg-rainforest', name: 'Harpy eagle', rarity: 'legend', how: ['perch'], from: 'tree',
    look: { plan: 'big-bird', len: 32, fur: '#495057', belly: '#f1f3f5', mark: 'wingbar', dark: '#212529', beak: '#212529' },
    where: 'Harpy eagles live in tall lowland rainforests from southern Mexico to northern Argentina. They are very rare in Central America now.',
    eats: 'Sloths and monkeys, snatched from the treetops.',
    wow: 'A harpy eagle\'s back talons are as long as a grizzly bear\'s claws. It is one of the most powerful eagles in the world, and it raises only one chick every two or three years.',
  },
  {
    id: 'jungle-bat', map: 'bg-rainforest', name: 'Honduran white bat', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true,
    look: { plan: 'bat', len: 16, fur: '#f8f9fa', belly: '#e9ecef' },
    where: 'Honduran white bats live in the rainforests of Honduras, Nicaragua, Costa Rica and Panama. They usually roost under leaves, not in caves.',
    eats: 'Mostly the fruit of one kind of fig tree, which they carry off to eat.',
    wow: 'They nibble along a big leaf until it folds over like a tent, then hang underneath in a little white huddle. Sunlight through the green leaf makes their white fur look green, so they are hard to spot.',
  },

  // ---------- Rainbow land (bg-rainbow): pretend candy animals, each with a real cousin ----------
  // Twist: fill the rainbow. Each animal has a color; one photo of each color in a ride brings the unicorn.
  {
    id: 'rainbow-ladybug', map: 'bg-rainbow', name: 'Cherry ladybug', rarity: 'common', how: ['fly', 'perch', 'rise'], from: 'bush', color: 'red', cousin: 'seven-spot ladybird',
    look: { plan: 'bug', len: 14, fur: '#e03131', belly: '#e03131', mark: 'spots', accent: '#212529', dark: '#212529' },
    where: 'Its real cousin, the seven-spot ladybird (a kind of ladybug), lives in gardens, fields and parks across Europe, Asia and North America.',
    eats: 'Seven-spot ladybirds eat aphids, tiny bugs that suck plant juice. One can eat 5,000 in its life, so gardeners love them.',
    wow: 'When it is scared, a ladybird leaks a bad-tasting yellow juice from its knees. Its bright red says "I taste horrible!" to birds.',
  },
  {
    id: 'rainbow-flamingo', map: 'bg-rainbow', name: 'Candy flamingo', rarity: 'uncommon', how: ['step', 'fly'], from: 'reeds', color: 'orange', cousin: 'American flamingo',
    look: { plan: 'wader', len: 32, fur: '#ffa94d', beak: '#212529', bent: true, bill: 0.22, dark: '#e8590c' },
    where: 'Its real cousin, the American flamingo, wades in salty lagoons and mudflats in the Caribbean, the Galápagos and around the Gulf of Mexico.',
    eats: 'American flamingos eat tiny shrimp, algae and seeds, filtered from the mud with their beak upside down.',
    wow: 'Flamingos are born grey. They turn pink or orange from the color in the shrimp and algae they eat. They often stand on one leg, maybe to keep warm.',
  },
  {
    id: 'rainbow-tiger', map: 'bg-rainbow', name: 'Tangerine tiger', rarity: 'common', how: ['step', 'step'], from: 'tree', color: 'orange', cousin: 'Bengal tiger',
    look: { plan: 'quad', len: 40, fur: '#ff922b', belly: '#fff4e6', mark: 'stripes', dark: '#862e9c', legs: 0.32, ears: 'round', tail: 'long', headR: 0.22, snout: 0.6 },
    where: 'Its real cousin, the Bengal tiger, lives in the forests and grasslands of India, Bangladesh and Nepal.',
    eats: 'Bengal tigers hunt deer, wild pigs and buffalo, mostly at night, and can eat 60 pounds of meat in one meal.',
    wow: 'Tigers are the biggest cats in the world, and every tiger has its own pattern of stripes, even on its skin under the fur. Unlike most cats, tigers love to swim.',
  },
  {
    id: 'rainbow-snail', map: 'bg-rainbow', name: 'Lollipop snail', rarity: 'common', how: ['rise', 'rise'], from: 'bush', color: 'yellow', cousin: 'Cuban painted snail',
    look: { plan: 'snail', len: 22, fur: '#ffd43b', belly: '#fff3bf', dark: '#f783ac' },
    where: 'Its real cousin, the Cuban painted snail, lives only in the forests of eastern Cuba.',
    eats: 'Cuban painted snails eat lichen and mold that grow on tree bark and leaves.',
    wow: 'Cuban painted snails have the most colorful shells of any land snail, striped in yellow, red, orange, white and black, and no two look exactly alike.',
  },
  {
    id: 'rainbow-frog', map: 'bg-rainbow', name: 'Gumdrop frog', rarity: 'common', how: ['rise', 'step'], from: 'bush', color: 'green', cousin: 'glass frog',
    look: { plan: 'frog', len: 18, fur: '#51cf66', belly: '#d3f9d8', eye: '#212529', croak: false },
    where: 'Its real cousins, the glass frogs, live in the rainforests of Central and South America, on leaves over streams.',
    eats: 'Glass frogs eat small insects and spiders.',
    wow: 'A glass frog\'s tummy is see-through: you can watch its heart beat! When it sleeps it hides most of its blood away in its liver, so it turns almost clear.',
  },
  {
    id: 'rainbow-parrot', map: 'bg-rainbow', name: 'Rainbow parrot', rarity: 'uncommon', how: ['perch', 'fly'], from: 'tree', color: 'blue', cousin: 'rainbow lorikeet',
    look: { plan: 'bird', len: 22, fur: '#3b5bdb', belly: '#4dabf7', face: '#4263eb', mark: 'chest', accent: '#fd7e14', wingTag: 'dark', dark: '#40c057', beak: '#e03131', tail: 'long' },
    where: 'Its real cousin, the rainbow lorikeet, lives in forests, parks and gardens along the coasts of Australia.',
    eats: 'Rainbow lorikeets drink nectar and eat pollen and fruit.',
    wow: 'A lorikeet\'s tongue has a brush on the end, like a tiny mop, for lapping up nectar from flowers. They are so noisy they can be heard from far away.',
  },
  {
    id: 'rainbow-bunny', map: 'bg-rainbow', name: 'Sprinkle bunny', rarity: 'common', how: ['hop', 'rise', 'track'], from: 'bush', color: 'purple', cousin: 'European rabbit',
    look: { plan: 'hop', len: 24, fur: '#d0bfff', belly: '#ffffff', dark: '#f783ac', ears: 'long' },
    where: 'Its real cousin, the European rabbit, comes from Spain and Portugal and now lives in fields and meadows on almost every continent. Pet rabbits are the same kind.',
    eats: 'European rabbits eat grass, clover and leafy plants.',
    wow: 'A happy rabbit does a "binky": a leap into the air with a twist. Rabbits live together in big burrows called warrens and thump their back feet to warn of danger.',
  },
  {
    id: 'rainbow-sheep', map: 'bg-rainbow', name: 'Cotton candy sheep', rarity: 'uncommon', how: ['far'], from: 'hill', color: 'blue', cousin: 'merino sheep',
    look: { plan: 'quad', len: 34, fur: '#a5d8ff', belly: '#d0ebff', legs: 0.3, bulk: 0.55, dark: '#495057', headR: 0.2, ears: 'round', tail: 'short', snout: 0.6 },
    where: 'Its real cousin, the merino sheep, first came from Spain and now lives on farms around the world, most of all in Australia.',
    eats: 'Merino sheep eat grass and hay.',
    wow: 'Merino wool is so fine and soft it is used for socks and sweaters. A wild merino named Chris was found in Australia carrying 90 pounds of wool, about as much as a 12-year-old kid weighs!',
  },
  {
    id: 'rainbow-giraffe', map: 'bg-rainbow', name: 'Bubblegum giraffe', rarity: 'rare', how: ['far'], from: 'hill', color: 'yellow', cousin: 'giraffe',
    look: { plan: 'quad', len: 40, fur: '#ffd43b', mark: 'spots', spotTag: 'accent', accent: '#f783ac', legs: 0.7, neck: 1.1, headR: 0.14, ears: 'point', tail: 'long', hooves: true },
    where: 'Its real cousin, the giraffe, lives on the savannas and open woods of Africa.',
    eats: 'Giraffes eat leaves from tall trees, especially thorny acacias, pulled off with a dark tongue as long as your arm.',
    wow: 'Giraffes are the tallest animals in the world. A newborn giraffe is already taller than most grown-ups, and every giraffe\'s spot pattern is different.',
  },
  {
    id: 'rainbow-glider', map: 'bg-rainbow', name: 'Marshmallow glider', rarity: 'rare', how: ['fly', 'fly'], from: 'tree', color: 'purple', shy: true, cousin: 'sugar glider',
    look: { plan: 'bat', len: 22, fur: '#e5dbff', belly: '#b197fc' },
    where: 'Its real cousin, the sugar glider, lives in the forests of Australia and New Guinea.',
    eats: 'Sugar gliders eat sweet tree sap, nectar and insects. That is where the "sugar" comes from.',
    wow: 'A sugar glider has a stretchy skin between its front and back legs. It spreads out like a kite and glides from tree to tree, as far as a football field is long.',
  },
  {
    id: 'rainbow-unicorn', map: 'bg-rainbow', name: 'Rainbow unicorn', rarity: 'legend', how: ['step', 'track'], from: 'tree', cousin: 'Arabian oryx',
    look: { plan: 'quad', len: 50, fur: '#f8f9fa', belly: '#ffffff', horns: 'horn', accent: '#fcc419', extra: 'mane', rainbow: true, hooves: true, legs: 0.55, tail: 'long', headR: 0.17, snout: 1.2, ears: 'point', eye: '#7048e8' },
    where: 'Its real cousin, the Arabian oryx, lives in the deserts of the Arabian Peninsula.',
    eats: 'Arabian oryx eat desert grass and plants, and can go weeks without drinking, getting water from dew and their food.',
    wow: 'Seen from the side, an oryx\'s two long straight horns can look like one, which may be how stories of unicorns began. The oryx died out in the wild in 1972, and was brought back by zoos.',
  },
  {
    id: 'rainbow-bat', map: 'bg-rainbow', name: 'Candy bat', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true, cousin: 'Egyptian fruit bat',
    look: { plan: 'bat', len: 20, fur: '#f783ac', belly: '#fcc2d7' },
    where: 'Its real cousin, the Egyptian fruit bat, lives in Africa and the Middle East, roosting in caves by the thousands.',
    eats: 'Egyptian fruit bats eat ripe fruit, flowers and nectar.',
    wow: 'Unlike most fruit bats, it finds its way in dark caves by clicking its tongue and listening to the echoes.',
  },

  // ---------- Golden galaxy (bg-galaxy): pretend golden space animals, each with a real cousin ----------
  // Twist: gold on gold. Animals are gold like the ground and give no sign; only a glint shows them,
  // and they show their true colors when they pose. Low gravity: slow hops, like the Moon.
  {
    id: 'galaxy-starnose', map: 'bg-galaxy', name: 'Starnose', rarity: 'common', how: ['rise', 'rise'], from: 'burrow', cousin: 'star-nosed mole',
    look: { plan: 'small', len: 22, fur: '#5f3dc4', belly: '#7950f2', snout: 0.8, nose: '#f783ac', star: '#f783ac', ears: 'none', tail: 'short' },
    where: 'Its real cousin, the star-nosed mole, lives in wet meadows and marshes in eastern Canada and the northeastern United States.',
    eats: 'Star-nosed moles eat worms, insects and tiny water creatures.',
    wow: 'The star-nosed mole has 22 pink feelers around its nose, the most sensitive touch organ of any mammal. It can find and gulp down a snack in a quarter of a second, faster than you can blink.',
  },
  {
    id: 'galaxy-beetle', map: 'bg-galaxy', name: 'Twinkle beetle', rarity: 'common', how: ['fly', 'perch'], from: 'sky', seasons: ['summer', 'autumn'], cousin: 'golden tortoise beetle',
    look: { plan: 'bug', len: 14, fur: '#fcc419', belly: '#ffe066', dark: '#e67700', mark: 'glow', accent: '#fff9db' },
    where: 'Its real cousin, the golden tortoise beetle, lives on morning glory and sweet potato plants in North America.',
    eats: 'Golden tortoise beetles eat the leaves of morning glories.',
    wow: 'It shines like a drop of gold, but when you touch it, it can change to dull orange with black spots in a few minutes, by squeezing water out of its shell.',
  },
  {
    id: 'galaxy-gecko', map: 'bg-galaxy', name: 'Galaxy gecko', rarity: 'common', how: ['step', 'rise'], from: 'rock', cousin: 'leopard gecko',
    look: { plan: 'lizard', len: 40, fur: '#7950f2', mark: 'spots', accent: '#fcc419', dark: '#5f3dc4' },
    where: 'Its real cousin, the leopard gecko, lives in rocky deserts and dry grasslands of Afghanistan, Pakistan, India and Iran.',
    eats: 'Leopard geckos eat crickets, beetles, spiders and scorpions.',
    wow: 'A leopard gecko stores fat in its chubby tail for hard times. Unlike most geckos it has eyelids and blinks, and it licks its own eyes clean.',
  },
  {
    id: 'galaxy-bear', map: 'bg-galaxy', name: 'Space bear', rarity: 'common', how: ['rise', 'step'], from: 'rock', cousin: 'tardigrade (water bear)',
    look: { plan: 'small', len: 24, fur: '#e5dbff', belly: '#d0bfff', ears: 'none', tail: 'none', snout: 0.3, bodyH: 0.24, dark: '#9775fa', manyLegs: true },
    where: 'Its real cousins, tardigrades, live almost everywhere on Earth: in moss, puddles, sand, the deep sea and mountain tops.',
    eats: 'Tardigrades suck the juice out of moss, algae and tiny creatures.',
    wow: 'Tardigrades are smaller than a grain of sand, with eight chubby legs. They can dry out for years and come back to life, and some even survived a trip into open space!',
  },
  {
    id: 'galaxy-roo', map: 'bg-galaxy', name: 'Rocket roo', rarity: 'common', how: ['hop', 'hop'], from: 'rock', seasons: ['spring', 'summer'], cousin: 'red kangaroo',
    look: { plan: 'hop', len: 30, fur: '#ff922b', belly: '#ffe8cc', ears: 'point', tail: 'long', snout: 0.8, tall: 0.45, dark: '#d9480f' },
    where: 'Its real cousin, the red kangaroo, lives in the dry grasslands and deserts of Australia.',
    eats: 'Red kangaroos eat grass and leaves, and get much of their water from them.',
    wow: 'The red kangaroo is the biggest animal that hops. It can jump 25 feet in one bound. A baby (a joey) is as small as a jelly bean when born, and grows up in its mother\'s pouch.',
  },
  {
    id: 'galaxy-comet', map: 'bg-galaxy', name: 'Comet bird', rarity: 'uncommon', how: ['fly', 'far'], from: 'sky', cousin: 'peregrine falcon',
    look: { plan: 'bird', len: 22, fur: '#4dabf7', belly: '#e7f5ff', tail: 'long', tailTag: 'accent', accent: '#ffd43b', mark: 'mask', dark: '#1c3d6e' },
    where: 'Its real cousin, the peregrine falcon, lives on every continent except Antarctica, from cliffs to city skyscrapers.',
    eats: 'Peregrine falcons eat other birds, caught in mid-air.',
    wow: 'In a dive a peregrine falcon goes over 200 miles an hour, the fastest animal ever measured. Special bumps in its nose help it breathe at that speed.',
  },
  {
    id: 'galaxy-armadillo', map: 'bg-galaxy', name: 'Planet armadillo', rarity: 'uncommon', how: ['rise', 'step'], from: 'burrow', cousin: 'three-banded armadillo',
    look: { plan: 'small', len: 26, fur: '#b197fc', belly: '#e5dbff', mark: 'stripes', dark: '#7048e8', ears: 'point', tail: 'short', bodyH: 0.24, snout: 1.2 },
    where: 'Its real cousins, three-banded armadillos, live in the dry grasslands and scrub of South America.',
    eats: 'Three-banded armadillos eat ants and termites, licked up with a long sticky tongue.',
    wow: 'It is the only armadillo that can roll up into a perfect ball, with its head and tail fitting together like puzzle pieces. Its shell is made of bony plates covered in skin.',
  },
  {
    id: 'galaxy-tamarin', map: 'bg-galaxy', name: 'Golden tamarin', rarity: 'rare', how: ['far'], from: 'hill', cousin: 'golden lion tamarin',
    look: { plan: 'small', len: 22, fur: '#ff922b', belly: '#ffa94d', extra: 'ruff', tail: 'long', ears: 'none', sits: true, snout: 0.3, dark: '#5c3a1e' },
    where: 'Its real cousin, the golden lion tamarin, lives only in the Atlantic coastal forest of Brazil.',
    eats: 'Golden lion tamarins eat fruit, insects, frogs and lizards.',
    wow: 'It is a monkey only about as big as a squirrel, with a shiny golden mane like a little lion. Fewer than 200 were left in the 1970s, and people have helped them grow back to thousands.',
  },
  {
    id: 'galaxy-lion', map: 'bg-galaxy', name: 'Sun lion', rarity: 'rare', how: ['step', 'track'], from: 'rock', shy: true, cousin: 'lion',
    look: { plan: 'quad', len: 48, fur: '#fcc419', belly: '#fff3bf', lion: true, accent: '#e8590c', tail: 'long', legs: 0.36, headR: 0.22, snout: 0.6, ears: 'round' },
    where: 'Its real cousin, the lion, lives on the grasslands of Africa, and a few live in the Gir Forest of India.',
    eats: 'Lions eat zebras, wildebeest, antelope and buffalo, hunted together by the lionesses.',
    wow: 'Lions are the only cats that live in big families, called prides. A lion\'s roar can be heard 5 miles away, and lions sleep up to 20 hours a day.',
  },
  {
    id: 'galaxy-phoenix', map: 'bg-galaxy', name: 'Golden phoenix', rarity: 'legend', how: ['fly', 'perch'], from: 'sky', cousin: 'golden pheasant',
    look: { plan: 'bird', len: 30, fur: '#fcc419', belly: '#e03131', tail: 'long', tailTag: 'accent', accent: '#e8590c', extra: 'crest', beak: '#f8f9fa' },
    where: 'Its real cousin, the golden pheasant, lives in the mountain forests of western China.',
    eats: 'Golden pheasants eat seeds, leaves, berries and insects, found on the forest floor.',
    wow: 'The male golden pheasant has a golden crest, a red body and a cape of orange and black that he spreads like a fan to show off. Even so, he is shy and hard to see in the wild.',
  },
  {
    id: 'galaxy-jelly', map: 'bg-galaxy', name: 'Nebula jelly', rarity: 'common', how: ['fly'], from: 'tunnel', tunnel: true, cousin: 'comb jelly',
    look: { plan: 'jelly', comb: true, len: 28, fur: '#b197fc', belly: '#e5dbff' },
    where: 'Its real cousins, comb jellies, drift in oceans all over the world, from the surface to the deep sea.',
    eats: 'Comb jellies eat plankton, fish eggs and even other comb jellies.',
    wow: 'Comb jellies swim by beating rows of tiny hairs called combs. The combs scatter light into flickering rainbows that ripple down their see-through bodies.',
  },
  // ---------- December animals: one on every map, only in December (design v1 section 3) ----------
  // december: true keeps them to 1 to 31 December (the family's local day), every year. They are
  // rare, and each has a fun pretend line (fun) for its album page; the facts are true ones.
  {
    id: 'meadow-popcorn', map: 'bg-meadow', name: 'Popcorn porcupine', rarity: 'rare', december: true, how: ['step', 'rise'], from: 'log', seasons: ['winter'], cousin: 'North American porcupine',
    look: { plan: 'small', len: 30, fur: '#5c4a3d', belly: '#8a7262', dark: '#2e241e', ears: 'round', tail: 'short', bodyH: 0.24, headR: 0.17, muzzle: true, quills: true, quillTip: '#f1e3c8', xmas: ['garland'] },
    where: 'Its real cousin, the North American porcupine, lives in forests across Canada, Alaska and much of the United States. It sleeps in hollow trees, in rock dens or high up in the branches.',
    eats: 'Porcupines eat leaves, buds, berries and green plants in summer. In winter they climb trees and nibble the inner bark and the evergreen needles.',
    wow: 'A porcupine has about 30,000 quills. It can\'t shoot them, but they come out at a touch, and each tip has tiny backward barbs. A baby porcupine is called a porcupette!',
    fun: 'Every December it strings popcorn and cranberries on its quills, and it shares the popcorn with the chickadees.',
  },
  {
    id: 'sunset-bauble', map: 'bg-sunset', name: 'Bauble crab', rarity: 'rare', december: true, how: ['rise', 'step'], from: 'log', seasons: ['winter'], cousin: 'Caribbean hermit crab',
    look: { plan: 'crab', len: 24, fur: '#e8590c', claw: '#7048e8', bigClaw: true, mark: 'bauble', bauble: '#e03131', xmas: [] },
    where: 'Its real cousin, the Caribbean hermit crab, lives on land near the sea in Florida and on the Caribbean islands, from the beach to the forest.',
    eats: 'Caribbean hermit crabs eat almost anything: fallen fruit, leaves, dead animals and leftovers. They even climb trees and bushes to find food.',
    wow: 'Its big purple claw works like a door: when the crab pulls back into its shell, it shuts the opening with the claw. Each summer the mothers walk down to the sea at night to let their eggs hatch in the water.',
    fun: 'Bauble crabs borrow shiny Christmas baubles instead of shells. On a sunny day you can see the whole beach reflected in one.',
  },
  {
    id: 'ocean-treeworm', map: 'bg-ocean', name: 'Christmas tree worm', rarity: 'rare', december: true, how: ['rise'], from: 'coral', seasons: ['winter'], shy: true,
    look: { plan: 'treeworm', len: 22, fur: '#e03131', accent: '#2f9e44', shell: '#c8a97e', belly: '#f1e3c8', dark: '#8a6a4a' },
    where: 'Christmas tree worms live on coral reefs in warm seas all around the world. Each one lives in a tube it builds inside a living coral.',
    eats: 'Plankton: tiny plants and animals drifting in the water. The worm catches them on its feathery crowns, which pass the food down to its mouth.',
    wow: 'Its two spiral crowns look just like little Christmas trees, in red, orange, yellow, blue or white. If a shadow passes over, it zips them into its tube in a blink and shuts a spiky trapdoor, so you have to be quick!',
    fun: 'In December the worms of Under the Sea put a gold star on top of each crown, and the clownfish come to see.',
  },
  {
    id: 'space-yeti', map: 'bg-space', name: 'Moon yeti', rarity: 'rare', december: true, how: ['hop', 'step'], from: 'rock', seasons: ['winter'], cousin: 'Himalayan brown bear',
    look: { plan: 'yeti', len: 34, fur: '#e7e9f7', dark: '#aeb4d4', face: '#8fa2e6', xmas: ['bobble', 'scarf'] },
    where: 'Its real cousin, the Himalayan brown bear, lives high in the Himalaya mountains of Nepal, India, Pakistan and Tibet, up where the snow lasts most of the year.',
    eats: 'Himalayan brown bears eat grass, roots and berries, and dig up insects and marmots (big, chubby ground squirrels).',
    wow: 'Scientists once tested hair, bones and teeth that people said came from yetis. Most of them turned out to come from Himalayan brown bears! These bears sleep through the winter in a den.',
    fun: 'The moon yeti knits its own bobble hats from moon-moss wool, and in December it leaves one on a crater for anyone with cold ears.',
  },
  {
    id: 'castle-lantern', map: 'bg-castle', name: 'Lantern fox', rarity: 'rare', december: true, how: ['step', 'run'], from: 'bush', seasons: ['winter'], cousin: 'red fox',
    look: { plan: 'quad', len: 30, fur: '#e8590c', belly: '#ffffff', dark: '#3b2a20', tail: 'bushy', tip: true, legs: 0.36, ears: 'point', muzzle: true, xmas: ['scarf', 'lantern'] },
    where: 'Its real cousin, the red fox, lives all over Britain: in woods, farms and fields, and in towns and cities too, where some foxes even live in gardens.',
    eats: 'Red foxes eat mice, voles, rabbits, birds, worms and beetles, plus berries and fallen fruit. A fox buries extra food and comes back for it later.',
    wow: 'A fox\'s eyes have a shiny layer at the back, like a little mirror, that helps it see at night. That is why they glow green-gold when a light shines on them!',
    fun: 'On December nights the lantern fox lights the castle path for the carol singers, and it is never late.',
  },
  {
    id: 'volcano-christmas', map: 'bg-volcano', name: 'Christmas iguana', rarity: 'rare', december: true, how: ['step', 'step'], from: 'rock', seasons: ['winter'],
    look: { plan: 'lizard', len: 52, fur: '#c0392b', extra: 'crest', accent: '#38d9a9', face: '#e8604c', dark: '#3d1410', xmas: ['santa', 'sneeze', 'patches'] },
    where: 'Marine iguanas live only on the Galápagos Islands. The most colorful ones live on Española, one of the oldest islands.',
    eats: 'Seaweed! Marine iguanas are the only lizards in the world that feed in the sea. They scrape seaweed off the rocks with their short, flat snouts.',
    wow: 'Around Christmas time the boys on Española turn bright red and green to show off, so people call them Christmas iguanas. They sneeze out the extra salt from the sea water: achoo!',
    fun: 'Only in this game does it wear a Santa hat. It says the hat keeps its head warm after a cold swim.',
  },
  {
    id: 'jungle-candycane', map: 'bg-rainforest', name: 'Candy-cane toucan', rarity: 'rare', december: true, how: ['perch', 'fly'], from: 'tree', seasons: ['winter'], cousin: 'toco toucan',
    look: { plan: 'bird', len: 26, fur: '#212529', belly: '#212529', face: '#ffffff', beak: '#e03131', bigBill: true, bill: 0.34, xmas: ['candy', 'holly'] },
    where: 'Its real cousin, the toco toucan, lives in South America, in patches of forest, palm groves and woods along rivers.',
    eats: 'Toucans eat fruit most of all, plus insects, eggs and lizards. A toucan picks a berry with the tip of its bill, then tosses it up and catches it.',
    wow: 'A toco toucan\'s bill is huge but light: it is made of keratin, like your fingernails, over a honeycomb of thin bone. On hot days warm blood flows into the bill to cool the bird down.',
    fun: 'Its candy-cane bill smells of peppermint all December, and the monkeys follow it through the trees to sniff it.',
  },
  {
    id: 'fjord-twinkle', map: 'bg-fjord', name: 'Twinkle moose', rarity: 'rare', december: true, how: ['step', 'track'], from: 'tree', land: true, seasons: ['winter'], cousin: 'moose',
    look: { plan: 'quad', len: 54, fur: '#5a3d2b', belly: '#a08670', paler: true, horns: 'palm', hooves: true, legs: 0.55, extra: 'hump', snout: 1.6, headR: 0.17, tail: 'none', dewlap: true, xmas: ['lights'] },
    where: 'Its real cousin, the moose, lives in the northern forests of Alaska, Canada, northern Europe and Asia. Alaska moose are the biggest moose of all.',
    eats: 'Moose eat willow, birch and aspen twigs in winter, and water plants in summer, wading in up to their shoulders.',
    wow: 'A boy moose grows new antlers every year, up to 6 feet wide, and drops them in winter. In Alaska, moose sometimes walk off with Christmas lights from someone\'s yard tangled in their antlers!',
    fun: 'Its lights never run out: they twinkle all December, and the ptarmigans follow it home in the dark.',
  },
  {
    id: 'rainbow-ginger', map: 'bg-rainbow', name: 'Gingerbread mouse', rarity: 'rare', december: true, how: ['rise', 'step'], from: 'bush', color: 'orange', seasons: ['winter'], cousin: 'house mouse',
    look: { plan: 'small', len: 26, fur: '#c97b3c', dark: '#7a4522', ears: 'round', tail: 'long', sits: true, headR: 0.2, nose: '#ff6b6b', xmas: ['ginger'] },
    where: 'Its real cousin, the house mouse, lives almost everywhere people live, on every continent but Antarctica: in houses, barns, fields and shops.',
    eats: 'House mice eat seeds and grain most of all, and crumbs of almost anything people eat. A mouse nibbles 15 to 20 little meals a day.',
    wow: 'Mice sing! Boy mice sing little songs to girl mice, but the notes are too high for people to hear. A mouse can squeeze through a gap as thin as a pencil.',
    fun: 'It smells of cinnamon and lives in a gingerbread house with a gumdrop door. Every December it pipes itself new icing boots.',
  },
  {
    id: 'galaxy-reindeer', map: 'bg-galaxy', name: 'Comet reindeer', rarity: 'rare', december: true, how: ['fly', 'step', 'perch'], from: 'sky', seasons: ['winter'], cousin: 'reindeer',
    look: { plan: 'quad', len: 34, fur: '#8a5a3c', belly: '#f1e3c8', dark: '#4a2e1e', horns: 'antler', hornCol: '#fcc419', hooves: true, legs: 0.5, tail: 'short', tailTag: 'belly', mark: 'chest', ears: 'point', muzzle: true, flies: true, xmas: ['bells', 'stardust', 'twinkle'] },
    where: 'Its real cousin, the reindeer, lives on the cold tundra and in the northern forests of Europe, Asia and North America, where it is called the caribou.',
    eats: 'Reindeer eat a fluffy lichen called reindeer moss. In winter they dig down through the snow with their wide hooves to reach it.',
    wow: 'Reindeer are the only deer where the girls grow antlers too. Their eyes turn from gold in summer to blue in winter, to see in the long dark, and their knees click as they walk!',
    fun: 'Comet reindeer fly between the golden planets, leaving a trail of stardust. If you hear jingling in Golden Galaxy, look up!',
  },
  // ---------- secret animals (Taylor, 2026-11-27): two a map, very rare ----------
  // night: only on a night ride (after dark in Denver, or after 7 PM); about 1 night ride in 2
  // brings it (NIGHT_SHARE). route: any ride, about 1 in 40 (SECRET_SHARE), and it lives on the
  // map's hidden side route, where it comes far more often.
  {
    id: 'meadow-flyingsquirrel', map: 'bg-meadow', name: 'Northern flying squirrel', rarity: 'secret', night: true, how: ['perch', 'rise'], from: 'tree',
    look: { plan: 'small', len: 26, fur: '#9c8466', belly: '#f8f1e3', dark: '#3b2f22', tail: 'bushy', ears: 'round', sits: true, bigEyes: true, bodyH: 0.22 },
    where: 'Northern flying squirrels live in the cold pine and fir forests of Canada, Alaska and the northern United States, sleeping in tree holes by day.',
    eats: 'Mushrooms and truffles dug from the ground most of all, plus lichens, nuts, seeds and buds.',
    wow: 'They don\'t really fly: they leap and glide on a furry flap of skin between their front and back legs, steering with their flat tail. One glide can cross a whole football field!',
  },
  {
    id: 'meadow-bobcat', map: 'bg-meadow', name: 'Bobcat', rarity: 'secret', route: true, how: ['step', 'step'], from: 'rock',
    look: { plan: 'quad', len: 30, fur: '#b08a5e', belly: '#f1e3c8', legs: 0.26, bulk: 0.45, legW: 0.12, neck: 0.12, headR: 0.25, snout: 0.2, ears: 'lynx', tail: 'short', tailTag: 'dark', dark: '#3b2a1a', mark: 'spots', spotTag: 'dark' },
    where: 'Bobcats live all over North America, from Canadian forests to Mexican deserts, and even at the edges of towns. They are very good at not being seen.',
    eats: 'Rabbits and hares most of all, plus mice, squirrels and birds.',
    wow: 'A bobcat is named for its short "bobbed" tail. It is about twice as big as a pet cat and can leap 10 feet in one pounce.',
  },
  {
    id: 'fjord-wolf', map: 'bg-fjord', name: 'Gray wolf', rarity: 'secret', night: true, how: ['step', 'step'], from: 'tree', land: true,
    look: { plan: 'quad', len: 38, fur: '#8e8a86', belly: '#e9ecef', dark: '#343a40', ears: 'point', tail: 'bushy', legs: 0.34, bulk: 0.5, legW: 0.11, neck: 0.1, headR: 0.22, muzzle: true, snout: 0.9, extra: 'ruff' },
    where: 'Gray wolves live in the forests, mountains and tundra of Alaska, Canada and parts of the northern United States, Europe and Asia, in family packs.',
    eats: 'Big animals like moose, caribou, deer and elk, hunted together as a pack, plus beavers and salmon in Alaska.',
    wow: 'A wolf\'s howl can be heard about 6 miles away. Each wolf has its own voice, and a pack howls together to say "this is our home".',
  },
  {
    id: 'fjord-wolverine', map: 'bg-fjord', name: 'Wolverine', rarity: 'secret', route: true, how: ['step'], from: 'rock', land: true,
    look: { plan: 'quad', len: 30, fur: '#4a3426', belly: '#c49a6c', dark: '#1e1510', legs: 0.22, bulk: 0.55, legW: 0.13, neck: 0.04, headIn: 0.06, headR: 0.24, ears: 'round', tail: 'bushy', muzzle: true, snout: 0.6, mark: 'chest', accent: '#d9a066' },
    where: 'Wolverines live in the snowy mountains and forests of Alaska, Canada, Scandinavia and Russia. Each one roams a huge area.',
    eats: 'Almost anything: leftovers from wolves\' hunts, small animals, eggs, roots and berries.',
    wow: 'A wolverine is the biggest weasel that lives on land, and one of the toughest animals there is: it can climb a mountain in winter without stopping to rest.',
  },
  {
    id: 'space-jerboa', map: 'bg-space', name: 'Moon jerboa', rarity: 'secret', night: true, how: ['hop', 'hop'], from: 'rock', cousin: 'long-eared jerboa',
    look: { plan: 'hop', len: 18, fur: '#d8c8f0', belly: '#ffffff', dark: '#7d82a8', ears: 'long', tail: 'long', eye: '#3b2e6e', bigEyes: true },
    where: 'The long-eared jerboa lives in the sandy deserts of Mongolia and China. It hides in a burrow all day and comes out only at night.',
    eats: 'Mostly flying insects like beetles and moths, which it catches in the dark.',
    wow: 'Its ears are bigger than its head, and it hops on its long back legs like a tiny kangaroo, steering with a long tufted tail. It was only filmed in the wild for the first time in 2007!',
  },
  {
    id: 'space-axolotl', map: 'bg-space', name: 'Moon axolotl', rarity: 'secret', route: true, how: ['rise', 'step'], from: 'rock', cousin: 'axolotl',
    look: { plan: 'lizard', len: 46, fur: '#f8b4d0', face: '#ffc9de', extra: 'crest', accent: '#e64980', mark: 'spots', dark: '#a61e4d' },
    where: 'Real axolotls live in just one place in the wild: the canals and lakes of Xochimilco, by Mexico City.',
    eats: 'Worms, bugs, little fish and tadpoles, sucked up like a vacuum cleaner.',
    wow: 'An axolotl can grow back a lost leg, its tail, even parts of its heart and brain! The frilly things on its head are gills, so it can breathe underwater all its life.',
  },
  {
    id: 'castle-marten', map: 'bg-castle', name: 'Pine marten', rarity: 'secret', night: true, how: ['perch', 'rise', 'run'], from: 'tower',
    look: { plan: 'small', len: 26, fur: '#6b3e22', belly: '#f2c86a', dark: '#2b180c', tail: 'bushy', ears: 'round', sits: true, bodyH: 0.18 },
    where: 'Pine martens live in old woods across Europe, including Scotland, Wales and Ireland, sleeping in tree holes and old buildings.',
    eats: 'Voles and squirrels, birds, eggs, beetles and lots of berries in autumn.',
    wow: 'A pine marten has a creamy-yellow "bib" on its chest, and no two are the same. It can climb down a tree head first and leap from branch to branch like a squirrel.',
  },
  {
    id: 'castle-boar', map: 'bg-castle', name: 'Wild boar', rarity: 'secret', route: true, how: ['step', 'run'], from: 'bush',
    look: { plan: 'quad', len: 38, fur: '#4a3a2e', belly: '#6e5a48', dark: '#1e1712', legs: 0.22, bulk: 0.62, legW: 0.12, neck: 0.02, headIn: 0.1, headR: 0.22, ears: 'point', tail: 'short', snout: 1.3, nose: '#c9a0a0', extra: 'tusks' },
    where: 'Wild boar live in woods and marshes across Europe and Asia, and they have come back to some English woods after hundreds of years.',
    eats: 'Acorns, beech nuts, roots, mushrooms and worms, dug up with their strong snout.',
    wow: 'Baby boar are called humbugs because they are striped like the candy! Their stripes help them hide in the woods and fade by the time they are 6 months old.',
  },
  {
    id: 'sunset-horseshoe', map: 'bg-sunset', name: 'Atlantic horseshoe crab', rarity: 'secret', night: true, how: ['rise', 'step'], from: 'burrow',
    look: { plan: 'horseshoe', len: 30, fur: '#7a5a3a', belly: '#c8a070', dark: '#3d2a18' },
    where: 'Horseshoe crabs live along the Atlantic coast from Maine to Mexico, and crawl up onto beaches on spring nights to lay their eggs.',
    eats: 'Clams, worms and little crabs, which they crush with spiny bits on their legs.',
    wow: 'Horseshoe crabs are older than the dinosaurs: they have been around for about 450 million years! They aren\'t true crabs, and their blood is blue.',
  },
  {
    id: 'sunset-panther', map: 'bg-sunset', name: 'Florida panther', rarity: 'secret', route: true, how: ['step', 'step'], from: 'tree',
    look: { plan: 'quad', len: 40, fur: '#c49a6c', belly: '#f1e3c8', dark: '#3b2a1a', ears: 'round', tail: 'long', legs: 0.3, bulk: 0.42, legW: 0.11, neck: 0.1, headR: 0.2, muzzle: true, snout: 0.4 },
    where: 'Florida panthers live only in the swamps, forests and prairies of southern Florida. They are a kind of cougar, also called a mountain lion.',
    eats: 'White-tailed deer and wild hogs most of all, plus raccoons and armadillos.',
    wow: 'There are only about 200 Florida panthers in the wild, so seeing one is very rare. A panther can leap 15 feet straight up into a tree.',
  },
  {
    id: 'ocean-squid', map: 'bg-ocean', name: 'Caribbean reef squid', rarity: 'secret', night: true, how: ['fly'], from: 'sky',
    look: { plan: 'squid', len: 36, fur: '#c9a06a', belly: '#f3d9b1', dark: '#7a4e22', mark: 'spots', accent: '#74c0fc' },
    where: 'Caribbean reef squid live over the coral reefs and seagrass of the Caribbean Sea and the coast of Florida, often in little groups.',
    eats: 'Small fish and shrimp, caught with two long arms that shoot out.',
    wow: 'Reef squid "talk" by changing colors and patterns all over their skin in a blink, and one squid can show one pattern on its left side and another on its right!',
  },
  {
    id: 'ocean-sunfish', map: 'bg-ocean', name: 'Ocean sunfish', rarity: 'secret', route: true, how: ['fly'], from: 'sky',
    look: { plan: 'fish', len: 52, fur: '#9aa8b8', belly: '#d8e0ea', depth: 0.5, fin: true, finTag: 'fur', tailTag: 'fur', mark: 'spots', accent: '#c8d4e0', eye: '#212529' },
    where: 'Ocean sunfish swim in warm and mild seas all over the world, and come up near the surface to bask in the sun.',
    eats: 'Jellyfish most of all, plus small fish, squid and sea plants.',
    wow: 'The ocean sunfish is the heaviest bony fish in the world: as heavy as a car! It starts out smaller than a grain of rice, and it lets seabirds pick little bugs off its skin.',
  },
  {
    id: 'volcano-gull', map: 'bg-volcano', name: 'Swallow-tailed gull', rarity: 'secret', night: true, how: ['perch', 'fly'], from: 'rock',
    look: { plan: 'bird', len: 22, fur: '#e9ecef', belly: '#ffffff', dark: '#495057', mark: 'cap', accent: '#343a40', beak: '#212529', eye: '#e03131' },
    where: 'Swallow-tailed gulls nest only on the Galápagos Islands, on cliffs by the sea, and fly out over the ocean to feed.',
    eats: 'Squid and little fish that come up to the surface of the sea at night.',
    wow: 'It is the only gull in the world that hunts at night. Its huge eyes, ringed in red, help it see squid in the dark water.',
  },
  {
    id: 'volcano-racer', map: 'bg-volcano', name: 'Galápagos racer', rarity: 'secret', route: true, how: ['rise', 'step'], from: 'rock',
    look: { plan: 'snake', len: 50, fur: '#5c4a3a', belly: '#e0c896', dark: '#2b221b', mark: 'stripes', accent: '#e0c896' },
    where: 'Galápagos racers live only on the Galápagos Islands, sliding over the black lava rock and the sandy beaches.',
    eats: 'Lava lizards, geckos, and baby marine iguanas as they hatch.',
    wow: 'Racers wait together on the beach when baby iguanas hatch, then chase them over the rocks. Filmmakers caught it on camera, and it became one of the most famous chases in nature films!',
  },
  {
    id: 'rainforest-kinkajou', map: 'bg-rainforest', name: 'Kinkajou', rarity: 'secret', night: true, how: ['perch', 'rise'], from: 'tree',
    look: { plan: 'small', len: 30, fur: '#c88a3e', belly: '#f2d39a', dark: '#5a3a1a', tail: 'long', ears: 'round', sits: true, bigEyes: true, bodyH: 0.2 },
    where: 'Kinkajous live high in the rainforest trees of Central and South America, from Mexico to Brazil, and sleep in tree holes by day.',
    eats: 'Mostly ripe fruit, especially figs, plus nectar and honey.',
    wow: 'A kinkajou\'s tongue is about 5 inches long, perfect for licking honey out of bees\' nests: that is why it is called the honey bear. Its tail can hold on to branches like a hand.',
  },
  {
    id: 'rainforest-anteater', map: 'bg-rainforest', name: 'Giant anteater', rarity: 'secret', route: true, how: ['step', 'step'], from: 'bush',
    look: { plan: 'quad', len: 44, fur: '#6b5a48', belly: '#2b2520', dark: '#1e1915', legs: 0.26, bulk: 0.42, legW: 0.1, neck: 0.04, headR: 0.11, ears: 'round', tail: 'bushy', snout: 3, mark: 'chest', accent: '#e9e0d0' },
    where: 'Giant anteaters live in the grasslands and rainforests of Central and South America, from Honduras to Argentina.',
    eats: 'Ants and termites: up to 30,000 in one day!',
    wow: 'It has no teeth. Its sticky tongue is 2 feet long and flicks in and out 150 times a minute, and it only eats for about a minute at each anthill so the ants don\'t bite back.',
  },
  {
    id: 'rainbow-loris', map: 'bg-rainbow', name: 'Lullaby loris', rarity: 'secret', night: true, how: ['perch', 'rise'], from: 'tree', cousin: 'slow loris',
    look: { plan: 'small', len: 22, fur: '#e6c8f0', belly: '#fff0f6', dark: '#9c36b5', mark: 'mask', tail: 'none', ears: 'round', sits: true, bigEyes: true, eye: '#5f3dc4', bodyH: 0.22 },
    where: 'Real slow lorises live in the rainforests of Southeast Asia, from India to Indonesia, high up in the trees.',
    eats: 'Insects, fruit, flower nectar and tree gum.',
    wow: 'Slow lorises move very slowly and quietly so nothing notices them, and their huge eyes help them see at night. They are one of the very few mammals with a venomous bite!',
  },
  {
    id: 'rainbow-panda', map: 'bg-rainbow', name: 'Candy panda', rarity: 'secret', route: true, how: ['perch', 'step', 'rise'], from: 'tree', cousin: 'red panda',
    look: { plan: 'small', len: 28, fur: '#f76707', belly: '#2b1d12', dark: '#5a2a0a', mark: 'mask', tail: 'ring', ears: 'round', sits: true, bodyH: 0.22, headR: 0.22, accent: '#ffffff' },
    where: 'Real red pandas live in the cool mountain forests of the Himalayas, in Nepal, India, Bhutan, Myanmar and China.',
    eats: 'Bamboo leaves most of all, plus fruit, acorns and bird eggs.',
    wow: 'The red panda was called a "panda" about 50 years before the giant panda was! It wraps its fluffy striped tail around itself like a blanket to sleep.',
  },
  {
    id: 'galaxy-ayeaye', map: 'bg-galaxy', name: 'Star aye-aye', rarity: 'secret', night: true, how: ['perch', 'rise'], from: 'tree', cousin: 'aye-aye',
    look: { plan: 'small', len: 24, fur: '#4a4060', belly: '#8a80a0', dark: '#1e1a2b', tail: 'bushy', ears: 'round', sits: true, bigEyes: true, eye: '#ffd43b', bodyH: 0.2 },
    where: 'Real aye-ayes live only in the rainforests of Madagascar, an island off Africa.',
    eats: 'Grubs found inside tree trunks, plus seeds, fruit and nectar.',
    wow: 'An aye-aye taps on a tree with a super-long middle finger and listens for grubs moving inside, then pokes the finger in to pull them out!',
  },
  {
    id: 'galaxy-okapi', map: 'bg-galaxy', name: 'Golden okapi', rarity: 'secret', route: true, how: ['step', 'step'], from: 'tree', cousin: 'okapi',
    look: { plan: 'quad', len: 40, fur: '#b8860b', belly: '#fff3bf', dark: '#5a3e0a', legs: 0.55, neck: 0.45, headR: 0.15, ears: 'point', tail: 'short', hooves: true, mark: 'stripes', accent: '#fff9db', muzzle: true, snout: 1.1 },
    where: 'Real okapis live only in the thick Ituri rainforest of the Democratic Republic of the Congo, in Africa.',
    eats: 'Leaves, buds, fruit and fungi, pulled off with a long blue tongue.',
    wow: 'The okapi has zebra stripes on its legs, but it is really the giraffe\'s closest cousin! Scientists in Europe didn\'t know okapis existed until about 1901.',
  },
];

export const RARITIES = {
  common: { name: 'Common', weight: 10, points: 10 },
  uncommon: { name: 'Uncommon', weight: 5, points: 20 },
  rare: { name: 'Rare', weight: 1.6, points: 40 },
  legend: { name: 'Legend', weight: 0.35, points: 100 },
  // secret animals come only by a fixed share of each pick (NIGHT_SHARE / SECRET_SHARE), not by weight
  secret: { name: 'Secret', weight: 0, points: 150 },
};

export const critterById = (id) => CRITTERS.find((c) => c.id === id);
/** The maps that have their own animals (every map now; an unknown map borrows the Forest Village's). */
export const CRITTER_MAPS = [...new Set(CRITTERS.map((c) => c.map))];
export const mapCritters = (map) => {
  const m = CRITTER_MAPS.includes(map) ? map : 'bg-meadow';
  return CRITTERS.filter((c) => c.map === m);
};

/** Is this animal out in this season? */
export const inSeason = (c, season) => !c.seasons || c.seasons.includes(season);
/** Is this animal out on this day ('YYYY-MM-DD') in this season? December animals only come in December. */
export const isOut = (c, season, day) => inSeason(c, season) && (!c.december || inDecember(day));

// ---------- daily weather ----------
// The same weather for the whole family on a day. Winter swaps rain for snow.
export const WEATHERS = {
  sunny: { name: 'Sunny', icon: '☀️' },
  mist: { name: 'Misty', icon: '🌫️' },
  rain: { name: 'Rainy', icon: '🌧️' },
  snow: { name: 'Snowy', icon: '🌨️' },
  wind: { name: 'Windy', icon: '🍃' },
};
const hash = (s) => { let h = 2166136261; for (const ch of String(s)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619); return (h >>> 0) / 4294967296; };
/**
 * The weather on a day. A seven-day cycle (shuffled by the week) makes sure every kind of
 * weather comes at least once a week, so rain-only animals never stall the album.
 */
export function weatherOf(day, season) {
  const d = new Date(`${day}T12:00:00Z`);
  const week = Math.floor(d.getTime() / (7 * 864e5));
  const wet = season === 'winter' ? 'snow' : 'rain';
  const cycle = ['sunny', 'sunny', 'mist', wet, 'wind', wet, 'sunny'];
  // shuffle the week's cycle with the week number
  const order = cycle.map((w, i) => [w, hash(`${week}|${i}`)]).sort((a, b) => a[1] - b[1]).map((x) => x[0]);
  return order[((d.getUTCDay() % 7) + 7) % 7];
}

/** The day's Wanted animal on a map: the same one for the whole family (never the legend). */
export function wantedOf(day, map, season) {
  const pool = mapCritters(map).filter((c) => isOut(c, season, day) && c.rarity !== 'legend' && c.rarity !== 'secret' && !c.how.every((h) => h === 'far') && !c.tunnel);
  return pool.length ? pool[Math.floor(hash(`${day}|${map}|wanted`) * pool.length)].id : null;
}

/**
 * How likely each animal is to turn up next, as [critter, weight]. tier: the kid's camera
 * (a Super camera brings rare animals 75% more often, like the super rod). Far animals only
 * come when the camera has a zoom lens (or as "too far" specks to show what a zoom would reach).
 * day: the ride's day; the December animals come only when it is in December.
 */
/**
 * A December animal's chance each time an animal comes, as a share of all the others' weight
 * (review 1, D12). The photo train sets it after its own filters, so every map's December animal
 * comes about 1 ride in 3 with the Super camera (which brings it 75% more often, like a rare),
 * however many animals its map has: a perfect photo of it should be something to boast about.
 */
export const DECEMBER_SHARE = 0.01;
/**
 * The secret animals (Taylor, 2026-11-27: a few very rare ones a map, at certain times of day or
 * very seldom). Each time an animal comes, a share of all the others' weight, like the December
 * animals. NIGHT_SHARE: the map's night animal, on a night ride only, about 1 night ride in 2.
 * SECRET_SHARE: the map's very rare animal, any ride, about 1 ride in 40 (Super camera 75% more).
 * ROUTE_SHARE: the very rare animal on the map's hidden side route (much likelier there).
 */
export const NIGHT_SHARE = 0.023; // tuned for the 110 s ride (about 38 animals a ride)
export const SECRET_SHARE = 0.00066;
export const ROUTE_SHARE = 0.015;

export function oddsFor(map, season, weather, { tier = 1, clue = 0, day = null } = {}) {
  return mapCritters(map).filter((c) => isOut(c, season, day) && !c.tunnel).map((c) => {
    let w = RARITIES[c.rarity].weight;
    if (c.weather?.includes(weather)) w *= 3;
    if ((c.rarity === 'rare' || c.rarity === 'legend') && tier >= 3) w *= 1.75;
    if (c.rarity === 'legend') w *= 1 + clue; // clues make the legend likelier
    return [c, w];
  });
}

/** Pick from [item, weight] pairs with r in 0..1. */
export function pickWeighted(pairs, r) {
  const total = pairs.reduce((s, p) => s + p[1], 0);
  let x = r * total;
  for (const [item, w] of pairs) { x -= w; if (x <= 0) return item; }
  return pairs.length ? pairs[pairs.length - 1][0] : null;
}

// ---------- photos ----------
// Three ticks on every photo (Fable's review, 2026-11-21): Sharp, Posed, Centred.
// All three = perfect; sharp = good; not sharp = a blurry glimpse (no points, not in the album).
export const QUALITY = {
  blurry: { name: 'Blurry glimpse', short: 'Blurry', mult: 0, color: '#adb5bd' },
  good: { name: 'Good', short: 'Good', mult: 1, color: '#74c0fc' },
  perfect: { name: 'Perfect', short: 'Perfect', mult: 2, color: '#ffd43b' },
};
export const qualityOf = ({ sharp, posed, centred }) => (!sharp ? 'blurry' : posed && centred ? 'perfect' : 'good');
const RANK = { blurry: 0, good: 1, perfect: 2 };
export const better = (a, b) => RANK[a] > RANK[b || 'blurry'] || (!b && a !== 'blurry');

/**
 * Album slots for each animal: a Portrait (it posed for you), an Action shot (a sharp shot
 * of it on the move) and a Close-up (it fills the frame).
 */
export const SLOTS = { portrait: 'Portrait', action: 'Action', close: 'Close-up' };
export function slotsOf(shot) {
  if (shot.quality === 'blurry') return [];
  const out = [];
  if (shot.posed) out.push('portrait');
  if (shot.moving) out.push('action');
  if (shot.fill >= 0.5) out.push('close');
  if (!out.length) out.push('portrait');
  return out;
}

/** Points for a photo: the rarity's points times good (1x) or perfect (2x); the Wanted animal doubles it. */
export const photoPoints = (c, quality, wanted = false) => RARITIES[c.rarity].points * QUALITY[quality].mult * (wanted ? 2 : 1);
/** Extra points the first time an animal goes in the kid's album. */
export const NEW_BONUS = 15;
