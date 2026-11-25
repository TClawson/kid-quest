// Tag's extras: power-ups, a twist for each map, and a personality for each
// visiting buddy (Taylor, 2026-11-16). play.js runs the chase; this file adds
// the fun on top.
//
// Power-ups: one at a time pops up somewhere on the field, stays 7 seconds and
// then goes. Whoever touches it first gets it, the visitor too, but a visitor
// only goes out of its way for its favorite kind, and only while it's running away.
//   speed mushroom: 45% faster for 4 seconds
//   snowflake: the other buddy freezes (2 seconds if you get it, 1.4 if the visitor does)
//   hiding bush: 5 seconds as a bush. A visitor chasing a hidden buddy loses it and
//     goes looking where it saw it last; a hidden visitor stands still among the
//     real bushes while you're not close (look for its blinking eyes).
//
// Map tricks (the kid's map, the Places background): mud in the Forest Village,
// waves at Sunset Beach, sea currents under the sea, low gravity on the moon, magic
// doors in the castle, lava vents on Volcano Island, ponds with springy lily pads in
// the rainforest, slippery ice in the fjord, rainbow speed strips in Rainbow Land, a
// gravity well in the Golden Galaxy. Each level that scrolls in brings new ones.
//
// Personalities follow the visiting buddy's kind, so a kid learns them:
//   sneaky (fox, panda): hides behind things when running away; when IT, creeps up, then pounces
//   speedy (puppy, bear, dino): faster than anyone, but runs out of puff and has to rest
//   dodger (cat, turtle, arctic fox): side-steps at the last moment, then needs 3 seconds before the next one
import { clamp } from './pixelkit.js';

const lerp = (a, b, k) => a + (b - a) * k;
const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

// ---------- personalities ----------
export const PERSONALITIES = {
  sneaky: { name: 'Sneaky', likes: 'bush', tip: (n) => `${n} is sneaky: hides behind things, then pounces!` },
  speedy: { name: 'Speedy', likes: 'mushroom', tip: (n) => `${n} is speedy, but runs out of puff!` },
  dodger: { name: 'Dodger', likes: 'snow', tip: (n) => `${n} is a dodger: side-steps at the last second!` },
};
const BY_SPECIES = { fox: 'sneaky', panda: 'sneaky', puppy: 'speedy', bear: 'speedy', dino: 'speedy', cat: 'dodger', turtle: 'dodger', arcticfox: 'dodger' };

/** A visiting buddy's personality, from its kind (or its name, for a kind with none). */
export function personalityFor(species, name = '') {
  if (BY_SPECIES[species]) return BY_SPECIES[species];
  let h = 7;
  for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return Object.keys(PERSONALITIES)[h % 3];
}

/** How long a personality's moves last and wait (seconds), and how much faster or slower it goes. */
export const SNEAKY = { creep: 0.8, near: 30, pounce: 1.7, pounceFor: 0.6, wait: 2.8, hideFrom: 22 };
export const SPEEDY = { fast: 1.28, tired: 0.55, rest: 2.5, drainFlee: 0.2, drainChase: 0.16 };
export const DODGER = { near: 16, odds: 0.7, wait: 3, miss: 1.2, step: 22 };

// ---------- power-ups ----------
export const POWERUPS = ['mushroom', 'snow', 'bush'];
export const POWER = { first: 2.5, gap: [5, 7], life: 7, zoom: 4, zoomBy: 1.45, freezeKid: 2, freezeVis: 1.4, hide: 5, reach: 8 };

// ---------- map tricks ----------
export const MAP_TRICKS = {
  'bg-meadow': { name: 'Mud puddles', tip: 'Mud puddles slow you down!', field: ['#5fbf5a', '#69c964', '#4fa84b'] },
  'bg-sunset': { name: 'Waves', tip: 'Waves wash in. Stay dry to run fast!', field: ['#f2d49b', '#ecca8a', '#d9b26f'] },
  'bg-ocean': { name: 'Sea currents', tip: 'Currents carry you along!', field: ['#4fb3c8', '#47a8bd', '#3c8fa3'] },
  'bg-space': { name: 'Low gravity', tip: 'Low gravity: floaty, bouncy running!', field: ['#9aa0ad', '#a3a9b5', '#7d8391'] },
  'bg-castle': { name: 'Magic doors', tip: 'Run into a magic door to pop out of its twin!', field: ['#b8b2a6', '#c2bcb0', '#8f897e'] },
  'bg-volcano': { name: 'Lava vents', tip: 'Lava vents glow, then blow. Keep clear!', field: ['#5a4a48', '#62514f', '#3e3230'] },
  'bg-rainforest': { name: 'Lily pads', tip: 'Ponds are slow, but lily pads bounce you across!', field: ['#3f9a4a', '#47a352', '#2f7d38'] },
  'bg-fjord': { name: 'Slippery ice', tip: 'Ice is slippery: you slide!', field: ['#e9f1f7', '#f1f6fa', '#c9d8e4'], line: '#9fb8cc' },
  'bg-rainbow': { name: 'Rainbow strips', tip: 'Rainbow strips make you zoom!', field: ['#c3f0ca', '#d7f5dc', '#a5e3b0'], stripes: ['#ffd6e0', '#ffe8cc', '#fff3bf', '#d3f9d8', '#d0ebff', '#e5dbff'] },
  'bg-galaxy': { name: 'Gravity well', tip: 'The gravity well pulls you in and flings you out!', field: ['#3b2a6b', '#43307a', '#ffd43b'], line: '#9775fa' },
};
export const trickFor = (map) => (MAP_TRICKS[map] ? map : 'bg-meadow');

