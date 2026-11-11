// The Note-o-Matic's clips in the studio's rules (js/studiorules.js): a take turned into notes
// (takeToNotes), the notes clip through every other rule (voices, higher and lower, keys,
// copying, trimming, moving, the speed), its swing, its stickers, and reading one back from
// storage (cleanMix), bad saves included. The ears and the readings themselves have their own
// tests (listener.test.js, notomatic.test.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { keyInfo } from '../js/sheetmusic.js';
import { clipSound, clipEvents, backingKey, shiftKey, sameSig } from '../js/remix.js';
import {
  newMix, addPart, addTake, addBacking, takeToNotes, findClip, setVoice, shiftClip, moveIntoKey, clipFits, clipKey, copyClip,
  trimClip, moveClip, setBpm, setBars, removeClip, schedule, badges, cleanMix, takesIn, remixed, clipSwing, backingSwing, ownVoice, notesVoice,
  readingVoice, roleLevel, validKey, newNid, mixBeats, NOTES_VOICE, MOST_NOTES, keptHeard, readingOptions, mostNotesBeats, setPace, pacedNotes, paceOf,
} from '../js/studiorules.js';

const must = (r) => { assert.equal(r.error, null, r.error || ''); return r; };

/** A part of a reading: notes C4 E4 G4 C5 one a beat (steps of 2), `beats` long. */
const tune = (beats = 8, extra = {}) => ({ role: 'tune', notes: [60, 64, 67, 72].map((midi, i) => ({ at: 2 * i, len: 1.9, midi })), beats, follows: true, ...extra });
const bandPart = (beats = 8) => ({ role: 'band', notes: [{ at: 0, len: 4, midi: 48 }, { at: 4, len: 4, midi: 43 }], beats, follows: true });

/** A mix at 100 beats a minute with a take of `beats` beats on track `track` at `at`. */
function withTake({ beats = 8, track = 0, at = 0, mix = { ...newMix(), bpm: 100 } } = {}) {
  const r = must(addTake(mix, track, 'take-1', beats, at, { lead: 0.06 }));
  return { mix: r.mix, id: r.id };
}

test('a take becomes a notes clip in its place, and the take is no longer used', () => {
  const { mix, id } = withTake({ beats: 8, track: 1, at: 4 });
  const r = must(takeToNotes(mix, id, [tune(8)], 'C'));
  assert.equal(r.ids.length, 1);
  const { clip, track } = findClip(r.mix, r.ids[0]);
  assert.equal(track, 1);
  assert.equal(findClip(r.mix, id), null, 'the take is gone from the mix');
  assert.deepEqual(takesIn(r.mix), [], 'so its sound is no longer the mix\'s');
  assert.deepEqual(takesIn(mix), ['take-1'], 'but the mix before (Undo) still uses it');
  assert.equal(clip.kind, 'notes');
  assert.equal(clip.role, 'tune');
  assert.deepEqual([clip.start, clip.len, clip.from, clip.total], [4, 8, 0, 8]);
  assert.deepEqual(clip.notes.map((n) => n.midi), [60, 64, 67, 72]);
  assert.deepEqual(Object.keys(clip.notes[0]), ['at', 'len', 'midi'], 'only what the clip needs is kept');
  assert.equal(typeof clip.nid, 'string');
  assert.ok(clip.nid.length > 0 && clip.nid.length <= 40);
  assert.equal(clip.key, 'C');
  assert.equal(clip.follows, true);
  assert.equal(clip.voice, undefined, 'its own voice (the steel drum)');
  assert.equal(clipSound(clip), 'notes');
  assert.equal(clipEvents(clip), clip.notes);
  assert.equal(r.mix.key, 'C', 'a mix with no key takes the playing\'s');
  assert.equal(r.mix.next, mix.next + 1);
  assert.notEqual(newNid(), newNid(), 'each list of notes gets its own name');
  // the speed is no longer kept for the take
  assert.equal(setBpm(mix, 120).error !== null, true);
  assert.equal(must(setBpm(r.mix, 120)).mix.bpm, 120);
});

test('a mix with a key keeps it; no key and odd keys are not stored', () => {
  let { mix, id } = withTake();
  mix = { ...mix, key: 'G' };
  let r = must(takeToNotes(mix, id, [tune()], 'Eb'));
  assert.equal(r.mix.key, 'G');
  assert.equal(findClip(r.mix, r.ids[0]).clip.key, 'Eb');
  r = must(takeToNotes(withTake().mix, withTake().id, [tune()], null));
  assert.equal(findClip(r.mix, r.ids[0]).clip.key, undefined);
  assert.equal(r.mix.key, null);
  r = must(takeToNotes(withTake().mix, withTake().id, [tune()], 'H#'));
  assert.equal(findClip(r.mix, r.ids[0]).clip.key, undefined, 'not a key');
  r = must(takeToNotes(withTake().mix, withTake().id, [tune(8, { follows: false })], 'C'));
  assert.equal('follows' in findClip(r.mix, r.ids[0]).clip, false, 'follows only when true');
});

test('a trimmed take: the notes start on its beat, from their own start, as long as the room there', () => {
  let { mix, id } = withTake({ beats: 12, at: 2 });
  mix = must(trimClip(mix, id, { start: 4 })).mix; // from 2
  mix = must(trimClip(mix, id, { len: 6 })).mix;
  assert.deepEqual((({ start, len, from }) => [start, len, from])(findClip(mix, id).clip), [4, 6, 2]);
  // something right after it on the track: the notes stop there
  mix = must(addBacking(mix, 0, 'beat-rock', 'sunny', 10)).mix;
  let r = must(takeToNotes(mix, id, [tune(12)], 'C'));
  let c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [4, 0, 12, 6], 'from its first note; as long as the room to the next clip');
  r = must(takeToNotes(mix, id, [tune(2)], 'C'));
  c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [4, 0, 2, 2]);
  // a longer tune than the take grows into the room there
  ({ mix, id } = withTake({ beats: 4 }));
  r = must(takeToNotes(mix, id, [tune(10)], 'C'));
  c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [0, 0, 10, 10]);
  // the band too starts from its own start
  ({ mix, id } = withTake({ beats: 12, at: 2 }));
  mix = must(trimClip(mix, id, { start: 4 })).mix;
  r = must(takeToNotes(mix, id, [tune(8), bandPart(8)], 'C'));
  c = findClip(r.mix, r.ids[1]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [4, 0, 8, 8]);
});

