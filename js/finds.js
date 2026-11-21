// Treasure hill finds: real things to find on every map's hill, for the finds book in the
// buddy's house. Pure logic, no DOM (findart.js draws them).
//
// Each map has six finds: common, common, uncommon, uncommon, rare and one super rare.
// likes: the snow kind of the day that makes it show up more (slopes.js SNOW_KINDS).
// seasons: only shows up in these seasons (none: all year). shape + colors: how findart.js
// draws it. what / wow: the page in the finds book (real facts, checked).
//
// The kid's best of each lives on the kid's synced record:
//   kid.findRecords = { 'meadow-geode': { q: 2, in: 4.5, n: 3, date: '2026-11-21' } }
// q: the best condition found (1 rough, 2 fine, 3 perfect); in: the biggest (inches); n: how
// many found in all.

export const RARITY = {
  common: { id: 'common', name: 'Common', points: 10, weight: 30 },
  uncommon: { id: 'uncommon', name: 'Uncommon', points: 20, weight: 14 },
  rare: { id: 'rare', name: 'Rare', points: 50, weight: 4 },
  super: { id: 'super', name: 'Super rare', points: 120, weight: 1 },
};
export const CONDITIONS = [
  null,
  { q: 1, name: 'Rough', stars: '★', mult: 1 },
  { q: 2, name: 'Fine', stars: '★★', mult: 1.5 },
  { q: 3, name: 'Perfect', stars: '★★★', mult: 2.5 },
];

const f = (id, name, rarity, likes, shape, colors, what, wow, more = {}) => ({ id, name, rarity, likes, shape, colors, what, wow, ...more });

