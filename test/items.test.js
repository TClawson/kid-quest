import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SLOTS, isUnlocked, newUnlocks, restingMood, speciesFromEmoji, itemById } from '../js/items.js';

test('every item has a known slot and unique id', () => {
  const slots = new Set(SLOTS.map((s) => s.id));
  const ids = new Set();
  for (const i of ITEMS) {
    assert.ok(slots.has(i.slot), i.id);
    assert.ok(!ids.has(i.id), i.id);
    ids.add(i.id);
  }
});

test('unlocks use best streak and level', () => {
  assert.equal(isUnlocked(itemById('hat-crown'), { best: 29, level: 50 }), false);
  assert.equal(isUnlocked(itemById('hat-crown'), { best: 30, level: 1 }), true);
  assert.equal(isUnlocked(itemById('hat-cap'), { best: 0, level: 2 }), true);
  assert.equal(isUnlocked(itemById('bg-meadow'), { best: 0, level: 1 }), true);
});

test('newUnlocks only reports unseen earned items', () => {
  const kid = { seenUnlocks: ['neck-bowtie'] };
  const ids = newUnlocks(kid, { best: 3, level: 2 });
  assert.deepEqual(ids.sort(), ['bg-sunset', 'hat-cap'].sort());
});

test('resting mood', () => {
  assert.equal(restingMood({ todayDone: 5, todayComplete: true, missedYesterday: true }), 'proud');
  assert.equal(restingMood({ todayDone: 0, todayComplete: false, missedYesterday: true }), 'sad');
  assert.equal(restingMood({ todayDone: 0, todayComplete: false, missedYesterday: false }), 'sleepy');
  assert.equal(restingMood({ todayDone: 2, todayComplete: false, missedYesterday: true }), 'happy');
  assert.equal(speciesFromEmoji('🦊'), 'fox');
  assert.equal(speciesFromEmoji('🐸'), 'bear');
});

test('piano items need weeks of piano days in a row', () => {
  const keys = itemById('music-keyboard');
  const rock = itemById('music-rock');
  assert.equal(isUnlocked(keys, { best: 0, level: 1, pianoBest: 9, pianoPerWeek: 5 }), false);
  assert.equal(isUnlocked(keys, { best: 0, level: 1, pianoBest: 10, pianoPerWeek: 5 }), true);
  assert.equal(isUnlocked(rock, { best: 99, level: 99, pianoBest: 29, pianoPerWeek: 5 }), false);
  assert.equal(isUnlocked(rock, { best: 0, level: 1, pianoBest: 18, pianoPerWeek: 3 }), true);
});
