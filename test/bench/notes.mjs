// How many real piano notes the onset detector finds. Needs recordings with exact MIDI,
// which can't live in this repo (MAESTRO and ASAP are non-commercial). Point it at a folder of
//   <name>.f32  (48 kHz mono float32 samples)  +  <name>.json  ({ notes: [[ms, pitch, velocity], ...] })
// as made by the note-detector research scripts:  node test/bench/notes.mjs <folder> ['{"delta":1.5}']
import { readFileSync, readdirSync } from 'node:fs';
import { createOnsetDetector, ONSET } from '../../js/onsets.js';

const [dir, extra] = process.argv.slice(2);
if (!dir) { console.log('usage: node test/bench/notes.mjs <folder> [tuning json]'); process.exit(1); }
const tune = { ...ONSET, ...JSON.parse(extra || '{}') };
const RATE = 48000;

/** MIDI note starts within 30 ms of each other are one sound (a chord). */
export function noteEvents(notes) {
  const ev = [];
  for (const [t, pitch, vel] of notes.slice().sort((a, b) => a[0] - b[0])) {
    const last = ev.at(-1);
    if (last && t - last.t <= 30) { last.vel = Math.max(last.vel, vel); last.low = Math.min(last.low, pitch); } else ev.push({ t, vel, low: pitch });
  }
  return ev;
}

/** Each found note matched to at most one real one, within 50 ms (the MIREX rule). */
export function matchNotes(found, real, tol = 50) {
  const used = new Set(), offsets = [];
  let j = 0;
  for (const f of found) {
    while (j < real.length && real[j].t < f - tol) j++;
    let best = -1;
    for (let k = j; k < real.length && real[k].t <= f + tol; k++) {
      if (!used.has(k) && (best < 0 || Math.abs(real[k].t - f) < Math.abs(real[best].t - f))) best = k;
    }
    if (best >= 0) { used.add(best); real[best].hit = true; offsets.push(f - real[best].t); }
  }
  offsets.sort((a, b) => a - b);
  return { hits: used.size, offset: offsets[offsets.length >> 1] ?? 0 };
}

const pct = (a, b) => `${Math.round((100 * a) / Math.max(1, b))}%`.padStart(4);
let all = { found: 0, real: 0, hits: 0, soft: [0, 0], fast: [0, 0] };
const t0 = Date.now();
let seconds = 0;
for (const f of readdirSync(dir).filter((x) => x.endsWith('.f32')).sort()) {
  const name = f.replace('.f32', '');
  let gt;
  try { gt = JSON.parse(readFileSync(`${dir}/${name}.json`)); } catch { continue; }
  const buf = readFileSync(`${dir}/${f}`);
  const x = new Float32Array(buf.buffer, buf.byteOffset, buf.length / 4);
  seconds += x.length / RATE;
  const det = createOnsetDetector({ sampleRate: RATE, tune });
  const found = [];
  const block = 128;   // the size the browser hands an audio worklet
  for (let i = 0; i + block <= x.length; i += block) for (const ev of det.push(x.subarray(i, i + block), ((i + block) / RATE) * 1000)) found.push(ev.at);
  const real = noteEvents(gt.notes);
  const m = matchNotes(found, real);
  all.found += found.length; all.real += real.length; all.hits += m.hits;
  real.forEach((e, i) => {
    if (e.vel < 50) { all.soft[1]++; if (e.hit) all.soft[0]++; }
    if (i && e.t - real[i - 1].t < 125) { all.fast[1]++; if (e.hit) all.fast[0]++; }
  });
  console.log(name.slice(0, 46).padEnd(46), `found ${pct(m.hits, real.length)}  false ${pct(found.length - m.hits, found.length)}  late ${Math.round(m.offset)} ms`);
}
console.log(`ALL: found ${pct(all.hits, all.real)} of ${all.real} notes, false ${pct(all.found - all.hits, all.found)}; soft notes ${pct(...all.soft)}, fast notes ${pct(...all.fast)}`);
console.log(`speed: ${(seconds / ((Date.now() - t0) / 1000)).toFixed(0)}x real time`);
