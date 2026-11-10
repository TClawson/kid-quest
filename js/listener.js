// The Note-o-Matic's ears: which piano keys sound in a recording, and when each was struck.
//
// How it works. The recording becomes a picture of loudness over pitch and time (a
// spectrogram). Each of the 88 keys has a fingerprint: the ladder of overtones a piano string
// makes (a little stretched, as real strings are). The picture is explained as a sum of
// fingerprints, each with a loudness that changes over time, and the fingerprints are tuned to
// this very piano while doing so (how strong each overtone is, shared between neighbouring
// keys). A note starts where a key's loudness jumps up. Then a few rules take away what a real
// piano adds that is not a note: an overtone heard as a note of its own, the knock of a key
// through a tablet standing on the piano, a mistuned string heard as two keys.
//
// No trained network and nothing to download. Pure arithmetic: no DOM and no sound, so it
// runs in a Worker (listener-worker.js) and in Node (the tests).
//
//   listen(samples, rate, { clicks, progress }) -> [{ midi, on, off, vel }]   (seconds, 0-1)

import { clickWave } from './studio-audio.js';

export const SETTINGS = {
  rate: 24000, // the recording is brought to about this many samples a second first
  highpass: 80, // Hz: rumble below this is thrown away (hands on the piano, a bumped tablet)
  win: 2048, // samples in one look (85 ms)
  hopSec: 0.01,
  fmax: 5200, // Hz, the top of what is looked at
  lo: 21, hi: 108, // keys A0 to C8
  gamma: 0.7, // the picture is loudness ** gamma, so soft notes are not drowned by loud ones
  iters: 12, // rounds that only fit the loudness of each key
  itersJoint: 18, // then rounds that also tune the fingerprints
  sparse: 0.02, // a small push toward "this key is silent"
  smooth: 1, // overtone strengths are shared with this many keys on each side
  maxPartials: 24,
  prune: 0.02, // from round pruneAt on, a key under this loudness in a look (next to the loud notes) is silent there
  pruneAt: 6,
  D: 3, // looks on each side when measuring a jump
  alpha: 0.22, // a note is at least this loud, next to the loud notes of the recording
  rho: 0.2, // ... and rises by this fraction of what the key was already sounding
  jump: 1, // the jump itself must be this fraction of alpha's loudness
  minGap: 0.15, // seconds between two strikes of one key
  clear: 0.08, // ... and stands this far out of what is not piano at all (hiss, a room's hum), or it is not a note
  offFrac: 0.25, // a note ends when it falls to this fraction of its peak
  susFrom: 4, susTo: 9, // looks after the strike where the note's own loudness is read
  ghost: 3, // an overtone: a note this many times softer than a note struck with it, an overtone's distance below
  knock: 0.6, knockBelow: 58, // a key's knock: a low note that fades to under this at once (see pickNotes)
  cluster: 1, // of two neighbouring keys struck in one instant, the one this many times softer goes
  clickNear: 0.07, // seconds: a note this near a known click must keep sounding after it (see pickNotes)
  clickStay: 0.4, // ... at this fraction of its first loudness, 100 to 140 ms on
};

// ---------- getting the recording ready ----------

