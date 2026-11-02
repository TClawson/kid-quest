// Background music for the quest map: one original 16-bar chiptune loop per map theme,
// synthesized live with Web Audio (pulse waves, a triangle bass and noise drums, like old
// consoles). No audio files. A small look-ahead scheduler keeps the timing steady.
import { SONGS } from './songs.js';

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
  const s = SONGS[id] || SONGS['bg-meadow'];
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