test('the readings of a trimmed take are made from the stretch the kid kept', () => {
  // 120 a minute (0.5 s a beat), 0.06 s of lead; a note on every beat of 12, C D E F G A B C D E F G
  const midis = [60, 62, 64, 65, 67, 69, 71, 72, 74, 76, 77, 79];
  const heard = midis.map((midi, i) => ({ midi, on: 0.06 + i * 0.5 + 0.01, off: 0.06 + i * 0.5 + 0.4, vel: 0.6 }));
  let { mix, id } = withTake({ beats: 12, mix: { ...newMix(), bpm: 120 } });
  let c = findClip(mix, id).clip;
  assert.equal(keptHeard(heard, c, 120).length, 12, 'untrimmed: all of it');
  assert.deepEqual(keptHeard(heard, c, 120)[0], heard[0], 'and as it was');
  mix = must(trimClip(mix, id, { start: 4 })).mix; // beats 4 to 11 kept
  mix = must(trimClip(mix, id, { len: 5 })).mix; // beats 4 to 8
  c = findClip(mix, id).clip;
  const kept = keptHeard(heard, c, 120);
  assert.deepEqual(kept.map((n) => n.midi), [67, 69, 71, 72, 74]);
  assert.ok(Math.abs(kept[0].on - (0.06 + 0.01)) < 1e-9, 'timed from the kept beat, the lead still before it');
  assert.ok(Math.abs(kept[0].off - (0.06 + 0.4)) < 1e-9);
  // a note a touch early for the first kept beat is kept; one just before the end is not
  const early = keptHeard([{ midi: 60, on: 0.06 + 2 - 0.05, off: 2.5 }, { midi: 62, on: 0.06 + 4.5 - 0.01, off: 5 }], c, 120);
  assert.deepEqual(early.map((n) => n.midi), [60]);
  // a note held past the end ends there
  assert.ok(Math.abs(keptHeard([{ midi: 60, on: 0.06 + 4, off: 9 }], c, 120)[0].off - (0.06 + 2.5)) < 1e-9, 'the kept stretch is 2.5 s');
  const opts = readingOptions({ ...mix, meter: 4 }, c);
  assert.deepEqual(opts, { bpm: 120, meter: 4, lead: 0.06, beats: 5, swing: 0, barAt: 0 });
  // the bar's beat is where the clip is now
  const moved = must(moveClip(mix, id, 0, 6)).mix;
  assert.equal(readingOptions(moved, findClip(moved, id).clip).barAt, 2);
});

test('the band version: the tune in the take\'s place, the band on the track with the most room', () => {
  let { mix, id } = withTake({ beats: 8, track: 1, at: 4 });
  // track 0 has 2 beats of room at beat 4, track 2 is empty, track 3 has 6
  mix = must(addBacking(mix, 0, 'beat-rock', 'sunny', 6)).mix;
  mix = must(trimClip(mix, mix.tracks[0][0].id, { len: 2 })).mix;
  mix = must(addBacking(mix, 3, 'beat-rock', 'sunny', 10)).mix;
  const r = must(takeToNotes(mix, id, [tune(8), bandPart(10)], 'C'));
  assert.equal(r.ids.length, 2);
  const t = findClip(r.mix, r.ids[0]);
  const b = findClip(r.mix, r.ids[1]);
  assert.equal(t.track, 1);
  assert.equal(b.track, 2, 'the empty track');
  assert.equal(b.clip.role, 'band');
  assert.deepEqual([b.clip.start, b.clip.len, b.clip.from, b.clip.total], [4, 10, 0, 10]);
  assert.notEqual(b.clip.nid, t.clip.nid);
  // the band version's voices are the clips' own sound, not a voice of the kid's choosing
  assert.deepEqual([t.clip.own, t.clip.voice], ['beep', undefined]);
  assert.deepEqual([b.clip.own, b.clip.voice], ['organ', undefined]);
  assert.deepEqual([ownVoice(t.clip), notesVoice(t.clip), ownVoice(b.clip), notesVoice(b.clip)], ['beep', 'beep', 'organ', 'organ']);
  assert.equal(readingVoice('band', 'tune'), 'beep');
  assert.equal(readingVoice('tidy', 'tune'), null);
  assert.equal(readingVoice('heard', 'tune'), null);
  // the band part sits well under the tune it was made for; every other part plays at full level
  assert.ok(roleLevel('band') > 0.2 && roleLevel('band') < 0.6);
  assert.equal(roleLevel('tune'), 1);
  assert.equal(roleLevel(undefined), 1);
  assert.equal(roleLevel('toString'), 1);
  assert.equal(remixed(t.clip), false);
  assert.equal(remixed(b.clip), false);
  // what is played: the voice it plays in
  const plan = schedule(r.mix);
  assert.deepEqual([plan.find((e) => e.id === t.clip.id).voice, plan.find((e) => e.id === b.clip.id).voice], ['beep', 'organ']);
  assert.equal(plan.find((e) => e.id === t.clip.id).own, 'beep');
  // a copy keeps it
  const copy = must(copyClip(r.mix, t.clip.id));
  assert.equal(findClip(copy.mix, copy.id).clip.own, 'beep');
  // the band is cut to the room there
  const full = must(addBacking(mix, 2, 'beat-rock', 'sunny', 7)).mix; // track 2: 3 beats of room at beat 4
  const r2 = must(takeToNotes(full, id, [tune(8), bandPart(10)], 'C'));
  const b2 = findClip(r2.mix, r2.ids[1]);
  assert.deepEqual([b2.track, b2.clip.len], [3, 6], 'track 3 now has the most room: 6 beats');
});

