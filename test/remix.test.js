// The recording studio's remix kit: the finer pieces of songs, backing tracks, voices, kits,
// higher and lower (js/remix.js, js/studiokit.js and the rules in js/studiorules.js), and the
// notes the studio plays checked against the game's own music engine (js/music.js).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, SHOW_SONGS } from '../js/songs.js';
import { fakeAudio } from './helpers/fake-audio.mjs';
import { VOICES, KITS, LOOPS, BACKING, backingEvents } from '../js/studiokit.js';
import { partEvents, clipEvents, clipSound, backingKey, keyTonic, shiftKey, noteSpan, sameSig } from '../js/remix.js';
import {
  newMix, addPart, addBacking, setLoop, setVoice, setKit, shiftClip, fitShift, moveIntoKey, clipFits, clipKey, remixed,
  moveClip, trimClip, copyClip, findClip, schedule, cleanMix, badges, splitShift, mixBeats, PART_NAMES, backingSwing, sourceOf,
  setTrackVolume, muteTrack, trackVolume, trackGain, VOLUME_DB,
} from '../js/studiorules.js';

// the music engine renders through the browser's OfflineAudioContext: give it one that writes the notes down
const { FakeAudioContext, played } = fakeAudio();
globalThis.OfflineAudioContext = class extends FakeAudioContext {
  startRendering() { return Promise.resolve({ getChannelData: () => new Float32Array(4) }); }
};
const { renderPart, renderEvents, songParts, swingAt, GAME_KIT, levelGain } = await import('../js/music.js');

const must = (r) => { assert.equal(r.error, null, r.error || ''); return r; };
const allSongs = [...Object.keys(SONGS), ...Object.keys(SHOW_SONGS).map((k) => `show:${k}`)];
const near = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} vs ${b}`);

/**
 * What music.js plays for one part of a song through renderPart, as { at (steps, swung), midi }
 * for notes, { at, kick } for kicks and toms (true for a kick), { at, noise } for snares and hats.
 */
async function heard(id, part, bpm = 120) {
  played.length = 0;
  await renderPart(id, part, bpm, 44100);
  const step = 60 / bpm / 2;
  return played.map((n) => (n.noise ? { at: n.t / step, noise: true } : n.swept ? { at: n.t / step, kick: n.f === GAME_KIT.kick[0] } : { at: n.t / step, midi: n.midi }));
}

/** partEvents as music.js would place them: swung, and drums as heard. */
function expected(id, part) {
  const song = id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] : SONGS[id];
  return partEvents(id, part).map((e) => {
    const at = swingAt(e.at, song.swing || 0);
    if (e.midi != null) return { at, midi: e.midi };
    if (e.kind === 'k' || e.kind === 't') return { at, kick: e.kind === 'k' };
    return { at, noise: true };
  });
}
const sorted = (list) => [...list].sort((a, b) => a.at - b.at || (a.midi ?? 0) - (b.midi ?? 0) || String(a.kick).localeCompare(String(b.kick)) || String(a.noise).localeCompare(String(b.noise)));
function same(got, want, msg) {
  assert.equal(got.length, want.length, `${msg}: how many`);
  const [g, w] = [sorted(got), sorted(want)];
  g.forEach((x, i) => {
    near(x.at, w[i].at, `${msg}: event ${i}'s time`);
    assert.deepEqual({ ...x, at: 0 }, { ...w[i], at: 0 }, `${msg}: event ${i}`);
  });
}

test('partEvents is exactly what the game plays: a straight song and a swung one, every part', async () => {
  for (const id of ['bg-meadow', 'bg-sunset']) {
    assert.ok(id === 'bg-meadow' ? !SONGS[id].swing : SONGS[id].swing > 0);
    for (const part of songParts(id)) {
      const want = expected(id, part);
      assert.ok(want.length > 0, `${id} ${part} has notes`);
      same(await heard(id, part), want, `${id} ${part}`);
    }
  }
  // and the whole song's parts add up: every drum is in the beat or the cymbals, once
  for (const id of allSongs) {
    const drums = partEvents(id, 'drums').length;
    assert.equal(partEvents(id, 'beat').length + partEvents(id, 'cymbals').length, drums, id);
  }
});

test('the new pieces of a song: the hook is its first two bars, the cymbals only when there are some', () => {
  assert.deepEqual(songParts('bg-meadow'), ['lead', 'hook', 'arp', 'bass', 'drums', 'beat', 'cymbals']);
  assert.deepEqual([PART_NAMES.beat, PART_NAMES.cymbals, PART_NAMES.hook], ['Kick and snare', 'Cymbals', 'Hook']);
  for (const id of allSongs) {
    const song = id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] : SONGS[id];
    const beat = song.beat || 8;
    const hook = partEvents(id, 'hook');
    assert.deepEqual(hook, partEvents(id, 'lead').filter((e) => e.at < 2 * beat), `${id}: the hook is the tune's first two bars`);
    const hats = [...song.drums.flat(), ...(song.fill || [])].some((l) => /[ho]/.test(l));
    assert.equal(songParts(id).includes('cymbals'), hats, `${id}: cymbals only when the drums have them`);
    assert.ok(partEvents(id, 'cymbals').every((e) => 'ho'.includes(e.kind)));
    assert.ok(partEvents(id, 'beat').every((e) => 'kst'.includes(e.kind)));
  }
  // a hook clip is 2 bars long; a waltz's is 6 beats
  const { mix } = must(addPart(newMix(), 0, 'bg-meadow', 'hook'));
  assert.deepEqual([mix.tracks[0][0].len, mix.tracks[0][0].total], [8, 8]);
  assert.equal(must(addPart(newMix(), 0, 'bg-ocean', 'hook')).mix.tracks[0][0].total, 6);
});

test('the game kit is the game\'s drums: the studio\'s kit and the music engine agree', () => {
  const { name, icon, ...chip } = KITS.chip;
  assert.ok(name && icon);
  assert.deepEqual(chip, GAME_KIT);
});

