// Things that move on the quest map: fish, aliens and a rocket, an erupting volcano, a dragon
// and a knight, a unicorn, flying saucers, the rainforest's sloth, toucan, monkey and jaguar. Drawn
// on a second canvas over the land (under the stops), with the same pixel size as the map. Events
// happen where the kid is looking.

import { sounds, setRain } from './fx.js';
import { duckMusic } from './music.js';
import { upscale, thinOutline } from './upscale.js';

const OUT = '#2a1838';
const FPS = 12.5;
const FRAME = 1000 / FPS;

// ---------- sprites ----------
// Drawn one art pixel to one map pixel, so they match the map and the buddies. Each grid is
// the fill only: `sprite()` pads the rows and wraps the shape in a dark outline (K inside a grid
// is an outline pixel too, . is see-through).

function sprite(rows, outline = true) {
  const w = Math.max(...rows.map((r) => r.length));
  const g = rows.map((r) => r.padEnd(w, '.'));
  if (!outline) return g;
  const at = (x, y) => (y >= 0 && y < g.length && x >= 0 && x < w ? g[y][x] : '.');
  const out = [];
  for (let y = -1; y <= g.length; y += 1) {
    let row = '';
    for (let x = -1; x <= w; x += 1) {
      const c = at(x, y);
      if (c !== '.') row += c;
      else row += [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)].some((n) => n !== '.') ? 'K' : '.';
    }
    out.push(row);
  }
  return out;
}
/** The same grid with some rows swapped out, starting at row `from`. */
const swap = (rows, from, repl) => rows.map((r, i) => (i >= from && i < from + repl.length ? repl[i - from] : r));

// A fish facing right: o body, l light, d shade, w stripe, f fins, e eye.
const FISH_BODY = [
  '........ff',
  '.......ffff',
  '......llwlll',
  'ff...lllwlllll',
  'fff.oooowoooooeK',
  '.ffooooowoooooooo',
  '..fooooowooooooo',
  '.ff.ddddwdddddd',
  'fff..dddwdddd',
  'ff....ddwdd',
  '.......ff',
];
const FISH = sprite(FISH_BODY);
const FISH_TAIL = sprite(swap(FISH_BODY, 3, [
  '.....lllwlllll',
  '.ff.oooowoooooeK',
  '.ffooooowoooooooo',
  '.ffooooowooooooo',
  'fff.ddddwdddddd',
  '.ff..dddwdddd',
  '......ddwdd',
]));

// A little alien facing right: g green, l light, d shade, y antenna glow, e eye glint.
const ALIEN_BODY = [
  '.y........y',
  '..a......a',
  '...gggggg',
  '..lllggggg',
  '.glKKggKKgg',
  '.glKeggKegg',
  '.ggggggggdg',
  '..gggKKggg',
  '...dggggd',
  '....dddd',
  '..gggggggg',
  '.g.gggggg.g',
  '...gggggg',
  '...gg..gg',
  '...dd..dd',
];
const ALIEN = sprite(ALIEN_BODY);
const ALIEN_STEP = sprite(swap(ALIEN_BODY, 13, ['..gg....gg', '..dd....dd']));
const ALIEN_WAVE = sprite(swap(ALIEN_BODY, 8, ['...dggggd.g', '....dddd.g', '..ggggggg', '.g.gggggg']));

// The rocket, about twice the size of the aliens: a red nose cone, a yellow band, a porthole,
// red and yellow stripes, swept-back fins and a nozzle. r red, l light, R dark red, w white,
// W shade, b window, B glint, g metal, G dark metal, y yellow.
const ROCKET = sprite([
  '.........rR.........',
  '........lrrR........',
  '........lrrR........',
  '.......lrrrrR.......',
  '.......lrrrrR.......',
  '......lrrrrrrR......',
  '......lrrrrrrR......',
  '.....lrrrrrrrrR.....',
  '.....lrrrrrrrrR.....',
  '....lrrrrrrrrrrR....',
  '....yyyyyyyyyyyy....',
  '....wwwwwwwwwwWW....',
  '....wwwggggggwWW....',
  '....wwgBBbbbbgWW....',
  '....wwgBbbbbbgWW....',
  '....wwgbbbbbbgWW....',
  '....wwgbbbbbbgWW....',
  '....wwwggggggwWW....',
  '....wwwwwwwwwwWW....',
  '....wwwwwwwwwwWW....',
  '....rrrrrrrrrrRR....',
  '....yyyyyyyyyyyy....',
  '....rrrrrrrrrrRR....',
  '....wwwwwwwwwwWW....',
  '...rwwwwwwwwwwWWR...',
  '..rrwwwwwwwwwwWWRR..',
  '.rrrwwwwwwwwwwWWRRR.',
  'rrrrwwwwwrRwwwWWRRRR',
  'rrrrrrrrrrRrrrRRRRRR',
  'rrR..ggggrRgggG..RRR',
  'rR....gggggggG....RR',
  '......gggggggG......',
  '.......gggggG.......',
]);
const ROCKET_W = ROCKET[0].length;
const ROCKET_H = ROCKET.length;
// the exhaust: two flickering frames, white hot in the middle
const FLAME = [
  sprite(['..fyyyyf', '.fyyWWyyf', '.fyyWWyyf', '..fyyyyf', '..ffyyff', '...fyyf', '...ffff', '....ff'], false),
  sprite(['.fyyyyyyf', 'fyyWWWWyyf', '.fyyWWyyf', '.ffyyyyff', '..fyyyyf', '..ffyyff', '...fyyf', '...ffff', '....ff', '.....f'], false),
];

// The dragon faces left: G green, L light, D shade, Y belly, y belly shade, h horns and claws,
// s back spikes, e eye, t teeth, n nostril, r inside of the mouth.
const DRAGON_BODY = [
  '.....h.h',
  '....hh.hh',
  '...LLLLLL',
  '..LGGGGGGG',
  'LLGGeKGGGG',
  'GGGGGGGGGGs',
  'GnGGGGGGGGGs',
  'GGGGGGGGGGGGs',
  'DtDtDDGGGGGGs',
  '.DDDD.DGGGGGGs.s.s',
  '.......YGGGGGGsLsLsL',
  '.......YYGGGGGGGGGGGGs',
  '........YYYGGGGGGGGGGGGs.......ss',
  '.........YYYYYYGGGGGGGGGG.....sGs',
  '..........yyyyyyGGGGGGGGGGGGGGGGs',
  '...........DDyyyyDDDDDDDDDDDDDDD',
  '..........DDD...DDD',
  '..........hh.h..hh.h',
];
export const DRAGON = sprite(DRAGON_BODY);
export const DRAGON_ROAR = sprite(swap(DRAGON_BODY, 7, [
  'tGtGGGGGGGGGs',
  'rrrrrDGGGGGGs',
  'rrrrDDDGGGGGGs.s.s',
  'tDtDD..YGGGGGGsLsLsL',
]));
// wings, w the skin, D the bones
export const WING_UP = sprite([
  '...........D',
  '.........DDw',
  '.......DDwwD',
  '.....DDwwwwD',
  '...DDwwwDwwD',
  '.DDwwwwDwwwD',
  'DwwwwwDwwwwD',
  '.wwwwDwwwwwD',
  '..wwDwwwwwD',
]);
export const WING_DOWN = sprite([
  'DDDDDDDDDDDD',
  '.wwwwDwwwwwD',
  '..wwwDwwwwD',
  '...wwDwwwD',
  '....wwDwD',
  '.....wwD',
  '......D',
]);

// The knight on horseback faces right: p plume, S/s/a helmet and armor, b tabard, c its cross,
// Q shield, R saddle cloth, W/w horse, m mane, n muzzle, h hooves.
const KNIGHT_BODY = [
  '.....pp',
  '....pppp',
  '....SSSs',
  '...SSSsss',
  '...SKKKKa',
  '...Sssssa...........mm',
  '...aSssa...........mWW',
  '..bbbbbbb.........mWWWW',
  '.QbbbcbbbSS......mWWWKWW',
  '.QQbcccbb.......mWWWWWWWW',
  '.QQQbcbbb......mWWWWW.wnn',
  '..QQRRRRRRRRR.mWWWWW',
  '.mWRRRaaRRRRRWWWWWW',
  'mmWWWRRaaRRRRWWWWWW',
  'm.WWWWRRRRRRWWWWWWw',
  'm.wWWWWWWWWWWWWWWww',
  '..wwWWWWwwwwwWWWww',
  '...WW.WW.....WW.WW',
  '...WW.WW.....WW.WW',
  '...ww.ww.....ww.ww',
  '...hh.hh.....hh.hh',
];
export const KNIGHT = sprite(KNIGHT_BODY);
const KNIGHT_RUN = [
  sprite(swap(KNIGHT_BODY, 17, ['..WW.WW......WW.WW', '.WW...WW......WW.WW', 'ww.....ww......ww.ww', 'h.......h.......h...h'])),
  sprite(swap(KNIGHT_BODY, 17, ['...WWWW.....WWWW', '....WW.......WW', '....ww.......ww', '....hh.......hh'])),
];
const SWORD = sprite(['.S', '.S', '.S', '.S', '.S', '.S', 'ggg', '.b']);

// The unicorn faces right: W/w coat, M/N mane (they shimmer), y/Y horn, p nose, h hooves.
const UNICORN_BODY = [
  '.....................y',
  '....................yY',
  '..................MyY',
  '.................MWWW',
  '................MWWWWW',
  '...............MWWWKWW',
  '..............MNWWWWWWW',
  '.............MNWWWWWwpp',
  '............MNWWWW',
  '...........MNWWWW',
  '..NM.......NWWWWW',
  '.NMNM.....WWWWWWW',
  'NMN.WWWWWWWWWWWWW',
  'MN.WWWWWWWWWWWWWw',
  'N..WWWWWWWWWWWWww',
  'M..wWWWWWWWWWWww',
  '....wwWWwwwwwWww',
  '....WW.WW...WW.WW',
  '....WW.WW...WW.WW',
  '....ww.ww...ww.ww',
  '....hh.hh...hh.hh',
];
const UNICORN = sprite(UNICORN_BODY);
export const UNICORN_RUN = [
  sprite(swap(UNICORN_BODY, 17, ['...WW..WW....WW.WW', '..WW....WW....WW.WW', '.ww......ww....ww.ww', '.h........h.....h...h'])),
  sprite(swap(UNICORN_BODY, 17, ['.....WWWW....WWWW', '......WW......WW', '......ww......ww', '......hh......hh'])),
];

// The golden saucer: d glass, A pilot, S/s/o hull, L lights.
const SAUCER = sprite([
  '............dddddd',
  '..........ddAAAAAAdd',
  '.........dAAAAAAAAAAd',
  '.........dAAeKAAeKAAd',
  '.........dAAAAKKAAAAd',
  '........dddAAAAAAAAddd',
  '.....SSSSSSSSSSSSSSSSSSSS',
  '..SSSSSSSSSSSSSSSSSSSSSSSSSS',
  'sLssLssLssLssLssLssLssLssLsss',
  '..ssssssssssssssssssssssssss',
  '.....oooooooooooooooooooo',
  '..........oooooooooo',
]);
const PEACE = sprite(['g...g', 'g...g', '.g.g', '.g.g', 'gggg', 'gggg', '.gg']);

// A fish that has just seen the shark: a huge eye looking back and a little open mouth.
const SCARED_EYE = ['......llwleee', '.....lllwleeeel', '....oooowoeKKeoo', '...ooooowoeeeeooK', '...ooooowooooooKK'];
const scared = (rows) => rows.map((r, i) => (i >= 2 && i < 2 + SCARED_EYE.length ? r.slice(0, 3) + SCARED_EYE[i - 2].slice(3) : r));
const FISH_SCARED = [sprite(scared(FISH_BODY)), sprite(scared(swap(FISH_BODY, 3, ['.....lllwlllll', '.ff.oooowoooooeK', 'fffooooowoooooooo', '.ffooooowooooooo', 'fff.ddddwdddddd', '.ff..dddwdddd', '......ddwdd'])))];
const SWEAT = sprite(['.w', 'www', 'www', '.w']);
const BANG2 = sprite(['y.y', 'y.y', 'y.y', '...', 'y.y']);

