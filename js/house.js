// The buddy's house, inside: a walkable room plus a bathroom, part of the village world.
// The kid taps to walk the buddy round it, like in the village (same A* walking, same pixel
// scale). The bed, the toothbrush and the floor show today's chores (houserules.js); the
// trophy shelf opens the trophies, the chart on the wall the family leaderboard, and the
// door leads back out to the village. houseart.js draws it all.

import { ROOM, paintRoom } from './houseart.js';
import { makeGrid, findPath } from './village.js';
import { furnitureById } from './furniture.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const R = ROOM;

// where the buddy stands to use each thing (village pixels: the buddy's feet)
export const HOUSE_SPOTS = {
  door: { x: 112, y: 166 },
  wake: { x: 54, y: 82 }, // beside the bed, first thing in the morning
  shelf: { x: 101, y: 64 },
  chart: { x: 135, y: 62 },
  bed: { x: 54, y: 74 },
  sink: { x: 262, y: 66 },
  floor: { x: 120, y: 142 },
};
// the tappable things: [x, y, w, h] boxes over the art
const HOT = {
  shelf: [84, 8, 34, 48],
  chart: [124, 10, 23, 28],
  door: [96, 158, 32, 26],
  bed: [9, 20, 36, 80],
  sink: [250, 8, 24, 52],
};
// the floating bubbles over a chore that's still to do
const BUBBLE = { bed: { x: 26, y: 30 }, teeth: { x: 262, y: 22 }, floor: { x: 120, y: 84 } };

const SAY = {
  bed: (n) => `Good morning, ${n}! The bed is all rumpled. Time to make it?`,
  teeth: (n) => `The toothbrush is out and ready, ${n}. Brush those teeth?`,
  floor: [
    '',
    (n) => `A few things are on the floor, ${n}. Pick them up?`,
    (n) => `Oh no, ${n}, it's getting messy in here! Pick up the floor?`,
    (n) => `Whoa! ${n}, this room is a disaster! Time to pick it all up?`,
  ],
};
const DONE_SAY = {
  bed: (n) => `The bed is nice and tidy. Good job, ${n}!`,
  teeth: () => 'Sparkly clean teeth! The toothbrush is put away.',
};

/**
 * The house for a kid. h: {
 *   kidId, kidName, color, buddy: live buddy markup,
 *   layout: homeLayout(kid), chores: { bed, teeth, floor: { id, name, icon, st, verify, timer, sub } or null },
 *   mess (0-3), shelf (0-3), gear: bestGear(owned), quests: quests left outside (for the door sign),
 * }
 */
export function houseHtml(h) {
  const data = {
    kid: h.kidId, name: h.kidName, color: h.color, layout: Object.fromEntries(Object.entries(h.layout || {}).map(([k, v]) => [k, v?.id || null])),
    chores: h.chores, mess: h.mess || 0, shelf: h.shelf || 0, gear: h.gear || {},
  };
  const spot = (id, label, extra = '') => { const [x, y, w, hh] = HOT[id]; return `<button class="h-spot" data-spot="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px" aria-label="${esc(label)}">${extra}</button>`; };
  const bubbles = Object.entries(BUBBLE).map(([kind, at]) => {
    const t = h.chores?.[kind];
    if (!t || t.st === 'done') return '';
    return `<button class="h-chore st-${t.st === 'pending' ? 'pending' : 'todo'}" data-chore="${kind}" style="left:${at.x}px;top:${at.y}px;z-index:400" aria-label="${esc(t.name)}"><span class="v-bubble"><span class="v-icon">${esc(t.icon)}</span>${t.st === 'pending' ? '<span class="v-badge wait">⏳</span>' : ''}</span></button>`;
  }).join('');
  return `
    <section class="house" data-kid="${esc(h.kidId)}" data-h="${esc(JSON.stringify(data))}">
      <div class="village-view house-view">
        <div class="village-world" style="width:${R.W}px;height:${R.H}px">
          <canvas class="house-room" width="${R.W}" height="${R.H}" aria-hidden="true"></canvas>
          ${spot('shelf', 'Trophy shelf', '<span class="h-tag">🏆</span>')}
          ${spot('chart', 'Family game scores', '<span class="h-tag">📊</span>')}
          ${spot('bed', 'Bed')}
          ${spot('sink', 'Sink')}
          ${spot('door', 'Go outside', `<span class="h-tag out">⬇ Outside${h.quests ? ` · ${h.quests} ${h.quests === 1 ? 'quest' : 'quests'}` : ''}</span>`)}
          ${bubbles}
          <div class="v-buddy" style="z-index:100"><div class="v-flip">${h.buddy}</div></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="h-sign">🏠 ${esc(h.kidName)}'s house</div>
        <div class="v-dialog" hidden></div>
      </div>
    </section>`;
}

// Per kid, while the app is open: where the buddy stands in the house.
const memory = new Map();