test('renderEvents plays the notes moved, swung, and in the voice and kit asked for', async () => {
  played.length = 0;
  const notes = [{ at: 0, len: 1, midi: 60 }, { at: 1, len: 1, midi: 64 }];
  await renderEvents(notes, { bpm: 120, steps: 2, voice: 'beep', shift: 12, swing: 0.25 });
  const step = 0.25;
  assert.deepEqual(played.map((n) => n.midi), [72, 76], 'an octave up');
  near(played[1].t, 1.25 * step, 'the second eighth comes late');
  played.length = 0;
  await renderEvents([{ at: 0, kind: 'k' }, { at: 1, kind: 't' }, { at: 2, kind: 'h' }], { bpm: 120, steps: 4, kit: 'big' });
  assert.deepEqual(played.filter((n) => n.swept).map((n) => n.f), [KITS.big.kick[0], KITS.big.tom[0]], 'the big kit\'s kick and tom');
  assert.equal(played.filter((n) => n.noise).length, 1, 'and a hat');
});

test('backing tracks play in the mix\'s key: sunny loops in its major key, moody ones in its minor key', () => {
  assert.equal(backingKey(null, 'major'), 'C');
  assert.equal(backingKey(null, 'minor'), 'Am');
  assert.equal(backingKey('G', 'minor'), 'Em');
  assert.equal(backingKey('Dm', 'major'), 'F');
  assert.equal(backingKey('Ddor', 'minor'), 'Am', 'D dorian has no sharps or flats');
  assert.equal(backingKey('Bb', 'minor'), 'Gm');
  assert.equal(keyTonic('Em'), 4);
  // a bass line in a G major mix, on the sunny loop: G, D, E, C under the four bars
  const clip = { kind: 'backing', pattern: 'bass-steady', loop: 'sunny' };
  const roots = [0, 1, 2, 3].map((bar) => clipEvents(clip, 'G').find((e) => e.at === bar * 8).midi % 12);
  assert.deepEqual(roots, [7, 2, 4, 0]);
  assert.deepEqual(clipEvents(clip, 'G'), backingEvents('bass-steady', { loop: 'sunny', tonic: 7 }));
  // spooky in a G mix plays in E minor; with no key, in A minor
  assert.equal(clipEvents({ ...clip, loop: 'spooky' }, 'G')[0].midi % 12, 4);
  assert.equal(clipEvents({ ...clip, loop: 'spooky' }, null)[0].midi % 12, 9);
  // a drum backing is the same in every key
  assert.deepEqual(clipEvents({ kind: 'backing', pattern: 'beat-rock', loop: 'sunny' }, 'G'), backingEvents('beat-rock'));
  assert.equal(clipSound({ kind: 'backing', pattern: 'beat-rock' }), 'drums');
  assert.equal(clipSound({ kind: 'backing', pattern: 'chords-held' }), 'notes');
  assert.equal(clipSound({ kind: 'take', take: 'x' }), null);
  // every backing track is 4 bars of its own beat, with notes in the range a clip may use
  for (const [id, b] of Object.entries(BACKING)) {
    for (const loop of Object.keys(LOOPS)) {
      for (const key of ['C', 'G', 'Dm', 'Bb', 'E']) {
        const events = clipEvents({ kind: 'backing', pattern: id, loop }, key);
        assert.ok(events.length && events.every((e) => e.at >= 0 && e.at < 4 * b.meter * 2), `${id} ${loop} ${key}`);
        const span = noteSpan(events);
        if (span) assert.ok(span.low >= 24 && span.high <= 96, `${id}: ${span.low} to ${span.high}`);
      }
    }
  }
});

test('adding backing tracks: an empty mix takes their beat and speed 120, the wrong beat is turned down', () => {
  let r = must(addBacking(newMix(), 0, 'beat-waltz'));
  assert.deepEqual([r.mix.meter, r.mix.bpm, r.mix.key, r.mix.bars], [3, 120, null, 8], 'a drum backing sets no key');
  assert.deepEqual(r.mix.tracks[0][0], { id: 1, kind: 'backing', pattern: 'beat-waltz', loop: 'sunny', start: 0, len: 12, from: 0, total: 12 });
  assert.equal(addBacking(r.mix, 1, 'bass-steady').error, "Steady bass has 4 beats in a bar, and this mix has 3. They can't play together.");
  r = must(addBacking(r.mix, 1, 'bass-waltz', 'spooky'));
  assert.equal(r.mix.key, 'Am', 'a moody backing with notes: A minor');
  assert.equal(must(addBacking(newMix(), 0, 'chords-held', 'sunny')).mix.key, 'C');
  assert.equal(addBacking(newMix(), 0, 'nope').error, 'That backing track is not in the studio.');
  assert.equal(addBacking(newMix(), 0, 'bass-steady', 'nope').error, 'Pick the chords first.');
  // a backing in a song's mix: its meter, its speed and key stay
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  mix = must(addBacking(mix, 1, 'chords-held', 'oldtime')).mix;
  assert.deepEqual([mix.bpm, mix.key], [SONGS['bg-meadow'].bpm, 'C']);
  assert.equal(addBacking(mix, 2, 'beat-waltz').error, "Waltz beat has 3 beats in a bar, and this mix has 4. They can't play together.");
  // a mix with only drums takes the key of the first song part
  mix = must(addBacking(newMix(), 0, 'beat-rock')).mix;
  mix = must(addPart(mix, 1, 'bg-sunset', 'bass')).mix;
  assert.deepEqual([mix.key, mix.bpm], ['F', 120]);
  // the chord loop: every backing with notes follows it, drums don't care
  mix = must(addBacking(mix, 2, 'bass-walk', 'sunny')).mix;
  mix = must(addBacking(mix, 3, 'chords-hop', 'sunny')).mix;
  const looped = setLoop(mix, 'spooky');
  assert.equal(looped.changed, 2);
  assert.deepEqual(looped.mix.tracks.flat().filter((c) => c.kind === 'backing').map((c) => c.loop), ['sunny', 'spooky', 'spooky']);
  assert.equal(setLoop(looped.mix, 'spooky').changed, 0);
  assert.equal(setLoop(mix, 'nope').error, 'Pick the chords first.');
});

