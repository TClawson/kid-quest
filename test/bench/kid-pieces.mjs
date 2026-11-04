// Makes kid-like practice recordings with exact beats, for the beat bench (beats.mjs):
//   node test/bench/kid-pieces.mjs <POP909 folder> <out folder> [how many songs]
// POP909 (MIT licence, github.com/music-x-lab/POP909-Dataset) has 909 pop songs as piano
// MIDI with marked beats and bar lines. From each song we take a few bars and "play" them
// three ways, the way kids practise:
//   steady  - an "easy piano" version: melody in quarters and eighths, left hand on beats
//             1 and 3, a little uneven
//   learner - the melody with a left hand on each bar, slower, drifting, stopping to think,
//             going back a bar
//   chatty  - steady, with someone talking over it
// rendered with real grand-piano samples (Salamander, the test samples in node_modules),
// an echo off the piano (the tablet sits on it), a room and a quiet hiss. Each clip gets
// <name>.f32 (48 kHz mono) and <name>.json: { beats: [[ms, 'bar'|''], ...], strength,
// rests: [[from, to], ...], notes: [[ms, pitch, velocity], ...] }. The recordings are made
// fresh each time (the same every time), so they don't need to be kept anywhere.
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'node:fs';
import { chromium } from 'playwright';
import { serve } from '../helpers/serve.mjs';
import { RATE, room, addNoise, talking } from '../helpers/sound.mjs';

// songs whose beat is a walking pace (80-130 a minute), like the pieces kids learn
const SONGS = ['001', '006', '020', '029', '046', '076', '105', '134', '014', '052', '085', '124'];

/** A standard MIDI file's notes: [{ sec, end, pitch, vel, track }]. */
export function readMidi(buf) {
  let p = 0;
  const str = (n) => { const s = buf.toString('latin1', p, p + n); p += n; return s; };
  const u32 = () => { const v = buf.readUInt32BE(p); p += 4; return v; };
  if (str(4) !== 'MThd') throw new Error('not a MIDI file');
  const hlen = u32();
  const ntracks = buf.readUInt16BE(p + 2), division = buf.readUInt16BE(p + 4);
  p += hlen;
  const tempos = [[0, 500000]];
  const raw = [];
  for (let t = 0; t < ntracks && p < buf.length; t++) {
    const id = str(4), len = u32(), end = p + len;
    if (id !== 'MTrk') { p = end; continue; }
    let tick = 0, running = 0, name = `track ${t}`;
    const on = new Map();
    const vlq = () => { let v = 0, b; do { b = buf[p++]; v = v * 128 + (b & 0x7f); } while (b & 0x80); return v; };
    while (p < end) {
      tick += vlq();
      const b = buf[p];
      if (b === 0xff) {
        const type = buf[p + 1];
        p += 2;
        const n = vlq();
        if (type === 0x03) name = buf.toString('latin1', p, p + n);
        if (type === 0x51) tempos.push([tick, (buf[p] << 16) | (buf[p + 1] << 8) | buf[p + 2]]);
        p += n;
        continue;
      }
      if (b === 0xf0 || b === 0xf7) { p++; p += vlq(); continue; }
      if (b & 0x80) { running = b; p++; }
      const hi = running & 0xf0;
      const d1 = buf[p++], d2 = hi === 0xc0 || hi === 0xd0 ? 0 : buf[p++];
      const key = `${running & 15}:${d1}`;
      if (hi === 0x90 && d2 > 0) on.set(key, [tick, d2]);
      else if ((hi === 0x80 || hi === 0x90) && on.has(key)) {
        const [t0, vel] = on.get(key);
        on.delete(key);
        raw.push({ tick: t0, endTick: tick, pitch: d1, vel, track: name });
      }
    }
    p = end;
  }
  tempos.sort((a, b) => a[0] - b[0]);
  const sec = (tick) => {
    let s = 0;
    for (let i = 0; i < tempos.length; i++) {
      const [t0, us] = tempos[i];
      const t1 = i + 1 < tempos.length ? tempos[i + 1][0] : Infinity;
      if (tick <= t0) break;
      s += ((Math.min(tick, t1) - t0) / division) * (us / 1e6);
    }
    return s;
  };
  return raw.map((n) => ({ sec: sec(n.tick), end: sec(n.endTick), pitch: n.pitch, vel: n.vel, track: n.track })).sort((a, b) => a.sec - b.sec);
}