/** The buddy just came in through the door (instead of wherever it was). */
export function cameIn(kidId) { memory.set(kidId, { ...HOUSE_SPOTS.door, face: 1, cam: null, entering: true }); }

/**
 * Starts every house inside root. handlers: {
 *   onTask(taskId, el): the kid says a chore is done, onTrophies(), onLeaderboard(),
 *   onExit(): the buddy went out the door, sound(name),
 * }
 */
export function mountHouses(root, handlers) {
  root.querySelectorAll('.house:not([data-live])').forEach((section) => mount(section, handlers));
}

let roomCache = { key: '', canvas: null, res: null };
function room(doc, data) {
  const key = JSON.stringify([data.layout, data.chores && Object.fromEntries(Object.entries(data.chores).map(([k, v]) => [k, v ? v.st : null])), data.mess, data.shelf, data.gear, data.color]);
  if (roomCache.key !== key) {
    const canvas = doc.createElement('canvas');
    const done = (k) => !data.chores?.[k] || data.chores[k].st === 'done' || data.chores[k].st === 'pending';
    const layout = Object.fromEntries(Object.entries(data.layout).map(([k, id]) => [k, id ? furnitureById(id) : null]));
    const res = paintRoom(canvas, { layout, made: done('bed'), teeth: done('teeth'), mess: data.mess, shelf: data.shelf, gear: data.gear, color: data.color });
    roomCache = { key, canvas, res };
  }
  return roomCache;
}