export const FINDS = {
  'bg-meadow': [
    f('pinecone', 'Pinecone', 'common', 'icy', 'cone', ['#8b5a2b', '#5c3a1e', '#c98a4b'],
      'A pinecone is how a pine tree keeps its seeds safe. Each scale hides two seeds with little wings.',
      'Pinecones close up tight when it is wet and open again when it is dry, so some people use them to guess the weather!'),
    f('acorn', 'Acorn', 'common', 'slushy', 'acorn', ['#c98a4b', '#8b5a2b', '#5c3a1e'],
      'An acorn is the seed of an oak tree, in a little cap. Squirrels and jays bury thousands of them for winter.',
      'Squirrels forget where they buried lots of their acorns, and those grow into new oak trees!'),
    f('quartz', 'Quartz crystal', 'uncommon', 'icy', 'crystal', ['#f8f9fa', '#ced4da', '#ffffff'],
      'Quartz is one of the most common minerals on Earth. It grows in six-sided crystals with pointy tips.',
      'Squeeze a quartz crystal and it makes a tiny bit of electricity. That is how quartz keeps time in watches!'),
    f('geode', 'Geode', 'uncommon', 'powder', 'geode', ['#868e96', '#9775fa', '#e5dbff'],
      'A geode looks like a plain round rock, but inside it is hollow and lined with crystals.',
      'Geodes form when water drips through a hollow in rock for thousands of years and leaves crystals behind, layer by layer.'),
    f('antler', 'Deer antler', 'rare', 'powder', 'antler', ['#e9d8b4', '#c9a97a', '#8d6e63'],
      'Male white-tailed deer grow new antlers every year and drop them in late winter. People call a dropped antler a "shed".',
      'Antlers are some of the fastest-growing bone in the animal world. They can grow about a quarter of an inch in one day!',
      { seasons: ['winter', 'spring'] }),
    f('clover', 'Four-leaf clover', 'super', 'slushy', 'clover', ['#2f9e44', '#51cf66', '#1b5e20'],
      'Most clovers have three leaves. A clover with four leaves is a lucky rare change in the plant.',
      'People think only about 1 clover in 5,000 has four leaves!',
      { seasons: ['summer'] }),
  ],
  'bg-castle': [
    f('horseshoe', 'Horseshoe', 'common', 'slushy', 'horseshoe', ['#868e96', '#495057', '#adb5bd'],
      'Knights\' horses wore iron shoes nailed to their hooves, which protected them on hard roads. A blacksmith made each one by hand.',
      'Nailing on a horseshoe does not hurt, because the outside of a hoof is like a big, thick fingernail.'),
    f('pottery', 'Pottery shard', 'common', 'icy', 'shard', ['#e8590c', '#c2410c', '#ffa94d'],
      'A shard is a broken piece of an old clay pot or jug. Castle kitchens used clay pots for cooking and keeping food.',
      'Archaeologists can often tell how old a place is just from the style of the broken pottery found there.'),
    f('flint', 'Flint', 'uncommon', 'icy', 'flint', ['#495057', '#212529', '#adb5bd'],
      'Flint is a very hard stone that breaks with sharp edges. It was used for tools for thousands of years.',
      'Strike flint against steel and it throws sparks. That was how people lit fires before matches!'),
    f('key', 'Iron key', 'uncommon', 'powder', 'key', ['#868e96', '#495057', '#ced4da'],
      'Big iron keys opened the heavy wooden doors and chests in a castle. A blacksmith made the lock and key as a pair.',
      'The person in charge of a castle\'s keys was trusted with everything inside it. Real finders of very old things tell a museum, so everyone can learn from them.'),
    f('penny', 'Silver penny', 'rare', 'powder', 'coin', ['#ced4da', '#868e96', '#f8f9fa'],
      'In the Middle Ages, a penny was a thin coin of real silver with the king\'s face on it.',
      'People cut pennies into halves and quarters to make change. That is where the word "farthing" (a fourth) comes from!'),
    f('sapphire', 'Sapphire ring', 'super', 'icy', 'ring', ['#ffd43b', '#1c7ed6', '#74c0fc'],
      'Sapphires are blue gems that kings and queens wore in rings and crowns.',
      'Sapphire is so hard that only diamond can scratch it. It is the same mineral as ruby, just a different color!'),
  ],
  'bg-sunset': [
    f('scallop', 'Scallop shell', 'common', 'icy', 'scallop', ['#ff922b', '#ffd8a8', '#e8590c'],
      'A scallop shell has ridges that fan out like rays. The scallop lived inside, between two shells.',
      'A live scallop can have up to 200 tiny eyes along the edge of its shell!'),
    f('moonsnail', 'Moon snail shell', 'common', 'slushy', 'snail', ['#e9d8b4', '#c9a97a', '#8d6e63'],
      'Moon snails are round sea snails that plow through the sand hunting clams.',
      'A moon snail drills a perfect little round hole in a clam\'s shell to eat it. Look for clam shells with holes!'),
    f('seaglass', 'Sea glass', 'uncommon', 'slushy', 'pebble', ['#63e6be', '#20c997', '#c3fae8'],
      'Sea glass starts as broken bottles. Waves and sand tumble it for years until it is smooth and frosty.',
      'Red and orange sea glass are the rarest colors, because few bottles were ever made in them.'),
    f('sanddollar', 'Sand dollar', 'uncommon', 'powder', 'sanddollar', ['#f1f3f5', '#dee2e6', '#adb5bd'],
      'A white sand dollar is the empty skeleton of a flat, round sea urchin. A live one is purple and fuzzy with tiny spines, so put those back in the water.',
      'The flower pattern on top is where its tube feet poked out to breathe!'),
    f('sharktooth', 'Shark tooth', 'rare', 'icy', 'tooth', ['#495057', '#212529', '#868e96'],
      'Fossil shark teeth wash up on some beaches. They turned dark gray or black from minerals while buried.',
      'A shark grows and loses thousands of teeth in its life, so there are lots to find!'),
    f('junonia', 'Junonia shell', 'super', 'powder', 'conch', ['#fff4e6', '#a0522d', '#ffe8cc'],
      'The junonia is a sea snail shell, creamy white with rows of brown spots. It lives in deep water, so it rarely washes up.',
      'On Sanibel Island in Florida, finding a junonia is such a big deal that the local newspaper prints your picture!'),
  ],
  'bg-ocean': [
    f('urchin', 'Sea urchin shell', 'common', 'slushy', 'urchin', ['#be4bdb', '#e599f7', '#862e9c'],
      'This round shell, called a test, is what is left of a sea urchin once its spines fall off.',
      'A sea urchin\'s mouth is on its bottom and has five teeth, called Aristotle\'s lantern.'),
    f('argonaut', 'Paper nautilus shell', 'common', 'icy', 'nautilus', ['#fff9db', '#e9d8b4', '#ffffff'],
      'A paper nautilus is really a small octopus called an argonaut. The mother makes this thin white shell as a cradle for her eggs.',
      'The shell is as thin as paper. The mother traps a bubble of air inside it so she can float!'),
    f('ammonite', 'Ammonite fossil', 'uncommon', 'powder', 'nautilus', ['#c9a97a', '#8d6e63', '#e9d8b4'],
      'Ammonites were sea animals with coiled shells, cousins of squid and octopus.',
      'Ammonites died out with the dinosaurs 66 million years ago. The biggest ones grew shells wider than a grown-up is tall!'),
    f('pearl', 'Pearl', 'uncommon', 'slushy', 'pearl', ['#f8f9fa', '#e9ecef', '#ffffff'],
      'A pearl grows inside an oyster or mussel when it coats a bit of grit in smooth layers of shell.',
      'A natural pearl takes years to grow, one thin layer at a time.'),
    f('megtooth', 'Megalodon tooth', 'rare', 'powder', 'tooth', ['#6c757d', '#343a40', '#adb5bd'],
      'Megalodon was a giant shark that lived until about 3.6 million years ago. Only its teeth and a few bones are left.',
      'A megalodon tooth can be bigger than your hand: up to about 7 inches long!'),
    f('doubloon', 'Spanish gold doubloon', 'super', 'icy', 'coin', ['#ffd43b', '#f08c00', '#fff3bf'],
      'Doubloons were gold coins from Spain. Treasure ships carried them across the ocean 300 years ago.',
      'In 1715 a hurricane sank a whole Spanish treasure fleet off Florida, and divers still find its gold coins today!'),
  ],
  'bg-volcano': [
    f('pumice', 'Pumice', 'common', 'powder', 'pebble', ['#dee2e6', '#adb5bd', '#f8f9fa'],
      'Pumice is lava that was full of gas bubbles when it cooled. It is so light it is like a stone sponge.',
      'Pumice can float on water! After some eruptions, rafts of pumice floated on the sea for months.'),
    f('scoria', 'Scoria', 'common', 'slushy', 'rock', ['#7c2d12', '#3d1a12', '#a8461f'],
      'Scoria is a dark red or black lava rock full of holes from gas bubbles. Cinder cone volcanoes are piled up from it.',
      'Scoria is full of holes like pumice, but it is heavier, so it sinks. People use it in gardens and barbecue grills.'),
    f('obsidian', 'Obsidian', 'uncommon', 'icy', 'shard', ['#212529', '#000000', '#495057'],
      'Obsidian is natural black glass. It forms when lava cools so fast it has no time to make crystals.',
      'Obsidian can break with an edge sharper than a steel knife, so people made tools and arrowheads from it.'),
    f('peridot', 'Peridot', 'uncommon', 'icy', 'crystal', ['#94d82d', '#5c940d', '#d8f5a2'],
      'Peridot is a green gem made of a mineral called olivine. Some volcanoes bring it up from deep in the Earth.',
      'Papakōlea Beach in Hawaii has green sand made of tiny olivine crystals from a volcano!'),
    f('peleshair', 'Pele\'s hair', 'rare', 'slushy', 'hair', ['#ffd43b', '#c9a97a', '#fff3bf'],
      'Pele\'s hair is thin threads of volcanic glass that the wind pulls out of lava fountains. It is named after the Hawaiian volcano goddess.',
      'The threads are as thin as a hair and sharp as glass, so look but never touch: scientists pick them up with tweezers. In national parks, every rock stays where it is.'),
    f('lavabomb', 'Lava bomb', 'super', 'powder', 'spindle', ['#495057', '#212529', '#e8590c'],
      'A lava bomb is a blob of lava thrown high into the air by a volcano. It cools while it flies and lands as a rock.',
      'Spinning in the air twists some lava bombs into a spindle shape with pointy ends, like a big lemon!'),
  ],
  'bg-rainforest': [
    f('brazilnut', 'Brazil nut pod', 'common', 'slushy', 'pod', ['#6e4520', '#8b5a2b', '#c98a4b'],
      'Brazil nut trees grow a hard round pod as big as a softball, with 10 to 25 nuts packed inside. The pods can weigh about 4 pounds and fall from 150 feet up, so stay out from under them!',
      'The pods are so hard that only agoutis, a kind of rainforest rodent, can gnaw them open.'),
    f('cacao', 'Cacao pod', 'common', 'powder', 'cacaopod', ['#f08c00', '#e8590c', '#ffd43b'],
      'Chocolate comes from the beans inside the cacao pod, which grows right on the trunk of the tree.',
      'The Maya and Aztecs drank chocolate, and the Aztecs even used cacao beans as money!'),
    f('kapokseed', 'Kapok fluff', 'uncommon', 'icy', 'fluff', ['#f8f9fa', '#dee2e6', '#8b5a2b'],
      'Giant kapok trees grow seed pods full of soft, fluffy fibers that carry the seeds away on the wind.',
      'Kapok fluff is so light and waterproof that it was once used to stuff life jackets.'),
    f('tagua', 'Tagua nut', 'uncommon', 'slushy', 'pebble', ['#f8f0e3', '#c9a97a', '#8d6e63'],
      'The tagua nut is the seed of a rainforest palm. When it dries, it gets as hard and white as ivory.',
      'People call it "vegetable ivory" and carve it into buttons and little animals, so no elephants are hurt.'),
    f('amber', 'Amber with a bug', 'rare', 'icy', 'amber', ['#f59f00', '#e67700', '#ffe066'],
      'Amber is tree sap that hardened over millions of years. Sometimes a bug got stuck in the sap first.',
      'Bugs in amber can be over 30 million years old and still look like they were trapped yesterday!'),
    f('emerald', 'Emerald', 'super', 'powder', 'crystal', ['#12b886', '#087f5b', '#96f2d7'],
      'Emeralds are deep green gems. Some of the finest emeralds in the world come from Colombia, in South America.',
      'Most emeralds have tiny flaws inside that jewelers call the "jardin", French for garden.'),
  ],
  'bg-fjord': [
    f('mooseantler', 'Moose antler', 'common', 'powder', 'antler', ['#e9d8b4', '#c9a97a', '#8d6e63'],
      'Bull moose grow huge flat antlers every summer and drop them in early winter.',
      'A big moose\'s antlers can be over 5 feet wide and weigh as much as a second grader!',
      { seasons: ['winter', 'spring'] }),
    f('jade', 'Alaska jade', 'common', 'slushy', 'pebble', ['#2f9e44', '#1b5e20', '#8ce99a'],
      'Jade is a tough green stone. Jade is Alaska\'s state gem, and a whole mountain of it stands in northern Alaska.',
      'Jade is so tough that it is hard to break even with a hammer, so people made it into tools long ago.'),
    f('garnet', 'Garnet', 'uncommon', 'icy', 'gem', ['#c92a2a', '#862e9c', '#ff8787'],
      'Garnets are dark red crystals with lots of flat faces. Wrangell, Alaska, is famous for them.',
      'At Wrangell, the garnet ledge belongs to the town\'s children: only kids are allowed to collect garnets there!'),
    f('goldnugget', 'Gold nugget', 'uncommon', 'icy', 'nugget', ['#ffd43b', '#f08c00', '#fff3bf'],
      'Gold drew thousands of people to Alaska in the 1890s, in the Klondike and Nome gold rushes.',
      'Gold is so soft you could dent a pure nugget with your teeth (but do not try it).'),
    f('agate', 'Agate', 'rare', 'slushy', 'agate', ['#ffa94d', '#e8590c', '#fff4e6'],
      'Agates are stones with stripes of color in rings. Glaciers and waves polish them on northern beaches.',
      'Each ring in an agate was a layer of silica that settled out of water, one at a time.'),
    f('mammoth', 'Woolly mammoth tooth', 'super', 'powder', 'molar', ['#c9a97a', '#8d6e63', '#e9d8b4'],
      'Woolly mammoths lived in Alaska until about 10,000 years ago. Their teeth turn up in frozen ground and rivers.',
      'A mammoth tooth is as big as a brick, with ridges for grinding grass. The woolly mammoth is Alaska\'s state fossil!'),
  ],
  'bg-space': [
    f('chondrite', 'Stony meteorite', 'common', 'slushy', 'meteorite', ['#6c757d', '#343a40', '#adb5bd'],
      'Most meteorites are stony ones called chondrites, full of tiny round grains.',
      'Chondrites are about 4.5 billion years old, older than any rock on Earth!'),
    f('ironmet', 'Iron meteorite', 'common', 'icy', 'meteorite', ['#868e96', '#495057', '#ced4da'],
      'Iron meteorites are chunks of metal from the middle of broken little planets, mostly iron and nickel.',
      'Cut and polished, an iron meteorite shows a criss-cross pattern of crystals found nowhere on Earth.'),
    f('orangeglass', 'Orange moon glass', 'uncommon', 'powder', 'beads', ['#ff922b', '#e8590c', '#ffd8a8'],
      'In 1972 the Apollo 17 astronauts found orange soil on the Moon. It was made of tiny glass beads.',
      'The beads came from fire fountains on Moon volcanoes about 3.6 billion years ago!'),
    f('anorthosite', 'Moon rock', 'uncommon', 'slushy', 'rock', ['#f1f3f5', '#ced4da', '#adb5bd'],
      'The bright parts of the Moon are made of a pale rock called anorthosite. It is some of the oldest rock on the Moon.',
      'Apollo 15 astronauts found a piece so old they called it the Genesis Rock. All the Apollo missions brought back 842 pounds of Moon rock!'),
    f('pallasite', 'Pallasite', 'rare', 'icy', 'pallasite', ['#adb5bd', '#94d82d', '#fab005'],
      'A pallasite is a meteorite of shiny metal full of see-through green-gold crystals.',
      'Pallasites are some of the rarest and most beautiful meteorites. They may come from the edge of a tiny planet\'s metal core.'),
    f('marsmet', 'Mars meteorite', 'super', 'powder', 'meteorite', ['#c2410c', '#7c2d12', '#ffa94d'],
      'A few meteorites came all the way from Mars, blasted off by impacts millions of years ago.',
      'Scientists know they are from Mars because the gas trapped inside matches the air rovers measured on Mars!'),
  ],
  'bg-rainbow': [
    f('fluorite', 'Fluorite', 'common', 'icy', 'cube', ['#9775fa', '#63e6be', '#e5dbff'],
      'Fluorite grows in cubes and comes in almost every color, often in rainbow stripes.',
      'Some fluorite glows under ultraviolet light. The word "fluorescent" was named after it!'),
    f('labradorite', 'Labradorite', 'common', 'slushy', 'pebble', ['#364fc7', '#20c997', '#495057'],
      'Labradorite looks gray until you tilt it, then it flashes blue, green and gold.',
      'The flash comes from thin layers inside the stone that bend light, like a soap bubble.'),
    f('rainbowobs', 'Rainbow obsidian', 'uncommon', 'powder', 'shard', ['#212529', '#cc5de8', '#51cf66'],
      'Rainbow obsidian is volcanic glass with tiny crystals inside that shine in rainbow bands.',
      'You only see the rainbow when light hits it from the right side. In the dark, it just looks black.'),
    f('bornite', 'Peacock ore', 'uncommon', 'icy', 'rock', ['#7048e8', '#22b8cf', '#e64980'],
      'Peacock ore is a copper mineral called bornite. Fresh, it is bronze, but it soon shines purple, blue and pink like a peacock.',
      'The colors come from a super thin coat that forms when the air touches it, like the rainbow on a soap bubble.'),
    f('opal', 'Opal', 'rare', 'slushy', 'opal', ['#e7f5ff', '#ff8cc6', '#63e6be'],
      'Opal is a gem that flashes every color. Most opals come from Australia.',
      'Opal is made of tiny balls of silica stacked like oranges at a store, and the gaps split light into colors.'),
    f('ammolite', 'Ammolite', 'super', 'powder', 'nautilus', ['#e8590c', '#40c057', '#4c6ef5'],
      'Ammolite is the shiny rainbow shell of ancient ammonites, found in Canada.',
      'It is one of the rarest gems on Earth, and it comes from sea animals that lived with the dinosaurs.'),
  ],
  'bg-galaxy': [
    f('pyrite', 'Pyrite', 'common', 'icy', 'cube', ['#fab005', '#e67700', '#fff3bf'],
      'Pyrite is a shiny gold-colored mineral that grows in cubes. People call it fool\'s gold.',
      'Pyrite crystals can grow in nearly perfect cubes all on their own, as if someone cut them.'),
    f('citrine', 'Citrine', 'common', 'slushy', 'crystal', ['#fcc419', '#f08c00', '#fff3bf'],
      'Citrine is a golden-yellow kind of quartz.',
      'Most citrine in shops is purple amethyst that was heated until it turned golden.'),
    f('tigerseye', 'Tiger\'s eye', 'uncommon', 'powder', 'pebble', ['#b8860b', '#6e4520', '#ffd43b'],
      'Tiger\'s eye is a golden-brown stone with silky stripes that shimmer when it moves.',
      'The shimmer comes from tiny fibers inside, lined up in the same direction.'),
    f('desertglass', 'Desert glass', 'uncommon', 'slushy', 'shard', ['#fff3bf', '#fcc419', '#fffbe6'],
      'Libyan desert glass is a pale yellow natural glass found in the Sahara. Scientists think a space rock blast melted the sand about 29 million years ago.',
      'A carved piece of it sits in the middle of a necklace buried with the Egyptian king Tutankhamun!'),
    f('pyritesun', 'Pyrite sun', 'rare', 'icy', 'sundisc', ['#fab005', '#e67700', '#fff3bf'],
      'A pyrite sun is a flat disc of pyrite with rays, found between layers of coal-mine rock in Illinois.',
      'Pyrite suns grew squashed flat between layers of slate, which is why they look like little golden suns.'),
    f('moldavite', 'Moldavite', 'super', 'powder', 'shard', ['#2b8a3e', '#1b5e20', '#69db7c'],
      'Moldavite is a green glass made when a big space rock hit Germany about 15 million years ago.',
      'The splash of melted rock flew all the way to what is now the Czech Republic, where it is found today.'),
  ],
};

