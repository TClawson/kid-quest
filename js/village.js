// The walkable village: a different way to see today's chores. Each chore is a quest
// from a villager, who has a little picture of the chore floating over their head.
// Tap the ground and the buddy walks there; tap a villager and the buddy walks over
// and the villager says what they need. Morning quests are up by the kid's house;
// after-school quests are across the bridge, so crossing the river means school's out.
// Arrows on the edges point to villagers off screen who still have a quest.
//
// The village is drawn in village pixels (1 canvas pixel each) and shown at 3 screen
// pixels per village pixel on a tablet (2 on a phone), so it lines up with the
// buddies' pixels. The land is in villageart.js; app.js decides what a tap on a
// quest does (the same as tapping the chore anywhere else).

import { paintVillage, drawVillager, VILLAGER_KINDS, villagerGrid } from './villageart.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- layout (village pixels) ----------

const W = 448;
const H = 480;
const CX = W / 2;

const HOME = { x: CX - 50, y: 30, w: 100, h: 78 };
const COTTAGES = [
  { x: 34, y: 50, w: 80, h: 66, roof: '#4c6ef5', shutter: '#e03131' },
  { x: W - 114, y: 50, w: 80, h: 66, roof: '#2f9e44', shutter: '#f08c00' },
  { x: 30, y: 300, w: 96, h: 74, roof: '#7048e8', shutter: '#fcc419', sign: 'note' }, // the music hall
];
const WELL = { x: CX - 13, y: 140 };
const RIVER = { y0: 240, y1: 266 };
const BRIDGE = { x: CX - 16, y0: 236, y1: 270, w: 32 };
const PATHS = [
  [[CX, HOME.y + HOME.h + 3], [CX, 448]],
  [[CX, 132], [74, 132], [74, 119]],
  [[CX, 132], [W - 74, 132], [W - 74, 119]],
  [[CX, 392], [78, 392], [78, 377]],
  [[CX, 316], [W - 70, 316], [W - 70, 336]],
];
const PLAZAS = [[CX, 166, 30], [CX, 428, 30]];
const GARDENS = [{ x: 34, y: 150, w: 62, h: 34 }];
const FENCES = [{ x: 32, y: 188, w: 66 }];
const STALLS = [{ x: W - 100, y: 154 }];
const LAUNDRY = [{ x: W - 112, y: 340, w: 84 }];
const SIGNS = [];
const FLOWER_BEDS = [[HOME.x - 14, HOME.y + HOME.h - 10], [HOME.x + HOME.w + 2, HOME.y + HOME.h - 10], [150, 300], [290, 452]];
const BUSHES = [[HOME.x - 22, HOME.y + 40, true], [HOME.x + HOME.w + 4, HOME.y + 40, false], [128, 214, false], [300, 214, true], [150, 368, true], [250, 352, false], [330, 440, false], [118, 452, true]];
// the forest round the edge, plus a few trees inside
const TREES = (() => {
  const t = [];
  for (let x = -14; x < W; x += 26) { t.push([x, -16 + ((x / 26) % 2 ? 5 : 0)]); t.push([x, H - 30 + ((x / 26) % 2 ? 0 : 6)]); }
  for (let y = 4; y < H - 30; y += 30) { t.push([-18 + ((y / 30) % 2 ? 4 : 0), y]); t.push([W - 14 - ((y / 30) % 2 ? 4 : 0), y]); }
  t.push([118, 66], [298, 66], [380, 190], [140, 308], [360, 386], [40, 400], [290, 362]);
  return t;
})();

// where quest givers stand (their feet), in the order quests fill them
const SLOTS = {
  morning: [
    { x: 150, y: 120 }, { x: 298, y: 120 }, { x: 74, y: 140 }, { x: W - 74, y: 140 },
    { x: 172, y: 206 }, { x: 276, y: 206 }, { x: 116, y: 176 }, { x: 332, y: 186 },
  ],
  afternoon: [
    { x: 78, y: 412, likes: /piano|music|practice|violin|guitar|sing|instrument/i },
    { x: W - 60, y: 372, likes: /laundry|clothes|fold|wash/i },
    { x: 170, y: 306 }, { x: 290, y: 306 }, { x: 170, y: 420 }, { x: 290, y: 420 },
    { x: 384, y: 300 }, { x: 64, y: 290 },
  ],
};
const CHEST = { x: CX, y: 436 };
const START = { x: CX, y: HOME.y + HOME.h + 14 };

