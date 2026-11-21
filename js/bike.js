// Trick jumps with a visiting buddy: 90 seconds riding bikes down the map's hill.
//
// A side view that scrolls along: your buddy rides left to right down its map's own hill
// (slopes.js), the visitor just behind on its own bike. About every 4 seconds there's a
// ramp. Two thumbs:
//   LEFT  hold: pedal on the ground (faster, so you fly farther). LET GO as you reach the
//         ramp's lip to pop (a ring closes on the lip: Perfect, Good, or a little hop; a pop
//         can't fail). Holding it in the air flips the bike backwards; let go past half a
//         flip and it finishes the flip by itself.
//   RIGHT press: a 360 spin that finishes itself, the moment the thumb touches (however long
//         it stays down, and also with the left thumb still held). Pressed just before the
//         lip, the spin starts as the bike leaves the ramp.
//   BOTH  pressed together (within TOGETHER): a no-hander in the air (hold it long for a
//         Superman), a wheelie on the ground.
// Land with the wheels level with the ground: within 30 degrees the bike eases level by
// itself (the landing assist), so only a flip held too long can crash. Perfect, Good or
// Sketchy landings score 1.5x, 1x or 0.5x. Landed tricks in a row build a chain (up to x5);
// a crash is a 1 second tumble and halves the chain.
//
// Every new trick landed is a trick card for the kid's trick book, with the best height and
// distance it was landed at (in meters, like fish weights). Each map has its own trick and
// its own twist (TWISTS): low gravity on the moon, a loop on the rainbow slide, geysers on
// the volcano... Each day's snow kind (slopes.js) changes the ground and has its own card,
// and a trick of the day scores double. Once a run something lucky happens: a golden ramp
// or a tailwind.
//
// A better bike pops higher, flips a little faster and gets rare golden ramps more often.
// The good bike has pegs, so rails turn up to grind on (their own cards). The super bike can
// pop a second time in the air (the BOOST button) and leaves a spark trail.
//
// Same interface as Play in play.js (tap, release, step, draw, drawHud, score, phase), plus
// multi: playground.js sends every finger (down(id, x, y), up(id)) so both thumbs work at once.
import { rng, canvas, clamp, HAPPY } from './play.js';
import { buildRig, render, Brain } from './rig.js';
import { addPop } from './meter.js';
import { hillFor, snowOfDay, snowWords, SURFACES, SNOW_KINDS, makeGround, hash } from './slopes.js';

export const GAME_SECONDS = 90;
/** Gravity in field pixels per second squared, times the hill's own gravity. */
export const G = 240;
/** 10 field pixels are a meter (a buddy is about a meter and a half tall on its bike). */
export const PX_PER_M = 10;
/** Pop timing: release within this many seconds of the lip. Anything else is a small hop. */
export const POP_WIN = { perfect: 0.08, good: 0.28 };
/** How hard each pop throws the bike up (pixels per second). */
export const POP_V = { perfect: 84, good: 64, hop: 30 };
/** Each bike tier: pop strength, flip speed (degrees a second), top speed, golden ramp chance a run. */
export const BIKES = [
  { tier: 1, pop: 1, flip: 400, top: 110, gold: 0.12 },
  { tier: 2, pop: 1.15, flip: 430, top: 118, gold: 0.18 },
  { tier: 3, pop: 1.3, flip: 460, top: 126, gold: 0.3 },
];
/** Seconds one 360 spin takes. */
export const SPIN_TIME = 0.42;
/** The landing assist eases the bike level within this many degrees; then the grades. */
export const ASSIST = 30;
export const LAND = { perfect: 15, good: 35, sketchy: 60 };
export const LAND_X = { perfect: 1.5, good: 1, sketchy: 0.5 };
export const CHAIN_MAX = 5;
export const CRASH_TIME = 1;
/** A held grab: a no-hander from this long, a Superman from SUPERMAN. */
export const GRAB_MIN = 0.2;
/** Two thumbs pressed this close together are one move (a no-hander), not a flip and a spin. */
export const TOGETHER = 0.15;
/** A right press this soon before take-off spins once the bike is in the air. */
export const SPIN_EARLY = 0.35;
/** Let go of a flip past this much of a turn and it finishes by itself. */
export const FLIP_FINISH = 0.5;
/** Let go this little past a whole flip and it pulls back to the whole flip. */
export const FLIP_BACK = 0.25;
export const SUPERMAN = 0.8;

// ---------- the trick cards ----------
/**
 * rarity: common, uncommon, rare, legend; 'map' cards need one map, 'day' cards one snow
 * kind, 'grind' cards a good bike's pegs. note: a real fact about the trick.
 * Combo cards are found by flips-spins-grab (grab 1 is a no-hander, 2 a Superman).
 */
export const RARITY = {
  common: { name: 'Common', color: '#adb5bd', pts: 50 },
  uncommon: { name: 'Uncommon', color: '#40c057', pts: 100 },
  rare: { name: 'Rare', color: '#339af0', pts: 200 },
  legend: { name: 'Legendary', color: '#f59f00', pts: 400 },
  map: { name: 'Map trick', color: '#e64980', pts: 250 },
  day: { name: 'Snow trick', color: '#74c0fc', pts: 150 },
  grind: { name: 'Grind', color: '#868e96', pts: 150 },
};
export const TRICKS = [
  { id: 'hop', combo: '0-0-0', name: 'Bunny hop', rarity: 'common', note: 'Riders pull the front wheel up, then the back, to hop over things. It is the first trick most BMX riders learn.' },
  { id: 'nohander', combo: '0-0-1', name: 'No-hander', rarity: 'common', note: 'Both hands come off the bars in mid-air, then grab them again before landing.' },
  { id: 'spin', combo: '0-1-0', name: '360', rarity: 'common', note: 'One whole turn in the air. It is named after the 360 degrees in a circle.' },
  { id: 'backflip', combo: '1-0-0', name: 'Backflip', rarity: 'common', note: 'The bike and rider turn all the way over backwards. BMX riders practice it into foam pits first.' },
  { id: 'wheelie', name: 'Wheelie', rarity: 'common', note: 'Riding on the back wheel only. The record for the longest wheelie is over 3 hours!' },
  { id: 'superman', combo: '0-0-2', name: 'Superman', rarity: 'uncommon', note: 'Hands on the bars, legs flying out behind, like a superhero flying.' },
  { id: 'spinnohander', combo: '0-1-1', name: '360 no-hander', rarity: 'uncommon', note: 'A full turn while letting go of the bars. Two tricks at once is called a combo.' },
  { id: 'flipnohander', combo: '1-0-1', name: 'Flip no-hander', rarity: 'uncommon', note: 'A backflip with a no-hander at the top, upside down!' },
  { id: 'spin720', combo: '0-2-0', name: '720', rarity: 'rare', note: 'Two whole turns. Pro rider Mat Hoffman landed one on a huge ramp in 1989.' },
  { id: 'flipspin', combo: '1-1-0', name: 'Flip 360', rarity: 'rare', note: 'Flipping and turning at the same time. Riders call a backflip with a half turn a flair.' },
  { id: 'supermanflip', combo: '1-0-2', name: 'Superman flip', rarity: 'rare', note: 'A backflip with a Superman stretched out on the way down.' },
  { id: 'double', combo: '2-0-0', name: 'Double backflip', rarity: 'rare', note: 'Two backflips in one jump. The first one in a contest was landed in 2002.' },
  { id: 'spin1080', combo: '0-3-0', name: '1080', rarity: 'legend', note: 'Three whole turns. Only a few riders in the world have ever landed one.' },
  { id: 'triple', combo: '3-0-0', name: 'Triple backflip', rarity: 'legend', note: 'Three backflips! It needs a giant ramp, or the floaty gravity of the moon.' },
  { id: 'golden', name: 'Golden air', rarity: 'rare', note: 'Any trick off a golden ramp. Real riders call a huge, high jump "big air".' },
  // map tricks
  { id: 'loghop', map: 'bg-meadow', name: 'Log hop', rarity: 'map', note: 'Hop clean over a fallen log. Mountain bikers on forest trails hop logs all the time.' },
  { id: 'drawbridge', map: 'bg-castle', name: 'Drawbridge launch', rarity: 'map', note: 'Pop off the drawbridge while it is raised up high. Real drawbridges let castles shut out invaders.' },
  { id: 'dunesurf', map: 'bg-sunset', name: 'Dune surfer', rarity: 'map', note: 'Three dune jumps in a row with tricks. Real sand dunes can be taller than a skyscraper.' },
  { id: 'waverider', map: 'bg-ocean', name: 'Wave rider', rarity: 'map', note: 'Pop off the wave just as it curls. Big waves can be taller than a 10 story building.' },
  { id: 'geyser', map: 'bg-volcano', name: 'Geyser boost', rarity: 'map', note: 'Ride a steam vent up and land a trick. Geysers shoot hot water and steam heated by magma underground.' },
  { id: 'mudskipper', map: 'bg-rainforest', name: 'Mud skipper', rarity: 'map', note: 'Land a no-hander in a mud puddle. Mudskippers are real fish that hop around on mud!' },
  { id: 'icecomet', map: 'bg-fjord', name: 'Ice comet', rarity: 'map', note: 'Fly 25 meters off the glacier. Alaska has about 100,000 glaciers.' },
  { id: 'moonwalk', map: 'bg-space', name: 'Moonwalk', rarity: 'map', note: 'Stay in the air for 3 seconds. The moon pulls only a sixth as hard as Earth, so you float.' },
  { id: 'rainbowloop', map: 'bg-rainbow', name: 'Rainbow loop', rarity: 'map', note: 'Ride all the way around the loop. Go fast enough and you stick to it upside down.' },
  { id: 'starcatcher', map: 'bg-galaxy', name: 'Star catcher', rarity: 'map', note: 'Fly through a star ring. Shooting stars are really tiny space rocks burning up in the sky.' },
  // snow kind tricks
  { id: 'powderbomb', snow: 'powder', name: 'Powder bomb', rarity: 'day', note: 'Land a backflip in soft, deep ground. Soft ground makes landings gentler.' },
  { id: 'iceskater', snow: 'icy', name: 'Ice skater', rarity: 'day', note: 'Land a 360 on the fast, icy kind. Figure skaters can spin 6 times a second!' },
  { id: 'slushsplash', snow: 'slushy', name: 'Slush splash', rarity: 'day', note: 'Land a Superman on the sticky, slushy kind. Sticky ground grips the tires.' },
  // grinds (a good bike's pegs)
  { id: 'grind', name: 'Rail grind', rarity: 'grind', note: 'Pegs are little metal tubes on the wheels. Riders slide them along rails.' },
  { id: 'longgrind', name: 'Long grind', rarity: 'grind', note: 'Grind a whole rail, start to end, without falling off.' },
  { id: 'flipgrind', name: 'Flip to grind', rarity: 'grind', note: 'Land a backflip right onto a rail. Very few riders try this one!' },
];
export const TRICK = Object.fromEntries(TRICKS.map((t) => [t.id, t]));
const BY_COMBO = Object.fromEntries(TRICKS.filter((t) => t.combo).map((t) => [t.combo, t]));

/** The trick of the day (double points): one of the common and uncommon combos, the same for everyone. */
export function trickOfDay(day) {
  const pool = TRICKS.filter((t) => t.combo && (t.rarity === 'common' || t.rarity === 'uncommon'));
  const r = rng(hash(`trick:${day}`)); r();
  return pool[Math.floor(r() * pool.length)].id;
}

/** Which combo cards a landing earns: the exact combo if there's a card for it, or each part. */
export function comboCards(flips, spins, grab) {
  const exact = BY_COMBO[`${flips}-${spins}-${grab}`];
  if (exact) return [exact.id];
  const out = [];
  if (flips) out.push((BY_COMBO[`${Math.min(flips, 3)}-0-0`] || TRICK.backflip).id);
  if (spins) out.push((BY_COMBO[`0-${Math.min(spins, 3)}-0`] || TRICK.spin).id);
  if (grab) out.push(grab === 2 ? 'superman' : 'nohander');
  return out;
}

/** The name of what was landed, like "Double backflip + 360". */
export function trickName(flips, spins, grab) {
  const parts = [];
  if (flips) parts.push(flips === 1 ? 'Backflip' : flips === 2 ? 'Double backflip' : flips === 3 ? 'Triple backflip' : `${flips}x backflip`);
  if (spins) parts.push(String(spins * 360));
  if (grab) parts.push(grab === 2 ? 'Superman' : 'no-hander');
  if (!parts.length) return 'Bunny hop';
  return parts.join(' + ');
}

/**
 * Keeps a landed card in the kid's trick book (kid.trickBook = { id: { n, h, d, perfect, map, date } }).
 * Returns { book (a new object), res: 'first' | 'record' | null } (record: higher or farther than before).
 */
