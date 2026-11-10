// Background music for the quest map: one original 16-bar chiptune loop per map theme,
// synthesized live with Web Audio (pulse waves, a triangle bass and noise drums, like old
// consoles). No audio files. A small look-ahead scheduler keeps the timing steady.
import { SONGS, SHOW_SONGS, barChords } from './songs.js';
import { VOICES, KITS, DRUM_HALVES } from './studiokit.js';

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

/** A bar's chords ('F', or 'F E' for two that share the bar) as the chord's tones at every step. */
export function stepChords(entry, beat) {
  const parts = barChords(entry, beat).map((c) => chordTones(c.name));
  return Array.from({ length: beat }, (_, i) => parts[Math.floor((i * parts.length) / beat)]);
}

/** Compile a song once: bars of note tokens, and the chord's pitch classes at every step. */
const compiled = new Map();
export function songScore(id) { return compile(id); }
function compile(id) {
  if (compiled.has(id)) return compiled.get(id);
  const s = id.startsWith('show:') ? SHOW_SONGS[id.slice(5)] || SHOW_SONGS['bg-meadow'] : SONGS[id] || SONGS['bg-meadow'];
  const beat = s.beat || 8;
  const song = {
    ...s,
    beat,
    lead: s.lead.map((bar) => bar.split(' ')),
    chords: s.chords.map((entry) => stepChords(entry, beat)),
  };
  compiled.set(id, song);
  return song;
}

/**
 * A song as its sheet music has it: with its closing bar (songs.js: ending) after the loop,
 * if it has one. loop is how many bars go round in the game.
 */
function compilePiece(id) {
  const song = compile(id);
  if (!song.ending) return song;
  return {
    ...song,
    loop: song.lead.length,
    lead: [...song.lead, song.ending.lead.split(' ')],
    chords: [...song.chords, stepChords(song.ending.chord, song.beat)],
  };
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

/**
 * One note. wave: an oscillator type or one of r.waves (the game's own sounds, as they always
 * were), or a voice's settings (studiokit.js VOICES: wave or harm, env, attack, ring,
 * vibrato, twin, soft) for the studio's remix kit.
 */
function voice(r, wave, f, t, dur, vol, env = 'hold', dest = r.out) {
  if (wave && typeof wave === 'object') { styledVoice(r, wave, f, t, dur, vol ?? wave.vol, dest); return; }
  const { ac } = r;
  const o = ac.createOscillator();
  const g = ac.createGain();
  if (r.waves[wave]) o.setPeriodicWave(r.waves[wave]);
  else o.type = wave;
  o.frequency.setValueAtTime(f, t);
  if (env === 'pluck') {
    // quick ring-out, like a steel drum or a bell
    g.gain.setValueAtTime(vol, t);
    // (a short note rings down over most of its length, then fades: never a jump to silence)
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + Math.min(dur * 0.8, 0.35));
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

/** A wave of its own from overtone strengths (a voice's harm), made once for each context. */
function harmWave(r, harm) {
  const key = `harm:${harm.join(',')}`;
  if (!r.waves[key]) {
    const real = new Float32Array(harm.length + 1);
    const imag = new Float32Array(harm.length + 1);
    harm.forEach((v, k) => { imag[k + 1] = v; });
    r.waves[key] = r.ac.createPeriodicWave(real, imag);
  }
  return r.waves[key];
}

/** A note in one of the remix kit's voices (see voice()). */
function styledVoice(r, v, f, t, dur, vol, dest) {
  const { ac } = r;
  const env = v.env || 'hold';
  // a plucked voice with a ring lets a short note ring on
  const len = env === 'pluck' ? Math.max(dur, v.ring || 0) : dur;
  const g = ac.createGain();
  const attack = Math.min(v.attack || 0, len * 0.5);
  if (attack > 0) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + attack);
  } else g.gain.setValueAtTime(vol, t);
  if (env === 'pluck') {
    g.gain.exponentialRampToValueAtTime(vol * 0.25, t + Math.max(attack + 0.005, Math.min(len * 0.8, 0.35)));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
  } else {
    g.gain.setValueAtTime(vol, t + Math.max(attack, len * 0.8));
    g.gain.linearRampToValueAtTime(0.0001, t + len);
  }
  let into = g;
  if (v.soft) {
    // a low-pass takes the edge off
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = Math.min(18000, f * v.soft);
    lp.connect(g);
    into = lp;
  }
  const oscs = [];
  const make = (cents, level) => {
    const o = ac.createOscillator();
    if (v.harm) o.setPeriodicWave(harmWave(r, v.harm));
    else if (r.waves[v.wave]) o.setPeriodicWave(r.waves[v.wave]);
    else o.type = v.wave || 'square';
    o.frequency.setValueAtTime(f, t);
    if (cents) o.detune.value = cents;
    if (level === 1) o.connect(into);
    else { const lg = ac.createGain(); lg.gain.value = level; o.connect(lg).connect(into); }
    oscs.push(o);
  };
  // a twin (a copy a few cents off) makes it fuller (the clip's loudness is set after rendering)
  if (v.twin) { make(0, 0.6); make(v.twin, 0.6); } else make(0, 1);
  const end = t + len + 0.02;
  if (v.vibrato) {
    const lfo = ac.createOscillator();
    const depth = ac.createGain();
    lfo.frequency.value = v.vibrato.rate;
    depth.gain.value = v.vibrato.cents;
    lfo.connect(depth);
    for (const o of oscs) depth.connect(o.detune);
    lfo.start(t);
    lfo.stop(end);
  }
  g.connect(dest);
  for (const o of oscs) { o.start(t); o.stop(end); }
  r.spent?.push({ end, node: g }); // see renderInSlices
}

