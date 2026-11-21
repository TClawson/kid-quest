// Treasure hill: the sled game. The kid's buddy and the visitor sled down the kid's map's hill
// (slopes.js), grabbing finds (finds.js) poking out of the snow, sand or mud, and floating over
// the bumps and jumps. Everything found goes in the finds book in the buddy's house.
//
// One button: press anywhere to jump, hold for a higher jump. A run has three parts: a gentle
// top, a middle full of ramps (a ramp can lift you onto the high line, a ledge with better finds
// and more in the way), and a steep finish with the Big Jump: the run's best find floats at the
// top of it, and a timing meter on the way down picks the landing (green: a perfect find).
// Hitting something in the way tumbles you, and your last find bounces out ahead to grab again.
//
// Every hill has its own twist (TWISTS): leaf piles to burst, moats to clear, dunes to pump,
// bubbles to ride, steam vents, vines, a glacier that keeps speeding up, moon craters,
// gumdrop trampolines and shooting stars.
//
// A better sled sees more of the hill (it zooms out, like a better fishing rod), a good sled
// pulls finds in from farther and shrugs off the first bump each run, and a super sled can
// jump again in the air, up to the top line. Better sleds find rare things more often.
//
// The game keeps its own clock (step) and draws whole pixels (draw); words go on the sharp HUD
// canvas (drawHud), like the other visitor games.
import { Player, playLook, rng, clamp } from './play.js';
import { CALM } from './rig.js';
import { addPop, needle, zoneAt, drawMeter } from './meter.js';
import { hillFor, hillSpeed, snowOfDay, snowWords, makeGround, SURFACES, hash } from './slopes.js';
import {
  findByKey, findOdds, pickFind, conditionFor, findPoints, sizeFor, sizeClass, findOfDay,
  CONDITIONS, SIZE_CLASSES, RARITY, PITY, fmtSize,
} from './finds.js';
import { findCells } from './findart.js';
import { seasonOf } from './seasons.js';

const HAPPY = { ...CALM, valence: 0.7, arousal: 0.6 };
const INK = '#1b1430';
const FEET = 7 + 16; // SPRITE_Y + 16, as in play.js

export const RUN_LEN = 7400; // pixels of hill from the top to the finish
export const ACT2 = 1300; // the ramps start
export const ACT3 = 5900; // the steep finish
export const BIG_AT = 6800; // the Big Jump's ramp
export const BASE_SPEED = 95; // pixels a second at the top of a normal hill
// Momentum, like a real sled (Taylor, 2026-11-21): the longer you ride without crashing, the
// faster you go (up to BUILD_GAIN more after BUILD_LEN of clean hill), steep bits speed you up and
// rises slow you down, a crash loses most of it, and you never drop below MIN_SPEED.
export const BUILD_LEN = 2000;
export const BUILD_GAIN = 1.2;
export const MIN_SPEED = 60;
export const MAX_SPEED = 260;
const SLOPE_PULL = 260; // extra push per unit of slope steeper than the hill's usual drop
const AVG_DROP = 0.15; // the hill's usual drop (makeGround's drop)
export const GRAVITY = 380;
export const JUMP_V = 118;
const HOLD_T = 0.3; // holding the button keeps a jump rising for up to this long
const HOLD_G = 0.42; // gravity while it does
export const SLED_ZOOM = [1, 1.15, 1.3]; // a better sled sees more of the hill
export const MAGNET = [6, 11, 11]; // how close a find has to be to grab it (a good sled pulls them in)
export const TUMBLE = 1.1; // seconds
const SPEED_CAP = [0.8, 1.3]; // the hill's speed x the snow kind stays in here
const LEDGE_LIFT = 30; // the high line, above the ground
const TOP_LIFT = 62; // the top line (super sled's double jump)
const STREAK_FINE = 3;

const tierOf = (gear) => clamp(gear?.sled || 1, 1, 3);
const lerp = (a, b, k) => a + (b - a) * k;

/** Which twist a hill has (by map id). */
export const TWISTS = {
  'bg-meadow': 'piles', 'bg-castle': 'moats', 'bg-sunset': 'dunes', 'bg-ocean': 'bubbles', 'bg-volcano': 'vents',
  'bg-rainforest': 'vines', 'bg-fjord': 'glide', 'bg-space': 'craters', 'bg-rainbow': 'gumdrops', 'bg-galaxy': 'stars',
};
/** What the hill's twist says at the start. */
export const TWIST_TIPS = {
  piles: 'Ride through the piles: something is hiding inside!',
  moats: 'Jump the moats, and look for treasure up on the walls!',
  dunes: 'Land going downhill for a whoosh of speed!',
  bubbles: 'Hold the button in a bubble stream to float up!',
  vents: 'Ride over a steam vent as it puffs for a giant launch!',
  vines: 'Jump into a vine to swing over the gully!',
  glide: 'The glacier gets faster and faster. Watch for cracks!',
  craters: 'Moon jumps are floaty. Little taps go a long way!',
  gumdrops: 'Bounce on the gumdrops! Keep bouncing for a streak!',
  stars: 'Catch the shooting stars while you are in the air!',
};

/**
 * opts: { W, H, kid, visitor: { buddy, name, gear }, best, seed, map: background id, day,
 *   season (default: the day's), dry: runs on this hill since the last super rare,
 *   onFind({ key, q, inches, map }): the kid found something; answers 'new', 'better', 'bigger' or null,
 *   onRun({ superRare }): a run ended }
 */
export class Sledding {
  constructor(opts) {
    this.kind = 'sledding';
    this.opts = opts;
    this.onFind = opts.onFind || null;
    this.onRun = opts.onRun || null;
    this.map = opts.map;
    this.day = opts.day || '2026-01-01';
    this.season = opts.season || seasonOf(this.day);
    this.hill = hillFor(opts.map, this.season);
    this.snow = snowOfDay(this.day);
    this.words = snowWords(this.snow, this.hill.surface);
    this.twist = TWISTS[this.hill.id];
    this.today = findOfDay(this.hill.id, this.day);
    this.tier = tierOf(opts.kid.gear);
    this.speed = clamp(hillSpeed(this.hill, this.snow), ...SPEED_CAP);
    this.grav = GRAVITY * this.hill.gravity;
    this.dry = opts.dry || 0;
    this.Z = 1;
    this.vW = opts.W; this.vH = opts.H;
    this.zoom = SLED_ZOOM[this.tier - 1];
    this.fieldW = Math.round(this.vW * this.zoom); this.fieldH = Math.round(this.vH * this.zoom);
    this.W = this.fieldW; this.H = this.fieldH;
    this.t = 0; this.pops = []; this.best = opts.best || 0;
    this.holdAnywhere = true; this.locked = false;
    this.seed0 = opts.seed || 1;
    const sled = (b) => ({ ...playLook(b, {}, 'sledding') });
    this.kidP = new Player(sled(opts.kid.buddy), opts.kid.name, 11, 0, 0);
    this.visP = new Player(sled(opts.visitor.buddy), opts.visitor.name, 23, 0, 0);
    this.kid = this.kidP; this.vis = this.visP; // names, like the other games
    for (const p of [this.kidP, this.visP]) { p.face = 1; p.brain.set(HAPPY); }
    this.visTier = tierOf(opts.visitor.gear);
    this.reset();
  }

  /** A fresh run: a new hill layout, everyone back at the top. */
  reset() {
    this.phase = 'ready';
    this.runs = (this.runs || 0) + 1;
    this.r = rng(hash(`${this.seed0}:${this.runs}`));
    this.points = { kid: 0, vis: 0 };
    this.newBest = false; this.overAt = 0;
    this.haul = []; this.records = 0;
    this.streak = 0; this.bestStreak = 0;
    this.superRare = false;
    this.layout();
    this.rider = this.newRider(30);
    this.trail = [];
    this.visPos = { x: 0, y: this.groundAt(0), air: false, tumble: 0 };
    this.camX = 0; this.camY = this.groundAt(30) - this.fieldH * 0.58;
    this.showFind = null; this.big = null; this.meter = null;
    this.stars = []; this.nextStar = 3;
    this.looked = new Set();
    this.loose = null;
    this.done = false;
  }

  newRider(x) {
    return { x, y: this.groundAt(x), vy: 0, v: 0, build: 0, on: 'g', jumps: 0, holdT: 0, held: false, tumble: 0, spin: 0, guard: this.tier >= 2, airT: 0, swing: null, highFived: false };
  }

  get score() { return this.points.kid; }