export function recordTrick(book = {}, { id, height = 0, dist = 0, grade, map, date }) {
  if (!TRICK[id]) return { book, res: null };
  const old = book[id];
  const perfect = grade === 'perfect' ? 1 : 0;
  if (!old) return { book: { ...book, [id]: { n: 1, h: height, d: dist, perfect, map, date } }, res: 'first' };
  const rec = height > (old.h || 0) + 0.05 || dist > (old.d || 0) + 0.05;
  const next = { ...old, n: (old.n || 0) + 1, perfect: (old.perfect || 0) + perfect, h: Math.max(old.h || 0, height), d: Math.max(old.d || 0, dist) };
  return { book: { ...book, [id]: next }, res: rec ? 'record' : null };
}

/** How high or far that is, next to something real (meters). */
export const HEIGHTS = [[1, 'a big dog'], [2, 'a door'], [3, 'a basketball hoop'], [4.5, 'a giraffe'], [6, 'a two-story house'], [10, 'a telephone pole'], [15, 'a five-story building']];
export const LENGTHS = [[4, 'a car'], [8, 'a dinosaur'], [12, 'a school bus'], [25, 'a blue whale'], [30, 'a basketball court'], [50, 'a swimming pool']];
export function likeA(m, list) {
  let best = list[0][1];
  for (const [v, what] of list) if (m >= v * 0.9) best = what;
  return best;
}

// ---------- each map's twist ----------
/**
 * What each map does differently. Kicker ramps everywhere, plus:
 * meadow logs to hop; castle a drawbridge that rises (steeper the later you get there);
 * sunset dunes (smooth humps: pedal down, let go up, to pump faster); ocean a traveling wave
 * to pop off when it curls (and floatier water); volcano geysers that lift you in mid-air;
 * rainforest mud puddles to land in; fjord no braking and a giant glacier lip to finish;
 * space low gravity; rainbow a loop; galaxy star rings in the air.
 */
export const TWISTS = {
  'bg-meadow': { feature: 'log', say: 'Hop the logs!' },
  'bg-castle': { feature: 'drawbridge', say: 'The drawbridge rises: later is steeper!' },
  'bg-sunset': { feature: 'dune', say: 'Pedal down the dunes, let go going up!' },
  'bg-ocean': { feature: 'wave', say: 'Pop off the wave when it curls!' },
  'bg-volcano': { feature: 'vent', say: 'Fly over a geyser when it blows!' },
  'bg-rainforest': { feature: 'puddle', say: 'Land in the mud puddles!' },
  'bg-fjord': { feature: 'glacier', say: 'Fast ice, and a giant glacier jump at the end!' },
  'bg-space': { feature: 'moon', say: 'Low gravity: big floaty air!' },
  'bg-rainbow': { feature: 'loop', say: 'Pedal fast for the loop!' },
  'bg-galaxy': { feature: 'ring', say: 'Fly through the star rings!' },
};

const INK = '#1b1430';
const TAU = Math.PI * 2;
const DEG = 180 / Math.PI;
/** An angle in degrees folded into -180..180. */
export const fold = (a) => { let d = ((a + 180) % 360 + 360) % 360 - 180; if (d === -180) d = 180; return d; };
/** A circle plotted in whole pixels (canvas strokes look smooth next to pixel art). */
function pixelRing(ctx, cx, cy, rx, ry, col, thick = 1) {
  ctx.fillStyle = col;
  const n = Math.max(12, Math.round((rx + ry) * 4));
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * TAU;
    for (let t = 0; t < thick; t += 1) ctx.fillRect(Math.round(cx + Math.cos(a) * (rx + t)), Math.round(cy + Math.sin(a) * (ry + t)), 1, 1);
  }
}

/** The landing grade for a bike this many degrees off the ground's angle. */
export function landGrade(diff) {
  const d = Math.abs(diff);
  return d <= LAND.perfect ? 'perfect' : d <= LAND.good ? 'good' : d <= LAND.sketchy ? 'sketchy' : 'crash';
}
/** The pop for a release this many seconds from the lip (either side). */
export function popGrade(dt) {
  const d = Math.abs(dt);
  return d <= POP_WIN.perfect ? 'perfect' : d <= POP_WIN.good ? 'good' : 'hop';
}

// ---------- the bike picture ----------
const FRAME = [
  { frame: '#e03131', dark: '#a61e1e', tire: '#343a40', rim: '#ced4da', seat: '#212529' }, // regular: red
  { frame: '#1c7ed6', dark: '#1259a3', tire: '#212529', rim: '#e9ecef', seat: '#212529', pegs: '#dee2e6' }, // good: blue BMX, chrome pegs
  { frame: '#fcc419', dark: '#e67700', tire: '#212529', rim: '#fff3bf', seat: '#7048e8', pegs: '#fff3bf' }, // super: gold
];
/** A 26 x 16 side view of a bike facing right, as a canvas. Each tier reads at a glance: red, blue with chrome pegs, gold with shiny rims. */
export function bikePic(tier = 1) {
  const c = canvas(26, 16);
  const x = c.getContext('2d');
  const t = clamp(tier, 1, 3);
  const k = FRAME[t - 1];
  const px = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  const line = (x0, y0, x1, y1, col, thick = 1) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let s = 0; s <= n; s += 1) {
      const xx = Math.round(x0 + ((x1 - x0) * s) / n); const yy = Math.round(y0 + ((y1 - y0) * s) / n);
      px(xx, yy, col); if (thick > 1) px(xx, yy + 1, col);
    }
  };
  const side = ['#343a40', '#4dabf7', '#fcc419'][t - 1]; // a colored ring on the tyre
  const wheel = (cx, cy) => {
    for (let j = -6; j <= 6; j += 1) for (let i = -6; i <= 6; i += 1) {
      const d = Math.hypot(i, j);
      if (d <= 5.6 && d > 5.0) px(cx + i, cy + j, INK);
      else if (d <= 5.0 && d > 4.3) px(cx + i, cy + j, k.tire);
      else if (d <= 4.3 && d > 3.6) px(cx + i, cy + j, t > 1 ? side : k.rim);
      else if (d <= 3.6 && (i === 0 || j === 0 || i === j || i === -j)) px(cx + i, cy + j, t === 3 ? '#fff3bf' : '#adb5bd');
    }
    px(cx, cy, k.dark);
    if (t === 3) { px(cx - 2, cy - 3, '#ffffff'); px(cx + 3, cy + 1, '#ffffff'); }
  };
  wheel(6, 10); wheel(20, 10);
  // frame: 2 px tubes so the color shows past the buddy
  line(6, 9, 12, 10, k.frame, 2); line(12, 10, 10, 4, k.frame); line(11, 10, 9, 4, k.frame); line(10, 4, 17, 4, k.frame, 2); line(12, 10, 17, 4, k.frame, 2);
  line(6, 10, 10, 4, k.dark); line(17, 4, 20, 10, k.dark); line(18, 4, 21, 10, k.dark); line(17, 4, 16, 1, k.dark);
  line(14, 1, 19, 1, INK); line(14, 0, 14, 1, INK); // the bars
  line(7, 3, 11, 3, k.seat); line(8, 2, 10, 2, k.seat); // the seat
  px(12, 11, INK); px(13, 12, INK); px(14, 12, INK); px(11, 10, INK); // crank and pedals
  if (k.pegs) { x.fillStyle = k.pegs; x.fillRect(2, 10, 3, 2); x.fillRect(22, 10, 3, 2); x.fillStyle = INK; x.fillRect(2, 12, 3, 1); x.fillRect(22, 12, 3, 1); }
  if (t === 3) { px(13, 4, '#ffffff'); px(14, 7, '#ffffff'); } // a shine
  return c;
}

// ---------- a rider: one buddy on one bike ----------
export class Rider {
  constructor(game, buddy, name, tier, seed) {
    this.game = game; this.name = name;
    this.bike = BIKES[clamp(tier || 1, 1, 3) - 1];
    this.rig = buildRig({ ...buddy, outfit: { ...(buddy?.outfit || {}), sport: undefined, hand: undefined, music: undefined } }, { background: false });
    this.brain = new Brain(seed); this.brain.set(HAPPY); this.brain.settle();
    this.buddyPic = canvas(24, 24); this.frame = -1; this.poseT = 0;
    this.bikePic = bikePic(this.bike.tier);
    this.sprite = canvas(36, 36);
    this.x = 0; this.y = 0; this.v = 70; this.vx = 0; this.vy = 0;
    this.angle = 0; // degrees, nose up is negative
    this.state = 'ground'; // ground | air | grind | loop | crash
    this.air = null; this.squash = 0; this.crashT = 0; this.wheelieT = 0;
    this.trail = [];
  }

  /** The buddy's pose, 12 times a second, with its arms and legs fit to what the rider's doing. */
  paint(t) {
    const frame = Math.floor(t * 12);
    if (frame === this.frame) return;
    const dt = this.frame < 0 ? 1 / 12 : t - this.poseT;
    this.frame = frame; this.poseT = t;
    const pose = this.brain.pose(t, dt, {});
    const a = this.air;
    const grab = a && a.grabT > GRAB_MIN;
    if (this.state === 'crash') {
      pose.armL = { rot: pose.armL.rot + Math.sin(t * 20) * 70 }; pose.armR = { rot: pose.armR.rot - Math.sin(t * 20) * 70 };
    } else if (grab) {
      pose.armL = { rot: pose.armL.rot - 150 }; pose.armR = { rot: pose.armR.rot + 150 }; // hands up!
    } else {
      pose.armL = { rot: pose.armL.rot - 60 }; pose.armR = { rot: pose.armR.rot - 60 }; // reach for the bars
      if (this.state === 'ground' && this.pedal) {
        const s = Math.sin(t * 14);
        pose.footL = { dy: -Math.round(Math.max(0, s) * 2), dx: 0 };
        pose.footR = { dy: -Math.round(Math.max(0, -s) * 2), dx: 0 };
      }
    }
    const buf = render(this.rig, pose, frame);
    const x = this.buddyPic.getContext('2d');
    const img = x.createImageData(24, 24);
    for (let i = 0; i < buf.length; i += 1) {
      const c = buf[i];
      if (!c) continue;
      img.data[i * 4] = parseInt(c.slice(1, 3), 16); img.data[i * 4 + 1] = parseInt(c.slice(3, 5), 16); img.data[i * 4 + 2] = parseInt(c.slice(5, 7), 16); img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
    // the rider: the bike along the bottom, the buddy on the seat
    const s = this.sprite.getContext('2d');
    s.clearRect(0, 0, 36, 36);
    const superman = a && a.grabT > SUPERMAN;
    s.drawImage(this.bikePic, 5, 20);
    if (superman) {
      // stretched out behind the bars, like flying
      s.save(); s.translate(19, 22); s.rotate(-1.25); s.drawImage(this.buddyPic, -12, -21); s.restore();
    } else {
      s.drawImage(this.buddyPic, 3, grab ? 0 : 4);
    }
    // the bars over the hands
    if (!grab) { s.fillStyle = INK; s.fillRect(19, 21, 6, 1); }
  }
}

// ---------- the game ----------
export class Bike {
  /**
   * opts: { W, H, kid, visitor: { buddy, name, gear }, best, seed, map: Places background id,
   *   day: date string, season, onTrick({ id, height, dist, grade, map }): the kid landed a
   *   trick card; answers 'first' (new in the trick book), 'record' (higher or farther) or null,
   *   book: { id: true } the cards the kid already has (shown as NEW otherwise) }
   */
  constructor(opts) {
    this.kind = 'tricks';
    this.multi = true; this.holdAnywhere = true;
    this.Z = 2;
    this.W = opts.W; this.H = opts.H;
    this.fieldW = this.W; this.fieldH = this.H;
    this.seed = opts.seed || 1;
    this.r = rng(this.seed);
    this.map = opts.map || 'bg-meadow';
    this.day = opts.day || 'today';
    this.hill = hillFor(this.map, opts.season || 'summer');
    this.twist = TWISTS[this.hill.id] || TWISTS['bg-meadow'];
    this.snow = opts.snow || snowOfDay(this.day);
    this.snowName = snowWords(this.snow, this.hill.surface);
    this.trickDay = trickOfDay(this.day);
    this.grav = this.hill.gravity * (this.hill.id === 'bg-ocean' ? 1 : 1);
    this.speedK = (SURFACES[this.hill.surface]?.friction || 1) * (SNOW_KINDS[this.snow]?.speed || 1);
    this.onTrick = opts.onTrick || null;
    this.book = { ...(opts.book || {}) };
    this.best = opts.best || 0;
    this.t = 0; this.pops = []; this.left = GAME_SECONDS;
    this.points = { kid: 0, vis: 0 }; this.visK = 0.85;
    this.chain = 0; this.newBest = false; this.locked = false;
    this.phase = 'ready';
    this.fingers = new Map(); // pointer id -> 'L' | 'R'
    this.kidTier = clamp(opts.kid.gear?.bike || 1, 1, 3);
    this.visTier = clamp(opts.visitor.gear?.bike || 1, 1, 3);
    this.kid = new Rider(this, opts.kid.buddy, opts.kid.name, this.kidTier, 11);
    this.vis = new Rider(this, opts.visitor.buddy, opts.visitor.name, this.visTier, 23);
    this.vis.ai = true;
    // the lucky thing this run: a golden ramp (likelier with a better bike; always on a fresh one), or a tailwind
    const luck = this.r();
    this.event = opts.event || (opts.newBike || luck < BIKES[this.kidTier - 1].gold ? 'golden' : luck < 0.5 ? 'tailwind' : null);
    this.buildTrack();
    this.kid.x = 40; this.vis.x = 14;
    for (const p of [this.kid, this.vis]) { p.y = this.ground(p.x); p.angle = Math.atan(this.slope(p.x)) * DEG; }
    this.camX = this.kid.x - this.W * 0.32; this.camY = this.kid.y - this.H * 0.62;
    this.shake = 0; this.stop = 0; this.dust = []; this.sparks = [];
    this.got = []; // cards landed this run, in order: { id, first, record }
    this.landed = 0; this.crashes = 0; this.bestAir = { h: 0, d: 0 };
    this.sound = null; this.buzz = null;
    this.sky = this.paintSky();
  }