/** How much faster or slower each patch of ground makes a buddy. */
export const GROUND = { mud: 0.55, pond: 0.5, ice: 1.15, rainbow: 1.7, wet: 0.6, space: 1.05 };
const GRIP = { ice: 1.6, space: 6 }; // how quickly a buddy can change direction (lower = slides more)
const VENT = { period: 5.5, warn: 3.5, blow: 4.7 }; // seconds: quiet, then glowing, then blowing
const WAVE = { every: 9, in: 1.2, stay: 1.4, out: 1.4, reach: 0.38 }; // reach: of the field's height
const WELL = { R: 44, pull: 34, fling: 34 };

const inside = (p, f) => ((p.x - f.x) / f.rx) ** 2 + ((p.y - f.y) / f.ry) ** 2 <= 1;

/**
 * The map's tricks for a level, in the strip x0..x0 + W (world pixels) between y0 and y1,
 * clear of `avoid` ([{ x, y, r }]: obstacles and where the buddies start).
 */
export function levelTricks(map, level, x0, W, y0, y1, r, avoid = []) {
  const id = trickFor(map);
  const out = [];
  const place = (rx, ry, pad = 6) => {
    for (let tries = 0; tries < 40; tries += 1) {
      const x = x0 + 24 + rx + r() * Math.max(1, W - 48 - 2 * rx);
      const y = y0 + ry + 4 + r() * Math.max(1, y1 - y0 - 2 * ry - 8);
      const clear = [...avoid, ...out].every((o) => {
        const orx = o.rx ?? o.r ?? 0; const ory = o.ry ?? o.r ?? 0;
        return Math.abs(o.x - x) > orx + rx + pad || Math.abs(o.y - y) > ory + ry + pad;
      });
      if (clear) return { x, y };
    }
    return null;
  };
  const add = (f, rx, ry, pad) => { const at = place(rx, ry, pad); if (at) out.push({ ...f, ...at, rx, ry }); return at; };
  const n = level >= 3 ? 3 : 2;
  if (id === 'bg-meadow') for (let i = 0; i < n; i += 1) add({ kind: 'mud' }, 13 + Math.floor(r() * 5), 6 + Math.floor(r() * 2));
  else if (id === 'bg-fjord') for (let i = 0; i < n; i += 1) add({ kind: 'ice' }, 20 + Math.floor(r() * 8), 9 + Math.floor(r() * 3));
  else if (id === 'bg-rainbow') for (let i = 0; i < n; i += 1) add({ kind: 'rainbow' }, 22 + Math.floor(r() * 6), 4);
  else if (id === 'bg-space') for (let i = 0; i < 4; i += 1) add({ kind: 'crater' }, 5 + Math.floor(r() * 4), 3, 2);
  else if (id === 'bg-rainforest') {
    for (let i = 0; i < 2; i += 1) {
      const at = add({ kind: 'pond' }, 20, 9);
      if (at) for (const s of [-1, 1]) out.push({ kind: 'pad', x: at.x + s * 9, y: at.y + (r() - 0.5) * 4, rx: 3, ry: 2 });
    }
  } else if (id === 'bg-volcano') {
    for (let i = 0; i < n; i += 1) add({ kind: 'vent', phase: r() * VENT.period }, 7, 4, 10);
  } else if (id === 'bg-galaxy') add({ kind: 'well' }, 9, 6, 14);
  else if (id === 'bg-castle') {
    // a pair of doors: one in the left part of the strip, one in the right
    const gem = ['#ff6b6b', '#4dabf7', '#ffd43b', '#b197fc'][level % 4];
    const a = place(5, 3, 10); const b0 = a && placeIn(x0 + W * 0.55, x0 + W - 24);
    function placeIn(lo, hi) {
      for (let tries = 0; tries < 40; tries += 1) {
        const x = lo + r() * (hi - lo); const y = y0 + 16 + r() * (y1 - y0 - 22);
        if ([...avoid].every((o) => Math.hypot(o.x - x, o.y - y) > (o.r ?? o.rx ?? 0) + 14)) return { x, y };
      }
      return null;
    }
    if (a && b0) {
      // keep the first door on the left half
      if (a.x > x0 + W * 0.45) a.x = x0 + 24 + r() * W * 0.2;
      const d1 = { kind: 'door', ...a, rx: 5, ry: 3, gem }; const d2 = { kind: 'door', ...b0, rx: 5, ry: 3, gem };
      d1.twin = d2; d2.twin = d1;
      out.push(d1, d2);
    }
  } else if (id === 'bg-ocean') {
    // two currents across the whole strip, going opposite ways
    const h = 10; const mid = (y0 + y1) / 2;
    const dir = r() < 0.5 ? 1 : -1;
    out.push({ kind: 'current', x: x0 + W / 2, y: Math.round(mid - 16), rx: W / 2, ry: h / 2, drift: 26 * dir });
    out.push({ kind: 'current', x: x0 + W / 2, y: Math.round(mid + 18), rx: W / 2, ry: h / 2, drift: -26 * dir });
  }
  return out;
}

