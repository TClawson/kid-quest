// The composing desk's music, with no screen: keys, the chords of a key by job, the three
// timings (4/4, 3/4 and 6/8), the tune maker, what the desk "hears" in a kid's chords and tune,
// and the notes a song plays. A song is eight bars of chords with a tune over them, played
// twice with something changed the second time: sixteen bars, about thirty seconds, looping.
// composedesk.js draws the desk; this file is pure logic, so tests can run it.
//
// How much the desk helps (HELP) opens with the pianos: lots with the first piano, some with
// the upright and little with the rock star piano (musicTier). A kid can always pick more help.

// ---------- keys ----------

export const SHARP = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];
export const FLAT = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'];
export const SCALE = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
export const MODES = ['major', 'minor'];

/** The help levels, from most help to least, and the piano tier (musicrules.js) that opens each. */
export const HELP = [
  { id: 0, name: 'Lots of help', short: 'Lots', tier: 1 },
  { id: 1, name: 'Some help', short: 'Some', tier: 2 },
  { id: 2, name: 'Little help', short: 'Little', tier: 3 },
];
/** The least help a kid's pianos allow: 0 for the first piano, up to 2 for the rock star piano. */
export const helpOpen = (tier) => Math.max(0, Math.min(2, (tier || 1) - 1));

// home notes (pitch classes) for each mood, in the order the help levels add them
const KEYS = {
  major: [[0, 7, 5], [2, 10, 9], [4, 3, 8, 11, 1, 6]],
  minor: [[9, 4, 2], [11, 7, 0], [6, 1, 5, 10, 3, 8]],
};
/** The home notes a kid can pick at a help level, low to high. */
export function homeNotes(mode, help) {
  if (help >= 2) return [...Array(12).keys()];
  return KEYS[mode].slice(0, help + 1).flat().sort((a, b) => a - b);
}

/** Whether a key is written with flats (F major, D minor and so on) rather than sharps. */
export const usesFlats = (key) => (key.mode === 'major' ? [5, 10, 3, 8, 1] : [2, 7, 0, 5, 10, 3]).includes(key.tonic);
/** A note's name (pitch class or MIDI number) in a key. */
export const noteName = (key, n) => (usesFlats(key) ? FLAT : SHARP)[((n % 12) + 12) % 12];
/** A MIDI note's name with its octave, like C4 (middle C) or F♯3. */
export const pitchName = (key, m) => `${noteName(key, m)}${Math.floor(m / 12) - 1}`;
/** The key's name, like "D minor". */
export const keyName = (key) => `${noteName(key, key.tonic)} ${key.mode}`;
/** The home note as a MIDI number, from G3 to F♯4 (the middle of the tune grid). */
export const homeMidi = (key) => 60 + key.tonic - (key.tonic > 6 ? 12 : 0);
/** The key's notes as pitch classes; minor adds its raised seventh (the pull chord's leaning note). */
export function keyNotes(key) {
  const s = SCALE[key.mode].map((i) => (key.tonic + i) % 12);
  if (key.mode === 'minor') s.push((key.tonic + 11) % 12);
  return s;
}

// ---------- chords ----------

