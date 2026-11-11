// The Note-o-Matic's kept tunes (js/tunerules.js): their shape, tidying one read back from
// storage, their names on the shelf, and putting one in a studio mix (studiorules.js addTune).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNE_SLOTS, cleanTune, makeTune, tuneName, tuneAbout, tuneSeconds, freeSlot, startVoice, shiftFits } from '../js/tunerules.js';
import { newMix, addTune, addTake, mixBeats, setBars, findClip, schedule, badges, cleanMix, mostNotesBeats, MOST_NOTES, NOTES_VOICE, notesVoice, ownVoice } from '../js/studiorules.js';

const notes = (n = 4) => Array.from({ length: n }, (_, i) => ({ at: 2 * i, len: 1.9, midi: [60, 64, 67, 72][i % 4] }));
const part = (role, beats = 8, extra = {}) => ({ role, notes: role === 'tune' ? notes() : [{ at: 0, len: 4, midi: 48 }, { at: 4, len: 4, midi: 43 }], beats, follows: true, ...extra });
/** What notomatic.js tuneReadings gives, more or less. */
const result = (band = true) => ({ key: 'C', bpm: 96, meter: 4, beats: 8, heard: [part('tune', 8, { follows: false })], tidy: [part('tune')], band: band ? [part('tune'), part('band')] : null });

test('a tune is made from the reading the kid picked, in its voice and shift', () => {
  const t = makeTune(result(), 'tidy', { voice: 'flute', shift: 12, now: 1000 });
  assert.equal(t.v, 1);
  assert.match(t.id, /^tune-/);
  assert.deepEqual({ made: t.made, reading: t.reading, bpm: t.bpm, meter: t.meter, key: t.key, beats: t.beats, voice: t.voice, shift: t.shift }, { made: 1000, reading: 'tidy', bpm: 96, meter: 4, key: 'C', beats: 8, voice: 'flute', shift: 12 });
  assert.deepEqual(t.parts, [part('tune')]);
  const b = makeTune(result(), 'band');
  assert.deepEqual(b.parts.map((p) => p.role), ['tune', 'band']);
  assert.equal(b.voice, startVoice('band'), 'the band version starts in its own tune voice');
  assert.equal(startVoice('band'), 'beep');
  assert.equal(makeTune(result(), 'heard').voice, NOTES_VOICE);
  assert.equal(makeTune(result(false), 'band'), null, 'no band, no band tune');
});

test('the shelf: six slots, names by slot, the reading and its seconds', () => {
  assert.equal(TUNE_SLOTS, 6);
  const t = makeTune(result(), 'tidy');
  assert.equal(tuneName(0), 'Tune 1');
  assert.equal(tuneName(5), 'Tune 6');
  assert.equal(tuneSeconds(t), 5); // 8 beats at 96 a minute
  assert.equal(tuneAbout(t), 'Tidied, 5 seconds');
  assert.equal(tuneAbout(makeTune(result(), 'band')), 'Band version, 5 seconds');
  assert.equal(tuneAbout({ ...t, beats: 1, bpm: 120 }), 'Tidied, 1 second');
  assert.equal(freeSlot([]), 0);
  assert.equal(freeSlot([t, null, t]), 1);
  assert.equal(freeSlot(Array(6).fill(t)), -1);
});

test('higher and lower stay in the playable range', () => {
  const parts = [part('tune')]; // C4 to C5
  assert.equal(shiftFits(parts, 24), true);
  assert.equal(shiftFits(parts, -36), false, 'C1 is below the lowest note');
  assert.equal(shiftFits([{ role: 'tune', notes: [{ at: 0, len: 1, midi: 90 }], beats: 1 }], 12), false);
});