test('the band version earns no Remixer by itself; the kid\'s own pick of a voice does', () => {
  const { mix, id } = withTake({ beats: 8 });
  const r = must(takeToNotes(mix, id, [tune(), bandPart()], 'C'));
  const [tuneId, bandId] = r.ids;
  const ids = (m) => badges(m).map((b) => b.id);
  assert.ok(!ids(r.mix).includes('remixer'));
  // another voice: Remixer
  let v = must(setVoice(r.mix, tuneId, 'flute'));
  assert.equal(findClip(v.mix, tuneId).clip.voice, 'flute');
  assert.equal(notesVoice(findClip(v.mix, tuneId).clip), 'flute');
  assert.ok(ids(v.mix).includes('remixer'));
  // its own voice again: no voice of its own choosing, and no Remixer
  v = must(setVoice(v.mix, tuneId, 'beep'));
  assert.equal(findClip(v.mix, tuneId).clip.voice, undefined);
  assert.equal(findClip(v.mix, tuneId).clip.own, 'beep');
  assert.ok(!ids(v.mix).includes('remixer'));
  v = must(setVoice(v.mix, bandId, 'strings'));
  assert.ok(ids(v.mix).includes('remixer'));
  v = must(setVoice(v.mix, bandId, null));
  assert.deepEqual([findClip(v.mix, bandId).clip.voice, notesVoice(findClip(v.mix, bandId).clip)], [undefined, 'organ'], '"Its own sound" is the organ');
  assert.ok(!ids(v.mix).includes('remixer'));
  // the steel drum is a voice of the kid's choosing for a clip whose own is Beep
  v = must(setVoice(r.mix, tuneId, 'steel'));
  assert.equal(findClip(v.mix, tuneId).clip.voice, 'steel');
  assert.ok(ids(v.mix).includes('remixer'));
  // the default voices don't move the notes; the kid's first pick may (as for any clip)
  assert.equal(findClip(r.mix, tuneId).clip.shift, undefined);
  const deep = must(setVoice(r.mix, tuneId, 'deep'));
  assert.ok(findClip(deep.mix, tuneId).clip.shift < 0, 'Deep bass moves it down');
});

test('the band version needs room on another track; nothing changes without it', () => {
  let { mix, id } = withTake({ beats: 8, track: 0, at: 0 });
  for (const t of [1, 2, 3]) mix = must(addBacking(mix, t, 'beat-rock', 'sunny', 0)).mix; // 16 beats each, at beat 0
  const r = takeToNotes(mix, id, [tune(), bandPart()], 'C');
  assert.equal(r.error, 'The band needs an empty spot on another track. Make some room and try again.');
  assert.equal(r.mix, mix);
  assert.deepEqual(r.ids, []);
  // one beat of room is enough
  mix = must(trimClip(mix, mix.tracks[3][0].id, { start: 1 })).mix;
  const ok = must(takeToNotes(mix, id, [tune(), bandPart()], 'C'));
  assert.deepEqual([findClip(ok.mix, ok.ids[1]).track, findClip(ok.mix, ok.ids[1]).clip.len], [3, 1]);
});

test('no notes, no take: turned down', () => {
  const { mix, id } = withTake();
  assert.equal(takeToNotes(mix, id, [tune(8, { notes: [] })], 'C').error, 'There were no notes to use.');
  assert.equal(takeToNotes(mix, id, [tune(), { ...bandPart(), notes: [] }], 'C').error, 'There were no notes to use.');
  assert.equal(takeToNotes(mix, id, [], 'C').error, 'There were no notes to use.');
  assert.equal(takeToNotes(mix, id, null, 'C').error, 'There were no notes to use.');
  assert.equal(takeToNotes(mix, 99, [tune()], 'C').error, 'That recording is gone.');
  const part = must(addPart(newMix(), 0, 'bg-meadow', 'lead'));
  assert.equal(takeToNotes(part.mix, part.id, [tune()], 'C').error, 'That recording is gone.', 'only a take');
});

/** A mix in C with the kid's tune (in `key`) on track 0. */
function notesMix(key = 'C') {
  const { mix, id } = withTake({ beats: 8 });
  const r = must(takeToNotes({ ...mix, key: 'C' }, id, [tune(8)], key));
  return { mix: r.mix, id: r.ids[0] };
}

test('a notes clip takes a voice, goes higher and lower, and moves into the mix\'s key', () => {
  let { mix, id } = notesMix('D');
  let r = must(setVoice(mix, id, 'deep'));
  let c = findClip(r.mix, id).clip;
  assert.equal(c.voice, 'deep');
  assert.ok(c.shift < 0, 'Deep bass moves it down where it sounds best');
  r = must(setVoice(r.mix, id, NOTES_VOICE));
  assert.equal(findClip(r.mix, id).clip.voice, undefined, 'the steel drum is its own sound');
  r = must(setVoice(mix, id, null));
  assert.equal(findClip(r.mix, id).clip.voice, undefined);
  // higher and lower
  r = must(shiftClip(mix, id, 12));
  assert.equal(findClip(r.mix, id).clip.shift, 12);
  assert.equal(clipKey(findClip(r.mix, id).clip), 'D', 'an octave keeps the key');
  assert.match(shiftClip(r.mix, id, 24).error, /higher/, 'C7 is too high');
  r = must(shiftClip(mix, id, -12));
  r = must(shiftClip(r.mix, id, -12));
  assert.match(shiftClip(r.mix, id, -12).error, /lower/);
  // keys
  c = findClip(mix, id).clip;
  assert.equal(clipKey(c), 'D');
  assert.equal(clipFits(mix, c), false, 'D major in a mix in C');
  r = must(moveIntoKey(mix, id));
  c = findClip(r.mix, id).clip;
  assert.equal(c.shift, -2);
  assert.equal(clipKey(c), 'C');
  assert.equal(clipFits(r.mix, c), true);
  assert.match(moveIntoKey(r.mix, id).error, /already goes with C major/);
  // A minor goes with C major already; no key: nothing to move
  ({ mix, id } = notesMix('Am'));
  assert.equal(clipFits(mix, findClip(mix, id).clip), true);
  ({ mix, id } = notesMix(null));
  assert.equal(clipKey(findClip(mix, id).clip), null);
  assert.equal(clipFits(mix, findClip(mix, id).clip), true);
  assert.equal(moveIntoKey(mix, id).error, 'That clip has no key to move.');
});

