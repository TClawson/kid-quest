// Ski race with a visiting buddy (skis, Taylor 2026-11-21): race down the map's hill and find
// its hidden shortcuts. Top-down, the hill runs to the right.
//
// Hold a finger anywhere and slide it up or down to steer; your buddy carves toward the line
// you drew. Once it's on that line, holding still is a tuck: straight and fastest. Lift your
// finger and it snowploughs (slows down). Gates in a row add speed; skimming past a rock
// gives a "Whoosh!" boost; hitting one is a quick spin that costs half your speed.
//
// Three of the hill's six shortcuts are open each race (shortcutsFor): the trail swings away
// and a hidden lane goes straight on through the trees, marked only by a clue at the edge of
// the trail (tracks, a sparkle, a sign, a gap). Each lane is a little challenge (see
// skicourses.js); ski it clean for the most time saved and a better badge in the shortcut book.
// Sometimes the visitor knows one and heads for it with a "!": follow them in!
//
// The visitor is kept close (rubber band), so most races are decided near the end.
// Better skis are faster, turn sharper, see clues from farther, get boosts, and (Super) see
// more of the hill with an arrow to the nearest shortcut. Each map has its own twist
// (COURSES[map].mech): tide, current, low gravity, stone alleys, steam vents and lava, mud,
// crevasses, boost pads, gravity wells.
//
// Same interface as Play in play.js (tap, drag, step, draw, drawHud, score, phase), plus
// up() when the steering finger lifts and onButton/press for the boost button.
import { Player, playLook, canvas, clamp } from './play.js';
import { addPop } from './meter.js';
import { HILLS, hillFor, hillSpeed, snowOfDay, snowWords, SNOW_KINDS, SURFACES, rng, hash } from './slopes.js';
import { courseFor, skiGear, RARITY } from './skicourses.js';
import { recordRace, foundIds, hillBest, hillCount, BADGE_NAMES } from './skibook.js';
import { seasonOf } from './seasons.js';

export const BASE_SPEED = 100; // pixels a second on a normal hill
export const BAND = 124; // how tall the hill is (pixels across)
export const TRAIL_HW = 22; // half the trail's width
export const SECTION_LEN = 420;
export const SECTIONS = [700, 1800, 2900];
export const RACE_LEN = 4000;
const LANE_HW = 7; // half a shortcut lane's width
const TURN = 2.6; // radians a second
const MAX_HEAD = 0.9;
const TREE_LINE = 9; // past the trail's edge this far, you're in the trees
const NEAR = 6; // a "Whoosh!" for passing this close to a rock
const LEAD = 0.28; // where your buddy sits across the screen
const TOP = 22;
export const AI_SKILL = 0.95; // the visitor's speed next to a kid tucking all the way // pixels at the top kept for the title and the race strip
export const SPEEDS = { tunnel: 1.3, jump: 1.35, ice: 1.5, bridge: 1.32, ride: 1.6 };

const lerp = (a, b, k) => a + (b - a) * k;

/** A copy of a picture with a 1 px dark outline (all sides) or a dark bottom/right edge ('br'). */
function outlined(src, mode) {
  const w = src.width; const h = src.height;
  const a = src.getContext('2d').getImageData(0, 0, w, h).data;
  const solid = (x, y) => x >= 0 && y >= 0 && x < w && y < h && a[(y * w + x) * 4 + 3] > 200;
  const out = canvas(w + 2, h + 2); const g = out.getContext('2d');
  g.fillStyle = '#1b1430';
  for (let y = -1; y <= h; y += 1) for (let x = -1; x <= w; x += 1) {
    if (solid(x, y)) continue;
    const touch = mode === 'all' ? solid(x - 1, y) || solid(x + 1, y) || solid(x, y - 1) || solid(x, y + 1) : solid(x - 1, y) || solid(x, y - 1);
    if (touch) g.fillRect(x + 1, y + 1, 1, 1);
  }
  g.drawImage(src, 1, 1);
  if (mode === 'br') { g.globalCompositeOperation = 'source-atop'; g.globalAlpha = 0.55; g.drawImage(out, 0, 0); }
  return out;
}

/** Trees and plants a map draws in the race, when they differ from the shared hill (Fable's art review). */
const SKI_PROPS = {
  'bg-castle': { props: ['oak', 'wall', 'hay', 'banner'], pal: ['#2f9e44', '#1b5e20', '#8b5a2b'] },
  'bg-volcano': { props: ['deadtree', 'rock', 'vent', 'fern'], pal: ['#2b8a3e', '#1b5e20', '#5c3d1e'] },
  'bg-sunset': { props: ['palm', 'grass', 'shell', 'palm'] },
  'bg-galaxy': { props: ['star', 'planet', 'comet', 'star'] },
};

/**
 * Which shortcuts are open: three of the six. Uncommon ones turn up about half as often as
 * common ones; the legendary one only on its own snow kind, at the skis' legend odds. The
 * first slot leans toward one the kid hasn't found yet, so a collection never stalls.
 */
export function shortcutsFor(map, snow, tier, found = new Set(), r = Math.random) {
  const list = courseFor(map).shortcuts;
  const gear = skiGear(tier);
  const legend = list.find((s) => s.rarity === 'legendary');
  const picks = [];
  if (legend && legend.snow === snow && r() < gear.legend) picks.push(legend);
  let pool = list.filter((s) => s.rarity !== 'legendary');
  while (picks.length < 3 && pool.length) {
    const lean = picks.length === 0 || (picks.length === 1 && picks[0] === legend);
    const w = pool.map((s) => RARITY[s.rarity] * (lean && !found.has(s.id) ? 4 : 1));
    let x = r() * w.reduce((a, b) => a + b, 0);
    let i = 0;
    while (i < pool.length - 1 && x > w[i]) { x -= w[i]; i += 1; }
    picks.push(pool[i]);
    pool = pool.filter((s) => s !== pool[i]);
  }
  // shuffle so the legendary one isn't always first
  for (let i = picks.length - 1; i > 0; i -= 1) { const j = Math.floor(r() * (i + 1)); [picks[i], picks[j]] = [picks[j], picks[i]]; }
  return picks;
}

/**
 * The whole run, the same for a seed (pure, no DOM). opts: { map, season, snow, tier, found, seed, visTakes }.
 * Coordinates: x runs down the hill (0 to len), y across it (0 to BAND).
 */
export function makeCourse(opts) {
  const r = rng(hash(`ski:${opts.seed}`));
  const hill = hillFor(opts.map, opts.season);
  const course = courseFor(hill.id);
  const mech = course.mech || {};
  const hw = TRAIL_HW * (mech.width || 1);
  const M = BAND / 2;
  const A = M - hw - 3; // how far the trail swings away at a shortcut
  const ph = [r() * 6, r() * 6, r() * 6];
  // big, slow zigzags (Taylor, 2026-11-21: more swing, not more often), a different rhythm each race
  const zigLen = 230 + r() * 110; const zigAmp = M - hw - 4;
  const picks = shortcutsFor(hill.id, opts.snow, opts.tier, opts.found, r);
  const visSlot = opts.visTakes == null ? (r() < 0.35 ? Math.floor(r() * 3) : -1) : opts.visTakes;
  const sections = SECTIONS.map((sx0, i) => {
    const side = r() < 0.5 ? -1 : 1;
    const sc = picks[i];
    const sx = Math.round(sx0 + (r() * 2 - 1) * 60);
    const len = Math.round(360 + r() * 120);
    // the way in is at the trail's edge, where the trail starts to swing away
    const yc = M + side * A * Math.sin(Math.PI * 24 / len) - side * (Math.min(hw, TRAIL_HW) - LANE_HW);
    // the hidden lane bends away from the trail, in a bow or a wave
    const bend = 6 + r() * 10; const wave = r() < 0.5;
    const y = (x) => { const u = clamp((x - sx) / len, 0, 1); return yc - side * bend * Math.sin(Math.PI * u) + (wave ? side * 6 * Math.sin(2 * Math.PI * u) * Math.sin(Math.PI * u) : 0); };
    const s = { i, sx, len, side, yc, y, hw: sc.kind === 'bridge' ? 4 : LANE_HW, sc, kind: sc.kind, vis: i === visSlot, posts: [], ramp: null };
    if (sc.kind === 'tunnel') for (let k = 0; k < 3; k += 1) { const px = sx + 100 + k * ((len - 160) / 2); s.posts.push({ x: px, y: y(px) + (k % 2 ? 3 : -3) }); }
    if (sc.kind === 'jump') s.ramp = { x: sx + 24, w: 18, land: sx + len - 70 };
    return s;
  });
  const fade = (x) => {
    let d = Infinity;
    for (const s of sections) {
      if (x >= s.sx && x <= s.sx + s.len) return 0;
      d = Math.min(d, Math.abs(x - s.sx), Math.abs(x - s.sx - s.len));
    }
    return clamp(d / 110, 0, 1);
  };
  const walls = [];
  if (mech.walls) for (let x = 300; x < RACE_LEN - 200; x += 470) if (!sections.some((s) => x + 160 > s.sx - 40 && x < s.sx + s.len + 40)) walls.push({ x0: x, x1: x + 160 });
  const wallAt = (x) => walls.some((w) => x >= w.x0 && x <= w.x1);
  const halfWidth = (x) => (wallAt(x) ? 15 : hw);
  const center = (x) => {
    const w = fade(x) * Math.min(1, x / 200);
    let c = M + w * (zigAmp * (0.8 * Math.sin(x / zigLen + ph[0]) + 0.2 * Math.sin(x / 97 + ph[1])));
    for (const s of sections) if (x >= s.sx && x <= s.sx + s.len) c += s.side * A * Math.sin(Math.PI * (x - s.sx) / s.len);
    if (wallAt(x)) c = lerp(c, M, 0.6);
    return clamp(c, hw + 2, BAND - hw - 2);
  };
  // Snow (Taylor, 2026-11-21): all snow in winter (and on the glacier); otherwise a band of snow
  // wanders down the trail, thinner in spring and autumn and thinnest in summer, when snow
  // machines make it (and all year on the warm and pretend maps). Off the snow is slower.
  const warm = !HILLS[hill.id]?.winter;
  const full = hill.snowy;
  const snowHw = full ? hw : (opts.season === 'summer' || (warm && opts.season !== 'winter')) ? 8 : 12;
  const snowAt = (x) => (full ? center(x) : center(x) + (halfWidth(x) - snowHw - 2) * Math.sin(x / 150 + ph[2]));
  const machines = [];
  const inSection = (x, pad = 0) => sections.find((s) => x >= s.sx - pad && x <= s.sx + s.len + pad);
  // things on the main trail
  const free = (x, pad = 30) => x > 120 && x < RACE_LEN - 80 && !inSection(x, pad);
  if (!full) for (let x = 150; x < RACE_LEN; x += 210 + r() * 80) if (free(x, 10)) { const sd = snowAt(x) > center(x) ? 1 : -1; machines.push({ x, side: sd }); }
  const gates = []; const hazards = []; const ramps = []; const pads = []; const vents = []; const lava = []; const gaps = []; const wells = [];
  for (let x = 160; x < RACE_LEN - 100; x += 170 + r() * 60) {
    if (!free(x, 20)) continue;
    const c = full ? center(x) : snowAt(x); const h = full ? halfWidth(x) : snowHw + 6;
    gates.push({ x, y: c + (r() * 2 - 1) * Math.max(0, h - 12), hw: 8, i: gates.length });
  }
  const nearThing = (x, y, list, d) => list.some((o) => Math.abs(o.x - x) < d && (o.y == null || Math.abs(o.y - y) < d));
  const hazardKinds = hill.hazards;
  for (let x = 240; x < RACE_LEN - 120; x += 70 + r() * 60) {
    // a few rocks on the swing, too, so the long way isn't the easy way
    const sec = inSection(x, 10);
    if (sec && (x < sec.sx + 60 || x > sec.sx + sec.len - 60)) continue;
    const c = center(x); const h = halfWidth(x);
    const y = c + (r() * 2 - 1) * (h - 5);
    if (nearThing(x, y, gates, 24)) continue;
    hazards.push({ x, y, r: 4 + Math.round(r()), kind: hazardKinds[Math.floor(r() * hazardKinds.length)], near: false });
  }
  const per = (rate, fn) => { if (!rate) return; for (let x = 420; x < RACE_LEN - 200; x += (1000 / rate) * (0.6 + r() * 0.8)) if (free(x)) fn(x); };
  per(mech.ramps ?? 1.2, (x) => { const y = snowAt(x) + (r() * 2 - 1) * 4; if (!nearThing(x, y, hazards, 26)) ramps.push({ x, y, w: 14, hw: 9 }); });
  if (mech.pads) per(4, (x) => { const y = center(x) + (r() * 2 - 1) * (halfWidth(x) - 8); if (!nearThing(x, y, hazards, 16)) pads.push({ x, y, r: 6 }); });
  if (mech.vents) per(2.5, (x) => { const y = center(x) + (r() * 2 - 1) * (halfWidth(x) - 8); if (!nearThing(x, y, hazards, 16)) vents.push({ x, y, r: 5 }); });
  if (mech.lava) per(3, (x) => { const y = center(x) + (r() * 2 - 1) * (halfWidth(x) - 6); if (!nearThing(x, y, hazards, 18) && !nearThing(x, y, vents, 18)) lava.push({ x, y, r: 5 }); });
  if (mech.gaps) per(1.6, (x) => { const c = center(x); const h = halfWidth(x); gaps.push({ x, by: c + (r() * 2 - 1) * (h - 9), bw: 7 }); });
  if (mech.wells) per(1.8, (x) => { wells.push({ x, y: center(x) + (r() < 0.5 ? -1 : 1) * (halfWidth(x) + 4), r: 40 }); });
  // trees: everywhere off the trail. The hidden lanes run under the trees (they thin out when
  // you're in one); only each lane's way in is open, with something special to see there.
  const trees = [];
  const step = 9;
  for (let x = -60; x < RACE_LEN + 300; x += step) {
    for (let y = -70; y < BAND + 70; y += step) {
      const tx = x + r() * step; const ty = y + r() * step;
      const c = center(tx); const h = halfWidth(tx);
      if (Math.abs(ty - c) < h + 5) continue;
      const s = inSection(tx, 4);
      const ly = s ? s.y(tx) : 0;
      if (s && tx > s.sx - 4 && tx < s.sx + 34 && Math.abs(ty - ly) < s.hw + 6) continue; // the way in
      const over = s && tx > s.sx && Math.abs(ty - ly) < s.hw + 16 ? s.i : -1;
      // just below the trail, only low bushes, so tall crowns don't hide it
      const low = ty > c && ty - c < h + 17;
      // the start and finish areas stay open
      if (tx < 40 || tx > RACE_LEN - 10 && tx < RACE_LEN + 40) continue;
      // a thick hedge along the trail, thinner farther in (Fable's art review)
      const far = Math.abs(ty - c) > h + 25 && over < 0;
      if (far && r() < 0.35) continue;
      trees.push({ x: Math.round(tx), y: Math.round(ty), k: Math.floor(r() * 4), low: !!low, over });
    }
  }
  trees.sort((a, b) => a.y - b.y);
  const surface = full ? hill.surface : 'snow';
  return {
    hill, course, mech, snow: opts.snow, len: RACE_LEN, hw, M, center, halfWidth, wallAt, sections, inSection,
    gates, hazards, ramps, pads, vents, lava, gaps, wells, walls, trees, machines,
    full, snowHw, snowAt, surface,
    speed: BASE_SPEED * (full ? hillSpeed(hill, opts.snow) : SNOW_KINDS[opts.snow]?.speed || 1) * (mech.speed || 1),
    grip: SNOW_KINDS[opts.snow]?.grip || 1,
    air: 0.42 * (mech.air || 1),
    drift: mech.drift || 0,
  };
}