function mount(section, handlers) {
  section.dataset.live = '1';
  const data = JSON.parse(section.dataset.h);
  const view = section.querySelector('.village-view');
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const flip = section.querySelector('.v-flip');
  const dialog = section.querySelector('.v-dialog');
  const targetEl = section.querySelector('.v-target');
  const { canvas, res } = room(section.ownerDocument, data);
  section.querySelector('.house-room').getContext('2d').drawImage(canvas, 0, 0);
  // the pieces standing out on the floor, sorted with the buddy by where their feet are
  for (const p of res.pieces) {
    const c = section.ownerDocument.createElement('canvas');
    c.width = p.canvas.width; c.height = p.canvas.height;
    c.getContext('2d').drawImage(p.canvas, 0, 0);
    c.className = 'h-piece';
    c.dataset.piece = p.id;
    c.style.cssText = `left:${p.x}px;top:${p.y}px;width:${p.w}px;height:${p.h}px;z-index:${p.foot}`;
    world.insertBefore(c, buddyEl);
  }

  // where the buddy can walk: the floor, round the furniture, through the bathroom doorway
  const pt = R.partition;
  const L = {
    W: R.W, H: R.H, chest: { x: -100, y: -100 },
    onBridge: () => false, inWater: () => false,
    obstacles: [
      [0, 0, R.W, R.floorTop + 5], [0, 0, 7, R.H], [R.W - 7, 0, 7, R.H],
      [0, R.floorBottom - 1, R.door.x, 20], [R.door.x + R.door.w, R.floorBottom - 1, R.W, 20],
      [pt.x, 0, pt.w, pt.gapTop], [pt.x, pt.gapBottom, pt.w, R.H],
      ...res.blocks,
    ],
  };
  const grid = makeGrid(L);

  const mem = memory.get(data.kid) || { ...HOUSE_SPOTS.wake, face: 1, cam: null };
  memory.set(data.kid, mem);
  // a walk carries on if the house is redrawn on the way (a chore just done, a sync)
  const me = { x: mem.x, y: mem.y, path: mem.path || [], goal: mem.goal || null, face: mem.face || 1 };
  if (me.path.length) buddyEl.classList.add('walking');
  let S = 3; let vw = 0; let vh = 0;
  const measure = () => { vw = view.clientWidth; vh = view.clientHeight; S = vw >= 600 ? 3 : 2; };
  const camTarget = () => ({
    x: R.W * S <= vw ? -(vw / S - R.W) / 2 : Math.max(0, Math.min(R.W - vw / S, me.x - vw / S / 2)),
    y: R.H * S <= vh ? -(vh / S - R.H) / 2 : Math.max(0, Math.min(R.H - vh / S, me.y - 12 - (vh / S) * (dialog.hidden ? 0.5 : 0.3))),
  });
  measure();
  let cam = mem.cam && mem.S === S ? { ...mem.cam } : camTarget();
  const place = () => {
    world.style.transform = `translate(${Math.round(-cam.x * S)}px, ${Math.round(-cam.y * S)}px) scale(${S})`;
    buddyEl.style.left = `${me.x}px`;
    buddyEl.style.top = `${me.y}px`;
    buddyEl.style.zIndex = Math.round(me.y);
    flip.style.transform = me.face < 0 ? 'scaleX(-1)' : '';
  };
  // just in through the door: a step in from the doorway
  if (mem.entering) {
    mem.entering = false;
    buddyEl.classList.add('coming-in');
    setTimeout(() => buddyEl.classList.remove('coming-in'), 450);
  }

  // ---- talking ----
  const closeDialog = () => { dialog.hidden = true; dialog.innerHTML = ''; section.classList.remove('talking'); };
  const doLabel = (q) => (q.timer && !/^Time done/.test(q.sub || '') ? '▶ Start the timer' : q.verify === 'parent' ? '🙋 I did it! Ask a parent' : '✓ I did it!');
  const say = (text, quest, buttons) => {
    dialog.innerHTML = `<div class="v-talk"><b class="v-name">${esc(data.name)}'s house</b><p class="v-text">${esc(text)}</p>${quest}<div class="v-buttons">${buttons}</div></div>`;
    dialog.hidden = false;
    section.classList.add('talking');
    handlers.sound?.('talk');
  };
  const choreTalk = (kind) => {
    const t = data.chores?.[kind];
    if (!t) return false;
    if (t.st === 'done') { if (DONE_SAY[kind]) { say(DONE_SAY[kind](data.name), '', '<button class="btn" data-h="bye">OK!</button>'); return true; } return false; }
    const text = t.st === 'pending' ? 'Great job! Now a grown-up needs to check it.' : kind === 'floor' ? SAY.floor[Math.max(1, data.mess)](data.name) : SAY[kind](data.name);
    const quest = `<div class="v-quest"><span class="v-quest-icon">${esc(t.icon)}</span><span><b>${esc(t.name)}</b><small>${esc(t.sub || '')}</small></span></div>`;
    const btn = t.st === 'pending' ? '🙋 Ask a parent now' : doLabel(t);
    say(text, quest, `<button class="btn" data-h="do" data-q="${esc(t.id)}">${btn}</button><button class="btn ghost" data-h="bye">Not yet</button>`);
    return true;
  };
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-h]');
    if (!b) return;
    e.stopPropagation();
    closeDialog();
    if (b.dataset.h === 'do') handlers.onTask?.(b.dataset.q, buddyEl);
  });

  // ---- walking ----
  const arrive = () => {
    const goal = me.goal;
    me.goal = null;
    buddyEl.classList.remove('walking');
    targetEl.hidden = true;
    if (!goal) return;
    if (goal.face) me.face = goal.face;
    if (goal.use === 'door') {
      // out the door: a step down through the doorway, then the village
      buddyEl.classList.add('going-out');
      handlers.sound?.('tap');
      setTimeout(() => handlers.onExit?.(), 380);
    } else if (goal.use === 'shelf') handlers.onTrophies?.();
    else if (goal.use === 'chart') handlers.onLeaderboard?.();
    else if (goal.use) choreTalk(goal.use);
  };
  const walkTo = (x, y, goal = null) => {
    closeDialog();
    me.path = findPath(grid, me, { x, y });
    me.goal = goal;
    if (!me.path.length) { arrive(); return; }
    buddyEl.classList.add('walking');
  };
  const use = (what) => {
    const spot = what === 'teeth' ? HOUSE_SPOTS.sink : HOUSE_SPOTS[what] || HOUSE_SPOTS.floor;
    const goal = { use: what, face: what === 'bed' ? -1 : undefined };
    if (Math.hypot(me.x - spot.x, me.y - spot.y) < 16) { me.goal = goal; arrive(); return; }
    walkTo(spot.x, spot.y, goal);
  };

  view.addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog')) return;
    e.stopPropagation();
    const chore = e.target.closest('.h-chore');
    if (chore) { handlers.sound?.('tap'); use(chore.dataset.chore); return; }
    const sp = e.target.closest('.h-spot');
    if (sp) {
      handlers.sound?.('tap');
      const k = sp.dataset.spot;
      // the bed and the sink talk about their chore (or say how tidy they are)
      if (k === 'sink') { use('teeth'); return; }
      use(k);
      return;
    }
    if (!dialog.hidden) { closeDialog(); return; }
    const r = view.getBoundingClientRect();
    const x = (e.clientX - r.left) / S + cam.x;
    const y = (e.clientY - r.top) / S + cam.y;
    targetEl.style.left = `${x}px`; targetEl.style.top = `${y}px`;
    targetEl.hidden = false;
    targetEl.classList.remove('pop'); void targetEl.offsetWidth; targetEl.classList.add('pop');
    walkTo(x, y);
  });

  // the trophy and chart tags show when the buddy is close
  const tags = [...section.querySelectorAll('.h-spot[data-spot="shelf"], .h-spot[data-spot="chart"]')].map((el) => ({ el, at: HOUSE_SPOTS[el.dataset.spot] }));

  let last = performance.now();
  const tick = (now) => {
    if (!section.isConnected) return;
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
    for (const g of tags) g.el.classList.toggle('near', Math.hypot(me.x - g.at.x, me.y - g.at.y) < 48);
    place();
    requestAnimationFrame(tick);
  };
  window.addEventListener('resize', measure, { passive: true });
  place();
  requestAnimationFrame(tick);
}

