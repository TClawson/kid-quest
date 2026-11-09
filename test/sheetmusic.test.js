import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SONGS, SHOW_SONGS } from '../js/songs.js';
import {
  keyInfo, keyLabel, chordNotes, chordLabel, splitLength, barEvents, meterOf, parseNote,
  songById, songAbc, melodyShift, SONGBOOK, songbookFor, PIECES_PER_TIER, stars, SWING_MARK,
} from '../js/sheetmusic.js';

const LETTERS = 'CDEFGAB';
const NATURAL = [0, 2, 4, 5, 7, 9, 11];
const spell = (n) => `${LETTERS[n.letter]}${n.alter > 0 ? '#' : n.alter < 0 ? 'b' : ''}`;

// ---------- keys and chords ----------

test('every song has a key, and key signatures come out right', () => {
  for (const s of [...Object.values(SONGS), ...Object.values(SHOW_SONGS)]) assert.doesNotThrow(() => keyInfo(s.key), s.name);
  const sig = (k) => keyInfo(k).sig;
  assert.deepEqual(['C', 'G', 'D', 'F', 'Bb', 'Am', 'Em', 'Dm', 'Ddor'].map(sig), [0, 1, 2, -1, -2, 0, 1, -1, 0]);
  assert.deepEqual(['C', 'Bb', 'Dm', 'Ddor'].map(keyLabel), ['C major', 'B♭ major', 'D minor', 'D dorian']);
  // sharp keys stay sharp keys (abcjs draws 7 sharps for C#), and modes find their major key
  assert.deepEqual(['C#', 'A#m', 'F#', 'Gb', 'Cb', 'Ebm', 'Elyd', 'Gmix', 'Bbm'].map(sig), [7, 7, 6, -6, -7, -6, 5, 0, -5]);
  assert.throws(() => keyInfo('G#'), /no key signature/);
});

test('chords are spelled from the root up', () => {
  const names = (c) => chordNotes(c).map(spell).join(' ');
  assert.equal(names('C'), 'C E G');
  assert.equal(names('Bb'), 'Bb D F');
  assert.equal(names('Gm'), 'G Bb D');
  assert.equal(names('E'), 'E G# B');
  assert.equal(names('C#m'), 'C# E G#');
  assert.equal(names('Bdim'), 'B D F');
  assert.equal(names('Eb'), 'Eb G Bb');
  assert.equal(chordLabel('Bb'), 'B♭');
  assert.equal(chordLabel('F#m'), 'F♯m');
});

// ---------- rhythm ----------

test('notes are split into lengths that can be written, at the middle of the bar when off the beat', () => {
  const four = meterOf({ beat: 8 });
  const waltz = meterOf({ beat: 6 });
  assert.deepEqual(splitLength(0, 8, four), [8]);
  // rests always show the middle of a 4/4 bar, unless they fill it, and are never dotted halves
  assert.deepEqual(splitLength(0, 8, four, true), [8]);
  assert.deepEqual(splitLength(2, 4, four, true), [2, 2]);
  assert.deepEqual(splitLength(0, 6, four, true), [4, 2]);
  assert.deepEqual(splitLength(2, 6, four, true), [2, 4]);
  assert.deepEqual(splitLength(4, 4, four, true), [4]);
  assert.deepEqual(splitLength(0, 6, meterOf({ beat: 6 }), true), [6]);
  assert.deepEqual(splitLength(1, 7, four, true), [1, 2, 4], 'from off the beat: to the next beat first');
  assert.deepEqual(splitLength(2, 4, meterOf({ beat: 6 }), true), [2, 2], 'a waltz rest after beat one goes beat by beat');
  assert.deepEqual(splitLength(0, 5, four), [4, 1]);
  assert.deepEqual(splitLength(0, 7, four), [6, 1]);
  assert.deepEqual(splitLength(1, 2, four), [2], 'a little syncopation stays one note');
  assert.deepEqual(splitLength(3, 2, four), [1, 1], 'across the middle from off the beat: tied');
  assert.deepEqual(splitLength(3, 5, four), [1, 4]);
  assert.deepEqual(splitLength(2, 4, four), [4], 'on the beat it may cross the middle');
  assert.deepEqual(splitLength(0, 6, waltz), [6]);
  assert.deepEqual(waltz.meter, '3/4');
});

test('a bar becomes notes and rests with their lengths', () => {
  assert.deepEqual(barEvents('E5 - G5 - . . - -'), [{ pos: 0, len: 2, note: 'E5' }, { pos: 2, len: 2, note: 'G5' }, { pos: 4, len: 4, note: null }]);
  for (const s of [...Object.values(SONGS), ...Object.values(SHOW_SONGS)]) {
    for (const bar of s.lead) assert.equal(barEvents(bar).reduce((n, e) => n + e.len, 0), meterOf(s).steps, `${s.name}: ${bar}`);
  }
});

