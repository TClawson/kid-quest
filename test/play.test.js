import test from 'node:test';
import assert from 'node:assert/strict';
import { gameFor, levelObstacles, rng, kickWindows, heightSpread } from '../js/play.js';
import { needle, zoneAt, SHOT_ODDS, STEAL_ODDS, Z } from '../js/hockey.js';
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
  assert.deepEqual(SHOT_ODDS, { red: 0.05, yellow: 0.25, green: 0.55 });
  // the aim spread for each color gives those odds: P(|normal| < Z) = odds
  const within = (z) => { let sum = 0; const n = 20000; for (let i = 0; i < n; i += 1) { const x = ((i + 0.5) / n) * z; sum += Math.exp(-x * x / 2); } return (2 * sum * (z / n)) / Math.sqrt(2 * Math.PI); };
  for (const zone of ['red', 'yellow', 'green']) assert.ok(Math.abs(within(Z[zone]) - SHOT_ODDS[zone]) < 0.002, zone);
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

test('keepy-uppy gets harder: Perfect narrows most, and kick heights vary more', () => {
  const start = kickWindows(0, 1);
  const later = kickWindows(50, 1);
  assert.ok(Math.abs(start.perfect - 0.07) < 1e-9);
  assert.ok(Math.abs(later.perfect - 0.028) < 1e-9, 'Perfect is down to 40%');
  assert.ok(later.perfect / start.perfect < later.good / start.good, 'Perfect narrows faster than Good');
  assert.ok(later.good / start.good < later.early / start.early);
  for (let n = 1; n < 100; n += 1) assert.ok(kickWindows(n, 2).perfect <= kickWindows(n - 1, 2).perfect);
  assert.ok(kickWindows(20, 3).perfect > kickWindows(20, 1).perfect, 'a better ball is easier');
  assert.equal(heightSpread(0), 0.12);
  assert.equal(heightSpread(100), 0.3);
});