test('a notes clip is copied, trimmed, moved and kept through the loop\'s changes like any clip', () => {
  const { mix, id } = notesMix('C');
  const c = findClip(mix, id).clip;
  let r = must(copyClip(mix, id));
  const copy = findClip(r.mix, r.id).clip;
  assert.deepEqual([copy.start, copy.nid, copy.notes, copy.kind, copy.role], [8, c.nid, c.notes, 'notes', 'tune'], 'a copy shares the notes and their name');
  r = must(trimClip(mix, id, { start: 2 }));
  assert.deepEqual((({ start, len, from }) => [start, len, from])(findClip(r.mix, id).clip), [2, 6, 2]);
  r = must(trimClip(r.mix, id, { len: 99 }));
  assert.equal(findClip(r.mix, id).clip.len, 6, 'never longer than its notes');
  r = must(moveClip(mix, id, 2, 5));
  assert.deepEqual([findClip(r.mix, id).track, findClip(r.mix, id).clip.start, findClip(r.mix, id).clip.nid], [2, 5, c.nid]);
  r = must(setBpm(mix, 140));
  assert.equal(r.mix.bpm, 140);
  r = must(setBars(mix, 2));
  assert.equal(findClip(r.mix, id).clip.len, 8);
  r = must(removeClip(mix, id));
  assert.equal(findClip(r.mix, id), null);
  // what is played: the notes and their name go along
  const e = schedule(mix).find((x) => x.id === id);
  assert.deepEqual([e.kind, e.nid, e.role, e.notes, e.follows, e.at, e.offset], ['notes', c.nid, 'tune', c.notes, true, 0, 0]);
  assert.equal(e.dur, 8 * 0.6);
});

test('notes swing with the mix only when they sit on straight eighths', () => {
  // the sunset song swings
  let mix = must(addPart(newMix(), 0, 'bg-sunset', 'lead')).mix;
  const swing = backingSwing(mix);
  assert.ok(swing > 0);
  const t = must(addTake(mix, 1, 'take-1', 8, 0));
  const straight = must(takeToNotes(t.mix, t.id, [tune(8)], 'C'));
  const free = must(takeToNotes(t.mix, t.id, [tune(8, { follows: false })], 'C'));
  mix = straight.mix;
  assert.equal(clipSwing(mix, findClip(mix, straight.ids[0]).clip), swing);
  assert.equal(clipSwing(free.mix, findClip(free.mix, free.ids[0]).clip), 0);
  const back = must(addBacking(mix, 2, 'beat-rock', 'sunny', 0));
  assert.equal(clipSwing(back.mix, findClip(back.mix, back.id).clip), swing, 'a backing track as before');
});

test('stickers: Note-o-Matic for notes, Band leader for a band; your playing counts as yours', () => {
  const { mix, id } = withTake();
  assert.deepEqual(badges(mix).map((b) => b.id), ['take']);
  const tidy = must(takeToNotes(mix, id, [tune()], 'C'));
  const ids = badges(tidy.mix).map((b) => b.id);
  assert.ok(ids.includes('notes'));
  assert.ok(!ids.includes('leader'));
  assert.ok(ids.includes('take'), 'notes are still the kid\'s own playing');
  const band = must(takeToNotes(mix, id, [tune(), bandPart()], 'C'));
  const all = badges(band.mix);
  assert.ok(all.some((b) => b.id === 'leader' && b.name === 'Band leader' && b.why === 'A band played along with your tune.'));
  assert.ok(all.some((b) => b.id === 'notes' && b.name === 'Note-o-Matic' && b.why === 'You turned your playing into notes.'));
  // every track: one-kid band, but a band made for the tune isn't the kid
  let solo = { ...newMix(), bpm: 100 };
  for (let t = 0; t < 4; t += 1) solo = must(addTake(solo, t, `take-${t}`, 4, 0)).mix;
  assert.ok(badges(solo).some((b) => b.id === 'solo'));
  const turned = must(takeToNotes(solo, solo.tracks[0][0].id, [tune(4)], 'C'));
  assert.ok(badges(turned.mix).some((b) => b.id === 'solo'), 'notes of the kid\'s playing count');
  let three = must(removeClip(solo, solo.tracks[3][0].id)).mix;
  three = must(takeToNotes(three, three.tracks[0][0].id, [tune(4), bandPart(4)], 'C')).mix;
  assert.equal(three.tracks[3][0].role, 'band');
  assert.ok(!badges(three).some((b) => b.id === 'solo'), 'the band isn\'t the kid');
  // played along with a song's part: a duet
  const song = must(addPart(tidy.mix, 2, 'bg-meadow', 'bass'));
  assert.ok(badges(song.mix).some((b) => b.id === 'duet'));
});

test('any key with a key signature can be the mix\'s key, and backing tracks follow it', () => {
  for (const key of ['C', 'G#m', 'Ebm', 'F#', 'C#', 'Cb', 'A#m', 'Abm', 'Db', 'D#m', 'Bbm', 'Ddor']) {
    assert.equal(validKey(key), true, key);
    const raw = { ...newMix(), key, tracks: [[], [], [], []] };
    assert.equal(cleanMix(raw).key, key, `${key} is kept`);
    for (const mood of ['major', 'minor']) {
      const k = backingKey(key, mood);
      assert.equal(sameSig(k, key), true, `${key} ${mood}: ${k}`);
      assert.doesNotThrow(() => keyInfo(k));
    }
    assert.doesNotThrow(() => keyInfo(shiftKey(key, 5)));
  }
  for (const key of ['H', 'G#', 'Fb', 'cm', '', 'C major', 7, null, 'E#m']) {
    assert.equal(validKey(key), false, String(key));
    assert.equal(cleanMix({ ...newMix(), key, tracks: [[], [], [], []] }).key, null);
  }
  // a notes clip in an unusual key moves into a mix in another
  const { mix, id } = notesMix('G#m');
  const r = must(moveIntoKey(mix, id));
  assert.equal(clipFits(r.mix, findClip(r.mix, id).clip), true);
});

