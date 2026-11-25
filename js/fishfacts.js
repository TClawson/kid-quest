// Real fish facts for the fish book, and how much each fish weighs. Pure data and logic, no DOM.
//
// Taylor (2026-11-16): the fishing game should teach the kids about their fish. Every fish
// weighs what its real kind weighs, in pounds; the fish book says what's small, typical and a
// trophy for it, marks each catch, and has a few short paragraphs of true facts.
//
// How a catch gets its weight: the game gives each fish a hidden size (0 to 1, up to 1.6 for a
// trophy far out in deep water, see fishing.js maxSizeAt). That size still runs everything in the
// game (the bite, the fight, the points), so a swordfish isn't 500 times harder to land than a
// herring. weightFor turns it into pounds along the real fish's own range: a size of 0.4 is the
// typical weight, 0.15 is where small ends, 0.85 is where trophies start, and 1.6 is near the
// biggest ever caught. The game makes most fish typical, small ones near the shore and trophies
// rare and far out, about like real life (a regular rod lands a trophy about 1 time in 10).
//
// The fish on the Goo Crater, Lava Lake, Candy Pond and Star Lake maps are pretend. Each has a
// real cousin: it weighs what the cousin weighs, and its page teaches about the cousin.
//
// Sources: NOAA Fisheries species pages, FishBase, state wildlife agencies (Alaska ADF&G,
// Florida FWC, Minnesota DNR), the IGFA world records, Florida Museum, Georgia Aquarium.

/**
 * w: [smallest, small up to, typical, trophy from, near the biggest] in pounds.
 * biggest: the biggest ever caught on a rod (only where the record is well known).
 * where / eats / wow: a short paragraph each.
 */