// Obstacles the buddy walks round: [x, y, w, h]
const OBSTACLES = [
  [0, 0, W, 22], [0, H - 18, W, 18], [0, 0, 20, H], [W - 20, 0, 20, H],
  [HOME.x, HOME.y - 6, HOME.w, HOME.h + 4],
  ...COTTAGES.map((c) => [c.x, c.y - 6, c.w, c.h + 4]),
  [WELL.x, WELL.y + 14, 26, 16],
  ...GARDENS.map((g) => [g.x, g.y, g.w, g.h + 14]),
  ...STALLS.map((s) => [s.x, s.y + 12, 44, 20]),
  ...LAUNDRY.map((l) => [l.x, l.y + 18, 4, 8]).concat(LAUNDRY.map((l) => [l.x + l.w - 4, l.y + 18, 4, 8])),
  ...BUSHES.map(([x, y]) => [x + 1, y + 2, 16, 10]),
  ...TREES.map(([x, y]) => [x + 6, y + 14, 20, 24]),
];
const RIVER_BLOCK = [0, RIVER.y0 - 2, W, RIVER.y1 - RIVER.y0 + 6];

const inRect = (x, y, [rx, ry, rw, rh], pad = 0) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad;
const onPath = (x, y, d) => PATHS.some((p) => p.some((q, i) => i > 0 && segDist(x, y, p[i - 1], q) < d)) || PLAZAS.some(([px, py, r]) => Math.hypot(x - px, y - py) < r + d);
function segDist(x, y, [x0, y0], [x1, y1]) {
  const dx = x1 - x0; const dy = y1 - y0; const l = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - x0) * dx + (y - y0) * dy) / l));
  return Math.hypot(x - (x0 + t * dx), y - (y0 + t * dy));
}

export const LAYOUT = {
  W, H, home: HOME, cottages: COTTAGES, well: WELL, river: RIVER, bridge: BRIDGE, paths: PATHS, plazas: PLAZAS,
  gardens: GARDENS, fences: FENCES, stalls: STALLS, laundry: LAUNDRY, signs: SIGNS, flowerBeds: FLOWER_BEDS, bushes: BUSHES, trees: TREES,
  blocked: (x, y, pad = 0) => OBSTACLES.some((r) => inRect(x, y, r, pad)),
  onPath,
};

// ---------- villagers ----------

const NAMES = { bunny: 'Clover', beaver: 'Bucky', owl: 'Hoot', frog: 'Fiddle', sheep: 'Wooly', hedgehog: 'Hazel', raccoon: 'Rory', mouse: 'Pip' };
const SPECIES_NAMES = { bunny: 'the Bunny', beaver: 'the Beaver', owl: 'the Owl', frog: 'the Frog', sheep: 'the Sheep', hedgehog: 'the Hedgehog', raccoon: 'the Raccoon', mouse: 'the Mouse' };
// who gives which chore, when the chore's name fits (beavers know about teeth)
const LIKES = [
  ['beaver', /teeth|tooth|brush|floss/i],
  ['owl', /bed|sleep|pajama|pyjama/i],
  ['raccoon', /floor|toy|tidy|pick up|room/i],
  ['frog', /piano|music|practice|violin|guitar|sing/i],
  ['sheep', /laundry|clothes|fold|wash/i],
  ['hedgehog', /vacuum|dust|sweep|deep clean|mop/i],
  ['mouse', /read|book|homework|study|math/i],
  ['bunny', /dish|kitchen|table|garden|plant|water|pet|feed/i],
];
const HELLO = {
  bunny: (n) => `Hop hop! Hi ${n}! Here's something only you can do:`,
  beaver: (n) => `Hey ${n}! Busy beavers get things done. Here's your quest:`,
  owl: (n) => `Hoo! ${n}, a wise buddy like you can surely do this:`,
  frog: (n) => `Ribbit! ${n}, ready to hop to it?`,
  sheep: (n) => `Baa-hello, ${n}! Could you help with this?`,
  hedgehog: (n) => `Hi ${n}! I'd do it myself, but I'm a little prickly. Could you?`,
  raccoon: (n) => `Psst, ${n}! I've got a secret mission for you:`,
  mouse: (n) => `Squeak! Oh, ${n}! A small quest for a big hero:`,
};
const THANKS = {
  bunny: (n) => `Hoppy day! Thank you, ${n}!`,
  beaver: (n) => `Dam-tastic work, ${n}! Thank you!`,
  owl: (n) => `Hoo-ray! Very wise, ${n}. Thank you!`,
  frog: (n) => `Toad-ally awesome, ${n}! Thanks!`,
  sheep: (n) => `Thanks a ton, ${n}! I'm so happy I could baa.`,
  hedgehog: (n) => `You're the best, ${n}! Have a (gentle) hug.`,
  raccoon: (n) => `Mission complete! You're a legend, ${n}.`,
  mouse: (n) => `Squeak squeak hooray! Thanks, ${n}!`,
};

