// The long map loops: what the village plays on the maps that have one (music.js startMusic),
// in place of the 16-bar song in songs.js. songs.js keeps the 16-bar songs for everything
// else (the songbook, sheet music, the studio, the shows).
// Same tokens as songs.js (lead: one bar per string, one token per step, '-' holds, '.' rests;
// chords: one per bar; bass: [chord tone, octave, length in steps] or null per step), but a
// loop is a list of sections, played in order and then round again. Each section has its own
// bars and can set its own meter, voices and drums:
//   beat: steps a bar (the song's, else 8); barEighths: how long a bar lasts in the song's
//     eighths (a bar of 6 steps in the time of 8 sways in two); the step is barEighths / beat
//     of an eighth.
//   leadWave, leadVol, lead2Vol, bassVol, arp, bass, drums, fill: as in songs.js, for this
//     section (else the loop's own). arp.from and the drums count the section's bars; the fill
//     is the section's last bar.
//   lead2: a second voice under the tune, a bar per lead bar (null: none in that bar).
//   inv: per bar, the chord tone the bass takes where its pattern asks for the root (a tone,
//     or [tone, octave shift]).
//   comp: { steps, vol, lo, len, env, bars }: the chord, soft, on those steps of each bar (or
//     only in bars), voiced upwards from midi lo.
//   flow: { pattern, wave, vol, env, len, off }: one accompaniment note per step ([chord tone,
//     octave] or null), except in the bars in off.
const R = 0, T = 1, F = 2;

const WALTZ_A = [
  'A4 - D5 - F5 -', 'F5 - D5 - Bb4 -', 'A4 - C5 - F5 -', 'E5 - - - . .',
  'D5 - F5 - A5 -', 'Bb5 - A5 - F5 -', 'G5 - Bb5 - D6 -', 'C#6 - - - A5 -',
  'C6 - A5 - F5 -', 'G5 - E5 - C5 -', 'D5 - F5 - A5 C6', 'Bb5 - - - F5 -',
  'G5 - A5 - Bb5 -', 'A5 - G5 - E5 -', 'D5 - - - . .',
];
const WALTZ_CHORDS = ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm'];

