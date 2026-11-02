// Things that move on the quest map: fish, aliens and a rocket, an erupting volcano, a dragon
// and a knight, a unicorn, flying saucers. Drawn on a second canvas over the land (under the
// stops), at the same chunky art-pixel scale. Events happen where the kid is looking.

const OUT = '#2a1838';
const FPS = 12.5;
const FRAME = 1000 / FPS;
const Z = 2; // actors are drawn at double size so they read at a glance

// ---------- sprites (facing right; K is the outline, . is see-through) ----------

const FISH = ['....KKK..', 'KK.KoooK.', 'KoKoowoeK', 'KK.KoooK.', '....KKK..'];
const FISH_TAIL = ['K...KKK..', 'KoKKoooK.', '.KKoowoeK', 'KoKKoooK.', 'K...KKK..'];
const ALIEN = ['K.....K', '.K...K.', '.KgggK.', 'KgegegK', 'KgggggK', '.KgggK.', '.KgKgK.', '.KK.KK.'];
const ALIEN_WAVE = ['K.....K', '.K...K.', '.KgggK.', 'KgegegKK', 'KgggggKg', '.KgggK..', '.KgKgK.', '.KK.KK.'];
const ROCKET = ['...K...', '..KrK..', '.KrrrK.', '.KwwwK.', '.KwbwK.', '.KwwwK.', '.KwwwK.', 'KKwwwKK', 'KrKwKrK', 'KrK.KrK'];
const FLAME = [['..fyf..', '...f...'], ['.fyyyf.', '..fyf..', '...f...']];
const DRAGON = [
  '.KK.............',
  'KRRK..KKKKKK....',
  'KRbRKKRRRRRRKK.K',
  'KRRRRRRRRRRRRRKR',
  '.KKKKRRrrrRRKKRK',
  '.....KRKKKRK..K.',
  '.....KK...KK....',
];
const WING_UP = ['.....KK', '....KwK', '...KwwK', '..KwwwK', '.KwwwwK', 'KKKKKKK'];
const WING_DOWN = ['KKKKKKK', '.KwwwwK', '..KwwK.', '...KK..'];
const KNIGHT = [
  '...KK.......',
  '..KppK......',
  '..KssK......',
  '..KsdK......',
  '.KbbbbKllll.',
  '.KbbbbK..KhK',
  'KhhhhhhhKhhK',
  'KhhhhhhhhhK.',
  '.KhhhhhhhK..',
  '.KhK...KhK..',
  '.KK....KK...',
];
const KNIGHT_RUN = ['..KhK.KhK...', '..KK..KK....'];
const UNICORN = [
  '..........y..',
  '.........Ky..',
  '........KmwK.',
  '.......KmwwwK',
  '.......KmwewK',
  '......KmmwwwK',
  'KK...KmwwKKK.',
  'KmKKKwwwwK...',
  '.KmwwwwwwK...',
  '..KwwwwwwK...',
  '..KwK..KwK...',
  '..KK...KK....',
];
const UNICORN_RUN = ['...KwKKwK....', '...KK.KK.....'];
const SAUCER = [
  '.....KKKKK.....',
  '....KdAAAdK....',
  '....KdAeAdK....',
  '..KKKKKKKKKKK..',
  '.KsssssssssssK.',
  'KsLsssLsssLsssK',
  '.KKKKKKKKKKKKK.',
];
const PEACE = ['g.g', 'g.g', 'ggg', '.g.'];

function draw(ctx, x0, y0, rows, pal, flip = false, z = Z) {
  const x = Math.round(x0);
  const y = Math.round(y0);
  rows.forEach((r, yy) => {
    for (let i = 0; i < r.length; i += 1) {
      const ch = r[i];
      if (ch === '.') continue;
      const c = ch === 'K' ? OUT : pal[ch];
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(x + (flip ? r.length - 1 - i : i) * z, y + yy * z, z, z);
    }
  });
}
const withLegs = (body, legs) => [...body.slice(0, body.length - legs.length), ...legs];
const rand = (a, b) => a + Math.random() * (b - a);

// ---------- the actors, one set per theme ----------

