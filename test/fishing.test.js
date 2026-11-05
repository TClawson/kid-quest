import test from 'node:test';
import assert from 'node:assert/strict';
import { BAIT, BAITS, baitToday, pointsFor, POINTS, pickiness, SPOTS, SPECIES, GAME_SECONDS, SNAG } from '../js/fishing.js';

test('bait: jigs and spoons for bass and pike, worms for catfish and bluegill', () => {
  const like = (b, k) => BAIT[b].like[k];
  for (const k of ['smallmouth', 'largemouth', 'pike']) assert.ok(Math.max(like('jig', k), like('spoon', k)) > like('worm', k), k);
  for (const k of ['catfish', 'bluegill']) assert.ok(like('worm', k) > Math.max(like('jig', k), like('spoon', k)), k);
  assert.ok(like('spoon', 'bluegill') < 0, 'spoons scare bluegill');
  assert.equal(like('spoon', 'catfish'), 0);
  assert.equal(like('worm', 'pike'), 0);
});

test("today's bait odds change from day to day but stay put within a day", () => {
  assert.deepEqual(baitToday('2026-11-05'), baitToday('2026-11-05'));
  assert.notDeepEqual(baitToday('2026-11-05'), baitToday('2026-11-06'));
  for (let d = 1; d <= 30; d += 1) {
    const t = baitToday(`2026-11-${d}`);
    for (const b of BAITS) for (const [k, v] of Object.entries(BAIT[b].like)) {
      if (v <= 0) assert.equal(t[b][k], v, 'useless and scary baits stay that way');
      else assert.ok(t[b][k] > 0 && t[b][k] <= 1);
    }
  }
});

test('points: more for bigger fish, the most for the map\'s rare fish', () => {
  assert.equal(pointsFor('bluegill', 0), POINTS.bluegill);
  assert.ok(pointsFor('bluegill', 1) > pointsFor('bluegill', 0.5));
  assert.equal(pointsFor('pike', 1), Math.round(POINTS.pike * 2.5));
  for (const k of Object.keys(SPECIES)) assert.ok(pointsFor('special', 0) > pointsFor(k, 0), k);
  assert.ok(POINTS.bluegill < POINTS.largemouth && POINTS.largemouth < POINTS.pike);
});

test('bigger fish are pickier', () => {
  assert.ok(pickiness(1) > pickiness(0.5) && pickiness(0.5) > pickiness(0));
  assert.ok(pickiness(0) < 0.2);
});

test('every regular map has its own fishing spot and rare fish', () => {
  const maps = ['bg-meadow', 'bg-castle', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-volcano', 'bg-rainbow', 'bg-galaxy'];
  assert.deepEqual(Object.keys(SPOTS).sort(), [...maps].sort());
  const rare = new Set(maps.map((m) => SPOTS[m].special.name));
  assert.equal(rare.size, maps.length);
  // the odds lean differently from map to map
  const leans = new Set(maps.map((m) => Object.entries(SPOTS[m].odds).sort((a, b) => b[1] - a[1])[0][0]));
  assert.ok(leans.size >= 3);
  assert.equal(GAME_SECONDS, 90);
  assert.deepEqual(SNAG, { weed: 0.1, log: 0.5 });
});
