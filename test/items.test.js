import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, SLOTS, isUnlocked, newUnlocks, restingMood, speciesFromEmoji, itemById, unlockedMoves, bestGear, pickMove, MOVES, needLabel } from '../js/items.js';

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

test('puppy and turtle need their own accessories too', async () => {
  const { switchSpecies, ownedFor, addOwned } = await import('../js/items.js');
  const kid = { owned: [], buddyOwned: { fox: ['hat-cap'] }, buddy: { species: 'fox', outfit: { hat: 'hat-cap' } } };
  const unlocked = (item, sp) => isUnlocked(item, { best: 0, owned: ownedFor(kid, sp) });
  switchSpecies(kid, 'puppy', unlocked);
  assert.deepEqual(kid.buddy.outfit, {});
  addOwned(kid, itemById('hat-cap'));
  switchSpecies(kid, 'turtle', unlocked);
  assert.equal(unlocked(itemById('hat-cap'), 'turtle'), false);
  assert.deepEqual(kid.buddyOwned, { fox: ['hat-cap'], puppy: ['hat-cap'] });
});

test('puppy and turtle are their own buddies and wear every item', async () => {
  const { buddySvg } = await import('../js/avatar.js');
  const { SPECIES } = await import('../js/items.js');
  for (const id of ['puppy', 'turtle']) assert.ok(SPECIES.some((s) => s.id === id), `${id} can be picked`);
  assert.equal(speciesFromEmoji('🐶'), 'puppy');
  assert.equal(speciesFromEmoji('🐢'), 'turtle');
  const draw = (species, outfit = {}) => buddySvg({ species, outfit }, 'happy', { background: false });
  const looks = SPECIES.map((s) => draw(s.id));
  assert.equal(new Set(looks).size, looks.length, 'every species looks different');
  for (const species of ['puppy', 'turtle']) {
    for (const item of ITEMS.filter((i) => ['hat', 'face', 'neck', 'music'].includes(i.slot) && (!i.species || i.species === species))) {
      assert.notEqual(draw(species, { [item.slot]: item.id }), draw(species), `${species} wears ${item.id}`);
    }
  }
});

test('buddy specials: one per buddy, 1000 coins, only for their own buddy', async () => {
  const { buddySvg } = await import('../js/avatar.js');
  const { SPECIES, fitsSpecies, LEGACY_LEVEL, switchSpecies, ownedFor, addOwned, isWorn } = await import('../js/items.js');
  const specials = ITEMS.filter((i) => i.species);
  assert.deepEqual(specials.map((i) => i.species).sort(), SPECIES.map((s) => s.id).sort(), 'one special for every buddy');
  const draw = (species, outfit = {}) => buddySvg({ species, outfit }, 'happy', { background: false });
  for (const item of specials) {
    assert.equal(item.price, 1000);
    assert.equal(isWorn(item), true, `${item.id} is worn, so it belongs to the buddy`);
    assert.equal(LEGACY_LEVEL(item), Infinity, 'never handed out as an old level item');
    assert.equal(fitsSpecies(item, item.species), true);
    for (const sp of SPECIES.filter((s) => s.id !== item.species)) {
      assert.equal(fitsSpecies(item, sp.id), false);
      assert.equal(draw(sp.id, { [item.slot]: item.id }), draw(sp.id), `${sp.id} never shows ${item.id}`);
    }
    assert.notEqual(draw(item.species, { [item.slot]: item.id }), draw(item.species), `${item.species} wears ${item.id}`);
  }
  // a stale special in another buddy's closet doesn't come back on the wrong buddy
  const kid = { owned: [], buddy: { species: 'panda', outfit: {} } };
  addOwned(kid, itemById('neck-bamboo'));
  kid.buddy.outfit.neck = 'neck-bamboo';
  kid.buddy.closet = { bear: { neck: 'neck-bamboo' } };
  const unlocked = (item, sp) => fitsSpecies(item, sp) && isUnlocked(item, { best: 0, owned: [...ownedFor(kid, sp), 'neck-bamboo'] });
  switchSpecies(kid, 'bear', unlocked);
  assert.equal(kid.buddy.outfit.neck, undefined);
  switchSpecies(kid, 'panda', unlocked);
  assert.equal(kid.buddy.outfit.neck, 'neck-bamboo', 'the panda gets its bamboo back');
});