test('a notes clip is read back from storage as it was', () => {
  let { mix, id } = notesMix('Bbm');
  mix = must(setVoice(mix, id, 'flute')).mix;
  mix = must(shiftClip(mix, id, 12)).mix;
  const t = must(addTake(mix, 1, 'take-2', 8, 0));
  const band = must(takeToNotes(t.mix, t.id, [tune(), bandPart()], 'Bbm'));
  const stored = JSON.parse(JSON.stringify(band.mix));
  const back = cleanMix(stored);
  const noIds = (m) => m.tracks.map((t) => t.map(({ id: _, ...c }) => c));
  assert.deepEqual(noIds(back), noIds(band.mix), 'everything but the ids, which are counted again');
  assert.equal(back.key, 'C');
  assert.equal(back.next, 4);
  assert.deepEqual(back.tracks.flat().map((c) => [c.own, c.voice]), [[undefined, 'flute'], ['beep', undefined], ['organ', undefined]], 'the voices they started in are kept');
  // a mix with no key takes the notes'
  const nokey = cleanMix({ ...stored, key: null });
  assert.equal(nokey.key, 'Bbm');
});

test('bad notes clips in storage are tidied or dropped, and never stop the studio', () => {
  const { mix } = notesMix('C');
  const good = mix.tracks[0][0];
  const one = (clip, extra = {}) => cleanMix({ ...mix, ...extra, tracks: [[clip], [], [], []] }).tracks[0];
  assert.equal(one(good).length, 1);
  // its name and role
  for (const nid of [undefined, '', 7, 'x'.repeat(41), null, {}]) assert.deepEqual(one({ ...good, nid }), [], `nid ${String(nid)}`);
  assert.equal(one({ ...good, nid: 'x'.repeat(40) }).length, 1);
  for (const role of [undefined, 'lead', '', 3]) assert.deepEqual(one({ ...good, role }), [], `role ${role}`);
  // the notes
  for (const notes of [undefined, null, 'C D E', {}, [], [null, 3, 'x']]) assert.deepEqual(one({ ...good, notes }), [], `notes ${JSON.stringify(notes)}`);
  const odd = [
    { at: 0, len: 1, midi: 60 }, // fine
    { at: -1, len: 1, midi: 60 }, { at: 'x', len: 1, midi: 60 }, { at: NaN, len: 1, midi: 60 }, { at: Infinity, len: 1, midi: 60 },
    { at: 1, len: 0, midi: 60 }, { at: 1, len: -2, midi: 60 }, { at: 1, len: null, midi: 60 },
    { at: 1, len: 1, midi: 60.5 }, { at: 1, len: 1, midi: 23 }, { at: 1, len: 1, midi: 97 }, { at: 1, len: 1, midi: '60' },
    { at: 16, len: 1, midi: 60 }, // at the end of its 8 beats (16 steps): never heard
    { at: 15.5, len: 3, midi: 72, vel: 0.5 }, // fine, its extra field dropped
    null, 'note', 7,
  ];
  const kept = one({ ...good, notes: odd })[0].notes;
  assert.deepEqual(kept, [{ at: 0, len: 1, midi: 60 }, { at: 15.5, len: 3, midi: 72 }]);
  // too many notes: only the first ones are kept
  const many = Array.from({ length: MOST_NOTES + 50 }, (_, i) => ({ at: (i % 16), len: 0.5, midi: 60 }));
  assert.equal(one({ ...good, notes: many })[0].notes.length, MOST_NOTES);
  // the key, follows, the voice and the shift
  assert.equal(one({ ...good, key: 'H' })[0].key, undefined);
  assert.equal(one({ ...good, key: 'F#m' })[0].key, 'F#m');
  assert.equal('follows' in one({ ...good, follows: 'yes' })[0], false);
  assert.equal('follows' in one({ ...good, follows: 1 })[0], false);
  assert.equal(one({ ...good, follows: true })[0].follows, true);
  assert.equal(one({ ...good, voice: 'kazoo' })[0].voice, undefined);
  assert.equal(one({ ...good, voice: 'steel' })[0].voice, undefined, 'its own voice is no voice');
  assert.equal(one({ ...good, voice: 'organ' })[0].voice, 'organ');
  // the voice it started in: a real voice other than the steel drum, else dropped
  assert.equal(one({ ...good, own: 'beep' })[0].own, 'beep');
  for (const own of ['kazoo', 'steel', 7, '', null, {}]) assert.equal('own' in one({ ...good, own })[0], false, `own ${String(own)}`);
  assert.deepEqual((({ own, voice }) => [own, voice])(one({ ...good, own: 'beep', voice: 'beep' })[0]), ['beep', undefined], 'a voice equal to its own is no voice');
  assert.deepEqual((({ own, voice }) => [own, voice])(one({ ...good, own: 'beep', voice: 'steel' })[0]), ['beep', 'steel']);
  assert.deepEqual((({ own, voice }) => [own, voice])(one({ ...good, own: 'kazoo', voice: 'steel' })[0]), [undefined, undefined], 'a bad own: the steel drum is its own again');
  assert.equal(one({ ...good, shift: 7 })[0].shift, 7);
  assert.equal(one({ ...good, shift: 1000 })[0].shift, 24, 'C4 to C5 can go up 2 octaves');
  assert.equal(one({ ...good, shift: -1000 })[0].shift, -24);
  assert.equal(one({ ...good, notes: [{ at: 0, len: 1, midi: 90 }], shift: 24 })[0].shift, undefined, 'too high: back by octaves');
  assert.equal(one({ ...good, shift: 'up' })[0].shift, undefined);
  // never longer than a loop can be (84 beats): a stored clip can't ask for a huge render
  assert.equal(mostNotesBeats(4), 84);
  assert.equal(mostNotesBeats(3), 84);
  let big = one({ ...good, total: 20000, notes: [{ at: 0, len: 1e12, midi: 60 }, { at: 167.5, len: 4, midi: 62 }, { at: 168, len: 1, midi: 64 }, { at: 39000, len: 1, midi: 65 }] })[0];
  assert.deepEqual([big.total, big.from, big.len], [84, 0, 8]);
  assert.deepEqual(big.notes, [{ at: 0, len: 168, midi: 60 }, { at: 167.5, len: 4, midi: 62 }], 'notes past it dropped, lengths capped');
  big = one({ ...good, start: 0, len: 4, from: 82, total: 1000 })[0];
  assert.deepEqual([big.total, big.from, big.len], [84, 82, 2], 'cut to what is left of it');
  assert.deepEqual(one({ ...good, len: 4, from: 999996, total: 1000000 }), [], 'starting past it: nothing to keep');
  // takeToNotes keeps to it as well
  const huge = must(takeToNotes(withTake().mix, withTake().id, [tune(5000, { notes: [{ at: 0, len: 9999, midi: 60 }, { at: 9000, len: 1, midi: 62 }] })], 'C'));
  const h = findClip(huge.mix, huge.ids[0]).clip;
  assert.deepEqual([h.total, h.notes], [84, [{ at: 0, len: 168, midi: 60 }]]);
  assert.equal(takeToNotes(withTake().mix, withTake().id, [tune(5000, { notes: [{ at: 9000, len: 1, midi: 62 }] })], 'C').error, 'There were no notes to use.');
  // the place: like every clip
  assert.deepEqual(one({ ...good, total: 4 }), [], 'shorter than it is long');
  assert.deepEqual(one({ ...good, start: 1.5 }), []);
  assert.deepEqual(one({ ...good, start: mixBeats(mix) }), [], 'past the loop');
  // a whole bad save still opens
  for (const raw of [null, 7, { tracks: 'x' }, { tracks: [[{ kind: 'notes' }], null, [7]] }, { ...mix, key: 'Zm', tracks: [[{ ...good, notes: [[60]] }, { ...good, start: 9, nid: 'b' }]] }]) {
    assert.ok(Array.isArray(cleanMix(raw).tracks));
  }
});

