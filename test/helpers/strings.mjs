// A stand-in for a piano, for the tests: each note is a ladder of stretched overtones (many
// for a low note) with a fast start that die away. How the game does on recordings of a real
// piano is measured outside the tests.
import { stretchOf } from '../../js/listener.js';

// a repeatable random number, 0 to 1
export function seeded(seed) {
  let a = seed;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Piano-like sound (Float32Array, `seconds` long at `rate`): notes [{ midi, on, len, vel }].
 * `cents`: how far the whole piano is off pitch. `stretch`: its strings are this many times
 * as stretched as usual. `bright`: under 1.2 the overtones are stronger.
 */
export function pianoSound(notes, rate, seconds, { cents = 0, stretch = 1, bright = 1.2, hiss = 0.002, seed = 7 } = {}) {
  const x = new Float32Array(Math.round(seconds * rate));
  for (const { midi, on, len = 0.45, vel = 0.5 } of notes) {
    const f0 = 440 * 2 ** ((midi - 69 + cents / 100) / 12);
    const B = stretch * stretchOf(midi);
    const start = Math.round(on * rate);
    const n = Math.round((len + 0.3) * rate);
    for (let k = 1; k <= 24; k += 1) {
      const f = k * f0 * Math.sqrt(1 + B * k * k);
      if (f > Math.min(6000, 0.45 * rate)) break;
      const loud = vel / k ** bright;
      const tau = 0.7 / Math.sqrt(k);
      for (let i = 0; i < n && start + i < x.length; i += 1) {
        const t = i / rate;
        const env = (1 - Math.exp(-t / 0.004)) * Math.exp(-t / tau) * (t > len ? Math.exp(-(t - len) / 0.05) : 1);
        x[start + i] += loud * env * Math.sin(2 * Math.PI * f * t);
      }
    }
  }
  const r = seeded(seed);
  for (let i = 0; i < x.length; i += 1) x[i] += hiss * (2 * r() - 1);
  return x;
}

/** Keys played one at a time, `gap` seconds apart, each held for `len`: { sound, seconds }. */
export function keysInARow(midis, rate, { gap = 1, len = 0.7, lead = 0.4, ...how } = {}) {
  const seconds = lead + midis.length * gap + 0.5;
  return { sound: pianoSound(midis.map((midi, i) => ({ midi, on: lead + i * gap, len })), rate, seconds, how), seconds };
}
