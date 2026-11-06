import test from 'node:test';
import assert from 'node:assert/strict';
import { gameFor, levelObstacles, rng, kickWindows, heightSpread } from '../js/play.js';
import { needle, zoneAt, SHOT_ODDS, STEAL_ODDS, Z } from '../js/hockey.js';
import { gamesPerDay, gamesLeft, carriedGames, earlyGames, logGame } from '../js/logic.js';

test('visitors play their ball game or go fishing, the same one all day, or tag', () => {
  assert.equal(gameFor({}), 'tag');
  assert.equal(gameFor({ shoes: 2 }), 'tag');
  assert.equal(gameFor({ shoes: 2, rod: 1 }), 'fishing');
  assert.equal(gameFor({ soccer: 1 }), 'soccer');
  assert.equal(gameFor({ hockey: 3 }), 'hockey');
  assert.equal(gameFor({ football: 2 }), 'football');
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
  assert.equal(zoneAt(0.57, 3), 'green', 'a super stick doubles green');
  assert.ok(kickWindows(0, 3).perfect >= 2 * kickWindows(0, 1).perfect - 1e-9, 'a super ball doubles Perfect');
  assert.deepEqual(SHOT_ODDS, { red: 0.05, yellow: 0.25, green: 0.55 });
  // the aim spread for each color gives those odds: P(|normal| < Z) = odds
  const within = (z) => { let sum = 0; const n = 20000; for (let i = 0; i < n; i += 1) { const x = ((i + 0.5) / n) * z; sum += Math.exp(-x * x / 2); } return (2 * sum * (z / n)) / Math.sqrt(2 * Math.PI); };
  for (const zone of ['red', 'yellow', 'green']) assert.ok(Math.abs(within(Z[zone]) - SHOT_ODDS[zone]) < 0.002, zone);
  for (const odds of Object.values(STEAL_ODDS)) assert.ok(Math.abs(odds.reduce((a, b) => a + b) - 1) < 1e-9);
});

test('4 games a day, plus 2 for each exercise-streak week up to 3', () => {
  assert.deepEqual([0, 1, 2, 3, 5].map(gamesPerDay), [4, 6, 8, 10, 10]);
  const kid = { playLog: { day: '2026-11-04', n: 3 } };
  assert.equal(gamesLeft(kid, '2026-11-04', 0), 1);
  assert.equal(gamesLeft(kid, '2026-11-04', 2), 5);
  assert.equal(gamesLeft(kid, '2026-11-04', 0, 2), 3, 'treasure games add on top');
  assert.equal(gamesLeft(kid, '2026-11-05', 0), 4, 'a new day starts fresh');
  assert.equal(gamesLeft({ playLog: { day: '2026-11-04', n: 6 } }, '2026-11-04', 1), 0);
  assert.equal(gamesLeft({}, '2026-11-04'), 4);
});

test('keepy-uppy gets harder: Perfect narrows most, and kick heights vary more', () => {
  const start = kickWindows(0, 1);
  const later = kickWindows(50, 1);
  assert.ok(Math.abs(start.perfect - 0.049) < 1e-9);
  assert.ok(Math.abs(start.good - 0.091) < 1e-9);
  assert.ok(Math.abs(later.perfect - 0.0196) < 1e-9, 'Perfect is down to 40%');
  assert.ok(later.perfect / start.perfect < later.good / start.good, 'Perfect narrows faster than Good');
  assert.ok(later.good / start.good < later.early / start.early);
  for (let n = 1; n < 100; n += 1) assert.ok(kickWindows(n, 2).perfect <= kickWindows(n - 1, 2).perfect);
  assert.ok(kickWindows(20, 3).perfect > kickWindows(20, 1).perfect, 'a better ball is easier');
  assert.equal(heightSpread(0), 0.12);
  assert.equal(heightSpread(100), 0.3);
});

test('chest games keep for one more day', () => {
  const t = '2026-11-06', y = '2026-11-05';
  // opened late yesterday, no games played since: both carry over
  assert.equal(carriedGames({ playLog: { day: y, n: 4, cap: 4 } }, t, 2), 2);
  // yesterday's daily games used, then one chest game
  assert.equal(carriedGames({ playLog: { day: y, n: 5, cap: 4 } }, t, 2), 1);
  assert.equal(carriedGames({ playLog: { day: y, n: 9, cap: 4 } }, t, 2), 0);
  // nothing played yesterday
  assert.equal(carriedGames({ playLog: { day: '2026-11-01', n: 3 } }, t, 2), 2);
  assert.equal(carriedGames({}, t, 2), 2);
  assert.equal(carriedGames({ playLog: { day: y, n: 1 } }, t, 0), 0, 'no chest games, nothing carried');
  // they only keep one day
  assert.equal(carriedGames({ playLog: { day: y, n: 0 } }, '2026-11-07', 0), 0);
  // old logs without cap use the daily games
  assert.equal(carriedGames({ playLog: { day: y, n: 5 } }, t, 2, 4), 1);
  // playing today keeps yesterday's log, so the carry-over stays put
  let kid = { playLog: { day: y, n: 5, cap: 4 } };
  const cap = 4 + carriedGames(kid, t, 2);
  kid = { playLog: logGame(kid, t, cap) };
  assert.deepEqual(kid.playLog, { day: t, n: 1, cap: 5, prev: { day: y, n: 5, cap: 4 } });
  kid = { playLog: logGame(kid, t, 5) };
  assert.equal(kid.playLog.n, 2);
  assert.equal(carriedGames(kid, t, 2), 1);
  assert.equal(gamesLeft(kid, t, 0, 0 + carriedGames(kid, t, 2)), 3);
  // carried games are used before today's chest games, so tomorrow only today's unused chest games carry
  assert.equal(carriedGames({ playLog: { day: t, n: 6, cap: 5 } }, '2026-11-07', 2), 1);
});

test('carried chest games can be played before chores', () => {
  const t = '2026-11-06', y = '2026-11-05';
  assert.equal(earlyGames({ playLog: { day: y, n: 4, cap: 4 } }, t, 2), 2, 'both carried games, first thing');
  assert.equal(earlyGames({ playLog: { day: t, n: 1 } }, t, 2), 1, 'one played already');
  assert.equal(earlyGames({ playLog: { day: t, n: 2 } }, t, 2), 0, 'used up: the rest wait for chores');
  assert.equal(earlyGames({}, t, 0), 0, 'nothing carried, nothing early');
  // played early, the day's total stays the same once chores are done
  const kid = { playLog: { day: t, n: 2 } };
  assert.equal(gamesLeft(kid, t, 0, 2), 4);
});