/** Points for the week chart: faster is more (1000 minus a tenth of a second each). */
export const racePoints = (secs) => Math.max(1, Math.round(1000 - secs * 10));

// ---------- a skier ----------
function rider(player, tier, y) {
  return Object.assign(player, {
    tier, gear: skiGear(tier), x: 20, y, v: 0, head: 0, aim: y, air: 0, airMax: 0, spin: 0, safe: 0,
    lane: null, clean: true, laneIn: 0, laneT: 0, laneStart: 0, runs: [], burst: 0, boostT: 0, chain: 0, nextGate: 0,
    done: null, marks: [], drift: 0, whoosh: 0,
  });
}

export class SkiRace {
  constructor(opts) {
    this.kind = 'race';
    this.W = opts.W; this.H = opts.H;
    this.opts = opts;
    this.day = opts.day || new Date().toISOString().slice(0, 10);
    this.map = opts.map || 'bg-meadow';
    this.season = opts.season || seasonOf(this.day);
    this.snow = opts.snow || snowOfDay(this.day);
    this.tier = opts.kid.gear?.skis || 1;
    this.visTier = opts.visitor.gear?.skis || 1;
    this.gear = skiGear(this.tier);
    this.book = opts.book || {};
    this.best = opts.best || 0;
    this.zoom = 1.2 * this.gear.zoom;
    this.Z = 1; this.fieldW = Math.round(this.W * this.zoom); this.fieldH = Math.round(this.H * this.zoom);
    this.holdAnywhere = false;
    this.locked = false;
    this.seed = opts.seed || 1;
    this.t = 0; this.pops = [];
    this.kidLook = playLook(opts.kid.buddy, opts.kid.gear, 'race');
    this.visLook = playLook(opts.visitor.buddy, opts.visitor.gear, 'race');
    this.kidName = opts.kid.name; this.visName = opts.visitor.name;
    this.sprites = new Map();
    this.reset();
  }

  reset() {
    this.seed = (this.seed * 7 + 13) % 1000003;
    this.found = foundIds(this.book, this.map);
    this.c = makeCourse({ map: this.map, season: this.season, snow: this.snow, tier: this.tier, found: this.found, seed: `${this.day}|${this.seed}`, visTakes: this.opts.visTakes });
    this.pal = this.c.hill.pal;
    this.kid = rider(new Player(this.kidLook, this.kidName, 11, 20, this.c.M + 8), this.tier, this.c.M + 8);
    this.vis = rider(new Player(this.visLook, this.visName, 23, 20, this.c.M - 8), this.visTier, this.c.M - 8);
    this.vis.aim = this.vis.y;
    this.kid.boosts = this.gear.boosts;
    this.phase = 'ready'; this.score = 0; this.newBest = false; this.overAt = 0; this.startT = 0; this.raceT = 0;
    this.touch = null; this.result = null;
    this.camX = 0; this.pops = [];
    this.rare = this.c.sections.some((s) => s.sc.rarity === 'legendary');
    this.fx = [];
  }

  // ---------- input ----------
  get viewW() { return this.fieldW; }
  get viewH() { return this.fieldH; }

  tap(x, y) {
    if (this.phase === 'ready') {
      if (this.locked) { addPop(this, 'No more games today!', this.W / 2, this.H / 2, '#ffa8a8', true); return; }
      this.phase = 'count'; this.countAt = this.t; this.sound = 'kick';
      return;
    }
    if (this.phase === 'over') {
      if (this.t - this.overAt > 1.2) this.reset();
      return;
    }
    // a finger down: steer from here
    this.touch = { y0: y, yNow: y, aim0: this.kid.y };
    this.kid.aim = this.kid.y;
  }

  drag(x, y) {
    if (!this.touch) return;
    this.touch.yNow = y;
    // relative steering: slide 1 px on screen to move the line 1.6 px on the hill
    this.kid.aim = clamp(this.touch.aim0 + (y - this.touch.y0) * 1.6 * this.zoom, 2, BAND - 2);
  }

  up() { this.touch = null; }

  /** Point a rider's line at y (after a crash), and re-anchor a held finger there so it
   * doesn't keep steering the buddy back into the trees. */
  aimAt(p, y) {
    p.aim = y;
    if (p === this.kid && this.touch) { this.touch.aim0 = y; this.touch.y0 = this.touch.yNow; }
  }
  release() { /* the boost button needs no release */ }

  boostButton() { return { x: this.W - 16, y: this.H - 16, r: 12 }; }
  onButton(x, y) {
    if (this.phase !== 'play' || !(this.kid.boosts > 0)) return false;
    const b = this.boostButton();
    return Math.hypot(x - b.x, y - b.y) <= b.r + 2;
  }

  press() {
    if (!(this.kid.boosts > 0) || this.kid.done) return;
    this.kid.boosts -= 1; this.kid.boostT = 1.5; this.kid.v *= 1.12;
    this.pop('Boost!', this.kid, '#74c0fc', true);
    this.sound = 'kick';
  }

  pop(text, p, color, big) {
    const [sx, sy] = this.toView(p.x, p.y);
    addPop(this, text, sx, sy - 16, color, big);
  }

  // ---------- the world on the screen ----------
  /** Hill coordinates to view pixels (the HUD's units, before zoom). */
  toView(x, y) { return [(x - this.camX) / this.zoom, (y - this.camY()) / this.zoom]; }
  camY() { return BAND / 2 - (this.fieldH + TOP * this.zoom) / 2; }

  // ---------- the clock ----------
  step(dt) {
    this.t += dt;
    if (this.phase === 'count') {
      if (this.t - this.countAt >= 2.4) { this.phase = 'play'; this.startT = this.t; this.sound = 'catch'; }
    } else if (this.phase === 'play' || this.phase === 'finish') {
      this.raceT = this.t - this.startT;
      for (const p of [this.kid, this.vis]) this.ride(p, dt, p === this.kid ? this.kidControl() : this.think(p));
      if (this.phase === 'play' && this.kid.done) { this.phase = 'finish'; this.finishAt = this.t; }
      if (this.phase === 'finish' && (this.vis.done || this.t - this.finishAt > 2.5)) this.end();
    }
    this.camX = lerp(this.camX, this.kid.x - this.fieldW * LEAD, 1 - Math.exp(-dt * 8));
    if (this.phase === 'ready') this.camX = this.kid.x - this.fieldW * 0.12;
    if (this.phase === 'count') this.camX = lerp(this.camX, this.kid.x - this.fieldW * LEAD, 1 - Math.exp(-dt * 3));
    for (const f of this.fx) { f.life -= dt; f.x += f.vx * dt; f.y += f.vy * dt; }
    this.fx = this.fx.filter((f) => f.life > 0);
  }

