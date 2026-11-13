// "Teach me your piano": what the Note-o-Matic learns when a key is played alone.
//
// Every piano sounds its own way, and the tablet hears it from where it stands. When one key
// is struck by itself, everything in the picture (listener.js) belongs to that key: where its
// overtones really sit (how the string is tuned, and how stretched it is) and how strong each
// one is. That picture, kept per key, is a fingerprint the listener uses in place of its
// guess (listener.js, taughtKey).
//
// Here: finding the strikes in a run of single keys, saying which key a strike was (so a
// picture is never kept under the wrong key), and making the picture. Pure arithmetic: no
// DOM and no sound, so it runs in Node (the tests) as well as on the page.

import { SETTINGS, prepare, spectrogram, stretchOf } from './listener.js';

export const TEACH = {
  ringFrom: 6, ringTo: 60, // looks after the strike that make a key's picture (60 to 600 ms)
  least: 30, // a strike needs this many looks of ringing after it (less in the top octaves, see leastFor)
  gap: 45, // looks between two strikes
  flux: 0.12, // a strike is a jump of at least this much of the run's biggest jumps
  stands: 3, // an overtone counts when it stands this far out of the picture near it
  wide: 16, // ... measured against this many bins on each side
  fitFrom: 4, // overtones can be told apart when they are this many bins from each other
  mostCents: 60, // a string is never further than this from where it should be
  sure: 1.25, // which key was it: another key must fit this many times better than the expected one to say "that was another key"
  share: 0.62, shareTo: 84, shareTop: 0.2, // ... and a key's own lines are this much of all the lines in the picture (from key shareTo up, where a string draws few lines: shareTop)
  tone: 4, // a strike is a string when its overtones stand this far out (as listener.js toneOf)
  quiet: 0.004, // a snippet whose loudest sample is under this holds nothing
  // hearing keys as they are played (keyEar)
  jump: 2.5, // a strike: the sound is suddenly this many times louder than just before
  floor: 0.003, // ... and at least this loud (the microphone's own scale, 0 to 1)
  apart: 0.25, // seconds: nothing nearer than this to the strike before it is a strike of its own
  lead: 0.2, // seconds of sound kept from before a strike
  rumble: 100, // Hz: what is under this is not listened to when looking for strikes
};

const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);

/** The frames where a key is struck in a picture of single notes: where the whole picture jumps up. */
export function strikesIn(spec, T_ = TEACH) {
  const { V, T, K } = spec;
  const flux = new Float32Array(T);
  for (let t = 2; t < T; t += 1) {
    let s = 0;
    for (let b = 3; b < K; b += 1) { const d = V[t * K + b] - V[(t - 2) * K + b]; if (d > 0) s += d; }
    flux[t] = s;
  }
  const top = Float32Array.from(flux).sort()[Math.floor(0.995 * (T - 1))] || 0;
  const out = [];
  if (!(top > 0)) return out;
  for (let t = 3; t < T - 3; t += 1) {
    if (flux[t] < T_.flux * top) continue;
    let peak = true;
    for (let u = Math.max(0, t - 6); u <= Math.min(T - 1, t + 6); u += 1) if (flux[u] > flux[t]) peak = false;
    if (!peak) continue;
    const last = out[out.length - 1];
    if (out.length && t - last < T_.gap) { if (flux[t] > flux[last]) out[out.length - 1] = t; continue; }
    out.push(t);
  }
  return out;
}

/** The picture of what rings after a strike at look t0 (until look t1 at most): the mean of the looks, adding up to 1. */
export function ringPicture(spec, t0, t1 = Infinity, T_ = TEACH) {
  const { V, T, K } = spec;
  const from = Math.min(T - 1, t0 + T_.ringFrom);
  const to = Math.max(from, Math.min(T - 1, t1, t0 + T_.ringTo));
  const pic = new Float32Array(K);
  for (let t = from; t <= to; t += 1) for (let b = 0; b < K; b += 1) pic[b] += V[t * K + b];
  let sum = 0;
  for (let b = 0; b < K; b += 1) sum += pic[b];
  if (sum > 0) for (let b = 0; b < K; b += 1) pic[b] /= sum;
  return pic;
}

