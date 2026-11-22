// Fans: map critters that come to watch the visitor ball games (keepy-uppy, hockey, football).
// Taylor chose this on 2026-11-22 (Fable's pick over a rare map ball): each map has three
// critters, common, uncommon and rare. Once or twice a game one walks up to the edge of the
// field and sits down to watch. Do something great while it watches (a Perfect kick, a goal,
// a catch) and it cheers and becomes your fan: it goes on that map's page of the fans book
// (in the buddy's house, beside the fish book) with a count of the times it cheered, and a
// short page of real facts. Pretend maps have pretend critters with a real cousin, like the
// fish book. No coins: just the collection.
//
// Pure data and logic (no DOM); FanWatch is the little visitor the games add to their fields.
import { critterPic } from './critterart.js';

export const FAN_RARITY = {
  common: { name: 'Common', odds: 60 },
  uncommon: { name: 'Uncommon', odds: 30 },
  rare: { name: 'Rare', odds: 10 },
};
/** Games on a map without its rare fan before the rare one is sure to come. */
export const FAN_PITY = 7;
/** How long a fan stays to watch (seconds), when the first one comes, and the wait for a second. */
export const FAN_STAY = 14;
export const FAN_FIRST = [6, 14];
export const FAN_AGAIN = [16, 26];

const fan = (id, map, rarity, name, look, fact, cousin) => ({ id, map, rarity, name, look, fact, cousin });

