// How well the buddy dances to recordings with marked beats.
//   node test/bench/beats.mjs <folder> [follower module] [new|judged]
// The folder holds <name>.f32 (48 kHz mono float32) and <name>.json with the answer key:
// { beats: [ms, ...] or [[ms, label], ...], strength?: { dt, v: [0-100, ...] }, rests?: [[from, to], ...] }
// (from the Beat Marker page, ASAP's marks, or kid-pieces.mjs). Recordings stay out of the repo:
// they're family clips or non-commercial datasets.
// It plays each recording through the note finder and the follower the way the timer page does
// (a frame every 20 ms, told whether the piano is sounding), 4 times with different luck, and
// scores the buddy's moves: on a beat (within 70 ms), or on a beat or halfway between; the share
// of beats danced; and the share of stops it danced through. Scores are weighted by beat
// strength when there is one. "judged" passes on only the notes the listener calls piano.
// Settings: BEAT_TUNE='{"salience":1}' and ONSET_TUNE='{"delta":1.2}' try others,
// ONSET_CACHE=<dir> keeps the notes found between runs, NO_SOUNDING=1 doesn't tell the follower
// whether the piano sounds, NEVER_LOUD=1 tells it the piano is always quiet (a stuck loudness),
// LEAD=<ms> starts each move that much before the beat it worked out (the app's "dance earlier").
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { createOnsetDetector, ONSET } from '../../js/onsets.js';
import { createListener, TUNING } from '../../js/listen.js';
import { runListener } from '../helpers/sound.mjs';

const main = import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
const [dir, followerPath = '../../js/beat.js', which = 'new'] = main ? process.argv.slice(2) : [];
if (main && !dir) { console.log('usage: node test/bench/beats.mjs <folder> [follower module] [new|judged]'); process.exit(1); }
const mod = await import(followerPath.startsWith('.') ? followerPath : pathToFileURL(resolve(followerPath)).href);
const createFollower = mod.createBeatFollower;
// BEAT_TUNE='{"salience":1}' tries other follower settings
const beatTune = { ...mod.BEAT, ...JSON.parse(process.env.BEAT_TUNE || '{}') };
const RATE = 48000;
const rng = (seed) => { let s = seed; return () => (s = (s * 16807) % 2147483647) / 2147483647; };

export function onsetsOf(x, kind = 'new') {
  if (kind === 'judged') {
    // only the notes the listener judged to be piano, each passed on once it was judged (~200 ms later)
    const l = createListener({ sampleRate: RATE, fftSize: 2048 });
    const frame = l.frame;
    l.frame = (db, wave, now) => frame(db, wave, now).map((e) => ({ ...e, heard: now }));
    return runListener(l, x).filter((e) => e.type === 'piano');
  }
  // ONSET_TUNE='{"gapMs":80}' tries other detector settings
  // (the rise every 10 ms comes along too, as out.flux: [[at, rise], ...])
  const flux = [];
  const det = createOnsetDetector({ sampleRate: RATE, tune: { ...ONSET, ...JSON.parse(process.env.ONSET_TUNE || '{}') }, onFlux: (v, at) => flux.push([at, +v.toFixed(3)]) });
  const out = [];
  for (let i = 0; i + 128 <= x.length; i += 128) out.push(...det.push(x.subarray(i, i + 128), ((i + 128) / RATE) * 1000));
  out.flux = flux;
  return out;
}

/** Whether the piano is sounding at each 20 ms frame, the way the listener decides (state.loud). */
export function soundingOf(x) {
  const out = [], size = 2048, hop = RATE / 50;
  let floor = null;
  for (let end = size; end <= x.length; end += hop) {
    let sum = 0;
    for (let i = end - size; i < end; i++) sum += x[i] * x[i];
    const level = 10 * Math.log10(sum / size || 1e-12);
    if (level > -100) { if (floor == null || level < floor) floor = level; else floor += Math.min(level - floor, TUNING.creep); }
    out.push(floor != null && level > floor + TUNING.gate && level > TUNING.minLevel);
  }
  return out;
}

