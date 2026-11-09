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
  // Moon Base, A minor
  'bg-space': {
    medium: {
      rh: [
        '!mp! A,4 [CE]4', '[A,F]2 E2 [A,C]4', '[CG]4 E2 C2', '[B,D]6 z2',
        '[EA]4 B2 [Ec]2', '[CA]4 [A,F]4', '[DG]2 B2 [Gd]4', '[GB]6 z2',
        '!mf! [Fc]2 B2 A2 F2', '[Bd]2 c2 B2 G2', '[Ae]4 c2 A2', 'B2 c2 [Ge]4',
        '[Af]2 e2 c2 A2', '[DG]2 B2 [Gd]4', '[E^G]4 [GB]4', '[^Ge]4 [Ae]4',
      ],
      lh: [
        'A,,4 E,4', 'F,,4 C,4', 'C,4 G,4', 'G,,4 D,4',
        'A,,2 E,2 A,2 E,2', 'F,,2 C,2 A,,2 C,2', 'G,,2 D,2 B,,2 D,2', 'E,,2 B,,2 G,,2 B,,2',
        'F,,2 A,,2 C,2 A,,2', 'G,,2 D,2 B,,2 D,2', 'A,,2 E,2 C,2 E,2', 'C,2 G,2 E,2 G,2',
        'F,,2 C,2 A,,2 C,2', 'G,,2 D,2 B,,2 D,2', 'E,,2 B,,2 ^G,,2 B,,2', '[E,,B,,E,]4 [A,,E,A,]4',
      ],
    },
    hard: {
      rh: [
        '!mp! A,3 C [A,CE]4', '[A,F]2 [CE]2 [A,C]3 E', '[EG]3 F [CE]2 C2', '[B,D]6 EG',
        '[CEA]4 [EB]2 [Ac]2', '[FA]3 G [A,F]4', '[B,G]2 [DB]2 [Bd]4', '[GB]6 AB',
        '!mf! [FAc]2 B2 [FA]2 [CF]2', '[Bd]2 c2 [GB]2 [DG]2', '[EAce]4 [Ec]2 [CA]2', '[EB]2 [Ec]2 [Gce]4',
        '!f! [FAcf]2 [Ee]2 [Cc]2 [A,A]2', '[B,G]2 [DB]2 [GBd]4', '[B,E^G]3 A [EGB]4', '[E^GBe]4 [EAce]4',
      ],
      lh: [
        'A,,E,C,E, A,,E,C,E,', 'F,,C,A,,C, F,,C,A,,C,', 'C,G,E,G, C,G,E,G,', 'G,,D,B,,D, G,F,E,D,',
        'A,,E,C,E, A,,E,A,E,', 'F,,C,F,C, A,,C,F,C,', 'G,,D,G,D, B,,D,G,D,', 'E,,B,,E,B,, G,,B,,E,B,,',
        'F,,C,F,C, A,,C,F,C,', 'G,,D,G,D, B,,D,G,D,', 'A,,E,A,E, A,,E,C,E,', 'C,G,E,G, C,G,E,G,',
        'F,,F,F,,F, F,,F,F,,F,', 'G,,G,G,,G, G,,G,G,,G,', 'E,,E,E,,E, E,,E,E,,E,', '[E,,B,,E,]4 [A,,E,A,]4',
      ],
    },
  },
  // Golden Stars, G major
  'bg-galaxy': {
    medium: {
      rh: [
        '!mp! E4 [EG]2 [Ec]2', 'F4 [FA]2 [Fd]2', '[Ge]4 d2 [Gc]2', '[Fd]6 z2',
        '[EB]4 G2 E2', '[B,F]4 D2 B,2', 'C2 E2 G2 [Gc]2', '[FA]6 z2',
        '!mf! G2 c2 [Ge]4', '[Af]4 d2 A2', 'B2 d2 [df]4', '[Ge]4 B2 G2',
        '!f! A2 c2 [ce]4', '[Ad]4 f2 a2', '[Bg]4 d2 B2', '!mp! [B,G]8',
      ],
      lh: [
        'C,2 G,2 C2 G,2', 'D,2 A,2 D2 A,2', 'C,2 G,2 C2 G,2', 'D,2 F,2 A,2 D2',
        'E,2 G,2 B,2 G,2', 'B,,2 F,2 B,,2 F,2', 'C,2 G,2 E,2 G,2', 'D,2 F,2 A,2 D2',
        'C,2 G,2 C2 G,2', 'D,2 A,2 F,2 A,2', 'B,,2 F,2 B,2 F,2', 'E,2 B,2 G,2 B,2',
        'A,,2 E,2 A,2 E,2', 'D,2 F,2 A,2 D,2', 'G,,2 D,2 G,2 D,2', 'G,,2 D,2 G,4',
      ],
    },
    hard: {
      rh: [
        '!mp! [CE]4 [EG]2 [EGc]2', '[DF]4 [FA]2 [FAd]2', '[Gce]4 [Gd]2 [EGc]2', '[FAd]6 (a/f/d/A/)',
        '[EGB]4 [EG]2 [B,E]2', '[B,DF]4 [B,D]2 B,2', 'C2 [CE]2 [CEG]2 [EGc]2', '[DFA]6 (d/c/B/A/)',
        '!mf! [EG]2 [Ec]2 [Gce]4', '[Adf]4 [Fd]2 [FA]2', '[DB]2 [Fd]2 [Bdf]4', '[GBe]4 [GB]2 [EG]2',
        '!f! [CA]2 [Ec]2 [Ace]4', '[DFAd]4 [Ff]2 [Aa]2', '[GBdg]4 [Dd]2 [B,B]2', '!mp! [B,DG]2 (Bd g4)',
      ],
      lh: [
        'C,,2 G,,2 C,2 G,,2', 'D,,2 A,,2 D,2 A,,2', 'C,,2 G,,2 C,2 G,,2', 'D,,2 A,,2 D,4',
        'E,,B,,E,B,, E,,B,,E,B,,', 'B,,F,B,,F, B,,F,B,,F,', 'C,,G,,C,G,, C,,G,,C,G,,', 'D,,A,,D,A,, D,,A,,D,A,,',
        'C,E,G,C G,E,C,E,', 'D,F,A,D A,F,D,F,', 'B,,D,F,B, F,D,B,,D,', 'E,G,B,G, E,G,B,G,',
        'A,,E,A,E, A,,E,A,E,', '[D,,D,]2 A,,D, A,,D,F,D,', '[G,,G,]2 D,G, B,,G,D,G,', 'G,,D,G,D, [G,,D,G,]4',
      ],
    },
  },
  // Forest Village, C major
  'bg-meadow': {
    medium: {
      rh: [
        '!mf! E2 G2 [Ec]2 BA', '[EG]2 EC A,2 CE', 'F2 A2 [Fc]2 AF', '[DG]4 DEFD',
        '[CE]2 G2 c2 de', 'd2 B2 [EG]2 EG', 'AG FA [Fc]2 A2', '[GB]2 d2 G2 z2',
        '!mp! [FA]2 zA cA F2', '[GB]2 zB dB G2', '!mf! G2 B2 [Be]2 dB', '[Ec]4 A2 E2',
        '!f! FAcA FAcf', 'GBdB GBdg', '[Ge]2 d2 c2 G2', '[Ec]8',
      ],
      lh: [
        'C,2 G,2 E,2 G,2', 'A,,2 E,2 C,2 E,2', 'F,,2 C,2 A,,2 C,2', 'G,,2 D,2 B,,2 D,2',
        'C,2 G,2 E,2 G,2', 'E,,2 G,,2 B,,2 G,,2', 'F,,2 C,2 A,,2 C,2', 'G,,2 D,2 B,,2 D,2',
        'D,,2 [F,,A,,]2 D,,2 [F,,A,,]2', 'G,,2 [B,,D,]2 G,,2 [B,,D,]2', 'E,,2 [G,,B,,]2 E,,2 [G,,B,,]2', 'A,,2 [C,E,]2 A,,2 [C,E,]2',
        'F,,2 A,,2 C,2 A,,2', 'G,,2 B,,2 D,2 B,,2', 'C,2 G,2 E,2 G,2', 'C,2 G,,2 [C,,C,]4',
      ],
    },
    hard: {
      rh: [
        '!mf! [CE]2 [EG]2 [EGc]2 BA', '[EG]2 EC A,2 CE', '[CF]2 [FA]2 [FAc]2 AF', '[B,DG]4 (DEFD)',
        '[CE]2 [EG]2 [Gc]2 [Gd][Ge]', '[Bd]2 [GB]2 [EG]2 EG', '[FA]G FA [FAc]2 [CFA]2', '[GB]2 [Bd]2 [B,DG]2 z2',
        '!mp! [FA]2 z[FA] [Ac][FA] [CF]2', '[GB]2 z[GB] [Bd][GB] [DG]2', '!mf! [EG]2 [GB]2 [GBe]2 [Bd][GB]', '[EAc]4 [CA]2 [CE]2',
        '!f! [CF]A cA [CF]A c[Ff]', '[DG]B dB [DG]B d[Gg]', '[Gce]2 [Gd]2 [EGc]2 [CEG]2', '[EGc]4 [CEGc]2 z2',
      ],
      lh: [
        'C,G,E,G, C,G,E,G,', 'A,,E,C,E, A,,C,E,C,', 'F,,A,,C,A,, F,,A,,C,A,,', 'G,,D,B,,D, G,,D,B,,D,',
        'C,,G,,C,G,, C,,G,,C,G,,', 'E,,B,,E,B,, E,,B,,E,B,,', 'F,,C,F,C, F,,C,F,C,', 'G,,D,G,D, G,,B,,A,,G,,',
        'D,,A,,D,F, A,,D,F,D,', 'G,,B,,D,G, B,,D,G,D,', 'E,,G,,B,,E, B,,G,,E,,G,,', 'A,,C,E,A, E,C,A,,C,',
        '[F,,F,]2 C,F, A,,F,C,F,', '[G,,G,]2 D,G, B,,G,D,G,', 'C,G,E,G, C,G,E,G,', 'C,G,E,G, [C,,C,]2 z2',
      ],
    },
  },
  // Bubble Waltz, D minor
  'bg-ocean': {
    medium: {
      rh: [
        '!p! (A2 d2 [Af]2', '[df]2 d2 B2', 'A2 c2 [Af]2', '[ce]4) z2',
        '(d2 f2 [fa]2', '[db]2 a2 f2', '!mf! g2 b2 [bd\']2', '[e^c\']4 a2)',
        '!mp! ([fc\']2 a2 f2', '[cg]2 e2 c2', 'd2 f2 ac\'', '[db]4 f2)',
        '!p! ([dg]2 a2 b2', '[^ca]2 g2 e2', '[Fd]4) z2', '[^ce]2 [Ac]2 !fermata![ce]2',
      ],
      lh: [
        'D,2 [F,A,]2 [F,A,]2', 'B,,2 [D,F,]2 [D,F,]2', 'F,2 [A,C]2 [A,C]2', 'C,2 E,2 G,2',
        'D,2 [F,A,]2 [F,A,]2', 'B,,2 [D,F,]2 [D,F,]2', 'G,,2 [B,,D,]2 [B,,D,]2', 'A,,2 ^C,2 E,2',
        'F,2 [A,C]2 [A,C]2', 'E,2 [G,C]2 [G,C]2', 'D,2 [F,A,]2 [F,A,]2', 'B,,2 D,2 F,2',
        'G,,2 [B,,D,]2 [B,,D,]2', 'A,,2 [^C,E,]2 [C,E,]2', 'D,2 F,2 A,2', '!fermata![A,,E,A,]6',
      ],
    },
    hard: {
      rh: [
        '!p! [FA]2 [Fd]2 [Af]2', '[df]2 [Bd]2 [DB]2', '[FA]2 [Fc]2 [Af]2', '[Gce]4 (g/2e/2c/2e/2)',
        '[Ad]3 f [fa]2', '[dfb]2 [fa]2 [df]2', '!mf! [Bdg]2 [dgb]2 [gbd\']2', '[^cea^c\']4 [cea]2',
        '!mp! [fac\']2 [ca]2 [Af]2', '[cg]2 [ce]2 [Ec]2', '[Fd]2 [Af]2 [fa]c\'', '[dfb]3 (a/2g/2 [df]2)',
        '!p! [Bg]3 [ca] [db]2', '[^ca]2 [eg]2 [ce]2', '[FAd]4 (A/2d/2f/2a/2)', '[^ce]2 [Ac]2 !fermata![EAce]2',
      ],
      lh: [
        'D,F, A,D A,F,', 'B,,D, F,B, F,D,', 'F,,C, F,A, F,C,', 'C,E, G,C G,E,',
        'D,F, A,D A,F,', 'B,,D, F,B, F,D,', 'G,,D, G,B, G,D,', 'A,,^C, E,A, E,C,',
        'F,A, CA, F,A,', 'E,G, CG, E,G,', 'D,A, DA, F,A,', 'B,,F, B,F, D,F,',
        'G,,D, G,D, B,,D,', 'A,,E, A,G, E,^C,', 'D,A, DA, F,A,', 'A,,E, A,E, !fermata![A,,E,A,]2',
      ],
    },
  },
  // Candy Skip, G major
  'bg-rainbow': {
    medium: {
      rh: [
        '!mf! DGBG .[Bd]2 .[GB]2', 'EGBG .[Be]2 .[GB]2', '[Gc]2 [ce]2 dcBA', '[DA]4 [DF]2 z2',
        'G2 B2 [Bd]2 [Bg]2', '[Ge]2 d2 [GB]2 G2', 'A2 c2 [Ae]2 c2', '[Fd]4 z4',
        '!mp! [Ge]d c2 G2 [Gc]2', '[Af]e d2 A2 [Ad]2', '[Bd]2 [FB]2 F2 B2', '[EG]4 E2 G2',
        '!f! c2 e2 [cg]2 [ce]2', '[Af]3 d A2 [DF]2', '!mf! [DG]2 B2 [Gd]2 [GB]2', '[B,G]6 z2',
      ],
      lh: [
        'G,,2 D,2 B,,2 D,2', 'E,,2 G,,2 B,,2 G,,2', 'C,2 G,2 E,2 G,2', 'D,2 A,2 F,2 A,2',
        'G,,2 D,2 B,,2 D,2', 'E,,2 B,,2 G,,2 B,,2', 'A,,2 E,2 C,2 E,2', 'D,2 A,,2 F,,2 D,,2',
        'C,2 G,2 C2 G,2', 'D,2 A,2 D2 A,2', 'B,,2 F,2 B,2 F,2', 'E,,2 B,,2 E,2 B,,2',
        'C,2 G,2 C2 G,2', 'D,2 A,2 F,2 A,2', 'G,,2 D,2 G,2 D,2', '[G,,D,]2 D,2 G,,2 z2',
      ],
    },
    hard: {
      rh: [
        '!mf! DGBG .[GBd]2 .[DGB]2', 'EGBG .[GBe]2 .[EGB]2', '[EGc]2 [Gce]2 dcBA', '[DFA]4 [DF]2 EF',
        '[DG]2 [DGB]2 [GBd]2 [Bdg]2', '[GBe]2 [GBd]2 [EGB]2 [B,EG]2', '[CEA]2 [EAc]2 [Ace]2 [EAc]2', '[FAd]4 ABcd',
        '!mp! [ce][Gd] [EGc]2 [CEG]2 [EGc]2', '[df][ce] [FAd]2 [DFA]2 [FAd]2', '[FBd]2 [DFB]2 [B,DF]2 [DFB]2', '[EG]4 [B,E]2 GB',
        '!f! [Cc]2 [Ece]2 [Gceg]2 [Ece]2', '[Fdf]3 [Ad] [DFA]2 [DF]2', '!mf! [DG]2 [DGB]2 [GBd]2 [DGB]2', '[B,DG]4 !f![GBdg]2 z2',
      ],
      lh: [
        'G,,D,G,D, B,,D,G,D,', 'E,,B,,E,B,, G,,B,,E,B,,', 'C,G,E,G, C,G,E,G,', 'D,A,F,A, D,A,F,A,',
        'G,,D,G,D, B,,D,G,D,', 'E,,B,,E,B,, G,,B,,E,B,,', 'A,,E,A,E, C,E,A,E,', 'D,A,F,A, G,F,E,D,',
        'C,2 [E,G,]2 G,,2 [E,G,]2', 'D,2 [F,A,]2 A,,2 [F,A,]2', 'B,,2 [D,F,]2 F,,2 [D,F,]2', 'E,,2 [E,G,]2 B,,2 [E,G,]2',
        '[C,,C,]2 [E,G,]2 G,,2 [E,G,]2', '[D,,D,]2 [F,A,]2 A,,2 [F,A,]2', 'G,,D,G,D, B,,D,G,D,', 'G,,D,G,D, [G,,G,]2 z2',
      ],
    },
  },
  // Lava Run, E minor
  'bg-volcano': {
    medium: {
      rh: [
        '!mf! E2 EG- GE [GB]2', '[Ec]2 B2 G2 E2', 'F2 FA- AF [Fd]2', '[GB]4 E2 z2',
        'E2 EG- GE [GB]2', '[Ec]2 B2 c2 [ce]2', '[Fd]2 c2 B2 A2', '[FB]4 ^D2 F2',
        '!mp! G2 E2 G2 [Ec]2', 'A2 F2 A2 [Fd]2', '!mf! B2 G2 B2 [Ge]2', 'e2 d2 B2 G2',
        '!f! [Ec]4 [ce]2 c2', '[Fd]4 [df]2 d2', '[F^d]4 B2 F2', 'B2 A2 G2 [^DF]2',
      ],
      lh: [
        'E,2 B,2 G,2 B,2', 'C,2 G,2 E,2 G,2', 'D,2 A,2 F,2 A,2', 'E,2 B,2 G,2 B,,^D,',
        'E,2 B,2 G,2 B,2', 'C,2 G,2 E,2 G,2', 'D,2 A,2 F,2 A,2', 'B,,2 F,2 ^D,2 F,2',
        'C,2 [E,G,]2 C,2 [E,G,]2', 'D,2 [F,A,]2 D,2 [F,A,]2', 'E,2 [G,B,]2 E,2 [G,B,]2', 'G,,2 [G,B,]2 G,,2 [G,B,]2',
        '[C,G,]2 [C,G,]2 [C,G,]2 [C,G,]2', '[D,A,]2 [D,A,]2 [D,A,]2 [D,A,]2', '[B,,F,]2 [B,,F,]2 [B,,F,]2 [B,,F,]2', '[B,,F,]2 [B,,F,]2 [B,,E,]2 [B,,^D,F,]2',
      ],
    },
    hard: {
      rh: [
        '!mf! [B,E]2 [B,E][EG]- [EG][B,E] [GB]2', '[Ec]2 [GB]2 [EG]2 [CE]2', '[DF]2 [DF][FA]- [FA][DF] [Ad]2', '[EGB]4 [B,E]2 z B,/2^D/2',
        '[B,E]2 [B,E][EG]- [EG][B,E] [GB]2', '[Ec]2 [GB]2 [Ec]2 [Gce]2', '[Fd]2 [Fc]2 [DB]2 [DA]2', '[^DFB]4 [B,D]2 [B,F]2',
        '!mp! [EG]2 [CE]2 [EG]2 [EGc]2', '[FA]2 [DF]2 [FA]2 [FAd]2', '!mf! [GB]2 [EG]2 [GB]2 [GBe]2', '[Be]2 [Bd]2 [GB]2 G/2A/2B',
        '!f! [CGc]4 [Ece]2 [CGc]2', '[DAd]4 [Fdf]2 [DAd]2', '[^DB^d]4 [DFB]2 [B,DF]2', '[^DFB]2 [DFA]2 [DG]2 [B,DF]2',
      ],
      lh: [
        'E,,E,, E,E,, E,,E, B,,E,,', 'C,,C,, C,C,, C,,C, G,,C,,', 'D,,D,, D,D,, D,,D, A,,D,,', 'E,,E,, E,E,, E,,E, B,,B,,',
        'E,,E,, E,E,, E,,E, B,,E,,', 'C,,C,, C,C,, C,,C, G,,C,,', 'D,,D,, D,D,, D,,D, A,,D,,', 'B,,,B,,, B,,B,,, B,,,B,, F,,B,,',
        'C,,G,, C,G,, C,,G,, C,G,,', 'D,,A,, D,A,, D,,A,, D,A,,', 'E,,B,, E,B,, E,,B,, E,B,,', 'G,,D, G,D, G,,D, G,D,',
        'C,,C, C,,C, C,,C, C,,C,', 'D,,D, D,,D, D,,D, D,,D,', 'B,,,B,, B,,,B,, B,,,B,, B,,,B,,', 'B,,,B,, B,,,B,, B,,,B,, [B,,,B,,]2',
      ],
    },
  },
  // Royal March, D major
  'bg-castle': {
    medium: {
      rh: [
        '!mf! A,3 D D2 [DF]2', '[B,G]2 F2 E2 D2', '[DF]3 A [FA]2 F2', '[CE]4 A,2 z2',
        'D2 F2 A2 [Ad]2', '[DB]3 A G2 [GB]2', '[CA]2 G2 F2 [CE]2', 'D4 z4',
        '!mp! [DF]3 F [DB]2 F2', 'G3 B [Gd]2 B2', '[FA]3 F D2 FA', '[CE]4 C2 E2',
        '!f! [Gd]3 B G2 Bd', '[Ec]3 A E2 Ac', '[Fd]2 A2 F2 A2', '[Fd]4 z4',
      ],
      lh: [
        'D,2 A,,2 D,2 A,,2', 'G,,2 D,2 B,,2 D,2', 'D,2 A,,2 D,2 A,,2', 'A,,2 E,2 C,2 E,2',
        'D,2 A,,2 D,2 A,,2', 'G,,2 D,2 B,,2 D,2', 'A,,2 E,2 C,2 A,,2', 'D,2 A,,A,, D,4',
        'B,,2 [D,F,]2 F,,2 [D,F,]2', 'G,,2 [B,,D,]2 D,,2 [B,,D,]2', 'D,2 [F,A,]2 A,,2 [F,A,]2', 'A,,2 [C,E,]2 E,,2 [C,E,]2',
        'G,,2 [B,,D,]2 D,,2 [B,,D,]2', 'A,,2 [C,E,]2 E,,2 [C,E,]2', 'D,2 [F,A,]2 A,,2 [F,A,]2', '[D,,A,,D,]2 z2 [D,,D,]2 z2',
      ],
    },
    hard: {
      rh: [
        '!mf! [FA]3 [Fd] [Fd]3/2e/2 [Adf]2', '[Bg]2 [df]2 [Be]2 [Bd]2', '[Adf]3 a [fa]3/2g/2 [df]2', '[Ace]4 [CA]2 z/2A/2B/2c/2',
        '[Ad]2 [Af]2 [da]2 [fad\']2', '[dgb]3 a [dg]2 [db]2', '[ca]2 [eg]2 [Af]2 [ce]2', '[FAd]4 z4',
        '!mp! [Bdf]3 f [db]2 [df]2', '[dg]3 b [bd\']2 [db]2', '[dfa]3 f [Ad]2 fa', '[Ace]2 e/2f/2e/2d/2 [Ac]2 [ce]2',
        '!f! [dgbd\']3 b [Bdg]2 bd\'', '[eac\']3 a [Ace]2 ac\'', '[dfad\']2 [Aa]2 [Ff]2 [Aa]2', '[dfad\']2 z2 [FAd]2 z2',
      ],
      lh: [
        'D,2 [F,A,][F,A,] A,,2 [F,A,]2', 'G,,2 [G,B,][G,B,] D,2 [G,B,]2', 'D,2 [F,A,][F,A,] A,,2 [F,A,]2', 'A,,2 [E,G,][E,G,] A,,2 [E,G,]2',
        'D,2 [F,A,][F,A,] A,,2 [F,A,]2', 'G,,2 [G,B,][G,B,] D,2 [G,B,]2', 'A,,2 [E,G,][E,G,] A,,2 [E,G,]2', 'D,2 [F,A,]2 D,E,D,C,',
        'B,,F,D,F, B,,F,D,F,', 'G,,D,B,,D, G,,D,B,,D,', 'D,A,F,A, D,A,F,A,', 'A,,E,C,E, E,D,C,B,,',
        'G,,G,D,G, G,,G,D,G,', 'A,,A,E,A, A,,A,E,A,', '[D,,D,]2 [F,,F,]2 [A,,A,]2 [C,C]2', '[D,,A,,D,]2 z2 [D,,D,]2 z2',
      ],
    },
  },
  // Island Breeze, F major
  'bg-sunset': {
    medium: {
      rh: [
        '!mf! [Fc]2 Ac [Af]2 ef', '[Fd]3 A [Af]2 d2', '[GB]2 d[Bg]- [Bg]fdB', 'c2 e[cg]- [cg]2 z2',
        '[ca]2 fa [fc\']2 af', '[Af]2 df [da]2 fd', '[Bd]2 f[db]- [db]agf', '[Ge]4 [cg]2 z2',
        '!mp! [Bf]2 d2 B2 df', '[cg]2 e2 c2 eg', '[ca]2 ge c2 eg', '[Af]4 d2 fa',
        '!f! [db]2 ag d2 gb', '[ca]2 ge c2 de', '!mf! [Af]2 c2 [FA]2 c2', '[Af]4 z4',
      ],
      lh: [
        'F,,2 C,2 F,2 C,2', 'D,,2 A,,2 D,2 A,,2', 'G,,2 D,2 G,2 D,2', 'C,2 G,2 C2 G,2',
        'F,,2 C,2 F,2 C,2', 'D,,2 A,,2 D,2 A,,2', 'B,,2 F,2 B,2 F,2', 'C,2 E,2 G,2 E,2',
        'B,,2 D,2 F,2 D,2', 'C,2 E,2 G,2 E,2', 'A,,2 C,2 E,2 C,2', 'D,2 F,2 A,2 F,2',
        'G,,2 D,2 G,2 D,2', 'C,2 G,2 C2 G,2', 'F,,2 C,2 F,2 C,2', '[F,,C,F,]4 C,C, F,,2',
      ],
    },
    hard: {
      rh: [
        '!mf! [Ac]2 [FA][Ac] [Acf]2 [ce][Af]', '[FAd]3 A [Adf]2 [Fd]A', '[DGB]2 [Gd][Bdg]- [Bdg]f [Bd]B', '[EGc]2 [Gce][ceg]- [ceg]2 z f/2g/2',
        '[cfa]2 fa [fac\']2 [ca][Af]', '[Adf]2 df [dfa]2 [df][Ad]', '[Bd]2 f[dfb]- [dfb]a [dg]f', '[Gce]4 [ceg]2 z/2 c/2d/2e/2',
        '!mp! [Bdf]2 [FBd]2 [DFB]2 [Bd][df]', '[ceg]2 [Gce]2 [EGc]2 [ce][eg]', '[cea]2 [eg][ce] [Ac]2 [ce][eg]', '[Adf]4 [Ad]2 f/2g/2a',
        '!f! [Bdgb]2 [da][dg] [GBd]2 [Bg][db]', '[cea]2 [eg][ce] [EGc]2 [Gd][ce]', '!mf! [Acf]2 [FAc]2 [CFA]2 [FAc]2', '[Acf]4 [FAc][FAc] [Acf]2',
      ],
      lh: [
        'F,,C,F, F,,C,F, F,,C,', 'D,,A,,D, D,,A,,D, D,,A,,', 'G,,D,G, G,,D,G, G,,D,', 'C,G,C C,G,C C,G,',
        'F,,C,F, F,,C,F, F,,C,', 'D,,A,,D, D,,A,,D, D,,A,,', 'B,,F,B, B,,F,B, B,,F,', 'C,G,CC, G,E,D,C,',
        'B,,D,F,B, F,D,B,,D,', 'C,E,G,C G,E,C,E,', 'A,,C,E,A, E,C,A,,E,', 'D,F,A,F, D,C,B,,A,,',
        'G,,D,G, G,,D,G, G,,D,', 'C,G,C C,G,C C,G,', 'F,,C,F, F,,C,F, F,,C,', 'F,,C,F,A, C,C, [F,,F,]2',
      ],
    },
  },
  // Jungle Drums, A minor
  'bg-rainforest': {
    medium: {
      rh: [
        '!mf! A2 c[Ae]- [Ae]dcA', 'G2 B[Gd]- [Gd]cBG', 'FAcf- fedc', '[^Ge]4 G2 B2',
        '[ca]2 ge- edeg', '[A^f]2 ed- dAdf', '[A=f]2 ec- cAcf', '[Be]4 z2 B2',
        '!mp! c2 e2 [ca]2 ge', 'd2 g2 [db]2 ag', '!mf! [fc\']2 a2 f2 ac\'', '[eb]2 ^g2 e2 z2',
        '!f! [ea]c\'ae [ea]c\'ae', '[dg]bgd [dg]bgd', 'e^gbg egbd\'', '[ca]4 z4',
      ],
      lh: [
        'A,,2 E,2 A,2 E,2', 'G,,2 D,2 G,2 D,2', 'F,,2 C,2 F,2 C,2', 'E,,2 B,,2 E,2 B,,2',
        'A,,2 C,2 E,2 C,2', 'D,2 ^F,2 A,2 F,2', '=F,2 A,2 C2 A,2', 'E,2 ^G,2 B,2 G,2',
        'A,,2 [E,A,]2 A,,2 [E,A,]2', 'G,,2 [D,G,]2 G,,2 [D,G,]2', 'F,,2 [C,F,]2 F,,2 [C,F,]2', 'E,,2 [B,,E,]2 E,,2 [B,,E,]2',
        '[A,,E,]3 [A,,E,]3 [A,,E,]2', '[G,,D,]3 [G,,D,]3 [G,,D,]2', '[E,,B,,]3 [E,,B,,]3 [E,,B,,]2', '[A,,E,A,]4 z4',
      ],
    },
    hard: {
      rh: [
        '!mf! [EA]2 c[Ae]- [Ae]d[Ac]A', '[DG]2 B[Gd]- [Gd]c[GB]G', 'FAc[Af]- [Af]e[Fd]c', '[^GBe]4 G2 [DGB]2',
        '[cea]2 g[ce]- [ce]d[ce]g', '[Ad^f]2 e[^Fd]- [Fd]Adf', '[Ac=f]2 e[=Fc]- [Fc]Acf', '[^GBe]4 z2 [DGB]2',
        '!mp! [EAc]2 [Ace]2 [cea]2 ge', '[GBd]2 [Bdg]2 [dgb]2 ag', '!mf! [fac\']2 [cfa]2 [cf]2 ac\'', '[e^gb]2 [Beg]2 [^GBe]2 z2',
        '!f! [cea]c\'ae [cea]c\'ae', '[Bdg]bgd [Bdg]bgd', '[Be]^gbg egbd\'', '[cea]3 [cea]3 [Acea]2',
      ],
      lh: [
        'A,,E,A,A,, E,A,A,,E,', 'G,,D,G,G,, D,G,G,,D,', 'F,,C,F,F,, C,F,F,,C,', 'E,,B,,E,E,, B,,E,E,,B,,',
        'A,,C,E,A,, C,E,A,,C,', 'D,^F,A,D, F,A,D,F,', '=F,A,CF, A,CF,A,', 'E,^G,B,G, E,D,B,,^G,,',
        'A,,A,E,A, A,,A,E,A,', 'G,,G,D,G, G,,G,D,G,', 'F,,F,C,F, F,,F,C,F,', 'E,,E,B,,E, E,,^G,,B,,D,',
        'A,,E,A,A,, E,A,A,,E,', 'G,,D,G,G,, D,G,G,,D,', 'E,,B,,E,E,, B,,E,E,,B,,', '[A,,A,]3 [A,,A,]3 [A,,A,]2',
      ],
    },
  },
  // Star Whale Dream (show tune), F major
  'show:bg-galaxy': {
    medium: {
      rh: [
        '!p! [CF]4 A2 c2', '[D=B]4 [DG]4', '!mp! [CA]4 c2 e2', '[=Bd]4 [GB]4',
        '!p! [Fc]2 [Af]6',
      ],
      lh: [
        'F,,2 C,2 F,2 C,2', 'G,,2 D,2 G,2 D,2', 'F,,2 C,2 F,2 C,2', 'G,,2 D,2 G,2 D,2',
        'F,,2 C,2 [F,,C,F,]4',
      ],
    },
    hard: {
      rh: [
        '!p! [Acf]2 cA [cfa]2 [fac\']2', '[dg=b]2 d=B [Bdg]2 Bd', '!mp! [cfa]2 fc [fac\']2 [ac\'e\']2', '[g=bd\']2 bg [dgb]2 gd',
        '!p! [fac\']2 [ac\'f\']6',
      ],
      lh: [
        'F,,C,F,A, CA,F,C,', 'G,,D,G,=B, DB,G,D,', 'F,,C,F,A, CA,F,C,', 'G,,D,G,=B, DB,G,D,',
        'F,,C,F,A, [F,A,C]4',
      ],
    },
  },
  // Dragon King Fanfare (show tune), B♭ major
  'show:bg-castle': {
    medium: {
      rh: [
        '!f! F2 FF [DB]4', '[Ac]2 cc [Fd]2 [FB]2', '[Ge]2 d2 c2 [GB]2', '[Ac]4 F2 z2',
        '[DB]2 [Fd]2 [df]4',
      ],
      lh: [
        'B,,4 F,F, B,2', 'F,,2 C,2 F,2 C,2', 'E,,2 B,,2 E,2 B,,2', 'F,,2 C,2 F,2 F,F,',
        'B,,2 F,2 [B,,F,B,]4',
      ],
    },
    hard: {
      rh: [
        '!f! [B,DF]2 [B,DF][B,DF] [B,DFB]4', '[FAc]2 [FAc][FAc] [FAd]2 [CFB]2', '[GBe]2 [GBd]2 [EGc]2 [EGB]2', '[FAc]4 [A,CF]2 z F/2A/2',
        '[B,DFB]2 [DFBd]2 [FBdf]4',
      ],
      lh: [
        'B,,,F,, B,,F,, B,,,F,, B,,F,,', 'F,,C, F,C, F,,C, F,C,', 'E,,B,, E,B,, E,,B,, E,B,,', 'F,,C, F,C, E,C, A,,F,,',
        'B,,,F,, B,,F,, [B,,,B,,]4',
      ],
    },
  },
  // Phoenix Fire (show tune), A minor
  'show:bg-volcano': {
    medium: {
      rh: [
        'z6 E2', '!mf! [EA]3 E [EA]2 [Ac]2', '[GB]3 G [GB]2 [Bd]2', '[Ac]2 B2 [FA]2 ^G2',
        '!f! A2 e2 [ca]4',
      ],
      lh: [
        '!mp! [A,,E,]2 [A,,E,]2 [A,,E,]2 [A,,E,][A,,E,]', 'A,,2 E,2 A,,2 E,2', 'G,,2 D,2 G,,2 D,2', 'F,,2 A,,2 C,2 E,,2',
        'A,,2 E,2 [A,,E,A,]4',
      ],
    },
    hard: {
      rh: [
        'z4 ecAE', '!mf! [CEA]3 E [CEA]B [EAc]2', '[DGB]3 G [DGB]c [GBd]2', '[FAc]2 B2 [FA]2 ^GB',
        '!f! [CEA]2 [EAce]2 [Acea]4',
      ],
      lh: [
        '!mp! [A,,A,]2 [A,,A,]2 [A,,A,]2 [A,,A,][A,,A,]', 'A,,E,A,E, A,,E,A,E,', 'G,,D,G,D, G,,D,G,D,', 'F,,C,F,A,, F,,C,E,,B,,',
        'A,,E,A,E, [A,,E,A,]4',
      ],
    },
  },
  // Rain Dance (show tune), D dorian
  'show:bg-rainforest': {
    medium: {
      rh: [
        'z2 .[DA]2 z2 .[DA]2', 'D2 FG [FA]2 GF', 'E2 GA [GB]2 AG', '[EA]cAG FG E2',
        '!f! D2 [DA]2 [Fd]4',
      ],
      lh: [
        '!mf! D,,2 A,,2 D,2 A,,2', 'D,,2 A,,2 D,2 A,,2', 'E,,2 B,,2 E,2 B,,2', 'C,2 G,,2 C,2 G,,2',
        'D,,2 A,,2 [D,,A,,D,]4',
      ],
    },
    hard: {
      rh: [
        'z2 [DFA]2 z ABc', '[FAd]2 [Af]g [dfa]2 [dg]f', '[GBe]2 [Bg]a [egb]2 ag', '[cea]c\' ag [cf]g [Gce]2',
        '!f! [FAd]2 [dfa]2 [dfad\']4',
      ],
      lh: [
        '!mf! D,,D,A,,D, D,,D,A,,D,', 'D,,D,A,,D, D,,D,A,,D,', 'E,,E,B,,E, E,,E,B,,E,', 'C,,C,G,,C, C,,C,G,,C,',
        'D,,D,A,,D, [D,,A,,D,]4',
      ],
    },
  },
  // Rainbow Slide (show tune), G major
  'show:bg-rainbow': {
    medium: {
      rh: [
        '!mf! DGBd [DB]GBd', '[Ge]2 dB [Gc]2 A2', 'BGBd [Bg]2 [Ge]2', '[Fd]2 c2 [DB]2 A2',
        'GBdg- g4',
      ],
      lh: [
        'G,,3 D,3 G,2', 'C,2 [E,G,]2 G,,2 [E,G,]2', 'G,,3 D,3 G,2', 'D,2 [F,A,]2 A,,2 [F,A,]2',
        'G,,2 [B,,D,]2 [G,,D,]4',
      ],
    },
    hard: {
      rh: [
        '!mf! DGB[Gd] [DB]GB[Gd]', '[Gce]2 dB [Ec]2 [CA]2', 'BGB[Gd] [Bdg]2 [Ge]2', '!f! [Dd]2 [Cc]2 [B,B]2 [A,A]2',
        'GBdg- [GBdg]4',
      ],
      lh: [
        'G,,D,G,G,, D,G,D,G,', 'C,E,G,C, E,G,E,G,', 'G,,D,G,G,, D,G,D,G,', 'D,,A,,D,D,, A,,D,A,,D,',
        'G,,D,G,D, [G,,D,G,]4',
      ],
    },
  },
  // Ghost Ship Shanty (show tune), D minor
  'show:bg-sunset': {
    medium: {
      rh: [
        '!mf! [Fd]2 Ad [Af]2 ed', '[Ec]2 Gc [Ge]2 dc', 'B2 df [fa]2 gf', '!f! [ea]2 ^ce [ea]2 z2',
        '[fd\']2 [fa]2 [Fd]4',
      ],
      lh: [
        'D,2 [F,A,]2 A,,2 [F,A,]2', 'C,2 [E,G,]2 G,,2 [E,G,]2', 'B,,2 [D,F,]2 F,,2 [D,F,]2', 'A,,2 [^C,E,]2 E,,2 A,,C,',
        'D,2 A,,2 [D,,A,,]4',
      ],
    },
    hard: {
      rh: [
        '!mp! [FAd]2 A[Ad] [Adf]2 [Ae][Ad]', '[EGc]2 G[Gc] [Gce]2 [Gd][Gc]', '[DFB]2 [Bd][Bf] [Bfa]2 [Bg][Bf]', '!f! [^cea]2 [Ac][Ae] [cea]2 z/2a/2b/2^c\'/2',
        '[ad\']2 [dfa]2 [DFAd]4',
      ],
      lh: [
        'D,,A,,D,D,, A,,D,D,,A,,', 'C,,G,,C,C,, G,,C,C,,G,,', 'B,,F,B,B,, F,B,B,,F,', 'A,,E,A,A,, E,A,A,,E,',
        'D,2 A,,2 [D,,A,,D,]4',
      ],
    },
  },
  // The Kraken Wakes (show tune), E minor
  'show:bg-ocean': {
    medium: {
      rh: [
        '!p! E3 G- G2 B2', '[Ec]3 B- B2 G2', '!mp! E3 G- G2 [GB]2', '!mf! [F^d]3 f- f2 [db]2',
        '!f! e2 B2 [ge\']4',
      ],
      lh: [
        'E,,3 B,,- B,,2 E,2', 'C,,3 G,,- G,,2 C,2', 'E,,3 B,,- B,,2 E,2', 'B,,,3 F,,- F,,2 B,,2',
        'E,,2 B,,2 [E,,B,,E,]4',
      ],
    },
    hard: {
      rh: [
        '!p! [B,E]3 [EG]- [EG]2 [GB]2', '[Ec]3 [GB]- [GB]2 [EG]2', '!mp! [B,E]3 [EG]- [EG]2 [GB]2', '!mf! [F^d]3 [df]- [df]2 [fb]2',
        '!f! [GBe]2 B/2e/2g/2b/2 [gbe\']4',
      ],
      lh: [
        'E,,E, E,,E, E,,E, D,,D,', 'C,,C, C,,C, C,,C, D,,D,', 'E,,E, E,,E, D,,D, C,,C,', 'B,,,B,, B,,,B,, B,,,B,, ^D,,^D,',
        'E,,E, E,,E, [E,,B,,E,]4',
      ],
    },
  },
  // Moon Worm Coaster (show tune), G major
  'show:bg-space': {
    medium: {
      rh: [
        '!mf! GBdg fdBA', 'GBdg agfe', 'cege dfaf', '[Bg]2 d2 B2 G2',
        'GBdg- g4',
      ],
      lh: [
        'G,,2 D,2 B,,2 D,2', 'G,,2 D,2 B,,2 D,2', 'C,2 G,2 D,2 A,2', 'G,,2 D,2 B,,2 D,2',
        'G,,2 D,2 [G,,D,G,]4',
      ],
    },
    hard: {
      rh: [
        '!mf! GBdg [Bf]dBA', 'GBdg [da]gfe', '[Gc]e[cg]e dfaf', '[Bdg]2 [Bd]2 [GB]2 [DG]2',
        'GBdg- [GBdg]4',
      ],
      lh: [
        'G,,D,G,D, G,,D,G,D,', 'G,,D,G,D, B,,D,G,D,', 'C,G,E,G, D,A,F,A,', 'G,D,B,,D, G,,A,,B,,D,',
        'G,D,B,,G,, [G,,D,G,]4',
      ],
    },
  },
  // Great Oak Lights (show tune), C major
  'show:bg-meadow': {
    medium: {
      rh: [
        '!mp! cGeG cGeG', 'dAfA dAfA', '!mf! ecgc [ce]2 dc', 'BGdG [GB]2 cd',
        '!f! [Gc]2 g2 [ec\']4',
      ],
      lh: [
        'C,2 G,2 E,2 G,2', 'D,2 A,2 F,2 A,2', 'C,2 G,2 E,2 G,2', 'G,,2 D,2 B,,2 D,2',
        'C,2 G,2 [C,E,G,]4',
      ],
    },
    hard: {
      rh: [
        '!mp! [Ec]GeG [Ec]GeG', '[Fd]AfA [Fd]AfA', '!mf! [Ge]cgc [ce]2 [Gd][Ec]', '[DB]GdG [GB]2 [Gc][Bd]',
        '!f! [EGc]2 [ceg]2 [egc\']4',
      ],
      lh: [
        'C,E,G,E, C,E,G,E,', 'D,F,A,F, D,F,A,F,', 'C,G,E,G, C,G,E,G,', 'G,,D,B,,D, G,,G,,A,,B,,',
        'C,G,E,G, [C,,C,]4',
      ],
    },
  },
};