export const FIND_MAPS = Object.keys(FINDS);
export const findId = (map, id) => `${String(map).replace(/^bg-/, '')}-${id}`;

/** Every find: { key, map, ...find }. key is the book id, like 'meadow-geode'. */
export const ALL_FINDS = FIND_MAPS.flatMap((map) => FINDS[map].map((x) => ({ ...x, key: findId(map, x.id), map })));
const BY_KEY = new Map(ALL_FINDS.map((x) => [x.key, x]));
export const findByKey = (key) => BY_KEY.get(key) || null;

/** The finds on a map's hill (a map with none uses the meadow's). */
export const findsFor = (map) => ALL_FINDS.filter((x) => x.map === (FINDS[map] ? map : 'bg-meadow'));

// Real sizes (inches, the longest way): [smallest, typical, biggest]. Each find gets a size
// like a fish's weight: small, typical or trophy (see sizeClass). A clump for the tiny beads.
export const SIZES = {
  'meadow-pinecone': [1.5, 3, 6], 'meadow-acorn': [0.6, 1, 1.5], 'meadow-quartz': [0.5, 1.5, 6], 'meadow-geode': [2, 4, 12], 'meadow-antler': [8, 15, 24], 'meadow-clover': [0.5, 1, 2],
  'castle-horseshoe': [4, 5, 6.5], 'castle-pottery': [1, 2.5, 6], 'castle-flint': [1, 3, 8], 'castle-key': [2, 4, 8], 'castle-penny': [0.6, 0.75, 0.9], 'castle-sapphire': [0.7, 0.8, 1],
  'sunset-scallop': [1, 2.5, 6], 'sunset-moonsnail': [1, 2, 4.5], 'sunset-seaglass': [0.3, 0.8, 2.5], 'sunset-sanddollar': [1.5, 3, 4], 'sunset-sharktooth': [0.3, 0.8, 2], 'sunset-junonia': [2.5, 3.5, 5],
  'ocean-urchin': [1, 2.5, 4], 'ocean-argonaut': [3, 6, 12], 'ocean-ammonite': [1, 3, 12], 'ocean-pearl': [0.15, 0.3, 0.6], 'ocean-megtooth': [3, 5, 7], 'ocean-doubloon': [1, 1.1, 1.3],
  'volcano-pumice': [1, 3, 10], 'volcano-scoria': [1, 2.5, 8], 'volcano-obsidian': [1, 3, 8], 'volcano-peridot': [0.1, 0.3, 1], 'volcano-peleshair': [1, 3, 8], 'volcano-lavabomb': [3, 8, 24],
  'rainforest-brazilnut': [4, 5, 6], 'rainforest-cacao': [6, 8, 12], 'rainforest-kapokseed': [1, 2, 4], 'rainforest-tagua': [1.5, 2, 2.5], 'rainforest-amber': [0.5, 1, 3], 'rainforest-emerald': [0.2, 0.5, 2],
  'fjord-mooseantler': [20, 40, 60], 'fjord-jade': [1, 3, 10], 'fjord-garnet': [0.2, 0.5, 1.5], 'fjord-goldnugget': [0.1, 0.4, 2], 'fjord-agate': [0.5, 1.5, 4], 'fjord-mammoth': [5, 8, 12],
  'space-chondrite': [1, 3, 10], 'space-ironmet': [1, 4, 12], 'space-orangeglass': [0.5, 1, 2], 'space-anorthosite': [1, 3, 8], 'space-pallasite': [1, 3, 10], 'space-marsmet': [0.5, 2, 6],
  'rainbow-fluorite': [0.5, 1.5, 5], 'rainbow-labradorite': [1, 2.5, 6], 'rainbow-rainbowobs': [1, 2, 5], 'rainbow-bornite': [1, 2, 5], 'rainbow-opal': [0.2, 0.6, 2], 'rainbow-ammolite': [1, 2, 6],
  'galaxy-pyrite': [0.3, 1, 3], 'galaxy-citrine': [0.5, 1.5, 4], 'galaxy-tigerseye': [0.5, 1.5, 3], 'galaxy-desertglass': [1, 2.5, 8], 'galaxy-pyritesun': [1, 3, 5], 'galaxy-moldavite': [0.4, 1, 3],
};
/** How big a find is, in inches, from a 0..1 random number: mostly near typical, about 1 in 10 a trophy. */
export function sizeFor(key, r) {
  const [lo, mid, hi] = SIZES[key] || [1, 2, 4];
  const v = r < 0.5 ? lo + (mid - lo) * (2 * r) ** 0.6 : mid + (hi - mid) * ((r - 0.5) * 2) ** 2.2;
  return Math.round(v * (v < 1 ? 100 : 10)) / (v < 1 ? 100 : 10);
}
/** 'small', 'typical' or 'trophy' for a find of this size. */
export function sizeClass(key, inches) {
  const [, mid, hi] = SIZES[key] || [1, 2, 4];
  if (inches >= mid + (hi - mid) * 0.6) return 'trophy';
  if (inches < mid * 0.8) return 'small';
  return 'typical';
}
export const SIZE_CLASSES = { small: { name: 'Small', icon: '🔹' }, typical: { name: 'Typical', icon: '🔸' }, trophy: { name: 'Trophy', icon: '🏆' } };
/** "3.5 in" (and fractions of an inch for the small ones). */
export const fmtSize = (inches) => `${inches} in`;

