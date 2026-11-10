// The recording studio's remix kit: the voices a notes clip can be played in, the drum kits,
// and backing tracks that belong to no song (beats, cymbals, bass lines, chords, sparkles).
// Pure data and arithmetic: no DOM, no sound. music.js turns the events into sound.
//
// Time is counted in steps (eighth notes), as in songs.js: a four-beat bar has 8 steps, a
// three-beat bar 6. Pitches are MIDI numbers (60 is middle C).

// ---------- voices ----------
// wave: an oscillator type, or 'pulse12' / 'pulse25' (the game's thin square waves), or a list
// of overtone strengths (harm) for a wave of its own. env: 'hold' (steady, like the game's
// tunes) or 'pluck' (rings down, like a steel drum). vol: how loud next to the others.
// attack: seconds to swell in. ring: for 'pluck', how long a short note is still let ring
// (seconds). vibrato: { rate (a second), cents }. twin: a second copy this many cents off, for
// a fuller sound. soft: a low-pass, as a multiple of the note's pitch (takes the edge off).
// home: the octave a tune sits in best (4 is the octave of middle C), used when a clip is
// first given this voice so a bass voice doesn't squeak and a bell doesn't growl.
export const VOICES = {
  beep: { name: 'Beep', icon: '🟩', wave: 'square', env: 'hold', vol: 0.3, home: 5 },
  buzz: { name: 'Buzz', icon: '🐝', wave: 'pulse12', env: 'hold', vol: 0.3, home: 4 },
  reed: { name: 'Reed', icon: '🎷', wave: 'pulse25', env: 'hold', vol: 0.3, home: 4 },
  steel: { name: 'Steel drum', icon: '🛢️', wave: 'triangle', env: 'pluck', vol: 0.55, home: 5 },
  deep: { name: 'Deep bass', icon: '🐋', wave: 'triangle', env: 'hold', vol: 0.55, home: 2 },
  flute: { name: 'Flute', icon: '🪈', wave: 'sine', env: 'hold', vol: 0.5, attack: 0.03, vibrato: { rate: 5, cents: 12 }, home: 5 },
  organ: { name: 'Organ', icon: '⛪', harm: [1, 0.6, 0, 0.4, 0, 0, 0, 0.25], env: 'hold', vol: 0.3, home: 4 },
  strings: { name: 'Strings', icon: '🎻', wave: 'sawtooth', env: 'hold', vol: 0.2, attack: 0.08, twin: 7, soft: 6, home: 4 },
  musicbox: { name: 'Music box', icon: '🎁', harm: [1, 0, 0, 0.5, 0, 0, 0, 0.12], env: 'pluck', ring: 0.9, vol: 0.5, home: 6 },
  robot: { name: 'Robot', icon: '🤖', wave: 'square', env: 'hold', vol: 0.26, vibrato: { rate: 18, cents: 35 }, home: 4 },
};
export const VOICE_IDS = Object.keys(VOICES);

// ---------- drum kits ----------
// kick and tom: [start pitch, end pitch, seconds]. snare, hat, open (an open hat): noise
// through a high-pass: { len (seconds), hp (Hz), vol }.
export const KITS = {
  chip: { name: 'Game kit', icon: '🕹️', kick: [140, 45, 0.15], tom: [220, 90, 0.2], snare: { len: 0.12, hp: 1200, vol: 0.35 }, hat: { len: 0.03, hp: 6000, vol: 0.12 }, open: { len: 0.18, hp: 6000, vol: 0.12 } },
  big: { name: 'Big kit', icon: '🥁', kick: [110, 38, 0.24], tom: [170, 70, 0.28], snare: { len: 0.2, hp: 700, vol: 0.4 }, hat: { len: 0.05, hp: 5000, vol: 0.13 }, open: { len: 0.3, hp: 4500, vol: 0.13 } },
  tiny: { name: 'Tiny kit', icon: '🐭', kick: [260, 120, 0.07], tom: [420, 240, 0.09], snare: { len: 0.05, hp: 2500, vol: 0.3 }, hat: { len: 0.02, hp: 9000, vol: 0.1 }, open: { len: 0.09, hp: 9000, vol: 0.1 } },
};
export const KIT_IDS = Object.keys(KITS);

// ---------- chord loops ----------
// Four bars that go round, as chords built on steps of the key. Each chord is [its root in
// semitones above the key note, its third (4 major, 3 minor)]. A sunny loop plays in the mix's
// major key, a moody one in its minor key (the same key signature: C major's moody loops are
// in A minor).
const MAJOR = { I: [0, 4], ii: [2, 3], iii: [4, 3], IV: [5, 4], V: [7, 4], vi: [9, 3] };
const MINOR = { i: [0, 3], III: [3, 4], iv: [5, 3], v: [7, 3], V: [7, 4], VI: [8, 4], VII: [10, 4] };
export const LOOPS = {
  sunny: { name: 'Sunny', mood: 'major', chords: ['I', 'V', 'vi', 'IV'] },
  oldtime: { name: 'Old-time', mood: 'major', chords: ['I', 'vi', 'IV', 'V'] },
  campfire: { name: 'Campfire', mood: 'major', chords: ['I', 'IV', 'I', 'V'] },
  adventure: { name: 'Adventure', mood: 'minor', chords: ['i', 'VI', 'III', 'VII'] },
  spooky: { name: 'Spooky', mood: 'minor', chords: ['i', 'iv', 'i', 'V'] },
  marching: { name: 'Marching', mood: 'minor', chords: ['i', 'VII', 'VI', 'VII'] },
};
export const LOOP_IDS = Object.keys(LOOPS);
export const LOOP_BARS = 4;

