// Pure game rules: schedules, day status, streaks, freezes, XP and coins.
// No DOM access here so it can be unit tested with `node --test`.

export const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
export const WEEKDAYS = [1, 2, 3, 4, 5];
export const MAX_FREEZES = 2;
export const PERFECT_DAYS_PER_FREEZE = 7;

const pad = (n) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export function dateKey(d = new Date()) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key, n) {
  const d = parseKey(key);
  d.setDate(d.getDate() + n);
  return dateKey(d);
}

export function dayOfWeek(key) {
  return parseKey(key).getDay();
}

let idCounter = 0;
export function newId(prefix = 'id') {
  idCounter += 1;
  return `${prefix}_${Date.now().toString(36)}${idCounter.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

/** The task list a new kid starts with. Parents can edit all of it. */
export function defaultTasks() {
  const t = (name, icon, period, days, extra = {}) => ({
    id: newId('task'),
    name,
    icon,
    period,
    days,
    verify: 'self',
    minutes: 0,
    ...extra,
  });
  return [
    t('Brush teeth', '🪥', 'morning', ALL_DAYS),
    t('Make bed', '🛏️', 'morning', ALL_DAYS),
    t('Clear bedroom floor', '🧸', 'morning', ALL_DAYS),
    t('Piano practice', '🎹', 'afternoon', WEEKDAYS, { verify: 'parent', minutes: 30 }),
    t('Chore of the week', '🧽', 'afternoon', [1, 2, 3, 4], { verify: 'parent' }),
    t('Chore of the week: deep clean', '✨', 'afternoon', [5], { verify: 'parent' }),
    t('Vacuum your room', '🌀', 'afternoon', [5], { verify: 'parent' }),
    t('Dust your room', '🪶', 'afternoon', [5], { verify: 'parent' }),
    t('Laundry', '🧺', 'afternoon', [6], { verify: 'parent' }),
  ];
}

export function emptyState() {
  return {
    version: 1,
    settings: {
      pinHash: null,
      morningBy: '09:00',
      bedtime: '20:30',
      reminders: ['07:00', '15:30'],
      weeklyReward: 'Pick the Friday movie',
      sound: true,
    },
    kids: [],
    log: {}, // log[dateKey][kidId] = { tasks: {taskId: {status, at, by, seconds}}, scheduled: [task], excused }
    celebrations: {}, // celebrations[kidId] = { day: dateKey, streak: number }
  };
}

export const MAX_REWARD = 500;

/** What a task earns when a parent has not set it: 10, or 30 for a timer task like piano. */
export function defaultReward(task) {
  return task.minutes > 0 ? 30 : 10;
}

function reward(task, field) {
  const v = task[field];
  return Number.isFinite(v) && v >= 0 ? v : defaultReward(task);
}

/** XP a task earns. Parents can set it per task; otherwise the default. */
export function taskXp(task) {
  return reward(task, 'xp');
}

/** Coins a task earns. Parents can set it per task, separately from XP. Exercise earns gems instead. */
export function taskCoins(task) {
  return isExercise(task) ? 0 : reward(task, 'coins');
}

export const DEFAULT_GEMS = 10;

/** Gems an exercise task earns: 10 unless a parent set another amount. Other tasks earn none. */
export function taskGems(task) {
  if (!isExercise(task)) return 0;
  const v = task.gems;
  return Number.isFinite(v) && v >= 0 ? v : DEFAULT_GEMS;
}

/** Clean up a number a parent typed. Blank means "use the default" (null). */
export function parseReward(value) {
  if (value === '' || value == null) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_REWARD, n)) : null;
}

export function entryFor(state, kidId, key, create = false) {
  if (!state.log[key]) {
    if (!create) return null;
    state.log[key] = {};
  }
  if (!state.log[key][kidId]) {
    if (!create) return null;
    state.log[key][kidId] = { tasks: {}, excused: false };
  }
  return state.log[key][kidId];
}

/**
 * Tasks scheduled for a kid on a day. Today always follows the current setup.
 * Past days use the snapshot taken while that day was live, so editing the
 * setup later does not rewrite history (and cannot break an old streak).
 */
export function tasksForDay(state, kid, key, today) {
  const entry = entryFor(state, kid.id, key);
  if (key !== today && entry && Array.isArray(entry.scheduled)) return entry.scheduled;
  const dow = dayOfWeek(key);
  return kid.tasks.filter((t) => t.days.includes(dow));
}

/** Store today's schedule so it is remembered once the day is over. */
export function snapshotToday(state, kid, today) {
  const tasks = tasksForDay(state, kid, today, today);
  const entry = entryFor(state, kid.id, today, true);
  entry.scheduled = tasks.map((t) => ({ ...t }));
}

export function taskStatus(state, kidId, key, taskId) {
  return entryFor(state, kidId, key)?.tasks?.[taskId] ?? null;
}

/** Exercise tasks are optional bonus tasks: they earn gems and never count toward the day's quest. */
export function isExercise(task) {
  return task?.period === 'exercise';
}

/** The tasks that make up the day's quest (everything but the bonus exercise). */
export const questTasks = (tasks) => tasks.filter((t) => !isExercise(t));

export function dayStatus(state, kid, key, today) {
  const tasks = questTasks(tasksForDay(state, kid, key, today));
  const entry = entryFor(state, kid.id, key);
  let done = 0;
  let pending = 0;
  for (const t of tasks) {
    const s = entry?.tasks?.[t.id]?.status;
    if (s === 'done') done += 1;
    else if (s === 'pending') pending += 1;
  }
  return {
    tasks,
    total: tasks.length,
    done,
    pending,
    complete: done === tasks.length,
    excused: Boolean(entry?.excused),
  };
}

/**
 * Replays every day from the kid's start date to today.
 * - A complete day adds 1 to the streak. Every 7 complete days in a row earn a freeze (max 2).
 * - An excused day keeps the streak as it is.
 * - A missed past day uses a freeze if one is available, otherwise the streak resets.
 * - Today never breaks the streak; it only adds once it is complete.
 * Because it is recomputed every time, a parent approving yesterday's tasks late fixes the streak.
 */
export function streakInfo(state, kid, today) {
  let streak = 0;
  let best = 0;
  let freezes = 0;
  let run = 0; // complete days in a row, for earning freezes
  const frozen = [];
  const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
  for (let key = start; key <= today; key = addDays(key, 1)) {
    const s = dayStatus(state, kid, key, today);
    if (s.complete) {
      streak += 1;
      run += 1;
      if (run % PERFECT_DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
    } else if (key === today) {
      // still in progress
    } else if (s.excused) {
      // keeps the streak, but the perfect run starts over
      run = 0;
    } else if (freezes > 0) {
      freezes -= 1;
      run = 0;
      frozen.push(key);
    } else {
      streak = 0;
      run = 0;
    }
    best = Math.max(best, streak);
  }
  const todayStatus = dayStatus(state, kid, today, today);
  return { streak, best, freezes, frozen, todayComplete: todayStatus.complete };
}

// Past days use that day's snapshot, so changing a task's reward later only
// affects today and the days after it: what a kid already earned stays earned.
function totalEarned(state, kid, today, perTask) {
  let sum = 0;
  for (const key of Object.keys(state.log)) {
    const entry = state.log[key][kid.id];
    if (!entry) continue;
    for (const t of tasksForDay(state, kid, key, today)) {
      if (entry.tasks?.[t.id]?.status === 'done') sum += perTask(t);
    }
  }
  return sum;
}

export function totalXp(state, kid, today) {
  return totalEarned(state, kid, today, taskXp);
}

/** Coins earned ever (before spending). */
export function totalCoins(state, kid, today) {
  return totalEarned(state, kid, today, taskCoins);
}

/** Gems earned ever (before spending). */
export function totalGems(state, kid, today) {
  return totalEarned(state, kid, today, taskGems);
}

export function levelFor(xp) {
  return { level: Math.floor(xp / 100) + 1, into: xp % 100 };
}

/** Pending approvals across recent days, newest first. */
export function pendingApprovals(state, today, daysBack = 14) {
  const out = [];
  for (let i = 0; i <= daysBack; i += 1) {
    const key = addDays(today, -i);
    for (const kid of state.kids) {
      for (const t of tasksForDay(state, kid, key, today)) {
        if (taskStatus(state, kid.id, key, t.id)?.status === 'pending') out.push({ key, kid, task: t });
      }
    }
  }
  return out;
}

/** Simple non-cryptographic fallback hash, used only if WebCrypto is unavailable. */
export function fallbackHash(text) {
  let h = 5381;
  for (let i = 0; i < text.length; i += 1) h = ((h << 5) + h + text.charCodeAt(i)) >>> 0;
  return `djb2:${h.toString(16)}`;
}

/** A piano practice task, found by its name or its 🎹 icon so renamed tasks still count. */
export function isPianoTask(task) {
  return /piano/i.test(task?.name || '') || task?.icon === '🎹';
}

/** How many days a week piano is on the kid's current schedule (5 for Mon–Fri). */
export function pianoDaysPerWeek(kid) {
  const days = new Set();
  for (const t of kid.tasks || []) if (isPianoTask(t)) t.days.forEach((d) => days.add(d));
  return days.size;
}

/**
 * The piano streak counts piano days done in a row (parent-approved, like the main streak).
 * Days without piano don't break it, an excused day keeps it, and today only adds once done.
 * There are no freezes here: the piano rewards are for getting it done every time.
 */
export function pianoStreakInfo(state, kid, today) {
  let streak = 0;
  let best = 0;
  const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
  for (let key = start; key <= today; key = addDays(key, 1)) {
    const piano = tasksForDay(state, kid, key, today).filter(isPianoTask);
    if (!piano.length) continue;
    const entry = entryFor(state, kid.id, key);
    if (piano.every((t) => entry?.tasks?.[t.id]?.status === 'done')) streak += 1;
    else if (key === today || entry?.excused) {
      // in progress, or excused: keep the streak
    } else streak = 0;
    best = Math.max(best, streak);
  }
  return { streak, best, perWeek: pianoDaysPerWeek(kid) };
}

// ---------- exercise streak ----------

/** Exercise days a week needs to count toward the exercise streak. */
export const EXERCISE_DAYS = 5;

/** Monday of the week a day is in. */
export function weekStart(key) {
  return addDays(key, -((dayOfWeek(key) + 6) % 7));
}

/** True when at least one exercise task is done that day (parent-approved if it needs a parent). */
export function exercisedOn(state, kid, key, today) {
  const entry = entryFor(state, kid.id, key);
  if (!entry) return false;
  return tasksForDay(state, kid, key, today).some((t) => isExercise(t) && entry.tasks?.[t.id]?.status === 'done');
}

/**
 * The exercise streak counts weeks (Monday to Sunday) in a row with exercise on
 * at least 5 days. An excused day counts as an exercise day, so a sick day
 * doesn't cost a week. This week adds as soon as its 5th day is done, and it
 * can't break the streak until it is over. best is the longest run ever: moves
 * it unlocked are never taken away.
 */
export function exerciseStreakInfo(state, kid, today, goal = EXERCISE_DAYS) {
  const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
  const thisWeek = weekStart(today);
  let weeks = 0;
  let best = 0;
  let days = 0;
  for (let wk = weekStart(start); wk <= thisWeek; wk = addDays(wk, 7)) {
    days = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = addDays(wk, i);
      if (key > today) break;
      if (exercisedOn(state, kid, key, today) || (key < today && entryFor(state, kid.id, key)?.excused)) days += 1;
    }
    if (days >= goal) weeks += 1;
    else if (wk !== thisWeek) weeks = 0;
    best = Math.max(best, weeks);
  }
  return { weeks, best, thisWeek: days, goal, today: exercisedOn(state, kid, today, today) };
}
