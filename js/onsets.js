// Finds where notes start in the microphone's sound, the way the published online
// onset detectors do it (Böck, Krebs & Schedl, "Evaluating the online capabilities of
// onset detection methods", ISMIR 2012, and Böck & Widmer, "Maximum filter vibrato
// suppression for onset detection", DAFx 2013, known as SuperFlux):
//  1. every 10 ms, a Hann-windowed 2048-sample spectrum;
//  2. summed into bands a quarter tone wide (27.5 Hz to 16 kHz), squashed with log10(1 + x),
//     so soft and low notes count about as much as loud and high ones;
//  3. "flux": how much every band rose since 20 ms ago, added up (falls don't count). Each
//     band is compared with the loudest of it and its two neighbours back then, so a
//     voice's vibrato sliding between neighbouring bands doesn't look like a new note;
//  4. a note starts where the flux is the highest of the last 30 ms and beats the average
//     of the last 100 ms by a fixed margin.
// Only the past is used, so each note is reported about 20 ms after it starts.
// Tested on 12 minutes of MAESTRO grand-piano recordings with exact MIDI: it finds 75% of
// note starts (6% false), where the older detector found 54% (5% false), and on a sung
// line it finds the 3 notes where step 3 without the neighbours found 14. One change from
// the papers: notes must be 80 ms apart, not 30, because on the tablet each note's echo
// off the piano comes back 50-100 ms later and counted as a second note.
// The buddy doesn't need every note, though: like a person tapping along, it follows the
// strong ones, so each note also says how strong it was.

export const ONSET = {
  hopMs: 10,          // a new spectrum this often
  size: 2048,         // samples per spectrum (~43 ms at 48 kHz)
  lowHz: 27.5,        // lowest band (A0)
  highHz: 16000,      // highest band
  perOctave: 24,      // bands per octave (a quarter tone each)
  maxBands: 3,        // compare each band with the loudest of this many around it (vibrato)
  lagMs: 20,          // flux compares spectra this far apart
  preMaxMs: 30,       // a note's flux is the highest of this long
  preAvgMs: 100,      // ...and beats the average of this long
  delta: 1.0,         // ...by this much (summed log units)
  gapMs: 80,          // shortest time between two notes (the echo off the piano is not a new note)
  bassHz: 262,        // bands below this (middle C) make up the "low" strength
  minLevel: -75,      // dB (full scale): quieter than this is silence
};

/** In-place radix-2 FFT with tables made once per size. */
function makeFft(n) {
  const rev = new Uint32Array(n);
  for (let i = 0, j = 0; i < n; i++) {
    rev[i] = j;
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
  }
  const cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
  for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos(-2 * Math.PI * i / n); sin[i] = Math.sin(-2 * Math.PI * i / n); }
  return (re, im) => {
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (i < j) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const half = len >> 1, step = n / len;
      for (let i = 0; i < n; i += len) {
        for (let j = 0, k = 0; j < half; j++, k += step) {
          const a = i + j, b = a + half;
          const vr = re[b] * cos[k] - im[b] * sin[k], vi = re[b] * sin[k] + im[b] * cos[k];
          re[b] = re[a] - vr; im[b] = im[a] - vi;
          re[a] += vr; im[a] += vi;
        }
      }
    }
  };
}

/** Triangular filters, perOctave to an octave: [{ bins: [[bin, weight], ...], hz }]. */
export function pitchBands(sampleRate, size, lowHz, highHz, perOctave = 12) {
  const binHz = sampleRate / size;
  const centres = [];
  for (let m = 0; ; m++) {
    const hz = lowHz * 2 ** (m / perOctave);
    if (hz > Math.min(highHz, sampleRate / 2)) break;
    centres.push(hz);
  }
  const bands = [];
  let lastKey = '';
  for (let i = 1; i < centres.length - 1; i++) {
    const lo = centres[i - 1] / binHz, c = centres[i] / binHz, hi = centres[i + 1] / binHz;
    const bins = [];
    for (let k = Math.floor(lo); k <= Math.ceil(hi); k++) {
      const w = k < c ? (k - lo) / (c - lo) : (hi - k) / (hi - c);
      if (w > 0 && k > 0 && k < size / 2) bins.push([k, w]);
    }
    // low bands are narrower than a bin: those that land on the same bins are one band
    const key = bins.map((b) => b[0]).join(',');
    if (!bins.length || key === lastKey) continue;
    lastKey = key;
    bands.push({ bins, hz: centres[i] });
  }
  return bands;
}

