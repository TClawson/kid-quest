import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays, taskPay } from '../js/logic.js';
import { CHORE_SETS, SET_CHORES, setChanges, applySet, routineOfTask, isSetChore, setTask } from '../js/choresets.js';
import { houseChores, houseTask, NIGHT_HOUR } from '../js/houserules.js';

let n = 0;
const newId = (p) => `${p}_${(n += 1)}`;
const day = '2026-11-11'; // a Wednesday

function kidWith(tasks) {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks, startDate: addDays(day, -30), owned: [] };
  s.kids.push(kid);
  return { s, kid };
}
const mark = (s, task) => { s.log[day] ||= {}; s.log[day].k1 ||= { tasks: {} }; s.log[day].k1.tasks[task.id] = { status: 'done' }; };

test('every set chore exists and each set brushes teeth morning and night', () => {
  for (const set of CHORE_SETS) {
    for (const key of [...set.chores, ...set.replaces]) assert.ok(SET_CHORES[key], `${set.id}: ${key}`);
    assert.ok(set.chores.includes('teeth') && set.chores.includes('teeth-night'), set.id);
  }
  assert.equal(routineOfTask(setTask('teeth-night', 'x')), 'evening');
  assert.equal(routineOfTask(setTask('toys', 'x')), 'afternoon');
  assert.equal(routineOfTask({ period: 'exercise', evening: true }), 'exercise');
});

test('the Little set splits the room for a kid on the standard routine', () => {
  const kid = { tasks: defaultTasks() };
  const piano = kid.tasks.find((t) => t.name === 'Piano practice');
  const { add, remove } = setChanges(kid, 'little');
  assert.deepEqual(remove.map((t) => t.name), ['Clear bedroom floor'], 'the old floor chore is the whole room');
  assert.deepEqual(add, ['dressed', 'clothes', 'toys', 'books', 'teeth-night', 'pajamas']);
  const { added } = applySet(kid, 'little', newId);
  assert.equal(added.length, 6);
  assert.equal(kid.choreSet, 'little');
  assert.ok(kid.tasks.includes(piano), 'piano stays');
  assert.equal(kid.tasks.filter((t) => t.house === 'floor').length, 1);
  assert.equal(kid.tasks.find((t) => t.house === 'floor').name, 'Toys away');
  // routines stay together in the editor's order
  const routines = kid.tasks.map(routineOfTask);
  assert.deepEqual(routines, [...routines].sort((a, b) => ['morning', 'afternoon', 'evening'].indexOf(a) - ['morning', 'afternoon', 'evening'].indexOf(b)));
  // switching again does nothing
  assert.deepEqual(setChanges(kid, 'little'), { add: [], remove: [] });
});

test('switching back to Big puts the whole room back and keeps both brushings', () => {
  const kid = { tasks: defaultTasks() };
  applySet(kid, 'little', newId);
  const { remove } = setChanges(kid, 'big');
  assert.deepEqual(remove.map((t) => t.name).sort(), ['Books away', 'Clothes away', 'Get dressed', 'Pajamas on', 'Toys away']);
  applySet(kid, 'big', newId);
  assert.ok(kid.tasks.some((t) => isSetChore(t, 'room') && t.house === 'floor'));
  assert.equal(kid.tasks.filter((t) => t.house === 'teeth' || t.house === 'teeth-night').length, 2);
  assert.deepEqual(setChanges(kid, 'big'), { add: [], remove: [] });
});

test('a kid made before sets keeps renamed chores that are linked to the house', () => {
  const tasks = defaultTasks();
  tasks.find((t) => t.house === 'bed').name = 'Bed!';
  const { add } = setChanges({ tasks }, 'big');
  assert.ok(!add.includes('bed'));
  assert.ok(add.includes('teeth-night'));
});

test('the sink waits for the night brushing once the morning one is done, from the evening', () => {
  const am = houseTask('teeth', 'am');
  const pm = houseTask('teeth-night', 'pm');
  assert.equal(pm.evening, true);
  const { s, kid } = kidWith([am, pm]);
  assert.equal(houseChores(s, kid, day, 8).teeth.id, 'am');
  assert.equal(houseChores(s, kid, day, NIGHT_HOUR).teeth.id, 'am', 'morning teeth still waiting');
  mark(s, am);
  assert.equal(houseChores(s, kid, day, 12).teeth.id, 'am', 'brushed: the brush is put away till evening');
  assert.equal(houseChores(s, kid, day, 12).teeth.done, true);
  assert.equal(houseChores(s, kid, day, NIGHT_HOUR).teeth.id, 'pm');
  assert.equal(houseChores(s, kid, day, NIGHT_HOUR).teeth.done, false);
  assert.deepEqual(houseChores(s, kid, day, 8).ids.sort(), ['am', 'pm'], 'villagers never give out either');
});

test('stars only: no coins, XP stays', () => {
  const tasks = defaultTasks();
  const { s, kid } = kidWith(tasks);
  const bed = tasks.find((t) => t.house === 'bed');
  assert.ok(taskPay(s, kid, day, bed, day).coins > 0);
  kid.starsOnly = true;
  const p = taskPay(s, kid, day, bed, day);
  assert.equal(p.coins, 0);
  assert.ok(p.xp > 0);
});