/** A lava vent's state at time t: 'quiet', 'glow' or 'blow'. */
export function ventState(f, t) {
  const u = (((t + (f.phase || 0)) % VENT.period) + VENT.period) % VENT.period;
  return u < VENT.warn ? 'quiet' : u < VENT.blow ? 'glow' : 'blow';
}

/** How far up the field a Sunset Beach wave reaches at time t (0 to 1 of `reach`). */
export function waveAt(t) {
  const u = t % WAVE.every;
  if (u < WAVE.in) return u / WAVE.in;
  if (u < WAVE.in + WAVE.stay) return 1;
  if (u < WAVE.in + WAVE.stay + WAVE.out) return 1 - (u - WAVE.in - WAVE.stay) / WAVE.out;
  return 0;
}

// ---------- little pictures ----------
const ART = {
  mushroom: { rows: ['..RRR..', '.RWRRR.', 'RRRRWRR', 'RWRRRRR', 'KKSSSKK', '..SSS..', '..SsS..'], pal: { R: '#e03131', W: '#ffffff', S: '#fff4df', s: '#e8cfb4', K: '#1b1430' } },
  snow: { rows: ['...W...', '.W.B.W.', '..BWB..', 'WBWWWBW', '..BWB..', '.W.B.W.', '...W...'], pal: { W: '#ffffff', B: '#74c0fc' } },
  bush: { rows: ['..GLG...', '.GLLGG..', 'GLLGGDG.', 'GGGGDGG*', '.GDGGDG.', '..DDDD..'], pal: { G: '#2f9e44', L: '#69db7c', D: '#1b5e20', '*': '#fff3bf' } },
};
function cells(ctx, art, x, y) {
  art.rows.forEach((row, j) => {
    for (let i = 0; i < row.length; i += 1) {
      const c = art.pal[row[i]];
      if (!c) continue;
      ctx.fillStyle = c; ctx.fillRect(x + i, y + j, 1, 1);
    }
  });
}
function ellipse(ctx, cx, cy, rx, ry, color) {
  ctx.fillStyle = color;
  for (let yy = -Math.floor(ry); yy <= Math.floor(ry); yy += 1) {
    const w = Math.round(rx * Math.sqrt(Math.max(0, 1 - (yy / ry) ** 2)));
    if (w > 0) ctx.fillRect(Math.round(cx - w), Math.round(cy + yy), w * 2, 1);
  }
}

// ---------- the extras, for one game ----------
export class TagFun {
  /** game: the Play; map: the kid's Places background; personality: one of PERSONALITIES. */
  constructor(game, map, personality) {
    this.g = game;
    this.map = trickFor(map);
    this.trick = MAP_TRICKS[this.map];
    this.pers = PERSONALITIES[personality] ? personality : 'sneaky';
  }

  get tips() { return { who: PERSONALITIES[this.pers].tip(this.g.vis.name), map: this.trick.tip }; }

  reset() {
    const g = this.g; const b = g.bounds;
    const start = [g.kid, g.vis].map((p) => ({ x: p.x, y: p.y, r: 14 }));
    this.feats = levelTricks(this.map, 1, 0, g.W, b.y0, b.y1, g.r, [...(g.obstacles || []), ...start]);
    this.power = null; this.nextPower = null; this.lastKind = null;
    this.dodgeAt = 0; this.pounce = 0; this.pounceAt = 0; this.seen = null; this.puff = false;
    for (const p of [g.kid, g.vis]) Object.assign(p, { iced: 0, zoom: 0, hidden: 0, launch: null, lift: 0, grip: 0, port: 0, pad: 0, stamina: 1, tired: 0 });
  }

  /** A new level is scrolling in from the right: its own tricks come with it. */
  addLevel(level, x0) {
    const g = this.g; const b = g.bounds;
    this.feats.push(...levelTricks(this.map, level, x0, g.W, b.y0, b.y1, g.r, g.obstacles.filter((o) => o.x > x0 - 20)));
  }

  /** The level has scrolled by: forget what's gone off the left edge. */
  trim(camX) {
    this.feats = this.feats.filter((f) => f.x + f.rx > camX - 10);
    if (this.power && this.power.x < camX + 8) this.power = null;
  }

  // ---------- the visitor ----------
  /** Where a running-away visitor heads instead of `aim` ([x, y]), and how much faster or slower. */
  flee(aim, dt) {
    const g = this.g; const k = g.kid; const v = g.vis; const t = g.t;
    const dk = dist(k, v);
    let mul = 1;
    const fav = this.favorite();
    if (fav) aim = fav;
    if (this.pers === 'sneaky') {
      mul = 0.95;
      if (t < v.hidden && dk > 28) aim = [v.x, v.y]; // a bush among bushes: keep still
      else if (!fav && dk > SNEAKY.hideFrom) aim = this.hideSpot() || aim;
    } else if (this.pers === 'speedy') mul = this.puffing(dt, SPEEDY.drainFlee);
    else {
      mul = 0.93;
      this.dodge();
    }
    return { aim, mul };
  }

