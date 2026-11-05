// Hockey with a visiting buddy: a top-down rink, two small goals, 60 seconds.
//
// Tap (or drag) on the ice and your buddy skates there. Whoever has the puck
// skates 15% slower. Press and hold the round button: a needle sweeps over red,
// yellow and a thin green band; let go to shoot (if you have the puck) or to
// steal (if you're close to the buddy who has it). The color decides the odds:
//   shot:  red 5%, yellow 25%, green 55% to score from close in (the aim is a
//          random angle, so from farther away the goal is a smaller target)
//   steal: green 80% steal / 20% knocked loose / 0% kept,
//          yellow 50 / 40 / 10, red 20 / 30 / 50.
// A shot that runs into the other buddy is theirs. A missed shot bounces off the
// boards and slows down until somebody picks it up. Losing the puck to a steal
// or a knock freezes you for a second. The visitor plays by the same rules.
//
// The rink is longer than the screen: the view slides along to keep your buddy
// in sight, and an arrow at the edge points to the puck when it's off screen.
//
// Same interface as Play in play.js (tap, drag, step, draw, drawHud), plus
// press() / release() for the button.
import { Player, playLook, rng, canvas, cellsCanvas, clamp, HAPPY } from './play.js';
import { ballCells } from './avatar.js';

export const GAME_SECONDS = 60;
export const SHOT_ODDS = { red: 0.05, yellow: 0.25, green: 0.55 };
/** [steal, knocked loose, kept] */
export const STEAL_ODDS = { green: [0.8, 0.2, 0], yellow: [0.5, 0.4, 0.1], red: [0.2, 0.3, 0.5] };
// For an aim error drawn from a normal curve, P(|error| < z * sigma) = the shot odds
export const Z = { red: 0.0627, yellow: 0.3186, green: 0.7554 };

const SKATE = 66; // top speed, pixels a second
const CARRY = 0.85; // with the puck
const GLIDE = 4.5; // how quickly skating speed follows where you're heading
const PUCK_KEEP = 0.55; // a sliding puck keeps this much of its speed each second
const SHOT_SPEED = 230;
const PICKUP = 7;
const STEAL_REACH = 17;
const MOUTH = 9; // half the goal's width
const SWEEP = 0.65; // seconds for the needle to cross the meter once
export const CLOSE = 45; // shots from this close (pixels) or closer get the full SHOT_ODDS
const RINK_LENGTH = 1.6; // the rink is this many screens long
const AI_SKILL = { green: 0.18, yellow: 0.42, red: 0.4 };

const ZONE_COLORS = { red: '#fa5252', yellow: '#fcc419', green: '#40c057' };

/** Where the needle is (0 to 1) after holding for `held` seconds. */
export function needle(held) {
  const ph = (held / SWEEP) % 2;
  return ph < 1 ? ph : 2 - ph;
}

/** Which color the needle is on. tier: the stick (1-3); better sticks widen green a little. */
export function zoneAt(m, tier = 1) {
  const d = Math.abs(m - 0.5);
  // a good stick makes green half again as wide, a super one twice (Taylor, 2026-11-05)
  const green = 0.035 + 0.02 * (Math.max(1, tier) - 1);
  if (d <= green) return 'green';
  if (d <= 0.17) return 'yellow';
  return 'red';
}

