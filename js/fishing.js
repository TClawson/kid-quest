// Fishing with a visiting buddy: 90 seconds at the lake on the kid's map.
//
// A side view: your buddy stands on the shore at the top left, the visitor
// beside it, and most of the screen is the lake, seen from the side. The lake
// bed slopes up to the shore under the buddies.
//
// Pick a bait (worm, jig or spoon), then tap CAST: a needle swings over red,
// yellow and green, and a second tap casts short (red), medium (yellow) or far
// (green). The bait sinks. Tap to twitch it, press and hold to reel it in; let
// go and it sinks slowly again. Weeds snag it 10% of the time it touches them,
// logs 50%; hold to yank it free (or the line snaps and you cast again).
//
// Fish swim in from the right and stay a while: bluegill in a school, a
// smallmouth or two hanging just off the school, largemouth cruising, pike
// lurking in the weeds, catfish lying on the bottom by the logs. Each map tips
// the odds toward some kinds and has one rare fish of its own. A fish near a
// bait it likes may get interested and come up to it; a twitch then makes it
// strike (44% for small fish, down to 20% for the biggest) or spooks it, and
// a spooked fish startles its school and the fish around it. Big fish are
// pickier and slower to bite. Which
// bait works best changes a little every day (the same for everyone that day).
//
// Fish on: hold to reel, let go when the line gets too tight or it snaps. Big
// fish pull harder and make runs. A better rod gives a wider green and a
// stronger line. Points for each catch: more for rarer and bigger fish.
//
// Same interface as Play in play.js (tap, step, draw, drawHud, score, phase).
// holdAnywhere: a finger held down anywhere reels, so playground.js calls
// release() for every finger that comes up.
import { Player, rng, canvas, clamp, HAPPY } from './play.js';

export const GAME_SECONDS = 90;
const FEET = 7 + 16; // SPRITE_Y + 16, as in play.js
const ZONE_COLORS = { red: '#fa5252', yellow: '#fcc419', green: '#40c057' };
const SWEEP = 0.8; // seconds for the cast needle to cross the meter
const HOLD = 0.18; // a press longer than this is reeling, shorter is a twitch
export const SNAG = { weed: 0.1, log: 0.5 };
/**
 * The chance a twitch makes an interested fish bite (size 0-1); otherwise it spooks.
 * Small fish 44%, the biggest 20% (Taylor, 2026-11-05: big fish half as likely as
 * before, small ones 20% less).
 */
export const strikeChance = (size) => 0.44 - 0.24 * size;
/** How much likelier than before a fish of this size is to take the bait on its own (0.8 small, 0.5 biggest). */
const biteScale = (size) => 0.8 - 0.3 * size;
/** Seconds a fish that saw another one spooked stays away from the bait. */
export const WARY = 4;
/** Points for a catch: each kind's base, up to 2.5x for the biggest; the map's special fish is worth the most. */
export const POINTS = { bluegill: 10, smallmouth: 20, largemouth: 25, pike: 35, catfish: 35, special: 60 };
export const pointsFor = (kind, size) => Math.round((POINTS[kind] || 10) * (1 + 1.5 * size));
/** Bigger fish are pickier: a bait has to be at least this good for them to look at it (size 0-1). */
export const pickiness = (size) => 0.1 + 0.35 * size;

// ---------- fish ----------
// len: [smallest, biggest] in field pixels; inches: the same range in inches.
// look: body depth (fraction of length), colors back / side / belly, markings.
export const SPECIES = {
  bluegill: { name: 'Bluegill', len: [9, 13], inches: [4, 10], depth: 0.62, back: '#3f6f8f', side: '#7fb3a8', belly: '#ff922b', bar: '#3f6f6a', mark: 'bars', speed: 7, reach: 20, pull: 0.25, fin: '#3f6f8f' },
  smallmouth: { name: 'Smallmouth bass', len: [14, 22], inches: [8, 20], depth: 0.34, back: '#7a5a2e', side: '#b8904a', belly: '#efe0b0', bar: '#6b4f2a', mark: 'bars', speed: 9, reach: 26, pull: 0.55, eye: '#e03131', fin: '#5c3a1e' },
  largemouth: { name: 'Largemouth bass', len: [16, 30], inches: [10, 24], depth: 0.36, back: '#2b5d2b', side: '#6aa84f', belly: '#f1f3c4', mark: 'stripe', speed: 8, reach: 28, pull: 0.65, fin: '#1e4620' },
  pike: { name: 'Pike', len: [26, 46], inches: [18, 44], depth: 0.18, back: '#2f4a1f', side: '#5f7f3a', belly: '#e8f0c8', mark: 'spots', speed: 18, reach: 32, pull: 0.9, fin: '#7a3e1d', snout: true },
  catfish: { name: 'Catfish', len: [20, 40], inches: [12, 40], depth: 0.24, back: '#4a4a52', side: '#7b7b86', belly: '#d9d4c8', mark: 'whiskers', speed: 5, reach: 22, pull: 0.95, fin: '#3a3a40', flat: true },
};
// how each kind behaves on screen
const MOVES = { bluegill: 'school', smallmouth: 'shadow', largemouth: 'cruise', pike: 'lurk', catfish: 'bottom' };

// bait: how much each kind likes it (before today's change). Below 0: it scares them off.
export const BAIT = {
  worm: { name: 'Worm', sink: 7, like: { bluegill: 0.9, smallmouth: 0.45, largemouth: 0.45, pike: 0, catfish: 0.9 } },
  jig: { name: 'Jig', sink: 15, like: { bluegill: 0.3, smallmouth: 0.85, largemouth: 0.85, pike: 0.7, catfish: 0.3 } },
  spoon: { name: 'Spoon', sink: 12, like: { bluegill: -1, smallmouth: 0.75, largemouth: 0.7, pike: 0.9, catfish: 0 } },
};
export const BAITS = ['worm', 'jig', 'spoon'];

/** Today's bait odds: each liking moves up or down a bit, the same all day (seed: the date). Zero and scary stay put. */
export function baitToday(seed) {
  const r = rng(hash(`bait:${seed}`));
  const out = {};
  for (const b of BAITS) {
    out[b] = {};
    for (const [k, v] of Object.entries(BAIT[b].like)) out[b][k] = v <= 0 ? v : clamp(v * (0.6 + r() * 0.7), 0.05, 1);
  }
  return out;
}