// the low ground near bin c: what 1 in 5 of the bins around it stay under
function groundAt(pic, c, wide) {
  const near = [];
  for (let b = Math.max(1, c - wide); b <= Math.min(pic.length - 1, c + wide); b += 1) near.push(pic[b]);
  near.sort((x, y) => x - y);
  return near[Math.floor(0.2 * (near.length - 1))] + 1e-12;
}

/**
 * The overtones of a string in a picture: for a string at f0 (Hz) stretched by B, each
 * overtone that can be seen as { k, f (Hz, where its peak really is), h (its height), stands }.
 * `reach` is how far (as a fraction of its pitch) a peak may sit from where it should.
 */
export function overtones(pic, df, f0, B, { reach = 0.02, S = SETTINGS, T_ = TEACH, most = S.maxPartials } = {}) {
  const K = pic.length;
  const g = 1 / S.gamma;
  const out = [];
  for (let k = 1; k <= most; k += 1) {
    const fk = k * f0 * Math.sqrt(1 + B * k * k);
    const c = fk / df;
    if (c > K - 3 || fk > S.fmax) break;
    if (c < 2 || fk < S.highpass) continue;
    // never further than half the way to the next overtone
    const half = Math.max(1, Math.min(c * reach, (0.5 * f0) / df));
    let best = -1;
    for (let b = Math.max(2, Math.ceil(c - half)); b <= Math.min(K - 3, Math.floor(c + half)); b += 1) {
      if (pic[b] >= pic[b - 1] && pic[b] >= pic[b + 1] && (best < 0 || pic[b] > pic[best])) best = b;
    }
    if (best < 0) continue;
    const stands = pic[best] / groundAt(pic, best, T_.wide);
    if (stands < T_.stands) continue;
    const l = Math.log(pic[best - 1] ** g + 1e-12); const m = Math.log(pic[best] ** g + 1e-12); const r = Math.log(pic[best + 1] ** g + 1e-12);
    const den = l - 2 * m + r;
    const d = den < 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (l - r)) / den)) : 0;
    out.push({ k, f: (best + d) * df, h: pic[best], stands });
  }
  return out;
}

/**
 * Where a key's string really is on this piano: { cents (from concert pitch), B (its stretch),
 * seen (overtones found) }. Low strings, whose overtones run into each other in the picture,
 * keep the usual stretch and pitch.
 */
export function fitString(pic, df, midi, { S = SETTINGS, T_ = TEACH } = {}) {
  let f0 = hz(midi); let B = stretchOf(midi);
  let seen = 0;
  if (f0 / df < T_.fitFrom) return { cents: 0, B, seen };
  for (let pass = 0; pass < 3; pass += 1) {
    const pts = overtones(pic, df, f0, B, { reach: pass === 0 ? 0.028 : 0.012, S, T_ });
    seen = pts.length;
    if (!pts.length) break;
    // (f / k)^2 = f0^2 + f0^2 B k^2: a line in k^2
    let sw = 0; let sx = 0; let sy = 0; let sxx = 0; let sxy = 0;
    for (const p of pts) { const x = p.k * p.k; const y = (p.f / p.k) ** 2; const w = p.h; sw += w; sx += w * x; sy += w * y; sxx += w * x * x; sxy += w * x * y; }
    const den = sw * sxx - sx * sx;
    let nf = 0; let nB = B;
    if (pts.length >= 3 && den > 1e-9 * sw * sxx) {
      const slope = (sw * sxy - sx * sy) / den;
      const at0 = (sy - slope * sx) / sw;
      if (at0 > 0) { nf = Math.sqrt(at0); nB = slope / at0; }
    }
    const usual = stretchOf(midi);
    if (!(nf > 0) || !(nB > usual / 8) || !(nB < usual * 8)) {
      // the stretch can't be told: keep it, and take the pitch alone
      nB = B;
      let s = 0;
      for (const p of pts) s += p.h * (p.f / (p.k * Math.sqrt(1 + B * p.k * p.k)));
      nf = s / sw;
    }
    const most = 2 ** (T_.mostCents / 1200);
    f0 = Math.max(hz(midi) / most, Math.min(hz(midi) * most, nf));
    B = nB;
  }
  return { cents: 1200 * Math.log2(f0 / hz(midi)), B, seen };
}

