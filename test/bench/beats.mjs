// How well the buddy dances to real recordings with marked beats.
//   node test/bench/beats.mjs <folder> [follower module] [old|new]
// The folder holds <name>.f32 (48 kHz mono float32) and <name>.json with the answer key:
// { beats: [ms, ...] or [[ms, label], ...], strength?: { dt, v: [0-100, ...] } } (from the Beat Marker page,
// or ASAP's marks). Recordings stay out of the repo; they're family clips or non-commercial datasets.
import { readFileSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOnsetDetector, ONSET } from '../../js/onsets.js';
import { createListener } from '../../js/listen.js';
import { runListener } from '../helpers/sound.mjs';

const [dir, followerPath = '../../js/beat.js', which = 'new'] = process.argv.slice(2);
if (!dir) { console.log('usage: node test/bench/beats.mjs <folder> [follower module] [old|new]'); process.exit(1); }
const { createBeatFollower } = await import(followerPath.startsWith('.') ? followerPath : pathToFileURL(resolve(followerPath)).href);
const RATE = 48000;
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export function onsetsOf(x, kind = 'new') {
  if (kind === 'old') return runListener(createListener({ sampleRate: RATE, fftSize: 2048 }), x).filter((e) => e.type === 'onset');
  // ONSET_TUNE='{"gapMs":80}' tries other detector settings
  const det = createOnsetDetector({ sampleRate: RATE, tune: { ...ONSET, ...JSON.parse(process.env.ONSET_TUNE || '{}') } });
  const out = [];
  for (let i = 0; i + 128 <= x.length; i += 128) out.push(...det.push(x.subarray(i, i + 128), ((i + 128) / RATE) * 1000));
  return out;
}

/** The buddy's dance moves, as the timer page makes them (a frame every 20 ms). */
export function dance(onsets, ms, seed) {
  const f = createBeatFollower({ rng: rng(seed) });
  const moves = [];
  let i = 0, live = 0;
  for (let now = 0; now < ms + 2000; now += 20) {
    while (i < onsets.length && onsets[i].at <= now) { f.note(onsets[i].at, onsets[i]); if (f.following(onsets[i].at + 1)) live++; i++; }
    moves.push(...f.beats(now));
  }
  return { moves, dancing: live / Math.max(1, onsets.length) };
}

const nearest = (sorted, t) => {
  let lo = 0, hi = sorted.length - 1;
  if (hi < 0) return Infinity;
  while (hi - lo > 1) { const m = (lo + hi) >> 1; if (sorted[m] < t) lo = m; else hi = m; }
  return Math.min(Math.abs(sorted[lo] - t), Math.abs(sorted[hi] - t));
};

export function score(moves, key, strengthAt) {
  const half = [...key, ...key.slice(1).map((x, i) => (x + key[i]) / 2)].sort((a, b) => a - b);
  let w = 0, on = 0, onHalf = 0, kw = 0, covered = 0;
  for (const m of moves) { const s = strengthAt(m); w += s; if (nearest(key, m) <= 70) on += s; if (nearest(half, m) <= 70) onHalf += s; }
  const sorted = moves.slice().sort((a, b) => a - b);
  for (const k of key) { const s = strengthAt(k); kw += s; if (nearest(sorted, k) <= 70) covered += s; }
  return { on: on / Math.max(1e-9, w), onHalf: onHalf / Math.max(1e-9, w), covered: covered / Math.max(1e-9, kw), moves: moves.length };
}

const pct = (x) => `${Math.round(100 * x)}%`.padStart(4);
const tot = { on: 0, onHalf: 0, covered: 0, dancing: 0, n: 0 };
for (const f of readdirSync(dir).filter((x) => x.endsWith('.f32')).sort()) {
  const name = f.replace('.f32', '');
  let gt;
  try { gt = JSON.parse(readFileSync(`${dir}/${name}.json`)); } catch { continue; }
  const key = gt.beats.map((b) => (Array.isArray(b) ? b[0] : b)).sort((a, b) => a - b);
  const sv = gt.strength?.v, dt = gt.strength?.dt || 100;
  const strengthAt = (t) => (sv ? (sv[Math.max(0, Math.min(sv.length - 1, Math.floor(t / dt)))] ?? 100) / 100 : 1);
  const buf = readFileSync(`${dir}/${f}`);
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  const onsets = onsetsOf(x, which);
  const r = { on: 0, onHalf: 0, covered: 0, dancing: 0 };
  const seeds = [7, 14, 21, 28];
  for (const seed of seeds) {
    const d = dance(onsets, (x.length / RATE) * 1000, seed);
    const s = score(d.moves, key, strengthAt);
    r.on += s.on / seeds.length; r.onHalf += s.onHalf / seeds.length; r.covered += s.covered / seeds.length; r.dancing += d.dancing / seeds.length;
  }
  for (const k of Object.keys(r)) tot[k] += r[k];
  tot.n++;
  console.log(name.slice(0, 40).padEnd(40), `notes ${String(onsets.length).padStart(4)}  dancing ${pct(r.dancing)}  moves on a beat ${pct(r.on)} (or halfway ${pct(r.onHalf)})  beats danced ${pct(r.covered)}${sv ? '  [weighted by beat strength]' : ''}`);
}
console.log(`AVERAGE`.padEnd(40), `           dancing ${pct(tot.dancing / tot.n)}  moves on a beat ${pct(tot.on / tot.n)} (or halfway ${pct(tot.onHalf / tot.n)})  beats danced ${pct(tot.covered / tot.n)}`);
