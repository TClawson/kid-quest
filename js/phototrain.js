// The photo train: a 90 second ride through the kid's map with a camera (Taylor, 2026-11-21).
//
// A side view. The kid's buddy and the visitor ride in an open car of a little train that
// chugs to the right; the map slides past in layers (far hills slowly, the middle ground
// where most animals live, the track fast, and now and then a bush right in front).
//
// Animals show themselves after a SIGN: a rustling bush, ripples, a twitching tail, a call.
// Then each one stops and looks at the camera for a moment (its POSE, with a little sparkle)
// before it goes again. Some animals are movers instead: birds flying over, a fox running
// beside the train.
//
// Snapping (Taylor, 2026-11-20: a shutter button, after letting go to snap confused): touch the
// screen to aim: the camera comes up, and the viewfinder sits a little ABOVE the finger so the
// finger doesn't hide the animal. Hold still and a focus ring closes in; when it is sharp it
// shows SHARP. It does NOT lock on or follow anything (Taylor, 2026-11-20: too easy):
// keeping the animal in the frame is the kid's job. The frame sticks to the spot of scenery
// that was touched and rides along with it (even after the finger lifts), so aim where the
// animal will come out. Tap the shutter button (bottom right) to snap.
// Dragging moves the viewfinder yourself (for fliers and runners, or to pick another animal),
// and touching somewhere else aims there.
//
// Every photo gets three ticks: Sharp, Posed and Centred. All three: PERFECT. Sharp: GOOD.
// Not sharp: a blurry glimpse, no points and not for the album. The film is limited, so
// pick your shots. Points: the animal's rarity times 1 (good) or 2 (perfect), only the best
// photo of each animal counts in a ride, the day's Wanted animal counts double, and a new
// animal for the album adds a bonus.
//
// The ride has three acts: calm at first, busy in the middle, and a finale where rare
// animals are likeliest. Set pieces: an animal standing on the track (the train stops and
// it poses a long time), and a dark tunnel with glowing eyes (a snap's flash lights up bats).
// Clues (tracks, a feather) for the map's legend can be photographed too: three clues and
// the legend comes in the next ride's finale.
//
// Cameras (gems 40 / 120 / 300): focus 0.6 / 0.5 / 0.4 s, film 12 / 14 / 16. The Good camera
// adds a zoom lens that reaches animals on the far hills (without it they are specks, "too
// far!"). The Super camera adds a telephoto view (a tighter frame, so close-ups come easy),
// a quiet shutter (animals hold their pose 0.4 s longer) and rare animals 75% more often.
//
// Same interface as Play in play.js (tap, drag, release, step, draw, drawHud, score, phase).
import { Player, rng, canvas, clamp, HAPPY } from './play.js';
import { critterPic } from './critterart.js';
import {
  oddsFor, pickWeighted, critterById, mapCritters, inSeason, weatherOf, wantedOf, RARITIES, QUALITY, qualityOf,
  slotsOf, photoPoints, NEW_BONUS, WEATHERS,
} from './critters.js';
import { addPop } from './meter.js';
import { mix, ramp, h2 } from './pixelkit.js';
import { seasonOf } from './seasons.js';

export const GAME_SECONDS = 90;
/** Each camera: focus time, film, zoom lens (far hills), telephoto (tighter frame), pose held longer. */
export const CAMERAS = [
  { tier: 1, focus: 0.6, film: 15, zoom: false, tele: false, posePlus: 0 },
  { tier: 2, focus: 0.5, film: 17, zoom: true, tele: false, posePlus: 0 },
  { tier: 3, focus: 0.4, film: 19, zoom: true, tele: true, posePlus: 0.4 },
];
export const cameraFor = (tier) => CAMERAS[clamp(tier || 1, 1, 3) - 1];
/** The viewfinder, in game pixels (the telephoto frames tighter). */
export const FRAME = { w: 48, h: 36 };
export const TELE_FRAME = { w: 40, h: 30 };
/** How far above the finger the viewfinder sits, in game pixels. */
export const LIFT = 22;
/** Track speed in game pixels a second, and how fast each layer moves with it. */
export const SPEED = 60;
export const LAYER = { far: 0.1, mid: 0.35, track: 1, fore: 1.6 };
/** A quick tap (shorter than this) doesn't snap: it reminds the kid to hold. */
/** Seconds an animal holds its pose. */
const POSE = 1.1;
/** Shy animals hold it for less (the Super camera's quiet shutter helps most with them). */
const SHY_POSE = 0.6;

const INK = '#1b1430';
const Z = 2; // fine pixels for each game pixel

// ---------- each map's look ----------
// sky top/bottom, far hills (two bands), ground, props on the middle ground, the train's colors.
const THEMES = {
  'bg-meadow': {
    sky: ['#7cc7ff', '#d0ecff'], hills: ['#7fb685', '#5f9e6e'], far: 'hills', ground: ['#6cc35a', '#4fa64a', '#8b5a2b'],
    props: ['oak', 'oak', 'pine', 'bush', 'bush', 'rock', 'log', 'pond', 'flowers'], train: ['#e03131', '#ffd43b'], clues: ['tracks', 'feather', 'antler'],
    seasons: {
      autumn: { ground: ['#b5a04a', '#8f8a3a', '#7a5230'], leaf: ['#e8590c', '#f59f00', '#c92a2a'] },
      winter: { ground: ['#d6deec', '#c3cde0', '#8b5a2b'], bank: '#b4c1d6', hills: ['#e3e9f3', '#b9c6da'], leaf: ['#2f7d32'], snow: true, sky: ['#9fbcd8', '#f6dcc8'] },
      spring: { leaf: ['#69db7c', '#8ce99a'], blossom: '#fcc2d7' },
    },
  },
  'bg-fjord': {
    sky: ['#9cc3dc', '#e7f5ff'], hills: ['#8d99a6', '#6c7a89'], far: 'peaks', ground: ['#4a6a52', '#2b4a36', '#6c757d'],
    water: ['#2a8aa0', '#1c6a80', '#12586e'], props: ['spruce', 'spruce', 'spruce', 'rock', 'bush'], train: ['#1971c2', '#f8f9fa'],
    covers: { tree: 'spruce' }, clues: ['tracks', 'feather'],
    seasons: {
      winter: { ground: ['#d6deec', '#c3cde0', '#6c757d'], bank: '#b4c1d6', snow: true, sky: ['#a9c0d6', '#f6dcc8'] },
      autumn: { ground: ['#8a7a3a', '#5c6b2a', '#6c757d'] },
    },
  },
  'bg-space': {
    sky: ['#0b1026', '#252a5c'], hills: ['#5c5f8a', '#46496e'], far: 'craters', ground: ['#9a9fc4', '#7d82a8', '#5c5f8a'],
    props: ['moonrock', 'moonrock', 'crater', 'antenna', 'crystal'], train: ['#ced4da', '#4dabf7'], stars: true, lowG: true,
    covers: { rock: 'moonrock', tree: 'moonrock' }, skyBody: 'earth', post: 'lamp', clues: ['tracks', 'glow'],
  },
  'bg-castle': {
    sky: ['#8fb8ff', '#d8e8ff'], hills: ['#86b97a', '#5f9e5a'], far: 'castle', ground: ['#6cc35a', '#4fa64a', '#8b5a2b'],
    water: ['#4c6ef5', '#3b5bdb', '#2f46b0'], props: ['oak', 'hedge', 'tower', 'oak', 'rock', 'hedge', 'flowers'], train: ['#7048e8', '#fcc419'],
    covers: { bush: 'hedge', tower: 'tower' }, perchKind: 'tower', tunnelStyle: 'gate', drawbridge: true, clues: ['tracks', 'feather', 'scale'],
    seasons: {
      autumn: { ground: ['#b5a04a', '#8f8a3a', '#7a5230'], leaf: ['#e8590c', '#f59f00', '#c92a2a'] },
      winter: { ground: ['#d6deec', '#c3cde0', '#8b5a2b'], bank: '#b4c1d6', hills: ['#e3e9f3', '#b9c6da'], leaf: ['#2f7d32'], snow: true, sky: ['#9fbcd8', '#f6dcc8'] },
      spring: { leaf: ['#69db7c', '#8ce99a'], blossom: '#fcc2d7' },
    },
  },
  'bg-sunset': {
    sky: ['#ff8a3d', '#ffd8a8'], hills: ['#b0603a', '#8a4a2a'], far: 'islands', ground: ['#f3c98b', '#e0b070', '#c08a3e'],
    water: ['#3bc9db', '#1098ad', '#0b7285'], props: ['palm', 'palm', 'dunegrass', 'shell', 'rock', 'log', 'dunegrass'], train: ['#12b886', '#ff8787'],
    covers: { tree: 'palm', reeds: 'dunegrass', log: 'log', rock: 'rock' }, warm: true, dusk: true, skyBody: 'sunset', fore: '#2b8a3e', clues: ['tracks', 'feather', 'shell'],
  },
  'bg-ocean': {
    sky: ['#74c0fc', '#1c5fa8'], hills: ['#3d7cc0', '#2f68a8'], far: 'reef', ground: ['#f0d9a0', '#d9bf82', '#a07a3c'],
    props: ['coral', 'seafan', 'seaweed', 'anemone', 'rock', 'clam', 'coral', 'seaweed'], train: ['#fab005', '#1c7ed6'],
    covers: { anemone: 'anemone', coral: 'coral', rock: 'rock', sky: 'seaweed', tree: 'seaweed' }, underwater: true, warm: true, skyBody: 'rays',
    tunnelStyle: 'cave', post: 'tube', fore: '#0ca678', foreKind: 'seaweed', clues: ['shell', 'tooth'],
    weatherNames: { sunny: { name: 'Sunbeams', icon: '🔆' }, rain: { name: 'Plankton bloom', icon: '🟢' }, snow: { name: 'Marine snow', icon: '❄️' }, mist: { name: 'Murky water', icon: '🌫️' }, wind: { name: 'Strong current', icon: '🌊' } },
  },
  'bg-volcano': {
    sky: ['#f08c5a', '#ffe0c2'], hills: ['#5b4b45', '#3d3330'], far: 'volcano', ground: ['#7a6656', '#6b5a4e', '#3d3330'],
    water: ['#1c9cb0', '#127a8c', '#0b5a6a'], props: ['cactus', 'lavarock', 'vent', 'cactus', 'scrub', 'lavarock', 'vent'], train: ['#343a40', '#ff6b1a'],
    covers: { rock: 'lavarock', tree: 'cactus', bush: 'scrub' }, warm: true, tunnelStyle: 'lava', vents: true, fore: '#5c6b2a', clues: ['tracks', 'feather', 'shell'],
  },
  'bg-rainforest': {
    sky: ['#a9e2b8', '#e6fcf5'], hills: ['#2f7a45', '#1f5c33'], far: 'jungle', ground: ['#3a9e4a', '#24733a', '#6e4b2a'],
    water: ['#9a8a5a', '#7e6f42', '#5e5230'], props: ['kapok', 'fern', 'palm', 'kapok', 'fern', 'bromeliad', 'log'], train: ['#2b8a3e', '#ffd43b'],
    covers: { tree: 'kapok', bush: 'fern', log: 'log' }, warm: true, downpour: true, leaf: ['#2b8a3e', '#37b24d'], fore: '#2b8a3e', foreKind: 'fern', clues: ['tracks', 'feather'],
  },
  'bg-rainbow': {
    sky: ['#c5f6fa', '#fff0f6'], hills: ['#96f2d7', '#fcc2d7'], far: 'candy', ground: ['#8ce99a', '#69db7c', '#fcc2d7'],
    props: ['lollipop', 'gumdrop', 'candytree', 'cane', 'lollipop', 'gumdrop', 'flowers', 'pond'], train: ['#f783ac', '#ffffff'],
    covers: { tree: 'candytree', bush: 'gumdrop', rock: 'gumdrop', reeds: 'cane' }, skyBody: 'rainbow', rainbowHunt: true, post: 'cane', fore: '#f783ac', clues: ['tracks', 'sprinkle'],
    weatherNames: { sunny: { name: 'Sunny', icon: '☀️' }, rain: { name: 'Sprinkles', icon: '🍬' }, snow: { name: 'Sugar snow', icon: '❄️' }, mist: { name: 'Cotton candy fog', icon: '🌫️' }, wind: { name: 'Breezy', icon: '🍃' } },
  },
  'bg-galaxy': {
    sky: ['#1a0f40', '#4a2c8a'], hills: ['#5f3dc4', '#4527a0'], far: 'spires', ground: ['#fcc419', '#f08c00', '#4527a0'],
    props: ['goldspire', 'goldcrystal', 'asteroid', 'goldcrystal', 'goldspire'], train: ['#5f3dc4', '#fcc419'], stars: true, lowG: true,
    covers: { rock: 'goldcrystal', burrow: 'burrow', tree: 'goldspire', sky: 'goldspire' }, skyBody: 'planets', goldCamo: true, tunnelStyle: 'wormhole', post: 'star', fore: '#e67700', clues: ['tracks', 'glow'],
    weatherNames: { sunny: { name: 'Starshine', icon: '⭐' }, rain: { name: 'Meteor shower', icon: '☄️' }, snow: { name: 'Star dust', icon: '✨' }, mist: { name: 'Nebula haze', icon: '🌌' }, wind: { name: 'Solar wind', icon: '🌞' } },
  },
};
/** The moon's own weather names for the day's weather. */
const SPACE_WEATHER = { sunny: { name: 'Earthrise', icon: '🌍' }, rain: { name: 'Meteor shower', icon: '☄️' }, snow: { name: 'Star dust', icon: '✨' }, mist: { name: 'Moon dust', icon: '🌫️' }, wind: { name: 'Solar wind', icon: '🌞' } };
THEMES['bg-space'].weatherNames = SPACE_WEATHER;
/** Rainbow land's colors: one photo of each in a ride brings the unicorn. */
export const RAINBOW_BONUS = 50;
export const RAINBOW = [['red', '#ff6b6b'], ['orange', '#ffa94d'], ['yellow', '#ffe066'], ['green', '#69db7c'], ['blue', '#4dabf7'], ['purple', '#b197fc']];
export const TRAIN_MAPS = Object.keys(THEMES);
const themeFor = (map, season) => {
  const base = THEMES[map] || THEMES['bg-meadow'];
  return { ...base, ...(base.seasons?.[season] || {}), season };
};

// ---------- the game ----------
export class PhotoTrain {
  /**
   * opts: { W, H, kid, visitor, best, seed, map, day, season?, clues?: legend clues the kid has,
   *   onPhoto(shot): a photo for the album, answers 'new' | 'better' | null,
   *   onClue(): the kid photographed a clue for the map's legend }
   */
  constructor(opts) {
    this.kind = 'train';
    this.Z = Z;
    this.W = opts.W; this.H = opts.H;
    this.map = THEMES[opts.map] ? opts.map : (mapCritters(opts.map)[0]?.map || 'bg-meadow');
    this.day = opts.day || '2026-01-01';
    this.season = opts.season || seasonOf(this.day);
    this.theme = themeFor(this.map, this.season);
    this.weather = opts.weather || weatherOf(this.day, this.season);
    if (this.weather === 'snow' && this.theme.warm) this.weather = 'rain'; // no snow on warm maps
    if (this.theme.downpour && this.weather === 'rain' && this.season !== 'winter') this.weather = 'mist'; // the rain comes later, in the ride
    this.wanted = wantedOf(this.day, this.map, this.season);
    this.clues = (typeof opts.clues === 'function' ? opts.clues(this.map) : opts.clues) || 0;
    this.onPhoto = opts.onPhoto || null; this.onClue = opts.onClue || null;
    this.cam = cameraFor(opts.kid.gear?.camera || 1);
    this.frame = this.cam.tele ? TELE_FRAME : FRAME;
    this.seed = opts.seed || 1;
    this.r = rng(this.seed);
    this.best = opts.best || 0;
    this.t = 0; this.pops = [];
    this.holdAnywhere = false; this.locked = false; this.shutterAt = -9;
    // where things are on screen (game pixels)
    const H = this.H;
    this.horizon = Math.round(H * 0.46);
    // feet on the middle ground: kept well above the car and the buddies' heads, so nothing on it hides behind the train
    this.groundY = Math.min(Math.round(H * 0.68), Math.round(H * 0.86) - 42);
    this.shoreY = this.theme.water ? Math.min(Math.round(H * 0.71), Math.round(H * 0.86) - 40) : this.groundY;
    // the water: at least 8 game pixels of it in front of the far shore, even on a wide, short screen
    this.waterTop = this.theme.water ? Math.min(Math.round(H * 0.5), this.shoreY - 8) : null;
    this.trackY = Math.round(H * 0.86);
    this.carX = Math.round(this.W * 0.2);
    const sit = (b) => ({ ...b, outfit: { ...(b?.outfit || {}), music: undefined, sport: undefined } });
    this.kid = new Player(sit(opts.kid.buddy), opts.kid.name, 11, this.carX + 9, this.trackY - 7);
    this.vis = new Player(sit(opts.visitor.buddy), opts.visitor.name, 23, this.carX - 9, this.trackY - 7);
    for (const p of [this.kid, this.vis]) { p.face = 1; p.brain.set(HAPPY); }
    this.sky = this.paintSky();
    this.reset();
    this.phase = 'ready';
  }

