// Football with a visiting buddy: 90 seconds of passing, playing on the same team.
//
// Top down, like tag and keepy-uppy: the buddies line up on the left and the
// end zone is on the right. Each play:
//   1. Your kid picks a route by tapping one of three cones: Short (5 points),
//      Medium (10) or Deep (25, in the end zone). Each play the cones move.
//   2. The thrower aims: a needle sweeps over red, yellow and green. When your
//      buddy throws, tap to stop it; the visitor stops its own (green 60%,
//      yellow 30%, red 10%). Green throws go right to the cone, yellow ones land
//      a little off, red ones a lot off.
//   3. Only now the catcher starts running. The thrower waits just long enough
//      for it to get there (waitFor), then throws. The ball's shadow shows where it's coming down; longer throws are
//      in the air longer, so there's more time to get there.
//   4. When your buddy catches: tap or drag to run (as in tag). A marker shows
//      where the ball comes down. A perfect spiral's marker stays put; a yellow
//      throw's marker wanders a bit while the ball is in the air, and a red one
//      wobbles a lot, and the ball comes down wherever the marker is. Getting
//      there is the hard part (Taylor, 2026-11-07). Catching is the CATCH button
//      in the bottom-left corner: red (too early), then yellow (a bobble, 50/50),
//      then green (a catch), with roomy windows. Your buddy has to be close to
//      the spot or it's out of reach. The visitor follows the marker and catches
//      90/60/30% of green/yellow/red throws (a bit less on longer routes).
//
// A better football (the better of the two kids' balls) widens the green on the
// meter, the catch windows and the reach. Buddy moves the kids unlocked show up
// as celebrations: Spiral pass (green throws spin and sparkle), Flip catch (a
// perfect catch is a flip) and Touchdown spike (after a deep catch). No coins:
// the best score is kept.
//
// Same interface as Play in play.js (tap, drag, step, draw, drawHud, score, phase).
import { Player, playLook, rng, canvas, cellsCanvas, clamp, HAPPY } from './play.js';
import { ballCells } from './avatar.js';

export const GAME_SECONDS = 90;
const ZONE_COLORS = { red: '#fa5252', yellow: '#fcc419', green: '#40c057' };

/**
 * at: how far down the field the cone is (0-1). flight: seconds in the air.
 * sweep: seconds for the needle to cross the meter. win: catch windows scale.
 */
export const ROUTES = {
  short: { name: 'Short', pts: 5, at: 0.36, flight: 0.9, sweep: 0.8, win: 1 },
  medium: { name: 'Medium', pts: 10, at: 0.6, flight: 1.3, sweep: 0.65, win: 0.9 },
  deep: { name: 'Deep', pts: 25, at: 0.86, flight: 1.7, sweep: 0.52, win: 0.8 },
};
/**
 * Seconds the thrower waits after aiming, while the catcher gets going: just
 * enough for the catcher to get there. It runs to the cone, then over to where
 * the ball really comes down, with SLACK seconds to spare (about one reaction).
 */
export const SLACK = 0.5;
export function waitFor(toCone, coneToLand, flight) {
  return clamp((toCone + coneToLand) / RUN + SLACK - flight, 0.3, 3);
}
/** How the visitor throws. */
/** How the visitor throws: perfect spirals are rarer (Taylor, 2026-11-07; was 60/30/10). */
export const VIS_THROW = { green: 0.35, yellow: 0.4, red: 0.25 };
/** How often the visitor hangs on to a throw of each color it gets to (before the route and ball). */
export const VIS_CATCH = { green: 0.9, yellow: 0.6, red: 0.3 };
const ROUTE_CATCH = { short: 0, medium: -0.05, deep: -0.1 };
/**
 * Catch windows for the kid, in seconds either side of the catch. Roomy: the
 * timing is meant to be easy, running to the spot is the hard part (Taylor,
 * 2026-11-07; they were 0.075 / 0.17 and shrank on off-target throws).
 */
const CATCH_GREEN = 0.2; const CATCH_YELLOW = 0.38;
/** How far from the cone (pixels) a throw of each color lands. */
export const MISS = { green: 0, yellow: 12, red: 26 };
/** How far (pixels) the landing marker wanders while the ball is up: a spiral stays put. */
export const WANDER = { green: 0, yellow: 13, red: 20 };
const WANDER_IN = 0.4; // seconds for the wandering to build up after the throw
/**
 * How far the landing spot has wandered `s` seconds after the throw. ph: four
 * random phases per throw. Two slow waves per axis keep it smooth and below
 * the buddies' running speed (about 20 px/s yellow, 40 px/s red at most).
 */