  get score() { return this.points.kid; }

  // ---------- the hill ----------
  buildTrack() {
    const r = rng(hash(`bike:${this.seed}:${this.map}`));
    const dunes = this.twist.feature === 'dune';
    this.base = makeGround(this.seed, { ramps: 0, drop: dunes ? 0.08 : 0.11, bump: dunes ? 3 : 6, length: 30000 });
    this.features = []; this.kickers = [];
    const f = this.twist.feature;
    let x = 230;
    let n = 0;
    const goldAt = this.event === 'golden' ? 3 + Math.floor(r() * 6) : -1;
    while (x < 26000) {
      n += 1;
      const gold = n === goldAt;
      let k;
      if (f === 'dune' && !gold && n % 3 !== 0) {
        k = { kind: 'dune', x, w: 90 + Math.round(r() * 30), h: 16 + Math.round(r() * 6) };
        k.lip = k.x + k.w / 2;
      } else {
        k = { kind: gold ? 'gold' : f === 'drawbridge' && n % 2 === 0 ? 'drawbridge' : f === 'wave' && n % 2 === 0 ? 'wave' : f === 'glacier' && n % 4 === 0 ? 'glacier' : 'kicker', x, w: 34 + Math.round(r() * 10), h: 13 + Math.round(r() * 5) };
        if (k.kind === 'gold') { k.w = 60; k.h = 30; }
        if (k.kind === 'glacier') { k.w = 56; k.h = 26; }
        k.lip = k.x + k.w;
      }
      k.n = n;
      this.kickers.push(k);
      this.features.push(k);
      // something past the lip, in the landing zone
      const after = k.lip + 60 + Math.round(r() * 40);
      if (f === 'log' && r() < 0.7) this.features.push({ kind: 'log', x: k.lip + 26 + Math.round(r() * 20), w: 12, h: 5 });
      if (f === 'vent' && r() < 0.8) this.features.push({ kind: 'vent', x: k.lip + 28 + Math.round(r() * 16), w: 14, period: 2.4 + r(), at: r() * 3 });
      if (f === 'puddle' && r() < 0.8) this.features.push({ kind: 'puddle', x: after - 10, w: 40 });
      if (f === 'ring' && r() < 0.8) this.features.push({ kind: 'ring', x: k.lip + 40 + Math.round(r() * 30), up: 30 + Math.round(r() * 26), r: 7, got: false });
      if (this.kidTier >= 2 && f !== 'dune' && r() < 0.3) this.features.push({ kind: 'rail', x: after + 4, w: 70, h: 10 });
      let gap = 300 + Math.round(r() * 120);
      if (f === 'loop' && n % 3 === 1) { this.features.push({ kind: 'loop', x: k.lip + 290, r: 24 }); gap += 160; }
      if (f === 'log' && r() < 0.5) this.features.push({ kind: 'log', x: k.lip + gap - 90, w: 12, h: 5 });
      x = k.lip + gap;
    }
    this.features.sort((a, b) => a.x - b.x);
  }

  /** The height of a feature's ramp at x (0 off it). */
  rampAt(k, x) {
    if (x < k.x || x > k.x + k.w) return 0;
    const u = (x - k.x) / k.w;
    if (k.kind === 'dune') return k.h * (1 - Math.cos(u * TAU)) / 2;
    return this.rampH(k) * u * u;
  }

  /** How tall a ramp is right now (the drawbridge rises, the wave swells and curls). */
  rampH(k) {
    if (k.kind === 'drawbridge') return k.h * (0.7 + 0.6 * ((this.t * 0.35 + k.n * 0.37) % 1));
    if (k.kind === 'wave') return k.h * (0.55 + 0.6 * (0.5 + 0.5 * Math.sin(this.t * 2 + k.n)));
    return k.h;
  }

  /** The ground's height at x (bigger is lower). */
  ground(x) {
    let y = this.base.at(x);
    for (const k of this.near(x)) if (k.lip !== undefined || k.kind === 'log') y -= k.kind === 'log' ? 0 : this.rampAt(k, x);
    return y;
  }

  slope(x) { return (this.ground(x + 1) - this.ground(x - 1)) / 2; }

  /** The features around x. */
  near(x) {
    const out = [];
    for (const k of this.features) { if (k.x > x + 2) break; if (x <= k.x + (k.w || 60) + 2) out.push(k); }
    return out;
  }

  /** The next ramp at or past x. */
  nextKicker(x) { return this.kickers.find((k) => k.lip >= x - 2) || null; }

  rail(x) { return this.features.find((k) => k.kind === 'rail' && x >= k.x && x <= k.x + k.w) || null; }
  railY(k, x) { return this.base.at(x) - k.h; }

  // ---------- input ----------
  get L() { for (const v of this.fingers.values()) if (v === 'L') return true; return false; }
  get R() { for (const v of this.fingers.values()) if (v === 'R') return true; return false; }

  /** A finger down at field x, y (playground.js sends every finger). */
  down(id, x) {
    if (this.phase === 'ready') { if (!this.locked) this.start(); return; }
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.restart(); return; }
    if (this.boostButton(x) && this.kid.state === 'air') { this.boost(this.kid); return; }
    const side = x < this.W / 2 ? 'L' : 'R';
    this.fingers.set(id, side);
    const k = this.kid;
    const a = k.state === 'air' ? k.air : null;
    if (side === 'R') {
      k.rDown = this.t;
      if (!a) return;
      // the left thumb went down a moment ago: both together is a no-hander, not a flip
      if (this.t - (k.lDown ?? -9) < TOGETHER && a.flipping) { this.together(k); return; }
      this.spin(k);
      a.spinAt = this.t;
    } else {
      k.lDown = this.t;
      if (!a) return;
      // the right thumb went down a moment ago: take back its spin, it's a no-hander
      if (this.t - (a.spinAt ?? -9) < TOGETHER) { this.together(k); return; }
      if (!a.grabMode) { a.flipping = true; a.flipTo = undefined; }
    }
  }

  /** Both thumbs pressed together in the air: a no-hander (it undoes the flip or spin it began as). */
  together(k) {
    const a = k.air;
    if (a.spinAt !== undefined && this.t - a.spinAt < TOGETHER && a.spinsQueued >= 1) {
      a.spinsQueued -= 1;
      a.spin = Math.min(a.spin, a.spinsQueued);
    }
    if (a.flipping) { a.flip = Math.max(0, a.flip - k.bike.flip * Math.max(0, this.t - (k.lDown ?? this.t))); a.flipping = false; }
    a.spinAt = undefined;
    a.grabMode = true;
  }

  up(id) {
    const side = this.fingers.get(id);
    if (!side) return;
    this.fingers.delete(id);
    const k = this.kid;
    if (side === 'L' && !this.L) this.releaseLeft(k);
    // letting go of either thumb ends a no-hander
    if (k.air && (!this.L || !this.R)) k.air.grabMode = false;
  }

  // one-finger fallbacks (mouse, tests): tap = down + up at once
  tap(x, y) { this.down('tap', x, y); }
  release() { this.up('tap'); }
  drag() {}

  /** Keyboard, for computers: A or Left is the left thumb, L or Right the right. */
  key(code, isDown) {
    const left = code === 'KeyA' || code === 'ArrowLeft' || code === 'KeyZ';
    const right = code === 'KeyL' || code === 'ArrowRight' || code === 'KeyM';
    if (code === 'KeyB' || code === 'ArrowUp') { if (isDown && this.kid.state === 'air') this.boost(this.kid); return; }
    if (!left && !right) return;
    const id = `key-${left ? 'L' : 'R'}`;
    if (isDown && !this.fingers.has(id)) this.down(id, left ? 1 : this.W - 1);
    if (!isDown) this.up(id);
  }

  boostButton(x) { return this.kidTier >= 3 && Math.abs(x - this.W / 2) < 16 && this.kid.state === 'air' && !this.kid.air.boosted; }

  start() {
    this.phase = 'play'; this.t0 = this.t;
    this.sound = 'bikeGo';
  }

  restart() {
    const keep = { book: this.book, best: Math.max(this.best, this.score) };
    Object.assign(this, { pops: [], left: GAME_SECONDS, points: { kid: 0, vis: 0 }, chain: 0, newBest: false, got: [], landed: 0, crashes: 0, bestAir: { h: 0, d: 0 }, fingers: new Map(), dust: [], sparks: [] });
    this.best = keep.best;
    this.seed += 1;
    this.event = this.r() < BIKES[this.kidTier - 1].gold ? 'golden' : this.r() < 0.4 ? 'tailwind' : null;
    this.buildTrack();
    for (const p of [this.kid, this.vis]) { p.state = 'ground'; p.air = null; p.v = 70; }
    this.kid.x = 40; this.vis.x = 14;
    for (const p of [this.kid, this.vis]) { p.y = this.ground(p.x); p.angle = 0; }
    this.camX = this.kid.x - this.W * 0.32;
    this.phase = 'ready';
  }

  // ---------- riding ----------
  releaseLeft(k) {
    if (k.state === 'air') { this.endFlip(k); if (k.air.popOpen > 0 && !k.air.popped) this.pop(k, popGrade(k.air.since)); return; }
    if (k.state !== 'ground') return;
    // a release just before the lip: the pop waits for the lip
    const kk = this.nextKicker(k.x);
    if (!kk) return;
    const tt = (kk.lip - k.x) / Math.max(20, k.vx || k.v);
    if (tt >= 0 && tt <= POP_WIN.good + 0.05) k.pending = { k: kk, grade: popGrade(tt) };
  }

  /** The left thumb lets go in the air: past half a flip, the flip finishes by itself. */
  endFlip(k) {
    const a = k.air;
    if (a.flipping) {
      const turns = a.flip / 360;
      if (turns % 1 >= FLIP_FINISH) a.flipTo = Math.ceil(turns) * 360;
      // a little past a whole flip: it pulls back to it
      else if (turns >= 1 && turns % 1 <= FLIP_BACK) a.flipTo = Math.floor(turns) * 360;
    }
    a.flipping = false;
  }

  pop(k, grade) {
    const a = k.air;
    a.popped = true;
    const v = POP_V[grade] * k.bike.pop * (this.snow === 'slushy' ? 0.95 : 1);
    k.vy -= v * (a.k?.kind === 'gold' ? 1.25 : a.k?.kind === 'glacier' ? 1.1 : 1);
    a.pop = grade;
    if (k === this.kid) {
      const word = grade === 'perfect' ? 'Perfect pop!' : grade === 'good' ? 'Good pop' : 'Hop';
      addPop(this, word, k.x - this.camX, k.y - this.camY - 30, grade === 'perfect' ? '#b2f2bb' : grade === 'good' ? '#ffe066' : '#e9ecef');
      this.sound = grade === 'perfect' ? 'bikePopBig' : 'bikePop';
      if (grade === 'perfect') this.buzz = 15;
    }
  }

  boost(k) {
    if (k.bike.tier < 3 || k.state !== 'air' || k.air.boosted) return;
    k.air.boosted = true;
    k.vy = Math.min(k.vy, 0) - 70;
    for (let i = 0; i < 10; i += 1) this.sparks.push({ x: k.x, y: k.y, vx: (this.r() - 0.5) * 60, vy: 20 + this.r() * 40, life: 0.5 });
    if (k === this.kid) { this.sound = 'bikeBoost'; addPop(this, 'Boost!', k.x - this.camX, k.y - this.camY - 34, '#ffd43b'); }
  }

  spin(k) {
    const a = k.air;
    if (!a) return;
    a.spinsQueued += 1;
    if (k === this.kid) this.sound = 'bikeWhoosh';
  }

