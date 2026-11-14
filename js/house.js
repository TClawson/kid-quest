// The buddy's house, inside: a walkable room plus a bathroom, part of the village world.
// The kid taps to walk the buddy round it, like in the village (same A* walking, same pixel
// scale). The bed, the toothbrush and the floor show today's chores (houserules.js); the
// trophy shelf opens the trophies, the chart on the wall the family leaderboard, the fish
// tank its fish picker (its fish swims in it, fishbook.js) and the book beside it the fish
// book, the turntable (once bought) its records (turntable.js), and the door leads back out
// to the village. houseart.js draws it all.

import { ROOM, TURNTABLE, paintRoom } from './houseart.js';
import { tankSpec } from './tankart.js';
import { makeGrid, findPath, hudBands, camAxis, roomScale } from './village.js';
import { furnitureById } from './furniture.js';
import { fishSpecies } from './fishbook.js';
import { fishPic } from './fishart.js';
import { vaseArt, basketArt as veggieBasketArt, bowlArt } from './gardenart.js';

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
  tank: { x: 156, y: 131 }, // just behind the tank, looking in
  book: { x: 186, y: 131 },
  music: { x: 66, y: 66 }, // in front of the turntable
};
const M = ROOM.at.music;
// the tappable things: [x, y, w, h] boxes over the art
const HOT = {
  shelf: [84, 8, 34, 48],
  chart: [124, 10, 23, 28],
  door: [96, 158, 32, 26],
  bed: [9, 20, 36, 80],
  sink: [250, 8, 24, 52],
  music: [M.x, M.y, TURNTABLE.w, TURNTABLE.h],
};
/**
 * Where the buddy stands to look in the tank and read the fish book, and their tap boxes, for
 * the tank in the house (a bigger one from the shop is bigger, and stands a little elsewhere).
 */
function tankPlaces(spec) {
  const { at, glass, book } = spec;
  return {
    spots: { tank: { x: Math.round(at.x + glass[0] + glass[2] / 2), y: at.y - 2 }, book: { x: at.x + book[0] + book[2] / 2, y: at.y - 2 } },
    hot: { tank: [at.x + glass[0], at.y, glass[2], spec.h], book: [at.x + book[0], at.y + book[1] - 2, book[2], spec.h - book[1] + 2] },
  };
}
/** The house's spots for walking to, with the tank's. */
const spotsFor = (spec) => ({ ...HOUSE_SPOTS, ...tankPlaces(spec).spots });

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
 *   tank: fishbook.js tankFishes(kid, room) (the fish in the tank, [] when empty; the tank itself
 *   is layout.tank, the free little one when none is bought), fish: how many kinds
 *   of fish the kid has caught, garden: { thirsty } (plants waiting for water, for the Garden tag),
 *   harvest: gardenrules.js houseHarvest (the vases, baskets and fruit bowl the garden puts out),
 *   hud: markup laid over a corner of the room (the Today button), or '',
 * }
 */
