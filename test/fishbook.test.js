import test from 'node:test';
import assert from 'node:assert/strict';
import { FISH_SPECIES, FISH_MAPS, speciesId, fishSpecies, catchSpecies, recordCatch, bookCount, bookPages, cleanNickname, makeTank, tankFish, NICK_MAX } from '../js/fishbook.js';
import { SPOTS } from '../js/fishing.js';

test('the fish book has six fish for every lake: five kinds and its rare fish', () => {
  assert.equal(FISH_MAPS.length, Object.keys(SPOTS).length);
  assert.equal(FISH_SPECIES.length, FISH_MAPS.length * 6);
  assert.equal(new Set(FISH_SPECIES.map((s) => s.id)).size, FISH_SPECIES.length, 'ids are unique');
  for (const map of FISH_MAPS) {
    const fish = FISH_SPECIES.filter((s) => s.map === map);
    assert.equal(fish.filter((s) => s.rare).length, 1, map);
    assert.equal(fish.find((s) => s.rare).name, SPOTS[map].special.name);
  }
  // ids are safe as field names (no dots or slashes)
  for (const s of FISH_SPECIES) assert.match(s.id, /^[a-z]+-[a-z]+$/);
  assert.equal(fishSpecies('meadow-trout').name, 'Golden trout');
  assert.equal(fishSpecies('castle-bluegill').name, 'Roach');
  assert.equal(fishSpecies('nope'), null);
});

test('a catch in the game is its map\'s species (a map with no lake fishes at Forest Lake)', () => {
  assert.equal(catchSpecies('bg-ocean', 'sword').id, 'ocean-sword');
  assert.equal(catchSpecies('bg-ocean', 'pike').name, 'Moray eel');
  assert.equal(catchSpecies('bg-somewhere-new', 'bluegill').id, speciesId('bg-meadow', 'bluegill'));
  assert.equal(catchSpecies('bg-meadow', 'nope'), null);
});

test('records keep only the biggest of each species', () => {
  let r = recordCatch(undefined, { species: 'meadow-pike', size: 20, points: 40, map: 'bg-meadow', date: '2026-11-08' });
  assert.ok(r.isNew && r.first);
  assert.deepEqual(r.records, { 'meadow-pike': { size: 20, points: 40, map: 'bg-meadow', date: '2026-11-08' } });
  const first = r.records;
  // smaller: no change, the same object comes back (nothing to save)
  r = recordCatch(first, { species: 'meadow-pike', size: 18, points: 38, date: '2026-11-09' });
  assert.ok(!r.isNew && !r.first);
  assert.equal(r.records, first);
  assert.equal(r.record.size, 20);
  // the same size breaks the tie on points (the exact size)
  r = recordCatch(first, { species: 'meadow-pike', size: 20, points: 40, date: '2026-11-09' });
  assert.ok(!r.isNew, 'a tie keeps the first one');
  r = recordCatch(first, { species: 'meadow-pike', size: 20, points: 41, date: '2026-11-09' });
  assert.ok(r.isNew && !r.first);
  // bigger: the new record, and the old records object isn't changed
  r = recordCatch(first, { species: 'meadow-pike', size: 31, points: 60, date: '2026-11-10' });
  assert.ok(r.isNew && !r.first);
  assert.equal(r.records['meadow-pike'].size, 31);
  assert.equal(first['meadow-pike'].size, 20);
  // another species goes alongside
  r = recordCatch(r.records, { species: 'meadow-trout', size: 15, points: 90, date: '2026-11-10' });
  assert.deepEqual(Object.keys(r.records).sort(), ['meadow-pike', 'meadow-trout']);
  // the map comes from the species, not the caller
  r = recordCatch({}, { species: 'castle-crown', size: 12, points: 60, map: 'bg-ocean' });
  assert.equal(r.records['castle-crown'].map, 'bg-castle');
});

