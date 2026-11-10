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
  moveClip, trimClip, copyClip, findClip, schedule, cleanMix, badges, splitShift, mixBeats, PART_NAMES,
} from '../js/studiorules.js';

// the music engine renders through the browser's OfflineAudioContext: give it one that writes the notes down
const { FakeAudioContext, played } = fakeAudio();
globalThis.OfflineAudioContext = class extends FakeAudioContext {
  startRendering() { return Promise.resolve({ getChannelData: () => new Float32Array(4) }); }
};
const { renderPart, renderEvents, songParts, swingAt, GAME_KIT } = await import('../js/music.js');

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
  assert.deepEqual([lead.voice, lead.kit, lead.shift], [undefined, undefined, 24], 'an unknown voice dropped, no kit on notes, the shift at most 2 octaves');
  assert.deepEqual([cym.kit, cym.voice, cym.shift], ['tiny', undefined, undefined], 'drums keep a kit and nothing else');
  const [chords, bass] = mix.tracks[1];
  assert.deepEqual(chords, { id: 4, kind: 'backing', pattern: 'chords-held', loop: 'spooky', start: 0, len: 16, from: 0, total: 16 }, 'its own voice is no voice');
  assert.deepEqual([bass.loop, bass.shift, bass.kit], ['sunny', -12, undefined], 'an unknown loop is the sunny one');
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