// Each chord: its roman numeral (rn), its root above home (r, in semitones), its kind (q: ''
// major, 'm' minor, '7' seventh), its job and the first help level that shows it (lvl).
export const CHORDS = {
  major: [
    { rn: 'I', r: 0, q: '', job: 'home', lvl: 0, what: 'Home. Songs start and end here.' },
    { rn: 'vi', r: 9, q: 'm', job: 'home', lvl: 0, what: 'Home’s sad cousin. It shares two notes with home.' },
    { rn: 'IV', r: 5, q: '', job: 'away', lvl: 0, what: 'Away. Bright and open, a step out the door.' },
    { rn: 'ii', r: 2, q: 'm', job: 'away', lvl: 1, what: 'A softer away. It loves to go to the pull chord next.' },
    { rn: 'V', r: 7, q: '', job: 'pull', lvl: 0, what: 'The pull. One of its notes sits just under home and leans into it.' },
    { rn: 'V7', r: 7, q: '7', job: 'pull', lvl: 1, what: 'An even stronger pull, with one extra leaning note.' },
    { rn: 'iii', r: 4, q: 'm', job: 'home', lvl: 2, what: 'Home in shadow. Rare and dreamy.' },
    { rn: '♭VII', r: 10, q: '', job: 'borrow', lvl: 2, what: 'Borrowed from minor. A big movie-adventure landing on home.' },
    { rn: 'iv', r: 5, q: 'm', job: 'borrow', lvl: 2, what: 'Borrowed from minor. A sigh just before home.' },
  ],
  minor: [
    { rn: 'i', r: 0, q: 'm', job: 'home', lvl: 0, what: 'Home. In minor, home is cloudy.' },
    { rn: 'VI', r: 8, q: '', job: 'away', lvl: 0, what: 'Away, big and warm. It shares two notes with home.' },
    { rn: 'iv', r: 5, q: 'm', job: 'away', lvl: 0, what: 'Away, and darker still.' },
    { rn: 'V', r: 7, q: '', job: 'pull', lvl: 0, what: 'The pull. Its middle note is raised so it leans right into home.' },
    { rn: 'III', r: 3, q: '', job: 'home', lvl: 1, what: 'Home’s sunny cousin. It shares two notes with home.' },
    { rn: 'VII', r: 10, q: '', job: 'pull', lvl: 0, what: 'The step below home. A bold, marching pull.' },
    { rn: 'V7', r: 7, q: '7', job: 'pull', lvl: 1, what: 'The strongest pull.' },
    { rn: 'v', r: 7, q: 'm', job: 'borrow', lvl: 2, what: 'A soft pull with no leaning note. Old and folky.' },
    { rn: 'IV', r: 5, q: '', job: 'borrow', lvl: 2, what: 'Borrowed from major. A ray of light in a minor song.' },
  ],
};
export const JOB_NAME = { home: 'Home', away: 'Away', pull: 'Pull', borrow: 'Borrowed' };

/** Ready chord paths for lots of help: eight bars each, a question and an answer. */
export const PATHS = {
  major: [
    { name: 'The trip', bars: ['I', 'IV', 'I', 'V', 'I', 'IV', 'V', 'I'], why: 'Home, away, home, pull. Then the same trip again, landing home.' },
    { name: 'Sad cousin', bars: ['I', 'vi', 'IV', 'V', 'I', 'vi', 'V', 'I'], why: 'The sad cousin brings a cloud for one bar.' },
    { name: 'Round and round', bars: ['I', 'V', 'vi', 'IV', 'I', 'V', 'vi', 'IV'], why: 'It never lands, so it is made for a loop. Lots of pop songs.' },
  ],
  minor: [
    { name: 'The trip', bars: ['i', 'iv', 'i', 'V', 'i', 'iv', 'V', 'i'], why: 'Home, away, home, pull. Then again, landing home.' },
    { name: 'Big sky', bars: ['i', 'VI', 'iv', 'V', 'i', 'VI', 'V', 'i'], why: 'VI opens the sky for a bar before the pull.' },
    { name: 'Staircase', bars: ['i', 'VII', 'VI', 'V', 'i', 'VII', 'VI', 'V'], why: 'Steps down and down, then the pull jumps back to the top. Made for a loop.' },
  ],
};

export const chordDef = (mode, rn) => CHORDS[mode].find((c) => c.rn === rn) || CHORDS[mode][0];
export const homeChord = (mode) => CHORDS[mode][0];
/** The chords a help level shows. */
export const chordsAt = (mode, help) => CHORDS[mode].filter((c) => c.lvl <= help);
/** A chord's name in a key, like "Am" or "B♭" or "E7". */
export const chordName = (key, c) => {
  // the borrowed chord a step under home (♭VII) is a flat, even in a sharp key: B♭ in C major, not A♯
  const flat = key.mode === 'major' && c.r === 10;
  return (flat ? FLAT : usesFlats(key) ? FLAT : SHARP)[(key.tonic + c.r) % 12] + c.q;
};
/** A chord's notes as pitch classes. */
export function chordPcs(key, c) {
  const root = (key.tonic + c.r) % 12;
  const iv = c.q === 'm' ? [0, 3, 7] : c.q === '7' ? [0, 4, 7, 10] : [0, 4, 7];
  return iv.map((i) => (root + i) % 12);
}
/** How the left hand plays a chord: a bass note (E2 to D♯3) and the chord packed from F3 up. */
export function voicing(key, c) {
  const root = (key.tonic + c.r) % 12;
  let bass = 36 + root;
  if (bass < 40) bass += 12;
  const tones = chordPcs(key, c).map((pc) => 53 + ((pc - 5 + 12) % 12)).sort((a, b) => a - b);
  return { bass, tones };
}

// what tends to come next, by job: the chords that glow with some help
const NEXT = { home: ['away', 'pull'], away: ['pull', 'home'], pull: ['home'], borrow: ['home'] };
/** The jobs that fit after a chord (the desk makes their chords glow). */
export const fitsAfter = (c) => NEXT[c.job] || [];

