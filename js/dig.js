// Dino dig: the shovel game. The kid's buddy and the visitor dig for dinosaur bones and real
// treasures for 90 seconds on a dig site drawn for the kid's map (seen from above, like the
// village). Everything found goes in the dig book in the buddy's house; a finished skeleton
// can stand in the house, and a treasure on a pedestal.
//
// Tap the ground: the buddy walks there. Tap DIG: one shovel stroke, one layer deeper. Things
// are buried 1 to 5 layers down. The first stroke always tells you something: bone chips,
// glitter or rusty bits in the dirt pile mean something is down there (plain dirt: probably
// nothing). The stroke before you reach it goes CLINK (a "tok" for bone, a "ting" for a gem,
// a "clank" for metal); then a ring closes on the DIG button, and tapping as it meets the
// button lifts the find out clean (Rough, Fine or Perfect). A skull or a super special find
// takes three heaves, and the visitor runs over to help. Five strokes with nothing: a critter
// may pop out. Bones of one dinosaur lie together in a bed, and chips on the ground point
// from one to the next.
//
// Finds are seeded fresh every round (digfinds.js), weighted by the cues on the site
// (digsite.js): bones at the foot of the cliff, slopes and creeks, gems by rocks and
// outcrops, lost things by trees, ruins and paths. Every map has its own twist (TWISTS).
//
// A better shovel sees more of a bigger site (it zooms out, like a better rod), walks faster,
// and finds rare things more often; the steel spade taps the ground when you stop (thud:
// nothing near; tok: something within a step), and the golden shovel makes buried things
// nearby twinkle, and sometimes there's a second find under the first.
//
// The game keeps its own clock (step) and draws whole pixels (draw); words go on the sharp HUD
// canvas (drawHud), like the other visitor games.
import { Player, rng, clamp } from './play.js';
import { CALM } from './rig.js';
import { addPop } from './meter.js';
import {
  SITES, seedFinds, findInfo, digPoints, skeletonProgress, SHOVELS, RARITY, CONDITIONS, digOfDay, CRITTERS, boneKey,
} from './digfinds.js';
import { makeLayout } from './digsite.js';
import { paintSite, drawHole, findPic, shovelPic, propPic, critterPic, drawTwistDecals, SITE_LOOKS } from './digart.js';

const HAPPY = { ...CALM, valence: 0.7, arousal: 0.6 };
const THRILLED = { ...CALM, valence: 0.95, arousal: 0.95 };
const FEET = 7 + 16; // SPRITE_Y + 16, as in play.js
const INK = '#1b1430';
export const GAME_SECONDS = 90;
export const CELL = 16; // a dig spot is CELL x CELL game pixels
export const MAX_DEPTH = 5;
export const LIFT_RING = 0.9; // seconds for the clean-lift ring to close on the button
export const LIFT_PERFECT = 0.09; export const LIFT_FINE = 0.22;
export const HEAVES = 3;
export const GOLDEN = 15; // the last seconds: dust puffs over what's still buried
export const OVERTIME = 5; // seconds to finish a hole started before the buzzer
export const CRITTER_CHANCE = 0.33;

/** Each map's twist. */
export const TWISTS = {
  'bg-meadow': 'molehills', 'bg-castle': 'cellar', 'bg-sunset': 'tide', 'bg-ocean': 'current', 'bg-volcano': 'hot',
  'bg-rainforest': 'rain', 'bg-fjord': 'ice', 'bg-space': 'meteor', 'bg-rainbow': 'bands', 'bg-galaxy': 'stars',
};
const TIDE_OUT = 16; // pixels the sea goes out over a round
const HOT_STROKES = 3; const HOT_COOL = 2;
const CURRENT_EVERY = 25;
const STAR_CHAIN = 5;

const tierOf = (gear) => clamp(gear?.shovel || 1, 1, 3);
// what a find's flecks look like in the first stroke's dirt
export const fleckOf = (info) => (!info ? null : info.kind === 'bone' || info.cue === 'bone' ? 'bone' : info.cue === 'made' ? 'made' : 'gem');
const FLECK_WORDS = { bone: 'Bone chips!', gem: 'Glitter!', made: 'Rusty bits!' };
const BAND = { common: '#ff8787', uncommon: '#ffd43b', rare: '#9775fa', skull: '#9775fa', special: '#9775fa' };
const CLINK = { bone: 'tok', gem: 'ting', made: 'clank' };

/**
 * opts: { W, H, kid, visitor: { buddy, name, gear }, best, seed, map: background id, day,
 *   dry: rounds on this map without its key piece (skull or special), maps: the maps the kid owns,
 *   bones: the kid's bones so far ({ key: { n, q } }), treasures: the same for treasures,
 *   onFind({ key, kind, q, map, gift }): the kid found something; answers 'new', 'better' or null,
 *   onRound({ key }): a round ended; key: the map's skull or special was found }
 */
export class Dig {
  constructor(opts) {
    this.kind = 'dig';
    this.Z = 2;
    this.opts = opts;
    this.map = SITES[opts.map] ? opts.map : 'bg-meadow';
    this.site = SITES[this.map];
    this.twist = TWISTS[this.map];
    this.look = SITE_LOOKS[this.map];
    this.day = opts.day || 'today';
    this.seed = opts.seed || 1;
    this.onFind = opts.onFind || null; this.onRound = opts.onRound || null;
    this.owned = { bones: { ...(opts.bones || {}) }, treasures: { ...(opts.treasures || {}) } };
    this.dry = opts.dry || 0;
    this.tier = tierOf(opts.kid.gear); this.visTier = tierOf(opts.visitor.gear);
    this.shovel = SHOVELS[this.tier - 1];
    this.vW = opts.W; this.vH = opts.H;
    this.zoom = this.shovel.zoom;
    this.fieldW = Math.round(opts.W * this.zoom); this.fieldH = Math.round(opts.H * this.zoom);
    this.W = Math.round((this.fieldW * this.shovel.screens) / CELL) * CELL;
    this.H = Math.max(this.fieldH, Math.round((this.fieldH * 1.2) / CELL) * CELL);
    this.best = opts.best || 0;
    this.holdAnywhere = false; this.locked = false;
    this.t = 0; this.pops = []; this.sparks = []; this.rounds = 0;
    this.newRound();
  }