/** Fish swim across now and then, in little schools. */
function fishLife(m) {
  const fish = [];
  const colors = [{ o: '#ff922b', w: '#ffffff', e: OUT }, { o: '#ffd43b', w: '#4dabf7', e: OUT }, { o: '#f783ac', w: '#ffffff', e: OUT }, { o: '#63e6be', w: '#1098ad', e: OUT }];
  let next = 1500;
  return {
    step(t, view) {
      if (t > next) {
        next = t + rand(4000, 9000);
        const dir = Math.random() < 0.5 ? 1 : -1;
        const y = rand(view.top + 10, view.bottom - 15);
        const pal = colors[Math.floor(Math.random() * colors.length)];
        const n = 1 + Math.floor(Math.random() * 3);
        for (let i = 0; i < n; i += 1) {
          fish.push({ x: dir > 0 ? -20 - i * 22 : m.aw + 2 + i * 22, y: y + i * 9 * (i % 2 ? 1 : -1), dir, pal, speed: rand(0.9, 1.4), phase: Math.random() * 6 });
        }
      }
      for (const f of fish) { f.x += f.dir * f.speed; f.phase += 0.25; }
      for (let i = fish.length - 1; i >= 0; i -= 1) if (fish[i].x < -40 || fish[i].x > m.aw + 40) fish.splice(i, 1);
    },
    draw(ctx, frame) {
      for (const f of fish) draw(ctx, f.x, f.y + Math.round(Math.sin(f.phase)), frame % 4 < 2 ? FISH : FISH_TAIL, f.pal, f.dir < 0);
    },
  };
}

/** Little aliens wander the moon, and a rocket lands on its pad, waits, then blasts off. */
function spaceLife(m) {
  const aliens = [];
  const pals = [{ g: '#8ce99a', e: OUT }, { g: '#a9e34b', e: OUT }, { g: '#66d9e8', e: OUT }];
  const n = Math.max(4, Math.floor(m.ah / 60));
  for (let i = 0; i < n; i += 1) {
    const spot = m.openSpot({ top: (i * m.ah) / n + 10, bottom: ((i + 1) * m.ah) / n - 10 });
    if (spot) aliens.push({ ...spot, home: spot.x, dir: i % 2 ? 1 : -1, pal: pals[i % pals.length], wave: 0, pause: 0 });
  }
  const pad = { x: m.wall + 4, y: 48 };
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
        r.v = Math.max(0.35, (pad.y - 21 - r.y) / 12);
        r.y += r.v;
        if (r.y >= pad.y - 21.5) { r.y = pad.y - 21; rocket = { phase: 'parked', y: r.y, until: t + 6000 }; }
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
      ctx.fillStyle = '#ffd43b'; ctx.fillRect(pad.x + 6, pad.y - 2, 1, 4); ctx.fillRect(pad.x + 11, pad.y - 2, 1, 4); ctx.fillRect(pad.x + 6, pad.y, 6, 1);
      if (frame % 8 < 4) { ctx.fillStyle = '#ff6b6b'; ctx.fillRect(pad.x - 1, pad.y - 4, 2, 2); ctx.fillRect(pad.x + 17, pad.y - 4, 2, 2); }
      for (const a of aliens) draw(ctx, a.x, a.y - (a.pause > 0 ? 0 : frame % 6 < 3 ? 1 : 0), a.wave > 0 && frame % 4 < 2 ? ALIEN_WAVE : ALIEN, a.pal, a.dir < 0);
      const r = rocket;
      if (r.phase === 'away') return;
      const pal = { r: '#ff6b6b', w: '#f1f3f5', b: '#74c0fc', f: '#ff922b', y: '#ffe066' };
      draw(ctx, pad.x + 2, r.y, ROCKET, pal);
      if (r.phase !== 'parked') draw(ctx, pad.x + 2, r.y + 10 * Z, FLAME[frame % 2], pal);
      if (r.phase === 'launch' && r.y > pad.y - 50) {
        ctx.fillStyle = '#ced4da';
        for (let i = 0; i < 6; i += 1) ctx.fillRect(pad.x - 6 + i * 6 + (frame % 2), pad.y + 2 - (i % 2) * 2, 4, 3);
      }
    },
  };
}

