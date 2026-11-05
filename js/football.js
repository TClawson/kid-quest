// Football with a visiting buddy: 90 seconds of passing, playing on the same team.
//
// A side view: the buddies line up on the left and the end zone is on the
// right. Before each play your kid picks a route by tapping one of three spots
// on the field: Short (5 points), Medium (10) or Deep (25, in the end zone).
// Your buddy and the visitor take turns throwing and catching.
//
//   Your buddy throws: a needle sweeps over red, yellow and green. Tap to throw.
//     Green is a perfect spiral right to the catcher's hands, yellow is off
//     target, red is a wobbly ball way off. The visitor then catches it or not
//     (better throws are caught more often).
//   The visitor throws (green 60%, yellow 30%, red 10%): a ring closes on the
//   ball as it comes in to your buddy. Tap at the catch. Green is a catch,
//   yellow is a bobble (50/50), red or no tap is a drop. Off-target throws give
//   smaller windows.
//
// Deep throws fly faster for their distance, the needle sweeps faster and the
// catch windows are smaller. A better football (the better of the two kids'
// balls) widens the green on the meter and the catch windows. Buddy moves the
// kids unlocked show up as celebrations: Spiral pass (green throws spin and
// sparkle), Flip catch (a perfect catch is a flip) and Touchdown spike (after a
// deep catch). No coins: the best score is kept.
//
// Same interface as Play in play.js (tap, step, draw, drawHud, score, phase).
import { Player, playLook, rng, canvas, cellsCanvas, clamp, HAPPY } from './play.js';
import { ballCells } from './avatar.js';

export const GAME_SECONDS = 90;
const ZONE_COLORS = { red: '#fa5252', yellow: '#fcc419', green: '#40c057' };

/**
 * at: where the catch is, across the field (0-1). flight: seconds in the air.
 * sweep: seconds for the needle to cross the meter. win: catch windows scale.
 */
export const ROUTES = {
  short: { name: 'Short', pts: 5, at: 0.36, flight: 0.75, sweep: 0.9, win: 1 },
  medium: { name: 'Medium', pts: 10, at: 0.6, flight: 0.95, sweep: 0.75, win: 0.8 },
  deep: { name: 'Deep', pts: 25, at: 0.87, flight: 1.1, sweep: 0.6, win: 0.62 },
};
/** How the visitor throws. */
export const VIS_THROW = { green: 0.6, yellow: 0.3, red: 0.1 };
/** How often the visitor hangs on to a throw of each color (before the route and ball). */
export const VIS_CATCH = { green: 0.9, yellow: 0.6, red: 0.3 };
const ROUTE_CATCH = { short: 0, medium: -0.05, deep: -0.1 };
/** Catch windows for the kid, in seconds either side of the catch. */
const CATCH_GREEN = 0.075; const CATCH_YELLOW = 0.17;
/** Off-target throws shrink the windows this much. */
const THROW_WINDOW = { green: 1, yellow: 0.8, red: 0.6 };
/** How far off target (pixels) a throw of each color lands. */
const MISS = { green: 0, yellow: 9, red: 18 };
const RING_LEAD = 0.8; // the catch ring shows this long before the catch
const RUN = 0.62; // catchers run this many field widths a second
const GRAV = 230;
const HANDS = 13; // catch height above the feet
const TOO_SLOW = 3.5; // seconds to throw before it's a sack

/** Where the needle is (0 to 1) `held` seconds after the snap. */
export function needle(held, sweep) {
  const ph = (held / sweep) % 2;
  return ph < 1 ? ph : 2 - ph;
}

/** The color under the needle. tier: the ball (1-3); better balls widen green. */
export function zoneAt(m, tier = 1) {
  const d = Math.abs(m - 0.5);
  if (d <= 0.07 + 0.015 * (Math.max(1, tier) - 1)) return 'green';
  if (d <= 0.2) return 'yellow';
  return 'red';
}

/** The kid's catch windows (seconds either side), for a route, the throw's color and the ball. */
export function catchWindows(route, zone, tier = 1) {
  const k = ROUTES[route].win * THROW_WINDOW[zone] * (1 + 0.12 * (Math.max(1, tier) - 1));
  return { green: CATCH_GREEN * k, yellow: CATCH_YELLOW * k };
}

