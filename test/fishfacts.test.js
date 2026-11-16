import test from 'node:test';
import assert from 'node:assert/strict';
import { REAL_FISH, realFish, weightFor, sizeClass, fmtWeight, weightRanges, CLASSES } from '../js/fishfacts.js';
import { FISH_SPECIES, recordCatch, recordLb, recordClass, sizeFromInches, fishSpecies } from '../js/fishbook.js';

test('every fish in the book has a real fish (or a real cousin) with facts and weights', () => {
  for (const s of FISH_SPECIES) {
    const r = realFish(s.id);
    assert.ok(r, s.id);
    for (const k of ['name', 'where', 'eats', 'wow']) assert.ok(r[k] && r[k].length > 10 || k === 'name', `${s.id} ${k}`);
    assert.equal(r.w.length, 5, s.id);
    for (let i = 1; i < 5; i += 1) assert.ok(r.w[i] > r.w[i - 1], `${s.id} weights go up`);
  }
  // the six real-fish maps are real; the four made-up maps are pretend
  assert.equal(realFish('meadow-bluegill').pretend, false);
  assert.equal(realFish('fjord-catfish').name, 'Pacific halibut');
  assert.equal(realFish('space-bluegill').pretend, true);
  assert.equal(realFish('space-bluegill').key, 'bluegill');
  assert.equal(realFish('space-moon').key, 'opah');
  assert.equal(realFish('rainbow-unicorn').key, 'unicornfish');
  assert.equal(realFish('volcano-dragon').key, 'pike');
  assert.equal(realFish('nope'), null);
  // every real fish is used
  const used = new Set(FISH_SPECIES.map((s) => realFish(s.id).key));
  for (const k of Object.keys(REAL_FISH)) assert.ok(used.has(k), k);
});

test('a fish weighs its real kind\'s weight for its size in the game', () => {
  const w = REAL_FISH.largemouth.w;
  assert.equal(weightFor('meadow-largemouth', 0), w[0]);
  assert.equal(weightFor('meadow-largemouth', 0.4), w[2]);
  assert.equal(weightFor('meadow-largemouth', 0.85), w[3]);
  assert.equal(weightFor('meadow-largemouth', 1.6), w[4]);
  assert.equal(weightFor('meadow-largemouth', 9), w[4]);
  let last = 0;
  for (let s = 0; s <= 1.6; s += 0.01) { const lb = weightFor('ocean-sword', s); assert.ok(lb >= last); last = lb; }
  assert.equal(sizeClass('meadow-largemouth', 0.5), 'small');
  assert.equal(sizeClass('meadow-largemouth', 2.5), 'typical');
  assert.equal(sizeClass('meadow-largemouth', 8), 'trophy');
  assert.equal(sizeClass('meadow-largemouth', 0), null);
  for (const c of Object.values(CLASSES)) assert.ok(c.icon && c.name);
});

test('weights read like a kid reads them', () => {
  assert.equal(fmtWeight(0.25), '4 oz');
  assert.equal(fmtWeight(0.01), '1 oz');
  assert.equal(fmtWeight(2.44), '2.4 lb');
  assert.equal(fmtWeight(35.4), '35 lb');
  assert.equal(fmtWeight(1100), '1,100 lb');
  assert.deepEqual(weightRanges('meadow-bluegill'), { small: '3 oz', typical: '6 oz', trophy: '1 lb', w: REAL_FISH.bluegill.w });
});

test('old records in inches get their pounds, and still compare with new ones', () => {
  const sp = fishSpecies('meadow-pike');
  const old = { size: 31, points: 60, map: 'bg-meadow', date: '2026-11-09' }; // from before pounds: no lb
  const lb = recordLb('meadow-pike', old);
  assert.equal(lb, weightFor('meadow-pike', sizeFromInches(sp, 31)));
  assert.ok(lb > 0);
  assert.equal(recordClass('meadow-pike', old), sizeClass('meadow-pike', lb));
  const recs = { 'meadow-pike': old };
  // a lighter new catch doesn't beat the old record
  let r = recordCatch(recs, { species: 'meadow-pike', size: 30, lb: lb - 1, points: 58, date: '2026-11-16' });
  assert.ok(!r.isNew);
  assert.equal(r.records, recs, 'nothing changed');
  // a heavier one does, and keeps both its inches and pounds
  r = recordCatch(recs, { species: 'meadow-pike', size: 33, lb: lb + 1, points: 62, date: '2026-11-16' });
  assert.ok(r.isNew && !r.first);
  assert.deepEqual(r.records['meadow-pike'], { size: 33, points: 62, map: 'bg-meadow', date: '2026-11-16', lb: lb + 1 });
  // an older copy of the app sends only inches: it still gets pounds
  r = recordCatch({}, { species: 'meadow-pike', size: 40, points: 70 });
  assert.equal(r.records['meadow-pike'].lb, weightFor('meadow-pike', sizeFromInches(sp, 40)));
});
