import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BLOOM_SPOTS, bloomSpotsFor } from '../js/bloomspots.js';
import { CRITTERS } from '../js/bloomart.js';
import { VILLAGE_THEMES, villageLayout } from '../js/villagemaps.js';
import { TREE_SPOTS, FLOWER_SPOTS } from '../js/familygarden.js';

test('every village has its own garden spots: a place for every tree and flower', () => {
  for (const map of VILLAGE_THEMES) {
    const s = BLOOM_SPOTS[map];
    assert.ok(s, `${map} has its own spots`);
    assert.equal(bloomSpotsFor(map), s);
    assert.equal(s.trees.length, TREE_SPOTS, `${map} trees`);
    assert.equal(s.flowers.length, FLOWER_SPOTS, `${map} flowers`);
    const L = villageLayout(map);
    for (const p of [...s.trees, ...s.flowers]) {
      assert.ok(Number.isInteger(p.x) && Number.isInteger(p.y), `${map} ${p.x},${p.y} is a whole pixel`);
      assert.ok(p.x > 20 && p.x < L.W - 20 && p.y > 20 && p.y < L.H - 18, `${map} ${p.x},${p.y} is on the map`);
      assert.ok(!L.blockedHard(p.x, p.y), `${map} ${p.x},${p.y} is not on a house, a prop or a wall`);
      assert.ok(!L.onPath(p.x, p.y, 7), `${map} ${p.x},${p.y} is not on a path`);
    }
  }
  assert.equal(bloomSpotsFor('bg-nowhere'), BLOOM_SPOTS['bg-meadow']);
});

test('the fjord garden keeps to its two bits of land', () => {
  const L = villageLayout('bg-fjord');
  const s = BLOOM_SPOTS['bg-fjord'];
  const inBox = (p, [x, y, w, h], pad = 0) => p.x > x - pad && p.x < x + w + pad && p.y > y - pad && p.y < y + h + pad;
  const people = [...L.slots.morning, ...L.slots.afternoon, L.shop, L.chest, L.coach, L.start];
  const named = [...s.trees.map((p, i) => ({ ...p, n: `tree ${i}` })), ...s.flowers.map((p, i) => ({ ...p, n: `flower ${i}` }))];
  for (const p of named) {
    assert.ok(!L.blocked(p.x, p.y), `${p.n} is not on a mountain or in the way`);
    assert.ok(!L.inWater(p.x, p.y, 3), `${p.n} is out of the bay, the channel and the creek`);
    assert.ok(!L.covered(p.x, p.y), `${p.n} is not behind a house or a standing thing`);
    assert.ok(!L.crossings.some((c) => inBox(p, [c.x, c.y, c.w, c.h], 3)), `${p.n} is off the boardwalk, the bridge, the wharf and the docks`);
    assert.ok(![L.green.left, L.green.right].some((g) => inBox(p, [g.x, g.y, g.w, g.h], 4)), `${p.n} is off the pond and the field`);
    assert.ok(!inBox(p, [L.landmark.x, L.landmark.y, L.landmark.w, L.landmark.h]), `${p.n} is not on the landmark`);
    assert.ok(people.every((q) => Math.hypot(p.x - q.x, p.y - q.y) >= 10), `${p.n} is not where somebody stands`);
    // the land is the north end and the south-west end; the bay lies between
    assert.ok(p.y < 222 || (p.y > 470 && p.x < 300), `${p.n} is on the land`);
  }
  const apart = (list) => Math.min(...list.flatMap((a, i) => list.slice(i + 1).map((b) => Math.hypot(a.x - b.x, a.y - b.y))));
  assert.ok(apart(s.trees) >= 16, 'no two trees share a spot');
  assert.ok(apart(s.flowers) >= 8, 'no two flowers share a spot');
});

test('every village has garden critters for each level of care', () => {
  for (const map of VILLAGE_THEMES) {
    const list = CRITTERS[map];
    assert.ok(list?.length >= 4, `${map} has critters of its own`);
    assert.deepEqual([...new Set(list.map((c) => c.level))].sort(), [1, 2, 3, 4], `${map} levels`);
    assert.equal(new Set(list.map((c) => c.id)).size, list.length, `${map} critter ids`);
    for (const c of list) {
      assert.ok(['fly', 'walk', 'sit', 'swim'].includes(c.moves), `${map} ${c.id} moves`);
      assert.ok(c.frames >= 1 && c.size.length === 2, `${map} ${c.id} frames and size`);
    }
  }
});
