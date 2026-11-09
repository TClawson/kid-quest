// The buddy's house: which chores it shows (an unmade bed, the toothbrush out, a messy
// floor), how full the trophy shelf looks, and whether the buddy is inside or out.
// Pure logic, no DOM (house.js is the walkable room, houseart.js draws it).

import { tasksForDay, entryFor, addDays, isExercise } from './logic.js';

// Which chores the house shows is set by the parents: a task linked to the house has
// task.house = 'bed' | 'teeth' | 'floor' (set in the task editor, or by adding a task from a
// preset). Nothing is guessed from a task's name: until a parent links a task, that part of
// the house just looks tidy. Each kid has at most one task for each.
export const HOUSE_CHORES = [
  { id: 'bed', label: 'Make bed', name: 'Make bed', icon: '🛏️', period: 'morning' },
  { id: 'teeth', label: 'Brush teeth (morning)', name: 'Brush teeth', icon: '🪥', period: 'morning' },
  { id: 'floor', label: 'Pick up bedroom floor', name: 'Pick up bedroom floor', icon: '🧸', period: 'morning' },
];
export const houseChoreById = (id) => HOUSE_CHORES.find((c) => c.id === id) || null;

/** The house chore a task is linked to ('bed', 'teeth', 'floor'), or null. */
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

/** A new task made from a house chore preset (name, icon, morning), linked to the house. */
export function houseTask(role, id) {
  const c = houseChoreById(role);
  return { id, name: c.name, icon: c.icon, period: c.period, days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0, house: role };
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
    if (entry?.excused) continue;
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
 * What the house shows for today's chores: { bed, teeth, floor }, each { id, name, icon, done }
 * or null when no task linked to it is on today's list (the house then looks tidy), and
 * mess (0-3) for the floor.
 */
export function houseChores(state, kid, today) {
  const tasks = tasksForDay(state, kid, today, today).filter((t) => !isExercise(t));
  const entry = entryFor(state, kid.id, today);
  const out = { bed: null, teeth: null, floor: null, mess: 0 };
  for (const kind of ['bed', 'teeth', 'floor']) {
    const t = tasks.find((x) => x.house === kind);
    if (t) out[kind] = { id: t.id, name: t.name, icon: t.icon, done: saidDone(entry, t) };
  }
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
// wherever the kid left it (its house, the music house, or out in the village) is where it
// is when the app opens again that day.

const KEY = 'kidquest.house';
export const PLACES = ['house', 'music', 'out'];

function readAll(storage) {
  try { return JSON.parse(storage?.getItem(KEY) || '{}') || {}; } catch { return {}; }
}
function writeAll(storage, all) {
  try { storage?.setItem(KEY, JSON.stringify(all)); } catch { /* private window or full storage: it just isn't remembered */ }
}

/**
 * Where the kid's buddy is today: 'house' (its own house), 'music' (the music house) or
 * 'out' (the village). A new day starts in its house. The very first time (before the house
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

/** The buddy went into its house, the music house, or out to the village. */
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
