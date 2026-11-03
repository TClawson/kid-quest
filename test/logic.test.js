import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, defaultTasks, addDays, dayOfWeek, entryFor, tasksForDay, snapshotToday,
  dayStatus, streakInfo, totalXp, pendingApprovals, newId,
  isExercise, taskGems, taskCoins, totalGems, exerciseStreakInfo, weekStart,
} from '../js/logic.js';

const MONDAY = '2026-11-02';

function setup(startDate = MONDAY) {
  const state = emptyState();
  const kid = { id: newId('kid'), name: 'Test', tasks: defaultTasks(), startDate };
  state.kids.push(kid);
  return { state, kid };
}

function finishDay(state, kid, key, today) {
  const entry = entryFor(state, kid.id, key, true);
  for (const t of tasksForDay(state, kid, key, today)) entry.tasks[t.id] = { status: 'done' };
}

test('schedule follows weekdays, Friday deep clean and Saturday laundry', () => {
  const { state, kid } = setup();
  assert.equal(dayOfWeek(MONDAY), 1);
  const names = (key) => tasksForDay(state, kid, key, key).map((t) => t.name);
  assert.deepEqual(names(MONDAY), ['Brush teeth', 'Make bed', 'Clear bedroom floor', 'Piano practice', 'Chore of the week']);
  const fri = names(addDays(MONDAY, 4));
  assert.ok(fri.includes('Chore of the week: deep clean'));
  assert.ok(fri.includes('Vacuum your room') && fri.includes('Dust your room'));
  assert.ok(!fri.includes('Chore of the week'));
  assert.deepEqual(names(addDays(MONDAY, 5)), ['Brush teeth', 'Make bed', 'Clear bedroom floor', 'Laundry']);
  assert.deepEqual(names(addDays(MONDAY, 6)), ['Brush teeth', 'Make bed', 'Clear bedroom floor']);
});

test('streak counts complete days and today in progress does not break it', () => {
  const { state, kid } = setup();
  const today = addDays(MONDAY, 2);
  finishDay(state, kid, MONDAY, today);
  finishDay(state, kid, addDays(MONDAY, 1), today);
  let info = streakInfo(state, kid, today);
  assert.equal(info.streak, 2);
  assert.equal(info.todayComplete, false);
  finishDay(state, kid, today, today);
  info = streakInfo(state, kid, today);
  assert.equal(info.streak, 3);
});

test('missed day resets streak, excused day keeps it, pending does not count', () => {
  const { state, kid } = setup();
  const today = addDays(MONDAY, 3);
  finishDay(state, kid, MONDAY, today);
  entryFor(state, kid.id, addDays(MONDAY, 1), true).excused = true;
  finishDay(state, kid, addDays(MONDAY, 2), today);
  assert.equal(streakInfo(state, kid, today).streak, 2);

  const { state: s2, kid: k2 } = setup();
  finishDay(s2, k2, MONDAY, today);
  // day 2 missed
  finishDay(s2, k2, addDays(MONDAY, 2), today);
  assert.equal(streakInfo(s2, k2, today).streak, 1);

  // mark one task pending on the missed day: still missed until approved
  const tue = addDays(MONDAY, 1);
  const tasks = tasksForDay(s2, k2, tue, today);
  finishDay(s2, k2, tue, today);
  entryFor(s2, k2.id, tue).tasks[tasks[3].id] = { status: 'pending' };
  assert.equal(streakInfo(s2, k2, today).streak, 1);
  // late approval repairs the streak
  entryFor(s2, k2.id, tue).tasks[tasks[3].id] = { status: 'done' };
  assert.equal(streakInfo(s2, k2, today).streak, 3);
});

test('seven perfect days earn a freeze that saves a missed day', () => {
  const { state, kid } = setup();
  const today = addDays(MONDAY, 9);
  for (let i = 0; i < 7; i += 1) finishDay(state, kid, addDays(MONDAY, i), today);
  // day 8 missed, day 9 complete
  finishDay(state, kid, addDays(MONDAY, 8), today);
  const info = streakInfo(state, kid, today);
  assert.deepEqual(info.frozen, [addDays(MONDAY, 7)]);
  assert.equal(info.freezes, 0);
  assert.equal(info.streak, 8);
});

