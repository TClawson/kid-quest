// The secret shows: when a kid finishes a map's treasure map, a landmark appears on that map.
// Tapping it plays a big show of about 8 seconds across the part of the map the kid is
// looking at, with the kid's buddy joining in. Drawn on a canvas over the map at the map's
// pixel size, like the moving things in maplife.js. Music and sounds: SHOW_SONGS in songs.js
// and playShowAudio in music.js (the times in each show's sfx line up with what it draws).

import { DRAGON, DRAGON_ROAR, WING_UP, WING_DOWN, KNIGHT, UNICORN_RUN, TIKI, draw, puff } from './maplife.js';
import { outlined, SHIP, WHALE, CHEST_CLOSED, CHEST_PALS } from './treasure-art.js';

const OUT = '#2a1838';
const FPS = 20;
const rand = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const ease = (x) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
/** 0 to 1 as t goes from a to b. */
const span = (t, a, b) => ease((t - a) / (b - a));

// ---------- sprites, drawn big ----------

const scaled = new Map();
/** A sprite drawn onto its own canvas at `scale` map pixels per art pixel (cached). */
function big(key, rows, pal, scale = 2, flip = false) {
  const k = `${key}|${scale}|${flip}`;
  if (scaled.has(k)) return scaled.get(k);
  const w = Math.max(...rows.map((r) => r.length));
  const c = document.createElement('canvas');
  c.width = w * scale;
  c.height = rows.length * scale;
  const x = c.getContext('2d');
  x.scale(scale, scale);
  draw(x, 0, 0, rows.map((r) => r.padEnd(w, '.')), pal, flip);
  scaled.set(k, c);
  return c;
}
const blit = (ctx, img, x, y) => ctx.drawImage(img, Math.round(x), Math.round(y));

const OWL_UP = outlined([
  'w.........w',
  'ww..o.o..ww',
  'www.OOO.www',
  '.wwOYOYOww.',
  '..wOKnKOw..',
  '...OOOOO...',
  '...OwwwO...',
  '....OOO....',
  '....h.h....',
]);
const OWL_DOWN = outlined([
  '....o.o....',
  '....OOO....',
  '...OYOYO...',
  '..wOKnKOw..',
  '.wwOOOOOww.',
  'wwwOwwwOwww',
  'ww..OOO..ww',
  'w...h.h...w',
]);
const OWL_PAL = { O: '#c98a4b', o: '#8a5226', w: '#a0612f', Y: '#ffe066', n: '#fcc419', h: '#fcc419' };

const PARROT = [outlined([
  'BB...RRR..',
  '.BB.RRKRy.',
  '..BBRRRRyy',
  '...BRRRR..',
  '....GGRR..',
  '....GGG...',
  '.....GG...',
]), outlined([
  '.....RRR..',
  '....RRKRy.',
  '..BBRRRRyy',
  '.BBBRRRR..',
  'BBB.GGRR..',
  '....GGG...',
  '.....GG...',
])];
const PARROT_PAL = { R: '#e03131', B: '#4dabf7', G: '#40c057', y: '#ffd43b' };

const PHOENIX = [outlined([
  'F.........F',
  'FF.......FF',
  'FfF..Y..FfF',
  '.FfFYYYFfF.',
  '..FFYeYFF..',
  '...FYYYF...',
  '....YYY....',
  '...fYrYf...',
  '..f.rrr.f..',
  '....r.r....',
]), outlined([
  '.....Y.....',
  '....YYY....',
  '...FYeYF...',
  '.FFfYYYfFF.',
  'FfFFYYYFFfF',
  'F...YYY...F',
  '...fYrYf...',
  '..f.rrr.f..',
  '....r.r....',
])];
const PHOENIX_PAL = { F: '#ff922b', f: '#ffd43b', Y: '#ffe066', e: '#c92a2a', r: '#e03131' };

