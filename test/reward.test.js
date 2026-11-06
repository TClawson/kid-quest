import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays, entryFor, tasksForDay, newId, weeklyRewardInfo } from '../js/logic.js';

const MONDAY = '2026-11-02';
const FRIDAY = addDays(MONDAY, 4);
const SATURDAY = addDays(MONDAY, 5);

function setup(startDate = MONDAY) {
  const state = emptyState();
  const kid = { id: newId('kid'), name: 'Test', tasks: defaultTasks(), startDate };
  state.kids.push(kid);
  return { state, kid };
}
function finishDay(state, kid, key, today, status = 'done') {
  const entry = entryFor(state, kid.id, key, true);
  for (const t of tasksForDay(state, kid, key, today)) entry.tasks[t.id] = { status };
}
function finishWeek(state, kid, today, days = 5) {
  for (let i = 0; i < days; i += 1) finishDay(state, kid, addDays(MONDAY, i), today);
}

test('weekly reward lands on Friday once Monday to Friday are all done', () => {
  const { state, kid } = setup();
  finishWeek(state, kid, FRIDAY, 4);
  let r = weeklyRewardInfo(state, kid, FRIDAY);
  assert.equal(r.earned, false);
  assert.equal(r.lost, false);
  assert.equal(r.days[4].state, 'today');
  finishDay(state, kid, FRIDAY, FRIDAY);
  r = weeklyRewardInfo(state, kid, FRIDAY);
  assert.equal(r.earned, true);
  // still earned over the weekend, whatever the weekend chores
  assert.equal(weeklyRewardInfo(state, kid, addDays(MONDAY, 6)).earned, true);
  // and a new week starts over
  assert.equal(weeklyRewardInfo(state, kid, addDays(MONDAY, 7)).earned, false);
});

test('not before Friday even with every day so far done', () => {
  const { state, kid } = setup();
  finishWeek(state, kid, addDays(MONDAY, 3), 4);
  assert.equal(weeklyRewardInfo(state, kid, addDays(MONDAY, 3)).earned, false);
});

test('a missed day loses the week, an excused day does not', () => {
  const { state, kid } = setup();
  finishWeek(state, kid, SATURDAY);
  entryFor(state, kid.id, addDays(MONDAY, 2), true).tasks = {};
  let r = weeklyRewardInfo(state, kid, SATURDAY);
  assert.equal(r.earned, false);
  assert.equal(r.lost, true);
  entryFor(state, kid.id, addDays(MONDAY, 2)).excused = true;
  r = weeklyRewardInfo(state, kid, SATURDAY);
  assert.equal(r.earned, true);
});

test('chores waiting for a parent do not count until approved, even late', () => {
  const { state, kid } = setup();
  finishWeek(state, kid, FRIDAY);
  finishDay(state, kid, addDays(MONDAY, 3), FRIDAY, 'pending');
  assert.equal(weeklyRewardInfo(state, kid, SATURDAY).earned, false);
  finishDay(state, kid, addDays(MONDAY, 3), SATURDAY);
  assert.equal(weeklyRewardInfo(state, kid, SATURDAY).earned, true);
});

test('a kid who starts midweek can earn it; a fully excused week does not', () => {
  const late = setup(addDays(MONDAY, 2));
  for (let i = 2; i < 5; i += 1) finishDay(late.state, late.kid, addDays(MONDAY, i), FRIDAY);
  assert.equal(weeklyRewardInfo(late.state, late.kid, FRIDAY).earned, true);
  const { state, kid } = setup();
  for (let i = 0; i < 5; i += 1) entryFor(state, kid.id, addDays(MONDAY, i), true).excused = true;
  assert.equal(weeklyRewardInfo(state, kid, SATURDAY).earned, false);
});