/** A second-order high-pass (RBJ), in place on a copy. */
function highpass(x, fc, fs) {
  const w = (2 * Math.PI * fc) / fs;
  const al = Math.sin(w) / (2 * Math.SQRT1_2);
  const c = Math.cos(w);
  const b0 = (1 + c) / 2; const b1 = -(1 + c); const b2 = (1 + c) / 2;
  const a0 = 1 + al; const a1 = -2 * c; const a2 = 1 - al;
  const y = new Float32Array(x.length);
  let x1 = 0; let x2 = 0; let y1 = 0; let y2 = 0;
  for (let i = 0; i < x.length; i += 1) {
    const v = (b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}

/** Low-pass (a windowed sinc) and keep every `factor`th sample. */
function decimate(x, fs, factor, taps = 127) {
  if (factor <= 1) return x;
  const fc = (0.45 * fs) / factor;
  const M = taps - 1;
  const h = new Float64Array(taps);
  let sum = 0;
  for (let n = 0; n < taps; n += 1) {
    const t = n - M / 2;
    const s = t === 0 ? (2 * fc) / fs : Math.sin((2 * Math.PI * fc * t) / fs) / (Math.PI * t);
    const a = (2 * Math.PI * n) / M;
    h[n] = s * (0.35875 - 0.48829 * Math.cos(a) + 0.14128 * Math.cos(2 * a) - 0.01168 * Math.cos(3 * a));
    sum += h[n];
  }
  for (let n = 0; n < taps; n += 1) h[n] /= sum;
  const out = new Float32Array(Math.floor(x.length / factor));
  for (let k = 0; k < out.length; k += 1) {
    const c = k * factor - M / 2;
    let acc = 0;
    const from = Math.max(0, -c); const to = Math.min(taps, x.length - c);
    for (let n = from; n < to; n += 1) acc += h[n] * x[c + n];
    out[k] = acc;
  }
  return out;
}

/**
 * A recording made ready for listening: rumble taken out, brought down to about 24,000
 * samples a second (the times stay the same), and as loud as it can be. { samples, rate }.
 */
export function prepare(samples, rate, S = SETTINGS) {
  const factor = Math.max(1, Math.round(rate / S.rate));
  const x = decimate(highpass(samples, S.highpass, rate), rate, factor);
  let peak = 0;
  for (let i = 0; i < x.length; i += 1) { const a = Math.abs(x[i]); if (a > peak) peak = a; }
  if (peak > 0) for (let i = 0; i < x.length; i += 1) x[i] /= peak;
  return { samples: x, rate: rate / factor };
}

// ---------- the picture ----------

function makeFft(n) {
  const cos = new Float64Array(n / 2); const sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i += 1) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
  const rev = new Uint32Array(n);
  const bits = Math.log2(n);
  for (let i = 0; i < n; i += 1) { let r = 0; for (let b = 0; b < bits; b += 1) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
  return (re, im) => {
    for (let i = 0; i < n; i += 1) { const j = rev[i]; if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; } }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1; const step = n / size;
      for (let s = 0; s < n; s += size) {
        for (let k = 0, w = 0; k < half; k += 1, w += step) {
          const a = s + k; const b = a + half;
          const xr = re[b] * cos[w] + im[b] * sin[w];
          const xi = im[b] * cos[w] - re[b] * sin[w];
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
        }
      }
    }
  };
}

/** The picture: look t is centred on sample t * hop. { V (looks x bins), T, K, df, hop }. */
export function spectrogram(samples, rate, S = SETTINGS) {
  const N = S.win; const hop = Math.round(rate * S.hopSec);
  const df = rate / N; const K = Math.min(N / 2, Math.ceil(S.fmax / df) + 3);
  const T = Math.max(1, Math.floor(samples.length / hop) + 1);
  const hann = new Float64Array(N);
  for (let i = 0; i < N; i += 1) hann[i] = 0.5 - 0.5 * Math.cos((2 * Math.PI * i) / N);
  const fft = makeFft(N);
  const re = new Float64Array(N); const im = new Float64Array(N);
  const V = new Float32Array(T * K);
  const norm = 2 / (N / 2); // a full-scale sine reads about 1 (the window's gain is one half)
  for (let t = 0; t < T; t += 1) {
    const c = t * hop - N / 2;
    for (let i = 0; i < N; i += 1) { const j = c + i; re[i] = j >= 0 && j < samples.length ? samples[j] * hann[i] : 0; im[i] = 0; }
    fft(re, im);
    for (let b = 0; b < K; b += 1) V[t * K + b] = (Math.hypot(re[b], im[b]) * norm) ** S.gamma;
  }
  return { V, T, K, df, hop };
}

/** How far the piano is from concert pitch, in cents (-50 to 50): where the strong peaks sit between keys. */
export function tuningOf(spec, S = SETTINGS) {
  const { V, T, K, df } = spec;
  let sx = 0; let sy = 0; let peakAll = 0;
  for (let i = 0; i < V.length; i += 1) if (V[i] > peakAll) peakAll = V[i];
  const b0 = Math.max(2, Math.floor(180 / df)); const b1 = Math.min(K - 2, Math.ceil(1600 / df));
  const g = 1 / S.gamma;
  for (let t = 0; t < T; t += 3) {
    const row = t * K;
    let top = 0; for (let b = b0; b < b1; b += 1) if (V[row + b] > top) top = V[row + b];
    if (top < 0.03 * peakAll) continue;
    for (let b = b0; b < b1; b += 1) {
      const v = V[row + b];
      if (v < 0.25 * top || v <= V[row + b - 1] || v < V[row + b + 1]) continue;
      const l = Math.log(V[row + b - 1] ** g + 1e-9); const c = Math.log(v ** g + 1e-9); const r = Math.log(V[row + b + 1] ** g + 1e-9);
      const d = (0.5 * (l - r)) / (l - 2 * c + r);
      const semis = 12 * Math.log2(((b + d) * df) / 440);
      const dev = semis - Math.round(semis);
      sx += v * Math.cos(2 * Math.PI * dev); sy += v * Math.sin(2 * Math.PI * dev);
    }
  }
  if (sx === 0 && sy === 0) return 0;
  return (Math.atan2(sy, sx) / (2 * Math.PI)) * 100;
}