/**
 * The chord of bar `bar` (0-3) of a loop whose key note is `tonic` (a pitch class: 0 is C):
 * [root, third, fifth] as pitch classes counted from C, with the root between -5 and 6 (so
 * every key sits in about the same place: G is played below C, not above it) and the third
 * and fifth just above the root.
 */
export function loopChord(loopId, bar, tonic = 0) {
  const loop = LOOPS[loopId] || LOOPS.sunny;
  const [step, third] = (loop.mood === 'major' ? MAJOR : MINOR)[loop.chords[bar % loop.chords.length]];
  let root = (((tonic + step) % 12) + 12) % 12;
  if (root > 6) root -= 12;
  return [root, root + third, root + 7];
}

// ---------- backing tracks ----------
// kind 'drums': lines of k kick, s snare, h hat, o open hat, t tom, one character a step, one
// bar each; `bars` lists which pattern each of the four bars uses (the last bar has a fill).
// kind 'notes': `steps` is one bar: for each step null, or [chord tone (0 root, 1 third,
// 2 fifth, 'all' the whole chord), octave (2 is low, 4 has middle C), length in steps].
// `ripple` is the game's sparkle: two quick notes a step that run through the chord.
// meter: beats in a bar (4 or 3). voice: the voice it starts with.
export const BACKING = {
  // --- beats: kick and snare ---
  'beat-steady': { name: 'Steady beat', group: 'beats', meter: 4, kind: 'drums', patterns: [['k...k...', '..s...s.'], ['k...k...', '..s...ss']], bars: [0, 0, 0, 1] },
  'beat-rock': { name: 'Rock beat', group: 'beats', meter: 4, kind: 'drums', patterns: [['k..k.k..', '..s...s.'], ['k..k.k..', '..s...s.', '......tt']], bars: [0, 0, 0, 1] },
  'beat-boomclap': { name: 'Boom clap', group: 'beats', meter: 4, kind: 'drums', patterns: [['k.......', '....s...'], ['k.....k.', '....s...']], bars: [0, 1, 0, 1] },
  'beat-march': { name: 'Marching drums', group: 'beats', meter: 4, kind: 'drums', patterns: [['k...k...', 's.ss..s.'], ['k...k...', 's.s.ssss']], bars: [0, 0, 0, 1] },
  'beat-gallop': { name: 'Gallop', group: 'beats', meter: 4, kind: 'drums', patterns: [['k.kkk.kk', '..s...s.'], ['k.kkk.kk', '..s...s.', '....t.t.']], bars: [0, 0, 0, 1] },
  'beat-waltz': { name: 'Waltz beat', group: 'beats', meter: 3, kind: 'drums', patterns: [['k.....', '..s.s.'], ['k.....', '..s.ss']], bars: [0, 0, 0, 1] },
  'beat-sway': { name: 'Swaying beat', group: 'beats', meter: 3, kind: 'drums', patterns: [['k...k.', '..s...'], ['k...k.', '..s.t.']], bars: [0, 0, 0, 1] },
  // --- cymbals ---
  'cym-ticks': { name: 'Ticking cymbal', group: 'cymbals', meter: 4, kind: 'drums', patterns: [['h.h.h.h.']], bars: [0, 0, 0, 0] },
  'cym-fast': { name: 'Fast cymbal', group: 'cymbals', meter: 4, kind: 'drums', patterns: [['hhhhhhhh'], ['hhhhhho.']], bars: [0, 0, 0, 1] },
  'cym-offbeat': { name: 'Off-beat cymbal', group: 'cymbals', meter: 4, kind: 'drums', patterns: [['.h.h.h.h']], bars: [0, 0, 0, 0] },
  'cym-openshut': { name: 'Open and shut', group: 'cymbals', meter: 4, kind: 'drums', patterns: [['h.h.h.o.']], bars: [0, 0, 0, 0] },
  'cym-ticks3': { name: 'Ticking cymbal', group: 'cymbals', meter: 3, kind: 'drums', patterns: [['h.h.h.']], bars: [0, 0, 0, 0] },
  'cym-lift3': { name: 'Lifting cymbal', group: 'cymbals', meter: 3, kind: 'drums', patterns: [['..h.h.'], ['..h.o.']], bars: [0, 0, 0, 1] },
  // --- bass lines (they follow the chord loop the kid picks) ---
  'bass-steady': { name: 'Steady bass', group: 'bass', meter: 4, kind: 'notes', voice: 'deep', steps: [[0, 2, 1.8], null, [0, 2, 1.8], null, [0, 2, 1.8], null, [0, 2, 1.8], null] },
  'bass-bounce': { name: 'Bouncy bass', group: 'bass', meter: 4, kind: 'notes', voice: 'deep', steps: [[0, 2, 0.9], null, [0, 3, 0.9], null, [2, 2, 0.9], null, [0, 3, 0.9], [2, 2, 0.9]] },
  'bass-walk': { name: 'Walking bass', group: 'bass', meter: 4, kind: 'notes', voice: 'deep', steps: [[0, 2, 1.8], null, [1, 2, 1.8], null, [2, 2, 1.8], null, [1, 2, 1.8], null] },
  'bass-long': { name: 'Long bass', group: 'bass', meter: 4, kind: 'notes', voice: 'deep', steps: [[0, 2, 5.6], null, null, null, null, null, [2, 2, 1.8], null] },
  'bass-waltz': { name: 'Waltz bass', group: 'bass', meter: 3, kind: 'notes', voice: 'deep', steps: [[0, 2, 1.8], null, [2, 2, 1.8], null, [2, 2, 1.8], null] },
  'bass-long3': { name: 'Long bass', group: 'bass', meter: 3, kind: 'notes', voice: 'deep', steps: [[0, 2, 5.6], null, null, null, null, null] },
  // --- chords ---
  'chords-held': { name: 'Held chords', group: 'chords', meter: 4, kind: 'notes', voice: 'organ', steps: [['all', 4, 7.6], null, null, null, null, null, null, null] },
  'chords-hop': { name: 'Hopping chords', group: 'chords', meter: 4, kind: 'notes', voice: 'steel', steps: [null, null, ['all', 4, 1.6], null, null, null, ['all', 4, 1.6], null] },
  'chords-push': { name: 'Pushing chords', group: 'chords', meter: 4, kind: 'notes', voice: 'reed', steps: [['all', 4, 2.6], null, null, ['all', 4, 2.6], null, null, ['all', 4, 1.8], null] },
  'chords-held3': { name: 'Held chords', group: 'chords', meter: 3, kind: 'notes', voice: 'organ', steps: [['all', 4, 5.6], null, null, null, null, null] },
  'chords-oompah': { name: 'Oom-pah-pah', group: 'chords', meter: 3, kind: 'notes', voice: 'steel', steps: [null, null, ['all', 4, 1.6], null, ['all', 4, 1.6], null] },
  // --- sparkles ---
  'sparkle-up': { name: 'Sparkle', group: 'sparkles', meter: 4, kind: 'notes', voice: 'buzz', ripple: [0, 2, 1, 2], octave: 5 },
  'sparkle-wave': { name: 'Rolling sparkle', group: 'sparkles', meter: 4, kind: 'notes', voice: 'musicbox', ripple: [0, 1, 2, 1], octave: 5 },
  'sparkle-up3': { name: 'Sparkle', group: 'sparkles', meter: 3, kind: 'notes', voice: 'buzz', ripple: [0, 2, 1, 2], octave: 5 },
};
export const BACKING_GROUPS = { beats: 'Beats', cymbals: 'Cymbals', bass: 'Bass lines', chords: 'Chords', sparkles: 'Sparkles' };

