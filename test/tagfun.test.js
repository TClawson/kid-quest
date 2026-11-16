import test from 'node:test';
import assert from 'node:assert/strict';
import { personalityFor, PERSONALITIES, levelTricks, ventState, waveAt, trickFor, MAP_TRICKS, POWERUPS } from '../js/tagfun.js';
import { rng } from '../js/play.js';

const MAPS = ['bg-meadow', 'bg-sunset', 'bg-ocean', 'bg-space', 'bg-castle', 'bg-volcano', 'bg-rainforest', 'bg-fjord', 'bg-rainbow', 'bg-galaxy'];

test('each visiting buddy kind has one personality, so kids can learn them', () => {
  assert.equal(personalityFor('fox'), 'sneaky');
  assert.equal(personalityFor('puppy'), 'speedy');
  assert.equal(personalityFor('cat'), 'dodger');
  for (const sp of ['fox', 'bear', 'panda', 'cat', 'puppy', 'turtle', 'dino']) assert.ok(PERSONALITIES[personalityFor(sp)], sp);
  assert.equal(personalityFor('unicorn', 'Max'), personalityFor('unicorn', 'Max'), 'an unknown kind goes by name, the same every time');
  assert.deepEqual(POWERUPS, ['mushroom', 'snow', 'bush']);
  for (const p of Object.values(PERSONALITIES)) assert.ok(POWERUPS.includes(p.likes));
});

test('every map has its own trick, and an unknown map plays like the Forest Village', () => {
  for (const m of MAPS) assert.ok(MAP_TRICKS[m]?.tip, m);
  assert.equal(trickFor('bg-nowhere'), 'bg-meadow');
  assert.equal(trickFor(undefined), 'bg-meadow');
});

test('map tricks stay inside their level strip and clear of obstacles', () => {
  for (const m of MAPS) {
    for (let level = 1; level <= 5; level += 1) {
      const r = rng(level * 13);
      const avoid = [{ x: 600 + 70, y: 80, r: 8 }];
      const feats = levelTricks(m, level, 600, 213, 48, 129, r, avoid);
      for (const f of feats) {
        assert.ok(f.x >= 600 && f.x <= 813, `${m} level ${level}: ${f.kind} at x ${f.x}`);
        if (f.kind !== 'current') assert.ok(f.y >= 48 && f.y <= 129, `${m}: ${f.kind} at y ${f.y}`);
        if (['mud', 'ice', 'rainbow', 'pond', 'vent', 'well'].includes(f.kind)) {
          assert.ok(Math.abs(f.x - 670) > f.rx + 8 || Math.abs(f.y - 80) > f.ry + 8, `${m}: ${f.kind} on top of an obstacle`);
        }
      }
      if (m === 'bg-castle' && feats.length) {
        const doors = feats.filter((f) => f.kind === 'door');
        assert.equal(doors.length, 2);
        assert.equal(doors[0].twin, doors[1]); assert.equal(doors[1].twin, doors[0]);
      }
      if (m === 'bg-rainforest') assert.ok(feats.some((f) => f.kind === 'pad'), 'lily pads');
      if (m === 'bg-ocean') assert.deepEqual(feats.map((f) => Math.sign(f.drift)).sort(), [-1, 1], 'currents go both ways');
    }
  }
});

test('lava vents glow before they blow, and waves come and go', () => {
  const f = { phase: 0 };
  assert.equal(ventState(f, 1), 'quiet');
  assert.equal(ventState(f, 4), 'glow');
  assert.equal(ventState(f, 5), 'blow');
  assert.equal(ventState(f, 6.5), 'quiet');
  assert.equal(waveAt(0), 0);
  assert.equal(waveAt(1.8), 1);
  assert.equal(waveAt(6), 0);
  for (let t = 0; t < 20; t += 0.1) assert.ok(waveAt(t) >= 0 && waveAt(t) <= 1);
});

test('a whole game of tag runs on every map with every personality, and ends', async () => {
  // the game draws its buddies on canvases: a do-nothing one is enough here
  const ctx2d = new Proxy({}, { get: (t, k) => (k === 'createImageData' ? (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }) : () => {}) });
  globalThis.document ??= { createElement: () => ({ getContext: () => ctx2d }) };
  const { Play } = await import('../js/play.js');
  for (const map of MAPS) {
    for (const personality of Object.keys(PERSONALITIES)) {
      const g = new Play({ W: 213, H: 133, kind: 'tag', seed: 5, map, kid: { buddy: { species: 'fox' }, name: 'Sam', gear: {} }, visitor: { buddy: { species: 'bear' }, name: 'Max', gear: {}, personality } });
      assert.equal(g.personality, personality);
      g.tap(g.vis.x, g.vis.y - 10);
      assert.equal(g.phase, 'play');
      let grabbed = 0;
      for (let i = 0; i < 60 * 300 && g.phase === 'play'; i += 1) {
        if (i % 12 === 0) {
          const pw = g.fun.power;
          if (pw && g.it === 'vis') g.runTo(pw.x, pw.y - 8); else g.runTo(g.vis.x, g.vis.y - 8); // world pixels
        }
        const had = g.fun.power;
        g.step(1 / 60);
        if (had && !g.fun.power) grabbed += 1;
        assert.ok(Number.isFinite(g.kid.x) && Number.isFinite(g.vis.y), `${map} ${personality}`);
      }
      assert.equal(g.phase, 'over', `${map} ${personality}: the game ends`);
      assert.ok(g.score >= 0);
    }
  }
});
