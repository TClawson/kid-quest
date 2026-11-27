import test from 'node:test';
import assert from 'node:assert/strict';
import { BAIT, BAITS, baitToday, pointsFor, POINTS, pickiness, strikeChance, spookChance, twitchOutcome, NERVES_HALF, SPOTS, SPECIES, GAME_SECONDS, SNAG, ROD_ZOOM, sizePower, BOAT_OUT, maxSizeAt, BOAT_MAX, ROW_SPEED, DEEP_AT, DEEP_FISH, DEEP_BASE, deepChance, baseFor, lookFor } from '../js/fishing.js';
import { realFish } from '../js/fishfacts.js';

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

test('one twitch hooks small fish more often than big ones, and better rods hook more', () => {
  assert.ok(strikeChance(0.5) < strikeChance(0) && strikeChance(0.5) > strikeChance(1));
  assert.ok(strikeChance(1, 3) > strikeChance(1, 2) && strikeChance(1, 2) > strikeChance(1, 1), 'better rods hook more');
  assert.ok(strikeChance(0) < 0.3, 'one twitch is not a sure thing: try a few');
});

test('a first twitch rarely spooks a fish; twitches close together build up its nerves', () => {
  // Taylor, 2026-11-15: smaller chance on the first twitch, only fast twitching builds it up (a low-pass filter)
  assert.ok(spookChance(1) <= 0.1, 'the first twitch');
  // the nerves a fish has after twitches every `gap` seconds, counting the last one
  const nervesAfter = (n, gap) => { let v = 0; for (let i = 0; i < n; i += 1) v = v * 0.5 ** (gap / NERVES_HALF) + 1; return v; };
  assert.ok(spookChance(nervesAfter(4, 2.5)) < 0.15, 'slow twitches stay calm');
  assert.ok(spookChance(nervesAfter(4, 0.3)) > 0.6, 'fast twitches spook it');
  assert.ok(spookChance(nervesAfter(2, 0.5)) > spookChance(nervesAfter(2, 1.5)));
  // one roll: hook, then spook, then bored (it swims off), else it keeps watching
  assert.equal(twitchOutcome(0, 0.5, 1, 1), 'hook');
  assert.equal(twitchOutcome(strikeChance(0.5) + 0.01, 0.5, 1, 1), 'spook');
  assert.equal(twitchOutcome(0.999, 0.5, 1, 1), 'watch');
  assert.equal(twitchOutcome(0.999, 0.5, 1, 9), 'spook', 'a very nervous fish always spooks if it does not bite');
  const counts = { hook: 0, spook: 0, bored: 0, watch: 0 };
  for (let i = 0; i < 1000; i += 1) counts[twitchOutcome((i + 0.5) / 1000, 0.3, 1, 1)] += 1;
  assert.ok(counts.spook < counts.hook && counts.bored > counts.spook, JSON.stringify(counts));
});

test('bigger fish are pickier', () => {
  assert.ok(pickiness(1) > pickiness(0.5) && pickiness(0.5) > pickiness(0));
  assert.ok(pickiness(0) < 0.2);
});