const OCTO = outlined(['..PPPP..', '.PPPPPP.', 'PWKPPWKP', 'PPPPPPPP', '.PPPPPP.', 'P.P.P.P.', '.P.P.P.P']);
const OCTO_PAL = { P: '#b197fc', W: '#ffffff' };
const GHOST_PAL = { M: '#63e6be', F: '#c3fae8', H: '#20c997', h: '#087f5b', w: '#e6fcf5' };
const GOLD_DRAGON = { G: '#fcc419', L: '#ffe066', D: '#e67700', Y: '#fff3bf', y: '#ffd43b', h: '#ffffff', s: '#e03131', e: '#e03131', t: '#ffffff', n: OUT, r: '#c92a2a', w: '#ffe066' };
const DRAGON_PAL = { G: '#2f9e44', L: '#8ce99a', D: '#237032', Y: '#ffd43b', y: '#f59f00', h: '#fff3bf', s: '#ff922b', e: '#ffe066', t: '#ffffff', n: OUT, r: '#c92a2a', w: '#ffa94d' };
const KNIGHT_PAL = { p: '#e03131', S: '#f8f9fa', s: '#ced4da', a: '#868e96', b: '#4c6ef5', c: '#ffd43b', Q: '#364fc7', R: '#c92a2a', W: '#ffffff', w: '#ced4da', m: '#a0612f', n: '#868e96', h: '#495057', g: '#ffd43b', y: '#ffd43b' };
const TIKI_PAL = { M: '#d9480f', m: '#a0612f', e: '#ffd43b', t: '#ffffff', g: '#40c057', y: '#ffd43b', r: '#e03131', b: '#a0612f', G: '#82c91e' };
const WHALE_PAL = { B: '#5c7cfa', s: '#fff3bf', w: '#d0bfff', m: '#3b5bdb', T: '#4c6ef5', E: '#1a1028', y: '#ffe066', '-': '#364fc7' };
const CHEST = outlined(CHEST_CLOSED);
const RAINBOW = ['#e03131', '#ff922b', '#ffd43b', '#51cf66', '#339af0', '#5c7cfa', '#cc5de8'];
const FIREWORK = [['#ff6b6b', '#ffe066'], ['#74c0fc', '#ffffff'], ['#b2f2bb', '#ffe066'], ['#f783ac', '#ffffff'], ['#ffd43b', '#ff922b'], ['#d0bfff', '#ffffff']];

// ---------- particles ----------

class Parts {
  constructor() { this.list = []; }
  add(p) { this.list.push({ vx: 0, vy: 0, g: 0, drag: 1, life: 0, max: 30, size: 1, ...p }); }
  step() {
    for (const p of this.list) {
      p.fx?.(p);
      p.vx *= p.drag;
      p.vy = p.vy * p.drag + p.g;
      p.x += p.vx;
      p.y += p.vy;
      p.life += 1;
    }
    this.list = this.list.filter((p) => p.life < p.max);
  }
  draw(ctx) {
    for (const p of this.list) {
      const c = typeof p.c === 'function' ? p.c(p) : p.c;
      const x = Math.round(p.x);
      const y = Math.round(p.y);
      if (p.glow) {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = p.glow;
        ctx.fillRect(x - 1, y - 1, 3, 3);
        ctx.globalAlpha = 1;
      }
      if (p.ring) {
        ctx.fillStyle = c;
        const r = p.size;
        ctx.fillRect(x - r, y, 1, 1); ctx.fillRect(x + r, y, 1, 1); ctx.fillRect(x, y - r, 1, 1); ctx.fillRect(x, y + r, 1, 1);
        continue;
      }
      if (p.star) {
        ctx.fillStyle = c;
        ctx.fillRect(x - 1, y, 3, 1);
        ctx.fillRect(x, y - 1, 1, 3);
        continue;
      }
      ctx.fillStyle = c;
      ctx.fillRect(x, y, p.size, p.size);
    }
  }
}

/** A firework: a ring of sparks that fall and fade. */
function burst(S, x, y, n = 48, colors = pick(FIREWORK), speed = 2.6) {
  for (let i = 0; i < n; i += 1) {
    const a = (i / n) * Math.PI * 2 + rand(-0.1, 0.1);
    const v = speed * rand(0.6, 1.1);
    S.parts.add({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, g: 0.05, drag: 0.93, max: Math.floor(rand(22, 36)), size: i % 3 ? 1 : 2, c: (p) => (p.life % 4 < 2 ? colors[0] : colors[1]) });
  }
  for (let i = 0; i < 6; i += 1) {
    S.parts.add({ x, y, vx: rand(-0.6, 0.6), vy: rand(-0.6, 0.6), max: 14, star: true, c: '#ffffff' });
  }
}