export function wanderAt(zone, s, ph) {
  const a = WANDER[zone] * Math.min(1, Math.max(0, s) / WANDER_IN);
  if (!a) return [0, 0];
  return [
    a * (0.6 * Math.sin(1.7 * s + ph[0]) + 0.4 * Math.sin(2.9 * s + ph[1])),
    a * (0.6 * Math.sin(1.5 * s + ph[2]) + 0.4 * Math.sin(3.1 * s + ph[3])),
  ];
}
/** How close (pixels) the catcher has to be to where the ball comes down. */
// was 8 px, a third of a buddy's width: it looked like a catch and wasn't (Taylor, 2026-11-07)
export const reachFor = (tier = 1) => 12 + 3 * (Math.max(1, tier) - 1);
/** A tap this close (pixels) to the landing marker sends the buddy right onto it. */
const MARK_SNAP = 12;
const BUTTON_R = 10; // the CATCH button's radius (pixels); taps a bit outside still count
const RUN = 60; // pixels a second, as in tag
const GRAV = 90; // makes the ball look high enough without leaving the screen
const HANDS = 9; // catch height
const TOO_SLOW = 4; // seconds to aim before the play is over

/** Where the needle is (0 to 1) after `held` seconds. */
export function needle(held, sweep) {
  const ph = (held / sweep) % 2;
  return ph < 1 ? ph : 2 - ph;
}

// green is narrow: a perfect throw is hard (Taylor, 2026-11-05)
// a better ball widens it a lot: about 1.5x with a good one, 2x with a super one
// and narrower again on 2026-11-07 (was 0.045 + 0.025 a tier), with the needle starting somewhere new each throw
const greenHalf = (tier) => 0.032 + 0.02 * (Math.max(1, tier) - 1);
/** The color under the needle. tier: the ball (1-3); better balls widen green. */
export function zoneAt(m, tier = 1) {
  const d = Math.abs(m - 0.5);
  if (d <= greenHalf(tier)) return 'green';
  if (d <= 0.18) return 'yellow';
  return 'red';
}

/** The kid's catch windows (seconds either side), for a route and the ball. The throw's color doesn't change them any more. */
export function catchWindows(route, zone, tier = 1) {
  const k = ROUTES[route].win * (1 + 0.25 * (Math.max(1, tier) - 1));
  return { green: CATCH_GREEN * k, yellow: CATCH_YELLOW * k };
}

/** The chance the visitor catches a throw it got to. */
export const visCatch = (route, zone, tier = 1) => clamp(VIS_CATCH[zone] + ROUTE_CATCH[route] + 0.03 * (Math.max(1, tier) - 1), 0.05, 0.97);

function pickZone(r, odds) {
  const x = r();
  if (x < odds.green) return 'green';
  if (x < odds.green + odds.yellow) return 'yellow';
  return 'red';
}

export class Football {
  constructor(opts) {
    this.kind = 'football';
    this.W = opts.W; this.H = opts.H;
    this.best = opts.best || 0;
    this.r = rng(opts.seed || 1);
    this.t = 0; this.pops = [];
    this.top = 26;
    this.f = { x0: 4, x1: this.W - 4, y0: this.top + 4, y1: this.H - 3 };
    this.cy = Math.round((this.f.y0 + this.f.y1) / 2) + 4;
    this.qbX = Math.round(this.W * 0.1);
    this.endX = Math.round(this.W * 0.8);
    this.tier = Math.max(opts.kid.gear?.football || 1, opts.visitor.gear?.football || 1);
    this.reach = reachFor(this.tier);
    this.kid = new Player(playLook(opts.kid.buddy, opts.kid.gear, 'football'), opts.kid.name, 11, this.qbX, this.cy);
    this.vis = new Player(playLook(opts.visitor.buddy, opts.visitor.gear, 'football'), opts.visitor.name, 23, this.qbX + 12, this.cy + 12);
    this.kid.moves = new Set(opts.kid.moves || []); this.vis.moves = new Set(opts.visitor.moves || []);
    for (const p of [this.kid, this.vis]) { p.air = 0; p.spin = 0; p.flipAt = -9; p.speed = RUN; }
    this.ballPic = cellsCanvas(ballCells('football', this.tier));
    this.field = this.paintField();
    this.locked = false;
    this.reset();
  }