/**
 * The events of a backing track, four bars long.
 * Drums: [{ at (steps), kind }]. Notes: [{ at, len (steps), midi }] in the loop `loopId`,
 * with the key note `tonic` (a MIDI pitch class 0-11: 0 is C) of that loop's mood.
 */
export function backingEvents(id, { loop = 'sunny', tonic = 0 } = {}) {
  const b = BACKING[id];
  if (!b) return [];
  const perBar = b.meter * 2;
  const out = [];
  for (let bar = 0; bar < LOOP_BARS; bar += 1) {
    const base = bar * perBar;
    if (b.kind === 'drums') {
      for (const line of b.patterns[b.bars[bar]]) {
        for (let i = 0; i < perBar; i += 1) if (line[i] && line[i] !== '.') out.push({ at: base + i, kind: line[i] });
      }
      continue;
    }
    const tones = loopChord(loop, bar, tonic);
    // octave 4 starts at middle C (MIDI 60); the chord sits around the C of its octave
    const pitch = (tone, octave) => (octave + 1) * 12 + tones[tone];
    if (b.ripple) {
      for (let i = 0; i < perBar; i += 1) {
        for (let k = 0; k < 2; k += 1) out.push({ at: base + i + k / 2, len: 0.4, midi: pitch(b.ripple[(i * 2 + k) % b.ripple.length], b.octave) });
      }
      continue;
    }
    b.steps.forEach((s, i) => {
      if (!s) return;
      const [tone, octave, len] = s;
      const list = tone === 'all' ? [0, 1, 2] : [tone];
      // a held note stops at the end of its bar, so the next chord starts clean
      for (const t of list) out.push({ at: base + i, len: Math.min(len, perBar - i - 0.1), midi: pitch(t, octave) });
    });
  }
  return out.sort((a, b2) => a.at - b2.at);
}

/** A drum clip's two halves: the kick, snare and toms, or the cymbals. */
export const DRUM_HALVES = { beat: ['k', 's', 't'], cymbals: ['h', 'o'] };
