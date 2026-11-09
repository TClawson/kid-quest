// The map songs, one per map theme (keyed by background id). All original 16-bar loops.
// lead: one bar per line, one token per step (an eighth note). '-' holds, '.' rests.
// chords: one per bar. bass: [chord tone (0 root, 1 third, 2 fifth), octave] per step, or null.
// drums: one or more patterns (k kick, s snare, h hat, o open hat, t tom), split over the bars.
// key: the key the sheet music is written in ('C', 'Dm', 'Bb', 'Ddor' for D dorian): its key
// signature, and the key shown on the sheet music stand (sheetmusic.js) and in the studio.

const R = 0; // chord root
const T = 1; // third
const F = 2; // fifth

export const SONGS = {
  // Forest Village: bright and bouncy, C major (the original map song)
  'bg-meadow': {
    name: 'Forest Village',
    key: 'C',
    bpm: 132,
    lead: [
      'E5 - G5 - C6 - B5 A5', 'G5 - E5 C5 A4 - C5 E5', 'F5 - A5 - C6 - A5 F5', 'G5 - - - D5 E5 F5 D5',
      'E5 - G5 - C6 - D6 E6', 'D6 - B5 - G5 - E5 G5', 'A5 G5 F5 A5 C6 - A5 -', 'B5 - D6 - G5 - . .',
      'A5 - . A5 C6 A5 F5 -', 'B5 - . B5 D6 B5 G5 -', 'G5 - B5 - E6 - D6 B5', 'C6 - - - A5 - E5 -',
      'F5 A5 C6 A5 F5 A5 C6 F6', 'G5 B5 D6 B5 G5 B5 D6 G6', 'E6 - D6 - C6 - G5 -', 'C6 - - - . . . .',
    ],
    chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
    arp: { from: 4 },
    bass: [[R, 2], null, [R, 3], null, [F, 1], null, [R, 3], [F, 1]],
    drums: [['k...k...', '..s...s.', 'hhhhhhhh']],
  },

  // Sunset Beach: a lazy island shuffle with a steel-drum lead, F major
  'bg-sunset': {
    name: 'Island Breeze',
    key: 'F',
    bpm: 112,
    swing: 0.22,
    leadWave: 'triangle',
    leadEnv: 'pluck',
    leadVol: 0.5,
    lead: [
      'C5 - A4 C5 F5 - E5 F5', 'D5 - - A4 F5 - D5 -', 'Bb4 - D5 G5 - F5 D5 Bb4', 'C5 - E5 G5 - - . .',
      'A5 - F5 A5 C6 - A5 F5', 'F5 - D5 F5 A5 - F5 D5', 'D5 - F5 Bb5 - A5 G5 F5', 'E5 - - - G5 - . .',
      'F5 - D5 - Bb4 - D5 F5', 'G5 - E5 - C5 - E5 G5', 'A5 - G5 E5 C5 - E5 G5', 'F5 - - - D5 - F5 A5',
      'Bb5 - A5 G5 D5 - G5 Bb5', 'A5 - G5 E5 C5 - D5 E5', 'F5 - C5 - A4 - C5 -', 'F5 - - - . . . .',
    ],
    chords: ['F', 'Dm', 'Gm', 'C', 'F', 'Dm', 'Bb', 'C', 'Bb', 'C', 'Am', 'Dm', 'Gm', 'C', 'F', 'F'],
    arp: { from: 8, wave: 'pulse12', vol: 0.05 },
    bass: [[R, 2], null, null, [F, 1], [R, 2], null, [F, 1], null],
    drums: [['k...k...', '...s..s.', 'h.hhh.hh']],
    drumVol: 0.8,
  },

  // Under the Sea: a slow, floaty waltz with an echo, D minor
  'bg-ocean': {
    name: 'Bubble Waltz',
    key: 'Dm',
    bpm: 100,
    beat: 6,
    leadWave: 'triangle',
    leadVol: 0.55,
    echo: 0.35,
    lead: [
      'A4 - D5 - F5 -', 'F5 - D5 - Bb4 -', 'A4 - C5 - F5 -', 'E5 - - - . .',
      'D5 - F5 - A5 -', 'Bb5 - A5 - F5 -', 'G5 - Bb5 - D6 -', 'C#6 - - - A5 -',
      'C6 - A5 - F5 -', 'G5 - E5 - C5 -', 'D5 - F5 - A5 C6', 'Bb5 - - - F5 -',
      'G5 - A5 - Bb5 -', 'A5 - G5 - E5 -', 'D5 - - - . .', 'E5 - C#5 - E5 -',
    ],
    chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'A'],
    arp: { wave: 'pulse12', octave: 5, order: 'updown', vol: 0.04 },
    bass: [[R, 2, 2.5], null, null, null, [F, 2], null],
    drums: [['k.....', '......', '..h.h.']],
    drumVol: 0.6,
  },

  // Outer Space: a spacey sequencer loop with an echo, A minor
  'bg-space': {
    name: 'Moon Base',
    key: 'Am',
    bpm: 120,
    leadWave: 'pulse25',
    leadVol: 0.3,
    echo: 0.4,
    lead: [
      'A4 - - - E5 - - -', 'F5 - E5 - C5 - - -', 'G5 - - - E5 - C5 -', 'D5 - - - - - . .',
      'A5 - - - B5 - C6 -', 'A5 - - - F5 - - -', 'G5 - B5 - D6 - - -', 'B5 - - - - - . .',
      'C6 - B5 - A5 - F5 -', 'D6 - C6 - B5 - G5 -', 'E6 - - - C6 - A5 -', 'B5 - C6 - E6 - - -',
      'F6 - E6 - C6 - A5 -', 'G5 - B5 - D6 - - -', 'G#5 - - - B5 - - -', 'E6 - - - . . . .',
    ],
    chords: ['Am', 'F', 'C', 'G', 'Am', 'F', 'G', 'Em', 'F', 'G', 'Am', 'Am', 'F', 'G', 'E', 'E'],
    arp: { wave: 'pulse12', octave: 4, vol: 0.06 },
    bass: [[R, 2], [R, 3], [R, 2], [R, 3], [R, 2], [R, 3], [R, 2], [R, 3]],
    drums: [['k.....k.', '........', 'h.h.h.h.'], ['k.....k.', '....s...', 'h.h.h.h.']],
  },

  // Castle: a proud royal march with snare rolls, D major
  'bg-castle': {
    name: 'Royal March',
    key: 'D',
    bpm: 108,
    leadWave: 'square',
    leadVol: 0.3,
    lead: [
      'A4 - - D5 D5 - F#5 -', 'G5 - F#5 - E5 - D5 -', 'F#5 - - A5 A5 - F#5 -', 'E5 - - - A4 - . .',
      'D5 - F#5 - A5 - D6 -', 'B5 - - A5 G5 - B5 -', 'A5 - G5 - F#5 - E5 -', 'D5 - - - . . . .',
      'F#5 - - F#5 B5 - F#5 -', 'G5 - - B5 D6 - B5 -', 'A5 - - F#5 D5 - F#5 A5', 'E5 - - - C#5 - E5 -',
      'D6 - - B5 G5 - B5 D6', 'C#6 - - A5 E5 - A5 C#6', 'D6 - A5 - F#5 - A5 -', 'D6 - - - . . . .',
    ],
    chords: ['D', 'G', 'D', 'A', 'D', 'G', 'A', 'D', 'Bm', 'G', 'D', 'A', 'G', 'A', 'D', 'D'],
    arp: { from: 8, wave: 'pulse25', vol: 0.05 },
    bass: [[R, 2], null, [F, 1], null, [R, 2], null, [F, 1], null],
    drums: [['k...k...', 's.ss..s.', '........']],
    fill: ['k...k...', 's.s.ssss', '........'],
  },

  // Volcano Island: fast and fiery with pounding toms, E minor
  'bg-volcano': {
    name: 'Lava Run',
    key: 'Em',
    bpm: 150,
    leadWave: 'pulse25',
    leadVol: 0.32,
    lead: [
      'E5 - E5 G5 - E5 B5 -', 'C6 - B5 - G5 - E5 -', 'F#5 - F#5 A5 - F#5 D6 -', 'B5 - - - E5 - . .',
      'E5 - E5 G5 - E5 B5 -', 'C6 - B5 - C6 - E6 -', 'D6 - C6 - B5 - A5 -', 'B5 - - - D#5 - F#5 -',
      'G5 - E5 - G5 - C6 -', 'A5 - F#5 - A5 - D6 -', 'B5 - G5 - B5 - E6 -', 'E6 - D6 - B5 - G5 -',
      'C6 - - - E6 - C6 -', 'D6 - - - F#6 - D6 -', 'D#6 - - - B5 - F#5 -', 'B5 - A5 - G5 - F#5 -',
    ],
    chords: ['Em', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'C', 'D', 'Em', 'Em', 'C', 'D', 'B', 'B'],
    arp: { from: 8, wave: 'square', octave: 4, vol: 0.05 },
    bass: [[R, 2], [R, 2], [R, 3], [R, 2], [R, 2], [R, 3], [F, 1], [R, 2]],
    drums: [['k..k.k..', '..s...s.', 'hhhhhhhh'], ['k..k.k..', '..s...s.', 'hhhhhhhh', 't.....t.']],
    fill: ['k.......', '........', 'hhhhhhhh', '..t.tttt'],
  },

  // Rainforest: a bouncy marimba over jungle toms, A minor
  'bg-rainforest': {
    name: 'Jungle Drums',
    key: 'Am',
    bpm: 124,
    swing: 0.16,
    leadWave: 'triangle',
    leadEnv: 'pluck',
    leadVol: 0.55,
    lead: [
      'A4 - C5 E5 - D5 C5 A4', 'G4 - B4 D5 - C5 B4 G4', 'F4 A4 C5 F5 - E5 D5 C5', 'E5 - - - G#4 - B4 -',
      'A5 - G5 E5 - D5 E5 G5', 'F#5 - E5 D5 - A4 D5 F#5', 'F5 - E5 C5 - A4 C5 F5', 'E5 - - - . . B4 -',
      'C5 - E5 - A5 - G5 E5', 'D5 - G5 - B5 - A5 G5', 'C6 - A5 - F5 - A5 C6', 'B5 - G#5 - E5 - . .',
      'A5 C6 A5 E5 A5 C6 A5 E5', 'G5 B5 G5 D5 G5 B5 G5 D5', 'E5 G#5 B5 G#5 E5 G#5 B5 D6', 'A5 - - - . . . .',
    ],
    chords: ['Am', 'G', 'F', 'E', 'Am', 'D', 'F', 'E', 'Am', 'G', 'F', 'E', 'Am', 'G', 'E', 'Am'],
    arp: { from: 8, wave: 'pulse12', octave: 4, vol: 0.05 },
    bass: [[R, 2], null, [F, 1], [R, 2], null, [R, 2], [F, 1], null],
    drums: [['k..k..k.', '....s...', 'h.h.h.hh', '.t...t.t'], ['k..k..k.', '....s..s', 'h.h.h.hh', '.t.t.tt.']],
    fill: ['k.......', '........', 'hhhhhhhh', 'tttt.ttt'],
    drumVol: 0.85,
  },

  // Rainbow Land: a skippy, sugary bounce with a bell lead, G major
  'bg-rainbow': {
    name: 'Candy Skip',
    key: 'G',
    bpm: 138,
    swing: 0.28,
    leadWave: 'pulse12',
    leadEnv: 'pluck',
    leadVol: 0.42,
    lead: [
      'D5 G5 B5 G5 D6 - B5 -', 'E5 G5 B5 G5 E6 - B5 -', 'C6 - E6 - D6 C6 B5 A5', 'A5 - - - F#5 - . .',
      'G5 - B5 - D6 - G6 -', 'E6 - D6 - B5 - G5 -', 'A5 - C6 - E6 - C6 -', 'D6 - - - . . . .',
      'E6 D6 C6 - G5 - C6 -', 'F#6 E6 D6 - A5 - D6 -', 'D6 - B5 - F#5 - B5 -', 'G5 - - - E5 - G5 -',
      'C6 - E6 - G6 - E6 -', 'F#6 - - D6 A5 - F#5 -', 'G5 - B5 - D6 - B5 -', 'G5 - - - . . . .',
    ],
    chords: ['G', 'Em', 'C', 'D', 'G', 'Em', 'Am', 'D', 'C', 'D', 'Bm', 'Em', 'C', 'D', 'G', 'G'],
    arp: { from: 4, wave: 'triangle', octave: 5, order: 'updown', vol: 0.12 },
    bass: [[R, 2], null, [F, 2], null, [R, 3], null, [F, 2], null],
    drums: [['k...k...', '..s...s.', 'h.h.h.h.']],
    drumVol: 0.8,
  },

  // Golden Galaxy: slow, shimmering and grand, G major with a dreamy lift
  'bg-galaxy': {
    name: 'Golden Stars',
    key: 'G',
    bpm: 96,
    leadWave: 'pulse25',
    leadVol: 0.28,
    echo: 0.45,
    lead: [
      'E5 - - - G5 - C6 -', 'F#5 - - - A5 - D6 -', 'E6 - - - D6 - C6 -', 'D6 - - - - - . .',
      'B5 - - - G5 - E5 -', 'F#5 - - - D5 - B4 -', 'C5 - E5 - G5 - C6 -', 'A5 - - - - - . .',
      'G5 - C6 - E6 - - -', 'F#6 - - - D6 - A5 -', 'B5 - D6 - F#6 - - -', 'E6 - - - B5 - G5 -',
      'A5 - C6 - E6 - - -', 'D6 - - - F#6 - A6 -', 'G6 - - - D6 - B5 -', 'G5 - - - . . . .',
    ],
    chords: ['C', 'D', 'C', 'D', 'Em', 'Bm', 'C', 'D', 'C', 'D', 'Bm', 'Em', 'Am', 'D', 'G', 'G'],
    arp: { wave: 'pulse12', octave: 5, order: 'updown', vol: 0.05 },
    bass: [[R, 2, 3.5], null, null, null, [F, 2, 3.5], null, null, null],
    drums: [['k.......', '....s...', '..h...h.']],
    drumVol: 0.6,
  },
};

