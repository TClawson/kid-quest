// Background music for the quest map: an original 16-bar chiptune loop, synthesized live with
// Web Audio (two square-wave pulses, a triangle bass and noise drums, like old consoles).
// No audio files. A small look-ahead scheduler keeps the timing steady.

const BPM = 132;
const EIGHTH = 60 / BPM / 2;
const VOLUME = 0.07;

// Melody, one bar per line, 8 eighth notes a bar. '-' holds the note, '.' is a rest.
const LEAD = [
  // A: C Am F G | C Em F G
  'E5 - G5 - C6 - B5 A5',
  'G5 - E5 C5 A4 - C5 E5',
  'F5 - A5 - C6 - A5 F5',
  'G5 - - - D5 E5 F5 D5',
  'E5 - G5 - C6 - D6 E6',
  'D6 - B5 - G5 - E5 G5',
  'A5 G5 F5 A5 C6 - A5 -',
  'B5 - D6 - G5 - . .',
  // B: F G Em Am | F G C C
  'A5 - . A5 C6 A5 F5 -',
  'B5 - . B5 D6 B5 G5 -',
  'G5 - B5 - E6 - D6 B5',
  'C6 - - - A5 - E5 -',
  'F5 A5 C6 A5 F5 A5 C6 F6',
  'G5 B5 D6 B5 G5 B5 D6 G6',
  'E6 - D6 - C6 - G5 -',
  'C6 - - - . . . .',
].map((bar) => bar.split(' '));

// chord per bar: root note and chord tones (for bass and the arpeggio)
const CHORDS = ['C', 'Am', 'F', 'G', 'C', 'Em', 'F', 'G', 'F', 'G', 'Em', 'Am', 'F', 'G', 'C', 'C'];
const CHORD_TONES = {
  C: ['C', 'E', 'G'], Am: ['A', 'C', 'E'], F: ['F', 'A', 'C'], G: ['G', 'B', 'D'], Em: ['E', 'G', 'B'],
};
const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

const freq = (name, octave) => 440 * 2 ** ((SEMI[name] + (octave + 1) * 12 - 69) / 12);
const noteFreq = (n) => freq(n[0], Number(n.slice(1)));

let ac = null;
let master = null;
let noise = null;
let timer = 0;
let step = 0; // eighth-note index in the loop
let nextTime = 0;
let playing = false;

function voice(type, f, t, dur, vol) {
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  g.gain.setValueAtTime(vol, t);
  g.gain.setValueAtTime(vol, t + dur * 0.8);
  g.gain.linearRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t);
  o.stop(t + dur + 0.02);
}

function drum(t, kind) {
  if (kind === 'kick') {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = 'triangle';
    o.frequency.setValueAtTime(140, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
    o.connect(g).connect(master);
    o.start(t);
    o.stop(t + 0.16);
    return;
  }
  const src = ac.createBufferSource();
  src.buffer = noise;
  const g = ac.createGain();
  const len = kind === 'snare' ? 0.12 : 0.03;
  g.gain.setValueAtTime(kind === 'snare' ? 0.35 : 0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + len);
  const hp = ac.createBiquadFilter();
  hp.type = 'highpass';
  hp.frequency.value = kind === 'snare' ? 1200 : 6000;
  src.connect(hp).connect(g).connect(master);
  src.start(t);
  src.stop(t + len + 0.01);
}

/** How many eighths a lead note lasts (its own step plus any '-' after it). */
function holdLength(bar, i) {
  let n = 1;
  while (i + n < bar.length && bar[i + n] === '-') n += 1;
  return n;
}

function scheduleStep(s, t) {
  const barIndex = Math.floor(s / 8) % LEAD.length;
  const i = s % 8;
  const bar = LEAD[barIndex];
  const chord = CHORDS[barIndex];
  const tones = CHORD_TONES[chord];

  // lead (pulse 1)
  const n = bar[i];
  if (n !== '-' && n !== '.') voice('square', noteFreq(n), t, holdLength(bar, i) * EIGHTH * 0.95, 0.32);

  // arpeggio (pulse 2), two sixteenths per eighth, only in the B section and the A repeat
  if (barIndex >= 4) {
    for (let k = 0; k < 2; k += 1) {
      const tone = tones[(i * 2 + k) % 3];
      voice('square', freq(tone, 4), t + k * (EIGHTH / 2), EIGHTH / 2 * 0.8, 0.07);
    }
  }

  // bass (triangle): root, octave, fifth pattern
  const root = tones[0];
  const fifth = tones[2];
  const pattern = [[root, 2], null, [root, 3], null, [fifth, 2], null, [root, 3], [fifth, 2]];
  const b = pattern[i];
  if (b) voice('triangle', freq(b[0], b[1]), t, EIGHTH * 0.9, 0.55);

  // drums
  if (i === 0 || i === 4) drum(t, 'kick');
  if (i === 2 || i === 6) drum(t, 'snare');
  drum(t, 'hat');
}

function tick() {
  while (nextTime < ac.currentTime + 0.25) {
    scheduleStep(step, nextTime);
    step = (step + 1) % (LEAD.length * 8);
    nextTime += EIGHTH;
  }
}

export function startMusic() {
  if (playing) return;
  try {
    ac = ac || new (window.AudioContext || window.webkitAudioContext)();
  } catch {
    return;
  }
  if (ac.state === 'suspended') ac.resume().catch(() => {});
  if (!noise) {
    noise = ac.createBuffer(1, ac.sampleRate * 0.2, ac.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) data[i] = Math.random() * 2 - 1;
  }
  master = ac.createGain();
  master.gain.setValueAtTime(0.0001, ac.currentTime);
  master.gain.linearRampToValueAtTime(VOLUME, ac.currentTime + 1.2);
  master.connect(ac.destination);
  step = 0;
  nextTime = ac.currentTime + 0.1;
  playing = true;
  tick();
  timer = setInterval(tick, 100);
}

export function stopMusic() {
  if (!playing) return;
  playing = false;
  clearInterval(timer);
  const g = master;
  const t = ac.currentTime;
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(g.gain.value, t);
  g.gain.linearRampToValueAtTime(0.0001, t + 0.3);
  setTimeout(() => g.disconnect(), 400);
}

export const isMusicPlaying = () => playing;
