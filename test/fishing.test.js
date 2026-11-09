import test from 'node:test';
import assert from 'node:assert/strict';
import { BAIT, BAITS, baitToday, pointsFor, POINTS, pickiness, strikeChance, SPOTS, SPECIES, GAME_SECONDS, SNAG } from '../js/fishing.js';

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

test('a twitch hooks small fish 44% of the time, the biggest 20%', () => {
  // Taylor, 2026-11-05: from 55% and 40%, small fish 20% harder and big ones twice as hard
  assert.ok(Math.abs(strikeChance(0) - 0.55 * 0.8) < 1e-9);
  assert.ok(Math.abs(strikeChance(1) - 0.4 / 2) < 1e-9);
  assert.ok(strikeChance(0.5) < strikeChance(0) && strikeChance(0.5) > strikeChance(1));
  assert.ok(strikeChance(1, 3) > strikeChance(1, 2) && strikeChance(1, 2) > strikeChance(1, 1), 'better rods spook fewer fish');
});

test('bigger fish are pickier', () => {
  assert.ok(pickiness(1) > pickiness(0.5) && pickiness(0.5) > pickiness(0));
  assert.ok(pickiness(0) < 0.2);
});

test('every regular map has its own fishing spot and rare fish', () => {
  const maps = ['bg-meadow', 'bg-castle', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-volcano', 'bg-rainforest', 'bg-rainbow', 'bg-galaxy'];
  assert.deepEqual(Object.keys(SPOTS).sort(), [...maps].sort());
  const rare = new Set(maps.map((m) => SPOTS[m].special.name));
  assert.equal(rare.size, maps.length);
  // the odds lean differently from map to map
  const leans = new Set(maps.map((m) => Object.entries(SPOTS[m].odds).sort((a, b) => b[1] - a[1])[0][0]));
  assert.ok(leans.size >= 3);
  assert.equal(GAME_SECONDS, 90);
  assert.deepEqual(SNAG, { weed: 0.1, log: 0.5 });
});

test('every map but Forest Lake has its own fish and bait names; they keep how they work', async () => {
  const { lookFor, baitNames, BAITS: B } = await import('../js/fishing.js');
  const kinds = Object.keys(SPECIES);
  for (const map of Object.keys(SPOTS)) {
    const names = kinds.map((k) => lookFor(map, k).name);
    assert.equal(new Set(names).size, kinds.length, `${map}: five different fish`);
    if (map !== 'bg-meadow') assert.ok(names.every((n, i) => n !== SPECIES[kinds[i]].name), `${map}: its own fish`);
    for (const k of [...kinds, 'special']) { const { look } = lookFor(map, k); assert.ok(look.depth > 0 && look.back && look.side && look.belly && look.fin, `${map} ${k} has a look`); }
    const bn = baitNames(map);
    assert.deepEqual(Object.keys(bn), B);
    assert.ok(Object.values(bn).every((n) => n.length <= 10), `${map}: bait names fit the chips`);
  }
  assert.equal(lookFor('bg-ocean', 'catfish').name, 'Nurse shark');
  assert.equal(lookFor('bg-rainbow', 'special').name, 'Unicorn fish');
});