export const REAL_FISH = {
  bluegill: {
    name: 'Bluegill', w: [0.06, 0.2, 0.4, 1, 4],
    biggest: '4 lb 12 oz, Alabama, 1950',
    where: 'Bluegills live in calm, warm lakes and ponds all over North America. They like shallow water near weeds, docks and fallen trees, where they can hide from bigger fish. They swim in groups called schools.',
    eats: 'Bugs! Bluegills eat insects, insect larvae, tiny shrimp-like animals, snails and fish eggs. They suck food in with a quick pop of their small mouths.',
    wow: 'In spring, the males sweep out round nests in the sand with their tails, side by side like a honeycomb. A dad bluegill guards the eggs and the babies, and chases away fish much bigger than himself.',
  },
  smallmouth: {
    name: 'Smallmouth bass', w: [0.3, 0.75, 1.5, 4, 10],
    biggest: '11 lb 15 oz, Dale Hollow Lake, Tennessee and Kentucky, 1955',
    where: 'Smallmouth bass like clear, cool water with rocks: rocky lakes, rivers and streams across much of North America. They hang around boulders and gravel where crayfish hide.',
    eats: 'Crayfish are their favorite food. They also eat small fish, insects and frogs.',
    wow: 'Anglers say a smallmouth fights harder for its size than almost any other fish. When it is hooked, it often jumps right out of the water and shakes its head. Their eyes can be bright red.',
  },
  largemouth: {
    name: 'Largemouth bass', w: [0.4, 1, 2.5, 8, 20],
    biggest: '22 lb 4 oz, Georgia, 1932 (tied in Japan, 2009)',
    where: 'Largemouth bass live in warm lakes, ponds and slow rivers all over the United States. They wait in weeds, lily pads and sunken logs to ambush prey.',
    eats: 'Almost anything that fits in their huge mouths: fish, crayfish, frogs, even mice, snakes and baby ducks.',
    wow: 'A largemouth can open its mouth so wide that it swallows prey nearly half as long as its own body. It is the most popular fish to catch in America, and the state fish of four states. The world record has stood since 1932!',
  },
  pike: {
    name: 'Northern pike', w: [0.8, 2, 5, 15, 45],
    biggest: '55 lb 1 oz, Germany, 1986',
    where: 'Northern pike live in cool lakes and rivers all around the top of the world: Canada, the northern United States, Europe and Asia. They hide in weeds, perfectly still, waiting.',
    eats: 'Mostly other fish, including smaller pike! They also grab frogs, mice and ducklings from the surface.',
    wow: 'A pike can shoot forward from a standstill faster than you can blink. Its mouth has hundreds of sharp teeth that point backward, so slippery prey can only go one way: down. People in England have called pike "water wolves".',
  },
  channelcat: {
    name: 'Channel catfish', w: [0.5, 1, 3, 15, 50],
    biggest: '58 lb, Santee-Cooper Reservoir, South Carolina, 1964',
    where: 'Channel catfish live in rivers, lakes and ponds across most of North America. They rest near the bottom by logs, rocks and holes in the bank, and come out to feed at night.',
    eats: 'Nearly anything: insects, snails, crayfish, small fish, seeds and plants, even dead things on the bottom. They are the cleanup crew of the lake.',
    wow: 'A catfish is like a swimming tongue! It has taste buds all over its skin, from its whiskers to its tail. That means it can taste food in muddy water in the dark, without seeing it at all.',
  },
  goldentrout: {
    name: 'Golden trout', w: [0.1, 0.25, 0.6, 2, 9],
    biggest: '11 lb, Cooks Lake, Wyoming, 1948',
    where: 'Golden trout first lived only in a few cold streams high in California\'s Sierra Nevada mountains, more than 2 miles above the sea. People carried them to high mountain lakes in other western states.',
    eats: 'Mostly insects: ants, beetles and the larvae of flies that live in mountain streams. The summer up there is short, so they eat a lot while they can.',
    wow: 'It is California\'s state fish. Because the high-mountain summer is so short, golden trout grow very slowly. A 6 year old golden trout may still be shorter than a pencil.',
  },
  roach: {
    name: 'Roach', w: [0.05, 0.15, 0.4, 1.5, 4],
    where: 'Roach live in lakes, slow rivers and canals all over Europe and into Asia. They swim in big schools and can live in water too murky for many other fish.',
    eats: 'Insect larvae, snails, tiny water animals and water plants.',
    wow: 'Roach are one of the most common fish in Europe and one of the first fish many kids there ever catch. You can tell a roach by its bright red eyes. Herons, otters and pike all love to eat them.',
  },
  perch: {
    name: 'European perch', w: [0.08, 0.25, 0.6, 2, 5],
    where: 'Perch live in lakes and rivers across Europe and northern Asia. Young perch swim in schools near weeds. Big ones are loners that hunt in deeper water.',
    eats: 'Young perch eat tiny water animals and insects. Bigger ones eat other fish, including small perch.',
    wow: 'Perch have a sharp, spiky fin on their backs that they raise when they are scared. The stripes on their sides work like camouflage, blending in with the stems of water weeds.',
  },
  tench: {
    name: 'Tench', w: [0.3, 1, 3, 7, 14],
    where: 'Tench live in still, weedy, muddy water in Europe and Asia: lakes, ponds and old moats. They stay near the bottom.',
    eats: 'Snails, worms, insect larvae and other small animals they dig out of the mud.',
    wow: 'Tench can live in water with very little oxygen that would kill most fish, and they can sleep through the winter buried in mud. Long ago people called it the "doctor fish" because they believed its slime could heal other fish. It can\'t, but the name stuck.',
  },
  eel: {
    name: 'European eel', w: [0.2, 0.5, 1.5, 4, 10],
    where: 'European eels grow up in rivers, lakes and even moats all over Europe. But they are all born in one faraway place: the Sargasso Sea, in the middle of the Atlantic Ocean.',
    eats: 'Worms, insects, snails, crabs and small fish. They hunt mostly at night.',
    wow: 'Baby eels drift across the Atlantic, thousands of miles, to reach Europe. Many years later the grown-ups swim all the way back to the Sargasso Sea to lay their eggs. Eels can even wriggle across wet grass to reach a new pond. Sadly, they are now critically endangered.',
  },
  carp: {
    name: 'Common carp (and koi)', w: [1, 3, 10, 25, 80],
    where: 'Carp first came from Europe and Asia and now live in lakes and slow rivers almost everywhere. Koi are carp that people in Japan bred for bright colors, like red, gold and white, to keep in garden ponds.',
    eats: 'Carp root around in the mud for insect larvae, snails, worms, seeds and plants. They stir up so much mud that the water gets cloudy.',
    wow: 'Carp can grow very big and live a very long time. Pet koi often live 25 to 35 years, and some much longer. People have kept carp in ponds for over 2,000 years, so a royal carp in a castle moat is just right.',
  },
  sergeantmajor: {
    name: 'Sergeant major', w: [0.03, 0.1, 0.3, 0.6, 1],
    where: 'Sergeant majors live on coral reefs and rocky shores in warm parts of the Atlantic Ocean, including the Caribbean and Florida. They swim in groups in shallow water.',
    eats: 'Tiny floating animals called plankton, algae, and small shrimp and crabs.',
    wow: 'They are named for their black stripes, which look like the stripes on an army sergeant\'s sleeve. When a dad guards his patch of purple eggs, he turns dark blue, and chases away fish (and divers!) much bigger than he is.',
  },
  snapper: {
    name: 'Red snapper', w: [0.5, 2, 6, 15, 45],
    where: 'Red snapper live in the warm Gulf of Mexico and along the Atlantic coast of the southern United States. They like the bottom near reefs, rocks, shipwrecks and oil rigs.',
    eats: 'Fish, shrimp, crabs, squid and worms.',
    wow: 'Red snapper can live for more than 50 years. Their name comes from the way they snap their jaws, and they have sharp teeth to match.',
  },
  bonefish: {
    name: 'Bonefish', w: [0.5, 2, 4, 10, 15],
    where: 'Bonefish live on shallow, sandy flats in warm seas, like the Bahamas and the Florida Keys. They come into water so shallow that their tails stick up into the air while they dig for food.',
    eats: 'Crabs, shrimp, clams and worms that they root out of the sand with their noses.',
    wow: 'Anglers call them "gray ghosts" because their silver sides reflect the water and make them almost invisible. When hooked, a bonefish races off so fast it can pull out 100 yards of fishing line in seconds. It is named for being very bony inside.',
  },
  barracuda: {
    name: 'Great barracuda', w: [1, 3, 10, 30, 80],
    biggest: '85 lb, Christmas Island, 1992',
    where: 'Great barracudas live in warm oceans all around the world, from coral reefs to open water. Young ones hide among mangrove roots and sea grass.',
    eats: 'Fish! They hunt by sight and pick out anything shiny or flashing.',
    wow: 'A barracuda can burst forward at about 35 miles an hour. It has two rows of fang-like teeth, and it often swims right up close to divers out of curiosity. It looks scary, but it almost never bothers people.',
  },
  grouper: {
    name: 'Goliath grouper', w: [5, 30, 150, 400, 650],
    biggest: '680 lb, Fernandina Beach, Florida, 1961',
    where: 'Goliath groupers live in warm Atlantic water, from Florida and the Gulf of Mexico to Brazil. Young ones grow up in mangrove lagoons for about five years before moving out to reefs and shipwrecks.',
    eats: 'Crabs, lobsters, fish, octopus, and sometimes small sea turtles. They swallow their food whole.',
    wow: 'A goliath grouper can grow longer than a grown-up is tall and weigh as much as a small piano. It opens its giant mouth so fast that it sucks prey right in. It even makes a deep booming sound with its body to warn other fish away. In the U.S. they are protected, so any caught must be let go.',
  },
  puffer: {
    name: 'Pufferfish', w: [0.1, 0.3, 1, 3, 10],
    where: 'There are more than 100 kinds of pufferfish. Most live in warm oceans, around reefs, lagoons and sea grass. A few live in fresh water.',
    eats: 'Snails, clams, crabs, sea urchins and coral. Their teeth grow together into a beak strong enough to crack shells.',
    wow: 'When a pufferfish is scared, it gulps water fast and blows up into a ball two or three times its size, too big and prickly to swallow. Most kinds are also poisonous. Their beak never stops growing, so they have to keep crunching hard food to wear it down.',
  },
  bluetang: {
    name: 'Regal blue tang', w: [0.05, 0.2, 0.5, 1, 1.5],
    where: 'Regal blue tangs live on coral reefs in the warm Indian and Pacific Oceans. They swim in open water above the reef and dart into cracks in the coral when danger comes.',
    eats: 'Mostly plankton, plus some algae nibbled off the reef.',
    wow: 'Dory from the movies is a regal blue tang! Tangs are a kind of surgeonfish: each one has a razor-sharp spine near its tail, like a doctor\'s scalpel. When scared, a tang may wedge into the coral and lie on its side as if it were dead.',
  },
  parrotfish: {
    name: 'Parrotfish', w: [0.3, 1, 3, 10, 40],
    where: 'Parrotfish live on coral reefs in warm oceans around the world. There are about 90 kinds, many of them painted in bright greens, blues and pinks.',
    eats: 'Algae that grows on coral and rocks. Their teeth are fused into a beak like a parrot\'s, which they use to scrape and chomp the reef.',
    wow: 'Parrotfish grind up the coral they bite and poop it out as fine white sand. One big parrotfish can make hundreds of pounds of sand a year, so a lot of the white sand on tropical beaches came out of a parrotfish! At night, some sleep inside a bubble of slime they blow around themselves.',
  },
  angelfish: {
    name: 'Queen angelfish', w: [0.1, 0.4, 1.5, 3, 4],
    where: 'Queen angelfish live on coral reefs in the warm western Atlantic, from Florida and the Bahamas through the Caribbean to Brazil.',
    eats: 'Mostly sponges! They also nibble algae, jellyfish and coral.',
    wow: 'A queen angelfish has a blue spot on its forehead with tiny bright dots around it, like a crown. Young queen angelfish set up "cleaning stations" where they pick the pests off bigger fish.',
  },
  moray: {
    name: 'Green moray eel', w: [2, 6, 15, 35, 60],
    where: 'Green morays live in the warm Atlantic, in coral reefs, rocks and mangroves from Florida and the Caribbean to Brazil. They spend the day hiding in holes with just their heads poking out.',
    eats: 'Fish, octopus, shrimp and crabs. They hunt at night by smell.',
    wow: 'A green moray isn\'t really green! Its skin is dark brown, and it is covered in a coat of yellow slime that protects it from parasites. Brown under yellow looks green. Morays also have a second set of jaws in their throats that shoots forward to grab food and pull it down. Opening and closing the mouth is how they breathe.',
  },
  nurseshark: {
    name: 'Nurse shark', w: [10, 40, 150, 250, 330],
    where: 'Nurse sharks live in warm, shallow Atlantic and eastern Pacific water, around reefs, rocks and mangroves. In the daytime they often rest in piles on the sea floor or in caves.',
    eats: 'Lobsters, crabs, shrimp, octopus, sea urchins and small fish. They find food with the two whisker-like barbels on their noses.',
    wow: 'A nurse shark sucks its food in like a vacuum cleaner, with a slurping sound that may have given it its name. Unlike many sharks, it can rest on the bottom without swimming, because it pumps water over its gills. Nurse sharks are slow and calm, but they have a strong bite, so always leave them alone.',
  },
  swordfish: {
    name: 'Swordfish', w: [20, 50, 120, 400, 1100],
    biggest: '1,182 lb, Chile, 1953',
    where: 'Swordfish roam the open oceans of the whole world, from warm tropical seas to cooler water. In the daytime they dive deep, more than 1,000 feet down into the cold and dark, and come up at night.',
    eats: 'Squid and fish, like mackerel and herring.',
    wow: 'A swordfish has a special heater beside its eyes that keeps its eyes and brain warm, so it can see well even in icy deep water. It uses its sword to slash at prey, not to stab it. Grown-up swordfish have no scales and no teeth at all.',
  },
  piranha: {
    name: 'Red-bellied piranha', w: [0.1, 0.4, 1, 2.5, 7],
    where: 'Red-bellied piranhas live in rivers, lakes and flooded forests of South America, including the Amazon. They swim in groups called shoals.',
    eats: 'Insects, worms, small fish, fruit and seeds, and dead animals. They are more scavengers than hunters.',
    wow: 'Piranhas have a scary name, but they mostly swim in groups to keep from being eaten themselves, by river dolphins, caimans and big birds. They talk to each other with barking and drumming sounds. When a piranha loses teeth, it grows a whole new row on one side of its jaw at once.',
  },
  pacu: {
    name: 'Tambaqui (pacu)', w: [1, 4, 12, 30, 60],
    where: 'Tambaqui live in the Amazon and Orinoco rivers of South America. When the rivers flood every year, they swim right into the drowned forest.',
    eats: 'Fruits, nuts and seeds that drop from the trees into the water, plus insects and plankton.',
    wow: 'Pacu are close cousins of piranhas, but they have flat, square teeth a lot like your back teeth (molars)! They crack open hard nuts and seeds. The seeds they swallow come out in their poop far away, so they help plant new trees in the forest.',
  },
  oscar: {
    name: 'Oscar', w: [0.2, 0.6, 1.5, 2.5, 3.5],
    where: 'Oscars live in slow rivers, lakes and flooded forests of the Amazon in South America. Many people also keep them as pets in big aquariums.',
    eats: 'Small fish, insects, crayfish, worms, and sometimes fruit.',
    wow: 'Oscars have a black spot ringed in orange near their tails that looks like a big eye. It may trick a hungry fish into biting the wrong end. Pet oscars learn to know their owners and beg for food at the glass, so people call them "water puppies".',
  },
  payara: {
    name: 'Payara (vampire fish)', w: [0.5, 1.5, 4, 12, 30],
    where: 'Payara live in fast, rocky parts of rivers in the Amazon and Orinoco basins of South America. They wait near rapids for prey to be swept past.',
    eats: 'Other fish, including piranhas! They hunt by speeding out to grab fish passing in the current.',
    wow: 'A payara has two giant fangs that stick up from its bottom jaw. They are so long that when it closes its mouth, they slide into sockets in its upper jaw. It uses them to stab fish before swallowing them.',
  },
  redtail: {
    name: 'Redtail catfish', w: [3, 10, 25, 70, 140],
    biggest: '123 lb 7 oz, Brazil, 2010',
    where: 'Redtail catfish live in big rivers in the Amazon and Orinoco basins of South America. They stay near the bottom of deep channels and in flooded forest.',
    eats: 'Fish, crabs, fruit and seeds that fall in the water, and dead animals on the bottom.',
    wow: 'Redtails are easy to spot: a dark back, a white stripe along the side, and a bright red-orange tail. Pet stores sometimes sell baby redtails, but they grow longer than a grown-up is tall, way too big for a home aquarium. Public aquariums get asked to take so many that they often have to say no.',
  },
  peacockbass: {
    name: 'Speckled peacock bass', w: [0.5, 2, 5, 15, 27],
    where: 'Peacock bass live in warm rivers and lakes of the Amazon and Orinoco basins in South America. A smaller kind was brought to south Florida, where they live in canals.',
    eats: 'Other fish. They are fierce hunters that chase prey through the water.',
    wow: 'A peacock bass has a spot on its tail ringed in gold, like the eyes on a peacock\'s feathers. Both parents guard their babies together, and a peacock bass hits a lure so hard that anglers say it is like being hit by a train. It is not really a bass at all: it is a cichlid, a cousin of the oscar.',
  },
  herring: {
    name: 'Pacific herring', w: [0.05, 0.12, 0.25, 0.5, 1],
    where: 'Pacific herring live in the cold north Pacific Ocean, from California to Alaska and across to Japan. They swim in giant schools that can hold millions of fish.',
    eats: 'Plankton: tiny shrimp-like animals and fish eggs drifting in the water.',
    wow: 'Scientists found that herring make little ticking sounds by letting bubbles out of their bottoms! They may use the sound to keep their school together in the dark. In spring, herring lay so many sticky eggs on kelp and eelgrass that the sea along the shore turns milky white. Whales, seals, eagles and salmon all feast on them.',
  },
  dollyvarden: {
    name: 'Dolly Varden', w: [0.2, 0.6, 1.5, 5, 20],
    where: 'Dolly Varden live in cold, clear streams, lakes and coastal waters of Alaska and the north Pacific. Some live their whole lives in streams. Others go out to sea and come back.',
    eats: 'Insects, small fish, and salmon eggs. They follow the salmon upstream to eat the eggs that drift loose.',
    wow: 'Dolly Varden are named after a character in a Charles Dickens book who wore a dress with bright pink spots. The fish has pink and red spots on its sides, just like her dress. It is a char, a close cousin of trout.',
  },
  sockeye: {
    name: 'Sockeye salmon', w: [2, 4, 6, 10, 15],
    biggest: '15 lb 3 oz, Kenai River, Alaska, 1987',
    where: 'Sockeye salmon hatch in rivers and lakes in Alaska and the north Pacific, spend a few years in the ocean, then swim all the way back to the very stream where they were born. Bristol Bay in Alaska has the biggest sockeye run in the world.',
    eats: 'Plankton, tiny shrimp-like animals. They strain food from the water with combs on their gills.',
    wow: 'Sockeye find their way home by smell! When they head upstream to lay eggs, their silver bodies turn bright red and their heads turn green. They lay their eggs and then die, and their bodies feed bears, eagles, and even the trees by the river.',
  },
  lingcod: {
    name: 'Lingcod', w: [2, 6, 12, 30, 75],
    where: 'Lingcod live along the rocky Pacific coast, from Baja California to Alaska. They sit on the bottom among rocks and kelp, waiting for prey.',
    eats: 'Fish, squid, octopus and crabs. Big lingcod even eat smaller lingcod.',
    wow: 'A lingcod is not a real cod at all: it\'s a greenling. Some lingcod have meat that is bright blue-green, which turns white when it\'s cooked. The dads guard their eggs for weeks, fighting off anything that comes near.',
  },
  halibut: {
    name: 'Pacific halibut', w: [5, 15, 30, 100, 450],
    biggest: '459 lb, Dutch Harbor, Alaska, 1996',
    where: 'Pacific halibut live on the sea floor in the cold north Pacific, from California to Alaska and Japan. They lie flat on the bottom with their dark side up so they blend in.',
    eats: 'Fish, crabs, octopus and clams. They surprise prey from where they lie on the sand.',
    wow: 'A baby halibut swims upright like other fish, with an eye on each side. As it grows, its left eye slowly moves across the top of its head to the right side! Then it lies flat for the rest of its life. Big halibut are called "barn doors" and can be longer than a grown-up is tall. The really big ones are almost all females.',
  },
  kingsalmon: {
    name: 'King salmon (Chinook)', w: [5, 12, 20, 40, 95],
    biggest: '97 lb 4 oz, Kenai River, Alaska, 1985',
    where: 'King salmon are born in rivers around the north Pacific, from California to Alaska and Russia. They live in the ocean for several years, then swim back up their home river to lay eggs.',
    eats: 'In the ocean they eat herring, squid and other fish. Babies in the river eat insects.',
    wow: 'Kings are the biggest salmon in the world, and Alaska\'s state fish. Some kings in Alaska\'s Yukon River swim almost 2,000 miles upstream, farther than from Alaska to California, without eating along the way.',
  },
  opah: {
    name: 'Opah (moonfish)', w: [20, 40, 100, 150, 220],
    where: 'Opah live in the open ocean all around the world, in cool water hundreds of feet down. They are round and flat like a big dinner plate.',
    eats: 'Squid and small fish of the deep water.',
    wow: 'In 2015 scientists found that the opah is the first fish known to be warm-blooded through its whole body, like we are. Flapping its red fins all the time makes heat, and fatty tissue keeps it in. Being warm keeps its brain quick in cold, deep water.',
  },
  midshipman: {
    name: 'Plainfin midshipman', w: [0.03, 0.08, 0.2, 0.5, 1],
    where: 'Plainfin midshipman live along the Pacific coast of North America, from Alaska to Mexico. They spend the day buried in sand and mud, and come out at night.',
    eats: 'Shrimp, crabs, worms and little fish, snapped up in the dark.',
    wow: 'A midshipman has rows of tiny lights along its belly, like the shiny buttons on a sailor\'s coat, which is how it got its name. On summer nights the dads hum to call the moms, a buzzing drone so loud that people on houseboats in California once thought it was a machine, or even aliens!',
  },
  unicornfish: {
    name: 'Bluespine unicornfish', w: [0.3, 1, 3, 6, 10],
    where: 'Unicornfish live on coral reefs in the warm Indian and Pacific Oceans, from Africa to Hawaii.',
    eats: 'Seaweed and algae that grow on the reef.',
    wow: 'Grown-up unicornfish grow a horn on their foreheads, just like a unicorn! Nobody is sure what the horn is for. Like their cousins the tangs, they have sharp blades beside their tails, blue ones on this kind.',
  },
};

