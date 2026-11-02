import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, defaultTasks, addDays, dayOfWeek, entryFor, tasksForDay, snapshotToday,
  dayStatus, streakInfo, totalXp, pendingApprovals, newId,
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