test('past days keep their snapshot when the setup changes', () => {
  const { state, kid } = setup();
  snapshotToday(state, kid, MONDAY);
  finishDay(state, kid, MONDAY, MONDAY);
  kid.tasks.push({ id: 'new', name: 'New task', icon: '⭐', period: 'morning', days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0 });
  const tomorrow = addDays(MONDAY, 1);
  assert.equal(dayStatus(state, kid, MONDAY, tomorrow).complete, true);
  assert.ok(tasksForDay(state, kid, tomorrow, tomorrow).some((t) => t.id === 'new'));
});

test('xp and pending approvals', () => {
  const { state, kid } = setup();
  const tasks = tasksForDay(state, kid, MONDAY, MONDAY);
  const entry = entryFor(state, kid.id, MONDAY, true);
  entry.tasks[tasks[0].id] = { status: 'done' };
  entry.tasks[tasks[3].id] = { status: 'done' }; // piano, 30 xp
  entry.tasks[tasks[4].id] = { status: 'pending' };
  assert.equal(totalXp(state, kid, MONDAY), 40);
  const pending = pendingApprovals(state, MONDAY);
  assert.equal(pending.length, 1);
  assert.equal(pending[0].task.name, 'Chore of the week');
});

test('piano streak skips non-piano days, keeps excused days, resets on a miss', async () => {
  const L = await import('../js/logic.js');
  const s = L.emptyState();
  const kid = { id: 'k', name: 'A', tasks: L.defaultTasks(), startDate: '2026-10-05' }; // a Monday
  s.kids.push(kid);
  const piano = kid.tasks.find(L.isPianoTask);
  const done = (k) => { s.log[k] = { k: { tasks: { [piano.id]: { status: 'done' } }, excused: false } }; };
  // two full weeks Mon-Fri: 10 piano days, weekends in between don't break it
  for (let k = '2026-10-05'; k <= '2026-10-16'; k = L.addDays(k, 1)) if (piano.days.includes(L.dayOfWeek(k))) done(k);
  let info = L.pianoStreakInfo(s, kid, '2026-10-18');
  assert.equal(info.streak, 10);
  assert.equal(info.perWeek, 5);
  // Monday excused, Tuesday done: 11
  s.log['2026-10-19'] = { k: { tasks: {}, excused: true } };
  done('2026-10-20');
  assert.equal(L.pianoStreakInfo(s, kid, '2026-10-20').streak, 11);
  // Wednesday missed: reset, best stays
  info = L.pianoStreakInfo(s, kid, '2026-10-22');
  assert.equal(info.streak, 0);
  assert.equal(info.best, 11);
  // today not done yet doesn't break it
  assert.equal(L.pianoStreakInfo(s, kid, '2026-10-20').streak, 11);
});