/** The volcano rumbles and erupts every so often. */
function volcanoLife(m) {
  const crater = { x: m.goal.x, y: m.goal.y - 26 };
  const blobs = [];
  let next = 2500;
  let glow = 0;
  return {
    step(t) {
      if (t > next) {
        next = t + rand(9000, 14000);
        glow = 40;
        for (let i = 0; i < 28; i += 1) blobs.push({ x: crater.x + rand(-4, 4), y: crater.y, vx: rand(-1.8, 1.8), vy: rand(-4.6, -2.2), delay: Math.floor(rand(0, 22)) });
      }
      if (glow > 0) glow -= 1;
      for (const b of blobs) {
        if (b.delay > 0) { b.delay -= 1; continue; }
        b.x += b.vx; b.y += b.vy; b.vy += 0.18;
      }
      for (let i = blobs.length - 1; i >= 0; i -= 1) if (blobs[i].y > crater.y + 50) blobs.splice(i, 1);
    },
    draw(ctx, frame) {
      if (glow > 0) {
        // the crater flares and a smoke cloud billows up
        const k = 40 - glow;
        ctx.fillStyle = frame % 2 ? '#ffe066' : '#ff922b';
        ctx.fillRect(crater.x - 6, crater.y - 1, 13, 2);
        ctx.fillStyle = OUT;
        ctx.fillRect(crater.x - 5 - k / 3, crater.y - 10 - k, 11 + k / 1.5, 8 + k / 4);
        ctx.fillStyle = '#868e96';
        ctx.fillRect(crater.x - 4 - k / 3, crater.y - 9 - k, 9 + k / 1.5, 6 + k / 4);
      }
      for (const b of blobs) {
        if (b.delay > 0) continue;
        ctx.fillStyle = OUT; ctx.fillRect(Math.round(b.x) - 1, Math.round(b.y) - 1, 5, 5);
        ctx.fillStyle = b.vy < 0 ? '#ffe066' : '#ff6b1a'; ctx.fillRect(Math.round(b.x), Math.round(b.y), 3, 3);
      }
    },
  };
}

/** A knight on horseback keeps watch; when the dragon swoops in, the knight chases it away. */
function castleLife(m) {
  const post = m.knightPost;
  const knight = { x: post.x, y: post.y, dir: post.side < 0 ? 1 : -1, run: false };
  let dragon = null;
  let next = 3000;
  const kPal = { p: '#e03131', s: '#ced4da', d: '#495057', b: '#4c6ef5', l: '#e9ecef', h: '#f8f9fa' };
  const dPal = { R: '#2f9e44', r: '#8ce99a', b: '#ffd43b', w: '#ffa94d' };
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
  return {
    step(t, view) {
      if (!dragon && t > next) {
        const y = rand(view.top + 25, Math.max(view.top + 26, view.bottom - 60));
        dragon = { x: m.aw + 10, y, base: y, phase: 'in', t: 0, fire: 0 };
      }
      if (!dragon) {
        knight.run = !moveTo(post.x, post.y, 1);
        if (!knight.run) knight.dir = post.side < 0 ? 1 : -1;
        return;
      }
      const d = dragon;
      d.t += 1;
      if (d.phase === 'in') {
        d.x -= 2.2;
        d.y = d.base + Math.sin(d.t / 5) * 4;
        if (d.x < m.aw * 0.5) { d.phase = 'hover'; d.fire = 14; }
      } else if (d.phase === 'hover') {
        d.y = d.base + Math.sin(d.t / 5) * 4;
        if (d.fire > 0) d.fire -= 1;
        else if (Math.random() < 0.05) d.fire = 10;
      } else {
        d.x += 3.2; d.y -= 1.6;
        if (d.x > m.aw + 40) { dragon = null; next = t + rand(18000, 28000); }
      }
      if (d.phase !== 'flee') {
        knight.run = true;
        moveTo(d.x - 26, d.y + 20, 2.4);
        if (d.phase === 'hover' && Math.hypot(knight.x - (d.x - 26), knight.y - (d.y + 20)) < 6) d.phase = 'flee';
      } else {
        knight.run = true;
        moveTo(Math.min(d.x - 26, m.aw - m.wall - 26), knight.y, 1.6);
      }
    },
    draw(ctx, frame) {
      const legs = knight.run ? (frame % 2 ? KNIGHT_RUN : KNIGHT.slice(-2)) : KNIGHT.slice(-2);
      draw(ctx, knight.x, knight.y - (knight.run && frame % 2 ? 1 : 0), withLegs(KNIGHT, legs), kPal, knight.dir < 0);
      const d = dragon;
      if (!d) return;
      const flip = d.phase === 'flee';
      const flap = frame % 4 < 2;
      const wx = (flip ? 3 : 6) * Z;
      draw(ctx, d.x + wx, d.y + (flap ? -5 : 4) * Z, flap ? WING_UP : WING_DOWN, dPal, flip);
      draw(ctx, d.x, d.y, DRAGON, dPal, flip);
      if (d.fire > 0 && !flip) {
        for (let i = 0; i < 6; i += 1) {
          ctx.fillStyle = i % 2 ? '#ffd43b' : '#ff6b1a';
          ctx.fillRect(d.x - 4 - i * 3, d.y + 4 + Math.round(Math.sin(frame + i) * 2), 3, 3);
        }
      }
    },
  };
}