/** Each real kind of fish: [species id, its REAL_FISH key]. */
const REAL_OF = {
  'meadow-bluegill': 'bluegill', 'meadow-smallmouth': 'smallmouth', 'meadow-largemouth': 'largemouth', 'meadow-pike': 'pike', 'meadow-catfish': 'channelcat', 'meadow-trout': 'goldentrout',
  'castle-bluegill': 'roach', 'castle-smallmouth': 'perch', 'castle-largemouth': 'tench', 'castle-pike': 'pike', 'castle-catfish': 'eel', 'castle-crown': 'carp',
  'sunset-bluegill': 'sergeantmajor', 'sunset-smallmouth': 'snapper', 'sunset-largemouth': 'bonefish', 'sunset-pike': 'barracuda', 'sunset-catfish': 'grouper', 'sunset-puffer': 'puffer',
  'ocean-bluegill': 'bluetang', 'ocean-smallmouth': 'parrotfish', 'ocean-largemouth': 'angelfish', 'ocean-pike': 'moray', 'ocean-catfish': 'nurseshark', 'ocean-sword': 'swordfish',
  'rainforest-bluegill': 'piranha', 'rainforest-smallmouth': 'pacu', 'rainforest-largemouth': 'oscar', 'rainforest-pike': 'payara', 'rainforest-catfish': 'redtail', 'rainforest-peacock': 'peacockbass',
  'fjord-bluegill': 'herring', 'fjord-smallmouth': 'dollyvarden', 'fjord-largemouth': 'sockeye', 'fjord-pike': 'lingcod', 'fjord-catfish': 'halibut', 'fjord-king': 'kingsalmon',
};
/** The pretend maps' fish take after a real cousin: the same kind of fish at Forest Lake, but for these. */
const COUSIN_OF = {
  'space-moon': 'opah', 'rainbow-unicorn': 'unicornfish',
  // the December fish (fishing.js HOLIDAY_FISH) are all pretend, each with a real cousin
  'meadow-globe': 'bluegill', 'sunset-cane': 'moray', 'ocean-present': 'puffer', 'space-lights': 'midshipman', 'castle-jester': 'pike',
  'volcano-cocoa': 'carp', 'rainforest-poinsettia': 'piranha', 'fjord-aurora': 'dollyvarden', 'rainbow-mint': 'puffer', 'galaxy-tree': 'angelfish',
};