// look: a critterart.js look (len in pixels: the games draw them 1:1). fact: true facts.
export const FANS = [
  // Forest Village: North American woods
  fan('fan-squirrel', 'bg-meadow', 'common', 'Gray squirrel', { plan: 'small', len: 16, fur: '#868e96', belly: '#f1f3f5', tail: 'bushy', tailUp: true, sits: true, ears: 'round' },
    'Gray squirrels bury thousands of nuts each fall and find many of them again using memory and smell. The ones they forget can grow into new oak trees!'),
  fan('fan-raccoon', 'bg-meadow', 'uncommon', 'Raccoon', { plan: 'small', len: 18, fur: '#868e96', belly: '#f1f3f5', dark: '#212529', tail: 'ring', mark: 'mask', brow: true, bodyH: 0.26, headR: 0.24, ears: 'round' },
    'A raccoon\'s front paws are so sensitive that it can tell what something is just by feeling it. Wet paws feel even better, which is why raccoons seem to wash their food.'),
  fan('fan-owl', 'bg-meadow', 'rare', 'Great horned owl', { plan: 'big-bird', len: 18, fur: '#8a6a4a', belly: '#d8c8a8', owl: true, eye: '#fcc419', mark: 'spots', dark: '#3b2a20', beak: '#343a40', ears: 'tuft' },
    'A great horned owl can turn its head about three quarters of the way around, because its eyes can\'t move in their sockets. Its "horns" are just tufts of feathers.'),
  // Sunset Beach
  fan('fan-ghostcrab', 'bg-sunset', 'common', 'Ghost crab', { plan: 'crab', len: 14, fur: '#e9d8b4' },
    'Ghost crabs are sand colored, so they seem to vanish on the beach. They are some of the fastest crabs: they can scuttle sideways at about 10 miles an hour.'),
  fan('fan-pelican', 'bg-sunset', 'uncommon', 'Brown pelican', { plan: 'bird', len: 20, fur: '#7a6a5a', belly: '#adb5bd', beak: '#e9b96e', bill: 0.6, bigBill: true, face: '#f8f9fa', dark: '#343a40' },
    'Brown pelicans dive headfirst from high in the air to catch fish. The pouch under the beak can hold about three gallons of water, more than the pelican\'s stomach.'),
  fan('fan-dolphin', 'bg-sunset', 'rare', 'Bottlenose dolphin', { plan: 'swim', swim: 'leap', len: 26, fur: '#748ca8', belly: '#dee2e6', dark: '#495057' },
    'Every bottlenose dolphin has its own signature whistle, a bit like a name. Dolphins call each other by copying a friend\'s whistle.'),
  // Under the Sea
  fan('fan-hermit', 'bg-ocean', 'common', 'Hermit crab', { plan: 'crab', len: 14, fur: '#ff8787', mark: 'shell', shellCol: '#ffe8cc' },
    'Hermit crabs live in old snail shells. When one grows too big for its shell, crabs line up from biggest to smallest and swap shells one after another!'),
  fan('fan-nudibranch', 'bg-ocean', 'uncommon', 'Sea slug', { plan: 'snail', len: 16, fur: '#da77f2', accent: '#ffd43b', mark: 'spots', shell: false },
    'Sea slugs called nudibranchs are cousins of snails that lose their shell. Their bright colors warn fish that they taste bad, and some even keep the stinging cells of the animals they eat.'),
  fan('fan-monkseal', 'bg-ocean', 'rare', 'Hawaiian monk seal', { plan: 'swim', swim: 'head', seal: true, len: 22, fur: '#8a8f98', belly: '#ced4da', ears: 'none', headR: 0.2, dark: '#5c6068' },
    'Hawaiian monk seals hunt around coral reefs and nap on warm beaches. They are one of the rarest seals in the world: only about 1,600 are left.'),
  // Moon Base (pretend critters, real cousins)
  fan('fan-dustmouse', 'bg-space', 'common', 'Dust mouse', { plan: 'small', len: 14, fur: '#d0d4ee', belly: '#ffffff', dark: '#7d82a8', tail: 'long', ears: 'round', sits: true, eye: '#5c7cfa' },
    'Pretend! Its cousin is the jerboa, a tiny mouse-like desert animal with long back legs that hops like a kangaroo and can leap many times its own length.', 'Jerboa'),
  fan('fan-moonmoth', 'bg-space', 'uncommon', 'Moon moth', { plan: 'bug', len: 16, fur: '#b2f2bb', belly: '#d3f9d8', dark: '#495057', mark: 'spots', accent: '#ffd43b' },
    'Pretend! Its cousin, the luna moth, is pale green with long tails on its wings. Grown-up luna moths have no mouth and live only about a week.', 'Luna moth'),
  fan('fan-moonroo', 'bg-space', 'rare', 'Moon kangaroo', { plan: 'hop', roo: true, len: 20, fur: '#9a9fc4', belly: '#e7e9f7', dark: '#5c5f8a', ears: 'point', eye: '#ffd43b' },
    'Pretend! Its cousin, the red kangaroo, can cover more than 25 feet in a single hop, and its big tail works like an extra leg when it moves slowly.', 'Red kangaroo'),
  // Royal Castle
  fan('fan-pigeon', 'bg-castle', 'common', 'Rock pigeon', { plan: 'bird', len: 14, fur: '#868e96', belly: '#adb5bd', beak: '#495057', mark: 'wingbar', dark: '#343a40', accent: '#63e6be' },
    'Pigeons first nested on rocky cliffs, so castle walls feel like home. A homing pigeon can find its way home from hundreds of miles away.'),
  fan('fan-hedgehog', 'bg-castle', 'uncommon', 'Hedgehog', { plan: 'small', len: 15, fur: '#c8a27a', belly: '#e9d8b4', dark: '#5a4030', spines: true, bodyH: 0.24, tail: 'none', ears: 'round' },
    'A hedgehog has about 5,000 to 7,000 spines. When it is scared it rolls into a prickly ball with all of them pointing out.'),
  fan('fan-corgi', 'bg-castle', 'rare', 'Royal corgi', { plan: 'quad', len: 20, fur: '#e8963a', belly: '#ffffff', legs: 0.1, bulk: 0.55, neck: 0.1, ears: 'point', headR: 0.24, tail: 'short', muzzle: true, dark: '#3b2a20' },
    'Queen Elizabeth II had more than 30 corgis in her long life. Corgis were first bred in Wales to herd cows, nipping at their heels while ducking under their kicks.'),
  // Volcano Island
  fan('fan-lavalizard', 'bg-volcano', 'common', 'Lava lizard', { plan: 'lizard', len: 20, fur: '#c98a5a', belly: '#e8590c', dark: '#2b211d', mark: 'spots', accent: '#ffe8cc', throat: '#e03131' },
    'Lava lizards live on the volcanic Galápagos Islands. To show off, they do push-ups on the warm black rocks!'),
  fan('fan-booby', 'bg-volcano', 'uncommon', 'Blue-footed booby', { plan: 'bird', len: 18, fur: '#a07a5a', belly: '#ffffff', face: '#f1f3f5', beak: '#74c0fc', dark: '#1c7ed6', bill: 0.3 },
    'Blue-footed boobies nest on the volcanic Galápagos Islands. To win a mate, a male struts and lifts his bright blue feet in a dance: the bluer the feet, the better!'),
  fan('fan-salamander', 'bg-volcano', 'rare', 'Fire salamander', { plan: 'lizard', len: 18, fur: '#212529', belly: '#343a40', mark: 'spots', accent: '#ffd43b', dark: '#111111', extra: 'crest' },
    'Long ago people thought fire salamanders were born in fire, because they ran out of logs thrown on a campfire. Really they were just hiding in the damp wood.'),
  // Rainforest
  fan('fan-dartfrog', 'bg-rainforest', 'common', 'Poison dart frog', { plan: 'frog', len: 16, fur: '#1c7ed6', belly: '#74c0fc', mark: 'spots', dark: '#111111', croak: false },
    'A poison dart frog\'s bright colors say "don\'t eat me!" Wild ones get their poison from the bugs they eat; ones raised in zoos are not poisonous at all.'),
  fan('fan-toucan', 'bg-rainforest', 'uncommon', 'Toucan', { plan: 'bird', len: 18, fur: '#212529', belly: '#ffffff', beak: '#fd7e14', bill: 0.45, bigBill: true, face: '#ffd43b' },
    'A toucan\'s huge beak is very light: a thin shell with a honeycomb of bone inside. It also helps the toucan cool down, like a radiator.'),
  fan('fan-jaguar', 'bg-rainforest', 'rare', 'Jaguar', { plan: 'quad', len: 22, fur: '#e8a33a', belly: '#fff3bf', mark: 'spots', spotTag: 'dark', dark: '#3b2a20', tail: 'long', legs: 0.24, ears: 'round', bulk: 0.45, neck: 0.08, headR: 0.22, muzzle: true },
    'Jaguars are the biggest cats in the Americas, and unlike most cats they love to swim. Their bite is so strong they can crack a turtle\'s shell.'),
  // Alaskan Fjord
  fan('fan-ermine', 'bg-fjord', 'common', 'Ermine', { plan: 'small', len: 16, fur: '#f8f9fa', belly: '#ffffff', tail: 'long', tailTag: 'dark', dark: '#212529', ears: 'round', sits: true },
    'The ermine is a little weasel that turns snow white in winter, all but the black tip of its tail. In summer its coat turns brown again.'),
  fan('fan-otter', 'bg-fjord', 'uncommon', 'Sea otter', { plan: 'swim', swim: 'float', len: 22, fur: '#6f5a48', belly: '#d8c8b0', accent: '#adb5bd' },
    'Sea otters have the thickest fur of any animal: up to a million hairs in a patch the size of a stamp. They wrap themselves in kelp so they don\'t drift off while they sleep.'),
  fan('fan-arcticfox', 'bg-fjord', 'rare', 'Arctic fox', { plan: 'quad', len: 22, fur: '#f8f9fa', belly: '#ffffff', tail: 'bushy', legs: 0.2, bulk: 0.45, neck: 0.1, ears: 'point', dark: '#343a40', muzzle: true },
    'Arctic foxes can hear lemmings moving under the snow, then pounce nose first to catch them. Their fur is white in winter and brown in summer.'),
  // Rainbow Land (pretend critters, real cousins)
  fan('fan-gumdrop', 'bg-rainbow', 'common', 'Gumdrop snail', { plan: 'snail', len: 15, fur: '#ffd8a8', accent: '#f783ac', mark: 'spots' },
    'Pretend! Its cousin, the garden snail, has thousands of tiny teeth on a tongue shaped like a ribbon, which it uses to scrape up leaves.', 'Garden snail'),
  fan('fan-candybunny', 'bg-rainbow', 'uncommon', 'Candy bunny', { plan: 'hop', len: 15, fur: '#fcc2d7', belly: '#ffffff', dark: '#e64980', ears: 'long', eye: '#845ef7' },
    'Pretend! Its cousin, the real rabbit, has front teeth that never stop growing. Chewing on hay and twigs keeps them the right length.', 'Rabbit'),
  { heading: 'Real story', ...fan('fan-unicorn', 'bg-rainbow', 'rare', 'Baby unicorn', { plan: 'quad', len: 22, fur: '#ffffff', belly: '#ffffff', horns: 'horn', hooves: true, legs: 0.5, extra: 'mane', accent: '#b197fc', tail: 'bushy', eye: '#845ef7' },
    'Pretend! Long ago sailors sold narwhal tusks as "unicorn horns". The narwhal is a real whale, and its long spiral tusk is really a tooth!', 'Narwhal') },
  // Golden Galaxy (pretend critters, real cousins)
  fan('fan-starbeetle', 'bg-galaxy', 'common', 'Star beetle', { plan: 'bug', len: 14, fur: '#ffd43b', belly: '#fff3bf', dark: '#5f3dc4', mark: 'glow', accent: '#ffffff' },
    'Pretend! Its cousin is the firefly, a beetle that makes cold light: almost none of its energy turns into heat, so its glow never gets hot.', 'Firefly'),
  fan('fan-nebulacat', 'bg-galaxy', 'uncommon', 'Nebula kitty', { plan: 'quad', len: 18, fur: '#9775fa', belly: '#e5dbff', tail: 'long', legs: 0.34, ears: 'point', mark: 'spots', accent: '#ffd43b', spotTag: 'accent' },
    'Pretend! Its cousin, the house cat, can turn each ear on its own, about halfway around, to listen in two directions at once.', 'House cat'),
  fan('fan-cometfox', 'bg-galaxy', 'rare', 'Comet fox', { plan: 'quad', len: 20, fur: '#ffe066', belly: '#fff9db', tail: 'bushy', tip: true, legs: 0.34, ears: 'point', accent: '#ffffff', mark: 'glow' },
    'Pretend! Its cousin, the fennec fox, has the biggest ears for its size of any fox. Its ears let out heat to keep it cool in the Sahara desert.', 'Fennec fox'),
];

