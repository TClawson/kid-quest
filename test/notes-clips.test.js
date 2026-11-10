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
  trimClip, moveClip, setBpm, setBars, removeClip, schedule, badges, cleanMix, takesIn, remixed, clipSwing, backingSwing,
  readingVoice, validKey, newNid, mixBeats, NOTES_VOICE, MOST_NOTES,
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

test('a trimmed take: the notes keep its place, and where in it the clip starts while that is inside', () => {
  let { mix, id } = withTake({ beats: 12, at: 2 });
  mix = must(trimClip(mix, id, { start: 4 })).mix; // from 2
  mix = must(trimClip(mix, id, { len: 6 })).mix;
  assert.deepEqual((({ start, len, from }) => [start, len, from])(findClip(mix, id).clip), [4, 6, 2]);
  // something right after it on the track: the notes stop there
  mix = must(addBacking(mix, 0, 'beat-rock', 'sunny', 10)).mix;
  let r = must(takeToNotes(mix, id, [tune(12)], 'C'));
  let c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [4, 2, 12, 6], 'from kept; as long as the room to the next clip');
  // the tidied tune is shorter than where the take was trimmed: it starts from its beginning
  r = must(takeToNotes(mix, id, [tune(2)], 'C'));
  c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [4, 0, 2, 2]);
  // a longer tune than the take grows into the room there
  ({ mix, id } = withTake({ beats: 4 }));
  r = must(takeToNotes(mix, id, [tune(10)], 'C'));
  c = findClip(r.mix, r.ids[0]).clip;
  assert.deepEqual([c.start, c.from, c.total, c.len], [0, 0, 10, 10]);
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
  // the band version's voices
  assert.equal(t.clip.voice, 'beep');
  assert.equal(b.clip.voice, 'organ');
  assert.equal(readingVoice('band', 'tune'), 'beep');
  assert.equal(readingVoice('tidy', 'tune'), null);
  assert.equal(readingVoice('heard', 'tune'), null);
  assert.ok(remixed(t.clip), 'a voice that isn\'t the notes\' own');
  // the band is cut to the room there
  const full = must(addBacking(mix, 2, 'beat-rock', 'sunny', 7)).mix; // track 2: 3 beats of room at beat 4
  const r2 = must(takeToNotes(full, id, [tune(8), bandPart(10)], 'C'));
  const b2 = findClip(r2.mix, r2.ids[1]);
  assert.deepEqual([b2.track, b2.clip.len], [3, 6], 'track 3 now has the most room: 6 beats');
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
  assert.equal(one({ ...good, shift: 7 })[0].shift, 7);
  assert.equal(one({ ...good, shift: 1000 })[0].shift, 24, 'C4 to C5 can go up 2 octaves');
  assert.equal(one({ ...good, shift: -1000 })[0].shift, -24);
  assert.equal(one({ ...good, notes: [{ at: 0, len: 1, midi: 90 }], shift: 24 })[0].shift, undefined, 'too high: back by octaves');
  assert.equal(one({ ...good, shift: 'up' })[0].shift, undefined);
  // the place: like every clip
  assert.deepEqual(one({ ...good, total: 4 }), [], 'shorter than it is long');
  assert.deepEqual(one({ ...good, start: 1.5 }), []);
  assert.deepEqual(one({ ...good, start: mixBeats(mix) }), [], 'past the loop');
  // a whole bad save still opens
  for (const raw of [null, 7, { tracks: 'x' }, { tracks: [[{ kind: 'notes' }], null, [7]] }, { ...mix, key: 'Zm', tracks: [[{ ...good, notes: [[60]] }, { ...good, start: 9, nid: 'b' }]] }]) {
    assert.ok(Array.isArray(cleanMix(raw).tracks));
  }
});
