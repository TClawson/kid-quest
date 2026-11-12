// The turntable in the buddy's house: its shop rules, records, loop shaping and what's kept.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { FURNITURE, TURNTABLE_ID, needsMusicHouse, hasTurntable, homeLayout, HOME_SPOTS } from '../js/furniture.js';
import { shapePass, volGain, validRecord, recordList, deckOf, setDeck, LOOP, VOL_START, VOL_TOP } from '../js/turntable.js';
import { newMix, addPart } from '../js/studiorules.js';

const memStore = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)) }; };

test('the turntable is a 300-coin piece for its own music corner, sold once the music house opens', () => {
  const t = FURNITURE.find((f) => f.id === TURNTABLE_ID);
  assert.equal(t.price, 300);
  assert.equal(t.spot, 'music');
  assert.ok(HOME_SPOTS.some((s) => s.id === 'music' && !s.basic), 'the music corner starts empty');
  assert.ok(needsMusicHouse(t));
  assert.ok(!FURNITURE.filter((f) => f.id !== TURNTABLE_ID).some(needsMusicHouse), 'only the turntable waits for the music house');
});

test('the turntable plays only when it is owned and standing in the house', () => {
  assert.equal(hasTurntable({ owned: [], home: {} }), false);
  assert.equal(hasTurntable({ owned: [], home: { music: TURNTABLE_ID } }), false, 'not bought');
  assert.equal(hasTurntable({ owned: [TURNTABLE_ID], home: {} }), false, 'put away');
  assert.equal(hasTurntable({ owned: [TURNTABLE_ID], home: { music: TURNTABLE_ID } }), true);
  assert.equal(homeLayout({ owned: [], home: {} }).music, null);
});

test('a record on repeat fades out, then rests, so the loop never jumps', () => {
  const rate = 1000;
  const sound = new Float32Array(3000).fill(1);
  const once = shapePass(sound, rate);
  assert.equal(once.length, 3000, 'played once: no rest after it');
  const loop = shapePass(sound, rate, { loop: true });
  assert.equal(loop.length, 3000 + LOOP.gap * rate, 'a rest after each time round');
  assert.equal(loop[0], 0, 'starts from quiet');
  assert.equal(loop[1500], 1, 'the middle is untouched');
  assert.ok(loop[2999] < 0.01, 'ends in quiet');
  assert.ok(loop[3000 - LOOP.fadeOut * rate / 2] > 0.4 && loop[3000 - LOOP.fadeOut * rate / 2] < 0.6, 'a smooth fade');
  assert.ok(loop.slice(3000).every((x) => x === 0), 'the rest is quiet');
  assert.equal(sound[0], 1, 'the record itself is left as it was');
  // a very short record still has some sound in it
  const short = shapePass(new Float32Array(300).fill(1), rate, { loop: true });
  assert.equal(short[150], 1);
});

test('the loudness knob: off at 0, full at the top, softer steps low down', () => {
  assert.equal(volGain(0), 0);
  assert.equal(volGain(VOL_TOP), 1);
  assert.ok(volGain(5) < 0.5 && volGain(5) > 0.1);
  assert.equal(volGain(99), 1);
});

test('records: kept mixes, the mix on the desk, kept tunes; empty ones are left out', () => {
  assert.ok(validRecord('mix:0') && validRecord('mix:2') && validRecord('desk') && validRecord('tune:5'));
  assert.ok(!validRecord('mix:3') && !validRecord('tune:6') && !validRecord('x') && !validRecord(null));
  const m = addPart(newMix('Rocket jam'), 0, 'bg-meadow', 'lead').mix;
  const tune = { reading: 'tidy', bpm: 100, beats: 16, parts: [{ role: 'tune', notes: [{ at: 0, len: 2, midi: 60 }], beats: 16 }], voice: 'steel', shift: 0 };
  const list = recordList({ draft: newMix(), slots: [null, m, null] }, [null, null, tune]);
  assert.deepEqual(list.map((r) => r.key), ['mix:1', 'tune:2']);
  assert.equal(list[0].name, 'Rocket jam');
  assert.match(list[0].about, /^Studio mix, \d+ seconds$/);
  assert.equal(list[1].name, 'Tune 3');
  assert.match(list[1].about, /10 seconds/);
  assert.deepEqual(recordList({ draft: m, slots: [] }, []).map((r) => r.key), ['desk']);
  assert.deepEqual(recordList(null, null), []);
});

test('what is on repeat and how loud are kept per kid on this tablet', () => {
  const s = memStore();
  assert.deepEqual(deckOf('a', s), { loop: null, vol: VOL_START });
  setDeck('a', { loop: 'tune:1' }, s);
  setDeck('a', { vol: 3 }, s);
  setDeck('b', { loop: 'mix:0' }, s);
  assert.deepEqual(deckOf('a', s), { loop: 'tune:1', vol: 3 });
  assert.deepEqual(deckOf('b', s), { loop: 'mix:0', vol: VOL_START });
  s.setItem('kidquest.turntable', JSON.stringify({ a: { loop: 'mix:9', vol: 40 } }));
  assert.deepEqual(deckOf('a', s), { loop: null, vol: VOL_START }, 'nonsense is ignored');
  s.setItem('kidquest.turntable', '{oops');
  assert.deepEqual(deckOf('a', s), { loop: null, vol: VOL_START });
});