/**
 * A December fish's own pretend fact, for its page in the fish book (its real cousin's facts
 * come after it).
 */
export const DECEMBER_FACTS = {
  'meadow-globe': 'Shake the lake and it snows inside it! Forest Lake ice fishers say a snow-globe fish only comes up when it hears sleigh bells, so ring yours on the way to the water.',
  'sunset-cane': 'Candy-cane eels hang by their crooks from the lagoon\'s mangrove roots to nap. They taste like peppermint, so even the barracudas leave them alone.',
  'ocean-present': 'Nobody knows what is inside a present boxfish. Every December it swims round the reef with its bow on, and the clownfish all try to guess.',
  'space-lights': 'Its lights blink on one bulb at a time when it is happy. On the moon, a whole crater of them twinkling is how you know it is nearly Christmas.',
  'castle-jester': 'The jester pike jingles when it swims, so the moat\'s fish always hear it coming. It does a somersault when it is caught, just to make the king laugh.',
  'volcano-cocoa': 'Lava Lake keeps it just the right warmth: not too hot, not too cold. Its marshmallows never melt, and it shares them with the ember minnows.',
  'rainforest-poinsettia': 'Its flower opens a little more each day of December and is all the way open on Christmas morning. It has piranha teeth, but it only nibbles fruit in December.',
  'fjord-aurora': 'On the longest nights its stripes glow just like the northern lights above the fjord. Eagles swoop down to look, thinking the sky fell into the water.',
  'rainbow-mint': 'When it puffs up, Candy Pond smells like peppermint for a whole day. Its tail is the twist of its own wrapper.',
  'galaxy-tree': 'It decorates itself! Every year it picks up a new bauble from the stars at Star Lake, and its star topper shines brightest on Christmas Eve.',
};
const ROLE_COUSIN = { bluegill: 'bluegill', smallmouth: 'smallmouth', largemouth: 'largemouth', pike: 'pike', catfish: 'channelcat' };
/** What the pretend maps' rare fish swim like (fishing.js SPOTS special.as), for their cousins. */
const RARE_ROLE = { 'volcano-dragon': 'pike', 'galaxy-comet': 'pike' };

