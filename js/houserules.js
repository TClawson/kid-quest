// The buddy's house: which chores it shows (an unmade bed, the toothbrush out, a messy
// floor), how full the trophy shelf looks, and whether the buddy is inside or out.
// Pure logic, no DOM (house.js is the walkable room, houseart.js draws it).

import { tasksForDay, entryFor, addDays, isExercise, excusedOn } from './logic.js';

// Which chores the house shows is set by the parents: a task linked to the house has
// task.house = one of HOUSE_CHORES' ids (set in the task editor, or by adding a task from a
// preset or a chore set). Nothing is guessed from a task's name: until a parent links a task,
// that part of the house just looks tidy. Each kid has at most one task for each.
//
// The house is the kid's own bedroom and bathroom, so every chore done there is done in the
// house, never handed out by villagers: the bed, both brushings, the floor, getting dressed and
// pajamas (the dresser), clothes away (the laundry basket), books away (the pile by the bed),
// the shower, and the weekly vacuum and dusting. slot: where in the house it waits (two chores
// can share one, the morning one first and the evening one from NIGHT_HOUR).
// preset: offered as a ready-made "Add a house chore" button in the task editor.
export const HOUSE_CHORES = [
  { id: 'bed', slot: 'bed', label: 'Make bed', name: 'Make bed', icon: '🛏️', period: 'morning', preset: true },
  { id: 'teeth', slot: 'teeth', label: 'Brush teeth (morning)', name: 'Brush teeth', icon: '🪥', period: 'morning', preset: true },
  { id: 'floor', slot: 'floor', label: 'Pick up bedroom floor', name: 'Pick up bedroom floor', icon: '🧸', period: 'morning', preset: true },
  { id: 'teeth-night', slot: 'teeth', label: 'Brush teeth (night)', name: 'Brush teeth', icon: '🪥', period: 'afternoon', evening: true, preset: true },
  { id: 'dressed', slot: 'dresser', label: 'Get dressed', name: 'Get dressed', icon: '👕', period: 'morning' },
  { id: 'pajamas', slot: 'dresser', label: 'Pajamas on', name: 'Pajamas on', icon: '🌙', period: 'afternoon', evening: true },
  { id: 'clothes', slot: 'basket', label: 'Clothes away', name: 'Clothes away', icon: '👚', period: 'afternoon' },
  { id: 'books', slot: 'books', label: 'Books away', name: 'Books away', icon: '📚', period: 'afternoon' },
  { id: 'shower', slot: 'shower', label: 'Shower or bath', name: 'Shower', icon: '🚿', period: 'afternoon', evening: true, preset: true },
  { id: 'vacuum', slot: 'vacuum', label: 'Vacuum the room', name: 'Vacuum your room', icon: '🌀', period: 'afternoon' },
  { id: 'dust', slot: 'dust', label: 'Dust the room', name: 'Dust your room', icon: '🪶', period: 'afternoon' },
];
/** The places in the house a chore can wait at (the bed, the sink, the dresser, ...). */
export const HOUSE_SLOTS = [...new Set(HOUSE_CHORES.map((c) => c.slot))];

// From this hour the sink waits for the night brushing (once the morning one is done).
export const NIGHT_HOUR = 17;
export const houseChoreById = (id) => HOUSE_CHORES.find((c) => c.id === id) || null;

/** The house chore a task is linked to ('bed', 'teeth', 'shower', ...), or null. */
export const houseRole = (task) => (houseChoreById(task?.house) ? task.house : null);

/**
 * Link a task to a house chore (or unlink it with role null). Only one task per kid holds
 * each role, so any other task holding it is unlinked. Changes the tasks in place and
 * returns the tasks that lost the role (to tell the parent).
 */
export function setHouseRole(tasks, taskId, role) {
  const task = tasks.find((t) => t.id === taskId);
  if (!task) return [];
  const cleared = [];
  if (!houseChoreById(role)) { delete task.house; return cleared; }
  for (const t of tasks) if (t !== task && t.house === role) { delete t.house; cleared.push(t); }
  task.house = role;
  return cleared;
}

// One-time repair (2026-11-25): the chore sets (2026-11-23) added bedroom and bathroom chores
// (get dressed, clothes, books, pajamas, vacuum, dust) without a house link, and an evening
// shower made before the house could hold one had none either, so villagers handed them out.
// This links them once per kid (the id goes in kid.grants, synced, so it never runs twice and
// a parent's later "None" in the task editor stays). The shower is found by its name here,
// once; after this the house only ever reads task.house.
export const ROOM_LINKS_ID = 'room-chores-in-house-2026-11-25';
const BY_SET_KEY = { dressed: 'dressed', pajamas: 'pajamas', clothes: 'clothes', books: 'books', vacuum: 'vacuum', dust: 'dust' };
/** Link a kid's room chores to the house, once. Returns true when it changed anything. */
export function linkRoomChores(kid) {
  if (!kid || (kid.grants || []).includes(ROOM_LINKS_ID)) return false;
  const tasks = kid.tasks || [];
  const taken = new Set(tasks.map(houseRole).filter(Boolean));
  const link = (t, role) => { if (!taken.has(role)) { t.house = role; taken.add(role); } };
  for (const t of tasks) {
    if (isExercise(t) || houseRole(t)) continue;
    if (BY_SET_KEY[t.setKey]) link(t, BY_SET_KEY[t.setKey]);
    else if (/\b(shower|bath)/i.test(t.name || '')) link(t, 'shower');
  }
  kid.grants = [...(kid.grants || []), ROOM_LINKS_ID];
  return true;
}

/** A new task made from a house chore preset (name, icon, routine), linked to the house. */
export function houseTask(role, id) {
  const c = houseChoreById(role);
  return { id, name: c.name, icon: c.icon, period: c.period, ...(c.evening ? { evening: true } : {}), days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0, house: role };
}

