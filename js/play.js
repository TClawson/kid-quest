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
// as they tire. The score counts up while your buddy isn't IT and down at
// half speed while it is (never below 0), until it's tagged for the third
// time. Bumping into a moving obstacle knocks a buddy back and stops it for
// half a second.
//
// No coins: play is just for fun. Each game keeps a best score.
//
// The game keeps its own clock (step) and draws whole pixels on a small canvas
// that the page scales up (draw); words go on a second, sharp canvas (drawHud).
import { buildRig, render, Brain, CALM } from './rig.js';
import { ballCells, SPRITE_Y } from './avatar.js';

/**
 * Which game a visitor plays, from the gear they own ({ kind: best tier }): one of
 * their ball games, the same one all day (seed: something like the date and the
 * visitor's id), or tag when they have none.
 */
export function gameFor(gear = {}, seed = '') {
  const games = ['soccer', 'hockey'].filter((k) => gear[k]);
  if (!games.length) return 'tag';
  let h = 7;
  for (const ch of String(seed)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return games[h % games.length];
}

/**
 * Keepy-uppy timing windows in seconds either side of the moment the ball
 * lands, after `count` kicks with a ball of `tier` (1-3). Perfect narrows the
 * most as the count goes up, Good a little less, and the earliest and latest
 * taps that still count the least.
 */
export function kickWindows(count, tier = 1) {
  const tight = (rate, floor) => Math.max(floor, 1 - count * rate);
  const edge = (0.19 + 0.03 * tier) * tight(0.008, 0.65);
  // Perfect and Good are 30% narrower than they first were (Taylor, 2026-11-04)
  return { perfect: 0.7 * (0.05 + 0.02 * tier) * tight(0.012, 0.4), good: 0.7 * (0.1 + 0.03 * tier) * tight(0.009, 0.55), early: edge, late: edge };
}

/** How much higher or lower than usual a kick can go (0.15 = up to 15% more or less air time). */
export const heightSpread = (count) => Math.min(0.3, 0.12 + count * 0.004);

export const GAME_NAMES = { soccer: 'Keepy-uppy', tag: 'Tag', hockey: 'Hockey' };

// ---------- tag levels ----------
// Every LEVEL_HOLD seconds the field scrolls sideways to the next level. Tag goes
// on while it scrolls: the buddies ride along with the screen, and the new
// level's obstacles slide in from the right (and bump anyone in their way). Level n has n obstacles; from level 4 on, n - 3 of them move.
const LEVEL_HOLD = 10;
const LEVEL_SCROLL = 2.5;
const MAX_OBSTACLES = 7;

/** Obstacles for a level, placed in the strip x0..x0 + W (world pixels). */
export function levelObstacles(level, x0, W, y0, y1, r) {
  const n = Math.min(MAX_OBSTACLES, level);
  const moving = Math.max(0, level - 3);
  const out = [];
  for (let i = 0; i < n && out.length < n; i += 1) {
    for (let tries = 0; tries < 40; tries += 1) {
      const rad = 6 + Math.floor(r() * 4);
      const x = x0 + 34 + r() * (W - 56); const y = y0 + rad + 6 + r() * (y1 - y0 - 2 * rad - 10);
      if (out.some((o) => Math.hypot(o.x - x, (o.y - y) * 1.4) < o.r + rad + 18)) continue;
      const kinds = ['bush', 'rock', 'hay'];
      const o = { x, y, r: rad, kind: kinds[Math.floor(r() * kinds.length)], cx: x, cy: y };
      if (i < moving) {
        // rolls back and forth along a line
        const ang = r() * Math.PI;
        o.kind = 'barrel'; o.r = 6;
        o.move = { dx: Math.cos(ang) * (18 + r() * 14), dy: Math.sin(ang) * (10 + r() * 8), speed: 0.9 + r() * 0.7, phase: r() * Math.PI * 2 };
      }
      out.push(o);
      break;
    }
  }
  return out;
}

const OBSTACLE_PAL = {
  bush: ['#2f9e44', '#51cf66', '#1b5e20'],
  rock: ['#868e96', '#ced4da', '#495057'],
  hay: ['#fcc419', '#ffe066', '#e67700'],
  barrel: ['#a0522d', '#d08a5a', '#5c2d12'],
};

export const HAPPY = { ...CALM, valence: 0.7, arousal: 0.6 };
const FOOT = 4; // how high the ball is when it meets a foot
const GRAV = 272; // pixels a second, squared: a 1 second hop goes 34 pixels up
const TAG_REACH = 9;
export const TAG_OUTS = 3;
export const TAG_DRAIN = 0.5; // while your buddy is IT the score goes down at this many seconds per second
const BONK_BACK = 10; // pixels a moving obstacle knocks a buddy back
const BONK_STOP = 0.5; // seconds a knocked-back buddy can't move // tag ends when your buddy is tagged this many times
const FEET = SPRITE_Y + 16; // from a buddy's feet to the top of its picture

export function rng(seed) {
  let s = (seed >>> 0) || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, k) => a + (b - a) * k;

export function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}
export function cellsCanvas(cells) {
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
export function playLook(buddy, gear, kind) {
  const outfit = { ...(buddy?.outfit || {}) };
  delete outfit.sport;
  const version = (tier) => ['regular', 'good', 'super'][Math.max(0, Math.min(2, tier - 1))];
  if (kind === 'tag' && gear?.shoes) outfit.sport = `sport-shoes-${version(gear.shoes)}`;
  // hockey: everyone holds a stick (a borrowed regular one if they have none)
  if (kind === 'hockey') outfit.sport = `sport-hockey-${version(gear?.hockey || 1)}`;
  return { species: buddy?.species, outfit };
}

// ---------- a buddy on the field ----------
export class Player {
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
      this.camX = 0; this.level = 1; this.levelAt = 0; this.scroll = null;
      for (const p of [this.kid, this.vis]) { p.x = p.home[0]; p.y = p.home[1]; p.goTo(...p.home); }
      const b = this.bounds;
      // level 1: one obstacle, out of the way of where the buddies start
      this.obstacles = [];
      for (let i = 0; i < 20 && !this.obstacles.length; i += 1) {
        this.obstacles = levelObstacles(1, 0, this.W, b.y0, b.y1, this.r)
          .filter((o) => [this.kid, this.vis].every((p) => Math.hypot(o.x - p.x, o.y - p.y) > o.r + 16));
      }
      this.kid.speed = 60; this.vis.speed = 60;
    }
  }

  get bounds() { const c = this.camX || 0; return { x0: c + 12, x1: c + this.W - 12, y0: this.top + 22, y1: this.H - 4 }; }

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
    if (this.kind === 'soccer') this.tapSoccer(x, y); else this.tapTag(x + (this.camX || 0), y);
  }

  drag(x, y) {
    if (this.kind === 'tag' && this.phase === 'play') this.runTo(x + this.camX, y);
  }

  step(dt) {
    dt = Math.min(dt, 0.1);
    this.t += dt;
    if (this.kind === 'soccer') this.stepSoccer(dt); else this.stepTag(dt);
    for (const p of [this.kid, this.vis]) p.move(dt);
    if (this.kind === 'tag') this.bump();
    this.pops = this.pops.filter((p) => this.t - p.at < 1.1);
  }

  finish(score) {
    this.phase = 'over'; this.overAt = this.t; this.score = score;
    this.newBest = score > this.best;
    if (this.newBest) this.best = score;
  }

  // ---------- soccer ----------
  windows() { return kickWindows(this.count, this.tier); }

  /** Seconds the ball is in the air for a straight-up juggle: a little quicker as the count goes up. */
  beat() { return Math.max(0.62, 1.0 - this.count * 0.01); }

  /** When the ball next reaches a foot, and whose (for the preview script and tests). */
  next() { const b = this.ball; return b.state === 'air' ? { at: b.contact, to: b.to } : null; }

  tapSoccer(x, y) {
    const who = this.nearest(x, y);
    const b = this.ball;
    if (this.phase === 'ready') {
      if (this.locked) { this.pop('No more games today!', this.W / 2, this.top + 30, '#ffa8a8', true); return; }
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
    // each kick goes a little higher or lower than the last, so the timing changes
    let T = this.beat() * (pass ? 1.25 : 1) * (1 + (this.r() * 2 - 1) * heightSpread(this.count));
    const side = (this.r() < 0.5 ? -1 : 1) * (wild ? 64 : this.wob * 24 + (q === 'off' ? 6 : 0));
    T *= 1 - 0.3 * Math.min(1, this.wob);
    const bd = this.bounds;
    let tx = to.home[0] + side;
    let ty = to.home[1] + (this.r() - 0.5) * this.wob * 14;
    if (!wild) {
      if (tx < bd.x0 + 4 || tx > bd.x1 - 4) tx = to.home[0] - side;
      tx = clamp(tx, bd.x0 + 4, bd.x1 - 4); ty = clamp(ty, bd.y0 + 8, bd.y1 - 2);
    }
    // never higher than the top of the field, never so low it can't be read
    T = clamp(T, 0.42, Math.sqrt((8 * Math.max(20, ty - this.top)) / GRAV));
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
    this.kid.dest = [clamp(x, bd.x0, bd.x1), clamp(y + 8, bd.y0, bd.y1)];
    this.kid.goTo(...this.kid.dest);
    if (this.phase === 'play') this.steer(this.kid, ...this.kid.dest);
  }

  tapTag(x, y) {
    if (this.phase === 'ready') {
      const near = Math.hypot(this.vis.x - x, this.vis.y - 10 - y) < 18;
      if (!near) { this.runTo(x, y); return; }
      if (this.locked) { this.pop('No more games today!', this.camX + this.W / 2, this.top + 30, '#ffa8a8', true); return; }
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
    this.stepLevels(dt);
    k.speed = this.baseSpeed(k) * Math.max(0.5, 1 - 0.012 * age);
    if (age > 14) k.brain.set({ focus: 0.6 }); // tired: a drop of sweat
    const ready = this.t >= this.frozen;
    // the score drains at half speed while your buddy is IT
    if (this.it === 'kid') this.free = Math.max(0, this.free - dt * TAG_DRAIN);
    if (this.it === 'vis') {
      this.free += dt;
      v.speed = this.baseSpeed(v) * 0.68 * Math.max(0.6, 1 - 0.004 * age);
      if (ready) {
        // aims a little ahead of where the kid's buddy is going, with a wobble
        const lead = 0.15;
        this.steer(v, clamp(k.x + k.vx * lead + Math.sin(this.t * 1.7) * 4, bd.x0, bd.x1), clamp(k.y + k.vy * lead, bd.y0, bd.y1));
        if (Math.hypot(k.x - v.x, k.y - v.y) < TAG_REACH) {
          this.tags += 1;
          if (this.tags >= TAG_OUTS) {
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
      this.steer(v, clamp(v.x + (ax / n) * 24, bd.x0, bd.x1), clamp(v.y + (ay / n) * 24, bd.y0, bd.y1));
      if (ready && Math.hypot(k.x - v.x, k.y - v.y) < TAG_REACH) this.tagged(v);
    }
    if (!ready) (this.it === 'kid' ? k : v).goTo((this.it === 'kid' ? k : v).x, (this.it === 'kid' ? k : v).y);
    else if (k.dest) this.steer(k, ...k.dest);
    // knocked back by a moving obstacle: stopped for a moment
    for (const p of [k, v]) if (this.t < (p.stunned || 0)) p.goTo(p.x, p.y);
    k.lookAt = [v.x, v.y - 10]; v.lookAt = [k.x, k.y - 10];
  }

  /** Holds each level, then scrolls to the next one with more obstacles. */
  stepLevels(dt) {
    const b = this.bounds;
    if (this.scroll) {
      const u = Math.min(1, (this.t - this.scroll.t0) / LEVEL_SCROLL);
      const e = u < 0.5 ? 2 * u * u : 1 - Math.pow(-2 * u + 2, 2) / 2;
      const cam = lerp(this.scroll.from, this.scroll.to, e);
      const d = cam - this.camX;
      this.camX = cam;
      for (const p of [this.kid, this.vis]) { p.x += d; p.tx += d; if (p.dest) p.dest[0] += d; }
      if (u >= 1) {
        this.scroll = null; this.levelAt = this.t;
        this.obstacles = this.obstacles.filter((o) => o.x > this.camX - 20);
      }
    } else if (this.t - (this.levelAt || this.start) >= LEVEL_HOLD) {
      this.level += 1;
      const to = this.camX + this.W;
      this.obstacles.push(...levelObstacles(this.level, to, this.W, b.y0, b.y1, this.r));
      this.scroll = { from: this.camX, to, t0: this.t };
      this.pop(`Level ${this.level}! →`, this.camX + this.W / 2, this.top + 30, '#ffd43b', true);
    }
    // moving obstacles roll back and forth
    for (const o of this.obstacles) {
      if (!o.move) continue;
      const a = Math.sin(this.t * o.move.speed + o.move.phase);
      o.x = o.cx + o.move.dx * a; o.y = clamp(o.cy + o.move.dy * a, b.y0 + o.r, b.y1 - 2);
    }
  }

  /** Sends a buddy toward (tx, ty), around any obstacle in the way. */
  steer(p, tx, ty) {
    let gx = tx; let gy = ty;
    const dx = tx - p.x; const dy = ty - p.y; const len = Math.hypot(dx, dy);
    if (len > 1) {
      const ux = dx / len; const uy = dy / len;
      let worst = null;
      for (const o of this.obstacles || []) {
        const ox = o.x - p.x; const oy = o.y - p.y;
        const along = ox * ux + oy * uy;
        if (along < 0 || along > Math.min(len, 40)) continue;
        const side = ox * -uy + oy * ux;
        const need = o.r + 7;
        if (Math.abs(side) < need && (!worst || along < worst.along)) worst = { o, along, side, need };
      }
      if (worst) {
        // aim past the obstacle's edge, on the side we're already leaning to
        const turn = worst.side > 0 ? -1 : 1;
        gx = worst.o.x + -uy * turn * (worst.need + 3) + ux * 4;
        gy = worst.o.y + ux * turn * (worst.need + 3) + uy * 4;
      }
    }
    const b = this.bounds;
    p.goTo(clamp(gx, b.x0, b.x1), clamp(gy, b.y0, b.y1));
  }

  /** Buddies can't walk through obstacles, and the scrolling edge pushes them along. */
  bump() {
    const b = this.bounds;
    for (const p of [this.kid, this.vis]) {
      for (const o of this.obstacles || []) {
        const dx = p.x - o.x; const dy = (p.y - o.y) * 1.4; const d = Math.hypot(dx, dy) || 0.01;
        const need = o.r + 4;
        if (d >= need) continue;
        if (o.move && this.phase === 'play' && !(this.t < (p.stunned || 0))) {
          // a rolling barrel knocks you back and stops you for a moment
          const back = need + BONK_BACK;
          p.x = o.x + (dx / d) * back; p.y = o.y + (dy / d) * back / 1.4;
          p.stunned = this.t + BONK_STOP; p.goTo(p.x, p.y);
          p.brain.impulse('dizzy', 1);
          this.pop('Bonk!', p.x, p.y - 26, '#ffa8a8');
          this.sound = 'board';
        } else { p.x = o.x + (dx / d) * need; p.y = o.y + (dy / d) * need / 1.4; }
      }
      p.x = clamp(p.x, b.x0 - 4, b.x1 + 4); p.y = clamp(p.y, b.y0 - 2, b.y1 + 2);
    }
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
    if (this.kind !== 'tag') { x.fillRect(b.x0, b.y0, b.x1 - b.x0, 1); x.fillRect(b.x0, b.y1, b.x1 - b.x0 + 1, 1); } else x.fillRect(0, b.y1, this.W, 1);
    if (this.kind !== 'tag') { x.fillRect(b.x0, b.y0, 1, b.y1 - b.y0); x.fillRect(b.x1, b.y0, 1, b.y1 - b.y0); } else x.fillRect(0, b.y0, this.W, 1);
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
    const cam = Math.round(this.camX || 0);
    const off = ((cam % this.W) + this.W) % this.W;
    ctx.drawImage(this.field, -off, 0);
    if (off) ctx.drawImage(this.field, this.W - off, 0);
    ctx.save();
    ctx.translate(-cam, 0);
    const things = [this.kid, this.vis].map((p) => ({ y: p.y, draw: () => p.draw(ctx) }));
    for (const p of [this.kid, this.vis]) p.paint(this.t);
    if (this.kind === 'soccer') {
      const b = this.ball;
      // the timing ring, shrinking onto the landing spot
      if (b.state === 'air') {
        const left = b.contact - this.t;
        // the ring shows up a little later as the count goes up
        const lead = Math.max(0.5, 0.75 - this.count * 0.004);
        if (left < lead) {
          const rad = Math.max(2, 2 + 12 * Math.max(0, left) / lead);
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
    for (const o of this.obstacles || []) if (o.x > cam - 20 && o.x < cam + this.W + 20) things.push({ y: o.y, draw: () => this.drawObstacle(ctx, o) });
    things.sort((a, b) => a.y - b.y).forEach((th) => th.draw());
    ctx.restore();
  }

  drawObstacle(ctx, o) {
    const [base, light, dark] = OBSTACLE_PAL[o.kind];
    const x = Math.round(o.x); const y = Math.round(o.y); const r = o.r;
    const h = o.kind === 'rock' ? r : o.kind === 'barrel' ? r + 2 : r + 3; // how tall it stands
    ctx.fillStyle = 'rgba(20,40,20,0.28)';
    for (let i = -r; i <= r; i += 1) { const w = Math.round(Math.sqrt(r * r - i * i) * 0.4); ctx.fillRect(x + i, y - w + 1, 1, w * 2 || 1); }
    // a rounded lump, outlined, lit from the top left
    for (let yy = -h - r; yy <= 0; yy += 1) {
      for (let xx = -r; xx <= r; xx += 1) {
        const ny = (yy + h / 2 + r / 2) / ((h + r) / 2); const nx = xx / r;
        const d = nx * nx + ny * ny;
        if (d > 1) continue;
        let c = base;
        if (d > 0.78) c = '#1b1430';
        else if (nx < -0.2 && ny < -0.2) c = light;
        else if (nx > 0.35 || ny > 0.5) c = dark;
        if (o.kind === 'barrel' && Math.abs(ny) < 0.1 && d <= 0.78) c = '#495057';
        if (o.kind === 'hay' && d <= 0.78 && (yy + 64) % 3 === 0) c = dark;
        ctx.fillStyle = c; ctx.fillRect(x + xx, y + yy, 1, 1);
      }
    }
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
      if (this.best) text(`Best ${this.best}`, W / 2, u * 5.2, u * 1.6, '#e9ecef');
    } else {
      const free = this.phase === 'over' ? this.score : this.free;
      text(`${free.toFixed(1)} s`, W / 2, u * 2.6, u * 3.6, this.phase === 'play' && this.it === 'kid' ? '#ffa8a8' : '#ffd43b');
      if (this.best) text(`Best ${this.best.toFixed(1)} s`, W / 2, u * 5.2, u * 1.6, '#e9ecef');
      if (this.phase !== 'ready') { ctx.textAlign = 'left'; text(`Level ${this.level}`, u * 1.2, u * 5.2, u * 1.6, '#ffffff'); ctx.textAlign = 'center'; }
      if (this.phase === 'play') {
        const msg = this.it === 'vis' ? `${this.vis.name} is IT! Run!` : `You're IT! Tag ${this.vis.name}!`;
        text(msg, W / 2, (this.H - 5) * S, u * 1.6, this.it === 'vis' ? '#ffffff' : '#ffd43b');
        if (this.t < this.frozen) {
          const p = this.it === 'kid' ? this.kid : this.vis;
          text(String(Math.ceil(this.frozen - this.t)), (p.x - this.camX) * S, (p.y - 28) * S, u * 2.2, '#ffffff');
        }
      }
    }
    for (const p of this.pops) {
      const age = (this.t - p.at) / 1.1;
      ctx.globalAlpha = Math.min(1, (1 - age) * 3);
      text(p.text, (p.x - (this.camX || 0)) * S, (p.y - age * 10) * S, u * (p.big ? 2.2 : 1.7), p.color);
      ctx.globalAlpha = 1;
    }
    if (this.phase === 'ready') {
      const msg = this.locked ? "That's all our games today!" : this.kind === 'soccer' ? 'Tap a buddy to kick off!' : `Tap ${this.vis.name} to start tag!`;
      if (Math.floor(this.t * 2) % 3) text(msg, W / 2, (this.H - 5) * S, u * 1.8);
    }
    if (this.phase === 'over' && this.t - this.overAt > 0.3) {
      const cy = (this.top + 20) * S;
      ctx.fillStyle = 'rgba(27,20,48,0.82)';
      const bw = Math.min(W * 0.8, u * 34); const bh = u * 9.5;
      ctx.fillRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      ctx.strokeStyle = '#ffd43b'; ctx.lineWidth = S; ctx.strokeRect(W / 2 - bw / 2, cy - bh / 2, bw, bh);
      const line = this.kind === 'soccer' ? `${this.score} ${this.score === 1 ? 'kick' : 'kicks'}!` : `Free for ${this.score.toFixed(1)} s · level ${this.level}!`;
      text(line, W / 2, cy - u * 2.3, u * 2.6, '#ffd43b');
      text(this.newBest ? 'New best!' : `Best ${this.kind === 'soccer' ? this.best : `${this.best.toFixed(1)} s`}`, W / 2, cy + u * 0.4, u * 1.8, this.newBest ? '#b2f2bb' : '#e9ecef');
      if (this.t - this.overAt > 1.2) text('Tap to play again', W / 2, cy + u * 2.8, u * 1.5, '#ffffff');
    }
  }
}