  // ---------- the hill ----------
  layout() {
    const r = this.r;
    const tw = this.twist;
    this.base = makeGround(`${this.seed0}:${this.runs}`, { ramps: 0, drop: 0.15, bump: tw === 'dunes' ? 18 : tw === 'glide' ? 5 : 9, length: RUN_LEN + 400 });
    this.ramps = []; this.ledges = []; this.gaps = []; this.hazards = []; this.finds = [];
    this.piles = []; this.vents = []; this.bubbles = []; this.vines = []; this.craters = []; this.puddles = [];
    const free = (x0, x1) => ![...this.ramps.map((p) => [p.x - 10, p.x + p.w + 30]), ...this.gaps.map((g) => [g.x0 - 30, g.x1 + 24]), ...this.craters.map((c) => [c.x - c.w / 2 - 10, c.x + c.w / 2 + 10]), ...this.vents.map((v) => [v.x - 14, v.x + 14]), ...this.ledges.map((l) => [l.x0 - 20, l.x1 + 10])]
      .some(([a, b]) => x1 > a && x0 < b);
    // act 1: one small ramp, a few finds and bumps
    this.ramps.push({ x: 420, w: 26, h: 8, kick: 50 });
    // act 2: ramps, some to the high line, every 240-380 px
    for (let x = ACT2 + 60; x < ACT3 - 300; x += 240 + r() * 140) {
      const ramp = { x: Math.round(x), w: 28 + Math.round(r() * 10), h: 10 + Math.round(r() * 6), kick: 80 + r() * 30 };
      this.ramps.push(ramp);
      if (r() < 0.6) {
        const x0 = ramp.x + ramp.w + 22 + Math.round(r() * 12); const len = 130 + Math.round(r() * 90);
        const ledge = { x0, x1: x0 + len, lift: LEDGE_LIFT, level: 1 };
        this.ledges.push(ledge);
        if (r() < 0.45) this.ledges.push({ x0: x0 + 30, x1: x0 + 30 + Math.min(len - 40, 90 + Math.round(r() * 40)), lift: TOP_LIFT, level: 2 });
        x += len * 0.6;
      }
    }
    // the Big Jump
    this.bigRamp = { x: BIG_AT, w: 48, h: 22, kick: 200, big: true };
    this.ramps.push(this.bigRamp);
    // the hill's twist
    const twistAt = (fn, every, from = ACT2, to = ACT3 + 300) => {
      for (let x = from + 100 + r() * every; x < to; x += every * (0.7 + r() * 0.6)) { const xx = Math.round(x); if (free(xx - 30, xx + 30)) fn(xx); }
    };
    if (tw === 'piles') twistAt((x) => this.piles.push({ x, burst: false }), 220, 300);
    if (tw === 'moats') twistAt((x) => this.gaps.push({ x0: x, x1: x + 26 + Math.round(r() * 10), kind: 'moat' }), 420);
    if (tw === 'vents') twistAt((x) => this.vents.push({ x, ph: r() * 2.4 }), 300);
    if (tw === 'bubbles') twistAt((x) => this.bubbles.push({ x, w: 22 }), 260);
    if (tw === 'vines') {
      twistAt((x) => { const w = 54; this.gaps.push({ x0: x, x1: x + w, kind: 'gully' }); this.vines.push({ x: x + w / 2, gap: this.gaps[this.gaps.length - 1] }); }, 520);
      twistAt((x) => this.puddles.push({ x0: x, x1: x + 24 }), 380, 200);
    }
    if (tw === 'glide') twistAt((x) => this.gaps.push({ x0: x, x1: x + Math.round(16 + 22 * (x / RUN_LEN)), kind: 'crevasse' }), 380);
    if (tw === 'craters') twistAt((x) => this.craters.push({ x, w: 64, d: 13 }), 300, 300);
    if (tw === 'gumdrops') twistAt((x) => this.hazards.push({ x, w: 10, h: 7, type: 'gumdrop', bounce: true, surf: null }), 170, 300);
    // things in the way: on the ground, more in the middle, some on the high line
    const types = this.hill.hazards;
    for (let x = 260; x < BIG_AT - 60; x += (x < ACT2 ? 260 : 130) + r() * 110) {
      const xx = Math.round(x);
      if (!free(xx - 12, xx + 12) || this.puddles.some((p) => xx > p.x0 - 10 && xx < p.x1 + 10)) continue;
      const type = types[Math.floor(r() * types.length)];
      this.hazards.push({ x: xx, w: 9, h: type === 'log' || type === 'driftwood' || type === 'root' ? 5 : 7, type, surf: null, vx: type === 'crab' ? -10 : 0 });
    }
    for (const l of this.ledges) {
      const n = l.level === 2 ? 0 : (l.x1 - l.x0 > 170 ? 2 : 1);
      for (let i = 0; i < n; i += 1) {
        const x = Math.round(lerp(l.x0 + 40, l.x1 - 30, (i + 0.5) / n));
        this.hazards.push({ x, w: 9, h: 7, type: types[Math.floor(r() * types.length)], surf: l, vx: 0 });
      }
    }
    // finds: little rows along the ground, arcs over the ramps, more up high
    const addFind = (x, h, surf = null, opts = {}) => this.finds.push({ x, h, surf, key: null, got: false, buried: false, ...opts });
    for (let x = 140; x < BIG_AT - 40; x += 110 + r() * 90) {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i += 1) {
        const fx = Math.round(x + i * 16);
        if (this.gaps.some((g) => fx > g.x0 - 6 && fx < g.x1 + 6)) continue;
        // powder hides some finds under the snow: just a glint to ride over
        const buried = this.snow === 'powder' && r() < 0.35;
        addFind(fx, buried ? 0 : r() < 0.35 ? 16 + Math.round(r() * 14) : 4, null, { buried });
      }
    }
    for (const p of this.ramps) {
      if (p.big) continue;
      // an arc of finds over the landing
      const x0 = p.x + p.w + 8;
      for (let i = 0; i < 3; i += 1) addFind(x0 + i * 14, 26 + Math.round(Math.sin((i / 2) * Math.PI) * 10));
    }
    for (const l of this.ledges) {
      for (let x = l.x0 + 18; x < l.x1 - 8; x += 26 + r() * 18) addFind(Math.round(x), l.level === 2 ? 4 : r() < 0.5 ? 4 : 16, l, { high: true, rich: true });
    }
    // a mystery sack every run or two: you only learn what's in it when you grab it
    if (r() < 0.6) { const m = this.finds.filter((f) => !f.surf && !f.buried)[Math.floor(r() * 10) + 6]; if (m) { m.mystery = true; m.rich = true; } }
    // what each find is, decided now so it can be seen coming (the mystery sack is decided on the grab)
    for (const f of this.finds) if (!f.mystery) f.key = this.pickKey(f.rich);
    // hazards and finds don't sit on top of each other
    this.finds = this.finds.filter((f) => !this.hazards.some((z) => z.surf === f.surf && Math.abs(z.x - f.x) < 9 && f.h < 12));
  }

  /** A find for this hill today (rich spots: a better chance of a rare one). */
  pickKey(rich) {
    return pickFind(findOdds(this.hill.id, this.snow, this.season, this.tier, { day: this.day, rareOnly: rich && this.r() < 0.4 }), this.r());
  }

  /** The height of the ground (bigger is lower) at x, with the ramps and craters. Gaps are not cut out here. */
  groundAt(x) {
    let y = this.base.at(x);
    if (x > ACT3) y += (x - ACT3) * 0.12 * Math.min(1, (x - ACT3) / 300); // the steep finish
    for (const p of this.ramps) {
      if (x < p.x) break;
      if (x <= p.x + p.w) { const k = (x - p.x) / p.w; y -= p.h * k * k; break; }
    }
    for (const c of this.craters) {
      const d = Math.abs(x - c.x) / (c.w / 2);
      if (d < 1) y += c.d * Math.cos(d * Math.PI / 2) ** 2 - (d > 0.75 ? (d - 0.75) * 16 : 0);
    }
    return y;
  }

  gapAt(x) { return this.gaps.find((g) => x >= g.x0 && x <= g.x1) || null; }

  /** The y of a surface ('g' for the ground, or a ledge) at x, or null if it isn't there. */
  surfY(on, x) {
    if (on === 'g') return this.gapAt(x) ? null : this.groundAt(x);
    if (!on || x < on.x0 || x > on.x1) return null;
    return this.groundAt(x) - on.lift;
  }

  /** Where a thing on a surface is: the surface's y at x, minus its height. */
  thingY(surf, x, h) { return (surf ? this.groundAt(x) - surf.lift : this.groundAt(x)) - h; }

  // ---------- input ----------
  tap() {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.reset(); return; }
    if (this.phase === 'ready') {
      if (this.locked) return;
      this.phase = 'play';
    }
    const R = this.rider;
    R.held = true; R.holdT = 0;
    if (this.meter && !this.meter.zone) { this.meter.zone = zoneAt(needle(this.t - this.meter.at, 0.55), 0.12, 0.3); this.meter.m = needle(this.t - this.meter.at, 0.55); return; }
    this.jump(R);
  }

  release() { this.rider.held = false; }
  drag() {}
  press() {}

  jump(R) {
    if (R.tumble > 0 || R.swing) return;
    // on a ramp: the press is saved for the lip (hold it over the lip for big air)
    if (R.on === 'g' && this.onRamp(R.x)) return;
    if (R.on) { R.on = null; R.vy = -JUMP_V; R.jumps = 1; R.airT = 0; R.highFived = false; this.sound = 'board'; return; }
    if (this.tier >= 3 && R.jumps < 2) { R.vy = -JUMP_V * 0.95; R.jumps = 2; R.holdT = 0; this.sound = 'board'; this.pop('Double jump!', R.x, R.y - 30, '#a5d8ff'); }
  }

  /** The ramp under x, if any. */
  onRamp(x) { return this.ramps.find((p) => x >= p.x - 14 && x <= p.x + p.w) || null; }

  // ---------- the run ----------
  step(dt) {
    dt = Math.min(dt, 0.05);
    this.t += dt;
    this.pops = this.pops.filter((p) => this.t - p.at < 1.4);
    if (this.showFind && this.t - this.showFind.at > 2.2) this.showFind = null;
    for (const p of [this.kidP, this.visP]) p.run = 0;
    if (this.phase !== 'play') { this.follow(dt, true); return; }
    const R = this.rider;
    this.stepRider(R, dt);
    this.stepThings(dt);
    this.grab(R);
    this.stepVisitor(dt);
    this.follow(dt);
    if (R.x >= RUN_LEN && !this.done) this.finish();
  }

  /** The speed the rider's momentum carries them toward at x: it grows with clean riding (R.build). */
  targetSpeed(x, build = 0) {
    let v = BASE_SPEED * this.speed * (1 + BUILD_GAIN * clamp(build / BUILD_LEN, 0, 1));
    if (this.twist === 'glide') v *= 1 + 0.3 * clamp(x / RUN_LEN, 0, 1);
    if (x > ACT3) v *= 1.1;
    return v;
  }

  /** Momentum: speed up with clean riding and on steep bits, slow on rises, puddles and crashes. */
  stepSpeed(R, dt) {
    const grip = SNOWGRIP[this.snow] || 1;
    if (R.tumble > 0) { R.v = Math.max(MIN_SPEED * 0.6, R.v - R.v * 2.2 * dt); return; }
    R.build += R.v * dt;
    let a = (this.targetSpeed(R.x, R.build) - R.v) * 0.9 * grip;
    if (R.on === 'g') a += SLOPE_PULL * this.speed * (this.base.slope(R.x) - AVG_DROP);
    if (R.on && this.puddles.some((p) => R.x > p.x0 && R.x < p.x1)) a -= 2.5 * R.v;
    R.v = clamp(R.v + a * dt, MIN_SPEED, MAX_SPEED);
  }

  stepRider(R, dt) {
    if (R.held) R.holdT += dt;
    if (R.tumble > 0) { R.tumble -= dt; R.spin += dt; }
    this.stepSpeed(R, dt);
    // swinging on a vine: carried across the gully
    if (R.swing) {
      const s = R.swing; s.k += dt / 0.9;
      const k = Math.min(1, s.k);
      R.x = lerp(s.x0, s.x1, k);
      R.y = lerp(s.y0, this.groundAt(s.x1), k) - Math.sin(k * Math.PI) * 22;
      if (k >= 1) { R.swing = null; R.on = 'g'; R.y = this.groundAt(R.x); this.bumpStreak('Swing!'); }
      return;
    }
    const x0 = R.x;
    R.x += R.v * dt;
    if (R.on) {
      const y = this.surfY(R.on, R.x);
      // off the end of a ledge, or over a gap: falling
      if (y == null) { R.on = null; R.vy = this.base.slope(R.x) * R.v; R.jumps = Math.max(R.jumps, 1); }
      else {
        R.y = y;
        // over a ramp's lip: up you go
        const lip = this.ramps.find((p) => x0 <= p.x + p.w && R.x > p.x + p.w);
        // holding the button over the lip: big air (high enough for the high line)
        if (lip && R.on === 'g') {
          const big = R.held && !lip.big;
          this.launch(R, lip.kick + (big ? JUMP_V * 0.5 : 0), lip.big);
          if (big) { R.holdT = 0; this.pop('Big air!', R.x, R.y - 30, '#a5d8ff'); this.sound = 'board'; }
        }
        // a crater's far rim launches too
        const rim = this.craters.find((c) => x0 <= c.x + c.w / 2 && R.x > c.x + c.w / 2);
        if (rim && R.on === 'g') this.launch(R, 95);
        // a steam vent puffing right now
        const vent = this.vents.find((v) => Math.abs(v.x - R.x) < 6 && this.puffing(v));
        if (vent && R.on === 'g') { this.launch(R, 240); this.pop('Steam launch!', R.x, R.y - 30, '#ffffff', true); }
      }
    }
    if (!R.on) {
      R.airT += dt;
      const floaty = R.held && R.vy < 0 && R.holdT < HOLD_T ? HOLD_G : 1;
      R.vy += this.grav * floaty * dt;
      // a bubble stream lifts while the button is held
      if (R.held && this.bubbles.some((b) => Math.abs(b.x - R.x) < b.w / 2)) R.vy = Math.max(-90, R.vy - 900 * dt);
      const yPrev = R.y;
      R.y += R.vy * dt;
      // landing: the highest surface we fell onto
      if (R.vy >= 0) {
        const cands = ['g', ...this.ledges].map((on) => ({ on, y: this.surfY(on, R.x) })).filter((c) => c.y != null && yPrev <= c.y + 2 && R.y >= c.y);
        cands.sort((a, b) => a.y - b.y);
        if (cands.length) this.land(R, cands[0]);
      }
      // a vine over a gully: grab it on the way past
      const vine = this.vines.find((v) => Math.abs(v.x - R.x) < 10 && Math.abs(this.groundAt(v.x) - 26 - R.y) < 14);
      // never below the ground (a fast fall can skip past it in one step)
      if (!R.on && !this.gapAt(R.x) && R.y > this.groundAt(R.x) && !this.gaps.some((g) => x0 <= g.x1 + 1 && R.x > g.x1 && yPrev > this.groundAt(R.x) + 6)) this.land(R, { on: 'g', y: this.groundAt(R.x) });
      if (vine && !R.on) { R.swing = { x0: R.x, x1: vine.gap.x1 + 12, y0: R.y, k: 0 }; this.sound = 'catch'; }
      // fell into a gap: climb out the far side (also when the far wall is hit on the way)
      const gap = this.gapAt(R.x) || (!R.on && R.y > this.groundAt(R.x) + 6 ? this.gaps.find((g) => x0 <= g.x1 + 1 && R.x > g.x1) : null);
      if (gap && R.y > this.groundAt(R.x) + (this.gapAt(R.x) ? 16 : 6)) {
        this.pop(gap.kind === 'moat' ? 'Splash!' : gap.kind === 'gully' ? 'Squelch!' : 'Whoops!', R.x, R.y - 20, '#a5d8ff', true);
        this.sound = 'splash';
        R.x = gap.x1 + 6; R.y = this.groundAt(R.x); R.on = 'g'; R.vy = 0;
        this.tumble(R, true);
      }
    }
  }

  launch(R, kick, big = false) {
    R.on = null; R.vy = this.base.slope(R.x) * R.v - kick; R.jumps = 1; R.airT = 0; R.highFived = false;
    if (big) this.startBig(R);
  }

  land(R, c) {
    const slope = this.base.slope(R.x);
    R.on = c.on; R.y = c.y; const fall = R.vy; R.vy = 0; R.jumps = 0;
    // the dunes: landing going downhill whooshes, landing on an upslope slows
    if (this.twist === 'dunes' && fall > 60) {
      if (slope > 0.2) { R.v *= 1.3; this.pop('Whoosh!', R.x, R.y - 24, '#ffe066'); }
      else if (slope < -0.05) R.v *= 0.75;
    }
    if (this.big && !this.big.landed) this.landBig(R);
  }

  puffing(v) { return ((this.t + v.ph) % 2.4) < 0.8; }

  tumble(R, soft = false) {
    if (R.tumble > 0) return;
    // a good sled shrugs off the first bump of the run
    if (!soft && R.guard) { R.guard = false; R.v *= 0.7; R.build *= 0.5; this.pop('Wobble!', R.x, R.y - 26, '#ffe066'); this.buzz = 30; return; }
    R.tumble = TUMBLE; R.spin = 0; R.v *= 0.4; R.build = 0;
    this.sound = 'drop'; this.buzz = 80;
    if (this.streak >= 2) this.pop('Streak over', R.x, R.y - 34, '#ffc9c9');
    this.streak = 0;
    // the last find (from the last 6 seconds) bounces out ahead: grab it again!
    const last = this.haul[this.haul.length - 1];
    if (last && !last.dropped && this.t - last.at < 6 && !this.loose) {
      last.dropped = true; this.points.kid -= last.points;
      this.loose = { find: last, x: R.x + 34, y: R.y - 16, vy: -60, at: this.t };
    }
  }

  bumpStreak(word) {
    this.streak += 1; this.bestStreak = Math.max(this.bestStreak, this.streak);
    if (word) this.pop(`${word} ${this.streak >= 2 ? `x${this.streak}` : ''}`, this.rider.x, this.rider.y - 30, '#d0bfff');
  }

  stepThings(dt) {
    const R = this.rider;
    for (const z of this.hazards) {
      if (z.vx) z.x += z.vx * dt;
      if (z.hit) continue;
      const sy = z.surf ? this.surfY(z.surf, z.x) : this.groundAt(z.x);
      if (sy == null) continue;
      const near = Math.abs(R.x - z.x) < z.w / 2 + 3;
      if (!near || R.tumble > 0 || R.swing) continue;
      const onSame = R.on ? R.on === (z.surf || 'g') : true;
      if (!onSame || R.y < sy - z.h) continue;
      if (z.bounce) {
        if (R.vy >= 0) { R.on = null; R.vy = -175 * Math.sqrt(this.hill.gravity); R.jumps = 1; z.squish = this.t; this.sound = 'plop'; this.bumpStreak('Boing!'); }
        continue;
      }
      z.hit = true;
      this.tumble(R);
    }
    // leaf piles: ride through one and it bursts with a find
    for (const p of this.piles) {
      if (p.burst || Math.abs(R.x - p.x) > 7 || R.y < this.groundAt(p.x) - 8) continue;
      p.burst = this.t;
      this.finds.push({ x: p.x + 26, h: 22, surf: null, key: this.pickKey(true), got: false, rich: true, pop: this.t });
      this.pop('Poof!', p.x, this.groundAt(p.x) - 18, '#ffe066');
      this.sound = 'plop';
    }
    // shooting stars fall across the sky (the galaxy)
    if (this.twist === 'stars' && R.x > ACT2 && R.x < BIG_AT - 200 && this.t > this.nextStar) {
      this.nextStar = this.t + 3 + this.r() * 2.5;
      const x = R.x + this.fieldW * 0.75; const y = this.groundAt(x) - 90;
      this.stars.push({ x, y, vx: -40, vy: 38, at: this.t, find: { x, h: 0, surf: null, key: this.pickKey(true), got: false, rich: true, star: true } });
    }
    for (const s of this.stars) {
      s.x += s.vx * dt; s.y += s.vy * dt;
      s.find.x = s.x; s.find.h = this.groundAt(s.x) - s.y;
      if (s.find.h < 4) s.gone = true;
    }
    this.stars = this.stars.filter((s) => !s.gone && !s.find.got);
    // the loose find bounces ahead and fades away
    const L = this.loose;
    if (L) {
      L.vy += 260 * dt; L.y += L.vy * dt; L.x += 20 * dt;
      const gy = this.groundAt(L.x) - 3;
      if (L.y > gy) { L.y = gy; L.vy = -Math.abs(L.vy) * 0.5; }
      if (Math.hypot(R.x - L.x, R.y - 8 - L.y) < Math.max(10, MAGNET[this.tier - 1])) {
        L.find.dropped = false; this.points.kid += L.find.points; this.loose = null;
        this.pop('Got it back!', R.x, R.y - 30, '#b2f2bb'); this.sound = 'catch';
      } else if (this.t - L.at > 2.6) this.loose = null;
    }
    // a find on the rider's own line ridden past: the streak is over
    for (const f of this.finds) {
      if (f.got || f.taken || f.missed || f.x > R.x - 12) continue;
      f.missed = true;
      const mine = f.surf ? R.on === f.surf : (R.on === 'g' || (!R.on && R.y > this.groundAt(R.x) - LEDGE_LIFT + 4));
      if (!mine || f.buried || R.tumble > 0) continue;
      if (this.streak >= 2) this.pop('Streak over', R.x, R.y - 34, '#ffc9c9');
      this.streak = 0;
    }
    // the visitor spots rare finds coming up
    for (const f of this.finds) {
      if (f.got || !f.rich || this.looked.has(f) || f.x < R.x + 40 || f.x > R.x + this.fieldW * 0.65) continue;
      this.looked.add(f);
      if (this.r() < 0.5) this.pop(`${this.visP.name}: Look, up there!`, R.x + 20, R.y - 46, '#ffffff');
    }
  }

  /** Grab the finds the rider reaches. */
  grab(R) {
    if (R.tumble > 0) return;
    const cx = R.x; const cy = R.y - 8;
    const reach = MAGNET[this.tier - 1];
    const all = [...this.finds, ...this.stars.map((s) => s.find)];
    if (this.big?.find && !this.big.find.got) all.push(this.big.find);
    for (const f of all) {
      if (f.got || f.taken) continue;
      if (f.pop && this.t - f.pop < 0.3) continue;
      if (f.buried && !R.on) continue;
      const fy = f.star ? this.groundAt(f.x) - f.h : this.thingY(f.surf, f.x, f.h);
      const d = Math.hypot(f.x - cx, fy - cy);
      const r = f.big ? 16 : f.buried ? 6 : reach;
      if (d > r) continue;
      if (d > 7 && !f.big && !f.buried) { f.pull = (f.pull || 0) + 1; if (f.pull < 3) continue; } // a good sled's pull: a moment's swoosh
      this.take(R, f);
    }
  }

  take(R, f) {
    f.got = true;
    const air = !R.on;
    const key = f.key || this.pickKey(true);
    const high = Boolean(f.high);
    if (!f.big) this.bumpStreak(null);
    let q = conditionFor({ air, streak: this.streak, high });
    let inches = sizeFor(key, this.r());
    if (high) inches = Math.max(inches, sizeFor(key, this.r())); // up high, the bigger of two
    const item = { key, q, inches, cls: sizeClass(key, inches), at: this.t, find: findByKey(key), mystery: f.mystery, big: f.big };
    // the visitor finds things along the way too (on their own side of the hill)
    if (!f.big && this.r() < 0.4) this.points.vis += RARITY[findByKey(this.pickKey(false)).rarity].points;
    if (f.big) { this.big.item = item; this.pop('The Big Jump find!', R.x, R.y - 40, '#ffd43b', true); this.sound = 'goal'; return; }
    this.score1(item, R);
  }

  /** Count a find: points, the pop, the card, the finds book. */
  score1(item, R) {
    item.points = Math.round(findPoints(item.key, item.q) * (item.cls === 'trophy' ? 1.5 : 1));
    this.points.kid += item.points;
    this.haul.push(item);
    if (item.find.rarity === 'super') this.superRare = true;
    const rare = item.find.rarity === 'rare' || item.find.rarity === 'super';
    this.sound = rare ? 'goal' : 'catch';
    this.pop(`+${item.points}`, R.x + 6, R.y - 28, rare ? '#ffd43b' : '#ffffff', rare);
    const got = this.onFind?.({ key: item.key, q: item.q, inches: item.inches, map: this.hill.id });
    if (got) { item.record = got; this.records += got === 'new' ? 1 : 0; }
    // the card: always for a new find, a rare one, or a better badge
    if (got || rare || item.mystery || item.big) this.showFind = { ...item, at: this.t };
    this.kidP.brain.set({ ...HAPPY, valence: 1, arousal: 0.85 });
  }

  // ---------- the Big Jump ----------
  startBig(R) {
    // the run's best find floats near the top of the jump: rare or better (super rare when it's been a while)
    const odds = findOdds(this.hill.id, this.snow, this.season, this.tier, { day: this.day, rareOnly: true });
    let key = pickFind(odds, this.r());
    if (this.dry + 1 >= PITY) key = Object.keys(odds).find((k) => findByKey(k).rarity === 'super') || key;
    const tUp = -R.vy / this.grav;
    const ax = R.x + R.v * tUp * 1.05; const ay = R.y + R.vy * tUp / 2;
    this.big = { at: this.t, find: { x: ax, h: this.groundAt(ax) - ay, surf: null, key, got: false, big: true, rich: true }, landed: false };
    this.sound = 'goal';
  }

  landBig(R) {
    const B = this.big;
    B.landed = true;
    const zone = this.meter?.zone || 'yellow';
    if (zone === 'green') { this.pop('Perfect landing!', R.x, R.y - 34, '#b2f2bb', true); this.points.kid += 50; }
    else if (zone === 'red') { this.pop('Crash landing!', R.x, R.y - 34, '#ffc9c9', true); }
    else this.pop('Nice landing!', R.x, R.y - 34, '#ffffff');
    if (B.item) {
      B.item.q = zone === 'green' ? 3 : zone === 'red' ? 1 : 2;
      this.score1(B.item, R);
    }
    if (zone === 'red') this.tumble(R, true);
    this.meter = null;
  }

  // ---------- the visitor ----------
  /** The visitor rides a little behind on the same line, grabbing what the kid misses now and then. */
  stepVisitor(dt) {
    const R = this.rider;
    this.trail.push({ t: this.t, x: R.x, y: R.y, air: !R.on, tumble: R.tumble > 0 });
    while (this.trail.length > 2 && (this.trail[1].t < this.t - 0.42 || this.trail[1].x < R.x - 40)) this.trail.shift();
    const p = this.trail[0];
    const V = this.visPos;
    V.x = p.x - 4; V.y = this.trail.length && p.air ? p.y : (this.surfOrGround(p.x, p.y)); V.air = p.air; V.tumble = p.tumble;
    // high five: both in the air at once, once a jump
    if (!R.on && V.air && !R.highFived && R.airT > 0.35) { R.highFived = true; this.points.kid += 10; this.pop('High five! +10', R.x - 10, R.y - 38, '#ffd8a8'); this.sound = 'catch'; }
    for (const f of this.finds) {
      if (f.got || f.taken || f.buried || Math.abs(f.x - V.x) > 4) continue;
      if (Math.abs(this.thingY(f.surf, f.x, f.h) - (V.y - 8)) > 10) continue;
      f.taken = true;
      if (this.r() < 0.5) {
        const pts = RARITY[findByKey(f.key || this.pickKey(false)).rarity].points;
        this.points.vis += pts;
      }
    }
  }

  surfOrGround(x, y) {
    const s = ['g', ...this.ledges].map((on) => this.surfY(on, x)).filter((v) => v != null && Math.abs(v - y) < 3);
    return s.length ? s[0] : y;
  }

  follow(dt, snap = false) {
    const R = this.rider;
    // the faster you go, the more of the hill ahead you see
    this.lead = lerp(this.lead ?? 0.3, 0.3 - 0.1 * clamp((R.v - 100) / 120, 0, 1), snap ? 1 : 1 - Math.exp(-dt * 1.5));
    const tx = R.x - this.fieldW * this.lead;
    // the ground about 60% down the screen, but the rider never too near the top (the Big Jump)
    const ty = Math.min(this.groundAt(R.x) - this.fieldH * 0.6, R.y - this.fieldH * 0.3);
    this.camX = tx;
    this.camY = snap ? lerp(this.camY, ty, 0.2) : lerp(this.camY, ty, 1 - Math.exp(-dt * 4));
    // the landing meter shows on the way down from the Big Jump
    if (this.big && !this.big.landed && R.vy > 20 && !this.meter) this.meter = { at: this.t, zone: null };
  }

  finish() {
    this.done = true;
    this.phase = 'over'; this.overAt = this.t;
    this.newBest = this.points.kid > this.best;
    if (this.newBest) this.best = this.points.kid;
    this.showFind = null;
    this.onRun?.({ superRare: this.superRare });
  }

  pop(text, x, y, color, big) {
    // never up under the score bar, and not on top of another word just said
    const near = this.pops.filter((p) => this.t - p.at < 0.5 && Math.abs(p.x - x) < 40).length;
    addPop(this, text, x, Math.max(y - near * 8, this.camY + this.fieldH * 0.2), color, big, 6);
  }

  // ---------- drawing ----------
  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    const W = this.fieldW; const H = this.fieldH;
    const cx = Math.round(this.camX); const cy = Math.round(this.camY);
    const pal = this.hill.pal;
    const P = (col, x, y, w = 1, h = 1) => { ctx.fillStyle = col; ctx.fillRect(Math.round(x), Math.round(y), w, h); };
    // sky: bands from top to bottom
    if (!this.skyPic || this.skyPic.height !== H) this.skyPic = skyCanvas(W, H, pal.sky, this.hill.id);
    ctx.drawImage(this.skyPic, 0, 0);
    // far hills, two layers
    this.drawFar(ctx, cx, cy, W, H, P);
    // props along the back of the hill
    this.drawProps(ctx, cx, cy, W, H, P);
    // the ground, column by column
    const g = GROUND_FIX[this.hill.id] || pal.ground;
    this.deep = [shade(g[2], -0.22), shade(g[2], 0.18)];
    const snowy = this.hill.snowy;
    for (let sx = 0; sx < W; sx += 1) {
      const wx = cx + sx;
      const gy = Math.round(this.groundAt(wx)) - cy;
      const gap = this.gapAt(wx);
      if (gap) {
        const fill = gap.kind === 'moat' ? '#3b5bdb' : gap.kind === 'gully' ? '#5c3a1e' : '#1864ab';
        const deep = gap.kind === 'moat' ? '#2f46b0' : gap.kind === 'gully' ? '#4a2810' : '#0b3d6e';
        P(deep, sx, gy + 6, 1, H);
        P(fill, sx, gy + 12, 1, 2);
        if (gap.kind === 'moat' && (wx + Math.floor(this.t * 6)) % 7 === 0) P('#91a7ff', sx, gy + 12);
        continue;
      }
      P(g[1], sx, gy, 1, H - gy);
      P(g[0], sx, gy, 1, 2);
      // dithered into the deep color further down
      for (let y = gy + 10; y < Math.min(H, gy + 22); y += 1) if (((wx + y) & 3) === 0 || y > gy + 16 && ((wx + y) & 1) === 0) P(g[2], sx, y);
      if (gy + 22 < H) P(g[2], sx, gy + 22, 1, H - gy - 22);
      // strata and stones down in the ground
      for (let k = 1; k < 6; k += 1) {
        const yy = gy + 22 + k * 11 + Math.round(Math.sin(wx / 23 + k) * 2);
        if (yy >= H) break;
        if (hash1(Math.floor(wx / 5) * 3.7 + k) > 0.3) P(this.deep[0], sx, yy);
        if (hash1(wx * 1.3 + k * 17) < 0.06) { P(this.deep[1], sx, yy + 3, 2, 2); P(this.deep[0], sx, yy + 5, 2, 1); }
      }
      // sparkle on snow and stardust; specks on sand, mud and ash
      const h = hash1(wx);
      if (snowy || this.hill.surface === 'stardust') { if (h < 0.04 && ((Math.floor(this.t * 3) + wx) % 5 === 0)) P('#ffffff', sx, gy + 3); }
      else if (h < 0.08) P(g[2], sx, gy + 3 + Math.floor(h * 60));
      if (this.hill.surface === 'leaves' && h > 0.9) P(h > 0.95 ? '#d9480f' : '#ffd43b', sx, gy);
      if (this.hill.surface === 'rainbow') P(RAINBOW[Math.floor((gy + 200) / 2) % RAINBOW.length], sx, gy + 4, 1, 1);
    }
    // the rainbow slide has stripes
    if (this.hill.surface === 'rainbow') {
      for (let sx = 0; sx < W; sx += 1) { const gy = Math.round(this.groundAt(cx + sx)) - cy; RAINBOW.forEach((c, i) => P(c, sx, gy + 2 + i, 1, 1)); }
    }
    // ramp lips: a bright cap and chevrons, so the jump can be seen coming
    for (const p of this.ramps) {
      const lx = p.x + p.w - cx; if (lx < -20 || lx > W + 20) continue;
      const ly = Math.round(this.groundAt(p.x + p.w)) - cy;
      P(INK, lx - 4, ly - 1, 6, 1); P(p.big ? '#ff922b' : '#ffd43b', lx - 4, ly, 6, 2); P(INK, lx + 1, ly, 1, 6);
      for (let i = 0; i < 3; i += 1) { const ax = p.x - 14 + i * 5 - cx; const ay = Math.round(this.groundAt(p.x - 14 + i * 5)) - cy + 5; P('#ffffff', ax, ay, 1, 1); P('#ffffff', ax + 1, ay + 1, 1, 1); P('#ffffff', ax, ay + 2, 1, 1); }
    }
    // twist things on the ground
    this.drawTwist(ctx, cx, cy, P);
    // ledges: the high line and the top line
    for (const l of this.ledges) {
      if (l.x1 < cx || l.x0 > cx + W) continue;
      for (let x = Math.max(l.x0, cx); x <= Math.min(l.x1, cx + W); x += 1) {
        const y = Math.round(this.groundAt(x) - l.lift) - cy; const sx = x - cx;
        const [top, mid, dark] = LEDGE[this.hill.id] || LEDGE['bg-meadow'];
        P(top, sx, y, 1, 1); P(mid, sx, y + 1, 1, 3); P(dark, sx, y + 4, 1, 1);
        if ((x - l.x0) % 9 === 0) P(dark, sx, y + 1, 1, 3);
      }
      // posts under it
      for (const x of [l.x0 + 6, l.x1 - 6, ...(l.x1 - l.x0 > 150 ? [Math.round((l.x0 + l.x1) / 2)] : [])]) {
        const y = Math.round(this.groundAt(x) - l.lift) - cy; const sx = x - cx;
        const [, , dark] = LEDGE[this.hill.id] || LEDGE['bg-meadow'];
        P(dark, sx - 1, y + 5, 2, l.lift - 4);
      }
    }
    // things in the way
    for (const z of this.hazards) {
      if (z.x < cx - 12 || z.x > cx + W + 12) continue;
      const sy = z.surf ? this.groundAt(z.x) - z.surf.lift : this.groundAt(z.x);
      const hx = Math.round(z.x - cx); const hy = Math.round(sy - cy);
      P('rgba(27,20,48,0.3)', hx - 5, hy, 11, 1); // its shadow
      outlined(P, (Q) => drawHazard(Q, z, hx, hy, this.t, this.hill));
    }
    // finds
    const pics = this.pics || (this.pics = new Map());
    const rim = DARK.has(this.hill.id) ? '#fff3bf' : null;
    const pic = (key) => { if (!pics.has(`r${key}`)) pics.set(`r${key}`, cellsPic(findCells(findByKey(key)), rim)); return pics.get(`r${key}`); };
    const drawFind = (f) => {
      if (f.got || f.taken) return;
      const fy = f.star ? this.groundAt(f.x) - f.h : this.thingY(f.surf, f.x, f.h);
      const sx = Math.round(f.x - cx); const sy = Math.round(fy - cy);
      if (sx < -10 || sx > W + 10) return;
      const tw = Math.floor(this.t * 6 + f.x) % 6;
      if (f.buried) { // just a glint in the snow
        P('#ffffff', sx, sy - 1); if (tw < 3) { P('#ffffff', sx - 1, sy - 1); P('#ffffff', sx + 1, sy - 1); P('#ffffff', sx, sy - 2); }
        return;
      }
      const bob = Math.round(Math.sin(this.t * 3 + f.x) * (f.h > 6 ? 1 : 0));
      if (f.star) { for (let i = 1; i < 8; i += 1) P(i < 3 ? '#fff3bf' : '#ffd43b', sx + i, sy - Math.round(i * 0.95), 1, 1); }
      // sparkle frame: gold for rich spots, a ? for a mystery
      const glow = f.big ? '#ffd43b' : f.rich ? '#fff3bf' : null;
      if (glow && tw < 4) { P(glow, sx - 7, sy - 5 + bob); P(glow, sx + 6, sy - 6 + bob); P(glow, sx, sy - 11 + bob); }
      if (f.mystery || f.big) drawBag(P, sx, sy + bob, true, this.hill, f.big); // a surprise until it's grabbed
      else ctx.drawImage(pic(f.key), sx - 6, sy - 10 + bob);
    };
    for (const f of this.finds) drawFind(f);
    for (const s of this.stars) drawFind(s.find);
    if (this.big && !this.big.find.got) drawFind(this.big.find);
    if (this.loose) ctx.drawImage(pic(this.loose.find.key), Math.round(this.loose.x - cx - 6), Math.round(this.loose.y - cy - 6));
    // the visitor and the kid on their sleds
    const V = this.visPos;
    if (this.phase === 'play' || this.phase === 'over') this.drawRider(ctx, this.visP, V.x - cx, V.y - cy, this.visTier, V.tumble ? this.t * 2 : 0, P);
    else this.drawRider(ctx, this.visP, this.rider.x - 22 - cx, this.groundAt(this.rider.x - 22) - cy, this.visTier, 0, P);
    const R = this.rider;
    this.drawRider(ctx, this.kidP, R.x - cx, R.y - cy, this.tier, R.tumble > 0 ? R.spin : 0, P, R.swing);
    if (R.swing) { const v = this.vines.find((n) => n.gap.x1 + 12 === R.swing.x1); if (v) { const top = Math.round(this.groundAt(v.x) - 60 - cy); drawLine(P, v.x - cx, top, R.x - cx, R.y - 20 - cy, '#2b8a3e'); } }
    // the finish line
    const fx = RUN_LEN - cx;
    if (fx > -4 && fx < W + 4) { const fy = Math.round(this.groundAt(RUN_LEN)) - cy; for (let y = 0; y < 26; y += 1) P(y % 4 < 2 ? '#ffffff' : INK, fx, fy - y); for (let i = 0; i < 6; i += 1) for (let j = 0; j < 4; j += 1) P((i + j) % 2 ? '#ffffff' : INK, fx + 1 + i, fy - 26 + j); }
    // weather: snow falls on snowy hills, bubbles rise in the sea
    this.drawWeather(P, W, H);
  }

  /** Two layers of far hills, each map with its own colors and its own crest (trees, peaks, a castle...). */
  drawFar(ctx, cx, cy, W, H, P) {
    const look = FAR_LOOK[this.hill.id] || FAR_LOOK['bg-meadow'];
    const [c0, c1] = farColors(this.hill.id, this.season);
    const t = this.t;
    // the back layer
    const k0 = 0.15; const base0 = H * 0.42 - cy * k0 * 0.15;
    const y0 = (wx) => (look.back === 'peaks'
      ? base0 + 6 - Math.abs(((wx / 34) % 2 + 2) % 2 - 1) * 26 + Math.sin(wx / 9) * 2
      : base0 + Math.sin(wx / 53) * 9 + Math.sin(wx / 22) * 3);
    for (let sx = 0; sx < W; sx += 1) {
      const wx = cx * k0 + sx; let y = y0(wx);
      // a volcano cone, or a castle, now and then along the back
      const m = ((wx % 420) + 420) % 420;
      if (look.back === 'cone' && m < 120) y = Math.min(y, base0 - 34 + Math.abs(m - 60) * 0.9);
      if (look.back === 'castle' && m > 150 && m < 196) { const q = m - 150; y = Math.min(y, base0 - (q < 8 || q > 38 ? 26 + (q % 3 === 0 ? 0 : 3) : q % 4 < 2 ? 16 : 18)); }
      if (look.back === 'craters' && m > 200 && m < 260) y += 3 - Math.abs(m - 230) / 10;
      y = Math.round(y);
      P(c0, sx, y, 1, H - y);
      if (look.back === 'peaks' || this.hill.snowy) P('#ffffff', sx, y, 1, look.back === 'peaks' ? 3 : 1);
      if (look.back === 'cone' && m > 52 && m < 68) P(m % 4 < 2 ? '#ff6b1a' : '#e03131', sx, y, 1, 4 + Math.round(Math.abs(m - 60) / 2));
      if (look.back === 'cone' && m > 54 && m < 66 && Math.floor(t * 2 + m) % 5 === 0) P('#adb5bd', sx, y - 3 - Math.floor((t * 6) % 6), 1, 1);
    }
    // a band of sea between the layers (the fjord)
    if (look.water) for (let sx = 0; sx < W; sx += 1) P((sx + Math.floor(t * 3)) % 9 ? look.water : '#4dabf7', sx, Math.round(H * 0.5 - cy * 0.02), 1, 2);
    // the front layer, with its crest
    const k1 = 0.3; const base1 = H * 0.52 - cy * k1 * 0.15;
    for (let sx = 0; sx < W; sx += 1) {
      const wx = cx * k1 + sx;
      let y = Math.round(base1 + Math.sin(wx / 66) * 7 + Math.sin(wx / 27) * 2.5);
      const n = Math.floor(wx / 7); const in7 = ((wx % 7) + 7) % 7; const hh = hash1(n * 3.1);
      if (look.front === 'trees') y -= Math.max(0, Math.round((3 + hh * 4) - Math.abs(in7 - 3) * (1.5 + hh)));
      if (look.front === 'canopy') { const r = 5 + hh * 3; y -= Math.round(Math.sqrt(Math.max(0, r * r - (in7 - 3) ** 2 * 2.2)) * 0.8); }
      if (look.front === 'reef' && hh > 0.55 && in7 === 3) P(c1, sx, y - 6 - Math.round(hh * 8), 1, 8 + Math.round(hh * 8));
      if (look.front === 'dunes') y += Math.round(Math.sin(wx / 15) * 2);
      P(c1, sx, y, 1, H - y);
      if (look.front === 'canopy' && hh > 0.7 && in7 === 1) P(shade(c1, -0.25), sx, y + 2, 1, 9 + Math.round(hh * 6)); // hanging vines
    }
    // light through the water (the reef)
    if (this.hill.id === 'bg-ocean') for (let i = 0; i < 4; i += 1) { const x0 = Math.round(((i * 61 - cx * 0.1) % W + W) % W); for (let y = 0; y < H * 0.5; y += 1) if (((x0 + y) & 1) === 0) P('rgba(165,216,255,0.35)', x0 + Math.round(y * 0.3), y, 3, 1); }
  }

  drawProps(ctx, cx, cy, W, H, P) {
    const props = this.hill.props.map((k) => PROP_SWAP[k] || k);
    const [, c1] = farColors(this.hill.id, this.season);
    // scenery takes on 40% of the far hills' color, so it sits back behind the things that matter
    const cols = this.hill.pal.props.map((c) => mix(c, c1, 0.4));
    const step = 46;
    const first = Math.floor(cx / step) - 1;
    for (let i = first; i < first + W / step + 3; i += 1) {
      const h = hash1(i * 7.3 + 1);
      if (h < 0.25) continue;
      const wx = Math.round(i * step + h * 20);
      if (this.gapAt(wx) || this.onRamp(wx)) continue;
      const gy = Math.round(this.groundAt(wx) - cy) + 2; // planted: the ground covers its foot
      drawProp(P, props[i % props.length], wx - cx, gy, cols, this.t, this.hill);
    }
  }

  drawTwist(ctx, cx, cy, P) {
    const at = (x) => Math.round(this.groundAt(x)) - cy;
    for (const p of this.piles) {
      const sx = p.x - cx; if (sx < -10 || sx > this.fieldW + 10) continue;
      const y = at(p.x);
      const cols = this.hill.snowy ? ['#ffffff', '#dbe4ee', '#b8cce0'] : this.season === 'autumn' ? ['#f08c00', '#d9480f', '#ffd43b'] : ['#e9c46a', '#c9a227', '#f4dfa0'];
      if (p.burst) { const a = (this.t - p.burst) / 0.6; if (a < 1) for (let i = 0; i < 10; i += 1) P(cols[i % 3], sx + Math.round(Math.cos(i) * 12 * a), y - 4 - Math.round(Math.abs(Math.sin(i * 1.7)) * 14 * a)); P(cols[1], sx - 4, y - 1, 9, 1); continue; }
      for (let r = 0; r < 6; r += 1) P(cols[r % 2], sx - 6 + r, y - r, 13 - 2 * r, 1);
      P(cols[2], sx - 2, y - 4); P(cols[2], sx + 2, y - 2);
    }
    for (const v of this.vents) {
      const sx = v.x - cx; if (sx < -10 || sx > this.fieldW + 10) continue;
      const y = at(v.x);
      P('#212529', sx - 4, y - 1, 9, 2); P('#ff6b1a', sx - 1, y - 1, 3, 1);
      const ph = (this.t + v.ph) % 2.4;
      if (ph < 0.8) for (let i = 0; i < 14; i += 1) { const yy = y - 3 - i * 2 - Math.round((ph * 30) % 2); P(i % 3 ? '#f1f3f5' : '#ced4da', sx - 2 + Math.round(Math.sin(i + this.t * 9) * (1 + i / 4)), yy, 3, 2); }
      else if (ph > 2.0) P('#f1f3f5', sx, y - 4 - Math.round((ph - 2) * 10)); // a warning wisp before it puffs
    }
    for (const b of this.bubbles) {
      const sx = b.x - cx; if (sx < -14 || sx > this.fieldW + 14) continue;
      const y = at(b.x);
      for (let i = 0; i < 12; i += 1) { const yy = y - ((i * 9 + Math.floor(this.t * 40)) % 90); P('#d0ebff', sx - 6 + ((i * 5) % 12), yy, 2, 2); P('#ffffff', sx - 6 + ((i * 5) % 12), yy); }
    }
    for (const v of this.vines) {
      const sx = v.x - cx; if (sx < -30 || sx > this.fieldW + 30) continue;
      const top = at(v.x) - 60;
      if (!(this.rider.swing && this.rider.swing.x1 === v.gap.x1 + 12)) for (let y = 0; y < 34; y += 1) P(y % 5 === 0 ? '#69db7c' : '#2b8a3e', sx + Math.round(Math.sin(this.t * 2 + y / 8) * y / 12), top + y);
      P('#2b8a3e', sx - 30, top - 2, 60, 2); P('#5c940d', sx - 30, top, 60, 1);
    }
    for (const p of this.puddles) {
      for (let x = p.x0; x <= p.x1; x += 1) { const sx = x - cx; if (sx < 0 || sx > this.fieldW) continue; P('#5c3a1e', sx, at(x) - 1, 1, 2); if ((x + Math.floor(this.t * 4)) % 6 === 0) P('#a0703f', sx, at(x) - 1); }
    }
  }

  drawWeather(P, W, H) {
    if (this.hill.snowy && (this.season === 'winter' || this.snow === 'powder')) {
      for (let i = 0; i < 40; i += 1) {
        const x = Math.round(((i * 53 + this.t * (10 + (i % 5) * 3) - this.camX * 0.6) % W + W) % W);
        const y = Math.round(((i * 37 + this.t * (14 + (i % 4) * 4)) % H + H) % H);
        P(i % 3 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.8)', x, y);
      }
    }
    if (this.hill.id === 'bg-ocean') for (let i = 0; i < 14; i += 1) P('rgba(165,216,255,0.5)', Math.round(((i * 71 - this.camX * 0.4) % W + W) % W), Math.round(((i * 29 - this.t * 16) % H + H) % H), 1, 1);
    if (this.hill.id === 'bg-space' || this.hill.id === 'bg-galaxy') for (let i = 0; i < 30; i += 1) { const x = Math.round(((i * 97 - this.camX * 0.05) % W + W) % W); const y = (i * 41) % Math.round(H * 0.45); if ((Math.floor(this.t * 2) + i) % 7) P(i % 5 ? '#ffffff' : '#ffe066', x, y); }
  }

  drawRider(ctx, p, x, y, tier, spin, P, swing = null) {
    x = Math.round(x); y = Math.round(y);
    p.paint(this.t);
    // the sled under the buddy, following the slope a little
    const s = this.base.slope(x + this.camX);
    if (!swing) outlined(P, (Q) => drawSled(Q, x, y, tier, spin ? 0 : s));
    ctx.save();
    if (spin) {
      const turn = Math.floor(spin * 8) % 4;
      ctx.translate(x, y - 10); ctx.rotate((turn * Math.PI) / 2); ctx.drawImage(p.pic, -12, -14);
    } else ctx.drawImage(p.pic, x - 12, y - FEET - 3);
    ctx.restore();
  }

  // ---------- the HUD ----------
  drawHud(ctx, scale) {
    const S = scale; const W = this.vW * S; const H = this.vH * S; const k = S / this.zoom;
    const X = (x) => (x - this.camX) * k; const Y = (y) => (y - this.camY) * k;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff') => {
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = INK;
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
    };
    const u = S * 4;
    const R = this.rider;
    // points and the way down
    ctx.textAlign = 'left'; text(`${this.kidP.name} ${this.points.kid}`, u, u * 1.4, u * 1.5, '#ffd43b');
    ctx.textAlign = 'right'; text(`${this.visP.name} ${this.points.vis}`, W - u, u * 1.4, u * 1.5, '#ffffff');
    ctx.textAlign = 'center';
    const bw = W * 0.36; const bx = W / 2 - bw / 2; const by = u * 0.9; const bh = u * 0.9;
    ctx.fillStyle = 'rgba(27,20,48,0.55)'; ctx.fillRect(bx, by, bw, bh);
    const prog = clamp(R.x / RUN_LEN, 0, 1);
    ctx.fillStyle = '#74c0fc'; ctx.fillRect(bx, by, bw * prog, bh);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(bx + bw * (BIG_AT / RUN_LEN) - S * 0.5, by - S, S, bh + 2 * S);
    ctx.strokeStyle = INK; ctx.lineWidth = S * 0.5; ctx.strokeRect(bx, by, bw, bh);
    text(this.hill.name, W / 2, by + bh + u * 0.9, u * 1.05, '#ffffff');
    if (this.streak >= 2 && this.phase === 'play') text(`Streak x${this.streak}${this.streak >= STREAK_FINE ? ' ★★' : ''}`, W / 2, by + bh + u * 2.2, u * 1.1, '#d0bfff');
    // a good sled's glint: a rare find is coming up off the edge of the screen
    if (this.tier >= 2 && this.phase === 'play') {
      const ahead = [...this.finds, ...(this.big ? [this.big.find] : [])].find((f) => !f.got && !f.taken && f.rich && f.x > this.camX + this.fieldW && f.x < this.camX + this.fieldW * 1.8);
      if (ahead && Math.floor(this.t * 3) % 2) { const yy = clamp(Y(this.thingY(ahead.surf, ahead.x, ahead.h)), u * 4, H - u * 3); text('✦ ▶', W - u * 2.2, yy, u * 1.6, '#ffd43b'); }
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.4;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(X(p.x), 26 * S, W - 26 * S), Math.max(u * 5.5, Y(p.y) - age * 8 * S), u * (p.big ? 1.9 : 1.3), p.color);
      ctx.globalAlpha = 1;
    }
    // the landing meter
    if (this.meter) {
      const m = this.meter.zone ? this.meter.m : needle(this.t - this.meter.at, 0.55);
      const mw = u * 16; const mh = u * 1.5; const mx = W / 2 - mw / 2; const my = H * 0.72;
      drawMeter(ctx, (v) => zoneAt(v, 0.12, 0.3), m, mx, my, mw, mh, S);
      text(this.meter.zone ? { green: 'Perfect!', yellow: 'Good', red: 'Oops!' }[this.meter.zone] : 'TAP to land!', W / 2, my - u * 1.2, u * 1.6, this.meter.zone === 'green' ? '#b2f2bb' : '#ffffff');
    }
    // a find card
    const c = this.showFind;
    if (c && this.phase === 'play') {
      const cw = Math.min(W * 0.46, u * 25); const ch = u * 5; const cx = u * 0.6; const cy = u * 2.8;
      ctx.fillStyle = 'rgba(27,20,48,0.95)'; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = c.find.rarity === 'super' ? '#ff8cc6' : c.find.rarity === 'rare' ? '#ffd43b' : '#74c0fc'; ctx.lineWidth = S; ctx.strokeRect(cx, cy, cw, ch);
      const z = Math.floor(ch * 0.8 / 12);
      ctx.imageSmoothingEnabled = false;
      const pics = this.pics || (this.pics = new Map());
      if (!pics.has(c.key)) pics.set(c.key, cellsPic(findCells(c.find)));
      ctx.drawImage(pics.get(c.key), cx + u * 0.6, cy + ch / 2 - 6 * z, 12 * z, 12 * z);
      ctx.textAlign = 'left';
      const tx = cx + u * 0.6 + 12 * z + u * 0.6;
      text(`${c.find.name}${c.find.rarity === 'super' ? ' · SUPER RARE!' : c.find.rarity === 'rare' ? ' · RARE!' : ''}`, tx, cy + ch * 0.32, u * 1.2, c.find.rarity === 'common' ? '#ffffff' : '#ffd43b');
      text(`${CONDITIONS[c.q].stars} ${CONDITIONS[c.q].name} · ${fmtSize(c.inches)}${c.cls === 'trophy' ? ' 🏆' : ''} · +${c.points}`, tx, cy + ch * 0.7, u * 1.0, '#e9ecef');
      ctx.textAlign = 'center';
      if (c.record) {
        const label = { new: 'NEW FIND!', better: 'BETTER ★!', bigger: 'BIGGEST YET!' }[c.record];
        const rw = u * 8.5; const rh = u * 1.6; const rx = cx + cw - rw + u * 0.4; const ry = cy + ch - u * 0.4;
        ctx.fillStyle = '#2f9e44'; ctx.fillRect(rx, ry, rw, rh); ctx.strokeStyle = INK; ctx.lineWidth = S * 0.6; ctx.strokeRect(rx, ry, rw, rh);
        text(label, rx + rw / 2, ry + rh / 2, u * 0.95, '#ffffff');
      }
    }
    // before the run: today's snow, the find of the day and the hill's twist
    if (this.phase === 'ready') {
      const cw = Math.min(W * 0.86, u * 40); const ch = u * 11.5; const cx = W / 2 - cw / 2; const cy = H * 0.42 - ch / 2;
      ctx.fillStyle = 'rgba(27,20,48,0.96)'; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = '#74c0fc'; ctx.lineWidth = S; ctx.strokeRect(cx, cy, cw, ch);
      const fod = findByKey(this.today);
      text(`${this.words.emoji} Today: ${this.words.name}`, W / 2, cy + u * 1.8, u * 1.6, '#ffffff');
      text(`Find of the day: ${fod.name}`, W / 2, cy + u * 3.9, u * 1.3, '#ffd43b');
      text(TWIST_TIPS[this.twist], W / 2, cy + u * 5.9, u * 1.15, '#d0ebff');
      text('Tap to jump · hold over a ramp for big air', W / 2, cy + u * 7.6, u * 1.15, '#ffffff');
      if (Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Tap to go!', W / 2, cy + u * 9.4, u * 1.4, '#ffd43b');
    }
    // the end of the run: everything found
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const mine = this.haul.filter((h) => !h.dropped);
      const cw = Math.min(W * 0.9, u * 44); const ch = u * (mine.length ? 15 : 10); const cx = W / 2 - cw / 2; const cy = H * 0.45 - ch / 2;
      ctx.fillStyle = 'rgba(27,20,48,0.96)'; ctx.fillRect(cx, cy, cw, ch);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(cx, cy, cw, ch);
      text(`Bottom of the hill! ${this.points.kid} points`, W / 2, cy + u * 1.8, u * 2.1, '#ffd43b');
      text(`${mine.length} finds${this.records ? ` · ${this.records} new in your finds book` : ''} · ${this.visP.name} got ${this.points.vis}`, W / 2, cy + u * 3.8, u * 1.25, '#e9ecef');
      // the finds in a row, best first
      // one of each kind, best first, with how many
      const kinds = new Map();
      for (const h of [...mine].sort((a, b) => b.points - a.points)) { const k = kinds.get(h.key); if (k) { k.n += 1; k.isNew = k.isNew || h.record === 'new'; } else kinds.set(h.key, { h, n: 1, isNew: h.record === 'new' }); }
      const show = [...kinds.values()].slice(0, 9);
      const fit = (cw - u * 2) / Math.max(1, show.length);
      const z = Math.max(2, Math.min(Math.floor(u * 0.45), Math.floor((fit - u * 0.4) / 12))); const gap = 12 * z + u * 0.4; const x0 = W / 2 - (show.length * gap) / 2 + u * 0.2;
      const pics = this.pics || (this.pics = new Map());
      ctx.imageSmoothingEnabled = false;
      show.forEach(({ h, n, isNew }, i) => {
        if (!pics.has(h.key)) pics.set(h.key, cellsPic(findCells(h.find)));
        ctx.drawImage(pics.get(h.key), x0 + i * gap, cy + u * 5, 12 * z, 12 * z);
        if (n > 1) text(`x${n}`, x0 + i * gap + 10 * z, cy + u * 5 + 11 * z, u * 0.9, '#ffffff');
        if (isNew) text('NEW', x0 + i * gap + 6 * z, cy + u * 5 + 12 * z + u * 0.6, u * 0.9, '#b2f2bb');
      });
      const yy = cy + ch - u * 3.4;
      text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, yy, u * 1.5, this.newBest ? '#b2f2bb' : '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to sled again', W / 2, yy + u * 2, u * 1.3, '#ffffff');
    }
  }
}

