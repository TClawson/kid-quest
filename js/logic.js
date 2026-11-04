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
      // allowance: added by the app on first start (see defaultAllowance), so it knows from which day it counts
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

// ---------- weekly allowance ----------
//
// Instead of a typed amount per task, each kid can earn a set number of coins
// and XP a week (the allowance). It is split across the kid's quest tasks for
// the week by size (small 1, medium 2, big 3), so a perfect week earns exactly
// the allowance and a kid with more chores doesn't earn more, each chore is
// just worth a little less. Exercise is outside it: it earns gems and its own XP.
// On top of that a parent can give a bonus, up to a weekly limit per kid.

export const DEFAULT_ALLOWANCE = 300;
export const DEFAULT_BONUS_LIMIT = 50;
export const MAX_ALLOWANCE = 5000;
export const SIZES = [
  { id: 1, name: 'Small' },
  { id: 2, name: 'Medium' },
  { id: 3, name: 'Big' },
];

/**
 * The family's allowance settings. since is the first day it counts: days
 * before it, from before allowances existed, keep their typed amounts.
 */
export function defaultAllowance(since = dateKey()) {
  return { on: true, coins: DEFAULT_ALLOWANCE, xp: DEFAULT_ALLOWANCE, bonus: DEFAULT_BONUS_LIMIT, since };
}

/**
 * One-time repair (2026-11-03). The first version of the allowance started it
 * on the day it was first opened, so that day's chores, already ticked and
 * counted at their typed amounts, were paid again from the allowance (less).
 * Kids saw their coins and XP drop the next morning. The allowance now starts
 * the day after it is switched on; this moves an older start date one day
 * later and drops the allowance amounts saved for that first day, so it is
 * paid at its typed amounts again. Returns true when it changed something.
 */
export function repairAllowanceStart(state) {
  const a = state.settings?.allowance;
  if (!a || a.startFixed || !a.since) return false;
  const first = a.since;
  for (const entry of Object.values(state.log[first] || {})) {
    if (!Array.isArray(entry?.scheduled)) continue;
    entry.scheduled = entry.scheduled.map(({ pay, ...t }) => t);
  }
  state.settings.allowance = { ...a, since: addDays(first, 1), startFixed: true };
  return true;
}

/** How big a task is: what the parent picked, otherwise big for a timer task, medium for a parent-checked one, small for the rest. */
export function taskSize(task) {
  if (SIZES.some((sz) => sz.id === task.size)) return task.size;
  if (task.minutes > 0) return 3;
  return task.verify === 'parent' ? 2 : 1;
}

/** A kid's weekly coins and XP: their own amounts if a parent set them, else the family's. null when allowances are off. */
export function allowanceFor(state, kid) {
  const a = state.settings?.allowance;
  if (!a?.on) return null;
  const pick = (field) => (Number.isFinite(kid.allowance?.[field]) ? kid.allowance[field] : a[field]);
  return { coins: pick('coins'), xp: pick('xp'), bonus: Number.isFinite(a.bonus) ? a.bonus : DEFAULT_BONUS_LIMIT };
}

/** Clean up a weekly amount a parent typed. Blank means "use the family's" (null). */
export function parseAllowance(value) {
  if (value === '' || value == null) return null;
  const n = Math.round(Number(value));
  return Number.isFinite(n) ? Math.max(0, Math.min(MAX_ALLOWANCE, n)) : null;
}

/** The tasks on a kid's current setup for a day (ignoring what past days remember). */
export function scheduledOn(kid, key) {
  const dow = dayOfWeek(key);
  return kid.tasks.filter((t) => t.days.includes(dow) && onWeek(t, key));
}

const splitCache = new Map();

/**
 * Splits a weekly amount across every quest task the kid's current setup has
 * that week, by size. Returns Map 'date|taskId' -> amount. Rounding is done on
 * the running total, so the parts always add up to exactly the amount.
 */
