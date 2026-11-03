// Playing with a visiting buddy, once the day's chores are done. Both buddies
// play every game: the kid's buddy and the visitor.
//
// Ball games (soccer for now): tap the buddy who'll get the ball next, just as
// the ball comes down to them. Tapping the buddy who has the ball juggles it
// straight up; tapping the other buddy passes it over. A ring shrinks onto the
// spot where the ball lands, so the rhythm is easy to see. Taps that are off
// make the ball wobble: the next one lands to the side and comes sooner, and
// the buddy chases it. Good taps steady it again; too much wobble and it drops.
// Better balls make the timing a little easier; it gets a little faster the
// longer it goes.
//
// Tag (a visitor with no ball): tap the visitor and they're IT. Tap the field
// and your buddy runs there. Running shoes run faster; everybody slows down
// as they tire. The score is the time your buddy wasn't IT, until it's tagged
// for the second time.
//
// No coins: play is just for fun. Each game keeps a best score.
//
// The game keeps its own clock (step) and draws whole pixels on a small canvas
// that the page scales up (draw); words go on a second, sharp canvas (drawHud).
import { buildRig, render, Brain, CALM } from './rig.js';
import { ballCells, SPRITE_Y } from './avatar.js';

/** Which game a visitor plays, from the gear they own: { kind: best tier }. */
export function gameFor(gear = {}) {
  return gear.soccer ? 'soccer' : 'tag';
}

export const GAME_NAMES = { soccer: 'Keepy-uppy', tag: 'Tag' };

const HAPPY = { ...CALM, valence: 0.7, arousal: 0.6 };
const FOOT = 4; // how high the ball is when it meets a foot
const GRAV = 272; // pixels a second, squared: a 1 second hop goes 34 pixels up
const TAG_REACH = 9;
const FEET = SPRITE_Y + 16; // from a buddy's feet to the top of its picture

function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
function cellsCanvas(cells) {
  const h = cells.length; const w = cells[0].length;
  const c = canvas(w, h); const x = c.getContext('2d');
  const img = x.createImageData(w, h);
  cells.forEach((row, y) => row.forEach((col, i) => {
    if (!col) return;
    const p = (y * w + i) * 4;
    img.data[p] = parseInt(col.slice(1, 3), 16); img.data[p + 1] = parseInt(col.slice(3, 5), 16); img.data[p + 2] = parseInt(col.slice(5, 7), 16); img.data[p + 3] = 255;
  }));
  x.putImageData(img, 0, 0);
  return c;
}

/** A buddy's outfit for a game: held gear put down (the game draws the ball), running shoes on for tag. */
function playLook(buddy, gear, kind) {
  const outfit = { ...(buddy?.outfit || {}) };
  delete outfit.sport;
  if (kind === 'tag' && gear?.shoes) outfit.sport = `sport-shoes-${['regular', 'good', 'super'][gear.shoes - 1]}`;
  return { species: buddy?.species, outfit };
}

// ---------- a buddy on the field ----------
class Player {
  constructor(buddy, name, seed, x, y) {
    this.name = name;
    this.rig = buildRig(buddy, { background: false });
    this.brain = new Brain(seed);
    this.brain.set(HAPPY); this.brain.settle();
    this.x = x; this.y = y; this.tx = x; this.ty = y; this.home = [x, y];
    this.face = 1; this.speed = 60; this.run = 0; this.stride = 0;
    this.vx = 0; this.vy = 0;
    this.frame = -1; this.poseT = 0; this.lookAt = null;
    this.pic = canvas(24, 24);
  }

  goTo(x, y) { this.tx = x; this.ty = y; }

  move(dt) {
    const dx = this.tx - this.x; const dy = this.ty - this.y; const d = Math.hypot(dx, dy);
    const px = this.x; const py = this.y;
    if (d > 0.6) {
      const k = Math.min(1, (this.speed * dt) / d);
      this.x += dx * k; this.y += dy * k;
      if (Math.abs(dx) > 0.6) this.face = dx > 0 ? 1 : -1;
      this.run = Math.min(1, this.run + dt * 8);
    } else {
      this.run = Math.max(0, this.run - dt * 6);
    }
    this.vx = (this.x - px) / Math.max(dt, 1e-3); this.vy = (this.y - py) / Math.max(dt, 1e-3);
    this.stride += dt * (6 + this.speed * 0.1) * (this.run > 0.05 ? 1 : 0);
  }