// The shark faces right: S back, s fins, W belly, e eye, b its grumpy brow, t teeth, r mouth.
const SHARK_BODY = [
  '..............s',
  '.............ss',
  '............sss',
  's..........ssss',
  'ss.....SSSSSSSSSSSS',
  'sss..SSSSSSSSSSSSSSSSS',
  '.ssSSSSSSSSSSSSSSSSSSSSbbS',
  '..sSSSSSSSSSSSSKSKSKSSSSeKSS',
  '..sSSSSSSSSSSSSKSKSKSSSSSSSSS',
  '.ssSSSSSSSSSSSSSSSSSSSSSSSSSSSS',
  'sss.WWWWWWWWWWWWWWWWWWWKKKKKKKK',
  's.....WWWWWWWWWWWWWWWWWWWWWWWW',
  '..........WWWsWWWWWWWWWWWWW',
  '............ss',
];
const SHARK = sprite(SHARK_BODY);
const SHARK_CHOMP = sprite(swap(SHARK_BODY, 10, [
  'sss.WWWWWWWWWWWWWWWWWWWWKtKtKtK',
  's.....WWWWWWWWWWWWWWWWWWrrrrrr',
  '..........WWWsWWWWWWWWWWrrrrr',
  '............ss..........WtWtWK',
  '.........................WWWW',
]));

// Volcano villagers in tiki masks: M mask, m its shade, e eye, t teeth, g/y/r feathers,
// b skin, G grass skirt. They wave their arms over their heads when the volcano blows.
const TIKI_BODY = [
  '..g.y.g',
  '..gyryg',
  '..MMMMM',
  '.MMMMMMM',
  '.MeKMeKM',
  '.MMMmMMM',
  '.MtttttM',
  '.MKKKKKM',
  '..mmmmm',
  '...bbb',
  '..bbbbb',
  '.b.bbb.b',
  '..GGGGG',
  '.GGGGGGG',
  '...b.b',
  '...b.b',
  '..bb.bb',
];
const CRAB_BODY = [
  'rr...........rr',
  'r.r..e...e..r.r',
  'rrr..K...K..rrr',
  '.r...r...r...r',
  '..rrrrrrrrrrr',
  '...rlllllllr',
  '...rrrrrrrrr',
  '..r.r.r.r.r.r',
  '.r..r.....r..r',
];
// beach crabs: r shell, l its light top, e eye. Claws open and shut, legs scuttle.
const CRAB_CLAWS_SHUT = ['rr...........rr', 'rrr..e...e..rrr', 'rr...K...K...rr'];
const CRAB = [CRAB_BODY, swap(CRAB_BODY, 7, ['.r..r.r.r.r..r', 'r...r.....r...r'])].map((b) => [sprite(b), sprite(swap(b, 0, CRAB_CLAWS_SHUT))]);
export const TIKI = sprite(TIKI_BODY);
const TIKI_RUN = [
  ['..b..b', '.b...b', 'bb...bb'],
  ['...bb', '...bb', '..bbb'],
].map((legs) => sprite(swap(swap(TIKI_BODY, 0, ['b.g.y.g.b', 'b.gyryg.b', 'b.MMMMM.b']), 9, ['...bbb', '..bbbbb', '...bbb', '..GGGGG', '.GGGGGGG', ...legs])));

// The family party (mapParty): for a few seconds every critter bounces and sways
// to the same beat, with little hearts popping up over the bigger ones.
let partyUntil = 0;
let partyFrame = 0;
/** Make every critter on the map dance for ms. */
export function mapParty(ms) {
  partyUntil = performance.now() + ms;
}
const partyOn = () => performance.now() < partyUntil;
const HEART = sprite(['r.r', 'rrr', '.r'], false);

export function draw(ctx, x0, y0, rows, pal, flip = false) {
  let x = Math.round(x0);
  let y = Math.round(y0);
  if (partyOn()) {
    const f = partyFrame;
    y -= Math.round(Math.abs(Math.sin((f * Math.PI) / 4)) * 4); // a hop on every beat
    x += f % 8 < 4 ? 1 : -1; // and a sway
    const w = Math.max(...rows.map((r) => r.length));
    if (rows.length >= 9 && w >= 9 && f % 6 < 4) {
      const hx = x + Math.floor(w / 2) - 1 + ((f >> 1) % 3) - 1;
      const hy = y - 6 - (f % 6);
      for (const [dy, r] of HEART.entries()) for (let i = 0; i < r.length; i += 1) if (r[i] === 'r') { ctx.fillStyle = '#ff6b9a'; ctx.fillRect(hx + i, hy + dy, 1, 1); }
    }
  }
  // on a fine canvas (see startMapLife) the sprite is smoothed to half-size pixels
  const n = ctx.fine || 1;
  const g = n > 1 ? thinOutline(upscale(rows, n), n - 1) : rows;
  const u = 1 / n;
  g.forEach((r, yy) => {
    for (let i = 0; i < r.length; i += 1) {
      const ch = r[i];
      if (ch === '.') continue;
      const c = ch === 'K' ? OUT : pal[ch];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + (flip ? r.length - 1 - i : i) * u, y + yy * u, u, u);
    }
  });
}
/** Where a part (wing, sword) goes on a sprite that may be flipped: `ox` is from the sprite's left. */
const partX = (x, w, ox, part, flip) => (flip ? x + w - ox - part[0].length : x + ox);
/** A round pixel puff, for smoke and fire. */
export function puff(ctx, cx, cy, r, c, edge) {
  const x0 = Math.round(cx);
  const y0 = Math.round(cy);
  const rr = Math.max(0.5, r);
  for (let dy = -Math.ceil(rr) - 1; dy <= Math.ceil(rr) + 1; dy += 1) {
    for (let dx = -Math.ceil(rr) - 1; dx <= Math.ceil(rr) + 1; dx += 1) {
      const d = Math.hypot(dx, dy);
      if (d <= rr + 0.3) ctx.fillStyle = c;
      else if (edge && d <= rr + 1.3) ctx.fillStyle = edge;
      else continue;
      ctx.fillRect(x0 + dx, y0 + dy, 1, 1);
    }
  }
}
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- the actors, one set per theme ----------

/** Fish swim across now and then, in little schools. Now and then a shark chases one off. */
function fishLife(m) {
  const fish = [];
  const colors = [
    { o: '#ff922b', l: '#ffc078', d: '#e8590c', w: '#ffffff', f: '#d9480f', e: '#ffffff' },
    { o: '#ffd43b', l: '#fff3bf', d: '#f59f00', w: '#4dabf7', f: '#1c7ed6', e: '#ffffff' },
    { o: '#f783ac', l: '#fcc2d7', d: '#d6336c', w: '#ffffff', f: '#ae3ec9', e: '#ffffff' },
    { o: '#63e6be', l: '#c3fae8', d: '#0ca678', w: '#1098ad', f: '#0b7285', e: '#ffffff' },
  ];
  const sPal = { S: '#748ffc', s: '#5c7cfa', W: '#edf2ff', e: '#ffffff', b: OUT, t: '#ffffff', r: '#c92a2a' };
  const SW = SHARK[0].length;
  const FW = FISH[0].length;
  let next = 600;
  let nextChase = 4000;
  let chase = null; // { prey, shark: { x, y, speed, dir } }
  return {
    step(t, view) {
      if (t > next) {
        next = t + rand(3000, 7000);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = rand(view.top + 10, view.bottom - 15);
        const pal = colors[Math.floor(Math.random() * colors.length)];
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i += 1) {
          fish.push({ x: dir > 0 ? -22 - i * 26 : m.aw + 2 + i * 26, y: y + i * 10 * (i % 2 ? 1 : -1), dir, pal, speed: rand(0.9, 1.4), phase: Math.random() * 6 });
        }
      }
      if (!chase && t > nextChase) {
        // a lone fish swims in, and a shark comes along behind it
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = rand(view.top + 20, Math.max(view.top + 21, view.bottom - 40));
        const prey = { x: dir > 0 ? -FW : m.aw, y, base: y, dir, pal: colors[Math.floor(Math.random() * colors.length)], speed: 1, phase: 0, fright: 0, scared: false };
        fish.push(prey);
        chase = { prey, shark: { x: dir > 0 ? -FW - SW - 60 : m.aw + FW + 60, y: y - 3, dir, speed: 1.7 } };
      }
      if (chase) {
        const { prey, shark } = chase;
        const gap = shark.dir > 0 ? prey.x - (shark.x + SW) : shark.x - (prey.x + FW);
        if (!prey.scared && gap < 34) { prey.scared = true; prey.fright = 9; } // eek!
        if (prey.scared) {
          if (prey.fright > 0) { prey.fright -= 1; prey.speed = 0; } else prey.speed = Math.min(3.4, prey.speed + 0.5);
          prey.zig = (prey.zig || 0) + 1;
          prey.y = prey.base + Math.sin(prey.zig / 2.2) * 6;
          shark.speed = Math.min(3, shark.speed + 0.08);
        }
        shark.x += shark.dir * shark.speed;
        shark.y += Math.max(-1, Math.min(1, prey.y - 3 - shark.y));
        chase.chomp = gap < 16;
        if ((shark.dir > 0 && shark.x > m.aw + 20) || (shark.dir < 0 && shark.x < -SW - 20)) { chase = null; nextChase = t + rand(15000, 25000); }
      }
      for (const f of fish) { f.x += f.dir * f.speed; f.phase += f.scared ? 0.8 : 0.25; }
      for (let i = fish.length - 1; i >= 0; i -= 1) if (fish[i].x < -60 || fish[i].x > m.aw + 60) fish.splice(i, 1);
    },
    draw(ctx, frame) {
      for (const f of fish) {
        const tail = (frame + Math.round(f.phase)) % (f.scared ? 2 : 4) < (f.scared ? 1 : 2);
        if (!f.scared) { draw(ctx, f.x, f.y + Math.round(Math.sin(f.phase) * 1.5), tail ? FISH : FISH_TAIL, f.pal, f.dir < 0); continue; }
        // shaking with fright, with sweat drops flying and a "!!"
        const jx = f.fright > 0 ? (frame % 2 ? 1 : -1) : 0;
        const jy = f.fright > 0 ? -2 : 0;
        draw(ctx, f.x + jx, f.y + jy, FISH_SCARED[tail ? 0 : 1], f.pal, f.dir < 0);
        const back = f.dir > 0 ? f.x - 2 : f.x + FW - 3;
        if (frame % 4 < 3) draw(ctx, back - f.dir * (frame % 4), f.y - 4 + jy - (frame % 4), SWEAT, { w: '#a5d8ff' });
        if (frame % 4 < 3) draw(ctx, back + 4 - f.dir * (frame % 3), f.y + 9 + (frame % 3), SWEAT, { w: '#a5d8ff' });
        if (f.fright > 0 || frame % 6 < 4) draw(ctx, f.x + FW / 2 - 2, f.y - 9 + jy, BANG2, { y: '#ffe066' });
      }
      if (chase) {
        const { shark } = chase;
        const bite = chase.chomp && frame % 4 < 2;
        draw(ctx, shark.x, shark.y + Math.round(Math.sin(frame / 3)), bite ? SHARK_CHOMP : SHARK, sPal, shark.dir < 0);
      }
    },
  };
}