  /** Where a chasing visitor heads instead of `aim`, and how much faster or slower. */
  chase(aim, dt) {
    const g = this.g; const k = g.kid; const v = g.vis; const t = g.t;
    let mul = 1;
    // a hidden buddy is lost unless it's right there: go and look where it was last seen
    if (t < k.hidden && dist(k, v) > 16) {
      if (!this.seen) this.seen = [k.x, k.y];
      const [sx, sy] = this.seen;
      aim = Math.hypot(v.x - sx, v.y - sy) < 6 ? [sx + Math.cos(t * 1.3) * 20, sy + Math.sin(t * 1.9) * 10] : [sx, sy];
      mul = 0.8;
    } else this.seen = null;
    if (this.pers === 'sneaky') {
      const d = dist(k, v);
      if (t < this.pounce) mul *= SNEAKY.pounce;
      else if (d < SNEAKY.near && t >= this.pounceAt && !(t < k.hidden)) {
        this.pounce = t + SNEAKY.pounceFor; this.pounceAt = t + SNEAKY.wait;
        g.pop('Boo!', v.x, v.y - 26, '#ffa8a8');
        v.brain.impulse('giggle', 1);
        mul *= SNEAKY.pounce;
      } else mul *= SNEAKY.creep;
    } else if (this.pers === 'speedy') mul *= this.puffing(dt, SPEEDY.drainChase);
    else mul *= 1.05;
    return { aim, mul };
  }

  /** Speedy: fast while it has puff, slow while it gets it back. */
  puffing(dt, drain) {
    const g = this.g; const v = g.vis; const t = g.t;
    if (t < v.tired) return SPEEDY.tired;
    if (this.puff) { this.puff = false; g.pop('Ready!', v.x, v.y - 26, '#b2f2bb'); v.brain.set({ focus: 0 }); }
    if (v.run > 0.3) v.stamina -= dt * drain;
    if (v.stamina <= 0) {
      v.stamina = 1; v.tired = t + SPEEDY.rest; this.puff = true;
      g.pop('Huff puff!', v.x, v.y - 26, '#ffffff');
      v.brain.set({ focus: 0.8 });
      return SPEEDY.tired;
    }
    return SPEEDY.fast;
  }

  /** Dodger: a quick side-step when the kid's buddy gets close, then a rest before the next. */
  dodge() {
    const g = this.g; const k = g.kid; const v = g.vis; const t = g.t;
    if (t < this.dodgeAt || v.launch || t < v.iced || dist(k, v) > DODGER.near) return;
    if (g.r() > DODGER.odds) { this.dodgeAt = t + DODGER.miss; return; }
    this.dodgeAt = t + DODGER.wait;
    const b = g.bounds;
    const d = dist(k, v) || 1; const ux = (v.x - k.x) / d; const uy = (v.y - k.y) / d;
    // to the side with more room
    const sides = [1, -1].map((s) => [v.x - uy * s * DODGER.step + ux * 6, v.y + ux * s * DODGER.step * 0.7 + uy * 4]);
    const room = ([x, y]) => Math.min(x - b.x0, b.x1 - x, (y - b.y0) * 1.5, (b.y1 - y) * 1.5);
    const [x, y] = room(sides[0]) >= room(sides[1]) ? sides[0] : sides[1];
    this.jump(v, clamp(x, b.x0, b.x1), clamp(y, b.y0, b.y1), 0.28, 5);
    g.pop(g.r() < 0.5 ? 'Missed me!' : 'Nope!', v.x, v.y - 26, '#ffd43b');
    v.brain.impulse('giggle', 1);
    g.sound = 'squeak';
  }

  /** Sneaky: a spot behind an obstacle, away from the kid's buddy (null if none near). */
  hideSpot() {
    const g = this.g; const k = g.kid; const v = g.vis;
    let best = null;
    for (const o of g.obstacles || []) {
      if (o.move) continue;
      const d = Math.hypot(o.x - k.x, o.y - k.y) || 1;
      const hx = o.x + ((o.x - k.x) / d) * (o.r + 9); const hy = o.y + ((o.y - k.y) / d) * (o.r + 9) / 1.4;
      const b = g.bounds;
      if (hx < b.x0 + 4 || hx > b.x1 - 4 || hy < b.y0 || hy > b.y1) continue;
      const dv = Math.hypot(hx - v.x, hy - v.y);
      if (dv < 70 && Math.hypot(hx - k.x, hy - k.y) > d && (!best || dv < best.dv)) best = { dv, at: [hx, hy] };
    }
    return best?.at || null;
  }

  /** The visitor's favorite power-up, when it's near and closer to the visitor than to the kid. */
  favorite() {
    const g = this.g; const p = this.power;
    if (!p || p.kind !== PERSONALITIES[this.pers].likes) return null;
    const dv = dist(g.vis, p);
    return dv < 60 && dv < dist(g.kid, p) ? [p.x, p.y] : null;
  }

  /** Moves a buddy through the air to (x, y) over T seconds, h pixels up at the top. */
  jump(p, x, y, T, h) {
    p.launch = { fx: p.x, fy: p.y, tx: x, ty: y, t0: this.g.t, T, h };
  }