const rng = (seed) => { let s = seed % 2147483647 || 1; return () => (s = (s * 16807) % 2147483647) / 2147483647; };
const normal = (r) => Math.sqrt(-2 * Math.log(r() || 1e-9)) * Math.cos(2 * Math.PI * r());

/** One song's score: notes at beat positions (quarter notes), and where bars start. */
function score(dir, id) {
  const notes = readMidi(readFileSync(`${dir}/${id}/${id}.mid`));
  const rows = readFileSync(`${dir}/${id}/beat_midi.txt`, 'utf8').trim().split('\n').map((l) => l.trim().split(/\s+/).map(Number));
  const bt = rows.map((r) => r[0]);
  const bars = rows.map((r, i) => (r[2] === 1 ? i : -1)).filter((i) => i >= 0);
  const pos = (s) => {
    let k = 0;
    while (k < bt.length - 2 && bt[k + 1] <= s) k++;
    const x = k + (s - bt[k]) / (bt[k + 1] - bt[k]);
    // kids read the written notes: on the nearest sixteenth (or triplet)
    const q4 = Math.round(x * 4) / 4, q3 = Math.round(x * 3) / 3;
    return Math.abs(x - q3) < Math.abs(x - q4) * 0.5 ? q3 : q4;
  };
  return {
    bpm: 60 / ((bt.at(-1) - bt[0]) / (bt.length - 1)),
    bars,
    notes: notes.map((n) => ({ at: pos(n.sec), len: Math.max(0.25, pos(n.end) - pos(n.sec)), pitch: n.pitch, vel: n.vel, track: n.track })),
  };
}

/**
 * The part a kid plays, like an "easy piano" book: the melody in quarter and eighth notes
 * (one note at a time), and a left hand on beats 1 and 3 (every: 2) or on each bar (every: 4).
 */
function arrange(sc, from, to, every) {
  const slots = new Map();
  for (const n of sc.notes) {
    if (n.track !== 'MELODY' || n.at < from || n.at >= to) continue;
    const at = Math.round(n.at * 2) / 2;
    if (!slots.has(at) || n.pitch > slots.get(at).pitch) slots.set(at, { ...n, at, hand: 'right' });
  }
  const out = [...slots.values()].sort((a, b) => a.at - b.at);
  out.forEach((n, i) => { n.len = Math.max(0.5, Math.min(n.len, (out[i + 1]?.at ?? to) - n.at)); });
  for (let b = from; b < to; b += every) {
    const low = sc.notes.filter((n) => n.track === 'PIANO' && n.pitch < 60 && n.at <= b + 0.25 && n.at + n.len > b);
    const pitches = [...new Set(low.map((n) => n.pitch))].sort((x, y) => x - y).slice(0, 2);
    for (const pitch of pitches) out.push({ at: b, len: every - 0.2, pitch, vel: 60, hand: 'left' });
  }
  return out.sort((a, b) => a.at - b.at);
}

/**
 * Plays bars [from, to) the way a kid would: returns the notes in seconds, the beats as
 * played, and the rests where they stopped.
 */