  /** Style A: a new pose 12 times a second, with legs and arms swinging while it runs. */
  paint(t) {
    const frame = Math.floor(t * 12);
    if (frame === this.frame) return;
    const dt = this.frame < 0 ? 1 / 12 : t - this.poseT;
    this.frame = frame; this.poseT = t;
    let look = null;
    if (this.lookAt) look = [12 + (this.lookAt[0] - this.x) * this.face, 12 + (this.lookAt[1] - this.y) * 0.5];
    const pose = this.brain.pose(t, dt, { lookAt: look });
    const r = this.run;
    if (r > 0.05) {
      const s = Math.sin(this.stride);
      pose.footL = { dy: -Math.round(Math.max(0, s) * 2 * r), dx: Math.round(s * r) };
      pose.footR = { dy: -Math.round(Math.max(0, -s) * 2 * r), dx: -Math.round(s * r) };
      pose.root.dy -= Math.abs(Math.cos(this.stride)) * 1.4 * r;
      pose.armL = { rot: pose.armL.rot + s * 55 * r };
      pose.armR = { rot: pose.armR.rot + s * 55 * r };
      pose.head.dx += r;
    }
    const buf = render(this.rig, pose, frame);
    const x = this.pic.getContext('2d');
    const img = x.createImageData(24, 24);
    for (let i = 0; i < buf.length; i += 1) {
      const c = buf[i];
      if (!c) continue;
      img.data[i * 4] = parseInt(c.slice(1, 3), 16); img.data[i * 4 + 1] = parseInt(c.slice(3, 5), 16); img.data[i * 4 + 2] = parseInt(c.slice(5, 7), 16); img.data[i * 4 + 3] = 255;
    }
    x.putImageData(img, 0, 0);
  }

  draw(ctx) {
    const x = Math.round(this.x); const y = Math.round(this.y);
    ctx.fillStyle = 'rgba(20,40,20,0.28)';
    ctx.fillRect(x - 5, y - 1, 10, 1); ctx.fillRect(x - 4, y, 8, 1);
    ctx.save();
    if (this.face < 0) { ctx.translate(x, 0); ctx.scale(-1, 1); ctx.drawImage(this.pic, -12, y - FEET); } else ctx.drawImage(this.pic, x - 12, y - FEET);
    ctx.restore();
  }
}

// ---------- the game ----------
/**
 * opts: { W, H: field size in pixels; kind: 'soccer' | 'tag';
 *   kid, visitor: { buddy: { species, outfit }, name, gear: { kind: tier } };
 *   best: best score so far; seed }
 * Taps come in field pixels: tap(x, y). Moving a finger while it's down: drag(x, y).
 */
export class Play {
  constructor(opts) {
    this.W = opts.W; this.H = opts.H; this.kind = opts.kind;
    this.best = opts.best || 0;
    this.r = rng(opts.seed || 1);
    this.t = 0;
    this.pops = [];
    this.top = 26; // room for the score
    const y = Math.round(this.top + (this.H - this.top) * 0.6);
    this.kid = new Player(playLook(opts.kid.buddy, opts.kid.gear, this.kind), opts.kid.name, 11, Math.round(this.W * 0.34), y);
    this.vis = new Player(playLook(opts.visitor.buddy, opts.visitor.gear, this.kind), opts.visitor.name, 23, Math.round(this.W * 0.66), y);
    this.kid.gear = opts.kid.gear || {}; this.vis.gear = opts.visitor.gear || {};
    this.kid.face = 1; this.vis.face = -1;
    this.field = this.paintField();
    if (this.kind === 'soccer') {
      this.tier = Math.max(this.kid.gear.soccer || 0, this.vis.gear.soccer || 0, 1);
      this.ballPic = cellsCanvas(ballCells('soccer', this.tier));
    }
    this.reset();
  }

  reset() {
    this.phase = 'ready'; this.score = 0; this.newBest = false; this.overAt = 0;
    for (const p of [this.kid, this.vis]) { p.goTo(...p.home); p.brain.set(HAPPY); }
    if (this.kind === 'soccer') {
      this.count = 0; this.wob = 0;
      this.ball = { state: 'held', owner: this.vis, x: this.vis.home[0], y: this.vis.home[1] + 1, h: FOOT };
    } else {
      this.it = null; this.tags = 0; this.free = 0; this.frozen = 0; this.wander = 0; this.itSince = 0;
      this.kid.speed = 60; this.vis.speed = 60;
    }
  }

  get bounds() { return { x0: 12, x1: this.W - 12, y0: this.top + 22, y1: this.H - 4 }; }

