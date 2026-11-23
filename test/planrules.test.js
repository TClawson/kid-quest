import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, defaultTasks, addDays, tasksForDay, isPinned, routineOf, cueFor, weekStart, dayOfWeek } from '../js/logic.js';
import { applySet } from '../js/choresets.js';
import { planDraft, routineList, moveChore, nudgeChore, flexTasks, dayCheck, toggleDay, signPlan, signedThisWeek, seedThisWeek } from '../js/planrules.js';

let n = 0;
const newId = (p) => `${p}_${(n += 1)}`;
const day = '2026-11-23'; // a Monday

function littleKid() {
  const s = emptyState();
  const kid = { id: 'k1', name: 'Ava', tasks: defaultTasks(), startDate: addDays(day, -30), owned: [] };
  applySet(kid, 'little', newId);
  s.kids.push(kid);
  return { s, kid };
}
const named = (kid, name, house) => kid.tasks.find((t) => t.name === name && (!house || t.house === house));

test('both teeth are pinned unless a parent unpins them', () => {
  const { kid } = littleKid();
  assert.equal(isPinned(named(kid, 'Brush teeth', 'teeth')), true);
  assert.equal(isPinned(named(kid, 'Brush teeth', 'teeth-night')), true);
  assert.equal(isPinned(named(kid, 'Make bed')), false);
  named(kid, 'Brush teeth', 'teeth').pinned = false;
  assert.equal(isPinned(named(kid, 'Brush teeth', 'teeth')), false);
});

test('a kid drags a chore into another routine, and the day follows the plan', () => {
  const { s, kid } = littleKid();
  const d = planDraft(kid, day);
  const bed = named(kid, 'Make bed');
  const toys = named(kid, 'Toys away');
  assert.ok(moveChore(kid, d, bed.id, 'afternoon', toys.id));
  const after = routineList(kid, d, 'afternoon').map((t) => t.id);
  assert.equal(after.indexOf(bed.id) + 1, after.indexOf(toys.id), 'dropped just before Toys away');
  // pinned teeth can't leave the morning, but can move inside it
  const teeth = named(kid, 'Brush teeth', 'teeth');
  assert.equal(moveChore(kid, d, teeth.id, 'evening'), false);
  assert.ok(nudgeChore(kid, d, teeth.id, 1) || nudgeChore(kid, d, teeth.id, -1));
  // into an empty spot: the end of the routine
  assert.ok(moveChore(kid, d, named(kid, 'Books away').id, 'evening'));
  assert.equal(routineList(kid, d, 'evening').at(-1).name, 'Books away');
  d.cues = { morning: 'When I wake up', afternoon: 'After snack' };
  signPlan(kid, d, day);
  const today = tasksForDay(s, kid, day, day);
  const bedToday = today.find((t) => t.id === bed.id);
  assert.equal(routineOf(bedToday), 'afternoon');
  assert.equal(bedToday.period, 'afternoon');
  assert.equal(routineOf(today.find((t) => t.name === 'Books away')), 'evening');
  assert.equal(cueFor(kid, bedToday), 'After snack');
  assert.ok(signedThisWeek(kid, day));
  assert.ok(!signedThisWeek(kid, addDays(day, 7)));
  // the next draft starts from the saved plan
  assert.equal(planDraft(kid, day).routines[bed.id], 'afternoon');
});

test('chores the kid places: exactly the count, and the schedule uses their days', () => {
  const { s, kid } = littleKid();
  const vac = named(kid, 'Vacuum your room');
  vac.kidDays = 1;
  const run = { id: 'run', name: 'Run', icon: '🏃', period: 'exercise', days: [1, 3, 5], verify: 'parent', minutes: 0, kidDays: 4 };
  kid.tasks.push(run);
  assert.deepEqual(flexTasks(kid).map((t) => t.id), [vac.id, 'run']);
  const d = planDraft(kid, day);
  assert.deepEqual(d.days[vac.id], [5], 'starts on the parent\'s days');
  toggleDay(d, vac, 3);
  assert.deepEqual(dayCheck(d, vac), { picked: 2, need: 1, ok: false });
  toggleDay(d, vac, 5);
  assert.equal(dayCheck(d, vac).ok, true);
  assert.equal(dayCheck(d, run).ok, false, 'exercise needs at least its count');
  toggleDay(d, run, 6);
  assert.equal(dayCheck(d, run).ok, true);
  signPlan(kid, d, day);
  const wed = addDays(day, 2); const fri = addDays(day, 4);
  assert.equal(dayOfWeek(wed), 3);
  assert.ok(tasksForDay(s, kid, wed, wed).some((t) => t.id === vac.id));
  assert.ok(!tasksForDay(s, kid, fri, fri).some((t) => t.id === vac.id));
  assert.ok(tasksForDay(s, kid, addDays(day, 5), addDays(day, 5)).some((t) => t.id === 'run'), 'Saturday run');
  // a parent turning it back to "set by you" uses the parent's days again
  delete vac.kidDays;
  assert.ok(tasksForDay(s, kid, fri, fri).some((t) => t.id === vac.id));
});

test('the grow chore brings one free seed a week, planted for that chore', () => {
  const { kid } = littleKid();
  const bed = named(kid, 'Make bed');
  const d = planDraft(kid, day);
  d.grow = bed.id; d.seed = 'seed-rose';
  const gift = signPlan(kid, d, day);
  assert.equal(gift.seed.id, 'seed-rose');
  assert.equal(gift.planted, true);
  assert.ok(kid.garden.beds.some((b) => b && b.seed === 'seed-rose' && b.task === bed.id && b.planted === day));
  assert.equal(seedThisWeek(kid, addDays(day, 3)).id, 'seed-rose');
  // signing again the same week gives nothing more
  const d2 = planDraft(kid, addDays(day, 2));
  assert.equal(d2.grow, bed.id);
  d2.seed = 'seed-lily';
  assert.equal(signPlan(kid, d2, addDays(day, 2)), null);
  assert.equal(kid.garden.beds.filter(Boolean).length, 1);
  // next week, another packet
  const d3 = planDraft(kid, addDays(day, 7));
  assert.equal(d3.grow, null, 'a new week starts with no grow chore');
  d3.grow = bed.id; d3.seed = 'seed-lily';
  assert.ok(signPlan(kid, d3, addDays(day, 7)));
  assert.equal(kid.plan.seedWeek, weekStart(addDays(day, 7)));
  // exercise as the grow chore: the packet waits in the seed bag
  kid.tasks.push({ id: 'run', name: 'Run', icon: '🏃', period: 'exercise', days: [1], verify: 'parent', minutes: 0 });
  const d4 = planDraft(kid, addDays(day, 14));
  d4.grow = 'run'; d4.seed = 'seed-pansy';
  assert.equal(signPlan(kid, d4, addDays(day, 14)).planted, false);
  assert.equal(kid.garden.seeds['seed-pansy'], 1);
});

test('an older per-chore plan turns into routine cues', () => {
  const { kid } = littleKid();
  const piano = named(kid, 'Piano practice');
  kid.plan = { order: [piano.id], cues: { [piano.id]: 'After snack' }, week: '2026-11-02' };
  assert.equal(planDraft(kid, day).cues.afternoon, 'After snack');
});
