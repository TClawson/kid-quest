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
import { ZONE_COLORS, needle, zoneAt as zoneOf, pickZone, drawMeter, addPop } from './meter.js';
import { paintBackdrop, paintGround, fieldLook, shadeFor, sprite } from './fieldlooks.js';
import { FOOTBALL_TWISTS, twistFor } from './mapplay.js';
import { FanWatch } from './fans.js';

export const GAME_SECONDS = 90;

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
const CATCH_GREEN = 0.15; const CATCH_YELLOW = 0.3;
/** How far from the cone (pixels) a throw of each color lands. */
export const MISS = { green: 0, yellow: 12, red: 26 };
/** How far (pixels) the landing marker wanders while the ball is up: a spiral stays put. */
export const WANDER = { green: 0, yellow: 15, red: 20 };
export const FLIGHT_MIN = 0.85; export const FLIGHT_MAX = 1.25; // random speed of a throw, times the route's flight time
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
export const reachFor = (tier = 1) => 10 + 3 * (Math.max(1, tier) - 1);
/** A tap this close (pixels) to the landing marker sends the buddy right onto it. */
const MARK_SNAP = 12;
const BUTTON_R = 10; // the CATCH button's radius (pixels); taps a bit outside still count
const RUN = 60; // pixels a second, as in tag
const GRAV = 90; // makes the ball look high enough without leaving the screen
const HANDS = 9; // catch height
const TOO_SLOW = 4; // seconds to aim before the play is over

export { needle }; // needle(held, sweep): where the needle is (0 to 1), from meter.js

// green is narrow: a perfect throw is hard (Taylor, 2026-11-05)
// a better ball widens it a lot: about 1.5x with a good one, 2x with a super one
// and narrower again on 2026-11-07 (was 0.045 + 0.025 a tier), with the needle starting somewhere new each throw
const greenHalf = (tier) => 0.032 + 0.02 * (Math.max(1, tier) - 1);
/** The color under the needle. tier: the ball (1-3); better balls widen green. */
export const zoneAt = (m, tier = 1) => zoneOf(m, greenHalf(tier), 0.18);

/** The kid's catch windows (seconds either side), for a route and the ball. The throw's color doesn't change them any more. */
export function catchWindows(route, zone, tier = 1) {
  const k = ROUTES[route].win * (1 + 0.25 * (Math.max(1, tier) - 1));
  return { green: CATCH_GREEN * k, yellow: CATCH_YELLOW * k };
}