export const fanById = (id) => FANS.find((f) => f.id === id) || null;
/** A map's three fans, common first (Forest Village's for an unknown map). */
export const fansOn = (map) => { const l = FANS.filter((f) => f.map === map); return l.length ? l : FANS.filter((f) => f.map === 'bg-meadow'); };

/** Which fan comes: r() for the roll; dry: games on this map since its rare fan last came. */
export function pickFan(map, r, dry = 0) {
  const list = fansOn(map);
  if (dry >= FAN_PITY) return list.find((f) => f.rarity === 'rare');
  let x = r() * 100;
  for (const f of list) { x -= FAN_RARITY[f.rarity].odds; if (x < 0) return f; }
  return list[0];
}

/** Adds a cheer to the fans record (pure): { fans, first } where first is true for a new fan. */
export function recordFan(fans = {}, id, date) {
  const old = fans[id];
  return { fans: { ...fans, [id]: { n: (old?.n || 0) + 1, first: old?.first || date, last: date } }, first: !old };
}

/** How many fans a kid has, of how many. */
export const fanCount = (fans = {}) => ({ got: FANS.filter((f) => fans[f.id]).length, total: FANS.length });

/**
 * The fan that comes to watch a game. The game calls step(dt, playing) each frame and
 * great(text) when the kid does something great; draw(ctx, x, y) draws it at its seat (a spot
 * on the backdrop, out of the way of the play). onFan(fan) is told about a cheer and answers
 * 'new' (a brand new fan) or anything else.
 */