// Short songs for the secret shows (see mapshow.js): five bars, about 8 seconds, played
// once over the map song (which goes quiet meanwhile). Same format as SONGS.
export const SHOW_SONGS = {
  // the Great Oak: twinkly and magical, fireflies everywhere
  'bg-meadow': {
    name: 'Great Oak Lights', key: 'C',
    bpm: 150, echo: 0.35,
    lead: ['C6 G5 E6 G5 C6 G5 E6 G5', 'D6 A5 F6 A5 D6 A5 F6 A5', 'E6 C6 G6 C6 E6 - D6 C6', 'B5 G5 D6 G5 B5 - C6 D6', 'C6 - G6 - C7 - - -'],
    chords: ['C', 'Dm', 'C', 'G', 'C'],
    arp: { from: 0, octave: 5, vol: 0.05 },
    bass: [[R, 2], null, [F, 2], null, [R, 2], null, [F, 2], null],
    drums: [['k.......', '....s...', 'h.h.h.h.']],
  },
  // the ghost pirate ship: a spooky sea shanty in D minor
  'bg-sunset': {
    name: 'Ghost Ship Shanty', key: 'Dm',
    bpm: 150, swing: 0.2,
    lead: ['D5 - A4 D5 F5 - E5 D5', 'C5 - G4 C5 E5 - D5 C5', 'Bb4 - D5 F5 A5 - G5 F5', 'A5 - C#5 E5 A5 - . .', 'D6 - A5 - D5 - - -'],
    chords: ['Dm', 'C', 'Bb', 'A', 'Dm'],
    bass: [[R, 2], null, [F, 1], [R, 2], null, [F, 1], [R, 2], null],
    drums: [['k..k..k.', '...s...s', 'h.hh.hh.']],
  },
  // the Kraken: low and mysterious, then a big splash, E minor
  'bg-ocean': {
    name: 'The Kraken Wakes', key: 'Em',
    bpm: 140,
    leadWave: 'triangle', leadVol: 0.55,
    lead: ['E4 - - G4 - - B4 -', 'C5 - - B4 - - G4 -', 'E4 - - G4 - - B4 -', 'D#5 - - F#5 - - B5 -', 'E5 - B4 - E6 - - -'],
    chords: ['Em', 'C', 'Em', 'B', 'Em'],
    arp: { from: 2, wave: 'triangle', octave: 4, vol: 0.1 },
    bass: [[R, 1], null, null, [R, 1], null, null, [F, 1], null],
    drums: [['t.....t.', '...k....', '........'], ['k.t.k.t.', '....s...', 'hhhhhhhh']],
  },
  // the moon worm roller coaster: bouncy and fast
  'bg-space': {
    name: 'Moon Worm Coaster', key: 'G',
    bpm: 168,
    lead: ['G5 B5 D6 G6 F#6 D6 B5 A5', 'G5 B5 D6 G6 A6 G6 F#6 E6', 'C6 E6 G6 E6 D6 F#6 A6 F#6', 'G6 - D6 - B5 - G5 -', 'G5 B5 D6 G6 - - - -'],
    chords: ['G', 'G', 'C', 'D', 'G'],
    arp: { from: 0, octave: 4, order: 'updown', vol: 0.06 },
    bass: [[R, 2], [R, 3], [F, 2], [R, 3], [R, 2], [R, 3], [F, 2], [R, 3]],
    drums: [['k...k...', '..s...s.', 'hhhhhhhh']],
  },
  // the Dragon King: a royal fanfare in Bb
  'bg-castle': {
    name: 'Dragon King Fanfare', key: 'Bb',
    bpm: 132,
    lead: ['F5 - F5 F5 Bb5 - - -', 'C6 - C6 C6 D6 - Bb5 -', 'Eb6 - D6 - C6 - Bb5 -', 'C6 - - - F5 - . .', 'Bb5 - D6 - F6 - - -'],
    chords: ['Bb', 'F', 'Eb', 'F', 'Bb'],
    arp: { from: 1, octave: 4, vol: 0.06 },
    bass: [[R, 2], null, [R, 2], null, [F, 1], null, [R, 2], null],
    drums: [['k..k....', '....s...', '........'], ['k..k..k.', '....s.ss', 'hhhhhhhh']],
  },
  // the phoenix: drums and fire, A minor
  'bg-volcano': {
    name: 'Phoenix Fire', key: 'Am',
    bpm: 156,
    lead: ['. . . . . . . .', 'A5 - - E5 A5 - C6 -', 'B5 - - G5 B5 - D6 -', 'C6 - B5 - A5 - G#5 -', 'A5 - E6 - A6 - - -'],
    chords: ['Am', 'Am', 'G', 'F', 'Am'],
    arp: { from: 1, octave: 4, vol: 0.06 },
    bass: [[R, 1], [R, 1], null, [R, 1], [R, 2], null, [R, 1], null],
    drums: [['t.t.t.tt', 'k...k...', '........'], ['k.tkk.t.', '..s...s.', 'hhhhhhhh']],
  },
  // the rainbow slide: a happy gallop in G
  'bg-rainbow': {
    name: 'Rainbow Slide', key: 'G',
    bpm: 160, swing: 0.25,
    lead: ['D5 G5 B5 D6 B5 G5 B5 D6', 'E6 - D6 B5 C6 - A5 -', 'B5 G5 B5 D6 G6 - E6 -', 'D6 - C6 - B5 - A5 -', 'G5 B5 D6 G6 - - - -'],
    chords: ['G', 'C', 'G', 'D', 'G'],
    arp: { from: 0, octave: 5, vol: 0.05 },
    bass: [[R, 2], null, [F, 2], null, [R, 2], null, [F, 2], null],
    drums: [['k..k..k.', '...s...s', 'h.h.h.h.']],
  },
  // the space whale: slow and dreamy, F with a lift
  'bg-galaxy': {
    name: 'Star Whale Dream', key: 'F',
    bpm: 120, echo: 0.45,
    leadWave: 'triangle', leadVol: 0.55,
    lead: ['F5 - - - A5 - C6 -', 'B5 - - - G5 - - -', 'A5 - - - C6 - E6 -', 'D6 - - - B5 - - -', 'C6 - F6 - - - - -'],
    chords: ['F', 'G', 'F', 'G', 'F'],
    arp: { from: 0, octave: 5, vol: 0.05, order: 'updown' },
    bass: [[R, 1], null, null, null, [F, 1], null, null, null],
    drums: [['k.......', '........', '....h...']],
  },
  // the rain dance: jungle drums and a bouncy pipe tune, D dorian
  'bg-rainforest': {
    name: 'Rain Dance', key: 'Ddor',
    bpm: 140,
    leadWave: 'triangle', leadVol: 0.5,
    lead: ['. . . . . . . .', 'D5 - F5 G5 A5 - G5 F5', 'E5 - G5 A5 B5 - A5 G5', 'A5 C6 A5 G5 F5 G5 E5 -', 'D5 - A5 - D6 - - -'],
    chords: ['Dm', 'Dm', 'Em', 'C', 'Dm'],
    arp: { from: 1, octave: 4, vol: 0.05 },
    bass: [[R, 2], null, [R, 2], [F, 1], null, [R, 2], null, [F, 1]],
    drums: [['t..t.tt.', 'k...k...', '........'], ['t.tt.tt.', 'k..k.k..', 'h.h.h.h.']],
  },
};
