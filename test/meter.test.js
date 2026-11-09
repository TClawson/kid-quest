import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ZONE_COLORS, needle, zoneAt, pickZone, drawMeter, addPop } from '../js/meter.js';
import * as hockey from '../js/hockey.js';
import * as football from '../js/football.js';
import { Fishing } from '../js/fishing.js';

// Expected values were computed from the per-game copies before they moved into meter.js.
const HELDS = [0, 0.1, 0.325, 0.5, 0.65, 0.9, 1.3, 2.71];
const MS = [0, 0.05, 0.3, 0.33, 0.32, 0.4, 0.45, 0.46, 0.465, 0.468, 0.5, 0.532, 0.535, 0.55, 0.552, 0.555, 0.57, 0.6, 0.67, 0.68, 0.7, 0.81, 0.82, 0.83, 0.95, 1];
const close = (a, b) => a.forEach((v, i) => assert.ok(Math.abs(v - b[i]) < 1e-12, `${i}: ${v} vs ${b[i]}`));

test('needle sweeps the same as each game did', () => {
  close(HELDS.map((h) => needle(h, 0.65)), [0, 0.15384615384615385, 0.5, 0.7692307692307692, 1, 0.6153846153846154, 0, 0.16923076923076863]);
  close(HELDS.map((h) => hockey.needle(h)), [0, 0.15384615384615385, 0.5, 0.7692307692307692, 1, 0.6153846153846154, 0, 0.16923076923076863]);
  close(HELDS.map((h) => football.needle(h, 0.9)), [0, 0.11111111111111112, 0.3611111111111111, 0.5555555555555556, 0.7222222222222222, 1, 0.5555555555555556, 0.9888888888888889]);
  close(HELDS.map((h) => Fishing.prototype.meter.call({ t: h }, { meterAt: 0 })), [0, 0.125, 0.40625, 0.625, 0.8125, 0.875, 0.375, 0.6125000000000003]);
});

test('zoneAt keeps hockey and football colors', () => {
  const hz = [
    'red,red,red,yellow,red,yellow,yellow,yellow,green,green,green,green,yellow,yellow,yellow,yellow,yellow,yellow,red,red,red,red,red,red,red,red',
    'red,red,red,yellow,red,yellow,green,green,green,green,green,green,green,green,green,yellow,yellow,yellow,red,red,red,red,red,red,red,red',
    'red,red,red,yellow,red,yellow,green,green,green,green,green,green,green,green,green,green,green,yellow,red,red,red,red,red,red,red,red',
  ];
  const fz = [
    'red,red,red,yellow,yellow,yellow,yellow,yellow,yellow,green,green,yellow,yellow,yellow,yellow,yellow,yellow,yellow,yellow,red,red,red,red,red,red,red',
    'red,red,red,yellow,yellow,yellow,green,green,green,green,green,green,green,green,yellow,yellow,yellow,yellow,yellow,red,red,red,red,red,red,red',
    'red,red,red,yellow,yellow,yellow,green,green,green,green,green,green,green,green,green,green,green,yellow,yellow,red,red,red,red,red,red,red',
  ];
  [1, 2, 3].forEach((t, i) => {
    assert.equal(MS.map((m) => hockey.zoneAt(m, t)).join(','), hz[i]);
    assert.equal(MS.map((m) => football.zoneAt(m, t)).join(','), fz[i]);
  });
  assert.equal(MS.map((m) => zoneAt(m, 0.035, 0.17)).join(','), hz[0]);
  assert.equal(MS.map((m) => zoneAt(m, 0.032, 0.18)).join(','), fz[0]);
  const shares = (fn) => { const c = { red: 0, yellow: 0, green: 0 }; for (let i = 0; i < 1000; i += 1) c[fn((i + 0.5) / 1000)] += 1; return c; };
  assert.deepEqual([1, 2, 3].map((t) => shares((m) => hockey.zoneAt(m, t))), [{ red: 660, yellow: 270, green: 70 }, { red: 660, yellow: 230, green: 110 }, { red: 660, yellow: 190, green: 150 }]);
  assert.deepEqual([1, 2, 3].map((t) => shares((m) => football.zoneAt(m, t))), [{ red: 640, yellow: 296, green: 64 }, { red: 640, yellow: 256, green: 104 }, { red: 640, yellow: 216, green: 144 }]);
});

test('pickZone splits by the odds', () => {
  const odds = { green: 0.18, yellow: 0.42, red: 0.4 };
  assert.deepEqual([0, 0.1799, 0.18, 0.5999, 0.6, 0.99].map((x) => pickZone(() => x, odds)), ['green', 'green', 'yellow', 'yellow', 'red', 'red']);
});

test('drawMeter paints 100 strips, an outline and the needle', () => {
  const calls = [];
  const ctx = { fillRect: (...a) => calls.push(['fill', ctx.fillStyle, ...a]), strokeRect: (...a) => calls.push(['stroke', ctx.strokeStyle, ctx.lineWidth, ...a]) };
  drawMeter(ctx, (k) => zoneAt(k, 0.035, 0.17), 0.25, 10, 20, 100, 5, 2);
  assert.equal(calls.length, 102);
  assert.deepEqual(calls[0], ['fill', ZONE_COLORS.red, 10, 20, 1.5, 5]);
  assert.deepEqual(calls[50], ['fill', ZONE_COLORS.green, 60, 20, 1.5, 5]);
  assert.deepEqual(calls[100], ['stroke', '#1b1430', 1.2, 10, 20, 100, 5]);
  assert.deepEqual(calls[101], ['fill', '#ffffff', 33.8, 18, 2.4, 9]);
});

test('addPop keeps the last 8 unless told otherwise', () => {
  const g = { t: 3, pops: [] };
  addPop(g, 'Hi', 1, 2);
  assert.deepEqual(g.pops[0], { text: 'Hi', x: 1, y: 2, at: 3, color: '#ffffff', big: false });
  for (let i = 0; i < 10; i += 1) addPop(g, `n${i}`, 0, 0, undefined, undefined);
  assert.equal(g.pops.length, 8); assert.equal(g.pops[0].text, 'n2');
  const f = { t: 0, pops: [] };
  for (let i = 0; i < 12; i += 1) addPop(f, 'x', 0, 0, '#000', true, Infinity);
  assert.equal(f.pops.length, 12);
});