/**
 * Who gives each quest and where they stand. tasks: [{ id, name, period }] in plan order.
 * Returns [{ task, kind, x, y }]. The same tasks always give the same answer.
 */
export function placeVillagers(tasks) {
  const out = [];
  const used = new Set();
  const pickKind = (task) => {
    const fit = LIKES.find(([k, re]) => !used.has(k) && re.test(task.name));
    const kind = fit ? fit[0] : VILLAGER_KINDS.find((k) => !used.has(k) && !LIKES.some(([lk, re]) => lk === k && tasks.some((t) => re.test(t.name)))) || VILLAGER_KINDS.find((k) => !used.has(k)) || VILLAGER_KINDS[out.length % VILLAGER_KINDS.length];
    used.add(kind);
    return kind;
  };
  // kinds that fit a chore by name are given out first, so a later chore can't take them
  const kinds = new Map();
  tasks.forEach((t) => { const fit = LIKES.find(([k, re]) => !used.has(k) && re.test(t.name)); if (fit) { kinds.set(t.id, fit[0]); used.add(fit[0]); } });
  tasks.forEach((t) => { if (!kinds.has(t.id)) kinds.set(t.id, pickKind(t)); });
  for (const period of ['morning', 'afternoon']) {
    const list = tasks.filter((t) => (period === 'morning' ? t.period === 'morning' : t.period !== 'morning'));
    const slots = SLOTS[period].map((s) => ({ ...s, taken: false }));
    const at = new Map();
    // chores that belong somewhere (piano at the music hall) go there first
    list.forEach((t) => { const s = slots.find((x) => !x.taken && x.likes?.test(t.name)); if (s) { s.taken = true; at.set(t.id, s); } });
    list.forEach((t) => {
      if (at.has(t.id)) return;
      let s = slots.find((x) => !x.taken && !x.likes) || slots.find((x) => !x.taken);
      if (!s) { const n = at.size; s = { x: 80 + (n % 5) * 70, y: period === 'morning' ? 196 : 446 - 30 * Math.floor(n / 5) }; }
      s.taken = true;
      at.set(t.id, s);
    });
    list.forEach((t) => out.push({ task: t, kind: kinds.get(t.id), x: at.get(t.id).x, y: at.get(t.id).y }));
  }
  return out;
}

export const villagerName = (kind) => `${NAMES[kind]} ${SPECIES_NAMES[kind]}`;

// ---------- markup ----------

/**
 * The village for a kid. v: {
 *   kidId, kidName, kidColor, buddy: live buddy markup,
 *   tasks: [{ id, name, icon, period, st: 'todo'|'current'|'pending'|'done', sub, verify, timer }],
 *   chest: { html, ready, opened, title, sub },
 * }
 */
