// The parents' Today view: each kid's day at a glance, and undoing a tick or approval.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyState, defaultTasks, addDays, entryFor, tasksForDay, kidToday, applyTaskChange, undoTaskChanges,
  totalCoins, totalXp, dayStatus, pendingApprovals,
} from '../js/logic.js';

const THURSDAY = '2026-11-12';

function setup() {
  const state = emptyState();
  const kid = { id: 'kid_a', name: 'Ayden', tasks: defaultTasks(), startDate: '2026-11-02' };
  kid.tasks.push({ id: 'task_run', name: 'Soccer practice', icon: '⚽', period: 'exercise', days: [0, 1, 2, 3, 4, 5, 6], verify: 'parent', minutes: 0 });
  state.kids.push(kid);
  return { state, kid };
}

const quest = (state, kid, key) => tasksForDay(state, kid, key, THURSDAY).filter((t) => t.period !== 'exercise');

test('kidToday counts done, waiting and to go, with a segment per chore', () => {
  const { state, kid } = setup();
  const [teeth, bed, floor, piano] = quest(state, kid, THURSDAY);
  const e = entryFor(state, kid.id, THURSDAY, true);
  e.tasks[teeth.id] = { status: 'done' };
  e.tasks[bed.id] = { status: 'done' };
  e.tasks[piano.id] = { status: 'pending', seconds: 1800 };
  e.tasks[floor.id] = { seconds: 0 };
  const d = kidToday(state, kid, THURSDAY);
  assert.equal(d.total, 5);
  assert.equal(d.done, 2);
  assert.equal(d.waitingToday, 1);
  assert.equal(d.toGo, 2);
  assert.deepEqual(d.segments, ['done', 'done', 'todo', 'waiting', 'todo']);
  assert.equal(d.complete, false);
  assert.deepEqual(d.waiting.map((w) => w.task.id), [piano.id]);
  assert.equal(d.waiting[0].record.seconds, 1800);
  // bonus exercise is in the tick list, but not in the bar or the counts
  assert.deepEqual(d.todo.map((x) => x.task.id), [floor.id, quest(state, kid, THURSDAY)[4].id, 'task_run']);
  assert.deepEqual(d.doneTasks.map((x) => x.task.id), [teeth.id, bed.id]);
});

test('kidToday lists chores still waiting from earlier days after today\'s, and matches pendingApprovals', () => {
  const { state, kid } = setup();
  const y = addDays(THURSDAY, -1);
  const old = addDays(THURSDAY, -3);
  const [, , , piano] = quest(state, kid, THURSDAY);
  entryFor(state, kid.id, old, true).tasks[piano.id] = { status: 'pending' };
  entryFor(state, kid.id, y, true).tasks[piano.id] = { status: 'pending' };
  entryFor(state, kid.id, THURSDAY, true).tasks[piano.id] = { status: 'pending' };
  const d = kidToday(state, kid, THURSDAY);
  assert.deepEqual(d.waiting.map((w) => w.key), [THURSDAY, y, old]);
  assert.equal(d.waitingToday, 1);
  assert.deepEqual(d.waiting.map((w) => w.key), pendingApprovals(state, THURSDAY).map((p) => p.key));
});

test('kidToday: all done, excused and a day with no chores', () => {
  const { state, kid } = setup();
  const e = entryFor(state, kid.id, THURSDAY, true);
  for (const t of quest(state, kid, THURSDAY)) e.tasks[t.id] = { status: 'done' };
  let d = kidToday(state, kid, THURSDAY);
  assert.equal(d.complete, true);
  assert.equal(d.toGo, 0);
  assert.ok(d.segments.every((s) => s === 'done'));
  assert.deepEqual(d.todo.map((x) => x.task.id), ['task_run']);
  e.excused = true;
  d = kidToday(state, kid, THURSDAY);
  assert.equal(d.excused, true);
  kid.tasks = [];
  d = kidToday(state, kid, THURSDAY);
  assert.equal(d.total, 0);
  assert.deepEqual(d.segments, []);
});