/** Little aliens wander the moon, and a rocket lands on its pad, waits, then blasts off. */
function spaceLife(m) {
  const aliens = [];
  const pals = [
    { g: '#8ce99a', l: '#d3f9d8', d: '#40c057', a: '#2b8a3e', y: '#ffe066', e: '#ffffff' },
    { g: '#a9e34b', l: '#e9fac8', d: '#74b816', a: '#5c940d', y: '#ff8787', e: '#ffffff' },
    { g: '#66d9e8', l: '#c5f6fa', d: '#22b8cf', a: '#0c8599', y: '#ffe066', e: '#ffffff' },
  ];
  const n = Math.max(4, Math.floor(m.ah / 60));
  for (let i = 0; i < n; i += 1) {
    const spot = m.openSpot({ top: (i * m.ah) / n + 10, bottom: ((i + 1) * m.ah) / n - 10 });
    if (spot) aliens.push({ ...spot, home: spot.x, dir: i % 2 ? 1 : -1, pal: pals[i % pals.length], wave: 0, pause: 0 });
  }
  // the pad sits below the village ponds and fields when buddies are visiting
  const pad = m.pad || { x: m.wall + 4, y: m.section.dataset.areas ? 74 : 48 };
  const PW = ROCKET_W + 10; // the pad is a bit wider than the rocket
  const park = pad.y - ROCKET_H + 2; // the rocket's top when it stands on the pad
  let rocket = { phase: 'away', t: 0, y: -40 };
  let next = 2500;
  return {
    step(t) {
      for (const a of aliens) {
        if (a.pause > 0) { a.pause -= 1; continue; }
        a.x += a.dir * 0.3;
        if (Math.abs(a.x - a.home) > 10) a.dir *= -1;
        if (Math.random() < 0.01) { a.pause = 25; a.wave = 25; }
        if (a.wave > 0) a.wave -= 1;
      }
      const r = rocket;
      if (r.phase === 'away' && t > next) rocket = { phase: 'landing', y: pad.y - ROCKET_H - 80, v: 2.2 };
      else if (r.phase === 'landing') {
        r.v = Math.max(0.35, (park - r.y) / 12);
        r.y += r.v;
        if (r.y >= park - 0.5) { r.y = park; rocket = { phase: 'parked', y: r.y, until: t + 6000 }; }
      } else if (r.phase === 'parked' && t > r.until) rocket = { phase: 'launch', y: r.y, v: 0.2 };
      else if (r.phase === 'launch') {
        r.v *= 1.12; r.y -= r.v;
        if (r.y < -ROCKET_H - 60) { rocket = { phase: 'away' }; next = t + rand(14000, 22000); }
      }
    },
    draw(ctx, frame) {
      // the landing pad
      ctx.fillStyle = OUT; ctx.fillRect(pad.x - 1, pad.y - 5, PW + 2, 10);
      ctx.fillStyle = '#868e96'; ctx.fillRect(pad.x, pad.y - 4, PW, 8);
      ctx.fillStyle = '#adb5bd'; ctx.fillRect(pad.x, pad.y - 4, PW, 2);
      ctx.fillStyle = '#5c636a'; ctx.fillRect(pad.x, pad.y + 3, PW, 1);
      // a yellow H to land on
      const hx = pad.x + PW / 2;
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(hx - 5, pad.y - 3, 2, 6); ctx.fillRect(hx + 3, pad.y - 3, 2, 6); ctx.fillRect(hx - 3, pad.y - 1, 6, 2);
      if (frame % 8 < 4) { ctx.fillStyle = '#ff6b6b'; ctx.fillRect(pad.x - 1, pad.y - 5, 2, 2); ctx.fillRect(pad.x + PW - 1, pad.y - 5, 2, 2); }
      for (const a of aliens) {
        const walking = a.pause <= 0;
        const look = a.wave > 0 && frame % 4 < 2 ? ALIEN_WAVE : walking && frame % 6 < 3 ? ALIEN_STEP : ALIEN;
        draw(ctx, a.x, a.y - (walking && frame % 6 < 3 ? 1 : 0), look, a.pal, a.dir < 0);
      }
      const r = rocket;
      if (r.phase === 'away') return;
      const pal = { r: '#ff6b6b', R: '#c92a2a', l: '#ffa8a8', w: '#f8f9fa', W: '#ced4da', b: '#4dabf7', B: '#d0ebff', g: '#adb5bd', G: '#868e96', f: '#ff922b', y: '#ffe066' };
      const rx = pad.x + Math.round((PW - ROCKET_W) / 2);
      if (r.phase !== 'parked') { const fl = FLAME[frame % 2]; draw(ctx, rx + Math.round((ROCKET_W - fl[0].length) / 2), r.y + ROCKET_H - 2, fl, { f: '#ff922b', y: '#ffe066', W: '#fff9db' }); }
      draw(ctx, rx, r.y, ROCKET, pal);
      if (r.phase === 'launch' && r.y > pad.y - ROCKET_H - 30) {
        for (let i = 0; i < Math.ceil((PW + 8) / 5); i += 1) puff(ctx, pad.x - 4 + i * 5 + (frame % 2), pad.y + 2 - (i % 2) * 2, 1.6 + (i % 3) * 0.5, '#dee2e6', '#adb5bd');
      }
    },
  };
}

/** The volcano rumbles and erupts every so often, and the villagers in tiki masks run about in a panic. */
function volcanoLife(m) {
  const crater = { x: m.goal.x, y: m.goal.y - 26 };
  const blobs = [];
  const smoke = [];
  let next = 2500;
  let glow = 0;
  let panic = 0;
  const masks = [{ M: '#d9480f', m: '#a0612f' }, { M: '#f59f00', m: '#a0612f' }, { M: '#c92a2a', m: '#6e3d1a' }, { M: '#e9c46a', m: '#a0612f' }];
  const tikis = [];
  // most of the village lives near the volcano, a few further up the map
  const n = Math.max(5, Math.floor(m.ah / 70));
  // a village says where its tiki folk live (m.tikiHomes); the map finds spots
  if (m.tikiHomes) m.tikiHomes.forEach(([x, y], i) => tikis.push({ x, y, home: { x, y }, tx: x, ty: y, dir: i % 2 ? 1 : -1, pal: { ...masks[i % masks.length], e: '#ffffff', t: '#fff3bf', g: '#40c057', y: '#ffe066', r: '#ff6b6b', b: '#8a5a3c', G: '#94d82d' }, hop: i * 3 }));
  for (let i = 0; i < (m.tikiHomes ? 0 : n); i += 1) {
    const near = i < 4;
    const band = near ? { top: Math.max(20, crater.y - 90), bottom: Math.min(m.ah - 24, crater.y + 40) } : { top: ((i - 4) * crater.y) / (n - 4) + 10, bottom: ((i - 3) * crater.y) / (n - 4) - 30 };
    const spot = m.openSpot(band);
    if (spot) tikis.push({ ...spot, home: { ...spot }, tx: spot.x, ty: spot.y, dir: i % 2 ? 1 : -1, pal: { ...masks[i % masks.length], e: '#ffffff', t: '#fff3bf', g: '#40c057', y: '#ffe066', r: '#ff6b6b', b: '#8a5a3c', G: '#94d82d' }, hop: i * 3 });
  }
  const wander = (k, far) => {
    // a village says where they may not run (m.canStand: not into the lava or a house)
    for (let tries = 0; tries < 8; tries += 1) {
      k.tx = Math.max(m.wall + 4, Math.min(m.aw - m.wall - 14, k.home.x + rand(-far, far)));
      k.ty = Math.max(20, Math.min(m.ah - 24, k.home.y + rand(-far / 2, far / 2)));
      if (!m.canStand) return;
      let ok = true;
      for (let f = 0.25; f <= 1 && ok; f += 0.25) ok = m.canStand(k.x + (k.tx - k.x) * f + 5, k.y + (k.ty - k.y) * f + 12);
      if (ok) return;
    }
    k.tx = k.x; k.ty = k.y; // nowhere safe to run: stay put
  };
  const stepTikis = () => {
    if (panic > 0) panic -= 1;
    for (const k of tikis) {
      const speed = panic > 0 ? 2.2 : 0.35;
      const dx = k.tx - k.x;
      const dy = k.ty - k.y;
      const d = Math.hypot(dx, dy);
      if (d < speed + 0.5) {
        if (panic > 0) wander(k, 40);
        else if (Math.random() < 0.02) wander(k, 12);
      } else {
        k.x += (dx / d) * speed;
        k.y += (dy / d) * speed;
        if (Math.abs(dx) > 0.5) k.dir = dx > 0 ? 1 : -1;
      }
      k.moving = d >= speed + 0.5;
      k.hop += 1;
    }
  };
  const drawTikis = (ctx, frame) => {
    for (const k of tikis) {
      if (panic > 0) {
        const y = k.y - (frame % 2 ? 2 : 0);
        draw(ctx, k.x, y, TIKI_RUN[frame % 2], k.pal, k.dir < 0);
        if (frame % 4 < 3) draw(ctx, k.x + 5, y - 8, BANG2, { y: '#ffe066' });
      } else {
        // a little dance on the spot, or a stroll
        draw(ctx, k.x, k.y - (k.hop % 8 < 2 ? 1 : 0), k.moving && frame % 4 < 2 ? TIKI_RUN[1] : TIKI, k.pal, k.dir < 0);
      }
    }
  };
  return {
    step(t) {
      stepTikis();
      if (t > next) {
        next = t + rand(9000, 14000);
        glow = 40;
        panic = Math.round(FPS * 4.5);
        for (const k of tikis) wander(k, 40);
        for (let i = 0; i < 28; i += 1) blobs.push({ x: crater.x + rand(-4, 4), y: crater.y, vx: rand(-1.8, 1.8), vy: rand(-4.6, -2.2), delay: Math.floor(rand(0, 22)), big: Math.random() < 0.4 });
      }
      if (glow > 0) {
        glow -= 1;
        if (glow % 3 === 0) smoke.push({ x: crater.x + rand(-3, 3), y: crater.y - 4, r: rand(2, 3), vx: rand(-0.3, 0.3), life: 0 });
      }
      for (const s of smoke) { s.x += s.vx; s.y -= 0.9; s.r += 0.12; s.life += 1; }
      while (smoke.length && smoke[0].life > 40) smoke.shift();
      for (const b of blobs) {
        if (b.delay > 0) { b.delay -= 1; continue; }
        b.x += b.vx; b.y += b.vy; b.vy += 0.18;
      }
      for (let i = blobs.length - 1; i >= 0; i -= 1) if (blobs[i].y > crater.y + 50) blobs.splice(i, 1);
    },
    draw(ctx, frame) {
      drawTikis(ctx, frame);
      // a puffy smoke cloud billows up while the crater flares
      for (const s of smoke) puff(ctx, s.x, s.y, s.r, s.life > 28 ? '#adb5bd' : '#868e96', OUT);
      for (const s of smoke) puff(ctx, s.x - s.r / 3, s.y - s.r / 3, s.r / 2.5, s.life > 28 ? '#ced4da' : '#a5abb1');
      if (glow > 0) {
        ctx.fillStyle = frame % 2 ? '#ffe066' : '#ff922b';
        ctx.fillRect(crater.x - 6, crater.y - 1, 13, 2);
        ctx.fillStyle = '#fff9db';
        ctx.fillRect(crater.x - 2 + (frame % 3), crater.y - 1, 3, 1);
      }
      for (const b of blobs) {
        if (b.delay > 0) continue;
        const hot = b.vy < 0;
        if (b.big) {
          puff(ctx, b.x + 1, b.y + 1, 1.6, hot ? '#ffd43b' : '#ff6b1a', OUT);
          ctx.fillStyle = hot ? '#fff9db' : '#ffa94d'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
        } else {
          ctx.fillStyle = OUT; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 4, 4);
          ctx.fillStyle = hot ? '#ffe066' : '#ff6b1a'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 2, 2);
        }
      }
    },
  };
}

/**
 * A knight on horseback keeps watch. A dragon swoops in and breathes fire; once it has had its
 * roar, the knight draws a sword and chases it away.
 */
