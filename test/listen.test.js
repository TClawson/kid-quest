import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createListener, buddyState, noteName } from '../js/listen.js';
import { createBeatFollower } from '../js/beat.js';
import { rng } from './helpers/playing.mjs';
import { RATE, pianoNotes, talking, addNoise, runListener, room, singing, coughs } from './helpers/sound.mjs';

const listen = (samples) => {
  const l = createListener({ sampleRate: RATE, fftSize: 2048 });
  const events = runListener(l, addNoise(samples));
  return { l, events };
};
const SCALE = [262, 294, 330, 349, 392, 440, 494, 523];

test('hears each note of a slow scale as piano', () => {
  const { l } = listen(pianoNotes(SCALE.map((hz, i) => ({ at: 0.3 + i * 0.5, hz })), { length: 5 }));
  assert.equal(l.state.pianoNotes, 8);
  assert.equal(l.state.otherSounds, 0);
});

test('fast notes and chords are still piano', () => {
  const fast = listen(pianoNotes([...SCALE, ...SCALE].map((hz, i) => ({ at: 0.3 + i * 0.15, hz })), { length: 4 }));
  assert.ok(fast.l.state.pianoNotes >= 14, `fast: ${fast.l.state.pianoNotes}`);
  assert.ok(fast.l.state.otherSounds <= 1);
  const chords = listen(pianoNotes([0, 1, 2, 3].flatMap((i) => [262, 330, 392].map((h) => ({ at: 0.3 + i * 0.7, hz: h }))), { length: 4 }));
  assert.equal(chords.l.state.pianoNotes, 4);
  const low = listen(pianoNotes([65, 73, 82, 98].map((hz, i) => ({ at: 0.3 + i * 0.6, hz })), { length: 4 }));
  assert.equal(low.l.state.pianoNotes, 4);
});

test('with the pedal down, every note of a quick piece still starts a new note', () => {
  // the notes ring on, so the room never gets quiet; soft notes must still count
  const r = rng(3);
  const notes = Array.from({ length: 32 }, (_, i) => ({ at: 0.3 + i * 60 / 140, hz: SCALE[Math.floor(r() * 8)], dur: 4, g: 1 - 0.5 * r() }));
  const { events } = listen(pianoNotes(notes, { length: 15, ring: 0.4 }));
  const onsets = events.filter((e) => e.type === 'onset').map((e) => e.at);
  const caught = notes.filter((n) => onsets.some((o) => o - n.at * 1000 > -30 && o - n.at * 1000 < 80)).length;
  assert.ok(caught >= 31, `${caught} of 32 notes`);
  assert.ok(onsets.length <= 33, `${onsets.length} onsets: a note counted twice`);
});

test('talking is not piano', () => {
  for (const f0 of [120, 180, 280]) {
    const { l } = listen(talking(6, { f0 }));
    assert.equal(l.state.pianoNotes, 0, `voice at ${f0} Hz`);
    assert.ok(l.state.otherSounds > 5);
  }
});

test('in a room with an echo: piano is piano; talking, singing and coughs are not', () => {
  const piano = listen(room(pianoNotes(SCALE.map((hz, i) => ({ at: 0.3 + i * 0.5, hz })), { length: 5 })));
  assert.equal(piano.l.state.pianoNotes, 8);
  for (const [name, x] of [
    ['talking', room(talking(5, { f0: 120 }))], ['kid talking', room(talking(5, { f0: 280 }))],
    ['singing', room(singing(4))], ['kid singing', room(singing(4, { f0: 500, vibrato: 25, attack: 0.04 }))],
    ['coughs', room(coughs(3))],
  ]) {
    const { l } = listen(x);
    assert.equal(l.state.pianoNotes, 0, name);
  }
});

test('silence makes no notes, and the clock counts from the start', () => {
  const { l } = listen(new Float32Array(RATE * 3));
  assert.equal(l.state.pianoNotes + l.state.otherSounds, 0);
  assert.ok(Math.abs(l.since(3000) - 3) < 0.01);
});

test('the buddy is bored at 30 seconds and asleep at 60', () => {
  assert.equal(buddyState(1), 'playing');
  assert.equal(buddyState(1, false), 'waiting');
  assert.equal(buddyState(10), 'waiting');
  assert.equal(buddyState(30), 'bored');
  assert.equal(buddyState(59.9), 'bored');
  assert.equal(buddyState(60), 'asleep');
});

