// The walkable village: a different way to see today's chores. Each chore is a quest
// from a villager, who has a little picture of the chore floating over their head.
// Tap the ground and the buddy walks there; tap a villager and the buddy walks over
// and the villager says what they need. Morning quests are on the kid's side of the
// water; after-school quests are across the bridge, so crossing means school's out.
// Arrows on the edges point to villagers off screen who still have a quest.
//
// Every map has its own village (villagemaps.js says where things stand, villageprops.js
// draws them). The village is drawn in village pixels (1 canvas pixel each) and shown at
// 3 screen pixels per village pixel on a tablet (2 on a phone), so it lines up with the
// buddies' pixels. app.js decides what a tap on a quest does (the same as tapping the
// chore anywhere else).

import { drawVillager, VILLAGER_KINDS, villagerGrid, bowlCanvas, BOWL_THEMES } from './villageart.js';
import { paintVillage } from './villageprops.js';
import { villageLayout } from './villagemaps.js';
import { MAP_THEMES } from './maparts.js';
import { startMapLife } from './maplife.js';
import { OAK, startOak } from './oakart.js';
import { WRECK, startWreck } from './wreckart.js';
import { GALLEON, startGalleon } from './galleonart.js';

// landmarks drawn for their village (one village pixel per art pixel), and how each one comes alive
const LANDMARK_ART = { oak: { size: OAK, start: startOak }, wreck: { size: WRECK, start: startWreck }, galleon: { size: GALLEON, start: startGalleon } };

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// ---------- villagers ----------

const NAMES = { bunny: 'Clover', beaver: 'Bucky', owl: 'Hoot', frog: 'Fiddle', sheep: 'Wooly', hedgehog: 'Hazel', raccoon: 'Rory', mouse: 'Pip', badger: 'Barty' };
const SPECIES_NAMES = { bunny: 'the Bunny', beaver: 'the Beaver', owl: 'the Owl', frog: 'the Frog', sheep: 'the Sheep', hedgehog: 'the Hedgehog', raccoon: 'the Raccoon', mouse: 'the Mouse', badger: 'the Badger' };
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
const liked = (name) => LIKES.find(([, re]) => re.test(name))?.[0] || null;

// At most this many villagers a day: busy days give some villagers more than one quest.
const MAX_FOLK = 8;
const MAX_HALF = 6;

/** How many villagers each half of the day gets for n morning and m after-school quests. */
export function folkCaps(n, m) {
  if (n + m <= MAX_FOLK) return [Math.min(n, MAX_HALF), Math.min(m, MAX_HALF)];
  let a = Math.round((MAX_FOLK * n) / (n + m));
  a = Math.max(Math.min(n, 2), Math.min(a, n, MAX_HALF));
  const b = Math.max(Math.min(m, 2), Math.min(MAX_FOLK - a, m, MAX_HALF));
  return [a, b];
}

/** Splits one half's quests (in plan order) into at most cap villagers' quest lists. */
function groupQuests(list, cap) {
  const groups = list.map((t, i) => ({ tasks: [t], like: liked(t.name), first: i }));
  while (groups.length > cap) {
    // first, a villager who likes two of the chores gives both (teeth, then floss)
    let a = -1; let b = -1;
    for (let i = 0; i < groups.length && a < 0; i += 1) for (let j = i + 1; j < groups.length; j += 1) if (groups[i].like && groups[i].like === groups[j].like) { a = i; b = j; break; }
    // otherwise the last villager's quest goes to whoever has the fewest
    if (a < 0) {
      b = groups.length - 1;
      a = groups.slice(0, b).reduce((best, g, i) => (g.tasks.length < groups[best].tasks.length ? i : best), 0);
    }
    groups[a].tasks.push(...groups[b].tasks);
    groups.splice(b, 1);
  }
  groups.forEach((g) => g.tasks.sort((x, y) => list.indexOf(x) - list.indexOf(y)));
  return groups;
}

/**
 * Who gives each quest and where they stand. tasks: [{ id, name, period }] in plan order.
 * Returns [{ id, kind, x, y, period, tasks }]: one entry per villager, each with its quests
 * in the order they're given. The same tasks always give the same answer.
 */
export function placeVillagers(tasks, L = villageLayout('bg-meadow')) {
  const halves = ['morning', 'afternoon'].map((period) => tasks.filter((t) => (period === 'morning' ? t.period === 'morning' : t.period !== 'morning')));
  const caps = folkCaps(halves[0].length, halves[1].length);
  const groups = halves.map((list, h) => groupQuests(list, caps[h]).map((g) => ({ ...g, period: h ? 'afternoon' : 'morning' })));
  const all = [...groups[0], ...groups[1]];
  // kinds that fit a chore by name are given out first, so a later chore can't take them
  const used = new Set();
  all.forEach((g) => { if (g.like && !used.has(g.like)) { g.kind = g.like; used.add(g.like); } });
  const wanted = new Set(all.map((g) => g.like).filter(Boolean));
  all.forEach((g, i) => {
    if (g.kind) return;
    g.kind = VILLAGER_KINDS.find((k) => !used.has(k) && !wanted.has(k)) || VILLAGER_KINDS.find((k) => !used.has(k)) || VILLAGER_KINDS[i % VILLAGER_KINDS.length];
    used.add(g.kind);
  });
  const out = [];
  for (const [h, period] of ['morning', 'afternoon'].entries()) {
    const slots = L.slots[period].map((s) => ({ ...s, taken: false }));
    const at = new Map();
    // quests that belong somewhere (piano at the music hall) go there first
    groups[h].forEach((g) => { const s = slots.find((x) => !x.taken && x.likes && g.tasks.some((t) => x.likes.test(t.name))); if (s) { s.taken = true; at.set(g, s); } });
    groups[h].forEach((g) => {
      if (at.has(g)) return;
      const s = slots.find((x) => !x.taken && !x.likes) || slots.find((x) => !x.taken);
      s.taken = true;
      at.set(g, s);
    });
    groups[h].forEach((g) => out.push({ id: g.tasks[0].id, kind: g.kind, x: at.get(g).x, y: at.get(g).y, period, tasks: g.tasks }));
  }
  return out;
}