// ---------- the pace of the kid's notes ----------

test('half speed and double speed: the notes play paced, and Normal brings them back exactly', () => {
  const { mix, id } = withTake({ beats: 8, track: 1, at: 4 });
  const r = must(takeToNotes({ ...mix, bars: 8 }, id, [tune(8)], 'C'));
  const tid = r.ids[0];
  const before = findClip(r.mix, tid).clip;
  const half = must(setPace(r.mix, tid, 'half'));
  const h = findClip(half.mix, tid).clip;
  assert.equal(paceOf(h), 'half');
  assert.deepEqual([h.start, h.from, h.len, h.total, h.norm], [4, 0, 16, 16, 8], 'twice as long, from the same beat');
  assert.deepEqual(h.notes, before.notes, 'the notes themselves are kept as they were');
  assert.deepEqual(pacedNotes(h).map((n) => [n.at, n.len]), before.notes.map((n) => [2 * n.at, 2 * n.len]), 'and play twice as late and long');
  assert.equal(half.note, '');
  const back = must(setPace(half.mix, tid, null));
  assert.deepEqual(findClip(back.mix, tid).clip, before, 'Normal: exactly as it was');
  const dbl = must(setPace(r.mix, tid, 'double'));
  const d = findClip(dbl.mix, tid).clip;
  assert.deepEqual([d.start, d.from, d.len, d.total, d.norm, d.pace], [4, 0, 4, 4, 8, 'double']);
  assert.deepEqual(pacedNotes(d).map((n) => n.at), [0, 1, 2, 3], 'on quarter beats (a step is an eighth)');
  assert.deepEqual(pacedNotes(d).map((n) => n.len), before.notes.map((n) => n.len / 2));
  assert.deepEqual(findClip(must(setPace(dbl.mix, tid, null)).mix, tid).clip, before, 'and back');
  // half to double and back to half
  const hd = must(setPace(half.mix, tid, 'double'));
  assert.deepEqual(findClip(must(setPace(hd.mix, tid, 'half')).mix, tid).clip, h);
  // the same pace again changes nothing; a part of a song can't change pace
  assert.equal(setPace(half.mix, tid, 'half').mix, half.mix);
  const p = must(addPart(newMix(), 0, 'bg-meadow', 'lead'));
  assert.match(setPace(p.mix, p.id, 'half').error, /Only notes/);
  // odd values: anything else is normal
  assert.deepEqual(findClip(must(setPace(half.mix, tid, 'triple')).mix, tid).clip, before);
});

test('a slower clip that doesn\'t fit is cut and says why; trimming works on the paced clip', () => {
  const { mix, id } = withTake({ beats: 8, track: 0, at: 0 });
  const r = must(takeToNotes({ ...mix, bars: 3 }, id, [tune(8)], 'C')); // 12 beats
  const tid = r.ids[0];
  const half = must(setPace(r.mix, tid, 'half'));
  assert.equal(findClip(half.mix, tid).clip.len, 12, 'cut at the end of the mix');
  assert.equal(findClip(half.mix, tid).clip.total, 16, 'the clip still holds all of it');
  assert.equal(half.note, 'Your tune is longer than this mix, so its end is cut off. Make the mix longer to hear more.');
  // the next clip on the track
  const blocked = must(addBacking({ ...r.mix, bars: 8 }, 0, 'beat-rock', 'sunny', 10)).mix;
  const hb = must(setPace(blocked, tid, 'half'));
  assert.equal(findClip(hb.mix, tid).clip.len, 10);
  assert.match(hb.note, /^Your tune stops where the next clip on its track starts/);
  // cut at half speed, then Normal: all of it again, and nothing to say
  for (const m of [half.mix, hb.mix]) {
    const n = must(setPace(m, tid, null));
    assert.equal(findClip(n.mix, tid).clip.len, 8);
    assert.equal(n.note, '');
  }
  // Normal with something now in the way: cut, and said
  const dbl = must(setPace({ ...r.mix, bars: 8 }, tid, 'double')).mix; // 4 beats
  const nb = must(setPace(must(addBacking(dbl, 0, 'beat-rock', 'sunny', 5)).mix, tid, null));
  assert.deepEqual(((c) => [c.from, c.len, c.total])(findClip(nb.mix, tid).clip), [0, 5, 8]);
  assert.match(nb.note, /^Your tune stops where the next clip on its track starts/);
  // trimmed, then paced: from and len scale with it
  const roomy = { ...r.mix, bars: 8 };
  const trimmed = must(trimClip(roomy, tid, { start: 2, len: 5 })).mix; // from 2, 5 beats
  const t2 = findClip(trimmed, tid).clip;
  assert.deepEqual([t2.start, t2.from, t2.len], [2, 2, 5]);
  const th = findClip(must(setPace(trimmed, tid, 'half')).mix, tid).clip;
  assert.deepEqual([th.start, th.from, th.len, th.total], [2, 4, 10, 16]);
  const back = findClip(must(setPace(must(setPace(trimmed, tid, 'half')).mix, tid, null)).mix, tid).clip;
  assert.deepEqual([back.start, back.from, back.len, back.total], [2, 2, 5, 8], 'half and back is exact');
  // into double, an odd beat rounds outward so nothing that played is lost
  const td = findClip(must(setPace(trimmed, tid, 'double')).mix, tid).clip;
  assert.deepEqual([td.from, td.len, td.total], [1, 3, 4], 'beats 2 to 7 become 1 to 3.5: 1 to 4');
  // a paced clip trims, copies and moves as any clip
  const tt = must(trimClip(must(setPace(roomy, tid, 'half')).mix, tid, { len: 6 }));
  assert.equal(findClip(tt.mix, tid).clip.len, 6);
  const cp = must(copyClip(tt.mix, tid));
  assert.deepEqual([findClip(cp.mix, cp.id).clip.pace, findClip(cp.mix, cp.id).clip.norm], ['half', 8]);
  const mv = must(moveClip(tt.mix, tid, 2, 4));
  assert.equal(findClip(mv.mix, tid).clip.pace, 'half');
});