/** Something that flies from a to b in `dur` seconds along an arc, and bursts at the end. */
function shell(S, t0, from, to, dur = 0.7, then = burst) {
  S.shells.push({ t0, from, to, dur, then, done: false });
}
function stepShells(ctx, t, S, color = '#ffe066') {
  for (const sh of S.shells) {
    if (sh.done || t < sh.t0) continue;
    const u = (t - sh.t0) / sh.dur;
    if (u >= 1) { sh.done = true; sh.then(S, sh.to.x, sh.to.y); continue; }
    const x = sh.from.x + (sh.to.x - sh.from.x) * u;
    const y = sh.from.y + (sh.to.y - sh.from.y) * u - Math.sin(u * Math.PI) * 18;
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
    S.parts.add({ x, y, max: 6, c: '#ffffff' });
  }
}

/** The kid's buddy, drawn from its picture (S.buddy is an Image, or null). */
function buddyAt(ctx, S, x, y, size = 20) {
  if (S.buddy?.complete && S.buddy.naturalWidth) ctx.drawImage(S.buddy, Math.round(x), Math.round(y), size, size);
}

// ---------- the shows, one per map ----------
// Each: dur (seconds), quake: [[from, to]] seconds the map shakes, sfx: [[seconds, kind]],
// init(S, V), step(ctx, t, V, S, frame). V is what the kid can see, in map pixels:
// { aw, top, bottom, h, mid, cx, spot: the landmark's center (or the bottom of the view) }.