  launch(k, kk) {
    k.state = 'air';
    // leave along the ramp's lip (or the ground just before where it dropped away)
    const onRamp = kk && kk.lip !== undefined && Math.abs(kk.lip - k.x) < 10 && kk.kind !== 'dune';
    // a dune throws you from its top, a little upward (it was rising just before)
    const s = onRamp ? (-2 * this.rampH(kk)) / kk.w + this.base.slope(kk.lip) : kk?.kind === 'dune' && Math.abs(kk.lip - k.x) < 10 ? this.slope(kk.lip - kk.w * 0.12) : this.slope(k.x - 3);
    const ang = Math.atan(s);
    k.vx = Math.cos(ang) * k.v; k.vy = Math.sin(ang) * k.v * 0.6;
    k.angle = ang * DEG;
    k.air = { ang0: k.angle, k: kk, t: 0, since: 0, x0: k.x, y0: k.y, top: k.y, flip: 0, flipping: false, spin: 0, spinsQueued: 0, grabT: 0, grabMax: 0, grabMode: false, popOpen: 0.2, popped: false, overLog: false, vent: false, rings: 0, puddle: false, boosted: false, flipBeforeGrab: false };
    // a right press just before the lip: the spin starts now
    if (k === this.kid && this.t - (k.rDown ?? -9) < SPIN_EARLY) {
      k.rDown0 = k.rDown; k.rDown = -9;
      if (this.L && this.R && Math.abs(k.rDown0 - (k.lDown ?? -9)) < TOGETHER) k.air.grabMode = true;
      else { this.spin(k); k.air.spinAt = this.t; }
    }
    if (k.pending && kk && k.pending.k === kk) this.pop(k, k.pending.grade);
    else if (kk && Math.abs(kk.lip - k.x) < 8 && k === this.kid && this.L) k.air.popOpen = 0.2; // still holding: a late release still pops
    else if (!kk || Math.abs(kk.lip - k.x) > 8) k.air.popOpen = 0;
    k.air.fromLip = Boolean(kk && Math.abs(kk.lip - k.x) < 10);
    k.pending = null;
    if (k.ai) this.aiAir(k, kk);
  }

  stepRider(k, dt) {
    if (k.state === 'crash') {
      k.crashT -= dt; k.angle += 720 * dt; k.x += k.v * 0.4 * dt; k.y = Math.min(k.y + 60 * dt, this.ground(k.x));
      if (k.crashT <= 0) { k.state = 'ground'; k.v = 55; k.angle = Math.atan(this.slope(k.x)) * DEG; k.y = this.ground(k.x); }
      return;
    }
    if (k.state === 'loop') {
      const L = k.loop;
      L.phi += (k.v / L.f.r) * dt;
      if (L.phi >= TAU) { k.state = 'ground'; k.x = L.f.x + 1; k.y = this.ground(k.x); this.loopDone(k); return; }
      const cy = L.y0 - L.f.r;
      k.x = L.f.x + Math.sin(L.phi) * L.f.r; k.y = cy + Math.cos(L.phi) * L.f.r;
      k.angle = -L.phi * DEG;
      return;
    }
    if (k.state === 'grind') {
      const g = k.grind;
      k.x += k.v * dt; g.t += dt;
      if (k.x > g.f.x + g.f.w) { this.grindDone(k, true); this.launchOff(k); return; }
      k.y = this.railY(g.f, k.x); k.angle = Math.atan(this.base.slope(k.x)) * DEG;
      if (k === this.kid && Math.floor(g.t * 4) !== Math.floor((g.t - dt) * 4)) { this.points.kid += 5; this.sparks.push({ x: k.x - 6, y: k.y, vx: -30, vy: -10, life: 0.3 }); }
      return;
    }
    if (k.state === 'ground') this.stepGround(k, dt);
    else this.stepAir(k, dt);
  }

  stepGround(k, dt) {
    const s = this.slope(k.x);
    const cos = 1 / Math.sqrt(1 + s * s);
    const top = k.bike.top * this.speedK * (this.event === 'tailwind' && this.t - this.t0 < 30 ? 1.2 : 1);
    const pedal = k.ai ? k.aiPedal : this.L && !this.R;
    k.pedal = pedal;
    const wheelie = !k.ai && this.L && this.R;
    // gravity along the slope, pedaling, and a little drag; the fjord's ice never slows you
    let acc = G * this.grav * s * cos * 0.7 + (pedal ? 80 : 0) - k.v * (this.hill.id === 'bg-fjord' ? 0.05 : 0.22);
    if (this.twist.feature === 'dune') acc += pedal && s > 0 ? 60 : !pedal && s < 0 ? 20 : pedal && s < 0 ? -40 : 0; // pump: pedal down, glide up
    k.v = clamp(k.v + acc * dt, 38, top * 1.3);
    k.vx = k.v * cos;
    const nx = k.x + k.vx * dt;
    // logs: bump into one on the ground and you wobble and slow down
    for (const f of this.near(nx)) {
      if (f.kind === 'log' && !f.hit && nx >= f.x && k.x < f.x) {
        f.hit = k === this.kid; k.v *= 0.6;
        if (k === this.kid) { addPop(this, 'Bonk! Hop the logs!', k.x - this.camX, k.y - this.camY - 30, '#ffa8a8'); this.sound = 'bikeBonk'; }
      }
      if (f.kind === 'loop' && k.x < f.x && nx >= f.x) {
        if (k.v >= 92 || k.ai) { k.state = 'loop'; k.loop = { f, phi: 0, y0: this.ground(f.x) }; return; }
        if (k === this.kid && !f.told) { f.told = true; addPop(this, 'Pedal faster for the loop!', k.x - this.camX, k.y - this.camY - 30, '#ffc9e9'); }
      }
    }
    // leave the ground where it drops away faster than the bike falls (the lip of a ramp, a dune's top)
    const gy = this.ground(nx);
    const fall = k.y + s * (nx - k.x) + 0.5 * G * this.grav * dt * dt * 3;
    k.x = nx;
    // a ramp's lip always sends you flying; elsewhere only a real drop does (not every little roll)
    const lip = this.nextKicker(k.x - 10);
    const atLip = lip && Math.abs(lip.lip - k.x) < 6;
    // or where the ground curves away faster than gravity can hold the bike to it (a dune's top)
    const dune = lip && lip.kind === 'dune' && k.x - k.vx * dt < lip.lip && k.x >= lip.lip;
    if ((atLip && gy > fall + 1.2) || dune) { this.launch(k, lip); return; }
    k.y = gy;
    const want = Math.atan(this.slope(k.x)) * DEG + (wheelie ? -20 : 0);
    k.angle += (want - k.angle) * Math.min(1, dt * 14);
    if (wheelie) {
      k.wheelieT += dt;
      if (Math.floor(k.wheelieT * 2) !== Math.floor((k.wheelieT - dt) * 2) && k.wheelieT > 0.5) { this.points.kid += 10; addPop(this, '+10', k.x - this.camX, k.y - this.camY - 26, '#e9ecef'); }
      if (k.wheelieT >= 2 && !k.wheelieCard) { k.wheelieCard = true; this.earn(k, ['wheelie'], { h: 0, d: 0, grade: 'good' }); }
    } else { k.wheelieT = 0; k.wheelieCard = false; }
    // the ramp ring sound rises as the lip comes
    if (k === this.kid) {
      const kk = this.nextKicker(k.x);
      const tt = kk ? (kk.lip - k.x) / Math.max(20, k.vx) : 9;
      if (tt < 0.5 && tt > 0 && !kk.cued) { kk.cued = true; this.sound = 'bikeRise'; }
    }
  }

  stepAir(k, dt) {
    const a = k.air;
    a.t += dt; a.since += dt;
    if (a.popOpen > 0) { a.popOpen -= dt; if (a.popOpen <= 0 && !a.popped && k === this.kid) this.pop(k, 'hop'); }
    k.vy += G * this.grav * dt;
    // geysers: flying over one while it blows lifts you
    for (const f of this.near(k.x)) {
      if (f.kind === 'vent' && this.venting(f) && k.x > f.x - 4 && k.x < f.x + f.w + 4 && this.ground(k.x) - k.y < 90) { k.vy -= 520 * dt; a.vent = true; }
      if (f.kind === 'log' && k.x >= f.x && k.x <= f.x + f.w) a.overLog = true;
      if (f.kind === 'ring' && !f.got && Math.hypot(k.x - f.x, k.y - 12 - (this.base.at(f.x) - f.up)) < f.r + 5 && k === this.kid) {
        f.got = true; a.rings += 1; this.sound = 'bikeRing'; addPop(this, 'Star ring!', k.x - this.camX, k.y - this.camY - 30, '#ffe066'); this.points.kid += 25;
      }
    }
    k.x += k.vx * dt; k.y += k.vy * dt;
    a.top = Math.min(a.top, k.y);
    // controls: both held = grab; left alone = flip; right taps = spins (they finish themselves)
    const L = k.ai ? k.aiL : this.L; const R = k.ai ? k.aiR : this.R;
    if (L && R && (k.ai || a.grabMode)) {
      a.grabT += dt; a.grabMax = Math.max(a.grabMax, a.grabT);
      if (a.flip > 300) a.flipBeforeGrab = true;
    } else {
      if (a.grabT > 0 && !(L && R)) a.grabT = Math.max(0, a.grabT - dt * 6);
      if (L && (k.ai || a.flipping)) a.flip += k.bike.flip * dt;
      else if (a.flipTo !== undefined && a.flipTo !== a.flip) {
        const step = k.bike.flip * dt;
        a.flip = a.flipTo > a.flip ? Math.min(a.flipTo, a.flip + step) : Math.max(a.flipTo, a.flip - step);
      }
    }
    if (a.spinsQueued > 0 || a.spin % 1 > 0) {
      a.spin += dt / SPIN_TIME;
      if (a.spin >= Math.floor(a.spin) && a.spinsQueued <= Math.floor(a.spin)) { if (a.spin % 1 < dt / SPIN_TIME * 1.01) a.spin = Math.floor(a.spin); }
      if (Math.floor(a.spin) >= a.spinsQueued) { a.spin = Math.min(a.spin, a.spinsQueued); }
    }
    // the landing assist: not flipping, close to the ground's angle, ease level
    const gy = this.ground(k.x);
    const gAng = Math.atan(this.slope(k.x)) * DEG;
    const raw = a.y0 !== undefined ? -a.flip : 0;
    const base = a.lean ?? a.ang0;
    a.lean = base + (gAng - base) * Math.min(1, a.t * 2.2); // the bike slowly tips to follow the hill
    let ang = a.lean + raw;
    if (!(L && (k.ai || a.flipping)) && !(a.flipTo !== undefined && a.flipTo !== a.flip)) {
      const d = fold(ang - gAng);
      if (Math.abs(d) < ASSIST) { const ease = d * Math.min(1, dt * 6); a.flip += ease; ang -= ease; }
    }
    k.angle = ang;
    // rails (good bikes have pegs): come down onto one and grind it
    const rail = k.bike.tier >= 2 && this.rail(k.x);
    if (rail && k.vy > 0 && k.y >= this.railY(rail, k.x) - 1 && k.y - k.vy * dt <= this.railY(rail, k.x) + 1) { this.land(k, this.railY(rail, k.x), Math.atan(this.base.slope(k.x)) * DEG, rail); return; }
    if (k.y >= gy && k.vy > 0) this.land(k, gy, gAng, null);
  }

  launchOff(k) {
    k.state = 'air';
    k.vx = k.v; k.vy = 0;
    k.air = { ang0: k.angle, k: null, t: 0, since: 0, x0: k.x, y0: k.y, top: k.y, flip: 0, flipping: false, spin: 0, spinsQueued: 0, grabT: 0, grabMax: 0, popOpen: 0, popped: true, rings: 0, offRail: true };
  }

  venting(f) { return ((this.t + f.at) % f.period) < 1.1; }