test('voices, kits, higher and lower: only on clips that have notes or drums', () => {
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  mix = must(addPart(mix, 1, 'bg-meadow', 'drums')).mix;
  mix = must(addBacking(mix, 2, 'bass-steady', 'sunny')).mix;
  assert.equal(setKit(mix, 1, 'big').error, 'Only drums can change their kit.');
  assert.equal(setVoice(mix, 2, 'flute').error, 'Only music with notes can change its voice.');
  assert.equal(shiftClip(mix, 2, 12).error, 'Only music with notes can go higher or lower.');
  assert.equal(setVoice(mix, 1, 'nope').error, 'That voice is not in the studio.');
  assert.equal(setKit(mix, 2, 'nope').error, 'That kit is not in the studio.');
  assert.equal(setVoice(mix, 99, 'flute').error, 'That clip is gone.');
  // a kit; the game kit is no change at all
  let r = must(setKit(mix, 2, 'tiny'));
  assert.equal(findClip(r.mix, 2).clip.kit, 'tiny');
  assert.equal(findClip(must(setKit(r.mix, 2, 'chip')).mix, 2).clip.kit, undefined);
  // the tune (A4 to G6) on Deep bass (home: octave 2) goes down as far as it may, 2 octaves
  r = must(setVoice(mix, 1, 'deep'));
  assert.equal(r.octaves, -2);
  assert.deepEqual([findClip(r.mix, 1).clip.voice, findClip(r.mix, 1).clip.shift], ['deep', -24]);
  // a second voice doesn't move it again; its own sound keeps where it was moved
  const again = must(setVoice(r.mix, 1, 'musicbox'));
  assert.deepEqual([again.octaves, findClip(again.mix, 1).clip.shift], [0, -24]);
  const own = must(setVoice(again.mix, 1, null)).mix;
  assert.deepEqual([findClip(own, 1).clip.voice, findClip(own, 1).clip.shift], [undefined, -24]);
  // a voice near its home doesn't move; one whose home is past the highest note doesn't either
  assert.equal(must(setVoice(mix, 1, 'beep')).octaves, 0, 'Beep is at home in octave 5, where the tune is');
  assert.equal(must(setVoice(mix, 1, 'musicbox')).octaves, 0, 'a Music box (octave 6) would take the tune past MIDI 96');
  // the bass on a Flute (octave 5) goes up as far as it may: 2 octaves
  const bassMix = must(addPart(mix, 3, 'bg-meadow', 'bass'));
  assert.equal(must(setVoice(bassMix.mix, bassMix.id, 'flute')).octaves, 2);
  // a backing's own voice is no change; its pattern's voice is its own sound
  const bass = must(setVoice(mix, 3, 'deep'));
  assert.equal(findClip(bass.mix, 3).clip.voice, undefined);
  assert.equal(remixed(findClip(bass.mix, 3).clip), false);
  // a clip moved by octaves already keeps them when it gets a voice
  const up = must(shiftClip(mix, 1, -12)).mix;
  const kept = must(setVoice(up, 1, 'musicbox'));
  assert.deepEqual([kept.octaves, findClip(kept.mix, 1).clip.shift], [0, -12]);
  // higher and lower: notes stay from MIDI 24 to 96 (the tune goes up to G6, 91)
  assert.equal(shiftClip(mix, 1, 12).error, 'It can\'t go any higher. Its notes would be too high to hear well.');
  let low = mix;
  for (let i = 0; i < 2; i += 1) low = must(shiftClip(low, 1, -12)).mix;
  assert.equal(findClip(low, 1).clip.shift, -24);
  assert.equal(shiftClip(low, 1, -12).error, 'It can\'t go any lower. Its notes would be too low to hear well.');
  // back to where it was: no shift is kept
  assert.equal(findClip(must(shiftClip(must(shiftClip(mix, 1, -12)).mix, 1, 12)).mix, 1).clip.shift, undefined);
  assert.deepEqual(splitShift(14), { octaves: 1, rest: 2 });
  assert.deepEqual(splitShift(-17), { octaves: -1, rest: -5 });
  assert.deepEqual(splitShift(-6), { octaves: 0, rest: -6 });
});

test('moving into the mix\'s key: the smallest move, octaves kept, and then it fits', () => {
  assert.equal(fitShift('F', 'C'), -5);
  assert.equal(fitShift('G', 'C'), 5);
  assert.equal(fitShift('D', 'C'), -2);
  assert.equal(fitShift('Dm', 'G'), 2, 'D minor up a step is E minor, G major\'s key signature');
  assert.equal(fitShift('Am', 'C'), 0);
  assert.equal(fitShift('C', 'F#'), -6);
  for (const from of ['C', 'F', 'G', 'D', 'Bb', 'Dm', 'Em', 'Am', 'Ddor', 'E', 'Eb']) {
    for (const to of ['C', 'F', 'G', 'D', 'Bb', 'Dm', 'Am']) {
      const k = fitShift(from, to);
      assert.ok(k >= -6 && k <= 5, `${from} to ${to}: ${k}`);
      assert.ok(sameSig(shiftKey(from, k), to), `${from} moved ${k} is ${shiftKey(from, k)}, with ${to}'s signature`);
    }
  }
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix; // C major
  mix = must(addPart(mix, 1, 'bg-sunset', 'lead')).mix; // F major
  mix = must(shiftClip(mix, 2, -12)).mix;
  const clip = findClip(mix, 2).clip;
  assert.equal(clipFits(mix, clip), false);
  assert.equal(clipKey(clip), 'F');
  const moved = must(moveIntoKey(mix, 2)).mix;
  const after = findClip(moved, 2).clip;
  assert.equal(after.shift, -12 - 5, 'down a fourth, and still the octave lower');
  assert.equal(clipKey(after), 'C');
  assert.equal(clipFits(moved, after), true, 'it goes with the mix now');
  assert.equal(moveIntoKey(moved, 2).error, 'It already goes with C major.');
  assert.equal(moveIntoKey(moved, 1).error, 'It already goes with C major.');
  // the Perfect match sticker counts a part moved into the key
  assert.ok(!badges(mix).some((b) => b.id === 'match'));
  assert.ok(badges(moved).some((b) => b.id === 'match'));
  // drums have no key to move
  const drums = must(addPart(moved, 2, 'bg-sunset', 'drums'));
  assert.equal(moveIntoKey(drums.mix, drums.id).error, 'That clip has no key to move.');
  assert.equal(clipFits(drums.mix, findClip(drums.mix, drums.id).clip), true);
});