/** The same chords in the other mood, job for job (switching major and minor keeps the plan). */
const SWAP = { I: 'i', vi: 'VI', IV: 'iv', ii: 'iv', V: 'V', V7: 'V7', iii: 'III', '♭VII': 'VII', iv: 'iv', i: 'I', VI: 'vi', III: 'iii', VII: '♭VII', v: 'V' };
export function swapBars(bars, from, to, help) {
  if (from === to) return bars.slice();
  return bars.map((rn) => {
    const want = from === 'major' && rn === 'iv' ? 'iv' : SWAP[rn];
    const d = CHORDS[to].find((c) => c.rn === want);
    return d && d.lvl <= help ? want : CHORDS[to][0].rn;
  });
}

// ---------- timing ----------

// Each timing counts the tune in eighth notes (steps): how many to a bar, which are the big
// beats, where the counted beats are, the default speed (beats a minute, in that timing's beat)
// that makes sixteen bars about thirty seconds, and the speeds the slider allows.
export const METERS = {
  '4/4': { id: '4/4', name: '4/4', steps: 8, beat: 2, strong: [0, 4], beats: [0, 2, 4, 6], bpm: 128, min: 96, max: 152, step: 4, what: 'Four beats a bar. Marching, rock and pop.' },
  '3/4': { id: '3/4', name: '3/4', steps: 6, beat: 2, strong: [0], beats: [0, 2, 4], bpm: 96, min: 72, max: 132, step: 4, what: 'Three beats a bar: ONE two three. A waltz.' },
  '6/8': { id: '6/8', name: '6/8', steps: 6, beat: 3, strong: [0, 3], beats: [0, 3], bpm: 64, min: 48, max: 80, step: 2, what: 'Two big beats, each split in three: ONE-and-a TWO-and-a. Rolling, skipping, a sea shanty.' },
};
export const METER_IDS = Object.keys(METERS);
export const BARS = 8;
export const PASSES = 2;
/** Seconds per eighth note. */
export const eighth = (meter, bpm) => 60 / (bpm * METERS[meter].beat);
/** Seconds the whole loop lasts (eight bars, twice). */
export const loopSeconds = (meter, bpm) => BARS * PASSES * METERS[meter].steps * eighth(meter, bpm);
/** Steps in the tune. */
export const tuneLength = (meter) => BARS * METERS[meter].steps;

/**
 * The tune in another timing: each bar's notes move to the nearest free step of the new bar
 * (in proportion), and a note squeezed out by a neighbour is dropped.
 */
export function convertTune(tune, from, to) {
  const a = METERS[from].steps;
  const b = METERS[to].steps;
  const out = Array(BARS * b).fill(null);
  if (a === b) return tune.slice(0, out.length).concat(Array(Math.max(0, out.length - tune.length)).fill(null));
  for (let bar = 0; bar < BARS; bar += 1) {
    for (let s = 0; s < a; s += 1) {
      const v = tune[bar * a + s];
      if (v === null || v === undefined) continue;
      const at = bar * b + Math.min(b - 1, Math.round((s * b) / a));
      if (out[at] === null) out[at] = v;
    }
  }
  return out;
}

// ---------- the song ----------

export const GROOVES = {
  steady: { name: 'Steady', what: { '4/4': 'Bass on 1 and 3, chords on 2 and 4. A march or a pop song.', '3/4': 'Oom-pah-pah: a low bass, then two chords. A classic waltz.', '6/8': 'Bass on each big beat, a chord after it. A rolling jig.' } },
  bouncy: { name: 'Bouncy', what: { '4/4': 'The short notes swing: long-short, long-short. Jazzy and playful.', '3/4': 'A swinging waltz: the short notes lean long-short.', '6/8': 'Short, light chords skip in between the big beats.' } },
  rolling: { name: 'Rolling', what: { '4/4': 'The chord rolls up and down in eighths. Smooth and flowing.', '3/4': 'The chord rolls up and down: smooth, like a music box.', '6/8': 'The chord rocks up and down like a boat on waves.' } },
};
export const VOICES = { piano: 'Piano', chip: 'Chiptune', flute: 'Flute' };
export const DRUMS = { none: 'None', second: 'Second time', both: 'Both times' };
export const SECONDS = {
  same: { name: 'Same', what: 'The same both times. The drums can still make it grow.' },
  high: { name: 'Up high', what: 'Up an octave: the same notes, higher and brighter. A classic way to lift a song.' },
  echo: { name: 'With an echo', what: 'A soft copy follows a beat behind, up high, like an echo in a cave.' },
};
export const SONG_SLOTS = 6;
export const NAME_MOST = 28;

