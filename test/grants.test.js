import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGrants, GRANTS, restoreFromRecord, restoreBackup, RESTORE_ID } from '../js/grants.js';
import { itemById } from '../js/items.js';

const G = [{ id: 'g1', kid: 'kid_a', item: 'home-chair-bean-blue-plain' }];
const fam = (kid) => ({ kids: [{ id: 'kid_a', owned: ['bg-ocean'], ...kid }, { id: 'kid_b', owned: [] }] });

test('a grant gives the item once and puts furniture in its empty spot', () => {
  const s = fam({ home: { art: 'home-art-sunset' } });
  assert.equal(applyGrants(s, G), true);
  const a = s.kids[0];
  assert.deepEqual(a.owned, ['bg-ocean', 'home-chair-bean-blue-plain']);
  assert.deepEqual(a.home, { art: 'home-art-sunset', chair: 'home-chair-bean-blue-plain' });
  assert.deepEqual(a.grants, ['g1']);
  assert.deepEqual(s.kids[1].owned, [], 'other kids untouched');
  assert.equal(applyGrants(s, G), false, 'never twice');
  assert.deepEqual(a.owned, ['bg-ocean', 'home-chair-bean-blue-plain']);
});

test('a grant leaves a filled spot alone and does not double an owned item', () => {
  const s = fam({ owned: ['home-chair-bean-blue-plain'], home: { chair: 'home-chair-cozy' } });
  applyGrants(s, G);
  assert.deepEqual(s.kids[0].owned, ['home-chair-bean-blue-plain']);
  assert.equal(s.kids[0].home.chair, 'home-chair-cozy');
});

test('a grant for a kid not on this device does nothing', () => {
  const s = { kids: [{ id: 'kid_z', owned: [] }] };
  assert.equal(applyGrants(s, G), false);
});

test('every real grant names a shop item', () => {
  for (const g of GRANTS) assert.ok(itemById(g.item), g.item);
});

test('restoreFromRecord gives back bought things the kid still wears, keeps or has placed', () => {
  // like Ayden, Remington and Edison after the wipe of 2026-11-10
  const kid = {
    owned: ['bg-rainforest'],
    buddyOwned: { fox: ['hat-cap'] },
    buddy: { species: 'fox', outfit: { background: 'bg-sunset', sport: 'sport-rod-regular', hat: 'hat-cowboy', face: 'face-round' }, closet: { cat: { hat: 'hat-beanie' } } },
    home: { chair: 'home-chair-bean-blue-plain' },
  };
  assert.equal(restoreFromRecord(kid), true);
  // streak prizes (sunset, cowboy hat) aren't bought, so they stay out of the lists
  assert.deepEqual(kid.owned, ['bg-rainforest', 'sport-rod-regular', 'home-chair-bean-blue-plain']);
  assert.deepEqual(kid.buddyOwned, { fox: ['hat-cap', 'face-round'], cat: ['hat-beanie'] });
  assert.equal(restoreFromRecord(kid), false, 'nothing more the second time');
});

test('restoreBackup puts back the Nov 8 lists once and charges what was spent then plus since', () => {
  const backup = { k: { owned: ['bg-volcano', 'sport-rod-regular'], buddyOwned: { fox: ['hat-cap', 'hat-cap-green'] }, spent: 300 } };
  // after the wipe: lists back to early November, then the rainforest bought again
  const kid = { id: 'k', owned: ['bg-rainforest'], buddyOwned: { fox: ['hat-cap'] }, spent: 300, grants: ['g0'] };
  assert.equal(restoreBackup(kid, backup), true);
  assert.deepEqual(kid.owned, ['bg-rainforest', 'bg-volcano', 'sport-rod-regular']);
  assert.deepEqual(kid.buddyOwned, { fox: ['hat-cap', 'hat-cap-green'] });
  assert.equal(kid.spent, 600, 'Nov 8 spending plus the rainforest');
  assert.deepEqual(kid.grants, ['g0', RESTORE_ID]);
  assert.equal(restoreBackup(kid, backup), false, 'only once');
  assert.equal(restoreBackup({ id: 'other', owned: [] }, backup), false);
});

test('the real Nov 8 restore covers all four kids', () => {
  const ids = ['kid_mvymcmw11jnn8', 'kid_mvymmw0y1kmwx', 'kid_mvyopilp1bgqr', 'kid_mvzflap11wbyq'];
  for (const id of ids) assert.equal(restoreBackup({ id, owned: [] }), true, id);
  const ayden = { id: ids[0], owned: ['bg-rainforest'], spent: 300 };
  restoreBackup(ayden, undefined, 528);
  assert.ok(ayden.owned.includes('bg-volcano'));
  assert.equal(ayden.spent, 528, 'he keeps both maps without owing coins');
});
