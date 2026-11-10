import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emptyState, addDays } from '../js/logic.js';
import {
  villageGarden, familyMark, dailySummaries, critterLevel, VILLAGE_START,
  TREE_SPOTS, TREE_BATCH, TREE_DAYS, FLOWER_SPOTS, FLOWER_BATCH, FLOWER_DAYS, FLOWER_LIFE, MAX_WILT,
} from '../js/familygarden.js';

const start = '2026-11-10';
const every = [0, 1, 2, 3, 4, 5, 6];
const tasks = (n) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, name: `T${i}`, period: 'morning', days: every }));

// two kids with 5 chores a day each; pattern(i) gives how many each did on day i
function family(days, pattern) {
  const kids = [{ id: 'a', tasks: tasks(5), daily: {} }, { id: 'b', tasks: tasks(5), daily: {} }];
  for (let i = 0; i < days; i += 1) {
    const key = addDays(start, i);
    const [x, y] = pattern(i);
    kids[0].daily[key] = [x, 5];
    kids[1].daily[key] = [y, 5];
  }
  return { kids, today: addDays(start, days - 1) };
}

test('a day is good at 80%, bad under 50%, and the rest changes nothing', () => {
  const { kids } = family(3, (i) => [[4, 4], [2, 2], [3, 4]][i]);
  assert.equal(familyMark(kids, start, addDays(start, 5)).mark, 'good');
  assert.equal(familyMark(kids, addDays(start, 1), addDays(start, 5)).mark, 'bad');
  assert.equal(familyMark(kids, addDays(start, 2), addDays(start, 5)).mark, 'mid');
});

test('a kid with nothing on record for a past day did none of it; today waits until known', () => {
  const kids = [{ id: 'a', tasks: tasks(5), daily: { [start]: [5, 5] } }, { id: 'b', tasks: tasks(5), daily: {} }];
  assert.equal(familyMark(kids, start, addDays(start, 1)).share, 0.5);
  assert.equal(familyMark(kids, start, start).mark, 'mid', 'b has not opened their device today');
  kids[1].today = { day: start, done: 4, total: 5 };
  assert.equal(familyMark(kids, start, start).mark, 'good');
  // excused days count as nothing to do
  const ex = [{ id: 'a', tasks: tasks(5), daily: { [start]: [5, 5] } }, { id: 'b', tasks: tasks(5), daily: { [start]: [0, 0] } }];
  assert.equal(familyMark(ex, start, addDays(start, 1)).mark, 'good');
});

test('the first trees and flowers start on day one, spread around', () => {
  const { kids, today } = family(1, () => [0, 0]);
  const g = villageGarden(kids, today);
  assert.equal(g.trees.length, TREE_BATCH);
  assert.equal(g.flowers.length, FLOWER_BATCH);
  assert.ok(g.trees.every((t) => t.grown === 0));
});

test('trees take 60 good days, new batches every 18, all 20 grown in about 6 months of good days', () => {
  const { kids, today } = family(400, () => [5, 5]);
  let firstAll = null;
  for (let d = 0; d < 400; d += 1) {
    const g = villageGarden(kids, addDays(start, d));
    if (d === TREE_DAYS - 1) assert.ok(g.trees.filter((t) => t.mature).length >= TREE_BATCH, 'first batch grown after 60 good days');
    if (d === TREE_DAYS - 2) assert.equal(g.matureTrees, 0);
    if (g.matureTrees === TREE_SPOTS && firstAll === null) { firstAll = d + 1; break; }
  }
  assert.ok(firstAll >= 150 && firstAll <= 200, `every tree grown after ${firstAll} good days`);
  assert.equal(villageGarden(kids, today).trees.length, TREE_SPOTS, 'trees stay forever');
});

test('only good days grow things: a middling family grows nothing', () => {
  const { kids, today } = family(90, () => [3, 4]); // 70%
  const g = villageGarden(kids, today);
  assert.equal(g.goodDays, 0);
  assert.ok(g.trees.every((t) => t.grown === 0));
  assert.equal(g.blooms, 0);
  assert.equal(g.wilt, 0);
});