test('approving and undoing puts back the status, coins and XP exactly', () => {
  const { state, kid } = setup();
  const [, , , piano] = quest(state, kid, THURSDAY);
  const e = entryFor(state, kid.id, THURSDAY, true);
  e.tasks[piano.id] = { status: 'pending', at: 111, seconds: 1800, away: 420 };
  const coins = totalCoins(state, kid, THURSDAY);
  const xp = totalXp(state, kid, THURSDAY);
  const before = JSON.stringify(state);
  const change = applyTaskChange(state, kid.id, THURSDAY, piano.id, { status: 'done', by: 'parent', at: 222 });
  assert.deepEqual(e.tasks[piano.id], { status: 'done', at: 222, by: 'parent', seconds: 1800, away: 420 });
  assert.ok(totalCoins(state, kid, THURSDAY) > coins);
  assert.ok(totalXp(state, kid, THURSDAY) > xp);
  assert.equal(undoTaskChanges(state, [change]), 1);
  assert.equal(JSON.stringify(state), before);
  assert.equal(totalCoins(state, kid, THURSDAY), coins);
  assert.equal(totalXp(state, kid, THURSDAY), xp);
});

test('a parent tick on a chore with no record is undone by removing the record', () => {
  const { state, kid } = setup();
  const [teeth] = quest(state, kid, THURSDAY);
  const y = addDays(THURSDAY, -1);
  const change = applyTaskChange(state, kid.id, y, teeth.id, { status: 'done', by: 'parent', at: 5 });
  assert.equal(dayStatus(state, kid, y, THURSDAY).done, 1);
  undoTaskChanges(state, [change]);
  assert.equal(entryFor(state, kid.id, y).tasks[teeth.id], undefined);
  assert.equal(dayStatus(state, kid, y, THURSDAY).done, 0);
});

test('un-ticking (and sending back) removes the record; undo brings all of it back', () => {
  const { state, kid } = setup();
  const [, , , piano] = quest(state, kid, THURSDAY);
  const e = entryFor(state, kid.id, THURSDAY, true);
  const rec = { status: 'done', by: 'parent', at: 9, seconds: 1800, away: 60 };
  e.tasks[piano.id] = { ...rec };
  const change = applyTaskChange(state, kid.id, THURSDAY, piano.id, null);
  assert.equal(e.tasks[piano.id], undefined);
  undoTaskChanges(state, [change]);
  assert.deepEqual(e.tasks[piano.id], rec);
});

test('undo keeps what changed since (timer seconds) and skips a chore whose status moved on', () => {
  const { state, kid } = setup();
  const [teeth, , , piano] = quest(state, kid, THURSDAY);
  const e = entryFor(state, kid.id, THURSDAY, true);
  e.tasks[piano.id] = { seconds: 600 };
  const tick = applyTaskChange(state, kid.id, THURSDAY, piano.id, { status: 'done', by: 'parent', at: 1 });
  e.tasks[piano.id].seconds = 660; // the timer kept counting on the kid's tablet
  undoTaskChanges(state, [tick]);
  assert.deepEqual(e.tasks[piano.id], { seconds: 660 });

  // the other parent sent it back in the meantime: nothing to undo
  const tick2 = applyTaskChange(state, kid.id, THURSDAY, teeth.id, { status: 'done', by: 'parent', at: 2 });
  delete e.tasks[teeth.id];
  assert.equal(undoTaskChanges(state, [tick2]), 0);
  assert.equal(e.tasks[teeth.id], undefined);
});