  kidControl() {
    return { touching: !!this.touch, aim: this.kid.aim };
  }

  /** The visitor's line: the middle of the trail ahead, around rocks, or into the shortcut it knows. */
  think(p) {
    const c = this.c;
    const ahead = p.x + 34;
    let aim = c.snowAt(ahead);
    const sec = c.sections.find((s) => s.vis && ahead > s.sx - 60 && p.x < s.sx + s.len);
    if (sec || p.lane) aim = (p.lane || sec).y(Math.max(ahead, (p.lane || sec).sx + 24));
    if (sec && !p.called && p.x > sec.sx - 140) { p.called = sec.i; this.pop('!', p, '#ffd43b', true); }
    if (!sec && !p.lane) {
      for (const h of c.hazards) {
        if (h.x > p.x && h.x < p.x + 46 && Math.abs(h.y - aim) < h.r + 6) aim = h.y + (aim > h.y ? 1 : -1) * (h.r + 7);
      }
      const g = c.gates.find((g) => g.x > p.x + 10 && g.x < p.x + 70);
      if (g) aim = lerp(aim, g.y, 0.7);
      aim += Math.sin(this.t * 1.3 + 2) * 2.5; // nobody skis a perfect line
    }
    return { touching: true, aim, ai: true };
  }

  /** One rider for dt seconds. ctl: { touching, aim }. */
  ride(p, dt, ctl) {
    const c = this.c;
    if (p.done) { p.v = lerp(p.v, 0, 1 - Math.exp(-dt * 2)); p.x += p.v * dt; p.run = 0; return; }
    const g = p.gear;
    p.safe = Math.max(0, p.safe - dt);
    p.wallT = Math.max(0, (p.wallT || 0) - dt);
    p.boostT = Math.max(0, p.boostT - dt);
    p.burst = Math.max(0, p.burst - dt);
    p.whoosh = Math.max(0, p.whoosh - dt);
    // where the trail is
    const ch = c.center(p.x); const hh = c.halfWidth(p.x);
    const lane = p.lane;
    // steering
    let wantHead = 0;
    if (p.spin > 0) {
      p.spin -= dt;
      wantHead = 0;
    } else if (p.air <= 0) {
      if (ctl.touching) wantHead = clamp(Math.atan2(ctl.aim - p.y, 28), -MAX_HEAD, MAX_HEAD);
      // fingers off in the deep snow: the buddy turns back toward the trail by itself
      else if (!lane && Math.abs(p.y - ch) > hh) wantHead = clamp(Math.atan2(ch - p.y, 60), -MAX_HEAD * 0.6, MAX_HEAD * 0.6);
      let turn = TURN * g.turn * (c.mech.turn || 1) * (0.6 + 0.4 * c.grip);
      if (lane?.kind === 'ice') turn *= 0.45;
      const d = wantHead - p.head;
      p.head += clamp(d, -turn * dt, turn * dt);
    }
    const tuck = ctl.touching && Math.abs(ctl.aim - p.y) < 2.5 && Math.abs(p.head) < 0.12;
    // how fast it wants to go
    let vt = c.speed * g.speed;
    if (p.spin > 0) vt *= 0.5;
    else if (ctl.ai) vt *= AI_SKILL * this.band() * Math.sqrt(this.kid.gear.speed / g.speed) * (1 - 0.15 * Math.abs(Math.sin(p.head)));
    else if (!ctl.touching) vt *= 0.55; // snowplough
    else if (tuck) vt *= 1;
    else vt *= 0.9 - 0.3 * Math.abs(Math.sin(p.head));
    vt *= 1 + Math.min(0.12, 0.03 * p.chain);
    if (p.boostT > 0) vt *= 1.35;
    if (p.burst > 0) vt *= 1.3;
    if (p.whoosh > 0) vt *= 1.06;
    // off the trail: deep snow, then trees
    const off = lane ? 0 : Math.max(0, Math.abs(p.y - ch) - hh);
    if (off > 0 && p.air <= 0) vt *= c.snow === 'slushy' ? 0.7 : 0.8;
    // off the snow band (outside winter): grass, sand or mud is slower
    p.offSnow = !c.full && !lane && p.air <= 0 && off <= 0 && Math.abs(p.y - c.snowAt(p.x)) > c.snowHw;
    if (p.offSnow) vt *= 0.72;
    if (c.mech.tide && Math.abs(p.y - this.tideAt(p.x)) < 6) vt *= 1.15;
    if (lane) {
      if (lane.kind === 'ride') {
        const ly = this.rideLane(lane, p.x);
        const inLane = Math.abs(p.y - ly) < 3.5;
        vt *= inLane ? SPEEDS.ride : 1.15;
        p.laneT += dt; if (inLane) p.laneIn += dt;
      } else vt *= SPEEDS[lane.kind];
    }
    const k = 1 - Math.exp(-dt * 1.1 * (0.5 + 0.5 * c.grip));
    p.v = lerp(p.v, vt, p.air > 0 ? 0 : k);
    // moving
    const px = p.x;
    p.x += p.v * Math.cos(p.head) * dt;
    p.y += p.v * Math.sin(p.head) * dt;
    if (c.drift && !lane && p.air <= 0 && p.spin <= 0 && p.safe <= 0) {
      const dir = Math.floor(p.x / 600) % 2 ? 1 : -1;
      p.y += dir * c.drift * dt;
    }
    for (const w of c.wells) {
      const dx = w.x - p.x; const dy = w.y - p.y; const d = Math.hypot(dx, dy);
      if (d < w.r && d > 3 && !lane && p.spin <= 0) p.y += (dy / d) * 22 * (1 - d / w.r) * dt;
    }
    p.y = clamp(p.y, 1, BAND - 1);
    // in the air
    if (p.air > 0) {
      p.air -= dt;
      p.lift = Math.round(Math.sin(Math.PI * (1 - p.air / p.airMax)) * 12);
      if (p.air <= 0) { p.air = 0; p.lift = 0; this.land(p); }
    } else p.lift = 0;
    p.run = p.spin > 0 ? 0 : tuck ? 0 : 0.4;
    if (p.spin > 0) p.face = Math.floor(this.t * 14) % 2 ? 1 : -1; else p.face = 1;
    this.lanes(p, px);
    if (p.air <= 0 && p.spin <= 0) this.bumps(p, px, off);
    this.gatesFor(p, px);
    // spray from the ski tails on hard turns and braking
    if (p.air <= 0 && p.spin <= 0 && (Math.abs(wantHead - p.head) > 0.25 || (!ctl.touching && p.v > 40)) && Math.random() < 0.8) {
      const side = p.head >= 0 ? -1 : 1;
      for (let i = 0; i < 2; i += 1) this.fx.push({ x: p.x - 7, y: p.y + side * 2, vx: -10 - Math.random() * 25, vy: side * (10 + Math.random() * 25), life: 0.35, color: this.tint(this.pal.ground[0], 0.5) });
    }
    // marks in the snow
    if (p.air <= 0 && Math.floor(p.x / 2) !== Math.floor(px / 2)) {
      p.marks.push({ x: p.x, y: p.y, at: this.t });
      if (p.marks.length > 160) p.marks.shift();
      if (p.gear.trail !== 'plain' && Math.random() < 0.5) {
        this.fx.push({ x: p.x - 4, y: p.y + (Math.random() - 0.5) * 4, vx: -20 - Math.random() * 20, vy: (Math.random() - 0.5) * 20, life: 0.4, color: p.gear.trail === 'gold' ? '#ffd43b' : '#a5d8ff' });
      }
    }
    if (p.x >= c.len && !p.done) {
      p.done = this.raceT;
      if (p === this.kid) this.sound = this.vis.done ? 'over' : 'catch';
    }
  }

  /** How much the visitor speeds up when behind and eases off when ahead. */
  band() {
    const d = this.kid.x - this.vis.x;
    return clamp(1 + d / 900, 0.9, 1.2);
  }

  tideAt(x) { return this.c.center(x) + Math.sin(x / 140) * (this.c.hw - 6); }
  rideLane(s, x) { return s.y(x) + 3 * Math.sin((x - s.sx) / 38); }

  /** Shortcut lanes: going in, the challenge, coming out. */
  lanes(p, px) {
    const c = this.c;
    if (!p.lane) {
      for (const s of c.sections) {
        const gate = s.sx + 24;
        if (px < gate && p.x >= gate && Math.abs(p.y - s.y(gate)) <= s.hw + 1.5) {
          p.lane = s; p.clean = true; p.laneIn = 0; p.laneT = 0; p.laneStart = this.raceT;
          if (p === this.kid) {
            const isNew = !this.found.has(s.sc.id) && !p.runs.some((r) => r.id === s.sc.id);
            this.pop(isNew ? `Shortcut! ${s.sc.name}` : s.sc.name, p, isNew ? '#ffd43b' : '#ffffff', isNew);
            this.sound = isNew ? 'catch' : 'kick';
            this.buzz = isNew ? [20, 40, 20] : null;
          }
        }
      }
      return;
    }
    const s = p.lane;
    // the jump: centered on the ramp flies all the way to the landing; off-center lands short
    if (s.ramp && px < s.ramp.x + s.ramp.w && p.x >= s.ramp.x + s.ramp.w && p.air <= 0) {
      const good = Math.abs(p.y - s.y(p.x)) < 4;
      const dist = good ? s.ramp.land - p.x : (s.ramp.land - p.x) * 0.55;
      p.airMax = p.air = dist / Math.max(40, p.v);
      p.v *= 1.05; p.head = 0;
      p.jumpGood = good;
      if (p === this.kid) this.pop(good ? 'Big air!' : 'Wobbly!', p, good ? '#b2f2bb' : '#ffe066');
    }
    // posts in the tunnel
    for (const o of s.posts) {
      if (!o.hit?.has(p) && Math.abs(o.x - p.x) < 3 && Math.abs(o.y - p.y) < 3) {
        (o.hit ||= new Set()).add(p);
        this.laneBump(p, 'Bonk!');
      }
    }
    // the walls of the lane
    const ly = s.y(p.x);
    if (p.air <= 0 && p.x < s.sx + s.len - 6 && Math.abs(p.y - ly) > s.hw) {
      if (s.kind === 'bridge') {
        this.tumble(p, 'Splash!');
        p.clean = false;
        p.y = ly; p.head = 0;
      } else {
        const side = Math.sign(p.y - ly);
        p.y = ly + side * s.hw;
        p.head *= -0.3;
        // a scrape along the wall slows you once, not every frame; and the line moves off it
        if (!(p.wallT > 0)) { this.laneBump(p, 'Bump!'); p.wallT = 0.6; }
        if (p.aim != null && Math.abs(p.aim - ly) > s.hw - 1) this.aimAt(p, ly + side * (s.hw - 2));
      }
    }
    if (p.x >= s.sx + s.len) {
      if (s.kind === 'ride' && p.laneT > 0 && p.laneIn / p.laneT < 0.75) p.clean = false;
      if (s.kind === 'tunnel' && p.clean) p.burst = 1.2;
      const secs = Math.round((this.raceT - p.laneStart) * 10) / 10;
      if (p === this.kid) {
        p.runs.push({ id: s.sc.id, clean: p.clean, secs });
        this.pop(p.clean ? 'Clean run!' : 'Made it!', p, p.clean ? '#b2f2bb' : '#e9ecef');
      }
      p.lane = null;
    }
  }