test('task rewards: defaults, parent amounts, and past days keep what they earned', async () => {
  const { taskXp, taskCoins, totalCoins, parseReward } = await import('../js/logic.js');
  const { state, kid } = setup();
  const teeth = kid.tasks.find((t) => t.name === 'Brush teeth');
  const piano = kid.tasks.find((t) => t.name === 'Piano practice');
  assert.equal(taskXp(teeth), 10);
  assert.equal(taskCoins(teeth), 10);
  assert.equal(taskXp(piano), 30);
  assert.equal(taskCoins(piano), 30);

  // Monday: earn with the defaults, and snapshot the day like the app does.
  snapshotToday(state, kid, MONDAY);
  finishDay(state, kid, MONDAY, MONDAY);
  const mondayXp = totalXp(state, kid, MONDAY);
  assert.equal(mondayXp, 70);
  assert.equal(totalCoins(state, kid, MONDAY), 70);

  // Tuesday: a parent makes teeth worth 2 coins and 25 XP, and piano 0 coins.
  teeth.coins = 2;
  teeth.xp = 25;
  piano.coins = 0;
  const tue = addDays(MONDAY, 1);
  assert.equal(taskCoins(teeth), 2);
  assert.equal(taskXp(teeth), 25);
  assert.equal(taskCoins(piano), 0);
  assert.equal(taskXp(piano), 30, 'XP stays at the default when only coins change');
  // Monday's earnings are unchanged.
  assert.equal(totalXp(state, kid, tue), 70);
  assert.equal(totalCoins(state, kid, tue), 70);
  finishDay(state, kid, tue, tue);
  // teeth 25 + bed 10 + floor 10 + piano 30 + chore 10 XP; coins 2 + 10 + 10 + 0 + 10
  assert.equal(totalXp(state, kid, tue), 70 + 85);
  assert.equal(totalCoins(state, kid, tue), 70 + 32);

  assert.equal(parseReward(''), null);
  assert.equal(parseReward('abc'), null);
  assert.equal(parseReward('-5'), 0);
  assert.equal(parseReward('12.6'), 13);
  assert.equal(parseReward('99999'), 500);
});

// ---------- exercise: optional, earns gems, weekly streak ----------

function exerciseKid(start) {
  const tasks = defaultTasks();
  const run = { id: 'task_run', name: 'Run', icon: '🏃', period: 'exercise', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 };
  return { id: 'kid_ex', name: 'Ex', tasks: [...tasks, run], startDate: start };
}
const doneOn = (state, kid, key, ids) => {
  state.log[key] = state.log[key] || {};
  state.log[key][kid.id] = { tasks: Object.fromEntries(ids.map((id) => [id, { status: 'done' }])), excused: false };
};

test('exercise tasks are bonus: they never block the day and earn gems, not coins', () => {
  const state = emptyState();
  const kid = exerciseKid('2026-11-02');
  state.kids.push(kid);
  const quest = kid.tasks.filter((t) => !isExercise(t) && t.days.includes(1)).map((t) => t.id);
  doneOn(state, kid, '2026-11-02', quest);
  const s = dayStatus(state, kid, '2026-11-02', '2026-11-02');
  assert.equal(s.complete, true);
  assert.equal(s.tasks.some(isExercise), false);
  const run = kid.tasks.find(isExercise);
  assert.equal(taskGems(run), 10);
  assert.equal(taskCoins(run), 0);
  assert.equal(taskGems(kid.tasks[0]), 0);
  assert.equal(taskGems({ ...run, gems: 25 }), 25);
  doneOn(state, kid, '2026-11-02', [...quest, run.id]);
  assert.equal(totalGems(state, kid, '2026-11-02'), 10);
});

test('the exercise streak counts weeks with 5 exercise days, and keeps the best', () => {
  const state = emptyState();
  const kid = exerciseKid('2026-10-05'); // a Monday
  state.kids.push(kid);
  assert.equal(weekStart('2026-10-11'), '2026-10-05');
  const exDays = (monday, n) => { for (let i = 0; i < n; i += 1) doneOn(state, kid, addDays(monday, i), ['task_run']); };
  exDays('2026-10-05', 5);
  exDays('2026-10-12', 6);
  exDays('2026-10-19', 5);
  let info = exerciseStreakInfo(state, kid, '2026-10-25');
  assert.equal(info.weeks, 3);
  assert.equal(info.best, 3);
  // this week only has 2 so far: the streak holds until the week is over
  exDays('2026-10-26', 2);
  info = exerciseStreakInfo(state, kid, '2026-10-28');
  assert.equal(info.weeks, 3);
  assert.equal(info.thisWeek, 2);
  // the week ended with 4: the streak starts over, the best stays
  doneOn(state, kid, '2026-10-30', ['task_run']);
  info = exerciseStreakInfo(state, kid, '2026-11-03');
  assert.equal(info.weeks, 0);
  assert.equal(info.best, 3);
  // an excused day lowers the week's goal: 4 exercise days + 1 sick day counts
  exDays('2026-11-02', 4);
  state.log['2026-11-06'] = { kid_ex: { tasks: {}, excused: true } };
  info = exerciseStreakInfo(state, kid, '2026-11-08');
  assert.equal(info.weeks, 1);
  assert.equal(info.goal, 4);
  // a week excused (5+ days) keeps the streak without adding to it, even when excused later
  for (let i = 0; i < 7; i += 1) state.log[addDays('2026-11-09', i)] = { kid_ex: { tasks: {}, excused: true } };
  exDays('2026-11-16', 5);
  info = exerciseStreakInfo(state, kid, '2026-11-22');
  assert.equal(info.weeks, 2);
  // excusing past days later fixes an old week that fell short (3 exercise days + 2 sick days)
  for (const key of ['2026-10-28', '2026-10-29']) state.log[key] = { kid_ex: { tasks: {}, excused: true } };
  info = exerciseStreakInfo(state, kid, '2026-11-22');
  assert.equal(info.weeks, 6); // 3 weeks, the fixed week, the sick-day week, a skipped week, then one more
  assert.equal(info.best, 6);
});

