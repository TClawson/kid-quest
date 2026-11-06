import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  chestTier, chestPrize, treasureFound, mapsNeedingPieces, chestReady, TROPHIES, CHEST_TIERS, PIECES_PER_MAP, TREASURE_START,
} from '../js/treasure.js';
import { emptyState, newId, defaultTasks, entryFor, tasksForDay, totalCoins, totalGems, totalXp, gamesLeft } from '../js/logic.js';

const none = { trophies: new Set(), pieces: {}, maps: new Set() };

test('chest tier follows the streak', () => {
  assert.equal(chestTier(1).id, 'wood');
  assert.equal(chestTier(6).id, 'wood');
  assert.equal(chestTier(7).id, 'silver');
  assert.equal(chestTier(20).id, 'silver');
  assert.equal(chestTier(21).id, 'gold');
  assert.equal(chestTier(300).id, 'gold');
});

test('the same kid and day always get the same prize', () => {
  const args = { seed: 'kid_a|2026-11-06', tier: CHEST_TIERS[1], found: none, maps: ['bg-meadow'] };
  assert.deepEqual(chestPrize(args), chestPrize(args));
});

test('wooden chests never hold map pieces; silver and gold sometimes do', () => {
  const count = (tier) => {
    let n = 0;
    for (let i = 0; i < 2000; i += 1) if (chestPrize({ seed: `k|${i}`, tier, found: none, maps: ['bg-meadow'] }).kind === 'piece') n += 1;
    return n / 2000;
  };
  assert.equal(count(CHEST_TIERS[0]), 0);
  const silver = count(CHEST_TIERS[1]);
  const gold = count(CHEST_TIERS[2]);
  assert.ok(silver > 0.06 && silver < 0.14, `silver ${silver}`);
  assert.ok(gold > 0.15 && gold < 0.25, `gold ${gold}`);
});

test('no pieces once every unlocked map is finished', () => {
  for (let i = 0; i < 500; i += 1) {
    assert.notEqual(chestPrize({ seed: `k|${i}`, tier: CHEST_TIERS[2], found: none, maps: [] }).kind, 'piece');
  }
});

test('no extra games when they are no use', () => {
  for (let i = 0; i < 500; i += 1) {
    assert.notEqual(chestPrize({ seed: `k|${i}`, tier: CHEST_TIERS[0], found: none, games: false }).kind, 'games');
  }
});

test('a trophy the kid has already turns into coins', () => {
  const all = { ...none, trophies: new Set(TROPHIES.map((t) => t.id)) };
  let seen = 0;
  for (let i = 0; i < 300; i += 1) {
    const p = chestPrize({ seed: `k|${i}`, tier: CHEST_TIERS[1], found: all });
    if (p.kind !== 'trophy') continue;
    seen += 1;
    assert.equal(p.dupe, true);
    assert.equal(p.coins, CHEST_TIERS[1].coins);
  }
  assert.ok(seen > 0);
});

test('pieces go to the current map first, then other unlocked maps that are not finished', () => {
  const found = { ...none, maps: new Set(['bg-sunset']) };
  assert.deepEqual(mapsNeedingPieces(['bg-meadow', 'bg-sunset', 'bg-ocean'], 'bg-ocean', found), ['bg-ocean', 'bg-meadow']);
  assert.deepEqual(mapsNeedingPieces(['bg-meadow', 'bg-sunset'], 'bg-sunset', found), ['bg-meadow']);
  assert.deepEqual(mapsNeedingPieces(['bg-sunset'], 'bg-sunset', found), []);
});

test('found treasure is worked out from the opened chests', () => {
  const log = {};
  const put = (date, chest) => { (log[date] ||= {}).k = { tasks: {}, chest }; };
  put('2026-11-05', { kind: 'trophy', trophy: 'crab' });
  put('2026-11-06', { kind: 'trophy', trophy: 'crab', dupe: true, coins: 5 });
  for (let i = 0; i < PIECES_PER_MAP; i += 1) put(`2026-11-1${i}`, { kind: 'piece', map: 'bg-meadow' });
  put('2026-11-20', { kind: 'piece', map: 'bg-ocean' });
  const f = treasureFound(log, 'k');
  assert.deepEqual([...f.trophies], ['crab']);
  assert.deepEqual(f.pieces, { 'bg-meadow': PIECES_PER_MAP, 'bg-ocean': 1 });
  assert.deepEqual([...f.maps], ['bg-meadow']);
});

test('a chest can be opened on its day or up to two days late, never before the chest existed', () => {
  const done = { complete: true, total: 5, excused: false, opened: false };
  assert.equal(chestReady('2026-11-10', '2026-11-10', done), true);
  assert.equal(chestReady('2026-11-08', '2026-11-10', done), true);
  assert.equal(chestReady('2026-11-07', '2026-11-10', done), false);
  assert.equal(chestReady('2026-11-10', '2026-11-10', { ...done, opened: true }), false);
  assert.equal(chestReady('2026-11-10', '2026-11-10', { ...done, complete: false }), false);
  assert.equal(chestReady('2026-11-10', '2026-11-10', { ...done, total: 0 }), false);
  assert.equal(chestReady('2026-11-10', '2026-11-10', { ...done, excused: true }), false);
  const before = '2026-11-04';
  assert.ok(before < TREASURE_START);
  assert.equal(chestReady(before, '2026-11-05', done), false);
});

test('chest coins and gems count, but give no XP; chest games add to the day', () => {
  const state = emptyState();
  const kid = { id: newId('kid'), name: 'T', tasks: defaultTasks(), startDate: '2026-11-02' };
  state.kids.push(kid);
  const key = '2026-11-06';
  const entry = entryFor(state, kid.id, key, true);
  const xp0 = totalXp(state, kid, key);
  entry.chest = { kind: 'coins', coins: 10, tier: 'silver' };
  assert.equal(totalCoins(state, kid, key), 10);
  entry.chest = { kind: 'gems', gems: 5, tier: 'silver' };
  assert.equal(totalGems(state, kid, key), 5);
  assert.equal(totalCoins(state, kid, key), 0);
  assert.equal(totalXp(state, kid, key), xp0);
  assert.equal(gamesLeft({ playLog: { day: key, n: 4 } }, key, 0, 2), 2);
  assert.ok(tasksForDay(state, kid, key, key).length > 0);
});