  laneBump(p, word) {
    if (p.clean && p === this.kid) this.pop(word, p, '#ffa8a8');
    p.clean = false; p.v *= 0.75; this.buzz = 30;
  }

  land(p) {
    const s = p.lane;
    const c = this.c;
    // a wobbly landing is a short crash: up again on the lane's line, then on you go
    if (s?.ramp && !p.jumpGood) {
      const ly = s.y(p.x);
      p.y = clamp(p.y, ly - s.hw + 1, ly + s.hw - 1);
      this.tumble(p, 'Oof!');
      this.aimAt(p, ly);
      return;
    }
    // landing off the trail: crash, get up at the edge of the deep snow, and head back
    if (!s) {
      const ch = c.center(p.x); const hh = c.halfWidth(p.x);
      const off = Math.abs(p.y - ch) - hh;
      if (off > 0) {
        const side = Math.sign(p.y - ch);
        p.y = ch + side * (hh + Math.min(off, TREE_LINE - 3));
        this.tumble(p, 'Crash!');
        this.aimAt(p, ch + side * (hh - 4));
      }
    }
    // the volcano's lava and the fjord's crevasses are only safe in the air
  }

  /** Rocks, trees, lava, crevasses, steam vents, boost pads, ramps. */
  bumps(p, px, off) {
    const c = this.c;
    if (!p.lane && off > TREE_LINE) {
      this.tumble(p, 'Timber!');
      const ch = c.center(p.x); const hh = c.halfWidth(p.x);
      p.y = ch + Math.sign(p.y - ch) * (hh - 3); p.head = 0;
      this.aimAt(p, p.y);
      return;
    }
    if (!p.lane && c.wallAt(p.x) && Math.abs(p.y - c.center(p.x)) > c.halfWidth(p.x) - 1) {
      const ch = c.center(p.x);
      p.y = ch + Math.sign(p.y - ch) * (c.halfWidth(p.x) - 1); p.head *= -0.4; p.v *= 0.85;
      if (p === this.kid && !p.wallPop) { this.pop('Clunk!', p, '#ffa8a8'); p.wallPop = 1; setTimeout(() => { p.wallPop = 0; }, 600); }
    }
    if (p.lane) return;
    for (const h of c.hazards) {
      if (Math.abs(h.x - p.x) > h.r + NEAR + 2) continue;
      const d = Math.hypot(h.x - p.x, (h.y - p.y) * 1.2);
      if (d < h.r + 1.5) { if (p.safe <= 0) this.tumble(p, 'Oops!'); }
      else if (d < h.r + NEAR && !h.near && p.x > h.x && p === this.kid) {
        h.near = true; p.whoosh = 0.6; p.v *= 1.05;
        this.pop('Whoosh!', p, '#a5d8ff');
        this.sound = 'kick';
      }
    }
    for (const l of c.lava) if (Math.hypot(l.x - p.x, l.y - p.y) < l.r && p.safe <= 0) this.tumble(p, 'Hot hot!');
    for (const gp of c.gaps) {
      if (px < gp.x && p.x >= gp.x && Math.abs(p.y - gp.by) > gp.bw && p.safe <= 0) this.tumble(p, 'Whoa!');
    }
    for (const v of c.vents) if (Math.hypot(v.x - p.x, v.y - p.y) < v.r && p.air <= 0) { p.airMax = p.air = c.air * 1.4; if (p === this.kid) this.pop('Steam lift!', p, '#e9ecef'); }
    for (const pd of c.pads) if (Math.hypot(pd.x - p.x, pd.y - p.y) < pd.r && !(pd.used?.has(p))) { (pd.used ||= new Set()).add(p); p.burst = Math.max(p.burst, 0.8); if (p === this.kid) this.pop('Zoom!', p, '#ffc9e9'); }
    for (const rp of c.ramps) {
      if (px < rp.x + rp.w && p.x >= rp.x + rp.w && Math.abs(p.y - rp.y) < rp.hw) {
        p.airMax = p.air = c.air;
        if (p === this.kid) this.pop('Jump!', p, '#ffffff');
      }
    }
  }

  tumble(p, word) {
    if (p.spin > 0) return;
    p.spin = p.gear.recover * (this.c.snow === 'powder' ? 0.8 : 1);
    p.v *= 0.5; p.safe = p.spin + 0.8; p.chain = 0; p.head = 0;
    if (p.lane) p.clean = false;
    if (p === this.kid) { this.pop(word, p, '#ffa8a8'); this.buzz = 60; this.sound = 'drop'; }
    for (let i = 0; i < 8; i += 1) this.fx.push({ x: p.x, y: p.y, vx: (Math.random() - 0.5) * 50, vy: (Math.random() - 0.5) * 50, life: 0.5, color: SURFACES[this.c.surface]?.spray || '#fff' });
  }

  gatesFor(p, px) {
    for (const g of this.c.gates) {
      if (px < g.x && p.x >= g.x) {
        if (Math.abs(p.y - g.y) <= g.hw) {
          p.chain += 1;
          if (p === this.kid) {
            (this.passed ||= new Map()).set(g.i, this.t); this.pop(p.chain > 1 ? `Gate x${p.chain}` : 'Gate!', p, '#ffe066'); this.sound = 'kick'; }
        } else if (p.chain) {
          p.chain = 0;
        }
      }
    }
  }

  end() {
    this.phase = 'over'; this.overAt = this.t;
    const kt = this.kid.done || this.raceT;
    const won = !!this.kid.done && (!this.vis.done || this.kid.done <= this.vis.done);
    this.time = Math.round(kt * 10) / 10;
    this.won = won;
    this.score = racePoints(this.time);
    this.newBest = this.score > this.best;
    if (this.newBest) this.best = this.score;
    const got = recordRace(this.book, { map: this.c.hill.id, snow: this.snow, time: this.time, won, runs: this.kid.runs }, this.day);
    this.book = got.book;
    this.result = { won, time: this.time, by: Math.abs((this.vis.done || this.raceT) - kt), news: got.news, bestTime: got.bestTime };
    this.opts.onBook?.(got.book, this.result);
    this.sound = won ? 'over' : 'drop';
  }

  // ---------- drawing ----------
  /** A cached picture. outline: 'all' rings it in dark pixels, 'br' darkens its bottom and right edges. */
  sprite(key, w, h, paint, outline = null) {
    let s = this.sprites.get(key);
    if (!s) {
      s = canvas(w, h); paint(s.getContext('2d'));
      if (outline) s = outlined(s, outline);
      this.sprites.set(key, s);
    }
    return s;
  }

  draw(ctx) {
    const c = this.c; const pal = this.pal;
    const VW = this.fieldW; const VH = this.fieldH;
    const cx = Math.round(this.camX); const cy = Math.round(this.camY());
    ctx.imageSmoothingEnabled = false;
    // deep ground under the trees, a step darker than the trail
    ctx.fillStyle = this.tint(pal.ground[1], -0.14);
    ctx.fillRect(0, 0, VW, VH);
    // the trail, column by column
    for (let sx = 0; sx < VW; sx += 1) {
      const x = sx + cx;
      const ch = c.center(x); const hh = c.halfWidth(x);
      // scalloped edges, a bright bank on top and a shadow below
      const sc = Math.round(Math.abs(Math.sin(x / 3.1)) * 1.6);
      const top = Math.round(ch - hh - cy) + sc; const bot = Math.round(ch + hh - cy) - sc;
      ctx.fillStyle = pal.ground[1]; ctx.fillRect(sx, top - 3, 1, bot - top + 6);
      ctx.fillStyle = pal.ground[0];
      ctx.fillRect(sx, top, 1, bot - top);
      ctx.fillStyle = this.tint(pal.ground[0], 0.35); ctx.fillRect(sx, top, 1, 2);
      ctx.fillStyle = this.tint(pal.ground[2], -0.2); ctx.fillRect(sx, bot - 2, 1, 2);
      // groomer lines
      if (x % 7 === 0) { ctx.fillStyle = this.tint(pal.ground[0], -0.05); for (let yy = top + 5; yy < bot - 3; yy += 6) ctx.fillRect(sx, yy, 1, 1); }
      if (!c.full) {
        // the band of snow down the trail
        const sy = c.snowAt(x); const st = Math.round(sy - c.snowHw - cy) + (sc ? 1 : 0); const sb = Math.round(sy + c.snowHw - cy) - (sc ? 1 : 0);
        ctx.fillStyle = '#cfe0f0'; ctx.fillRect(sx, st, 1, sb - st + 1);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(sx, st, 1, sb - st - 1);
        if (x % 9 === 0) { ctx.fillStyle = '#e3edf7'; ctx.fillRect(sx, Math.round(sy - cy), 1, 1); }
      }
      if (c.mech.tide) { const ty = Math.round(this.tideAt(x) - cy); ctx.fillStyle = 'rgba(30,120,170,0.28)'; ctx.fillRect(sx, ty - 5, 1, 10); if ((x + Math.floor(this.t * 20)) % 9 === 0) { ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.fillRect(sx, ty - 5, 1, 1); } }
    }
    // shortcut lanes
    for (const s of c.sections) {
      if (s.sx + s.len < cx - 4 || s.sx > cx + VW + 4) continue;
      this.drawLane(ctx, s, cx, cy);
    }
    // the current, the wells
    if (c.drift) this.drawDrift(ctx, cx, cy, VW);
    for (const w of c.wells) this.drawWell(ctx, w.x - cx, w.y - cy);
    // things on the trail
    for (const gp of c.gaps) if (gp.x > cx - 10 && gp.x < cx + VW + 10) this.drawGap(ctx, gp, cx, cy);
    for (const l of c.lava) if (l.x > cx - 10 && l.x < cx + VW + 10) this.drawLava(ctx, l.x - cx, l.y - cy);
    for (const v of c.vents) if (v.x > cx - 10 && v.x < cx + VW + 10) this.drawVent(ctx, v.x - cx, v.y - cy);
    for (const pd of c.pads) if (pd.x > cx - 10 && pd.x < cx + VW + 10) this.drawPad(ctx, pd.x - cx, pd.y - cy);
    for (const rp of c.ramps) if (rp.x > cx - 20 && rp.x < cx + VW + 10) this.drawRamp(ctx, rp.x - cx, rp.y - cy, rp.w, rp.hw);
    for (const w of c.walls) if (w.x1 > cx && w.x0 < cx + VW) this.drawWalls(ctx, w, cx, cy);
    for (const g of c.gates) if (g.x > cx - 10 && g.x < cx + VW + 10) this.drawGateLine(ctx, g, cx, cy);
    // start and finish lines
    for (const [x, kind] of [[24, 'start'], [c.len, 'finish']]) if (x > cx - 10 && x < cx + VW + 10) this.drawLine(ctx, x - cx, cy, kind);
    // ski marks
    for (const p of [this.vis, this.kid]) this.drawMarks(ctx, p, cx, cy);
    // everything with height, back to front
    const things = [];
    const thin = this.kid.lane ? this.kid.lane.i : -1;
    for (const t of c.trees) if (t.x > cx - 10 && t.x < cx + VW + 10 && t.y > cy - 20 && t.y < cy + VH + 20) {
      if (t.over >= 0 && t.over === thin) things.push({ y: t.y, f: () => { ctx.globalAlpha = 0.28; this.drawTree(ctx, t, t.x - cx, t.y - cy); ctx.globalAlpha = 1; } });
      else things.push({ y: t.y, f: () => this.drawTree(ctx, t, t.x - cx, t.y - cy) });
    }
    for (const m of c.machines) if (m.x > cx - 20 && m.x < cx + VW + 20) { const my = c.center(m.x) + m.side * (c.halfWidth(m.x) + 4); things.push({ y: my, f: () => this.drawMachine(ctx, m, m.x - cx, my - cy) }); }
    for (const h of c.hazards) if (h.x > cx - 10 && h.x < cx + VW + 10) things.push({ y: h.y, f: () => this.drawHazard(ctx, h, h.x - cx, h.y - cy) });
    for (const g of c.gates) if (g.x > cx - 10 && g.x < cx + VW + 10) { things.push({ y: g.y - g.hw, f: () => this.drawFlag(ctx, g.x - cx, g.y - g.hw - cy, g.i) }); things.push({ y: g.y + g.hw, f: () => this.drawFlag(ctx, g.x - cx, g.y + g.hw - cy, g.i) }); }
    for (const s of c.sections) if (this.inside(s)) for (const o of s.posts) if (o.x > cx - 10 && o.x < cx + VW + 10) things.push({ y: o.y, f: () => this.drawPost(ctx, o.x - cx, o.y - cy) });
    for (const s of c.sections) if (s.sx > cx - 40 && s.sx < cx + VW + 40) this.mouthThings(ctx, s, cx, cy, things);
    for (const p of [this.kid, this.vis]) {
      things.push({ y: p.y, f: () => this.drawRider(ctx, p, cx, cy) });
    }
    things.sort((a, b) => a.y - b.y);
    for (const t of things) t.f();
    // tunnel roofs over the riders
    for (const s of c.sections) if (s.kind === 'tunnel' && s.sx + s.len > cx && s.sx < cx + VW) this.drawRoof(ctx, s, cx, cy);
    for (const f of this.fx) { ctx.fillStyle = f.color; ctx.fillRect(Math.round(f.x - cx), Math.round(f.y - cy - 2), 1, 1); }
  }

