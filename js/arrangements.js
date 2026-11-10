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
        '!mp! A,3 C [A,CE]4', '[A,F]2 [CE]2 [A,C]3 E', '[EG]3 F [CE]2 C2', '[B,D]6 EG',
        '[CEA]4 [EB]2 [Ac]2', '[FA]3 G [A,F]4', '[B,G]2 [DB]2 [Bd]4', '[GB]6 AB',
        '!mf! [FAc]2 B2 [FA]2 [CF]2', '[Bd]2 c2 [GB]2 [DG]2', '[EAce]4 [Ec]2 [CA]2', '[EB]2 [Ec]2 [Gce]4',
        '!f! [FAcf]2 [Ee]2 [Cc]2 [A,A]2', '[B,G]2 [DB]2 [GBd]4', '[B,E^G]3 A [EGB]4', '[E^GBe]4 [DGB]4',
        '!fermata![CEA]8',
      ],
      lh: [
        'A,,E,C,E, A,,E,C,E,', 'F,,C,A,,C, F,,C,A,,C,', 'C,G,E,G, C,G,E,G,', 'G,,D,B,,D, G,F,E,D,',
        'A,,E,C,E, A,,E,A,E,', 'F,,C,F,C, A,,C,F,C,', 'G,,D,G,D, B,,D,G,D,', 'E,,B,,E,B,, G,,B,,E,B,,',
        'F,,C,F,C, A,,C,F,C,', 'G,,D,G,D, B,,D,G,D,', 'A,,E,A,E, A,,E,C,E,', 'C,G,E,G, C,G,E,G,',
        'F,,F,F,,F, F,,F,F,,F,', 'G,,G,G,,G, G,,G,G,,G,', 'E,,E,E,,E, E,,E,E,,E,', '[E,,B,,E,]4 [E,,E,]4',
        '!fermata![A,,E,A,]8',
      ],
    },
    hard: {
      rh: [
        '!mp! A,2 (E/A/c/e/) E2 (e/c/A/E/)', '[A,F]2 [CE]2 C2 (F/A/c/A/)', 'G2 (c/e/g/e/) [CE]2 C2', '[B,D]4 (G,/A,/B,/C/ D/E/F/G/)',
        '!mf! [CEA]2 (E/A/c/e/) [EB]2 [EAc]2', '[CFA]2 (F/A/c/A/) [CF]2 (c/A/F/C/)', '[B,DG]2 [DGB]2 [GBd]2 (g/d/B/G/)', '[EGB]3 [EGB]- [EGB]2 AB',
        '!mp! [Ac]F [GB]F [FA]C FC', '[Bd]G [Ac]G [GB]D GD', '[ce]A EA [Ac]E [EA]C', '[GB]E [Gc]E [Gce]2 (G/c/e/g/)',
        '!f! [Ff]c [Ee]c [Cc]A [A,A]F', '[B,DG]2 [DGB]2 [DGBd]2 (g/d/B/G/)', '[B,E^G]3 [EGB]- [EGB]2 [EGB]2', '[E^GBe]3 d/c/ [DGB]4',
        '!fermata![A,CEA]8',
      ],
      lh: [
        'A,,E,C,E, A,,E,A,,G,,', 'F,,C,A,,C, F,,C,F,D,', 'C,G,E,G, C,G,E,A,,', 'G,,D,B,,D, G,,D,F,D,',
        'A,,2 [C,E,A,]2 E,,2 [C,E,A,]2', 'F,,2 [C,F,A,]2 C,,2 [C,F,A,]2', 'G,,2 [D,G,B,]2 D,,2 [D,G,B,]2', 'E,,2 [E,G,B,]2 (E,/G,/B,/G,/) E,2',
        'F,,3 [C,F,A,]- [C,F,A,]2 [C,F,A,]2', 'G,,3 [D,G,B,]- [D,G,B,]2 [D,G,B,]2', 'A,,E,A,E, C,E,A,,G,,', 'C,G,E,G, C,E, G,,2',
        '[F,,F,]2 [C,F,A,]2 [C,,C,]2 [C,F,]2', '[G,,G,]2 [D,G,B,]2 D,,2 [D,G,B,]2', '[E,,E,]2 [^G,,^G,]2 [B,,B,]2 [D,,D,]2', '[E,,E,]2 [E,^G,D]2 [E,,B,,E,]4',
        '!fermata![A,,,E,,A,,]8',
      ],
    },
  },
  // Golden Stars, G major
  'bg-galaxy': {
    medium: {
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
    hard: {
      rh: [
        '!mp! E2 CE [EG]2 [EGc]2', 'F2 DF [FA]2 [FAd]2', '[Gce]2 Gc [Gd]2 [EGc]2', '[FAd]4 (d/f/a/d\'/ a/f/d/f/)',
        '!p! [gb]2 (g/e/g/b/) [eg]2 [Be]2', '[df]2 (d/B/d/f/) [Bd]2 [FB]2', 'cG/c/ ec/e/ ge/g/ [egc\']2', '[dfa]4 (a/f/d/A/) (d/c/B/A/)',
        '!mf! [EG]2 [EGc]2 [Gce]2 (G/c/e/g/)', '[Adf]4 [Fd]2 [DFA]2', '[DFB]2 [FBd]2 [Bdf]2 (f/d/B/d/)', '[GBe]4 [EGB]2 [EG]2',
        '!f! [CEA]2 [EAc][EAce]- [EAce]4', '[DFAd]4 [FAdf]2 [Adfa]2', '[GBdg]4 [DGBd]2 [B,DGB]2', '!mp! [B,DG]2 z2 (G/B/d/g/) [Bdg]2',
      ],
      lh: [
        'C,,2 G,,/C,/E,/G,/ C,G,, E,G,', 'D,,2 A,,/D,/F,/A,/ D,A,, F,A,', 'C,,2 G,,/C,/E,/G,/ E,C, G,,C,', 'D,,A,,D,F, A,2 D,2',
        'E,,B,,G,B, EB,G,B,,', 'B,,F,B,D B,F,D,F,', 'C,,G,,E,G, CG,E,C,', 'D,,A,,F,A, DA,F,D,',
        'C,,G,,C,E, G,E,C,G,,', 'D,,2 A,,/D,/F,/A,/ F,2 A,/F,/D,/A,,/', 'B,,F,B,D B,F,D,F,', 'E,,2 B,,/E,/G,/B,/ G,2 B,/G,/E,/B,,/',
        '[A,,A,]2 E,A, A,/E,/C,/E,/ A,,2', '[D,,D,]2 A,,/D,/F,/A,/ [A,,A,]2 [F,,F,]2', '[G,,G,]2 D,/G,/B,/G,/ D,G,, B,,D,', '[G,,G,]2 D,/G,/B,/D/ z2 [G,,D,G,]2',
      ],
    },
  },
  // Forest Village, C major
  'bg-meadow': {
    medium: {
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
    },
    hard: {
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
    },
  },
  // Bubble Waltz, D minor
  'bg-ocean': {
    medium: {
      rh: [
        '!p! [FA]2 [Fd]2 [Af]2', '[df]2 [Bd]2 [DB]2', '[FA]2 [Fc]2 [Af]2', '[Gce]4 (g/2e/2c/2e/2)',
        '[Ad]3 f [fa]2', '[dfb]2 [fa]2 [df]2', '!mf! [Bdg]2 [dgb]2 [gbd\']2', '[^cea^c\']4 [cea]2',
        '!mp! [fac\']2 [ca]2 [Af]2', '[cg]2 [ce]2 [Ec]2', '[Fd]2 [Af]2 [fa]c\'', '[dfb]3 (a/2g/2 [df]2)',
        '!p! [Bg]3 [ca] [db]2', '[^ca]2 [eg]2 [ce]2', '[FAd]4 (A/2d/2f/2a/2)', '[^ce]2 [Ac]2 [EAce]2',
        '!fermata![FAd]6',
      ],
      lh: [
        'D,F, A,D A,F,', 'B,,D, F,B, F,D,', 'F,,C, F,A, F,C,', 'C,E, G,C G,E,',
        'D,F, A,D A,F,', 'B,,D, F,B, F,D,', 'G,,D, G,B, G,D,', 'A,,^C, E,A, E,C,',
        'F,A, CA, F,A,', 'E,G, CG, E,G,', 'D,A, DA, F,A,', 'B,,F, B,F, D,F,',
        'G,,D, G,D, B,,D,', 'A,,E, A,G, E,^C,', 'D,A, DA, F,A,', 'A,,E, A,E, [A,,E,A,]2',
        '!fermata![D,A,]6',
      ],
    },
    hard: {
      rh: [
        '!p! [FA]2 [Fd]e [Af]2', '[df]2 [Bd]2 (B/A/G/B/)', '[FA]2 [Fc]d/e/ [Af]2', '[Gce]2 (c/e/g/c\'/ e\'/c\'/g/e/)',
        '!mp! [Ad]2 [df]g [fa]2', '[dfb]2 [fa]g [df]2', '!mf! [Bdg]2 [dgb]2 [gbd\']2', '!f! [^cea^c\']2 (c/e/a/c\'/) [cea]2',
        '!mp! [ac\']c [fa]A [cf]F', '[eg]G [ce]E [Gc]C', '[Fd]D [Af]F [fa][ac\']', '[dfb]2 (a/b/a/g/) [df]2',
        '!mf! [Bdg]2 [da]2 [dgb]2', '[^cea]2 [ceg]f [Ace]2', '!p! [FAd]2 (d/f/a/d\'/ f\'/d\'/a/f/)', '[A^ce]2 [EAc]2 [Ace]2',
        '!fermata![DFAd]6',
      ],
      lh: [
        'D,,A,, F,A, DA,', 'B,,F, DF, B,F,', 'F,,C, F,A, CA,', 'C,,G,, E,G, CG,',
        'D,,2 [F,A,D]2 [F,A,D]2', 'B,,2 [F,B,D]2 [F,B,D]2', '[G,,G,]2 [G,B,D]2 [G,B,D]2', '[A,,A,]2 [E,G,^C]2 A,,G,,',
        'F,,C, A,C, A,C,', 'C,,G,, E,G,, E,G,,', 'D,,A,, F,A,, F,A,,', 'B,,F, DF, DF,',
        '[G,,G,]2 [D,G,B,]2 [B,,B,]2', '[E,A,^C]2 [A,,A,]2 [E,G,C]2', 'D,,A,, F,A, DA,', 'A,,E, A,^C [A,,E,A,]2',
        '!fermata![D,,A,,D,]6',
      ],
    },
  },
  // Candy Skip, G major
  'bg-rainbow': {
    medium: {
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
    hard: {
      rh: [
        '!mf! DGBG .[DGBd]2 .[B,DGB]2', 'EGBG .[EGBe]2 .[B,EGB]2', '[EGc]2 [Gce]2 [Bd][Ac][GB][FA]', '[DFA]2 z[DFA] [DF]2 EF',
        '[B,DG]2 [DGB]2 [GBd][Bdg]- [Bdg]2', '[GBe]2 [GBd]c [EGB]A [B,EG]2', '[CEA]2 [EAc][Ace]- [Ace]2 [EAc]2', '[FAd]4 [FA][GB][Ac][Bd]',
        '!mp! [ce][Bd] [Gc]E GC [Gc]E', '[df][ce] [Ad]F AD [Ad]F', '!mf! [Bd]F BD FB, [FB]D', '[B,EG]2 z[B,EG] [B,E]2 [EG][GB]',
        '!f! [EGc]2 [Gce][Gceg]- [Gceg]2 [Gce]2', '[FAdf]3 [FAd] [DFA]2 [A,DF]2', '[GBdg]2 [Bdgb]2 [dgbd\']2 [Bdgb]2', '[GBdg]2 dB [Dd][Ee] .[GBdg]2',
      ],
      lh: [
        '[G,,G,]2 [G,B,]2 D,B,, G,,F,,', '[E,,E,]2 [G,B,]2 E,B,, G,,B,,', '[C,,C,]2 [E,G,]2 G,,A,, B,,^C,', '[D,,D,]2 A,,2 D,C, B,,A,,',
        'G,,B,, D,E, G,E, D,B,,', 'E,G, B,G, E,D, B,,G,,', 'A,,C, E,G, A,G, E,C,', '[D,,D,]2 A,,D, F,,G,, A,,B,,',
        '[C,,C,]2 [E,G,C]2 G,,2 [E,G,]E,', '[D,,D,]2 [F,A,D]2 A,,2 [F,A,]A,,', '[B,,B,]2 [D,F,B,]2 F,,2 [D,F,]F,', '[E,,E,]2 B,,2 E,,G,, A,,B,,',
        '[C,,C,]2 [E,G,C]2 [G,,G,]2 [E,G,C]2', '[D,,D,]2 [F,A,D]2 [A,,A,]2 [D,F,]2', 'G,,B,, D,E, G,E, D,B,,', '[G,,G,]2 z2 [D,,D,][E,,E,] .[G,,G,]2',
      ],
    },
  },
  // Lava Run, E minor
  'bg-volcano': {
    medium: {
      rh: [
        '!mf! [B,E]2 [B,E][EG]- [EG][B,E] [GB]2', '[Ec]2 [GB]2 [EG]2 [CE]2', '[DF]2 [DF][FA]- [FA][DF] [Ad]2', '[EGB]4 [B,E]2 z B,/2^D/2',
        '[B,E]2 [B,E][EG]- [EG][B,E] [GB]2', '[Ec]2 [GB]2 [Ec]2 [Gce]2', '[Fd]2 [Fc]2 [DB]2 [DA]2', '[^DFB]4 [B,D]2 [B,F]2',
        '!mp! [EG]2 [CE]2 [EG]2 [EGc]2', '[FA]2 [DF]2 [FA]2 [FAd]2', '!mf! [GB]2 [EG]2 [GB]2 [GBe]2', '[Be]2 [Bd]2 [GB]2 G/2A/2B',
        '!f! [CGc]4 [Ece]2 [CGc]2', '[DAd]4 [Fdf]2 [DAd]2', '[^DB^d]4 [DFB]2 [B,DF]2', '[^DFB]2 [DFA]2 [DG]2 [B,DF]2',
        '!fermata![G,B,E]8',
      ],
      lh: [
        'E,,E,, E,E,, E,,E, B,,E,,', 'C,,C,, C,C,, C,,C, G,,C,,', 'D,,D,, D,D,, D,,D, A,,D,,', 'E,,E,, E,E,, E,,E, B,,B,,',
        'E,,E,, E,E,, E,,E, B,,E,,', 'C,,C,, C,C,, C,,C, G,,C,,', 'D,,D,, D,D,, D,,D, A,,D,,', 'B,,,B,,, B,,B,,, B,,,B,, F,,B,,',
        'C,,G,, C,G,, C,,G,, C,G,,', 'D,,A,, D,A,, D,,A,, D,A,,', 'E,,B,, E,B,, E,,B,, E,B,,', 'G,,D, G,D, G,,D, G,D,',
        'C,,C, C,,C, C,,C, C,,C,', 'D,,D, D,,D, D,,D, D,,D,', 'B,,,B,, B,,,B,, B,,,B,, B,,,B,,', 'B,,,B,, B,,,B,, B,,,B,, [B,,,B,,]2',
        '!fermata![E,,E,]8',
      ],
    },
    hard: {
      rh: [
        '!mf! [G,B,E]2 [B,E][B,EG]- [B,EG][B,E] [EGB]2', '[Ec]G [GB]E [EG]C [CE]G,', '[A,DF]2 [DF][DFA]- [DFA][DF] [FAd]2', '[EGB]2 AG [G,B,E]2 B,^C/2^D/2',
        '!f! [EBe]2 [Ee][GBg]- [GBg][Ee] [Beb]2', '[cc\']g [Bb]g [cc\']g [ege\']2', '[dd\']a [cc\']a [Bb]f [Adfa]2', '[B^db]4 [^DFd]2 [FBf]2',
        '!mp! [EG]C [CE]G, [EG]C [Ec]G', '[FA]D [DF]A, [FA]D [Fd]A', '!mf! [GB]E [EG]B, [GB]E [Ge]B', '[Be]G [Bd]G [GB]D G/2A/2B',
        '!f! [cegc\']3 [cgc\'] [ec\'e\']2 [cgc\']2', '[dfad\']3 [dad\'] [fd\'f\']2 [dad\']2', '[^dfb^d\']3 [dbd\'] [Bdfb]2 [FBdf]2', '[B^dfb]2 [Adfa]2 [GBeg]2 [FBdf]2',
        '!fermata![EGBe]8',
      ],
      lh: [
        'E,,E, G,,E, B,,E, G,,E,', 'C,,C, E,,C, G,,C, E,,C,', 'D,,D, F,,D, A,,D, F,,D,', 'E,,E, G,,E, [C,,C,]2 [B,,,B,,]2',
        '[E,,E,]2 G,,E, B,,E, G,,E,', '[C,,C,]2 E,,C, G,,C, E,,C,', '[D,,D,]2 F,,D, A,,D, C,,D,', 'B,,,F,, B,,^D, F,D, B,,F,,',
        'C,,G,, E,G,, C,,G,, E,G,,', 'D,,A,, F,A,, D,,A,, F,A,,', 'E,,B,, G,B,, E,,B,, G,B,,', 'G,,D, B,D, G,,D, B,D,',
        'C,,C, E,,E, G,,G, E,,E,', 'D,,D, F,,F, A,,A, F,,F,', 'B,,,B,, ^D,,^D, F,,F, D,,D,', '[B,,B,]2 [A,,A,]2 [G,,G,]2 [B,,,B,,]2',
        '!fermata![E,,B,,E,]8',
      ],
    },
  },
  // Royal March, D major
  'bg-castle': {
    medium: {
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
    hard: {
      rh: [
        '!mf! [FA]2 F/A/d [Fd]3/2e/ [Adf]2', '[Bdg]2 [df]2 [GBe]2 [GBd]3/2e/', '[Adf]2 d/f/a [fa]3/2g/ [Adf]2', '[Ace]2 [ce]/[ce]/[ce] [CEA]2 z/A/B/c/',
        '!f! [FAd]2 [Adf]2 [dfa]2 [fad\']2', '[dgb]2 [gb]/[gb]/[da] [Bdg]2 [dgb]2', '[cea]3/2a/ [ceg]2 [Af]3/2f/ [Ace]2', '[FAd]3 [Adf]- [Adf]2 [dfa]z',
        '!mp! [df]B df [db]2 [Bf]e/f/', '[dg]B db [gd\']2 [db]c\'/b/', '[fa]d Af [FAd]2 [df][fa]', '[Ace]2 e/f/e/d/ [Ac]2 e/g/a/c\'/',
        '!f! [dgbd\']3 [gb] [Bdg]2 [gb][bd\']', '[ceac\']3 [ea] [Ace]2 [ea][ac\']', '[dfad\']2 [Adfa]2 [FAdf]2 [Adfa]2', '[dfad\']2 (a/g/f/e/) [FAd]2 z2',
      ],
      lh: [
        'D,,2 [F,A,][F,A,] A,,2 [F,A,D]2', 'G,,2 [G,B,][G,B,] D,2 [G,B,D]2', 'D,,2 [F,A,][F,A,] A,,2 [F,A,D]2', 'A,,2 [E,G,C][E,G,C] A,2 G,E,',
        'D,D A,,A, F,,F, D,,D,', '[G,,G,]2 [G,B,D]2 [D,,D,]2 [G,B,D]2', 'A,,A, B,,B, C,C E,E', '[D,,D,]2 [F,A,D]2 [D,,D,][E,,E,] [D,,D,][C,,C,]',
        'B,,F,DF, B,,F,DF,', 'G,,D,B,D, G,,D,B,D,', 'D,,A,,F,A,, D,,A,,F,A,,', 'A,,E,CE, A,,C,E,A,',
        '[G,,G,]2 [G,B,D][G,B,D] D,2 [G,B,D]2', '[A,,A,]2 [E,G,C][E,G,C] E,2 [E,G,C]2', '[D,,D,]3 [F,,F,]- [F,,F,]2 [A,,A,]2', '[D,,D,]2 [A,,A,]2 [D,,A,,D,]2 z2',
      ],
    },
  },
  // Island Breeze, F major
  'bg-sunset': {
    medium: {
      rh: [
        '!mf! [Ac]2 [FA][Ac] [Acf]2 [ce][Af]', '[FAd]3 A [Adf]2 [Fd]A', '[DGB]2 [Gd][Bdg]- [Bdg]f [Bd]B', '[EGc]2 [Gce][ceg]- [ceg]2 z f/2g/2',
        '[cfa]2 fa [fac\']2 [ca][Af]', '[Adf]2 df [dfa]2 [df][Ad]', '[Bd]2 f[dfb]- [dfb]a [dg]f', '[Gce]4 [ceg]2 z/2 c/2d/2e/2',
        '!mp! [Bdf]2 [FBd]2 [DFB]2 [Bd][df]', '[ceg]2 [Gce]2 [EGc]2 [ce][eg]', '[cea]2 [eg][ce] [Ac]2 [ce][eg]', '[Adf]4 [Ad]2 f/2g/2a',
        '!f! [Bdgb]2 [da][dg] [GBd]2 [Bg][db]', '[cea]2 [eg][ce] [EGc]2 [Gd][ce]', '!mf! [Acf]2 [FAc]2 [CFA]2 [FAc]2', '[Acf]4 [FAc][FAc] [Acf]2',
      ],
      lh: [
        'F,,C,F, F,,C,F, F,,C,', 'D,,A,,D, D,,A,,D, D,,A,,', 'G,,D,G, G,,D,G, G,,D,', 'C,G,C C,G,C C,G,',
        'F,,C,F, F,,C,F, F,,C,', 'D,,A,,D, D,,A,,D, D,,A,,', 'B,,F,B, B,,F,B, B,,F,', 'C,G,CC, G,E,C,2',
        'B,,D,F,B, F,D,B,,D,', 'C,E,G,C G,E,C,E,', 'A,,C,E,A, E,C,A,,E,', 'D,F,A,F, D,C,B,,A,,',
        'G,,D,G, G,,D,G, G,,D,', 'C,G,C C,G,C C,G,', 'F,,C,F, F,,C,F, F,,C,', 'F,,C,F,A, C,C, [F,,F,]2',
      ],
    },
    hard: {
      rh: [
        '!mf! [Ac]2 [FA][Ac] [Acf]2 [Gce][Acf]', '[FAd]2 [DF][FA] [Adf]2 [FAd][DFA]', '[DGB]2 [Gd][Bdg]- [Bdg][Af] [Gd][FB]', '[EGc]2 [Gce][ceg]- [ceg]2 (d/e/f/g/)',
        '[Acfa]2 [Af][ca] [cfac\']2 [ca][Af]', '[FAdf]2 [Fd][Af] [Adfa]2 [Af][Fd]', '[FBd]2 [Bdf][dfb]- [dfb][ca] [Bg][Af]', '[Gce]2 [EG][Gc] [ceg]2 (G/c/d/e/)',
        '!mp! [Bdf]F [Bd]F [DB]F [Bd][Bdf]', '[ceg]G [ce]G [Ec]G [ce][ceg]', '[cea]A [eg][ce] [Ec]A [ce][ceg]', '[Adf]2 [DF][FA] [Ad]2 f/g/a',
        '!f! [Bdgb]2 [ca][Bg] [GBd]2 [Bdg][dgb]', '[Acea]2 [eg][ce] [EGc]2 [FAd][Gce]', '[Acf]2 [FAc][FAc] [CFA]2 [FAc][FAc]', '[FAcf]2 [Ac][cf] [FAc][FAc] [FAcf]2',
      ],
      lh: [
        '[F,,F,]2 [A,C]D, C,2 [A,C]E,', '[D,,D,]2 [F,A,]B,, A,,2 [F,A,]A,,', '[G,,G,]2 [B,D]C, D,2 [B,D]D,', '[C,,C,]2 [E,G,]A,, G,,2 [E,G,B,]2',
        'F,,C,A,C, F,,C,A,C,', 'D,,A,,F,A,, D,,A,,F,A,,', 'B,,F,DF, B,,F,DF,', 'C,E,G,A, CA,G,2',
        'B,,D,F,G, B,G,F,D,', 'C,E,G,A, CA,G,E,', 'A,,C,E,G, A,G,E,C,', 'D,F,A,C DC B,A,',
        '[G,,G,]2 D,[B,D] G,[B,D] D,2', '[C,,C,]2 G,,[E,G,] C,[E,G,] G,,2', '[F,,F,]2 C,[F,A,] A,,[F,A,] C,2', '[F,,F,]2 A,,C, [C,F,][C,F,] [F,,C,F,]2',
      ],
    },
  },
  // Jungle Drums, A minor
  'bg-rainforest': {
    medium: {
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
    hard: {
      rh: [
        '!mf! [CEA]2 c[Ace]- [Ace]d [EAc]A', '[B,DG]2 B[GBd]- [GBd]c [DGB]G', '[CF]A c[Acf]- [Acf]e [FAd]c', '[^GBe]2 dB [EG]2 [DGB]2',
        '[cea]2 [eg][Ace]- [Ace]d [ce][eg]', '[Ad^f]2 e[^FAd]- [FAd]A [Fd][Af]', '[Ac=f]2 e[=FAc]- [FAc]A [Fc][Af]', '[^GBe]2 z[GBe] z[GBe] [DGB]2',
        '!mp! [Ac]2 [ce]2 [ea]2 ge', '[Bd]2 [dg]2 [gb]2 ag', '!mf! [fac\']2 [cfa]2 [Acf]2 ac\'', '[e^gb]2 [Beg]2 [^GBe]2 [Bd][eg]',
        '!f! [cea]c\'[ca]e [cea]c\'[ca]e', '[Bdg]b[Bg]d [Bdg]b[Bg]d', '[Be]^g[eb]g [Be]g[eb][gd\']', '[cea]2 [ce][Ac] [CEA]2 z2',
      ],
      lh: [
        'A,,2 [E,A,C]E, E,,2 [E,A,C]E,', 'G,,2 [D,G,B,]D, D,,2 [D,G,B,]D,', 'F,,2 [C,F,A,]C, C,,2 [C,F,A,]C,', 'E,,2 [E,^G,D]2 E,,^G,, B,,D,',
        'A,,E,A,C ECA,E,', 'D,,A,,D,^F, A,F,D,A,,', '=F,,C,F,A, CA,F,C,', '[E,,E,]2 [B,,E,]2 [B,,E,]2 E,^G,',
        '[A,,A,]2 [A,C][CE]- [CE]D [A,C]A,', '[G,,G,]2 [G,B,][B,D]- [B,D]C [G,B,]G,', '[F,,F,]2 [F,A,][A,C]- [A,C]A, F,C,', '[E,,E,]2 [^G,B,][B,D]- [B,D]2 E,,^G,,',
        '[A,,A,]2 [E,A,C]2 [E,,E,]2 [E,A,C][E,A,C]', '[G,,G,]2 [D,G,B,]2 [D,,D,]2 [D,G,B,][D,G,B,]', '[E,,E,]2 [E,^G,D]2 [B,,,B,,]2 [E,G,D]2', '[A,,A,]2 E,C, [A,,E,A,]2 z2',
      ],
    },
  },
  // Star Whale Dream (show tune), F major
  'show:bg-galaxy': {
    medium: {
      rh: [
        '!p! [Acf]2 cA [cfa]2 [fac\']2', '[dg=b]2 d=B [Bdg]2 Bd', '!mp! [cfa]2 fc [fac\']2 [ac\'e\']2', '[g=bd\']2 bg [dgb]2 gd',
        '!p! [fac\']2 [ac\'f\']6',
      ],
      lh: [
        'F,,C,F,A, CA,F,C,', 'G,,D,G,=B, DB,G,D,', 'F,,C,F,A, CA,F,C,', 'G,,D,G,=B, DB,G,D,',
        'F,,C,F,A, [F,A,C]4',
      ],
    },
    hard: {
      rh: [
        '!p! [FAcf]2 (A/c/f/c/) [Acfa]2 [cfac\']2', '[dg=b]2 (d/g/b/g/) [=Bdg]2 (B/d/g/d/)', '!mp! [Acfa]2 (f/c/A/c/) [cfac\']2 [eac\'e\']2', '[dg=bd\']2 (b/g/d/g/) [=Bdgb]2 (B/d/g/d/)',
        '!p! [cfac\']2 [fac\'f\']6',
      ],
      lh: [
        'F,,C,A,C A,F,C,A,,', 'G,,D,G,=B, (D/2B,/2G,/2D,/2) =B,,G,,', 'F,,C,A,C A,F,C,A,,', 'G,,D,G,=B, (D/2B,/2G,/2D,/2) =B,,G,,',
        'F,,C, (A,/2C/2A,/2F,/2) [F,,C,F,]4',
      ],
    },
  },
  // Dragon King Fanfare (show tune), B♭ major
  'show:bg-castle': {
    medium: {
      rh: [
        '!f! [B,DF]2 [B,DF][B,DF] [B,DFB]4', '[FAc]2 [FAc][FAc] [FBd]2 [DFB]2', '[GBe]2 [GBd]2 [EGc]2 [EGB]2', '[FAc]4 [A,CF]2 z F/2A/2',
        '[B,DFB]2 [DFBd]2 [FBdf]4',
      ],
      lh: [
        'B,,,F,, B,,F,, B,,,F,, B,,F,,', 'F,,C, F,C, B,,,F,, B,,F,,', 'E,,B,, E,B,, E,,B,, E,B,,', 'F,,C, F,C, E,C, A,,F,,',
        'B,,,F,, B,,F,, [B,,,B,,]4',
      ],
    },
    hard: {
      rh: [
        '!f! [FBdf]2 [Fdf][Fdf] [Bdfb]2 f/2g/2a/2b/2', '[cfac\']2 [cac\'][cac\'] [dfbd\']2 [Bdfb]2', '!mf! [egbe\']2 [dgbd\']2 [cegc\']2 [Begb]2', '[cfac\']4 [FAcf]2 c/2f/2g/2a/2',
        '!f! [Bdfb]2 [dfbd\']2 [fbd\'f\']4',
      ],
      lh: [
        '[B,,,B,,]2 [D,F,B,]2 [F,,F,][F,,F,] [B,,,B,,]2', '[F,,F,]2 [F,A,C]2 [B,,,B,,]2 [D,F,B,]2', '[E,,E,]2 G,,B,, E,G, B,,G,,', 'F,,/2G,,/2A,,/2B,,/2 C,/2D,/2E,/2F,/2 [F,A,C]2 [F,,F,]2',
        '[B,,,B,,]2 [D,,D,]2 [F,,F,][F,,F,] [B,,,B,,]2',
      ],
    },
  },
  // Phoenix Fire (show tune), A minor
  'show:bg-volcano': {
    medium: {
      rh: [
        'z4 ecAE', '!mf! [CEA]3 E [CEA]B [EAc]2', '[DGB]3 G [DGB]c [GBd]2', '[FAc]2 [DFB]2 [EA]2 [E^G]B',
        '!f! [CEA]2 [EAce]2 [Acea]4',
      ],
      lh: [
        '!mp! [A,,A,]2 [A,,A,]2 [A,,A,]2 [A,,A,][A,,A,]', 'A,,E,A,E, A,,E,A,E,', 'G,,D,G,D, G,,D,G,D,', 'F,,C,F,C, E,,B,,E,B,,',
        'A,,E,A,E, [A,,E,A,]4',
      ],
    },
    hard: {
      rh: [
        'z!mp![CEA] z[EAc] z[Ace] [ce][ea]', '!mf! [Acea]2 [Ac]e [Acea]2 [ceac\']2', '[Bdgb]2 [Bd]g [Bdgb]2 [dgbd\']2', '!f! [cfac\']2 [Bdfb]2 [Aea]2 [^GBe^g]2',
        '[Acea]2 [eac\'e\']2 [ac\'e\'a\']4',
      ],
      lh: [
        '[A,,A,]2 [E,,E,]2 [A,,A,]2 [E,,E,][E,,E,]', 'A,,E,A,C ECA,E,', 'G,,D,G,B, DB,G,D,', 'F,,F, C,F, E,,E, B,,E,',
        'A,,E, A,C [A,,E,A,]2 [A,,,A,,]2',
      ],
    },
  },
  // Rain Dance (show tune), D dorian
  'show:bg-rainforest': {
    medium: {
      rh: [
        'z2 [DFA]2 z ABc', '[FAd]2 [Af]g [dfa]2 [dg]f', '[GBe]2 [Bg]a [egb]2 ag', '[cea]c\' ag [cf]g [Gce]2',
        '!f! [FAd]2 [dfa]2 [dfad\']4',
      ],
      lh: [
        '!mf! D,,D,A,,D, D,,D,A,,D,', 'D,,D,A,,D, D,,D,A,,D,', 'E,,E,B,,E, E,,E,B,,E,', 'C,,C,G,,C, C,,C,G,,C,',
        'D,,D,A,,D, [D,,A,,D,]4',
      ],
    },
    hard: {
      rh: [
        'z2 .[dfa]2 .[Adf]A Bc', '[DFAd]2 [Ff][Gg] [Adfa]2 [Gg][Ff]', '[EGBe]2 [Gg][Aa] [Begb]2 [Aa][Gg]', '[cea]c\' [ca][eg] [cf]g [Gce]2',
        '!f! [DFAd]2 [Adfa]2 [dfad\']4',
      ],
      lh: [
        '!mf! [D,,D,]2 A,,[D,F,A,] [A,,A,]2 [F,A,D]2', '[D,,D,]2 A,,[D,F,A,] [A,,A,]2 [F,A,D]2', '[E,,E,]2 B,,[E,G,B,] [B,,B,]2 [G,B,E]2', '[C,,C,]2 G,,[C,E,G,] [G,,G,]2 [E,G,C]2',
        '[D,,D,]2 [F,A,D]2 [D,,A,,D,]4',
      ],
    },
  },
  // Rainbow Slide (show tune), G major
  'show:bg-rainbow': {
    medium: {
      rh: [
        '!mf! DGB[Gd] [DB]GB[Gd]', '[Gce]2 dB [Ec]2 [CA]2', 'BGB[Gd] [Bdg]2 [Ge]2', '!f! [Dd]2 [Cc]2 [B,B]2 [A,A]2',
        'GBdg- [GBdg]4',
      ],
      lh: [
        'G,,D,G,G,, D,G,D,G,', 'C,E,G,C, E,G,E,G,', 'G,,D,G,G,, D,G,D,G,', 'D,,A,,D,D,, A,,D,A,,D,',
        'G,,D,G,D, [G,,D,G,]4',
      ],
    },
    hard: {
      rh: [
        '!mf! DGB[Gd] [DB]GB[Gd]', '[Gce]2 [Bd][GB] [EGc]2 [CEA]2', 'BGB[Gd] [Bdg]2 [Ge]!f![Dd]-', '[Dd]A [Cc]A [B,B]F [A,A]F',
        'GBdg- g2 .[GBdg]2',
      ],
      lh: [
        '[G,,G,]2 [D,G,B,]2 [D,,D,]2 [D,G,B,]2', '[C,,C,]2 [E,,E,]2 [G,,G,]2 [A,,A,]2', '[G,,G,]3 [D,G,B,]- [D,G,B,]2 [E,,E,]2', '[D,,D,]2 [E,,E,]2 [F,,F,]2 [D,,D,]2',
        'G,D,B,,G,, z[D,G,B,] .[G,,G,]2',
      ],
    },
  },
  // Ghost Ship Shanty (show tune), D minor
  'show:bg-sunset': {
    medium: {
      rh: [
        '!mp! [FAd]2 A[Ad] [Adf]2 [Ae][Ad]', '[EGc]2 G[Gc] [Gce]2 [Gd][Gc]', '[DFB]2 [Bd][Bf] [Bfa]2 [Bg][Bf]', '!f! [^cea]2 [Ac][Ae] [cea]2 z/2a/2b/2^c\'/2',
        '[ad\']2 [dfa]2 [DFAd]4',
      ],
      lh: [
        'D,,A,,D,D,, A,,D,D,,A,,', 'C,,G,,C,C,, G,,C,C,,G,,', 'B,,F,B,B,, F,B,B,,F,', 'A,,E,A,A,, E,A,A,,E,',
        'D,2 A,,2 [D,,A,,D,]4',
      ],
    },
    hard: {
      rh: [
        '!mp! [FAd]2 [FA][FAd] [Adf]2 [Ae][FAd]', '[EGc]2 [EG][EGc] [Gce]2 [Gd][EGc]', '!mf! [DFB]2 [FBd][Bdf] [dfa]2 [dg][Bdf]', '!f! [A^cea]2 c[Ae] [Acea]2 g/2a/2b/2^c\'/2',
        '[dfad\']2 [Adfa]2 [DFAd]4',
      ],
      lh: [
        '[D,,D,]2 [F,A,]D A,,2 [F,A,D]2', '[C,,C,]2 [E,G,]C G,,2 [E,G,C]2', '[B,,,B,,]2 [F,B,]D F,,2 [F,B,D]2', '[A,,A,]2 [E,A,^C]2 [E,,E,]2 [G,A,C]2',
        '[D,D]2 [A,,A,]2 [D,,A,,D,]4',
      ],
    },
  },
  // The Kraken Wakes (show tune), E minor
  'show:bg-ocean': {
    medium: {
      rh: [
        '!p! [B,E]3 [EG]- [EG]2 [GB]2', '[Ec]3 [GB]- [GB]2 [EG]2', '!mp! [B,E]3 [EG]- [EG]2 [GB]2', '!mf! [F^d]3 [df]- [df]2 [fb]2',
        '!f! [GBe]2 B/2e/2g/2b/2 [gbe\']4',
      ],
      lh: [
        'E,,E, E,,E, E,,E, D,,D,', 'C,,C, C,,C, C,,C, D,,D,', 'E,,E, E,,E, D,,D, C,,C,', 'B,,,B,, B,,,B,, B,,,B,, ^D,,^D,',
        'E,,E, E,,E, [E,,B,,E,]4',
      ],
    },
    hard: {
      rh: [
        '!p! [B,E]2 B,[B,EG]- [B,EG]E [EGB]2', '[EGc]2 G[EGB]- [EGB]E [CEG]2', '!mp! [G,B,E]2 B,[B,EG]- [B,EG]E [EGB]2', '!mf! [FB^d]2 [FBd][Bdf]- [Bdf][Bdf] [dfb]2',
        '!f! [EGBe]2 B/2e/2g/2b/2 [egbe\']4',
      ],
      lh: [
        'E,,B,,E,G, E,B,,G,,B,,', 'C,,G,,C,E, C,G,,E,,G,,', 'E,,B,,E,G, D,,D, C,,C,', 'B,,,B,, ^D,,^D, F,,F, B,,B,',
        '[E,,E,]2 [B,,,B,,]2 [E,,B,,E,]4',
      ],
    },
  },
  // Moon Worm Coaster (show tune), G major
  'show:bg-space': {
    medium: {
      rh: [
        '!mf! GBdg [Bf]dBA', 'GBdg [da]gfe', '[Gc]e[cg]e dfaf', '[Bdg]2 [Bd]2 [GB]2 [DG]2',
        'GBdg- [GBdg]4',
      ],
      lh: [
        'G,,D,G,D, G,,D,G,D,', 'G,,D,G,D, B,,D,G,D,', 'C,G,E,G, D,A,F,A,', 'G,D,B,,D, G,,A,,B,,D,',
        'G,D,B,,G,, [G,,D,G,]4',
      ],
    },
    hard: {
      rh: [
        '!mf! GBdg [Bf]dBA', 'GBdg [da]gfe', '[Gc]e[cg]e [Ad]f[da]f', '!f! [Bdg]2 [GBd]2 [DGB]2 [B,DG]2',
        'GBdg- [GBdg]2 [GBdg]2',
      ],
      lh: [
        'G,,G, [D,G,B,]2 D,,D, [D,G,B,]2', 'G,,G, [D,G,B,]2 F,E, D,C,', '[C,G,]2 [G,CE]2 [D,A,]2 [F,A,D]2', 'G,,A,,B,,C, D,E,G,D,',
        'G,,B,,D,G, [D,G,B,]2 [G,,G,]2',
      ],
    },
  },
  // Great Oak Lights (show tune), C major
  'show:bg-meadow': {
    medium: {
      rh: [
        '!mp! [Ec]GeG [Ec]GeG', '[Fd]AfA [Fd]AfA', '!mf! [Ge]cgc [ce]2 [Gd][Ec]', '[DB]GdG [GB]2 [Gc][Bd]',
        '!f! [EGc]2 [ceg]2 [egc\']4',
      ],
      lh: [
        'C,E,G,E, C,E,G,E,', 'D,F,A,F, D,F,A,F,', 'C,G,E,G, C,G,E,G,', 'G,,D,B,,D, G,,G,,A,,B,,',
        'C,G,E,G, [C,,C,]4',
      ],
    },
    hard: {
      rh: [
        '!mp! [Ec]G[ce]G [Ec]G[ce]G', '[Fd]A[df]A [Fd]A[df]A', '!mf! [Ge]c[eg]c [Gce]2 [Gd][Ec]', '[DB]G[Bd]G [DGB]2 [Gc][Bd]',
        '!f! [EGc]2 [Gceg]2 [cegc\']4',
      ],
      lh: [
        'C,,2 [E,G,C]2 G,,2 [E,G,C]2', 'D,,2 [F,A,D]2 A,,2 [F,A,D]2', '[C,,C,]2 z[E,G,C] C,B,, A,,2', '[G,,G,]2 [D,G,B,]2 [G,,G,]2 [A,,A,][B,,B,]',
        '[C,,C,]2 [G,,G,]2 [C,,C,]G,, [C,,C,]2',
      ],
    },
  },
};
