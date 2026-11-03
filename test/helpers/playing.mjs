// Made-up practice playing for the beat follower: note times plus the true beats
// (none for playing with no beat). Seeded, so tests always see the same playing.
export function rng(seed) { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; }
const Q = [[0]], E = [[0, 0.5]], MIX = [[0], [0, 0.5], [0], [0, 0.5]], HALF = [[0], []], DOT = [[0], [0.5], [0], [0, 0.5]], WALTZ = [[0], [0.5], [0, 0.5]];
export const RHYTHMS = { Q, E, MIX, HALF, DOT, WALTZ };
export function perform(parts, r, { jitter = 30, miss = 0.05, extra = 0.04 } = {}) {
  const beats = [], notes = [], sections = []; let t = 500;
  const nrm = () => { let u = 0; while (!u) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  for (const s of parts) {
    if (s.pause) { t += s.pause; continue; }
    if (s.noodle) { // no beat: notes with random gaps
      const start = t, end = t + s.noodle;
      while (t < end) { notes.push(t); t += s.gap[0] + r() * (s.gap[1] - s.gap[0]); }
      sections.push({ beat: false, start, end: t }); continue;
    }
    const [b0, b1] = Array.isArray(s.bpm) ? s.bpm : [s.bpm, s.bpm];
    const start = t; const sb = [];
    let wander = 1;
    for (let i = 0; i < s.beats; i++) {
      if (s.wobbly) wander *= Math.exp(s.wobbly * nrm());
      const P = 60000 / (b0 + (b1 - b0) * (i / s.beats)) * wander;
      beats.push(t); sb.push(t);
      for (const sub of s.rhythm[i % s.rhythm.length]) {
        if (r() < miss) continue;
        notes.push(t + sub * P + jitter * nrm());
      }
      if (r() < extra) notes.push(t + r() * P);
      t += P;
    }
    sections.push({ beat: true, start, end: t, beats: sb });
  }
  return { beats, notes: notes.sort((a, b) => a - b), sections, end: t };
}