test('approve all and its undo cover every kid and day', () => {
  const { state, kid } = setup();
  const other = { id: 'kid_b', name: 'Esther', tasks: defaultTasks(), startDate: '2026-11-02' };
  state.kids.push(other);
  const y = addDays(THURSDAY, -1);
  const [teeth] = quest(state, kid, THURSDAY);
  entryFor(state, kid.id, THURSDAY, true).tasks[teeth.id] = { status: 'pending' };
  entryFor(state, other.id, y, true).tasks[other.tasks[0].id] = { status: 'pending', at: 3 };
  const before = JSON.stringify(state);
  const changes = pendingApprovals(state, THURSDAY).map(({ kid: k, key, task }) => applyTaskChange(state, k.id, key, task.id, { status: 'done', by: 'parent', at: 4 }));
  assert.equal(pendingApprovals(state, THURSDAY).length, 0);
  assert.equal(undoTaskChanges(state, changes), 2);
  assert.equal(JSON.stringify(state), before);
});

// The kid's Today list (todayQuests): grouped, next one up, timers, cues and stars.
import { todayQuests } from '../js/logic.js';

test('todayQuests groups the day: morning, after school, evening and bonus exercise', () => {
  const { state, kid } = setup();
  kid.tasks.push({ id: 'task_dish', name: 'Dishes', icon: '🍽️', period: 'afternoon', evening: true, days: [0, 1, 2, 3, 4, 5, 6], verify: 'self', minutes: 0 });
  const q = todayQuests(state, kid, THURSDAY);
  const ids = (list) => list.map((it) => it.task.id);
  assert.equal(q.groups.morning.length, 3);
  assert.ok(q.groups.morning.every((it) => it.task.period === 'morning'));
  assert.ok(q.groups.afternoon.every((it) => it.task.period === 'afternoon' && !it.task.evening));
  assert.deepEqual(ids(q.groups.evening), ['task_dish']);
  assert.deepEqual(ids(q.groups.exercise), ['task_run']);
  assert.equal(q.total, kidToday(state, kid, THURSDAY, 0).total, 'the same counts as kidToday');
  assert.equal(q.next, q.groups.morning[0].task.id, 'the first morning quest is next');
  assert.equal(q.groups.morning[0].next, true);
  assert.equal(q.groups.exercise[0].next, false, 'exercise is never "next"');
});

test('todayQuests: done, waiting, the next quest moves on, and the timer time left', () => {
  const { state, kid } = setup();
  const [teeth, bed, floor, piano] = quest(state, kid, THURSDAY);
  const e = entryFor(state, kid.id, THURSDAY, true);
  e.tasks[teeth.id] = { status: 'done' };
  e.tasks[bed.id] = { status: 'pending' };
  e.tasks[piano.id] = { seconds: 600 };
  const q = todayQuests(state, kid, THURSDAY);
  const of = (id) => [...q.groups.morning, ...q.groups.afternoon].find((it) => it.task.id === id);
  assert.equal(of(teeth.id).state, 'done');
  assert.equal(of(bed.id).state, 'waiting');
  assert.equal(of(floor.id).state, 'todo');
  assert.equal(q.next, floor.id, 'the first one still to do');
  assert.equal(of(piano.id).secondsLeft, piano.minutes * 60 - 600);
  assert.equal(of(floor.id).secondsLeft, null, 'no timer, no time left');
  assert.equal(of(teeth.id).secondsLeft, null);
});

test('todayQuests follows the kid\'s plan, with its cues and mastered habits', () => {
  const { state, kid } = setup();
  const [teeth, bed, floor] = quest(state, kid, THURSDAY);
  kid.plan = { order: [floor.id, teeth.id, bed.id], cues: { [floor.id]: 'After breakfast', [teeth.id]: 'Not a real cue' } };
  const q = todayQuests(state, kid, THURSDAY);
  assert.deepEqual(q.groups.morning.map((it) => it.task.id), [floor.id, teeth.id, bed.id]);
  assert.equal(q.next, floor.id);
  assert.equal(q.groups.morning[0].cue, 'After breakfast');
  assert.equal(q.groups.morning[1].cue, '', 'a cue from another list is ignored');
  assert.ok(q.groups.morning.every((it) => it.mastered === false));
});