export const villagerName = (kind) => `${NAMES[kind]} ${SPECIES_NAMES[kind]}`;

/** The quest a villager is on now: the first one not done (waiting on a parent comes after the rest). */
export function activeQuest(tasks) {
  return tasks.find((t) => t.st === 'current' || t.st === 'todo') || tasks.find((t) => t.st === 'pending') || tasks[tasks.length - 1];
}

// ---------- markup ----------

/** Where each visitor stands, which way they face, and what they're doing on the green. */
export function visitorSpots(visit, L = villageLayout('bg-meadow')) {
  const out = {};
  const GREEN = L.green;
  let idle = 0;
  for (const a of visit?.areas || []) {
    const Z = GREEN[a.side];
    const y = Math.round(Z.y + Z.h / 2 + 8);
    if (a.kind === 'pond') {
      a.members.forEach((id, i) => { out[id] = i ? { x: Z.x + Z.w + 4, y, face: -1, role: 'fish' } : { x: Z.x - 4, y, face: 1, role: 'fish' }; });
    } else if (a.members.length === 1) {
      out[a.members[0]] = a.side === 'left' ? { x: Z.x + Math.round(Z.w * 0.3), y, face: 1, role: 'solo' } : { x: Z.x + Math.round(Z.w * 0.7), y, face: -1, role: 'solo' };
    } else {
      a.members.forEach((id, i) => { out[id] = i ? { x: Z.x + Z.w - 10, y, face: -1, role: 'b' } : { x: Z.x + 10, y, face: 1, role: 'a' }; });
    }
  }
  for (const v of visit?.visitors || []) {
    if (out[v.id]) continue;
    const g = GREEN.idle[idle % GREEN.idle.length];
    out[v.id] = { x: g.x + Math.floor(idle / GREEN.idle.length) * 14, y: g.y, face: idle % 2 ? -1 : 1, role: 'idle' };
    idle += 1;
  }
  return out;
}

/** The pond or play patch for each visitor area, in village pixels. */
export const greenAreas = (visit, L = villageLayout('bg-meadow')) => (visit?.areas || []).map((a) => ({ ...L.green[a.side], kind: a.kind, side: a.side }));

function visitorsMarkup(visit, L) {
  if (!visit?.visitors?.length) return '';
  const spots = visitorSpots(visit, L);
  const areas = (visit.areas || []).map((a) => {
    const Z = L.green[a.side];
    const solo = a.members.length === 1 ? `solo from-${a.side}` : '';
    const spot = a.members.length === 1 ? spots[a.members[0]] : null;
    const tap = a.tap ? `data-id="${esc(a.members[0])}" data-pick="${a.kind}" role="button" aria-label="Play"` : 'aria-hidden="true"';
    return a.kind === 'pond' ? '' : `<div class="v-area v-area-${a.kind} ${solo} ${a.tap ? 'tap' : ''}" style="left:${Z.x}px;top:${Z.y}px;width:${Z.w}px;height:${Z.h}px;--solo-x:${spot ? spot.x - Z.x : 0}px" ${tap}><span class="v-ball">${a.ball || ''}</span></div>`;
  }).join('');
  const people = visit.visitors.map((v, i) => {
    const sp = spots[v.id];
    // a fishing line from the rod's tip to a bobber in the pond
    let line = '';
    if (sp.role === 'fish') {
      const tip = { x: sp.x + sp.face * 11, y: sp.y - 19 }; const bob = { x: sp.x + sp.face * 22, y: sp.y - 4 };
      const len = Math.hypot(bob.x - tip.x, bob.y - tip.y); const ang = Math.atan2(bob.y - tip.y, bob.x - tip.x) * (180 / Math.PI);
      // the visitor's box starts 12 px left of and 23 px above its feet
      const ox = 12 - sp.x; const oy = 23 - sp.y;
      line = `<span class="v-line" style="left:${tip.x + ox}px;top:${tip.y + oy}px;width:${len.toFixed(1)}px;transform:rotate(${ang.toFixed(1)}deg)"></span><span class="v-bobber" style="left:${bob.x + ox}px;top:${bob.y + oy}px"></span><span class="v-catch" style="left:${12 + sp.face * 26 - 9}px"></span>`;
    }
    return `<div class="v-visitor role-${sp.role} ${v.news || ''} ${i === 0 || v.news ? 'talking' : ''} ${sp.role === 'fish' ? 'fishing' : ''}" data-id="${esc(v.id)}" data-rod="${v.rod || 1}" style="left:${sp.x}px;top:${sp.y}px;z-index:${sp.y};--kid:${esc(v.color || '#4dabf7')}">
        <div class="v-vbuddy" style="${sp.face < 0 ? 'transform:scaleX(-1)' : ''}">${v.html}</div>
        ${line}
        <div class="visitor-name">${esc(v.name)}</div>
        <div class="visitor-bubble">${esc(v.line)}${v.news === 'news' ? `<button class="cheer-btn" data-action="send-cheer" data-id="${esc(v.id)}">🎉 Cheer</button>` : ''}</div>
      </div>`;
  }).join('');
  return `<div class="map-visitors v-visitors" data-host="${esc(visit.host)}" aria-label="Visiting buddies">${areas}${people}</div>`;
}

/**
 * The village for a kid. v: {
 *   theme: the kid's Places background (which map's village),
 *   kidId, kidName, kidColor, buddy: live buddy markup,
 *   tasks: [{ id, name, icon, period, st: 'todo'|'current'|'pending'|'done', sub, verify, timer, step, plan }],
 *   chest: { html, ready, opened },
 *   shop: { open, left }: whether the buddy shop is open, and how many quests are left before it is,
 *   visit: { host, visitors: [{ id, name, color, html, line, news, rod }], areas: [{ side, kind, members, ball, tap }] },
 *   landmark: { html, name, w, h } or null: a finished treasure map's landmark,
 * }
 */