test('the panda’s bamboo leans on the side away from held gear', async () => {
  const { buddySvg } = await import('../js/avatar.js');
  const draw = (sport) => buddySvg({ species: 'panda', outfit: { neck: 'neck-bamboo', sport } }, 'happy', { background: false });
  const xs = (svg) => [...svg.matchAll(/x="(\d+)"[^>]*fill="#69b34c"/g)].map((m) => Number(m[1]));
  assert.ok(Math.min(...xs(draw())) >= 12, 'on the right with no gear');
  assert.ok(Math.min(...xs(draw('sport-soccer-regular'))) >= 12, 'on the right when the ball is on the left');
  assert.ok(Math.max(...xs(draw('sport-rod-regular'))) <= 12, 'on the left when the rod is on the right');
});

test('sports gear: 5 kinds in 3 versions plus the fishing boat, bought with gems only', () => {
  const gear = ITEMS.filter((i) => i.slot === 'sport');
  assert.equal(gear.length, 16);
  const boat = itemById('sport-boat');
  assert.equal(boat.gems, 100);
  assert.ok(boat.noHold, 'the boat stays at the lake');
  assert.deepEqual(bestGear(['sport-rod-good', 'sport-boat']), { rod: 2, boat: 1 });
  const rod = itemById('sport-rod-good');
  assert.equal(rod.gems, 120);
  assert.equal(rod.price, undefined);
  assert.equal(needLabel(rod), '120 gems');
  assert.equal(isUnlocked(rod, { owned: [] }), false);
  assert.equal(isUnlocked(rod, { owned: ['sport-rod-good'] }), true);
  assert.deepEqual(bestGear(['sport-rod-regular', 'sport-rod-super', 'hat-cap', 'sport-soccer-good']), { rod: 3, soccer: 2 });
});

test('moves unlock at 1, 3 and 6 exercise weeks, for gear the kid owns', () => {
  const ids = (owned, weeks) => unlockedMoves(owned, weeks).map((m) => m.move.id);
  assert.deepEqual(ids([], 0), []);
  assert.deepEqual(ids([], 1), ['jacks']);
  assert.deepEqual(ids(['sport-soccer-regular'], 3), ['jacks', 'cartwheel', 'keepy', 'flick']);
  assert.equal(ids(['sport-soccer-regular', 'sport-rod-super'], 6).length, 9);
  assert.equal(unlockedMoves(['sport-rod-super'], 6).find((m) => m.move.kind === 'rod').tier, 3);
  assert.equal(MOVES.length, 18);
  const two = unlockedMoves([], 3);
  assert.equal(pickMove(two, 'jacks').move.id, 'cartwheel');
  assert.equal(pickMove([], null), null);
});

test('every Places background has a map, a fishing spot and a hidden spot', async () => {
  const { MAP_THEMES } = await import('../js/maparts.js');
  const { SPOTS } = await import('../js/fishing.js');
  const { SECRETS } = await import('../js/treasure-art.js');
  const bgs = ITEMS.filter((i) => i.slot === 'background').map((i) => i.id);
  assert.deepEqual([...bgs].sort(), Object.keys(MAP_THEMES).sort());
  for (const id of bgs) {
    assert.ok(SPOTS[id], `${id}: fishing spot`);
    assert.ok(SECRETS[id], `${id}: hidden spot`);
  }
  assert.equal(itemById('bg-fjord').price, 500);
  assert.equal(MAP_THEMES['bg-fjord'].life, 'fjord');
});

test('the fjord is on show but not for sale until its music is written', async () => {
  const { comingSoon } = await import('../js/items.js');
  assert.equal(comingSoon(itemById('bg-fjord')), true);
  assert.deepEqual(ITEMS.filter(comingSoon).map((i) => i.id), ['bg-fjord']);
  assert.equal(isUnlocked(itemById('bg-fjord'), { owned: [], coins: 9999 }), false);
});