/** How stretched the overtones of key p are (B in f_k = k f0 sqrt(1 + B k^2)), for a usual piano. */
export function stretchOf(p) {
  const treble = Math.exp(-9.6 + 0.088 * (p - 40));
  const bass = Math.exp(-9.6 - 0.07 * (p - 40));
  return p >= 40 ? treble : Math.max(treble, bass);
}

// the window's main lobe, by distance in bins from the true pitch (1 at 0, 0 at 2 bins)
function lobe(d) {
  const a = Math.abs(d);
  if (a >= 2) return 0;
  if (a < 1e-6) return 1;
  if (Math.abs(a - 1) < 1e-6) return 0.5;
  return Math.abs(Math.sin(Math.PI * a) / (Math.PI * a) / (1 - a * a));
}

/** The fingerprints: for each key, its (bin, overtone number, shape) entries and overtone strengths. */
export function fingerprints(spec, tuneCents, S = SETTINGS) {
  const { K, df } = spec;
  const keys = [];
  for (let p = S.lo; p <= S.hi; p += 1) {
    const f0 = 440 * 2 ** ((p - 69 + tuneCents / 100) / 12);
    const B = stretchOf(p);
    const bins = []; const part = []; const shape = [];
    let nPart = 0;
    for (let k = 1; k <= S.maxPartials; k += 1) {
      const fk = k * f0 * Math.sqrt(1 + B * k * k);
      if (fk > S.fmax) break;
      // its exact place is not sure: a few cents of tuning, and half of the stretch
      const unsure = Math.min(2.5, (fk * (0.003 + 0.25 * B * k * k)) / df);
      const c = fk / df;
      const from = Math.max(1, Math.ceil(c - 2 - unsure)); const to = Math.min(K - 1, Math.floor(c + 2 + unsure));
      let any = false;
      for (let b = from; b <= to; b += 1) {
        const s = lobe(Math.max(0, Math.abs(b - c) - unsure));
        if (s > 0.02) { bins.push(b); part.push(k - 1); shape.push(s); any = true; }
      }
      if (any) nPart = k;
    }
    // to start with, overtones fall away gently; the piano's real strengths are learned from the recording
    const a = new Float64Array(nPart);
    for (let k = 0; k < nPart; k += 1) a[k] = 1 / (k + 1);
    keys.push({ midi: p, f0, bins: Int32Array.from(bins), part: Int32Array.from(part), shape: Float32Array.from(shape), a, nPart, w: new Float32Array(bins.length) });
  }
  return keys;
}

function setWeights(keys) {
  for (const key of keys) {
    let sum = 0;
    for (let j = 0; j < key.bins.length; j += 1) { key.w[j] = key.a[key.part[j]] * key.shape[j]; sum += key.w[j]; }
    // every fingerprint adds up to 1
    if (sum > 0) { for (let j = 0; j < key.w.length; j += 1) key.w[j] /= sum; for (let k = 0; k < key.nPart; k += 1) key.a[k] /= sum; }
  }
}

/**
 * The shapes that soak up what is not a piano string: hiss (flat), rumble (low), sizzle
 * (high), and what each click the recording is known to hold looks like in the picture (the
 * studio's count-in clicks, `pitches` in Hz: short beeps that sit between two piano keys).
 */
function noiseShapes(spec, rate, S, pitches = []) {
  const { K } = spec;
  const shapes = [0, 1, 2].map((i) => {
    const w = new Float32Array(K);
    for (let b = 1; b < K; b += 1) w[b] = i === 0 ? 1 : i === 1 ? 1 / (1 + b / 20) : b / K;
    return w;
  });
  for (const hz of pitches) {
    if (!(hz > 0) || hz > S.fmax) continue;
    // the click itself, looked at the way the recording is: a peak with wide skirts (it is short)
    const wave = clickWave(rate, hz);
    const alone = new Float32Array(S.win * 2);
    alone.set(wave, S.win - (wave.length >> 1));
    const pic = spectrogram(alone, rate, S);
    const w = new Float32Array(K);
    for (let t = 0; t < pic.T; t += 1) for (let b = 1; b < K; b += 1) w[b] += pic.V[t * pic.K + b];
    shapes.push(w);
  }
  for (const w of shapes) { let s = 0; for (let b = 0; b < K; b += 1) s += w[b]; for (let b = 0; b < K; b += 1) w[b] /= s || 1; }
  return shapes;
}