function castleLife(m) {
  const post = m.knightPost;
  const knight = { x: post.x, y: post.y, dir: post.side < 0 ? 1 : -1, run: false };
  let dragon = null;
  const flames = []; // the dragon's breath, and smoke, which drift on after the dragon goes
  let next = 3000;
  const BREATH = Math.round(FPS * 2.6); // frames of fire
  const kPal = { p: '#e03131', S: '#f8f9fa', s: '#ced4da', a: '#868e96', b: '#4c6ef5', c: '#ffd43b', Q: '#364fc7', R: '#c92a2a', W: '#ffffff', w: '#ced4da', m: '#a0612f', n: '#868e96', h: '#495057', g: '#ffd43b', y: '#ffd43b' };
  const dPal = { G: '#2f9e44', L: '#8ce99a', D: '#237032', Y: '#ffd43b', y: '#f59f00', h: '#fff3bf', s: '#ff922b', e: '#ffe066', t: '#ffffff', n: OUT, r: '#c92a2a', w: '#ffa94d' };
  const DW = DRAGON[0].length;
  const KW = KNIGHT[0].length;
  const BANG = sprite(['y', 'y', 'y', '.', 'y']);
  const moveTo = (tx, ty, speed) => {
    const dx = tx - knight.x;
    const dy = ty - knight.y;
    const d = Math.hypot(dx, dy);
    if (d < speed) { knight.x = tx; knight.y = ty; return true; }
    knight.x += (dx / d) * speed;
    knight.y += (dy / d) * speed;
    if (Math.abs(dx) > 1) knight.dir = dx > 0 ? 1 : -1;
    return false;
  };
  // the dragon's mouth (the sprite faces left; face 1 means it is turned to the right)
  const mouth = (d) => ({ x: d.face > 0 ? d.x + DW - 2 : d.x + 1, y: d.y + 10 });
  return {
    step(t, view) {
      for (const f of flames) {
        f.x += f.vx; f.y += f.vy; f.life += 1;
        f.vx *= f.smoke ? 0.96 : 0.93;
        f.vy = f.smoke ? f.vy * 0.95 - 0.04 : f.vy + 0.03;
      }
      for (let i = flames.length - 1; i >= 0; i -= 1) if (flames[i].life > flames[i].max) flames.splice(i, 1);
      if (!dragon && t > next) {
        // it comes in from the far side and faces the knight, if the knight is in sight
        const face = post.side < 0 ? -1 : 1;
        const near = post.y > view.top + 10 && post.y < view.bottom - 30;
        const y = near ? post.y + rand(-4, 4) : rand(view.top + 25, Math.max(view.top + 26, view.bottom - 70));
        const stopX = face > 0 ? post.x - 54 - DW : post.x + KW + 54;
        dragon = { x: face > 0 ? -DW - 10 : m.aw + 10, y, base: y, face, stopX, phase: 'in', t: 0, breath: 0 };
      }
      knight.alarm = dragon && (dragon.phase === 'in' || dragon.phase === 'fire') && dragon.x > -DW / 2 && dragon.x < m.aw - DW / 2;
      if (!dragon) {
        knight.run = !moveTo(post.x, post.y, 1);
        if (!knight.run) knight.dir = post.side < 0 ? 1 : -1;
        return;
      }
      const d = dragon;
      d.t += 1;
      if (d.phase === 'in') {
        d.x += d.face * 2.2;
        d.y = d.base + Math.sin(d.t / 5) * 4;
        if (d.face * (d.x - d.stopX) >= 0) { d.phase = 'fire'; d.breath = 0; }
      } else if (d.phase === 'fire') {
        d.y = d.base + Math.sin(d.t / 5) * 2;
        d.breath += 1;
        // a breath in (mouth open), then a long roaring stream of fire at the knight
        const p = mouth(d);
        if (d.breath > 4 && d.breath < BREATH) {
          for (let i = 0; i < 3; i += 1) flames.push({ x: p.x + d.face, y: p.y + rand(-1, 1), vx: d.face * rand(2.4, 3.6), vy: rand(0, 1.1), life: 0, max: Math.floor(rand(9, 15)) });
        }
        if (d.breath >= BREATH + 6) d.phase = 'hover';
      } else if (d.phase === 'hover') {
        d.y = d.base + Math.sin(d.t / 5) * 4;
        if (d.t % 6 === 0) { const p = mouth(d); flames.push({ x: p.x - d.face * 2, y: p.y - 3, vx: d.face * rand(0, 0.4), vy: -0.3, life: 0, max: 14, smoke: true }); }
      } else {
        d.x += d.face * 3.2; d.y -= 1.6;
        if (d.x > m.aw + 40 || d.x < -DW - 40) { dragon = null; next = t + rand(18000, 28000); }
      }
      const front = () => ({ x: d.face > 0 ? d.x + DW + 2 : d.x - KW - 2, y: d.y + 2 });
      if (d.phase === 'hover') {
        knight.run = true;
        const f = front();
        moveTo(f.x, f.y, 2.6);
        if (Math.hypot(knight.x - f.x, knight.y - f.y) < 6) { d.phase = 'flee'; d.face = -d.face; }
      } else if (d.phase === 'flee') {
        // chase it to the wall
        knight.run = true;
        const tx = d.face > 0 ? Math.min(d.x - KW, m.aw - m.wall - KW) : Math.max(d.x + DW, m.wall + 2);
        moveTo(tx, knight.y, 1.6);
      } else {
        // keep watch at the post, facing the dragon
        knight.run = !moveTo(post.x, post.y, 1);
        if (!knight.run) knight.dir = d.x + DW / 2 > knight.x + KW / 2 ? 1 : -1;
      }
    },
    draw(ctx, frame) {
      const d = dragon;
      const charging = d && (d.phase === 'hover' || d.phase === 'flee');
      const flipK = knight.dir < 0;
      const ky = knight.y - (knight.run && frame % 2 ? 1 : 0);
      draw(ctx, knight.x, ky, knight.run ? KNIGHT_RUN[frame % 2] : KNIGHT, kPal, flipK);
      if (charging) draw(ctx, partX(knight.x, KW, 9, SWORD, flipK), ky - (frame % 4 < 2 ? 1 : 0), SWORD, kPal, flipK);
      if (knight.alarm && frame % 6 < 4) draw(ctx, partX(knight.x, KW, 5, BANG, flipK), knight.y - 9, BANG, kPal);
      if (d) {
        const flip = d.face > 0;
        const flap = d.phase === 'fire' ? frame % 6 < 3 : frame % 4 < 2;
        if (flap) draw(ctx, partX(d.x, DW, 13, WING_UP, flip), d.y - 1, WING_UP, dPal, flip);
        const roar = d.phase === 'fire' && d.breath > 1 && d.breath < BREATH + 3;
        draw(ctx, d.x, d.y, roar ? DRAGON_ROAR : DRAGON, dPal, flip);
        if (!flap) draw(ctx, partX(d.x, DW, 13, WING_DOWN, flip), d.y + 10, WING_DOWN, dPal, flip);
      }
      // fire: white hot at the mouth, then yellow, orange, red, and out as smoke
      for (const f of flames) {
        const k = f.life / f.max;
        if (f.smoke) { puff(ctx, f.x, f.y, 1 + k * 1.5, '#ced4da', '#868e96'); continue; }
        const r = 1 + k * 3;
        if (k > 0.85) puff(ctx, f.x, f.y, r, '#868e96');
        else puff(ctx, f.x, f.y, r, k < 0.2 ? '#ffd43b' : k < 0.45 ? '#ff922b' : k < 0.7 ? '#f03e3e' : '#c92a2a', null);
      }
      for (const f of flames) {
        const k = f.life / f.max;
        if (!f.smoke && k < 0.5) puff(ctx, f.x, f.y, Math.max(0.5, 1.2 - k * 2), k < 0.15 ? '#fff9db' : '#ffe066');
      }
    },
  };
}

// Little hearts and stars that puff out of Rainbow Land's chimneys: e is a soft edge, h/y the fill, H/Y a shine.
const PUFF_HEART = ['.ee.ee.', 'eHhehhe', 'ehhhhhe', '.ehhhe.', '..ehe..', '...e...'];
const PUFF_STAR = ['...e...', '..eYe..', 'eeeyeee', 'eyyyyye', '.eyyye.', '.eyeye.', '.e...e.'];
const PUFF_TINY = ['.h.', 'hHh', '.h.'];
const PUFF_PALS = [
  { e: '#e64980', h: '#ff8fb8', H: '#fff0f6' },
  { e: '#9c6ade', h: '#d0b4ff', H: '#f8f0ff' },
  { e: '#e8890c', y: '#ffe066', Y: '#fffbe6' },
];

/**
 * A unicorn wanders about; poke it and it gallops off for a couple of seconds. In a village that
 * names its chimneys (m.chimneys), little hearts and stars puff up out of them now and then.
 */
function unicornLife(m) {
  const start = m.openSpot({ top: 40, bottom: Math.min(m.ah - 20, 140) }) || { x: m.aw / 2, y: 60 };
  const u = { x: start.x, y: start.y, tx: start.x, ty: start.y, dir: 1, run: 0, rest: 20 };
  const trail = [];
  const puffs = [];
  const chimneys = (m.chimneys || []).map(([x, y], i) => ({ x, y, next: Math.round(FPS * (0.6 + i * 0.9)), n: i }));
  const manes = ['#f783ac', '#b197fc', '#74c0fc', '#8ce99a', '#ffd43b'];
  const pick = (view) => m.openSpot(view) || { x: u.x, y: u.y };
  return {
    where: () => ({ x: u.x + 13, y: u.y + 12 }),
    poke(x, y) {
      if (x < u.x - 4 || x > u.x + 30 || y < u.y - 4 || y > u.y + 28) return false;
      u.run = Math.round(FPS * 2.5);
      const dir = Math.random() < 0.5 ? -1 : 1;
      u.tx = Math.max(m.wall + 4, Math.min(m.aw - m.wall - 30, u.x + dir * 80));
      u.ty = u.y + rand(-20, 20);
      return true;
    },
    step(t, view) {
      const speed = u.run > 0 ? 3 : 0.5;
      if (u.run > 0) {
        u.run -= 1;
        for (let i = 0; i < 2; i += 1) trail.push({ x: u.x + (u.dir > 0 ? 1 : 24), y: u.y + 13 + rand(-3, 3), life: 12, c: manes[(trail.length + i) % manes.length] });
      }
      const dx = u.tx - u.x;
      const dy = u.ty - u.y;
      const d = Math.hypot(dx, dy);
      if (d < speed) {
        if (u.run > 0) { const p = pick(view); u.tx = p.x; u.ty = p.y; }
        else if (u.rest > 0) u.rest -= 1;
        else { const p = pick(view); u.tx = p.x; u.ty = p.y; u.rest = Math.floor(rand(15, 60)); }
      } else {
        u.x += (dx / d) * speed;
        u.y += (dy / d) * speed;
        if (Math.abs(dx) > 0.5) u.dir = dx > 0 ? 1 : -1;
      }
      for (const p of trail) { p.life -= 1; p.y += 0.2; }
      while (trail.length && trail[0].life <= 0) trail.shift();
      // a heart or a star puffs up out of a chimney, sways as it rises, and pops
      for (const c of chimneys) {
        c.next -= 1;
        if (c.next > 0) continue;
        c.n += 1;
        const star = c.n % 3 === 2;
        puffs.push({ x: c.x - 3, y: c.y - 7, t: 0, max: Math.round(FPS * rand(2.4, 3.2)), star, pal: PUFF_PALS[star ? 2 : c.n % 2], sway: rand(0, 6) });
        c.next = Math.round(FPS * rand(1.6, 3));
      }
      for (const p of puffs) { p.t += 1; p.y -= 0.7; }
      while (puffs.length && puffs[0].t >= puffs[0].max) puffs.shift();
    },
    draw(ctx, frame) {
      for (const p of puffs) {
        const x = p.x + Math.round(Math.sin((p.t + p.sway) / 5) * 2);
        const left = p.max - p.t;
        if (left <= 2) { ctx.fillStyle = p.pal.H || p.pal.Y; ctx.fillRect(Math.round(x) + 3, Math.round(p.y) + 3, 1, 1); continue; }
        if (p.t < 5 || left < 7) { draw(ctx, x + 2, p.y + 2, PUFF_TINY, { h: p.pal.h || p.pal.y, H: p.pal.H || p.pal.Y }); continue; }
        draw(ctx, x, p.y, p.star ? PUFF_STAR : PUFF_HEART, p.pal);
      }
      for (const p of trail) {
        ctx.fillStyle = p.c;
        if (p.life > 8) { ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y), 3, 1); ctx.fillRect(Math.round(p.x), Math.round(p.y) - 1, 1, 3); } else ctx.fillRect(Math.round(p.x), Math.round(p.y), 1, 1);
      }
      const moving = Math.hypot(u.tx - u.x, u.ty - u.y) > 1;
      const fast = u.run > 0;
      const look = moving ? UNICORN_RUN[fast ? frame % 2 : Math.floor(frame / 3) % 2] : UNICORN;
      const c = Math.floor(frame / 3);
      const pal = { y: '#ffe066', Y: '#f59f00', M: manes[c % manes.length], N: manes[(c + 2) % manes.length], W: '#ffffff', w: '#e5dbff', p: '#f783ac', h: '#9775fa' };
      draw(ctx, u.x, u.y - (fast && frame % 2 ? 1 : 0), look, pal, u.dir < 0);
    },
  };
}