const SNOWGRIP = { icy: 0.6, powder: 1, slushy: 1.3 };
const RAINBOW = ['#ff6b6b', '#ffa94d', '#ffe066', '#69db7c', '#4dabf7', '#9775fa'];
const LEDGE = {
  'bg-meadow': ['#c98a4b', '#8b5a2b', '#5c3a1e'], 'bg-castle': ['#ced4da', '#868e96', '#495057'], 'bg-sunset': ['#e9d2b4', '#c9a27a', '#8d6e63'],
  'bg-ocean': ['#ff8787', '#f06595', '#a61e4d'], 'bg-volcano': ['#495057', '#343a40', '#212529'], 'bg-rainforest': ['#8ce99a', '#6e4b2a', '#4a3220'],
  'bg-fjord': ['#e7f5ff', '#a5d8ff', '#4dabf7'], 'bg-space': ['#e9ecef', '#adb5bd', '#495057'], 'bg-rainbow': ['#ffffff', '#f1f3f5', '#d0bfff'], 'bg-galaxy': ['#fff3bf', '#ffd43b', '#b8860b'],
};

// ---------- art helpers ----------
/** Far hill colors per map ([back, front]; seasons where they change) and what tops them. */
const FAR = {
  'bg-meadow': { all: ['#8fcf8a', '#3f9a45'], autumn: ['#e8a33d', '#a8612a'], winter: ['#c3d3e8', '#9db4d6'] },
  'bg-castle': { all: ['#8c9bb8', '#6f7fa3'], winter: ['#a9b6cf', '#8392b3'] },
  'bg-sunset': { all: ['#f4c27a', '#c98a4b'] },
  'bg-ocean': { all: ['#1971c2', '#0b4f8a'] },
  'bg-volcano': { all: ['#5a3a30', '#2e1f1b'] },
  'bg-rainforest': { all: ['#2f9e44', '#1b5e20'] },
  'bg-fjord': { all: ['#5c7cab', '#3b5a87'] },
  'bg-space': { all: ['#5c5f8a', '#3d4070'] },
  'bg-rainbow': { all: ['#ffc9e9', '#b197fc'] },
  'bg-galaxy': { all: ['#5f3dc4', '#3b2470'] },
};
const farColors = (id, season) => (FAR[id] || FAR['bg-meadow'])[season] || (FAR[id] || FAR['bg-meadow']).all;
const FAR_LOOK = {
  'bg-meadow': { back: 'hills', front: 'trees' }, 'bg-castle': { back: 'castle', front: 'trees' }, 'bg-sunset': { back: 'hills', front: 'dunes' },
  'bg-ocean': { back: 'hills', front: 'reef' }, 'bg-volcano': { back: 'cone', front: 'none' }, 'bg-rainforest': { back: 'hills', front: 'canopy' },
  'bg-fjord': { back: 'peaks', front: 'trees', water: '#1b4f8a' }, 'bg-space': { back: 'craters', front: 'none' }, 'bg-rainbow': { back: 'hills', front: 'none' },
  'bg-galaxy': { back: 'craters', front: 'none' },
};
/** Scenery that looked too much like something in the way gets something else instead. */
const PROP_SWAP = { hay: 'pine', rock: 'bush', steam: 'deadtree', iceblock: 'spruce' };
/** Ground colors where the hill's own ones are hard to read (the galaxy's gold finds on gold). */
const GROUND_FIX = { 'bg-galaxy': ['#ffe066', '#d4a017', '#7a5b00'] };
/** Dark maps: finds get a light rim so they show. */
const DARK = new Set(['bg-volcano', 'bg-space', 'bg-galaxy', 'bg-ocean']);

