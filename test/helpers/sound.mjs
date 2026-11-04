// Made-up sounds for the listening tests: piano-like notes, talking-like voice,
// and a WAV writer so a browser can use them as a fake microphone.

export const RATE = 48000;

/** Piano-like: a sharp attack, harmonics (slightly stretched), fading out. */
export function pianoNotes(notes, { rate = RATE, length, gain = 0.25, ring = 0 } = {}) {
  const total = Math.ceil((length ?? Math.max(...notes.map((n) => n.at + 1.5))) * rate);
  const out = new Float32Array(total);
  for (const { at, hz, dur = 1.2, g = 1 } of notes) {
    const s0 = Math.floor(at * rate);
    const len = Math.min(total - s0, Math.floor(dur * rate));
    for (let i = 0; i < len; i++) {
      const t = i / rate;
      // ring: the share that fades slowly (the pedal down, or a big piano)
      const env = g * Math.min(1, t / 0.004) * ((1 - ring) * Math.exp(-t * 3) + ring * Math.exp(-t * 0.5));
      let v = 0;
      for (let k = 1; k <= 8; k++) v += Math.sin(2 * Math.PI * hz * k * Math.sqrt(1 + 0.0004 * k * k) * t) * Math.exp(-t * k * 0.8) / k;
      out[s0 + i] += gain * env * v;
    }
  }
  return out;
}

/** Talking-like: a voice whose pitch slides and whose loudness comes in syllables. */
export function talking(seconds, { rate = RATE, gain = 0.25, f0 = 180 } = {}) {
  const out = new Float32Array(Math.ceil(seconds * rate));
  let phase = 0;
  for (let i = 0; i < out.length; i++) {
    const t = i / rate;
    const pitch = f0 * (1 + 0.18 * Math.sin(2 * Math.PI * 1.7 * t) + 0.1 * Math.sin(2 * Math.PI * 5.3 * t));
    phase += 2 * Math.PI * pitch / rate;
    const syll = Math.max(0, Math.sin(2 * Math.PI * 4.2 * t)) ** 1.5;
    // vowel colour moves between "ah" and "ee"
    const f1 = 500 + 250 * Math.sin(2 * Math.PI * 3.1 * t);
    const f2 = 1500 + 700 * Math.sin(2 * Math.PI * 2.3 * t + 1);
    let v = 0;
    for (let k = 1; k <= 25; k++) {
      const f = pitch * k;
      const shape = Math.exp(-(((f - f1) / 180) ** 2)) + 0.6 * Math.exp(-(((f - f2) / 250) ** 2)) + 0.05;
      v += Math.sin(phase * k) * shape;
    }
    out[i] = gain * 0.3 * syll * v;
  }
  return out;
}

/** A small room's echo: real rooms make every sound ring on a little. */
export function room(x, { rate = RATE, wet = 0.25 } = {}) {
  const out = Float32Array.from(x);
  for (const [d, g] of [[0.011, 0.5], [0.023, 0.35], [0.037, 0.25], [0.053, 0.18]]) {
    const k = Math.floor(d * rate);
    for (let i = k; i < x.length; i++) out[i] += wet * g * x[i - k];
  }
  for (let pass = 0; pass < 2; pass++) {
    const k = Math.floor(0.071 * rate);
    for (let i = k; i < out.length; i++) out[i] += wet * 0.3 * out[i - k];
  }
  return out;
}

/** Sung notes: a held pitch with vibrato (cents), swelling in over attack seconds. */
export function singing(seconds, { rate = RATE, f0 = 330, vibrato = 40, attack = 0.06, notes = [0, 1.3, 2.6], len = 1.1 } = {}) {
  const out = new Float32Array(Math.ceil(seconds * rate));
  notes.forEach((at, n) => {
    const s0 = Math.floor(at * rate);
    const hz = f0 * 2 ** ((n * 2) / 12);
    let ph = 0;
    for (let i = 0; i < len * rate && s0 + i < out.length; i++) {
      const t = i / rate;
      const p = hz * 2 ** ((vibrato / 1200) * Math.sin(2 * Math.PI * 5.5 * t) + 0.01 * Math.sin(2 * Math.PI * 0.7 * t));
      ph += 2 * Math.PI * p / rate;
      const env = Math.min(1, t / attack) * Math.min(1, (len - t) / 0.08);
      let v = 0;
      for (let k = 1; k <= 12; k++) v += Math.sin(ph * k) * (Math.exp(-(((p * k - 700) / 300) ** 2)) / k + 0.02);
      out[s0 + i] += 0.3 * env * v;
    }
  });
  return out;
}