export function villageHtml(v) {
  const L = villageLayout(v.theme);
  const people = placeVillagers(v.tasks, L);
  const quest = (t) => ({ id: t.id, st: t.st, verify: t.verify, timer: Boolean(t.timer), icon: t.icon, task: t.name, sub: t.sub, step: t.step || 0, plan: t.plan || '' });
  // most landmarks are their treasure-map art drawn twice as big; the meadow's Great Oak (oakart.js) and the
  // sunset's ghost ship wreck (wreckart.js) are drawn for the village
  const lm = v.landmark ? { ...L.landmark, w: L.landmark.w || v.landmark.w, h: L.landmark.h || v.landmark.h } : null;
  const shop = v.shop || { open: false, left: 0 };
  const data = {
    theme: L.id, kid: v.kidId, name: v.kidName, color: v.kidColor,
    people: people.map((p) => ({ id: p.id, kind: p.kind, period: p.period, x: p.x, y: p.y, tasks: p.tasks.map(quest) })),
    planned: Boolean(v.planned), chest: { ready: v.chest.ready, opened: v.chest.opened }, shop,
    areas: greenAreas(v.visit, L), spots: visitorSpots(v.visit, L), landmark: lm,
  };
  const folk = people.map((p) => {
    const a = activeQuest(p.tasks);
    const st = p.tasks.every((t) => t.st === 'done') ? 'done' : a.st;
    const more = p.tasks.filter((t) => t.st === 'todo' || t.st === 'current').length;
    const badge = st === 'done' ? '<span class="v-badge">✓</span>' : st === 'pending' ? '<span class="v-badge wait">⏳</span>' : more > 1 ? `<span class="v-badge more">×${more}</span>` : '';
    return `<button class="villager st-${st}" data-vid="${esc(p.id)}" data-kind="${p.kind}" style="left:${p.x}px;top:${p.y}px;z-index:${p.y}" aria-label="${esc(villagerName(p.kind))}: ${esc(p.tasks.map((t) => t.name).join(', '))}">
        <span class="v-bubble">${a.step && st !== 'done' && st !== 'pending' ? `<span class="v-step">${a.step}</span>` : ''}<span class="v-icon">${esc(a.icon)}</span>${badge}</span>
        <canvas class="v-sprite" width="16" height="${villagerGrid(p.kind).length}"></canvas>
        <span class="v-hearts" aria-hidden="true"></span>
      </button>`;
  }).join('');
  const keeper = L.shop ? `<button class="villager keeper st-${shop.open ? 'done' : 'todo'}" data-kind="badger" data-shop="1" style="left:${L.shop.x}px;top:${L.shop.y}px;z-index:${L.shop.y}" aria-label="${esc(villagerName('badger'))}: the buddy shop">
        <span class="v-bubble"><span class="v-icon">${shop.open ? '👕' : '🔒'}</span></span>
        <canvas class="v-sprite" width="16" height="${villagerGrid('badger').length}"></canvas>
      </button>` : '';
  const am = people.some((p) => p.period === 'morning');
  const pm = people.some((p) => p.period !== 'morning');
  const [mx, my, mt] = L.labels.morning; const [ax, ay, at] = L.labels.afternoon;
  return `
    <section class="village theme-${esc(L.id)}" data-kid="${esc(v.kidId)}" data-v="${esc(JSON.stringify(data))}">
      <div class="village-view">
        <div class="village-world" style="width:${L.W}px;height:${L.H}px">
          <canvas class="village-land" width="${L.W}" height="${L.H}" aria-hidden="true"></canvas>
          <canvas class="v-life" width="${L.W}" height="${L.H}" style="width:${L.W}px;height:${L.H}px" aria-hidden="true"></canvas>
          <div class="v-label home-label" style="left:${L.home.x + L.home.w / 2}px;top:${L.home.y + 10}px">${esc(v.kidName)}'s house</div>
          <button class="v-home" style="left:${L.home.x}px;top:${L.home.y - 12}px;width:${L.home.w}px;height:${L.home.h + 12}px;z-index:${L.home.y + L.home.h - 2}" aria-label="Go into ${esc(v.kidName)}'s house"><span class="v-home-door" style="left:${L.home.w / 2}px">🚪</span></button>
          ${am ? `<div class="v-label period" style="left:${mx}px;top:${my}px">${esc(mt)}</div>` : ''}
          ${pm ? `<div class="v-label period" style="left:${ax}px;top:${ay}px">${esc(at)}</div>` : ''}
          ${folk}${keeper}
          ${visitorsMarkup(v.visit, L)}
          ${lm ? `<button class="v-landmark${lm.art ? ` art-${lm.art}` : ''}" style="left:${lm.x}px;top:${lm.y}px;width:${lm.w}px;z-index:${lm.y + lm.h}" aria-label="${esc(v.landmark.name)}">${LANDMARK_ART[lm.art] ? `<canvas class="v-art" width="${LANDMARK_ART[lm.art].size.w}" height="${LANDMARK_ART[lm.art].size.h}" aria-hidden="true"></canvas>` : v.landmark.html}<span class="v-lm-bubble" hidden></span></button>` : ''}
          <span class="v-critter b1" aria-hidden="true"></span><span class="v-critter b2" aria-hidden="true"></span>
          <button class="v-chest ${v.chest.ready ? 'ready' : ''} ${v.chest.opened ? 'opened' : ''}" style="left:${L.chest.x}px;top:${L.chest.y}px;z-index:${L.chest.y}" aria-label="Treasure">${v.chest.html}</button>
          <div class="v-buddy" style="z-index:500"><div class="v-flip">${v.buddy}</div></div>
          <span class="v-target" hidden></span>
        </div>
        <div class="v-show"><canvas class="map-land" data-z="1" width="1" height="1"></canvas></div>
        <div class="v-arrows"></div>
        <div class="v-dialog" hidden></div>
      </div>
    </section>`;
}

// ---------- the map's moving things ----------
// The same critters as the map (maplife.js): crabs on the beach, fish and a shark under the sea,
// aliens and a rocket, the knight and the dragon, the volcano and its tiki villagers, the sloth,
// toucan, monkeys and jaguar (and the waterfall), the unicorn, and the golden saucers. They are
// drawn one art pixel to one village pixel, like everything else in the village.

