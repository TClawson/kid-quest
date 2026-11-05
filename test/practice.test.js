import { test } from 'node:test';
import assert from 'node:assert/strict';
import { runSeconds, dayEnd, CHEERS, pickCheer } from '../js/practice.js';
import { parseKey } from '../js/logic.js';

const at = (key, h, m = 0, s = 0) => { const d = parseKey(key); d.setHours(h, m, s); return d.getTime(); };

test('a run counts clock time, even with no ticks in between (app in the background)', () => {
  const run = { day: '2026-11-02', since: at('2026-11-02', 16, 0), base: 0 };
  assert.equal(runSeconds(run, at('2026-11-02', 16, 12, 30), 1800), 750);
});

test('a run adds to time already done earlier that day and stops at the timer length', () => {
  const run = { day: '2026-11-02', since: at('2026-11-02', 18, 0), base: 1200 };
  assert.equal(runSeconds(run, at('2026-11-02', 18, 5), 1800), 1500);
  assert.equal(runSeconds(run, at('2026-11-02', 19, 0), 1800), 1800);
});

test('practice time never carries into the next day', () => {
  const run = { day: '2026-11-02', since: at('2026-11-02', 23, 55), base: 0 };
  assert.equal(dayEnd('2026-11-02'), at('2026-11-03', 0, 0));
  assert.equal(runSeconds(run, at('2026-11-03', 0, 20), 1800), 300);
});

test('a clock set backwards never gives negative time', () => {
  const run = { day: '2026-11-02', since: at('2026-11-02', 16, 0), base: 60 };
  assert.equal(runSeconds(run, at('2026-11-02', 15, 0), 1800), 60);
});

test('there are 12 cheers and a tap never repeats the last one', () => {
  assert.equal(CHEERS.length, 12);
  for (const fn of CHEERS) assert.ok(fn('Sam').length > 3);
  let last = -1;
  for (let i = 0; i < 200; i += 1) {
    const next = pickCheer(last);
    assert.notEqual(next, last);
    assert.ok(next >= 0 && next < 12);
    last = next;
  }
  assert.equal(pickCheer(0, () => 0), 1);
  assert.equal(pickCheer(11, () => 0.9999), 10);
});

test('effort cheers name what the kid really did, and say nothing made up', async () => {
  const { effortCheers } = await import('../js/practice.js');
  assert.deepEqual(effortCheers({}), []);
  const lines = effortCheers({ pianoStreak: 6, pianoWeek: 3, minutesWeek: 75, pianoHabit: { done: 30, goal: 37, mastered: false }, month: { done: 9, days: 10 } });
  assert.equal(lines.length, 5);
  assert.ok(lines[0].startsWith('6 piano days in a row'));
  assert.ok(lines.some((l) => l.includes('30 of 37')));
});
