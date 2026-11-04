// Piano listening (test version). Everything here runs on the device; no sound is
// recorded, saved or sent anywhere.
//
// The built-in engine looks at the microphone's spectrum about 50 times a second:
//  - a new note shows up as a sudden rise across many pitches (an "onset");
//  - after each onset it watches the next ~200 ms. A piano note's pitches stay
//    put (voices slide and waver), it is made of clean pitches (coughs and claps
//    are noise), and it only fades (singing holds or swells).
//  - "seconds since the last piano note" drives the bored and asleep states;
//  - the onsets also go to the beat follower (beat.js), so the buddy can dance.
// Google's sound recognizer (hear.js) can also give its verdict on each second of
// sound. The mode picks who decides: 'builtin', 'google', or 'both' (both agree).
// The thresholds are kept in TUNING so we can adjust them after real tests.

export const TUNING = {
  low: 80, high: 5000,      // Hz range the engine looks at
  gate: 6,                  // dB above the room's noise floor before a sound counts
  creep: 0.02,              // dB per frame (~1 dB a second) the noise floor may rise: slow, so
                            // a pedalled piece ringing on doesn't become the "quiet room"
  minLevel: -75,            // dB (full scale): anything quieter is silence
  fluxK: 2.0,               // how far above recent "change" an onset must be (fast runs keep it high)
  fluxMin: 2.5,             // dB, the smallest change that can be an onset
  refractory: 100,          // ms between two onsets (a note's echo and ring ~80 ms later is not a new note)
  judgeFrames: 10,          // frames watched after an onset (~200 ms at 20 ms a frame)
  settle: 3,                // skip the frames that still hold the sound before the onset
  lag: 3,                   // compare frames this far apart (~60 ms)
  wobbleFrom: 300,          // Hz: pitch wobble is measured on peaks above this
  wobble: 10,               // cents a piano note's pitches may move (voices slide and waver)
  tonal: 0.5,               // share of energy in clean pitches (coughs and claps are noise)
  rise: 0.3,                // dB a sound must get louder as it starts (a fading echo is not a new note)
  grow: 0.6,                // dB a sound may grow after it starts (piano notes only fade; singing holds)
  googlePiano: 0.1,         // Google's piano score that counts as piano
  boredAfter: 30,           // seconds without a piano note
  asleepAfter: 60,
};

/** The piano decision, from the numbers features() measured. */
export function isPiano(f, tune = TUNING) {
  return f.wobble <= tune.wobble && f.tonal >= tune.tonal && f.rise >= tune.rise && f.growth <= tune.grow;
}

const NOTE_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'];

/** "A4" for 440 Hz. */
export function noteName(hz) {
  if (!(hz > 0)) return '';
  const midi = Math.round(69 + 12 * Math.log2(hz / 440));
  return `${NOTE_NAMES[((midi % 12) + 12) % 12]}${Math.floor(midi / 12) - 1}`;
}

