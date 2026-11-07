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
export function weekSplit(kid, key, amount, half = null) {
  const monday = weekStart(key);
  const weight = (t) => taskSize(t) * (half?.has(t.id) ? MASTERED_PAY : 1);
  const sig = `${kid.id}|${monday}|${amount}|${kid.tasks.map((t) => `${t.id}:${t.period}:${t.days.join('')}:${weight(t)}:${t.everyOtherWeek ?? ''}`).join(',')}`;
  if (splitCache.has(sig)) return splitCache.get(sig);
  const slots = [];
  for (let i = 0; i < 7; i += 1) {
    const day = addDays(monday, i);
    for (const t of questTasks(scheduledOn(kid, day))) slots.push([`${day}|${t.id}`, weight(t)]);
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
  // a habit mastered before this week gets a smaller share of the allowance; the week's total stays
  // the same, so the rest goes to the habits the kid is still building
  const half = masteredBefore(state, kid, weekStart(key), today);
  // without the allowance, each task keeps the amount a parent typed: mastering one never lowers the total
  if (!a || (since && key < since)) return { coins: taskCoins(task), xp: taskXp(task), gems: 0 };
  // a task that is not on the setup that day (e.g. ticked from a past day's list) earns nothing extra
  const slot = `${key}|${task.id}`;
  return { coins: weekSplit(kid, key, a.coins, half).get(slot) ?? 0, xp: weekSplit(kid, key, a.xp, half).get(slot) ?? 0, gems: 0 };
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
 * The buddy store (dress-up and shop) opens once every one of today's chores is
 * done and approved: a task still waiting for a parent keeps it shut. Off-week
 * tasks aren't scheduled, exercise is optional, and an excused day opens the
 * store straight away.
 */
export function storeOpen(state, kid, today) {
  const s = dayStatus(state, kid, today, today);
  return { open: s.excused || s.done >= s.total, left: Math.max(0, s.total - s.done - s.pending), waiting: s.pending };
}

// Results that are slow to work out (they replay a kid's whole history) can be
// kept while one screen is drawn, since it asks for them many times and nothing
// changes meanwhile. Outside withMemo they are always worked out fresh.
let memo = null;
export function withMemo(fn) {
  if (memo) return fn();
  memo = new Map();
  try { return fn(); } finally { memo = null; }
}
function memoize(key, make) {
  if (!memo) return make();
  if (!memo.has(key)) memo.set(key, make());
  return memo.get(key);
}

/** Coins (and the same XP) for finishing the whole day right after a missed day. */
export const COMEBACK_BONUS = 15;

/**
 * Replays every day from the kid's start date to today.
 * - A complete day adds 1 to the streak. Every 7 complete days in a row earn a freeze (max 2).
 * - An excused day keeps the streak as it is.
 * - A missed past day uses a freeze if one is available. Otherwise the streak is
 *   cut in half (not back to 0): research on streaks finds that losing all of it
 *   makes kids give up, while a smaller setback keeps them going.
 * - Today never breaks the streak; it only adds once it is complete.
 * - inARow counts real days in a row (a freeze or an excused day keeps it, a
 *   miss starts it over). The weekly celebration and its reward go by it.
 * - comebacks: complete days that came right after a missed day (frozen or not).
 *   Each earns a small welcome-back bonus.
 * Because it is recomputed every time, a parent approving yesterday's tasks late fixes the streak.
 */
export function streakInfo(state, kid, today) {
  return memoize(`streak|${kid.id}|${today}`, () => {
    let streak = 0;
    let best = 0;
    let freezes = 0;
    let run = 0; // complete days in a row, for earning freezes
    let inARow = 0;
    let missed = false; // the day before was missed
    const frozen = [];
    const comebacks = [];
    const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
    for (let key = start; key <= today; key = addDays(key, 1)) {
      const s = dayStatus(state, kid, key, today);
      if (s.complete) {
        if (missed) comebacks.push(key);
        streak += 1;
        inARow += 1;
        run += 1;
        if (run % PERFECT_DAYS_PER_FREEZE === 0) freezes = Math.min(MAX_FREEZES, freezes + 1);
        missed = false;
      } else if (key === today) {
        // still in progress
      } else if (s.excused) {
        // keeps the streak, but the perfect run starts over
        run = 0;
        missed = false;
      } else if (freezes > 0) {
        freezes -= 1;
        run = 0;
        frozen.push(key);
        missed = true;
      } else {
        streak = Math.floor(streak / 2);
        inARow = 0;
        run = 0;
        missed = true;
      }
      best = Math.max(best, streak);
    }
    const todayStatus = dayStatus(state, kid, today, today);
    return { streak, best, freezes, frozen, inARow, comebacks, todayComplete: todayStatus.complete };
  });
}

/**
 * The real-world weekly reward (settings.weeklyReward, like "Pick the Friday
 * movie"). It lands on Friday once every school day, Monday to Friday, is done:
 * all of that day's chores done and parent-approved, or the day excused by a
 * parent. Off-week tasks aren't scheduled, so they never count, and exercise is
 * optional. A missed day loses that week's reward even if a streak freeze saved
 * the streak. Weekend chores still count for streaks and coins, but not for the
 * reward. Days before the kid started don't count, and a week with no finished
 * day at all (all excused) doesn't earn it. It is worked out again from the
 * history each time, so a parent approving Thursday's chores late on Saturday
 * still earns it; it stays earned through Sunday.
 * days: one { key, state } per Monday to Friday: done, excused, missed, today, future or before (the kid's start).
 */
export function weeklyRewardInfo(state, kid, today) {
  return memoize(`reward|${kid.id}|${today}`, () => {
    const monday = weekStart(today);
    const friday = addDays(monday, 4);
    const days = [];
    let done = 0;
    let open = 0; // days not finished yet: today, or still to come
    let lost = false;
    for (let i = 0; i < 5; i += 1) {
      const key = addDays(monday, i);
      let st;
      if (kid.startDate && key < kid.startDate) st = 'before';
      else if (key > today) st = 'future';
      else {
        const s = dayStatus(state, kid, key, today);
        if (s.complete) st = 'done';
        else if (s.excused) st = 'excused';
        else if (key === today) st = 'today';
        else st = 'missed';
      }
      if (st === 'done') done += 1;
      if (st === 'missed') lost = true;
      if (st === 'today' || st === 'future') open += 1;
      days.push({ key, state: st });
    }
    const earned = today >= friday && !lost && !open && done > 0;
    // a kid who starts after Monday can still earn it, but one who starts on the weekend waits for next week
    if (kid.startDate && kid.startDate > friday) lost = true;
    return { monday, friday, days, done, earned, lost };
  });
}

/**
 * Weekly rewards a parent still has to hand over, oldest first: one { kid, monday }
 * for each kid who earned this week's reward or last week's, and that no parent
 * has marked given yet (kid.rewardsGiven[monday]). Last week's is checked as of
 * its Sunday, so a reward forgotten over the weekend keeps reminding all the
 * next week. The mark lives on the kid's doc, so both parents' phones see it.
 */
export function rewardsToGive(state, today) {
  if (!state.settings.weeklyReward?.trim()) return [];
  const thisMonday = weekStart(today);
  const out = [];
  for (const monday of [addDays(thisMonday, -7), thisMonday]) {
    const asOf = monday === thisMonday ? today : addDays(monday, 6);
    for (const kid of state.kids) {
      if (kid.rewardsGiven?.[monday]) continue;
      if (weeklyRewardInfo(state, kid, asOf).earned) out.push({ kid, monday });
    }
  }
  return out;
}

/** Marks a kid's weekly reward handed over (at = a timestamp), or not (at = null). Drops marks older than a month. */
export function markRewardGiven(kid, monday, at) {
  const given = { ...(kid.rewardsGiven || {}) };
  if (at) given[monday] = at;
  else delete given[monday];
  for (const k of Object.keys(given)) if (k < addDays(monday, -28)) delete given[k];
  kid.rewardsGiven = given;
}

/** Days complete (or excused) out of days so far this calendar month. */
export function monthDays(state, kid, today) {
  const first = `${today.slice(0, 8)}01`;
  const start = kid.startDate && kid.startDate > first ? kid.startDate : first;
  let done = 0;
  let days = 0;
  for (let key = start; key <= today; key = addDays(key, 1)) {
    const s = dayStatus(state, kid, key, today);
    if (key === today && !s.complete) continue;
    days += 1;
    if (s.complete || s.excused) done += 1;
  }
  return { done, days };
}

// ---------- habit levels ----------
//
// Habits take about two months of steady repeats to form. A task a kid has done
// on at least 85% of the days it was on their list over 60 days becomes a
// mastered habit: it gets a star for good, and from the next Monday it gets half
// the share of the weekly allowance (MASTERED_PAY). The week's total is the same:
// the rest goes to the tasks the kid is still learning. After a star the count
// starts over, so keeping it up for the next 60 days earns another star. Tasks that come up fewer than 20 times in 60 days
// (about 3 days a week) are too rare to become habits this way.

export const MASTERY_DAYS = 60;
export const MASTERY_SHARE = 0.85;
export const MASTERY_MIN = 20;
export const MASTERED_PAY = 0.5;

/** How many times a task comes up in 60 days on its current schedule. */
export function timesPerWindow(task) {
  const perWeek = (task.days || []).length / (isEveryOtherWeek(task) ? 2 : 1);
  return Math.round((perWeek * MASTERY_DAYS) / 7);
}

/** Times a task must be done within 60 days to be mastered, or 0 if it is too rare to become one. */
export function masteryGoal(task) {
  const n = timesPerWindow(task);
  return n >= MASTERY_MIN && !isExercise(task) ? Math.ceil(n * MASTERY_SHARE) : 0;
}

/**
 * Every quest task on the kid's setup that can become a habit:
 * Map taskId -> { task, done (times done toward the next star), goal, mastered (day of the first star, or null),
 *   stars: [day of each star] }.
 * Only done (parent-approved) days count. Today counts once it is done.
 */
export function habitInfo(state, kid, today) {
  return memoize(`habit|${kid.id}|${today}`, () => {
    const out = new Map();
    for (const t of questTasks(kid.tasks || [])) {
      const goal = masteryGoal(t);
      if (goal) out.set(t.id, { task: t, done: 0, goal, mastered: null, stars: [], days: [] });
    }
    if (!out.size) return out;
    const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
    for (let key = start; key <= today; key = addDays(key, 1)) {
      const entry = entryFor(state, kid.id, key);
      const oldest = addDays(key, -(MASTERY_DAYS - 1));
      for (const h of out.values()) {
        if (entry?.tasks?.[h.task.id]?.status === 'done') h.days.push(key);
        while (h.days.length && h.days[0] < oldest) h.days.shift();
        if (h.days.length >= h.goal) {
          // a star: the next one counts only days after this
          h.stars.push(key);
          h.mastered ||= key;
          h.days = [];
        }
      }
    }
    for (const h of out.values()) { h.done = h.days.length; delete h.days; }
    return out;
  });
}

/** Task ids mastered before a day (a Monday), so that week pays them less. */
export function masteredBefore(state, kid, day, today = day) {
  const half = new Set();
  for (const [id, h] of habitInfo(state, kid, today > day ? today : day)) if (h.mastered && h.mastered < day) half.add(id);
  return half;
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
    // the treasure chest's coins or gems (see treasure.js); chests give no XP
    if (field !== 'xp') sum += entry.chest?.[field] || 0;
  }
  if (field !== 'gems') sum += COMEBACK_BONUS * streakInfo(state, kid, today).comebacks.length;
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

/** Piano days in a row that earn a piano freeze (about two weeks of Mon–Fri). Only one is kept. */
export const PIANO_DAYS_PER_FREEZE = 10;

/**
 * The piano streak counts piano days done in a row (parent-approved, like the main streak).
 * Days without piano don't break it, an excused day keeps it, and today only adds once done.
 * Every 10 piano days in a row earn one piano freeze (only one is kept), which covers a
 * missed piano day. A miss with no freeze cuts the streak in half.
 */
export function pianoStreakInfo(state, kid, today) {
  let streak = 0;
  let best = 0;
  let run = 0;
  let freezes = 0;
  const start = kid.startDate && kid.startDate <= today ? kid.startDate : today;
  for (let key = start; key <= today; key = addDays(key, 1)) {
    const piano = tasksForDay(state, kid, key, today).filter(isPianoTask);
    if (!piano.length) continue;
    const entry = entryFor(state, kid.id, key);
    if (piano.every((t) => entry?.tasks?.[t.id]?.status === 'done')) {
      streak += 1;
      run += 1;
      if (run % PIANO_DAYS_PER_FREEZE === 0) freezes = 1;
    } else if (key === today || entry?.excused) {
      // in progress, or excused: keep the streak
    } else if (freezes > 0) {
      freezes = 0;
      run = 0;
    } else {
      streak = Math.floor(streak / 2);
      run = 0;
    }
    best = Math.max(best, streak);
  }
  return { streak, best, freezes, perWeek: pianoDaysPerWeek(kid) };
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

// ---------- games with visiting buddies ----------
export const GAMES_PER_DAY = 4;
/** The daily games before 2026-11-06 (PR #55), when play logs had no cap yet. */
export const OLD_GAMES_PER_DAY = 8;

/** Games a kid may play with visitors in a day: 4, plus 2 for each week of the current exercise streak (up to 3). */
export function gamesPerDay(exerciseWeeks = 0) {
  return GAMES_PER_DAY + 2 * Math.min(3, Math.max(0, Math.floor(exerciseWeeks)));
}

/**
 * Games left today. kid.playLog is { day, n, cap, prev }: games started on that
 * day, how many of that day's games ran out at bedtime (the daily games plus
 * games carried over from the day before), and the log of the day before.
 * extra: treasure chest games for today (today's chest plus carriedGames()).
 */
export function gamesLeft(kid, today, exerciseWeeks = 0, extra = 0) {
  const used = kid?.playLog?.day === today ? kid.playLog.n || 0 : 0;
  return Math.max(0, gamesPerDay(exerciseWeeks) + extra - used);
}

/**
 * Treasure chest games keep for one more day, since kids often open the chest
 * late. A day's games are used first, then games carried in from the day
 * before, then that day's chest games. This is what is left of yesterday's
 * chest games. fallbackCap: yesterday's daily games, for logs saved before cap.
 */
export function carriedGames(kid, today, chestYesterday = 0, fallbackCap = GAMES_PER_DAY) {
  if (!chestYesterday) return 0;
  const y = addDays(today, -1);
  const log = kid?.playLog?.day === y ? kid.playLog : kid?.playLog?.day === today && kid.playLog.prev?.day === y ? kid.playLog.prev : null;
  if (!log) return chestYesterday;
  const cap = Number.isFinite(log.cap) ? log.cap : fallbackCap;
  return Math.max(0, chestYesterday - Math.max(0, (log.n || 0) - cap));
}

/**
 * Games a kid may play before today's chores are done: only the chest games
 * carried over from yesterday (they were earned already, and run out tonight).
 * Every game played today counts against them first, so the total for the day
 * stays the same.
 */
export function earlyGames(kid, today, carried = 0) {
  const used = kid?.playLog?.day === today ? kid.playLog.n || 0 : 0;
  return Math.max(0, carried - used);
}

/** kid.playLog after one more game today. cap: today's games that run out at bedtime. */
export function logGame(kid, today, cap) {
  const log = kid?.playLog;
  if (log?.day === today) return { ...log, n: (log.n || 0) + 1, cap };
  const prev = log?.day ? { day: log.day, n: log.n || 0, ...(Number.isFinite(log.cap) ? { cap: log.cap } : {}) } : undefined;
  return { day: today, n: 1, cap, ...(prev ? { prev } : {}) };
}

// ---------- the kid's own plan ----------
//
// Kids pick the order of their tasks and a "cue" for each: the moment that
// reminds them ("After snack, I'll do piano practice"). Planning when and where
// is one of the best-studied ways to make a habit stick. kid.plan is
// { order: [taskId], cues: { taskId: cue }, week: Monday it was last planned }.

export const CUES = {
  morning: ['When I wake up', 'After I get dressed', 'After breakfast', 'Before I leave'],
  afternoon: ['When I get home', 'After snack', 'After homework', 'Before screens', 'After dinner', 'Before bed'],
};

/** The cue a kid picked for a task, if it is still one of the choices for its time of day. */
export function cueFor(kid, task) {
  const cue = kid.plan?.cues?.[task.id];
  return cue && (CUES[task.period] || []).includes(cue) ? cue : '';
}

/** Tasks in the kid's planned order. Tasks not in the plan keep their place after the planned ones. */
export function planOrder(kid, tasks) {
  const order = kid.plan?.order || [];
  const at = (t) => { const i = order.indexOf(t.id); return i < 0 ? order.length : i; };
  return tasks.map((t, i) => [t, i]).sort((a, b) => at(a[0]) - at(b[0]) || a[1] - b[1]).map(([t]) => t);
}

/** "After snack, I'll do piano practice." */
export function planSentence(cue, task) {
  return `${cue}, I'll ${/^(do|play|make|brush|clear|practice|feed|walk|read|take|put|empty|set|wash|fold|vacuum|dust|tidy|clean|pack|water|help|unload|load)\b/i.test(task.name) ? task.name.charAt(0).toLowerCase() + task.name.slice(1) : `do ${task.name.charAt(0).toLowerCase()}${task.name.slice(1)}`}.`;
}

// ---------- the family's day ----------
//
// When the whole family has done most of today's chores (85%), everyone's map
// has a little party. Each kid's device only loads its own days, so each kid
// carries a small summary of today (kid.today = { day, done, total }) that the
// other devices can read. done counts tasks done or waiting for a parent.

export const FAMILY_GOAL = 0.85;

/** Today's summary for a kid: { day, done, total }. An excused day has nothing to do. */
export function todaySummary(state, kid, today) {
  const s = dayStatus(state, kid, today, today);
  return { day: today, done: s.excused ? 0 : s.done + s.pending, total: s.excused ? 0 : s.total };
}

/**
 * How the family is doing today. kids: [{ id, today: summary }] (a kid with no summary for
 * today has done nothing yet, but how much they have to do is unknown, so they keep the goal
 * out of reach until their device has been opened today).
 */
export function familyDay(kids, today) {
  let done = 0;
  let total = 0;
  let unknown = 0;
  for (const k of kids) {
    const t = k.today;
    if (!t || t.day !== today) { unknown += 1; continue; }
    done += Math.min(t.done, t.total);
    total += t.total;
  }
  const share = total ? done / total : 0;
  return { done, total, unknown, share, happy: !unknown && total > 0 && share >= FAMILY_GOAL };
}

// ---------- last week, looked back on ----------

/**
 * How last week went, task by task, next to four weeks before it:
 * { from, days, daysDone, tasks: [{ task, done, of, before: { done, of } | null }] }.
 * Only tasks still on the kid's setup are listed. Excused days are left out.
 */
export function weekLookback(state, kid, today) {
  const from = addDays(weekStart(today), -7);
  const count = (monday) => {
    const per = new Map();
    let days = 0;
    let daysDone = 0;
    for (let i = 0; i < 7; i += 1) {
      const key = addDays(monday, i);
      if (kid.startDate && key < kid.startDate) continue;
      const s = dayStatus(state, kid, key, today);
      if (s.excused) continue;
      days += 1;
      if (s.complete) daysDone += 1;
      const entry = entryFor(state, kid.id, key);
      for (const t of s.tasks) {
        const p = per.get(t.id) || { done: 0, of: 0 };
        p.of += 1;
        if (entry?.tasks?.[t.id]?.status === 'done') p.done += 1;
        per.set(t.id, p);
      }
    }
    return { per, days, daysDone };
  };
  const last = count(from);
  const before = kid.startDate && kid.startDate > addDays(from, -28) ? null : count(addDays(from, -28));
  const tasks = questTasks(kid.tasks || []).filter((t) => last.per.has(t.id)).map((t) => {
    const b = before?.per.get(t.id);
    return { task: t, ...last.per.get(t.id), before: b ? { ...b } : null };
  });
  return { from, days: last.days, daysDone: last.daysDone, tasks };
}

// ---------- milestones the family can cheer ----------

/**
 * The kid's newest milestone from today or yesterday, or null:
 * a habit star, a whole week (or weeks) in a row, or a welcome-back day.
 * { id, kind: 'star' | 'streak' | 'back', day, n?, task? }. The id is the same on every device.
 */
export function milestoneFor(state, kid, today) {
  for (const day of [today, addDays(today, -1)]) {
    if (kid.startDate && day < kid.startDate) continue;
    for (const h of habitInfo(state, kid, today).values()) {
      const n = h.stars.indexOf(day) + 1;
      if (n) return { id: `star-${h.task.id}-${n}`, kind: 'star', day, task: h.task.name, n };
    }
    const info = streakInfo(state, kid, day);
    if (dayStatus(state, kid, day, today).complete && info.inARow > 0 && info.inARow % 7 === 0) {
      return { id: `streak-${day}`, kind: 'streak', day, n: info.inARow };
    }
    if (info.comebacks.includes(day)) return { id: `back-${day}`, kind: 'back', day };
  }
  return null;
}

/** True while a milestone is new enough to talk about (its day or the next). */
export const milestoneFresh = (m, today) => Boolean(m && m.day >= addDays(today, -1) && m.day <= today);