/** A color a little darker (k < 0) or lighter (k > 0). */
function shade(col, k) {
  const c = hex(col);
  const f = (v) => Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k);
  return `rgb(${f(c[0])},${f(c[1])},${f(c[2])})`;
}
/** a, k of the way to b. */
function mix(a, b, k) {
  const x = hex(a); const y = hex(b);
  return `rgb(${x.map((v, i) => Math.round(v + (y[i] - v) * k)).join(',')})`;
}
/** Draws something with a dark outline around it: draw(Q) paints with Q like P, then the outline goes on. */
function outlined(P, draw) {
  const px = new Map();
  draw((col, x, y, w = 1, h = 1) => {
    for (let i = 0; i < w; i += 1) for (let j = 0; j < h; j += 1) px.set(`${Math.round(x) + i},${Math.round(y) + j}`, col);
  });
  const edge = new Set();
  for (const k of px.keys()) {
    const [x, y] = k.split(',').map(Number);
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const n = `${x + dx},${y + dy}`; if (!px.has(n)) edge.add(n); }
  }
  for (const k of edge) { const [x, y] = k.split(',').map(Number); P(INK, x, y); }
  for (const [k, col] of px) { const [x, y] = k.split(',').map(Number); P(col, x, y); }
}

function hash1(n) { const h = Math.sin(n * 127.1 + 311.7) * 43758.5453; return h - Math.floor(h); }