  pop(text, x, y, color = '#ffffff', big = false) {
    this.pops.push({ text, x, y, at: this.t, color, big });
    if (this.pops.length > 8) this.pops.shift();
  }

  nearest(x, y) {
    const d = (p) => Math.hypot(p.x - x, (p.y - 10) - y);
    return d(this.kid) <= d(this.vis) ? this.kid : this.vis;
  }

  other(p) { return p === this.kid ? this.vis : this.kid; }

  tap(x, y) {
    if (this.phase === 'over') {
      if (this.t - this.overAt > 1.2) this.reset();
      return;
    }
    if (this.kind === 'soccer') this.tapSoccer(x, y); else this.tapTag(x, y);
  }

  drag(x, y) {
    if (this.kind === 'tag' && this.phase === 'play') this.runTo(x, y);
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    if (this.kind === 'soccer') this.stepSoccer(dt); else this.stepTag(dt);
    for (const p of [this.kid, this.vis]) p.move(dt);
    this.pops = this.pops.filter((p) => this.t - p.at < 1.1);
  }

  finish(score) {
    this.phase = 'over'; this.overAt = this.t; this.score = score;
    this.newBest = score > this.best;
    if (this.newBest) this.best = score;
  }

  // ---------- soccer ----------
  windows() {
    const harder = Math.max(0.65, 1 - this.count * 0.008);
    const k = this.tier;
    return { perfect: (0.05 + 0.02 * k) * harder, good: (0.1 + 0.03 * k) * harder, early: (0.19 + 0.03 * k) * harder, late: (0.19 + 0.03 * k) * harder };
  }

  /** Seconds the ball is in the air for a straight-up juggle: a little quicker as the count goes up. */
  beat() { return Math.max(0.62, 1.0 - this.count * 0.01); }

  /** When the ball next reaches a foot, and whose (for the preview script and tests). */
  next() { const b = this.ball; return b.state === 'air' ? { at: b.contact, to: b.to } : null; }

  tapSoccer(x, y) {
    const who = this.nearest(x, y);
    const b = this.ball;
    if (this.phase === 'ready') {
      this.phase = 'play';
      this.kick(this.vis, who, 'start', 0);
      return;
    }
    if (b.state !== 'air') return;
    const w = this.windows();
    const e = this.t - b.contact;
    const keeper = b.to;
    if (e < -w.early) {
      this.wob += 0.2;
      this.pop('Too soon!', keeper.x, keeper.y - 26, '#ffa8a8');
      return;
    }
    if (Math.hypot(keeper.tx - keeper.x, keeper.ty - keeper.y) > 6) {
      this.pop("Can't reach!", keeper.x, keeper.y - 26, '#ffa8a8');
      return;
    }
    const q = Math.abs(e) <= w.perfect ? 'perfect' : Math.abs(e) <= w.good ? 'good' : 'off';
    this.count += 1;
    this.kick(keeper, who, q, e);
  }

  kick(from, to, q, e) {
    const b = this.ball;
    const w = this.windows();
    if (q === 'perfect') this.wob = Math.max(0, this.wob - 0.4);
    else if (q === 'good') this.wob = Math.max(0, this.wob - 0.15);
    else if (q === 'off') this.wob += 0.35 + 0.35 * clamp((Math.abs(e) - w.good) / (w.early - w.good), 0, 1);
    const wild = this.wob >= 1;
    from.brain.impulse('kick', 1);
    from.face = to === from ? from.face : (to.x > from.x ? 1 : -1);
    if (q === 'perfect') this.pop('Perfect!', from.x, from.y - 28, '#ffd43b');
    else if (q === 'good') this.pop('Good', from.x, from.y - 28, '#b2f2bb');
    else if (q === 'off') this.pop(e < 0 ? 'Early!' : 'Late!', from.x, from.y - 28, '#ffa8a8');
    if (q !== 'start' && q !== 'off' && this.count % 10 === 0) to.brain.impulse('cheer', 1);

    const pass = to !== from;
    let T = this.beat() * (pass ? 1.25 : 1);
    const side = (this.r() < 0.5 ? -1 : 1) * (wild ? 64 : this.wob * 24 + (q === 'off' ? 6 : 0));
    T *= 1 - 0.3 * Math.min(1, this.wob);
    const bd = this.bounds;
    let tx = to.home[0] + side;
    let ty = to.home[1] + (this.r() - 0.5) * this.wob * 14;
    if (!wild) {
      if (tx < bd.x0 + 4 || tx > bd.x1 - 4) tx = to.home[0] - side;
      tx = clamp(tx, bd.x0 + 4, bd.x1 - 4); ty = clamp(ty, bd.y0 + 8, bd.y1 - 2);
    }
    if (wild) this.pop('Whoa!', from.x, from.y - 28, '#ffa8a8');
    Object.assign(b, {
      state: 'air', owner: from, to, fx: b.x, fy: b.y, fh: b.h, tx, ty,
      t0: this.t, T, contact: this.t + T, apex: (GRAV * T * T) / 8,
    });
    // the ball comes down beside the receiving buddy, on the side facing the other buddy
    const face = this.other(to).home[0] > tx ? 1 : -1;
    to.goTo(clamp(tx - face * 8, bd.x0, bd.x1), clamp(ty - 1, bd.y0, bd.y1));
    if (pass) from.goTo(...from.home);
    for (const p of [this.kid, this.vis]) p.lookAt = [tx, ty - 20];
  }