export const LOOPS = {
  'bg-ocean': {
    name: 'Bubble Waltz', bpm: 100, beat: 6,
    leadWave: 'triangle', leadVol: 0.55, echo: 0.35, drumVol: 0.6,
    sections: [
      { // the waltz as the kids know it, now with a soft chord on beats two and three
        name: 'The waltz',
        lead: [...WALTZ_A, 'A5 - F#5 - C5 -'],
        chords: [...WALTZ_CHORDS, 'D'],
        arp: { from: 4, wave: 'pulse12', octave: 5, order: 'updown', vol: 0.04 },
        bass: [[R, 2, 2.5], null, null, null, [F, 2], null],
        comp: { steps: [2, 4], vol: 0.15, lo: 53, len: 1.7 },
        drums: [['k.....', '......', '..h.h.']],
      },
      { // the siren's lullaby from the grotto, an octave up, second voice underneath
        name: 'The lullaby',
        lead: [
          'D5 - - - D5 Eb5', 'D5 - G5 - - -', 'Bb5 - A5 - G5 -', 'F5 - - - F5 -',
          'Ab5 - G5 - F5 -', 'Eb5 - - - Eb5 -', 'D5 - - - C#5 -', 'G5 - - - - -',
          'G5 - - - G5 Ab5', 'G5 - D6 - - -', 'Eb6 - D6 - C6 -', 'Bb5 - - - F5 -',
          'Ab5 - G5 - F5 -', 'Eb5 - - - D5 Eb5', 'D5 - - - D5 -', 'G5 - - - Eb5 -',
          'C#5 - - - - -',
        ],
        lead2: [
          'Bb4 - - - - -', 'Bb4 - - - - -', 'D5 - C5 - Bb4 -', 'C5 - - - C5 -',
          'C5 - Bb4 - Ab4 -', 'Bb4 - - - Bb4 -', 'A4 - - - A4 -', 'D5 - Eb5 - D5 -',
          'Eb5 - - - - -', 'Bb4 - Bb5 - - -', 'G5 - F5 - Eb5 -', 'Eb5 - D5 - - -',
          'C5 - Bb4 - Ab4 -', 'C5 - - - - -', 'Bb4 - - - Bb4 -', 'Bb4 - - - Bb4 -',
          'A4 - - - - -',
        ],
        chords: ['Gm', 'Gm', 'Gm', 'F', 'Fm', 'Eb', 'D', 'Gm', 'Cm', 'Gm', 'Cm', 'Gm', 'Fm', 'Cm', 'Gm', 'Eb', 'A'],
        inv: [R, R, R, T, T, T, T, R, F, R, R, R, R, R, [F, -1], R, R],
        leadVol: 0.46, lead2Vol: 0.4, bassVol: 0.36,
        arp: null,
        bass: [[R, 2, 5.6], null, null, null, null, null],
        comp: { steps: [2, 4], vol: 0.07, lo: 55, len: 1.9, env: 'hold' },
        drums: [['......']],
      },
      { // the waltz again, fuller: thirds under the tune, passing notes and the falling bubbles
        name: 'The full current',
        lead: [
          'A4 - D5 E5 F5 -', 'F5 - D5 - Bb4 -', 'A4 - C5 E5 F5 -', 'E5 - - - . .',
          'D5 - F5 G5 A5 -', 'Bb5 - A5 G5 F5 -', 'G5 - Bb5 - D6 -', 'C#6 - - - A5 -',
          'C6 C5 A5 A4 F5 F4', 'G5 G4 E5 E4 C5 C4', 'D5 D4 F5 F4 A5 C6', 'Bb5 - A5 G5 F5 -',
          'G5 - A5 - Bb5 -', 'A5 - G5 F5 E5 -', 'D5 - - - . .', 'E5 - C#5 - E5 -',
        ],
        lead2: [
          'F4 - F4 - A4 -', 'D5 - Bb4 - F4 -', 'F4 - F4 - A4 -', 'C5 - - - . .',
          'A4 - D5 - F5 -', 'F5 - - - D5 -', 'D5 - G5 - Bb5 -', 'A5 - - - E5 -',
          null, null, null, 'F5 - - - D5 -',
          'D5 - D5 - G5 -', 'E5 - C#5 - C#5 -', 'A4 - - - . .', 'C#5 - A4 - C#5 -',
        ],
        chords: [...WALTZ_CHORDS, 'A'],
        lead2Vol: 0.4,
        arp: { from: 0, wave: 'pulse12', octave: 5, order: 'updown', vol: 0.04 },
        bass: [[R, 2, 2.5], null, null, null, [F, 2], null],
        comp: { steps: [2, 4], vol: 0.15, lo: 53, len: 1.7 },
        drums: [['k.....', '......', '..h.h.']],
        fill: ['k.....', '......', '..h.o.'],
      },
    ],
  },

  'bg-meadow': {
    name: 'Forest Village', bpm: 132, beat: 8,
    sections: [
      { // the village tune exactly as it is in the game
        name: 'Forest Village',
        lead: [
          'E5 - G5 - C6 - B5 A5', 'G5 - E5 C5 A4 - C5 E5', 'F5 - A5 - C6 - A5 F5', 'G5 - - - D5 E5 F5 D5',
          'E5 - G5 - C6 - D6 E6', 'D6 - B5 - G5 - E5 G5', 'A5 G5 F5 A5 C6 - A5 -', 'B5 - D6 - G5 - . .',
          'A5 - . A5 C6 A5 F5 -', 'B5 - . B5 D6 B5 G5 -', 'G5 - B5 - E6 - D6 B5', 'C6 - - - A5 - E5 -',
          'F5 A5 C6 A5 F5 A5 C6 F6', 'G5 B5 D6 B5 G5 B5 D6 G6', 'E6 - D6 - C6 - G5 -', 'C6 - - - . . . .',
        ],
        chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
        arp: { from: 4 },
        bass: [[R, 2], null, [R, 3], null, [F, 2], null, [R, 3], [F, 2]],
        drums: [['k...k...', '..s...s.', 'h.h.h.h.'], ['k...k...', '..s...s.', 'hhhhhhhh'], ['k...k...', '......s.', 'h.h.h.h.'], ['k..kk...', '..s...s.', 'hhhhhhho']],
        fill: ['k...k...', '........', 'h.h.....'],
      },
      { // the path into the woods (from the concert piece): the tune's hop winds down over a bass
        // that walks from C to the Oak's D, and the drums thin out
        name: 'The path',
        leadVol: 0.24, lead2Vol: 0.6,
        lead: ['E5 - . E5 G5 E5 C5 -', 'D5 - . D5 G5 D5 B4 -', 'C5 - . C5 E5 - A4 -', 'B4 - - - D5 - B4 -'],
        lead2: ['C5 - . C5 E5 C5 G4 -', 'B4 - . B4 D5 B4 G4 -', 'A4 - . A4 C5 - E4 -', 'G4 - - - B4 - G4 -'],
        chords: ['C', 'G', 'Am', 'G'],
        inv: [[R, 1], T, R, R],
        arp: null, bassVol: 0.45,
        bass: [[R, 2, 3.7], null, null, null, [R, 2, 3.7], null, null, null],
        comp: { steps: [2, 6], vol: 0.07, lo: 55, len: 1.8, env: 'hold' },
        drums: [['k.......', '........', 'h.h.h.h.'], ['........', '........', 'h...h...']],
      },
      { // the shadow on the path (F to F minor), already in the Oak's soft voice
        name: 'The shadow',
        leadWave: 'triangle', leadVol: 0.5, lead2Vol: 0.4, bassVol: 0.4,
        lead: ['A4 - - - Ab4 - - -'],
        lead2: ['F4 - - - F4 - - -'],
        chords: ['F Fm'],
        arp: null,
        bass: [[R, 2, 7.6], null, null, null, null, null, null, null],
        comp: { steps: [2, 6], vol: 0.07, lo: 55, len: 1.8, env: 'hold' },
        drums: [['........']],
      },
      { // one bar that already sways in two, so the Oak's rocking starts before its tune
        name: 'The sway begins',
        beat: 6, barEighths: 8,
        leadWave: 'triangle', leadVol: 0.5, lead2Vol: 0.4, bassVol: 0.36,
        lead: ['G4 - - - - -'],
        lead2: ['E4 - - - - -'],
        chords: ['Em'],
        arp: null,
        bass: [[R, 2, 5.5], null, null, null, null, null],
        flow: { pattern: [null, [F, 2], [T, 3], [F, 3], [T, 3], [F, 2]], wave: 'triangle', vol: 0.24, env: 'pluck', len: 1.6 },
        drums: [['......']],
      },
      { // the Great Oak's tune: same bar length, but each bar sways in two (6/8)
        name: 'The Great Oak',
        beat: 6, barEighths: 8,
        leadWave: 'triangle', leadVol: 0.5, lead2Vol: 0.4, bassVol: 0.36,
        lead: [
          'F4 - A4 D5 - C5', 'B4 - - A4 - G4', 'F4 - A4 C5 - F4', 'G4 - - - - -',
          'F4 - A4 D5 - C5', 'B4 - - A4 - G4', 'G4 - A4 C5 - A4', 'D5 - - - - -',
          'A4 - C5 F5 - E5', 'D5 - - C5 - B4', 'B4 - D5 G5 - F5', 'E5 - - D5 - C5',
          'F4 - A4 D5 - C5', 'B4 - - A4 - G4', 'G4 - A4 C5 - A4', 'D5 - - - - -',
        ],
        lead2: [
          null, null, null, 'E4 - - - - -',
          'D4 - F4 F4 - E4', 'G4 - - F4 - E4', 'E4 - F4 E4 - F4', 'A4 - - - - -',
          'F4 - A4 A4 - G4', 'G4 - - E4 - D4', 'D4 - G4 B4 - A4', 'G4 - - F4 - E4',
          'D4 - F4 F4 - E4', 'G4 - - F4 - E4', 'E4 - F4 E4 - F4', 'F#4 - - A4 - -',
        ],
        chords: ['Dm', 'G', 'F', 'C', 'Dm', 'G', 'C', 'Dm', 'F', 'C', 'G', 'C', 'Dm', 'G', 'C', 'D'],
        inv: [R, R, R, R, R, R, R, R, R, T, R, R, R, R, R, R],
        arp: null,
        bass: [[R, 2, 5.5], null, null, null, null, null],
        flow: { pattern: [null, [F, 2], [T, 3], [F, 3], [T, 3], [F, 2]], wave: 'triangle', vol: 0.24, env: 'pluck', len: 1.6, off: [4, 5, 6, 7] },
        comp: { steps: [3], vol: 0.09, lo: 55, len: 2.6, env: 'hold', bars: [4, 5, 6, 7] },
        drums: [['......', '......', '......'], ['......', '......', 'h..h..']],
      },
      { // waking up: back in the village's beat, the tune's hop climbs from the Oak's register
        name: 'Waking up',
        leadVol: 0.2, lead2Vol: 0.6, bassVol: 0.45,
        lead: ['G4 - B4 - D5 - B4 D5', 'A4 - C5 - E5 - C5 E5'],
        lead2: ['D4 - G4 - B4 - G4 B4', 'E4 - A4 - C5 - A4 C5'],
        chords: ['G', 'Am'],
        arp: null,
        bass: [[R, 2, 3.7], null, null, null, [F, 2, 3.7], null, null, null],
        comp: { steps: [2, 6], vol: 0.07, lo: 55, len: 1.8, env: 'hold' },
        drums: [['........', '........', 'h...h...'], ['k.......', '........', 'h.h.h.h.']],
      },
      { // the climb and the tune's own pickup, drums and sparkle coming back
        name: 'The lift',
        leadVol: 0.27,
        lead: ['A4 C5 F5 C5 A4 C5 F5 A5', 'G5 - - - D5 E5 F5 D5'],
        chords: ['F', 'G'],
        arp: { from: 0, vol: 0.05 },
        bass: [[R, 2], null, [R, 3], null, [F, 2], null, [R, 3], [F, 2]],
        drums: [['k...k...', '........', 'hhhhhhhh']],
        fill: ['k...k...', '..s.s.ss', 'hhhh....', '......tt'],
      },
      { // the village tune again as the Dance of the Lights: the longer climb and the broad ending
        name: 'Dance of the Lights',
        lead: [
          'E5 - G5 - C6 - B5 A5', 'G5 - E5 C5 A4 - C5 E5', 'F5 - A5 - C6 - A5 F5', 'G5 - - - D5 E5 F5 D5',
          'E5 - G5 - C6 - D6 E6', 'D6 - B5 - G5 - E5 G5', 'A5 G5 F5 A5 C6 - A5 -', 'B5 - D6 - G5 - . .',
          'A5 - . A5 C6 A5 F5 -', 'B5 - . B5 D6 B5 G5 -', 'G5 - B5 - E6 - D6 B5', 'C6 - - - A5 - E5 -',
          'F5 A5 C6 A5 F5 A5 C6 F6', 'G5 B5 D6 B5 G5 B5 D6 G6', 'A5 C6 E6 C6 A5 C6 E6 A6', 'C6 A5 F5 A5 C6 F6 A6 F6',
          'E6 - D6 - C6 - G5 -', 'F5 - G5 - B5 - D6 -', 'E6 - D6 - C6 - G5 -', 'C6 - - - . . . .',
        ],
        lead2: [
          null, null, null, null,
          'E4 - G4 - C5 - D5 E5', 'D5 - B4 - G4 - E4 G4', 'A4 G4 F4 A4 C5 - A4 -', 'B4 - D5 - G4 - . .',
          null, null, null, null,
          null, null, null, null,
          'C6 - B5 - G5 - E5 -', 'D5 - F5 - G5 - B5 -', 'C6 - B5 - G5 - E5 -', 'E5 - - - . . . .',
        ],
        chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'Am', 'F', 'C', 'G', 'C', 'C'],
        inv: [R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, R, F, R, R, R],
        lead2Vol: 0.45,
        arp: { from: 0 },
        bass: [[R, 2], null, [R, 3], null, [F, 2], null, [R, 3], [F, 2]],
        drums: [['k...k...', '..s...s.', 'hhhhhhhh'], ['k...k...', '..s...s.', 'hhhhhhhh', '.......t'], ['k..kk...', '..s...s.', 'hhhhhhho'], ['k..kk...', '..s...s.', 'hhhhhhho'], ['k...k...', '..s...s.', 'hhhhhhho', '......tt']],
        fill: ['k...k...', '..s.s.ss', 'h.h.....'],
      },
    ],
  },
};