/** A fresh song: lots of help, C major, 4/4, the first path and no tune yet. */
export function newSong(help = 0) {
  return {
    v: 1, name: '', key: { tonic: 0, mode: 'major' }, meter: '4/4', bars: PATHS.major[0].bars.slice(),
    tune: Array(tuneLength('4/4')).fill(null), groove: 'steady', voice: 'piano', drums: 'second', second: 'high',
    bpm: METERS['4/4'].bpm, help, seed: 1,
  };
}

/** A song read back from the tablet, tidied (anything odd becomes the default); null when it isn't one. */
export function cleanSong(s) {
  if (!s || typeof s !== 'object') return null;
  const out = newSong(Number.isInteger(s.help) && s.help >= 0 && s.help <= 2 ? s.help : 0);
  const mode = MODES.includes(s.key?.mode) ? s.key.mode : 'major';
  const tonic = Number.isInteger(s.key?.tonic) && s.key.tonic >= 0 && s.key.tonic < 12 ? s.key.tonic : 0;
  out.key = { tonic, mode };
  out.meter = METERS[s.meter] ? s.meter : '4/4';
  out.bars = Array.isArray(s.bars) && s.bars.length === BARS && s.bars.every((rn) => CHORDS[mode].some((c) => c.rn === rn)) ? s.bars.slice() : PATHS[mode][0].bars.slice();
  const len = tuneLength(out.meter);
  out.tune = Array.isArray(s.tune) && s.tune.length === len && s.tune.every((v) => v === null || v === 'z' || (Number.isInteger(v) && v >= 36 && v <= 96)) ? s.tune.slice() : Array(len).fill(null);
  out.groove = GROOVES[s.groove] ? s.groove : 'steady';
  out.voice = VOICES[s.voice] ? s.voice : 'piano';
  out.drums = DRUMS[s.drums] ? s.drums : 'second';
  out.second = SECONDS[s.second] ? s.second : 'high';
  const m = METERS[out.meter];
  out.bpm = Number.isFinite(s.bpm) ? Math.max(m.min, Math.min(m.max, Math.round(s.bpm))) : m.bpm;
  out.name = typeof s.name === 'string' ? s.name.trim().slice(0, NAME_MOST) : '';
  out.seed = Number.isInteger(s.seed) ? s.seed : 1;
  if (Number.isFinite(s.at)) out.at = s.at;
  if (Number.isInteger(s.slot) && s.slot >= 0 && s.slot < SONG_SLOTS) out.slot = s.slot; // a draft: the shelf slot it came from
  return out;
}

/** Whether a song has any notes in its tune. */
export const hasTune = (song) => song.tune.some((v) => Number.isInteger(v));

/** The first free slot on a shelf, or -1 when it is full. */
export const freeSongSlot = (shelf) => shelf.findIndex((s) => !s);

/** What is sounding at each step: a note, 'z' for a rest, or null before the first note. */
export function sounding(tune) {
  let cur = null;
  return tune.map((v) => { if (v !== null) cur = v; return cur; });
}

/** The pitches in the tune grid, top first: a fifth under home to a tenth over it. */
export function gridRows(song, help) {
  const t = homeMidi(song.key);
  const inKey = keyNotes(song.key);
  const out = [];
  for (let m = t + 16; m >= t - 5; m -= 1) if (help >= 2 || inKey.includes(m % 12) || song.tune.includes(m)) out.push(m);
  return out;
}

/** The tune moved to another key: the same steps of the scale (so a major tune becomes minor). */
export function moveTune(tune, from, to) {
  const oldT = homeMidi(from);
  const newT = homeMidi(to);
  const a = SCALE[from.mode];
  const b = SCALE[to.mode];
  return tune.map((v) => {
    if (!Number.isInteger(v)) return v;
    const rel = v - oldT;
    const oct = Math.floor(rel / 12);
    const inOct = ((rel % 12) + 12) % 12;
    const deg = a.indexOf(inOct);
    return newT + oct * 12 + (deg >= 0 ? b[deg] : inOct);
  });
}

// ---------- the tune maker ----------