  stepSoccer(dt) {
    const b = this.ball;
    if (b.state === 'held') {
      b.x = b.owner.x + b.owner.face * 4; b.y = b.owner.y + 1;
      b.h = FOOT + Math.round(Math.abs(Math.sin(this.t * 3)) * 2);
    } else if (b.state === 'air') {
      const s = (this.t - b.t0) / b.T;
      const late = this.windows().late;
      if (s <= 1) {
        b.x = lerp(b.fx, b.tx, s); b.y = lerp(b.fy, b.ty, s);
        b.h = lerp(b.fh, FOOT, s) + b.apex * 4 * s * (1 - s);
      } else {
        // a late ball sinks slowly to the grass, so a late tap can still save it
        const u = (this.t - b.contact) / late;
        b.h = FOOT * (1 - u);
        if (u >= 1) this.drop();
      }
      // whoever is waiting looks at the ball
      for (const p of [this.kid, this.vis]) p.lookAt = [b.x, b.y - b.h];
    } else if (b.state === 'loose') {
      b.vh -= GRAV * dt; b.h += b.vh * dt;
      if (b.h <= 0) { b.h = 0; b.vh = Math.abs(b.vh) * 0.45; if (b.vh < 12) b.vh = 0; }
      b.x += b.vx * dt; b.vx *= Math.pow(0.35, dt);
      if (b.x < 6 || b.x > this.W - 6) b.vx = -b.vx;
      if (this.phase === 'play' && this.t - b.at > 0.9) this.finish(this.count);
    }
    // standing buddies face each other
    for (const p of [this.kid, this.vis]) if (p.run < 0.2) p.face = this.other(p).x > p.x ? 1 : -1;
  }

  drop() {
    const b = this.ball;
    const dir = b.tx >= b.fx ? 1 : -1;
    Object.assign(b, { state: 'loose', vh: 40, vx: dir * 50, at: this.t });
    b.to.brain.impulse('surprise', 1);
    this.other(b.to).brain.impulse('surprise', 1);
    this.pop('Oops!', b.x, b.y - 18, '#ffa8a8', true);
  }

  // ---------- tag ----------
  runTo(x, y) {
    const bd = this.bounds;
    if (this.it === 'kid' && this.t < this.frozen) return;
    this.kid.goTo(clamp(x, bd.x0, bd.x1), clamp(y + 8, bd.y0, bd.y1));
  }

  tapTag(x, y) {
    if (this.phase === 'ready') {
      const near = Math.hypot(this.vis.x - x, this.vis.y - 10 - y) < 18;
      if (!near) { this.runTo(x, y); return; }
      this.phase = 'play'; this.start = this.t;
      this.tagged(this.vis, 1.5);
      return;
    }
    this.runTo(x, y);
  }

  tagged(p, freeze = 1.5) {
    this.it = p === this.kid ? 'kid' : 'vis';
    this.frozen = this.t + freeze; this.itSince = this.t;
    p.goTo(p.x, p.y);
    p.brain.impulse('surprise', 1);
    this.other(p).brain.impulse('giggle', 1);
    this.pop(p === this.kid ? "You're IT!" : `${this.vis.name} is IT!`, p.x, p.y - 28, '#ffd43b', true);
  }

  baseSpeed(p) { return 62 + 9 * (p.gear.shoes || 0); }