function hash(s) {
  let h = 7;
  for (const ch of String(s)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return h;
}

// ---------- one fishing spot per map ----------
// odds: how often each kind turns up; special: the map's own fish (moves like `as`).
export const SPOTS = {
  'bg-meadow': {
    name: 'Forest Lake', sky: ['#7cc7ff', '#b9e3ff'], water: ['#3d9be9', '#2679c9', '#185a9d'], bed: ['#7a6040', '#5c4630'],
    land: ['#5cbd52', '#3c9a3c', '#8b5a2b'], weed: ['#2f9e44', '#51cf66'], log: ['#8b5a2b', '#5c3a1e', '#c98a4b'], far: 'trees', top: 'lily',
    odds: { bluegill: 35, smallmouth: 15, largemouth: 22, pike: 10, catfish: 18 },
    special: { id: 'trout', name: 'Golden trout', as: 'largemouth', look: { back: '#e67700', side: '#fcc419', belly: '#fff3bf', mark: 'spots', depth: 0.26, fin: '#e67700' }, like: { worm: 0.4, jig: 0.5, spoon: 0.9 }, odds: 4 },
  },
  'bg-castle': {
    name: 'Castle Moat', sky: ['#8fb8ff', '#d0e1ff'], water: ['#3b5bdb', '#2f46b0', '#202f80'], bed: ['#6c727a', '#495057'],
    land: ['#5cbd52', '#3c9a3c', '#868e96'], weed: ['#2b8a3e', '#40c057'], log: ['#6e3d1a', '#4a2810', '#a0612f'], far: 'castle', top: 'lily', bedKind: 'bricks',
    odds: { bluegill: 22, smallmouth: 10, largemouth: 15, pike: 33, catfish: 20 },
    special: { id: 'crown', name: 'Royal carp', as: 'catfish', look: { back: '#c92a2a', side: '#ff8787', belly: '#fff5f5', mark: 'crown', depth: 0.34, fin: '#c92a2a' }, like: { worm: 0.9, jig: 0.3, spoon: 0.1 }, odds: 4 },
  },
  'bg-sunset': {
    name: 'Sunset Lagoon', sky: ['#ff922b', '#ffd8a8'], water: ['#3bc9db', '#1098ad', '#0b7285'], bed: ['#e5b574', '#c9965a'],
    land: ['#f3c98b', '#d9a35f', '#c08a3e'], weed: ['#5c940d', '#94d82d'], log: ['#c9a27a', '#8d6e63', '#e9d2b4'], far: 'palms', top: 'shine',
    odds: { bluegill: 28, smallmouth: 26, largemouth: 26, pike: 5, catfish: 15 },
    special: { id: 'puffer', name: 'Pufferfish', as: 'largemouth', look: { back: '#e67700', side: '#ffd43b', belly: '#fff9db', mark: 'puff', depth: 0.7, fin: '#f08c00' }, like: { worm: 0.8, jig: 0.6, spoon: 0.3 }, odds: 5 },
  },
  'bg-ocean': {
    name: 'Coral Reef', sky: ['#4dabf7', '#a5d8ff'], water: ['#1c7ed6', '#1864ab', '#0f2d57'], bed: ['#f0d9a0', '#c9a35d'],
    land: ['#f0d9a0', '#c9a35d', '#a07a3c'], weed: ['#0ca678', '#63e6be'], log: ['#8d6e63', '#5d4037', '#bcaaa4'], far: 'sea', top: 'bubbles', coral: true,
    odds: { bluegill: 42, smallmouth: 16, largemouth: 16, pike: 12, catfish: 14 },
    special: { id: 'sword', name: 'Swordfish', as: 'pike', look: { back: '#1c3d6e', side: '#4c7fbf', belly: '#e7f5ff', mark: 'sword', depth: 0.2, fin: '#1c3d6e' }, like: { worm: 0, jig: 0.6, spoon: 0.9 }, odds: 4 },
  },
  'bg-space': {
    name: 'Goo Crater', sky: ['#0b1026', '#1b1f4b'], water: ['#37b24d', '#2b8a3e', '#1b5e20'], bed: ['#7d82a8', '#5c5f8a'],
    land: ['#9a9fc4', '#7d82a8', '#5c5f8a'], weed: ['#3bc9db', '#99e9f2'], log: ['#adb5bd', '#495057', '#e9ecef'], far: 'moon', top: 'goo', stars: true, logKind: 'pipe', weedKind: 'crystal',
    odds: { bluegill: 20, smallmouth: 10, largemouth: 10, pike: 20, catfish: 40 },
    special: { id: 'moon', name: 'Moon fish', as: 'largemouth', look: { back: '#adb5bd', side: '#f1f3f5', belly: '#ffffff', mark: 'glow', depth: 0.45, fin: '#ced4da' }, like: { worm: 0.5, jig: 0.5, spoon: 0.8 }, odds: 5 },
  },
  'bg-volcano': {
    name: 'Lava Lake', sky: ['#3d1a12', '#8a3a1a'], water: ['#ff6b1a', '#e03131', '#a61e1e'], bed: ['#3d3330', '#2b211d'],
    land: ['#5b4b45', '#3d3330', '#2b211d'], weed: ['#212529', '#495057'], log: ['#343a40', '#1a1210', '#ff6b1a'], far: 'volcano', top: 'lava', logKind: 'charred', weedKind: 'rock',
    odds: { bluegill: 18, smallmouth: 20, largemouth: 24, pike: 26, catfish: 12 },
    special: { id: 'dragon', name: 'Fire dragon fish', as: 'pike', look: { back: '#862e9c', side: '#e03131', belly: '#ffd43b', mark: 'flame', depth: 0.22, fin: '#ffd43b' }, like: { worm: 0.2, jig: 0.7, spoon: 0.9 }, odds: 4 },
  },
  'bg-rainbow': {
    name: 'Candy Pond', sky: ['#c3fae8', '#fff0f6'], water: ['#f783ac', '#e64980', '#a61e4d'], bed: ['#ffffff', '#ffdeeb'],
    land: ['#69db7c', '#40c057', '#fcc2d7'], weed: ['#845ef7', '#b197fc'], log: ['#ffffff', '#e03131', '#ffffff'], far: 'rainbow', top: 'sparkle', logKind: 'cane',
    odds: { bluegill: 40, smallmouth: 15, largemouth: 15, pike: 15, catfish: 15 },
    special: { id: 'unicorn', name: 'Unicorn fish', as: 'largemouth', look: { back: '#da77f2', side: '#f3d9fa', belly: '#ffffff', mark: 'horn', depth: 0.34, fin: '#74c0fc' }, like: { worm: 0.7, jig: 0.7, spoon: 0.7 }, odds: 5 },
  },
  'bg-galaxy': {
    name: 'Star Lake', sky: ['#1a0f40', '#3a2878'], water: ['#7950f2', '#5f3dc4', '#3b2694'], bed: ['#fcc419', '#e67700'],
    land: ['#fcc419', '#e67700', '#4527a0'], weed: ['#fab005', '#ffe066'], log: ['#5f3dc4', '#3b2694', '#b197fc'], far: 'spires', top: 'stars', stars: true, weedKind: 'crystal', logKind: 'rock',
    odds: { bluegill: 20, smallmouth: 15, largemouth: 15, pike: 25, catfish: 25 },
    special: { id: 'comet', name: 'Comet fish', as: 'pike', look: { back: '#5f3dc4', side: '#b197fc', belly: '#fff3bf', mark: 'comet', depth: 0.24, fin: '#ffd43b' }, like: { worm: 0.3, jig: 0.8, spoon: 0.8 }, odds: 5 },
  },
};
export const spotFor = (bg) => SPOTS[bg] || SPOTS['bg-meadow'];

/** A fish picture, nose on the left. Returns a canvas len + 4 wide. */
export function fishPic(look, len) {
  const L = Math.max(5, Math.round(len));
  const D = Math.max(3, Math.round(L * look.depth));
  const w = L + 4; const h = D + 6;
  const c = canvas(w, h); const x = c.getContext('2d');
  const cy = 3 + D / 2;
  const inBody = (i, j) => {
    const u = (i - 1) / L;
    if (u < 0 || u > 1) return false;
    let half;
    const neck = D * 0.17; // where the tail joins
    if (u <= 0.8) {
      const k = u / 0.8;
      const front = look.snout ? 0.55 : look.depth > 0.5 ? 0.45 : 0.35; // where the fish is deepest
      if (k < front) half = (D / 2) * (look.snout ? 0.35 + 0.65 * (k / front) : Math.sqrt(Math.sin((Math.PI / 2) * (k / front))));
      else half = D / 2 - (D / 2 - neck) * ((k - front) / (1 - front)) ** 1.4;
      if (look.flat && j < cy) half *= 0.85;
    } else {
      // forked tail
      const k = (u - 0.8) / 0.2;
      half = neck + (D / 2 - neck) * k * 1.05;
      if (k > 0.55 && Math.abs(j + 0.5 - cy) < half * 0.45) return false;
    }
    if (look.mark === 'sword' && u < 0.12) return false;
    return Math.abs(j + 0.5 - cy) <= half + 0.01;
  };
  const px = (i, j, col) => { x.fillStyle = col; x.fillRect(i, j, 1, 1); };
  for (let i = 0; i < w; i += 1) {
    for (let j = 0; j < h; j += 1) {
      if (!inBody(i, j)) continue;
      const edge = !inBody(i - 1, j) || !inBody(i + 1, j) || !inBody(i, j - 1) || !inBody(i, j + 1);
      if (edge) { px(i, j, '#1b1430'); continue; }
      const u = (i - 1) / L;
      let col = j + 0.5 < cy - D * 0.12 ? look.back : j + 0.5 > cy + D * 0.2 ? look.belly : look.side;
      if (u > 0.8) col = look.fin;
      if (look.mark === 'bars' && u > 0.2 && u < 0.78 && Math.floor(u * 9) % 2 === 0 && j + 0.5 < cy + D * 0.25) col = look.bar || look.back;
      if (look.mark === 'stripe' && Math.abs(j + 0.5 - cy) < 0.8 && u > 0.18 && u < 0.85) col = look.back;
      if ((look.mark === 'spots' || look.mark === 'glow') && u > 0.2 && u < 0.78 && (i * 7 + j * 13) % 9 === 0 && j + 0.5 < cy + D * 0.3) col = look.belly;
      if (look.mark === 'flame' && u > 0.25 && u < 0.78 && (i + j) % 4 === 0) col = '#ffd43b';
      if (look.mark === 'comet' && u > 0.2 && u < 0.78 && (i * 5 + j * 3) % 7 === 0) col = '#ffffff';
      px(i, j, col);
    }
  }
  // dorsal fin, sitting on the back
  const fx = Math.round(1 + L * 0.38);
  const finH = look.mark === 'puff' ? 1 : Math.max(1, Math.round(D * 0.22));
  const finW = Math.max(2, Math.round(L * 0.28));
  for (let k = 0; k < finW; k += 1) {
    let j0 = 0; while (j0 < h && !inBody(fx + k, j0)) j0 += 1;
    const fh = Math.max(1, Math.round(finH * (1 - k / (finW + 1))));
    for (let j = 1; j <= fh; j += 1) px(fx + k, j0 - j, j === fh ? '#1b1430' : look.fin);
  }
  const top = Math.round(cy - D / 2);
  // eye
  const ex = Math.round(1 + L * (look.snout ? 0.16 : 0.12)); const ey = Math.round(cy - D * 0.18);
  px(ex, ey, look.eye || '#ffffff'); px(ex + 1, ey, '#1b1430');
  if (look.mark === 'bars' && look.depth > 0.5) { px(ex + 2, ey + 1, '#1b1430'); px(ex + 3, ey + 1, '#1b1430'); } // bluegill's dark ear flap
  if (look.mark === 'whiskers') { px(0, Math.round(cy), '#1b1430'); px(1, Math.round(cy) + 1, '#1b1430'); px(0, Math.round(cy) + 2, '#1b1430'); }
  if (look.mark === 'horn') { px(1, top - 1, '#ffd43b'); px(0, top - 2, '#ffd43b'); }
  if (look.mark === 'crown') { for (const d of [0, 2, 4]) { px(ex + d, top - 2, '#ffd43b'); } for (let d = 0; d < 5; d += 1) px(ex + d, top - 1, '#fcc419'); }
  if (look.mark === 'sword') for (let i = 0; i < 2 + L * 0.12; i += 1) px(i, Math.round(cy) - 1, i === 0 ? '#1b1430' : '#adb5bd');
  if (look.mark === 'puff') for (let i = 3; i < L * 0.75; i += 3) { px(i, Math.round(cy - D / 2) - 1, '#1b1430'); px(i, Math.round(cy + D / 2) + 1, '#1b1430'); }
  return c;
}

// ---------- bait pictures (6 x 6) ----------
const BAIT_PIX = {
  worm: ['......', '.RR...', 'R..R..', '...R.R', '....RR', '......'],
  jig: ['..KK..', '.KYYK.', '.KYYK.', '..KYYY', '..YYYY', '...Y.Y'],
  spoon: ['..K...', '.KSK..', 'KSWSK.', 'KSSSK.', '.KSK..', '..KR..'],
};
const BAIT_COL = { R: '#f06595', K: '#1b1430', Y: '#fab005', S: '#ced4da', W: '#ffffff' };
function baitPic(kind) {
  const c = canvas(6, 6); const x = c.getContext('2d');
  BAIT_PIX[kind].forEach((row, j) => [...row].forEach((ch, i) => { if (ch !== '.') { x.fillStyle = BAIT_COL[ch]; x.fillRect(i, j, 1, 1); } }));
  return c;
}

// ---------- the game ----------
export class Fishing {
  /** opts: { W, H, kid, visitor, best, seed, map: Places background id, day: date string } */
  constructor(opts) {
    this.kind = 'fishing';
    this.W = opts.W; this.H = opts.H;
    this.r = rng(opts.seed || 1);
    this.spot = spotFor(opts.map);
    this.today = baitToday(opts.day || 'today');
    if (this.spot.special) for (const b of BAITS) this.today[b][this.spot.special.id] = this.spot.special.like[b];
    this.t = 0; this.pops = []; this.best = opts.best || 0;
    this.points = { kid: 0, vis: 0 }; this.newBest = false;
    this.holdAnywhere = true; this.locked = false;
    this.rodTier = clamp(opts.kid.gear?.rod || 1, 1, 3); this.visTier = clamp(opts.visitor.gear?.rod || 1, 1, 3);
    this.surface = Math.round(this.H * 0.36);
    this.bankX = Math.max(46, Math.round(this.W * 0.21));
    // the lake bed slopes up to the shore under the buddies, then runs along the bottom
    this.slopeRun = Math.round((this.W - this.bankX) * 0.34);
    const deepest = this.H - 9 - this.surface;
    this.slopeK = deepest / this.slopeRun; // pixels down for each pixel out
    const floor = (x) => Math.round(this.H - 9 + 1.6 * Math.sin(x / 13) + Math.sin(x / 5.3));
    this.bedAt = (x) => (x <= this.bankX ? this.surface + 2 : Math.min(floor(x), Math.round(this.surface + 2 + (x - this.bankX) * this.slopeK)));
    // the slope: nothing at depth y goes left of this
    this.shoreX = (y) => this.bankX + Math.max(0, y - this.surface - 2) / this.slopeK;
    this.leftLimit = this.bankX + this.slopeRun * 0.55;
    const rod = (b) => ({ ...b, outfit: { ...(b?.outfit || {}), music: undefined, sport: `sport-rod-${['regular', 'good', 'super'][Math.max(0, Math.min(2, (opts.kid.gear?.rod || 1) - 1))]}` } });
    this.kid = new Player(rod(opts.kid.buddy), opts.kid.name, 11, this.bankX - 13, this.surface - 3);
    this.vis = new Player(rod(opts.visitor.buddy), opts.visitor.name, 23, this.bankX - 32, this.surface - 3);
    for (const p of [this.kid, this.vis]) { p.face = 1; p.brain.set(HAPPY); }
    this.lines = { kid: this.newLine(this.kid), vis: this.newLine(this.vis) };
    this.bait = 'worm';
    this.lines.vis.bait = 'jig';
    this.ai = { next: 1.5 };
    this.placeCover();
    this.field = this.paint();
    this.baitPics = Object.fromEntries(BAITS.map((b) => [b, baitPic(b)]));
    this.fish = []; this.schools = [];
    this.nextSpawn = 0;
    this.button = { x: this.W - 15, y: this.H - 15, r: 12 };
    this.left = GAME_SECONDS;
    this.phase = 'ready';
    this.catches = [];
    this.seedFish();
  }

  /** The kid's points, like the other games' score. */
  get score() { return this.points.kid; }

  newLine(p) { return { who: p, state: 'idle', bait: 'worm', x: 0, y: 0, held: false, downAt: 0, snagged: null, tried: new Set(), fish: null, tension: 0, meterAt: 0 }; }

  rodTip(p) { return [Math.round(p.x) + 10, Math.round(p.y) - FEET + 4]; }

  // ---------- the lake ----------
  placeCover() {
    const r = this.r; const W = this.W;
    this.weeds = []; this.logs = [];
    const n = Math.max(3, Math.round(W / 50));
    for (let i = 0; i < n; i += 1) {
      const x = Math.round(this.bankX + this.slopeRun * 0.45 + ((W - this.bankX - this.slopeRun * 0.45 - 8) * (i + 0.2 + r() * 0.6)) / n);
      const h = Math.round((this.bedAt(x) - this.surface) * (0.3 + r() * 0.35));
      this.weeds.push({ x, w: 7 + Math.round(r() * 5), h, top: this.bedAt(x) - h, seed: r() * 10 });
    }
    const nl = W > 160 ? 2 : 1;
    for (let i = 0; i < nl; i += 1) {
      const x0 = this.bankX + this.slopeRun + 4;
      const x = Math.round(x0 + (W - x0 - 40) * (i / nl + (r() * 0.35) / nl) + 10 * i);
      const len = 20 + Math.round(r() * 10);
      this.logs.push({ x, len, y: this.bedAt(x + len / 2) - 4, h: 4 });
    }
  }

  paint() {
    const { W, H } = this; const sp = this.spot; const r = rng(77);
    const c = canvas(W, H); const x = c.getContext('2d');
    const rect = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    // sky bands
    const S = this.surface;
    for (let y = 0; y < S; y += 1) rect(y < S * 0.55 ? sp.sky[0] : sp.sky[1], 0, y, W, 1);
    if (sp.stars) for (let i = 0; i < W / 3; i += 1) rect(['#ffffff', '#ffd43b', '#b197fc'][i % 3], Math.floor(r() * W), Math.floor(r() * (S - 4)), 1, 1);
    this.paintFar(x, sp.far, r);
    // water: three bands of depth, with a ripple between them
    const deep = H - S;
    for (let y = S; y < H; y += 1) {
      const k = (y - S) / deep;
      const band = k < 0.33 ? 0 : k < 0.66 ? 1 : 2;
      rect(sp.water[band], 0, y, W, 1);
      if (Math.abs(k - 0.33) < 0.01 || Math.abs(k - 0.66) < 0.01) for (let i = (y % 2) * 2; i < W; i += 4) rect(sp.water[Math.max(0, band - 1)], i, y, 2, 1);
    }
    // light streaks in the water
    for (let i = 0; i < W / 9; i += 1) rect(sp.water[0], Math.floor(r() * W), S + 4 + Math.floor(r() * deep * 0.7), 3 + Math.floor(r() * 4), 1);
    // surface line
    for (let i = 0; i < W; i += 1) rect(i % 6 < 3 ? '#ffffff' : sp.water[0], i, S, 1, 1);
    // lake bed
    for (let i = 0; i < W; i += 1) {
      const b = this.bedAt(i);
      rect(sp.bed[0], i, b, 1, H - b);
      rect(sp.bed[1], i, b + 3, 1, H);
      if (sp.bedKind === 'bricks') { if ((i % 6 === 0)) rect(sp.bed[1], i, b, 1, 3); }
      else if (r() < 0.12) rect(sp.bed[1], i, b + 1, 1, 1);
    }
    if (sp.coral) for (let i = 0; i < W / 30; i += 1) this.paintCoral(x, Math.floor(this.bankX + 20 + r() * (W - this.bankX - 20)), r);
    // the shore: land at the top left, a muddy slope down into the water
    const L = sp.land;
    for (let i = 0; i < this.bankX; i += 1) {
      const top = S - 3;
      rect(L[0], i, top, 1, 2);
      rect(L[1], i, top + 2, 1, 2);
      rect(L[2], i, top + 4, 1, H - top - 4);
      if (r() < 0.2) rect(L[1], i, top + 6 + Math.floor(r() * (H - top - 8)), 1, 1);
      if (r() < 0.05) { const sy = top + 10 + Math.floor(r() * (H - top - 16)); rect('#1b1430', i, sy, 4, 3); rect(L[0] === L[2] ? '#adb5bd' : L[1], i, sy, 3, 2); }
    }
    // pebbles where the slope meets the shore
    for (let i = this.bankX; i < this.bankX + this.slopeRun * 0.3; i += 3) if (r() < 0.6) rect(sp.bed[1], i, this.bedAt(i), 2, 1);
    // grass tufts on the bank
    for (let i = 1; i < this.bankX - 1; i += 4) rect(L[1], i, S - 4, 1, 1);
    // logs on the bottom
    for (const g of this.logs) this.paintLog(x, g, sp);
    return c;
  }

  paintFar(x, kind, r) {
    const { W } = this; const S = this.surface;
    const rect = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const disc = (col, cx, cy, rr) => { for (let j = -rr; j <= rr; j += 1) { const half = Math.round(Math.sqrt(rr * rr - j * j + rr * 0.6)); rect(col, cx - half, cy + j, half * 2 + 1, 1); } };
    if (kind === 'trees' || kind === 'palms') {
      for (let i = this.bankX; i < W; i += 7 + Math.floor(r() * 5)) {
        const h = 6 + Math.floor(r() * 6);
        if (kind === 'trees') { rect('#2f7d32', i, S - h + 1, 7, h - 3); rect('#2f7d32', i + 1, S - h, 5, 1); rect('#3c9a3c', i + 1, S - h + 1, 3, 2); rect('#1e5e22', i + 4, S - 4, 3, 2); rect('#5c3a1e', i + 3, S - 2, 1, 2); }
        else { rect('#8d6e63', i + 2, S - h, 1, h); rect('#2b8a3e', i - 1, S - h - 1, 7, 2); rect('#2b8a3e', i, S - h - 2, 5, 1); }
      }
      rect(kind === 'trees' ? '#3c9a3c' : '#e5b574', this.bankX, S - 2, W, 2);
      if (kind === 'palms') { disc('#fff3bf', W - 26, 10, 6); disc('#ffe066', W - 26, 10, 4); }
    } else if (kind === 'castle') {
      const x0 = Math.round(W * 0.55);
      rect('#868e96', this.bankX, S - 6, W, 6);
      for (let i = this.bankX; i < W; i += 4) rect('#868e96', i, S - 8, 2, 2);
      rect('#adb5bd', x0, S - 22, 34, 16); for (let i = 0; i < 34; i += 4) rect('#adb5bd', x0 + i, S - 24, 2, 2);
      rect('#adb5bd', x0 - 6, S - 30, 8, 24); rect('#7048e8', x0 - 7, S - 34, 10, 4); rect('#7048e8', x0 - 5, S - 37, 6, 3); rect('#7048e8', x0 - 3, S - 39, 2, 2);
      rect('#adb5bd', x0 + 32, S - 30, 8, 24); rect('#7048e8', x0 + 31, S - 34, 10, 4); rect('#7048e8', x0 + 33, S - 37, 6, 3); rect('#7048e8', x0 + 35, S - 39, 2, 2);
      rect('#495057', x0 + 13, S - 14, 8, 8); rect('#495057', x0 + 14, S - 15, 6, 1);
      rect('#f783ac', x0 + 36, S - 44, 1, 5); rect('#f783ac', x0 + 37, S - 44, 4, 2);
    } else if (kind === 'sea') {
      rect('#74c0fc', this.bankX, S - 3, W, 3);
      rect('#ffffff', W - 50, 6, 14, 3); rect('#ffffff', W - 47, 4, 8, 2); rect('#ffffff', W - 100, 10, 10, 2);
      // a little sailboat
      rect('#8d6e63', W - 70, S - 5, 12, 2); rect('#ffffff', W - 65, S - 14, 1, 9); rect('#ffffff', W - 64, S - 13, 5, 7);
    } else if (kind === 'moon') {
      rect('#5c5f8a', this.bankX, S - 4, W, 4);
      for (let i = this.bankX; i < W; i += 23) { rect('#7d82a8', i, S - 8, 12, 4); rect('#9a9fc4', i + 2, S - 9, 8, 1); }
      // the earth
      disc('#4dabf7', W - 29, 10, 5); rect('#40c057', W - 32, 7, 4, 3); rect('#40c057', W - 28, 11, 3, 2); rect('#ffffff', W - 30, 6, 3, 1);
    } else if (kind === 'volcano') {
      const cx = Math.round(W * 0.68);
      for (let k = 0; k < 28; k += 1) rect('#2b211d', cx - 36 + k, S - k, 72 - 2 * k, 1);
      rect('#ff6b1a', cx - 8, S - 28, 16, 2); rect('#ffd43b', cx - 5, S - 29, 10, 1);
      rect('#ff6b1a', cx - 2, S - 26, 2, 10); rect('#ff6b1a', cx + 3, S - 26, 1, 14);
      rect('#495057', cx - 6, S - 34, 5, 3); rect('#495057', cx - 3, S - 38, 6, 4); rect('#343a40', cx + 1, S - 42, 5, 4);
      rect('#2b211d', this.bankX, S - 2, W, 2);
    } else if (kind === 'rainbow') {
      const cols = ['#ff6b6b', '#ffa94d', '#ffd43b', '#69db7c', '#4dabf7', '#b197fc'];
      const cx = Math.round(W * 0.66); const R = Math.round(Math.min(W * 0.3, S * 0.95));
      cols.forEach((col, k) => {
        for (let a = 0; a <= 180; a += 1) {
          const rr = R - k * 2;
          const px = Math.round(cx + Math.cos((a * Math.PI) / 180) * rr * 1.5); const py = Math.round(S - Math.sin((a * Math.PI) / 180) * rr);
          rect(col, px, py, 2, 2);
        }
      });
      for (let i = this.bankX; i < W; i += 9) { rect('#ffffff', i, S - 4, 8, 4); rect('#ffffff', i + 2, S - 6, 4, 2); }
    } else if (kind === 'spires') {
      for (let i = this.bankX + 4; i < W; i += 14 + Math.floor(r() * 10)) {
        const h = 8 + Math.floor(r() * 14); const gold = r() < 0.5;
        for (let k = 0; k < h; k += 1) rect(gold ? '#fcc419' : '#9775fa', i + Math.floor(k / 4), S - k, Math.max(1, 4 - Math.floor(k / 3)), 1);
      }
      rect('#5f3dc4', this.bankX, S - 2, W, 2);
      disc('#ffd43b', W - 36, 10, 4); rect('#fff3bf', W - 38, 8, 2, 2);
    }
  }

  paintLog(x, g, sp) {
    const rect = (col, a, b, w, h) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
    const [mid, dark, light] = sp.log;
    if (sp.logKind === 'cane') {
      for (let i = 0; i < g.len; i += 1) rect(Math.floor(i / 3) % 2 ? '#e03131' : '#ffffff', g.x + i, g.y, 1, g.h);
      rect('#1b1430', g.x, g.y - 1, g.len, 1); rect('#1b1430', g.x, g.y + g.h, g.len, 1);
      return;
    }
    rect('#1b1430', g.x - 1, g.y - 1, g.len + 2, g.h + 2);
    rect(mid, g.x, g.y, g.len, g.h);
    rect(dark, g.x, g.y + g.h - 1, g.len, 1);
    rect(light, g.x, g.y, g.len, 1);
    if (sp.logKind === 'pipe') { for (let i = 4; i < g.len; i += 6) rect(dark, g.x + i, g.y, 1, g.h); rect('#1b1430', g.x + g.len - 1, g.y + 1, 1, g.h - 2); return; }
    if (sp.logKind === 'charred') { for (let i = 2; i < g.len; i += 5) rect('#ff6b1a', g.x + i, g.y + 1 + (i % 2), 2, 1); return; }
    if (sp.logKind === 'rock') { for (let i = 3; i < g.len; i += 7) rect(light, g.x + i, g.y + 2, 1, 1); return; }
    // bark lines, the cut end and a stub of a branch
    for (let i = 3; i < g.len - 2; i += 5) rect(dark, g.x + i, g.y + 1, 3, 1);
    rect(light, g.x + g.len - 2, g.y + 1, 1, g.h - 2);
    rect(dark, g.x + Math.round(g.len * 0.6), g.y - 3, 2, 3); rect('#1b1430', g.x + Math.round(g.len * 0.6) - 1, g.y - 4, 4, 1);
  }

  paintCoral(x, cx, r) {
    const b = this.bedAt(cx);
    const col = ['#ff8787', '#f783ac', '#ffa94d'][Math.floor(r() * 3)];
    for (let k = 0; k < 7; k += 1) { x.fillStyle = col; x.fillRect(cx + Math.round(Math.sin(k) * 2), b - k, 1, 1); x.fillRect(cx + 2 + Math.round(Math.cos(k) * 1.5), b - k + 2, 1, 1); }
  }

  drawWeeds(ctx) {
    const sp = this.spot;
    for (const w of this.weeds) {
      const bed = this.bedAt(w.x);
      for (let s = 0; s < 4; s += 1) {
        const sx = w.x - Math.floor(w.w / 2) + Math.round((s * w.w) / 4) + 1;
        const h = Math.round(w.h * (0.65 + 0.35 * Math.sin(w.seed + s * 1.7) ** 2));
        for (let k = 0; k < h; k += 1) {
          const sway = sp.weedKind ? 0 : Math.round(Math.sin(this.t * 1.3 + k * 0.35 + s + w.seed) * (k / h) * 2);
          ctx.fillStyle = (k + s) % 3 ? sp.weed[0] : sp.weed[1];
          if (sp.weedKind === 'crystal' || sp.weedKind === 'rock') {
            const wid = Math.max(1, Math.round((1 - k / h) * 3));
            ctx.fillRect(sx + sway - Math.floor(wid / 2), bed - k, wid, 1);
          } else ctx.fillRect(sx + sway, bed - k, 1, 1);
          if (!sp.weedKind && k % 3 === 1 && k < h - 1) { const side = (k + s) % 2 ? 1 : -2; ctx.fillStyle = sp.weed[1]; ctx.fillRect(sx + sway + side, bed - k - 1, 2, 1); }
        }
      }
    }
  }

  drawTop(ctx) {
    const sp = this.spot; const S = this.surface; const t = this.t;
    if (sp.top === 'lily') {
      for (const lx of [0.42, 0.63, 0.88]) {
        const x = Math.round(this.W * lx + Math.sin(t * 0.4 + lx * 9));
        ctx.fillStyle = '#2b8a3e'; ctx.fillRect(x, S - 1, 7, 2); ctx.fillStyle = '#51cf66'; ctx.fillRect(x + 1, S - 1, 4, 1);
        if (lx > 0.6 && lx < 0.7) { ctx.fillStyle = '#ffdeeb'; ctx.fillRect(x + 2, S - 3, 3, 2); ctx.fillStyle = '#f783ac'; ctx.fillRect(x + 3, S - 3, 1, 1); }
      }
    } else if (sp.top === 'bubbles' || sp.top === 'goo' || sp.top === 'lava') {
      const col = sp.top === 'lava' ? '#ffd43b' : sp.top === 'goo' ? '#b2f2bb' : '#d0ebff';
      for (let i = 0; i < 6; i += 1) {
        const cyc = (t * 0.35 + i * 0.37) % 1;
        const x = Math.round(this.bankX + 20 + ((i * 53) % (this.W - this.bankX - 24)));
        const y = Math.round(this.H - 12 - cyc * (this.H - S - 12));
        ctx.fillStyle = col; ctx.fillRect(x, y, sp.top === 'bubbles' ? 1 : 2, sp.top === 'bubbles' ? 1 : 2);
      }
    } else if (sp.top === 'sparkle' || sp.top === 'stars' || sp.top === 'shine') {
      for (let i = 0; i < 8; i += 1) {
        if (Math.floor(t * 3 + i * 1.7) % 3 === 0) continue;
        const x = Math.round(this.bankX + ((i * 71) % (this.W - this.bankX))); const y = S + 2 + ((i * 37) % (this.H - S - 14));
        ctx.fillStyle = sp.top === 'stars' ? '#ffd43b' : '#ffffff'; ctx.fillRect(x, y, 1, 1);
        if (sp.top !== 'shine') { ctx.fillRect(x - 1, y, 3, 1); ctx.fillRect(x, y - 1, 1, 3); }
      }
    }
  }

  // ---------- fish coming and going ----------
  pickKind() {
    const sp = this.spot; const odds = { ...sp.odds };
    if (sp.special) odds.special = sp.special.odds;
    const total = Object.values(odds).reduce((a, b) => a + b, 0);
    let x = this.r() * total;
    for (const [k, v] of Object.entries(odds)) { x -= v; if (x <= 0) return k; }
    return 'bluegill';
  }

  seedFish() {
    // the lake starts empty and fills up as fish swim in from the right
    this.arrivals = [[0, 'bluegill'], [0.7, 'largemouth'], [1.5, 'catfish'], [2.4, 'pike'], [3.4, this.pickKind()]];
    this.nextSpawn = 6;
  }

  makeFish(kind, x, y, move) {
    const sp = this.spot;
    const base = kind === 'special' ? SPECIES[sp.special.as] : SPECIES[kind];
    const look = kind === 'special' ? { ...base, ...sp.special.look, snout: base.snout, flat: false } : base;
    const size = this.r() ** 1.6; // big ones are rarer
    const len = base.len[0] + (base.len[1] - base.len[0]) * size;
    const f = {
      kind, likeKey: kind === 'special' ? sp.special.id : kind, name: kind === 'special' ? sp.special.name : base.name,
      size, len, inches: Math.round(base.inches[0] + (base.inches[1] - base.inches[0]) * size),
      pic: fishPic(look, len), x, y, vx: 0, vy: 0, dir: x < this.W / 2 ? 1 : -1, speed: base.speed * (0.8 + this.r() * 0.4),
      move, state: 'swim', born: this.t, life: 10 + this.r() * 20, homeY: y, wob: this.r() * 10, mood: 0, checkAt: 0, pull: base.pull,
    };
    this.fish.push(f);
    return f;
  }

  /** A new fish (or school) just off the right edge; it swims onto the screen. */
  spawn(kind) {
    const W = this.W; const S = this.surface; const deep = this.H - S;
    const side = this.r() < 0.5 ? -1 : 1;
    const edgeX = W + 50; // the left side is the shore, so new fish swim in from the right
    const move = kind === 'special' ? MOVES[this.spot.special.as] : MOVES[kind];
    const startX = edgeX;
    if (move === 'school') {
      const cy = S + deep * (0.3 + this.r() * 0.3);
      const school = { x: startX, y: cy, dir: -1, speed: 5 + this.r() * 3, born: this.t, life: 12 + this.r() * 18, members: [] };
      const n = 5 + Math.floor(this.r() * 5);
      for (let i = 0; i < n; i += 1) {
        const f = this.makeFish(kind, startX, cy, 'school');
        f.ox = (this.r() - 0.5) * 26; f.oy = (this.r() - 0.5) * 12; f.school = school;
        school.members.push(f);
      }
      this.schools.push(school);
      // a smallmouth or two hang around the school
      const sm = this.r() < 0.6 ? 1 + (this.r() < 0.4 ? 1 : 0) : 0;
      for (let i = 0; i < sm; i += 1) { const f = this.makeFish('smallmouth', startX, cy, 'shadow'); f.school = school; f.ox = (this.r() < 0.5 ? -1 : 1) * (18 + this.r() * 8); f.oy = 4 + this.r() * 6; }
      return;
    }
    if (move === 'shadow') {
      const sc = this.schools.find((s) => !s.gone);
      if (!sc) return this.spawn('largemouth');
      const f = this.makeFish(kind, startX, sc.y, 'shadow'); f.school = sc; f.ox = (this.r() < 0.5 ? -1 : 1) * (18 + this.r() * 8); f.oy = 4 + this.r() * 6;
      return;
    }
    if (move === 'lurk') {
      const w = this.weeds[Math.floor(this.r() * this.weeds.length)];
      const y = this.bedAt(w.x) - 4 - this.r() * Math.max(4, w.h * 0.6);
      const f = this.makeFish(kind, edgeX, y, 'lurk');
      f.post = [w.x + (this.r() - 0.5) * 10, y]; f.life = 15 + this.r() * 25;
      return;
    }
    if (move === 'bottom') {
      const g = this.logs[Math.floor(this.r() * this.logs.length)];
      const px = g.x + (this.r() < 0.5 ? -8 : g.len + 6);
      const f = this.makeFish(kind, edgeX, this.bedAt(px) - 3, 'bottom');
      f.post = [px, this.bedAt(px) - 2]; f.life = 18 + this.r() * 30;
      return;
    }
    // cruise: mostly one depth, near the weeds for largemouth
    const y = S + deep * (0.2 + this.r() * 0.55);
    this.makeFish(kind, startX, y, 'cruise').dir = -1;
  }

  stepFish(dt) {
    const W = this.W; const S = this.surface;
    while (this.arrivals.length && this.t >= this.arrivals[0][0]) this.spawn(this.arrivals.shift()[1]);
    if (this.t >= this.nextSpawn) {
      this.nextSpawn = this.t + 3 + this.r() * 5;
      const loose = this.fish.filter((f) => f.move !== 'school').length;
      if (loose < 6 || (this.schools.filter((s) => !s.gone).length === 0)) this.spawn(this.pickKind());
    }
    for (const sc of this.schools) {
      if (sc.gone) continue;
      const age = this.t - sc.born;
      const leaving = age > sc.life;
      sc.x += sc.dir * sc.speed * dt;
      sc.y += Math.sin(this.t * 0.3 + sc.born) * 1.5 * dt;
      if (!leaving && sc.x < this.leftLimit + 8) sc.dir = 1;
      if (!leaving && sc.x > W - 18) sc.dir = -1;
      if (leaving) sc.dir = 1;
      if (sc.x > W + 60) sc.gone = true;
    }
    for (const f of this.fish) {
      const age = this.t - f.born;
      const leaving = age > f.life;
      let tx = f.x; let ty = f.y; let spd = f.speed;
      if (f.state === 'hooked') continue;
      if (f.state === 'flee') {
        tx = f.x + f.dir * 60; ty = f.y + (this.r() - 0.5) * 2; spd = f.speed * 3;
      } else if (f.state === 'interest' && f.line && f.line.state === 'water') {
        const L = f.line;
        const side = L.x < f.x ? 1 : -1;
        tx = L.x + side * (f.len * 0.5 + 2); ty = L.y + 1; spd = f.speed * 1.4;
        f.dir = L.x < f.x ? -1 : 1;
      } else if (f.move === 'school' || f.move === 'shadow') {
        const sc = f.school;
        if (sc && !sc.gone) {
          tx = sc.x + f.ox * (f.move === 'shadow' ? sc.dir * -1 : 1) + Math.sin(this.t * 0.9 + f.wob) * 2;
          ty = sc.y + f.oy + Math.sin(this.t * 1.3 + f.wob) * 1.2;
          spd = sc.speed * 2.2; f.dir = sc.dir;
        } else { tx = f.x + f.dir * 30; spd = f.speed; }
      } else if (f.move === 'lurk' || f.move === 'bottom') {
        if (leaving) {
          // swim up a bit, then off the nearest side
          f.dir = 1; tx = f.x + 40; ty = Math.max(S + 10, (f.post?.[1] ?? f.y) - 14);
        } else {
          const [px, py] = f.post;
          const drift = Math.sin(this.t * 0.25 + f.wob);
          tx = px + drift * (f.move === 'bottom' ? 6 : 3); ty = py + (f.move === 'lurk' ? Math.sin(this.t * 0.6 + f.wob) * 1.5 : 0);
          spd = Math.hypot(px - f.x, py - f.y) > 8 ? f.speed * (f.move === 'bottom' ? 2 : 1) : f.speed * 0.35;
          if (Math.abs(tx - f.x) > 2) f.dir = tx > f.x ? 1 : -1;
        }
      } else {
        // cruise
        if (leaving) f.dir = 1;
        else if (f.x < this.leftLimit && f.dir < 0) f.dir = 1;
        else if (f.x > W - 14 && f.dir > 0) f.dir = -1;
        tx = f.x + f.dir * 20; ty = f.homeY + Math.sin(this.t * 0.4 + f.wob) * 4;
      }
      ty = clamp(ty, S + 4, this.bedAt(f.x) - 2);
      const dx = tx - f.x; const dy = ty - f.y; const d = Math.hypot(dx, dy);
      if (d > 0.3) { const k = Math.min(1, (spd * dt) / d); f.x += dx * k; f.y += dy * k; }
      if (f.x > W + 60) f.gone = true;
      if (leaving && (f.move === 'cruise' || (f.move === 'school' && f.school?.gone))) { /* they swim off on their own */ }
      // keep out of the bank
      // stay off the slope
      const shore = this.shoreX(f.y + 3) + f.len * 0.5;
      if (f.x < shore) f.x = shore;
      if (f.y > this.bedAt(f.x) - 2) f.y = this.bedAt(f.x) - 2;
      // which way the picture faces: only turns after a short while, so it never flickers
      if (f.face === undefined) f.face = f.dir;
      if (f.dir !== f.face && (f.state === 'hooked' || this.t - (f.turnAt || -9) > 0.7)) { f.face = f.dir; f.turnAt = this.t; }
    }
    this.fish = this.fish.filter((f) => !f.gone);
    this.schools = this.schools.filter((s) => !s.gone || this.fish.some((f) => f.school === s));
  }

  // ---------- lines and bait ----------
  // phases: idle -> aim (needle swinging) -> air -> water -> (snag | fight) -> idle
  startCast(L) { if (L.state === 'idle') { L.state = 'aim'; L.meterAt = this.t; } }

  meter(L) { const ph = ((this.t - L.meterAt) / SWEEP) % 2; return ph < 1 ? ph : 2 - ph; }

  /** Red short, yellow medium, green far; a better rod widens green a little. */
  zoneOf(m, tier = this.rodTier) { const g = 0.82 - 0.04 * (tier - 1); return m < 0.45 ? 'red' : m < g ? 'yellow' : 'green'; }

  cast(L, m = this.meter(L)) {
    const tier = L === this.lines.vis ? this.visTier : this.rodTier;
    const zone = this.zoneOf(m, tier);
    const g = 0.82 - 0.04 * (tier - 1);
    const reach = this.W - this.bankX - 14;
    const span = { red: [0.12, 0.32], yellow: [0.38, 0.62], green: [0.7, 0.95] }[zone];
    const k = zone === 'red' ? m / 0.45 : zone === 'yellow' ? (m - 0.45) / (g - 0.45) : (m - g) / (1 - g);
    const land = this.bankX + 14 + reach * (span[0] + (span[1] - span[0]) * clamp(k, 0, 1));
    const [rx, ry] = this.rodTip(L.who);
    L.state = 'air'; L.from = [rx, ry]; L.to = [Math.round(land), this.surface]; L.t0 = this.t; L.flight = 0.5 + 0.5 * (land - rx) / reach;
    L.zone = zone; L.tried = new Set(); L.snagged = null; L.fish = null; L.tension = 0;
    L.who.brain.set({ ...HAPPY, arousal: 0.8 });
    if (L === this.lines.kid) this.sound = 'kick';
    this.pop(zone === 'green' ? 'Far!' : zone === 'yellow' ? 'Nice cast' : 'Short', rx + 16, ry - 4, ZONE_COLORS[zone]);
  }

  /** Tap: a quick twitch of the bait. */
  twitch(L) {
    if (L.state !== 'water') return;
    L.y = Math.max(this.surface + 2, L.y - 3); L.x = Math.max(this.bankX + 4, L.x - 2); L.twitchAt = this.t;
    for (const f of this.fish) {
      if (f.line !== L || f.state !== 'interest') continue;
      if (Math.hypot(f.x - L.x, f.y - L.y) > 12 + f.len / 2) continue;
      // one roll per twitch: a bite, or it bolts and startles the fish around it
      if (this.r() < strikeChance(f.size)) this.hook(L, f);
      else { this.spook(f, 'Spooked!'); this.startle(f); }
      break;
    }
  }

  hook(L, f) {
    f.state = 'hooked'; f.dir = -1; f.face = -1; L.fish = f;
    f.x = L.x + f.pic.width / 2 - 1; f.y = L.y + 1; // nose on the bait
    L.state = 'fight'; L.tension = 0.2; f.stamina = 0.4 + f.size * 1.2 + f.pull * 0.6; f.runAt = this.t + 1 + this.r() * 2;
    for (const o of this.fish) if (o.line === L && o !== f && o.state === 'interest') { o.state = 'swim'; o.line = null; }
    this.pop('Fish on!', L.x, L.y - 6, '#ffd43b', true);
    if (L === this.lines.kid) { this.sound = 'tag'; this.buzz = [40]; }
    L.who.brain.set({ ...HAPPY, valence: 0.9, arousal: 0.9 });
  }

  /** A fish bolted: its school bolts too, and anything else nearby keeps away from the bait for a while. */
  startle(f) {
    for (const o of this.fish) {
      if (o === f || o.state === 'hooked' || o.state === 'flee') continue;
      if (o.move === 'school' && o.school && o.school === f.school) { this.spook(o); continue; }
      if (Math.hypot(o.x - f.x, o.y - f.y) > 30) continue;
      if (o.state === 'interest') { o.state = 'swim'; o.line = null; }
      o.waryUntil = this.t + WARY;
    }
    if (f.school && f.move === 'school') f.school.life = 0; // the school swims off
  }

  spook(f, msg) {
    f.state = 'flee'; f.line = null; f.dir = 1;
    f.life = 0;
    if (msg) this.pop(msg, f.x, f.y - 5, '#ff8787');
  }

  stepLine(L, dt, holding) {
    const S = this.surface;
    if (L.state === 'air') {
      const k = Math.min(1, (this.t - L.t0) / L.flight);
      L.x = L.from[0] + (L.to[0] - L.from[0]) * k;
      L.y = L.from[1] + (L.to[1] - L.from[1]) * k - Math.sin(Math.PI * k) * 26;
      if (k >= 1) { L.state = 'water'; L.y = S + 1; this.splash(L.x); }
      return;
    }
    if (L.state === 'snag') {
      if (holding) {
        L.tug = (L.tug || 0) + dt;
        if (L.tug > 0.6) {
          L.tug = 0;
          if (this.r() < 0.5) { L.state = 'water'; L.y -= 4; L.tried.add(L.snagged); L.snagged = null; this.pop('Free!', L.x, L.y - 4, '#b2f2bb'); } else { this.pop('Snap! New bait', L.x, L.y - 4, '#ff8787'); L.state = 'idle'; }
        }
      }
      return;
    }
    if (L.state === 'fight') return this.stepFight(L, dt, holding);
    if (L.state !== 'water') return;
    const bed = this.bedAt(L.x) - 1;
    const [rx] = this.rodTip(L.who);
    if (holding) {
      // reel toward the bank, rising a little
      const tx = this.bankX + 3; const ty = S + 1;
      const dx = tx - L.x; const dy = ty - L.y; const d = Math.hypot(dx, dy);
      const sp = 24 * dt;
      L.x += (dx / d) * sp; L.y += (dy / d) * sp * 0.55;
      // up along the bank instead of into it
      // up along the slope, never into it
      L.y = clamp(L.y, S + 1, this.bedAt(L.x) - 1);
      if (d < 3 || (L.x <= this.bankX + 6 && L.y <= S + 3)) { L.state = 'idle'; this.pop('Reeled in', rx + 10, S - 8, '#ffffff'); return; }
    } else if (L.y < bed) {
      L.y = Math.min(bed, L.y + BAIT[L.bait].sink * dt);
    }
    // snags: each weed or log gets one chance per cast
    for (const w of this.weeds) {
      if (L.tried.has(w)) continue;
      if (Math.abs(L.x - w.x) < w.w / 2 && L.y > this.bedAt(w.x) - w.h) { L.tried.add(w); if (this.r() < SNAG.weed) return this.snag(L, w, 'weeds'); }
    }
    for (const g of this.logs) {
      if (L.tried.has(g)) continue;
      if (L.x > g.x - 1 && L.x < g.x + g.len + 1 && L.y > g.y - 2) { L.tried.add(g); if (this.r() < SNAG.log) return this.snag(L, g, 'a log'); }
    }
    // fish notice it
    for (const f of this.fish) {
      if (f.state !== 'swim' && f.state !== 'interest') continue;
      if (f.line && f.line !== L) continue;
      const d = Math.hypot(f.x - L.x, f.y - L.y);
      const like = this.today[L.bait][f.likeKey] ?? 0;
      if (f.state === 'swim' && d < SPECIES[f.kind === 'special' ? this.spot.special.as : f.kind].reach && this.t >= f.checkAt && !(f.waryUntil > this.t)) {
        f.checkAt = this.t + 0.5;
        if (like < 0) { const sc = f.school; for (const o of this.fish) if (o.school === sc && o.move === 'school') this.spook(o); if (sc) sc.gone = true; this.pop('Eek! A spoon!', f.x, f.y - 6, '#ff8787'); continue; }
        if (like >= pickiness(f.size) && this.r() < like * 0.3 * (1 - 0.5 * f.size)) { f.state = 'interest'; f.line = L; f.since = this.t; this.pop('?', f.x, f.y - 5, '#ffffff'); }
      } else if (f.state === 'interest') {
        if (this.t - f.since > 8) { f.state = 'swim'; f.line = null; continue; }
        // sometimes they just take it
        if (d < 8 + f.len / 2 && this.r() < like * 0.05 * (1 - 0.6 * f.size) * biteScale(f.size) * dt) { this.hook(L, f); return; }
      }
    }
  }

  snag(L, thing, what) {
    L.state = 'snag'; L.snagged = thing; L.tug = 0;
    for (const f of this.fish) if (f.line === L) { f.state = 'swim'; f.line = null; }
    this.pop(`Snagged on ${what}!`, L.x, L.y - 6, '#ffa94d', true);
  }

  // Hold to reel: the line gets tighter. Fish make runs; let go before it snaps.
  stepFight(L, dt, holding) {
    const f = L.fish;
    const S = this.surface;
    const running = this.t >= f.runAt && this.t < f.runAt + 1.2;
    if (this.t > f.runAt + 1.2) f.runAt = this.t + 1.5 + this.r() * 3;
    const pull = f.pull * (0.5 + f.size) * (running ? 1.8 : 1) * Math.min(1, 0.4 + f.stamina);
    if (holding) {
      const strong = 1 - 0.12 * ((L === this.lines.vis ? this.visTier : this.rodTier) - 1);
      L.tension += (pull * 0.9 * strong - 0.15) * dt;
      const sp = Math.max(4, 22 - pull * 14) * dt;
      const tx = this.bankX + 3; const ty = S + 1;
      const dx = tx - L.x; const dy = ty - L.y; const d = Math.hypot(dx, dy);
      L.x += (dx / d) * sp; L.y += (dy / d) * sp * 0.6;
      // up along the slope, never into it
      L.y = clamp(L.y, S + 1, this.bedAt(L.x) - 1);
      f.stamina = Math.max(0, f.stamina - dt * (0.25 + L.tension * 0.3));
    } else {
      L.tension -= 0.6 * dt;
      // the fish swims off with it
      L.x = Math.min(this.W - 6, L.x + pull * 10 * dt); L.y = Math.min(this.bedAt(L.x) - 2, L.y + pull * 3 * dt);
      f.stamina = Math.max(0, f.stamina - dt * 0.05);
    }
    L.tension = clamp(L.tension, 0, 1.05);
    // left alone, it swims off to the far side and slips the hook
    L.slack = !holding && L.x >= this.W - 8 ? (L.slack || 0) + dt : 0;
    if (L.slack > 2) { this.pop('It got away!', L.x - 10, L.y - 6, '#ff8787', true); this.spook(f); L.state = 'idle'; L.fish = null; return; }
    // the hook is in its mouth: nose on the bait, body trailing away from the shore
    f.x = L.x + f.pic.width / 2 - 1; f.y = L.y + 1; f.dir = -1; f.face = -1;
    if (L.tension >= 1) { this.pop('Snap! It got away', L.x, L.y - 6, '#ff8787', true); this.spook(f); L.state = 'idle'; L.fish = null; return; }
    if (L.x <= this.bankX + 6 && L.y <= S + 4) this.land(L, f);
  }

  land(L, f) {
    L.state = 'idle'; L.fish = null; f.gone = true;
    const c = { who: L.who === this.kid ? 'kid' : 'vis', name: f.name, inches: f.inches, kind: f.likeKey, pic: f.pic, at: this.t, points: pointsFor(f.kind, f.size), rare: f.kind === 'special' };
    this.points[c.who] += c.points;
    this.catches.push(c);
    if (c.who === 'kid') { this.showCatch = c; this.sound = 'goal'; }
    this.pop(c.who === 'kid' ? `+${c.points}` : `${this.vis.name}: ${f.name} +${c.points}`, c.who === 'kid' ? L.who.x + 10 : this.W / 2, this.surface - 30, '#b2f2bb', true);
    L.who.brain.set({ ...HAPPY, valence: 1, arousal: 0.8 });
  }

  splash(x) { this.splashes = (this.splashes || []).concat({ x, at: this.t }); }

  pop(text, x, y, color = '#ffffff', big = false) { this.pops.push({ text, x, y, color, big, at: this.t }); }

  // ---------- the visitor fishes too ----------
  stepAI(dt) {
    const L = this.lines.vis;
    if (L.state === 'idle' && this.t > this.ai.next && this.left > 3) { L.bait = BAITS[Math.floor(this.r() * 3)]; this.startCast(L); this.ai.release = this.t + 0.4 + this.r() * 1.2; }
    if (L.state === 'aim' && this.t >= this.ai.release) { this.cast(L); this.ai.reelAt = this.t + 2 + this.r() * 3; }
    let holding = false;
    if (L.state === 'water') {
      if (this.t > this.ai.reelAt) { holding = true; if (this.t > this.ai.reelAt + 0.6 + this.r() * 0.2) this.ai.reelAt = this.t + 1 + this.r() * 2; }
      if (this.r() < dt * 0.4) this.twitch(L);
    }
    if (L.state === 'snag') holding = true;
    if (L.state === 'fight') holding = L.tension < 0.75;
    this.stepLine(L, dt, holding);
    if (L.state === 'idle' && this.ai.wasOut) this.ai.next = this.t + 3 + this.r() * 4;
    this.ai.wasOut = L.state !== 'idle';
  }

  // ---------- input ----------
  onButton(x, y) { const b = this.button; return Math.hypot(x - b.x, y - b.y) <= b.r + 2; }

  /** Tap a bait chip to switch bait (only with the line in). */
  tapBait(x, y) {
    const i = this.chips().findIndex((c) => x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h);
    if (i < 0) return false;
    if (this.lines.kid.state === 'idle') this.bait = BAITS[i];
    return true;
  }

  chips() {
    const w = 14; const gap = 2; const x0 = Math.round(this.W / 2 - (3 * w + 2 * gap) / 2);
    return BAITS.map((b, i) => ({ bait: b, x: x0 + i * (w + gap), y: 3, w, h: 12 }));
  }

  tap(x, y) {
    const L = this.lines.kid;
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.restart(); return; }
    if (this.phase === 'ready') {
      if (this.locked) return;
      if (this.tapBait(x, y)) return;
      this.phase = 'play'; // the first tap starts the clock (and casts)
    }
    if (this.tapBait(x, y)) return;
    if (this.left <= 0 && (L.state === 'idle' || L.state === 'aim')) return;
    // with the line in: CAST, then tap again to let go. With the line out: tap twitches, hold reels (the button too).
    if (L.state === 'idle') { L.bait = this.bait; this.startCast(L); return; }
    if (L.state === 'aim') { this.cast(L); return; }
    if (L.state === 'air') return;
    this.press();
  }

  press() { const L = this.lines.kid; L.held = true; L.downAt = this.t; }

  release() {
    const L = this.lines.kid;
    if (!L.held) return;
    L.held = false;
    if (this.t - L.downAt < HOLD) this.twitch(L);
  }

  // ---------- the clock ----------
  /** Time's up: the session ends once any fish on the kid's line is landed or lost. */
  finish() {
    this.phase = 'over'; this.overAt = this.t;
    for (const L of Object.values(this.lines)) { if (L.fish) this.spook(L.fish); L.state = 'idle'; L.fish = null; L.held = false; }
    this.newBest = this.points.kid > this.best;
    if (this.newBest) this.best = this.points.kid;
    this.showCatch = null;
  }

  restart() {
    this.phase = 'ready'; this.left = GAME_SECONDS; this.overtime = 0; this.points = { kid: 0, vis: 0 }; this.catches = []; this.newBest = false;
    this.ai.next = this.t + 2;
  }

  step(dt) {
    this.t += dt;
    if (this.phase !== 'play') { this.stepFish(dt); for (const p of [this.kid, this.vis]) p.move(dt); this.pops = this.pops.filter((p) => this.t - p.at < 1.4); return; }
    this.left = Math.max(0, this.left - dt);
    const L = this.lines.kid;
    // time's up: a fish on the line still gets landed (or lost), up to 15 s more
    if (this.left <= 0 && (L.state !== 'fight' || (this.overtime = (this.overtime || 0) + dt) > 15)) { this.finish(); return; }
    const holding = L.held && this.t - L.downAt >= HOLD;
    this.stepLine(L, dt, holding);
    this.stepAI(dt);
    this.stepFish(dt);
    for (const p of [this.kid, this.vis]) p.move(dt);
    this.pops = this.pops.filter((p) => this.t - p.at < 1.4);
    if (this.showCatch && this.t - this.showCatch.at > 2.6) this.showCatch = null;
  }

  // ---------- drawing ----------
  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.field, 0, 0);
    // fish
    for (const f of this.fish) {
      const x = Math.round(f.x - f.pic.width / 2); const y = Math.round(f.y - f.pic.height / 2);
      ctx.save();
      if ((f.face ?? f.dir) > 0) { ctx.translate(Math.round(f.x) * 2, 0); ctx.scale(-1, 1); }
      ctx.drawImage(f.pic, x, y);
      ctx.restore();
    }
    this.drawWeeds(ctx);
    this.drawTop(ctx);
    // splashes
    for (const s of this.splashes || []) {
      const a = (this.t - s.at) / 0.5; if (a > 1) continue;
      ctx.fillStyle = '#ffffff';
      const h = Math.round(4 * (1 - a));
      ctx.fillRect(Math.round(s.x) - 3 - Math.round(a * 3), this.surface - h, 1, h); ctx.fillRect(Math.round(s.x) + 3 + Math.round(a * 3), this.surface - h, 1, h);
      ctx.fillRect(Math.round(s.x), this.surface - h - 2, 1, 2);
    }
    // buddies
    for (const p of [this.vis, this.kid]) { p.paint(this.t); p.draw(ctx); }
    // lines and bait
    for (const L of [this.lines.vis, this.lines.kid]) this.drawLine(ctx, L);
  }

  drawLine(ctx, L) {
    if (L.state === 'idle' || L.state === 'aim') {
      const [rx, ry] = this.rodTip(L.who);
      ctx.fillStyle = '#f8f9fa'; ctx.fillRect(rx, ry, 1, 4);
      ctx.drawImage(this.baitPics[L === this.lines.kid ? this.bait : L.bait], rx - 3, ry + 3);
      return;
    }
    const [rx, ry] = this.rodTip(L.who);
    const bx = Math.round(L.x); const by = Math.round(L.y);
    const tight = L.state === 'fight' || (L === this.lines.kid && L.held);
    const sag = tight ? 0 : L.state === 'air' ? 0 : 6;
    ctx.fillStyle = L === this.lines.kid ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.55)';
    const n = Math.max(8, Math.round(Math.hypot(bx - rx, by - ry)));
    for (let i = 0; i <= n; i += 1) {
      const k = i / n;
      const lx = rx + (bx - rx) * k; let ly = ry + (by - ry) * k + Math.sin(Math.PI * k) * sag;
      if (ly > this.surface && L.state !== 'air' && lx < bx - 0) ly = Math.max(ly, this.surface);
      ctx.fillRect(Math.round(lx), Math.round(ly), 1, 1);
    }
    if (L.state !== 'fight') ctx.drawImage(this.baitPics[L.bait], bx - 3, by - 3);
    if (L.state === 'snag' && Math.floor(this.t * 4) % 2) { ctx.fillStyle = '#ffa94d'; ctx.fillRect(bx - 1, by - 6, 1, 2); ctx.fillRect(bx + 2, by - 6, 1, 2); }
  }

  drawHud(ctx, scale) {
    const S = scale; const W = this.W * S;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff') => {
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = '#1b1430';
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
    };
    const u = S * 4;
    const L = this.lines.kid;
    // bait chips
    const out = L.state !== 'idle';
    for (const c of this.chips()) {
      const on = c.bait === this.bait;
      ctx.fillStyle = on ? '#ffd43b' : out ? 'rgba(73,80,87,0.6)' : 'rgba(255,255,255,0.85)';
      ctx.fillRect(c.x * S, c.y * S, c.w * S, c.h * S);
      ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(c.x * S, c.y * S, c.w * S, c.h * S);
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.baitPics[c.bait], (c.x + 4) * S, (c.y + 1) * S, 6 * S, 6 * S);
      text(BAIT[c.bait].name, (c.x + c.w / 2) * S, (c.y + 9.5) * S, u * 0.75, on ? '#1b1430' : '#ffffff');
    }
    // clock
    const secs = Math.ceil(this.left);
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, (this.chips()[0].y + 16) * S, u * 1.3, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#e9ecef');
    // points
    const ch0 = this.chips()[0]; const ch2 = this.chips()[2];
    ctx.textAlign = 'right'; text(`${this.kid.name} ${this.points.kid}`, (ch0.x - 3) * S, (ch0.y + 6) * S, u * 1.5, '#ffd43b');
    ctx.textAlign = 'left'; text(`${this.vis.name} ${this.points.vis}`, (ch2.x + ch2.w + 3) * S, (ch2.y + 6) * S, u * 1.5, '#ffffff');
    ctx.textAlign = 'center';
    // the spot's name
    ctx.textAlign = 'right'; text(this.spot.name, W - u * 1.2, (this.surface - 4) * S, u * 1.2, '#ffffff'); ctx.textAlign = 'center';

    // cast button
    const bt = this.button; const bx = bt.x * S; const by = bt.y * S; const br = bt.r * S;
    const label = L.state === 'idle' ? 'CAST' : L.state === 'aim' ? 'CAST!' : L.state === 'snag' ? 'YANK' : 'REEL';
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = L.state === 'aim' ? '#e8590c' : L.state === 'idle' ? '#fd7e14' : (L.held ? '#1c7ed6' : 'rgba(28,126,214,0.55)'); ctx.fill();
    ctx.lineWidth = S; ctx.strokeStyle = '#1b1430'; ctx.stroke();
    text(label, bx, by, u * 1.25, '#ffffff');
    if (L.state === 'water' || L.state === 'fight') text('tap: twitch · hold: reel', bx - br - u * 0.5, by + br - u * 0.6, u * 0.8, '#ffffff');

    // cast meter: red short, yellow medium, green far
    if (L.state === 'aim') {
      const m = this.meter(L);
      const mx = (this.bankX + 4) * S; const my = (this.surface - 22) * S; const mw = u * 18; const mh = u * 1.6;
      const steps = 100;
      for (let i = 0; i < steps; i += 1) { ctx.fillStyle = ZONE_COLORS[this.zoneOf((i + 0.5) / steps)]; ctx.fillRect(mx + (i * mw) / steps, my, mw / steps + 0.5, mh); }
      ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + m * mw - S * 0.6, my - S, S * 1.2, mh + 2 * S);
      ctx.textAlign = 'left'; text('short', mx + u * 0.3, my + mh + u * 0.8, u * 0.8); ctx.textAlign = 'right'; text('far', mx + mw - u * 0.3, my + mh + u * 0.8, u * 0.8); ctx.textAlign = 'center';
    }
    // line tension while a fish is on
    if (L.state === 'fight') {
      const mx = bx - br * 0.5; const my = by - br - u * 9; const mw = br; const mh = u * 7;
      ctx.fillStyle = 'rgba(27,20,48,0.7)'; ctx.fillRect(mx, my, mw, mh);
      const k = clamp(L.tension, 0, 1);
      ctx.fillStyle = k > 0.8 ? '#fa5252' : k > 0.55 ? '#fcc419' : '#40c057';
      ctx.fillRect(mx + S, my + mh - k * (mh - 2 * S) - S, mw - 2 * S, k * (mh - 2 * S));
      ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
      text('line', mx + mw / 2, my - u * 0.6, u * 0.8);
      if (k > 0.8 && Math.floor(this.t * 6) % 2) text('Let go!', W / 2, (this.surface + 8) * S, u * 2, '#ff8787');
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.4;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x, 20, this.W - 20) * S, (p.y - age * 8) * S, u * (p.big ? 2 : 1.4), p.color);
      ctx.globalAlpha = 1;
    }
    // a catch: the fish up close
    const c = this.showCatch;
    if (c) {
      const cw = u * 26; const ch = u * 13; const cx = W / 2 - cw / 2; const cy = (this.surface + 6) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.88)'; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(cx, cy, cw, ch);
      const z = Math.max(1, Math.floor((cw * 0.6) / c.pic.width));
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(c.pic, W / 2 - (c.pic.width * z) / 2, cy + u * 1.2, c.pic.width * z, c.pic.height * z);
      text(`${c.who === 'kid' ? this.kid.name : this.vis.name} caught a ${c.name}!`, W / 2, cy + ch - u * 3.2, u * 1.6, '#ffd43b');
      text(`${c.inches} inches · +${c.points} points${c.rare ? ' · RARE!' : ''}`, W / 2, cy + ch - u * 1.3, u * 1.3, c.rare ? '#ffd43b' : '#ffffff');
    }
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Pick a bait, then tap CAST!', W / 2, (this.surface + 10) * S, u * 1.8);
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.surface + 22) * S;
      const bw = Math.min(W * 0.84, u * 34); const bh = u * 11;
      ctx.fillStyle = 'rgba(27,20,48,0.88)'; ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      const mine = this.catches.filter((c) => c.who === 'kid');
      text(`Time's up! ${this.points.kid} points`, W / 2, cy - u * 3.2, u * 2.4, '#ffd43b');
      text(`${mine.length} ${mine.length === 1 ? 'fish' : 'fish'} · ${this.vis.name} got ${this.points.vis}`, W / 2, cy - u * 0.7, u * 1.4, '#e9ecef');
      text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, cy + u * 1.5, u * 1.6, this.newBest ? '#b2f2bb' : '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to fish again', W / 2, cy + u * 3.7, u * 1.3, '#ffffff');
    }
  }
}