// ---------- weekly allowance and parent bonus ----------

test('the weekly allowance is split by size, and a perfect week earns exactly the allowance', async () => {
  const { defaultAllowance, weekEarnings, taskPay, taskSize, totalCoins, totalXp } = await import('../js/logic.js');
  const { state, kid } = setup();
  state.settings.allowance = { ...defaultAllowance(MONDAY), coins: 300, xp: 200 };
  const piano = kid.tasks.find((t) => t.name === 'Piano practice');
  const teeth = kid.tasks.find((t) => t.name === 'Brush teeth');
  assert.equal(taskSize(piano), 3, 'timer tasks are big');
  assert.equal(taskSize(teeth), 1);
  assert.equal(taskSize(kid.tasks.find((t) => t.name === 'Laundry')), 2, 'parent-checked tasks are medium');
  const sunday = addDays(MONDAY, 6);
  for (let i = 0; i < 7; i += 1) {
    const key = addDays(MONDAY, i);
    snapshotToday(state, kid, key);
    finishDay(state, kid, key, key);
  }
  const week = weekEarnings(state, kid, sunday);
  assert.equal(week.coins, 300);
  assert.equal(week.xp, 200);
  assert.equal(totalCoins(state, kid, sunday), 300);
  assert.equal(totalXp(state, kid, sunday), 200);
  // piano is worth about 3 times brushing teeth
  const p = taskPay(state, kid, MONDAY, piano, MONDAY).coins;
  const b = taskPay(state, kid, MONDAY, teeth, MONDAY).coins;
  assert.ok(Math.abs(p - 3 * b) <= 2, `${p} vs ${b}`);
});

test('kids with more chores earn the same for a perfect week, a missed chore loses its share', async () => {
  const { defaultAllowance, weekEarnings } = await import('../js/logic.js');
  const { state, kid } = setup();
  const busy = { id: 'kid_busy', name: 'Busy', tasks: [...defaultTasks(), { id: 'task_dish', name: 'Dishes', icon: '🍽️', period: 'afternoon', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 }], startDate: MONDAY };
  state.kids.push(busy);
  state.settings.allowance = defaultAllowance(MONDAY);
  const sunday = addDays(MONDAY, 6);
  for (let i = 0; i < 7; i += 1) { finishDay(state, kid, addDays(MONDAY, i), sunday); finishDay(state, busy, addDays(MONDAY, i), sunday); }
  assert.equal(weekEarnings(state, kid, sunday).coins, 300);
  assert.equal(weekEarnings(state, busy, sunday).coins, 300);
  // skip Monday's piano: lose its share only
  delete state.log[MONDAY][kid.id].tasks[kid.tasks.find((t) => t.name === 'Piano practice').id];
  const c = weekEarnings(state, kid, sunday).coins;
  assert.ok(c < 300 && c > 270, String(c));
  // a kid's own amount overrides the family's
  busy.allowance = { coins: 100 };
  assert.equal(weekEarnings(state, busy, sunday).coins, 100);
  assert.equal(weekEarnings(state, busy, sunday).xp, 300);
});

