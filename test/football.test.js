import test from 'node:test';
import assert from 'node:assert/strict';
import { ROUTES, needle, zoneAt, catchWindows, visCatch, waitFor, reachFor, MISS, VIS_THROW, SLACK } from '../js/football.js';

const share = (zone, tier) => { let n = 0; for (let i = 0; i < 1000; i += 1) if (zoneAt((i + 0.5) / 1000, tier) === zone) n += 1; return n / 1000; };

test('aiming: green is a narrow band in the middle, a little wider with a better ball', () => {
  assert.equal(zoneAt(0.5), 'green');
  assert.equal(zoneAt(0.6), 'yellow');
  assert.equal(zoneAt(0.95), 'red');
  assert.ok(share('green', 1) < 0.1, 'a perfect throw is hard');
  assert.ok(share('green', 3) > share('green', 1));
  assert.equal(needle(0, 1), 0);
  assert.ok(Math.abs(needle(1.5, 1) - 0.5) < 1e-9);
  assert.ok(ROUTES.deep.sweep < ROUTES.short.sweep, 'the needle is faster for deep throws');
});

test('catching: smaller windows for deep and off-target throws, bigger with a better ball', () => {
  const w = (r, z, t) => catchWindows(r, z, t).green;
  assert.ok(w('deep', 'green', 1) < w('short', 'green', 1));
  assert.ok(w('short', 'red', 1) < w('short', 'yellow', 1) && w('short', 'yellow', 1) < w('short', 'green', 1));
  assert.ok(w('short', 'green', 3) > w('short', 'green', 1));
  for (const r of Object.keys(ROUTES)) assert.ok(catchWindows(r, 'green').yellow > catchWindows(r, 'green').green);
  assert.ok(reachFor(3) > reachFor(1));
  assert.ok(MISS.red > MISS.yellow && MISS.yellow > MISS.green);
});

test('the visitor throws green 60%, catches good throws more often, and less on long routes', () => {
  assert.equal(VIS_THROW.green, 0.6);
  assert.ok(visCatch('short', 'green') > visCatch('short', 'yellow') && visCatch('short', 'yellow') > visCatch('short', 'red'));
  assert.ok(visCatch('deep', 'green') < visCatch('short', 'green'));
});

test('longer throws stay up longer, and the thrower waits just long enough to get there', () => {
  assert.ok(ROUTES.short.flight < ROUTES.medium.flight && ROUTES.medium.flight < ROUTES.deep.flight);
  for (const [toCone, off, r] of [[60, 0, 'short'], [100, 12, 'medium'], [160, 26, 'deep']]) {
    const wait = waitFor(toCone, off, ROUTES[r].flight);
    const spare = wait + ROUTES[r].flight - (toCone + off) / 60;
    assert.ok(Math.abs(spare - SLACK) < 1e-9, `${r}: ${SLACK} s to spare`);
  }
  assert.ok(waitFor(160, 0, ROUTES.deep.flight) > waitFor(40, 0, ROUTES.short.flight), 'longer routes wait longer');
  assert.equal(waitFor(0, 0, 2), 0.3, 'never throws right away');
});
