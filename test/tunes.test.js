// The Note-o-Matic's kept tunes (js/tunerules.js): their shape, tidying one read back from
// storage, their names on the shelf, and putting one in a studio mix (studiorules.js addTune).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TUNE_SLOTS, TUNE_BPM, forMix, cleanTune, makeTune, tuneName, tuneAbout, tuneSeconds, freeSlot, startVoice, shiftFits } from '../js/tunerules.js';
import { newMix, addTune, addTake, mixBeats, setBars, maxBars, findClip, schedule, badges, cleanMix, mostNotesBeats, MOST_NOTES, NOTES_VOICE, notesVoice, ownVoice } from '../js/studiorules.js';

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
  // a part that doesn't say how long it is lasts as long as its notes
  const notes4 = [{ at: 0, len: 2, midi: 60 }, { at: 6, len: 3, midi: 64 }]; // the last one ends on step 9: 5 beats
  for (const beats of [undefined, null, NaN, Infinity, 'x', 0, -2]) {
    const t = cleanTune({ reading: 'tidy', parts: [{ role: 'tune', notes: notes4, beats }] });
    assert.equal(t.parts[0].beats, 5, `beats ${String(beats)}`);
    assert.deepEqual(t.parts[0].notes, notes4, `beats ${String(beats)}: every note kept`);
  }
  const huge = cleanTune({ reading: 'tidy', meter: 4, parts: [{ role: 'tune', notes: [{ at: 0, len: 1, midi: 60 }, { at: 400, len: 4, midi: 62 }] }] });
  assert.equal(huge.parts[0].beats, mostNotesBeats(4), 'and still no longer than a notes clip may be');
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
  // a long tune keeps its whole length in an empty mix (as long as a loop can be at its speed)
  const long = cleanTune({ reading: 'tidy', bpm: 100, meter: 4, parts: [{ role: 'tune', beats: 44, notes: [{ at: 0, len: 2, midi: 60 }, { at: 86, len: 2, midi: 64 }] }] });
  const r = addTune(newMix(), 0, long, 0);
  assert.equal(r.mix.bars, 11, '44 beats is 11 bars, not cut to 8');
  assert.equal(findClip(r.mix, r.ids[0]).clip.len, 44);
  const fast = cleanTune({ reading: 'tidy', bpm: 170, meter: 4, parts: [{ role: 'tune', beats: 84, notes: [{ at: 0, len: 2, midi: 60 }] }] });
  assert.equal(addTune(newMix(), 0, fast, 0).mix.bars, maxBars(170, 4), 'never more bars than a loop may have');
  assert.equal(findClip(short.mix, short.ids[0]).clip.len, 4, 'trimmed to the room left');
  // a tune of another count goes in all the same; only its band stays out
  const waltz = { ...t, meter: 3 };
  const w = addTune(first, 1, waltz, 0);
  assert.equal(w.error, null);
  assert.equal(w.note, '', 'a tune with no band: nothing to say');
  assert.equal(w.mix.meter, 4, 'the mix keeps its count');
  assert.deepEqual(findClip(w.mix, w.ids[0]).clip.notes, t.parts[0].notes);
  const bandWaltz = { ...makeTune(result(), 'band'), meter: 3 };
  const bw = addTune(first, 1, bandWaltz, 0);
  assert.equal(bw.error, null);
  assert.equal(bw.ids.length, 1, 'the tune alone');
  assert.equal(findClip(bw.mix, bw.ids[0]).clip.role, 'tune');
  assert.equal(bw.note, 'The band counts in 3s and this mix counts in 4s, so your tune went in without its band.');
  assert.equal(addTune(addTune(newMix(), 0, bandWaltz, 0).mix, 2, makeTune(result(), 'band'), 0).note, 'The band counts in 4s and this mix counts in 3s, so your tune went in without its band.');
  assert.equal(addTune(first, 1, null).error, 'That tune is gone.');
});