/** Rhythms for the tune maker: the steps a note starts on in a bar, per timing. */
export const RHYTHMS = {
  calm: { name: 'Calm', '4/4': [0, 4], '3/4': [0], '6/8': [0, 3] },
  steady: { name: 'Steady', '4/4': [0, 2, 4, 6], '3/4': [0, 2, 4], '6/8': [0, 2, 3, 5] },
  skippy: { name: 'Skippy', '4/4': [0, 3, 4, 7], '3/4': [0, 3, 4], '6/8': [0, 2, 3] },
  busy: { name: 'Busy', '4/4': [0, 1, 2, 4, 6], '3/4': [0, 1, 2, 4], '6/8': [0, 1, 2, 3, 4, 5] },
};
const CADENCE = { '4/4': [[0, 2], [0]], '3/4': [[0, 4], [0]], '6/8': [[0, 3], [0]] };
export const SHAPES = {
  climb: { name: 'Climb', icon: '⤴', f: (x) => 0.15 + 0.7 * x },
  fall: { name: 'Fall', icon: '⤵', f: (x) => 0.85 - 0.65 * x },
  hill: { name: 'Hill', icon: '⌒', f: (x) => 0.2 + 0.7 * Math.sin(Math.PI * Math.min(1, x * 1.15)) },
  wave: { name: 'Wave', icon: '∿', f: (x) => 0.45 + 0.3 * Math.sin(2 * Math.PI * x * 1.5) },
};

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * A tune for the song's chords from a shape and a rhythm: the big beats land on notes of the
 * bar's chord along the shape, the notes between step toward the next one, bar 4 holds a
 * question and bar 8 comes home, and bar 5 (the answer) starts like bar 1. seed picks one of
 * many such tunes.
 */
export function makeTune(song, { shape = 'hill', rhythm = 'steady', seed = 1 } = {}) {
  const m = METERS[song.meter];
  const r = rng(seed * 7919 + shape.length * 31 + rhythm.length * 7 + m.steps);
  const scale = SCALE[song.key.mode].map((i) => (song.key.tonic + i) % 12);
  const T = homeMidi(song.key);
  const sc = [];
  for (let n = T - 5; n <= T + 14; n += 1) if (scale.includes(n % 12)) sc.push(n);
  const base = sc.indexOf(T);
  const tune = Array(tuneLength(song.meter)).fill(null);
  const pcsOf = (b) => chordPcs(song.key, chordDef(song.key.mode, song.bars[b]));
  const nearest = (target, pcs) => {
    let best = base;
    let bd = Infinity;
    sc.forEach((n, i) => {
      if (!pcs.includes(n % 12)) return;
      const d = Math.abs(i - target) + r() * 0.9;
      if (d < bd) { bd = d; best = i; }
    });
    return best;
  };
  const leadPc = (song.key.tonic + 11) % 12;
  let prev = base;
  for (let b = 0; b < BARS; b += 1) {
    const inPh = b % 4;
    const plain = RHYTHMS[rhythm]?.[song.meter] || RHYTHMS.steady[song.meter];
    let pat = plain;
    if (inPh === 3) pat = CADENCE[song.meter][b === 7 ? 1 : 0];
    else if (inPh === 2 && plain.length > 2 && r() < 0.5) pat = plain.slice(0, -1);
    const pcs = pcsOf(b);
    const pull = chordDef(song.key.mode, song.bars[b]);
    for (const s of pat) {
      const x = (inPh * m.steps + s) / (4 * m.steps);
      const target = base - 2 + SHAPES[shape].f(x) * 8;
      let i;
      if (b === 7 && s === 0 && pull.job === 'home') i = nearest(target, [song.key.tonic]);
      else if (m.strong.includes(s) || inPh === 3) i = nearest(target, pcs);
      else {
        const dir = Math.sign(target - prev) || (r() < 0.5 ? 1 : -1);
        i = prev + dir;
        if (i < 0 || i >= sc.length) i = prev - dir;
      }
      let n = sc[i];
      // in minor, the leaning note over the pull chord is raised
      if (song.key.mode === 'minor' && pcs.includes(leadPc) && n % 12 === (leadPc + 11) % 12) n += 1;
      tune[b * m.steps + s] = n;
      prev = i;
    }
  }
  // the answer starts like the question: bar 5 copies bar 1, nudged onto its own chord's notes
  const pcs5 = pcsOf(4);
  for (let s = 0; s < m.steps; s += 1) {
    const v = tune[s];
    const at = 4 * m.steps + s;
    if (v === null) { tune[at] = null; continue; }
    if (m.strong.includes(s) && !pcs5.includes(v % 12)) {
      let best = v;
      let bd = Infinity;
      for (const n of sc) if (pcs5.includes(n % 12) && Math.abs(n - v) < bd) { bd = Math.abs(n - v); best = n; }
      tune[at] = best;
    } else tune[at] = v;
  }
  return tune;
}