// ---------- the ABC ----------

/**
 * Read back one voice of our ABC: each bar's notes as sounding MIDI numbers (null for rests)
 * with their lengths, applying the key signature and accidentals held through the bar.
 */
function readVoice(abc, voice, key) {
  const { sig } = keyInfo(key);
  const keyAlter = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.abs(sig); i += 1) keyAlter[LETTERS.indexOf((sig > 0 ? 'FCGDAEB' : 'BEADGCF')[i])] = Math.sign(sig);
  const lines = abc.split('\n').filter((l) => (voice ? l.startsWith(`[V:${voice}]`) : /^[^A-Za-z%]|^[a-gzA-G"[_^=]/.test(l) && !/^[A-Za-z]:/.test(l)));
  const music = lines.map((l) => l.replace(/^\[V:\w\]\s*/, '')).join(' ').replace(/"[^"]*"/g, '');
  return music.split(/\|\]?/).map((b) => b.trim()).filter(Boolean).map((bar) => {
    const held = new Map();
    const out = [];
    const re = /\[([^\]]+)\](\d*)|([_^=]?)([A-Ga-gz])([,']*)(\d*)(-?)/g;
    for (let m; (m = re.exec(bar));) {
      const pitch = (acc, name, marks) => {
        const letter = LETTERS.indexOf(name.toUpperCase());
        let octave = name === name.toUpperCase() ? 4 : 5;
        for (const c of marks) octave += c === "'" ? 1 : -1;
        const spot = `${letter}${octave}`;
        if (acc) held.set(spot, { '^': 1, _: -1, '=': 0 }[acc]);
        const alter = held.has(spot) ? held.get(spot) : keyAlter[letter];
        return (octave + 1) * 12 + NATURAL[letter] + alter;
      };
      if (m[1]) {
        const notes = [...m[1].matchAll(/([_^=]?)([A-Ga-g])([,']*)/g)].map((n) => pitch(n[1], n[2], n[3]));
        out.push({ chord: notes, len: Number(m[2] || 1) });
        continue;
      }
      const len = Number(m[6] || 1);
      if (m[4] === 'z') { out.push({ midi: null, len }); continue; }
      out.push({ midi: pitch(m[3], m[4], m[5]), len, tie: m[7] === '-' });
    }
    return out;
  });
}

for (const p of SONGBOOK) {
  test(`${p.name}: the sheet music plays the song's own notes, bar for bar`, () => {
    const song = songById(p.id);
    const steps = meterOf(song).steps;
    const shift = melodyShift(song) * 12;
    for (const hands of ['melody', 'roots', 'chords']) {
      const abc = songAbc(p.id, { hands, names: true, perLine: 4 });
      assert.match(abc, new RegExp(`^K:${song.key}$`, 'm'));
      assert.equal(abc.split('\n').includes(SWING_MARK), Boolean(song.swing), 'Swing is written when the game swings the song');
      const bars = readVoice(abc, hands === 'melody' ? null : 'R', song.key);
      assert.equal(bars.length, song.lead.length, `${hands}: one bar each`);
      bars.forEach((bar, i) => {
        assert.equal(bar.reduce((n, e) => n + e.len, 0), steps, `${hands} bar ${i + 1} is full`);
        // the notes heard, tied notes joined up again
        const heard = [];
        bar.forEach((e, k) => { if (k > 0 && bar[k - 1].tie && e.midi === bar[k - 1].midi) heard[heard.length - 1].len += e.len; else heard.push({ ...e }); });
        // rests next to each other are one rest in the song
        const merged = heard.filter((e, k) => !(e.midi === null && heard[k - 1]?.midi === null && (heard[k - 1].len += e.len)));
        const want = barEvents(song.lead[i]).map((e) => ({ midi: e.note ? parseNote(e.note).midi + shift : null, len: e.len }));
        assert.deepEqual(merged.map((e) => [e.midi, e.len]), want.map((e) => [e.midi, e.len]), `${hands} bar ${i + 1}: ${song.lead[i]}`);
      });
      if (hands !== 'melody') {
        const left = readVoice(abc, 'L', song.key);
        assert.equal(left.length, song.lead.length);
        left.forEach((bar, i) => {
          assert.equal(bar.reduce((n, e) => n + e.len, 0), steps, `left hand bar ${i + 1}`);
          // the left hand plays the chord named above the bar...
          const keys = bar.flatMap((e) => e.chord || [e.midi]);
          const want = chordNotes(song.chords[i]).map((t) => (NATURAL[t.letter] + t.alter + 12) % 12);
          const sorted = (list) => [...list].sort((x, y) => x - y);
          assert.deepEqual(sorted(keys.map((m) => m % 12)), sorted(hands === 'roots' ? want.slice(0, 1) : want), `${hands} bar ${i + 1}: ${song.chords[i]}`);
          if (hands === 'chords') assert.ok(Math.min(...keys) >= 40, `chords bar ${i + 1}: no lower than E2 (${keys})`);
          // ...below the right hand, so the hands never play the same keys
          const low = Math.min(...barEvents(song.lead[i]).filter((e) => e.note).map((e) => parseNote(e.note).midi + shift));
          assert.ok(Math.max(...keys) < low, `${hands} bar ${i + 1}: left hand ${keys} under the melody's ${low}`);
        });
      }
    }
  });
}

test('the left hand sits on the bass staff, and the melody mostly on the treble staff', () => {
  for (const p of SONGBOOK) {
    const song = songById(p.id);
    const left = readVoice(songAbc(p.id, { hands: 'roots' }), 'L', song.key).flat().map((e) => e.midi);
    assert.ok(left.every((m) => m >= 43 && m <= 54), `${p.name}: roots between G2 and F#3 (${left})`);
    const shift = melodyShift(song) * 12;
    const notes = song.lead.flatMap(barEvents).filter((e) => e.note).map((e) => parseNote(e.note).midi + shift);
    const off = notes.filter((m) => m < 57 || m > 84).length;
    assert.ok(off / notes.length < 0.1, `${p.name}: ${off} of ${notes.length} notes far off the staff`);
  }
});

test('note names go under the notes, one per note (tied notes skipped)', () => {
  const abc = songAbc('show:bg-ocean', { hands: 'melody', names: true });
  const words = abc.split('\n').filter((l) => l.startsWith('w:')).join(' ');
  assert.match(words, /D♯/);
  assert.match(words, /\*/, 'a tied note gets no name of its own');
  assert.doesNotMatch(songAbc('show:bg-ocean', { names: false }), /^w:/m);
});

// ---------- the songbook ----------

test('the songbook: 18 pieces, three more map songs with each piano, easiest first', () => {
  assert.equal(SONGBOOK.length, 18);
  assert.equal(new Set(SONGBOOK.map((p) => p.id)).size, 18);
  assert.deepEqual(PIECES_PER_TIER, [3, 6, 9]);
  const maps = SONGBOOK.filter((p) => p.kind === 'map');
  const shows = SONGBOOK.filter((p) => p.kind === 'show');
  assert.deepEqual([1, 2, 3].map((t) => maps.filter((p) => p.tier === t).length), [3, 3, 3]);
  assert.ok(shows.length === 9 && shows.every((p) => p.tier === null), 'show tunes wait for their treasure, not a piano');
  for (const list of [maps, shows]) {
    for (let i = 1; i < list.length; i += 1) assert.ok(list[i].level >= list[i - 1].level, `${list[i].name}: easier pieces first`);
  }
  assert.equal(SONGBOOK.find((p) => p.id === 'bg-meadow').tier, 1, 'the home map song, the one every kid knows, opens first');
  assert.ok(SONGBOOK.every((p) => p.name && p.key && [1, 2, 3].includes(stars(p.level))));
  assert.equal(stars(Math.min(...SONGBOOK.map((p) => p.level))), 1);
  assert.equal(stars(Math.max(...SONGBOOK.map((p) => p.level))), 3);
});

test('a show tune stays secret until its map\'s treasure is found, then opens with any piano', () => {
  const open = (t, found) => songbookFor(t, found).filter((p) => p.open).length;
  assert.deepEqual([0, 1, 2, 3].map((t) => open(t)), [0, 3, 6, 9], 'no treasure found: the map songs');
  const every = new Set(Object.keys(SHOW_SONGS));
  assert.deepEqual([0, 1, 2, 3].map((t) => open(t, every)), [0, 12, 15, 18]);
  const oak = (tier, found) => songbookFor(tier, found).find((p) => p.id === 'show:bg-meadow');
  assert.deepEqual([oak(3).secret, oak(3).open], [true, false]);
  const meadow = new Set(['bg-meadow']);
  assert.deepEqual([oak(1, meadow).secret, oak(1, meadow).open], [false, true], 'the first treasure map opens its tune with the little keyboard');
  assert.equal(oak(0, meadow).open, false, 'but not before there is a music house');
  assert.ok(songbookFor(3).filter((p) => p.kind === 'map').every((p) => !p.secret));
});