function startLife(section, L, data, people, cam) {
  const life = MAP_THEMES[L.id]?.life;
  const canvas = section.querySelector('.v-life');
  if (!life || !canvas) return;
  const hints = L.life || {};
  const near = (x, y, d) => people.some((p) => Math.hypot(p.x - x, p.y - y) < d) || (L.shop && Math.hypot(L.shop.x - x, L.shop.y - y) < d);
  const onGreen = (x, y) => ['left', 'right'].some((k) => { const g = L.green[k]; return x > g.x - 10 && x < g.x + g.w + 10 && y > g.y - 10 && y < g.y + g.h + 10; });
  const lm = data.landmark;
  const onLandmark = (x, y) => lm && x > lm.x - 6 && x < lm.x + lm.w + 6 && y > lm.y - 6 && y < lm.y + lm.h + 6;
  const falls = L.falls ? riverFalls(L) : null;
  startMapLife({
    section, canvas, host: cam.host, view: cam.view, toMap: cam.toMap, buddy: cam.buddy, flee: cam.flee,
    pokeNear: true, // a tap must be on a critter to poke it (a tap on the ground walks the buddy)
    key: `village|${data.kid}|${L.id}`,
    aw: L.W, ah: L.H, scale: 1, z: 1, life, wall: 20, falls,
    goal: hints.goal || L.chest,
    knightPost: hints.knightPost || { x: L.W - 50, y: L.H / 2, side: 1 },
    pad: hints.pad,
    vines: hints.vines,
    tikiHomes: hints.tikiHomes,
    // a straight run between two open spots must not cross water (the lava) either
    canStand: (x, y) => !L.blocked(x, y, 2) && !L.inWater(x, y, 8),
    openSpot: ({ top, bottom }) => {
      for (let tries = 0; tries < 40; tries += 1) {
        const x = 26 + Math.random() * (L.W - 70);
        const y = Math.max(28, top) + Math.random() * Math.max(1, Math.min(L.H - 40, bottom) - Math.max(28, top) - 16);
        const cx = x + 8; const cy = y + 12;
        if (L.blocked(cx, cy, 4) || L.inWater(cx, cy, 6) || near(cx, cy, 20) || onGreen(cx, cy) || onLandmark(cx, cy)) continue;
        if ([[x, y], [x + 16, y], [x, y + 14], [x + 16, y + 14]].some(([px, py]) => L.covered(px, py) || L.inWater(px, py, 2))) continue;
        return { x, y };
      }
      return null;
    },
  });
}

/** The waterfall at the head of a village river, and the way down the river from its foot. */
function riverFalls(L) {
  const f = L.falls;
  const pts = L.water[0].pts;
  // the river's line from the foot of the falls on
  const line = [];
  for (let i = 1; i < pts.length; i += 1) {
    const [x0, y0] = pts[i - 1]; const [x1, y1] = pts[i];
    if (y1 < f.base) continue;
    if (y0 < f.base) { const k = (f.base - y0) / (y1 - y0); line.push([x0 + (x1 - x0) * k, f.base]); }
    line.push([x1, y1]);
  }
  return {
    ...f, dir: 1,
    along(s) {
      let left = s;
      for (let i = 1; i < line.length; i += 1) {
        const [x0, y0] = line[i - 1]; const [x1, y1] = line[i];
        const d = Math.hypot(x1 - x0, y1 - y0);
        if (left <= d) { const y = y0 + ((y1 - y0) * left) / d; return y > L.H + 10 ? null : { x: x0 + ((x1 - x0) * left) / d, y }; }
        left -= d;
      }
      return null;
    },
    under: (x, y) => L.onBridge(x, y),
  };
}

// ---------- walking ----------

const CELL = 8;
const SPEED = 100; // village pixels a second
const inRect = (x, y, [rx, ry, rw, rh], pad = 0) => x > rx - pad && x < rx + rw + pad && y > ry - pad && y < ry + rh + pad;

/**
 * Where a landmark can't be walked through: its own foot box if it has one (the Great Oak's
 * roots and trunk), otherwise the lower part of its art (the buddy can stand behind the top).
 */
export const landmarkBlock = (lm) => (lm.foot ? [lm.x + lm.foot[0], lm.y + lm.foot[1], lm.foot[2], lm.foot[3]] : [lm.x + 8, lm.y + lm.h * 0.5, lm.w - 16, lm.h * 0.45]);

/** The walking grid for a layout: 1 where the buddy can't stand. */
export function makeGrid(L, people = [], extra = []) {
  const COLS = Math.ceil(L.W / CELL); const ROWS = Math.ceil(L.H / CELL);
  const block = new Uint8Array(COLS * ROWS);
  const solid = [...L.obstacles, ...people.map((p) => [p.x - 7, p.y - 8, 14, 10]), [L.chest.x - 12, L.chest.y - 12, 24, 14], ...extra];
  for (let r = 0; r < ROWS; r += 1) {
    for (let c = 0; c < COLS; c += 1) {
      const x = c * CELL + CELL / 2; const y = r * CELL + CELL / 2;
      if (L.onBridge(x, y)) continue;
      if (L.inWater(x, y, 3) || solid.some((rc) => inRect(x, y, rc, 3))) block[r * COLS + c] = 1;
    }
  }
  block.cols = COLS; block.rows = ROWS;
  return block;
}

const cellOf = (grid, x, y) => [Math.max(0, Math.min(grid.cols - 1, Math.floor(x / CELL))), Math.max(0, Math.min(grid.rows - 1, Math.floor(y / CELL)))];

/** The open cell nearest a point (breadth first). */
function nearestOpen(grid, x, y) {
  const COLS = grid.cols; const ROWS = grid.rows;
  const [c0, r0] = cellOf(grid, x, y);
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

/** A* over the walking grid, 8 ways, then the corners smoothed off. Returns points in village pixels ([] if there's no way). */
export function findPath(grid, from, to) {
  const COLS = grid.cols; const ROWS = grid.rows;
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
  if (pts.length) { const [ec, er] = cellOf(grid, to.x, to.y); if (ec === gc && er === gr) pts[pts.length - 1] = { x: to.x, y: to.y }; }
  if (!pts.length && start === goal) return [{ x: to.x, y: to.y }];
  // string pulling: skip points while the straight line stays open
  const clear = (a, b) => {
    const n = Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 3);
    for (let s = 1; s < n; s += 1) { const [c, r] = cellOf(grid, a.x + ((b.x - a.x) * s) / n, a.y + ((b.y - a.y) * s) / n); if (grid[r * COLS + c]) return false; }
    return true;
  };
  const out = [];
  let a = from;
  for (let i = 0; i < pts.length; i += 1) {
    if (i === pts.length - 1 || !clear(a, pts[i + 1])) { out.push(pts[i]); a = pts[i]; }
  }
  return out;
}