/** Some help: only bar 1 and bar 5 of a made tune (each followed by a rest), the rest left blank. */
export function startTune(song, opts) {
  const t = makeTune(song, opts);
  const st = METERS[song.meter].steps;
  return t.map((v, i) => (i < st || (i >= 4 * st && i < 5 * st) ? v : i === st || i === 5 * st ? 'z' : null));
}

/** Notes starting on a big beat that are not in their bar's chord (the desk shows them red). */
export function leaningNotes(song) {
  const m = METERS[song.meter];
  const out = new Set();
  song.tune.forEach((v, col) => {
    if (!Number.isInteger(v) || !m.strong.includes(col % m.steps)) return;
    const c = chordDef(song.key.mode, song.bars[Math.floor(col / m.steps)]);
    if (!chordPcs(song.key, c).includes(v % 12)) out.add(col);
  });
  return out;
}

// ---------- what the desk hears ----------

/** A few short lines on the chords: where they start, the question in bar 4, the landing. */
export function hearChords(song) {
  const { key } = song;
  const b = song.bars.map((rn) => chordDef(key.mode, rn));
  const home = homeChord(key.mode);
  const nm = (c) => chordName(key, c);
  const out = [];
  out.push(b[0].rn === home.rn ? `It starts at home, on ${nm(home)}.` : `It starts on ${nm(b[0])}, away from home. Your ear has to wait to find out where home is.`);
  if (b[3].job === 'pull') out.push(`Bar 4 stops on the pull chord, ${nm(b[3])}. That sounds like a question, so the second half gets to answer it.`);
  else if (b[3].rn === home.rn) out.push('Bar 4 lands on home already, so the question is answered halfway. Try a pull chord there.');
  else out.push(`Bar 4 stops on ${nm(b[3])}: an open, floaty question.`);
  if (b[7].rn === home.rn && b[6].job === 'pull') out.push('Bars 7 and 8 go pull, then home. A full stop. When it loops, it starts fresh.');
  else if (b[7].rn === home.rn) out.push(`It ends on home after ${nm(b[6])}, a softer landing.`);
  else out.push(`It ends on ${nm(b[7])}, not home, so it pulls straight back to bar 1. Perfect for a loop that never stops.`);
  if (new Set(song.bars).size <= 2) out.push('Only two different chords. A third one gives the answer somewhere new to go.');
  if (song.bars.slice(0, 4).join() === song.bars.slice(4).join()) out.push('Both halves have the same chords. Change bar 7 or 8 and the second half becomes an answer.');
  if (key.mode === 'major' && !b.some((c) => c.q === 'm')) out.push(`No minor chords, so it is all sunshine. Swap one ${nm(home)} for ${nm(chordDef('major', 'vi'))} to bring a cloud.`);
  if (key.mode === 'minor' && !b.some((c) => c.rn === 'V' || c.rn === 'V7')) out.push('No V chord, so nothing leans hard into home. That can sound old and folky.');
  for (let i = 0; i < 7; i += 1) {
    if (b[i].job === 'pull' && b[i + 1].job !== 'home' && b[i + 1].job !== 'pull') {
      out.push(`In bar ${i + 1}, ${nm(b[i])} pulls toward home but goes to ${nm(b[i + 1])} instead. A surprise! Keep it if you like it.`);
      break;
    }
  }
  return out;
}