export function villageHtml(v) {
  const people = placeVillagers(v.tasks);
  const data = { kid: v.kidId, name: v.kidName, color: v.kidColor, people: people.map((p) => ({ id: p.task.id, kind: p.kind, period: p.task.period === 'morning' ? 'morning' : 'afternoon', x: p.x, y: p.y, st: p.task.st, verify: p.task.verify, timer: Boolean(p.task.timer), icon: p.task.icon, task: p.task.name, sub: p.task.sub })), chest: { ready: v.chest.ready, opened: v.chest.opened, title: v.chest.title, sub: v.chest.sub } };
  const folk = people.map((p) => {
    const st = p.task.st;
    const badge = st === 'done' ? '<span class="v-badge">✓</span>' : st === 'pending' ? '<span class="v-badge wait">⏳</span>' : '';
    return `<button class="villager st-${st}" data-vid="${esc(p.task.id)}" data-kind="${p.kind}" style="left:${p.x}px;top:${p.y}px;z-index:${p.y}" aria-label="${esc(villagerName(p.kind))}: ${esc(p.task.name)}">
        <span class="v-bubble"><span class="v-icon">${esc(p.task.icon)}</span>${badge}</span>
        <canvas class="v-sprite" width="16" height="${villagerGrid(p.kind).length}"></canvas>
        <span class="v-hearts" aria-hidden="true"></span>
      </button>`;
  }).join('');
  const am = people.some((p) => p.task.period === 'morning');
  const pm = people.some((p) => p.task.period !== 'morning');
  return `
    <section class="village" data-kid="${esc(v.kidId)}" data-v="${esc(JSON.stringify(data))}">
      <div class="village-view">
        <div class="village-world" style="width:${W}px;height:${H}px">
          <canvas class="village-land" width="${W}" height="${H}" aria-hidden="true"></canvas>
          <div class="v-label home-label" style="left:${CX}px;top:${HOME.y + 10}px">${esc(v.kidName)}'s house</div>
          ${am ? `<div class="v-label period" style="left:${CX - 64}px;top:${RIVER.y0 - 20}px">⬆ 🌅 Morning quests</div>` : ''}
          ${pm ? `<div class="v-label period" style="left:${CX + 72}px;top:${RIVER.y1 + 10}px">⬇ ☀️ After-school quests</div>` : ''}
          ${folk}
          <button class="v-chest ${v.chest.ready ? 'ready' : ''} ${v.chest.opened ? 'opened' : ''}" style="left:${CHEST.x}px;top:${CHEST.y}px;z-index:${CHEST.y}" aria-label="Treasure">${v.chest.html}</button>
          <div class="v-buddy" style="z-index:500"><div class="v-flip">${v.buddy}</div></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="v-arrows"></div>
        <div class="v-dialog" hidden></div>
      </div>
    </section>`;
}

// ---------- walking ----------

const CELL = 8;
const COLS = Math.ceil(W / CELL);
const ROWS = Math.ceil(H / CELL);
const SPEED = 100; // village pixels a second

function makeGrid(people) {
  const block = new Uint8Array(COLS * ROWS);
  const solid = [...OBSTACLES, RIVER_BLOCK, ...people.map((p) => [p.x - 7, p.y - 8, 14, 10]), [CHEST.x - 12, CHEST.y - 12, 24, 14]];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = c * CELL + CELL / 2; const y = r * CELL + CELL / 2;
      // the bridge crosses the river
      const onBridge = x > BRIDGE.x + 2 && x < BRIDGE.x + BRIDGE.w - 2 && y > RIVER.y0 - 8 && y < RIVER.y1 + 8;
      if (onBridge) continue;
      if (solid.some((rc) => inRect(x, y, rc, 3))) block[r * COLS + c] = 1;
    }
  }
  return block;
}

const cellOf = (x, y) => [Math.max(0, Math.min(COLS - 1, Math.floor(x / CELL))), Math.max(0, Math.min(ROWS - 1, Math.floor(y / CELL)))];

