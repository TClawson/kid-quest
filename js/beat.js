// Beat follower: a fun metronome that follows the kid's playing instead of setting
// the beat for them. Feed it each new note (its time and strength); it says when the next
// beats are, so the buddy can dance on them, and whether there is a beat at all.
//
// It is a small particle filter. Each particle is one guess: "the next beat is at
// time b, and a beat lasts p ms". At each note:
//  - every guess moves forward to the beat nearest the note, drifting its tempo a
//    little for each beat it passes (kids speed up and slow down);
//  - every guess is scored by where the note fell: on a beat is likely, on a
//    half or quarter beat is fine, anywhere at all is possible (mistakes, free
//    playing). Beats that passed with no note count a little against a guess (or
//    any guess twice as fast would fit too). Good guesses get heavier; light ones
//    are dropped and heavy ones copied;
//  - a few guesses are replaced by fresh ones made from the last few notes, so a new
//    song or tempo is picked up within a few notes.
// The guess followed so far stays unless another clearly outweighs it, so the buddy
// doesn't hop between two readings of the same playing from note to note.
// Whether there is a beat, either of:
//  - most of the last few notes land near the best guess's beats, or near an even
//    split of them (halves, thirds or quarters, so a fast scale run counts);
//  - how well the best guess foretold each note, against "no beat" (notes landing
//    anywhere), older notes counting less; one stray note costs only a little.
// It leans towards dancing: a buddy dancing a little too often is fine,
// a buddy that won't dance to steady playing makes kids think they are doing badly.
// Once dancing it takes a few stray notes to stop.
// Like a person dancing along, it follows the strong notes more than every note, and
// keeps going on what it foresees:
//  - a chord rolled from the bottom up is one note, at its first sound (the sounds that
//    follow within about a tenth of a second each bring less bass, or follow a note that
//    was on the beat);
//  - each note counts by its strength (onsets.js): an accent, a chord or a bass note moves
//    the guesses more than a soft passing note (the square root of how much stronger
//    than usual, between 0.3 and 1.5 times; bass counts 4 times);
//  - told whether the piano is still sounding, it keeps dancing through a held note (up
//    to 4 beats) and stops within about a beat once the piano goes quiet;
//  - when the kid starts again after a stop, most guesses keep the tempo they had and
//    only line the beat up with the new start.
// Which beat to dance: even notes fit many beats equally well (triplets fit a beat of two
// notes as well as one of three; every other note of a left hand going low-high-low-high
// fits both ways round). The bass tells them apart: of every count of the steps the notes
// land on (every step, every 2nd, 3rd, 4th, 6th, 8th, from each starting step), the buddy
// dances the best guess's own unless another count's beats have carried clearly more bass
// than the steps between them over the last 12 seconds. A count once taken stays while
// its beats still carry more. It never dances faster than the best guess.
// Tested on made-up kid practice (test/bench/kid-pieces.mjs), MAESTRO concert recordings
// with marked beats, clips from the tablet (see test/bench/beats.mjs), and steady rolled
// chords, broken chords, triplets and sixteenths played live through the note finder.
// About 0.15 ms of work per note, so it is light enough to run all through practice.

