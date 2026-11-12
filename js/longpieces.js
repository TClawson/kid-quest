// The songbook's concert pieces: long pieces in several parts, each part with its own key and
// speed (read by concert.js, shown in the songbook by songbook.js). Made by a script from the
// finished music files: don't edit by hand, run the script again.
//
// Keyed by piece id ('long:' and the map the piece comes from). Each piece has name, map (the
// background id of the map whose song it grows from), story (one line for the piece's page)
// and levels: { easy, medium, hard }, only the ones written so far. A level is a list of
// sections, played in order: { name (shown over its first bar), key ('Dm', 'Fm', 'Gm': its key
// signature), bpm (quarter notes a minute), rh, lh (one string per bar), chords (one chord name
// per bar, shown above it: 'Gm/D', 'Cm6', 'A7') }. A section's key and bars can differ between
// levels; the sections are the same.
//
// The bars are 3/4 all through, in the same ABC notation as arrangements.js (read by
// arrange.js): L:1/8 (an eighth note is 1, six to a bar), notes 'c' (C5), 'C' (C4), 'C,' (C3),
// "c'" (C6), '^' sharp, '_' flat, '=' natural over the section's key signature; lengths '2'
// quarter, '3' dotted quarter, '4' half, '6' dotted half, '/2' sixteenth; chords '[CEG]2';
// rests 'z2'; ties 'c2-' (also into the next bar); slurs '( )'; dynamics '!pp!' '!p!' '!mp!'
// '!mf!' '!f!' '!ff!' at the start of a right-hand bar (each lasts till the next, across
// sections). Also:
//   '&'          a second voice in the same hand: it counts again from the start of the bar
//                ('d4 de & B2 A2 B2'); each voice fills the bar, and accidentals are written
//                in each voice.
//   'x'          a rest that isn't printed (a voice waiting: 'x2 [D,G,]2 [D,G,]2 & G,,6').
//   '!fermata!'  hold this bar: it lasts 1.7 times as long.

export const LONG_PIECES = {
  // Bubble Waltz: The Dive: 8 parts
  'long:bg-ocean': {
    name: 'Bubble Waltz: The Dive',
    map: 'bg-ocean',
    story: 'A long piece in eight parts: float on the waves, dance the Bubble Waltz, sink to the mermaid\'s grotto and hear her lullaby, then swim back up.',
    levels: {
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
};