/**
 * How well a picture fits a string at key `midi`: what its overtones hold of the whole
 * picture, less what a string an octave higher would explain just as well (a key's octave
 * shares every second overtone, so the odd ones are what tells them apart).
 * { fit, odd, tone }.
 */
export function fitOf(pic, df, midi, { S = SETTINGS, T_ = TEACH } = {}) {
  const pts = overtones(pic, df, hz(midi), stretchOf(midi), { reach: 0.028, S, T_, most: 12 });
  let all = 0; let odd = 0;
  for (const p of pts) { all += p.h; if (p.k % 2 === 1) odd += p.h; }
  const best = pts.map((p) => p.stands).sort((x, y) => y - x).slice(0, 3);
  const tone = best.length ? Math.exp(best.reduce((s, v) => s + Math.log(v), 0) / best.length) : 0;
  return { fit: all, odd, tone, seen: pts.length, low: pts.some((p) => p.k <= 2) };
}

/**
 * Which key was struck, when `expected` is the key that was asked for: the expected key, or
 * another key when that one fits the picture clearly better.
 * { midi, sure (false: nothing fits well, no string to be heard), fits }.
 */
export function whichKey(pic, df, expected, { S = SETTINGS, T_ = TEACH, lo = S.lo, hi = S.hi } = {}) {
  let best = null;
  const score = (m) => {
    const f = fitOf(pic, df, m, { S, T_ });
    // A string an octave or more under the struck one "has" all its overtones as some of its
    // own. Only its odd overtones say it is really there.
    const low = hz(m) / df < T_.fitFrom; // (too low to see overtones apart: the whole comb counts)
    return { midi: m, ...f, score: low ? f.fit : Math.min(f.fit, 2.2 * f.odd) };
  };
  // all the lines in the picture, to see how much of them a key's own lines are
  let lines = 0;
  for (let b = 2; b < pic.length - 2; b += 1) {
    if (b * df < S.highpass || b * df > S.fmax) continue;
    if (pic[b] >= pic[b - 1] && pic[b] > pic[b + 1] && pic[b] / groundAt(pic, b, T_.wide) >= T_.stands) lines += pic[b];
  }
  // A key is heard for sure when it draws a string's lines, one of its two lowest among them
  // (a key a twelfth higher draws only every third of them), and they are most of what is
  // in the picture.
  const clear = (s) => {
    s.share = lines > 0 ? s.fit / lines : 0;
    return s.tone >= T_.tone && s.low && s.share >= (s.midi >= T_.shareTo ? T_.shareTop : T_.share);
  };
  const mine = score(expected);
  const sure = clear(mine);
  for (let m = lo; m <= hi; m += 1) {
    // (a string too low to see its overtones apart "fits" anything: it is never the answer)
    if (m === expected || hz(m) / df < T_.fitFrom) continue;
    const s = score(m);
    if ((!best || s.score > best.score) && clear(s)) best = s;
  }
  if (best && best.score > T_.sure * mine.score) return { midi: best.midi, sure: true, mine, best };
  return { midi: expected, sure, mine, best };
}

/**
 * What one key taught: { pic (Float32Array, adds up to 1), cents, B } for the store, with
 * `tone` and `seen` to judge it by.
 */
export function learnKey(spec, t0, t1, midi, { S = SETTINGS, T_ = TEACH } = {}) {
  const pic = ringPicture(spec, t0, t1, T_);
  const { cents, B, seen } = fitString(pic, spec.df, midi, { S, T_ });
  return { pic, cents, B, seen };
}