/** The open cell nearest a point (breadth first). */
function nearestOpen(grid, x, y) {
  const [c0, r0] = cellOf(x, y);
  if (!grid[r0 * COLS + c0]) return [c0, r0];
  const seen = new Set([r0 * COLS + c0]);
  let ring = [[c0, r0]];
  while (ring.length) {
    const next = [];
    let best = null; let bestD = Infinity;
    for (const [c, r] of ring) {
      for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nc = c + dc; const nr = r + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS || seen.has(nr * COLS + nc)) continue;
        seen.add(nr * COLS + nc);
        if (!grid[nr * COLS + nc]) {
          const d = Math.hypot(nc * CELL + 4 - x, nr * CELL + 4 - y);
          if (d < bestD) { bestD = d; best = [nc, nr]; }
        } else next.push([nc, nr]);
      }
    }
    if (best) return best;
    ring = next;
  }
  return [c0, r0];
}

/** A* over the walking grid, 8 ways, then the corners smoothed off. Returns points in village pixels. */
function findPath(grid, from, to) {
  const [sc, sr] = nearestOpen(grid, from.x, from.y);
  const [gc, gr] = nearestOpen(grid, to.x, to.y);
  const start = sr * COLS + sc; const goal = gr * COLS + gc;
  const g = new Float32Array(COLS * ROWS).fill(Infinity);
  const came = new Int32Array(COLS * ROWS).fill(-1);
  const open = [start];
  const inOpen = new Uint8Array(COLS * ROWS);
  g[start] = 0; inOpen[start] = 1;
  const h = (i) => { const dc = Math.abs((i % COLS) - gc); const dr = Math.abs(Math.floor(i / COLS) - gr); return Math.max(dc, dr) + 0.414 * Math.min(dc, dr); };
  const f = (i) => g[i] + h(i);
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i += 1) if (f(open[i]) < f(open[bi])) bi = i;
    const cur = open.splice(bi, 1)[0];
    inOpen[cur] = 0;
    if (cur === goal) break;
    const cc = cur % COLS; const cr = Math.floor(cur / COLS);
    for (let dr = -1; dr <= 1; dr += 1) {
      for (let dc = -1; dc <= 1; dc += 1) {
        if (!dc && !dr) continue;
        const nc = cc + dc; const nr = cr + dr;
        if (nc < 0 || nr < 0 || nc >= COLS || nr >= ROWS) continue;
        const ni = nr * COLS + nc;
        if (grid[ni]) continue;
        if (dc && dr && (grid[cr * COLS + nc] || grid[nr * COLS + cc])) continue; // no cutting corners
        const ng = g[cur] + (dc && dr ? 1.414 : 1);
        if (ng < g[ni]) { g[ni] = ng; came[ni] = cur; if (!inOpen[ni]) { open.push(ni); inOpen[ni] = 1; } }
      }
    }
  }
  if (came[goal] < 0 && goal !== start) return [];
  const cells = [];
  for (let i = goal; i >= 0 && i !== start; i = came[i]) cells.push(i);
  cells.reverse();
  const pts = cells.map((i) => ({ x: (i % COLS) * CELL + CELL / 2, y: Math.floor(i / COLS) * CELL + CELL / 2 }));
  // the last step goes to the exact spot when it's open
  if (pts.length) { const [ec, er] = cellOf(to.x, to.y); if (ec === gc && er === gr) pts[pts.length - 1] = { x: to.x, y: to.y }; }
  // string pulling: skip points while the straight line stays open
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
    for (let s = 1; s < n; s += 1) { const [c, r] = cellOf(a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n); if (grid[r * COLS + c]) return false; }
    return true;
  };
  const out = [];
  let a = from;
  for (let i = 0; i < pts.length; i += 1) {
    if (i === pts.length - 1 || !clear(a, pts[i + 1])) { out.push(pts[i]); a = pts[i]; }
  }
  return out;
}

// ---------- the live village ----------

// Per kid, while the app is open: where the buddy is and what each villager last looked like.
const memory = new Map();
const spriteCache = new Map();

function spriteUrl(kind, happy) {
  const key = `${kind}:${happy ? 1 : 0}`;
  if (!spriteCache.has(key)) spriteCache.set(key, drawVillager(document.createElement('canvas'), kind, happy));
  return spriteCache.get(key);
}