  stepTag(dt) {
    const k = this.kid; const v = this.vis; const bd = this.bounds;
    if (this.phase !== 'play') {
      v.face = k.x > v.x ? 1 : -1;
      if (this.phase === 'ready') { k.speed = this.baseSpeed(k); }
      return;
    }
    const age = this.t - this.start;
    k.speed = this.baseSpeed(k) * Math.max(0.5, 1 - 0.012 * age);
    if (age > 14) k.brain.set({ focus: 0.6 }); // tired: a drop of sweat
    const ready = this.t >= this.frozen;
    if (this.it === 'vis') {
      this.free += dt;
      v.speed = this.baseSpeed(v) * 0.68 * Math.max(0.6, 1 - 0.004 * age);
      if (ready) {
        // aims a little ahead of where the kid's buddy is going, with a wobble
        const lead = 0.15;
        v.goTo(clamp(k.x + k.vx * lead + Math.sin(this.t * 1.7) * 4, bd.x0, bd.x1), clamp(k.y + k.vy * lead, bd.y0, bd.y1));
        if (Math.hypot(k.x - v.x, k.y - v.y) < TAG_REACH) {
          this.tags += 1;
          if (this.tags >= 2) {
            k.brain.impulse('surprise', 1); v.brain.impulse('cheer', 1);
            k.goTo(k.x, k.y); v.goTo(v.x, v.y);
            this.finish(Math.round(this.free * 10) / 10);
            return;
          }
          this.tagged(k);
        }
      }
    } else {
      // running away: from the kid's buddy, off the walls, with a wander; slower the longer it's chased
      const chased = this.t - this.itSince;
      v.speed = this.baseSpeed(v) * 0.8 * Math.max(0.55, 1 - 0.005 * age) * (chased > 8 ? 0.85 : 1);
      let ax = v.x - k.x; let ay = (v.y - k.y) * 1.3;
      const d = Math.hypot(ax, ay) || 1; ax /= d; ay /= d;
      const m = 22;
      if (v.x - bd.x0 < m) ax += (m - (v.x - bd.x0)) / m * 1.6;
      if (bd.x1 - v.x < m) ax -= (m - (bd.x1 - v.x)) / m * 1.6;
      if (v.y - bd.y0 < m) ay += (m - (v.y - bd.y0)) / m * 1.6;
      if (bd.y1 - v.y < m) ay -= (m - (bd.y1 - v.y)) / m * 1.6;
      this.wander += (this.r() - 0.5) * dt * 6;
      ax += Math.cos(this.wander) * 0.35; ay += Math.sin(this.wander) * 0.35;
      const n = Math.hypot(ax, ay) || 1;
      v.goTo(clamp(v.x + (ax / n) * 24, bd.x0, bd.x1), clamp(v.y + (ay / n) * 24, bd.y0, bd.y1));
      if (ready && Math.hypot(k.x - v.x, k.y - v.y) < TAG_REACH) this.tagged(v);
    }
    if (!ready) (this.it === 'kid' ? k : v).goTo((this.it === 'kid' ? k : v).x, (this.it === 'kid' ? k : v).y);
    k.lookAt = [v.x, v.y - 10]; v.lookAt = [k.x, k.y - 10];
  }

  // ---------- drawing ----------
  paintField() {
    const c = canvas(this.W, this.H); const x = c.getContext('2d');
    const r = rng(7);
    for (let i = 0; i * 16 < this.W; i += 1) {
      x.fillStyle = i % 2 ? '#5fbf5a' : '#69c964';
      x.fillRect(i * 16, 0, 16, this.H);
    }
    x.fillStyle = '#4fa84b';
    for (let i = 0; i < (this.W * this.H) / 90; i += 1) {
      const gx = Math.floor(r() * this.W); const gy = Math.floor(r() * this.H);
      x.fillRect(gx, gy, 1, 1); x.fillRect(gx + 1, gy - 1, 1, 1);
    }
    x.fillStyle = '#f1f3f5';
    const b = { x0: 4, y0: this.top + 6, x1: this.W - 5, y1: this.H - 2 };
    x.fillRect(b.x0, b.y0, b.x1 - b.x0, 1); x.fillRect(b.x0, b.y1, b.x1 - b.x0 + 1, 1);
    x.fillRect(b.x0, b.y0, 1, b.y1 - b.y0); x.fillRect(b.x1, b.y0, 1, b.y1 - b.y0);
    if (this.kind === 'soccer') {
      const cx = Math.round(this.W / 2); const cy = Math.round((b.y0 + b.y1) / 2);
      x.fillRect(cx, b.y0, 1, b.y1 - b.y0);
      for (let a = 0; a < 64; a += 1) x.fillRect(Math.round(cx + Math.cos((a / 64) * Math.PI * 2) * 16), Math.round(cy + Math.sin((a / 64) * Math.PI * 2) * 10), 1, 1);
    }
    return c;
  }