  land(k, gy, gAng, rail) {
    const a = k.air;
    k.y = gy;
    const flips = Math.round(a.flip / 360);
    const spins = Math.floor(a.spinsQueued);
    const spinLeft = a.spinsQueued - a.spin; // a spin still going: it finishes, a grade lower
    const grab = a.grabMax >= SUPERMAN ? 2 : a.grabMax >= GRAB_MIN ? 1 : 0;
    let grade = landGrade(fold(k.angle - gAng));
    if (spinLeft > 0.25 && grade !== 'crash') grade = grade === 'perfect' ? 'good' : 'sketchy';
    if (a.grabT > 0.05 && grade !== 'crash') grade = grade === 'perfect' ? 'good' : 'sketchy'; // still letting go of the bars
    // soft ground: sketchy counts as good; sticky (slushy) ground: a wider perfect
    if (this.snow === 'powder' && grade === 'sketchy') grade = 'good';
    if (this.snow === 'slushy' && grade === 'good' && Math.abs(fold(k.angle - gAng)) <= LAND.perfect + 8) grade = 'perfect';
    if (this.snow === 'icy' && grade === 'sketchy' && Math.abs(fold(k.angle - gAng)) > LAND.sketchy - 10) grade = 'crash';
    const h = Math.max(0, (Math.min(a.y0, this.ground(a.x0)) - a.top)) / PX_PER_M;
    const d = Math.max(0, k.x - a.x0) / PX_PER_M;
    k.state = rail ? 'grind' : 'ground';
    k.air = null;
    k.angle = gAng;
    k.v = clamp(k.v * (grade === 'perfect' ? 1.04 : grade === 'good' ? 1 : 0.8), 40, 999);
    const puddle = this.features.find((f) => f.kind === 'puddle' && k.x >= f.x && k.x <= f.x + f.w);
    this.puff(k, grade === 'crash' ? 14 : grade === 'perfect' ? 10 : 6, puddle ? '#6b4a2b' : null);
    if (rail) k.grind = { f: rail, t: 0, fromStart: k.x - rail.x < 14, flip: flips >= 1 };
    if (k.ai) { if (grade === 'crash') k.grind = null; this.aiLanded(k, flips, spins, grab, grade, h); return; }
    // a little bounce off a bump, not a jump: no trick, nothing lost
    if (!a.fromLip && !a.offRail && !rail && a.t < 0.7 && grade !== 'crash') return;
    if (grade === 'crash') {
      k.state = 'crash'; k.crashT = CRASH_TIME; k.grind = null;
      this.chain = Math.floor(this.chain / 2); this.crashes += 1;
      this.shake = 0.2; this.sound = 'bikeCrash'; this.buzz = [40, 30, 40];
      this.called = { name: 'Wipeout!', line: a.flip > 60 ? 'Too far round: let go sooner' : 'Land with your wheels flat', color: '#ffa8a8', at: this.t };
      this.chainPop();
      return;
    }
    this.stop = 0.06; this.shake = grade === 'perfect' ? 0.14 : 0.07; k.squash = 0.1;
    if (grade === 'perfect') this.ring = { x: k.x, y: k.y, at: this.t };
    this.landed += 1;
    if (h > this.bestAir.h) this.bestAir.h = h;
    if (d > this.bestAir.d) this.bestAir.d = d;
    // which cards: the combo, plus whatever this map, today's snow, a golden ramp or a rail add
    const ids = a.offRail ? [] : comboCards(flips, spins, grab);
    const kk = a.k;
    const trick = flips || spins || grab;
    if (kk?.kind === 'gold') ids.push('golden');
    if (a.overLog && !trick) ids.push('loghop');
    if (a.overLog && this.map === 'bg-meadow' && !ids.includes('loghop')) ids.push('loghop');
    if (kk?.kind === 'drawbridge' && this.rampH(kk) > kk.h * 1.1 && a.pop) ids.push('drawbridge');
    if (kk?.kind === 'wave' && a.waveHigh && a.pop !== 'hop') ids.push('waverider');
    if (kk?.kind === 'dune' && trick) { this.duneRun = (this.duneRun || 0) + 1; if (this.duneRun >= 3) ids.push('dunesurf'); } else if (kk?.kind !== 'dune') this.duneRun = 0;
    if (a.vent && trick) ids.push('geyser');
    if (puddle && grab && this.map === 'bg-rainforest') ids.push('mudskipper');
    if (d >= 25 && this.hill.id === 'bg-fjord') ids.push('icecomet');
    if (a.t >= 3 && this.hill.id === 'bg-space') ids.push('moonwalk');
    if (a.rings && trick) ids.push('starcatcher');
    if (this.snow === 'powder' && flips >= 1) ids.push('powderbomb');
    if (this.snow === 'icy' && spins >= 1) ids.push('iceskater');
    if (this.snow === 'slushy' && grab === 2) ids.push('slushsplash');
    if (rail && flips >= 1) ids.push('flipgrind');
    // points: each card's worth, the height, the landing and the chain
    this.chain = Math.min(CHAIN_MAX * 4, this.chain + 1);
    const mult = Math.min(CHAIN_MAX, 1 + 0.25 * (this.chain - 1));
    let base = 0;
    for (const id of ids) base += RARITY[TRICK[id].rarity].pts * (id === this.trickDay ? 2 : 1);
    if (!ids.length) base = 20;
    const pts = Math.round((base + h * 10) * LAND_X[grade] * mult);
    this.points.kid += pts;
    const name = trickName(flips, spins, grab);
    const color = grade === 'perfect' ? '#b2f2bb' : grade === 'good' ? '#ffe066' : '#ffc078';
    // what was landed, big in the middle under the clock
    this.called = { name: `${a.offRail ? 'Off the rail' : name}${ids.includes(this.trickDay) ? ' (trick of the day!)' : ''}`, line: `${grade === 'perfect' ? 'Stomped it!' : grade === 'good' ? 'Nice!' : 'Sketchy...'} +${pts}`, color, at: this.t };
    this.sound = grade === 'perfect' ? 'bikeStomp' : 'bikeLand';
    if (grade === 'perfect') this.buzz = 25;
    this.earn(k, ids, { h, d, grade });
    this.chainPop();
  }

  chainPop() { this.chainShown = this.t; }

  loopDone(k) {
    if (k.ai) return;
    this.points.kid += 300; this.chain = Math.min(CHAIN_MAX * 4, this.chain + 1);
    addPop(this, 'Rainbow loop! +300', k.x - this.camX, k.y - this.camY - 34, '#ffc9e9', true);
    this.sound = 'bikeStomp';
    this.earn(k, ['rainbowloop'], { h: (2 * k.loop.f.r) / PX_PER_M, d: 0, grade: 'perfect' });
  }

  grindDone(k, whole) {
    const g = k.grind;
    if (!g || k.ai) return;
    const ids = [];
    if (g.t >= 0.4) ids.push('grind');
    if (whole && g.fromStart) ids.push('longgrind');
    if (ids.length) { this.points.kid += 60 * ids.length; this.earn(k, ids, { h: 0, d: g.f.w / PX_PER_M, grade: 'good' }); addPop(this, ids.includes('longgrind') ? 'Long grind!' : 'Grind!', k.x - this.camX, k.y - this.camY - 30, '#dee2e6'); }
    k.grind = null;
  }

  /** The kid landed these cards: tell the app (trick book), and remember the new ones for the end. */
  earn(k, ids, { h, d, grade }) {
    for (const id of new Set(ids)) {
      const res = this.onTrick ? this.onTrick({ id, height: Math.round(h * 10) / 10, dist: Math.round(d * 10) / 10, grade, map: this.map }) : (this.book[id] ? null : 'first');
      const first = res === 'first' || (!this.onTrick && !this.book[id]);
      if (first) {
        this.book[id] = true;
        this.got.push({ id, first: true, h, d });
        this.banner = { id, at: this.t };
        this.sound = 'bikeCard';
      } else if (res === 'record') this.got.push({ id, record: true, h, d });
    }
  }

  puff(k, n, color) {
    const col = color || SURFACES[this.hill.surface]?.spray || '#ffffff';
    for (let i = 0; i < n; i += 1) this.dust.push({ x: k.x + (this.r() - 0.5) * 12, y: k.y - 2, vx: (this.r() - 0.4) * 60, vy: -12 - this.r() * 34, life: 0.45 + this.r() * 0.3, col });
  }

  // ---------- the visitor ----------
  aiAir(k, kk) {
    if (!kk) { k.aiL = false; k.aiR = false; return; }
    const r = this.r();
    const tier = k.bike.tier;
    const grade = r < 0.3 + 0.1 * tier ? 'perfect' : r < 0.85 ? 'good' : 'hop';
    this.pop(k, grade);
    // how long it'll be in the air, roughly, and a trick that fits
    const T = (2 * -k.vy) / (G * this.grav) + 0.15;
    const flipT = 360 / k.bike.flip;
    const plan = { flips: 0, spins: 0, grab: false };
    if (T > flipT * 2 + 0.3 && this.r() < 0.4) plan.flips = 2;
    else if (T > flipT + 0.25 && this.r() < 0.6) plan.flips = 1;
    else if (T > SPIN_TIME * 2 + 0.3 && this.r() < 0.4) plan.spins = 2;
    else if (this.r() < 0.6) plan.spins = 1;
    else plan.grab = true;
    k.plan = plan; k.aiL = false; k.aiR = false;
    k.air.spinsQueued = plan.spins;
  }

  stepAI(k) {
    // keep a bike length or two behind the kid
    const gap = this.kid.x - 30 - k.x;
    k.aiPedal = gap > 4;
    if (k.state === 'ground') k.v = clamp(k.v + gap * 0.8 * (1 / 60), 38, 200);
    if (k.state !== 'air' || !k.plan) return;
    const a = k.air; const p = k.plan;
    if (p.flips) { k.aiL = a.flip < p.flips * 360 - 25; k.aiR = false; }
    if (p.grab) { const T = a.t; k.aiL = T > 0.15 && T < 0.75; k.aiR = k.aiL; }
  }

  aiLanded(k, flips, spins, grab, grade) {
    k.plan = null; k.aiL = false; k.aiR = false;
    if (grade === 'crash') { k.state = 'crash'; k.crashT = CRASH_TIME; return; }
    const ids = comboCards(flips, spins, grab);
    let pts = 0;
    for (const id of ids) pts += RARITY[TRICK[id].rarity].pts;
    pts = Math.round(pts * LAND_X[grade] * this.visK);
    this.points.vis += pts;
    // just behind the kid's usual score, whatever its bike
    const pace = Math.max(this.best, 1500) * 0.85 * ((this.t - this.t0) / GAME_SECONDS);
    this.visK = clamp(this.visK * (this.points.vis > Math.max(pace, this.points.kid * 0.95) ? 0.9 : 1.05), 0.3, 1.2);
    if (grade === 'perfect' && this.r() < 0.5) addPop(this, 'Whoa!', k.x - this.camX, k.y - this.camY - 28, '#d0bfff');
  }

  // ---------- the clock ----------
  step(dt) {
    this.t += dt;
    if (this.stop > 0) { this.stop -= dt; return; } // hit-stop on a landing
    if (this.shake > 0) this.shake -= dt;
    const k = this.kid;
    if (this.phase === 'play') {
      this.left = Math.max(0, this.left - dt);
      for (const p of [this.kid, this.vis]) { p.paint(this.t); this.stepRider(p, dt); if (p.squash > 0) p.squash -= dt; }
      this.stepAI(this.vis);
      // the wave: remember if it was curling (high) when the kid left it
      if (k.state === 'air' && k.air.k?.kind === 'wave' && k.air.t < 0.05) k.air.waveHigh = this.rampH(k.air.k) > k.air.k.h * 0.95;
      // the clock never runs out mid-air
      if (this.left <= 0 && k.state !== 'air' && k.state !== 'loop') this.finish();
    } else {
      for (const p of [this.kid, this.vis]) p.paint(this.t);
    }
    // super bikes leave sparks
    if (k.bike.tier >= 3 && (k.state === 'air' || k.v > 100) && this.phase === 'play' && this.r() < 0.6) this.sparks.push({ x: k.x - 8, y: k.y - 4, vx: -20 - this.r() * 20, vy: (this.r() - 0.5) * 20, life: 0.35 });
    for (const list of [this.dust, this.sparks]) {
      for (const d of list) { d.x += d.vx * dt; d.y += d.vy * dt; d.vy += 80 * dt; d.life -= dt; }
      for (let i = list.length - 1; i >= 0; i -= 1) if (list[i].life <= 0) list.splice(i, 1);
    }
    // the camera: the kid a third of the way across, and up a bit higher in the air
    const tx = k.x - this.W * 0.32;
    const ty = Math.min(k.y, this.ground(k.x + 40)) - this.H * (k.state === 'air' ? 0.5 : 0.62);
    this.camX += (tx - this.camX) * Math.min(1, dt * 8);
    this.camY += (ty - this.camY) * Math.min(1, dt * 4);
  }

  finish() {
    this.phase = 'over'; this.overAt = this.t;
    this.newBest = this.score > this.best;
    if (this.newBest) this.best = this.score;
  }

  // ---------- drawing ----------
  paintSky() {
    const c = canvas(this.W * this.Z, this.H * this.Z);
    const x = c.getContext('2d');
    const [top, bottom] = this.hill.pal.sky;
    const g = x.createLinearGradient(0, 0, 0, c.height);
    g.addColorStop(0, top); g.addColorStop(1, bottom);
    x.fillStyle = g; x.fillRect(0, 0, c.width, c.height);
    if (['bg-space', 'bg-galaxy', 'bg-volcano'].includes(this.hill.id)) {
      const r = rng(5);
      for (let i = 0; i < 70; i += 1) { x.fillStyle = r() < 0.2 ? '#ffe066' : '#ffffff'; x.globalAlpha = 0.4 + r() * 0.6; x.fillRect(Math.floor(r() * c.width), Math.floor(r() * c.height * 0.7), this.Z, this.Z); }
      x.globalAlpha = 1;
    }
    return c;
  }

