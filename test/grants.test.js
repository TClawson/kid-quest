import test from 'node:test';
import assert from 'node:assert/strict';
import { applyGrants, GRANTS } from '../js/grants.js';
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