test('days before the allowance started, and past snapshots, keep what they earned', async () => {
  const { defaultAllowance, totalCoins } = await import('../js/logic.js');
  const { state, kid } = setup();
  // Monday: typed amounts (no allowance yet), 70 coins
  snapshotToday(state, kid, MONDAY);
  finishDay(state, kid, MONDAY, MONDAY);
  const tue = addDays(MONDAY, 1);
  state.settings.allowance = defaultAllowance(tue);
  assert.equal(totalCoins(state, kid, tue), 70, 'Monday unchanged');
  snapshotToday(state, kid, tue);
  finishDay(state, kid, tue, tue);
  const tueCoins = totalCoins(state, kid, tue) - 70;
  assert.ok(tueCoins > 0);
  // Wednesday: allowance doubles and teeth become big; Tuesday stays as it was
  const wed = addDays(MONDAY, 2);
  state.settings.allowance.coins = 600;
  kid.tasks.find((t) => t.name === 'Brush teeth').size = 3;
  assert.equal(totalCoins(state, kid, wed), 70 + tueCoins);
  // turning it off goes back to typed amounts from then on
  state.settings.allowance.on = false;
  finishDay(state, kid, wed, wed);
  assert.equal(totalCoins(state, kid, wed), 70 + tueCoins + 70);
});

test('parent bonuses add coins and XP and count against the weekly bonus limit', async () => {
  const { defaultAllowance, weekEarnings, totalCoins, totalXp, recentBonuses } = await import('../js/logic.js');
  const { state, kid } = setup();
  state.settings.allowance = defaultAllowance(MONDAY);
  const tue = addDays(MONDAY, 1);
  entryFor(state, kid.id, MONDAY, true).bonus = { b1: { coins: 20, reason: 'Helped with groceries', by: 'Mom', at: 1 } };
  entryFor(state, kid.id, tue, true).bonus = { b2: { coins: 10, reason: 'Kind to a sibling', by: 'Dad', at: 2 } };
  const w = weekEarnings(state, kid, tue);
  assert.equal(w.bonus, 30);
  assert.equal(w.bonusLeft, 20);
  assert.equal(totalCoins(state, kid, tue), 30);
  assert.equal(totalXp(state, kid, tue), 30);
  assert.deepEqual(recentBonuses(state, kid, tue).map((b) => b.by), ['Dad', 'Mom']);
  // next week starts fresh
  assert.equal(weekEarnings(state, kid, addDays(MONDAY, 7)).bonusLeft, 50);
});

test('an every-other-week chore is part of the split only on its weeks', async () => {
  const { defaultAllowance, weekEarnings, weekParity } = await import('../js/logic.js');
  const { state, kid } = setup();
  state.settings.allowance = defaultAllowance(MONDAY);
  kid.tasks.push({ id: 'task_bath', name: 'Bathroom', icon: '🛁', period: 'afternoon', days: [6], verify: 'parent', minutes: 0, everyOtherWeek: weekParity(MONDAY) });
  for (const monday of [MONDAY, addDays(MONDAY, 7)]) {
    const sunday = addDays(monday, 6);
    for (let i = 0; i < 7; i += 1) finishDay(state, kid, addDays(monday, i), sunday);
    assert.equal(weekEarnings(state, kid, sunday).coins, 300);
  }
});