/** Coughs: short bursts of rough noise. */
export function coughs(seconds, { rate = RATE, at = [0.3, 1.4, 2.1] } = {}) {
  const out = new Float32Array(Math.ceil(seconds * rate));
  let r = 7, lp = 0, lp2 = 0;
  for (const a of at) {
    const s0 = Math.floor(a * rate);
    for (let i = 0; i < 0.35 * rate && s0 + i < out.length; i++) {
      const t = i / rate;
      r = (r * 16807) % 2147483647;
      lp += 0.3 * (r / 2147483647 - 0.5 - lp);
      lp2 += 0.05 * (lp - lp2);
      out[s0 + i] += Math.min(1, t / 0.005) * Math.exp(-t * 9) * (0.9 * (lp - lp2) + 0.05 * Math.sin(2 * Math.PI * 160 * t * (1 - t)));
    }
  }
  return out;
}

export function concat(...parts) {
  const out = new Float32Array(parts.reduce((a, p) => a + p.length, 0));
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}

export function addNoise(x, level = 0.002, seed = 1) {
  let r = seed;
  return x.map((v) => { r = (r * 16807) % 2147483647; return v + level * (r / 2147483647 - 0.5); });
}

/** 16-bit mono WAV bytes. */
export function wav(samples, rate = RATE) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0); buf.writeUInt32LE(36 + samples.length * 2, 4); buf.write('WAVE', 8);
  buf.write('fmt ', 12); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(rate, 24); buf.writeUInt32LE(rate * 2, 28); buf.writeUInt16LE(2, 32); buf.writeUInt16LE(16, 34);
  buf.write('data', 36); buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((v, i) => buf.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(v * 32767))), 44 + i * 2));
  return buf;
}

function fft(re, im) {
  const n = re.length;
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const a = -2 * Math.PI / len;
    for (let i = 0; i < n; i += len) {
      for (let k = 0; k < len / 2; k++) {
        const wr = Math.cos(a * k), wi = Math.sin(a * k);
        const xr = re[i + k + len / 2] * wr - im[i + k + len / 2] * wi;
        const xi = re[i + k + len / 2] * wi + im[i + k + len / 2] * wr;
        re[i + k + len / 2] = re[i + k] - xr; im[i + k + len / 2] = im[i + k] - xi;
        re[i + k] += xr; im[i + k] += xi;
      }
    }
  }
}

/**
 * Plays samples through a listener the way the browser's analyser would: every
 * 20 ms, the new raw samples (for the note finder), then a Blackman-windowed
 * 2048-sample spectrum in dB plus the loudness. Returns every event the listener reported.
 */
export function runListener(listener, samples, { rate = RATE, size = 2048, hopMs = 20 } = {}) {
  const hop = Math.round(rate * hopMs / 1000);
  const events = [];
  const win = Float64Array.from({ length: size }, (_, i) => 0.42 - 0.5 * Math.cos(2 * Math.PI * i / size) + 0.08 * Math.cos(4 * Math.PI * i / size));
  let fed = 0;
  for (let end = size, f = 0; end <= samples.length; end += hop, f++) {
    const now = (end / rate) * 1000;
    // the microphone's raw samples go to the note finder as they come
    if (listener.samples) { events.push(...listener.samples(samples.subarray(fed, end), now)); fed = end; }
    const re = new Float64Array(size), im = new Float64Array(size);
    const wave = samples.subarray(end - size, end);
    for (let i = 0; i < size; i++) re[i] = wave[i] * win[i];
    fft(re, im);
    const db = new Float32Array(size / 2);
    for (let i = 0; i < size / 2; i++) db[i] = 20 * Math.log10(Math.hypot(re[i], im[i]) / size + 1e-12);
    events.push(...listener.frame(db, wave, now));
  }
  return events;
}
