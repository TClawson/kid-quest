// Background music for the quest map: one original 16-bar chiptune loop per map theme,
// synthesized live with Web Audio (pulse waves, a triangle bass and noise drums, like old
// consoles). No audio files. A small look-ahead scheduler keeps the timing steady.
import { SONGS, SHOW_SONGS } from './songs.js';

const VOLUME = 0.07;
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** 'F#5' or 'Bb4' to a MIDI number. */
function midi(name) {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return SEMI[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (Number(m[3]) + 1) * 12;
}
const hz = (n) => 440 * 2 ** ((n - 69) / 12);

/** Chord name ('C', 'F#m', 'Bb', 'Bdim') to pitch classes [root, third, fifth]. */
function chordTones(name) {
  const m = /^([A-G][#b]?)(m|dim)?$/.exec(name);
  if (!m) throw new Error(`bad chord ${name}`);
  const root = (midi(`${m[1]}0`) - 12 + 120) % 12;
  const third = m[2] ? 3 : 4;
  const fifth = m[2] === 'dim' ? 6 : 7;
  return [root, root + third, root + fifth];
}

/** Compile a song once: bars of note tokens, chords to pitch classes. */
const compiled = new Map();
function compile(id) {
  if (compiled.has(id)) return compiled.get(id);
  const s = id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] || SHOW_SONGS['bg-meadow'] : SONGS[id] || SONGS['bg-meadow'];
  const song = {
    ...s,
    beat: s.beat || 8,
    lead: s.lead.map((bar) => bar.split(' ')),
    chords: s.chords.map(chordTones),
  };
  compiled.set(id, song);
  return song;
}

// ---------- sound sources ----------

function pulseWave(ac, duty) {
  const n = 32;
  const real = new Float32Array(n);
  const imag = new Float32Array(n);
  for (let k = 1; k < n; k += 1) {
    real[k] = (2 / (k * Math.PI)) * Math.sin(2 * Math.PI * k * duty);
    imag[k] = (2 / (k * Math.PI)) * (1 - Math.cos(2 * Math.PI * k * duty));
  }
  return ac.createPeriodicWave(real, imag);
}

/** Everything one song needs on one AudioContext: output, noise, pulse waves and an echo. */
function rig(ac, out, song, seconds) {
  const noise = ac.createBuffer(1, Math.floor(ac.sampleRate * 0.25), ac.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  const r = { ac, out, noise, waves: { pulse12: pulseWave(ac, 0.125), pulse25: pulseWave(ac, 0.25) }, lead: out, seconds };
  if (song.echo) {
    // a soft repeat a dotted eighth later, for the dreamy maps
    const d = ac.createDelay(1);
    d.delayTime.value = seconds * 1.5;
    const fb = ac.createGain();
    fb.gain.value = song.echo;
    const wet = ac.createGain();
    wet.gain.value = 0.6;
    const bus = ac.createGain();
    bus.connect(out);
    bus.connect(d);
    d.connect(fb).connect(d);
    d.connect(wet).connect(out);
    r.lead = bus;
  }
  return r;
}

function voice(r, wave, f, t, dur, vol, env = 'hold', dest = r.out) {
  const { ac } = r;
  const o = ac.createOscillator();
  const g = ac.createGain();
  if (r.waves[wave]) o.setPeriodicWave(r.waves[wave]);
  else o.type = wave;
  o.frequency.setValueAtTime(f, t);
  if (env === 'pluck') {
    // quick ring-out, like a steel drum or a bell
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + Math.min(dur, 0.35));
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  } else {
    g.gain.setValueAtTime(vol, t);
    g.gain.setValueAtTime(vol, t + dur * 0.8);
    g.gain.linearRampToValueAtTime(0.0001, t + dur);
  }
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(r, t, kind, vol = 1) {
  const { ac, out } = r;
  if (kind === 'k' || kind === 't') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    const [from, to, len] = kind === 'k' ? [140, 45, 0.15] : [220, 90, 0.2];
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len * 0.8);
    g.gain.setValueAtTime(0.9 * vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + len + 0.01);
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = r.noise;
  const g = ac.createGain();
  const len = kind === 's' ? 0.12 : kind === 'o' ? 0.18 : 0.03;
  g.gain.setValueAtTime((kind === 's' ? 0.35 : 0.12) * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = kind === 's' ? 1200 : 6000;
  src.connect(hp).connect(g).connect(out);
  src.start(t);
  src.stop(t + len + 0.01);
}

/** How many steps a lead note lasts (its own step plus any '-' after it). */
function holdLength(bar, i) {
  let n = 1;
  while (i + n < bar.length && bar[i + n] === '-') n += 1;
  return n;
}

/**
 * Schedule one step (an eighth note) of a song at time t.
 * Song fields (see songs.js): beat (steps a bar), lead, chords, leadWave, leadVol, leadEnv,
 * arp { wave, from, octave, order, vol }, bass (one [chordToneIndex, octave] or null per step),
 * drums (patterns of k kick, s snare, h hat, o open hat, t tom; split evenly over the 16 bars), swing.
 */
function scheduleStep(r, song, s, t) {
  const { beat } = song;
  const bars = song.lead.length;
  const barIndex = Math.floor(s / beat) % bars;
  const i = s % beat;
  const step = r.seconds;
  // swing pushes every second eighth a little later
  const at = t + (i % 2 ? (song.swing || 0) * step : 0);
  const bar = song.lead[barIndex];
  const tones = song.chords[barIndex];

  // lead (pulse 1)
  const n = bar[i];
  if (n !== '-' && n !== '.') {
    voice(r, song.leadWave || 'square', hz(midi(n)), at, holdLength(bar, i) * step * 0.95, song.leadVol ?? 0.32, song.leadEnv, r.lead);
  }

  // arpeggio (pulse 2), two notes per step
  const arp = song.arp;
  if (arp && barIndex >= (arp.from || 0)) {
    const order = arp.order === 'updown' ? [0, 1, 2, 1] : [0, 1, 2];
    for (let k = 0; k < 2; k += 1) {
      const tone = tones[order[(i * 2 + k) % order.length]];
      voice(r, arp.wave || 'square', hz(tone + ((arp.octave ?? 4) + 1) * 12), at + k * (step / 2), (step / 2) * 0.8, arp.vol ?? 0.07, arp.env);
    }
  }

  // bass (triangle)
  const b = song.bass[i];
  if (b) voice(r, 'triangle', hz(tones[b[0]] + (b[1] + 1) * 12), at, step * (b[2] || 0.9), 0.55);

  // drums
  const sets = song.drums;
  const set = sets[Math.min(sets.length - 1, Math.floor((barIndex * sets.length) / bars))];
  const fill = song.fill && barIndex === bars - 1 ? song.fill : null;
  for (const line of fill || set) {
    const ch = line[i];
    if (ch && ch !== '.') drum(r, at, ch, song.drumVol ?? 1);
  }
}

// ---------- live playback ----------

let ac = null;
let live = null; // { r, song, id, master, timer, step, nextTime }

function tick() {
  const p = live;
  while (p.nextTime < ac.currentTime + 0.25) {
    scheduleStep(p.r, p.song, p.step, p.nextTime);
    p.step = (p.step + 1) % (p.song.lead.length * p.song.beat);
    p.nextTime += p.r.seconds;
  }
}

/** Play the music for a map theme (a background id like 'bg-space'). Switches songs if another is playing. */
export function startMusic(theme = 'bg-meadow') {
  const id = SONGS[theme] ? theme : 'bg-meadow';
  if (live?.id === id) return;
  if (live) stopMusic();
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  const song = compile(id);
  const master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(VOLUME * (song.gain || 1), ac.currentTime + 1.2);
  master.connect(ac.destination);
  live = { id, song, master, r: rig(ac, master, song, 60 / song.bpm / 2), step: 0, nextTime: ac.currentTime + 0.1, timer: 0 };
  ducked = 0;
  tick();
  live.timer = setInterval(tick, 100);
}

export function stopMusic() {
  if (!live) return;
  const { master, timer } = live;
  live = null;
  clearInterval(timer);
  const t = ac.currentTime;
  master.gain.cancelScheduledValues(t);
  master.gain.setValueAtTime(master.gain.value, t);
  master.gain.linearRampToValueAtTime(0.0001, t + 0.3);
  setTimeout(() => master.disconnect(), 1500);
}

export const isMusicPlaying = () => !!live;

/**
 * Turn the map song down while something else is loud (the rainforest's rain shower):
 * 0 is full volume, 1 is the quietest (a bit under half).
 */
let ducked = 0;
export function duckMusic(k = 0) {
  const level = Math.max(0, Math.min(1, k));
  if (!live || Math.abs(level - ducked) < 0.02) return;
  ducked = level;
  const g = live.master.gain;
  const t = ac.currentTime;
  g.cancelScheduledValues(t);
  g.setValueAtTime(Math.max(0.0001, g.value), t);
  g.linearRampToValueAtTime(VOLUME * (live.song.gain || 1) * (1 - 0.55 * level), t + 0.25);
}

/** Render a song's loop to an AudioBuffer (used to make preview files). */
export async function renderSong(theme, loops = 1, sampleRate = 44100) {
  const song = compile(theme);
  const step = 60 / song.bpm / 2;
  const steps = song.lead.length * song.beat * loops;
  const seconds = steps * step + 1.5;
  const off = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const master = off.createGain();
  master.gain.value = VOLUME * (song.gain || 1) * 4;
  master.connect(off.destination);
  const r = rig(off, master, song, step);
  for (let s = 0; s < steps; s += 1) scheduleStep(r, song, s % (song.lead.length * song.beat), 0.05 + s * step);
  return off.startRendering();
}

// ---------- the sheet music stand (see songbook.js) ----------

/**
 * Play one piece from the songbook once: a map song ('bg-meadow') or a show's tune
 * ('show:bg-meadow'), at tempo (1 is the game's speed, 0.7 slower to follow along).
 * Returns { step (seconds an eighth), beat (steps a bar), steps, at() (steps played so far,
 * fractional; negative before the first note), done(), stop() }, or null without sound.
 */
export function playPiece(id, { tempo = 1 } = {}) {
  const a = context();
  if (!a) return null;
  const song = compile(id);
  const step = 60 / song.bpm / 2 / tempo;
  const steps = song.lead.length * song.beat;
  const master = a.createGain();
  master.gain.value = VOLUME * 1.6 * (song.gain || 1);
  master.connect(a.destination);
  const r = rig(a, master, song, step);
  const t0 = a.currentTime + 0.15;
  let next = 0;
  let timer = 0;
  const schedule = () => {
    while (next < steps && t0 + next * step < a.currentTime + 0.3) {
      scheduleStep(r, song, next, t0 + next * step);
      next += 1;
    }
    if (next >= steps) clearInterval(timer);
  };
  schedule();
  timer = setInterval(schedule, 100);
  let stopped = false;
  return {
    step,
    beat: song.beat,
    steps,
    // steps heard so far (the speaker plays a little after the clock, more on Bluetooth)
    at: () => (a.currentTime - (a.outputLatency || a.baseLatency || 0) - t0) / step,
    // done once the last note (and its echo, on the dreamy songs) has faded
    done: () => stopped || a.currentTime > t0 + steps * step + (song.echo ? 1.5 : 0.4),
    stop() {
      if (stopped) return;
      stopped = true;
      clearInterval(timer);
      const t = a.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(0.0001, t + 0.15);
      setTimeout(() => master.disconnect(), 400);
    },
  };
}

// ---------- the secret shows (see mapshow.js) ----------

function context() {
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return null;
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  return ac;
}

/**
 * Play a show's song once (music: false skips it) and its sound effects
 * (sfx: [[seconds, kind]]). The map song goes quiet meanwhile and comes back after.
 */
export function playShowAudio(theme, { music = true, sfx = [] } = {}) {
  const a = context();
  if (!a) return;
  const t0 = a.currentTime + 0.05;
  const song = compile(`show:${theme}`);
  const step = 60 / song.bpm / 2;
  const steps = song.lead.length * song.beat;
  const len = steps * step + 0.6;
  if (live) {
    const g = live.master.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(g.value, t0);
    g.linearRampToValueAtTime(0.0001, t0 + 0.3);
    g.setValueAtTime(0.0001, t0 + len);
    g.linearRampToValueAtTime(VOLUME * (live.song.gain || 1), t0 + len + 1.5);
  }
  const master = a.createGain();
  master.connect(a.destination);
  scheduleShow(a, master, theme, { music, sfx, t0 });
  setTimeout(() => master.disconnect(), (len + 4) * 1000);
}

/** Schedule a show's song (from t0 + 0.2) and sound effects (from t0) into out. */
function scheduleShow(a, out, theme, { music = true, sfx = [], t0 = 0 }) {
  const song = compile(`show:${theme}`);
  const step = 60 / song.bpm / 2;
  const steps = song.lead.length * song.beat;
  const tune = a.createGain();
  tune.gain.value = VOLUME * 1.6;
  tune.connect(out);
  if (music) {
    const r = rig(a, tune, song, step);
    for (let s = 0; s < steps; s += 1) scheduleStep(r, song, s, t0 + 0.2 + s * step);
  }
  const fx = a.createGain();
  fx.gain.value = 0.9;
  fx.connect(out);
  const r = rig(a, fx, song, step);
  for (const [at, kind] of sfx) effect(r, kind, t0 + at);
}

/** Render a show's sound to an AudioBuffer (used to make preview videos). */
export async function renderShow(theme, sfx = [], seconds = 9, sampleRate = 44100) {
  const off = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  scheduleShow(off, off.destination, theme, { sfx, t0: 0.05 });
  return off.startRendering();
}

function noiseHit(r, t, len, type, f0, f1, vol) {
  const { ac: a } = r;
  const src = a.createBufferSource();
  src.buffer = r.noise;
  src.loop = true;
  const f = a.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(f0, t);
  f.frequency.exponentialRampToValueAtTime(f1, t + len);
  const g = a.createGain();
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  src.connect(f).connect(g).connect(r.out);
  src.start(t);
  src.stop(t + len + 0.02);
}

function glide(r, t, len, wave, f0, f1, vol, wobble = 0) {
  const { ac: a } = r;
  const o = a.createOscillator();
  if (r.waves[wave]) o.setPeriodicWave(r.waves[wave]);
  else o.type = wave;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + len);
  if (wobble) {
    const lfo = a.createOscillator();
    const lg = a.createGain();
    lfo.frequency.value = 7;
    lg.gain.value = wobble;
    lfo.connect(lg).connect(o.frequency);
    lfo.start(t);
    lfo.stop(t + len + 0.02);
  }
  const g = a.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + Math.min(0.05, len / 4));
  g.gain.setValueAtTime(vol, t + len * 0.7);
  g.gain.linearRampToValueAtTime(0.0001, t + len);
  o.connect(g).connect(r.out);
  o.start(t);
  o.stop(t + len + 0.02);
}

const PENTA = [1047, 1175, 1319, 1568, 1760, 2093, 2349];

/** One sound effect at time t. */
function effect(r, kind, t) {
  switch (kind) {
    case 'boom': noiseHit(r, t, 0.7, 'lowpass', 1200, 80, 0.5); glide(r, t, 0.3, 'triangle', 90, 40, 0.5); break;
    case 'cannon': noiseHit(r, t, 0.35, 'lowpass', 600, 60, 0.6); glide(r, t, 0.25, 'triangle', 130, 35, 0.6); break;
    case 'whoosh': noiseHit(r, t, 0.7, 'bandpass', 300, 3000, 0.35); break;
    case 'rumble': noiseHit(r, t, 1.4, 'lowpass', 180, 60, 0.6); glide(r, t, 1.2, 'triangle', 55, 40, 0.4, 6); break;
    case 'splash': noiseHit(r, t, 0.5, 'highpass', 800, 3000, 0.35); break;
    case 'pop': glide(r, t, 0.08, 'sine', 700, 300, 0.3); break;
    case 'hoot': glide(r, t, 0.22, 'sine', 560, 480, 0.35); glide(r, t + 0.3, 0.35, 'sine', 520, 430, 0.35); break;
    case 'roar': glide(r, t, 1, 'sawtooth', 220, 70, 0.22, 25); noiseHit(r, t, 1, 'lowpass', 900, 200, 0.3); break;
    case 'screech': glide(r, t, 0.6, 'pulse25', 1800, 900, 0.12, 60); break;
    case 'squawk': glide(r, t, 0.12, 'pulse25', 1300, 900, 0.12, 80); glide(r, t + 0.16, 0.14, 'pulse25', 1400, 950, 0.12, 80); break;
    case 'whee': glide(r, t, 1.1, 'sine', 400, 1600, 0.25); break;
    case 'neigh': for (let i = 0; i < 6; i += 1) glide(r, t + i * 0.07, 0.07, 'pulse25', i % 2 ? 900 : 1100, i % 2 ? 850 : 1000, 0.1); break;
    case 'warp': glide(r, t, 1.3, 'sine', 90, 900, 0.3, 30); break;
    case 'whale': glide(r, t, 1.6, 'sine', 330, 190, 0.35, 8); glide(r, t + 1.4, 1, 'sine', 190, 270, 0.3, 8); break;
    case 'sparkle': for (let i = 0; i < 6; i += 1) glide(r, t + i * 0.07, 0.12, 'square', PENTA[(i * 3) % PENTA.length], PENTA[(i * 3) % PENTA.length], 0.05); break;
    case 'coins': for (let i = 0; i < 8; i += 1) glide(r, t + i * 0.06, 0.1, 'square', i % 2 ? 1976 : 1568, i % 2 ? 1976 : 1568, 0.05); break;
    case 'boing': glide(r, t, 0.35, 'triangle', 200, 600, 0.35, 40); break;
    default: break;
  }
}
