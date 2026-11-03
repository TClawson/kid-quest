// Things that move on the quest map: fish, aliens and a rocket, an erupting volcano, a dragon
// and a knight, a unicorn, flying saucers. Drawn on a second canvas over the land (under the
// stops), with the same pixel size as the map. Events happen where the kid is looking.

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

// The rocket: r red, R dark red, w white, W shade, b window, B glint, g nozzle.
const ROCKET = sprite([
  '.....rr',
  '....lrrR',
  '...lrrrrR',
  '...wwwwwW',
  '...wwbbwW',
  '...wbBbbW',
  '...wbbbbW',
  '...wwbbwW',
  '...wwwwwW',
  '...rrrrrR',
  '...wwwwwW',
  '...wwwwwW',
  '..rwwwwwWr',
  '.rrwwwwwWrr',
  'rrrwwwwwWrrR',
  'rrR.gggg.rrR',
  'rR...gg...rR',
]);
const FLAME = [
  sprite(['.....yy', '....fyyf', '.....ff', '.....f'], false),
  sprite(['....fyyf', '...fyyyyf', '....fyyf', '....ffyf', '.....ff', '......f'], false),
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
const DRAGON = sprite(DRAGON_BODY);
const DRAGON_ROAR = sprite(swap(DRAGON_BODY, 7, [
  'tGtGGGGGGGGGs',
  'rrrrrDGGGGGGs',
  'rrrrDDDGGGGGGs.s.s',
  'tDtDD..YGGGGGGsLsLsL',
]));
// wings, w the skin, D the bones
const WING_UP = sprite([
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
const WING_DOWN = sprite([
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
const KNIGHT = sprite(KNIGHT_BODY);
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
const UNICORN_RUN = [
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

function draw(ctx, x0, y0, rows, pal, flip = false) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  rows.forEach((r, yy) => {
    for (let i = 0; i < r.length; i += 1) {
      const ch = r[i];
      if (ch === '.') continue;
      const c = ch === 'K' ? OUT : pal[ch];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + (flip ? r.length - 1 - i : i), y + yy, 1, 1);
    }
  });
}
/** Where a part (wing, sword) goes on a sprite that may be flipped: `ox` is from the sprite's left. */
const partX = (x, w, ox, part, flip) => (flip ? x + w - ox - part[0].length : x + ox);
/** A round pixel puff, for smoke and fire. */
function puff(ctx, cx, cy, r, c, edge) {
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

/** Fish swim across now and then, in little schools. */
function fishLife(m) {
  const fish = [];
  const colors = [
    { o: '#ff922b', l: '#ffc078', d: '#e8590c', w: '#ffffff', f: '#d9480f', e: '#ffffff' },
    { o: '#ffd43b', l: '#fff3bf', d: '#f59f00', w: '#4dabf7', f: '#1c7ed6', e: '#ffffff' },
    { o: '#f783ac', l: '#fcc2d7', d: '#d6336c', w: '#ffffff', f: '#ae3ec9', e: '#ffffff' },
    { o: '#63e6be', l: '#c3fae8', d: '#0ca678', w: '#1098ad', f: '#0b7285', e: '#ffffff' },
  ];
  let next = 600;
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
      for (const f of fish) { f.x += f.dir * f.speed; f.phase += 0.25; }
      for (let i = fish.length - 1; i >= 0; i -= 1) if (fish[i].x < -40 || fish[i].x > m.aw + 40) fish.splice(i, 1);
    },
    draw(ctx, frame) {
      for (const f of fish) draw(ctx, f.x, f.y + Math.round(Math.sin(f.phase) * 1.5), (frame + Math.round(f.phase)) % 4 < 2 ? FISH : FISH_TAIL, f.pal, f.dir < 0);
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
  const pad = { x: m.wall + 4, y: 48 };
  const park = pad.y - 20; // the rocket's top when it stands on the pad
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
      if (r.phase === 'away' && t > next) rocket = { phase: 'landing', y: pad.y - 70, v: 2.2 };
      else if (r.phase === 'landing') {
        r.v = Math.max(0.35, (park - r.y) / 12);
        r.y += r.v;
        if (r.y >= park - 0.5) { r.y = park; rocket = { phase: 'parked', y: r.y, until: t + 6000 }; }
      } else if (r.phase === 'parked' && t > r.until) rocket = { phase: 'launch', y: r.y, v: 0.2 };
      else if (r.phase === 'launch') {
        r.v *= 1.12; r.y -= r.v;
        if (r.y < -80) { rocket = { phase: 'away' }; next = t + rand(14000, 22000); }
      }
    },
    draw(ctx, frame) {
      // the landing pad
      ctx.fillStyle = OUT; ctx.fillRect(pad.x - 1, pad.y - 4, 20, 8);
      ctx.fillStyle = '#868e96'; ctx.fillRect(pad.x, pad.y - 3, 18, 6);
      ctx.fillStyle = '#adb5bd'; ctx.fillRect(pad.x, pad.y - 3, 18, 1);
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(pad.x + 6, pad.y - 2, 1, 4); ctx.fillRect(pad.x + 11, pad.y - 2, 1, 4); ctx.fillRect(pad.x + 6, pad.y, 6, 1);
      if (frame % 8 < 4) { ctx.fillStyle = '#ff6b6b'; ctx.fillRect(pad.x - 1, pad.y - 4, 2, 2); ctx.fillRect(pad.x + 17, pad.y - 4, 2, 2); }
      for (const a of aliens) {
        const walking = a.pause <= 0;
        const look = a.wave > 0 && frame % 4 < 2 ? ALIEN_WAVE : walking && frame % 6 < 3 ? ALIEN_STEP : ALIEN;
        draw(ctx, a.x, a.y - (walking && frame % 6 < 3 ? 1 : 0), look, a.pal, a.dir < 0);
      }
      const r = rocket;
      if (r.phase === 'away') return;
      const pal = { r: '#ff6b6b', R: '#c92a2a', l: '#ffa8a8', w: '#f8f9fa', W: '#ced4da', b: '#4dabf7', B: '#d0ebff', g: '#868e96', f: '#ff922b', y: '#ffe066' };
      draw(ctx, pad.x + 3, r.y, ROCKET, pal);
      if (r.phase !== 'parked') draw(ctx, pad.x + 4, r.y + 18, FLAME[frame % 2], pal);
      if (r.phase === 'launch' && r.y > pad.y - 50) {
        for (let i = 0; i < 6; i += 1) puff(ctx, pad.x - 4 + i * 5 + (frame % 2), pad.y + 2 - (i % 2) * 2, 1.6 + (i % 3) * 0.5, '#dee2e6', '#adb5bd');
      }
    },
  };
}

/** The volcano rumbles and erupts every so often. */
function volcanoLife(m) {
  const crater = { x: m.goal.x, y: m.goal.y - 26 };
  const blobs = [];
  const smoke = [];
  let next = 2500;
  let glow = 0;
  return {
    step(t) {
      if (t > next) {
        next = t + rand(9000, 14000);
        glow = 40;
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

/** A unicorn wanders about; poke it and it gallops off for a couple of seconds. */
function unicornLife(m) {
  const start = m.openSpot({ top: 40, bottom: Math.min(m.ah - 20, 140) }) || { x: m.aw / 2, y: 60 };
  const u = { x: start.x, y: start.y, tx: start.x, ty: start.y, dir: 1, run: 0, rest: 20 };
  const trail = [];
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
    },
    draw(ctx, frame) {
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

const LIVES = { fish: fishLife, space: spaceLife, volcano: volcanoLife, castle: castleLife, unicorn: unicornLife, saucer: saucerLife };
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
  let canvas = m.section.querySelector('canvas.map-life');
  if (!LIVES[m.life]) { canvas?.remove(); return; }
  if (!canvas) {
    canvas = document.createElement('canvas');
    canvas.className = 'map-life';
    canvas.setAttribute('aria-hidden', 'true');
    m.section.querySelector('canvas.map-land').after(canvas);
  }
  canvas.width = m.aw;
  canvas.height = m.ah;
  canvas.style.width = `${m.aw * m.scale}px`;
  canvas.style.height = `${m.ah * m.scale}px`;
  const ctx = canvas.getContext('2d');
  const key = `${m.section.dataset.seed || ''}|${m.life}`;
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
  const view = () => {
    const r = m.section.getBoundingClientRect();
    const top = Math.max(0, -r.top) / m.scale;
    const bottom = Math.min(r.height, (window.innerHeight || r.height) - r.top) / m.scale;
    return bottom > top + 30 ? { top, bottom } : { top: 0, bottom: m.ah };
  };
  if (actor.poke) {
    m.section.addEventListener('click', (e) => {
      if (e.target.closest('button, .map-visitor')) return;
      const r = m.section.getBoundingClientRect();
      actor.poke((e.clientX - r.left) / m.scale, (e.clientY - r.top) / m.scale);
    });
  }
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(running.get(m.section)); return; }
    if (document.visibilityState === 'hidden') return;
    const t = performance.now() - t0;
    // a frame's worth of time since the last step (a redraw can call this early)
    if (t - keep.last >= FRAME * 0.8) {
      actor.step(t, view());
      keep.frame += 1;
      keep.last = t;
    }
    ctx.clearRect(0, 0, m.aw, m.ah);
    actor.draw(ctx, keep.frame);
  };
  tick();
  if (!reduce) running.set(m.section, setInterval(tick, FRAME));
}