function gauss(r) {
  let u = 0; let v = 0;
  while (u === 0) u = r();
  while (v === 0) v = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function pickZone(r, odds) {
  const x = r();
  if (x < odds.green) return 'green';
  if (x < odds.green + odds.yellow) return 'yellow';
  return 'red';
}

export class Hockey {
  constructor(opts) {
    this.kind = 'hockey';
    this.W = opts.W; this.H = opts.H;
    this.best = opts.best || 0;
    this.r = rng(opts.seed || 1);
    this.t = 0; this.pops = [];
    this.top = 26;
    this.RW = Math.round(this.W * RINK_LENGTH);
    this.rink = { x0: 5, x1: this.RW - 6, y0: this.top + 8, y1: this.H - 4 };
    const rk = this.rink;
    this.cx = Math.round((rk.x0 + rk.x1) / 2); this.cy = Math.round((rk.y0 + rk.y1) / 2) + 4;
    this.goalL = rk.x0 + 14; this.goalR = rk.x1 - 14;
    this.kid = new Player(playLook(opts.kid.buddy, opts.kid.gear, 'hockey'), opts.kid.name, 11, this.cx - 34, this.cy);
    this.vis = new Player(playLook(opts.visitor.buddy, opts.visitor.gear, 'hockey'), opts.visitor.name, 23, this.cx + 34, this.cy);
    this.kid.tier = opts.kid.gear?.hockey || 1; this.vis.tier = opts.visitor.gear?.hockey || 1;
    for (const p of [this.kid, this.vis]) { p.svx = 0; p.svy = 0; p.frozen = 0; p.noPick = 0; }
    this.field = this.paintRink();
    this.puckPic = cellsCanvas(ballCells('hockey', 1));
    // in the corner, where the rink curves away
    this.button = { x: this.W - 15, y: this.H - 15, r: 12 };
    this.camX = this.camFor(this.cx);
    this.locked = false;
    this.reset();
  }

  reset() {
    this.phase = 'ready'; this.score = 0; this.newBest = false; this.overAt = 0;
    this.goals = { kid: 0, vis: 0 };
    this.left = GAME_SECONDS;
    this.charge = null; this.ai = { charge: null, stealAt: 0, plan: 0 };
    this.faceoff(false);
    for (const p of [this.kid, this.vis]) p.brain.set(HAPPY);
  }

  /** Puck in the middle, buddies either side; play starts after a short countdown. */
  faceoff(countdown = true) {
    this.puck = { x: this.cx, y: this.cy, vx: 0, vy: 0, owner: null, inNet: false };
    const place = (p, x, face) => { p.x = x; p.y = this.cy; p.tx = x; p.ty = this.cy; p.svx = 0; p.svy = 0; p.face = face; p.frozen = 0; };
    place(this.kid, this.cx - 30, 1); place(this.vis, this.cx + 30, -1);
    this.dropAt = countdown ? this.t + 1.2 : Infinity;
    this.camX = this.camFor(this.kid.x + 15);
    this.charge = null; this.ai.charge = null;
  }

  other(p) { return p === this.kid ? this.vis : this.kid; }

  /** Where the view starts to have rink x in the middle of the screen. */
  camFor(x) { return clamp(x - this.W / 2, 0, this.RW - this.W); }

  pop(text, x, y, color = '#ffffff', big = false) {
    this.pops.push({ text, x, y, at: this.t, color, big });
    if (this.pops.length > 8) this.pops.shift();
  }

  get bounds() { const rk = this.rink; return { x0: rk.x0 + 6, x1: rk.x1 - 6, y0: rk.y0 + 6, y1: rk.y1 - 2 }; }

  onButton(x, y) { const b = this.button; return Math.hypot(x - b.x, y - b.y) <= b.r * 1.35; }

  start() {
    if (this.locked) { this.pop('No more games today!', this.cx, this.cy - 20, '#ffa8a8', true); return; }
    this.phase = 'play';
    this.faceoff(true);
  }

  tap(x, y) {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.reset(); return; }
    if (this.phase === 'ready') { this.start(); return; }
    this.skateTo(x + this.camX, y);
  }

  drag(x, y) { if (this.phase === 'play') this.skateTo(x + this.camX, y); }

  skateTo(x, y) {
    const b = this.bounds;
    this.kid.tx = clamp(x, b.x0, b.x1); this.kid.ty = clamp(y + 8, b.y0, b.y1);
  }

  /** What the button does right now: 'shoot', 'steal' or null. */
  action() {
    const k = this.kid;
    if (this.phase !== 'play' || this.t < this.dropAt || this.t < k.frozen) return null;
    if (this.puck.owner === k) return 'shoot';
    if (this.puck.owner === this.vis && Math.hypot(this.vis.x - k.x, this.vis.y - k.y) < STEAL_REACH + 6) return 'steal';
    return null;
  }

  press() {
    if (this.phase === 'ready') { this.start(); return; }
    if (this.phase !== 'play' || this.charge) return;
    if (this.t < this.dropAt || this.t < this.kid.frozen) return;
    this.charge = { t0: this.t };
  }

  release() {
    const c = this.charge;
    if (!c) return;
    this.charge = null;
    if (this.phase !== 'play') return;
    const zone = zoneAt(needle(this.t - c.t0), this.kid.tier);
    const k = this.kid; const v = this.vis;
    if (this.puck.owner === k) { this.shoot(k, zone); return; }
    if (this.puck.owner === v && Math.hypot(v.x - k.x, v.y - k.y) < STEAL_REACH + 6) { this.steal(k, v, zone); return; }
    this.pop(this.puck.owner ? 'Get closer!' : 'Grab the puck!', k.x, k.y - 28, '#ffa8a8');
  }

  shoot(p, zone) {
    const pk = this.puck;
    const gx = p === this.kid ? this.goalR : this.goalL;
    const dx = gx - pk.x; const dy = this.cy - pk.y;
    const dist = Math.hypot(dx, dy);
    const half = Math.atan2(MOUTH - 1.5, Math.max(4, Math.abs(dx))) * (Math.abs(dx) / Math.max(dist, 1));
    // the aim spread is sized so the odds hold from CLOSE in; farther out the
    // same spread misses more often, since the goal looks smaller
    const spread = (Math.max(0.02, half) * Math.max(1, dist / CLOSE)) / Z[zone];
    const aim = Math.atan2(dy, dx) + gauss(this.r) * spread;
    pk.owner = null; pk.vx = Math.cos(aim) * SHOT_SPEED; pk.vy = Math.sin(aim) * SHOT_SPEED;
    p.noPick = this.t + 0.35;
    p.face = dx > 0 ? 1 : -1;
    p.brain.impulse('kick', 1);
    this.pop(zone === 'green' ? 'Great shot!' : zone === 'yellow' ? 'Shot!' : 'Wild shot!', p.x, p.y - 28, ZONE_COLORS[zone]);
    this.sound = 'shot';
  }

  steal(thief, carrier, zone) {
    const [ps, pl] = STEAL_ODDS[zone];
    const x = this.r();
    thief.brain.impulse('kick', 1);
    if (x < ps) {
      this.puck.owner = thief;
      carrier.frozen = this.t + 1; carrier.brain.impulse('dizzy', 1);
      this.pop('Stolen!', thief.x, thief.y - 28, ZONE_COLORS[zone], true);
      this.sound = 'steal';
    } else if (x < ps + pl) {
      // knocked away from both of them
      const pk = this.puck;
      const away = Math.atan2(pk.y - (thief.y + carrier.y) / 2, pk.x - (thief.x + carrier.x) / 2) + (this.r() - 0.5) * 1.2;
      pk.owner = null; pk.vx = Math.cos(away) * 130; pk.vy = Math.sin(away) * 130;
      thief.noPick = carrier.noPick = this.t + 0.3;
      carrier.frozen = this.t + 1; carrier.brain.impulse('dizzy', 1);
      this.pop('Knocked loose!', carrier.x, carrier.y - 28, ZONE_COLORS[zone]);
      this.sound = 'steal';
    } else {
      thief.frozen = this.t + 0.35;
      this.pop('Blocked!', carrier.x, carrier.y - 28, '#ffa8a8');
    }
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.pops = this.pops.filter((p) => this.t - p.at < 1.1);
    if (this.phase === 'play') {
      const live = this.t >= this.dropAt && !this.celebrate;
      if (live) {
        this.left = Math.max(0, this.left - dt);
        this.think(dt);
      }
      if (this.celebrate && this.t >= this.celebrate) { this.celebrate = 0; this.faceoff(true); }
      if (this.left <= 0 && !this.celebrate) { this.end(); }
    }
    for (const p of [this.kid, this.vis]) this.skate(p, dt);
    // the buddies bump instead of skating through each other
    const k = this.kid; const v = this.vis;
    const dx = v.x - k.x; const dy = (v.y - k.y) * 1.6; const d = Math.hypot(dx, dy) || 0.01;
    if (d < 11) { const push = (11 - d) / 2; k.x -= (dx / d) * push; v.x += (dx / d) * push; k.y -= (dy / d) * push / 1.6; v.y += (dy / d) * push / 1.6; }
    this.stepPuck(dt);
    for (const p of [this.kid, this.vis]) p.lookAt = [this.puck.x, this.puck.y - 4];
    // the view follows your buddy, a little ahead of where it's skating
    const want = this.camFor(k.x + clamp(k.svx * 0.4, -30, 30));
    this.camX += (want - this.camX) * Math.min(1, dt * 5);
  }

  end() {
    this.phase = 'over'; this.overAt = this.t; this.charge = null;
    this.score = this.goals.kid;
    this.newBest = this.score > this.best;
    if (this.newBest) this.best = this.score;
    const win = this.goals.kid > this.goals.vis; const tie = this.goals.kid === this.goals.vis;
    this.kid.brain.impulse(win ? 'cheer' : tie ? 'giggle' : 'surprise', 1);
    this.vis.brain.impulse(win ? 'surprise' : tie ? 'giggle' : 'cheer', 1);
    this.sound = 'over';
  }

  skate(p, dt) {
    const frozen = this.t < p.frozen || (this.phase === 'play' && this.t < this.dropAt);
    const top = frozen || this.phase === 'over' ? 0 : SKATE * (this.puck.owner === p ? CARRY : 1);
    const dx = p.tx - p.x; const dy = p.ty - p.y; const d = Math.hypot(dx, dy);
    let wx = 0; let wy = 0;
    if (d > 1.5 && top > 0) { const sp = top * Math.min(1, d / 14); wx = (dx / d) * sp; wy = (dy / d) * sp; }
    const k = 1 - Math.exp(-GLIDE * dt);
    p.svx += (wx - p.svx) * k; p.svy += (wy - p.svy) * k;
    p.x += p.svx * dt; p.y += p.svy * dt;
    const b = this.bounds;
    if (p.x < b.x0 || p.x > b.x1) { p.x = clamp(p.x, b.x0, b.x1); p.svx *= -0.3; }
    if (p.y < b.y0 || p.y > b.y1) { p.y = clamp(p.y, b.y0, b.y1); p.svy *= -0.3; }
    const sp = Math.hypot(p.svx, p.svy);
    p.run = Math.min(1, sp / 45);
    p.stride += dt * 7 * (p.run > 0.1 ? 1 : 0); // long, gliding strides
    if (Math.abs(p.svx) > 6) p.face = p.svx > 0 ? 1 : -1;
    p.vx = p.svx; p.vy = p.svy;
  }

  blade(p) { return [p.x + p.face * 6, p.y]; }

  stepPuck(dt) {
    const pk = this.puck; const rk = this.rink;
    if (pk.owner) {
      const [bx, by] = this.blade(pk.owner);
      pk.x += (bx - pk.x) * Math.min(1, dt * 20); pk.y += (by - pk.y) * Math.min(1, dt * 20);
      pk.vx = pk.owner.svx; pk.vy = pk.owner.svy;
      return;
    }
    const px = pk.x;
    pk.x += pk.vx * dt; pk.y += pk.vy * dt;
    const keep = Math.pow(PUCK_KEEP, dt);
    pk.vx *= keep; pk.vy *= keep;
    if (pk.inNet) { pk.vx *= 0.5; pk.vy *= 0.5; return; }
    // goals: crossing a goal line between the posts
    const inMouth = Math.abs(pk.y - this.cy) < MOUTH;
    if (this.phase === 'play' && !this.celebrate && inMouth) {
      if (px < this.goalR && pk.x >= this.goalR) return this.goal(this.kid);
      if (px > this.goalL && pk.x <= this.goalL) return this.goal(this.vis);
    }
    // the backs and sides of the nets
    for (const gx of [this.goalL, this.goalR]) {
      const back = gx === this.goalL ? gx - 6 : gx + 6;
      const lo = Math.min(gx, back); const hi = Math.max(gx, back);
      if (pk.x > lo && pk.x < hi && Math.abs(pk.y - this.cy) < MOUTH + 1 && !inMouth) pk.vy = -pk.vy;
      if (pk.x > lo - 1 && pk.x < hi + 1 && Math.abs(pk.y - this.cy) < MOUTH && ((gx === this.goalL && px < lo) || (gx === this.goalR && px > hi))) { pk.vx = -pk.vx * 0.6; pk.x = px; }
    }
    // the boards
    if (pk.x < rk.x0 + 3) { pk.x = rk.x0 + 3; pk.vx = Math.abs(pk.vx) * 0.75; this.sound = 'board'; }
    if (pk.x > rk.x1 - 3) { pk.x = rk.x1 - 3; pk.vx = -Math.abs(pk.vx) * 0.75; this.sound = 'board'; }
    if (pk.y < rk.y0 + 3) { pk.y = rk.y0 + 3; pk.vy = Math.abs(pk.vy) * 0.75; this.sound = 'board'; }
    if (pk.y > rk.y1 - 2) { pk.y = rk.y1 - 2; pk.vy = -Math.abs(pk.vy) * 0.75; this.sound = 'board'; }
    // somebody picks it up (a shot that runs into the other buddy is theirs)
    if (this.phase !== 'play' || this.t < this.dropAt || this.celebrate) return;
    for (const p of [this.kid, this.vis]) {
      if (this.t < p.noPick || this.t < p.frozen) continue;
      const [bx, by] = this.blade(p);
      if (Math.hypot(bx - pk.x, by - pk.y) < PICKUP || Math.hypot(p.x - pk.x, p.y - pk.y) < PICKUP) {
        const fast = Math.hypot(pk.vx, pk.vy) > 120;
        pk.owner = p;
        if (fast) this.pop('Blocked!', p.x, p.y - 28, '#ffffff');
        break;
      }
    }
  }

  goal(scorer) {
    const pk = this.puck;
    pk.inNet = true;
    if (scorer === this.kid) this.goals.kid += 1; else this.goals.vis += 1;
    scorer.brain.impulse('cheer', 1);
    this.other(scorer).brain.impulse('surprise', 1);
    this.pop('GOAL!', pk.x < this.cx ? pk.x + 26 : pk.x - 26, this.cy - 22, '#ffd43b', true);
    this.celebrate = this.t + 2;
    this.charge = null; this.ai.charge = null;
    this.sound = 'goal';
  }

  // ---------- the visitor ----------
  think(dt) {
    const v = this.vis; const k = this.kid; const pk = this.puck; const ai = this.ai;
    if (this.t < v.frozen) { ai.charge = null; return; }
    // a shot or steal it's lining up: let go when its time is up
    if (ai.charge && this.t >= ai.charge.at) {
      const { mode } = ai.charge;
      ai.charge = null;
      const zone = pickZone(this.r, AI_SKILL);
      if (mode === 'shoot' && pk.owner === v) this.shoot(v, zone);
      else if (mode === 'steal' && pk.owner === k && Math.hypot(v.x - k.x, v.y - k.y) < STEAL_REACH) this.steal(v, k, zone);
      ai.stealAt = this.t + 1.4 + this.r();
    }
    const b = this.bounds;
    if (pk.owner === v) {
      // carry it toward the kid's goal, around the kid's buddy
      const side = k.y > this.cy ? -1 : 1;
      const near = Math.hypot(k.x - v.x, k.y - v.y) < 30 && k.x < v.x;
      const tx = Math.max(this.goalL + 34, v.x - 40);
      const ty = this.cy + (near ? side * 22 : (v.y - this.cy) * 0.6);
      v.tx = clamp(tx, b.x0, b.x1); v.ty = clamp(ty, b.y0, b.y1);
      const toGoal = v.x - this.goalL;
      if (!ai.charge && ((toGoal < 80 && Math.abs(v.y - this.cy) < 36) || (toGoal < 120 && near && this.r() < dt * 1.5))) {
        ai.charge = { mode: 'shoot', at: this.t + 0.35 + this.r() * 0.5 };
      }
    } else if (pk.owner === k) {
      // get between the kid's buddy and the visitor's own goal, then try to steal
      v.tx = clamp(k.x + 12 + k.svx * 0.25, b.x0, b.x1); v.ty = clamp(k.y + k.svy * 0.25, b.y0, b.y1);
      if (!ai.charge && this.t > ai.stealAt && Math.hypot(v.x - k.x, v.y - k.y) < STEAL_REACH) {
        ai.charge = { mode: 'steal', at: this.t + 0.3 + this.r() * 0.4 };
      }
    } else {
      v.tx = clamp(pk.x + pk.vx * 0.3, b.x0, b.x1); v.ty = clamp(pk.y + pk.vy * 0.3, b.y0, b.y1);
    }
    v.brain.set({ focus: ai.charge ? 0.7 : 0 });
  }

  // ---------- drawing ----------
  paintRink() {
    const c = canvas(this.RW, this.H); const x = c.getContext('2d');
    const rk = this.rink; const r = rng(5);
    x.fillStyle = '#3b5bdb'; x.fillRect(0, 0, this.RW, this.H); // the stands
    for (let i = 0; i < (this.RW * this.top) / 6; i += 1) {
      x.fillStyle = ['#ff8787', '#ffd43b', '#74c0fc', '#b2f2bb', '#e599f7'][Math.floor(r() * 5)];
      x.fillRect(Math.floor(r() * this.RW), Math.floor(r() * (rk.y0 - 2)), 1, 1);
    }
    const round = (fill, inset) => {
      x.fillStyle = fill;
      const x0 = rk.x0 + inset; const x1 = rk.x1 - inset; const y0 = rk.y0 + inset; const y1 = rk.y1 - inset; const rad = 10 - inset;
      for (let yy = y0; yy <= y1; yy += 1) {
        let cut = 0;
        const dy = yy < y0 + rad ? y0 + rad - yy : yy > y1 - rad ? yy - (y1 - rad) : 0;
        if (dy) cut = Math.round(rad - Math.sqrt(Math.max(0, rad * rad - dy * dy)));
        x.fillRect(x0 + cut, yy, x1 - x0 - 2 * cut + 1, 1);
      }
    };
    round('#1b1430', -2); round('#ffd43b', -1); round('#e7f5ff', 0);
    x.fillStyle = '#d0ebff';
    for (let i = 0; i < (this.RW * this.H) / 50; i += 1) {
      const gx = rk.x0 + 3 + Math.floor(r() * (rk.x1 - rk.x0 - 6)); const gy = rk.y0 + 3 + Math.floor(r() * (rk.y1 - rk.y0 - 6));
      x.fillRect(gx, gy, 2, 1);
    }
    const vline = (lx, col) => { x.fillStyle = col; x.fillRect(lx, rk.y0 + 1, 2, rk.y1 - rk.y0 - 1); };
    vline(this.cx - 1, '#fa5252');
    vline(Math.round(this.cx - (this.cx - rk.x0) * 0.42), '#4dabf7');
    vline(Math.round(this.cx + (rk.x1 - this.cx) * 0.42), '#4dabf7');
    vline(this.goalL, '#fa5252'); vline(this.goalR - 1, '#fa5252');
    const ring = (cx, cy, rad, col) => { x.fillStyle = col; for (let a = 0; a < 80; a += 1) x.fillRect(Math.round(cx + Math.cos((a / 80) * Math.PI * 2) * rad), Math.round(cy + Math.sin((a / 80) * Math.PI * 2) * rad * 0.6), 1, 1); };
    ring(this.cx, this.cy, 15, '#4dabf7');
    x.fillStyle = '#4dabf7'; x.fillRect(this.cx - 1, this.cy - 1, 3, 2);
    // goal creases
    x.fillStyle = '#a5d8ff';
    for (let yy = -MOUTH; yy <= MOUTH; yy += 1) {
      const w = Math.round(Math.sqrt(MOUTH * MOUTH - yy * yy) * 0.9);
      x.fillRect(this.goalL + 2, this.cy + yy, w, 1); x.fillRect(this.goalR - 2 - w, this.cy + yy, w, 1);
    }
    // nets: red posts, white mesh
    for (const [gx, dir] of [[this.goalL, -1], [this.goalR, 1]]) {
      for (let yy = -MOUTH; yy <= MOUTH; yy += 1) {
        for (let d = 1; d <= 6; d += 1) {
          const edge = Math.abs(yy) === MOUTH || d === 6;
          x.fillStyle = edge ? '#e03131' : ((yy + d) % 2 ? '#ffffff' : '#ced4da');
          x.fillRect(gx + dir * d, this.cy + yy, 1, 1);
        }
      }
    }
    return c;
  }

  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.save();
    ctx.translate(-Math.round(this.camX), 0);
    ctx.drawImage(this.field, 0, 0);
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    const pk = this.puck;
    const things = [this.kid, this.vis].map((p) => ({ y: p.y, draw: () => p.draw(ctx) }));
    things.push({ y: pk.y + 0.5, draw: () => ctx.drawImage(this.puckPic, Math.round(pk.x - 1), Math.round(pk.y - 1)) });
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());
    // who has the puck: a little marker under their feet
    if (pk.owner) { ctx.fillStyle = pk.owner === this.kid ? '#ffd43b' : '#ff8787'; ctx.fillRect(Math.round(pk.owner.x) - 3, Math.round(pk.owner.y) + 2, 7, 1); }
    ctx.restore();
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
    const sx = (x) => (x - Math.round(this.camX)) * S; // rink x to the screen
    // the puck is off screen: an arrow at that edge points to it
    const pk = this.puck;
    if (this.phase === 'play' && (pk.x < this.camX - 1 || pk.x > this.camX + this.W + 1)) {
      const right = pk.x > this.camX; const ax = right ? W - u * 1.4 : u * 1.4; const ay = clamp(pk.y, this.top + 12, this.H - 30) * S; const d = right ? 1 : -1;
      ctx.beginPath(); ctx.moveTo(ax + d * u, ay); ctx.lineTo(ax - d * u * 0.6, ay - u); ctx.lineTo(ax - d * u * 0.6, ay + u); ctx.closePath();
      ctx.fillStyle = pk.owner === this.kid ? '#ffd43b' : pk.owner ? '#ff8787' : '#ffffff'; ctx.fill();
      ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.stroke();
    }
    // score and clock
    const secs = Math.ceil(this.left);
    const sc = `${this.goals.kid}  –  ${this.goals.vis}`;
    text(sc, W / 2, u * 2.4, u * 3.4, '#ffd43b');
    const half = ctx.measureText(sc).width / 2 + u * 0.8;
    ctx.textAlign = 'right'; text(this.kid.name, W / 2 - half, u * 2.6, u * 1.7, '#ffffff');
    ctx.textAlign = 'left'; text(this.vis.name, W / 2 + half, u * 2.6, u * 1.7, '#ffffff');
    ctx.textAlign = 'center';
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 5.1, u * 1.6, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#e9ecef');

    // the shoot / steal button, and the timing meter while it's held
    const bt = this.button; const act = this.action();
    const bx = bt.x * S; const by = bt.y * S; const br = bt.r * S;
    ctx.beginPath(); ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = act ? (this.charge ? '#e8590c' : '#fd7e14') : 'rgba(73,80,87,0.45)'; ctx.fill();
    ctx.lineWidth = S; ctx.strokeStyle = '#1b1430'; ctx.stroke();
    text(act === 'steal' ? 'STEAL' : 'SHOOT', bx, by, u * 1.25, act ? '#ffffff' : '#adb5bd');
    const meter = this.charge ? needle(this.t - this.charge.t0) : null;
    if (meter != null) {
      const mw = u * 13; const mh = u * 1.4; const mx = Math.min(W - mw - u, bx - mw / 2); const my = by - br - u * 2.6;
      const steps = 100;
      for (let i = 0; i < steps; i += 1) {
        ctx.fillStyle = ZONE_COLORS[zoneAt((i + 0.5) / steps, this.kid.tier)];
        ctx.fillRect(mx + (i * mw) / steps, my, mw / steps + 0.5, mh);
      }
      ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + meter * mw - S * 0.6, my - S, S * 1.2, mh + 2 * S);
    }
    // the visitor lining something up
    if (this.ai.charge && this.phase === 'play') text('!', sx(this.vis.x), (this.vis.y - 30) * S, u * 2, '#ff8787');

    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, sx(p.x), (p.y - age * 10) * S, u * (p.big ? 2.4 : 1.7), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'play' && this.t < this.dropAt) text(this.t > this.dropAt - 0.5 ? 'GO!' : 'Ready…', W / 2, (this.cy - 22) * S, u * 2.4, '#ffffff');
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Tap to drop the puck!', W / 2, (this.H - 9) * S, u * 1.8);
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.top + 20) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.85)';
      const bw = Math.min(W * 0.8, u * 34); const bh = u * 9.5;
      ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      const { kid: a, vis: b } = this.goals;
      const line = a > b ? `You win ${a}–${b}!` : a < b ? `${this.vis.name} wins ${b}–${a}!` : `Tie game ${a}–${b}!`;
      text(line, W / 2, cy - u * 2.3, u * 2.6, '#ffd43b');
      text(this.newBest ? `New best: ${a} ${a === 1 ? 'goal' : 'goals'}!` : `Best ${this.best} ${this.best === 1 ? 'goal' : 'goals'}`, W / 2, cy + u * 0.4, u * 1.8, this.newBest ? '#b2f2bb' : '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to play again', W / 2, cy + u * 2.8, u * 1.5, '#ffffff');
    }
  }
}