test('moving, trimming and copying keep how a clip is played, and schedule passes it on', () => {
  let mix = must(addBacking(newMix(), 0, 'chords-push', 'adventure')).mix;
  mix = must(setVoice(mix, 1, 'strings')).mix;
  mix = must(shiftClip(mix, 1, 12)).mix;
  mix = must(addBacking(mix, 1, 'beat-gallop')).mix;
  mix = must(setKit(mix, 2, 'big')).mix;
  const how = (m, id) => { const c = findClip(m, id).clip; return [c.voice, c.shift, c.kit, c.loop, c.pattern]; };
  const before = [how(mix, 1), how(mix, 2)];
  mix = must(moveClip(mix, 1, 2, 4)).mix;
  mix = must(trimClip(mix, 1, { start: 6 })).mix;
  mix = must(trimClip(mix, 2, { len: 8 })).mix;
  const copy = must(copyClip(mix, 2));
  assert.deepEqual([how(mix, 1), how(mix, 2)], before);
  assert.deepEqual(how(copy.mix, copy.id), before[1]);
  const plan = schedule(copy.mix);
  const chords = plan.find((e) => e.id === 1);
  assert.deepEqual([chords.kind, chords.pattern, chords.loop, chords.voice, chords.shift], ['backing', 'chords-push', 'adventure', 'strings', 12]);
  near(chords.at, 6 * 0.5, 'its time');
  near(chords.offset, 2 * 0.5, 'trimmed at the front');
  assert.deepEqual([plan.find((e) => e.id === 2).kit, plan.find((e) => e.id === copy.id).kit], ['big', 'big']);
  // a song's part without changes has no remix fields at all
  const plain = schedule(must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix)[0];
  assert.deepEqual(Object.keys(plain).sort(), ['at', 'dur', 'id', 'kind', 'offset', 'part', 'song', 'take', 'track']);
});

test('the new stickers: Remixer and House band, and the old ones as they were', () => {
  let mix = must(addBacking(newMix(), 0, 'beat-steady')).mix;
  mix = must(addBacking(mix, 1, 'bass-bounce', 'campfire')).mix;
  assert.deepEqual(badges(mix), []);
  mix = must(addBacking(mix, 2, 'chords-held', 'campfire')).mix;
  assert.deepEqual(badges(mix), [{ id: 'house', name: 'House band', why: 'A beat, a bass line and chords from the backing tracks.' }]);
  // cymbals and sparkles don't count as the beat or the chords
  let other = must(addBacking(newMix(), 0, 'cym-fast')).mix;
  other = must(addBacking(other, 1, 'bass-bounce')).mix;
  other = must(addBacking(other, 2, 'sparkle-up')).mix;
  assert.ok(!badges(other).some((b) => b.id === 'house'));
  // a new voice or kit
  assert.ok(badges(must(setKit(mix, 1, 'tiny')).mix).some((b) => b.id === 'remixer'));
  const voiced = badges(must(setVoice(mix, 2, 'robot')).mix).find((b) => b.id === 'remixer');
  assert.deepEqual(voiced, { id: 'remixer', name: 'Remixer', why: 'You gave the music a new sound.' });
  // moving higher alone is no new sound
  assert.ok(!badges(must(shiftClip(mix, 2, 12)).mix).some((b) => b.id === 'remixer'));
  // a full band from one song is still a full band, and parts of two songs still a remix
  let song = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  song = must(addPart(song, 1, 'bg-meadow', 'bass')).mix;
  song = must(addPart(song, 2, 'bg-meadow', 'drums')).mix;
  song = must(addPart(song, 3, 'bg-rainbow', 'hook')).mix;
  assert.deepEqual(badges(song).map((b) => b.id), ['band', 'remix']);
});

test('a saved mix with remix fields is tidied: unknown voices, kits, patterns and loops, shifts kept in range', () => {
  const raw = {
    name: 'Remix', bpm: 120, meter: 4, bars: 8, key: 'G',
    tracks: [
      [
        { kind: 'part', song: 'bg-meadow', part: 'hook', start: 0, len: 8, from: 0, total: 64, voice: 'flute', shift: 12.4 },
        { kind: 'part', song: 'bg-meadow', part: 'lead', start: 8, len: 8, from: 0, total: 64, voice: 'kazoo', kit: 'big', shift: 99 },
        { kind: 'part', song: 'bg-meadow', part: 'cymbals', start: 16, len: 8, from: 0, total: 64, kit: 'tiny', voice: 'flute', shift: 5 },
      ],
      [
        { kind: 'backing', pattern: 'chords-held', loop: 'spooky', start: 0, len: 16, from: 0, total: 16, voice: 'organ' },
        { kind: 'backing', pattern: 'bass-walk', loop: 'nope', start: 16, len: 16, from: 0, total: 16, shift: -12, kit: 'big' },
      ],
      [
        { kind: 'backing', pattern: 'nope', loop: 'sunny', start: 0, len: 16, from: 0, total: 16 },
        { kind: 'backing', pattern: 'beat-waltz', loop: 'sunny', start: 16, len: 12, from: 0, total: 12 },
        { kind: 'backing', pattern: 'beat-rock', start: 4, len: 20, from: 0, total: 40, kit: 'chip' },
      ],
      [{ kind: 'part', song: 'bg-meadow', part: 'nope', start: 0, len: 4, from: 0, total: 64 }],
    ],
  };
  const mix = cleanMix(raw);
  const [hook, lead, cym] = mix.tracks[0];
  assert.deepEqual(hook, { id: 1, kind: 'part', song: 'bg-meadow', part: 'hook', start: 0, len: 8, from: 0, total: 8, voice: 'flute', shift: 12 }, 'a hook is 2 bars; the shift a whole number');
  // (99 is cut to 2 octaves, 24; the tune reaches G6, 91, so 24 and 12 are both too high: no move is left)
  assert.deepEqual([lead.voice, lead.kit, lead.shift], [undefined, undefined, undefined], 'an unknown voice dropped, no kit on notes, the shift at most 2 octaves and the notes in range');
  assert.deepEqual([cym.kit, cym.voice, cym.shift], ['tiny', undefined, undefined], 'drums keep a kit and nothing else');
  const [chords, bass] = mix.tracks[1];
  assert.deepEqual(chords, { id: 4, kind: 'backing', pattern: 'chords-held', loop: 'spooky', start: 0, len: 16, from: 0, total: 16 }, 'its own voice is no voice');
  // (the sunny bass line in G starts on G1, MIDI 31: an octave lower would be 19, too low to hear well)
  assert.deepEqual([bass.loop, bass.shift, bass.kit], ['sunny', undefined, undefined], 'an unknown loop is the sunny one; the notes in range');
  assert.deepEqual(mix.tracks[2].map((c) => [c.pattern, c.start, c.len, c.total, c.kit, c.loop]), [['beat-rock', 4, 16, 16, undefined, 'sunny']],
    'an unknown pattern and one of another beat are dropped; a backing is never longer than 4 bars');
  assert.deepEqual(mix.tracks[3], []);
  assert.equal(mix.key, 'G');
  // a mix of backing tracks only, its key lost: the backing's mood gives it one
  assert.equal(cleanMix({ ...raw, key: 'H', tracks: [raw.tracks[1]] }).key, 'Am');
  assert.equal(cleanMix({ ...raw, key: null, tracks: [[raw.tracks[2][2]]] }).key, null, 'drums alone have no key');
  // a waltz mix keeps its waltz backing
  assert.equal(cleanMix({ ...raw, meter: 3, tracks: [[{ ...raw.tracks[2][1], start: 0 }]] }).tracks[0].length, 1);
  // what it gives back is clean already
  assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(mix))), mix);
  assert.ok(mixBeats(mix) === 32 && Object.keys(VOICES).length === 10);
});