/**
 * The real fish behind a species id: { key, ...REAL_FISH[key], pretend }. pretend: true for a
 * made-up fish (its facts and weights are its real cousin's). null for an unknown id.
 */
export function realFish(id) {
  const s = String(id || '');
  let key = REAL_OF[s];
  let pretend = false;
  if (!key) {
    const role = s.slice(s.indexOf('-') + 1);
    key = COUSIN_OF[s] || ROLE_COUSIN[role] || ROLE_COUSIN[RARE_ROLE[s]];
    pretend = true;
  }
  return key && REAL_FISH[key] ? { key, ...REAL_FISH[key], pretend, ...(DECEMBER_FACTS[s] ? { december: DECEMBER_FACTS[s] } : {}) } : null;
}

// where on the hidden size (0 to 1.6) each of a fish's five weights falls
const AT = [0, 0.15, 0.4, 0.85, 1.6];

/** A fish's weight in pounds from its size in the game (0-1, up to 1.6 out deep): along its real range. */
export function weightFor(id, size) {
  const w = realFish(id)?.w;
  if (!w) return 0;
  const s = Math.max(0, Math.min(AT[4], Number(size) || 0));
  let i = 0;
  while (i < 3 && s > AT[i + 1]) i += 1;
  const k = (s - AT[i]) / (AT[i + 1] - AT[i]);
  // weights grow like a curve, so step between them evenly on a log scale
  const lb = Math.exp(Math.log(w[i]) + (Math.log(w[i + 1]) - Math.log(w[i])) * k);
  return roundLb(lb);
}

