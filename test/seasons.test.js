import { test } from 'node:test';
import assert from 'node:assert/strict';
import { seasonOf, seasonProgress, shownSeason, trySeason } from '../js/seasons.js';

const mem = () => { const m = new Map(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: (k) => m.delete(k) }; };

test('seasons follow the calendar', () => {
  assert.equal(seasonOf('2026-11-10'), 'autumn');
  assert.equal(seasonOf('2026-12-01'), 'winter');
  assert.equal(seasonOf('2027-02-28'), 'winter');
  assert.equal(seasonOf('2027-03-01'), 'spring');
  assert.equal(seasonOf('2027-07-04'), 'summer');
});

test('progress runs 0..1 through each season, across the new year too', () => {
  assert.equal(seasonProgress('2026-09-01'), 0);
  assert.ok(seasonProgress('2026-11-30') > 0.95);
  assert.equal(seasonProgress('2026-12-01'), 0);
  const jan = seasonProgress('2027-01-15');
  assert.ok(jan > 0.4 && jan < 0.6, String(jan));
});

test('a parent can try a season on this device', () => {
  const s = mem();
  assert.equal(shownSeason('2026-11-10', s), 'autumn');
  trySeason('winter', s);
  assert.equal(shownSeason('2026-11-10', s), 'winter');
  trySeason(null, s);
  assert.equal(shownSeason('2026-11-10', s), 'autumn');
});