  reset() {
    this.phase = 'ready'; this.score = 0; this.newBest = false; this.overAt = 0;
    this.left = GAME_SECONDS; this.plays = 0; this.caught = 0;
    this.ball = { x: 0, y: 0, h: 0, state: 'held', spin: 0 };
    this.lineUp(this.kid);
  }

  pop(text, x, y, color = '#ffffff', big = false) {
    this.pops.push({ text, x, y, at: this.t, color, big });
    if (this.pops.length > 8) this.pops.shift();
  }

  other(p) { return p === this.kid ? this.vis : this.kid; }

  /** Both buddies to the line, and three new cones. */
  lineUp(thrower) {
    const c = this.other(thrower);
    const f = this.f;
    const cones = {};
    for (const k of Object.keys(ROUTES)) cones[k] = [Math.round(this.W * ROUTES[k].at), Math.round(f.y0 + 20 + this.r() * (f.y1 - f.y0 - 28))];
    this.down = { stage: 'pick', thrower, catcher: c, at: this.t, cones };
    thrower.goTo(this.qbX, this.cy); c.goTo(this.qbX + 12, this.cy + 12);
    this.ball.state = 'held';
  }

  start() {
    if (this.locked) { this.pop('No more games today!', this.W / 2, this.cy, '#ffa8a8', true); return; }
    this.phase = 'play';
    this.plays = 0;
    this.lineUp(this.kid);
    for (const p of [this.kid, this.vis]) { p.x = p.tx; p.y = p.ty; p.face = 1; }
  }

  ready() { const d = this.down; return Math.hypot(d.thrower.x - this.qbX, d.thrower.y - this.cy) < 3 && Math.hypot(d.catcher.x - d.catcher.tx, d.catcher.y - d.catcher.ty) < 3; }