// the game's own drums (studiokit.js KITS.chip is the same kit, for the studio)
export const GAME_KIT = { kick: [140, 45, 0.15], tom: [220, 90, 0.2], snare: { len: 0.12, hp: 1200, vol: 0.35 }, hat: { len: 0.03, hp: 6000, vol: 0.12 }, open: { len: 0.18, hp: 6000, vol: 0.12 } };

/** One drum: k kick, t tom, s snare, h hat, o open hat. kit: a kit's settings (studiokit.js KITS), else the game's. */
function drum(r, t, kind, vol = 1, kit = null) {
  const { ac, out } = r;
  const K = kit || GAME_KIT;
  if (kind === 'k' || kind === 't') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    const [from, to, len] = kind === 'k' ? K.kick : K.tom;
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
  const hit = kind === 's' ? K.snare : kind === 'o' ? K.open : K.hat;
  const { len } = hit;
  if (len > r.noise.duration) src.loop = true; // a long open hat outlasts the noise
  const g = ac.createGain();
  g.gain.setValueAtTime(hit.vol * vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = hit.hp;
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
 * Song fields (see songs.js): beat (steps a bar), lead, chords (compiled: the chord's tones at
 * every step of every bar), loop (bars that go round, before a closing bar), leadWave, leadVol, leadEnv,
 * arp { wave, from, octave, order, vol }, bass (one [chordToneIndex, octave] or null per step),
 * drums (patterns of k kick, s snare, h hat, o open hat, t tom; split evenly over the 16 bars), swing.
 * only: just one part ('lead', 'arp', 'bass' or 'drums'), for the recording studio; or a
 * piece of one: 'hook' (the tune), 'beat' (the drums' kick, snare and toms) or 'cymbals' (the
 * drums' hats). Without it, everything plays as it always has.
 */
function scheduleStep(r, song, s, t, only = null) {
  const { beat } = song;
  const bars = song.loop || song.lead.length; // the bars that go round
  const barIndex = Math.floor(s / beat) % song.lead.length;
  const i = s % beat;
  const step = r.seconds;
  // swing pushes every second eighth a little later
  const at = t + (i % 2 ? (song.swing || 0) * step : 0);
  const bar = song.lead[barIndex];
  const tones = song.chords[barIndex][i];

  // lead (pulse 1)
  const n = bar[i];
  if ((!only || only === 'lead' || only === 'hook') && n !== '-' && n !== '.') {
    voice(r, song.leadWave || 'square', hz(midi(n)), at, holdLength(bar, i) * step * 0.95, song.leadVol ?? 0.32, song.leadEnv, r.lead);
  }

  // the closing bar the sheet music adds after the loop: the band lands on one held chord
  if (barIndex >= bars) {
    if (i === 0) {
      voice(r, 'triangle', hz(tones[0] + 36), at, step * beat * 0.9, 0.55);
      tones.forEach((tone, k) => voice(r, song.arp?.wave || 'square', hz(tone + 60), at + k * 0.03, step * beat * 0.8, (song.arp?.vol ?? 0.07) * 0.8));
      drum(r, at, 'k', song.drumVol ?? 1);
      drum(r, at, 'o', song.drumVol ?? 1);
    }
    return;
  }

  // arpeggio (pulse 2), two notes per step
  const arp = song.arp;
  if (arp && (!only || only === 'arp') && barIndex >= (arp.from || 0)) {
    // four notes to a beat either way, so the pattern keeps the song's beat (three would turn
    // around every dotted eighth and sound like a rhythm of its own)
    const order = arp.order === 'updown' ? [0, 1, 2, 1] : [0, 2, 1, 2];
    // (a swung eighth is long or short, and its two notes share it evenly)
    const half = (step * (1 + (i % 2 ? -1 : 1) * (song.swing || 0))) / 2;
    for (let k = 0; k < 2; k += 1) {
      const tone = tones[order[(i * 2 + k) % order.length]];
      voice(r, arp.wave || 'square', hz(tone + ((arp.octave ?? 4) + 1) * 12), at + k * half, half * 0.8, arp.vol ?? 0.07, arp.env);
    }
  }

  // bass (triangle)
  const b = song.bass[i];
  if (b && (!only || only === 'bass')) voice(r, 'triangle', hz(tones[b[0]] + (b[1] + 1) * 12), at, step * (b[2] || 0.9), 0.55);

  // drums
  if (only && only !== 'drums' && !DRUM_HALVES[only]) return;
  const half = only ? DRUM_HALVES[only] : null;
  const sets = song.drums;
  const set = sets[Math.min(sets.length - 1, Math.floor((barIndex * sets.length) / bars))];
  const fill = song.fill && barIndex === bars - 1 ? song.fill : null;
  for (const line of fill || set) {
    const ch = line[i];
    if (ch && ch !== '.' && (!half || half.includes(ch))) drum(r, at, ch, song.drumVol ?? 1);
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

// ---------- the recording studio (see studio.js) ----------

/**
 * The parts of a song the studio can use on their own: the tune and its hook (its first two
 * bars), the arpeggio, the bass, the drums, and the drums' two halves (the kick and snare,
 * the cymbals) when the drums have them.
 */
export function songParts(id) {
  const song = compile(id);
  const lines = [...song.drums.flat(), ...(song.fill || [])];
  const has = (chars) => lines.some((line) => [...line].some((ch) => chars.includes(ch)));
  return [
    'lead', 'hook', ...(song.arp ? ['arp'] : []), ...(song.bass.some(Boolean) ? ['bass'] : []),
    ...(song.drums.some((set) => set.some((line) => /[^.]/.test(line))) ? ['drums'] : []),
    ...(has(DRUM_HALVES.beat) ? ['beat'] : []), ...(has(DRUM_HALVES.cymbals) ? ['cymbals'] : []),
  ];
}

/** How many bars of a song a part lasts: the hook is its first 2 bars, the rest the whole song. */
export const partBars = (id, part) => (part === 'hook' ? Math.min(2, compile(id).lead.length) : compile(id).lead.length);

/**
 * How a song plays one part, to play it some other way: { steps (once through), swing, echo
 * (the tune's), drumVol, voice (its own sound as voice settings, for a note part) }.
 */
export function partStyle(id, part) {
  const song = compile(id);
  const own = {
    lead: { wave: song.leadWave || 'square', env: song.leadEnv || 'hold', vol: song.leadVol ?? 0.32 },
    arp: { wave: song.arp?.wave || 'square', env: song.arp?.env || 'hold', vol: song.arp?.vol ?? 0.07 },
    bass: { wave: 'triangle', env: 'hold', vol: 0.55 },
  };
  own.hook = own.lead;
  return {
    steps: partBars(id, part) * song.beat, swing: song.swing || 0, echo: ['lead', 'hook'].includes(part) ? song.echo || 0 : 0,
    drumVol: song.drumVol ?? 1, voice: own[part] || null,
  };
}

/**
 * One part of a song, once through, as an AudioBuffer at the studio's speed (bpm). The
 * arpeggio plays from the first bar (in the game it waits a few bars). Peaks at about `peak`.
 */
export async function renderPart(id, part, bpm, sampleRate = 44100, peak = 0.5, alive = null) {
  const base = compile(id);
  const song = part === 'arp' && base.arp ? { ...base, arp: { ...base.arp, from: 0 } } : base;
  const step = 60 / bpm / 2;
  const steps = partBars(id, part) * song.beat;
  const off = new OfflineAudioContext(1, Math.ceil((steps * step + (song.echo && (part === 'lead' || part === 'hook') ? 1.5 : 0.3)) * sampleRate), sampleRate);
  const r = rig(off, off.destination, song, step);
  const buf = await renderInSlices(off, r, (from, to) => {
    const last = Math.min(steps, Math.ceil(to / step));
    for (let s = Math.max(0, Math.ceil(from / step)); s < last; s += 1) scheduleStep(r, song, s, s * step, part);
  }, alive);
  return toLevel(buf, peak);
}

/**
 * Render an OfflineAudioContext, handing it the notes a second at a time. A note that waits in
 * the context costs a little on every block of sound until it has played, so a whole song
 * handed over at once took far longer than its length (four times the notes took twelve times
 * as long). plan(from, to) schedules everything that starts in [from, to) seconds; it is called
 * with stretches that together cover the whole sound, each once (in order, unless a pause is
 * refused: then its stretch comes early). alive(): once it
 * says false no more notes are handed over, and the rest renders quickly as silence (for a
 * sound nobody is waiting for any more). r: the rig; notes put themselves on r.spent to be
 * taken out of the context after they end.
 */
const SLICE = 1;     // seconds of notes handed over at a time
const AHEAD = 0.05;  // and this long before they sound (a pause lands on a whole block, a few ms late)
function renderInSlices(off, r, plan, alive = null) {
  const pauses = [];
  r.spent = []; // notes that can be taken out of the context once they have sounded: { end, node }
  if (typeof off.suspend === 'function') {
    // a pause must fall on a block boundary inside the sound
    for (let t = SLICE; Math.ceil((t * off.sampleRate) / 128) * 128 < off.length; t += SLICE) pauses.push(t);
  }
  const upTo = (i) => (i < pauses.length ? pauses[i] + AHEAD : Infinity);
  plan(0, upTo(0));
  pauses.forEach((t, i) => {
    off.suspend(t).then(() => {
      try {
        // a finished note with two oscillators stays in the context (and keeps costing) unless it is taken out
        r.spent = r.spent.filter(({ end, node }) => {
          if (end + AHEAD > t) return true;
          try { node.disconnect(); } catch { /* gone already */ }
          return false;
        });
        if (!alive || alive()) plan(t + AHEAD, upTo(i + 1));
      } finally { off.resume(); }
    }, () => {
      // this pause was refused: hand its stretch over now, early, so no note is lost
      if (!alive || alive()) plan(t + AHEAD, upTo(i + 1));
    });
  });
  return off.startRendering();
}

/**
 * Set a rendered sound's loudness (peak 0: leave it as it is). A sound as steady as the game's
 * square-wave tune gets its loudest sample at `peak`. A sound that is mostly quiet under a few
 * tall peaks (a plucked voice, drums) would be much softer to the ear at the same peak, so it
 * gets half of the difference back (in decibels), at most LIFT times: its peaks then stand
 * above `peak`, which the studio's soft clip has room for.
 */
const STEADY = 0.77; // a square-wave tune's average level (RMS) over its loudest sample, as measured
const LIFT = 1.6;    // about 4 dB
export function levelGain(top, rms, peak) {
  if (!(peak > 0) || !(top > 0)) return 1;
  const lift = rms > 0 ? Math.min(LIFT, Math.max(1, Math.sqrt((STEADY * top) / rms))) : 1;
  return (peak / top) * lift;
}
function toLevel(buf, peak) {
  const data = buf.getChannelData(0);
  let top = 0;
  let sum = 0;
  for (let i = 0; i < data.length; i += 1) { top = Math.max(top, Math.abs(data[i])); sum += data[i] * data[i]; }
  const gain = levelGain(top, Math.sqrt(sum / Math.max(1, data.length)), peak);
  if (gain !== 1) for (let i = 0; i < data.length; i += 1) data[i] *= gain;
  return buf;
}

/**
 * Notes or drums as an AudioBuffer, for the studio's remix kit (see remix.js): events are
 * notes { at, len (steps), midi } or drums { at, kind }, `steps` long (eighth notes) at bpm.
 * voice: a VOICES id or voice settings, for the notes; kit: a KITS id or kit settings, for the
 * drums (the game's own when absent); shift: semitones every note moves; swing: as in a song
 * (every second eighth comes late); echo: a song's echo; vol: the drums' loudness; peak: as
 * in renderPart (0 leaves it as it comes out); alive: see renderInSlices.
 */
export async function renderEvents(events, { bpm, steps, voice: v = 'beep', kit = null, shift = 0, swing = 0, echo = 0, vol = 1, sampleRate = 44100, peak = 0.5, alive = null } = {}) {
  const settings = typeof v === 'string' ? VOICES[v] || VOICES.beep : v;
  const K = typeof kit === 'string' ? KITS[kit] || null : kit;
  const step = 60 / bpm / 2;
  const tail = echo ? 1.5 : 0.3 + (settings.env === 'pluck' ? settings.ring || 0 : 0);
  const off = new OfflineAudioContext(1, Math.ceil((steps * step + tail) * sampleRate), sampleRate);
  const r = rig(off, off.destination, { echo }, step);
  const timed = events.map((e) => ({ e, at: swingAt(e.at, swing) * step })).sort((x, y) => x.at - y.at);
  let next = 0;
  const buf = await renderInSlices(off, r, (from, to) => {
    for (; next < timed.length && timed[next].at < to; next += 1) {
      const { e, at } = timed[next];
      if (e.kind) drum(r, at, e.kind, vol, K);
      else voice(r, settings, hz(e.midi + shift), at, e.len * step, settings.vol, settings.env, r.lead);
    }
  }, alive);
  return toLevel(buf, peak);
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
  const song = compilePiece(id);
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

/**
 * Where a spot in the music (in eighths) falls when the song swings: every second eighth comes
 * `swing` of an eighth late (as scheduleStep plays it), and what lies between moves with it.
 */
export function swingAt(x, swing = 0) {
  const pair = Math.floor(x / 2) * 2;
  const r = x - pair;
  return pair + (r < 1 ? r * (1 + swing) : 1 + swing + (r - 1) * (1 - swing));
}

/**
 * Play a piano version from the songbook (arrange.js): notes [{ midi, start, len, hand }] in
 * eighths, with a soft piano-like voice, bpm at tempo; steps a bar; swing as in the song.
 * Returns the same handle as playPiece, or null without sound.
 */
export function playNotes(notes, { bpm, beat, tempo = 1, swing = 0 }) {
  const a = context();
  if (!a) return null;
  const step = 60 / bpm / 2 / tempo;
  // a swung song plays its piano versions swung, like the game does
  if (swing) notes = notes.map((n) => ({ ...n, start: swingAt(n.start, swing), len: swingAt(n.start + n.len, swing) - swingAt(n.start, swing) }));
  const steps = Math.ceil(Math.max(0, ...notes.map((n) => n.start + n.len)) / beat) * beat;
  const master = a.createGain();
  master.gain.value = 0.55;
  const squash = a.createDynamicsCompressor(); // many notes at once stay below clipping
  master.connect(squash).connect(a.destination);
  const t0 = a.currentTime + 0.15;
  const list = [...notes].sort((x, y) => x.start - y.start);
  let next = 0;
  let timer = 0;
  const schedule = () => {
    while (next < list.length && t0 + list[next].start * step < a.currentTime + 0.3) {
      const n = list[next];
      pianoNote(a, master, n.midi, t0 + n.start * step, n.len * step, n.hand === 'lh' ? 0.11 : 0.14);
      next += 1;
    }
    if (next >= list.length) clearInterval(timer);
  };
  schedule();
  timer = setInterval(schedule, 100);
  let stopped = false;
  return {
    step,
    beat,
    steps,
    at: () => (a.currentTime - (a.outputLatency || a.baseLatency || 0) - t0) / step,
    done: () => stopped || a.currentTime > t0 + steps * step + 0.8,
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

/** One piano-ish note: a soft triangle with a touch of its octave, struck and dying away. */
function pianoNote(a, out, midi, t, dur, vel) {
  const f = 440 * 2 ** ((midi - 69) / 12);
  const g = a.createGain();
  const tone = a.createBiquadFilter();
  tone.type = 'lowpass';
  tone.frequency.value = Math.min(6000, f * 5);
  const o1 = a.createOscillator();
  o1.type = 'triangle';
  o1.frequency.value = f;
  const o2 = a.createOscillator();
  o2.frequency.value = f * 2;
  const g2 = a.createGain();
  g2.gain.value = 0.2;
  o1.connect(tone);
  o2.connect(g2).connect(tone);
  tone.connect(g).connect(out);
  const end = t + Math.max(0.08, dur);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vel, t + 0.006);
  g.gain.setTargetAtTime(vel * 0.15, t + 0.006, 0.5); // the strike dies away while held
  g.gain.setTargetAtTime(0, end, 0.06); // and stops when the key comes up
  o1.start(t);
  o2.start(t);
  o1.stop(end + 0.5);
  o2.stop(end + 0.5);
  o1.onended = () => g.disconnect();
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