let landCache = { key: '', canvas: null };
function land(color) {
  if (landCache.key !== color) landCache = { key: color, canvas: paintVillage(document.createElement('canvas'), LAYOUT, { homeRoof: color }) };
  return landCache.canvas;
}

/**
 * Starts every village inside root. handlers: {
 *   onTask(taskId, el): the kid says a quest is done (or wants to start it),
 *   onChest(el): the buddy reached the treasure,
 *   sound(name): a little sound ('tap', 'talk'),
 * }
 */
export function mountVillages(root, handlers) {
  root.querySelectorAll('.village:not([data-live])').forEach((section) => mount(section, handlers));
}

function mount(section, handlers) {
  section.dataset.live = '1';
  const data = JSON.parse(section.dataset.v);
  const view = section.querySelector('.village-view');
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const flip = section.querySelector('.v-flip');
  const arrows = section.querySelector('.v-arrows');
  const dialog = section.querySelector('.v-dialog');
  const targetEl = section.querySelector('.v-target');
  const chestEl = section.querySelector('.v-chest');
  const people = data.people;
  const els = new Map([...section.querySelectorAll('.villager')].map((el) => [el.dataset.vid, el]));

  // the land and the villagers' faces
  const canvas = section.querySelector('.village-land');
  canvas.getContext('2d').drawImage(land(data.color || '#e03131'), 0, 0);
  for (const p of people) {
    const c = els.get(p.id).querySelector('.v-sprite');
    const src = spriteUrl(p.kind, p.st === 'done');
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
  }

  const mem = memory.get(data.kid) || { x: START.x, y: START.y, seen: {} };
  memory.set(data.kid, mem);
  const grid = makeGrid(people);
  const me = { x: mem.x, y: mem.y, path: [], goal: null, face: mem.face || 1 };
  let S = 3;
  let cam = { x: 0, y: 0 };
  let vw = 0; let vh = 0;

  const measure = () => {
    vw = view.clientWidth; vh = view.clientHeight;
    S = vw >= 600 ? 3 : 2;
  };
  const camTarget = () => {
    const tx = W * S <= vw ? -(vw / S - W) / 2 : Math.max(0, Math.min(W - vw / S, me.x - vw / S / 2));
    // while someone is talking, the buddy sits higher up, above the talk box
    const at = dialog.hidden ? 0.5 : 0.3;
    const ty = H * S <= vh ? -(vh / S - H) / 2 : Math.max(0, Math.min(H - vh / S, me.y - 12 - (vh / S) * at));
    return { x: tx, y: ty };
  };
  measure();
  cam = mem.cam && mem.S === S ? { ...mem.cam } : camTarget();

  const place = () => {
    world.style.transform = `translate(${Math.round(-cam.x * S)}px, ${Math.round(-cam.y * S)}px) scale(${S})`;
    buddyEl.style.left = `${me.x}px`;
    buddyEl.style.top = `${me.y}px`;
    buddyEl.style.zIndex = Math.round(me.y);
    flip.style.transform = me.face < 0 ? 'scaleX(-1)' : '';
  };

  // ---- talking ----
  const personById = (id) => people.find((p) => p.id === id);
  const closeDialog = () => { dialog.hidden = true; dialog.innerHTML = ''; section.classList.remove('talking'); };
  const say = (p, mode) => {
    const name = data.name;
    const el = els.get(p.id);
    let text; let buttons;
    if (mode === 'thanks' || p.st === 'done') {
      text = THANKS[p.kind](name);
      buttons = '<button class="btn" data-v="bye">Bye!</button>';
    } else if (mode === 'pending' || p.st === 'pending') {
      text = 'Great job! Now a grown-up needs to check it. I\'ll wait right here.';
      buttons = '<button class="btn" data-v="do">🙋 Ask a parent now</button><button class="btn ghost" data-v="bye">Later</button>';
    } else {
      text = HELLO[p.kind](name);
      const doLabel = p.timer && !/^Time done/.test(p.sub) ? '▶ Start the timer' : p.verify === 'parent' ? '🙋 I did it! Ask a parent' : '✓ I did it!';
      buttons = `<button class="btn" data-v="do">${doLabel}</button><button class="btn ghost" data-v="bye">Not yet</button>`;
    }
    const quest = p.st === 'done' ? '' : `<div class="v-quest"><span class="v-quest-icon">${esc(p.icon)}</span><span><b>${esc(p.task)}</b><small>${esc(p.sub)}</small></span></div>`;
    dialog.innerHTML = `
      <div class="v-portrait"><canvas width="16" height="16"></canvas></div>
      <div class="v-talk">
        <b class="v-name">${esc(villagerName(p.kind))}</b>
        <p class="v-text"></p>
        ${quest}
        <div class="v-buttons">${buttons}</div>
      </div>`;
    const src = spriteUrl(p.kind, p.st === 'done' || mode === 'thanks');
    const pc = dialog.querySelector('.v-portrait canvas');
    pc.width = src.width; pc.height = src.height;
    pc.getContext('2d').drawImage(src, 0, 0);
    // the words appear a few letters at a time, like an old game; a tap shows them all
    const $t = dialog.querySelector('.v-text');
    let n = 0;
    clearInterval(dialog.typer);
    dialog.typer = setInterval(() => { n += 2; $t.textContent = text.slice(0, n); if (n >= text.length) clearInterval(dialog.typer); }, 30);
    $t.onclick = () => { clearInterval(dialog.typer); $t.textContent = text; };
    dialog.hidden = false;
    dialog.dataset.vid = p.id;
    section.classList.add('talking');
    el?.classList.add('chatting');
    setTimeout(() => el?.classList.remove('chatting'), 600);
    handlers.sound?.('talk');
  };
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    e.stopPropagation();
    const p = personById(dialog.dataset.vid);
    if (b.dataset.v === 'bye' || !p) { closeDialog(); return; }
    if (b.dataset.v === 'do') { closeDialog(); handlers.onTask(p.id, els.get(p.id)); }
  });

  // ---- arriving ----
  const arrive = () => {
    const goal = me.goal;
    me.goal = null;
    buddyEl.classList.remove('walking');
    targetEl.hidden = true;
    if (!goal) return;
    if (goal.person) {
      const p = personById(goal.person);
      me.face = p.x >= me.x ? 1 : -1;
      say(p);
    } else if (goal.chest) {
      handlers.onChest(chestEl);
    }
  };
  const walkTo = (x, y, goal = null) => {
    closeDialog();
    me.path = findPath(grid, me, { x, y });
    me.goal = goal;
    if (!me.path.length) { arrive(); return; }
    buddyEl.classList.add('walking');
  };
  // where the buddy stands to talk to someone: just in front (below) of them, or to a side
  const standBy = (x, y) => {
    for (const [dx, dy] of (x > me.x ? [[-18, 1], [18, 1]] : [[18, 1], [-18, 1]]).concat([[0, 16], [0, -14]])) {
      const [c, r] = cellOf(x + dx, y + dy);
      if (!grid[r * COLS + c]) return { x: x + dx, y: y + dy };
    }
    return { x, y: y + 14 };
  };
  const goTalk = (p) => {
    const spot = standBy(p.x, p.y);
    if (Math.hypot(me.x - spot.x, me.y - spot.y) < 22) { me.face = p.x >= me.x ? 1 : -1; say(p); return; }
    walkTo(spot.x, spot.y, { person: p.id });
  };
  const goChest = () => {
    const spot = standBy(CHEST.x, CHEST.y);
    if (Math.hypot(me.x - spot.x, me.y - spot.y) < 22) { handlers.onChest(chestEl); return; }
    walkTo(spot.x, spot.y, { chest: true });
  };

  // ---- taps ----
  view.addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog')) return;
    e.stopPropagation();
    const arrow = e.target.closest('.v-arrow');
    if (arrow) { handlers.sound?.('tap'); if (arrow.dataset.vid === 'chest') goChest(); else goTalk(personById(arrow.dataset.vid)); return; }
    const who = e.target.closest('.villager');
    if (who) { handlers.sound?.('tap'); goTalk(personById(who.dataset.vid)); return; }
    if (e.target.closest('.v-chest')) { goChest(); return; }
    if (!dialog.hidden) { closeDialog(); return; }
    const r = view.getBoundingClientRect();
    const x = (e.clientX - r.left) / S + cam.x;
    const y = (e.clientY - r.top) / S + cam.y;
    targetEl.style.left = `${x}px`; targetEl.style.top = `${y}px`;
    targetEl.hidden = false;
    targetEl.classList.remove('pop'); void targetEl.offsetWidth; targetEl.classList.add('pop');
    walkTo(x, y);
  });

  // ---- arrows to quests off screen ----
  // arrows point to the quests of the first part of the day that still has some (morning, then after school)
  const open = () => {
    const left = people.filter((p) => p.st === 'todo' || p.st === 'current');
    const am = left.filter((p) => p.period === 'morning');
    return am.length ? am : left;
  };
  // arrow buttons are kept and moved (not redrawn), so a tap lands even while the view slides
  const arrowEls = new Map();
  const drawArrows = () => {
    const list = open().map((p) => ({ id: p.id, x: p.x, y: p.y - 22, icon: p.icon, now: p.st === 'current' }));
    if (!list.length && data.chest.ready) list.push({ id: 'chest', x: CHEST.x, y: CHEST.y - 10, icon: '🎁' });
    const m = 30; // keep arrows this far inside the edge
    const shown = new Set();
    for (const q of list) {
      const sx = (q.x - cam.x) * S; const sy = (q.y - cam.y) * S;
      if (sx > 10 && sx < vw - 10 && sy > 10 && sy < vh - 10) continue;
      const cx = vw / 2; const cy = vh / 2;
      const dx = sx - cx; const dy = sy - cy;
      const k = Math.min((cx - m) / Math.abs(dx || 1e-6), (cy - m) / Math.abs(dy || 1e-6));
      let el = arrowEls.get(q.id);
      if (!el) {
        el = document.createElement('button');
        el.className = `v-arrow${q.now ? ' now' : ''}`;
        el.dataset.vid = q.id;
        el.setAttribute('aria-label', 'Go to a quest');
        el.innerHTML = `<span class="v-arrow-tip"></span><span class="v-arrow-icon">${esc(q.icon)}</span>`;
        arrows.append(el);
        arrowEls.set(q.id, el);
      }
      el.style.left = `${Math.round(cx + dx * k)}px`;
      el.style.top = `${Math.round(cy + dy * k)}px`;
      el.firstChild.style.transform = `rotate(${Math.round(Math.atan2(dy, dx) * (180 / Math.PI))}deg)`;
      shown.add(q.id);
    }
    for (const [id, el] of arrowEls) if (!shown.has(id)) { el.remove(); arrowEls.delete(id); }
  };

  // ---- the loop ----
  let last = performance.now();
  const tick = (now) => {
    if (!section.isConnected) { mem.x = me.x; mem.y = me.y; mem.cam = cam; mem.S = S; mem.face = me.face; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (me.path.length) {
      let step = SPEED * dt;
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
    mem.x = me.x; mem.y = me.y; mem.cam = cam; mem.S = S; mem.face = me.face;
    place();
    drawArrows();
    requestAnimationFrame(tick);
  };
  window.addEventListener('resize', () => { measure(); }, { passive: true });
  place();
  requestAnimationFrame(tick);

  // a quest that just got done: the villager cheers and says thanks; one sent to a parent waits
  for (const p of people) {
    const was = mem.seen[p.id];
    if (was && was !== p.st) {
      if (p.st === 'done') {
        const el = els.get(p.id);
        el.classList.add('cheer');
        setTimeout(() => el.classList.remove('cheer'), 2400);
        setTimeout(() => say(p, 'thanks'), 500);
      } else if (p.st === 'pending') setTimeout(() => say(p, 'pending'), 300);
    }
    mem.seen[p.id] = p.st;
  }
}