  reset() {
    this.left = GAME_SECONDS; this.film = this.cam.film; this.points = 0; this.newBest = false;
    this.dist = 0; this.speed = SPEED; this.brake = null; this.tunnel = null;
    this.props = []; this.nextProp = { mid: -20, fore: 60 };
    this.critters = []; this.nextAt = 2.5; this.landBusy = false;
    this.setPieces = { track: false, tunnel: false, clue: false, bridge: false };
    this.bridge = null; this.poured = false; this.colors = new Set(); this.rainbowFull = false;
    this.plan = { trackAt: 32 + this.r() * 22, tunnelAt: 14 + this.r() * 40, clueAt: 20 + this.r() * 50, legendAt: 72 + this.r() * 8, bridgeAt: 58 + this.r() * 8, pourAt: 40 + this.r() * 10 };
    if (Math.abs(this.plan.trackAt - this.plan.tunnelAt) < 10) this.plan.tunnelAt = (this.plan.trackAt + 25) % 70 + 10;
    this.roll = []; this.bestBy = {}; this.records = 0; this.cluesFound = 0;
    this.view = null; this.flash = 0; this.lastShot = null; this.overAt = 0;
    this.fill(0);
  }

  get score() { return this.points; }

  // ---------- scrolling ----------
  /** Screen x of something at world x on a layer. */
  sx(layer, x) { return x - this.dist * LAYER[layer]; }

  fill(ahead = 0) {
    // scenery on the middle ground and a few things right in front, made just before they scroll in
    const th = this.theme; const r = this.r;
    const midEdge = this.dist * LAYER.mid + this.W + 30 + ahead;
    while (this.nextProp.mid < midEdge) {
      const kind = th.props[Math.floor(r() * th.props.length)];
      this.props.push({ layer: 'mid', kind, x: this.nextProp.mid, y: (this.theme.water ? this.shoreY + 1 : this.groundY) + Math.round(r() * 5) - 2, seed: Math.floor(r() * 1e6) });
      this.nextProp.mid += 16 + r() * 30;
    }
    const foreEdge = this.dist * LAYER.fore + this.W + 40;
    while (this.nextProp.fore < foreEdge) {
      this.props.push({ layer: 'fore', kind: 'fore', x: this.nextProp.fore, y: this.H, seed: Math.floor(r() * 1e6) });
      this.nextProp.fore += 220 + r() * 260;
    }
    this.props = this.props.filter((p) => this.sx(p.layer, p.x) > -60);
  }

  // ---------- animals ----------
  act() { const e = GAME_SECONDS - this.left; return e < 30 ? 1 : e < 70 ? 2 : 3; }

  /** The next animal to come, and how it comes. */
  pickCritter({ legend = false } = {}) {
    let pairs = oddsFor(this.map, this.season, this.weather, { tier: this.cam.tier, clue: 0 });
    if (legend) pairs = pairs.filter(([c]) => c.rarity === 'legend');
    else pairs = pairs.filter(([c]) => c.rarity !== 'legend' || this.act() === 3);
    if (this.act() === 3) pairs = pairs.map(([c, w]) => [c, c.rarity === 'rare' || c.rarity === 'legend' ? w * 3 : w]);
    // the sunset: day animals go home for the finale, dusk animals only come out then
    if (this.theme.dusk) pairs = pairs.filter(([c]) => (this.act() === 3 ? !c.day : !c.dusk));
    // Rainbow land: after 30 s, colors still missing from the rainbow come three times as often
    if (this.theme.rainbowHunt && GAME_SECONDS - this.left > 30) pairs = pairs.map(([c, w]) => [c, c.color && !this.colors.has(c.color) ? w * 3 : w]);
    // the downpour: sun lovers hide
    if (this.poured) pairs = pairs.filter(([c]) => !c.weather?.includes('sunny'));
    // Fjord rule (Taylor): one land animal at a time
    if (this.landBusy) pairs = pairs.filter(([c]) => !c.land);
    // nothing twice at once
    const out = new Set(this.critters.filter((k) => !k.gone).map((k) => k.c.id));
    pairs = pairs.filter(([c]) => !out.has(c.id));
    return pickWeighted(pairs, this.r());
  }

  spawn(c, how) {
    const r = this.r;
    const pic = (f) => critterPic(c.look, f);
    const k = { c, how, t0: this.t, state: 'sign', id: Math.floor(r() * 1e9), face: -1, pics: pic };
    const mid = this.dist * LAYER.mid;
    if (how === 'fly') {
      k.layer = 'screen'; k.x = this.W + 20; k.y = Math.round(this.H * (0.14 + r() * 0.2));
      k.vx = -(26 + r() * 16); k.mover = true; k.state = 'sign'; k.signFor = 0.9;
    } else if (how === 'far') {
      k.layer = 'far'; k.x = this.dist * LAYER.far + this.W * (0.7 + r() * 0.3); k.y = this.horizon - 2 - Math.round(r() * 4);
      k.signFor = 0; k.state = 'emerge'; k.far = true;
    } else if (how === 'track') {
      // close up on the track: drawn bigger (a bigger picture, not stretched pixels)
      k.layer = 'screen'; k.x = this.W * 0.84; k.y = this.trackY + 1; k.state = 'wait'; k.big = true;
      const bigLook = { ...c.look, len: Math.round(c.look.len * 1.5) };
      k.pics = (f) => critterPic(bigLook, f);
      this.brake = { at: this.t, k };
    } else if (how === 'run') {
      // it comes up from behind the train and runs alongside, a little faster, then drops back
      k.layer = 'mid'; k.x = mid - 30; k.y = c.sea ? this.waterY() : this.footY(c); k.mover = true; k.signFor = 0; k.state = 'run';
      k.vx = SPEED * LAYER.mid + 9 + r() * 5; k.face = 1;
    } else {
      // step / rise / perch / surface / hop: from its own hiding place, sliding in from the right
      k.layer = 'mid';
      k.x = mid + this.W + 12;
      k.y = how === 'surface' ? this.waterY() : how === 'perch' ? (this.theme.water ? this.shoreY : this.groundY) - 30 - Math.round(r() * 8) : this.footY(c);
      k.emergeX = this.W * (0.55 + r() * 0.32);
      const cov = this.theme.covers || {};
      const base = { burrow: 'burrow', log: 'log', rock: 'rock', reeds: 'reeds', bush: 'bush', tower: 'tower' };
      let cover = how === 'surface' ? 'ripple' : how === 'perch' ? 'branch' : cov[c.from] || base[c.from] || cov.tree || 'oak';
      if (this.theme.vents && c.from === 'rock' && how === 'rise' && r() < 0.5) cover = 'vent'; // up from behind a steam vent
      k.cover = { layer: 'mid', kind: cover, x: k.x + (how === 'step' ? 6 : 0), y: how === 'perch' ? (this.theme.water ? this.shoreY : this.groundY) : k.y, seed: Math.floor(r() * 1e6), hides: k };
      this.props = this.props.filter((q) => q.layer !== 'mid' || q.hides || Math.abs(q.x - k.cover.x) > (q.kind === 'pond' ? 40 : 16));
      if (c.camo) k.cover = null; // the octopus IS the rock
      else if (how !== 'perch') this.props.push(k.cover);
      else this.props.push({ ...k.cover, kind: c.from === 'tower' ? 'tower' : this.theme.perchKind || cov.tree || 'oak', x: k.x + 4, perch: true });
      if (how === 'perch') { k.state = 'inbound'; k.fromX = this.W + 30; }
    }
    if (c.land) { this.landBusy = true; k.land = true; }
    this.critters.push(k);
    // the visitor sometimes spots it first
    if (how !== 'far' && how !== 'track' && r() < 0.35) k.point = this.t + 0.6 + r() * 0.6;
    return k;
  }

  waterY() { return this.waterTop ? Math.round(this.waterTop + (this.shoreY - this.waterTop) * 0.45) : this.groundY + 2; }
  footY(c) { return c.sea ? this.waterY() : this.shoreY + (this.theme.water ? 0 : Math.round(this.r() * 3)); }

  /** Where a critter is on screen now: center x, feet y. */
  where(k) {
    if (k.layer === 'screen') return [k.x, k.y];
    return [this.sx(k.layer, k.x), k.y];
  }

  /** The picture to draw for a critter now (and how much it shows: rise/surface slide up). */
  look(k) {
    const st = k.state; const how = k.how;
    if (st === 'pose' || st === 'track-pose') return 'pose';
    if (how === 'fly' || (how === 'perch' && (st === 'inbound' || st === 'leave'))) return Math.floor(this.t * 8) % 2 ? 'fly' : 'walk';
    if (st === 'walk' || st === 'run' || st === 'leave' || st === 'enter') return Math.floor(this.t * 6) % 2 ? 'walk' : 'stand';
    return 'stand';
  }

  stepCritters(dt) {
    const r = this.r;
    for (const k of this.critters) {
      if (k.gone) continue;
      const age = this.t - k.t0;
      const [x] = this.where(k);
      const posing = (k.c.shy ? SHY_POSE : POSE) + this.cam.posePlus;
      switch (k.state) {
        case 'sign':
          if (k.how === 'fly') { if (age > k.signFor) { k.state = 'fly'; } break; }
          if (k.wait && this.t < k.wait) break;
          if (x < k.emergeX) { k.state = 'emerge'; k.st = this.t; this.sound = 'rustle'; }
          break;
        case 'emerge': {
          const up = this.t - (k.st || k.t0);
          if (k.far) { if (age > 1) { k.state = 'pose'; k.st = this.t; } break; }
          if (up > (k.how === 'step' ? 0.7 : 0.35)) { k.state = 'pose'; k.st = this.t; this.sound = 'chime'; }
          break;
        }
        case 'pose':
          if (this.t - k.st > (k.far ? 2.2 : k.how === 'track' ? 3.2 + this.cam.posePlus : posing)) { k.state = 'leave'; k.st = this.t; if (k.far) k.vx = (r() < 0.5 ? -1 : 1) * 3; }
          break;
        case 'leave': {
          const t = this.t - k.st;
          if (k.how === 'perch') { k.y -= 26 * dt; k.x += (k.layer === 'mid' ? -10 : -30) * dt; if (t > 1.6) k.gone = true; }
          else if (k.far) { k.x += k.vx * dt; if (t > 2.5) { k.state = 'emerge'; k.t0 = this.t - 0.5; k.st = this.t - 0.5; } }
          else if (k.how === 'track') { k.y -= 6 * dt; k.x += 12 * dt; if (t > 1.8) { k.gone = true; this.brake = null; } }
          else if (t > (k.how === 'step' ? 0.8 : 0.4)) k.gone = true;
          break;
        }
        case 'fly':
          k.x += k.vx * dt; k.y += Math.sin(this.t * 3 + k.id) * 4 * dt;
          if (k.x < -30) k.gone = true;
          // a bird that perches on the fly path: none; the moon whale glides slowly
          break;
        case 'run':
          k.x += k.vx * dt;
          if (age > 7) { k.vx = SPEED * LAYER.mid - 14; k.face = 1; }
          if (x < -30 || x > this.W + 40) k.gone = true;
          break;
        case 'inbound': { // a bird flying in to its branch
          const t = (this.t - k.t0) / 1.4;
          k.flyX = this.W + 30 + (x - this.W - 30) * Math.min(1, t);
          if (t >= 1 || x < k.emergeX) { k.state = 'pose'; k.st = this.t; this.sound = 'chime'; k.flyX = null; }
          break;
        }
        case 'wait': // on the track: waits for the train to stop
          if (this.speed < 2) { k.state = 'pose'; k.st = this.t; this.sound = 'chime'; }
          break;
        default: break;
      }
      // the moon: hoppers bounce in slow motion, and pose at the top of a hop
      if (this.theme.lowG && k.how === 'hop') {
        const ph = ((this.t - k.t0) * 0.7) % 1;
        k.lift = k.state === 'pose' ? 14 : Math.round(Math.sin(ph * Math.PI) * 14);
      }
      if (k.point && this.t >= k.point) { k.point = null; this.pointAt = { k, at: this.t }; addPop(this, 'Look!', this.vis.x, this.trackY - 30, '#ffffff'); }
      // gone off the left of the screen
      if (k.layer !== 'screen' && this.where(k)[0] < -50) k.gone = true;
    }
    for (const k of this.critters) if (k.gone && k.land) { k.land = false; this.landBusy = this.critters.some((o) => !o.gone && o.land); }
    this.critters = this.critters.filter((k) => !k.gone || this.t - k.t0 < 0.1);
  }

  director() {
    const e = GAME_SECONDS - this.left;
    // set pieces
    if (!this.setPieces.track && e > this.plan.trackAt && !this.tunnel) {
      const c = mapCritters(this.map).filter((x) => x.how.includes('track') && inSeason(x, this.season) && !(x.land && this.landBusy));
      this.setPieces.track = true;
      if (c.length) {
        const pick = c.find((x) => x.rarity === 'legend' && this.clues >= 3 && false) || pickWeighted(c.map((x) => [x, RARITIES[x.rarity].weight]), this.r());
        this.spawn(pick, 'track');
        addPop(this, 'Whoa! Something on the track!', this.W / 2, this.H * 0.2, '#ffd43b', true);
      }
      return;
    }
    // the Castle: the drawbridge is up, so the train waits at the moat, and moat animals come up in a row
    if (this.theme.drawbridge && !this.setPieces.bridge && e > this.plan.bridgeAt && !this.brake && !this.tunnel) {
      this.setPieces.bridge = true;
      const until = this.t + 5.5;
      this.bridge = { x: this.dist + this.carX + 100, until };
      this.brake = { at: this.t, bridge: true, until };
      addPop(this, 'The drawbridge is up! Wait...', this.W / 2, this.H * 0.2, '#ffd43b', true);
      const sea = mapCritters(this.map).filter((x) => x.sea && inSeason(x, this.season));
      const mid = this.dist * LAYER.mid;
      for (let i = 0; i < 3 && sea.length; i += 1) {
        const k = this.spawn(pickWeighted(sea.map((x) => [x, RARITIES[x.rarity].weight]), this.r()), 'surface');
        k.x = mid + this.W * (0.3 + i * 0.22); k.emergeX = this.W * 2; k.wait = this.t + 1.2 + i * 1.5; k.point = null;
      }
      return;
    }
    // the Rainforest: the afternoon downpour
    if (this.theme.downpour && !this.poured && e > this.plan.pourAt && this.season !== 'winter' && this.weather !== 'rain') {
      this.poured = true; this.weather = 'rain'; this.theme = { ...this.theme, sky: ['#5c7a6a', '#a9c2b4'] }; this.sky = this.paintSky();
      addPop(this, 'Here comes the rain! Frogs love it.', this.W / 2, this.H * 0.2, '#a5d8ff', true);
    }
    if (!this.setPieces.tunnel && e > this.plan.tunnelAt && !this.brake) {
      this.setPieces.tunnel = true;
      const L = 220; const x0 = this.dist + this.W + 20;
      this.tunnel = { x0, x1: x0 + L, bats: false };
      return;
    }
    if (!this.setPieces.clue && e > this.plan.clueAt && this.clues < 3) {
      this.setPieces.clue = true;
      const kinds = this.theme.clues || ['tracks', 'feather'];
      const kind = kinds[Math.floor(this.r() * kinds.length)];
      this.props.push({ layer: 'mid', kind: `clue-${kind}`, clue: true, x: this.dist * LAYER.mid + this.W + 10, y: this.groundY + 1, seed: 1 });
    }
    if (this.t < this.nextAt || this.brake) return;
    // the legend: three clues bring it in the finale (with a hush first)
    let c = null; let how = null;
    if (((e > this.plan.legendAt && this.clues >= 3) || this.rainbowFull) && !this.legendCame) {
      c = this.pickCritter({ legend: true }); this.legendCame = true;
      if (c) addPop(this, this.rainbowFull ? 'The rainbow is shining...' : this.theme.underwater ? 'Shh... the fish went quiet...' : 'Shh... the birds went quiet...', this.W / 2, this.H * 0.2, '#e9ecef', true);
    }
    if (!c) c = this.pickCritter();
    if (!c) { this.nextAt = this.t + 1; return; }
    if (c.rarity === 'legend') this.legendCame = true;
    const ways = c.how.filter((h) => h !== 'track' && (h !== 'surface' || this.waterTop || c.from === 'water'));
    how = ways[Math.floor(this.r() * ways.length)] || 'rise';
    if (how === 'surface' && !this.waterTop && !c.sea) how = 'rise';
    this.spawn(c, how);
    const act = this.act();
    const gap = act === 1 ? 3.4 + this.r() * 1.6 : 2.2 + this.r() * 1.2;
    this.nextAt = this.t + gap;
  }

  // ---------- the camera ----------
  frameAt(px, py) {
    const { w, h } = this.frame;
    return { x: clamp(px, w / 2, this.W - w / 2), y: clamp(py - LIFT, h / 2, this.H - h / 2) };
  }

  /** Things that can be in a photo now, with their boxes on screen (game pixels). */
  subjects() {
    const out = [];
    for (const k of this.critters) {
      if (k.gone) continue;
      const g = this.geom(k);
      const shown = k.state !== 'sign' && k.state !== 'inbound' && g.show > 0.3 ? 1 : 0;
      const vis = g.h * g.show;
      // a sign's box: where the animal will come out
      const box = shown ? { x: (g.sx) / Z, y: (g.top + g.h - vis) / Z, w: g.w / Z, h: vis / Z } : { x: g.cx - g.w / Z / 2, y: g.top / Z, w: g.w / Z, h: g.h / Z };
      out.push({ k, box, shown, sign: !shown, far: k.far });
    }
    for (const p of this.props) {
      if (!p.clue || p.found) continue;
      const x = this.sx('mid', p.x);
      out.push({ clue: p, box: { x: x - 6, y: p.y - 6, w: 12, h: 7 }, shown: 1 });
    }
    return out;
  }