function perform(sc, from, to, style, r) {
  const bars = sc.bars.filter((b) => b >= from && b < to);
  // the order the beats are played in: straight through, but a learner stops to think
  // before a couple of bars, and once goes back to the start of a bar
  const segs = [{ from, to, pause: 0 }];
  if (style === 'learner' && bars.length > 4) {
    const cut = (at, pause, back) => {
      const s = segs.findIndex((x) => x.from < at && x.to > at);
      if (s < 0) return;
      const seg = segs[s];
      segs.splice(s, 1, { from: seg.from, to: at, pause: seg.pause }, { from: back ?? at, to: seg.to, pause });
    };
    const pick = () => bars[1 + Math.floor(r() * (bars.length - 2))];
    cut(pick(), 0.8 + 1.7 * r());
    const b = pick();
    cut(b + 2, 0.7 + 0.8 * r(), b);           // a wrong note: stop, go back to the bar start
    cut(pick(), 1.5 + 1.5 * r());
  }
  const factor = style === 'learner' ? 0.65 + 0.15 * r() : 0.8 + 0.15 * r();
  const bpm = Math.min(style === 'learner' ? 100 : 120, Math.max(style === 'learner' ? 55 : 60, sc.bpm * factor));
  const jitter = style === 'learner' ? 0.03 : 0.015;
  const drift = style === 'learner' ? 0.03 : 0.012;
  const part = arrange(sc, from, to, style === 'learner' ? 4 : 2);
  const notes = [], beats = [], rests = [];
  let t = 0.6, d = 0;
  for (const seg of segs) {
    if (seg.pause) {
      rests.push([t, t + seg.pause]);
      t += seg.pause;
      d *= 0.5;   // after a stop, a fresh start near the usual speed
    }
    const start = [];
    for (let k = seg.from; k < seg.to; k++) {
      d = 0.85 * d + drift * normal(r);
      start.push(t);
      beats.push([Math.round(t * 1000), sc.bars.includes(k) ? 'bar' : '']);
      t += (60 / bpm) * Math.exp(d);
    }
    start.push(t);
    const at = (x) => { const k = Math.min(start.length - 2, Math.floor(x - seg.from)); return start[k] + (x - seg.from - k) * (start[k + 1] - start[k]); };
    const chordShift = new Map();
    for (const n of part) {
      if (n.at < seg.from || n.at >= seg.to) continue;
      if (!chordShift.has(n.at)) chordShift.set(n.at, Math.max(-3, Math.min(3, normal(r))) * jitter);
      const s = at(n.at) + chordShift.get(n.at) + 0.008 * normal(r);
      const end = Math.min(at(Math.min(seg.to, n.at + n.len)), s + 2) - 0.03;
      const accent = sc.bars.includes(Math.floor(n.at)) && n.at % 1 === 0 ? 8 : 0;
      const vel = Math.round(Math.max(25, Math.min(110, (n.hand === 'left' ? 52 : 68) + accent + (style === 'learner' ? 16 : 10) * normal(r))));
      notes.push({ t: s, dur: Math.max(0.12, end - s), pitch: n.pitch, vel });
    }
  }
  return { notes: notes.sort((a, b) => a.t - b.t), beats, rests, length: t + 1.5, bpm };
}

/** How clear the beat is, per 100 ms: none while they've stopped, a little less as they start again. */
function strengthOf(p) {
  const v = new Array(Math.ceil(p.length * 10)).fill(100);
  for (const [a, b] of p.rests) {
    for (let i = Math.floor(a * 10); i < Math.ceil(b * 10) && i < v.length; i++) v[i] = 0;
    const next = p.beats.find((x) => x[0] >= b * 1000 - 1);
    const again = p.beats.filter((x) => x[0] >= (next?.[0] ?? Infinity)).slice(0, 3);
    if (again.length === 3) for (let i = Math.ceil(b * 10); i < again[2][0] / 100 && i < v.length; i++) v[i] = 60;
  }
  return { dt: 100, v };
}