test('flowers bloom after 7 good days, fade 7 days later, and keep cycling', () => {
  const { kids } = family(120, () => [5, 5]);
  const at = (d) => villageGarden(kids, addDays(start, d));
  assert.equal(at(FLOWER_DAYS - 2).blooms, 0);
  assert.equal(at(FLOWER_DAYS - 1).blooms, FLOWER_BATCH);
  const opened = at(FLOWER_DAYS - 1).flowers.filter((f) => f.blooming).map((f) => f.spot);
  const later = at(FLOWER_DAYS - 1 + FLOWER_LIFE);
  assert.ok(opened.every((s) => !later.flowers.some((f) => f.spot === s && f.blooming && f.age >= FLOWER_LIFE)), 'first ones have faded');
  // steady good days keep the village mostly full of flowers
  for (let d = 60; d < 120; d += 1) {
    const g = at(d);
    assert.ok(g.flowers.length >= FLOWER_SPOTS * 0.7, `day ${d}: ${g.flowers.length} flowers`);
    assert.ok(g.blooms >= FLOWER_SPOTS * 0.3, `day ${d}: ${g.blooms} in bloom`);
  }
  // varieties change as they cycle
  const kinds = new Set(at(119).flowers.map((f) => f.kind));
  assert.ok(kinds.size >= 3);
});

test('two bad days in a row wilt things; a good day brings them back', () => {
  const pattern = (i) => (i < 10 ? [5, 5] : i < 12 ? [1, 1] : i < 16 ? [0, 0] : i === 16 ? [3, 4] : [5, 5]);
  const { kids } = family(20, pattern);
  const at = (d) => villageGarden(kids, addDays(start, d));
  // a day only counts as bad once it's over, so the wilt shows the next morning
  assert.equal(at(11).wilt, 0, 'one bad day is fine');
  assert.equal(at(12).wilt, 1);
  assert.equal(at(14).wilt, 2);
  assert.equal(at(16).wilt, MAX_WILT);
  assert.equal(at(17 - 1).wilt, MAX_WILT, 'a middling day keeps the wilt');
  assert.equal(at(17).wilt, 0, 'a good day brings it back');
  // bad days take nothing away
  assert.equal(at(16).trees.length, at(9).trees.length);
  assert.ok(at(16).trees.every((t) => t.grown === 10));
  // a middling day between two bad days breaks the run
  const { kids: k2 } = family(5, (i) => [[5, 5], [0, 0], [3, 4], [0, 0], [3, 4]][i]);
  assert.equal(villageGarden(k2, addDays(start, 4)).wilt, 0);
});

test('everything is the same on every device and grows from the start date only', () => {
  const { kids, today } = family(30, (i) => (i % 3 ? [5, 4] : [2, 1]));
  assert.deepEqual(villageGarden(kids, today), villageGarden(structuredClone(kids), today));
  assert.equal(villageGarden(kids, addDays(VILLAGE_START, -1)).trees.length, 0);
});

test('kid.daily is written from the days this device has', () => {
  const s = emptyState();
  const kid = { id: 'k1', tasks: tasks(2), daily: { '2026-11-01': [1, 2] } };
  s.kids.push(kid);
  s.log[start] = { k1: { tasks: { t0: { status: 'done' }, t1: { status: 'pending' } } } };
  s.log[addDays(start, 1)] = { k1: { tasks: {}, excused: true } };
  const d = dailySummaries(s, kid, addDays(start, 1));
  assert.deepEqual(d[start], [2, 2]);
  assert.deepEqual(d[addDays(start, 1)], [0, 0]);
  assert.deepEqual(d['2026-11-01'], [1, 2], 'keeps what it had');
  kid.daily = d;
  assert.equal(dailySummaries(s, kid, addDays(start, 1)), null, 'nothing new');
});

test('critters come out as the village fills in, and hide when it wilts', () => {
  const { kids } = family(200, () => [5, 5]);
  assert.equal(critterLevel(villageGarden(kids, start)), 0);
  assert.equal(critterLevel(villageGarden(kids, addDays(start, 199))), 4);
  assert.equal(critterLevel({ wilt: 2, matureTrees: 20, trees: [], blooms: 50 }), 0);
});
