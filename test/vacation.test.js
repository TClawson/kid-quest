import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, defaultTasks, addDays, entryFor, tasksForDay, newId, dayStatus, streakInfo,
  storeOpen, exerciseStreakInfo, missedEvening, weeklyRewardInfo, kidToday,
  isVacation, excusedOn, toggleVacationDay, switchVacation, upcomingVacation,
} from '../js/logic.js';
import { floorDays } from '../js/houserules.js';

const MONDAY = '2026-11-02';

function setup() {
  const state = emptyState();
  const kids = [0, 1].map((i) => ({ id: newId('kid'), name: `Kid ${i}`, tasks: defaultTasks(), startDate: MONDAY }));
  state.kids.push(...kids);
  return { state, kids };
}
const finish = (state, kid, key) => {
  const entry = entryFor(state, kid.id, key, true);
  for (const t of tasksForDay(state, kid, key, key)) entry.tasks[t.id] = { status: 'done' };
};

test('the switch picks today, tapping adds and removes days, past days are fixed', () => {
  const t = addDays(MONDAY, 3);
  let v = switchVacation(undefined, true, t);
  assert.deepEqual(v, { on: true, days: { [t]: true } });
  v = toggleVacationDay(v, addDays(t, 1), t);
  v = toggleVacationDay(v, addDays(t, 2), t);
  assert.deepEqual(Object.keys(v.days).sort(), [t, addDays(t, 1), addDays(t, 2)]);
  v = toggleVacationDay(v, addDays(t, 1), t);
  assert.ok(!v.days[addDays(t, 1)]);
  // a day already past can't be added or taken away
  assert.deepEqual(toggleVacationDay(v, addDays(t, -1), t).days, v.days);
  // a day later on, switching off keeps the past days and drops today and later
  const later = addDays(t, 2);
  const off = switchVacation(v, false, later);
  assert.deepEqual(off, { on: false, days: { [t]: true } });
  assert.deepEqual(upcomingVacation({ settings: { vacation: v } }, t), [t, addDays(t, 2)]);
});

test('a vacation day is excused for every kid and keeps the streak', () => {
  const { state, kids } = setup();
  for (let i = 0; i < 3; i += 1) kids.forEach((k) => finish(state, k, addDays(MONDAY, i)));
  const vac = addDays(MONDAY, 3);
  state.settings.vacation = { on: true, days: { [vac]: true } };
  const t = addDays(MONDAY, 4);
  for (const k of kids) {
    assert.ok(isVacation(state, vac));
    assert.ok(excusedOn(state, k.id, vac));
    const s = dayStatus(state, k, vac, t);
    assert.ok(s.excused && s.vacation && !s.complete);
    finish(state, k, t);
    assert.equal(streakInfo(state, k, t).streak, 4);
    assert.equal(streakInfo(state, k, t).frozen.length, 0);
  }
  // without the vacation day it would have been a miss
  delete state.settings.vacation;
  assert.ok(streakInfo(state, kids[0], t).streak < 4 || streakInfo(state, kids[0], t).frozen.length > 0);
});

test('the shop opens on a vacation day before any chore', () => {
  const { state, kids } = setup();
  const t = addDays(MONDAY, 1);
  assert.equal(storeOpen(state, kids[0], t).open, false);
  state.settings.vacation = { on: true, days: { [t]: true } };
  assert.equal(storeOpen(state, kids[0], t).open, true);
  assert.equal(kidToday(state, kids[0], t).vacation, true);
});

test('vacation days count neither for nor against strong weeks', () => {
  const { state, kids } = setup();
  const kid = kids[0];
  kid.tasks.push({ id: 'ex', name: 'Run', icon: '🏃', period: 'exercise', days: [0, 1, 2, 3, 4, 5, 6] });
  const exOn = (key) => { entryFor(state, kid.id, key, true).tasks.ex = { status: 'done' }; };
  // 2 exercise days and 3 vacation days: the week's goal drops from 4 to 1, so it's a strong week
  exOn(MONDAY); exOn(addDays(MONDAY, 1));
  const end = addDays(MONDAY, 7);
  assert.equal(exerciseStreakInfo(state, kid, end).weeks, 0);
  state.settings.vacation = { on: true, days: { [addDays(MONDAY, 4)]: true, [addDays(MONDAY, 5)]: true, [addDays(MONDAY, 6)]: true } };
  assert.equal(exerciseStreakInfo(state, kid, end).weeks, 1);
});

test('a missed evening chore on a vacation day does not lock the shop next day', () => {
  const { state, kids } = setup();
  const kid = kids[0];
  kid.tasks.push({ id: 'sh', name: 'Shower', icon: '🚿', period: 'evening', evening: true, days: [0, 1, 2, 3, 4, 5, 6] });
  const y = addDays(MONDAY, 1);
  const t = addDays(MONDAY, 2);
  assert.equal(missedEvening(state, kid, t).length, 1);
  state.settings.vacation = { on: true, days: { [y]: true } };
  assert.equal(missedEvening(state, kid, t).length, 0);
});

test('the floor stays tidy through vacation days', () => {
  const { state, kids } = setup();
  const kid = kids[0];
  const floor = kid.tasks.find((t) => /floor/i.test(t.name));
  floor.house = 'floor';
  const t = addDays(MONDAY, 3);
  const before = floorDays(state, kid, t);
  state.settings.vacation = { on: true, days: { [addDays(t, -1)]: true, [addDays(t, -2)]: true } };
  assert.ok(floorDays(state, kid, t) < before);
});

test('vacation days in the week are excused for the Friday reward', () => {
  const { state, kids } = setup();
  const kid = kids[0];
  const fri = addDays(MONDAY, 4);
  for (let i = 0; i < 3; i += 1) finish(state, kid, addDays(MONDAY, i));
  state.settings.vacation = { on: true, days: { [addDays(MONDAY, 3)]: true, [fri]: true } };
  const info = weeklyRewardInfo(state, kid, fri);
  assert.ok(info.days.filter((d) => d.state === 'excused').length >= 1);
});