  tap(x, y) {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.reset(); return; }
    if (this.phase === 'ready') { this.start(); return; }
    const d = this.down;
    if (d.stage === 'pick') {
      if (!this.ready()) return;
      let best = 'short';
      for (const k of Object.keys(ROUTES)) if (Math.hypot(x - d.cones[k][0], y - d.cones[k][1]) < Math.hypot(x - d.cones[best][0], y - d.cones[best][1])) best = k;
      this.aim(best);
      return;
    }
    if (d.stage === 'aim' && d.thrower === this.kid) {
      if (this.t - d.aimAt < 0.25) return;
      const m = this.meter(); this.aimed(zoneAt(m, this.tier), m);
      return;
    }
    if (d.catcher !== this.kid || (d.stage !== 'wait' && d.stage !== 'air')) return;
    // the CATCH button catches (it does nothing before the throw); anywhere else, run there
    if (this.onButton(x, y)) {
      if (d.stage !== 'air' || d.tried) return;
      d.tried = true; d.tapAt = this.t;
      d.tap = this.buttonColor();
      if (d.tap === 'red') { d.tap = 'early'; this.pop('Too early!', this.kid.x, this.kid.y - 28, ZONE_COLORS.red); }
      return;
    }
    this.runTo(x, y);
  }

  drag(x, y) { const d = this.down; if (this.phase === 'play' && d.catcher === this.kid && (d.stage === 'wait' || d.stage === 'air') && !this.onButton(x, y)) this.runTo(x, y); }

  /** The CATCH button, in the bottom-left corner behind the line, where nobody needs to run. */
  button() { return { x: this.f.x0 + BUTTON_R + 3, y: this.f.y1 - BUTTON_R - 3, r: BUTTON_R }; }

  onButton(x, y) { const b = this.button(); return Math.hypot(x - b.x, y - b.y) <= b.r + 4; }

  /** The button's color right now: red is too early, yellow a bobble, green a catch (late is past green). */
  buttonColor() {
    const d = this.down; const left = d.catchAt - this.t;
    const w = catchWindows(d.route, d.zone, this.tier);
    if (Math.abs(left) <= w.green) return 'green';
    if (left > w.green && left <= w.yellow) return 'yellow';
    return left > 0 ? 'red' : 'late';
  }

  runTo(x, y) {
    const f = this.f; const b = this.ball;
    // tapping the landing marker puts your buddy's feet right on it (where it is now: a wobbly one moves on)
    if (b.state === 'air' && Math.hypot(x - b.tx, y - b.ty) <= MARK_SNAP) { this.kid.goTo(b.tx, b.ty); return; }
    // anywhere else, like tag: the tap is on your buddy's body, so its feet go a little lower
    this.kid.goTo(clamp(x, f.x0 + 4, f.x1 - 4), clamp(y + 6, f.y0 + 16, f.y1));
  }

  /** A route is picked: the thrower aims (the catcher waits). */
  aim(route) {
    const d = this.down;
    d.route = route; d.stage = 'aim'; d.aimAt = this.t;
    d.start = this.r() * 2; d.pace = 0.85 + this.r() * 0.3;
    if (d.thrower === this.vis) {
      d.zone = pickZone(this.r, VIS_THROW);
      d.aiAt = this.t + 0.7 + this.r() * 0.8;
    }
  }

  /** The needle starts at a random spot and speed each throw, so there's no rhythm to learn. */
  meter() { const d = this.down; const sw = ROUTES[d.route].sweep * d.pace; return d.meterStop ?? needle(this.t - d.aimAt + d.start * sw, sw); }

  /** The throw's color is set: the catcher takes off, the thrower waits, then throws. */
  aimed(zone, m) {
    const d = this.down;
    d.zone = zone; d.meterStop = m; d.stage = 'wait';
    const [cx, cy] = d.cones[d.route];
    // where it'll really come down
    const a = this.r() * Math.PI * 2; const miss = MISS[zone] * (0.75 + this.r() * 0.5);
    const f = this.f;
    d.land = [clamp(cx + Math.cos(a) * miss, this.qbX + 24, f.x1 - 6), clamp(cy + Math.sin(a) * miss, f.y0 + 16, f.y1 - 2)];
    const c = d.catcher;
    d.wait = waitFor(Math.hypot(cx - c.x, cy - c.y), Math.hypot(d.land[0] - cx, d.land[1] - cy), ROUTES[d.route].flight);
    d.throwAt = this.t + d.wait;
    d.thrower.brain.set({ focus: 0.7 });
    this.pop(zone === 'green' ? 'Perfect aim!' : zone === 'yellow' ? 'A little off...' : 'Way off!', d.thrower.x, d.thrower.y + 8, ZONE_COLORS[zone]);
    if (d.catcher === this.vis) this.vis.goTo(cx, cy + 4); else this.pop('Run!', this.kid.x, this.kid.y - 36, '#ffffff');
  }

  throwBall() {
    const d = this.down; const th = d.thrower; const R = ROUTES[d.route];
    d.stage = 'air';
    const b = this.ball;
    b.state = 'air'; b.x0 = th.x + 4; b.y0 = th.y; b.h0 = HANDS + 2; [b.tx, b.ty] = d.land; b.t0 = this.t; b.T = R.flight;
    d.ph = [0, 1, 2, 3].map(() => this.r() * Math.PI * 2);
    b.vh = (HANDS - b.h0) / b.T + (GRAV * b.T) / 2; // comes down at hands height
    b.spiral = d.zone === 'green' && th.moves.has('spiral');
    d.catchAt = this.t + b.T;
    d.tried = false; d.tap = null;
    th.brain.set({ focus: 0 }); th.brain.impulse('kick', 1);
    th.face = 1;
    if (b.spiral) this.pop('Spiral!', th.x, th.y - 28, '#ffd43b');
    // the visitor sees where it's coming down and heads there
    if (d.catcher === this.vis) this.vis.goTo(b.tx, b.ty);
    this.sound = 'shot';
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.pops = this.pops.filter((p) => this.t - p.at < 1.1);
    const d = this.down;
    if (this.phase === 'play') {
      this.left = Math.max(0, this.left - dt);
      if (d.stage === 'aim') {
        if (d.thrower === this.vis && this.t >= d.aiAt) this.aimed(d.zone, this.stopIn(d.zone));
        else if (this.t - d.aimAt > TOO_SLOW) { this.pop('Too slow!', d.thrower.x, d.thrower.y - 28, ZONE_COLORS.red); this.result(false, 'slow'); }
      }
      if (d.stage === 'wait' && this.t >= d.throwAt) this.throwBall();
      if (d.stage === 'air') {
        if (!d.landed) this.wander();
        if (d.catcher === this.kid && !d.tried && this.t > d.catchAt + catchWindows(d.route, d.zone, this.tier).green) { d.tried = true; d.tap = 'late'; }
        if (this.t >= d.catchAt && (d.catcher === this.vis || d.tried) && !d.landed) this.land();
      }
      if (d.stage === 'result' && this.t >= d.nextAt) {
        if (this.left <= 0) this.end(); else this.lineUp(d.thrower === this.kid ? this.vis : this.kid);
      }
      if (this.left <= 0 && (d.stage === 'pick' || d.stage === 'aim')) this.end();
    }
    for (const p of [this.kid, this.vis]) {
      p.move(dt);
      if (Math.hypot(p.tx - p.x, p.ty - p.y) < 1 && this.ball.state === 'air') p.face = this.ball.x < p.x ? -1 : 1;
      p.lookAt = this.ball.state === 'held' ? null : [this.ball.x, this.ball.y - this.ball.h];
      // a hop for a catch, a flip for a perfect one
      const since = this.t - p.flipAt;
      p.air = since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * (p.flipping ? 12 : 4) : 0;
      p.spin = p.flipping && since < 0.6 ? (since / 0.6) * Math.PI * 2 * -p.face : 0;
      if (since >= 0.6) p.flipping = false;
    }
    // touchdown spike, once the catcher has landed
    if (d.spikeAt && this.t >= d.spikeAt && d.stage === 'result') {
      const b = this.ball;
      d.spikeAt = 0; b.state = 'spike'; b.vh = -110; b.vx = 3; b.vy = 0; b.h = HANDS + 4;
      this.pop('Spike!', d.catcher.x, d.catcher.y - 28, '#ffd43b');
      d.catcher.brain.impulse('kick', 1);
    }
    this.stepBall(dt);
  }

  /** A wobbly throw: the spot it comes down on drifts around where it was aimed; the visitor follows it. */
  wander() {
    const d = this.down; const b = this.ball; const f = this.f;
    const [dx, dy] = wanderAt(d.zone, Math.min(this.t, d.catchAt) - b.t0, d.ph);
    b.tx = clamp(d.land[0] + dx, this.qbX + 24, f.x1 - 6); b.ty = clamp(d.land[1] + dy, f.y0 + 16, f.y1 - 2);
    if (d.catcher === this.vis) this.vis.goTo(b.tx, b.ty);
  }

  /** Where the visitor's needle stops for a color: somewhere in that color. */
  stopIn(zone) {
    const g = greenHalf(this.tier); const side = this.r() < 0.5 ? -1 : 1;
    const d = zone === 'green' ? this.r() * g : zone === 'yellow' ? g + this.r() * (0.18 - g) : 0.18 + this.r() * 0.3;
    return 0.5 + side * d;
  }

  stepBall(dt) {
    const b = this.ball; const d = this.down;
    if (b.state === 'held') {
      const h = d.stage === 'result' ? d.catcher : d.thrower;
      b.x = h.x + 4 * h.face; b.y = h.y + 0.5; b.h = HANDS - 3 + h.air;
    } else if (b.state === 'air') {
      const s = this.t - b.t0; const k = Math.min(1, s / b.T);
      b.x = b.x0 + (b.tx - b.x0) * k; b.y = b.y0 + (b.ty - b.y0) * k;
      b.h = b.h0 + b.vh * s - (GRAV * s * s) / 2;
      b.spin += dt * (b.spiral ? 30 : 9);
    } else if (b.state === 'loose' || b.state === 'spike') {
      b.vh -= 300 * dt; b.h += b.vh * dt; b.x += b.vx * dt; b.y += (b.vy || 0) * dt;
      if (b.h <= 1) { b.h = 1; b.vh = Math.abs(b.vh) * 0.45; b.vx *= 0.6; b.vy = (b.vy || 0) * 0.6; if (b.vh < 15) b.vh = 0; }
      b.spin += dt * b.vx * 0.3;
    }
  }

  /** The ball comes down: caught or not. */
  land() {
    const d = this.down; const c = d.catcher; const b = this.ball;
    d.landed = true;
    const near = Math.hypot(c.x - b.tx, c.y - b.ty) <= this.reach;
    let caught; let words;
    if (!near) { caught = false; words = 'Too far!'; }
    else if (c === this.kid) {
      if (d.tap === 'green') { caught = true; words = 'Great catch!'; }
      else if (d.tap === 'yellow') { caught = this.r() < 0.5; words = caught ? 'Bobbled... got it!' : 'Bobbled it!'; }
      else { caught = false; words = d.tap === 'early' ? '' : 'Too late!'; }
    } else {
      caught = this.r() < visCatch(d.route, d.zone, this.tier);
      words = caught ? 'Caught it!' : 'Dropped!';
    }
    // a perfect catch is a flip if that kid unlocked the flip catch
    c.flipAt = this.t; c.flipping = caught && (d.tap === 'green' || (c === this.vis && d.zone === 'green')) && c.moves.has('flipcatch');
    if (c.flipping) words = 'Flip catch!';
    if (words) this.pop(words, c.x, c.y - 30, caught ? '#b2f2bb' : '#ffa8a8');
    this.result(caught);
  }

  result(caught, why) {
    const d = this.down; const b = this.ball;
    d.stage = 'result';
    this.plays += 1;
    if (caught) {
      const R = ROUTES[d.route];
      this.score += R.pts; this.caught += 1;
      b.state = 'held';
      const td = d.route === 'deep';
      this.pop(td ? `Touchdown! +${R.pts}` : `+${R.pts}`, d.catcher.x, d.catcher.y - 40, '#ffd43b', true);
      d.catcher.brain.impulse('cheer', 1); d.thrower.brain.impulse('cheer', 1);
      d.nextAt = this.t + (td ? 2.1 : 1.5);
      this.sound = td ? 'goal' : 'catch';
      if (td && d.catcher.moves.has('spike')) d.spikeAt = this.t + 0.65;
      this.buzz = 30;
    } else {
      if (why !== 'slow') { b.state = 'loose'; b.vh = -30; b.vx = (b.tx - b.x0) / b.T * 0.25; b.vy = (b.ty - b.y0) / b.T * 0.25; }
      d.catcher.brain.impulse('surprise', 1);
      d.nextAt = this.t + 1.3;
      this.sound = 'drop';
    }
    d.thrower.brain.set({ focus: 0 });
  }

  end() {
    this.phase = 'over'; this.overAt = this.t;
    this.newBest = this.score > this.best;
    if (this.newBest) this.best = this.score;
    for (const p of [this.kid, this.vis]) p.brain.impulse('cheer', 1);
    this.lineUp(this.kid);
    this.down.stage = 'done';
    this.sound = 'over';
  }

  // ---------- drawing ----------
  paintField() {
    const W = this.W; const H = this.H; const c = canvas(W, H); const x = c.getContext('2d');
    const r = rng(7); const f = this.f;
    // the stands along the top
    x.fillStyle = '#495057'; x.fillRect(0, 0, W, H);
    for (let yy = 1; yy < f.y0 - 2; yy += 3) { x.fillStyle = '#868e96'; x.fillRect(0, yy + 2, W, 1); }
    for (let i = 0; i < (W * f.y0) / 7; i += 1) {
      x.fillStyle = ['#ff8787', '#ffd43b', '#74c0fc', '#b2f2bb', '#e599f7', '#ffffff'][Math.floor(r() * 6)];
      x.fillRect(Math.floor(r() * W), Math.floor(r() * (f.y0 - 2)), 1, 1);
    }
    x.fillStyle = '#1b1430'; x.fillRect(0, f.y0 - 2, W, 2);
    // grass, mowed in stripes, with a white border
    for (let xx = 0; xx < W; xx += 1) { x.fillStyle = Math.floor(xx / 12) % 2 ? '#37b24d' : '#2f9e44'; x.fillRect(xx, f.y0, 1, H - f.y0); }
    x.fillStyle = '#e03131'; x.fillRect(this.endX, f.y0, W - this.endX, H - f.y0);
    x.fillStyle = '#c92a2a';
    for (let i = 0; i < 50; i += 1) x.fillRect(this.endX + 2 + Math.floor(r() * (W - this.endX - 4)), f.y0 + 2 + Math.floor(r() * (H - f.y0 - 4)), 2, 1);
    x.fillStyle = 'rgba(255,255,255,0.75)';
    for (let lx = this.qbX + 12; lx < this.endX - 4; lx += 12) {
      x.fillRect(lx, f.y0, 1, H - f.y0);
      // hash marks
      for (const hy of [f.y0 + Math.round((H - f.y0) * 0.35), f.y0 + Math.round((H - f.y0) * 0.65)]) x.fillRect(lx + 6, hy, 1, 2);
    }
    x.fillStyle = '#ffffff';
    x.fillRect(this.endX, f.y0, 2, H - f.y0);
    x.fillRect(0, f.y0, W, 1); x.fillRect(0, H - 1, W, 1); x.fillRect(f.x1, f.y0, 1, H - f.y0);
    // line of scrimmage
    x.fillStyle = '#74c0fc'; x.fillRect(this.qbX + 6, f.y0 + 1, 1, H - f.y0 - 2);
    // the goal post, from above: a yellow crossbar on its post
    const gy = this.cy;
    x.fillStyle = '#1b1430'; x.fillRect(W - 7, gy - 13, 4, 27);
    x.fillStyle = '#ffd43b'; x.fillRect(W - 6, gy - 12, 2, 25); x.fillRect(W - 4, gy - 1, 3, 2);
    return c;
  }

  drawPlayer(ctx, p) {
    const x = Math.round(p.x); const y = Math.round(p.y);
    ctx.fillStyle = 'rgba(20,40,20,0.28)';
    ctx.fillRect(x - 5, y - 1, 10, 1); ctx.fillRect(x - 4, y, 8, 1);
    ctx.save();
    ctx.translate(x, Math.round(y - 11 - p.air));
    if (p.spin) ctx.rotate(p.spin);
    if (p.face < 0) ctx.scale(-1, 1);
    ctx.drawImage(p.pic, -12, -12);
    ctx.restore();
  }

  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.field, 0, 0);
    const d = this.down; const b = this.ball;
    const ring = (cx, cy, rad, col, n = Math.max(10, Math.round(rad * 6)), squash = 0.6) => { ctx.fillStyle = col; for (let a = 0; a < n; a += 1) ctx.fillRect(Math.round(cx + Math.cos((a / n) * Math.PI * 2) * rad), Math.round(cy + Math.sin((a / n) * Math.PI * 2) * rad * squash), 1, 1); };
    const cone = (cx, cy) => { ctx.fillStyle = '#1b1430'; ctx.fillRect(cx - 2, cy - 4, 5, 5); ctx.fillStyle = '#ff922b'; ctx.fillRect(cx - 1, cy - 4, 3, 4); ctx.fillRect(cx - 2, cy - 1, 5, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 2, 3, 1); };
    if (this.phase === 'play') {
      if (d.stage === 'pick') {
        const pulse = Math.floor(this.t * 3) % 2;
        for (const k of Object.keys(ROUTES)) { const [cx, cy] = d.cones[k]; ring(cx, cy, 8, pulse ? '#ffd43b' : '#ffe066'); cone(cx, cy); }
      } else if (d.route && d.stage !== 'done') {
        const [cx, cy] = d.cones[d.route]; cone(cx, cy);
      }
    }
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    // where it's coming down: a cross with a ring as big as the catcher's reach
    if (b.state === 'air') {
      const mx = Math.round(b.tx); const my = Math.round(b.ty);
      ring(mx, my, this.reach, 'rgba(255,255,255,0.45)', undefined, 1);
      ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.fillRect(mx - 2, my, 5, 1); ctx.fillRect(mx, my - 1, 1, 3);
    }
    // the CATCH button: gray until the throw, then red, yellow, green
    if (this.phase === 'play' && d.catcher === this.kid && (d.stage === 'wait' || d.stage === 'air')) {
      const bt = this.button();
      const col = d.stage === 'wait' ? '#868e96' : d.tried ? '#495057' : { red: '#fa5252', yellow: '#fcc419', green: '#40c057', late: '#495057' }[this.buttonColor()];
      const disc = (rad, from, to, shrink = 0) => {
        for (let yy = from; yy <= to; yy += 1) { const hw = Math.round(Math.sqrt(Math.max(0, rad * rad - yy * yy))) - shrink; if (hw > 0) ctx.fillRect(bt.x - hw, bt.y + yy, hw * 2 + 1, 1); }
      };
      ctx.fillStyle = '#1b1430'; disc(bt.r + 1, -bt.r - 1, bt.r + 1);
      ctx.fillStyle = col; disc(bt.r, -bt.r, bt.r);
      ctx.fillStyle = 'rgba(255,255,255,0.35)'; disc(bt.r, -bt.r + 2, -bt.r + 3, 3);
    }
    const things = [this.kid, this.vis].map((p) => ({ y: p.y, draw: () => this.drawPlayer(ctx, p) }));
    if (this.phase !== 'ready') {
      // the ball's shadow, then the ball
      ctx.fillStyle = 'rgba(20,40,20,0.35)';
      const sw = Math.max(2, 6 - Math.round(b.h / 8));
      if (b.state !== 'held') ctx.fillRect(Math.round(b.x - sw / 2), Math.round(b.y), sw, 1);
      things.push({ y: b.y + 0.6, draw: () => this.drawBall(ctx) });
    }
    things.sort((a, c) => a.y - c.y).forEach((th) => th.draw());
  }

  drawBall(ctx) {
    const b = this.ball; const d = this.down;
    if (b.state === 'air' && b.spiral) {
      ctx.fillStyle = '#fff3bf';
      for (let i = 1; i <= 4; i += 1) {
        const s = (this.t - b.t0) - i * 0.05; if (s <= 0) continue;
        const k = Math.min(1, s / b.T);
        ctx.fillRect(Math.round(b.x0 + (b.tx - b.x0) * k), Math.round(b.y0 + (b.ty - b.y0) * k - (b.h0 + b.vh * s - (GRAV * s * s) / 2)), 1, 1);
      }
    }
    ctx.save(); ctx.translate(Math.round(b.x), Math.round(b.y - b.h));
    if (b.state === 'air') {
      // points along its path on screen; a wobbly one tumbles
      const s = this.t - b.t0; const vx = (b.tx - b.x0) / b.T; const vy = (b.ty - b.y0) / b.T - (b.vh - GRAV * s);
      let a = Math.atan2(vy, vx);
      if (d.zone === 'red') a = b.spin; else if (d.zone === 'yellow') a += Math.sin(b.spin) * 0.4;
      ctx.rotate(a);
      if (b.spiral && Math.floor(b.spin) % 2) ctx.scale(1, -1);
    } else if (b.state !== 'held') ctx.rotate(b.spin);
    ctx.drawImage(this.ballPic, -4, -2);
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
    const d = this.down;
    const secs = Math.ceil(this.left);
    text(`${this.score}`, W / 2, u * 2.4, u * 3.4, '#ffd43b');
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 5.1, u * 1.6, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#e9ecef');
    const hint = (s) => text(s, W / 2, (this.H - 7) * S, u * 1.6, '#ffffff');
    if (this.phase === 'play') {
      if (d.stage === 'pick') {
        if (this.ready()) hint(`${d.thrower.name} throws to ${d.catcher.name}. Tap a cone!`);
        for (const k of Object.keys(ROUTES)) text(`${ROUTES[k].name} ${ROUTES[k].pts}`, d.cones[k][0] * S, (d.cones[k][1] + 7) * S, u * 1.4, '#ffd43b');
      }
      // the aiming meter over the thrower; it stays a moment once stopped
      if (d.stage === 'aim' || d.stage === 'wait') {
        const m = this.meter(); const th = d.thrower;
        const mw = u * 12; const mh = u * 1.4; const mx = clamp(th.x * S - mw / 2 + u * 3, u, W - mw - u); const my = (th.y - 34) * S;
        for (let i = 0; i < 100; i += 1) { ctx.fillStyle = ZONE_COLORS[zoneAt((i + 0.5) / 100, this.tier)]; ctx.fillRect(mx + (i * mw) / 100, my, mw / 100 + 0.5, mh); }
        ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + m * mw - S * 0.6, my - S, S * 1.2, mh + 2 * S);
        if (d.stage === 'aim') hint(th === this.kid ? 'Tap to aim the throw!' : `${th.name} is aiming...`);
      }
      if (d.stage === 'wait' && d.catcher === this.kid) hint('Run to the cone! Tap or drag.');
      if (d.stage === 'air' && d.catcher === this.kid && !d.tried) hint(this.buttonColor() === 'red' ? (d.zone === 'green' ? 'Get to the spot!' : 'It wobbles! Stay under it!') : 'Tap CATCH!');
      if (d.catcher === this.kid && (d.stage === 'wait' || d.stage === 'air')) { const bt = this.button(); text('CATCH', bt.x * S, bt.y * S, u * 1.3, '#ffffff'); }
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x * S, u * 6, W - u * 6), Math.max(u * 7.5, (p.y - age * 10) * S), u * (p.big ? 2.4 : 1.7), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Tap to play!', W / 2, (this.H - 7) * S, u * 1.8);
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.top + 26) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.85)';
      const bw = Math.min(W * 0.8, u * 34); const bh = u * 10;
      ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      text(`Time's up! ${this.score} points`, W / 2, cy - u * 2.6, u * 2.6, '#ffd43b');
      text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, cy, u * 1.8, this.newBest ? '#b2f2bb' : '#e9ecef');
      text(`${this.caught} of ${this.plays} ${this.plays === 1 ? 'pass' : 'passes'} caught`, W / 2, cy + u * 2.1, u * 1.4, '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to play again', W / 2, cy + u * 3.8, u * 1.4, '#ffffff');
    }
  }
}
