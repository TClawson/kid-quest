// The songbook's concert pieces: long pieces in several parts, each part with its own key,
// meter and speed (read by concert.js, shown in the songbook by songbook.js). Made by a script
// from the finished music files: don't edit by hand, run the script again.
//
// Keyed by piece id ('long:' and the map the piece comes from). Each piece has name, map (the
// background id of the map whose song it grows from), story (one line for the piece's page)
// and levels: { easy, medium, hard }, only the ones written so far. A level is a list of
// sections, played in order: { name (shown over its first bar), meter ('4/4' or '6/8'; left
// out when it is 3/4), key ('C', 'Dm', 'Fm', 'Ddor': its key signature), bpm (quarter notes a
// minute; in 6/8 dotted quarters), bpmTo and rampBars (when the speed slides: from bpm to
// bpmTo a bar at a time, over the first rampBars bars, or over the whole section without
// rampBars), marks (words over a bar, by its index in the section from 0: { 0: 'with pedal' }),
// rh, lh (one string per bar), chords (one chord name per bar, shown above it: 'Gm/D', 'Cm6',
// 'A7', 'Gsus4') }. A section's key and bars can differ between levels; the sections are the
// same.
//
// The bars are in the same ABC notation as arrangements.js (read by arrange.js): L:1/8 (an
// eighth note is 1: six to a bar in 3/4 and 6/8, eight in 4/4), notes 'c' (C5), 'C' (C4),
// 'C,' (C3), "c'" (C6), '^' sharp, '_' flat, '=' natural over the section's key signature;
// lengths '2' quarter, '3' dotted quarter, '4' half, '6' dotted half, '8' whole, '/2'
// sixteenth; chords '[CEG]2'; rests 'z2'; ties 'c2-' (also into the next bar); slurs '( )';
// dynamics '!pp!' '!p!' '!mp!' '!mf!' '!f!' '!ff!' at the start of a right-hand bar (each lasts
// till the next, across sections). Also:
//   '&'           a second voice in the same hand: it counts again from the start of the bar
//                 ('d4 de & B2 A2 B2'); each voice fills the bar, and accidentals are written
//                 in each voice.
//   'x'           a rest that isn't printed (a voice waiting: 'x2 [D,G,]2 [D,G,]2 & G,,6').
//   '!fermata!'   hold this bar: it lasts 1.7 times as long.
//   '.'           before a note or chord: short (staccato), it sounds for 45% of its length.
//   '!arpeggio!'  before a chord: rolled, its notes start one after another from the lowest.
//   '"Fm"'        a second chord name inside a bar, printed where it is written.

