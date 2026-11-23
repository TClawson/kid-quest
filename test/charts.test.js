import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultTasks, addDays, choreWords } from '../js/logic.js';
import { applySet } from '../js/choresets.js';
import { planDraft, moveChore, signPlan } from '../js/planrules.js';
import { chartRoutines, tokenPages, stickers, chartSignature, chartOutdated, defaultStyle, daysShort, choreKind, PER_PAGE } from '../js/charts.js';

let n = 0;
const newId = (p) => `${p}_${(n += 1)}`;
const day = '2026-11-23'; // a Monday
const kidWith = (set) => { const kid = { id: 'k1', name: 'Ava', tasks: defaultTasks(), startDate: addDays(day, -30) }; applySet(kid, set, newId); return kid; };
const named = (kid, name, house) => kid.tasks.find((t) => t.name === name && (!house || t.house === house));

test('the chart follows the kid\'s plan: routines, order, cues and the grow chore', () => {
  const kid = kidWith('little');
  const d = planDraft(kid, day);
  moveChore(kid, d, named(kid, 'Make bed').id, 'afternoon');
  d.cues = { morning: 'When I wake up', afternoon: 'After snack' };
  d.grow = named(kid, 'Toys away').id;
  signPlan(kid, d, day);
  const groups = chartRoutines(kid);
  assert.deepEqual(groups.map((g) => g.routine), ['morning', 'afternoon', 'evening']);
  const after = groups[1];
  assert.equal(after.chores.at(-1).name, 'Make bed');
  assert.match(after.sentence, /^After snack, I'll .*then make bed\.$/);
  assert.equal(after.chores.find((c) => c.grow).name, 'Toys away');
  // night teeth has its own token and color
  const night = groups[2].chores.find((c) => c.kind === 'teeth-night');
  assert.ok(night);
  assert.notEqual(night.color, groups[0].chores.find((c) => c.kind === 'teeth').color);
});

test('a long routine splits across pages, and every token gets a sticker', () => {
  const kid = kidWith('little');
  const d = planDraft(kid, day);
  for (const name of ['Clothes away', 'Toys away', 'Books away', 'Make bed']) moveChore(kid, d, named(kid, name).id, 'evening');
  signPlan(kid, d, day);
  const pages = tokenPages(kid);
  const night = pages.filter((p) => p.routine === 'evening');
  assert.equal(night.length, 2);
  assert.ok(night.every((p) => p.chores.length <= PER_PAGE && p.parts === 2));
  assert.deepEqual(night.flatMap((p) => p.chores.map((c) => c.n)), night.flatMap((p) => p.chores).map((_, i) => i + 1), 'numbers run on across the pages');
  assert.equal(stickers(kid).length, pages.reduce((s, p) => s + p.chores.length, 0));
});

test('big kids get the week grid, with their exercise in its own group', () => {
  const kid = kidWith('big');
  kid.tasks.push({ id: 'run', name: 'Bike ride', icon: '🚲', period: 'exercise', days: [1, 3, 5], verify: 'parent', minutes: 0 });
  assert.equal(defaultStyle(kid), 'grid');
  const ex = chartRoutines(kid).at(-1);
  assert.equal(ex.routine, 'exercise');
  assert.equal(ex.chores[0].daysText, 'Mon, Wed, Fri');
  assert.ok(!tokenPages(kid).some((p) => p.routine === 'exercise'), 'exercise stays off the token pages');
});

test('the chart is outdated until printed, and again once the plan changes', () => {
  const kid = kidWith('little');
  assert.equal(chartOutdated(kid), false, 'no plan yet, nothing to ask for');
  const d = planDraft(kid, day);
  signPlan(kid, d, day);
  assert.equal(chartOutdated(kid), true);
  kid.chartPrinted = chartSignature(kid);
  assert.equal(chartOutdated(kid), false);
  const d2 = planDraft(kid, addDays(day, 1));
  moveChore(kid, d2, named(kid, 'Books away').id, 'evening');
  signPlan(kid, d2, addDays(day, 1));
  assert.equal(chartOutdated(kid), true);
});

test('small words: days, kinds and how a chore is said', () => {
  assert.equal(daysShort([0, 1, 2, 3, 4, 5, 6]), '');
  assert.equal(daysShort([1, 2, 3, 4, 5]), 'Mon–Fri');
  assert.equal(daysShort([6, 0]), 'Weekends');
  assert.equal(choreKind({ name: 'Books away' }), 'books');
  assert.equal(choreKind({ name: 'Piano practice' }), null);
  assert.equal(choreWords({ name: 'Toys away' }), 'put toys away');
  assert.equal(choreWords({ name: 'Chore of the week' }), 'do my chore of the week');
  assert.equal(choreWords({ name: 'Chore of the week: deep clean' }), 'do the deep clean');
  assert.equal(choreWords({ name: 'Make bed' }), 'make bed');
});