test('the onsets the listener hears are enough for the beat follower', () => {
  // two rounds of the scale at 120 beats a minute, then chords on every other beat
  const notes = [...SCALE, ...SCALE].map((hz, i) => ({ at: 0.3 + i * 0.5, hz }));
  for (let i = 0; i < 4; i++) for (const hz of [262, 330, 392]) notes.push({ at: 8.3 + i * 1, hz });
  const { events } = listen(room(pianoNotes(notes, { length: 13 })));
  let seed = 3;
  const beat = createBeatFollower({ rng: () => (seed = (seed * 16807) % 2147483647) / 2147483647 });
  const moves = [];
  const onsets = events.filter((e) => e.type === 'onset').map((e) => e.at);
  let i = 0;
  for (let now = 0; now < 13000; now += 20) {
    while (i < onsets.length && onsets[i] <= now) beat.note(onsets[i++]);
    moves.push(...beat.beats(now));
  }
  assert.equal(onsets.length, 20, 'one onset per note or chord');
  assert.ok(Math.abs(beat.bpm - 120) <= 6 || Math.abs(beat.bpm - 60) <= 4, `${beat.bpm} bpm`);
  // the analyser hears each note about a frame after it starts; the dance is on time with that
  const beats = Array.from({ length: 26 }, (_, k) => 300 + k * 500 + 20);
  const onBeat = moves.filter((m) => beats.some((b) => Math.abs(b - m) < 80));
  assert.ok(moves.length >= 8, `${moves.length} moves`);
  assert.ok(onBeat.length / moves.length >= 0.85, `${onBeat.length} of ${moves.length} moves on the beat`);
});

test('note names', () => {
  assert.equal(noteName(440), 'A4');
  assert.equal(noteName(261.6), 'C4');
  assert.equal(noteName(0), '');
});

test('with Google deciding, a sound counts once Google gives its verdict', () => {
  const notes = pianoNotes(SCALE.slice(0, 4).map((hz, i) => ({ at: 0.3 + i * 0.5, hz })), { length: 2.5 });
  const google = createListener({ sampleRate: RATE, fftSize: 2048, mode: 'google' });
  const early = runListener(google, addNoise(notes)).filter((e) => e.type !== 'onset');
  assert.equal(early.length, 0, 'nothing is counted before Google answers');
  const out = google.heard({ piano: 0.4, voice: 0, top: [{ name: 'Piano', score: 0.4 }] }, 2600);
  assert.equal(out.length, 4);
  assert.ok(out.every((e) => e.type === 'piano' && e.local === true && e.google === true));
  assert.ok(google.hearingPiano(3000));
  assert.ok(!google.hearingPiano(4500));
  assert.equal(google.since(2600), 0, 'hearing piano keeps the buddy awake');

  // talking that the built-in engine would call piano is still not piano when Google says speech
  const fooled = createListener({ sampleRate: RATE, fftSize: 2048, mode: 'google' });
  runListener(fooled, addNoise(notes));
  const said = fooled.heard({ piano: 0.01, voice: 0.9, top: [{ name: 'Speech', score: 0.9 }] }, 2600);
  assert.ok(said.every((e) => e.type === 'other'));
  assert.equal(fooled.state.lastPiano, null);
});

test('with both deciding, a note needs both to say piano', () => {
  const both = createListener({ sampleRate: RATE, fftSize: 2048, mode: 'both' });
  runListener(both, addNoise(talking(3)));
  const out = both.heard({ piano: 0.5, voice: 0.2, top: [] }, 3100);
  assert.ok(out.length > 3);
  assert.ok(out.every((e) => e.type === 'other'), 'the built-in engine said talking');
  assert.equal(both.since(3100), 3.1, 'Google alone does not keep the buddy awake');
});

test('Google piano score picks the piano labels and the top three', async () => {
  const { pianoScore } = await import('../js/hear.js');
  const s = pianoScore([
    { categoryName: 'Music', score: 0.97 }, { categoryName: 'Piano', score: 0.33 },
    { categoryName: 'Keyboard (musical)', score: 0.41 }, { categoryName: 'Speech', score: 0.2 }, { categoryName: 'Cough', score: 0.05 },
  ]);
  assert.equal(s.piano, 0.41);
  assert.equal(s.voice, 0.2);
  assert.deepEqual(s.top.map((c) => c.name), ['Music', 'Keyboard (musical)', 'Piano']);
});