export function weekSplit(kid, key, amount) {
  const monday = weekStart(key);
  const sig = `${kid.id}|${monday}|${amount}|${kid.tasks.map((t) => `${t.id}:${t.period}:${t.days.join('')}:${taskSize(t)}:${t.everyOtherWeek ?? ''}`).join(',')}`;
  if (splitCache.has(sig)) return splitCache.get(sig);
  const slots = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(monday, i);
    for (const t of questTasks(scheduledOn(kid, day))) slots.push([`${day}|${t.id}`, taskSize(t)]);
  }
  const total = slots.reduce((n, [, w]) => n + w, 0);
  const out = new Map();
  let run = 0;
  let given = 0;
  for (const [id, w] of slots) {
    run += w;
    const upTo = Math.floor((amount * run) / total);
    out.set(id, upTo - given);
    given = upTo;
  }
  if (splitCache.size > 200) splitCache.clear();
  splitCache.set(sig, out);
  return out;
}

/**
 * What one task earns on one day: { coins, xp, gems }.
 * A past day remembers what its tasks were worth (pay, saved by snapshotToday),
 * so changing sizes, amounts or the allowance never changes what was earned.
 */
export function taskPay(state, kid, key, task, today) {
  if (key !== today && task.pay) return task.pay;
  if (isExercise(task)) return { coins: 0, xp: taskXp(task), gems: taskGems(task) };
  const a = allowanceFor(state, kid);
  const since = state.settings?.allowance?.since;
  if (!a || (since && key < since)) return { coins: taskCoins(task), xp: taskXp(task), gems: 0 };
  // a task that is not on the setup that day (e.g. ticked from a past day's list) earns nothing extra
  const slot = `${key}|${task.id}`;
  return { coins: weekSplit(kid, key, a.coins).get(slot) ?? 0, xp: weekSplit(kid, key, a.xp).get(slot) ?? 0, gems: 0 };
}

/** Bonuses a parent gave on a day: [{ id, coins, reason, by, at }]. A bonus adds the same XP as coins. */
export function bonusesOn(entry) {
  return Object.entries(entry?.bonus || {}).map(([id, b]) => ({ id, ...b }));
}

/** Everything a kid earned this week (Monday to Sunday) and how much bonus is left to give. */
export function weekEarnings(state, kid, today) {
  const monday = weekStart(today);
  const a = allowanceFor(state, kid);
  let coins = 0;
  let xp = 0;
  let bonus = 0;
  const bonuses = [];
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(monday, i);
    if (key > today) break;
    const entry = entryFor(state, kid.id, key);
    if (!entry) continue;
    for (const t of questTasks(tasksForDay(state, kid, key, today))) {
      if (entry.tasks?.[t.id]?.status !== 'done') continue;
      const p = taskPay(state, kid, key, t, today);
      coins += p.coins;
      xp += p.xp;
    }
    for (const b of bonusesOn(entry)) { bonus += b.coins || 0; bonuses.push({ ...b, key }); }
  }
  const limit = a ? a.bonus : DEFAULT_BONUS_LIMIT;
  return { coins, xp, bonus, bonuses, allowance: a, bonusLeft: Math.max(0, limit - bonus), bonusLimit: limit };
}

/** The kid's bonuses from the last few weeks, newest first, for the parents' log. */
export function recentBonuses(state, kid, today, days = 28) {
  const out = [];
  for (let i = 0; i < days; i += 1) {
    const key = addDays(today, -i);
    for (const b of bonusesOn(entryFor(state, kid.id, key))) out.push({ ...b, key, kid });
  }
  return out.sort((x, y) => (y.at || 0) - (x.at || 0));
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
  return scheduledOn(kid, key);
}

// Every-other-week tasks. Weeks run Monday to Sunday and are counted from a
// fixed Monday, so every device (each kid's tablet, each parent's phone) agrees
// on which weeks are "on" without talking to each other. A task with
// everyOtherWeek 0 or 1 runs in the weeks whose number has that parity; any
// other value means every week.
const FIRST_MONDAY = Date.UTC(2024, 0, 1);
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** Weeks since Monday 1 January 2024 (Monday to Sunday weeks). */
export function weekNumber(key) {
  const [y, m, d] = weekStart(key).split('-').map(Number);
  return Math.round((Date.UTC(y, m - 1, d) - FIRST_MONDAY) / WEEK_MS);
}