/**
 * Explain the picture as fingerprints: H[key][look] is how loud each key is over time. Tunes
 * the fingerprints as it goes. `progress(0..1)` is called after every round.
 */
export function factor(spec, keys, S = SETTINGS, { rate = S.rate, pitches = [], progress = null } = {}) {
  const { V, T, K } = spec;
  const nK = keys.length;
  const noise = noiseShapes(spec, rate, S, pitches);
  const nN = noise.length;
  const H = new Float32Array((nK + nN) * T);
  // every loudness starts at the look's average
  for (let t = 0; t < T; t += 1) {
    let s = 0; for (let b = 0; b < K; b += 1) s += V[t * K + b];
    for (let p = 0; p < nK + nN; p += 1) H[p * T + t] = s / (nK + nN) + 1e-7;
  }
  setWeights(keys);
  const model = new Float32Array(K); const Q = new Float32Array(K);
  const acc = new Float64Array(S.maxPartials);
  const total = S.iters + S.itersJoint;
  let quiet = 1e-9; // a loudness under this is silence
  for (let it = 0; it < total; it += 1) {
    const joint = it >= S.iters;
    const numA = joint ? keys.map((k) => new Float64Array(k.nPart)) : null;
    for (let t = 0; t < T; t += 1) {
      const row = t * K;
      model.fill(1e-7);
      for (let n = 0; n < nN; n += 1) { const h = H[(nK + n) * T + t]; if (h > 0) { const w = noise[n]; for (let b = 0; b < K; b += 1) model[b] += h * w[b]; } }
      for (let p = 0; p < nK; p += 1) {
        const h = H[p * T + t]; if (h <= 0) continue;
        const { bins, w } = keys[p];
        for (let j = 0; j < bins.length; j += 1) model[bins[j]] += h * w[j];
      }
      for (let b = 0; b < K; b += 1) Q[b] = V[row + b] / model[b];
      for (let p = 0; p < nK; p += 1) {
        const h = H[p * T + t]; if (h <= 0) continue;
        const key = keys[p]; const { bins, w, part, shape } = key;
        let num = 0;
        if (joint) {
          acc.fill(0, 0, key.nPart);
          for (let j = 0; j < bins.length; j += 1) { const q = Q[bins[j]]; num += w[j] * q; acc[part[j]] += shape[j] * q; }
          const na = numA[p];
          for (let k = 0; k < key.nPart; k += 1) na[k] += h * acc[k];
        } else {
          for (let j = 0; j < bins.length; j += 1) num += w[j] * Q[bins[j]];
        }
        let v = (h * num) / (1 + S.sparse);
        if (v < quiet) v = 0;
        H[p * T + t] = v;
      }
      for (let n = 0; n < nN; n += 1) {
        const w = noise[n]; let num = 0;
        for (let b = 0; b < K; b += 1) num += w[b] * Q[b];
        H[(nK + n) * T + t] *= num;
      }
    }
    if (S.prune > 0 && it + 1 === S.pruneAt) {
      // By now it is clear where each key is next to silent, and most keys are for most of a
      // kid's tune. From here on those places are left out (they can't come back), which
      // makes the rest of the rounds several times faster.
      const tops = new Float32Array(T);
      for (let t = 0; t < T; t += 1) { let m = 0; for (let p = 0; p < nK; p += 1) if (H[p * T + t] > m) m = H[p * T + t]; tops[t] = m; }
      quiet = Math.max(quiet, S.prune * (tops.sort()[Math.floor(0.9 * (T - 1))] || 0));
    }
    if (joint) {
      // tune each key's overtone strengths, then share them with the keys next to it
      const use = new Float64Array(nK);
      for (let p = 0; p < nK; p += 1) { let s = 0; for (let t = 0; t < T; t += 1) s += H[p * T + t]; use[p] = s; }
      const fresh = keys.map((key, p) => {
        const a = Float64Array.from(key.a);
        const shapeSum = new Float64Array(key.nPart);
        for (let j = 0; j < key.bins.length; j += 1) shapeSum[key.part[j]] += key.shape[j];
        for (let k = 0; k < key.nPart; k += 1) {
          const den = use[p] * shapeSum[k];
          if (den > 0) a[k] = key.a[k] * (numA[p][k] / den);
        }
        let s = 0; for (let k = 0; k < key.nPart; k += 1) s += a[k];
        if (s > 0) for (let k = 0; k < key.nPart; k += 1) a[k] /= s;
        return a;
      });
      const maxUse = Math.max(...use) || 1;
      keys.forEach((key, p) => {
        for (let k = 0; k < key.nPart; k += 1) {
          let lw = 0; let ws = 0;
          for (let q = Math.max(0, p - S.smooth); q <= Math.min(nK - 1, p + S.smooth); q += 1) {
            if (k >= keys[q].nPart) continue;
            const wgt = (use[q] / maxUse + 0.02) / (1 + Math.abs(q - p));
            lw += wgt * Math.log(fresh[q][k] + 1e-6); ws += wgt;
          }
          if (ws > 0) key.a[k] = Math.exp(lw / ws);
        }
      });
      setWeights(keys);
    }
    if (progress) progress((it + 1) / total);
  }
  return { H, nK, nN, T };
}