export const LONG_PIECES = {
  // Bubble Waltz/Mermaid's Lullaby: 8 parts
  'long:bg-ocean': {
    name: 'Bubble Waltz/Mermaid\'s Lullaby',
    map: 'bg-ocean',
    story: 'A long piece in eight parts: float on the waves, dance the Bubble Waltz, sink to the mermaid\'s grotto and hear her lullaby, then swim back up.',
    levels: {
      easy: [
        {
          name: 'Above the Water', key: 'Dm', bpm: 88,
          rh: [
            '!pp! F4 A2', 'G4 B2', 'd4 d_e', 'd4 B2',
            '!p! d4 d_e', 'd2 g4', 'f4 d2', 'B2 A2 G2',
            '!pp! F6', '!fermata!E6',
          ],
          lh: [
            'D,2 A,4', 'D,2 B,4', 'D,2 F,4', 'D,2 G,4',
            'D,2 F,4', 'D,2 B,4', 'D,2 A,4', 'B,,2 D,4',
            'A,,2 D,4', 'A,,2 ^C,4',
          ],
          chords: ['Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/Bb', 'Dm/A', 'A'],
        },
        {
          name: 'The Bubble Waltz', key: 'Dm', bpm: 100,
          rh: [
            '!p! A2 d2 f2', 'f2 d2 B2', 'A2 c2 f2', 'e6',
            '!mp! d2 f2 a2', 'b2 a2 f2', 'g2 b2 d\'2', '^c\'4 a2',
          ],
          lh: [
            'D,2 A,4', 'B,,2 F,4', 'F,2 C4', 'C,2 G,4',
            'D,2 A,4', 'B,,2 F,4', 'G,,2 D,4', 'A,,2 E,4',
          ],
          chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A'],
        },
        {
          name: 'Sinking', key: 'Gm', bpm: 96,
          rh: [
            '!p! a2 ^f2 d2', 'c2 A2 ^F2', '!pp! E4 D2', 'z6',
          ],
          lh: [
            'D,2 A,4', 'D,6', 'D,6', 'G,,2 D,4',
          ],
          chords: ['D', 'D7', 'D7', 'Gm'],
        },
        {
          name: 'The Grotto', key: 'Gm', bpm: 96,
          rh: [
            '!p! D4 DE', 'D2 G4', 'B2 A2 G2', 'F4 F2',
            '_A2 G2 F2', 'E4 E2', 'D4 ^C2', 'G6',
            '!mp! G4 G_A', 'G2 d4', 'e2 d2 c2', 'B4 F2',
            '!p! _A2 G2 F2', 'E4 DE', 'D4 D2', 'G4 E2',
            '!pp! ^C6',
          ],
          lh: [
            'G,2 B,4', 'G,2 B,4', 'G,2 B,4', 'A,2 C4',
            '_A,2 C4', 'G,2 B,4', '^F,2 A,4', 'G,2 B,4',
            'C,2 E,4', 'G,2 B,4', 'C,2 E,4', 'G,2 B,4',
            'F,2 _A,4', 'C,2 G,4', 'D,2 B,4', 'E,2 B,4',
            '[A,,=E,]6',
          ],
          chords: ['Gm', 'Gm', 'Gm', 'F/A', 'Fm/Ab', 'Eb/G', 'D/F#', 'Gm', 'Cm', 'Gm', 'Cm', 'Gm', 'Fm', 'Cm', 'Gm/D', 'Eb', 'A'],
        },
        {
          name: 'The Current Stirs', key: 'Dm', bpm: 100,
          rh: [
            '!p! ^C2 E2 G2', 'D2 F2 A2', 'E2 G2 ^c2', '!mp! F2 A2 d2',
            'G2 ^c2 e2', '!mf! e2 g2 a2',
          ],
          lh: [
            'A,,2 E,4', 'A,,2 F,4', 'A,,2 E,4', 'A,,2 F,4',
            'A,,2 E,4', 'A,,2 E,4',
          ],
          chords: ['A7', 'Dm/A', 'A7', 'Dm/A', 'A7', 'A7'],
        },
        {
          name: 'Full Current', key: 'Dm', bpm: 100,
          rh: [
            '!f! A2 d2 f2', 'f2 d2 B2', 'A2 c2 f2', 'e6',
            'd2 f2 a2', 'b2 a2 f2', 'g2 b2 d\'2', '^c\'4 a2',
            '!ff! f2 b2 d\'2', 'e2 a2 ^c\'2', 'd\'6', 'a2 f2 d2',
          ],
          lh: [
            '[D,A,]6', '[B,,F,]6', '[F,C]6', '[C,G,]6',
            '[D,A,]6', '[B,,F,]6', '[G,,D,]6', '[A,,E,]6',
            '[B,,F,]6', '[A,,E,]6', '[D,A,]6', '[D,A,]6',
          ],
          chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'A', 'Dm', 'Dm'],
        },
        {
          name: 'The Echo After', key: 'Dm', bpm: 100,
          rh: [
            '!p! c\'2 a2 f2', 'g2 e2 c2', 'd2 f2 a2', 'b4 f2',
            'g2 a2 b2', 'a2 g2 e2', 'd2 a2 f2', '!pp! d6',
          ],
          lh: [
            'F,2 C4', 'C,2 G,4', 'D,2 A,4', 'B,,2 F,4',
            'G,,2 D,4', 'A,,2 E,4', 'D,2 A,4', 'D,2 F,4',
          ],
          chords: ['F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm'],
        },
        {
          name: 'The Surface', key: 'Dm', bpm: 92,
          rh: [
            '!pp! d4 d_e', 'd2 g4', 'b2 a2 g2', 'f6',
            'd4 d2', 'g4 _e2', '^c6', 'd6',
            'A2 d2 f2', 'g6', '!fermata![Fd]6',
          ],
          lh: [
            'D,2 B,4', 'D,2 B,4', 'D,2 B,4', 'D,2 A,4',
            'D,2 B,4', '_E,2 B,4', 'A,,2 E,4', 'D,2 F,4',
            'D,2 A,4', 'D,2 B,4', '[D,A,]6',
          ],
          chords: ['Gm/D', 'Gm/D', 'Gm/D', 'Dm', 'Gm/D', 'Eb', 'A', 'Dm', 'Dm', 'Gm/D', 'Dm'],
        },
      ],
      medium: [
        {
          name: 'Above the Water', key: 'Dm', bpm: 88,
          rh: [
            '!pp! [FAd]6', '[GBd]6', '[FAd]4 d_e', '[GBd]6',
            '[FAd]4 [FAd]2', '[GBd]4 [GBd]2', '!p! [FAd]4 d_e', '[Bd]2 [Bdg]4',
            '[Adf]4 [Adf]2', '[Bdg]4 [Bdg]2', '[db]2 [ca]2 [Bg]2', '[Adf]6',
            '!pp! [A^ce]6', '!fermata![A^ce]6',
          ],
          lh: [
            'D,2 [A,D]2 [F,A,]2', 'D,2 [B,D]2 [G,B,]2', 'D,2 [A,D]2 [F,A,]2', 'D,2 [B,D]2 [G,B,]2',
            'D,2 [A,D]2 [F,A,]2', 'D,2 [B,D]2 [G,B,]2', 'D,2 [A,D]2 [F,A,]2', 'D,2 [B,D]2 [G,B,]2',
            'D,2 [A,D]2 [F,A,]2', 'D,2 [B,D]2 [G,B,]2', 'B,,2 [G,B,]2 [D,G,]2', 'A,,2 [F,A,]2 [D,A,]2',
            'A,,2 [E,A,]2 [E,G,]2', 'A,,2 [E,G,]4',
          ],
          chords: ['Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Gm/Bb', 'Dm/A', 'A7', 'A7'],
        },
        {
          name: 'The Bubble Waltz', key: 'Em', bpm: 100,
          rh: [
            '!pp! [^DF]2 [FA]2 [A^d]2', '!p! [GB]2 [Ge]2 [Bg]2', '[eg]2 [ce]2 (c/B/A/c/)', '[GB]2 [Gd]2 [Bg]2',
            '[Adf]4 (a/f/d/f/)', '!mp! [Be]2 [eg]a [gb]2', '[ec\']2 [gb]a [eg]2', '[ea]2 [ac\']2 [c\'e\']2',
            '!mf! [fb^d\']4 [^dfb]2', '!mp! [bd\']2 [db]2 [Bg]2', '[da]2 [df]2 [Fd]2', '[Ge]2 [Bg]2 [gb]d\'',
            '[egc\']2 (b/c\'/b/a/) [eg]2', '[ca]2 [db]2 [ec\']2', '[^db]2 [fa]2 [^df]2', '!p! [GBe]4 (B/e/g/b/)',
            '[^df]2 [B^d]2 [^df]2',
          ],
          lh: [
            'B,,2 [F,A,]4', 'E,G, B,E B,G,', 'C,E, G,C G,E,', 'G,,B,, D,G, D,B,,',
            'D,F, A,D A,F,', 'E,2 [G,B,E]2 [G,B,E]2', 'C,2 [E,G,C]2 [E,G,C]2', 'A,,2 [E,A,]2 [E,A,]2',
            'B,,2 [^D,F,B,]2 [^D,F,B,]2', 'G,B, DB, G,B,', 'F,A, DA, F,A,', 'E,B, EB, G,B,',
            'C,G, CG, E,G,', 'A,,2 [E,A,]2 [E,A,]2', 'B,,2 [F,A,]2 [F,A,]2', 'E,G, B,E B,G,',
            'B,,F, B,F, [B,,F,]2',
          ],
          chords: ['B7', 'Em', 'C', 'G', 'D', 'Em', 'C', 'Am', 'B', 'G', 'D', 'Em', 'C', 'Am', 'B7', 'Em', 'B'],
        },
        {
          name: 'Sinking', key: 'Em', bpm: 96,
          rh: [
            '!p! b2 f2 ^d2', '=d2 c2 A2', '!pp! F2 _E2 D2', 'z6',
          ],
          lh: [
            'B,,2 [F,B,]4', 'D,2 [F,C]4', 'D,2 [C,F,]4', 'G,,2 [D,G,]4',
          ],
          chords: ['B', 'D7', 'D7', 'Gm'],
        },
        {
          name: 'The Grotto', key: 'Gm', bpm: 96,
          rh: [
            '!p! [B,D]4 DE', '[B,D]2 [B,G]4', '[DB]2 [CA]2 [B,G]2', '[CF]4 [CF]2',
            '[C_A]2 [B,G]2 [_A,F]2', '[B,E]4 [B,E]2', '[A,D]4 [A,^C]2', '[B,DG]6',
            '!mp! [EG]4 G_A', '[B,G]2 [GBd]4', '[Ge]2 [Fd]2 [Ec]2', '[DB]4 [DF]2',
            '!p! [C_A]2 [B,G]2 [_A,F]2', '[CE]4 DE', '[B,D]4 [B,D]2', '[B,G]4 [B,E]2',
            '!pp! [A,^C]6',
          ],
          lh: [
            'G,,2 [E,G,]2 [D,G,]2', '[G,,G,]2 F,2 E,2', 'G,,2 [D,G,]4', 'A,,2 [C,F,]4',
            '_A,,2 [C,F,]4', 'G,,2 [E,G,]4', '^F,,2 [A,,D,]4', 'G,,2 D,2 G,2',
            'G,,2 [C,G,]4', '[G,,G,]2 F,2 E,2', 'C,2 [E,G,]4', 'G,,2 [D,G,]4',
            'F,,2 [C,F,]4', 'C,2 G,2 =A,2', 'D,2 G,2 ^F,2', 'E,,2 [B,,E,]4',
            'A,,2 [=E,G,]4',
          ],
          chords: ['Gm', 'Gm', 'Gm', 'F/A', 'Fm/Ab', 'Eb/G', 'D/F#', 'Gm', 'Cm/G', 'Gm', 'Cm', 'Gm', 'Fm', 'Cm6', 'Gm/D', 'Eb', 'A7'],
        },
        {
          name: 'The Current Stirs', key: 'Dm', bpm: 100,
          rh: [
            '!pp! [A,^C]2 E2 G2', '[A,D]2 F2 A2', '!p! [^CE]2 [EA]2 [A^c]2', '[DF]2 [FA]2 [Ad]2',
            '!mp! [EA]2 [A^c]2 [^ce]2', '[FA]2 [Ad]2 [df]2', '!mf! [G^c]2 [^ce]2 [eg]2', 'z2 A/^c/e/g/ a2',
          ],
          lh: [
            'A,,2 [E,G,]4', 'A,,2 [F,A,]4', 'A,,2 E,2 A,2', 'A,,2 F,2 A,2',
            'A,,E, A,E, ^C,E,', 'A,,F, A,F, D,F,', 'A,,E, G,E, ^C,E,', 'A,/^C/E/G/ z4',
          ],
          chords: ['A7', 'Dm/A', 'A', 'Dm/A', 'A', 'Dm/A', 'A7', 'A7'],
        },
        {
          name: 'Full Current', key: 'Dm', bpm: 100,
          rh: [
            '!f! [DFA]2 [FAd]2 [Adf]2', '[Bdf]2 [FBd]2 (B/A/G/B/)', '[CFA]2 [FAc]2 [Acf]2', '[Gce]4 (g/e/c/e/)',
            '[FAd]2 [Adf]2 [dfa]2', '[dfb]2 [dfa]2 [Bdf]2', '[Bdg]2 [dgb]2 [gbd\']2', '[ea^c\']4 [^cea]2',
            '!ff! [Bdf]2 [dfb]2 [fbd\']2', '[^cea]2 [ea^c\']2 [a^c\'e\']2', '[ad\'f\']6', '(f\'d\' af d2)',
          ],
          lh: [
            'D,F, A,D A,F,', 'B,,D, F,B, F,D,', 'F,,C, F,C, A,,C,', 'C,E, G,C G,E,',
            'D,2 [F,A,D]2 [F,A,D]2', 'B,,2 [F,B,]2 [F,B,]2', 'G,,2 [D,G,]2 [D,G,]2', 'A,,2 [E,G,]2 [E,G,]2',
            'B,,2 [D,F,B,]2 [D,F,B,]2', 'A,,2 [E,G,A,]2 [E,G,A,]2', 'D,,2 A,,2 D,2', '[D,,A,,D,]6',
          ],
          chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'A7', 'Dm', 'Dm'],
        },
        {
          name: 'The Echo After', key: 'Dm', bpm: 100,
          rh: [
            '!p! [fac\']2 [ca]2 [Af]2', '[cg]2 [ce]2 [Ec]2', '[Fd]2 [Af]2 [fa]c\'', '[dfb]2 (a/b/a/g/) [df]2',
            '!mp! [Bg]2 [ca]2 [db]2', '[^ca]2 [eg]2 [^ce]2', '!p! [FAd]4 (A/d/f/a/)', '!pp! [FAd]6',
          ],
          lh: [
            'F,A, CA, F,A,', 'E,G, CG, E,G,', 'D,A, DA, F,A,', 'B,,F, B,F, D,F,',
            'G,,D, G,D, B,,D,', 'A,,E, A,G, E,^C,', 'D,A, DA, F,A,', 'D,,2 A,,2 D,2',
          ],
          chords: ['F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm'],
        },
        {
          name: 'The Surface', key: 'Dm', bpm: 92,
          rh: [
            '!pp! [Bd]4 d_e', 'd2 [Bg]4', '[db]2 [ca]2 [Bg]2', '[Af]4 d_e',
            '[Bd]4 [Bd]2', '[Bg]4 [B_e]2', '[A^c]6', '[FAd]6',
            '[FA]2 [Fd]2 [Af]2', '[Ad]2 [df]2 [fa]2', '[ad\']2 [d\'f\']4', '[GBd]6',
            '!fermata![FAd]6',
          ],
          lh: [
            'D,2 [G,B,]2 [G,B,]2', 'D,2 [G,B,]2 [G,B,]2', 'D,2 [G,B,]2 [G,B,]2', 'D,2 [F,A,]2 [F,A,]2',
            'D,2 [G,B,]2 [G,B,]2', '_E,2 [G,B,]2 [G,B,]2', 'A,,2 [E,G,]2 [E,G,]2', 'D,2 [F,A,]2 [F,A,]2',
            'D,2 [F,A,]2 [F,A,]2', 'D,2 [F,A,]2 [F,A,]2', 'D,2 [F,A,]4', 'D,2 [G,B,]4',
            '[D,,A,,D,]6',
          ],
          chords: ['Gm/D', 'Gm/D', 'Gm/D', 'Dm', 'Gm/D', 'Eb', 'A7', 'Dm', 'Dm', 'Dm', 'Dm', 'Gm/D', 'Dm'],
        },
      ],
      hard: [
        {
          name: 'Above the Water', key: 'Dm', bpm: 88,
          rh: [
            '!pp! [FAd]6', '[GBd]6', '[FAd]4 d_e', '[GBd]6',
            '[FAd]4 [FAd]2', '[GBd]4 [GBd]2', '!p! [FAd]4 d_e', '[Bd]2 [Bdg]4',
            '[Adf]4 [Adf]2', '[Bdg]4 [Bdg]2', '[db]2 [ca]2 [Bg]2', '[Adf]6',
            '!pp! [A^ce]6', '!fermata![A^ce]6',
          ],
          lh: [
            'x2 [A,D]2 [F,A,]2 & D,6', 'x2 [B,D]2 [G,B,]2 & D,6', 'x2 [A,D]2 [F,A,]2 & D,6', 'x2 [B,D]2 [G,B,]2 & D,6',
            'x2 [A,D]2 [F,A,]2 & D,6', 'x2 [B,D]2 [G,B,]2 & D,6', 'x2 [A,D]2 [F,A,]2 & D,6', 'x2 [B,D]2 [G,B,]2 & D,6',
            'x2 [A,D]2 [F,A,]2 & D,6', 'x2 [B,D]2 [G,B,]2 & D,6', 'x2 [G,B,]2 [D,G,]2 & B,,6', 'x2 [F,A,]2 [D,A,]2 & A,,6',
            'x2 [E,A,]2 [E,G,]2 & A,,6', 'x2 [E,G,]4 & A,,6',
          ],
          chords: ['Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Dm', 'Gm/D', 'Gm/Bb', 'Dm/A', 'A7', 'A7'],
        },
        {
          name: 'The Bubble Waltz', key: 'Fm', bpm: 100,
          rh: [
            '!pp! [=EG]2 [GB]2 [B=e]2', '!p! [Ac]2 [Af]g [ca]2', '[fa]2 [df]2 (d/c/B/d/)', '[Ac]2 [Ae]f/g/ [ca]2',
            '[Beg]2 (e/g/b/e\'/ g\'/e\'/b/g/)', '!mp! [cf]2 [fa]b [ac\']2', '[fad\']2 [ac\']b [fa]2', '[dfb]2 [fbd\']2 [bd\'f\']2',
            '!mf! [=egc\'=e\']2 (=e/g/c\'/=e\'/) [=egc\']2', '!mp! [c\'e\']e [ac\']c [ea]A', '[gb]B [eg]G [Be]E', '[Af]F [ca]A [ac\'][c\'e\']',
            '[fad\']2 (c\'/d\'/c\'/b/) [fa]2', '[dfb]2 [fc\']2 [fbd\']2', '[=egc\']2 [=egb]a [c=eg]2', '!p! [Acf]2 (f/a/c\'/f\'/ a\'/f\'/c\'/a/)',
            '[c=eg]2 [Gc=e]2 [c=eg]2',
          ],
          lh: [
            'C,2 [G,B,]4', 'F,,C, A,C FC', 'D,A, FA, DA,', 'A,,E, A,C EC',
            'E,,B,, G,B, EB,', 'F,,2 [A,CF]2 [A,CF]2', 'D,2 [A,DF]2 [A,DF]2', '[B,,B,]2 [B,DF]2 [B,DF]2',
            '[C,C]2 [G,B,=E]2 C,B,,', 'A,,E, CE, CE,', 'E,,B,, G,B,, G,B,,', 'F,,C, A,C, A,C,',
            'D,A, FA, FA,', '[B,,B,]2 [F,B,D]2 [D,D]2', '[G,C=E]2 [C,C]2 [G,B,=E]2', 'F,,C, A,C FC',
            'C,G, C=E [C,G,C]2',
          ],
          chords: ['C7', 'Fm', 'Db', 'Ab', 'Eb', 'Fm', 'Db', 'Bbm', 'C', 'Ab', 'Eb', 'Fm', 'Db', 'Bbm', 'C', 'Fm', 'C'],
        },
        {
          name: 'Sinking', key: 'Gm', bpm: 96,
          rh: [
            '!p! g\'=e\' c\'g =ed', 'c2 A2 ^F2', '!pp! E4 D2', 'z6',
          ],
          lh: [
            'C,2 [G,=E]4', 'D,,2 [^F,C]4', 'D,,2 [C,^F,]4', 'G,,,2 [D,G,]4',
          ],
          chords: ['C', 'D7', 'D7', 'Gm'],
        },
        {
          name: 'The Grotto', key: 'Gm', bpm: 96,
          rh: [
            '!p! D4 DE & B,6', '[B,D]2 [B,DG]4', '[DB]2 [CA]2 [B,G]2', '[CF]4 [CF]2',
            '[C_A]2 [B,G]2 [_A,F]2', '[B,E]4 [B,E]2', '[A,D]4 [A,^C]2', 'G6 & [B,D]2 [B,E]2 [B,D]2',
            '!mp! G4 G_A & [CE]6', '[B,G]2 [GBd]4', '[Gce]2 [Fd]2 [Ec]2', 'B4 F2 & E2 D4',
            '!p! [C_A]2 [B,G]2 [_A,F]2', 'E4 DE & C6', '[B,D]4 [B,D]2', '[B,G]4 [B,E]2',
            '!pp! [A,^C]6',
          ],
          lh: [
            'D,2 E,2 D,2 & G,,6', 'G,2 F,2 E,2 & G,,6', '[G,,D,]6', 'D,2 C,4 & A,,6',
            '[_A,,F,]6', 'F,2 E,4 & G,,6', 'E,2 D,4 & ^F,,6', '[G,,G,]6',
            'G,,2 B,2 _A,2', 'G,2 F,2 E,2 & G,,6', 'C,,2 [E,G,]4', '[G,,G,]2 [D,G,]4',
            'F,,2 [C,F,]4', 'C,,2 G,2 =A,2', 'D,,2 G,2 ^F,2', 'E,,2 [B,,G,]4',
            'A,,2 [=E,G,]4',
          ],
          chords: ['Gm', 'Gm', 'Gm', 'F/A', 'Fm/Ab', 'Eb/G', 'D/F#', 'Gm', 'Cm/G', 'Gm', 'Cm', 'Gm', 'Fm', 'Cm6', 'Gm/D', 'Eb', 'A7'],
        },
        {
          name: 'The Current Stirs', key: 'Dm', bpm: 100,
          rh: [
            '!pp! [A,^C]2 E2 G2', '[A,D]2 F2 A2', '!p! [^CE]2 [EA]2 [A^c]2', '[DF]2 [FA]2 [Ad]2',
            '!mp! [EA]2 [A^c]2 [^ce]2', '[FA]2 [Ad]2 [df]2', '!mf! [G^c]2 [^ce]2 [eg]2', 'z2 A/^c/e/g/ a2',
          ],
          lh: [
            'A,,,2 [E,G,]4', 'A,,,2 [F,A,]4', 'A,,2 E,2 A,2', 'A,,2 F,2 A,2',
            'A,,E, A,^C EA,', 'A,,F, A,D FA,', 'A,,E, G,^C EG,', 'A,/^C/E/G/ z4',
          ],
          chords: ['A7', 'Dm/A', 'A', 'Dm/A', 'A', 'Dm/A', 'A7', 'A7'],
        },
        {
          name: 'Full Current', key: 'Dm', bpm: 100,
          rh: [
            '!f! [DFA]2 [FAd]e [Adf]2', '[Bdf]2 [FBd]2 (B/A/G/B/)', '[CFA]2 [FAc]d/e/ [Acf]2', '[Gce]2 (c/e/g/c\'/ e\'/c\'/g/e/)',
            '[FAd]2 [Adf]g [dfa]2', '[dfb]2 [dfa]g [Bdf]2', '[Bdg]2 [dgb]2 [gbd\']2', '[^cea^c\']2 (^c/e/a/^c\'/) [^cea]2',
            '!ff! [Bdf]2 [dfb]2 [fbd\']2', '[^cea]2 [ea^c\']2 [a^c\'e\']2', '[fad\'f\']6', '(f\'/d\'/a/f/ d/A/F/D/) z2',
          ],
          lh: [
            'D,,A,, F,A, DA,', 'B,,F, DF, B,F,', 'F,,C, F,A, CA,', 'C,,G,, E,G, CG,',
            '[D,,D,]2 [F,A,D]2 [F,A,D]2', '[B,,,B,,]2 [F,B,D]2 [F,B,D]2', '[G,,,G,,]2 [G,B,D]2 [G,B,D]2', '[A,,,A,,]2 [E,G,^C]2 [E,G,^C]2',
            'B,,,F,, B,,D, F,B,', 'A,,,E,, A,,^C, E,G,', 'D,,,A,,, D,,A,, D,F,', '[D,,A,,D,]6',
          ],
          chords: ['Dm', 'Bb', 'F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Bb', 'A7', 'Dm', 'Dm'],
        },
        {
          name: 'The Echo After', key: 'Dm', bpm: 100,
          rh: [
            '!p! [ac\']c [fa]A [cf]F', '[eg]G [ce]E [Gc]C', '[Fd]D [Af]F [fa][ac\']', '[dfb]2 (a/b/a/g/) [df]2',
            '!mp! [Bdg]2 [da]2 [dgb]2', '[^cea]2 [^ceg]f [A^ce]2', '!p! [FAd]2 (d/f/a/d\'/ f\'/d\'/a/f/)', '!pp! [FAd]6',
          ],
          lh: [
            'F,,C, A,C, A,C,', 'C,,G,, E,G,, E,G,,', 'D,,A,, F,A,, F,A,,', 'B,,F, DF, DF,',
            'G,,2 [D,G,B,]2 B,,2', 'A,,2 [E,A,^C]2 [E,G,^C]2', 'D,,A,, F,A, DA,', 'D,,2 A,,2 D,2',
          ],
          chords: ['F', 'C', 'Dm', 'Bb', 'Gm', 'A', 'Dm', 'Dm'],
        },
        {
          name: 'The Surface', key: 'Dm', bpm: 92,
          rh: [
            '!pp! [Bd]4 d_e', 'd2 [Bg]4', '[db]2 [ca]2 [Bg]2', '[Af]4 d_e',
            '[Bd]4 [Bd]2', '[Bg]4 [B_e]2', '[A^c]6', '[FAd]6',
            '[FA]2 [Fd]e [Af]2', '[Ad]2 [df]2 [fa]2', '[ad\']2 [d\'f\']4', '[GBd]6',
            '!fermata![DFAd]6',
          ],
          lh: [
            'D,,2 [G,B,]2 [G,B,]2', 'D,,2 [G,B,]2 [G,B,]2', 'D,,2 [G,B,]2 [G,B,]2', 'D,,2 [F,A,]2 [F,A,]2',
            'D,,2 [G,B,]2 [G,B,]2', '_E,,2 [G,B,]2 [G,B,]2', 'A,,2 [E,G,]2 [E,G,]2', 'D,,2 [F,A,]2 [F,A,]2',
            'D,,2 [F,A,]2 [F,A,]2', 'D,,2 [F,A,]2 [F,A,]2', 'D,,2 [F,A,]4', 'D,,2 [G,B,]4',
            '[D,,A,,D,]6',
          ],
          chords: ['Gm/D', 'Gm/D', 'Gm/D', 'Dm', 'Gm/D', 'Eb', 'A7', 'Dm', 'Dm', 'Dm', 'Dm', 'Gm/D', 'Dm'],
        },
      ],
    },
  },
  // Forest Village/The Walk to the Oak: 7 parts
  'long:bg-meadow': {
    name: 'Forest Village/The Walk to the Oak',
    map: 'bg-meadow',
    story: 'A long piece in seven parts: wake with the birds, dance the village tune, walk the path to the Great Oak and hear its old song, then dance home under the fireflies.',
    levels: {
      easy: [
        {
          name: 'Before Sunrise', meter: '4/4', key: 'C', bpm: 66,
          marks: { 0: 'with pedal', 6: 'growing, like the light' },
          rh: [
            '!pp! z8', 'f3 a d\'3 c\'', 'b3 a g4', '!p! z4 .e.g c\'2',
            'z4 .E.G c2', '.e.g c\'2 .E.G c2', '!mp! .E.G c2 .e.g c\'2', '.B.d g2 .b d\'3',
          ],
          lh: [
            'C,2 E,2 G,2 E,2', 'D,2 F,2 A,2 F,2', 'C,2 E,2 G,2 E,2', 'A,,2 C,2 E,2 C,2',
            'F,,2 A,,2 C,2 A,,2', 'C,2 E,2 G,2 E,2', 'G,,2 C,2 E,2 C,2', 'G,,2 B,,2 D,4',
          ],
          chords: ['C', 'Dm', 'C', 'Am', 'F', 'C', 'C/G', 'G'],
        },
        {
          name: 'Forest Village', meter: '4/4', key: 'C', bpm: 132,
          rh: [
            '!mf! e2 g2 c\'2 b a', 'g2 e c A2 ce', 'f2 a2 c\'2 a f', 'g4 d ef d',
            'e2 g2 c\'2 d\' e\'', 'd\'2 b2 g2 e g', 'ag fa c\'2 a2', 'b2 d\'2 g2 z2',
            'a2 z ac\' a f2', 'b2 z bd\' b g2', 'g2 b2 e\'2 d\' b', 'c\'4 a2 e2',
            'fa c\'a fa c\'f\'', 'gb d\'b gb d\'g\'', 'e\'2 d\'2 c\'2 g2', 'c\'4 z4',
          ],
          lh: [
            'C,4 G,4', 'A,,4 E,4', 'F,,4 C,4', 'G,,4 D,4',
            'C,4 G,4', 'E,4 B,4', 'F,,4 C,4', 'G,,4 D,4',
            'D,4 A,4', 'G,,4 D,4', 'E,4 B,4', 'A,,4 E,4',
            'F,,4 C,4', 'G,,4 D,4', 'C,4 G,4', 'C,8',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
        },
        {
          name: 'The Path into the Woods', meter: '4/4', key: 'C', bpm: 132, bpmTo: 81,
          marks: { 0: 'slowing little by little' },
          rh: [
            '!mf! e2 z e ge c2', 'd2 z d gd B2', '!mp! c2 z c e2 A2', 'B4 d2 B2',
            '!p! A4 "Fm"_A4', 'G8',
          ],
          lh: [
            'C,4 G,4', 'B,,4 G,4', 'A,,4 E,4', 'G,,4 D,4',
            'F,,4 C,4', 'E,,4 B,,4',
          ],
          chords: ['C', 'G/B', 'Am', 'G', 'F', 'Em'],
        },
        {
          name: 'The Great Oak', meter: '6/8', key: 'Ddor', bpm: 54,
          rh: [
            '!p! F2A d2c', 'B3 A2G', 'F2A c2F', 'G6',
            'F2A d2c', 'B3 A2G', 'G2A c2A', 'd6',
            '!mp! A2c f2e', 'd3 c2B', 'B2d g2f', 'e3 d2c',
            '!p! F2A d2c', 'B3 A2G', 'G2A c2A', 'd6',
          ],
          lh: [
            'D,F,A, F,D,F,', 'G,,B,,D, B,,G,,B,,', 'F,,A,,C, A,,F,,A,,', 'C,E,G, E,C,E,',
            'D,3 [F,A,]3', 'G,,3 [B,,D,]3', 'C,3 [E,G,]3', 'D,3 [F,A,]3',
            'F,,A,,C, A,,F,,A,,', 'C,E,G, E,C,E,', 'G,,B,,D, B,,G,,B,,', 'C,E,G, E,C,E,',
            'D,F,A, F,D,F,', 'G,,B,,D, B,,G,,B,,', 'C,E,G, E,C,E,', 'D,3 [^F,A,]3',
          ],
          chords: ['Dm', 'G', 'F', 'C', 'Dm', 'G', 'C', 'Dm', 'F', 'C', 'G', 'C', 'Dm', 'G', 'C', 'D'],
        },
        {
          name: 'Fireflies', meter: '4/4', key: 'C', bpm: 81, bpmTo: 132,
          marks: { 0: 'getting faster little by little' },
          rh: [
            '!pp! z4 .g z z2', 'z .f z2 .g z .d\' z', '!p! c\'ge\'g c\'ge\'g', 'd\'af\'a d\'af\'a',
            '!mp! e\'c\'g\'c\' e\'2 d\'c\'', 'bgd\'g b2 c\'d\'', '!mf! c\'af\'a c\'af\'a', 'd\'bg\'b d\'bg\'b',
          ],
          lh: [
            'G,,2 D,2 G,4', 'G,,2 D,2 F,4', 'C,2 [E,G,]6', 'D,2 [F,A,]6',
            'C,2 [E,G,]6', 'G,,2 [B,,D,]6', 'F,,2 C,2 F,,2 C,2', 'G,,2 D,2 G,,2 A,,B,,',
          ],
          chords: ['G', 'G7', 'C', 'Dm', 'C', 'G', 'F', 'G7'],
        },
        {
          name: 'Dance of the Lights', meter: '4/4', key: 'C', bpm: 132,
          marks: { 8: 'the tune is in the left hand', 12: 'growing' },
          rh: [
            '!f! e2 g2 c\'2 b a', 'g2 e c A2 ce', 'f2 a2 c\'2 a f', 'g4 d ef d',
            'e2 g2 c\'2 d\' e\'', 'd\'2 b2 g2 e g', 'ag fa c\'2 a2', 'b2 d\'2 g2 z2',
            '!mf! d\'af\'a d\'af\'a', 'bgd\'g bgd\'g', '!f! g2 b2 e\'2 d\' b', 'c\'4 a2 e2',
            'fa c\'a fa c\'f\'', 'gb d\'b gb d\'g\'', '!ff! e\'2 d\'2 c\'2 g2', 'f2 g2 b2 d\'2',
            'e\'2 d\'2 c\'2 g2', 'c\'4 c2 z2',
          ],
          lh: [
            'C,2 G,2 C,2 G,2', 'A,,2 E,2 A,,2 E,2', 'F,,2 C,2 F,,2 C,2', 'G,,2 D,2 G,,4',
            'C,2 G,2 C,2 G,2', 'E,2 B,2 E,2 B,2', 'F,,2 C,2 F,,2 C,2', 'G,,2 D,2 G,,2 z2',
            'A,2 z A, CA, F,2', 'B,2 z B, DB, G,2', 'E,2 B,2 E,2 B,2', 'A,,2 E,2 A,,2 G,,2',
            'F,,2 A,,2 C,2 A,,2', 'G,,2 B,,2 D,2 B,,2', 'G,,2 E,2 G,,2 E,2', 'G,,2 D,2 A,,2 B,,2',
            'C,2 G,2 C,2 G,,2', 'C,4 C,,2 z2',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'C/G', 'G7', 'C', 'C'],
        },
        {
          name: 'Home by Starlight', meter: '4/4', key: 'C', bpm: 132, bpmTo: 66, rampBars: 5,
          marks: { 0: 'slowing little by little', 4: 'slow, with pedal' },
          rh: [
            '!mf! a2 z a c\'a f2', 'g2 z g bg e2', '!mp! f2 z f af d2', 'd2 z d f2 B2',
            '!p! e2 z e ge z2', 'F3 A d3 c', 'B3 A G4', 'e2 g2 c\'4',
            '!pp! z2 [ce]6', 'z2 [Bd]6', 'z2 [Gc]6', 'z2 !arpeggio![c\'g\'c\'\']6',
          ],
          lh: [
            'F,2 C2 F,2 C2', 'E,2 B,2 E,2 B,2', 'D,2 A,2 D,2 A,2', 'G,,2 D,2 F,2 D,2',
            'C,2 E,2 G,2 E,2', 'D,2 F,2 A,2 F,2', 'C,2 E,2 G,2 E,2', 'A,,2 C,2 E,2 C,2',
            'E,,8', 'G,,8', 'C,8-', 'C,8',
          ],
          chords: ['F', 'Em', 'Dm', 'G7', 'C', 'Dm', 'C', 'Am', 'C/E', 'G7', 'C', 'C'],
        },
      ],
      medium: [
        {
          name: 'Before Sunrise', meter: '4/4', key: 'C', bpm: 66,
          marks: { 0: 'with pedal', 7: 'growing, like the light' },
          rh: [
            '!pp! z8', 'f3 a d\'3 c\'', 'b3 a g4', '!p! z4 .e.g c\'2',
            'z4 .E.G c2', '.e.g c\'2 .E.G c2', '.f.a d\'2 .F.A d2', '!mp! .E.G.c .e.g.c\' z2',
            '.B.d.g .b d\'4',
          ],
          lh: [
            '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[C,A,]2 [A,D]2 [DF]2 [A,D]2', '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[A,,E,]2 [E,A,]2 [A,C]2 [E,A,]2',
            '[F,,C,]2 [C,F,]2 [F,A,]2 [C,F,]2', '[E,,C,]2 [C,G,]2 [G,C]2 [C,G,]2', '[D,,A,,]2 [A,,F,]2 [F,C]2 [A,,F,]2', '[G,,E,]2 [E,G,]2 [G,C]2 [E,G,]2',
            '[G,,D,]2 [D,G,]2 [F,B,D]4',
          ],
          chords: ['C', 'Dm/C', 'C', 'Am', 'F', 'C/E', 'Dm7', 'C/G', 'G7'],
        },
        {
          name: 'Forest Village', meter: '4/4', key: 'C', bpm: 132,
          rh: [
            '!mf! [CE]2 [EG]2 [EGc]2 BA', '[EG]2 EC A,2 CE', '[CF]2 [FA]2 [FAc]2 AF', '[B,DG]4 (DEFD)',
            '[CE]2 [EG]2 [Gc]2 [Gd][Ge]', '[Bd]2 [GB]2 [EG]2 EG', '[FA]G FA [FAc]2 [CFA]2', '[GB]2 [Bd]2 [B,DG]2 z2',
            '!mp! [FA]2 z[FA] [Ac][FA] [DF]2', '[GB]2 z[GB] [Bd][GB] [DG]2', '!mf! [EG]2 [GB]2 [GBe]2 [Bd][GB]', '[EAc]4 [CA]2 [CE]2',
            '!f! [CF]A cA [CF]A c[Ff]', '[DG]B dB [DG]B d[Gg]', '[Gce]2 [Gd]2 [EGc]2 [CEG]2', '[EGc]4 [CEGc]2 z2',
          ],
          lh: [
            'C,G,E,G, C,G,E,G,', 'A,,E,C,E, A,,C,E,C,', 'F,,A,,C,A,, F,,A,,C,A,,', 'G,,D,B,,D, G,,D,B,,D,',
            'C,,G,,C,G,, C,,G,,C,G,,', 'E,,B,,E,B,, E,,B,,E,B,,', 'F,,C,F,C, F,,C,F,C,', 'G,,D,G,D, G,,B,,A,,G,,',
            'D,,A,,D,F, A,,D,F,D,', 'G,,B,,D,G, B,,D,G,D,', 'E,,G,,B,,E, B,,G,,E,,G,,', 'A,,C,E,A, E,C,A,,C,',
            '[F,,F,]2 C,F, A,,F,C,F,', '[G,,G,]2 D,G, B,,G,D,G,', 'C,G,E,G, C,G,E,G,', 'C,G,E,G, [C,,C,]2 z2',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
        },
        {
          name: 'The Path into the Woods', meter: '4/4', key: 'C', bpm: 132, bpmTo: 81,
          marks: { 0: 'slowing little by little' },
          rh: [
            '!mf! [ce]2 z[ce] [eg][ce] [Gc]2', '[Bd]2 z[Bd] [dg][Bd] [GB]2', '!mp! [Ac]2 z[Ac] [ce]2 [EA]2', '[GB]4 [Bd]2 [GB]2',
            '!p! [FA]4 "Fm"[F_A]4', '[EG]8',
          ],
          lh: [
            'C,2 [E,G,]2 C,2 [E,G,]2', 'B,,2 [D,G,]2 B,,2 [D,G,]2', 'A,,2 [E,A,]2 A,,2 [E,A,]2', 'G,,D,G,D, G,,D,G,D,',
            'F,,C,F,C, F,,C,F,C,', 'E,,B,,D,B,, E,,B,,D,B,,',
          ],
          chords: ['C', 'G/B', 'Am', 'G', 'F', 'Em7'],
        },
        {
          name: 'The Great Oak', meter: '6/8', key: 'Ddor', bpm: 54,
          rh: [
            '!p! F2A d2c', '[GB]3 A2G', 'F3/2G/2A c2F', '[EG]6',
            '[DF]2A [Fd]2c', '[GB]3 [FA]2G', '[EG]2A [Ec]2A', '[FAd]6',
            '!mp! [FA]2c [Af]2e', '[Gd]3 [Ec]2B', '[DB]2d [Bg]2f', '[Ge]3 [Fd]2c',
            '!p! [DF]2A [Fd]2c', '[GB]3 [FA]2G', '[EG]2A [Ec]2A', '[^FAd]6',
          ],
          lh: [
            'D,F,A, DA,F,', 'G,,B,,D, G,D,B,,', 'F,,A,,C, F,C,A,,', 'C,E,G, CG,E,',
            'D,3 [F,A,D]3', 'G,,3 [G,B,D]3', 'C,3 [E,G,C]3', 'D,3 [F,A,D]3',
            'F,,A,,C, F,C,A,,', 'E,,G,,C, E,C,G,,', 'G,,B,,D, G,D,B,,', 'C,E,G, CG,E,',
            'D,F,A, DA,F,', 'G,,B,,D, G,D,B,,', 'C,E,G, CG,E,', 'D,^F,A, D3',
          ],
          chords: ['Dm', 'G', 'F', 'C', 'Dm', 'G', 'C', 'Dm', 'F', 'C/E', 'G', 'C', 'Dm', 'G', 'C', 'D'],
        },
        {
          name: 'Fireflies', meter: '4/4', key: 'C', bpm: 81, bpmTo: 132,
          marks: { 0: 'getting faster little by little' },
          rh: [
            '!pp! z4 .g z z2', 'z .f z2 .g z .d\' z', 'c\'ge\'g c\'ge\'g', 'd\'af\'a d\'af\'a',
            '!p! e\'c\'g\'c\' e\'2 d\'c\'', 'bgd\'g b2 c\'d\'', '!mp! [ec\']ge\'g [ec\']ge\'g', '[fd\']af\'a [fd\']af\'a',
            '!mf! [fc\']af\'a [fc\']af\'a', '[gd\']bg\'b [fd\']bg\'b',
          ],
          lh: [
            'G,,2 D,2 [G,C]4', 'G,,2 D,2 [F,B,]4', 'C,2 [G,CE]6', 'D,2 [A,DF]6',
            'E,2 [G,CE]6', 'G,,2 [G,B,D]4 [G,B,F]2', 'C,2 [E,G,C]2 G,,2 [E,G,C]2', 'D,2 [F,A,D]2 A,,2 [F,A,D]2',
            'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'G,,2 [D,F,B,]2 G,,2 A,,B,,',
          ],
          chords: ['Gsus4', 'G7', 'C', 'Dm', 'C/E', 'G', 'C', 'Dm', 'F', 'G7'],
        },
        {
          name: 'Dance of the Lights', meter: '4/4', key: 'C', bpm: 132,
          marks: { 8: 'the tune is in the left hand', 12: 'growing' },
          rh: [
            '!f! [ce]2 [eg]2 [egc\']2 ba', '[eg]2 ec A2 ce', '[cf]2 [fa]2 [fac\']2 af', '[Bdg]4 (defd)',
            '[ce]2 [eg]2 [gc\']2 [gd\'][ge\']', '[bd\']2 [gb]2 [eg]2 eg', '[fa]g fa [fac\']2 [cfa]2', '[gb]2 [bd\']2 [Bdg]2 bc\'',
            '!mf! d\'af\'a d\'af\'a', 'bgd\'g bgd\'g', '!f! [eg]2 [gb]2 [gbe\']2 [bd\'][gb]', '[eac\']4 [ca]2 [ce]2',
            '[CF]A cA [CF]A c[Ff]', '[DG]B dB [DG]B d[Gg]', '[EA]c ec [EA]c e[Aa]', '[Ac]f af [Ac]f a[cc\']',
            '!ff! [gc\'e\']2 [gd\']2 [egc\']2 [ceg]2', '[Bdf]2 [dfg]2 [fgb]2 [gbd\']2', '[gc\'e\']2 [gd\']2 [egc\']2 [ceg]2', '[egc\']2 [ceg]2 [EGc]2 z2',
          ],
          lh: [
            'C,2 [E,G,C]2 G,,2 [E,G,C]2', 'A,,2 [E,A,C]2 E,,2 [E,A,C]2', 'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'G,,2 [G,B,D]2 G,,4',
            'C,2 [E,G,C]2 G,,2 [E,G,C]2', 'E,2 [G,B,E]2 B,,2 [G,B,E]2', 'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'G,,2 [G,B,D]2 G,,2 F,,E,,',
            '[D,A,]2 z[F,A,] [A,C][F,A,] [D,F,]2', '[D,G,B,]2 z[G,B,] [B,D][G,B,] [D,G,]2', 'E,2 [G,B,E]2 B,,2 [G,B,E]2', 'A,,2 [A,CE]2 A,,2 G,,2',
            '[F,,F,]2 C,F, A,,F,C,F,', '[G,,G,]2 D,G, B,,G,D,G,', '[A,,A,]2 E,A, C,A,E,A,', '[F,,F,]2 C,F, A,,F,C,F,',
            'G,,2 [E,G,C]2 G,,2 [E,G,C]2', 'G,,2 [D,F,B,]2 A,,2 B,,2', 'C,2 [E,G,C]2 E,2 G,2', '[C,,C,]2 G,,2 [C,,C,]2 z2',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G/D', 'Em', 'Am', 'F', 'G', 'Am', 'F', 'C/G', 'G7', 'C', 'C'],
        },
        {
          name: 'Home by Starlight', meter: '4/4', key: 'C', bpm: 132, bpmTo: 66, rampBars: 5,
          marks: { 0: 'slowing little by little', 4: 'slow, with pedal' },
          rh: [
            '!mf! [fa]2 z[fa] [ac\'][fa] [cf]2', '[eg]2 z[eg] [gb][eg] [Be]2', '!mp! [df]2 z[df] [fa][df] [Ad]2', '[Bd]2 z[Bd] [df]2 [GB]2',
            '!p! [ce]2 z[ce] [eg][ce] z2', 'F3 A d3 c', 'B3 A G4', 'e2 g2 c\'4',
            'E2 G2 c4', '!pp! z2 [Gce]6', 'z2 [FBd]6', 'z2 [EGc]6',
            'z2 !arpeggio![c\'g\'c\'\']6',
          ],
          lh: [
            'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'E,,2 [E,G,B,]2 B,,2 [E,G,B,]2', '[D,,A,,]2 [A,,F,]2 [F,C]2 [A,,F,]2', '[G,,D,]2 [D,G,]2 [F,B,]2 [D,G,]2',
            '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[C,A,]2 [A,D]2 [DF]2 [A,D]2', '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[A,,E,]2 [E,A,]2 [A,C]2 [E,A,]2',
            '[F,,C,]2 [C,F,]2 [F,A,]2 [C,F,]2', 'E,,8', 'G,,8', '[C,,C,]8-',
            '[C,,C,]8',
          ],
          chords: ['F', 'Em', 'Dm7', 'G7', 'C', 'Dm/C', 'C', 'Am', 'F', 'C/E', 'G7', 'C', 'C'],
        },
      ],
      hard: [
        {
          name: 'Before Sunrise', meter: '4/4', key: 'C', bpm: 66,
          marks: { 0: 'with pedal', 7: 'growing, like the light' },
          rh: [
            '!pp! z8', 'f3 a d\'3 c\'', 'b3 a g4', '!p! z4 .e.g c\'2',
            'z4 .E.G c2', '.e.g c\'2 .E.G c2', '.f.a d\'2 .F.A d2', '!mp! .E.G.c .e.g.c\' z2',
            '.B.d.g .b d\'4',
          ],
          lh: [
            '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[C,A,]2 [A,D]2 [DF]2 [A,D]2', '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[A,,E,]2 [E,A,]2 [A,C]2 [E,A,]2',
            '[F,,C,]2 [C,F,]2 [F,A,]2 [C,F,]2', '[E,,C,]2 [C,G,]2 [G,C]2 [C,G,]2', '[D,,A,,]2 [A,,F,]2 [F,C]2 [A,,F,]2', '[G,,E,]2 [E,G,]2 [G,C]2 [E,G,]2',
            '[G,,D,]2 [D,G,]2 [F,B,D]4',
          ],
          chords: ['C', 'Dm/C', 'C', 'Am', 'F', 'C/E', 'Dm7', 'C/G', 'G7'],
        },
        {
          name: 'Forest Village', meter: '4/4', key: 'C', bpm: 132,
          rh: [
            '!mf! [CE]2 [EG]A/B/ [EGc]2 [GB]A', '[EG]2 EC A,2 [A,C][CE]', '[CF]2 [FA]B [FAc]2 [FA]F', '[B,DG]4 ([B,D][CE][DF][B,D])',
            '[Ece]2 [Geg][cec\']- [cec\']2 [dd\'][ee\']', '[dgd\']2 [Beb]2 [GBg]2 [Ee][Gg]', '[ca]g [cf]a [cfc\']2 [Aca][Bdb]-', '[Bdb]2 [dgd\']2 [GBdg]2 (d/e/f/g/)',
            '!mp! [fa]2 z[fa] [ac\'][fa] f/d/A/d/', '[gb]2 z[gb] [bd\'][gb] g/d/B/d/', '!mf! [Beg]2 [egb]2 [gbe\']2 [gbd\'][egb]', '[eac\']2 (a/b/c\'/b/) [cea]2 [Ace]2',
            '!f! [A,CF]A [Fc]A FA [Fc][Acf]', '[DG]B [Gd]B GB [Gd][Bdg]', '[ege\']2 [dgd\']2 [cec\']2 [Gceg]2', '[cegc\']2 g/e/c/G/ [EGc]2 z2',
          ],
          lh: [
            '[C,,C,]2 [E,G,]G,, C,2 [E,G,]B,,', 'A,,2 [C,E,]E,, A,,2 [C,E,]G,,', '[F,,F,]2 [A,C]C, F,2 [A,C]D,', '[G,,G,]2 G,,/A,,/B,,/C,/ D,2 G,,2',
            'C,,G,,C,E, G,E,C,G,,', 'E,,B,,E,G, B,G,E,B,,', 'F,,C,F,A, CA,F,D,', 'G,,D,G,B, G,D,F,,2',
            'D,,A,,D,F, A,F,D,A,,', 'G,,D,G,B, DB,G,D,', 'E,,B,,E,G, B,G,E,B,,', 'A,,E,A,C EC A,G,',
            '[F,,F,]2 [A,,A,]2 [C,C]2 [A,,A,]2', '[G,,G,]2 [B,,B,]2 [D,D]2 [B,,B,]2', '[C,,G,,C,]3 [E,,E,]- [E,,E,]2 [G,,G,]2', '[C,,C,]2 G,,2 [C,,G,,C,]2 z2',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'],
        },
        {
          name: 'The Path into the Woods', meter: '4/4', key: 'C', bpm: 132, bpmTo: 81,
          marks: { 0: 'slowing little by little' },
          rh: [
            '!mf! [ce]2 z[ce] [eg][ce] [Gc]2', '[Bd]2 z[Bd] [dg][Bd] [GB]2', '!mp! [Ac]2 z[Ac] [ce]2 [EA]2', '[GB]4 [Bd]2 [GB]2',
            '!p! [FA]4 "Fm"[F_A]4', '[EG]8',
          ],
          lh: [
            'C,2 [E,G,C]2 C,2 [E,G,C]2', 'B,,2 [D,G,B,]2 B,,2 [D,G,B,]2', 'A,,2 [E,A,C]2 A,,2 [E,A,C]2', 'G,,D,G,B, G,D,G,D,',
            'F,,C,F,A, F,,C,F,_A,', 'E,,B,,D,G, B,G,D,B,,',
          ],
          chords: ['C', 'G/B', 'Am', 'G', 'F', 'Em7'],
        },
        {
          name: 'The Great Oak', meter: '6/8', key: 'Ddor', bpm: 54,
          rh: [
            '!p! F2A d2c', '[GB]3 A2G', 'F3/2G/2A c2F', '[EG]6',
            '[DF]2[FA] [Fd]2[Ec]', '[GB]3 [FA]2[EG]', '[EG]2[FA] [Ec]2[FA]', '[FAd]6',
            '!mp! [FA]2[Ac] [Af]2[Ge]', '[Gd]3 [Ec]2[DB]', '[DB]2[Gd] [Bg]2[Af]', '[Ge]3 [Fd]2[Ec]',
            '!p! [DF]2[FA] [Fd]2[Ec]', '[GB]3 [FA]2[EG]', '[EG]2[FA] [Ec]2[FA]', '[^FAd]6',
          ],
          lh: [
            'D,,A,,F, A,F,A,,', 'G,,D,G, B,G,D,', 'F,,C,F, A,F,C,', 'C,E,G, CG,E,',
            'D,,3 [F,A,D]3', 'G,,3 [G,B,D]3', 'C,3 [E,G,C]3', 'D,3 [F,A,D]3',
            'F,,C,A, CA,C,', 'E,,C,G, CG,C,', 'G,,D,G, B,G,D,', 'C,E,G, CG,E,',
            'D,,A,,F, A,F,A,,', 'G,,D,G, B,G,D,', 'C,E,G, CG,C,', 'D,,A,,^F, A,3',
          ],
          chords: ['Dm', 'G', 'F', 'C', 'Dm', 'G', 'C', 'Dm', 'F', 'C/E', 'G', 'C', 'Dm', 'G', 'C', 'D'],
        },
        {
          name: 'Fireflies', meter: '4/4', key: 'C', bpm: 81, bpmTo: 132,
          marks: { 0: 'getting faster little by little' },
          rh: [
            '!pp! z4 .g z z2', 'z .f z2 .g z .d\' z', 'c\'ge\'g c\'ge\'g', 'd\'af\'a d\'af\'a',
            '!p! e\'c\'g\'c\' e\'2 d\'c\'', 'bgd\'g b2 c\'d\'', '!mp! [ec\']g[c\'e\']g [ec\']g[c\'e\']g', '[fd\']a[d\'f\']a [fd\']a[d\'f\']a',
            '!mf! [fc\']a[c\'f\']a [fc\']a[c\'f\']a', '[gd\']b[d\'g\']b [fd\']b[d\'g\']b',
          ],
          lh: [
            'G,,2 D,2 [G,C]4', 'G,,2 D,2 [F,B,]4', 'C,2 [G,CE]6', 'D,2 [A,DF]6',
            'E,2 [G,CE]6', 'G,,2 [G,B,D]4 [G,B,F]2', 'C,2 [E,G,C]2 G,,2 [E,G,C]2', 'D,2 [F,A,D]2 A,,2 [F,A,D]2',
            'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'G,,2 [D,F,B,]2 [G,,G,]2 [A,,A,][B,,B,]',
          ],
          chords: ['Gsus4', 'G7', 'C', 'Dm', 'C/E', 'G', 'C', 'Dm', 'F', 'G7'],
        },
        {
          name: 'Dance of the Lights', meter: '4/4', key: 'C', bpm: 132,
          marks: { 8: 'the tune is in the left hand', 12: 'growing' },
          rh: [
            '!f! [EGce]2 [Gceg]2 [cegc\']2 [Bb][Aa]', '[Gceg]2 [Ee][Cc] [EA]2 [Cc][Ee]', '[FAcf]2 [Acfa]2 [cfac\']2 [Aa][Ff]', '[GBdg]4 ([Dd][Ee][Ff][Dd])',
            '[Ece]2 [Geg][cec\']- [cec\']2 [dd\'][ee\']', '[dgd\']2 [Beb]2 [GBg]2 [Ee][Gg]', '[ca]g [cf]a [cfc\']2 [Aca][Bdb]-', '[Bdb]2 [dgd\']2 [GBdg]2 (g/a/b/c\'/)',
            '!mf! d\'af\'a d\'af\'a', 'bgd\'g bgd\'g', '!f! [Beg]2 [egb]2 [gbe\']2 [gbd\'][egb]', '[eac\']2 (a/b/c\'/b/) [cea]2 [Ace]2',
            '[A,CF]A [Fc]A FA [Fc][Acf]', '[DG]B [Gd]B GB [Gd][Bdg]', '[EA]c [Ae]c Ac [Ae][cea]', '[Ac]f [ca]f cf [ca][fac\']',
            '!ff! [ege\']2 [dgd\']2 [cec\']2 [Gceg]2', '[GBdf]2 [Bdfg]2 [dfgb]2 [fgbd\']2', '[egc\'e\']2 [dgbd\']2 [cegc\']2 [Gceg]2', '[cegc\']2 g/e/c/G/ [EGc]2 z2',
          ],
          lh: [
            '[C,,C,]2 [E,G,C]2 [G,,G,]2 [E,G,C]2', '[A,,,A,,]2 [E,A,]2 [E,,E,]2 [E,A,]2', '[F,,F,]2 [F,A,C]2 [C,,C,]2 [F,A,C]2', '[G,,G,]2 [G,B,D]2 [G,,G,]4',
            '[C,,C,]2 [E,G,C]2 [G,,G,]2 [E,G,C]2', '[E,,E,]2 [E,G,B,]2 [B,,B,]2 [E,G,B,]2', '[F,,F,]2 [F,A,C]2 [C,,C,]2 [F,A,C]2', '[G,,G,]2 [G,B,D]2 [G,,G,]2 [F,,F,][E,,E,]',
            '[D,A,]2 z[F,A,] [A,C][F,A,] [D,F,]2', '[D,G,B,]2 z[G,B,] [B,D][G,B,] [D,G,]2', '[E,,E,]2 [G,B,E]2 [B,,B,]2 [G,B,E]2', '[A,,A,]2 [A,CE]2 [A,,A,]2 [G,,G,]2',
            '[F,,F,]2 [A,,A,]2 [C,C]2 [A,,A,]2', '[G,,G,]2 [B,,B,]2 [D,D]2 [B,,B,]2', '[A,,A,]2 [C,C]2 [E,E]2 [C,C]2', '[F,,F,]2 [A,,A,]2 [C,C]2 [A,,A,]2',
            '[G,,,G,,]2 [E,G,C]2 [G,,,G,,]2 [E,G,C]2', '[G,,,G,,]2 [D,F,B,]2 [A,,,A,,]2 [B,,,B,,]2', '[C,,C,]2 [E,G,C]2 [E,,E,]2 [G,,G,]2', '[C,,C,]2 G,,2 [C,,G,,C,]2 z2',
          ],
          chords: ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'Dm', 'G/D', 'Em', 'Am', 'F', 'G', 'Am', 'F', 'C/G', 'G7', 'C', 'C'],
        },
        {
          name: 'Home by Starlight', meter: '4/4', key: 'C', bpm: 132, bpmTo: 66, rampBars: 5,
          marks: { 0: 'slowing little by little', 4: 'slow, with pedal' },
          rh: [
            '!mf! [fa]2 z[fa] [ac\'][fa] f/c/A/c/', '[eg]2 z[eg] [gb][eg] e/B/G/B/', '!mp! [df]2 z[df] [fa][df] [Ad]2', '[Bd]2 z[Bd] [df]2 [GB]2',
            '!p! [ce]2 z[ce] [eg][ce] z2', 'F3 A d3 c', 'B3 A G4', 'e2 g2 c\'4',
            'E2 G2 c4', '!pp! z2 [Gce]6', 'z2 [FBd]6', 'z2 [EGc]6',
            'z2 !arpeggio![c\'g\'c\'\']6',
          ],
          lh: [
            'F,,2 [F,A,C]2 C,2 [F,A,C]2', 'E,,2 [E,G,B,]2 B,,2 [E,G,B,]2', '[D,,A,,]2 [A,,F,]2 [F,C]2 [A,,F,]2', '[G,,D,]2 [D,G,]2 [F,B,]2 [D,G,]2',
            '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[C,A,]2 [A,D]2 [DF]2 [A,D]2', '[C,G,]2 [G,C]2 [CE]2 [G,C]2', '[A,,E,]2 [E,A,]2 [A,C]2 [E,A,]2',
            '[F,,C,]2 [C,F,]2 [F,A,]2 [C,F,]2', 'E,,8', 'G,,8', '[C,,C,]8-',
            '[C,,C,]8',
          ],
          chords: ['F', 'Em', 'Dm7', 'G7', 'C', 'Dm/C', 'C', 'Am', 'F', 'C/E', 'G7', 'C', 'C'],
        },
      ],
    },
  },
};
