// The village's trees, flowers and critters, which grow with how the whole family does its
// chores (the rules are in familygarden.js, the art in bloomart.js, the spots in bloomspots.js).
//
// bloomData works out the garden once per redraw and keeps just what the page needs (it rides
// along in the village's data). mountBloom then puts it in the live village:
//   flowers: painted flat on the ground canvas, under the buddy and everyone else;
//   trees: standing pieces, each one its own canvas with z-index = its feet's y, so the buddy
//     and the villagers walk behind a tree when they are higher up the screen. They are only
//     pictures: nothing blocks the buddy, and taps go through them to the ground;
//   critters: a few per kind that the garden has earned (critterLevel), wandering near the
//     grown trees and blooms. One animation loop, paused while the page is hidden.
// The painted layers are cached per (map, today, garden hash), so a redraw doesn't repaint them.

import { villageGarden, critterLevel, familyMark } from './familygarden.js';
import { addDays } from './logic.js';

export { bloomHint } from './bloomhints.js';
import { bloomSpotsFor } from './bloomspots.js';
import { treeArt, flowerArt, critterArt, CRITTERS } from './bloomart.js';
import { spriteFor } from './seasonlife.js';

// ---------- what the village looks like today ----------

/** A short number for a garden, so a cached layer knows when it is out of date. */
function hashOf(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0).toString(36);
}

/**
 * The garden as the page keeps it: { today, hash, wilt, level, trees: [[spot, stage]],
 * flowers: [[spot, kind, stage, age]] }. kids: everyone in the family (see villageGarden).
 */
export function bloomData(kids, today) {
  const g = villageGarden(kids, today);
  const out = {
    today, wilt: g.wilt, level: critterLevel(g),
    trees: g.trees.map((t) => [t.spot, t.stage]),
    flowers: g.flowers.map((f) => [f.spot, f.kind, f.stage, f.age]),
  };
  out.hash = hashOf(JSON.stringify(out));
  // what villagers can say about it (bloomhints.js), from how it changed since yesterday
  const yday = addDays(today, -1);
  const was = villageGarden(kids, yday);
  out.hint = {
    yesterday: familyMark(kids, yday, today).mark, dayBefore: familyMark(kids, addDays(today, -2), today).mark,
    today: g.mark, wilt: g.wilt, prevWilt: was.wilt, goodDays: g.goodDays,
    newTrees: Math.max(0, g.trees.length - was.trees.length),
    newBlooms: Math.max(0, g.blooms - was.blooms),
    newMature: Math.max(0, g.matureTrees - was.matureTrees),
    grew: g.trees.some((t) => !t.mature) && g.goodDays > was.goodDays,
  };
  return out;
}

/**
 * The small line that tells kids why the village changes: { icon, text, wilted }. It says
 * how the family did yesterday, or that the plants are thirsty.
 */
export function gardenLine(kids, today) {
  const g = villageGarden(kids, today);
  const many = kids.length > 1;
  if (g.wilt > 0) return { icon: '🥀', wilted: true, text: 'The village plants are thirsty. A good family day will perk them up.' };
  const y = familyMark(kids, addDays(today, -1), today);
  const pct = Math.round(y.share * 100);
  if (y.mark === 'good' && g.goodDays > 0) return { icon: '🌳', text: `${many ? 'The whole family' : 'You'} did ${pct}% of the chores yesterday, so the village grew!` };
  if (g.mark === 'good') return { icon: '🌱', text: `${many ? 'The whole family is' : 'You are'} doing great today, so the village is growing!` };
  return { icon: '🌱', text: `${many ? 'When the whole family does' : 'When you do'} most of the chores, the village grows trees and flowers.` };
}

// ---------- the painted layers ----------

const layerCache = new Map(); // map|today|hash -> { ground, trees: Map(spot -> canvas) }
function layersFor(mapId, bloom, se) {
  const key = `${mapId}|${bloom.today}|${bloom.hash}|${se.season}${Math.round(se.progress * 20)}`;
  let hit = layerCache.get(key);
  if (hit) return hit;
  const spots = bloomSpotsFor(mapId);
  const flowers = bloom.flowers
    .map(([spot, kind, stage, age]) => ({ spot, at: spots.flowers[spot], kind, stage, age }))
    .filter((f) => f.at)
    .sort((a, b) => a.at.y - b.at.y);
  const ground = document.createElement('canvas');
  ground.width = 448; ground.height = 700; // the biggest village; only what is drawn matters
  const ctx = ground.getContext('2d');
  for (const f of flowers) {
    const c = flowerArt(mapId, f.kind, f.stage, bloom.wilt, f.age, f.spot);
    ctx.drawImage(c, Math.round(f.at.x - c.ax), Math.round(f.at.y - c.ay));
  }
  const trees = bloom.trees.map(([spot, stage]) => {
    const at = spots.trees[spot];
    return at && { at, c: treeArt(mapId, spot, stage, bloom.wilt) };
  }).filter(Boolean);
  hit = { ground: spriteFor(ground, se, mapId), trees: trees.map((t) => ({ at: t.at, c: spriteFor(t.c, se, mapId) })), spots };
  if (layerCache.size > 6) layerCache.delete(layerCache.keys().next().value);
  layerCache.set(key, hit);
  return hit;
}