  // ---------- every frame ----------
  /** Before the buddies move: power-ups come and go, and the ground speeds them up or slows them down. */
  step() {
    const g = this.g; const t = g.t;
    if (g.phase === 'play') {
      if (this.nextPower == null) this.nextPower = t + POWER.first;
      if (this.power && t - this.power.at > POWER.life) { this.power = null; this.nextPower = t + this.gap(); }
      if (!this.power && t >= this.nextPower && !g.scroll) this.spawn();
    }
    for (const p of [g.kid, g.vis]) {
      let mul = 1; let grip = 0;
      if (t < p.zoom) mul *= POWER.zoomBy;
      if (t < p.hidden) mul *= 0.9;
      for (const f of this.feats) {
        if (f.kind === 'current' || !GROUND[f.kind] || !inside(p, f)) continue;
        mul *= GROUND[f.kind];
        if (GRIP[f.kind]) grip = GRIP[f.kind];
      }
      if (this.map === 'bg-sunset' && this.wet(p)) mul *= GROUND.wet;
      if (this.map === 'bg-space') { mul *= GROUND.space; grip = GRIP.space; }
      p.speed *= mul;
      p.grip = grip;
      if (t < p.iced || p.launch) { p.goTo(p.x, p.y); p.grip = 0; }
    }
  }

  gap() { return POWER.gap[0] + this.g.r() * (POWER.gap[1] - POWER.gap[0]); }

  spawn() {
    const g = this.g; const b = g.bounds;
    const kinds = POWERUPS.filter((k) => k !== this.lastKind);
    const kind = kinds[Math.floor(g.r() * kinds.length)];
    for (let tries = 0; tries < 30; tries += 1) {
      const x = b.x0 + 14 + g.r() * (b.x1 - b.x0 - 28); const y = b.y0 + 8 + g.r() * (b.y1 - b.y0 - 12);
      const at = { x, y };
      if ([g.kid, g.vis].some((p) => dist(p, at) < 35)) continue;
      if ((g.obstacles || []).some((o) => Math.hypot(o.x - x, o.y - y) < o.r + 8)) continue;
      if (this.feats.some((f) => f.kind !== 'current' && inside(at, { ...f, rx: f.rx + 4, ry: f.ry + 4 }))) continue;
      this.power = { kind, x, y, at: g.t };
      this.lastKind = kind;
      return;
    }
    this.nextPower = g.t + 1;
  }

  wet(p) {
    const b = this.g.bounds;
    return p.y > b.y1 - waveAt(this.g.t) * WAVE.reach * (b.y1 - b.y0);
  }