/** A fresh, empty piano: nothing taught yet. Pictures are on bins `df` Hz apart. */
export function emptyPiano(df) {
  return { v: 1, df, gamma: SETTINGS.gamma, keys: {} };
}

/** A picture on bins `from` Hz apart, moved to bins `to` Hz apart (n of them). */
export function rebin(pic, from, to, n) {
  if (from === to && pic.length === n) return pic;
  const out = new Float32Array(n);
  let sum = 0;
  for (let b = 0; b < n; b += 1) {
    const x = (b * to) / from; const i = Math.floor(x);
    if (i + 1 >= pic.length) break;
    out[b] = pic[i] + (x - i) * (pic[i + 1] - pic[i]);
    sum += out[b];
  }
  if (sum > 0) for (let b = 0; b < n; b += 1) out[b] /= sum;
  return out;
}

/**
 * Put what a key taught into a piano. `again`: the key is taught once more and both
 * pictures count (their middle); without it the new picture takes the old one's place.
 * `learned.df` is the bin width of its picture when that is not the piano's own.
 */
export function addKey(piano, midi, learned, { again = false } = {}) {
  const n0 = Object.values(piano.keys)[0]?.pic.length || learned.pic.length;
  if ((learned.df && learned.df !== piano.df) || learned.pic.length !== n0) learned = { ...learned, pic: rebin(learned.pic, learned.df || piano.df, piano.df, n0) };
  const was = again ? piano.keys[midi] : null;
  if (was && was.pic.length === learned.pic.length) {
    const n = was.n || 1;
    const pic = Float32Array.from(learned.pic, (v, b) => (was.pic[b] * n + v) / (n + 1));
    piano.keys[midi] = { pic, cents: (was.cents * n + learned.cents) / (n + 1), B: Math.exp((Math.log(was.B) * n + Math.log(learned.B)) / (n + 1)), n: n + 1 };
  } else {
    piano.keys[midi] = { pic: learned.pic, cents: learned.cents, B: learned.B, n: 1 };
  }
  return piano;
}

/**
 * Teach from one recording of single keys played in order (`midis`, one strike each). Returns
 * { piano, strikes, ok }: ok is false when the number of strikes is not the number of keys.
 * `cutEnd` seconds at the end are not looked at (the tap on Stop).
 */
export function teachRun(samples, rate, midis, { piano = null, S = SETTINGS, T_ = TEACH, cutEnd = 0 } = {}) {
  const ready = prepare(samples, rate, S);
  const spec = spectrogram(ready.samples, ready.rate, S);
  let strikes = strikesIn(spec, T_);
  if (cutEnd > 0) strikes = strikes.filter((t) => t < spec.T - cutEnd / S.hopSec);
  const out = piano || emptyPiano(spec.df);
  if (strikes.length !== midis.length) return { piano: out, strikes, ok: false, spec };
  strikes.forEach((t0, i) => {
    const t1 = i + 1 < strikes.length ? strikes[i + 1] - 8 : spec.T - 1;
    addKey(out, midis[i], learnKey(spec, t0, t1, midis[i], { S, T_ }), { again: true });
  });
  return { piano: out, strikes, ok: true, spec };
}

/**
 * Ears for the game: sound comes in block by block (push), and each time a key is struck and
 * has rung for a moment, what it was comes out. `expect(midi)` says which key is waited for.
 *
 * push(samples) returns what happened in that block, in order:
 *   { type: 'strike' }                 a strike was just heard (it is still ringing)
 *   { type: 'key', midi, learned }     it was the expected key: `learned` is for addKey
 *   { type: 'other', midi }            it was clearly another key
 *   { type: 'unclear' }                a strike, but no string could be made out
 *   { type: 'fast' }                   the next key came before this one had rung enough
 * Every answer has `peak` (how loud, 0 to 1) and `at` (seconds since the ear began).
 */
