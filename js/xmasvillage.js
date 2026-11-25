// December and the night in a live village (village.js calls these): the glue between the art
// (xmaslights.js, adventart.js, nightfx.js, santaart.js) and the village's world.
//
//   dressLand(L, kept, o)   the land to show (night colors when it is dark), and mount() to put up
//                           the December things and the night's twinkles once the land is in
//
// kept is village.js's land cache: { canvas (the land as shown by day), base (its paint before the
// season's tint), probe (nightProbe of that paint) }; the scene is kept there too.

import { xmasOn, xmasScene, xmasLayer, xmasLights, xmasTreeArt, lanternArt } from './xmaslights.js';
import { shownNight, nightLand, landLights, nightFrames, nightFilter, folkFilters, lightAt } from './nightfx.js';
import { adventSpot, adventHouseArt, adventLights, adventWallArt } from './adventart.js';
import { mountSanta, mailboxArt, PRESENT_SIDE } from './santaart.js';

const TWINKLE_MS = 420;

/**
 * The land as it is shown now, and mount(section, world) to put up the rest. o: { today, now,
 * snow (the ground is snowy), day of December (for the advent house's little doors) }.
 */
export function dressLand(L, kept, o = {}) {
  const xm = xmasOn(o.today);
  const night = shownNight(o.now || new Date());
  const none = { land: kept.canvas, night: false, xmas: false, blocks: [], mount: () => null };
  if ((!xm && !night) || !kept.probe) return none;
  const advent = xm ? (kept.advent !== undefined ? kept.advent : (kept.advent = adventSpot(L))) : null;
  const scene = xm ? (kept.scene || (kept.scene = xmasScene(L, kept.probe, kept.base, advent ? [advent.box] : []))) : null;
  let land = kept.canvas;
  let lights = [];
  if (night) {
    lights = [...landLights(L, kept.probe, kept.base), ...(scene ? xmasLights(L, scene) : []), ...(advent ? adventLights(L, advent) : [])];
    land = nightLand(kept.canvas, L, kept.probe, lights, `${xm}`);
  }
  const blocks = [];
  if (scene?.tree) blocks.push([scene.tree.x - 9, scene.tree.y - 9, 18, 10]);
  for (const l of scene?.lanterns || []) blocks.push([l.x - 3, l.y - 4, 6, 5]);
  if (advent) blocks.push([advent.x - advent.w / 2 + 4, advent.y - 30, advent.w - 8, 30]);
  return { land, night, xmas: xm, scene, advent, blocks, mount: (section, world, m = {}) => mountDecor(section, world, L, { ...o, ...m, kept, scene, advent, night, xm, lights }) };
}