/**
 * Feed it the microphone's samples as they come: push(samples, endMs), where endMs is
 * the time of the last sample. Returns the notes that started, as
 * { type: 'onset', at, strength, low }: at in ms, strength = how big the rise was,
 * low = the part of it below middle C (bass notes and chords). onFlux(flux, at), if
 * given, hears the rise every 10 ms, note or not (0 in silence).
 */
export function createOnsetDetector({ sampleRate, tune = ONSET, onFlux = null }) {
  const N = tune.size;
  const hop = Math.max(1, Math.round(sampleRate * tune.hopMs / 1000));
  const fft = makeFft(N);
  const win = Float64Array.from({ length: N }, (_, i) => 0.5 - 0.5 * Math.cos(2 * Math.PI * i / N));
  const bands = pitchBands(sampleRate, N, tune.lowHz, tune.highHz, tune.perOctave ?? 12);
  const spread = Math.max(0, ((tune.maxBands ?? 1) - 1) >> 1);
  const nb = bands.length;
  const bass = bands.filter((b) => b.hz < tune.bassHz).length;
  const lag = Math.max(1, Math.round(tune.lagMs / tune.hopMs));
  const preMax = Math.max(1, Math.round(tune.preMaxMs / tune.hopMs));
  const preAvg = Math.max(1, Math.round(tune.preAvgMs / tune.hopMs));
  const gap = tune.gapMs;
  const ring = new Float32Array(N);       // the last N samples, oldest at `pos`
  let pos = 0, filled = 0, sinceHop = 0;
  const re = new Float64Array(N), im = new Float64Array(N);
  const past = [];                        // band levels of the last `lag` frames
  const odf = [];                         // recent flux values
  let lastOnset = -Infinity;
  const state = { flux: 0, threshold: 0, level: -100 };

  function analyse(at) {
    let sum = 0;
    for (let i = 0; i < N; i++) { const x = ring[(pos + i) % N]; sum += x * x; re[i] = x * win[i]; im[i] = 0; }
    state.level = 10 * Math.log10(sum / N || 1e-12);
    fft(re, im);
    const s = new Float64Array(nb);
    for (let b = 0; b < nb; b++) {
      let v = 0;
      for (const [k, w] of bands[b].bins) v += Math.hypot(re[k], im[k]) * w;
      s[b] = Math.log10(1 + v);
    }
    let flux = 0, low = 0;
    if (past.length >= lag) {
      const p = past[past.length - lag];
      for (let b = 0; b < nb; b++) {
        let q = p[b];
        for (let k = Math.max(0, b - spread); k <= Math.min(nb - 1, b + spread); k++) if (p[k] > q) q = p[k];
        const d = s[b] - q;
        if (d > 0) { flux += d; if (b < bass) low += d; }
      }
    }
    past.push(s);
    if (past.length > lag) past.shift();
    odf.push(flux);
    if (odf.length > Math.max(preMax, preAvg) + 1) odf.shift();
    let max = 0, avg = 0;
    const t = odf.length - 1;
    for (let k = Math.max(0, t - preMax); k < t; k++) max = Math.max(max, odf[k]);
    const from = Math.max(0, t - preAvg);
    for (let k = from; k <= t; k++) avg += odf[k];
    avg /= t - from + 1;
    state.flux = flux;
    state.threshold = Math.max(max, avg + tune.delta);
    onFlux?.(state.level > tune.minLevel ? flux : 0, at);
    if (flux >= max && flux >= avg + tune.delta && at - lastOnset >= gap && state.level > tune.minLevel) {
      lastOnset = at;
      return { type: 'onset', at, strength: flux, low };
    }
    return null;
  }

  function push(samples, endMs) {
    const out = [];
    const n = samples.length;
    for (let i = 0; i < n; i++) {
      ring[pos] = samples[i];
      pos = (pos + 1) % N;
      if (filled < N) filled++;
      if (++sinceHop >= hop) {
        sinceHop = 0;
        if (filled === N) {
          const ev = analyse(endMs - ((n - 1 - i) / sampleRate) * 1000);
          if (ev) out.push(ev);
        }
      }
    }
    return out;
  }

  return { push, state, hop, bands: nb };
}