test('a tune read back from storage is tidied, capped, or dropped', () => {
  const good = makeTune(result(), 'band', { now: 5 });
  assert.deepEqual(cleanTune(JSON.parse(JSON.stringify(good))), good, 'a good tune comes back as it was');
  for (const bad of [null, 'x', {}, { parts: [] }, { parts: [part('band')] }, { parts: [{ role: 'tune', notes: [{ at: 0, len: 1, midi: 200 }], beats: 2 }] }]) {
    assert.equal(cleanTune(bad), null, JSON.stringify(bad));
  }
  const odd = cleanTune({ reading: 'mystery', bpm: 9999, meter: 7, key: 'Q#', voice: 'kazoo', shift: 7, parts: [part('tune', 999), part('band')] });
  assert.equal(odd.reading, 'tidy', 'an unknown reading is the tidied one, and keeps no band');
  assert.equal(odd.parts.length, 1);
  assert.equal(odd.bpm, 170);
  assert.equal(odd.meter, 4);
  assert.equal(odd.key, null);
  assert.equal(odd.voice, NOTES_VOICE);
  assert.equal(odd.shift, 12, 'a shift is whole octaves');
  assert.equal(odd.parts[0].beats, mostNotesBeats(4), 'never longer than a notes clip may be');
  const many = cleanTune({ reading: 'heard', parts: [{ role: 'tune', notes: Array.from({ length: 3000 }, (_, i) => ({ at: i / 20, len: 0.5, midi: 60 })), beats: 84 }] });
  assert.equal(many.parts[0].notes.length, MOST_NOTES);
  const late = cleanTune({ reading: 'heard', parts: [{ role: 'tune', notes: [{ at: 0, len: 99, midi: 60 }, { at: 9, len: 1, midi: 62 }, { at: -1, len: 1, midi: 62 }], beats: 4 }] });
  assert.deepEqual(late.parts[0].notes, [{ at: 0, len: 8, midi: 60 }], 'notes past the end are dropped, long ones cut');
  const band = cleanTune({ ...good, parts: [good.parts[0], { role: 'band', notes: [] }] });
  assert.equal(band.reading, 'tidy', 'a band tune whose band is lost is just the tune');
  assert.equal(cleanTune({ ...good, shift: 60 }).shift, 0, 'a shift out of range is dropped');
});

test('a tune goes in a mix as a notes clip in its voice, shift and key', () => {
  const t = makeTune(result(), 'tidy', { voice: 'flute', shift: 12 });
  const r = addTune(newMix(), 2, t, 0);
  assert.equal(r.error, null);
  assert.equal(r.note, '');
  const { clip, track } = findClip(r.mix, r.ids[0]);
  assert.equal(track, 2);
  assert.deepEqual({ kind: clip.kind, role: clip.role, start: clip.start, len: clip.len, from: clip.from, total: clip.total, key: clip.key, shift: clip.shift, follows: clip.follows }, { kind: 'notes', role: 'tune', start: 0, len: 8, from: 0, total: 8, key: 'C', shift: 12, follows: true });
  assert.equal(ownVoice(clip), 'flute', 'its voice is its own sound');
  assert.equal(notesVoice(clip), 'flute');
  assert.deepEqual(clip.notes, t.parts[0].notes);
  assert.deepEqual({ bpm: r.mix.bpm, meter: r.mix.meter, key: r.mix.key }, { bpm: 96, meter: 4, key: 'C' }, 'an empty mix takes the tune\'s speed, bars and key');
  assert.ok(schedule(r.mix).length, 'it plays');
  assert.equal(badges(r.mix).some((b) => b.id === 'remixer'), false, 'a voice picked on the robot is no Remixer sticker');
  assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(r.mix))).tracks, r.mix.tracks, 'and it is kept as it was');
});

test('a band tune puts its band on another track; with no room, the tune goes in alone', () => {
  const t = makeTune(result(), 'band');
  const r = addTune(newMix(), 0, t, 0);
  assert.equal(r.ids.length, 2);
  const band = findClip(r.mix, r.ids[1]);
  assert.notEqual(band.track, 0);
  assert.equal(band.clip.role, 'band');
  assert.equal(band.clip.start, 0);
  assert.equal(ownVoice(band.clip), 'organ');
  assert.equal(ownVoice(findClip(r.mix, r.ids[0]).clip), 'beep');
  // every other track full
  let full = { ...newMix(), bpm: 96 };
  for (const tr of [1, 2, 3]) {
    const p = addTake(full, tr, `take-${tr}`, mixBeats(full), 0);
    assert.equal(p.error, null);
    full = p.mix;
  }
  const alone = addTune(full, 0, t, 0);
  assert.equal(alone.error, null);
  assert.equal(alone.ids.length, 1);
  assert.match(alone.note, /no room for the band/);
});

test('a tune is trimmed to the room, starts at the first free beat, and keeps to the mix\'s beat', () => {
  const t = makeTune(result(), 'tidy');
  const one = addTune(newMix(), 0, t, 0).mix;
  assert.equal(one.bars, 2, 'an empty mix is as many bars as the tune (at least 2)');
  assert.equal(addTune(one, 0, t, 0).error, 'That track is full.');
  const first = setBars(one, 4).mix;
  const second = addTune(first, 0, t, 2);
  assert.equal(findClip(second.mix, second.ids[0]).clip.start, 8, 'after the first one');
  assert.equal(findClip(second.mix, second.ids[0]).clip.len, 8);
  const short = addTune(setBars(one, 3).mix, 0, t, 0);
  assert.equal(findClip(short.mix, short.ids[0]).clip.len, 4, 'trimmed to the room left');
  const waltz = { ...t, meter: 3 };
  assert.match(addTune(first, 1, waltz, 0, 'Tune 2').error, /^Tune 2 has 3 beats in a bar, and this mix has 4/);
  assert.equal(addTune(first, 1, null).error, 'That tune is gone.');
});