/** 0 or 1: which kind of week a day is in. Alternate weeks have opposite parity. */
export function weekParity(key) {
  return ((weekNumber(key) % 2) + 2) % 2;
}

export function isEveryOtherWeek(task) {
  return task.everyOtherWeek === 0 || task.everyOtherWeek === 1;
}

/** True when a task runs in the week of this day (always, unless it is every other week). */
export function onWeek(task, key) {
  return !isEveryOtherWeek(task) || weekParity(key) === task.everyOtherWeek;
}

/** Store today's schedule, and what each task is worth, so it is remembered once the day is over. */
export function snapshotToday(state, kid, today) {
  const tasks = tasksForDay(state, kid, today, today);
  const entry = entryFor(state, kid.id, today, true);
  entry.scheduled = tasks.map(({ pay, ...t }) => ({ ...t, pay: taskPay(state, kid, today, t, today) }));
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
 * The buddy store (dress-up and shop) opens once today's chores are finished.
 * A task the kid finished that is waiting for a parent counts, so the kid isn't
 * kept waiting on a parent's phone. Off-week tasks aren't scheduled, exercise is
 * optional, and an excused day opens the store straight away.
 */
export function storeOpen(state, kid, today) {
  const s = dayStatus(state, kid, today, today);
  return { open: s.excused || s.done + s.pending >= s.total, left: Math.max(0, s.total - s.done - s.pending) };
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
// Parent bonuses count as coins and the same amount of XP.
function totalEarned(state, kid, today, field) {
  let sum = 0;
  for (const key of Object.keys(state.log)) {
    const entry = state.log[key][kid.id];
    if (!entry) continue;
    for (const t of tasksForDay(state, kid, key, today)) {
      if (entry.tasks?.[t.id]?.status === 'done') sum += taskPay(state, kid, key, t, today)[field] || 0;
    }
    if (field !== 'gems') for (const b of bonusesOn(entry)) sum += b.coins || 0;
  }
  return sum;
}

export function totalXp(state, kid, today) {
  return totalEarned(state, kid, today, 'xp');
}

/** Coins earned ever (before spending), bonuses included. */
export function totalCoins(state, kid, today) {
  return totalEarned(state, kid, today, 'coins');
}

/** Gems earned ever (before spending). */
export function totalGems(state, kid, today) {
  return totalEarned(state, kid, today, 'gems');
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
 * at least 5 days. A day a parent excuses (sick, travel) counts neither for nor
 * against it: each excused day lowers that week's goal by one, and a week with
 * 5 or more excused days is skipped, keeping the streak without adding to it.
 * Excusing works on past days too, since everything is worked out again from
 * the history. This week adds as soon as its goal is reached, and it can't
 * break the streak until it is over. best is the longest run ever: moves it
 * unlocked are never taken away.
 */
export function exerciseStreakInfo(state, kid, today, goal = EXERCISE_DAYS) {
  const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
  const thisWeek = weekStart(today);
  let weeks = 0;
  let best = 0;
  let days = 0;
  let need = goal;
  for (let wk = weekStart(start); wk <= thisWeek; wk = addDays(wk, 7)) {
    days = 0;
    let excused = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = addDays(wk, i);
      if (key > today) break;
      if (entryFor(state, kid.id, key)?.excused) excused += 1;
      else if (exercisedOn(state, kid, key, today)) days += 1;
    }
    need = goal - excused;
    if (need <= 0) {
      // excused nearly all week: the streak waits
    } else if (days >= need) weeks += 1;
    else if (wk !== thisWeek) weeks = 0;
    best = Math.max(best, weeks);
  }
  return { weeks, best, thisWeek: days, goal: Math.max(0, need), today: exercisedOn(state, kid, today, today) };
}
