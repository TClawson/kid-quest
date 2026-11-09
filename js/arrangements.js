// Medium and hard piano versions of the songbook's pieces (the easy version is the song
// itself, written out by sheetmusic.js). Keyed by piece id ('bg-meadow' for a map song,
// 'show:bg-meadow' for a show's tune); each version has rh (right hand) and lh (left hand):
// one string per bar, in the song's key and time, read by arrange.js. Each bar is ABC
// notation with L:1/8 (an eighth note is 1): notes 'c' (C5), 'C' (C4), 'C,' (C3), "c'" (C6),
// '^' sharp, '_' flat, '=' natural (the key signature is applied, and an accidental holds
// for the rest of the bar); lengths '2' quarter, '3' dotted quarter, '4' half, '6' dotted
// half, '8' whole, '/2' sixteenth, '3/2' dotted eighth; chords '[CEG]2'; rests 'z2'; ties
// 'c2-' (also into the next bar); slurs '( )'; dynamics '!p!' '!mf!' '!f!'; spaces break the
// beams. The song's chord names go above the right hand on their own.

export const ARRANGEMENTS = {
  // Star Whale Dream: slow and dreamy, F with a lift (the B naturals)
  'show:bg-galaxy': {
    medium: {
      rh: ['!p! [CF]4 A2 c2', '[D=B]4 G4', '[CA]4 c2 e2', '[=Bd]4 B4', 'c2 [Af]6'],
      lh: ['F,,2 C,2 A,2 C,2', 'G,,2 D,2 =B,2 D,2', 'F,,2 C,2 A,2 C,2', 'G,,2 D,2 =B,2 D,2', 'F,,2 C,2 [F,,C,]4'],
    },
    hard: {
      rh: ['!p! [Acf]4 [cfa]2 [fac\']2', '[dg=b]4 [=Bdg]4', '[cfa]4 [fac\']2 [ac\'e\']2', '[g=bd\']4 [dgb]4', '[fac\']2 [ac\'f\']6'],
      lh: ['F,,C,F,A, CA,F,C,', 'G,,D,G,=B, D=B,G,D,', 'F,,C,F,A, CA,F,C,', 'G,,D,G,=B, D=B,G,D,', 'F,,C,F,A, [F,,C,F,]4'],
    },
  },
};