export const SHOWS = {
  'bg-meadow': {
    dur: 8,
    quake: [[0, 0.8]],
    sfx: [[0, 'rumble'], [0.3, 'hoot'], [1, 'sparkle'], [2, 'whoosh'], [3, 'sparkle'], [4.5, 'hoot'], [6, 'sparkle']],
    step(ctx, t, V, S, frame) {
      // fireflies pour out of the oak and swirl up the map
      if (t > 0.8 && t < 5.5) {
        for (let i = 0; i < 6; i += 1) {
          S.parts.add({
            x: V.spot.x + rand(-6, 6), y: V.spot.y + rand(-4, 4), vx: rand(-1, 1), vy: rand(-2.6, -0.8), max: Math.floor(rand(50, 90)),
            ph: rand(0, 6), fx: (p) => { p.vx = Math.sin(p.life * 0.15 + p.ph) * 1.3; }, glow: '#d8f5a2',
            c: (p) => ((p.life + Math.floor(p.ph * 3)) % 10 < 7 ? '#ffe066' : '#d8f5a2'),
          });
        }
      }
      // the owl swoops across with the buddy hanging on
      if (t > 2 && t < 7.5) {
        const u = (t - 2) / 5.5;
        const x = -20 + u * (V.aw + 40);
        const y = V.top + V.h * 0.3 + Math.sin(u * Math.PI * 3) * V.h * 0.12;
        const owl = big(`owl${frame % 4 < 2}`, frame % 4 < 2 ? OWL_UP : OWL_DOWN, OWL_PAL, V.big);
        blit(ctx, owl, x - owl.width / 2, y);
        ctx.fillStyle = OUT;
        ctx.fillRect(Math.round(x), Math.round(y + owl.height), 1, 4);
        buddyAt(ctx, S, x - 10, y + owl.height + 3);
      }
    },
  },

  'bg-sunset': {
    dur: 8,
    sfx: [[0, 'splash'], [0.6, 'rumble'], [2, 'cannon'], [2.7, 'boom'], [2.8, 'cannon'], [3.5, 'boom'], [3.6, 'squawk'], [3.6, 'cannon'], [4.3, 'boom'], [4.4, 'cannon'], [5.1, 'boom'], [5.2, 'cannon'], [5.4, 'squawk'], [5.9, 'boom'], [6.6, 'splash']],
    init(S, V) {
      S.ship = big('ghostship', outlined(SHIP), GHOST_PAL, V.big);
      S.sx = V.cx - S.ship.width / 2;
      [2, 2.8, 3.6, 4.4, 5.2].forEach((t0, i) => {
        shell(S, t0, { x: S.sx + 12 + i * 8, y: V.bottom - 30 }, { x: rand(12, V.aw - 12), y: V.top + rand(10, V.h * 0.45) });
      });
    },
    step(ctx, t, V, S, frame) {
      const rise = span(t, 0, 1.5) - span(t, 6.5, 8);
      const y = V.bottom + 4 - rise * (S.ship.height + 6) + Math.sin(t * 3) * 1.5;
      // waves the ship rises out of
      ctx.globalAlpha = 0.8;
      blit(ctx, S.ship, S.sx, y);
      ctx.globalAlpha = 1;
      ctx.fillStyle = '#4dabf7';
      for (let x = 0; x < V.aw; x += 4) ctx.fillRect(x, Math.round(V.bottom - 3 + Math.sin(x / 6 + t * 4) * 1.5), 3, 4);
      if (rise > 0.2 && frame % 3 === 0) S.parts.add({ x: rand(S.sx, S.sx + S.ship.width), y: y + rand(0, 20), vy: -0.4, max: 18, c: '#c3fae8' });
      // the buddy stands on deck and jumps each time a cannon fires
      if (rise > 0.5) {
        const jump = [2, 2.8, 3.6, 4.4, 5.2].some((c) => t > c && t < c + 0.35) ? 5 : 0;
        buddyAt(ctx, S, S.sx + S.ship.width * 0.18, y + 8 * V.big - 19 - jump);
      }
      stepShells(ctx, t, S, '#212529');
      // the parrot
      if (t > 3.2 && t < 7.6) {
        const u = (t - 3.2) / 4.4;
        blit(ctx, big(`parrot${frame % 4 < 2}`, PARROT[frame % 4 < 2 ? 0 : 1], PARROT_PAL, V.big), V.aw + 10 - u * (V.aw + 40), V.top + 12 + Math.sin(u * 12) * 4);
      }
    },
  },

  'bg-ocean': {
    dur: 8,
    quake: [[0, 1]],
    sfx: [[0, 'rumble'], [0.8, 'splash'], [1.6, 'splash'], [3.4, 'whoosh'], [4.5, 'pop'], [4.55, 'coins'], [4.7, 'pop'], [5, 'pop'], [6.6, 'splash']],
    init(S, V) {
      S.arms = [0.06, 0.2, 0.8, 0.94].map((f, i) => ({ x: f * V.aw, ph: i * 1.7, lean: f < 0.5 ? 1 : -1 }));
    },
    step(ctx, t, V, S) {
      const up = span(t, 0, 1.6) - span(t, 6.4, 8);
      const tips = [];
      for (const a of S.arms) {
        const n = Math.floor(up * Math.min(38, V.h * 0.17));
        let tip = { x: a.x, y: V.bottom };
        for (let i = 0; i < n; i += 1) {
          const x = a.x + Math.sin(t * 2.5 + i * 0.22 + a.ph) * i * 0.35 + a.lean * i * 0.4;
          const y = V.bottom + 4 - i * 3;
          puff(ctx, x, y, Math.max(1.5, 5 - i * 0.11), i % 2 ? '#9775fa' : '#b197fc', OUT);
          if (i % 3 === 1) { ctx.fillStyle = '#e5dbff'; ctx.fillRect(Math.round(x + a.lean * 2), Math.round(y), 2, 2); }
          tip = { x, y };
        }
        tips.push(tip);
      }
      // the buddy jumps from tentacle to tentacle
      if (t > 1.6 && t < 6.6) {
        const order = [1, 0, 1, 2, 3, 2, 1, 2];
        const u = (t - 1.6) / 0.625;
        const k = Math.min(order.length - 2, Math.floor(u));
        const f = u - k;
        const a = tips[order[k]];
        const b = tips[order[k + 1]];
        const air = f > 0.35;
        const g = air ? (f - 0.35) / 0.65 : 0;
        const x = air ? a.x + (b.x - a.x) * g : a.x;
        const y = air ? a.y + (b.y - a.y) * g - Math.sin(g * Math.PI) * Math.max(14, Math.abs(b.x - a.x) * 0.35) : a.y;
        buddyAt(ctx, S, x - 10, y - 22);
        if (air && f < 0.45) S.parts.add({ x: a.x, y: a.y - 2, vx: rand(-0.6, 0.6), vy: -0.6, max: 20, ring: true, size: 1, c: '#d0ebff' });
      }
      // the octopus pops up and throws a treasure chest, which bursts into bubbles and coins
      const oy = V.bottom - span(t, 1, 2) * 20 + span(t, 6.5, 7.5) * 24;
      const octo = big('octo', OCTO, OCTO_PAL, V.big);
      const ox = V.cx - octo.width / 2;
      if (t > 3.4 && t < 4.5) {
        const u = (t - 3.4) / 1.1;
        const chest = big('chest', CHEST, CHEST_PALS.gold, V.big - 1);
        blit(ctx, chest, V.cx - 10, oy - u * (oy - V.top - V.h * 0.25) - Math.sin(u * Math.PI) * 10);
      }
      if (t >= 4.5 && !S.popped) {
        S.popped = true;
        const y = V.top + V.h * 0.25;
        for (let i = 0; i < 30; i += 1) S.parts.add({ x: V.cx, y, vx: rand(-2, 2), vy: rand(-2.5, 0.5), g: 0.12, max: 50, size: 2, c: (p) => (p.life % 6 < 3 ? '#fcc419' : '#ffe066') });
        for (let i = 0; i < 24; i += 1) S.parts.add({ x: V.cx + rand(-10, 10), y: y + rand(-6, 6), vx: rand(-0.6, 0.6), vy: rand(-1.6, -0.5), max: 50, ring: true, size: Math.floor(rand(1, 4)), c: '#d0ebff' });
      }
      blit(ctx, octo, ox, oy);
      if (t > 1 && t < 7 && Math.random() < 0.4) S.parts.add({ x: rand(0, V.aw), y: V.bottom, vy: -rand(0.5, 1.2), max: 60, ring: true, size: 1, c: '#d0ebff' });
    },
  },

  'bg-space': {
    dur: 8.5,
    quake: [[0, 1.4], [7.4, 8]],
    sfx: [[0, 'rumble'], [1, 'boing'], [1.4, 'whoosh'], [2.8, 'whoosh'], [4.2, 'whoosh'], [5.6, 'whoosh'], [7.2, 'boing'], [7.4, 'rumble']],
    init(S) { S.trail = []; },
    step(ctx, t, V, S) {
      // a figure of eight over the map, coming up out of the ground and going back down
      const start = { x: V.spot.x, y: V.bottom + 12 };
      let hx;
      let hy;
      const loop = (u) => ({ x: V.cx + Math.sin(u) * V.aw * 0.32, y: V.mid + Math.sin(2 * u) * V.h * 0.2 });
      if (t < 1.2) {
        const p = loop(0);
        const u = span(t, 0.4, 1.2);
        hx = start.x + (p.x - start.x) * u;
        hy = start.y + (p.y - start.y) * u;
      } else if (t < 7.2) {
        const p = loop(((t - 1.2) / 6) * Math.PI * 4);
        hx = p.x; hy = p.y;
      } else {
        const p = loop(Math.PI * 4);
        const u = span(t, 7.2, 8);
        hx = p.x + (start.x - p.x) * u;
        hy = p.y + (start.y + 20 - p.y) * u;
      }
      S.trail.push({ x: hx, y: hy });
      if (t > 0.4 && t < 1.4) for (let i = 0; i < 3; i += 1) S.parts.add({ x: start.x + rand(-10, 10), y: V.bottom - 4, vx: rand(-1, 1), vy: rand(-1.5, -0.3), max: 20, size: 2, c: '#adb5bd' });
      // body segments every 4 pixels back along the path the head took
      const segs = [];
      let acc = 0;
      for (let i = S.trail.length - 1; i > 0 && segs.length < 22; i -= 1) {
        const a = S.trail[i];
        const b = S.trail[i - 1];
        const L = Math.hypot(a.x - b.x, a.y - b.y);
        let pos = 4 - acc;
        while (pos <= L && segs.length < 22) {
          segs.push({ x: a.x + ((b.x - a.x) * pos) / L, y: a.y + ((b.y - a.y) * pos) / L });
          pos += 4;
        }
        acc = L - (pos - 4);
      }
      for (let k = segs.length - 1; k >= 0; k -= 1) puff(ctx, segs[k].x, segs[k].y, 5.5 - k * 0.12, k % 2 ? '#e5dbff' : '#d0bfff', OUT);
      puff(ctx, hx, hy, 6, '#e5dbff', OUT);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(hx) - 3, Math.round(hy) - 2, 2, 2);
      ctx.fillRect(Math.round(hx) + 2, Math.round(hy) - 2, 2, 2);
      ctx.fillStyle = OUT;
      ctx.fillRect(Math.round(hx) - 2, Math.round(hy) - 1, 1, 1);
      ctx.fillRect(Math.round(hx) + 3, Math.round(hy) - 1, 1, 1);
      ctx.fillStyle = '#f783ac';
      ctx.fillRect(Math.round(hx) - 1, Math.round(hy) + 2, 3, 1);
      // the buddy rides on its head
      if (t > 1 && t < 7.4) buddyAt(ctx, S, hx - 10, hy - 25);
    },
  },

  'bg-castle': {
    dur: 8,
    sfx: [[0, 'whoosh'], [1.5, 'roar'], [2.1, 'boom'], [2.7, 'boom'], [3.3, 'boom'], [3.9, 'boom'], [4.5, 'boom'], [5.1, 'boom'], [5.7, 'boom'], [6.6, 'whoosh']],
    init(S, V) {
      S.dragon = big('kingdragon', DRAGON, GOLD_DRAGON, V.big);
      S.roar = big('kingroar', DRAGON_ROAR, GOLD_DRAGON, V.big);
      [1.6, 2.2, 2.8, 3.4, 4, 4.6, 5.2].forEach((t0) => shell(S, t0, { x: 0, y: 0 }, { x: rand(10, V.aw - 10), y: V.top + rand(8, V.h * 0.35) }, 0.5));
    },
    step(ctx, t, V, S, frame) {
      const d = S.dragon;
      const hx = V.cx - d.width / 2 + 6;
      const hy = V.mid - d.height / 2;
      const inn = span(t, 0, 1.4);
      const out = span(t, 6.4, 8);
      const x = hx + (1 - inn) * (V.aw * 0.8) - out * (V.aw * 0.9);
      const y = hy - (1 - inn) * V.h * 0.4 - out * V.h * 0.5 + Math.sin(t * 4) * 3;
      const flap = frame % 6 < 3;
      const wing = big(`kw${flap}`, flap ? WING_UP : WING_DOWN, GOLD_DRAGON, V.big);
      if (flap) blit(ctx, wing, x + 13 * V.big, y - V.big);
      const roaring = t > 1.5 && t < 5.6 && frame % 12 < 9;
      blit(ctx, roaring ? S.roar : d, x, y);
      // the buddy rides on the Dragon King's back
      buddyAt(ctx, S, x + 15 * V.big - 10, y + 9 * V.big - 19 + (flap ? -1 : 1));
      if (!flap) blit(ctx, wing, x + 13 * V.big, y + 10 * V.big);
      // fireworks out of its mouth
      for (const sh of S.shells) if (!sh.started) { sh.from = { x: x + 2 * V.big, y: y + 8 * V.big }; if (t >= sh.t0) sh.started = true; }
      stepShells(ctx, t, S, '#ff922b');
      if (roaring) for (let i = 0; i < 2; i += 1) S.parts.add({ x: x + V.big, y: y + 9 * V.big, vx: rand(-2.5, -1), vy: rand(-1.5, 0.5), max: 12, size: 2, c: (p) => (p.life < 5 ? '#ffe066' : '#ff922b') });
      // the knight and the little dragon dance
      if (t > 1.6 && t < 7.4) {
        const hop = (k) => (Math.floor(t * 4) + k) % 2 ? 3 : 0;
        draw(ctx, V.aw * 0.25 - 12, V.bottom - 26 - hop(0), KNIGHT, KNIGHT_PAL);
        draw(ctx, V.aw * 0.75 - 10, V.bottom - 24 - hop(1), DRAGON, DRAGON_PAL);
      }
    },
  },

  'bg-volcano': {
    dur: 8,
    quake: [[0, 1.6]],
    sfx: [[0, 'rumble'], [0.9, 'boom'], [1.5, 'boom'], [2.2, 'whoosh'], [2.6, 'screech'], [4.4, 'whoosh'], [5, 'screech'], [6.5, 'sparkle']],
    step(ctx, t, V, S, frame) {
      if (t > 0.8 && t < 3) {
        for (let i = 0; i < 6; i += 1) S.parts.add({ x: V.spot.x + rand(-4, 4), y: V.spot.y, vx: rand(-1.6, 1.6), vy: rand(-5, -2.5), g: 0.14, max: 40, size: 2, c: pick(['#e03131', '#ff922b', '#ffd43b']) });
      }
      // the phoenix zigzags up the map leaving fire behind
      if (t > 2 && t < 7.2) {
        const u = (t - 2) / 5.2;
        const x = V.cx + Math.sin(u * Math.PI * 3) * V.aw * 0.32;
        const y = V.bottom - u * (V.h + 40);
        const bird = big(`phoenix${frame % 4 < 2}`, PHOENIX[frame % 4 < 2 ? 0 : 1], PHOENIX_PAL, V.big);
        blit(ctx, bird, x - bird.width / 2, y);
        buddyAt(ctx, S, x - 10, y - 14 + (frame % 4 < 2 ? 0 : 2));
        for (let i = 0; i < 3; i += 1) S.parts.add({ x: x + rand(-6, 6), y: y + bird.height - 2, vx: rand(-0.4, 0.4), vy: rand(0.2, 1), max: 22, size: 2, c: (p) => (p.life < 6 ? '#ffe066' : p.life < 14 ? '#ff922b' : '#e03131') });
      }
      // the tikis bow
      if (t > 2.5 && t < 7.6) {
        const bow = Math.floor(t * 2) % 2;
        [0.2, 0.5, 0.8].forEach((f, i) => draw(ctx, V.aw * f - 5, V.bottom - 20 + (bow ? 3 : 0) + (i === 1 ? -2 : 0), TIKI, TIKI_PAL));
      }
    },
  },

  'bg-rainbow': {
    dur: 8,
    sfx: [[0.3, 'coins'], [0.6, 'sparkle'], [1.4, 'sparkle'], [2.2, 'whee'], [3, 'neigh'], [3.5, 'sparkle'], [4.6, 'neigh'], [5.2, 'sparkle'], [6.4, 'sparkle']],
    step(ctx, t, V, S, frame) {
      const R = Math.min(V.aw * 0.45, V.h * 0.7);
      const cx = V.cx;
      const cy = V.bottom - 6;
      const grow = span(t, 0.5, 2);
      const fade = 1 - span(t, 7, 8);
      ctx.globalAlpha = fade;
      for (let k = 0; k < RAINBOW.length; k += 1) {
        const r = R - k * 3;
        ctx.fillStyle = RAINBOW[k];
        for (let a = 0; a <= Math.PI * grow; a += 1.5 / r) ctx.fillRect(Math.round(cx - Math.cos(a) * r), Math.round(cy - Math.sin(a) * r), 3, 3);
      }
      ctx.globalAlpha = 1;
      if (t > 0.3 && t < 2.6 && frame % 2 === 0) S.parts.add({ x: V.spot.x, y: V.spot.y, vx: rand(-1.5, 1.5), vy: rand(-3.5, -2), g: 0.15, max: 30, size: 2, c: '#fcc419' });
      // the buddy slides down the rainbow
      if (t > 2.2 && t < 5.2) {
        const a = Math.PI * (1 - span(t, 2.2, 5.2));
        const x = cx - Math.cos(a) * (R + 2);
        const y = cy - Math.sin(a) * (R + 2);
        buddyAt(ctx, S, x - 10, y - 20);
        S.parts.add({ x: x + rand(-3, 3), y: y - 2, max: 16, star: true, c: pick(RAINBOW) });
      }
      // flying unicorns; the buddy jumps off the end of the rainbow onto the last one
      const ride = {};
      [0, 1, 2].forEach((i) => {
        const t0 = 2.6 + i * 0.6;
        if (t < t0 || t > t0 + 4.2) return;
        const u = (t - t0) / 4.2;
        const x = -30 + u * (V.aw + 60);
        const y = V.top + V.h * (0.12 + i * 0.13) + Math.sin(u * 10 + i) * 3;
        const c = Math.floor(frame / 3);
        const manes = ['#f783ac', '#b197fc', '#74c0fc', '#8ce99a', '#ffd43b'];
        draw(ctx, x, y, UNICORN_RUN[frame % 2], { y: '#ffe066', Y: '#f59f00', M: manes[(c + i) % 5], N: manes[(c + i + 2) % 5], W: '#ffffff', w: '#e5dbff', p: '#f783ac', h: '#9775fa' });
        if (frame % 2 === 0) S.parts.add({ x, y: y + 12, max: 14, star: true, c: manes[(c + i) % 5] });
        if (i === 2) { ride.x = x + 10; ride.y = y + 2; }
      });
      if (t >= 5.2 && ride.x !== undefined) {
        const from = { x: cx + R + 2, y: cy };
        const g = span(t, 5.2, 5.8);
        const x = from.x + (ride.x - from.x) * g;
        const y = from.y + (ride.y - from.y) * g - Math.sin(g * Math.PI) * 20;
        buddyAt(ctx, S, x - 10, y - 18);
      }
    },
  },

  'bg-galaxy': {
    dur: 8.5,
    sfx: [[0, 'warp'], [1.6, 'whale'], [3, 'sparkle'], [4.2, 'whale'], [5, 'sparkle'], [7, 'warp']],
    init(S, V) { S.whale = big('whale', outlined(WHALE('E')), WHALE_PAL, V.big, true); },
    step(ctx, t, V, S, frame) {
      const px = V.aw * 0.14;
      const py = V.mid;
      const open = span(t, 0, 1.2) - span(t, 7, 8);
      // the portal: three rings of turning dots
      [['#cc5de8', 1], ['#5c7cfa', -1.4], ['#f783ac', 1.8]].forEach(([c, spin], k) => {
        const r = open * (16 - k * 4);
        ctx.fillStyle = c;
        for (let i = 0; i < 18; i += 1) {
          const a = (i / 18) * Math.PI * 2 + t * spin;
          ctx.fillRect(Math.round(px + Math.cos(a) * r * 0.6), Math.round(py + Math.sin(a) * r), 2, 2);
        }
      });
      // meteors
      if (t > 0.8 && t < 7.5 && frame % 5 === 0) {
        const x = rand(V.aw * 0.3, V.aw + 20);
        S.parts.add({ x, y: V.top - 4, vx: -2.2, vy: 2.2, max: 30, size: 2, c: '#ffffff', fx: (p) => S.parts.list.length < 400 && S.parts.add({ x: p.x, y: p.y, max: 8, c: '#ffe066' }) });
      }
      // the whale swims out of the portal and across the map
      if (t > 1.2 && t < 8) {
        const w = S.whale;
        const u = (t - 1.2) / 6.6;
        const x = px - w.width + u * (V.aw + w.width * 1.3);
        const y = py - w.height / 2 + Math.sin(t * 2) * 4;
        blit(ctx, w, x, y);
        buddyAt(ctx, S, x + w.width * 0.42 - 10, y - 15);
        if ((t > 3 && t < 3.8) || (t > 5 && t < 5.8)) {
          for (let i = 0; i < 3; i += 1) S.parts.add({ x: x + w.width - 7 * V.big, y: y + V.big, vx: rand(-1.2, 1.2), vy: rand(-3, -1.5), g: 0.08, max: 30, star: true, c: pick(['#ffe066', '#ffffff', '#fff3bf']) });
        }
      }
    },
  },
};