/** A few short lines on the tune: big beats on chord notes, the question, the ending, the high point, leaps, repeats. */
export function hearTune(song, help = 0) {
  const m = METERS[song.meter];
  const st = m.steps;
  const t = song.tune;
  const now = sounding(t);
  const starts = t.map((v, c) => [v, c]).filter(([v]) => Number.isInteger(v));
  if (!starts.length) return [`No notes yet. ${help < 2 ? 'Let the desk start you off, or tap' : 'Tap'} a square.`];
  const out = [];
  let on = 0;
  let all = 0;
  const lean = [];
  for (let b = 0; b < BARS; b += 1) {
    for (const s of m.strong) {
      const v = now[b * st + s];
      if (!Number.isInteger(v)) continue;
      all += 1;
      if (chordPcs(song.key, chordDef(song.key.mode, song.bars[b])).includes(v % 12)) on += 1;
      else if (lean.length < 2 && !lean.includes(b + 1)) lean.push(b + 1);
    }
  }
  if (all) out.push(`${on} of ${all} big beats land on a chord note.${lean.length ? ` Bar ${lean.join(' and ')} rubs. A rub is fine if the next note steps onto a chord note.` : ' That is why it sounds like it fits.'}`);
  const q = now[4 * st - 1];
  const end = now[BARS * st - 1];
  const home = song.key.tonic;
  if (Number.isInteger(q)) out.push(q % 12 === home ? 'The question already ends on home. Try another note at the end of bar 4 to keep it open.' : 'The question ends away from home, so it sounds unfinished. Good.');
  if (Number.isInteger(end)) {
    if (end % 12 === home) out.push('The answer ends on the home note. Done!');
    else if (chordDef(song.key.mode, song.bars[7]).job === 'home') out.push('The last note is not the home note, so it sounds like there is more to say. Nice for a loop.');
    else out.push('It ends away from home and rolls back to the start.');
  }
  const hi = Math.max(...starts.map(([v]) => v));
  const hiBars = [...new Set(starts.filter(([v]) => v === hi).map(([, c]) => Math.floor(c / st) + 1))];
  out.push(hiBars.length <= 2 ? `The highest note comes in bar ${hiBars.join(' and ')}. That is the big moment.` : 'The highest note comes back a lot. Save it for one special moment.');
  let leap = 0;
  let lb = 0;
  for (let i = 1; i < starts.length; i += 1) {
    const d = Math.abs(starts[i][0] - starts[i - 1][0]);
    if (d > leap) { leap = d; lb = Math.floor(starts[i][1] / st) + 1; }
  }
  if (leap >= 9) out.push(`Big jump into bar ${lb}. After a big jump, tunes usually step back the other way.`);
  const pat = (b) => t.slice(b * st, b * st + st).map((v) => (v !== null ? 'x' : '.')).join('');
  const same = [];
  for (let b = 1; b < BARS; b += 1) if (pat(b) === pat(0) && pat(0).includes('x')) same.push(b + 1);
  out.push(same.length ? `Bar ${same.join(', ')} ${same.length > 1 ? 'have' : 'has'} the same rhythm as bar 1. Repeating a rhythm is what makes a tune catchy.` : 'No bar repeats the rhythm of bar 1. Try copying it once.');
  return out;
}

// ---------- the notes a song plays ----------

// An event is { t (seconds), d (seconds), m (MIDI), v (loudness 0-1), voice } for a note, or
// { t, drum: 'kick'|'snare'|'hat', v } for a drum.

/** When a step of a bar sounds, in seconds from the bar's start (the bouncy groove swings 4/4 and 3/4). */
function stepTime(song, s, e) {
  const swing = song.groove === 'bouncy' && song.meter !== '6/8' ? e / 3 : 0;
  return s * e + (s % 2 ? swing : 0);
}

/** The left hand for the song's chords: passes times through the eight bars. */
export function backing(song, { passes = 1, loud = 1, groove = song.groove } = {}) {
  const m = METERS[song.meter];
  const e = eighth(song.meter, song.bpm);
  const g = { ...song, groove };
  const at = (s) => stepTime(g, s, e);
  const out = [];
  for (let p = 0; p < passes; p += 1) {
    song.bars.forEach((rn, i) => {
      const c = chordDef(song.key.mode, rn);
      const v = voicing(song.key, c);
      const t0 = (p * BARS + i) * m.steps * e;
      const note = (s, d, n, vel) => out.push({ t: t0 + at(s), d: d * e, m: n, v: vel * loud, voice: 'piano' });
      const fifth = v.bass + 7 > 59 ? v.bass - 5 : v.bass + 7;
      if (groove === 'rolling') {
        note(0, m.steps, v.bass, 0.11);
        const top = v.tones.slice(-3);
        const pat = m.steps === 8 ? [top[0], top[1], top[2], top[0] + 12, top[2], top[1], top[0]] : [top[0], top[1], top[2], top[1], top[0]];
        pat.forEach((n, j) => note(j + 1, 1.6, n, 0.055));
      } else if (song.meter === '4/4') {
        for (const s of [0, 4]) { note(s, 1.8, s ? fifth : v.bass, 0.11); v.tones.forEach((n) => note(s + 2, 1.4, n, 0.05)); }
        if (groove === 'bouncy') note(7, 1, v.bass, 0.07);
      } else if (song.meter === '3/4') {
        note(0, 1.8, v.bass, 0.11);
        for (const s of [2, 4]) v.tones.forEach((n) => note(s, 1.4, n, groove === 'bouncy' ? 0.045 : 0.05));
      } else {
        for (const s of [0, 3]) note(s, 2.6, s ? fifth : v.bass, 0.11);
        const chordSteps = groove === 'bouncy' ? [1, 2, 4, 5] : [2, 5];
        for (const s of chordSteps) v.tones.forEach((n) => note(s, groove === 'bouncy' ? 0.7 : 1, n, groove === 'bouncy' ? 0.04 : 0.05));
      }
    });
  }
  return out;
}