export class FanWatch {
  constructor({ map, r, dry = 0, onFan = null, onSeen = null }) {
    this.map = map; this.r = r; this.dry = dry; this.onFan = onFan; this.onSeen = onSeen;
    this.t = 0; this.fan = null; this.seen = [];
    this.nextAt = FAN_FIRST[0] + r() * (FAN_FIRST[1] - FAN_FIRST[0]);
    this.cheerAt = -9; this.cheered = false;
  }

  /** dt seconds of play (not counted while the game isn't being played). */
  step(dt, playing) {
    if (!playing) return;
    this.t += dt;
    if (!this.fan && this.t >= this.nextAt && this.seen.length < 2) {
      this.fan = pickFan(this.map, this.r, this.dry);
      this.side = this.r() < 0.5 ? -1 : 1;
      this.came = this.t; this.cheered = false;
      this.seen.push(this.fan.id);
      if (this.fan.rarity === 'rare') this.dry = 0;
      this.onSeen?.(this.fan);
    }
    if (this.fan && this.t - this.came > FAN_STAY && this.t - this.cheerAt > 1.5) {
      this.fan = null;
      this.nextAt = this.t + FAN_AGAIN[0] + this.r() * (FAN_AGAIN[1] - FAN_AGAIN[0]);
    }
  }