/** Rare and super rare finds are this much likelier with a regular, good and super sled. */
export const SLED_LUCK = [1, 1.25, 1.5];
/** In its season a seasonal find is this much likelier (it still turns up the rest of the year). */
export const IN_SEASON = 2;
/** The find of the day on each hill is this much likelier. */
export const OF_THE_DAY = 3;
/** After this many runs on a hill with no super rare, the next Big Jump holds one. */
export const PITY = 8;

/** The find of the day on a map: one of its common, uncommon or rare finds, the same for everyone all day. */
export function findOfDay(map, day) {
  const pool = findsFor(map).filter((x) => x.rarity !== 'super');
  let h = 7;
  for (const ch of `find:${day}:${map}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  h = (h * 1664525 + 1013904223) >>> 0;
  return pool[h % pool.length].key;
}

/**
 * How likely each find is right now: { key: weight }. The day's snow kind doubles the finds
 * that like it, a find in its season is 2x, the find of the day 3x, and a better sled (tier
 * 1-3) makes rare and super rare finds likelier. opts: { day, rareOnly: just rare and super }.
 */
export function findOdds(map, kind, season, tier = 1, opts = {}) {
  const out = {};
  const today = opts.day ? findOfDay(map, opts.day) : null;
  for (const x of findsFor(map)) {
    if (opts.rareOnly && x.rarity !== 'rare' && x.rarity !== 'super') continue;
    let w = RARITY[x.rarity].weight;
    if (x.likes === kind) w *= 2;
    if (x.seasons?.includes(season)) w *= IN_SEASON;
    if (x.key === today) w *= OF_THE_DAY;
    if (x.rarity === 'super' || x.rarity === 'rare') w *= SLED_LUCK[Math.max(1, Math.min(3, tier)) - 1];
    out[x.key] = w;
  }
  return out;
}

/** Pick a find key from odds with a 0..1 random number. */
export function pickFind(odds, r) {
  const total = Object.values(odds).reduce((a, b) => a + b, 0);
  let k = r * total;
  for (const [key, w] of Object.entries(odds)) { k -= w; if (k < 0) return key; }
  return Object.keys(odds)[0];
}

/**
 * A find's condition (1 rough, 2 fine, 3 perfect) is earned, like a fish's size: rough when
 * ridden over, fine when grabbed in the air or on a streak of 3 or more, perfect up on the high
 * line or from a green Big Jump landing.
 */
export function conditionFor({ air = false, streak = 0, high = false, perfect = false } = {}) {
  if (high || perfect) return 3;
  if (air || streak >= 3) return 2;
  return 1;
}

/** Points for a find in a condition. */
export const findPoints = (key, q) => Math.round(RARITY[findByKey(key)?.rarity || 'common'].points * CONDITIONS[q].mult);

/**
 * Add a find to the kid's records. Returns { records, isNew: first of its kind, better: a
 * better condition than before, bigger: bigger than the old biggest }. in: the biggest yet
 * (inches). The old object is not changed.
 */
export function recordFind(records = {}, { key, q, inches = 0, date }) {
  const old = records[key];
  const isNew = !old;
  const better = !isNew && q > (old.q || 0);
  const rec = { q: Math.max(q, old?.q || 0), n: (old?.n || 0) + 1, date: isNew || better ? date : old.date };
  const bigger = !isNew && inches > (old.in || 0);
  rec.in = Math.max(inches || 0, old?.in || 0);
  return { records: { ...records, [key]: rec }, isNew, better, bigger };
}

/** The finds book: one page per map, in order, with the kid's record on each find. */
export function findPages(records = {}) {
  return FIND_MAPS.map((map) => ({ map, finds: findsFor(map).map((x) => ({ ...x, record: records[x.key] || null })) }));
}
export const findCount = (records = {}) => ({ found: ALL_FINDS.filter((x) => records[x.key]).length, total: ALL_FINDS.length });