/** The kid has said it's done (a parent may still need to check it). */
const saidDone = (entry, task) => ['done', 'pending'].includes(entry?.tasks?.[task.id]?.status);

// How far back to look for the last time the floor was picked up.
const LOOK_BACK = 21;

/**
 * Days the floor has gone without being picked up, counting today: 0 when it's done today
 * (or the kid has no such chore today). Days the chore wasn't on the list, and excused days,
 * are skipped; days before the kid started don't count.
 */
export function floorDays(state, kid, today) {
  // the floor task is the one linked to the house; on past days it's the same task (by id)
  // as long as it was on that day's list
  const ids = new Set((kid.tasks || []).filter((t) => t.house === 'floor').map((t) => t.id));
  const isFloor = (t) => !isExercise(t) && (t.house === 'floor' || ids.has(t.id));
  const todays = tasksForDay(state, kid, today, today).filter((t) => !isExercise(t) && t.house === 'floor');
  if (!todays.length) return 0;
  const now = entryFor(state, kid.id, today);
  if (todays.some((t) => saidDone(now, t))) return 0;
  let days = 1;
  for (let i = 1; i <= LOOK_BACK; i += 1) {
    const key = addDays(today, -i);
    if (kid.startDate && key < kid.startDate) break;
    const entry = entryFor(state, kid.id, key);
    if (excusedOn(state, kid.id, key)) continue;
    const list = tasksForDay(state, kid, key, today).filter(isFloor);
    if (!list.length) continue;
    if (list.some((t) => saidDone(entry, t))) break;
    days += 1;
  }
  return days;
}

/** How messy the floor looks: 0 tidy, 1 a bit messy (today), 2 messier (2-3 days), 3 very messy (4+ days). */
export const messLevel = (days) => (days <= 0 ? 0 : days === 1 ? 1 : days <= 3 ? 2 : 3);

/**
 * What the house shows for today's chores: one entry per place (HOUSE_SLOTS: bed, teeth (the
 * sink), floor, dresser, basket, books, shower, vacuum, dust), each { id, name, icon, done } or
 * null when no task linked to it is on today's list (that place then looks tidy), and mess
 * (0-3) for the floor. The sink has two brushings and the dresser getting dressed and pajamas:
 * the morning one, then (once that is done, from NIGHT_HOUR) the evening one. ids: every house
 * chore on today's list, the waiting evening ones too, so villagers never give those out.
 */
export function houseChores(state, kid, today, hour = new Date().getHours()) {
  const tasks = tasksForDay(state, kid, today, today).filter((t) => !isExercise(t));
  const entry = entryFor(state, kid.id, today);
  const out = { mess: 0, ids: [] };
  const item = (t) => (t ? { id: t.id, name: t.name, icon: t.icon, done: saidDone(entry, t) } : null);
  for (const slot of HOUSE_SLOTS) {
    const [am, pm] = HOUSE_CHORES.filter((c) => c.slot === slot).map((c) => item(tasks.find((x) => x.house === c.id)));
    // a shared place: the morning chore, then (once that is done, from NIGHT_HOUR) the evening one
    out[slot] = pm === undefined ? am : pm && (!am || am.done) && hour >= NIGHT_HOUR ? pm : am || (hour >= NIGHT_HOUR ? pm : null);
  }
  out.ids = tasks.filter((x) => houseRole(x)).map((x) => x.id);
  out.mess = messLevel(floorDays(state, kid, today));
  return out;
}
/** How full the trophy shelf looks: 0 empty, 1 a few, 2 mostly full, 3 full. */
export function shelfLevel(count, total) {
  if (count <= 0) return 0;
  if (count >= total) return 3;
  return count * 2 >= total ? 2 : 1;
}

// ---------- inside or outside ----------
// Where the buddy is lives on this device only (each kid has their own tablet user), per kid:
// the first time the app opens on a new day the buddy wakes up inside its house; after that,
// wherever the kid left it (its house, the music house, the garden, or out in the village) is where it
// is when the app opens again that day.

const KEY = 'kidquest.house';
export const PLACES = ['house', 'music', 'garden', 'out'];

function readAll(storage) {
  try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function writeAll(storage, all) {
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* private window or full storage: it just isn't remembered */ }
}

/**
 * Where the kid's buddy is today: 'house' (its own house), 'music' (the music house),
 * 'garden' (the backyard garden) or 'out' (the village). A new day starts in its house. The very first time (before the house
 * existed) the buddy starts outside, next to its house, so the kid finds the door. Saves
 * what it decided, so it holds for the rest of the day.
 */
export function placeOf(kidId, today, storage = globalThis.localStorage) {
  const all = readAll(storage);
  const was = all[kidId];
  if (was && was.day === today) return PLACES.includes(was.place) ? was.place : was.inside ? 'house' : 'out';
  const place = was ? 'house' : 'out'; // first time ever: outside
  all[kidId] = { day: today, inside: place === 'house', place };
  writeAll(storage, all);
  return place;
}

/** The buddy went into its house, the music house, the garden, or out to the village. */
export function setPlace(kidId, today, place, storage = globalThis.localStorage) {
  const p = PLACES.includes(place) ? place : 'out';
  const all = readAll(storage);
  all[kidId] = { day: today, inside: p === 'house', place: p };
  writeAll(storage, all);
}

/** Whether the kid's buddy is inside its own house today (see placeOf). */
export const isInside = (kidId, today, storage = globalThis.localStorage) => placeOf(kidId, today, storage) === 'house';

/** The buddy went in (true) or out (false) of its own house. */
export const setInside = (kidId, today, inside, storage = globalThis.localStorage) => setPlace(kidId, today, inside ? 'house' : 'out', storage);
