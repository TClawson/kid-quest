import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pickVisitors, visitorLines, MAX_VISITORS, planVisits } from '../js/visits.js';
import { addDays } from '../js/logic.js';

const fam = (n) => Array.from({ length: n }, (_, i) => ({ id: `kid_${i}`, name: `Kid ${i}`, buddy: { species: 'fox', outfit: {} } }));

test('visitors never include the host and number 1 to 4', () => {
  for (const size of [2, 3, 4, 6, 9]) {
    for (let d = 0; d < 60; d += 1) {
      const v = pickVisitors('kid_0', fam(size), addDays('2026-11-01', d));
      assert.ok(v.length >= 1 && v.length <= Math.min(MAX_VISITORS, size - 1), `size ${size}: ${v.length}`);
      assert.ok(!v.some((b) => b.id === 'kid_0'));
      assert.equal(new Set(v.map((b) => b.id)).size, v.length, 'no one visits twice');
    }
  }
});

test('the same day gives the same visitors whatever order the family is listed in', () => {
  const a = pickVisitors('kid_1', fam(5), '2026-11-02').map((b) => b.id);
  const b = pickVisitors('kid_1', fam(5).reverse(), '2026-11-02').map((x) => x.id);
  assert.deepEqual(a, b);
});

test('over a month every count and every family member turns up', () => {
  const counts = new Set();
  const seen = new Set();
  for (let d = 0; d < 30; d += 1) {
    const v = pickVisitors('kid_0', fam(4), addDays('2026-11-01', d));
    counts.add(v.length);
    v.forEach((b) => seen.add(b.id));
  }
  assert.deepEqual([...counts].sort(), [1, 2, 3]);
  assert.deepEqual([...seen].sort(), ['kid_1', 'kid_2', 'kid_3']);
});

test('no visitors for an only child or kids without a buddy', () => {
  assert.deepEqual(pickVisitors('kid_0', fam(1), '2026-11-02'), []);
  assert.deepEqual(pickVisitors('kid_0', [...fam(1), { id: 'x', name: 'X' }], '2026-11-02'), []);
});

test('each visitor says something different, and celebrates a finished quest', () => {
  const lines = visitorLines(fam(3), { name: 'Ava', streak: 5, complete: true }, '2026-11-02');
  assert.equal(lines.length, 3);
  assert.equal(new Set(lines).size, 3);
  assert.match(lines[0], /Quest complete|Way to go/);
});

test('visitors with the same gear play together, rod owners fish, and the plan is fixed for the day', () => {
  const vs = [
    { id: 'a', gear: { soccer: 1, rod: 2 } },
    { id: 'b', gear: { soccer: 3 } },
    { id: 'c', gear: { rod: 1 } },
    { id: 'd', gear: {} },
  ];
  let games = 0;
  for (let d = 0; d < 60; d += 1) {
    const date = addDays('2026-11-01', d);
    const plan = planVisits('host', vs, date);
    assert.deepEqual(plan, planVisits('host', vs, date));
    assert.ok(plan.areas.length <= 2);
    assert.equal(new Set(plan.areas.map((a) => a.side)).size, plan.areas.length, 'one area a side');
    for (const a of plan.areas) {
      if (a.kind === 'soccer') { assert.deepEqual([...a.members].sort(), ['a', 'b']); games += 1; }
      if (a.kind === 'pond') assert.ok(a.members.every((id) => vs.find((v) => v.id === id).gear.rod));
    }
    // everyone gets a spot, no two share one
    const spots = Object.values(plan.spots).map((s) => `${s.side}${s.slot}`);
    assert.equal(spots.length, 4);
    assert.equal(new Set(spots).size, 4);
  }
  assert.ok(games > 20, 'soccer happens on most days');
  assert.deepEqual(planVisits('host', [{ id: 'x', gear: { hockey: 1 } }], '2026-11-01').areas, [], 'one player is not a game');
});