function skyCanvas(W, H, [top, bottom], id) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const a = hex(top); const b = hex(bottom);
  // eight bands, dithered at each edge
  const bands = 8;
  for (let y = 0; y < H; y += 1) {
    const k = Math.min(1, y / (H * 0.7));
    const band = Math.min(bands - 1, Math.floor(k * bands));
    const frac = k * bands - band;
    for (let i = 0; i < W; i += 1) {
      const up = frac > 0.75 && ((i + y) & 1) === 0 ? 1 : 0;
      const kk = Math.min(1, (band + up) / (bands - 1));
      x.fillStyle = `rgb(${Math.round(a[0] + (b[0] - a[0]) * kk)},${Math.round(a[1] + (b[1] - a[1]) * kk)},${Math.round(a[2] + (b[2] - a[2]) * kk)})`;
      x.fillRect(i, y, 1, 1);
    }
  }
  if (id === 'bg-sunset') { x.fillStyle = '#fff3bf'; x.beginPath(); x.arc(W * 0.78, H * 0.3, 9, 0, Math.PI * 2); x.fill(); }
  if (id === 'bg-space') { x.fillStyle = '#4dabf7'; x.beginPath(); x.arc(W * 0.8, H * 0.18, 8, 0, Math.PI * 2); x.fill(); x.fillStyle = '#51cf66'; x.fillRect(Math.round(W * 0.8) - 3, Math.round(H * 0.18) - 2, 4, 3); }
  return c;
}
function hex(h) { return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]; }