/**
 * Notes from the loudness of each key over time: [{ midi, on, off, vel }], in seconds.
 * `clickTimes` (seconds, sorted) are when known clicks sound in the recording.
 */
export function pickNotes(fac, keys, spec, rate, S = SETTINGS, clickTimes = []) {
  const { H, nK, T } = fac;
  const dt = spec.hop / rate;
  const { D } = S;
  // how loud the loud notes of this recording are
  const tops = new Float64Array(T);
  for (let t = 0; t < T; t += 1) { let m = 0; for (let p = 0; p < nK; p += 1) if (H[p * T + t] > m) m = H[p * T + t]; tops[t] = m; }
  const ref = tops.slice().sort()[Math.floor(0.9 * (T - 1))] || 1e-6;
  const floor = S.alpha * ref;
  const gap = Math.max(1, Math.round(S.minGap / dt));
  const row = (p) => H.subarray(p * T, (p + 1) * T);
  const med = (h, from, to) => { const v = []; for (let u = Math.max(0, from); u <= Math.min(T - 1, to); u += 1) v.push(h[u]); v.sort((x, y) => x - y); return v.length ? v[v.length >> 1] : 0; };
  const mean = (h, from, to) => { let s = 0; let c = 0; for (let u = Math.max(0, from); u <= Math.min(T - 1, to); u += 1) { s += h[u]; c += 1; } return c ? s / c : 0; };
  // how loud everything that is not a piano string is, look by look
  const other = new Float32Array(T);
  for (let q = 0; q < (fac.nN || 0); q += 1) { const h = row(nK + q); for (let t = 0; t < T; t += 1) other[t] += h[t]; }
  const notes = [];
  for (let p = 0; p < nK; p += 1) {
    const h = row(p);
    let last = -1e9;
    for (let t = D; t < T - D; t += 1) {
      const rise = h[t + D] - h[t - D];
      if (rise < S.jump * floor) continue;
      // the steepest point of this jump
      const prev = h[t + D - 1] - h[Math.max(0, t - D - 1)];
      const next = t + D + 1 < T ? h[t + D + 1] - h[t - D + 1] : -1;
      if (rise < prev || rise <= next) continue;
      if (t - last < gap) continue;
      // how loud the key is once the strike is over, against how loud it was before it
      const before = med(h, t - S.susTo, t - S.susFrom);
      const strength = med(h, t + S.susFrom, t + S.susTo) - before;
      if (strength < floor || strength < S.rho * before) continue;
      // in a recording of a room with no piano in it, the "loud notes" are only the hiss falling on a key
      if (strength < S.clear * mean(other, t + S.susFrom, t + S.susTo)) continue;
      let peak = 0; for (let u = t; u <= Math.min(T - 1, t + 10); u += 1) if (h[u] > peak) peak = h[u];
      notes.push({ p, t, peak, strength, midi: keys[p].midi });
      last = t;
    }
  }
  let kept = notes;
  // an overtone of a louder note struck in the same moment is not a note
  if (S.ghost > 0) {
    const above = [12, 19, 24, 28, 31, 34, 36];
    kept = notes.filter((n) => !notes.some((m) => m !== n && Math.abs(m.t - n.t) <= 4 && above.includes(n.midi - m.midi) && n.strength * S.ghost < m.strength));
  }
  // A key's knock travels through a tablet standing on the piano and sounds like several low
  // notes that die at once. A low note that has lost much of its loudness 120 ms after the
  // strike, struck together with a note at least an octave higher, is that knock.
  if (S.knock > 0) {
    const all = kept;
    kept = all.filter((n) => {
      if (n.midi >= S.knockBelow) return true;
      const h = row(n.p);
      if (mean(h, n.t + 10, n.t + 14) / (mean(h, n.t + 4, n.t + 8) || 1e-9) >= S.knock) return true;
      return !all.some((m) => m !== n && Math.abs(m.t - n.t) <= 5 && m.midi - n.midi >= 12);
    });
  }
  // two keys next to each other struck in one instant: a knock, or a mistuned string heard twice. The clearer one stays.
  if (S.cluster > 0) {
    const all = kept;
    kept = all.filter((n) => !all.some((m) => m !== n && Math.abs(m.t - n.t) <= 3 && Math.abs(n.midi - m.midi) === 1 && n.strength < S.cluster * m.strength));
  }
  // A click is a burst that the picture smears over many keys for a moment. A piano note
  // goes on sounding after it; what a click leaves behind does not. (Notes are played on the
  // click all the time, so being near one is no reason to go: only dying with it is.)
  if (clickTimes.length && S.clickNear > 0) {
    const nearClick = (sec) => clickTimes.some((c) => Math.abs(c - sec) <= S.clickNear);
    kept = kept.filter((n) => {
      if (!nearClick(n.t * dt)) return true;
      const h = row(n.p);
      const before = med(h, n.t - S.susTo, n.t - S.susFrom);
      return mean(h, n.t + 10, n.t + 14) - before >= S.clickStay * n.strength;
    });
  }
  // where each note ends
  const byKey = new Map();
  for (const n of kept) { if (!byKey.has(n.p)) byKey.set(n.p, []); byKey.get(n.p).push(n); }
  const out = [];
  for (const [p, list] of byKey) {
    const h = row(p);
    list.forEach((n, i) => {
      const stop = i + 1 < list.length ? list[i + 1].t - 1 : T - 1;
      let end = stop; let peakAt = n.t;
      for (let u = n.t; u <= Math.min(stop, n.t + 10); u += 1) if (h[u] >= h[peakAt]) peakAt = u;
      for (let u = peakAt; u <= stop; u += 1) if (h[u] < S.offFrac * n.peak) { end = u; break; }
      const on = n.t * dt;
      const vel = Math.max(0.05, Math.min(1, 0.6 + (20 * Math.log10(n.peak / ref)) / 24));
      out.push({ midi: n.midi, on, off: Math.max(on + 0.05, end * dt), vel });
    });
  }
  out.sort((a, b) => a.on - b.on || a.midi - b.midi);
  return out;
}