/** Pounds kept to a sensible precision: hundredths under 10 lb, tenths above. */
export const roundLb = (lb) => (lb < 10 ? Math.round(lb * 100) / 100 : Math.round(lb * 10) / 10);

/** small, typical or trophy, for a fish of this species weighing lb. */
export function sizeClass(id, lb) {
  const w = realFish(id)?.w;
  if (!w || !(lb > 0)) return null;
  if (lb < w[1]) return 'small';
  if (lb >= w[3]) return 'trophy';
  return 'typical';
}

/** Each size class's badge. */
export const CLASSES = {
  small: { icon: '🐟', name: 'Small', color: '#4dabf7' },
  typical: { icon: '👍', name: 'Typical', color: '#40c057' },
  trophy: { icon: '🏆', name: 'Trophy', color: '#f59f00' },
};

/** A weight as a kid reads it: ounces under a pound, 2.4 lb under 10, 35 lb above, 1,100 lb. */
export function fmtWeight(lb) {
  const n = Number(lb) || 0;
  if (n < 1) return `${Math.max(1, Math.round(n * 16))} oz`;
  if (n < 10) return `${Math.round(n * 10) / 10} lb`;
  return `${Math.round(n).toLocaleString('en-US')} lb`;
}

/**
 * A species' weight ranges as the book shows them: { small, typical, trophy, typicalFrom,
 * typicalTo } as formatted weights (small: under it; trophy: it or more), or null.
 */
export function weightRanges(id) {
  const w = realFish(id)?.w;
  if (!w) return null;
  return { small: fmtWeight(w[1]), typical: fmtWeight(w[2]), trophy: fmtWeight(w[3]), w };
}