/** Golden aliens zip by in flying saucers, stop for a moment and flash a peace sign. */
function saucerLife(m) {
  let s = null;
  let next = 2000;
  return {
    step(t, view) {
      if (!s && t > next) {
        const dir = Math.random() < 0.5 ? 1 : -1;
        s = { dir, x: dir > 0 ? -34 : m.aw + 5, y: rand(view.top + 15, Math.max(view.top + 16, view.bottom - 40)), stopAt: rand(m.aw * 0.3, m.aw * 0.6), wait: 0, phase: 'in', t: 0 };
      }
      if (!s) return;
      s.t += 1;
      if (s.phase === 'in') {
        s.x += s.dir * 3;
        if ((s.dir > 0 && s.x > s.stopAt) || (s.dir < 0 && s.x < s.stopAt)) { s.phase = 'wave'; s.wait = Math.round(FPS * 2); }
      } else if (s.phase === 'wave') {
        s.wait -= 1;
        if (s.wait <= 0) s.phase = 'out';
      } else {
        s.x += s.dir * 4;
        s.y -= 0.6;
        if (s.x < -40 || s.x > m.aw + 40) { s = null; next = t + rand(9000, 16000); }
      }
    },
    draw(ctx, frame) {
      if (!s) return;
      const y = s.y + Math.round(Math.sin(s.t / 3));
      // a soft beam under the saucer while it hovers
      if (s.phase === 'wave') {
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#fff3bf';
        for (let k = 0; k < 16; k += 1) ctx.fillRect(s.x + 10 - k / 2, y + 14 + k, 10 + k, 1);
        ctx.globalAlpha = 1;
      }
      const lights = ['#ff6b6b', '#69db7c', '#74c0fc'];
      const L = lights[frame % 3];
      draw(ctx, s.x, y, SAUCER, { d: '#d0ebff', A: '#fcc419', e: '#ffffff', S: '#ffe066', s: '#fab005', o: '#e67700', L });
      if (s.phase === 'wave' && Math.floor(s.t / 3) % 2 === 0) {
        draw(ctx, s.x + 22, y - 10, PEACE, { g: '#ffd43b' });
        ctx.fillStyle = '#fff9db';
        ctx.fillRect(s.x + 30, y - 12, 1, 1);
        ctx.fillRect(s.x + 20, y - 12, 1, 1);
        ctx.fillRect(s.x + 29, y - 5, 1, 1);
      }
    },
  };
}


/**
 * Little crabs scuttle about the beach. Tap the sand and any crab that is fairly close runs over,
 * snapping its claws, for a couple of seconds, then wanders slowly back to its own spot.
 */
function crabLife(m) {
  const crabs = [];
  const shells = [{ r: '#fa5252', l: '#ff8787' }, { r: '#fd7e14', l: '#ffa94d' }, { r: '#e64980', l: '#f783ac' }];
  const n = Math.max(4, Math.floor(m.ah / 55));
  for (let i = 0; i < n; i += 1) {
    const spot = m.openSpot({ top: (i * m.ah) / n + 10, bottom: ((i + 1) * m.ah) / n - 10 });
    if (spot) crabs.push({ x: spot.x, y: spot.y, home: { ...spot }, tx: spot.x, ty: spot.y, rush: 0, rest: Math.floor(rand(0, 40)), pal: { ...shells[i % shells.length], e: '#ffffff' } });
  }
  const W = CRAB[0][0][0].length;
  const H = CRAB[0][0].length;
  const REACH = 75; // how far away a crab will notice a tap, in map pixels
  return {
    where: () => (crabs[0] ? { x: crabs[0].x + W / 2, y: crabs[0].y + H / 2 } : { x: m.aw / 2, y: 60 }),
    poke(x, y) {
      let any = false;
      // in the village the tap has to be on a crab (a tap on the sand walks the buddy)
      if (m.pokeNear && !crabs.some((c) => Math.hypot(c.x + W / 2 - x, c.y + H / 2 - y) < 14)) return false;
      for (const c of crabs) {
        if (Math.hypot(c.x + W / 2 - x, c.y + H / 2 - y) > REACH) continue;
        c.rush = Math.round(FPS * 2);
        // stop next to the tap, not all on top of each other
        c.tx = x - W / 2 + rand(-8, 8);
        c.ty = y - H / 2 + rand(-5, 5);
        any = true;
      }
      return any;
    },
    step() {
      // walk too close to a crab and it chases the buddy off (then waits a while before it does it again)
      const b = m.buddy?.();
      for (const c of crabs) {
        if (c.cool > 0) c.cool -= 1;
        if (!b) continue;
        if (c.chase > 0) {
          c.chase -= 1;
          c.tx = b.x - W / 2 + (c.x + W / 2 < b.x ? -6 : 6); c.ty = b.y - H + 1;
          if (c.chase === 0) { c.tx = c.home.x; c.ty = c.home.y; c.rest = 0; }
        } else if (!c.rush && !(c.cool > 0) && Math.hypot(c.x + W / 2 - b.x, c.y + H / 2 - (b.y - 3)) < 22) {
          if (m.flee?.(c.x + W / 2, c.y + H / 2)) { c.chase = Math.round(FPS * 2); c.cool = Math.round(FPS * 10); }
        }
      }
      for (const c of crabs) {
        if (c.chase > 0) {
          const dx = c.tx - c.x; const dy = c.ty - c.y; const d = Math.hypot(dx, dy);
          c.moving = d >= 0.5;
          if (d <= 3.2) { c.x = c.tx; c.y = c.ty; } else { c.x += (dx / d) * 3.2; c.y += (dy / d) * 3.2; }
          continue;
        }
        if (c.rush > 0) {
          c.rush -= 1;
          if (c.rush === 0) { c.tx = c.home.x; c.ty = c.home.y; c.rest = 0; } // and home again
        } else if (Math.hypot(c.tx - c.x, c.ty - c.y) < 0.5) {
          // potter about near home: a few steps sideways, a rest
          if (c.rest > 0) c.rest -= 1;
          else { c.tx = c.home.x + rand(-14, 14); c.ty = c.home.y + rand(-3, 3); c.rest = Math.floor(rand(20, 70)); }
        }
        const speed = c.rush > 0 ? 2.4 : 0.4;
        const dx = c.tx - c.x;
        const dy = c.ty - c.y;
        const d = Math.hypot(dx, dy);
        c.moving = d >= 0.5;
        if (d <= speed) { c.x = c.tx; c.y = c.ty; } else { c.x += (dx / d) * speed; c.y += (dy / d) * speed; }
      }
    },
    draw(ctx, frame) {
      for (const c of crabs) {
        const busy = c.rush > 0 || c.chase > 0;
        const legs = c.moving && (busy ? frame % 2 : Math.floor(frame / 2) % 2) ? 1 : 0;
        const snap = busy ? frame % 2 : Math.floor(frame / 8) % 4 === 0 ? 1 : 0;
        draw(ctx, c.x, c.y - (busy && frame % 2 ? 1 : 0), CRAB[legs][snap], c.pal);
        if (c.rush > 0 && !c.moving && frame % 2) {
          // snip snip
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(Math.round(c.x) - 1, Math.round(c.y) - 2, 1, 1);
          ctx.fillRect(Math.round(c.x) + W, Math.round(c.y) - 2, 1, 1);
        }
      }
    },
  };
}

// ---------- the rainforest ----------

// The sloth hangs under a vine, moving right: a fur, A shade, m face, e eye stripes, n nose, c claws.
const SLOTH_BODY = [
  '..c....c.....c....c',
  '..a....a.....a....a',
  '..aa...a.....aa...a',
  '...aa.aa......aa.aa',
  '....aaaaaaaaaaaaaaa',
  '...aaaaaaaaaaaaaaaaa',
  '..AaaaaaaaaaammmmmmA',
  '..AAaaaaaaaaammmmmmmm',
  '...AAAAaaaaaaeKemmeKe',
  '.......AAAAAAeeemmeee',
  '.............mmmnnmmm',
  '..............mKmmKm',
  '...............mKKm',
];
const SLOTH = sprite(SLOTH_BODY);
// the other two arms reach forward, hand over hand
const SLOTH_REACH = sprite(swap(SLOTH_BODY, 0, ['....c....c.....c....c', '....a....a.....a....a', '...aa....a.....aa...a', '...aa...aa.....aa..aa']));
// lets go with the front arm to wave (slowly)
export const SLOTH_WAVE = [
  sprite(swap(SLOTH_BODY, 0, ['..c....c.....c.......c', '..a....a.....a......a', '..aa...a.....aa....a', '...aa.aa......aa.aa'])),
  sprite(swap(SLOTH_BODY, 0, ['..c....c.....c', '..a....a.....a', '..aa...a.....aa.....ac', '...aa.aa......aa.aaa'])),
];

// The toucan flies right: b black, B its shine, W chest, e eye ring, O/o beak, y beak tip, r under the tail.
const TOUCAN_BODY = [
  '......bbbb',
  '....bbbbbbW',
  '..bbbbbbbWWeKOOOOO',
  '.bbbbbbbWWWWOOOOOOOy',
  'bbbBbbbbWWWWooooooy',
  'bbbbbbbbbWW',
  '.bbbbbbbbb',
  '..rr.bbb',
];
export const TOUCAN = sprite(TOUCAN_BODY);
// eyes wide and beak open: EEK
const TOUCAN_EEK = sprite(swap(TOUCAN_BODY, 1, ['....bbbbbeeW', '..bbbbbbbWeKeOOOOO', '.bbbbbbbWWeeeOOOO...', 'bbbBbbbbWWWWoooo', 'bbbbbbbbbWWooooo']));
// cross: a frown above the eye
const TOUCAN_CROSS = sprite(swap(TOUCAN_BODY, 0, ['......bbbbKK', '....bbbbbbbW']));
export const TOUCAN_WING_UP = sprite(['....bb', '..bbbb', '.bbbBb', 'bbbbb']);
export const TOUCAN_WING_DOWN = sprite(['bbbbb', '.bbbBb', '..bbbb', '....bb']);
const ANGRY = sprite(['rr.rr', 'r...r', '.....', 'r...r', 'rr.rr']);
const BANANA = sprite(['y', 'yy', '.yy', '.yyy', '..yyyg'], true);

// The monkey (front on): f fur, F shade, t face and hands, b belly.
const MONKEY_BODY = [
  '....ffff',
  '..ffffffff',
  '.tftttttft',
  '.tftKttKtft',
  '..fttttttf',
  '...ftFFtf',
  '....ffff',
  '..ffbbbbff',
  '.ff.bbbb.ff..f',
  '.t..bbbb..t...f',
  '...ffffff....f',
  '...ff..ff...f',
  '...tt..tt',
];
const MONKEY = sprite(MONKEY_BODY);
const MONKEY_EAT = sprite(swap(MONKEY_BODY, 7, ['..ffbbbbfft', '.ff.bbbb.f..f', '.t..bbbb.....f']));
// arm up, shaking a fist (two frames)
const MONKEY_FIST = [
  sprite(swap(MONKEY_BODY, 0, ['....ffff....t', '..ffffffff..f', '.tftttttft.f', '.tftKttKtftf', '..fttttttff', '...ftKKtf', '....ffff', '..ffbbbbf', '.ff.bbbb.....f', '.t..bbbb......f'])),
  sprite(swap(MONKEY_BODY, 0, ['....ffff...t', '..ffffffff.f', '.tftttttftf', '.tftKttKtff', '..fttttttf', '...ftKKtf', '....ffff', '..ffbbbbf', '.ff.bbbb.....f', '.t..bbbb......f'])),
];
const MONKEY_RUN = [
  sprite(swap(MONKEY_BODY, 10, ['...ffffff....f', '..ff....ff..f', '..tt.....tt'])),
  sprite(swap(MONKEY_BODY, 10, ['...ffffff....f', '....ff.ff...f', '....tt.tt'])),
];
// both arms up: hooray (or hiding under the leaf with a shiver)
const MONKEY_YAY = sprite(swap(MONKEY_BODY, 0, ['t...ffff...t', 'f.ffffffff.f', 'ftftttttftf', '.tftKttKtf', '..fttttttf', '...fttttf', '....ffff', '...fbbbbf', '....bbbb.....f', '....bbbb......f']));
// dancing (and singing) in the rain: one arm up, both up, the other arm up
export const MONKEY_DANCE = [
  sprite(swap(MONKEY_BODY, 0, ['t...ffff', 'f.ffffffff', 'ftftttttft', '.tftKttKtft', '..fttttttf', '...ftFFtf', '....ffff', '...fbbbbff', '....bbbb.ff..f', '....bbbb..t...f'])),
  sprite(swap(MONKEY_BODY, 0, ['t...ffff...t', 'f.ffffffff.f', 'ftftttttftf', '.tftKttKtf', '..fttttttf', '...ftFFtf', '....ffff', '...fbbbbf', '....bbbb.....f', '....bbbb......f'])),
  sprite(swap(MONKEY_BODY, 0, ['....ffff...t', '..ffffffff.f', '.tftttttftf', '.tftKttKtf', '..fttttttf', '...ftFFtf', '....ffff', '..ffbbbbf', '.ff.bbbb.....f', '.t..bbbb......f'])),
];
// a music note: s stem
export const NOTE = sprite(['.ss', '.s.s', '.s', 'ss', 'ss']);