// ---------- critters ----------

const FRAME_MS = 1000 / 12.5;
const kept = new Map(); // a kid's critters stay where they were when the screen is redrawn

/** How many of each kind a village has at this level (a few, never a crowd). */
const countFor = (def, level) => Math.min(3, 1 + Math.max(0, level - def.level));

function makeCritters(mapId, bloom, spots, L) {
  const defs = (CRITTERS[mapId] || []).map((def, which) => ({ def, which })).filter(({ def }) => def.level <= bloom.level);
  if (!defs.length) return [];
  // wander near the grown trees and blooms
  const homes = [
    ...bloom.trees.filter(([, stage]) => stage >= 3).map(([spot]) => spots.trees[spot]),
    ...bloom.flowers.filter(([, , stage]) => stage >= 3).map(([spot]) => spots.flowers[spot]),
  ].filter(Boolean);
  if (!homes.length) return [];
  const list = [];
  let n = 0;
  for (const { def, which } of defs) {
    for (let i = 0; i < countFor(def, bloom.level); i += 1) {
      const home = homes[(n * 7 + which * 3 + i * 5) % homes.length];
      const c = { def, which, home, x: home.x + 10, y: home.y + 4, to: null, face: n % 2 ? 1 : -1, phase: n * 3, wait: 0, scare: 0, hop: 0, ang: n * 2.1, speed: 0 };
      c.speed = { walk: 7, fly: 16, swim: 9, sit: 0 }[def.moves] ?? 7;
      if (def.moves === 'walk' || def.moves === 'sit') settle(c, L, 40);
      list.push(c);
      n += 1;
    }
  }
  return list;
}

/** Put a walking critter on open ground near its home. */
function settle(c, L, r) {
  for (let tries = 0; tries < 12; tries += 1) {
    const a = Math.random() * Math.PI * 2; const d = 8 + Math.random() * r;
    const x = c.home.x + Math.cos(a) * d; const y = c.home.y + Math.sin(a) * d * 0.6;
    if (x > 24 && x < L.W - 24 && y > 30 && y < L.H - 24 && !L.blocked(x, y, 3) && !L.covered(x, y)) { c.x = x; c.y = y; return true; }
  }
  return false;
}

function stepCritter(c, dt, L) {
  const m = c.def.moves;
  if (c.hop > 0) c.hop = Math.max(0, c.hop - dt);
  if (c.scare > 0) c.scare = Math.max(0, c.scare - dt);
  if (m === 'sit') {
    if (c.scare > 0) return;
    c.wait -= dt;
    if (c.wait <= 0) { c.wait = 3 + Math.random() * 5; c.hop = 0.25; if (Math.random() < 0.3) c.face = -c.face; }
    return;
  }
  if (m === 'fly' || m === 'swim') {
    // a slow loop round the home, bobbing a little
    const fast = c.scare > 0 ? 3 : 1;
    c.ang += dt * (m === 'fly' ? 0.9 : 0.5) * fast * c.face;
    const rx = m === 'fly' ? 34 : 26; const ry = m === 'fly' ? 18 : 10;
    const nx = c.home.x + Math.cos(c.ang) * rx;
    const ny = c.home.y - (m === 'fly' ? 14 : 2) + Math.sin(c.ang * 1.7) * ry;
    const dx = nx - c.x;
    if (Math.abs(dx) > 0.05) c.dir = dx > 0 ? 1 : -1;
    c.x = nx; c.y = Math.max(8, Math.min(L.H - 8, ny));
    return;
  }
  // walking: stroll to a spot near home, rest, go again; a scared one runs off
  if (c.wait > 0) { c.wait -= dt; return; }
  if (!c.to) {
    const probe = { home: c.home, x: c.x, y: c.y };
    if (settle(probe, L, 36)) c.to = { x: probe.x, y: probe.y }; else { c.wait = 2; return; }
  }
  const dx = c.to.x - c.x; const dy = c.to.y - c.y; const d = Math.hypot(dx, dy);
  const step = c.speed * (c.scare > 0 ? 3 : 1) * dt;
  if (d <= step) { c.x = c.to.x; c.y = c.to.y; c.to = null; c.wait = 1.5 + Math.random() * 4; c.moving = false; return; }
  const nx = c.x + (dx / d) * step; const ny = c.y + (dy / d) * step;
  if (L.blocked(nx, ny, 2)) { c.to = null; c.wait = 0.5; return; }
  c.x = nx; c.y = ny; c.moving = true;
  c.dir = dx > 0 ? 1 : -1;
}

/**
 * Starts the critters in a live village: section, L (the layout), bloom (bloomData), spots,
 * cam: { host, toMap(e) } so a tap on a critter makes it hop and flee (and the buddy stays put).
 */