/** The chance the visitor catches a throw it got to. */
export const visCatch = (route, zone, tier = 1) => clamp(VIS_CATCH[zone] + ROUTE_CATCH[route] + 0.03 * (Math.max(1, tier) - 1), 0.05, 0.97);

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
    // the kid's map: its own field and twist (fieldlooks.js, mapplay.js)
    this.map = opts.map || 'bg-meadow';
    this.look = fieldLook(this.map); this.tw = twistFor(FOOTBALL_TWISTS, this.map);
    this.things = [];
    // the map's critters come to watch (fans.js)
    this.fans = new FanWatch({ map: this.map, r: this.r, dry: opts.fanDry || 0, onFan: opts.onFan, onSeen: opts.onFanSeen });
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

  pop(text, x, y, color, big) { addPop(this, text, x, y, color, big); }

  other(p) { return p === this.kid ? this.vis : this.kid; }

  /** Both buddies to the line, and three new cones. */
  lineUp(thrower) {
    const c = this.other(thrower);
    const f = this.f;
    const cones = {};
    for (const k of Object.keys(ROUTES)) cones[k] = [Math.round(this.W * ROUTES[k].at), Math.round(f.y0 + 20 + this.r() * (f.y1 - f.y0 - 28))];
    this.down = { stage: 'pick', thrower, catcher: c, at: this.t, cones };
    if (this.tw.banner) this.down.banner = Object.keys(ROUTES)[Math.floor(this.r() * 3)];
    this.placeThings(cones);
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
      if (d.tap === 'red') d.tap = 'early'; // the message waits for the landing, so it says everything at once
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
    d.flight = ROUTES[d.route].flight * (FLIGHT_MIN + this.r() * (FLIGHT_MAX - FLIGHT_MIN)); // each throw is a little faster or slower
    // floaty water hangs every throw; on the moon deep throws fly sky high
    d.flight *= (this.tw.hang || 1) * (d.route === 'deep' && this.tw.moonDeep ? this.tw.moonDeep : 1);
    // sand, mud and ice slow the catcher: the thrower waits that much longer
    const slow = this.tw.slow || 1;
    d.wait = waitFor(Math.hypot(cx - c.x, cy - c.y) / slow, Math.hypot(d.land[0] - cx, d.land[1] - cy) / slow, d.flight);
    d.throwAt = this.t + d.wait;
    d.thrower.brain.set({ focus: 0.7 });
    this.pop(zone === 'green' ? 'Perfect aim!' : zone === 'yellow' ? 'A little off...' : 'Way off!', d.thrower.x, d.thrower.y + 8, ZONE_COLORS[zone]);
    if (d.catcher === this.vis) this.vis.goTo(cx, cy + 4); else this.pop('Run!', this.kid.x, this.kid.y - 36, '#ffffff');
  }

  throwBall() {
    const d = this.down; const th = d.thrower; const R = ROUTES[d.route];
    d.stage = 'air';
    const b = this.ball;
    b.state = 'air'; b.x0 = th.x + 4; b.y0 = th.y; b.h0 = HANDS + 2; [b.tx, b.ty] = d.land; b.t0 = this.t; b.T = d.flight;
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
      this.footing(p);
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
    this.stepDog(dt);
    this.fans.step(dt, this.phase === 'play');
    this.stepBall(dt);
  }

  /** A wobbly throw: the spot it comes down on drifts around where it was aimed; the visitor follows it. */
  wander() {
    const d = this.down; const b = this.ball; const f = this.f;
    const [dx, dy] = wanderAt(d.zone, Math.min(this.t, d.catchAt) - b.t0, d.ph);
    let [px, py] = [0, 0];
    const well = this.things.find((o) => o.kind === 'well');
    if (well && !d.bounced) {
      // the gravity well pulls the landing spot toward it, a little at a time
      const gx = well.x - d.land[0]; const gy = well.y - d.land[1]; const gd = Math.hypot(gx, gy) || 1;
      const k = Math.min(gd * 0.6, 18, this.tw.well * (Math.min(this.t, d.catchAt) - b.t0));
      px = (gx / gd) * k; py = (gy / gd) * k;
    }
    b.tx = clamp(d.land[0] + dx + px, this.qbX + 24, f.x1 - 6); b.ty = clamp(d.land[1] + dy + py, f.y0 + 16, f.y1 - 2);
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
    let caught; let words; let timing = '';
    // what went wrong with the tap, so the kid can tell it apart from standing in the wrong spot
    const badTap = c === this.kid && d.tap !== 'green' && d.tap !== 'yellow';
    if (badTap) timing = d.tap === 'early' ? 'Too early!' : 'Too late!';
    // Rainbow Land: a fumble at the spot bounces up off the candy grass for one more try
    if (this.tw.bouncy && near && !d.bounced) {
      const fumble = c === this.kid ? d.tap === 'yellow' ? this.r() >= 0.5 : d.tap !== 'green' : this.r() >= visCatch(d.route, d.zone, this.tier);
      if (fumble) { this.bounceUp(); return; }
      if (c === this.kid && d.tap === 'yellow') d.tap = 'green'; else d.sure = true;
    }
    if (!near) { caught = false; words = 'Missed!'; }
    else if (c === this.kid) {
      if (d.tap === 'green') { caught = true; words = 'Great catch!'; }
      else if (d.tap === 'yellow') { caught = this.r() < 0.5; words = caught ? 'Bobbled... got it!' : 'Fumbled!'; }
      else { caught = false; words = timing; timing = ''; }
    } else {
      caught = d.sure || this.r() < visCatch(d.route, d.zone, this.tier);
      words = caught ? 'Caught it!' : 'Dropped!';
    }
    // wrong spot AND a bad tap: say both
    if (timing) this.pop(timing, c.x, c.y - 44, ZONE_COLORS.red);
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
      const pts = this.pts(d.route) * (d.banner === d.route ? 2 : 1);
      const fw = this.fans.great(); if (fw) this.pop(fw, this.W * this.fans.seat, this.f.y0 + 8, '#ff8fa3', true);
      this.score += pts; this.caught += 1;
      b.state = 'held';
      const td = d.route === 'deep';
      this.pop(td ? `Touchdown! +${pts}` : `+${pts}`, d.catcher.x, d.catcher.y - 40, '#ffd43b', true);
      if (d.banner === d.route) this.pop('Royal catch! x2', d.catcher.x, d.catcher.y - 52, '#e599f7');
      d.catcher.brain.impulse('cheer', 1); d.thrower.brain.impulse('cheer', 1);
      d.nextAt = this.t + (td ? 2.1 : 1.5);
      this.sound = td ? 'goal' : 'catch';
      if (td && d.catcher.moves.has('spike')) d.spikeAt = this.t + 0.65;
      this.buzz = 30;
    } else {
      if (why !== 'slow') { b.state = 'loose'; b.vh = -30; b.vx = (b.tx - b.x0) / b.T * 0.25; b.vy = (b.ty - b.y0) / b.T * 0.25; }
      // the village dog fetches a dropped ball
      if (this.tw.dog && why !== 'slow') { this.dog = { t0: this.t, x: this.W + 6, y: b.ty, to: [b.tx, b.ty], got: false }; d.nextAt = this.t + 2.2; }
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

  /** A map's points for a route (the moon's deep throw is worth more). */
  pts(route) { return route === 'deep' && this.tw.deep ? this.tw.deep : ROUTES[route].pts; }

  /** Puddles, vents, ice and the gravity well for a play, kept away from the cones and the line. */
  placeThings(cones) {
    const tw = this.tw; const f = this.f;
    this.things = [];
    const free = (x, y, rad) => Object.values(cones).every(([cx, cy]) => Math.hypot(cx - x, cy - y) > rad + 12) && this.things.every((o) => Math.hypot(o.x - x, o.y - y) > o.r + rad + 4);
    const add = (kind, n, rad) => {
      for (let i = 0, tries = 0; i < n && tries < 60; tries += 1) {
        const x = this.qbX + 30 + this.r() * (this.endX - this.qbX - 36); const y = f.y0 + 12 + this.r() * (f.y1 - f.y0 - 18);
        if (!free(x, y, rad)) continue;
        this.things.push({ kind, x: Math.round(x), y: Math.round(y), r: rad }); i += 1;
      }
    };
    if (tw.mud) add('mud', tw.mud, 9);
    if (tw.ice) add('ice', tw.ice, 12);
    if (tw.vents) add('vent', tw.vents, 5);
    if (tw.well) add('well', 1, 6);
  }

  /** How fast a buddy runs where it is standing: sand, mud, ice, a steam boost. */
  footing(p) {
    const tw = this.tw;
    let k = 1;
    if (tw.sand) k = p.y > this.f.y1 - 14 ? tw.sand.wet : tw.sand.soft;
    let grip = 0;
    for (const o of this.things) {
      const near = Math.hypot(p.x - o.x, (p.y - o.y) * 1.5) < o.r;
      if (!near) continue;
      if (o.kind === 'mud') k *= tw.mudSlow;
      if (o.kind === 'ice') grip = 2.6;
      if (o.kind === 'vent' && !(p.boostUntil > this.t)) { p.boostUntil = this.t + 1.5; this.pop('Steam boost!', p.x, p.y - 30, '#ffa94d'); }
    }
    if (p.boostUntil > this.t) k *= tw.boost;
    p.speed = RUN * k; p.grip = grip;
  }

  /** Rainbow Land: the fumbled ball bounces up off the candy grass for one more catch. */
  bounceUp() {
    const d = this.down; const b = this.ball;
    d.bounced = true; d.landed = false; d.tried = false; d.tap = null; d.zone = 'green';
    b.x0 = b.tx; b.y0 = b.ty; b.h0 = HANDS; b.t0 = this.t; b.T = 0.7;
    d.land = [b.tx, b.ty];
    b.vh = (GRAV * b.T) / 2;
    d.catchAt = this.t + b.T;
    this.pop('Boing! Again!', b.tx, b.ty - 26, '#f783ac', true);
    this.sound = 'board';
  }

  /** The village dog trots in, picks up the ball and brings it back: +2. */
  stepDog(dt) {
    const g = this.dog; if (!g) return;
    const [tx, ty] = g.got ? [this.qbX, this.cy + 20] : g.to;
    const dx = tx - g.x; const dy = ty - g.y; const dd = Math.hypot(dx, dy);
    if (dd > 2) { g.x += (dx / dd) * 110 * dt; g.y += (dy / dd) * 110 * dt; g.face = dx > 0 ? 1 : -1; }
    else if (!g.got) { g.got = true; this.score += this.tw.dog; this.pop(`Good dog! +${this.tw.dog}`, g.x, g.y - 14, '#ffd43b', true); this.sound = 'catch'; }
    if (g.got) { this.ball.x = g.x + 3 * (g.face || 1); this.ball.y = g.y; this.ball.h = 2; this.ball.state = 'dog'; }
    if (this.t - g.t0 > 2.2) { this.dog = null; if (this.ball.state === 'dog') this.ball.state = 'held'; }
  }

  // ---------- drawing ----------
  paintField() {
    const W = this.W; const H = this.H; const c = canvas(W, H); const x = c.getContext('2d');
    const r = rng(7); const f = this.f; const look = this.look;
    // the map's backdrop along the top, then its ground
    paintBackdrop(x, this.map, W, f.y0 - 1);
    paintGround(x, this.map, 0, f.y0, W, H - f.y0);
    if (look.tex === 'mown') for (let xx = 0; xx < W; xx += 1) { x.fillStyle = Math.floor(xx / 12) % 2 ? '#37b24d' : '#2f9e44'; x.fillRect(xx, f.y0, 1, H - f.y0); }
    // Sunset Beach: the surf along the bottom, wet sand above it (fast running)
    if (this.tw.sand) {
      x.fillStyle = '#d9a35f'; x.fillRect(0, f.y1 - 14, W, 12);
      for (let i = 0; i < W; i += 3) { x.fillStyle = '#c99657'; x.fillRect(i + (i % 2), f.y1 - 14 + ((i * 7) % 11), 1, 1); }
      x.fillStyle = '#3bc9db'; x.fillRect(0, f.y1 - 2, W, H - f.y1 + 2);
      x.fillStyle = '#e3fafc'; for (let i = 0; i < W; i += 2) x.fillRect(i, f.y1 - 2 - (Math.floor(i / 5) % 2), 1, 1);
    }
    // the end zone
    const [e0, e1] = look.end === 'surf' ? ['#ffa94d', '#f08c00'] : look.end;
    x.fillStyle = e0; x.fillRect(this.endX, f.y0, W - this.endX, H - f.y0);
    x.fillStyle = e1;
    for (let i = 0; i < 50; i += 1) x.fillRect(this.endX + 2 + Math.floor(r() * (W - this.endX - 4)), f.y0 + 2 + Math.floor(r() * (H - f.y0 - 4)), 2, 1);
    const line = look.line;
    x.fillStyle = line; x.globalAlpha = 0.75;
    for (let lx = this.qbX + 12; lx < this.endX - 4; lx += 12) {
      x.fillRect(lx, f.y0, 1, H - f.y0);
      // hash marks
      for (const hy of [f.y0 + Math.round((H - f.y0) * 0.35), f.y0 + Math.round((H - f.y0) * 0.65)]) x.fillRect(lx + 6, hy, 1, 2);
    }
    x.globalAlpha = 1;
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

  /** This play's puddles, ice, vents and the gravity well, under the buddies. */
  drawThings(ctx) {
    const blob = (cx, cy, rad, col, sq = 0.6) => { ctx.fillStyle = col; for (let yy = -Math.ceil(rad * sq); yy <= Math.ceil(rad * sq); yy += 1) { const w = Math.round(Math.sqrt(Math.max(0, rad * rad - (yy / sq) * (yy / sq)))); ctx.fillRect(cx - w, cy + yy, w * 2 + 1, 1); } };
    for (const o of this.things) {
      if (o.kind === 'mud') { blob(o.x, o.y, o.r + 1, '#2b1a0c', 0.66); blob(o.x, o.y, o.r, '#4a2f18', 0.66); ctx.fillStyle = '#c9a27a'; ctx.fillRect(o.x - 4, o.y - 2, 4, 1); ctx.fillRect(o.x + 2, o.y + 1, 2, 1); }
      else if (o.kind === 'ice') { blob(o.x, o.y, o.r, '#a5d8ff', 0.66); blob(o.x, o.y, o.r - 1, '#d0ebff', 0.66); ctx.fillStyle = '#ffffff'; ctx.fillRect(o.x - 5, o.y - 2, 4, 1); ctx.fillRect(o.x + 2, o.y + 1, 3, 1); }
      else if (o.kind === 'vent') {
        // a steam vent: a ring of rocks round a dark hole, white puffs rising (a boost, not a fire)
        blob(o.x, o.y, o.r + 1, '#1b1430'); blob(o.x, o.y, o.r, '#868e96'); blob(o.x, o.y, o.r - 2, '#343a40');
        for (let i = 0; i < 3; i += 1) {
          const k = ((this.t * 1.4 + i / 3) % 1); const py = Math.round(o.y - 2 - k * 16); const px = Math.round(o.x + Math.sin(k * 6 + i) * 2); const pr = 2 + Math.round(k * 2);
          blob(px, py, pr, k > 0.7 ? 'rgba(255,255,255,0.55)' : '#ffffff', 0.8);
        }
      } else if (o.kind === 'well') {
        ctx.fillStyle = '#9775fa';
        for (let k = 0; k < 2; k += 1) { const rad = 4 + ((this.t * 8 + k * 7) % 14); const n = Math.round(rad * 6); for (let a = 0; a < n; a += 1) ctx.fillRect(Math.round(o.x + Math.cos((a / n) * Math.PI * 2) * rad), Math.round(o.y + Math.sin((a / n) * Math.PI * 2) * rad * 0.6), 1, 1); }
        blob(o.x, o.y, 2, '#ffd43b'); ctx.fillStyle = '#ffffff'; ctx.fillRect(o.x, o.y, 1, 1);
      }
    }
  }

  /** The village dog (Forest Village), fetching a dropped ball. */
  drawDog(ctx) {
    const g = this.dog; if (!g) return;
    const pal = { B: '#a0612f', b: '#d08a5a', E: '#1b1430', N: '#1b1430', W: '#ffffff' };
    const step = Math.floor(this.t * 12) % 2;
    sprite(ctx, ['.......KK', 'K.....KbBK', 'KBKKKKKBEN', '.KBBBBBBK.', '.KBbBBbK..', step ? '.K.K.K.K..' : 'K.K...K.K.'], pal, Math.round(g.x), Math.round(g.y) + 1, (g.face || -1) < 0);
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
    const cone = (cx, cy, k) => {
      ctx.fillStyle = '#1b1430'; ctx.fillRect(cx - 2, cy - 4, 5, 5); ctx.fillStyle = '#ff922b'; ctx.fillRect(cx - 1, cy - 4, 3, 4); ctx.fillRect(cx - 2, cy - 1, 5, 1); ctx.fillStyle = '#ffffff'; ctx.fillRect(cx - 1, cy - 2, 3, 1);
      // the royal banner, on a pole beside its cone
      if (k && k === d.banner) { ctx.fillStyle = '#1b1430'; ctx.fillRect(cx + 3, cy - 12, 1, 12); ctx.fillRect(cx + 4, cy - 12, 6, 5); ctx.fillStyle = Math.floor(this.t * 4) % 2 ? '#7048e8' : '#845ef7'; ctx.fillRect(cx + 4, cy - 11, 5, 3); ctx.fillStyle = '#ffd43b'; ctx.fillRect(cx + 6, cy - 10, 1, 1); }
    };
    this.drawThings(ctx);
    if (this.phase === 'play') {
      if (d.stage === 'pick') {
        const pulse = Math.floor(this.t * 3) % 2;
        for (const k of Object.keys(ROUTES)) { const [cx, cy] = d.cones[k]; ring(cx, cy, 8, pulse ? '#ffd43b' : '#ffe066'); cone(cx, cy, k); }
      } else if (d.route && d.stage !== 'done') {
        const [cx, cy] = d.cones[d.route]; cone(cx, cy, d.route);
      }
    }
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    // where it's coming down: a cross with a ring as big as the catcher's reach
    if (b.state === 'air') {
      const mx = Math.round(b.tx); const my = Math.round(b.ty);
      const mark = this.look.tex === 'snow' ? 'rgba(28,126,214,' : 'rgba(255,255,255,';
      // a dark edge under the ring and cross, so they show on sand, stone and candy
      ring(mx, my + 1, this.reach, 'rgba(27,20,48,0.5)', undefined, 1);
      ring(mx, my, this.reach, `${mark}0.85)`, undefined, 1);
      ctx.fillStyle = '#1b1430'; ctx.fillRect(mx - 3, my - 1, 7, 3); ctx.fillRect(mx - 1, my - 2, 3, 5);
      ctx.fillStyle = `${mark}1)`; ctx.fillRect(mx - 2, my, 5, 1); ctx.fillRect(mx, my - 1, 1, 3);
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
    if (this.dog) things.push({ y: this.dog.y, draw: () => this.drawDog(ctx) });
    if (this.phase !== 'ready') {
      // the ball's shadow, then the ball
      ctx.fillStyle = shadeFor(this.map);
      const sw = Math.max(2, 6 - Math.round(b.h / 8));
      if (b.state !== 'held') ctx.fillRect(Math.round(b.x - sw / 2), Math.round(b.y), sw, 1);
      things.push({ y: b.y + 0.6, draw: () => this.drawBall(ctx) });
    }
    things.sort((a, c) => a.y - c.y).forEach((th) => th.draw());
    this.fans.draw(ctx, Math.round(this.W * this.fans.seat), this.f.y0 - 1, this.W);
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
        for (const k of Object.keys(ROUTES)) text(`${ROUTES[k].name} ${this.pts(k) * (d.banner === k ? 2 : 1)}`, d.cones[k][0] * S, (d.cones[k][1] + 7) * S, u * 1.4, d.banner === k ? '#e599f7' : '#ffd43b');
      }
      // the aiming meter over the thrower; it stays a moment once stopped
      if (d.stage === 'aim' || d.stage === 'wait') {
        const m = this.meter(); const th = d.thrower;
        const mw = u * 12; const mh = u * 1.4; const mx = clamp(th.x * S - mw / 2 + u * 3, u, W - mw - u); const my = (th.y - 34) * S;
        drawMeter(ctx, (k) => zoneAt(k, this.tier), m, mx, my, mw, mh, S);
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
    if (this.phase === 'ready' && !this.locked) {
      text(this.tw.name, W / 2, u * 10, u * 1.8, '#ffd43b');
      text(this.tw.tip, W / 2, u * 12.2, u * 1.4, '#ffffff');
    }
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