test('a slow tune keeps its own speed, and goes in a mix twice as fast with notes twice as long', () => {
  assert.deepEqual(TUNE_BPM, [40, 170]);
  const slow = cleanTune({ reading: 'band', bpm: 50, meter: 4, key: 'C', voice: 'flute', parts: [part('tune'), part('band')] });
  assert.equal(slow.bpm, 50, 'kept at 50, not the studio\'s slowest');
  assert.equal(cleanTune({ ...slow, bpm: 20 }).bpm, 40);
  assert.equal(forMix(makeTune(result(), 'tidy')).bpm, 96, 'a tune the studio can play as it is stays as it is');
  const seconds = (beats, bpm) => (beats * 60) / bpm;
  // into an empty mix
  const r = addTune(newMix(), 0, slow, 0);
  assert.equal(r.error, null);
  assert.equal(r.mix.bpm, 100);
  assert.equal(r.mix.meter, 4);
  assert.equal(r.mix.bars, 4, '16 beats at 100');
  const tune = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual(tune.notes, slow.parts[0].notes.map((n) => ({ ...n, at: 2 * n.at, len: 2 * n.len })), 'every note at twice the place and twice as long');
  assert.equal(tune.total, 16);
  assert.ok(Math.abs(seconds(tune.total, r.mix.bpm) - seconds(slow.beats, slow.bpm)) <= 60 / r.mix.bpm, 'as many seconds as the tune');
  const band = findClip(r.mix, r.ids[1]).clip;
  assert.deepEqual(band.notes, slow.parts[1].notes.map((n) => ({ ...n, at: 2 * n.at, len: 2 * n.len })), 'its band too');
  // into a mix that has music already: doubled as well
  const busy = addTune(addTune(newMix(), 0, makeTune(result(), 'tidy'), 0).mix, 1, slow, 0);
  assert.equal(busy.error, null);
  assert.equal(busy.mix.bpm, 96, 'the mix keeps its speed');
  assert.deepEqual(findClip(busy.mix, busy.ids[0]).clip.notes.map((n) => n.at), [0, 4, 8, 12]);
  assert.deepEqual(slow.parts[0].notes.map((n) => n.at), [0, 2, 4, 6], 'the kept tune itself is not changed');
  // the slowest tune the robot hears, 30 seconds of it, is not cut short
  const long = cleanTune({ reading: 'tidy', bpm: 40, meter: 4, parts: [{ role: 'tune', beats: 20, notes: [{ at: 0, len: 2, midi: 60 }, { at: 38, len: 2, midi: 64 }] }] });
  const lr = addTune(newMix(), 0, long, 0);
  const lc = findClip(lr.mix, lr.ids[0]).clip;
  assert.equal(lr.mix.bpm, 80);
  assert.equal(lc.len, 40);
  assert.deepEqual(lc.notes, [{ at: 0, len: 4, midi: 60 }, { at: 76, len: 4, midi: 64 }]);
});

test('a tune that doesn\'t fit says its end is cut off', () => {
  const t = makeTune(result(), 'tidy'); // 8 beats at 96
  const one = addTune(newMix(), 0, t, 0);
  assert.equal(one.note, '', 'it fits: nothing to say');
  // a mix that could grow
  const short = addTune(setBars(one.mix, 3).mix, 1, t, 8);
  assert.equal(findClip(short.mix, short.ids[0]).clip.len, 4);
  assert.equal(short.note, 'Your tune is longer than this mix, so its end is cut off. Make the mix longer to hear more.');
  // room on the track runs out before the loop does: still the mix can grow
  const blocked = addTune(addTune(setBars(one.mix, 4).mix, 1, t, 4).mix, 1, t, 0);
  assert.equal(findClip(blocked.mix, blocked.ids[0]).clip.len, 4);
  assert.equal(blocked.note, 'Your tune stops where the next clip on its track starts. Move that clip, or put your tune on an empty track.', 'a longer mix wouldn\'t help there');
  // a 24-beat tune on a 48-beat mix's track with a clip at beat 16
  const big = cleanTune({ reading: 'tidy', bpm: 96, meter: 4, parts: [{ role: 'tune', beats: 24, notes: [{ at: 0, len: 2, midi: 60 }, { at: 46, len: 2, midi: 64 }] }] });
  const roomy = addTune(setBars(one.mix, 12).mix, 1, t, 16).mix;
  const hit = addTune(roomy, 1, big, 0);
  assert.equal(findClip(hit.mix, hit.ids[0]).clip.len, 16);
  assert.match(hit.note, /^Your tune stops where the next clip on its track starts\./);
  // an empty mix as long as a mix can be at that speed (maxBars rounds down): no longer
  const long = cleanTune({ reading: 'tidy', bpm: 100, meter: 4, parts: [{ role: 'tune', beats: 50, notes: [{ at: 0, len: 2, midi: 60 }, { at: 98, len: 2, midi: 64 }] }] });
  const l = addTune(newMix(), 0, long, 0);
  assert.equal(l.mix.bars, maxBars(100, 4));
  assert.equal(findClip(l.mix, l.ids[0]).clip.len, 48);
  assert.equal(l.note, 'Your tune is longer than a mix can be, so its end is cut off.');
  // with the band note too
  const bandWaltz = { ...makeTune(result(), 'band'), meter: 3 };
  const both = addTune(setBars(one.mix, 3).mix, 1, bandWaltz, 8);
  assert.equal(both.note, 'The band counts in 3s and this mix counts in 4s, so your tune went in without its band. Your tune is longer than this mix, so its end is cut off. Make the mix longer to hear more.');
});