  draw(ctx) {
    const Z = this.Z;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.sky, 0, 0);
    const amp = this.shake > 0 ? Math.min(2, this.shake * 16) : 0;
    const sx = Math.round((this.r() - 0.5) * 2 * amp);
    const sy = Math.round((this.r() - 0.5) * 2 * amp);
    const cx = Math.round(this.camX) - sx; const cy = Math.round(this.camY) - sy;
    ctx.setTransform(Z, 0, 0, Z, 0, 0);
    this.drawFar(ctx, cx, cy);
    this.drawGround(ctx, cx, cy);
    for (const f of this.features) if (f.x + (f.w || 60) > cx - 10 && f.x < cx + this.W + 40) this.drawFeature(ctx, f, cx, cy);
    for (const d of this.dust) { const sz = d.life > 0.4 ? 3 : d.life > 0.2 ? 2 : 1; ctx.fillStyle = d.col; ctx.fillRect(Math.round(d.x - cx), Math.round(d.y - cy), sz, sz); }
    // a perfect landing: a line runs out along the ground
    if (this.ring && this.t - this.ring.at < 0.3) { const w = Math.round((this.t - this.ring.at) * 120); ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(this.ring.x - cx - w), Math.round(this.ring.y - cy), w * 2, 1); }
    // going fast: speed lines
    const kk0 = this.kid;
    if (this.phase === 'play' && (kk0.state === 'air' ? Math.hypot(kk0.vx, kk0.vy) : kk0.v) > 135) { ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff'; for (let i = 0; i < 5; i += 1) { const ly = ((i * 29 + Math.floor(this.t * 7) * 13) % (this.H - 20)) + 10; const lx = ((i * 53 - Math.floor(this.t * 400)) % this.W + this.W) % this.W; ctx.fillRect(lx, ly, 8, 1); } ctx.globalAlpha = 1; }
    for (const d of this.sparks) { ctx.globalAlpha = clamp(d.life * 3, 0, 1); ctx.fillStyle = this.r() < 0.5 ? '#ffd43b' : '#ffffff'; ctx.fillRect(Math.round(d.x - cx), Math.round(d.y - cy), 1, 1); }
    ctx.globalAlpha = 1;
    // the pop ring, closing on the next lip
    const k = this.kid;
    if (this.phase === 'play' && k.state === 'ground') {
      const kk = this.nextKicker(k.x);
      if (kk) {
        const tt = (kk.lip - k.x) / Math.max(20, k.vx);
        if (tt < 0.6 && tt > -0.05) {
          const lx = kk.lip - cx; const ly = this.ground(kk.lip - 0.5) - cy;
          const rr = 3 + tt * 40;
          const near = Math.abs(tt) <= POP_WIN.perfect;
          pixelRing(ctx, lx, ly, rr + 1, rr + 1, INK, 1);
          pixelRing(ctx, lx, ly, rr, rr, near ? '#40c057' : tt <= POP_WIN.good ? '#fcc419' : '#ffffff', 1);
          ctx.fillStyle = '#ffffff'; ctx.fillRect(lx - 1, ly - 1, 2, 2);
        }
      }
    }
    this.drawRider(ctx, this.vis, cx, cy);
    this.drawRider(ctx, this.kid, cx, cy);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawFar(ctx, cx, cy) {
    const [back, front] = this.hill.pal.far;
    const H = this.H;
    const lift = Math.round(clamp(-cy * 0.05, -20, 20)) % 20;
    this.drawLandmark(ctx, cx, lift);
    for (const [col, par, amp, len, base] of [[back, 0.15, 10, 70, 0.45], [front, 0.35, 8, 46, 0.6]]) {
      ctx.fillStyle = col;
      for (let i = 0; i < this.W; i += 1) {
        const wx = i + cx * par;
        const y = Math.round(H * base + Math.sin(wx / len) * amp + Math.sin(wx / (len * 0.37)) * amp * 0.4 + lift);
        ctx.fillRect(i, y, 1, H - y);
      }
    }
  }

  /** One far-off landmark per map, drifting slowly (a quarter of the speed), so each hill feels like its own place. */
  drawLandmark(ctx, cx, lift) {
    const W = this.W; const H = this.H; const id = this.hill.id; const t = this.t;
    const f = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    const span = W + 140;
    const lx = ((((W * 0.7 - cx * 0.25) % span) + span) % span) - 70; // repeats as you ride
    const base = H * 0.5 + lift;
    if (id === 'bg-castle') {
      f('#7c8a96', lx - 30, base - 34, 60, 34);
      for (const tx of [-34, -6, 22]) { f('#6c7a86', lx + tx, base - 48, 12, 48); for (let c = 0; c < 12; c += 4) f('#6c7a86', lx + tx + c, base - 51, 2, 3); }
      for (const [wx, wy] of [[-30, -40], [-2, -42], [26, -40], [-14, -24], [12, -24]]) f(Math.floor(t * 1.5 + wx) % 7 ? '#ffe066' : '#fff3bf', lx + wx, base + wy, 3, 4);
      f('#e03131', lx - 1, base - 60, 6, 4); f('#495057', lx - 1, base - 60, 1, 12);
    } else if (id === 'bg-volcano') {
      for (let y = 0; y < 56; y += 1) { const w = 16 + y * 1.6; f(y < 3 ? '#ff6b1a' : '#4a3530', lx - w / 2, base - 56 + y, w, 1); }
      f('#ffd43b', lx - 6, base - 57, 12, 2);
      for (let e = 0; e < 6; e += 1) { const ph = (t * 0.4 + e * 0.17) % 1; f(e % 2 ? '#ff922b' : '#ffd43b', lx - 6 + ((e * 7) % 14) + Math.sin(t * 2 + e) * 3, base - 58 - ph * 40, 1, 1); }
    } else if (id === 'bg-ocean') {
      ctx.globalAlpha = 0.18;
      for (let r = 0; r < 4; r += 1) { const rx = ((r * 61 - cx * 0.1) % (W + 40) + W + 40) % (W + 40) - 20; for (let y = 0; y < H * 0.7; y += 1) f('#e7f5ff', rx + y * 0.35, y, 4, 1); }
      ctx.globalAlpha = 1;
      f('#74c0fc', 0, 0, W, 2); f('#a5d8ff', 0, 2, W, 1);
      for (let b = 0; b < 8; b += 1) { const ph = (t * 0.25 + b * 0.13) % 1; f('#d0ebff', ((b * 37 - cx * 0.4) % W + W) % W, H * 0.8 - ph * H * 0.8, 1, 1); }
    } else if (id === 'bg-fjord') {
      for (const [ox, h, w] of [[-60, 50, 50], [-20, 66, 60], [30, 44, 46]]) {
        for (let y = 0; y < h; y += 1) { const ww = (y / h) * w; f(y < h * 0.3 ? '#ffffff' : '#8fa8bf', lx + ox - ww / 2, base - h + y, ww, 1); }
      }
    } else if (id === 'bg-space') {
      pixelRing(ctx, lx, base - 52, 11, 11, '#9775fa', 1);
      for (let y = -10; y <= 10; y += 1) { const ww = Math.sqrt(100 - y * y) * 2; f(y < -3 ? '#b197fc' : '#845ef7', lx - ww / 2, base - 52 + y, ww, 1); }
      for (let i = -20; i <= 20; i += 1) f('#ffd8a8', lx + i, base - 52 + Math.round(i * 0.18), 1, 1);
      f('#6741d9', lx - 4, base - 56, 3, 2); f('#6741d9', lx + 3, base - 49, 2, 2);
    } else if (id === 'bg-galaxy') {
      for (let i = 0; i < 70; i += 1) { const a = i * 0.32 + t * 0.15; const r = i * 0.45; f(i % 5 ? '#d0bfff' : '#ffe066', lx + Math.cos(a) * r, base - 46 + Math.sin(a) * r * 0.55, 1, 1); f('#b197fc', lx + Math.cos(a + Math.PI) * r, base - 46 + Math.sin(a + Math.PI) * r * 0.55, 1, 1); }
      f('#ffffff', lx - 1, base - 47, 3, 3);
    } else if (id === 'bg-rainbow') {
      ['#ff8787', '#ffc078', '#ffe066', '#8ce99a', '#74c0fc', '#b197fc'].forEach((col, i) => pixelRing(ctx, lx, base + 6, 54 - i * 3, 46 - i * 3, col, 2));
      f(this.hill.pal.sky[1], lx - 70, base + 6, 140, 60);
    } else if (id === 'bg-rainforest') {
      for (let v = 0; v < 7; v += 1) { const vx = ((v * 43 - cx * 0.5) % (W + 20) + W + 20) % (W + 20) - 10; const len = 10 + ((v * 13) % 18); for (let y = 0; y < len; y += 1) f(y % 4 === 3 ? '#69db7c' : '#2b8a3e', vx + Math.sin(y / 3 + v) , y, 1, 1); }
    } else if (id === 'bg-sunset') {
      for (let y = -12; y <= 12; y += 1) { const ww = Math.sqrt(144 - y * y) * 2; f(y < 4 ? '#ffd43b' : '#ffa94d', lx - ww / 2, base - 40 + y, ww, 1); }
    } else {
      // the meadow: a big old oak on a far hill
      f('#8b5a2b', lx - 2, base - 30, 4, 30); f('#2f7d32', lx - 14, base - 44, 28, 16); f('#40a046', lx - 10, base - 48, 20, 6);
    }
  }

  drawGround(ctx, cx, cy) {
    const [edge, fill, deep] = this.hill.pal.ground;
    const snow = this.snow;
    for (let i = 0; i < this.W; i += 1) {
      const wx = i + cx;
      const y = Math.round(this.base.at(wx) - cy);
      if (y >= this.H) continue;
      ctx.fillStyle = deep; ctx.fillRect(i, y, 1, this.H - y);
      ctx.fillStyle = fill; ctx.fillRect(i, y, 1, Math.min(this.H - y, 12 + ((wx * 7) % 5)));
      ctx.fillStyle = edge; ctx.fillRect(i, y, 1, 2);
      // today's snow kind on the ground: icy shines, powder piles up, slush puddles
      const hsh = (wx * 2654435761) >>> 0;
      if (snow === 'icy' && hsh % 9 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(i, y, 1, 1); }
      if (snow === 'powder' && hsh % 5 < 2) { ctx.fillStyle = this.hill.snowy ? '#ffffff' : edge; ctx.fillRect(i, y - 1, 1, 1); }
      if (snow === 'slushy' && hsh % 7 === 0) { ctx.fillStyle = 'rgba(116,192,252,0.6)'; ctx.fillRect(i, y + 1, 1, 2); }
      if ((wx % 23) === 0 && hsh % 3 === 0) { ctx.fillStyle = deep; ctx.fillRect(i, y + 5, 2, 1); }
    }
    // props along the hill behind the riders
    const [p1, p2, p3] = this.hill.pal.props;
    for (let wx = Math.floor(cx / 60) * 60; wx < cx + this.W + 60; wx += 60) {
      const h = (wx * 2246822519) >>> 0;
      if (h % 3 === 0) continue;
      const px = wx + (h % 30) - cx;
      const py = Math.round(this.base.at(wx + (h % 30)) - cy);
      this.drawProp(ctx, this.hill.props[h % this.hill.props.length], px, py, p1, p2, p3);
    }
  }

  drawProp(ctx, kind, x, y, a, b, c) {
    const f = (col, i, j, w, h) => { ctx.fillStyle = col; ctx.fillRect(x + i, y + j, w, h); };
    const ink = (w) => f(INK, -Math.ceil(w / 2), 0, w, 1);
    if (kind === 'fern') {
      for (const [dx, h] of [[-5, 7], [-2, 10], [1, 11], [4, 8]]) { f(INK, dx - 1, -h - 1, 3, h + 1); f('#2f9e44', dx, -h, 1, h); f('#69db7c', dx, -h, 1, 2); }
      ink(10);
      return;
    }
    if (['pine', 'spruce', 'oak', 'palm', 'kapok', 'bush'].includes(kind)) {
      f(INK, -2, -12, 4, 12); f(c, -1, -12, 2, 12);
      if (kind === 'palm') { f(INK, -11, -17, 22, 4); f(a, -10, -16, 20, 2); f(b, -7, -18, 14, 2); f('#8d6e63', -2, -14, 4, 2); }
      else if (kind === 'pine' || kind === 'spruce') { for (let j = 0; j < 5; j += 1) { f(INK, -9 + j * 1.5 - 1, -13 - j * 4, 18 - j * 3 + 2, 5); f(j % 2 ? b : a, -9 + j * 1.5, -13 - j * 4, 18 - j * 3, 4); } }
      else { f(INK, -10, -27, 20, 15); f(a, -9, -26, 18, 13); f(b, -6, -28, 12, 3); f(b, -8, -18, 6, 3); }
      ink(8);
      return;
    }
    if (['crystal', 'iceblock', 'star'].includes(kind)) { f(INK, -4, -13, 8, 13); f(a, -3, -12, 6, 12); f(b, -1, -15, 2, 3); f('#ffffff', -2, -10, 1, 4); ink(10); return; }
    if (['coral', 'anemone', 'kelp'].includes(kind)) { f(a, -6, -10, 3, 10); f(b, -1, -16, 3, 16); f(a, 4, -9, 3, 9); f(b, -6, -12, 3, 2); ink(14); return; }
    if (['cloud', 'cloudpuff'].includes(kind)) { f('#ffffff', -10, -30, 20, 6); f('#ffffff', -5, -33, 10, 3); f('#e7f5ff', -10, -25, 20, 1); return; }
    if (kind === 'lollipop') { f('#ffffff', 0, -18, 2, 18); f(INK, -5, -27, 11, 11); f(a, -4, -26, 9, 9); f('#ffffff', -2, -24, 2, 2); ink(6); return; }
    if (kind === 'mushroom') { f('#ffffff', -2, -7, 4, 7); f(INK, -8, -13, 16, 7); f(a, -7, -12, 14, 5); f('#ffffff', -4, -11, 2, 2); f('#ffffff', 2, -10, 2, 2); ink(8); return; }
    if (['planet', 'comet'].includes(kind)) { f(a, -4, -40, 8, 8); f(b, -7, -36, 14, 1); return; }
    if (['banner', 'flag'].includes(kind)) { f(INK, -1, -22, 2, 22); f(a, 1, -22, 9, 6); f(b, 1, -16, 9, 1); ink(6); return; }
    if (['wall'].includes(kind)) { f(INK, -11, -11, 22, 11); f(a, -10, -10, 20, 10); f(b, -10, -13, 5, 3); f(b, 5, -13, 5, 3); for (let i = -8; i < 10; i += 6) f(b, i, -6, 3, 1); return; }
    if (kind === 'steam') { ctx.globalAlpha = 0.5; f('#ffffff', -2, -18 - Math.floor(this.t * 6) % 3, 4, 14); ctx.globalAlpha = 1; f(INK, -4, -2, 8, 2); return; }
    if (kind === 'dish') { f(INK, -1, -10, 2, 10); f('#dee2e6', -6, -14, 12, 4); f('#adb5bd', -5, -11, 10, 1); ink(6); return; }
    if (kind === 'hay') { f(INK, -7, -9, 14, 9); f('#fcc419', -6, -8, 12, 8); f('#e67700', -6, -5, 12, 1); return; }
    // rocks, shells and the like
    f(INK, -6, -6, 12, 6); f(b, -5, -5, 10, 5); f(a, -3, -6, 6, 1); f('#ffffff', -3, -4, 1, 1);
  }

  drawFeature(ctx, f, cx, cy) {
    const fill = (col, x, y, w, h) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    if (f.lip !== undefined) {
      // a ramp: wood, or what the map makes them of
      const look = f.kind === 'gold' ? ['#ffe066', '#fab005', '#e67700'] : f.kind === 'dune' ? null : f.kind === 'glacier' ? ['#ffffff', '#a5d8ff', '#4dabf7'] : f.kind === 'wave' ? ['#e7f5ff', '#4dabf7', '#1971c2'] : f.kind === 'drawbridge' ? ['#c98a4b', '#8b5a2b', '#5c3a1e'] : this.rampLook();
      if (!look) { // a dune: the ground, with a pale crest and a little flag on top
        for (let x = Math.floor(f.x + f.w * 0.3); x <= f.x + f.w * 0.7; x += 1) fill('#fff3bf', x - cx, this.ground(x) - cy, 1, 2);
        const ty = this.ground(f.lip) - cy;
        fill(INK, f.lip - cx, ty - 10, 1, 10); if (Math.floor(this.t * 4) % 2) fill('#e03131', f.lip - cx + 1, ty - 10, 4, 3);
        return;
      }
      for (let x = Math.floor(f.x); x <= f.x + f.w; x += 1) {
        const top = this.ground(x) - cy; const bot = this.base.at(x) - cy;
        if (bot - top < 0.5) continue;
        fill(look[1], x - cx, top, 1, Math.max(1, bot - top));
        if ((x - f.x) % 6 === 0 && f.kind !== 'wave') fill(look[2], x - cx, top + 2, 1, Math.max(0, bot - top - 2));
        fill(INK, x - cx, top - 1, 1, 1); fill(look[0], x - cx, top, 1, 1);
      }
      const lt = this.ground(f.lip - 0.5) - cy; const lb = this.base.at(f.lip) - cy;
      fill(INK, f.lip - cx, lt - 1, 2, Math.max(1, lb - lt + 1));
      // a blinking arrow over the lip, so you see it coming
      if (Math.floor(this.t * 4) % 2 && f.kind !== 'wave') { const ax = f.lip - cx - 1; const ay = lt - 9; fill(INK, ax - 2, ay - 1, 7, 5); fill('#ffd43b', ax - 1, ay, 5, 1); fill('#ffd43b', ax, ay + 1, 3, 1); fill('#ffd43b', ax + 1, ay + 2, 1, 1); }
      if (f.kind === 'wave') { const hh = this.rampH(f) / f.h; if (hh > 0.95) { fill('#ffffff', f.lip - cx - 3, lt - 2, 4, 2); fill('#ffffff', f.lip - cx, lt - 1, 2, 3); } }
      if (f.kind === 'drawbridge') { fill('#495057', f.lip - cx, lt - 10, 1, 10); fill('#495057', f.lip - cx - 1, lt - 10, 3, 1); }
      if (f.kind === 'gold' && Math.floor(this.t * 6) % 2) fill('#ffffff', f.lip - cx - 2, lt - 1, 2, 1);
      // the finale flags
      return;
    }
    const gy = this.base.at(f.x) - cy;
    if (f.kind === 'log') { fill('#5c3a1e', f.x - cx, gy - f.h, f.w, f.h); fill('#8b5a2b', f.x - cx, gy - f.h, f.w, 2); fill('#c98a4b', f.x - cx + f.w - 2, gy - f.h + 1, 2, f.h - 2); }
    if (f.kind === 'puddle') { for (let x = 0; x < f.w; x += 1) fill(x % 7 === 3 ? '#8b6a4b' : '#6b4a2b', f.x + x - cx, this.base.at(f.x + x) - cy, 1, 2); }
    if (f.kind === 'vent') {
      fill('#212529', f.x - cx, gy - 2, f.w, 3); fill('#ff6b1a', f.x - cx + 3, gy - 1, f.w - 6, 1);
      if (this.venting(f)) {
        const ph = ((this.t + f.at) % f.period) / 1.1;
        const top = 70 * Math.min(1, ph * 3);
        for (let j = 0; j < top; j += 2) { ctx.globalAlpha = 0.25 + 0.4 * (1 - j / 70); fill('#ffffff', f.x - cx + 2 + Math.sin(j * 0.3 + this.t * 9) * 2, gy - j - 3, f.w - 4, 2); }
        ctx.globalAlpha = 1;
      } else if (((this.t + f.at) % f.period) > f.period - 0.6) fill('rgba(255,255,255,0.5)', f.x - cx + 4, gy - 5 - Math.floor(this.t * 20) % 3, 4, 2);
    }
    if (f.kind === 'ring') {
      const ry = this.base.at(f.x) - f.up - cy;
      if (!f.got) pixelRing(ctx, f.x - cx, ry, f.r * 0.5 + 1, f.r + 1, INK, 1);
      pixelRing(ctx, f.x - cx, ry, f.r * 0.5, f.r, f.got ? 'rgba(255,224,102,0.35)' : '#ffd43b', 1);
      if (!f.got && Math.floor(this.t * 4) % 2) fill('#ffffff', f.x - cx, ry - f.r - 1, 1, 1);
    }
    if (f.kind === 'rail') {
      for (let x = 0; x <= f.w; x += 1) { const y = this.railY(f, f.x + x) - cy; fill('#ced4da', f.x + x - cx, y, 1, 1); fill('#868e96', f.x + x - cx, y + 1, 1, 1); if (x % 22 === 0) fill('#495057', f.x + x - cx, y + 2, 1, f.h - 2); }
    }
    if (f.kind === 'loop') {
      const r = f.r; const by = this.ground(f.x) - cy;
      const cols = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
      pixelRing(ctx, f.x - cx, by - r, r, r, INK, 1);
      cols.forEach((col, i) => pixelRing(ctx, f.x - cx, by - r, r + 1 + i * 2, r + 1 + i * 2, col, 2));
      pixelRing(ctx, f.x - cx, by - r, r + 13, r + 13, INK, 1);
    }
  }

  rampLook() {
    switch (this.hill.surface) {
      case 'sand': return ['#ffe8a3', '#e9c46a', '#c9965a'];
      case 'glacier': case 'snow': return ['#ffffff', '#d0ebff', '#a5d8ff'];
      case 'ash': return ['#868e96', '#495057', '#ff6b1a'];
      case 'dust': return ['#e9ecef', '#adb5bd', '#868e96'];
      case 'rainbow': return ['#ffffff', '#ff8cc6', '#c77dff'];
      case 'stardust': return ['#fff3bf', '#ffd43b', '#f08c00'];
      case 'seafloor': return ['#ffa94d', '#f06595', '#c2255c'];
      case 'mud': return ['#c98a4b', '#8b5a2b', '#5c3a1e'];
      default: return ['#e0b07a', '#b07a45', '#7a4f26'];
    }
  }

  /** A rider: the sprite turned by the bike's angle (in steps, so the pixels stay crisp), squished for a spin. */
  drawRider(ctx, k, cx, cy) {
    const x = k.x - cx; const y = k.y - cy;
    const gy = this.ground(k.x) - cy;
    const up = gy - y;
    if (up < 90) { const w = Math.round(clamp(14 - up / 6, 4, 14)); ctx.fillStyle = 'rgba(20,20,40,0.25)'; ctx.fillRect(Math.round(x - w / 2), Math.round(gy), w, 1); }
    const a = k.air;
    const spin = a ? a.spin % 1 : 0;
    const steps = 16;
    const ang = Math.round((k.angle / 360) * steps) * (TAU / steps);
    const sxk = spin ? Math.cos(spin * TAU) : 1;
    const sx = Math.abs(sxk) < 0.45 ? 0.45 * Math.sign(sxk || 1) : sxk;
    // the super bike leaves a gold afterimage in the air
    if (k.bike.tier >= 3 && k.state === 'air') {
      k.ghosts = (k.ghosts || []).concat([[x + cx, y + cy, ang, sx]]).slice(-4);
      k.ghosts.slice(0, 3).forEach(([gx, gyy, ga, gs], i) => {
        ctx.save(); ctx.globalAlpha = 0.12 + i * 0.08; ctx.translate(Math.round(gx - cx - 4 * (3 - i)), Math.round(gyy - cy) - 6); ctx.rotate(ga); ctx.scale(gs, 1);
        ctx.drawImage(k.sprite, -18, -30); ctx.restore();
      });
      ctx.globalAlpha = 1;
    } else k.ghosts = [];
    ctx.save();
    ctx.translate(Math.round(x), Math.round(y) - 6);
    ctx.rotate(ang);
    ctx.scale(sx, k.squash > 0 ? 0.85 : 1);
    if (k.state === 'grind') ctx.translate(0, 1);
    ctx.drawImage(k.sprite, -18, -30 + (k.squash > 0 ? 1 : 0));
    ctx.restore();
    // a spin: two white swooshes either side
    if (spin > 0.05 && spin < 0.95) {
      ctx.fillStyle = '#ffffff';
      const ph = Math.sin(spin * TAU) > 0 ? 1 : -1;
      for (const side of [-1, 1]) { const sx0 = Math.round(x + side * 15); const sy0 = Math.round(y - 18); ctx.fillRect(sx0, sy0 + ph * side, 1, 3); ctx.fillRect(sx0 - side, sy0 - 1 + ph * side, 1, 1); ctx.fillRect(sx0 - side, sy0 + 3 + ph * side, 1, 1); }
    }
  }

  drawHud(ctx, scale) {
    const S = scale; const W = this.W * S;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff', align = 'center') => {
      ctx.textAlign = align;
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = INK;
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
      ctx.textAlign = 'center';
    };
    const u = S * 4;
    if (this.phase === 'over' && this.t - this.overAt > 0.3) { this.drawEnd(ctx, S, u, text); return; }
    const secs = Math.ceil(this.left);
    text(`${this.score}`, W / 2, u * 2.4, u * 3.4, '#ffd43b');
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 5.1, u * 1.6, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#e9ecef');
    const mult = Math.min(CHAIN_MAX, 1 + 0.25 * Math.max(0, this.chain - 1));
    if (this.chain > 1) text(`Chain x${mult.toFixed(2).replace(/\.?0+$/, '')}`, W / 2, u * 6.8, u * 1.4, mult >= CHAIN_MAX ? '#ff922b' : '#ffe066');
    // below the title bar: today's ground and trick on the left, the visitor's points on the right
    text(`${this.snowName.emoji} ${this.snowName.name}`, u, u * 4.2, u * 1.3, '#e9ecef', 'left');
    text(`Trick of the day: ${TRICK[this.trickDay].name} x2`, u, u * 5.6, u * 1.2, '#ffe066', 'left');
    text(`${this.vis.name} ${this.points.vis}`, W - u, u * 4.2, u * 1.3, '#d0bfff', 'right');
    if (this.event === 'tailwind' && this.phase === 'play' && this.t - this.t0 < 30) text('🌬️ Tailwind!', W - u, u * 5.6, u * 1.2, '#a5d8ff', 'right');
    if (this.called && this.t - this.called.at < 1.4 && this.phase === 'play') {
      const age = this.t - this.called.at;
      ctx.globalAlpha = Math.min(1, (1.4 - age) * 4);
      const pop = 1 + Math.max(0, 0.25 - age) * 1.2;
      text(this.called.name, W / 2, u * 8.6, u * 2.4 * pop, '#ffffff');
      text(this.called.line, W / 2, u * 10.6, u * 1.7, this.called.color);
      ctx.globalAlpha = 1;
    }
    // a new card: it pops up on the right for a moment
    if (this.banner && this.t - this.banner.at < 1.8 && this.phase === 'play') {
      const age = this.t - this.banner.at;
      const cw = u * 7.2; const ch = u * 9.6;
      const sc = Math.min(1, age * 6);
      ctx.save(); ctx.translate(W - u * 5.5, u * 7.5 + ch / 2); ctx.scale(sc, sc);
      ctx.globalAlpha = Math.min(1, (1.8 - age) * 3);
      drawCard(ctx, TRICK[this.banner.id], -cw / 2, -ch / 2, cw, ch, S, { first: true, sprite: this.kid.sprite, hill: this.hill });
      ctx.restore(); ctx.globalAlpha = 1;
      text('NEW!', W - u * 5.5, u * 7.5 + ch + u * 1.2, u * 1.6, RARITY[TRICK[this.banner.id].rarity].color);
    }

    // the super bike's boost
    if (this.phase === 'play' && this.boostButton(this.W / 2)) {
      const bx = W / 2; const by = (this.H - 12) * S;
      ctx.fillStyle = 'rgba(255,212,59,0.9)'; ctx.beginPath(); ctx.arc(bx, by, u * 2.6, 0, TAU); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = S; ctx.stroke();
      text('BOOST', bx, by, u * 1.3, '#ffffff');
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.2;
      if (age > 1) continue;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x * S, u * 8, W - u * 8), Math.max(u * 8, (p.y - age * 10) * S), u * (p.big ? 2.2 : 1.6), p.color);
      ctx.globalAlpha = 1;
    }
    const hint = (s, y = (this.H - 5) * S) => text(s, W / 2, y, u * 1.5, '#ffffff');
    if (this.phase === 'play' && this.t - this.t0 < 6) {
      text('LEFT: hold to pedal, let go to jump, hold in the air to flip', u, (this.H - 9) * S, u * 1.2, '#ffffff', 'left');
      text('RIGHT: tap to spin · BOTH at once: no-hander', W - u, (this.H - 4) * S, u * 1.2, '#ffffff', 'right');
    } else if (this.phase === 'play' && this.t - this.t0 < 10) hint(this.event === 'golden' ? '✨ A golden ramp is on the hill today!' : this.twist.say);
    else if (this.phase === 'play' && this.t - this.t0 < 14 && this.event === 'golden') hint(this.twist.say);
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) hint(this.locked ? "That's all our games today!" : 'Tap to ride!', (this.H - 7) * S);
    if (this.phase === 'ready') text(this.hill.name, W / 2, u * 9, u * 2.4, '#ffffff');
  }

  /** Time's up: the score, then the new cards flip in one at a time. */
  drawEnd(ctx, S, u, text) {
    const W = this.W * S; const H = this.H * S;
    ctx.fillStyle = 'rgba(27,20,48,0.88)';
    const bw = Math.min(W * 0.92, u * 56); const bh = Math.min(H * 0.8, u * 26);
    const bx = W / 2 - bw / 2; const by = Math.max(u, (H - bh) / 2);
    ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(bx, by, bw, bh);
    text(`Time's up! ${this.score} points`, W / 2, by + u * 2.4, u * 2.6, '#ffd43b');
    text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, by + u * 4.6, u * 1.6, this.newBest ? '#b2f2bb' : '#e9ecef');
    const hm = this.bestAir.h; const dm = this.bestAir.d;
    text(`${this.landed} landed · highest ${hm.toFixed(1)} m (${likeA(hm, HEIGHTS)}) · longest ${dm.toFixed(1)} m (${likeA(dm, LENGTHS)})`, W / 2, by + u * 6.4, u * 1.2, '#e9ecef');
    const cards = this.got.filter((g) => g.first || g.record);
    if (!cards.length) text('No new trick cards this time. Try a new trick!', W / 2, by + u * 12, u * 1.4, '#e9ecef');
    const shown = Math.min(cards.length, Math.floor((this.t - this.overAt - 0.5) / 0.45) + 1);
    const cw = u * 7.4; const ch = u * 10; const gap = u * 0.9;
    const perRow = Math.max(1, Math.floor((bw - u * 2) / (cw + gap)));
    cards.slice(0, Math.min(shown, perRow * 1)).forEach((g, i) => {
      const n = Math.min(cards.length, perRow);
      const x0 = W / 2 - (n * (cw + gap) - gap) / 2 + i * (cw + gap);
      const y0 = by + u * 8;
      const age = this.t - this.overAt - 0.5 - i * 0.45;
      const flip = clamp(age / 0.3, 0, 1);
      ctx.save();
      ctx.translate(x0 + cw / 2, y0 + ch / 2);
      ctx.scale(Math.max(0.05, flip), 1);
      drawCard(ctx, TRICK[g.id], -cw / 2, -ch / 2, cw, ch, S, { first: g.first, h: g.h, d: g.d, sprite: this.kid.sprite, hill: this.hill, t: this.t });
      ctx.restore();
    });
    if (cards.length > perRow) text(`+${cards.length - perRow} more in your trick book`, W / 2, by + bh - u * 3, u * 1.2, '#e9ecef');
    if (this.t - this.overAt > 1.2) text('Tap to ride again', W / 2, by + bh - u * 1.3, u * 1.4, '#ffffff');
  }
}