export const BEAT = {
  particles: 300,
  minBpm: 45, maxBpm: 200,
  preferBpm: 100, preferOctaves: 1,   // most people feel a beat near 100 bpm
  tempoDrift: 0.03,                  // per beat: how much a guess's tempo may wander
  phaseDrift: 0.015,                 // per beat, as a share of a beat
  spread: 0.07,                      // how close to a beat a note lands, as a share of a beat
  onBeat: 0.5, half: 0.2, quarter: 0.12, free: 0.18,   // where notes land
  rest: 0.75,                        // a beat that passes with no note (rests and long notes happen)
  fresh: 0.08,                       // share of guesses made new from the last notes, per note
  steadyNotes: 8,                    // the last notes the beat test looks at
  splits: [1, 2, 3, 4],              // a note may land on the beat or an even split of it
  near: 0.12, nearMs: 40,            // close enough: this share of a split (at least nearMs ms)...
  nearMax: 0.25,                     // ...but never more than a quarter of a split
  splitCost: 0.03,                   // finer splits must fit a little better
  start: 0.75,                       // share of notes on the grid to start dancing
  keep: 0.55,                        // and to keep dancing
  forget: 0.85,                      // how much each older note still counts
  confident: 0.8,                    // or: evidence needed to dance (a few notes on a steady beat)
  stillConfident: -1,                // and to keep dancing
  stray: -0.7,                       // the most one note can count against the beat
  echo: 80,                          // ms: sounds this close are one note
  chord: 130, roll: 260,             // ms: a rolled chord's sounds come this close to each other, all within this long,
  rollLow: 0.8,                      // each with less bass than the first (this share of it at most)...
  rollBeat: 50,                      // ...or whatever their bass, when the first was this near a beat (ms)
  hold: 0.5,                         // the guess being followed stays while it has this share of the best one's weight
  // which count of the beat to dance (choose()):
  countMs: 12000, countBeats: 4,     // counted over the notes of this long, and at least this many beats
  countBass: 16,                     // a note marks a beat by its share of bass: log(1 + this * low / strength)
  marked: 2.2, stillMarked: 0.3,     // how clearly a count's beats must carry more bass than the rest, to take over and to stay
  pick: 1,                           // ...and how much more clearly than the count danced now (0: always dance the best guess)
  easyBpm: [70, 150], easyOctaves: 0.3,   // beats this fast are easy to dance to; outside, less and less
  stop: 2500,                        // ms of silence (or 3 beats) that ends the beat
  tail: 2.5, tailMs: 1500,           // keep dancing up to 2.5 beats (but at most ~1.5 s) after the last note
  late: 60,                          // ms: a beat noticed later than this is skipped, not danced late
  salience: 0.5,                     // how much a note's strength counts (0: every note the same)
  bass: 4,                           // how much a note's bass adds to its strength (the left hand marks the beat)
  minWeight: 0.3, maxWeight: 1.5,    // a weak note still counts this much, a strong one at most this
  keepTempo: 0.7,                    // after a stop, share of guesses that keep their tempo
  // when told whether the piano is still sounding (beats(now, sounding)):
  heldTail: 4, heldMs: 4000,         // while it sounds (a held note), keep dancing this many beats after the last note
  quietTail: 1.05,                   // once it's quiet, dance at most this share of a beat more (a chord fades before the next comes)
  noteTail: 1.05,                    // ...but the next beat after a note is always danced
  quietMs: 1500,                     // a note after this much quiet is a fresh start (the tempo may be kept)
};

const COUNTS = [1, 2, 3, 4, 6, 8];
const SQRT2PI = Math.sqrt(2 * Math.PI);
const gauss = (x, s) => Math.exp(-0.5 * (x / s) ** 2) / (s * SQRT2PI);
const wrap = (x) => x - Math.round(x);   // to [-0.5, 0.5): position relative to the nearest beat

/** How likely a note is at x (share of a beat from the nearest beat), against "no beat" (= 1). */
export function noteLikelihood(x, t = BEAT) {
  const s = t.spread;
  const half = gauss(0.5 - Math.abs(x), s);
  const quarter = (gauss(x - 0.25, s) + gauss(x + 0.25, s)) / 2;
  return t.onBeat * gauss(x, s) + t.half * half + t.quarter * quarter + t.free;
}

function normal(rng) {
  let u = 0;
  while (u === 0) u = rng();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
}