  newRound() {
    this.rounds += 1;
    this.r = rng(this.seed + this.rounds * 7919);
    this.layout = makeLayout(this.map, this.r, this.W, this.H);
    this.tide = 0;
    this.cells = this.makeCells();
    this.today = digOfDay(this.map, this.day);
    const start = this.startSpot();
    const first = !Object.keys(this.owned.bones).length && !Object.keys(this.owned.treasures).length;
    const { items, key } = seedFinds(this.map, this.cells, this.r, {
      tier: this.tier, dry: this.dry, today: this.today, bones: this.owned.bones, maps: this.opts.maps,
      first, start, count: Math.round(30 * (this.shovel.screens / 2) ** 0.8),
    });
    this.items = items; this.keyHere = key;
    this.twistSeed(start);
    this.field = paintSite(this.look, this.layout, this.W, this.H, this.Z, this.seed + this.rounds);
    this.props = this.layout.props.map((p) => ({ ...p, art: propPic(this.look, p, this.Z) }));
    if (!this.kid) {
      const hold = (b) => ({ species: b?.species, outfit: { ...(b?.outfit || {}), sport: undefined, music: undefined, hand: undefined } });
      this.kid = new Player(hold(this.opts.kid.buddy), this.opts.kid.name, 11, start[0], start[1]);
      this.vis = new Player(hold(this.opts.visitor.buddy), this.opts.visitor.name, 23, start[0] - 18, start[1] + 6);
      for (const p of [this.kid, this.vis]) { p.face = 1; p.brain.set(HAPPY); p.digT = -1; }
    }
    this.kid.x = start[0]; this.kid.y = start[1]; this.kid.goTo(...start);
    const vs = this.near(start[0] - 18, start[1] + 8);
    this.vis.x = vs[0]; this.vis.y = vs[1]; this.vis.goTo(...vs);
    const swim = this.twist === 'current' ? 1.35 : this.twist === 'meteor' ? 1.3 : 1;
    this.kid.speed = 46 * this.shovel.walk * swim; this.vis.speed = 46 * SHOVELS[this.visTier - 1].walk * swim * 0.85;
    this.holes = new Map(); // cell index -> { d, item, done, clinked, flecks, reveal }
    this.points = { kid: 0, vis: 0 }; this.score = 0; this.newBest = false;
    this.found = []; this.visFound = []; this.cards = []; this.card = null; this.gifted = false; this.chips = [];
    this.stroke = null; this.queued = 0; this.visStroke = null; this.heave = null; this.lift = null;
    this.ai = { next: 1.2, cell: -1 };
    this.camX = clamp(start[0] - this.fieldW / 2, 0, this.W - this.fieldW); this.camY = clamp(start[1] - this.fieldH / 2, 0, this.H - this.fieldH);
    this.phase = 'ready'; this.left = GAME_SECONDS; this.overtime = 0;
    this.heat = 0; this.hotUntil = 0; this.nextCurrent = CURRENT_EVERY; this.rained = false; this.meteor = null; this.stars = 0; this.starLine = null;
    this.moved = 0; this.wasMoving = false; this.critters = [];
  }