test('bad catches are ignored', () => {
  const recs = { 'meadow-pike': { size: 20, points: 40, map: 'bg-meadow', date: '' } };
  for (const c of [null, {}, { species: 'nope', size: 5 }, { species: 'meadow-pike', size: 0 }, { species: 'meadow-pike', size: 'big' }, { species: 'meadow-pike', size: -3 }]) {
    const r = recordCatch(recs, c);
    assert.equal(r.isNew, false);
    assert.equal(r.records, recs);
  }
});

test('the book: a page per lake, the kid\'s own lake first, uncaught fish blank', () => {
  const recs = { 'ocean-sword': { size: 30, points: 100, map: 'bg-ocean', date: '2026-11-09' }, 'meadow-bluegill': { size: 6, points: 14, map: 'bg-meadow', date: '2026-11-08' } };
  assert.deepEqual(bookCount(recs), { caught: 2, total: FISH_SPECIES.length });
  assert.deepEqual(bookCount(undefined), { caught: 0, total: FISH_SPECIES.length });
  const pages = bookPages(recs, 'bg-ocean');
  assert.equal(pages.length, FISH_MAPS.length);
  assert.equal(pages[0].map, 'bg-ocean');
  assert.equal(pages[0].name, 'Coral Reef');
  assert.equal(pages[0].fish.length, 6);
  assert.equal(pages[0].fish.find((f) => f.id === 'ocean-sword').record.size, 30);
  assert.equal(pages[0].fish.filter((f) => f.record).length, 1);
  assert.equal(bookPages(recs)[0].map, FISH_MAPS[0]);
  assert.equal(bookPages(recs, 'bg-not-a-lake')[0].map, FISH_MAPS[0]);
});

test('nicknames: plain text on one line, trimmed, at most 16 characters', () => {
  assert.equal(cleanNickname('  Bubbles  '), 'Bubbles');
  assert.equal(cleanNickname('Sir\n\tFins   a lot'), 'Sir Fins a lot');
  assert.equal(cleanNickname('A very very long fish name'), 'A very very long');
  assert.equal([...cleanNickname('🐟'.repeat(20))].length, NICK_MAX, 'emoji are not cut in half');
  assert.equal(cleanNickname('a‮b​c'), 'a b c');
  assert.equal(cleanNickname(null), '');
  // it's text, not markup: escaping is up to whoever shows it
  assert.equal(cleanNickname('<b>Nemo</b>'), '<b>Nemo</b>');
});

test('the tank: only a caught fish goes in, and it shows its nickname (or its name)', () => {
  const recs = { 'meadow-trout': { size: 20, points: 120, map: 'bg-meadow', date: '2026-11-09' } };
  assert.equal(makeTank(recs, 'meadow-pike', 'Spike'), null, 'not caught yet');
  assert.equal(makeTank(recs, 'nope', 'X'), null);
  assert.deepEqual(makeTank(recs, 'meadow-trout', '  Goldie '), { species: 'meadow-trout', nickname: 'Goldie' });
  const kid = { fishRecords: recs, tank: makeTank(recs, 'meadow-trout', 'Goldie') };
  const t = tankFish(kid);
  assert.equal(t.nickname, 'Goldie');
  assert.equal(t.name, 'Golden trout');
  assert.ok(t.rare);
  assert.ok(t.len >= 12 && t.len <= 18);
  assert.equal(tankFish({ ...kid, tank: { species: 'meadow-trout', nickname: '' } }).nickname, 'Golden trout');
  assert.equal(tankFish({ fishRecords: {}, tank: kid.tank }), null, 'a fish that is not in the book any more');
  assert.equal(tankFish({ fishRecords: recs }), null, 'an empty tank');
  // a bigger record swims bigger
  const small = tankFish({ fishRecords: { 'meadow-pike': { size: 18 } }, tank: { species: 'meadow-pike' } });
  const big = tankFish({ fishRecords: { 'meadow-pike': { size: 44 } }, tank: { species: 'meadow-pike' } });
  assert.ok(big.len > small.len);
});