  tint(hex, k) {
    const n = parseInt(hex.slice(1), 16);
    const f = (v) => clamp(Math.round(k < 0 ? v * (1 + k) : v + (255 - v) * k), 0, 255);
    return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
  }

  /** Is the kid inside this lane? Then its trees thin out and its floor shows. */
  inside(s) { return this.kid.lane === s; }

  drawLane(ctx, s, cx, cy) {
    if (!this.inside(s)) return; // under the trees: only the way in shows (mouthThings)
    const pal = this.pal;
    const x0 = Math.max(s.sx + 20, cx); const x1 = Math.min(s.sx + s.len, cx + this.fieldW);
    const col = { ice: '#c5f6fa', tunnel: this.tint('#ffffff', -0.08), bridge: '#3b2a1e', ride: '#ffffff', jump: '#ffffff' }[s.kind];
    for (let x = x0; x < x1; x += 1) {
      const top = Math.round(s.y(x) - s.hw - cy);
      if (s.kind !== 'bridge') {
        ctx.fillStyle = '#ffffff'; ctx.fillRect(x - cx, top - 1, 1, 1);
        ctx.fillStyle = this.tint(pal.ground[2], -0.2); ctx.fillRect(x - cx, top + s.hw * 2, 1, 2);
      }
      if (s.kind === 'bridge') {
        // a dark gap under the planks
        ctx.fillStyle = this.c.hill.snowy ? '#5c7c99' : '#1f3b57';
        ctx.fillRect(x - cx, top - 4, 1, s.hw * 2 + 8);
        ctx.fillStyle = x % 4 === 0 ? '#7a5230' : '#a0703f';
        ctx.fillRect(x - cx, top, 1, s.hw * 2);
        continue;
      }
      ctx.fillStyle = col;
      ctx.fillRect(x - cx, top, 1, s.hw * 2);
      if (s.kind === 'ice' && (x + Math.floor(this.t * 6)) % 9 < 2) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - cx, top + 2 + ((x + Math.floor(this.t * 6)) % 9), 1, 1); }
      if (s.kind === 'ride') {
        const ly = Math.round(this.rideLane(s, x) - cy);
        if ((x + Math.floor(this.t * 40)) % 8 < 3) { ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - cx, ly - 4, 1, 1); ctx.fillRect(x - cx, ly + 4, 1, 1); }
      }
    }
    if (s.ramp) {
      // the landing zone
      const lx = s.ramp.land - cx; const ly = s.y(s.ramp.land);
      ctx.fillStyle = 'rgba(255,212,59,0.7)';
      ctx.fillRect(Math.round(lx - 6), Math.round(ly - cy - 5), 12, 1);
      ctx.fillRect(Math.round(lx - 6), Math.round(ly - cy + 5), 12, 1);
    }
  }

  drawRoof(ctx, s, cx, cy) {
    if (!this.inside(s)) return;
    const x0 = Math.max(s.sx + 30, cx) - cx; const x1 = Math.min(s.sx + s.len - 20, cx + this.fieldW) - cx;
    for (let x = x0; x < x1; x += 1) {
      const top = Math.round(s.y(x + cx) - s.hw - 3 - cy);
      ctx.fillStyle = 'rgba(20,16,30,0.22)'; ctx.fillRect(x, top, 1, s.hw * 2 + 6);
      if ((x + cx) % 5 < 3) { ctx.fillStyle = this.pal.props[1]; ctx.fillRect(x, top - 1, 1, 2); ctx.fillRect(x, top + s.hw * 2 + 5, 1, 2); }
    }
  }

  /**
   * The way in: something special to spot at the forest's edge, by the kind of lane (a cave
   * mouth, a ramp, a frozen creek, a bridge's first planks, a lane of arrows), plus a clue on
   * the trail. Found ones get a signpost.
   */
  entrance(ctx, s, cx, cy) {
    const x = Math.round(s.sx + 6 - cx); const y = Math.round(s.y(s.sx + 20) - cy);
    const blink = Math.floor(this.t * 3) % 2;
    if (s.kind === 'tunnel') {
      // a stone arch with a dark mouth
      ctx.fillStyle = '#495057'; ctx.fillRect(x + 6, y - 10, 14, 20);
      ctx.fillStyle = '#868e96'; ctx.fillRect(x + 7, y - 9, 12, 18);
      ctx.fillStyle = '#1b1430'; ctx.fillRect(x + 10, y - 6, 9, 12); ctx.fillRect(x + 11, y - 7, 8, 14);
      ctx.fillStyle = '#ced4da'; for (const k of [-8, -3, 2, 7]) ctx.fillRect(x + 8, y + k, 2, 1);
      if (this.c.hill.snowy) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 6, y - 11, 14, 2); }
    } else if (s.kind === 'jump') {
      this.drawRamp(ctx, x + 18, y, 18, 6);
    } else if (s.kind === 'ice') {
      // a frozen creek running into the trees
      ctx.fillStyle = '#74c0fc'; ctx.fillRect(x, y - 5, 30, 10);
      ctx.fillStyle = '#c5f6fa'; ctx.fillRect(x + 1, y - 4, 28, 8);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(x + 4 + blink * 9, y - 2, 3, 1); ctx.fillRect(x + 16 - blink * 5, y + 2, 2, 1);
    } else if (s.kind === 'bridge') {
      // the first planks and two rope posts
      ctx.fillStyle = '#1f3b57'; ctx.fillRect(x + 8, y - 7, 22, 14);
      for (let k = 0; k < 22; k += 1) { ctx.fillStyle = k % 4 ? '#a0703f' : '#7a5230'; ctx.fillRect(x + 8 + k, y - 4, 1, 8); }
      ctx.fillStyle = '#5c3d1e'; ctx.fillRect(x + 7, y - 9, 2, 5); ctx.fillRect(x + 7, y + 4, 2, 5);
      ctx.fillStyle = '#e9d2b4'; ctx.fillRect(x + 9, y - 8, 20, 1); ctx.fillRect(x + 9, y + 7, 20, 1);
    } else {
      // a lane of moving arrows, glowing in the map's color
      for (let k = 0; k < 4; k += 1) {
        ctx.fillStyle = (k + Math.floor(this.t * 6)) % 4 === 0 ? '#ffffff' : '#ffd43b';
        const ax = x + 8 + k * 6;
        ctx.fillRect(ax, y - 3, 1, 2); ctx.fillRect(ax + 1, y - 1, 1, 2); ctx.fillRect(ax, y + 1, 1, 2);
      }
    }
    if (s.sc.rarity === 'legendary' && blink) { ctx.fillStyle = '#ffd43b'; ctx.fillRect(x + 14, y - 13, 1, 3); ctx.fillRect(x + 13, y - 12, 3, 1); }
  }

  /** The way in: hidden by bushes and marked by a clue until found; a signpost once it's in the book. */
  mouthThings(ctx, s, cx, cy, things) {
    const found = this.found.has(s.sc.id) || this.kid.runs.some((r) => r.id === s.sc.id);
    const my = s.yc;
    things.push({ y: my - s.hw - 1, f: () => this.entrance(ctx, s, cx, cy) });
    if (found) {
      things.push({ y: my - s.hw - 2, f: () => this.drawSign(ctx, s.sx - 4 - cx, my - s.hw - 3 - cy, s.sc.rarity) });
      return;
    }
    // the clue shows from a distance that grows with better skis
    const dist = s.sx - this.kid.x;
    const range = 70 * this.gear.clue;
    if (dist > range || dist < -20) return;
    const blink = Math.floor(this.t * 4) % 2;
    const ex = s.sx - 10 - cx; const ey = my - cy;
    const kind = s.sc.clue;
    things.push({ y: my + 1, f: () => {
      if (kind === 'tracks') {
        ctx.fillStyle = this.tint(this.pal.ground[1], -0.3);
        for (let k = 0; k < 5; k += 1) ctx.fillRect(Math.round(ex - 26 + k * 7), Math.round(ey + (k % 2 ? -1 : 1) + (this.c.center(s.sx - 30 + k * 7) - my) * (1 - k / 5) * 0.5), 2, 1);
        if (blink) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(ex + 8), Math.round(ey - 1), 1, 1); }
      } else if (kind === 'sparkle') {
        ctx.fillStyle = blink ? '#ffffff' : '#ffe066';
        const sx = Math.round(ex + 10); const sy = Math.round(ey - 4 + (blink ? 0 : 1));
        ctx.fillRect(sx, sy - 1, 1, 3); ctx.fillRect(sx - 1, sy, 3, 1);
        if (blink) { ctx.fillRect(sx + 4, sy + 5, 1, 1); ctx.fillRect(sx - 3, sy + 3, 1, 1); }
      } else if (kind === 'sign') {
        ctx.fillStyle = '#5c3d1e'; ctx.fillRect(Math.round(ex), Math.round(ey - 8), 1, 6);
        ctx.fillStyle = blink ? '#d08a5a' : '#c07a4a'; ctx.fillRect(Math.round(ex - 2), Math.round(ey - 10), 6, 3);
        ctx.fillStyle = '#3b2a1e'; ctx.fillRect(Math.round(ex + 3), Math.round(ey - 9), 1, 1);
      } else {
        // a gap in the tree line, with light coming through
        ctx.fillStyle = blink ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)';
        ctx.fillRect(Math.round(ex + 12), Math.round(ey - s.hw), 6, s.hw * 2);
      }
    } });
  }

  /** A snow machine at the trail's edge, puffing snow onto the band. */
  drawMachine(ctx, m, x, y) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 4, y + 1, 9, 2);
    ctx.fillStyle = '#1b1430'; ctx.fillRect(x - 4, y - 7, 9, 8);
    ctx.fillStyle = '#fab005'; ctx.fillRect(x - 3, y - 6, 7, 6);
    ctx.fillStyle = '#495057'; ctx.fillRect(x - 1, y - 4, 3, 3);
    ctx.fillStyle = '#ced4da'; ctx.fillRect(x, y - 3, 1, 1);
    // the nozzle and the spray, toward the snow
    const d = -m.side;
    ctx.fillStyle = '#495057'; ctx.fillRect(x + 4, y - 7 + (d > 0 ? 4 : -2), 3, 2);
    for (let k = 0; k < 4; k += 1) {
      const ph = (this.t * 2 + k / 4) % 1;
      ctx.fillStyle = `rgba(255,255,255,${0.9 * (1 - ph)})`;
      ctx.fillRect(Math.round(x + 7 + ph * 10), Math.round(y - 6 + d * ph * 14 + (k % 2)), 2, 2);
    }
  }

  drawSign(ctx, x, y, rarity) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#5c3d1e'; ctx.fillRect(x, y - 5, 1, 5);
    ctx.fillStyle = rarity === 'legendary' ? '#ffd43b' : rarity === 'uncommon' ? '#74c0fc' : '#d08a5a';
    ctx.fillRect(x - 1, y - 8, 6, 3); ctx.fillRect(x + 5, y - 7, 1, 1);
  }

  drawBush(ctx, x, y) {
    const pic = this.sprite(`bush:${this.c.hill.id}:${this.c.hill.snowy}`, 9, 7, (g) => {
      const col = this.pal.props[0];
      g.fillStyle = this.tint(col, -0.25); g.fillRect(1, 2, 7, 5); g.fillRect(0, 3, 9, 3);
      g.fillStyle = col; g.fillRect(2, 1, 5, 4); g.fillRect(1, 2, 7, 2);
      g.fillStyle = this.tint(col, 0.25); g.fillRect(3, 1, 2, 1);
      if (this.c.hill.snowy) { g.fillStyle = '#ffffff'; g.fillRect(2, 0, 5, 2); g.fillRect(1, 1, 2, 1); }
    });
    ctx.drawImage(pic, Math.round(x - 4), Math.round(y - 6));
  }

  drawTree(ctx, t, x, y) {
    if (t.low) { this.drawBush(ctx, x, y + 1); return; }
    const hill = this.c.hill; const kinds = SKI_PROPS[hill.id]?.props || hill.props;
    const kind = kinds[t.k % kinds.length];
    const pic = this.sprite(`tree:${hill.id}:${kind}:${hill.snowy}:${this.season}`, 13, 18, (g) => this.paintProp(g, kind, hill), 'br');
    ctx.drawImage(pic, Math.round(x - 7), Math.round(y - 17));
  }

  /** A tree or plant (13 x 18, its foot at the bottom middle), by its kind, in the map's colors. */
  paintProp(g, kind, hill) {
    const [c0, c1, c2] = SKI_PROPS[hill.id]?.pal || this.pal.props;
    const px = (col, x, y, w = 1, h = 1) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const shadow = () => px('rgba(0,0,0,0.22)', 2, 16, 9, 2);
    const snow = hill.snowy;
    const shape = {
      pine: 'pine', spruce: 'pine', oak: 'round', kapok: 'round', bush: 'bush', fern: 'fern', palm: 'palm', grass: 'fern',
      shell: 'shell', coral: 'coral', kelp: 'kelp', anemone: 'coral', steam: 'vent', vent: 'vent', rock: 'rock', crystal: 'crystal', flag: 'flag', dish: 'crystal',
      banner: 'flag', wall: 'wall', hay: 'hay', deadtree: 'deadtree', iceblock: 'crystal', cloud: 'cloud', lollipop: 'lolly', mushroom: 'lolly', star: 'star', planet: 'planet', comet: 'star', vine: 'fern',
    }[kind] || 'round';
    shadow();
    if (shape === 'pine') {
      px(c2, 6, 13, 1, 4);
      for (let i = 0; i < 4; i += 1) { const w = 3 + i * 2; px(i % 2 ? c1 : c0, 6 - Math.floor(w / 2), 2 + i * 3, w, 3); }
      px(this.tint(c0, 0.25), 5, 3, 1, 2);
      if (snow) { px('#ffffff', 5, 2, 3, 1); px('#ffffff', 3, 8, 2, 1); px('#ffffff', 8, 11, 2, 1); px('#ffffff', 2, 13, 3, 1); }
    } else if (shape === 'round') {
      px(c2, 6, 11, 2, 6);
      px(c1, 2, 3, 10, 9); px(c0, 3, 2, 8, 8); px(this.tint(c0, 0.25), 4, 3, 3, 2);
      if (snow) { px('#ffffff', 3, 2, 8, 2); }
    } else if (shape === 'bush' || shape === 'fern') {
      px(c1, 1, 10, 11, 6); px(c0, 2, 9, 9, 5);
      if (shape === 'fern') for (let i = 0; i < 5; i += 1) px(c0, 1 + i * 2, 6 + (i % 2) * 2, 1, 4);
      px(this.tint(c0, 0.25), 3, 10, 2, 1);
      if (snow) px('#ffffff', 2, 9, 8, 1);
    } else if (shape === 'palm') {
      px(c1, 6, 6, 1, 11); px(this.tint(c1, 0.3), 6, 8, 1, 1); px(this.tint(c1, 0.3), 6, 12, 1, 1);
      px(c0, 1, 4, 5, 2); px(c0, 7, 4, 5, 2); px(c0, 3, 2, 7, 2); px(c0, 0, 6, 2, 1); px(c0, 11, 6, 2, 1);
      px(this.tint(c0, 0.3), 3, 2, 4, 1); px(this.tint(c0, -0.25), 1, 5, 4, 1); px(this.tint(c0, -0.25), 8, 5, 4, 1);
      px('#6e4520', 5, 5, 1, 1); px('#6e4520', 7, 5, 1, 1);
    } else if (shape === 'coral') {
      px(c0, 3, 6, 2, 10); px(c0, 7, 3, 2, 13); px(c0, 10, 8, 2, 8); px(c0, 3, 10, 6, 2); px(c1, 8, 3, 1, 4); px(this.tint(c0, 0.3), 7, 3, 1, 1);
    } else if (shape === 'kelp') {
      for (let i = 0; i < 14; i += 1) px(i % 3 ? c2 : this.tint(c2, 0.2), 5 + Math.round(Math.sin(i / 2) * 2), 2 + i, 2, 1);
      px(c2, 8, 6, 2, 2);
    } else if (shape === 'rock') {
      const lava = hill.id === 'bg-volcano';
      px(lava ? '#2b2422' : '#5c5f66', 2, 9, 10, 7); px(lava ? '#494240' : '#868e96', 3, 8, 8, 6); px(lava ? '#6c6460' : '#adb5bd', 4, 8, 3, 2);
      if (lava) { px('#ff6b1a', 5, 11, 1, 1); px('#ff6b1a', 6, 12, 1, 1); px('#ff6b1a', 7, 11, 1, 1); px('#ffd43b', 9, 10, 1, 1); }
      if (snow) px('#ffffff', 3, 7, 7, 2);
    } else if (shape === 'shell') {
      px('#ffc9c9', 3, 10, 7, 5); px('#fff0f6', 4, 9, 5, 2); px('#e599a6', 5, 11, 3, 1); px('#e599a6', 7, 12, 1, 2); px('#e599a6', 5, 13, 2, 1); px('#fff0f6', 9, 13, 2, 1);
    } else if (shape === 'vent') {
      px('#2b2422', 4, 13, 5, 3); px('#ff6b1a', 5, 14, 3, 1);
      px('rgba(240,240,240,0.85)', 5, 9, 3, 3); px('rgba(240,240,240,0.6)', 4, 5, 4, 3); px('rgba(240,240,240,0.35)', 5, 1, 4, 3);
    } else if (shape === 'deadtree') {
      px('#212529', 6, 5, 1, 12); px('#212529', 3, 6, 3, 1); px('#212529', 3, 4, 1, 2); px('#212529', 7, 8, 3, 1); px('#212529', 9, 6, 1, 2); px('#212529', 5, 3, 1, 2); px('#495057', 6, 9, 1, 2);
    } else if (shape === 'wall') {
      px('#868e96', 0, 9, 13, 7); px('#adb5bd', 0, 9, 13, 1);
      for (const m of [0, 5, 10]) { px('#868e96', m, 6, 3, 3); px('#adb5bd', m, 6, 3, 1); }
      px('#5c636a', 0, 12, 13, 1); px('#5c636a', 3, 9, 1, 3); px('#5c636a', 9, 9, 1, 3); px('#5c636a', 6, 13, 1, 3);
      if (snow) { px('#ffffff', 0, 9, 13, 1); for (const m of [0, 5, 10]) px('#ffffff', m, 6, 3, 1); }
    } else if (shape === 'hay') {
      px('#c98a2b', 1, 8, 11, 8); px('#e8b04a', 2, 8, 9, 6); px('#ffe08a', 3, 9, 3, 1); px('#8b5a2b', 1, 10, 11, 1); px('#8b5a2b', 1, 13, 11, 1);
      if (snow) px('#ffffff', 2, 7, 9, 2);
    } else if (shape === 'crystal') {
      px(this.tint(c0, -0.3), 4, 6, 6, 10); px(c0, 5, 3, 4, 12); px(this.tint(c0, 0.4), 6, 4, 1, 6); px(c1, 9, 9, 2, 7);
    } else if (shape === 'flag') {
      const col = kind === 'banner' ? '#c92a2a' : c0;
      px('#5c3d1e', 6, 3, 1, 14); px(col, 7, 3, 5, 4); px(this.tint(col, 0.3), 7, 3, 2, 1);
      if (kind === 'banner') { px(col, 7, 7, 2, 1); px(col, 10, 7, 2, 1); px('#ffd43b', 9, 4, 1, 2); }
    } else if (shape === 'block') {
      px(this.tint(c1, -0.1), 1, 8, 11, 8); px(c0, 1, 8, 11, 3); px(c1, 6, 11, 1, 5);
      if (snow) px('#ffffff', 1, 7, 11, 2);
    } else if (shape === 'cloud') {
      px('#ffffff', 2, 8, 10, 5); px('#ffffff', 4, 6, 6, 3); px('#e7e0ff', 2, 12, 10, 2);
    } else if (shape === 'lolly') {
      px('#ffffff', 6, 9, 1, 8); px(c0, 4, 2, 5, 7); px(c0, 3, 3, 7, 5); px(this.tint(c0, -0.2), 4, 8, 5, 1);
      px('#ffffff', 5, 4, 2, 1); px('#ffffff', 7, 5, 1, 2); px('#ffffff', 5, 6, 1, 1);
    } else if (shape === 'star') {
      px(c0, 6, 4, 1, 9); px(c0, 2, 8, 9, 1); px(c0, 5, 6, 3, 5); px(c0, 4, 7, 5, 3); px('#ffffff', 6, 7, 1, 1);
    } else if (shape === 'planet') {
      px(c2, 4, 5, 5, 7); px(c2, 3, 6, 7, 5); px(this.tint(c2, 0.3), 4, 6, 2, 2); px(this.tint(c2, -0.25), 7, 10, 2, 1);
      px(c0, 0, 9, 13, 1); px(this.tint(c0, -0.3), 1, 10, 11, 1);
    }
  }

  drawHazard(ctx, h, x, y) {
    const pic = this.sprite(`haz:${this.c.hill.id}:${h.kind}:${this.c.hill.snowy}`, 12, 10, (g) => {
      const px = (col, a, b, w = 1, hh = 1) => { g.fillStyle = col; g.fillRect(a, b, w, hh); };
      px('rgba(0,0,0,0.3)', 1, 8, 10, 2);
      const k = h.kind;
      if (/log|driftwood|root/.test(k)) { px('#5c3d1e', 0, 4, 12, 4); px('#8b5a2b', 0, 4, 12, 2); px('#c49a6c', 10, 4, 2, 4); px('#8b5a2b', 11, 5, 1, 2); }
      else if (/stump|barrel/.test(k)) { px('#5c3d1e', 2, 3, 8, 6); px('#a0703f', 2, 2, 8, 3); px('#c49a6c', 4, 3, 4, 1); }
      else if (/hay|sandcastle|gumdrop/.test(k)) { const col = k === 'gumdrop' ? '#f06595' : '#e8b04a'; px(this.tint(col, -0.3), 1, 4, 10, 5); px(col, 2, 2, 8, 5); px(this.tint(col, 0.3), 3, 2, 3, 1); }
      else if (/crab|urchin|clam/.test(k)) { const col = k === 'crab' ? '#e8590c' : k === 'urchin' ? '#5f3dc4' : '#e9d2b4'; px(col, 2, 4, 8, 4); px(this.tint(col, 0.3), 3, 4, 3, 1); px(col, 0, 3, 2, 1); px(col, 10, 3, 2, 1); px('#1b1430', 4, 5, 1, 1); px('#1b1430', 7, 5, 1, 1); }
      else if (/lavarock|vent/.test(k)) { px('#2b2422', 1, 3, 10, 6); px('#494240', 2, 2, 8, 4); px('#ff6b1a', 4, 5, 2, 1); px('#ffd43b', 7, 4, 1, 1); }
      else if (/crater/.test(k)) { px('#6d7199', 1, 3, 10, 6); px('#4a4e73', 3, 4, 6, 4); px('#c3c6dd', 2, 2, 8, 1); }
      else if (/antenna/.test(k)) { px('#adb5bd', 5, 1, 1, 8); px('#e9ecef', 3, 1, 5, 1); px('#fa5252', 5, 0, 1, 1); }
      else if (/candycane/.test(k)) { px('#ffffff', 5, 1, 2, 8); px('#fa5252', 5, 2, 2, 1); px('#fa5252', 5, 5, 2, 1); px('#ffffff', 7, 1, 2, 2); }
      else if (/cloudpuff/.test(k)) { px('#ffffff', 1, 4, 10, 4); px('#ffffff', 3, 2, 6, 3); px('#d0bfff', 1, 7, 10, 1); }
      else if (/starburst|ring/.test(k)) { px('#fab005', 5, 1, 2, 8); px('#fab005', 1, 4, 10, 2); px('#ffffff', 5, 4, 2, 2); }
      else if (/puddle/.test(k)) { px('#4a3220', 1, 4, 10, 4); px('#6e5a3c', 2, 5, 3, 1); }
      else if (/snowdrift/.test(k)) { px('#b8cce0', 0, 4, 12, 5); px('#ffffff', 1, 3, 10, 4); }
      else if (/ice/.test(k)) { px('#74c0fc', 2, 2, 8, 7); px('#d0ebff', 3, 2, 3, 3); px('#1c7ed6', 9, 3, 1, 6); }
      else { px('#495057', 1, 3, 10, 6); px('#868e96', 2, 2, 8, 5); px('#ced4da', 3, 2, 3, 2); if (this.c.hill.snowy) px('#ffffff', 2, 1, 7, 2); }
    }, 'all');
    ctx.drawImage(pic, Math.round(x - 7), Math.round(y - 8));
    // a glint when it's coming up, so it's seen in time
    const ahead = h.x - this.kid.x;
    if (ahead > 0 && ahead < 70 && Math.floor(this.t * 5 + h.x) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(x - 3), Math.round(y - 6), 1, 1); ctx.fillRect(Math.round(x - 2), Math.round(y - 7), 1, 1); }
  }

  drawFlag(ctx, x, y, i) {
    x = Math.round(x); y = Math.round(y);
    const flash = this.passed?.get(i) > this.t - 0.4;
    const col = flash ? '#ffd43b' : i % 2 ? '#1c7ed6' : '#e03131';
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(x - 1, y, 5, 1);
    ctx.fillStyle = '#1b1430'; ctx.fillRect(x - 1, y - 12, 3, 12); ctx.fillRect(x + 1, y - 13, 7, 7);
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(x, y - 12, 1, 12);
    ctx.fillStyle = col; ctx.fillRect(x + 1, y - 12, 6, 5);
    ctx.fillStyle = this.tint(col, 0.4); ctx.fillRect(x + 1, y - 12, 3, 1);
  }

  /** A faint dotted line between a gate's two flags, so it reads as a doorway. */
  drawGateLine(ctx, g, cx, cy) {
    ctx.fillStyle = 'rgba(255,255,255,0.45)';
    for (let y = g.y - g.hw + 2; y < g.y + g.hw - 1; y += 3) ctx.fillRect(Math.round(g.x - cx), Math.round(y - cy), 1, 1);
  }

  drawPost(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x - 1, y, 3, 1);
    ctx.fillStyle = this.c.hill.snowy ? '#74c0fc' : this.pal.props[1]; ctx.fillRect(x - 1, y - 6, 3, 6);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 1, y - 6, 1, 2);
  }

  drawRamp(ctx, x, y, w, hw) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = this.tint(this.pal.ground[0], -0.1); ctx.fillRect(x, y - hw, w, hw * 2);
    ctx.fillStyle = this.tint(this.pal.ground[0], 0.4); ctx.fillRect(x + w - 3, y - hw, 3, hw * 2);
    ctx.fillStyle = 'rgba(0,0,0,0.3)'; ctx.fillRect(x + w, y - hw, 1, hw * 2);
    ctx.fillStyle = '#fab005'; for (let k = -hw; k < hw; k += 3) ctx.fillRect(x + 3, y + k, 3, 1);
  }

  drawPad(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    const on = Math.floor(this.t * 6) % 3;
    for (let k = 0; k < 3; k += 1) {
      ctx.fillStyle = k === on ? '#ffffff' : '#f783ac';
      ctx.fillRect(x - 5 + k * 3, y - 3, 1, 2); ctx.fillRect(x - 4 + k * 3, y - 1, 1, 2); ctx.fillRect(x - 5 + k * 3, y + 1, 1, 2);
    }
  }

  drawVent(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#2b2422'; ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.fillStyle = '#ff6b1a'; ctx.fillRect(x - 1, y - 1, 2, 1);
    const ph = (this.t * 1.5 + x * 0.1) % 1;
    ctx.fillStyle = `rgba(240,240,240,${0.7 * (1 - ph)})`;
    ctx.fillRect(x - 2, Math.round(y - 4 - ph * 10), 4, 3);
  }

  drawLava(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    ctx.fillStyle = '#a61e1e'; ctx.fillRect(x - 5, y - 3, 10, 6);
    ctx.fillStyle = Math.floor(this.t * 3 + x) % 2 ? '#ff6b1a' : '#fd7e14'; ctx.fillRect(x - 4, y - 2, 8, 4);
    ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 1, y - 1, 2, 1);
  }

  drawGap(ctx, gp, cx, cy) {
    const x = Math.round(gp.x - cx);
    const ch = this.c.center(gp.x); const hh = this.c.halfWidth(gp.x);
    const top = Math.round(ch - hh - cy); const bot = Math.round(ch + hh - cy);
    ctx.fillStyle = '#1f3b57'; ctx.fillRect(x - 2, top, 4, bot - top);
    ctx.fillStyle = '#4dabf7'; ctx.fillRect(x - 2, top, 1, bot - top);
    // the snow bridge
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, Math.round(gp.by - gp.bw - cy), 6, gp.bw * 2);
    ctx.fillStyle = '#d0ebff'; ctx.fillRect(x - 3, Math.round(gp.by + gp.bw - 1 - cy), 6, 1);
  }

  drawWell(ctx, x, y) {
    x = Math.round(x); y = Math.round(y);
    for (let k = 0; k < 6; k += 1) {
      const a = this.t * 2 + k * 1.05; const rr = 6 + (k % 3) * 5;
      ctx.fillStyle = k % 2 ? '#d0bfff' : '#9775fa';
      ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.6), 2, 1);
    }
    ctx.fillStyle = '#1a1033'; ctx.fillRect(x - 2, y - 1, 4, 3);
  }

  drawDrift(ctx, cx, cy, VW) {
    for (let x = Math.floor(cx / 30) * 30; x < cx + VW; x += 30) {
      const dir = Math.floor(x / 600) % 2 ? 1 : -1;
      const y0 = this.c.center(x) - 14 + ((x / 30) % 3) * 12;
      const ph = (this.t * 14 * dir) % 12;
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillRect(Math.round(x - cx), Math.round(y0 + ph - cy), 1, 1);
      ctx.fillRect(Math.round(x - cx + 1), Math.round(y0 + ph - cy - dir), 1, 1);
    }
  }

  drawWalls(ctx, w, cx, cy) {
    for (let x = w.x0; x < w.x1; x += 1) {
      if (x < cx || x > cx + this.fieldW) continue;
      const ch = this.c.center(x); const hh = this.c.halfWidth(x);
      for (const sgn of [-1, 1]) {
        const y = Math.round(ch + sgn * (hh + 2) - cy);
        ctx.fillStyle = (x + (sgn > 0 ? 2 : 0)) % 6 < 1 ? '#495057' : '#868e96';
        ctx.fillRect(x - cx, y - 3, 1, 5);
        ctx.fillStyle = '#ced4da'; ctx.fillRect(x - cx, y - 3, 1, 1);
      }
    }
  }

  drawLine(ctx, x, cy, kind) {
    x = Math.round(x);
    for (let y = -10; y < BAND + 10; y += 2) {
      ctx.fillStyle = (Math.floor(y / 2) % 2) ? '#1b1430' : '#ffffff';
      ctx.fillRect(x, y - cy, 2, 2);
    }
    if (kind === 'finish') { ctx.fillStyle = '#e03131'; ctx.fillRect(x - 1, -cy - 14, 1, 14); ctx.fillRect(x - 1, BAND - cy, 1, 14); }
  }

  /** Two thin grooves behind each rider, fading over 3 seconds. */
  drawMarks(ctx, p, cx, cy) {
    const col = this.tint(this.pal.ground[0], -0.2);
    let prev = null;
    for (const m of p.marks) {
      const age = this.t - m.at;
      if (age > 3 || (prev && m.x - prev.x > 6)) { prev = m; continue; }
      if (prev) {
        ctx.globalAlpha = 1 - age / 3;
        ctx.fillStyle = col;
        const x0 = Math.round(prev.x - cx); const x1 = Math.round(m.x - cx);
        for (let x = x0; x <= x1; x += 1) {
          const y = Math.round(lerp(prev.y, m.y, x1 > x0 ? (x - x0) / (x1 - x0) : 0) - cy);
          ctx.fillRect(x, y - 1, 1, 1); ctx.fillRect(x, y + 1, 1, 1);
        }
      }
      prev = m;
    }
    ctx.globalAlpha = 1;
  }

  drawRider(ctx, p, cx, cy) {
    const x = Math.round(p.x - cx); const y = Math.round(p.y - cy);
    p.paint(this.t);
    const lift = p.lift || 0;
    const col = ['#e03131', '#e03131', '#1c7ed6', '#fab005'][p.tier] || '#e03131';
    const sy = y - lift;
    const ang = p.spin > 0 ? Math.sin(this.t * 20) * 0.8 : p.head;
    const tuck = p.run === 0 && p.spin <= 0 && p.air <= 0 && !p.done;
    // shadow on the ground (stays down when it jumps)
    ctx.fillStyle = 'rgba(20,40,60,0.28)';
    ctx.fillRect(x - 8, y + 1, 17, 2);
    // poles trailing back when tucked
    if (tuck) { ctx.fillStyle = '#495057'; for (let k = 0; k < 7; k += 1) { ctx.fillRect(x - 3 - k, sy - 8 + Math.round(k * 0.6), 1, 1); ctx.fillRect(x - 2 - k, sy - 5 + Math.round(k * 0.6), 1, 1); } }
    // the buddy: squashed down in a tuck, leaning a pixel into a turn
    const h = tuck ? 21 : 24;
    const lean = Math.abs(p.head) > 0.15 ? Math.sign(p.head) : 0;
    ctx.save();
    ctx.translate(x, 0);
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(p.pic, 0, 0, 24, 24, -12, sy - 23 + (24 - h) + lean, 24, h);
    ctx.restore();
    // skis: two long boards with turned-up tips
    for (const off of [-1, 1]) {
      for (let k = -8; k <= 8; k += 1) {
        const yy = Math.round(sy + 1 + off + k * Math.sin(ang) * 0.6);
        ctx.fillStyle = k >= 7 ? this.tint(col, 0.45) : col;
        ctx.fillRect(x + k, yy - (k === 8 ? 1 : 0), 1, 1);
        if (off > 0) { ctx.fillStyle = 'rgba(27,20,48,0.5)'; ctx.fillRect(x + k, yy + 1, 1, 1); }
      }
    }
    // speed lines when tucked
    if (tuck && p.v > 60) { ctx.fillStyle = 'rgba(255,255,255,0.6)'; const ph = Math.floor(this.t * 20) % 4; for (const dy of [-14, -8, -3]) ctx.fillRect(x - 16 - ph * 2, sy + dy, 3, 1); }
    if (p === this.vis && p.called != null && p.lane == null && this.c.sections[p.called] && p.x < this.c.sections[p.called].sx + 30) {
      ctx.fillStyle = '#1b1430'; ctx.fillRect(x - 2, sy - 34, 4, 10);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 1, sy - 33, 2, 5); ctx.fillRect(x - 1, sy - 26, 2, 2);
    }
  }

  // ---------- words on the sharp canvas ----------
  drawHud(ctx, scale) {
    const S = scale; const W = this.W * S; const H = this.H * S;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff', align = 'center') => {
      ctx.textAlign = align;
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = '#1b1430';
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
      ctx.textAlign = 'center';
    };
    const u = S * 4;
    const c = this.c;
    // the race strip: both buddies on the way to the finish flag
    const sy = (TOP - 4) * S; const sx0 = W * 0.2; const sx1 = W * 0.8;
    const pill = (x, y, w, h) => { ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.roundRect(x, y, w, h, h / 2); ctx.fill(); ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = Math.max(1, S * 0.5); ctx.stroke(); };
    pill(sx0 - u * 1.2, sy - u * 0.9, sx1 - sx0 + u * 2.6, u * 1.8);
    ctx.fillStyle = '#e9ecef'; ctx.fillRect(sx0, sy - S * 0.5, sx1 - sx0, S);
    for (const s of c.sections) { ctx.fillStyle = 'rgba(255,212,59,0.4)'; ctx.fillRect(sx0 + (s.sx / c.len) * (sx1 - sx0), sy - S, (s.len / c.len) * (sx1 - sx0), S * 2); }
    // a checkered finish
    for (let i = 0; i < 4; i += 1) for (let j = 0; j < 2; j += 1) { ctx.fillStyle = (i + j) % 2 ? '#ffffff' : '#495057'; ctx.fillRect(sx1 + j * u * 0.35, sy - u * 0.7 + i * u * 0.35, u * 0.35, u * 0.35); }
    for (const [p, col] of [[this.vis, '#ffa94d'], [this.kid, '#69db7c']]) {
      const k = clamp(p.x / c.len, 0, 1);
      ctx.fillStyle = '#1b1430'; ctx.beginPath(); ctx.arc(sx0 + k * (sx1 - sx0), sy, u * 0.65, 0, 7); ctx.fill();
      ctx.fillStyle = col; ctx.beginPath(); ctx.arc(sx0 + k * (sx1 - sx0), sy, u * 0.48, 0, 7); ctx.fill();
    }
    const words = snowWords(this.snow, c.surface);
    if (this.phase === 'play' || this.phase === 'finish') {
      pill(u * 0.6, sy + u * 1.1, u * 6.6, u * 2.2);
      text(`${this.raceT.toFixed(1)} s`, u * 1.3, sy + u * 2.2, u * 2, '#ffffff', 'left');
      text(`${words.emoji} ${words.name}`, W - u, sy + u * 2.2, u * 1.4, '#e9ecef', 'right');
      // boosts
      if (this.kid.boosts > 0 || this.gear.boosts) {
        const b = this.boostButton();
        ctx.fillStyle = this.kid.boosts > 0 ? 'rgba(28,126,214,0.85)' : 'rgba(80,80,90,0.6)';
        ctx.beginPath(); ctx.arc(b.x * S, b.y * S, b.r * S, 0, 7); ctx.fill();
        ctx.strokeStyle = '#ffffff'; ctx.lineWidth = S; ctx.stroke();
        text('BOOST', b.x * S, b.y * S - u * 0.4, u * 1.1);
        text('●'.repeat(this.kid.boosts) || '–', b.x * S, b.y * S + u * 0.9, u * 0.9, '#ffd43b');
      }
      // Super skis: an arrow at the edge toward the next open shortcut
      if (this.gear.arrow && !this.kid.lane) {
        const s = c.sections.find((q) => q.sx + 24 > this.kid.x && q.sx - this.kid.x < this.fieldW * 2.5);
        if (s) {
          const [vx, vy] = this.toView(s.sx, s.yc);
          if (vx > this.W - 8) {
            const ay = clamp(vy, TOP + 6, this.H - 30) * S;
            ctx.fillStyle = '#ffd43b'; ctx.beginPath(); ctx.moveTo(W - u * 0.4, ay); ctx.lineTo(W - u * 1.8, ay - u * 0.9); ctx.lineTo(W - u * 1.8, ay + u * 0.9); ctx.fill();
          }
        }
      }
      if (this.phase === 'play' && this.raceT < 2.5) text('Slide up or down to steer. Hold still to tuck!', W / 2, H - u * 1.4, u * 1.4);
      if (this.kid.chain > 1) text(`Gates x${this.kid.chain}`, u * 1.2, sy + u * 4.2, u * 1.3, '#ffe066', 'left');
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      if (age > 1) continue;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x * S, u * 6, W - u * 6), Math.max(u * 7.5, (p.y - age * 10) * S), u * (p.big ? 2.2 : 1.6), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'count') {
      const n = 3 - Math.floor((this.t - this.countAt) / 0.8);
      text(n > 0 ? String(n) : 'Go!', W / 2, H / 2, u * 5, '#ffd43b');
    }
    const card = (lines) => {
      const bh = u * (2.4 + lines.reduce((a, [, px]) => a + px * 1.05 + 0.3, 0));
      const cy = (TOP + 8) * S + bh / 2;
      const bw = Math.min(W * 0.7, u * 40);
      const mid = W - u * 1.5 - bw / 2; // on the right, so both racers show at the start
      ctx.fillStyle = 'rgba(27,20,48,0.9)'; ctx.fillRect(mid - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(mid - bw / 2, cy - bh / 2, bw, bh);
      let y = cy - bh / 2 + u * 1.2 + u * lines[0][1] * 0.5;
      for (const [s, px, col] of lines) { text(s, mid, y, u * px, col); y += u * px * 1.05 + u * 0.3; }
    };
    if (this.phase === 'ready') {
      const n = hillCount(this.book, c.hill.id);
      const best = hillBest(this.book, c.hill.id);
      const lines = [
        [`${c.hill.name}: race ${this.visName}!`, 2.2, '#ffd43b'],
        [`Today: ${words.emoji} ${words.name}`, 1.6, '#ffffff'],
        [c.full ? c.course.twist : `${c.course.twist} Stay on the snow!`, 1.3, '#e9ecef'],
        [`Shortcuts found: ${n.found} of ${n.total}${best ? `   Best ${best.toFixed(1)} s` : ''}`, 1.3, '#b2f2bb'],
      ];
      if (this.rare) lines.push(['Something rare is hiding on the hill today...', 1.3, '#ffd43b']);
      card(lines);
      if (Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Tap to start!', W / 2, H - u * 1.6, u * 1.9);
    }
    if (this.phase === 'over' && this.t - this.overAt > 0.3 && this.result) {
      const r = this.result;
      const lines = [[r.won ? `You won! ${r.time.toFixed(1)} s` : `${this.visName} won by ${r.by.toFixed(1)} s`, 2.4, r.won ? '#ffd43b' : '#ffc9c9']];
      lines.push([r.bestTime ? `Fastest on ${words.name.toLowerCase()} yet!` : `Your time ${r.time.toFixed(1)} s`, 1.5, r.bestTime ? '#b2f2bb' : '#e9ecef']);
      const medal = { bronze: '🥉', silver: '🥈', gold: '🥇' };
      for (const nw of r.news.slice(0, 3)) {
        lines.push([nw.first ? `New shortcut! ${nw.name} ${medal[nw.badge]}` : nw.up ? `${nw.name}: ${BADGE_NAMES[nw.badge]} ${medal[nw.badge]}` : `${nw.name}: ${SNOW_KINDS[nw.stamp]?.emoji || ''} stamp`, 1.4, nw.first ? '#ffd43b' : '#d0ebff']);
      }
      if (!r.news.length && !this.kid.runs.length) lines.push(['Look for clues at the edge of the trail!', 1.3, '#e9ecef']);
      card(lines);
      if (this.t - this.overAt > 1.2) text('Tap to race again', W / 2, H - u * 1.6, u * 1.6);
    }
  }
}