function mountDecor(section, world, L, o) {
  const { scene, advent, night } = o;
  const mapId = L.id;
  const kid = section.dataset.kid;
  const nm = night ? mapId : null;
  const reduce = Boolean(globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches);
  if (night) {
    section.classList.add('night');
    section.style.setProperty('--night-filter', `url(#kq-night-${mapId})`);
    section.style.setProperty('--night-folk', `url(#kq-folk-${mapId})`);
    section.style.setProperty('--night-folk-lit', `url(#kq-folk-lit-${mapId})`);
    section.insertAdjacentHTML('afterbegin', nightFilter(mapId) + folkFilters(mapId));
    // the characters stay readable: moonlit away from the lights, warm where they stand in a pool
    // of light (the buddy checks again each time it moves)
    const mark = (el) => { const x = parseFloat(el.style.left); const y = parseFloat(el.style.top); if (Number.isFinite(x) && Number.isFinite(y)) el.classList.toggle('v-lit', lightAt(o.lights || [], x, y) > 0.22); };
    world.querySelectorAll('.villager, .v-visitor, .v-buddy').forEach(mark);
    const buddy = world.querySelector('.v-buddy');
    if (buddy && globalThis.MutationObserver) new MutationObserver(() => mark(buddy)).observe(buddy, { attributes: true, attributeFilter: ['style'] });
  }
  // the twinkles over the land: the night's (stars in the water, glints on the snow) and the lights on the houses
  const sky = night ? nightFrames(L, o.kept.canvas, { snow: o.snow, aurora: mapId === 'bg-fjord' }) : null;
  const lights = scene ? xmasLayer(L, scene, { night }) : null;
  const fx = document.createElement('canvas');
  fx.className = 'v-xmas'; fx.width = L.W; fx.height = L.H;
  fx.setAttribute('aria-hidden', 'true');
  fx.style.cssText = `width:${L.W}px;height:${L.H}px`;
  const land = world.querySelector('.village-land');
  (world.querySelector('.v-fringe') || land).after(fx);
  const fctx = fx.getContext('2d');
  // the standing things: sorted by their feet like everything else that stands in the village
  const stand = [];
  const standing = (cls, at, frames, label) => {
    const el = document.createElement(label ? 'button' : 'canvas');
    el.className = `v-deco ${cls}`;
    const a = frames[0];
    el.style.cssText = `left:${Math.round(at.x - a.ax)}px;top:${Math.round(at.y - a.ay)}px;width:${a.width}px;height:${a.height}px;z-index:${Math.round(at.y)}`;
    let c = el;
    if (label) { el.setAttribute('aria-label', label); c = document.createElement('canvas'); c.className = 'v-deco-art'; el.append(c); } else el.setAttribute('aria-hidden', 'true');
    c.width = a.width; c.height = a.height;
    world.insertBefore(el, world.querySelector('.v-buddy'));
    stand.push({ c, frames });
    return el;
  };
  if (scene?.tree) standing('v-xtree', scene.tree, [0, 1, 2].map((frame) => xmasTreeArt(mapId, { night: nm, frame })));
  if (scene?.lanterns.length) { const art = [0, 1, 2].map((frame) => lanternArt(mapId, { night: nm, frame })); scene.lanterns.forEach((l) => standing('v-xlantern', l, art)); }
  let house = null;
  if (advent) {
    const today = Math.max(1, Math.min(25, Number(String(o.today || '').slice(8, 10)) || 1));
    house = standing('v-advent', advent, [0, 1, 2].map((frame) => adventHouseArt(mapId, { night: nm, frame })), 'The advent calendar house');
    house.addEventListener('click', (e) => { e.stopPropagation(); if (o.xmas?.onAdvent) o.xmas.onAdvent(kid, { mapId }); else (o.onAdvent || openAdventWall)(section, { mapId, today }); });
  }
  // Santa's mailbox by the kid's door, once he has written: his letters book (advent-ui.js)
  const live = o.xm && o.xmas?.live ? o.xmas.live(kid) : null;
  if (live?.letters) {
    const spot = mailboxSpot(L);
    let box;
    if (spot.painted) {
      // the map's own mailbox (painted with the land): just a place to tap, over it
      box = document.createElement('button');
      box.className = 'v-deco v-mailbox painted';
      box.setAttribute('aria-label', "Santa's letters");
      box.style.cssText = `left:${spot.x - 8}px;top:${spot.y - 22}px;width:16px;height:24px;z-index:${spot.y}`;
      world.insertBefore(box, world.querySelector('.v-buddy'));
    } else box = standing('v-mailbox', spot, [0, 1, 2].map(() => mailboxArt({ night: nm })), "Santa's letters");
    box.addEventListener('click', (e) => { e.stopPropagation(); o.xmas.onLetters?.(kid); });
  }
  const draw = (f) => {
    fctx.clearRect(0, 0, L.W, L.H);
    if (sky) fctx.drawImage(sky[f], 0, 0);
    if (lights) fctx.drawImage(lights[f], 0, 0);
    for (const s of stand) { const x = s.c.getContext('2d'); x.clearRect(0, 0, s.c.width, s.c.height); x.drawImage(s.frames[f], 0, 0); }
    section.dataset.twinkle = String(f);
  };
  draw(0);
  // for previews and tests: where the December things stand
  section.kqDecor = { advent: advent && { x: advent.x, y: advent.y }, tree: scene?.tree || null, lanterns: scene?.lanterns || [] };
  // for previews: show one frame and stop the clock
  section.kqTwinkle = (f) => { section.kqTwinkleHeld = true; draw(f % 3); };
  if (!reduce) {
    let last = performance.now(); let f = 0;
    const tick = (now) => {
      if (!fx.isConnected) return;
      if (!section.kqTwinkleHeld && document.visibilityState !== 'hidden' && now - last >= TWINKLE_MS) { last = now; f = (f + 1) % 3; draw(f); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }
  // Santa flies over the first time each December day the kid comes outside (santaart.js decides)
  // (live: the kid's synced state says whether he has flown today, and what waits by the door)
  if (o.xm && o.santa !== false) {
    const sa = live ? { fly: live.fly, waiting: live.waiting, onFly: () => o.xmas.onFly?.(kid), onOpen: () => o.xmas.onPresent?.(kid), paused: o.xmas.paused } : {};
    mountSanta(section, world, L, { night, mapId, today: o.today, kid, advent, onPresent: o.onPresent, ...sa });
  }
  return { house };
}

/**
 * Where Santa's mailbox stands: the map's own painted mailbox when it has one (the meadow's: a
 * tap there opens the letters book, nothing is drawn over it), else on the left of the kid's
 * front door, further left where the present lands on that side (santaart.js presentSpot).
 * { x, y } its foot, painted: true for the map's own.
 */
export function mailboxSpot(L) {
  const own = (L.props || []).find((p) => p.kind === 'mailbox');
  if (own) return { x: own.x + 6, y: own.y + 19, painted: true };
  return { x: Math.round(L.home.x + L.home.w / 2 - (PRESENT_SIDE[L.id] < 0 ? 50 : 22)), y: Math.round(L.home.y + L.home.h + 10) };
}

/** The inside of the advent house over the village: the wall of doors (a sketch of the real screen). */
export function openAdventWall(section, { mapId, today, prizeArt = null }) {
  // (a sketch: the real screen fills opened from the kid's rolled prizes, and passes xmasart.js ornamentArt as prizeArt)
  const opened = {};
  const prizes = ['coins', 'gem', 'ornament', 'coins', 'game', 'coins', 'ornament', 'golden', 'coins', 'gem'];
  for (let n = 1; n < today; n += 1) opened[n] = prizes[(n * 3) % prizes.length];
  const art = adventWallArt({ mapId, today, opened, prizeArt });
  const pop = document.createElement('div');
  pop.className = 'v-advent-wall';
  pop.innerHTML = `<div class="v-advent-card"><h2>Advent calendar</h2><canvas width="${art.width}" height="${art.height}"></canvas><p>Today's door opens when your chores are done.</p><button type="button" class="px-btn">Back outside</button></div>`;
  pop.querySelector('canvas').getContext('2d').drawImage(art, 0, 0);
  pop.querySelector('button').addEventListener('click', () => pop.remove());
  section.querySelector('.village-view').append(pop);
}
