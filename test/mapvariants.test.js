import test from 'node:test';
import assert from 'node:assert/strict';
import { SOCCER_TWISTS, HOCKEY_TWISTS, FOOTBALL_TWISTS, FISHING_EVENTS, twistFor } from '../js/mapplay.js';
import { FANS, fansOn, pickFan, recordFan, fanCount, FAN_PITY, FanWatch, FAN_STAY } from '../js/fans.js';
import { rng } from '../js/play.js';

const MAPS = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainforest', 'bg-fjord', 'bg-rainbow', 'bg-galaxy'];

test('every map has its own twist in keepy-uppy, hockey and football, and a lake event', () => {
  for (const table of [SOCCER_TWISTS, HOCKEY_TWISTS, FOOTBALL_TWISTS, FISHING_EVENTS]) {
    assert.deepEqual(Object.keys(table).sort(), [...MAPS].sort());
    const names = MAPS.map((m) => table[m].name);
    for (const m of MAPS) assert.ok(table[m].name && (table[m].tip || table[m].warn), `${m} says what its twist is`);
    assert.ok(new Set(names).size >= 9, 'the twists are (nearly) all different');
  }
  assert.equal(twistFor(HOCKEY_TWISTS, 'bg-nowhere'), HOCKEY_TWISTS['bg-meadow']);
});

test('twists stay small: no map makes a game much easier or harder', () => {
  for (const m of MAPS) {
    const s = SOCCER_TWISTS[m]; const f = FOOTBALL_TWISTS[m];
    if (s.beat) assert.ok(s.beat >= 0.8 && s.beat <= 1.25);
    if (f.hang) assert.ok(f.hang <= 1.25);
    if (f.slow) assert.ok(f.slow >= 0.8, 'slow ground is counted in the wait, and never by much');
  }
});

test('three fans on every map: one common, one uncommon, one rare, each with a fact', () => {
  assert.equal(FANS.length, 30);
  assert.equal(new Set(FANS.map((f) => f.id)).size, 30);
  for (const m of MAPS) {
    const list = fansOn(m);
    assert.deepEqual(list.map((f) => f.rarity).sort(), ['common', 'rare', 'uncommon']);
    for (const f of list) assert.ok(f.fact.length > 40 && f.look?.plan, f.id);
  }
});

test('which fan comes: mostly common, sometimes rare, and the rare one for sure after a long dry spell', () => {
  const r = rng(4); const n = { common: 0, uncommon: 0, rare: 0 };
  for (let i = 0; i < 3000; i += 1) n[pickFan('bg-fjord', r).rarity] += 1;
  assert.ok(n.common > n.uncommon && n.uncommon > n.rare && n.rare > 150, JSON.stringify(n));
  assert.equal(pickFan('bg-fjord', () => 0, FAN_PITY).rarity, 'rare');
});

test('a cheer adds a fan, then counts', () => {
  let got = recordFan({}, 'fan-otter', '2026-11-22');
  assert.equal(got.first, true);
  got = recordFan(got.fans, 'fan-otter', '2026-11-23');
  assert.equal(got.first, false);
  assert.deepEqual(got.fans['fan-otter'], { n: 2, first: '2026-11-22', last: '2026-11-23' });
  assert.deepEqual(fanCount(got.fans), { got: 1, total: 30 });
});

test('a fan comes during play, cheers once for something great, then leaves', () => {
  const seen = []; const cheers = [];
  const w = new FanWatch({ map: 'bg-castle', r: rng(9), onSeen: (f) => seen.push(f.id), onFan: (f) => { cheers.push(f.id); return 'new'; } });
  for (let i = 0; i < 30 * 20; i += 1) w.step(1 / 30, false);
  assert.equal(w.fan, null, 'nobody comes while the game is not being played');
  while (!w.watching) w.step(1 / 30, true);
  assert.equal(seen.length, 1);
  assert.match(w.great(), /New fan/);
  assert.equal(w.great(), null, 'one cheer a visit');
  for (let i = 0; i < 30 * FAN_STAY; i += 1) w.step(1 / 30, true);
  assert.equal(w.fan, null, 'then it goes');
  assert.deepEqual(cheers, seen);
});