test('every regular map has its own fishing spot and rare fish', () => {
  const maps = ['bg-meadow', 'bg-castle', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-volcano', 'bg-rainforest', 'bg-fjord', 'bg-rainbow', 'bg-galaxy'];
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

test('the fjord has its own five fish and the king salmon, herring the most common', async () => {
  const { lookFor } = await import('../js/fishing.js');
  const sp = SPOTS['bg-fjord'];
  assert.equal(sp.name, 'Fjord Harbor');
  const names = Object.keys(SPECIES).map((k) => lookFor('bg-fjord', k).name);
  assert.deepEqual(names, ['Herring', 'Dolly Varden', 'Sockeye salmon', 'Lingcod', 'Halibut']);
  assert.equal(lookFor('bg-fjord', 'special').name, 'King salmon');
  assert.equal(sp.special.id, 'king');
  assert.equal(sp.special.as, 'largemouth');
  assert.ok(Math.max(sp.special.like.jig, sp.special.like.spoon) > sp.special.like.worm, 'kings like jigs and spoons');
  const top = Object.entries(sp.odds).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(top, 'bluegill', 'herring turn up the most');
});

test('better rods see farther, and fish farther out are bigger', () => {
  // Taylor, 2026-11-10: zoom out with each rod; the boat goes farther out; farther = bigger fish
  assert.deepEqual(ROD_ZOOM, [1, 1.4, 1.8]); // Taylor, 2026-11-10: 1.4x and 1.8x
  assert.ok(BOAT_OUT > 0.3 && BOAT_OUT < 1);
  const avg = (out) => 1 / (sizePower(out) + 1); // mean of r ** p for r in 0-1
  assert.ok(avg(0) < avg(0.5) && avg(0.5) < avg(1) && avg(1) < avg(2));
  assert.ok(Math.abs(avg(0.55) - 1 / 2.6) < 0.03, 'a regular rod from the shore: about as big as before');
  assert.ok(avg(2) > 0.5, 'way out with the boat, most fish are big ones');
  // deep water grows trophies past a kind's usual biggest, only out past a regular rod's view
  assert.equal(maxSizeAt(0), 1); assert.equal(maxSizeAt(1), 1);
  assert.ok(maxSizeAt(2) > 1.3 && maxSizeAt(3) === maxSizeAt(10));
  assert.ok(strikeChance(1, 3) > strikeChance(0, 1) * 0.6, 'the biggest still bite with a super rod');
});

test('the boat rows between the shallows and the deep water, slowly', () => {
  // Taylor, 2026-11-27: move the boat slowly side to side, out to deeper water or back in
  assert.ok(BOAT_OUT < DEEP_AT - 1, 'where the boat starts, a cast can\'t reach the deep water');
  assert.ok(BOAT_MAX > DEEP_AT, 'the boat can row out over the deep water');
  const whole = BOAT_MAX / ROW_SPEED; const out = (DEEP_AT - 1 - BOAT_OUT) / ROW_SPEED;
  assert.ok(whole > 10 && whole < 20, `shore to the far end: ${whole.toFixed(1)} s`);
  assert.ok(out > 0.5 && out < 6, `from the start to where the deep water is in reach: ${out.toFixed(1)} s`);
});

test('every lake has a very rare giant in its deep water, with real facts', () => {
  // Taylor, 2026-11-27: a very rare large deep water fish on every map, only by boat
  assert.deepEqual(Object.keys(DEEP_FISH).sort(), Object.keys(SPOTS).sort());
  for (const [map, d] of Object.entries(DEEP_FISH)) {
    assert.equal(SPOTS[map].deep, d);
    assert.match(d.id, /^[a-z]+$/);
    assert.ok(SPECIES[d.as], `${map}: swims like a real kind`);
    for (const b of BAITS) assert.ok(d.like[b] >= 0 && d.like[b] <= 1, `${map} ${b}`);
    assert.ok(Math.max(...BAITS.map((b) => d.like[b])) >= 0.8, `${map}: some bait works well`);
    assert.ok(d.inches[1] > SPECIES[d.as].inches[1], `${map}: longer than its kind ever gets`);
    const base = baseFor(map, 'deep');
    assert.deepEqual(base.len, DEEP_BASE.len); assert.equal(base.inches, d.inches);
    assert.equal(lookFor(map, 'deep').name, d.name);
    const real = realFish(`${map.replace('bg-', '')}-${d.id}`);
    assert.ok(real && real.where && real.eats && real.wow, `${map}: facts for the fish book`);
  }
  assert.ok(POINTS.deep > POINTS.special, 'worth the most');
  // rare: well under half the games with a regular rod, a little more with better rods
  assert.ok(deepChance(1) <= 0.3 && deepChance(1) < deepChance(2) && deepChance(2) < deepChance(3) && deepChance(3) <= 0.5);
});