// The jaguar lies down facing right: y coat, Y shade, s spots, l light belly, e eye, n nose.
const JAGUAR_BODY = [
  '.................yy.yy',
  '................yyyyyyy',
  '................yyesyyesy',
  '................yyKyyyKyyy',
  '.yy..ysyyysyyysyyyyyynnyy',
  'y.y.yyyyyyyyyyyyyyyyylly',
  'y..yysyysyyysyyysyyyyyy',
  '.yyyyyyyyyyyyyyyyyyyy',
  '....YYllllllllYYlllyyy',
  '...YYY.......YYY..llll',
];
// asleep: eyes shut
export const JAGUAR = sprite(JAGUAR_BODY);
const JAGUAR_SLEEP = sprite(swap(JAGUAR_BODY, 2, ['................yyyyyyyyyy', '................yyKKyyKKyy']));
const JAGUAR_TAIL = sprite(swap(JAGUAR_BODY, 4, ['yyy..ysyyysyyysyyyyyynnyy', '..yyyyyyyyyyyyyyyyyyylly', '...yysyysyyysyyysyyyyyy']));
// sitting up under a big leaf: g leaf, G its vein, T stem
const JAGUAR_SIT = sprite([
  '....yy.yy',
  '....yyyyyy',
  '...yyesyyesy',
  '...yyKyyyKyy',
  '...yyyynnyyy',
  '....yyllyyy',
  '.....yyyyy',
  '....ysyyysy.y',
  '...yyyyyyyyyy',
  '...ysyyllysyy',
  '..yyyyllllyy',
  '.yy.yyllllyy',
  'y...lll..lll',
]);
const LEAF = sprite([
  '.........gggggg',
  '.....gggggggggggg',
  '...ggggggGGgggggggg',
  '.gggGGGGgggGGGGggggg',
  'ggGGgggggggggggGGggg',
  'gg.......T.......gg',
  '.........T',
  '.........T',
  '.........T',
]);

// Things that come over the waterfall: a log, a coconut, a capybara in a rubber ring.
const LOG = [sprite(['bbbbbbbbbbbB', 'BbBbbbBbbbbB', 'bbbbbbbbbbbB']), sprite(['bbB', 'bbB', 'bBb', 'bbB', 'bbB', 'Bbb', 'bbB'])];
const COCONUT = sprite(['.cc.', 'cKcc', 'cccc', '.cc.']);
// c fur, C shade, n nose, e eye, r/w the ring
const CAPY_BODY = [
  '......cc.cc',
  '.....ccccccc',
  '....cccKcccccc',
  '....cccccccnnn',
  '.....ccccccnnn',
  '..rrwwrrrwwrr',
  '.rrwwrrrwwrrrr',
  '..rrwwrrrwwrr',
];
export const CAPY_CALM = sprite(CAPY_BODY);
const CAPY_EEK = sprite(swap(CAPY_BODY, 1, ['.....cceeccc', '....cceKeccccc', '....cceeecccnn', '.....cccccccKn']));
const CAPY_FALL = sprite(['....c.cc.cc.c', '...c.ccccccc.c', '....cceKeccccc', '....cceeecccnn', '.....ccccccccK', '..rrwwrrrwwrr', '.rrwwrrrwwrrrr', '..rrwwrrrwwrr']);

/**
 * Where the rainforest waterfall is, in map pixels: it pours out of the forest wall on one side
 * into the river, and whatever comes over it floats off down the river (maparts.js paints the rock).
 * band: the river (see drawRiver in maparts.js), side: -1 left wall, 1 right wall.
 */
export function waterfallAt(band, wall, side) {
  const { aw } = band;
  const x0 = side < 0 ? wall - 3 : aw - wall - 6;
  const riverY = band.wave(x0) ;
  return { side, x0, x1: x0 + 9, lip: riverY - 34, base: riverY - 2, dir: -side, aw, wave: band.wave, bridge: [band.bx0, band.bx1] };
}

/**
 * The rainforest: a sloth takes a whole minute to cross on a vine (tap it for a slow wave), a toucan
 * steals the monkey's banana (tap it to make it drop it), a rain shower sends everyone under the
 * jaguar's leaf, and now and then something comes over the waterfall.
 */
/**
 * The village's vines: thick twisted lianas slung across the jungle, leafy, with strands and the odd
 * flower hanging from them and their shadow on the floor. Drawn once onto a canvas of their own.
 */
function lianas(aw, ah, vines, vineY) {
  const c = document.createElement('canvas'); c.width = aw; c.height = ah;
  const g = c.getContext('2d');
  const px = (x, y, col) => { g.fillStyle = col; g.fillRect(x, y, 1, 1); };
  const hash = (a, b) => { const v = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return v - Math.floor(v); };
  const LEAF = ['#1f5a2a', '#2f7a32', '#4fa83a', '#8fd45a'];
  const leaf = (x, y, dir, k) => {
    // a little pointed leaf, hanging down to one side
    const pts = [[0, 0, 1], [dir, 0, 2], [0, 1, 1], [dir, 1, 2], [dir * 2, 1, 2], [dir, 2, 1], [dir * 2, 2, 1]];
    for (const [dx, dy, i] of pts) px(x + dx, y + dy, LEAF[i + (k > 0.6 ? 1 : 0)]);
    px(x + dir * 3, y + 3, LEAF[0]);
  };
  for (const v of vines) {
    // its shadow on the floor, below and to the right
    g.fillStyle = 'rgba(8,16,20,0.2)';
    for (let x = 0; x < aw; x += 1) g.fillRect(x + 3, vineY(v, x) + 6, 1, 2);
  }
  for (const v of vines) {
    for (let x = 0; x < aw; x += 1) {
      const y = vineY(v, x);
      // two strands twisted round each other
      const seg = Math.floor((x + v) / 4) % 2;
      px(x, y - 1, '#2a2a1a');
      px(x, y, seg ? '#a08a48' : '#7a6830');
      px(x, y + 1, seg ? '#5a4a22' : '#7a6830');
      px(x, y + 2, '#22201a');
      if ((x + v) % 4 === 0) { px(x, y, '#5a4a22'); px(x, y + 1, '#a08a48'); }
    }
    // leaves along it, and now and then a strand hanging down with leaves and a flower
    for (let x = 2; x < aw - 4; x += 5 + Math.floor(hash(x, v) * 5)) {
      const k = hash(v, x); const y = vineY(v, x);
      if (k < 0.5) leaf(x, y + 2, k < 0.25 ? 1 : -1, hash(x, 3));
      else leaf(x, y - 3, k < 0.75 ? 1 : -1, hash(x, 4));
    }
    for (let x = 20 + Math.floor(hash(v, 1) * 30); x < aw - 10; x += 34 + Math.floor(hash(x, v) * 40)) {
      const len = 5 + Math.floor(hash(x, v + 1) * 12); const y0 = vineY(v, x) + 2;
      for (let k = 0; k < len; k += 1) {
        const sx = x + Math.round(Math.sin(k / 3 + x) * 0.7);
        px(sx, y0 + k, k % 5 === 4 ? '#2f7a32' : '#5a6a2a');
        if (k % 4 === 2) leaf(sx, y0 + k, k % 8 === 2 ? 1 : -1, hash(x, k));
      }
      if (hash(x, 9) > 0.55) {
        const fc = hash(x, 10) > 0.5 ? ['#ff6a8a', '#ffd0dc'] : ['#ff9a3a', '#ffe08a'];
        const fy = y0 + len;
        px(x - 1, fy, fc[0]); px(x + 1, fy, fc[0]); px(x, fy + 1, fc[0]); px(x, fy - 1, fc[0]); px(x, fy, fc[1]);
      }
    }
  }
  return c;
}