/** A find's picture, 12x12: its 10x10 cells in the middle, with a light rim around them on dark maps. */
function cellsPic(cells, rim = null) {
  const c = document.createElement('canvas'); c.width = 12; c.height = 12;
  const x = c.getContext('2d');
  const on = (i, j) => cells[j]?.[i];
  if (rim) {
    x.fillStyle = rim;
    for (let j = -1; j <= 10; j += 1) for (let i = -1; i <= 10; i += 1) if (!on(i, j) && (on(i - 1, j) || on(i + 1, j) || on(i, j - 1) || on(i, j + 1))) x.fillRect(i + 1, j + 1, 1, 1);
  }
  cells.forEach((row, j) => row.forEach((col, i) => { if (col) { x.fillStyle = col; x.fillRect(i + 1, j + 1, 1, 1); } }));
  return c;
}

function drawLine(P, x0, y0, x1, y1, col) {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0)));
  for (let i = 0; i <= n; i += 1) P(col, Math.round(x0 + (x1 - x0) * i / n), Math.round(y0 + (y1 - y0) * i / n));
}

/** A find you can't see yet: a little sack (a ? on it for a mystery, a gold star for the Big Jump). */
function drawBag(P, x, y, special, hill, big) {
  const body = big ? '#ffd43b' : special ? '#9775fa' : '#e9c46a'; const dark = big ? '#e67700' : special ? '#5f3dc4' : '#b08a3a';
  P(INK, x - 3, y - 7, 7, 1); P(INK, x - 4, y - 6, 1, 6); P(INK, x + 4, y - 6, 1, 6); P(INK, x - 3, y, 7, 1);
  P(body, x - 3, y - 6, 7, 6); P(dark, x - 3, y - 1, 7, 1); P(dark, x + 2, y - 6, 1, 5);
  P(INK, x - 1, y - 9, 3, 2); P(dark, x, y - 8);
  if (special || big) { P('#ffffff', x - 1, y - 5, 2, 1); P('#ffffff', x + 1, y - 4); P('#ffffff', x, y - 3); P('#ffffff', x, y - 1); }
  else { P('#fff3bf', x - 2, y - 5, 1, 2); }
}