  /** Draws the field, buddies and ball on a W x H canvas. */
  draw(ctx) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(this.field, 0, 0);
    const things = [this.kid, this.vis].map((p) => ({ y: p.y, draw: () => p.draw(ctx) }));
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    if (this.kind === 'soccer') {
      const b = this.ball;
      // the timing ring, shrinking onto the landing spot
      if (b.state === 'air') {
        const left = b.contact - this.t;
        if (left < 0.75) {
          const rad = Math.max(2, 2 + 12 * Math.max(0, left) / 0.75);
          const near = Math.abs(left) <= this.windows().perfect;
          ctx.fillStyle = near ? '#ffd43b' : 'rgba(255,255,255,0.85)';
          const n = Math.max(10, Math.round(rad * 5));
          for (let a = 0; a < n; a += 1) ctx.fillRect(Math.round(b.tx + Math.cos((a / n) * Math.PI * 2) * rad), Math.round(b.ty + Math.sin((a / n) * Math.PI * 2) * rad * 0.5), 1, 1);
        }
      }
      ctx.fillStyle = 'rgba(20,40,20,0.3)';
      const sw = Math.max(3, 6 - Math.round(b.h / 12));
      ctx.fillRect(Math.round(b.x - sw / 2), Math.round(b.y), sw, 1);
      things.push({ y: b.y + 0.5, draw: () => ctx.drawImage(this.ballPic, Math.round(b.x - 3), Math.round(b.y - b.h - 6)) });
    }
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());
  }

  /** Words and numbers, on a canvas `scale` times bigger than the field. */
  drawHud(ctx, scale) {
    const S = scale; const W = this.W * S;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const text = (s, x, y, px, color = '#ffffff') => {
      ctx.font = `${Math.round(px)}px "Jersey 10", monospace`;
      ctx.lineJoin = 'round'; ctx.lineWidth = Math.max(3, px / 7); ctx.strokeStyle = '#1b1430';
      ctx.strokeText(s, x, y); ctx.fillStyle = color; ctx.fillText(s, x, y);
    };
    const u = S * 4; // a text unit
    if (this.kind === 'soccer') {
      text(String(this.count), W / 2, u * 2.6, u * 4.2, '#ffd43b');
      text(`Best ${this.best}`, W / 2, u * 5.2, u * 1.6, '#e9ecef');
    } else {
      const free = this.phase === 'over' ? this.score : this.free;
      text(`${free.toFixed(1)} s`, W / 2, u * 2.6, u * 3.6, '#ffd43b');
      text(`Best ${this.best.toFixed ? this.best.toFixed(1) : this.best} s`, W / 2, u * 5.2, u * 1.6, '#e9ecef');
      if (this.phase === 'play') {
        const msg = this.it === 'vis' ? `${this.vis.name} is IT! Run!` : `You're IT! Tag ${this.vis.name}!`;
        text(msg, W / 2, (this.H - 5) * S, u * 1.6, this.it === 'vis' ? '#ffffff' : '#ffd43b');
        if (this.t < this.frozen) {
          const p = this.it === 'kid' ? this.kid : this.vis;
          text(String(Math.ceil(this.frozen - this.t)), p.x * S, (p.y - 28) * S, u * 2.2, '#ffffff');
        }
      }
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, p.x * S, (p.y - age * 10) * S, u * (p.big ? 2.2 : 1.7), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ready') {
      const msg = this.kind === 'soccer' ? 'Tap a buddy to kick off!' : `Tap ${this.vis.name} to start tag!`;
      if (Math.floor(this.t * 2) % 3) text(msg, W / 2, (this.H - 5) * S, u * 1.8);
    }
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.top + 20) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.82)';
      const bw = Math.min(W * 0.8, u * 34); const bh = u * 9.5;
      ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      const line = this.kind === 'soccer' ? `${this.score} ${this.score === 1 ? 'kick' : 'kicks'}!` : `Free for ${this.score.toFixed(1)} seconds!`;
      text(line, W / 2, cy - u * 2.3, u * 2.6, '#ffd43b');
      text(this.newBest ? 'New best!' : `Best ${this.kind === 'soccer' ? this.best : `${this.best.toFixed(1)} s`}`, W / 2, cy + u * 0.4, u * 1.8, this.newBest ? '#b2f2bb' : '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to play again', W / 2, cy + u * 2.8, u * 1.5, '#ffffff');
    }
  }
}