  /** Aims the camera: the viewfinder comes up over the finger (or moves there). */
  aim(x, y) {
    const v = this.view;
    // the aim sticks to the spot of scenery touched (wx: where on the middle ground), so the
    // frame rides along with the trees and bushes going by
    if (v) { v.wx = x + this.dist * LAYER.mid; v.fy = y; return; }
    const f = this.frameAt(x, y);
    this.view = { ...f, wx: x + this.dist * LAYER.mid, fy: y, at: this.t, focus: 0, lock: null, vx: 0, vy: 0, lastX: f.x, lastY: f.y };
  }

  /** The shutter button (bottom right, game pixels). */
  get shutter() { return { x: this.W - 15, y: this.H - 15, r: 11 }; }
  onButton(x, y) { const b = this.shutter; return !!this.view && Math.hypot(x - b.x, y - b.y) <= b.r + 3; }

  tap(x, y) {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) { this.reset(); this.phase = 'ready'; } return; }
    if (this.phase === 'ready') {
      if (this.locked) return;
      this.phase = 'play';
      return;
    }
    if (this.left <= 0) return;
    // the shutter, before there's anything to aim at
    const b = this.shutter;
    if (Math.hypot(x - b.x, y - b.y) <= b.r + 3) { this.press(); return; }
    this.aim(x, y);
  }

  drag(x, y) {
    const v = this.view; if (!v) return;
    v.wx = x + this.dist * LAYER.mid; v.fy = y;
  }

  /** The shutter: takes the photo now. The viewfinder stays up where it was aimed. */
  press() {
    if (this.phase !== 'play') return;
    this.shutterAt = this.t;
    const v = this.view;
    if (!v) { addPop(this, 'Touch the screen to aim first!', this.W / 2, this.H * 0.25, '#ffffff'); return; }
    if (this.film <= 0) { addPop(this, 'Out of film!', v.x, v.y - 10, '#ff8787'); return; }
    this.snap(v);
  }

  release() { /* the shutter snaps when pressed; the aiming finger lifting changes nothing */ }

  stepView(dt) {
    const v = this.view; if (!v) return;
    v.fx = this.sx('mid', v.wx);
    const { x: tx, y: ty } = this.frameAt(v.fx, v.fy);
    const k = 1 - Math.exp(-30 * dt);
    v.x += (tx - v.x) * k; v.y += (ty - v.y) * k;
    const { w: fw, h: fh } = this.frame;
    v.x = clamp(v.x, fw / 2, this.W - fw / 2); v.y = clamp(v.y, fh / 2, this.H - fh / 2);
    const sp = Math.hypot(v.x - v.lastX, v.y - v.lastY) / Math.max(dt, 1e-3);
    v.speed = sp; v.lastX = v.x; v.lastY = v.y;
    // focus: closes in while the frame is steady (or panning slowly), drops while it swings about
    if (sp < 30) v.focus = Math.min(1, v.focus + dt / this.cam.focus);
    else v.focus = Math.max(0, v.focus - dt * 1.5);
    // sharp: a little beep (the frame doesn't lock on or follow anything: Taylor, 2026-11-20,
    // keeping the animal in the frame is the kid's job)
    if (v.focus >= 1 && !v.beeped) { v.beeped = true; this.sound = 'lock'; }
    if (v.focus < 1) v.beeped = false;
  }

  snap(v) {
    const { w, h } = this.frame;
    const fr = { x: v.x - w / 2, y: v.y - h / 2, w, h };
    const inside = (b) => {
      const ix = Math.max(0, Math.min(b.x + b.w, fr.x + fr.w) - Math.max(b.x, fr.x));
      const iy = Math.max(0, Math.min(b.y + b.h, fr.y + fr.h) - Math.max(b.y, fr.y));
      return (ix * iy) / Math.max(1, b.w * b.h);
    };
    const cands = this.subjects().filter((o) => o.shown || (o.k && this.tunnel && this.dark() > 0.5)).map((o) => {
      const inF = inside(o.box);
      const dx = (o.box.x + o.box.w / 2 - v.x) / (w / 2); const dy = (o.box.y + o.box.h / 2 - v.y) / (h / 2);
      return { o, inF, off: Math.hypot(dx, dy), dx, dy };
    }).filter((q) => q.inF >= 0.45).sort((a, b) => (b.inF - b.off * 0.5 + (b.o.k === v.lock ? 1 : 0)) - (a.inF - a.off * 0.5 + (a.o.k === v.lock ? 1 : 0)));
    const best = cands[0];
    // too far: no film used, but now the kid knows what a zoom lens is for
    if (best?.o.far && !this.cam.zoom) {
      addPop(this, 'Too far! A zoom lens could reach it.', v.x, v.y - h / 2 - 4, '#ffd43b');
      return;
    }
    this.film -= 1;
    this.flash = this.t;
    this.sound = 'snap';
    // the photo is what was really in the viewfinder (copied in draw)
    const shot = { at: this.t, frame: fr, map: this.map, weather: this.weather, season: this.season, day: this.day };
    this.capture = shot;
    if (!best) {
      Object.assign(shot, { none: true, quality: 'blurry' });
      addPop(this, this.tunnel && this.dark() > 0.5 ? 'Just the dark!' : 'Just scenery!', v.x, v.y, '#e9ecef');
      this.lastShot = shot; this.roll.push(shot);
      return;
    }
    const o = best.o;
    const moving = Boolean(o.k && (o.k.mover || o.k.state === 'leave' || o.k.state === 'enter'));
    const locked = v.lock && (v.lock === o.k || v.lock === o.clue);
    let sharp = v.focus >= 1 && (locked || !moving || (v.speed > 8 && v.speed < 80)) && (!o.k || o.k.state !== 'sign');
    const posed = Boolean(o.k && o.k.state === 'pose');
    const centred = best.off < 0.45 && best.inF >= 0.8;
    // the Volcano: a puff of steam in front spoils the photo
    let steamy = false;
    if (sharp && o.k && this.steamOver(o.box)) { sharp = false; steamy = true; this.film += 1; } // the steam's fault: the film comes back
    const fill = (o.box.w * (o.far ? 2.2 : 1)) / w;
    Object.assign(shot, { sharp, posed, centred, moving: moving && sharp, fill });
    shot.quality = qualityOf(shot);
    if (o.clue) {
      if (sharp) {
        o.clue.found = true; this.cluesFound += 1;
        const n = this.onClue?.(this.map) ?? this.clues + this.cluesFound;
        Object.assign(shot, { clue: o.clue.kind, quality: 'good' });
        addPop(this, `A clue! ${Math.min(3, n)} of 3`, v.x, v.y - 8, '#b2f2bb', true);
        if (n >= 3) addPop(this, 'Something legendary is near...', this.W / 2, this.H * 0.3, '#ffd43b', true);
      } else addPop(this, 'Too blurry to read the clue', v.x, v.y - 8, '#e9ecef');
      this.lastShot = shot; this.roll.push(shot);
      return;
    }
    const c = o.k.c;
    shot.critter = c.id; shot.name = c.name; shot.rarity = c.rarity;
    shot.slots = slotsOf(shot);
    shot.wanted = c.id === this.wanted;
    let pts = photoPoints(c, shot.quality, shot.wanted);
    // only the best photo of each animal counts in a ride
    const had = this.bestBy[c.id] || 0;
    const gain = Math.max(0, pts - had);
    this.bestBy[c.id] = Math.max(had, pts);
    if (shot.quality !== 'blurry') {
      const rec = this.onPhoto ? this.onPhoto(shot) : null; // the photo's picture is filled in on the next draw
      shot.record = rec;
      if (rec === 'new') { this.records += 1; pts = gain + NEW_BONUS; this.points += pts; } else { pts = gain; this.points += gain; }
    } else pts = 0;
    shot.points = pts;
    this.lastShot = shot; this.roll.push(shot);
    const q = QUALITY[shot.quality];
    addPop(this, shot.quality === 'blurry' ? (steamy ? 'Steam in the way!' : 'Blurry...') : `${q.short}! +${pts}`, v.x, v.y - h / 2 - 3, q.color, shot.quality === 'perfect');
    // Rainbow land: one photo of each color fills the rainbow, and the unicorn comes
    if (this.theme.rainbowHunt && c.color && shot.quality !== 'blurry' && !this.colors.has(c.color)) {
      this.colors.add(c.color);
      addPop(this, `${c.color[0].toUpperCase()}${c.color.slice(1)} for the rainbow!`, this.W / 2, this.H * 0.3, RAINBOW.find(([k]) => k === c.color)[1]);
      if (this.colors.size === RAINBOW.length && !this.legendCame) {
        this.rainbowFull = true; this.nextAt = Math.min(this.nextAt, this.t + 1.5);
        addPop(this, 'The rainbow is full! Something magical is coming...', this.W / 2, this.H * 0.22, '#ffffff', true);
      } else if (this.colors.size === RAINBOW.length) { // the unicorn came already: a rainbow bonus instead
        this.points += RAINBOW_BONUS;
        addPop(this, `Full rainbow! +${RAINBOW_BONUS}`, this.W / 2, this.H * 0.22, '#ffffff', true);
      }
    }
  }

  /** How much a steam vent is puffing now (0..1), and whether steam covers a box (game pixels). */
  puff(p) { const ph = (this.t * 0.42 + h2(p.seed, 1)) % 1; return ph < 0.38 ? Math.sin((ph / 0.38) * Math.PI) : 0; }
  steamOver(box) {
    if (!this.theme.vents) return false;
    return this.props.some((p) => {
      if (p.kind !== 'vent' || p.layer !== 'mid' || this.puff(p) < 0.35) return false;
      const x = this.sx('mid', p.x);
      return Math.abs(box.x + box.w / 2 - x) < 13 + box.w * 0.3 && box.y + box.h > p.y - 46 && box.y < p.y;
    });
  }

  // ---------- the ride ----------
  dark() {
    const T = this.tunnel; if (!T) return 0;
    const cx = this.dist + this.carX; // the camera car, in track units
    const a = clamp((cx - T.x0) / 30, 0, 1); const b = clamp((T.x1 - cx) / 30, 0, 1);
    return Math.min(a, b);
  }

  finish() {
    this.phase = 'over'; this.overAt = this.t; this.view = null;
    this.newBest = this.points > this.best;
    if (this.newBest) this.best = this.points;
  }

  step(dt) {
    this.t += dt;
    for (const p of [this.kid, this.vis]) p.move(dt);
    this.pops = this.pops.filter((p) => this.t - p.at < 1.6);
    if (this.phase !== 'play') return;
    this.left = Math.max(0, this.left - dt);
    // time's up: the ride ends (a shutter press in the same moment still counts)
    if (this.left <= 0) { this.finish(); return; }
    // the train: slows to a stop for an animal on the track, then chugs on
    const want = !this.brake ? SPEED : this.brake.bridge ? (this.t < this.brake.until ? 0 : SPEED) : (this.brake.k.state === 'leave' && this.t - this.brake.k.st > 1 ? SPEED : 0);
    if (this.brake?.bridge && this.t > this.brake.until + 1) this.brake = null;
    if (this.bridge && this.sx('track', this.bridge.x) < -80) this.bridge = null;
    this.speed += (want - this.speed) * (1 - Math.exp(-(want < this.speed ? 2.6 : 0.9) * dt));
    if (this.speed < 0.5 && want === 0) this.speed = 0;
    this.dist += this.speed * dt;
    this.fill();
    // the tunnel: bats with glowing eyes in the dark
    if (this.tunnel) {
      const d = this.dark();
      if (d > 0.8 && !this.tunnel.bats) {
        this.tunnel.bats = true;
        const bat = mapCritters(this.map).find((c) => c.tunnel) || mapCritters('bg-meadow').find((c) => c.tunnel);
        for (let i = 0; i < 2; i += 1) {
          const k = this.spawn(bat, 'fly');
          k.x = this.W * (0.55 + i * 0.3); k.vx = -10 - this.r() * 8; k.y = this.H * (0.2 + i * 0.12); k.state = 'fly'; k.bat = true; k.point = null;
        }
      }
      if (this.dist + this.carX > this.tunnel.x1 + this.W) this.tunnel = null;
    }
    this.director();
    this.stepCritters(dt);
    this.stepView(dt);
  }

  // ---------- drawing (fine pixels) ----------
  paintSky() {
    const W = this.W * Z; const H = this.H * Z; const th = this.theme;
    const c = canvas(W, H); const x = c.getContext('2d');
    const top = th.sky[0]; const bot = th.sky[1];
    for (let j = 0; j < H; j += 1) {
      const k = j / (this.horizon * Z + 10);
      for (let i = 0; i < W; i += 4) {
        const th2 = h2(i >> 2, j, 3) * 0.12;
        x.fillStyle = mix(top, bot, clamp(Math.round((k + th2) * 7) / 7, 0, 1));
        x.fillRect(i, j, 4, 1);
      }
    }
    if (th.stars) for (let i = 0; i < 90; i += 1) { x.fillStyle = ['#ffffff', '#ffd43b', '#b197fc'][i % 3]; x.fillRect(Math.floor(h2(i, 1) * W), Math.floor(h2(i, 2) * this.horizon * Z), 1, 1); }
    const body = th.skyBody || (th.stars ? 'earth' : null);
    if (body === 'planets') { // a ringed golden planet, a little blue one, and a swirl of a galaxy
      const disc = (cx, cy, R, fn) => { for (let j = -R; j <= R; j += 1) for (let i = -R; i <= R; i += 1) if (i * i + j * j <= R * R) { x.fillStyle = fn(i, j); x.fillRect(cx + i, cy + j, 1, 1); } };
      const px0 = Math.round(W * 0.74); const py0 = Math.round(H * 0.15);
      for (let a = 0; a < Math.PI * 2; a += 0.02) { const rx = Math.round(Math.cos(a) * 21); const ry = Math.round(Math.sin(a) * 5); if (ry < 0) { x.fillStyle = '#fff3bf'; x.fillRect(px0 + rx, py0 + ry, 1, 1); } }
      disc(px0, py0, 11, (i, j) => (j + Math.round(i * 0.2)) % 6 < 2 ? '#f59f00' : i + j < -8 ? '#fff3bf' : '#ffd43b');
      for (let a = 0; a < Math.PI * 2; a += 0.02) { const rx = Math.round(Math.cos(a) * 21); const ry = Math.round(Math.sin(a) * 5); if (ry >= 0) { x.fillStyle = '#fff3bf'; x.fillRect(px0 + rx, py0 + ry, 1, 1); } }
      disc(Math.round(W * 0.2), Math.round(H * 0.09), 5, (i, j) => (i + j < -3 ? '#d0ebff' : '#4dabf7'));
      const gx = W * 0.46; const gy = H * 0.22;
      for (let k = 0; k < 2; k += 1) for (let t = 0; t < 1; t += 0.02) { const a = t * 9 + k * Math.PI; const rr = t * 16; x.fillStyle = t < 0.3 ? '#ffffff' : t < 0.6 ? '#e5dbff' : '#9775fa'; x.fillRect(Math.round(gx + Math.cos(a) * rr), Math.round(gy + Math.sin(a) * rr * 0.45), 1, 1); }
    } else if (body === 'rainbow') { // a rainbow arching over Rainbow land
      const cx = W * 0.5; const cy = this.horizon * Z + 30; const R0 = W * 0.32;
      x.globalAlpha = 0.55;
      for (let j = 0; j < this.horizon * Z; j += 1) for (let i = 0; i < W; i += 1) {
        const d = Math.hypot(i - cx, (j - cy) * 1.15); const band = Math.floor((d - R0) / 3);
        if (band >= 0 && band < RAINBOW.length) { x.fillStyle = RAINBOW[RAINBOW.length - 1 - band][1]; x.fillRect(i, j, 1, 1); }
      }
      x.globalAlpha = 1;
    } else if (body === 'rays') { // under the sea: sun rays slanting down, and the shimmering surface far above
      x.globalAlpha = 0.1; x.fillStyle = '#ffffff';
      for (let k = 0; k < 6; k += 1) { const x0 = W * (0.05 + k * 0.19); x.beginPath(); x.moveTo(x0, 0); x.lineTo(x0 + 14, 0); x.lineTo(x0 + 70, H * 0.8); x.lineTo(x0 + 40, H * 0.8); x.closePath(); x.fill(); }
      x.globalAlpha = 1;
      for (let i = 0; i < W; i += 1) { const y = 2 + Math.round(Math.sin(i / 7) * 1.5 + Math.sin(i / 3) * 0.6); x.fillStyle = '#d0ebff'; x.fillRect(i, y, 1, 1); }
    }
    if (body === 'earth') { // the earth
      const ex = W * 0.4; const ey = H * 0.25; const R = 9;
      for (let j = -R; j <= R; j += 1) for (let i = -R; i <= R; i += 1) if (i * i + j * j <= R * R) { x.fillStyle = h2(i + 40, j + 40) > 0.62 ? '#51cf66' : (i + j < -6 ? '#a5d8ff' : '#4dabf7'); x.fillRect(ex + i, ey + j, 1, 1); }
    } else if (this.weather === 'sunny' && body !== 'sunset' && body !== 'rays' && body !== 'planets') {
      const sx = W * 0.78; const sy = H * 0.12;
      for (let j = -8; j <= 8; j += 1) for (let i = -8; i <= 8; i += 1) { const d = i * i + j * j; if (d <= 64) { x.fillStyle = d < 36 ? '#fff3bf' : '#ffe066'; x.fillRect(sx + i, sy + j, 1, 1); } }
    }
    return c;
  }

  draw(ctx) {
    const th = this.theme; const W = this.W * Z; const H = this.H * Z;
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.sky, 0, 0);
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const shake = this.speed > 1 ? Math.round(Math.sin(this.t * 31) * 0.6) : 0;
    // clouds, drifting
    // the sunset: the sun sinks into the sea during the ride
    const dusk = th.dusk ? clamp((GAME_SECONDS - this.left) / GAME_SECONDS, 0, 1) : 0;
    if (th.dusk) {
      ctx.fillStyle = `rgba(214,51,108,${0.32 * dusk})`; ctx.fillRect(0, 0, W, this.horizon * Z);
      const sx0 = Math.round(W * 0.66); const sy0 = Math.round(H * 0.12 + (this.horizon * Z - H * 0.12 + 4) * dusk); const R = 15;
      for (let j = -R; j <= R; j += 1) for (let i = -R; i <= R; i += 1) { const d = i * i + j * j; if (d <= R * R) P(d < (R - 5) ** 2 ? '#fff3bf' : mix('#ffd43b', '#ff6b6b', dusk), sx0 + i, sy0 + j); }
    }
    if (!th.stars && !th.underwater) for (let i = 0; i < 4; i += 1) {
      const cx = ((i * 157 - this.dist * 0.03 - this.t * 2) % (W + 120) + W + 120) % (W + 120) - 60; const cy = 16 + i * 13;
      const col = this.weather === 'rain' || this.weather === 'snow' ? '#c9d1db' : th.dusk ? mix('#ffffff', '#ffa8a8', dusk) : '#ffffff';
      P(col, cx, cy, 34, 6); P(col, cx + 6, cy - 4, 18, 4); P(mix(col, '#9aa8b8', 0.4), cx + 2, cy + 6, 30, 2);
    }
    // far: hills (or peaks, or craters), scrolling slowly
    const far = this.dist * LAYER.far * Z;
    const hz = this.horizon * Z;
    if (th.far === 'islands') { ctx.fillStyle = mix(th.water[0], th.sky[1], 0.35); ctx.fillRect(0, hz - 3, W, 40); }
    for (let i = 0; i < W; i += 1) {
      const wx = i + far;
      let hgt;
      if (th.far === 'peaks') hgt = 46 + Math.abs(((wx * 0.9) % 180) - 90) * 0.55 + Math.sin(wx / 23) * 6;
      else if (th.far === 'craters') hgt = 18 + Math.sin(wx / 40) * 6 + Math.sin(wx / 13) * 2;
      else if (th.far === 'islands') { const isl = Math.sin(wx / 37) * 1.3 + Math.sin(wx / 11) * 0.15 - 0.75; if (isl <= 0) continue; hgt = 3 + isl * 34; ctx.fillStyle = th.hills[0]; ctx.fillRect(i, hz - 3 - Math.round(hgt), 1, Math.round(hgt)); ctx.fillStyle = th.hills[1]; ctx.fillRect(i, hz - 3 - Math.round(hgt * 0.4), 1, Math.round(hgt * 0.4)); continue; }
      else if (th.far === 'reef') hgt = 24 + Math.abs(Math.sin(wx / 9)) * 7 + Math.sin(wx / 31) * 8;
      else if (th.far === 'volcano') { const d = Math.abs((((wx % 760) + 760) % 760) - 380); hgt = Math.max(16 + Math.sin(wx / 23) * 5, 112 - d * 0.62); }
      else if (th.far === 'jungle') hgt = 36 + Math.abs(Math.sin(wx / 11)) * 9 + Math.abs(Math.sin(wx / 29)) * 9;
      else if (th.far === 'spires') { const cell = Math.floor(wx / 46); const d = Math.abs((((wx % 46) + 46) % 46) - 23); hgt = 14 + Math.sin(wx / 30) * 4 + (h2(cell, 3) > 0.4 ? Math.max(0, 40 + h2(cell, 4) * 60 - d * 5) : 0); }
      else hgt = 26 + Math.sin(wx / 47) * 10 + Math.sin(wx / 17) * 4;
      const top = hz - Math.round(hgt);
      const snowLine = th.far === 'peaks' ? hz - hgt + 14 + Math.sin(wx / 7) * 3 : -1;
      ctx.fillStyle = th.hills[0]; ctx.fillRect(i, top, 1, hz - top + 80);
      if (th.far === 'peaks') { ctx.fillStyle = '#f1f3f5'; ctx.fillRect(i, top, 1, Math.max(0, snowLine - top)); }
      if (th.snow && th.far !== 'peaks') { ctx.fillStyle = '#ffffff'; ctx.fillRect(i, top, 1, 3); }
      if (th.far === 'candy') { ctx.fillStyle = '#ffffff'; ctx.fillRect(i, top, 1, 2 + Math.round(Math.abs(Math.sin(wx / 5)) * 2)); }
      const t2 = hz - Math.round(hgt * 0.45 + 6 + Math.sin(wx / 29) * 3);
      ctx.fillStyle = th.hills[1]; ctx.fillRect(i, t2, 1, hz - t2 + 80);
    }
    this.drawFarSights(ctx, far, hz);
    // far animals (specks without a zoom lens)
    for (const k of this.critters) if (k.far && !k.gone) this.drawCritter(ctx, k);
    // water (the fjord): a bay between the far shore and the near shore
    if (th.water) {
      const w0 = this.waterTop * Z; const w1 = this.shoreY * Z;
      for (let j = w0; j < w1 + 30; j += 1) { const k = (j - w0) / (w1 - w0); ctx.fillStyle = th.water[Math.min(2, Math.floor(k * 3))]; ctx.fillRect(0, j, W, 1); }
      const mid = this.dist * LAYER.mid * Z;
      for (let i = 0; i < 40; i += 1) { const wx = ((h2(i, 9) * 900 - mid * 0.8) % (W + 40) + W + 40) % (W + 40) - 20; P('#a5d8ff', wx, w0 + 6 + h2(i, 4) * (w1 - w0 - 10), 6, 1); }
    }
    // the middle ground
    const g = th.ground; const gy = (th.water ? this.shoreY : this.groundY) * Z - 4;
    for (let j = gy; j < H; j += 1) {
      const k = j - gy;
      ctx.fillStyle = k < 2 ? mix(g[0], '#ffffff', 0.25) : k < 18 ? g[0] : g[1];
      ctx.fillRect(0, j, W, 1);
    }
    // tufts of grass (or snow lumps, or moon dust) on the middle ground, moving with it
    const gm = this.dist * LAYER.mid * Z;
    for (let i = 0; i < 60; i += 1) {
      const span = W + 40; const gx = ((h2(i, 7) * 2000 - gm) % span + span) % span - 20; const gyy = gy + 4 + Math.floor(h2(i, 8) * (this.trackY * Z - gy - 30));
      const tuft = th.snow ? '#ffffff' : th.stars ? '#b4b8d8' : mix(g[0], '#ffffff', 0.2); const dk = mix(g[1], INK, 0.15);
      if (th.stars || th.underwater || th.far === 'islands') { P(tuft, gx, gyy, 3, 2); P(dk, gx, gyy + 2, 3, 1); P(tuft, gx + 5, gyy + 1, 2, 1); continue; }
      P(tuft, gx, gyy, 1, 2); P(tuft, gx + 2, gyy - 1, 1, 3); P(tuft, gx + 4, gyy, 1, 2); P(dk, gx, gyy + 2, 5, 1);
    }
    // sea animals surface in the bay, behind the near shore
    for (const k of this.critters) if (!k.gone && !k.far && k.c.sea && k.layer !== 'screen') this.drawCritter(ctx, k);
    // props and animals on the middle ground, back to front
    const mids = [...this.props.filter((p) => p.layer === 'mid'), ...this.critters.filter((k) => !k.gone && !k.far && !(k.c.sea && k.layer !== 'screen') && k.layer === 'mid')];
    mids.sort((a, b) => (a.y - b.y) || ((a.hides ? 1 : 0) - (b.hides ? 1 : 0)));
    for (const o of mids) {
      if (o.c) this.drawCritter(ctx, o);
      else this.drawProp(ctx, o);
    }
    // the Volcano: steam vents puff over whatever is behind them
    if (th.vents) for (const p of this.props) if (p.kind === 'vent' && p.layer === 'mid') this.drawSteam(ctx, p);
    // the track
    const ty = this.trackY * Z;
    const tr = this.dist * Z;
    P(mix(g[1], '#000000', 0.15), 0, ty - 4, W, 10);
    for (let i = -((tr) % 16); i < W; i += 16) P('#6e4b2a', i, ty + 1, 10, 3);
    P('#adb5bd', 0, ty - 1, W, 2); P('#ffffff', 0, ty - 1, W, 1);
    // a post now and then, whooshing by
    for (let i = -((tr * 1) % 260); i < W; i += 260) {
      if (th.post === 'lamp') { P('#adb5bd', i + 40, ty - 34, 2, 34); P(Math.floor(this.t * 2 + i) % 2 ? '#ff6b6b' : '#c92a2a', i + 39, ty - 36, 4, 3); continue; }
      if (th.post === 'cane') { for (let k = 0; k < 34; k += 1) P(Math.floor((k + 0) / 4) % 2 ? '#e03131' : '#ffffff', i + 40, ty - 34 + k, 3, 1); for (let a = 0; a <= Math.PI; a += 0.15) P(Math.floor(a * 3) % 2 ? '#e03131' : '#ffffff', i + 35 + Math.round(Math.cos(a) * 6.5), ty - 34 - Math.round(Math.sin(a) * 6), 3, 2); continue; }
      if (th.post === 'star') { P('#b197fc', i + 40, ty - 34, 2, 34); const tw = Math.floor(this.t * 3 + i) % 2; P('#ffd43b', i + 37, ty - 38, 8, 2); P('#ffd43b', i + 40, ty - 41, 2, 8); if (tw) P('#fff9db', i + 40, ty - 38, 2, 2); continue; }
      if (th.post === 'tube') continue;
      P('#5c3a1e', i + 40, ty - 34, 3, 34); P('#8b5a2b', i + 32, ty - 36, 18, 6); P('#b07a45', i + 33, ty - 35, 16, 1); P('#5c3a1e', i + 34, ty - 33, 14, 1);
    }
    // the embankment
    for (let j = ty + 6; j < H; j += 1) { ctx.fillStyle = j < ty + 9 ? '#868e96' : j < ty + 14 ? mix(th.bank || g[2], '#868e96', 0.4) : th.bank || g[2]; ctx.fillRect(0, j, W, 1); }
    for (let i = 0; i < 50; i += 1) { const span = W + 20; const gx = ((h2(i, 11) * 3000 - tr) % span + span) % span - 10; const gyy = ty + 10 + Math.floor(h2(i, 12) * (H - ty - 14)); P(mix(th.bank || g[2], '#ffffff', 0.18), gx, gyy, 3, 1); P(mix(th.bank || g[2], INK, 0.3), gx + 1, gyy + 1, 3, 1); }
    // the tunnel: a hill the track goes through, with a stone arch at each end
    const drawTunnel = () => {
    if (this.tunnel) {
      const a = (this.tunnel.x0 - this.dist) * Z; const b = (this.tunnel.x1 - this.dist) * Z;
      const style = th.tunnelStyle || 'stone';
      if (style === 'wormhole' && b > -120 && a < W + 120) { // a swirling portal at each end, and nothing else
        for (const sx of [a, b]) {
          if (sx < -70 || sx > W + 70) continue;
          const cols = ['#ffd43b', '#f783ac', '#9775fa', '#4dabf7', '#1a0f40'];
          for (let k = 0; k < 5; k += 1) { const R = 44 - k * 8; for (let q = 0; q < Math.PI * 2; q += 0.03) { const wob = Math.sin(q * 5 + this.t * 4 + k) * 1.5; P(cols[k], sx + Math.cos(q) * (R * 0.55 + wob), ty - 40 + Math.sin(q) * (R + wob), 3, 3); } }
          for (let j = -26; j <= 26; j += 1) { const half = Math.round(13 * Math.sqrt(1 - (j * j) / 676)); P('#0b0620', sx - half, ty - 40 + j, half * 2 + 1, 1); }
        }
      } else if (b > -120 && a < W + 120) {
        const hill = style === 'lava' ? '#3d3330' : style === 'cave' ? '#4a6a8a' : style === 'gate' ? '#9aa0a6' : th.snow ? '#e9eef5' : th.stars ? '#7d82a8' : mix(th.hills[1], g[1], 0.5);
        if (style === 'gate') { // the castle gatehouse: a stone wall with battlements and two towers
          const x0 = Math.max(-10, Math.floor(a - 40)); const x1 = Math.min(W + 10, Math.ceil(b + 40));
          if (x1 > x0) {
            P(mix(hill, '#000000', 0.35), x0, ty - 121, x1 - x0, 125); P(hill, x0, ty - 120, x1 - x0, 124);
            for (let j = ty - 116; j < ty; j += 8) for (let i = x0 + ((j / 8) % 2) * 8; i < x1; i += 16) P(mix(hill, '#000000', 0.15), i, j, 1, 8);
            for (let j = ty - 116; j < ty; j += 8) P(mix(hill, '#000000', 0.15), x0, j, x1 - x0, 1);
            for (let i = x0; i < x1; i += 14) { P(mix(hill, '#000000', 0.35), i - 1, ty - 131, 9, 11); P(hill, i, ty - 130, 7, 10); }
          }
          for (const tx of [a - 44, b + 44]) { if (tx < -40 || tx > W + 40) continue; P(mix(hill, '#000000', 0.35), tx - 17, ty - 151, 34, 155); P(mix(hill, '#ffffff', 0.08), tx - 16, ty - 150, 32, 154); for (let i = -16; i < 16; i += 10) P(mix(hill, '#ffffff', 0.08), tx + i, ty - 158, 6, 8); P('#15111c', tx - 2, ty - 120, 4, 9); P('#fcc419', tx - 1, ty - 182, 2, 26); P(Math.floor(this.t * 3) % 2 ? '#7048e8' : '#845ef7', tx + 1, ty - 182, 12, 8); }
        } else
        for (let i = Math.max(0, Math.floor(a - 50)); i < Math.min(W, Math.ceil(b + 50)); i += 1) {
          const e = Math.min(i - (a - 50), b + 50 - i);
          const top = ty - Math.min(150, 10 + e * 1.4) + Math.sin(i / 9) * 2;
          P(mix(hill, '#000000', 0.3), i, top - 1, 1, 1); P(hill, i, top, 1, ty - top + 4); P(mix(hill, '#ffffff', 0.25), i, top, 1, 2);
          const band = top + (ty - top) * 0.45; P(mix(hill, '#000000', 0.08), i, band, 1, ty - band + 4);
          if (style === 'lava' && (i * 5) % 17 === 0) { P('#ff6b1a', i, top + 10 + (i % 19), 1, 4); P('#ffd43b', i, top + 11 + (i % 19), 1, 1); }
          else if (style === 'cave' && (i * 7) % 29 === 0) { P('#ff8787', i, top + 1, 2, 3); P('#ffa94d', i + 3, top, 1, 4); }
          else if (!th.stars && !th.snow && (i * 7) % 23 === 0) { P(mix(hill, '#ffffff', 0.3), i, top + 6 + (i % 13), 1, 2); P(mix(hill, '#ffffff', 0.3), i + 2, top + 5 + (i % 13), 1, 3); }
        }
        for (const sx of [a, b]) {
          if (sx < -60 || sx > W + 60) continue;
          // a round-topped stone arch: walls up to the spring line, then a half circle
          for (let d = 0; d <= 52; d += 1) {
            const u = d - 22;
            const out = u <= 0 ? 29 : u <= 29 ? Math.round(Math.sqrt(29 * 29 - u * u)) : -1;
            const inn = u <= 0 ? 20 : u <= 20 ? Math.round(Math.sqrt(20 * 20 - u * u)) : -1;
            if (out < 0) continue;
            const [s0, s1, s2] = style === 'lava' ? ['#1a1210', '#4a3a34', '#2b211d'] : style === 'cave' ? ['#1f3550', '#3d5a7a', '#2f4a68'] : ['#3b3f46', '#5c636a', '#868e96'];
            P(s0, sx - out - 1, ty - d, out * 2 + 3, 1);
            P((d + Math.floor(sx)) % 6 < 1 ? s1 : s2, sx - out, ty - d, out * 2 + 1, 1);
            if (inn >= 0) P(style === 'lava' ? '#3a1408' : '#15111c', sx - inn, ty - d, inn * 2 + 1, 1);
            if (style === 'lava' && inn >= 0) { P('#ff6b1a', sx - inn, ty - d, 1, 1); P('#ff6b1a', sx + inn, ty - d, 1, 1); }
            if (style === 'gate' && inn >= 0 && d > 30 && d % 4 === 0) P('#343a40', sx - inn, ty - d, inn * 2 + 1, 1); // the portcullis, raised
          }
        }
      }
    }
    };
    drawTunnel();
    // inside the tunnel: stone walls hide the map
    const dk = this.dark();
    if (dk > 0) {
      ctx.globalAlpha = dk;
      const style = th.tunnelStyle || 'stone';
      const [w0, w1, w2] = { lava: ['#3a160c', '#5a2410', '#ff6b1a'], cave: ['#0f2a44', '#173a5c', '#1f4a70'], wormhole: ['#140a33', '#2a1660', '#9775fa'] }[style] || ['#2a2430', '#3a3342', '#463e50'];
      ctx.fillStyle = w0; ctx.fillRect(0, 0, W, ty + 6);
      const sh = (this.dist * Z) % 24;
      if (style === 'wormhole') { for (let i = 0; i < 40; i += 1) { const x2 = ((h2(i, 1) * W * 2 - this.dist * Z * (1 + h2(i, 2) * 2)) % W + W) % W; P(['#ffd43b', '#f783ac', '#4dabf7', '#ffffff'][i % 4], x2, h2(i, 3) * ty, 10 + h2(i, 4) * 16, 1); } }
      else if (style === 'lava') { for (let j = 0; j < ty; j += 14) for (let i = -sh - ((j / 14) % 2) * 12; i < W; i += 24) { P(w1, i, j, 20, 11); if ((i + j) % 3 === 0) P(w2, i + 4, j + 11, 12, 1); } }
      else for (let j = 0; j < ty; j += 10) for (let i = -sh - ((j / 10) % 2) * 12; i < W; i += 24) { P(w1, i, j, 22, 8); P(w2, i, j, 22, 1); }
      ctx.globalAlpha = 1;
    }
    // the track animal (in front of the middle ground)
    for (const k of this.critters) if (!k.gone && k.layer === 'screen' && !k.far && k.how === 'track') this.drawCritter(ctx, k);
    // the Castle's drawbridge
    if (this.bridge) this.drawBridge(ctx, ty);
    // the train
    this.drawTrain(ctx, shake);
    // under the sea: the glass tube the train runs in
    if (th.underwater) {
      ctx.fillStyle = 'rgba(208,235,255,0.07)'; ctx.fillRect(0, ty - 78, W, 84);
      P('rgba(231,245,255,0.55)', 0, ty - 78, W, 2); P('rgba(231,245,255,0.25)', 0, ty - 74, W, 1);
      for (let i = -((tr) % 130); i < W; i += 130) { ctx.fillStyle = 'rgba(231,245,255,0.3)'; ctx.fillRect(Math.round(i + 20), ty - 78, 3, 84); ctx.fillStyle = 'rgba(255,255,255,0.18)'; ctx.fillRect(Math.round(i + 60), ty - 70, 10, 2); }
    }
    if (this.tunnel && dk === 0) { // going in: the hill and the dark opening cover the front of the train
      const sx = (this.tunnel.x0 - this.dist) * Z;
      if (sx > 0 && sx < W) { ctx.save(); ctx.beginPath(); ctx.rect(sx, 0, W - sx, ty + 6); ctx.clip(); drawTunnel(); ctx.restore(); }
    }
    // flying things over everything
    for (const k of this.critters) if (!k.gone && k.layer === 'screen' && k.how === 'fly') this.drawCritter(ctx, k);
    // a bush right in front, now and then
    for (const p of this.props) if (p.layer === 'fore') this.drawProp(ctx, p);
    // weather (none in the tunnel)
    if (dk < 1) this.drawWeather(ctx);
    // the tunnel's dark, with glowing eyes; a snap's flash lights it up
    if (dk > 0) {
      const lit = this.t - this.flash < 0.25;
      const dim = th.tunnelStyle === 'lava' ? 0.55 : th.tunnelStyle === 'wormhole' ? 0.45 : 0.8;
      ctx.fillStyle = th.tunnelStyle === 'lava' ? `rgba(30,6,0,${(lit ? 0.05 : dim) * dk})` : `rgba(8,6,16,${(lit ? 0.05 : dim) * dk})`;
      ctx.fillRect(0, 0, W, H);
      const tx1 = this.carX * Z + 122;
      if (!lit) {
        // the train stays easy to see in there
        ctx.globalAlpha = 0.75 * dk; this.drawTrain(ctx, shake); ctx.globalAlpha = 1;
        // the engine's headlamp lights the way, and lamps on the wall go by
        ctx.globalAlpha = 0.22 * dk; ctx.fillStyle = '#fff3bf';
        ctx.beginPath(); ctx.moveTo(tx1 - 6, ty - 30); ctx.lineTo(W, ty - 70); ctx.lineTo(W, ty + 6); ctx.closePath(); ctx.fill();
        ctx.globalAlpha = dk;
        for (let i = -((this.dist * Z) % 240); i < W; i += 240) { const lx = i + 120; const ly = ty - 90; ctx.globalAlpha = 0.25 * dk; ctx.fillStyle = '#ffd43b'; ctx.fillRect(lx - 10, ly - 8, 22, 18); ctx.globalAlpha = dk; P('#343a40', lx - 1, ly - 6, 4, 2); P('#ffe066', lx, ly - 4, 2, 4); P('#fff9db', lx, ly - 3, 2, 1); }
        ctx.globalAlpha = 1;
      }
      if (!lit) for (const k of this.critters) if (k.bat && !k.gone) { const g = this.geom(k); const ex = g.sx + (g.pic.eye?.[0] ?? g.w / 2); const ey = g.top + (g.pic.eye?.[1] ?? g.h / 3); const f = Math.sin(this.t * 14 + (k.x || 0)) > 0 ? 1 : 0; P('#8a6a4a', ex - 10, ey + 2 - f * 3, 7, 1); P('#8a6a4a', ex + 5, ey + 2 - f * 3, 7, 1); P('#ffd43b', ex - 3, ey, 2, 2); P('#ffd43b', ex + 2, ey, 2, 2); }
    }
    // the sunset: everything turns pink and dusky as the sun goes down
    if (dusk > 0.4) { ctx.fillStyle = `rgba(80,30,110,${0.32 * ((dusk - 0.4) / 0.6) ** 1.5})`; ctx.fillRect(0, 0, W, H); }
    // the photo: copy what was really in the viewfinder
    if (this.capture) {
      const s = this.capture; this.capture = null;
      const fw = Math.round(s.frame.w * Z); const fh = Math.round(s.frame.h * Z);
      const pic = canvas(fw, fh); const pc = pic.getContext('2d');
      try { pc.drawImage(ctx.canvas, Math.round(s.frame.x * Z), Math.round(s.frame.y * Z), fw, fh, 0, 0, fw, fh); } catch { /* fine */ }
      if (s.quality === 'blurry') blur(pic);
      s.pic = pic;
    }
    // the flash
    if (this.t - this.flash < 0.09) { ctx.fillStyle = 'rgba(255,255,255,0.75)'; ctx.fillRect(0, 0, W, H); }
  }

  /** Things on the far hills that scroll with them: the Castle's castle, the Volcano's smoking cone. */
  drawFarSights(ctx, far, hz) {
    const th = this.theme; const W = this.W * Z;
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    if (th.far === 'castle') {
      const per = 560;
      for (let k = Math.floor((far - 120) / per); k * per - far < W + 120; k += 1) {
        const cx = k * per + 280 - far; if (cx < -80 || cx > W + 80) continue;
        const base = hz - Math.round(26 + Math.sin((cx + far) / 47) * 10 + Math.sin((cx + far) / 17) * 4) + 3;
        const col = th.snow ? '#aab4c4' : '#8f99ab'; const dk = mix(col, '#2b2f3a', 0.3);
        P(col, cx - 30, base - 16, 60, 16); P(col, cx - 10, base - 30, 20, 30);
        for (const tx of [cx - 34, cx + 26]) { P(col, tx, base - 28, 9, 28); P(dk, tx + 1, base - 32, 2, 4); P(dk, tx + 6, base - 32, 2, 4); P(dk, tx + 3, base - 22, 2, 3); }
        for (let i = -28; i < 30; i += 5) P(col, cx + i, base - 19, 3, 3);
        for (let i = -9; i < 10; i += 5) P(col, cx + i, base - 33, 3, 3);
        P(dk, cx - 3, base - 8, 6, 8); P(dk, cx - 2, base - 24, 2, 3); P(dk, cx + 2, base - 24, 2, 3);
        P('#fcc419', cx, base - 44, 1, 11); P(Math.floor(this.t * 3) % 2 ? '#7048e8' : '#845ef7', cx + 1, base - 44, 7, 4);
      }
    }
    if (th.far === 'volcano') {
      for (let k = Math.floor((far - 200) / 760); k * 760 - far < W + 200; k += 1) {
        const px = k * 760 + 380 - far; if (px < -120 || px > W + 120) continue;
        const top = hz - 112;
        // lava glowing down the cone
        for (let i = -10; i <= 10; i += 1) { const len = 12 + Math.round(h2(k, i + 20) * 34); for (let j = 0; j < len; j += 1) if ((j + i * 3) % 7 < 4) P(j < 3 ? '#ffd43b' : '#ff6b1a', px + i + Math.round(Math.sin(j / 5 + i) * (j / 12)), top + 4 + j, 1, 1); }
        P('#ff922b', px - 8, top, 16, 3); P('#ffd43b', px - 4, top, 8, 2);
        // a plume of smoke drifting off
        for (let i = 0; i < 7; i += 1) { const a = (this.t * 0.18 + i / 7) % 1; const r = 5 + a * 16; ctx.fillStyle = `rgba(90,80,80,${0.55 * (1 - a)})`; const cy = top - 6 - a * 70; const cx = px + a * 40 + Math.sin(i) * 4; for (let j = -r; j <= r; j += 1) { const half = Math.sqrt(Math.max(0, r * r - j * j)); ctx.fillRect(Math.round(cx - half), Math.round(cy + j * 0.7), Math.round(half * 2), 1); } }
      }
    }
  }

  /** The Volcano's steam vents: a puff now and then that hides what is behind it. */
  drawSteam(ctx, p) {
    const f = this.puff(p); if (f <= 0) return;
    const x = Math.round(this.sx('mid', p.x) * Z); const y = Math.round(p.y * Z);
    for (let i = 0; i < 6; i += 1) {
      const a = ((this.t * 0.42 + h2(p.seed, 1)) % 1) / 0.38;
      const r = 8 + i * 3 + a * 6; const cy = y - 12 - i * 13 - a * 10; const cx = x + Math.sin(i * 1.7 + this.t) * 4;
      ctx.fillStyle = `rgba(245,245,250,${0.82 * f * (1 - i / 9)})`;
      for (let j = -r; j <= r; j += 1) { const half = Math.sqrt(Math.max(0, r * r - j * j)); ctx.fillRect(Math.round(cx - half), Math.round(cy + j * 0.8), Math.round(half * 2), 1); }
    }
  }

  /** The Castle's drawbridge: up while the train waits at the moat, then down to cross. */
  drawBridge(ctx, ty) {
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const sx = this.sx('track', this.bridge.x) * Z; const L = 76;
    const f = clamp((this.t - (this.bridge.until - 1.6)) / 1.6, 0, 1);
    // the moat under the bridge, and the gate tower on the far side
    P(this.theme.water[1], sx, ty - 2, L, 14); P('#a5d8ff', sx + 10, ty + 2, 10, 1); P('#a5d8ff', sx + 44, ty + 6, 12, 1);
    P('#5c636a', sx + L - 1, ty - 141, 30, 151); P('#9aa0a6', sx + L, ty - 140, 28, 150);
    for (let i = 0; i < 28; i += 9) P('#9aa0a6', sx + L + i, ty - 148, 5, 8);
    for (let j = ty - 132; j < ty; j += 10) P('#868e96', sx + L, j, 28, 1);
    P('#15111c', sx + L + 2, ty - 60, 24, 60);
    // the plank, hinged at the tower: straight up, then lowered flat
    const ang = (1 - f) * Math.PI / 2; const px = sx + L; const py = ty - 2;
    for (let t = 0; t <= L; t += 1) {
      const x = px - Math.cos(ang) * t; const y = py - Math.sin(ang) * t;
      P('#3d2a18', x - 3, y - 3, 7, 7);
    }
    for (let t = 0; t <= L; t += 1) { const x = px - Math.cos(ang) * t; const y = py - Math.sin(ang) * t; P(t % 8 < 1 ? '#5c3a1e' : '#8b5a2b', x - 2, y - 2, 5, 5); }
    // chains from the top of the tower to the end of the plank
    const ex = px - Math.cos(ang) * L; const ey = py - Math.sin(ang) * L;
    for (let t = 0; t <= 1; t += 0.03) P('#495057', px + 2 + (ex - px - 2) * t, ty - 110 + (ey - ty + 110) * t, 2, 2);
  }

  drawWeather(ctx) {
    const W = this.W * Z; const H = this.H * Z; const t = this.t;
    if (this.theme.stars) {
      // the moon has no rain: meteors (rain), sparkly star dust (snow), drifting moon dust (mist)
      if (this.weather === 'rain') for (let i = 0; i < 4; i += 1) { const a = (t * 0.7 + h2(i, 5)) % 1.6; if (a > 1) continue; const x = W * (0.2 + h2(i, 6) * 0.9) - a * 160; const y = 10 + h2(i, 7) * 50 + a * 70; for (let k = 0; k < 14; k += 1) { ctx.fillStyle = k < 2 ? '#ffffff' : `rgba(255,212,59,${1 - k / 14})`; ctx.fillRect(Math.round(x + k * 2.3), Math.round(y - k), 2, 1); } }
      if (this.weather === 'snow') for (let i = 0; i < 30; i += 1) { if ((Math.floor(t * 3 + i) % 4)) continue; ctx.fillStyle = ['#ffffff', '#ffd43b', '#b197fc'][i % 3]; ctx.fillRect(h2(i, 1) * W, h2(i, 2) * H * 0.6, 1, 1); }
      if (this.weather === 'mist') { ctx.fillStyle = 'rgba(180,184,216,0.2)'; ctx.fillRect(0, this.groundY * Z - 20, W, 50); }
      return;
    }
    if (this.theme.underwater) {
      // bubbles always rise; the day's weather is sea weather
      for (let i = 0; i < 14; i += 1) { const x = (h2(i, 1) * W + Math.sin(t * 2 + i) * 3 - (this.weather === 'wind' ? t * 30 : 0) % W + W) % W; const y = H - ((t * (18 + h2(i, 3) * 20) + h2(i, 2) * H) % H); ctx.fillStyle = 'rgba(231,245,255,0.7)'; ctx.fillRect(Math.round(x), Math.round(y), 2, 2); ctx.fillStyle = 'rgba(255,255,255,0.9)'; ctx.fillRect(Math.round(x), Math.round(y), 1, 1); }
      if (this.weather === 'snow') { ctx.fillStyle = 'rgba(255,255,255,0.8)'; for (let i = 0; i < 50; i += 1) ctx.fillRect((h2(i, 1) * W - t * 4 + W * 4) % W, (h2(i, 2) * H + t * 6) % H, 1, 1); }
      if (this.weather === 'rain') { ctx.fillStyle = 'rgba(105,219,124,0.12)'; ctx.fillRect(0, 0, W, H); ctx.fillStyle = 'rgba(169,227,75,0.7)'; for (let i = 0; i < 40; i += 1) ctx.fillRect((h2(i, 1) * W - t * 8 + W * 4) % W, (h2(i, 2) * H + Math.sin(t + i) * 4 + H) % H, 1, 1); }
      if (this.weather === 'mist') { ctx.fillStyle = 'rgba(40,90,100,0.22)'; ctx.fillRect(0, 0, W, H); }
      if (this.weather === 'wind') { ctx.fillStyle = 'rgba(231,245,255,0.35)'; for (let i = 0; i < 6; i += 1) { const x = W - ((t * 90 + i * 97) % (W + 60)); ctx.fillRect(x, 20 + h2(i, 3) * H * 0.6 + Math.sin(t * 3 + i) * 3, 18, 1); } }
      return;
    }
    if (this.theme.rainbowHunt && this.weather === 'rain') { const cols = RAINBOW.map((c) => c[1]); for (let i = 0; i < 60; i += 1) { ctx.fillStyle = cols[i % cols.length]; const x = (h2(i, 1) * W - t * 10 + W * 4) % W; const y = (h2(i, 2) * H + t * 70) % H; ctx.fillRect(x, y, 1, 3); } return; }
    if (this.theme.rainbowHunt && this.weather === 'mist') { ctx.fillStyle = 'rgba(252,194,215,0.25)'; ctx.fillRect(0, this.horizon * Z - 30, W, 70); ctx.fillStyle = 'rgba(255,240,246,0.15)'; ctx.fillRect(0, 0, W, H); return; }
    if (this.weather === 'rain') { ctx.fillStyle = 'rgba(200,220,255,0.55)'; for (let i = 0; i < 70; i += 1) { const x = (h2(i, 1) * W + t * 40 - (t * 160 + h2(i, 2) * H) * 0.3) % W; const y = (h2(i, 2) * H + t * 160) % H; ctx.fillRect((x + W) % W, y, 1, 4); } }
    if (this.weather === 'snow') { ctx.fillStyle = '#ffffff'; for (let i = 0; i < 60; i += 1) { const x = (h2(i, 1) * W - t * 25 + Math.sin(t + i) * 6 + W * 4) % W; const y = (h2(i, 2) * H + t * 18) % H; ctx.fillRect(x, y, i % 3 ? 1 : 2, i % 3 ? 1 : 2); } }
    if (this.weather === 'mist') { ctx.fillStyle = 'rgba(235,240,245,0.28)'; ctx.fillRect(0, this.horizon * Z - 30, W, 70); ctx.fillStyle = 'rgba(235,240,245,0.15)'; ctx.fillRect(0, 0, W, H); }
    if (this.weather === 'wind') { ctx.fillStyle = 'rgba(255,255,255,0.6)'; for (let i = 0; i < 6; i += 1) { const x = W - ((t * 120 + i * 97) % (W + 60)); const y = 20 + h2(i, 3) * H * 0.6; ctx.fillRect(x, y + Math.sin(t * 4 + i) * 2, 14, 1); } }
  }

  drawTrain(ctx, shake) {
    const [body, trim] = this.theme.train; const ty = this.trackY * Z; const cx = this.carX * Z;
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const bob = shake;
    const spin = this.dist * 0.6;
    const wheel = (x, R = 7) => { // round, with a hub and a spoke that turns
      const cy = ty + 3 - R;
      for (let j = -R - 1; j <= R + 1; j += 1) { const h = Math.round(Math.sqrt(Math.max(0, (R + 1) * (R + 1) - j * j))); P(INK, x - h, cy + j, h * 2, 1); }
      for (let j = -R; j <= R; j += 1) { const h = Math.round(Math.sqrt(Math.max(0, R * R - j * j))); P(j < -R / 2 ? '#6c757d' : '#495057', x - h + 1, cy + j, h * 2 - 2, 1); }
      for (let k = 0; k < 2; k += 1) { const a = spin + k * Math.PI / 2; for (let q = -R + 2; q <= R - 2; q += 1) P('#343a40', x + Math.round(Math.cos(a) * q) - 1, cy + Math.round(Math.sin(a) * q), 2, 1); }
      P('#ced4da', x - 1, cy - 1, 2, 2);
      return cy;
    };
    // the open car with the buddies
    const c0 = cx - 46; const cw = 92;
    for (const p of [this.vis, this.kid]) { p.y = this.trackY - 7 + bob / Z; p.paint(this.t); }
    ctx.save(); ctx.scale(Z, Z); for (const p of [this.vis, this.kid]) p.draw(ctx); ctx.restore();
    // the kid's camera, up when the viewfinder is out
    const up = this.view ? 1 : 0;
    const kx = this.kid.x * Z + 10; const ky = (this.kid.y - 13 - up * 3) * Z + bob;
    P(INK, kx - 1, ky - 1, 12, 9); P('#343a40', kx, ky, 10, 7); P('#adb5bd', kx + 1, ky + 1, 3, 2); P('#74c0fc', kx + 6, ky + 2, 3, 3);
    P(INK, c0 - 1, ty - 25 + bob, cw + 2, 21); P(body, c0, ty - 24 + bob, cw, 19); P(trim, c0, ty - 24 + bob, cw, 3); P(mix(body, INK, 0.3), c0, ty - 9 + bob, cw, 4);
    wheel(c0 + 16, 6); wheel(c0 + cw - 16, 6);
    // the engine, ahead (to the right)
    const e0 = c0 + cw + 6; const ew = 70;
    P(INK, c0 + cw, ty - 12 + bob, 7, 3);
    P(INK, e0 - 1, ty - 47 + bob, 32, 44); P(body, e0, ty - 46 + bob, 30, 42); P('#a5d8ff', e0 + 6, ty - 40 + bob, 16, 12); P(trim, e0, ty - 48 + bob, 32, 4);
    P(INK, e0 + 29, ty - 33 + bob, ew - 28, 30); P(mix(body, INK, 0.15), e0 + 30, ty - 32 + bob, ew - 30, 28); P(trim, e0 + 30, ty - 22 + bob, ew - 30, 3);
    P(INK, e0 + ew - 20, ty - 52 + bob, 12, 20); P('#343a40', e0 + ew - 19, ty - 51 + bob, 10, 19); P(INK, e0 + ew - 22, ty - 54 + bob, 16, 4);
    const wy = wheel(e0 + 12); wheel(e0 + 34); wheel(e0 + 56, 6);
    // the coupling rod, going round with the wheels
    const ox = Math.round(Math.cos(spin) * 4); const oy = Math.round(Math.sin(spin) * 4);
    P(INK, e0 + 11 + ox, wy + oy - 1, 25, 4); P('#adb5bd', e0 + 12 + ox, wy + oy, 23, 2);
    // a dome on the boiler, a headlamp, and a cowcatcher
    P(INK, e0 + 39, ty - 39 + bob, 12, 7); P(trim, e0 + 40, ty - 38 + bob, 10, 6); P(mix(trim, '#ffffff', 0.4), e0 + 41, ty - 38 + bob, 3, 2);
    P(INK, e0 + ew - 3, ty - 30 + bob, 8, 8); P('#fff3bf', e0 + ew - 2, ty - 29 + bob, 6, 6); P('#ffffff', e0 + ew - 1, ty - 28 + bob, 2, 2);
    for (let k = 0; k < 9; k += 1) { P(INK, e0 + ew - 2 + Math.floor(k / 1.5), ty - 8 + k + bob, 2, 1); P('#c92a2a', e0 + ew - 4, ty - 8 + k + bob, Math.max(1, Math.floor(k / 1.5) + 1), 1); }
    // steam puffs
    for (let i = 0; i < 5; i += 1) {
      const age = (this.t * (0.4 + this.speed / SPEED) + i / 5) % 1;
      const sx = e0 + ew - 14 - age * 70 * (this.speed / SPEED + 0.15); const sy = ty - 58 + bob - age * 26; const s = 4 + age * 10;
      ctx.fillStyle = `rgba(255,255,255,${0.85 * (1 - age)})`;
      const rr = Math.round(s / 2); for (let j = -rr; j <= rr; j += 1) { const half = Math.round(Math.sqrt(Math.max(0, rr * rr - j * j))); ctx.fillRect(Math.round(sx - half), Math.round(sy + j * 0.8), half * 2, 1); }
    }
  }

  /** Where a critter's picture goes now, in fine pixels: the picture, its scale, box, how much shows. */
  geom(k) {
    const pic = k.pics(this.look(k));
    const [x0, y] = this.where(k);
    const x = k.flyX ?? x0;
    const s = k.far ? 0.45 : 1; // far animals are small (and only specks without a zoom lens)
    const w = pic.width * s; const h = pic.height * s;
    const top = y * Z - h - (k.lift || 0) * Z;
    let show = 1;
    const up = k.how === 'rise' || k.how === 'surface' || k.how === 'hop';
    if (k.state === 'sign') show = 0;
    else if (k.state === 'emerge' && up) show = clamp((this.t - (k.st || k.t0)) / 0.35, 0, 1);
    else if (k.state === 'leave' && up) show = 1 - clamp((this.t - k.st) / 0.4, 0, 1);
    let dx = 0;
    if (k.how === 'step') {
      const out = k.state === 'emerge' ? clamp((this.t - k.st) / 0.7, 0, 1) : k.state === 'leave' ? 1 - clamp((this.t - k.st) / 0.8, 0, 1) : k.state === 'sign' ? 0 : 1;
      dx = -Math.round(out * (w * 0.55));
    }
    return { pic, s, w, h, top, show, dx, cx: x, sx: Math.round(x * Z - w / 2 + dx) };
  }

  drawCritter(ctx, k) {
    const { pic, s, w, h, top, dx } = this.geom(k);
    let { show } = this.geom(k);
    const [x0] = this.where(k);
    const x = k.flyX ?? x0;
    const far = k.far;
    if (k.how === 'step' && k.state === 'sign') show = 0.25; // its tail end, poking out from behind the trunk
    if (k.how === 'perch' && k.state === 'inbound') { show = 1; }
    if (k.c.camo && (k.state === 'sign' || k.state === 'emerge')) show = 1;
    else if (k.state === 'sign' && k.how !== 'step') { this.drawSign(ctx, k); return; }
    const vis = Math.round(h * show);
    if (vis <= 0) return;
    const sx = Math.round(x * Z - w / 2 + dx);
    ctx.save();
    if (k.face > 0) { ctx.translate(Math.round(x * Z * 2 + dx * 2), 0); ctx.scale(-1, 1); }
    const camo = k.c.camo && (k.state === 'sign' || k.state === 'emerge');
    if (far && !this.cam.zoom) {
      ctx.globalAlpha = 0.9; ctx.filter = 'brightness(0.35)';
    } else if (camo) { // the octopus, still pretending to be a rock: it blinks before it changes color
      ctx.filter = k.state === 'emerge' ? 'grayscale(0.5) brightness(0.9)' : Math.floor(this.t * 3) % 4 === 0 ? 'grayscale(1) brightness(1.05)' : 'grayscale(1) brightness(0.72)';
    } else if (this.theme.goldCamo && k.state !== 'pose' && !far) { // gold on gold: true colors only when it poses
      ctx.filter = 'sepia(1) saturate(2.4) brightness(1.06)';
    } else if (k.state === 'pose') ctx.filter = 'brightness(1.12)'; // brighter means "now!"
    // a little perk hop as it turns to look
    const perk = k.state === 'pose' && this.t - k.st < 0.12 ? -Z : 0;
    ctx.translate(0, perk);
    if (k.how === 'step' && k.state === 'sign') {
      // just the back end, beside the trunk
      ctx.drawImage(pic, pic.width * 0.6, 0, pic.width * 0.4, pic.height, Math.round(x * Z + 2), Math.round(top), w * 0.4, h);
    } else ctx.drawImage(pic, 0, 0, pic.width, Math.round(pic.height * show), sx, Math.round(top + (h - vis) * (k.how === 'rise' || k.how === 'surface' || k.how === 'hop' ? 1 : 0)), w, vis);
    ctx.restore();
    // the pose sparkle
    if (k.state === 'pose' && !far && pic.eye && this.t - k.st < 0.6) {
      const ex = sx + pic.eye[0] * s + 4; const ey = top + pic.eye[1] * s - 7;
      const P = (a, b, ww = 1, hh = 1) => { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(a), Math.round(b), ww, hh); };
      const n = Math.floor((this.t - k.st) * 8) % 2 ? 2 : 3;
      P(ex - n, ey, 2 * n + 1, 1); P(ex, ey - n, 1, 2 * n + 1);
    }
    // the cover in front (a bush, a log), so a rising animal comes up from behind it
    if (k.cover && (k.how === 'rise' || k.how === 'step')) this.drawProp(ctx, k.cover, true);
    if (far && !this.cam.zoom && this.view) { ctx.fillStyle = '#ffd43b'; ctx.font = '10px monospace'; }
  }

  /** A sign before an animal: rustling, ripples, a call. */
  drawSign(ctx, k) {
    const [x, y] = this.where(k); const t = this.t;
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    if (this.theme.goldCamo && k.how !== 'fly' && k.how !== 'perch') { // gold on gold: no rustle, only a glint now and then
      if (Math.floor(t * 2.5 + (k.id % 7)) % 2 === 0) {
        const gx = x * Z + ((k.id >> 3) % 9) - 4; const gy = y * Z - 10;
        P('#d9480f', gx - 4, gy - 1, 9, 3); P('#d9480f', gx - 1, gy - 4, 3, 9); P('#ffffff', gx - 3, gy, 7, 1); P('#ffffff', gx, gy - 3, 1, 7);
        if (!this.glintHint) { this.glintHint = true; addPop(this, 'Watch for the glint!', x, y - 16, '#ffd43b'); }
      }
      return;
    }
    if (k.how === 'surface') { const r = 4 + ((t * 10) % 8); P('#e7f5ff', x * Z - r, y * Z - 1, r * 2, 1); P('#a5d8ff', x * Z - r / 2, y * Z + 1, r, 1); return; }
    if (k.how === 'fly' || k.how === 'perch') { if (Math.floor(t * 4) % 2) { P('#ffffff', this.W * Z - 14, this.H * Z * 0.2, 2, 6); P('#ffffff', this.W * Z - 14, this.H * Z * 0.2, 5, 2); P('#ffffff', this.W * Z - 16, this.H * Z * 0.2 + 5, 3, 2); } return; }
    // bits of leaf or dust jumping off the cover
    for (let i = 0; i < 3; i += 1) { const a = (t * 3 + i / 3) % 1; P(i % 2 ? '#d8f5a2' : '#ffffff', x * Z - 6 + i * 6 + Math.sin(t * 20 + i) * 2, y * Z - 18 - a * 10, 2, 2); }
  }

  drawProp(ctx, p, front = false) {
    const th = this.theme;
    const x = Math.round(this.sx(p.layer, p.x) * Z); const y = Math.round(p.y * Z);
    // scenery has no ink outline (that is for the animals): its edge is a dark shade of the ground
    const EDGE = mix(th.stars && !th.goldCamo ? '#46496e' : (th.ground || ['#2b4a36'])[1], '#000000', 0.45);
    const P = (col, a, b, w = 1, h = 1) => { ctx.fillStyle = col === INK ? EDGE : col; ctx.fillRect(Math.round(a), Math.round(b), w, h); };
    const r = (i) => h2(p.seed, i);
    // a sign: the cover shakes
    const shake = p.hides && p.hides.state === 'sign' && p.hides.how !== 'step' ? Math.round(Math.sin(this.t * 40) * 1) : 0;
    const leaf = th.leaf || ['#2f9e44', '#40c057'];
    const blob = (cx, cy, rx, ry, col, light) => {
      for (let j = -ry; j <= ry; j += 1) {
        const half = Math.round(rx * Math.sqrt(Math.max(0, 1 - (j * j) / (ry * ry))));
        P(INK, cx - half - 1, cy + j, half * 2 + 3, 1);
      }
      for (let j = -ry + 1; j <= ry - 1; j += 1) {
        const half = Math.round((rx - 1) * Math.sqrt(Math.max(0, 1 - (j * j) / ((ry - 1) * (ry - 1)))));
        P(j < -ry * 0.3 ? light : col, cx - half, cy + j, half * 2 + 1, 1);
      }
    };
    // a lumpy tree top: overlapping balls with one outline, lit from the top left
    const canopy = (cx, cy, R, col) => {
      const rm = ramp(col, 3, 2);
      const balls = [[0, 0, R], [-R * 0.62, R * 0.2, R * 0.7], [R * 0.62, R * 0.25, R * 0.72], [-R * 0.3, -R * 0.45, R * 0.66], [R * 0.35, -R * 0.4, R * 0.6]].map(([a, b, rr]) => [cx + a, cy + b, Math.round(rr)]);
      const disc = (bx, by, rr, c) => { for (let j = -rr; j <= rr; j += 1) { const half = Math.round(Math.sqrt(Math.max(0, rr * rr - j * j))); P(c, bx - half, by + j, half * 2 + 1, 1); } };
      for (const [bx, by, rr] of balls) disc(bx, by, rr + 1, mix(rm[0], '#000000', 0.25));
      for (const [bx, by, rr] of balls) disc(bx, by, rr, rm[2]);
      for (const [bx, by, rr] of balls) disc(bx - rr * 0.2, by - rr * 0.2, Math.round(rr * 0.7), rm[3]);
      for (const [bx, by, rr] of balls.slice(3)) disc(bx - rr * 0.35, by - rr * 0.35, Math.round(rr * 0.35), rm[4]);
      for (let i = 0; i < 10; i += 1) P(rm[1], cx - R + r(30 + i) * R * 2, cy + r(40 + i) * R * 0.8, 2, 1);
    };
    switch (p.kind) {
      case 'oak': {
        if (front) return;
        const h = 62 + Math.round(r(1) * 26);
        const bare = th.season === 'winter';
        if (bare) { P(INK, x - 3, y - h + 10, 6, h - 10); P('#7a4a26', x - 2, y - h + 10, 4, h - 10); P('#9a6438', x - 2, y - h + 10, 1, h - 10); }
        else { P(INK, x - 5, y - h + 10, 11, h - 10); P('#7a4a26', x - 4, y - h + 10, 9, h - 10); P('#9a6438', x - 4, y - h + 10, 2, h - 10); P('#5c3a1e', x + 3, y - h + 10, 2, h - 10); }
        P(INK, x - 8, y - 2, 17, 2); P('#7a4a26', x - 7, y - 2, 15, 1);
        const col = leaf[Math.floor(r(2) * leaf.length)];
        if (th.season === 'winter') {
          // bare branches, snow along their tops
          const twig = (x0, y0, a, len, depth) => {
            const x1 = x0 + Math.cos(a) * len; const y1 = y0 + Math.sin(a) * len;
            const n = Math.ceil(len);
            for (let i = 0; i <= n; i += 1) { const px = x0 + ((x1 - x0) * i) / n; const py = y0 + ((y1 - y0) * i) / n; P(INK, px - 1, py - 1, depth > 1 ? 3 : 2, depth > 1 ? 3 : 2); }
            for (let i = 0; i <= n; i += 1) { const px = x0 + ((x1 - x0) * i) / n; const py = y0 + ((y1 - y0) * i) / n; P('#7a4a26', px, py, depth > 1 ? 2 : 1, 1); if (i % 2 === 0 && depth > 1) P('#ffffff', px, py - 1, 2, 1); }
            if (depth > 0) { twig(x1, y1, a - 0.5 - r(depth * 3 + len) * 0.3, len * 0.66, depth - 1); twig(x1, y1, a + 0.45 + r(depth * 5 + len) * 0.3, len * 0.62, depth - 1); }
          };
          twig(x, y - h + 22, -Math.PI / 2 - 0.7, 16, 3); twig(x, y - h + 18, -Math.PI / 2 + 0.7, 16, 3); twig(x, y - h + 14, -Math.PI / 2, 12, 2);
          return;
        }
        canopy(x, y - h, 17 + Math.round(r(3) * 6), col);
        if (th.blossom) for (let i = 0; i < 6; i += 1) P(th.blossom, x - 12 + r(10 + i) * 24, y - h - 8 + r(20 + i) * 14, 2, 2);
        return;
      }
      case 'pine': case 'spruce': {
        if (front) return;
        const h = (p.kind === 'spruce' ? 64 : 58) + Math.round(r(1) * 24); const col = p.kind === 'spruce' ? '#1f3d2b' : '#2b6b3a';
        P('#5c3a1e', x - 1, y - 6, 3, 6);
        for (let k = 0; k < h; k += 1) {
          const w = Math.round(((k % 8) + 4) * (k / h) * 1.2) + 1;
          P(INK, x - w - 1, y - 6 - h + k, w * 2 + 3, 1); P(k % 8 < 2 ? mix(col, '#ffffff', 0.12) : col, x - w, y - 6 - h + k, w * 2 + 1, 1);
          if (th.snow && k % 8 === 0) P('#ffffff', x - w, y - 6 - h + k, w * 2 + 1, 1);
        }
        if (p.perch && p.hides) P('#5c3a1e', x - 14, (p.hides.y) * Z + 1, 14, 2);
        return;
      }
      case 'bush': case 'reeds': {
        if (p.kind === 'reeds') { for (let i = 0; i < 9; i += 1) { const hh = 14 + r(i) * 10; P(INK, x - 10 + i * 2.5 - 1, y - hh, 3, hh); P('#5c940d', x - 10 + i * 2.5, y - hh, 1, hh); P('#8a5a2b', x - 10 + i * 2.5, y - hh - 3, 1, 4); } return; }
        const col = th.snow ? '#e9eef5' : leaf[0];
        canopy(x + shake, y - 9, 10, col);
        if (!th.snow && r(5) < 0.4) for (let i = 0; i < 4; i += 1) P('#e03131', x - 8 + r(6 + i) * 16 + shake, y - 12 + r(9 + i) * 8, 2, 2);
        return;
      }
      case 'log': {
        P(INK, x - 17 + shake, y - 9, 34, 10); P('#8b5a2b', x - 16 + shake, y - 8, 32, 8); P('#b07a45', x - 16 + shake, y - 8, 32, 2); P('#c98a4b', x + 12 + shake, y - 8, 4, 8); P('#6e4b2a', x + 13 + shake, y - 6, 2, 4);
        if (th.snow) P('#ffffff', x - 16, y - 10, 32, 2);
        return;
      }
      case 'rock': case 'moonrock': {
        const col = p.kind === 'moonrock' ? '#7d82a8' : '#868e96';
        blob(x + shake, y - 6, 12, 7, col, mix(col, '#ffffff', 0.3));
        if (th.snow) P('#ffffff', x - 8, y - 13, 16, 2);
        return;
      }
      case 'burrow': { P(INK, x - 9, y - 4, 18, 5); P('#3b2a20', x - 8, y - 3, 16, 4); P(th.ground[1], x - 12, y - 1, 24, 2); return; }
      case 'ripple': return;
      case 'pond': {
        if (front) return;
        for (let j = -4; j <= 4; j += 1) { const half = Math.round(30 * Math.sqrt(1 - (j * j) / 25)); P(INK, x - half - 1, y + j, half * 2 + 3, 1); }
        for (let j = -3; j <= 3; j += 1) { const half = Math.round(29 * Math.sqrt(1 - (j * j) / 16)); P(th.snow ? '#e7f5ff' : j < 0 ? '#74c0fc' : '#4dabf7', x - half, y + j, half * 2 + 1, 1); }
        if (!th.snow) { P('#e7f5ff', x - 14, y - 2, 10, 1); P('#e7f5ff', x + 6, y, 6, 1); for (let i = 0; i < 4; i += 1) { P('#2b8a3e', x + 22 + i * 2, y - 8 - (i % 2) * 3, 1, 8 + (i % 2) * 3); } }
        return;
      }
      case 'flowers': { if (th.snow) return; for (let i = 0; i < 5; i += 1) { P('#40c057', x - 8 + i * 4, y - 5, 1, 5); P(['#ffd43b', '#f783ac', '#ffffff'][i % 3], x - 9 + i * 4, y - 7, 3, 2); } return; }
      case 'crater': { P(INK, x - 16, y - 3, 32, 5); P('#5c5f8a', x - 15, y - 2, 30, 3); P('#9a9fc4', x - 16, y - 4, 32, 1); return; }
      case 'antenna': { if (front) return; P(INK, x - 2, y - 40, 4, 40); P('#ced4da', x - 1, y - 40, 2, 40); P(Math.floor(this.t * 2) % 2 ? '#ff6b6b' : '#c92a2a', x - 2, y - 43, 4, 3); return; }
      case 'crystal': { for (let k = 0; k < 14; k += 1) P(k < 2 ? INK : k % 4 ? '#99e9f2' : '#e3fafc', x - Math.round((14 - k) / 3), y - 14 + k, Math.round((14 - k) / 1.5) + 1, 1); return; }
      // ---------- the other maps' scenery ----------
      case 'tower': { // the Castle: a round stone tower with battlements and a flag
        if (front) return;
        const h = 70 + Math.round(r(1) * 24); const col = th.snow ? '#b9c0cc' : '#a5abb5';
        P(INK, x - 10, y - h, 21, h); P(col, x - 9, y - h, 19, h); P(mix(col, '#ffffff', 0.2), x - 9, y - h, 4, h); P(mix(col, '#000000', 0.18), x + 6, y - h, 3, h);
        for (let j = y - h + 6; j < y; j += 8) P(mix(col, '#000000', 0.12), x - 9, j, 19, 1);
        for (let i = -11; i < 12; i += 8) { P(INK, x + i - 1, y - h - 7, 6, 8); P(col, x + i, y - h - 6, 4, 7); }
        P('#15111c', x - 2, y - h + 16, 4, 8); P('#15111c', x - 2, y - h + 15, 4, 1);
        P('#5c3a1e', x, y - h - 26, 1, 20); P(r(2) < 0.5 ? '#7048e8' : '#fcc419', x + 1, y - h - 26 + (Math.floor(this.t * 3 + r(3) * 4) % 2), 9, 6);
        if (th.snow) P('#ffffff', x - 9, y - h - 1, 19, 2);
        if (p.perch && p.hides) P('#6c757d', x - 16, p.hides.y * Z + 1, 16, 2);
        return;
      }
      case 'hedge': { // a clipped garden hedge
        const col = th.snow ? '#e9eef5' : mix(leaf[0], '#1b4d28', 0.25); const lt = mix(col, '#ffffff', 0.18);
        P(INK, x - 15 + shake, y - 17, 31, 17); P(col, x - 14 + shake, y - 16, 29, 16); P(lt, x - 14 + shake, y - 16, 29, 3);
        for (let i = 0; i < 8; i += 1) P(mix(col, '#000000', 0.15), x - 12 + r(i) * 24 + shake, y - 12 + r(i + 9) * 10, 2, 1);
        return;
      }
      case 'palm': { // Sunset beach: a leaning palm with coconuts
        if (front) return;
        const h = 64 + Math.round(r(1) * 20); const lean = (r(2) < 0.5 ? -1 : 1) * (6 + r(3) * 8);
        let tx = x; let tyy = y;
        for (let k = 0; k < h; k += 1) { const f = k / h; tx = x + lean * f * f; tyy = y - k; P(INK, tx - 3, tyy, 7, 1); P(k % 5 < 1 ? '#8a6a3a' : '#b08a52', tx - 2, tyy, 5, 1); }
        for (let i = 0; i < 7; i += 1) {
          const a = -Math.PI + (i / 6) * Math.PI; const len = 22 + r(10 + i) * 8;
          for (let t2 = 0; t2 <= len; t2 += 1) { const fx = tx + Math.cos(a) * t2; const fy = tyy + Math.sin(a) * t2 * 0.5 + (t2 / len) ** 2 * 12; P(INK, fx - 1, fy - 1, 3, 3); P(t2 % 4 < 2 ? '#2f9e44' : '#51cf66', fx, fy, 2, 2); }
        }
        P('#5c3a1e', tx - 3, tyy + 2, 3, 3); P('#5c3a1e', tx + 1, tyy + 3, 3, 3);
        if (p.perch && p.hides) P('#8a6a3a', tx - 14, p.hides.y * Z + 1, 14, 2);
        return;
      }
      case 'dunegrass': { for (let i = 0; i < 9; i += 1) { const hh = 8 + r(i) * 10; const bend = (r(i + 20) - 0.5) * 6; for (let k = 0; k < hh; k += 1) P(k < 2 ? '#8a7a3a' : '#a9b85a', x - 9 + i * 2 + bend * (k / hh), y - k, 1, 1); } return; }
      case 'shell': { P(INK, x - 4, y - 4, 9, 5); P('#ffc9c9', x - 3, y - 3, 7, 3); P('#ffffff', x - 2, y - 3, 1, 3); P('#ffffff', x + 1, y - 3, 1, 3); return; }
      case 'coral': { // Under the sea: branching coral (or a round brain coral)
        const col = ['#ff8787', '#ffa94d', '#f783ac', '#da77f2'][Math.floor(r(1) * 4)];
        if (r(2) < 0.35) { blob(x + shake, y - 7, 13, 8, col, mix(col, '#ffffff', 0.3)); for (let i = -9; i < 10; i += 3) P(mix(col, '#000000', 0.2), x + i + shake, y - 9 + Math.round(Math.sin(i) * 2), 2, 1); return; }
        const br = (x0, y0, a, len, d) => { const x1 = x0 + Math.cos(a) * len; const y1 = y0 + Math.sin(a) * len; for (let i = 0; i <= len; i += 1) { const px = x0 + ((x1 - x0) * i) / len; const py = y0 + ((y1 - y0) * i) / len; P(INK, px - 2, py - 1, 5, 3); } for (let i = 0; i <= len; i += 1) { const px = x0 + ((x1 - x0) * i) / len; const py = y0 + ((y1 - y0) * i) / len; P(col, px - 1, py, 3, 1); } if (d > 0) { br(x1, y1, a - 0.5, len * 0.7, d - 1); br(x1, y1, a + 0.45, len * 0.7, d - 1); } };
        br(x + shake, y, -Math.PI / 2, 9 + r(3) * 4, 2);
        return;
      }
      case 'seafan': { if (front) return; const col = '#9775fa'; for (let i = 0; i < 9; i += 1) { const a = -Math.PI / 2 + (i - 4) * 0.17; for (let t2 = 0; t2 < 26; t2 += 1) P(t2 % 5 ? col : mix(col, '#ffffff', 0.3), x + Math.cos(a) * t2, y + Math.sin(a) * t2, 1, 1); } for (let k = 8; k < 26; k += 5) for (let i = -4; i <= 4; i += 1) { const a = -Math.PI / 2 + i * 0.17; P(col, x + Math.cos(a) * k, y + Math.sin(a) * k, 2, 1); } return; }
      case 'seaweed': { // kelp, swaying
        const n = 4; const hh = 30 + r(1) * 26;
        for (let s2 = 0; s2 < n; s2 += 1) for (let k = 0; k < hh - s2 * 4; k += 1) { const sw = Math.sin(this.t * 1.6 + k / 7 + s2) * (k / hh) * 5; P(INK, x - 6 + s2 * 4 + sw - 1, y - k, 4, 1); P(k % 6 < 3 ? '#2f9e44' : '#40c057', x - 6 + s2 * 4 + sw, y - k, 2, 1); }
        return;
      }
      case 'anemone': { // the clownfish's home: a ring of waving arms
        const col = r(1) < 0.5 ? '#f783ac' : '#b197fc';
        P(INK, x - 12, y - 5, 25, 6); P(mix(col, '#000000', 0.3), x - 11, y - 4, 23, 4);
        for (let i = 0; i < 12; i += 1) { const bx = x - 11 + i * 2; const hh = 10 + (i % 3) * 3; for (let k = 0; k < hh; k += 1) P(k === hh - 1 ? '#ffffff' : col, bx + Math.sin(this.t * 2 + i + k / 4) * (k / hh) * 3, y - 4 - k, 2, 1); }
        return;
      }
      case 'clam': { P(INK, x - 11, y - 9, 23, 10); P('#ced4da', x - 10, y - 8, 21, 8); P('#3bc9db', x - 8, y - 6, 17, 3); P('#1098ad', x - 8, y - 4, 17, 1); for (let i = -9; i < 10; i += 4) P('#868e96', x + i, y - 8, 1, 2); return; }
      case 'cactus': { // the Galápagos: a prickly pear tree with flat pads
        if (front) return;
        const h = 40 + Math.round(r(1) * 18);
        P(INK, x - 4, y - h, 9, h); P('#8a6a4a', x - 3, y - h, 7, h); P('#a8865e', x - 3, y - h, 2, h);
        const pads = [[0, -h - 6], [-9, -h + 2], [9, -h], [-5, -h - 14], [6, -h - 13]];
        for (const [dx, dy] of pads) { blob(x + dx, y + dy, 6, 8, '#5c940d', '#82c91e'); P('#fcc419', x + dx, y + dy - 7, 2, 1); }
        if (p.perch && p.hides) P('#8a6a4a', x - 14, p.hides.y * Z + 1, 14, 2);
        return;
      }
      case 'lavarock': { blob(x + shake, y - 7, 13, 8, '#3d3330', '#5c4b45'); P('#ff6b1a', x - 4 + shake, y - 4, 6, 1); P('#ffd43b', x - 2 + shake, y - 4, 2, 1); return; }
      case 'vent': { P(INK, x - 10, y - 6, 21, 7); P('#4a3f3a', x - 9, y - 5, 19, 5); P('#2b211d', x - 3, y - 6, 7, 2); P('#e8590c', x - 2, y - 6, 5, 1); return; }
      case 'scrub': { const col = '#8f9a6a'; canopy(x + shake, y - 8, 9, col); return; }
      case 'kapok': { // the Rainforest: a giant tree with buttress roots and hanging vines
        if (front) return;
        const h = 96 + Math.round(r(1) * 20);
        P(INK, x - 7, y - h, 15, h); P('#8a7a5a', x - 6, y - h, 13, h); P('#a8987a', x - 6, y - h, 3, h); P('#6e5f42', x + 4, y - h, 2, h);
        for (const s2 of [-1, 1]) for (let k = 0; k < 16; k += 1) P(k < 1 ? INK : '#8a7a5a', x + s2 * (6 + k * 0.7), y - 16 + k, 2, 16 - k > 0 ? 1 : 1);
        canopy(x, y - h, 24, leaf[0]);
        for (let i = 0; i < 4; i += 1) { const vx = x - 18 + r(5 + i) * 36; const vl = 20 + r(9 + i) * 30; for (let k = 0; k < vl; k += 1) P(k % 7 === 6 ? '#69db7c' : '#2b8a3e', vx + Math.sin(k / 6 + i) * 1.5, y - h + 14 + k, 1, 1); }
        if (p.perch && p.hides) P('#6e5f42', x - 16, p.hides.y * Z + 1, 16, 2);
        return;
      }
      case 'fern': { // a fern: arching fronds
        for (let i = 0; i < 7; i += 1) { const a = -Math.PI + 0.35 + (i / 6) * (Math.PI - 0.7); const len = 13 + r(i) * 6; for (let t2 = 0; t2 <= len; t2 += 1) { const fx = x + Math.cos(a) * t2 + shake; const fy = y - 2 + Math.sin(a) * t2 * 1.3 + (t2 / len) ** 2 * 7; P(INK, fx - 1, fy - 1, 3, 3); } }
        for (let i = 0; i < 7; i += 1) { const a = -Math.PI + 0.35 + (i / 6) * (Math.PI - 0.7); const len = 13 + r(i) * 6; for (let t2 = 0; t2 <= len; t2 += 1) { const fx = x + Math.cos(a) * t2 + shake; const fy = y - 2 + Math.sin(a) * t2 * 1.3 + (t2 / len) ** 2 * 7; P(t2 % 3 ? '#37b24d' : '#69db7c', fx, fy, 2, 1); } }
        return;
      }
      case 'bromeliad': { for (let i = 0; i < 6; i += 1) { const a = -Math.PI + 0.4 + (i / 5) * (Math.PI - 0.8); for (let t2 = 0; t2 < 10; t2 += 1) P('#5c940d', x + Math.cos(a) * t2, y - 1 + Math.sin(a) * t2, 2, 1); } P('#e03131', x - 2, y - 8, 4, 5); P('#ff8787', x - 1, y - 8, 2, 2); return; }
      case 'lollipop': { // Rainbow land: a lollipop tree
        if (front) return;
        const h = 40 + Math.round(r(1) * 20); const R = 11 + Math.round(r(2) * 4);
        P(INK, x - 2, y - h, 5, h); P('#f8f9fa', x - 1, y - h, 3, h);
        const cols = [['#ff6b6b', '#ffffff'], ['#4dabf7', '#ffe066'], ['#b197fc', '#ffffff'], ['#69db7c', '#ffd8a8']][Math.floor(r(3) * 4)];
        for (let j = -R - 1; j <= R + 1; j += 1) for (let i = -R - 1; i <= R + 1; i += 1) { const d = Math.hypot(i, j); if (d <= R + 1) { const a = Math.atan2(j, i) + d * 0.35; P(d > R ? INK : Math.floor((a / (Math.PI * 2)) * 6 + 6) % 2 ? cols[0] : cols[1], x + i, y - h - R + j); } }
        return;
      }
      case 'gumdrop': { const col = ['#ff8787', '#ffd43b', '#69db7c', '#74c0fc', '#b197fc'][Math.floor(r(1) * 5)]; blob(x + shake, y - 8, 11, 9, col, mix(col, '#ffffff', 0.35)); for (let i = 0; i < 6; i += 1) P('#ffffff', x - 7 + r(i + 3) * 14 + shake, y - 13 + r(i + 9) * 9, 1, 1); return; }
      case 'candytree': { // a cotton candy tree on a striped trunk
        if (front) return;
        const h = 58 + Math.round(r(1) * 20);
        for (let k = 0; k < h - 10; k += 1) { P(INK, x - 3, y - k, 7, 1); P(Math.floor(k / 4) % 2 ? '#f783ac' : '#ffffff', x - 2, y - k, 5, 1); }
        canopy(x, y - h, 17 + Math.round(r(3) * 5), r(2) < 0.5 ? '#fcc2d7' : '#a5d8ff');
        if (p.perch && p.hides) P('#f783ac', x - 14, p.hides.y * Z + 1, 14, 2);
        return;
      }
      case 'cane': { for (let k = 0; k < 22; k += 1) { P(INK, x - 2, y - k, 5, 1); P(Math.floor(k / 3) % 2 ? '#e03131' : '#ffffff', x - 1, y - k, 3, 1); } for (let a = 0; a <= Math.PI; a += 0.2) P(Math.floor(a * 3) % 2 ? '#e03131' : '#ffffff', x - 4 + Math.round(Math.cos(a) * 4), y - 22 - Math.round(Math.sin(a) * 4), 3, 2); return; }
      case 'goldspire': { // Golden galaxy: a tall golden crystal spire
        if (front) return;
        const h = 50 + Math.round(r(1) * 30);
        for (let k = 0; k < h; k += 1) { const w = Math.max(1, Math.round((k / h) * 8)); P(INK, x - w - 1, y - h + k, w * 2 + 3, 1); P(k % 9 < 2 ? '#fff3bf' : '#fcc419', x - w, y - h + k, w, 1); P('#f08c00', x, y - h + k, w + 1, 1); }
        if (Math.floor(this.t * 2 + r(2) * 5) % 5 === 0) { P('#ffffff', x - 3, y - h + 4, 7, 1); P('#ffffff', x, y - h + 1, 1, 7); }
        if (p.perch && p.hides) P('#f08c00', x - 14, p.hides.y * Z + 1, 14, 2);
        return;
      }
      case 'goldcrystal': { for (let k = 0; k < 16; k += 1) { const w = Math.round((16 - k) / 1.4) + 1; P(k < 2 ? INK : k % 4 ? '#fcc419' : '#fff3bf', x - Math.round((16 - k) / 2.8) + shake, y - 16 + k, w, 1); } P('#f08c00', x + 2 + shake, y - 10, 2, 9); return; }
      case 'asteroid': { if (front) return; const bob = Math.round(Math.sin(this.t * 1.2 + r(1) * 6) * 3); blob(x, y - 50 + bob, 9, 6, '#7950f2', '#9775fa'); P('#5f3dc4', x - 3, y - 51 + bob, 3, 2); P('#fcc419', x + 4, y - 48 + bob, 2, 1); return; }
      case 'fore': {
        if (th.foreKind === 'seaweed' || th.foreKind === 'fern') { // big fronds right in front
          const col = th.fore;
          for (let s2 = 0; s2 < 6; s2 += 1) for (let k = 0; k < 60; k += 1) { const sw = th.foreKind === 'seaweed' ? Math.sin(this.t * 1.4 + k / 9 + s2) * (k / 60) * 8 : (s2 - 2.5) * k * 0.45; P(mix(col, '#000000', 0.3), x - 18 + s2 * 7 + sw, y - k, 5, 1); P(k % 7 < 3 ? col : mix(col, '#ffffff', 0.15), x - 17 + s2 * 7 + sw, y - k, 3, 1); }
          return;
        }
        const col = th.snow ? '#c5d3e3' : th.goldCamo ? '#c98a1e' : th.stars ? '#46496e' : th.fore ? ramp(th.fore, 3, 1)[1] : ramp(leaf[0], 3, 1)[1];
        canopy(x, y - 4, 17, col);
        return;
      }
      default:
        if (p.kind.startsWith('clue-')) {
          if (p.found) return;
          const k = p.kind.slice(5);
          if (k === 'tracks') for (let i = 0; i < 4; i += 1) { P(INK, x - 10 + i * 6, y - 2 - (i % 2) * 2, 3, 2); P(INK, x - 9 + i * 6, y - 4 - (i % 2) * 2, 1, 1); }
          if (k === 'feather') { P(INK, x - 6, y - 3, 12, 3); P('#f8f9fa', x - 5, y - 2, 10, 1); P('#adb5bd', x + 4, y - 2, 2, 1); }
          if (k === 'antler') { P('#e9d8b4', x - 6, y - 2, 12, 2); P('#e9d8b4', x - 3, y - 6, 2, 4); P('#e9d8b4', x + 2, y - 7, 2, 5); }
          if (k === 'glow') { P('#ffd43b', x - 2, y - 4, 4, 4); }
          if (k === 'scale') { P(INK, x - 5, y - 4, 10, 5); P('#2f9e44', x - 4, y - 3, 8, 3); P('#8ce99a', x - 3, y - 3, 3, 1); }
          if (k === 'shell') { P(INK, x - 4, y - 4, 9, 5); P('#ffd8a8', x - 3, y - 3, 7, 3); P('#ffffff', x - 1, y - 3, 1, 3); }
          if (k === 'tooth') { P(INK, x - 3, y - 6, 6, 6); P('#f8f9fa', x - 2, y - 5, 4, 4); P('#f8f9fa', x - 1, y - 1, 2, 1); }
          if (k === 'sprinkle') { for (let i = 0; i < 5; i += 1) P(RAINBOW[i][1], x - 8 + i * 4, y - 3 - (i % 2) * 2, 3, 1); }
          if (Math.floor(this.t * 3) % 2) P('#ffffff', x + 6, y - 10, 2, 2);
        }
    }
  }

  // ---------- the HUD (sharp words, the viewfinder, photos) ----------
  drawHud(ctx, scale) {
    const S = scale; const W = this.W * S; const H = this.H * S; const u = S * 4;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff', align = 'center') => {
      ctx.textAlign = align;
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = INK;
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
      ctx.textAlign = 'center';
    };
    // film, clock, points, weather, wanted
    const secs = Math.ceil(this.left);
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 3.6, u * 1.6, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#ffffff');
    text(`${this.points} points`, u * 1, u * 3.6, u * 1.5, '#ffd43b', 'left');
    // film: one little frame for each shot left
    for (let i = 0; i < this.cam.film; i += 1) {
      const fx = u * 1 + i * u * 1.05; const fy = u * 5;
      ctx.fillStyle = i < this.film ? '#ffe066' : 'rgba(255,255,255,0.25)'; ctx.fillRect(fx, fy, u * 0.8, u * 1.1);
      ctx.strokeStyle = INK; ctx.lineWidth = S * 0.4; ctx.strokeRect(fx, fy, u * 0.8, u * 1.1);
    }
    const wn = (this.theme.weatherNames || WEATHERS)[this.weather];
    text(`${wn?.icon || ''} ${wn?.name || ''}`, W - u * 1, u * 3.6, u * 1.2, '#ffffff', 'right');
    const want = critterById(this.wanted);
    if (want) {
      const done = this.bestBy[want.id];
      text(`WANTED: ${want.name}${done ? ' ✓' : ' (x2)'}`, W - u * 1, u * 5.4, u * 1.1, done ? '#b2f2bb' : '#ffd43b', 'right');
    }
    // Rainbow land: a dot for each color, lit when it has been photographed
    if (this.theme.rainbowHunt) {
      RAINBOW.forEach(([k, col], i) => {
        const cx = W - u * 1.4 - (RAINBOW.length - 1 - i) * u * 1.5; const cy = u * 7.1; const got = this.colors.has(k);
        ctx.beginPath(); ctx.arc(cx, cy, u * 0.62, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
        ctx.beginPath(); ctx.arc(cx, cy, u * 0.45, 0, Math.PI * 2); ctx.fillStyle = got ? col : 'rgba(255,255,255,0.25)'; ctx.fill();
      });
    }
    // the viewfinder
    const v = this.view;
    if (v && this.phase === 'play') {
      const { w, h } = this.frame;
      const x0 = (v.x - w / 2) * S; const y0 = (v.y - h / 2) * S; const fw = w * S; const fh = h * S;
      const col = v.focus >= 1 ? '#ffd43b' : '#ffffff';
      ctx.fillStyle = 'rgba(10,8,20,0.18)';
      ctx.fillRect(0, 0, W, y0); ctx.fillRect(0, y0 + fh, W, H - y0 - fh); ctx.fillRect(0, y0, x0, fh); ctx.fillRect(x0 + fw, y0, W - x0 - fw, fh);
      const L = u * 1.6;
      ctx.lineWidth = S * 1.1; ctx.strokeStyle = INK;
      const corners = (lw, c) => {
        ctx.lineWidth = lw; ctx.strokeStyle = c;
        ctx.beginPath();
        for (const [cx, cy, sx, sy] of [[x0, y0, 1, 1], [x0 + fw, y0, -1, 1], [x0, y0 + fh, 1, -1], [x0 + fw, y0 + fh, -1, -1]]) { ctx.moveTo(cx + sx * L, cy); ctx.lineTo(cx, cy); ctx.lineTo(cx, cy + sy * L); }
        ctx.stroke();
      };
      corners(S * 1.8, INK); corners(S * 0.9, col);
      // the focus ring closes in
      const rr = (Math.min(fw, fh) * 0.42) * (1.6 - 0.6 * v.focus);
      ctx.beginPath(); ctx.arc(x0 + fw / 2, y0 + fh / 2, rr, 0, Math.PI * 2);
      ctx.lineWidth = S * 0.7; ctx.strokeStyle = v.focus >= 1 ? col : 'rgba(255,255,255,0.7)'; ctx.stroke();
      ctx.fillStyle = col; ctx.fillRect(x0 + fw / 2 - S * 0.5, y0 + fh / 2 - S * 2, S, S * 4); ctx.fillRect(x0 + fw / 2 - S * 2, y0 + fh / 2 - S * 0.5, S * 4, S);
      // the label sits over the frame, or under it when the frame is up by the top lines
      const ly = y0 - u * 0.8 < u * 6.6 ? y0 + fh + u * 0.8 : y0 - u * 0.8;
      text(v.focus >= 1 ? 'SHARP' : 'hold still...', x0 + fw / 2, ly, u * 0.95, col);
      // far specks get a hint
      if (!this.cam.zoom) for (const k of this.critters) if (k.far && !k.gone) { const [kx, ky] = this.where(k); if (Math.abs(kx - v.x) < w / 2 && Math.abs(ky - v.y) < h / 2 + 6) text('too far!', kx * S, (ky - 9) * S, u * 0.9, '#ffd43b'); }
    }
    // the shutter button: bright and bouncing when the photo is ready (sharp on an animal that's out)
    if (this.phase === 'play') {
      const b = this.shutter; const cx = b.x * S; const cy = b.y * S; const R = b.r * S;
      const ready = v && v.focus >= 1;
      const pressed = this.t - this.shutterAt < 0.12;
      const k = pressed ? 0.9 : ready ? 1 + Math.sin(this.t * 10) * 0.05 : 1;
      ctx.save(); ctx.translate(cx, cy); ctx.scale(k, k);
      ctx.beginPath(); ctx.arc(0, 0, R + S * 1.2, 0, Math.PI * 2); ctx.fillStyle = INK; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = !v ? '#868e96' : ready ? '#ffd43b' : '#e9ecef'; ctx.fill();
      ctx.beginPath(); ctx.arc(0, 0, R * 0.62, 0, Math.PI * 2); ctx.lineWidth = S * 1.2; ctx.strokeStyle = INK; ctx.stroke();
      ctx.restore();
      text('SNAP', cx, cy, u * 0.95, '#ffffff');
    }
    // the visitor points
    if (this.pointAt && this.t - this.pointAt.at < 1.4 && !this.pointAt.k.gone) {
      const [kx, ky] = this.where(this.pointAt.k);
      if (Math.floor(this.t * 5) % 2) text('▼', clamp(kx, 4, this.W - 4) * S, (ky - 22) * S, u * 1.4, '#ffd43b');
    }
    // the last photo, a moment
    const s = this.lastShot;
    if (s && s.pic && this.t - s.at < 1.8 && this.phase === 'play') {
      // a small tilted print; after a moment it slides up into the film strip
      const age = this.t - s.at; const slide = clamp((age - 0.8) / 0.5, 0, 1);
      const pw = u * 6.6; const ph = pw * (s.pic.height / s.pic.width);
      const px = u * 1 + slide * u * 2; const py = u * 7 - slide * u * 3;
      const k = 1 - slide * 0.7;
      ctx.save(); ctx.globalAlpha = 1 - slide * 0.6;
      ctx.translate(px + pw / 2, py + ph / 2); ctx.rotate(-0.05); ctx.scale(k, k); ctx.translate(-pw / 2, -ph / 2);
      ctx.fillStyle = INK; ctx.fillRect(-S * 1.6, -S * 1.6, pw + 3.2 * S, ph + u * 2 + 1.2 * S);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(-S, -S, pw + 2 * S, ph + u * 2);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(s.pic, 0, 0, pw, ph);
      const ticks = s.none ? 'nothing in it' : s.clue ? 'clue!' : `${s.sharp ? '✓' : '✗'}sharp ${s.posed ? '✓' : '✗'}posed ${s.centred ? '✓' : '✗'}centred`;
      ctx.font = `${Math.round(u * 0.62)}px "Jersey 10", monospace`; ctx.fillStyle = '#495057'; ctx.textAlign = 'center';
      ctx.fillText(ticks, pw / 2, ph + u * 0.9);
      ctx.restore(); ctx.textAlign = 'center';
      if (slide < 1) {
        if (s.quality === 'perfect') { // a gold stamp, with a sparkle
          ctx.save(); ctx.translate(px + pw * 0.6, py + ph * 0.86); ctx.rotate(-0.12);
          const sz = u * (1.5 + Math.max(0, 0.25 - age) * 2);
          text('PERFECT', 0, 0, sz, '#ffd43b');
          if (Math.floor(age * 8) % 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(u * 2.6, -u * 1.2, S, S * 5); ctx.fillRect(u * 2.6 - S * 2, -u * 1.2 + S * 2, S * 5, S); }
          ctx.restore();
        }
        if (s.record === 'new') text('NEW!', px + pw - u * 0.6, py + u * 0.4, u * 1.1, '#b2f2bb');
      }
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.6;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x, 30, this.W - 30) * S, (p.y - age * 6) * S, u * (p.big ? 1.6 : 1.2), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) {
      text(this.locked ? "That's all our games today!" : 'All aboard! Tap to start the train.', W / 2, H * 0.32, u * 1.7);
      if (!this.locked) text('Touch to aim, wait for SHARP, press SNAP!', W / 2, H * 0.32 + u * 2.2, u * 1.1);
    }
    if (this.phase === 'over' && this.t - this.overAt > 0.3) this.drawRoll(ctx, S, text);
  }

  /** End of the line: the roll of photos, developed. */
  drawRoll(ctx, S, text) {
    const W = this.W * S; const u = S * 4;
    const bw = Math.min(W * 0.92, u * 44); const bh = u * 26; const bx = W / 2 - bw / 2; const by = u * 4;
    ctx.fillStyle = 'rgba(27,20,48,0.92)'; ctx.fillRect(bx, by, bw, bh);
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(bx, by, bw, bh);
    text(`End of the line! ${this.points} points`, W / 2, by + u * 1.8, u * 2, '#ffd43b');
    const shots = this.roll.filter((s) => s.pic && !s.none).sort((a, b) => (b.points || 0) - (a.points || 0)).slice(0, 8);
    const n = Math.max(1, Math.min(4, shots.length)); const gap = u * 0.8;
    const tw = Math.min((bw - gap * (n + 1)) / n, u * 10); const thh = tw * 0.75;
    const show = Math.floor((this.t - this.overAt) / 0.25); // develop one by one
    shots.slice(0, 8).forEach((s, i) => {
      if (i > show) return;
      const col = i % 4; const row = Math.floor(i / 4);
      const x = W / 2 - (n * tw + (n - 1) * gap) / 2 + col * (tw + gap); const y = by + u * 3.6 + row * (thh + u * 2.6);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x - S, y - S, tw + 2 * S, thh + u * 2);
      ctx.imageSmoothingEnabled = false; ctx.drawImage(s.pic, x, y, tw, thh);
      const q = s.clue ? { short: 'Clue', color: '#2f9e44' } : QUALITY[s.quality];
      text(s.clue ? 'Clue!' : s.name || '', x + tw / 2, y + thh + u * 0.5, u * 0.75, '#1b1430' === INK ? '#343a40' : '#000');
      if (s.quality !== 'blurry' || s.clue) text(q.short, x + tw - u * 1.6, y + u * 0.7, u * 0.85, q.color);
      if (s.record === 'new') text('NEW!', x + u * 1.4, y + u * 0.7, u * 0.85, '#b2f2bb');
    });
    if (!shots.length) text('No photos this time. Hold to focus, let go to snap!', W / 2, by + u * 9, u * 1.2, '#e9ecef');
    text(`${this.records ? `${this.records} new in your album · ` : ''}${this.newBest ? 'New best!' : `Best ${this.best} points`}`, W / 2, by + bh - u * 3, u * 1.3, this.newBest ? '#b2f2bb' : '#e9ecef');
    if (this.t - this.overAt > 1.2) text('Tap to ride again', W / 2, by + bh - u * 1.2, u * 1.2, '#ffffff');
  }
}

/** A blurry photo: chunky pixels and a ghost a little to the side (no canvas blur filter). */
function blur(pic) {
  const w = pic.width; const h = pic.height; const x = pic.getContext('2d');
  const small = canvas(Math.max(1, Math.round(w / 3)), Math.max(1, Math.round(h / 3)));
  const sx = small.getContext('2d'); sx.imageSmoothingEnabled = true; sx.drawImage(pic, 0, 0, small.width, small.height);
  x.imageSmoothingEnabled = false;
  x.globalAlpha = 1; x.drawImage(small, 0, 0, w, h);
  x.globalAlpha = 0.45; x.drawImage(small, 3, 0, w, h);
  x.globalAlpha = 1;
}