export function createBeatFollower({ tune = BEAT, rng = Math.random } = {}) {
  const n = tune.particles;
  const minP = 60000 / tune.maxBpm, maxP = 60000 / tune.minBpm, prefP = 60000 / tune.preferBpm;
  const B = new Float64Array(n), P = new Float64Array(n), W = new Float64Array(n);
  const nb = new Float64Array(n), np = new Float64Array(n);
  const notes = [];            // recent note times
  const marks = [];            // how strongly each marks a beat (strong and low notes most)
  const weights = [];          // how much each of them counts (strong notes more)
  const strengths = [];        // recent note strengths, for what "strong" means right now
  let steady = 0;              // share of the latest notes on the beat grid
  let evidence = 0;            // log evidence for a beat, older notes fading
  let last = -Infinity;        // the last note
  let est = null;              // { b, p, share }: the best guess, its next beat and how much weight agrees
  let split = 1;               // the even split of the best guess's beat that the notes land on
  let dance = null;            // { b, p }: the beat the buddy dances to (the best guess, or the count of it the strong notes mark)
  let nextBeat = null, lastBeat = -Infinity;
  let live = false;
  let rollAt = -Infinity, rollLast = -Infinity, rollLow = 0;   // the rolled chord being heard: its first and latest sound, its bass
  let lastSound = null;        // when the piano was last heard sounding (null: never told)

  const clampP = (p) => Math.min(maxP, Math.max(minP, p));
  // after the last note, keep dancing through a held note or a short rest, then stop
  const tail = (p) => (lastSound != null && tune.heldTail
    ? Math.min(tune.heldTail * p, Math.max(p * 1.1, tune.heldMs))
    : Math.min(tune.tail * p, Math.max(p * 1.1, tune.tailMs)));
  // the beat at time b is danced: there is a beat, the last note isn't long gone, and the piano
  // was still sounding a moment before (a stop is noticed within about a beat). The beat
  // right after a note is always danced: the loudness can be wrong (a noisy room, the floor
  // creeping up through a long pedalled piece), the notes can't.
  const danceable = (b) => live && !!dance && b - last < tail(dance.p)
    && (lastSound == null || !tune.heldTail || b - last < tune.noteTail * dance.p
      || b - Math.max(last, lastSound) < tune.quietTail * dance.p);
  const preferred = (p) => Math.exp(-0.5 * (Math.log2(p / prefP) / tune.preferOctaves) ** 2);

  const easyLo = 60000 / tune.easyBpm[1], easyHi = 60000 / tune.easyBpm[0];
  const easy = (p) => Math.exp(-0.5 * (Math.max(0, Math.log2(easyLo / p), Math.log2(p / easyHi)) / tune.easyOctaves) ** 2);

  /** A fresh guess from the notes: the gap from an earlier note, as 1/4 to 4 beats. */
  function freshGuess(t) {
    let p;
    const earlier = notes.length > 1 ? notes[Math.max(0, notes.length - 2 - Math.floor(rng() * Math.min(5, notes.length - 1)))] : null;
    for (let tries = 0; tries < 8 && p == null; tries++) {
      if (earlier != null && rng() < 0.85) {
        const gap = t - earlier;
        const k = [0.5, 1, 1, 2, 2, 3, 4][Math.floor(rng() * 7)];
        const c = gap / k;
        if (c >= minP && c <= maxP && rng() < preferred(c) + 0.15) p = c;
      } else {
        const c = prefP * 2 ** (normal(rng) * tune.preferOctaves);
        if (c >= minP && c <= maxP) p = c;
      }
    }
    p = clampP((p ?? prefP) * (1 + 0.02 * normal(rng)));
    // this note is on the beat (most often) or between beats
    const at = rng() < 0.75 ? 0 : 0.5;
    return [t + p * (1 - at), p];
  }

  function reset(t, keep = 0) {
    for (let i = 0; i < n; i++) {
      // after a stop, most guesses keep their tempo and start again on this note
      if (keep && rng() < keep) { P[i] = clampP(P[i] * (1 + 0.02 * normal(rng))); B[i] = t + P[i]; } else [B[i], P[i]] = freshGuess(t);
      W[i] = 1 / n;
    }
    steady = 0;
    evidence = 0;
    est = null;
    dance = null;
    nextBeat = null;
  }

  function resample() {
    let step = 1 / n, u = rng() * step, c = W[0], j = 0;
    for (let i = 0; i < n; i++) {
      while (u > c && j < n - 1) c += W[++j];
      nb[i] = B[j]; np[i] = P[j];
      u += step;
    }
    B.set(nb); P.set(np); W.fill(1 / n);
  }

  /** The heaviest group of guesses (similar tempo and beat): its tempo, next beat and weight. */
  function estimate(t) {
    const bins = 48, lo = Math.log2(minP), span = Math.log2(maxP) - lo;
    const binOf = (p) => Math.min(bins - 1, Math.floor(((Math.log2(p) - lo) / span) * bins));
    const near = (k) => (mass) => mass[k] + (mass[k - 1] || 0) + (mass[k + 1] || 0);
    const mass = new Float64Array(bins);
    for (let i = 0; i < n; i++) mass[binOf(P[i])] += W[i];
    let best = 0;
    for (let k = 1; k < bins; k++) if (near(k)(mass) > near(best)(mass)) best = k;
    // within that tempo, the heaviest place for the beat (as a share of a beat from this note)
    const phases = 20, pm = new Float64Array(phases);
    const phaseOf = (i) => (((t - B[i]) / P[i]) % 1 + 1) % 1;
    for (let i = 0; i < n; i++) if (Math.abs(binOf(P[i]) - best) <= 1) pm[Math.floor(phaseOf(i) * phases) % phases] += W[i];
    let bp = 0;
    const around = (k) => pm[k] + pm[(k + 1) % phases] + pm[(k + phases - 1) % phases];
    for (let k = 1; k < phases; k++) if (around(k) > around(bp)) bp = k;
    const centre = (bp + 0.5) / phases;
    const found = group(best, centre);
    // the guess followed so far stays unless another clearly outweighs it, so the buddy
    // doesn't hop between two readings of the same playing from note to note
    // (a small shift of the same reading is simply followed)
    const same = est && Math.abs(Math.log2(found.p / est.p)) < 0.1 && Math.abs(wrap((found.b - est.b) / est.p)) < 0.15;
    if (est && tune.hold && !same) {
      const held = group(binOf(est.p), (((t - est.b) / est.p) % 1 + 1) % 1);
      if (held && held.share >= tune.hold * found.share) return held;
    }
    return found;

    /** The guesses near tempo bin k whose beat is near `centre`: their mean tempo and beat, and weight. */
    function group(k, c) {
      let w = 0, sp = 0, sx = 0;
      for (let i = 0; i < n; i++) {
        if (Math.abs(binOf(P[i]) - k) > 1) continue;
        const x = wrap(phaseOf(i) - c);
        if (Math.abs(x) > 0.12) continue;
        w += W[i]; sp += W[i] * P[i]; sx += W[i] * x;
      }
      if (!(w > 0)) return null;
      const p = sp / w;
      // the beat nearest this note
      return { p, b: t - wrap(c + sx / w) * p, share: w };
    }
  }

  /**
   * Share of the latest notes that land near the beats of guess e, or near an even
   * split of them (the best split wins, finer ones paying a little).
   */
  function steadiness(e) {
    const recent = notes.slice(-tune.steadyNotes);
    let best = 0;
    for (const k of tune.splits) {
      const sub = e.p / k;
      const tol = Math.min(tune.nearMax * sub, Math.max(tune.near * sub, tune.nearMs));
      let hit = 0, all = 0;
      recent.forEach((t, j) => {
        const w = weights[weights.length - recent.length + j];
        all += w;
        if (Math.abs(wrap((t - e.b) / sub)) * sub <= tol) hit += w;
      });
      // the newest note helped place the guess, so it doesn't count for it
      const newest = weights[weights.length - 1];
      const share = (hit - newest) / (all - newest) - tune.splitCost * (k - 1);
      if (share > best) { best = share; split = k; }
    }
    return best;
  }

  /**
   * Which beat to dance: the guesses can't tell a beat from its half or (in threes) one and
   * a half of it, or from the same beat started a step later, since even notes fit them
   * all. The bass can: the beat is where the low notes keep landing. So take the finest
   * even step the notes land on (the best guess's beat, split), and try every count of it
   * (every step, every 2nd, 3rd... from each starting step) that is no faster than the
   * best guess. Each is scored by how much more bass its beats carried than the steps
   * between them over the last seconds (an empty beat carries none), in units of how much
   * that could differ by chance, a little less for beats too slow or fast to dance easily.
   * The best guess's own count is danced unless another is clearly marked; a count once
   * taken stays while it is still marked.
   */
  function choose(t) {
    const u = est.p / split, N = notes.length;
    const at = Math.round((t - est.b) / u);   // this note's step, counted from the guess's beat
    const idx = new Array(N);
    idx[N - 1] = at;
    let first = N - 1;
    for (let j = N - 2; j >= 0 && t - notes[j] <= tune.countMs; j--) { idx[j] = idx[j + 1] - Math.round((notes[j + 1] - notes[j]) / u); first = j; }
    const lo = idx[first], len = at - lo + 1;
    if (len > 400) return { p: est.p, b: est.b };
    const acc = new Float64Array(len).fill(-1);   // how bassy the note on each step is (-1: no note)
    let n = 0, sum = 0, sq = 0;
    for (let j = first; j < N; j++) if (idx[j] >= lo && idx[j] <= at) acc[idx[j] - lo] = Math.max(acc[idx[j] - lo], marks[j]);
    for (let i = 0; i < len; i++) if (acc[i] >= 0) { n++; sum += acc[i]; sq += acc[i] * acc[i]; }
    const sd = n ? Math.sqrt(Math.max(0, sq / n - (sum / n) ** 2)) : 0;
    if (!tune.pick || n < 8 || !(sd > 1e-6)) return { p: est.p, b: est.b };
    // how much more bass a count's beats carry than the steps between them, in units of how
    // much that could differ by chance (an empty beat carries none)
    const score = (m, c) => {
      let on = 0, onSum = 0, off = 0, offSum = 0;
      const c0 = (((c - lo) % m) + m) % m;
      for (let i = 0; i < len; i++) {
        if (i % m === c0) { on++; if (acc[i] > 0) onSum += acc[i]; } else if (acc[i] >= 0) { off++; offSum += acc[i]; }
      }
      return on < tune.countBeats || !off ? 0 : (onSum / on - offSum / off) / (sd * Math.sqrt(1 / on + 1 / off));
    };
    // the count to beat: the one danced so far if it is still on these steps and still marked,
    // else the best guess itself
    let bm = split, bc = 0, base = Math.max(0, score(bm, bc)) * easy(est.p);
    if (dance) {
      const m = Math.round(dance.p / u);
      const near = dance.b + Math.round((t - dance.b) / dance.p) * dance.p;   // its beat nearest this note
      const c = Math.round((near - est.b) / u);
      if (m >= 1 && m <= 8 && Math.abs(Math.log2((m * u) / dance.p)) < 0.1 && Math.abs((near - est.b) / u - c) < 0.4) {
        const sc = score(m, c);
        if (sc >= tune.stillMarked) { bm = m; bc = ((c % m) + m) % m; base = sc * easy(m * u); }
      }
    }
    let top = 0;
    for (const m of COUNTS) {
      const q = m * u;
      if (m < split || q < minP || q > maxP) continue;
      for (let c = 0; c < m; c++) {
        const sc = score(m, c) * easy(q);
        if (sc >= tune.marked && sc >= base + tune.pick && sc > top * 1.1) { top = sc; bm = m; bc = c; }
      }
    }
    // that count's beat nearest this note
    let i = at - (((at - bc) % bm) + bm) % bm;
    if (at - i > bm / 2) i += bm;
    return { p: bm * u, b: est.b + i * u };
  }

  /** How much a note counts: strong notes (accents, chords, bass) more than weak ones. */
  function weightOf(info) {
    let strength = info?.strength;
    if (!tune.salience || !(strength > 0)) return 1;
    strength += tune.bass * (info.low || 0);
    strengths.push(strength);
    if (strengths.length > 16) strengths.shift();
    const sorted = [...strengths].sort((a, b) => a - b);
    const typical = sorted[sorted.length >> 1];
    return Math.min(tune.maxWeight, Math.max(tune.minWeight, (strength / typical) ** tune.salience));
  }

  /** A new note was heard at time t (ms), with its strength and bass if known ({ strength, low }). */
  function note(t, info) {
    if (t - last < tune.echo) return;
    // a chord rolled from the bottom up is one note, at its first sound: the sounds right after
    // it each bring less bass than the first did. (A short note leading into a beat is the
    // other way round: the beat's note is the lower and stronger one. It stays a note.)
    // Once there is a beat, a sound right after a note that was on the beat is its chord too.
    const low = info?.low;
    if (low != null && t - rollAt < tune.roll) {
      const onBeat = dance && tune.rollBeat && Math.abs(wrap((rollAt - dance.b) / dance.p)) * dance.p < tune.rollBeat;
      if (t - rollLast < tune.chord && (onBeat || low < tune.rollLow * rollLow)) { rollLast = t; return; }
    }
    rollAt = rollLast = t;
    rollLow = low ?? 0;
    // a fresh start: a long time with no note, or (when we know) the piano went quiet first
    const quiet = lastSound != null && tune.heldTail
      ? t - Math.max(last, lastSound) > tune.quietMs || t - last > Math.max(tune.stop, dance ? 3 * dance.p : 0) * 2
      : t - last > Math.max(tune.stop, dance ? 3 * dance.p : 0);
    if (quiet || !notes.length) {
      // a new start: forget the old song (or, after a stop, keep its tempo)
      const keep = notes.length ? tune.keepTempo : 0;
      notes.length = 0;
      weights.length = 0;
      marks.length = 0;
      reset(t, keep);
    }
    const w = weightOf(info);
    last = t;
    notes.push(t);
    weights.push(w);
    marks.push(info?.strength > 0 ? Math.log1p(tune.countBass * (info.low || 0) / info.strength) : 0);
    if (notes.length > 96) { notes.shift(); weights.shift(); marks.shift(); }
    if (notes.length < 2) return;

    // how well the best guess so far foretold this note, against "anywhere"
    if (est) {
      let b = est.b, passed = 0;
      while (b + est.p / 2 < t) { b += est.p; passed++; }
      const fit = Math.log(noteLikelihood(wrap((t - b) / est.p), tune) * tune.rest ** Math.max(0, passed - 1));
      evidence = tune.forget * evidence + Math.max(tune.stray, fit) * w;
    }

    let total = 0;
    for (let i = 0; i < n; i++) {
      // move forward to the beat nearest this note, drifting a little each beat
      let passed = 0;
      while (B[i] + P[i] / 2 < t) {
        P[i] = clampP(P[i] * Math.exp(tune.tempoDrift * normal(rng)));
        B[i] += P[i] * (1 + tune.phaseDrift * normal(rng));
        passed++;
      }
      const l = noteLikelihood(wrap((t - B[i]) / P[i]), tune) * tune.rest ** Math.max(0, passed - 1)
        * (0.7 + 0.3 * preferred(P[i]));
      W[i] *= w === 1 ? l : l ** w;
      total += W[i];
    }
    let ess = 0;
    for (let i = 0; i < n; i++) { W[i] /= total; ess += W[i] * W[i]; }
    if (1 / ess < n / 2) resample();
    // a few new guesses from the latest notes, so a new song is picked up quickly
    // (they start light, and must earn their weight with the next notes)
    const k = Math.round(n * tune.fresh);
    let sum = 0;
    for (let j = 0; j < k; j++) {
      const i = Math.floor(rng() * n);
      [B[i], P[i]] = freshGuess(t);
      W[i] = 0.2 / n;
    }
    for (let i = 0; i < n; i++) sum += W[i];
    for (let i = 0; i < n; i++) W[i] /= sum;
    est = estimate(t);
    steady = steadiness(est);
    live = (notes.length >= 4 && steady >= (live ? tune.keep : tune.start))
      || (evidence >= (live ? tune.stillConfident : tune.confident) && est.share >= 0.25);
    // the next beat to dance on: after this note, and not right after the last one danced
    dance = choose(t);
    let b = dance.b;
    while (b < t - dance.p * 0.2) b += dance.p;
    while (b - lastBeat < dance.p * 0.6) b += dance.p;
    nextBeat = b;
  }

  /**
   * The beats that have come by now (ms), while there is a beat to follow. sounding: whether
   * the piano is still sounding (a held note); left out, the buddy keeps dancing a short
   * while after each note. lead (ms): hand each beat out this much early, so a move started
   * at (beat - lead) lands on the beat the kid played, after the mic, the note finder and the
   * screen have each taken their time. The beats are foretold, so this costs nothing.
   */
  function beats(now, sounding, lead = 0) {
    if (sounding) lastSound = now;
    else if (sounding === false && lastSound == null) lastSound = -Infinity;
    const out = [];
    if (!dance || nextBeat == null) return out;
    const by = now + lead;
    while (by >= nextBeat) {
      if (danceable(nextBeat) && by - nextBeat <= tune.late) { out.push(nextBeat); lastBeat = nextBeat; }
      nextBeat += dance.p;
    }
    return out;
  }

  return {
    note,
    beats,
    /** True while there is a beat to follow (and the kid hasn't stopped). */
    following: (now) => danceable(now),
    get bpm() { return dance ? Math.round(60000 / dance.p) : 0; },
    /** ms between beats (0 before there is a guess). */
    get period() { return dance ? dance.p : 0; },
    /** Share of the latest notes on the beat (0 to 1). */
    get steady() { return steady; },
    get evidence() { return evidence; },
    get next() { return nextBeat; },
  };
}