  /** Is a fan sitting and watching right now (not walking in or off)? */
  get watching() { return Boolean(this.fan) && this.t - this.came > 1 && this.t - this.came < FAN_STAY; }

  /** The kid did something great: a watching fan cheers (once a visit). Returns a word to pop, or null. */
  great() {
    if (!this.watching || this.cheered) return null;
    this.cheered = true; this.cheerAt = this.t;
    const got = this.onFan?.(this.fan);
    return got === 'new' ? `New fan: ${this.fan.name}!` : `${this.fan.name} cheers!`;
  }

  /** Where the fan sits, as a share of the screen width (0 left, 1 right): beside the score. */
  get seat() { return this.side < 0 ? 0.16 : 0.84; }

  /** Draws the fan with its feet at (x, by), walking in from the screen edge, then sitting. */
  draw(ctx, x, by, W) {
    const f = this.fan; if (!f) return;
    const age = this.t - this.came; const left = FAN_STAY - age;
    const edge = this.side < 0 ? -12 : W + 12;
    const k = Math.min(1, age, Math.max(0, left));
    const fx = Math.round(edge + (x - edge) * k);
    const moving = age < 1 || left < 1;
    const step = Math.floor(this.t * 8) % 2;
    // birds' 'walk' frame is a wings-out flying pose, so they hop in standing, with a little bob
    const bird = f.look.plan === 'bird' || f.look.plan === 'big-bird';
    const frame = moving ? (step && !bird ? 'walk' : 'stand') : 'pose';
    const pic = critterPic(f.look, frame);
    const cheer = this.t - this.cheerAt < 1.2;
    const hop = (cheer ? Math.round(Math.abs(Math.sin((this.t - this.cheerAt) * 10)) * 3) : 0) + (moving && bird && step ? 1 : 0);
    // it faces left; turn it to face the field when it sits on the left
    const faceRight = moving ? this.side > 0 === (age < 1) : this.side < 0;
    ctx.save();
    ctx.translate(fx, by - pic.feet - hop);
    if (faceRight) ctx.scale(-1, 1);
    ctx.drawImage(pic, -Math.round(pic.width / 2), 0);
    ctx.restore();
    if (cheer) {
      ctx.fillStyle = '#ff6b6b';
      const hy = by - pic.feet - 6 - Math.round((this.t - this.cheerAt) * 8);
      ctx.fillRect(fx - 1, hy, 1, 1); ctx.fillRect(fx + 1, hy, 1, 1); ctx.fillRect(fx - 2, hy + 1, 5, 1); ctx.fillRect(fx - 1, hy + 2, 3, 1); ctx.fillRect(fx, hy + 3, 1, 1);
    } else if (this.watching && !this.cheered && Math.floor(this.t * 2) % 2) {
      // a little "!" says: show me something great
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(fx, by - pic.feet - 6, 1, 3); ctx.fillRect(fx, by - pic.feet - 2, 1, 1);
    }
  }
}