test('every-other-week tasks alternate Monday-to-Sunday weeks the same way on every device', async () => {
  const { weekNumber, weekParity, onWeek } = await import('../js/logic.js');
  assert.equal(weekNumber('2024-01-01'), 0);
  assert.equal(weekNumber('2024-01-07'), 0); // Sunday ends the week
  assert.equal(weekNumber('2024-01-08'), 1);
  // the whole week shares one parity, and the next week flips it
  for (let i = 0; i < 7; i += 1) assert.equal(weekParity(addDays(MONDAY, i)), weekParity(MONDAY));
  assert.notEqual(weekParity(addDays(MONDAY, 7)), weekParity(MONDAY));
  // across a daylight-saving change (US clocks went back on 2026-11-01) and a year end
  assert.equal(weekNumber('2026-11-02') - weekNumber('2026-10-26'), 1);
  assert.equal(weekNumber('2027-01-04') - weekNumber('2026-12-28'), 1);
  const task = { days: [1], everyOtherWeek: weekParity(MONDAY) };
  assert.ok(onWeek(task, MONDAY) && !onWeek(task, addDays(MONDAY, 7)) && onWeek(task, addDays(MONDAY, 14)));
  assert.ok(onWeek({ days: [1] }, addDays(MONDAY, 7)));
});

test('two kids take turns on a chore, and off weeks never hurt the streak', () => {
  const a = setup();
  const state = a.state;
  const kidA = a.kid;
  const kidB = { id: newId('kid'), name: 'B', tasks: defaultTasks(), startDate: MONDAY };
  state.kids.push(kidB);
  const parity = (key) => (Math.round((Date.parse(weekStart(key)) - Date.parse('2024-01-01')) / 6048e5) % 2 + 2) % 2;
  const p = parity(MONDAY);
  kidA.tasks.push({ id: newId('task'), name: 'Bathroom', icon: '🛁', period: 'afternoon', days: [6], verify: 'parent', minutes: 0, everyOtherWeek: p });
  kidB.tasks.push({ id: newId('task'), name: 'Bathroom', icon: '🛁', period: 'afternoon', days: [6], verify: 'parent', minutes: 0, everyOtherWeek: 1 - p });
  const has = (kid, key) => tasksForDay(state, kid, key, key).some((t) => t.name === 'Bathroom');
  const sat1 = addDays(MONDAY, 5);
  const sat2 = addDays(MONDAY, 12);
  assert.ok(has(kidA, sat1) && !has(kidB, sat1));
  assert.ok(!has(kidA, sat2) && has(kidB, sat2));
  // B finishes every day it has: the first Saturday (A's turn) doesn't break B's streak
  const end = addDays(MONDAY, 13);
  for (let key = MONDAY; key <= end; key = addDays(key, 1)) finishDay(state, kidB, key, end);
  assert.equal(streakInfo(state, kidB, end).streak, 14);
  assert.equal(dayStatus(state, kidB, sat1, end).complete, true);
});

test('repair: an allowance stamped on a day that already had chores done gives that day its typed coins back', async () => {
  const { defaultAllowance, totalCoins, totalXp, repairAllowanceStart } = await import('../js/logic.js');
  const { state, kid } = setup();
  const sunday = addDays(MONDAY, -1);
  // Sunday and Monday ticked on the old version: snapshots without pay, typed amounts
  for (const key of [sunday, MONDAY]) {
    entryFor(state, kid.id, key, true).scheduled = tasksForDay(state, kid, key, key).map((t) => ({ ...t }));
    finishDay(state, kid, key, key);
  }
  const tue = addDays(MONDAY, 1);
  const before = totalCoins(state, kid, tue);
  const beforeXp = totalXp(state, kid, tue);
  assert.ok(before > 0);
  // Monday evening the new version stamps the allowance from Monday, and a
  // parent opening the kid's screen saves Monday's allowance amounts
  state.settings.allowance = defaultAllowance(MONDAY);
  snapshotToday(state, kid, MONDAY);
  assert.ok(totalCoins(state, kid, tue) < before, 'the bug: Monday was paid again from the allowance');
  assert.equal(repairAllowanceStart(state), true);
  assert.equal(state.settings.allowance.since, tue);
  assert.equal(totalCoins(state, kid, tue), before);
  assert.equal(totalXp(state, kid, tue), beforeXp);
  // runs once only
  assert.equal(repairAllowanceStart(state), false);
  assert.equal(state.settings.allowance.since, tue);
});
