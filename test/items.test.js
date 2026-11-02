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

test('streak items unlock by best streak, shop items only when bought', () => {
  assert.equal(isUnlocked(itemById('hat-crown'), { best: 29, level: 50, owned: [] }), false);
  assert.equal(isUnlocked(itemById('hat-crown'), { best: 30, level: 1, owned: [] }), true);
  assert.equal(isUnlocked(itemById('hat-cap'), { best: 0, level: 99, owned: [] }), false);
  assert.equal(isUnlocked(itemById('hat-cap'), { best: 0, level: 1, owned: ['hat-cap'] }), true);
  assert.equal(isUnlocked(itemById('bg-meadow'), { best: 0, level: 1, owned: [] }), true);
  assert.ok(ITEMS.every((i) => !(i.price && i.need)), 'an item is either bought or earned');
  assert.ok(ITEMS.filter((i) => i.slot === 'music').every((i) => i.need && !i.price), 'pianos are earned, not bought');
});

test('newUnlocks only reports unseen earned items, never shop items', () => {
  const kid = { seenUnlocks: ['neck-bowtie'] };
  const ids = newUnlocks(kid, { best: 3, level: 2, owned: ['hat-cap'] });
  assert.deepEqual(ids, ['bg-sunset']);
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

test('color versions are cheap shop items, listed after the item they recolor', async () => {
  const { COLOR_VERSIONS, LEGACY_LEVEL } = await import('../js/items.js');
  for (const [baseId, cv] of Object.entries(COLOR_VERSIONS)) {
    const base = itemById(baseId);
    const at = ITEMS.indexOf(base);
    cv.colors.forEach((color, n) => {
      const item = ITEMS[at + 1 + n];
      assert.equal(item.id, `${baseId}-${color}`);
      assert.equal(item.slot, base.slot);
      assert.ok(item.price > 0 && item.price <= 120, item.id);
      assert.ok(!item.need, item.id);
      assert.equal(LEGACY_LEVEL(item), Infinity, 'never handed out as an old level item');
      assert.equal(isUnlocked(item, { best: 999, owned: [base.id] }), false, 'owning one color does not unlock another');
      assert.equal(isUnlocked(item, { best: 0, owned: [item.id] }), true);
    });
  }
  assert.equal(itemById('hat-cap-blue').name, 'Blue ball cap');
  assert.equal(itemById('neck-bowtie-pink').price, 30);
});

test('every color version draws in its own color', async () => {
  const { buddySvg } = await import('../js/avatar.js');
  const draw = (item) => buddySvg({ species: 'bear', outfit: { [item.slot]: item.id } }, 'happy', { background: false });
  const plain = buddySvg({ species: 'bear', outfit: {} }, 'happy', { background: false });
  for (const item of ITEMS.filter((i) => i.base)) {
    const svg = draw(item);
    assert.notEqual(svg, plain, `${item.id} draws something`);
    assert.notEqual(svg, draw(itemById(item.base)), `${item.id} differs from ${item.base}`);
  }
  const all = ITEMS.filter((i) => i.base).map(draw);
  assert.equal(new Set(all).size, all.length, 'no two colors look the same');
});

test('bought hats, glasses and extras belong to one buddy; places and prizes are shared', async () => {
  const { ownedFor, addOwned, isWorn } = await import('../js/items.js');
  const kid = { owned: [], buddy: { species: 'fox', outfit: {} } };
  addOwned(kid, itemById('hat-cap'));
  addOwned(kid, itemById('bg-ocean'));
  assert.deepEqual(kid.owned, ['bg-ocean']);
  assert.deepEqual(kid.buddyOwned, { fox: ['hat-cap'] });
  const asFox = { best: 30, owned: ownedFor(kid, 'fox') };
  const asBear = { best: 30, owned: ownedFor(kid, 'bear') };
  assert.equal(isUnlocked(itemById('hat-cap'), asFox), true);
  assert.equal(isUnlocked(itemById('hat-cap'), asBear), false, 'the bear needs its own cap');
  assert.equal(isUnlocked(itemById('bg-ocean'), asBear), true, 'places work with every buddy');
  assert.equal(isUnlocked(itemById('hat-crown'), asBear), true, 'streak prizes work with every buddy');
  assert.equal(isWorn(itemById('music-keyboard')), false);
  assert.equal(isWorn(itemById('face-round-gold')), true);
});

test('worn items a kid already owned move to the buddy they use now', async () => {
  const { moveWornToBuddy } = await import('../js/items.js');
  const kid = { owned: ['hat-cap', 'hat-cap-blue', 'bg-ocean'], buddy: { species: 'panda', outfit: {} } };
  assert.equal(moveWornToBuddy(kid), true);
  assert.deepEqual(kid.owned, ['bg-ocean']);
  assert.deepEqual(kid.buddyOwned, { panda: ['hat-cap', 'hat-cap-blue'] });
  assert.equal(moveWornToBuddy(kid), false, 'running it again changes nothing');
});

test('switching buddies keeps each buddy’s outfit and the shared place', async () => {
  const { switchSpecies, ownedFor } = await import('../js/items.js');
  const kid = { owned: ['bg-ocean'], buddyOwned: { fox: ['hat-cap'] }, buddy: { species: 'fox', outfit: { background: 'bg-ocean', hat: 'hat-cap', face: 'face-sun', music: 'music-keyboard' } } };
  const unlocked = (item, sp) => isUnlocked(item, { best: 7, pianoBest: 99, owned: ownedFor(kid, sp) });
  switchSpecies(kid, 'bear', unlocked);
  assert.deepEqual(kid.buddy.outfit, { background: 'bg-ocean', music: 'music-keyboard' });
  kid.buddy.outfit.face = 'face-sun';
  switchSpecies(kid, 'fox', unlocked);
  assert.deepEqual(kid.buddy.outfit, { background: 'bg-ocean', music: 'music-keyboard', hat: 'hat-cap', face: 'face-sun' });
  switchSpecies(kid, 'bear', unlocked);
  assert.equal(kid.buddy.outfit.face, 'face-sun', 'the bear remembers its sunglasses');
});
