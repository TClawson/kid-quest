// Walking round a room seen from above and a little in front, like the village: tap the
// floor and the buddy walks there round the furniture (the village's A* walking, at the
// same pixel scale), and the view follows it. The music house uses it (musichouse.js).

import { makeGrid, findPath, hudBands, camAxis, roomScale } from './village.js';

/**
 * Starts the walking in a room's section (.village-view > .village-world with a .v-buddy,
 * its .v-flip and a .v-target). o: {
 *   section, W, H: the room's size in village pixels,
 *   obstacles: [[x, y, w, h]...] where the buddy can't walk,
 *   mem: this kid's memory of the room: { x, y, face, cam, S, path, goal }, kept up to date
 *     so a redraw (a sync, a chore done) carries on where the buddy was,
 *   talking(): whether a talk box covers the bottom of the view (the view leans up then),
 *   onArrive(goal): the buddy got where it was going (goal as given to walkTo; null for a tap on the floor),
 *   onTick(me, now): every frame, after the buddy moved,
 * }
 * Returns { me, walkTo(x, y, goal), go(spot, goal, near = 16), floorTap(event), stop() }.
 */
export function walkRoom(o) {
  const { section, W, H, mem } = o;
  const view = section.querySelector('.village-view');
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const flip = section.querySelector('.v-flip');
  const targetEl = section.querySelector('.v-target');
  const grid = makeGrid({ W, H, chest: { x: -100, y: -100 }, onBridge: () => false, inWater: () => false, obstacles: o.obstacles });
  const talking = o.talking || (() => false);

  const me = { x: mem.x, y: mem.y, path: mem.path || [], goal: mem.goal || null, face: mem.face || 1 };
  if (me.path.length) buddyEl.classList.add('walking');
  let S = 3; let vw = 0; let vh = 0;
  // full screen: as big as fits whole (4x on a 1280x800 tablet), and the HUD's top and bottom rows
  // are kept clear by letting the view go a little past the room's edges (hudBands, measured here only)
  let bands = { top: 0, bottom: 0 };
  const measure = () => { vw = view.clientWidth; vh = view.clientHeight; S = roomScale(W, H, vw, vh); bands = hudBands(section) || bands; };
  const camTarget = () => ({
    x: camAxis(W, vw, S, me.x - vw / S / 2),
    y: camAxis(H, vh, S, me.y - 12 - (vh / S) * (talking() ? 0.3 : 0.5), bands.top, bands.bottom),
  });
  measure();
  const cam = mem.cam && mem.S === S ? { ...mem.cam } : camTarget();
  const place = () => {
    world.style.transform = `translate(${Math.round(-cam.x * S)}px, ${Math.round(-cam.y * S)}px) scale(${S})`;
    buddyEl.style.left = `${me.x}px`;
    buddyEl.style.top = `${me.y}px`;
    buddyEl.style.zIndex = Math.round(me.y);
    flip.style.transform = me.face < 0 ? 'scaleX(-1)' : '';
  };

  const arrive = () => {
    const goal = me.goal;
    me.goal = null;
    buddyEl.classList.remove('walking');
    targetEl.hidden = true;
    if (goal?.face) me.face = goal.face;
    o.onArrive?.(goal);
  };
  const walkTo = (x, y, goal = null) => {
    me.path = findPath(grid, me, { x, y });
    me.goal = goal;
    if (!me.path.length) { arrive(); return; }
    buddyEl.classList.add('walking');
  };
  // walk to a spot, or use it straight away when the buddy is already there
  const go = (spot, goal, near = 16) => {
    if (Math.hypot(me.x - spot.x, me.y - spot.y) < near) { me.path = []; me.goal = goal; arrive(); return; }
    walkTo(spot.x, spot.y, goal);
  };
  const floorTap = (e) => {
    const r = view.getBoundingClientRect();
    const x = (e.clientX - r.left) / S + cam.x;
    const y = (e.clientY - r.top) / S + cam.y;
    targetEl.style.left = `${x}px`; targetEl.style.top = `${y}px`;
    targetEl.hidden = false;
    targetEl.classList.remove('pop'); void targetEl.offsetWidth; targetEl.classList.add('pop');
    walkTo(x, y);
  };

  let last = performance.now();
  let stopped = false;
  const onResize = () => { if (section.isConnected) measure(); else window.removeEventListener('resize', onResize); };
  const tick = (now) => {
    if (stopped || !section.isConnected) { window.removeEventListener('resize', onResize); return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (me.path.length) {
      let step = 90 * dt;
      while (step > 0 && me.path.length) {
        const t = me.path[0];
        const dx = t.x - me.x; const dy = t.y - me.y; const d = Math.hypot(dx, dy);
        if (Math.abs(dx) > 0.5) me.face = dx > 0 ? 1 : -1;
        if (d <= step) { me.x = t.x; me.y = t.y; me.path.shift(); step -= d; } else { me.x += (dx / d) * step; me.y += (dy / d) * step; step = 0; }
      }
      if (!me.path.length) arrive();
    }
    const t = camTarget();
    const k = Math.min(1, dt * 5);
    cam.x += (t.x - cam.x) * k; cam.y += (t.y - cam.y) * k;
    Object.assign(mem, { x: me.x, y: me.y, face: me.face, cam, S, path: me.path, goal: me.goal });
    o.onTick?.(me, now);
    place();
    requestAnimationFrame(tick);
  };
  // removed with the screen (tick stops then too), so redraws don't pile up listeners
  window.addEventListener('resize', onResize, { passive: true });
  place();
  requestAnimationFrame(tick);
  return { me, walkTo, go, floorTap, stop: () => { stopped = true; } };
}