/**
 * The sled (drawn inside outlined(), so it gets a dark outline): a wooden sled on runners with
 * a curled front (1), a red plastic toboggan with a rolled-up front and rope handles (2), and a
 * blue racer on shiny runners with a gold stripe and a fin (3).
 */
function drawSled(P, x, y, tier, slope) {
  const tilt = (dx) => Math.round(dx * clamp(slope, -0.4, 0.4));
  const at = (col, dx, dy, w = 1, h = 1) => P(col, x + dx, y + dy + tilt(dx), w, h);
  if (tier === 1) {
    for (let dx = -8; dx <= 7; dx += 1) { at((dx + 8) % 4 === 3 ? '#8b5a2b' : '#c98a4b', dx, -4); at('#8b5a2b', dx, -3); }
    for (const dx of [-6, -1, 4]) at('#6e4520', dx, -2); // struts
    for (let dx = -8; dx <= 8; dx += 1) at('#495057', dx, -1); // runners
    at('#495057', 9, -2); at('#495057', 10, -3); at('#495057', 10, -4); at('#495057', 9, -5); // the curl
    at('#c98a4b', 8, -5); at('#8b5a2b', 8, -4);
  } else if (tier === 2) {
    for (let dx = -8; dx <= 7; dx += 1) { at('#fa5252', dx, -4); at('#e03131', dx, -3); at('#a61e1e', dx, -2); }
    at('#ff8787', -7, -4, 4, 1);
    at('#e03131', 8, -4); at('#e03131', 8, -5); at('#fa5252', 9, -6); at('#fa5252', 9, -7); at('#e03131', 8, -7); // rolled-up front
    at('#ffd43b', -9, -5); at('#ffd43b', -9, -4); at('#ffd43b', 2, -5); // rope handles
  } else {
    for (let dx = -7; dx <= 7; dx += 1) { at('#1c7ed6', dx, -5); at(dx % 2 ? '#ffd43b' : '#fcc419', dx, -4); at('#1864ab', dx, -3); }
    for (let dx = -8; dx <= 9; dx += 1) at(dx % 3 ? '#dee2e6' : '#ffffff', dx, -1);
    for (const dx of [-5, 0, 5]) at('#adb5bd', dx, -2);
    at('#dee2e6', 10, -2); at('#dee2e6', 11, -3); // runner tips
    at('#1c7ed6', 8, -5); at('#4dabf7', 8, -6); at('#4dabf7', -7, -6); at('#1c7ed6', -7, -7); // nose and fin
  }
}