/** A unicorn wanders about; poke it and it gallops off for a couple of seconds. */
function unicornLife(m) {
  const start = m.openSpot({ top: 40, bottom: Math.min(m.ah - 20, 140) }) || { x: m.aw / 2, y: 60 };
  const u = { x: start.x, y: start.y, tx: start.x, ty: start.y, dir: 1, run: 0, rest: 20 };
  const trail = [];
  const manes = ['#f783ac', '#b197fc', '#74c0fc', '#ffd43b'];
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
        trail.push({ x: u.x + (u.dir > 0 ? 0 : 24), y: u.y + 14 + rand(-3, 3), life: 10, c: manes[trail.length % manes.length] });
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
      for (const p of trail) p.life -= 1;
      while (trail.length && trail[0].life <= 0) trail.shift();
    },
    draw(ctx, frame) {
      for (const p of trail) { ctx.fillStyle = p.c; ctx.fillRect(Math.round(p.x), Math.round(p.y), 2, 2); }
      const moving = Math.hypot(u.tx - u.x, u.ty - u.y) > 1;
      const fast = u.run > 0;
      const legs = moving && (fast ? frame % 2 : frame % 4 < 2) ? UNICORN_RUN : UNICORN.slice(-2);
      const pal = { y: '#ffd43b', m: manes[Math.floor(frame / 3) % manes.length], w: '#ffffff', e: OUT };
      draw(ctx, u.x, u.y - (fast && frame % 2 ? 1 : 0), withLegs(UNICORN, legs), pal, u.dir < 0);
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
      const lights = frame % 3 === 0 ? '#ff6b6b' : frame % 3 === 1 ? '#69db7c' : '#74c0fc';
      draw(ctx, s.x, y, SAUCER, { d: '#d0ebff', A: '#fcc419', e: OUT, s: '#fab005', L: lights });
      if (s.phase === 'wave' && Math.floor(s.t / 3) % 2 === 0) {
        draw(ctx, s.x + 20, y - 9, PEACE, { g: '#ffd43b' });
        ctx.fillStyle = '#fff9db';
        ctx.fillRect(s.x + 28, y - 11, 1, 1);
        ctx.fillRect(s.x + 18, y - 11, 1, 1);
      }
    },
  };
}

const LIVES = { fish: fishLife, space: spaceLife, volcano: volcanoLife, castle: castleLife, unicorn: unicornLife, saucer: saucerLife };
const running = new WeakMap();

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
  const actor = LIVES[m.life](m);
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
  let frame = 0;
  const t0 = performance.now();
  const tick = () => {
    if (!canvas.isConnected) { clearInterval(running.get(m.section)); return; }
    if (document.visibilityState === 'hidden') return;
    actor.step(performance.now() - t0, view());
    ctx.clearRect(0, 0, m.aw, m.ah);
    actor.draw(ctx, frame);
    frame += 1;
  };
  tick();
  if (!reduce) running.set(m.section, setInterval(tick, FRAME));
}