// ---------- a chord loop, a stored mix and the Perfect match sticker keep to the rules ----------

/** The notes a clip plays in a mix, its shift too: { low, high }. */
const spanIn = (mix, c) => { const sp = noteSpan(clipEvents(c, mix.key)); return { low: sp.low + (c.shift || 0), high: sp.high + (c.shift || 0) }; };
const songKeys = [...new Set(allSongs.map((id) => sourceOf(id).key))];

test('a new chord loop keeps every backing track\'s notes in range: back by the fewest whole octaves', () => {
  let cases = 0;
  let movedBack = 0;
  for (const [pattern, b] of Object.entries(BACKING)) {
    if (b.kind !== 'notes') continue;
    for (const key of [...songKeys, 'E', 'B', 'F#', 'Db', 'Ab']) {
      for (const from of Object.keys(LOOPS)) {
        const add = must(addBacking(newMix(), 0, pattern, from));
        for (const by of [24, 12, 0, -12, -24]) {
          // moved as far as the kid could move it on the first chords
          let mix = { ...add.mix, key };
          let ok = true;
          for (let i = 0; i < Math.abs(by) / 12 && ok; i += 1) {
            const r = shiftClip(mix, add.id, Math.sign(by) * 12);
            if (r.error) ok = false; else mix = r.mix;
          }
          if (!ok) continue;
          const was = findClip(mix, add.id).clip.shift || 0;
          for (const to of Object.keys(LOOPS)) {
            const r = setLoop(mix, to);
            const c = findClip(r.mix, add.id).clip;
            const shift = c.shift || 0;
            const what = `${pattern} in ${key}, moved ${by}, ${from} to ${to}`;
            cases += 1;
            const { low, high } = spanIn(r.mix, c);
            assert.ok(low >= 24 && high <= 96, `${what}: notes ${low} to ${high}`);
            assert.ok(shift % 12 === 0 && Math.abs(shift) <= 24, `${what}: shift ${shift}`);
            assert.equal(c.loop, to);
            if (shift === was) { assert.ok(!r.moved.length, what); continue; }
            movedBack += 1;
            assert.deepEqual(r.moved, [{ id: add.id, octaves: (shift - was) / 12 }], what);
            // the fewest octaves: one octave less of a move would still be out of range
            const less = { ...c, shift: shift - 12 * Math.sign(shift - was) };
            const sp = spanIn(r.mix, less);
            assert.ok(sp.low < 24 || sp.high > 96, `${what}: ${shift} is not the nearest shift that fits`);
          }
        }
      }
    }
  }
  assert.ok(cases > 3000 && movedBack > 100, `${cases} cases, ${movedBack} moved back`);
  // a bass line moved an octave down in an E minor mix on the Marching loop, then the Sunny one
  // (G major, down to G0, MIDI 19): back up an octave
  let mix = must(addPart(newMix(), 0, 'bg-volcano', 'lead')).mix;
  mix = must(addBacking(mix, 1, 'bass-walk', 'marching')).mix;
  mix = must(shiftClip(mix, 2, -12)).mix;
  let r = setLoop(mix, 'sunny');
  assert.deepEqual([r.changed, r.moved, findClip(r.mix, 2).clip.shift], [1, [{ id: 2, octaves: 1 }], undefined]);
  // chords 2 octaves up in a D major mix, then the Spooky loop (B minor, up to MIDI 97): back down one
  let d = must(addPart(newMix(), 0, 'bg-castle', 'lead')).mix;
  d = must(addBacking(d, 1, 'chords-held', 'sunny')).mix;
  d = must(shiftClip(must(shiftClip(d, 2, 12)).mix, 2, 12)).mix;
  r = setLoop(d, 'spooky');
  assert.deepEqual([r.moved, findClip(r.mix, 2).clip.shift], [[{ id: 2, octaves: -1 }], 12]);
  // drums don't change, and a loop that changes nothing moves nothing
  assert.deepEqual(setLoop(must(addBacking(newMix(), 0, 'beat-rock')).mix, 'spooky').moved, []);
  assert.deepEqual(setLoop(mix, 'marching').moved, []);
});