/** Something in the way, standing on the surface at (x, y). */
function drawHazard(P, z, x, y, t, hill) {
  const ty = z.type;
  const squish = z.squish && t - z.squish < 0.2 ? 2 : 0;
  const blob = (c1, c2, c3, w = 9, h = 7) => {
    for (let j = 0; j < h; j += 1) { const half = Math.round((w / 2) * Math.sqrt(1 - ((j - h + 0.5) / h) ** 2)); P(c2, x - half, y - h + j, half * 2 + 1, 1); }
    P(c1, x - Math.round(w / 4), y - h + 1, 2, 1); P(c3, x - Math.round(w / 2) + 1, y - 1, w - 1, 1);
  };
  if (ty === 'gumdrop') { const c = ['#ff6b6b', '#69db7c', '#ffd43b', '#4dabf7'][Math.abs(Math.round(z.x / 7)) % 4]; for (let j = 0; j < 7 - squish; j += 1) { const half = Math.round(5 * Math.sqrt(1 - ((j - 6.5 + squish) / 7) ** 2)); P(c, x - half, y - 7 + squish + j, half * 2 + 1, 1); } P('#ffffff', x - 2, y - 5 + squish, 1, 1); P('#ffffff', x + 1, y - 4 + squish); return; }
  if (ty === 'log' || ty === 'driftwood' || ty === 'root') {
    const [a, b] = ty === 'driftwood' ? ['#e9d2b4', '#c9a27a'] : ty === 'root' ? ['#6e4b2a', '#4a3220'] : ['#a0612f', '#6e4520'];
    P(INK, x - 6, y - 6, 13, 1); P(a, x - 6, y - 5, 13, 3); P(b, x - 6, y - 2, 13, 2); P(INK, x - 6, y, 13, 1);
    P('#e9c46a', x + 5, y - 4, 2, 2); P(b, x + 6, y - 4); return;
  }
  if (ty === 'stump') { P('#6e4520', x - 4, y - 6, 9, 6); P('#c98a4b', x - 4, y - 7, 9, 1); P('#8b5a2b', x - 1, y - 7, 3, 1); return; }
  if (ty === 'barrel') { P('#8b5a2b', x - 4, y - 9, 9, 9); P('#495057', x - 4, y - 7, 9, 1); P('#495057', x - 4, y - 2, 9, 1); P('#c98a4b', x - 2, y - 8, 1, 7); return; }
  if (ty === 'hay') { P('#e9c46a', x - 5, y - 7, 11, 7); P('#c9a227', x - 5, y - 4, 11, 1); P('#f4dfa0', x - 4, y - 7, 2, 1); return; }
  if (ty === 'crab') { const leg = Math.floor(t * 8) % 2; P('#e03131', x - 4, y - 5, 9, 3); P('#ff8787', x - 2, y - 5, 3, 1); P(INK, x - 2, y - 7, 1, 2); P(INK, x + 2, y - 7, 1, 2); P('#e03131', x - 6, y - 6, 2, 2); P('#e03131', x + 5, y - 6, 2, 2); P('#a61e1e', x - 4 + leg, y - 2, 1, 2); P('#a61e1e', x + 3 - leg, y - 2, 1, 2); return; }
  if (ty === 'sandcastle') { P('#e5b574', x - 5, y - 6, 11, 6); P('#e5b574', x - 5, y - 8, 2, 2); P('#e5b574', x + 4, y - 8, 2, 2); P('#e5b574', x - 1, y - 9, 3, 3); P('#c9965a', x - 1, y - 3, 3, 3); P('#e03131', x, y - 12, 1, 3); return; }
  if (ty === 'urchin') { blob('#e599f7', '#862e9c', '#5f3dc4', 7, 5); for (let i = 0; i < 6; i += 1) P(INK, x - 5 + i * 2, y - 7 + (i % 2)); return; }
  if (ty === 'clam') { blob('#ffe8cc', '#f4a261', '#c9965a', 9, 5); return; }
  if (ty === 'vent') { blob('#868e96', '#5c636a', '#343a40'); return; }
  if (ty === 'lavarock') { blob('#868e96', '#5c636a', '#343a40'); P('#ff6b1a', x - 1, y - 5, 1, 3); P('#ff6b1a', x + 2, y - 3, 2, 1); P('#ffd43b', x - 1, y - 4); return; }
  if (ty === 'ice') { for (let j = 0; j < 8; j += 1) P(j < 2 ? '#a5d8ff' : '#4dabf7', x - 4 + Math.floor(j / 3), y - 8 + j, 9 - Math.floor(j / 3), 1); P('#1c7ed6', x + 2, y - 5, 1, 4); P('#e7f5ff', x - 3, y - 7, 2, 1); return; }
  if (ty === 'snowdrift') { blob('#e7f5ff', '#a5d8ff', '#74c0fc', 13, 6); return; }
  if (ty === 'crater' || ty === 'moonrock') { blob('#868e96', '#5c5f8a', '#3d4070'); P('#3d4070', x + 1, y - 4, 2, 1); P('#adb5bd', x - 2, y - 6); return; }
  if (ty === 'antenna') { P('#adb5bd', x, y - 10, 1, 10); P('#e9ecef', x - 3, y - 11, 7, 2); P('#fa5252', x, y - 13, 1, 1); P('#868e96', x - 2, y - 1, 5, 1); return; }
  if (ty === 'asteroid') { blob('#ced4da', '#868e96', '#495057'); P('#495057', x - 2, y - 4); P('#495057', x + 2, y - 5); return; }
  if (ty === 'starburst') { const c = Math.floor(t * 6) % 2 ? '#fa5252' : '#ff8787'; P(c, x, y - 9, 1, 9); P(c, x - 4, y - 5, 9, 1); P(c, x - 2, y - 7, 1, 1); P(c, x + 2, y - 7); P(c, x - 2, y - 3); P(c, x + 2, y - 3); return; }
  if (ty === 'ring') { P('#d0bfff', x - 5, y - 4, 11, 2); P('#ffd43b', x - 3, y - 7, 7, 6); P('#d0bfff', x - 5, y - 4, 11, 1); return; }
  if (ty === 'cloudpuff') { blob('#ffffff', '#f1f3f5', '#d0bfff', 11, 6); return; }
  if (ty === 'candycane') { for (let j = 0; j < 9; j += 1) P(j % 2 ? '#fa5252' : '#ffffff', x, y - 9 + j, 2, 1); P('#fa5252', x + 2, y - 10, 2, 1); P('#ffffff', x + 4, y - 9, 1, 2); return; }
  if (ty === 'puddle') return;
  if (ty === 'stone') { blob('#ced4da', '#868e96', '#495057'); P('#495057', x - 3, y - 4, 7, 1); return; }
  if (ty === 'boulder') { blob('#a8a29e', '#78716c', '#57534e', 11, 9); P('#ff6b1a', x + 2, y - 3); return; }
  // rock and anything else
  blob('#ced4da', '#868e96', '#495057');
}

/** Scenery along the back of the hill. */
function drawProp(P, kind, x, y, [c1, c2, c3], t, hill) {
  const snowy = hill.snowy;
  if (kind === 'pine' || kind === 'spruce') {
    P(c3, x, y - 3, 2, 4);
    for (let j = 0; j < 16; j += 1) { const w = 1 + Math.floor(((j % 6) + j / 3) / 1.6); P(j % 6 < 2 ? c1 : c2, x + 1 - w, y - 19 + j, w * 2, 1); if (snowy && j % 6 === 0) P('#ffffff', x + 1 - w, y - 19 + j, w * 2, 1); }
    return;
  }
  if (kind === 'oak' || kind === 'kapok') { P(c3, x, y - 8, 2, 9); for (let j = 0; j < 9; j += 1) { const w = Math.round(6 * Math.sin(((j + 1) / 10) * Math.PI)); P(j < 3 ? c1 : c2, x + 1 - w, y - 17 + j, w * 2, 1); } if (snowy) P('#ffffff', x - 3, y - 17, 8, 1); return; }
  if (kind === 'bush' || kind === 'fern' || kind === 'grass' || kind === 'kelp') { for (let i = -3; i <= 3; i += 1) P(i % 2 ? c1 : c2, x + i, y - 3 - Math.abs(3 - Math.abs(i)) - (kind === 'kelp' ? Math.round(Math.sin(t * 2 + i) * 1) + 4 : 0), 1, 4 + Math.abs(3 - Math.abs(i)) + (kind === 'kelp' ? 4 : 0)); if (snowy) P('#ffffff', x - 2, y - 5, 5, 1); return; }
  if (kind === 'palm') { P(c3, x, y - 14, 2, 15); for (let i = 0; i < 7; i += 1) { P(c1, x - 6 + i, y - 15 + Math.abs(3 - i) / 2, 1, 1); P(c1, x + 1 + i, y - 15 + Math.abs(3 - i) / 2, 1, 1); } P(c1, x - 1, y - 16, 4, 2); return; }
  if (kind === 'banner' || kind === 'flag') { P('#495057', x, y - 16, 1, 17); P(kind === 'flag' ? '#fa5252' : '#c92a2a', x + 1, y - 16, 6, 4); P('#ffd43b', x + 3, y - 15, 1, 2); return; }
  if (kind === 'wall') { P(c1, x - 8, y - 9, 17, 10); for (let i = 0; i < 4; i += 1) P(c1, x - 8 + i * 5, y - 12, 3, 3); P(c2, x - 8, y - 5, 17, 1); P(c2, x - 2, y - 9, 1, 4); return; }
  if (kind === 'hay') { P('#e9c46a', x - 4, y - 6, 9, 6); P('#c9a227', x - 4, y - 3, 9, 1); return; }
  if (kind === 'shell') { P('#ffd8a8', x - 2, y - 2, 5, 2); P('#ff922b', x, y - 3); return; }
  if (kind === 'coral') { P(c1, x, y - 10, 2, 10); P(c1, x - 3, y - 7, 2, 5); P(c1, x + 3, y - 8, 2, 6); P(c1, x - 3, y - 3, 8, 2); return; }
  if (kind === 'anemone') { for (let i = -3; i <= 3; i += 1) P(c2, x + i + Math.round(Math.sin(t * 3 + i)), y - 6, 1, 5); P(c1, x - 3, y - 2, 7, 2); return; }
  if (kind === 'steam') { const k = Math.floor(t * 2) % 3; P('#495057', x - 2, y - 1, 5, 2); P('#f1f3f5', x - 1 + k, y - 5 - k, 2, 2); P('#ced4da', x - k, y - 9 - k, 2, 2); return; }
  if (kind === 'rock') { P('#868e96', x - 4, y - 5, 9, 5); P('#ced4da', x - 3, y - 5, 4, 1); if (snowy) P('#ffffff', x - 4, y - 6, 9, 1); return; }
  if (kind === 'vine') { for (let j = 0; j < 14; j += 1) P(j % 4 ? c2 : c1, x + Math.round(Math.sin(j / 3 + t) * 1), y - 30 + j); return; }
  if (kind === 'iceblock') { P('#d0ebff', x - 5, y - 7, 11, 7); P('#ffffff', x - 4, y - 7, 4, 1); P('#74c0fc', x + 3, y - 6, 1, 5); return; }
  if (kind === 'crystal') { P(c1, x, y - 9, 2, 9); P(c1, x - 3, y - 6, 2, 6); P(c1, x + 3, y - 5, 2, 5); P('#e3fafc', x, y - 9, 1, 3); return; }
  if (kind === 'dish') { P('#adb5bd', x, y - 6, 1, 6); P('#e9ecef', x - 4, y - 10, 9, 2); P('#ced4da', x - 3, y - 8, 7, 1); return; }
  if (kind === 'cloud') { P('#ffffff', x - 6, y - 26, 13, 3); P('#ffffff', x - 3, y - 28, 7, 2); return; }
  if (kind === 'lollipop') { P('#ffffff', x, y - 10, 1, 10); P('#ff8cc6', x - 3, y - 15, 7, 6); P('#ffffff', x - 1, y - 13, 3, 1); return; }
  if (kind === 'deadtree') { P(c3, x, y - 12, 2, 13); P(c3, x - 3, y - 10, 3, 1); P(c3, x - 4, y - 12, 1, 2); P(c3, x + 2, y - 8, 3, 1); P(c3, x + 4, y - 10, 1, 2); P(c3, x + 1, y - 14, 1, 2); return; }
  if (kind === 'mushroom') { P('#fff5f5', x - 1, y - 5, 3, 5); P('#ffc9c9', x - 4, y - 8, 9, 3); P('#ff8787', x - 2, y - 8); P('#ff8787', x + 2, y - 7); return; }
  if (kind === 'star') { const c = Math.floor(t * 2 + x) % 2 ? '#ffd43b' : '#fff3bf'; P(c, x, y - 30, 1, 5); P(c, x - 2, y - 28, 5, 1); return; }
  if (kind === 'planet') { P('#9775fa', x - 3, y - 34, 7, 7); P('#ffd43b', x - 6, y - 31, 13, 1); return; }
  if (kind === 'comet') { P('#ffffff', x, y - 32, 2, 2); for (let i = 1; i < 6; i += 1) P(i < 3 ? '#fff3bf' : '#d0bfff', x - i * 2, y - 32 + i, 2, 1); return; }
  P(c1, x - 2, y - 4, 5, 4);
}