/** Where the buddy stands to talk to someone at (x, y): beside them, or just in front. */
export function standSpot(grid, x, y, fromX = 0) {
  for (const [dx, dy] of (x > fromX ? [[-18, 1], [18, 1]] : [[18, 1], [-18, 1]]).concat([[0, 16], [0, -14]])) {
    const [c, r] = cellOf(grid, x + dx, y + dy);
    if (!grid[r * grid.cols + c]) return { x: x + dx, y: y + dy };
  }
  return { x, y: y + 14 };
}

// ---------- the live village ----------

// Per kid and map, while the app is open: where the buddy is and what each quest last looked like.
const memory = new Map();
const spriteCache = new Map();

/** The buddy just came out of the kid's house: it stands outside the door. */
export function cameOut(kidId, theme) {
  const L = villageLayout(theme);
  const key = `${kidId}|${L.id}`;
  memory.set(key, { ...(memory.get(key) || { seen: {} }), x: L.start.x, y: L.start.y + 4, face: 1, cam: null });
}

function spriteUrl(kind, happy) {
  const key = `${kind}:${happy ? 1 : 0}`;
  if (!spriteCache.has(key)) spriteCache.set(key, drawVillager(document.createElement('canvas'), kind, happy));
  return spriteCache.get(key);
}

let landCache = { key: '', canvas: null };
function land(L, color, areas = []) {
  const key = `${L.id}|${color}|${areas.map((a) => `${a.side}:${a.kind}`).join(',')}`;
  if (landCache.key !== key) landCache = { key, canvas: paintVillage(document.createElement('canvas'), L, { homeRoof: color, areas }) };
  return landCache.canvas;
}

/**
 * Starts every village inside root. handlers: {
 *   onTask(taskId, el): the kid says a quest is done (or wants to start it),
 *   onChest(el): the buddy reached the treasure,
 *   onShop(): the kid wants to go into the buddy shop,
 *   onHome(): the buddy went in the door of the kid's house,
 *   onVisitor(el), onLandmark(el, layer), fishCatch(rod),
 *   sound(name): a little sound ('tap', 'talk'),
 * }
 */
export function mountVillages(root, handlers) {
  root.querySelectorAll('.village:not([data-live])').forEach((section) => mount(section, handlers));
}