test('a stored mix with a moved clip out of range is repaired by whole octaves; old mixes load as they were', () => {
  const part = (p, shift, start = 0) => ({ kind: 'part', song: 'bg-meadow', part: p, start, len: 8, from: 0, total: p === 'hook' ? 8 : 64, ...(shift === undefined ? {} : { shift }) });
  const backing = (pattern, shift, start = 0, loop = 'sunny') => ({ kind: 'backing', pattern, loop, start, len: 16, from: 0, total: 16, ...(shift === undefined ? {} : { shift }) });
  const load = (key, ...tracks) => cleanMix({ name: 'Old', bpm: 120, meter: 4, bars: 8, key, tracks: [...tracks, [], [], [], []].slice(0, 4) });
  const shifts = (mix) => mix.tracks.flat().map((c) => c.shift);
  // the tune (A4 to G6) stored 2 octaves up: no octave up fits, so it plays where it was written
  assert.deepEqual(shifts(load('C', [part('lead', 24)])), [undefined]);
  // the hook (A4 to C6) 2 octaves up: back 1 octave; 23 up (G7 at the top): back to 11, its key kept
  assert.deepEqual(shifts(load('C', [part('hook', 24), part('hook', 23, 8), part('hook', -21, 16)])), [12, 11, -21]);
  // the bass (C2 to A3): 2 octaves up fits; 30 down is cut to 24 down, then back 1 octave (C1 is
  // MIDI 24); 14 down (to A#0) back to 2 down
  assert.deepEqual(shifts(load('C', [part('bass', 99), part('bass', -30, 8), part('bass', -14, 16)])), [24, -12, -2]);
  // a backing track only moves by whole octaves: 7 is an octave, 5 is none, -7 an octave down
  assert.deepEqual(shifts(load('C', [backing('chords-held', 7), backing('chords-hop', 5, 16)], [backing('chords-push', -7)])), [12, undefined, -12]);
  // ...and then its notes are checked in the mix's key: the walking bass in G can't go an octave
  // down on the Sunny chords (G1 is its lowest note), but it can on the Marching ones (C2)
  assert.deepEqual(shifts(load('G', [backing('bass-walk', -12)], [backing('bass-walk', -12, 0, 'marching')])), [undefined, -12]);
  // every clip of every repair plays in range, and the result is clean already
  for (const mix of [load('C', [part('lead', 24), part('arp', -24, 8)], [backing('sparkle-wave', 24), backing('bass-long', -24, 16)]), load('Bb', [backing('chords-held', 24)])]) {
    for (const c of mix.tracks.flat()) {
      const { low, high } = spanIn(mix, c);
      assert.ok(low >= 24 && high <= 96, `${c.part || c.pattern}: ${low} to ${high}`);
    }
    assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(mix))), mix);
  }
  // never a throw, never a good clip dropped
  for (const shift of [NaN, Infinity, -Infinity, 1e308, '12', [12], {}, null, 0.5, -0.5, 6, -6]) {
    const mix = load('C', [{ ...part('lead'), shift }], [{ ...backing('chords-held'), shift }]);
    assert.equal(mix.tracks.flat().length, 2, String(shift));
    for (const c of mix.tracks.flat()) assert.ok(c.shift === undefined || (Number.isInteger(c.shift) && c.shift !== 0), `${shift}: ${c.shift}`);
  }
  // a mix without the new fields (as saved before the remix kit, and with backing tracks) loads byte for byte
  let old = must(addPart(newMix('Old'), 0, 'bg-sunset', 'lead')).mix;
  old = must(addPart(old, 1, 'bg-meadow', 'drums', 4)).mix;
  old = must(addBacking(old, 2, 'bass-walk', 'adventure')).mix;
  old = must(addBacking(old, 3, 'cym-fast')).mix;
  old = must(shiftClip(old, 1, -12)).mix;
  const saved = JSON.stringify(old);
  assert.equal(JSON.stringify(cleanMix(JSON.parse(saved))), saved);
});

test('Perfect match: drums have no key, so they count neither for it nor against it', () => {
  const has = (mix) => badges(mix).some((b) => b.id === 'match');
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix; // C major
  const f = must(addPart(mix, 1, 'bg-sunset', 'lead')); // F major
  assert.equal(has(f.mix), false);
  mix = must(moveIntoKey(f.mix, f.id)).mix;
  assert.equal(has(mix), true, 'the F tune moved into C earns it');
  // the same song's drums, its kick and snare or its cymbals, and drum backing tracks keep it
  for (const p of ['drums', 'beat', 'cymbals']) assert.equal(has(must(addPart(mix, 2, 'bg-sunset', p)).mix), true, `with Island Breeze's ${PART_NAMES[p]}`);
  assert.equal(has(must(addBacking(mix, 2, 'beat-rock')).mix), true, 'with a drum backing');
  assert.equal(has(must(addBacking(mix, 2, 'chords-held', 'spooky')).mix), true, 'a backing with notes plays in the mix\'s key');
  // drums alone never earn it: a tune and another song's drums, even in the same key signature
  const one = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  for (const song of ['bg-sunset', 'bg-space', 'bg-rainforest']) {
    for (const p of ['drums', 'beat', 'cymbals']) {
      if (!songParts(song).includes(p)) continue;
      const r = must(addPart(one, 1, song, p));
      assert.equal(has(r.mix), false, `${song} ${p}`);
      assert.ok(badges(r.mix).some((b) => b.id === 'remix'), 'it is still a Remix');
    }
  }
  // a part with notes in another key still keeps it away, drums or not
  const g = must(addPart(must(addPart(mix, 2, 'bg-sunset', 'drums')).mix, 3, 'bg-galaxy', 'bass'));
  assert.equal(has(g.mix), false);
  // the words say what it means, for a kid
  const why = badges(mix).find((b) => b.id === 'match').why;
  assert.equal(why, 'All the notes fit the key of your mix.');
});

test('a backing track swings as the mix\'s song parts do: the first song part\'s swing, else none', () => {
  assert.equal(backingSwing(newMix()), 0);
  let mix = must(addBacking(newMix(), 0, 'chords-held', 'sunny')).mix;
  assert.equal(backingSwing(mix), 0, 'no song part');
  mix = must(addPart(mix, 3, 'bg-rainbow', 'drums', 4)).mix;
  assert.equal(backingSwing(mix), SONGS['bg-rainbow'].swing);
  // an earlier song part counts first, whatever its track
  mix = must(addPart(mix, 2, 'bg-meadow', 'bass', 0)).mix;
  assert.equal(backingSwing(mix), 0, 'Forest Village starts first and doesn\'t swing');
  // on the same beat, the lower track
  let same = must(addPart(newMix(), 2, 'show:bg-sunset', 'lead')).mix;
  same = must(addPart(same, 1, 'bg-castle', 'lead')).mix;
  assert.equal(backingSwing(same), 0, 'track 2 (Royal March) before track 3');
  same = must(moveClip(same, 2, 3, 0)).mix;
  assert.equal(backingSwing(same), SHOW_SONGS['bg-sunset'].swing, 'Ghost Ship on track 3, Royal March on track 4');
  // takes don't count
  assert.equal(backingSwing({ ...newMix(), tracks: [[{ id: 1, kind: 'take', take: 't', start: 0, len: 4, from: 0, total: 4 }], [], [], []] }), 0);
});

// ---------- the music engine: loudness, and sound made a second at a time ----------