export function houseHtml(h) {
  const fishes = Array.isArray(h.tank) ? h.tank : h.tank ? [h.tank] : [];
  const data = {
    kid: h.kidId, name: h.kidName, color: h.color, layout: Object.fromEntries(Object.entries(h.layout || {}).map(([k, v]) => [k, v?.id || null])),
    chores: h.chores, mess: h.mess || 0, shelf: h.shelf || 0, gear: h.gear || {},
    tank: fishes.map((f) => ({ species: f.species, len: f.len, nickname: f.nickname })),
    harvest: h.harvest || null,
  };
  const spec = tankSpec(h.layout?.tank?.art);
  const T = spec.at;
  const W = spec.water;
  const hot = { ...HOT, ...tankPlaces(spec).hot };
  // the bubbles rise from the bubblers to the surface, so the water box reaches down to them
  const depth = Math.max(W[3] + 4, ...spec.bubblers.map((b) => b.y - W[1] + 2));
  const tankBubbles = spec.bubblers.flatMap((b, j) => [0, 1, 2].map((i) => `<i class="h-bubble" style="left:${b.x - W[0] + (i % 2)}px;top:${b.y - W[1] - 2}px;--rise:-${spec.rise}px;animation-delay:${(i * 0.9 + j * 0.45).toFixed(2)}s;animation-duration:${(2.7 * Math.max(1, spec.rise / 14) ** 0.6).toFixed(2)}s"></i>`)).join('');
  // the tank's fish swim in the water (clipped to the glass), with bubbles; their names on a plaque
  const names = fishes.map((f) => f.nickname).join(', ');
  const tank = `
          <div class="h-water" style="left:${T.x + W[0]}px;top:${T.y + W[1]}px;width:${W[2]}px;height:${depth}px;z-index:${T.y + spec.h + 1}">
            ${fishes.map(() => '<span class="h-fish" hidden></span>').join('')}
            ${tankBubbles}
          </div>
          <span class="h-plaque ${fishes.length ? '' : 'empty'}" style="left:${T.x + spec.plaque.x}px;top:${T.y + spec.plaque.y}px;z-index:${T.y + spec.h + 3}">${fishes.length ? esc(fishes[0].nickname) : h.fish ? 'Pick a fish!' : 'Empty tank'}</span>`;
  const spot = (id, label, extra = '') => { const [x, y, w, hh] = hot[id]; return `<button class="h-spot" data-spot="${id}" style="left:${x}px;top:${y}px;width:${w}px;height:${hh}px" aria-label="${esc(label)}">${extra}</button>`; };
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
          ${tank}
          ${spot('tank', fishes.length ? `Fish tank: ${names}` : 'Fish tank', `<span class="h-tag">🐟 ${fishes.length ? 'Tank' : h.fish ? 'Pick a fish' : 'Fish tank'}</span>`)}
          ${spot('book', 'Fish book', '<span class="h-tag">📖 Fish book</span>')}
          ${data.layout.music ? `${spot('music', 'Turntable', '<span class="h-tag">🎶 Turntable</span>')}
          <span class="h-spin" style="left:${M.x + TURNTABLE.record.x}px;top:${M.y + TURNTABLE.record.y}px" aria-hidden="true"><i></i></span>
          <span class="h-notes" style="left:${M.x + TURNTABLE.record.x}px;top:${M.y + 2}px" aria-hidden="true"><i>♪</i><i>♫</i><i>♪</i></span>` : ''}
          ${spot('bed', 'Bed')}
          ${spot('sink', 'Sink')}
          ${spot('door', 'Go outside', `<span class="h-tag out">⬇ Outside${h.quests ? ` · ${h.quests} ${h.quests === 1 ? 'quest' : 'quests'}` : ''}</span>`)}
          ${bubbles}
          <div class="v-buddy" style="z-index:100"><div class="v-flip">${h.buddy}</div></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="h-sign">🏠 ${esc(h.kidName)}'s house</div>
        <button class="h-gbtn" data-garden aria-label="Go to the garden">🌱 Garden${h.garden?.thirsty ? `<i>💧${h.garden.thirsty}</i>` : ''}</button>
        <div class="v-dialog" hidden></div>
      </div>
      ${h.hud || ''}
    </section>`;
}

// Per kid, while the app is open: where the buddy stands in the house.
const memory = new Map();

/** The buddy just came in through the door (instead of wherever it was). */
export function cameIn(kidId) { memory.set(kidId, { ...HOUSE_SPOTS.door, face: 1, cam: null, entering: true }); }

// A chore the Today list sent the buddy in for (bed, teeth, floor): kid id -> kind, done when the house opens.
const goals = new Map();
export function houseGoal(kidId, kind) { goals.set(kidId, kind); }

/**
 * Starts every house inside root. handlers: {
 *   onTask(taskId, el): the kid says a chore is done, onTrophies(), onLeaderboard(),
 *   onTank(): the fish picker, onFishBook(), onGarden(): the buddy went out to the garden,
 *   onExit(): the buddy went out the door, sound(name), onTurntable(): the turntable's screen,
 *   spinning(kidId): whether that kid's turntable is playing (the record goes round),
 * }
 */
export function mountHouses(root, handlers) {
  root.querySelectorAll('.house:not(.music-house):not([data-live])').forEach((section) => mount(section, handlers));
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

  harvestPieces(section, world, buddyEl, res.pieces.find((p) => p.id === 'table'), data.harvest);

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

  const SPOTS = spotsFor(tankSpec(data.layout.tank && furnitureById(data.layout.tank)?.art));
  const mem = memory.get(data.kid) || { ...HOUSE_SPOTS.wake, face: 1, cam: null };
  memory.set(data.kid, mem);
  // a walk carries on if the house is redrawn on the way (a chore just done, a sync)
  const me = { x: mem.x, y: mem.y, path: mem.path || [], goal: mem.goal || null, face: mem.face || 1 };
  if (me.path.length) buddyEl.classList.add('walking');
  let S = 3; let vw = 0; let vh = 0;
  // full screen: as big as fits whole (4x on a 1280x800 tablet), and the HUD's top and bottom rows
  // are kept clear by letting the view go a little past the room's edges (hudBands, measured here only)
  let bands = { top: 0, bottom: 0 };
  const measure = () => { vw = view.clientWidth; vh = view.clientHeight; S = roomScale(R.W, R.H, vw, vh); bands = hudBands(section) || bands; };
  const camTarget = () => ({
    x: camAxis(R.W, vw, S, me.x - vw / S / 2),
    y: camAxis(R.H, vh, S, me.y - 12 - (vh / S) * (dialog.hidden ? 0.5 : 0.3), bands.top, bands.bottom),
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
    if (goal.use === 'garden') {
      // out the door and round the back to the garden
      buddyEl.classList.add('going-out');
      handlers.sound?.('tap');
      setTimeout(() => handlers.onGarden?.(), 380);
    } else if (goal.use === 'door') {
      // out the door: a step down through the doorway, then the village
      buddyEl.classList.add('going-out');
      handlers.sound?.('tap');
      setTimeout(() => handlers.onExit?.(), 380);
    } else if (goal.use === 'shelf') handlers.onTrophies?.();
    else if (goal.use === 'chart') handlers.onLeaderboard?.();
    else if (goal.use === 'tank') handlers.onTank?.();
    else if (goal.use === 'book') handlers.onFishBook?.();
    else if (goal.use === 'music') handlers.onTurntable?.();
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
    const spot = what === 'teeth' ? SPOTS.sink : what === 'garden' ? SPOTS.door : SPOTS[what] || SPOTS.floor;
    const goal = { use: what, face: what === 'bed' ? -1 : undefined };
    if (Math.hypot(me.x - spot.x, me.y - spot.y) < 16) { me.goal = goal; arrive(); return; }
    walkTo(spot.x, spot.y, goal);
  };
  // the Today list's Go for a house chore: walk to it and talk about it
  section.goChore = (kind) => use(kind);

  view.addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog')) return;
    e.stopPropagation();
    if (e.target.closest('.h-gbtn')) { handlers.sound?.('tap'); use('garden'); return; }
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

  // the trophy, chart, tank and book tags show when the buddy is close
  const tags = [...section.querySelectorAll('.h-spot[data-spot="shelf"], .h-spot[data-spot="chart"], .h-spot[data-spot="tank"], .h-spot[data-spot="book"], .h-spot[data-spot="music"]')].map((el) => ({ el, at: SPOTS[el.dataset.spot] }));
  const tankSpecNow = tankSpec(data.layout.tank && furnitureById(data.layout.tank)?.art);
  const swim = tankSwimmer(section, data.tank, tankSpecNow);
  const plaque = section.querySelector('.h-plaque');

  let last = performance.now();
  const tick = (now) => {
    if (!section.isConnected) { window.removeEventListener('resize', onResize); return; }
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
    for (const g of tags) g.el.classList.toggle('near', Math.hypot(me.x - g.at.x, me.y - g.at.y) < (g.el.dataset.spot === 'tank' || g.el.dataset.spot === 'book' ? 26 : 48));
    swim?.(now / 1000);
    // with more than one fish, the plaque takes turns saying each one's name
    if (data.tank.length > 1 && plaque) {
      const name = data.tank[Math.floor(now / 3500) % data.tank.length].nickname;
      if (plaque.textContent !== name) plaque.textContent = name;
    }
    // the record goes round (and notes float up) while the turntable plays
    const spin = Boolean(data.layout.music && handlers.spinning?.(data.kid));
    if (spin !== section.classList.contains('tt-on')) section.classList.toggle('tt-on', spin);
    place();
    requestAnimationFrame(tick);
  };
  // removed with the screen (tick stops then too), so redraws don't pile up listeners
  const onResize = () => { if (section.isConnected) measure(); else window.removeEventListener('resize', onResize); };
  window.addEventListener('resize', onResize, { passive: true });
  place();
  requestAnimationFrame(tick);
  const pending = goals.get(data.kid);
  if (pending) { goals.delete(data.kid); use(pending); }
}


// ---- what the garden puts in the house ----
// Vases of flowers and the fruit bowl stand on the table (placed by the table piece's box, since
// the table art differs); baskets of vegetables stand on the floor beside it. Each is its own
// little canvas, sorted with the buddy by where its feet are.
const asCanvas = (doc, art) => {
  if (!art) return null;
  if (art.getContext) return art;
  return art.canvas || null;
};
function harvestPieces(section, world, buddyEl, table, harvest) {
  if (!table || !harvest) return;
  const doc = section.ownerDocument;
  const put = (art, id, cx, footY, z) => {
    const src = asCanvas(doc, art);
    if (!src) return;
    const c = doc.createElement('canvas');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
    c.className = 'h-piece';
    c.dataset.piece = id;
    c.style.cssText = `left:${Math.round(cx - (src.ax ?? src.width / 2))}px;top:${Math.round(footY - (src.ay ?? src.height))}px;width:${src.width}px;height:${src.height}px;z-index:${z}`;
    world.insertBefore(c, buddyEl);
  };
  // the tabletop: its middle (the small table has its chair on the left, the others a chair at each end)
  // and a little way down the piece
  const cx = table.x + table.w * (table.w < 56 ? 0.64 : 0.5);
  const top = table.y + Math.round(table.h * TABLE_TOP);
  const z = table.foot + 1;
  const vases = harvest.vases || [];
  const bowl = harvest.bowl?.length;
  // with the bowl in front in the middle, the first two vases stand behind it at each side
  const on = vases.slice(0, 2);
  on.forEach((seed, i) => put(vaseArt(seed), `vase${i}`, cx + (bowl ? (i ? 11 : -11) : on.length === 1 ? 0 : (i ? 8 : -8)), top + 2, z));
  if (bowl) put(bowlArt(harvest.bowl), 'bowl', cx + 1, top + 6, z + 1);
  // a third vase stands on the floor in front of the table
  if (vases[2]) put(vaseArt(vases[2]), 'vase2', table.x + 8, table.foot + 6, table.foot + 6);
  (harvest.baskets || []).forEach((seed, i) => put(veggieBasketArt(seed), `basket${i}`, table.x + table.w + 6 + i * 13, table.foot - 1 - (i % 2) * 2, table.foot - 1 + (i % 2)));
}
const TABLE_TOP = 0.42;

// ---- the fish tank ----
const fishCache = new Map();
// Fish are drawn with 2 fine pixels for each village pixel, as in the fishing game, so even a
// little one has its colors, scales and fins (at 1 it would be mostly outline).
const FZ = 2;
/** A tank fish as a canvas (FZ fine pixels per village pixel), small enough for its tank's water. */
function tankFishPic(species, len, water) {
  const key = `${species}|${len}|${water[2]}x${water[3]}`;
  if (!fishCache.has(key)) {
    const sp = fishSpecies(species);
    if (!sp) return null;
    let n = len; let pic = fishPic(sp.look, n, FZ);
    while (n > 8 && (pic.height / FZ > water[3] + 2 || pic.width / FZ > water[2] * 0.62)) { n -= 1; pic = fishPic(sp.look, n, FZ); }
    fishCache.set(key, pic);
  }
  return fishCache.get(key);
}

/**
 * Puts the tank's fish in the water and returns tick(seconds) to swim them: back and forth along
 * the tank, turning round at the ends, bobbing a little. With more than one, each keeps to its
 * own depth (drifting up and down a bit), at its own pace, and they start at different places.
 * Null for an empty tank.
 */
function tankSwimmer(section, fishes, spec) {
  const holders = [...section.querySelectorAll('.h-fish')];
  const [, , w, h] = spec.water;
  const swimmers = (fishes || []).map((f, i) => {
    const holder = holders[i];
    const pic = holder && tankFishPic(f.species, f.len || 14, spec.water);
    if (!pic) return null;
    const c = section.ownerDocument.createElement('canvas');
    c.width = pic.width; c.height = pic.height;
    c.getContext('2d').drawImage(pic, 0, 0);
    holder.append(c);
    const pw = pic.width / FZ; const ph = pic.height / FZ;
    holder.style.width = `${pw}px`; holder.style.height = `${ph}px`;
    holder.hidden = false;
    const n = fishes.length;
    const span = Math.max(1, w - pw + 2); // from just past the left glass to the right
    const lap = (7 + span / 6) * (1 + 0.17 * ((i * 3) % 5) / 2); // seconds there and back
    const room = Math.max(0, h + 3 - ph); // how far down the fish can go
    const lane = n === 1 ? 0.5 : 0.1 + (0.8 * i) / (n - 1); // top to bottom
    const midY = Math.max(-1, Math.min(room, Math.round(room * Math.min(0.9, lane))));
    const drift = n > 1 ? Math.min(4, room * 0.12) : 0;
    return { holder, span, lap, midY, drift, room, off: (i * 0.37) % 1, i };
  }).filter(Boolean);
  if (!swimmers.length) return null;
  return (t) => {
    for (const s of swimmers) {
      const k = ((t / s.lap) + s.off) % 1; // 0..1: right then back left, easing at the ends
      const going = k < 0.5;
      const e = 0.5 - 0.5 * Math.cos(Math.PI * (going ? k * 2 : (1 - k) * 2));
      const x = Math.round((-1 + e * s.span) * FZ) / FZ;
      const yy = s.midY + Math.sin(t * 1.7 + s.i * 2.1) * 1.4 + Math.sin(t * 0.23 + s.i * 1.3) * s.drift;
      const y = Math.round(Math.max(-1, Math.min(s.room, yy)) * FZ) / FZ;
      s.holder.style.transform = `translate(${x}px, ${y}px)${going ? ' scaleX(-1)' : ''}`;
    }
  };
}