const running = new WeakMap();

/** Whether a show is playing on this map right now. */
export const showPlaying = (section) => running.has(section);

/**
 * Play the show for a map theme on a painted .quest-map section.
 * opts: { buddy: Image or null, spot: { x, y } landmark center in CSS pixels in the map, onDone }.
 * Returns the show (for its sfx) or null if there is none or one is playing.
 */
export function playShow(section, theme, { buddy = null, spot = null, scale = 4, onDone } = {}) {
  const def = SHOWS[theme];
  const land = section.querySelector('canvas.map-land');
  if (!def || !land || running.has(section)) return null;
  const aw = land.width;
  const ah = land.height;
  const canvas = document.createElement('canvas');
  canvas.className = 'map-show';
  canvas.setAttribute('aria-hidden', 'true');
  canvas.width = aw;
  canvas.height = ah;
  canvas.style.width = `${aw * scale}px`;
  canvas.style.height = `${ah * scale}px`;
  section.append(canvas);
  const ctx = canvas.getContext('2d');
  // the part of the map on screen
  const r = section.getBoundingClientRect();
  let top = Math.max(0, -r.top) / scale;
  let bottom = Math.min(r.height, (window.innerHeight || r.height) - r.top) / scale;
  if (bottom < top + 60) { top = 0; bottom = ah; }
  // sprites are drawn bigger on a wide screen
  const V = { aw, top, bottom, h: bottom - top, mid: (top + bottom) / 2, cx: aw / 2, big: aw > 160 ? 3 : 2 };
  const sp = spot ? { x: spot.x / scale, y: spot.y / scale } : null;
  V.spot = sp && sp.y > top && sp.y < bottom ? sp : { x: aw / 2, y: bottom - 8 };
  const S = { parts: new Parts(), shells: [], buddy };
  def.init?.(S, V);
  let frame = 0;
  const total = Math.round(def.dur * FPS);
  const timer = setInterval(() => {
    if (!canvas.isConnected) { stop(); return; }
    const t = frame / FPS;
    const quake = (def.quake || []).some(([a, b]) => t >= a && t < b);
    section.classList.toggle('map-quake', quake);
    ctx.clearRect(0, 0, aw, ah);
    def.step(ctx, t, V, S, frame);
    S.parts.step();
    S.parts.draw(ctx);
    canvas.style.opacity = String(1 - span(t, def.dur - 0.4, def.dur));
    frame += 1;
    if (frame > total) stop();
  }, 1000 / FPS);
  function stop() {
    clearInterval(timer);
    canvas.remove();
    section.classList.remove('map-quake');
    running.delete(section);
    onDone?.();
  }
  running.set(section, stop);
  return def;
}