  // ---------- the site ----------
  makeCells() {
    const L = this.layout; const cols = Math.floor(this.W / CELL); const rows = Math.floor(this.H / CELL);
    const cells = [];
    const decal = (type) => L.decals.filter((d) => d.type === type);
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = i * CELL + CELL / 2; const y = j * CELL + CELL / 2;
        const c = { i, j, x, y, idx: j * cols + i, like: { bone: 0, gem: 0, made: 0 } };
        c.open = this.groundAt(x, y, true);
        for (const q of L.cues) {
          const d = Math.hypot(x - q.x, (y - q.y) * 1.2);
          if (d > q.r) continue;
          const f = 1 - d / q.r;
          for (const k in q.likes) c.like[k] += q.likes[k] * f;
        }
        if (this.twist === 'tide' && L.bottom && y > L.bottom(x) - 10) { c.wet = true; c.like.gem += 1.4; c.like.made += 1.4; c.like.bone += 1; }
        if (this.twist === 'hot' && decal('hot').some((d) => Math.hypot(x - d.x, (y - d.y) * 1.3) < d.w / 2)) c.hot = true;
        if (decal('molehill').some((d) => Math.abs(d.x - x) < CELL / 2 && Math.abs(d.y - y) < CELL / 2)) c.molehill = true;
        if (decal('flag').some((d) => Math.abs(d.x - x) < CELL / 2 && Math.abs(d.y - y) < CELL / 2)) { c.flag = true; c.noSeed = true; }
        cells.push(c);
      }
    }
    this.cols = cols; this.rows = rows;
    return cells;
  }

  /** The sea line on the beach (it goes out during the round). */
  sea(x) { return this.layout.bottom ? this.layout.bottom(x) + (this.twist === 'tide' ? this.tide : 0) : Infinity; }

  /** Whether the ground at x, y can be stood on (dug). ever: counting sand the tide will uncover. */
  groundAt(x, y, ever = false) {
    const L = this.layout;
    if (x < 6 || x > this.W - 6 || y > this.H - 4) return false;
    if (y < L.top(x) + 6) return false;
    if (L.bottom && y > (ever ? L.bottom(x) + TIDE_OUT : this.sea(x)) - 4) return false;
    for (const b of L.blocks) if (Math.hypot(x - b.x, (y - b.y) * 1.6) < b.r + 2) return false;
    return true;
  }

  /** Whether a buddy fits at x, y (the cliff, rocks, trees and water block the way; swimmers pass over rocks). */
  walkable(x, y) {
    const L = this.layout;
    if (x < 6 || x > this.W - 6 || y > this.H - 3) return false;
    if (y < L.top(x) + 4) return false;
    if (y > this.sea(x) - 2) return false;
    const swim = this.twist === 'current';
    for (const b of L.blocks) {
      if (swim && !b.big) continue;
      if (Math.hypot(x - b.x, (y - b.y) * 1.6) < b.r) return false;
    }
    return true;
  }

  near(x, y) {
    if (this.walkable(x, y)) return [x, y];
    for (let rr = 3; rr <= 60; rr += 3) for (let a = 0; a < 12; a += 1) {
      const px = x + Math.cos((a / 12) * Math.PI * 2) * rr; const py = y + Math.sin((a / 12) * Math.PI * 2) * rr;
      if (this.walkable(px, py)) return [px, py];
    }
    return [x, y];
  }

  startSpot() {
    for (let k = 0; k < 80; k += 1) {
      const x = this.W * (0.12 + 0.18 * this.r()); const y = this.layout.top(x) + 30 + this.r() * 30;
      if (this.walkable(x, y) && this.walkable(x - 18, y + 8)) return [x, y];
    }
    return this.near(this.W * 0.2, this.H * 0.6);
  }

  cellAt(x, y) {
    const i = Math.floor(x / CELL); const j = Math.floor(y / CELL);
    if (i < 0 || j < 0 || i >= this.cols || j >= this.rows) return null;
    return this.cells[j * this.cols + i];
  }

  itemAt(idx) { return this.items.find((it) => it.cell === idx && !it.taken) || null; }

  /** The map's twist puts its own things in the ground. */
  twistSeed() {
    if (this.twist === 'molehills') {
      // molehills: something small just under the fresh dirt (or a mole)
      for (const c of this.cells) {
        if (!c.molehill || !c.open) continue;
        const it = this.itemAt(c.idx);
        if (it) { it.depth = 1; continue; }
        if (this.r() < 0.7) {
          const t = this.site.treasures.filter((x) => x.rarity === 'common');
          this.items.push({ key: this.r() < 0.5 ? `meadow-${t[Math.floor(this.r() * t.length)].id}` : boneKey(['psitta', 'compy', 'edmonto'][Math.floor(this.r() * 3)], 'tail'), cell: c.idx, depth: 1 });
        }
      }
    }
    if (this.twist === 'ice') for (const it of this.items) it.minQ = 2; // ice keeps finds fine
  }

  // ---------- the clock ----------
  start() { this.phase = 'play'; this.left = GAME_SECONDS; }

  end() {
    this.phase = 'over'; this.overAt = this.t;
    this.kid.digT = -1; this.vis.digT = -1; this.heave = null; this.lift = null;
    if (this.score > this.best) { this.best = this.score; this.newBest = true; }
    const gotKey = this.found.some((f) => f.info.rarity === 'skull' || f.info.rarity === 'special');
    this.onRound?.({ key: gotKey, keyHere: this.keyHere });
    this.dry = gotKey ? 0 : this.dry + 1;
  }

  restart() { this.newRound(); }

  step(dt) {
    this.t += dt;
    this.pops = this.pops.filter((p) => this.t - p.at < 1.6);
    this.sparks = this.sparks.filter((s) => this.t - s.at < s.life);
    this.critters = this.critters.filter((c) => this.t - c.at < 1.4);
    if (this.card && this.t - this.card.at > 2.4) this.card = null;
    if (this.calmAt && this.t > this.calmAt) { this.calmAt = 0; for (const b of [this.kid, this.vis]) b.brain.set(HAPPY); }
    if (!this.card && this.cards.length) { this.card = this.cards.shift(); this.card.at = this.t; }
    for (const p of [this.kid, this.vis]) this.moveBuddy(p, dt);
    this.stepStroke();
    if (this.phase === 'play') {
      if (!this.overtime) this.left -= dt;
      this.stepAI();
      this.stepTwist(dt);
      this.stepGear();
      if (this.giveLater && this.t >= this.giveLater.at) this.gift();
      if (this.left <= GOLDEN && this.left > 0) this.puffs(dt);
      if (this.left <= 0) {
        this.left = 0;
        // a hole started before the buzzer can still be finished
        const c = this.digCell(this.kid); const h = c && this.holes.get(c.idx);
        if (!this.overtime && h && !h.done && h.d > 0 && (h.item || this.stroke)) { this.overtime = this.t; this.overCell = c.idx; this.pop('Finish that hole!', c.x, c.y - 24, '#ffd43b', true); }
        const oh = this.overtime && this.holes.get(this.overCell);
        if (!this.overtime || this.t - this.overtime > OVERTIME || (oh?.done && !this.heave && !this.stroke)) if (!this.stroke) this.end();
      }
    } else if (this.phase === 'ready') {
      this.vis.lookAt = [this.kid.x, this.kid.y];
    }
    // the view follows the kid's buddy
    const tx = clamp(this.kid.x - this.fieldW / 2, 0, this.W - this.fieldW);
    const ty = clamp(this.kid.y - this.fieldH * 0.62, 0, this.H - this.fieldH);
    const k = 1 - Math.exp(-5 * dt);
    this.camX += (tx - this.camX) * k; this.camY += (ty - this.camY) * k;
  }

  moveBuddy(p, dt) {
    if (p.digT >= 0 || (p.heaving && this.t - p.heaving < 0.35)) { p.run = Math.max(0, p.run - dt * 6); return; }
    const px = p.x; const py = p.y;
    p.move(dt);
    if (!this.walkable(p.x, p.y)) {
      if (this.walkable(p.x, py)) p.y = py;
      else if (this.walkable(px, p.y)) p.x = px;
      else { p.x = px; p.y = py; }
      if (Math.hypot(p.x - px, p.y - py) < 0.01) { p.tx = p.x; p.ty = p.y; }
    }
    // moon hops: long floaty bounces
    p.lift = this.twist === 'meteor' && p.run > 0.1 ? Math.round(Math.abs(Math.sin(p.stride * 0.5)) * 6) : 0;
    if (p === this.kid) this.moved += Math.hypot(p.x - px, p.y - py);
  }

  // ---------- digging ----------
  /** The spot a buddy digs: just in front of its feet. */
  digCell(p) {
    const c = this.cellAt(p.x + p.face * 8, p.y);
    if (c && c.open && this.groundAt(c.x, c.y)) return c;
    const d = this.cellAt(p.x, p.y);
    return d && d.open ? d : c;
  }

  tryDig(p, who) {
    const kid = who === 'kid';
    if (kid && this.heave) return this.heaveTap();
    const cur = kid ? this.stroke : this.visStroke;
    if (cur) { if (kid) { this.queued = Math.min(1, this.queued + 1); this.queuedAt = this.t; } return; }
    const c = this.digCell(p);
    if (!c || !c.open || !this.groundAt(c.x, c.y)) { if (kid) this.pop("Can't dig here", p.x, p.y - 28, '#ffc9c9'); return; }
    if (kid && this.overtime && c.idx !== this.overCell) return;
    const h = this.holes.get(c.idx);
    if (h?.done) { if (kid) this.pop(h.found ? 'Already dug' : 'Nothing here', c.x, c.y - 18, '#e9ecef'); return; }
    if (kid && this.t < this.hotUntil) { this.pop('Too hot! Cooling...', p.x, p.y - 28, '#ffa94d'); return; }
    p.tx = p.x; p.ty = p.y;
    if (Math.abs(c.x - p.x) > 2) p.face = c.x > p.x ? 1 : -1;
    // the clean lift: how well this tap met the ring
    let liftQ = 0;
    if (kid && this.lift && this.lift.cell === c.idx) {
      const at = this.queuedAt && this.t - this.queuedAt < 0.5 ? this.queuedAt : this.t;
      const ph = ((at - this.lift.at) % LIFT_RING) / LIFT_RING;
      const off = Math.min(ph, 1 - ph) * LIFT_RING;
      liftQ = at - this.lift.at < 0.12 ? 1 : off <= LIFT_PERFECT ? 3 : off <= LIFT_FINE ? 2 : 1;
      this.lift = null;
    }
    this.queuedAt = 0;
    const s = { c, at: this.t, len: SHOVELS[(kid ? this.tier : this.visTier) - 1].stroke * (kid ? 1 : 1.3), who, liftQ };
    if (kid) this.stroke = s; else this.visStroke = s;
    p.digT = 0;
  }

  stepStroke() {
    for (const who of ['kid', 'vis']) {
      const s = who === 'kid' ? this.stroke : this.visStroke;
      const p = who === 'kid' ? this.kid : this.vis;
      if (!s) continue;
      p.digT = (this.t - s.at) / s.len;
      if (p.digT < 1) continue;
      p.digT = -1;
      if (who === 'kid') this.stroke = null; else this.visStroke = null;
      this.strokeDone(s, p, who);
      if (who === 'kid' && this.queued > 0 && this.phase === 'play') { this.queued -= 1; this.tryDig(p, who); }
    }
  }

  layersFor(c, h, who) {
    const sh = SHOVELS[(who === 'kid' ? this.tier : this.visTier) - 1];
    if (this.layout.hardAt?.(c.x, c.y) && h.d < 1) return 0.5; // ice: the first stroke only cracks it
    if (c.wet) return 2; // wet sand digs fast
    if (h.d === 0 && sh.first > 1) return sh.first;
    return 1;
  }

  strokeDone(s, p, who) {
    const c = s.c; const kid = who === 'kid';
    let h = this.holes.get(c.idx);
    if (!h) {
      h = { d: 0, item: this.itemAt(c.idx), done: false, clinked: false, flecks: null, who };
      this.holes.set(c.idx, h);
    }
    const before = h.d;
    // the castle's odd flagstone: a secret cellar under it
    if (c.flag && !h.cellar) return this.cellar(h, c, p, who);
    h.d = Math.min(MAX_DEPTH, h.d + this.layersFor(c, h, who));
    this.spray(c.x, c.y);
    if (kid) this.sound = 'dig';
    if (kid && c.hot) { this.heat += 1; if (this.heat >= HOT_STROKES) { this.heat = 0; this.hotUntil = this.t + HOT_COOL; this.pop('Shovel too hot!', p.x, p.y - 30, '#ff922b'); } } else if (kid) this.heat = 0;
    const it = h.item;
    const info = it && findInfo(it.key);
    // the first stroke always tells: flecks in the dirt pile
    if (before < 1 && h.d >= 1 && info) {
      h.flecks = this.twist === 'bands' ? BAND[info.rarity] : fleckOf(info);
      if (kid) this.pop(this.twist === 'bands' ? { common: 'Red dirt', uncommon: 'Yellow dirt', rare: 'Violet dirt!' }[info.rarity] || 'Violet dirt!' : FLECK_WORDS[h.flecks], c.x, c.y - 18, this.twist === 'bands' ? h.flecks : '#fff3bf');
    }
    if (it && h.d >= it.depth) return this.reached(h, c, p, who, Math.max(s.liftQ || 1, it.minQ || 1));
    if (it && !h.clinked && h.d >= it.depth - 1) {
      h.clinked = true;
      const voice = CLINK[fleckOf(info)];
      this.pop(`${voice.toUpperCase()}!`, c.x, c.y - 16, '#fff3bf', kid);
      this.spark(c.x, c.y - 2, '#ffffff', 6);
      if (kid) {
        this.sound = `clink-${voice}`; this.buzz = 25;
        this.lift = { cell: c.idx, at: this.t };
        if (info.rarity === 'skull' || info.rarity === 'special' || info.rarity === 'rare') { this.shake = this.t; h.glow = true; }
      }
    }
    if (h.d >= MAX_DEPTH) {
      h.done = true;
      if (kid) this.lift = null;
      this.critter(h, c, who);
    } else if (before === h.d || h.d - before < 1) {
      if (kid) this.pop(this.twist === 'ice' ? 'Crack!' : 'Hard ground!', c.x, c.y - 16, '#a5d8ff');
    }
  }

  /** Reached a find: a big one needs heaving out; the rest pop straight out. */
  reached(h, c, p, who, q) {
    const info = findInfo(h.item.key);
    if (who === 'kid' && (info.rarity === 'skull' || info.rarity === 'special')) {
      this.heave = { h, c, left: HEAVES, q, at: this.t };
      this.lift = null;
      h.silhouette = true;
      this.pop('Something BIG! Heave!', c.x, c.y - 24, RARITY[info.rarity].color, true);
      this.sound = 'big'; this.buzz = [30, 30, 30];
      // the visitor runs over to help lift
      this.ai.cell = -1; this.ai.help = c;
      this.vis.goTo(...this.near(c.x + 12, c.y + 2));
      return;
    }
    this.reveal(h, c, who, q);
  }

  heaveTap(who = 'kid') {
    const hv = this.heave;
    if (!hv) return;
    const p = who === 'kid' ? this.kid : this.vis;
    p.heaving = this.t;
    hv.left -= 1;
    this.spray(hv.c.x, hv.c.y);
    this.sound = 'heave';
    if (who === 'vis') this.pop(`${p.name} helps!`, p.x, p.y - 30, '#ffe8cc');
    if (hv.left > 0) { if (who === 'kid') this.pop(`Heave! ${HEAVES - hv.left}/${HEAVES}`, hv.c.x, hv.c.y - 20, '#ffd43b'); return; }
    this.heave = null; this.ai.help = null;
    this.reveal(hv.h, hv.c, 'kid', hv.q, true);
    for (const b of [this.kid, this.vis]) b.brain.set(THRILLED);
    this.calmAt = this.t + 2.5;
  }

  reveal(h, c, who, q = 1, big = false) {
    const it = h.item; it.taken = true;
    const info = findInfo(it.key);
    const pts = digPoints(it.key, q);
    this.points[who] += pts;
    h.found = true; h.flag = RARITY[info.rarity].color;
    h.reveal = { key: it.key, at: this.t, who };
    if (who === 'kid') {
      const bucket = info.kind === 'bone' ? 'bones' : 'treasures';
      const had = this.owned[bucket][it.key];
      this.owned[bucket][it.key] = { n: (had?.n || 0) + 1, q: Math.max(had?.q || 0, q) };
      const ans = this.onFind?.({ key: it.key, kind: info.kind, q, map: this.map });
      const fresh = ans ? ans === 'new' : !had;
      const prog = info.dino ? skeletonProgress(info.dino.id, this.owned.bones) : null;
      const done = prog && prog.have === prog.total && fresh;
      let total = pts;
      if (done) { this.points.kid += 200; total += 200; }
      this.score = this.points.kid;
      this.found.push({ key: it.key, info, fresh, done, q });
      this.cards.push({ key: it.key, info, fresh, better: ans === 'better', prog, done, q, pts: total });
      if (!this.card) { this.card = this.cards.shift(); this.card.at = this.t; }
      this.sound = done || big ? 'fanfare' : 'find';
      this.buzz = [20, 40, 40];
      this.spark(c.x, c.y - 4, RARITY[info.rarity].color, big ? 30 : info.rarity === 'common' ? 10 : 18);
      if (this.score > this.best) this.newBest = true;
      // bone beds: chips on the ground point toward the next bone of the bed
      if (it.bed) {
        const next = this.items.filter((o) => !o.taken && o.bed === it.bed).map((o) => this.cells[o.cell]).sort((a, b) => Math.hypot(a.x - c.x, a.y - c.y) - Math.hypot(b.x - c.x, b.y - c.y))[0];
        if (next) this.chips.push({ x0: c.x, y0: c.y, x1: next.x, y1: next.y, at: this.t });
      }
      if (this.twist === 'stars') this.starStep(c);
    } else {
      this.visFound.push({ key: it.key, info });
      this.pop(`${this.vis.name}: ${info.short || info.name}!`, c.x, c.y - 26, '#ffe8cc');
      this.spark(c.x, c.y - 4, RARITY[info.rarity].color, 8);
      // a bone the kid still needs: the visitor hands it over, once a round
      if (info.kind === 'bone' && !this.owned.bones[it.key] && !this.gifted) { this.gifted = true; this.giveLater = { key: it.key, at: this.t + 0.9 }; }
    }
    // the golden shovel: sometimes there's more underneath
    if (it.under && who === 'kid') {
      h.item = { key: it.under, cell: it.cell, depth: Math.min(MAX_DEPTH, it.depth + 1) };
      this.items.push(h.item);
      h.done = false; h.clinked = false;
      this.pop("There's more!", c.x, c.y - 30, '#ffd43b');
    } else h.done = true;
  }

  gift() {
    const key = this.giveLater.key; this.giveLater = null;
    const info = findInfo(key);
    this.owned.bones[key] = { n: 1, q: 1 };
    const ans = this.onFind?.({ key, kind: 'bone', q: 1, map: this.map, gift: true });
    const prog = skeletonProgress(info.dino.id, this.owned.bones);
    this.cards.push({ key, info, fresh: ans ? ans === 'new' : true, prog, pts: 0, gift: this.vis.name, q: 1 });
    this.found.push({ key, info, fresh: true, gift: true, q: 1 });
    this.sound = 'find';
  }

  critter(h, c, who) {
    if (who !== 'kid') return;
    const chance = c.molehill ? 1 : CRITTER_CHANCE;
    if (this.r() >= chance) { this.pop('Nothing here', c.x, c.y - 16, '#ced4da'); return; }
    const list = c.molehill ? [['mole', 'Mole']] : CRITTERS[this.map] || CRITTERS.default;
    const [id, name] = list[Math.floor(this.r() * list.length)];
    this.points.kid += 1; this.score = this.points.kid;
    this.critters.push({ id, x: c.x, y: c.y, dir: this.r() < 0.5 ? -1 : 1, at: this.t });
    this.pop(`${name}! +1`, c.x, c.y - 16, RARITY.critter.color);
    this.sound = 'critter';
  }

  cellar(h, c, p, who) {
    h.cellar = true; h.done = true; h.d = 2; h.found = true; h.flag = '#ffd43b';
    if (who !== 'kid') return;
    this.pop('A secret cellar!', c.x, c.y - 24, '#ffd43b', true);
    this.sound = 'fanfare';
    const list = this.site.treasures.filter((t) => t.rarity !== 'rare');
    for (let k = 0; k < 3; k += 1) {
      const t = list[Math.floor(this.r() * list.length)];
      const key = `castle-${t.id}`;
      const it = { key, cell: c.idx, depth: 0 };
      this.items.push(it);
      this.reveal({ item: it, d: 2 }, c, 'kid', 2);
    }
  }

  // ---------- each map's twist ----------
  stepTwist(dt) {
    const done = GAME_SECONDS - this.left;
    if (this.twist === 'tide') this.tide = Math.min(TIDE_OUT, (done / GAME_SECONDS) * TIDE_OUT * 1.15);
    if (this.twist === 'current' && done >= this.nextCurrent) {
      this.nextCurrent += CURRENT_EVERY;
      // a current sweeps the sand: a ripple mound shows over something shallow
      const cands = this.items.filter((it) => !it.taken && !this.holes.get(it.cell) && it.depth <= 3);
      const it = cands.sort((a, b) => this.dist(a) - this.dist(b))[Math.floor(this.r() * Math.min(3, cands.length))];
      if (it) { it.depth = 1; it.ripple = this.t; this.pop('A current sweeps the sand!', this.kid.x, this.kid.y - 32, '#a5d8ff'); this.sound = 'whoosh'; }
    }
    if (this.twist === 'rain' && !this.rained && done >= 45) {
      this.rained = this.t;
      this.pop('Rain!', this.kid.x, this.kid.y - 32, '#a5d8ff', true);
      this.sound = 'rain';
    }
    if (this.twist === 'rain' && this.rained && !this.washed && this.t - this.rained > 3.5) {
      this.washed = true;
      // the rain washed the banks: bone tips poke out
      const bones = this.items.filter((it) => !it.taken && !this.holes.get(it.cell) && findInfo(it.key).kind === 'bone');
      bones.sort((a, b) => this.cells[b.cell].like.bone - this.cells[a.cell].like.bone);
      for (const it of bones.slice(0, 3)) { it.tip = true; it.depth = Math.min(it.depth, 2); }
    }
    if (this.twist === 'meteor' && !this.meteor && done >= 42) {
      const cands = this.cells.filter((c) => c.open && !this.holes.get(c.idx) && !this.itemAt(c.idx) && Math.abs(c.x - this.kid.x) < this.fieldW * 0.4 && Math.abs(c.x - this.kid.x) > 30);
      const c = cands[Math.floor(this.r() * cands.length)];
      if (c) {
        this.meteor = { c, at: this.t };
        const keyLeft = !this.keyHere || this.found.some((f) => f.info.rarity === 'special');
        const rare = this.site.treasures.find((t) => t.rarity === 'rare');
        const special = this.site.special && !this.keyHere && this.r() < 0.35;
        this.items.push({ key: `space-${special ? this.site.special.id : rare.id}`, cell: c.idx, depth: 2, fresh: true });
        if (!keyLeft) {} // eslint-disable-line no-empty
        this.sound = 'meteor';
      }
    }
  }

  dist(it) { const c = this.cells[it.cell]; return Math.hypot(c.x - this.kid.x, c.y - this.kid.y); }

  /** The galaxy: each find lights a star; a line points to the next spot; five stars: a rare one. */
  starStep(c) {
    this.stars += 1;
    const left = this.items.filter((it) => !it.taken && !this.holes.get(it.cell)?.done);
    left.sort((a, b) => Math.hypot(this.cells[a.cell].x - c.x, this.cells[a.cell].y - c.y) - Math.hypot(this.cells[b.cell].x - c.x, this.cells[b.cell].y - c.y));
    const next = left[0];
    if (this.stars >= STAR_CHAIN && next) {
      this.stars = 0;
      const rare = this.site.treasures.find((t) => t.rarity === 'rare');
      const special = this.site.special && !this.keyHere && this.r() < 0.4;
      next.key = `galaxy-${special ? this.site.special.id : rare.id}`;
      this.pop('Constellation! A rare one is near!', c.x, c.y - 34, '#ffd43b', true);
      this.sound = 'fanfare';
    }
    if (next) this.starLine = { x0: c.x, y0: c.y, x1: this.cells[next.cell].x, y1: this.cells[next.cell].y, at: this.t };
  }

  // ---------- the better shovels ----------
  stepGear() {
    const moving = Math.hypot(this.kid.tx - this.kid.x, this.kid.ty - this.kid.y) > 0.8;
    // the steel spade: when the buddy stops after a walk, it taps the ground
    if (this.shovel.test && this.wasMoving && !moving && this.moved > 10) {
      const c = this.digCell(this.kid);
      if (c && c.open) {
        const near = this.items.some((it) => !it.taken && Math.abs(this.cells[it.cell].i - c.i) <= 1 && Math.abs(this.cells[it.cell].j - c.j) <= 1 && !this.holes.get(it.cell)?.done);
        this.pop(near ? 'tok!' : 'thud', c.x, c.y - 12, near ? '#ffd43b' : '#adb5bd');
        this.sound = near ? 'tok' : 'thud';
      }
      this.moved = 0;
    }
    if (moving) this.wasMoving = true; else { this.wasMoving = false; if (!moving) this.moved = 0; }
  }

  puffs(dt) {
    for (const it of this.items) {
      if (it.taken || this.r() > dt * 0.6) continue;
      const c = this.cells[it.cell];
      if (!this.groundAt(c.x, c.y)) continue;
      for (let k = 0; k < 3; k += 1) this.sparks.push({ x: c.x + (this.r() - 0.5) * 6, y: c.y, vx: (this.r() - 0.5) * 6, vy: -8 - this.r() * 8, at: this.t, life: 0.9, color: 'rgba(255,244,214,0.7)', puff: true });
    }
  }

  spray(x, y) {
    const col = this.look.dirt[1];
    for (let k = 0; k < 7; k += 1) {
      const a = -Math.PI / 2 + (this.r() - 0.5) * 2.2; const v = 22 + this.r() * 26;
      this.sparks.push({ x, y: y - 1, vx: Math.cos(a) * v, vy: Math.sin(a) * v, at: this.t, life: 0.45, color: k % 3 ? col : this.look.dirt[0], dirt: true });
    }
  }

  spark(x, y, color, n) {
    for (let k = 0; k < n; k += 1) {
      const a = this.r() * Math.PI * 2; const v = 10 + this.r() * 30;
      this.sparks.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 12, at: this.t, life: 0.5 + this.r() * 0.4, color });
    }
  }

  pop(text, x, y, color, big) { addPop(this, text, x, y, color, big, Infinity); }

  // ---------- the visitor ----------
  stepAI() {
    const v = this.vis;
    if (this.visStroke) return;
    if (this.ai.help) {
      // helping heave a big find out
      const c = this.ai.help;
      if (Math.hypot(v.x - v.tx, v.y - v.ty) < 2 && this.heave && !(v.heaving > this.heave.at)) {
        v.face = c.x > v.x ? 1 : -1;
        this.heaveTap('vis');
      }
      if (!this.heave) this.ai.help = null;
      return;
    }
    const c = this.ai.cell >= 0 ? this.cells[this.ai.cell] : null;
    if (c) {
      const h = this.holes.get(c.idx);
      const spot = [c.x - 8, c.y];
      const there = Math.hypot(v.x - spot[0], v.y - spot[1]) < 2.5;
      if (h?.done) { this.ai.cell = -1; this.ai.next = this.t + 0.6 + this.r() * 0.8; return; }
      if (there) { v.face = 1; this.tryDig(v, 'vis'); return; }
      if (Math.hypot(v.tx - spot[0], v.ty - spot[1]) > 1) v.goTo(...spot);
      if (this.t - this.ai.since > 6) this.ai.cell = -1;
      return;
    }
    if (this.t < this.ai.next) return;
    let best = null; let bs = -1;
    for (let k = 0; k < 40; k += 1) {
      const cc = this.cells[Math.floor(this.r() * this.cells.length)];
      if (!cc.open || !this.groundAt(cc.x, cc.y) || this.holes.get(cc.idx)?.done || !this.walkable(cc.x - 8, cc.y)) continue;
      const d = Math.hypot(cc.x - v.x, cc.y - v.y);
      if (d > 140) continue;
      const near = Math.hypot(cc.x - this.kid.x, cc.y - this.kid.y) < 40 ? 0.2 : 1;
      const s = (0.3 + cc.like.bone + cc.like.gem * 0.7 + cc.like.made * 0.7) * near * (0.6 + this.r() * 0.8) / (1 + d / 90);
      if (s > bs) { bs = s; best = cc; }
    }
    if (best) { this.ai.cell = best.idx; this.ai.since = this.t; }
  }

  // ---------- input (in view pixels) ----------
  get button() { return { x: this.vW - 22, y: this.vH - 24, r: 17 }; }
  onButton(x, y) { const b = this.button; return Math.hypot(x - b.x, y - b.y) <= b.r + 3; }

  tap(x, y) {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.restart(); return; }
    if (this.locked) return;
    if (this.phase === 'ready') { if (this.onButton(x, y)) { this.press(); return; } this.start(); }
    if (this.heave) return; // hold still while heaving
    if (this.overtime) return;
    const wx = this.camX + x * this.zoom; const wy = this.camY + y * this.zoom;
    const [tx, ty] = this.near(wx, wy);
    this.queued = 0; this.lift = null;
    this.kid.goTo(tx, ty);
    this.tapMark = { x: tx, y: ty, at: this.t };
  }

  press() {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.restart(); return; }
    if (this.locked) return;
    if (this.phase === 'ready') this.start();
    this.tryDig(this.kid, 'kid');
  }

  drag() {}
  release() {}

  // ---------- drawing ----------
  draw(ctx) {
    const Z = this.Z;
    let cx = Math.round(this.camX * Z) / Z; let cy = Math.round(this.camY * Z) / Z;
    if (this.shake && this.t - this.shake < 0.25) { cx += Math.round(Math.sin(this.t * 90)) / Z; }
    ctx.imageSmoothingEnabled = false;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(this.field, -cx * Z, -cy * Z);
    ctx.setTransform(Z, 0, 0, Z, -cx * Z, -cy * Z);
    drawTwistDecals(ctx, this, Z);
    // holes
    for (const [idx, h] of this.holes) drawHole(ctx, this.look, this.cells[idx].x, this.cells[idx].y, h, this.t, Z);
    // bone-bed chips and the galaxy's star line
    for (const ch of this.chips) {
      const n = Math.max(2, Math.floor(Math.hypot(ch.x1 - ch.x0, ch.y1 - ch.y0) / 5));
      const show = Math.min(n - 1, Math.floor((this.t - ch.at) * 10));
      for (let k = 1; k <= show; k += 1) {
        if (k === n) break;
        const x = ch.x0 + ((ch.x1 - ch.x0) * k) / n + Math.sin(k * 2.3) * 1.5; const y = ch.y0 + ((ch.y1 - ch.y0) * k) / n + 3;
        ctx.fillStyle = '#f1e6c8'; ctx.fillRect(Math.round(x * Z) / Z, Math.round(y * Z) / Z, 1, 1 / Z);
        ctx.fillStyle = '#8d7a5a'; ctx.fillRect(Math.round(x * Z) / Z, Math.round(y * Z) / Z + 1 / Z, 1, 1 / Z);
      }
    }
    if (this.starLine && this.t - this.starLine.at < 7) {
      const s = this.starLine; const a = 1 - (this.t - s.at) / 7;
      const n = Math.floor(Math.hypot(s.x1 - s.x0, s.y1 - s.y0) / 4);
      ctx.globalAlpha = a * (0.6 + 0.4 * Math.sin(this.t * 6));
      ctx.fillStyle = '#fff3bf';
      for (let k = 1; k < n - 1; k += 2) ctx.fillRect(Math.round((s.x0 + ((s.x1 - s.x0) * k) / n) * Z) / Z, Math.round((s.y0 + ((s.y1 - s.y0) * k) / n) * Z) / Z, 1, 1);
      ctx.globalAlpha = 1;
    }
    // the golden shovel: buried things nearby twinkle
    if (this.shovel.sense && this.phase === 'play') {
      const R = this.shovel.sense * CELL;
      for (const it of this.items) {
        if (it.taken) continue;
        const c = this.cells[it.cell];
        if (Math.hypot(c.x - this.kid.x, c.y - this.kid.y) > R || !this.groundAt(c.x, c.y)) continue;
        const ph = (this.t * 1.6 + it.cell * 0.37) % 1;
        if (ph > 0.35) continue;
        const k = 1 - Math.abs(ph - 0.17) / 0.17; const x = Math.round(c.x + Math.sin(it.cell) * 3); const y = Math.round(c.y - 1);
        ctx.fillStyle = '#fff9db';
        ctx.fillRect(x, y, 1, 1); if (k > 0.4) { ctx.fillRect(x - 1, y, 3, 1 / Z); ctx.fillRect(x, y - 1, 1 / Z, 3); }
      }
    }
    // bone tips after the rain, and ripple mounds from the current
    for (const it of this.items) {
      if (it.taken || this.holes.get(it.cell)) continue;
      const c = this.cells[it.cell];
      if (it.tip) { ctx.fillStyle = INK; ctx.fillRect(c.x - 2, c.y - 1, 5, 2); ctx.fillStyle = '#f1e6c8'; ctx.fillRect(c.x - 1.5, c.y - 1, 4, 1); ctx.fillRect(c.x + 2, c.y - 1.5, 1, 1); }
      if (it.ripple) for (let k = 0; k < 3; k += 1) { ctx.fillStyle = k % 2 ? '#fff4e6' : '#cdb88a'; ctx.fillRect(c.x - 5 + k, c.y - 2 + k * 1.5, 10 - k * 2, 1 / Z * 2); }
    }
    // where the kid tapped
    if (this.tapMark && this.t - this.tapMark.at < 0.6) {
      const a = (this.t - this.tapMark.at) / 0.6; const c = this.cellAt(this.tapMark.x + this.kid.face * 8, this.tapMark.y);
      if (c) {
        ctx.globalAlpha = 1 - a; ctx.fillStyle = '#ffffff';
        const x0 = c.i * CELL; const y0 = c.j * CELL; const L = 4;
        for (const [px, py, dx, dy] of [[x0, y0, 1, 1], [x0 + CELL, y0, -1, 1], [x0, y0 + CELL, 1, -1], [x0 + CELL, y0 + CELL, -1, -1]]) { ctx.fillRect(px - (dx < 0 ? L : 0), py - (dy < 0 ? 1 : 0), L, 1); ctx.fillRect(px - (dx < 0 ? 1 : 0), py - (dy < 0 ? L : 0), 1, L); }
        ctx.globalAlpha = 1;
      }
    }
    // things standing up and the buddies, in y order
    const things = this.props.map((p) => ({ y: p.y, draw: () => ctx.drawImage(p.art.pic, p.x - p.art.fx / Z, p.y - p.art.fy / Z, p.art.pic.width / Z, p.art.pic.height / Z) }));
    for (const p of [this.vis, this.kid]) {
      things.push({ y: p.y + 0.5, draw: () => {
        p.paint(this.t);
        this.drawShovel(ctx, p, p === this.kid ? this.tier : this.visTier, 'back');
        const lift = p.lift || 0;
        if (p.digT >= 0) p.lift = Math.round(Math.max(0, Math.sin(p.digT * Math.PI)) * 1.5);
        if (p.heaving && this.t - p.heaving < 0.3) p.lift = 2;
        p.draw(ctx);
        p.lift = lift;
        this.drawShovel(ctx, p, p === this.kid ? this.tier : this.visTier, 'front');
      } });
    }
    for (const cr of this.critters) things.push({ y: cr.y, draw: () => {
      const k = (this.t - cr.at) / 1.4; const pic = critterPic(cr.id);
      const x = cr.x + cr.dir * Math.max(0, k - 0.35) * 40; const y = cr.y - 2 - Math.sin(Math.min(1, k * 3) * Math.PI / 2) * 4 + Math.max(0, k - 0.35) * 4;
      ctx.save(); ctx.translate(Math.round(x), Math.round(y)); if (cr.dir < 0) ctx.scale(-1, 1); ctx.drawImage(pic, -pic.width / 2, -pic.height); ctx.restore();
    } });
    things.sort((a, b) => a.y - b.y).forEach((o) => o.draw());
    // a big find's shape showing in the hole while it's heaved
    if (this.heave) {
      const c = this.heave.c; const pic = findPic(this.heave.h.item.key);
      const up = ((HEAVES - this.heave.left) / HEAVES) * 6;
      ctx.globalAlpha = 0.85; ctx.filter = 'brightness(0.25)';
      ctx.drawImage(pic, Math.round(c.x - pic.width / 2), Math.round(c.y - 2 - up - pic.height / 2));
      ctx.filter = 'none'; ctx.globalAlpha = 1;
    }
    // finds popping out of their holes
    for (const [idx, h] of this.holes) {
      if (!h.reveal) continue;
      const a = (this.t - h.reveal.at) / 0.9; if (a > 1) continue;
      const c = this.cells[idx];
      const pic = findPic(h.reveal.key);
      const up = Math.sin(Math.min(1, a * 1.4) * Math.PI / 2) * 16;
      ctx.drawImage(pic, Math.round(c.x - pic.width / 2), Math.round(c.y - 4 - up - pic.height / 2));
    }
    // the meteor coming down
    if (this.meteor && this.t - this.meteor.at < 1.2) {
      const k = (this.t - this.meteor.at) / 1.2; const c = this.meteor.c;
      const x = c.x + (1 - k) * 80; const y = c.y - (1 - k) * 120;
      for (let q = 0; q < 10; q += 1) { ctx.fillStyle = q < 3 ? '#ffffff' : q < 6 ? '#ffd43b' : '#ff922b'; ctx.fillRect(Math.round(x + q * 3), Math.round(y - q * 4.5), 2, 2); }
      if (k > 0.95) this.shake = this.t;
    }
    // dirt, sparkles and dust puffs
    for (const s of this.sparks) {
      const k = this.t - s.at;
      const x = s.x + s.vx * k; const y = s.y + s.vy * k + (s.dirt ? 140 : s.puff ? 0 : 40) * k * k;
      ctx.globalAlpha = s.dirt ? 1 : Math.max(0, 1 - k / s.life);
      ctx.fillStyle = s.color; ctx.fillRect(Math.round(x * Z) / Z, Math.round(y * Z) / Z, s.puff ? 2 : 1, s.puff ? 2 : 1);
    }
    ctx.globalAlpha = 1;
    // rain on the rainforest
    if (this.twist === 'rain' && this.rained && this.t - this.rained < 3.5) {
      ctx.fillStyle = 'rgba(165,216,255,0.75)';
      for (let k = 0; k < 140; k += 1) {
        const x = this.camX + ((k * 37.3 + this.t * 30) % this.fieldW); const y = this.camY + ((k * 23.7 + this.t * 220) % this.fieldH);
        ctx.fillRect(Math.round(x), Math.round(y), 1 / Z, 3);
      }
    }
    // the sea on the beach (it goes out)
    if (this.twist === 'tide') drawTwistDecals(ctx, this, Z, 'sea');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  drawShovel(ctx, p, tier, layer) {
    const pic = shovelPic(tier);
    const digging = p.digT >= 0 || (p.heaving && this.t - p.heaving < 0.35);
    if (digging !== (layer === 'front')) return;
    ctx.save();
    ctx.translate(Math.round(p.x), Math.round(p.y) - (p.lift || 0));
    if (p.face < 0) ctx.scale(-1, 1);
    if (digging) {
      const k = p.digT >= 0 ? p.digT : (this.t - p.heaving) / 0.35;
      const down = k < 0.45 ? k / 0.45 : 1 - (k - 0.45) / 0.55;
      const ang = k < 0.45 ? 0.5 - down * 0.4 : 0.1 - (1 - down) * 1.2;
      ctx.translate(8, -9 + down * 6);
      ctx.rotate(ang);
      if (p === this.kid && this.t < this.hotUntil) ctx.filter = 'sepia(1) saturate(6) hue-rotate(-20deg)';
      ctx.drawImage(pic, -3.5, -8);
      ctx.filter = 'none';
    } else {
      ctx.translate(-5, -15);
      ctx.rotate(-0.5);
      ctx.drawImage(pic, -3.5, -8);
    }
    ctx.restore();
  }

  drawHud(ctx, scale) {
    const S = scale; const W = this.vW * S; const H = this.vH * S; const k = S / this.zoom;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const u = S * 4;
    const text = (s, x, y, px, color = '#ffffff', align = 'center') => {
      ctx.textAlign = align;
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = INK;
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
      ctx.textAlign = 'center';
    };
    const X = (x) => (x - this.camX) * k; const Y = (y) => (y - this.camY) * k;
    const shownPops = this.pops.slice(-3);
    shownPops.forEach((p, i) => { p.stack = (shownPops.length - 1 - i); });
    for (const p of shownPops) {
      const a = (this.t - p.at) / 1.6;
      ctx.globalAlpha = Math.max(0, 1 - a * a);
      text(p.text, X(p.x), Y(p.y) - a * u * 3 - p.stack * u * 1.6, p.big ? u * 1.9 : u * 1.25, p.color);
    }
    ctx.globalAlpha = 1;
    text(this.kid.name, X(this.kid.x), Y(this.kid.y) + u * 1.2, u * 0.95, '#ffd43b');
    text(this.vis.name, X(this.vis.x), Y(this.vis.y) + u * 1.2, u * 0.95, '#ffffff');
    // top bar
    const secs = Math.ceil(Math.max(0, this.left));
    text(`${this.points.kid}`, u * 1.5, u * 1.8, u * 2.2, '#ffd43b', 'left');
    text(this.overtime ? 'Finish it!' : `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 1.8, u * 2, (secs <= GOLDEN && this.phase === 'play') ? '#ffd43b' : '#ffffff');
    text(this.site.name, W - u * 1.5, u * 1.25, u * 1.25, '#ffffff', 'right');
    text(`${this.today.name} day!`, W - u * 1.5, u * 2.65, u * 1.0, '#ffe066', 'right');
    if (this.twist === 'stars') for (let s = 0; s < STAR_CHAIN; s += 1) text('★', W / 2 + u * 5 + s * u * 1.4, u * 1.8, u * 1.4, s < this.stars ? '#ffd43b' : 'rgba(255,255,255,0.3)');
    // the dig button, and the clean-lift ring closing on it
    const b = this.button;
    const on = this.stroke != null || this.heave;
    ctx.beginPath(); ctx.arc(b.x * S, b.y * S, b.r * S, 0, Math.PI * 2);
    ctx.fillStyle = this.heave ? 'rgba(255,146,43,0.92)' : on ? 'rgba(255,212,59,0.9)' : 'rgba(27,20,48,0.72)'; ctx.fill();
    ctx.lineWidth = S * 1.2; ctx.strokeStyle = on ? '#fff3bf' : '#ffd43b'; ctx.stroke();
    if (this.lift && this.phase === 'play') {
      const ph = ((this.t - this.lift.at) % LIFT_RING) / LIFT_RING;
      const rr = b.r * (1 + (1 - ph) * 1.3);
      ctx.beginPath(); ctx.arc(b.x * S, b.y * S, rr * S, 0, Math.PI * 2);
      ctx.lineWidth = S * (ph > 0.85 || ph < 0.05 ? 1.6 : 0.9); ctx.strokeStyle = ph > 0.85 || ph < 0.05 ? '#8ce99a' : '#fff3bf'; ctx.stroke();
    }
    ctx.imageSmoothingEnabled = false;
    const sp = shovelPic(this.tier);
    ctx.save(); ctx.translate(b.x * S, (b.y - 4) * S); ctx.rotate(-0.6);
    ctx.drawImage(sp, -sp.width * S * 0.45, -sp.height * S * 0.45, sp.width * S * 0.9, sp.height * S * 0.9);
    ctx.restore();
    text(this.heave ? 'HEAVE!' : 'DIG', b.x * S, (b.y + 9) * S, u * 1.5, on ? INK : '#ffffff');
    // the depth of the hole in front of the kid's buddy
    const c = this.digCell(this.kid);
    const h = c && this.holes.get(c.idx);
    if (this.phase === 'play' && c?.open) {
      const mw = 7 * S; const mx = (b.x - b.r - 12) * S; const my = (b.y - 14) * S; const mh = 28 * S;
      ctx.fillStyle = INK; ctx.fillRect(mx - S * 0.6, my - S * 0.6, mw + S * 1.2, mh + S * 1.2);
      for (let q = 0; q < MAX_DEPTH; q += 1) {
        const yy = my + (q / MAX_DEPTH) * mh;
        ctx.fillStyle = h && h.d > q ? this.look.layers[q] : 'rgba(80,70,110,0.9)';
        ctx.fillRect(mx, yy + S * 0.3, mw, mh / MAX_DEPTH - S * 0.6);
      }
      if (h && h.d > 0) {
        const yy = my + ((Math.ceil(h.d) - 0.5) / MAX_DEPTH) * mh;
        ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(mx - S * 3, yy - S * 1.4); ctx.lineTo(mx - S * 0.8, yy); ctx.lineTo(mx - S * 3, yy + S * 1.4); ctx.fill();
      }
    }
    // the find tray along the bottom
    const tray = this.found.slice(this.card ? -4 : -8);
    if (tray.length) {
      const sz = u * 2.6; const gap = u * 0.4; const ty = H - sz - u * 0.7;
      tray.forEach((f, q) => {
        const x0 = u * 0.7 + q * (sz + gap);
        ctx.fillStyle = f.fresh ? '#ffd43b' : INK; ctx.fillRect(x0 - S * 0.6, ty - S * 0.6, sz + S * 1.2, sz + S * 1.2);
        ctx.fillStyle = '#f4e8d0'; ctx.fillRect(x0, ty, sz, sz);
        const pic = findPic(f.key); const s = Math.min((sz - S * 2) / pic.width, (sz - S * 2) / pic.height);
        ctx.drawImage(pic, x0 + (sz - pic.width * s) / 2, ty + (sz - pic.height * s) / 2, pic.width * s, pic.height * s);
      });
    }
    if (this.card) this.drawCard(ctx, S, u, text);
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) {
      text(this.locked ? "That's all our games today!" : 'Tap the ground to walk. Tap DIG to dig!', W / 2, H * 0.32, u * 1.7);
      text(this.site.tip, W / 2, H * 0.32 + u * 2.3, u * 1.25, '#e9ecef');
      text(`${this.today.name} day: lots of ${this.today.name} bones today!`, W / 2, H * 0.32 + u * 4.2, u * 1.1, '#ffe066');
    }
    if (this.phase === 'over' && this.t - this.overAt > 0.3) this.drawOver(ctx, S, u, text, W, H);
  }

  drawCard(ctx, S, u, text) {
    const W = this.vW * S; const H = this.vH * S;
    const c = this.card; const a = Math.min(1, (this.t - c.at) / 0.18);
    const cw = Math.min(W * 0.5, u * 26); const ch = u * 4.6;
    const x0 = W / 2 - cw / 2; const y0 = H - ch - u * 0.7 + (1 - a) * u * 4;
    const col = RARITY[c.info.rarity].color;
    ctx.fillStyle = INK; ctx.fillRect(x0 - S, y0 - S, cw + 2 * S, ch + 2 * S);
    ctx.fillStyle = '#2b2146'; ctx.fillRect(x0, y0, cw, ch);
    ctx.fillStyle = col; ctx.fillRect(x0, y0, S, ch);
    const pic = findPic(c.key);
    const box = u * 3.8; const ps = Math.min(box / pic.height, box / pic.width);
    ctx.fillStyle = '#f4e8d0'; ctx.fillRect(x0 + u * 0.6, y0 + u * 0.4, box, box);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(pic, x0 + u * 0.6 + (box - pic.width * ps) / 2, y0 + u * 0.4 + (box - pic.height * ps) / 2, pic.width * ps, pic.height * ps);
    const tx = x0 + u * 5;
    text(c.info.name, tx, y0 + u * 1.25, u * 1.35, '#ffffff', 'left');
    const cond = CONDITIONS[c.q || 1];
    const tag = c.gift ? `A gift from ${c.gift}!` : `${RARITY[c.info.rarity].name} · ${cond.stars} ${cond.name} · +${c.pts}`;
    text(tag, tx, y0 + u * 2.4, u * 0.95, col, 'left');
    if (c.prog) {
      const label = c.done ? 'Skeleton complete! +200' : `${c.prog.have} of ${c.prog.total} bones`;
      ctx.font = `${Math.round(u * 0.95)}px "Jersey 10", monospace`;
      const lw = ctx.measureText(label).width + u * 0.6;
      const bw = cw - u * 5.6 - lw; const by = y0 + u * 3.3;
      ctx.fillStyle = '#495057'; ctx.fillRect(tx, by, bw, u * 0.7);
      ctx.fillStyle = c.prog.have === c.prog.total ? '#ffd43b' : '#8ce99a';
      ctx.fillRect(tx, by, (bw * c.prog.have) / c.prog.total, u * 0.7);
      text(label, tx + bw + u * 0.5, by + u * 0.35, u * 0.95, c.done ? '#ffd43b' : '#e9ecef', 'left');
    } else if (c.better) text('Better than the one you had!', tx, y0 + u * 3.6, u * 0.95, '#b2f2bb', 'left');
    if (c.fresh && Math.floor(this.t * 4) % 2) text('NEW!', x0 + cw - u * 1.8, y0 + u * 1.25, u * 1.3, '#ffd43b');
  }

  drawOver(ctx, S, u, text, W, H) {
    const cy = H * 0.5;
    const bw = Math.min(W * 0.88, u * 42); const bh = u * 15;
    ctx.fillStyle = 'rgba(27,20,48,0.92)'; ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
    ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
    text(`Time's up! ${this.points.kid} points`, W / 2, cy - u * 5.3, u * 2.4, '#ffd43b');
    // the round's finds, popping in one by one with NEW! stamps
    const list = this.found.slice(0, 12); const n = list.length; const sz = u * 2.7; const gap = u * 0.45;
    const x0 = W / 2 - (n * (sz + gap) - gap) / 2;
    const shown = Math.floor((this.t - this.overAt - 0.3) / 0.18);
    list.forEach((f, q) => {
      if (q > shown) return;
      const pic = findPic(f.key); const s = Math.min(sz / pic.width, sz / pic.height);
      ctx.drawImage(pic, x0 + q * (sz + gap) + (sz - pic.width * s) / 2, cy - u * 3, pic.width * s, pic.height * s);
      if (f.fresh) text('NEW', x0 + q * (sz + gap) + sz / 2, cy - u * 3.3, u * 0.8, '#ffd43b');
    });
    if (!n) text('No finds this time. Try the foot of the cliff, or by the rocks!', W / 2, cy - u * 1.8, u * 1.25, '#e9ecef');
    const fresh = this.found.filter((f) => f.fresh).length;
    text(`${n} ${n === 1 ? 'find' : 'finds'}${fresh ? ` · ${fresh} new for your dig book` : ''} · ${this.vis.name} got ${this.points.vis}`, W / 2, cy + u * 1.3, u * 1.3, '#e9ecef');
    text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, cy + u * 3.2, u * 1.5, this.newBest ? '#b2f2bb' : '#e9ecef');
    if (this.t - this.overAt > 1.2) text('Tap to dig again', W / 2, cy + u * 5.3, u * 1.3, '#ffffff');
  }
}