function mount(section, handlers) {
  section.dataset.live = '1';
  const data = JSON.parse(section.dataset.v);
  const L = villageLayout(data.theme);
  const { W, H } = L;
  const view = section.querySelector('.village-view');
  const world = section.querySelector('.village-world');
  const buddyEl = section.querySelector('.v-buddy');
  const flip = section.querySelector('.v-flip');
  const arrows = section.querySelector('.v-arrows');
  const dialog = section.querySelector('.v-dialog');
  const targetEl = section.querySelector('.v-target');
  const chestEl = section.querySelector('.v-chest');
  const keeperEl = section.querySelector('.villager.keeper');
  const people = data.people;
  const els = new Map([...section.querySelectorAll('.villager[data-vid]')].map((el) => [el.dataset.vid, el]));
  const allQuests = people.flatMap((p) => p.tasks);
  const doneAll = (p) => p.tasks.every((t) => t.st === 'done');

  // the land and the villagers' faces
  const canvas = section.querySelector('.village-land');
  canvas.getContext('2d').drawImage(land(L, data.color || '#e03131', data.areas), 0, 0);
  const paintSprite = (el, kind, happy) => {
    const c = el.querySelector('.v-sprite');
    const src = spriteUrl(kind, happy);
    c.width = src.width; c.height = src.height;
    c.getContext('2d').drawImage(src, 0, 0);
  };
  for (const p of people) paintSprite(els.get(p.id), p.kind, doneAll(p));
  if (keeperEl) paintSprite(keeperEl, 'badger', data.shop.open);
  // under the sea and on the moon, everyone wears a fishbowl to breathe (over any hat)
  if (BOWL_THEMES.includes(L.id)) {
    const urls = new Map();
    const bowl = (host, w, h, place) => {
      const key = `${w}x${h}`;
      if (!urls.has(key)) urls.set(key, bowlCanvas(w, h, L.id).toDataURL());
      const b = document.createElement('span');
      b.className = 'v-bowl';
      b.setAttribute('aria-hidden', 'true');
      b.style.cssText = `background-image:url(${urls.get(key)});width:${w}px;height:${h}px;${place}`;
      host.append(b);
    };
    bowl(flip, 20, 20, 'left:2px;top:0');
    section.querySelectorAll('.v-vbuddy').forEach((el) => bowl(el, 20, 20, 'left:2px;top:0'));
    const folkBowl = (el, kind) => bowl(el, 20, villagerGrid(kind).length - 6 + 4, 'left:-2px;bottom:4px');
    for (const p of people) folkBowl(els.get(p.id), p.kind);
    if (keeperEl) folkBowl(keeperEl, 'badger');
  }

  const memKey = `${data.kid}|${L.id}`;
  const mem = memory.get(memKey) || { x: L.start.x, y: L.start.y, seen: {} };
  memory.set(memKey, mem);
  // ponds can't be walked through; visitors, the shopkeeper and the landmark are stood round
  const lm = data.landmark;
  const grid = makeGrid(L, people, [
    ...data.areas.filter((a) => a.kind === 'pond').map((a) => [a.x - 2, a.y - 2, a.w + 4, a.h + 4]),
    ...Object.values(data.spots).map((p) => [p.x - 7, p.y - 8, 14, 10]),
    ...(L.shop ? [[L.shop.x - 7, L.shop.y - 8, 14, 10]] : []),
    ...(lm ? [landmarkBlock(lm)] : []),
  ]);
  const me = { x: mem.x, y: mem.y, path: [], goal: null, face: mem.face || 1 };
  let S = 3;
  let cam = { x: 0, y: 0 };
  let vw = 0; let vh = 0;

  const showLand = section.querySelector('.v-show canvas.map-land');
  const measure = () => {
    vw = view.clientWidth; vh = view.clientHeight;
    S = vw >= 600 ? 3 : 2;
    // the treasure map's show plays over the view (mapshow.js sizes itself from this canvas)
    if (showLand) { showLand.width = Math.ceil(vw / S); showLand.height = Math.ceil(vh / S); showLand.parentElement.dataset.scale = S; }
  };
  // on the way to the landmark and while there, the view takes in the buddy and all of it
  let atLandmark = false;
  const camTarget = () => {
    const fx = lm && (atLandmark || me.goal?.landmark) ? (Math.min(me.x - 12, lm.x) + Math.max(me.x + 12, lm.x + lm.w)) / 2 : me.x;
    // if the buddy and a big landmark don't both fit (phones), the buddy always stays fully in view
    const left = Math.max(me.x + 16 - vw / S, Math.min(me.x - 16, fx - vw / S / 2));
    const tx = W * S <= vw ? -(vw / S - W) / 2 : Math.max(0, Math.min(W - vw / S, left));
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
  const open = (dialogHtml, kind, happy, vid) => {
    dialog.innerHTML = dialogHtml;
    const src = spriteUrl(kind, happy);
    const pc = dialog.querySelector('.v-portrait canvas');
    pc.width = src.width; pc.height = src.height;
    pc.getContext('2d').drawImage(src, 0, 0);
    dialog.hidden = false;
    dialog.dataset.vid = vid;
    section.classList.add('talking');
    handlers.sound?.('talk');
  };
  // the words appear a few letters at a time, like an old game; a tap shows them all
  const typeText = (text) => {
    const $t = dialog.querySelector('.v-text');
    let n = 0;
    clearInterval(dialog.typer);
    dialog.typer = setInterval(() => { n += 2; $t.textContent = text.slice(0, n); if (n >= text.length) clearInterval(dialog.typer); }, 30);
    $t.onclick = () => { clearInterval(dialog.typer); $t.textContent = text; };
  };
  const card = (name, text, quest, buttons) => `
      <div class="v-portrait"><canvas width="16" height="16"></canvas></div>
      <div class="v-talk">
        <b class="v-name">${esc(name)}</b>
        <p class="v-text"></p>
        ${quest}
        <div class="v-buttons">${buttons}</div>
      </div>`;
  const questCard = (q) => `<div class="v-quest"><span class="v-quest-icon">${esc(q.icon)}</span><span><b>${esc(q.task)}</b><small>${esc(q.sub)}</small>${q.plan ? `<small class="v-plan">📝 Your plan: “${esc(q.plan)}”</small>` : ''}</span></div>`;
  const doLabel = (q) => (q.timer && !/^Time done/.test(q.sub) ? '▶ Start the timer' : q.verify === 'parent' ? '🙋 I did it! Ask a parent' : '✓ I did it!');

  const say = (p, mode) => {
    const name = data.name;
    const el = els.get(p.id);
    const q = activeQuest(p.tasks);
    const more = p.tasks.filter((t) => t.st === 'todo' || t.st === 'current');
    const next = allQuests.find((t) => t.st === 'current');
    const nextOwner = next && people.find((o) => o.tasks.includes(next));
    const goNext = next && nextOwner !== p ? `<button class="btn" data-v="go" data-to="${esc(nextOwner.id)}">Next quest: ${esc(next.icon)}</button>` : '';
    let text; let buttons; let quest = '';
    const offPlan = data.planned && next && q.st === 'todo' && next !== q;
    if (mode === 'thanks' || doneAll(p)) {
      text = THANKS[p.kind](name);
      const just = mode === 'thanks' ? p.tasks.filter((t) => t.st === 'done').pop() : null;
      if (more.length) {
        // this villager has another quest: it's handed over right away
        text += ' I\'ve got another quest for you!';
        quest = questCard(more[0]);
        buttons = `<button class="btn" data-v="do" data-q="${esc(more[0].id)}">${doLabel(more[0])}</button><button class="btn ghost" data-v="bye">Later</button>`;
      } else {
        // following the plan gets noticed, and the next step is one tap away
        if (just && data.planned && just.step) text += next ? ` That's step ${just.step} of your plan. Next up: ${next.task}!` : ' And that was the last step of your plan!';
        else if (just && next) text += ` Next up: ${next.task}.`;
        buttons = `${goNext}<button class="btn ${goNext ? 'ghost' : ''}" data-v="bye">Bye!</button>`;
      }
    } else if (mode === 'pending' || q.st === 'pending') {
      text = 'Great job! Now a grown-up needs to check it. I\'ll wait right here.';
      if (more.length) {
        text += ' While we wait, here\'s another one:';
        quest = questCard(more[0]);
        buttons = `<button class="btn" data-v="do" data-q="${esc(more[0].id)}">${doLabel(more[0])}</button><button class="btn ghost" data-v="bye">Later</button>`;
      } else {
        const waiting = p.tasks.find((t) => t.st === 'pending');
        buttons = `<button class="btn" data-v="do" data-q="${esc(waiting.id)}">🙋 Ask a parent now</button><button class="btn ghost" data-v="bye">Later</button>`;
      }
    } else {
      text = HELLO[p.kind](name);
      if (more.length > 1) text += ` (I have ${more.length} quests for you today. Here's the first.)`;
      // off the plan's order: point to the planned step, but never block this one
      if (offPlan) text = `Hi ${name}! Your plan says ${next.task} comes first. I can wait, or you can do mine now.`;
      else if (data.planned && q.st === 'current' && q.step) text += ` (Step ${q.step} of your plan.)`;
      quest = questCard(q);
      buttons = offPlan
        ? `${goNext.replace('Next quest', 'Go to my plan')}<button class="btn ghost" data-v="do" data-q="${esc(q.id)}">${doLabel(q)}</button>`
        : `<button class="btn" data-v="do" data-q="${esc(q.id)}">${doLabel(q)}</button><button class="btn ghost" data-v="bye">Not yet</button>`;
    }
    open(card(villagerName(p.kind), text, quest, buttons), p.kind, doneAll(p) || mode === 'thanks', p.id);
    typeText(text);
    el?.classList.add('chatting');
    setTimeout(() => el?.classList.remove('chatting'), 600);
  };
  // the shopkeeper: the buddy shop opens once every quest is done and checked
  const sayShop = () => {
    const s = data.shop;
    const text = s.open
      ? `Welcome, ${data.name}! All your quests are done, so the shop is open. Want to dress up your buddy?`
      : `Hi ${data.name}! My shop opens when all of today's quests are done and a grown-up has checked them.${s.left ? ` ${s.left} to go!` : ''} See you then!`;
    const buttons = s.open ? '<button class="btn" data-v="shop">👕 Go shopping</button><button class="btn ghost" data-v="bye">Bye!</button>' : '<button class="btn" data-v="bye">OK!</button>';
    open(card(villagerName('badger'), text, '', buttons), 'badger', s.open, 'shop');
    typeText(text);
  };
  dialog.addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]');
    if (!b) return;
    e.stopPropagation();
    if (b.dataset.v === 'shop') { closeDialog(); handlers.onShop?.(); return; }
    const p = personById(dialog.dataset.vid);
    if (b.dataset.v === 'bye' || !p) { closeDialog(); return; }
    if (b.dataset.v === 'do') { closeDialog(); handlers.onTask(b.dataset.q || activeQuest(p.tasks).id, els.get(p.id)); }
    if (b.dataset.v === 'go') { const q = personById(b.dataset.to); if (q) goTalk(q); }
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
    } else if (goal.shop) {
      me.face = L.shop.x >= me.x ? 1 : -1;
      sayShop();
    } else if (goal.chest) {
      handlers.onChest(chestEl);
    } else if (goal.home) {
      // in through the door (house.js takes it from here)
      me.face = 1;
      buddyEl.classList.add('going-in');
      setTimeout(() => handlers.onHome?.(), 380);
    } else if (goal.visitor) {
      me.face = goal.x >= me.x ? 1 : -1;
      visitorTap(goal.visitor);
    } else if (goal.landmark) {
      me.face = lm && lm.x + lm.w / 2 >= me.x ? 1 : -1;
      goal.landmark.dataset.wake = String(performance.now()); // a landmark drawn for the village wakes up to say hello
      atLandmark = true;
      handlers.onLandmark?.(goal.landmark, section.querySelector('.v-show'));
    } else if (goal.flee) {
      // safe! carry on to wherever the buddy was going
      setTimeout(() => buddyEl.classList.remove('scared'), 900);
      if (goal.resume) walkTo(goal.resume.x, goal.resume.y, goal.resume.goal);
    }
  };
  // a crab snapped at the buddy: it runs a short way off, then carries on
  const flee = (fx, fy) => {
    if (!dialog.hidden || me.goal?.flee) return false;
    const end = me.path[me.path.length - 1];
    // carry on afterwards only if the buddy was off to see someone (not back to the crab!)
    const resume = end && me.goal ? { x: end.x, y: end.y, goal: me.goal } : null;
    const dx = me.x - fx; const dy = me.y - fy; const d = Math.hypot(dx, dy) || 1;
    for (const turn of [0, 0.7, -0.7, 1.4, -1.4]) {
      const a = Math.atan2(dy / d, dx / d) + turn;
      const to = { x: me.x + Math.cos(a) * 44, y: me.y + Math.sin(a) * 44 };
      const path = findPath(grid, me, to);
      if (!path.length) continue;
      const last = path[path.length - 1];
      if (Math.hypot(last.x - to.x, last.y - to.y) > 16) continue;
      me.path = path;
      me.goal = { flee: true, resume };
      targetEl.hidden = true;
      buddyEl.classList.add('walking', 'scared');
      handlers.sound?.('tap');
      return true;
    }
    return false;
  };
  const walkTo = (x, y, goal = null) => {
    closeDialog();
    atLandmark = false;
    me.path = findPath(grid, me, { x, y });
    me.goal = goal;
    if (!me.path.length) { arrive(); return; }
    buddyEl.classList.add('walking');
  };
  const near = (spot) => Math.hypot(me.x - spot.x, me.y - spot.y) < 22;
  const goTalk = (p) => {
    const spot = standSpot(grid, p.x, p.y, me.x);
    if (near(spot)) { me.face = p.x >= me.x ? 1 : -1; say(p); return; }
    walkTo(spot.x, spot.y, { person: p.id });
  };
  const goShop = () => {
    const spot = standSpot(grid, L.shop.x, L.shop.y, me.x);
    if (near(spot)) { sayShop(); return; }
    walkTo(spot.x, spot.y, { shop: true });
  };
  const goChest = () => {
    const spot = standSpot(grid, L.chest.x, L.chest.y, me.x);
    if (near(spot)) { handlers.onChest(chestEl); return; }
    walkTo(spot.x, spot.y, { chest: true });
  };

  // ---- visitors ----
  // a visitor (or the kid's own play patch) does what it does on the map; its bubble then shows a while
  const talkUntil = new Map();
  const visitorTap = (el) => {
    handlers.onVisitor?.(el);
    const who = el.classList.contains('v-visitor') ? el : null;
    if (who) { talkUntil.set(who, performance.now() + 5000); section.querySelectorAll('.v-visitor').forEach((x) => x.classList.toggle('talking', x === who || x.classList.contains('news') || x.classList.contains('cheering'))); }
  };
  const goVisitor = (el) => {
    const sp = data.spots[el.dataset.id];
    if (!sp) return;
    // stand on the near side, or behind a fisher (the pond is in front)
    const spot = sp.role === 'fish' ? { x: sp.x - sp.face * 22, y: sp.y + 2 } : standSpot(grid, sp.x, sp.y, me.x);
    if (near(spot)) { visitorTap(el); return; }
    walkTo(spot.x, spot.y, { visitor: el, x: sp.x });
  };
  // visitors take turns talking, one bubble at a time (news always shows)
  const visitors = [...section.querySelectorAll('.v-visitor')];
  let talker = 0;
  const talkTimer = setInterval(() => {
    if (!section.isConnected) { clearInterval(talkTimer); return; }
    if (visitors.length < 2 || document.visibilityState !== 'visible') return;
    if (visitors.some((x) => (talkUntil.get(x) || 0) > performance.now())) return;
    talker = (talker + 1) % visitors.length;
    visitors.forEach((x, i) => x.classList.toggle('talking', i === talker || x.classList.contains('news') || x.classList.contains('cheering')));
  }, 4000);
  // now and then a fisher reels something in
  const fishers = visitors.filter((x) => x.classList.contains('fishing'));
  const fishTimer = fishers.length && handlers.fishCatch ? setInterval(() => {
    if (!section.isConnected) { clearInterval(fishTimer); return; }
    if (document.visibilityState !== 'visible' || Math.random() > 0.4) return;
    const el = fishers[Math.floor(Math.random() * fishers.length)];
    if (el.classList.contains('reeling')) return;
    const got = handlers.fishCatch(Number(el.dataset.rod) || 1, L.id);
    if (!got) return;
    el.querySelector('.v-catch').innerHTML = got.svg;
    el.classList.add('reeling');
    setTimeout(() => {
      el.querySelector('.visitor-bubble').firstChild.textContent = `${got.rare ? 'WOW! ' : ''}I caught ${/^[aeiou]/i.test(got.name) ? 'an' : 'a'} ${got.name}! ${got.icon}`;
      talkUntil.set(el, performance.now() + 4000);
      visitors.forEach((x) => x.classList.toggle('talking', x === el || x.classList.contains('news') || x.classList.contains('cheering')));
    }, 900);
    setTimeout(() => el.classList.remove('reeling'), 3400);
  }, 9000) : 0;

  // ---- taps ----
  view.addEventListener('click', (e) => {
    if (e.target.closest('.v-dialog')) return;
    // the Cheer button in a visitor's bubble is the app's
    if (e.target.closest('.v-visitor [data-action]')) return;
    e.stopPropagation();
    const vis = e.target.closest('.v-visitor');
    if (vis) { handlers.sound?.('tap'); goVisitor(vis); return; }
    const area = e.target.closest('.v-area.tap');
    if (area) {
      const a = data.areas.find((z) => Math.abs(z.x - parseFloat(area.style.left)) < 1);
      handlers.sound?.('tap');
      if (a) walkTo(a.x + a.w / 2, a.y + a.h + 12, { visitor: area, x: a.x + a.w / 2 });
      return;
    }
    const lmEl = e.target.closest('.v-landmark');
    if (lmEl && lm) { handlers.sound?.('tap'); walkTo(lm.stand.x, lm.stand.y, { landmark: lmEl }); return; }
    const arrow = e.target.closest('.v-arrow');
    if (arrow) {
      handlers.sound?.('tap');
      if (arrow.dataset.vid === 'chest') goChest(); else if (arrow.dataset.vid === 'shop') goShop(); else goTalk(personById(arrow.dataset.vid));
      return;
    }
    if (e.target.closest('.villager.keeper')) { handlers.sound?.('tap'); goShop(); return; }
    const who = e.target.closest('.villager');
    if (who) { handlers.sound?.('tap'); goTalk(personById(who.dataset.vid)); return; }
    if (e.target.closest('.v-chest')) { goChest(); return; }
    if (e.target.closest('.v-home')) { handlers.sound?.('tap'); walkTo(L.start.x, L.start.y, { home: true }); return; }
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
  // arrows point to the villagers of the first part of the day that still has quests (morning, then after school)
  const openFolk = () => {
    const left = people.filter((p) => p.tasks.some((t) => t.st === 'todo' || t.st === 'current'));
    // with a plan, only the plan's next step gets an arrow
    if (data.planned) return left.filter((p) => p.tasks.some((t) => t.st === 'current'));
    const am = left.filter((p) => p.period === 'morning');
    return am.length ? am : left;
  };
  // arrow buttons are kept and moved (not redrawn), so a tap lands even while the view slides
  const arrowEls = new Map();
  const drawArrows = () => {
    const list = openFolk().map((p) => ({ id: p.id, x: p.x, y: p.y - 22, icon: activeQuest(p.tasks).icon, now: p.tasks.some((t) => t.st === 'current') }));
    if (!list.length && data.chest.ready) list.push({ id: 'chest', x: L.chest.x, y: L.chest.y - 10, icon: '🎁' });
    // all done, chest opened: the shop is open
    else if (!list.length && data.shop.open && L.shop && !data.chest.ready) list.push({ id: 'shop', x: L.shop.x, y: L.shop.y - 22, icon: '👕' });
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
  const artEl = section.querySelector('.v-landmark canvas.v-art');
  const artStep = artEl && lm?.art ? LANDMARK_ART[lm.art].start(artEl, artEl.parentElement) : null;
  let last = performance.now();
  const tick = (now) => {
    if (!section.isConnected) { mem.x = me.x; mem.y = me.y; mem.cam = cam; mem.S = S; mem.face = me.face; return; }
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (me.path.length) {
      let step = SPEED * dt * (me.goal?.flee ? 1.4 : 1);
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
    artStep?.(now);
    requestAnimationFrame(tick);
  };
  window.addEventListener('resize', () => { measure(); }, { passive: true });
  startLife(section, L, data, people, {
    host: view,
    buddy: () => ({ x: me.x, y: me.y }),
    flee,
    view: () => ({ top: cam.y, bottom: cam.y + vh / S }),
    toMap: (e) => { const r = world.getBoundingClientRect(); return { x: (e.clientX - r.left) / S, y: (e.clientY - r.top) / S }; },
  });
  place();
  requestAnimationFrame(tick);

  // a quest that just got done: the villager cheers and says thanks; one sent to a parent waits
  for (const p of people) {
    let changed = null;
    for (const q of p.tasks) {
      const was = mem.seen[q.id];
      if (was && was !== q.st && (q.st === 'done' || q.st === 'pending')) changed = q.st;
      mem.seen[q.id] = q.st;
    }
    if (changed === 'done') {
      const el = els.get(p.id);
      el.classList.add('cheer');
      setTimeout(() => el.classList.remove('cheer'), 2400);
      setTimeout(() => say(p, 'thanks'), 500);
    } else if (changed === 'pending') setTimeout(() => say(p, 'pending'), 300);
  }
}