async function main() {
  const [dir, out, count = '8'] = process.argv.slice(2);
  if (!dir || !out) { console.log('usage: node test/bench/kid-pieces.mjs <POP909 folder> <out folder> [songs]'); process.exit(1); }
  mkdirSync(out, { recursive: true });
  const SAMPLES = 'node_modules/@audio-samples/piano-mp3-velocity8/audio/';
  const NAMES = { C: 0, 'C#': 1, D: 2, 'D#': 3, E: 4, F: 5, 'F#': 6, G: 7, 'G#': 8, A: 9, 'A#': 10, B: 11 };
  const samples = readdirSync(SAMPLES).map((f) => {
    const m = f.match(/^([A-G]#?)(\d)v8\.mp3$/);
    return m && [12 * (Number(m[2]) + 1) + NAMES[m[1]], SAMPLES + encodeURIComponent(f)];
  }).filter(Boolean);
  const site = await serve('.');
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(site.url);
  await page.evaluate(async ({ samples, rate }) => {
    const ctx = new OfflineAudioContext(1, 1, rate);
    window.piano = await Promise.all(samples.map(async ([pitch, url]) => [pitch, await ctx.decodeAudioData(await (await fetch(url)).arrayBuffer())]));
  }, { samples, rate: RATE });
  try {
    for (const id of SONGS.slice(0, Number(count))) {
      const sc = score(dir, id);
      const first = sc.notes.find((n) => n.track === 'MELODY')?.at ?? 0;
      const startBar = sc.bars.findIndex((b) => b >= Math.floor(first));
      for (const [k, style] of ['steady', 'learner', 'chatty'].entries()) {
        const r = rng(Number(id) * 31 + k * 7 + 1);
        const nBars = style === 'learner' ? 10 : 8;
        const from = sc.bars[startBar + 1] ?? sc.bars[0], to = sc.bars[startBar + 1 + nBars] ?? from + 4 * nBars;
        const p = perform(sc, from, to, style, r);
        const len = Math.ceil(p.length * RATE);
        const b64 = await page.evaluate(async ({ notes, len, rate }) => {
          const ctx = new OfflineAudioContext(1, len, rate);
          for (const n of notes) {
            let best = window.piano[0];
            for (const s of window.piano) if (Math.abs(s[0] - n.pitch) < Math.abs(best[0] - n.pitch)) best = s;
            const src = ctx.createBufferSource();
            src.buffer = best[1];
            src.playbackRate.value = 2 ** ((n.pitch - best[0]) / 12);
            const g = ctx.createGain();
            const amp = 1.4 * (n.vel / 127) ** 1.7;
            g.gain.setValueAtTime(amp, n.t);
            g.gain.setTargetAtTime(0, n.t + n.dur, 0.05);   // the damper comes down
            src.connect(g).connect(ctx.destination);
            src.start(n.t);
            src.stop(n.t + n.dur + 0.5);
          }
          const x = (await ctx.startRendering()).getChannelData(0);
          const bytes = new Uint8Array(x.buffer);
          let s = '';
          for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
          return btoa(s);
        }, { notes: p.notes, len, rate: RATE });
        const bytes = Buffer.from(b64, 'base64');
        let x = new Float32Array(bytes.buffer, bytes.byteOffset, bytes.length / 4);
        // the tablet on the piano hears each note again 50-90 ms later, then the room
        const delay = Math.round((0.05 + 0.04 * r()) * RATE), echo = 0.35 + 0.3 * r();
        x = Float32Array.from(x, (v, i) => v + (i >= delay ? echo * x[i - delay] : 0));
        x = room(x, { wet: 0.2 + 0.15 * r() });
        if (style === 'chatty') {
          // someone talks for a few seconds at a time, about half the clip
          for (let at = 0.5 + 2 * r(); at < p.length - 1; at += 4 + 4 * r()) {
            const voice = talking(Math.min(2 + 3 * r(), p.length - at), { f0: r() < 0.6 ? 220 + 80 * r() : 120 + 40 * r(), gain: 0.15 + 0.2 * r() });
            const s0 = Math.floor(at * RATE);
            for (let i = 0; i < voice.length && s0 + i < x.length; i++) x[s0 + i] += voice[i];
          }
        }
        let peak = 0;
        for (const v of x) peak = Math.max(peak, Math.abs(v));
        const gain = (0.25 + 0.4 * r()) / Math.max(1e-6, peak);
        x = addNoise(x.map((v) => v * gain), 0.002, Number(id) + k);
        const name = `${id}-${style}`;
        writeFileSync(`${out}/${name}.f32`, Buffer.from(x.buffer));
        writeFileSync(`${out}/${name}.json`, JSON.stringify({
          source: `POP909 ${id}`, style, bpm: Math.round(p.bpm), beats: p.beats,
          rests: p.rests.map(([a, b]) => [Math.round(a * 1000), Math.round(b * 1000)]),
          strength: strengthOf(p), notes: p.notes.map((n) => [Math.round(n.t * 1000), n.pitch, n.vel]),
        }));
        console.log(name.padEnd(16), `${p.length.toFixed(0)} s  ${Math.round(p.bpm)} bpm  ${p.notes.length} notes  ${p.beats.length} beats  ${p.rests.length} stops`);
      }
    }
  } finally {
    await browser.close();
    site.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) await main();
