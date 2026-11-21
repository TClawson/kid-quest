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
];

export const RARITIES = {
  common: { name: 'Common', weight: 10, points: 10 },
  uncommon: { name: 'Uncommon', weight: 5, points: 20 },
  rare: { name: 'Rare', weight: 1.6, points: 40 },
  legend: { name: 'Legend', weight: 0.35, points: 100 },
};

export const critterById = (id) => CRITTERS.find((c) => c.id === id);
/** The maps that have their own animals (others borrow the Forest Village's for now). */
export const CRITTER_MAPS = [...new Set(CRITTERS.map((c) => c.map))];
export const mapCritters = (map) => {
  const m = CRITTER_MAPS.includes(map) ? map : 'bg-meadow';
  return CRITTERS.filter((c) => c.map === m);
};

/** Is this animal out in this season? */
export const inSeason = (c, season) => !c.seasons || c.seasons.includes(season);

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
  const pool = mapCritters(map).filter((c) => inSeason(c, season) && c.rarity !== 'legend' && !c.how.every((h) => h === 'far') && !c.tunnel);
  return pool.length ? pool[Math.floor(hash(`${day}|${map}|wanted`) * pool.length)].id : null;
}

/**
 * How likely each animal is to turn up next, as [critter, weight]. tier: the kid's camera
 * (a Super camera brings rare animals 75% more often, like the super rod). Far animals only
 * come when the camera has a zoom lens (or as "too far" specks to show what a zoom would reach).
 */
export function oddsFor(map, season, weather, { tier = 1, clue = 0 } = {}) {
  return mapCritters(map).filter((c) => inSeason(c, season) && !c.tunnel).map((c) => {
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