function median(xs) {
  if (!xs.length) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/** The buddy's state from seconds since the last piano note (heard: any note yet). */
export function buddyState(since, heard = true, tune = TUNING) {
  if (since >= tune.asleepAfter) return 'asleep';
  if (since >= tune.boredAfter) return 'bored';
  if (since < 4 && heard) return 'playing';
  return 'waiting';
}

/** The strongest spectral peaks of one frame: [{ hz, db }], by a parabola through each top. */
function peaks(db, binHz, lo, hi, count = 10) {
  let top = -200;
  for (let i = lo; i < hi; i++) if (db[i] > top) top = db[i];
  const found = [];
  for (let i = Math.max(lo, 1); i < hi; i++) {
    const a = db[i - 1], b = db[i], c = db[i + 1];
    if (b > a && b >= c && b > top - 45 && b > -100) {
      const d = a - 2 * b + c;
      const shift = d ? 0.5 * (a - c) / d : 0;
      found.push({ hz: (i + shift) * binHz, db: b });
    }
  }
  return found.sort((x, y) => y.db - x.db).slice(0, count);
}

/** How far, in cents, the main peaks moved between two frames (median). */
function wobble(pa, pb, minHz) {
  const shifts = [];
  for (const p of pa) {
    if (p.hz < minHz) continue;
    let best = 100;
    for (const q of pb) best = Math.min(best, Math.abs(1200 * Math.log2(q.hz / p.hz)));
    shifts.push(Math.min(best, 100));
  }
  return shifts.length ? median(shifts) : 100;
}

/** Share of the band's energy that sits in narrow peaks: 1 for clean tones, low for noise. */
function tonality(db, pk, binHz, lo, hi) {
  let all = 0, inPeaks = 0;
  const near = new Set();
  for (const p of pk) { const b = Math.round(p.hz / binHz); for (let k = b - 2; k <= b + 2; k++) near.add(k); }
  for (let i = lo; i < hi; i++) {
    const e = 10 ** (db[i] / 10);
    all += e;
    if (near.has(i)) inPeaks += e;
  }
  return all ? inPeaks / all : 0;
}

/**
 * Listens to the microphone a frame at a time. Call frame(db, wave, nowMs) with the
 * analyser's getFloatFrequencyData output (dB per bin) and getFloatTimeDomainData
 * output (the samples of the same moment), and heard(score, nowMs) with each of
 * Google's verdicts. Both return the events they finished: { type: 'onset' } right
 * away, then { type: 'piano' | 'other', local, f } once the sound has been judged.
 */
export function createListener({ sampleRate, fftSize, tune = TUNING, start = 0, mode = 'builtin' }) {
  const binHz = sampleRate / fftSize;
  const lo = Math.max(1, Math.floor(tune.low / binHz));
  const hi = Math.min(fftSize / 2 - 1, Math.ceil(tune.high / binHz));
  const n = hi - lo;
  let prevLog = null;
  const pending = [];               // sounds waiting for Google's verdict
  const levels = [];                // loudness of the last few frames
  let floor = null;                 // the room's noise floor, in dB
  const fluxHist = [];              // recent flux values (about 1 s)
  let lastOnset = -1e9;
  let judging = null;               // the onset being judged
  const s = {
    start, lastPiano: null, pianoNotes: 0, otherSounds: 0,
    level: -100, floor: -100, flux: 0, threshold: 0, note: '', last: null, google: null,
  };

  function frame(db, wave, now) {
    const events = [];
    let sum = 0;
    for (let i = 0; i < wave.length; i++) sum += wave[i] * wave[i];
    const level = 10 * Math.log10(sum / wave.length || 1e-12);
    // the noise floor drops at once and creeps up slowly (about 1 dB a second); digital
    // silence (the mic still starting up) doesn't count
    if (level > -100) {
      if (floor == null || level < floor) floor = level;
      else floor += Math.min(level - floor, tune.creep);
    }
    const loud = floor != null && level > floor + tune.gate && level > tune.minLevel;

    const lg = new Float32Array(n);
    let peak = -200, peakBin = 0;
    for (let i = 0; i < n; i++) {
      const d = Number.isFinite(db[lo + i]) ? db[lo + i] : -140;
      lg[i] = Math.max(d, -100);
      if (d > peak) { peak = d; peakBin = lo + i; }
    }
    let flux = 0;
    if (prevLog) {
      for (let i = 0; i < n; i++) { const up = lg[i] - prevLog[i]; if (up > 0) flux += up; }
      flux /= n;
    }
    prevLog = lg;
    const typical = median(fluxHist);
    const threshold = Math.max(tune.fluxMin, typical * tune.fluxK);
    fluxHist.push(flux);
    if (fluxHist.length > 50) fluxHist.shift();

    const fr = { db: Float32Array.from(db), level };
    const before = levels.length ? Math.min(...levels) : level;
    levels.push(level);
    if (levels.length > 3) levels.shift();
    const onset = loud && flux > threshold && now - lastOnset > tune.refractory;
    if (judging && onset) {
      // a new note before this one was fully judged (fast playing): judge it on what we have
      events.push(...judge(judging));
      judging = null;
    }
    if (judging) {
      judging.frames.push(fr);
      if (judging.frames.length >= tune.judgeFrames) {
        events.push(...judge(judging));
        judging = null;
      }
    } else if (onset) {
      lastOnset = now;
      judging = { at: now, frames: [fr], hz: peakBin * binHz, before };
      events.push({ type: 'onset', at: now });
    }

    Object.assign(s, { level, floor: floor ?? -100, flux, threshold, loud });
    if (loud) s.note = noteName(peakBin * binHz);
    return events;
  }

  /** The numbers the piano decision is made from. */
  function features(j) {
    const f = j.frames;
    const pk = f.map((x) => peaks(x.db, binHz, lo, hi));
    const wob = [];
    for (let i = tune.settle; i + tune.lag < f.length; i++) wob.push(wobble(pk[i], pk[i + tune.lag], tune.wobbleFrom));
    const mid = Math.min(f.length - 1, tune.settle + 1);
    const top = Math.max(...f.slice(0, 3).map((x) => x.level));
    const later = f.length > 3 ? Math.max(...f.slice(3).map((x) => x.level)) : top;
    return {
      wobble: wob.length ? median(wob) : null,
      tonal: tonality(f[mid].db, pk[mid], binHz, lo, hi),
      rise: top - j.before,
      growth: later - top,
      frames: f.length,
    };
  }

  /** The built-in verdict. In 'builtin' mode it counts at once; otherwise it waits for Google. */
  function judge(j) {
    const f = features(j);
    // too short to judge (very fast notes): the same kind as the sound just before it
    const local = f.wobble == null
      ? !!s.lastLocal && j.at - s.lastLocal < 1000
      : isPiano(f, tune);
    // only a clear piano note (pitches very still) vouches for a quick one after it
    if (local && f.wobble != null && f.wobble <= tune.wobble / 2) s.lastLocal = j.at;
    const ev = { type: local ? 'piano' : 'other', local, at: j.at, f, note: noteName(j.hz) };
    if (mode === 'builtin') return [count(ev)];
    pending.push(ev);
    return [];
  }

  function count(ev) {
    if (ev.type === 'piano') {
      s.pianoNotes++;
      s.lastPiano = Math.max(s.lastPiano ?? -Infinity, ev.at);
    } else {
      s.otherSounds++;
    }
    s.last = ev;
    return ev;
  }

  /**
   * Google's verdict on the last second of sound ({ piano, voice, top } from
   * hear.js). Sounds waiting for it are counted now. In 'google' mode hearing piano
   * also keeps the buddy awake, even when no new note started (a long held chord).
   */
  function heard(score, now) {
    const piano = score.piano >= tune.googlePiano;
    s.google = { ...score, piano: score.piano, isPiano: piano, at: now };
    if (piano && mode === 'google') s.lastPiano = Math.max(s.lastPiano ?? -Infinity, now);
    const out = [];
    while (pending.length && pending[0].at <= now) {
      const ev = pending.shift();
      ev.google = piano;
      ev.type = (mode === 'both' ? ev.local && piano : piano) ? 'piano' : 'other';
      out.push(count(ev));
    }
    return out;
  }

  /** Google heard piano within the last 1.5 s. */
  function hearingPiano(now) {
    return !!s.google?.isPiano && now - s.google.at < 1500;
  }

  /** Seconds since the last piano note (or since listening started). */
  function since(now) {
    return Math.max(0, (now - (s.lastPiano ?? s.start)) / 1000);
  }

  return { frame, heard, hearingPiano, since, mode, state: s, binHz, range: [lo, hi] };
}

/**
 * Opens the microphone with the voice filters off (they treat held piano notes as
 * noise) and feeds a listener. onFrame(listener, events, now) runs each frame, and
 * after each of Google's verdicts when a recognizer (from hear.js) is given.
 * Returns { listener, stop, settings, sampleRate, running }, where settings says which
 * filters Chrome actually used.
 */
export async function startListening(onFrame, { tune = TUNING, mode = 'builtin', recognizer = null } = {}) {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 },
  });
  const Ctx = window.AudioContext || window.webkitAudioContext;
  const ctx = new Ctx();
  await ctx.resume().catch(() => {});
  // without a tap first (the app reopened by itself), Chrome keeps the sound off until the next tap
  const wake = () => { if (ctx.state === 'suspended') ctx.resume().catch(() => {}); };
  document.addEventListener('pointerdown', wake);
  const src = ctx.createMediaStreamSource(stream);
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0;
  src.connect(analyser);
  const db = new Float32Array(analyser.frequencyBinCount);
  const wave = new Float32Array(analyser.fftSize);
  const t0 = performance.now();
  const listener = createListener({ sampleRate: ctx.sampleRate, fftSize: analyser.fftSize, tune, start: t0, mode: recognizer ? mode : 'builtin' });
  const tick = () => {
    analyser.getFloatFrequencyData(db);
    analyser.getFloatTimeDomainData(wave);
    const now = performance.now();
    onFrame(listener, listener.frame(db, wave, now), now);
  };
  const timer = setInterval(tick, 20);
  const closeAll = () => {
    document.removeEventListener('pointerdown', wake);
    clearInterval(timer);
    stream.getTracks().forEach((t) => t.stop());
    ctx.close().catch(() => {});
  };
  let stopGoogle = () => {};
  try {
    if (recognizer) {
      stopGoogle = await recognizer.listen(ctx, src, (score) => {
        const now = performance.now();
        onFrame(listener, listener.heard(score, now), now);
      });
    }
  } catch (e) {
    closeAll();   // don't leave the microphone on
    throw e;
  }
  const track = stream.getAudioTracks()[0];
  return {
    listener,
    settings: track?.getSettings?.() || {},
    sampleRate: ctx.sampleRate,
    /** False while Chrome waits for a tap before it lets the page hear. */
    get running() { return ctx.state === 'running'; },
    stop() {
      stopGoogle();
      closeAll();
    },
  };
}