/**
 * Listen to a recording (any sample rate, one channel): the notes played, as
 * [{ midi, on, off, vel }] with times in seconds from its start and vel from 0 to 1.
 * `clicks`: [{ at (seconds), hz }], the metronome clicks the recording may hold and that are
 * not notes. `progress(0..1)` is called as the work goes on. `settings` changes any of SETTINGS.
 */
export function listen(samples, rate, { clicks = [], progress = null, settings = null } = {}) {
  const S = settings ? { ...SETTINGS, ...settings } : SETTINGS;
  const ready = prepare(samples, rate, S);
  if (ready.samples.length < S.win) return [];
  let peak = 0;
  for (let i = 0; i < ready.samples.length; i += 1) if (Math.abs(ready.samples[i]) > peak) peak = Math.abs(ready.samples[i]);
  if (!(peak > 0)) return [];
  if (progress) progress(0.02);
  const spec = spectrogram(ready.samples, ready.rate, S);
  if (progress) progress(0.08);
  const keys = fingerprints(spec, tuningOf(spec, S), S);
  const pitches = [...new Set(clicks.map((c) => c.hz))];
  const fac = factor(spec, keys, S, { rate: ready.rate, pitches, progress: progress && ((f) => progress(0.08 + 0.9 * f)) });
  const notes = pickNotes(fac, keys, spec, ready.rate, S, clicks.map((c) => c.at).sort((a, b) => a - b));
  if (progress) progress(1);
  return notes;
}