/** The buddy's dance moves, as the timer page makes them (a frame every 20 ms). */
const lead = Number(process.env.LEAD || 0);
export function dance(onsets, ms, seed, sounding) {
  const f = createFollower({ rng: rng(seed), tune: beatTune });
  const moves = [];
  let i = 0, live = 0, j = 0;
  const flux = onsets.flux ?? [];
  for (let now = 0; now < ms + 2000; now += 20) {
    if (f.flux) while (j < flux.length && flux[j][0] <= now) { f.flux(flux[j][1], flux[j][0]); j++; }
    while (i < onsets.length && (onsets[i].heard ?? onsets[i].at) <= now) { f.note(onsets[i].at, onsets[i], now); if (f.following(now + 1)) live++; i++; }
    // the buddy moves when the frame comes, not at the beat time it worked out
    const k = Math.floor((now - 2048 / RATE * 1000) / 20);
    // LEAD=ms: beats are handed out early and each move is started at its beat minus the lead
    for (const b of f.beats(now, process.env.NEVER_LOUD ? false : sounding ? !!sounding[Math.max(0, k)] : undefined, lead)) moves.push(lead ? Math.max(now, b - lead) : now);
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

/** Share of the stops (rests: [[from, to], ...] ms) the buddy danced through, more than `grace` ms in (a second or two is fine). */
export function dancedThrough(moves, rests = [], grace = 2000) {
  if (!rests.length) return null;
  return rests.filter(([a, b]) => b - a > grace && moves.some((m) => m > a + grace && m < b)).length / rests.length;
}

const pct = (x) => `${Math.round(100 * x)}%`.padStart(4);
if (main) {
const tot = { on: 0, onHalf: 0, covered: 0, dancing: 0, n: 0, through: 0, stops: 0 };
for (const f of readdirSync(dir).filter((x) => x.endsWith('.f32')).sort()) {
  const name = f.replace('.f32', '');
  let gt;
  try { gt = JSON.parse(readFileSync(`${dir}/${name}.json`)); } catch { continue; }
  const key = gt.beats.map((b) => (Array.isArray(b) ? b[0] : b)).sort((a, b) => a - b);
  const sv = gt.strength?.v, dt = gt.strength?.dt || 100;
  const strengthAt = (t) => (sv ? (sv[Math.max(0, Math.min(sv.length - 1, Math.floor(t / dt)))] ?? 100) / 100 : 1);
  const buf = readFileSync(`${dir}/${f}`);
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  // ONSET_CACHE=dir keeps the notes found, so trying follower settings is quick
  const cache = process.env.ONSET_CACHE && `${process.env.ONSET_CACHE}/${name}.${which}.${Buffer.from(process.env.ONSET_TUNE || '').toString('hex').slice(0, 40)}.json`;
  let onsets;
  try { const c = JSON.parse(readFileSync(cache)); if (!c.flux) throw new Error('old cache'); onsets = Object.assign(c.onsets, { flux: c.flux }); } catch {
    onsets = onsetsOf(x, which);
    if (cache) writeFileSync(cache, JSON.stringify({ onsets, flux: onsets.flux }));
  }
  const sounding = soundingOf(x);
  const r = { on: 0, onHalf: 0, covered: 0, dancing: 0, through: 0 };
  const seeds = [7, 14, 21, 28];
  for (const seed of seeds) {
    const d = dance(onsets, (x.length / RATE) * 1000, seed, process.env.NO_SOUNDING ? null : sounding);
    const s = score(d.moves, key, strengthAt);
    r.on += s.on / seeds.length; r.onHalf += s.onHalf / seeds.length; r.covered += s.covered / seeds.length; r.dancing += d.dancing / seeds.length;
    r.through += (dancedThrough(d.moves, gt.rests) ?? 0) / seeds.length;
  }
  for (const k of ['on', 'onHalf', 'covered', 'dancing']) tot[k] += r[k];
  tot.n++;
  if (gt.rests?.length) { tot.through += r.through; tot.stops++; }
  console.log(name.slice(0, 40).padEnd(40), `notes ${String(onsets.length).padStart(4)}  dancing ${pct(r.dancing)}  moves on a beat ${pct(r.on)} (or halfway ${pct(r.onHalf)})  beats danced ${pct(r.covered)}${gt.rests?.length ? `  danced through ${pct(r.through)} of stops` : ''}`);
}
console.log(`AVERAGE`.padEnd(40), `           dancing ${pct(tot.dancing / tot.n)}  moves on a beat ${pct(tot.on / tot.n)} (or halfway ${pct(tot.onHalf / tot.n)})  beats danced ${pct(tot.covered / tot.n)}${tot.stops ? `  danced through ${pct(tot.through / tot.stops)} of stops` : ''}`);
}