/** The chance the visitor catches a throw. */
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
    this.lineY = Math.round(this.H * 0.8);
    this.turfY = Math.round(this.H * 0.5);
    this.qbX = Math.round(this.W * 0.1);
    this.endX = Math.round(this.W * 0.79);
    this.tier = Math.max(opts.kid.gear?.football || 1, opts.visitor.gear?.football || 1);
    this.kid = new Player(playLook(opts.kid.buddy, opts.kid.gear, 'football'), opts.kid.name, 11, this.qbX, this.lineY);
    this.vis = new Player(playLook(opts.visitor.buddy, opts.visitor.gear, 'football'), opts.visitor.name, 23, this.qbX + 12, this.lineY);
    this.kid.moves = new Set(opts.kid.moves || []); this.vis.moves = new Set(opts.visitor.moves || []);
    for (const p of [this.kid, this.vis]) { p.air = 0; p.spin = 0; p.flipAt = -9; p.speed = this.W * RUN; }
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

  /** Where each route's catch is, in field pixels. */
  spot(route) { return Math.round(this.W * ROUTES[route].at); }

  /** Both buddies to the line: thrower at the back, catcher beside it. */
  lineUp(thrower) {
    const c = this.other(thrower);
    this.down = { stage: 'pick', thrower, catcher: c, at: this.t };
    thrower.goTo(this.qbX, this.lineY); c.goTo(this.qbX + 14, this.lineY);
    this.ball.state = 'held';
  }

  start() {
    if (this.locked) { this.pop('No more games today!', this.W / 2, this.turfY, '#ffa8a8', true); return; }
    this.phase = 'play';
    this.plays = 0;
    this.lineUp(this.kid);
    for (const p of [this.kid, this.vis]) { p.x = p.tx; p.y = p.ty; p.face = 1; }
  }

  /** Which route a tap picks: the nearest spot across the field. */
  routeAt(x) {
    let best = 'short';
    for (const k of Object.keys(ROUTES)) if (Math.abs(x - this.spot(k)) < Math.abs(x - this.spot(best))) best = k;
    return best;
  }

  tap(x, y) {
    if (this.phase === 'over') { if (this.t - this.overAt > 1.2) this.reset(); return; }
    if (this.phase === 'ready') { this.start(); return; }
    const d = this.down;
    if (d.stage === 'pick') {
      // wait until the buddies are back on the line
      if (Math.abs(d.thrower.x - this.qbX) > 3) return;
      this.snap(this.routeAt(x));
    } else if (d.stage === 'throw' && d.thrower === this.kid) {
      if (this.t - d.snapAt < 0.25) return;
      this.throwBall(zoneAt(this.meter(), this.tier));
    } else if (d.stage === 'air' && d.catcher === this.kid && !d.tried) {
      const early = d.catchAt - this.t;
      if (early > RING_LEAD) return; // no ring yet
      d.tried = true;
      const w = catchWindows(d.route, d.zone, this.tier);
      const off = Math.abs(early);
      d.tap = off <= w.green ? 'green' : off <= w.yellow ? 'yellow' : early > 0 ? 'early' : 'late';
      if (d.tap === 'early') this.pop('Too early!', this.kid.x, this.kid.y - 30, ZONE_COLORS.red);
    }
  }

  drag() {}

  snap(route) {
    const d = this.down;
    d.route = route; d.stage = 'throw'; d.snapAt = this.t;
    d.catcher.goTo(this.spot(route), this.lineY);
    d.arrive = this.t + Math.abs(this.spot(route) - d.catcher.x) / d.catcher.speed;
    this.pop('Hut!', d.thrower.x, d.thrower.y - 30, '#ffffff');
    if (d.thrower === this.vis) {
      // the visitor lets it go somewhere along the run
      d.aiAt = this.t + 0.4 + (d.arrive - this.t) * (0.3 + this.r() * 0.5);
    }
  }

  meter() { const d = this.down; return needle(this.t - d.snapAt, ROUTES[d.route].sweep); }

  throwBall(zone) {
    const d = this.down; const th = d.thrower; const R = ROUTES[d.route];
    d.zone = zone; d.stage = 'air';
    const flight = Math.max(R.flight, d.arrive - this.t + 0.15);
    const miss = MISS[zone] * (this.r() < 0.5 ? -1 : 1) * (0.7 + this.r() * 0.6);
    const tx = clamp(this.spot(d.route) + miss, this.qbX + 20, this.W - 6);
    const b = this.ball;
    b.state = 'air'; b.x0 = th.x + 6; b.h0 = HANDS + 2; b.tx = tx; b.t0 = this.t; b.T = flight;
    b.vh = (HANDS - b.h0) / flight + (GRAV * flight) / 2; // lands at hands height
    b.spiral = zone === 'green' && th.moves.has('spiral');
    d.catchAt = this.t + flight;
    d.tried = false; d.tap = null;
    // the catcher heads to where it's coming down
    d.catcher.goTo(tx, this.lineY);
    th.brain.impulse('kick', 1);
    this.pop(zone === 'green' ? (b.spiral ? 'Spiral!' : 'Perfect pass!') : zone === 'yellow' ? 'Off target!' : 'Wobbly!', th.x + 8, th.y - 30, ZONE_COLORS[zone]);
    this.sound = 'shot';
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    this.pops = this.pops.filter((p) => this.t - p.at < 1.1);
    const d = this.down;
    if (this.phase === 'play') {
      this.left = Math.max(0, this.left - dt);
      if (d.stage === 'throw') {
        if (d.thrower === this.vis && this.t >= d.aiAt) this.throwBall(pickZone(this.r, VIS_THROW));
        else if (this.t - d.snapAt > TOO_SLOW) { this.pop('Too slow!', d.thrower.x, d.thrower.y - 30, ZONE_COLORS.red); this.result(false, 'sack'); }
      }
      if (d.stage === 'air') {
        // a late tap: the ball got there first
        if (d.catcher === this.kid && !d.tried && this.t > d.catchAt + catchWindows(d.route, d.zone, this.tier).yellow) { d.tried = true; d.tap = 'late'; }
        if (this.t >= d.catchAt && (d.catcher === this.vis || d.tried)) this.land();
      }
      if (d.stage === 'result' && this.t >= d.nextAt) {
        if (this.left <= 0) this.end(); else this.lineUp(d.thrower === this.kid ? this.vis : this.kid);
      }
      if (this.left <= 0 && (d.stage === 'pick' || d.stage === 'throw')) this.end();
    }
    for (const p of [this.kid, this.vis]) {
      p.move(dt);
      if (this.phase === 'play' && d.stage !== 'pick' && p === d.catcher && Math.abs(p.tx - p.x) < 1) p.face = -1;
      if (d.stage === 'pick' || this.phase !== 'play') { if (Math.abs(p.tx - p.x) < 1) p.face = 1; }
      p.lookAt = this.ball.state === 'held' ? null : [this.ball.x, this.ball.y - this.ball.h];
      // a jump for a catch, a flip for a perfect one
      const since = this.t - p.flipAt;
      p.air = since < 0.6 ? Math.sin((since / 0.6) * Math.PI) * (p.flipping ? 14 : 6) : 0;
      p.spin = p.flipping && since < 0.6 ? (since / 0.6) * Math.PI * 2 * -p.face : 0;
      if (since >= 0.6) p.flipping = false;
    }
    // touchdown spike, once the catcher has landed
    if (d.spikeAt && this.t >= d.spikeAt && d.stage === 'result') {
      const b = this.ball;
      d.spikeAt = 0; b.state = 'spike'; b.vh = -120; b.vx = 4; b.h = HANDS + 4;
      this.pop('Spike!', d.catcher.x, d.catcher.y - 30, '#ffd43b');
      d.catcher.brain.impulse('kick', 1);
    }
    this.stepBall(dt);
  }

  stepBall(dt) {
    const b = this.ball; const d = this.down;
    if (b.state === 'held') {
      const h = d.stage === 'result' ? d.catcher : d.thrower;
      b.x = h.x + 5 * h.face; b.y = h.y; b.h = HANDS - 4 + h.air;
    } else if (b.state === 'air') {
      const s = this.t - b.t0;
      b.x = b.x0 + (b.tx - b.x0) * Math.min(1, s / b.T);
      b.y = this.lineY; b.h = b.h0 + b.vh * s - (GRAV * s * s) / 2;
      b.spin += dt * (b.spiral ? 30 : 9);
    } else if (b.state === 'loose' || b.state === 'spike') {
      b.vh -= GRAV * dt; b.h += b.vh * dt; b.x += b.vx * dt;
      if (b.h <= 1) { b.h = 1; b.vh = Math.abs(b.vh) * 0.45; b.vx *= 0.6; if (b.vh < 15) { b.vh = 0; b.vx *= 0.9; } }
      b.spin += dt * b.vx * 0.3;
    }
  }

  /** The ball reaches the catcher: caught or not. */
  land() {
    const d = this.down; const c = d.catcher;
    let caught; let words;
    if (c === this.kid) {
      if (d.tap === 'green') { caught = true; words = 'Great catch!'; }
      else if (d.tap === 'yellow') { caught = this.r() < 0.5; words = caught ? 'Bobbled... got it!' : 'Bobbled it!'; }
      else { caught = false; words = d.tap === 'early' ? 'Dropped!' : 'Too late!'; }
    } else {
      caught = this.r() < visCatch(d.route, d.zone, this.tier);
      words = caught ? 'Caught it!' : 'Dropped!';
    }
    // a perfect catch is a flip if that kid unlocked the flip catch
    c.flipAt = this.t; c.flipping = caught && (d.tap === 'green' || (c === this.vis && d.zone === 'green')) && c.moves.has('flipcatch');
    if (c.flipping) words = 'Flip catch!';
    if (d.tap !== 'early') this.pop(words, c.x, c.y - 32, caught ? '#b2f2bb' : '#ffa8a8');
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
      this.pop(td ? `Touchdown! +${R.pts}` : `+${R.pts}`, d.catcher.x, d.catcher.y - 42, '#ffd43b', true);
      d.catcher.brain.impulse('cheer', 1); d.thrower.brain.impulse('cheer', 1);
      d.nextAt = this.t + (td ? 2.1 : 1.5);
      this.sound = td ? 'goal' : 'catch';
      // touchdown spike, once the catcher lands
      if (td && d.catcher.moves.has('spike')) d.spikeAt = this.t + 0.65;
    } else {
      if (why !== 'sack') { b.state = 'loose'; b.vh = -40; b.vx = (b.tx > d.catcher.x ? 1 : -1) * 30; }
      d.catcher.brain.impulse('surprise', 1);
      d.nextAt = this.t + 1.3;
      this.sound = 'drop';
    }
    if (caught) this.buzz = 30;
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
    const r = rng(7);
    // sky, then the stands, then the turf
    x.fillStyle = '#74c0fc'; x.fillRect(0, 0, W, H);
    const standTop = Math.round(this.turfY - (this.turfY * 0.45));
    x.fillStyle = '#495057'; x.fillRect(0, standTop, W, this.turfY - standTop);
    for (let yy = standTop + 1; yy < this.turfY - 2; yy += 3) { x.fillStyle = '#868e96'; x.fillRect(0, yy + 2, W, 1); }
    for (let i = 0; i < (W * (this.turfY - standTop)) / 7; i += 1) {
      x.fillStyle = ['#ff8787', '#ffd43b', '#74c0fc', '#b2f2bb', '#e599f7', '#ffffff'][Math.floor(r() * 6)];
      x.fillRect(Math.floor(r() * W), standTop + 1 + Math.floor(r() * (this.turfY - standTop - 3)), 1, 1);
    }
    x.fillStyle = '#1b1430'; x.fillRect(0, this.turfY - 2, W, 2);
    // mowed stripes
    for (let xx = 0; xx < W; xx += 1) {
      x.fillStyle = Math.floor(xx / 12) % 2 ? '#37b24d' : '#2f9e44';
      x.fillRect(xx, this.turfY, 1, H - this.turfY);
    }
    // end zone, its goal post and yard lines (drawn leaning, as if seen from the side)
    x.fillStyle = '#e03131'; x.fillRect(this.endX, this.turfY, W - this.endX, H - this.turfY);
    x.fillStyle = '#c92a2a';
    for (let i = 0; i < 40; i += 1) x.fillRect(this.endX + Math.floor(r() * (W - this.endX)), this.turfY + Math.floor(r() * (H - this.turfY)), 2, 1);
    const lean = (lx, col) => { x.fillStyle = col; for (let yy = this.turfY; yy < H; yy += 1) x.fillRect(Math.round(lx + (yy - this.turfY) * 0.25), yy, 1, 1); };
    for (let lx = this.qbX - 6; lx < this.endX; lx += 18) lean(lx, 'rgba(255,255,255,0.7)');
    lean(this.endX, '#ffffff'); lean(this.endX + 1, '#ffffff');
    const gx = W - 12;
    x.fillStyle = '#ffd43b';
    x.fillRect(gx, this.turfY - 30, 2, this.lineY - this.turfY + 22);
    x.fillRect(gx - 9, this.turfY - 30, 20, 2);
    x.fillRect(gx - 9, this.turfY - 52, 2, 22); x.fillRect(gx + 9, this.turfY - 52, 2, 22);
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
    const d = this.down;
    // the three route spots while picking
    if (this.phase === 'play' && d.stage === 'pick') {
      const pulse = Math.floor(this.t * 3) % 2;
      for (const k of Object.keys(ROUTES)) {
        const sx = this.spot(k);
        ctx.fillStyle = pulse ? '#ffd43b' : '#ffe066';
        for (let a = 0; a < 28; a += 1) ctx.fillRect(Math.round(sx + Math.cos((a / 28) * Math.PI * 2) * 8), Math.round(this.lineY + Math.sin((a / 28) * Math.PI * 2) * 3), 1, 1);
        ctx.fillStyle = '#ff922b'; ctx.fillRect(sx - 1, this.lineY - 4, 3, 4); ctx.fillRect(sx - 2, this.lineY - 1, 5, 1); // a cone
      }
    }
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    const b = this.ball;
    // the catch ring, closing on the ball
    if (d.stage === 'air' && d.catcher === this.kid && !d.tried) {
      const left = d.catchAt - this.t;
      if (left < RING_LEAD) {
        const rad = 2 + 13 * Math.max(0, left) / RING_LEAD;
        const w = catchWindows(d.route, d.zone, this.tier);
        ctx.fillStyle = Math.abs(left) <= w.green ? '#40c057' : Math.abs(left) <= w.yellow ? '#fcc419' : 'rgba(255,255,255,0.9)';
        const cx = b.tx; const cy = this.lineY - HANDS - 3; const n = Math.max(10, Math.round(rad * 6));
        for (let a = 0; a < n; a += 1) ctx.fillRect(Math.round(cx + Math.cos((a / n) * Math.PI * 2) * rad), Math.round(cy + Math.sin((a / n) * Math.PI * 2) * rad), 1, 1);
      }
    }
    // whoever is farther back is drawn first
    const ps = [this.kid, this.vis].sort((a, c) => (a === d.catcher ? 1 : -1) - (c === d.catcher ? 1 : -1));
    for (const p of ps) this.drawPlayer(ctx, p);
    // the ball and its shadow
    if (b.state !== 'held' || this.phase !== 'ready') {
      ctx.fillStyle = 'rgba(20,40,20,0.3)';
      const sw = Math.max(3, 7 - Math.round(b.h / 10));
      ctx.fillRect(Math.round(b.x - sw / 2), this.lineY, sw, 1);
      const bx = Math.round(b.x); const by = Math.round(b.y - b.h);
      if (b.state === 'air' && b.spiral) {
        ctx.fillStyle = '#fff3bf';
        for (let i = 1; i <= 4; i += 1) { const s = (this.t - b.t0) - i * 0.05; if (s > 0) ctx.fillRect(Math.round(b.x0 + (b.tx - b.x0) * Math.min(1, s / b.T)), Math.round(this.lineY - (b.h0 + b.vh * s - (GRAV * s * s) / 2)), 1, 1); }
      }
      ctx.save(); ctx.translate(bx, by);
      // in the air the ball points along its path; a wobbly one tumbles
      if (b.state === 'air') {
        const s = this.t - b.t0; const vx = (b.tx - b.x0) / b.T; const vy = b.vh - GRAV * s;
        let a = Math.atan2(-vy, vx);
        if (d.zone === 'red') a = b.spin; else if (d.zone === 'yellow') a += Math.sin(b.spin) * 0.4;
        ctx.rotate(a);
        if (b.spiral && Math.floor(b.spin) % 2) ctx.scale(1, -1);
      } else if (b.state !== 'held') ctx.rotate(b.spin);
      ctx.drawImage(this.ballPic, -4, -2);
      ctx.restore();
    }
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
    // score and clock
    const secs = Math.ceil(this.left);
    text(`${this.score}`, W / 2, u * 2.4, u * 3.4, '#ffd43b');
    text(`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`, W / 2, u * 5.1, u * 1.6, secs <= 10 && this.phase === 'play' ? '#ff8787' : '#e9ecef');
    if (this.phase === 'play') {
      if (d.stage === 'pick') {
        text(`${d.thrower.name} throws to ${d.catcher.name}. Pick a route!`, W / 2, (this.turfY - 8) * S, u * 1.6, '#ffffff');
        for (const k of Object.keys(ROUTES)) text(`${ROUTES[k].name} ${ROUTES[k].pts}`, this.spot(k) * S, (this.lineY + 9) * S, u * 1.5, '#ffd43b');
      }
      // the throw meter over your buddy
      if (d.stage === 'throw' && d.thrower === this.kid) {
        const m = this.meter();
        const mw = u * 12; const mh = u * 1.4; const mx = clamp(this.kid.x * S - mw / 2 + u * 3, u, W - mw - u); const my = (this.kid.y - 36) * S;
        for (let i = 0; i < 100; i += 1) { ctx.fillStyle = ZONE_COLORS[zoneAt((i + 0.5) / 100, this.tier)]; ctx.fillRect(mx + (i * mw) / 100, my, mw / 100 + 0.5, mh); }
        ctx.lineWidth = S * 0.6; ctx.strokeStyle = '#1b1430'; ctx.strokeRect(mx, my, mw, mh);
        ctx.fillStyle = '#ffffff'; ctx.fillRect(mx + m * mw - S * 0.6, my - S, S * 1.2, mh + 2 * S);
        text('Tap to throw!', mx + mw / 2, my - u * 1.2, u * 1.4, '#ffffff');
      }
      if (d.stage === 'throw' && d.thrower === this.vis) text('!', this.vis.x * S, (this.vis.y - 32) * S, u * 2, '#ff8787');
      if (d.stage === 'air' && d.catcher === this.kid && !d.tried && d.catchAt - this.t < RING_LEAD) text('Tap to catch!', W / 2, (this.turfY - 8) * S, u * 1.6, '#ffffff');
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, clamp(p.x * S, u * 6, W - u * 6), (p.y - age * 10) * S, u * (p.big ? 2.4 : 1.7), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ready' && Math.floor(this.t * 2) % 3) text(this.locked ? "That's all our games today!" : 'Tap to play!', W / 2, (this.H - 7) * S, u * 1.8);
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.turfY - 4) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.85)';
      const bw = Math.min(W * 0.8, u * 34); const bh = u * 9.5;
      ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      text(`Time's up! ${this.score} points`, W / 2, cy - u * 2.3, u * 2.6, '#ffd43b');
      text(this.newBest ? 'New best!' : `Best ${this.best} points`, W / 2, cy + u * 0.3, u * 1.8, this.newBest ? '#b2f2bb' : '#e9ecef');
      text(`${this.caught} of ${this.plays} passes caught`, W / 2, cy + u * 2.5, u * 1.4, '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to play again', W / 2, cy + u * 4.2, u * 1.4, '#ffffff');
    }
  }
}