test('a tune\'s band changes pace with it, wherever it is', () => {
  const { mix, id } = withTake({ beats: 8, track: 1, at: 4 });
  const r = must(takeToNotes({ ...mix, bars: 8 }, id, [tune(8), bandPart(8)], 'C'));
  const [tid, bid] = r.ids;
  assert.ok(findClip(r.mix, tid).clip.pair);
  assert.equal(findClip(r.mix, tid).clip.pair, findClip(r.mix, bid).clip.pair, 'they are a pair');
  const half = must(setPace(r.mix, tid, 'half'));
  assert.deepEqual([findClip(half.mix, bid).clip.pace, findClip(half.mix, bid).clip.len], ['half', 16], 'the band too');
  // from the band, both go back
  const back = must(setPace(half.mix, bid, null));
  assert.equal(paceOf(findClip(back.mix, tid).clip), null);
  assert.deepEqual(back.mix.tracks, r.mix.tracks);
  // a band moved (or trimmed at its front) still goes with its tune, wherever it starts
  const moved = must(moveClip(r.mix, bid, 3, 0)).mix;
  const both = must(setPace(moved, tid, 'half'));
  assert.equal(paceOf(findClip(both.mix, bid).clip), 'half');
  assert.equal(findClip(both.mix, bid).clip.start, 0, 'each keeps its own start');
  const front = must(trimClip(r.mix, bid, { start: 6 })).mix;
  assert.equal(paceOf(findClip(must(setPace(front, tid, 'double')).mix, bid).clip), 'double');
  // only clips at the same pace: a band already at another pace stays as it is
  const apart = structuredClone(half.mix);
  Object.assign(findClip(apart, bid).clip, { len: 8, total: 8 });
  for (const k of ['pace', 'norm', 'back']) delete findClip(apart, bid).clip[k];
  const dbl = must(setPace(apart, tid, 'double')).mix;
  assert.deepEqual([paceOf(findClip(dbl, tid).clip), paceOf(findClip(dbl, bid).clip)], ['double', null]);
  assert.deepEqual(findClip(dbl, bid).clip, findClip(apart, bid).clip);
  // a copy of the tune isn't the band's partner: it has no pair, and changes on its own
  const cp = must(copyClip(r.mix, tid));
  assert.equal(findClip(cp.mix, cp.id).clip.pair, undefined, 'the copy drops the pair');
  assert.ok(findClip(cp.mix, tid).clip.pair, 'the tune keeps it');
  const cpHalf = must(setPace(cp.mix, cp.id, 'half'));
  assert.equal(paceOf(findClip(cpHalf.mix, bid).clip), null);
  assert.equal(paceOf(findClip(cpHalf.mix, tid).clip), null);
  assert.equal(paceOf(findClip(must(setPace(cp.mix, tid, 'half')).mix, cp.id).clip), null, 'nor does it change with them');
});

test('a band cut at its new pace says so too', () => {
  const { mix, id } = withTake({ beats: 8, track: 1, at: 0 });
  const r = must(takeToNotes({ ...mix, bars: 8 }, id, [tune(8), bandPart(8)], 'C'));
  const [tid, bid] = r.ids;
  const bt = findClip(r.mix, bid).track;
  // something after the band only
  const m1 = must(addBacking(r.mix, bt, 'beat-rock', 'sunny', 12)).mix;
  const h1 = must(setPace(m1, tid, 'half'));
  assert.deepEqual([findClip(h1.mix, tid).clip.len, findClip(h1.mix, bid).clip.len], [16, 12]);
  assert.equal(h1.note, 'The band that goes with your tune stops where the next clip on its track starts. Move that clip, or put it on an empty track.');
  assert.equal(must(setPace(m1, bid, 'half')).note, 'Your band stops where the next clip on its track starts. Move that clip, or put your band on an empty track.');
  // something after both
  const m2 = must(addBacking(m1, 1, 'beat-rock', 'sunny', 12)).mix;
  assert.equal(must(setPace(m2, tid, 'half')).note, 'Your tune and its band stop where the next clips on their tracks start. Move those clips, or put them on empty tracks.');
  // both past the end of the mix
  const m3 = { ...r.mix, bars: 3 };
  assert.equal(must(setPace(m3, bid, 'half')).note, 'Your band and its tune are longer than this mix, so their ends are cut off. Make the mix longer to hear more.');
  // the tune at the end, the band by the next clip
  const m4 = must(addBacking({ ...r.mix, bars: 3 }, bt, 'beat-rock', 'sunny', 10)).mix;
  assert.equal(must(setPace(m4, tid, 'half')).note, 'Your tune is longer than this mix, so its end is cut off. Make the mix longer to hear more. The band that goes with your tune stops where the next clip on its track starts. Move that clip, or put it on an empty track.');
});