function startCritters(section, L, bloom, spots, cam) {
  const mapId = L.id;
  const key = `${section.dataset.kid}|${mapId}|${bloom.today}|${bloom.hash}`;
  let list = kept.get(key);
  if (!list) {
    list = makeCritters(mapId, bloom, spots, L);
    if (kept.size > 6) kept.delete(kept.keys().next().value);
    kept.set(key, list);
  }
  if (!list.length) return;
  const world = section.querySelector('.village-world');
  const make = (cls, z) => {
    const c = document.createElement('canvas');
    c.className = `v-bloom-life ${cls}`;
    c.width = L.W; c.height = L.H;
    c.style.cssText = `width:${L.W}px;height:${L.H}px;z-index:${z}`;
    c.setAttribute('aria-hidden', 'true');
    world.append(c);
    return c;
  };
  const low = make('low', 2); // walking, swimming and sitting critters, under everything that stands
  const high = make('high', 9000); // flying ones, above it all
  const lowCtx = low.getContext('2d'); const highCtx = high.getContext('2d');
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  let last = performance.now(); let acc = 0; let clock = 0;
  const draw = () => {
    lowCtx.clearRect(0, 0, L.W, L.H); highCtx.clearRect(0, 0, L.W, L.H);
    for (const c of [...list].sort((a, b) => a.y - b.y)) {
      const m = c.def.moves;
      const frames = c.def.frames || 1;
      const frame = m === 'sit' ? (c.hop > 0 ? 1 % frames : 0) : Math.floor(clock * (c.moving || m !== 'walk' ? 7 : 0) + c.phase) % frames;
      const art = critterArt(mapId, c.which, frame, Math.floor(Math.abs(c.phase || 0) * 7) % (c.def.variants || 1));
      if (!art) continue;
      const ctx = m === 'fly' ? highCtx : lowCtx;
      const hop = c.hop > 0 ? Math.round(Math.sin((c.hop / 0.25) * Math.PI) * 4) : 0;
      const right = (c.dir || c.face) > 0;
      const x = Math.round(c.x); const y = Math.round(c.y) - hop;
      if (right) ctx.drawImage(art, x - art.ax, y - art.ay);
      else {
        ctx.save(); ctx.translate(x, y); ctx.scale(-1, 1);
        ctx.drawImage(art, -(art.width - art.ax), -art.ay);
        ctx.restore();
      }
    }
  };
  const tick = (now) => {
    if (!low.isConnected) return;
    const dt = Math.min(0.1, (now - last) / 1000);
    last = now; acc += dt * 1000; clock += dt;
    if (document.visibilityState !== 'hidden' && acc >= FRAME_MS * 0.8) {
      for (const c of list) stepCritter(c, acc / 1000, L);
      acc = 0;
      draw();
    }
    requestAnimationFrame(tick);
  };
  draw();
  if (!reduce) requestAnimationFrame(tick);

  // a tap on a critter: it hops and runs (or flies) off for a moment; the buddy stays where it is
  cam.host.addEventListener('click', (e) => {
    if (e.target.closest('button, .v-dialog')) return;
    const at = cam.toMap(e);
    const hit = list.find((c) => Math.hypot(c.x - at.x, c.y - 4 - at.y) < 12);
    if (!hit) return;
    hit.hop = 0.25; hit.scare = 1.6; hit.to = null; hit.wait = 0;
    hit.dir = hit.x < at.x ? -1 : 1;
    if (hit.def.moves === 'walk') { hit.to = { x: hit.x + hit.dir * 26, y: hit.y }; if (hit.to.x < 24 || hit.to.x > L.W - 24 || L.blocked(hit.to.x, hit.to.y, 3)) hit.to = null; }
    if (reduce) draw();
    e.stopPropagation(); e.preventDefault();
  }, true);
}

// ---------- in the live village ----------

/**
 * Add the garden to a live village. section: the village element; L: its layout; data: the
 * village's data (data.bloom is bloomData); ground: the land's canvas; se: the season
 * (seasonNow in seasonlife.js), so cached layers and sprites are the right colours; cam: { host, toMap }.
 */
export function mountBloom(section, L, data, ground, se, cam) {
  const bloom = data.bloom;
  if (!bloom || (!bloom.trees.length && !bloom.flowers.length)) return;
  const layers = layersFor(L.id, bloom, se);
  // flowers go flat on the ground
  ground.getContext('2d').drawImage(layers.ground, 0, 0);
  // trees stand where the buddy and villagers stand: sorted by their feet
  const world = section.querySelector('.village-world');
  const before = section.querySelector('.v-buddy');
  for (const { at, c } of layers.trees) {
    const el = document.createElement('canvas');
    el.className = 'v-tree';
    el.width = c.width; el.height = c.height;
    el.style.cssText = `left:${Math.round(at.x - c.ax)}px;top:${Math.round(at.y - c.ay)}px;z-index:${Math.round(at.y)}`;
    el.setAttribute('aria-hidden', 'true');
    el.getContext('2d').drawImage(c, 0, 0);
    world.insertBefore(el, before);
  }
  startCritters(section, L, bloom, layers.spots, cam);
}