/** A trick card at x, y (w x h, sharp canvas pixels): rarity border, the trick's picture over its map's sky, name and record.
 * info: { first, h, d, sprite: the kid's rider (so the card shows their own buddy), hill: hillFor() for the sky, t: time for the shine } */
export function drawCard(ctx, trick, x, y, w, h, S, info = {}) {
  const rar = RARITY[trick.rarity];
  ctx.fillStyle = INK; ctx.fillRect(x - S * 0.5, y - S * 0.5, w + S, h + S);
  ctx.fillStyle = '#fff9db'; ctx.fillRect(x, y, w, h);
  // the picture window: the map's sky
  const px = x + S * 2; const py = y + S * 2; const pw = w - S * 4; const ph = h - S * 15;
  const sky = trick.map ? hillFor(trick.map).pal.sky : info.hill?.pal.sky || ['#7cc7ff', '#d0ecff'];
  const g = ctx.createLinearGradient(0, py, 0, py + ph);
  g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]);
  ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
  const pic = trickPic(trick, info.sprite);
  ctx.imageSmoothingEnabled = false;
  const ps = Math.max(1, Math.min(pw / pic.width, ph / pic.height));
  ctx.drawImage(pic, px + pw / 2 - (pic.width * ps) / 2, py + ph - pic.height * ps, pic.width * ps, pic.height * ps);
  ctx.strokeStyle = rar.color; ctx.lineWidth = S * (trick.rarity === 'legend' ? 2 : 1.4); ctx.strokeRect(x + S * 0.7, y + S * 0.7, w - S * 1.4, h - S * 1.4);
  // legendary and map cards shine: a white stripe slides across
  if ((trick.rarity === 'legend' || trick.map) && info.t !== undefined) {
    const sx = px + ((info.t * 0.6) % 1.6) * pw * 1.2 - pw * 0.4;
    ctx.save(); ctx.beginPath(); ctx.rect(px, py, pw, ph); ctx.clip();
    ctx.globalAlpha = 0.35; ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(sx, py); ctx.lineTo(sx + S * 4, py); ctx.lineTo(sx - S * 4, py + ph); ctx.lineTo(sx - S * 8, py + ph); ctx.fill();
    ctx.restore(); ctx.globalAlpha = 1;
  }
  ctx.fillStyle = rar.color; ctx.fillRect(x, y + h - S * 8, w, S * 8);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.font = `${Math.round(S * 4.2)}px "Jersey 10", monospace`;
  ctx.fillStyle = INK;
  ctx.fillText(trick.name, x + w / 2, y + h - S * 11, w - S * 2);
  ctx.font = `${Math.round(S * 3.4)}px "Jersey 10", monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(info.first ? `NEW! ${rar.name}` : info.h ? `Record ${info.h.toFixed(1)} m` : rar.name, x + w / 2, y + h - S * 4, w - S * 2);
}

/** Pixel art of a trick, 40 x 30: the rider (the kid's own, or a plain bike) caught mid-trick, with ghosts, swooshes and sparkles. */
export function trickPic(trick, sprite) {
  const W = 40; const H = 30;
  const c = canvas(W, H);
  const x = c.getContext('2d');
  x.imageSmoothingEnabled = false;
  const rider = sprite || (() => { const s = canvas(36, 36); s.getContext('2d').drawImage(bikePic(trick.rarity === 'legend' ? 3 : trick.rarity === 'rare' ? 2 : 1), 5, 20); return s; })();
  const [flips, spins, grab] = (trick.combo || '0-0-0').split('-').map(Number);
  // the map's ground along the bottom
  const hill = trick.map ? hillFor(trick.map) : null;
  const gcol = hill ? hill.pal.ground : ['#69db7c', '#40a046', '#2b7a30'];
  x.fillStyle = gcol[1]; x.fillRect(0, H - 4, W, 4); x.fillStyle = gcol[0]; x.fillRect(0, H - 4, W, 1);
  const put = (dx, dy, rot, sx = 1, alpha = 1) => {
    x.save(); x.globalAlpha = alpha; x.translate(dx, dy); x.rotate(rot); x.scale(sx, 1); x.drawImage(rider, -18, -26); x.restore();
  };
  if (flips) {
    // ghosts on an arc, turning over backwards
    put(10, 20, 0, 1, 0.3); put(20, 14, -2.1, 1, 0.55); put(30, 20, -4.2, 1, 1);
    x.fillStyle = '#ffffff'; for (let i = 0; i < 9; i += 1) x.fillRect(Math.round(20 + Math.cos(Math.PI + i * 0.35) * 14), Math.round(18 + Math.sin(Math.PI + i * 0.35) * 10), 1, 1);
  } else if (spins) {
    put(9, 22, 0, 1, 0.35); put(20, 21, 0, 0.5, 0.6); put(31, 22, 0, -1, 1);
    x.fillStyle = '#ffffff'; for (let i = 0; i < 12; i += 1) x.fillRect(14 + i, Math.round(6 + Math.sin(i / 3.5) * 2), 1, 1); x.fillRect(26, 5, 1, 3);
  } else {
    put(20, 22, trick.id === 'wheelie' ? -0.4 : 0, 1, 1);
  }
  if (grab) { x.fillStyle = '#ffe066'; for (const [sx, sy] of [[8, 4], [32, 6]]) { x.fillRect(sx - 2, sy, 5, 1); x.fillRect(sx, sy - 2, 1, 5); } }
  // the special bits
  const f = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  switch (trick.id) {
    case 'loghop': f('#5c3a1e', 14, H - 9, 12, 5); f('#c98a4b', 24, H - 8, 2, 3); break;
    case 'geyser': x.globalAlpha = 0.6; f('#ffffff', 4, 4, 6, H - 8); x.globalAlpha = 1; f(INK, 3, H - 5, 8, 2); break;
    case 'waverider': f('#4dabf7', 0, H - 10, 16, 6); f('#ffffff', 12, H - 12, 5, 2); break;
    case 'mudskipper': f('#6b4a2b', 10, H - 4, 20, 2); break;
    case 'starcatcher': pixelRing(x, 30, 10, 3, 6, '#ffd43b', 1); break;
    case 'rainbowloop': ['#ff8787', '#ffe066', '#74c0fc'].forEach((col, i) => pixelRing(x, 20, 14, 13 - i, 13 - i, col, 1)); break;
    case 'drawbridge': f('#8b5a2b', 0, H - 10, 12, 6); f('#495057', 11, H - 18, 1, 14); break;
    case 'grind': case 'longgrind': case 'flipgrind': f('#ced4da', 2, H - 6, 36, 1); f('#495057', 6, H - 5, 1, 2); f('#495057', 32, H - 5, 1, 2); break;
    case 'golden': f('#fab005', 0, H - 12, 14, 8); f('#ffe066', 0, H - 12, 14, 1); break;
    case 'moonwalk': f('#e9ecef', 30, 3, 6, 6); f('#adb5bd', 31, 5, 2, 2); break;
    default: break;
  }
  if (trick.snow) { x.fillStyle = '#ffffff'; for (let i = 0; i < 10; i += 1) x.fillRect((i * 11) % W, (i * 7) % (H - 6), 1, 1); }
  return c;
}