  /** After the buddies move: jumps, pushes, doors, lava and picking up power-ups. */
  after(dt) {
    const g = this.g; const t = g.t; const b = g.bounds;
    const playing = g.phase === 'play';
    for (const p of [g.kid, g.vis]) {
      if (p.launch) {
        const L = p.launch; const s = Math.min(1, (t - L.t0) / L.T);
        p.x = lerp(L.fx, L.tx, s); p.y = lerp(L.fy, L.ty, s);
        p.lift = Math.round(L.h * 4 * s * (1 - s));
        p.face = L.tx >= L.fx ? 1 : -1; p.run = 1; p.stride += dt * 10;
        if (s >= 1) { p.launch = null; p.lift = 0; p.goTo(p.x, p.y); }
        continue;
      }
      p.lift = this.map === 'bg-space' && p.run > 0.05 ? Math.round(Math.abs(Math.sin(p.stride * 0.5)) * 4) : 0;
      if (this.map === 'bg-sunset' && this.wet(p)) { p.y -= 10 * dt; }
      for (const f of this.feats) {
        if (f.kind === 'current' && Math.abs(p.y - f.y) <= f.ry && t >= p.iced) {
          const idle = Math.hypot(p.tx - p.x, p.ty - p.y) < 2;
          p.x += f.drift * dt;
          if (idle) p.tx += f.drift * dt;
        } else if (f.kind === 'pad' && t >= p.pad && Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) < 5) {
          // boing: a hop the way the buddy is going (or toward where it's headed)
          let dx = p.vx; let dy = p.vy;
          if (Math.hypot(dx, dy) < 5) { dx = p.tx - p.x; dy = p.ty - p.y; }
          if (Math.hypot(dx, dy) < 1) dx = p.face;
          const n = Math.hypot(dx, dy);
          this.jump(p, clamp(p.x + (dx / n) * 30, b.x0, b.x1), clamp(p.y + (dy / n) * 30, b.y0, b.y1), 0.45, 10);
          p.pad = t + 0.8;
          g.pop('Boing!', p.x, p.y - 26, '#b2f2bb');
          g.sound = 'plop';
        } else if (f.kind === 'door' && t >= p.port && Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) < 6) {
          const twin = f.twin;
          if (!twin) continue;
          // out the other door, a step in front of it
          const away = twin.x < (b.x0 + b.x1) / 2 ? 1 : -1;
          p.x = clamp(twin.x + away * 8, b.x0, b.x1); p.y = twin.y + 2; p.goTo(p.x, p.y);
          if (p.dest) p.dest = null;
          p.port = t + 1.5;
          g.pop('Whoosh!', p.x, p.y - 26, f.gem);
          g.sound = 'spout';
          break;
        } else if (f.kind === 'well') {
          const dx = f.x - p.x; const dy = f.y - p.y; const d = Math.hypot(dx, dy);
          if (d < 5 && t >= p.pad) {
            // flung out the other side, somewhere random
            const a = g.r() * Math.PI * 2;
            this.jump(p, clamp(f.x + Math.cos(a) * WELL.fling, b.x0, b.x1), clamp(f.y + Math.sin(a) * WELL.fling * 0.6, b.y0, b.y1), 0.5, 12);
            p.pad = t + 1.2;
            g.pop('Whee!', p.x, p.y - 26, '#d0bfff');
            g.sound = 'spout';
          } else if (d < WELL.R && d > 0) {
            const pull = WELL.pull * (1 - d / WELL.R) + 6;
            p.x += (dx / d) * pull * dt; p.y += (dy / d) * pull * dt;
          }
        } else if (f.kind === 'vent' && playing && ventState(f, t) === 'blow' && !(t < (p.stunned || 0)) && Math.hypot(p.x - f.x, (p.y - f.y) * 1.4) < f.rx + 4) {
          const dx = p.x - f.x; const dy = p.y - f.y; const d = Math.hypot(dx, dy) || 1;
          p.x = clamp(f.x + (dx / d) * (f.rx + 14), b.x0, b.x1); p.y = clamp(f.y + (dy / d) * (f.rx + 14) / 1.4, b.y0, b.y1);
          p.stunned = t + 0.5; p.goTo(p.x, p.y);
          p.brain.impulse('dizzy', 1);
          g.pop('Hot!', p.x, p.y - 26, '#ff922b');
          g.sound = 'board';
        }
      }
      p.x = clamp(p.x, b.x0 - 4, b.x1 + 4); p.y = clamp(p.y, b.y0 - 2, b.y1 + 2);
    }
    // picking up the power-up
    const pw = this.power;
    if (playing && pw) {
      const who = [g.kid, g.vis].find((p) => !p.launch && dist(p, pw) < POWER.reach);
      if (who) this.grab(who, pw.kind);
    }
  }

  grab(p, kind) {
    const g = this.g; const t = g.t; const o = g.other(p);
    this.power = null; this.nextPower = t + this.gap();
    const mine = p === g.kid;
    if (kind === 'mushroom') { p.zoom = t + POWER.zoom; g.pop('Zoom!', p.x, p.y - 26, '#ffd43b', true); p.brain.impulse('cheer', 1); }
    else if (kind === 'snow') {
      o.iced = t + (mine ? POWER.freezeKid : POWER.freezeVis);
      g.pop('Freeze!', o.x, o.y - 26, '#a5d8ff', true); o.brain.impulse('surprise', 1);
    } else { p.hidden = t + POWER.hide; g.pop(mine ? 'Hide!' : 'Where did it go?', p.x, p.y - 26, '#b2f2bb', true); }
    g.sound = 'plop';
  }

  // ---------- drawing ----------
  /** The ground tricks, under everything (camera already applied). */
  drawUnder(ctx) {
    const t = this.g.t; const b = this.g.bounds;
    for (const f of this.feats) {
      const x = Math.round(f.x); const y = Math.round(f.y);
      if (f.kind === 'mud') {
        ellipse(ctx, x, y, f.rx, f.ry, '#5c3d22'); ellipse(ctx, x, y, f.rx - 1, f.ry - 1, '#7a5230');
        ctx.fillStyle = '#9c6b40'; ctx.fillRect(x - 5, y - 2, 3, 1); ctx.fillRect(x + 4, y + 1, 2, 1);
      } else if (f.kind === 'pond') {
        ellipse(ctx, x, y, f.rx, f.ry, '#2679c9'); ellipse(ctx, x, y, f.rx - 1, f.ry - 1, '#3d9be9');
        ctx.fillStyle = '#a5d8ff'; const s = Math.floor(t * 2) % 2; ctx.fillRect(x - 12 + s, y - 4, 3, 1); ctx.fillRect(x + 10 - s, y + 4, 3, 1);
      } else if (f.kind === 'pad') {
        ellipse(ctx, x, y, 3.5, 2.2, '#2b8a3e'); ellipse(ctx, x, y - 0.5, 3, 1.8, '#51cf66');
        ctx.fillStyle = '#3d9be9'; ctx.fillRect(x + 1, y - 1, 2, 1);
      } else if (f.kind === 'ice') {
        ellipse(ctx, x, y, f.rx, f.ry, '#8cc4e0'); ellipse(ctx, x, y, f.rx - 1, f.ry - 1, '#cfeefc');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x - Math.round(f.rx / 2), y - 3, 5, 1); ctx.fillRect(x - Math.round(f.rx / 2) + 1, y - 2, 2, 1); ctx.fillRect(x + 6, y + 2, 4, 1);
        if (Math.floor(t * 3 + f.x) % 5 === 0) ctx.fillRect(x + 3, y - 4, 1, 1);
      } else if (f.kind === 'rainbow') {
        const cols = ['#ff6b6b', '#ff922b', '#ffd43b', '#51cf66', '#4dabf7', '#9775fa'];
        const h = f.ry * 2; const shift = Math.floor(t * 8);
        for (let i = 0; i < h; i += 1) {
          const w = Math.round(f.rx * (1 - Math.abs((i - h / 2 + 0.5) / (h / 2)) * 0.15));
          ctx.fillStyle = cols[Math.floor((i * cols.length) / h)]; ctx.fillRect(x - w, y - f.ry + i, w * 2, 1);
        }
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 4; i += 1) ctx.fillRect(x - f.rx + ((shift + i * 13) % (f.rx * 2)), y - 1, 2, 1);
      } else if (f.kind === 'current') {
        ctx.fillStyle = 'rgba(165,216,255,0.22)'; ctx.fillRect(Math.round(f.x - f.rx), y - f.ry, Math.round(f.rx * 2), f.ry * 2);
        ctx.fillStyle = 'rgba(255,255,255,0.55)';
        const step = 18; const off = (((t * f.drift) % step) + step) % step;
        for (let xx = f.x - f.rx + off; xx < f.x + f.rx; xx += step) {
          const yy = y + (Math.floor(xx / step) % 2 ? -2 : 2);
          ctx.fillRect(Math.round(xx), yy, 4, 1);
          ctx.fillRect(Math.round(xx) + (f.drift > 0 ? 3 : 0), yy - 1, 1, 3);
        }
      } else if (f.kind === 'crater') {
        ellipse(ctx, x, y, f.rx, f.ry, '#c1c6cf'); ellipse(ctx, x, y + 0.5, f.rx - 1, f.ry - 1, '#6d7380');
      } else if (f.kind === 'vent') {
        const st = ventState(f, t);
        ellipse(ctx, x, y, f.rx, f.ry, '#2b1d1b');
        const glow = st === 'quiet' ? '#a63e1a' : st === 'glow' ? (Math.floor(t * 8) % 2 ? '#ff922b' : '#ffd43b') : '#fff3bf';
        ctx.fillStyle = glow;
        ctx.fillRect(x - 4, y, 3, 1); ctx.fillRect(x - 1, y - 1, 2, 1); ctx.fillRect(x + 1, y, 3, 1); ctx.fillRect(x - 2, y + 1, 2, 1);
        if (st === 'glow') {
          ctx.fillStyle = 'rgba(255,146,43,0.35)'; ellipse(ctx, x, y, f.rx + 3, f.ry + 2, 'rgba(255,146,43,0.3)');
        }
      } else if (f.kind === 'well') {
        ctx.fillStyle = 'rgba(151,117,250,0.18)'; ellipse(ctx, x, y, WELL.R * 0.6, WELL.R * 0.32, 'rgba(151,117,250,0.15)');
        ellipse(ctx, x, y, 4, 3, '#1b1430');
        for (let i = 0; i < 24; i += 1) {
          const a = t * 3 + i * 0.5; const rr = 3 + i * 0.45;
          ctx.fillStyle = i % 3 ? '#b197fc' : '#ffffff';
          ctx.fillRect(Math.round(x + Math.cos(a) * rr), Math.round(y + Math.sin(a) * rr * 0.55), 1, 1);
        }
      } else if (f.kind === 'door') {
        // the doorstep on the ground (the door itself stands up: see things)
        ellipse(ctx, x, y + 1, 6, 2, '#6c5f50');
      }
    }
    if (this.map === 'bg-sunset') {
      const top = b.y1 - waveAt(t) * WAVE.reach * (b.y1 - b.y0);
      if (top < b.y1 + 1) {
        const x0 = Math.floor(b.x0 - 12); const w = Math.ceil(b.x1 - b.x0 + 24);
        ctx.fillStyle = 'rgba(77,171,247,0.5)'; ctx.fillRect(x0, Math.round(top), w, Math.ceil(b.y1 + 4 - top));
        ctx.fillStyle = '#ffffff';
        for (let xx = 0; xx < w; xx += 1) if ((xx + Math.floor(t * 6)) % 7 < 4) ctx.fillRect(x0 + xx, Math.round(top + Math.sin((xx + t * 20) / 4)), 1, 1);
      }
    }
  }

  /** Things that stand up (power-up, doors, lava), to sort with the buddies by how far down they are. */
  things(ctx) {
    const t = this.g.t; const out = [];
    const pw = this.power;
    if (pw) {
      const left = POWER.life - (t - pw.at);
      if (left > 2 || Math.floor(t * 6) % 2) {
        out.push({ y: pw.y, draw: () => {
          const bob = Math.round(Math.sin(t * 5) * 1);
          ctx.fillStyle = 'rgba(20,40,20,0.28)'; ctx.fillRect(Math.round(pw.x) - 3, Math.round(pw.y), 7, 1);
          cells(ctx, ART[pw.kind], Math.round(pw.x) - 3, Math.round(pw.y) - 9 + bob);
          if (Math.floor(t * 4) % 3 === 0) { ctx.fillStyle = '#ffffff'; ctx.fillRect(Math.round(pw.x) + 4, Math.round(pw.y) - 10 + bob, 1, 1); }
        } });
      }
    }
    for (const f of this.feats) {
      const x = Math.round(f.x); const y = Math.round(f.y);
      if (f.kind === 'door') {
        out.push({ y: f.y - 1, draw: () => {
          // a little stone arch with a dark, swirly doorway and a gem on top
          ctx.fillStyle = '#495057'; ctx.fillRect(x - 5, y - 13, 10, 13); ctx.fillRect(x - 4, y - 14, 8, 1);
          ctx.fillStyle = '#ced4da'; ctx.fillRect(x - 4, y - 12, 8, 12); ctx.fillRect(x - 3, y - 13, 6, 1);
          ctx.fillStyle = '#1b1430'; ctx.fillRect(x - 3, y - 9, 6, 9); ctx.fillRect(x - 2, y - 10, 4, 1);
          ctx.fillStyle = f.gem; ctx.fillRect(x - 1, y - 13, 2, 2);
          const s = Math.floor(t * 6);
          for (let i = 0; i < 3; i += 1) ctx.fillRect(x - 2 + ((s + i * 2) % 4), y - 8 + ((s + i * 3) % 7), 1, 1);
        } });
      } else if (f.kind === 'vent' && ventState(f, t) === 'blow') {
        out.push({ y: f.y + 0.5, draw: () => {
          const cols = ['#fff3bf', '#ffd43b', '#ff922b', '#e03131'];
          for (let h = 0; h < 20; h += 1) {
            const w = Math.max(1, Math.round(5 - h * 0.18 + Math.sin(t * 30 + h) * 1.2));
            ctx.fillStyle = cols[Math.min(3, Math.floor(h / 5 + ((t * 20 + h) % 2)))];
            ctx.fillRect(x - w + Math.round(Math.sin(t * 25 + h * 0.7)), y - h, w * 2, 1);
          }
        } });
      } else if (f.kind === 'vent' && ventState(f, t) === 'glow') {
        out.push({ y: f.y, draw: () => {
          ctx.fillStyle = '#868e96';
          for (let i = 0; i < 3; i += 1) { const u = ((t * 1.5 + i / 3) % 1); ctx.fillRect(x - 2 + i * 2 + Math.round(Math.sin(u * 6) * 1), Math.round(y - 3 - u * 12), 2, 2); }
        } });
      }
    }
    return out;
  }

  /** A buddy, with its power-up showing: a bush with eyes, an ice block, or zoom sparkles. */
  drawPlayer(ctx, p) {
    const t = this.g.t; const x = Math.round(p.x); const y = Math.round(p.y);
    if (t < p.hidden) {
      // the visitor's eyes blink now and then; yours always show, so you can find yourself
      const eyes = p === this.g.kid || Math.floor(t * 2) % 3 === 0;
      const rad = 7;
      ctx.fillStyle = 'rgba(20,40,20,0.28)'; ctx.fillRect(x - 6, y, 12, 1);
      const yy = y - p.lift;
      for (let j = -rad - 3; j <= 0; j += 1) {
        for (let i = -rad; i <= rad; i += 1) {
          const ny = (j + 5) / 6; const nx = i / rad; const d = nx * nx + ny * ny;
          if (d > 1) continue;
          ctx.fillStyle = d > 0.78 ? '#1b1430' : nx < -0.2 && ny < -0.2 ? '#51cf66' : nx > 0.35 || ny > 0.5 ? '#1b5e20' : '#2f9e44';
          ctx.fillRect(x + i, yy + j, 1, 1);
        }
      }
      if (eyes) { ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 3, yy - 6, 2, 2); ctx.fillRect(x + 1, yy - 6, 2, 2); ctx.fillStyle = '#1b1430'; ctx.fillRect(x - 2 + (p.face > 0 ? 0 : -1), yy - 5, 1, 1); ctx.fillRect(x + 2 + (p.face > 0 ? 0 : -1), yy - 5, 1, 1); }
      // your bush wears a little arrow so you know it's you
      if (p === this.g.kid) { ctx.fillStyle = '#ffd43b'; ctx.fillRect(x - 1, yy - 15, 3, 1); ctx.fillRect(x, yy - 14, 1, 1); }
      return;
    }
    if (t < p.zoom) {
      ctx.fillStyle = Math.floor(t * 10) % 2 ? '#ffd43b' : '#fff3bf';
      for (let i = 0; i < 3; i += 1) ctx.fillRect(x - p.face * (7 + i * 3), y - 3 - ((Math.floor(t * 12) + i) % 3) * 3, 1, 1);
    }
    p.draw(ctx);
    if (t < p.iced) {
      const top = y - 24 - p.lift;
      ctx.fillStyle = 'rgba(165,216,255,0.5)'; ctx.fillRect(x - 8, top, 16, 25);
      ctx.fillStyle = '#e7f5ff';
      ctx.fillRect(x - 8, top, 16, 1); ctx.fillRect(x - 8, top, 1, 25); ctx.fillRect(x + 7, top, 1, 25); ctx.fillRect(x - 8, top + 24, 16, 1);
      ctx.fillRect(x - 6, top + 3, 2, 1); ctx.fillRect(x - 6, top + 4, 1, 3); ctx.fillRect(x + 4, top + 18, 2, 1);
    }
  }
}