test('levelGain: a steady sound peaks at `peak`; a peaky one gets up to 1.6 times that; silence is left alone', () => {
  near(levelGain(0.8, 0.77 * 0.8, 0.5), 0.5 / 0.8, 'a steady sound');
  near(levelGain(0.8, 0.9 * 0.8, 0.5), 0.5 / 0.8, 'a steadier one gets no less');
  near(levelGain(0.8, 0.77 * 0.8 / 2, 0.5), (0.5 / 0.8) * Math.SQRT2, 'half as loud on average: the square root of 2 back');
  near(levelGain(0.8, 0.01, 0.5), (0.5 / 0.8) * 1.6, 'at most 1.6 times');
  near(levelGain(0.8, 0, 0.5), 0.5 / 0.8, 'no average level: just the peak');
  assert.equal(levelGain(0, 0, 0.5), 1, 'silence');
  assert.equal(levelGain(0.8, 0.3, 0), 1, 'peak 0 leaves it as it is');
});

/**
 * An OfflineAudioContext that renders in pauses as the browser does: suspend(t) gives a
 * promise that is kept when the sound gets to t (in order), and nothing renders on until
 * resume(). It writes down every note with the pause it was handed over in (`phase`, -1
 * before the sound starts) and every note's gain that was let go (`gone`).
 */
function slicingContext() {
  const { FakeAudioContext, played } = fakeAudio();
  const gains = [];
  const log = { played, gains, pauses: [] };
  class Ctx extends FakeAudioContext {
    constructor(channels, length, rate) {
      super();
      Object.assign(this, { length, sampleRate: rate, phase: -1, waits: new Map(), going: null, rendering: false });
    }

    suspend(t) {
      if (this.rendering || this.waits.has(t)) return Promise.reject(new Error('not now'));
      return new Promise((resolve) => { this.waits.set(t, resolve); });
    }

    resume() { const go = this.going; this.going = null; go?.(); return Promise.resolve(); }

    createOscillator() {
      const o = super.createOscillator();
      const start = o.start;
      o.start = (t) => { start(t); played[played.length - 1].phase = this.phase; };
      return o;
    }

    createBufferSource() {
      const s = super.createBufferSource();
      const start = s.start;
      s.start = (t) => { start(t); played[played.length - 1].phase = this.phase; };
      return s;
    }

    createGain() {
      // a note's gain is the one with a fade on it: it ends where its last fade does
      const rec = { last: -Infinity, gone: null };
      const at = (t) => { rec.last = Math.max(rec.last, t); };
      const gain = new Proxy({}, { get: (o, k) => (k in o ? o[k] : /AtTime$/.test(k) ? (v, t) => at(t) : () => {}), set: (o, k, v) => { o[k] = v; return true; } });
      gains.push(rec);
      const ctx = this;
      return new Proxy({ gain, disconnect() { rec.gone ??= ctx.phase; } }, { get: (o, k) => (k in o ? o[k] : k === 'connect' ? (x) => x : () => {}) });
    }

    async startRendering() {
      this.rendering = true;
      const times = [...this.waits.keys()].sort((a, b) => a - b);
      log.pauses.push(times);
      for (const t of times) {
        this.phase = t;
        await new Promise((go) => { this.going = go; this.waits.get(t)(); });
      }
      return { getChannelData: () => new Float32Array(4) };
    }
  }
  return { Ctx, log };
}

/** What a render hands over, as [time, what] sorted, with the context's log. */
async function rendered(Ctx, log, render) {
  const keep = globalThis.OfflineAudioContext;
  globalThis.OfflineAudioContext = Ctx;
  log.played.length = 0;
  log.gains.length = 0;
  log.pauses.length = 0;
  try { await render(); } finally { globalThis.OfflineAudioContext = keep; }
  const notes = log.played.map((n) => ({ ...n, what: n.noise ? 'noise' : `${n.midi}${n.swept ? 's' : ''}` }));
  return { notes, sorted: notes.map((n) => [n.t, n.what].join(' ')).sort(), pauses: log.pauses.at(-1) || [], gains: [...log.gains] };
}

test('sound made a second at a time: every note once, at the same time as all at once, and before its pause', async () => {
  const sliced = slicingContext();
  const whole = slicingContext();
  // the unsliced path: a context without suspend gets every note at once
  delete whole.Ctx.prototype.suspend;
  const renders = {
    'a swung tune with an echo': () => renderPart('bg-sunset', 'lead', 120, 8000),
    'a sparkle (two notes a step)': () => renderPart('bg-rainbow', 'arp', 140, 8000),
    'swung drums': () => renderPart('bg-rainforest', 'drums', 100, 8000),
    'a waltz bass': () => renderPart('bg-ocean', 'bass', 90, 8000),
    'a backing sparkle on Strings, swung': () => renderEvents(clipEvents({ kind: 'backing', pattern: 'sparkle-up', loop: 'spooky' }, 'G'), { bpm: 110, steps: 32, voice: 'strings', swing: 0.28, sampleRate: 8000 }),
    'drums on the big kit': () => renderEvents(backingEvents('beat-gallop'), { bpm: 160, steps: 32, kit: 'big', swing: 0.2, sampleRate: 8000 }),
  };
  for (const [what, render] of Object.entries(renders)) {
    const all = await rendered(whole.Ctx, whole.log, render);
    const got = await rendered(sliced.Ctx, sliced.log, render);
    assert.ok(all.notes.length > 20, `${what}: has notes`);
    assert.ok(all.notes.every((n) => n.phase === -1) && !all.pauses.length, `${what}: all at once without suspend`);
    assert.ok(got.pauses.length >= 3, `${what}: in pauses (${got.pauses.length})`);
    assert.deepEqual(got.sorted, all.sorted, `${what}: the same notes at exactly the same times`);
    // each one handed over before the pause after which it sounds, with time to spare
    for (const n of got.notes) {
      const before = got.pauses.filter((p) => p < n.t).at(-1) ?? -1;
      assert.ok(n.phase <= before && (n.phase === -1 || n.phase + 0.05 <= n.t + 1e-9), `${what}: a note at ${n.t} handed over at ${n.phase}`);
    }
    assert.ok(got.notes.some((n) => n.phase > 0), `${what}: not all at the start`);
  }
});

