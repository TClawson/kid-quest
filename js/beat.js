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
//  - each note counts by its strength (onsets.js): an accent, a chord or a bass note moves
//    the guesses more than a soft passing note (the square root of how much stronger
//    than usual, between 0.3 and 2 times);
//  - told whether the piano is still sounding, it keeps dancing through a held note (up
//    to 4 beats) and stops within about half a beat once the piano goes quiet;
//  - when the kid starts again after a stop, most guesses keep the tempo they had and
//    only line the beat up with the new start.
// Tested on made-up kid practice (test/bench/kid-pieces.mjs), MAESTRO concert recordings
// with marked beats, and clips from the tablet; see test/bench/beats.mjs.
// About 0.15 ms of work per note, so it is light enough to run all through practice.

export const BEAT = {
  particles: 300,
  minBpm: 45, maxBpm: 200,
  preferBpm: 100, preferOctaves: 1,   // most people feel a beat near 100 bpm
  tempoDrift: 0.04,                  // per beat: how much a guess's tempo may wander
  phaseDrift: 0.02,                  // per beat, as a share of a beat
  spread: 0.07,                      // how close to a beat a note lands, as a share of a beat
  onBeat: 0.5, half: 0.2, quarter: 0.12, free: 0.18,   // where notes land
  rest: 0.6,                         // a beat that passes with no note (rests and long notes happen)
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
  chord: 80,                         // ms: notes this close are one chord
  stop: 2500,                        // ms of silence (or 3 beats) that ends the beat
  tail: 2.5, tailMs: 1500,           // keep dancing up to 2.5 beats (but at most ~1.5 s) after the last note
  late: 60,                          // ms: a beat noticed later than this is skipped, not danced late
  salience: 0.5,                     // how much a note's strength counts (0: every note the same)
  minWeight: 0.3, maxWeight: 2,      // a weak note still counts this much, a strong one at most this
  keepTempo: 0.7,                    // after a stop, share of guesses that keep their tempo
  // when told whether the piano is still sounding (beats(now, sounding)):
  heldTail: 4, heldMs: 4000,         // while it sounds (a held note), keep dancing this many beats after the last note
  quietTail: 0.5,                    // once it's quiet, dance at most this share of a beat more
  noteTail: 1.05,                    // ...but the next beat after a note is always danced
  quietMs: 1500,                     // a note after this much quiet is a fresh start (the tempo may be kept)
};

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
  const weights = [];          // how much each of them counts (strong notes more)
  const strengths = [];        // recent note strengths, for what "strong" means right now
  let steady = 0;              // share of the latest notes on the beat grid
  let evidence = 0;            // log evidence for a beat, older notes fading
  let last = -Infinity;        // the last note
  let est = null;              // { b, p, share }: the best guess, its next beat and how much weight agrees
  let nextBeat = null, lastBeat = -Infinity;
  let live = false;
  let lastSound = null;        // when the piano was last heard sounding (null: never told)

  const clampP = (p) => Math.min(maxP, Math.max(minP, p));
  // after the last note, keep dancing through a held note or a short rest, then stop
  const tail = (p) => (lastSound != null && tune.heldTail
    ? Math.min(tune.heldTail * p, Math.max(p * 1.1, tune.heldMs))
    : Math.min(tune.tail * p, Math.max(p * 1.1, tune.tailMs)));
  // the beat at time b is danced: there is a beat, the last note isn't long gone, and the piano
  // was still sounding a moment before (a stop is noticed within about half a beat). The beat
  // right after a note is always danced: the loudness can be wrong (a noisy room, the floor
  // creeping up through a long pedalled piece), the notes can't.
  const danceable = (b) => live && !!est && b - last < tail(est.p)
    && (lastSound == null || !tune.heldTail || b - last < tune.noteTail * est.p
      || b - Math.max(last, lastSound) < tune.quietTail * est.p);
  const preferred = (p) => Math.exp(-0.5 * (Math.log2(p / prefP) / tune.preferOctaves) ** 2);

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
    let w = 0, sp = 0, sx = 0;
    for (let i = 0; i < n; i++) {
      if (Math.abs(binOf(P[i]) - best) > 1) continue;
      const x = wrap(phaseOf(i) - centre);
      if (Math.abs(x) > 0.12) continue;
      w += W[i]; sp += W[i] * P[i]; sx += W[i] * x;
    }
    const p = sp / w;
    // the beat nearest this note
    return { p, b: t - (centre + sx / w) * p, share: w };
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
      best = Math.max(best, (hit - newest) / (all - newest) - tune.splitCost * (k - 1));
    }
    return best;
  }

  /** How much a note counts: strong notes (accents, chords, bass) more than weak ones. */
  function weightOf(strength) {
    if (!tune.salience || !(strength > 0)) return 1;
    strengths.push(strength);
    if (strengths.length > 16) strengths.shift();
    const sorted = [...strengths].sort((a, b) => a - b);
    const typical = sorted[sorted.length >> 1];
    return Math.min(tune.maxWeight, Math.max(tune.minWeight, (strength / typical) ** tune.salience));
  }

  /** A new note was heard at time t (ms), with its strength if known ({ strength }). */
  function note(t, info) {
    if (t - last < tune.chord) return;
    // a fresh start: a long time with no note, or (when we know) the piano went quiet first
    const quiet = lastSound != null && tune.heldTail
      ? t - Math.max(last, lastSound) > tune.quietMs || t - last > Math.max(tune.stop, est ? 3 * est.p : 0) * 2
      : t - last > Math.max(tune.stop, est ? 3 * est.p : 0);
    if (quiet || !notes.length) {
      // a new start: forget the old song (or, after a stop, keep its tempo)
      const keep = notes.length ? tune.keepTempo : 0;
      notes.length = 0;
      weights.length = 0;
      reset(t, keep);
    }
    const w = weightOf(info?.strength);
    last = t;
    notes.push(t);
    weights.push(w);
    if (notes.length > 8) { notes.shift(); weights.shift(); }
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
    let b = est.b;
    while (b < t - est.p * 0.2) b += est.p;
    while (b - lastBeat < est.p * 0.6) b += est.p;
    nextBeat = b;
  }

  /**
   * The beats that have come by now (ms), while there is a beat to follow. sounding: whether
   * the piano is still sounding (a held note); left out, the buddy keeps dancing a short
   * while after each note.
   */
  function beats(now, sounding) {
    if (sounding) lastSound = now;
    else if (sounding === false && lastSound == null) lastSound = -Infinity;
    const out = [];
    if (!est || nextBeat == null) return out;
    while (now >= nextBeat) {
      if (danceable(nextBeat) && now - nextBeat <= tune.late) { out.push(nextBeat); lastBeat = nextBeat; }
      nextBeat += est.p;
    }
    return out;
  }

  return {
    note,
    beats,
    /** True while there is a beat to follow (and the kid hasn't stopped). */
    following: (now) => danceable(now),
    get bpm() { return est ? Math.round(60000 / est.p) : 0; },
    /** ms between beats (0 before there is a guess). */
    get period() { return est ? est.p : 0; },
    /** Share of the latest notes on the beat (0 to 1). */
    get steady() { return steady; },
    get evidence() { return evidence; },
    get next() { return nextBeat; },
  };
}
