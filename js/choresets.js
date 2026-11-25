// Starter chore sets by age. A parent picks one per kid, then tunes it (the task editor).
// Little kids (about 3 to 8) get small jobs with a clear end: get dressed, and the room as
// clothes, toys and books. Big kids (9 and up) get "clean up your room". Everyone brushes
// their teeth in the morning and at night.
//
// Switching sets never touches a chore that isn't in a set (piano, a custom chore): it adds
// the set's chores the kid doesn't have yet and takes off the ones the set replaces (the
// little room jobs replace "clean up your room", and back). Pure logic, no DOM.

import { ALL_DAYS, WEEKDAYS } from './logic.js';

const item = (key, name, icon, routine, days, extra = {}) => ({ key, name, icon, routine, days, ...extra });

// key: what makes two chores "the same" across kids and sets; house: the buddy-house link
export const SET_CHORES = {
  dressed: item('dressed', 'Get dressed', '👕', 'morning', ALL_DAYS, { house: 'dressed' }),
  bed: item('bed', 'Make bed', '🛏️', 'morning', ALL_DAYS, { house: 'bed' }),
  teeth: item('teeth', 'Brush teeth', '🪥', 'morning', ALL_DAYS, { house: 'teeth' }),
  room: item('room', 'Clean up your room', '🧹', 'morning', ALL_DAYS, { house: 'floor' }),
  clothes: item('clothes', 'Clothes away', '👚', 'afternoon', ALL_DAYS, { house: 'clothes' }),
  toys: item('toys', 'Toys away', '🧸', 'afternoon', ALL_DAYS, { house: 'floor' }),
  books: item('books', 'Books away', '📚', 'afternoon', ALL_DAYS, { house: 'books' }),
  piano: item('piano', 'Piano practice', '🎹', 'afternoon', WEEKDAYS, { verify: 'parent', minutes: 30 }),
  chore: item('chore', 'Chore of the week', '🧽', 'afternoon', [1, 2, 3, 4], { verify: 'parent' }),
  deep: item('deep', 'Chore of the week: deep clean', '✨', 'afternoon', [5], { verify: 'parent' }),
  vacuum: item('vacuum', 'Vacuum your room', '🌀', 'afternoon', [5], { verify: 'parent', house: 'vacuum' }),
  dust: item('dust', 'Dust your room', '🪶', 'afternoon', [5], { verify: 'parent', house: 'dust' }),
  laundry: item('laundry', 'Laundry', '🧺', 'afternoon', [6], { verify: 'parent' }),
  pajamas: item('pajamas', 'Pajamas on', '🌙', 'evening', ALL_DAYS, { house: 'pajamas' }),
  'teeth-night': item('teeth-night', 'Brush teeth', '🪥', 'evening', ALL_DAYS, { house: 'teeth-night' }),
};

export const CHORE_SETS = [
  {
    id: 'little',
    name: 'Little',
    ages: 'about 3 to 8',
    note: 'Small jobs with a clear end: get dressed, and the room as clothes, toys and books.',
    chores: ['dressed', 'bed', 'teeth', 'clothes', 'toys', 'books', 'teeth-night', 'pajamas'],
    replaces: ['room'],
  },
  {
    id: 'big',
    name: 'Big',
    ages: '9 and up',
    note: 'The whole room as one chore, piano, the chore of the week and Friday cleaning.',
    chores: ['bed', 'teeth', 'room', 'piano', 'chore', 'deep', 'vacuum', 'dust', 'laundry', 'teeth-night'],
    replaces: ['dressed', 'clothes', 'toys', 'books', 'pajamas'],
  },
];
export const choreSetById = (id) => CHORE_SETS.find((s) => s.id === id) || null;

const norm = (s) => String(s || '').trim().toLowerCase();

/**
 * Whether a kid's task is this set chore: the same set key, else (for a task made before
 * sets) the same buddy-house link, else the same name in the same routine.
 */
export function isSetChore(task, key) {
  const c = SET_CHORES[key];
  if (!c || task.period === 'exercise') return false;
  if (task.setKey) return task.setKey === key;
  // the floor link belongs to "clean up your room" for big kids and "toys away" for little ones
  if (c.house && c.house !== 'floor' && task.house === c.house) return true;
  if (key === 'room' && task.house === 'floor' && norm(task.name) !== norm(SET_CHORES.toys.name)) return true;
  if (key === 'toys' && task.house === 'floor' && norm(task.name) === norm(c.name)) return true;
  return norm(task.name) === norm(c.name) && routineOfTask(task) === c.routine;
}

export const ROUTINES = ['morning', 'afternoon', 'evening'];

/** 'morning', 'afternoon' or 'evening' for a chore (exercise: 'exercise'). */
export function routineOfTask(task) {
  if (task?.period === 'exercise') return 'exercise';
  if (task?.evening) return 'evening';
  return task?.period === 'morning' ? 'morning' : 'afternoon';
}

/** A new task from a set chore. */
export function setTask(key, id) {
  const c = SET_CHORES[key];
  return {
    id,
    name: c.name,
    icon: c.icon,
    period: c.routine === 'morning' ? 'morning' : 'afternoon',
    ...(c.routine === 'evening' ? { evening: true } : {}),
    days: [...c.days],
    verify: c.verify || 'self',
    minutes: c.minutes || 0,
    ...(c.house ? { house: c.house } : {}),
    setKey: key,
  };
}

/** What switching a kid to a set would do: { add: [keys], remove: [tasks] }. */
export function setChanges(kid, setId) {
  const set = choreSetById(setId);
  if (!set) return { add: [], remove: [] };
  const tasks = kid.tasks || [];
  const add = set.chores.filter((key) => !tasks.some((t) => isSetChore(t, key)));
  const remove = tasks.filter((t) => set.replaces.some((key) => isSetChore(t, key)) && !set.chores.some((key) => isSetChore(t, key)));
  return { add, remove };
}

/**
 * Switch a kid to a set, in place: takes off the chores it replaces, adds the missing ones
 * (each after the last chore of its routine), and remembers the set on kid.choreSet. The
 * buddy-house links follow: only one task per kid holds each link.
 */
export function applySet(kid, setId, newId) {
  const set = choreSetById(setId);
  if (!set) return { added: [], removed: [] };
  const { add, remove } = setChanges(kid, setId);
  const gone = new Set(remove.map((t) => t.id));
  kid.tasks = (kid.tasks || []).filter((t) => !gone.has(t.id));
  const added = [];
  for (const key of add) {
    const t = setTask(key, newId('task'));
    if (t.house) for (const o of kid.tasks) if (o.house === t.house) delete o.house;
    // after the last chore of the same routine (or of an earlier one), so the editor keeps its order
    const rank = ROUTINES.indexOf(SET_CHORES[key].routine);
    let at = -1;
    kid.tasks.forEach((o, i) => { const r = ROUTINES.indexOf(routineOfTask(o)); if (r >= 0 && r <= rank) at = i; });
    kid.tasks.splice(at + 1, 0, t);
    added.push(t);
  }
  kid.choreSet = setId;
  return { added, removed: remove };
}
