import test from 'node:test';
import assert from 'node:assert/strict';
import { gameFor, levelObstacles, rng } from '../js/play.js';
import { needle, zoneAt, SHOT_ODDS, STEAL_ODDS } from '../js/hockey.js';
import { gamesPerDay, gamesLeft } from '../js/logic.js';

test('visitors play their ball game, the same one all day, or tag', () => {
  assert.equal(gameFor({}), 'tag');
  assert.equal(gameFor({ shoes: 2, rod: 1 }), 'tag');
  assert.equal(gameFor({ soccer: 1 }), 'soccer');
  assert.equal(gameFor({ hockey: 3 }), 'hockey');
  const both = { soccer: 1, hockey: 1 };
  assert.equal(gameFor(both, '2026-11-04|kid_a'), gameFor(both, '2026-11-04|kid_a'));
  const picks = new Set(Array.from({ length: 30 }, (_, i) => gameFor(both, `2026-11-${i}|kid_a`)));
  assert.deepEqual([...picks].sort(), ['hockey', 'soccer']);
});

test('tag levels add an obstacle each level; from level 4 they start moving', () => {
  const r = rng(3);
  for (let level = 1; level <= 7; level += 1) {
    const obs = levelObstacles(level, 0, 213, 48, 116, r);
    assert.equal(obs.length, level, `level ${level}`);
    assert.equal(obs.filter((o) => o.move).length, Math.max(0, level - 3));
  }
});

test('the hockey meter sweeps back and forth over red, yellow and a thin green', () => {
  assert.equal(needle(0), 0);
  assert.ok(Math.abs(needle(0.325) - 0.5) < 1e-9);
  assert.ok(Math.abs(needle(0.65) - 1) < 1e-9);
  assert.ok(Math.abs(needle(0.975) - 0.5) < 1e-9);
  assert.equal(zoneAt(0.5), 'green');
  assert.equal(zoneAt(0.6), 'yellow');
  assert.equal(zoneAt(0.05), 'red');
  // a better stick widens green a little
  assert.equal(zoneAt(0.545, 1), 'yellow');
  assert.equal(zoneAt(0.545, 3), 'green');
  assert.deepEqual(SHOT_ODDS, { red: 0.15, yellow: 0.4, green: 0.75 });
  for (const odds of Object.values(STEAL_ODDS)) assert.ok(Math.abs(odds.reduce((a, b) => a + b) - 1) < 1e-9);
});

test('8 games a day, plus 2 for each exercise-streak week up to 3', () => {
  assert.deepEqual([0, 1, 2, 3, 5].map(gamesPerDay), [8, 10, 12, 14, 14]);
  const kid = { playLog: { day: '2026-11-04', n: 5 } };
  assert.equal(gamesLeft(kid, '2026-11-04', 0), 3);
  assert.equal(gamesLeft(kid, '2026-11-04', 2), 7);
  assert.equal(gamesLeft(kid, '2026-11-05', 0), 8, 'a new day starts fresh');
  assert.equal(gamesLeft({ playLog: { day: '2026-11-04', n: 12 } }, '2026-11-04', 1), 0);
  assert.equal(gamesLeft({}, '2026-11-04'), 8);
});