function jungleLife(m) {
  let fall = m.falls;
  // vines to hang from, kept clear of the river and the waterfall
  const vines = m.vines ? [...m.vines] : [];
  if (!m.vines) for (let y = 84; y < m.ah - 60; y += 230) {
    const yy = fall && Math.abs(y - fall.base) < 60 ? fall.base + (y < fall.base ? -60 : 60) : y;
    if (yy > 60 && yy < m.ah - 60) vines.push(yy);
  }
  if (!vines.length) vines.push(Math.round(m.ah / 3));
  const vineY = (v, x) => v + Math.round(Math.sin((Math.PI * Math.max(0, Math.min(m.aw, x))) / m.aw) * 7);
  const SW = SLOTH[0].length;
  const TW = TOUCAN[0].length;
  const JW = JAGUAR[0].length;
  const MW = MONKEY[0].length;
  const MH = MONKEY.length;
  // the jaguar naps near the top of the map, and the monkey lives nearby
  // between the first vine and the next (clear of the sloth)
  const jag = { ...(m.openSpot({ top: vines[0] + 26, bottom: Math.min(m.ah - 40, vines[0] + 120) }) || { x: m.wall + 4, y: vines[0] + 30 }), mode: 'nap', t: 0 };
  const mHome = m.openSpot({ top: Math.max(vines[0] + 22, jag.y - 30), bottom: jag.y + 50 }) || { x: Math.min(m.aw - m.wall - 16, jag.x + 30), y: jag.y + 4 };
  const monkey = { x: mHome.x, y: mHome.y, home: mHome, mode: 'eat', t: 0, dir: 1, banana: true };
  const s = {
    sloth: null, nextSloth: 600,
    toucan: null, nextToucan: 6000, banana: null,
    rain: null, nextRain: 40000, drops: [], splash: [],
    things: [], nextThing: 2500, capyOdds: 0.3,
  };
  const MONKEY_FURS = [{ f: '#8b5a2b', F: '#e8590c', t: '#f1c27d', b: '#d9a066' }, { f: '#6e4b2a', F: '#e8590c', t: '#e9b97a', b: '#c8935a' }, { f: '#a0612f', F: '#e8590c', t: '#f6d09a', b: '#e2ae72' }];
  const pal = {
    sloth: { a: '#a68a64', A: '#7f6545', m: '#d8bf94', e: '#4a3220', n: '#3b2a1a', c: '#3b2a1a' },
    toucan: { b: '#22223b', B: '#4a4e69', W: '#fff3bf', e: '#4dabf7', O: '#ff922b', o: '#fcc419', y: '#e03131', r: '#e03131' },
    angry: { b: '#22223b', B: '#4a4e69', W: '#fff3bf', e: '#ff6b6b', O: '#ff922b', o: '#fcc419', y: '#e03131', r: '#e03131' },
    monkey: { f: '#8b5a2b', F: '#e8590c', t: '#f1c27d', b: '#d9a066' },
    jaguar: { y: '#f2a93b', Y: '#c47a1e', s: '#5c3a1e', l: '#fff3d6', e: '#ffe066', n: '#3b2a1a', g: '#8ce99a', G: '#2f9e44', T: '#2f9e44' },
    banana: { y: '#ffe066', g: '#5c940d' },
    log: { b: '#8b5a2b', B: '#5c3a1e' },
    coconut: { c: '#7a4a26' },
    capy: { c: '#b07443', C: '#8b5a2b', n: '#5c3a1e', e: '#ffffff', r: '#ff6b6b', w: '#ffffff' },
  };
  const toward = (o, tx, ty, speed) => {
    const dx = tx - o.x; const dy = ty - o.y; const d = Math.hypot(dx, dy);
    if (d <= speed) { o.x = tx; o.y = ty; return true; }
    o.x += (dx / d) * speed; o.y += (dy / d) * speed;
    if (Math.abs(dx) > 0.5) o.dir = dx > 0 ? 1 : -1;
    return false;
  };
  const monkeyTo = (mode) => { monkey.mode = mode; monkey.t = 0; };
  const busy = () => s.toucan || s.rain;

  const stepSloth = (t, view) => {
    if (!s.sloth && t > s.nextSloth) {
      const mid = (view.top + view.bottom) / 2;
      const v = vines.reduce((a, b) => (Math.abs(b - mid) < Math.abs(a - mid) ? b : a), vines[0]);
      const dir = (s.lastDir || -1) * -1;
      s.lastDir = dir;
      s.sloth = { x: dir > 0 ? -SW : m.aw, v, dir, wave: 0, reach: 0 };
    }
    const k = s.sloth;
    if (!k) return;
    if (k.wave > 0) { k.wave -= 1; return; }
    // about a minute to get across, one slow hand at a time
    k.reach += 1;
    k.x += k.dir * ((m.aw + SW) / (FPS * 60)) * (Math.floor(k.reach / 15) % 2 ? 1.6 : 0.4);
    if (k.x < -SW - 2 || k.x > m.aw + 2) { s.sloth = null; s.nextSloth = t + rand(12000, 25000); }
  };

  const stepToucan = (t, view) => {
    if (!busy() && t > s.nextToucan && monkey.mode === 'eat') {
      const dir = monkey.x > m.aw / 2 ? -1 : 1;
      const y = Math.max(view.top + 6, monkey.y - 50);
      s.toucan = { x: dir > 0 ? -TW - 4 : m.aw + 4, y, dir, phase: 'in', t: 0, banana: false };
    }
    const c = s.toucan;
    if (!c) return;
    c.t += 1;
    const beak = () => ({ x: c.dir > 0 ? c.x + TW - 4 : c.x + 1, y: c.y + 6 });
    if (c.phase === 'in') {
      // swoop down to the banana in the monkey's hand
      const tx = c.dir > 0 ? monkey.x + MW - TW : monkey.x - 1;
      if (toward(c, tx, monkey.y + 2, 2.4)) {
        c.phase = 'away'; c.banana = true; c.t = 0; c.base = c.y;
        monkey.banana = false; monkeyTo('shock');
      }
      c.dir = c.dir || 1;
    } else if (c.phase === 'away') {
      // off it goes with the banana, not too fast, so there is time to tap it
      c.x += c.dir * 1.2;
      c.y = c.base - Math.min(28, c.t * 0.6) + Math.sin(c.t / 3) * 2;
    } else if (c.phase === 'eek') {
      if (c.t > 14) { c.phase = 'cross'; c.t = 0; c.dir = -c.dir; }
    } else if (c.phase === 'cross') {
      // flaps off in a huff
      c.x += c.dir * 2.6; c.y -= 0.9;
    }
    if (c.x < -TW - 30 || c.x > m.aw + 30 || c.y < -30) {
      if (c.banana) monkeyTo('sulk');
      s.toucan = null; s.nextToucan = t + rand(25000, 40000);
    }
    c.beak = beak();
  };

  const stepMonkey = () => {
    monkey.t += 1;
    const c = s.toucan;
    if (s.rain && ['eat', 'home', 'sulk'].includes(monkey.mode)) monkeyTo('dance');
    switch (monkey.mode) {
      case 'shock': if (monkey.t > 10) monkeyTo('chase'); break;
      case 'chase':
        // runs after the toucan, shaking a fist
        if (c && c.banana) toward(monkey, Math.max(m.wall, Math.min(m.aw - m.wall - MW, c.x + TW / 2 - MW / 2)), monkey.home.y, 1.3);
        else if (!c) monkeyTo('sulk');
        break;
      case 'sulk': if (monkey.t > 30) monkeyTo('home'); break;
      case 'fetch':
        // to the dropped banana, then a little dance
        if (s.banana && !s.banana.landed) break;
        if (s.banana && toward(monkey, s.banana.x - 3, s.banana.y - MH + 4, 1.8)) { s.banana = null; monkey.banana = true; monkeyTo('yay'); }
        break;
      case 'yay': if (monkey.t > 30) monkeyTo('home'); break;
      case 'home':
        if (toward(monkey, monkey.home.x, monkey.home.y, 0.8)) {
          if (!monkey.banana && monkey.t > 60) monkey.banana = true; // finds another one
          if (monkey.banana) monkeyTo('eat');
        }
        break;
      case 'dance':
        // home first, then dance (and sing) until the rain stops
        if (!s.rain) { monkeyTo('home'); break; }
        toward(monkey, monkey.home.x, monkey.home.y, 1.5);
        break;
      default: break;
    }
    monkey.moving = ['chase', 'home', 'fetch', 'dance'].includes(monkey.mode);
  };

  const stepRain = (t, view) => {
    if (!s.rain && !s.toucan && t > s.nextRain) {
      s.rain = { t: 0, len: Math.round(FPS * 10) };
      sounds.thunder();
      // a troupe of monkeys swings into the trees on both sides, near where the kid is looking
      const n = m.aw > 140 ? 3 : 2;
      const mid = Math.max(view.top + 40, Math.min(view.bottom - 50, monkey.home.y));
      s.troupe = [];
      for (const side of [-1, 1]) {
        for (let i = 0; i < n; i += 1) {
          const x = side < 0 ? Math.max(1, Math.round(m.wall / 2) - 7) : Math.min(m.aw - 15, m.aw - Math.round(m.wall / 2) - 7);
          const y = Math.round(mid + (i - (n - 1) / 2) * 34 + (side < 0 ? 0 : 12));
          s.troupe.push({ side, x: side < 0 ? -18 - i * 10 : m.aw + 4 + i * 10, y, tx: x, out: side < 0 ? -20 : m.aw + 6, fur: MONKEY_FURS[(i * 2 + (side > 0 ? 1 : 0)) % MONKEY_FURS.length] });
        }
      }
    }
    for (const k of s.troupe || []) {
      const dest = s.rain ? k.tx : k.out;
      k.moving = Math.abs(dest - k.x) > 0.5;
      if (k.moving) k.x += Math.sign(dest - k.x) * Math.min(2.2, Math.abs(dest - k.x));
    }
    if (!s.rain && s.troupe?.every((k) => !k.moving)) s.troupe = null;
    const r = s.rain;
    jag.t += 1;
    if (r) {
      r.t += 1;
      if (jag.mode === 'nap' && r.t > 6) { jag.mode = 'leaf'; jag.t = 0; }
      const k = Math.min(1, r.t / 10, (r.len - r.t) / 10);
      r.k = Math.max(0, k);
      for (let i = 0; i < 9 * r.k; i += 1) s.drops.push({ x: rand(-10, m.aw), y: rand(view.top - 10, view.bottom), life: Math.floor(rand(3, 6)) });
      setRain(r.k);
      duckMusic(r.k);
      // the monkeys sing along: ooh ooh aah aah
      if (r.t % 48 === 14) sounds.monkeys();
      if (r.t >= r.len) { s.rain = null; setRain(0); duckMusic(0); s.nextRain = t + rand(80000, 140000); jag.mode = 'shake'; jag.t = 0; }
    } else if (jag.mode === 'shake' && jag.t > 14) { jag.mode = 'nap'; jag.t = 0; }
    for (const d of s.drops) { d.x += 1; d.y += 5; d.life -= 1; if (d.life === 0) s.splash.push({ x: d.x, y: d.y, life: 3 }); }
    for (const p of s.splash) p.life -= 1;
    s.drops = s.drops.filter((d) => d.life > 0);
    s.splash = s.splash.filter((p) => p.life > 0);
  };

  const underBridge = (o) => fall && (fall.under ? fall.under(o.x + 6, o.y + 5) : o.x + 12 > fall.bridge[0] && o.x < fall.bridge[1]);
  const stepFalls = (t) => {
    if (!fall) return;
    if (t > s.nextThing) {
      s.nextThing = t + rand(6000, 12000);
      const capy = Math.random() < s.capyOdds;
      s.capyOdds = capy ? 0.15 : Math.min(0.5, s.capyOdds + 0.1);
      const kind = capy ? 'capy' : Math.random() < 0.6 ? 'log' : 'coconut';
      s.things.push({ kind, x: (fall.x0 + fall.x1) / 2 - 6, y: fall.lip - 6, vy: 0.3, phase: 'fall', t: 0 });
    }
    for (const o of s.things) {
      o.t += 1;
      if (o.phase === 'fall') {
        o.vy += 0.22; o.y += o.vy;
        if (o.y >= fall.base - 6) {
          o.phase = 'float'; o.t = 0;
          for (let i = 0; i < 10; i += 1) s.splash.push({ x: o.x + 6 + rand(-6, 6), y: fall.base - rand(0, 6), life: Math.floor(rand(3, 8)), big: true });
        }
      } else {
        // bob along down the river, under the bridge and away
        const wait = o.kind === 'capy' ? 16 : 0;
        const speed = o.t > wait ? (o.kind === 'capy' ? 0.3 : 0.4) : 0;
        if (fall.along) {
          // a river that winds down the village: follow it, by distance from the foot of the falls
          o.s = (o.s || 0) + speed;
          const p = fall.along(o.s);
          if (p) { o.x = p.x - 6; o.y = p.y - 5; } else o.gone = true;
        } else {
          o.x += fall.dir * speed;
          o.y = fall.wave(o.x + 6) - 5;
        }
      }
    }
    s.things = s.things.filter((o) => !o.gone && o.x > -20 && o.x < m.aw + 6);
  };

  // one dance for everyone, on the beat of the song (about 6 frames a beat): left, both, right, both
  const danceAt = (frame) => {
    const beat = Math.floor(frame / 6) % 4;
    return { look: MONKEY_DANCE[[0, 1, 2, 1][beat]], hop: beat % 2 && frame % 6 < 3 ? -2 : 0 };
  };

  const flow = (ctx, frame) => {
    if (!fall) return;
    // the falling water, streaking down, and foam where it lands
    for (let x = fall.x0; x <= fall.x1; x += 1) {
      for (let y = fall.lip + ((frame * 3 + x * 5) % 9); y < fall.base - 2; y += 9) {
        ctx.fillStyle = x % 3 ? '#e7f5ff' : '#ffffff';
        ctx.fillRect(x, y, 1, 3);
      }
    }
    const foam = Math.max(5, Math.round((fall.x1 - fall.x0) / 2.2) + 1);
    for (let i = 0; i < foam; i += 1) puff(ctx, fall.x0 + 0.5 + i * 2.2, fall.base - 1 + ((frame + i) % 3 === 0 ? -1 : 0), 1.4 + ((frame + i) % 2) * 0.5, '#ffffff');
  };

  return {
    s, jag, monkey, fall, vines,
    // off the map (or the app hidden): the rain goes quiet; the next step brings it back if it is still raining
    quiet() { setRain(0); duckMusic(0); },
    where: () => (s.toucan ? { x: s.toucan.x + TW / 2, y: s.toucan.y + 4 } : s.sloth ? { x: s.sloth.x + SW / 2, y: vineY(s.sloth.v, s.sloth.x) + 6 } : { x: monkey.x, y: monkey.y }),
    poke(x, y) {
      const c = s.toucan;
      const pad = 8;
      if (c && c.banana && c.phase === 'away' && x > c.x - pad && x < c.x + TW + pad && y > c.y - pad && y < c.y + 10 + pad) {
        // EEK! It drops the banana, and the monkey runs to get it
        c.phase = 'eek'; c.t = 0; c.banana = false;
        sounds.squeak?.();
        s.banana = { x: c.beak.x, y: c.beak.y, vy: 0, ground: monkey.home.y + MH - 5, landed: false };
        monkeyTo('fetch');
        return true;
      }
      const k = s.sloth;
      if (k && !k.wave) {
        const ky = vineY(k.v, k.x + SW / 2);
        if (x > k.x - 6 && x < k.x + SW + 6 && y > ky - 6 && y < ky + 20) { k.wave = Math.round(FPS * 6); return true; }
      }
      return false;
    },
    step(t, view) {
      fall = m.falls; // the map may have been redrawn at a new size
      stepSloth(t, view);
      stepToucan(t, view);
      stepMonkey();
      stepRain(t, view);
      stepFalls(t);
      const b = s.banana;
      if (b && !b.landed) { b.vy += 0.3; b.y += b.vy; if (b.y >= b.ground) { b.y = b.ground; b.landed = true; } }
    },
    draw(ctx, frame) {
      // vines across the map, with leaves (the village's are leafy lianas, drawn once)
      if (m.vines) {
        if (!s.lianas || s.lianas.width !== m.aw || s.lianas.height !== m.ah) s.lianas = lianas(m.aw, m.ah, vines, vineY);
        ctx.drawImage(s.lianas, 0, 0, m.aw, m.ah);
      } else for (const v of vines) {
        for (let x = 0; x < m.aw; x += 1) {
          const y = vineY(v, x);
          ctx.fillStyle = OUT; ctx.fillRect(x, y - 1, 1, 3);
          ctx.fillStyle = '#5c940d'; ctx.fillRect(x, y, 1, 1);
          if (x % 9 === 4) { ctx.fillStyle = '#2b8a3e'; ctx.fillRect(x, y + 1, 2, 2); ctx.fillStyle = '#69db7c'; ctx.fillRect(x, y + 1, 1, 1); }
        }
      }
      flow(ctx, frame);
      for (const o of s.things) {
        if (o.phase !== 'fall' && underBridge(o)) continue;
        const bob = o.phase === 'fall' ? 0 : Math.round(Math.sin((o.t + o.x) / 4));
        if (o.kind === 'log') draw(ctx, o.x, o.y + bob + (o.phase === 'fall' && Math.floor(o.t / 3) % 2 ? -2 : 0), o.phase === 'fall' && Math.floor(o.t / 3) % 2 ? LOG[1] : LOG[0], pal.log);
        else if (o.kind === 'coconut') draw(ctx, o.x + 4, o.y + 2 + bob, COCONUT, pal.coconut);
        else {
          const eek = o.phase === 'fall' || o.t < 22;
          draw(ctx, o.x, o.y - 3 + bob, o.phase === 'fall' ? CAPY_FALL : eek ? CAPY_EEK : CAPY_CALM, pal.capy, fall.dir < 0);
          if (eek && frame % 4 < 3) draw(ctx, o.x + 6, o.y - 12 + bob, BANG2, { y: '#ffe066' });
        }
      }
      // the jaguar: napping, under its leaf in the rain, or shaking itself dry
      if (jag.mode === 'leaf') {
        draw(ctx, jag.x + 6, jag.y - 4, JAGUAR_SIT, pal.jaguar);
        draw(ctx, jag.x - 1, jag.y - 14 + (frame % 8 < 4 ? 0 : -1), LEAF, pal.jaguar);
      } else {
        const shake = jag.mode === 'shake' ? (frame % 2 ? 1 : -1) : 0;
        draw(ctx, jag.x + shake, jag.y + 5, jag.mode === 'shake' ? JAGUAR : Math.floor(frame / 10) % 3 === 0 ? JAGUAR_TAIL : JAGUAR_SLEEP, pal.jaguar);
        if (jag.mode === 'shake') for (let i = 0; i < 6; i += 1) { ctx.fillStyle = '#a5d8ff'; ctx.fillRect(jag.x + 2 + i * 4 + (frame % 3), jag.y + 2 - ((i + frame) % 4), 1, 1); }
        else if (frame % 30 < 20) { ctx.fillStyle = '#ffffff'; ctx.fillRect(jag.x + JW - 1 + Math.floor((frame % 30) / 7), jag.y - 2 - Math.floor((frame % 30) / 7) * 2, 2, 1); } // z z z
      }
      // the monkey
      const mk = monkey;
      const run = mk.moving && Math.hypot(mk.x - mk.home.x, mk.y - mk.home.y) > 0.5;
      let look = MONKEY;
      let hop = 0;
      if (mk.mode === 'eat') look = Math.floor(frame / 6) % 3 === 0 ? MONKEY_EAT : MONKEY;
      else if (mk.mode === 'shock') { look = MONKEY_YAY; hop = -2; }
      else if (mk.mode === 'chase' || mk.mode === 'sulk') { look = MONKEY_FIST[frame % 2]; hop = mk.mode === 'sulk' && frame % 4 < 2 ? -1 : 0; }
      else if (mk.mode === 'yay') { look = MONKEY_YAY; hop = frame % 4 < 2 ? -2 : 0; }
      else if (mk.mode === 'dance' && !run) { const d = danceAt(frame); look = d.look; hop = d.hop; }
      else if (run) look = MONKEY_RUN[frame % 2];
      const mx = mk.x;
      draw(ctx, mx, mk.y + hop, look, pal.monkey);
      if (mk.banana && (mk.mode === 'eat' || mk.mode === 'yay' || mk.mode === 'home')) {
        const up = mk.mode === 'yay' || (mk.mode === 'eat' && look === MONKEY_EAT);
        draw(ctx, mx + (up ? 9 : 9), mk.y + hop + (up ? (mk.mode === 'yay' ? -6 : 4) : 8), BANANA, pal.banana);
      }
      if (mk.mode === 'shock' || (mk.mode === 'chase' && frame % 6 < 3)) draw(ctx, mx + 5, mk.y - 8, BANG2, { y: '#ffe066' });
      if (mk.mode === 'dance' && !run) {
        // singing: notes float up and away
        for (let i = 0; i < 3; i += 1) {
          const a = (frame + i * 9) % 27;
          draw(ctx, mx + 10 + Math.round(Math.sin((a + i) / 3) * 2) + i * 2, mk.y - 4 - a * 0.7, NOTE, { s: ['#ffe066', '#ffffff', '#ff8fa3'][i] });
        }
      }
      // the troupe in the trees, all dancing the same steps
      for (const k of s.troupe || []) {
        if (k.moving) { draw(ctx, k.x, k.y - (frame % 2 ? 2 : 0), MONKEY_RUN[frame % 2], k.fur); continue; }
        const d = danceAt(frame);
        draw(ctx, k.x, k.y + d.hop, d.look, k.fur);
      }
      if (s.banana) draw(ctx, s.banana.x, s.banana.y, BANANA, pal.banana);
      // the sloth
      const k = s.sloth;
      if (k) {
        const ky = vineY(k.v, k.x + SW / 2) - 1;
        let look2 = Math.floor(k.reach / 15) % 2 ? SLOTH_REACH : SLOTH;
        if (k.wave > 0) look2 = SLOTH_WAVE[Math.floor(k.wave / 8) % 2];
        draw(ctx, k.x, ky, look2, pal.sloth, k.dir < 0);
        if (s.rain) for (let i = 0; i < 3; i += 1) { ctx.fillStyle = '#a5d8ff'; ctx.fillRect(k.x + 4 + i * 7, ky + 14 + ((frame + i * 3) % 6), 1, 2); }
      }
      // the toucan
      const c = s.toucan;
      if (c) {
        const flip = c.dir < 0;
        const fast = c.phase === 'cross' || c.phase === 'in';
        const up = fast ? frame % 2 : frame % 4 < 2;
        const p = c.phase === 'cross' ? pal.angry : pal.toucan;
        const body = c.phase === 'eek' ? TOUCAN_EEK : c.phase === 'cross' ? TOUCAN_CROSS : TOUCAN;
        const jx = c.phase === 'eek' ? (frame % 2 ? 1 : -1) : 0;
        if (up) draw(ctx, partX(c.x + jx, TW, 3, TOUCAN_WING_UP, flip), c.y - 4, TOUCAN_WING_UP, p, flip);
        draw(ctx, c.x + jx, c.y, body, p, flip);
        if (!up) draw(ctx, partX(c.x + jx, TW, 3, TOUCAN_WING_DOWN, flip), c.y + 5, TOUCAN_WING_DOWN, p, flip);
        if (c.banana) draw(ctx, flip ? c.x - 1 : c.x + TW - 6, c.y + 5, BANANA, pal.banana, flip);
        if (c.phase === 'eek') draw(ctx, c.x + TW / 2, c.y - 9, BANG2, { y: '#ffe066' });
        if (c.phase === 'cross' && c.t < 30) {
          // a cross little mark over its head
          if (frame % 4 < 3) draw(ctx, c.x + TW / 2 - 2, c.y - 9, ANGRY, { r: '#ff6b6b' });
        }
      }
      // the rain, over everything
      if (s.rain) {
        ctx.globalAlpha = 0.22 * s.rain.k;
        ctx.fillStyle = '#1c3d5a';
        ctx.fillRect(0, 0, m.aw, m.ah);
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#d0ebff';
        for (const d of s.drops) { ctx.fillRect(Math.round(d.x), Math.round(d.y), 1, 3); ctx.fillRect(Math.round(d.x) + 1, Math.round(d.y) + 3, 1, 1); }
      }
      for (const p of s.splash) {
        ctx.fillStyle = p.big ? '#ffffff' : '#a5d8ff';
        ctx.fillRect(Math.round(p.x) - 1, Math.round(p.y) - (p.big ? 3 - p.life / 3 : 0), 1, 1);
        ctx.fillRect(Math.round(p.x) + 1, Math.round(p.y) - (p.big ? 3 - p.life / 3 : 0), 1, 1);
      }
    },
  };
}