/** The tune's notes for one pass, starting at t0 seconds, shifted up by `up` semitones. */
function tuneEvents(song, t0, { up = 0, v = 0.2, voice = song.voice } = {}) {
  const e = eighth(song.meter, song.bpm);
  const len = song.tune.length;
  const out = [];
  song.tune.forEach((n, col) => {
    if (!Number.isInteger(n)) return;
    let end = col + 1;
    while (end < len && song.tune[end] === null) end += 1;
    const st = METERS[song.meter].steps;
    const a = Math.floor(col / st) * st * e + stepTime(song, col % st, e);
    const b = end >= len ? len * e : Math.floor(end / st) * st * e + stepTime(song, end % st, e);
    out.push({ t: t0 + a, d: (b - a) * 0.95, m: n + up, v, voice });
  });
  return out;
}

function drumEvents(song, t0) {
  const m = METERS[song.meter];
  const e = eighth(song.meter, song.bpm);
  const out = [];
  for (let b = 0; b < BARS; b += 1) {
    for (let s = 0; s < m.steps; s += 1) {
      const t = t0 + b * m.steps * e + stepTime(song, s, e);
      if (song.meter === '4/4') {
        if (s === 0 || s === 4 || (song.groove === 'rolling' && s === 7 && b % 2)) out.push({ t, drum: 'kick', v: 1 });
        if (s === 2 || s === 6) out.push({ t, drum: 'snare', v: 1 });
      } else if (song.meter === '3/4') {
        if (s === 0) out.push({ t, drum: 'kick', v: 1 });
        if (s === 2 || s === 4) out.push({ t, drum: 'snare', v: 0.55 });
      } else {
        if (s === 0) out.push({ t, drum: 'kick', v: 1 });
        if (s === 3) out.push({ t, drum: 'snare', v: 1 });
      }
      out.push({ t, drum: 'hat', v: m.strong.includes(s) ? 1 : 0.7 });
    }
  }
  return out;
}

/**
 * Everything the song plays. full: the whole loop, both passes with the kid's groove, sound,
 * drums and second-time change; otherwise one plain pass (the tune on the piano over steady
 * chords), for trying the tune. tuneOnly leaves out the chords.
 */
export function songEvents(song, { full = true, tuneOnly = false } = {}) {
  const e = eighth(song.meter, song.bpm);
  const pass = BARS * METERS[song.meter].steps * e;
  const out = [];
  if (!full) {
    if (!tuneOnly) out.push(...backing(song, { passes: 1, loud: 0.6, groove: 'steady' }));
    out.push(...tuneEvents(song, 0, { voice: 'piano' }));
    return out;
  }
  out.push(...backing(song, { passes: PASSES, loud: 0.85 }));
  for (let p = 0; p < PASSES; p += 1) {
    const t0 = p * pass;
    const second = p === 1;
    out.push(...tuneEvents(song, t0, { up: second && song.second === 'high' ? 12 : 0 }));
    if (second && song.second === 'echo') {
      out.push(...tuneEvents(song, t0 + METERS[song.meter].beat * e, { up: 12, v: 0.08, voice: song.voice === 'chip' ? 'chip' : 'flute' }));
    }
    if (song.drums === 'both' || (song.drums === 'second' && second)) out.push(...drumEvents(song, t0));
  }
  return out;
}

/** A short text of the song (its key, timing, chords and tune bar by bar), for the shelf and for grown-ups. */
export function songText(song) {
  const st = METERS[song.meter].steps;
  const asc = (n) => pitchName(song.key, n).replace('♯', '#').replace('♭', 'b');
  const lines = [];
  for (let b = 0; b < BARS; b += 1) {
    const notes = song.tune.slice(b * st, b * st + st).map((v) => (v === null ? '-' : v === 'z' ? 'z' : asc(v))).join(' ');
    lines.push(`${b + 1} ${chordName(song.key, chordDef(song.key.mode, song.bars[b])).replace('♯', '#').replace('♭', 'b')}: ${notes}`);
  }
  return `${song.name || 'My song'}: ${keyName(song.key).replace('♯', '#').replace('♭', 'b')}, ${song.meter}, ${song.bpm} bpm, ${song.groove}, ${song.voice}\n${lines.join('\n')}`;
}