test('sound made a second at a time: finished notes are let go, and a sound nobody wants stops', async () => {
  const { Ctx, log } = slicingContext();
  const events = clipEvents({ kind: 'backing', pattern: 'chords-push', loop: 'sunny' }, 'C');
  const opts = { bpm: 120, steps: 32, voice: 'strings', sampleRate: 8000 };
  // Strings has two oscillators a note: each note's gain is let go at the first pause after it ends
  const got = await rendered(Ctx, log, () => renderEvents(events, opts));
  const notes = got.gains.filter((g) => Number.isFinite(g.last));
  assert.equal(notes.length, events.length, 'one faded gain a note');
  for (const g of notes) {
    const end = g.last + 0.02;
    const first = got.pauses.find((p) => end + 0.05 <= p);
    assert.equal(g.gone ?? undefined, first, `a note ending at ${end}`);
  }
  assert.ok(notes.filter((g) => g.gone != null).length > events.length / 2, 'most are let go');
  // alive() says no after the second pause: nothing more is handed over, and it still finishes
  let asked = 0;
  const cut = await rendered(Ctx, log, () => renderEvents(events, { ...opts, alive: () => { asked += 1; return asked < 2; } }));
  const p2 = cut.pauses[1];
  assert.ok(cut.notes.length > 0 && cut.notes.every((n) => n.phase < p2), 'nothing after it said no');
  const all = events.map((e) => e.at * 0.25).filter((t) => t < p2 + 0.05);
  assert.equal(cut.notes.length, all.length * 2, 'every note up to then, two oscillators each');
  assert.ok(cut.notes.length < got.notes.length);
  // the same for a song's part
  asked = 0;
  const part = await rendered(Ctx, log, () => renderPart('bg-meadow', 'lead', 120, 8000, 0.5, () => { asked += 1; return false; }));
  assert.ok(part.notes.length > 0 && part.notes.every((n) => n.phase === -1), 'only the first second');
  assert.ok(part.notes.every((n) => n.t < part.pauses[0] + 0.05));
});

// ---------- how loud each track plays ----------

test('track volume: levels 0 to 5, 3 the usual; mute is level 0 and unmute goes back to 3', () => {
  assert.deepEqual(VOLUME_DB, [null, -12, -6, 0, 3, 6]);
  let mix = must(addPart(newMix(), 0, 'bg-meadow', 'lead')).mix;
  assert.equal('vols' in mix, false, 'a mix has no levels until one changes');
  assert.deepEqual([0, 1, 2, 3].map((t) => trackVolume(mix, t)), [3, 3, 3, 3]);
  assert.deepEqual([0, 1, 2, 3].map((t) => trackGain(mix, t)), [1, 1, 1, 1]);
  // the gains: silent, -12, -6, 0, +3, +6 dB
  const gains = [0, 1, 2, 3, 4, 5].map((v) => trackGain(must(setTrackVolume(mix, 2, v)).mix, 2));
  assert.equal(gains[0], 0);
  [-12, -6, 0, 3, 6].forEach((db, i) => near(20 * Math.log10(gains[i + 1]), db, `level ${i + 1}`));
  // a change: only that track; the same level is no change at all
  const r = must(setTrackVolume(mix, 1, 5));
  assert.deepEqual(r.mix.vols, [3, 5, 3, 3]);
  assert.equal(setTrackVolume(mix, 1, 3).mix, mix, 'the same level: the same mix');
  assert.equal(setTrackVolume(r.mix, 1, 5).mix, r.mix);
  assert.equal('vols' in mix, false, 'the old mix is left as it was');
  // turned down
  for (const [t, v] of [[4, 3], [-1, 3], [1.5, 3], ['1', 3], [0, 6], [0, -1], [0, 2.5], [0, '3'], [0, NaN]]) {
    const no = setTrackVolume(mix, t, v);
    assert.ok(no.error, `${t} ${v}`);
    assert.equal(no.mix, mix);
  }
  assert.equal(setTrackVolume(mix, 0, 6).error, 'That\'s as loud as it goes.');
  // mute and unmute: unmuting comes back at the usual level, whatever it was before
  const loud = must(setTrackVolume(mix, 0, 5)).mix;
  const muted = must(muteTrack(loud, 0)).mix;
  assert.deepEqual([trackVolume(muted, 0), trackGain(muted, 0)], [0, 0]);
  assert.equal(trackVolume(must(muteTrack(muted, 0)).mix, 0), 3);
  // moving, copying and other changes carry the levels; schedule says which track a clip is on
  let moved = must(moveClip(muted, 1, 2, 0)).mix;
  moved = must(copyClip(moved, 1)).mix;
  moved = must(setLoop(must(addBacking(moved, 3, 'chords-held')).mix, 'spooky')).mix;
  assert.deepEqual(moved.vols, [0, 3, 3, 3]);
  assert.deepEqual(schedule(moved).map((e) => e.track).sort(), moved.tracks.flatMap((t, i) => t.map(() => i)).sort());
});

test('track volume in a stored mix: kept when good, repaired or dropped when odd; none added to an old mix', () => {
  const base = { name: 'Mix', bpm: 120, meter: 4, bars: 8, key: 'C', tracks: [[{ kind: 'part', song: 'bg-meadow', part: 'lead', start: 0, len: 8, from: 0, total: 64 }], [], [], []] };
  const clean = cleanMix(base);
  assert.equal('vols' in clean, false);
  assert.equal(JSON.stringify(cleanMix(JSON.parse(JSON.stringify(clean)))), JSON.stringify(clean), 'an old mix loads byte for byte');
  assert.deepEqual(cleanMix({ ...base, vols: [0, 5, 3, 1] }).vols, [0, 5, 3, 1]);
  assert.deepEqual(cleanMix({ ...base, vols: [9, -1, 2.5, '4'] }).vols, [3, 3, 3, 3], 'odd levels are the usual one');
  assert.deepEqual(cleanMix({ ...base, vols: [null, {}, [], 4] }).vols, [3, 3, 3, 4]);
  for (const vols of [[1, 2, 3], [1, 2, 3, 4, 5], 'loud', 3, null, {}, { length: 4 }]) {
    let mix;
    assert.doesNotThrow(() => { mix = cleanMix({ ...base, vols }); }, String(vols));
    assert.equal('vols' in mix, false, `${JSON.stringify(vols)}: dropped`);
    assert.equal(mix.tracks[0].length, 1, 'and the music kept');
  }
  const kept = cleanMix({ ...base, vols: [2, 3, 4, 0] });
  assert.deepEqual(cleanMix(JSON.parse(JSON.stringify(kept))), kept, 'clean already');
});
