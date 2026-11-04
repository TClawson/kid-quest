// Beat follower: a fun metronome that follows the kid's playing instead of setting
// the beat for them. Feed it the time of each new note; it says when the next beats
// are, so the buddy can dance on them, and whether there is a beat at all.
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
  let steady = 0;              // share of the latest notes on the beat grid
  let evidence = 0;            // log evidence for a beat, older notes fading
  let last = -Infinity;        // the last note
  let est = null;              // { b, p, share }: the best guess, its next beat and how much weight agrees
  let nextBeat = null, lastBeat = -Infinity;
  let live = false;

  const clampP = (p) => Math.min(maxP, Math.max(minP, p));
  // after the last note, keep dancing through a held note or a short rest, then stop
  const tail = (p) => Math.min(tune.tail * p, Math.max(p * 1.1, tune.tailMs));
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

  function reset(t) {
    for (let i = 0; i < n; i++) { [B[i], P[i]] = freshGuess(t); W[i] = 1 / n; }
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
      let hit = 0;
      for (const t of recent) if (Math.abs(wrap((t - e.b) / sub)) * sub <= tol) hit++;
      // the newest note helped place the guess, so it doesn't count for it
      best = Math.max(best, (hit - 1) / (recent.length - 1) - tune.splitCost * (k - 1));
    }
    return best;
  }

  /** A new note was heard at time t (ms). */
  function note(t) {
    if (t - last < tune.chord) return;
    const quiet = t - last > Math.max(tune.stop, est ? 3 * est.p : 0);
    if (quiet || !notes.length) { notes.length = 0; reset(t); }   // a new start: forget the old song
    last = t;
    notes.push(t);
    if (notes.length > 8) notes.shift();
    if (notes.length < 2) return;

    // how well the best guess so far foretold this note, against "anywhere"
    if (est) {
      let b = est.b, passed = 0;
      while (b + est.p / 2 < t) { b += est.p; passed++; }
      const fit = Math.log(noteLikelihood(wrap((t - b) / est.p), tune) * tune.rest ** Math.max(0, passed - 1));
      evidence = tune.forget * evidence + Math.max(tune.stray, fit);
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
      W[i] *= l;
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

  /** The beats that have come by now (ms), while there is a beat to follow. */
  function beats(now) {
    const out = [];
    if (!est || nextBeat == null) return out;
    while (now >= nextBeat) {
      if (live && nextBeat - last < tail(est.p)) { out.push(nextBeat); lastBeat = nextBeat; }
      nextBeat += est.p;
    }
    return out;
  }

  return {
    note,
    beats,
    /** True while there is a beat to follow (and the kid hasn't stopped). */
    following: (now) => live && !!est && now - last < tail(est.p),
    get bpm() { return est ? Math.round(60000 / est.p) : 0; },
    /** ms between beats (0 before there is a guess). */
    get period() { return est ? est.p : 0; },
    /** Share of the latest notes on the beat (0 to 1). */
    get steady() { return steady; },
    get evidence() { return evidence; },
    get next() { return nextBeat; },
  };
}