test('Normal gives back the very window a clip had, whatever was cut on the way', () => {
  // every window of a 7- and an 8-beat clip, through every pace sequence of up to three steps,
  // in a roomy mix and with something in the way (the next clip, or the end of the mix)
  const seqs = [];
  const grow = (seq) => { if (seq.length) seqs.push(seq); if (seq.length < 3) for (const p of ['half', 'double']) if (seq.at(-1) !== p) grow([...seq, p]); };
  grow([]);
  let checked = 0;
  for (const beats of [7, 8]) {
    const { mix, id } = withTake({ beats, track: 0, at: 2 });
    const r = must(takeToNotes({ ...mix, bars: 12 }, id, [tune(beats)], 'C'));
    const tid = r.ids[0];
    for (let from = 0; from < beats; from += 1) {
      for (let len = 1; from + len <= beats; len += 1) {
        const w = must(trimClip(must(trimClip(r.mix, tid, { start: 2 + from })).mix, tid, { len })).mix;
        const c0 = findClip(w, tid).clip;
        assert.deepEqual([c0.start, c0.from, c0.len], [2 + from, from, len]);
        const ways = [
          ['roomy', w],
          ['a clip in the way', must(addBacking(w, 0, 'beat-rock', 'sunny', c0.start + len)).mix],
          ['the end of the mix', { ...w, bars: Math.ceil((c0.start + len) / 4) }],
        ];
        for (const [why, m0] of ways) {
          for (const seq of seqs) {
            let m = m0;
            for (const p of seq) m = must(setPace(m, tid, p)).mix;
            const c = findClip(must(setPace(m, tid, null)).mix, tid).clip;
            assert.deepEqual(c, findClip(m0, tid).clip, `${beats} beats, from ${from}, len ${len}, ${why}: ${seq.join(' > ')} > Normal`);
            checked += 1;
          }
        }
      }
    }
  }
  assert.equal(checked, (28 + 36) * 3 * 6);
});

test('a paced clip trimmed: its normal window follows the edge that moved', () => {
  const { mix, id } = withTake({ beats: 8, track: 0, at: 0 });
  const r = must(takeToNotes({ ...mix, bars: 8 }, id, [tune(8)], 'C'));
  const tid = r.ids[0];
  // after a front trim by an odd number of beats, Double and Normal: right where it was
  const odd = must(trimClip(r.mix, tid, { start: 1 })).mix;
  const d = findClip(must(setPace(odd, tid, 'double')).mix, tid).clip;
  assert.deepEqual([d.start, d.from, d.len, d.back], [1, 0, 4, { from: 1, len: 7 }]);
  const n = findClip(must(setPace(must(setPace(odd, tid, 'double')).mix, tid, null)).mix, tid).clip;
  assert.deepEqual([n.start, n.from, n.len], [1, 1, 7], 'not a beat late');
  // trimmed at half speed: the back edge moves, the front stays exactly
  const half = must(setPace(odd, tid, 'half')).mix; // from 2, len 14
  const tb = must(trimClip(half, tid, { len: 7 })).mix; // paced beats 2 to 9: normal 1 to 4.5
  assert.deepEqual(findClip(tb, tid).clip.back, { from: 1, len: 4 }, 'rounded outward');
  assert.deepEqual(((c) => [c.start, c.from, c.len])(findClip(must(setPace(tb, tid, null)).mix, tid).clip), [1, 1, 4]);
  // the front edge moves: from it, rounded down, and the end stays
  const tf = must(trimClip(half, tid, { start: 4 })).mix; // paced from 5: normal 2.5
  assert.deepEqual(findClip(tf, tid).clip.back, { from: 2, len: 6 });
  // a trim that changes nothing keeps the window
  assert.deepEqual(findClip(must(trimClip(half, tid, {})).mix, tid).clip.back, { from: 1, len: 7 });
  // moving and copying keep it
  assert.deepEqual(findClip(must(moveClip(tb, tid, 2, 0)).mix, tid).clip.back, { from: 1, len: 4 });
  const cp = must(copyClip(tb, tid));
  assert.deepEqual(findClip(cp.mix, cp.id).clip.back, { from: 1, len: 4 });
});

test('a paced clip is kept as it was, and odd paces are read back as normal', () => {
  const { mix, id } = withTake({ beats: 8, track: 1, at: 4 });
  const r = must(takeToNotes({ ...mix, bars: 8 }, id, [tune(8), bandPart(8)], 'C'));
  const dbl = must(setPace(r.mix, r.ids[0], 'double')).mix;
  const noIds = (m) => m.tracks.map((t) => t.map(({ id: _, ...c }) => c));
  assert.deepEqual(noIds(cleanMix(JSON.parse(JSON.stringify(dbl)))), noIds(dbl), 'pace, normal length and pair kept');
  const d = findClip(dbl, r.ids[0]).clip;
  assert.equal(cleanMix(JSON.parse(JSON.stringify(dbl))).tracks[1][0].notes.length, d.notes.length, 'no note past the paced length is dropped');
  const odd = JSON.parse(JSON.stringify(dbl));
  odd.tracks[1][0].pace = 'triple';
  const o = cleanMix(odd).tracks[1][0];
  assert.equal(paceOf(o), null);
  assert.equal(o.norm, undefined);
  const lost = JSON.parse(JSON.stringify(must(setPace(r.mix, r.ids[0], 'half')).mix));
  delete lost.tracks[1][0].norm;
  assert.equal(cleanMix(lost).tracks[1][0].norm, 8, 'a lost normal length is worked out from the paced one');
  // the remembered window: kept when it fits the normal length, else dropped (not the clip)
  assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(dbl))).tracks[1][0].back, { from: 0, len: 8 });
  for (const back of [{ from: 1, len: 8 }, { from: -1, len: 2 }, { from: 0, len: 0 }, { from: 0.5, len: 2 }, { from: '0', len: 2 }, [0, 2], null, 'x']) {
    const bad = JSON.parse(JSON.stringify(dbl));
    bad.tracks[1][0].back = back;
    const c = cleanMix(bad).tracks[1][0];
    assert.equal(c.back, undefined, JSON.stringify(back));
    assert.equal(c.pace, 'double', 'the clip stays');
  }
  const normal = JSON.parse(JSON.stringify(r.mix));
  normal.tracks[1][0].back = { from: 0, len: 2 };
  assert.equal(cleanMix(normal).tracks[1][0].back, undefined, 'only a paced clip has one');
  // a paced clip doesn't swing, and its sound is played paced
  assert.equal(clipSwing({ ...dbl, tracks: dbl.tracks }, d), 0);
  assert.equal(schedule(dbl).find((e) => e.id === d.id).pace, 'double');
});