export function keyEar(rate, { S = SETTINGS, T_ = TEACH } = {}) {
  const hop = Math.max(1, Math.round(rate / 100));
  const size = Math.round(3 * rate);
  const buf = new Float32Array(size); // the last three seconds
  let n = 0; // samples heard so far
  const env = []; // loudness of each 10 ms: { at (its first sample), v }
  let acc = 0; let accN = 0; let hpX = 0; let hpY = 0;
  const hpA = Math.exp((-2 * Math.PI * T_.rumble) / rate);
  let lastStrike = -Infinity;
  const waiting = []; // strikes not yet answered: { at, next (the strike after it, or null) }
  let expected = null;
  const ringFor = Math.round((T_.ringTo * S.hopSec + 0.05) * rate); // how long a strike is left to ring
  const lead = Math.round(T_.lead * rate);

  const cut = (from, to) => {
    const out = new Float32Array(to - from);
    for (let i = from; i < to; i += 1) out[i - from] = i >= 0 && i > n - size - 1 && i < n ? buf[i % size] : 0;
    return out;
  };

  function answer(w) {
    const end = w.next === null ? w.at + ringFor : Math.min(w.at + ringFor, w.next);
    const snip = cut(w.at - lead, end);
    let peak = 0;
    for (let i = 0; i < snip.length; i += 1) { const a = Math.abs(snip[i]); if (a > peak) peak = a; }
    const base = { peak, at: w.at / rate };
    // (the key that is waited for now, when the strike has rung: the answer to the strike before it has been given by then)
    const want = expected;
    if (want === null || peak < T_.quiet) return { type: 'unclear', ...base };
    const ready = prepare(snip, rate, S);
    if (ready.samples.length < S.win) return { type: 'fast', ...base };
    const spec = spectrogram(ready.samples, ready.rate, S);
    const t0 = Math.round(T_.lead / S.hopSec);
    // (the last looks of the snippet hang over its end: they are not part of the ring)
    const t1 = Math.min(spec.T - 1 - Math.ceil(S.win / (2 * spec.hop)), w.next === null ? Infinity : Math.round((w.next - w.at) / rate / S.hopSec) + t0 - 8);
    if (t1 - t0 < T_.least) return { type: 'fast', ...base };
    const pic = ringPicture(spec, t0, t1, T_);
    const which = whichKey(pic, spec.df, want, { S, T_ });
    if (!which.sure) return { type: 'unclear', ...base };
    if (which.midi !== want) return { type: 'other', midi: which.midi, ...base };
    const { cents, B } = fitString(pic, spec.df, want, { S, T_ });
    return { type: 'key', midi: want, learned: { pic, cents, B, df: spec.df }, ...base };
  }

  return {
    /** The key that is waited for from now on (null: none, strikes are only counted). */
    expect(midi) { expected = midi; },
    get heard() { return n / rate; },
    push(samples) {
      const out = [];
      for (let i = 0; i < samples.length; i += 1) {
        const x = samples[i];
        buf[n % size] = x;
        // loudness with the rumble taken out
        const y = hpA * (hpY + x - hpX); hpX = x; hpY = y;
        acc += y * y; accN += 1; n += 1;
        if (accN < hop) continue;
        const v = Math.sqrt(acc / accN);
        env.push({ at: n - accN, v });
        acc = 0; accN = 0;
        if (env.length > 40) env.shift();
        if (env.length >= 8) {
          const e = env.length - 1;
          const before = [];
          for (let j = Math.max(0, e - 8); j <= e - 2; j += 1) before.push(env[j].v);
          before.sort((a, b) => a - b);
          const was = before[before.length >> 1];
          if (v >= T_.floor && v >= T_.jump * was && env[e].at - lastStrike >= T_.apart * rate) {
            // the strike began a little before it was this loud
            const at = env[e - 1].at;
            lastStrike = at;
            const last = waiting[waiting.length - 1];
            if (last && last.next === null) last.next = at;
            waiting.push({ at, next: null });
            out.push({ type: 'strike', at: at / rate });
          }
        }
        // a strike is answered when it has rung long enough, or as soon as the next one came
        while (waiting.length && (waiting[0].next !== null || n >= waiting[0].at + ringFor)) out.push(answer(waiting.shift()));
      }
      return out;
    },
  };
}