const LIVES = { jungle: jungleLife, crab: crabLife, fish: fishLife, space: spaceLife, volcano: volcanoLife, castle: castleLife, unicorn: unicornLife, saucer: saucerLife };
const running = new WeakMap();
// The screen is redrawn whenever family sync brings news, which makes a new map each time.
// Keep each kid's moving things (and their clock) across redraws, so a fish that is halfway
// across keeps swimming instead of starting over off the edge.
const kept = new Map();

/**
 * Start the moving things for a painted map.
 * m: { section, aw, ah, scale, life, wall, goal: {x, y}, knightPost: {x, y, side}, openSpot({top, bottom}) }
 */
export function startMapLife(m) {
  const old = running.get(m.section);
  if (old) clearInterval(old);
  // the village brings its own canvas (m.canvas) and says what the kid can see (m.view)
  let canvas = m.canvas || m.section.querySelector('canvas.map-life');
  if (!LIVES[m.life]) { if (!m.canvas) canvas?.remove(); return; }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'map-life';
    canvas.setAttribute('aria-hidden', 'true');
    m.section.querySelector('canvas.map-land').after(canvas);
  }
  // twice the map's pixels, like the land: sprites are drawn with half-size pixels
  const Z = m.z || 1;
  canvas.width = m.aw * Z;
  canvas.height = m.ah * Z;
  if (!m.canvas) {
    canvas.style.width = `${m.aw * m.scale}px`;
    canvas.style.height = `${m.ah * m.scale}px`;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(Z, 0, 0, Z, 0, 0);
  ctx.fine = Z;
  const key = m.key || `${m.section.dataset.seed || ''}|${m.life}`;
  let keep = kept.get(key);
  if (keep) {
    Object.assign(keep.geo, m); // the actors read the map's size and spots from here
  } else {
    const geo = { ...m };
    keep = { geo, actor: LIVES[m.life](geo), t0: performance.now(), frame: 0, last: -Infinity };
    kept.set(key, keep);
  }
  const { actor, t0 } = keep;
  m.section.mapLife = actor; // lets the preview script find the unicorn
  const view = m.view || (() => {
    const r = m.section.getBoundingClientRect();
    const top = Math.max(0, -r.top) / m.scale;
    const bottom = Math.min(r.height, (window.innerHeight || r.height) - r.top) / m.scale;
    return bottom > top + 30 ? { top, bottom } : { top: 0, bottom: m.ah };
  });
  if (actor.poke) {
    // the village's view handles its own taps, so it listens on the way down (m.host, capture)
    (m.host || m.section).addEventListener('click', (e) => {
      if (e.target.closest('button, .map-visitor, .v-dialog')) return;
      const at = m.toMap ? m.toMap(e) : (() => { const r = m.section.getBoundingClientRect(); return { x: (e.clientX - r.left) / m.scale, y: (e.clientY - r.top) / m.scale }; })();
      // in the village a tap on a critter only pokes it; the buddy stays put
      if (actor.poke(at.x, at.y) && m.host) { e.stopPropagation(); e.preventDefault(); }
    }, Boolean(m.host));
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(running.get(m.section)); actor.quiet?.(); return; }
    if (document.visibilityState === 'hidden') { actor.quiet?.(); return; }
    const t = performance.now() - t0;
    // a frame's worth of time since the last step (a redraw can call this early)
    if (t - keep.last >= FRAME * 0.8) {
      actor.step(t, view());
      keep.frame += 1;
      keep.last = t;
    }
    ctx.clearRect(0, 0, m.aw, m.ah);
    partyFrame = keep.frame;
    actor.draw(ctx, keep.frame);
  };
  tick();
  if (!reduce) running.set(m.section, setInterval(tick, FRAME));
}
